# Proxy de teste em Cloudflare Workers

Existe para responder **uma** pergunta: o egresso da Cloudflare passa pelo
bloqueio de IP do Sofascore e do ogol, que recusam o runner do GitHub?

## Como deployar

```
npx wrangler login            # interativo, abre o navegador
npx wrangler deploy           # dentro desta pasta
npx wrangler secret put CHAVE # cola o segredo compartilhado
```

## Como testar

```
python -m ferramentas.diagnostico_fontes
```

O diagnóstico usa a URL do worker e a chave nas variáveis de ambiente
`BI_PROXY_URL` e `BI_PROXY_CHAVE`. Sem elas, o teste do proxy é pulado.

## Se funcionar

O coletor passa a rotear por aqui quando `BI_PROXY_URL` estiver definida, a
chave vira secret do repositório no GitHub e a coleta volta para a nuvem.

## Se não funcionar

Apagar a pasta e o worker (`npx wrangler delete`). A coleta roda em runner
self-hosted na máquina do projeto.
