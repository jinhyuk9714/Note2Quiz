from __future__ import annotations

from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.documents import router as documents_router
from app.api.routes.export import router as export_router
from app.api.routes.quiz import router as quiz_router
from app.api.routes.wrong_notes import router as wrong_notes_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(dashboard_router)
api_router.include_router(documents_router)
api_router.include_router(export_router)
api_router.include_router(quiz_router)
api_router.include_router(wrong_notes_router)
