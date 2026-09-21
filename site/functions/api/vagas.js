/**
 * GET/PUT /api/vagas — as fronteiras de vaga de cada série.
 *
 * Elas não são preferência de quem está olhando: são o regulamento daquele
 * ano. Se o 16º deixou de ser o último da permanência, isso vale para todo
 * mundo que abrir o card, em qualquer navegador — por isso ficam no KV, e não
 * no `localStorage`.
 *
 * Quem chega aqui já passou pelo Cloudflare Access, como no resto de `/api/*`.
 * O que se pode fazer com esta rota é mudar onde a cor da tabela troca; não há
 * dado de campeonato em jogo.
 */
const CHAVE = "config:vagas";

// Guarda-corpo do que pode ser gravado: série conhecida, nome de faixa curto e
// limite dentro de uma tabela. Um corpo maior que isso é engano ou abuso.
const SERIES = new Set(["A", "B"]);
const MAXIMO_FAIXAS = 8;

export async function onRequestGet({ env }) {
  const salvo = (await env.DEPOSITO.get(CHAVE, "json")) ?? {};
  return json(200, salvo);
}

export async function onRequestPut({ request, env }) {
  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return json(400, { erro: "corpo não é JSON válido" });
  }

  const limpo = {};
  for (const [serie, faixas] of Object.entries(corpo ?? {})) {
    if (!SERIES.has(serie) || typeof faixas !== "object" || !faixas) continue;
    const entradas = Object.entries(faixas).slice(0, MAXIMO_FAIXAS);
    limpo[serie] = Object.fromEntries(entradas
      .filter(([nome, valor]) =>
        /^[a-zA-Z]{1,24}$/.test(nome) && Number.isInteger(valor)
        && valor >= 1 && valor <= 40)
      .map(([nome, valor]) => [nome, valor]));
  }

  if (!Object.keys(limpo).length) {
    return json(400, { erro: "nenhuma faixa válida no corpo" });
  }

  // Grava a série inteira de uma vez, mas sem apagar a outra: quem mexeu na A
  // não devia derrubar o que estava salvo da B.
  const atual = (await env.DEPOSITO.get(CHAVE, "json")) ?? {};
  const novo = { ...atual, ...limpo, atualizado_em: new Date().toISOString() };
  await env.DEPOSITO.put(CHAVE, JSON.stringify(novo));
  return json(200, novo);
}

const json = (status, corpo) => new Response(JSON.stringify(corpo), {
  status,
  headers: { "content-type": "application/json; charset=utf-8",
             "cache-control": "no-store" },
});
