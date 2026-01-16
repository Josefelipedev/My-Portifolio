# My Portfolio

Portfolio pessoal moderno com Next.js, gestão dinâmica de conteúdo e painel administrativo.

## Sobre o Projeto

Um site de portfolio full-stack que permite showcase de projetos e experiências profissionais através de uma interface limpa e moderna, com painel de administração para gerenciamento de conteúdo.

## Features

- **Single-page portfolio** - Layout moderno e responsivo
- **Conteúdo dinâmico** - Projetos e experiências do banco de dados
- **Painel Admin** - Interface protegida para gerenciar conteúdo
- **Integração GitHub** - Sync automático de repositórios
- **Analytics** - Tracking de visitas e interações
- **AI Features** - Resumo de projetos com Claude

## Tech Stack

| Categoria | Tecnologia |
|-----------|------------|
| Framework | Next.js 16 (React 19) |
| Linguagem | TypeScript |
| Styling | Tailwind CSS 4 |
| Banco de Dados | PostgreSQL |
| ORM | Prisma |
| Auth | JWT |
| AI | Anthropic Claude SDK |
| Email | Nodemailer |
| Testes | Vitest + React Testing Library |

## Estrutura

```
myportfolio/
├── src/
│   ├── app/
│   │   ├── page.tsx           # Homepage (portfolio)
│   │   ├── admin/             # Painel administrativo
│   │   └── api/               # API routes
│   ├── components/            # React components
│   └── lib/                   # Utils e helpers
├── prisma/
│   └── schema.prisma          # Database schema
├── scripts/                   # Scripts utilitários
├── public/                    # Assets estáticos
└── package.json
```

## Modelos de Dados

### Projects
Projetos do portfolio com integração GitHub.

### Experiences
Histórico profissional (timeline).

### Skills
Habilidades categorizadas (frontend, backend, devops, tools).

### Contact Messages
Mensagens recebidas pelo formulário de contato.

### Analytics
Page views, estatísticas de visitantes, geolocalização.

## Instalação

```bash
# 1. Instalar dependências
npm install

# 2. Configurar banco de dados
npx prisma migrate dev

# 3. Configurar senha do admin
node scripts/hash-password.mjs SUA_SENHA

# 4. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com PASSWORD_HASH e JWT_SECRET

# 5. Iniciar desenvolvimento
npm run dev
```

## Variáveis de Ambiente

```env
# Database
DATABASE_URL=postgresql://myportfolio_user:myportfolio_pass123@localhost:5432/myportfolio

# Auth
PASSWORD_HASH=hash-gerado-pelo-script
JWT_SECRET=sua-chave-secreta-longa

# Email (opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu@email.com
SMTP_PASS=app-password

# AI (opcional)
ANTHROPIC_API_KEY=sk-ant-xxx
```

## Uso

### Acessar Portfolio
```
http://localhost:3000
```

### Acessar Admin
```
http://localhost:3000/admin
```

Use a senha configurada no `.env` para fazer login.

### Gerenciar Conteúdo

No painel admin você pode:
- Adicionar/editar/remover projetos
- Gerenciar experiências profissionais
- Categorizar skills
- Ver mensagens de contato
- Configurar informações do site
- Ver analytics

## Comandos

```bash
# Desenvolvimento
npm run dev

# Build
npm run build

# Produção
npm start

# Testes
npm test

# Prisma
npx prisma studio     # Interface visual do banco
npx prisma migrate dev # Criar migration
npx prisma db push    # Push schema
```

## Scripts Úteis

```bash
# Gerar hash de senha
node scripts/hash-password.mjs NOVA_SENHA

# Sync com GitHub
node scripts/sync-github.mjs

# Sync skills do currículo
node scripts/sync-resume.mjs
```

## Licença

MIT
