/**
 * GET /api/estado — o que o site mostra: quando foi o último depósito, em que
 * pé está o recálculo. Protegido pelo Access, como o resto do site.
 */
export async function onRequestGet({ env }) {
  const estado = (await env.DEPOSITO.get("estado", "json")) ?? {};
  return new Response(JSON.stringify(estado), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
