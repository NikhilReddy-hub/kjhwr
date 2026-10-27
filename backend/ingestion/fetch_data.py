"""
Data ingestion script — fetches FUELHH actuals and WINDFOR forecasts
from Elexon BMRS API and stores them in the local SQLite database.

Usage:
    python -m ingestion.fetch_data
    
Or with a custom date range:
    python -m ingestion.fetch_data --start 2025-12-30 --end 2026-01-31
"""
import argparse
import logging
import sys
from pathlib import Path

# Allow running from backend/ directory
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import settings
from app.db import init_db, upsert_actuals, upsert_forecasts, count_actuals, count_forecasts
from app.client import fetch_fuelhh_range, fetch_windfor_range

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def run_ingestion(start_date: str, end_date: str, windfor_start: str):
    """Full ingestion pipeline."""
    logger.info("=" * 60)
    logger.info("Wind Procurement Portal — Data Ingestion")
    logger.info("=" * 60)

    # Init DB
    init_db()

    # 1. Fetch FUELHH actuals (Jan 2026)
    logger.info("Fetching FUELHH actuals: %s → %s", start_date, end_date)
    actuals = fetch_fuelhh_range(start_date, end_date)
    if actuals:
        upsert_actuals(actuals)
        logger.info("✓ Stored %d actual rows", len(actuals))
    else:
        logger.warning("No actual rows fetched!")

    # 2. Fetch WINDFOR forecasts (need day D-1 publish dates)
    # For Jan 1 delivery, we need forecasts published on Dec 31
    logger.info(
        "Fetching WINDFOR forecasts: published %s → %s", windfor_start, end_date
    )
    forecasts = fetch_windfor_range(windfor_start, end_date)
    if forecasts:
        upsert_forecasts(forecasts)
        logger.info("✓ Stored %d forecast rows", len(forecasts))
    else:
        logger.warning("No forecast rows fetched!")

    # Summary
    logger.info("-" * 60)
    logger.info("Final DB counts:")
    logger.info("  Actuals: %d rows", count_actuals())
    logger.info("  Forecasts: %d rows", count_forecasts())
    logger.info("Ingestion complete!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch Elexon data into SQLite")
    parser.add_argument("--start", default="2026-01-01", help="Actuals start date")
    parser.add_argument("--end", default="2026-01-31", help="End date")
    parser.add_argument(
        "--windfor-start",
        default="2025-12-30",
        help="Start date for WINDFOR (needs prior day for D-1 forecasts)",
    )
    args = parser.parse_args()
    run_ingestion(args.start, args.end, args.windfor_start)
