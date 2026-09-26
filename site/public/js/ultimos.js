/**
 * As classificações por "últimos X jogos", lado a lado.
 *
 * Uma tabela de pontos corridos conta o campeonato inteiro, e por isso demora
 * a mudar: um clube que ganhou seis seguidos ainda aparece perto de onde
 * estava. As colunas desta tela são a mesma classificação com a memória cada
 * vez mais curta — dez jogos, nove, oito — até a última rodada, em que só o
 * jogo mais recente conta. Lendo da direita para a esquerda, vê-se de onde o
 * clube vem; da esquerda para a direita, para onde ele está indo.
 *
 * "Últimos X" é cronológico e por equipe: são os X jogos mais recentes de
 * **cada** clube, que podem ser de rodadas diferentes dos X do vizinho quando
 * há jogo adiado. É o que o motor faz com o filtro `ultimos`.
 *
 * Sem `import` nenhum, para `site/testes` carregar no Node.
 */

/** Quantas colunas de recorte a tela desenha, no máximo. */
export const MAXIMO = 10;

/** Quantos jogos a edição já produziu para o clube que mais jogou. */
export function jogosDaEdicao(tabela) {
  return (tabela ?? []).reduce((maior, c) => Math.max(maior, c.j ?? 0), 0);
}

/**
 * Os recortes a desenhar, na ordem da esquerda para a direita.
 *
 * A coluna da direita é a classificação inteira, então o maior recorte tem de
 * ser menor do que a edição: com quatro rodadas jogadas, "últimos 4" seria a
 * própria tabela ao lado dela mesma. Daí o `jogos - 1`, que só aparece no
 * começo do campeonato — passados onze jogos, o teto de dez é que manda.
 */
export function recortesDeUltimos(jogos, maximo = MAXIMO) {
  const maior = Math.min(maximo, Math.max(0, (jogos ?? 0) - 1));
  return Array.from({ length: maior }, (_, i) => i + 1);
}

/**
 * Em que posição o clube está em cada coluna.
 *
 * `null` onde ele não aparece — clube sem jogo nenhum no recorte continua na
 * tabela, mas uma coluna de outra edição não teria por que tê-lo.
 */
export function posicoesDoClube(colunas, equipe) {
  return (colunas ?? []).map((coluna) => {
    const linha = (coluna.tabela ?? []).find((c) => c.equipe === equipe);
    return linha ? linha.pos : null;
  });
}

/**
 * Quantas posições o recorte move o clube em relação à tabela cheia.
 *
 * Positivo é subir, porque subir na tabela é diminuir o número da posição — o
 * sinal inverte para que o número diga o que se espera dele.
 */
export function variacaoDaPosicao(posicaoAtual, posicaoNoRecorte) {
  if (posicaoAtual == null || posicaoNoRecorte == null) return null;
  return posicaoAtual - posicaoNoRecorte;
}

/**
 * O que a linha da dica precisa saber sobre o clube naquele recorte.
 *
 * Mora aqui, e não no card, porque é conta: o card só escreve.
 */
export function resumoDoRecorte(linha, posicaoAtual) {
  if (!linha) return null;
  return {
    equipe: linha.equipe,
    pos: linha.pos,
    pts: linha.pts,
    j: linha.j,
    aproveitamento: linha.j > 0 ? linha.pts / (3 * linha.j) : null,
    variacao: variacaoDaPosicao(posicaoAtual, linha.pos),
  };
}
