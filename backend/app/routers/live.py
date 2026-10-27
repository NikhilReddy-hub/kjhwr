"""Live real-time router — connects directly to live Elexon BMRS stream endpoints."""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException

from app.client import fetch_live_wind_actuals, fetch_live_wind_forecasts
from app.models import ActualPoint, ForecastPoint
from app.analytics import parse_utc

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/status")
def get_live_status():
    """Returns the latest available real-time point and stream status."""
    try:
        actuals = fetch_live_wind_actuals()
        forecasts = fetch_live_wind_forecasts()
        latest_act = actuals[-1] if actuals else None
        latest_fc = forecasts[0] if forecasts else None
        return {
            "source": "Elexon BMRS Live Data API",
            "is_realtime": True,
            "latest_actual_mw": latest_act["generation_mw"] if latest_act else None,
            "latest_actual_time": latest_act["start_time"] if latest_act else None,
            "latest_settlement_period": latest_act["settlement_period"] if latest_act else None,
            "active_forecast_points": len(forecasts),
            "latest_forecast_mw": latest_fc["generation_mw"] if latest_fc else None,
            "latest_forecast_start_time": latest_fc["start_time"] if latest_fc else None,
        }
    except Exception as e:
        logger.error("Failed to fetch live status: %s", e)
        raise HTTPException(status_code=502, detail=f"Elexon BMRS live stream unavailable: {str(e)}")


@router.get("/actuals")
def get_live_actuals():
    """Fetch today's real-time settlement periods directly from live FUELHH stream."""
    try:
        raw_actuals = fetch_live_wind_actuals()
        return [
            {
                "start_time": r["start_time"],
                "settlement_date": r["settlement_date"],
                "settlement_period": r["settlement_period"],
                "actual_mw": r["generation_mw"],
            }
            for r in raw_actuals
        ]
    except Exception as e:
        logger.error("Failed to fetch live actuals: %s", e)
        raise HTTPException(status_code=502, detail=f"Elexon BMRS live stream error: {str(e)}")


@router.get("/forecasts")
def get_live_forecasts():
    """Fetch real-time forward wind forecast points directly from live WINDFOR stream."""
    try:
        raw_forecasts = fetch_live_wind_forecasts()
        return [
            {
                "start_time": r["start_time"],
                "publish_time": r["publish_time"],
                "forecast_mw": r["generation_mw"],
            }
            for r in raw_forecasts
        ]
    except Exception as e:
        logger.error("Failed to fetch live forecasts: %s", e)
        raise HTTPException(status_code=502, detail=f"Elexon BMRS live stream error: {str(e)}")
