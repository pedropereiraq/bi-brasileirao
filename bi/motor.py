"""
Motor de cálculo: reconstrói campanha, pontuação e posição a partir da lista de
jogos, e só dela. Nenhum número deste módulo é lido de lugar nenhum.

Três eixos de variação, tratados como parâmetros e devolvidos como colunas:

    ordem    'rodada' = rodada oficial | 'data' = n-ésimo jogo cronológico
    criterio 'ST' = sem tapetão        | 'CT' = com tapetão
    local    'todos' | 'casa' | 'fora' (filtra os jogos antes de acumular)

Duas regras que valem a pena ler antes de mexer aqui:

1. **Jogo sem desfecho não some o clube da tabela.** Um jogo dado por encerrado
   sem ser disputado (`nao_realizado`) gera etapa e mantém o clube na
   classificação, mas não incrementa J nem altera acumulado nenhum. É assim que
   a matriz do Excel trata Chapecoense x Atlético-MG na rodada 38 de 2016, e é
   a única leitura que reproduz aquela tabela.

2. **A grade de etapas é completa e preenchida para trás.** Todo clube tem uma
   linha em toda etapa de 1 até a última com jogo disputado, mesmo quando não
   jogou naquela etapa — caso do filtro por mando, em que um clube passa
   rodadas sem atuar em casa. Os acumulados repetem o último valor conhecido,
   que é o significado correto de "pontos em casa até a rodada X".
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config as cfg
from .historico import chave_alfabetica

CHAVE_EDICAO = ["ano", "serie"]
CHAVE_CLUBE = ["ano", "serie", "equipe"]

_ACUMULAVEIS = ["pts_rodada", "v", "e", "d", "gp", "gc", "sg", "tap"]


# --------------------------------------------------------------- formato longo
def formato_longo(jogos: pd.DataFrame) -> pd.DataFrame:
    """Uma linha por clube por jogo — o dobro de linhas da tabela de jogos."""
    jogos = jogos[jogos["fase"] == cfg.FASE_UNICA].copy()

    lados = []
    for mando, casa in (("casa", True), ("fora", False)):
        lado = pd.DataFrame({
            "ano": jogos["ano"],
            "serie": jogos["serie"],
            "rodada": jogos["rodada"],
            "data": jogos["data"],
            "id_jogo": jogos["id_jogo"],
            "status": jogos["status"],
            "equipe": jogos["mandante"] if casa else jogos["visitante"],
            "adversario": jogos["visitante"] if casa else jogos["mandante"],
            "mando": mando,
            "gp": jogos["gols_m"] if casa else jogos["gols_v"],
            "gc": jogos["gols_v"] if casa else jogos["gols_m"],
            "tap": jogos["tapetao_m"] if casa else jogos["tapetao_v"],
        })
        lados.append(lado)

    longo = pd.concat(lados, ignore_index=True)

    # `contabiliza` separa o jogo que entrou na conta do que apenas ocupa etapa.
    longo["contabiliza"] = longo["status"] == cfg.STATUS_REALIZADO
    longo["gera_etapa"] = longo["status"].isin(
        [cfg.STATUS_REALIZADO, cfg.STATUS_NAO_REALIZADO]
    )

    gp = pd.to_numeric(longo["gp"], errors="coerce")
    gc = pd.to_numeric(longo["gc"], errors="coerce")
    valido = longo["contabiliza"]

    longo["gp"] = gp.where(valido)
    longo["gc"] = gc.where(valido)
    longo["sg"] = longo["gp"] - longo["gc"]
    longo["v"] = np.where(valido & (longo["sg"] > 0), 1, 0)
    longo["e"] = np.where(valido & (longo["sg"] == 0), 1, 0)
    longo["d"] = np.where(valido & (longo["sg"] < 0), 1, 0)
    longo["pts_rodada"] = longo["v"] * 3 + longo["e"]
    longo["resultado"] = pd.Series(
        np.select([longo["v"] == 1, longo["e"] == 1, longo["d"] == 1],
                  ["V", "E", "D"], default=None),
        index=longo.index, dtype="string",
    )
    longo["tap"] = pd.to_numeric(longo["tap"], errors="coerce").fillna(0)
    # O tapetão vale na rodada do fato, tenha o jogo sido disputado ou não.
    longo["j"] = valido.astype(int)
    return longo


# ------------------------------------------------------------------ acumulação
def acumular(longo: pd.DataFrame, ordem: str = "rodada",
             local: str = "todos") -> pd.DataFrame:
    """
    Filtra pelo mando, define a etapa, acumula por clube e completa a grade.
    Devolve uma linha por (clube, etapa) com os acumulados já preenchidos.
    """
    if local not in cfg.LOCAIS:
        raise ValueError(f"local inválido: {local}")
    if ordem not in cfg.ORDENS:
        raise ValueError(f"ordem inválida: {ordem}")

    passo = longo[longo["gera_etapa"]]
    if local != "todos":
        passo = passo[passo["mando"] == local]
    passo = passo.copy()

    if ordem == "rodada":
        passo = passo.sort_values(CHAVE_CLUBE + ["rodada", "data", "id_jogo"])
        passo["etapa"] = passo["rodada"].astype("int64")
    else:
        passo = passo.sort_values(CHAVE_CLUBE + ["data", "rodada", "id_jogo"])
        passo["etapa"] = passo.groupby(CHAVE_CLUBE, sort=False).cumcount() + 1

    por_clube = passo.groupby(CHAVE_CLUBE, sort=False)
    for coluna in _ACUMULAVEIS:
        passo["ac_" + coluna] = por_clube[coluna].cumsum()
    passo["ac_j"] = por_clube["j"].cumsum()

    return _completar_grade(passo)


def _completar_grade(passo: pd.DataFrame) -> pd.DataFrame:
    """
    Reindexa cada clube sobre 1..etapa_max da sua edição e repete para a frente
    o último acumulado. Etapa anterior ao primeiro jogo do clube vale zero.

    `etapa_max` é a última etapa em que algum clube da edição jogou de fato —
    é o que impede uma edição em andamento de produzir 14 tabelas idênticas de
    rodadas futuras.
    """
    disputadas = passo[passo["contabiliza"]]
    limites = (
        disputadas.groupby(CHAVE_EDICAO)["etapa"].max().rename("etapa_max").reset_index()
    )

    clubes = passo[CHAVE_CLUBE].drop_duplicates().merge(limites, on=CHAVE_EDICAO)
    clubes = clubes[clubes["etapa_max"].notna()]
    grade = clubes.loc[clubes.index.repeat(clubes["etapa_max"].astype(int))].copy()
    grade["etapa"] = grade.groupby(CHAVE_CLUBE, sort=False).cumcount() + 1
    grade = grade.drop(columns="etapa_max")

    completa = grade.merge(passo, on=CHAVE_CLUBE + ["etapa"], how="left")
    completa = completa.sort_values(CHAVE_CLUBE + ["etapa"])

    por_clube = completa.groupby(CHAVE_CLUBE, sort=False)
    acumulados = ["ac_" + c for c in _ACUMULAVEIS] + ["ac_j"]
    completa[acumulados] = por_clube[acumulados].ffill()
    completa[acumulados] = completa[acumulados].fillna(0)
    return completa.reset_index(drop=True)


# --------------------------------------------------------------- classificação
def classificar(acumulado: pd.DataFrame, criterio: str = "ST") -> pd.DataFrame:
    """
    Posição em cada (ano, serie, etapa). Critérios de desempate, nesta ordem:
    pontos, vitórias, saldo de gols, gols pró e, por último, ordem alfabética
    do nome do clube — determinística e documentada em docs/decisoes.md.
    """
    if criterio not in cfg.CRITERIOS:
        raise ValueError(f"critério inválido: {criterio}")

    tabela = acumulado.copy()
    # Tapetão é negativo, então soma. ST ignora a punição; CT aplica.
    tabela["pts"] = tabela["ac_pts_rodada"] + (
        tabela["ac_tap"] if criterio == "CT" else 0
    )
    tabela["_alfabetica"] = tabela["equipe"].map(chave_alfabetica)

    tabela = tabela.sort_values(
        CHAVE_EDICAO + ["etapa", "pts", "ac_v", "ac_sg", "ac_gp", "_alfabetica"],
        ascending=[True, True, True, False, False, False, False, True],
        kind="mergesort",
    )
    tabela["pos"] = tabela.groupby(CHAVE_EDICAO + ["etapa"], sort=False).cumcount() + 1

    # Posição final da edição, constante por clube — usada para colorir séries.
    ultima = tabela.groupby(CHAVE_EDICAO)["etapa"].transform("max")
    finais = (
        tabela[tabela["etapa"] == ultima][CHAVE_CLUBE + ["pos"]]
        .rename(columns={"pos": "pos_fim"})
    )
    tabela = tabela.merge(finais, on=CHAVE_CLUBE, how="left")
    return tabela.drop(columns="_alfabetica")


# ------------------------------------------------------------------- fachada
def campanha(jogos: pd.DataFrame, ordem: str = "rodada", criterio: str = "ST",
             local: str = "todos") -> pd.DataFrame:
    """Uma combinação de variação, já classificada. É a unidade de trabalho."""
    longo = formato_longo(jogos)
    acumulado = acumular(longo, ordem=ordem, local=local)
    tabela = classificar(acumulado, criterio=criterio)

    tabela["ordem"] = ordem
    tabela["criterio"] = criterio
    tabela["local"] = local
    tabela["aproveitamento"] = np.where(
        tabela["ac_j"] > 0, tabela["pts"] / (3 * tabela["ac_j"]), np.nan
    )
    # As colunas por jogo `v/e/d/j/tap` já foram consumidas pela acumulação e
    # colidiriam com os acumulados no rename abaixo. O que sobra do jogo em si
    # são `gp`, `gc`, `sg`, `pts_rodada` e `resultado`.
    tabela = tabela.drop(columns=["v", "e", "d", "j", "tap"])
    return tabela.rename(columns={
        "ac_j": "j", "ac_v": "v", "ac_e": "e", "ac_d": "d",
        "ac_gp": "gp_ac", "ac_gc": "gc_ac", "ac_sg": "sg_ac", "ac_tap": "tap_ac",
    })
