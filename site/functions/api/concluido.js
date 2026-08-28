/**
 * POST /api/concluido — o recálculo avisa que terminou, e o botão para de
 * girar. Chamado pelo GitHub, então usa chave em vez do Access.
 *
 * O aviso traz o carimbo do pedido que o originou. Se, nesse meio-tempo,
 * alguém apertou o botão de novo, o pedido corrente é outro e este aviso está
 * velho — anunciar "concluído" nesse caso esconderia um recálculo em curso.
 */
import { lerRecalculo, gravarRecalculo } from "./_estado.js";

export async function onRequestPost({ request, env }) {
  if (!env.CHAVE || request.headers.get("x-chave") !== env.CHAVE) {
    return json(401, { erro: "chave ausente ou inválida" });
  }

  const corpo = await request.json().catch(() => ({}));
  const corrente = await lerRecalculo(env);

  if (corrente?.pedido_em && corpo.pedido_em && corrente.pedido_em !== corpo.pedido_em) {
    return json(200, {
      ignorado: "aviso de um pedido já superado por outro mais recente",
      corrente: corrente.pedido_em,
      recebido: corpo.pedido_em,
    });
  }

  await gravarRecalculo(env, {
    ...corrente,
    situacao: corpo.erro ? "falhou" : "concluído",
    em: new Date().toISOString(),
    ...corpo,
  });
  return json(200, { ok: true });
}

function json(status, corpo) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
