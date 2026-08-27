"""
Coletor da edição corrente a partir da API pública do Sofascore.

Ordem das operações, invariável: **grava o snapshot bruto antes de normalizar**.
Se a API mudar de formato e a normalização quebrar, o JSON coletado continua no
repositório e o recálculo pode ser refeito depois sem nova coleta.

Endpoints (sem chave, sem autenticação):
    /unique-tournament/{torneio}/seasons
    /unique-tournament/{torneio}/season/{temporada}/events/round/{rodada}
"""
from __future__ import annotations

import argparse
import csv
import gzip
import io
import json
import time
from datetime import datetime
from pathlib import Path

from curl_cffi import requests as requisicoes

from . import config as cfg


class ErroColeta(RuntimeError):
    """Falha de rede ou de contrato da API. Nunca silenciada."""


def _sessao():
    sessao = requisicoes.Session(impersonate=cfg.IMPERSONACAO)
    sessao.headers.update({
        "Accept": "*/*",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Referer": "https://www.sofascore.com/",
    })
    return sessao


def _obter(sessao, caminho: str, tentativas: int = 3) -> dict:
    ultimo = None
    for n in range(tentativas):
        try:
            r = sessao.get(cfg.SOFASCORE_BASE + caminho, timeout=30)
        except Exception as e:  # falha de rede
            ultimo = f"{type(e).__name__}: {e}"
        else:
            if r.status_code == 404:
                raise FileNotFoundError(caminho)
            if r.ok:
                return r.json()
            ultimo = f"HTTP {r.status_code}"
            if r.status_code == 403:
                ultimo += (
                    " - a API recusou o cliente. Em runner de nuvem isso costuma"
                    " ser bloqueio por faixa de IP; ver docs/decisoes.md."
                )
        time.sleep(1.5 * (n + 1))
    raise ErroColeta(f"{caminho}: {ultimo}")


def descobrir_temporada(sessao, serie: str, ano: int) -> int:
    """Resolve o id da temporada pelo ano - evita hardcode quando virar o ano."""
    if (serie, ano) in cfg.TEMPORADAS:
        return cfg.TEMPORADAS[(serie, ano)]
    dados = _obter(sessao, f"/unique-tournament/{cfg.TORNEIOS[serie]}/seasons")
    for temporada in dados.get("seasons", []):
        if str(temporada.get("year")) == str(ano):
            return int(temporada["id"])
    raise ErroColeta(f"temporada {ano} não encontrada para a Série {serie}")


def coletar(serie: str, ano: int, rodadas: int = cfg.RODADAS) -> list[dict]:
    """Baixa os eventos das rodadas. Devolve a lista bruta, sem tocar nela."""
    sessao = _sessao()
    temporada = descobrir_temporada(sessao, serie, ano)
    torneio = cfg.TORNEIOS[serie]
    eventos: list[dict] = []
    faltando: list[int] = []
    for rodada in range(1, rodadas + 1):
        caminho = (
            f"/unique-tournament/{torneio}/season/{temporada}"
            f"/events/round/{rodada}"
        )
        try:
            dados = _obter(sessao, caminho)
        except FileNotFoundError:
            faltando.append(rodada)  # rodada ainda não sorteada
            continue
        eventos.extend(dados.get("events", []))
        time.sleep(cfg.PAUSA_ENTRE_REQUISICOES)
    if faltando:
        print(f"  rodadas sem tabela publicada: {faltando}")
    if not eventos:
        raise ErroColeta(f"Série {serie} {ano}: nenhum evento devolvido pela API")
    return eventos


def gravar_bruto(eventos: list[dict], serie: str, ano: int) -> Path:
    """
    Snapshot íntegro da coleta. Sempre antes de qualquer normalização — se a
    API mudar de formato e a normalização quebrar, o que foi coletado já está
    em disco.

    Gravado comprimido: a resposta crua tem 1,5 MB e comprime 24 vezes. Sem
    isso, duas coletas por dia somariam uns 300 MB por temporada no histórico
    do repositório.
    """
    cfg.garantir_pastas()
    carimbo = datetime.now(cfg.FUSO).strftime("%Y%m%d-%H%M%S")
    destino = cfg.BRUTO / f"{serie}_{ano}_{carimbo}.json.gz"
    with gzip.open(destino, "wt", encoding="utf-8", compresslevel=9) as f:
        json.dump(eventos, f, ensure_ascii=False)
    return destino


def ler_bruto(caminho: Path) -> list[dict]:
    """Relê um snapshot — é o caminho de recálculo sem nova coleta."""
    abrir = gzip.open if caminho.suffix == ".gz" else open
    with abrir(caminho, "rt", encoding="utf-8") as f:
        return json.load(f)


def carregar_de_para(caminho: Path | None = None) -> dict[int, str]:
    caminho = caminho or cfg.DE_PARA_CLUBES
    with caminho.open(encoding="utf-8-sig") as f:
        return {int(linha["sofascore_id"]): linha["equipe"]
                for linha in csv.DictReader(f)}


# Tradução dos status do Sofascore para o vocabulário do banco.
_STATUS = {
    "finished": cfg.STATUS_REALIZADO,
    "notstarted": cfg.STATUS_AGENDADO,
    "inprogress": cfg.STATUS_AGENDADO,
    "postponed": cfg.STATUS_ADIADO,
    "suspended": cfg.STATUS_ADIADO,
    "canceled": cfg.STATUS_CANCELADO,
    "cancelled": cfg.STATUS_CANCELADO,
}


def normalizar(eventos: list[dict], serie: str, ano: int,
               de_para: dict[int, str]) -> list[dict]:
    """Converte eventos brutos no layout canônico, resolvendo adiamentos."""
    desconhecidos = sorted({
        f"{time_['id']}={time_.get('name')}"
        for evento in eventos
        for time_ in (evento["homeTeam"], evento["awayTeam"])
        if time_["id"] not in de_para
    })
    if desconhecidos:
        raise ErroColeta(
            "clube fora do de-para: " + ", ".join(desconhecidos)
            + " - atualize fontes/de_para_clubes.csv"
        )

    linhas = []
    for evento in eventos:
        status = _STATUS.get((evento.get("status") or {}).get("type", ""),
                             cfg.STATUS_AGENDADO)
        gols_m = (evento.get("homeScore") or {}).get("current")
        gols_v = (evento.get("awayScore") or {}).get("current")
        # Só jogo finalizado tem placar válido; o resto fica nulo mesmo quando a
        # API devolve zero para partida que sequer começou.
        if status != cfg.STATUS_REALIZADO:
            gols_m = gols_v = None
        data = datetime.fromtimestamp(evento["startTimestamp"], cfg.FUSO).date()
        linhas.append({
            "ano": ano,
            "serie": serie,
            "fase": cfg.FASE_UNICA,
            "rodada": (evento.get("roundInfo") or {}).get("round"),
            "data": data.isoformat(),
            "mandante": de_para[evento["homeTeam"]["id"]],
            "visitante": de_para[evento["awayTeam"]["id"]],
            "gols_m": gols_m,
            "gols_v": gols_v,
            "tapetao_m": 0,
            "tapetao_v": 0,
            "status": status,
            "sofascore_id": evento["id"],
        })

    final = deduplicar(linhas)
    final.sort(key=lambda g: (g["rodada"] or 0, g["data"], g["mandante"]))
    for i, linha in enumerate(final, 1):
        linha["id_jogo"] = f"{serie}{ano}.{i}"
    return final


def deduplicar(linhas: list[dict]) -> list[dict]:
    """
    Jogo adiado aparece duas vezes na mesma rodada: o registro original (adiado)
    e o remarcado. Fica o remarcado; o original só sobrevive se for o único.
    """
    por_confronto: dict[tuple, list[dict]] = {}
    for linha in linhas:
        chave = (linha["rodada"], linha["mandante"], linha["visitante"])
        por_confronto.setdefault(chave, []).append(linha)

    final = []
    for grupo in por_confronto.values():
        if len(grupo) > 1:
            realizados = [g for g in grupo if g["status"] == cfg.STATUS_REALIZADO]
            nao_adiados = [g for g in grupo if g["status"] != cfg.STATUS_ADIADO]
            grupo = realizados or nao_adiados or grupo
        if len(grupo) > 1:  # ainda ambíguo: fica o mais recente
            grupo = [max(grupo, key=lambda g: g["data"])]
        final.append(grupo[0])
    return final


CAMPOS = [
    "id_jogo", "ano", "serie", "fase", "rodada", "data",
    "mandante", "visitante", "gols_m", "gols_v",
    "tapetao_m", "tapetao_v", "status", "sofascore_id",
]


def serializar(jogos: list[dict]) -> str:
    saida = io.StringIO(newline="")
    escritor = csv.DictWriter(saida, fieldnames=CAMPOS, extrasaction="ignore",
                              lineterminator="\n")
    escritor.writeheader()
    escritor.writerows(jogos)
    return saida.getvalue()


def gravar_jogos(jogos: list[dict], serie: str, ano: int) -> tuple[Path, bool]:
    """Grava o CSV. Devolve o caminho e se o conteúdo mudou desde a última vez."""
    cfg.garantir_pastas()
    destino = cfg.caminho_jogos_corrente(serie, ano)
    conteudo = serializar(jogos)
    # Leitura e escrita com `newline=""` dos dois lados: sem isso a leitura
    # traduziria CRLF em LF e a comparação diria "não mudou" para um arquivo
    # que na verdade está gravado diferente do que serializamos.
    anterior = None
    if destino.exists():
        with destino.open("r", encoding="utf-8-sig", newline="") as f:
            anterior = f.read()
    if anterior == conteudo:
        return destino, False
    with destino.open("w", encoding="utf-8-sig", newline="") as f:
        f.write(conteudo)
    return destino, True


def _outros_snapshots(atual: Path, serie: str, ano: int) -> list[Path]:
    """Snapshots dessa série/ano além do que acabou de ser gravado."""
    return [p for p in cfg.BRUTO.glob(f"{serie}_{ano}_*.json*") if p != atual]


def executar(serie: str, ano: int) -> dict:
    """Coleta -> snapshot bruto -> normalização -> CSV. Devolve um resumo."""
    print(f"coletando Série {serie} {ano}...")
    eventos = coletar(serie, ano)
    caminho_bruto = gravar_bruto(eventos, serie, ano)  # antes de normalizar
    print(f"  {len(eventos)} eventos brutos -> {caminho_bruto.name}")

    jogos = normalizar(eventos, serie, ano, carregar_de_para())
    destino, mudou = gravar_jogos(jogos, serie, ano)

    # A normalização passou e provou que nada mudou desde a coleta anterior:
    # este snapshot é cópia do que já está versionado e só engordaria o
    # repositório. Duas condições antes de descartar: o descarte é sempre
    # depois da normalização (se ela estourasse, o snapshot ficaria), e tem de
    # sobrar pelo menos um bruto sustentando o CSV atual.
    if not mudou and _outros_snapshots(caminho_bruto, serie, ano):
        caminho_bruto.unlink()
        print("  nada mudou desde a última coleta; snapshot redundante descartado")
        caminho_bruto = None

    realizados = sum(1 for g in jogos if g["status"] == cfg.STATUS_REALIZADO)
    esperado = cfg.CLUBES_POR_SERIE * (cfg.CLUBES_POR_SERIE - 1)
    print(f"  {len(jogos)} jogos ({realizados} realizados) -> {destino.name}")
    if len(jogos) != esperado:
        print(f"  ATENÇÃO: esperava {esperado} jogos, obtive {len(jogos)}")
    return {
        "serie": serie, "ano": ano, "eventos": len(eventos),
        "jogos": len(jogos), "realizados": realizados, "mudou": mudou,
        "bruto": caminho_bruto, "csv": destino,
    }


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description="Coletor Sofascore")
    ap.add_argument("--serie", choices=[*cfg.SERIES, "todas"], default="todas")
    ap.add_argument("--ano", type=int, default=datetime.now(cfg.FUSO).year)
    args = ap.parse_args(argv)
    series = cfg.SERIES if args.serie == "todas" else (args.serie,)
    for serie in series:
        executar(serie, args.ano)


if __name__ == "__main__":
    main()
