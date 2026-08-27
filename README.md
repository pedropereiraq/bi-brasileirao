# BI Brasileirão

Banco de dados e motor de cálculo do BI do Campeonato Brasileiro do
**ECBahiaNumeros** / **Podcast45 — Nordeste 45 Minutos**. Migração do BI que
hoje roda em Power BI para Python, com publicação como site estático.

**Fase atual: 1 — o banco.** Nenhuma página do site foi construída ainda.

---

## O que já funciona

- Coleta da edição corrente (Séries A e B) na API pública do Sofascore, com
  snapshot bruto versionado a cada coleta que traz novidade.
- Camada canônica com **35.865 jogos**, de 1937 a 2026.
- Três tabelas fato em parquet, com todas as combinações de variação.
- **74 testes**, incluindo a reprodução das 30.400 linhas da matriz do Excel.

O motor reproduz a matriz do Power BI em **todas as 30.400 linhas, nas 13
colunas comparáveis** — pontos, tapetão, J/V/E/D, gols pró e contra, saldo,
posição com e sem tapetão, posição final com e sem tapetão, e o número do jogo
na ordem cronológica. Zero divergências.

A classificação calculada de 2026 foi conferida contra o ge.globo nas duas
séries, nas 40 linhas, em todos os campos.

---

## Uso

```bash
pip install -r requirements.txt
```

```bash
python -m bi atualizar
```

`atualizar` faz o ciclo inteiro: coleta, reconstrói o banco e confere contra a
classificação oficial. Os passos também rodam soltos:

| Comando | O que faz |
|---|---|
| `python -m bi coletar --ano 2026` | baixa a edição corrente das duas séries |
| `python -m bi construir` | refaz canônico e derivadas a partir dos jogos |
| `python -m bi conferir --ano 2026` | compara nossa tabela com a oficial |
| `pytest -q` | roda os 74 testes (não vai à rede) |

---

## Estrutura

```
bi/                 pacote Python
  config.py         caminhos, constantes e parâmetros de fonte
  coletor.py        Sofascore -> snapshot bruto -> jogos da edição corrente
  historico.py      Excel (abas Jogos e Equipes) -> layout canônico
  canonico.py       histórico + coleta -> jogos.parquet, clubes.parquet
  motor.py          acumulação e classificação
  derivadas.py      as três tabelas fato
  conferencia.py    nossa classificação x a oficial
dados/
  bruto/sofascore/  snapshots .json.gz, um por coleta com novidade
  corrente/         CSV da edição em andamento, saída do coletor
  canonico/         clubes.parquet, jogos.parquet
  derivado/         as três tabelas fato
fontes/             Excel histórico e de-para dos clubes
testes/             a suíte, com fixture offline do coletor
docs/               especificação e decisões
```

---

## Modelo de dados

Três camadas. **Nenhuma tabela derivada é fonte de verdade: tudo se reconstrói
a partir de `jogos`.** Apagar `dados/derivado` e rodar `python -m bi construir`
devolve exatamente o que estava lá — e há teste provando isso.

### Camada 2 — canônico

`clubes` (235 linhas) e `jogos` (35.865 linhas, 1937–2026). Um jogo tem
`status ∈ {realizado, agendado, adiado, cancelado, nao_realizado}`.

### Camada 3 — derivado

As três compartilham as colunas de variação, e é isso que faz qualquer
cruzamento virar um join direto:

| Coluna | Valores | O que muda |
|---|---|---|
| `ordem` | `rodada`, `data` | rodada oficial, ou n-ésimo jogo cronológico |
| `criterio` | `ST`, `CT` | sem tapetão, ou com a punição aplicada |
| `local` | `todos`, `casa`, `fora` | filtra os jogos antes de acumular |

| Tabela | Grão | Linhas |
|---|---|---|
| `fato_clube_etapa` | clube × edição × etapa | 313.760 |
| `fato_posicao_etapa` | posição × edição × etapa | 313.760 |
| `fato_pontuacao_etapa` | pontuação × etapa, agregada nas edições fechadas | 21.312 |

O banco inteiro ocupa 6,4 MB.

---

## Automação

`.github/workflows/coleta.yml` roda duas vezes por dia (03:00 e 12:00 de
Brasília), coleta, reconstrói, confere, roda os testes e versiona o que mudou.
`.github/workflows/testes.yml` roda a suíte em cada push.

**Um risco conhecido:** a API do Sofascore recusa cliente que não tenha
assinatura TLS de navegador — daí o `curl_cffi` no lugar do `requests`. Isso
resolve a impressão digital, não um eventual bloqueio por faixa de IP, e o
runner do GitHub roda em IP de datacenter. Se a coleta falhar com 403 no Actions
e funcionar na máquina local, é isso: o plano B está em
[docs/decisoes.md](docs/decisoes.md).

---

## Leitura obrigatória antes de mexer no cálculo

[**docs/decisoes.md**](docs/decisoes.md) — as escolhas que afetam número
publicado: o critério de desempate, o jogo não realizado de 2016, a grade
completa de etapas, o escopo do histórico. Cada uma tem teste que a sustenta.

[docs/ESPECIFICACAO_BANCO.md](docs/ESPECIFICACAO_BANCO.md) — a especificação da
fase 1, com o levantamento das 29 páginas do BI atual.

O PDF com os prints do BI em Power BI (14 MB) não entrou no repositório; ele
está na pasta do projeto no Google Drive, em
`Podcast45/Novo BI Brasileirão/`.

---

## Próxima fase

As páginas, uma a uma, com a identidade do ECBahiaNumeros. As três tabelas fato
já foram desenhadas para servi-las: as páginas 10, 11 e 16 (médias por posição e
projeções) saem de `fato_posicao_etapa` e `fato_pontuacao_etapa`; a 4, a 6 e a 7
(mando de campo) saem do `local` de `fato_clube_etapa`.
