import google.generativeai as genai
from app.core.config import settings
import json
from typing import Type, Any, Optional
from pydantic import BaseModel

genai.configure(api_key=settings.GEMINI_API_KEY)

def _gemini_schema(schema: dict[str, Any], definitions: dict[str, Any] | None = None) -> dict[str, Any]:
    definitions = definitions or {}

    if "$ref" in schema:
        ref_name = schema["$ref"].rsplit("/", 1)[-1]
        resolved = definitions.get(ref_name)
        if resolved:
            return _gemini_schema(resolved, definitions)

    if "anyOf" in schema:
        variants = schema["anyOf"]
        non_null = [variant for variant in variants if variant != {"type": "null"}]
        if len(non_null) == 1:
            result = _gemini_schema(non_null[0], definitions)
            result["nullable"] = True
            return result

    cleaned: dict[str, Any] = {}
    for key, value in schema.items():
        if key in {
            "$defs",
            "definitions",
            "$ref",
            "default",
            "title",
            "examples",
            "additionalProperties",
        }:
            continue
        if key == "properties" and isinstance(value, dict):
            cleaned[key] = {
                name: _gemini_schema(property_schema, definitions)
                for name, property_schema in value.items()
            }
        elif key == "items" and isinstance(value, dict):
            cleaned[key] = _gemini_schema(value, definitions)
        elif key == "enum" and isinstance(value, list):
            cleaned[key] = value
        elif key in {"type", "description", "required", "format", "minItems", "maxItems"}:
            cleaned[key] = value
    return cleaned


class LLMWrapper:
    def __init__(self, model_name: str = "gemini-3.1-pro-preview"):
        # For structured outputs, Gemini models >= 1.5 support response_schema
        # 2.5-pro or 1.5-pro can be used.
        self.model_name = model_name

    def generate_structured_output(self, prompt: str, schema: Type[BaseModel], temperature: float = 0.0) -> Optional[BaseModel]:
        """
        Generates structured JSON output strictly adhering to the provided Pydantic schema.
        """
        raw_schema = schema.model_json_schema()
        definitions = raw_schema.pop("$defs", {})
        response_schema = _gemini_schema(raw_schema, definitions)
        model = genai.GenerativeModel(
            model_name=self.model_name,
            generation_config={
                "temperature": temperature,
                "response_mime_type": "application/json",
                "response_schema": response_schema
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
