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
  ./deploy.sh deploy [--tag TAG] [--skip-migrate] [--no-pull]
  ./deploy.sh exec -- <comando>
  ./deploy.sh prisma-generate
  ./deploy.sh seed
  ./deploy.sh fix-duplicate [--apply]
  ./deploy.sh status
  ./deploy.sh logs [serviço]

Comandos:
  deploy            Faz pull + up + healthcheck + migrate (padrão)
  exec              Executa comando dentro do container backend
  prisma-generate   Roda npx prisma generate no backend
  seed              Roda npm run prisma:seed no backend
  fix-duplicate     Roda script de correção de forecast-expense (DRY_RUN por padrão)
  status            Mostra status dos serviços
  logs              Mostra logs (default: backend)

Opções do deploy:
  --tag TAG         Sobrescreve IMAGE_TAG para este deploy (ex.: sha-abc123)
  --skip-migrate    Não executa prisma migrate deploy
  --no-pull         Não executa docker compose pull antes do up

Opções do fix-duplicate:
  --apply           Executa sem DRY_RUN

Pré-requisitos:
  - Arquivo .env.prod configurado
  - GHCR_IMAGE_PREFIX definido no .env.prod
  - IMAGE_TAG definido (ou default latest)
EOF
}

[[ -f "$ENV_FILE" ]] || { err "Arquivo .env.prod não encontrado em $ENV_FILE"; exit 1; }
[[ -f "$COMPOSE_FILE" ]] || { err "Arquivo docker-compose.prod.prebuilt.yml não encontrado"; exit 1; }

command -v docker >/dev/null 2>&1 || { err "docker não encontrado"; exit 1; }

docker info >/dev/null 2>&1 || { err "docker não está acessível para o usuário atual"; exit 1; }

read_env_value() {
  local key="$1"
  local line
  line="$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | tail -n 1 || true)"
  [[ -n "$line" ]] || return 1

  local value="${line#*=}"
  value="${value%$'\r'}"

  if [[ "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
    value="${value:1:${#value}-2}"
  fi

  printf '%s' "$value"
}

load_env() {
  export GHCR_IMAGE_PREFIX="$(read_env_value GHCR_IMAGE_PREFIX || true)"
  export IMAGE_TAG="$(read_env_value IMAGE_TAG || true)"
}

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

require_env_vars() {
  local required_vars=(GHCR_IMAGE_PREFIX DATABASE_URL JWT_SECRET POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD CORS_ORIGINS RESEND_FROM_EMAIL)
  for var in "${required_vars[@]}"; do
    if ! grep -Eq "^[[:space:]]*${var}=" "$ENV_FILE"; then
      err "Variável obrigatória ausente em .env.prod: $var"
      exit 1
    fi
  done

  if [[ -z "${IMAGE_TAG:-}" ]]; then
    warn "IMAGE_TAG não definido. Usando latest"
    export IMAGE_TAG="latest"
  fi
}

on_error() {
  err "Falha durante o deploy. Coletando diagnóstico rápido..."
  compose ps || true
  compose logs --tail=80 backend app || true
  echo
  warn "Rollback rápido (modelo antigo com build local):"
  echo "docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d --build"
}

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

cmd_deploy() {
  local tag_override=""
  local skip_migrate="false"
  local do_pull="true"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --tag)
        tag_override="${2:-}"
        [[ -n "$tag_override" ]] || { err "--tag requer um valor"; exit 1; }
        shift 2
        ;;
      --skip-migrate)
        skip_migrate="true"
        shift
        ;;
      --no-pull)
        do_pull="false"
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        err "Argumento inválido no deploy: $1"
        usage
        exit 1
        ;;
    esac
  done

  load_env
  if [[ -n "$tag_override" ]]; then
    export IMAGE_TAG="$tag_override"
    log "Usando IMAGE_TAG sobrescrito: $IMAGE_TAG"
  fi
  require_env_vars

  trap on_error ERR

  log "Validando compose"
  compose config >/dev/null

  log "Estado atual dos serviços"
  compose ps || true

  if [[ "$do_pull" == "true" ]]; then
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

  if [[ "$skip_migrate" == "false" ]]; then
    log "Executando migrations (prisma migrate deploy)"
    compose exec -T backend npx prisma migrate deploy
  else
    warn "Migrations desativadas (--skip-migrate)"
  fi

  ok "Deploy concluído com sucesso"
  compose ps
}

cmd_exec() {
  load_env
  require_env_vars
  if [[ "${1:-}" == "--" ]]; then shift; fi
  [[ $# -gt 0 ]] || { err "Informe um comando para executar no backend"; exit 1; }
  compose exec backend "$@"
}

cmd_prisma_generate() {
  load_env
  require_env_vars
  compose exec -T backend npx prisma generate
}

cmd_seed() {
  load_env
  require_env_vars
  compose exec -T backend npm run prisma:seed
}

cmd_fix_duplicate() {
  load_env
  require_env_vars
  local mode="dry-run"
  if [[ "${1:-}" == "--apply" ]]; then
    mode="apply"
  fi

  if [[ "$mode" == "dry-run" ]]; then
    compose exec -T -e DRY_RUN=1 backend npx ts-node scripts/fix-duplicate-forecast-expenses.ts
  else
    compose exec -T backend npx ts-node scripts/fix-duplicate-forecast-expenses.ts
  fi
}

cmd_status() {
  load_env
  compose ps
}

cmd_logs() {
  load_env
  local service="${1:-backend}"
  compose logs --tail=120 "$service"
}

main() {
  local command="${1:-deploy}"
  if [[ $# -gt 0 ]]; then shift; fi

  case "$command" in
    deploy)
      cmd_deploy "$@"
      ;;
    exec)
      cmd_exec "$@"
      ;;
    prisma-generate)
      cmd_prisma_generate "$@"
      ;;
    seed)
      cmd_seed "$@"
      ;;
    fix-duplicate)
      cmd_fix_duplicate "$@"
      ;;
    status)
      cmd_status "$@"
      ;;
    logs)
      cmd_logs "$@"
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      err "Comando inválido: $command"
      usage
      exit 1
      ;;
  esac
}

main "$@"
