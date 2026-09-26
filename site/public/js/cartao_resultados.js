/**
 * Card: onde foram parar os pontos — mandante, empate ou visitante.
 *
 * Uma barra empilhada por linha, sempre com as três partes na mesma ordem:
 * azul do mandante à esquerda, cinza do empate no meio, vermelho do visitante
 * à direita. Com a ordem fixa, comparar duas linhas é comparar onde as
 * emendas caem — e é isso que se quer ver.
 *
 * **Na edição**, uma linha por rodada e, em cima, a distribuição do ano
 * inteiro contra a média das outras edições da série. A rodada isolada é
 * ruidosa — dez jogos —, e é a barra de cima que diz se o ano fugiu do normal.
 *
 * **No histórico**, uma linha por edição e, em cima, o acumulado de todas.
 * Aqui a pergunta é outra: se o mando vem perdendo força ao longo dos anos, é
 * nesta coluna de barras que isso aparece.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH,
} from "/js/cartao.js";
import {
  acumuladoDaSerie, diferencaEmPontos, edicaoDe, edicoesDaSerie, fracoes,
} from "/js/resultados.js";

const CALHA = 64;
const ALTURA_RESUMO = 126;

const pct = (v) => `${(v * 100).toFixed(1).replace(".", ",")}%`;
const inteiro = (v) => `${Math.round(v * 100)}%`;
const comSinal = (v) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1).replace(".", ",")}`;

const CORES = () => [COR.azul, COR.cinzaEscuro, COR.negativo];
const NOMES = ["mandante", "empate", "visitante"];

export function montarCartao(estado) {
  const { serie, ano, modo, resultados } = estado;
  if (!resultados) return null;

  return modo === "historico"
    ? cartaoDoHistorico({ serie, resultados })
    : cartaoDaEdicao({ serie, ano, resultados });
}

/* ------------------------------------------------------------ na edição */
function cartaoDaEdicao({ serie, ano, resultados }) {
  const edicao = edicaoDe(resultados, { serie, ano });
  if (!edicao) return null;

  const historico = acumuladoDaSerie(resultados, { serie, exceto: Number(ano) });
  const diferenca = diferencaEmPontos(edicao.total, historico.total);
  const jogos = edicao.total.reduce((s, v) => s + v, 0);

  const spec = {
    titulo: `Mandante, empate e visitante na Série ${serie} ${ano}`,
    subtitulo: "",
    arquivo: `resultados-${serie}-${ano}`,
    numeros: [],
    nota: `A média da série é o acumulado das outras ${historico.edicoes} `
        + `edições encerradas, sem esta. Rodada sem jogo disputado fica em `
        + `branco.`,
    corpo: async (ctx, y) => {
      const topo = y + 20;
      const base = CARD.altura - 84;
      const x0 = MARGEM + CALHA;
      const x1 = CARD.largura - MARGEM;

      resumoDaEdicao(ctx, {
        edicao, historico, diferenca, jogos, x0, x1, y: topo,
      });

      const inicio = topo + ALTURA_RESUMO + 30;
      legenda(ctx, { x: MARGEM, y: inicio - 14 });

      const alturaLinha = (base - inicio) / edicao.rodadas.length;
      const alvos = [];
      for (const [i, linha] of edicao.rodadas.entries()) {
        const yl = inicio + i * alturaLinha;
        texto(ctx, `${i + 1}ª`, x0 - 12, yl + alturaLinha / 2 + 4,
              { tamanho: 11, peso: 700, alinha: "right", cor: COR.cinzaEscuro });
        alvos.push(...barra(ctx, {
          linha, x: x0, largura: x1 - x0, y: yl + 2,
          altura: alturaLinha - 4, rotulo: `${i + 1}ª rodada`,
          numeros: alturaLinha >= 22,
        }));
      }

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: y, alturaPlot: base - y,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
      };
    },
  };
  return spec;
}

/**
 * A barra do ano inteiro, e a da série ao lado.
 *
 * As duas empilhadas uma sobre a outra, na mesma escala: a comparação é
 * vertical, e qualquer número ao lado seria uma segunda leitura do que as
 * emendas já dizem.
 */
function resumoDaEdicao(ctx, { edicao, historico, diferenca, jogos, x0, x1, y }) {
  // Os rótulos vão acima de cada barra, e não à esquerda: as barras ocupam
  // a largura inteira do card, e ao lado delas não sobra lugar.
  const largura = x1 - x0;
  const fracao = fracoes(edicao.total);
  const rotulo = (t, yr) =>
    texto(ctx, t, x0, yr, { tamanho: 9.5, peso: 700, maiuscula: true,
                            espaco: .8, cor: COR.cinzaEscuro });

  rotulo(`esta edição · ${jogos} jogos`, y + 10);
  barra(ctx, { linha: edicao.total, x: x0, largura, y: y + 18, altura: 34,
               rotulo: "a edição", numeros: true, tamanho: 13 });

  rotulo(`a série · outras ${historico.edicoes} edições`, y + 70);
  barra(ctx, { linha: historico.total, x: x0, largura, y: y + 78, altura: 22,
               rotulo: "a série", numeros: true, tamanho: 11, apagada: true });

  // A diferença vai debaixo de cada emenda, onde ela é a leitura.
  if (!diferenca || !fracao) return;
  let cursor = x0;
  for (const [i, parte] of fracao.entries()) {
    const pedaco = parte * largura;
    texto(ctx, `${comSinal(diferenca[i])} p.p.`, cursor + pedaco / 2, y + 116,
          { tamanho: 11.5, peso: 700, alinha: "center",
            cor: Math.abs(diferenca[i]) < 1 ? COR.cinzaEscuro : CORES()[i] });
    cursor += pedaco;
  }
}

/* -------------------------------------------------------------- histórico */
function cartaoDoHistorico({ serie, resultados }) {
  const edicoes = edicoesDaSerie(resultados, { serie })
    .filter((e) => e.total.some((v) => v > 0));
  if (!edicoes.length) return null;

  const acumulado = acumuladoDaSerie(resultados, { serie });

  const spec = {
    titulo: `Mandante, empate e visitante na Série ${serie}, edição por edição`,
    subtitulo: "",
    arquivo: `resultados-${serie}-historico`,
    numeros: [],
    nota: "O acumulado soma as edições encerradas. A edição em andamento "
        + "aparece na lista, mas fica fora dele.",
    corpo: async (ctx, y) => {
      const topo = y + 20;
      const base = CARD.altura - 84;
      const x0 = MARGEM + CALHA;
      const x1 = CARD.largura - MARGEM;

      texto(ctx, `todas · ${acumulado.edicoes} edições encerradas`,
            x0, topo + 10,
            { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
              cor: COR.cinzaEscuro });
      barra(ctx, { linha: acumulado.total, x: x0, largura: x1 - x0,
                   y: topo + 18, altura: 34, rotulo: "todas as edições",
                   numeros: true, tamanho: 13 });
      linhaH(ctx, MARGEM, x1, topo + 66, COR.linha);

      const inicio = topo + 92;
      legenda(ctx, { x: MARGEM, y: inicio - 16 });

      const alturaLinha = (base - inicio) / edicoes.length;
      const alvos = [];
      for (const [i, edicao] of edicoes.entries()) {
        const yl = inicio + i * alturaLinha;
        texto(ctx, edicao.ano, x0 - 12, yl + alturaLinha / 2 + 4,
              { tamanho: 12, peso: 800, alinha: "right",
                cor: edicao.encerrada ? COR.azulEscuro : COR.cinzaEscuro });
        alvos.push(...barra(ctx, {
          linha: edicao.total, x: x0, largura: x1 - x0, y: yl + 2,
          altura: alturaLinha - 4, rotulo: `${edicao.ano}`,
          numeros: alturaLinha >= 22,
          apagada: !edicao.encerrada,
        }));
      }

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: y, alturaPlot: base - y,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
      };
    },
  };
  return spec;
}

/* ------------------------------------------------------------------ barra */
/**
 * Uma barra empilhada, sempre na mesma ordem.
 *
 * Linha sem jogo sai vazia, e não zerada: uma rodada por disputar não é uma
 * rodada de zero vitórias do mandante.
 */
function barra(ctx, { linha, x, largura, y, altura, rotulo, numeros = false,
                      tamanho = 12, apagada = false }) {
  const fracao = fracoes(linha);
  if (!fracao) {
    ctx.save();
    ctx.strokeStyle = COR.linha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + .5, y + .5, largura - 1, altura - 1, 4);
    ctx.stroke();
    ctx.restore();
    return [];
  }

  const cores = CORES();
  const alvos = [];
  let cursor = x;
  for (const [i, parte] of fracao.entries()) {
    const pedaco = parte * largura;
    if (pedaco <= 0) continue;
    ctx.save();
    ctx.globalAlpha = apagada ? .45 : 1;
    caixa(ctx, cursor, y, pedaco, altura, cores[i], 3);
    ctx.restore();

    if (numeros && pedaco > 42) {
      texto(ctx, inteiro(parte), cursor + pedaco / 2, y + altura / 2 + tamanho * .35,
            { tamanho, peso: 800, alinha: "center", cor: COR.branco });
    }
    cursor += pedaco;
  }

  alvos.push({
    x, y, l: largura, a: altura,
    ...dicaDaLinha(linha, fracao, rotulo),
  });
  return alvos;
}

function legenda(ctx, { x, y }) {
  const cores = CORES();
  let cursor = x;
  for (const [i, nome] of NOMES.entries()) {
    caixa(ctx, cursor, y - 9, 12, 12, cores[i], 3);
    texto(ctx, nome, cursor + 18, y + 1,
          { tamanho: 10.5, peso: 700, cor: COR.cinzaEscuro });
    cursor += 18 + nome.length * 6.2 + 22;
  }
}

function dicaDaLinha(linha, fracao, rotulo) {
  const cores = CORES();
  const jogos = linha.reduce((s, v) => s + v, 0);
  return {
    n: rotulo,
    itens: NOMES.map((nome, i) => ({
      rotulo: nome === "empate" ? "empates" : `vitórias do ${nome}`,
      cor: cores[i], pontos: null,
      texto: `${linha[i]}`,
      detalhe: pct(fracao[i]),
    })),
    diferenca: {
      rotulo: `${jogos} ${jogos === 1 ? "jogo" : "jogos"}`,
      texto: "na conta desta linha",
      cor: COR.azulEscuro,
    },
  };
}
