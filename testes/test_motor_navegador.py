"""
Gera o gabarito que prova o motor do navegador.

O site tem um segundo motor, em JavaScript, porque os filtros do usuário são um
número infinito de recortes e nenhuma tabela pré-calculada os cobre. Dois
motores só são seguros se um provar o outro.

A cadeia de confiança fica assim:

    matriz do Excel  ->  bi/motor.py  ->  gabarito  ->  site/public/js/motor.js
       (30.400          (reproduz          (aqui)        (site/testes/
        linhas)          sem divergência)                 motor.test.js)

Este arquivo é a terceira seta: exporta, do motor Python, a classificação de
cada etapa de cada edição em cada mando, no formato que o teste em Node lê.
O `pytest` confere que o gabarito saiu íntegro; o `node --test` confere que o
JavaScript o reproduz.
"""
from __future__ import annotations

import json

import pytest

from bi import config as cfg
from bi import motor, publicacao

GABARITO = cfg.RAIZ / "site" / "testes" / "gabarito.json"

# Edições que entram no gabarito. Poucas e escolhidas, não todas: o teste em
# Node roda a cada push e precisa ser rápido. As quatro cobrem o que interessa —
# uma com tapetão, a do jogo não realizado, a do empate absoluto e a em curso.
EDICOES = [
    (2016, "A"),  # Chapecoense x Atlético-MG na rodada 38, jogo não realizado
    (2018, "A"),  # tapetão do Sport
    (2025, "A"),  # São Paulo e Sport, empate absoluto na rodada 1
    (2026, "B"),  # edição em andamento, com jogos ainda sem placar
]


@pytest.fixture(scope="module")
def edicoes(jogos_todos):
    return {(ano, serie): jogos_todos[(jogos_todos["ano"] == ano)
                                      & (jogos_todos["serie"] == serie)]
            for ano, serie in EDICOES}


@pytest.fixture(scope="module")
def gabarito(edicoes) -> dict:
    """
    Para cada edição, cada mando e cada etapa: a tabela que o Python calcula.
    É contra isto que o motor do navegador é medido. Gravado em disco porque
    quem consome é o `node --test`, noutro processo.
    """
    conteudo = {"campos_jogo": publicacao.CAMPOS_JOGO, "edicoes": {}}

    for (ano, serie), jogos in edicoes.items():
        registro = {"jogos": publicacao.publicar_edicao(jogos), "esperado": {}}

        for local in cfg.LOCAIS:
            campanha = motor.campanha(jogos, ordem="rodada", criterio="ST",
                                      local=local)
            registro["esperado"][local] = {
                str(int(etapa)): [
                    [linha.equipe, int(linha.pos), int(linha.pts), int(linha.j),
                     int(linha.v), int(linha.e), int(linha.d),
                     int(linha.gp_ac), int(linha.gc_ac)]
                    for linha in grupo.sort_values("pos").itertuples()
                ]
                for etapa, grupo in campanha.groupby("etapa")
            }

        conteudo["edicoes"][f"{serie}{ano}"] = registro

    GABARITO.parent.mkdir(parents=True, exist_ok=True)
    GABARITO.write_text(
        json.dumps(conteudo, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    return conteudo


def test_o_gabarito_cobre_as_edicoes_pedidas(gabarito):
    assert set(gabarito["edicoes"]) == {f"{s}{a}" for a, s in EDICOES}
    assert GABARITO.stat().st_size > 10_000


def test_o_gabarito_cobre_os_casos_que_importam(edicoes):
    """Se uma edição do gabarito perder seu caso especial, o teste vira enfeite."""
    a2016 = edicoes[(2016, "A")]
    assert (a2016["status"] == cfg.STATUS_NAO_REALIZADO).sum() == 1, \
        "2016 A deveria trazer o jogo não realizado"

    a2018 = edicoes[(2018, "A")]
    assert (a2018["tapetao_m"] + a2018["tapetao_v"]).sum() < 0, \
        "2018 A deveria trazer punição de tapetão"

    b2026 = edicoes[(2026, "B")]
    assert (b2026["status"] != cfg.STATUS_REALIZADO).any(), \
        "2026 B deveria estar em andamento"


def test_o_gabarito_tem_vinte_clubes_em_toda_etapa(gabarito):
    """Sanidade do próprio gabarito, antes de cobrar isso do JavaScript."""
    for apelido, registro in gabarito["edicoes"].items():
        for local, etapas in registro["esperado"].items():
            for etapa, linhas in etapas.items():
                assert len(linhas) == cfg.CLUBES_POR_SERIE, \
                    f"{apelido} {local} etapa {etapa}: {len(linhas)} clubes"
                posicoes = sorted(linha[1] for linha in linhas)
                assert posicoes == list(range(1, cfg.CLUBES_POR_SERIE + 1))
