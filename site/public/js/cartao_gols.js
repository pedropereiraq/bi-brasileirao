/**
 * Card: os gols de uma edição, pelos dois lados.
 *
 * A classificação já tem as duas colunas, mas enterradas entre as outras
 * seis. Aqui os gols são o assunto: o ranking à esquerda ordena por eles, e o
 * gráfico à direita mostra o que a coluna de números não mostra — a forma da
 * edição inteira.
 *
 * Em **ambos**, o gráfico cruza os dois lados: gols sofridos na horizontal,
 * marcados na vertical. Os dois eixos usam a mesma escala de propósito, e é
 * isso que faz a diagonal valer alguma coisa — em cima dela estão os clubes
 * de saldo zero, acima quem marca mais do que sofre. As duas retas pontilhadas
 * são as médias da edição, e partem o gráfico nos quatro tipos de campanha.
 *
 * Em **gols pró** e **gols contra**, o gráfico cruza a posição com os gols, e
 * a reta é a tendência da nuvem: ela responde de quanto adiantou marcar — ou
 * de quanto custou sofrer — naquele ano. Quando a nuvem não tem tendência
 * nenhuma, a reta fica quase deitada, e é essa a informação.
 *
 * Escudo que cairia em cima do vizinho se afasta, e um fio liga o escudo ao
 * ponto de onde ele saiu: o desenho pode se mexer, o dado não.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import {
  afastarEscudos, correlacaoComAPosicao, extremoDeGols, linhasDeGols,
  ordenarPorGols, resumoDaEdicao, retaDaTendencia, valorDe,
} from "/js/gols.js";

const VAO = 48;
const LADO_ESCUDO = 34;

const inteiro = (v) => (v === null || v === undefined ? "—" : String(Math.round(v)));
const decimal = (v, casas = 2) =>
  (v === null || v === undefined ? "—" : v.toFixed(casas).replace(".", ","));
const comSinal = (v, casas) => {
  if (v === null || v === undefined) return "—";
  const escrito = casas === undefined ? String(Math.abs(v))
                                      : decimal(Math.abs(v), casas);
  return v > 0 ? `+${escrito}` : v < 0 ? `−${escrito}` : escrito;
};
const ordinal = (n) => `${n}º`;

export function montarCartao(estado) {
  const { serie, edicao, tabela, clubes, visao, medida, criterio, destaque,
          aoEscolher } = estado;
  if (!edicao || !tabela?.length) return null;

  const linhas = linhasDeGols(tabela);
  const ordem = ordenarPorGols(linhas, criterio, medida);
  const porJogo = medida === "media";
  const valor = (linha, campo) => valorDe(linha, campo, medida);
  const mostrar = (v) => (porJogo ? decimal(v) : inteiro(v));

  const resumo = resumoDaEdicao(linhas);
  const largura = visao === "ambos" ? 470 : 404;

  const spec = {
    titulo: tituloDaVisao(visao, serie, edicao.ano),
    subtitulo: porJogo
      ? "Tudo em gols por jogo — o ritmo, e não o acumulado"
      : "Totais da edição",
    arquivo: `gols-${visao}-${serie}-${edicao.ano}-${medida}`,
    numeros: numerosDaVisao({ visao, linhas, resumo, medida, clubes, porJogo }),
    nota: notaDaVisao(visao, porJogo),
    corpo: async (ctx, y) => {
      const topo = y + 26;
      const base = CARD.altura - 84;
      const alturaCabecalho = 20;
      const alturaLinha = (base - topo - alturaCabecalho) / ordem.length;
      const xGrafico = MARGEM + largura + VAO;

      const alvos = [];
      alvos.push(...await desenharRanking(ctx, {
        ordem, visao, medida, mostrar, valor, clubes, destaque,
        x: MARGEM, largura, topo, alturaCabecalho, alturaLinha,
      }));

      const area = {
        x0: xGrafico + 54, x1: CARD.largura - MARGEM,
        y0: topo + 26, y1: base - 42,
      };
      alvos.push(...(visao === "ambos"
        ? await nuvemDeGols(ctx, { linhas, valor, medida, mostrar, clubes,
                                   destaque, area })
        : await golsPorPosicao(ctx, { linhas, visao, valor, medida, mostrar,
                                       clubes, destaque, area })));

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: y, alturaPlot: base - y,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
        // Clicar num clube no ranking acende o escudo dele no gráfico: com
        // vinte escudos na nuvem, achar um pela sigla é o trabalho todo.
        aoClicar: aoEscolher ? (alvo) => aoEscolher(alvo.equipe) : undefined,
      };
    },
  };
  return spec;
}

/* --------------------------------------------------------------- textos */
function tituloDaVisao(visao, serie, ano) {
  const onde = `na Série ${serie} ${ano}`;
  if (visao === "pro") return `Gols marcados ${onde}`;
  if (visao === "contra") return `Gols sofridos ${onde}`;
  return `Gols marcados e sofridos ${onde}`;
}

/**
 * A nota de rodapé, que divide a linha com a assinatura: o que cabe ali é uma
 * frase, e a medida por jogo já gasta meia.
 */
function notaDaVisao(visao, porJogo) {
  const medida = porJogo ? "Gols por jogo = gols ÷ jogos disputados. " : "";
  if (visao === "ambos") {
    return porJogo
      ? `${medida}Os dois eixos têm a mesma escala: a diagonal é o saldo zero, `
        + `e as pontilhadas são as médias da edição.`
      : `Os dois eixos têm a mesma escala: a diagonal é o saldo zero, e as `
        + `pontilhadas são as médias da edição. Escudo que cairia sobre o `
        + `vizinho se afasta, e o fio marca o ponto.`;
  }
  return porJogo
    ? `${medida}A reta é o ajuste de mínimos quadrados dos gols em função da `
      + `posição.`
    : `A reta é o ajuste de mínimos quadrados dos gols em função da posição: `
      + `correlação perto de zero quer dizer que a tabela daquele ano não se `
      + `decidiu por aqui.`;
}

function numerosDaVisao({ visao, linhas, resumo, medida, clubes, porJogo }) {
  const sigla = (linha) => clubes?.[linha?.equipe]?.sigla
    ?? nomeBonito(linha?.equipe ?? "").slice(0, 3).toUpperCase();
  const mostrar = (v) => (porJogo ? decimal(v) : inteiro(v));
  const extremo = (campo, maior) =>
    extremoDeGols(linhas, campo, { medida, maior });

  const daEdicao = {
    valor: porJogo ? decimal(resumo.porJogo) : inteiro(resumo.gols),
    nome: porJogo ? "gols por jogo na edição" : "gols na edição",
    destaque: "azul",
  };

  if (visao === "pro" || visao === "contra") {
    const campo = visao === "pro" ? "gp" : "gc";
    const primeiro = extremo(campo, visao === "pro");
    const ultimo = extremo(campo, visao !== "pro");
    const r = correlacaoComAPosicao(linhas, campo, medida);
    return [
      daEdicao,
      { valor: mostrar(valorDe(primeiro, campo, medida)),
        nome: `${visao === "pro" ? "maior ataque" : "melhor defesa"} · ${sigla(primeiro)}` },
      { valor: mostrar(valorDe(ultimo, campo, medida)),
        nome: `${visao === "pro" ? "menor ataque" : "pior defesa"} · ${sigla(ultimo)}` },
      { valor: r === null ? "—" : comSinal(r, 2),
        nome: "correlação com a posição", destaque: "cinza" },
    ];
  }

  const ataque = extremo("gp", true);
  const defesa = extremo("gc", false);
  const saldo = extremo("sg", true);
  return [
    daEdicao,
    { valor: mostrar(valorDe(ataque, "gp", medida)),
      nome: `maior ataque · ${sigla(ataque)}` },
    { valor: mostrar(valorDe(defesa, "gc", medida)),
      nome: `melhor defesa · ${sigla(defesa)}` },
    { valor: comSinal(valorDe(saldo, "sg", medida), porJogo ? 2 : undefined),
      nome: `maior saldo · ${sigla(saldo)}`, destaque: "cinza" },
  ];
}

/* -------------------------------------------------------------- ranking */
async function desenharRanking(ctx, o) {
  const { ordem, visao, medida, mostrar, valor, clubes, destaque,
          x, largura, topo, alturaCabecalho, alturaLinha } = o;
  const porJogo = medida === "media";

  const colunas = visao === "ambos"
    ? [
        { rotulo: "gp", campo: "gp", largura: 76, tom: COR.positivo },
        { rotulo: "gc", campo: "gc", largura: 76, tom: COR.negativo },
        { rotulo: "sd", campo: "sg", largura: 70 },
        { rotulo: "pts", campo: "pts", largura: 62 },
      ]
    : [
        { rotulo: "gols", campo: visao === "pro" ? "gp" : "gc", largura: 86,
          tom: visao === "pro" ? COR.positivo : COR.negativo },
        { rotulo: "j", campo: "j", largura: 52 },
        { rotulo: "pts", campo: "pts", largura: 62 },
      ];

  // Cada degradê é calibrado dentro da própria coluna: é lá que a comparação
  // acontece. Numa edição em que ninguém passa de 40 gols, esticar a escala
  // até zero deixaria as vinte casas da mesma cor.
  for (const coluna of colunas) {
    if (!coluna.tom) continue;
    const valores = ordem.filter((l) => l.j > 0)
      .map((l) => valor(l, coluna.campo) ?? 0);
    coluna.faixa = { minimo: Math.min(...valores), maximo: Math.max(...valores) };
  }

  const direita = x + largura;
  const posicoes = [];
  let cursor = direita;
  for (const coluna of [...colunas].reverse()) {
    cursor -= coluna.largura;
    posicoes.unshift({ ...coluna, x: cursor, centro: cursor + coluna.largura / 2 });
  }

  texto(ctx, porJogo ? "por jogo" : "na edição", x + 4, topo + 12,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });
  for (const coluna of posicoes) {
    texto(ctx, coluna.rotulo, coluna.centro, topo + 12,
          { tamanho: 9.5, peso: 700, alinha: "center", maiuscula: true,
            espaco: .8, cor: COR.cinzaEscuro });
  }
  linhaH(ctx, x, direita, topo + alturaCabecalho - 3, COR.linha);

  const alvos = [];
  for (const [i, linha] of ordem.entries()) {
    const yLinha = topo + alturaCabecalho + i * alturaLinha;
    const meio = yLinha + alturaLinha / 2;
    const marcado = destaque && linha.equipe === destaque;

    if (marcado) caixa(ctx, x - 3, yLinha, largura + 6, alturaLinha - 2, COR.marca, 5);

    texto(ctx, linha.pos, x + 16, meio + 4,
          { tamanho: 12, peso: 800, alinha: "center",
            cor: marcado ? COR.marcaTexto : COR.cinzaEscuro });

    const lado = Math.min(22, alturaLinha - 6);
    const escudo = await imagem(clubes?.[linha.equipe]?.escudo);
    desenharEscudo(ctx, escudo, x + 28, meio - lado / 2, lado);

    const sigla = clubes?.[linha.equipe]?.sigla
      ?? nomeBonito(linha.equipe).slice(0, 3).toUpperCase();
    texto(ctx, sigla, x + 56, meio + 4,
          { tamanho: 12.5, peso: 700,
            cor: marcado ? COR.marcaTexto : COR.azulEscuro });

    for (const coluna of posicoes) {
      const bruto = coluna.campo === "pts" || coluna.campo === "j"
        ? linha[coluna.campo] : valor(linha, coluna.campo);
      const escrito = coluna.campo === "sg"
        ? comSinal(bruto, porJogo ? 2 : undefined)
        : coluna.campo === "pts" || coluna.campo === "j"
          ? String(bruto) : mostrar(bruto);

      const tom = coluna.faixa && linha.j > 0
        ? degrade(bruto ?? 0, coluna.faixa, coluna.tom) : null;
      if (tom) {
        const alturaChip = Math.min(24, alturaLinha - 6);
        caixa(ctx, coluna.x + 5, meio - alturaChip / 2, coluna.largura - 10,
              alturaChip, tom.fundo, 5);
      }
      texto(ctx, escrito, coluna.centro, meio + 5,
            { tamanho: 12.5, peso: tom ? 800 : 700, alinha: "center",
              cor: marcado ? COR.marcaTexto
                 : tom ? tom.tinta : COR.cinzaTexto });
    }

    alvos.push({
      equipe: linha.equipe,
      x: x - 3, y: yLinha, l: largura + 6, a: alturaLinha - 2,
      ...dicaDoClube(linha),
    });
  }
  return alvos;
}

function degrade(valor, { minimo, maximo }, escuro) {
  const t = maximo === minimo ? 1 : (valor - minimo) / (maximo - minimo);
  return {
    fundo: mistura(COR.fundo, escuro, 0.12 + t * 0.88),
    tinta: t > 0.5 ? COR.branco : COR.azulEscuro,
  };
}

function mistura(de, para, t) {
  const canal = (cor, i) => parseInt(cor.slice(1 + i * 2, 3 + i * 2), 16);
  const valor = (i) => Math.round(canal(de, i) + (canal(para, i) - canal(de, i)) * t);
  return `rgb(${valor(0)}, ${valor(1)}, ${valor(2)})`;
}

/* ----------------------------------------------------------------- dica */
function dicaDoClube(linha) {
  const saldo = linha.sg;
  return {
    n: nomeBonito(linha.equipe),
    itens: [
      { rotulo: "gols marcados", cor: COR.positivo, pontos: null,
        texto: `${linha.gp} gols`,
        detalhe: `${decimal(linha.gpPorJogo)} por jogo` },
      { rotulo: "gols sofridos", cor: COR.negativo, pontos: null,
        texto: `${linha.gc} gols`,
        detalhe: `${decimal(linha.gcPorJogo)} por jogo` },
    ],
    diferenca: {
      rotulo: `${comSinal(saldo)} de saldo`,
      texto: `${ordinal(linha.pos)} · ${linha.pts} pts em ${linha.j} jogos`,
      cor: saldo > 0 ? COR.positivo : saldo < 0 ? COR.negativo : COR.cinzaEscuro,
    },
  };
}

/* ------------------------------------------------------- eixos e escalas */
/**
 * Os limites do eixo, com folga para o escudo não encostar na borda.
 *
 * O zero não é forçado: numa edição em que ninguém marca menos de 20, começar
 * do zero empurraria os vinte clubes para o canto superior.
 */
function faixaDe(valores) {
  const bons = valores.filter((v) => v !== null && v !== undefined);
  if (!bons.length) return { minimo: 0, maximo: 1 };
  const minimo = Math.min(...bons), maximo = Math.max(...bons);
  const folga = Math.max((maximo - minimo) * 0.12, maximo === minimo ? 1 : 0);
  return { minimo: minimo - folga, maximo: maximo + folga };
}

function marcasDoEixo({ minimo, maximo }, porJogo) {
  const bruto = (maximo - minimo) / 4;
  const passo = porJogo
    ? Math.max(0.25, Math.round(bruto * 4) / 4)
    : Math.max(5, Math.round(bruto / 5) * 5);
  const marcas = [];
  for (let v = Math.ceil(minimo / passo) * passo; v <= maximo; v += passo) {
    marcas.push(Number(v.toFixed(4)));
  }
  return marcas;
}

/* ------------------------------------------------------- nuvem de ambos */
async function nuvemDeGols(ctx, o) {
  const { linhas, valor, medida, mostrar, clubes, destaque, area } = o;
  const porJogo = medida === "media";
  const jogaram = linhas.filter((l) => l.j > 0);
  if (!jogaram.length) return [];

  // Uma escala só para os dois eixos: sem isso a diagonal do saldo zero
  // passaria a apontar para qualquer lugar.
  const faixa = faixaDe([
    ...jogaram.map((l) => valor(l, "gp")), ...jogaram.map((l) => valor(l, "gc")),
  ]);
  const xDe = (v) => area.x0 + ((v - faixa.minimo) / (faixa.maximo - faixa.minimo))
                             * (area.x1 - area.x0);
  const yDe = (v) => area.y1 - ((v - faixa.minimo) / (faixa.maximo - faixa.minimo))
                             * (area.y1 - area.y0);

  moldura(ctx, area);
  for (const marca of marcasDoEixo(faixa, porJogo)) {
    const x = xDe(marca), y = yDe(marca);
    ctx.save();
    ctx.strokeStyle = COR.linha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, area.y0); ctx.lineTo(x, area.y1);
    ctx.moveTo(area.x0, y); ctx.lineTo(area.x1, y);
    ctx.stroke();
    ctx.restore();
    texto(ctx, porJogo ? decimal(marca, 2) : inteiro(marca), x, area.y1 + 18,
          { tamanho: 10.5, alinha: "center", cor: COR.cinzaEscuro });
    texto(ctx, porJogo ? decimal(marca, 2) : inteiro(marca), area.x0 - 10, y + 4,
          { tamanho: 10.5, alinha: "right", cor: COR.cinzaEscuro });
  }

  // A diagonal do saldo zero.
  ctx.save();
  ctx.strokeStyle = COR.cinza;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(xDe(faixa.minimo), yDe(faixa.minimo));
  ctx.lineTo(xDe(faixa.maximo), yDe(faixa.maximo));
  ctx.stroke();
  ctx.restore();

  // As médias da edição, uma em cada eixo.
  const media = (campo) => jogaram.reduce((s, l) => s + valor(l, campo), 0)
                         / jogaram.length;
  const mediaGp = media("gp"), mediaGc = media("gc");
  pontilhada(ctx, xDe(mediaGc), area.y0, xDe(mediaGc), area.y1);
  pontilhada(ctx, area.x0, yDe(mediaGp), area.x1, yDe(mediaGp));
  texto(ctx, `média ${mostrar(mediaGc)}`, xDe(mediaGc) + 6, area.y0 + 12,
        { tamanho: 10, peso: 700, cor: COR.cinzaEscuro });
  texto(ctx, `média ${mostrar(mediaGp)}`, area.x1 - 6, yDe(mediaGp) - 6,
        { tamanho: 10, peso: 700, alinha: "right", cor: COR.cinzaEscuro });

  quadrantes(ctx, area);
  texto(ctx, "gols sofridos →", (area.x0 + area.x1) / 2, area.y1 + 38,
        { tamanho: 11.5, peso: 700, alinha: "center", maiuscula: true,
          espaco: .9, cor: COR.cinzaEscuro });
  ctx.save();
  ctx.translate(area.x0 - 42, (area.y0 + area.y1) / 2);
  ctx.rotate(-Math.PI / 2);
  texto(ctx, "gols marcados →", 0, 0,
        { tamanho: 11.5, peso: 700, alinha: "center", maiuscula: true,
          espaco: .9, cor: COR.cinzaEscuro });
  ctx.restore();

  const pontos = jogaram.map((l) => ({
    equipe: l.equipe, linha: l,
    x: xDe(valor(l, "gc")), y: yDe(valor(l, "gp")),
  }));
  return desenharEscudos(ctx, { pontos, clubes, destaque, area });
}

/* -------------------------------------------------- posição × gols */
async function golsPorPosicao(ctx, o) {
  const { linhas, visao, valor, medida, clubes, destaque, area } = o;
  const porJogo = medida === "media";
  const campo = visao === "pro" ? "gp" : "gc";
  const jogaram = linhas.filter((l) => l.j > 0);
  if (!jogaram.length) return [];

  const total = linhas.length;
  const faixa = faixaDe(jogaram.map((l) => valor(l, campo)));
  const xDe = (v) => area.x0 + ((v - faixa.minimo) / (faixa.maximo - faixa.minimo))
                             * (area.x1 - area.x0);
  const altura = (area.y1 - area.y0) / total;
  const yDe = (pos) => area.y0 + (pos - 0.5) * altura;

  moldura(ctx, area);
  for (const marca of marcasDoEixo(faixa, porJogo)) {
    const x = xDe(marca);
    ctx.save();
    ctx.strokeStyle = COR.linha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, area.y0); ctx.lineTo(x, area.y1);
    ctx.stroke();
    ctx.restore();
    texto(ctx, porJogo ? decimal(marca, 2) : inteiro(marca), x, area.y1 + 18,
          { tamanho: 10.5, alinha: "center", cor: COR.cinzaEscuro });
  }
  for (let pos = 1; pos <= total; pos++) {
    if (pos !== 1 && pos !== total && pos % 5 !== 0) continue;
    texto(ctx, ordinal(pos), area.x0 - 10, yDe(pos) + 4,
          { tamanho: 10.5, alinha: "right", cor: COR.cinzaEscuro });
  }

  const reta = retaDaTendencia(linhas, campo, medida);
  if (reta) {
    const de = reta.intercepto + reta.inclinacao;
    const ate = reta.intercepto + reta.inclinacao * total;
    ctx.save();
    ctx.strokeStyle = visao === "pro" ? COR.positivo : COR.negativo;
    ctx.globalAlpha = .45;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(xDe(de), yDe(1));
    ctx.lineTo(xDe(ate), yDe(total));
    ctx.stroke();
    ctx.restore();
  }

  texto(ctx, visao === "pro" ? "gols marcados →" : "gols sofridos →",
        (area.x0 + area.x1) / 2, area.y1 + 38,
        { tamanho: 11.5, peso: 700, alinha: "center", maiuscula: true,
          espaco: .9, cor: COR.cinzaEscuro });
  ctx.save();
  ctx.translate(area.x0 - 46, (area.y0 + area.y1) / 2);
  ctx.rotate(-Math.PI / 2);
  texto(ctx, "← posição na tabela", 0, 0,
        { tamanho: 11.5, peso: 700, alinha: "center", maiuscula: true,
          espaco: .9, cor: COR.cinzaEscuro });
  ctx.restore();

  const pontos = jogaram.map((l) => ({
    equipe: l.equipe, linha: l, x: xDe(valor(l, campo)), y: yDe(l.pos),
  }));
  // As vinte faixas têm ~27px de altura: escudo maior do que isso nasceria
  // em cima do vizinho de posição, e o afastamento teria de mentir no eixo
  // dos gols para caber.
  return desenharEscudos(ctx, { pontos, clubes, destaque, area,
                                lado: 30, minimo: 30 });
}

/* -------------------------------------------------------------- comuns */
function moldura(ctx, area) {
  ctx.save();
  ctx.strokeStyle = COR.linha;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(area.x0 + .5, area.y0 + .5, area.x1 - area.x0 - 1,
           area.y1 - area.y0 - 1);
  ctx.stroke();
  ctx.restore();
}

function pontilhada(ctx, x0, y0, x1, y1) {
  ctx.save();
  ctx.strokeStyle = COR.cinzaEscuro;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

/** Os quatro tipos de campanha, um em cada canto. */
function quadrantes(ctx, area) {
  const cantos = [
    ["marca muito · sofre pouco", area.x0 + 12, area.y0 + 14, "left"],
    ["marca muito · sofre muito", area.x1 - 12, area.y0 + 14, "right"],
    ["marca pouco · sofre pouco", area.x0 + 12, area.y1 - 10, "left"],
    ["marca pouco · sofre muito", area.x1 - 12, area.y1 - 10, "right"],
  ];
  for (const [rotulo, x, y, alinha] of cantos) {
    texto(ctx, rotulo, x, y,
          { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .7, alinha,
            cor: COR.cinza });
  }
}

/**
 * Os escudos, afastados o suficiente para não se esconderem.
 *
 * O fio só aparece quando o escudo saiu do lugar: sem ele, o leitor não teria
 * como saber que aquele escudo está deslocado — e é o ponto, não o escudo,
 * que marca a campanha.
 */
async function desenharEscudos(ctx, { pontos, clubes, destaque, area,
                                      lado: tamanho = LADO_ESCUDO,
                                      minimo = LADO_ESCUDO }) {
  const limites = {
    x0: area.x0 + tamanho / 2, x1: area.x1 - tamanho / 2,
    y0: area.y0 + tamanho / 2, y1: area.y1 - tamanho / 2,
  };
  const postos = afastarEscudos(pontos, { minimo, limites });

  for (const p of postos) {
    if (!p.desviado) continue;
    ctx.save();
    ctx.strokeStyle = COR.cinza;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.xe, p.ye);
    ctx.stroke();
    ctx.fillStyle = COR.cinzaEscuro;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // O clube em destaque é desenhado por último: o anel dele precisa ficar por
  // cima dos vizinhos, e não debaixo do primeiro escudo que passar.
  const ordem = [...postos].sort((a, b) =>
    (a.equipe === destaque) - (b.equipe === destaque));

  const alvos = [];
  for (const p of ordem) {
    const marcado = destaque && p.equipe === destaque;
    const lado = marcado ? tamanho + 8 : tamanho;

    if (marcado) {
      ctx.save();
      ctx.fillStyle = COR.marca;
      ctx.globalAlpha = .18;
      ctx.beginPath();
      ctx.arc(p.xe, p.ye, lado * .78, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = COR.marca;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.xe, p.ye, lado * .78, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const escudo = await imagem(clubes?.[p.equipe]?.escudo);
    desenharEscudo(ctx, escudo, p.xe - lado / 2, p.ye - lado / 2, lado);

    alvos.push({
      equipe: p.equipe,
      x: p.xe - lado / 2, y: p.ye - lado / 2, l: lado, a: lado,
      ...dicaDoClube(p.linha),
    });
  }
  return alvos;
}
