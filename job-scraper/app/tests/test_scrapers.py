import pytest
from unittest.mock import patch, AsyncMock
from scrapers.geekhunter import GeekHunterScraper
from scrapers.vagas import VagasComBrScraper
from models import JobSource


# Sample HTML responses for testing
GEEKHUNTER_HTML = """
<html>
<body>
    <div class="job-card">
        <a href="/vagas/123-desenvolvedor-python">
            <h2>Desenvolvedor Python Senior</h2>
        </a>
        <div class="company">TechCorp</div>
        <div class="location">São Paulo - SP</div>
        <span class="tag">Python</span>
        <span class="tag">Django</span>
    </div>
    <div class="job-card">
        <a href="/vagas/456-desenvolvedor-fullstack">
            <h2>Desenvolvedor Full Stack</h2>
        </a>
        <div class="company">StartupXYZ</div>
        <div class="location">Remoto</div>
        <span class="tag">React</span>
        <span class="tag">Node.js</span>
    </div>
</body>
</html>
"""

VAGAS_HTML = """
<html>
<body>
    <li>
        <a class="link-detalhes-vaga" href="/vagas/123" title="Analista de Sistemas">
            Analista de Sistemas
        </a>
        <span class="emprVaga">Empresa ABC</span>
        <span class="vaga-local">Rio de Janeiro - RJ</span>
        <span class="nivelVaga">Pleno</span>
    </li>
    <li>
        <a class="link-detalhes-vaga" href="/vagas/456" title="Desenvolvedor Java">
            Desenvolvedor Java
        </a>
        <span class="emprVaga">Corp Tech</span>
        <span class="vaga-local">Curitiba - PR</span>
        <span class="nivelVaga">Senior</span>
    </li>
</body>
</html>
"""


class TestGeekHunterScraper:
    """Tests for GeekHunter scraper"""

    def test_generate_id(self):
        scraper = GeekHunterScraper()
        job_id = scraper.generate_id("abc123")
        assert job_id == "geekhunter-abc123"

    def test_parse_html(self):
        scraper = GeekHunterScraper()
        jobs = scraper._parse_html(GEEKHUNTER_HTML, limit=10)

        assert len(jobs) == 2

        # Check first job
        assert jobs[0].title == "Desenvolvedor Python Senior"
        assert jobs[0].company == "TechCorp"
        assert jobs[0].source == JobSource.GEEKHUNTER
        assert "Python" in jobs[0].tags

        # Check second job
        assert jobs[1].title == "Desenvolvedor Full Stack"
        assert jobs[1].company == "StartupXYZ"

    def test_parse_html_with_limit(self):
        scraper = GeekHunterScraper()
        jobs = scraper._parse_html(GEEKHUNTER_HTML, limit=1)

        assert len(jobs) == 1


class TestVagasComBrScraper:
    """Tests for Vagas.com.br scraper"""

    def test_generate_id(self):
        scraper = VagasComBrScraper()
        job_id = scraper.generate_id("xyz789")
        assert job_id == "vagascombr-xyz789"

    def test_parse_html(self):
        scraper = VagasComBrScraper()
        jobs = scraper._parse_html(VAGAS_HTML, limit=10)

        assert len(jobs) == 2

        # Check first job
        assert jobs[0].title == "Analista de Sistemas"
        assert jobs[0].company == "Empresa ABC"
        assert jobs[0].source == JobSource.VAGASCOMBR
        assert jobs[0].location == "Rio de Janeiro - RJ"

        # Check second job
        assert jobs[1].title == "Desenvolvedor Java"
        assert "Senior" in jobs[1].tags

    def test_parse_html_with_limit(self):
        scraper = VagasComBrScraper()
        jobs = scraper._parse_html(VAGAS_HTML, limit=1)

        assert len(jobs) == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
