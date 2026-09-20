/**
 * Card: quem já esteve nesta situação, e onde terminou.
 *
 * A pergunta "46 pontos em 27 jogos é bom?" não se responde com projeção de
 * aproveitamento — projeção assume que o resto do campeonato vai ser igual ao
 * começo, que é justamente o que ninguém sabe. Responde-se com precedente: as
 * campanhas que já passaram exatamente por ali, e onde elas foram parar.
 *
 * Cada linha parte do mesmo ponto — a pontuação do corte — e se estica até a
 * pontuação final daquela campanha. O leque que se forma é a resposta: quanto
 * dessa situação ainda estava em aberto.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import {
  campanhasSemelhantes, distribuicaoPorPosicao, resumoDasSemelhantes,
  zonaDaPosicao,
} from "/js/similares.js";

const COLUNAS = 3;
const VAO_COLUNA = 16;
const LINHAS_MAX = 14;
const ALTURA_LISTA = 330;   // o espaço reservado à lista, cheia ou não
const POSICOES = 20;

const num = (v) => v.toFixed(1).replace(".", ",");
const ordinal = (p) => `${p}º`;

/** Verde acima da faixa, azul dentro, vermelho abaixo. */
const CORES_ZONA = {
  acima: { cheio: COR.verde, lavado: COR.verdeLavado },
  dentro: { cheio: COR.azul, lavado: COR.azulLavado },
  abaixo: { cheio: COR.vermelho, lavado: COR.vermelhoLavado },
};

export function montarCartao(estado) {
  const { serie, jogos, pontos, faixa, clubes, campanhas, referencia } = estado;
  if (!campanhas || !jogos || pontos === null || pontos === undefined) return null;

  const achadas = campanhasSemelhantes(campanhas, { serie, jogos, pontos });
  const resumo = resumoDasSemelhantes(achadas, faixa);
  const contagem = distribuicaoPorPosicao(achadas, POSICOES);

  // "Alcançaram" é quem terminou na faixa ou melhor que ela, então o rótulo
  // fala do limite de baixo. Dizer "entre 1º e 4º ou melhor" seria bobagem:
  // não existe melhor que o 1º.
  const rotuloFaixa = `terminaram em ${ordinal(faixa.pior)} ou melhor`;

  return {
    titulo: `Campanhas com ${pontos} pontos em ${jogos} `
          + `${jogos === 1 ? "jogo" : "jogos"} na Série ${serie}`,
    subtitulo: "",
    arquivo: `semelhantes-${serie}-${pontos}pts-${jogos}jogos`,
    numeros: [
      { valor: resumo.total, nome: "campanhas nesta situação", destaque: "azul" },
      { valor: resumo.total ? num(resumo.mediaFim) : "—",
        nome: "pontuação final média", destaque: "escuro" },
      { valor: resumo.total ? resumo.alcancaram : "—", nome: rotuloFaixa },
    ],
    nota: referencia
      ? `Entre as ${referencia.edicoes} edições encerradas da Série ${serie} `
        + `(${referencia.ano_primeiro}–${referencia.ano_ultimo}). A edição em `
        + `andamento não entra: uma campanha sem desfecho não conta o que `
        + `aconteceu com ela.`
      : "",
    corpo: async (ctx, y) => {
      if (!achadas.length) {
        semPrecedente(ctx, { y, jogos, pontos, serie });
        return;
      }
      const yLista = await listaDeCampanhas(ctx, {
        achadas, clubes, faixa, pontos, y,
      });
      linhaH(ctx, MARGEM, CARD.largura - MARGEM, yLista + 14, COR.linha);

      // O histograma ocupa o que a lista não usou. Com duas campanhas no
      // conjunto, a lista cabe numa linha e o gráfico cresce para preencher o
      // card em vez de deixar um vão no meio.
      const yGrafico = yLista + 44;
      histogramaDePosicoes(ctx, {
        contagem, faixa, total: resumo.total, y: yGrafico,
        alturaPlot: Math.min(240, Math.max(108, CARD.altura - 96 - yGrafico - 62)),
      });
    },
  };
}

function semPrecedente(ctx, { y, jogos, pontos, serie }) {
  texto(ctx, "Nenhuma campanha encerrada da série chegou a esse ponto.",
        MARGEM, y + 70, { tamanho: 26, peso: 700, cor: COR.azul,
                          familia: "Bree Serif" });
  texto(ctx, `${pontos} pontos em ${jogos} jogos é inédito na Série ${serie} `
           + `no recorte que o BI cobre — não há com o que comparar.`,
        MARGEM, y + 108, { tamanho: 16, cor: COR.cinzaTexto });
}

/* --------------------------------------------------------------- lista */
async function listaDeCampanhas(ctx, { achadas, clubes, faixa, pontos, y }) {
  const larguraColuna =
    (CARD.largura - MARGEM * 2 - VAO_COLUNA * (COLUNAS - 1)) / COLUNAS;
  const cabem = COLUNAS * LINHAS_MAX;
  const mostradas = achadas.slice(0, cabem);

  // Poucas campanhas: linhas mais altas, para a lista não virar um fiapo no
  // alto do card. Muitas: a altura mínima que ainda se lê.
  const linhasPorColuna = Math.min(LINHAS_MAX,
                                   Math.ceil(mostradas.length / COLUNAS));
  const alturaLinha = Math.min(40, Math.max(23,
                               ALTURA_LISTA / Math.max(linhasPorColuna, 1)));

  const maximo = Math.max(...achadas.map((c) => c.pontosFim), pontos + 1);
  const xBarra = 128, larguraBarra = larguraColuna - 128 - 118;
  const posicaoNaBarra = (valor) =>
    ((valor - pontos) / (maximo - pontos)) * larguraBarra;

  texto(ctx, `cada barra parte dos ${pontos} pontos do corte e vai até a `
           + `pontuação final — ordenadas da melhor para a pior`,
        MARGEM, y + 12, { tamanho: 12.5, cor: COR.cinzaEscuro });

  const yTopo = y + 34;
  for (const [i, campanha] of mostradas.entries()) {
    const coluna = Math.floor(i / linhasPorColuna);
    const linha = i % linhasPorColuna;
    const x = MARGEM + coluna * (larguraColuna + VAO_COLUNA);
    // O conteúdo tem 18px; centralizá-lo na linha é o que evita que uma lista
    // curta, com linhas altas, fique com tudo colado no topo de cada faixa.
    const yLinha = yTopo + linha * alturaLinha + (alturaLinha - 18) / 2;

    const zona = zonaDaPosicao(campanha.posFim, faixa);
    const cores = CORES_ZONA[zona];

    const escudo = await imagem(clubes[campanha.equipe]?.escudo);
    desenharEscudo(ctx, escudo, x, yLinha, 17);
    texto(ctx, cortar(ctx, `${nomeBonito(campanha.equipe)} ${campanha.ano}`,
                      xBarra - 24, 11.5, 700),
          x + 22, yLinha + 13, { tamanho: 11.5, peso: 700, cor: COR.azulEscuro });

    // Trilho claro até o máximo, preenchimento até onde a campanha chegou.
    caixa(ctx, x + xBarra, yLinha + 5, larguraBarra, 7, COR.cinzaClaro, 3.5);
    const cheio = Math.max(3, posicaoNaBarra(campanha.pontosFim));
    caixa(ctx, x + xBarra, yLinha + 5, cheio, 7, cores.cheio, 3.5);

    texto(ctx, campanha.pontosFim, x + xBarra + larguraBarra + 44, yLinha + 13,
          { tamanho: 13, peso: 800, cor: COR.azulEscuro, alinha: "right" });

    const xTag = x + larguraColuna - 46;
    caixa(ctx, xTag, yLinha + 1, 46, 17, cores.cheio, 5);
    texto(ctx, ordinal(campanha.posFim), xTag + 23, yLinha + 14,
          { tamanho: 11.5, peso: 800, cor: COR.branco, alinha: "center" });
  }

  let yFim = yTopo + linhasPorColuna * alturaLinha;

  if (achadas.length > cabem) {
    texto(ctx, `e mais ${achadas.length - cabem} campanhas — todas entram nas `
             + `contas e no gráfico abaixo`,
          MARGEM, yFim + 16, { tamanho: 12, peso: 700, cor: COR.cinzaEscuro });
    yFim += 22;
  }
  return yFim;
}

/* ---------------------------------------------------------- histograma */
function histogramaDePosicoes(ctx, { contagem, faixa, total, y, alturaPlot }) {
  texto(ctx, "onde essas campanhas terminaram", MARGEM, y,
        { tamanho: 10.5, peso: 700, maiuscula: true, espaco: .9,
          cor: COR.cinzaEscuro });

  const largura = CARD.largura - MARGEM * 2;
  const topo = y + 20;
  const base = topo + alturaPlot;
  const passo = largura / POSICOES;
  const centro = (pos) => MARGEM + (pos - 0.5) * passo;
  const maximo = Math.max(1, ...contagem);
  const alturaDaBarra = (n) => (n / maximo) * alturaPlot;

  // Fundo lavado atrás da faixa destacada: diz qual era o objetivo antes de
  // qualquer barra ser lida.
  const de = centro(faixa.melhor) - passo / 2;
  const ate = centro(faixa.pior) + passo / 2;
  caixa(ctx, de, topo - 6, ate - de, alturaPlot + 12, COR.azulLavado, 6);

  linhaH(ctx, MARGEM, CARD.largura - MARGEM, base, COR.cinza);

  for (let pos = 1; pos <= POSICOES; pos++) {
    const n = contagem[pos - 1];
    const zona = zonaDaPosicao(pos, faixa);
    const cores = CORES_ZONA[zona];
    const larguraBarra = Math.min(38, passo * 0.62);

    if (n > 0) {
      caixa(ctx, centro(pos) - larguraBarra / 2, base - alturaDaBarra(n),
            larguraBarra, alturaDaBarra(n), cores.cheio, 3);
      texto(ctx, n, centro(pos), base - alturaDaBarra(n) - 8,
            { tamanho: 12.5, peso: 800, alinha: "center", cor: cores.cheio });
      // A fatia do total, que é o que se cita: "1 em cada 4 terminou em 4º".
      texto(ctx, `${Math.round((n / total) * 100)}%`, centro(pos), base + 32,
            { tamanho: 9.5, peso: 700, alinha: "center", cor: COR.cinzaEscuro });
    }
    texto(ctx, pos, centro(pos), base + 18,
          { tamanho: 11.5, peso: 700, alinha: "center",
            cor: n > 0 ? COR.azulEscuro : COR.cinza });
  }
}
