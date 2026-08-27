"""
O teste que sustenta o projeto: o motor tem de reproduzir a matriz do Excel.

São 30.400 linhas (2006–2025, Séries A e B, 20 clubes, 38 rodadas) calculadas ao
longo de anos no Power BI. Se qualquer coluna divergir de qualquer linha, alguma
regra foi quebrada — e a divergência é impressa com nome, ano e rodada, para
não sobrar dúvida sobre o que mudou.
"""
from __future__ import annotations

import pandas as pd
import pytest

CHAVE = ["ano", "serie", "etapa", "equipe"]

# (coluna da matriz, coluna do motor). Tudo o que a matriz materializa e que o
# motor também produz. Nada aqui é opcional.
COLUNAS_ACUMULADAS = [
    ("pts", "pts"),
    ("tap_ac", "tap_ac"),
    ("j", "j"),
    ("v", "v"),
    ("e", "e"),
    ("d", "d"),
    ("gp_ac", "gp_ac"),
    ("gc_ac", "gc_ac"),
    ("sg_ac", "sg_ac"),
]


@pytest.fixture(scope="module")
def comparacao(matriz_excel, campanha_st, campanha_ct) -> pd.DataFrame:
    """Matriz e motor lado a lado, uma linha por (ano, série, rodada, clube)."""
    calculado = campanha_st[CHAVE + [c for _, c in COLUNAS_ACUMULADAS]
                            + ["pos", "pos_fim"]].rename(
        columns={"pos": "pos_st", "pos_fim": "pos_fim_st"})
    com_tapetao = campanha_ct[CHAVE + ["pos", "pos_fim"]].rename(
        columns={"pos": "pos_ct", "pos_fim": "pos_fim_ct"})
    calculado = calculado.merge(com_tapetao, on=CHAVE)

    esperado = matriz_excel[
        CHAVE + [m for m, _ in COLUNAS_ACUMULADAS]
        + ["pos_st", "pos_ct", "pos_fim_st", "pos_fim_ct", "jogo_num"]
    ]
    return esperado.merge(calculado, on=CHAVE, how="left", suffixes=("_excel", ""))


def _divergencias(comparacao: pd.DataFrame, coluna: str) -> pd.DataFrame:
    esquerda = comparacao[f"{coluna}_excel"].astype("float64")
    direita = comparacao[coluna].astype("float64")
    return comparacao[esquerda != direita]


def test_todas_as_linhas_da_matriz_foram_reproduzidas(comparacao, matriz_excel):
    """Nenhuma linha da matriz pode ficar sem par no cálculo."""
    assert len(comparacao) == len(matriz_excel) == 30_400
    orfas = comparacao[comparacao["pts"].isna()]
    assert orfas.empty, (
        f"{len(orfas)} linhas da matriz sem correspondente no motor:\n"
        f"{orfas[CHAVE].head(10).to_string(index=False)}"
    )


@pytest.mark.parametrize(("coluna_excel", "coluna_motor"), COLUNAS_ACUMULADAS)
def test_acumulados_batem_com_a_matriz(comparacao, coluna_excel, coluna_motor):
    divergentes = _divergencias(comparacao, coluna_motor)
    assert divergentes.empty, (
        f"{len(divergentes)} divergências em {coluna_motor}:\n"
        + divergentes[CHAVE + [f"{coluna_motor}_excel", coluna_motor]]
        .head(15).to_string(index=False)
    )


@pytest.mark.parametrize("coluna", ["pos_st", "pos_ct", "pos_fim_st", "pos_fim_ct"])
def test_posicoes_batem_com_a_matriz(comparacao, coluna):
    """
    A posição é o resultado mais sensível: depende dos acumulados e de toda a
    cadeia de desempate. Bater aqui é bater em tudo.
    """
    divergentes = _divergencias(comparacao, coluna)
    assert divergentes.empty, (
        f"{len(divergentes)} divergências em {coluna}:\n"
        + divergentes[CHAVE + [f"{coluna}_excel", coluna]]
        .head(15).to_string(index=False)
    )


def test_jogo_num_bate_com_a_ordem_por_data(matriz_excel, campanha_por_data):
    """
    A coluna `JOGO NUM` da matriz é exatamente a etapa na ordem cronológica —
    é o que sustenta a variação `ordem='data'` das tabelas derivadas.
    """
    esperado = matriz_excel[CHAVE + ["jogo_num"]].rename(columns={"etapa": "rodada"})
    calculado = campanha_por_data[["ano", "serie", "equipe", "rodada", "etapa"]]
    junta = esperado.merge(
        calculado, on=["ano", "serie", "equipe", "rodada"], how="left"
    )
    divergentes = junta[junta["jogo_num"].astype("float64") != junta["etapa"].astype("float64")]
    assert divergentes.empty, (
        f"{len(divergentes)} divergências em JOGO NUM:\n"
        + divergentes.head(15).to_string(index=False)
    )
