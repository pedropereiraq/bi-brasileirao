/**
 * Card: os dois turnos de um clube, cruzados.
 *
 * A tabela do Brasileirão é espelhada, e é isso que torna esta tela possível:
 * cada coluna do gráfico é **um adversário**, com a ida e a volta uma em cima
 * da outra. A pergunta que a tela responde — contra quem se ganhou ponto no
 * primeiro turno e se deixou de ganhar no segundo — deixa de exigir conta de
 * cabeça e vira leitura.
 *
 * À esquerda, as duas classificações do recorte: a do primeiro turno e a do
 * segundo, cada uma com os jogos do seu turno e mais nada. Lado a lado elas
 * dizem o que nenhuma tabela geral diz — quem fez o campeonato no começo e
 * quem o fez no fim. A seta na segunda marca quantas posições o clube subiu ou
 * caiu de uma para a outra.
 *
 * As linhas usam **ordem das rodadas**, e não a cronológica: o valor na coluna
 * n é o que o clube somou nos jogos já disputados até aquela rodada do turno.
 * Jogo adiado deixa a linha plana ali e entra quando acontecer, que é como a
 * tabela do dia funciona.
 *
 * Azul e vermelho são o par da identidade, e não um juízo: nenhum turno é o
 * lado bom da história antes de a linha ser desenhada.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
  polilinha,
} from "/js/cartao.js";
import { artigo, nomeBonito } from "/js/nomes.js";
import {
  confrontosDosTurnos, resumoDoTurno, saldoComparavel,
} from "/js/turnos.js";

const LARGURA_TABELA = 262;
const VAO_TABELA = 10;
const ALTURA_FAIXA = 108;

const ordinal = (p) => `${p}º`;
const num = (v, casas = 2) =>
  (v === null ? "—" : v.toFixed(casas).replace(".", ","));
const comSinal = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0");

const COR_DO_TURNO = () => ({ ida: COR.azul, volta: COR.vermelho });

const corDoResultado = (resultado) => (resultado === "T" ? COR.positivo
  : resultado === "E" ? COR.cinzaEscuro : COR.negativo);

export function montarCartao(estado) {
  const { serie, edicao, equipe, clubes, agenda, tabelas, aoEscolher } = estado;
  if (!edicao || !equipe || !tabelas) return null;

  const confrontos = confrontosDosTurnos(agenda);
  const ida = resumoDoTurno(confrontos, "ida");
  const volta = resumoDoTurno(confrontos, "volta");
  const saldo = saldoComparavel(confrontos);
  if (!ida.jogos) return null;

  const posicaoEm = (tabela) =>
    tabela.find((c) => c.equipe === equipe)?.pos ?? null;
  const posIda = posicaoEm(tabelas.ida);
  const posVolta = posicaoEm(tabelas.volta);

  const spec = {
    titulo: `Os dois turnos ${artigo(equipe)} ${nomeBonito(equipe)} na Série `
          + `${serie} ${edicao.ano}`,
    subtitulo: `Cada coluna é um adversário: a ida na rodada n, a volta na `
             + `rodada n+19`,
    arquivo: `turnos-${serie}-${edicao.ano}-${equipe}`,
    numeros: [
      { valor: `${ida.pontos}`, destaque: "azul",
        nome: `1º turno · ${posIda ? ordinal(posIda) : "—"} em ${ida.jogos} jogos` },
      { valor: `${volta.pontos}`,
        nome: `2º turno · ${posVolta ? ordinal(posVolta) : "—"} em `
            + `${volta.jogos} jogos` },
      // Num campeonato em andamento, o total de um turno tem mais jogos que o
      // do outro: a diferença que vale é a dos confrontos já repetidos.
      { valor: comSinal(saldo.diferenca),
        nome: saldo.completo ? "diferença entre os turnos"
          : `diferença nos ${saldo.colunas} confrontos repetidos` },
      { valor: `${num(ida.porJogo)} → ${num(volta.porJogo)}`,
        nome: "pontos por jogo" },
    ],
    nota: `As classificações da esquerda são de um turno só: cada uma conta `
        + `apenas os jogos do seu recorte. Clique em qualquer clube para `
        + `trocar a equipe analisada.`,
    corpo: async (ctx, y) => {
      const base = CARD.altura - 84;

      const alvos = [];
      alvos.push(...await tabelaDoTurno(ctx, {
        titulo: "1º turno", tabela: tabelas.ida, equipe, clubes,
        cor: COR_DO_TURNO().ida, x: MARGEM, largura: LARGURA_TABELA, y, base,
      }));
      alvos.push(...await tabelaDoTurno(ctx, {
        titulo: "2º turno", tabela: tabelas.volta, comparar: tabelas.ida,
        equipe, clubes, cor: COR_DO_TURNO().volta,
        x: MARGEM + LARGURA_TABELA + VAO_TABELA, largura: LARGURA_TABELA,
        y, base,
      }));

      const x0 = MARGEM + 2 * (LARGURA_TABELA + VAO_TABELA) + 14;
      alvos.push(...await grafico(ctx, {
        confrontos, ida, volta, clubes,
        x: x0, largura: CARD.largura - MARGEM - x0, y, base,
      }));

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: y, alturaPlot: base - y,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
        aoClicar: aoEscolher
          ? (alvo) => { if (alvo.equipe) aoEscolher(alvo.equipe); }
          : undefined,
      };
    },
  };
  return spec;
}

/* ------------------------------------------------------------- tabelas */
async function tabelaDoTurno(ctx, { titulo, tabela, comparar, equipe, clubes,
                                    cor, x, largura, y, base }) {
  caixa(ctx, x, y, largura, 22, cor, 4);
  texto(ctx, titulo, x + 10, y + 16,
        { tamanho: 11.5, peso: 800, maiuscula: true, espaco: .9,
          cor: COR.marcaTexto });
  texto(ctx, "pts", x + largura - 10, y + 16,
        { tamanho: 10, peso: 700, maiuscula: true, espaco: .7, alinha: "right",
          cor: COR.marcaSuave });

  const topo = y + 28;
  const alturaLinha = (base - topo) / Math.max(1, tabela.length);
  const xPts = x + largura - 10;
  // A seta precisa de rua própria: encostada nos pontos, "▲1" e "37" viram
  // "137".
  const xSeta = comparar ? x + largura - 58 : x + largura;

  const alvos = [];
  for (const [i, clube] of tabela.entries()) {
    const yLinha = topo + i * alturaLinha;
    const meio = yLinha + alturaLinha / 2;
    const meu = clube.equipe === equipe;

    if (meu) caixa(ctx, x, yLinha, largura, alturaLinha - 1, COR.cinzaClaro, 4);
    else if (i % 2 === 0) caixa(ctx, x, yLinha, largura, alturaLinha - 1,
                                COR.branco, 4);
    if (meu) caixa(ctx, x, yLinha, 3, alturaLinha - 1, cor, 2);

    texto(ctx, clube.pos, x + 20, meio + 4,
          { tamanho: 11, peso: 800, alinha: "right", cor: COR.cinzaEscuro });

    const lado = Math.min(17, alturaLinha - 5);
    desenharEscudo(ctx, await imagem(clubes?.[clube.equipe]?.escudo),
                   x + 26, meio - lado / 2, lado);

    texto(ctx, cortar(ctx, nomeBonito(clube.equipe), xSeta - x - 50, 11.5,
                      meu ? 800 : 400),
          x + 48, meio + 4,
          { tamanho: 11.5, peso: meu ? 800 : 400,
            cor: meu ? COR.azulEscuro : COR.cinzaTexto });

    // A seta compara as duas tabelas: quantas posições o clube subiu ou caiu
    // de um turno para o outro. É o número que a tabela geral esconde.
    if (comparar) {
      const antes = comparar.find((c) => c.equipe === clube.equipe)?.pos;
      const mudou = antes ? antes - clube.pos : 0;
      if (mudou !== 0) {
        const sobe = mudou > 0;
        seta(ctx, xSeta + 5, meio, sobe);
        texto(ctx, Math.abs(mudou), xSeta + 14, meio + 4,
              { tamanho: 10.5, peso: 700,
                cor: sobe ? COR.positivo : COR.negativo });
      }
    }

    texto(ctx, clube.pts, xPts, meio + 4,
          { tamanho: 12, peso: 800, alinha: "right", cor: COR.azulEscuro });

    alvos.push({
      n: `${nomeBonito(clube.equipe)} · ${titulo}`,
      equipe: clube.equipe,
      x, y: yLinha, l: largura, a: alturaLinha - 1,
      itens: [],
      diferenca: {
        rotulo: `${clube.pts} pts`,
        texto: `${ordinal(clube.pos)} no ${titulo} · ${clube.j}J `
             + `${clube.t}T ${clube.e}E ${clube.d}D`,
        cor,
      },
    });
  }
  return alvos;
}

function seta(ctx, x, y, paraCima) {
  ctx.save();
  ctx.fillStyle = paraCima ? COR.positivo : COR.negativo;
  ctx.beginPath();
  if (paraCima) {
    ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y + 3); ctx.lineTo(x - 5, y + 3);
  } else {
    ctx.moveTo(x, y + 5); ctx.lineTo(x + 5, y - 3); ctx.lineTo(x - 5, y - 3);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------- gráfico */
async function grafico(ctx, { confrontos, ida, volta, clubes, x, largura,
                              y, base }) {
  const passo = largura / confrontos.length;
  const centro = (n) => x + (n - 0.5) * passo;

  const faixaTopo = base - ALTURA_FAIXA;
  const plotTopo = y + 26;
  const plotBase = faixaTopo - 12;
  const maximo = Math.max(3, ...confrontos.flatMap(
    (c) => [c.acumuladoIda, c.acumuladoVolta]));
  const yDe = (pts) => plotBase - (pts / maximo) * (plotBase - plotTopo);

  linhaH(ctx, x, x + largura, plotBase, COR.linha);
  legenda(ctx, { x, y: y + 14, ida, volta });

  // Cada linha vai até a última coluna com jogo disputado: o returno de uma
  // edição em andamento não pode ser desenhado plano até o fim, como se o
  // clube tivesse parado de pontuar.
  const linha = (chave, ate) => confrontos.slice(0, ate)
    .map((c) => [centro(c.n), yDe(c[chave])]);

  const desenhos = [
    { lado: "ida", pontos: linha("acumuladoIda", ida.ultima),
      cor: COR_DO_TURNO().ida, resumo: ida },
    { lado: "volta", pontos: linha("acumuladoVolta", volta.ultima),
      cor: COR_DO_TURNO().volta, resumo: volta },
  ];

  for (const { pontos, cor } of desenhos) {
    if (pontos.length < 2) continue;
    polilinha(ctx, pontos, cor, 3);
  }
  for (const { pontos, cor } of desenhos) {
    for (const [px, py] of pontos) {
      ctx.save();
      ctx.fillStyle = COR.fundo;
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cor;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // O total de cada turno na ponta da sua linha, que é onde o olho já está.
  for (const { pontos, cor, resumo } of desenhos) {
    const fim = pontos.at(-1);
    if (!fim) continue;
    const [fx, fy] = fim;
    const rotulo = `${resumo.pontos} pts`;
    ctx.save();
    ctx.font = '800 13px "Assistant", sans-serif';
    const l = ctx.measureText(rotulo).width + 16;
    ctx.restore();
    const xt = Math.min(fx + 10, x + largura - l);
    caixa(ctx, xt, fy - 11, l, 22, cor, 5);
    texto(ctx, rotulo, xt + l / 2, fy + 4,
          { tamanho: 13, peso: 800, alinha: "center", cor: COR.marcaTexto });
  }

  return await faixaDosConfrontos(ctx, {
    confrontos, clubes, centro, passo, y: faixaTopo, base,
    topoDoPlot: plotTopo,
  });
}

function legenda(ctx, { x, y, ida, volta }) {
  const itens = [
    { cor: COR_DO_TURNO().ida, texto: `1º turno · ${ida.pontos} pts` },
    { cor: COR_DO_TURNO().volta, texto: `2º turno · ${volta.pontos} pts` },
  ];
  let cursor = x;
  ctx.save();
  ctx.font = '700 12px "Assistant", sans-serif';
  for (const item of itens) {
    caixa(ctx, cursor, y - 9, 14, 4, item.cor, 2);
    ctx.fillStyle = COR.cinzaTexto;
    ctx.fillText(item.texto, cursor + 22, y);
    cursor += 22 + ctx.measureText(item.texto).width + 28;
  }
  ctx.restore();
}

/**
 * O eixo x: o adversário, e embaixo dele o que aconteceu nos dois jogos.
 *
 * Duas fileiras, uma por turno, cada uma com a pílula do mando e o placar. O
 * mando precisa estar escrito: a tabela é espelhada, então quem recebeu na ida
 * visitou na volta, e metade da explicação de uma queda mora aí.
 *
 * A última fileira é o saldo — o que a volta devolveu do que a ida tinha dado.
 * É a resposta direta à pergunta da tela, e por isso é a única linha em que a
 * cor julga.
 */
async function faixaDosConfrontos(ctx, { confrontos, clubes, centro, passo,
                                         y, base, topoDoPlot }) {
  const ladoEscudo = Math.min(24, passo - 6);
  const alvos = [];

  for (const confronto of confrontos) {
    const cx = centro(confronto.n);
    desenharEscudo(ctx, await imagem(clubes?.[confronto.adversario]?.escudo),
                   cx - ladoEscudo / 2, y, ladoEscudo);

    [["ida", confronto.ida, confronto.pontosIda],
     ["volta", confronto.volta, confronto.pontosVolta]].forEach(
      ([lado, jogo, pontos], i) => {
        const yl = y + ladoEscudo + 6 + i * 28;
        if (!jogo) return;

        const emCasa = jogo.mando === "casa";
        const cor = COR_DO_TURNO()[lado];
        caixa(ctx, cx - 17, yl, 34, 13, emCasa ? cor : COR.fundo, 4);
        if (!emCasa) {
          ctx.save();
          ctx.strokeStyle = cor;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(cx - 16.5, yl + .5, 33, 12, 4);
          ctx.stroke();
          ctx.restore();
        }
        texto(ctx, emCasa ? "casa" : "fora", cx, yl + 10,
              { tamanho: 8.5, peso: 800, maiuscula: true, espaco: .5,
                alinha: "center", cor: emCasa ? COR.marcaTexto : cor });

        if (jogo.realizado) {
          texto(ctx, `${jogo.gp}×${jogo.gc}`, cx, yl + 26,
                { tamanho: 11.5, peso: 800, alinha: "center",
                  cor: corDoResultado(jogo.resultado) });
        } else {
          linhaH(ctx, cx - 6, cx + 6, yl + 22, COR.cinzaClaro, 2);
        }
        void pontos;
      });

    const ySaldo = base - 16;
    if (confronto.saldo !== null) {
      const cor = confronto.saldo > 0 ? COR.positivo
        : confronto.saldo < 0 ? COR.negativo : COR.cinza;
      caixa(ctx, cx - 15, ySaldo, 30, 16, cor, 4);
      texto(ctx, comSinal(confronto.saldo), cx, ySaldo + 12,
            { tamanho: 10.5, peso: 800, alinha: "center", cor: COR.branco });
    }

    alvos.push({
      n: nomeBonito(confronto.adversario ?? "—"),
      x: cx - passo / 2, y: topoDoPlot, l: passo, a: base - topoDoPlot,
      itens: [
        { rotulo: `1º turno · ${confronto.ida?.mando ?? "—"}`,
          cor: COR_DO_TURNO().ida,
          pontos: confronto.pontosIda,
          detalhe: descrever(confronto.ida) },
        { rotulo: `2º turno · ${confronto.volta?.mando ?? "—"}`,
          cor: COR_DO_TURNO().volta,
          pontos: confronto.pontosVolta,
          detalhe: descrever(confronto.volta) },
      ],
      diferenca: confronto.saldo === null ? null : {
        rotulo: comSinal(confronto.saldo),
        texto: confronto.saldo === 0 ? "o returno repetiu a ida"
          : confronto.saldo > 0 ? "o returno rendeu mais" : "o returno rendeu menos",
        cor: confronto.saldo > 0 ? COR.positivo
          : confronto.saldo < 0 ? COR.negativo : COR.cinzaEscuro,
      },
    });
  }
  return alvos;
}

const descrever = (jogo) => (!jogo ? "sem jogo nesta rodada"
  : jogo.realizado ? `${jogo.gp}×${jogo.gc} na ${jogo.rodada}ª rodada`
                   : `${jogo.rodada}ª rodada · a jogar`);
