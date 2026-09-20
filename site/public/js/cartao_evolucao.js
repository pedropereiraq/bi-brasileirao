/**
 * Card: evolução da pontuação de duas campanhas.
 *
 * Duas linhas — campanha 1 em azul, campanha 2 em vermelho — sobre os **jogos
 * em ordem cronológica**, não sobre a rodada. Dois motivos:
 *
 * 1. Rodada não é tempo. Um jogo adiado da rodada 4 disputado em agosto punha
 *    o acumulado de agosto lá atrás, e a linha dava um pico e voltava.
 * 2. Comparar campanhas de anos diferentes só faz sentido pelo n-ésimo jogo.
 *
 * O eixo vai sempre até 38, mesmo com a edição em andamento — é o tamanho de
 * uma campanha, e encurtá-lo esconderia o quanto falta. A linha de cada equipe
 * termina no último jogo que ela disputou: quem jogou menos, para antes.
 */
import { formatoLongo } from "/js/motor.js";
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito, nomeCurto } from "/js/nomes.js";

const CALHA = 152;          // coluna da esquerda: eixo e identificação
const JOGOS = 38;           // o eixo vai sempre até aqui

/** A campanha de um clube em ordem cronológica: o n-ésimo jogo disputado. */
function campanhaCronologica(jogos, clube) {
  const meus = formatoLongo(jogos)
    .filter((l) => l.equipe === clube)
    .sort((x, y) => (x.data === y.data ? x.rodada - y.rodada
                                       : x.data < y.data ? -1 : 1));

  let pts = 0;
  return meus.map((jogo, i) => {
    pts += jogo.pts;
    return { n: i + 1, pts, jogo };
  });
}

export function montarCartao(estado) {
  const { serie, a, b, clubes } = estado;
  if (!a?.clube || !b?.clube || !a.jogos || !b.jogos) return null;
  if (a.clube === b.clube && a.edicao.ano === b.edicao.ano) return null;

  const campanhaA = campanhaCronologica(a.jogos, a.clube);
  const campanhaB = campanhaCronologica(b.jogos, b.clube);
  if (!campanhaA.length && !campanhaB.length) return null;

  const anosIguais = a.edicao.ano === b.edicao.ano;
  const rotuloA = anosIguais ? nomeBonito(a.clube)
                             : `${nomeBonito(a.clube)} ${a.edicao.ano}`;
  const rotuloB = anosIguais ? nomeBonito(b.clube)
                             : `${nomeBonito(b.clube)} ${b.edicao.ano}`;

  return {
    titulo: `${rotuloA} × ${rotuloB}`,
    subtitulo: `Evolução da pontuação · Série ${serie}`
             + (anosIguais ? ` · ${a.edicao.ano}` : "")
             + " · jogos em ordem cronológica",
    arquivo: `evolucao-${nomeCurto(a.clube)}-${a.edicao.ano}`
           + `-${nomeCurto(b.clube)}-${b.edicao.ano}`,
    numeros: [],   // sem faixa de números: o gráfico fica com a altura toda
    nota: "",
    corpo: async (ctx, y) => {
      const x0 = MARGEM + CALHA;
      const x1 = CARD.largura - MARGEM;
      const largura = (x1 - x0) / JOGOS;
      const centro = (n) => x0 + (n - 0.5) * largura;

      const topo = y + 42, alturaPlot = 424;
      const yEixo = topo + alturaPlot + 24;
      const yFaixaA = yEixo + 16;
      const yFaixaB = yFaixaA + 80;

      await legenda(ctx, MARGEM, y, clubes,
                    [[a.clube, rotuloA, COR.azul], [b.clube, rotuloB, COR.vermelho]]);
      desenharLinhas(ctx, { campanhaA, campanhaB, centro, topo, alturaPlot, x0, x1 });

      for (let n = 1; n <= JOGOS; n++) {
        if (n !== 1 && n !== JOGOS && n % 2 === 0) continue;
        texto(ctx, n, centro(n), yEixo,
              { tamanho: 11, cor: COR.cinzaEscuro, alinha: "center" });
      }

      await faixaDeJogos(ctx, { campanha: campanhaA, clube: a.clube,
        rotulo: rotuloA, cor: COR.azul, clubes, centro, largura,
        x: MARGEM, y: yFaixaA });
      await faixaDeJogos(ctx, { campanha: campanhaB, clube: b.clube,
        rotulo: rotuloB, cor: COR.vermelho, clubes, centro, largura,
        x: MARGEM, y: yFaixaB });
    },
  };
}

/* --------------------------------------------------------------- linhas */
function desenharLinhas(ctx, o) {
  const { campanhaA, campanhaB, centro, topo, alturaPlot, x0, x1 } = o;
  const fimA = campanhaA.at(-1), fimB = campanhaB.at(-1);
  const maximo = Math.max(fimA?.pts ?? 0, fimB?.pts ?? 0, 1);
  const escala = (pts) => topo + alturaPlot - (pts / maximo) * alturaPlot;

  const passo = Math.max(5, Math.ceil(maximo / 5 / 5) * 5);
  for (let v = 0; v <= maximo; v += passo) {
    linhaH(ctx, x0 - 10, x1, escala(v), COR.cinzaClaro);
    texto(ctx, v, x0 - 18, escala(v) + 5,
          { tamanho: 13, cor: COR.cinzaEscuro, alinha: "right" });
  }

  const series = [[campanhaA, COR.azul], [campanhaB, COR.vermelho]];
  for (const [campanha, cor] of series) {
    if (!campanha.length) continue;
    ctx.save();
    ctx.strokeStyle = cor;
    ctx.lineWidth = 4.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    campanha.forEach((p, i) => {
      const ponto = [centro(p.n), escala(p.pts)];
      if (i === 0) ctx.moveTo(...ponto); else ctx.lineTo(...ponto);
    });
    ctx.stroke();

    ctx.fillStyle = cor;
    for (const p of campanha) {
      ctx.beginPath();
      ctx.arc(centro(p.n), escala(p.pts), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Selo com a pontuação final, logo depois do último ponto de cada linha.
  // Como o eixo vai até 38 e a edição costuma estar em andamento, sobra
  // espaço à direita para ele.
  const selos = series
    .map(([campanha, cor]) => ({ fim: campanha.at(-1), cor }))
    .filter((s) => s.fim)
    .sort((p, q) => escala(p.fim.pts) - escala(q.fim.pts));

  let ultimoY = -Infinity;
  for (const { fim, cor } of selos) {
    let cy = escala(fim.pts);
    if (cy - ultimoY < 50) cy = ultimoY + 50;   // não deixa os dois se tocarem
    ultimoY = cy;
    selo(ctx, Math.min(centro(fim.n) + 16, x1 - 92), cy, fim.pts, cor);
  }
}

/** Caixa com a pontuação final, grande, na cor da linha. */
function selo(ctx, x, y, valor, cor) {
  ctx.save();
  ctx.font = '800 34px "Assistant", sans-serif';
  const largura = Math.max(76, ctx.measureText(String(valor)).width + 36);
  ctx.restore();

  caixa(ctx, x, y - 24, largura, 48, cor, 8);
  texto(ctx, valor, x + largura / 2, y + 12,
        { tamanho: 34, peso: 800, cor: COR.branco, alinha: "center" });
}

async function legenda(ctx, x, y, clubes, series) {
  texto(ctx, "Pontos acumulados", x, y + 16,
        { tamanho: 21, peso: 700, cor: COR.azul, familia: "Bree Serif" });

  let cx = x + 260;
  for (const [clube, rotulo, cor] of series) {
    caixa(ctx, cx, y + 5, 30, 7, cor, 3);
    const escudo = await imagem(clubes[clube]?.escudo);
    desenharEscudo(ctx, escudo, cx + 40, y - 5, 24);
    texto(ctx, rotulo, cx + 72, y + 14,
          { tamanho: 16, peso: 700, cor: COR.azulEscuro });
    ctx.save();
    ctx.font = '700 16px "Assistant", sans-serif';
    cx += 96 + ctx.measureText(rotulo).width;
    ctx.restore();
  }
}

/* ---------------------------------------------------------- faixa de jogos */
async function faixaDeJogos(ctx, o) {
  const { campanha, clube, rotulo, cor, clubes, centro, largura, x, y } = o;

  caixa(ctx, x, y + 4, 6, 62, cor, 3);
  const meu = await imagem(clubes[clube]?.escudo);
  desenharEscudo(ctx, meu, x + 16, y + 8, 36);
  texto(ctx, cortar(ctx, rotulo, CALHA - 76, 14, 700), x + 60, y + 30,
        { tamanho: 14, peso: 700, cor: COR.azulEscuro });
  texto(ctx, `${campanha.length} ${campanha.length === 1 ? "jogo" : "jogos"}`,
        x + 60, y + 50, { tamanho: 12.5, cor: COR.cinzaEscuro });

  const ladoEscudo = Math.min(26, largura - 8);
  for (const { n, jogo } of campanha) {
    const cx = centro(n);
    const im = await imagem(clubes[jogo.adversario]?.escudo);
    desenharEscudo(ctx, im, cx - ladoEscudo / 2, y + 2, ladoEscudo);

    // Casa/fora por extenso, em linha própria entre o escudo e o placar.
    const emCasa = jogo.mando === "casa";
    const rotuloMando = emCasa ? "casa" : "fora";
    ctx.save();
    ctx.font = '700 10px "Assistant", sans-serif';
    const larguraPilula = ctx.measureText(rotuloMando).width + 10;
    ctx.restore();
    caixa(ctx, cx - larguraPilula / 2, y + ladoEscudo + 5, larguraPilula, 14,
          emCasa ? COR.azulLavado : COR.cinzaClaro, 4);
    texto(ctx, rotuloMando, cx, y + ladoEscudo + 15,
          { tamanho: 10, peso: 700, alinha: "center",
            cor: emCasa ? COR.azul : COR.cinzaEscuro });

    texto(ctx, `${jogo.gp}×${jogo.gc}`, cx, y + ladoEscudo + 33,
          { tamanho: 12.5, peso: 800, alinha: "center",
            cor: corDoResultado(jogo.resultado) });
  }
}

const corDoResultado = (resultado) => resultado === "T" ? COR.azul
  : resultado === "E" ? COR.cinzaEscuro : COR.vermelho;
