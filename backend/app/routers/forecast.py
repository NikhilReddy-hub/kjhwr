"""Forecast router — latest available forecast for a delivery day."""
import logging
from datetime import timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.analytics import (
    cutoff_utc,
    expand_hourly_forecast_to_halfhour,
    parse_utc,
    select_latest_forecasts,
)
from app.config import settings
from app.db import get_actuals, get_forecasts_in_range
from app.models import (
    ActualPoint,
    DecisionForecastResponse,
    ForecastPoint,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/latest", response_model=DecisionForecastResponse)
async def get_latest_forecast(
    delivery_date: str = Query(
        ...,
        description="Delivery date in YYYY-MM-DD format (must be in Jan 2026)",
        example="2026-01-15",
    ),
    cutoff_hour: int = Query(
        default=settings.default_cutoff_hour_local,
        description="Decision cutoff hour (UK local time, 24h)",
        ge=0,
        le=23,
    ),
    cutoff_minute: int = Query(
        default=settings.default_cutoff_minute_local,
        description="Decision cutoff minute",
        ge=0,
        le=59,
    ),
):
    """
    Return the latest wind forecast available at decision time for a delivery day.

    - Fetches all WINDFOR forecasts with publishTime <= cutoff on D-1
    - For each 30-min settlement period, selects the forecast with
      the maximum publishTime (WINDFOR is hourly; mapped to 30-min by repetition)
    - Also returns actuals if available (for comparison)
    """
    # Validate date range
    if not delivery_date.startswith("2026-01"):
        raise HTTPException(
            status_code=400,
            detail="Only January 2026 delivery dates are supported",
        )

    # Compute cutoff UTC
    cutoff = cutoff_utc(delivery_date, cutoff_hour, cutoff_minute)
    cutoff_local_str = f"{cutoff_hour:02d}:{cutoff_minute:02d} UK local (D-1)"

    # Query: forecasts for this delivery day, published before cutoff
    # startTime range: 2026-01-DD T00:00Z to 2026-01-DD T23:30Z
    start_from = f"{delivery_date}T00:00:00+00:00"
    start_to = f"{delivery_date}T23:30:00+00:00"
    cutoff_str = cutoff.isoformat()

    raw_forecasts = get_forecasts_in_range(start_from, start_to, cutoff_str)

    if not raw_forecasts:
        logger.warning(
            "No forecasts found for %s with cutoff %s", delivery_date, cutoff_str
        )
        # Return empty but valid response
        return DecisionForecastResponse(
            delivery_date=delivery_date,
            cutoff_time_utc=cutoff,
            cutoff_time_local=cutoff_local_str,
            forecast_points=[],
            actuals=[],
            missing_periods=[
                f"{delivery_date}T{i // 2:02d}:{(i % 2) * 30:02d}:00+00:00"
                for i in range(48)
            ],
        )

    # Select best forecast per startTime
    best = select_latest_forecasts(raw_forecasts, cutoff)
    expanded = expand_hourly_forecast_to_halfhour(best)

    # Build response points
    forecast_points: list[ForecastPoint] = []
    for start_str, row in sorted(expanded.items()):
        dt_start = parse_utc(start_str)
        dt_pub = parse_utc(row["publish_time"])
        horizon = (dt_start - dt_pub).total_seconds() / 3600.0
        forecast_points.append(
            ForecastPoint(
                start_time=dt_start,
                publish_time=dt_pub,
                forecast_mw=round(float(row["generation_mw"]), 1),
                horizon_hours=round(horizon, 1),
            )
        )

    # Get actuals
    raw_actuals = get_actuals(delivery_date, delivery_date)
    actual_points: list[ActualPoint] = [
        ActualPoint(
            start_time=parse_utc(r["start_time"]),
            actual_mw=float(r["generation_mw"]),
        )
        for r in raw_actuals
    ]

    # Check for missing periods (expected 48 half-hours)
    covered_starts = {fp.start_time for fp in forecast_points}
    missing: list[str] = []
    from datetime import datetime, timedelta
    d_start = datetime.strptime(delivery_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    for i in range(48):
        expected = d_start + timedelta(minutes=30 * i)
        if expected not in covered_starts:
            missing.append(expected.isoformat())

    return DecisionForecastResponse(
        delivery_date=delivery_date,
        cutoff_time_utc=cutoff,
        cutoff_time_local=cutoff_local_str,
        forecast_points=forecast_points,
        actuals=actual_points,
        missing_periods=missing,
    )
