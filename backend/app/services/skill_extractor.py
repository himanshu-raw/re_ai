"""
Tier 2: Skill-Evidence Linking and Project Verification (Section IV-B).

Turns Tier 1's dated/typed entries into, for each required skill k, the
evidence set Ev(k) of Evidence objects that Tier 3 (scoring_engine) scores.

A lexical link (rho = 1) is created when an entry literally names the skill
(or a known alias). A semantic link (rho = 0.8 * cos) is created when the
entry's embedding is close enough to the skill's embedding, via the same
taxonomy embedder used for ESCO/O*NET matching. Project cross-checking
(Verified / Supported / Listed-only) is derived automatically from the
evidence composition -- see scoring_engine.classify_status.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from app.services.entry_extractor import ValidatedEntry, entry_tier, entry_delta
from app.services.scoring_engine import Evidence, EntryType, Tier, SEMANTIC_LINK_THRESHOLD, make_listing_evidence
from app.services.taxonomy_manager import taxonomy_manager

# Small, extensible alias table (production systems back this with the full
# ESCO/O*NET alias list via taxonomy_manager; this keeps the demo usable
# without a populated taxonomy DB).
SKILL_ALIASES: Dict[str, List[str]] = {
    "postgresql": ["postgres"],
    "javascript": ["js"],
    "typescript": ["ts"],
    "react": ["react.js", "reactjs"],
    "next.js": ["nextjs"],
    "kubernetes": ["k8s"],
    "rest apis": ["rest api", "rest", "restful api", "restful apis"],
}


def _normalize(name: str) -> str:
    return name.strip().lower()


def _matches_alias(candidate_name: str, target_skill: str) -> bool:
    candidate_name = _normalize(candidate_name)
    target_skill = _normalize(target_skill)
    if candidate_name == target_skill:
        return True
    aliases = SKILL_ALIASES.get(target_skill, [])
    return candidate_name in aliases


def lexical_link(entry: ValidatedEntry, skill_name: str) -> bool:
    return any(_matches_alias(mentioned, skill_name) for mentioned in entry.skills_mentioned)


def semantic_link_confidence(entry: ValidatedEntry, skill_name: str) -> Optional[float]:
    """Returns rho = 0.8 * cos(entry_embedding, skill_embedding) if above
    threshold theta, else None (no semantic link)."""
    embedder = taxonomy_manager.embedder
    if embedder is None or not entry.text.strip():
        return None
    try:
        entry_vec = embedder.encode(entry.text)
        skill_vec = embedder.encode(skill_name)
    except Exception:
        return None

    dot = sum(a * b for a, b in zip(entry_vec, skill_vec))
    norm_e = sum(a * a for a in entry_vec) ** 0.5
    norm_s = sum(a * a for a in skill_vec) ** 0.5
    if norm_e == 0 or norm_s == 0:
        return None
    cos = dot / (norm_e * norm_s)

    if cos < SEMANTIC_LINK_THRESHOLD:
        return None
    return 0.8 * cos


def build_evidence_for_skill(
    skill_name: str,
    entries: List[ValidatedEntry],
) -> List[Evidence]:
    """Ev(k): every entry linked to this skill, lexically or semantically,
    plus the baseline T1 listing entry if the skill appears in any
    list-type entry at all."""
    evidences: List[Evidence] = []
    has_listing = False

    for entry in entries:
        rho: Optional[float] = None
        if lexical_link(entry, skill_name):
            rho = 1.0
        else:
            rho = semantic_link_confidence(entry, skill_name)

        if rho is None:
            continue

        if entry.etype == EntryType.LIST:
            has_listing = True
            continue  # the baseline listing evidence below covers this

        evidences.append(
            Evidence(
                skill_id=skill_name,
                etype=entry.etype,
                tier=entry_tier(entry),
                delta=entry_delta(entry),
                end_date=entry.end_date,
                link_conf=rho,
                source_text=entry.text,
            )
        )

    if has_listing:
        evidences.append(make_listing_evidence(skill_name))

    return evidences


def link_skill_evidence(
    required_skills: List[str],
    entries: List[ValidatedEntry],
) -> Dict[str, List[Evidence]]:
    """Top-level Tier 2 call: for every skill the job requires, build Ev(k)."""
    return {skill: build_evidence_for_skill(skill, entries) for skill in required_skills}
