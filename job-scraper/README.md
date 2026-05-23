# Job Scraper Service

> **Parte do [josefelipedev/myportfolio](https://github.com/josefelipedev/myportfolio)**
>
> Serviço Python de scraping de vagas embutido no portfolio. Roda como sidecar Docker
> e é consumido pelo Next.js via `PYTHON_SCRAPER_URL=http://localhost:8000`.

Combina três capacidades em um único serviço:
1. **Scraping de vagas** com Playwright (SPAs React) + AI fallback
2. **Web scraping genérico** — Markdown limpo, crawling BFS, resumos
3. **Proxy automático + robots.txt** para scraping responsável

---

## Fontes de Vagas

| Fonte | País | Estratégia | API Key? |
|-------|------|-----------|----------|
| **GeekHunter** | 🇧🇷 | Playwright + fallback regex href | Não |
| **Vagas.com.br** | 🇧🇷 | Playwright + fallback `a.link-detalhes-vaga` | Não |
| **ITJobs.pt** | 🇵🇹 | API oficial ou HTML scraping (BeautifulSoup) | Opcional (`ITJOBS_API_KEY`) |

---

## Melhorias absorvidas de outros projetos

| Melhoria | Origem | Arquivo |
|----------|--------|---------|
| Parsing melhorado GeekHunter (empresa do URL slug, localização regex) | `clawlite/` | `scrapers/geekhunter.py` |
| Parsing melhorado Vagas.com.br (logo, descrição, nível, data) | `clawlite/` | `scrapers/vagas.py` |
| **User-Agent rotation** (5 browsers/OSes distintos) | `multiscraper/` | `utils/http_client.py` |
| **Proxy automático** (tenta sem → fallback com proxy em 403/429) | `multiscraper/` | `utils/http_client.py` |
| **`fetch_json`** separado para APIs JSON | `multiscraper/` | `utils/http_client.py` |
| **robots.txt checker** com cache 24h | `multiscraper/` | `security/robots.py` |
| Content extractor (readability + markdownify) | `clawlite/` | `utils/content_extractor.py` |
| Endpoints `/scrape`, `/crawl`, `/extract`, `/summarize` | `clawlite/` | `main.py` |

---

## Quick Start

```bash
# Build e start
docker-compose build
docker-compose up -d

# Logs
docker-compose logs -f job-scraper

# Parar
docker-compose down
```

---

## API Endpoints

### 🔍 Job Search

```bash
# Health (inclui status Redis)
curl http://localhost:8000/health

# Listar fontes disponíveis
curl http://localhost:8000/sources

# Buscar em todas as fontes
curl "http://localhost:8000/search?keyword=desenvolvedor&limit=50"

# Buscar fonte específica
curl "http://localhost:8000/search/geekhunter?keyword=python&limit=20"
curl "http://localhost:8000/search/vagascombr?keyword=react&limit=20"
curl "http://localhost:8000/search/itjobs?keyword=typescript&country=pt&limit=20"

# Busca via agentes (pipeline: SearchAgent → PageAgent → AnalyzerAgent → ExtractorAgent)
curl "http://localhost:8000/search/agent?keyword=typescript&source=itjobs"
curl "http://localhost:8000/search/agent/details?keyword=fullstack&source=geekhunter"
```

### 🌐 Web Scraping Genérico

```bash
# Extrair conteúdo de URL como Markdown limpo
curl -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/blog/post"}'

# Extrair com lista de links internos
curl -X POST http://localhost:8000/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Crawl BFS — até N páginas em profundidade D
curl -X POST http://localhost:8000/crawl \
  -H "Content-Type: application/json" \
  -d '{"start_url": "https://example.com", "max_pages": 5, "depth": 2, "delay": 1.0}'

# Resumo truncado de uma URL
curl -X POST http://localhost:8000/summarize \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article", "max_length": 300}'
```

### 📊 Monitoramento

```bash
curl http://localhost:8000/stats          # requests, jobs encontrados, uptime
curl "http://localhost:8000/logs?limit=50"       # logs recentes
curl "http://localhost:8000/logs?level=ERROR"    # só erros
curl http://localhost:8000/ai/stats       # stats do extrator AI
```

### 🐛 Debug (somente com DEBUG_MODE=true)

```bash
curl http://localhost:8000/debug          # lista screenshots e HTMLs salvos
curl http://localhost:8000/debug/geekhunter_123.png  # ver screenshot
DELETE http://localhost:8000/debug        # limpar debug files
```

---

## Configuração

### Variáveis de Ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `SCRAPER_TIMEOUT` | `30` | Timeout de requisição HTTP (segundos) |
| `MAX_RETRIES` | `3` | Tentativas em caso de falha |
| `RETRY_DELAY` | `2.0` | Delay base entre retries (segundos) |
| `LOG_LEVEL` | `INFO` | Nível de log (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `CACHE_TTL` | `300` | TTL do cache em memória (segundos) |
| `ENABLE_AI_FALLBACK` | `true` | Ativar AI extraction quando CSS selectors falham |
| `AI_FALLBACK_THRESHOLD` | `3` | Mínimo de vagas antes de tentar AI |
| `DEBUG_MODE` | `true` | Salvar screenshots e HTML para debug |
| `DEBUG_DIR` | `/app/debug` | Diretório dos arquivos de debug |
| `ITJOBS_API_KEY` | — | Chave da API oficial do ITJobs.pt (opcional) |
| `DATAIMPULSE_PROXY_HOST` | — | Host do proxy para evitar bloqueios |
| `DATAIMPULSE_PROXY_PORT` | — | Porta do proxy |
| `DATAIMPULSE_USERNAME` | — | Usuário do proxy |
| `DATAIMPULSE_PASSWORD` | — | Senha do proxy |

### Integração com Next.js

Adicione ao `.env` do portfolio:

```env
PYTHON_SCRAPER_URL=http://localhost:8000
```

O aggregator TypeScript (`src/lib/jobs/apis/python-scraper.ts`):
1. Verifica `/health` na inicialização
2. Rota GeekHunter e Vagas.com.br pelo serviço Python se disponível
3. Faz fallback para scrapers JS se o serviço estiver offline

---

## Estrutura do Projeto

```
job-scraper/
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
├── app/
│   ├── main.py                    # FastAPI — todos os endpoints
│   ├── config.py                  # Configuração (proxy, timeouts, debug)
│   ├── models.py                  # Pydantic models (jobs + web scraping)
│   ├── scrapers/
│   │   ├── base.py                # Classe base abstrata
│   │   ├── hybrid_scraper.py      # HTTP + Playwright + AI fallback
│   │   ├── geekhunter.py          # 🇧🇷 GeekHunter (CSS + regex fallback)
│   │   ├── vagas.py               # 🇧🇷 Vagas.com.br (li.vaga + link fallback)
│   │   └── itjobs.py              # 🇵🇹 ITJobs.pt (API oficial + HTML fallback)
│   ├── agents/
│   │   ├── orchestrator.py        # Pipeline de agentes
│   │   ├── agno_job_extractor.py  # AI extraction (Together AI / Ollama)
│   │   ├── analyzer_agent.py      # Analisa estrutura da página
│   │   ├── extractor_agent.py     # Extrai vagas do HTML
│   │   ├── page_agent.py          # Busca a página
│   │   └── search_agent.py        # Constrói URL de busca
│   ├── security/
│   │   └── robots.py              # ✅ Verifica robots.txt (cache 24h)
│   └── utils/
│       ├── adaptive_fetcher.py    # HTTP adaptativo (auto Playwright)
│       ├── http_client.py         # ✅ HTTP + UA rotation + proxy automático + fetch_json
│       ├── content_extractor.py   # readability + markdownify
│       ├── browser.py             # Playwright setup
│       ├── cache.py               # Cache em memória
│       └── parser.py              # HTML parsing helpers
└── README.md
```

---

## Como Adicionar um Novo Scraper

```python
# app/scrapers/meusite.py
from scrapers.base import BaseScraper
from models import JobListing, JobSource
from utils.http_client import fetch_html       # HTTP simples (sem JS)
# ou
from scrapers.hybrid_scraper import HybridScraper  # com Playwright

class MeuSiteScraper(BaseScraper):
    name = "meusite"
    base_url = "https://meusite.com.br"

    async def search(self, keyword: str, country: str = "br", limit: int = 50):
        html = await fetch_html(f"{self.base_url}/vagas?q={keyword}")
        # ... parse e retornar List[JobListing]
```

Registre em `main.py`:

```python
from scrapers.meusite import MeuSiteScraper

scrapers = {
    ...,
    "meusite": MeuSiteScraper(),
}
```

---

## Troubleshooting

**Container não sobe:**
```bash
lsof -i :8000   # porta em uso?
docker info     # Docker rodando?
```

**Nenhuma vaga retornada:**
```bash
docker-compose logs job-scraper   # ver erros
# Pode ser que o HTML do site mudou — verificar seletores
# Aumentar timeout: SCRAPER_TIMEOUT=60
```

**Bloqueado (403/429):**
- Configure as variáveis `DATAIMPULSE_*` para ativar proxy automático
- O `http_client.py` tenta sem proxy primeiro, usa proxy só quando bloqueado

**Playwright crashes:**
- O container precisa de ao menos **1 GB de RAM**
- Chromium requer dependências de sistema (já no Dockerfile)
