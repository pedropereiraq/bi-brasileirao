"""
Camada canônica: `clubes` e `jogos`.

Junta o Excel histórico (edições fechadas) com o que o coletor trouxe da edição
corrente. Quando as duas fontes cobrem o mesmo ano/série, a coleta vence — é a
que está viva. Nada aqui é digitado à mão.
"""
from __future__ import annotations

import pandas as pd

from . import config as cfg
from . import historico

COLUNAS_JOGOS = [
    "id_jogo", "ano", "serie", "fase", "rodada", "data",
    "mandante", "visitante", "gols_m", "gols_v",
    "tapetao_m", "tapetao_v", "status", "sofascore_id", "origem",
]


def ler_corrente() -> pd.DataFrame:
    """Todos os CSVs produzidos pelo coletor, no layout canônico."""
    pasta = cfg.DADOS / "corrente"
    arquivos = sorted(pasta.glob("jogos_*.csv")) if pasta.exists() else []
    if not arquivos:
        return pd.DataFrame(columns=COLUNAS_JOGOS)

    partes = []
    for arquivo in arquivos:
        bruto = pd.read_csv(arquivo, encoding="utf-8-sig")
        bruto["ano"] = bruto["ano"].astype("Int64")
        bruto["rodada"] = bruto["rodada"].astype("Int64")
        bruto["data"] = pd.to_datetime(bruto["data"], errors="coerce")
        for coluna in ("gols_m", "gols_v", "sofascore_id"):
            bruto[coluna] = pd.to_numeric(bruto[coluna], errors="coerce").astype("Int64")
        for coluna in ("serie", "fase", "mandante", "visitante", "status"):
            bruto[coluna] = bruto[coluna].astype("string")
        bruto["mandante"] = historico._normalizar_nome(bruto["mandante"])
        bruto["visitante"] = historico._normalizar_nome(bruto["visitante"])
        bruto["origem"] = "sofascore"
        partes.append(bruto)
    return pd.concat(partes, ignore_index=True)


def carregar_tapetao() -> pd.DataFrame:
    """Os pontos tirados no tapetão, da aba própria da planilha."""
    return historico.ler_tapetao()


def aplicar_tapetao(jogos: pd.DataFrame, tapetao: pd.DataFrame) -> pd.DataFrame:
    """
    Pendura cada punição num jogo do clube na rodada em que ela vale.

    O motor acumula por jogo, e é por isso que a punição precisa de um jogo
    para viajar — mas ela não é do jogo: não entra em placar, em vitória nem em
    saldo, só na coluna de tapetão. Escolher o jogo daquela rodada é o que faz
    a punição aparecer na etapa certa tanto na ordem de rodada quanto na
    cronológica.

    A aba manda: o que estiver nas colunas da aba `Jogos` é sobrescrito, para
    as duas fontes nunca divergirem em silêncio.
    """
    jogos = jogos.copy()
    jogos["tapetao_m"] = 0
    jogos["tapetao_v"] = 0
    if tapetao is None or tapetao.empty:
        return jogos

    for punicao in tapetao.itertuples():
        mesma = ((jogos["ano"] == punicao.ano) & (jogos["serie"] == punicao.serie)
                 & (jogos["fase"] == punicao.fase))
        como_mandante = mesma & (jogos["mandante"] == punicao.equipe)
        como_visitante = mesma & (jogos["visitante"] == punicao.equipe)

        # O jogo da rodada marcada; se o clube não jogou nela, o primeiro que
        # vier depois — a punição não pode ficar sem casa.
        da_rodada = (como_mandante | como_visitante) & (jogos["rodada"] == punicao.rodada)
        candidatos = jogos[da_rodada]
        if candidatos.empty:
            depois = (como_mandante | como_visitante) & (jogos["rodada"] >= punicao.rodada)
            candidatos = jogos[depois].sort_values("rodada")
        if candidatos.empty:
            continue

        indice = candidatos.index[0]
        coluna = "tapetao_m" if bool(como_mandante.loc[indice]) else "tapetao_v"
        jogos.loc[indice, coluna] = jogos.loc[indice, coluna] + punicao.pontos

    return jogos


def montar_jogos() -> pd.DataFrame:
    """Excel + coleta corrente, com a coleta prevalecendo sobre o ano repetido."""
    do_excel = historico.ler_jogos()
    da_api = ler_corrente()

    if not da_api.empty:
        vivos = set(zip(da_api["ano"].tolist(), da_api["serie"].tolist()))
        chaves_excel = list(zip(do_excel["ano"].tolist(), do_excel["serie"].tolist()))
        do_excel = do_excel[[c not in vivos for c in chaves_excel]]

    jogos = pd.concat([do_excel, da_api], ignore_index=True)
    jogos = jogos.reindex(columns=COLUNAS_JOGOS)
    # A aba `Tapetão` é a fonte: vale para o histórico e para a edição em
    # andamento, que o coletor não tem como saber.
    jogos = aplicar_tapetao(jogos, carregar_tapetao())
    jogos = jogos.sort_values(
        ["ano", "serie", "rodada", "data", "id_jogo"], na_position="last"
    ).reset_index(drop=True)
    _conferir(jogos)
    return jogos


def _conferir(jogos: pd.DataFrame) -> None:
    """Invariantes que, se quebrarem, envenenam tudo o que vem depois."""
    duplicados = jogos["id_jogo"].duplicated().sum()
    if duplicados:
        raise ValueError(f"{duplicados} id_jogo duplicados na camada canônica")

    espelho = jogos["mandante"] == jogos["visitante"]
    if espelho.any():
        raise ValueError(f"{espelho.sum()} jogos com o mesmo clube dos dois lados")

    estados = set(jogos["status"].dropna().unique())
    validos = {
        cfg.STATUS_REALIZADO, cfg.STATUS_AGENDADO, cfg.STATUS_ADIADO,
        cfg.STATUS_CANCELADO, cfg.STATUS_NAO_REALIZADO,
    }
    if not estados <= validos:
        raise ValueError(f"status desconhecido: {sorted(estados - validos)}")


def montar_clubes(jogos: pd.DataFrame) -> pd.DataFrame:
    """Cadastro filtrado aos clubes que de fato aparecem em algum jogo."""
    clubes = historico.ler_clubes()
    presentes = set(jogos["mandante"].dropna()) | set(jogos["visitante"].dropna())

    faltando = sorted(presentes - set(clubes["equipe"]))
    if faltando:
        raise ValueError(
            f"{len(faltando)} clubes citados em jogos e ausentes do cadastro: "
            + ", ".join(faltando[:10])
        )
    return clubes[clubes["equipe"].isin(presentes)].reset_index(drop=True)


def construir() -> tuple[pd.DataFrame, pd.DataFrame]:
    cfg.garantir_pastas()
    jogos = montar_jogos()
    clubes = montar_clubes(jogos)
    jogos.to_parquet(cfg.CANONICO / "jogos.parquet", index=False)
    clubes.to_parquet(cfg.CANONICO / "clubes.parquet", index=False)
    return jogos, clubes


def carregar_jogos() -> pd.DataFrame:
    return pd.read_parquet(cfg.CANONICO / "jogos.parquet")


def carregar_clubes() -> pd.DataFrame:
    return pd.read_parquet(cfg.CANONICO / "clubes.parquet")
