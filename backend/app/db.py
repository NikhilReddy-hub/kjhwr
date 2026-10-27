"""SQLite database layer — creates tables and provides query helpers."""
import sqlite3
import logging
from pathlib import Path
from contextlib import contextmanager
from app.config import settings

logger = logging.getLogger(__name__)


def get_db_path() -> Path:
    path = Path(settings.db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


@contextmanager
def get_connection():
    """Context manager for SQLite connections."""
    conn = sqlite3.connect(str(get_db_path()))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """Create tables if they don't exist."""
    with get_connection() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS actuals (
                start_time TEXT NOT NULL,
                settlement_date TEXT NOT NULL,
                settlement_period INTEGER NOT NULL,
                generation_mw REAL NOT NULL,
                PRIMARY KEY (start_time)
            );

            CREATE TABLE IF NOT EXISTS forecasts (
                start_time TEXT NOT NULL,
                publish_time TEXT NOT NULL,
                generation_mw REAL NOT NULL,
                PRIMARY KEY (start_time, publish_time)
            );

            CREATE INDEX IF NOT EXISTS idx_forecasts_publish ON forecasts(publish_time);
            CREATE INDEX IF NOT EXISTS idx_forecasts_start ON forecasts(start_time);
            CREATE INDEX IF NOT EXISTS idx_actuals_date ON actuals(settlement_date);
        """)
        conn.commit()
    logger.info("Database initialised at %s", get_db_path())


def upsert_actuals(rows: list[dict]):
    """Upsert actual generation rows."""
    if not rows:
        return
    with get_connection() as conn:
        conn.executemany(
            """INSERT OR REPLACE INTO actuals
               (start_time, settlement_date, settlement_period, generation_mw)
               VALUES (:start_time, :settlement_date, :settlement_period, :generation_mw)""",
            rows,
        )
        conn.commit()
    logger.info("Upserted %d actual rows", len(rows))


def upsert_forecasts(rows: list[dict]):
    """Upsert forecast rows."""
    if not rows:
        return
    with get_connection() as conn:
        conn.executemany(
            """INSERT OR REPLACE INTO forecasts
               (start_time, publish_time, generation_mw)
               VALUES (:start_time, :publish_time, :generation_mw)""",
            rows,
        )
        conn.commit()
    logger.info("Upserted %d forecast rows", len(rows))


def get_actuals(start_date: str, end_date: str) -> list[dict]:
    """Fetch actuals for a date range (settlement_date)."""
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT start_time, settlement_date, settlement_period, generation_mw
               FROM actuals
               WHERE settlement_date >= ? AND settlement_date <= ?
               ORDER BY start_time""",
            (start_date, end_date),
        ).fetchall()
    return [dict(r) for r in rows]


def get_forecasts_in_range(
    start_time_from: str,
    start_time_to: str,
    publish_time_to: str,
) -> list[dict]:
    """Fetch forecasts for target start_times, published before cutoff."""
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT start_time, publish_time, generation_mw
               FROM forecasts
               WHERE start_time >= ? AND start_time <= ?
                 AND publish_time <= ?
               ORDER BY start_time, publish_time""",
            (start_time_from, start_time_to, publish_time_to),
        ).fetchall()
    return [dict(r) for r in rows]


def get_all_forecasts(publish_time_to: str) -> list[dict]:
    """Fetch all forecast rows published at or before cutoff."""
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT start_time, publish_time, generation_mw
               FROM forecasts
               WHERE publish_time <= ?
               ORDER BY start_time, publish_time""",
            (publish_time_to,),
        ).fetchall()
    return [dict(r) for r in rows]


def count_actuals() -> int:
    with get_connection() as conn:
        return conn.execute("SELECT COUNT(*) FROM actuals").fetchone()[0]


def count_forecasts() -> int:
    with get_connection() as conn:
        return conn.execute("SELECT COUNT(*) FROM forecasts").fetchone()[0]
