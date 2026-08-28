/**
 * GET /api/bruto?serie=A&ano=2026
 *
 * Devolve o último bruto depositado. Quem chama é o recálculo, rodando em
 * runner comum do GitHub — que não passa pelo Cloudflare Access. Daí esta rota
 * ter chave própria, ao contrário de /api/coletar.
 */
export async function onRequestGet({ request, env }) {
  if (!env.CHAVE || request.headers.get("x-chave") !== env.CHAVE) {
    return resposta(401, { erro: "chave ausente ou inválida" });
  }

  const parametros = new URL(request.url).searchParams;
  const serie = parametros.get("serie");
  const ano = parametros.get("ano");
  if (!["A", "B"].includes(serie) || !/^\d{4}$/.test(ano ?? "")) {
    return resposta(400, { erro: "parâmetros serie e ano são obrigatórios" });
  }

  const bruto = await env.DEPOSITO.get(`bruto:${serie}:${ano}`);
  if (bruto === null) {
    return resposta(404, { erro: `nada depositado para ${serie} ${ano}` });
  }
  // Repassado como veio: este endpoint não interpreta nada.
  return new Response(bruto, {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function resposta(status, corpo) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
