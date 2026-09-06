"""
Gera os arquivos que o site consome.

Decisão que sustenta as páginas: **o navegador recebe a lista de jogos e calcula
a tabela.** Não recebe tabelas prontas.

O motivo é o filtro. "Classificação nas rodadas 10 a 20", "nos últimos 5 jogos",
"só em casa", "entre duas datas" — isso é um número infinito de recortes, e
nenhum conjunto de tabelas pré-calculadas cobre todos. A partir dos jogos,
qualquer recorte é exato.

O custo é ter um segundo motor, em JavaScript. O preço se paga com
`testes/test_motor_navegador.py`, que gera o gabarito a partir do motor Python
— o que reproduz a matriz do Excel — e um teste em Node prova que o motor do
navegador devolve exatamente o mesmo, em toda edição, etapa e mando.

As tabelas derivadas continuam servindo às páginas históricas, que cruzam 20
edições e não caberiam no navegador.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import pandas as pd

from . import canonico
from . import config as cfg

DESTINO = cfg.RAIZ / "site" / "public" / "dados"

# Campos de um jogo, na ordem em que vão para o array. Formato posicional em vez
# de objeto: são 380 jogos por edição, e nome de campo repetido 380 vezes é puro
# peso. O motor do navegador conhece esta ordem.
CAMPOS_JOGO = ["rodada", "data", "mandante", "visitante", "gols_m", "gols_v", "status"]


def _recorte_bi(jogos: pd.DataFrame) -> pd.DataFrame:
    return jogos[
        (jogos["ano"] >= cfg.ANO_INICIO_BI)
        & (jogos["serie"].isin(cfg.SERIES))
        & (jogos["fase"] == cfg.FASE_UNICA)
    ]


def publicar_clubes(jogos: pd.DataFrame, clubes: pd.DataFrame) -> dict:
    """Só os clubes que aparecem em alguma edição do recorte."""
    presentes = set(jogos["mandante"]) | set(jogos["visitante"])
    sub = clubes[clubes["equipe"].isin(presentes)]
    return {
        linha.equipe: {
            "sigla": linha.sigla,
            "escudo": linha.escudo if isinstance(linha.escudo, str) else None,
            "estado": linha.estado,
            "regiao": linha.regiao,
            "cidade": linha.cidade,
        }
        for linha in sub.itertuples()
    }


def publicar_edicao(jogos: pd.DataFrame) -> list[list]:
    """Uma edição como lista de listas, na ordem de CAMPOS_JOGO."""
    ordenados = jogos.sort_values(["rodada", "data", "mandante"])
    linhas = []
    for j in ordenados.itertuples():
        linhas.append([
            int(j.rodada),
            j.data.strftime("%Y-%m-%d"),
            j.mandante,
            j.visitante,
            None if pd.isna(j.gols_m) else int(j.gols_m),
            None if pd.isna(j.gols_v) else int(j.gols_v),
            j.status,
        ])
    return linhas


def resumir_edicao(jogos: pd.DataFrame) -> dict:
    """Metadados que o seletor de edição precisa antes de baixar os jogos."""
    realizados = jogos[jogos["status"] == cfg.STATUS_REALIZADO]
    return {
        "jogos": len(jogos),
        "realizados": len(realizados),
        "rodada_atual": int(realizados["rodada"].max()) if len(realizados) else 0,
        "rodadas": int(jogos["rodada"].max()),
        "primeira_data": jogos["data"].min().strftime("%Y-%m-%d"),
        "ultima_data": realizados["data"].max().strftime("%Y-%m-%d")
        if len(realizados) else None,
        "encerrada": len(realizados) == len(jogos),
    }


def construir(jogos: pd.DataFrame | None = None,
              clubes: pd.DataFrame | None = None) -> dict:
    jogos = canonico.carregar_jogos() if jogos is None else jogos
    clubes = canonico.carregar_clubes() if clubes is None else clubes
    recorte = _recorte_bi(jogos)

    if DESTINO.exists():
        shutil.rmtree(DESTINO)
    (DESTINO / "jogos").mkdir(parents=True)

    edicoes = []
    for (ano, serie), grupo in recorte.groupby(["ano", "serie"], sort=True):
        apelido = f"{serie}{ano}"
        _gravar(DESTINO / "jogos" / f"{apelido}.json", publicar_edicao(grupo))
        edicoes.append({"ano": int(ano), "serie": serie, "apelido": apelido,
                        **resumir_edicao(grupo)})

    edicoes.sort(key=lambda e: (-e["ano"], e["serie"]))
    _gravar(DESTINO / "edicoes.json", {
        "campos_jogo": CAMPOS_JOGO,
        "edicoes": edicoes,
    })
    _gravar(DESTINO / "clubes.json", publicar_clubes(recorte, clubes))

    tamanho = sum(p.stat().st_size for p in DESTINO.rglob("*.json"))
    print(f"  {len(edicoes)} edições, {len(publicar_clubes(recorte, clubes))} clubes"
          f" -> {tamanho/1024:.0f} KB em {DESTINO.relative_to(cfg.RAIZ)}")
    return {"edicoes": len(edicoes), "bytes": tamanho}


def _gravar(caminho: Path, conteudo) -> None:
    caminho.write_text(
        json.dumps(conteudo, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
