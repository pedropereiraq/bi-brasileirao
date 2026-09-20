/**
 * Card: quem já esteve nesta situação, e onde terminou.
 *
 * A pergunta "46 pontos em 27 jogos é bom?" não se responde com projeção de
 * aproveitamento — projeção assume que o resto do campeonato vai ser igual ao
 * começo, que é justamente o que ninguém sabe. Responde-se com precedente: as
 * campanhas que já passaram exatamente por ali, e onde elas foram parar.
 *
 * O assunto do card é a posição final, então ele é organizado por ela: a
 * tabela deitada à esquerda, com o 1º no alto, e a lista ordenada de cima para
 * baixo. A pontuação final continua ali, mas como detalhe de cada linha — 67
 * pontos valeram o 2º lugar em 2006 e o 4º em 2025, e é a posição que compara.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import {
  campanhasSemelhantes, distribuicaoPorPosicao, resumoDasSemelhantes,
  zonaDaPosicao, zonasDaFaixa,
} from "/js/similares.js";

const POSICOES = 20;
const COLUNAS = 3;
const VAO_COLUNA = 28;
const ALTURA_LINHA = 26;

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

      const topo = y + 116, alturaPlot = POSICOES * ALTURA_LINHA;
      const larguraTabela = 330;

      const pontosDoHover = tabelaDeitada(ctx, {
        contagem, achadas, faixa, cores, zonas,
        x: MARGEM, largura: larguraTabela, topo,
      });

      await listaDeCampanhas(ctx, {
        achadas, clubes, faixa, cores, pontos,
        x: MARGEM + larguraTabela + 40,
        largura: CARD.largura - MARGEM - (MARGEM + larguraTabela + 40),
        topo,
      });

      spec.hover = {
        pontos: pontosDoHover, eixo: "y", unidade: "posição",
        topo, alturaPlot, largura: ALTURA_LINHA / 2,
        x0: MARGEM, x1: MARGEM + larguraTabela,
      };
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
 * Eles contextualizam o card; o assunto é a tabela e a lista. Blocos de 96px
 * tomavam um oitavo da altura para dizer três coisas curtas.
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

/* ------------------------------------------------- a tabela deitada */
/**
 * As 20 posições empilhadas, o 1º no alto, com a barra do que aconteceu.
 *
 * Deitada porque é assim que uma tabela de campeonato se lê: de cima para
 * baixo. Em pé, com as posições no eixo x, era preciso traduzir "coluna 4"
 * para "quarto lugar" a cada olhada.
 */
function tabelaDeitada(ctx, { contagem, achadas, faixa, cores, zonas, x, largura, topo }) {
  texto(ctx, "onde terminaram", x, topo - 16,
        { tamanho: 10.5, peso: 700, maiuscula: true, espaco: .9,
          cor: COR.cinzaEscuro });

  const xBarra = x + 38, larguraBarra = largura - 38 - 44;

  // Uma tira colorida por parte da tabela, na margem: é o que torna a divisa
  // visível de longe, antes de qualquer barra ser lida.
  for (const zona of zonas) {
    const de = topo + (zona.de - 1) * ALTURA_LINHA;
    const ate = topo + zona.ate * ALTURA_LINHA;
    caixa(ctx, x, de + 1, 4, ate - de - 2,
          cores[zona.nome] ?? COR.cinzaClaro, 2);
  }
  const maximo = Math.max(1, ...contagem);
  const meio = (pos) => topo + (pos - 0.5) * ALTURA_LINHA;
  const pontos = [];

  for (let pos = 1; pos <= POSICOES; pos++) {
    const n = contagem[pos - 1];
    const cor = cores[zonaDaPosicao(pos, faixa)] ?? COR.cinzaEscuro;
    const yLinha = meio(pos);

    texto(ctx, pos, x + 28, yLinha + 4,
          { tamanho: 12, peso: n ? 800 : 400, alinha: "right",
            cor: n ? COR.azulEscuro : COR.cinza });

    if (n) {
      const comprimento = Math.max(6, (n / maximo) * larguraBarra);
      caixa(ctx, xBarra, yLinha - 8, comprimento, 16, cor, 4);
      texto(ctx, n, xBarra + comprimento + 8, yLinha + 4,
            { tamanho: 12, peso: 800, cor });

      pontos.push({
        n: pos, y: yLinha, x: xBarra,
        itens: achadas.filter((c) => c.posFim === pos).map((c) => ({
          rotulo: `${nomeBonito(c.equipe)} ${c.ano}`,
          cor,
          pontos: c.pontosFim,
          detalhe: `${c.depois >= 0 ? "+" : ""}${c.depois} pontos depois do corte`,
        })),
        diferenca: null,
      });
    } else {
      linhaH(ctx, xBarra, xBarra + 10, yLinha, COR.cinzaClaro, 2);
    }
  }

  // As divisas entre as partes da tabela, que é o que o filtro define.
  for (const zona of zonas.slice(1)) {
    const yDivisa = topo + (zona.de - 1) * ALTURA_LINHA;
    ctx.save();
    ctx.strokeStyle = COR.azulEscuro;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, yDivisa);
    ctx.lineTo(x + largura, yDivisa);
    ctx.stroke();
    ctx.restore();

    const rotulo = `a partir do ${ordinal(zona.de)}`;
    ctx.save();
    ctx.font = '800 9px "Assistant", sans-serif';
    const largo = ctx.measureText(rotulo.toUpperCase()).width + rotulo.length * .6 + 14;
    ctx.restore();
    caixa(ctx, x + largura - largo, yDivisa - 8, largo, 16, COR.azulEscuro, 4);
    texto(ctx, rotulo, x + largura - largo / 2, yDivisa + 3,
          { tamanho: 9, peso: 800, alinha: "center", cor: COR.branco,
            maiuscula: true, espaco: .6 });
  }

  return pontos;
}

/* --------------------------------------------------------------- lista */
/**
 * As campanhas, na ordem da posição final, alinhadas com a tabela ao lado.
 *
 * O número de colunas sai da quantidade, e não o contrário: 13 campanhas cabem
 * numa coluna só, e aí ela ocupa a largura inteira — a barra fica longa e
 * precisa, e sobra espaço para dizer quanto cada uma somou depois do corte.
 * Com 40, são três colunas estreitas e esse detalhe sai.
 */
async function listaDeCampanhas(ctx, { achadas, clubes, faixa, cores, pontos,
                                       x, largura, topo }) {
  const cabem = COLUNAS * POSICOES;
  const mostradas = achadas.slice(0, cabem);
  const colunas = Math.max(1, Math.ceil(mostradas.length / POSICOES));
  const larguraColuna = (largura - VAO_COLUNA * (colunas - 1)) / colunas;
  const linhasPorColuna = Math.ceil(mostradas.length / colunas);
  // A lista ocupa exatamente a altura da tabela ao lado: com 13 campanhas as
  // linhas ficam altas e as duas metades do card terminam juntas, em vez de
  // uma parar no meio do caminho.
  const alturaLinha = Math.min(40, Math.max(ALTURA_LINHA,
    (POSICOES * ALTURA_LINHA) / Math.max(linhasPorColuna, 1)));

  texto(ctx, "as campanhas, da melhor posição para a pior", x, topo - 16,
        { tamanho: 10.5, peso: 700, maiuscula: true, espaco: .9,
          cor: COR.cinzaEscuro });

  const maximo = Math.max(...achadas.map((c) => c.pontosFim), pontos + 1);

  // A tag de posição para bem antes da borda: colada nela, encostava no escudo
  // da coluna seguinte e as duas se liam como uma coisa só.
  const larguraTag = 42, recuoTag = 20;
  const xTag = larguraColuna - larguraTag - recuoTag;
  const xPontos = xTag - 16;
  const larguraNome = Math.min(200, Math.max(96, larguraColuna * 0.28));
  const xBarra = 24 + larguraNome + 10;

  // Cabe dizer o que ela somou depois do corte? Só quando a coluna é larga.
  const mostrarDepois = larguraColuna > 460;
  const xDepois = xPontos - 46;
  const fimBarra = (mostrarDepois ? xDepois - 52 : xPontos - 46);
  const larguraBarra = Math.max(40, fimBarra - xBarra);

  for (const [i, campanha] of mostradas.entries()) {
    const coluna = Math.floor(i / linhasPorColuna);
    const linha = i % linhasPorColuna;
    const xCol = x + coluna * (larguraColuna + VAO_COLUNA);
    const yLinha = topo + linha * alturaLinha + (alturaLinha - 18) / 2;
    const cor = cores[zonaDaPosicao(campanha.posFim, faixa)] ?? COR.cinzaEscuro;

    const escudo = await imagem(clubes[campanha.equipe]?.escudo);
    desenharEscudo(ctx, escudo, xCol, yLinha, 17);
    texto(ctx, cortar(ctx, `${nomeBonito(campanha.equipe)} ${campanha.ano}`,
                      larguraNome, 11.5, 700),
          xCol + 24, yLinha + 13, { tamanho: 11.5, peso: 700, cor: COR.azulEscuro });

    caixa(ctx, xCol + xBarra, yLinha + 5, larguraBarra, 7, COR.cinzaClaro, 3.5);
    const cheio = Math.max(3,
      ((campanha.pontosFim - pontos) / (maximo - pontos)) * larguraBarra);
    caixa(ctx, xCol + xBarra, yLinha + 5, cheio, 7, cor, 3.5);

    if (mostrarDepois) {
      texto(ctx, `+${campanha.depois}`, xCol + xDepois, yLinha + 13,
            { tamanho: 11.5, peso: 700, cor: COR.cinzaEscuro, alinha: "right" });
    }
    texto(ctx, campanha.pontosFim, xCol + xPontos, yLinha + 13,
          { tamanho: 13, peso: 800, cor: COR.azulEscuro, alinha: "right" });

    caixa(ctx, xCol + xTag, yLinha + 1, larguraTag, 17, cor, 5);
    texto(ctx, ordinal(campanha.posFim), xCol + xTag + larguraTag / 2, yLinha + 14,
          { tamanho: 11.5, peso: 800, cor: COR.branco, alinha: "center" });
  }

  if (mostrarDepois && mostradas.length) {
    texto(ctx, "pts depois do corte", x + xDepois, topo - 16,
          { tamanho: 9, peso: 700, maiuscula: true, espaco: .7,
            cor: COR.cinzaEscuro, alinha: "right" });
  }

  if (achadas.length > cabem) {
    texto(ctx, `e mais ${achadas.length - cabem} — todas entram nas contas`,
          x, topo + linhasPorColuna * alturaLinha + 18,
          { tamanho: 12, peso: 700, cor: COR.cinzaEscuro });
  }
}
