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

### 1.2 O IP do runner do GitHub é bloqueado — medido, não suposto

O `curl_cffi` resolve a impressão digital. Não resolve bloqueio por faixa de IP.
Medido em 28/08/2026 com `ferramentas/diagnostico_fontes.py`, rodando o mesmo
script nos dois lugares:

| Fonte | Tem lista de jogos? | Local (177.193.x.x) | Runner (Azure) |
|---|---|---|---|
| Sofascore, 5 assinaturas TLS, 3 hosts | sim | 200 | **403 em todas** |
| **ogol.com.br**, calendário paginado | **sim** | 200 | **403** |
| ge.globo, HTML das Séries A e B | não | 200 | 200 |
| Wikipédia | parcial | 200 | 200 |
| `api.globoesporte.globo.com` | — | 500 | 500 |

Três IPs de runner diferentes foram sorteados nos testes (172.184.211.26,
48.211.210.117) e todos deram o mesmo resultado. O bloqueio é da faixa de IP,
não do cliente: mesmo código, mesmos cabeçalhos e mesma assinatura TLS passam
da máquina do projeto e não passam da nuvem.

**Nenhuma fonte que carrega a lista de jogos é alcançável de um runner
hospedado pelo GitHub.** As duas que carregam — Sofascore e ogol — bloqueiam
datacenter. As duas que passam não servem como fonte:

- **ge.globo** traz a classificação pronta e os jogos da rodada corrente, mas
  não as 380 partidas com rodada e data. Classificação pronta não serve a um
  projeto que reconstrói tudo a partir dos jogos — serve como conferência.
- **Wikipédia** traz a grade de resultados, sem rodada nem data confiáveis, e
  com atraso de edição comunitária.
- A **`api.globoesporte`**, que traria a lista, responde 500 em todos os slugs
  testados, inclusive com o slug de fase correto extraído do HTML do próprio ge
  (`fase-unica-campeonato-brasileiro-2026`).

### 1.3 Proxy em Cloudflare Workers: testado e descartado

Hipótese: Sofascore e ogol estão hospedados na Cloudflare; um Worker faz a
requisição de dentro da rede dela, e talvez esse egresso seja tratado de outro
jeito. O worker foi escrito, deployado e medido em 28/08/2026.

| | Máquina do projeto | Cloudflare Worker |
|---|---|---|
| Sofascore | 200, dados reais | **403, `"reason": "challenge"`** |
| ogol | 200, 281 KB com a tabela | **200 com página "Serviço Temporariamente Suspenso"** |

As duas medições foram feitas no mesmo minuto, então não é indisponibilidade da
fonte: é recusa ao egresso da Cloudflare.

**Por que não passa:** as fontes checam **duas** coisas independentes, e o Worker
só resolve uma. A prova está no próprio diagnóstico — `sofascore requests puro`
dá 403 **da máquina do projeto**, do IP aceito, porque a assinatura TLS não é de
navegador. Um Worker não consegue apresentar assinatura de Chrome: ele usa a
pilha TLS da Cloudflare, e isso não é configurável.

**O detalhe que vale guardar:** o ogol devolveu **HTTP 200 com página de bloqueio
no corpo**. Um coletor que confie no código de status grava lixo em silêncio.
Qualquer coletor de HTML neste projeto precisa validar o conteúdo, não o status.

O código do worker fica em `ferramentas/proxy-cloudflare/`, documentado, caso a
situação mude. Não está em uso.

### 1.4 O bloqueio é pelo `Referer`, e o navegador resolve

A conclusão anterior — coleta em runner self-hosted — durou pouco, porque a
medição estava incompleta. Faltava separar o que exatamente causa o 403:

| Requisição | Resposta |
|---|---|
| Sem `Referer` nem `Origin` | **200** |
| Com `Origin: https://example.com` | **200** |
| Com `Referer: https://example.com/` | **403** |

Não é só o IP: é o **`Referer`**. E o Sofascore devolve
`access-control-allow-origin: *`, ou seja, autoriza leitura por CORS.

Um navegador pode suprimir o `Referer` com `referrerPolicy: "no-referrer"`. E o
navegador de quem usa o site está num IP residencial. As duas metades da
checagem se resolvem de uma vez, do lado do cliente.

Medido num Chrome real, numa página hospedada em `example.com`:
**14 de 14 requisições, Séries A e B, rodadas 1 a 38, 141 eventos, em 4,5 s.**
Depois, no site em produção: as 76 rodadas das duas séries em **24 segundos**,
385 e 383 eventos — os mesmos números que o coletor Python obtém da API. Os
CSVs normalizados saíram idênticos pelos dois caminhos.

O ogol não serve por este caminho: não manda cabeçalho de CORS, então o
navegador não deixa ler a resposta. Não faz falta.

### 1.5 Consequência: quem coleta é o navegador

```
Você ou o Fred abrem o site      → Cloudflare Access autentica por e-mail
        ↓ aperta "Atualizar"
O NAVEGADOR busca as 76 rodadas no Sofascore          (~25 s)
        ↓ POST /api/coletar
O site guarda o JSON íntegro no KV, antes de qualquer normalização
        ↓ workflow_dispatch
GitHub Actions, em runner comum, lê o depósito e recalcula com o motor Python
        ↓
Dados versionados. O site mostra quando foi.
```

Não há runner self-hosted, não há dependência de máquina ligada, não há proxy
pago. O recálculo roda em runner hospedado pelo GitHub porque **não fala com o
Sofascore**: ele lê o depósito, que é alcançável de qualquer IP.

A regra do bruto continua valendo, só mudou de lugar: `/api/coletar` grava no
KV antes de fazer qualquer outra coisa, e só depois pede o recálculo.

O runner self-hosted foi desregistrado e o `coleta.yml` removido. O comando
`python -m bi atualizar` continua existindo para uso manual na máquina do
projeto, que é o caminho de contingência se o site sair do ar.

O que se perde: a coleta passa a depender de a máquina estar ligada. O que se
ganha: continua de graça e sem mudar uma linha do coletor. Um job agendado que
não encontra runner disponível fica na fila e roda quando a máquina voltar.

A alternativa que devolveria a independência da máquina é um proxy residencial
pago (~US$ 3/mês) injetado em `_obter`. Fica registrada, não implementada.

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
