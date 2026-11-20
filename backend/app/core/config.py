from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Resume Screening API"
    DATABASE_URL: str
    DB_SSLMODE: str = "require"
    REDIS_URL: str
    GEMINI_API_KEY: str

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
