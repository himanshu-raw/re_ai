from pydantic import BaseModel, Field
from typing import List, Optional
from app.services.llm_wrapper import llm_wrapper

class EvidenceSpan(BaseModel):
    start_char: int = Field(description="The starting character index of the evidence in the provided section text.")
    end_char: int = Field(description="The ending character index of the evidence in the provided section text.")
    exact_text: str = Field(description="The exact text string from the resume that serves as evidence.")

class ExtractedSkill(BaseModel):
    skill_name: str = Field(description="The normalized name of the skill extracted.")
    proficiency: str = Field(description="Inferred proficiency level (e.g., 'beginner', 'intermediate', 'expert') based on context.")
    years_of_experience: Optional[float] = Field(description="Estimated years of experience using this skill, if derivable.")
    evidence_spans: List[EvidenceSpan] = Field(description="List of spans in the text that support this skill claim.")

class SkillExtractionResult(BaseModel):
    skills: List[ExtractedSkill] = Field(description="List of all skills extracted from this section.")

class SkillExtractor:
    def __init__(self):
        self.prompt_template = """
        You are an expert HR extraction system. Given the following section from a resume, extract all professional skills mentioned.
        For each skill:
        1. Identify the name of the skill. NORMALIZE the name (e.g., "React.js" -> "React", "Next.js 14" -> "Next.js", "Postgres" -> "PostgreSQL").
        2. Extract skills from list-style lines (e.g., "Frontend: React, TypeScript") by splitting on commas.
        3. Infer the proficiency (beginner, intermediate, expert) based on context (e.g., 'led a team using X' -> expert).
        4. MOST IMPORTANTLY: Provide the EXACT character spans (start and end indices) and the exact text snippet from the provided text that proves this skill exists. The exact text must literally be a substring of the provided text.

        Resume Section:
        {section_text}
        """

    def extract_skills(self, section_text: str) -> Optional[SkillExtractionResult]:
        prompt = self.prompt_template.format(section_text=section_text)
        # Using Gemini 1.5 Pro/Flash for structured outputs
        result = llm_wrapper.generate_structured_output(prompt=prompt, schema=SkillExtractionResult)
        return result

skill_extractor = SkillExtractor()
