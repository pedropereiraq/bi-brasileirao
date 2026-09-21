/**
 * Card: a evolução da campanha de um clube, em pontos ou em posição.
 *
 * A pergunta que este card responde não é "quem está na frente", e sim "o que
 * esta campanha está valendo". Comparar com outro clube diz uma coisa;
 * comparar com o que historicamente custa terminar em 4º e em 17º diz outra, e
 * é a que serve para falar de objetivo.
 *
 * As duas leituras não são a mesma linha em escalas diferentes:
 *
 * - **Por pontuação**, o eixo é o n-ésimo jogo, em ordem cronológica: rodada
 *   não é tempo, e um jogo adiado da 4ª disputado em agosto poria o acumulado
 *   de agosto lá atrás. As réguas são retas — a média de quem termina naquela
 *   posição dividida por 38 é o ritmo que a posição exige, não a campanha de
 *   ninguém, e uma curva sugeriria um roteiro que a média não autoriza.
 * - **Por posição**, o eixo é a rodada, porque posição só existe quando todo
 *   mundo jogou o mesmo tanto. As réguas viram retas horizontais e passam meia
 *   posição abaixo do lugar que marcam: a linha do 4º desenhada em 4,5 deixa o
 *   clube *dentro* da faixa enquanto ele estiver em 4º ou melhor.
 *
 * Quanto melhor a posição, mais alta a linha — o eixo é invertido, como a
 * tabela é lida.
 *
 * Verde é sempre a posição melhor e vermelho a pior, as duas pontilhadas: a
 * linha cheia é a única campanha de verdade no card. O verde aqui é literal, e
 * não o "positivo" da paleta — as duas réguas formam uma escala de objetivo, e
 * trocar o verde pelo azul da identidade tiraria o par de cores que se lê sem
 * consultar legenda.
 *
 * Só a linha do clube ganha rótulo em cada ponto; as réguas não têm o que
 * rotular, porque não variam.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar,
} from "/js/cartao.js";
import { nomeBonito, nomeCurto, artigo } from "/js/nomes.js";
import {
  CALHA, CALHA_DIR, JOGOS, campanhaCompleta, disputados, descreverJogo,
  faixaDeJogos, legenda, rotularPontos, tracarLinha,
} from "/js/grafico_campanha.js";
import { campanhaPorRodada } from "/js/diferenca_pontos.js";
import { empilhar } from "/js/empilhar.js";

/** Uma casa decimal e vírgula: a média não é inteira e arredondar mentiria. */
const num = (v) => v.toFixed(1).replace(".", ",");
const ordinal = (posicao) => `${posicao}º`;

export function montarCartao(estado) {
  return estado.modo === "posicao"
    ? cartaoPorPosicao(estado) : cartaoPorPontuacao(estado);
}

/* ===================================================== por pontuação */
function cartaoPorPontuacao(estado) {
  const { serie, edicao, jogos, clube, clubes, referencia, pior, melhor } = estado;
  if (!clube || !jogos || !referencia) return null;

  const agenda = campanhaCompleta(jogos, clube);
  const campanha = disputados(agenda);
  if (!campanha.length) return null;

  const rotulo = `${nomeBonito(clube)} ${edicao.ano}`;
  const media = {
    melhor: referencia.media[String(melhor)],
    pior: referencia.media[String(pior)],
  };
  if (media.melhor === undefined || media.pior === undefined) return null;

  // O ritmo no n-ésimo jogo: a média final repartida igualmente pelos 38.
  const ritmo = (total, n) => (total * n) / JOGOS;
  const fim = campanha.at(-1);

  const spec = {
    titulo: `Evolução da pontuação ${artigo(clube)} ${nomeBonito(clube)}`
          + ` na Série ${serie} ${edicao.ano}`,
    subtitulo: "Jogos em ordem cronológica",
    arquivo: `evolucao-${nomeCurto(clube)}-${edicao.ano}-${melhor}-${pior}`,
    numeros: [],
    nota: `Ritmo = média de pontos de quem terminou naquela posição nas `
        + `${referencia.edicoes} edições encerradas da Série ${serie} `
        + `(${referencia.ano_primeiro}–${referencia.ano_ultimo}), dividida por `
        + `${JOGOS} jogos.`,
    corpo: async (ctx, y) => {
      const { x0, x1, largura, centro, topo, alturaPlot, yEixo } = montarEixo(y);
      const maximo = Math.max(fim.pts, media.melhor, media.pior, 1);
      const escala = (pts) => topo + alturaPlot - (pts / maximo) * alturaPlot;

      await legenda(ctx, MARGEM, y, clubes, [
        { clube, rotulo, cor: COR.azul },
        { rotulo: `ritmo do ${ordinal(melhor)} lugar · ${num(media.melhor)} pts`,
          cor: COR.verde, pontilhada: true },
        { rotulo: `ritmo do ${ordinal(pior)} lugar · ${num(media.pior)} pts`,
          cor: COR.negativo, pontilhada: true },
      ]);

      const passo = Math.max(5, Math.ceil(maximo / 5 / 5) * 5);
      for (let v = 0; v <= maximo; v += passo) {
        linhaH(ctx, x0 - 10, x1, escala(v), COR.cinzaClaro);
        texto(ctx, v, x0 - 18, escala(v) + 5,
              { tamanho: 13, cor: COR.cinzaEscuro, alinha: "right" });
      }

      const reta = (total) => [[centro(1), escala(ritmo(total, 1))],
                               [centro(JOGOS), escala(total)]];
      const linhaMelhor = reta(media.melhor);
      const linhaPior = reta(media.pior);
      tracarLinha(ctx, linhaPior, COR.negativo, { pontilhada: true, espessura: 4 });
      tracarLinha(ctx, linhaMelhor, COR.verde, { pontilhada: true, espessura: 4 });

      const pontos = campanha.map((p) => [centro(p.n), escala(p.pts)]);
      tracarLinha(ctx, pontos, COR.azul);
      bolinhas(ctx, pontos, COR.azul);
      rotularPontos(ctx, {
        pontos: campanha.map((p, i) => ({ x: pontos[i][0], y: pontos[i][1],
                                          texto: p.pts, i })),
        linhas: [linhaMelhor, linhaPior], propria: pontos,
        cor: COR.azulEscuro, topo, base: topo + alturaPlot,
      });

      reguasNaCalha(ctx, {
        x: x1 + 14, topo, limiteBase: topo + alturaPlot - 132,
        itens: [
          { alvo: escala(media.melhor), ancora: centro(JOGOS),
            desenhar: (yy) => pastilha(ctx, x1 + 14, yy, melhor,
                                       `${num(media.melhor)} pts`, COR.verde) },
          { alvo: escala(media.pior), ancora: centro(JOGOS),
            desenhar: (yy) => pastilha(ctx, x1 + 14, yy, pior,
                                       `${num(media.pior)} pts`, COR.negativo) },
        ],
      });

      blocoDeRitmo(ctx, {
        x: x1 + 18, y: topo + alturaPlot - 108, altura: 108,
        fim, media, ritmo, melhor, pior,
      });

      numerosDoEixo(ctx, { centro, yEixo });
      await faixaDeJogos(ctx, { agenda, clube, rotulo, cor: COR.azul, clubes,
                                centro, largura, x: MARGEM, y: yEixo + 16 });

      spec.hover = hoverDaPontuacao({ agenda, rotulo, clube, media, ritmo,
        centro, topo, alturaPlot, x0, x1, largura, melhor, pior });
    },
  };
  return spec;
}

/* ======================================================= por posição */
function cartaoPorPosicao(estado) {
  const { serie, edicao, grade, jogos, clube, clubes, pior, melhor } = estado;
  if (!clube || !grade || !jogos) return null;

  const campanha = campanhaPorRodada(grade, clube);
  if (!campanha.length) return null;

  const total = grade.clubes.length;
  const rotulo = `${nomeBonito(clube)} ${edicao.ano}`;
  // O eixo aqui é a rodada: cada jogo vai para a casa da rodada dele, e não
  // para a ordem em que foi disputado.
  const agenda = campanhaCompleta(jogos, clube)
    .map((passo) => ({ ...passo, n: passo.jogo.rodada }));

  const dentro = campanha.filter((p) => p.posicao <= melhor).length;
  const fora = campanha.filter((p) => p.posicao > pior).length;

  const spec = {
    titulo: `Evolução da posição ${artigo(clube)} ${nomeBonito(clube)}`
          + ` na Série ${serie} ${edicao.ano}`,
    subtitulo: "Posição ao fim de cada rodada",
    arquivo: `posicao-${nomeCurto(clube)}-${edicao.ano}-${melhor}-${pior}`,
    numeros: [],
    nota: "",
    corpo: async (ctx, y) => {
      const { x0, x1, largura, centro, topo, alturaPlot, yEixo } = montarEixo(y);

      // Eixo invertido: o 1º lugar em cima, como a tabela se lê. Cada posição
      // ocupa uma faixa, e o ponto fica no meio dela.
      const escala = (p) => topo + ((p - 0.5) / total) * alturaPlot;
      // A régua passa na fronteira, meia posição abaixo do lugar que marca.
      const fronteira = (p) => topo + (p / total) * alturaPlot;

      await legenda(ctx, MARGEM, y, clubes, [
        { clube, rotulo, cor: COR.azul },
        { rotulo: `${ordinal(melhor)} lugar ou melhor`, cor: COR.verde,
          pontilhada: true },
        { rotulo: `pior que o ${ordinal(pior)} lugar`, cor: COR.negativo,
          pontilhada: true },
      ]);

      for (const p of [...new Set([1, 5, 10, 15, total])]) {
        linhaH(ctx, x0 - 10, x1, escala(p), COR.cinzaClaro);
        texto(ctx, ordinal(p), x0 - 18, escala(p) + 5,
              { tamanho: 13, cor: COR.cinzaEscuro, alinha: "right" });
      }

      const linhaMelhor = [[x0, fronteira(melhor)], [x1, fronteira(melhor)]];
      const linhaPior = [[x0, fronteira(pior)], [x1, fronteira(pior)]];
      tracarLinha(ctx, linhaPior, COR.negativo, { pontilhada: true, espessura: 4 });
      tracarLinha(ctx, linhaMelhor, COR.verde, { pontilhada: true, espessura: 4 });

      const pontos = campanha.map((p) => [centro(p.rodada), escala(p.posicao)]);
      tracarLinha(ctx, pontos, COR.azul);
      bolinhas(ctx, pontos, COR.azul);
      rotularPontos(ctx, {
        pontos: campanha.map((p, i) => ({ x: pontos[i][0], y: pontos[i][1],
                                          texto: p.posicao, i })),
        linhas: [linhaMelhor, linhaPior], propria: pontos,
        cor: COR.azulEscuro, topo, base: topo + alturaPlot,
      });

      reguasNaCalha(ctx, {
        x: x1 + 14, topo, limiteBase: topo + alturaPlot - 150,
        itens: [
          { alvo: fronteira(melhor), ancora: x1,
            desenhar: (yy) => pastilha(ctx, x1 + 14, yy, melhor, "ou melhor",
                                       COR.verde) },
          { alvo: fronteira(pior), ancora: x1,
            desenhar: (yy) => pastilha(ctx, x1 + 14, yy, pior, "ou melhor",
                                       COR.negativo) },
        ],
      });

      blocoDasFronteiras(ctx, {
        x: x1 + 18, y: topo + alturaPlot - 126, altura: 126,
        rodadas: campanha.length, dentro, fora, melhor, pior,
        atual: campanha.at(-1),
      });

      numerosDoEixo(ctx, { centro, yEixo });
      await faixaDeJogos(ctx, { agenda, clube, rotulo, cor: COR.azul, clubes,
                                centro, largura, x: MARGEM, y: yEixo + 16 });

      spec.hover = hoverDaPosicao({ campanha, rotulo, centro, topo,
                                    alturaPlot, x0, x1, largura, melhor, pior });
    },
  };
  return spec;
}

/* ------------------------------------------------------------- comuns */
/**
 * O eixo x é o mesmo nas duas leituras: 38 casas, uma por jogo ou por rodada.
 * Manter a mesma régua é o que deixa um card ser comparado com o outro.
 */
function montarEixo(y) {
  const x0 = MARGEM + CALHA;
  const x1 = CARD.largura - MARGEM - CALHA_DIR;
  const largura = (x1 - x0) / JOGOS;
  const topo = y + 42;
  const alturaPlot = 500;
  return {
    x0, x1, largura, topo, alturaPlot,
    centro: (n) => x0 + (n - 0.5) * largura,
    yEixo: topo + alturaPlot + 24,
  };
}

function numerosDoEixo(ctx, { centro, yEixo }) {
  for (let n = 1; n <= JOGOS; n++) {
    if (n !== 1 && n !== JOGOS && n % 2 === 0) continue;
    texto(ctx, n, centro(n), yEixo,
          { tamanho: 11, cor: COR.cinzaEscuro, alinha: "center" });
  }
}

function bolinhas(ctx, pontos, cor) {
  for (const [x, y] of pontos) {
    ctx.save();
    ctx.fillStyle = COR.fundo;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function reguasNaCalha(ctx, o) {
  const { itens, x, topo, limiteBase } = o;
  const ordenados = empilhar(itens.map((item) => ({ ...item, altura: 34 })),
                             { limiteTopo: topo + 2, limiteBase });

  for (const item of ordenados) {
    // Traço cinza discreto da linha até o rótulo: é chamada, não continuação.
    ctx.save();
    ctx.strokeStyle = COR.cinza;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.moveTo(item.ancora, item.alvo);
    ctx.lineTo(x, item.y);
    ctx.stroke();
    ctx.restore();
    item.desenhar(item.y);
  }
}

const LARGURA_SELO = 182;
const PADDING = 12;

/**
 * Corta para caber levando em conta o espaçamento entre letras.
 *
 * `cortar` mede sem ele. Num rótulo em caixa alta com tracking — que é o
 * padrão da identidade — isso são dezenas de pixels a mais do que o previsto,
 * e o texto sai por fora da caixa colorida em vez de ser cortado.
 */
function cortarEspacado(ctx, conteudo, limite, tamanho, peso, espaco) {
  ctx.save();
  ctx.font = `${peso} ${tamanho}px "Assistant", sans-serif`;
  const mede = (s) =>
    [...s].reduce((soma, c) => soma + ctx.measureText(c).width + espaco, 0);
  let saida = String(conteudo).toUpperCase();
  const inteiro = saida;
  while (saida.length > 3 && mede(saida + "…") > limite) saida = saida.slice(0, -1);
  ctx.restore();
  return saida === inteiro ? inteiro : saida.trimEnd() + "…";
}

/** A ponta de uma régua: a posição em número grande e o que ela vale ao lado. */
function pastilha(ctx, x, y, posicao, detalhe, cor) {
  const altura = 34, topoP = y - altura / 2;
  caixa(ctx, x, topoP, LARGURA_SELO, altura, cor, 7);
  texto(ctx, ordinal(posicao), x + 12, topoP + 24,
        { tamanho: 19, peso: 800, cor: COR.branco });

  ctx.save();
  ctx.font = '800 19px "Assistant", sans-serif';
  const largo = ctx.measureText(ordinal(posicao)).width;
  ctx.restore();

  const cabe = LARGURA_SELO - largo - 20 - PADDING;
  texto(ctx, cortarEspacado(ctx, detalhe, cabe, 10, 700, .7),
        x + 20 + largo, topoP + 22,
        { tamanho: 10, peso: 700, cor: COR.branco, espaco: .7 });
}

function molduraDoBloco(ctx, { x, y, altura }) {
  caixa(ctx, x - 4, y, LARGURA_SELO, altura, COR.branco, 8);
  ctx.save();
  ctx.strokeStyle = COR.linha;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - 3.5, y + .5, LARGURA_SELO - 1, altura - 1, 8);
  ctx.stroke();
  ctx.restore();
}

/** Onde a campanha está hoje em relação às duas réguas. */
function blocoDeRitmo(ctx, o) {
  const { x, y, altura, fim, media, ritmo, melhor, pior } = o;
  molduraDoBloco(ctx, { x, y, altura });

  texto(ctx, `em ${fim.n} jogos`, x + 10, y + 20,
        { tamanho: 10.5, peso: 700, maiuscula: true, espaco: .9,
          cor: COR.cinzaEscuro });

  const linhas = [
    { posicao: melhor, total: media.melhor, cor: COR.verde },
    { posicao: pior, total: media.pior, cor: COR.negativo },
  ];
  linhas.forEach((linha, i) => {
    const alvo = ritmo(linha.total, fim.n);
    const delta = fim.pts - alvo;
    const yLinha = y + 46 + i * 34;

    texto(ctx, `ritmo do ${ordinal(linha.posicao)}`, x + 10, yLinha,
          { tamanho: 11.5, cor: COR.cinzaEscuro });
    texto(ctx, num(alvo), x + LARGURA_SELO - 14, yLinha,
          { tamanho: 14, peso: 800, cor: linha.cor, alinha: "right" });
    texto(ctx, `${num(Math.abs(delta))} ${delta >= 0 ? "acima" : "abaixo"}`,
          x + 10, yLinha + 15,
          { tamanho: 11, peso: 700, cor: linha.cor });
  });
}

/**
 * Quantas rodadas a campanha passou de cada lado das duas réguas.
 *
 * As três contas somam o total: é o que transforma "esteve no G4" numa medida
 * — três rodadas em vinte e oito é outra história que vinte e três.
 */
function blocoDasFronteiras(ctx, o) {
  const { x, y, altura, rodadas, dentro, fora, melhor, pior, atual } = o;
  molduraDoBloco(ctx, { x, y, altura });

  texto(ctx, `em ${rodadas} rodadas`, x + 10, y + 20,
        { tamanho: 10.5, peso: 700, maiuscula: true, espaco: .9,
          cor: COR.cinzaEscuro });
  texto(ctx, ordinal(atual.posicao), x + 10, y + 54,
        { tamanho: 28, peso: 800, cor: COR.azul });
  texto(ctx, "na última rodada", x + 10, y + 70,
        { tamanho: 10.5, peso: 700, cor: COR.cinzaEscuro });

  const linhas = [
    [`${ordinal(melhor)} ou melhor`, dentro, COR.verde],
    [`entre ${ordinal(melhor + 1)} e ${ordinal(pior)}`,
     rodadas - dentro - fora, COR.cinzaTexto],
    [`pior que ${ordinal(pior)}`, fora, COR.negativo],
  ];
  linhas.forEach(([rotulo, valor, cor], i) => {
    const yLinha = y + 92 + i * 17;
    texto(ctx, cortar(ctx, rotulo, LARGURA_SELO - 56, 11), x + 10, yLinha,
          { tamanho: 11, cor: COR.cinzaEscuro });
    texto(ctx, valor, x + LARGURA_SELO - 14, yLinha,
          { tamanho: 13, peso: 800, cor, alinha: "right" });
  });
}

/* ----------------------------------------------------------------- hover */
function hoverDaPontuacao(o) {
  const { agenda, rotulo, clube, media, ritmo, centro, topo, alturaPlot,
          x0, x1, largura, melhor, pior } = o;
  const nome = nomeBonito(clube);

  const pontos = agenda.map((passo, i) => {
    const n = i + 1;
    const itens = [{ rotulo, cor: COR.azul, ...descreverJogo(passo) }];

    for (const [posicao, total, cor] of [[melhor, media.melhor, COR.verde],
                                         [pior, media.pior, COR.negativo]]) {
      const alvo = ritmo(total, n);
      // Sem jogo disputado não há o que comparar: a régua aparece sozinha.
      const delta = passo.realizado ? passo.pts - alvo : null;
      itens.push({
        rotulo: `ritmo do ${ordinal(posicao)}`,
        cor,
        pontos: num(alvo),
        detalhe: delta === null ? "—"
          : `${nome} ${num(Math.abs(delta))} ${delta >= 0 ? "acima" : "abaixo"}`,
      });
    }
    return { n, x: centro(n), itens, diferenca: null };
  });

  return { pontos, topo, alturaPlot, x0, x1, largura, unidade: "jogo" };
}

function hoverDaPosicao(o) {
  const { campanha, rotulo, centro, topo, alturaPlot, x0, x1, largura,
          melhor, pior } = o;

  const pontos = campanha.map((p) => ({
    n: p.rodada,
    x: centro(p.rodada),
    itens: [{ rotulo, cor: COR.azul, pontos: p.pontos,
              detalhe: `${ordinal(p.posicao)} lugar` }],
    diferenca: {
      rotulo: ordinal(p.posicao),
      texto: p.posicao <= melhor ? `${ordinal(melhor)} ou melhor`
           : p.posicao > pior ? `pior que ${ordinal(pior)}`
           : `entre ${ordinal(melhor + 1)} e ${ordinal(pior)}`,
      cor: p.posicao <= melhor ? COR.verde
         : p.posicao > pior ? COR.negativo : COR.cinzaTexto,
    },
  }));

  return { pontos, topo, alturaPlot, x0, x1, largura, unidade: "rodada" };
}
