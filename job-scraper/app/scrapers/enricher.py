"""
University Enricher - Extração inteligente de dados extras

Estratégia de baixo consumo de tokens:
1. Primeiro tenta extrair via HTML parsing (meta tags, links conhecidos)
2. Se não encontrar, usa micro-prompt de AI (~500 tokens)

Dados extraídos:
- Logo URL (og:image ou img.logo)
- Redes sociais (Instagram, LinkedIn, Facebook, Twitter, YouTube)
- Email e telefone de contacto
- Descrição curta
"""

import asyncio
import hashlib
import json
import logging
import os
import re
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from models import UniversityEnrichment

logger = logging.getLogger(__name__)

# Together AI config
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY", "")
TOGETHER_API_URL = "https://api.together.xyz/v1/chat/completions"
# Usar modelo mais barato e rápido para micro-prompts
AI_MODEL = os.getenv("ENRICHER_AI_MODEL", "meta-llama/Llama-3.1-8B-Instruct-Turbo")

# Cache de enriquecimentos (em memória)
_enrichment_cache: Dict[str, tuple[UniversityEnrichment, datetime]] = {}
CACHE_TTL_DAYS = 30


class UniversityEnricher:
    """
    Enriquece dados de universidades visitando seus sites oficiais.

    Estratégia de economia de tokens:
    1. HTML parsing primeiro (0 tokens)
    2. Micro-prompt AI apenas se necessário (~500 tokens)
    """

    # Padrões de URLs de redes sociais
    SOCIAL_PATTERNS = {
        'instagram': [
            r'instagram\.com/([^/?#]+)',
            r'instagr\.am/([^/?#]+)',
        ],
        'linkedin': [
            r'linkedin\.com/(?:company|school|edu)/([^/?#]+)',
        ],
        'facebook': [
            r'facebook\.com/([^/?#]+)',
            r'fb\.com/([^/?#]+)',
        ],
        'twitter': [
            r'twitter\.com/([^/?#]+)',
            r'x\.com/([^/?#]+)',
        ],
        'youtube': [
            r'youtube\.com/(?:c/|channel/|user/|@)?([^/?#]+)',
        ],
    }

    # Seletores comuns para logos
    LOGO_SELECTORS = [
        'img.logo',
        'img.site-logo',
        'img#logo',
        '.logo img',
        '.site-logo img',
        'header img[src*="logo"]',
        'a.logo img',
        '.navbar-brand img',
    ]

    def __init__(self):
        self._http_client: Optional[httpx.AsyncClient] = None
        self.stats = {
            'total_enriched': 0,
            'html_only': 0,
            'ai_used': 0,
            'failed': 0,
            'tokens_used': 0,
            'cache_hits': 0,
        }

    async def _get_client(self) -> httpx.AsyncClient:
        """Obtém ou cria cliente HTTP."""
        if not self._http_client:
            self._http_client = httpx.AsyncClient(
                timeout=15.0,
                follow_redirects=True,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }
            )
        return self._http_client

    async def close(self):
        """Fecha o cliente HTTP."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None

    def _get_cache_key(self, url: str) -> str:
        """Gera chave de cache a partir da URL."""
        return hashlib.md5(url.encode()).hexdigest()

    def _check_cache(self, url: str) -> Optional[UniversityEnrichment]:
        """Verifica se há cache válido."""
        key = self._get_cache_key(url)
        if key in _enrichment_cache:
            enrichment, cached_at = _enrichment_cache[key]
            if datetime.now() - cached_at < timedelta(days=CACHE_TTL_DAYS):
                self.stats['cache_hits'] += 1
                return enrichment
            else:
                del _enrichment_cache[key]
        return None

    def _save_cache(self, url: str, enrichment: UniversityEnrichment):
        """Salva no cache."""
        key = self._get_cache_key(url)
        _enrichment_cache[key] = (enrichment, datetime.now())

    async def enrich(self, website_url: str, force: bool = False) -> UniversityEnrichment:
        """
        Enriquece dados de uma universidade a partir do seu site oficial.

        Args:
            website_url: URL do site oficial da universidade
            force: Se True, ignora cache

        Returns:
            UniversityEnrichment com os dados extraídos
        """
        if not website_url:
            return UniversityEnrichment(error="URL não fornecida")

        # Verifica cache
        if not force:
            cached = self._check_cache(website_url)
            if cached:
                logger.info(f"Cache hit para {website_url}")
                return cached

        logger.info(f"Enriquecendo: {website_url}")

        try:
            # Fase 1: Buscar HTML
            html = await self._fetch_page(website_url)
            if not html:
                return UniversityEnrichment(error="Falha ao buscar página")

            # Fase 2: Extrair via HTML parsing (0 tokens)
            enrichment = self._extract_from_html(html, website_url)

            # Fase 3: Se faltam dados importantes, usar AI
            missing_important = not enrichment.logo_url or (
                not enrichment.instagram_url and
                not enrichment.linkedin_url and
                not enrichment.facebook_url
            )

            if missing_important and TOGETHER_API_KEY:
                logger.info(f"Dados incompletos, usando AI para {website_url}")
                ai_enrichment = await self._extract_with_ai(html, website_url)
                if ai_enrichment:
                    enrichment = self._merge_enrichments(enrichment, ai_enrichment)
                    enrichment.ai_used = True
                    self.stats['ai_used'] += 1
            else:
                self.stats['html_only'] += 1

            self.stats['total_enriched'] += 1
            self.stats['tokens_used'] += enrichment.tokens_used

            # Salva no cache
            self._save_cache(website_url, enrichment)

            return enrichment

        except Exception as e:
            logger.error(f"Erro ao enriquecer {website_url}: {e}")
            self.stats['failed'] += 1
            return UniversityEnrichment(error=str(e))

    async def search_university_website(
        self,
        university_name: str,
        country: str = "Portugal",
    ) -> Optional[str]:
        """
        Busca o website oficial de uma universidade via DuckDuckGo.

        Não requer API key - usa o endpoint HTML do DuckDuckGo.

        Args:
            university_name: Nome da universidade
            country: País para contexto (default: Portugal)

        Returns:
            URL do website oficial ou None se não encontrar
        """
        try:
            client = await self._get_client()

            # DuckDuckGo HTML search (sem API key)
            query = f"{university_name} site oficial {country}"
            search_url = f"https://html.duckduckgo.com/html/?q={query.replace(' ', '+')}"

            logger.info(f"Buscando website para: {university_name}")

            response = await client.get(
                search_url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                },
                timeout=15.0,
            )

            if response.status_code != 200:
                logger.warning(f"DuckDuckGo search failed: {response.status_code}")
                return None

            # Parse resultados
            soup = BeautifulSoup(response.text, 'html.parser')

            # DuckDuckGo HTML usa .result__url para URLs
            results = soup.select('.result__url, .result__a, a.result__snippet')

            # Padrões de domínios oficiais portugueses
            official_patterns = [
                r'\.edu\.pt',
                r'universidade.*\.pt',
                r'instituto.*\.pt',
                r'escola.*\.pt',
                r'ips[a-z]*\.pt',  # Politécnicos
                r'ip[a-z]+\.pt',   # Institutos
                r'ul\.pt',         # Universidade de Lisboa
                r'up\.pt',         # Universidade do Porto
                r'uc\.pt',         # Universidade de Coimbra
                r'uminho\.pt',     # Universidade do Minho
                r'uevora\.pt',     # Universidade de Évora
                r'ualg\.pt',       # Universidade do Algarve
                r'utad\.pt',       # UTAD
                r'uab\.pt',        # Universidade Aberta
                r'nova\.pt',       # Universidade Nova
                r'iscte.*\.pt',    # ISCTE
            ]

            # Domínios a ignorar (agregadores)
            skip_domains = [
                'eduportugal', 'dges.gov', 'facebook', 'linkedin',
                'instagram', 'wikipedia', 'youtube', 'twitter',
                'x.com', 'glassdoor', 'indeed', 'google'
            ]

            for result in results[:15]:  # Verifica primeiros 15 resultados
                # Extrai URL do elemento
                href = result.get('href', '')
                if not href:
                    # Tenta pegar do texto (DuckDuckGo mostra URL no texto)
                    href = result.get_text(strip=True)

                if not href:
                    continue

                # Ignora agregadores
                if any(skip in href.lower() for skip in skip_domains):
                    continue

                # Verifica se corresponde a padrões oficiais
                for pattern in official_patterns:
                    if re.search(pattern, href, re.I):
                        # Limpa e normaliza URL
                        if not href.startswith('http'):
                            href = f"https://{href.lstrip('/')}"

                        # Remove query strings e fragmentos
                        clean_url = href.split('?')[0].split('#')[0].rstrip('/')

                        logger.info(f"Website encontrado para {university_name}: {clean_url}")
                        return clean_url

            # Fallback: procura qualquer .pt que não seja agregador
            for result in results[:10]:
                href = result.get('href', '') or result.get_text(strip=True)
                if href and '.pt' in href.lower():
                    if not any(skip in href.lower() for skip in skip_domains):
                        if not href.startswith('http'):
                            href = f"https://{href.lstrip('/')}"
                        clean_url = href.split('?')[0].split('#')[0].rstrip('/')
                        logger.info(f"Website (fallback) para {university_name}: {clean_url}")
                        return clean_url

            logger.warning(f"Nenhum website encontrado para: {university_name}")
            return None

        except Exception as e:
            logger.error(f"Erro na busca para {university_name}: {e}")
            return None

    async def enrich_with_search(
        self,
        university_name: str,
        website_url: Optional[str] = None,
        force: bool = False,
    ) -> UniversityEnrichment:
        """
        Enriquece dados de universidade, buscando o website se não fornecido.

        Fluxo:
        1. Se website_url fornecido, usa diretamente
        2. Se não, busca via DuckDuckGo
        3. Enriquece a partir do website encontrado

        Args:
            university_name: Nome da universidade
            website_url: URL conhecida (opcional)
            force: Ignorar cache

        Returns:
            UniversityEnrichment com dados extraídos
        """
        # Se não tem website, busca
        if not website_url:
            logger.info(f"Buscando website para: {university_name}")
            website_url = await self.search_university_website(university_name)

            if not website_url:
                return UniversityEnrichment(
                    error=f"Website não encontrado para: {university_name}"
                )

        # Enriquece usando o website
        enrichment = await self.enrich(website_url, force=force)

        # Adiciona info de que o website foi encontrado via busca
        if enrichment.error is None:
            logger.info(f"Universidade {university_name} enriquecida com sucesso")

        return enrichment

    async def _fetch_page(self, url: str) -> Optional[str]:
        """Busca HTML de uma página."""
        try:
            client = await self._get_client()
            response = await client.get(url)

            if response.status_code == 200:
                return response.text
            else:
                logger.warning(f"HTTP {response.status_code} para {url}")
                return None

        except Exception as e:
            logger.error(f"Erro ao buscar {url}: {e}")
            return None

    def _extract_from_html(self, html: str, base_url: str) -> UniversityEnrichment:
        """
        Extrai dados via parsing HTML (0 tokens).

        Busca:
        - Meta tags (og:image, description)
        - Links para redes sociais
        - Imagens de logo
        - Emails e telefones
        """
        soup = BeautifulSoup(html, 'html.parser')
        enrichment = UniversityEnrichment()

        # 1. Logo via meta tags
        og_image = soup.find('meta', property='og:image')
        if og_image and og_image.get('content'):
            enrichment.logo_url = urljoin(base_url, og_image['content'])

        # 2. Logo via seletores comuns
        if not enrichment.logo_url:
            for selector in self.LOGO_SELECTORS:
                try:
                    img = soup.select_one(selector)
                    if img and img.get('src'):
                        enrichment.logo_url = urljoin(base_url, img['src'])
                        break
                except Exception:
                    continue

        # 3. Descrição via meta tags
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc and meta_desc.get('content'):
            enrichment.description = meta_desc['content'][:500]

        og_desc = soup.find('meta', property='og:description')
        if og_desc and og_desc.get('content') and not enrichment.description:
            enrichment.description = og_desc['content'][:500]

        # 4. Redes sociais via links
        all_links = soup.find_all('a', href=True)
        for link in all_links:
            href = link['href']

            for platform, patterns in self.SOCIAL_PATTERNS.items():
                for pattern in patterns:
                    match = re.search(pattern, href, re.IGNORECASE)
                    if match:
                        full_url = href if href.startswith('http') else f"https://{href.lstrip('/')}"

                        if platform == 'instagram' and not enrichment.instagram_url:
                            enrichment.instagram_url = full_url
                        elif platform == 'linkedin' and not enrichment.linkedin_url:
                            enrichment.linkedin_url = full_url
                        elif platform == 'facebook' and not enrichment.facebook_url:
                            enrichment.facebook_url = full_url
                        elif platform == 'twitter' and not enrichment.twitter_url:
                            enrichment.twitter_url = full_url
                        elif platform == 'youtube' and not enrichment.youtube_url:
                            enrichment.youtube_url = full_url
                        break

        # 5. Email via mailto: links
        mailto_links = soup.find_all('a', href=re.compile(r'^mailto:', re.I))
        if mailto_links:
            email = mailto_links[0]['href'].replace('mailto:', '').split('?')[0]
            enrichment.email = email

        # 6. Telefone via tel: links
        tel_links = soup.find_all('a', href=re.compile(r'^tel:', re.I))
        if tel_links:
            phone = tel_links[0]['href'].replace('tel:', '')
            enrichment.phone = phone

        return enrichment

    async def _extract_with_ai(self, html: str, base_url: str) -> Optional[UniversityEnrichment]:
        """
        Extrai dados usando AI com micro-prompt (~500 tokens).

        Só é chamado quando HTML parsing não encontrou dados importantes.
        """
        # Limpa o HTML para reduzir tokens
        soup = BeautifulSoup(html, 'html.parser')

        # Remove elementos desnecessários
        for tag in soup.find_all(['script', 'style', 'noscript', 'iframe', 'svg']):
            tag.decompose()

        # Extrai apenas texto relevante (header, footer, nav - onde ficam links sociais)
        relevant_sections = []
        for section in soup.find_all(['header', 'footer', 'nav', 'aside']):
            relevant_sections.append(section.get_text(separator=' ', strip=True))

        # Se não encontrou seções, pega o body todo
        if not relevant_sections:
            body = soup.find('body')
            if body:
                relevant_sections.append(body.get_text(separator=' ', strip=True)[:3000])

        text_content = '\n'.join(relevant_sections)[:4000]  # Limita texto

        # Micro-prompt otimizado
        prompt = f"""Extraia APENAS os seguintes dados do site desta universidade. Responda APENAS com JSON válido, sem explicações.

URL: {base_url}

Texto do site:
{text_content}

Extraia (deixe null se não encontrar):
- logo_url: URL da imagem do logo
- instagram_url: Link do Instagram (formato: https://instagram.com/...)
- linkedin_url: Link do LinkedIn (formato: https://linkedin.com/...)
- facebook_url: Link do Facebook
- twitter_url: Link do Twitter/X
- youtube_url: Link do YouTube
- email: Email de contacto principal
- phone: Telefone principal

JSON:"""

        try:
            client = await self._get_client()
            response = await client.post(
                TOGETHER_API_URL,
                headers={
                    "Authorization": f"Bearer {TOGETHER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": AI_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 500,  # Micro-prompt!
                    "temperature": 0.0,  # Determinístico
                },
                timeout=30.0,
            )

            if response.status_code != 200:
                logger.error(f"AI API error: {response.status_code}")
                return None

            data = response.json()
            content = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            tokens = usage.get("total_tokens", 0)

            logger.info(f"AI usou {tokens} tokens para enriquecimento")

            # Parse JSON da resposta
            # Limpa possível markdown
            content = content.strip()
            if content.startswith('```'):
                content = re.sub(r'^```json?\s*', '', content)
                content = re.sub(r'\s*```$', '', content)

            try:
                result = json.loads(content)
                enrichment = UniversityEnrichment(
                    logo_url=result.get('logo_url'),
                    instagram_url=result.get('instagram_url'),
                    linkedin_url=result.get('linkedin_url'),
                    facebook_url=result.get('facebook_url'),
                    twitter_url=result.get('twitter_url'),
                    youtube_url=result.get('youtube_url'),
                    email=result.get('email'),
                    phone=result.get('phone'),
                    tokens_used=tokens,
                    ai_used=True,
                )
                return enrichment
            except json.JSONDecodeError as e:
                logger.error(f"Erro ao parsear JSON da AI: {e}")
                return None

        except Exception as e:
            logger.error(f"AI call failed: {e}")
            return None

    def _merge_enrichments(
        self,
        html_data: UniversityEnrichment,
        ai_data: UniversityEnrichment
    ) -> UniversityEnrichment:
        """
        Combina dados do HTML parsing com dados da AI.
        Prioriza HTML (mais confiável), AI preenche gaps.
        """
        return UniversityEnrichment(
            logo_url=html_data.logo_url or ai_data.logo_url,
            instagram_url=html_data.instagram_url or ai_data.instagram_url,
            linkedin_url=html_data.linkedin_url or ai_data.linkedin_url,
            facebook_url=html_data.facebook_url or ai_data.facebook_url,
            twitter_url=html_data.twitter_url or ai_data.twitter_url,
            youtube_url=html_data.youtube_url or ai_data.youtube_url,
            email=html_data.email or ai_data.email,
            phone=html_data.phone or ai_data.phone,
            description=html_data.description or ai_data.description,
            address=html_data.address or ai_data.address,
            tokens_used=ai_data.tokens_used,
            ai_used=True,
        )

    async def enrich_batch(
        self,
        universities: List[Dict[str, Any]],
        max_concurrent: int = 3,
        delay_seconds: float = 1.0,
    ) -> List[Dict[str, Any]]:
        """
        Enriquece um lote de universidades com rate limiting.

        Args:
            universities: Lista de dicts com 'id' e 'website'
            max_concurrent: Máximo de requisições simultâneas
            delay_seconds: Delay entre batches

        Returns:
            Lista de dicts com dados enriquecidos
        """
        results = []
        semaphore = asyncio.Semaphore(max_concurrent)

        async def enrich_one(uni: Dict[str, Any]) -> Dict[str, Any]:
            async with semaphore:
                website = uni.get('website')
                if not website:
                    return {**uni, 'enrichment': None, 'enrichment_error': 'No website'}

                enrichment = await self.enrich(website)
                await asyncio.sleep(delay_seconds)

                return {
                    **uni,
                    'enrichment': enrichment.model_dump() if enrichment else None,
                    'enrichment_error': enrichment.error if enrichment else None,
                }

        tasks = [enrich_one(uni) for uni in universities]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Trata exceções
        processed = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed.append({
                    **universities[i],
                    'enrichment': None,
                    'enrichment_error': str(result),
                })
            else:
                processed.append(result)

        return processed

    def get_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas de uso."""
        return {
            **self.stats,
            'cache_size': len(_enrichment_cache),
            'avg_tokens_per_ai_call': (
                self.stats['tokens_used'] / self.stats['ai_used']
                if self.stats['ai_used'] > 0 else 0
            ),
        }


# Singleton para uso global
_enricher_instance: Optional[UniversityEnricher] = None


def get_enricher() -> UniversityEnricher:
    """Obtém instância singleton do enricher."""
    global _enricher_instance
    if not _enricher_instance:
        _enricher_instance = UniversityEnricher()
    return _enricher_instance
