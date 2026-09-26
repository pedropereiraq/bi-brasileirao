/**
 * Card: onde cada pontuação terminou, em todas as edições da série.
 *
 * Uma casa para cada cruzamento de pontuação e posição, e o tom conta quantas
 * campanhas caíram ali. A mancha que aparece é a resposta das duas perguntas
 * que se fazem toda temporada: "68 pontos dão título?" se lê na faixa dos 68,
 * "quanto precisa para não cair?" se lê na faixa do 17º.
 *
 * As duas visões são a mesma tabela girada. Por **pontos**, a pontuação fica
 * em pé e as posições correm na horizontal — é a leitura de quem tem um número
 * na cabeça e quer saber no que ele deu. Por **posição**, o contrário: a
 * posição em pé e as pontuações na horizontal, que é a leitura de quem tem uma
 * meta e quer saber quanto ela custa.
 *
 * Só campanha encerrada entra: a edição em curso não terminou em lugar nenhum.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import {
  campanhasEncerradas, casa, cruzarPontosEPosicao, resumoDaPontuacao,
  resumoDaPosicao,
} from "/js/desfechos.js";

const CALHA = 54;
const ordinal = (n) => `${n}º`;
const num = (v) => v.toFixed(1).replace(".", ",");

export function montarCartao(estado) {
  const { serie, posicoes, modo, semTapetao } = estado;
  if (!posicoes) return null;

  const campanhas = campanhasEncerradas(posicoes, { serie, semTapetao });
  if (!campanhas.length) return null;

  const cruz = cruzarPontosEPosicao(campanhas);
  const porPontos = modo !== "posicao";
  const pontuacoes = Array.from({ length: cruz.maximo - cruz.minimo + 1 },
                                (_, i) => cruz.minimo + i);
  const lugares = Array.from({ length: cruz.posicoes }, (_, i) => i + 1);

  const campeao = resumoDaPosicao(campanhas, 1);
  const rebaixado = resumoDaPosicao(campanhas, cruz.posicoes - 3);

  const spec = {
    titulo: porPontos
      ? `No que deu cada pontuação na Série ${serie}`
      : `Quanto custou cada posição na Série ${serie}`,
    subtitulo: `${campanhas.length} campanhas encerradas · o tom conta quantas `
             + `caíram em cada casa`,
    arquivo: `desfechos-${serie}-${porPontos ? "pontos" : "posicao"}`,
    numeros: [
      { valor: `${campanhas.length}`, destaque: "azul",
        nome: "campanhas na conta" },
      { valor: campeao ? `${campeao.minimo}` : "—",
        nome: "menor pontuação de campeão" },
      { valor: campeao ? `${campeao.maximo}` : "—",
        nome: "maior pontuação de campeão" },
      { valor: rebaixado ? `${rebaixado.maximo}` : "—",
        nome: rebaixado ? `maior pontuação de ${ordinal(rebaixado.posicao)}`
                        : "—", destaque: "cinza" },
    ],
    nota: "Cada casa é um cruzamento de pontuação e posição final. Casa vazia "
        + "quer dizer que aquela combinação nunca aconteceu nesta série.",
    corpo: async (ctx, y) => {
      // A legenda vive na faixa entre o topo do corpo e a grade: sem esse
      // respiro ela caía em cima dos rótulos das colunas.
      const topo = y + 52;
      const base = CARD.altura - 84;
      const x0 = MARGEM + CALHA;
      const x1 = CARD.largura - MARGEM;

      // Em pé vai o eixo da visão: por pontos, a pontuação; por posição, a
      // posição. O outro corre na horizontal.
      const linhas = porPontos ? [...pontuacoes].reverse() : lugares;
      const colunas = porPontos ? lugares : pontuacoes;
      const altura = (base - topo) / linhas.length;
      const largura = (x1 - x0) / colunas.length;

      legenda(ctx, { maior: cruz.maior, x: x0, y: y + 14 });
      rotulosDasColunas(ctx, { colunas, porPontos, x0, largura, y: topo - 8 });

      const alvos = [];
      for (const [i, valorLinha] of linhas.entries()) {
        const yl = topo + i * altura;
        rotuloDaLinha(ctx, { valor: valorLinha, porPontos, altura,
                             x: x0 - 10, y: yl, indice: i, total: linhas.length });

        for (const [k, valorColuna] of colunas.entries()) {
          const pontos = porPontos ? valorLinha : valorColuna;
          const posicao = porPontos ? valorColuna : valorLinha;
          const dentro = casa(cruz, pontos, posicao);
          const x = x0 + k * largura;

          if (dentro.length) {
            caixa(ctx, x + 1, yl + 1, largura - 2, Math.max(2, altura - 2),
                  tom(dentro.length, cruz.maior), 3);
            // O número só entra onde ele cabe e onde diz algo: casa de uma
            // campanha só é a regra, e escrever "1" em quatrocentas delas
            // seria encher a grade para não contar nada.
            if (dentro.length > 1 && largura >= 18 && altura >= 14) {
              texto(ctx, dentro.length, x + largura / 2, yl + altura / 2 + 4,
                    { tamanho: Math.min(12, altura - 6), peso: 800,
                      alinha: "center",
                      cor: dentro.length / cruz.maior > .55
                        ? COR.branco : COR.azulEscuro });
            }
            alvos.push({
              x, y: yl, l: largura, a: altura,
              ...dicaDaCasa(dentro, pontos, posicao),
            });
          }
        }
      }

      linhaH(ctx, x0, x1, base, COR.linha);
      texto(ctx, porPontos ? "posição final →" : "pontos →",
            (x0 + x1) / 2, base + 22,
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

/* ---------------------------------------------------------------- tons */
/**
 * O tom de uma casa.
 *
 * A escala começa clara na campanha única e chega ao azul cheio no
 * cruzamento mais repetido da série. Casa vazia não recebe cor nenhuma: o
 * fundo do card já diz que ali não aconteceu nada.
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

function legenda(ctx, { maior, x, y }) {
  texto(ctx, "campanhas na casa", x, y + 4,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });

  const passos = Math.min(maior, 5);
  for (let i = 1; i <= passos; i++) {
    const quantas = Math.round(1 + ((maior - 1) * (i - 1)) / Math.max(1, passos - 1));
    const cx = x + 150 + (i - 1) * 46;
    caixa(ctx, cx, y - 8, 28, 16, tom(quantas, maior), 3);
    texto(ctx, quantas, cx + 34, y + 4,
          { tamanho: 10.5, peso: 700, cor: COR.cinzaEscuro });
  }
}

/* -------------------------------------------------------------- rótulos */
function rotulosDasColunas(ctx, { colunas, porPontos, x0, largura, y }) {
  for (const [i, valor] of colunas.entries()) {
    // Com setenta pontuações na horizontal, escrever todas vira um borrão.
    const salto = Math.ceil(colunas.length / 24);
    if (i % salto !== 0 && i !== colunas.length - 1) continue;
    texto(ctx, porPontos ? ordinal(valor) : valor,
          x0 + (i + 0.5) * largura, y,
          { tamanho: 10, alinha: "center", cor: COR.cinzaEscuro });
  }
}

function rotuloDaLinha(ctx, { valor, porPontos, altura, x, y, indice, total }) {
  // Numa coluna de setenta pontuações, um número a cada cinco basta para
  // achar a linha; de vinte posições, escrevem-se todas.
  const salto = altura >= 16 ? 1 : 5;
  if (indice % salto !== 0 && indice !== total - 1) return;
  texto(ctx, porPontos ? valor : ordinal(valor), x, y + altura / 2 + 4,
        { tamanho: Math.min(11.5, Math.max(9, altura)), peso: 700,
          alinha: "right", cor: COR.cinzaEscuro });
}

/* ------------------------------------------------------------------ dica */
function dicaDaCasa(campanhas, pontos, posicao) {
  const MOSTRAR = 7;
  const itens = campanhas.slice(0, MOSTRAR).map((c) => ({
    rotulo: nomeBonito(c.equipe), cor: COR.azul, pontos: null,
    texto: String(c.ano), detalhe: "",
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

/** Quanto uma pontuação costuma render — usado pela página no rodapé. */
export function resumoDaMarca(campanhas, pontos) {
  const resumo = resumoDaPontuacao(campanhas, pontos);
  if (!resumo) return "";
  return `${pontos} pontos já deram do ${ordinal(resumo.melhor)} ao `
       + `${ordinal(resumo.pior)} · média ${num(resumo.media)}`;
}
