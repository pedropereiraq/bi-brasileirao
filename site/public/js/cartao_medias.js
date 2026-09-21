/**
 * Card: a pontuação de cada posição numa rodada, edição por edição.
 *
 * A grade é o card. Cada linha é uma posição da tabela, cada coluna é uma
 * edição, e a cor de cada quadrado diz o quanto aquela pontuação foge da média
 * daquela posição. É assim que se lê de relance se a briga pelo título está
 * mais dura que o normal ou se o meio da tabela está mais embolado.
 *
 * A cor varia dentro de cada ano: a maior pontuação da coluna é o azul cheio e
 * a menor é o cinza, com todo o resto no meio do caminho. Como a pontuação cai
 * de cima para baixo na tabela, cada coluna vira um degradê — e o que se
 * compara de um ano para o outro é o **formato** dele. Ano com líder disparado
 * tem um salto no alto; campeonato embolado tem uma rampa mansa.
 *
 * Os quadrados de um mesmo ano se encostam, sem vão nem canto arredondado: é o
 * que faz a coluna se ler como uma faixa contínua em vez de vinte pastilhas.
 * O vão fica só entre um ano e outro, que é a divisão que importa.
 */
import { CARD, COR, MARGEM, texto, caixa, cortar } from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import {
  POSICOES, comparacaoComAMedia, estatisticasPorPosicao, grade,
} from "/js/media_posicao.js";
import { zonaDaPosicao, zonasDaFaixa } from "/js/similares.js";

const ALTURA_LINHA = 30;
const VAO_COLUNA = 2;

const num = (v, casas = 1) => v.toFixed(casas).replace(".", ",");
const ordinal = (p) => `${p}º`;
const comSinal = (v) => (v > 0 ? `+${num(v)}` : v < 0 ? `−${num(-v)}` : "0");

/** Verde acima, vermelho abaixo — a borda marca o destino, não a pontuação. */
function coresDasZonas(faixa) {
  const zonas = zonasDaFaixa(faixa, POSICOES);
  if (zonas.length >= 3) {
    return { acima: COR.verde, dentro: null, abaixo: COR.vermelho };
  }
  if (zonas.length === 2) {
    return { [zonas[0].nome]: COR.verde, [zonas[1].nome]: COR.vermelho };
  }
  return { [zonas[0].nome]: null };
}

/** Interpola duas cores hexadecimais. */
function mistura(de, para, t) {
  const canal = (cor, i) => parseInt(cor.slice(1 + i * 2, 3 + i * 2), 16);
  const valor = (i) => Math.round(canal(de, i) + (canal(para, i) - canal(de, i)) * t);
  return `rgb(${valor(0)}, ${valor(1)}, ${valor(2)})`;
}

export function montarCartao(estado) {
  const { serie, rodada, faixa, anoEscolhido, clubes, posicoes } = estado;
  if (!posicoes || !rodada) return null;

  const colunas = grade(posicoes, { serie, rodada });
  if (!colunas.length) return null;

  const estatisticas = estatisticasPorPosicao(colunas);
  const cores = coresDasZonas(faixa);
  const escolhida = colunas.find((c) => c.ano === anoEscolhido) ?? colunas.at(-1);
  const comparada = comparacaoComAMedia(escolhida, estatisticas);

  const spec = {
    titulo: `Média de pontuação por posição na ${rodada}ª rodada `
          + `da Série ${serie}`,
    subtitulo: "",
    arquivo: `medias-${serie}-rodada${rodada}`,
    numeros: [],
    nota: "",
    corpo: async (ctx, y) => {
      legenda(ctx, { colunas, estatisticas, y: y + 10 });

      const larguraGrade = 1076;
      const alvos = desenharGrade(ctx, {
        colunas, estatisticas, faixa, cores, escolhida,
        x: MARGEM, largura: larguraGrade, y: y + 44,
      });

      const xPainel = MARGEM + larguraGrade + 18;
      painelDasEstatisticas(ctx, { estatisticas, x: xPainel, largura: 156, y: y + 44 });
      painelDaClassificacao(ctx, {
        comparada, escolhida, clubes, faixa, cores,
        x: xPainel + 170, largura: CARD.largura - MARGEM - (xPainel + 170),
        y: y + 44,
      });

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: y + 44, alturaPlot: POSICOES * ALTURA_LINHA + 30,
        x0: MARGEM, x1: MARGEM + larguraGrade,
        // Só o cabeçalho troca o ano. Clicar num número é o gesto de quem
        // quer ler aquele número, não de quem quer trocar o painel.
        aoClicar: (alvo) => {
          if (alvo.cabecalho) estado.aoEscolherAno?.(alvo.ano);
        },
      };
    },
  };
  return spec;
}

function legenda(ctx, { colunas, estatisticas, y }) {
  const n = estatisticas.find((e) => e.n)?.n ?? 0;
  texto(ctx, `${colunas.length} edições na grade · a média, o mínimo e o máximo `
           + `saem das ${n} já encerradas · clique no ano para trocá-lo no painel `
           + `da direita`,
        MARGEM, y, { tamanho: 12.5, cor: COR.cinzaEscuro });
}

/* --------------------------------------------------------------- grade */
function desenharGrade(ctx, { colunas, estatisticas, faixa, cores, escolhida,
                              x, largura, y }) {
  const larguraPos = 38;
  const larguraAno =
    (largura - larguraPos - VAO_COLUNA * colunas.length) / colunas.length;
  const xDaColuna = (i) => x + larguraPos + i * (larguraAno + VAO_COLUNA);
  const yDaLinha = (p) => y + 26 + (p - 1) * ALTURA_LINHA;

  texto(ctx, "pos", x + larguraPos - 8, y + 16,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .7,
          alinha: "right", cor: COR.cinzaEscuro });

  const alvos = [];

  for (const [i, coluna] of colunas.entries()) {
    const selecionada = coluna.ano === escolhida?.ano;
    if (selecionada) {
      caixa(ctx, xDaColuna(i) - 3, y, larguraAno + 6, 24, COR.azul, 4);
    }
    texto(ctx, coluna.ano, xDaColuna(i) + larguraAno / 2, y + 16,
          { tamanho: 11.5, peso: selecionada ? 800 : 700, alinha: "center",
            cor: selecionada ? COR.branco : COR.azulEscuro });

    alvos.push({
      n: coluna.ano, ano: coluna.ano, cabecalho: true,
      x: xDaColuna(i) - 3, y, l: larguraAno + 6, a: 24,
      itens: [{
        rotulo: `Série de ${coluna.ano}`,
        cor: COR.azul,
        pontos: null,
        detalhe: coluna.encerrada ? "edição encerrada" : "edição em andamento",
      }],
      diferenca: {
        rotulo: selecionada ? "no painel" : "clique",
        texto: selecionada ? "é esta edição que a direita mostra"
                           : "para ver esta edição no painel da direita",
        cor: COR.azul,
      },
    });
  }

  for (const [i, coluna] of colunas.entries()) {
    const pontos = coluna.celulas.map((c) => c.pontos);
    const alto = Math.max(...pontos), baixo = Math.min(...pontos);
    // A escala é do próprio ano: o maior da coluna vai a azul cheio e o menor
    // a cinza. Campeonato com pontuações apertadas gera um degradê manso, e é
    // essa diferença de formato que se compara de um ano para o outro.
    const forca = (valor) => (alto === baixo ? 1 : (valor - baixo) / (alto - baixo));

    const xc = xDaColuna(i);
    for (const celula of coluna.celulas) {
      const yLinha = yDaLinha(celula.posicao);
      const t = forca(celula.pontos);

      ctx.save();
      ctx.fillStyle = mistura(COR.cinza, COR.azul, t);
      ctx.fillRect(xc, yLinha, larguraAno, ALTURA_LINHA);
      ctx.restore();

      // A borda marca onde aquele clube **terminou**, e não como ele estava
      // nesta rodada: é a informação que a grade sozinha não tem.
      const cor = celula.posFim === null
        ? null : cores[zonaDaPosicao(celula.posFim, faixa)];
      if (cor) {
        ctx.save();
        ctx.strokeStyle = cor;
        ctx.lineWidth = 2;
        ctx.strokeRect(xc + 1, yLinha + 1, larguraAno - 2, ALTURA_LINHA - 2);
        ctx.restore();
      }

      texto(ctx, celula.pontos, xc + larguraAno / 2, yLinha + ALTURA_LINHA / 2 + 4,
            { tamanho: 12.5, peso: 800, alinha: "center",
              cor: t > 0.48 ? COR.branco : COR.azulEscuro });

      alvos.push({
        n: `${coluna.ano} · ${ordinal(celula.posicao)}`,
        ano: coluna.ano,
        x: xc, y: yLinha, l: larguraAno, a: ALTURA_LINHA,
        ...dicaDaCelula(celula, { media: estatisticas[celula.posicao - 1].media }),
      });
    }
  }

  for (let pos = 1; pos <= POSICOES; pos++) {
    texto(ctx, pos, x + larguraPos - 8, yDaLinha(pos) + ALTURA_LINHA / 2 + 4,
          { tamanho: 12, peso: 800, alinha: "right", cor: COR.cinzaEscuro });
  }
  return alvos;
}

function dicaDaCelula(celula, { media }) {
  const desfecho = celula.posFim === null
    ? "edição em andamento"
    : `terminou em ${ordinal(celula.posFim)} com ${celula.pontosFim} pontos`;

  return {
    itens: [{
      rotulo: nomeBonito(celula.equipe),
      cor: COR.azul,
      pontos: celula.pontos,
      detalhe: desfecho,
    }],
    diferenca: media === null ? null : {
      rotulo: comSinal(celula.pontos - media),
      texto: `média do ${ordinal(celula.posicao)} nesta rodada: ${num(media)}`,
      cor: celula.pontos >= media ? COR.azul : COR.vermelho,
    },
  };
}

/* ------------------------------------------------------------- painéis */
function painelDasEstatisticas(ctx, { estatisticas, x, largura, y }) {
  const colunas = [
    { rotulo: "mín", chave: "minimo", casas: 0 },
    { rotulo: "méd", chave: "media", casas: 1 },
    { rotulo: "máx", chave: "maximo", casas: 0 },
  ];
  const larguraCol = largura / colunas.length;
  const centro = (i) => x + (i + 0.5) * larguraCol;

  for (const [i, coluna] of colunas.entries()) {
    texto(ctx, coluna.rotulo, centro(i), y + 16,
          { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .7,
            alinha: "center", cor: COR.cinzaEscuro });
  }

  for (const [i, estatistica] of estatisticas.entries()) {
    const yLinha = y + 26 + i * ALTURA_LINHA;
    caixa(ctx, x, yLinha, largura, ALTURA_LINHA - 3,
          i % 2 ? COR.fundo : COR.branco, 4);
    for (const [j, coluna] of colunas.entries()) {
      const valor = estatistica[coluna.chave];
      texto(ctx, valor === null ? "—" : num(valor, coluna.casas),
            centro(j), yLinha + ALTURA_LINHA / 2 + 2,
            { tamanho: 12.5, peso: coluna.chave === "media" ? 800 : 400,
              alinha: "center",
              cor: coluna.chave === "media" ? COR.azulEscuro : COR.cinzaTexto });
    }
  }
}

function painelDaClassificacao(ctx, { comparada, escolhida, clubes, faixa, cores,
                                     x, largura, y }) {
  // A sigla vai centralizada numa coluna de largura fixa: alinhada à
  // esquerda, "SPA" e "RBB" ocupam larguras diferentes e a coluna fica torta.
  const larguraTime = 52, xTime = x + 24;
  const centroTime = xTime + larguraTime / 2;
  const xPts = x + 100, xMed = x + 142;
  const xDif = x + largura - 4, larguraDif = 58;

  texto(ctx, `${escolhida?.ano ?? ""}`, x + 11, y + 16,
        { tamanho: 11.5, peso: 800, alinha: "center", cor: COR.azul });
  for (const [rotulo, xr, alinha] of [["time", centroTime, "center"],
                                      ["pts", xPts, "right"],
                                      ["méd", xMed, "right"],
                                      ["dif", xDif, "right"]]) {
    texto(ctx, rotulo, xr, y + 16,
          { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .7,
            alinha, cor: COR.cinzaEscuro });
  }

  // A escala da diferença é a da própria coluna: cinza no zero, azul quanto
  // mais acima da média, vermelho quanto mais abaixo.
  const maiorDif = Math.max(1,
    ...comparada.map((l) => Math.abs(l.diferenca ?? 0)));

  for (const [i, linha] of comparada.entries()) {
    const yLinha = y + 26 + i * ALTURA_LINHA;
    const meio = yLinha + ALTURA_LINHA / 2 + 3;
    caixa(ctx, x, yLinha, largura, ALTURA_LINHA - 2,
          i % 2 ? COR.fundo : COR.branco, 3);

    const cor = linha.posFim === null
      ? null : cores[zonaDaPosicao(linha.posFim, faixa)];
    texto(ctx, linha.posicao, x + 11, meio,
          { tamanho: 12, peso: 800, alinha: "center",
            cor: cor ?? COR.cinzaEscuro });

    const sigla = clubes?.[linha.equipe]?.sigla
      ?? nomeBonito(linha.equipe).slice(0, 3).toUpperCase();
    texto(ctx, cortar(ctx, sigla, larguraTime, 12.5, 700), centroTime, meio,
          { tamanho: 12.5, peso: 700, alinha: "center", cor: COR.azulEscuro });

    texto(ctx, linha.pontos, xPts, meio,
          { tamanho: 12.5, peso: 800, alinha: "right", cor: COR.azulEscuro });
    texto(ctx, linha.media === null ? "—" : num(linha.media), xMed, meio,
          { tamanho: 12, alinha: "right", cor: COR.cinzaTexto });

    if (linha.diferenca === null) continue;
    const t = Math.min(1, Math.abs(linha.diferenca) / maiorDif);
    const fundo = linha.diferenca >= 0
      ? mistura(COR.cinza, COR.azul, t)
      : mistura(COR.cinza, COR.vermelho, t);
    caixa(ctx, xDif - larguraDif, yLinha + 3, larguraDif, ALTURA_LINHA - 8,
          fundo, 4);
    texto(ctx, comSinal(linha.diferenca), xDif - larguraDif / 2, meio,
          { tamanho: 12, peso: 800, alinha: "center",
            cor: t > 0.48 ? COR.branco : COR.azulEscuro });
  }
}
