from pydantic import BaseModel, Field
from typing import List, Dict, Any
from app.services.llm_wrapper import llm_wrapper

class ExplanationResult(BaseModel):
    strengths: List[str] = Field(description="Key strengths of the candidate based on matched skills, with brief citations.")
    gaps: List[str] = Field(description="Missing or weak areas compared to the JD.")
    suggested_questions: List[str] = Field(description="Questions to ask the candidate to probe weak areas or verify claims.")
    summary: str = Field(description="A short paragraph summarizing the candidate's fit.")

class Explainer:
    def __init__(self):
        self.prompt_template = """
        You are an expert technical recruiter summarizing a candidate's fit for a job.
        
        Job Description Requirements:
        {jd_requirements}
        
        Candidate's Extracted Skills and Scores:
        {candidate_scores}
        
        Generate a summary of the candidate's strengths, gaps, suggested interview questions, and a brief overall summary. 
        Where applicable, reference the specific skills found or missed.
        """

    def generate_explanation(self, jd_requirements: str, candidate_scores: str) -> Optional[ExplanationResult]:
        prompt = self.prompt_template.format(
            jd_requirements=jd_requirements, 
            candidate_scores=candidate_scores
        )
        result = llm_wrapper.generate_structured_output(prompt=prompt, schema=ExplanationResult, temperature=0.2)
        return result

explainer = Explainer()
