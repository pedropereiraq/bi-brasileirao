"""Fixtures compartilhadas. O Excel é lido uma vez por sessão — é caro."""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from bi import config as cfg
from bi import historico, motor

FIXTURES = Path(__file__).parent / "fixtures"

# Recorte que a `Matriz - Só valores` cobre: 2006–2025, Séries A e B.
ANO_MATRIZ_INICIO = 2006
ANO_MATRIZ_FIM = 2025


@pytest.fixture(scope="session")
def jogos_historicos() -> pd.DataFrame:
    """Aba `Jogos` do Excel, no layout canônico. A fonte da verdade."""
    jogos = historico.ler_jogos(ano_minimo=ANO_MATRIZ_INICIO)
    return jogos[
        (jogos["ano"] <= ANO_MATRIZ_FIM)
        & (jogos["serie"].isin(cfg.SERIES))
        & (jogos["fase"] == cfg.FASE_UNICA)
    ].reset_index(drop=True)


@pytest.fixture(scope="session")
def matriz_excel() -> pd.DataFrame:
    """
    Aba `Matriz - Só valores`: 30.400 linhas de gabarito, calculadas no Power BI
    ao longo de anos. É contra ela que o motor tem de provar que acerta.
    """
    bruto = pd.read_excel(cfg.EXCEL_HISTORICO, sheet_name="Matriz - Só valores")
    matriz = bruto.rename(columns={
        "Ano": "ano", "Série": "serie", "Rodada": "etapa",
        "PTS (ST)": "pts", "TAP": "tap_ac",
        "J": "j", "V": "v", "E": "e", "D": "d",
        "GP": "gp_ac", "GC": "gc_ac", "SG": "sg_ac",
        "POS ST": "pos_st", "POS CT": "pos_ct",
        "POS FIM ST": "pos_fim_st", "POS FIM CT": "pos_fim_ct",
        "JOGO NUM": "jogo_num", "Local": "mando_excel",
    })
    matriz["equipe"] = matriz["Equipe"].str.upper().str.strip()
    return matriz


@pytest.fixture(scope="session")
def campanha_st(jogos_historicos) -> pd.DataFrame:
    return motor.campanha(jogos_historicos, "rodada", "ST", "todos")


@pytest.fixture(scope="session")
def campanha_ct(jogos_historicos) -> pd.DataFrame:
    return motor.campanha(jogos_historicos, "rodada", "CT", "todos")


@pytest.fixture(scope="session")
def campanha_por_data(jogos_historicos) -> pd.DataFrame:
    return motor.campanha(jogos_historicos, "data", "ST", "todos")
