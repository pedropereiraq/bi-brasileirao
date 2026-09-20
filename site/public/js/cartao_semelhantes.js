/**
 * Card: quem já esteve nesta situação, e onde terminou.
 *
 * A pergunta "46 pontos em 27 jogos é bom?" não se responde com projeção de
 * aproveitamento — projeção assume que o resto do campeonato vai ser igual ao
 * começo, que é justamente o que ninguém sabe. Responde-se com precedente: as
 * campanhas que já passaram exatamente por ali, e onde elas foram parar.
 *
 * Gráfico e lista são a mesma coisa. As 20 posições ficam no topo, do 20º à
 * esquerda ao 1º à direita — a ordem da trilha do filtro —, e cada campanha é
 * um cartãozinho empilhado na posição em que terminou. A pilha mais alta é a
 * posição mais frequente: a barra do histograma é feita das próprias equipes,
 * em vez de resumi-las num número que depois precisa de legenda.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import {
  campanhasSemelhantes, distribuicaoPorPosicao, resumoDasSemelhantes,
  zonaDaPosicao, zonasDaFaixa,
} from "/js/similares.js";

const POSICOES = 20;
const VAO = 6;
const ALTURA_CARTAO = 72;   // teto: um cartão sozinho não vira um poste
const ALTURA_MINIMA = 26;

const num = (v) => v.toFixed(1).replace(".", ",");
const ordinal = (p) => `${p}º`;

/**
 * A cor de cada parte da tabela.
 *
 * Com duas partes — quando a faixa encosta no 1º ou no 20º — são só verde e
 * vermelho: há um corte, e cada lado dele é um desfecho. Com três, a do meio
 * vira cinza, porque aí ela é a faixa escolhida e não "o lado bom".
 */
function coresDasZonas(faixa) {
  const zonas = zonasDaFaixa(faixa, POSICOES);
  if (zonas.length >= 3) {
    return { acima: COR.verde, dentro: COR.cinzaEscuro, abaixo: COR.vermelho };
  }
  if (zonas.length === 2) {
    return { [zonas[0].nome]: COR.verde, [zonas[1].nome]: COR.vermelho };
  }
  return { [zonas[0].nome]: COR.cinzaEscuro };
}

export function montarCartao(estado) {
  const { serie, jogos, pontos, faixa, clubes, campanhas } = estado;
  if (!campanhas || !jogos || pontos === null || pontos === undefined) return null;

  const achadas = campanhasSemelhantes(campanhas, { serie, jogos, pontos });
  const resumo = resumoDasSemelhantes(achadas, faixa);
  const contagem = distribuicaoPorPosicao(achadas, POSICOES);
  const cores = coresDasZonas(faixa);
  const zonas = zonasDaFaixa(faixa, POSICOES);

  const spec = {
    titulo: `Campanhas com ${pontos} pontos em ${jogos} `
          + `${jogos === 1 ? "jogo" : "jogos"} na Série ${serie}`,
    subtitulo: "",
    arquivo: `semelhantes-${serie}-${pontos}pts-${jogos}jogos`,
    numeros: [],
    nota: "",
    corpo: async (ctx, y) => {
      if (!achadas.length) {
        semPrecedente(ctx, { y, jogos, pontos, serie });
        return;
      }

      resumoEnxuto(ctx, { resumo, y });
      pizzaDasZonas(ctx, { achadas, zonas, cores, faixa, x: 900, y: y + 6 });
      linhaH(ctx, MARGEM, CARD.largura - MARGEM, y + 86, COR.linha);

      spec.hover = await faixaDePosicoes(ctx, {
        achadas, contagem, faixa, cores, zonas, clubes, jogos, pontos,
        y: y + 112,
      });
    },
  };
  return spec;
}

function semPrecedente(ctx, { y, jogos, pontos, serie }) {
  texto(ctx, "Nenhuma campanha encerrada da série chegou a esse ponto.",
        MARGEM, y + 70, { tamanho: 26, peso: 700, cor: COR.azul,
                          familia: "Bree Serif" });
  texto(ctx, `${pontos} pontos em ${jogos} jogos é inédito na Série ${serie} `
           + `no recorte que o BI cobre — não há com o que comparar.`,
        MARGEM, y + 108, { tamanho: 16, cor: COR.cinzaTexto });
}

/* ------------------------------------------------------ resumo e pizza */
/**
 * Três números em tira fina, e não na faixa de blocos grandes.
 *
 * Eles contextualizam o card; o assunto é a faixa de posições logo abaixo.
 * Blocos de 96px tomavam um oitavo da altura para dizer três coisas curtas.
 */
function resumoEnxuto(ctx, { resumo, y }) {
  const itens = [
    { valor: resumo.total, nome: "campanhas nesta situação", cor: COR.azul },
    { valor: num(resumo.mediaFim), nome: "pontuação final média", cor: COR.azulEscuro },
    { valor: `${num(resumo.posicaoMedia)}º`, nome: "posição final média",
      cor: COR.azulEscuro },
  ];

  const largura = 244, altura = 56;
  itens.forEach((item, i) => {
    const x = MARGEM + i * (largura + 14);
    caixa(ctx, x, y, largura, altura, COR.branco, 7);
    ctx.save();
    ctx.strokeStyle = COR.linha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + .5, y + .5, largura - 1, altura - 1, 7);
    ctx.stroke();
    ctx.restore();
    caixa(ctx, x, y + 8, 4, altura - 16, item.cor, 2);

    texto(ctx, item.valor, x + 16, y + 30,
          { tamanho: 24, peso: 800, cor: item.cor });
    texto(ctx, item.nome, x + 16, y + 46,
          { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
            cor: COR.cinzaEscuro });
  });
}

/** A fatia de cada parte da tabela, ao lado dos números. */
function pizzaDasZonas(ctx, { achadas, zonas, cores, faixa, x, y }) {
  const contagens = zonas.map((zona) => ({
    ...zona,
    cor: cores[zona.nome] ?? COR.cinzaClaro,
    n: achadas.filter((c) => zonaDaPosicao(c.posFim, faixa) === zona.nome).length,
  }));

  const raio = 34, cx = x + raio, cy = y + raio + 4;
  const total = achadas.length;
  let angulo = -Math.PI / 2;

  for (const parte of contagens) {
    if (!parte.n) continue;
    const arco = (parte.n / total) * Math.PI * 2;
    ctx.save();
    ctx.fillStyle = parte.cor;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, raio, angulo, angulo + arco);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    angulo += arco;
  }

  // Miolo vazado: a pizza vira rosca e o desenho fica mais leve, no tom do
  // resto do card.
  ctx.save();
  ctx.fillStyle = COR.fundo;
  ctx.beginPath();
  ctx.arc(cx, cy, raio * 0.52, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  let yLegenda = y + 16;
  for (const parte of contagens) {
    caixa(ctx, cx + raio + 20, yLegenda - 9, 11, 11, parte.cor, 3);
    texto(ctx, `${parte.n}`, cx + raio + 38, yLegenda,
          { tamanho: 14, peso: 800, cor: COR.azulEscuro });
    texto(ctx, parte.de === parte.ate ? `em ${ordinal(parte.de)}`
               : `de ${ordinal(parte.de)} a ${ordinal(parte.ate)}`,
          cx + raio + 62, yLegenda,
          { tamanho: 12, cor: COR.cinzaTexto });
    yLegenda += 22;
  }
}

/* --------------------------------------------- a faixa das 20 posições */
/**
 * As 20 posições no topo e, sob cada uma, as campanhas que terminaram ali.
 *
 * A ordem é a mesma da trilha do filtro — 20º à esquerda, 1º à direita —, para
 * que mexer no filtro e olhar o card não exijam inverter a leitura no meio do
 * caminho.
 */
async function faixaDePosicoes(ctx, { achadas, contagem, faixa, cores, zonas,
                                      clubes, jogos, pontos, y }) {
  const largura = (CARD.largura - MARGEM * 2 - VAO * (POSICOES - 1)) / POSICOES;
  const posicaoDaColuna = (i) => POSICOES - i;
  const xDaColuna = (i) => MARGEM + i * (largura + VAO);
  const centro = (i) => xDaColuna(i) + largura / 2;

  const yTiras = y, yNumero = y + 28, yContagem = y + 46;
  const topoPilha = y + 62;
  const disponivel = CARD.altura - 96 - topoPilha;

  // Todas as pilhas usam a mesma altura de cartão — é o que faz a mais alta
  // ser a mais numerosa. Ela encolhe até a maior das pilhas caber.
  const maximo = Math.max(1, ...contagem);
  const altura = Math.min(ALTURA_CARTAO,
                          Math.max(ALTURA_MINIMA, disponivel / maximo));
  const cabem = Math.max(1, Math.floor(disponivel / altura));

  // Tira de cor por parte da tabela, cobrindo as colunas daquela parte.
  for (const zona of zonas) {
    const de = xDaColuna(POSICOES - zona.ate);
    const ate = xDaColuna(POSICOES - zona.de) + largura;
    caixa(ctx, de, yTiras, ate - de, 8, cores[zona.nome] ?? COR.cinzaClaro, 4);
  }

  for (let i = 0; i < POSICOES; i++) {
    const pos = posicaoDaColuna(i);
    const n = contagem[pos - 1];
    const cor = cores[zonaDaPosicao(pos, faixa)] ?? COR.cinzaEscuro;

    texto(ctx, ordinal(pos), centro(i), yNumero,
          { tamanho: 15, peso: 800, alinha: "center", cor: n ? cor : COR.cinza });
    texto(ctx, n ? `${n}` : "—", centro(i), yContagem,
          { tamanho: 11, peso: n ? 800 : 400, alinha: "center",
            cor: n ? COR.azulEscuro : COR.cinza });
  }

  linhaH(ctx, MARGEM, CARD.largura - MARGEM, topoPilha - 10, COR.linha);

  // Divisas entre as partes: a linha cai no vão entre duas colunas, não sobre
  // uma delas.
  for (const zona of zonas.slice(1)) {
    const xDivisa = xDaColuna(POSICOES - zona.de + 1) - VAO / 2;
    ctx.save();
    ctx.strokeStyle = COR.azulEscuro;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xDivisa, yTiras - 6);
    ctx.lineTo(xDivisa, topoPilha + disponivel);
    ctx.stroke();
    ctx.restore();
  }

  const pontosDoHover = [];

  for (let i = 0; i < POSICOES; i++) {
    const pos = posicaoDaColuna(i);
    const daPosicao = achadas.filter((c) => c.posFim === pos);
    if (!daPosicao.length) continue;

    const cor = cores[zonaDaPosicao(pos, faixa)] ?? COR.cinzaEscuro;
    const visiveis = daPosicao.length > cabem
      ? daPosicao.slice(0, cabem - 1) : daPosicao;

    for (const [k, campanha] of visiveis.entries()) {
      const yCartao = topoPilha + k * altura;
      await cartaoDaCampanha(ctx, {
        campanha, clubes, cor, x: xDaColuna(i), y: yCartao, largura, altura,
      });
      pontosDoHover.push({
        n: pos,
        x: xDaColuna(i), y: yCartao, l: largura, a: altura - 3,
        ...dicaDaCampanha(campanha, { cor, jogos, pontos }),
      });
    }

    if (daPosicao.length > visiveis.length) {
      const escondidas = daPosicao.slice(visiveis.length);
      const yResto = topoPilha + visiveis.length * altura;
      caixa(ctx, xDaColuna(i), yResto, largura, altura - 3, COR.cinzaClaro, 5);
      texto(ctx, `+${escondidas.length}`, centro(i), yResto + altura / 2 + 2,
            { tamanho: 13, peso: 800, alinha: "center", cor: COR.cinzaEscuro });

      // O que não coube na pilha continua alcançável pela dica.
      pontosDoHover.push({
        n: pos,
        x: xDaColuna(i), y: yResto, l: largura, a: altura - 3,
        itens: escondidas.map((c) => ({
          rotulo: `${nomeBonito(c.equipe)} ${c.ano}`,
          cor, pontos: c.pontosFim,
          detalhe: `${ponto(c.variacao)} de aproveitamento depois do corte`,
        })),
        diferenca: null,
      });
    }
  }

  return {
    pontos: pontosDoHover, unidade: "posição", eixo: "caixa",
    topo: yTiras, alturaPlot: disponivel + (topoPilha - yTiras),
    x0: MARGEM, x1: CARD.largura - MARGEM, largura: largura / 2 + VAO / 2,
  };
}

const pct = (v) => `${(v * 100).toFixed(1).replace(".", ",")}%`;
const ponto = (v) => (v === null ? "sem variação"
  : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(0)}%`);

/**
 * O que a dica mostra de uma campanha.
 *
 * "Somou 29 pontos" não diz se ela jogou melhor: 29 em 11 jogos é outra
 * campanha, não a mesma esticada. O que responde isso é o aproveitamento antes
 * e depois do corte, e a variação de um para o outro.
 */
function dicaDaCampanha(campanha, { cor, jogos, pontos }) {
  const melhorou = campanha.variacao === null ? 0 : campanha.variacao;
  return {
    itens: [{
      rotulo: `${nomeBonito(campanha.equipe)} ${campanha.ano}`,
      cor,
      pontos: campanha.pontosFim,
      detalhe: `${pontos} em ${jogos} jogos · ${campanha.depois} nos `
             + `${campanha.jogosDepois} que faltavam`,
    }],
    diferenca: campanha.aproveitaDepois === null ? null : {
      rotulo: ponto(campanha.variacao),
      texto: `aproveitamento ${pct(campanha.aproveitaAntes)} → `
           + `${pct(campanha.aproveitaDepois)}`,
      cor: melhorou > 0 ? COR.azul : melhorou < 0 ? COR.vermelho : COR.cinzaEscuro,
    },
  };
}

/**
 * Um cartãozinho por campanha: escudo, pontuação final e ano.
 *
 * Fundo branco com borda na cor da parte da tabela. Preenchido, o escudo
 * precisava de uma pastilha clara atrás para não sumir sobre o vermelho — e o
 * resultado era um escudo dentro de um caixote branco dentro de um cartão
 * colorido. A borda resolve com uma caixa a menos.
 *
 * Dois arranjos, conforme a altura que a pilha permitiu. Alto, o conteúdo
 * empilha e usa a largura inteira. Baixo, o escudo vai para a esquerda e o
 * texto para a direita.
 */
async function cartaoDaCampanha(ctx, { campanha, clubes, cor, x, y, largura, altura }) {
  const alto = altura - 3;
  caixa(ctx, x, y, largura, alto, COR.branco, 5);
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, largura - 2, alto - 2, 5);
  ctx.stroke();
  ctx.restore();

  const escudo = await imagem(clubes[campanha.equipe]?.escudo);

  if (alto >= 50) {
    const lado = Math.min(30, alto * 0.42, largura * 0.5);
    desenharEscudo(ctx, escudo, x + (largura - lado) / 2, y + 6, lado);

    const corpo = Math.min(17, (alto - lado - 14) * 0.62);
    texto(ctx, campanha.pontosFim, x + largura / 2, y + 8 + lado + corpo,
          { tamanho: corpo, peso: 800, alinha: "center", cor });
    texto(ctx, campanha.ano, x + largura / 2, y + 9 + lado + corpo * 1.82,
          { tamanho: corpo * .68, peso: 700, alinha: "center",
            cor: COR.cinzaEscuro });
    return;
  }

  const lado = Math.max(14, Math.min(alto - 8, largura * 0.32));
  desenharEscudo(ctx, escudo, x + 5, y + (alto - lado) / 2, lado);

  const xTexto = x + 5 + lado + 5;
  const corpo = Math.max(10, Math.min(13, alto * 0.42));
  texto(ctx, campanha.pontosFim, xTexto, y + alto / 2 - 1,
        { tamanho: corpo, peso: 800, cor });
  texto(ctx, campanha.ano, xTexto, y + alto / 2 + corpo * .82,
        { tamanho: corpo * .7, peso: 700, cor: COR.cinzaEscuro });
}
