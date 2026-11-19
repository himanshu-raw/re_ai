"""
Tier 2 unit tests: lexical linking, alias resolution, baseline-listing
evidence, and that an unrelated skill gets no evidence at all.

Runs against the real dependency stack (sqlalchemy/pgvector/
sentence-transformers), like the rest of the suite -- see
app/tests/test_parser_and_redactor.py for the same convention. The pure
scoring-math tests that need no heavy dependencies live in
test_scoring_engine.py.
"""

from datetime import date

import pytest

from app.services.entry_extractor import DepthCues, ExtractedEntry, validate_and_normalize
from app.services.scoring_engine import EntryType, Tier
from app.services.skill_extractor import build_evidence_for_skill, _matches_alias


TODAY = date(2026, 1, 1)


def _validated_sample():
    raw = [
        ExtractedEntry(
            etype="list",
            text="Skills: Python, PostgreSQL",
            start_date=None,
            end_date=None,
            is_quantified=False,
            depth_cues=DepthCues(tool_named=False, action_verb_object=False, duration_or_credential=False),
            skills_mentioned=["Python", "PostgreSQL"],
        ),
        ExtractedEntry(
            etype="work",
            text="Built REST APIs in Python for 2 years",
            start_date="2022-01-01",
            end_date="2024-01-01",
            is_quantified=False,
            depth_cues=DepthCues(tool_named=True, action_verb_object=True, duration_or_credential=True),
            skills_mentioned=["Python"],
        ),
    ]
    return validate_and_normalize(raw, today=TODAY)


def test_alias_resolution():
    assert _matches_alias("Postgres", "postgresql")
    assert _matches_alias("k8s", "kubernetes")
    assert not _matches_alias("java", "javascript")


def test_lexical_link_builds_listing_plus_work_evidence():
    entries = _validated_sample()
    evidences = build_evidence_for_skill("python", entries)

    # One T1 listing entry + one T2 work entry (named, used as object, >=3mo)
    assert len(evidences) == 2
    tiers = sorted(e.tier for e in evidences)
    assert Tier.T1 in tiers and Tier.T2 in tiers

    listing = next(e for e in evidences if e.tier == Tier.T1)
    assert listing.end_date is None
    assert listing.delta == 0.0

    work = next(e for e in evidences if e.tier == Tier.T2)
    assert work.etype == EntryType.WORK
    assert work.delta == pytest.approx(1.0)  # all 3 depth cues met
    assert work.end_date is not None


def test_no_evidence_for_unmentioned_skill():
    entries = _validated_sample()
    evidences = build_evidence_for_skill("docker", entries)
    assert evidences == []
