/**
 * GET /api/estado — o que o site mostra: quando foi o último depósito de cada
 * série e em que pé está o recálculo. Junta na leitura as duas chaves que têm,
 * cada uma, um escritor só. Protegido pelo Access, como o resto do site.
 */
import { lerDeposito, lerRecalculo } from "./_estado.js";

export async function onRequestGet({ env }) {
  const [deposito, recalculo] = await Promise.all([
    lerDeposito(env),
    lerRecalculo(env),
  ]);
  return new Response(JSON.stringify({ ...deposito, recalculo }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
