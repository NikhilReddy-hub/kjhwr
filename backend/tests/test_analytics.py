"""Tests for core analytics logic."""
import pytest
from datetime import datetime, timezone, timedelta

from app.analytics import (
    cutoff_utc,
    select_latest_forecasts,
    expand_hourly_forecast_to_halfhour,
    compute_metrics,
    parse_utc,
)
import numpy as np


# ---------------------------------------------------------------------------
# Tests: cutoff_utc timezone handling
# ---------------------------------------------------------------------------

def test_cutoff_utc_january():
    """In January, UK is GMT (UTC+0), so 09:00 local = 09:00 UTC."""
    co = cutoff_utc("2026-01-15", hour=9, minute=0)
    assert co.tzinfo is not None
    assert co.hour == 9
    assert co.minute == 0
    # Should be on 2026-01-14 (D-1)
    assert co.date().isoformat() == "2026-01-14"


def test_cutoff_utc_configurable():
    """Different cutoff hours should work."""
    co = cutoff_utc("2026-01-01", hour=8, minute=30)
    assert co.hour == 8
    assert co.minute == 30
    assert co.date().isoformat() == "2025-12-31"


# ---------------------------------------------------------------------------
# Tests: select_latest_forecasts (no leakage)
# ---------------------------------------------------------------------------

def _make_fc(start: str, publish: str, gen: float = 5000.0) -> dict:
    return {"start_time": start, "publish_time": publish, "generation_mw": gen}


def test_select_latest_no_leakage():
    """Forecasts published after cutoff must NOT be selected."""
    cutoff = datetime(2026, 1, 14, 9, 0, tzinfo=timezone.utc)
    forecasts = [
        _make_fc("2026-01-15T00:00:00+00:00", "2026-01-14T07:30:00+00:00", 5000),
        _make_fc("2026-01-15T00:00:00+00:00", "2026-01-14T09:30:00+00:00", 5500),  # after cutoff!
    ]
    best = select_latest_forecasts(forecasts, cutoff)
    assert "2026-01-15T00:00:00+00:00" in best
    # Must pick 07:30 (before cutoff), not 09:30 (after)
    assert best["2026-01-15T00:00:00+00:00"]["publish_time"] == "2026-01-14T07:30:00+00:00"
    assert best["2026-01-15T00:00:00+00:00"]["generation_mw"] == 5000


def test_select_latest_picks_maximum_before_cutoff():
    """When multiple publishTimes before cutoff, selects the latest one."""
    cutoff = datetime(2026, 1, 14, 9, 0, tzinfo=timezone.utc)
    forecasts = [
        _make_fc("2026-01-15T06:00:00+00:00", "2026-01-13T22:30:00+00:00", 4000),
        _make_fc("2026-01-15T06:00:00+00:00", "2026-01-14T07:30:00+00:00", 4500),
        _make_fc("2026-01-15T06:00:00+00:00", "2026-01-14T09:30:00+00:00", 5000),  # leakage
    ]
    best = select_latest_forecasts(forecasts, cutoff)
    assert best["2026-01-15T06:00:00+00:00"]["generation_mw"] == 4500


def test_select_latest_empty_when_all_after_cutoff():
    """If all forecasts are after cutoff, result should be empty."""
    cutoff = datetime(2026, 1, 14, 9, 0, tzinfo=timezone.utc)
    forecasts = [
        _make_fc("2026-01-15T00:00:00+00:00", "2026-01-14T09:30:00+00:00", 5000),
        _make_fc("2026-01-15T00:00:00+00:00", "2026-01-14T12:00:00+00:00", 5100),
    ]
    best = select_latest_forecasts(forecasts, cutoff)
    assert best == {}


def test_select_latest_at_exact_cutoff():
    """Forecast published exactly at cutoff should be included (≤)."""
    cutoff = datetime(2026, 1, 14, 9, 0, tzinfo=timezone.utc)
    forecasts = [
        _make_fc("2026-01-15T00:00:00+00:00", "2026-01-14T09:00:00+00:00", 5000),
    ]
    best = select_latest_forecasts(forecasts, cutoff)
    assert "2026-01-15T00:00:00+00:00" in best


# ---------------------------------------------------------------------------
# Tests: expand_hourly_forecast_to_halfhour
# ---------------------------------------------------------------------------

def test_expand_maps_to_both_halfhours():
    """Hourly forecast at HH:00 should map to HH:00 and HH:30."""
    fc = {
        "start_time": "2026-01-15T12:00:00+00:00",
        "publish_time": "2026-01-14T09:00:00+00:00",
        "generation_mw": 10000,
    }
    expanded = expand_hourly_forecast_to_halfhour({"2026-01-15T12:00:00+00:00": fc})
    assert "2026-01-15T12:00:00+00:00" in expanded
    assert "2026-01-15T12:30:00+00:00" in expanded
    assert expanded["2026-01-15T12:30:00+00:00"]["generation_mw"] == 10000


# ---------------------------------------------------------------------------
# Tests: compute_metrics
# ---------------------------------------------------------------------------

def test_metrics_zero_error():
    """Perfect forecast: MAE, RMSE, bias all 0."""
    actuals = np.array([10000.0, 12000.0, 8000.0])
    errors = np.zeros(3)
    m = compute_metrics(errors, actuals)
    assert m["mae_mw"] == 0.0
    assert m["rmse_mw"] == 0.0
    assert m["bias_mw"] == 0.0


def test_metrics_bias_direction():
    """Positive bias = overforecast (forecast > actual)."""
    actuals = np.array([10000.0, 10000.0])
    errors = np.array([1000.0, 1000.0])  # forecast was 1000 too high
    m = compute_metrics(errors, actuals)
    assert m["bias_mw"] == 1000.0  # overforecast
    assert m["mae_mw"] == 1000.0


def test_metrics_percentiles():
    """Check that P90 > P50."""
    np.random.seed(42)
    errors = np.random.randn(1000) * 500  # random errors
    actuals = np.abs(np.random.randn(1000) * 10000 + 10000)
    m = compute_metrics(errors, actuals)
    assert m["p90_abs_error_mw"] > m["p50_abs_error_mw"]
    assert m["p99_abs_error_mw"] >= m["p95_abs_error_mw"]


def test_metrics_mape_none_for_zero_actual():
    """MAPE should be None if any actual is 0."""
    actuals = np.array([10000.0, 0.0, 8000.0])
    errors = np.array([500.0, 100.0, -200.0])
    m = compute_metrics(errors, actuals)
    assert m["mape_pct"] is None


# ---------------------------------------------------------------------------
# Tests: parse_utc
# ---------------------------------------------------------------------------

def test_parse_utc_z_suffix():
    dt = parse_utc("2026-01-14T09:00:00Z")
    assert dt.tzinfo is not None
    assert dt.hour == 9


def test_parse_utc_plus_suffix():
    dt = parse_utc("2026-01-14T09:00:00+00:00")
    assert dt.tzinfo is not None
