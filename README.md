# BI Brasileirão

Banco de dados e motor de cálculo do BI do Campeonato Brasileiro do
**ECBahiaNumeros** / **Podcast45 — Nordeste 45 Minutos**. Migração do BI que
hoje roda em Power BI para Python, com publicação como site estático.

**Fase atual: 1 — o banco.** Nenhuma página do site foi construída ainda.

---

## O que já funciona

- Atualização sob demanda: um botão no site, coleta feita pelo navegador de
  quem aperta, recálculo na nuvem. Sem máquina ligada e sem proxy pago.
- Snapshot bruto versionado a cada coleta que traz novidade.
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
| `python -m bi coletar --ano 2026` | busca no Sofascore (só de IP residencial) |
| `python -m bi ingerir --ano 2026` | lê o bruto que o navegador depositou na nuvem |
| `python -m bi construir` | refaz canônico e derivadas a partir dos jogos |
| `python -m bi conferir --ano 2026` | compara nossa tabela com a oficial |
| `python -m bi recalcular --ano 2026` | ingerir + construir — o que o GitHub roda |
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
  nuvem.py          lê o bruto que o navegador depositou na Cloudflare
  conferencia.py    nossa classificação x a oficial
site/               Cloudflare Pages — página de operação e funções de /api
  public/           index.html, app.js, coleta.js (a coleta roda aqui)
  functions/api/    coletar, bruto, estado, concluido
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

## Como os dados são atualizados

Não há coleta agendada. Os dados mudam quando alguém aperta **Atualizar** no
site — e quem coleta é o navegador de quem apertou.

```
Site (Cloudflare Pages, atrás do Access)
        ↓ aperta "Atualizar"
O NAVEGADOR busca as 76 rodadas no Sofascore          (~25 s)
        ↓ POST /api/coletar
O site guarda o JSON íntegro no KV, antes de normalizar
        ↓ workflow_dispatch
GitHub Actions lê o depósito e recalcula com o motor Python
        ↓
Dados versionados no repositório
```

**Por que o navegador.** O Sofascore recusa requisição que traga `Referer` de
outro site — e recusa IP de datacenter. Um navegador resolve as duas coisas: está
num IP residencial e pode suprimir o `Referer` com `referrerPolicy:
"no-referrer"`. Foi medido: 76 rodadas em 24 segundos, produzindo CSVs
idênticos aos que o coletor Python produz da API.

**Por que o recálculo pode rodar na nuvem.** Porque ele não fala com o
Sofascore: lê o depósito da Cloudflare, que responde de qualquer IP. Assim o
motor Python continua sendo o único, com os 74 testes valendo.

| Workflow | Onde roda | Quando |
|---|---|---|
| `recalculo.yml` | runner hospedado pelo GitHub | quando o botão é apertado |
| `testes.yml` | runner hospedado pelo GitHub | a cada push |

A medição completa que levou a este desenho — incluindo o proxy em Cloudflare
Workers que foi escrito, testado e descartado — está em
[docs/decisoes.md](docs/decisoes.md), seção 1. Para refazê-la:

```bash
python -m ferramentas.diagnostico_fontes
```

### Contingência

Se o site sair do ar, a coleta continua possível da máquina do projeto, que tem
IP residencial:

```bash
python -m bi atualizar
```

### Uma propriedade a saber

`id_jogo` é posicional, como no Excel (`B2026.251`). Quando um jogo é remarcado,
a renumeração desloca todos os seguintes, e o diff da coleta fica maior do que
o fato. Não é erro: a identidade estável de um jogo é o `sofascore_id`, que não
muda com o remarcamento.

---

## Leitura obrigatória antes de mexer no cálculo

[**docs/decisoes.md**](docs/decisoes.md) — as escolhas que afetam número
publicado: o critério de desempate, o jogo não realizado de 2016, a grade
completa de etapas, o escopo do histórico. Cada uma tem teste que a sustenta.

[**docs/operacao.md**](docs/operacao.md) — o dia a dia: como dar acesso a mais
gente, como trocar o token, o que fazer quando o botão dá erro, e as três coisas
que precisam de olho de tempos em tempos.

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
