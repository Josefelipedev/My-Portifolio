"""
EduPortugal.eu Scraper

Scraper para buscar universidades e cursos em Portugal do site eduportugal.eu.
Suporta todas as categorias de cursos: graduação, mestrado, doutorado, MBA, etc.

Estrutura do site:
- Instituições: /instituicoes-de-ensino/ (paginado)
- Cursos por nível: /cursos-estudo/{level}/ (paginado)
"""

import asyncio
import hashlib
import logging
import re
from datetime import datetime
from typing import List, Optional, Callable, Dict, Any
from urllib.parse import urljoin

from playwright.async_api import async_playwright, Browser
from bs4 import BeautifulSoup

from models import UniversityListing, CourseListing, CourseLevel

logger = logging.getLogger(__name__)


class EduPortugalScraper:
    """
    Scraper para eduportugal.eu - Universidades e Cursos em Portugal.

    Características:
    - Rate limiting: 2 segundos entre requisições
    - Suporte a paginação automática
    - Callback de progresso para tracking
    """

    name = "eduportugal"
    base_url = "https://eduportugal.eu"

    # Mapeamento de níveis de curso para URLs
    COURSE_LEVELS = {
        "graduacao": "/cursos-estudo/graduacao/",
        "mestrado": "/cursos-estudo/mestrado/",
        "mestrado-integrado": "/cursos-estudo/mestrado-integrado/",
        "doutorado": "/cursos-estudo/doutorado/",
        "pos-doutorado": "/cursos-estudo/pos-doutorado/",
        "mba": "/cursos-estudo/mba/",
        "pos-graduacao": "/cursos-estudo/pos-graduacao/",
        "curso-tecnico": "/cursos-estudo/curso-tecnico-superior-profissional/",
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
        progress_callback: Optional[Callable] = None
    ) -> List[UniversityListing]:
        """
        Faz scraping de todas as universidades do EduPortugal.

        Args:
            max_pages: Limite de páginas (None = todas)
            progress_callback: Callback para atualizações de progresso

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

        # Parse da primeira página
        page_universities = self._parse_universities_page(html)
        universities.extend(page_universities)

        await self._report_progress({
            "type": "universities",
            "current_page": 1,
            "total_pages": total_pages,
            "found": len(universities),
        })

        # Páginas restantes
        for page_num in range(2, total_pages + 1):
            url = f"{base_url}page/{page_num}/"
            logger.info(f"Buscando universidades - página {page_num}/{total_pages}...")

            try:
                html = await self._fetch_page(url)
                page_universities = self._parse_universities_page(html)
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

        Args:
            html: HTML da página

        Returns:
            Lista de UniversityListing
        """
        universities: List[UniversityListing] = []
        soup = BeautifulSoup(html, "lxml")

        # Seletores para cards de universidades
        cards = soup.select(
            "article.type-instituicao, .institution-card, .university-item, "
            ".listing-item, article[class*='instituicao'], "
            ".wpbf-post-style-boxed"
        )

        # Se não encontrar cards específicos, tenta artigos genéricos
        if not cards:
            cards = soup.select("article")

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

                universities.append(UniversityListing(
                    id=self.generate_id(slug),
                    name=name,
                    slug=slug,
                    description=description,
                    city=city,
                    logo_url=logo_url,
                    source_url=url,
                ))

            except Exception as e:
                logger.debug(f"Erro ao parsear card de universidade: {e}")
                continue

        return universities

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
        progress_callback: Optional[Callable] = None
    ) -> List[CourseListing]:
        """
        Faz scraping de cursos de todos ou alguns níveis.

        Args:
            levels: Lista de níveis para buscar (None = todos)
            max_pages_per_level: Limite de páginas por nível (None = todas)
            progress_callback: Callback para atualizações de progresso

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
    ) -> List[CourseListing]:
        """
        Faz scraping de cursos de um nível específico.

        Args:
            level: Nível do curso
            max_pages: Limite de páginas (None = todas)

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

        # Parse da primeira página
        page_courses = self._parse_courses_page(html, level)
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

        # Seletores para cards de cursos
        cards = soup.select(
            "article.type-curso, .course-card, .curso-item, "
            ".listing-item, article[class*='curso'], "
            "tr.event-list-content, .wpbf-post-style-boxed"
        )

        # Se não encontrar cards específicos, tenta artigos genéricos
        if not cards:
            cards = soup.select("article")

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


# Instância global do scraper
eduportugal_scraper = EduPortugalScraper()
