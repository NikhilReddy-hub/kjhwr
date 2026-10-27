"""Accuracy router — forecast error metrics and breakdowns."""
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.analytics import (
    accuracy_by_day,
    accuracy_by_horizon,
    accuracy_by_hour,
    build_joined_df,
    compute_metrics,
    cutoff_utc,
    error_histogram,
)
from app.config import settings
from app.db import get_actuals, get_all_forecasts
from app.models import (
    AccuracyByDayResponse,
    AccuracyByHorizonResponse,
    AccuracyByHourResponse,
    AccuracySummary,
    AccuracyTimeseriesResponse,
    ErrorDistributionResponse,
    TimeseriesPoint,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _get_joined_df(
    cutoff_hour: int,
    cutoff_minute: int,
    start_date: str = "2026-01-01",
    end_date: str = "2026-01-31",
):
    """Build joined actuals+forecasts DataFrame for the full Jan 2026 period."""
    import pandas as pd

    # We need to compute "per-day" decision forecasts and join them
    # For the accuracy dataset, we pick one cutoff per day (D-1 @ cutoff)
    # and gather all the forecast points for that delivery day
    from datetime import date, timedelta
    from app.analytics import (
        select_latest_forecasts,
        expand_hourly_forecast_to_halfhour,
        parse_utc,
    )
    import numpy as np

    # Pull all raw data once
    actuals = get_actuals(start_date, end_date)
    # Forecasts: published from start_date-1 (for day 1 delivery) through end_date
    from datetime import datetime
    fc_cutoff = datetime(2026, 2, 1, 0, 0, tzinfo=__import__("datetime").timezone.utc)
    all_forecasts = get_all_forecasts(fc_cutoff.isoformat())

    if not actuals:
        return pd.DataFrame()

    # Build day-by-day: for each delivery day, pick latest forecast ≤ cutoff
    d = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    joined_rows = []

    while d <= end:
        delivery_date_str = d.isoformat()
        co = cutoff_utc(delivery_date_str, cutoff_hour, cutoff_minute)
        co_str = co.isoformat()

        # Filter forecasts for this delivery day + published before cutoff
        day_start = f"{delivery_date_str}T00:00:00+00:00"
        day_end = f"{delivery_date_str}T23:30:00+00:00"

        day_fcs = [
            r for r in all_forecasts
            if day_start <= r["start_time"] <= day_end
            and r["publish_time"] <= co_str
        ]

        if not day_fcs:
            logger.debug("No forecasts for %s at cutoff %s", delivery_date_str, co_str)
            d += timedelta(days=1)
            continue

        best = select_latest_forecasts(day_fcs, co)
        expanded = expand_hourly_forecast_to_halfhour(best)

        # Actuals for this day
        day_actuals = [a for a in actuals if a["settlement_date"] == delivery_date_str]

        for act in day_actuals:
            start_str = act["start_time"]
            # Normalise key
            dt_start = parse_utc(start_str)
            key = dt_start.strftime("%Y-%m-%dT%H:%M:%S+00:00")

            if key not in expanded:
                continue
            fc_row = expanded[key]
            dt_pub = parse_utc(fc_row["publish_time"])
            horizon = (dt_start - dt_pub).total_seconds() / 3600.0

            joined_rows.append(
                {
                    "start_time": dt_start,
                    "actual_mw": float(act["generation_mw"]),
                    "forecast_mw": float(fc_row["generation_mw"]),
                    "publish_time": dt_pub,
                    "horizon_hours": horizon,
                    "date": delivery_date_str,
                    "hour_utc": dt_start.hour,
                }
            )

        d += timedelta(days=1)

    if not joined_rows:
        return pd.DataFrame()

    df = pd.DataFrame(joined_rows)
    df["error_mw"] = df["forecast_mw"] - df["actual_mw"]
    df["abs_error_mw"] = df["error_mw"].abs()
    return df.sort_values("start_time").reset_index(drop=True)


@router.get("/summary", response_model=AccuracySummary)
async def get_accuracy_summary(
    cutoff_hour: int = Query(
        default=settings.default_cutoff_hour_local,
        description="Decision cutoff hour (UK local, 24h)",
        ge=0, le=23,
    ),
    cutoff_minute: int = Query(
        default=settings.default_cutoff_minute_local,
        ge=0, le=59,
    ),
    start_date: str = Query("2026-01-01"),
    end_date: str = Query("2026-01-31"),
):
    """Overall accuracy metrics for January 2026."""
    df = _get_joined_df(cutoff_hour, cutoff_minute, start_date, end_date)
    if df.empty:
        raise HTTPException(status_code=404, detail="No data available. Run ingestion first.")
    import numpy as np
    metrics = compute_metrics(df["error_mw"].values, df["actual_mw"].values)
    return AccuracySummary(**metrics)


@router.get("/by-hour", response_model=AccuracyByHourResponse)
async def get_accuracy_by_hour(
    cutoff_hour: int = Query(default=settings.default_cutoff_hour_local, ge=0, le=23),
    cutoff_minute: int = Query(default=settings.default_cutoff_minute_local, ge=0, le=59),
):
    """Accuracy breakdown by UTC hour of day."""
    df = _get_joined_df(cutoff_hour, cutoff_minute)
    if df.empty:
        raise HTTPException(status_code=404, detail="No data available.")
    return AccuracyByHourResponse(breakdown=accuracy_by_hour(df))


@router.get("/by-horizon", response_model=AccuracyByHorizonResponse)
async def get_accuracy_by_horizon(
    cutoff_hour: int = Query(default=settings.default_cutoff_hour_local, ge=0, le=23),
    cutoff_minute: int = Query(default=settings.default_cutoff_minute_local, ge=0, le=59),
):
    """Accuracy breakdown by forecast horizon bucket."""
    df = _get_joined_df(cutoff_hour, cutoff_minute)
    if df.empty:
        raise HTTPException(status_code=404, detail="No data available.")
    return AccuracyByHorizonResponse(breakdown=accuracy_by_horizon(df))


@router.get("/timeseries", response_model=AccuracyTimeseriesResponse)
async def get_accuracy_timeseries(
    cutoff_hour: int = Query(default=settings.default_cutoff_hour_local, ge=0, le=23),
    cutoff_minute: int = Query(default=settings.default_cutoff_minute_local, ge=0, le=59),
    start_date: str = Query("2026-01-01"),
    end_date: str = Query("2026-01-31"),
):
    """Time-series of forecast vs actual over January."""
    df = _get_joined_df(cutoff_hour, cutoff_minute, start_date, end_date)
    if df.empty:
        raise HTTPException(status_code=404, detail="No data available.")
    points = [
        TimeseriesPoint(
            start_time=row["start_time"],
            forecast_mw=round(row["forecast_mw"], 1),
            actual_mw=round(row["actual_mw"], 1),
            error_mw=round(row["error_mw"], 1),
            horizon_hours=round(row["horizon_hours"], 1),
        )
        for _, row in df.iterrows()
    ]
    return AccuracyTimeseriesResponse(points=points)


@router.get("/by-day", response_model=AccuracyByDayResponse)
async def get_accuracy_by_day(
    cutoff_hour: int = Query(default=settings.default_cutoff_hour_local, ge=0, le=23),
    cutoff_minute: int = Query(default=settings.default_cutoff_minute_local, ge=0, le=59),
):
    """Accuracy breakdown by delivery day."""
    df = _get_joined_df(cutoff_hour, cutoff_minute)
    if df.empty:
        raise HTTPException(status_code=404, detail="No data available.")
    return AccuracyByDayResponse(breakdown=accuracy_by_day(df))


@router.get("/error-distribution", response_model=ErrorDistributionResponse)
async def get_error_distribution(
    cutoff_hour: int = Query(default=settings.default_cutoff_hour_local, ge=0, le=23),
    cutoff_minute: int = Query(default=settings.default_cutoff_minute_local, ge=0, le=59),
):
    """Histogram of forecast errors."""
    df = _get_joined_df(cutoff_hour, cutoff_minute)
    if df.empty:
        raise HTTPException(status_code=404, detail="No data available.")
    hist = error_histogram(df)
    return ErrorDistributionResponse(**hist)
