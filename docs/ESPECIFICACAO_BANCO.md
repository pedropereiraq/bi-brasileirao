# BI Brasileirão — Especificação do Banco de Dados

_Fase 1 do projeto. Escrito em 27/08/2026. Base: `Histórico Campeonato Brasileiro.xlsx` e `Podcast45 - Campeonato Brasileiro - V2025.pdf`._

---

## 1. O que já existe

### 1.1 Excel histórico

| Aba | Linhas | Papel |
|---|---|---|
| `Jogos` | 35.105 | **Fonte da verdade.** Ano, Série, Data, Mandante, M, V, Visitante, Rodada, Fase, Tapetão M, Tapetão V, ID Jogo. Cobre 1937–2025. |
| `Equipes` | 545 | EQUIPE, ESTADO, REGIÃO, CIDADE, SIGLA, NUM, ESCUDO. Chave de nome no formato `NOME (UF)`. |
| `Tapetão` | 10 | EQUIPE, ANO, SÉRIE, FASE, RODADA, PONTOS. Redundante com as colunas Tapetão de `Jogos`. |
| `Matriz` | 1.520 | Cálculo vivo (fórmulas) — 2 edições. |
| `Matriz - Só valores` | 30.400 | Matriz materializada: 2006–2025, Séries A e B, 760 linhas por edição (380 jogos × 2 clubes). |
| `Médias`, `Ocorrências` | — | Agregados derivados, recalculáveis. |

A `Matriz` traz por clube/rodada: Pró, Contra, Adversário, Local, Resultado, PTS (ST), J/V/E/D/GP/GC/SG, TAP, DESEMP, SOMA ST/CT, POS ST/CT, POS FIM ST/CT, ÚLTIMOS X JOGOS, JOGO NUM.

Convenção confirmada: **ST = sem tapetão** (pontuação esportiva pura), **CT = com tapetão** (com a punição aplicada a partir da rodada em que ocorreu). `POS FIM` é a posição final da edição, constante por clube — usada para colorir séries. `SOMA` é a chave numérica composta de desempate. `DESEMP` é um número fixo por clube que resolve empates absolutos.

### 1.2 O BI atual (29 páginas)

1. Classificação · 2. Tabela de jogos · 3. Classificação por aproveitamento · 4. Mando de campo · 5. FMI · 6. Índice de dependência do mando · 7. Metas por mando · 8. Ataques e defesas · 9. Distribuição de resultados · 10. Média de pontuação por posição e rodada · 11. Evolução da diferença entre pontuação e média por posição · 12. Distância entre posições · 13. Distância para a equipe de baixo · 14. Campanhas semelhantes · 15. Evolução da pontuação por equipe · 16. Projeções de pontuação · 17. Evolução da posição por equipe · 18. Recortes iniciais por equipe · 19. Jogos para alcançar "X" · 20. Blocos de 6 jogos · 21. Evolução da diferença entre equipe e posição · 22. Média móvel de aproveitamento nos últimos "X" jogos · 23. Resultados por posição do adversário · 24. Dificuldade de tabela · 25. Posição em cada rodada · 26. Histórico de campanhas · 27. Histórico de turnos · 28. Histórico geral nos pontos corridos com 20 clubes · 29. Histórico de confrontos nos pontos corridos com 20 clubes.

Filtros recorrentes: Série, Edição, Equipe, Local (casa/fora/todos), Rodada (1–38), Últimos X jogos (1–38), Data.

---

## 2. Fonte da edição atual — resolvida

A API antiga da Globo (`api.globoesporte.globo.com/tabela/...`) foi **testada e está fora do ar**: todos os caminhos, inclusive os de temporadas antigas, retornam 404. É a mudança que quebrou a planilha.

### Fonte escolhida: API pública do Sofascore

Testada ao vivo em 27/08/2026, no navegador, sem chave e sem autenticação:

```
GET https://api.sofascore.com/api/v1/unique-tournament/{torneio}/seasons
GET https://api.sofascore.com/api/v1/unique-tournament/{torneio}/season/{temporada}/events/round/{rodada}
```

| Competição | `torneio` | `temporada` 2026 |
|---|---|---|
| Série A | 325 | 87678 |
| Série B | 390 | 89840 |

Cada evento traz: `id`, `roundInfo.round`, `startTimestamp`, `homeTeam`, `awayTeam`, `homeScore.current`, `awayScore.current`, `status.type`.

**Resultado do teste (27/08/2026):**

| | Série A | Série B |
|---|---|---|
| Registros nas 38 rodadas | 385 | 383 |
| Jogos finalizados | 235 | 240 |
| Clubes | 20 | 20 |
| Janela da edição | 28/01 a 02/12/2026 | 21/03 a 14/11/2026 |

Por que ela serve bem ao projeto:

- **Rodada e data vêm separadas.** `roundInfo.round` mantém a rodada oficial mesmo quando o jogo é adiado, e `startTimestamp` traz a data em que o jogo foi de fato disputado. É exatamente o par que as duas variações do BI (por rodada × por data) exigem.
- **Jogos adiados são explícitos.** Os 5 registros excedentes da Série A e os 3 da Série B são pares (jogo original `Postponed` + jogo remarcado) na mesma rodada. Regra de deduplicação: dentro de `(rodada, mandante, visitante)`, se houver mais de um registro, descartar os de status `postponed`.
- Cobre Série A e Série B, é gratuita e não exige cadastro.

**Riscos a assumir por escrito:** é API não documentada, sem SLA e sem contrato de estabilidade — pode mudar de formato, exigir cabeçalhos ou passar a limitar requisições. Mitigação: o coletor grava um snapshot bruto (JSON) a cada execução, então uma quebra nunca apaga o que já foi coletado, e um fallback manual pela planilha continua possível.

**Alternativas avaliadas e descartadas:** API Futebol (`api-futebol.com.br`) — R$ 99/mês *por campeonato*, R$ 198/mês para A+B; football-data.org — só Série A no plano gratuito; raspagem de ge.globo/CBF — a tabela é renderizada no servidor, mais frágil que a API do Sofascore.

**De-para de clubes:** o coletor deve casar clube por **`team.id` do Sofascore**, nunca por nome — os nomes divergem da convenção `NOME (UF)` (ex.: `Atlético Mineiro` → `ATLÉTICO (MG)`, `Sport Recife` → `SPORT (PE)`, `Grêmio Novorizontino` → `NOVORIZONTINO (SP)`, `Clube De Regatas Brasil` → `CRB (AL)`). O de-para das 40 equipes de 2026 já está montado em `prototipo/de_para_clubes.csv` (`serie_2026, sofascore_id, sofascore_nome, equipe, sigla`) e **todas as 40 casam com a aba `Equipes`, com sigla** — nenhum clube novo a cadastrar nesta temporada. Duas ambiguidades foram resolvidas conferindo o histórico de jogos: `NOVORIZONTINO (SP)` (e não `GE NOVORIZONTINO (SP)`) e `OPERÁRIO (PR)`.

---

## 3. Modelo de dados

Três camadas. Nenhuma tabela derivada é fonte de verdade: tudo se reconstrói a partir de `jogos`.

### Camada 1 — Bruto

- `raw/sofascore/{serie}_{ano}_{data_hora}.json` — resposta íntegra de cada coleta.

### Camada 2 — Canônico

**`clubes`** — `equipe` (PK, `NOME (UF)`), `sigla`, `estado`, `regiao`, `cidade`, `escudo`, `sofascore_id`.

**`jogos`** — grão: um jogo.

| Campo | Notas |
|---|---|
| `id_jogo` | `A2026.157` — mantém a convenção do Excel |
| `ano`, `serie`, `fase` | `fase = 'Única'` em todo o recorte de 20 clubes |
| `rodada` | rodada oficial |
| `data` | data em que o jogo foi disputado |
| `mandante`, `visitante` | FK para `clubes` |
| `gols_m`, `gols_v` | nulos = jogo não realizado |
| `tapetao_m`, `tapetao_v` | pontos retirados, negativos, lançados na rodada do fato |
| `status` | `realizado` / `agendado` / `adiado` / `cancelado` |

### Camada 3 — Derivado (calculado, nunca digitado)

**`fato_clube_etapa`** — grão: clube × edição × etapa. Uma linha por passo da campanha.

Dimensões de variação como **colunas**, não como tabelas separadas — é isso que permite cruzar tudo com tudo:

- `ordem` ∈ {`rodada`, `data`} — na ordem `data`, `etapa` é o n-ésimo jogo do clube em ordem cronológica, e `jogo_num` da matriz atual é exatamente isso.
- `criterio` ∈ {`ST`, `CT`} — sem/com tapetão.
- `local` ∈ {`todos`, `casa`, `fora`} — os agregados por mando saem do mesmo motor, filtrando os jogos antes de acumular.

Campos: `ano, serie, ordem, criterio, local, etapa, equipe, adversario, mando, resultado, gp, gc, sg, pts_rodada, j, v, e, d, pts, gp_ac, gc_ac, sg_ac, tap_ac, pos, pos_fim, aproveitamento`.

**`fato_posicao_etapa`** — grão: posição × edição × etapa, com as mesmas colunas de variação. É o espelho da anterior: `pts_da_posicao`, `equipe_na_posicao`. Daqui saem as médias históricas por posição/rodada (páginas 10, 11, 16 do BI) e o cruzamento "posição de um clube × pontuação típica daquela posição".

**`fato_pontuacao_etapa`** — grão: pontuação × etapa. Para cada valor de pontos possível numa dada rodada, qual a posição correspondente e com que frequência — é a aba `Ocorrências` generalizada, e a base das páginas de projeção e campanhas semelhantes.

Como as três compartilham `(ano, serie, ordem, criterio, local, etapa)`, qualquer cruzamento vira um join direto.

### Volume

20 edições × 2 séries × 20 clubes × 38 etapas = 30.400 linhas por combinação de variação; × 2 ordens × 2 critérios × 3 locais = ~365 mil linhas. Parquet resolve com folga; nada aqui exige banco de servidor.

---

## 4. Motor de cálculo — validado

Protótipo escrito e rodado contra as 30.400 linhas da `Matriz - Só valores` (2006–2025, A e B), reconstruindo tudo apenas a partir de `Jogos`:

| Comparação | Divergências | Acerto |
|---|---|---|
| Pontos acumulados | 2 | 99,993% |
| Tapetão acumulado | 2 | 99,993% |
| Posição sem tapetão | 19 | 99,938% |
| Posição com tapetão | 19 | 99,938% |

**As duas causas foram identificadas — não há erro de lógica pendente:**

1. **17 divergências, 2016 Série A, rodada 38.** Chapecoense × Atlético-MG não tem placar na base (jogo não realizado após a tragédia da Chapecoense). O protótipo descarta linhas sem placar, os dois clubes somem da rodada 38 e todo mundo abaixo sobe duas posições. Precisa de tratamento explícito de jogo não realizado com pontuação atribuída.
2. **2 divergências, 2025 Série A, rodada 1.** São Paulo e Sport empatados em pontos, vitórias, saldo e gols pró. O critério de último recurso (`DESEMP`) decidiu 14º/15º de um jeito; a ordem alfabética decidiu do outro. Empate absoluto, sem impacto sobre a lógica.

Critérios de desempate implementados, nesta ordem: **pontos → vitórias → saldo de gols → gols pró → critério de último recurso**. Confronto direto e cartões não existem na base; se forem desejados, exigem nova fonte.

---

## 5. Decisões tomadas

1. **Fonte primária: API do Sofascore.** Com snapshot bruto a cada coleta e a planilha como fallback manual.
2. **Execução: GitHub Actions.** Coletor agendado na nuvem, dados versionados no repositório, site publicado no mesmo fluxo. Não depende do PC ligado.
3. **Critério de último recurso: ordem alfabética.** Determinístico e documentado no site. Diverge do `DESEMP` da matriz em 1 caso em 20 edições, sem consequência de classificação.

## 6. Decisões ainda em aberto

1. **Jogos não realizados com pontuação atribuída** (o caso 2016). Modelar como `status = 'cancelado'` + pontos via tapetão, ou como jogo com placar oficial?
2. **Escopo do histórico.** O BI atual trabalha só com 2006–2025 (pontos corridos, 20 clubes). A base tem jogos desde 1937 — manter fora do BI, mas dentro do banco.

---

## 7. Próximos passos (no Claude Code)

1. Criar o repositório com o motor validado (`prototipo/engine.py`), o coletor (`prototipo/coletor_sofascore.py`) e o de-para (`prototipo/de_para_clubes.csv`).
2. Rodar o coletor pela primeira vez e conferir a edição de 2026 contra a classificação oficial das duas séries.
3. Gerar as três tabelas derivadas em parquet, com as colunas de variação (`ordem`, `criterio`, `local`).
4. Montar o workflow do GitHub Actions: coleta agendada, recálculo, commit e publicação.
5. Só então começar as páginas, uma a uma, com a identidade do ECBahiaNumeros.
