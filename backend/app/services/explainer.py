"""
Tier 4: Explainability Layer (Section IV-D).

The per-skill explanation card is built *deterministically* straight from
the Tier 3 ScoringResult -- status, E/F/P, the contribution
(1-alpha)*w_k*C_k, and the gap G_k (Eq. 11) -- so it is "an exact reading of
the scoring function and not a mere approximation" and cannot drift from
the score shown to the reviewer. An LLM (via explainer.generate_explanation)
is only used afterwards to narrate these already-computed cards into prose
(strengths/gaps/interview questions); it is explicitly never asked to
produce or adjust the numbers themselves, since per the paper "SHAP and
LIME are still relevant only to the black-box Sem term."
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from app.services.entry_extractor import ValidatedEntry
from app.services.llm_wrapper import llm_wrapper
from app.services.scoring_engine import (
    ALPHA_DEFAULT,
    Evidence,
    ScoringResult,
    gap_term,
    contribution_term,
)


@dataclass
class EvidenceLine:
    etype: str
    tier: str
    quantified_note: str  # e.g. "quantified" / "descriptive"
    years_ago: Optional[float]
    text: str


@dataclass
class ExplanationCard:
    skill: str
    weight: float
    status: str  # Verified | Supported | Listed-only | Missing
    E: float
    F: float
    P: float
    C: float
    contribution: float
    gap: float
    evidence: List[EvidenceLine]


def _years_ago(end_date, today: date) -> Optional[float]:
    if end_date is None:
        return None
    return round((today - end_date).days / 365.25, 1)


def build_cards(
    result: ScoringResult,
    weights: Dict[str, float],
    today: Optional[date] = None,
    alpha: float = ALPHA_DEFAULT,
) -> List[ExplanationCard]:
    """One card per required skill, directly off the ScoringResult -- this
    is Fig. 3 in the paper, generalized to every skill in K_J."""
    today = today or date.today()
    cards: List[ExplanationCard] = []

    for skill, weight in weights.items():
        agg = result.per_skill.get(skill)
        if agg is None:
            continue

        evidence_lines = []
        for e in agg.evidences:
            evidence_lines.append(
                EvidenceLine(
                    etype=e.etype.value,
                    tier=e.tier.value,
                    quantified_note="quantified" if e.tier.value == "T3" else "descriptive",
                    years_ago=_years_ago(e.end_date, today),
                    text=e.source_text,
                )
            )

        cards.append(
            ExplanationCard(
                skill=skill,
                weight=weight,
                status=agg.status,
                E=round(agg.E, 2),
                F=round(agg.F, 2),
                P=round(agg.P, 2),
                C=round(agg.C, 2),
                contribution=round(contribution_term(weight, agg.C, alpha=alpha), 3),
                gap=round(gap_term(weight, agg.C, alpha=alpha), 3),
                evidence=evidence_lines,
            )
        )

    # Biggest gaps first -- what a reviewer wants to see.
    cards.sort(key=lambda c: c.gap, reverse=True)
    return cards


def card_to_dict(card: ExplanationCard) -> dict:
    return {
        "skill": card.skill,
        "weight": card.weight,
        "status": card.status,
        "E": card.E,
        "F": card.F,
        "P": card.P,
        "C": card.C,
        "contribution": card.contribution,
        "gap": card.gap,
        "evidence": [
            {
                "type": e.etype,
                "tier": e.tier,
                "note": e.quantified_note,
                "years_ago": e.years_ago,
                "text": e.text,
            }
            for e in card.evidence
        ],
    }


def cards_to_text(cards: List[ExplanationCard]) -> str:
    """Compact text rendering fed to the narrative LLM step -- deliberately
    just the already-computed numbers, nothing for the model to re-derive."""
    lines = []
    for c in cards:
        lines.append(
            f"- {c.skill} (weight {c.weight:.2f}): {c.status}. "
            f"E={c.E} F={c.F} P={c.P} -> C={c.C}. "
            f"Contribution={c.contribution}, Gap={c.gap}."
        )
    return "\n".join(lines)


# --------------------------------------------------------------------------
# Optional narrative layer: turns the deterministic cards into prose. The
# LLM is given the numbers as fixed facts and asked only to narrate them.
# --------------------------------------------------------------------------

class ExplanationResult(BaseModel):
    strengths: List[str] = Field(description="Key strengths, citing the skill and its status/recency.")
    gaps: List[str] = Field(description="Missing or weak areas, citing the skill and why (no evidence, or evidence is old).")
    suggested_questions: List[str] = Field(description="Interview questions targeting the lowest-contribution skills.")
    summary: str = Field(description="A short paragraph summarizing overall fit.")


class Explainer:
    def __init__(self):
        self.prompt_template = """
        You are an expert technical recruiter. Below are per-skill
        explanation cards that were computed deterministically by a scoring
        engine -- treat every number as ground truth; do not recompute,
        second-guess, or alter any of them. Your only job is to narrate
        them clearly for a human reviewer.

        Per-skill cards:
        {cards_text}

        Write: the candidate's key strengths (skills with high contribution
        and "Verified"/"Supported" status), the clearest gaps (skills with
        the largest gap values, noting whether that's because evidence is
        missing, merely listed, or present but stale), a few interview
        questions that probe the weakest high-weight skills, and a short
        overall summary.
        """

    def generate_explanation(self, cards: List[ExplanationCard]) -> Optional[ExplanationResult]:
        prompt = self.prompt_template.format(cards_text=cards_to_text(cards))
        return llm_wrapper.generate_structured_output(prompt=prompt, schema=ExplanationResult, temperature=0.2)


explainer = Explainer()
