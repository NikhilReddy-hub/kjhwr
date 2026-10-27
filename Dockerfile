# Multi-stage production build: React Frontend + FastAPI Backend
# Single container serving both API and UI on PORT (defaults to 8000)

# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --legacy-peer-deps
COPY frontend/ .
RUN npm run build

# Stage 2: Python backend + bundled SQLite database + static UI assets
FROM python:3.11-slim
WORKDIR /app

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application
COPY backend/app/ ./app/
COPY backend/ingestion/ ./ingestion/

# Copy pre-populated SQLite database (Jan 2026 data ready out of the box)
COPY backend/data/ ./data/

# Copy compiled frontend into static/
COPY --from=frontend-builder /frontend/dist ./static/

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
