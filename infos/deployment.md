
# Production Deployment Guide

## 1. Infrastructure Requirements
- **Server:** Ubuntu 22.04 LTS (minimum 2GB RAM for Node/Build processes).
- **Database:** Managed PostgreSQL (e.g., AWS RDS or DigitalOcean Managed DB).
- **SSL:** Let's Encrypt / Certbot.

## 2. Backend Deployment (Dockerized)
1. **Dockerfile:** Create a multi-stage build (Build & Runner).
2. **Environment Variables:**
   - `DATABASE_URL`: Connection string.
   - `JWT_SECRET`: For authentication.
   - `CORS_ORIGIN`: Domain of the frontend.
3. **CI/CD:** GitHub Actions to push to Docker Hub and trigger a webhook on the server.

## 3. Frontend Deployment
1. **Provider:** Vercel or Netlify for high-speed CDN distribution.
2. **Build Command:** `npm run build` (standard React build).
3. **Environment:** `VITE_API_URL` pointing to the backend load balancer.

## 4. Maintenance & Monitoring
- **Logs:** Winston or Pino for JSON logs.
- **APM:** Sentry for frontend error tracking.
- **Backups:** Weekly PostgreSQL automated snapshots.
