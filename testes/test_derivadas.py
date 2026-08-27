"""
Tabelas derivadas: estrutura, completude e consistência entre as três.

O que se prova aqui é que as três fato compartilham a chave de variação e que o
join entre elas fecha — é isso que sustenta cruzar posição de um clube com a
pontuação típica daquela posição.
"""
from __future__ import annotations

import itertools

import pandas as pd
import pytest

from bi import config as cfg
from bi import derivadas


@pytest.fixture(scope="module")
def jogos_bi(jogos_historicos) -> pd.DataFrame:
    """Duas edições completas bastam para provar a estrutura — e são rápidas."""
    return jogos_historicos[jogos_historicos["ano"].isin([2019, 2020])]


@pytest.fixture(scope="module")
def clube_etapa(jogos_bi) -> pd.DataFrame:
    return derivadas.fato_clube_etapa(jogos_bi)


@pytest.fixture(scope="module")
def posicao_etapa(clube_etapa) -> pd.DataFrame:
    return derivadas.fato_posicao_etapa(clube_etapa)


# ------------------------------------------------------------ variações
def test_todas_as_combinacoes_de_variacao_existem(clube_etapa):
    combinacoes = set(
        clube_etapa[["ordem", "criterio", "local"]]
        .drop_duplicates().itertuples(index=False, name=None)
    )
    esperadas = set(itertools.product(cfg.ORDENS, cfg.CRITERIOS, cfg.LOCAIS))
    assert combinacoes == esperadas


def test_a_variacao_e_coluna_e_nao_tabela(clube_etapa):
    """A garantia estrutural que o modelo inteiro assume."""
    for coluna in derivadas.VARIACAO:
        assert coluna in clube_etapa.columns


@pytest.mark.parametrize(
    ("ordem", "local", "etapas"),
    [("rodada", "todos", 38), ("rodada", "casa", 38), ("rodada", "fora", 38),
     ("data", "todos", 38), ("data", "casa", 19), ("data", "fora", 19)],
)
def test_a_grade_de_etapas_e_completa(clube_etapa, ordem, local, etapas):
    """
    Todo clube tem linha em toda etapa, mesmo nas em que não jogou — sem isso o
    recorte por mando produziria tabelas com menos de 20 clubes.
    """
    recorte = clube_etapa[
        (clube_etapa["ordem"] == ordem) & (clube_etapa["local"] == local)
        & (clube_etapa["criterio"] == "ST")
    ]
    por_edicao = recorte.groupby(["ano", "serie"], observed=True)
    assert (por_edicao["etapa"].max() == etapas).all()
    assert (por_edicao.size() == cfg.CLUBES_POR_SERIE * etapas).all()


def test_o_recorte_por_mando_soma_o_recorte_completo(clube_etapa):
    """casa + fora tem de reconstruir `todos` na última etapa da edição."""
    final = clube_etapa[
        (clube_etapa["ordem"] == "rodada") & (clube_etapa["criterio"] == "ST")
        & (clube_etapa["etapa"] == 38)
    ]
    soma = (
        final[final["local"].isin(["casa", "fora"])]
        .groupby(["ano", "serie", "equipe"], observed=True)[["pts", "j", "v", "gp_ac"]]
        .sum()
    )
    todos = (
        final[final["local"] == "todos"]
        .set_index(["ano", "serie", "equipe"])[["pts", "j", "v", "gp_ac"]]
    )
    pd.testing.assert_frame_equal(
        soma.sort_index(), todos.sort_index(), check_dtype=False
    )


# ------------------------------------------------------ coerência interna
def test_pontos_conferem_com_vitorias_e_empates(clube_etapa):
    """No critério ST, pontos são exatamente 3V + E. Sem exceção."""
    apenas_st = clube_etapa[clube_etapa["criterio"] == "ST"]
    assert (apenas_st["pts"] == 3 * apenas_st["v"] + apenas_st["e"]).all()


def test_ct_e_st_diferem_exatamente_pelo_tapetao(clube_etapa):
    chave = ["ano", "serie", "ordem", "local", "etapa", "equipe"]
    st = clube_etapa[clube_etapa["criterio"] == "ST"].set_index(chave).sort_index()
    ct = clube_etapa[clube_etapa["criterio"] == "CT"].set_index(chave).sort_index()
    assert (ct["pts"] == st["pts"] + ct["tap_ac"]).all()


def test_jogos_batem_com_vitorias_empates_e_derrotas(clube_etapa):
    assert (clube_etapa["j"]
            == clube_etapa["v"] + clube_etapa["e"] + clube_etapa["d"]).all()


def test_saldo_bate_com_gols(clube_etapa):
    assert (clube_etapa["sg_ac"]
            == clube_etapa["gp_ac"] - clube_etapa["gc_ac"]).all()


# ------------------------------------------------------------ o espelho
def test_posicao_etapa_e_o_espelho_de_clube_etapa(clube_etapa, posicao_etapa):
    assert len(posicao_etapa) == len(clube_etapa)
    chave = derivadas.CHAVE + ["pos"]
    assert not posicao_etapa.duplicated(chave).any()


def test_o_join_entre_as_duas_fecha(clube_etapa, posicao_etapa):
    """
    O cruzamento que motiva o modelo: a posição de um clube numa etapa e quem
    de fato ocupa aquela posição têm de ser o mesmo clube.
    """
    chave = derivadas.CHAVE + ["pos"]
    junta = clube_etapa.merge(
        posicao_etapa[chave + ["equipe_na_posicao", "pts_da_posicao"]],
        on=chave, how="left",
    )
    assert junta["equipe_na_posicao"].notna().all()
    assert (junta["equipe"].astype(str)
            == junta["equipe_na_posicao"].astype(str)).all()
    assert (junta["pts"] == junta["pts_da_posicao"]).all()


# --------------------------------------------------------- o histórico
def test_pontuacao_etapa_agrega_so_edicoes_fechadas(jogos_bi, clube_etapa):
    completas = derivadas.edicoes_completas(jogos_bi)
    fato = derivadas.fato_pontuacao_etapa(clube_etapa, completas)
    assert fato["ano_primeiro"].min() >= 2019
    assert fato["ano_ultimo"].max() <= 2020
    assert (fato["n_ocorrencias"] >= 1).all()
    assert (fato["pos_min"] <= fato["pos_media"]).all()
    assert (fato["pos_media"] <= fato["pos_max"]).all()
    assert fato["pos_fim_media"].notna().all(), (
        "edição sem posição final entrou no histórico"
    )


def test_edicao_em_andamento_fica_de_fora_do_historico(jogos_bi):
    """Uma edição com jogo pendente não pode contaminar a estatística."""
    com_pendencia = jogos_bi.copy()
    alvo = com_pendencia.index[0]
    com_pendencia.loc[alvo, "status"] = cfg.STATUS_AGENDADO
    completas = derivadas.edicoes_completas(com_pendencia)
    edicao = (com_pendencia.loc[alvo, "ano"], com_pendencia.loc[alvo, "serie"])
    assert edicao not in completas


def test_a_frequencia_total_bate_com_o_numero_de_campanhas(jogos_bi, clube_etapa):
    """
    Somando as ocorrências de todas as pontuações de uma etapa, tem de dar o
    número de clubes vezes o número de edições fechadas.
    """
    completas = derivadas.edicoes_completas(jogos_bi)
    fato = derivadas.fato_pontuacao_etapa(clube_etapa, completas)
    recorte = fato[(fato["serie"] == "A") & (fato["ordem"] == "rodada")
                   & (fato["criterio"] == "ST") & (fato["local"] == "todos")
                   & (fato["etapa"] == 38)]
    edicoes = len({a for a, s in completas if s == "A"})
    assert recorte["n_ocorrencias"].sum() == cfg.CLUBES_POR_SERIE * edicoes
