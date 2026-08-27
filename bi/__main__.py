"""
Linha de comando do projeto.

    python -m bi coletar     [--ano 2026] [--serie A|B|todas]
    python -m bi construir   canônico + as três tabelas derivadas
    python -m bi conferir    [--ano 2026]  nossa tabela x classificação oficial
    python -m bi atualizar   coletar + construir + conferir (o que o Actions roda)
"""
from __future__ import annotations

import argparse
from datetime import datetime

from . import canonico, coletor, conferencia, derivadas
from . import config as cfg


def cmd_coletar(args) -> int:
    series = cfg.SERIES if args.serie == "todas" else (args.serie,)
    for serie in series:
        coletor.executar(serie, args.ano)
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


def main(argv: list[str] | None = None) -> int:
    ano_padrao = datetime.now(cfg.FUSO).year
    ap = argparse.ArgumentParser(prog="python -m bi", description=__doc__)
    sub = ap.add_subparsers(dest="comando", required=True)

    for nome, funcao, com_serie in [
        ("coletar", cmd_coletar, True),
        ("construir", cmd_construir, False),
        ("conferir", cmd_conferir, False),
        ("atualizar", cmd_atualizar, True),
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
