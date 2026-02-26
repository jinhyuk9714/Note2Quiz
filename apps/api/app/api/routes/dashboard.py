from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.deps import CurrentUserID, DBSession
from app.schemas.dashboard import DashboardStatsResponse, DashboardTrendsResponse
from app.services.dashboard_service import get_dashboard_stats, get_dashboard_trends

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStatsResponse)
async def dashboard_stats(db: DBSession, user_id: CurrentUserID) -> DashboardStatsResponse:
    return await get_dashboard_stats(db=db, user_id=user_id)


@router.get("/trends", response_model=DashboardTrendsResponse)
async def dashboard_trends(
    db: DBSession,
    user_id: CurrentUserID,
    days: int = Query(default=30, ge=7, le=90),
) -> DashboardTrendsResponse:
    return await get_dashboard_trends(db=db, user_id=user_id, days=days)
