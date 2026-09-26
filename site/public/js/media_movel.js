/**
 * A média móvel dos últimos X jogos.
 *
 * A tabela conta o campeonato inteiro e por isso demora a mudar; a média móvel
 * conta só a janela mais recente e muda depressa. É com ela que se responde
 * "como o time está **agora**" sem depender da memória de quem fala.
 *
 * Cada ponto do gráfico é uma janela: o mais à direita são os últimos X jogos,
 * o anterior são os X jogos terminando um jogo antes, e assim por diante. A
 * janela tem sempre o mesmo tamanho — por isso os pontos se comparam entre si,
 * e por isso o gráfico só começa no X-ésimo jogo.
 *
 * O índice é o **jogo**, e não a rodada: a janela é de jogos disputados, na
 * ordem em que aconteceram. Jogo adiado entra na janela em que foi jogado, que
 * é quando ele de fato mudou a fase do time.
 *
 * Trabalha sobre a campanha já montada — `{ n, jogo, realizado }` em ordem
 * cronológica — e não tem `import` nenhum, para `site/testes` carregar no Node.
 */
const PONTOS = { T: 3, E: 1, D: 0 };

/** As duas leituras da mesma janela. */
export const MODOS = {
  pontuacao: { nome: "pontos por jogo", teto: 3 },
  aproveitamento: { nome: "aproveitamento", teto: 1 },
};

/** Os jogos já disputados, com o que cada um rendeu. */
export function pontosPorJogo(campanha) {
  return (campanha ?? [])
    .filter((passo) => passo.realizado)
    .map((passo, i) => ({
      n: i + 1,
      rodada: passo.jogo?.rodada ?? null,
      jogo: passo.jogo,
      pontos: PONTOS[passo.jogo?.resultado] ?? 0,
    }));
}

/**
 * Uma janela por jogo, do X-ésimo em diante.
 *
 * `media` é sempre em pontos por jogo: é a unidade que se compara entre
 * janelas de tamanhos diferentes, e o aproveitamento é ela dividida por três.
 * Devolve vazio quando não há jogos suficientes — meia janela não é uma
 * janela menor, é uma conta que não existe.
 */
export function mediaMovel(jogos, janela) {
  const lista = jogos ?? [];
  if (!janela || janela < 1 || lista.length < janela) return [];

  const saida = [];
  let soma = 0;
  for (const [i, jogo] of lista.entries()) {
    soma += jogo.pontos;
    if (i >= janela) soma -= lista[i - janela].pontos;
    if (i < janela - 1) continue;
    saida.push({
      ate: jogo.n,
      de: jogo.n - janela + 1,
      pontos: soma,
      media: soma / janela,
      jogos: lista.slice(i - janela + 1, i + 1),
    });
  }
  return saida;
}

/** O valor que a tela desenha, na leitura escolhida. */
export const valorDaJanela = (janela, modo) =>
  (modo === "aproveitamento" ? janela.media / 3 : janela.media);

/**
 * Os extremos da série e o ponto de hoje.
 *
 * `primeiro` entre os empatados em cada extremo: quando o time repetiu a
 * melhor fase, o que interessa é quando ela começou.
 */
export function resumoDaSerie(serie) {
  const lista = serie ?? [];
  if (!lista.length) return null;

  const melhor = lista.reduce((m, j) => (j.media > m.media ? j : m), lista[0]);
  const pior = lista.reduce((m, j) => (j.media < m.media ? j : m), lista[0]);
  return {
    atual: lista[lista.length - 1],
    melhor,
    pior,
    media: lista.reduce((s, j) => s + j.media, 0) / lista.length,
  };
}

/**
 * A régua de uma posição: quanto ela costuma render por jogo.
 *
 * `estatisticas` é a média de pontos daquela posição ao fim das edições
 * encerradas; dividida pelas rodadas, ela vira a mesma unidade da média móvel
 * e pode virar uma linha no gráfico. É o que responde "esta fase, mantida,
 * daria que lugar?".
 */
export function referenciaDaPosicao(estatisticas, posicao, rodadas) {
  const linha = (estatisticas ?? [])[posicao - 1];
  if (!linha || linha.media === null || !rodadas) return null;
  return { posicao, pontos: linha.media, media: linha.media / rodadas };
}
