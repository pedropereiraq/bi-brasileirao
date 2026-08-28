/**
 * Proxy mínimo em Cloudflare Workers, para testar se o egresso da Cloudflare é
 * aceito pelas fontes que bloqueiam IP de datacenter.
 *
 * Hipótese sob teste: Sofascore e ogol recusam o IP do runner do GitHub. Um
 * Worker faz a requisição de dentro da rede da Cloudflare, que é onde as duas
 * fontes estão hospedadas — talvez esse egresso seja tratado de outro jeito.
 *
 * Ressalva conhecida antes do teste: o Worker não controla a assinatura TLS da
 * requisição de saída, e já se sabe que as fontes recusam assinatura que não
 * seja de navegador mesmo vindo de um IP aceito. Se o bloqueio for pelas duas
 * coisas, isto aqui não passa. É o que o teste vai dizer.
 *
 * Uso:
 *   GET https://<worker>.workers.dev/?alvo=<url encodada>
 *   cabeçalho obrigatório: x-chave: <segredo>
 *
 * A lista de hosts permitidos existe para que isto nunca vire um proxy aberto.
 */

const HOSTS_PERMITIDOS = new Set([
  "api.sofascore.com",
  "www.sofascore.com",
  "www.ogol.com.br",
]);

const CABECALHOS_NAVEGADOR = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  Referer: "https://www.sofascore.com/",
};

export default {
  async fetch(requisicao, ambiente) {
    if (requisicao.headers.get("x-chave") !== ambiente.CHAVE) {
      return responder(401, { erro: "chave ausente ou inválida" });
    }

    const alvo = new URL(requisicao.url).searchParams.get("alvo");
    if (!alvo) {
      return responder(400, { erro: "faltou o parâmetro alvo" });
    }

    let destino;
    try {
      destino = new URL(alvo);
    } catch {
      return responder(400, { erro: "alvo não é uma URL válida" });
    }
    if (!HOSTS_PERMITIDOS.has(destino.hostname)) {
      return responder(403, {
        erro: "host não permitido",
        host: destino.hostname,
        permitidos: [...HOSTS_PERMITIDOS],
      });
    }

    const resposta = await fetch(destino.toString(), {
      headers: CABECALHOS_NAVEGADOR,
      redirect: "follow",
    });

    // O status da origem é repassado como cabeçalho para não se confundir com o
    // status do próprio proxy — é ele que diz se a hipótese se sustenta.
    const corpo = await resposta.arrayBuffer();
    return new Response(corpo, {
      status: resposta.status,
      headers: {
        "content-type":
          resposta.headers.get("content-type") ?? "application/octet-stream",
        "x-status-origem": String(resposta.status),
      },
    });
  },
};

function responder(status, corpo) {
  return new Response(JSON.stringify(corpo, null, 1), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
