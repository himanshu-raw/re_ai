import google.generativeai as genai
from app.core.config import settings
import json
from typing import Type, Any, Optional
from pydantic import BaseModel

genai.configure(api_key=settings.GEMINI_API_KEY)

class LLMWrapper:
    def __init__(self, model_name: str = "gemini-3.1-pro-preview"):
        # For structured outputs, Gemini models >= 1.5 support response_schema
        # 2.5-pro or 1.5-pro can be used.
        self.model_name = model_name

    def generate_structured_output(self, prompt: str, schema: Type[BaseModel], temperature: float = 0.0) -> Optional[BaseModel]:
        """
        Generates structured JSON output strictly adhering to the provided Pydantic schema.
        """
        model = genai.GenerativeModel(
            model_name=self.model_name,
            generation_config={
                "temperature": temperature,
                "response_mime_type": "application/json",
                # Pass the schema directly to the Gemini API (supported in recent genai SDK versions)
                "response_schema": schema
            }
        )
        
        try:
            response = model.generate_content(prompt)
            if response.text:
                data = json.loads(response.text)
                return schema(**data)
        except Exception as e:
            print(f"Error generating structured output: {e}")
            
        return None

llm_wrapper = LLMWrapper()
