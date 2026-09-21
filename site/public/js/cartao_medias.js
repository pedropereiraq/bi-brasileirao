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
 *
 * A rampa para no azul médio de propósito. Indo até o azul cheio, o número
 * precisava virar branco no meio da coluna, e uma tabela em que a fonte troca
 * de cor sozinha se lê pior do que uma com menos contraste de fundo — o olho
 * passa a procurar o motivo da troca. Assim o número é sempre azul-escuro.
 */
import { CARD, COR, MARGEM, texto, caixa, cortar } from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import {
  POSICOES, comparacaoComAMedia, estatisticasPorPosicao, grade,
} from "/js/media_posicao.js";
import { zonaDaPosicao, zonasDaFaixa } from "/js/similares.js";

const ALTURA_LINHA = 30;
const VAO_COLUNA = 2;

// A rampa da grade: cinza claro quente na menor pontuação do ano, azul médio
// na maior. O teto é escolhido para o azul-escuro do número continuar legível
// em cima dele do começo ao fim da coluna.
const RAMPA_BAIXO = "#E7E4DE";
const RAMPA_ALTO = "#7EAFD8";

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

      const larguraGrade = 1026;
      const alvos = desenharGrade(ctx, {
        colunas, estatisticas, faixa, cores, escolhida,
        x: MARGEM, largura: larguraGrade, y: y + 44,
      });

      const xPainel = MARGEM + larguraGrade + 20;
      const doPainel = painelDoAno(ctx, {
        comparada, estatisticas, escolhida, clubes, faixa, cores,
        x: xPainel, largura: CARD.largura - MARGEM - xPainel, y: y + 44,
      });

      spec.hover = {
        pontos: [...alvos, ...doPainel], eixo: "caixa", unidade: "",
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
      ctx.fillStyle = mistura(RAMPA_BAIXO, RAMPA_ALTO, t);
      ctx.fillRect(xc, yLinha, larguraAno, ALTURA_LINHA);
      ctx.restore();

      texto(ctx, celula.pontos, xc + larguraAno / 2, yLinha + ALTURA_LINHA / 2 + 5,
            { tamanho: 15, peso: 800, alinha: "center", cor: COR.azulEscuro });

      // Onde aquele clube **terminou** — informação que a grade sozinha não
      // tem — num pontinho no canto. A borda que fazia esse papel disputava a
      // atenção com o número e quebrava a continuidade da coluna; o ponto fica
      // fora do caminho e não desloca nada.
      const cor = celula.posFim === null
        ? null : cores[zonaDaPosicao(celula.posFim, faixa)];
      if (cor) marcaDeDestino(ctx, xc + larguraAno - 6, yLinha + 6, cor);

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

/** Pontinho com anel claro: legível em qualquer ponto da rampa. */
function marcaDeDestino(ctx, x, y, cor) {
  ctx.save();
  ctx.fillStyle = COR.branco;
  ctx.beginPath();
  ctx.arc(x, y, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
/**
 * O ano escolhido contra o que cada posição costuma valer.
 *
 * Os números de mínimo, média e máximo eram três colunas ao lado da
 * classificação, e ler "57, mín 51, méd 58,0, máx 67" exigia montar a régua na
 * cabeça a cada linha. Aqui a régua está desenhada: o trilho vai do mínimo ao
 * máximo, e o ponto marca onde este ano caiu.
 *
 * O destaque é a **diferença**, não o valor: o traço grosso sai da média e vai
 * até o ponto, então ela se lê pelo comprimento e pela cor ao mesmo tempo. A
 * média em si fica do lado de fora, em número — dentro do gráfico seria mais
 * uma marca competindo com o ponto.
 */
function painelDoAno(ctx, { comparada, estatisticas, escolhida, clubes, faixa,
                            cores, x, largura, y }) {
  const larguraTime = 52;
  const centroTime = x + 20 + larguraTime / 2;
  const xPts = x + 106;
  const xMin = x + 134, trilho = { de: x + 140, ate: x + 300 }, xMax = x + 306;
  const xMed = x + 372;
  const xDif = x + largura - 4, larguraDif = 56;

  texto(ctx, `${escolhida?.ano ?? ""}`, x + 11, y + 16,
        { tamanho: 11.5, peso: 800, alinha: "center", cor: COR.azul });
  const rotulo = (texto_, xr, alinha) =>
    texto(ctx, texto_, xr, y + 16,
          { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .7,
            alinha, cor: COR.cinzaEscuro });
  rotulo("time", centroTime, "center");
  rotulo("pts", xPts, "right");
  rotulo("mín", xMin, "right");
  rotulo("máx", xMax, "left");
  rotulo("méd", xMed, "right");
  rotulo("dif", xDif, "right");

  // A escala da diferença é a da própria coluna: cinza no zero, azul quanto
  // mais acima da média, vermelho quanto mais abaixo.
  const maiorDif = Math.max(1, ...comparada.map((l) => Math.abs(l.diferenca ?? 0)));
  const alvos = [];

  for (const [i, linha] of comparada.entries()) {
    const yLinha = y + 26 + i * ALTURA_LINHA;
    const meio = yLinha + ALTURA_LINHA / 2 + 3;
    const estatistica = estatisticas[i];
    caixa(ctx, x, yLinha, largura, ALTURA_LINHA - 2,
          i % 2 ? COR.fundo : COR.branco, 3);

    const corFim = linha.posFim === null
      ? null : cores[zonaDaPosicao(linha.posFim, faixa)];
    texto(ctx, linha.posicao, x + 11, meio,
          { tamanho: 12, peso: 800, alinha: "center",
            cor: corFim ?? COR.cinzaEscuro });

    const sigla = clubes?.[linha.equipe]?.sigla
      ?? nomeBonito(linha.equipe).slice(0, 3).toUpperCase();
    texto(ctx, cortar(ctx, sigla, larguraTime, 12.5, 700), centroTime, meio,
          { tamanho: 12.5, peso: 700, alinha: "center", cor: COR.azulEscuro });
    texto(ctx, linha.pontos, xPts, meio,
          { tamanho: 12.5, peso: 800, alinha: "right", cor: COR.azulEscuro });

    alvos.push({
      n: `${escolhida?.ano ?? ""} · ${ordinal(linha.posicao)}`,
      x, y: yLinha, l: largura, a: ALTURA_LINHA - 2,
      ...dicaDaCelula(linha, { media: estatistica.media }),
    });

    if (estatistica.media === null) continue;

    const { minimo, maximo, media } = estatistica;
    // A escala abre para caber o ano escolhido: o mínimo e o máximo vêm das
    // edições encerradas, e o ano em curso pode estar fora dos dois.
    const piso = Math.min(minimo, linha.pontos, media);
    const teto = Math.max(maximo, linha.pontos, media);
    const onde = (v) => (teto === piso ? (trilho.de + trilho.ate) / 2
      : trilho.de + ((v - piso) / (teto - piso)) * (trilho.ate - trilho.de));

    texto(ctx, minimo, xMin, meio,
          { tamanho: 11, alinha: "right", cor: COR.cinzaEscuro });
    texto(ctx, maximo, xMax, meio,
          { tamanho: 11, alinha: "left", cor: COR.cinzaEscuro });

    caixa(ctx, onde(minimo), meio - 8, Math.max(2, onde(maximo) - onde(minimo)), 5,
          COR.cinzaClaro, 2.5);

    const t = Math.min(1, Math.abs(linha.diferenca) / maiorDif);
    const forte = linha.diferenca >= 0
      ? mistura(COR.cinza, COR.azul, Math.max(t, 0.18))
      : mistura(COR.cinza, COR.vermelho, Math.max(t, 0.18));

    // O traço da média até o ponto: é a diferença virando comprimento.
    const de = Math.min(onde(media), onde(linha.pontos));
    const ate = Math.max(onde(media), onde(linha.pontos));
    caixa(ctx, de, meio - 8, Math.max(2, ate - de), 5, forte, 2.5);

    ctx.save();
    ctx.fillStyle = COR.fundo;
    ctx.beginPath();
    ctx.arc(onde(linha.pontos), meio - 5.5, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = forte;
    ctx.beginPath();
    ctx.arc(onde(linha.pontos), meio - 5.5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    texto(ctx, num(media), xMed, meio,
          { tamanho: 12, alinha: "right", cor: COR.cinzaTexto });

    caixa(ctx, xDif - larguraDif, yLinha + 3, larguraDif, ALTURA_LINHA - 8,
          forte, 4);
    texto(ctx, comSinal(linha.diferenca), xDif - larguraDif / 2, meio,
          { tamanho: 12, peso: 800, alinha: "center",
            cor: t > 0.48 ? COR.branco : COR.azulEscuro });
  }

  return alvos;
}
