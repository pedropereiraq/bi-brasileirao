"""
Coletor: normalização e deduplicação, sobre um snapshot fixo.

A fixture é um recorte real da coleta de 27/08/2026 da Série A, escolhido para
conter os cinco confrontos que a API devolve duplicados — o registro original
adiado mais o remarcado. Um deles (Flamengo x Mirassol, rodada 4) foi remarcado
para uma data que ainda não chegou, então o par é `adiado` + `agendado`: é o
caso que quebra a regra ingênua de "fica o que tem placar".

Nada aqui vai à rede. O teste roda offline, no CI, sempre igual.
"""
from __future__ import annotations

import json

import pytest

from bi import coletor
from bi import config as cfg

from .conftest import FIXTURES

ARQUIVO = FIXTURES / "eventos_sofascore_A2026.json"


@pytest.fixture(scope="module")
def eventos() -> list[dict]:
    return json.loads(ARQUIVO.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def de_para() -> dict[int, str]:
    return coletor.carregar_de_para()


@pytest.fixture(scope="module")
def jogos(eventos, de_para) -> list[dict]:
    return coletor.normalizar(eventos, "A", 2026, de_para)


# ------------------------------------------------------------- de-para
def test_o_de_para_cobre_os_quarenta_clubes_de_2026(de_para):
    assert len(de_para) == 2 * cfg.CLUBES_POR_SERIE


def test_clube_desconhecido_derruba_a_coleta(eventos, de_para):
    """
    Clube novo tem de estourar, não passar batido: um id sem tradução viraria
    uma equipe fantasma na base. A mensagem diz qual é e onde corrigir.
    """
    incompleto = dict(de_para)
    removido = eventos[0]["homeTeam"]["id"]
    incompleto.pop(removido)
    with pytest.raises(coletor.ErroColeta, match="de_para_clubes.csv"):
        coletor.normalizar(eventos, "A", 2026, incompleto)


# --------------------------------------------------------- deduplicação
def test_a_fixture_tem_os_confrontos_duplicados_esperados(eventos):
    """Se a fixture perder os duplicados, o teste abaixo vira decoração."""
    chaves = [(e["roundInfo"]["round"], e["homeTeam"]["id"], e["awayTeam"]["id"])
              for e in eventos]
    duplicados = {c for c in chaves if chaves.count(c) > 1}
    assert len(duplicados) == 5


def test_cada_confronto_sobra_uma_vez_so(jogos):
    chaves = [(j["rodada"], j["mandante"], j["visitante"]) for j in jogos]
    assert len(chaves) == len(set(chaves))


def test_o_registro_adiado_cede_lugar_ao_remarcado(jogos):
    """Athletico x Corinthians, rodada 2: fica o jogo que aconteceu, com placar."""
    jogo = _achar(jogos, 2, "ATHLETICO (PR)", "CORINTHIANS (SP)")
    assert jogo["status"] == cfg.STATUS_REALIZADO
    assert (jogo["gols_m"], jogo["gols_v"]) == (0, 1)


def test_remarcado_ainda_por_jogar_tambem_vence_o_adiado(jogos):
    """
    Flamengo x Mirassol, rodada 4: o par é `adiado` + `agendado`. Vale o
    remarcado, mesmo sem placar — é ele que descreve o estado atual do jogo.
    """
    jogo = _achar(jogos, 4, "FLAMENGO (RJ)", "MIRASSOL (SP)")
    assert jogo["status"] == cfg.STATUS_AGENDADO
    assert jogo["gols_m"] is None and jogo["gols_v"] is None


# ------------------------------------------------------------ placares
def test_jogo_sem_desfecho_nao_carrega_placar(jogos):
    """
    A API devolve `0` para partida que sequer começou. Guardar esse zero
    inventaria empates e envenenaria toda a classificação.
    """
    for jogo in jogos:
        if jogo["status"] != cfg.STATUS_REALIZADO:
            assert jogo["gols_m"] is None, jogo
            assert jogo["gols_v"] is None, jogo


def test_jogo_realizado_sempre_tem_placar(jogos):
    for jogo in jogos:
        if jogo["status"] == cfg.STATUS_REALIZADO:
            assert isinstance(jogo["gols_m"], int), jogo
            assert isinstance(jogo["gols_v"], int), jogo


# -------------------------------------------------------------- layout
def test_o_layout_e_o_canonico(jogos):
    assert set(jogos[0]) == set(coletor.CAMPOS)
    for jogo in jogos:
        assert jogo["fase"] == cfg.FASE_UNICA
        assert jogo["serie"] == "A"
        assert jogo["ano"] == 2026
        assert jogo["mandante"] != jogo["visitante"]


def test_o_id_do_jogo_e_unico_e_segue_a_convencao_do_excel(jogos):
    ids = [j["id_jogo"] for j in jogos]
    assert len(ids) == len(set(ids))
    assert all(i.startswith("A2026.") for i in ids)


def test_a_ordem_e_por_rodada_e_data(jogos):
    chaves = [(j["rodada"], j["data"], j["mandante"]) for j in jogos]
    assert chaves == sorted(chaves)


def _achar(jogos: list[dict], rodada: int, mandante: str, visitante: str) -> dict:
    achados = [j for j in jogos if j["rodada"] == rodada
               and j["mandante"] == mandante and j["visitante"] == visitante]
    assert len(achados) == 1, f"{rodada} {mandante} x {visitante}: {len(achados)}"
    return achados[0]
