/**
 * Card: quantos pontos separavam duas posições, edição por edição.
 *
 * A grade de médias responde quanto vale cada posição. Esta responde outra
 * coisa: quanto uma se afasta da outra. São perguntas diferentes, e a segunda
 * é a que fica de fora quando se olha só a pontuação — um ano em que o 4º
 * lugar tem os pontos de sempre ainda pode ser o ano em que o G4 mais se
 * descolou do Z4, porque quem caiu foi a outra ponta.
 *
 * Cada edição é uma coluna: a bolinha de cima marca a posição melhor, a de
 * baixo a pior, e o comprimento entre as duas é a distância. As etiquetas
 * ficam **fora** das pontas, e não em cima delas: a ponta é o dado, e uma
 * caixa por cima dela esconderia justamente onde a coluna começa.
 *
 * O alinhamento é escolha de quem lê, porque cada um responde a uma pergunta:
 *
 *   pontuação  — a escala real. Mostra a distância e a altura dela na tabela:
 *                uma distância de 8 entre 60 e 52 não é a mesma coisa que
 *                entre 40 e 32.
 *   topo/base  — as pontas de um lado alinhadas. Some a altura, sobra só o
 *                comprimento, e a comparação entre edições vira leitura direta.
 *   centro     — as colunas crescem para os dois lados a partir de um eixo,
 *                que é a forma mais limpa de ver ritmo e simetria da série.
 *
 * O preenchimento da coluna sai da mesma rampa da grade de médias: mais claro
 * na menor distância da série, mais cheio na maior. Cor e comprimento dizem a
 * mesma coisa por dois caminhos, que é o que faz o extremo saltar sem precisar
 * de seta.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import { distanciaEntrePosicoes, resumoDaDistancia } from "/js/media_posicao.js";

const CALHA_DIR = 138;
const MARGEM_PONTA = 34;
const TAG = { largura: 38, altura: 23 };

// Teto de altura para um ponto de diferença. Sem ele, uma rodada 3 em que o
// líder abre dois pontos desenharia colunas de quatrocentos pixels: a escala
// se estica para preencher o card e dois pontos passam a parecer um abismo.
// Com o teto, a coluna curta fica curta, que é a informação.
const MAX_POR_PONTO = 30;

const ordinal = (p) => `${p}º`;
const num = (v, casas = 1) => v.toFixed(casas).replace(".", ",");

const ALINHAMENTOS = {
  pontuacao: "A escala é a dos pontos: a altura da coluna diz em que patamar "
           + "da tabela a distância aconteceu.",
  topo: "Todas as edições partem da mesma linha no alto: o que sobra da coluna "
      + "é só a distância.",
  base: "Todas as edições partem da mesma linha embaixo: o que sobra da coluna "
      + "é só a distância.",
  centro: "As colunas crescem para os dois lados a partir de um eixo comum: "
        + "só o comprimento conta.",
};

export function montarCartao(estado) {
  const { serie, rodada, faixa, alinhamento, posicoes } = estado;
  if (!posicoes || !rodada) return null;

  const cima = Math.min(faixa.melhor, faixa.pior);
  const baixo = Math.max(faixa.melhor, faixa.pior);
  const linhas = distanciaEntrePosicoes(posicoes,
    { serie, rodada, melhor: cima, pior: baixo });
  if (linhas.length < 2 || cima === baixo) return null;

  const resumo = resumoDaDistancia(linhas);
  const atual = linhas.find((l) => !l.encerrada);

  const spec = {
    titulo: `Distância entre o ${ordinal(cima)} e o ${ordinal(baixo)} na `
          + `${rodada}ª rodada da Série ${serie}`,
    subtitulo: `Quantos pontos separavam as duas posições ao fim da rodada, `
             + `edição por edição`,
    arquivo: `distancia-${serie}-r${rodada}-${cima}-${baixo}`,
    numeros: [
      ...(atual ? [{
        valor: `${atual.diferenca}`, nome: `distância em ${atual.ano}`,
        destaque: "azul",
      }] : []),
      { valor: num(resumo.media), nome: `média de ${resumo.edicoes} edições` },
      { valor: `${resumo.maxima.diferenca}`,
        nome: `maior · ${resumo.maxima.ano}` },
      { valor: `${resumo.minima.diferenca}`,
        nome: `menor · ${resumo.minima.ano}` },
    ],
    nota: ALINHAMENTOS[alinhamento] ?? "",
    corpo: async (ctx, y) => {
      const x0 = MARGEM;
      const x1 = CARD.largura - MARGEM - CALHA_DIR;
      const passo = (x1 - x0) / linhas.length;
      const larguraBarra = Math.min(46, passo * 0.56);
      const centroDaColuna = (i) => x0 + (i + 0.5) * passo;

      const yAnos = CARD.altura - 96;
      const plotTopo = y + 42;
      const plotBase = yAnos - 28;
      const regua = reguaDoAlinhamento({
        linhas, resumo, alinhamento, cima, baixo,
        topo: plotTopo + MARGEM_PONTA, base: plotBase - MARGEM_PONTA,
      });

      legenda(ctx, { x: x0, y: y + 14, cima, baixo });
      // As duas médias podem cair a um ponto uma da outra — e aí as linhas
      // continuam onde estão, mas os rótulos se afastam para caber.
      let ocupado = -Infinity;
      for (const marca of [...regua.marcas].sort((a, b) => a.y - b.y)) {
        linhaTracejada(ctx, x0, x1, marca.y);
        const yRotulo = Math.max(marca.y, ocupado + 34);
        ocupado = yRotulo;
        texto(ctx, marca.rotulo, x1 + 10, yRotulo - 3,
              { tamanho: 11.5, peso: 700, cor: COR.cinzaEscuro });
        texto(ctx, marca.detalhe, x1 + 10, yRotulo + 12,
              { tamanho: 10.5, cor: COR.cinzaEscuro });
      }

      const alvos = [];
      const extremos = linhas.map((l) => l.diferenca);
      const menor = Math.min(...extremos);
      const maior = Math.max(...extremos);

      for (const [i, linha] of linhas.entries()) {
        const xc = centroDaColuna(i);
        const { yCima, yBaixo } = regua.pontas(linha);
        const forca = maior === menor ? 1
          : (linha.diferenca - menor) / (maior - menor);

        caixa(ctx, xc - larguraBarra / 2, yCima, larguraBarra, yBaixo - yCima,
              mistura(COR.rampaBaixo, COR.rampaAlto, forca), 4);

        // A edição em andamento ganha contorno: é a que se quer comparar com
        // as outras, e ela não está no fim da fila por acaso.
        if (!linha.encerrada) {
          ctx.save();
          ctx.strokeStyle = COR.azul;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(xc - larguraBarra / 2 - 1, yCima - 1,
                        larguraBarra + 2, yBaixo - yCima + 2, 5);
          ctx.stroke();
          ctx.restore();
        }

        const altura = yBaixo - yCima;
        const dentro = altura >= 30;
        texto(ctx, linha.diferenca, xc,
              dentro ? (yCima + yBaixo) / 2 + 6 : yCima - TAG.altura - 16,
              { tamanho: dentro ? 17 : 14, peso: 800, alinha: "center",
                cor: COR.azulEscuro });

        ponta(ctx, xc, yCima, COR.positivo);
        ponta(ctx, xc, yBaixo, COR.negativo);
        etiqueta(ctx, xc, yCima - 8 - TAG.altura, linha.melhor.pontos,
                 COR.positivo);
        etiqueta(ctx, xc, yBaixo + 8, linha.pior.pontos, COR.negativo);

        texto(ctx, linha.ano, xc, yAnos,
              { tamanho: 12.5, peso: linha.encerrada ? 700 : 800,
                alinha: "center",
                cor: linha.encerrada ? COR.cinzaEscuro : COR.azul });

        alvos.push({
          n: `${linha.ano} · ${ordinal(cima)} contra ${ordinal(baixo)}`,
          x: xc - passo / 2, y: plotTopo, l: passo, a: plotBase - plotTopo,
          itens: [
            { rotulo: nomeBonito(linha.melhor.equipe), cor: COR.positivo,
              pontos: linha.melhor.pontos, detalhe: `${ordinal(cima)} colocado` },
            { rotulo: nomeBonito(linha.pior.equipe), cor: COR.negativo,
              pontos: linha.pior.pontos, detalhe: `${ordinal(baixo)} colocado` },
          ],
          diferenca: {
            rotulo: `${linha.diferenca}`,
            texto: `${comparadoComAMedia(linha.diferenca, resumo.media)}`,
            cor: linha.diferenca >= resumo.media ? COR.positivo : COR.negativo,
          },
        });
      }

      linhaH(ctx, x0, x1, plotBase + 12, COR.linha);

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: plotTopo, alturaPlot: plotBase - plotTopo,
        x0, x1, largura: passo,
      };
    },
  };
  return spec;
}

const comparadoComAMedia = (valor, media) => {
  const fora = valor - media;
  if (Math.abs(fora) < 0.05) return "na média da série";
  return `${num(Math.abs(fora))} ${fora > 0 ? "acima" : "abaixo"} da média`;
};

/* ------------------------------------------------------------ alinhamento */
/**
 * Onde cada coluna começa e termina, e que linha de referência faz sentido.
 *
 * A referência acompanha o alinhamento porque ela é a mesma pergunta: na
 * escala de pontos, o que se compara é a pontuação média de cada ponta; nos
 * alinhados, o que se compara é a distância média.
 */
function reguaDoAlinhamento({ linhas, resumo, alinhamento, cima, baixo,
                              topo, base }) {
  const maior = Math.max(1, ...linhas.map((l) => l.diferenca));
  const util = base - topo;
  const porPonto = Math.min(util / maior, MAX_POR_PONTO);
  const centro = (topo + base) / 2;

  if (alinhamento === "pontuacao") {
    const valores = linhas.flatMap((l) => [l.melhor.pontos, l.pior.pontos]);
    const menor = Math.min(...valores);
    const alto = Math.max(...valores);
    const escala = alto === menor ? 0
      : Math.min(util / (alto - menor), MAX_POR_PONTO);
    // Quando o teto entra, a faixa usada é menor que o espaço: ela fica
    // centrada, e não colada embaixo.
    const sobra = (util - (alto - menor) * escala) / 2;
    const yDe = (v) => base - sobra - (v - menor) * escala;

    return {
      pontas: (l) => ({ yCima: yDe(l.melhor.pontos), yBaixo: yDe(l.pior.pontos) }),
      marcas: [
        { y: yDe(resumo.mediaMelhor), rotulo: `média do ${ordinal(cima)}`,
          detalhe: `${num(resumo.mediaMelhor)} pontos` },
        { y: yDe(resumo.mediaPior), rotulo: `média do ${ordinal(baixo)}`,
          detalhe: `${num(resumo.mediaPior)} pontos` },
      ],
    };
  }

  const pontas = {
    topo: (l) => ({ yCima: topo, yBaixo: topo + l.diferenca * porPonto }),
    base: (l) => ({ yCima: base - l.diferenca * porPonto, yBaixo: base }),
    centro: (l) => ({
      yCima: centro - l.diferenca * porPonto / 2,
      yBaixo: centro + l.diferenca * porPonto / 2,
    }),
  }[alinhamento];

  const media = resumo.media * porPonto;
  const marcas = {
    topo: [{ y: topo + media }],
    base: [{ y: base - media }],
    centro: [{ y: centro - media / 2 }, { y: centro + media / 2 }],
  }[alinhamento];

  return {
    pontas,
    marcas: marcas.map((m, i) => ({
      ...m,
      rotulo: i === 0 ? `distância média` : "",
      detalhe: i === 0 ? `${num(resumo.media)} pontos` : "",
    })),
  };
}

/* ---------------------------------------------------------------- traços */
function mistura(de, para, t) {
  const canal = (cor, i) => parseInt(cor.slice(1 + i * 2, 3 + i * 2), 16);
  const valor = (i) => Math.round(canal(de, i) + (canal(para, i) - canal(de, i)) * t);
  return `rgb(${valor(0)}, ${valor(1)}, ${valor(2)})`;
}

function linhaTracejada(ctx, x0, x1, y) {
  ctx.save();
  ctx.strokeStyle = COR.cinzaEscuro;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(x0, y + .5);
  ctx.lineTo(x1, y + .5);
  ctx.stroke();
  ctx.restore();
}

/** A ponta da coluna, com anel do fundo para se destacar do preenchimento. */
function ponta(ctx, x, y, cor) {
  ctx.save();
  ctx.fillStyle = COR.fundo;
  ctx.beginPath();
  ctx.arc(x, y, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function etiqueta(ctx, xc, y, valor, cor) {
  caixa(ctx, xc - TAG.largura / 2, y, TAG.largura, TAG.altura, cor, 5);
  texto(ctx, valor, xc, y + TAG.altura / 2 + 5,
        { tamanho: 14, peso: 800, alinha: "center", cor: COR.branco });
}

function legenda(ctx, { x, y, cima, baixo }) {
  const itens = [
    { cor: COR.positivo, texto: `${ordinal(cima)} colocado` },
    { cor: COR.negativo, texto: `${ordinal(baixo)} colocado` },
  ];

  let cursor = x;
  ctx.save();
  ctx.font = '400 12px "Assistant", sans-serif';
  for (const item of itens) {
    ctx.fillStyle = item.cor;
    ctx.beginPath();
    ctx.arc(cursor + 6, y - 4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COR.cinzaTexto;
    ctx.fillText(item.texto, cursor + 17, y);
    cursor += 17 + ctx.measureText(item.texto).width + 26;
  }
  ctx.restore();
}
