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
      const xDireita = MARGEM + 560;
      const larguraDireita = CARD.largura - MARGEM - xDireita;
      barrasPorBloco(ctx, {
        blocos, metas, x: xDireita, largura: larguraDireita,
        y: yBaixo, altura: 128,
      });
      termometro(ctx, {
        resumo, metas, x: xDireita, largura: larguraDireita, y: yBaixo + 208,
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
  desenharEscudo(ctx, escudo, x + 8, y, 20);
  ctx.restore();

  // Casa e fora por extenso, cada um na sua cor, como na faixa de jogos dos
  // outros cards. Inicial economiza espaço e cobra uma tradução de quem lê.
  const emCasa = jogo.mando === "casa";
  const rotulo = emCasa ? "casa" : "fora";
  caixa(ctx, x + 32, y + 3, 32, 15,
        realizado ? (emCasa ? COR.azulLavado : COR.cinzaClaro) : COR.fundo, 4);
  if (!realizado) {
    ctx.save();
    ctx.strokeStyle = COR.linha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + 32.5, y + 3.5, 31, 14, 4);
    ctx.stroke();
    ctx.restore();
  }
  texto(ctx, rotulo, x + 48, y + 14,
        { tamanho: 9, peso: 800, alinha: "center", maiuscula: true, espaco: .4,
          cor: emCasa && realizado ? COR.azul : COR.cinzaEscuro });

  if (realizado) {
    texto(ctx, `${jogo.gp}×${jogo.gc}`, x + 70, y + 16,
          { tamanho: 13, peso: 800, cor: corDoResultado(jogo.resultado) });
    const ganhos = pontosDoResultado(jogo.resultado);
    texto(ctx, ganhos ? `+${ganhos}` : "0", x + largura - 12, y + 16,
          { tamanho: 12, peso: 700, alinha: "right",
            cor: ganhos ? corDoResultado(jogo.resultado) : COR.cinza });
  } else {
    linhaH(ctx, x + 70, x + 88, y + 12, COR.cinzaClaro, 2);
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

  // À direita da meta, a conta que interessa ao longo da campanha: onde o
  // saldo acumulado chegou depois deste bloco. Num bloco ainda aberto ela não
  // existe, e o lugar mostra o que resta dele.
  if (bloco.completo) {
    texto(ctx, "acum.", x + largura - 12, yBase + 50,
          { tamanho: 10.5, cor: COR.cinzaEscuro, alinha: "right" });
    ctx.save();
    ctx.font = '400 10.5px "Assistant", sans-serif';
    const largoRotulo = ctx.measureText("acum.").width;
    ctx.restore();
    texto(ctx, comSinal(bloco.acumulado), x + largura - 16 - largoRotulo, yBase + 50,
          { tamanho: 12, peso: 800, alinha: "right",
            cor: corDoSaldo(bloco.acumulado) });
  } else {
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

/* ------------------------------------------------- pontos por bloco */
/**
 * Barras do que cada bloco rendeu, com a meta pontilhada por cima.
 *
 * Deliberadamente pequeno: aqui a pergunta é "como foi cada bloco", e ela se
 * responde de relance. A pergunta que o card existe para responder — como está
 * a conta contra a meta — é a de baixo, e é ela que fica grande.
 *
 * A meta é desenhada em degrau, um traço por bloco, porque o bloco extra tem
 * meta própria. Uma linha reta atravessando os sete diria que o extra também
 * precisa de 7 pontos em 2 jogos.
 */
function barrasPorBloco(ctx, { blocos, metas, x, largura, y, altura }) {
  texto(ctx, "pontos por bloco", x, y,
        { tamanho: 10.5, peso: 700, maiuscula: true, espaco: .9,
          cor: COR.cinzaEscuro });

  const topo = y + 18;
  const maximo = Math.max(6, ...blocos.map((b) => Math.max(b.pontos, b.meta))) + 3;
  const escala = (v) => topo + altura * (1 - v / maximo);
  const passo = largura / blocos.length;
  const centro = (i) => x + (i + 0.5) * passo;
  const larguraBarra = Math.min(44, passo * 0.5);
  const base = escala(0);

  linhaH(ctx, x, x + largura, base, COR.cinza);

  ctx.save();
  ctx.strokeStyle = COR.cinzaEscuro;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  blocos.forEach((bloco, i) => {
    const yMeta = escala(bloco.meta);
    ctx.moveTo(centro(i) - passo / 2 + 3, yMeta);
    ctx.lineTo(centro(i) + passo / 2 - 3, yMeta);
  });
  ctx.stroke();
  ctx.restore();
  texto(ctx, `meta ${metas.bloco}`, x + 2, escala(metas.bloco) - 7,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .7,
          cor: COR.cinzaEscuro });

  for (const [i, bloco] of blocos.entries()) {
    if (bloco.iniciado) {
      const topoBarra = escala(bloco.pontos);
      // Bloco aberto em azul claro: ainda não é um resultado, é um parcial.
      const cor = bloco.completo ? corDoSaldo(bloco.saldo) : COR.azulClaro;
      caixa(ctx, centro(i) - larguraBarra / 2, Math.min(topoBarra, base - 2),
            larguraBarra, Math.max(2, base - topoBarra), cor, 4);
      texto(ctx, bloco.pontos, centro(i), topoBarra - 8,
            { tamanho: 13, peso: 800, alinha: "center",
              cor: bloco.completo ? corDoSaldo(bloco.saldo) : COR.azul });
    }
    texto(ctx, bloco.curto, centro(i), base + 18,
          { tamanho: 11, peso: 700, alinha: "center",
            cor: bloco.iniciado ? COR.azulEscuro : COR.cinza });
  }
}

/* ---------------------------------------------------------- termômetro */
/**
 * O destaque do rodapé: quantos pontos a campanha está acima ou abaixo da meta.
 *
 * Termômetro e não gráfico. Um gráfico responde "como chegamos aqui"; a
 * pergunta que se faz olhando um card de meta é "estamos bem ou mal, e por
 * quanto". Zero no meio, azul crescendo para a direita, vermelho para a
 * esquerda: dá para ler sem passar pelos números.
 *
 * A escala é simétrica de propósito, ao contrário da do gráfico de linha. Num
 * medidor, a simetria é a informação — o mesmo desvio pesa igual dos dois
 * lados.
 */
function termometro(ctx, { resumo, metas, x, largura, y }) {
  const { saldo, blocosFechados } = resumo;
  const altura = 56;

  texto(ctx, "diferença acumulada em relação à meta", x, y,
        { tamanho: 10.5, peso: 700, maiuscula: true, espaco: .9,
          cor: COR.cinzaEscuro });
  texto(ctx, blocosFechados === 0 ? "nenhum bloco fechado"
             : `${blocosFechados} ${blocosFechados === 1 ? "bloco fechado" : "blocos fechados"}`
               + ` · ${resumo.pontos} pontos contra ${resumo.meta} de meta`,
        x + largura, y,
        { tamanho: 11, cor: COR.cinzaEscuro, alinha: "right" });

  const yTrilho = y + 18;
  const meio = x + largura / 2;
  const meia = largura / 2 - 8;
  // A escala cresce em múltiplos de 3 — um triunfo de folga por degrau.
  const limite = Math.max(6, Math.ceil(Math.abs(saldo) * 1.25 / 3) * 3);
  const posicao = (v) => meio + (v / limite) * meia;

  caixa(ctx, x, yTrilho, largura, altura, COR.cinzaClaro, altura / 2);

  const xValor = posicao(saldo);
  const de = Math.min(meio, xValor), ate = Math.max(meio, xValor);
  const cor = corDoSaldo(saldo);
  if (ate - de > 1) {
    caixa(ctx, de, yTrilho, ate - de, altura, cor, Math.min(altura / 2, (ate - de) / 2));
  }

  // O zero é a referência do medidor: fica marcado mesmo sob o preenchimento.
  ctx.save();
  ctx.strokeStyle = ate - de > 1 ? COR.branco : COR.cinzaEscuro;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(meio, yTrilho + 8);
  ctx.lineTo(meio, yTrilho + altura - 8);
  ctx.stroke();
  ctx.restore();

  const rotulo = comSinal(saldo);
  ctx.save();
  ctx.font = '800 34px "Assistant", sans-serif';
  const largoNumero = ctx.measureText(rotulo).width;
  ctx.restore();

  // Dentro do preenchimento quando cabe; do lado de fora quando o desvio é
  // pequeno demais para a barra segurar o número.
  const cabeDentro = ate - de > largoNumero + 34;
  const yTexto = yTrilho + altura / 2 + 12;
  if (saldo === 0) {
    texto(ctx, "na meta", meio + 20, yTexto - 1,
          { tamanho: 20, peso: 800, cor: COR.cinzaEscuro });
  } else if (cabeDentro) {
    texto(ctx, rotulo, saldo > 0 ? ate - 18 : de + 18, yTexto,
          { tamanho: 34, peso: 800, cor: COR.branco,
            alinha: saldo > 0 ? "right" : "left" });
  } else {
    texto(ctx, rotulo, saldo > 0 ? ate + 16 : de - 16, yTexto,
          { tamanho: 34, peso: 800, cor, alinha: saldo > 0 ? "left" : "right" });
  }

  // Números e palavras em linhas separadas: na mesma linha, o rótulo da ponta
  // e o limite da escala caem um em cima do outro.
  const yEscala = yTrilho + altura + 20;
  for (const v of [-limite, 0, limite]) {
    texto(ctx, comSinal(v), posicao(v), yEscala,
          { tamanho: 11, peso: 700, cor: COR.cinzaEscuro, alinha: "center" });
  }
  texto(ctx, "abaixo da meta", x, yEscala + 18,
        { tamanho: 10, peso: 700, maiuscula: true, espaco: .8, cor: COR.vermelho });
  texto(ctx, "acima da meta", x + largura, yEscala + 18,
        { tamanho: 10, peso: 700, maiuscula: true, espaco: .8, cor: COR.azul,
          alinha: "right" });
  void metas;
}
