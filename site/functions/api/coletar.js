/**
 * POST /api/coletar
 *
 * Recebe o JSON bruto que o navegador acabou de buscar no Sofascore, guarda no
 * KV **antes de qualquer outra coisa** e só então pede o recálculo ao GitHub.
 * A ordem é a mesma regra que vale no coletor Python: o bruto é gravado antes
 * de ser interpretado, para que uma falha adiante nunca apague o que já foi
 * coletado.
 *
 * Quem chega aqui já passou pelo Cloudflare Access — a proteção do site inteiro
 * vale para /api/* também. Não há autenticação própria nesta rota de propósito:
 * duplicá-la daria a falsa impressão de que o Access pode ser dispensado.
 */

const SERIES = new Set(["A", "B"]);
const MAXIMO_EVENTOS = 1000; // uma edição tem ~385; folga sem virar depósito de lixo

export async function onRequestPost({ request, env }) {
  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return erro(400, "corpo não é JSON válido");
  }

  const { serie, ano, eventos } = corpo ?? {};
  if (!SERIES.has(serie)) return erro(400, `série inválida: ${serie}`);
  if (!Number.isInteger(ano) || ano < 2006 || ano > 2100) {
    return erro(400, `ano inválido: ${ano}`);
  }
  if (!Array.isArray(eventos) || eventos.length === 0) {
    return erro(400, "nenhum evento recebido");
  }
  if (eventos.length > MAXIMO_EVENTOS) {
    return erro(400, `${eventos.length} eventos é mais do que uma edição tem`);
  }
  // Conferência de forma: se o Sofascore mudar o contrato, o erro aparece aqui
  // e não seis etapas adiante, no motor.
  const primeiro = eventos[0];
  if (!primeiro?.id || !primeiro?.homeTeam?.id || !primeiro?.startTimestamp) {
    return erro(400, "os eventos não têm o formato esperado da fonte");
  }

  const agora = new Date().toISOString();
  const chave = `bruto:${serie}:${ano}`;

  // 1. Guardar o bruto. Nada acontece antes disto.
  await env.DEPOSITO.put(chave, JSON.stringify(eventos), {
    metadata: { depositado_em: agora, eventos: eventos.length },
  });

  // 2. Registrar o estado, para o site saber o que mostrar.
  const estado = (await env.DEPOSITO.get("estado", "json")) ?? {};
  estado[`${serie}:${ano}`] = { depositado_em: agora, eventos: eventos.length };
  estado.ultimo_deposito = agora;
  estado.recalculo = { situacao: "pedido", em: agora };
  await env.DEPOSITO.put("estado", JSON.stringify(estado));

  // 3. Pedir o recálculo. Se falhar, o bruto continua guardado e um novo
  //    pedido (ou o próprio GitHub) resolve depois — por isso não é fatal.
  let recalculo = "não pedido";
  try {
    recalculo = await pedirRecalculo(env, ano);
  } catch (e) {
    recalculo = `falhou: ${e.message}`;
  }

  return json(200, { guardado: eventos.length, em: agora, recalculo });
}

async function pedirRecalculo(env, ano) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    return "sem GITHUB_TOKEN/GITHUB_REPO configurados";
  }
  const resposta = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/recalculo.yml/dispatches`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.GITHUB_TOKEN}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
        "user-agent": "bi-brasileirao-site",
      },
      body: JSON.stringify({ ref: "main", inputs: { ano: String(ano) } }),
    }
  );
  if (resposta.status === 204) return "pedido";
  const detalhe = await resposta.text();
  throw new Error(`HTTP ${resposta.status} ${detalhe.slice(0, 120)}`);
}

function json(status, corpo) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function erro(status, mensagem) {
  return json(status, { erro: mensagem });
}
