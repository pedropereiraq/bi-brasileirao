"""
Camada derivada: as três tabelas fato, em parquet.

Nada aqui é fonte de verdade — tudo é recalculado a partir de `jogos`. Apagar a
pasta `dados/derivado` e rodar `python -m bi construir` reconstrói byte a byte.

    fato_clube_etapa     clube x edição x etapa   — a campanha, passo a passo
    fato_posicao_etapa   posição x edição x etapa — o espelho, visto pela tabela
    fato_pontuacao_etapa pontuação x etapa        — o histórico, visto pela conta

As três primeiras dimensões de variação (`ordem`, `criterio`, `local`) são
colunas, não tabelas. É o que permite juntar posição de clube com pontuação
típica daquela posição num join direto sobre a chave comum.
"""
from __future__ import annotations

import itertools

import pandas as pd

from . import canonico
from . import config as cfg
from . import motor

VARIACAO = ["ordem", "criterio", "local"]
CHAVE = ["ano", "serie", *VARIACAO, "etapa"]

COLUNAS_CLUBE_ETAPA = [
    *CHAVE, "equipe",
    # o jogo daquela etapa (nulo quando o clube não jogou na etapa)
    "adversario", "mando", "resultado", "gp", "gc", "sg", "pts_rodada", "status",
    # a campanha acumulada até a etapa
    "j", "v", "e", "d", "pts", "gp_ac", "gc_ac", "sg_ac", "tap_ac",
    "aproveitamento", "pos", "pos_fim",
]


def _recorte_bi(jogos: pd.DataFrame) -> pd.DataFrame:
    """A era dos pontos corridos com 20 clubes. O resto fica só no canônico."""
    return jogos[
        (jogos["ano"] >= cfg.ANO_INICIO_BI)
        & (jogos["serie"].isin(cfg.SERIES))
        & (jogos["fase"] == cfg.FASE_UNICA)
    ]


# ------------------------------------------------------- fato_clube_etapa
def fato_clube_etapa(jogos: pd.DataFrame) -> pd.DataFrame:
    """Todas as combinações de ordem x critério x local, empilhadas."""
    recorte = _recorte_bi(jogos)
    longo = motor.formato_longo(recorte)

    partes = []
    for ordem, local in itertools.product(cfg.ORDENS, cfg.LOCAIS):
        # A acumulação não depende do critério; só a classificação depende.
        acumulado = motor.acumular(longo, ordem=ordem, local=local)
        for criterio in cfg.CRITERIOS:
            tabela = motor.classificar(acumulado, criterio=criterio)
            tabela["ordem"] = ordem
            tabela["criterio"] = criterio
            tabela["local"] = local
            tabela["aproveitamento"] = (
                tabela["pts"] / (3 * tabela["ac_j"])
            ).where(tabela["ac_j"] > 0)
            tabela = tabela.drop(columns=["v", "e", "d", "j", "tap"]).rename(columns={
                "ac_j": "j", "ac_v": "v", "ac_e": "e", "ac_d": "d",
                "ac_gp": "gp_ac", "ac_gc": "gc_ac",
                "ac_sg": "sg_ac", "ac_tap": "tap_ac",
            })
            partes.append(tabela.reindex(columns=COLUNAS_CLUBE_ETAPA))

    fato = pd.concat(partes, ignore_index=True)
    return _tipar(fato).sort_values(CHAVE + ["pos"]).reset_index(drop=True)


def _tipar(fato: pd.DataFrame) -> pd.DataFrame:
    """Tipos enxutos: o parquet fica pequeno e o join fica rápido."""
    inteiros = ["ano", "etapa", "j", "v", "e", "d", "pts", "gp_ac", "gc_ac",
                "sg_ac", "tap_ac", "pos", "pos_fim"]
    for coluna in inteiros:
        fato[coluna] = pd.to_numeric(fato[coluna], errors="coerce").astype("Int32")
    for coluna in ["gp", "gc", "sg", "pts_rodada"]:
        fato[coluna] = pd.to_numeric(fato[coluna], errors="coerce").astype("Int16")
    for coluna in ["serie", *VARIACAO, "equipe", "adversario", "mando",
                   "resultado", "status"]:
        fato[coluna] = fato[coluna].astype("category")
    fato["aproveitamento"] = fato["aproveitamento"].astype("float32")
    return fato


# ----------------------------------------------------- fato_posicao_etapa
def fato_posicao_etapa(clube_etapa: pd.DataFrame) -> pd.DataFrame:
    """
    O espelho de `fato_clube_etapa`: a mesma etapa vista pela tabela em vez de
    pelo clube. Daqui saem as médias históricas por posição e rodada, e o
    cruzamento "posição de um clube x pontuação típica daquela posição".
    """
    fato = clube_etapa.rename(columns={
        "equipe": "equipe_na_posicao",
        "pts": "pts_da_posicao",
        "pos_fim": "pos_fim_da_equipe",
    })
    colunas = [
        *CHAVE, "pos", "equipe_na_posicao", "pts_da_posicao",
        "j", "v", "e", "d", "gp_ac", "gc_ac", "sg_ac", "tap_ac",
        "aproveitamento", "pos_fim_da_equipe",
    ]
    return fato.reindex(columns=colunas).sort_values(CHAVE + ["pos"]).reset_index(drop=True)


# --------------------------------------------------- fato_pontuacao_etapa
def edicoes_completas(jogos: pd.DataFrame) -> set[tuple]:
    """Edição sem jogo pendente. Só elas entram no histórico de pontuação."""
    recorte = _recorte_bi(jogos)
    pendentes = recorte["status"].isin(
        [cfg.STATUS_AGENDADO, cfg.STATUS_ADIADO]
    )
    por_edicao = recorte.assign(pendente=pendentes).groupby(["ano", "serie"])
    resumo = por_edicao["pendente"].sum()
    return {chave for chave, n in resumo.items() if n == 0}


def fato_pontuacao_etapa(clube_etapa: pd.DataFrame,
                         completas: set[tuple]) -> pd.DataFrame:
    """
    Para cada pontuação possível numa etapa: que posição ela costuma valer, com
    que frequência ela aparece e onde as campanhas com ela terminaram. É a aba
    `Ocorrências` generalizada, e a base das projeções e das campanhas
    semelhantes.

    O grão é histórico, não anual: agrega todas as edições **fechadas**. Uma
    edição em andamento não tem posição final e envenenaria a estatística.
    Posição por edição continua em `fato_posicao_etapa`.
    """
    chaves = list(zip(clube_etapa["ano"].tolist(), clube_etapa["serie"].tolist()))
    base = clube_etapa[[c in completas for c in chaves]]

    agrupado = base.groupby(
        ["serie", *VARIACAO, "etapa", "pts"], observed=True, sort=True
    )
    fato = agrupado.agg(
        n_ocorrencias=("pos", "size"),
        n_edicoes=("ano", "nunique"),
        pos_media=("pos", "mean"),
        pos_mediana=("pos", "median"),
        pos_min=("pos", "min"),
        pos_max=("pos", "max"),
        pos_fim_media=("pos_fim", "mean"),
        pos_fim_mediana=("pos_fim", "median"),
        pos_fim_min=("pos_fim", "min"),
        pos_fim_max=("pos_fim", "max"),
        ano_primeiro=("ano", "min"),
        ano_ultimo=("ano", "max"),
    ).reset_index()

    for coluna in ["pos_media", "pos_mediana", "pos_fim_media", "pos_fim_mediana"]:
        fato[coluna] = fato[coluna].astype("float32")
    return fato


# ------------------------------------------------------------------ escrita
def construir(jogos: pd.DataFrame | None = None) -> dict[str, pd.DataFrame]:
    cfg.garantir_pastas()
    jogos = canonico.carregar_jogos() if jogos is None else jogos

    clube_etapa = fato_clube_etapa(jogos)
    posicao_etapa = fato_posicao_etapa(clube_etapa)
    pontuacao_etapa = fato_pontuacao_etapa(clube_etapa, edicoes_completas(jogos))

    tabelas = {
        "fato_clube_etapa": clube_etapa,
        "fato_posicao_etapa": posicao_etapa,
        "fato_pontuacao_etapa": pontuacao_etapa,
    }
    for nome, tabela in tabelas.items():
        destino = cfg.DERIVADO / f"{nome}.parquet"
        tabela.to_parquet(destino, index=False, compression="zstd")
        print(f"  {nome}: {len(tabela):>9,} linhas  "
              f"({destino.stat().st_size/1e6:.1f} MB)".replace(",", "."))
    return tabelas


def carregar(nome: str) -> pd.DataFrame:
    return pd.read_parquet(cfg.DERIVADO / f"{nome}.parquet")
