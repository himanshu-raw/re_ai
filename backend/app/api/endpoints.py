from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.pdf_parser import resume_parser
from app.services.pii_redactor import pii_redactor
from app.services.skill_extractor import skill_extractor
from app.services.jd_parser import jd_parser
from typing import List
import shutil
import os

router = APIRouter()

UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload-resumes")
async def upload_resumes(
    files: List[UploadFile] = File(...), 
    jd: str = Form(None),
    db: Session = Depends(get_db)
):
    """
    Endpoint for uploading resumes. Parses text, extracts skills on ORIGINAL text, generates PII masks.
    """
    results = []
    for file in files:
        if not file.filename.endswith(('.pdf', '.docx', '.txt')):
            continue
            
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Parse original text
        raw_text = resume_parser.parse_pdf(file_path)
        
        # Segment sections on original text
        sections = resume_parser.segment_sections(raw_text)
        
        # Extract skills and PII per section
        extracted_skills = []
        pii_masks = {}
        for section_name, section_text in sections.items():
            pii_masks[section_name] = pii_redactor.get_masks(section_text)
            
            if len(section_text.strip()) > 20:
                result = skill_extractor.extract_skills(section_text)
                if result and result.skills:
                    for skill in result.skills:
                        extracted_skills.append({
                            "skill_name": skill.skill_name,
                            "proficiency": skill.proficiency,
                            "section": section_name,
                            "evidence_spans": [span.dict() for span in skill.evidence_spans]
                        })
        
        results.append({
            "filename": file.filename,
            "status": "uploaded",
            "sections": sections,
            "pii_masks": pii_masks,
            "extracted_skills": extracted_skills
        })
        
    return {"message": "Files uploaded successfully", "results": results}

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
