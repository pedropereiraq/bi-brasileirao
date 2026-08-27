"""
Conferência da edição corrente contra a classificação publicada pelo Sofascore.

O coletor traz a lista de jogos; a classificação nós calculamos. Esta conferência
compara o nosso cálculo com a tabela que a própria fonte publica — se as duas
baterem posição a posição, o par (coleta, motor) está íntegro.

Não é fonte de dado: nada do que vem daqui entra no banco. É só teste de sanidade,
rodado sob demanda e no workflow depois de cada coleta.
"""
from __future__ import annotations

import argparse
import json

import pandas as pd
from curl_cffi import requests as requisicoes

from . import canonico
from . import config as cfg
from . import motor
from .coletor import carregar_de_para

COLUNAS = ["pos", "equipe", "pts", "j", "v", "e", "d", "gp_ac", "gc_ac", "sg_ac"]


def classificacao_oficial(serie: str, ano: int) -> pd.DataFrame:
    """Tabela publicada pela fonte, traduzida para os nomes canônicos."""
    temporada = cfg.TEMPORADAS[(serie, ano)]
    torneio = cfg.TORNEIOS[serie]
    sessao = requisicoes.Session(impersonate=cfg.IMPERSONACAO)
    url = (f"{cfg.SOFASCORE_BASE}/unique-tournament/{torneio}"
           f"/season/{temporada}/standings/total")
    resposta = sessao.get(url, timeout=30)
    resposta.raise_for_status()
    dados = resposta.json()

    cfg.garantir_pastas()
    (cfg.BRUTO / f"classificacao_oficial_{serie}_{ano}.json").write_text(
        json.dumps(dados, ensure_ascii=False), encoding="utf-8")

    de_para = carregar_de_para()
    linhas = [{
        "pos": r["position"],
        "equipe": de_para[r["team"]["id"]],
        "pts": r["points"],
        "j": r["matches"],
        "v": r["wins"],
        "e": r["draws"],
        "d": r["losses"],
        "gp_ac": r["scoresFor"],
        "gc_ac": r["scoresAgainst"],
    } for r in dados["standings"][0]["rows"]]
    oficial = pd.DataFrame(linhas)
    oficial["sg_ac"] = oficial["gp_ac"] - oficial["gc_ac"]
    return oficial[COLUNAS]


def classificacao_calculada(serie: str, ano: int) -> pd.DataFrame:
    """Nossa tabela na última etapa disputada, critério ST, todos os locais."""
    jogos = canonico.carregar_jogos()
    recorte = jogos[(jogos["ano"] == ano) & (jogos["serie"] == serie)]
    campanha = motor.campanha(recorte, ordem="rodada", criterio="ST", local="todos")
    ultima = campanha[campanha["etapa"] == campanha["etapa"].max()]
    calculada = ultima[COLUNAS].copy()
    for coluna in COLUNAS[2:]:
        calculada[coluna] = calculada[coluna].astype("int64")
    return calculada.sort_values("pos").reset_index(drop=True)


def conferir(serie: str, ano: int) -> pd.DataFrame:
    """Junta as duas tabelas por clube e devolve as linhas que não batem."""
    oficial = classificacao_oficial(serie, ano).add_prefix("of_")
    calculada = classificacao_calculada(serie, ano).add_prefix("ca_")
    junta = calculada.merge(
        oficial, left_on="ca_equipe", right_on="of_equipe", how="outer"
    )
    divergentes = pd.Series(False, index=junta.index)
    for coluna in COLUNAS:
        if coluna == "equipe":
            continue
        divergentes |= junta[f"ca_{coluna}"] != junta[f"of_{coluna}"]
    return junta[divergentes]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Confere a edição corrente")
    ap.add_argument("--ano", type=int, default=2026)
    args = ap.parse_args(argv)

    houve_erro = False
    for serie in cfg.SERIES:
        calculada = classificacao_calculada(serie, args.ano)
        divergencias = conferir(serie, args.ano)
        print(f"\n=== Série {serie} {args.ano} — nossa classificação ===")
        print(calculada.to_string(index=False))
        if divergencias.empty:
            print(f"OK: as {len(calculada)} linhas batem com a tabela oficial.")
        else:
            houve_erro = True
            print(f"DIVERGÊNCIAS ({len(divergencias)}):")
            print(divergencias.to_string(index=False))
    return 1 if houve_erro else 0


if __name__ == "__main__":
    raise SystemExit(main())
