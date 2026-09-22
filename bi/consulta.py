"""
Camada de consulta: o contrato estável entre as tabelas fato e quem pergunta.

Existe para uma razão só. As tabelas derivadas têm três dimensões de variação
(`ordem`, `criterio`, `local`) e 27 colunas; escrever pandas à mão sobre elas a
cada pergunta é como um número errado com cara de certo chega ao Twitter. Aqui
a semântica fica encodada uma vez, com teste, e quem pergunta chama função.

Padrões: `ordem='rodada'`, `criterio='CT'`, `local='todos'` — a combinação que
reproduz a tabela oficial. Toda função aceita trocar qualquer uma delas.

    >>> from bi import consulta
    >>> consulta.classificacao(2026, 'A')
    >>> consulta.campanha('bahia', 2026)
    >>> consulta.projecao('bahia', 2026)

`contexto()` devolve em palavras o que foi usado — sempre declarar isso junto
do número publicado.
"""
from __future__ import annotations

import unicodedata
from functools import lru_cache

import numpy as np
import pandas as pd

from . import config as cfg

PADRAO = {"ordem": "rodada", "criterio": "CT", "local": "todos"}

ROTULO_CRITERIO = {
    "CT": "com os pontos tirados no tapetão",
    "ST": "sem os pontos tirados no tapetão",
}
ROTULO_ORDEM = {
    "rodada": "pela rodada oficial",
    "data": "pela ordem cronológica dos jogos",
}
ROTULO_LOCAL = {
    "todos": "todos os jogos",
    "casa": "só jogos em casa",
    "fora": "só jogos fora",
}

COLUNAS_TABELA = ["pos", "equipe", "pts", "j", "v", "e", "d",
                  "gp_ac", "gc_ac", "sg_ac", "tap_ac", "aproveitamento"]


class ConsultaInvalida(ValueError):
    """Pergunta que os dados não podem responder, dita em voz alta."""


# ------------------------------------------------------------------ leitura
@lru_cache(maxsize=None)
def _ler(nome: str) -> pd.DataFrame:
    caminho = cfg.DERIVADO / f"{nome}.parquet"
    if not caminho.exists():
        raise ConsultaInvalida(
            f"{caminho} não existe. Rode `python -m bi construir` antes de consultar."
        )
    return pd.read_parquet(caminho)


@lru_cache(maxsize=None)
def _canonico(nome: str) -> pd.DataFrame:
    return pd.read_parquet(cfg.CANONICO / f"{nome}.parquet")


def tabelas() -> dict[str, pd.DataFrame]:
    """As tabelas cruas, para pergunta que o catálogo não cobre.

    Use com cuidado: filtrar `ordem`, `criterio` e `local` é obrigatório, e
    esquecer um deles multiplica cada linha por 12 sem avisar.
    """
    return {
        "fato_clube_etapa": _ler("fato_clube_etapa"),
        "fato_posicao_etapa": _ler("fato_posicao_etapa"),
        "fato_pontuacao_etapa": _ler("fato_pontuacao_etapa"),
        "jogos": _canonico("jogos"),
        "clubes": _canonico("clubes"),
    }


# -------------------------------------------------------------- validação
def _variacao(**kwargs) -> dict[str, str]:
    v = {**PADRAO, **{k: x for k, x in kwargs.items() if x is not None}}
    for campo, validos in [("ordem", cfg.ORDENS), ("criterio", cfg.CRITERIOS),
                           ("local", cfg.LOCAIS)]:
        if v[campo] not in validos:
            raise ConsultaInvalida(
                f"{campo}={v[campo]!r} não existe. Válidos: {', '.join(validos)}."
            )
    return v


def _recorte(fato: pd.DataFrame, v: dict[str, str]) -> pd.DataFrame:
    return fato[(fato["ordem"] == v["ordem"])
                & (fato["criterio"] == v["criterio"])
                & (fato["local"] == v["local"])]


def _serie(serie: str) -> str:
    s = str(serie).strip().upper().replace("SÉRIE", "").strip()
    if s not in cfg.SERIES:
        raise ConsultaInvalida(f"série {serie!r} não existe. Válidas: A, B.")
    return s


def contexto(ano: int | None = None, serie: str | None = None,
             etapa: int | None = None, **kwargs) -> str:
    """O que foi usado, em palavras — para ir junto do número publicado."""
    v = _variacao(**kwargs)
    partes = []
    if ano and serie:
        partes.append(f"Série {_serie(serie)} de {ano}")
    if etapa:
        rotulo = "rodada" if v["ordem"] == "rodada" else "jogo"
        partes.append(f"{rotulo} {etapa}")
    partes.append(ROTULO_ORDEM[v["ordem"]])
    partes.append(ROTULO_CRITERIO[v["criterio"]])
    if v["local"] != "todos":
        partes.append(ROTULO_LOCAL[v["local"]])
    return " · ".join(partes)


# ------------------------------------------------------------------ clubes
def _sem_acento(texto: str) -> str:
    sem = unicodedata.normalize("NFKD", str(texto))
    return "".join(c for c in sem if not unicodedata.combining(c)).upper().strip()


@lru_cache(maxsize=1)
def _clubes_do_bi() -> frozenset:
    """Quem já apareceu nas derivadas — usado para desempatar nome ambíguo."""
    return frozenset(_ler("fato_clube_etapa")["equipe"].astype(str).unique())


def resolver_clube(texto: str, ano: int | None = None,
                   serie: str | None = None) -> str:
    """'bahia' -> 'BAHIA (BA)'. Aceita nome, sigla, com ou sem acento e UF.

    Quando `ano` e `serie` vêm, a busca se restringe a quem disputou aquela
    edição — é o que resolve 'botafogo' e 'atlético' sem perguntar.
    """
    clubes = _canonico("clubes")
    candidatos = clubes["equipe"].tolist()

    if ano is not None and serie is not None:
        fato = _ler("fato_clube_etapa")
        na_edicao = fato[(fato["ano"] == ano) & (fato["serie"] == _serie(serie))]
        if len(na_edicao):
            candidatos = sorted(na_edicao["equipe"].astype(str).unique())

    alvo = _sem_acento(texto)
    mapa = {e: _sem_acento(e) for e in candidatos}
    siglas = dict(zip(clubes["equipe"], clubes["sigla"].fillna("")))

    exatos = [e for e, n in mapa.items() if n == alvo]
    if len(exatos) == 1:
        return exatos[0]

    por_sigla = [e for e in candidatos if _sem_acento(siglas.get(e, "")) == alvo]
    if len(por_sigla) == 1:
        return por_sigla[0]

    # 'BAHIA' casa com 'BAHIA (BA)' pelo nome sem a UF
    def sem_uf(nome: str) -> str:
        return _sem_acento(nome).rsplit("(", 1)[0].strip()

    por_nome = [e for e, n in mapa.items() if sem_uf(e) == alvo]
    if len(por_nome) == 1:
        return por_nome[0]
    # 'vitoria' casa com (BA) e (ES); só o da Bahia jogou na era do BI.
    if len(por_nome) > 1:
        no_bi = [e for e in por_nome if e in _clubes_do_bi()]
        if len(no_bi) == 1:
            return no_bi[0]

    parciais = [e for e, n in mapa.items() if alvo and alvo in n]
    if len(parciais) == 1:
        return parciais[0]
    if len(parciais) > 1:
        no_bi = [e for e in parciais if e in _clubes_do_bi()]
        if len(no_bi) == 1:
            return no_bi[0]

    onde = f" na Série {serie} de {ano}" if ano and serie else ""
    if not parciais:
        raise ConsultaInvalida(f"nenhum clube{onde} casa com {texto!r}.")
    raise ConsultaInvalida(
        f"{texto!r} é ambíguo{onde}: {', '.join(sorted(parciais)[:8])}. "
        "Informe o nome com a UF."
    )


def clube(equipe: str) -> dict:
    """Ficha do clube: sigla, estado, região, cidade."""
    nome = resolver_clube(equipe)
    linha = _canonico("clubes").set_index("equipe").loc[nome]
    return {"equipe": nome, **{k: linha[k] for k in
            ["sigla", "estado", "regiao", "cidade"]}}


# ------------------------------------------------------------------ edições
def edicoes() -> pd.DataFrame:
    """Toda edição do recorte do BI, com a última etapa disponível."""
    fato = _recorte(_ler("fato_clube_etapa"), _variacao())
    r = (fato.groupby(["ano", "serie"], observed=True)["etapa"].max()
         .reset_index().rename(columns={"etapa": "etapa_max"}))
    fechadas = edicoes_fechadas()
    r["fechada"] = [(a, s) in fechadas for a, s in zip(r["ano"], r["serie"])]
    return r.sort_values(["ano", "serie"]).reset_index(drop=True)


@lru_cache(maxsize=1)
def edicoes_fechadas() -> frozenset:
    """Edição sem jogo pendente. Só elas entram em média e projeção."""
    jogos = _canonico("jogos")
    recorte = jogos[(jogos["ano"] >= cfg.ANO_INICIO_BI)
                    & (jogos["serie"].isin(cfg.SERIES))
                    & (jogos["fase"] == cfg.FASE_UNICA)]
    pendente = recorte["status"].isin([cfg.STATUS_AGENDADO, cfg.STATUS_ADIADO])
    por_edicao = recorte.assign(p=pendente).groupby(["ano", "serie"])["p"].sum()
    return frozenset(chave for chave, n in por_edicao.items() if n == 0)


def etapa_max(ano: int, serie: str, **kwargs) -> int:
    """Última etapa em que algum clube da edição jogou de fato."""
    v = _variacao(**kwargs)
    fato = _recorte(_ler("fato_clube_etapa"), v)
    recorte = fato[(fato["ano"] == ano) & (fato["serie"] == _serie(serie))]
    if not len(recorte):
        raise ConsultaInvalida(
            f"Série {_serie(serie)} de {ano} não está nas derivadas "
            f"(o BI começa em {cfg.ANO_INICIO_BI})."
        )
    return int(recorte["etapa"].max())


def _em_andamento(ano: int, serie: str) -> bool:
    return (ano, _serie(serie)) not in edicoes_fechadas()


def _mascara_fechadas(fato: pd.DataFrame) -> np.ndarray:
    """Máscara booleana das linhas que pertencem a edição fechada."""
    fechadas = edicoes_fechadas()
    pares = zip(fato["ano"].tolist(), fato["serie"].astype(str).tolist())
    return np.fromiter((par in fechadas for par in pares), dtype=bool,
                       count=len(fato))


# ------------------------------------------------------------ classificação
def classificacao(ano: int, serie: str, etapa: int | None = None,
                  **kwargs) -> pd.DataFrame:
    """A tabela de uma edição numa etapa. 20 linhas, da 1ª à 20ª posição.

    `etapa=None` usa a última disponível. Em edição em andamento, é a tabela
    de agora.
    """
    v = _variacao(**kwargs)
    serie = _serie(serie)
    etapa = etapa_max(ano, serie, **v) if etapa is None else int(etapa)
    fato = _recorte(_ler("fato_clube_etapa"), v)
    t = fato[(fato["ano"] == ano) & (fato["serie"] == serie)
             & (fato["etapa"] == etapa)]
    if not len(t):
        raise ConsultaInvalida(
            f"não há etapa {etapa} na Série {serie} de {ano} "
            f"(a última é {etapa_max(ano, serie, **v)})."
        )
    t = t.sort_values("pos").reset_index(drop=True)
    t = t.reindex(columns=COLUNAS_TABELA)
    t["equipe"] = t["equipe"].astype(str)
    return t


def campanha(equipe: str, ano: int, serie: str | None = None,
             **kwargs) -> pd.DataFrame:
    """A campanha de um clube passo a passo: o jogo e a situação após ele."""
    v = _variacao(**kwargs)
    fato = _recorte(_ler("fato_clube_etapa"), v)
    recorte = fato[fato["ano"] == ano]
    if serie is not None:
        recorte = recorte[recorte["serie"] == _serie(serie)]
    nome = resolver_clube(equipe, ano, serie) if serie else resolver_clube(equipe)

    c = recorte[recorte["equipe"] == nome]
    if not len(c):
        series_do_ano = sorted(recorte["serie"].astype(str).unique())
        raise ConsultaInvalida(
            f"{nome} não aparece em {ano}"
            + (f" (a edição tem: {', '.join(series_do_ano)})" if series_do_ano else "")
        )
    colunas = ["ano", "serie", "etapa", "adversario", "mando", "resultado",
               "gp", "gc", "pts_rodada", "status",
               "pts", "j", "v", "e", "d", "gp_ac", "gc_ac", "sg_ac", "tap_ac",
               "aproveitamento", "pos"]
    c = c.sort_values("etapa").reindex(columns=colunas).reset_index(drop=True)
    for coluna in ["serie", "adversario", "mando", "resultado", "status"]:
        c[coluna] = c[coluna].astype(str).replace("nan", pd.NA)
    return c


def evolucao(ano: int, serie: str, coluna: str = "pos",
             equipes: list[str] | None = None, **kwargs) -> pd.DataFrame:
    """Uma coluna ao longo das etapas, etapas nas linhas e clubes nas colunas.

    `coluna='pos'` dá a evolução da posição; `'pts'`, a da pontuação.
    """
    v = _variacao(**kwargs)
    serie = _serie(serie)
    fato = _recorte(_ler("fato_clube_etapa"), v)
    t = fato[(fato["ano"] == ano) & (fato["serie"] == serie)]
    if coluna not in t.columns:
        raise ConsultaInvalida(f"coluna {coluna!r} não existe em fato_clube_etapa.")
    if equipes:
        nomes = [resolver_clube(e, ano, serie) for e in equipes]
        t = t[t["equipe"].isin(nomes)]
    p = t.pivot_table(index="etapa", columns="equipe", values=coluna,
                      observed=True)
    p.columns = [str(c) for c in p.columns]
    return p


def mando(ano: int, serie: str, etapa: int | None = None,
          **kwargs) -> pd.DataFrame:
    """Pontos em casa e fora lado a lado, com a classificação geral."""
    v = _variacao(**kwargs)
    geral = classificacao(ano, serie, etapa, **{**v, "local": "todos"})
    saida = geral[["pos", "equipe", "pts", "j"]].copy()
    for onde in ("casa", "fora"):
        parcial = classificacao(ano, serie, etapa, **{**v, "local": onde})
        parcial = parcial.set_index("equipe")
        saida[f"pts_{onde}"] = saida["equipe"].map(parcial["pts"])
        saida[f"j_{onde}"] = saida["equipe"].map(parcial["j"])
        saida[f"ap_{onde}"] = saida["equipe"].map(parcial["aproveitamento"])
    saida["dependencia_mando"] = (
        saida["pts_casa"] / saida["pts"].where(saida["pts"] > 0)
    )
    return saida


# ------------------------------------------------------- histórico e médias
def tabela_por_posicao(serie: str, etapa: int | None = None,
                       posicao: int | None = None, **kwargs) -> pd.DataFrame:
    """Quantos pontos cada posição costuma ter numa etapa, nas edições fechadas.

    É a base das páginas de média por posição e rodada. `etapa=None` devolve
    todas as etapas; `posicao=None`, todas as posições.
    """
    v = _variacao(**kwargs)
    serie = _serie(serie)
    fato = _recorte(_ler("fato_posicao_etapa"), v)
    fato = fato[fato["serie"] == serie]
    t = fato[_mascara_fechadas(fato)]
    if etapa is not None:
        t = t[t["etapa"] == int(etapa)]
    if posicao is not None:
        t = t[t["pos"] == int(posicao)]
    if not len(t):
        raise ConsultaInvalida("nenhuma edição fechada atende a esse recorte.")
    r = t.groupby(["etapa", "pos"], observed=True).agg(
        pts_media=("pts_da_posicao", "mean"),
        pts_mediana=("pts_da_posicao", "median"),
        pts_min=("pts_da_posicao", "min"),
        pts_max=("pts_da_posicao", "max"),
        n_edicoes=("ano", "nunique"),
    ).reset_index()
    r["pts_media"] = r["pts_media"].round(2)
    return r


def pontuacao_tipica(serie: str, etapa: int, pts: int,
                     **kwargs) -> pd.Series:
    """Com essa pontuação nessa etapa: que posição costuma valer, e onde termina.

    Sai de `fato_pontuacao_etapa`, que agrega só edições fechadas.
    """
    v = _variacao(**kwargs)
    fato = _recorte(_ler("fato_pontuacao_etapa"), v)
    linha = fato[(fato["serie"] == _serie(serie))
                 & (fato["etapa"] == int(etapa))
                 & (fato["pts"] == int(pts))]
    if not len(linha):
        raise ConsultaInvalida(
            f"nenhuma campanha fechada tinha {pts} pontos na etapa {etapa} "
            f"da Série {_serie(serie)}."
        )
    return linha.iloc[0]


def projecao(equipe: str, ano: int, serie: str | None = None,
             **kwargs) -> dict:
    """Onde costumam terminar as campanhas que estavam assim nesta etapa.

    Lê a situação atual do clube e cruza com o histórico das edições fechadas.
    Não é modelo preditivo: é frequência observada, e deve ser dita assim.
    """
    v = _variacao(**kwargs)
    c = campanha(equipe, ano, serie, **v)
    atual = c.iloc[-1]
    serie_ = str(atual["serie"])
    tipica = pontuacao_tipica(serie_, int(atual["etapa"]), int(atual["pts"]), **v)
    return {
        "equipe": resolver_clube(equipe, ano, serie_),
        "ano": ano, "serie": serie_,
        "etapa": int(atual["etapa"]),
        "pts": int(atual["pts"]),
        "pos_agora": int(atual["pos"]),
        "pos_media_historica": float(tipica["pos_media"]),
        "pos_fim_media": float(tipica["pos_fim_media"]),
        "pos_fim_mediana": float(tipica["pos_fim_mediana"]),
        "pos_fim_melhor": int(tipica["pos_fim_min"]),
        "pos_fim_pior": int(tipica["pos_fim_max"]),
        "n_campanhas": int(tipica["n_ocorrencias"]),
        "n_edicoes": int(tipica["n_edicoes"]),
        "contexto": contexto(ano, serie_, int(atual["etapa"]), **v),
    }


def campanhas_semelhantes(equipe: str, ano: int, serie: str | None = None,
                          tolerancia: int = 0, **kwargs) -> pd.DataFrame:
    """As campanhas fechadas que tinham a mesma pontuação nesta etapa.

    Uma linha por campanha, com onde ela terminou. `tolerancia` abre a janela
    de pontos para os dois lados.
    """
    v = _variacao(**kwargs)
    atual = campanha(equipe, ano, serie, **v).iloc[-1]
    serie_ = str(atual["serie"])
    etapa, pts = int(atual["etapa"]), int(atual["pts"])

    fato = _recorte(_ler("fato_clube_etapa"), v)
    fato = fato[(fato["serie"] == serie_) & (fato["etapa"] == etapa)
                & (fato["pts"] >= pts - tolerancia)
                & (fato["pts"] <= pts + tolerancia)]
    t = fato[_mascara_fechadas(fato)]
    r = t[["ano", "equipe", "pts", "pos", "pos_fim"]].copy()
    r["equipe"] = r["equipe"].astype(str)
    return r.sort_values(["pos_fim", "ano"]).reset_index(drop=True)


def ranking_etapa(serie: str, etapa: int, n: int = 10, piores: bool = False,
                  coluna: str = "pts", incluir_em_andamento: bool = True,
                  **kwargs) -> pd.DataFrame:
    """As melhores (ou piores) marcas numa etapa, através das edições.

    Responde "qual a melhor campanha de todos os tempos até a rodada 26".
    A edição em andamento entra por padrão — é o que permite dizer "é a melhor
    desde 2006".
    """
    v = _variacao(**kwargs)
    serie = _serie(serie)
    fato = _recorte(_ler("fato_clube_etapa"), v)
    t = fato[(fato["serie"] == serie) & (fato["etapa"] == int(etapa))]
    if not incluir_em_andamento:
        t = t[_mascara_fechadas(t)]
    if coluna not in t.columns:
        raise ConsultaInvalida(f"coluna {coluna!r} não existe em fato_clube_etapa.")
    r = t[["ano", "equipe", coluna, "pos", "pos_fim", "j", "v", "e", "d",
           "sg_ac"]].copy()
    r["equipe"] = r["equipe"].astype(str)
    r = r.sort_values(coluna, ascending=piores).head(int(n))
    return r.reset_index(drop=True)


# ------------------------------------------------------------------- jogos
def jogos_de(ano: int | None = None, serie: str | None = None,
             equipe: str | None = None, rodada: int | None = None,
             so_realizados: bool = False) -> pd.DataFrame:
    """Jogos da camada canônica. Cobre 1937–2026, fora do recorte do BI."""
    j = _canonico("jogos")
    if ano is not None:
        j = j[j["ano"] == int(ano)]
    if serie is not None:
        j = j[j["serie"] == _serie(serie)]
    if rodada is not None:
        j = j[j["rodada"] == int(rodada)]
    if equipe is not None:
        nome = resolver_clube(equipe, ano, serie) if (ano and serie) \
            else resolver_clube(equipe)
        j = j[(j["mandante"] == nome) | (j["visitante"] == nome)]
    if so_realizados:
        j = j[j["status"] == cfg.STATUS_REALIZADO]
    colunas = ["id_jogo", "ano", "serie", "fase", "rodada", "data", "mandante",
               "gols_m", "gols_v", "visitante", "status"]
    return j.reindex(columns=colunas).sort_values(["data", "id_jogo"]).reset_index(drop=True)


def confrontos(equipe_a: str, equipe_b: str, desde: int | None = None,
               serie: str | None = None) -> dict:
    """O retrospecto entre dois clubes, do ponto de vista do primeiro."""
    a, b = resolver_clube(equipe_a), resolver_clube(equipe_b)
    j = _canonico("jogos")
    j = j[j["status"] == cfg.STATUS_REALIZADO]
    if desde is not None:
        j = j[j["ano"] >= int(desde)]
    if serie is not None:
        j = j[j["serie"] == _serie(serie)]
    j = j[((j["mandante"] == a) & (j["visitante"] == b))
          | ((j["mandante"] == b) & (j["visitante"] == a))]
    if not len(j):
        raise ConsultaInvalida(f"nenhum jogo entre {a} e {b} nesse recorte.")

    em_casa = j["mandante"] == a
    pro = j["gols_m"].where(em_casa, j["gols_v"])
    contra = j["gols_v"].where(em_casa, j["gols_m"])
    saldo = pro - contra
    jogos = j.assign(gols_pro=pro, gols_contra=contra,
                     resultado=saldo.map(lambda s: "V" if s > 0 else ("E" if s == 0 else "D")))
    return {
        "equipe": a, "adversario": b,
        "jogos": int(len(j)),
        "v": int((saldo > 0).sum()), "e": int((saldo == 0).sum()),
        "d": int((saldo < 0).sum()),
        "gols_pro": int(pro.sum()), "gols_contra": int(contra.sum()),
        "aproveitamento": float(((saldo > 0).sum() * 3 + (saldo == 0).sum())
                                / (3 * len(j))),
        "primeiro": str(j["data"].min().date()), "ultimo": str(j["data"].max().date()),
        "lista": jogos.reindex(columns=["ano", "serie", "rodada", "data",
                                        "mandante", "gols_m", "gols_v",
                                        "visitante", "resultado"])
                      .sort_values("data").reset_index(drop=True),
    }


# -------------------------------------------------------------- ressalvas
def observacoes(ano: int, serie: str, etapa: int | None = None,
                **kwargs) -> list[str]:
    """As ressalvas que precisam acompanhar um número desta etapa.

    Existe porque as três que aparecem aqui são exatamente as que geram
    correção pública: tabela com clubes em número diferente de jogos, jogo dado
    por encerrado sem ser disputado, e pontos tirados no tapetão.
    """
    v = _variacao(**kwargs)
    serie = _serie(serie)
    etapa = etapa_max(ano, serie, **v) if etapa is None else int(etapa)
    tabela = classificacao(ano, serie, etapa, **v)
    avisos = []

    andamento = _em_andamento(ano, serie)
    jogos_distintos = sorted(set(int(x) for x in tabela["j"].dropna()))
    if len(jogos_distintos) > 1:
        de, ate = jogos_distintos[0], jogos_distintos[-1]
        avisos.append(
            f"a rodada {etapa} está incompleta: os clubes têm de {de} a {ate} jogos"
            if andamento else
            f"nem todos os clubes têm {ate} jogos na rodada {etapa} "
            f"(vão de {de} a {ate})"
        )
    if andamento:
        avisos.append("edição em andamento — não há posição final")
    if v["criterio"] == "CT" and int(tabela["tap_ac"].fillna(0).abs().sum()):
        punidos = tabela[tabela["tap_ac"].fillna(0) != 0]
        quem = ", ".join(f"{e} ({int(t)})" for e, t in
                         zip(punidos["equipe"], punidos["tap_ac"]))
        avisos.append(f"inclui pontos tirados no tapetão: {quem}")

    jogos = _canonico("jogos")
    nao_realizados = jogos[(jogos["ano"] == ano) & (jogos["serie"] == serie)
                           & (jogos["status"] == cfg.STATUS_NAO_REALIZADO)
                           & (jogos["rodada"] <= etapa)]
    for _, g in nao_realizados.iterrows():
        avisos.append(
            f"{g['mandante']} x {g['visitante']} (rodada {int(g['rodada'])}) não foi "
            "disputado; nenhum dos dois recebeu pontos, e a rodada conta como "
            "jogada para efeito de posição"
        )
    return avisos


# ----------------------------------------------------------------- frescor
def frescor() -> dict:
    """Até onde os dados vão. Checar antes de responder sobre a edição corrente."""
    j = _canonico("jogos")
    realizados = j[j["status"] == cfg.STATUS_REALIZADO]
    ultimo = realizados["data"].max()
    corrente = int(j["ano"].max())
    resumo = {}
    for serie in cfg.SERIES:
        try:
            resumo[serie] = {
                "etapa_max": etapa_max(corrente, serie),
                "em_andamento": _em_andamento(corrente, serie),
            }
        except ConsultaInvalida:
            continue
    return {"ano_corrente": corrente,
            "ultimo_jogo_realizado": str(ultimo.date()),
            "series": resumo}
