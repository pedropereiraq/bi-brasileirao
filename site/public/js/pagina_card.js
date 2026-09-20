/**
 * Esqueleto de uma página de card.
 *
 * O BI é um gerador de cards: cada página desenha **um** card. Fora do card
 * ficam os filtros que o determinam; dentro, nada além do card. Por isso o
 * canvas é o conteúdo da página, e não uma prévia escondida num diálogo — o
 * que se vê na tela é exatamente o PNG que vai ser salvo.
 *
 * A página fornece uma função que devolve o spec do card a partir do estado
 * atual dos filtros; este módulo cuida de redesenhar, de não redesenhar duas
 * vezes seguidas à toa, e de salvar.
 */
import { desenharSpec, CARD } from "/js/cartao.js";

const el = (id) => document.getElementById(id);

let montarSpec = null;
let canvas = null;
let desenhando = false;
let pendente = false;

/**
 * Liga a página. `fn` devolve o spec do card — ou `null` quando os filtros
 * ainda não dão um card válido (duas equipes iguais, por exemplo).
 */
export function ligarPaginaDeCard(fn) {
  montarSpec = fn;
  canvas = el("card");
  el("salvar")?.addEventListener("click", salvar);
  return redesenhar;
}

export async function redesenhar() {
  if (!montarSpec || !canvas) return;
  // Uma troca de filtro pode disparar várias chamadas seguidas; a última é a
  // que vale, e desenhar em cima de um desenho em andamento embaralharia o
  // canvas.
  if (desenhando) { pendente = true; return; }

  desenhando = true;
  const aviso = el("aviso-card");
  try {
    const spec = montarSpec();
    if (!spec) {
      canvas.hidden = true;
      if (aviso) { aviso.hidden = false; aviso.textContent = mensagemSemCard(); }
      return;
    }
    if (aviso) aviso.hidden = true;
    canvas.hidden = false;
    await desenharSpec(spec, canvas);
    el("salvar")?.removeAttribute("disabled");
  } catch (erro) {
    if (aviso) {
      aviso.hidden = false;
      aviso.textContent = `não foi possível desenhar o card: ${erro.message}`;
    }
    console.error(erro);
  } finally {
    desenhando = false;
    if (pendente) { pendente = false; redesenhar(); }
  }
}

let mensagem = "escolha os filtros para desenhar o card";
export function definirMensagemSemCard(texto) { mensagem = texto; }
const mensagemSemCard = () => mensagem;

async function salvar() {
  const botao = el("salvar");
  botao.disabled = true;
  try {
    const blob = await new Promise((ok) => canvas.toBlob(ok, "image/png"));
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeDoArquivo();
    link.click();
    // Revogar no mesmo instante cancelaria o download em alguns navegadores.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } finally {
    botao.disabled = false;
  }
}

function nomeDoArquivo() {
  const spec = montarSpec();
  const base = spec?.arquivo ?? spec?.titulo ?? "card";
  const limpo = base.normalize("NFD").replace(/\p{Mn}/gu, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${limpo}.png`;
}

export { CARD };
