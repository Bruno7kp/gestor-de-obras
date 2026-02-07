# 🔒 Proteção de Dados - Guia de Boas Práticas

## Problema Identificado
O banco de dados foi apagado porque provavelmente você usou:
```bash
docker-compose down -v  # ❌ NUNCA use -v (remove volumes)
```

## ✅ Comandos Seguros

### Parar containers (SEM apagar dados)
```bash
docker-compose down
# Você pode iniciar novamente com:
docker-compose up
```

### Listar volumes salvos
```bash
docker volume ls | grep gestor
```

### Ver dados do volume
```bash
docker volume inspect gestor-de-obras_pgdata
```

## ⚠️ Comandos Perigosos (Evitar)

| Comando | Risco | Alternativa |
|---------|-------|------------|
| `docker-compose down -v` | Apaga todos os volumes | Use `docker-compose down` |
| `docker volume prune` | Apaga volumes não usados | Use com cuidado |
| `docker system prune -a` | Apaga tudo (incluindo dados) | Especifique o que apagar |

## 🛡️ Estratégia de Backup (Recomendado)

### Backup manual do banco
```bash
# Criar dump SQL
docker-compose exec -T db pg_dump -U gestor gestor_obras > backup.sql

# Restaurar do dump
docker-compose exec -T db psql -U gestor gestor_obras < backup.sql
```

### Backup automático diário
Crie um arquivo `scripts/backup.sh`:
```bash
#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
docker-compose exec -T db pg_dump -U gestor gestor_obras > "backups/backup_$TIMESTAMP.sql"
echo "✓ Backup created: backups/backup_$TIMESTAMP.sql"
```

## 🔄 Seed Automático

Se o banco for deletado, rode o seed:
```bash
npm run prisma:seed
```

Ou use o novo script que checa antes de fazer seed:
```bash
npm run prisma:seed  # Verifica se já tem dados
```

## 📋 Checklist de Segurança

- [ ] Nunca use `docker-compose down -v` em produção
- [ ] Faça backup regularmente do banco
- [ ] Use volumes nomeados (já configurado: `pgdata`)
- [ ] Mantenha as credenciais em `.env` (git-ignored)
- [ ] Teste restauração de backup mensalmente

## 🆘 Se Perder Dados de Novo

1. O volume foi deletado → Você usou `-v`
2. Execute `npm run prisma:seed` para recriar dados iniciais
3. Restaure de backup se tiver: `psql -U gestor gestor_obras < backup.sql`
