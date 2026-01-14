# Guia de Deploy e Administração do Portfolio

## Informações do Servidor

| Item | Valor |
|------|-------|
| IP | `SEU_IP_DO_SERVIDOR` |
| Usuário SSH | `deploy` |
| Senha SSH | `***` (ver .env.local ou gerenciador de senhas) |
| Senha Root | `***` |
| URL | https://portfolio.josefelipedev.com |

> **IMPORTANTE:** Nunca commitar senhas no repositório. Guarde em local seguro.

---

## 1. Acessar o Servidor

```bash
ssh deploy@SEU_IP_DO_SERVIDOR
# Digite sua senha quando solicitado
```

---

## 2. Gerenciar Skills (My Skills)

### Opção A: Via Banco de Dados (Direto)

```bash
# Conectar ao PostgreSQL
docker exec -it infra-postgres psql -U postgres -d portfolio

# Listar todas as skills
SELECT * FROM "Skill" ORDER BY category, "order";

# Adicionar nova skill
INSERT INTO "Skill" (id, name, category, level, "order")
VALUES (gen_random_uuid(), 'NomeDaSkill', 'categoria', 4, 0);

# Categorias disponíveis: frontend, backend, devops, mobile, other

# Atualizar nível de uma skill
UPDATE "Skill" SET level = 5 WHERE name = 'React';

# Remover skill
DELETE FROM "Skill" WHERE name = 'NomeDaSkill';

# Sair do PostgreSQL
\q
```

### Opção B: Via Script de Sync (Recomendado)

1. Edite o arquivo `src/data/resume.json` no seu PC local
2. Adicione/modifique as skills na seção "skills"
3. Execute:

```bash
# No PC local
npm run sync:resume

# Commit e push
git add -A && git commit -m "Update skills" && git push

# No servidor
cd ~/myportfolio && git pull && npm run build && pm2 restart myportfolio
```

---

## 3. Gerenciar Work Experience

### Opção A: Via Banco de Dados (Direto)

```bash
# Conectar ao PostgreSQL
docker exec -it infra-postgres psql -U postgres -d portfolio

# Listar experiências
SELECT id, title, company, "startDate", "endDate" FROM "Experience" ORDER BY "startDate" DESC;

# Adicionar nova experiência
INSERT INTO "Experience" (
  id, title, description, responsibilities, challenges, technologies,
  company, "startDate", "endDate", location, "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(),
  'Cargo',
  'Descrição do trabalho',
  'Responsabilidade 1, Responsabilidade 2',
  'Desafio 1, Desafio 2',
  'React, Node.js, PostgreSQL',
  'Nome da Empresa',
  '2024-01-01',
  NULL,  -- NULL = emprego atual
  'Faro, Portugal',
  NOW(),
  NOW()
);

# Atualizar experiência
UPDATE "Experience"
SET title = 'Novo Cargo', "updatedAt" = NOW()
WHERE company = 'Nome da Empresa';

# Remover experiência
DELETE FROM "Experience" WHERE id = 'id-da-experiencia';

# Sair
\q
```

### Opção B: Via Arquivo resume.json (Recomendado)

1. Edite `src/data/resume.json` na seção "experience"
2. Execute o sync:

```bash
npm run sync:resume
git add -A && git commit -m "Update experience" && git push
```

3. No servidor:
```bash
cd ~/myportfolio && git pull && npm run sync:resume && npm run build && pm2 restart myportfolio
```

---

## 4. Deploy de Atualizações

### Deploy Rápido (sem mudanças no banco)

```bash
# No servidor
cd ~/myportfolio
git pull
npm run build
pm2 restart myportfolio
```

### Deploy Completo (com mudanças no banco)

```bash
# No servidor
cd ~/myportfolio
git pull
npm install                  # Se houver novas dependências
npx prisma db push          # Se houver mudanças no schema
npx prisma db seed          # Se precisar popular dados
npm run build
pm2 restart myportfolio
```

---

## 5. Comandos Úteis

### PM2 (Gerenciador de Processos)

```bash
pm2 list                    # Listar aplicações
pm2 logs myportfolio        # Ver logs em tempo real
pm2 logs myportfolio --lines 100  # Últimas 100 linhas
pm2 restart myportfolio     # Reiniciar aplicação
pm2 stop myportfolio        # Parar aplicação
pm2 start myportfolio       # Iniciar aplicação
pm2 save                    # Salvar configuração
```

### Docker (Banco de Dados)

```bash
# Ver containers rodando
docker ps

# Logs do PostgreSQL
docker logs infra-postgres

# Logs do Redis
docker logs infra-redis

# Reiniciar banco de dados
cd ~/docker-infra
docker compose restart

# Parar tudo
docker compose down

# Iniciar tudo
docker compose up -d
```

### Nginx

```bash
# Testar configuração (requer senha root)
su -c "nginx -t" root

# Recarregar configuração
su -c "systemctl reload nginx" root

# Ver status
su -c "systemctl status nginx" root
```

### Banco de Dados

```bash
# Acessar PostgreSQL
docker exec -it infra-postgres psql -U postgres -d portfolio

# Comandos SQL úteis dentro do psql:
\dt                         # Listar tabelas
\d "NomeDaTabela"          # Ver estrutura da tabela
SELECT * FROM "Skill";     # Ver todas as skills
SELECT * FROM "Experience"; # Ver todas as experiências
SELECT * FROM "User";      # Ver usuários
\q                         # Sair
```

---

## 6. Estrutura de Arquivos Importantes

```
~/myportfolio/
├── .env                    # Variáveis de ambiente (NÃO COMMITAR)
├── src/
│   ├── data/
│   │   ├── resume.json     # Dados do currículo
│   │   └── resume.pdf      # PDF do currículo
│   └── app/
│       ├── icon.png        # Favicon
│       └── apple-icon.png  # Ícone Apple
├── prisma/
│   ├── schema.prisma       # Schema do banco
│   └── seed.ts             # Script de seed
└── scripts/
    └── sync-resume-skills.ts  # Sync do currículo

~/docker-infra/
├── .env                    # Credenciais do banco (NÃO COMMITAR)
├── docker-compose.yml      # Configuração dos containers
└── volumes/
    ├── postgres/           # Dados do PostgreSQL
    └── redis/              # Dados do Redis
```

---

## 7. Troubleshooting

### Aplicação não inicia
```bash
pm2 logs myportfolio --lines 50  # Ver erros
pm2 restart myportfolio
```

### Banco de dados não conecta
```bash
docker ps                        # Verificar se está rodando
cd ~/docker-infra && docker compose up -d  # Reiniciar
```

### Erro 502 Bad Gateway
```bash
pm2 list                         # Verificar se app está online
pm2 restart myportfolio          # Reiniciar app
```

### Limpar cache do navegador
- Pressione `Ctrl+Shift+Delete` no navegador
- Ou acesse em aba anônima

---

## 8. Backup do Banco de Dados

### Criar backup
```bash
docker exec infra-postgres pg_dump -U postgres portfolio > backup_$(date +%Y%m%d).sql
```

### Restaurar backup
```bash
docker exec -i infra-postgres psql -U postgres portfolio < backup_20240114.sql
```

---

## 9. Atualizar Senha do Admin

```bash
# Gerar novo hash (no PC local)
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('NOVA_SENHA', 10));"

# Atualizar no banco (no servidor)
docker exec -it infra-postgres psql -U postgres -d portfolio
UPDATE "User" SET "passwordHash" = 'HASH_GERADO' WHERE email = 'seu@email.com';
\q
```

---

## 10. Segurança

> **NUNCA commitar no Git:**
> - Senhas
> - Tokens de API
> - Arquivos .env
> - Chaves privadas
> - IPs de servidor

Guarde suas credenciais em:
- Gerenciador de senhas (1Password, Bitwarden, etc.)
- Arquivo local fora do repositório
- Variáveis de ambiente do sistema
