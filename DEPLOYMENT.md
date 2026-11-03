# RoamHaven Deployment Guide

## Docker (local)

```bash
docker compose up --build
```

App: http://localhost:8080

Required env vars (set in `.env` or shell):

- `SECRET`
- `GOOGLE_API_KEY` (optional, enables AI features)
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (optional, enables payments)

## Render

1. Connect this repository to Render.
2. Use the included `render.yaml` blueprint or create a Web Service manually.
3. Set `ATLASDB_URL`, `SECRET`, and optional API keys in the dashboard.
4. Health check path: `/api/health`.

## Railway / DigitalOcean / AWS EC2

1. Build and run the Docker image, or run `npm ci && node app.js` on Node 18.
2. Point `ATLASDB_URL` to MongoDB Atlas or a managed Mongo instance.
3. Set `REDIS_URL` for cache (optional; app falls back to in-memory cache).
4. Put the app behind HTTPS and set secure session cookies in production.

## Kubernetes

```bash
kubectl apply -f k8s/
```

Create a secret named `roamhaven-secrets` with keys such as `ATLASDB_URL`, `SECRET`, `GOOGLE_API_KEY`.

## CI/CD

GitHub Actions workflow at `.github/workflows/ci.yml` runs:

- Jest unit tests
- Supertest integration tests
- Docker image build on push/PR
