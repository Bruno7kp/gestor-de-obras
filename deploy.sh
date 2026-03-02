#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ROOT_DIR}/.env.prod"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.prod.prebuilt.yml"

cd "$ROOT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $*"; }
ok() { echo -e "${GREEN}[deploy]${NC} $*"; }
err() { echo -e "${RED}[deploy]${NC} $*"; }

usage() {
  cat <<'EOF'
Uso:
  ./deploy.sh [--tag TAG] [--skip-migrate] [--no-pull]

Opções:
  --tag TAG         Sobrescreve IMAGE_TAG para este deploy (ex.: sha-abc123)
  --skip-migrate    Não executa prisma migrate deploy
  --no-pull         Não executa docker compose pull antes do up
  -h, --help        Mostra esta ajuda

Pré-requisitos:
  - Arquivo .env.prod configurado
  - GHCR_IMAGE_PREFIX definido no .env.prod
  - IMAGE_TAG definido (ou default latest)
EOF
}

TAG_OVERRIDE=""
SKIP_MIGRATE="false"
DO_PULL="true"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      TAG_OVERRIDE="${2:-}"
      [[ -n "$TAG_OVERRIDE" ]] || { err "--tag requer um valor"; exit 1; }
      shift 2
      ;;
    --skip-migrate)
      SKIP_MIGRATE="true"
      shift
      ;;
    --no-pull)
      DO_PULL="false"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      err "Argumento inválido: $1"
      usage
      exit 1
      ;;
  esac
done

[[ -f "$ENV_FILE" ]] || { err "Arquivo .env.prod não encontrado em $ENV_FILE"; exit 1; }
[[ -f "$COMPOSE_FILE" ]] || { err "Arquivo docker-compose.prod.prebuilt.yml não encontrado"; exit 1; }

command -v docker >/dev/null 2>&1 || { err "docker não encontrado"; exit 1; }

docker info >/dev/null 2>&1 || { err "docker não está acessível para o usuário atual"; exit 1; }

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -n "$TAG_OVERRIDE" ]]; then
  export IMAGE_TAG="$TAG_OVERRIDE"
  log "Usando IMAGE_TAG sobrescrito: $IMAGE_TAG"
fi

required_vars=(GHCR_IMAGE_PREFIX DATABASE_URL JWT_SECRET POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD CORS_ORIGINS RESEND_FROM_EMAIL)
for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    err "Variável obrigatória ausente em .env.prod: $var"
    exit 1
  fi
done

if [[ -z "${IMAGE_TAG:-}" ]]; then
  warn "IMAGE_TAG não definido. Usando latest"
  export IMAGE_TAG="latest"
fi

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

on_error() {
  err "Falha durante o deploy. Coletando diagnóstico rápido..."
  compose ps || true
  compose logs --tail=80 backend app || true
  echo
  warn "Rollback rápido (modelo antigo com build local):"
  echo "docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d --build"
}
trap on_error ERR

wait_healthy() {
  local service="$1"
  local timeout_seconds="${2:-180}"
  local waited=0

  local cid
  cid="$(compose ps -q "$service")"
  if [[ -z "$cid" ]]; then
    err "Serviço '$service' não encontrado no compose"
    return 1
  fi

  while (( waited < timeout_seconds )); do
    local status
    status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || echo "unknown")"

    case "$status" in
      healthy|running)
        ok "Serviço '$service' está $status"
        return 0
        ;;
      starting|created|restarting)
        sleep 3
        waited=$((waited + 3))
        ;;
      *)
        err "Serviço '$service' em estado inesperado: $status"
        return 1
        ;;
    esac
  done

  err "Timeout aguardando serviço '$service' ficar saudável"
  return 1
}

log "Validando compose"
compose config >/dev/null

log "Estado atual dos serviços"
compose ps || true

if [[ "$DO_PULL" == "true" ]]; then
  log "Baixando imagens ($GHCR_IMAGE_PREFIX, tag: $IMAGE_TAG)"
  compose pull app backend
else
  warn "Pull de imagens desativado (--no-pull)"
fi

log "Subindo stack com imagens pré-buildadas"
compose up -d

log "Aguardando saúde dos serviços principais"
wait_healthy db 180
wait_healthy backend 240
wait_healthy app 240
wait_healthy nginx 120 || warn "nginx não tem healthcheck; validando estado de execução"

if [[ "$SKIP_MIGRATE" == "false" ]]; then
  log "Executando migrations (prisma migrate deploy)"
  compose exec -T backend npx prisma migrate deploy
else
  warn "Migrations desativadas (--skip-migrate)"
fi

ok "Deploy concluído com sucesso"
compose ps
