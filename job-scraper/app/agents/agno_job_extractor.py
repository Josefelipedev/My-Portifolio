"""
Agno Job Extractor - Extrai vagas usando AI.

Usa Together AI (Llama 3.3) para extrair vagas de HTML quando
o parsing tradicional falha ou retorna poucos resultados.
"""

import json
import logging
import os
import re
import time
from typing import List, Optional, Dict, Any

from together import Together

from models import JobListing, JobSource
from utils.html_cleaner import clean_html_for_ai, find_job_container

logger = logging.getLogger(__name__)


class AgnoJobExtractor:
    """
    Extrai vagas de emprego usando AI.

    Estrategia de economia de tokens:
    1. Limpa HTML antes de enviar
    2. Tenta encontrar container de vagas
    3. Usa prompts curtos e diretos
    4. Cache de resultados (futuro)
    """

    def __init__(self):
        api_key = os.getenv("TOGETHER_API_KEY")
        if not api_key:
            logger.warning("TOGETHER_API_KEY not set, AI extraction disabled")
            self.client = None
        else:
            self.client = Together(api_key=api_key)

        self.model = "meta-llama/Llama-3.3-70B-Instruct-Turbo"
        self.max_tokens = 4000
        self.temperature = 0.1

        # Stats tracking
        self._stats = {
            "total_extractions": 0,
            "successful_extractions": 0,
            "total_tokens_used": 0,
            "total_jobs_found": 0,
        }

    def is_available(self) -> bool:
        """Verifica se AI extraction esta disponivel."""
        return self.client is not None

    async def extract_jobs(
        self,
        html: str,
        source: str,
        max_jobs: int = 50,
    ) -> List[JobListing]:
        """
        Extrai vagas do HTML usando AI.

        Args:
            html: HTML da pagina
            source: Nome da fonte (geekhunter, vagascombr, etc.)
            max_jobs: Numero maximo de vagas para extrair

        Returns:
            Lista de JobListing extraidas
        """
        if not self.is_available():
            logger.warning("AI extraction not available (no API key)")
            return []

        self._stats["total_extractions"] += 1
        start_time = time.time()

        try:
            # Tentar encontrar container de vagas primeiro
            job_container = find_job_container(html)
            if job_container:
                html_to_process = job_container
                logger.info("Usando container de vagas encontrado")
            else:
                html_to_process = html

            # Limpar HTML para AI
            cleaned_html = clean_html_for_ai(html_to_process, max_length=12000)

            # Criar prompt
            prompt = self._build_extraction_prompt(cleaned_html, source, max_jobs)

            # Chamar AI
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=self.max_tokens,
                temperature=self.temperature,
            )

            # Extrair resposta
            content = response.choices[0].message.content

            # Atualizar stats
            tokens_used = getattr(response.usage, 'total_tokens', 0)
            self._stats["total_tokens_used"] += tokens_used

            # Parse JSON da resposta
            jobs = self._parse_ai_response(content, source)

            self._stats["successful_extractions"] += 1
            self._stats["total_jobs_found"] += len(jobs)

            duration = time.time() - start_time
            logger.info(
                f"AI extraction: {len(jobs)} vagas em {duration:.2f}s, "
                f"{tokens_used} tokens"
            )

            return jobs[:max_jobs]

        except Exception as e:
            logger.error(f"AI extraction failed: {e}")
            return []

    def _build_extraction_prompt(
        self,
        html: str,
        source: str,
        max_jobs: int,
    ) -> str:
        """Constroi prompt para extracao."""
        return f"""Extraia as vagas de emprego deste HTML de {source}.

Para cada vaga encontrada, retorne um objeto JSON com:
- title: titulo da vaga
- company: nome da empresa
- location: localizacao (cidade/estado ou "Remoto")
- url: URL da vaga (href do link)
- salary: salario se mencionado (ou null)
- tags: array de tecnologias/skills mencionadas

Retorne APENAS um array JSON valido, sem texto adicional.
Extraia no maximo {max_jobs} vagas.

Exemplo de resposta:
[{{"title": "Dev Python", "company": "TechCorp", "location": "Remoto", "url": "/vagas/123", "salary": null, "tags": ["Python", "Django"]}}]

HTML:
{html}"""

    def _parse_ai_response(
        self,
        content: str,
        source: str,
    ) -> List[JobListing]:
        """Parse resposta da AI para JobListing."""
        jobs = []

        try:
            # Tentar extrair JSON da resposta
            json_match = re.search(r'\[[\s\S]*\]', content)
            if not json_match:
                logger.warning("No JSON array found in AI response")
                return []

            json_str = json_match.group()
            data = json.loads(json_str)

            if not isinstance(data, list):
                logger.warning("AI response is not a list")
                return []

            # Mapear source para JobSource enum
            source_map = {
                "geekhunter": JobSource.GEEKHUNTER,
                "vagascombr": JobSource.VAGASCOMBR,
                "linkedin": JobSource.LINKEDIN,
            }
            job_source = source_map.get(source.lower(), JobSource.GEEKHUNTER)

            for i, item in enumerate(data):
                if not isinstance(item, dict):
                    continue

                title = item.get("title", "").strip()
                if not title:
                    continue

                # Gerar ID unico
                job_id = f"ai-{source}-{i}-{hash(title) % 10000}"

                # Normalizar URL
                url = item.get("url", "")
                if url and not url.startswith("http"):
                    # Adicionar base URL se necessario
                    base_urls = {
                        "geekhunter": "https://www.geekhunter.com.br",
                        "vagascombr": "https://www.vagas.com.br",
                    }
                    base = base_urls.get(source.lower(), "")
                    url = f"{base}{url}"

                jobs.append(
                    JobListing(
                        id=job_id,
                        source=job_source,
                        title=title,
                        company=item.get("company", "Empresa nao identificada"),
                        description="",
                        url=url,
                        location=item.get("location", "Brasil"),
                        job_type="On-site",
                        salary=item.get("salary"),
                        tags=item.get("tags", []) or [],
                        posted_at=None,
                        country="br",
                    )
                )

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI JSON: {e}")
        except Exception as e:
            logger.error(f"Error parsing AI response: {e}")

        return jobs

    def get_stats(self) -> Dict[str, Any]:
        """Retorna estatisticas de uso."""
        return {
            **self._stats,
            "model": self.model,
            "available": self.is_available(),
        }


# Singleton instance
_agno_extractor: Optional[AgnoJobExtractor] = None


def get_agno_job_extractor() -> AgnoJobExtractor:
    """Obtem instancia singleton do extractor."""
    global _agno_extractor
    if _agno_extractor is None:
        _agno_extractor = AgnoJobExtractor()
    return _agno_extractor
