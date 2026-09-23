import fitz  # PyMuPDF
import spacy
import re
from typing import Dict, Any

# Load English tokenizer, tagger, parser and NER
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    # Will fail if model isn't downloaded, but Dockerfile handles this.
    nlp = None

class ResumeParser:
    def __init__(self):
        # Case-insensitive regex pattern for common section headers
        self.header_pattern = re.compile(
            r'^\s*(objective|summary|profile|education|technical skills|skills|projects|experience|work history|employment|internships|certifications|achievements|extracurricular)\s*:?\s*$',
            re.IGNORECASE
        )

    def parse_pdf(self, file_path: str) -> str:
        """Extract text from PDF preserving layout where possible."""
        text = ""
        try:
            doc = fitz.open(file_path)
            for page in doc:
                text += page.get_text("text") + "\n"
        except Exception as e:
            print(f"Error parsing PDF {file_path}: {e}")
        return text

    def segment_sections(self, text: str) -> Dict[str, str]:
        """Heuristically segment resume into key sections."""
        lines = text.split('\n')
        sections = {"Header / contact": ""}
        current_section = "Header / contact"
        
        for line in lines:
            line_cleaned = line.strip()
            
            if not line_cleaned:
                sections[current_section] += line + "\n"
                continue
            
            # Check if line is a section header (short line matching regex)
            if len(line_cleaned) < 40 and self.header_pattern.match(line_cleaned):
                header_name = line_cleaned.rstrip(':').strip().title()
                current_section = header_name
                if current_section not in sections:
                    sections[current_section] = ""
            else:
                sections[current_section] += line + "\n"
                
        return {k: v.strip() for k, v in sections.items() if v.strip()}

resume_parser = ResumeParser()
