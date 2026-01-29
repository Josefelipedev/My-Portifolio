"""
HTML Cleaner - Prepara HTML para processamento AI.

Remove elementos desnecessarios e reduz tamanho para economizar tokens.
"""

import re
from typing import Optional
from bs4 import BeautifulSoup, Comment


def clean_html_for_ai(
    html: str,
    max_length: int = 15000,
    keep_links: bool = True,
    keep_lists: bool = True,
) -> str:
    """
    Limpa HTML para enviar para AI.

    Remove:
    - Scripts, styles, noscript
    - Comentarios HTML
    - Atributos desnecessarios
    - Whitespace excessivo
    - Header, footer, nav (exceto se contem job data)

    Mantem:
    - Texto relevante
    - Links (se keep_links=True)
    - Listas (se keep_lists=True)

    Args:
        html: HTML original
        max_length: Tamanho maximo do resultado
        keep_links: Manter tags <a> com href
        keep_lists: Manter tags <ul>, <ol>, <li>

    Returns:
        HTML limpo e reduzido
    """
    soup = BeautifulSoup(html, "lxml")

    # Remover tags que nunca tem conteudo util
    for tag in soup.select("script, style, noscript, iframe, svg, canvas"):
        tag.decompose()

    # Remover comentarios HTML
    for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
        comment.extract()

    # Remover header/footer/nav se nao tiverem links de vagas
    for tag_name in ["header", "footer", "nav", "aside"]:
        for tag in soup.select(tag_name):
            # Verificar se tem links de vagas antes de remover
            has_job_links = any(
                "vaga" in str(a.get("href", "")).lower() or
                "job" in str(a.get("href", "")).lower()
                for a in tag.select("a[href]")
            )
            if not has_job_links:
                tag.decompose()

    # Remover atributos desnecessarios de todas as tags
    attrs_to_keep = {"href", "src", "alt", "title", "class", "id", "data-testid"}

    for tag in soup.find_all(True):
        attrs_to_remove = [
            attr for attr in tag.attrs
            if attr not in attrs_to_keep
        ]
        for attr in attrs_to_remove:
            del tag[attr]

    # Simplificar classes (manter apenas as relevantes)
    job_class_keywords = {"job", "vaga", "card", "listing", "title", "company", "salary", "location"}

    for tag in soup.find_all(class_=True):
        classes = tag.get("class", [])
        relevant_classes = [
            c for c in classes
            if any(keyword in c.lower() for keyword in job_class_keywords)
        ]
        if relevant_classes:
            tag["class"] = relevant_classes
        else:
            del tag["class"]

    # Converter para string
    result = str(soup)

    # Limpar whitespace excessivo
    result = re.sub(r'\n\s*\n', '\n', result)
    result = re.sub(r'  +', ' ', result)
    result = result.strip()

    # Truncar se necessario
    if len(result) > max_length:
        # Tentar truncar em um ponto logico
        result = result[:max_length]
        # Fechar tags abertas (simplificado)
        result = result.rsplit('<', 1)[0]

    return result


def extract_text_content(html: str, max_length: int = 10000) -> str:
    """
    Extrai apenas o texto do HTML.

    Util quando precisamos de menos contexto para AI.

    Args:
        html: HTML original
        max_length: Tamanho maximo

    Returns:
        Texto extraido
    """
    soup = BeautifulSoup(html, "lxml")

    # Remover elementos nao-conteudo
    for tag in soup.select("script, style, noscript, header, footer, nav"):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)

    # Limpar linhas vazias
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    text = "\n".join(lines)

    if len(text) > max_length:
        text = text[:max_length]

    return text


def find_job_container(html: str) -> Optional[str]:
    """
    Tenta identificar o container principal de vagas.

    Retorna apenas o HTML desse container para economizar tokens.

    Args:
        html: HTML completo

    Returns:
        HTML do container de vagas ou None
    """
    soup = BeautifulSoup(html, "lxml")

    # Seletores comuns para containers de vagas
    job_selectors = [
        '[data-testid*="job"]',
        '[data-testid*="listing"]',
        '.job-list',
        '.jobs-list',
        '.vagas-list',
        '#job-listings',
        '#vagas',
        'main',
        '[role="main"]',
    ]

    for selector in job_selectors:
        container = soup.select_one(selector)
        if container:
            # Verificar se tem conteudo relevante
            text = container.get_text(strip=True)
            if len(text) > 200:
                return str(container)

    return None
