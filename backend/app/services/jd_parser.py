from pydantic import BaseModel, Field
from typing import List, Optional
from app.services.llm_wrapper import llm_wrapper

class JDSkillRequirement(BaseModel):
    skill_name: str = Field(description="The normalized name of the required or preferred skill.")
    is_required: bool = Field(description="True if the skill is a strict requirement, False if it's preferred/nice-to-have.")
    minimum_years: Optional[float] = Field(description="Minimum years of experience required for this skill, if specified.")
    importance_weight: float = Field(description="Weight of this skill from 0.0 to 1.0, based on how heavily it is emphasized in the JD.")

class JDModelingResult(BaseModel):
    job_title: str
    experience_level: str = Field(description="e.g., Entry, Mid, Senior, Lead")
    skills: List[JDSkillRequirement]

class JDParser:
    def __init__(self):
        self.prompt_template = """
        You are an expert technical recruiter. Given the following job description (JD), decompose it into structured requirements.
        Extract the job title, overall experience level, and a list of specific skill requirements.
        For each skill, determine if it is strictly required or just preferred, estimate the minimum years of experience if mentioned, and assign an importance weight (0.0 to 1.0) based on how critical it is for the role.

        Job Description:
        {jd_text}
        """

    def parse_jd(self, jd_text: str) -> Optional[JDModelingResult]:
        prompt = self.prompt_template.format(jd_text=jd_text)
        result = llm_wrapper.generate_structured_output(prompt=prompt, schema=JDModelingResult)
        return result

jd_parser = JDParser()
