/**
 * Card: comparativo de duas campanhas.
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
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar,
} from "/js/cartao.js";
import { nomeBonito, nomeCurto, artigo } from "/js/nomes.js";
import {
  CALHA, CALHA_DIR, JOGOS, campanhaCompleta, disputados, descreverJogo,
  faixaDeJogos, legenda, tracarLinha,
} from "/js/grafico_campanha.js";

export function montarCartao(estado) {
  const { serie, a, b, clubes } = estado;
  if (!a?.clube || !b?.clube || !a.jogos || !b.jogos) return null;
  if (a.clube === b.clube && a.edicao.ano === b.edicao.ano) return null;

  const agendaA = campanhaCompleta(a.jogos, a.clube);
  const agendaB = campanhaCompleta(b.jogos, b.clube);
  const campanhaA = disputados(agendaA);
  const campanhaB = disputados(agendaB);
  if (!campanhaA.length && !campanhaB.length) return null;

  // Uma campanha está encerrada quando não sobrou jogo na agenda dela. Se uma
  // já acabou e a outra ainda corre, comparar os totais seria comparar 38 jogos
  // com 20: o ponto de comparação passa a ser o número de jogos da que está em
  // curso. O que a encerrada fez dali em diante não some — vira linha
  // pontilhada e uma conta à parte no selo.
  const encerradaA = campanhaA.length === agendaA.length;
  const encerradaB = campanhaB.length === agendaB.length;
  const emCurso = encerradaA ? campanhaB.length : campanhaA.length;
  const corte = encerradaA !== encerradaB && emCurso > 0 ? emCurso : null;

  const anosIguais = a.edicao.ano === b.edicao.ano;
  const rotuloA = anosIguais ? nomeBonito(a.clube)
                             : `${nomeBonito(a.clube)} ${a.edicao.ano}`;
  const rotuloB = anosIguais ? nomeBonito(b.clube)
                             : `${nomeBonito(b.clube)} ${b.edicao.ano}`;

  const spec = {
    titulo: tituloDoCard({ serie, a, b, anosIguais }),
    subtitulo: "Jogos em ordem cronológica",
    arquivo: `comparativo-${nomeCurto(a.clube)}-${a.edicao.ano}`
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

      await legenda(ctx, MARGEM, y, clubes, [
        { clube: a.clube, rotulo: rotuloA, cor: COR.azul },
        { clube: b.clube, rotulo: rotuloB, cor: COR.vermelho },
      ]);
      desenharLinhas(ctx, { campanhaA, campanhaB, centro, topo, alturaPlot,
                            x0, x1, rotuloA, rotuloB,
                            encerradaA, encerradaB, corte });

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

  const descrever = (agenda, i) => descreverJogo(agenda[i]);

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
            cor: d > 0 ? COR.positivo : COR.negativo };
    }
    pontos.push({ n: i + 1, x: centro(i + 1), itens, diferenca });
  }
  return { pontos, topo, alturaPlot, x0, x1, largura, unidade: "jogo" };
}

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
          rotuloA, rotuloB, encerradaA, encerradaB, corte } = o;
  const maximo = Math.max(campanhaA.at(-1)?.pts ?? 0, campanhaB.at(-1)?.pts ?? 0, 1);
  const escala = (pts) => topo + alturaPlot - (pts / maximo) * alturaPlot;

  const passo = Math.max(5, Math.ceil(maximo / 5 / 5) * 5);
  for (let v = 0; v <= maximo; v += passo) {
    linhaH(ctx, x0 - 10, x1, escala(v), COR.cinzaClaro);
    texto(ctx, v, x0 - 18, escala(v) + 5,
          { tamanho: 13, cor: COR.cinzaEscuro, alinha: "right" });
  }

  // Cada linha com dois dados a mais: onde o selo pousa e o que veio depois
  // dele. Entre campanhas em pé de igualdade o selo pousa no fim da linha;
  // quando uma já acabou e a outra não, ele pousa no jogo do corte.
  const series = [
    { campanha: campanhaA, cor: COR.azul, rotulo: rotuloA, encerrada: encerradaA },
    { campanha: campanhaB, cor: COR.vermelho, rotulo: rotuloB, encerrada: encerradaB },
  ].filter((s) => s.campanha.length).map((s) => {
    const cortada = Boolean(corte) && s.encerrada && corte < s.campanha.length;
    return {
      ...s,
      corte: cortada ? corte : null,
      fim: cortada ? s.campanha[corte - 1] : s.campanha.at(-1),
      resto: cortada
        ? { pontos: s.campanha.at(-1).pts - s.campanha[corte - 1].pts,
            jogos: s.campanha.length - corte }
        : null,
    };
  });

  const comparacao = compararCampanhas(campanhaA, campanhaB);
  bandaEntreLinhas(ctx, comparacao, centro, escala);

  const xy = (ponto) => [centro(ponto.n), escala(ponto.pts)];
  for (const s of series) {
    const ate = s.corte ?? s.campanha.length;
    tracarLinha(ctx, s.campanha.slice(0, ate).map(xy), s.cor);
    // O trecho além do corte é a mesma linha, pontilhada: continua sendo a
    // campanha dela, só deixou de ser comparação.
    if (s.corte) {
      tracarLinha(ctx, s.campanha.slice(ate - 1).map(xy), s.cor, { pontilhada: true });
    }
  }

  marcarMaiorDiferenca(ctx, comparacao, centro, escala, { topo, alturaPlot, x0, x1 });

  for (const s of series) {
    for (const ponto of s.campanha) {
      ctx.save();
      if (s.corte && ponto.n > s.corte) ctx.globalAlpha = 0.5;
      ctx.fillStyle = COR.fundo;
      ctx.beginPath();
      ctx.arc(centro(ponto.n), escala(ponto.pts), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.cor;
      ctx.beginPath();
      ctx.arc(centro(ponto.n), escala(ponto.pts), 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  const alturaBloco = 76;
  rotulosFinais(ctx, { series, centro, escala, x1, topo,
                       limiteBase: topo + alturaPlot - alturaBloco - 14 });
  blocoDeDiferenca(ctx, { series, x: x1 + 18, corte,
                          y: topo + alturaPlot - alturaBloco, altura: alturaBloco });
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

/**
 * O jogo em que a distância entre as campanhas foi maior: traço vertical entre
 * as duas linhas e uma tag abaixo da mais baixa.
 *
 * A tag fica fora do intervalo entre as linhas de propósito. No meio ela cai
 * em cima da faixa, disputa espaço com os pontos e, quando as campanhas andam
 * perto, não cabe.
 */
function marcarMaiorDiferenca(ctx, { maior }, centro, escala, plot) {
  if (!maior || maior.diferenca === 0) return;
  const x = centro(maior.n);
  const yA = escala(maior.ptsA), yB = escala(maior.ptsB);
  const embaixo = Math.max(yA, yB), emCima = Math.min(yA, yB);

  ctx.save();
  ctx.strokeStyle = COR.cinzaEscuro;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x, yA);
  ctx.lineTo(x, yB);
  ctx.stroke();
  ctx.restore();

  const valor = Math.abs(maior.diferenca);
  const frase = `${valor} ${valor === 1 ? "ponto" : "pontos"} · jogo ${maior.n}`;
  const titulo = "maior distância";

  ctx.save();
  ctx.font = '800 13px "Assistant", sans-serif';
  const l1 = ctx.measureText(frase).width;
  ctx.font = '700 9px "Assistant", sans-serif';
  const l2 = ctx.measureText(titulo.toUpperCase()).width + titulo.length * 0.8;
  ctx.restore();

  const largura = Math.max(l1, l2) + 24, altura = 38, folga = 16;
  const cx = Math.min(Math.max(x, plot.x0 + largura / 2), plot.x1 - largura / 2);
  // Abaixo da linha mais baixa, a não ser que não caiba — aí sobe.
  let y = embaixo + folga;
  let ancora = embaixo;
  if (y + altura > plot.topo + plot.alturaPlot) {
    y = emCima - altura - folga;
    ancora = emCima;
  }

  ctx.save();
  ctx.strokeStyle = COR.cinza;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, ancora);
  ctx.lineTo(x, y < ancora ? y + altura : y);
  ctx.stroke();
  ctx.restore();

  caixa(ctx, cx - largura / 2, y, largura, altura, COR.cinzaEscuro, 7);
  texto(ctx, titulo, cx, y + 15,
        { tamanho: 9, peso: 700, cor: COR.branco, alinha: "center",
          maiuscula: true, espaco: .8 });
  texto(ctx, frase, cx, y + 31,
        { tamanho: 13, peso: 800, cor: COR.branco, alinha: "center" });
}

/**
 * Pontuação na calha da direita, fora do plot — nunca por cima das linhas.
 *
 * Um selo acima da linha de cima e outro abaixo da de baixo. Quando os dois
 * ficavam na altura da própria linha, o traço que ligava o selo saía quase na
 * horizontal e se lia como continuação da campanha; subindo um e descendo o
 * outro, o traço passa a ser visivelmente uma chamada — e é cinza claro, para
 * não competir com a linha que ele aponta.
 */
function rotulosFinais(ctx, o) {
  const { series, centro, escala, x1, topo, limiteBase } = o;
  const larguraSelo = 182, alturaBase = 58, alturaResto = 26, folga = 18;
  const alturaDe = (s) => alturaBase + (s.resto ? alturaResto : 0);

  const ordenadas = series
    .map((s) => ({ ...s, alvo: escala(s.fim.pts) }))
    .sort((p, q) => p.alvo - q.alvo);

  ordenadas.forEach((s, i) => {
    s.y = i === 0 ? s.alvo - alturaDe(s) / 2 - folga
                  : s.alvo + alturaDe(s) / 2 + folga;
  });

  const dentro = (s) => Math.min(Math.max(s.y, topo + alturaDe(s) / 2 + 2),
                                 limiteBase - alturaDe(s) / 2);
  for (const s of ordenadas) s.y = dentro(s);

  if (ordenadas.length === 2) {
    const [p, q] = ordenadas;
    const minimo = (alturaDe(p) + alturaDe(q)) / 2 + 12;
    if (q.y - p.y < minimo) {
      q.y = Math.min(p.y + minimo, limiteBase - alturaDe(q) / 2);
      p.y = Math.max(q.y - minimo, topo + alturaDe(p) / 2 + 2);
    }
  }

  for (const s of ordenadas) {
    ctx.save();
    ctx.strokeStyle = COR.cinza;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.moveTo(centro(s.fim.n), s.alvo);
    ctx.lineTo(x1 + 14, s.y);
    ctx.stroke();
    ctx.restore();

    const alto = alturaDe(s), topoSelo = s.y - alto / 2;
    caixa(ctx, x1 + 14, topoSelo, larguraSelo, alto, s.cor, 9);
    texto(ctx, s.fim.pts, x1 + 28, topoSelo + 41,
          { tamanho: 34, peso: 800, cor: COR.branco });

    ctx.save();
    ctx.font = '800 34px "Assistant", sans-serif';
    const larguraNumero = ctx.measureText(String(s.fim.pts)).width;
    ctx.restore();

    const xTexto = x1 + 38 + larguraNumero;
    const cabe = larguraSelo - larguraNumero - 46;
    texto(ctx, cortar(ctx, s.rotulo, cabe, 12.5, 700), xTexto, topoSelo + 26,
          { tamanho: 12.5, peso: 700, cor: COR.branco });
    // Dizer em quantos jogos é o que permite pôr lado a lado uma campanha
    // encerrada e uma em curso sem que o número maior engane.
    texto(ctx, cortar(ctx, `pts em ${s.fim.n} jogos`, cabe, 10, 700),
          xTexto, topoSelo + 42,
          { tamanho: 10, peso: 700, cor: COR.branco, maiuscula: true, espaco: .8 });

    if (!s.resto) continue;
    const yFita = topoSelo + alturaBase - 2;
    caixa(ctx, x1 + 20, yFita, larguraSelo - 12, alturaResto - 6, COR.fundo, 6);
    const jogos = `${s.resto.jogos} ${s.resto.jogos === 1 ? "jogo" : "jogos"}`;
    texto(ctx, cortar(ctx, `depois: +${s.resto.pontos} em ${jogos}`,
                      larguraSelo - 28, 11, 700),
          x1 + 28, yFita + 14, { tamanho: 11, peso: 700, cor: s.cor });
  }
}

/**
 * A diferença entre as duas campanhas, na base da calha direita.
 *
 * Medida nos mesmos pontos que os selos mostram — senão o card se contradiria
 * na própria imagem, dizendo 57 a 57 em cima e 1 de diferença embaixo.
 */
function blocoDeDiferenca(ctx, o) {
  const { series, x, y, altura, corte } = o;
  if (series.length < 2) return;
  const [primeira, segunda] = series;
  const d = primeira.fim.pts - segunda.fim.pts;

  const largura = 182;
  const titulo = corte ? `diferença em ${corte} jogos` : "diferença agora";
  const valor = String(Math.abs(d));
  const detalhe = d === 0 ? "campanhas empatadas"
                          : `${(d > 0 ? primeira : segunda).rotulo} à frente`;
  const cor = d === 0 ? COR.cinzaEscuro : (d > 0 ? primeira.cor : segunda.cor);

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
  texto(ctx, valor, x + 14, y + 50, { tamanho: 26, peso: 800, cor });
  texto(ctx, cortar(ctx, detalhe, largura - 28, 11.5, 400), x + 14, y + 68,
        { tamanho: 11.5, cor: COR.cinzaEscuro });
}
