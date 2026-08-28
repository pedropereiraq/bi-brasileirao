/**
 * Estado compartilhado no KV.
 *
 * Regra que evita um bug já visto em produção: **uma chave, um escritor**.
 * Antes, `/api/coletar` e `/api/concluido` faziam leitura-modificação-escrita
 * no mesmo objeto, e um aviso de conclusão que chegasse antes de um depósito
 * era sobrescrito por ele — o site ficava eternamente em "pedido" e a pessoa
 * apertava o botão de novo achando que travara.
 *
 * Agora `/api/coletar` só escreve em `deposito`, `/api/concluido` só escreve em
 * `recalculo`, e `/api/estado` junta os dois na leitura.
 */

export const CHAVE_DEPOSITO = "estado:deposito";
export const CHAVE_RECALCULO = "estado:recalculo";

export async function lerDeposito(env) {
  return (await env.DEPOSITO.get(CHAVE_DEPOSITO, "json")) ?? {};
}

export async function lerRecalculo(env) {
  return (await env.DEPOSITO.get(CHAVE_RECALCULO, "json")) ?? null;
}

export async function gravarDeposito(env, deposito) {
  await env.DEPOSITO.put(CHAVE_DEPOSITO, JSON.stringify(deposito));
}

export async function gravarRecalculo(env, recalculo) {
  await env.DEPOSITO.put(CHAVE_RECALCULO, JSON.stringify(recalculo));
}
