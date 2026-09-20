/**
 * Card: evolução da pontuação de um clube contra o ritmo de duas posições.
 *
 * A pergunta que este card responde não é "quem está na frente", e sim "o que
 * esta campanha está valendo". Comparar com outro clube diz uma coisa;
 * comparar com o que historicamente custa terminar em 4º e em 17º diz outra, e
 * é a que serve para falar de objetivo.
 *
 * As duas réguas são retas, e é de propósito. A média de quem termina naquela
 * posição dividida por 38 não é a campanha de ninguém — é o ritmo que aquela
 * posição costuma exigir. Uma reta diz isso; uma curva média de campanhas
 * sugeriria um roteiro ("começa devagar, acelera no returno") que a média não
 * autoriza a afirmar.
 *
 * Verde é sempre a posição melhor e vermelho a pior, as duas pontilhadas: a
 * linha cheia é a única campanha de verdade no card.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar,
} from "/js/cartao.js";
import { nomeBonito, nomeCurto, artigo } from "/js/nomes.js";
import {
  CALHA, CALHA_DIR, JOGOS, campanhaCompleta, disputados, descreverJogo,
  faixaDeJogos, legenda, tracarLinha,
} from "/js/grafico_campanha.js";
import { empilhar } from "/js/empilhar.js";

/** Uma casa decimal e vírgula: a média não é inteira e arredondar mentiria. */
const num = (v) => v.toFixed(1).replace(".", ",");
const ordinal = (posicao) => `${posicao}º`;

export function montarCartao(estado) {
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
      const x0 = MARGEM + CALHA;
      const x1 = CARD.largura - MARGEM - CALHA_DIR;
      const largura = (x1 - x0) / JOGOS;
      const centro = (n) => x0 + (n - 0.5) * largura;

      // Uma faixa de jogos só, em vez das duas do comparativo: sobra altura
      // para o gráfico, que é o que o card tem a dizer.
      const topo = y + 42, alturaPlot = 500;
      const maximo = Math.max(fim.pts, media.melhor, media.pior, 1);
      const escala = (pts) => topo + alturaPlot - (pts / maximo) * alturaPlot;
      const yEixo = topo + alturaPlot + 24;

      await legenda(ctx, MARGEM, y, clubes, [
        { clube, rotulo, cor: COR.azul },
        { rotulo: `ritmo do ${ordinal(melhor)} lugar · ${num(media.melhor)} pts`,
          cor: COR.verde, pontilhada: true },
        { rotulo: `ritmo do ${ordinal(pior)} lugar · ${num(media.pior)} pts`,
          cor: COR.vermelho, pontilhada: true },
      ]);

      desenharGrafico(ctx, { campanha, media, ritmo, centro, escala, topo,
                             alturaPlot, x0, x1, rotulo, melhor, pior, fim });

      for (let n = 1; n <= JOGOS; n++) {
        if (n !== 1 && n !== JOGOS && n % 2 === 0) continue;
        texto(ctx, n, centro(n), yEixo,
              { tamanho: 11, cor: COR.cinzaEscuro, alinha: "center" });
      }

      await faixaDeJogos(ctx, { agenda, clube, rotulo, cor: COR.azul, clubes,
                                centro, largura, x: MARGEM, y: yEixo + 16 });

      spec.hover = geometriaDoHover({ agenda, rotulo, clube, media, ritmo,
        centro, topo, alturaPlot, x0, x1, largura, melhor, pior });
    },
  };
  return spec;
}

/* -------------------------------------------------------------- desenho */
function desenharGrafico(ctx, o) {
  const { campanha, media, ritmo, centro, escala, topo, alturaPlot, x0, x1,
          rotulo, melhor, pior, fim } = o;
  const maximo = Math.max(fim.pts, media.melhor, media.pior, 1);

  const passo = Math.max(5, Math.ceil(maximo / 5 / 5) * 5);
  for (let v = 0; v <= maximo; v += passo) {
    linhaH(ctx, x0 - 10, x1, escala(v), COR.cinzaClaro);
    texto(ctx, v, x0 - 18, escala(v) + 5,
          { tamanho: 13, cor: COR.cinzaEscuro, alinha: "right" });
  }

  // As réguas primeiro: a campanha é a linha que tem de ficar por cima.
  const reta = (total) => [[centro(1), escala(ritmo(total, 1))],
                           [centro(JOGOS), escala(total)]];
  tracarLinha(ctx, reta(media.pior), COR.vermelho,
              { pontilhada: true, espessura: 4 });
  tracarLinha(ctx, reta(media.melhor), COR.verde,
              { pontilhada: true, espessura: 4 });

  tracarLinha(ctx, campanha.map((p) => [centro(p.n), escala(p.pts)]), COR.azul);
  for (const p of campanha) {
    ctx.save();
    ctx.fillStyle = COR.fundo;
    ctx.beginPath();
    ctx.arc(centro(p.n), escala(p.pts), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COR.azul;
    ctx.beginPath();
    ctx.arc(centro(p.n), escala(p.pts), 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const alturaBloco = 108;
  rotulosNaCalha(ctx, {
    x: x1 + 14, topo, limiteBase: topo + alturaPlot - alturaBloco - 16,
    itens: [
      { alvo: escala(fim.pts), ancora: centro(fim.n), altura: 58,
        desenhar: (y) => seloDoClube(ctx, x1 + 14, y, fim, rotulo) },
      { alvo: escala(media.melhor), ancora: centro(JOGOS), altura: 34,
        desenhar: (y) => pastilha(ctx, x1 + 14, y, melhor, media.melhor, COR.verde) },
      { alvo: escala(media.pior), ancora: centro(JOGOS), altura: 34,
        desenhar: (y) => pastilha(ctx, x1 + 14, y, pior, media.pior, COR.vermelho) },
    ],
  });

  blocoDeRitmo(ctx, {
    x: x1 + 18, y: topo + alturaPlot - alturaBloco, altura: alturaBloco,
    fim, media, ritmo, melhor, pior,
  });
}

function rotulosNaCalha(ctx, o) {
  const { itens, x, topo, limiteBase } = o;
  const ordenados = empilhar(itens, { limiteTopo: topo + 2, limiteBase });

  for (const item of ordenados) {
    // Traço cinza discreto da linha até o rótulo: é chamada, não continuação.
    // Com as caixas fora da altura das suas linhas, é ele que diz qual é qual.
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

function seloDoClube(ctx, x, y, fim, rotulo) {
  const altura = 58, topoSelo = y - altura / 2;
  caixa(ctx, x, topoSelo, LARGURA_SELO, altura, COR.azul, 9);
  texto(ctx, fim.pts, x + 14, topoSelo + 41,
        { tamanho: 34, peso: 800, cor: COR.branco });

  ctx.save();
  ctx.font = '800 34px "Assistant", sans-serif';
  const larguraNumero = ctx.measureText(String(fim.pts)).width;
  ctx.restore();

  const xTexto = x + 24 + larguraNumero;
  const cabe = LARGURA_SELO - larguraNumero - 24 - PADDING;
  texto(ctx, cortar(ctx, rotulo, cabe, 12.5, 700), xTexto, topoSelo + 26,
        { tamanho: 12.5, peso: 700, cor: COR.branco });
  texto(ctx, cortarEspacado(ctx, `pts em ${fim.n} jogos`, cabe, 10, 700, .8),
        xTexto, topoSelo + 42,
        { tamanho: 10, peso: 700, cor: COR.branco, espaco: .8 });
}

/** O valor em que cada régua termina, na ponta dela. */
function pastilha(ctx, x, y, posicao, total, cor) {
  const altura = 34, topoP = y - altura / 2;
  caixa(ctx, x, topoP, LARGURA_SELO, altura, cor, 7);
  texto(ctx, num(total), x + 12, topoP + 24,
        { tamanho: 19, peso: 800, cor: COR.branco });

  ctx.save();
  ctx.font = '800 19px "Assistant", sans-serif';
  const largo = ctx.measureText(num(total)).width;
  ctx.restore();

  // Só "ritmo do 17º": o valor ao lado já é o total dos 38 jogos, e a legenda
  // no alto do card diz isso por extenso.
  const cabe = LARGURA_SELO - largo - 20 - PADDING;
  texto(ctx, cortarEspacado(ctx, `ritmo do ${ordinal(posicao)}`, cabe, 10, 700, .7),
        x + 20 + largo, topoP + 22,
        { tamanho: 10, peso: 700, cor: COR.branco, espaco: .7 });
}

/** Onde a campanha está hoje em relação às duas réguas. */
function blocoDeRitmo(ctx, o) {
  const { x, y, altura, fim, media, ritmo, melhor, pior } = o;
  const largura = LARGURA_SELO;

  caixa(ctx, x - 4, y, largura, altura, COR.branco, 8);
  ctx.save();
  ctx.strokeStyle = COR.linha;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - 3.5, y + .5, largura - 1, altura - 1, 8);
  ctx.stroke();
  ctx.restore();

  texto(ctx, `em ${fim.n} jogos`, x + 10, y + 20,
        { tamanho: 10.5, peso: 700, maiuscula: true, espaco: .9,
          cor: COR.cinzaEscuro });

  const linhas = [
    { posicao: melhor, total: media.melhor, cor: COR.verde },
    { posicao: pior, total: media.pior, cor: COR.vermelho },
  ];
  linhas.forEach((linha, i) => {
    const alvo = ritmo(linha.total, fim.n);
    const delta = fim.pts - alvo;
    const yLinha = y + 46 + i * 34;

    texto(ctx, `ritmo do ${ordinal(linha.posicao)}`, x + 10, yLinha,
          { tamanho: 11.5, cor: COR.cinzaEscuro });
    texto(ctx, num(alvo), x + largura - 14, yLinha,
          { tamanho: 14, peso: 800, cor: linha.cor, alinha: "right" });
    texto(ctx, `${num(Math.abs(delta))} ${delta >= 0 ? "acima" : "abaixo"}`,
          x + 10, yLinha + 15,
          { tamanho: 11, peso: 700, cor: linha.cor });
  });
}

/* ----------------------------------------------------------------- hover */
function geometriaDoHover(o) {
  const { agenda, rotulo, clube, media, ritmo, centro, topo, alturaPlot,
          x0, x1, largura, melhor, pior } = o;
  const nome = nomeBonito(clube);

  const pontos = agenda.map((passo, i) => {
    const n = i + 1;
    const doClube = descreverJogo(passo);
    const itens = [{ rotulo, cor: COR.azul, ...doClube }];

    for (const [posicao, total, cor] of [[melhor, media.melhor, COR.verde],
                                         [pior, media.pior, COR.vermelho]]) {
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
