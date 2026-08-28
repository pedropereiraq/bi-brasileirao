"""
Diagnóstico de acesso às fontes, do lugar onde o coletor for rodar.

Existe porque a API do Sofascore responde 200 na máquina do projeto e 403 no
runner do GitHub. Em vez de adivinhar o que passa e o que não passa de um IP de
datacenter, este script pergunta — e imprime uma tabela do que respondeu.

    python -m ferramentas.diagnostico_fontes

Rode local e no Actions e compare as duas saídas: a diferença entre elas é
exatamente o efeito do IP.
"""
from __future__ import annotations

import sys

CAMINHO_A = "/api/v1/unique-tournament/325/season/87678/events/round/1"

RESULTADOS: list[tuple[str, str, str]] = []


def registrar(fonte: str, situacao: str, detalhe: str) -> None:
    RESULTADOS.append((fonte, situacao, detalhe))
    print(f"  {situacao:4}  {fonte:44}  {detalhe}")


def testar_sofascore_curl_cffi() -> None:
    """A rota atual do coletor, com várias assinaturas TLS."""
    from curl_cffi import requests as cr

    for assinatura in ["chrome", "chrome124", "chrome131", "safari", "firefox"]:
        try:
            r = cr.get("https://api.sofascore.com" + CAMINHO_A,
                       impersonate=assinatura, timeout=30)
            n = len(r.json().get("events", [])) if r.ok else 0
            registrar(f"sofascore curl_cffi {assinatura}",
                      "OK" if r.ok else "NAO", f"HTTP {r.status_code}, {n} eventos")
        except Exception as e:
            registrar(f"sofascore curl_cffi {assinatura}", "ERRO",
                      f"{type(e).__name__}: {str(e)[:60]}")


def testar_sofascore_hosts() -> None:
    """Outros hosts que servem a mesma API — podem ter WAF diferente."""
    from curl_cffi import requests as cr

    for host in ["https://www.sofascore.com", "https://api.sofascore.app"]:
        try:
            r = cr.get(host + CAMINHO_A, impersonate="chrome", timeout=30)
            registrar(f"sofascore host {host}", "OK" if r.ok else "NAO",
                      f"HTTP {r.status_code}")
        except Exception as e:
            registrar(f"sofascore host {host}", "ERRO",
                      f"{type(e).__name__}: {str(e)[:60]}")


def testar_requests_simples() -> None:
    """Controle: sem assinatura de navegador, o esperado é 403 em qualquer IP."""
    from curl_cffi import requests

    try:
        r = requests.get("https://api.sofascore.com" + CAMINHO_A, timeout=30,
                         headers={"User-Agent": "Mozilla/5.0"})
        registrar("sofascore requests puro", "OK" if r.ok else "NAO",
                  f"HTTP {r.status_code}")
    except Exception as e:
        registrar("sofascore requests puro", "ERRO",
                  f"{type(e).__name__}: {str(e)[:60]}")


def testar_ge_globo() -> None:
    """
    A página do ge é renderizada no servidor: a classificação vem no HTML.
    Se ela passar do runner, é fonte alternativa viável para as duas séries.
    """
    from curl_cffi import requests

    cabecalhos = {
        "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/140.0.0.0 Safari/537.36"),
        "Accept-Language": "pt-BR,pt;q=0.9",
    }
    for serie, caminho in [("A", "brasileirao-serie-a"), ("B", "brasileirao-serie-b")]:
        url = f"https://ge.globo.com/futebol/{caminho}/"
        try:
            r = requests.get(url, headers=cabecalhos, timeout=30)
            tem_tabela = "CLASSIFICAÇÃO" in r.text.upper()
            registrar(f"ge.globo HTML Série {serie}",
                      "OK" if r.ok and tem_tabela else "NAO",
                      f"HTTP {r.status_code}, {len(r.content)//1024} KB, "
                      f"classificação no HTML: {tem_tabela}")
        except Exception as e:
            registrar(f"ge.globo HTML Série {serie}", "ERRO",
                      f"{type(e).__name__}: {str(e)[:60]}")


def testar_api_globo() -> None:
    """A API que a planilha usava. A especificação diz que saiu do ar; conferir."""
    from curl_cffi import requests

    candidatos = [
        "https://api.globoesporte.globo.com/tabela/campeonato-brasileiro/2026"
        "/fase/fase-unica-campeonato-brasileiro-2026/classificacao/",
        "https://api.globoesporte.globo.com/tabela/futebol/campeonato-brasileiro"
        "/2026/fase/fase-unica-campeonato-brasileiro-2026/classificacao/",
    ]
    for url in candidatos:
        try:
            r = requests.get(url, timeout=20,
                             headers={"User-Agent": "Mozilla/5.0"})
            registrar(f"api.globoesporte {url[-30:]}", "OK" if r.ok else "NAO",
                      f"HTTP {r.status_code}")
        except Exception as e:
            registrar(f"api.globoesporte {url[-30:]}", "ERRO",
                      f"{type(e).__name__}: {str(e)[:60]}")


def testar_wikipedia() -> None:
    """Último recurso: a Wikipédia mantém a grade de resultados das duas séries."""
    from curl_cffi import requests

    url = ("https://pt.wikipedia.org/w/api.php?action=parse&format=json"
           "&prop=wikitext&page=Campeonato_Brasileiro_de_Futebol_de_2026_-"
           "_S%C3%A9rie_A")
    try:
        r = requests.get(url, timeout=30,
                         headers={"User-Agent": "bi-brasileirao/0.1 (ECBahiaNumeros)"})
        tem = r.ok and "parse" in r.json()
        registrar("wikipedia Série A", "OK" if tem else "NAO",
                  f"HTTP {r.status_code}")
    except Exception as e:
        registrar("wikipedia Série A", "ERRO", f"{type(e).__name__}: {str(e)[:60]}")


def main() -> int:
    import platform

    print(f"python {sys.version.split()[0]} em {platform.system()} "
          f"{platform.machine()}")
    try:
        from curl_cffi import requests
        ip = requests.get("https://api.ipify.org?format=json", timeout=15).json()
        print(f"IP de saída: {ip.get('ip')}")
    except Exception as e:
        print(f"IP de saída: indisponível ({type(e).__name__})")
    print()

    for titulo, funcao in [
        ("Sofascore — assinaturas TLS", testar_sofascore_curl_cffi),
        ("Sofascore — hosts alternativos", testar_sofascore_hosts),
        ("Sofascore — controle sem assinatura", testar_requests_simples),
        ("ge.globo — HTML renderizado no servidor", testar_ge_globo),
        ("api.globoesporte — a fonte antiga", testar_api_globo),
        ("Wikipédia", testar_wikipedia),
    ]:
        print(f"{titulo}:")
        funcao()
        print()

    aprovados = [f for f, s, _ in RESULTADOS if s == "OK"]
    print(f"=== {len(aprovados)} de {len(RESULTADOS)} fontes acessíveis daqui ===")
    for fonte in aprovados:
        print(f"  OK  {fonte}")
    return 0 if aprovados else 1


if __name__ == "__main__":
    raise SystemExit(main())
