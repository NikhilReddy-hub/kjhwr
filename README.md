# ⚡ WindScope — UK Wind Procurement & Day-Ahead Trading Portal

[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-57%20Passed-brightgreen.svg)](#-automated-testing--verification)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ed.svg)](#-deployment)

**WindScope** is an institutional-grade energy analytics platform designed for commercial power procurement desks, balance responsible parties (BRPs), and electricity traders operating in the **Great Britain (GB) wholesale power market**.

It analyzes day-ahead wind generation forecasts from **Elexon BMRS (`WINDFOR`)** against metered outturn actuals (**`FUELHH`**) for **January 2026** to quantify forecast risk, optimize day-ahead auction bidding, and hedge imbalance exposure.

---

## 📋 Table of Contents

- [Overview & The Trading Problem](#-overview--the-trading-problem)
- [Key Features](#-key-features)
- [Verified Benchmark Metrics (Jan 2026)](#-verified-benchmark-metrics-january-2026)
- [User Guide: How to Use the Website](#-user-guide-how-to-use-the-website)
  - [1. Decision View](#1-decision-view)
  - [2. Accuracy Dashboard](#2-accuracy-dashboard)
  - [3. Methodology Page](#3-methodology-page)
- [Architecture & Technical Integrity](#-architecture--technical-integrity)
- [Project Structure](#-project-structure)
- [Local Installation & Setup](#-local-installation--setup)
- [Automated Testing & Verification](#-automated-testing--verification)
- [Cloud Deployment](#-cloud-deployment)
- [API Reference](#-api-reference)

---

## 🎯 Overview & The Trading Problem

In the UK electricity market, wholesale day-ahead trading closes around midday on day **D-1** (e.g., EPEX Spot UK and Nord Pool day-ahead auctions). Commercial procurement teams must submit their energy purchase orders based on expected renewable generation.

Because wind generation is highly volatile:
- **Over-forecasting wind** leaves the trader short, forcing them to purchase emergency replacement power at expensive system buy prices in the Balancing Mechanism.
- **Under-forecasting wind** leaves the trader long, spilling excess power onto the grid at discounted system sell cashout prices.

To make an optimal commercial decision, traders face a strict cutoff — typically **09:00 UK local time on day D-1**. **WindScope** answers:
> *"At exactly 09:00 UK local on D-1, what was the latest authoritative wind generation forecast available, what was its lead-time horizon, and what empirical uncertainty band (P90) must we hedge against?"*

---

## 🌟 Key Features

1. **Zero Look-Ahead Bias:** Strictly filters forecasts published on or before the user-selected gate closure time on D-1. Forecasts published after the cutoff are never leaked into the decision.
2. **Timezone Rigor:** Explicit UTC and `Europe/London` timezone enforcement across backend and frontend. UI dates and times never drift regardless of whether the user is in London, New York, or Kolkata.
3. **Resolution Bridging:** Automatically maps hourly `WINDFOR` forecasts into the 30-minute settlement periods (`00:00` to `23:30 UTC`) of `FUELHH` metered actuals.
4. **Empirical P90 Uncertainty Bands:** Dynamically overlays ±P90 historical error bounds on the forecast curve, providing instant confidence bounds for day-ahead position sizing.
5. **Interactive Exploration:** Hover tooltips displaying exact Forecast, Actual, Error, and Horizon lead time for all 48 settlement periods.
6. **Data Portability:** 1-click **Export to CSV** for direct ingestion into quantitative trading models.
7. **Pre-Bundled January 2026 Dataset:** Ready-to-use SQLite database containing **19,272 forecasts** and **1,488 actual settlement periods**.

---

## 📊 Verified Benchmark Metrics (January 2026)

All metrics below are calculated under the default **09:00 UK local decision cutoff** across all **1,488 half-hour settlement periods** of January 2026:

| Metric | Verified Value | Description |
| :--- | :--- | :--- |
| **Total Evaluated Periods** | **1,488** | 31 days × 48 settlement periods/day |
| **Mean Absolute Error (MAE)** | **2,145.2 MW** | Average absolute forecast deviation |
| **Root Mean Squared Error (RMSE)**| **2,615.8 MW** | Penalizes larger volatility spikes |
| **Mean Bias** | **+1,851.9 MW** | Systematic over-prediction of wind by WINDFOR |
| **Median (P50) Error** | **1,795.5 MW** | 50th percentile absolute error |
| **P90 Absolute Error** | **4,274.9 MW** | 90% of all half-hours fell within this margin |
| **P95 Absolute Error** | **5,340.9 MW** | 95th percentile error bound |
| **Normalized MAE (NMAE)** | **18.52%** | Relative to average January generation (11,580.7 MW) |
| **Forecast Horizon Range** | **16.5h – 40.0h** | 00:00 period = 16.5h; 23:30 period = 40.0h lead time |
| **Hour 21 (21h UTC Bar) MAE** | **1,886.4 MW** | Evaluated over 62 half-hours across the month |

### 15 January 2026 Midday Benchmark (12:00 UTC)
- **Latest Available Publication:** `14 Jan 07:30 UTC`
- **Forecast Generation:** `11,049.0 MW`
- **Actual Generation:** `9,742.0 MW`
- **Forecast Error:** `+1,307.0 MW` (Over-forecast)
- **Lead-Time Horizon:** `28.5 hours`

---

## 🖥️ User Guide: How to Use the Website

The portal consists of three primary views accessible via the top navigation bar:

### 1. Decision View
The primary operational cockpit used by traders on day D-1.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ⚡ Decision View                                                                        │
│ Delivery Date: [15 Jan 2026 ▼]  Decision Cutoff: [09:00 ▼]  Latest Published: 07:30 UTC│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 📋 Forecast Selection                                                                  │
│ For delivery 15 Jan 2026, cutoff is 09:00 UK local on 14 Jan 2026.                     │
│ Latest WINDFOR published: 14 Jan 07:30 UTC. Shaded band = ±P90 error (4,275 MW).       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Wind Generation: Forecast vs Actual (48 settlement periods)        [📥 Export CSV]    │
│  [========================== INTERACTIVE RECHARTS GRAPH ===========================]   │
│  • Hover over 12:00 UTC ➔ Forecast: 11,049 MW | Actual: 9,742 MW | Error: +1,307 MW    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### How to use:
1. **Select Delivery Date:** Choose any day from `01 Jan 2026` to `31 Jan 2026`.
2. **Select Decision Cutoff:** Choose between `07:00`, `08:00`, `09:00 (default)`, `10:00`, or `11:00` UK local time.
3. **Inspect the Publication Banner:** The banner immediately updates to show the latest model publication timestamp that was released prior to that cutoff.
4. **Read the Horizon Range:** With a `07:30 UTC` publication on D-1:
   - Settlement Period 1 (`00:00 UTC` on delivery day) has a **16.5-hour horizon**.
   - Settlement Period 48 (`23:30 UTC` on delivery day) has a **40.0-hour horizon**.
5. **Interactive Tooltip:** Hover along the chart to inspect any half-hour interval. The tooltip displays:
   - Target period in UTC (e.g. `12:00 UTC`).
   - Selected WINDFOR Forecast in MW.
   - Actual outturn generation from FUELHH in MW.
   - Net error in MW (colored amber for over-forecast, green for under-forecast).
   - Exact lead-time horizon in hours.
6. **Export CSV:** Click **📥 Export CSV** to download all 48 half-hour intervals with columns:
   `Delivery Date, Time (UTC), Forecast (MW), Actual (MW), Error (MW), Horizon (h)`.

---

### 2. Accuracy Dashboard
Comprehensive statistical retrospective across all 1,488 half-hours of January 2026.

1. **Executive KPI Cards:** View overall MAE, Bias, P90, P95, and NMAE at a glance.
2. **Error Distribution (Histogram):** Visualizes the probability density of forecast errors with colored thresholds for P50, P90, and P95 tail risk.
3. **MAE by Hour of Day (UTC):**
   - Breaks down errors by delivery hour (`00h` to `23h`).
   - Grouped strictly by UTC hour on the backend.
   - Hover over the **21h** bar to inspect late-evening performance (`1,886.4 MW MAE`).
4. **Accuracy by Forecast Horizon:**
   - Displays error metrics grouped into 4 active lead-time buckets:
     * `12–18h`: 2,195.3 MW MAE (Early morning delivery)
     * `18–24h`: 2,467.6 MW MAE (Morning demand ramp)
     * `24–36h`: 2,043.6 MW MAE (Afternoon & evening)
     * `36–48h`: 1,969.3 MW MAE (Late night)
5. **Daily Breakdown Table:** A sortable table listing each of the 31 days with its mean actual generation, MAE, bias, and P90 error.

---

### 3. Methodology Page
Provides full commercial and mathematical transparency:
- Mathematical equations for MAE, RMSE, Mean Bias, and Percentile calculations.
- Operational gate closure rules and resolution bridging logic.
- Imbalance pricing dynamics in the GB market.

---

## 🏗️ Architecture & Technical Integrity

```
                                  BROWSER CLIENT
                                        │
                         [React 19 + Vite + TypeScript]
                         [Recharts + dateUtils (UTC/UK)]
                                        │
                               HTTP / REST (Port 8000)
                                        │
                               FASTAPI BACKEND
                                        │
               ┌────────────────────────┴────────────────────────┐
               ▼                                                 ▼
        Analytics Engine                                  SQLite Database
   • select_latest_forecasts()                       • forecasts (19,272 rows)
   • expand_hourly_to_halfhour()                     • actuals (1,488 rows)
   • compute_metrics()                               • wind_data.db (3.4 MB)
```

### Timezone Safety Implementation
Unlike standard web apps that format dates using the browser's local timezone, WindScope implements custom Intl utilities in `frontend/src/utils/dateUtils.ts`:
- **Explicit TimeZone:** Every displayed timestamp uses `{ timeZone: 'UTC' }` or `{ timeZone: 'Europe/London' }`.
- **Zero Client Distortion:** A user in India (`UTC+5:30`) or California (`UTC-8`) sees identical, verified `07:30 UTC` publication and `12:00 UTC` settlement times without unwanted local offsets.
- **Automated Timezone Tests:** 40 Vitest unit and component tests run under forced environment timezones (`Asia/Kolkata`, `America/Los_Angeles`, `UTC`) to guarantee consistency.

---

## 📁 Project Structure

```
kjhwr/
├── Dockerfile                  # Unified multi-stage Docker build (UI + API + DB)
├── docker-compose.yml          # Dual-container local development setup
├── render.yaml                 # Render Blueprint 1-click cloud configuration
├── railway.json                # Railway cloud deployment configuration
├── fly.toml                    # Fly.io deployment manifest
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI entrypoint & SPA static asset fallback
│   │   ├── analytics.py        # Core analytics, resolution expansion & metrics
│   │   ├── db.py               # SQLite connection and query helpers
│   │   ├── config.py           # Application settings
│   │   └── routers/            # /forecast, /actuals, /accuracy, /live
│   ├── data/
│   │   └── wind_data.db        # Pre-loaded SQLite database (3.4 MB)
│   ├── ingestion/
│   │   └── fetch_data.py       # Elexon BMRS ingestion script
│   ├── tests/
│   │   ├── test_analytics.py   # Analytics & metric test cases
│   │   └── test_api.py         # REST API endpoint tests
│   ├── requirements.txt        # Python dependencies
│   └── verify_all_values.py    # End-to-end values verification script
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── DecisionView.tsx      # Main operational cockpit & chart
    │   │   ├── AccuracyDashboard.tsx # Historical metrics & breakdowns
    │   │   └── Methodology.tsx       # Documentation & formulas
    │   ├── utils/
    │   │   └── dateUtils.ts          # Timezone-safe date/time formatting
    │   ├── tests/
    │   │   ├── timezone.test.ts             # 36 unit timezone tests
    │   │   └── decisionViewTimezone.test.tsx# Component rendering tests
    │   └── api/client.ts             # Axios API client
    ├── package.json
    └── vite.config.ts
```

---

## 🚀 Local Installation & Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- *(Optional)* Docker Desktop

### Option A: Using Docker (Fastest)
Run the entire stack (both frontend and backend) with Docker Compose:
```bash
docker compose up --build
```
- Web Application: **http://localhost**
- Backend API Docs: **http://localhost:8000/docs**

---

### Option B: Running Locally (Development Mode)

#### 1. Backend Setup
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1   # On Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Backend will be live at `http://localhost:8000` (API Docs at `/docs`).

#### 2. Frontend Setup
Open a second terminal:
```powershell
cd frontend
npm install
npm run dev
```
Frontend will be live at `http://localhost:5173`.

---

## 🧪 Automated Testing & Verification

The repository includes a comprehensive 57-test automated verification suite.

### 1. Run Backend Tests (17 tests)
```powershell
cd backend
python -m pytest
```
Verifies resolution bridging, look-ahead leakage prevention, metrics calculations, and API routes.

### 2. Run Frontend Timezone Tests (40 tests)
```powershell
cd frontend
npm test
```
Verifies that formatting and component rendering never drift under non-UTC client timezones (`Asia/Kolkata`, `America/Los_Angeles`).

### 3. Run End-to-End Verification Script
```powershell
cd backend
python verify_all_values.py
```
Directly queries the SQLite database, re-computes all January 2026 accuracy numbers, asserts all benchmark values, and prints a formatted verification report.

---

## ☁️ Cloud Deployment

The repository includes ready-to-deploy configuration manifests:

### 1. Render (Recommended — 1-Click Free Tier)
1. Fork or push this repository to GitHub: `https://github.com/NikhilReddy-hub/kjhwr.git`.
2. Go to [dashboard.render.com](https://dashboard.render.com) ➔ **New +** ➔ **Blueprint**.
3. Select your repository. Render automatically reads `render.yaml`, builds the multi-stage `Dockerfile`, and provisions your service with SSL.

### 2. Railway
1. Go to [railway.com](https://railway.com) ➔ **New Project** ➔ **Deploy from GitHub repo**.
2. Railway detects `railway.json` and deploys the container automatically.
3. Under Settings, click **Generate Domain**.

### 3. Fly.io
```bash
fly launch
fly deploy
```
Uses the pre-configured `fly.toml` in the London (`lhr`) region.

### 4. Custom VPS / Server with Docker
```bash
docker build -t windscope .
docker run -d --name windscope -p 80:8000 --restart always windscope
```

---

## 🔌 API Reference

FastAPI provides interactive Swagger documentation at `http://localhost:8000/docs`.

| Method | Endpoint | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | None | Service health and row counts for forecasts and actuals. |
| `GET` | `/api/forecast/latest` | `delivery_date`, `cutoff_hour`, `cutoff_minute` | Returns 48 settlement periods with selected forecast, actuals, and horizon. |
| `GET` | `/api/accuracy/summary` | `cutoff_hour`, `cutoff_minute`, `start_date`, `end_date` | Aggregated metrics (MAE, RMSE, Bias, P50, P90, P95, NMAE). |
| `GET` | `/api/accuracy/by-hour` | `cutoff_hour`, `cutoff_minute` | Hourly breakdown (00h–23h UTC) of MAE, bias, and P90 error. |
| `GET` | `/api/accuracy/by-horizon`| `cutoff_hour`, `cutoff_minute` | Accuracy breakdown by lead-time buckets (`12–18h`, `18–24h`, etc.). |
| `GET` | `/api/accuracy/daily` | `cutoff_hour`, `cutoff_minute` | Day-by-day table of accuracy metrics across the month. |
| `GET` | `/api/accuracy/timeseries`| `cutoff_hour`, `cutoff_minute` | Continuous 30-min timeseries of forecast, actual, and error. |
| `GET` | `/api/accuracy/distribution`| `cutoff_hour`, `cutoff_minute` | Histogram bin counts and percentiles for error distribution. |

---

## 📄 License & Data Attribution
- Data source: **Elexon BMRS** (Balancing Mechanism Reporting Service), under the Open Government Licence.
- Application code released under the **MIT License**.
