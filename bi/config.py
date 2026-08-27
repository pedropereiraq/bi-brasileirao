"""Caminhos, constantes e parâmetros de fonte. Único lugar com valor mágico."""
from __future__ import annotations

import os
from datetime import timedelta, timezone
from pathlib import Path

# ---------------------------------------------------------------- caminhos
RAIZ = Path(os.environ.get("BI_RAIZ", Path(__file__).resolve().parent.parent))

FONTES = RAIZ / "fontes"
DADOS = RAIZ / "dados"
BRUTO = DADOS / "bruto" / "sofascore"
CANONICO = DADOS / "canonico"
DERIVADO = DADOS / "derivado"

EXCEL_HISTORICO = Path(
    os.environ.get("BI_EXCEL", FONTES / "Histórico Campeonato Brasileiro.xlsx")
)
DE_PARA_CLUBES = FONTES / "de_para_clubes.csv"

# Jogos coletados da edição corrente, um arquivo por série/ano.
def caminho_jogos_corrente(serie: str, ano: int) -> Path:
    return DADOS / "corrente" / f"jogos_{serie}{ano}.csv"


def garantir_pastas() -> None:
    for p in (BRUTO, CANONICO, DERIVADO, DADOS / "corrente"):
        p.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------- domínio
FUSO = timezone(timedelta(hours=-3))  # America/Sao_Paulo, sem horário de verão

# O BI trabalha só com a era dos pontos corridos com 20 clubes.
# A camada canônica guarda desde 1937; as derivadas começam aqui.
ANO_INICIO_BI = 2006
FASE_UNICA = "Única"
RODADAS = 38
CLUBES_POR_SERIE = 20

SERIES = ("A", "B")

# Dimensões de variação das tabelas derivadas (colunas, não tabelas).
ORDENS = ("rodada", "data")
CRITERIOS = ("ST", "CT")  # ST = sem tapetão, CT = com tapetão
LOCAIS = ("todos", "casa", "fora")

# Critérios de desempate, nesta ordem. O último é a ordem alfabética do nome
# do clube — determinístico e documentado no site (docs/decisoes.md).
DESEMPATE = ("pts", "v", "sg_ac", "gp_ac", "equipe")

# Estados de um jogo.
STATUS_REALIZADO = "realizado"
STATUS_AGENDADO = "agendado"
STATUS_ADIADO = "adiado"
STATUS_CANCELADO = "cancelado"
# Jogo que a competição deu por encerrado sem ser disputado e sem placar
# atribuído: gera etapa, não conta como jogo, não altera acumulados.
# Caso conhecido: 2016, Série A, rodada 38, Chapecoense x Atlético-MG.
STATUS_NAO_REALIZADO = "nao_realizado"

# ---------------------------------------------------------------- sofascore
SOFASCORE_BASE = "https://api.sofascore.com/api/v1"

TORNEIOS = {"A": 325, "B": 390}

# Cache de ids de temporada já conferidos. Ano ausente cai em descobrir_temporada().
TEMPORADAS = {
    ("A", 2026): 87678,
    ("B", 2026): 89840,
    ("A", 2025): 72034,
    ("B", 2025): 72603,
}

# A API rejeita cliente que não tenha assinatura TLS de navegador (403 seco em
# requests, curl e qualquer combinação de cabeçalhos). curl_cffi resolve.
IMPERSONACAO = os.environ.get("BI_IMPERSONACAO", "chrome")
PAUSA_ENTRE_REQUISICOES = float(os.environ.get("BI_PAUSA", "0.4"))
