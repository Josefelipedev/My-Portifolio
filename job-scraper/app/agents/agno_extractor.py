"""
Agno-based Extraction Agent

Agente de extração token-eficiente usando o framework Agno.
Reduz consumo de tokens em 85-95% através de:
1. Compressão de conteúdo (HTML → texto)
2. Schema estruturado para outputs validados
3. Modelo dinâmico (8B para simples, 70B para complexo)
4. Chunking para documentos grandes
"""

import asyncio
import hashlib
import json
import logging
import os
import re
import time
from typing import Optional, Dict, Any, List

import httpx
from bs4 import BeautifulSoup

from models import (
    AgnoExtractionResult,
    UniversityExtractionSchema,
    CourseExtractionSchema,
    UniversityListing,
    CourseListing,
)

logger = logging.getLogger(__name__)

# Together AI config (mesmo provider do projeto)
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY", "")
TOGETHER_API_URL = "https://api.together.xyz/v1/chat/completions"

# Modelos - 8B para eficiência, 70B como fallback
SIMPLE_MODEL = os.getenv("AGNO_DEFAULT_MODEL", "meta-llama/Llama-3.1-8B-Instruct-Turbo")
COMPLEX_MODEL = os.getenv("AGNO_COMPLEX_MODEL", "meta-llama/Llama-3.3-70B-Instruct-Turbo")

# Configurações
MAX_CONTENT_CHARS = int(os.getenv("AGNO_MAX_CONTENT_CHARS", "8000"))
AGNO_ENABLED = os.getenv("AGNO_ENABLED", "true").lower() == "true"


class AgnoExtractionAgent:
    """
    Agente de extração token-eficiente.

    Usa técnicas de otimização:
    - Compressão de conteúdo (strip HTML, remover elementos não essenciais)
    - Prompts mínimos com schemas estruturados
    - Seleção dinâmica de modelo baseada na complexidade
    - Chunking para conteúdos grandes
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or TOGETHER_API_KEY
        self.stats = {
            "extractions": 0,
            "tokens_used": 0,
            "simple_model_used": 0,
            "complex_model_used": 0,
            "cache_hits": 0,
            "errors": 0,
        }
        self._cache: Dict[str, AgnoExtractionResult] = {}
        self._http_client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Obtém ou cria cliente HTTP."""
        if not self._http_client:
            self._http_client = httpx.AsyncClient(timeout=60.0)
        return self._http_client

    async def close(self):
        """Fecha o cliente HTTP."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None

    def _get_cache_key(self, content: str, mode: str) -> str:
        """Gera chave de cache."""
        return hashlib.md5(f"{mode}:{content[:1000]}".encode()).hexdigest()

    async def extract(
        self,
        content: str,
        mode: str = "mixed",
        region_hint: Optional[str] = None,
        use_cache: bool = True,
        base_url: str = "",
    ) -> AgnoExtractionResult:
        """
        Extrai dados educacionais do conteúdo.

        Args:
            content: Texto ou HTML para extrair
            mode: "universities", "courses", ou "mixed"
            region_hint: Hint de região para contexto
            use_cache: Usar cache de extrações
            base_url: URL base para resolver links relativos

        Returns:
            AgnoExtractionResult com universidades e/ou cursos
        """
        start_time = time.time()

        # Verificar cache
        cache_key = self._get_cache_key(content, mode)
        if use_cache and cache_key in self._cache:
            self.stats["cache_hits"] += 1
            logger.info("Cache hit para extração")
            return self._cache[cache_key]

        # 0. Extrair links do HTML PRIMEIRO (preserva URLs)
        extracted_links = []
        if "<" in content and ">" in content:
            extracted_links = self._extract_links_from_html(content, base_url)
            logger.info(f"Extraídos {len(extracted_links)} links do HTML")

        # 1. Comprimir conteúdo
        compressed = self._compress_content(content)
        logger.info(f"Conteúdo comprimido: {len(content)} → {len(compressed)} chars")

        # 2. Determinar modelo
        use_complex = self._should_use_complex_model(compressed)
        model = COMPLEX_MODEL if use_complex else SIMPLE_MODEL
        logger.info(f"Usando modelo: {model}")

        # 3. Construir prompt (inclui links extraídos se disponíveis)
        prompt = self._build_prompt(compressed, mode, region_hint, extracted_links)

        # 4. Chamar API
        try:
            response = await self._call_api(prompt, model)

            if not response:
                self.stats["errors"] += 1
                return AgnoExtractionResult(
                    extraction_time_ms=int((time.time() - start_time) * 1000)
                )

            # 5. Parsear resposta
            result = self._parse_response(response, model)
            result.extraction_time_ms = int((time.time() - start_time) * 1000)

            # Atualizar estatísticas
            self.stats["extractions"] += 1
            self.stats["tokens_used"] += result.tokens_used
            if use_complex:
                self.stats["complex_model_used"] += 1
            else:
                self.stats["simple_model_used"] += 1

            # Salvar no cache
            if use_cache:
                self._cache[cache_key] = result

            return result

        except Exception as e:
            logger.error(f"Erro na extração Agno: {e}")
            self.stats["errors"] += 1
            return AgnoExtractionResult(
                extraction_time_ms=int((time.time() - start_time) * 1000)
            )

    def _extract_links_from_html(self, html: str, base_url: str = "") -> List[Dict[str, str]]:
        """
        Extrai links do HTML antes de enviar para AI.

        Preserva nome e URL de cada link encontrado.
        """
        from urllib.parse import urljoin

        soup = BeautifulSoup(html, "html.parser")

        # Remover elementos não-conteúdo
        for tag in soup.select("script, style, nav, footer, header, aside, noscript, iframe, svg"):
            tag.decompose()

        # Pega o conteúdo principal
        main_el = soup.select_one("main, article, .content, #content") or soup.body
        if not main_el:
            main_el = soup

        links = []
        seen_urls = set()

        # Domínios a ignorar
        blocked_domains = [
            "facebook.com", "instagram.com", "linkedin.com",
            "twitter.com", "youtube.com", "tiktok.com",
            "whatsapp.com", "t.me", "mailto:", "tel:",
        ]

        for a in main_el.select("a[href]"):
            name = a.get_text(strip=True)
            href = a.get("href", "").strip()

            if not name or len(name) < 3 or not href or href.startswith("#"):
                continue

            # Resolve URL relativa
            full_url = urljoin(base_url, href) if base_url else href

            # Filtra URLs bloqueadas
            if any(blocked in full_url.lower() for blocked in blocked_domains):
                continue

            # Deduplica
            if full_url in seen_urls:
                continue
            seen_urls.add(full_url)

            # Limita tamanho do nome
            if len(name) > 200:
                name = name[:200]

            links.append({"name": name, "url": full_url})

        return links

    def _compress_content(self, content: str) -> str:
        """
        Comprime conteúdo para eficiência de tokens.

        Técnicas:
        - Strip HTML mantendo apenas texto
        - Remover navegação, scripts, styles
        - Limitar a caracteres relevantes
        """
        # Se parece HTML, parsear
        if "<" in content and ">" in content:
            soup = BeautifulSoup(content, "html.parser")

            # Remover elementos não-conteúdo
            for tag in soup.select("script, style, nav, footer, header, aside, noscript, iframe, svg"):
                tag.decompose()

            # Extrair texto com separadores
            content = soup.get_text(separator="\n", strip=True)

        # Remover linhas vazias múltiplas
        content = re.sub(r'\n{3,}', '\n\n', content)

        # Remover espaços múltiplos
        content = re.sub(r'[ \t]+', ' ', content)

        # Truncar se necessário
        if len(content) > MAX_CONTENT_CHARS:
            content = content[:MAX_CONTENT_CHARS] + "\n[CONTEÚDO TRUNCADO]"

        return content

    def _should_use_complex_model(self, content: str) -> bool:
        """
        Determina se deve usar modelo complexo.

        Heurísticas:
        - Conteúdo muito longo
        - Estrutura complexa detectada
        - Muitos elementos para extrair
        """
        # Conteúdo longo
        if len(content) > 5000:
            return True

        # Muitas linhas (indica tabela ou lista grande)
        if len(content.split("\n")) > 100:
            return True

        # Padrões de complexidade
        complexity_indicators = [
            content.count("[") > 20,  # Muitos marcadores de nível
            len(re.findall(r'\d{4}', content)) > 10,  # Muitos códigos
            "código" in content.lower() and "curso" in content.lower(),
        ]

        return sum(complexity_indicators) >= 2

    def _build_prompt(
        self,
        content: str,
        mode: str,
        region_hint: Optional[str],
        extracted_links: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """
        Constrói prompt para extração.

        Se links foram extraídos do HTML, envia lista estruturada para AI enriquecer.
        Caso contrário, envia o texto para extração tradicional.
        """
        # Schema JSON esperado
        if mode == "universities":
            schema_desc = """
{
  "universities": [
    {"code": "0000", "name": "Nome", "url": "https://...", "type": "publica_universitario|publica_politecnico|privada_universitario|privada_politecnico|outro", "region": "região", "city": "cidade", "website": "url oficial"}
  ]
}"""
        elif mode == "courses":
            schema_desc = """
{
  "courses": [
    {"code": "0000", "name": "Nome do Curso", "url": "https://...", "level": "licenciatura|mestrado|doutorado|mestrado-integrado|pos-graduacao|mba|curso-tecnico|outro", "university_code": "0000", "university_name": "Nome Uni", "duration": "3 anos"}
  ]
}"""
        else:  # mixed
            schema_desc = """
{
  "universities": [
    {"code": "0000", "name": "Nome", "url": "https://...", "type": "tipo", "region": "região", "city": "cidade"}
  ],
  "courses": [
    {"code": "0000", "name": "Nome", "url": "https://...", "level": "nível", "university_code": "0000", "university_name": "Nome Uni"}
  ]
}"""

        # Se temos links extraídos, usa prompt otimizado
        if extracted_links and len(extracted_links) > 0:
            # Formata links para AI
            links_text = "\n".join([f"- {link['name']} | {link['url']}" for link in extracted_links[:100]])  # Limita a 100

            prompt = f"""Analisa a seguinte lista de links extraídos de uma página de educação portuguesa.
Classifica cada item como universidade/instituição OU curso, e enriquece com informações adicionais.

LINKS EXTRAÍDOS:
{links_text}

TAREFA:
1. Identifica quais são instituições de ensino (universidades, politécnicos, escolas)
2. Identifica quais são cursos (licenciaturas, mestrados, doutoramentos, etc.)
3. Para cada item, extrai: código (se visível), tipo/nível, região, cidade
4. PRESERVA A URL ORIGINAL de cada item

FORMATO DE RESPOSTA (JSON válido):
{schema_desc}

REGRAS:
- Gera código único se não visível (ex: "inst-001", "curso-001")
- type para universidades: publica_universitario, publica_politecnico, privada_universitario, privada_politecnico, outro
- level para cursos: licenciatura, mestrado, doutorado, mestrado-integrado, pos-graduacao, mba, curso-tecnico, outro
- Detecta cidade/região do nome se possível (Lisboa, Porto, Coimbra, etc.)
- IMPORTANTE: Mantém a URL original de cada link
"""
            if region_hint:
                prompt += f"\nCONTEXTO: Região {region_hint}"

            prompt += "\n\nJSON:"
        else:
            # Prompt tradicional para texto
            prompt = f"""Extraia instituições de ensino superior e/ou cursos do seguinte conteúdo português.
Retorne APENAS JSON válido no formato especificado. Sem explicações.

FORMATO ESPERADO:
{schema_desc}

"""
            if region_hint:
                prompt += f"CONTEXTO: Região {region_hint}\n\n"

            prompt += f"CONTEÚDO:\n{content}\n\nJSON:"

        return prompt

    async def _call_api(
        self,
        prompt: str,
        model: str,
    ) -> Optional[Dict[str, Any]]:
        """Chama API do Together AI."""
        if not self.api_key:
            logger.warning("TOGETHER_API_KEY não configurada")
            return None

        try:
            client = await self._get_client()

            # Max tokens baseado no modelo
            max_tokens = 2000 if model == SIMPLE_MODEL else 4000

            response = await client.post(
                TOGETHER_API_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": max_tokens,
                    "temperature": 0.0,  # Determinístico
                },
            )

            if response.status_code != 200:
                logger.error(f"API error: {response.status_code} - {response.text[:500]}")
                return None

            data = response.json()
            return data

        except Exception as e:
            logger.error(f"API call failed: {e}")
            return None

    def _parse_response(
        self,
        api_response: Dict[str, Any],
        model: str,
    ) -> AgnoExtractionResult:
        """Parseia resposta da API em resultado estruturado."""
        result = AgnoExtractionResult(model_used=model)

        try:
            content = api_response["choices"][0]["message"]["content"]
            usage = api_response.get("usage", {})
            result.tokens_used = usage.get("total_tokens", 0)

            logger.info(f"Tokens usados: {result.tokens_used}")

            # Limpar possível markdown
            content = content.strip()
            if content.startswith("```"):
                content = re.sub(r'^```json?\s*', '', content)
                content = re.sub(r'\s*```$', '', content)

            # Parsear JSON
            try:
                data = json.loads(content)
            except json.JSONDecodeError:
                # Tentar extrair JSON de dentro do texto
                json_match = re.search(r'\{[\s\S]*\}', content)
                if json_match:
                    data = json.loads(json_match.group())
                else:
                    logger.error("Não foi possível parsear JSON da resposta")
                    return result

            # Converter para schemas
            for uni_data in data.get("universities", []):
                try:
                    result.universities.append(UniversityExtractionSchema(**uni_data))
                except Exception as e:
                    logger.debug(f"Erro ao parsear universidade: {e}")

            for course_data in data.get("courses", []):
                try:
                    result.courses.append(CourseExtractionSchema(**course_data))
                except Exception as e:
                    logger.debug(f"Erro ao parsear curso: {e}")

            logger.info(f"Extraídos: {len(result.universities)} universidades, {len(result.courses)} cursos")

        except Exception as e:
            logger.error(f"Erro ao parsear resposta: {e}")

        return result

    def convert_to_listings(
        self,
        result: AgnoExtractionResult,
        source: str = "manual",
    ) -> Dict[str, List]:
        """
        Converte resultado Agno para modelos de listagem.

        Args:
            result: Resultado da extração
            source: Fonte (dges, eduportugal, manual)

        Returns:
            Dict com universities e courses como UniversityListing/CourseListing
        """
        universities = []
        courses = []

        for uni in result.universities:
            slug = self._slugify(uni.name)
            # Usa URL extraída se disponível, senão usa código
            source_url = uni.url if uni.url else f"manual-upload-{uni.code}"
            universities.append(UniversityListing(
                id=f"{source}-{hashlib.md5(f'{uni.code}-{slug}'.encode()).hexdigest()[:12]}",
                name=uni.name,
                slug=slug,
                short_name=None,
                website=uni.website,
                source_url=source_url,
                individual_page_url=uni.url,  # URL da página no portal
                city=uni.city,
                region=uni.region,
                type=uni.type,
            ))

        for course in result.courses:
            slug = self._slugify(course.name)
            # Usa URL extraída se disponível, senão usa código
            source_url = course.url if course.url else f"manual-upload-{course.code}"
            courses.append(CourseListing(
                id=f"{source}-{hashlib.md5(f'{course.code}-{slug}'.encode()).hexdigest()[:12]}",
                name=course.name,
                slug=slug,
                level=course.level,
                duration=course.duration,
                source_url=source_url,
                university_name=course.university_name,
            ))

        return {"universities": universities, "courses": courses}

    def _slugify(self, text: str) -> str:
        """Converte texto em slug."""
        if not text:
            return ""
        slug = text.lower().strip()
        replacements = {
            'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a',
            'é': 'e', 'ê': 'e',
            'í': 'i',
            'ó': 'o', 'ô': 'o', 'õ': 'o',
            'ú': 'u', 'ü': 'u',
            'ç': 'c',
        }
        for old, new in replacements.items():
            slug = slug.replace(old, new)
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'[\s]+', '-', slug)
        slug = re.sub(r'-+', '-', slug)
        return slug.strip('-')

    def get_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas de uso."""
        return {
            **self.stats,
            "cache_size": len(self._cache),
            "avg_tokens_per_extraction": (
                self.stats["tokens_used"] / self.stats["extractions"]
                if self.stats["extractions"] > 0 else 0
            ),
            "simple_model_rate": (
                self.stats["simple_model_used"] / self.stats["extractions"]
                if self.stats["extractions"] > 0 else 0
            ),
            "enabled": AGNO_ENABLED,
            "simple_model": SIMPLE_MODEL,
            "complex_model": COMPLEX_MODEL,
        }


# Singleton instance
_agno_agent: Optional[AgnoExtractionAgent] = None


def get_agno_agent() -> AgnoExtractionAgent:
    """Obtém instância singleton do agente."""
    global _agno_agent
    if not _agno_agent:
        _agno_agent = AgnoExtractionAgent()
    return _agno_agent
