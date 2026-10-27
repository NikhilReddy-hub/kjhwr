"""Pydantic response schemas for API endpoints."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    data_loaded: bool


class ForecastPoint(BaseModel):
    """Single half-hour forecast point for a delivery period."""
    start_time: datetime = Field(..., description="Start of the half-hour period (UTC)")
    publish_time: datetime = Field(..., description="When the forecast was published (UTC)")
    forecast_mw: float = Field(..., description="Forecast wind generation (MW)")
    horizon_hours: float = Field(..., description="Hours ahead = startTime - publishTime")


class ActualPoint(BaseModel):
    """Single half-hour actual generation point."""
    start_time: datetime = Field(..., description="Start of the half-hour period (UTC)")
    actual_mw: float = Field(..., description="Actual wind generation (MW)")


class DecisionForecastResponse(BaseModel):
    """Full forecast for one delivery day at a given cutoff."""
    delivery_date: str
    cutoff_time_utc: datetime
    cutoff_time_local: str
    forecast_points: list[ForecastPoint]
    actuals: list[ActualPoint]
    missing_periods: list[str] = Field(default_factory=list)


class ErrorPoint(BaseModel):
    """Forecast vs actual error for one half-hour period."""
    start_time: datetime
    forecast_mw: float
    actual_mw: float
    error_mw: float  # forecast - actual
    abs_error_mw: float
    horizon_hours: float


class AccuracySummary(BaseModel):
    """Aggregate accuracy metrics across all periods."""
    n_periods: int
    mae_mw: float = Field(..., description="Mean Absolute Error (MW)")
    rmse_mw: float = Field(..., description="Root Mean Square Error (MW)")
    bias_mw: float = Field(..., description="Mean Error / Bias (MW) - positive = overforecast")
    mape_pct: Optional[float] = Field(None, description="MAPE % (may be None if actuals near zero)")
    nmae_pct: float = Field(..., description="MAE as % of mean actual")
    p50_abs_error_mw: float
    p90_abs_error_mw: float
    p95_abs_error_mw: float
    p99_abs_error_mw: float
    mean_actual_mw: float
    mean_forecast_mw: float


class HourlyBreakdown(BaseModel):
    """Accuracy metrics broken down by hour-of-day (UTC)."""
    hour_utc: int
    n: int
    mae_mw: float
    bias_mw: float
    p90_abs_error_mw: float


class HorizonBreakdown(BaseModel):
    """Accuracy metrics by forecast horizon bucket."""
    horizon_bucket: str  # e.g. "0-4h", "4-8h"
    horizon_min_h: float
    horizon_max_h: float
    n: int
    mae_mw: float
    rmse_mw: float
    bias_mw: float


class DailyBreakdown(BaseModel):
    """Per-day accuracy summary."""
    date: str
    n_periods: int
    mae_mw: float
    bias_mw: float
    p90_abs_error_mw: float
    mean_actual_mw: float


class TimeseriesPoint(BaseModel):
    """Combined forecast + actual for time-series chart."""
    start_time: datetime
    forecast_mw: Optional[float]
    actual_mw: Optional[float]
    error_mw: Optional[float]
    horizon_hours: Optional[float]


class AccuracyByHourResponse(BaseModel):
    breakdown: list[HourlyBreakdown]


class AccuracyByHorizonResponse(BaseModel):
    breakdown: list[HorizonBreakdown]


class AccuracyTimeseriesResponse(BaseModel):
    points: list[TimeseriesPoint]


class AccuracyByDayResponse(BaseModel):
    breakdown: list[DailyBreakdown]


class ErrorDistributionResponse(BaseModel):
    """Histogram data for error distribution."""
    bin_edges_mw: list[float]
    counts: list[int]
    p50: float
    p90: float
    p95: float
