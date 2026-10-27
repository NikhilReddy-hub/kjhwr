"""Elexon BMRS API client with retry logic and chunked fetching."""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from app.config import settings

logger = logging.getLogger(__name__)

BASE_URL = settings.elexon_base_url


def _make_client() -> httpx.Client:
    return httpx.Client(timeout=settings.elexon_timeout)


@retry(
    stop=stop_after_attempt(settings.elexon_retries),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
    reraise=True,
)
def _get(client: httpx.Client, url: str, params: dict) -> list[dict]:
    """Make a GET request and return parsed JSON list."""
    resp = client.get(url, params=params)
    resp.raise_for_status()
    data = resp.json()
    if isinstance(data, list):
        return data
    # Some endpoints wrap in a dict
    if isinstance(data, dict) and "data" in data:
        return data["data"]
    return []


# ---------------------------------------------------------------------------
# FUELHH – Actual generation
# ---------------------------------------------------------------------------


def fetch_fuelhh_day(client: httpx.Client, settlement_date: str) -> list[dict]:
    """Fetch FUELHH wind actuals for one settlement date.
    
    NOTE: The /stream endpoint ignores settlementDate and returns today's data.
    We use the non-stream endpoint with settlementDateFrom/settlementDateTo.
    """
    rows = _get(
        client,
        f"{BASE_URL}/datasets/FUELHH",
        {
            "settlementDateFrom": settlement_date,
            "settlementDateTo": settlement_date,
            "fuelType": "WIND",
            "format": "json",
        },
    )
    result = []
    for r in rows:
        if r.get("fuelType") != "WIND":
            continue
        result.append(
            {
                "start_time": r["startTime"],
                "settlement_date": r.get("settlementDate", settlement_date),
                "settlement_period": r.get("settlementPeriod", 0),
                "generation_mw": float(r["generation"]),
            }
        )
    logger.debug("FUELHH %s: %d rows", settlement_date, len(result))
    return result


def fetch_fuelhh_range(start_date: str, end_date: str) -> list[dict]:
    """Fetch FUELHH for a date range, one day at a time."""
    all_rows: list[dict] = []
    d = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    with _make_client() as client:
        while d <= end:
            try:
                rows = fetch_fuelhh_day(client, d.isoformat())
                all_rows.extend(rows)
            except Exception as exc:
                logger.warning("FUELHH fetch failed for %s: %s", d, exc)
            d += timedelta(days=1)
    logger.info("FUELHH total: %d rows for %s..%s", len(all_rows), start_date, end_date)
    return all_rows


# ---------------------------------------------------------------------------
# WINDFOR – Forecasts
# ---------------------------------------------------------------------------


def fetch_windfor_chunk(
    client: httpx.Client,
    publish_from: str,
    publish_to: str,
) -> list[dict]:
    """Fetch WINDFOR forecasts published within a time window."""
    rows = _get(
        client,
        f"{BASE_URL}/datasets/WINDFOR/stream",
        {
            "publishDateTimeFrom": publish_from,
            "publishDateTimeTo": publish_to,
            "format": "json",
        },
    )
    result = []
    for r in rows:
        result.append(
            {
                "start_time": r["startTime"],
                "publish_time": r["publishTime"],
                "generation_mw": float(r["generation"]),
            }
        )
    logger.debug(
        "WINDFOR %s→%s: %d rows", publish_from, publish_to, len(result)
    )
    return result


def fetch_windfor_range(start_date: str, end_date: str) -> list[dict]:
    """
    Fetch WINDFOR for a date range.
    Chunks by day to stay within API limits.
    We fetch by publishDateTime range, one day at a time.
    """
    all_rows: list[dict] = []
    d = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    with _make_client() as client:
        while d <= end:
            pub_from = f"{d.isoformat()}T00:00:00Z"
            pub_to = f"{d.isoformat()}T23:59:59Z"
            try:
                rows = fetch_windfor_chunk(client, pub_from, pub_to)
                all_rows.extend(rows)
            except Exception as exc:
                logger.warning(
                    "WINDFOR fetch failed for %s: %s", d.isoformat(), exc
                )
            d += timedelta(days=1)
    logger.info(
        "WINDFOR total: %d rows for %s..%s", len(all_rows), start_date, end_date
    )
    return all_rows


# ---------------------------------------------------------------------------
# Real-Time Live Stream (Current UK Grid data from Elexon BMRS)
# ---------------------------------------------------------------------------


def fetch_live_wind_actuals() -> list[dict]:
    """Fetch latest real-time wind actuals from live FUELHH stream."""
    with _make_client() as client:
        rows = _get(client, f"{BASE_URL}/datasets/FUELHH/stream", {"format": "json"})
    result = []
    for r in rows:
        if r.get("fuelType") == "WIND":
            result.append(
                {
                    "start_time": r["startTime"],
                    "settlement_date": r.get("settlementDate", ""),
                    "settlement_period": r.get("settlementPeriod", 0),
                    "generation_mw": float(r["generation"]),
                }
            )
    return sorted(result, key=lambda x: x["start_time"])


def fetch_live_wind_forecasts() -> list[dict]:
    """Fetch latest real-time wind forecasts from live WINDFOR stream."""
    with _make_client() as client:
        rows = _get(client, f"{BASE_URL}/datasets/WINDFOR/stream", {"format": "json"})
    result = []
    for r in rows:
        result.append(
            {
                "start_time": r["startTime"],
                "publish_time": r["publishTime"],
                "generation_mw": float(r["generation"]),
            }
        )
    return sorted(result, key=lambda x: x["start_time"])

