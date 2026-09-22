"""
A camada de consulta é o que separa uma pergunta de um número publicado.
Estes testes cobrem o que, se quebrar, produz número errado com cara de certo:
o padrão de variação, a resolução de nome de clube, a fronteira entre edição
fechada e em andamento, e as ressalvas obrigatórias.
"""
from __future__ import annotations

import pandas as pd
import pytest

from bi import config as cfg
from bi import consulta


# --------------------------------------------------------------- variação
def test_padrao_reproduz_a_tabela_oficial():
    """O padrão tem de ser rodada + CT + todos. Mudar isso muda todo número."""
    assert consulta.PADRAO == {"ordem": "rodada", "criterio": "CT", "local": "todos"}


@pytest.mark.parametrize("campo,valor", [
    ("ordem", "cronologica"), ("criterio", "SemTapetao"), ("local", "mandante"),
])
def test_variacao_invalida_fala_alto(campo, valor):
    with pytest.raises(consulta.ConsultaInvalida) as erro:
        consulta.classificacao(2025, "A", **{campo: valor})
    assert campo in str(erro.value)


def test_serie_aceita_forma_humana():
    assert consulta._serie("série a") == "A"
    assert consulta._serie(" b ") == "B"
    with pytest.raises(consulta.ConsultaInvalida):
        consulta._serie("C")


def test_contexto_declara_o_que_foi_usado():
    texto = consulta.contexto(2026, "A", 26)
    assert "Série A de 2026" in texto and "rodada 26" in texto
    assert "tapetão" in texto
    assert "só jogos em casa" in consulta.contexto(2026, "A", 26, local="casa")


# ----------------------------------------------------------- classificação
def test_classificacao_tem_vinte_clubes_e_posicoes_unicas():
    tabela = consulta.classificacao(2025, "A", 38)
    assert len(tabela) == cfg.CLUBES_POR_SERIE
    assert list(tabela["pos"]) == list(range(1, 21))


def test_classificacao_na_ultima_etapa_bate_com_pos_fim():
    """Em edição fechada, a posição na rodada 38 é a posição final."""
    fato = consulta._recorte(consulta._ler("fato_clube_etapa"),
                             consulta._variacao())
    for ano in range(cfg.ANO_INICIO_BI, 2026):
        for serie in cfg.SERIES:
            final = fato[(fato["ano"] == ano) & (fato["serie"] == serie)
                         & (fato["etapa"] == cfg.RODADAS)]
            assert (final["pos"] == final["pos_fim"]).all(), (ano, serie)


def test_etapa_inexistente_diz_qual_e_a_ultima():
    with pytest.raises(consulta.ConsultaInvalida) as erro:
        consulta.classificacao(2026, "A", 38)
    assert str(consulta.etapa_max(2026, "A")) in str(erro.value)


def test_ano_fora_do_recorte_explica_o_recorte():
    with pytest.raises(consulta.ConsultaInvalida) as erro:
        consulta.classificacao(2005, "A")
    assert str(cfg.ANO_INICIO_BI) in str(erro.value)


def test_criterio_muda_a_pontuacao_de_quem_foi_punido():
    """Cruzeiro perdeu 6 pontos na Série B de 2020, a partir da rodada 1."""
    com = consulta.classificacao(2020, "B", 38, criterio="CT").set_index("equipe")
    sem = consulta.classificacao(2020, "B", 38, criterio="ST").set_index("equipe")
    assert sem.loc["CRUZEIRO (MG)", "pts"] - com.loc["CRUZEIRO (MG)", "pts"] == 6


def test_local_soma_casa_mais_fora_igual_ao_total():
    ano, serie, etapa = 2025, "A", 38
    def pts(**v):
        return consulta.classificacao(ano, serie, etapa, **v) \
            .set_index("equipe")["pts"].sort_index()

    total, casa, fora = pts(), pts(local="casa"), pts(local="fora")
    assert ((casa + fora) == total).all()


# ----------------------------------------------------------------- clubes
@pytest.mark.parametrize("entrada,esperado", [
    ("bahia", "BAHIA (BA)"),
    ("BAHIA (BA)", "BAHIA (BA)"),
    ("Grêmio", "GRÊMIO (RS)"),
    ("gremio", "GRÊMIO (RS)"),
    ("vitoria", "VITÓRIA (BA)"),      # (ES) existe, mas nunca jogou o recorte
])
def test_resolver_clube_aceita_como_a_gente_fala(entrada, esperado):
    assert consulta.resolver_clube(entrada) == esperado


def test_resolver_clube_usa_a_edicao_para_desambiguar():
    assert consulta.resolver_clube("atletico", 2026, "A") == "ATLÉTICO (MG)"
    assert consulta.resolver_clube("botafogo", 2026, "A") == "BOTAFOGO (RJ)"
    assert consulta.resolver_clube("botafogo", 2026, "B") == "BOTAFOGO (SP)"


def test_nome_ambiguo_nao_escolhe_por_conta_propria():
    with pytest.raises(consulta.ConsultaInvalida) as erro:
        consulta.resolver_clube("atletico")
    assert "ambíguo" in str(erro.value)


def test_clube_fora_da_edicao_nao_vira_resposta_vazia():
    with pytest.raises(consulta.ConsultaInvalida):
        consulta.campanha("palmeiras", 2026, "B")


# --------------------------------------------------------------- campanha
def test_campanha_tem_uma_linha_por_etapa_em_ordem():
    c = consulta.campanha("bahia", 2025, "A")
    assert len(c) == cfg.RODADAS
    assert list(c["etapa"]) == list(range(1, cfg.RODADAS + 1))
    assert c["pts"].is_monotonic_increasing


def test_campanha_por_data_reordena_sem_mudar_o_total():
    por_rodada = consulta.campanha("bahia", 2025, "A", ordem="rodada")
    por_data = consulta.campanha("bahia", 2025, "A", ordem="data")
    assert por_rodada["pts"].iloc[-1] == por_data["pts"].iloc[-1]


def test_evolucao_devolve_etapas_nas_linhas_e_clubes_nas_colunas():
    p = consulta.evolucao(2025, "A", "pos", ["bahia", "vitoria"])
    assert list(p.columns) == ["BAHIA (BA)", "VITÓRIA (BA)"]
    assert p.index.name == "etapa"


# ------------------------------------------------------- edições fechadas
def test_edicoes_em_andamento_nao_entram_no_historico():
    fechadas = consulta.edicoes_fechadas()
    assert (2025, "A") in fechadas
    assert (2026, "A") not in fechadas


def test_pontuacao_tipica_so_olha_edicao_fechada():
    linha = consulta.pontuacao_tipica("A", 26, 43)
    assert linha["ano_ultimo"] <= 2025
    assert linha["n_ocorrencias"] >= 1


def test_campanhas_semelhantes_nao_inclui_a_edicao_corrente():
    semelhantes = consulta.campanhas_semelhantes("bahia", 2026)
    assert (semelhantes["ano"] < 2026).all()
    assert semelhantes["pos_fim"].notna().all()


def test_projecao_descreve_a_situacao_atual_e_o_historico():
    p = consulta.projecao("bahia", 2026)
    atual = consulta.classificacao(2026, "A").set_index("equipe")
    assert p["pts"] == atual.loc["BAHIA (BA)", "pts"]
    assert p["pos_agora"] == atual.loc["BAHIA (BA)", "pos"]
    assert 1 <= p["pos_fim_melhor"] <= p["pos_fim_pior"] <= 20
    assert "tapetão" in p["contexto"]


def test_ranking_etapa_pode_incluir_ou_excluir_a_corrente():
    com = consulta.ranking_etapa("A", 26, n=50)
    sem = consulta.ranking_etapa("A", 26, n=50, incluir_em_andamento=False)
    assert 2026 in set(com["ano"])
    assert 2026 not in set(sem["ano"])


# -------------------------------------------------------------- ressalvas
def test_edicao_em_andamento_avisa_que_nao_tem_posicao_final():
    avisos = " | ".join(consulta.observacoes(2026, "A"))
    assert "em andamento" in avisos


def test_jogo_nao_realizado_de_2016_aparece_nas_ressalvas():
    avisos = " | ".join(consulta.observacoes(2016, "A", 38))
    assert "CHAPECOENSE (SC)" in avisos and "não foi disputado" in avisos


def test_tapetao_aparece_nas_ressalvas_quando_o_criterio_e_ct():
    assert any("tapetão" in a for a in consulta.observacoes(2020, "B", 10))
    assert not any("tapetão" in a
                   for a in consulta.observacoes(2020, "B", 10, criterio="ST"))


def test_edicao_fechada_e_limpa_nao_gera_ressalva():
    assert consulta.observacoes(2025, "A", 38) == []


# ------------------------------------------------------------------ jogos
def test_confrontos_olha_dos_dois_lados_do_mando():
    r = consulta.confrontos("bahia", "vitoria", desde=2006)
    assert r["jogos"] == r["v"] + r["e"] + r["d"]
    assert len(r["lista"]) == r["jogos"]


def test_jogos_de_alcanca_fora_do_recorte_do_bi():
    antigos = consulta.jogos_de(1971, "A")
    assert len(antigos) > 0


def test_frescor_diz_ate_onde_os_dados_vao():
    f = consulta.frescor()
    assert f["ano_corrente"] >= 2026
    assert pd.Timestamp(f["ultimo_jogo_realizado"]) > pd.Timestamp("2026-01-01")
    assert f["series"]["A"]["etapa_max"] >= 1
