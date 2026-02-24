from __future__ import annotations

import uuid

from fastapi import APIRouter

from app.core.deps import DBSession
from app.schemas.dashboard import DashboardStatsResponse
from app.services.dashboard_service import get_dashboard_stats

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

TEST_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@router.get("/stats", response_model=DashboardStatsResponse)
async def dashboard_stats(db: DBSession) -> DashboardStatsResponse:
    return await get_dashboard_stats(db=db, user_id=TEST_USER_ID)
