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
import {
  RODADA, DATA, MANDANTE, VISITANTE, GOLS_M, GOLS_V, STATUS,
} from "/js/motor.js";
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito, nomeCurto, artigo } from "/js/nomes.js";

const CALHA = 128;          // coluna da esquerda: eixo e identificação
const CALHA_DIR = 200;      // coluna da direita: rótulos finais e diferenças
const JOGOS = 38;           // o eixo vai sempre até aqui

/**
 * A agenda completa de um clube em ordem cronológica: o n-ésimo jogo, tenha
 * ele sido disputado ou não.
 *
 * Os que já aconteceram acumulam pontos; os que faltam entram com adversário e
 * mando, sem placar. É o que permite ao eixo mostrar a campanha inteira e
 * deixar claro o que ainda vem pela frente.
 */
function campanhaCompleta(jogos, clube) {
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
const disputados = (campanha) => campanha.filter((p) => p.realizado);

export function montarCartao(estado) {
  const { serie, a, b, clubes } = estado;
  if (!a?.clube || !b?.clube || !a.jogos || !b.jogos) return null;
  if (a.clube === b.clube && a.edicao.ano === b.edicao.ano) return null;

  const agendaA = campanhaCompleta(a.jogos, a.clube);
  const agendaB = campanhaCompleta(b.jogos, b.clube);
  const campanhaA = disputados(agendaA);
  const campanhaB = disputados(agendaB);
  if (!campanhaA.length && !campanhaB.length) return null;

  const anosIguais = a.edicao.ano === b.edicao.ano;
  const rotuloA = anosIguais ? nomeBonito(a.clube)
                             : `${nomeBonito(a.clube)} ${a.edicao.ano}`;
  const rotuloB = anosIguais ? nomeBonito(b.clube)
                             : `${nomeBonito(b.clube)} ${b.edicao.ano}`;

  const spec = {
    titulo: tituloDoCard({ serie, a, b, anosIguais }),
    subtitulo: "Jogos em ordem cronológica · cada linha termina no último "
             + "jogo disputado · os jogos que faltam aparecem esmaecidos",
    arquivo: `evolucao-${nomeCurto(a.clube)}-${a.edicao.ano}`
           + `-${nomeCurto(b.clube)}-${b.edicao.ano}`,
    numeros: [],   // sem faixa de números: o gráfico fica com a altura toda
    nota: "",
    corpo: async (ctx, y) => {
      const x0 = MARGEM + CALHA;
      // O plot termina antes da calha da direita: é o que garante que o rótulo
      // de pontuação nunca passe por cima das linhas.
      const x1 = CARD.largura - MARGEM - CALHA_DIR;
      const largura = (x1 - x0) / JOGOS;
      const centro = (n) => x0 + (n - 0.5) * largura;

      const topo = y + 42, alturaPlot = 424;
      const maximo = Math.max(campanhaA.at(-1)?.pts ?? 0,
                              campanhaB.at(-1)?.pts ?? 0, 1);
      const escala = (pts) => topo + alturaPlot - (pts / maximo) * alturaPlot;
      const yEixo = topo + alturaPlot + 24;
      const yFaixaA = yEixo + 16;
      const yFaixaB = yFaixaA + 80;

      await legenda(ctx, MARGEM, y, clubes,
                    [[a.clube, rotuloA, COR.azul], [b.clube, rotuloB, COR.vermelho]]);
      desenharLinhas(ctx, { campanhaA, campanhaB, centro, topo, alturaPlot,
                            x0, x1, rotuloA, rotuloB });

      for (let n = 1; n <= JOGOS; n++) {
        if (n !== 1 && n !== JOGOS && n % 2 === 0) continue;
        texto(ctx, n, centro(n), yEixo,
              { tamanho: 11, cor: COR.cinzaEscuro, alinha: "center" });
      }

      await faixaDeJogos(ctx, { agenda: agendaA, clube: a.clube,
        rotulo: rotuloA, cor: COR.azul, clubes, centro, largura,
        x: MARGEM, y: yFaixaA });
      await faixaDeJogos(ctx, { agenda: agendaB, clube: b.clube,
        rotulo: rotuloB, cor: COR.vermelho, clubes, centro, largura,
        x: MARGEM, y: yFaixaB });

      // A geometria só existe na hora de desenhar; guardá-la no spec é o que
      // permite à página mapear o mouse de volta para um jogo. Fica fora do
      // PNG de propósito — é recurso de tela, não de card.
      spec.hover = geometriaDoHover({ agendaA, agendaB, rotuloA, rotuloB,
        centro, escala, topo, alturaPlot, x0, x1, largura });
    },
  };
  return spec;
}

/** Onde o mouse pode parar, e o que mostrar em cada parada. */
function geometriaDoHover(o) {
  const { agendaA, agendaB, rotuloA, rotuloB, centro, escala,
          topo, alturaPlot, x0, x1, largura } = o;
  const total = Math.max(agendaA.length, agendaB.length);

  const descrever = (agenda, i) => {
    const passo = agenda[i];
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
  };

  const pontos = [];
  for (let i = 0; i < total; i++) {
    const itens = [
      { rotulo: rotuloA, cor: COR.azul, ...(descrever(agendaA, i) ?? {}) },
      { rotulo: rotuloB, cor: COR.vermelho, ...(descrever(agendaB, i) ?? {}) },
    ].filter((it) => it.detalhe);

    // A diferença só existe quando as duas já jogaram aquele jogo.
    let diferenca = null;
    if (itens.length === 2 && itens.every((it) => it.realizado)) {
      const d = itens[0].pontos - itens[1].pontos;
      diferenca = d === 0
        ? { valor: 0, texto: "empatadas" }
        : { valor: Math.abs(d),
            texto: `${d > 0 ? rotuloA : rotuloB} à frente`,
            cor: d > 0 ? COR.azul : COR.vermelho };
    }
    pontos.push({ n: i + 1, x: centro(i + 1), itens, diferenca });
  }
  return { pontos, topo, alturaPlot, x0, x1, largura, unidade: "jogo" };
}

const dataBr = (iso) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

/**
 * O título diz a frase inteira, em português corrido. Três formas, conforme o
 * que muda entre as duas campanhas — o clube, o ano, ou os dois.
 */
function tituloDoCard({ serie, a, b, anosIguais }) {
  const nomeA = nomeBonito(a.clube), nomeB = nomeBonito(b.clube);
  const mesmoClube = a.clube === b.clube;

  if (mesmoClube) {
    return `Evolução da pontuação ${artigo(a.clube)} ${nomeA} na Série ${serie}`
         + ` em ${a.edicao.ano} e ${b.edicao.ano}`;
  }
  if (anosIguais) {
    return `Evolução da pontuação de ${nomeA} e ${nomeB}`
         + ` na Série ${serie} ${a.edicao.ano}`;
  }
  return `Evolução da pontuação ${artigo(a.clube)} ${nomeA} (${a.edicao.ano})`
       + ` e ${nomeB} (${b.edicao.ano}) na Série ${serie}`;
}

/* --------------------------------------------------------------- linhas */
function desenharLinhas(ctx, o) {
  const { campanhaA, campanhaB, centro, topo, alturaPlot, x0, x1,
          rotuloA, rotuloB } = o;
  const fimA = campanhaA.at(-1), fimB = campanhaB.at(-1);
  const maximo = Math.max(fimA?.pts ?? 0, fimB?.pts ?? 0, 1);
  const escala = (pts) => topo + alturaPlot - (pts / maximo) * alturaPlot;

  const passo = Math.max(5, Math.ceil(maximo / 5 / 5) * 5);
  for (let v = 0; v <= maximo; v += passo) {
    linhaH(ctx, x0 - 10, x1, escala(v), COR.cinzaClaro);
    texto(ctx, v, x0 - 18, escala(v) + 5,
          { tamanho: 13, cor: COR.cinzaEscuro, alinha: "right" });
  }

  const comparacao = compararCampanhas(campanhaA, campanhaB);
  bandaEntreLinhas(ctx, comparacao, centro, escala);
  marcarMaiorDiferenca(ctx, comparacao, centro, escala);

  // Contorno claro antes da cor: onde as duas linhas andam juntas, é o que
  // mantém a de baixo visível em vez de sumir por completo sob a de cima.
  for (const [campanha, cor] of [[campanhaA, COR.azul], [campanhaB, COR.vermelho]]) {
    if (!campanha.length) continue;
    for (const [espessura, tinta] of [[9, COR.fundo], [4.5, cor]]) {
      ctx.save();
      ctx.strokeStyle = tinta;
      ctx.lineWidth = espessura;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      campanha.forEach((p, i) => {
        const ponto = [centro(p.n), escala(p.pts)];
        if (i === 0) ctx.moveTo(...ponto); else ctx.lineTo(...ponto);
      });
      ctx.stroke();
      ctx.restore();
    }
  }

  for (const [campanha, cor] of [[campanhaA, COR.azul], [campanhaB, COR.vermelho]]) {
    for (const p of campanha) {
      ctx.save();
      ctx.fillStyle = COR.fundo;
      ctx.beginPath();
      ctx.arc(centro(p.n), escala(p.pts), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cor;
      ctx.beginPath();
      ctx.arc(centro(p.n), escala(p.pts), 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  rotulosFinais(ctx, {
    series: [{ fim: fimA, cor: COR.azul, rotulo: rotuloA },
             { fim: fimB, cor: COR.vermelho, rotulo: rotuloB }].filter((v) => v.fim),
    centro, escala, x1, topo, alturaPlot,
  });

  blocosDeDiferenca(ctx, { comparacao, fimA, fimB, x: x1 + 18, topo, alturaPlot,
                           rotuloA, rotuloB });
}

/**
 * A diferença jogo a jogo, no trecho em que as duas já jogaram. Ir além disso
 * seria comparar campanha com ausência de campanha.
 */
function compararCampanhas(campanhaA, campanhaB) {
  const comum = Math.min(campanhaA.length, campanhaB.length);
  const pontos = [];
  for (let i = 0; i < comum; i++) {
    pontos.push({
      n: i + 1,
      ptsA: campanhaA[i].pts,
      ptsB: campanhaB[i].pts,
      diferenca: campanhaA[i].pts - campanhaB[i].pts,
    });
  }
  const maior = pontos.reduce(
    (melhor, p) =>
      (Math.abs(p.diferenca) > Math.abs(melhor?.diferenca ?? -1) ? p : melhor),
    null);
  return { pontos, maior, atual: pontos.at(-1) ?? null };
}

/** Faixa clara entre as duas linhas, na cor de quem está à frente. */
function bandaEntreLinhas(ctx, { pontos }, centro, escala) {
  for (let i = 0; i < pontos.length - 1; i++) {
    const p = pontos[i], q = pontos[i + 1];
    if (p.diferenca === 0 && q.diferenca === 0) continue;
    const tinta = (p.diferenca + q.diferenca) >= 0
      ? COR.azulLavado : COR.vermelhoLavado;
    ctx.save();
    ctx.fillStyle = tinta;
    ctx.beginPath();
    ctx.moveTo(centro(p.n), escala(p.ptsA));
    ctx.lineTo(centro(q.n), escala(q.ptsA));
    ctx.lineTo(centro(q.n), escala(q.ptsB));
    ctx.lineTo(centro(p.n), escala(p.ptsB));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/** Traço vertical no jogo em que a distância entre as campanhas foi maior. */
function marcarMaiorDiferenca(ctx, { maior }, centro, escala) {
  if (!maior || maior.diferenca === 0) return;
  const x = centro(maior.n);
  const yA = escala(maior.ptsA), yB = escala(maior.ptsB);

  ctx.save();
  ctx.strokeStyle = COR.cinzaEscuro;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x, yA);
  ctx.lineTo(x, yB);
  ctx.stroke();
  ctx.restore();

  const meio = (yA + yB) / 2;
  const valor = String(Math.abs(maior.diferenca));
  ctx.save();
  ctx.font = '800 15px "Assistant", sans-serif';
  const l = ctx.measureText(valor).width + 18;
  ctx.restore();
  caixa(ctx, x - l / 2, meio - 12, l, 24, COR.cinzaEscuro, 5);
  texto(ctx, valor, x, meio + 5,
        { tamanho: 15, peso: 800, cor: COR.branco, alinha: "center" });
}

/**
 * Pontuação final na calha da direita, fora do plot — nunca por cima das
 * linhas. Um traço pontilhado liga cada rótulo ao fim da sua linha.
 */
function rotulosFinais(ctx, o) {
  const { series, centro, escala, x1, topo, alturaPlot } = o;
  const altura = 58, larguraSelo = 182;

  const ordenadas = series
    .map((s) => ({ ...s, alvo: escala(s.fim.pts) }))
    .sort((p, q) => p.alvo - q.alvo);

  // Empurra para baixo o de trás quando os dois terminam perto, e depois puxa
  // a pilha para cima se ela tiver passado do fim do plot.
  let ultimo = -Infinity;
  for (const s of ordenadas) {
    s.y = Math.max(s.alvo, ultimo + altura + 10);
    ultimo = s.y;
  }
  const excesso = ultimo + altura / 2 - (topo + alturaPlot);
  if (excesso > 0) for (const s of ordenadas) s.y -= excesso;

  for (const s of ordenadas) {
    ctx.save();
    ctx.strokeStyle = s.cor;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(centro(s.fim.n), s.alvo);
    ctx.lineTo(x1 + 14, s.y);
    ctx.stroke();
    ctx.restore();

    caixa(ctx, x1 + 14, s.y - altura / 2, larguraSelo, altura, s.cor, 9);
    texto(ctx, s.fim.pts, x1 + 28, s.y + 5, { tamanho: 34, peso: 800, cor: COR.branco });

    ctx.save();
    ctx.font = '800 34px "Assistant", sans-serif';
    const larguraNumero = ctx.measureText(String(s.fim.pts)).width;
    ctx.restore();

    const xTexto = x1 + 38 + larguraNumero;
    texto(ctx, cortar(ctx, s.rotulo, larguraSelo - larguraNumero - 46, 12.5, 700),
          xTexto, s.y - 3, { tamanho: 12.5, peso: 700, cor: COR.branco });
    texto(ctx, "pontos", xTexto, s.y + 13,
          { tamanho: 10, peso: 700, cor: COR.azulClaro, maiuscula: true, espaco: .8 });
  }
}

/** Diferença atual e maior diferença, na parte de baixo da calha direita. */
function blocosDeDiferenca(ctx, o) {
  const { comparacao, fimA, fimB, x, topo, alturaPlot, rotuloA, rotuloB } = o;
  const { maior } = comparacao;
  if (!fimA || !fimB) return;

  // "Agora" é entre os totais de hoje, e não no último jogo em comum. Quando
  // uma jogou a mais, as duas leituras divergem — e o card mostra os totais
  // nos selos, então dizer outra coisa aqui se contradiz na mesma imagem.
  const atual = { diferenca: fimA.pts - fimB.pts };

  const largura = 182, altura = 66;
  const base = topo + alturaPlot - altura * 2 - 10;

  const descrever = (p, sufixo) => {
    if (!p || p.diferenca === 0) return ["0", `campanhas empatadas${sufixo}`];
    const quem = p.diferenca > 0 ? rotuloA : rotuloB;
    return [String(Math.abs(p.diferenca)), `${quem} à frente${sufixo}`];
  };

  // A maior diferença é medida no mesmo número de jogos das duas — senão
  // "estar na frente" viraria só "ter jogado mais".
  const blocos = [
    ["diferença agora", ...descrever(atual, ""), COR.azulEscuro],
    ["maior diferença", ...descrever(maior, maior ? ` · jogo ${maior.n}` : ""),
     COR.cinzaEscuro],
  ];

  blocos.forEach(([titulo, valor, detalhe, cor], i) => {
    const y = base + i * (altura + 10);
    caixa(ctx, x, y, largura, altura, COR.branco, 8);
    ctx.save();
    ctx.strokeStyle = COR.linha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + .5, y + .5, largura - 1, altura - 1, 8);
    ctx.stroke();
    ctx.restore();

    texto(ctx, titulo, x + 14, y + 18,
          { tamanho: 10.5, peso: 700, maiuscula: true, espaco: .9,
            cor: COR.cinzaEscuro });
    texto(ctx, valor, x + 14, y + 48, { tamanho: 26, peso: 800, cor });

    ctx.save();
    ctx.font = '800 26px "Assistant", sans-serif';
    const largo = ctx.measureText(valor).width;
    ctx.restore();
    texto(ctx, cortar(ctx, detalhe, largura - largo - 34, 11, 400),
          x + 24 + largo, y + 46, { tamanho: 11, cor: COR.cinzaEscuro });
  });
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

    // Jogo que ainda vem entra esmaecido: está na agenda, não no retrospecto.
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

const corDoResultado = (resultado) => resultado === "T" ? COR.azul
  : resultado === "E" ? COR.cinzaEscuro : COR.vermelho;
