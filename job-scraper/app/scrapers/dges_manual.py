"""
DGES Manual Upload Handler

Handler para upload manual de dados DGES com:
- Suporte a múltiplos formatos (texto, HTML, URL)
- Extração inteligente via Agno
- Deduplicação com dados existentes no banco
- Comparação detalhada (NEW, EXISTING, UPDATED)
"""

import asyncio
import hashlib
import logging
import os
import time
from typing import Optional, Dict, Any, List, Union

import httpx
from bs4 import BeautifulSoup

from models import (
    ContentType,
    ExtractionMode,
    ManualUploadRequest,
    ComparisonStatus,
    ComparisonResult,
    ExtractionResponse,
    UniversityListing,
    CourseListing,
)
from agents.agno_extractor import get_agno_agent, AgnoExtractionAgent

logger = logging.getLogger(__name__)

# URL da API Next.js para consultar dados existentes
NEXTJS_API_URL = os.getenv("NEXTJS_API_URL", "http://localhost:3000/api")


class DGESManualExtractor:
    """
    Handler para extração manual de dados DGES.

    Fluxo:
    1. Recebe conteúdo (texto, HTML ou URL)
    2. Pré-processa para formato normalizado
    3. Extrai dados via Agno (token-eficiente)
    4. Compara com banco de dados para deduplicação
    5. Retorna dados extraídos + comparação
    """

    def __init__(self):
        self._http_client: Optional[httpx.AsyncClient] = None
        self._agno: Optional[AgnoExtractionAgent] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Obtém ou cria cliente HTTP."""
        if not self._http_client:
            self._http_client = httpx.AsyncClient(timeout=30.0)
        return self._http_client

    async def close(self):
        """Fecha recursos."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None

    def _get_agno(self) -> AgnoExtractionAgent:
        """Obtém agente Agno."""
        if not self._agno:
            self._agno = get_agno_agent()
        return self._agno

    async def extract(
        self,
        request: ManualUploadRequest,
    ) -> ExtractionResponse:
        """
        Processa upload manual e extrai dados.

        Args:
            request: Request com conteúdo e configurações

        Returns:
            ExtractionResponse com dados extraídos e comparação
        """
        start_time = time.time()

        # 1. Pré-processar conteúdo
        logger.info(f"Processando upload: tipo={request.content_type}, modo={request.extraction_mode}")
        text_content = await self._preprocess_content(
            request.content,
            request.content_type,
        )

        if not text_content:
            return ExtractionResponse(
                extracted={"universities": [], "courses": []},
                comparison={"new": [], "existing": [], "updated": []},
                stats={"error": "Falha ao processar conteúdo"}
            )

        # 2. Extrair via Agno
        agno = self._get_agno()
        extraction_result = await agno.extract(
            content=text_content,
            mode=request.extraction_mode.value,
            region_hint=request.region,
        )

        # 3. Converter para modelos de listagem
        listings = agno.convert_to_listings(extraction_result, source="dges")

        # 4. Comparar com dados existentes
        comparison = await self._compare_with_database(listings)

        # 5. Montar resposta
        duration_ms = int((time.time() - start_time) * 1000)

        return ExtractionResponse(
            extracted={
                "universities": [u.model_dump() for u in listings["universities"]],
                "courses": [c.model_dump() for c in listings["courses"]],
            },
            comparison={
                "new": comparison["new"],
                "existing": comparison["existing"],
                "updated": comparison["updated"],
            },
            stats={
                "tokens_used": extraction_result.tokens_used,
                "model_used": extraction_result.model_used,
                "extraction_time_ms": extraction_result.extraction_time_ms,
                "total_time_ms": duration_ms,
                "universities_extracted": len(listings["universities"]),
                "courses_extracted": len(listings["courses"]),
                "new_count": len(comparison["new"]),
                "existing_count": len(comparison["existing"]),
                "updated_count": len(comparison["updated"]),
            }
        )

    async def _preprocess_content(
        self,
        content: str,
        content_type: ContentType,
    ) -> Optional[str]:
        """
        Normaliza conteúdo para texto.

        Args:
            content: Conteúdo bruto
            content_type: Tipo do conteúdo

        Returns:
            Texto normalizado ou None se falhar
        """
        try:
            if content_type == ContentType.TEXT:
                # Já é texto, retornar como está
                return content

            elif content_type == ContentType.HTML:
                # Parsear HTML para texto
                soup = BeautifulSoup(content, "html.parser")

                # Remover elementos não-conteúdo
                for tag in soup.select("script, style, nav, footer, header"):
                    tag.decompose()

                return soup.get_text(separator="\n", strip=True)

            elif content_type == ContentType.URL:
                # Buscar URL e extrair texto
                client = await self._get_client()

                response = await client.get(
                    content,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    },
                    follow_redirects=True,
                )

                if response.status_code != 200:
                    logger.error(f"Erro ao buscar URL: {response.status_code}")
                    return None

                # Detectar encoding
                encoding = response.encoding or "utf-8"
                html = response.content.decode(encoding, errors="replace")

                # Parsear HTML
                soup = BeautifulSoup(html, "html.parser")

                for tag in soup.select("script, style, nav, footer, header"):
                    tag.decompose()

                return soup.get_text(separator="\n", strip=True)

        except Exception as e:
            logger.error(f"Erro ao pré-processar conteúdo: {e}")
            return None

    async def _compare_with_database(
        self,
        listings: Dict[str, List],
    ) -> Dict[str, List[ComparisonResult]]:
        """
        Compara dados extraídos com banco de dados.

        Args:
            listings: Dict com universities e courses

        Returns:
            Dict com listas de ComparisonResult por status
        """
        comparison = {
            "new": [],
            "existing": [],
            "updated": [],
        }

        # Comparar universidades
        for uni in listings.get("universities", []):
            result = await self._compare_university(uni)
            comparison[result.status.value].append(result)

        # Comparar cursos
        for course in listings.get("courses", []):
            result = await self._compare_course(course)
            comparison[result.status.value].append(result)

        return comparison

    async def _compare_university(
        self,
        university: UniversityListing,
    ) -> ComparisonResult:
        """
        Compara uma universidade com dados existentes.

        Busca por:
        1. externalId exato
        2. slug exato
        3. nome similar
        """
        try:
            client = await self._get_client()

            # Buscar por slug ou nome
            response = await client.get(
                f"{NEXTJS_API_URL}/universities",
                params={
                    "search": university.name,
                    "pageSize": 5,
                },
                timeout=10.0,
            )

            if response.status_code != 200:
                # Se não conseguir consultar, considerar como novo
                logger.warning(f"Não foi possível consultar DB: {response.status_code}")
                return ComparisonResult(
                    id=university.id,
                    external_id=university.id,
                    name=university.name,
                    status=ComparisonStatus.NEW,
                )

            data = response.json()
            universities = data.get("universities", [])

            # Procurar match
            for existing in universities:
                # Match por slug
                if existing.get("slug") == university.slug:
                    changes = self._detect_changes(university, existing, [
                        "name", "website", "city", "region", "type"
                    ])
                    if changes:
                        return ComparisonResult(
                            id=university.id,
                            external_id=existing.get("externalId"),
                            name=university.name,
                            status=ComparisonStatus.UPDATED,
                            changes=changes,
                        )
                    return ComparisonResult(
                        id=university.id,
                        external_id=existing.get("externalId"),
                        name=university.name,
                        status=ComparisonStatus.EXISTING,
                    )

                # Match por nome normalizado
                if self._normalize_name(existing.get("name", "")) == self._normalize_name(university.name):
                    changes = self._detect_changes(university, existing, [
                        "website", "city", "region", "type"
                    ])
                    if changes:
                        return ComparisonResult(
                            id=university.id,
                            external_id=existing.get("externalId"),
                            name=university.name,
                            status=ComparisonStatus.UPDATED,
                            changes=changes,
                        )
                    return ComparisonResult(
                        id=university.id,
                        external_id=existing.get("externalId"),
                        name=university.name,
                        status=ComparisonStatus.EXISTING,
                    )

            # Não encontrou match
            return ComparisonResult(
                id=university.id,
                external_id=university.id,
                name=university.name,
                status=ComparisonStatus.NEW,
            )

        except Exception as e:
            logger.error(f"Erro ao comparar universidade: {e}")
            return ComparisonResult(
                id=university.id,
                external_id=university.id,
                name=university.name,
                status=ComparisonStatus.NEW,
            )

    async def _compare_course(
        self,
        course: CourseListing,
    ) -> ComparisonResult:
        """
        Compara um curso com dados existentes.

        Busca por:
        1. slug + university
        2. nome similar + university
        """
        try:
            client = await self._get_client()

            # Buscar por nome
            response = await client.get(
                f"{NEXTJS_API_URL}/courses/search",
                params={
                    "search": course.name,
                    "pageSize": 10,
                },
                timeout=10.0,
            )

            if response.status_code != 200:
                logger.warning(f"Não foi possível consultar DB: {response.status_code}")
                return ComparisonResult(
                    id=course.id,
                    external_id=course.id,
                    name=course.name,
                    status=ComparisonStatus.NEW,
                )

            data = response.json()
            courses = data.get("courses", [])

            # Procurar match
            for existing in courses:
                # Match por slug e universidade
                slug_match = existing.get("slug") == course.slug
                uni_match = (
                    course.university_name and
                    existing.get("university", {}).get("name") and
                    self._normalize_name(existing["university"]["name"]) == self._normalize_name(course.university_name)
                )

                if slug_match or (self._normalize_name(existing.get("name", "")) == self._normalize_name(course.name) and uni_match):
                    changes = self._detect_changes(course, existing, [
                        "level", "duration", "description"
                    ])
                    if changes:
                        return ComparisonResult(
                            id=course.id,
                            external_id=existing.get("externalId"),
                            name=course.name,
                            status=ComparisonStatus.UPDATED,
                            changes=changes,
                        )
                    return ComparisonResult(
                        id=course.id,
                        external_id=existing.get("externalId"),
                        name=course.name,
                        status=ComparisonStatus.EXISTING,
                    )

            # Não encontrou match
            return ComparisonResult(
                id=course.id,
                external_id=course.id,
                name=course.name,
                status=ComparisonStatus.NEW,
            )

        except Exception as e:
            logger.error(f"Erro ao comparar curso: {e}")
            return ComparisonResult(
                id=course.id,
                external_id=course.id,
                name=course.name,
                status=ComparisonStatus.NEW,
            )

    def _detect_changes(
        self,
        new_item: Union[UniversityListing, CourseListing],
        existing: Dict[str, Any],
        fields: List[str],
    ) -> Optional[Dict[str, Any]]:
        """
        Detecta alterações entre item novo e existente.

        Args:
            new_item: Item extraído
            existing: Item do banco
            fields: Campos para comparar

        Returns:
            Dict de alterações ou None se não houver
        """
        changes = {}

        for field in fields:
            new_val = getattr(new_item, field, None)
            old_val = existing.get(field) or existing.get(self._camel_case(field))

            # Só considerar mudança se novo valor existe e é diferente
            if new_val and new_val != old_val:
                changes[field] = {
                    "old": old_val,
                    "new": new_val,
                }

        return changes if changes else None

    def _normalize_name(self, name: str) -> str:
        """Normaliza nome para comparação."""
        if not name:
            return ""
        # Lowercase, remover acentos, remover pontuação extra
        normalized = name.lower().strip()
        replacements = {
            'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a',
            'é': 'e', 'ê': 'e',
            'í': 'i',
            'ó': 'o', 'ô': 'o', 'õ': 'o',
            'ú': 'u', 'ü': 'u',
            'ç': 'c',
        }
        for old, new in replacements.items():
            normalized = normalized.replace(old, new)
        return normalized

    def _camel_case(self, snake_str: str) -> str:
        """Converte snake_case para camelCase."""
        components = snake_str.split('_')
        return components[0] + ''.join(x.title() for x in components[1:])


# Singleton instance
_dges_manual_extractor: Optional[DGESManualExtractor] = None


def get_dges_manual_extractor() -> DGESManualExtractor:
    """Obtém instância singleton do extractor."""
    global _dges_manual_extractor
    if not _dges_manual_extractor:
        _dges_manual_extractor = DGESManualExtractor()
    return _dges_manual_extractor
