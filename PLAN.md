# Plano: Corrigir Scrapers e Melhorar UI de Logs

## Problema Identificado

Os scrapers do GeekHunter e Vagas.com.br não estão encontrando vagas porque os **seletores CSS estão desatualizados**. Os sites provavelmente mudaram a estrutura HTML.

Logs atuais:
```
No job cards found with standard selectors, trying alternatives
Found 0 jobs from geekhunter
No job elements found
Found 0 jobs from vagascombr
```

## Solução

### Parte 1: Corrigir Scrapers (Python)

#### 1.1 Adicionar Debug Mode
- Salvar screenshot e HTML quando não encontrar vagas
- Facilitar diagnóstico de problemas

#### 1.2 Atualizar GeekHunter Scraper
Seletores atuais (provavelmente desatualizados):
- `[data-testid="job-card"]`
- `.job-card`
- `.vaga-card`

Ação: Investigar estrutura atual e atualizar seletores

#### 1.3 Atualizar Vagas.com.br Scraper
Seletores atuais:
- `a.link-detalhes-vaga`
- `.emprVaga`
- `.vaga-local`

Ação: Investigar estrutura atual e atualizar seletores

### Parte 2: Melhorias de UI (Next.js)

#### 2.1 Auto-Refresh de Logs
- Botão toggle para ligar/desligar auto-refresh (a cada 5s)
- Indicador visual quando auto-refresh está ativo

#### 2.2 Mover Scraper Status para Página de Logs
- Criar tab "Scraper" na página /admin/logs
- Manter compatibilidade com página de jobs (componente reutilizável)

#### 2.3 Melhorar Visualização de Logs
- Filtro por nível (ERROR, WARNING, INFO)
- Busca por texto
- Limpar logs

## Tarefas

1. [ ] Adicionar debug mode aos scrapers (salvar HTML quando falhar)
2. [ ] Investigar e atualizar seletores do GeekHunter
3. [ ] Investigar e atualizar seletores do Vagas.com.br
4. [ ] Adicionar botão auto-refresh de logs
5. [ ] Criar tab Scraper na página de logs
6. [ ] Adicionar filtros de logs

## Arquivos a Modificar

**Python Scraper:**
- `job-scraper/app/scrapers/geekhunter.py`
- `job-scraper/app/scrapers/vagas.py`
- `job-scraper/app/main.py`

**Next.js:**
- `src/components/admin/ScraperStatus.tsx`
- `src/app/admin/logs/page.tsx`
- `src/app/api/admin/scraper-logs/route.ts`
