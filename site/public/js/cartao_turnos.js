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
 * lado bom da história antes de a linha ser desenhada. Na faixa do eixo eles
 * ficam reservados ao placar, que é onde a cor tem o que dizer — o mando sai
 * em cinza, porque casa e fora não são bom e ruim.
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
const ALTURA_FAIXA = 112;
const ALTURA_PAINEL = 132;
const VAO_PAINEL = 16;

// A etiqueta do placar é maior que a do mando de propósito: o placar é o
// assunto, o mando é a circunstância.
const TAG_MANDO = { largura: 34, altura: 14 };
const TAG_PLACAR = { largura: 44, altura: 21 };

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


  const spec = {
    titulo: `Os dois turnos ${artigo(equipe)} ${nomeBonito(equipe)} na Série `
          + `${serie} ${edicao.ano}`,
    subtitulo: `Cada coluna é um adversário: a ida na rodada n, a volta na `
             + `rodada n+19`,
    arquivo: `turnos-${serie}-${edicao.ano}-${equipe}`,
    // Sem faixa de números: os totais de cada turno já estão nas duas
    // classificações, e repeti-los em caixa grande seria dizer duas vezes o
    // mesmo. O que sobra — a diferença e o ritmo — pede desenho, não caixa, e
    // por isso é o corpo que os monta.
    numeros: [],
    nota: "",
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
      const larguraDireita = CARD.largura - MARGEM - x0;
      const meio = (larguraDireita - VAO_PAINEL) / 2;

      rosca(ctx, { saldo, x: x0, largura: meio, y, altura: ALTURA_PAINEL });
      ritmo(ctx, { ida, volta, x: x0 + meio + VAO_PAINEL, largura: meio, y,
                   altura: ALTURA_PAINEL });

      alvos.push(...await grafico(ctx, {
        confrontos, ida, volta, clubes,
        x: x0, largura: larguraDireita, y: y + ALTURA_PAINEL + 16, base,
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

  // Onde o returno parou. Daí para a frente a linha da ida é passado que o
  // returno ainda não alcançou, e vai pontilhada: no ponto em que as duas se
  // separam está a única comparação justa entre os dois turnos.
  const corte = volta.ultima > 0 && volta.ultima < ida.ultima
    ? volta.ultima : null;

  for (const { pontos, cor, lado } of desenhos) {
    if (pontos.length < 2) continue;
    if (lado !== "ida" || !corte) { polilinha(ctx, pontos, cor, 3); continue; }
    polilinha(ctx, pontos.slice(0, corte), cor, 3);
    tracejada(ctx, pontos.slice(corte - 1), cor);
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
    if (fim) etiquetaDaLinha(ctx, fim, `${resumo.pontos} pts`, cor,
                             { x, largura });
  }

  // E, na ida, quanto ela tinha no mesmo ponto em que o returno está agora.
  if (corte) {
    const ponto = desenhos[0].pontos[corte - 1];
    const quanto = confrontos[corte - 1].acumuladoIda;
    etiquetaDaLinha(ctx, ponto, `${quanto} pts`, COR_DO_TURNO().ida,
                    { x, largura, acima: true });
  }

  return await faixaDosConfrontos(ctx, {
    confrontos, clubes, centro, passo, y: faixaTopo, base,
    topoDoPlot: plotTopo,
  });
}

/** Um trecho de linha pontilhado: o mesmo traço, sem a promessa de presente. */
function tracejada(ctx, pontos, cor) {
  if (pontos.length < 2) return;
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = cor;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.beginPath();
  pontos.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.stroke();
  ctx.restore();
}

/** A etiqueta de um ponto da linha, sem sair do gráfico. */
function etiquetaDaLinha(ctx, [px, py], rotulo, cor, { x, largura,
                                                       acima = false }) {
  ctx.save();
  ctx.font = '800 13px "Assistant", sans-serif';
  const l = ctx.measureText(rotulo).width + 16;
  ctx.restore();

  const xt = acima ? px - l / 2 : Math.min(px + 10, x + largura - l);
  const yt = acima ? py - 30 : py - 11;
  caixa(ctx, Math.max(x, Math.min(xt, x + largura - l)), yt, l, 22, cor, 5);
  texto(ctx, rotulo, Math.max(x, Math.min(xt, x + largura - l)) + l / 2, yt + 15,
        { tamanho: 13, peso: 800, alinha: "center", cor: COR.marcaTexto });
}

/**
 * A rosca da diferença: os pontos de cada turno nos confrontos já repetidos.
 *
 * O anel diz a proporção — quanto de tudo o que se somou nesses confrontos
 * saiu de cada turno — e o miolo diz o que interessa, que é o saldo entre os
 * dois. Num campeonato em andamento a conta para na última coluna em que os
 * dois turnos jogaram: comparar dezenove jogos com nove não seria comparar.
 */
function rosca(ctx, { saldo, x, largura, y, altura }) {
  moldura(ctx, x, y, largura, altura);
  texto(ctx, saldo.completo ? "diferença entre os turnos"
          : `diferença nos ${saldo.colunas} confrontos repetidos`,
        x + 16, y + 22,
        { tamanho: 10, peso: 700, maiuscula: true, espaco: .9,
          cor: COR.cinzaEscuro });

  const raio = 44;
  const cx = x + 16 + raio;
  const cy = y + 34 + raio;
  const total = saldo.ida + saldo.volta;
  const cores = COR_DO_TURNO();

  ctx.save();
  ctx.lineWidth = 17;
  ctx.lineCap = "butt";
  if (!total) {
    ctx.strokeStyle = COR.cinzaClaro;
    ctx.beginPath();
    ctx.arc(cx, cy, raio, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    let inicio = -Math.PI / 2;
    for (const [lado, valor] of [["ida", saldo.ida], ["volta", saldo.volta]]) {
      if (!valor) continue;
      const fim = inicio + (valor / total) * Math.PI * 2;
      ctx.strokeStyle = cores[lado];
      ctx.beginPath();
      ctx.arc(cx, cy, raio, inicio, fim);
      ctx.stroke();
      inicio = fim;
    }
  }
  ctx.restore();

  texto(ctx, comSinal(saldo.diferenca), cx, cy + 4,
        { tamanho: 26, peso: 800, alinha: "center",
          cor: saldo.diferenca > 0 ? COR.positivo
            : saldo.diferenca < 0 ? COR.negativo : COR.cinzaEscuro });
  texto(ctx, "pontos", cx, cy + 20,
        { tamanho: 10, alinha: "center", cor: COR.cinzaEscuro });

  const xLegenda = cx + raio + 22;
  [["1º turno", saldo.ida, cores.ida], ["2º turno", saldo.volta, cores.volta]]
    .forEach(([rotulo, valor, cor], i) => {
      const yl = y + 56 + i * 34;
      caixa(ctx, xLegenda, yl - 10, 5, 22, cor, 2);
      texto(ctx, `${valor} pts`, xLegenda + 14, yl,
            { tamanho: 16, peso: 800, cor: COR.azulEscuro });
      texto(ctx, rotulo, xLegenda + 14, yl + 15,
            { tamanho: 10.5, peso: 700, maiuscula: true, espaco: .8,
              cor: COR.cinzaEscuro });
    });
}

/**
 * O ritmo dos dois turnos, e quanto um mudou em relação ao outro.
 *
 * Pontos por jogo, e não pontos: é a única medida que compara turnos com
 * números de jogos diferentes. O percentual do meio é a variação de um para o
 * outro — subiu de 1,58 para 1,78 é mais 13%, e é assim que se lê ritmo.
 */
function ritmo(ctx, { ida, volta, x, largura, y, altura }) {
  moldura(ctx, x, y, largura, altura);
  texto(ctx, "pontos por jogo", x + 16, y + 22,
        { tamanho: 10, peso: 700, maiuscula: true, espaco: .9,
          cor: COR.cinzaEscuro });

  // Cada turno encostado na sua borda, e o meio inteiro livre para a
  // variação: com os dois números puxados para o centro, a etiqueta do
  // percentual caía em cima do segundo.
  const cores = COR_DO_TURNO();
  const metade = largura / 2;
  const lados = [
    { rotulo: "1º turno", resumo: ida, cor: cores.ida,
      xr: x + 16, alinha: "left" },
    { rotulo: "2º turno", resumo: volta, cor: cores.volta,
      xr: x + largura - 16, alinha: "right" },
  ];
  for (const { rotulo, resumo, cor, xr, alinha } of lados) {
    const esquerda = alinha === "left" ? xr : xr - 34;
    caixa(ctx, esquerda, y + 44, 34, 5, cor, 2);
    texto(ctx, num(resumo.porJogo), xr, y + 88,
          { tamanho: 30, peso: 800, alinha, cor: COR.azulEscuro });
    texto(ctx, rotulo, xr, y + 108,
          { tamanho: 10.5, peso: 700, maiuscula: true, espaco: .8,
            alinha, cor: COR.cinzaEscuro });
  }

  const variacao = ida.porJogo ? volta.porJogo / ida.porJogo - 1 : null;
  const cor = variacao === null ? COR.cinzaEscuro
    : variacao > 0 ? COR.positivo : variacao < 0 ? COR.negativo : COR.cinzaEscuro;
  const rotulo = variacao === null ? "—"
    : `${variacao > 0 ? "+" : variacao < 0 ? "−" : ""}`
      + `${num(Math.abs(variacao) * 100, 1)}%`;

  const cxm = x + metade;
  ctx.save();
  ctx.strokeStyle = COR.linha;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cxm, y + 40);
  ctx.lineTo(cxm, y + altura - 16);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.font = '800 15px "Assistant", sans-serif';
  const l = ctx.measureText(rotulo).width + 22;
  ctx.restore();
  caixa(ctx, cxm - l / 2, y + 62, l, 26, cor, 13);
  texto(ctx, rotulo, cxm, y + 80,
        { tamanho: 15, peso: 800, alinha: "center", cor: COR.branco });
}

/** A caixa branca com fio, que é o fundo dos dois painéis do topo. */
function moldura(ctx, x, y, largura, altura) {
  caixa(ctx, x, y, largura, altura, COR.branco, 8);
  ctx.save();
  ctx.strokeStyle = COR.linha;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + .5, y + .5, largura - 1, altura - 1, 8);
  ctx.stroke();
  ctx.restore();
}

/**
 * O eixo x: o adversário, e embaixo dele o que aconteceu nos dois jogos.
 *
 * Duas fileiras, uma por turno, montadas em espelho: na ida o mando vem antes
 * do placar, na volta vem depois. Isso põe os dois placares encostados no meio
 * da coluna, que é onde a comparação acontece — o olho lê um em cima do outro
 * sem atravessar nada.
 *
 * A cor se divide pelo assunto. O placar leva a tríade do desfecho, porque é
 * ali que existe bom e ruim; o mando fica em cinza, escuro para casa e claro
 * para fora, porque jogar em casa não é melhor nem pior, é outra coisa.
 */
async function faixaDosConfrontos(ctx, { confrontos, clubes, centro, passo,
                                         y, base, topoDoPlot }) {
  const ladoEscudo = Math.min(24, passo - 6);
  const alvos = [];

  for (const confronto of confrontos) {
    const cx = centro(confronto.n);
    desenharEscudo(ctx, await imagem(clubes?.[confronto.adversario]?.escudo),
                   cx - ladoEscudo / 2, y, ladoEscudo);

    const yIda = y + ladoEscudo + 6;
    etiquetaDeMando(ctx, cx, yIda, confronto.ida);
    etiquetaDePlacar(ctx, cx, yIda + TAG_MANDO.altura + 3, confronto.ida);

    const yVolta = yIda + TAG_MANDO.altura + TAG_PLACAR.altura + 10;
    etiquetaDePlacar(ctx, cx, yVolta, confronto.volta);
    etiquetaDeMando(ctx, cx, yVolta + TAG_PLACAR.altura + 3, confronto.volta);

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

/** Cinza escuro para casa, cinza claro para fora. */
function etiquetaDeMando(ctx, cx, y, jogo) {
  if (!jogo) return;
  const emCasa = jogo.mando === "casa";
  caixa(ctx, cx - TAG_MANDO.largura / 2, y, TAG_MANDO.largura, TAG_MANDO.altura,
        emCasa ? COR.cinzaEscuro : COR.cinzaClaro, 4);
  texto(ctx, emCasa ? "casa" : "fora", cx, y + TAG_MANDO.altura - 4,
        { tamanho: 8.5, peso: 800, maiuscula: true, espaco: .5,
          alinha: "center", cor: emCasa ? COR.branco : COR.cinzaEscuro });
}

/** Azul, cinza ou vermelho — a tríade do desfecho, no tamanho de quem manda. */
function etiquetaDePlacar(ctx, cx, y, jogo) {
  if (!jogo) return;
  if (!jogo.realizado) {
    linhaH(ctx, cx - 7, cx + 7, y + TAG_PLACAR.altura / 2, COR.cinzaClaro, 2);
    return;
  }
  caixa(ctx, cx - TAG_PLACAR.largura / 2, y,
        TAG_PLACAR.largura, TAG_PLACAR.altura,
        corDoResultado(jogo.resultado), 5);
  texto(ctx, `${jogo.gp}×${jogo.gc}`, cx, y + TAG_PLACAR.altura - 6,
        { tamanho: 12.5, peso: 800, alinha: "center", cor: COR.branco });
}

const descrever = (jogo) => (!jogo ? "sem jogo nesta rodada"
  : jogo.realizado ? `${jogo.gp}×${jogo.gc} na ${jogo.rodada}ª rodada`
                   : `${jogo.rodada}ª rodada · a jogar`);
