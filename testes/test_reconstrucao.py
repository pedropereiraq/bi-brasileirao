"""
A camada derivada é derivada mesmo?

O compromisso do projeto é que nada seja digitado à mão: apagar `dados/derivado`
e recalcular tem de devolver exatamente o que está versionado. Este teste
refaz as três fato a partir de `dados/canonico/jogos.parquet` e compara com os
parquets do repositório, linha a linha.

A comparação é por conteúdo, não por bytes: o parquet é determinístico dentro de
um mesmo ambiente, mas o cabeçalho carrega a versão do pyarrow, e comparar bytes
faria o CI quebrar a cada atualização de dependência sem que dado nenhum tivesse
mudado.

Se `dados/` ainda não foi construído, os testes são pulados em vez de falhar —
num clone novo o banco pode não ter sido gerado ainda.
"""
from __future__ import annotations

import pandas as pd
import pytest

from bi import canonico
from bi import config as cfg
from bi import derivadas

TABELAS = ["fato_clube_etapa", "fato_posicao_etapa", "fato_pontuacao_etapa"]


@pytest.fixture(scope="module")
def jogos() -> pd.DataFrame:
    caminho = cfg.CANONICO / "jogos.parquet"
    if not caminho.exists():
        pytest.skip("banco não construído — rode `python -m bi construir`")
    return canonico.carregar_jogos()


@pytest.fixture(scope="module")
def recalculadas(jogos) -> dict[str, pd.DataFrame]:
    clube_etapa = derivadas.fato_clube_etapa(jogos)
    return {
        "fato_clube_etapa": clube_etapa,
        "fato_posicao_etapa": derivadas.fato_posicao_etapa(clube_etapa),
        "fato_pontuacao_etapa": derivadas.fato_pontuacao_etapa(
            clube_etapa, derivadas.edicoes_completas(jogos)
        ),
    }


@pytest.mark.parametrize("nome", TABELAS)
def test_a_tabela_versionada_bate_com_o_recalculo(nome, recalculadas):
    caminho = cfg.DERIVADO / f"{nome}.parquet"
    if not caminho.exists():
        pytest.skip("banco não construído — rode `python -m bi construir`")
    versionada = derivadas.carregar(nome)
    pd.testing.assert_frame_equal(
        versionada.reset_index(drop=True),
        recalculadas[nome].reset_index(drop=True),
        check_dtype=False, check_categorical=False,
    )


def test_o_canonico_cobre_a_edicao_corrente(jogos):
    """A coleta tem de estar dentro do canônico, e não só no CSV do coletor."""
    correntes = sorted(
        p.stem.removeprefix("jogos_") for p in (cfg.DADOS / "corrente").glob("*.csv")
    ) if (cfg.DADOS / "corrente").exists() else []
    if not correntes:
        pytest.skip("nenhuma coleta corrente em disco")

    do_sofascore = jogos[jogos["origem"] == "sofascore"]
    assert not do_sofascore.empty, "a coleta não chegou ao canônico"
    for edicao in correntes:
        serie, ano = edicao[0], int(edicao[1:])
        recorte = do_sofascore[
            (do_sofascore["serie"] == serie) & (do_sofascore["ano"] == ano)
        ]
        assert len(recorte) == cfg.CLUBES_POR_SERIE * (cfg.CLUBES_POR_SERIE - 1), (
            f"{edicao}: {len(recorte)} jogos no canônico"
        )


def test_o_excel_nao_disputa_ano_com_a_coleta(jogos):
    """Uma edição vem de uma fonte só — senão o mesmo jogo entraria duas vezes."""
    fontes_por_edicao = jogos.groupby(["ano", "serie"])["origem"].nunique()
    conflitantes = fontes_por_edicao[fontes_por_edicao > 1]
    assert conflitantes.empty, (
        "edições com duas origens:\n" + conflitantes.to_string()
    )
