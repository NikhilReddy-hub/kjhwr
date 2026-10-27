"""Actuals router — actual wind generation data."""
import logging
from fastapi import APIRouter, HTTPException, Query

from app.db import get_actuals
from app.analytics import parse_utc
from app.models import ActualPoint

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=list[ActualPoint])
async def get_actuals_data(
    start_date: str = Query("2026-01-01", description="Start date YYYY-MM-DD"),
    end_date: str = Query("2026-01-31", description="End date YYYY-MM-DD"),
):
    """Return actual wind generation for a date range."""
    rows = get_actuals(start_date, end_date)
    return [
        ActualPoint(
            start_time=parse_utc(r["start_time"]),
            actual_mw=float(r["generation_mw"]),
        )
        for r in rows
    ]
