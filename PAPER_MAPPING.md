# Paper → Code Mapping

This maps "An Evidence-Grounded and Skill-Freshness-Aware Framework for
AI-Based Resume Screening" (Rawat, Sushant, Pandey) onto this repo.

| Paper | Code |
|---|---|
| Tier 1 — Parsing and Structuring (§IV-A) | `backend/app/services/pdf_parser.py` (section segmentation) + `backend/app/services/entry_extractor.py` (dated, typed entries; invisible-text stripping; date sanity checks) |
| Tier 2 — Skill–Evidence Linking & Project Verification (§IV-B) | `backend/app/services/skill_extractor.py`: lexical links (ρ=1), semantic links (ρ=0.8·cos via the taxonomy embedder), baseline T1 listing evidence, Verified/Supported/Listed-only tagging |
| `Evidence` dataclass (§IV-B) | `backend/app/services/scoring_engine.py::Evidence` |
| Table II (tiers, β) | `scoring_engine.TIER_BETA` |
| Table III (half-lives by category) | `scoring_engine.HALF_LIVES` / `category_for_skill` |
| Eq. (1) entry weight q(e) | `scoring_engine.entry_weight` |
| Eq. (2) freshness f(e) | `scoring_engine.freshness` |
| Eq. (3) discounted strength v(e,k) | `scoring_engine.discounted_strength` |
| Eqs. (4)–(6) E_k, D_k, F_k | `scoring_engine.aggregate_skill` |
| Eq. (7) project term P_k | `aggregate_skill` (best discounted *project*-type entry) |
| Eq. (8) competence C_k | `aggregate_skill` |
| Eq. (9) coverage Cov(R,J) | `scoring_engine.coverage` |
| Eq. (10) composite fit S(R,J) | `scoring_engine.composite_fit` |
| Eq. (11) gap G_k | `scoring_engine.gap_term` |
| Algorithm 1 | `scoring_engine.score_resume` (+ `scorer.Scorer.calculate_score` for the Sem(R,J) step) |
| Desiderata D1–D4 (§III) | Proven by tests in `backend/app/tests/test_scoring_engine.py` (`test_d1_…` – `test_d4_…`) |
| Tier 3 — Scoring Engine (§IV-C) | `backend/app/services/scoring_engine.py` + `backend/app/services/scorer.py` |
| Tier 4 — Explainability Layer / Fig. 3 card (§IV-D) | `backend/app/services/explainer.py::build_cards` (deterministic) + `Explainer.generate_explanation` (LLM narrates the already-computed card, never recomputes it) |
| Worked example, Tables IV–V (§V) | `backend/app/tests/test_scoring_engine.py::test_table_iv_and_v_reproduced` — reproduces every published number to 2 decimal places |
| `/upload-resumes` endpoint | `backend/app/api/endpoints.py` wires Tier 1 → Tier 2 → Tier 3 → Tier 4 end to end |

## Known gaps vs. the paper (left for future work, as the paper itself states)

- Credential/repository verification (§VII-A) is not implemented; `link_conf`
  (ρ) is not yet discounted for unverifiable certification/project claims.
- `SKILL_CATEGORY_HINTS` / `SKILL_ALIASES` are small illustrative tables;
  production use should back these with the full ESCO/O*NET taxonomy via
  `taxonomy_manager`, as the paper's §II-B describes.
- Career-break clock-stopping and the fairness/audit mitigations of §VII-B
  are not yet implemented.
- The evaluation protocol in §VI (baselines B1–B5, ablations A1–A4,
  robustness test R1, nDCG@k/Kendall's τ) has no dataset or runner yet;
  `backend/scripts/evaluate.py` is a stub to build that against.
