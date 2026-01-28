"""
EduPortugal.eu Scraper

Scraper para buscar universidades e cursos em Portugal do site eduportugal.eu.
Suporta todas as categorias de cursos: graduação, mestrado, doutorado, MBA, etc.

Estrutura do site:
- Instituições: /instituicoes-de-ensino/ (paginado)
- Cursos por nível: /cursos-estudo/{level}/ (paginado)

Nota: Usa extração por IA para ser resiliente a mudanças no HTML do site.
"""

import asyncio
import hashlib
import json
import logging
import os
import re
from datetime import datetime
from typing import List, Optional, Callable, Dict, Any
from urllib.parse import urljoin

import httpx
from playwright.async_api import async_playwright, Browser
from bs4 import BeautifulSoup

from models import UniversityListing, CourseListing, CourseLevel

logger = logging.getLogger(__name__)

# Configuração da Together AI (mesma API key do projeto principal)
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY", "")
TOGETHER_API_URL = "https://api.together.xyz/v1/chat/completions"
AI_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo"

# URL base configurável via variável de ambiente
EDUPORTUGAL_BASE_URL = os.getenv("EDUPORTUGAL_BASE_URL", "https://eduportugal.eu")


class EduPortugalScraper:
    """
    Scraper para eduportugal.eu - Universidades e Cursos em Portugal.

    Características:
    - Rate limiting: 2 segundos entre requisições
    - Suporte a paginação automática
    - Callback de progresso para tracking
    - URL base configurável via EDUPORTUGAL_BASE_URL
    """

    name = "eduportugal"
    base_url = EDUPORTUGAL_BASE_URL

    # Mapeamento de níveis de curso para URLs
    COURSE_LEVELS = {
        "licenciatura": "/cursos-estudo/licenciatura/",
        "mestrado": "/cursos-estudo/mestrado/",
        "mestrado-integrado": "/cursos-estudo/mestrado-integrado/",
        "doutorado": "/cursos-estudo/doutorado/",
        "pos-doutorado": "/cursos-estudo/pos-doutorado/",
        "mba": "/cursos-estudo/mba/",
        "pos-graduacao": "/cursos-estudo/pos-graduacao/",
        "curso-tecnico": "/cursos-estudo/cursos-tecnicos-profissionais/",
        "b-learning": "/cursos-estudo/b-learning/",
        "e-learning": "/cursos-estudo/e-learning/",
        "formacao-executiva": "/cursos-estudo/formacao-executiva-mba/",
        "especializacao": "/cursos-estudo/cursos-de-especializacao/",
    }

    # Delay entre requisições (segundos)
    RATE_LIMIT_DELAY = 2.0

    def __init__(self):
        self.browser: Optional[Browser] = None
        self._progress_callback: Optional[Callable] = None

    def set_progress_callback(self, callback: Callable):
        """Define callback para atualizações de progresso."""
        self._progress_callback = callback

    async def _report_progress(self, progress: Dict[str, Any]):
        """Reporta progresso via callback."""
        if self._progress_callback:
            try:
                if asyncio.iscoroutinefunction(self._progress_callback):
                    await self._progress_callback(progress)
                else:
                    self._progress_callback(progress)
            except Exception as e:
                logger.debug(f"Erro ao reportar progresso: {e}")

    def generate_id(self, unique_part: str) -> str:
        """Gera ID único a partir de uma string."""
        return f"{self.name}-{hashlib.md5(unique_part.encode()).hexdigest()[:12]}"

    def _save_debug_html(self, html: str, filename: str):
        """Salva HTML para debug quando não encontrar resultados."""
        debug_dir = "/app/data/debug"
        os.makedirs(debug_dir, exist_ok=True)
        filepath = os.path.join(debug_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html)
        logger.info(f"Debug HTML saved to {filepath}")

    async def _call_ai(self, prompt: str, max_tokens: int = 4000) -> Optional[str]:
        """
        Chama a API Together AI para extrair dados.

        Args:
            prompt: O prompt para a IA
            max_tokens: Máximo de tokens na resposta

        Returns:
            Resposta da IA ou None se falhar
        """
        if not TOGETHER_API_KEY:
            logger.warning("TOGETHER_API_KEY não configurada - usando extração tradicional")
            return None

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    TOGETHER_API_URL,
                    headers={
                        "Authorization": f"Bearer {TOGETHER_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": AI_MODEL,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": max_tokens,
                        "temperature": 0.1,
                    },
                )

                if response.status_code == 200:
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
                else:
                    logger.error(f"AI API error: {response.status_code} - {response.text}")
                    return None

        except Exception as e:
            logger.error(f"AI call failed: {e}")
            return None

    def _get_universities_extraction_prompt(self, html_content: str) -> str:
        """Gera prompt para extrair universidades do HTML."""
        # Limpa o HTML e pega só o texto relevante
        soup = BeautifulSoup(html_content, "lxml")

        # Remove scripts e styles
        for tag in soup.select("script, style, nav, footer, header"):
            tag.decompose()

        text_content = soup.get_text(separator="\n", strip=True)
        # Limita o tamanho
        text_content = text_content[:15000]

        return f"""Você é um especialista em extrair dados de páginas web de universidades portuguesas.

Analise o conteúdo abaixo de uma página de listagem de instituições de ensino em Portugal e extraia TODAS as universidades/instituições encontradas.

CONTEÚDO DA PÁGINA:
{text_content}

Para cada instituição encontrada, extraia:
- name: Nome completo da instituição
- slug: Identificador único baseado no nome (ex: "universidade-do-porto")
- city: Cidade (se mencionada)
- description: Breve descrição (se disponível)

Responda APENAS com um JSON válido no formato:
{{
  "institutions": [
    {{
      "name": "Nome da Instituição",
      "slug": "nome-da-instituicao",
      "city": "Cidade" ou null,
      "description": "Descrição" ou null,
      "source_url": "URL se encontrada" ou null
    }}
  ]
}}

IMPORTANTE:
- Extraia TODAS as instituições mencionadas, mesmo que apareçam apenas como links
- Não invente dados - se não encontrar, coloque null
- Gere o slug a partir do nome (lowercase, hífens no lugar de espaços)
- Retorne um array vazio se não encontrar nenhuma instituição"""

    def _get_courses_extraction_prompt(self, html_content: str, level: str) -> str:
        """Gera prompt para extrair cursos do HTML."""
        soup = BeautifulSoup(html_content, "lxml")

        # Remove scripts e styles
        for tag in soup.select("script, style, nav, footer, header"):
            tag.decompose()

        text_content = soup.get_text(separator="\n", strip=True)
        text_content = text_content[:15000]

        return f"""Você é um especialista em extrair dados de páginas web de cursos universitários portugueses.

Analise o conteúdo abaixo de uma página de listagem de cursos de {level} em Portugal e extraia TODOS os cursos encontrados.

CONTEÚDO DA PÁGINA:
{text_content}

Para cada curso encontrado, extraia:
- name: Nome completo do curso
- slug: Identificador único baseado no nome
- university_name: Nome da universidade/instituição
- city: Cidade (se mencionada)
- duration: Duração (se mencionada)
- description: Breve descrição (se disponível)

Responda APENAS com um JSON válido no formato:
{{
  "courses": [
    {{
      "name": "Nome do Curso",
      "slug": "nome-do-curso",
      "university_name": "Nome da Universidade" ou null,
      "city": "Cidade" ou null,
      "duration": "2 anos" ou null,
      "description": "Descrição" ou null,
      "source_url": "URL se encontrada" ou null
    }}
  ]
}}

IMPORTANTE:
- O nível destes cursos é: {level}
- Extraia TODOS os cursos mencionados
- Não invente dados - se não encontrar, coloque null
- Gere o slug a partir do nome (lowercase, hífens no lugar de espaços)
- Retorne um array vazio se não encontrar nenhum curso"""

    async def _extract_universities_with_ai(self, html: str) -> List[UniversityListing]:
        """
        Extrai universidades usando IA.

        Args:
            html: HTML da página

        Returns:
            Lista de UniversityListing
        """
        prompt = self._get_universities_extraction_prompt(html)
        response = await self._call_ai(prompt)

        if not response:
            return []

        try:
            # Encontra o JSON na resposta
            json_match = re.search(r'\{[\s\S]*\}', response)
            if not json_match:
                logger.error("No JSON found in AI response for universities")
                return []

            data = json.loads(json_match.group())
            institutions = data.get("institutions", [])

            universities = []
            for inst in institutions:
                name = inst.get("name", "").strip()
                if not name or len(name) < 3:
                    continue

                slug = inst.get("slug") or self._slugify(name)
                source_url = inst.get("source_url")

                if not source_url:
                    source_url = f"{self.base_url}/instituicoes-de-ensino/{slug}/"

                universities.append(UniversityListing(
                    id=self.generate_id(slug),
                    name=name,
                    slug=slug,
                    description=inst.get("description"),
                    city=inst.get("city"),
                    logo_url=None,
                    source_url=source_url,
                ))

            logger.info(f"AI extracted {len(universities)} universities")
            return universities

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response: {e}")
            return []
        except Exception as e:
            logger.error(f"Error extracting universities with AI: {e}")
            return []

    async def _extract_courses_with_ai(self, html: str, level: str) -> List[CourseListing]:
        """
        Extrai cursos usando IA.

        Args:
            html: HTML da página
            level: Nível do curso

        Returns:
            Lista de CourseListing
        """
        prompt = self._get_courses_extraction_prompt(html, level)
        response = await self._call_ai(prompt)

        if not response:
            return []

        try:
            json_match = re.search(r'\{[\s\S]*\}', response)
            if not json_match:
                logger.error("No JSON found in AI response for courses")
                return []

            data = json.loads(json_match.group())
            courses_data = data.get("courses", [])

            courses = []
            for course_data in courses_data:
                name = course_data.get("name", "").strip()
                if not name or len(name) < 3:
                    continue

                slug = course_data.get("slug") or self._slugify(name)
                source_url = course_data.get("source_url")

                if not source_url:
                    source_url = f"{self.base_url}/cursos-estudo/{slug}/"

                university_name = course_data.get("university_name")
                university_slug = self._slugify(university_name) if university_name else None

                courses.append(CourseListing(
                    id=self.generate_id(slug),
                    name=name,
                    slug=slug,
                    description=course_data.get("description"),
                    level=level,
                    duration=course_data.get("duration"),
                    city=course_data.get("city"),
                    modality=None,
                    start_date=None,
                    source_url=source_url,
                    university_name=university_name,
                    university_slug=university_slug,
                ))

            logger.info(f"AI extracted {len(courses)} courses for level {level}")
            return courses

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response: {e}")
            return []
        except Exception as e:
            logger.error(f"Error extracting courses with AI: {e}")
            return []

    def _slugify(self, text: str) -> str:
        """Converte texto em slug."""
        if not text:
            return ""
        # Lowercase e substitui espaços por hífens
        slug = text.lower().strip()
        # Remove acentos
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
        # Remove caracteres especiais
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'[\s]+', '-', slug)
        slug = re.sub(r'-+', '-', slug)
        return slug.strip('-')

    async def _get_browser(self) -> Browser:
        """Obtém ou cria instância do browser."""
        if not self.browser:
            playwright = await async_playwright().start()
            self.browser = await playwright.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                ],
            )
        return self.browser

    async def _fetch_page(self, url: str) -> str:
        """
        Busca uma página com rate limiting.

        Args:
            url: URL da página

        Returns:
            HTML da página
        """
        browser = await self._get_browser()
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="pt-PT",
        )

        try:
            page = await context.new_page()
            await page.goto(url, wait_until="networkidle", timeout=30000)

            # Rate limiting
            await asyncio.sleep(self.RATE_LIMIT_DELAY)

            html = await page.content()
            return html
        finally:
            await context.close()

    def _get_total_pages(self, html: str) -> int:
        """
        Extrai o número total de páginas da paginação.

        Args:
            html: HTML da página

        Returns:
            Número total de páginas
        """
        soup = BeautifulSoup(html, "lxml")
        max_page = 1

        # Procura links de paginação
        pagination_links = soup.select(
            ".pagination a, .page-numbers a, nav.pagination a, "
            ".nav-links a, a.page-numbers"
        )

        for link in pagination_links:
            text = link.get_text(strip=True)

            # Número direto
            if text.isdigit():
                max_page = max(max_page, int(text))

            # Verifica href para número de página
            href = link.get("href", "")
            page_match = re.search(r'/page/(\d+)', href)
            if page_match:
                max_page = max(max_page, int(page_match.group(1)))

        # Também verifica texto "Página X de Y"
        page_info = soup.find(string=re.compile(r'[Pp]ágina?\s+\d+\s+de\s+\d+'))
        if page_info:
            match = re.search(r'de\s+(\d+)', page_info)
            if match:
                max_page = max(max_page, int(match.group(1)))

        return max_page

    # ==========================================
    # Scraping de Universidades
    # ==========================================

    async def scrape_universities(
        self,
        max_pages: Optional[int] = None,
        progress_callback: Optional[Callable] = None,
        use_ai: bool = True
    ) -> List[UniversityListing]:
        """
        Faz scraping de todas as universidades do EduPortugal.

        Args:
            max_pages: Limite de páginas (None = todas)
            progress_callback: Callback para atualizações de progresso
            use_ai: Se True, usa IA como fallback quando extração tradicional falha

        Returns:
            Lista de UniversityListing
        """
        if progress_callback:
            self._progress_callback = progress_callback

        universities: List[UniversityListing] = []
        base_url = f"{self.base_url}/instituicoes-de-ensino/"

        # Primeira página
        logger.info("Buscando universidades - página 1...")
        html = await self._fetch_page(base_url)
        total_pages = self._get_total_pages(html)

        if max_pages:
            total_pages = min(total_pages, max_pages)

        logger.info(f"Total de páginas de universidades: {total_pages}")

        # Parse da primeira página - tenta extração tradicional primeiro
        page_universities = self._parse_universities_page(html)

        # Se não encontrou nada e AI está habilitado, tenta com IA
        if not page_universities and use_ai:
            logger.info("Extração tradicional falhou - usando IA...")
            page_universities = await self._extract_universities_with_ai(html)

        universities.extend(page_universities)

        await self._report_progress({
            "type": "universities",
            "current_page": 1,
            "total_pages": total_pages,
            "found": len(universities),
            "extraction_method": "ai" if not self._parse_universities_page(html) and page_universities else "traditional",
        })

        # Páginas restantes
        for page_num in range(2, total_pages + 1):
            url = f"{base_url}page/{page_num}/"
            logger.info(f"Buscando universidades - página {page_num}/{total_pages}...")

            try:
                html = await self._fetch_page(url)
                page_universities = self._parse_universities_page(html)

                # Fallback para IA se necessário
                if not page_universities and use_ai:
                    logger.info(f"Página {page_num}: usando IA para extração...")
                    page_universities = await self._extract_universities_with_ai(html)

                universities.extend(page_universities)

                await self._report_progress({
                    "type": "universities",
                    "current_page": page_num,
                    "total_pages": total_pages,
                    "found": len(universities),
                })

            except Exception as e:
                logger.error(f"Erro na página {page_num}: {e}")
                continue

        logger.info(f"Total de universidades encontradas: {len(universities)}")
        return universities

    def _parse_universities_page(self, html: str) -> List[UniversityListing]:
        """
        Faz parsing de uma página de listagem de universidades.

        Extrai diretamente do HTML (0 tokens de AI):
        - Nome da instituição
        - Logo/imagem
        - Website oficial (ex: www.ipmaia.pt)
        - Link no EduPortugal

        Args:
            html: HTML da página

        Returns:
            Lista de UniversityListing
        """
        universities: List[UniversityListing] = []
        soup = BeautifulSoup(html, "lxml")

        # Seletores para cards de universidades - atualizado para nova estrutura
        cards = soup.select(
            "article.type-instituicao, .institution-card, .university-item, "
            ".listing-item, article[class*='instituicao'], "
            ".wpbf-post-style-boxed, "
            # Novos seletores Elementor/Jet
            ".elementor-post, .jet-listing-grid__item, "
            ".e-loop-item, div[data-elementor-type='loop-item'], "
            ".elementor-posts-container article, "
            ".jet-smart-listing__post, .jet-posts__item, "
            # Containers genéricos com imagem e link
            ".elementor-widget-container:has(img):has(a[href*='instituicao'])"
        )

        # Se não encontrar cards específicos, tenta artigos genéricos
        if not cards:
            cards = soup.select("article, .elementor-element a[href*='/instituicao']")

        # Estratégia alternativa: buscar grupos de elementos relacionados
        if not cards or len(cards) < 2:
            cards = self._find_university_groups(soup)

        # Debug: Log what was found
        logger.info(f"Universities page: Found {len(cards)} potential cards using primary selectors")

        # Se não encontrar com seletores primários, tenta extrair de links
        if not cards:
            # Estratégia alternativa: buscar todos os links para instituições
            inst_links = soup.select("a[href*='/instituicoes-de-ensino/'][href$='/']")
            inst_links = [link for link in inst_links if link.get('href', '').count('/') > 4]

            logger.info(f"Alternative strategy: Found {len(inst_links)} institution links")

            # Salva HTML para debug
            self._save_debug_html(html, "universities_debug.html")

            # Extrai universidades dos links diretamente
            seen_urls = set()
            for link in inst_links:
                href = link.get('href', '')
                if href in seen_urls or not href:
                    continue
                seen_urls.add(href)

                name = link.get_text(strip=True)
                if not name or len(name) < 3:
                    # Tenta pegar o texto do parent
                    parent = link.find_parent()
                    if parent:
                        name = parent.get_text(strip=True)

                if name and len(name) > 2:
                    slug = href.rstrip("/").split("/")[-1]
                    if slug and slug != "instituicoes-de-ensino":
                        full_url = href if href.startswith("http") else urljoin(self.base_url, href)
                        universities.append(UniversityListing(
                            id=self.generate_id(slug),
                            name=name[:200],  # Limita tamanho
                            slug=slug,
                            description=None,
                            city=None,
                            logo_url=None,
                            source_url=full_url,
                            individual_page_url=full_url,  # URL da página individual
                        ))

            if universities:
                logger.info(f"Extracted {len(universities)} universities from links")
                return universities

        for card in cards:
            try:
                # Nome e link
                name_elem = card.select_one(
                    "h2 a, h3 a, .entry-title a, .institution-name a, "
                    "a.listing-title"
                )
                if not name_elem:
                    continue

                name = name_elem.get_text(strip=True)
                url = name_elem.get("href", "")

                if not url or not name:
                    continue

                if not url.startswith("http"):
                    url = urljoin(self.base_url, url)

                # Slug da URL
                slug = url.rstrip("/").split("/")[-1]

                # Descrição
                desc_elem = card.select_one(
                    ".excerpt, .entry-summary, .description, "
                    ".listing-excerpt, p"
                )
                description = desc_elem.get_text(strip=True) if desc_elem else None

                # Localização/Cidade
                location_elem = card.select_one(
                    ".location, .city, .cidade, .address, "
                    "[class*='location'], [class*='cidade']"
                )
                city = None
                if location_elem:
                    location_text = location_elem.get_text(strip=True)
                    # Extrai cidade do texto
                    city = self._extract_city(location_text)

                # Logo
                logo_elem = card.select_one(
                    "img.logo, .institution-logo img, .listing-img img, "
                    ".post-thumbnail img, img"
                )
                logo_url = None
                if logo_elem:
                    logo_url = logo_elem.get("src") or logo_elem.get("data-src")
                    if logo_url and not logo_url.startswith("http"):
                        logo_url = urljoin(self.base_url, logo_url)

                # Website oficial (ex: www.ipmaia.pt) - extrai diretamente do card
                website = self._extract_website_from_card(card)

                universities.append(UniversityListing(
                    id=self.generate_id(slug),
                    name=name,
                    slug=slug,
                    description=description,
                    city=city,
                    logo_url=logo_url,
                    source_url=url,
                    individual_page_url=url,  # URL da página individual no EduPortugal
                    website=website,
                ))

            except Exception as e:
                logger.debug(f"Erro ao parsear card de universidade: {e}")
                continue

        return universities

    def _extract_website_from_card(self, card) -> Optional[str]:
        """
        Extrai o website oficial de um card de universidade.

        O EduPortugal mostra o website diretamente no card (ex: www.ipmaia.pt).
        Esta extração é GRATUITA (0 tokens de AI).
        """
        # Padrões de URL de website
        website_patterns = [
            r'(?:www\.)?[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?',
        ]

        # 1. Procura links externos (não EduPortugal)
        for link in card.find_all('a', href=True):
            href = link.get('href', '')
            if href and 'eduportugal' not in href.lower():
                if href.startswith('http') and not any(x in href for x in ['facebook', 'instagram', 'linkedin', 'twitter', 'youtube']):
                    return href

        # 2. Procura texto que parece URL (www.xxx.pt)
        card_text = card.get_text()
        for pattern in website_patterns:
            matches = re.findall(pattern, card_text)
            for match in matches:
                # Filtra domínios do próprio EduPortugal
                if 'eduportugal' not in match.lower() and '.' in match:
                    # Normaliza URL
                    if not match.startswith('http'):
                        match = f"https://{match}"
                    return match

        return None

    def _find_university_groups(self, soup) -> list:
        """
        Encontra grupos de elementos que representam universidades.

        Usa heurística para detectar padrões repetidos (imagem + nome + link).
        """
        groups = []

        # Procura containers com imagem e link para instituição
        containers = soup.find_all(['div', 'article', 'section'], recursive=True)

        for container in containers:
            # Verifica se tem imagem E link para instituição
            has_img = container.find('img')
            has_inst_link = container.find('a', href=re.compile(r'/instituicoes-de-ensino/[^/]+/?$'))

            if has_img and has_inst_link:
                # Verifica se não é um container muito grande (página inteira)
                text_len = len(container.get_text(strip=True))
                if 10 < text_len < 500:  # Tamanho razoável para um card
                    groups.append(container)

        # Remove duplicatas (containers aninhados)
        unique_groups = []
        for group in groups:
            is_nested = False
            for other in groups:
                if other != group and group in other.descendants:
                    is_nested = True
                    break
            if not is_nested:
                unique_groups.append(group)

        logger.info(f"Found {len(unique_groups)} university groups using heuristics")
        return unique_groups

    def _extract_city(self, text: str) -> Optional[str]:
        """Extrai cidade de um texto de localização."""
        if not text:
            return None

        # Lista de cidades portuguesas comuns
        cities = [
            "Lisboa", "Porto", "Coimbra", "Braga", "Aveiro", "Faro",
            "Évora", "Setúbal", "Funchal", "Guimarães", "Viseu",
            "Leiria", "Santarém", "Castelo Branco", "Bragança",
            "Vila Real", "Viana do Castelo", "Portalegre", "Beja"
        ]

        for city in cities:
            if city.lower() in text.lower():
                return city

        # Retorna o texto limpo se não encontrar cidade conhecida
        return text.split(",")[0].strip() if "," in text else text.strip()

    # ==========================================
    # Scraping de Cursos
    # ==========================================

    async def scrape_courses(
        self,
        levels: Optional[List[str]] = None,
        max_pages_per_level: Optional[int] = None,
        progress_callback: Optional[Callable] = None,
        use_ai: bool = True
    ) -> List[CourseListing]:
        """
        Faz scraping de cursos de todos ou alguns níveis.

        Args:
            levels: Lista de níveis para buscar (None = todos)
            max_pages_per_level: Limite de páginas por nível (None = todas)
            progress_callback: Callback para atualizações de progresso
            use_ai: Se True, usa IA como fallback quando extração tradicional falha

        Returns:
            Lista de CourseListing
        """
        if progress_callback:
            self._progress_callback = progress_callback

        all_courses: List[CourseListing] = []
        levels_to_scrape = levels or list(self.COURSE_LEVELS.keys())

        for level in levels_to_scrape:
            if level not in self.COURSE_LEVELS:
                logger.warning(f"Nível desconhecido: {level}")
                continue

            logger.info(f"Buscando cursos de nível: {level}")

            courses = await self._scrape_courses_by_level(
                level=level,
                max_pages=max_pages_per_level,
                use_ai=use_ai,
            )
            all_courses.extend(courses)

            await self._report_progress({
                "type": "courses",
                "current_level": level,
                "level_courses": len(courses),
                "total_courses": len(all_courses),
            })

        logger.info(f"Total de cursos encontrados: {len(all_courses)}")
        return all_courses

    async def _scrape_courses_by_level(
        self,
        level: str,
        max_pages: Optional[int] = None,
        use_ai: bool = True,
    ) -> List[CourseListing]:
        """
        Faz scraping de cursos de um nível específico.

        Args:
            level: Nível do curso
            max_pages: Limite de páginas (None = todas)
            use_ai: Se True, usa IA como fallback quando extração tradicional falha

        Returns:
            Lista de CourseListing
        """
        courses: List[CourseListing] = []
        path = self.COURSE_LEVELS[level]
        base_url = f"{self.base_url}{path}"

        # Primeira página
        logger.info(f"Buscando {level} - página 1...")
        html = await self._fetch_page(base_url)
        total_pages = self._get_total_pages(html)

        if max_pages:
            total_pages = min(total_pages, max_pages)

        logger.info(f"Total de páginas para {level}: {total_pages}")

        # Parse da primeira página - tenta tradicional primeiro
        page_courses = self._parse_courses_page(html, level)

        # Fallback para IA se não encontrou nada
        if not page_courses and use_ai:
            logger.info(f"{level} página 1: usando IA para extração...")
            page_courses = await self._extract_courses_with_ai(html, level)

        courses.extend(page_courses)

        await self._report_progress({
            "type": "courses_page",
            "level": level,
            "current_page": 1,
            "total_pages": total_pages,
            "level_courses": len(courses),
        })

        # Páginas restantes
        for page_num in range(2, total_pages + 1):
            url = f"{base_url}page/{page_num}/"
            logger.info(f"Buscando {level} - página {page_num}/{total_pages}...")

            try:
                html = await self._fetch_page(url)
                page_courses = self._parse_courses_page(html, level)

                # Fallback para IA
                if not page_courses and use_ai:
                    logger.info(f"{level} página {page_num}: usando IA para extração...")
                    page_courses = await self._extract_courses_with_ai(html, level)

                courses.extend(page_courses)

                await self._report_progress({
                    "type": "courses_page",
                    "level": level,
                    "current_page": page_num,
                    "total_pages": total_pages,
                    "level_courses": len(courses),
                })

            except Exception as e:
                logger.error(f"Erro na página {page_num} de {level}: {e}")
                continue

        return courses

    def _parse_courses_page(self, html: str, level: str) -> List[CourseListing]:
        """
        Faz parsing de uma página de listagem de cursos.

        Args:
            html: HTML da página
            level: Nível do curso

        Returns:
            Lista de CourseListing
        """
        courses: List[CourseListing] = []
        soup = BeautifulSoup(html, "lxml")

        # Seletores para cards de cursos - atualizado para nova estrutura
        cards = soup.select(
            "article.type-curso, .course-card, .curso-item, "
            ".listing-item, article[class*='curso'], "
            "tr.event-list-content, .wpbf-post-style-boxed, "
            # Novos seletores para Elementor/JetEngine
            ".elementor-post, .jet-listing-grid__item, "
            ".e-loop-item, div[data-elementor-type='loop-item'], "
            ".elementor-posts-container article, "
            ".jet-smart-listing__post, .jet-posts__item"
        )

        # Se não encontrar cards específicos, tenta artigos genéricos
        if not cards:
            cards = soup.select("article, .elementor-element a[href*='/curso']")

        # Debug: Log what was found
        logger.debug(f"Courses page ({level}): Found {len(cards)} potential cards")
        if not cards:
            # Find any links that might be courses
            course_links = soup.select("a[href*='/curso']")
            logger.debug(f"Found {len(course_links)} course-related links")
            for link in course_links[:5]:
                logger.debug(f"  Link: {link.get('href')} - {link.get_text(strip=True)[:50]}")

        for card in cards:
            try:
                # Nome e link
                name_elem = card.select_one(
                    "h2 a, h3 a, .entry-title a, .course-name a, "
                    "a.listing-title, td a"
                )
                if not name_elem:
                    continue

                name = name_elem.get_text(strip=True)
                url = name_elem.get("href", "")

                if not url or not name:
                    continue

                if not url.startswith("http"):
                    url = urljoin(self.base_url, url)

                # Slug da URL
                slug = url.rstrip("/").split("/")[-1]

                # Universidade
                uni_elem = card.select_one(
                    ".university-name, .instituicao, .school, "
                    "[class*='university'], [class*='instituicao'], "
                    ".event-location, td:nth-child(2)"
                )
                university_name = None
                university_slug = None
                if uni_elem:
                    university_name = uni_elem.get_text(strip=True)
                    uni_link = uni_elem.select_one("a") if uni_elem else None
                    if uni_link:
                        uni_href = uni_link.get("href", "")
                        university_slug = uni_href.rstrip("/").split("/")[-1]

                # Localização/Cidade
                location_elem = card.select_one(
                    ".location, .cidade, .local, "
                    "[class*='location'], [class*='cidade']"
                )
                city = None
                if location_elem:
                    city = self._extract_city(location_elem.get_text(strip=True))

                # Duração
                duration_elem = card.select_one(
                    ".duration, .duracao, [class*='duration']"
                )
                duration = duration_elem.get_text(strip=True) if duration_elem else None

                # Descrição
                desc_elem = card.select_one(
                    ".excerpt, .entry-summary, .description, p"
                )
                description = desc_elem.get_text(strip=True) if desc_elem else None

                # Modalidade
                modality_elem = card.select_one(
                    ".modality, .modalidade, [class*='modalidade']"
                )
                modality = modality_elem.get_text(strip=True) if modality_elem else None

                # Data de início
                start_elem = card.select_one(
                    ".start-date, .inicio, [class*='start'], "
                    ".event-date"
                )
                start_date = start_elem.get_text(strip=True) if start_elem else None

                courses.append(CourseListing(
                    id=self.generate_id(slug),
                    name=name,
                    slug=slug,
                    description=description,
                    level=level,
                    duration=duration,
                    city=city,
                    modality=modality,
                    start_date=start_date,
                    source_url=url,
                    university_name=university_name,
                    university_slug=university_slug,
                ))

            except Exception as e:
                logger.debug(f"Erro ao parsear card de curso: {e}")
                continue

        return courses

    async def scrape_course_details(self, url: str) -> Optional[Dict[str, Any]]:
        """
        Busca detalhes completos de um curso individual.

        Args:
            url: URL da página do curso

        Returns:
            Dicionário com detalhes do curso
        """
        try:
            html = await self._fetch_page(url)
            soup = BeautifulSoup(html, "lxml")

            details = {}

            # Título
            title_elem = soup.select_one("h1, .entry-title, .course-title")
            if title_elem:
                details["name"] = title_elem.get_text(strip=True)

            # Descrição completa
            content_elem = soup.select_one(
                ".entry-content, .course-description, "
                ".description, article"
            )
            if content_elem:
                details["description"] = content_elem.get_text(strip=True)[:2000]

            # Extrai metadados da página
            meta_sections = soup.select(
                ".course-meta, .meta-info, dl, "
                ".course-details, table"
            )

            for section in meta_sections:
                # Duração
                duration_match = section.find(string=re.compile(r'[Dd]ura[çc][ãa]o', re.I))
                if duration_match:
                    parent = duration_match.find_parent()
                    if parent:
                        details["duration"] = parent.get_text(strip=True)

                # Créditos ECTS
                credits_match = section.find(string=re.compile(r'ECTS|[Cc]r[ée]ditos', re.I))
                if credits_match:
                    text = credits_match.find_parent().get_text() if credits_match.find_parent() else ""
                    ects_num = re.search(r'(\d+)\s*(?:ECTS|cr)', text, re.I)
                    if ects_num:
                        details["credits"] = int(ects_num.group(1))

                # Idioma
                lang_match = section.find(string=re.compile(r'[Ii]dioma|[Ll][ií]ngua', re.I))
                if lang_match:
                    details["language"] = lang_match.find_parent().get_text(strip=True) if lang_match.find_parent() else None

                # Preço/Propinas
                price_match = section.find(string=re.compile(r'[Pp]ropinas?|[Pp]re[çc]o|[Vv]alor', re.I))
                if price_match:
                    details["price"] = price_match.find_parent().get_text(strip=True) if price_match.find_parent() else None

            # URL oficial
            official_link = soup.select_one(
                "a[href*='candidatura'], a[href*='apply'], "
                "a[href*='.edu.pt'], a[href*='.pt/cursos']"
            )
            if official_link:
                details["official_url"] = official_link.get("href")

            return details

        except Exception as e:
            logger.error(f"Erro ao buscar detalhes do curso {url}: {e}")
            return None

    async def close(self):
        """Fecha instância do browser."""
        if self.browser:
            await self.browser.close()
            self.browser = None

    # ==========================================
    # Hierarchical Scraping (University → Courses)
    # ==========================================

    async def scrape_university_courses(
        self,
        university: "UniversityListing",
        use_ai: bool = True,
    ) -> List[CourseListing]:
        """
        Visita página individual de uma universidade e extrai seus cursos.

        Args:
            university: Universidade com source_url para visitar
            use_ai: Usar AI como fallback

        Returns:
            Lista de cursos com university_name e university_slug preenchidos
        """
        if not university.source_url:
            logger.warning(f"Universidade {university.name} sem source_url")
            return []

        logger.info(f"Buscando cursos da universidade: {university.name}")

        try:
            html = await self._fetch_page(university.source_url)
            courses = self._parse_university_page_courses(html, university)

            # Fallback para AI se necessário
            if not courses and use_ai:
                logger.info(f"Usando AI para extrair cursos de {university.name}")
                courses = await self._extract_university_courses_with_ai(html, university)

            logger.info(f"Encontrados {len(courses)} cursos para {university.name}")
            return courses

        except Exception as e:
            logger.error(f"Erro ao buscar cursos de {university.name}: {e}")
            return []

    def _parse_university_page_courses(
        self,
        html: str,
        university: "UniversityListing",
    ) -> List[CourseListing]:
        """
        Parse de cursos na página individual de uma universidade.

        Args:
            html: HTML da página da universidade
            university: Dados da universidade para vincular

        Returns:
            Lista de CourseListing com vínculo à universidade
        """
        courses = []
        soup = BeautifulSoup(html, "lxml")

        # Seletores para links de cursos na página da universidade
        course_selectors = [
            "a[href*='/cursos/']",
            "a[href*='/curso/']",
            "a[href*='/course/']",
            ".course-item a",
            ".curso-item a",
            ".listing-courses a",
            "article.course a",
            ".elementor-post a[href*='curso']",
        ]

        seen_urls = set()
        course_links = []

        for selector in course_selectors:
            links = soup.select(selector)
            for link in links:
                href = link.get("href", "")
                if href and href not in seen_urls and "eduportugal" in href.lower():
                    seen_urls.add(href)
                    course_links.append(link)

        logger.info(f"Encontrados {len(course_links)} links de cursos na página de {university.name}")

        for link in course_links:
            try:
                href = link.get("href", "")
                name = link.get_text(strip=True)

                # Tenta pegar nome do parent se link está vazio
                if not name or len(name) < 3:
                    parent = link.find_parent(["article", "div", "li"])
                    if parent:
                        title_elem = parent.select_one("h2, h3, h4, .title")
                        if title_elem:
                            name = title_elem.get_text(strip=True)

                if not name or len(name) < 3:
                    continue

                # Extrair nível do curso do texto ou URL
                level = self._detect_course_level(name, href)

                # Gerar slug
                slug = self._slugify(name)

                # URL completa
                if not href.startswith("http"):
                    href = urljoin(self.base_url, href)

                courses.append(CourseListing(
                    id=self.generate_id(f"{university.slug}-{slug}"),
                    name=name,
                    slug=slug,
                    level=level,
                    source_url=href,
                    university_name=university.name,
                    university_slug=university.slug,
                ))

            except Exception as e:
                logger.debug(f"Erro ao parsear link de curso: {e}")
                continue

        return courses

    def _detect_course_level(self, name: str, url: str) -> str:
        """Detecta nível do curso a partir do nome ou URL."""
        text = f"{name} {url}".lower()

        if "doutorado" in text or "doutoramento" in text or "phd" in text:
            return "doutorado"
        elif "mestrado-integrado" in text or "mestrado integrado" in text:
            return "mestrado-integrado"
        elif "mestrado" in text or "master" in text:
            return "mestrado"
        elif "pos-graduacao" in text or "pós-graduação" in text or "especialização" in text:
            return "pos-graduacao"
        elif "licenciatura" in text or "bachelor" in text:
            return "licenciatura"
        elif "mba" in text:
            return "mba"
        elif "tecnico" in text or "técnico" in text or "ctesp" in text:
            return "curso-tecnico"
        else:
            return "outro"

    async def _extract_university_courses_with_ai(
        self,
        html: str,
        university: "UniversityListing",
    ) -> List[CourseListing]:
        """
        Extrai cursos usando AI como fallback.

        Args:
            html: HTML da página
            university: Dados da universidade

        Returns:
            Lista de CourseListing
        """
        # Limpar HTML
        soup = BeautifulSoup(html, "lxml")
        for tag in soup.select("script, style, nav, footer, header"):
            tag.decompose()
        text_content = soup.get_text(separator="\n", strip=True)[:15000]

        prompt = f"""Extraia todos os cursos da página desta universidade: {university.name}

CONTEÚDO:
{text_content}

Retorne APENAS JSON válido:
{{
  "courses": [
    {{"name": "Nome do Curso", "level": "licenciatura|mestrado|doutorado|outro", "duration": "duração"}}
  ]
}}"""

        response = await self._call_ai(prompt, max_tokens=2000)
        if not response:
            return []

        try:
            json_match = re.search(r'\{[\s\S]*\}', response)
            if not json_match:
                return []

            data = json.loads(json_match.group())
            courses = []

            for course_data in data.get("courses", []):
                name = course_data.get("name", "").strip()
                if not name or len(name) < 3:
                    continue

                slug = self._slugify(name)
                courses.append(CourseListing(
                    id=self.generate_id(f"{university.slug}-{slug}"),
                    name=name,
                    slug=slug,
                    level=course_data.get("level", "outro"),
                    duration=course_data.get("duration"),
                    source_url=university.source_url,
                    university_name=university.name,
                    university_slug=university.slug,
                ))

            return courses

        except Exception as e:
            logger.error(f"Erro ao parsear resposta AI: {e}")
            return []

    async def scrape_full_hierarchy(
        self,
        max_universities: Optional[int] = None,
        max_courses_per_university: Optional[int] = None,
        progress_callback: Optional[Callable] = None,
        use_ai: bool = True,
        delay_between_universities: float = 2.0,
    ) -> Dict[str, Any]:
        """
        Scraping hierárquico completo: Universidades → Cursos por universidade.

        Fluxo:
        1. Scrape listagem de universidades
        2. Para cada universidade, visita página individual
        3. Extrai cursos dessa universidade
        4. Retorna hierarquia completa

        Args:
            max_universities: Limite de universidades
            max_courses_per_university: Limite de cursos por universidade
            progress_callback: Callback de progresso
            use_ai: Usar AI como fallback
            batch_size: Universidades processadas em paralelo
            delay_between_universities: Delay entre universidades (rate limiting)

        Returns:
            Dict com universities, courses, hierarchy e stats
        """
        if progress_callback:
            self._progress_callback = progress_callback

        start_time = __import__("time").time()

        # 1. Scrape universidades
        logger.info("Fase 1: Buscando universidades...")
        await self._report_progress({
            "phase": "universities",
            "status": "starting",
        })

        universities = await self.scrape_universities(
            max_pages=None,
            progress_callback=progress_callback,
            use_ai=use_ai,
        )

        if max_universities:
            universities = universities[:max_universities]

        logger.info(f"Encontradas {len(universities)} universidades")

        # 2. Para cada universidade, buscar cursos
        logger.info("Fase 2: Buscando cursos por universidade...")
        all_courses = []
        hierarchy = {}  # university_id -> [course_ids]

        for i, university in enumerate(universities):
            await self._report_progress({
                "phase": "courses",
                "current_university": i + 1,
                "total_universities": len(universities),
                "university_name": university.name,
            })

            courses = await self.scrape_university_courses(university, use_ai=use_ai)

            if max_courses_per_university:
                courses = courses[:max_courses_per_university]

            all_courses.extend(courses)
            hierarchy[university.id] = [c.id for c in courses]

            logger.info(f"[{i+1}/{len(universities)}] {university.name}: {len(courses)} cursos")

            # Rate limiting
            if i < len(universities) - 1:
                await asyncio.sleep(delay_between_universities)

        # 3. Montar resultado
        elapsed_time = __import__("time").time() - start_time

        result = {
            "universities": universities,
            "courses": all_courses,
            "hierarchy": hierarchy,
            "stats": {
                "total_universities": len(universities),
                "total_courses": len(all_courses),
                "avg_courses_per_university": len(all_courses) / len(universities) if universities else 0,
                "elapsed_seconds": round(elapsed_time, 2),
            }
        }

        await self._report_progress({
            "phase": "completed",
            "total_universities": len(universities),
            "total_courses": len(all_courses),
        })

        logger.info(f"Scraping hierárquico concluído: {len(universities)} universidades, {len(all_courses)} cursos")

        return result


# Instância global do scraper
eduportugal_scraper = EduPortugalScraper()
