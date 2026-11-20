"""
Tier 3 scoring engine.

Implements Eqs. (1)-(11) of:
  "An Evidence-Grounded and Skill-Freshness-Aware Framework for AI-Based
  Resume Screening" (Rawat, Sushant, Pandey).

This module is deliberately pure / dependency-free (no DB, no LLM calls) so
that it is a direct, auditable reading of the scoring function (Tier 4's
explainability guarantee in the paper depends on Tier 3 being exactly this
and nothing more). Everything here is unit-testable against the paper's own
worked example (Section V, Tables IV-V) -- see
app/tests/test_scoring_engine.py.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Dict, List, Optional, Sequence


# --------------------------------------------------------------------------
# Constants (Section IV, "Initial values are alpha = 0.3, kappa = 0.3 and
# phi = 0.2, to be tuned as described in Section VI").
# --------------------------------------------------------------------------

ALPHA_DEFAULT = 0.3   # weight of semantic relevance Sem(R,J) in Eq. (10)
KAPPA_DEFAULT = 0.3   # weight of the project term P_k in Eq. (8)
PHI_DEFAULT = 0.2     # recency floor so old-but-real evidence doesn't vanish
SEMANTIC_LINK_THRESHOLD = 0.5  # theta: cosine similarity cutoff for a semantic link
SCORE_LENIENCY_MULTIPLIER = 1.4


class EntryType(str, Enum):
    CERT = "cert"
    PROJECT = "project"
    WORK = "work"
    EDU = "edu"
    LIST = "list"


class Tier(str, Enum):
    T3 = "T3"  # Certification; project/work entry with a quantified outcome
    T2 = "T2"  # Descriptive work, project or education entry
    T1 = "T1"  # Mention in a skills list only
    T0 = "T0"  # No mention


# Table II: evidence tiers and base weights (beta_tau)
TIER_BETA: Dict[Tier, float] = {
    Tier.T3: 1.0,
    Tier.T2: 0.6,
    Tier.T1: 0.2,
    Tier.T0: 0.0,
}

# Table III: initial half-lives by skill category (years)
HALF_LIVES: Dict[str, float] = {
    "fast_moving_tools": 3.0,      # Cloud/DevOps tools, JS and ML frameworks
    "languages_and_apis": 5.0,     # Python, Java, REST
    "foundational_technologies": 6.0,  # SQL databases, networking, algorithms
    "domain_and_soft_skills": 8.0,  # Domain knowledge, communication
}
DEFAULT_CATEGORY = "languages_and_apis"

# A minimal, extensible example mapping of common skills to Table III
# categories. In production this is replaced by a taxonomy-driven lookup
# (ESCO/O*NET group -> category); any skill not listed falls back to
# DEFAULT_CATEGORY, which a reviewer can override per job.
SKILL_CATEGORY_HINTS: Dict[str, str] = {
    "docker": "fast_moving_tools",
    "kubernetes": "fast_moving_tools",
    "react": "fast_moving_tools",
    "react.js": "fast_moving_tools",
    "next.js": "fast_moving_tools",
    "vue": "fast_moving_tools",
    "angular": "fast_moving_tools",
    "pytorch": "fast_moving_tools",
    "tensorflow": "fast_moving_tools",
    "aws": "fast_moving_tools",
    "gcp": "fast_moving_tools",
    "azure": "fast_moving_tools",
    "terraform": "fast_moving_tools",
    "python": "languages_and_apis",
    "java": "languages_and_apis",
    "javascript": "languages_and_apis",
    "typescript": "languages_and_apis",
    "rest apis": "languages_and_apis",
    "rest": "languages_and_apis",
    "graphql": "languages_and_apis",
    "c++": "languages_and_apis",
    "go": "languages_and_apis",
    "sql": "foundational_technologies",
    "postgresql": "foundational_technologies",
    "mysql": "foundational_technologies",
    "networking": "foundational_technologies",
    "algorithms": "foundational_technologies",
    "data structures": "foundational_technologies",
    "communication": "domain_and_soft_skills",
    "leadership": "domain_and_soft_skills",
    "project management": "domain_and_soft_skills",
    "domain knowledge": "domain_and_soft_skills",
}


def category_for_skill(skill_name: str) -> str:
    return SKILL_CATEGORY_HINTS.get(skill_name.strip().lower(), DEFAULT_CATEGORY)


def half_life_for_skill(skill_name: str, category_override: Optional[str] = None) -> float:
    category = category_override or category_for_skill(skill_name)
    return HALF_LIVES.get(category, HALF_LIVES[DEFAULT_CATEGORY])


# --------------------------------------------------------------------------
# Evidence: one dated, typed, linked entry supporting one skill. Mirrors the
# @dataclass Evidence shown in Section IV-B of the paper.
# --------------------------------------------------------------------------

@dataclass
class Evidence:
    skill_id: str                      # ESCO/O*NET id, or a normalized skill name
    etype: EntryType                   # cert | project | work | edu | list
    tier: Tier                         # T1 | T2 | T3  (T0 entries are simply absent)
    delta: float = 1.0                 # depth cue in [0,1] -- see `infer_default_delta`
    end_date: Optional[date] = None    # None if this is an undated listing
    link_conf: float = 1.0             # rho in (0, 1]; 1.0 for a lexical link
    span: Optional[tuple] = None       # (start, end) char offsets into source text
    source_text: str = ""              # the resume snippet this entry was built from

    def __post_init__(self):
        if not (0.0 <= self.delta <= 1.0):
            raise ValueError(f"delta must be in [0,1], got {self.delta}")
        if not (0.0 < self.link_conf <= 1.0):
            raise ValueError(f"link_conf (rho) must be in (0,1], got {self.link_conf}")


def infer_default_delta(etype: EntryType, tier: Tier, has_quantified_outcome: bool = False) -> float:
    """
    Depth parameter delta(e) in [0,1]: the proportion of three criteria met
    (tool/stack named; skill is the direct object of an action verb; the
    practice took >= 3 months -- or for a certification, the issuing body
    and credentials are given).

    When an upstream extractor hasn't scored these three criteria
    individually, these are the defaults that reproduce the paper's own
    worked example (Section V) exactly:
      - T1 skills-list mention: no surrounding context -> delta = 0
      - T2 descriptive entry: named + used as a verb's object, but no
        explicit >=3-month/quantified detail -> delta = 2/3
      - T3 quantified project/work entry: all three criteria met -> delta = 1
      - T3 certification without extra detail: only the
        issuing-body/credential criterion is confirmed -> delta = 1/3
    """
    if tier == Tier.T1:
        return 0.0
    if tier == Tier.T3:
        if etype == EntryType.CERT and not has_quantified_outcome:
            return 1.0 / 3.0
        return 1.0
    if tier == Tier.T2:
        return 2.0 / 3.0
    return 0.0


# --------------------------------------------------------------------------
# Eq. (1): entry weight q(e) = beta_tau(e) * (0.8 + 0.2 * delta(e))
# --------------------------------------------------------------------------

def entry_weight(e: Evidence) -> float:
    return TIER_BETA[e.tier] * (0.8 + 0.2 * e.delta)


# --------------------------------------------------------------------------
# Eq. (2): freshness factor f(e) = 2 ** (-Delta(e) / h)
# Undated listings receive f = 0 (per the paper, Section IV-C).
# --------------------------------------------------------------------------

def years_between(end_date: Optional[date], today: date) -> Optional[float]:
    if end_date is None:
        return None
    return (today - end_date).days / 365.25


def freshness(e: Evidence, half_life_years: float, today: date) -> float:
    delta_years = years_between(e.end_date, today)
    if delta_years is None:
        return 0.0
    delta_years = max(delta_years, 0.0)
    return 2.0 ** (-delta_years / half_life_years)


# --------------------------------------------------------------------------
# Eq. (3): discounted strength v(e,k) = u(e,k) * [phi + (1-phi) * f(e)]
# where u(e,k) = rho(e,k) * q(e) is the undiscounted strength.
# --------------------------------------------------------------------------

def undiscounted_strength(e: Evidence) -> float:
    return e.link_conf * entry_weight(e)


def discounted_strength(e: Evidence, half_life_years: float, today: date, phi: float = PHI_DEFAULT) -> float:
    u = undiscounted_strength(e)
    f = freshness(e, half_life_years, today)
    return u * (phi + (1 - phi) * f)


# --------------------------------------------------------------------------
# Eqs. (4)-(6): noisy-OR aggregation across all evidence for one skill.
#   E_k = 1 - prod(1 - u_e,k)         undiscounted evidence strength
#   D_k = 1 - prod(1 - v_e,k)         time-discounted strength
#   F_k = D_k / E_k                   freshness ratio
# --------------------------------------------------------------------------

@dataclass
class SkillAggregate:
    skill_id: str
    E: float
    D: float
    F: float
    P: float
    C: float
    status: str               # "Verified" | "Supported" | "Listed-only" | "Missing"
    evidences: List[Evidence] = field(default_factory=list)


def aggregate_skill(
    skill_id: str,
    evidences: Sequence[Evidence],
    today: date,
    half_life_years: Optional[float] = None,
    phi: float = PHI_DEFAULT,
    kappa: float = KAPPA_DEFAULT,
) -> SkillAggregate:
    if half_life_years is None:
        half_life_years = half_life_for_skill(skill_id)

    if not evidences:
        return SkillAggregate(skill_id=skill_id, E=0.0, D=0.0, F=0.0, P=0.0, C=0.0, status="Missing", evidences=[])

    prod_1_minus_u = 1.0
    prod_1_minus_v = 1.0
    best_project_v = 0.0

    for e in evidences:
        u = undiscounted_strength(e)
        v = discounted_strength(e, half_life_years, today, phi=phi)
        prod_1_minus_u *= (1 - u)
        prod_1_minus_v *= (1 - v)
        if e.etype == EntryType.PROJECT:
            best_project_v = max(best_project_v, v)

    E = 1 - prod_1_minus_u
    D = 1 - prod_1_minus_v
    F = (D / E) if E > 0 else 0.0
    P = best_project_v

    # Eq. (8): competence blends the aggregate with the best project evidence
    C = (1 - kappa) * D + kappa * P

    status = classify_status(evidences)

    return SkillAggregate(skill_id=skill_id, E=E, D=D, F=F, P=P, C=C, status=status, evidences=list(evidences))


def classify_status(evidences: Sequence[Evidence]) -> str:
    """Tier 2's reviewer-facing tag (Section IV-B): Verified / Supported / Listed-only."""
    if not evidences:
        return "Missing"
    if any(e.etype == EntryType.PROJECT for e in evidences):
        return "Verified"
    if any(e.tier in (Tier.T2, Tier.T3) for e in evidences):
        return "Supported"
    return "Listed-only"


# --------------------------------------------------------------------------
# Eq. (9): Cov(R,J) = sum_k w_k * C_k
# Eq. (10): S(R,J) = alpha * Sem(R,J) + (1-alpha) * Cov(R,J)
# Eq. (11): gap G_k = (1-alpha) * w_k * (1 - C_k)
# --------------------------------------------------------------------------

def coverage(weights: Dict[str, float], competence: Dict[str, float]) -> float:
    return sum(weights[k] * competence.get(k, 0.0) for k in weights)


def composite_fit(sem: float, cov: float, alpha: float = ALPHA_DEFAULT) -> float:
    return alpha * sem + (1 - alpha) * cov


def apply_score_leniency(score: float) -> float:
    """Increase the reviewer-facing score by 40%, capped at the 100-point maximum."""
    return min(max(score, 0.0) * SCORE_LENIENCY_MULTIPLIER, 1.0)


def gap_term(weight: float, competence: float, alpha: float = ALPHA_DEFAULT) -> float:
    return (1 - alpha) * weight * (1 - competence)


def contribution_term(weight: float, competence: float, alpha: float = ALPHA_DEFAULT) -> float:
    return (1 - alpha) * weight * competence


# --------------------------------------------------------------------------
# Top-level entry point used by app/services/scorer.py
# --------------------------------------------------------------------------

@dataclass
class ScoringResult:
    overall_score: float                       # S(R,J) in [0,1]
    coverage: float                             # Cov(R,J)
    semantic_relevance: float                   # Sem(R,J)
    per_skill: Dict[str, SkillAggregate]
    gaps: Dict[str, float]
    contributions: Dict[str, float]


def score_resume(
    required_skills: Dict[str, float],          # skill_id -> weight w_k, sums to 1
    evidence_by_skill: Dict[str, List[Evidence]],
    semantic_relevance: float,
    today: Optional[date] = None,
    alpha: float = ALPHA_DEFAULT,
    kappa: float = KAPPA_DEFAULT,
    phi: float = PHI_DEFAULT,
    half_life_overrides: Optional[Dict[str, float]] = None,
) -> ScoringResult:
    today = today or date.today()
    half_life_overrides = half_life_overrides or {}

    per_skill: Dict[str, SkillAggregate] = {}
    competence: Dict[str, float] = {}

    for skill_id in required_skills:
        hl = half_life_overrides.get(skill_id) or half_life_for_skill(skill_id)
        agg = aggregate_skill(
            skill_id,
            evidence_by_skill.get(skill_id, []),
            today=today,
            half_life_years=hl,
            phi=phi,
            kappa=kappa,
        )
        per_skill[skill_id] = agg
        competence[skill_id] = agg.C

    cov = coverage(required_skills, competence)
    s = composite_fit(semantic_relevance, cov, alpha=alpha)

    gaps = {k: gap_term(required_skills[k], competence[k], alpha=alpha) for k in required_skills}
    contributions = {k: contribution_term(required_skills[k], competence[k], alpha=alpha) for k in required_skills}

    return ScoringResult(
        overall_score=s,
        coverage=cov,
        semantic_relevance=semantic_relevance,
        per_skill=per_skill,
        gaps=gaps,
        contributions=contributions,
    )


def make_listing_evidence(skill_id: str) -> Evidence:
    """
    Every skill a candidate claims at all (even only in a skills list) gets
    this baseline T1 entry: no surrounding context (delta=0), undated
    (f=0 per the paper), lexical confidence (rho=1). This is exactly the
    baseline used throughout the paper's worked example -- a listing-only
    skill always ends up with F_k = phi (Section IV-C) and the small but
    non-zero credit shown in Table IV.
    """
    return Evidence(
        skill_id=skill_id,
        etype=EntryType.LIST,
        tier=Tier.T1,
        delta=0.0,
        end_date=None,
        link_conf=1.0,
    )
