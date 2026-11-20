"""
Regression test anchored to the paper's own worked example (Section V,
Tables IV-V): "An Evidence-Grounded and Skill-Freshness-Aware Framework for
AI-Based Resume Screening."

Every (E, F, P, C) cell in Table IV and every (Cov, S) value in Table V is
reproduced here to 2 decimal places using only the equations in
app/services/scoring_engine.py -- i.e. this test is the proof that the
implementation is a faithful reading of Eqs. (1)-(11), not an
approximation of them.
"""

from datetime import date

import pytest

from app.services.scoring_engine import (
    Evidence,
    EntryType,
    Tier,
    apply_score_leniency,
    make_listing_evidence,
    score_resume,
    classify_status,
)

TODAY = date(2026, 1, 1)
WEIGHTS = {
    "python": 0.30,
    "rest apis": 0.20,
    "docker": 0.20,
    "postgresql": 0.15,
    "kubernetes": 0.15,
}


def years_ago(n: int) -> date:
    return date(TODAY.year - n, TODAY.month, TODAY.day)


def candidate_a_evidence():
    return {
        "python": [
            make_listing_evidence("python"),
            Evidence("python", EntryType.WORK, Tier.T2, delta=2 / 3, end_date=years_ago(6)),
        ],
        "rest apis": [make_listing_evidence("rest apis")],
        "docker": [make_listing_evidence("docker")],
        "postgresql": [
            make_listing_evidence("postgresql"),
            # "unquantifiable academic project seven years prior" -> T2, not T3
            Evidence("postgresql", EntryType.PROJECT, Tier.T2, delta=2 / 3, end_date=years_ago(7)),
        ],
        "kubernetes": [make_listing_evidence("kubernetes")],
    }


def candidate_b_evidence():
    return {
        "python": [
            Evidence("python", EntryType.PROJECT, Tier.T3, delta=1.0, end_date=years_ago(1)),
            Evidence("python", EntryType.WORK, Tier.T2, delta=1.0, end_date=TODAY),
        ],
        "rest apis": [
            Evidence("rest apis", EntryType.WORK, Tier.T2, delta=2 / 3, end_date=TODAY),
            make_listing_evidence("rest apis"),
        ],
        "docker": [
            Evidence("docker", EntryType.CERT, Tier.T3, delta=1 / 3, end_date=years_ago(2)),
            make_listing_evidence("docker"),
        ],
        "postgresql": [make_listing_evidence("postgresql")],
        "kubernetes": [
            Evidence("kubernetes", EntryType.WORK, Tier.T2, delta=2 / 3, end_date=years_ago(1)),
            make_listing_evidence("kubernetes"),
        ],
    }


# Table IV, verbatim
EXPECTED_A = {
    "python":     dict(E=0.63, F=0.52, P=0.00, C=0.23),
    "rest apis":  dict(E=0.16, F=0.20, P=0.00, C=0.02),
    "docker":     dict(E=0.16, F=0.20, P=0.00, C=0.02),
    "postgresql": dict(E=0.63, F=0.53, P=0.31, C=0.33),
    "kubernetes": dict(E=0.16, F=0.20, P=0.00, C=0.02),
}
EXPECTED_B = {
    "python":     dict(E=1.00, F=0.96, P=0.90, C=0.94),
    "rest apis":  dict(E=0.63, F=0.91, P=0.00, C=0.40),
    "docker":     dict(E=0.89, F=0.70, P=0.00, C=0.44),
    "postgresql": dict(E=0.16, F=0.20, P=0.00, C=0.02),
    "kubernetes": dict(E=0.63, F=0.77, P=0.00, C=0.34),
}


@pytest.mark.parametrize(
    "evidence,expected,sem,expected_cov,expected_s",
    [
        (candidate_a_evidence(), EXPECTED_A, 0.71, 0.130, 0.304),
        (candidate_b_evidence(), EXPECTED_B, 0.74, 0.504, 0.575),
    ],
    ids=["candidate_A", "candidate_B"],
)
def test_table_iv_and_v_reproduced(evidence, expected, sem, expected_cov, expected_s):
    result = score_resume(WEIGHTS, evidence, semantic_relevance=sem, today=TODAY)

    for skill, exp in expected.items():
        agg = result.per_skill[skill]
        assert agg.E == pytest.approx(exp["E"], abs=0.01)
        assert agg.F == pytest.approx(exp["F"], abs=0.01)
        assert agg.P == pytest.approx(exp["P"], abs=0.01)
        assert agg.C == pytest.approx(exp["C"], abs=0.01)

    assert result.coverage == pytest.approx(expected_cov, abs=0.001)
    assert result.overall_score == pytest.approx(expected_s, abs=0.001)


def test_candidate_b_outranks_candidate_a():
    # Table V: "Rank by composite score: A=2, B=1" despite identical 5/5
    # keyword coverage -- the whole point of the paper.
    rA = score_resume(WEIGHTS, candidate_a_evidence(), semantic_relevance=0.71, today=TODAY)
    rB = score_resume(WEIGHTS, candidate_b_evidence(), semantic_relevance=0.74, today=TODAY)
    assert rB.overall_score > rA.overall_score


@pytest.mark.parametrize(
    "raw_score,expected",
    [(0.0, 0.0), (0.5, 0.7), (0.8, 1.0), (1.0, 1.0)],
)
def test_score_leniency_increases_by_40_percent_and_caps_at_100(raw_score, expected):
    assert apply_score_leniency(raw_score) == pytest.approx(expected)


def test_listing_only_skill_has_freshness_equal_to_floor():
    # "A listing-only skill has F_k = phi." (Section IV-C)
    result = score_resume(WEIGHTS, {"docker": [make_listing_evidence("docker")]}, semantic_relevance=0.0, today=TODAY)
    assert result.per_skill["docker"].F == pytest.approx(0.2, abs=1e-9)


# --- Desiderata D1-D4 (Section III) -------------------------------------

def test_d1_evidence_monotonicity():
    base = [make_listing_evidence("python")]
    more = base + [Evidence("python", EntryType.WORK, Tier.T2, delta=2 / 3, end_date=years_ago(1))]
    r_base = score_resume({"python": 1.0}, {"python": base}, semantic_relevance=0.0, today=TODAY)
    r_more = score_resume({"python": 1.0}, {"python": more}, semantic_relevance=0.0, today=TODAY)
    assert r_more.per_skill["python"].C >= r_base.per_skill["python"].C


def test_d2_recency_monotonicity():
    recent = [Evidence("python", EntryType.WORK, Tier.T2, delta=2 / 3, end_date=years_ago(1))]
    old = [Evidence("python", EntryType.WORK, Tier.T2, delta=2 / 3, end_date=years_ago(8))]
    r_recent = score_resume({"python": 1.0}, {"python": recent}, semantic_relevance=0.0, today=TODAY)
    r_old = score_resume({"python": 1.0}, {"python": old}, semantic_relevance=0.0, today=TODAY)
    assert r_recent.per_skill["python"].C >= r_old.per_skill["python"].C


def test_d3_decomposability():
    result = score_resume(WEIGHTS, candidate_b_evidence(), semantic_relevance=0.74, today=TODAY)
    reconstructed_cov = sum(result.contributions.values()) / (1 - 0.3)
    assert reconstructed_cov == pytest.approx(result.coverage, abs=1e-9)


def test_d4_order_invariance():
    # Only type/tier/delta/dates feed the score -- shuffling the evidence
    # list (i.e. "section order") cannot change the result.
    evidence = candidate_b_evidence()["python"]
    r1 = score_resume({"python": 1.0}, {"python": evidence}, semantic_relevance=0.0, today=TODAY)
    r2 = score_resume({"python": 1.0}, {"python": list(reversed(evidence))}, semantic_relevance=0.0, today=TODAY)
    assert r1.per_skill["python"].C == pytest.approx(r2.per_skill["python"].C, abs=1e-9)


def test_status_classification():
    assert classify_status([make_listing_evidence("x")]) == "Listed-only"
    assert classify_status([Evidence("x", EntryType.WORK, Tier.T2, delta=1.0)]) == "Supported"
    assert classify_status([Evidence("x", EntryType.PROJECT, Tier.T3, delta=1.0)]) == "Verified"
    assert classify_status([]) == "Missing"
