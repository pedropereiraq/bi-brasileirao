"""
Linha de comando do projeto.

    python -m bi coletar     busca no Sofascore (só de IP residencial)
    python -m bi ingerir     lê o bruto que o navegador depositou na nuvem
    python -m bi construir   canônico + as três tabelas derivadas
    python -m bi conferir    nossa tabela x classificação oficial
    python -m bi atualizar   coletar + construir + conferir (uso local)
    python -m bi recalcular  ingerir + construir (o que o GitHub roda)

A diferença entre `coletar` e `ingerir` é só de transporte. `coletar` fala com
o Sofascore, o que exige um IP que ele aceite. `ingerir` lê o mesmo JSON bruto
do depósito da Cloudflare, onde o navegador de quem apertou "Atualizar" no site
já o deixou — e isso funciona de qualquer lugar, inclusive da nuvem do GitHub.
"""
from __future__ import annotations

import argparse
from datetime import datetime

from . import canonico, coletor, conferencia, derivadas, nuvem
from . import config as cfg


def cmd_coletar(args) -> int:
    series = cfg.SERIES if args.serie == "todas" else (args.serie,)
    for serie in series:
        coletor.executar(serie, args.ano)
    return 0


def cmd_ingerir(args) -> int:
    series = cfg.SERIES if args.serie == "todas" else (args.serie,)
    nuvem.ingerir(args.ano, series)
    return 0


def cmd_construir(_args) -> int:
    print("camada canônica...")
    jogos, clubes = canonico.construir()
    print(f"  jogos: {len(jogos):,} | clubes: {len(clubes):,}".replace(",", "."))
    print("camada derivada...")
    derivadas.construir(jogos)
    return 0


def cmd_conferir(args) -> int:
    return conferencia.main(["--ano", str(args.ano)])


def cmd_atualizar(args) -> int:
    cmd_coletar(args)
    cmd_construir(args)
    return cmd_conferir(args)


def cmd_recalcular(args) -> int:
    """
    O caminho do botão. Não fala com o Sofascore em nenhum momento: lê o bruto
    que o navegador depositou e reconstrói. A conferência contra a
    classificação oficial fica de fora por isso mesmo — ela precisaria da API,
    e quem roda isto é um runner de nuvem, que a API recusa.
    """
    cmd_ingerir(args)
    return cmd_construir(args)


def main(argv: list[str] | None = None) -> int:
    ano_padrao = datetime.now(cfg.FUSO).year
    ap = argparse.ArgumentParser(prog="python -m bi", description=__doc__)
    sub = ap.add_subparsers(dest="comando", required=True)

    for nome, funcao, com_serie in [
        ("coletar", cmd_coletar, True),
        ("ingerir", cmd_ingerir, True),
        ("construir", cmd_construir, False),
        ("conferir", cmd_conferir, False),
        ("atualizar", cmd_atualizar, True),
        ("recalcular", cmd_recalcular, True),
    ]:
        p = sub.add_parser(nome)
        p.set_defaults(funcao=funcao, serie="todas", ano=ano_padrao)
        p.add_argument("--ano", type=int, default=ano_padrao)
        if com_serie:
            p.add_argument("--serie", choices=[*cfg.SERIES, "todas"], default="todas")

    args = ap.parse_args(argv)
    return args.funcao(args)


if __name__ == "__main__":
    raise SystemExit(main())
