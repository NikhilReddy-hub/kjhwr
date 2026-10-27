"""Core analytics: forecast selection, error metrics, breakdowns.

All timezone-aware. January 2026 is GMT (UTC+0) so no DST complexity.
Forecast selection uses UTC timestamps throughout.
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np
import pandas as pd
import pytz

from app.config import settings

logger = logging.getLogger(__name__)

UK_TZ = pytz.timezone(settings.timezone)


# ---------------------------------------------------------------------------
# Timezone helpers
# ---------------------------------------------------------------------------


def parse_utc(ts: str) -> datetime:
    """Parse ISO UTC timestamp string to tz-aware datetime."""
    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def cutoff_utc(delivery_date: str, hour: int = 9, minute: int = 0) -> datetime:
    """
    Return the decision cutoff datetime in UTC for day D-1.

    The cutoff is `hour:minute` UK local time on day D-1.
    In January (GMT = UTC+0) this equals the same hour UTC.
    """
    d = datetime.strptime(delivery_date, "%Y-%m-%d").date()
    d_minus_1 = d - timedelta(days=1)
    # Localise to UK
    local_dt = UK_TZ.localize(
        datetime(d_minus_1.year, d_minus_1.month, d_minus_1.day, hour, minute)
    )
    return local_dt.astimezone(timezone.utc)


# ---------------------------------------------------------------------------
# Latest-forecast selection (no look-ahead leakage)
# ---------------------------------------------------------------------------


def select_latest_forecasts(
    forecasts: list[dict],
    cutoff: datetime,
) -> dict[str, dict]:
    """
    For each target startTime, select the forecast row with the MAXIMUM
    publishTime that is strictly ≤ cutoff.

    Args:
        forecasts: list of dicts with keys start_time, publish_time, generation_mw
        cutoff: decision cutoff in UTC (tz-aware)

    Returns:
        dict mapping start_time (str, UTC ISO) → chosen forecast row
    """
    best: dict[str, dict] = {}
    cutoff_str = cutoff.isoformat()

    for row in forecasts:
        pub = row["publish_time"]
        if pub > cutoff_str:
            continue  # filter out future forecasts
        start = row["start_time"]
        if start not in best or pub > best[start]["publish_time"]:
            best[start] = row

    return best


# ---------------------------------------------------------------------------
# Resolution bridging (WINDFOR hourly → 30-min FUELHH)
# ---------------------------------------------------------------------------


def expand_hourly_forecast_to_halfhour(
    forecast_by_start: dict[str, dict],
) -> dict[str, dict]:
    """
    WINDFOR is hourly. FUELHH actuals are 30-min.
    For each 30-min start_time, look for an hourly forecast whose hour matches.
    We map HH:00 forecast → HH:00 and HH:30 periods.
    """
    expanded: dict[str, dict] = {}
    for start_str, row in forecast_by_start.items():
        # The hourly start_time is on the hour (HH:00)
        dt = parse_utc(start_str)
        # Map to the :00 half-hour
        hh00 = dt.replace(minute=0, second=0, microsecond=0)
        hh30 = hh00 + timedelta(minutes=30)
        for target in (hh00, hh30):
            key = target.strftime("%Y-%m-%dT%H:%M:%S+00:00")
            # Don't overwrite if a better-matched row already exists
            if key not in expanded:
                expanded[key] = row
    return expanded


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------


def compute_metrics(errors: np.ndarray, actuals: np.ndarray) -> dict:
    """
    Compute accuracy metrics from arrays of errors (forecast - actual).

    Args:
        errors: 1-D array of (forecast - actual) in MW
        actuals: 1-D array of actual values in MW

    Returns:
        dict of metric names → values
    """
    abs_errors = np.abs(errors)
    n = len(errors)
    mae = float(np.mean(abs_errors))
    rmse = float(np.sqrt(np.mean(errors**2)))
    bias = float(np.mean(errors))
    mean_actual = float(np.mean(actuals))
    mean_forecast = float(np.mean(actuals + errors))

    # MAPE: skip if any actual ≤ 0 (would give division by zero / huge values)
    mape: Optional[float] = None
    if np.all(actuals > 0):
        mape = float(np.mean(np.abs(errors / actuals)) * 100)

    nmae = (mae / mean_actual * 100) if mean_actual > 0 else float("nan")

    percentiles = np.percentile(abs_errors, [50, 90, 95, 99])

    return {
        "n_periods": n,
        "mae_mw": round(mae, 1),
        "rmse_mw": round(rmse, 1),
        "bias_mw": round(bias, 1),
        "mape_pct": round(mape, 2) if mape is not None else None,
        "nmae_pct": round(nmae, 2),
        "p50_abs_error_mw": round(float(percentiles[0]), 1),
        "p90_abs_error_mw": round(float(percentiles[1]), 1),
        "p95_abs_error_mw": round(float(percentiles[2]), 1),
        "p99_abs_error_mw": round(float(percentiles[3]), 1),
        "mean_actual_mw": round(mean_actual, 1),
        "mean_forecast_mw": round(mean_forecast, 1),
    }


# ---------------------------------------------------------------------------
# Build joined dataset
# ---------------------------------------------------------------------------


def build_joined_df(
    actuals: list[dict],
    forecasts: list[dict],
    cutoff_dt: datetime,
) -> pd.DataFrame:
    """
    Join actuals and the latest-at-cutoff forecasts into a DataFrame.

    Columns: start_time (UTC datetime), actual_mw, forecast_mw,
             publish_time, horizon_hours, error_mw, abs_error_mw
    """
    # Build actuals DF
    act_df = pd.DataFrame(actuals)
    if act_df.empty:
        return pd.DataFrame()
    act_df["start_time"] = pd.to_datetime(act_df["start_time"], utc=True)
    act_df = act_df.rename(columns={"generation_mw": "actual_mw"})

    # Select latest forecast for each target period
    best_forecasts = select_latest_forecasts(forecasts, cutoff_dt)
    expanded = expand_hourly_forecast_to_halfhour(best_forecasts)

    if not expanded:
        logger.warning("No forecasts found for cutoff %s", cutoff_dt.isoformat())
        return pd.DataFrame()

    rows = []
    for start_str, row in expanded.items():
        rows.append(
            {
                "start_time_str": start_str,
                "forecast_mw": float(row["generation_mw"]),
                "publish_time": parse_utc(row["publish_time"]),
            }
        )
    fc_df = pd.DataFrame(rows)
    fc_df["start_time"] = pd.to_datetime(fc_df["start_time_str"], utc=True)

    # Inner join on start_time
    merged = act_df.merge(fc_df, on="start_time", how="inner")
    if merged.empty:
        return pd.DataFrame()

    merged["horizon_hours"] = (
        merged["start_time"] - merged["publish_time"]
    ).dt.total_seconds() / 3600.0
    merged["error_mw"] = merged["forecast_mw"] - merged["actual_mw"]
    merged["abs_error_mw"] = merged["error_mw"].abs()
    merged["date"] = merged["start_time"].dt.date.astype(str)
    merged["hour_utc"] = merged["start_time"].dt.hour

    return merged.sort_values("start_time").reset_index(drop=True)


# ---------------------------------------------------------------------------
# Accuracy breakdowns
# ---------------------------------------------------------------------------


HORIZON_BUCKETS = [
    (0, 4, "0–4h"),
    (4, 8, "4–8h"),
    (8, 12, "8–12h"),
    (12, 18, "12–18h"),
    (18, 24, "18–24h"),
    (24, 36, "24–36h"),
    (36, 48, "36–48h"),
    (48, 9999, "48h+"),
]


def accuracy_by_horizon(df: pd.DataFrame) -> list[dict]:
    """Break down MAE/RMSE/bias by horizon bucket."""
    results = []
    for lo, hi, label in HORIZON_BUCKETS:
        mask = (df["horizon_hours"] >= lo) & (df["horizon_hours"] < hi)
        sub = df[mask]
        if sub.empty:
            continue
        m = compute_metrics(sub["error_mw"].values, sub["actual_mw"].values)
        results.append(
            {
                "horizon_bucket": label,
                "horizon_min_h": lo,
                "horizon_max_h": hi if hi < 9999 else 9999,
                "n": m["n_periods"],
                "mae_mw": m["mae_mw"],
                "rmse_mw": m["rmse_mw"],
                "bias_mw": m["bias_mw"],
            }
        )
    return results


def accuracy_by_hour(df: pd.DataFrame) -> list[dict]:
    """Break down by UTC hour of day."""
    results = []
    for hour in sorted(df["hour_utc"].unique()):
        sub = df[df["hour_utc"] == hour]
        m = compute_metrics(sub["error_mw"].values, sub["actual_mw"].values)
        results.append(
            {
                "hour_utc": int(hour),
                "n": m["n_periods"],
                "mae_mw": m["mae_mw"],
                "bias_mw": m["bias_mw"],
                "p90_abs_error_mw": m["p90_abs_error_mw"],
            }
        )
    return results


def accuracy_by_day(df: pd.DataFrame) -> list[dict]:
    """Break down by delivery date."""
    results = []
    for date in sorted(df["date"].unique()):
        sub = df[df["date"] == date]
        m = compute_metrics(sub["error_mw"].values, sub["actual_mw"].values)
        results.append(
            {
                "date": date,
                "n_periods": m["n_periods"],
                "mae_mw": m["mae_mw"],
                "bias_mw": m["bias_mw"],
                "p90_abs_error_mw": m["p90_abs_error_mw"],
                "mean_actual_mw": m["mean_actual_mw"],
            }
        )
    return results


def error_histogram(df: pd.DataFrame, n_bins: int = 40) -> dict:
    """Compute histogram of errors for distribution chart."""
    errors = df["error_mw"].values
    abs_errors = df["abs_error_mw"].values
    counts, edges = np.histogram(errors, bins=n_bins)
    p50, p90, p95 = np.percentile(abs_errors, [50, 90, 95])
    return {
        "bin_edges_mw": [round(float(e), 1) for e in edges],
        "counts": counts.tolist(),
        "p50": round(float(p50), 1),
        "p90": round(float(p90), 1),
        "p95": round(float(p95), 1),
    }
