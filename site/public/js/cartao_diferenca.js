/**
 * Card: a diferença de pontos entre dois pontos da tabela, rodada a rodada.
 *
 * O gráfico é de **diferença**, e não de duas linhas de pontuação. Duas linhas
 * subindo juntas obrigam o olho a medir o vão entre elas a cada rodada — e o
 * vão é justamente a pergunta.
 *
 * Cada rodada é uma coluna fina centrada num eixo horizontal que nunca sai do
 * lugar: o comprimento dela é a diferença, metade para cima e metade para
 * baixo. Nas duas pontas vai uma tag com a pontuação de cada lado, azul no
 * primeiro e vermelha no segundo — quando a tag azul está em cima, o primeiro
 * lado está à frente, e a troca de lado se lê sem procurar número nenhum. O
 * valor da diferença fica escrito acima da coluna; empate não ganha rótulo,
 * porque a coluna some e os dois lados dividem uma tag só.
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
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito, nomeCurto, artigoDefinido } from "/js/nomes.js";
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
    subtitulo: "",
    arquivo: `diferenca-${serie}-${edicao.ano}`
           + `-${chaveDoLado(a)}-${chaveDoLado(b)}`,
    // Sem faixa de números e sem nota: a premissa da ordem das rodadas está
    // escrita na página, fora do card, e o gráfico fica com a altura toda.
    numeros: [],
    nota: "",
    corpo: async (ctx, y) => {
      const x0 = MARGEM + CALHA;
      const x1 = CARD.largura - MARGEM - CALHA_DIR;
      const larguraRodada = (x1 - x0) / RODADAS;
      const centro = (r) => x0 + (r - 0.5) * larguraRodada;

      const faixas = [{ lado: "a", ponto: a, cor: COR.positivo },
                      { lado: "b", ponto: b, cor: COR.negativo }];
      const alturaDaFaixa = (f) => (f.ponto.tipo === "equipe" ? 70 : 62);
      const somaFaixas = faixas.reduce((s, f) => s + alturaDaFaixa(f), 0);

      const topo = y + 40;
      const alturaPlot = (CARD.altura - 86) - somaFaixas - 34 - topo;
      const yEixo = topo + alturaPlot + 20;

      await legendaDasCores(ctx, { x: MARGEM, y, a, b, clubes, distancia });

      desenharGrafico(ctx, {
        serieDif, resumo, centro, topo, alturaPlot, x0, x1, distancia, a, b,
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
                                      x0, x1, largura: larguraRodada });
    },
  };
  return spec;
}

/* -------------------------------------------------------------- legenda */
/**
 * A legenda diz de quem é cada cor — é ela que faz as tags das pontas serem
 * lidas sem esforço.
 *
 * Numa comparação entre duas posições a melhor colocada está sempre em cima,
 * por definição, e a legenda vira uma frase só: o que a coluna mede ali é
 * distância, não vantagem.
 */
async function legendaDasCores(ctx, { x, y, a, b, clubes, distancia }) {
  const item = (lado, cor) => ({
    cor, rotulo: rotuloDoLado(lado),
    clube: lado.tipo === "equipe" ? lado.equipe : undefined,
  });

  if (distancia) {
    await legenda(ctx, x, y, clubes, [
      item(a, COR.positivo), item(b, COR.negativo),
      { rotulo: "coluna = distância entre os dois", cor: COR.cinzaClaro },
    ]);
    return;
  }
  await legenda(ctx, x, y, clubes, [
    item(a, COR.positivo), item(b, COR.negativo),
    { rotulo: "quem está em cima está à frente", cor: COR.cinzaClaro },
  ]);
}

/* -------------------------------------------------------------- gráfico */
const LARGURA_COLUNA = 8;
const ALTURA_TAG = 16;
const RESPIRO_TAG = 9;      // da ponta da coluna até o centro da tag
const NIVEL = 15;           // degrau do rótulo quando ele precisa subir

/**
 * Desenha as colunas e devolve o y do eixo central, que a dica do mouse usa
 * para ancorar a guia vertical.
 */
function desenharGrafico(ctx, o) {
  const { serieDif, resumo, centro, topo, alturaPlot, x0, x1, distancia,
          a, b } = o;

  const eixo = topo + alturaPlot / 2;
  const maiorDif = Math.max(...serieDif.map((p) => Math.abs(p.dif)), 1);

  // A reserva é o que fica acima da coluna mais comprida: a tag da ponta, o
  // rótulo da diferença e os degraus que ele pode subir para não encavalar.
  const reserva = RESPIRO_TAG + ALTURA_TAG + 18 + NIVEL * 2;
  const meiaAltura = Math.max(24, alturaPlot / 2 - reserva);
  const porPonto = (2 * meiaAltura) / maiorDif;
  const meiaColuna = (dif) => (Math.abs(dif) * porPonto) / 2;

  // O eixo por baixo das colunas: é referência, não dado.
  ctx.save();
  ctx.strokeStyle = COR.cinza;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0 - 16, eixo);
  ctx.lineTo(x1 + 4, eixo);
  ctx.stroke();
  ctx.restore();
  texto(ctx, "empate", x0 - 22, eixo + 4,
        { tamanho: 10, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro, alinha: "right" });

  const ocupados = [];
  const rotulos = [];

  for (const passo of serieDif) {
    const cx = centro(passo.rodada);
    const meia = meiaColuna(passo.dif);
    const cor = passo.dif > 0 ? COR.positivo
              : passo.dif < 0 ? COR.negativo : COR.cinzaEscuro;

    if (passo.dif === 0) {
      // Empate: não há coluna e não há dois números diferentes para mostrar.
      // Uma tag cinza no eixo diz tudo, e o rótulo da diferença seria "0".
      caixa(ctx, cx - LARGURA_COLUNA / 2, eixo - 2, LARGURA_COLUNA, 4,
            COR.cinza, 2);
      ocupados.push(tag(ctx, { cx, cy: eixo, valor: passo.a.pontos,
                               cor: COR.cinzaEscuro }));
      continue;
    }

    caixa(ctx, cx - LARGURA_COLUNA / 2, eixo - meia, LARGURA_COLUNA, meia * 2,
          cor, LARGURA_COLUNA / 2);

    // Em cima vai sempre quem tem mais pontos; a cor da tag diz quem é.
    const cima = passo.dif > 0
      ? { valor: passo.a.pontos, cor: COR.positivo }
      : { valor: passo.b.pontos, cor: COR.negativo };
    const baixo = passo.dif > 0
      ? { valor: passo.b.pontos, cor: COR.negativo }
      : { valor: passo.a.pontos, cor: COR.positivo };

    ocupados.push(tag(ctx, { cx, cy: eixo - meia - RESPIRO_TAG, ...cima }));
    ocupados.push(tag(ctx, { cx, cy: eixo + meia + RESPIRO_TAG, ...baixo }));

    rotulos.push({
      cx, cor,
      texto: distancia ? String(Math.abs(passo.dif)) : sinalizado(passo.dif),
      base: eixo - meia - RESPIRO_TAG - ALTURA_TAG / 2 - 6,
    });
  }

  desenharRotulos(ctx, rotulos, ocupados, topo);
  blocoDoResumo(ctx, { resumo, distancia, x: x1 + 18, eixo, a, b });
  return eixo;
}

/**
 * A tag de pontuação numa ponta da coluna. Devolve o retângulo que ela ocupa,
 * para o rótulo da diferença saber por onde não passar.
 */
function tag(ctx, { cx, cy, valor, cor }) {
  ctx.save();
  ctx.font = '800 11px "Assistant", sans-serif';
  const largura = Math.max(24, ctx.measureText(String(valor)).width + 12);
  ctx.restore();

  const x = cx - largura / 2, y = cy - ALTURA_TAG / 2;
  caixa(ctx, x, y, largura, ALTURA_TAG, cor, 5);
  texto(ctx, valor, cx, cy + 4,
        { tamanho: 11, peso: 800, alinha: "center", cor: COR.branco });
  return { x, y, l: largura, a: ALTURA_TAG };
}

const cruza = (r, s) => r.x < s.x + s.l && s.x < r.x + r.l
                     && r.y < s.y + s.a && s.y < r.y + r.a;

/**
 * O rótulo da diferença, acima da coluna.
 *
 * Ele sobe de degrau em degrau até achar lugar livre. Com 38 rodadas na régua
 * os vizinhos raramente se tocam, mas a coluna estreita quando a tela é de uma
 * série com mais clubes, e aí o encavalamento aparece — é a diferença que não
 * pode sumir, porque é o assunto do card.
 */
function desenharRotulos(ctx, rotulos, ocupados, topo) {
  const postos = [];

  for (const r of rotulos) {
    ctx.save();
    ctx.font = '800 14px "Assistant", sans-serif';
    const largura = ctx.measureText(r.texto).width + 6;
    ctx.restore();

    let base = r.base;
    for (let nivel = 0; nivel < 4; nivel++) {
      const caixaR = { x: r.cx - largura / 2, y: base - 12, l: largura, a: 16 };
      const bate = [...ocupados, ...postos].some((outro) => cruza(caixaR, outro));
      if (!bate || base - NIVEL < topo + 12) { postos.push(caixaR); break; }
      base -= NIVEL;
    }

    texto(ctx, r.texto, r.cx, base,
          { tamanho: 14, peso: 800, alinha: "center", cor: r.cor });
  }
}

/**
 * O resumo da série, na calha da direita.
 *
 * Com a faixa de números fora do card, é aqui que fica o que a coluna sozinha
 * não conta: onde a diferença está hoje e quantas rodadas cada lado passou na
 * frente.
 */
function blocoDoResumo(ctx, { resumo, distancia, x, eixo, a, b }) {
  const { atual, maior, menor, contagem, viradas, media, rodadas } = resumo;
  const largura = LARGURA_SELO;
  const linhas = distancia
    ? [["maior distância", String(Math.abs(maior.dif)), COR.positivo],
       ["menor distância", String(Math.abs(menor.dif)), COR.positivoEscuro],
       ["distância média", num(media), COR.cinzaTexto]]
    : [[`${rotuloDoLado(a)} à frente`, String(contagem.frente), COR.positivo],
       [`${rotuloDoLado(b)} à frente`, String(contagem.atras), COR.negativo],
       ["viradas", String(viradas), COR.cinzaTexto]];

  const altura = 96 + linhas.length * 24;
  const y = eixo - altura / 2;
  const cor = atual.dif > 0 ? COR.positivo : atual.dif < 0 ? COR.negativo : COR.cinzaTexto;

  caixa(ctx, x - 4, y, largura, altura, COR.branco, 9);
  ctx.save();
  ctx.strokeStyle = COR.linha;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - 3.5, y + .5, largura - 1, altura - 1, 9);
  ctx.stroke();
  ctx.restore();

  texto(ctx, `em ${rodadas} rodadas`, x + 10, y + 22,
        { tamanho: 10.5, peso: 700, maiuscula: true, espaco: .9,
          cor: COR.cinzaEscuro });
  texto(ctx, distancia ? String(Math.abs(atual.dif)) : sinalizado(atual.dif),
        x + 10, y + 62, { tamanho: 34, peso: 800, cor });
  texto(ctx, `${distancia ? "distância" : "diferença"} na `
           + `${ordinal(atual.rodada)} rodada`,
        x + 10, y + 82, { tamanho: 11, peso: 700, cor: COR.cinzaEscuro });

  linhas.forEach(([rotulo, valor, tinta], i) => {
    const yLinha = y + 108 + i * 24;
    linhaH(ctx, x + 10, x + largura - 14, yLinha - 16, COR.cinzaClaro);
    texto(ctx, cortar(ctx, rotulo, largura - 62, 11.5), x + 10, yLinha,
          { tamanho: 11.5, cor: COR.cinzaEscuro });
    texto(ctx, valor, x + largura - 14, yLinha,
          { tamanho: 15, peso: 800, cor: tinta, alinha: "right" });
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
        { tamanho: 13, peso: 700, cor: COR.positivoEscuro });
  texto(ctx, `${donos.length} ${donos.length === 1 ? "clube passou" : "clubes passaram"}`,
        x + 12, y + 42, { tamanho: 11.5, cor: COR.cinzaEscuro });

  const ladoEscudo = Math.min(24, largura - 6);
  let anterior = null;
  for (const passo of serieDif) {
    const cx = centro(passo.rodada);
    const { equipe } = passo[lado];

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
    // A sigla, e não os pontos: a pontuação já está na tag da ponta da coluna,
    // e o que falta aqui é desfazer a dúvida entre dois escudos parecidos.
    const sigla = clubes[equipe]?.sigla
      ?? nomeBonito(equipe).slice(0, 3).toUpperCase();
    texto(ctx, sigla, cx, y + ladoEscudo + 18,
          { tamanho: 10.5, peso: 700, alinha: "center", cor: COR.cinzaTexto });
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
      { ...descrever(p.a, a), cor: COR.positivo, pontos: p.a.pontos },
      { ...descrever(p.b, b), cor: COR.negativo, pontos: p.b.pontos },
    ],
    diferenca: {
      rotulo: sinalizado(p.dif),
      texto: p.dif === 0 ? "empatados"
        : `${rotuloDoLado(p.dif > 0 ? a : b)} à frente`,
      cor: p.dif > 0 ? COR.positivo : p.dif < 0 ? COR.negativo : COR.cinzaTexto,
    },
  }));

  return { pontos, topo, alturaPlot, x0, x1, largura, unidade: "rodada" };
}
