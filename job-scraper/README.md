# Job Scraper Service

Serviço Python de scraping de vagas com Playwright (para SPAs) + HTTP simples + extração de conteúdo web.

> Absorveu todas as funcionalidades do **clawlite** (scraping genérico, crawling, extração de conteúdo).

## Overview

Este serviço resolve dois problemas:

1. **Scraping de vagas** em sites JavaScript-heavy (React/SPA) com suporte a AI fallback
2. **Extração de conteúdo web** genérico (Markdown limpo, crawling BFS, resumos)

## Fontes de Vagas

| Fonte | Site | Estratégia |
|-------|------|-----------|
| **GeekHunter** | geekhunter.com.br | Playwright + fallback regex por href |
| **Vagas.com.br** | vagas.com.br | Playwright + fallback por `a.link-detalhes-vaga` |

## Quick Start

```bash
# Build e start
docker-compose build
docker-compose up -d

# Logs
docker-compose logs -f job-scraper

# Stop
docker-compose down
```

## API Endpoints

### Job Search

```bash
# Health
curl http://localhost:8000/health

# Listar fontes disponíveis
curl http://localhost:8000/sources

# Buscar em todas as fontes
curl "http://localhost:8000/search?keyword=desenvolvedor&limit=50"

# Buscar fonte específica
curl "http://localhost:8000/search/geekhunter?keyword=python&limit=20"
curl "http://localhost:8000/search/vagascombr?keyword=react&limit=20"

# Busca via agentes (com detalhes do pipeline)
curl "http://localhost:8000/search/agent?keyword=typescript&source=geekhunter"
curl "http://localhost:8000/search/agent/details?keyword=typescript&source=geekhunter"
```

### Web Scraping (do clawlite)

```bash
# Extrair conteúdo de URL como Markdown
curl -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/blog/post"}'

# Extrair com lista de links
curl -X POST http://localhost:8000/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Crawl BFS de um site
curl -X POST http://localhost:8000/crawl \
  -H "Content-Type: application/json" \
  -d '{"start_url": "https://example.com", "max_pages": 5, "depth": 2}'

# Resumo truncado de uma URL
curl -X POST http://localhost:8000/summarize \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article", "max_length": 300}'
```

### Monitoramento

```bash
# Stats gerais
curl http://localhost:8000/stats

# Logs recentes
curl "http://localhost:8000/logs?limit=50"
curl "http://localhost:8000/logs?level=ERROR"

# Stats de AI extraction
curl http://localhost:8000/ai/stats
```

## Configuração

Variáveis de ambiente (defina no `docker-compose.yml` ou `.env`):

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `SCRAPER_TIMEOUT` | 30 | Timeout de requisição (segundos) |
| `CACHE_TTL` | 300 | TTL do cache (segundos) |
| `LOG_LEVEL` | INFO | Nível de log |
| `MAX_RETRIES` | 3 | Tentativas em caso de erro |
| `RETRY_DELAY` | 2.0 | Delay base entre retries (segundos) |
| `REDIS_URL` | redis://localhost:6379/1 | URL do Redis |
| `ENABLE_AI_FALLBACK` | true | Ativar AI extraction como fallback |
| `AI_FALLBACK_THRESHOLD` | 3 | Mínimo de vagas antes de tentar AI |
| `DEBUG_MODE` | true | Salvar screenshots/HTML de debug |
| `DATAIMPULSE_PROXY_HOST` | — | Host do proxy DataImpulse |
| `DATAIMPULSE_PROXY_PORT` | — | Porta do proxy DataImpulse |
| `DATAIMPULSE_USERNAME` | — | Usuário do proxy |
| `DATAIMPULSE_PASSWORD` | — | Senha do proxy |

## Integração com Next.js

Adicione ao `.env` do portfolio:

```
PYTHON_SCRAPER_URL=http://localhost:8000
```

O aggregator do Next.js:
1. Verifica se o serviço está disponível no startup
2. Usa-o para GeekHunter e Vagas.com.br se disponível
3. Faz fallback para scrapers JS se o serviço estiver offline

## Estrutura do Projeto

```
job-scraper/
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── app/
│   ├── main.py              # FastAPI — todos os endpoints
│   ├── config.py            # Configuração (proxy, timeouts, debug)
│   ├── models.py            # Pydantic models (jobs + web scraping)
│   ├── scrapers/
│   │   ├── base.py          # Classe base
│   │   ├── hybrid_scraper.py # HTTP + Playwright + AI fallback
│   │   ├── geekhunter.py    # GeekHunter (CSS + regex fallback)
│   │   └── vagas.py         # Vagas.com.br (li.vaga + link fallback)
│   ├── agents/
│   │   ├── orchestrator.py
│   │   ├── agno_job_extractor.py
│   │   ├── analyzer_agent.py
│   │   ├── extractor_agent.py
│   │   ├── page_agent.py
│   │   └── search_agent.py
│   └── utils/
│       ├── adaptive_fetcher.py   # HTTP adaptativo (auto Playwright)
│       ├── http_client.py        # HTTP simples com retry (tenacity)
│       ├── content_extractor.py  # readability + markdownify
│       ├── browser.py            # Playwright setup
│       ├── cache.py              # Cache utilities
│       └── parser.py             # HTML parsing helpers
└── README.md
```

## Troubleshooting

**Container não inicia:**
- Verifica se porta 8000 está livre: `lsof -i :8000`
- Playwright precisa de ao menos 1GB de RAM

**Nenhuma vaga retornada:**
- Veja logs: `docker-compose logs job-scraper`
- A estrutura HTML do site pode ter mudado
- Tente aumentar timeout: `SCRAPER_TIMEOUT=60`

**Scraping bloqueado (403/429):**
- Configure o proxy DataImpulse via variáveis de ambiente
- O cliente HTTP (`http_client.py`) faz retry automático com backoff
