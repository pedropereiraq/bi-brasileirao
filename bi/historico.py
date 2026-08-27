"""
Leitura do Excel histórico (`fontes/Histórico Campeonato Brasileiro.xlsx`).

A aba `Jogos` é a fonte da verdade de 1937 até a última edição fechada; a aba
`Equipes` é o cadastro de clubes. Nada mais do Excel é lido: `Matriz`, `Médias`
e `Ocorrências` são resultados que este projeto recalcula, e entram apenas nos
testes, como gabarito.
"""
from __future__ import annotations

import re
import unicodedata
from pathlib import Path

import pandas as pd

from . import config as cfg

# Caracteres invisíveis que vieram junto de algumas células do Excel.
_INVISIVEIS = re.compile(r"[­​‎‏﻿]")


def _limpar_texto(serie: pd.Series) -> pd.Series:
    return (
        serie.astype("string")
        .str.replace(_INVISIVEIS, "", regex=True)
        .str.strip()
    )


def _normalizar_nome(serie: pd.Series) -> pd.Series:
    """Nome de clube na convenção canônica: `NOME (UF)`, maiúsculas, sem sobras."""
    return _limpar_texto(serie).str.upper().str.replace(r"\s+", " ", regex=True)


def ler_clubes(excel: Path | None = None) -> pd.DataFrame:
    """Cadastro de clubes, com o id do Sofascore anexado quando existir."""
    excel = excel or cfg.EXCEL_HISTORICO
    bruto = pd.read_excel(excel, sheet_name="Equipes")
    clubes = pd.DataFrame({
        "equipe": _normalizar_nome(bruto["EQUIPE"]),
        "sigla": _limpar_texto(bruto["SIGLA"]),
        "estado": _limpar_texto(bruto["ESTADO"]),
        "regiao": _limpar_texto(bruto["REGIÃO"]),
        "cidade": _limpar_texto(bruto["CIDADE"]),
        "escudo": _limpar_texto(bruto["ESCUDO"]),
    })
    clubes = clubes.dropna(subset=["equipe"]).drop_duplicates("equipe")

    de_para = pd.read_csv(cfg.DE_PARA_CLUBES, encoding="utf-8-sig")
    de_para["equipe"] = _normalizar_nome(de_para["equipe"])
    clubes = clubes.merge(
        de_para[["equipe", "sofascore_id"]], on="equipe", how="left"
    )
    clubes["sofascore_id"] = clubes["sofascore_id"].astype("Int64")

    # Chave de ordenação alfabética estável, insensível a acento — é ela que
    # decide o desempate de último recurso (ver docs/decisoes.md).
    clubes["chave_alfabetica"] = clubes["equipe"].map(chave_alfabetica)
    return clubes.sort_values("equipe").reset_index(drop=True)


def chave_alfabetica(nome: str) -> str:
    """`ATLÉTICO (MG)` -> `ATLETICO (MG)`. Acento não pode mudar a ordem."""
    if not isinstance(nome, str):
        return ""
    return "".join(
        c for c in unicodedata.normalize("NFD", nome)
        if unicodedata.category(c) != "Mn"
    )


def ler_jogos(excel: Path | None = None, ano_minimo: int | None = None) -> pd.DataFrame:
    """
    Aba `Jogos` no layout canônico. Sem filtro de ano por padrão: a camada
    canônica guarda tudo desde 1937; quem recorta é a camada derivada.
    """
    excel = excel or cfg.EXCEL_HISTORICO
    bruto = pd.read_excel(excel, sheet_name="Jogos")

    jogos = pd.DataFrame({
        "id_jogo": _limpar_texto(bruto["ID Jogo"]),
        "ano": bruto["Ano"].astype("Int64"),
        "serie": _limpar_texto(bruto["Série"]),
        "fase": _limpar_texto(bruto["Fase"]),
        "rodada": pd.to_numeric(bruto["Rodada"], errors="coerce").astype("Int64"),
        "data": pd.to_datetime(bruto["Data"], errors="coerce"),
        "mandante": _normalizar_nome(bruto["Mandante"]),
        "visitante": _normalizar_nome(bruto["Visitante"]),
        "gols_m": pd.to_numeric(bruto["M"], errors="coerce").astype("Int64"),
        "gols_v": pd.to_numeric(bruto["V"], errors="coerce").astype("Int64"),
        "tapetao_m": pd.to_numeric(bruto["Tapetão M"], errors="coerce").fillna(0).astype(int),
        "tapetao_v": pd.to_numeric(bruto["Tapetão V"], errors="coerce").fillna(0).astype(int),
    })
    if ano_minimo is not None:
        jogos = jogos[jogos["ano"] >= ano_minimo]

    jogos["status"] = _status_historico(jogos)
    jogos["sofascore_id"] = pd.Series(pd.NA, index=jogos.index, dtype="Int64")
    jogos["origem"] = "excel"
    return jogos.reset_index(drop=True)


def _status_historico(jogos: pd.DataFrame) -> pd.Series:
    """
    No Excel só existem jogos passados, então o status sai do placar: com placar
    é `realizado`; sem placar é `nao_realizado` — a partida foi dada por
    encerrada sem ter sido disputada e sem pontuação atribuída a ninguém.
    O único caso de 2006 em diante é Chapecoense x Atlético-MG, 2016, rodada 38.
    """
    tem_placar = jogos["gols_m"].notna() & jogos["gols_v"].notna()
    return pd.Series(
        [cfg.STATUS_REALIZADO if t else cfg.STATUS_NAO_REALIZADO for t in tem_placar],
        index=jogos.index, dtype="string",
    )
