from pydantic import BaseModel, Field
from typing import List, Dict, Any
from app.services.llm_wrapper import llm_wrapper

class VerificationResult(BaseModel):
    is_supported: bool = Field(description="True if the text span strictly supports the claim, False otherwise.")
    reasoning: str = Field(description="Brief explanation of why the span does or does not support the claim.")

class EvidenceVerifier:
    def __init__(self):
        self.prompt_template = """
        You are a strict fact-checking AI. Your job is to verify if a given text span from a resume explicitly supports a claimed skill and proficiency level.
        Do not make assumptions. If the text span does not mention the skill or does not provide evidence for the proficiency, mark it as unsupported.

        Claimed Skill: {skill}
        Claimed Proficiency: {proficiency}
        Provided Text Span Evidence: "{evidence_text}"
        """

    def verify_evidence(self, skill: str, proficiency: str, evidence_text: str) -> bool:
        prompt = self.prompt_template.format(
            skill=skill, 
            proficiency=proficiency, 
            evidence_text=evidence_text
        )
        # Using temperature 0 for deterministic verification
        result = llm_wrapper.generate_structured_output(prompt=prompt, schema=VerificationResult, temperature=0.0)
        
        if result:
            return result.is_supported
        return False

    def verify_all_skills(self, extracted_skills: List[Dict]) -> List[Dict]:
        """
        Runs entailment check on a list of skills. Flags ungrounded ones.
        """
        verified_skills = []
        for skill in extracted_skills:
            skill_name = skill.get("skill_name")
            proficiency = skill.get("proficiency")
            spans = skill.get("evidence_spans", [])
            
            is_supported_overall = False
            verified_spans = []
            
            for span in spans:
                evidence_text = span.get("exact_text", "")
                is_supported = self.verify_evidence(skill_name, proficiency, evidence_text)
                
                span["verified"] = is_supported
                verified_spans.append(span)
                
                if is_supported:
                    is_supported_overall = True
            
            skill["evidence_spans"] = verified_spans
            skill["is_grounded"] = is_supported_overall
            
            # If completely hallucinated, we could drop it, but better to flag it for the UI
            verified_skills.append(skill)
            
        return verified_skills

evidence_verifier = EvidenceVerifier()
