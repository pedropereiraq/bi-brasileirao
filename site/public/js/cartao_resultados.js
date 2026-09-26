/**
 * Card: onde foram parar os pontos — mandante, empate ou visitante.
 *
 * A ordem das três partes é sempre a mesma, e é isso que faz a tela funcionar:
 * mandante primeiro, empate no meio, visitante por último. Com a ordem fixa,
 * comparar duas barras é comparar onde as emendas caem. Na barra deitada isso
 * é da esquerda para a direita; na coluna em pé, de cima para baixo — a mesma
 * leitura, virada.
 *
 * **Na edição**, uma coluna por rodada e, em cima, a distribuição do ano
 * inteiro contra a média das outras edições da série. Em pé, cada rodada tem a
 * altura do card inteiro e cabe o número de jogos dentro de cada pedaço: dez
 * jogos por rodada é pouco para uma porcentagem significar alguma coisa, e o
 * "5, 3 e 2" diz o que o "50%" esconde.
 *
 * **No histórico**, uma linha por edição e, em cima, o acumulado de todas.
 * Aqui a pergunta é outra: se o mando vem perdendo força ao longo dos anos, é
 * nesta coluna de barras que isso aparece. E o recorte de rodadas responde a
 * seguinte: se o mando pesa mais no começo do ano do que na reta final.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH,
} from "/js/cartao.js";
import { marcaAtual } from "/js/marca.js";
import {
  acumuladoDaSerie, diferencaEmPontos, edicaoDe, edicoesDaSerie, fracoes,
} from "/js/resultados.js";

const CALHA = 64;
const ALTURA_RESUMO = 126;
// Embaixo das colunas, a fileira dos números de rodada.
const ALTURA_EIXO = 24;

const pct = (v) => `${(v * 100).toFixed(1).replace(".", ",")}%`;
const inteiro = (v) => `${Math.round(v * 100)}%`;
const comSinal = (v) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1).replace(".", ",")}`;

const CORES = () => [COR.azul, COR.cinzaEscuro, COR.negativo];
const NOMES = ["mandante", "empate", "visitante"];

/**
 * O nome de cada desfecho na língua de quem publica.
 *
 * O ECBahia escreve **triunfo** e nunca "vitória"; o Podcast45 escreve
 * **vitória** e nunca "triunfo".
 */
const nomeDoDesfecho = (i) => (i === 1 ? "empates"
  : `${marcaAtual().triunfos} do ${NOMES[i]}`);

export function montarCartao(estado) {
  const { serie, ano, modo, resultados, intervalo } = estado;
  if (!resultados) return null;

  return modo === "historico"
    ? cartaoDoHistorico({ serie, resultados, intervalo })
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
      const x0 = MARGEM;
      const x1 = CARD.largura - MARGEM;

      resumoDaEdicao(ctx, {
        edicao, historico, diferenca, jogos, x0, x1, y: topo,
      });

      const inicio = topo + ALTURA_RESUMO + 34;
      legenda(ctx, { x: MARGEM, y: inicio - 16 });

      const alvos = colunasDasRodadas(ctx, {
        rodadas: edicao.rodadas, x0, x1, topo: inicio, base: base - ALTURA_EIXO,
      });

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
 * Uma coluna por rodada.
 *
 * Em pé, e não deitada: assim cada rodada tem a altura inteira do card, e
 * dentro de cada pedaço cabe o número de jogos. A ordem de cima para baixo é a
 * mesma da esquerda para a direita nas barras de resumo — mandante, empate,
 * visitante —, e é ela que deixa as emendas comparáveis entre as colunas.
 */
function colunasDasRodadas(ctx, { rodadas, x0, x1, topo, base }) {
  const cores = CORES();
  const largura = (x1 - x0) / rodadas.length;
  const altura = base - topo;
  const alvos = [];

  for (const [i, linha] of rodadas.entries()) {
    const x = x0 + i * largura;
    const fracao = fracoes(linha);

    texto(ctx, i + 1, x + largura / 2, base + 16,
          { tamanho: 10.5, peso: 700, alinha: "center", cor: COR.cinzaEscuro });

    if (!fracao) {
      contorno(ctx, x + 1, topo, largura - 2, altura);
    } else {
      let cursor = topo;
      for (const [k, parte] of fracao.entries()) {
        const pedaco = parte * altura;
        if (pedaco <= 0) continue;
        caixa(ctx, x + 1, cursor, largura - 2, pedaco, cores[k], 3);
        // O número de jogos é o que a rodada tem a dizer: com dez jogos, "50%"
        // é uma precisão inventada, e "5" é o fato.
        if (pedaco >= 20 && largura >= 20) {
          texto(ctx, linha[k], x + largura / 2, cursor + pedaco / 2 + 5,
                { tamanho: 14, peso: 800, alinha: "center", cor: COR.branco });
        }
        cursor += pedaco;
      }
    }

    alvos.push({
      x, y: topo, l: largura, a: altura,
      ...dicaDaLinha(linha, fracao, `${i + 1}ª rodada`),
    });
  }

  texto(ctx, "rodadas →", (x0 + x1) / 2, base + 38,
        { tamanho: 10.5, peso: 700, maiuscula: true, espaco: .9,
          alinha: "center", cor: COR.cinzaEscuro });
  return alvos;
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
               rotulo: "a edição", numeros: true, tamanho: 13,
               contar: true });

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
function cartaoDoHistorico({ serie, resultados, intervalo }) {
  const edicoes = edicoesDaSerie(resultados, { serie, intervalo })
    .filter((e) => e.total.some((v) => v > 0));
  if (!edicoes.length) return null;

  const acumulado = acumuladoDaSerie(resultados, { serie, intervalo });
  const recorte = recorteEmPalavras(intervalo);

  const spec = {
    titulo: `Mandante, empate e visitante na Série ${serie}, edição por edição`
          + `${recorte ? `, ${recorte}` : ""}`,
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

/**
 * "da 1ª à 19ª rodada", para entrar no título.
 *
 * Quem chama manda `null` quando o recorte é o campeonato inteiro: é a página
 * que sabe quantas rodadas a série tem, e "da 1ª à 38ª" no título seria
 * ocupar a linha para dizer que não há recorte nenhum.
 */
function recorteEmPalavras(intervalo) {
  if (!intervalo) return "";
  const { de, ate } = intervalo;
  if (de === ate) return `só na ${de}ª rodada`;
  return `da ${de}ª à ${ate}ª rodada`;
}

/* ------------------------------------------------------------------ barra */
/**
 * Uma barra empilhada, sempre na mesma ordem.
 *
 * Linha sem jogo sai vazia, e não zerada: uma rodada por disputar não é uma
 * rodada de zero vitórias do mandante.
 */
function barra(ctx, { linha, x, largura, y, altura, rotulo, numeros = false,
                      tamanho = 12, apagada = false, contar = false }) {
  const fracao = fracoes(linha);
  if (!fracao) {
    contorno(ctx, x, y, largura, altura);
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
      const escrito = contar ? `${inteiro(parte)} · ${linha[i]}` : inteiro(parte);
      texto(ctx, escrito, cursor + pedaco / 2, y + altura / 2 + tamanho * .35,
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

/** O retângulo vazado de uma linha sem jogo disputado. */
function contorno(ctx, x, y, largura, altura) {
  ctx.save();
  ctx.strokeStyle = COR.linha;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + .5, y + .5, largura - 1, altura - 1, 4);
  ctx.stroke();
  ctx.restore();
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
  const jogos = (linha ?? []).reduce((s, v) => s + v, 0);
  return {
    n: rotulo,
    itens: NOMES.map((nome, i) => ({
      rotulo: nomeDoDesfecho(i),
      cor: cores[i], pontos: null,
      texto: `${linha?.[i] ?? 0}`,
      detalhe: fracao ? pct(fracao[i]) : "",
    })),
    diferenca: {
      rotulo: jogos
        ? `${jogos} ${jogos === 1 ? "jogo" : "jogos"}`
        : "sem jogo disputado",
      texto: jogos ? "na conta desta linha" : "",
      cor: COR.azulEscuro,
    },
  };
}
