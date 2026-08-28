/**
 * POST /api/concluido — o recálculo avisa que terminou, e o botão para de
 * girar. Chamado pelo GitHub, então usa chave em vez do Access.
 */
export async function onRequestPost({ request, env }) {
  if (!env.CHAVE || request.headers.get("x-chave") !== env.CHAVE) {
    return new Response(JSON.stringify({ erro: "chave ausente ou inválida" }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const corpo = await request.json().catch(() => ({}));
  const estado = (await env.DEPOSITO.get("estado", "json")) ?? {};
  estado.recalculo = {
    situacao: corpo.erro ? "falhou" : "concluído",
    em: new Date().toISOString(),
    ...corpo,
  };
  await env.DEPOSITO.put("estado", JSON.stringify(estado));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
