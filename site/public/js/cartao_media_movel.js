/**
 * Card: a média móvel dos últimos X jogos.
 *
 * A tabela conta o ano inteiro e demora a mudar. Esta linha conta só a janela
 * mais recente: ela sobe quando o time embala e desce quando ele trava, e é
 * por isso que ela responde "como está agora" sem depender de memória.
 *
 * O ponto mais à direita é a janela de hoje — os últimos X jogos. O anterior é
 * a mesma janela um jogo atrás, e assim até o começo. Todas têm o mesmo
 * tamanho, e é isso que as torna comparáveis entre si.
 *
 * As duas linhas pontilhadas são réguas de destino: a média por jogo com que
 * cada uma daquelas posições costuma terminar a série. Elas respondem a
 * pergunta que a curva sozinha não responde — "esta fase, mantida até o fim,
 * daria que lugar?".
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, polilinha,
} from "/js/cartao.js";
import { nomeBonito, artigoDefinido } from "/js/nomes.js";
import { marcaAtual } from "/js/marca.js";
import {
  mediaMovel, pontosPorJogo, resumoDaSerie,
} from "/js/media_movel.js";

const CALHA = 58;
const ordinal = (n) => `${n}º`;
const num = (v) => v.toFixed(2).replace(".", ",");
const pct = (v) => `${(v * 100).toFixed(1).replace(".", ",")}%`;

export function montarCartao(estado) {
  const { serie, edicao, equipe, campanha, janela, modo, referencias,
          clubes } = estado;
  if (!edicao || !equipe || !campanha?.length) return null;

  const jogos = pontosPorJogo(campanha);
  const pontos = mediaMovel(jogos, janela);
  if (!pontos.length) return null;

  const resumo = resumoDaSerie(pontos);
  const porAproveitamento = modo === "aproveitamento";
  const escrever = (v) => (porAproveitamento ? pct(v / 3) : num(v));
  const nome = nomeBonito(equipe);

  const spec = {
    titulo: `Média móvel ${artigoDefinido(equipe) === "a" ? "da" : "do"} `
          + `${nome} em ${janela} ${janela === 1 ? "jogo" : "jogos"} na Série `
          + `${serie} ${edicao.ano}`,
    subtitulo: porAproveitamento
      ? "Cada ponto é o aproveitamento da janela que termina naquele jogo"
      : "Cada ponto é a média de pontos da janela que termina naquele jogo",
    escudo: clubes?.[equipe]?.escudo,
    arquivo: `media-movel-${nome}-${serie}-${edicao.ano}-${janela}`,
    numeros: [
      { valor: escrever(resumo.atual.media), destaque: "azul",
        nome: `nos últimos ${janela} jogos` },
      { valor: escrever(resumo.melhor.media),
        nome: `melhor janela · até o ${resumo.melhor.ate}º jogo` },
      { valor: escrever(resumo.pior.media),
        nome: `pior janela · até o ${resumo.pior.ate}º jogo` },
      { valor: escrever(resumo.media), destaque: "cinza",
        nome: "média das janelas" },
    ],
    nota: `As linhas pontilhadas são a média por jogo com que cada posição `
        + `costuma terminar a Série ${serie}, nas edições encerradas.`,
    corpo: async (ctx, y) => {
      const topo = y + 30;
      const base = CARD.altura - 108;
      const x0 = MARGEM + CALHA;
      const x1 = CARD.largura - MARGEM;

      const teto = tetoDoEixo(pontos, referencias);
      const xDe = (n) => x0 + ((n - pontos[0].ate)
        / Math.max(1, pontos.at(-1).ate - pontos[0].ate)) * (x1 - x0);
      const yDe = (media) => base - (media / teto) * (base - topo);

      eixos(ctx, { teto, porAproveitamento, x0, x1, topo, base });
      for (const referencia of referencias ?? []) {
        if (!referencia.media) continue;
        reguaDaPosicao(ctx, { referencia, yDe, x0, x1, escrever });
      }

      // A linha, e depois os pontos: o traço passa por baixo das bolinhas.
      polilinha(ctx, pontos.map((p) => [xDe(p.ate), yDe(p.media)]),
                COR.azul, 3);

      const alvos = [];
      for (const [i, ponto] of pontos.entries()) {
        const x = xDe(ponto.ate), yp = yDe(ponto.media);
        const ultimo = i === pontos.length - 1;

        ctx.save();
        ctx.fillStyle = ultimo ? COR.azul : COR.branco;
        ctx.strokeStyle = COR.azul;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, yp, ultimo ? 7 : 3.5, 0, Math.PI * 2);
        ctx.fill();
        if (!ultimo) ctx.stroke();
        ctx.restore();

        alvos.push({
          x: x - 10, y: topo, l: 20, a: base - topo,
          ...dicaDaJanela(ponto, { escrever, janela }),
        });
      }

      // O número da janela de hoje, na ponta da linha.
      const fim = pontos.at(-1);
      texto(ctx, escrever(fim.media), xDe(fim.ate) - 12, yDe(fim.media) - 16,
            { tamanho: 17, peso: 800, alinha: "right", cor: COR.azul });

      rotulosDoEixoX(ctx, { pontos, xDe, base });
      texto(ctx, `jogo em que a janela de ${janela} termina →`,
            (x0 + x1) / 2, base + 46,
            { tamanho: 11, peso: 700, alinha: "center", maiuscula: true,
              espaco: .9, cor: COR.cinzaEscuro });

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: y, alturaPlot: base - y,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
      };
    },
  };
  return spec;
}

/* ----------------------------------------------------------------- eixos */
/**
 * O teto do eixo.
 *
 * Três pontos por jogo é o máximo possível, mas quase nenhuma janela chega
 * perto disso — deixar o eixo até três esmagaria a curva no chão. O teto é o
 * maior valor em cena com uma folga, e nunca menos de um ponto por jogo, para
 * que uma fase ruim não vire uma montanha.
 */
function tetoDoEixo(pontos, referencias) {
  const valores = [
    ...pontos.map((p) => p.media),
    ...(referencias ?? []).map((r) => r.media ?? 0),
  ];
  return Math.min(3, Math.max(1, Math.max(...valores) * 1.18));
}

function eixos(ctx, { teto, porAproveitamento, x0, x1, topo, base }) {
  // As linhas caem em números redondos da leitura escolhida: meio ponto por
  // jogo numa, vinte e cinco por cento na outra. Uma régua de 17% em 17% é
  // matematicamente igual e visualmente inútil.
  const passo = porAproveitamento
    ? (teto > 2 ? 0.75 : 0.3)
    : (teto > 2 ? 0.5 : 0.25);
  for (let v = 0; v <= teto + 1e-9; v += passo) {
    const y = base - (v / teto) * (base - topo);
    linhaH(ctx, x0, x1, y, COR.linha);
    texto(ctx, porAproveitamento ? `${Math.round((v / 3) * 100)}%` : num(v),
          x0 - 10, y + 4,
          { tamanho: 10.5, alinha: "right", cor: COR.cinzaEscuro });
  }
  linhaH(ctx, x0, x1, base, COR.cinza);
}

function rotulosDoEixoX(ctx, { pontos, xDe, base }) {
  const salto = Math.ceil(pontos.length / 20);
  for (const [i, ponto] of pontos.entries()) {
    if (i % salto !== 0 && i !== pontos.length - 1) continue;
    texto(ctx, ponto.ate, xDe(ponto.ate), base + 22,
          { tamanho: 10.5, alinha: "center", cor: COR.cinzaEscuro });
  }
}

/**
 * A régua de uma posição: onde a fase de hoje levaria o time.
 *
 * Verde na posição melhor, vermelho na pior — o mesmo par das alças que as
 * escolhem, para que a linha do card e o controle da página digam a mesma
 * coisa sem legenda.
 */
function reguaDaPosicao(ctx, { referencia, yDe, x0, x1, escrever }) {
  const y = yDe(referencia.media);
  ctx.save();
  ctx.strokeStyle = referencia.cor;
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  ctx.restore();

  const rotulo = `${ordinal(referencia.posicao)} · ${escrever(referencia.media)}`;
  const largura = rotulo.length * 6.4 + 16;
  caixa(ctx, x1 - largura, y - 20, largura, 17, referencia.cor, 4);
  texto(ctx, rotulo, x1 - largura / 2, y - 8,
        { tamanho: 10.5, peso: 800, alinha: "center", cor: COR.branco });
}

/* ------------------------------------------------------------------ dica */
function dicaDaJanela(ponto, { escrever, janela }) {
  const marca = marcaAtual();
  const conta = ponto.jogos.reduce((acc, j) => {
    acc[j.jogo?.resultado ?? "D"] = (acc[j.jogo?.resultado ?? "D"] ?? 0) + 1;
    return acc;
  }, {});

  return {
    n: `jogos ${ponto.de} a ${ponto.ate}`,
    itens: [{
      rotulo: `${conta.T ?? 0} ${marca.triunfos}, ${conta.E ?? 0} empates e `
            + `${conta.D ?? 0} derrotas`,
      cor: COR.azul, pontos: ponto.pontos,
      detalhe: `em ${janela} jogos`,
    }],
    diferenca: {
      rotulo: escrever(ponto.media),
      texto: "na janela que termina neste jogo",
      cor: COR.azul,
    },
  };
}
