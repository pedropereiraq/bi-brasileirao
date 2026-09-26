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
 *
 * A dica do mouse abre a janela: os X jogos que formam aquele ponto, com o
 * adversário, o local e o placar, na ordem em que aconteceram. Um ponto baixo
 * pode ser um time que jogou mal ou um time que pegou os quatro primeiros, e
 * a média sozinha não separa os dois casos.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, polilinha,
} from "/js/cartao.js";
import { nomeBonito, artigoDefinido } from "/js/nomes.js";
import { marcaAtual } from "/js/marca.js";
import {
  mediaMovel, pontosPorJogo, resumoDaSerie,
} from "/js/media_movel.js";

const CALHA = 104;
const ordinal = (n) => `${n}º`;
const num = (v) => v.toFixed(2).replace(".", ",");
const pct = (v) => `${(v * 100).toFixed(1).replace(".", ",")}%`;

export function montarCartao(estado) {
  const { serie, edicao, equipe, campanha, janela, modo, referencias } = estado;
  if (!edicao || !equipe || !campanha?.length) return null;

  const jogos = pontosPorJogo(campanha);
  const pontos = mediaMovel(jogos, janela);
  if (!pontos.length) return null;

  const resumo = resumoDaSerie(pontos);
  const porAproveitamento = modo === "aproveitamento";
  const escrever = (v) => (porAproveitamento ? pct(v / 3) : num(v));
  const nome = nomeBonito(equipe);

  const spec = {
    // O que a linha mede vai no título: "média móvel" sozinho não diz se o
    // eixo é de pontos por jogo ou de aproveitamento.
    titulo: `Média móvel de ${porAproveitamento ? "aproveitamento" : "pontos por jogo"}`
          + ` ${artigoDefinido(equipe) === "a" ? "da" : "do"} ${nome} em `
          + `${janela} ${janela === 1 ? "jogo" : "jogos"} na Série ${serie} `
          + `${edicao.ano}`,
    subtitulo: "",
    arquivo: `media-movel-${nome}-${serie}-${edicao.ano}-${janela}`,
    numeros: [],
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

        // Rótulo em todos os pontos: a curva conta o movimento, o número
        // conta o tamanho dele. Ele vai para o lado em que os dois vizinhos
        // não estão — acima num pico, abaixo num vale — e leva contorno na
        // cor do fundo para os casos em que não há lado livre.
        const antes = pontos[i - 1]?.media ?? ponto.media;
        const depois = pontos[i + 1]?.media ?? ponto.media;
        const acima = ponto.media >= (antes + depois) / 2;
        texto(ctx, escrever(ponto.media), x, yp + (acima ? -11 : 18),
              { tamanho: ultimo ? 14 : 10.5, peso: ultimo ? 800 : 700,
                alinha: "center", cor: ultimo ? COR.azul : COR.cinzaTexto,
                contorno: COR.fundo });

        alvos.push({
          x: x - 10, y: topo, l: 20, a: base - topo,
          ...dicaDaJanela(ponto, { escrever, janela }),
        });
      }

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
          x0 - 12, y + 4,
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
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  ctx.restore();

  // A etiqueta mora fora do gráfico, na calha da esquerda: dentro dele ela
  // cobriria a curva justamente onde a curva cruza a régua.
  const traco = MARGEM + 4;
  ctx.save();
  ctx.strokeStyle = referencia.cor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(traco, y);
  ctx.lineTo(traco + 14, y);
  ctx.stroke();
  ctx.restore();
  texto(ctx, `${ordinal(referencia.posicao)} ${escrever(referencia.media)}`,
        traco + 20, y + 4,
        { tamanho: 10.5, peso: 700, cor: referencia.cor });
}

/* ------------------------------------------------------------------ dica */
// Uma janela muito longa viraria uma lista maior que a tela; o resto vira
// uma linha de resumo, que é o que se lê mesmo quando são vinte jogos.
const MOSTRAR = 16;

const corDoResultado = (resultado) => (resultado === "T" ? COR.positivo
  : resultado === "E" ? COR.cinzaEscuro : COR.negativo);

const plural = (n, um, muitos) => `${n} ${n === 1 ? um : muitos}`;

/**
 * A janela por dentro: os jogos que formam o ponto.
 *
 * Na ordem em que aconteceram, e não na ordem do placar: a pergunta é como a
 * fase se construiu — três derrotas no começo e dois triunfos no fim dão a
 * mesma média que o contrário, e não são a mesma coisa.
 */
function dicaDaJanela(ponto, { escrever, janela }) {
  const marca = marcaAtual();
  const conta = ponto.jogos.reduce((acc, j) => {
    acc[j.jogo?.resultado ?? "D"] = (acc[j.jogo?.resultado ?? "D"] ?? 0) + 1;
    return acc;
  }, {});

  const itens = ponto.jogos.slice(0, MOSTRAR).map(({ jogo }) => ({
    rotulo: `${jogo?.mando === "casa" ? "casa" : "fora"} · `
          + `${nomeBonito(jogo?.adversario ?? "")}`,
    cor: corDoResultado(jogo?.resultado),
    pontos: null,
    texto: `${jogo?.gp ?? "—"}×${jogo?.gc ?? "—"}`,
    detalhe: "",
  }));
  if (ponto.jogos.length > MOSTRAR) {
    itens.push({ rotulo: `e mais ${ponto.jogos.length - MOSTRAR} jogos`,
                 cor: COR.cinzaClaro, pontos: null, texto: "", detalhe: "" });
  }

  return {
    n: `jogos ${ponto.de} a ${ponto.ate}`,
    itens,
    diferenca: {
      rotulo: escrever(ponto.media),
      texto: `${plural(conta.T ?? 0, marca.triunfo, marca.triunfos)}, `
           + `${plural(conta.E ?? 0, "empate", "empates")} e `
           + `${plural(conta.D ?? 0, "derrota", "derrotas")} `
           + `em ${janela} jogos`,
      cor: COR.azul,
    },
  };
}
