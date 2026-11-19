from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "resume_screening",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)
