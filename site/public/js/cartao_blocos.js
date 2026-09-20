/**
 * Card: a campanha repartida em blocos de 6 jogos, contra uma meta.
 *
 * O bloco é a unidade que cabe na conversa de quem acompanha o campeonato.
 * "Precisamos de 7 pontos nos próximos seis jogos" é uma frase que se cobra
 * depois; "precisamos de 1,16 ponto por jogo" não é. O card mostra os sete
 * blocos, o que cada um rendeu contra o que devia render, e o saldo que isso
 * vai acumulando.
 *
 * Os jogos são os da ordem do calendário, como nos outros cards: o bloco 4 é
 * o quarto conjunto de seis jogos que a equipe fez, e não as rodadas 19 a 24.
 * Um jogo adiado pertence ao bloco em que foi disputado, que é quando ele
 * valeu pontos.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito, nomeCurto, artigo, artigoDefinido } from "/js/nomes.js";
import { campanhaCompleta } from "/js/grafico_campanha.js";
import {
  BLOCOS, dividirEmBlocos, metasDaPosicao, pontosDoResultado, resumoDosBlocos,
} from "/js/metas.js";

const num = (v) => v.toFixed(1).replace(".", ",");
const comSinal = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : "0");
const ordinal = (posicao) => `${posicao}º`;

/** Azul acima da meta, cinza na meta, vermelho abaixo — como o resto do BI. */
const corDoSaldo = (saldo) =>
  saldo === null ? COR.cinzaEscuro
  : saldo > 0 ? COR.azul : saldo < 0 ? COR.vermelho : COR.cinzaEscuro;

export function montarCartao(estado) {
  const { serie, edicao, jogos, clube, clubes, referencia, posicao } = estado;
  if (!clube || !jogos || !referencia) return null;

  const media = referencia.media[String(posicao)];
  if (media === undefined) return null;

  const agenda = campanhaCompleta(jogos, clube);
  if (!agenda.length) return null;

  const metas = metasDaPosicao(media);
  const blocos = dividirEmBlocos(agenda, metas);
  const resumo = resumoDosBlocos(blocos);

  const spec = {
    titulo: `Blocos de 6 jogos ${artigo(clube)} ${nomeBonito(clube)}`
          + ` na Série ${serie} ${edicao.ano}`,
    subtitulo: `Meta do ${ordinal(posicao)} lugar: ${metas.bloco} pontos por `
             + `bloco e ${metas.extra} no extra — ${metas.total} no total`,
    arquivo: `blocos-${nomeCurto(clube)}-${edicao.ano}-${posicao}`,
    numeros: [],
    nota: `A meta sai da média de quem terminou em ${ordinal(posicao)} nas `
        + `${referencia.edicoes} edições encerradas da Série ${serie} `
        + `(${referencia.ano_primeiro}–${referencia.ano_ultimo}): `
        + `${num(media)} pontos, repartidos em 6 blocos de 6 jogos mais os 2 últimos.`,
    corpo: async (ctx, y) => {
      const yPaineis = y + 14;
      await faixaDeBlocos(ctx, { blocos, clubes, y: yPaineis });

      const yBaixo = yPaineis + ALTURA_PAINEL + 40;
      linhaH(ctx, MARGEM, CARD.largura - MARGEM, yBaixo - 20, COR.linha);

      const yTabela = tabelaDeBlocos(ctx, { blocos, resumo, x: MARGEM, y: yBaixo });
      vereditoDaCampanha(ctx, {
        blocos, resumo, metas, rotulo: nomeBonito(clube), clube,
        x: MARGEM, y: yTabela + 30, largura: 500,
      });
      graficoAcumulado(ctx, {
        blocos, x: MARGEM + 560, largura: CARD.largura - MARGEM - (MARGEM + 560),
        y: yBaixo, altura: 348,
      });
    },
  };
  return spec;
}

/* ------------------------------------------------------------- painéis */
const ALTURA_PAINEL = 250;
const VAO = 12;
const ALTURA_LINHA = 24;

async function faixaDeBlocos(ctx, { blocos, clubes, y }) {
  const disponivel = CARD.largura - MARGEM * 2;
  const largura = (disponivel - VAO * (blocos.length - 1)) / blocos.length;

  for (const [i, bloco] of blocos.entries()) {
    const x = MARGEM + i * (largura + VAO);
    await painelDoBloco(ctx, { bloco, clubes, x, y, largura });
  }
}

async function painelDoBloco(ctx, { bloco, clubes, x, y, largura }) {
  const emAndamento = bloco.iniciado && !bloco.completo;

  caixa(ctx, x, y, largura, ALTURA_PAINEL,
        bloco.iniciado ? COR.branco : COR.fundo, 9);
  ctx.save();
  // O bloco em andamento ganha contorno cheio: é onde a campanha está agora.
  ctx.strokeStyle = emAndamento ? COR.azul : COR.linha;
  ctx.lineWidth = emAndamento ? 2 : 1;
  ctx.beginPath();
  ctx.roundRect(x + .5, y + .5, largura - 1, ALTURA_PAINEL - 1, 9);
  ctx.stroke();
  ctx.restore();

  texto(ctx, bloco.nome, x + 12, y + 22,
        { tamanho: 11, peso: 800, maiuscula: true, espaco: .9,
          cor: bloco.iniciado ? COR.azul : COR.cinzaEscuro });
  texto(ctx, `${bloco.de}–${bloco.ate}`, x + largura - 12, y + 22,
        { tamanho: 10, peso: 700, cor: COR.cinzaEscuro, alinha: "right" });

  const yLinhas = y + 36;
  for (const [i, passo] of bloco.jogos.entries()) {
    await linhaDeJogo(ctx, {
      passo, clubes, x, largura, y: yLinhas + i * ALTURA_LINHA,
    });
  }

  rodapeDoPainel(ctx, { bloco, x, y: y + ALTURA_PAINEL, largura });
}

async function linhaDeJogo(ctx, { passo, clubes, x, largura, y }) {
  const { jogo, realizado } = passo;
  const escudo = await imagem(clubes[jogo.adversario]?.escudo);

  ctx.save();
  if (!realizado) ctx.globalAlpha = 0.42;
  desenharEscudo(ctx, escudo, x + 10, y, 21);
  ctx.restore();

  texto(ctx, jogo.mando === "casa" ? "C" : "F", x + 38, y + 15,
        { tamanho: 9.5, peso: 800, cor: COR.cinzaEscuro });

  if (realizado) {
    texto(ctx, `${jogo.gp}×${jogo.gc}`, x + 52, y + 16,
          { tamanho: 13, peso: 800, cor: corDoResultado(jogo.resultado) });
    const ganhos = pontosDoResultado(jogo.resultado);
    texto(ctx, ganhos ? `+${ganhos}` : "0", x + largura - 12, y + 16,
          { tamanho: 12, peso: 700, alinha: "right",
            cor: ganhos ? corDoResultado(jogo.resultado) : COR.cinza });
  } else {
    linhaH(ctx, x + 52, x + 70, y + 12, COR.cinzaClaro, 2);
  }
}

const corDoResultado = (resultado) => resultado === "T" ? COR.azul
  : resultado === "E" ? COR.cinzaEscuro : COR.vermelho;

function rodapeDoPainel(ctx, { bloco, x, y, largura }) {
  const yBase = y - 58;
  linhaH(ctx, x + 12, x + largura - 12, yBase, COR.linha);

  if (!bloco.iniciado) {
    // Bloco que nem começou tem uma informação só: o que vai ser cobrado dele.
    texto(ctx, `meta ${bloco.meta}`, x + 12, yBase + 30,
          { tamanho: 15, peso: 700, cor: COR.cinzaEscuro });
    return;
  }

  texto(ctx, bloco.pontos, x + 12, yBase + 32,
        { tamanho: 28, peso: 800, cor: corDoSaldo(bloco.saldo) });
  ctx.save();
  ctx.font = '800 28px "Assistant", sans-serif';
  const largo = ctx.measureText(String(bloco.pontos)).width;
  ctx.restore();
  texto(ctx, "pts", x + 18 + largo, yBase + 32,
        { tamanho: 11, peso: 700, cor: COR.cinzaEscuro });

  texto(ctx, `meta ${bloco.meta}`, x + 12, yBase + 50,
        { tamanho: 11, peso: 700, cor: COR.cinzaEscuro });

  // A etiqueta da direita: saldo quando o bloco fechou, e o que ainda falta
  // quando não fechou. Dizer "−4" num bloco de dois jogos disputados seria
  // cobrar uma conta que ainda não venceu.
  const [rotulo, cor] = bloco.completo
    ? [comSinal(bloco.saldo), corDoSaldo(bloco.saldo)]
    : [bloco.falta > 0 ? `faltam ${bloco.falta}` : "meta batida",
       bloco.falta > 0 ? COR.cinzaEscuro : COR.azul];

  ctx.save();
  ctx.font = '800 12px "Assistant", sans-serif';
  const larguraChip = ctx.measureText(rotulo).width + 18;
  ctx.restore();
  caixa(ctx, x + largura - 12 - larguraChip, yBase + 14, larguraChip, 22, cor, 6);
  texto(ctx, rotulo, x + largura - 12 - larguraChip / 2, yBase + 29,
        { tamanho: 12, peso: 800, cor: COR.branco, alinha: "center" });

  if (!bloco.completo) {
    texto(ctx, `em ${bloco.restam} ${bloco.restam === 1 ? "jogo" : "jogos"}`,
          x + largura - 12, yBase + 50,
          { tamanho: 10.5, cor: COR.cinzaEscuro, alinha: "right" });
  }
}

/* -------------------------------------------------------------- tabela */
function tabelaDeBlocos(ctx, { blocos, resumo, x, y }) {
  const colunas = [
    { rotulo: "", x: 0, alinha: "left" },
    { rotulo: "jogos", x: 150, alinha: "right" },
    { rotulo: "pts", x: 218, alinha: "right" },
    { rotulo: "meta", x: 290, alinha: "right" },
    { rotulo: "saldo", x: 372, alinha: "right" },
    { rotulo: "acum.", x: 458, alinha: "right" },
  ];

  for (const coluna of colunas) {
    if (!coluna.rotulo) continue;
    texto(ctx, coluna.rotulo, x + coluna.x, y,
          { tamanho: 10, peso: 700, maiuscula: true, espaco: .8,
            cor: COR.cinzaEscuro, alinha: coluna.alinha });
  }
  linhaH(ctx, x, x + 458, y + 8, COR.linha);

  const alturaLinha = 25;
  blocos.forEach((bloco, i) => {
    const yLinha = y + 30 + i * alturaLinha;
    const apagado = !bloco.iniciado;
    const corTexto = apagado ? COR.cinza : COR.azulEscuro;

    texto(ctx, bloco.nome, x, yLinha,
          { tamanho: 12.5, peso: 700, cor: apagado ? COR.cinza : COR.azul });
    texto(ctx, `${bloco.disputados}/${bloco.total}`, x + 150, yLinha,
          { tamanho: 12.5, cor: apagado ? COR.cinza : COR.cinzaTexto,
            alinha: "right" });
    texto(ctx, bloco.iniciado ? bloco.pontos : "—", x + 218, yLinha,
          { tamanho: 12.5, peso: 800, cor: corTexto, alinha: "right" });
    texto(ctx, bloco.meta, x + 290, yLinha,
          { tamanho: 12.5, cor: apagado ? COR.cinza : COR.cinzaTexto,
            alinha: "right" });
    texto(ctx, bloco.completo ? comSinal(bloco.saldo) : "—", x + 372, yLinha,
          { tamanho: 12.5, peso: 800, alinha: "right",
            cor: bloco.completo ? corDoSaldo(bloco.saldo) : COR.cinza });
    texto(ctx, bloco.acumulado === null ? "—" : comSinal(bloco.acumulado),
          x + 458, yLinha,
          { tamanho: 12.5, peso: 800, alinha: "right",
            cor: bloco.acumulado === null ? COR.cinza : corDoSaldo(bloco.acumulado) });
  });

  const yTotal = y + 30 + blocos.length * alturaLinha + 6;
  linhaH(ctx, x, x + 458, yTotal - 18, COR.linha);
  texto(ctx, `${resumo.blocosFechados} blocos fechados`, x, yTotal,
        { tamanho: 11, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });
  texto(ctx, resumo.pontos, x + 218, yTotal,
        { tamanho: 13.5, peso: 800, cor: COR.azulEscuro, alinha: "right" });
  texto(ctx, resumo.meta, x + 290, yTotal,
        { tamanho: 13.5, cor: COR.cinzaTexto, alinha: "right" });
  texto(ctx, comSinal(resumo.saldo), x + 372, yTotal,
        { tamanho: 13.5, peso: 800, cor: corDoSaldo(resumo.saldo), alinha: "right" });
  return yTotal;
}

/**
 * A frase que fecha o card: onde a campanha está em relação à meta.
 *
 * A tabela ao lado tem todos os números; esta caixa tem a leitura deles. É o
 * que alguém repetiria em voz alta depois de olhar o card por dois segundos.
 */
function vereditoDaCampanha(ctx, o) {
  const { blocos, resumo, metas, rotulo, clube, x, y, largura } = o;
  const altura = 98;

  caixa(ctx, x, y, largura, altura, COR.branco, 8);
  ctx.save();
  ctx.strokeStyle = COR.linha;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + .5, y + .5, largura - 1, altura - 1, 8);
  ctx.stroke();
  ctx.restore();

  texto(ctx, "onde a campanha está", x + 16, y + 24,
        { tamanho: 10.5, peso: 700, maiuscula: true, espaco: .9,
          cor: COR.cinzaEscuro });

  const disputados = blocos.reduce((soma, b) => soma + b.disputados, 0);
  const frase = resumo.blocosFechados === 0
    ? `${artigoDefinido(clube)} ${rotulo} ainda não fechou um bloco.`
    : `Depois de ${resumo.blocosFechados} `
      + `${resumo.blocosFechados === 1 ? "bloco fechado" : "blocos fechados"},`
      + ` ${artigoDefinido(clube)} ${rotulo} está `
      + (resumo.saldo === 0 ? "exatamente na meta."
         : `${Math.abs(resumo.saldo)} ${Math.abs(resumo.saldo) === 1 ? "ponto" : "pontos"}`
           + ` ${resumo.saldo > 0 ? "acima" : "abaixo"} da meta.`);

  // A frase pode começar pelo artigo do clube, que é minúsculo.
  const comMaiuscula = frase.charAt(0).toLocaleUpperCase("pt-BR") + frase.slice(1);
  texto(ctx, cortar(ctx, comMaiuscula, largura - 32, 15.5, 700), x + 16, y + 52,
        { tamanho: 15.5, peso: 700, cor: corDoSaldo(resumo.saldo) });

  // "Faltam 11 para os 64 da meta" só faz sentido enquanto há jogo pela
  // frente. Numa edição encerrada não falta nada: ela terminou abaixo.
  const agendados = blocos.reduce((soma, b) => soma + b.total, 0);
  const sobra = resumo.pontosTotais - metas.total;
  const fecho = disputados === agendados
    ? (sobra === 0
        ? `terminou exatamente nos ${metas.total} da meta`
        : `terminou ${Math.abs(sobra)} ${sobra > 0 ? "acima" : "abaixo"}`
          + ` dos ${metas.total} da meta`)
    : (sobra < 0
        ? `faltam ${-sobra} para os ${metas.total} da meta`
        : sobra === 0
          ? `a meta total de ${metas.total} já está cumprida`
          : `já passou os ${metas.total} da meta por ${sobra}`);
  const segunda = `${resumo.pontosTotais} pontos em ${disputados} jogos · ${fecho}`;
  texto(ctx, cortar(ctx, segunda, largura - 32, 12.5, 400), x + 16, y + 76,
        { tamanho: 12.5, cor: COR.cinzaTexto });
}

/* ------------------------------------------------------------- gráfico */
function graficoAcumulado(ctx, { blocos, x, largura, y, altura }) {
  texto(ctx, "Diferença acumulada em relação à meta", x, y,
        { tamanho: 11, peso: 700, maiuscula: true, espaco: .9,
          cor: COR.cinzaEscuro });

  const topo = y + 26, alturaPlot = altura - 52;
  const passo = largura / blocos.length;
  const centro = (i) => x + (i + 0.5) * passo;

  // A escala segue o que existe, e não um intervalo simétrico. Uma campanha
  // que só ficou acima da meta desperdiçaria metade da altura com um espaço
  // negativo que nunca vai ser usado.
  const valores = blocos.flatMap((b) => [b.saldo, b.acumulado])
    .filter((v) => v !== null);
  const teto = Math.max(2, ...valores);
  const piso = Math.min(-2, ...valores);
  const escala = (v) => topo + alturaPlot * ((teto - v) / (teto - piso));
  const yZero = escala(0);

  for (const v of [teto, 0, piso]) {
    linhaH(ctx, x, x + largura, escala(v), v === 0 ? COR.cinza : COR.cinzaClaro);
    texto(ctx, comSinal(v), x - 8, escala(v) + 4,
          { tamanho: 10.5, cor: COR.cinzaEscuro, alinha: "right" });
  }

  // A barra é o saldo do bloco; a linha é o acumulado. Juntas respondem as
  // duas perguntas de uma vez: como foi aquele bloco, e como está a conta.
  const larguraBarra = passo * 0.36;
  for (const [i, bloco] of blocos.entries()) {
    if (!bloco.completo || bloco.saldo === 0) continue;
    const yTopo = Math.min(yZero, escala(bloco.saldo));
    caixa(ctx, centro(i) - larguraBarra / 2, yTopo, larguraBarra,
          Math.abs(escala(bloco.saldo) - yZero), corDoSaldo(bloco.saldo), 3);
  }

  const pontos = blocos
    .map((bloco, i) => ({ bloco, i }))
    .filter(({ bloco }) => bloco.acumulado !== null);

  if (pontos.length > 1) {
    ctx.save();
    ctx.strokeStyle = COR.azulEscuro;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    pontos.forEach(({ bloco, i }, k) => {
      const xy = [centro(i), escala(bloco.acumulado)];
      if (k === 0) ctx.moveTo(...xy); else ctx.lineTo(...xy);
    });
    ctx.stroke();
    ctx.restore();
  }

  for (const { bloco, i } of pontos) {
    ctx.save();
    ctx.fillStyle = COR.fundo;
    ctx.beginPath();
    ctx.arc(centro(i), escala(bloco.acumulado), 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COR.azulEscuro;
    ctx.beginPath();
    ctx.arc(centro(i), escala(bloco.acumulado), 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const ultimo = pontos.at(-1);
  if (ultimo) {
    const rotulo = comSinal(ultimo.bloco.acumulado);
    ctx.save();
    ctx.font = '800 15px "Assistant", sans-serif';
    const largo = ctx.measureText(rotulo).width + 20;
    ctx.restore();
    const xChip = Math.min(centro(ultimo.i) + 14, x + largura - largo);
    caixa(ctx, xChip, escala(ultimo.bloco.acumulado) - 13, largo, 26,
          corDoSaldo(ultimo.bloco.acumulado), 6);
    texto(ctx, rotulo, xChip + largo / 2, escala(ultimo.bloco.acumulado) + 5,
          { tamanho: 15, peso: 800, cor: COR.branco, alinha: "center" });
  }

  for (const [i, bloco] of blocos.entries()) {
    texto(ctx, bloco.curto, centro(i), topo + alturaPlot + 22,
          { tamanho: 11, peso: 700, alinha: "center",
            cor: bloco.completo ? COR.azulEscuro : COR.cinza });
  }
  void cortar;
  void BLOCOS;
}
