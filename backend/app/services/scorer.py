"""
Tier 3 orchestration: turns Tier 2's per-skill evidence sets into the
composite fit score S(R,J) (Eq. 10), via app/services/scoring_engine.py.

This is the thin glue layer -- JD weights in, Evidence out of Tier 2,
semantic relevance from the taxonomy embedder, scoring_engine does the
actual math (Eqs. 1-11). Keeping this layer thin is what lets Tier 4
(explainer.py) claim its cards are "an exact reading of the scoring
function" (Section IV-D) rather than an approximation of it.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from app.services.entry_extractor import ValidatedEntry
from app.services.scoring_engine import (
    ScoringResult,
    score_resume,
    half_life_for_skill,
)
from app.services.skill_extractor import link_skill_evidence
from app.services.taxonomy_manager import taxonomy_manager


def semantic_relevance(resume_entries: List[ValidatedEntry], jd_text: str) -> float:
    """Sem(R,J) = max(0, cos(u_R, u_J)), Section IV-C.

    u_R is the mean of the per-entry embeddings (not a positional
    concatenation), which is what keeps Sem order-invariant per D4.
    """
    embedder = taxonomy_manager.embedder
    if embedder is None:
        return 0.0

    entry_texts = [e.text for e in resume_entries if e.text.strip()]
    if not entry_texts or not jd_text.strip():
        return 0.0

    entry_vecs = embedder.encode(entry_texts)
    # mean-pool
    mean_vec = [sum(col) / len(entry_vecs) for col in zip(*entry_vecs)]
    jd_vec = embedder.encode(jd_text)

    dot = sum(a * b for a, b in zip(mean_vec, jd_vec))
    norm_r = sum(a * a for a in mean_vec) ** 0.5
    norm_j = sum(a * a for a in jd_vec) ** 0.5
    if norm_r == 0 or norm_j == 0:
        return 0.0
    cos = dot / (norm_r * norm_j)
    return max(0.0, cos)


class Scorer:
    def calculate_score(
        self,
        resume_entries: List[ValidatedEntry],
        jd_weights: Dict[str, float],
        jd_text: str,
        today: Optional[date] = None,
        half_life_overrides: Optional[Dict[str, float]] = None,
    ) -> ScoringResult:
        """
        resume_entries: Tier 1 output (validated, typed, dated entries) for
            this one resume.
        jd_weights: skill_name -> w_k, as produced by Tier 1's parse of the
            JD (app/services/jd_parser.py); should sum to 1 (Section III).
        """
        evidence_by_skill = link_skill_evidence(list(jd_weights.keys()), resume_entries)
        sem = semantic_relevance(resume_entries, jd_text)

        return score_resume(
            required_skills=jd_weights,
            evidence_by_skill=evidence_by_skill,
            semantic_relevance=sem,
            today=today,
            half_life_overrides=half_life_overrides,
        )


scorer = Scorer()
