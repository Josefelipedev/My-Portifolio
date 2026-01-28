"""
DGES (Direção-Geral do Ensino Superior) Scraper

Scraper para buscar universidades e cursos do site oficial do governo português.
Fonte oficial e mais confiável para dados de ensino superior em Portugal.

Estrutura do site:
- Índice por instituição: /guias/indest.asp?reg=11
- Detalhes do curso: /guias/detcursopi.asp?codc={course_code}&code={inst_code}
"""

import asyncio
import hashlib
import json
import logging
import os
import re
from datetime import datetime
from typing import List, Optional, Callable, Dict, Any
from urllib.parse import urljoin, parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup

from models import UniversityListing, CourseListing

logger = logging.getLogger(__name__)

# Together AI para extração inteligente (fallback)
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY", "")
TOGETHER_API_URL = "https://api.together.xyz/v1/chat/completions"
AI_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo"


class DGESScraper:
    """
    Scraper para dges.gov.pt - Fonte oficial do Ensino Superior em Portugal.

    Características:
    - Dados oficiais do governo português
    - Informações de vagas, requisitos, notas de corte
    - Rate limiting: 1 segundo entre requisições
    """

    name = "dges"
    base_url = "https://www.dges.gov.pt"

    # Regiões disponíveis
    REGIONS = {
        "11": "Lisboa",
        "12": "Centro",
        "13": "Norte",
        "14": "Alentejo",
        "15": "Algarve",
        "16": "Açores",
        "17": "Madeira",
    }

    # Tipos de ensino
    INSTITUTION_TYPES = {
        "Ensino Superior Público Universitário": "publica_universitario",
        "Ensino Superior Público Politécnico": "publica_politecnico",
        "Ensino Superior Privado Universitário": "privada_universitario",
        "Ensino Superior Privado Politécnico": "privada_politecnico",
    }

    # Delay entre requisições (segundos)
    RATE_LIMIT_DELAY = 1.0

    def __init__(self):
        self._progress_callback: Optional[Callable] = None
        self._http_client: Optional[httpx.AsyncClient] = None

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

    async def _get_client(self) -> httpx.AsyncClient:
        """Obtém ou cria cliente HTTP."""
        if not self._http_client:
            self._http_client = httpx.AsyncClient(
                timeout=30.0,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
                },
                follow_redirects=True,
            )
        return self._http_client

    async def _fetch_page(self, url: str, retries: int = 3) -> str:
        """
        Busca uma página com rate limiting e retry.

        Args:
            url: URL da página
            retries: Número de tentativas em caso de erro

        Returns:
            HTML da página
        """
        client = await self._get_client()
        last_error = None

        for attempt in range(retries):
            # Rate limiting
            await asyncio.sleep(self.RATE_LIMIT_DELAY)

            try:
                response = await client.get(url)

                # Se for erro 500, tenta novamente após delay maior
                if response.status_code == 500:
                    logger.warning(f"DGES 500 error (attempt {attempt + 1}/{retries}): {url}")
                    if attempt < retries - 1:
                        await asyncio.sleep(5)  # Wait 5 seconds before retry
                        continue
                    else:
                        # Return empty page instead of raising to allow other regions to continue
                        logger.error(f"DGES permanently unavailable: {url}")
                        return ""

                response.raise_for_status()

                # DGES usa encoding Windows-1252
                return response.content.decode('windows-1252', errors='replace')

            except Exception as e:
                last_error = e
                if attempt < retries - 1:
                    logger.warning(f"Fetch error (attempt {attempt + 1}/{retries}): {e}")
                    await asyncio.sleep(3)
                    continue
                raise

        if last_error:
            raise last_error
        return ""

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

    def _extract_institution_type(self, section_title: str) -> str:
        """Extrai tipo de instituição do título da seção."""
        for key, value in self.INSTITUTION_TYPES.items():
            if key.lower() in section_title.lower():
                return value
        return "outro"

    def _parse_degree_level(self, level_text: str) -> str:
        """Converte notação de grau para formato padronizado."""
        level_text = level_text.lower()
        if 'lic' in level_text or '1º cic' in level_text:
            return 'licenciatura'
        elif 'mest' in level_text or '2º cic' in level_text:
            return 'mestrado'
        elif 'dout' in level_text or '3º cic' in level_text:
            return 'doutorado'
        elif 'integrado' in level_text:
            return 'mestrado-integrado'
        elif 'tesp' in level_text or 'ctesp' in level_text:
            return 'curso-tecnico'
        elif 'pós-grad' in level_text or 'pos-grad' in level_text:
            return 'pos-graduacao'
        return 'outro'

    # ==========================================
    # Scraping de Instituições e Cursos
    # ==========================================

    async def scrape_all(
        self,
        regions: Optional[List[str]] = None,
        max_courses_per_institution: Optional[int] = None,
        fetch_details: bool = False,
        progress_callback: Optional[Callable] = None,
    ) -> Dict[str, Any]:
        """
        Faz scraping de todas as instituições e cursos da DGES.

        Args:
            regions: Lista de códigos de região (None = todas)
            max_courses_per_institution: Limite de cursos por instituição
            fetch_details: Se True, busca detalhes de cada curso (mais lento)
            progress_callback: Callback para atualizações de progresso

        Returns:
            Dict com universities e courses
        """
        if progress_callback:
            self._progress_callback = progress_callback

        universities: List[UniversityListing] = []
        courses: List[CourseListing] = []

        regions_to_scrape = regions or list(self.REGIONS.keys())

        for region_code in regions_to_scrape:
            region_name = self.REGIONS.get(region_code, region_code)
            logger.info(f"Buscando região: {region_name} ({region_code})")

            await self._report_progress({
                "type": "region",
                "region": region_name,
                "region_code": region_code,
            })

            url = f"{self.base_url}/guias/indest.asp?reg={region_code}"

            try:
                html = await self._fetch_page(url)
                region_data = await self._parse_region_page(
                    html,
                    region_name,
                    max_courses_per_institution,
                    fetch_details,
                )

                universities.extend(region_data["universities"])
                courses.extend(region_data["courses"])

                await self._report_progress({
                    "type": "region_complete",
                    "region": region_name,
                    "universities_found": len(region_data["universities"]),
                    "courses_found": len(region_data["courses"]),
                    "total_universities": len(universities),
                    "total_courses": len(courses),
                })

            except Exception as e:
                logger.error(f"Erro ao processar região {region_name}: {e}")
                continue

        logger.info(f"Total: {len(universities)} instituições, {len(courses)} cursos")

        return {
            "universities": universities,
            "courses": courses,
        }

    async def _parse_region_page(
        self,
        html: str,
        region_name: str,
        max_courses_per_institution: Optional[int] = None,
        fetch_details: bool = False,
    ) -> Dict[str, Any]:
        """
        Faz parsing de uma página de região.

        Args:
            html: HTML da página
            region_name: Nome da região
            max_courses_per_institution: Limite de cursos por instituição
            fetch_details: Se True, busca detalhes de cada curso

        Returns:
            Dict com universities e courses
        """
        universities: List[UniversityListing] = []
        courses: List[CourseListing] = []

        soup = BeautifulSoup(html, "lxml")

        # Encontra todas as seções de tipo de instituição
        current_type = "outro"
        current_institution: Optional[Dict] = None

        # A página tem estrutura com headers de tipo e tabelas de instituições
        for element in soup.find_all(['h2', 'h3', 'table', 'tr']):
            # Headers de tipo de instituição
            if element.name in ['h2', 'h3']:
                text = element.get_text(strip=True)
                for type_name in self.INSTITUTION_TYPES:
                    if type_name.lower() in text.lower():
                        current_type = self.INSTITUTION_TYPES[type_name]
                        break

            # Linhas de instituição (têm código numérico)
            elif element.name == 'tr':
                # Procura por linhas que parecem instituições
                cells = element.find_all(['td', 'th'])
                if len(cells) >= 2:
                    first_cell = cells[0].get_text(strip=True)

                    # Verifica se é uma linha de instituição (código numérico no início)
                    if re.match(r'^\d{4}', first_cell):
                        # Nova instituição
                        inst_code = first_cell[:4]
                        inst_link = cells[0].find('a')

                        if inst_link:
                            inst_name = inst_link.get_text(strip=True)
                            inst_url = inst_link.get('href', '')

                            # Extrai vagas se disponível
                            vacancies = None
                            if len(cells) > 1:
                                vagas_text = cells[-1].get_text(strip=True)
                                vagas_match = re.search(r'(\d+)', vagas_text)
                                if vagas_match:
                                    vacancies = int(vagas_match.group(1))

                            current_institution = {
                                "code": inst_code,
                                "name": inst_name,
                                "type": current_type,
                                "region": region_name,
                                "url": urljoin(self.base_url, inst_url) if inst_url else None,
                                "vacancies": vacancies,
                            }

                            # Cria UniversityListing
                            slug = self._slugify(inst_name)
                            universities.append(UniversityListing(
                                id=self.generate_id(f"{inst_code}-{slug}"),
                                name=inst_name,
                                slug=slug,
                                description=None,
                                city=region_name,
                                logo_url=None,
                                source_url=current_institution["url"] or f"{self.base_url}/guias/indest.asp",
                            ))

                    # Verifica se é uma linha de curso (link para detcursopi)
                    elif current_institution:
                        course_link = element.find('a', href=re.compile(r'detcursopi'))
                        if course_link:
                            course_name = course_link.get_text(strip=True)
                            course_href = course_link.get('href', '')

                            # Extrai código do curso da URL
                            parsed = urlparse(course_href)
                            params = parse_qs(parsed.query)
                            course_code = params.get('codc', [''])[0]

                            # Extrai nível do grau
                            row_text = element.get_text()
                            level_match = re.search(r'\[([^\]]+)\]', row_text)
                            level = self._parse_degree_level(level_match.group(1) if level_match else '')

                            # Extrai vagas do curso
                            course_vacancies = None
                            vagas_match = re.search(r'(\d+)\s*$', row_text.strip())
                            if vagas_match:
                                course_vacancies = int(vagas_match.group(1))

                            course_slug = self._slugify(course_name)
                            course_url = urljoin(self.base_url, f"/guias/{course_href}") if course_href else None

                            course = CourseListing(
                                id=self.generate_id(f"{course_code}-{course_slug}"),
                                name=course_name,
                                slug=course_slug,
                                description=None,
                                level=level,
                                duration=None,
                                city=region_name,
                                modality="presencial",
                                start_date=None,
                                source_url=course_url,
                                university_name=current_institution["name"],
                                university_slug=self._slugify(current_institution["name"]),
                            )

                            courses.append(course)

                            # Limita cursos por instituição
                            if max_courses_per_institution:
                                inst_courses = [c for c in courses if c.university_name == current_institution["name"]]
                                if len(inst_courses) >= max_courses_per_institution:
                                    current_institution = None

        # Se não encontrou dados estruturados, tenta parsing alternativo
        if not universities and not courses:
            logger.info("Tentando parsing alternativo...")
            return await self._parse_region_page_alternative(html, region_name, max_courses_per_institution)

        return {
            "universities": universities,
            "courses": courses,
        }

    async def _parse_region_page_alternative(
        self,
        html: str,
        region_name: str,
        max_courses_per_institution: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Parsing alternativo para quando a estrutura padrão não funciona.
        """
        universities: List[UniversityListing] = []
        courses: List[CourseListing] = []

        soup = BeautifulSoup(html, "lxml")

        # Encontra todos os links de cursos
        course_links = soup.find_all('a', href=re.compile(r'detcursopi'))

        seen_institutions = set()
        current_inst_name = None

        for link in course_links:
            course_name = link.get_text(strip=True)
            course_href = link.get('href', '')

            if not course_name or not course_href:
                continue

            # Extrai parâmetros
            parsed = urlparse(course_href)
            params = parse_qs(parsed.query)
            course_code = params.get('codc', [''])[0]
            inst_code = params.get('code', [''])[0]

            # Tenta encontrar o nome da instituição
            parent = link.find_parent('tr')
            if parent:
                # Procura na estrutura da tabela
                prev_rows = parent.find_previous_siblings('tr')
                for row in prev_rows[:10]:  # Limita busca
                    row_text = row.get_text(strip=True)
                    if re.match(r'^\d{4}', row_text):
                        inst_link = row.find('a')
                        if inst_link:
                            current_inst_name = inst_link.get_text(strip=True)
                            break

            # Cria instituição se nova
            if current_inst_name and current_inst_name not in seen_institutions:
                seen_institutions.add(current_inst_name)
                inst_slug = self._slugify(current_inst_name)
                universities.append(UniversityListing(
                    id=self.generate_id(f"{inst_code}-{inst_slug}"),
                    name=current_inst_name,
                    slug=inst_slug,
                    description=None,
                    city=region_name,
                    logo_url=None,
                    source_url=f"{self.base_url}/guias/indest.asp",
                ))

            # Extrai nível
            row_text = parent.get_text() if parent else ''
            level_match = re.search(r'\[([^\]]+)\]', row_text)
            level = self._parse_degree_level(level_match.group(1) if level_match else '')

            course_slug = self._slugify(course_name)
            course_url = urljoin(self.base_url, f"/guias/{course_href}")

            courses.append(CourseListing(
                id=self.generate_id(f"{course_code}-{course_slug}"),
                name=course_name,
                slug=course_slug,
                description=None,
                level=level,
                duration=None,
                city=region_name,
                modality="presencial",
                start_date=None,
                source_url=course_url,
                university_name=current_inst_name,
                university_slug=self._slugify(current_inst_name) if current_inst_name else None,
            ))

        return {
            "universities": universities,
            "courses": courses,
        }

    async def fetch_course_details(self, course_url: str) -> Optional[Dict[str, Any]]:
        """
        Busca detalhes completos de um curso.

        Args:
            course_url: URL da página do curso

        Returns:
            Dict com detalhes do curso
        """
        try:
            html = await self._fetch_page(course_url)
            soup = BeautifulSoup(html, "lxml")

            details: Dict[str, Any] = {
                "source_url": course_url,
            }

            # Nome do curso
            title = soup.find('h1') or soup.find('h2')
            if title:
                details["name"] = title.get_text(strip=True)

            # Procura por campos específicos no texto
            text = soup.get_text()

            # Duração e ECTS
            duration_match = re.search(r'(\d+)\s*semestres?', text, re.I)
            if duration_match:
                semesters = int(duration_match.group(1))
                details["duration"] = f"{semesters} semestres"
                details["duration_months"] = semesters * 6

            ects_match = re.search(r'(\d+)\s*ECTS', text, re.I)
            if ects_match:
                details["credits"] = int(ects_match.group(1))

            # Vagas
            vagas_match = re.search(r'Vagas[:\s]*(\d+)', text, re.I)
            if vagas_match:
                details["vacancies"] = int(vagas_match.group(1))

            # Instituição
            inst_match = soup.find('a', href=re.compile(r'indest'))
            if inst_match:
                details["institution_name"] = inst_match.get_text(strip=True)

            # Website da instituição
            website_link = soup.find('a', href=re.compile(r'^https?://(?!www\.dges)'))
            if website_link:
                details["official_url"] = website_link.get('href')

            # Email
            email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
            if email_match:
                details["email"] = email_match.group()

            # Telefone
            phone_match = re.search(r'(\+351[\s\d]+|\d{3}[\s\d]{6,})', text)
            if phone_match:
                details["phone"] = phone_match.group().strip()

            # Endereço
            address_patterns = [
                r'(Av\.|Avenida|Rua|Praça|Largo)[^,\n]+,\s*\d{4}-\d{3}\s*\w+',
                r'\d{4}-\d{3}\s+\w+',
            ]
            for pattern in address_patterns:
                addr_match = re.search(pattern, text)
                if addr_match:
                    details["address"] = addr_match.group().strip()
                    break

            # Área de estudo
            area_match = re.search(r'Área[:\s]*([\w\s]+?)(?:\n|$)', text, re.I)
            if area_match:
                details["area"] = area_match.group(1).strip()

            return details

        except Exception as e:
            logger.error(f"Erro ao buscar detalhes do curso {course_url}: {e}")
            return None

    async def scrape_universities(
        self,
        regions: Optional[List[str]] = None,
        progress_callback: Optional[Callable] = None,
    ) -> List[UniversityListing]:
        """
        Faz scraping apenas das universidades.
        """
        result = await self.scrape_all(
            regions=regions,
            max_courses_per_institution=0,
            fetch_details=False,
            progress_callback=progress_callback,
        )
        return result["universities"]

    async def scrape_courses(
        self,
        regions: Optional[List[str]] = None,
        levels: Optional[List[str]] = None,
        max_per_institution: Optional[int] = None,
        progress_callback: Optional[Callable] = None,
    ) -> List[CourseListing]:
        """
        Faz scraping dos cursos.

        Args:
            regions: Lista de códigos de região
            levels: Filtrar por níveis (licenciatura, mestrado, etc.)
            max_per_institution: Limite de cursos por instituição
            progress_callback: Callback de progresso
        """
        result = await self.scrape_all(
            regions=regions,
            max_courses_per_institution=max_per_institution,
            fetch_details=False,
            progress_callback=progress_callback,
        )

        courses = result["courses"]

        # Filtra por nível se especificado
        if levels:
            courses = [c for c in courses if c.level in levels]

        return courses

    async def close(self):
        """Fecha cliente HTTP."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None


# Instância global do scraper
dges_scraper = DGESScraper()
