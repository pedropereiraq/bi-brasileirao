/**
 * Card: evolução da pontuação de duas equipes.
 *
 * Duas linhas — equipe 1 em azul, equipe 2 em vermelho — sobre as rodadas da
 * edição. Embaixo, uma faixa para cada equipe com o escudo do adversário, a
 * etiqueta casa/fora e o placar de cada jogo já realizado.
 *
 * As colunas das faixas e os pontos das linhas dividem a mesma escala de x, de
 * propósito: é o que deixa ler na vertical, do placar para a curva.
 */
import { formatoLongo } from "/js/motor.js";
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";

const CALHA = 148;          // coluna da esquerda: eixo e identificação
const nomeCurto = (equipe) => equipe.replace(/\s*\([A-Z]{2}\)$/, "");

/**
 * A campanha de um clube indexada por rodada.
 *
 * Acumula por **rodada**, e não em ordem cronológica: um jogo adiado da rodada
 * 4 disputado em agosto pertence à rodada 4. Usar o acumulado cronológico aqui
 * fazia a linha dar um pico e voltar — pontos acumulados não caem.
 *
 * Rodada sem jogo carrega o valor anterior, deixando a linha plana.
 */
function campanhaPorRodada(jogos, clube, rodadas) {
  const meus = formatoLongo(jogos).filter((l) => l.equipe === clube);
  const porRodada = new Map(meus.map((l) => [l.rodada, l]));

  const saida = [];
  let pts = 0, jogados = 0;
  for (let r = 1; r <= rodadas; r++) {
    const jogo = porRodada.get(r) ?? null;
    if (jogo) { pts += jogo.pts; jogados += 1; }
    saida.push({ rodada: r, pts, jogados, jogo });
  }
  return saida;
}

export function montarCartao(estado) {
  const { edicao, jogos, clubes, equipeA, equipeB } = estado;
  if (!equipeA || !equipeB || equipeA === equipeB) return null;

  const rodadas = edicao.rodadas;
  const a = campanhaPorRodada(jogos, equipeA, rodadas);
  const b = campanhaPorRodada(jogos, equipeB, rodadas);

  // Até onde desenhar: a última rodada em que qualquer das duas jogou.
  const ultima = Math.max(
    ...a.filter((p) => p.jogo).map((p) => p.rodada),
    ...b.filter((p) => p.jogo).map((p) => p.rodada),
    1);

  const finalA = a[ultima - 1], finalB = b[ultima - 1];
  const diferenca = Math.abs(finalA.pts - finalB.pts);
  const naFrente = finalA.pts === finalB.pts ? null
                 : finalA.pts > finalB.pts ? equipeA : equipeB;

  return {
    titulo: `${nomeCurto(equipeA)} × ${nomeCurto(equipeB)}`,
    subtitulo: `Evolução da pontuação · Série ${edicao.serie} · ${edicao.ano} · `
             + (edicao.encerrada ? "edição completa" : `até a rodada ${ultima}`),
    arquivo: `evolucao-${nomeCurto(equipeA)}-${nomeCurto(equipeB)}-${edicao.ano}`,
    nota: "Pontos acumulados rodada a rodada. Jogo sem placar não entra na "
        + "conta; rodada sem jogo mantém a linha no mesmo ponto.",
    numeros: [
      naFrente
        ? { valor: `+${diferenca}`, nome: `de vantagem do ${nomeCurto(naFrente)}`,
            destaque: "azul" }
        : { valor: "empate", nome: "as duas com os mesmos pontos", destaque: "azul" },
      { valor: finalA.pts, nome: `${nomeCurto(equipeA)} · ${finalA.jogados}J` },
      { valor: finalB.pts, nome: `${nomeCurto(equipeB)} · ${finalB.jogados}J` },
      { valor: ultima, nome: "rodadas" },
    ],
    corpo: async (ctx, y) => {
      const x0 = MARGEM + CALHA;
      const x1 = CARD.largura - MARGEM;
      const largura = (x1 - x0) / ultima;
      const centro = (r) => x0 + (r - 0.5) * largura;

      // Alturas escolhidas para o corpo chegar ao rodapé sem sobra: a skill
      // reprova card com buraco branco embaixo.
      const topo = y + 46, alturaPlot = 270;
      const yRodadas = topo + alturaPlot + 24;
      const yFaixaA = yRodadas + 16;
      const yFaixaB = yFaixaA + 78;

      desenharLinhas(ctx, { a, b, ultima, centro, topo, alturaPlot, x0, x1 });
      await legenda(ctx, MARGEM, y, clubes, equipeA, equipeB);

      // Com muitas rodadas os números se encostam; mostra de duas em duas,
      // garantindo sempre a primeira e a última.
      const salto = ultima > 26 ? 2 : 1;
      for (let r = 1; r <= ultima; r++) {
        if (r !== 1 && r !== ultima && (r - 1) % salto !== 0) continue;
        texto(ctx, r, centro(r), yRodadas,
              { tamanho: 11, cor: COR.cinzaEscuro, alinha: "center" });
      }

      await faixaDeJogos(ctx, { passos: a, clube: equipeA, cor: COR.azul,
        clubes, ultima, centro, largura, x: MARGEM, y: yFaixaA });
      await faixaDeJogos(ctx, { passos: b, clube: equipeB, cor: COR.vermelho,
        clubes, ultima, centro, largura, x: MARGEM, y: yFaixaB });

      texto(ctx, "etiqueta C, jogo em casa · F, fora de casa · placar sempre na "
                 + "ordem do clube da faixa · azul, triunfo · cinza, empate · "
                 + "vermelho, derrota",
            MARGEM, yFaixaB + 80, { tamanho: 13, cor: COR.cinzaEscuro });
    },
  };
}

/* --------------------------------------------------------------- linhas */
function desenharLinhas(ctx, o) {
  const { a, b, ultima, centro, topo, alturaPlot, x0, x1 } = o;
  const maximo = Math.max(a[ultima - 1].pts, b[ultima - 1].pts, 1);
  const escala = (pts) => topo + alturaPlot - (pts / maximo) * alturaPlot;

  // Grade: quatro marcas bastam para ler sem poluir.
  const passo = Math.max(1, Math.ceil(maximo / 4 / 5) * 5);
  for (let v = 0; v <= maximo; v += passo) {
    linhaH(ctx, x0 - 10, x1, escala(v), COR.cinzaClaro);
    texto(ctx, v, x0 - 18, escala(v) + 4,
          { tamanho: 12, cor: COR.cinzaEscuro, alinha: "right" });
  }

  for (const [passos, cor] of [[a, COR.azul], [b, COR.vermelho]]) {
    ctx.save();
    ctx.strokeStyle = cor;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let r = 1; r <= ultima; r++) {
      const ponto = [centro(r), escala(passos[r - 1].pts)];
      if (r === 1) ctx.moveTo(...ponto); else ctx.lineTo(...ponto);
    }
    ctx.stroke();

    // Marca só as rodadas em que houve jogo: ponto em rodada vazia sugeriria
    // que aconteceu alguma coisa ali.
    ctx.fillStyle = cor;
    for (let r = 1; r <= ultima; r++) {
      if (!passos[r - 1].jogo) continue;
      ctx.beginPath();
      ctx.arc(centro(r), escala(passos[r - 1].pts), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const fim = passos[ultima - 1];
    ctx.beginPath();
    ctx.arc(centro(ultima), escala(fim.pts), 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // O rótulo de quem está atrás desce; senão os dois se encavalam quando as
    // campanhas terminam perto uma da outra.
    const atras = fim.pts < outro(passos).pts;
    texto(ctx, fim.pts, centro(ultima) - 16, escala(fim.pts) + (atras ? 26 : -16),
          { tamanho: 20, peso: 800, cor, alinha: "right" });
  }

  function outro(passos) {
    return (passos === a ? b : a)[ultima - 1];
  }
}

async function legenda(ctx, x, y, clubes, equipeA, equipeB) {
  texto(ctx, "Pontos acumulados", x, y + 15,
        { tamanho: 20, peso: 700, cor: COR.azul, familia: "Bree Serif" });

  let cx = x + 250;
  for (const [clube, cor] of [[equipeA, COR.azul], [equipeB, COR.vermelho]]) {
    caixa(ctx, cx, y + 4, 26, 6, cor, 3);
    const escudo = await imagem(clubes[clube]?.escudo);
    desenharEscudo(ctx, escudo, cx + 34, y - 5, 22);
    texto(ctx, nomeCurto(clube), cx + 62, y + 13,
          { tamanho: 15, peso: 700, cor: COR.azulEscuro });
    cx += 84 + ctx.measureText(nomeCurto(clube)).width;
  }
}

/* ---------------------------------------------------------- faixa de jogos */
async function faixaDeJogos(ctx, o) {
  const { passos, clube, cor, clubes, ultima, centro, largura, x, y } = o;

  // Identificação da faixa, na calha: barra da cor da linha, escudo e nome.
  caixa(ctx, x, y + 4, 6, 56, cor, 3);
  const meu = await imagem(clubes[clube]?.escudo);
  desenharEscudo(ctx, meu, x + 16, y + 6, 34);
  texto(ctx, cortar(ctx, nomeCurto(clube), CALHA - 70, 14, 700),
        x + 58, y + 28, { tamanho: 14, peso: 700, cor: COR.azulEscuro });

  const disputados = passos.filter((p) => p.jogo).length;
  texto(ctx, `${disputados} ${disputados === 1 ? "jogo" : "jogos"}`,
        x + 58, y + 46, { tamanho: 12, cor: COR.cinzaEscuro });

  const escudo = Math.min(26, largura - 8);
  for (let r = 1; r <= ultima; r++) {
    const passo = passos[r - 1];
    if (!passo.jogo) continue;           // só os jogos já realizados
    const j = passo.jogo;
    const cx = centro(r);

    const im = await imagem(clubes[j.adversario]?.escudo);
    desenharEscudo(ctx, im, cx - escudo / 2, y + 2, escudo);

    const emCasa = j.mando === "casa";
    const etiqueta = emCasa ? "C" : "F";
    const largEtiqueta = 15;
    caixa(ctx, cx - largEtiqueta - 1, y + escudo + 6, largEtiqueta, 14,
          emCasa ? COR.azulLavado : COR.cinzaClaro, 3);
    texto(ctx, etiqueta, cx - largEtiqueta / 2 - 1, y + escudo + 17,
          { tamanho: 10, peso: 800, alinha: "center",
            cor: emCasa ? COR.azul : COR.cinzaEscuro });

    texto(ctx, `${j.gp}×${j.gc}`, cx + 2, y + escudo + 17,
          { tamanho: 11.5, peso: 800, cor: corDoResultado(j.resultado) });
  }
}

const corDoResultado = (resultado) => resultado === "T" ? COR.azul
  : resultado === "E" ? COR.cinzaEscuro : COR.vermelho;
