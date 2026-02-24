from __future__ import annotations

from fastapi import APIRouter

from app.core.deps import CurrentUserID, DBSession
from app.schemas.dashboard import DashboardStatsResponse
from app.services.dashboard_service import get_dashboard_stats

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStatsResponse)
async def dashboard_stats(db: DBSession, user_id: CurrentUserID) -> DashboardStatsResponse:
    return await get_dashboard_stats(db=db, user_id=user_id)
