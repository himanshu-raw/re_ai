from pydantic import BaseModel, Field
from typing import List, Optional
import re
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
        text = jd_text or ""
        known_skills = [
            "Python", "SQL", "Docker", "REST APIs", "REST API", "AWS",
            "Machine Learning", "React", "React.js", "Next.js", "TypeScript",
            "JavaScript", "FastAPI", "Django", "Flask", "PostgreSQL", "MySQL",
            "MongoDB", "Redis", "Kubernetes", "Terraform", "Azure", "GCP",
            "NLP", "TensorFlow", "PyTorch", "Git", "C++", "Java", "Node.js",
            "Data Analysis", "Communication", "Leadership",
        ]
        found: list[JDSkillRequirement] = []
        lower = text.lower()
        for skill in known_skills:
            start = lower.find(skill.lower())
            if start < 0:
                continue
            before = lower[max(0, start - 60):start]
            is_required = not any(marker in before for marker in ("nice to have", "preferred", "optional"))
            found.append(JDSkillRequirement(
                skill_name=skill,
                is_required=is_required,
                minimum_years=None,
                importance_weight=1.0 if is_required else 0.5,
            ))

        unique: dict[str, JDSkillRequirement] = {}
        for requirement in found:
            key = requirement.skill_name.lower()
            if key == "rest api":
                key = "rest apis"
            unique.setdefault(key, requirement)

        title_match = re.search(r"(?im)^\s*(?:job title\s*:\s*)?([^\n]{3,80}\b(?:engineer|developer|analyst|manager|scientist|architect)\b)", text)
        job_title = title_match.group(1).strip() if title_match else "Job"
        return JDModelingResult(
            job_title=job_title,
            experience_level="Mid" if re.search(r"(?i)\\b(mid|senior|experience)\\b", text) else "Entry",
            skills=list(unique.values()),
        )

jd_parser = JDParser()
