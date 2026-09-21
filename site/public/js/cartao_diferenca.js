/**
 * Card: a diferença de pontos entre dois pontos da tabela, rodada a rodada.
 *
 * O gráfico é de **diferença**, e não de duas linhas de pontuação. Duas linhas
 * subindo juntas obrigam o olho a medir o vão entre elas a cada rodada — e o
 * vão é justamente a pergunta. Aqui a diferença é a própria linha, o zero é
 * uma referência fixa no eixo, e a área pintada entre a linha e o zero diz de
 * quem é a vantagem sem precisar de rótulo: azul quando o primeiro lado está à
 * frente, vermelho quando está atrás. Onde a linha cruza o zero, a cor troca.
 *
 * O eixo é a **rodada**, e vai sempre até a 38ª, como na evolução da
 * pontuação: a diferença só existe se os dois lados forem lidos no mesmo
 * instante, e o instante comum a todo mundo é a rodada. Clube com jogo adiado
 * aparece atrás porque ainda não jogou, e isso é informação, não distorção.
 *
 * Debaixo do eixo, uma faixa por lado. Lado que é equipe mostra os jogos dela,
 * no mesmo formato da evolução da pontuação; lado que é posição mostra o clube
 * que ocupava a vaga naquela rodada, que é a única forma de a linha da posição
 * deixar de ser abstrata.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito, nomeCurto, artigo, artigoDefinido } from "/js/nomes.js";
import {
  CALHA, CALHA_DIR, campanhaCompleta, faixaDeJogos, legenda,
} from "/js/grafico_campanha.js";
import {
  ocupantes, resumoDaDiferenca, serieDaDiferenca,
} from "/js/diferenca_pontos.js";

const RODADAS = 38;
const LARGURA_SELO = 182;

const ordinal = (n) => `${n}º`;
const num = (v) => v.toFixed(1).replace(".", ",");
/** Sinal explícito, com o menos tipográfico: a diferença é sempre relativa. */
const sinalizado = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : "0");

/** Como o lado se chama no card. */
const rotuloDoLado = (lado) => lado.tipo === "equipe"
  ? nomeBonito(lado.equipe) : `${ordinal(lado.posicao)} colocado`;

/** O mesmo nome, com artigo, para caber numa frase. */
const comArtigo = (lado) => lado.tipo === "equipe"
  ? `${artigoDefinido(lado.equipe)} ${nomeBonito(lado.equipe)}`
  : `o ${ordinal(lado.posicao)} colocado`;

/** "do Bahia", "do 5º colocado": a forma que entra depois de um substantivo. */
const comDe = (lado) => lado.tipo === "equipe"
  ? `${artigo(lado.equipe)} ${nomeBonito(lado.equipe)}`
  : `do ${ordinal(lado.posicao)} colocado`;

const chaveDoLado = (lado) => lado.tipo === "equipe"
  ? nomeCurto(lado.equipe) : `${lado.posicao}o`;

export function montarCartao(estado) {
  const { serie, edicao, grade, jogos, clubes, modo, a, b } = estado;
  if (!grade || !edicao) return null;

  const serieDif = serieDaDiferenca(grade, { a, b });
  if (!serieDif.length) return null;
  const resumo = resumoDaDiferenca(serieDif);
  const distancia = modo === "posicao-posicao";

  const spec = {
    titulo: `Diferença de pontos entre ${comArtigo(a)} e ${comArtigo(b)}`
          + ` na Série ${serie} ${edicao.ano}`,
    subtitulo: "Pontos acumulados ao fim de cada rodada",
    arquivo: `diferenca-${serie}-${edicao.ano}`
           + `-${chaveDoLado(a)}-${chaveDoLado(b)}`,
    numeros: faixaDeNumeros({ resumo, edicao, distancia, a, b }),
    nota: `Diferença = pontos ${comDe(a)} menos pontos ${comDe(b)} ao `
        + `fim de cada rodada, na grade de ${grade.rodadas} rodadas já `
        + `disputadas desta edição.`,
    corpo: async (ctx, y) => {
      const x0 = MARGEM + CALHA;
      const x1 = CARD.largura - MARGEM - CALHA_DIR;
      const larguraRodada = (x1 - x0) / RODADAS;
      const centro = (r) => x0 + (r - 0.5) * larguraRodada;

      const faixas = [{ lado: "a", ponto: a, cor: COR.azul },
                      { lado: "b", ponto: b, cor: COR.vermelho }];
      const alturaDaFaixa = (f) => (f.ponto.tipo === "equipe" ? 70 : 62);
      const somaFaixas = faixas.reduce((s, f) => s + alturaDaFaixa(f), 0);

      const topo = y + 40;
      const alturaPlot = (CARD.altura - 86) - somaFaixas - 34 - topo;
      const yEixo = topo + alturaPlot + 20;

      await legendaDasCores(ctx, { x: MARGEM, y, serieDif, a, b, clubes,
                                   distancia });

      const escala = desenharGrafico(ctx, {
        serieDif, resumo, centro, topo, alturaPlot, x0, x1, larguraRodada,
        distancia, edicao,
      });

      for (let r = 1; r <= RODADAS; r++) {
        if (r !== 1 && r !== RODADAS && r % 2 === 0) continue;
        texto(ctx, r, centro(r), yEixo,
              { tamanho: 11, cor: COR.cinzaEscuro, alinha: "center" });
      }

      let yFaixa = yEixo + 12;
      for (const faixa of faixas) {
        await desenharFaixa(ctx, {
          ...faixa, serieDif, jogos, clubes, edicao, centro,
          largura: larguraRodada, y: yFaixa,
        });
        yFaixa += alturaDaFaixa(faixa);
      }

      spec.hover = geometriaDoHover({ serieDif, a, b, centro, topo, alturaPlot,
                                      x0, x1, largura: larguraRodada, escala });
    },
  };
  return spec;
}

/* ------------------------------------------------------------- números */
function faixaDeNumeros({ resumo, edicao, distancia, a, b }) {
  const { atual, maior, menor, media, contagem, rodadas } = resumo;
  const quando = (p) => `${ordinal(p.rodada)} rodada`;

  // Com os dois lados sempre do mesmo lado do zero, "vantagem" não descreve
  // nada: o que varia é a distância. É o caso de posição contra posição, em
  // que a melhor colocada nunca tem menos pontos que a pior.
  const extremo = (p, maisAlto) => distancia
    ? { valor: String(Math.abs(p.dif)),
        nome: `${maisAlto ? "maior" : "menor"} distância · ${quando(p)}` }
    : { valor: sinalizado(p.dif),
        nome: `${p.dif >= 0 ? (maisAlto ? "maior vantagem" : "menor vantagem")
                            : (maisAlto ? "menor desvantagem" : "maior desvantagem")}`
            + ` · ${quando(p)}`,
        destaque: p.dif < 0 ? "vermelho" : undefined };

  const fechamento = edicao.encerrada
    ? "no fim do campeonato" : `na ${ordinal(atual.rodada)} rodada`;

  return [
    { valor: distancia ? String(Math.abs(atual.dif)) : sinalizado(atual.dif),
      nome: `${distancia ? "distância" : "diferença"} ${fechamento}`,
      destaque: "azul" },
    extremo(maior, true),
    extremo(menor, false),
    distancia
      ? { valor: num(media), nome: "distância média nas rodadas" }
      : { valor: `${contagem.frente} de ${rodadas}`,
          nome: `rodadas à frente ${
            b.tipo === "equipe" ? `do ${nomeCurto(b.equipe)}` : `do ${ordinal(b.posicao)}`}` },
  ];
}

/* -------------------------------------------------------------- legenda */
/**
 * A legenda só anuncia a cor que aparece.
 *
 * Numa comparação entre duas posições o vermelho nunca acontece — o 4º nunca
 * tem menos pontos que o 17º —, e anunciar uma cor ausente faria o leitor
 * procurá-la no gráfico.
 */
async function legendaDasCores(ctx, { x, y, serieDif, a, b, clubes, distancia }) {
  // Entre duas posições não há "à frente": a melhor colocada está sempre na
  // frente, por definição. O que a linha mede ali é distância, e a legenda diz
  // isso numa linha só.
  if (distancia) {
    await legenda(ctx, x, y, clubes, [{
      cor: COR.azul,
      rotulo: `distância ${comDe(a)} sobre ${comArtigo(b)}`,
    }]);
    return;
  }

  const itens = [];
  if (serieDif.some((p) => p.dif > 0)) {
    itens.push({ rotulo: `${rotuloDoLado(a)} à frente`, cor: COR.azul,
                 clube: a.tipo === "equipe" ? a.equipe : undefined });
  }
  if (serieDif.some((p) => p.dif < 0)) {
    itens.push({ rotulo: `${rotuloDoLado(b)} à frente`, cor: COR.vermelho,
                 clube: b.tipo === "equipe" ? b.equipe : undefined });
  }
  if (serieDif.some((p) => p.dif === 0)) {
    itens.push({ rotulo: "empatados", cor: COR.cinzaEscuro });
  }
  await legenda(ctx, x, y, clubes, itens);
}

/* -------------------------------------------------------------- gráfico */
function desenharGrafico(ctx, o) {
  const { serieDif, resumo, centro, topo, alturaPlot, x0, x1, larguraRodada,
          distancia } = o;

  // A escala sempre inclui o zero: é dele que a leitura parte, e uma escala
  // que começasse no menor valor da série esconderia de que lado está a
  // vantagem.
  const maxV = Math.max(resumo.maior.dif, 0);
  const minV = Math.min(resumo.menor.dif, 0);
  const folga = Math.max(1, (maxV - minV) * 0.12);
  const teto = maxV + folga, piso = minV - folga;
  const escala = (v) => topo + alturaPlot - ((v - piso) / (teto - piso)) * alturaPlot;
  const yZero = escala(0);

  const passo = Math.max(1, Math.ceil((teto - piso) / 6 / 2) * 2);
  for (let v = Math.ceil(piso / passo) * passo; v <= teto; v += passo) {
    if (v === 0) continue;
    linhaH(ctx, x0 - 10, x1, escala(v), COR.cinzaClaro);
    texto(ctx, distancia ? Math.abs(v) : sinalizado(v), x0 - 18, escala(v) + 5,
          { tamanho: 13, cor: COR.cinzaEscuro, alinha: "right" });
  }

  const pontos = serieDif.map((p) => [centro(p.rodada), escala(p.dif)]);
  const borda = { de: x0 - larguraRodada / 2, ate: x1 };

  // A área e a linha são pintadas duas vezes, cada vez recortada a uma metade
  // do gráfico. É o que faz a cor virar exatamente onde a linha cruza o zero,
  // sem ter de calcular o ponto de cruzamento.
  pintarMetade(ctx, { pontos, yZero, borda, cor: COR.azul,
                      de: topo, ate: yZero });
  pintarMetade(ctx, { pontos, yZero, borda, cor: COR.vermelho,
                      de: yZero, ate: topo + alturaPlot });

  // O zero por cima da área: é a única linha do gráfico que não é dado.
  ctx.save();
  ctx.strokeStyle = COR.cinzaEscuro;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0 - 10, yZero);
  ctx.lineTo(x1, yZero);
  ctx.stroke();
  ctx.restore();
  texto(ctx, "0", x0 - 18, yZero + 5,
        { tamanho: 14, peso: 800, cor: COR.cinzaTexto, alinha: "right" });
  texto(ctx, "empate", x0 - 18, yZero + 21,
        { tamanho: 10, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro, alinha: "right" });

  for (const p of serieDif) {
    const cor = p.dif > 0 ? COR.azul : p.dif < 0 ? COR.vermelho : COR.cinzaTexto;
    ctx.save();
    ctx.fillStyle = COR.fundo;
    ctx.beginPath();
    ctx.arc(centro(p.rodada), escala(p.dif), 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.arc(centro(p.rodada), escala(p.dif), 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  marcarExtremos(ctx, { resumo, centro, escala, topo, alturaPlot, distancia });
  seloDoAtual(ctx, { resumo, centro, escala, x: x1 + 14, topo, alturaPlot,
                     distancia });
  blocoDoPlacar(ctx, { resumo, x: x1 + 18, y: topo + alturaPlot - 104,
                       altura: 104, distancia });

  return escala;
}

function pintarMetade(ctx, { pontos, yZero, borda, cor, de, ate }) {
  if (ate - de <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(borda.de, de, borda.ate - borda.de, ate - de);
  ctx.clip();

  ctx.globalAlpha = .2;
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.moveTo(pontos[0][0], yZero);
  for (const [px, py] of pontos) ctx.lineTo(px, py);
  ctx.lineTo(pontos.at(-1)[0], yZero);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.strokeStyle = cor;
  ctx.lineWidth = 3.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  pontos.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.stroke();
  ctx.restore();
}

/** O pico e o vale, onde eles aconteceram. */
function marcarExtremos(ctx, { resumo, centro, escala, topo, alturaPlot, distancia }) {
  const alvos = [
    { passo: resumo.maior, acima: true },
    { passo: resumo.menor, acima: false },
  ];
  // Série que não varia tem pico e vale no mesmo ponto: uma etiqueta basta.
  if (resumo.maior.dif === resumo.menor.dif) alvos.pop();

  for (const { passo, acima } of alvos) {
    const cor = passo.dif > 0 ? COR.azul : passo.dif < 0 ? COR.vermelho : COR.cinzaTexto;
    const rotulo = distancia ? String(Math.abs(passo.dif)) : sinalizado(passo.dif);
    const texto1 = `${rotulo} · ${ordinal(passo.rodada)}`;

    ctx.save();
    ctx.font = '800 13px "Assistant", sans-serif';
    const largura = ctx.measureText(texto1).width + 18;
    ctx.restore();

    const x = Math.min(Math.max(centro(passo.rodada) - largura / 2, centro(1) - 6),
                       centro(RODADAS) - largura + 6);
    const yPonto = escala(passo.dif);
    const y = acima ? Math.max(topo + 2, yPonto - 30)
                    : Math.min(topo + alturaPlot - 24, yPonto + 10);
    caixa(ctx, x, y, largura, 22, cor, 6);
    texto(ctx, texto1, x + largura / 2, y + 16,
          { tamanho: 13, peso: 800, alinha: "center", cor: COR.branco });
  }
}

/** Onde a diferença está agora, na calha da direita. */
function seloDoAtual(ctx, { resumo, centro, escala, x, topo, alturaPlot,
                            distancia }) {
  const { atual } = resumo;
  // Entre duas posições o sinal não diz nada: a melhor está sempre na frente.
  const rotulo = distancia ? String(Math.abs(atual.dif)) : sinalizado(atual.dif);
  const altura = 58;
  const alvo = escala(atual.dif);
  const y = Math.min(Math.max(alvo, topo + altura / 2 + 2),
                     topo + alturaPlot - 130);
  const cor = atual.dif > 0 ? COR.azul : atual.dif < 0 ? COR.vermelho : COR.cinzaTexto;

  ctx.save();
  ctx.strokeStyle = COR.cinza;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 5]);
  ctx.beginPath();
  ctx.moveTo(centro(atual.rodada), alvo);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.restore();

  const topoSelo = y - altura / 2;
  caixa(ctx, x, topoSelo, LARGURA_SELO, altura, cor, 9);
  texto(ctx, rotulo, x + 14, topoSelo + 41,
        { tamanho: 34, peso: 800, cor: COR.branco });

  ctx.save();
  ctx.font = '800 34px "Assistant", sans-serif';
  const largo = ctx.measureText(rotulo).width;
  ctx.restore();

  texto(ctx, "pontos", x + 24 + largo, topoSelo + 26,
        { tamanho: 12.5, peso: 700, cor: COR.branco });
  texto(ctx, `${ordinal(atual.rodada)} rodada`, x + 24 + largo, topoSelo + 42,
        { tamanho: 10, peso: 700, cor: COR.branco, espaco: .8 });
}

/** Quantas rodadas cada lado passou na frente. */
function blocoDoPlacar(ctx, { resumo, x, y, altura, distancia }) {
  const largura = LARGURA_SELO;
  caixa(ctx, x - 4, y, largura, altura, COR.branco, 8);
  ctx.save();
  ctx.strokeStyle = COR.linha;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - 3.5, y + .5, largura - 1, altura - 1, 8);
  ctx.stroke();
  ctx.restore();

  texto(ctx, `em ${resumo.rodadas} rodadas`, x + 10, y + 20,
        { tamanho: 10.5, peso: 700, maiuscula: true, espaco: .9,
          cor: COR.cinzaEscuro });

  const linhas = distancia
    ? [{ rotulo: "distância média", valor: num(resumo.media), cor: COR.azulEscuro },
       { rotulo: "maior distância", valor: String(Math.abs(resumo.maior.dif)),
         cor: COR.azul }]
    : [{ rotulo: "à frente", valor: String(resumo.contagem.frente), cor: COR.azul },
       { rotulo: "atrás", valor: String(resumo.contagem.atras), cor: COR.vermelho },
       { rotulo: "viradas", valor: String(resumo.viradas), cor: COR.cinzaTexto }];

  const passo = linhas.length > 2 ? 22 : 30;
  linhas.forEach((linha, i) => {
    const yLinha = y + 44 + i * passo;
    texto(ctx, linha.rotulo, x + 10, yLinha, { tamanho: 12, cor: COR.cinzaEscuro });
    texto(ctx, linha.valor, x + largura - 14, yLinha,
          { tamanho: 15, peso: 800, cor: linha.cor, alinha: "right" });
  });
}

/* --------------------------------------------------------------- faixas */
async function desenharFaixa(ctx, o) {
  const { lado, ponto, cor, serieDif, jogos, clubes, edicao, centro, largura,
          y } = o;

  if (ponto.tipo === "equipe") {
    // A agenda vem em ordem de jogo; aqui o eixo é a rodada, então cada jogo
    // vai para a casa da rodada dele. É o que mantém a faixa alinhada com a
    // linha do gráfico, que também é indexada por rodada.
    const agenda = campanhaCompleta(jogos, ponto.equipe)
      .map((passo) => ({ ...passo, n: passo.jogo.rodada }));
    await faixaDeJogos(ctx, {
      agenda, clube: ponto.equipe, rotulo: `${nomeBonito(ponto.equipe)} ${edicao.ano}`,
      cor, clubes, centro, largura, x: MARGEM, y,
    });
    return;
  }

  await faixaDeOcupantes(ctx, {
    serieDif, lado, posicao: ponto.posicao, cor, clubes, centro, largura,
    x: MARGEM, y,
  });
}

/**
 * Quem era o dono da vaga em cada rodada.
 *
 * Sem ela a linha de uma posição fica abstrata: o 4º lugar não é ninguém, e o
 * salto de pontos de uma rodada para a outra costuma ser troca de ocupante, e
 * não campanha de alguém. A divisória vertical marca justamente a troca.
 */
async function faixaDeOcupantes(ctx, o) {
  const { serieDif, lado, posicao, cor, clubes, centro, largura, x, y } = o;
  const donos = ocupantes(serieDif, lado);

  caixa(ctx, x, y + 4, 6, 54, cor, 3);
  texto(ctx, `${ordinal(posicao)} colocado`, x + 12, y + 24,
        { tamanho: 13, peso: 700, cor: COR.azulEscuro });
  texto(ctx, `${donos.length} ${donos.length === 1 ? "clube passou" : "clubes passaram"}`,
        x + 12, y + 42, { tamanho: 11.5, cor: COR.cinzaEscuro });

  const ladoEscudo = Math.min(24, largura - 6);
  let anterior = null;
  for (const passo of serieDif) {
    const cx = centro(passo.rodada);
    const { equipe, pontos } = passo[lado];

    if (anterior && anterior !== equipe) {
      // Divisória na troca de dono: o degrau de pontos ali não é campanha de
      // ninguém, é gente diferente ocupando a vaga.
      ctx.save();
      ctx.strokeStyle = COR.cinza;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(cx - largura / 2, y + 2);
      ctx.lineTo(cx - largura / 2, y + 54);
      ctx.stroke();
      ctx.restore();
    }
    anterior = equipe;

    const escudo = await imagem(clubes[equipe]?.escudo);
    desenharEscudo(ctx, escudo, cx - ladoEscudo / 2, y + 2, ladoEscudo);
    texto(ctx, pontos, cx, y + ladoEscudo + 20,
          { tamanho: 12, peso: 800, alinha: "center", cor: COR.azulEscuro });
  }
}

/* ----------------------------------------------------------------- hover */
function geometriaDoHover(o) {
  const { serieDif, a, b, centro, topo, alturaPlot, x0, x1, largura } = o;

  const descrever = (celula, ponto) => ponto.tipo === "equipe"
    ? { rotulo: nomeBonito(ponto.equipe), detalhe: `${ordinal(celula.posicao)} lugar` }
    : { rotulo: `${ordinal(ponto.posicao)} colocado`,
        detalhe: nomeBonito(celula.equipe) };

  const pontos = serieDif.map((p) => ({
    n: p.rodada,
    x: centro(p.rodada),
    itens: [
      { ...descrever(p.a, a), cor: COR.azul, pontos: p.a.pontos },
      { ...descrever(p.b, b), cor: COR.vermelho, pontos: p.b.pontos },
    ],
    diferenca: {
      rotulo: sinalizado(p.dif),
      texto: p.dif === 0 ? "empatados"
        : `${rotuloDoLado(p.dif > 0 ? a : b)} à frente`,
      cor: p.dif > 0 ? COR.azul : p.dif < 0 ? COR.vermelho : COR.cinzaTexto,
    },
  }));

  return { pontos, topo, alturaPlot, x0, x1, largura, unidade: "rodada" };
}
