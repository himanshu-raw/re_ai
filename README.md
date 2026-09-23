# Evidence-Grounded and Skill-Aware Resume Screening Framework

An AI-powered resume screening tool that extracts skills, normalizes them against an ESCO taxonomy, and scores candidates against job descriptions. Crucially, every skill extraction and proficiency claim is **grounded** in exact character spans from the resume, preventing hallucinations and ensuring recruiter auditability.

## Architecture

- **Backend:** FastAPI (Python), PostgreSQL + `pgvector`
- **Frontend:** Next.js (React), Tailwind CSS, shadcn/ui
- **ML/NLP:** `PyMuPDF` (PDF parsing), `spaCy` (segmentation), `Presidio` (PII redaction), `sentence-transformers` (embeddings), Gemini LLM (extraction & verification).

## Features
- **Blind Screening:** Automatic PII redaction before scoring.
- **Evidence Verification:** Dual LLM checks to verify span entailment.
- **Skill Adjacency:** Awards partial credit for semantically related skills via taxonomy embeddings.
- **Fairness Audits:** Includes scripts to test counterfactual fairness and disparate impact ratio.

## Getting Started

1. Set `GEMINI_API_KEY` in `.env`
2. `docker-compose up --build`
3. Access UI at `http://localhost:3000`
4. Access API Docs at `http://localhost:8000/docs`

## Evaluation
Run the evaluation suite:
`python backend/scripts/evaluate.py`
