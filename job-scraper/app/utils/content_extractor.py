"""
Content Extractor — extrai conteúdo limpo de páginas HTML.

Migrado do clawlite/extractor.py.
Usa readability-lxml para isolar o conteúdo principal e
markdownify para converter em Markdown limpo.
"""

import re

from bs4 import BeautifulSoup
from markdownify import markdownify
from readability import Document

NOISE_TAGS = [
    "script", "style", "noscript", "nav", "footer", "header",
    "aside", "form", "iframe", "svg", "button", "input",
    "[document]", "head",
]

NOISE_CLASS_PATTERNS = re.compile(
    r"(ad|ads|advert|banner|cookie|popup|modal|overlay|sidebar|nav|menu|"
    r"footer|header|social|share|related|recommend|newsletter|subscribe|"
    r"comment|promo|widget|breadcrumb)",
    re.IGNORECASE,
)


def _remove_noise(soup: BeautifulSoup) -> BeautifulSoup:
    """Remove tags e classes de ruído (ads, menus, banners, etc.)."""
    for tag in soup(NOISE_TAGS):
        tag.decompose()

    for tag in soup.find_all(True):
        classes = " ".join(tag.get("class", []))
        tag_id = tag.get("id", "")
        if NOISE_CLASS_PATTERNS.search(classes) or NOISE_CLASS_PATTERNS.search(tag_id):
            tag.decompose()

    return soup


def extract_content(html: str, url: str = "") -> dict:
    """
    Extrai conteúdo principal de uma página HTML.

    Args:
        html: HTML bruto da página
        url: URL da página (para contexto)

    Returns:
        Dict com:
            - title: título da página
            - content_markdown: conteúdo em Markdown
            - word_count: contagem de palavras
    """
    doc = Document(html)
    title = doc.title() or ""
    main_html = doc.summary(html_partial=True)

    soup = BeautifulSoup(main_html, "lxml")
    soup = _remove_noise(soup)

    content_md = markdownify(
        str(soup),
        heading_style="ATX",
        bullets="-",
        strip=["a"],
    ).strip()

    content_md = _clean_markdown(content_md)
    words = content_md.split()

    return {
        "title": title.strip(),
        "content_markdown": content_md,
        "word_count": len(words),
    }


def _clean_markdown(text: str) -> str:
    """Remove linhas em branco excessivas e espaços desnecessários."""
    # Colapsa 3+ linhas em branco para 2
    text = re.sub(r"\n{3,}", "\n\n", text)
    lines = [line if line.strip() else "" for line in text.splitlines()]
    return "\n".join(lines).strip()
