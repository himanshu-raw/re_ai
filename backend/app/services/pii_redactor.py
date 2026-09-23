from presidio_analyzer import AnalyzerEngine
from presidio_analyzer.nlp_engine import NlpEngineProvider
from presidio_anonymizer import AnonymizerEngine

class PIIRedactor:
    def __init__(self):
        # We can add more entities as needed (e.g., PERSON, EMAIL_ADDRESS, PHONE_NUMBER)
        configuration = {
            "nlp_engine_name": "spacy",
            "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}],
        }
        provider = NlpEngineProvider(nlp_configuration=configuration)
        nlp_engine = provider.create_engine()
        
        self.analyzer = AnalyzerEngine(nlp_engine=nlp_engine, supported_languages=["en"])
        
        # Tech allowlist so they aren't marked as PERSON or ORG (though we skip ORG anyway)
        self.allowlist = {"next.js", "vercel", "github", "blockchain", "fastapi", "sanity cms", "react", "react.js", "typescript", "tailwind css", "shadcn", "mysql", "aws", "python", "c++", "javascript", "chatgpt"}

    def get_masks(self, text: str) -> list:
        if not text:
            return []
            
        entities = ["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "URL"]
        results = self.analyzer.analyze(text=text, entities=entities, language='en')
        
        masks = []
        for r in results:
            # For PERSON, enforce higher confidence
            if r.entity_type == "PERSON" and r.score < 0.7:
                continue
                
            token_text = text[r.start:r.end]
            
            # Check allowlist
            if any(tech in token_text.lower() for tech in self.allowlist):
                continue
                
            # Avoid masking things that look like institutions or degrees in the education section context, but Presidio handles most.
            masks.append({
                "type": r.entity_type,
                "start": r.start,
                "end": r.end
            })
            
        return masks

pii_redactor = PIIRedactor()
