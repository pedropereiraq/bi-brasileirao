"""
A camada derivada é derivada mesmo?

O compromisso do projeto é que nada seja digitado à mão: apagar `dados/derivado`
e recalcular tem de devolver exatamente o que está versionado. Este teste
refaz as três fato a partir de `dados/canonico/jogos.parquet` e compara com os
parquets do repositório, linha a linha.

A comparação é por conteúdo, não por bytes: o parquet é determinístico dentro de
um mesmo ambiente, mas o cabeçalho carrega a versão do pyarrow, e comparar bytes
faria o CI quebrar a cada atualização de dependência sem que dado nenhum tivesse
mudado.

Se `dados/` ainda não foi construído, os testes são pulados em vez de falhar —
num clone novo o banco pode não ter sido gerado ainda.
"""
from __future__ import annotations

import json

import pandas as pd
import pytest

from bi import canonico
from bi import config as cfg
from bi import derivadas

TABELAS = ["fato_clube_etapa", "fato_posicao_etapa", "fato_pontuacao_etapa"]


@pytest.fixture(scope="module")
def jogos() -> pd.DataFrame:
    caminho = cfg.CANONICO / "jogos.parquet"
    if not caminho.exists():
        pytest.skip("banco não construído — rode `python -m bi construir`")
    return canonico.carregar_jogos()


@pytest.fixture(scope="module")
def recalculadas(jogos) -> dict[str, pd.DataFrame]:
    clube_etapa = derivadas.fato_clube_etapa(jogos)
    return {
        "fato_clube_etapa": clube_etapa,
        "fato_posicao_etapa": derivadas.fato_posicao_etapa(clube_etapa),
        "fato_pontuacao_etapa": derivadas.fato_pontuacao_etapa(
            clube_etapa, derivadas.edicoes_completas(jogos)
        ),
    }


@pytest.mark.parametrize("nome", TABELAS)
def test_a_tabela_versionada_bate_com_o_recalculo(nome, recalculadas):
    caminho = cfg.DERIVADO / f"{nome}.parquet"
    if not caminho.exists():
        pytest.skip("banco não construído — rode `python -m bi construir`")
    versionada = derivadas.carregar(nome)
    pd.testing.assert_frame_equal(
        versionada.reset_index(drop=True),
        recalculadas[nome].reset_index(drop=True),
        check_dtype=False, check_categorical=False,
    )


def test_o_canonico_cobre_a_edicao_corrente(jogos):
    """A coleta tem de estar dentro do canônico, e não só no CSV do coletor."""
    correntes = sorted(
        p.stem.removeprefix("jogos_") for p in (cfg.DADOS / "corrente").glob("*.csv")
    ) if (cfg.DADOS / "corrente").exists() else []
    if not correntes:
        pytest.skip("nenhuma coleta corrente em disco")

    do_sofascore = jogos[jogos["origem"] == "sofascore"]
    assert not do_sofascore.empty, "a coleta não chegou ao canônico"
    for edicao in correntes:
        serie, ano = edicao[0], int(edicao[1:])
        recorte = do_sofascore[
            (do_sofascore["serie"] == serie) & (do_sofascore["ano"] == ano)
        ]
        assert len(recorte) == cfg.CLUBES_POR_SERIE * (cfg.CLUBES_POR_SERIE - 1), (
            f"{edicao}: {len(recorte)} jogos no canônico"
        )


def test_o_excel_nao_disputa_ano_com_a_coleta(jogos):
    """Uma edição vem de uma fonte só — senão o mesmo jogo entraria duas vezes."""
    fontes_por_edicao = jogos.groupby(["ano", "serie"])["origem"].nunique()
    conflitantes = fontes_por_edicao[fontes_por_edicao > 1]
    assert conflitantes.empty, (
        "edições com duas origens:\n" + conflitantes.to_string()
    )


# ---------------------------------------------------------- dados do site
#
# O site não lê os parquets: ele lê JSON em `site/public/dados`, gerado por
# `bi.publicacao`. Já aconteceu de o recálculo atualizar o canônico e deixar
# esse JSON para trás — o repositório fresco e o site mostrando a coleta
# anterior, sem nenhum erro em lugar nenhum. Estes testes pegam isso.

def _dados_do_site(nome: str):
    caminho = cfg.RAIZ / "site" / "public" / "dados" / nome
    if not caminho.exists():
        pytest.skip("dados do site não gerados — rode `python -m bi construir`")
    return json.loads(caminho.read_text(encoding="utf-8"))


def test_o_resumo_das_edicoes_bate_com_o_canonico(jogos):
    """Cada edição publicada tem de descrever o que o canônico realmente tem."""
    from bi import publicacao

    publicado = {e["apelido"]: e for e in _dados_do_site("edicoes.json")["edicoes"]}
    recorte = publicacao._recorte_bi(jogos)

    for (ano, serie), grupo in recorte.groupby(["ano", "serie"]):
        apelido = f"{serie}{ano}"
        assert apelido in publicado, f"{apelido} não foi publicado para o site"
        esperado = publicacao.resumir_edicao(grupo)
        for campo, valor in esperado.items():
            assert publicado[apelido][campo] == valor, (
                f"{apelido}: {campo} publicado como "
                f"{publicado[apelido][campo]}, esperado {valor}"
            )


def test_a_lista_de_jogos_publicada_bate_com_o_canonico(jogos):
    """
    O arquivo de jogos de cada edição é o que o navegador usa para calcular
    tudo. Se ele envelhecer, o site mostra a tabela da semana passada.
    """
    from bi import publicacao

    recorte = publicacao._recorte_bi(jogos)
    for (ano, serie), grupo in recorte.groupby(["ano", "serie"]):
        apelido = f"{serie}{ano}"
        publicado = _dados_do_site(f"jogos/{apelido}.json")
        esperado = publicacao.publicar_edicao(grupo)
        assert publicado == esperado, (
            f"{apelido}: {len(publicado)} jogos publicados contra "
            f"{len(esperado)} no canônico — dados do site desatualizados"
        )
def test_as_referencias_publicadas_batem_com_o_canonico(jogos):
    """A régua de pontuação por posição é derivada, não digitada."""
    from bi import publicacao

    publicado = _dados_do_site("referencias.json")
    assert publicado == publicacao.referencias_por_posicao(jogos)


def test_a_referencia_so_usa_edicao_encerrada(jogos):
    """
    Uma edição em andamento não tem posição final. Se entrasse na média, a
    régua inteira desceria — todo mundo com 27 jogos parece pior do que é.
    """
    from bi import derivadas, publicacao

    referencias = publicacao.referencias_por_posicao(jogos)
    completas = derivadas.edicoes_completas(jogos)

    for serie, dados in referencias.items():
        anos = {ano for ano, s in completas if s == serie}
        assert dados["edicoes"] == len(anos), (
            f"série {serie}: {dados['edicoes']} edições na média contra "
            f"{len(anos)} encerradas no canônico"
        )
        assert dados["ano_ultimo"] == max(anos)
        # Toda posição da série tem média, e elas caem de 1 a 20.
        medias = [dados["media"][str(pos)]
                  for pos in range(1, cfg.CLUBES_POR_SERIE + 1)]
        assert medias == sorted(medias, reverse=True), (
            f"série {serie}: a média por posição não é decrescente"
        )
def test_as_campanhas_publicadas_batem_com_o_canonico(jogos):
    """A pontuação jogo a jogo também é derivada, não digitada."""
    from bi import publicacao

    publicado = _dados_do_site("campanhas.json")
    assert publicado == publicacao.campanhas_por_jogo(jogos)


def test_campanha_sem_desfecho_nao_tem_posicao_final(jogos):
    """
    A edição em andamento entra no arquivo — é dela que sai o ponto de partida
    — mas sem posição final. Se tivesse uma, ela apareceria nas respostas de
    "o que aconteceu com quem esteve nesta situação", e não aconteceu nada
    ainda.
    """
    from bi import derivadas, publicacao

    dados = publicacao.campanhas_por_jogo(jogos)
    completas = derivadas.edicoes_completas(jogos)
    disputados = _jogos_disputados(jogos)

    for serie, anos in dados["series"].items():
        for ano, clubes in anos.items():
            encerrada = (int(ano), serie) in completas
            for equipe, pos_fim, pontos in clubes:
                if encerrada:
                    assert pos_fim is not None, f"{equipe} {serie}{ano}"
                    assert 1 <= pos_fim <= cfg.CLUBES_POR_SERIE
                    # Não são 38 fixos: em 2016 o Chapecoense x Atlético-MG não
                    # foi disputado, e os dois clubes terminaram com 37 jogos
                    # numa edição encerrada. O que a campanha tem de ter é
                    # exatamente o número de jogos que ela jogou.
                    assert len(pontos) == disputados[(int(ano), serie, equipe)], (
                        f"{equipe} {serie}{ano}: {len(pontos)} jogos publicados"
                    )
                else:
                    assert pos_fim is None, (
                        f"{equipe} {serie}{ano} tem posição final numa edição aberta"
                    )
                # O acumulado nunca cai, e nunca sobe mais de 3 por jogo.
                for antes, depois in zip(pontos, pontos[1:]):
                    assert 0 <= depois - antes <= 3, f"{equipe} {serie}{ano}"


def test_o_fluxo_fecha_com_a_grade_em_toda_rodada(jogos):
    """
    A identidade que sustenta a última linha do card de médias: o que a rodada
    tinha para dar é o que chegou à tabela mais o que ficou pelo caminho.

    Se ela abrir, o card passa a explicar uma diferença para a média com uma
    conta que não fecha — que é pior do que não explicar nada.
    """
    from bi import publicacao

    dados = publicacao.posicoes_por_rodada(jogos)
    for serie, anos in dados["series"].items():
        for ano, edicao in anos.items():
            por_rodada = len(edicao["clubes"]) // 2
            for i, (rodada, (queimados, retidos)) in enumerate(
                    zip(edicao["grade"], edicao["fluxo"]), start=1):
                distribuidos = sum(pts for _, pts in rodada)
                assert distribuidos + queimados + retidos == por_rodada * i * 3, (
                    f"{serie}{ano} rodada {i}: a conta dos pontos não fecha"
                )


def test_as_posicoes_publicadas_batem_com_o_canonico(jogos):
    """A tabela de cada rodada também é derivada, não digitada."""
    from bi import publicacao

    publicado = _dados_do_site("posicoes.json")
    assert publicado == publicacao.posicoes_por_rodada(jogos)


def test_a_grade_de_rodadas_e_uma_tabela_de_verdade(jogos):
    """
    Cada rodada tem as 20 posições, uma vez cada, em ordem não crescente de
    pontos. Se a ordem se perdesse, a posição 1 poderia não ser a do líder — e
    o card inteiro é uma grade de posições.
    """
    from bi import publicacao

    dados = publicacao.posicoes_por_rodada(jogos)
    for serie, anos in dados["series"].items():
        for ano, edicao in anos.items():
            assert len(edicao["clubes"]) == cfg.CLUBES_POR_SERIE
            assert len(edicao["grade"]) == edicao["rodadas"]

            for i, rodada in enumerate(edicao["grade"], start=1):
                indices = [idx for idx, _ in rodada]
                assert sorted(indices) == list(range(cfg.CLUBES_POR_SERIE)), (
                    f"{serie}{ano} rodada {i}: clube repetido ou faltando"
                )
                pontos = [pts for _, pts in rodada]
                assert pontos == sorted(pontos, reverse=True), (
                    f"{serie}{ano} rodada {i}: fora da ordem de pontos"
                )

            # A última rodada da edição encerrada tem de reproduzir o `fim`.
            if edicao["encerrada"]:
                ultima = edicao["grade"][-1]
                for posicao, (idx, pts) in enumerate(ultima, start=1):
                    assert edicao["fim"][idx] == [posicao, pts], (
                        f"{serie}{ano}: {edicao['clubes'][idx]} fecha diferente"
                    )
            else:
                assert all(f is None for f in edicao["fim"]), (
                    f"{serie}{ano} está em andamento e tem posição final"
                )


def _jogos_disputados(jogos) -> dict:
    """Quantos jogos cada clube de fato disputou em cada edição."""
    from bi import publicacao

    recorte = publicacao._recorte_bi(jogos)
    realizados = recorte[recorte["status"] == cfg.STATUS_REALIZADO]
    contagem: dict[tuple, int] = {}
    for coluna in ["mandante", "visitante"]:
        for chave, n in realizados.groupby(["ano", "serie", coluna]).size().items():
            ano, serie, equipe = chave
            contagem[(int(ano), serie, equipe)] = (
                contagem.get((int(ano), serie, equipe), 0) + int(n)
            )
    return contagem
