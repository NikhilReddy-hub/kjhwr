"""FastAPI application entry point."""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config import settings
from app.db import init_db, count_actuals, count_forecasts
from app.routers import forecast, actuals, accuracy, live

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise DB on startup."""
    logger.info("Starting %s v%s", settings.app_name, settings.app_version)
    init_db()
    n_act = count_actuals()
    n_fc = count_forecasts()
    logger.info("DB ready: %d actuals, %d forecast rows", n_act, n_fc)
    yield
    logger.info("Shutting down")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="UK Wind Procurement Portal — Elexon BMRS data analytics API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(forecast.router, prefix="/api/forecast", tags=["Forecast"])
app.include_router(actuals.router, prefix="/api/actuals", tags=["Actuals"])
app.include_router(accuracy.router, prefix="/api/accuracy", tags=["Accuracy"])
app.include_router(live.router, prefix="/api/live", tags=["Live"])


@app.get("/api/health", tags=["Health"])
async def health():
    """Health check endpoint."""
    n_act = count_actuals()
    n_fc = count_forecasts()
    return {
        "status": "ok",
        "version": settings.app_version,
        "data_loaded": n_act > 0 and n_fc > 0,
        "actuals_count": n_act,
        "forecasts_count": n_fc,
    }


# Static files & SPA fallback (for unified single-container deployment)
static_dir = Path("static")
if not static_dir.exists():
    static_dir = Path("../frontend/dist")

if static_dir.exists():
    assets_dir = static_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path in ("docs", "redoc", "openapi.json"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = static_dir / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        index_file = static_dir / "index.html"
        if index_file.is_file():
            return FileResponse(index_file)
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Frontend build not found")

