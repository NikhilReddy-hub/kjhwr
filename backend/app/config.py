"""Application configuration with sane defaults."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """App settings loaded from env vars or .env file."""

    # API
    app_name: str = "Wind Procurement Portal"
    app_version: str = "1.0.0"
    debug: bool = False

    # Elexon BMRS
    elexon_base_url: str = "https://data.elexon.co.uk/bmrs/api/v1"
    elexon_timeout: float = 30.0
    elexon_retries: int = 3

    # Decision cutoff (default 09:00 Europe/London in January = 09:00 UTC)
    default_cutoff_hour_local: int = 9  # 24-hr local UK time
    default_cutoff_minute_local: int = 0
    timezone: str = "Europe/London"

    # Data scope
    data_start_date: str = "2025-12-30"  # need prior-day forecasts
    data_end_date: str = "2026-01-31"

    # Database
    db_path: str = "data/wind_data.db"

    # CORS
    cors_origins: list[str] = ["*"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
