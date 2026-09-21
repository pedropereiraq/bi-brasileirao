/**
 * O que os cards de campanha têm em comum.
 *
 * Dois cards desenham pontos acumulados sobre os jogos de um clube: o
 * comparativo, que põe duas campanhas lado a lado, e a evolução, que põe uma
 * campanha contra o ritmo de duas posições. A agenda, a faixa de jogos do
 * eixo x, a legenda e o traçado das linhas são os mesmos — e precisam
 * continuar sendo, senão o mesmo jogo aparece de dois jeitos em dois cards.
 *
 * O eixo vai sempre até 38, mesmo com a edição em andamento: é o tamanho de
 * uma campanha, e encurtá-lo esconderia o quanto falta. A linha de cada equipe
 * termina no último jogo que ela disputou.
 */
import {
  RODADA, DATA, MANDANTE, VISITANTE, GOLS_M, GOLS_V, STATUS,
} from "/js/motor.js";
import {
  COR, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";

export const CALHA = 128;      // coluna da esquerda: eixo e identificação
export const CALHA_DIR = 200;  // coluna da direita: rótulos e blocos
export const JOGOS = 38;       // o eixo vai sempre até aqui

/**
 * A agenda completa de um clube em ordem cronológica: o n-ésimo jogo, tenha
 * ele sido disputado ou não.
 *
 * Os que já aconteceram acumulam pontos; os que faltam entram com adversário e
 * mando, sem placar. É o que permite ao eixo mostrar a campanha inteira e
 * deixar claro o que ainda vem pela frente.
 *
 * A ordem é a do calendário, não a da rodada. Rodada não é tempo: um jogo
 * adiado da rodada 4 disputado em agosto punha o acumulado de agosto lá atrás,
 * e a linha dava um pico e voltava.
 */
export function campanhaCompleta(jogos, clube) {
  const meus = jogos
    .filter((j) => j[MANDANTE] === clube || j[VISITANTE] === clube)
    .map((j) => {
      const emCasa = j[MANDANTE] === clube;
      const feito = j[STATUS] === "realizado"
        && j[GOLS_M] !== null && j[GOLS_V] !== null;
      const gp = emCasa ? j[GOLS_M] : j[GOLS_V];
      const gc = emCasa ? j[GOLS_V] : j[GOLS_M];
      return {
        rodada: j[RODADA],
        data: j[DATA],
        adversario: emCasa ? j[VISITANTE] : j[MANDANTE],
        mando: emCasa ? "casa" : "fora",
        realizado: feito,
        gp: feito ? gp : null,
        gc: feito ? gc : null,
        resultado: feito ? (gp > gc ? "T" : gp === gc ? "E" : "D") : null,
      };
    })
    .sort((x, y) => (x.data === y.data ? x.rodada - y.rodada
                                       : x.data < y.data ? -1 : 1));

  let pts = 0;
  return meus.map((jogo, i) => {
    if (jogo.realizado) pts += jogo.resultado === "T" ? 3 : jogo.resultado === "E" ? 1 : 0;
    return { n: i + 1, pts, jogo, realizado: jogo.realizado };
  });
}

/** Só o trecho já disputado — é o que a linha desenha e a conta usa. */
export const disputados = (campanha) => campanha.filter((p) => p.realizado);

export const dataBr = (iso) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

/**
 * Uma linha, com contorno claro por baixo: onde duas linhas andam juntas, é o
 * que mantém a de baixo visível em vez de sumir sob a de cima.
 *
 * Recebe coordenadas prontas, e não pontos de campanha, porque nem toda linha
 * do card é uma campanha — a régua de uma posição é uma reta.
 */
export function tracarLinha(ctx, coordenadas, cor, { pontilhada = false,
                                                     espessura = 4.5 } = {}) {
  if (coordenadas.length < 2) return;
  for (const [grossura, tinta] of [[espessura + 4.5, COR.fundo], [espessura, cor]]) {
    ctx.save();
    ctx.strokeStyle = tinta;
    ctx.lineWidth = grossura;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    // Traço de comprimento zero com ponta redonda vira bolinha: é o pontilhado
    // que não se confunde com a linha cheia nem com a faixa de fundo.
    if (pontilhada) ctx.setLineDash([0.1, 11]);
    ctx.beginPath();
    coordenadas.forEach((xy, i) => {
      if (i === 0) ctx.moveTo(...xy); else ctx.lineTo(...xy);
    });
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Legenda no alto do gráfico. Cada item é `{ rotulo, cor, clube?, pontilhada? }`
 * — o escudo só entra quando o item é um clube.
 */
export async function legenda(ctx, x, y, clubes, itens) {
  let cx = x;
  for (const item of itens) {
    if (item.pontilhada) {
      ctx.save();
      ctx.strokeStyle = item.cor;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.setLineDash([0.1, 11]);
      ctx.beginPath();
      ctx.moveTo(cx, y + 8);
      ctx.lineTo(cx + 30, y + 8);
      ctx.stroke();
      ctx.restore();
    } else {
      caixa(ctx, cx, y + 5, 30, 7, item.cor, 3);
    }
    cx += 40;

    if (item.clube) {
      const escudo = await imagem(clubes[item.clube]?.escudo);
      desenharEscudo(ctx, escudo, cx, y - 5, 24);
      cx += 32;
    }

    texto(ctx, item.rotulo, cx, y + 14,
          { tamanho: 16, peso: 700, cor: COR.azulEscuro });
    ctx.save();
    ctx.font = '700 16px "Assistant", sans-serif';
    cx += 34 + ctx.measureText(item.rotulo).width;
    ctx.restore();
  }
}

/**
 * A faixa do eixo x: escudo do adversário, pílula de casa/fora e placar, um
 * bloco por jogo. Jogo que ainda vem entra esmaecido e com traço no lugar do
 * placar — está na agenda, não no retrospecto.
 */
export async function faixaDeJogos(ctx, o) {
  const { agenda, clube, rotulo, cor, clubes, centro, largura, x, y } = o;
  const feitos = agenda.filter((p) => p.realizado).length;

  caixa(ctx, x, y + 4, 6, 62, cor, 3);
  const meu = await imagem(clubes[clube]?.escudo);
  desenharEscudo(ctx, meu, x + 12, y + 10, 30);
  const [nome, ...resto] = rotulo.split(" ");
  const ano = resto.join(" ");
  texto(ctx, cortar(ctx, nome, CALHA - 54, 13, 700), x + 48, y + (ano ? 26 : 31),
        { tamanho: 13, peso: 700, cor: COR.azulEscuro });
  if (ano) {
    texto(ctx, ano, x + 48, y + 41, { tamanho: 12, peso: 700, cor: COR.cinzaEscuro });
  }
  texto(ctx, `${feitos} de ${agenda.length}`, x + 48, y + (ano ? 56 : 49),
        { tamanho: 11.5, cor: COR.cinzaEscuro });

  const ladoEscudo = Math.min(25, largura - 6);
  for (const { n, jogo, realizado } of agenda) {
    const cx = centro(n);
    const im = await imagem(clubes[jogo.adversario]?.escudo);

    ctx.save();
    if (!realizado) ctx.globalAlpha = 0.42;
    desenharEscudo(ctx, im, cx - ladoEscudo / 2, y + 2, ladoEscudo);
    ctx.restore();

    const emCasa = jogo.mando === "casa";
    const rotuloMando = emCasa ? "casa" : "fora";
    ctx.save();
    ctx.font = '700 9px "Assistant", sans-serif';
    const larguraPilula = ctx.measureText(rotuloMando).width + 8;
    ctx.restore();

    const fundoPilula = realizado
      ? (emCasa ? COR.azulLavado : COR.cinzaClaro)
      : COR.fundo;
    caixa(ctx, cx - larguraPilula / 2, y + ladoEscudo + 5, larguraPilula, 13,
          fundoPilula, 4);
    if (!realizado) {
      ctx.save();
      ctx.strokeStyle = COR.linha;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cx - larguraPilula / 2 + .5, y + ladoEscudo + 5.5,
                    larguraPilula - 1, 12, 4);
      ctx.stroke();
      ctx.restore();
    }
    texto(ctx, rotuloMando, cx, y + ladoEscudo + 14,
          { tamanho: 9, peso: 700, alinha: "center",
            cor: realizado ? (emCasa ? COR.azul : COR.cinzaEscuro) : COR.cinzaEscuro });

    if (realizado) {
      texto(ctx, `${jogo.gp}×${jogo.gc}`, cx, y + ladoEscudo + 32,
            { tamanho: 12, peso: 800, alinha: "center",
              cor: corDoResultado(jogo.resultado) });
    } else {
      // Traço no lugar do placar: a casa existe, o resultado ainda não.
      linhaH(ctx, cx - 7, cx + 7, y + ladoEscudo + 28, COR.cinzaClaro, 2);
    }
  }
}

/**
 * Triunfo, empate, derrota — ou vitória, empate, derrota, conforme a marca.
 *
 * É um par positivo/negativo com o empate no meio, e não a cor da identidade:
 * no ECBahia dá o azul e o vermelho de sempre; no Podcast45 dá verde e
 * vermelho, e não o preto e o dourado da marca.
 */
export const corDoResultado = (resultado) => resultado === "T" ? COR.positivo
  : resultado === "E" ? COR.cinzaEscuro : COR.negativo;

/** Descreve um jogo da agenda para a dica do mouse. */
export function descreverJogo(passo) {
  if (!passo) return null;
  const { jogo } = passo;
  const local = jogo.mando === "casa" ? "casa" : "fora";
  return {
    pontos: passo.realizado ? passo.pts : null,
    detalhe: passo.realizado
      ? `${local} · ${jogo.gp}×${jogo.gc} ${nomeBonito(jogo.adversario)} · `
        + dataBr(jogo.data)
      : `${local} · ${nomeBonito(jogo.adversario)} · ${dataBr(jogo.data)} · a jogar`,
    realizado: passo.realizado,
  };
}

/* ------------------------------------------------------------- rótulos */
const cruzam = (a, b) => a.x < b.x + b.l && b.x < a.x + a.l
                      && a.y < b.y + b.a && b.y < a.y + a.a;

/** Se a caixa do rótulo é atravessada por algum trecho daquela linha. */
function cortaLinha(caixa, linha, pular = -1) {
  for (let i = 0; i < linha.length - 1; i++) {
    if (i === pular || i === pular - 1) continue;
    const [x1, y1] = linha[i], [x2, y2] = linha[i + 1];
    const de = Math.max(caixa.x, Math.min(x1, x2));
    const ate = Math.min(caixa.x + caixa.l, Math.max(x1, x2));
    if (de > ate) continue;
    const yEm = (x) => (x2 === x1 ? y1 : y1 + ((y2 - y1) * (x - x1)) / (x2 - x1));
    const ya = yEm(de), yb = yEm(ate);
    if (Math.max(ya, yb) >= caixa.y && Math.min(ya, yb) <= caixa.y + caixa.a) {
      return true;
    }
  }
  return false;
}

/**
 * O valor de cada ponto escrito ao lado dele.
 *
 * Com 38 pontos, um rótulo por ponto só funciona se ele souber desviar: tenta
 * acima, tenta abaixo, e vai afastando até achar lugar que não encoste em
 * outro rótulo nem nas linhas que o card já desenhou. A própria linha do clube
 * entra na conta, menos os dois trechos que saem do ponto — esses passam pelo
 * ponto por definição, e fugir deles empurraria todo rótulo para longe.
 *
 * Quando nada cabe, o rótulo fica na primeira tentativa: encavalar é ruim,
 * sumir é pior — o número é o assunto.
 */
export function rotularPontos(ctx, o) {
  const { pontos, linhas = [], propria = null, cor, tamanho = 11,
          topo, base } = o;
  const postos = [];
  const desvios = [-14, 14, -25, 25, -36, 36];

  for (const ponto of pontos) {
    const conteudo = String(ponto.texto);
    ctx.save();
    ctx.font = `800 ${tamanho}px "Assistant", sans-serif`;
    const largura = ctx.measureText(conteudo).width + 5;
    ctx.restore();
    const altura = tamanho + 3;

    let escolhido = desvios[0];
    for (const desvio of desvios) {
      const cy = ponto.y + desvio;
      if (cy - altura / 2 < topo + 2 || cy + altura / 2 > base - 2) continue;
      const alvo = { x: ponto.x - largura / 2, y: cy - altura / 2,
                     l: largura, a: altura };
      if (postos.some((outro) => cruzam(alvo, outro))) continue;
      if (linhas.some((linha) => cortaLinha(alvo, linha))) continue;
      if (propria && cortaLinha(alvo, propria, ponto.i)) continue;
      escolhido = desvio;
      postos.push(alvo);
      break;
    }

    // Um respiro da cor do fundo por baixo: onde o rótulo não teve para onde
    // fugir, ele ainda se lê.
    ctx.save();
    ctx.fillStyle = COR.fundo;
    ctx.globalAlpha = .8;
    ctx.beginPath();
    ctx.roundRect(ponto.x - largura / 2, ponto.y + escolhido - altura / 2,
                  largura, altura, 3);
    ctx.fill();
    ctx.restore();

    texto(ctx, conteudo, ponto.x, ponto.y + escolhido + tamanho / 3,
          { tamanho, peso: 800, alinha: "center", cor: cor ?? COR.azulEscuro });
  }
}
