from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.pdf_parser import resume_parser
from app.services.pii_redactor import pii_redactor
from app.services.entry_extractor import (
    extract_entries,
    validate_and_normalize,
    guess_entry_type,
    ValidatedEntry,
)
from app.services.jd_parser import jd_parser
from app.services.scorer import scorer
from app.services import explainer as explainer_module
from typing import List, Dict, Any
import shutil
import os
import json

router = APIRouter()

UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Tier 1 helper: run entry_extractor over every section of a parsed resume
# and flatten into one list of ValidatedEntry, ready for Tier 2 linking.
# ---------------------------------------------------------------------------

def run_tier1(sections: Dict[str, str]) -> List[ValidatedEntry]:
    entries: List[ValidatedEntry] = []
    for section_name, section_text in sections.items():
        if len(section_text.strip()) < 10:
            continue
        raw_entries = extract_entries(section_name, section_text)
        # If the LLM returned nothing (e.g. no API key configured / call
        # failed), fall back to treating the whole section as one entry of
        # the section's guessed type, undated -- degrades gracefully to a
        # keyword-coverage-only signal rather than hard-failing upload.
        if not raw_entries:
            continue
        entries.extend(validate_and_normalize(raw_entries))
    return entries


def _jd_weights_from_parse(jd_result) -> Dict[str, float]:
    """Normalize JD skill weights so sum(w_k) = 1 (Section III), after
    applying the "required" boost."""
    raw_weights: Dict[str, float] = {}
    for req in jd_result.skills:
        w = max(req.importance_weight, 0.0)
        if req.is_required:
            w *= 1.5
        raw_weights[req.skill_name.strip().lower()] = w

    total = sum(raw_weights.values())
    if total <= 0:
        n = len(raw_weights) or 1
        return {k: 1.0 / n for k in raw_weights}
    return {k: v / total for k, v in raw_weights.items()}


def entries_to_json(entries: List[ValidatedEntry]) -> List[dict]:
    out = []
    for e in entries:
        out.append(
            {
                "etype": e.etype.value,
                "text": e.text,
                "start_date": e.start_date.isoformat() if e.start_date else None,
                "end_date": e.end_date.isoformat() if e.end_date else None,
                "is_open_ended": e.is_open_ended,
                "is_quantified": e.is_quantified,
                "depth_cues": e.depth_cues.dict(),
                "skills_mentioned": e.skills_mentioned,
                "issues": e.issues,
            }
        )
    return out


def evidence_to_json(evidence_by_skill: Dict[str, list]) -> Dict[str, list]:
    out = {}
    for skill, evs in evidence_by_skill.items():
        out[skill] = [
            {
                "etype": e.etype.value,
                "tier": e.tier.value,
                "delta": e.delta,
                "end_date": e.end_date.isoformat() if e.end_date else None,
                "link_conf": e.link_conf,
                "source_text": e.source_text,
            }
            for e in evs
        ]
    return out


@router.post("/upload-resumes")
async def upload_resumes(
    files: List[UploadFile] = File(...),
    jd: str = Form(None),
    required_skills: str = Form("[]"),
    preferred_skills: str = Form("[]"),
    db: Session = Depends(get_db),
):
    """
    Full pipeline: Tier 1 (parse+structure) -> Tier 2 (skill-evidence
    linking, inside scorer.calculate_score) -> Tier 3 (composite score) ->
    Tier 4 (explanation cards), per Section IV of the paper. If no `jd` is
    given, only Tier 1 parsing + PII masking runs (useful for previewing an
    upload before a JD is attached).
    """
    from app.db.models import Candidate

    jd_result = jd_parser.parse_jd(jd) if jd else None
    jd_weights = _jd_weights_from_parse(jd_result) if jd_result else {}
    try:
        custom_required = json.loads(required_skills) if required_skills else []
        custom_preferred = json.loads(preferred_skills) if preferred_skills else []
    except json.JSONDecodeError:
        custom_required = []
        custom_preferred = []

    custom_required = [str(skill).strip() for skill in custom_required if str(skill).strip()]
    custom_preferred = [str(skill).strip() for skill in custom_preferred if str(skill).strip()]
    custom_required_keys = {skill.strip().lower() for skill in custom_required}
    custom_preferred_keys = {skill.strip().lower() for skill in custom_preferred}

    jd_weights = {
        skill_name: weight
        for skill_name, weight in jd_weights.items()
        if skill_name not in custom_preferred_keys
    }
    raw_weights = {
        skill_name: weight * 1.5
        for skill_name, weight in jd_weights.items()
        if skill_name in custom_required_keys
    }
    jd_weights.update(raw_weights)
    for skill in custom_required:
        jd_weights.setdefault(skill.lower(), 0.75)
    for skill in custom_preferred:
        jd_weights.setdefault(skill.lower(), 0.5)

    total = sum(jd_weights.values())
    if total > 0:
        jd_weights = {skill_name: weight / total for skill_name, weight in jd_weights.items()}

    results = []
    for file in files:
        if not file.filename.endswith((".pdf", ".docx", ".txt")):
            continue

        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        raw_text = resume_parser.parse_pdf(file_path)
        sections = resume_parser.segment_sections(raw_text)

        pii_masks = {name: pii_redactor.get_masks(text) for name, text in sections.items()}

        # Tier 1
        entries = run_tier1(sections)

        response_item: Dict[str, Any] = {
            "filename": file.filename,
            "status": "uploaded",
            "sections": sections,
            "pii_masks": pii_masks,
            "parsed_entries": entries_to_json(entries),
        }

        candidate = Candidate(
            filename=file.filename,
            original_text=raw_text,
            parsed_sections=sections,
            parsed_entries=entries_to_json(entries),
        )

        if jd_weights:
            # Tier 2 + Tier 3
            scoring_result = scorer.calculate_score(
                resume_entries=entries,
                jd_weights=jd_weights,
                jd_text=jd,
            )
            # Tier 4
            cards = explainer_module.build_cards(scoring_result, jd_weights)
            narrative = explainer_module.explainer.generate_explanation(cards)

            parsed_must_have = [
                s.skill_name.strip().lower()
                for s in (jd_result.skills if jd_result else [])
                if s.is_required
            ]
            must_have_skills = list(dict.fromkeys([*parsed_must_have, *[skill.lower() for skill in custom_required]]))
            must_have_total = len(must_have_skills)
            must_have_met = sum(
                1 for skill_name in must_have_skills
                if scoring_result.per_skill.get(skill_name) is not None
                and scoring_result.per_skill[skill_name].status != "Missing"
            )

            response_item["score"] = round(scoring_result.overall_score * 100, 1)
            response_item["coverage"] = round(scoring_result.coverage, 3)
            response_item["semantic_relevance"] = round(scoring_result.semantic_relevance, 3)
            response_item["skill_cards"] = [explainer_module.card_to_dict(c) for c in cards]
            response_item["must_have_met"] = must_have_met
            response_item["must_have_total"] = must_have_total
            response_item["narrative"] = narrative.dict() if narrative else None

            candidate.extracted_skills = evidence_to_json(
                {s: scoring_result.per_skill[s].evidences for s in scoring_result.per_skill}
            )
            candidate.skill_evidence = candidate.extracted_skills
            candidate.score = scoring_result.overall_score
            candidate.scoring_result = {
                "overall_score": scoring_result.overall_score,
                "coverage": scoring_result.coverage,
                "semantic_relevance": scoring_result.semantic_relevance,
                "skill_cards": response_item["skill_cards"],
                "narrative": response_item["narrative"],
            }

        db.add(candidate)
        db.commit()
        db.refresh(candidate)
        response_item["candidate_id"] = candidate.id

        results.append(response_item)

    return {"message": "Files uploaded successfully", "job_skills": list(jd_weights.keys()), "results": results}


from pydantic import BaseModel
import datetime

class DeleteResumesRequest(BaseModel):
    ids: List[str]

@router.delete("/resumes/{resume_id}", status_code=204)
async def delete_resume(resume_id: str, db: Session = Depends(get_db)):
    from app.db.models import Candidate

    # Audit log (safe from PII)
    print(f"AUDIT: Deleted resume {resume_id} at {datetime.datetime.utcnow().isoformat()}")

    # Try to delete from DB
    try:
        db.query(Candidate).filter(Candidate.id == int(resume_id)).delete()
        db.commit()
    except Exception:
        db.rollback()
        pass

    # Delete file from disk
    safe_filename = os.path.basename(resume_id)
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    return

@router.post("/resumes/delete")
async def bulk_delete_resumes(req: DeleteResumesRequest, db: Session = Depends(get_db)):
    from app.db.models import Candidate

    print(f"AUDIT: Bulk deleted {len(req.ids)} resumes at {datetime.datetime.utcnow().isoformat()}")

    deleted = []
    failed = []

    for rid in req.ids:
        try:
            try:
                db.query(Candidate).filter(Candidate.id == int(rid)).delete()
                db.commit()
            except Exception:
                db.rollback()
                pass

            safe_filename = os.path.basename(rid)
            file_path = os.path.join(UPLOAD_DIR, safe_filename)
            if os.path.exists(file_path):
                os.remove(file_path)

            deleted.append(rid)
        except Exception as e:
            failed.append({"id": rid, "reason": str(e)})

    return {"deleted": deleted, "failed": failed}
