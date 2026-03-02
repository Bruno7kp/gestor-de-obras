
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

## 3.1 CI Pipeline (GitHub Actions)
- Workflow: `.github/workflows/docker-images.yml`
- Trigger: `push` na branch `main` e execução manual (`workflow_dispatch`).
- Registry: GHCR (`ghcr.io/<owner>/<repo>/app` e `ghcr.io/<owner>/<repo>/backend`).
- Tags publicadas: `latest` (apenas branch padrão), `sha-<commit>` e `<branch>`.
- Cache de build habilitado com GitHub Actions cache (`type=gha`) para acelerar builds.

### Configuração necessária no GitHub
- **Actions permissions do repositório:** permitir leitura/escrita em packages.
- **Variable de ambiente do repositório:** `VITE_API_URL`.
- O `GITHUB_TOKEN` padrão já é usado para autenticar no GHCR.

## 3.2 Deploy no servidor sem build (recomendado)
Use `docker-compose.prod.prebuilt.yml` para consumir imagens já buildadas pelo pipeline.

### Variáveis adicionais no `.env.prod`
- `GHCR_IMAGE_PREFIX=ghcr.io/<owner>/<repo>`
- `IMAGE_TAG=latest` (ou `sha-<commit>` para fixar versão)

### Login no GHCR (uma vez por servidor)
```bash
echo "$GHCR_PAT" | docker login ghcr.io -u <owner> --password-stdin
```

### Deploy
```bash
docker compose --env-file .env.prod -f docker-compose.prod.prebuilt.yml pull app backend
docker compose --env-file .env.prod -f docker-compose.prod.prebuilt.yml up -d
```

### Deploy automatizado (script)
```bash
./deploy.sh deploy
```

Exemplos úteis:
```bash
# fixar uma versão específica da imagem
./deploy.sh deploy --tag sha-abc123

# subir sem pull (usa imagens já presentes no host)
./deploy.sh deploy --no-pull

# subir sem rodar migrations
./deploy.sh deploy --skip-migrate
```

### Manutenção pós-deploy (forma correta)
```bash
# migration manual
./deploy.sh exec -- npx prisma migrate deploy

# prisma generate
./deploy.sh prisma-generate

# seed
./deploy.sh seed

# correção de duplicados (dry-run)
./deploy.sh fix-duplicate

# aplicar correção de duplicados
./deploy.sh fix-duplicate --apply
```

## 4. Maintenance & Monitoring
- **Logs:** Winston or Pino for JSON logs.
- **APM:** Sentry for frontend error tracking.
- **Backups:** Weekly PostgreSQL automated snapshots.
