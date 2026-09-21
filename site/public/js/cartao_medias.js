/**
 * Card: a pontuação de cada posição numa rodada, edição por edição.
 *
 * A grade é o card. Cada linha é uma posição da tabela, cada coluna é uma
 * edição, e a cor de cada quadrado diz o quanto aquela pontuação foge da média
 * daquela posição. É assim que se lê de relance se a briga pelo título está
 * mais dura que o normal ou se o meio da tabela está mais embolado.
 *
 * A cor é divergente e não sequencial: uma rampa de claro a escuro diria
 * "pouco a muito", que já está escrito no número. O que o número não diz é se
 * aquilo é muito **para aquela posição** — 20 pontos na rodada 10 é campanha
 * de líder num ano e de quinto colocado em outro.
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

      const larguraGrade = 1012;
      const alvos = desenharGrade(ctx, {
        colunas, estatisticas, faixa, cores, escolhida,
        x: MARGEM, largura: larguraGrade, y: y + 44,
      });

      const xPainel = MARGEM + larguraGrade + 20;
      painelDasEstatisticas(ctx, { estatisticas, x: xPainel, largura: 162, y: y + 44 });
      painelDaClassificacao(ctx, {
        comparada, escolhida, clubes, faixa, cores,
        x: xPainel + 176, largura: CARD.largura - MARGEM - (xPainel + 176),
        y: y + 44,
      });

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: y + 44, alturaPlot: POSICOES * ALTURA_LINHA + 30,
        x0: MARGEM, x1: MARGEM + larguraGrade,
        aoClicar: (alvo) => estado.aoEscolherAno?.(alvo.ano),
      };
    },
  };
  return spec;
}

function legenda(ctx, { colunas, estatisticas, y }) {
  const n = estatisticas.find((e) => e.n)?.n ?? 0;
  texto(ctx, `${colunas.length} edições na grade · a média, o mínimo e o máximo `
           + `saem das ${n} já encerradas · clique numa coluna para trocar o ano `
           + `do painel da direita`,
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

  for (const [i, coluna] of colunas.entries()) {
    const selecionada = coluna.ano === escolhida?.ano;
    if (selecionada) {
      caixa(ctx, xDaColuna(i) - 2, y, larguraAno + 4,
            26 + POSICOES * ALTURA_LINHA + 4, COR.azulLavado, 5);
    }
    texto(ctx, coluna.ano, xDaColuna(i) + larguraAno / 2, y + 16,
          { tamanho: 11.5, peso: selecionada ? 800 : 700, alinha: "center",
            cor: selecionada ? COR.azul
               : coluna.encerrada ? COR.azulEscuro : COR.azul });
  }

  const alvos = [];

  for (let pos = 1; pos <= POSICOES; pos++) {
    const yLinha = yDaLinha(pos);
    texto(ctx, pos, x + larguraPos - 8, yLinha + ALTURA_LINHA / 2 + 4,
          { tamanho: 12, peso: 800, alinha: "right", cor: COR.cinzaEscuro });

    const { media, minimo, maximo } = estatisticas[pos - 1];
    // A escala de cor é por posição: o que é muito para o 1º é pouco para o
    // 20º, e uma escala única pintaria a linha de baixo inteira de vermelho.
    const alcance = media === null
      ? 0 : Math.max(maximo - media, media - minimo, 1);

    for (const [i, coluna] of colunas.entries()) {
      const celula = coluna.celulas[pos - 1];
      if (!celula) continue;

      const t = media === null ? 0
        : Math.max(-1, Math.min(1, (celula.pontos - media) / alcance));
      const fundo = t >= 0
        ? mistura(COR.fundo, COR.azul, t * 0.92)
        : mistura(COR.fundo, COR.vermelho, -t * 0.82);

      const xc = xDaColuna(i);
      caixa(ctx, xc, yLinha, larguraAno, ALTURA_LINHA - 3, fundo, 4);

      // A borda marca onde aquele clube **terminou**, e não como ele estava
      // nesta rodada: é a informação que a grade sozinha não tem.
      const cor = celula.posFim === null
        ? null : cores[zonaDaPosicao(celula.posFim, faixa)];
      if (cor) {
        ctx.save();
        ctx.strokeStyle = cor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(xc + 1, yLinha + 1, larguraAno - 2, ALTURA_LINHA - 5, 4);
        ctx.stroke();
        ctx.restore();
      }

      texto(ctx, celula.pontos, xc + larguraAno / 2, yLinha + ALTURA_LINHA / 2 + 2,
            { tamanho: 12.5, peso: 800, alinha: "center",
              cor: Math.abs(t) > 0.55 ? COR.branco : COR.azulEscuro });

      alvos.push({
        n: `${coluna.ano} · ${ordinal(pos)}`,
        ano: coluna.ano,
        x: xc, y: yLinha, l: larguraAno, a: ALTURA_LINHA - 3,
        ...dicaDaCelula(celula, { media }),
      });
    }
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
  const xTime = x + 30, xPts = x + 128, xMed = x + 178, xDif = x + largura - 6;

  texto(ctx, `${escolhida?.ano ?? ""}`, x + 14, y + 16,
        { tamanho: 11.5, peso: 800, alinha: "center", cor: COR.azul });
  for (const [rotulo, xr] of [["time", xTime], ["pts", xPts],
                              ["méd", xMed], ["dif", xDif]]) {
    texto(ctx, rotulo, rotulo === "time" ? xr : xr, y + 16,
          { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .7,
            alinha: rotulo === "time" ? "left" : "right", cor: COR.cinzaEscuro });
  }

  for (const [i, linha] of comparada.entries()) {
    const yLinha = y + 26 + i * ALTURA_LINHA;
    const meio = yLinha + ALTURA_LINHA / 2 + 2;
    caixa(ctx, x, yLinha, largura, ALTURA_LINHA - 3,
          i % 2 ? COR.fundo : COR.branco, 4);

    const cor = linha.posFim === null
      ? null : cores[zonaDaPosicao(linha.posFim, faixa)];
    texto(ctx, linha.posicao, x + 14, meio,
          { tamanho: 12, peso: 800, alinha: "center",
            cor: cor ?? COR.cinzaEscuro });

    const sigla = clubes?.[linha.equipe]?.sigla
      ?? nomeBonito(linha.equipe).slice(0, 3).toUpperCase();
    texto(ctx, cortar(ctx, sigla, 90, 12.5, 700), xTime, meio,
          { tamanho: 12.5, peso: 700, cor: COR.azulEscuro });

    texto(ctx, linha.pontos, xPts, meio,
          { tamanho: 12.5, peso: 800, alinha: "right", cor: COR.azulEscuro });
    texto(ctx, linha.media === null ? "—" : num(linha.media), xMed, meio,
          { tamanho: 12.5, alinha: "right", cor: COR.cinzaTexto });

    if (linha.diferenca === null) continue;
    const forte = linha.diferenca > 0 ? COR.azul
                : linha.diferenca < 0 ? COR.vermelho : COR.cinzaEscuro;
    const etiqueta = comSinal(linha.diferenca);
    ctx.save();
    ctx.font = '800 12px "Assistant", sans-serif';
    const largo = ctx.measureText(etiqueta).width + 16;
    ctx.restore();
    caixa(ctx, xDif - largo, yLinha + 4, largo, ALTURA_LINHA - 11, forte, 4);
    texto(ctx, etiqueta, xDif - largo / 2, meio,
          { tamanho: 12, peso: 800, alinha: "center", cor: COR.branco });
  }
}
