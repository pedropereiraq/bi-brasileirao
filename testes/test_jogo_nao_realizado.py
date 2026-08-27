"""
Jogo não realizado: Chapecoense x Atlético-MG, 2016, Série A, rodada 38.

Depois da tragédia da Chapecoense o jogo não foi disputado e ninguém recebeu
pontos. A tentação é descartar a linha sem placar — e é errado: os dois clubes
sumiriam da rodada 38 e todo mundo abaixo deles subiria duas posições, o que
contamina 17 linhas da matriz.

O comportamento correto, que é o que a matriz do Excel registra:

    - a etapa 38 existe para os dois clubes;
    - `J` continua 37 — o jogo não aconteceu, não conta;
    - pontos, vitórias, gols e saldo ficam idênticos aos da rodada 37;
    - os dois seguem ocupando posição na tabela da rodada 38.

Este arquivo trava esse comportamento e trava também a consequência: ninguém
mais na rodada 38 de 2016 pode ter mudado de lugar por causa disso.
"""
from __future__ import annotations

import pandas as pd
import pytest

from bi import config as cfg
from bi import motor

ANO = 2016
SERIE = "A"
ENVOLVIDOS = ["CHAPECOENSE (SC)", "ATLÉTICO (MG)"]


@pytest.fixture(scope="module")
def jogo_2016(jogos_historicos) -> pd.Series:
    recorte = jogos_historicos[
        (jogos_historicos["ano"] == ANO)
        & (jogos_historicos["serie"] == SERIE)
        & (jogos_historicos["rodada"] == 38)
        & (jogos_historicos["mandante"] == "CHAPECOENSE (SC)")
    ]
    assert len(recorte) == 1
    return recorte.iloc[0]


def test_o_jogo_e_classificado_como_nao_realizado(jogo_2016):
    assert jogo_2016["status"] == cfg.STATUS_NAO_REALIZADO
    assert pd.isna(jogo_2016["gols_m"]) and pd.isna(jogo_2016["gols_v"])
    assert jogo_2016["visitante"] == "ATLÉTICO (MG)"


def test_e_o_unico_jogo_sem_desfecho_na_era_dos_pontos_corridos(jogos_historicos):
    """
    Se aparecer um segundo caso, o tratamento precisa ser revisto conscientemente
    em vez de herdar por acidente a regra escrita para 2016.
    """
    sem_desfecho = jogos_historicos[
        jogos_historicos["status"] == cfg.STATUS_NAO_REALIZADO
    ]
    assert len(sem_desfecho) == 1, (
        "novo jogo sem desfecho na base — reveja a regra:\n"
        + sem_desfecho.head().to_string(index=False)
    )


def test_a_linha_nao_e_descartada(campanha_st):
    """Os dois clubes têm etapa 38, com o jogo anexado."""
    etapa38 = campanha_st[
        (campanha_st["ano"] == ANO) & (campanha_st["serie"] == SERIE)
        & (campanha_st["etapa"] == 38) & (campanha_st["equipe"].isin(ENVOLVIDOS))
    ]
    assert len(etapa38) == 2
    assert set(etapa38["status"]) == {cfg.STATUS_NAO_REALIZADO}
    assert etapa38["resultado"].isna().all(), "jogo não disputado não tem resultado"


def test_o_jogo_nao_conta_e_os_acumulados_congelam(campanha_st):
    """Rodada 38 tem de ser idêntica à 37 em tudo o que se acumula."""
    recorte = campanha_st[
        (campanha_st["ano"] == ANO) & (campanha_st["serie"] == SERIE)
        & (campanha_st["etapa"].isin([37, 38]))
        & (campanha_st["equipe"].isin(ENVOLVIDOS))
    ]
    acumulados = ["j", "v", "e", "d", "pts", "gp_ac", "gc_ac", "sg_ac"]
    for equipe in ENVOLVIDOS:
        clube = recorte[recorte["equipe"] == equipe].set_index("etapa")
        assert clube.loc[38, "j"] == 37, f"{equipe}: o jogo não disputado contou"
        for coluna in acumulados:
            assert clube.loc[37, coluna] == clube.loc[38, coluna], (
                f"{equipe}: {coluna} mudou entre as rodadas 37 e 38"
            )


def test_a_tabela_da_rodada_38_continua_com_vinte_clubes(campanha_st):
    etapa38 = campanha_st[
        (campanha_st["ano"] == ANO) & (campanha_st["serie"] == SERIE)
        & (campanha_st["etapa"] == 38)
    ]
    assert len(etapa38) == cfg.CLUBES_POR_SERIE
    assert sorted(etapa38["pos"]) == list(range(1, cfg.CLUBES_POR_SERIE + 1))


def test_as_posicoes_da_rodada_38_batem_com_a_matriz(campanha_st, matriz_excel):
    """A consequência: descartar a linha moveria 17 clubes. Nenhum se moveu."""
    esperado = matriz_excel[
        (matriz_excel["ano"] == ANO) & (matriz_excel["serie"] == SERIE)
        & (matriz_excel["etapa"] == 38)
    ][["equipe", "pos_st", "j", "pts"]]
    calculado = campanha_st[
        (campanha_st["ano"] == ANO) & (campanha_st["serie"] == SERIE)
        & (campanha_st["etapa"] == 38)
    ][["equipe", "pos", "j", "pts"]]
    junta = esperado.merge(calculado, on="equipe", suffixes=("_excel", ""))
    assert len(junta) == cfg.CLUBES_POR_SERIE
    divergentes = junta[
        (junta["pos_st"] != junta["pos"])
        | (junta["j_excel"] != junta["j"])
        | (junta["pts_excel"] != junta["pts"])
    ]
    assert divergentes.empty, divergentes.to_string(index=False)


# --------------------------------------------------------- provas negativas
#
# São dois mecanismos independentes segurando este caso, e eles consertam
# coisas diferentes. Vale testar um de cada vez, senão um esconde o outro:
#
#   1. a grade completa de etapas mantém os dois clubes na rodada 38 mesmo que
#      o jogo suma da base — é ela que segura as 17 posições;
#   2. o status `nao_realizado` mantém o jogo como evento — é ele que segura a
#      etapa 38 na ordem cronológica (`JOGO NUM`), que a grade não reconstrói.


def test_sem_a_grade_completa_dezessete_clubes_mudam_de_lugar(
    jogos_historicos, matriz_excel
):
    """
    Reproduz o modo de falha do protótipo: classificar apenas as linhas que
    existem em cada etapa, sem completar a grade. Chapecoense e Atlético-MG
    somem da rodada 38 e todo mundo abaixo sobe duas posições.
    """
    realizados = jogos_historicos[jogos_historicos["status"] == cfg.STATUS_REALIZADO]
    longo = motor.formato_longo(realizados)
    longo = longo.sort_values(motor.CHAVE_CLUBE + ["rodada", "data", "id_jogo"])
    longo["etapa"] = longo["rodada"].astype("int64")
    por_clube = longo.groupby(motor.CHAVE_CLUBE, sort=False)
    for coluna in ["pts_rodada", "v", "sg", "gp"]:
        longo["ac_" + coluna] = por_clube[coluna].cumsum()

    etapa38 = longo[
        (longo["ano"] == ANO) & (longo["serie"] == SERIE) & (longo["etapa"] == 38)
    ].sort_values(["ac_pts_rodada", "ac_v", "ac_sg", "ac_gp"], ascending=False)
    etapa38 = etapa38.assign(pos=range(1, len(etapa38) + 1))

    assert len(etapa38) == cfg.CLUBES_POR_SERIE - 2, (
        "sem a grade, a rodada 38 de 2016 tem de ficar com 18 clubes"
    )
    esperado = matriz_excel[
        (matriz_excel["ano"] == ANO) & (matriz_excel["serie"] == SERIE)
        & (matriz_excel["etapa"] == 38)
    ][["equipe", "pos_st"]]
    junta = esperado.merge(etapa38[["equipe", "pos"]], on="equipe", how="left")

    # As 17 divergências da rodada 38 se decompõem assim: os 2 clubes do jogo
    # somem da tabela, e dos 18 que sobram, 15 mudam de lugar — só os 3 que
    # estavam acima do Atlético-MG (4º) ficam onde estavam.
    orfas = junta["pos"].isna().sum()
    movidas = (junta["pos_st"] != junta["pos"]).sum() - orfas
    assert orfas == 2, "os dois clubes do jogo têm de sumir da rodada 38"
    assert movidas == 15, (
        "o descarte deveria mover 15 dos 18 clubes restantes — se esse número "
        "mudou, a base de 2016 mudou e o tratamento precisa ser reconferido"
    )
    assert orfas + movidas == 17


def test_sem_o_status_a_ordem_cronologica_perde_a_etapa_38(
    jogos_historicos, matriz_excel
):
    """
    Com o jogo fora da base, a grade ainda preenche a rodada 38 por repetição,
    mas na ordem por data os dois clubes ficam com 37 etapas: o 38º jogo deixa
    de existir e o `JOGO NUM` da matriz fica sem par.
    """
    sem_o_jogo = jogos_historicos[
        jogos_historicos["status"] == cfg.STATUS_REALIZADO
    ]
    esperado = matriz_excel[
        (matriz_excel["ano"] == ANO) & (matriz_excel["serie"] == SERIE)
        & (matriz_excel["etapa"] == 38) & (matriz_excel["equipe"].isin(ENVOLVIDOS))
    ][["equipe", "jogo_num"]]
    assert (esperado["jogo_num"] == 38).all(), "a matriz dá 38 jogos aos dois"

    def etapas_do_38(jogos):
        """A etapa cronológica que cada um dos dois tem na rodada 38 de 2016."""
        campanha = motor.campanha(jogos, "data", "ST", "todos")
        recorte = campanha[
            (campanha["ano"] == ANO) & (campanha["serie"] == SERIE)
            & (campanha["rodada"] == 38) & (campanha["equipe"].isin(ENVOLVIDOS))
        ]
        return dict(zip(recorte["equipe"], recorte["etapa"]))

    assert etapas_do_38(sem_o_jogo) == {}, (
        "sem o status `nao_realizado` o 38º jogo desaparece da ordem cronológica"
    )
    assert etapas_do_38(jogos_historicos) == {
        "CHAPECOENSE (SC)": 38, "ATLÉTICO (MG)": 38,
    }
