/**
 * Card: quanto custou cada posição, em todas as edições da série.
 *
 * Uma linha por lugar da tabela; na horizontal, as pontuações. O número dentro
 * de cada casa conta quantas campanhas terminaram naquele cruzamento, e a
 * mancha diagonal que aparece é a resposta das perguntas que todo mundo faz em
 * setembro: quanto costuma bastar para ser campeão, quanto já não bastou para
 * escapar do rebaixamento.
 *
 * À esquerda, o que a linha resume: o mínimo que já bastou, a média e o máximo
 * que já não bastou. A média em destaque, porque é dela que se fala — os
 * extremos são a memória de um ano específico, e a média é o preço corrente
 * daquele lugar.
 *
 * Só campanha encerrada entra: a edição em curso não terminou em lugar nenhum.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import {
  campanhasEncerradas, casa, cruzarPontosEPosicao, distribuicaoDaPosicao,
  resumoDaPosicao,
} from "/js/desfechos.js";

// Estreitas e centradas: as quatro colunas são a legenda da linha, e o card é
// da tabela. Cada pixel que elas devolvem é uma casa mais larga à direita.
const COLUNAS = { posicao: 40, minimo: 42, media: 54, maximo: 42 };
const VAO = 18;
const LARGURA_RESUMO = COLUNAS.posicao + COLUNAS.minimo + COLUNAS.media
                     + COLUNAS.maximo;

const ordinal = (n) => `${n}º`;

/** A média sai inteira: meio ponto não existe em tabela de campeonato. */
const media = (v) => String(Math.round(v));

/** "na Série A" ou "nas Séries A e B", conforme o que está marcado. */
function nomeDasSeries(series) {
  const lista = [...series];
  if (lista.length === 1) return `na Série ${lista[0]}`;
  return `nas Séries ${lista.slice(0, -1).join(", ")} e `
       + `${lista[lista.length - 1]}`;
}

export function montarCartao(estado) {
  const { series, posicoes, semTapetao } = estado;
  if (!posicoes || !series?.length) return null;

  const campanhas = campanhasEncerradas(posicoes, { serie: series, semTapetao });
  if (!campanhas.length) return null;

  const cruz = cruzarPontosEPosicao(campanhas);
  const pontuacoes = Array.from({ length: cruz.maximo - cruz.minimo + 1 },
                                (_, i) => cruz.minimo + i);
  const lugares = Array.from({ length: cruz.posicoes }, (_, i) => i + 1);
  const resumos = new Map(
    lugares.map((p) => [p, resumoDaPosicao(campanhas, p)]));
  const edicoes = new Set(campanhas.map((c) => `${c.serie}${c.ano}`));
  const varias = series.length > 1;

  const spec = {
    titulo: `Pontuação final por posição ${nomeDasSeries(series)}`,
    subtitulo: `${edicoes.size} edições encerradas · ${campanhas.length} `
             + `campanhas · o número na casa conta quantas terminaram ali`,
    arquivo: `desfechos-${series.join("")}`,
    numeros: [],
    nota: "Cada casa é um cruzamento de pontuação e posição final. Casa vazia "
        + "quer dizer que aquela combinação nunca aconteceu.",
    corpo: async (ctx, y) => {
      const topo = y + 34;
      const base = CARD.altura - 84;
      const x0 = MARGEM + LARGURA_RESUMO + VAO;
      const x1 = CARD.largura - MARGEM;
      const altura = (base - topo) / lugares.length;
      const largura = (x1 - x0) / pontuacoes.length;

      cabecalho(ctx, { x0, largura, pontuacoes, y: topo - 12 });

      const alvos = [];
      for (const [i, posicao] of lugares.entries()) {
        const yl = topo + i * altura;
        const meio = yl + altura / 2;
        const resumo = resumos.get(posicao);

        // Linha de grade discreta: com vinte faixas, é ela que sustenta o olho
        // na travessia até a última pontuação.
        linhaH(ctx, MARGEM, x1, yl + altura, COR.linha);

        colunasDaEsquerda(ctx, { posicao, resumo, meio, altura });

        for (const [k, pontos] of pontuacoes.entries()) {
          const dentro = casa(cruz, pontos, posicao);
          if (!dentro.length) continue;
          const x = x0 + k * largura;

          caixa(ctx, x + 1, yl + 2, largura - 2, altura - 4,
                tom(dentro.length, cruz.maior), 3);
          // O número volta para dentro do quadrado: sem ele o tom obriga a
          // comparar cinzas de cabeça, e a casa de uma campanha fica parecida
          // demais com a de duas.
          if (largura >= 13 && altura >= 13) {
            texto(ctx, dentro.length, x + largura / 2, meio + 4,
                  { tamanho: Math.min(12, largura - 3, altura - 6), peso: 800,
                    alinha: "center",
                    cor: dentro.length / cruz.maior > .55
                      ? COR.branco : COR.azulEscuro });
          }

          alvos.push({
            x, y: yl, l: largura, a: altura,
            ...dicaDaCasa(dentro, pontos, posicao, varias),
          });
        }

        // A calha da esquerda é o alvo da linha inteira: é lá que mora o
        // resumo da posição, e é de lá que sai o gráfico da distribuição.
        alvos.push({
          x: MARGEM, y: yl, l: x0 - MARGEM - 6, a: altura,
          ...dicaDaPosicao(resumo, distribuicaoDaPosicao(campanhas, posicao)),
        });
      }

      texto(ctx, "pontos →", (x0 + x1) / 2, base + 24,
            { tamanho: 11, peso: 700, alinha: "center", maiuscula: true,
              espaco: .9, cor: COR.cinzaEscuro });

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: y, alturaPlot: base - y,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
      };
    },
  };
  return spec;
}

/* ---------------------------------------------------- colunas da esquerda */
function cabecalho(ctx, { x0, largura, pontuacoes, y }) {
  let x = MARGEM;
  for (const [chave, rotulo] of [["posicao", "pos"], ["minimo", "mín"],
                                 ["media", "média"], ["maximo", "máx"]]) {
    texto(ctx, rotulo, x + COLUNAS[chave] / 2, y,
          { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
            alinha: "center", cor: COR.cinzaEscuro });
    x += COLUNAS[chave];
  }

  // A escala de pontos, de cinco em cinco: uma régua por cima da grade.
  for (const [i, pontos] of pontuacoes.entries()) {
    if (pontos % 5 !== 0 && i !== pontuacoes.length - 1 && i !== 0) continue;
    texto(ctx, pontos, x0 + (i + 0.5) * largura, y,
          { tamanho: 10, alinha: "center", cor: COR.cinzaEscuro });
  }
}

/**
 * O resumo da posição, à esquerda da faixa.
 *
 * A média ganha caixa e corpo maior: os extremos são a memória de um ano
 * específico, e a média é o preço corrente daquele lugar.
 */
function colunasDaEsquerda(ctx, { posicao, resumo, meio, altura }) {
  let x = MARGEM;
  texto(ctx, ordinal(posicao), x + COLUNAS.posicao / 2, meio + 5,
        { tamanho: 13, peso: 800, alinha: "center", cor: COR.azulEscuro });
  x += COLUNAS.posicao;

  if (!resumo) return;

  texto(ctx, resumo.minimo, x + COLUNAS.minimo / 2, meio + 5,
        { tamanho: 12, alinha: "center", cor: COR.cinzaTexto });
  x += COLUNAS.minimo;

  const chip = Math.min(24, altura - 6);
  caixa(ctx, x + 4, meio - chip / 2, COLUNAS.media - 8, chip,
        COR.azulLavado, 5);
  texto(ctx, media(resumo.media), x + COLUNAS.media / 2, meio + 5,
        { tamanho: 13, peso: 800, alinha: "center", cor: COR.azulEscuro });
  x += COLUNAS.media;

  texto(ctx, resumo.maximo, x + COLUNAS.maximo / 2, meio + 5,
        { tamanho: 12, alinha: "center", cor: COR.cinzaTexto });
}

/* ---------------------------------------------------------------- tons */
/**
 * O tom de uma casa.
 *
 * A escala começa clara na campanha única e chega ao azul cheio no cruzamento
 * mais repetido da série. Casa vazia não recebe cor nenhuma: o fundo do card
 * já diz que ali não aconteceu nada.
 */
function tom(quantas, maior) {
  const t = maior <= 1 ? 1 : (quantas - 1) / (maior - 1);
  return mistura(COR.azulLavado, COR.azul, t);
}

function mistura(de, para, t) {
  const canal = (cor, i) => parseInt(cor.slice(1 + i * 2, 3 + i * 2), 16);
  const valor = (i) => Math.round(canal(de, i) + (canal(para, i) - canal(de, i)) * t);
  return `rgb(${valor(0)}, ${valor(1)}, ${valor(2)})`;
}

/* ------------------------------------------------------------------ dica */
function dicaDaCasa(campanhas, pontos, posicao, varias) {
  const MOSTRAR = 7;
  const itens = campanhas.slice(0, MOSTRAR).map((c) => ({
    rotulo: nomeBonito(c.equipe), cor: COR.azul, pontos: null,
    texto: varias ? `${c.ano} · ${c.serie}` : String(c.ano), detalhe: "",
  }));
  if (campanhas.length > MOSTRAR) {
    itens.push({ rotulo: `e mais ${campanhas.length - MOSTRAR}`,
                 cor: COR.cinzaClaro, pontos: null, texto: "", detalhe: "" });
  }
  return {
    n: `${pontos} pontos · ${ordinal(posicao)} lugar`,
    itens,
    diferenca: {
      rotulo: `${campanhas.length} `
            + `${campanhas.length === 1 ? "campanha" : "campanhas"}`,
      texto: "com esta pontuação nesta posição",
      cor: COR.azul,
    },
  };
}

/**
 * A dica da faixa inteira: o preço daquele lugar e a forma da distribuição.
 *
 * O gráfico é o que os três números não dizem — se as campanhas se apertam em
 * torno da média ou se espalham, que é a diferença entre um lugar de preço
 * quase fixo e um que já custou coisas muito diferentes.
 */
function dicaDaPosicao(resumo, distribuicao) {
  if (!resumo) return { n: "", itens: [] };
  return {
    n: `${ordinal(resumo.posicao)} lugar`,
    itens: [
      { rotulo: "média", cor: COR.azul, pontos: null,
        texto: `${media(resumo.media)} pts`,
        detalhe: `em ${resumo.campanhas} campanhas` },
      { rotulo: "mínimo", cor: COR.cinzaEscuro, pontos: null,
        texto: `${resumo.minimo} pts`, detalhe: "já bastou" },
      { rotulo: "máximo", cor: COR.cinzaEscuro, pontos: null,
        texto: `${resumo.maximo} pts`, detalhe: "já não bastou" },
    ],
    faixas: {
      titulo: "campanhas por pontuação",
      barras: distribuicao.map((d) => ({
        rotulo: d.pontos, quantidade: d.quantidade,
      })),
    },
    diferenca: null,
  };
}
