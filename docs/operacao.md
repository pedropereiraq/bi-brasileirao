# Operação

Como o sistema é operado no dia a dia, e o que fazer quando algo quebra.
Escrito em 29/08/2026.

---

## O caminho normal

Abrir **https://bi-brasileirao.pages.dev**, entrar com o e-mail cadastrado, e
apertar **Atualizar dados**. Deixar a aba aberta uns 25 segundos, até a barra
chegar ao fim. O recálculo continua sozinho depois disso — pode fechar a aba.

Quem coleta é o navegador. Quem recalcula é a nuvem do GitHub. Nenhuma máquina
precisa estar ligada além da de quem apertou.

---

## As peças e onde elas moram

| Peça | Onde | Para que serve |
|---|---|---|
| Site e funções de `/api` | Cloudflare Pages, projeto `bi-brasileirao` | página do botão e depósito |
| Depósito do JSON bruto | Cloudflare KV, namespace `DEPOSITO` | guarda o bruto antes de normalizar |
| Login | Cloudflare Access, team `spring-snow-35cf` | só os e-mails cadastrados entram |
| Recálculo | GitHub Actions, `recalculo.yml` | motor Python, em runner comum |

### Segredos, e de que lado ficam

| Nome | Onde está gravado | Para que |
|---|---|---|
| `CHAVE` | secret do Pages **e** secret `BI_NUVEM_CHAVE` do repositório | autentica o GitHub nas rotas `/api/bruto` e `/api/concluido` |
| `GITHUB_TOKEN` | secret do Pages | deixa o site disparar o recálculo |
| `BI_NUVEM_URL` | variável do repositório | endereço do site, para o recálculo saber onde ler |

**`CHAVE` tem de ser idêntica dos dois lados.** Trocar num só quebra o recálculo
com 401.

### As duas aplicações do Access

Uma tranca o site; a outra libera as rotas que o GitHub usa, porque um runner
não tem como fazer login por e-mail.

| Aplicação | Destino | Política |
|---|---|---|
| `BI Brasileirão` | `bi-brasileirao.pages.dev`, sem path | **Allow** → Emails |
| `BI Brasileirão — rotas de máquina` | mesmo domínio, paths `api/bruto` e `api/concluido` | **Bypass** → Everyone |

O Access resolve pelo caminho mais específico, então a segunda vence nas duas
rotas mesmo com a primeira por cima. As rotas liberadas não ficam abertas: elas
exigem o cabeçalho `x-chave`.

> **Cuidado ao cadastrar destino.** O campo *Domain* já contém
> `bi-brasileirao.pages.dev` inteiro. Preencher *Subdomain* também produz
> `bi-brasileirao.bi-brasileirao.pages.dev`, que não existe — e o site fica
> aberto sem dar nenhum sinal. Deixe *Subdomain* vazio.

---

## Dar acesso a mais alguém

Zero Trust → `Access controls` → `Applications` → **BI Brasileirão** → a policy
**Eu** → acrescentar o e-mail em *Include → Emails*. A pessoa recebe um código
por e-mail no primeiro acesso. Até 50 pessoas no plano gratuito.

---

## Trocar o `GITHUB_TOKEN`

Necessário quando o token vence, ou sempre que ele for exposto.

1. [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens)
   → **Delete** no token antigo (para token fine-grained, apagar é revogar).
2. **Generate new token**: *Only select repositories* → `bi-brasileirao`;
   permissão **Actions: Read and write**; `Metadata: Read-only` entra sozinho.
3. Gravar o valor no Pages, pelo painel:
   **Compute → Workers & Pages → bi-brasileirao → Settings → Variables and
   Secrets → Add**, nome `GITHUB_TOKEN`, tipo **Secret**.
4. Republicar, senão o valor novo não vale:
   `cd site && npx wrangler pages deploy`
5. Conferir apertando o botão no site.

> **Pelo terminal, a sintaxe engana.** `wrangler pages secret put GITHUB_TOKEN`
> espera o **nome** no comando e pede o **valor** num prompt depois. Colar o
> token no lugar do nome grava o token *como nome de secret* — e nome de secret
> não é criptografado, aparece em texto puro na listagem e no painel. Já
> aconteceu duas vezes aqui. Pelo painel os campos são rotulados e não há como
> errar.

---

## Quando algo quebra

**O botão diz 403.** A conexão de quem apertou está sendo recusada pela fonte.
VPN corporativa e rede de datacenter causam isso. Tentar de uma conexão
doméstica.

**O site fica em "pedido" e não sai.** O recálculo não partiu ou não avisou.
Olhar as execuções em
[Actions](https://github.com/pedropereiraq/bi-brasileirao/actions). Se não há
execução nenhuma, o `GITHUB_TOKEN` provavelmente venceu — ver acima.

**O recálculo falha com 401.** A `CHAVE` está diferente entre o Pages e o
repositório. Regravar as duas com o mesmo valor.

**A fonte mudou de formato.** Os snapshots brutos estão versionados em
`dados/bruto/sofascore/`. Nada do que já foi coletado se perde: corrige-se o
`normalizar()` e roda `python -m bi construir` de novo.

**O site saiu do ar.** A coleta continua possível da máquina do projeto, que tem
IP residencial: `python -m bi atualizar`.

**Medir o que ainda responde**, de onde quer que seja:
`python -m ferramentas.diagnostico_fontes`

---

## O que checar de tempos em tempos

- **Validade do `GITHUB_TOKEN`: vence em 26/11/2026.** Quando vencer, o botão
  vai continuar coletando e guardando, mas o recálculo não dispara — e a falha
  é silenciosa: o site fica em "pedido" e nada acontece. Renovar antes disso.
- **Virada de ano.** A partir de 1º de janeiro o site pede o ano novo. Se a
  temporada ainda não foi publicada pela fonte, a coleta falha até publicarem.
  Os ids conhecidos ficam em `bi/config.py`, em `TEMPORADAS`.
- **Clubes novos.** Todo ano sobem e descem times. `fontes/de_para_clubes.csv`
  precisa das 40 equipes da temporada; a coleta para com erro nomeando quem
  falta.
