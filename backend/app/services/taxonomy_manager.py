import json
from sqlalchemy.orm import Session
from app.db.models import SkillTaxonomy
from sentence_transformers import SentenceTransformer

class TaxonomyManager:
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        # We load a small embedding model for local taxonomy matching
        try:
            self.embedder = SentenceTransformer(model_name)
        except Exception as e:
            print(f"Failed to load sentence-transformers model: {e}")
            self.embedder = None

    def initialize_taxonomy(self, db: Session, sample_skills: list):
        """
        Populate the database with a sample taxonomy (or load from CSV/JSON in production).
        """
        if not self.embedder:
            return

        for skill in sample_skills:
            # Check if exists
            existing = db.query(SkillTaxonomy).filter(SkillTaxonomy.preferred_label == skill['preferred_label']).first()
            if not existing:
                # Generate embedding
                embedding = self.embedder.encode(skill['preferred_label']).tolist()
                
                new_skill = SkillTaxonomy(
                    concept_uri=skill['concept_uri'],
                    preferred_label=skill['preferred_label'],
                    description=skill.get('description', ''),
                    embedding=embedding
                )
                db.add(new_skill)
        db.commit()

    def search_similar_skills(self, db: Session, query: str, top_k: int = 5):
        """
        Search for taxonomy skills similar to the extracted skill string using pgvector.
        """
        if not self.embedder:
            return []
            
        query_embedding = self.embedder.encode(query).tolist()
        
        # pgvector cosine similarity search (<=>)
        results = db.query(SkillTaxonomy).order_by(
            SkillTaxonomy.embedding.cosine_distance(query_embedding)
        ).limit(top_k).all()
        
        return results

taxonomy_manager = TaxonomyManager()

# A small set of sample skills mimicking ESCO for demonstration
SAMPLE_TAXONOMY = [
    {"concept_uri": "http://data.europa.eu/esco/skill/1", "preferred_label": "Python (computer programming)"},
    {"concept_uri": "http://data.europa.eu/esco/skill/2", "preferred_label": "JavaScript"},
    {"concept_uri": "http://data.europa.eu/esco/skill/3", "preferred_label": "machine learning"},
    {"concept_uri": "http://data.europa.eu/esco/skill/4", "preferred_label": "data analysis"},
    {"concept_uri": "http://data.europa.eu/esco/skill/5", "preferred_label": "project management"},
    {"concept_uri": "http://data.europa.eu/esco/skill/6", "preferred_label": "SQL"},
    {"concept_uri": "http://data.europa.eu/esco/skill/7", "preferred_label": "React.js"},
]
