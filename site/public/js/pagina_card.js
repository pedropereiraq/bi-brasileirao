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
import { aoMudarMarca } from "/js/marca.js";

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
  // Trocar a marca troca a paleta do card: o que está na tela precisa sair
  // vestido de novo, sem o usuário ter de mexer em nenhum filtro.
  aoMudarMarca(() => redesenhar());
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
    palco.addEventListener("click", aoClicar);
  }
  hoverAtual = geometria;
  // Cursor de mão só quando há o que clicar: um card que só mostra dica não
  // deve prometer clique.
  palco.classList.toggle("clicavel", Boolean(geometria.aoClicar));

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

    // Três modos. `caixa` é para gráficos feitos de retângulos — os
    // cartõezinhos de uma campanha —, em que o alvo não é o mais próximo num
    // eixo e sim aquele sob o cursor.
    if (g.eixo === "caixa") return sobreCaixa(g, x, y, recuoX, recuoY, escalaTela);

    // Um gráfico deitado — as 20 posições empilhadas, o 1º no alto — se lê
    // pelo eixo vertical: quem está perto do cursor é a linha, não a coluna.
    const deitado = g.eixo === "y";

    // Fora da área do gráfico não há o que mostrar.
    const foraNoEixo = deitado
      ? y < g.topo - g.largura || y > g.topo + g.alturaPlot + g.largura
      : x < g.x0 - g.largura || x > g.x1 + g.largura;
    const foraNoOutro = deitado
      ? x < g.x0 - 20 || x > g.x1 + 20
      : y < g.topo - 20 || y > g.topo + g.alturaPlot + 20;
    if (foraNoEixo || foraNoOutro) return esconder();

    const distancia = (p) => Math.abs((deitado ? p.y : p.x) - (deitado ? y : x));
    const ponto = g.pontos.reduce(
      (melhor, p) => (distancia(p) < distancia(melhor) ? p : melhor), g.pontos[0]);
    if (distancia(ponto) > g.largura) return esconder();

    guia.style.display = "block";
    guia.style.background = "var(--azul-claro)";
    guia.style.border = "0";
    dica.innerHTML = conteudoDaDica(ponto, g);
    dica.style.display = "block";
    const larguraDica = dica.offsetWidth;

    if (deitado) {
      const cima = recuoY + ponto.y * escalaTela;
      guia.style.left = `${recuoX + g.x0 * escalaTela}px`;
      guia.style.top = `${cima}px`;
      guia.style.width = `${(g.x1 - g.x0) * escalaTela}px`;
      guia.style.height = "2px";
      guia.style.transform = "translateY(-1px)";

      const depois = recuoX + (g.x1 + 14) * escalaTela;
      const cabe = depois + larguraDica + 14 < recuoX + caixa.width;
      dica.style.left = `${cabe ? depois
        : recuoX + g.x0 * escalaTela - larguraDica - 14}px`;
      dica.style.top = `${Math.max(recuoY, cima - dica.offsetHeight / 2)}px`;
      return;
    }

    const esquerda = recuoX + ponto.x * escalaTela;
    guia.style.left = `${esquerda}px`;
    guia.style.top = `${recuoY + g.topo * escalaTela}px`;
    guia.style.width = "2px";
    guia.style.height = `${g.alturaPlot * escalaTela}px`;
    guia.style.transform = "translateX(-1px)";

    // Vira para a esquerda quando está perto da borda direita do canvas.
    const paraEsquerda = esquerda + larguraDica + 24 > recuoX + caixa.width;
    dica.style.left = `${esquerda + (paraEsquerda ? -larguraDica - 14 : 14)}px`;
    dica.style.top = `${recuoY + (g.topo + 10) * escalaTela}px`;
  }

  /** Alvo é o retângulo sob o cursor; a guia vira o contorno dele. */
  function sobreCaixa(g, x, y, recuoX, recuoY, escalaTela) {
    const alvo = g.pontos.find((p) =>
      x >= p.x && x <= p.x + p.l && y >= p.y && y <= p.y + p.a);
    if (!alvo) return esconder();

    guia.style.display = "block";
    guia.style.background = "transparent";
    guia.style.border = "2px solid var(--azul-escuro)";
    guia.style.borderRadius = "7px";
    guia.style.transform = "none";
    guia.style.left = `${recuoX + (alvo.x - 2) * escalaTela}px`;
    guia.style.top = `${recuoY + (alvo.y - 2) * escalaTela}px`;
    guia.style.width = `${(alvo.l + 4) * escalaTela}px`;
    guia.style.height = `${(alvo.a + 4) * escalaTela}px`;

    dica.innerHTML = conteudoDaDica(alvo, g);
    dica.style.display = "block";

    // Ao lado do **cursor**, e não da caixa. Numa linha que atravessa o card
    // inteiro — uma edição da lista de recortes —, "ao lado da caixa" é fora
    // da tela, e a dica sumia encostada na borda esquerda.
    const molduraCanvas = canvas.getBoundingClientRect();
    const larguraDica = dica.offsetWidth, alturaDica = dica.offsetHeight;
    const cursorX = recuoX + x * escalaTela;
    const cursorY = recuoY + y * escalaTela;

    let esquerda = cursorX + 18;
    if (esquerda + larguraDica > recuoX + molduraCanvas.width) {
      esquerda = cursorX - 18 - larguraDica;
    }
    dica.style.left = `${limitar(esquerda, recuoX,
                                 recuoX + molduraCanvas.width - larguraDica)}px`;
    dica.style.top = `${limitar(cursorY - alturaDica / 2, recuoY,
                                recuoY + molduraCanvas.height - alturaDica)}px`;
  }

  const limitar = (valor, minimo, maximo) =>
    Math.min(Math.max(valor, minimo), Math.max(minimo, maximo));

  /** O clique só existe em gráficos feitos de retângulos. */
  function aoClicar(evento) {
    const g = hoverAtual;
    if (!g?.aoClicar || g.eixo !== "caixa") return;
    const caixa = canvas.getBoundingClientRect();
    const escalaTela = caixa.width / CARD.largura;
    const x = (evento.clientX - caixa.left) / escalaTela;
    const y = (evento.clientY - caixa.top) / escalaTela;
    const alvo = g.pontos.find((ponto) =>
      x >= ponto.x && x <= ponto.x + ponto.l
      && y >= ponto.y && y <= ponto.y + ponto.a);
    if (alvo) g.aoClicar(alvo);
  }

  function esconder() {
    if (guia) guia.style.display = "none";
    if (dica) dica.style.display = "none";
  }
}

/**
 * O conteúdo da dica.
 *
 * `pontos` é o caso comum e sai com a unidade pronta — quase todo card do BI
 * fala de pontos. Quando o número é outra coisa (gols, jogos, gols por jogo),
 * o card manda `texto` já escrito, com a unidade dele.
 */
/**
 * Um gráfico de barras dentro da dica.
 *
 * Três números resumem uma distribuição; a forma dela é outra coisa — se as
 * campanhas se apertam em torno da média ou se espalham. Cabe numa fileira de
 * barrinhas, e só existe na tela: a dica nunca entra no PNG.
 */
function faixasDaDica(faixas) {
  if (!faixas?.barras?.length) return "";
  const maior = Math.max(...faixas.barras.map((b) => b.quantidade), 1);
  const barras = faixas.barras.map((b) => `
    <i style="height:${Math.round((b.quantidade / maior) * 100)}%"
       title="${b.rotulo}: ${b.quantidade}"></i>`).join("");
  const pontas = `<span>${faixas.barras[0].rotulo}</span>`
               + `<span>${faixas.barras[faixas.barras.length - 1].rotulo}</span>`;
  return `<div class="dica-faixas">
      <div class="dica-faixas-titulo">${faixas.titulo ?? ""}</div>
      <div class="dica-spark">${barras}</div>
      <div class="dica-faixas-pontas">${pontas}</div>
    </div>`;
}

function conteudoDaDica(ponto, g) {
  const linhas = ponto.itens.map((item) => `
    <div class="dica-time">
      <span class="dica-marca" style="background:${item.cor}"></span>
      <span class="dica-nome">${item.rotulo}</span>
      <span class="dica-pts">${item.texto
        ?? (item.pontos === null ? "—" : item.pontos + " pts")}</span>
      <span class="dica-detalhe">${item.detalhe}</span>
    </div>`).join("");

  // `rotulo` dá o destaque pronto, para o que não se mede em pontos — uma
  // variação percentual, por exemplo. Sem ele, continua o formato antigo.
  const d = ponto.diferenca;
  const diferenca = !d ? ""
    : `<div class="dica-diferenca">${
        d.rotulo
          ? `<b style="color:${d.cor}">${d.rotulo}</b>`
            + (d.texto ? ` · ${d.texto}` : "")
          : d.valor === 0
            ? "campanhas empatadas"
            : `<b style="color:${d.cor}">${d.valor} `
              + `${d.valor === 1 ? "ponto" : "pontos"}</b> · ${d.texto}`
      }</div>`;

  // Sem unidade — numa lista de anos, o ano já é o título — não sobra espaço
  // em branco antes do número.
  const titulo = [g.unidade, ponto.n].filter(Boolean).join(" ");
  return `<div class="dica-titulo">${titulo}</div>${linhas}`
       + `${faixasDaDica(ponto.faixas)}${diferenca}`;
}
