# Production Infrastructure

This directory contains the production-oriented container topology for the AI Data Analyst application.

## Services

- `frontend` — Next.js production server
- `backend` — NestJS API
- `worker` — BullMQ background worker
- `backend-migrate` — one-shot TypeORM production migration runner
- `postgres` — PostgreSQL
- `redis` — Redis
- `minio` — S3-compatible object storage

## Network flow

Frontend receives browser traffic on port 3000.

Frontend server-side rewrites `/backend/*` requests to:

`http://backend:3001`

Backend connects internally to:

- PostgreSQL
- Redis
- MinIO

Worker connects internally to:

- PostgreSQL
- Redis
- MinIO

The PostgreSQL, Redis, and MinIO service ports are not published to the host by default.

## Production environment

Do not commit production secrets.

Provide the following environment variables to Docker Compose from the deployment environment or from a separate environment file outside the repository:

- `DATABASE_NAME`
- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_BUCKET`
- `S3_REGION`
- `ALLOWED_ORIGINS`
- `JWT_ACCESS_SECRET`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_TIMEOUT_MS`
- `GEMINI_RETRY_ATTEMPTS`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_PRO_PLAN_ID`
- `RAZORPAY_PRO_TOTAL_COUNT`
- `RAZORPAY_WEBHOOK_SECRET`

Optional image overrides:

- `POSTGRES_IMAGE`
- `REDIS_IMAGE`
- `MINIO_IMAGE`

## Start

From the repository root:

```bash
docker compose \
  -f infra/docker-compose.prod.yml \
  --env-file /path/to/production.env \
  up -d --build