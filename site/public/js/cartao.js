/**
 * Gera o card do ECBahia Números a partir do que está na tela.
 *
 * Segue a anatomia da skill dos cards: régua de trabalho 1600×900, exportado em
 * **2400×1350**; fundo offwhite, nunca branco puro e nunca preto; título em
 * Bree Serif azul; a régua azul/vermelho/cinza logo abaixo do cabeçalho; faixa
 * de 3 a 5 caixas de números com a manchete em azul cheio; marca no canto
 * superior direito com 250px na régua de 1600; rodapé com a nota de
 * metodologia à esquerda e a assinatura à direita.
 *
 * Vocabulário e cores mudam com a marca. No ECBahia é **triunfo** (nunca
 * "vitória"), azul para triunfo, cinza para empate, vermelho para derrota. No
 * Podcast45 é **vitória** (nunca "triunfo"), e o trio é verde, cinza e
 * vermelho — a palavra certa está em `marcaAtual().triunfo`, e as cores saem
 * de `COR.positivo` e `COR.negativo`.
 *
 * Com a marca do Podcast45 o fundo continua o mesmo offwhite, e o que troca é
 * o par da identidade: onde o ECBahia usa azul e vermelho, o 45 usa preto e
 * dourado. O trio de resultado acompanha — azul, cinza e vermelho viram preto,
 * cinza e dourado.
 *
 * Verde tem hora para aparecer: só quando o card contrapõe um positivo a um
 * negativo. Por isso existem `positivo` e `negativo` além de `azul` e
 * `vermelho` — uma linha azul que era só identidade continua sendo
 * identidade, e vira preta, em vez de virar verde sem ter oposto nenhum.
 *
 * O que NÃO vem da skill é a regra do holofote no Bahia. Lá o card fala de um
 * clube; aqui é a tabela de um campeonato, e puxar o recorte para um clube
 * distorceria o que está sendo mostrado. A leitura é neutra.
 *
 * Desenhado em canvas, e não em HTML: canvas exporta PNG direto no navegador.
 * Por isso os escudos precisam ser servidos pelo próprio site — imagem de outra
 * origem contamina o canvas e bloqueia a exportação.
 */

import { marcaAtual, marcaEscolhida } from "/js/marca.js";

export const CARD = { largura: 1600, altura: 900, escala: 1.5 };

/**
 * As duas paletas, chave por chave.
 *
 * Os nomes são os do ECBahia porque foi de lá que vieram, mas o que vale é o
 * papel de cada um: `azul` é o lado bom, `vermelho` o ruim, `azulEscuro` o
 * texto mais forte, `branco` o que se escreve em cima de um preenchimento
 * colorido (e também a superfície elevada), `marca` a cor da assinatura.
 *
 * No Podcast45 tudo isso vira o negativo de si: `branco` é quase preto porque
 * é sobre dourado e verde que ele vai ser escrito, e `azulEscuro` é creme
 * porque é o texto que precisa saltar do fundo.
 */
const PALETAS = {
  ecbahia: {
    fundo: "#F4F2ED",
    branco: "#FFFFFF",
    marca: "#0B5394",
    marcaTexto: "#FFFFFF",
    marcaSuave: "#A9C7E2",
    azul: "#0B5394",
    azulEscuro: "#073763",
    azulMedio: "#3D7EB8",
    azulClaro: "#A9C7E2",
    azulLavado: "#E2EBF4",
    vermelho: "#CC4125",
    vermelhoLavado: "#F5E3DE",
    // O verde não está na identidade porque nenhum card precisava dele até a
    // régua por posição. Sai da mesma paleta de onde vieram o azul e o
    // vermelho do ECBahia, para não destoar.
    verde: "#6AA84F",
    verdeEscuro: "#38761D",
    verdeLavado: "#E6EFE1",
    cinza: "#CCCCCC",
    cinzaEscuro: "#8A8A8A",
    cinzaTexto: "#5C5C5C",
    cinzaClaro: "#E4E1DB",
    linha: "#DBD8D2",
    rampaBaixo: "#E7E4DE",
    rampaAlto: "#7EAFD8",
    // O par de um contraste positivo/negativo. No ECBahia ele é o próprio
    // azul contra o vermelho: o azul já é o lado bom em toda a identidade.
    positivo: "#0B5394",
    negativo: "#CC4125",
  },
  podcast45: {
    // O fundo é o mesmo do ECBahia: o que muda é o par da identidade.
    fundo: "#F4F2ED",
    branco: "#FFFFFF",
    // Preto morno, e não preto puro: é o preto do selo do canal, e o preto
    // de verdade deixaria o dourado ao lado dele parecendo sujo.
    marca: "#1F1B16",
    marcaTexto: "#F6F1E6",
    marcaSuave: "#C7BFAF",
    azul: "#1F1B16",
    azulEscuro: "#14110D",
    azulMedio: "#4A443B",
    azulClaro: "#C7BFAF",
    azulLavado: "#EAE6DD",
    // O dourado escurece para virar tinta: o ouro do selo brilha sobre preto
    // e some sobre offwhite.
    vermelho: "#B8912F",
    vermelhoLavado: "#F6EEDB",
    verde: "#6AA84F",
    verdeEscuro: "#38761D",
    verdeLavado: "#E6EFE1",
    cinza: "#CCCCCC",
    cinzaEscuro: "#8A8A8A",
    cinzaTexto: "#5C5C5C",
    cinzaClaro: "#E4E1DB",
    linha: "#DBD8D2",
    rampaBaixo: "#EDE9DF",
    rampaAlto: "#C9A94F",
    // Aqui o preto é identidade, não elogio: o positivo precisa de cor
    // própria. Verde um tom abaixo do da paleta, para o número branco em
    // cima dele continuar legível.
    positivo: "#58913F",
    negativo: "#CC4125",
  },
};

const COR = { ...PALETAS.ecbahia };

/** Troca a paleta no lugar: quem guardou `COR` continua com o objeto certo. */
function vestirPaleta(nome) {
  Object.assign(COR, PALETAS[nome] ?? PALETAS.ecbahia);
}

const MARGEM = 56;
const imagens = new Map();

/* ------------------------------------------------------------ pincéis */
function texto(ctx, conteudo, x, y, {
  tamanho = 18, peso = 400, cor = COR.cinzaTexto, familia = "Assistant",
  alinha = "left", maiuscula = false, espaco = 0,
} = {}) {
  ctx.save();
  ctx.font = `${peso} ${tamanho}px "${familia}", sans-serif`;
  ctx.fillStyle = cor;
  ctx.textAlign = alinha;
  ctx.textBaseline = "alphabetic";
  const t = maiuscula ? String(conteudo).toUpperCase() : String(conteudo);
  if (espaco) {
    // Canvas não tem letter-spacing em todo navegador; desenha letra a letra.
    let largura = 0;
    for (const c of t) largura += ctx.measureText(c).width + espaco;
    let cx = alinha === "right" ? x - largura : alinha === "center" ? x - largura / 2 : x;
    ctx.textAlign = "left";
    for (const c of t) { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + espaco; }
  } else {
    ctx.fillText(t, x, y);
  }
  ctx.restore();
}

function caixa(ctx, x, y, l, a, cor, raio = 6) {
  ctx.save();
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.roundRect(x, y, l, a, raio);
  ctx.fill();
  ctx.restore();
}

function linhaH(ctx, x1, x2, y, cor = COR.linha, espessura = 1) {
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.lineWidth = espessura;
  ctx.beginPath();
  ctx.moveTo(x1, y + .5);
  ctx.lineTo(x2, y + .5);
  ctx.stroke();
  ctx.restore();
}

function cortar(ctx, t, limite, tamanho, peso = 400) {
  ctx.save();
  ctx.font = `${peso} ${tamanho}px "Assistant", sans-serif`;
  let saida = t;
  while (saida.length > 3 && ctx.measureText(saida).width > limite) {
    saida = saida.slice(0, -1);
  }
  ctx.restore();
  return saida === t ? t : saida.trimEnd() + "…";
}

async function imagem(url) {
  if (!url) return null;
  if (imagens.has(url)) return imagens.get(url);
  const promessa = new Promise((ok) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => ok(null);
    im.src = url;
  });
  imagens.set(url, promessa);
  return promessa;
}

function desenharEscudo(ctx, im, x, y, tamanho) {
  if (!im) return;
  const proporcao = im.naturalWidth / im.naturalHeight || 1;
  const l = proporcao >= 1 ? tamanho : tamanho * proporcao;
  const a = proporcao >= 1 ? tamanho / proporcao : tamanho;
  ctx.drawImage(im, x + (tamanho - l) / 2, y + (tamanho - a) / 2, l, a);
}

/* --------------------------------------------------------- esqueleto */
async function moldura(ctx, { titulo, subtitulo, numeros, nota, escudo }) {
  ctx.fillStyle = COR.fundo;
  ctx.fillRect(0, 0, CARD.largura, CARD.altura);

  // Marca no canto superior direito, alinhada ao topo do título. A largura
  // vem da marca: o logotipo deitado do ECBahia ocupa os 250px da skill, o
  // selo redondo do Podcast45 desceria até a régua com a mesma medida.
  const assinatura = marcaAtual();
  const marca = await imagem(assinatura.logo);
  if (marca) {
    const l = assinatura.larguraNoCard;
    const a = l * (marca.naturalHeight / marca.naturalWidth);
    ctx.drawImage(marca, CARD.largura - MARGEM - l, assinatura.topoNoCard, l, a);
  }

  let x = MARGEM;
  if (escudo) {
    const im = await imagem(escudo);
    if (im) { desenharEscudo(ctx, im, x, 34, 58); x += 74; }
  }

  // O título agora carrega a frase inteira e varia muito de comprimento;
  // encolhe até caber em vez de invadir a marca.
  const limite = CARD.largura - MARGEM - assinatura.larguraNoCard - 28 - x;
  let corpoTitulo = 42;
  ctx.save();
  for (; corpoTitulo > 26; corpoTitulo -= 1) {
    ctx.font = `700 ${corpoTitulo}px "Bree Serif", Georgia, serif`;
    if (ctx.measureText(titulo).width <= limite) break;
  }
  ctx.restore();
  texto(ctx, titulo, x, 74, {
    tamanho: corpoTitulo, peso: 700, cor: COR.marca, familia: "Bree Serif",
  });
  texto(ctx, subtitulo, x, 104, { tamanho: 17, cor: COR.cinzaEscuro });

  // A régua é assinatura da página: entra em todo card.
  const yRegua = 124, largura = CARD.largura - MARGEM * 2;
  caixa(ctx, MARGEM, yRegua, largura * 0.66, 6, COR.marca, 3);
  caixa(ctx, MARGEM + largura * 0.66, yRegua, largura * 0.22, 6, COR.vermelho, 0);
  caixa(ctx, MARGEM + largura * 0.88, yRegua, largura * 0.12, 6, COR.cinza, 3);

  const yFaixa = faixaDeNumeros(ctx, numeros, 156);

  if (nota) {
    texto(ctx, nota, MARGEM, CARD.altura - 34,
          { tamanho: 13.5, cor: COR.cinzaEscuro });
  }
  texto(ctx, `${assinatura.assinatura} · atualizado em ${hoje()}`,
        CARD.largura - MARGEM, CARD.altura - 34,
        { tamanho: 13.5, cor: COR.cinzaEscuro, alinha: "right" });
  linhaH(ctx, MARGEM, CARD.largura - MARGEM, CARD.altura - 58);

  return yFaixa;
}

/** De 3 a 5 caixas. A primeira é a manchete, em azul cheio. */
function faixaDeNumeros(ctx, numeros, y) {
  // Card sem faixa de números: o corpo começa logo abaixo da régua e fica com
  // a altura toda. É o caso dos cards em que o gráfico é o assunto inteiro.
  if (!numeros?.length) return y - 8;

  const largura = CARD.largura - MARGEM * 2;
  const vao = 12;
  const cada = (largura - vao * (numeros.length - 1)) / numeros.length;
  const altura = 96;

  numeros.forEach((n, i) => {
    const x = MARGEM + i * (cada + vao);
    const fundo = n.destaque === "azul" ? COR.marca
                : n.destaque === "escuro" ? COR.azulEscuro
                : n.destaque === "cinza" ? COR.cinzaClaro
                : n.destaque === "vermelho" ? COR.vermelhoLavado
                : COR.branco;
    const tinta = n.destaque === "azul" ? COR.marcaTexto
                : n.destaque === "escuro" ? COR.branco
                : COR.azulEscuro;
    caixa(ctx, x, y, cada, altura, fundo);
    if (!n.destaque) {
      ctx.save(); ctx.strokeStyle = COR.linha; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(x + .5, y + .5, cada - 1, altura - 1, 6);
      ctx.stroke(); ctx.restore();
    }
    texto(ctx, n.valor, x + 18, y + 56, { tamanho: 40, peso: 800, cor: tinta });
    texto(ctx, n.nome, x + 18, y + 80, {
      tamanho: 12, peso: 700, maiuscula: true, espaco: 1.1,
      cor: n.destaque === "azul" ? COR.marcaSuave
         : n.destaque === "escuro" ? COR.azulClaro : COR.cinzaEscuro,
    });
  });
  return y + altura + 26;
}

const hoje = () => new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
}).format(new Date());

/* ------------------------------------------------------ desenhos comuns */
/** Barra empilhada de triunfos, empates e derrotas. */
export function barraTED(ctx, x, y, largura, altura, { t, e, d, j }) {
  if (!j) { caixa(ctx, x, y, largura, altura, COR.cinzaClaro, 4); return; }
  const pedacos = [[t, COR.positivo], [e, COR.cinzaEscuro], [d, COR.negativo]];
  let cx = x;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, largura, altura, 4); ctx.clip();
  for (const [n, cor] of pedacos) {
    const l = (n / j) * largura;
    ctx.fillStyle = cor;
    ctx.fillRect(cx, y, l, altura);
    cx += l;
  }
  ctx.restore();
}

/** Linha do gráfico, com eixo já resolvido pelo chamador. */
function polilinha(ctx, pontos, cor, espessura = 3) {
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.lineWidth = espessura;
  ctx.lineJoin = "round";
  ctx.beginPath();
  pontos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.restore();
}

/* ---------------------------------------------------- ponte com a página */
let construtor = null;

/**
 * A página diz o que vira card. `fn()` devolve
 * `{ titulo, subtitulo, numeros, nota, corpo(ctx, y) }`.
 */
export function registrarCartao(fn) {
  construtor = fn;
  const botao = document.getElementById("gerar-card");
  if (botao) botao.addEventListener("click", abrirDialogo);
}

export async function desenharSpec(spec, canvas = document.createElement("canvas")) {
  // A paleta é decidida aqui, e não na importação: a marca troca com a página
  // aberta, e o próximo desenho tem de sair com as cores novas.
  vestirPaleta(marcaEscolhida());

  canvas.width = CARD.largura * CARD.escala;
  canvas.height = CARD.altura * CARD.escala;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(CARD.escala, 0, 0, CARD.escala, 0, 0);

  await carregarFontes();
  const y = await moldura(ctx, spec);
  await spec.corpo(ctx, y, { texto, caixa, linhaH, cortar, imagem, COR, barraTED,
                             polilinha, desenharEscudo, MARGEM, CARD });
  return canvas;
}

/** O caminho antigo, que pega o spec de quem chamou `registrarCartao`. */
export async function desenharCartao() {
  return desenharSpec(construtor());
}

async function carregarFontes() {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load('700 44px "Bree Serif"'),
    document.fonts.load('800 40px "Assistant"'),
    document.fonts.load('700 14px "Assistant"'),
    document.fonts.load('400 17px "Assistant"'),
  ]);
  await document.fonts.ready;
}

async function abrirDialogo() {
  const botao = document.getElementById("gerar-card");
  botao.disabled = true;
  botao.textContent = "Gerando…";
  try {
    const canvas = await desenharCartao();
    const blob = await new Promise((ok) => canvas.toBlob(ok, "image/png"));
    const url = URL.createObjectURL(blob);
    mostrarDialogo(url, nomeDoArquivo());
  } catch (erro) {
    alert(`Não foi possível gerar o card: ${erro.message}`);
  } finally {
    botao.disabled = false;
    botao.textContent = "Gerar card";
  }
}

function nomeDoArquivo() {
  const spec = construtor();
  const limpo = spec.titulo.normalize("NFD").replace(/\p{Mn}/gu, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${limpo}.png`;
}

function mostrarDialogo(url, nome) {
  document.querySelector("dialog.card")?.remove();
  const dialogo = document.createElement("dialog");
  dialogo.className = "card";
  dialogo.innerHTML = `
    <div class="card-topo">
      <h2>Card gerado</h2>
      <div class="acoes">
        <a class="card-baixar" href="${url}" download="${nome}">Baixar PNG</a>
        <button class="fechar" aria-label="Fechar">×</button>
      </div>
    </div>
    <div class="card-previa"><img src="${url}" alt="pré-visualização do card"></div>`;
  document.body.append(dialogo);
  dialogo.querySelector(".fechar").addEventListener("click", () => dialogo.close());
  dialogo.addEventListener("close", () => {
    URL.revokeObjectURL(url);
    dialogo.remove();
  });
  dialogo.showModal();
}

export { COR, texto, caixa, linhaH, cortar, imagem, polilinha, desenharEscudo, MARGEM };
