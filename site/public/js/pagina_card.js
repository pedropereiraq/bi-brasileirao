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
    ligarHover(spec.hover);
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


/* ----------------------------------------------------------------- hover
 *
 * O card é um canvas, então passar o mouse não tem alvo nenhum para acertar.
 * A página recebe do card a geometria do gráfico — em coordenadas da régua de
 * 1600×900 — e converte a posição do mouse de volta para um jogo.
 *
 * A dica e a guia são HTML por cima do canvas, e não desenho no canvas: são
 * recurso de tela e não podem entrar no PNG que se salva.
 */
let hoverAtual = null;

function ligarHover(geometria) {
  const palco = canvas.parentElement;
  let dica = palco.querySelector(".dica-card");
  let guia = palco.querySelector(".guia-card");

  if (!geometria?.pontos?.length) {
    dica?.remove();
    guia?.remove();
    hoverAtual = null;
    return;
  }

  if (!dica) {
    palco.style.position = "relative";
    guia = Object.assign(document.createElement("div"), { className: "guia-card" });
    dica = Object.assign(document.createElement("div"), { className: "dica-card" });
    palco.append(guia, dica);
    palco.addEventListener("pointermove", aoMover);
    palco.addEventListener("pointerleave", esconder);
  }
  hoverAtual = geometria;

  function aoMover(evento) {
    const g = hoverAtual;
    if (!g) return;
    const caixa = canvas.getBoundingClientRect();
    const escalaTela = caixa.width / CARD.largura;
    const x = (evento.clientX - caixa.left) / escalaTela;
    const y = (evento.clientY - caixa.top) / escalaTela;

    // A dica e a guia são posicionadas dentro do palco, mas o canvas não
    // começa na borda dele — o palco tem recuo e centraliza o card. Sem somar
    // esse deslocamento, a guia saía à esquerda dos pontos, caindo no vão
    // entre um jogo e outro.
    // `left` conta a partir da caixa de preenchimento, de dentro da borda:
    // por isso o desconto de clientLeft/clientTop.
    const moldura = palco.getBoundingClientRect();
    const recuoX = caixa.left - moldura.left - palco.clientLeft;
    const recuoY = caixa.top - moldura.top - palco.clientTop;

    // Fora da área do gráfico não há o que mostrar.
    if (y < g.topo - 20 || y > g.topo + g.alturaPlot + 20
        || x < g.x0 - g.largura || x > g.x1 + g.largura) return esconder();

    const ponto = g.pontos.reduce(
      (melhor, p) => (Math.abs(p.x - x) < Math.abs(melhor.x - x) ? p : melhor),
      g.pontos[0]);
    if (Math.abs(ponto.x - x) > g.largura) return esconder();

    const esquerda = recuoX + ponto.x * escalaTela;
    guia.style.display = "block";
    guia.style.left = `${esquerda}px`;
    guia.style.top = `${recuoY + g.topo * escalaTela}px`;
    guia.style.height = `${g.alturaPlot * escalaTela}px`;

    dica.innerHTML = conteudoDaDica(ponto, g);
    dica.style.display = "block";
    // Vira para a esquerda quando está perto da borda direita do canvas.
    const larguraDica = dica.offsetWidth;
    const paraEsquerda = esquerda + larguraDica + 24 > recuoX + caixa.width;
    dica.style.left = `${esquerda + (paraEsquerda ? -larguraDica - 14 : 14)}px`;
    dica.style.top = `${recuoY + (g.topo + 10) * escalaTela}px`;
  }

  function esconder() {
    if (guia) guia.style.display = "none";
    if (dica) dica.style.display = "none";
  }
}

function conteudoDaDica(ponto, g) {
  const linhas = ponto.itens.map((item) => `
    <div class="dica-time">
      <span class="dica-marca" style="background:${item.cor}"></span>
      <span class="dica-nome">${item.rotulo}</span>
      <span class="dica-pts">${item.pontos === null ? "—" : item.pontos + " pts"}</span>
      <span class="dica-detalhe">${item.detalhe}</span>
    </div>`).join("");

  const diferenca = ponto.diferenca
    ? `<div class="dica-diferenca">${ponto.diferenca.valor === 0
        ? "campanhas empatadas"
        : `<b style="color:${ponto.diferenca.cor}">${ponto.diferenca.valor} `
          + `${ponto.diferenca.valor === 1 ? "ponto" : "pontos"}</b> · `
          + ponto.diferenca.texto}</div>`
    : "";

  return `<div class="dica-titulo">${g.unidade} ${ponto.n}</div>${linhas}${diferenca}`;
}
