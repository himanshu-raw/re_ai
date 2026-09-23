import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.db.session import SessionLocal, engine
from app.db.models import Base
from app.services.taxonomy_manager import taxonomy_manager, SAMPLE_TAXONOMY

def seed():
    print("Creating tables (including pgvector extension if not exists)...")
    # For pgvector to work, the extension needs to be enabled in DB.
    # Base.metadata.create_all(bind=engine) won't create the extension automatically, 
    # but we can try executing it manually first.
    try:
        with SessionLocal() as db:
            db.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            db.commit()
    except Exception as e:
        print(f"Note: Could not create vector extension (maybe it exists): {e}")

    Base.metadata.create_all(bind=engine)
    
    print("Seeding taxonomy...")
    with SessionLocal() as db:
        taxonomy_manager.initialize_taxonomy(db, SAMPLE_TAXONOMY)
    print("Done!")

if __name__ == "__main__":
    seed()
