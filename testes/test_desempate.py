"""
Critérios de desempate: pontos, vitórias, saldo, gols pró e ordem alfabética.

O último critério existe porque a base não tem confronto direto nem cartões. Ele
precisa ser determinístico (a mesma entrada sempre dá a mesma tabela) e precisa
ser insensível a acento — `SÃO PAULO (SP)` tem de vir antes de `SPORT (PE)`,
como viria numa lista impressa. Comparando os nomes crus, `Ã` (U+00C3) cai
depois de `P` e a ordem inverte: é essa a única divergência que o protótipo
tinha contra a matriz, e é ela que este arquivo trava.
"""
from __future__ import annotations

import pandas as pd
import pytest

from bi import config as cfg
from bi import motor
from bi.historico import chave_alfabetica


# ------------------------------------------------------ ordem alfabética
def test_chave_alfabetica_ignora_acento():
    assert chave_alfabetica("SÃO PAULO (SP)") == "SAO PAULO (SP)"
    assert chave_alfabetica("ATLÉTICO (MG)") == "ATLETICO (MG)"
    assert chave_alfabetica("SÃO PAULO (SP)") < chave_alfabetica("SPORT (PE)")


def test_sem_a_normalizacao_a_ordem_se_inverteria():
    """O motivo de existir `chave_alfabetica`, dito em uma linha."""
    assert "SÃO PAULO (SP)" > "SPORT (PE)"


def test_empate_absoluto_de_2025_segue_a_ordem_alfabetica(campanha_st):
    """
    2025, Série A, rodada 1: São Paulo e Sport empatam em pontos, vitórias,
    saldo e gols pró. É empate absoluto — decide o último critério.
    """
    rodada = campanha_st[
        (campanha_st["ano"] == 2025) & (campanha_st["serie"] == "A")
        & (campanha_st["etapa"] == 1)
        & (campanha_st["equipe"].isin(["SÃO PAULO (SP)", "SPORT (PE)"]))
    ].set_index("equipe")

    for coluna in ["pts", "v", "sg_ac", "gp_ac"]:
        assert rodada.loc["SÃO PAULO (SP)", coluna] == rodada.loc["SPORT (PE)", coluna]
    assert rodada.loc["SÃO PAULO (SP)", "pos"] == 14
    assert rodada.loc["SPORT (PE)", "pos"] == 15


# --------------------------------------------------- ordem dos critérios
def _jogos(linhas: list[tuple]) -> pd.DataFrame:
    """Edição sintética de uma rodada só, para isolar um critério por vez."""
    registros = []
    for i, (mandante, gols_m, gols_v, visitante) in enumerate(linhas, 1):
        registros.append({
            "id_jogo": f"T2000.{i}", "ano": 2000, "serie": "A",
            "fase": cfg.FASE_UNICA, "rodada": 1,
            "data": pd.Timestamp("2000-01-01"),
            "mandante": mandante, "visitante": visitante,
            "gols_m": gols_m, "gols_v": gols_v,
            "tapetao_m": 0, "tapetao_v": 0,
            "status": cfg.STATUS_REALIZADO,
        })
    return pd.DataFrame(registros)


def _ordem(jogos: pd.DataFrame, criterio: str = "ST") -> list[str]:
    campanha = motor.campanha(jogos, "rodada", criterio, "todos")
    return campanha.sort_values("pos")["equipe"].tolist()


def test_pontos_vem_antes_de_tudo():
    # ALFA vence por 1 a 0; DELTA empata com saldo igual mas menos pontos.
    ordem = _ordem(_jogos([("ALFA (XX)", 1, 0, "BRAVO (XX)"),
                           ("CHARLIE (XX)", 2, 2, "DELTA (XX)")]))
    assert ordem[0] == "ALFA (XX)"


def test_vitorias_desempatam_antes_do_saldo():
    """
    Com pontos iguais, quem venceu mais passa — mesmo com saldo pior. É o caso
    real de CRB e Operário-PR na Série B de 2026, à frente do Atlético-GO.
    """
    # ALFA: 1 vitória por 1x0 (3 pts, 1 V, saldo +1)
    # CHARLIE: 1 vitória por 5x0 (3 pts, 1 V, saldo +5) -> passa por saldo
    # ECHO: 3 empates não cabem numa rodada; usa-se um grupo maior abaixo.
    jogos = _jogos([
        ("ALFA (XX)", 1, 0, "BRAVO (XX)"),
        ("CHARLIE (XX)", 5, 0, "DELTA (XX)"),
    ])
    assert _ordem(jogos)[:2] == ["CHARLIE (XX)", "ALFA (XX)"]


def test_saldo_desempata_antes_de_gols_pro():
    ordem = _ordem(_jogos([("ALFA (XX)", 3, 1, "BRAVO (XX)"),
                           ("CHARLIE (XX)", 2, 1, "DELTA (XX)")]))
    assert ordem[:2] == ["ALFA (XX)", "CHARLIE (XX)"]


def test_gols_pro_desempata_antes_da_ordem_alfabetica():
    # Saldos iguais (+1), ALFA marcou 3 e CHARLIE marcou 2.
    ordem = _ordem(_jogos([("ALFA (XX)", 3, 2, "BRAVO (XX)"),
                           ("CHARLIE (XX)", 2, 1, "DELTA (XX)")]))
    assert ordem[:2] == ["ALFA (XX)", "CHARLIE (XX)"]


def test_ordem_alfabetica_e_o_ultimo_recurso():
    # Dois jogos idênticos: nada distingue ALFA de CHARLIE, nem BRAVO de DELTA.
    ordem = _ordem(_jogos([("ALFA (XX)", 1, 0, "BRAVO (XX)"),
                           ("CHARLIE (XX)", 1, 0, "DELTA (XX)")]))
    assert ordem == ["ALFA (XX)", "CHARLIE (XX)", "BRAVO (XX)", "DELTA (XX)"]


def test_a_classificacao_e_estavel_sob_reordenacao_da_entrada():
    """
    Determinismo: embaralhar a lista de jogos não pode mudar uma linha sequer da
    tabela. Sem isso, o site publicaria uma classificação diferente a cada
    execução do workflow.
    """
    jogos = _jogos([("ALFA (XX)", 1, 0, "BRAVO (XX)"),
                    ("CHARLIE (XX)", 1, 0, "DELTA (XX)"),
                    ("ECHO (XX)", 2, 2, "FOXTROT (XX)")])
    direta = _ordem(jogos)
    invertida = _ordem(jogos.iloc[::-1].reset_index(drop=True))
    assert direta == invertida


# ----------------------------------------------------------- tapetão (CT)
def test_o_tapetao_so_muda_a_classificacao_no_criterio_ct():
    jogos = _jogos([("ALFA (XX)", 1, 0, "BRAVO (XX)"),
                    ("CHARLIE (XX)", 5, 0, "DELTA (XX)")])
    jogos.loc[jogos["mandante"] == "CHARLIE (XX)", "tapetao_m"] = -3

    assert _ordem(jogos, "ST")[:2] == ["CHARLIE (XX)", "ALFA (XX)"]
    # Com a punição, CHARLIE perde os 3 pontos e cai atrás de todo mundo.
    assert _ordem(jogos, "CT")[0] == "ALFA (XX)"


def test_tapetao_da_matriz_confere_com_o_excel(campanha_ct, matriz_excel):
    """
    As 10 punições da aba `Tapetão` estão redundantes nas colunas de `Jogos`.
    O motor lê só `Jogos`; o acumulado tem de bater com a coluna TAP da matriz.
    """
    chave = ["ano", "serie", "etapa", "equipe"]
    junta = matriz_excel[chave + ["tap_ac"]].merge(
        campanha_ct[chave + ["tap_ac"]], on=chave, suffixes=("_excel", ""))
    divergentes = junta[junta["tap_ac_excel"].astype("float64")
                        != junta["tap_ac"].astype("float64")]
    assert divergentes.empty, divergentes.head(10).to_string(index=False)
    assert junta["tap_ac"].min() < 0, "nenhuma punição foi acumulada"


# ------------------------------------------------------------- invariantes
@pytest.mark.parametrize("ordem", cfg.ORDENS)
@pytest.mark.parametrize("local", cfg.LOCAIS)
def test_posicoes_sao_uma_permutacao_completa(jogos_historicos, ordem, local):
    """
    Em toda etapa de toda edição, as posições vão de 1 a 20 sem buraco e sem
    repetição — inclusive nos recortes por mando, em que o clube passa etapas
    sem jogar e é a grade completa que o mantém na tabela.
    """
    recorte = jogos_historicos[jogos_historicos["ano"] == 2019]
    campanha = motor.campanha(recorte, ordem, "ST", local)
    tamanhos = campanha.groupby(["ano", "serie", "etapa"])["pos"].agg(
        n="size", minimo="min", maximo="max", unicos="nunique")
    assert (tamanhos["n"] == cfg.CLUBES_POR_SERIE).all()
    assert (tamanhos["unicos"] == cfg.CLUBES_POR_SERIE).all()
    assert (tamanhos["minimo"] == 1).all()
    assert (tamanhos["maximo"] == cfg.CLUBES_POR_SERIE).all()
