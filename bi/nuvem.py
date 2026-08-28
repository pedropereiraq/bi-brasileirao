"""
Ponte com o depósito de brutos na Cloudflare.

Quem busca no Sofascore é o navegador de quem apertou "Atualizar" no site — a
API recusa IP de datacenter, mas aceita um navegador de verdade num IP
residencial, desde que o cabeçalho `Referer` não seja de terceiro. O navegador
manda o JSON íntegro para o site, que guarda no KV.

Este módulo é o outro lado: o recálculo, rodando em runner comum do GitHub,
baixa daqui o bruto guardado e segue o caminho de sempre. Nenhuma requisição a
fonte externa acontece aqui — só ao nosso próprio depósito, que é alcançável de
qualquer lugar.

Configuração, por variável de ambiente:
    BI_NUVEM_URL     https://bi-brasileirao.pages.dev
    BI_NUVEM_CHAVE   segredo compartilhado com o site (secret do repositório)
"""
from __future__ import annotations

import json
import os

from curl_cffi import requests

from . import config as cfg


class ErroNuvem(RuntimeError):
    """Falha ao falar com o depósito. Nunca silenciada."""


def _limpar(valor: str) -> str:
    """
    Tira BOM e espaço em volta de valor vindo de variável de ambiente.

    Segredo de CI passa por vários intermediários antes de chegar aqui, e mais
    de um deles gosta de acrescentar um BOM invisível — o PowerShell 5.1 põe um
    em tudo que passa por pipe. O sintoma é feio e distante da causa: o
    `curl_cffi` estoura ao codificar o cabeçalho em latin-1.
    """
    return valor.strip().lstrip("﻿").strip()


def _endereco() -> tuple[str, str]:
    url = _limpar(os.environ.get("BI_NUVEM_URL", "")).rstrip("/")
    chave = _limpar(os.environ.get("BI_NUVEM_CHAVE", ""))
    if not url or not chave:
        raise ErroNuvem(
            "BI_NUVEM_URL e BI_NUVEM_CHAVE precisam estar definidas — "
            "são o endereço do site e o segredo compartilhado com ele."
        )
    return url, chave


def configurado() -> bool:
    return bool(os.environ.get("BI_NUVEM_URL") and os.environ.get("BI_NUVEM_CHAVE"))


def baixar_bruto(serie: str, ano: int) -> list[dict]:
    """O último snapshot que o navegador depositou para essa série e ano."""
    url, chave = _endereco()
    resposta = requests.get(
        f"{url}/api/bruto?serie={serie}&ano={ano}",
        headers={"x-chave": chave},
        timeout=60,
    )
    if resposta.status_code == 404:
        raise ErroNuvem(
            f"Série {serie} {ano}: nada depositado ainda. "
            "Alguém precisa apertar 'Atualizar' no site pelo menos uma vez."
        )
    if not resposta.ok:
        raise ErroNuvem(
            f"Série {serie} {ano}: HTTP {resposta.status_code} ao ler o depósito"
        )

    try:
        eventos = resposta.json()
    except (ValueError, json.JSONDecodeError) as e:
        raise ErroNuvem(f"Série {serie} {ano}: depósito não é JSON válido — {e}")

    if not isinstance(eventos, list) or not eventos:
        raise ErroNuvem(f"Série {serie} {ano}: depósito vazio ou fora de formato")
    return eventos


def avisar_conclusao(ano: int, resumo: dict) -> None:
    """
    Conta ao site que o recálculo terminou, para o botão parar de girar.

    Falha aqui não derruba o recálculo: os dados já foram versionados, e o
    site no máximo mostra "processando" até a próxima visita.
    """
    try:
        url, chave = _endereco()
        requests.post(
            f"{url}/api/concluido",
            headers={"x-chave": chave, "content-type": "application/json"},
            data=json.dumps({"ano": ano, **resumo}),
            timeout=30,
        )
    except Exception as e:  # noqa: BLE001 — aviso é melhor-esforço
        print(f"  aviso de conclusão não entregue ({type(e).__name__}); segue o jogo")


def ingerir(ano: int, series: tuple[str, ...] = cfg.SERIES) -> list[dict]:
    """Baixa o bruto de cada série e passa pelo mesmo processamento de sempre."""
    from . import coletor

    resumos = []
    for serie in series:
        print(f"lendo o depósito da Série {serie} {ano}...")
        eventos = baixar_bruto(serie, ano)
        resumos.append(coletor.processar(eventos, serie, ano))
    return resumos
