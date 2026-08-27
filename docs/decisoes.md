# Decisões

Registro das escolhas que afetam número publicado. O que estiver aqui precisa
aparecer, em linguagem de leitor, nas notas de rodapé do site.

---

## 1. Fonte da edição corrente: API pública do Sofascore

A API antiga da Globo (`api.globoesporte.globo.com/tabela/...`) saiu do ar —
todos os caminhos devolvem 404, inclusive os de temporadas antigas. É a mudança
que quebrou a planilha.

Endpoints em uso, sem chave e sem cadastro:

```
GET /api/v1/unique-tournament/{torneio}/seasons
GET /api/v1/unique-tournament/{torneio}/season/{temporada}/events/round/{rodada}
```

| Competição | `torneio` | `temporada` 2026 |
|---|---|---|
| Série A | 325 | 87678 |
| Série B | 390 | 89840 |

**Risco assumido por escrito:** API não documentada, sem SLA e sem contrato de
estabilidade. Pode mudar de formato, exigir cabeçalhos novos ou passar a limitar
requisições. Mitigação: o coletor grava o snapshot bruto antes de normalizar, e
a planilha continua como fallback manual.

### 1.1 A API recusa cliente que não pareça navegador

Testado em 26/08/2026: `requests`, `curl` e qualquer combinação de cabeçalhos
recebem **403**. Não é cabeçalho faltando nem bloqueio de IP — é impressão
digital de TLS.

| Cliente | Resposta |
|---|---|
| `requests`, com e sem cabeçalhos de navegador | 403 |
| `curl` | 403 |
| `www.sofascore.com` e `api.sofascore.app` | 403 |
| `curl_cffi` com `impersonate="chrome"` | **200** |

Por isso o coletor usa `curl_cffi`, que reproduz a assinatura TLS do Chrome.
Trocar por `requests` derruba a coleta inteira.

### 1.2 Ponto de falha ainda em aberto: o IP do runner

O `curl_cffi` resolve a impressão digital. Não resolve bloqueio por faixa de IP,
e o runner do GitHub Actions roda em IP de datacenter da Azure. Se a coleta
passar a devolver 403 **no Actions e não na máquina local**, é isso.

Plano B, em ordem de preferência:

1. **Runner self-hosted** na máquina do projeto — mesmo IP residencial que
   funciona hoje. É a solução mais direta e não custa nada.
2. Proxy residencial na chamada do coletor.
3. Coleta manual local (`python -m bi atualizar`) e push, enquanto se resolve.

O workflow de coleta imprime esse diagnóstico quando a etapa falha.

---

## 2. Critério de desempate de último recurso: ordem alfabética

A ordem dos critérios é: **pontos → vitórias → saldo de gols → gols pró →
ordem alfabética do nome do clube**. Confronto direto e cartões não existem na
base; se forem desejados, exigem nova fonte.

A ordem alfabética é **insensível a acento**: `SÃO PAULO (SP)` vem antes de
`SPORT (PE)`, como viria numa lista impressa. Comparando os nomes crus, o `Ã`
(U+00C3) cai depois do `P` e a ordem se inverteria.

Isso importa: era exatamente essa a única divergência que o protótipo tinha
contra a matriz do Power BI (2025, Série A, rodada 1 — São Paulo e Sport
empatados em pontos, vitórias, saldo e gols pró). Com a normalização de acento,
a ordem alfabética coincide com o critério de desempate da planilha em **todas**
as 30.400 linhas de 2006–2025.

---

## 3. Jogo não realizado

Um jogo dado por encerrado sem ter sido disputado e sem pontuação atribuída a
ninguém recebe `status = 'nao_realizado'`. Ele **gera etapa** e **mantém o clube
na classificação**, mas não incrementa `J` e não altera acumulado nenhum.

O único caso na era dos pontos corridos: **Chapecoense × Atlético-MG, 2016,
Série A, rodada 38**, após a tragédia da Chapecoense.

Foi assim que a matriz do Power BI sempre tratou o caso, e é a única leitura que
reproduz aquela tabela: no Excel, os dois clubes têm linha na rodada 38, com
`J = 37`, resultado vazio, pontos congelados nos da rodada 37 — e ainda assim
ocupando as posições 11ª e 4ª.

Descartar a linha, como o protótipo fazia, produz 17 divergências: os 2 clubes
somem da rodada 38 e 15 dos 18 restantes sobem de lugar. Dois mecanismos
independentes sustentam o tratamento correto, e `testes/test_jogo_nao_realizado.py`
prova os dois separadamente:

1. **a grade completa de etapas** mantém os dois clubes na rodada 38, por
   repetição do último acumulado — é ela que segura as posições;
2. **o status `nao_realizado`** mantém o jogo como evento — é ele que segura a
   38ª etapa na ordem cronológica (`JOGO NUM`), que a grade não reconstrói.

**Como dizer isso no site:** "o jogo não foi disputado; nenhum dos dois clubes
recebeu pontos, e a rodada 38 conta como jogada para efeito de posição."

---

## 4. Escopo do histórico

A camada canônica guarda **todos os jogos desde 1937**. As tabelas derivadas
cobrem só **2006 em diante** — a era dos pontos corridos com 20 clubes e 38
rodadas, que é o recorte em que as comparações por rodada fazem sentido.

Ampliar o recorte é mudar uma constante (`ANO_INICIO_BI`), mas exige antes
decidir o que significa "rodada 38" numa edição de 24 clubes ou de mata-mata.

---

## 5. A grade de etapas é completa e preenchida para trás

Todo clube tem linha em toda etapa de 1 até a última com jogo disputado na
edição, mesmo nas etapas em que não jogou. Os acumulados repetem o último valor
conhecido.

Sem isso, o recorte por mando produziria tabelas com menos de 20 clubes: um
clube passa rodadas seguidas sem atuar em casa, e sumiria da classificação de
mandantes naquelas rodadas. Com a grade, "pontos em casa até a rodada X" é o
que se espera que seja.

`etapa_max` é a última etapa em que **algum** clube da edição jogou de fato. É o
que impede uma edição em andamento de publicar 14 tabelas idênticas de rodadas
futuras.

---

## 6. Tapetão nos recortes por mando

O tapetão está lançado na linha do jogo da rodada em que a punição ocorreu.
Quando se filtra por mando, a punição só entra se tiver caído numa rodada em que
o clube jogou naquela condição.

É consequência direta da regra "filtra os jogos, depois acumula", e vale a pena
saber ao ler um número de `criterio = 'CT'` combinado com `local ≠ 'todos'`.
Para `local = 'todos'` — que é o que a classificação usa — o acumulado bate com
a coluna `TAP` da matriz em todas as linhas.

---

## 7. `fato_pontuacao_etapa` agrega edições, não anos

As outras duas tabelas fato têm grão por edição. Esta não: ela responde "com
essa pontuação nessa rodada, que posição se costuma ocupar e onde se costuma
terminar", e isso exige somar várias edições.

Só entram **edições fechadas**, sem jogo pendente. Uma edição em andamento não
tem posição final e envenenaria a estatística. Posição por edição continua
disponível em `fato_posicao_etapa`.

---

## 8. Repositório fora da pasta sincronizada

O repositório mora em `C:\Users\peu\Dev\bi-brasileirao`, fora do Google Drive.
O Drive sincroniza arquivo a arquivo, sem a atomicidade que o `.git` exige — dá
conflito em `index.lock`, packfile pela metade e objeto apagado que volta. O
backup do projeto é o GitHub.

As fontes (`Histórico Campeonato Brasileiro.xlsx` e `de_para_clubes.csv`) foram
copiadas para dentro do repositório. A pasta original no Drive segue intacta.
