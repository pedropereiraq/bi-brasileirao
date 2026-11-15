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
# Node roda a cada push e precisa ser rápido. Estas três cobrem casos que a
# história não desfaz — tapetão, jogo não realizado e empate absoluto.
EDICOES_FIXAS = [
    (2016, "A"),  # Chapecoense x Atlético-MG na rodada 38, jogo não realizado
    (2018, "A"),  # tapetão do Sport
    (2025, "A"),  # São Paulo e Sport, empate absoluto na rodada 1
]

# Abaixo disto a edição não tem mais o formato de campeonato em curso: sobra um
# jogo adiado aqui e ali, que é outro caso — e o de 2016 A já o cobre.
MINIMO_EM_ANDAMENTO = 5


def edicao_em_andamento(jogos):
    """
    A edição que ainda está sendo jogada, lida do dado e não fixada aqui.

    O quarto caso do gabarito é uma edição em curso, com muitos jogos sem
    placar: é outra forma de tabela, com clubes em números diferentes de jogos,
    e o motor do navegador precisa dar conta dela.

    Fixar uma edição em curso no código é marcar encontro com o próprio fim.
    Quando a Série B de 2026 terminou, em 14/11/2026, o caso sumiu, este teste
    passou a falhar e derrubou o passo seguinte do recálculo — que versiona e
    publica. A coleta entrava e nada saía. Por isso quem está em curso é o dado
    que diz.

    Escolhe a que tem mais jogos pela frente, e não a mais recente: no fim do
    ano as duas séries convivem com a A ainda rolando e a B já encerrada, e é a
    de calendário mais longo que serve de caso por mais tempo.
    """
    candidatas = sorted(
        (int((grupo["status"] != cfg.STATUS_REALIZADO).sum()), int(ano), serie)
        for (ano, serie), grupo in jogos.groupby(["ano", "serie"])
    )
    if not candidatas or candidatas[-1][0] < MINIMO_EM_ANDAMENTO:
        return None
    _, ano, serie = candidatas[-1]
    return (ano, serie)


@pytest.fixture(scope="module")
def edicoes_pedidas(jogos_todos):
    """As três fixas mais a que estiver em curso, quando houver uma."""
    em_curso = edicao_em_andamento(jogos_todos)
    return EDICOES_FIXAS + ([em_curso] if em_curso else [])


@pytest.fixture(scope="module")
def edicoes(jogos_todos, edicoes_pedidas):
    return {(ano, serie): jogos_todos[(jogos_todos["ano"] == ano)
                                      & (jogos_todos["serie"] == serie)]
            for ano, serie in edicoes_pedidas}


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


def test_o_gabarito_cobre_as_edicoes_pedidas(gabarito, edicoes_pedidas):
    assert set(gabarito["edicoes"]) == {f"{s}{a}" for a, s in edicoes_pedidas}
    assert GABARITO.stat().st_size > 10_000


def test_o_gabarito_cobre_os_casos_que_importam(edicoes, jogos_todos):
    """Se uma edição do gabarito perder seu caso especial, o teste vira enfeite."""
    a2016 = edicoes[(2016, "A")]
    assert (a2016["status"] == cfg.STATUS_NAO_REALIZADO).sum() == 1, \
        "2016 A deveria trazer o jogo não realizado"

    a2018 = edicoes[(2018, "A")]
    assert (a2018["tapetao_m"] + a2018["tapetao_v"]).sum() < 0, \
        "2018 A deveria trazer punição de tapetão"

    # O quarto caso é a edição em curso, que muda sozinha com o calendário. O
    # que se cobra aqui não é que ela exista — o calendário decide isso —, e sim
    # que, existindo, ela tenha entrado no gabarito.
    em_curso = edicao_em_andamento(jogos_todos)
    if em_curso is None:
        pytest.skip("entressafra: nenhuma edição em curso para cobrir o caso")
    assert em_curso in edicoes, \
        f"a edição em curso ({em_curso[0]} {em_curso[1]}) ficou fora do gabarito"
    assert (edicoes[em_curso]["status"] != cfg.STATUS_REALIZADO).sum() \
        >= MINIMO_EM_ANDAMENTO


def test_o_gabarito_tem_vinte_clubes_em_toda_etapa(gabarito):
    """Sanidade do próprio gabarito, antes de cobrar isso do JavaScript."""
    for apelido, registro in gabarito["edicoes"].items():
        for local, etapas in registro["esperado"].items():
            for etapa, linhas in etapas.items():
                assert len(linhas) == cfg.CLUBES_POR_SERIE, \
                    f"{apelido} {local} etapa {etapa}: {len(linhas)} clubes"
                posicoes = sorted(linha[1] for linha in linhas)
                assert posicoes == list(range(1, cfg.CLUBES_POR_SERIE + 1))
