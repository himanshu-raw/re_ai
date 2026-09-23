import pytest
from app.services.pdf_parser import resume_parser
from app.services.pii_redactor import pii_redactor

def test_section_segmentation():
    sample_text = """Himanshu Rawat
someemail@gmail.com | 555-1234
Objective: Looking for a job.
TECHNICAL SKILLS
Frontend: React.js, Next.js 14 (Vercel), TypeScript, Tailwind CSS, shadcn/ui
Backend & Data: Python, FastAPI, Drizzle ORG, MySQL, Sanity CMS, AWS
EXPERIENCE
Experience with Python and REST APIs. Used Docker for deployment."""
    
    sections = resume_parser.segment_sections(sample_text)
    
    assert "Header / contact" in sections
    assert "Himanshu Rawat" in sections["Header / contact"]
    
    assert "Technical Skills" in sections
    assert "Frontend: React.js" in sections["Technical Skills"]
    
    assert "Experience" in sections
    assert "Used Docker" in sections["Experience"]

def test_pii_redactor_allowlist():
    sample_text = "Himanshu Rawat lives in New York. He uses Next.js, Vercel, and GitHub."
    
    masks = pii_redactor.get_masks(sample_text)
    
    # Should mask Himanshu Rawat (PERSON)
    masked_texts = [sample_text[m["start"]:m["end"]] for m in masks]
    
    # "Next.js", "Vercel", "GitHub" should NOT be masked
    assert "Next.js" not in masked_texts
    assert "Vercel" not in masked_texts
    assert "GitHub" not in masked_texts
