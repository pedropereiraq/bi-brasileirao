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

import datetime
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


ESCUDOS = cfg.RAIZ / "site" / "public" / "escudos"


def baixar_escudos(clubes: pd.DataFrame) -> dict[str, str]:
    """
    Traz os escudos para dentro do site e devolve o caminho local de cada um.

    Dois motivos, e o segundo é o que obriga. O primeiro é não depender do CDN
    da globo a cada visita. O segundo é o card: imagem de outra origem
    **contamina o canvas**, e canvas contaminado não exporta PNG — o botão de
    gerar card simplesmente não funcionaria.

    Baixa só o que falta, e falha macio: sem rede, o site cai no escudo remoto.
    Os arquivos ficam versionados, então em uso normal nada é baixado.
    """
    from curl_cffi import requests

    ESCUDOS.mkdir(parents=True, exist_ok=True)
    locais: dict[str, str] = {}
    baixados = 0

    for linha in clubes.itertuples():
        if not isinstance(linha.escudo, str) or not linha.escudo:
            continue
        extensao = ".svg" if linha.escudo.lower().endswith(".svg") else ".png"
        # O nome do arquivo sai do nome canônico, não da sigla: sigla repete.
        apelido = linha.equipe.replace(" ", "_").replace("(", "").replace(")", "")
        destino = ESCUDOS / f"{apelido}{extensao}"

        if not destino.exists():
            try:
                resposta = requests.get(linha.escudo, timeout=30, impersonate="chrome")
                if resposta.ok and resposta.content:
                    destino.write_bytes(resposta.content)
                    baixados += 1
            except Exception as e:  # noqa: BLE001 — sem rede, segue com o remoto
                print(f"  escudo de {linha.equipe} não baixou ({type(e).__name__})")

        if destino.exists():
            locais[linha.equipe] = f"/escudos/{destino.name}"

    if baixados:
        print(f"  {baixados} escudos baixados")
    return locais


def publicar_clubes(jogos: pd.DataFrame, clubes: pd.DataFrame) -> dict:
    """Só os clubes que aparecem em alguma edição do recorte."""
    presentes = set(jogos["mandante"]) | set(jogos["visitante"])
    sub = clubes[clubes["equipe"].isin(presentes)]
    locais = baixar_escudos(sub)
    return {
        linha.equipe: {
            "sigla": linha.sigla,
            # Local quando existe; o remoto fica como reserva declarada.
            "escudo": locais.get(linha.equipe)
                      or (linha.escudo if isinstance(linha.escudo, str) else None),
            "estado": linha.estado,
            "regiao": linha.regiao,
            "cidade": linha.cidade,
        }
        for linha in sub.itertuples()
    }


def publicar_edicao(jogos: pd.DataFrame) -> list[list]:
    """
    Uma edição como lista de listas, na ordem de CAMPOS_JOGO.

    Jogo não realizado com data no passado não é um jogo de ontem que ninguém
    registrou: é jogo **sem data marcada**. A federação mantém a data original
    no calendário até remarcar, e publicá-la faria o site ordenar o jogo entre
    os de julho e anunciá-lo como "a jogar" numa data que já passou.

    Ele vai para o último dia do ano da edição, que é a convenção de "ainda sem
    data": fica no fim de qualquer ordenação por data e não se confunde com
    jogo de verdade. O status continua o que era — "adiado" é o registro
    correto, e é a data que estava mentindo.
    """
    normalizados = jogos.copy()
    hoje = pd.Timestamp(datetime.date.today())
    sem_data = (normalizados["status"] != cfg.STATUS_REALIZADO) & (
        normalizados["data"] < hoje
    )
    if sem_data.any():
        normalizados.loc[sem_data, "data"] = [
            pd.Timestamp(int(ano), 12, 31)
            for ano in normalizados.loc[sem_data, "ano"]
        ]

    ordenados = normalizados.sort_values(["rodada", "data", "mandante"])
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


# ---------------------------------------------- referências por posição
def referencias_por_posicao(jogos: pd.DataFrame) -> dict:
    """
    Quantos pontos costuma fazer quem termina em cada posição.

    É o que permite comparar uma campanha em curso com um objetivo — o ritmo de
    quem termina em 4º, o ritmo de quem escapa em 16º — em vez de com outro
    clube. A média divide por 38 e vira uma reta: não é a campanha de ninguém,
    é o ritmo que aquela posição costuma exigir.

    Entram só as edições **encerradas**. Uma em andamento não tem posição final
    e entraria na conta como se tivesse, puxando toda a régua para baixo.
    "Encerrada" aqui é o critério do histórico de pontuação: sem jogo pendente.
    O 2016 de Chapecoense x Atlético-MG conta como encerrado — o jogo não foi
    disputado, mas o campeonato terminou.

    Vai para o site pronto, e não como jogos: são 20 edições por série, e o
    navegador teria de baixar meio megabyte para calcular vinte números.
    """
    from . import derivadas, motor

    recorte = _recorte_bi(jogos)
    completas = derivadas.edicoes_completas(jogos)
    chaves = list(zip(recorte["ano"].tolist(), recorte["serie"].tolist()))
    fechadas = recorte[[c in completas for c in chaves]]
    if fechadas.empty:
        return {}

    # Sem tapetão e na ordem da rodada: é a mesma conta que o motor do
    # navegador faz, então a régua e a linha do clube falam a mesma língua.
    final = motor.campanha(fechadas, ordem="rodada", criterio="ST", local="todos")
    ultima = final.groupby(["ano", "serie"])["etapa"].transform("max")
    tabela = final[final["etapa"] == ultima]

    saida = {}
    for serie, grupo in tabela.groupby("serie", observed=True):
        medias = grupo.groupby("pos")["pts"].mean().round(2)
        saida[str(serie)] = {
            "edicoes": int(grupo["ano"].nunique()),
            "ano_primeiro": int(grupo["ano"].min()),
            "ano_ultimo": int(grupo["ano"].max()),
            "rodadas": int(grupo["etapa"].max()),
            "media": {str(int(pos)): float(v) for pos, v in medias.items()},
        }
    return saida


# ------------------------------------------------- campanhas semelhantes
def campanhas_por_jogo(jogos: pd.DataFrame) -> dict:
    """
    A pontuação acumulada de cada campanha, jogo a jogo.

    Serve à pergunta "quem já esteve nesta situação e o que aconteceu com
    eles": 46 pontos em 27 jogos é um ponto que dezenas de campanhas já
    ocuparam, e o desfecho delas é a única resposta honesta sobre o que essa
    pontuação costuma valer.

    Vai pronto para o site pelo mesmo motivo da régua por posição: responder
    isso no navegador exigiria baixar as 21 edições da série inteira, meio
    megabyte, para depois jogar fora 95% do que veio.

    O índice é o **jogo**, não a rodada. Comparar campanhas de anos diferentes
    só faz sentido pelo n-ésimo jogo disputado: rodada não é tempo, e um jogo
    adiado deslocaria a comparação inteira.

    `pos_fim` é `None` na edição em andamento. Ela entra no arquivo porque é
    dela que sai o ponto de partida — a situação de hoje de um clube —, mas não
    pode entrar na resposta: uma campanha sem desfecho não conta o que
    aconteceu com ela.
    """
    from . import derivadas, motor

    recorte = _recorte_bi(jogos)
    completas = derivadas.edicoes_completas(jogos)
    tabela = motor.campanha(recorte, ordem="data", criterio="ST", local="todos")

    # A grade é preenchida para a frente, então um clube com menos jogos que a
    # edição repete o último acumulado nas etapas que faltam. `j == etapa`
    # devolve só os jogos que existiram de fato.
    reais = tabela[tabela["j"] == tabela["etapa"]].sort_values(
        ["serie", "ano", "equipe", "etapa"]
    )

    series: dict[str, dict[str, list]] = {}
    for (serie, ano, equipe), grupo in reais.groupby(
        ["serie", "ano", "equipe"], sort=True, observed=True
    ):
        encerrada = (ano, serie) in completas
        series.setdefault(str(serie), {}).setdefault(str(int(ano)), []).append([
            equipe,
            int(grupo["pos_fim"].iloc[-1]) if encerrada else None,
            [int(v) for v in grupo["pts"]],
        ])

    return {"campos": ["equipe", "pos_fim", "pontos"], "series": series}


def _fluxo_da_edicao(jogos: pd.DataFrame, ultima: int) -> list[list[int]]:
    """
    Quanto dos pontos em disputa não chegou à tabela, rodada a rodada.

    Toda rodada põe em disputa três pontos por jogo, e a tabela quase nunca
    recebe os três. Duas coisas os seguram, e são de naturezas diferentes: o
    **empate** distribui dois e queima o terceiro para sempre, e o **jogo por
    disputar** retém os três até acontecer. Por isso vão em números separados —
    uma coluna só diria que são a mesma coisa.

    É o que impede de ler uma rodada inteira abaixo da média como campeonato
    fraco: pode ser só ponto que não foi distribuído.

    Acumulado, como a própria tabela: a rodada 10 traz o que o campeonato
    inteiro deixou pelo caminho até ali.
    """
    feito = jogos["status"] == cfg.STATUS_REALIZADO
    empate = feito & (jogos["gols_m"] == jogos["gols_v"])

    saida = []
    queimados = retidos = 0
    for etapa in range(1, ultima + 1):
        da_rodada = jogos["rodada"] == etapa
        queimados += int((empate & da_rodada).sum())
        retidos += int((~feito & da_rodada).sum()) * 3
        saida.append([queimados, retidos])
    return saida


# ------------------------------------------- pontuação por posição e rodada
def posicoes_por_rodada(jogos: pd.DataFrame) -> dict:
    """
    A tabela de cada rodada de cada edição: quem estava em cada posição e com
    quantos pontos.

    O índice aqui é a **rodada**, e não o n-ésimo jogo como em
    `campanhas_por_jogo`. São perguntas diferentes: "como está o campeonato na
    rodada 10" é sobre o campeonato, que anda por rodada, enquanto "o clube
    depois de 10 jogos" é sobre a campanha dele. Um clube com jogo adiado
    aparece na rodada 10 com nove jogos, e é assim que a tabela do dia mostra.

    Vai a ordem inteira, e não só a pontuação, porque a posição entre clubes
    empatados sai do critério de desempate do motor — pontos, triunfos, saldo,
    gols pró e ordem alfabética. Recalcular isso no navegador com vinte edições
    seria refazer o motor pela terceira vez.

    `fim` é `None` na edição em andamento: ela não tem posição nem pontuação
    final. A grade dela entra igual, porque é justamente a edição que se quer
    comparar com a média das outras.

    Junto vai o `fluxo`: o que cada rodada deixou de entregar à tabela. Sai
    daqui, e não do navegador, porque a página cruza vinte edições e só tem em
    mãos a grade de pontos — de onde não se enxerga se o ponto que falta foi
    queimado num empate ou está retido num jogo adiado.
    """
    from . import derivadas, motor

    recorte = _recorte_bi(jogos)
    completas = derivadas.edicoes_completas(jogos)
    tabela = motor.campanha(recorte, ordem="rodada", criterio="ST", local="todos")

    series: dict[str, dict[str, dict]] = {}
    for (serie, ano), grupo in tabela.groupby(["serie", "ano"], sort=True,
                                              observed=True):
        clubes = sorted(grupo["equipe"].unique())
        indice = {nome: i for i, nome in enumerate(clubes)}
        ultima = int(grupo["etapa"].max())
        encerrada = (ano, serie) in completas

        fim = [None] * len(clubes)
        if encerrada:
            final = grupo[grupo["etapa"] == ultima]
            for linha in final.itertuples():
                fim[indice[linha.equipe]] = [int(linha.pos), int(linha.pts)]

        da_edicao = recorte[(recorte["serie"] == serie) & (recorte["ano"] == ano)]

        grade = []
        for etapa in range(1, ultima + 1):
            da_rodada = grupo[grupo["etapa"] == etapa].sort_values("pos")
            grade.append([[indice[l.equipe], int(l.pts)]
                          for l in da_rodada.itertuples()])

        series.setdefault(str(serie), {})[str(int(ano))] = {
            "clubes": clubes,
            "fim": fim,
            "rodadas": ultima,
            "encerrada": encerrada,
            "grade": grade,
            "fluxo": _fluxo_da_edicao(da_edicao, ultima),
        }

    return {
        "campos": ["indice_do_clube", "pontos"],
        "campos_fluxo": ["queimados_no_empate", "retidos_em_jogo_por_disputar"],
        "series": series,
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
    # Uma vez só: `publicar_clubes` baixa escudos, e chamar duas vezes dobraria
    # o trabalho por causa de um número no print.
    dados_clubes = publicar_clubes(recorte, clubes)
    _gravar(DESTINO / "clubes.json", dados_clubes)
    _gravar(DESTINO / "referencias.json", referencias_por_posicao(jogos))
    _gravar(DESTINO / "campanhas.json", campanhas_por_jogo(jogos))
    _gravar(DESTINO / "posicoes.json", posicoes_por_rodada(jogos))

    tamanho = sum(p.stat().st_size for p in DESTINO.rglob("*.json"))
    print(f"  {len(edicoes)} edições, {len(dados_clubes)} clubes"
          f" -> {tamanho/1024:.0f} KB em {DESTINO.relative_to(cfg.RAIZ)}")
    return {"edicoes": len(edicoes), "bytes": tamanho}


def _gravar(caminho: Path, conteudo) -> None:
    caminho.write_text(
        json.dumps(conteudo, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
