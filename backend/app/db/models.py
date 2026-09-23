from sqlalchemy import Column, Integer, String, Text, Float, JSON, ForeignKey
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from app.db.session import Base

class SkillTaxonomy(Base):
    __tablename__ = "skill_taxonomy"
    
    id = Column(Integer, primary_key=True, index=True)
    concept_uri = Column(String, unique=True, index=True)
    preferred_label = Column(String, index=True)
    description = Column(Text)
    embedding = Column(Vector(384)) # sentence-transformers all-MiniLM-L6-v2 uses 384 dims

class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    original_text = Column(Text) # Storing redacted text
    parsed_sections = Column(JSON) # e.g. {"experience": "...", "education": "..."}
    extracted_skills = Column(JSON) # e.g. [{"skill": "Python", "span": [10, 16], "proficiency": "expert", "evidence": "..."}]
    score = Column(Float, default=0.0)
