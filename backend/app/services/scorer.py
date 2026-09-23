from typing import List, Dict, Any
from app.services.taxonomy_manager import taxonomy_manager
from sqlalchemy.orm import Session

class Scorer:
    def __init__(self):
        pass

    def calculate_score(self, db: Session, candidate_skills: List[Dict], jd_skills: List[Dict]) -> Dict[str, Any]:
        """
        Calculates a match score between a candidate and a JD.
        Includes exact matches and semantic adjacency matches via taxonomy.
        """
        total_score = 0.0
        max_possible_score = 0.0
        skill_breakdown = []

        # Convert candidate skills to a set of normalized labels (in a real app, map them to concept URIs first)
        candidate_skill_names = [s.get('skill_name', '').lower() for s in candidate_skills]

        for req in jd_skills:
            req_name = req.get('skill_name', '').lower()
            weight = req.get('importance_weight', 1.0)
            is_req = req.get('is_required', False)
            
            # Base weight modifier
            if is_req:
                weight *= 1.5
                
            max_possible_score += weight
            
            match_score = 0.0
            match_type = "missing"
            
            # Exact Match
            if req_name in candidate_skill_names:
                match_score = weight
                match_type = "exact"
            else:
                # Try Semantic Similarity (Adjacent Skills)
                similar_skills = taxonomy_manager.search_similar_skills(db, req_name, top_k=3)
                # For simplicity, if any candidate skill matches a similar skill from taxonomy with high distance
                for sim in similar_skills:
                    if sim.preferred_label.lower() in candidate_skill_names:
                        # Partial credit based on distance (distance is 0 for identical, 1 for orthogonal)
                        # We don't have exact distance here without re-computing, but assume 0.5 for demonstration
                        match_score = weight * 0.5
                        match_type = "adjacent"
                        break

            total_score += match_score
            skill_breakdown.append({
                "skill": req_name,
                "weight": weight,
                "match_score": match_score,
                "match_type": match_type
            })
            
        final_percentage = (total_score / max_possible_score) * 100 if max_possible_score > 0 else 0
        
        return {
            "overall_score": final_percentage,
            "breakdown": skill_breakdown
        }

scorer = Scorer()
