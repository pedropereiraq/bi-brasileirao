/**
 * Campanhas que já estiveram na mesma situação, e o que aconteceu com elas.
 *
 * "46 pontos em 27 jogos" não é um número isolado: é um ponto que dezenas de
 * campanhas já ocuparam nas edições anteriores. O que essa pontuação vale se
 * responde olhando onde essas campanhas terminaram — não com uma projeção de
 * aproveitamento, que assume que o resto do campeonato será igual ao começo.
 *
 * A comparação é pelo n-ésimo **jogo**, nunca pela rodada. Rodada não é tempo:
 * um clube com um jogo adiado tem menos jogos do que a rodada sugere, e casar
 * campanhas de anos diferentes por rodada compararia situações diferentes.
 *
 * Campanha sem desfecho fica de fora. A edição em andamento está no arquivo
 * porque é dela que sai o ponto de partida, mas incluí-la na resposta seria
 * dizer que aconteceu algo com ela — e não aconteceu ainda.
 *
 * Módulo sem dependência nenhuma de propósito: assim `site/testes` carrega no
 * Node e cobra a regra.
 */

/** Onde uma posição final cai em relação à faixa destacada. */
export function zonaDaPosicao(posicao, { melhor, pior }) {
  if (posicao < melhor) return "acima";
  if (posicao > pior) return "abaixo";
  return "dentro";
}

/**
 * Toda campanha encerrada da série que tinha exatamente `pontos` no `jogos`-
 * ésimo jogo. Ordenadas da melhor pontuação final para a pior.
 */
export function campanhasSemelhantes(dados, { serie, jogos, pontos }) {
  const anos = dados?.series?.[serie] ?? {};
  const achadas = [];

  for (const [ano, clubes] of Object.entries(anos)) {
    for (const [equipe, posFim, acumulado] of clubes) {
      if (posFim === null) continue;
      // Quem jogou menos que isso nunca esteve nesta situação.
      if (acumulado.length < jogos) continue;
      if (acumulado[jogos - 1] !== pontos) continue;

      achadas.push({
        equipe,
        ano: Number(ano),
        posFim,
        pontosFim: acumulado[acumulado.length - 1],
        jogosTotais: acumulado.length,
        // O que ela ainda somou depois do corte, que é a resposta em si.
        depois: acumulado[acumulado.length - 1] - pontos,
      });
    }
  }

  achadas.sort((a, b) =>
    b.pontosFim - a.pontosFim || a.posFim - b.posFim
    || a.ano - b.ano || a.equipe.localeCompare(b.equipe, "pt-BR"));
  return achadas;
}

/** Quantas campanhas terminaram em cada posição, do 1º ao `total`. */
export function distribuicaoPorPosicao(achadas, total = 20) {
  const contagem = Array.from({ length: total }, () => 0);
  for (const campanha of achadas) {
    if (campanha.posFim >= 1 && campanha.posFim <= total) {
      contagem[campanha.posFim - 1] += 1;
    }
  }
  return contagem;
}

/** O balanço do conjunto: quantas, onde terminaram, quanto somaram depois. */
export function resumoDasSemelhantes(achadas, faixa) {
  const zonas = { acima: 0, dentro: 0, abaixo: 0 };
  for (const campanha of achadas) zonas[zonaDaPosicao(campanha.posFim, faixa)] += 1;

  const media = (valores) => valores.length
    ? valores.reduce((soma, v) => soma + v, 0) / valores.length : null;

  return {
    total: achadas.length,
    ...zonas,
    // "Dentro ou acima" é o que responde à pergunta do torcedor: a faixa
    // destacada é um objetivo, e terminar melhor que ela também o cumpre.
    alcancaram: zonas.dentro + zonas.acima,
    mediaFim: media(achadas.map((c) => c.pontosFim)),
    mediaDepois: media(achadas.map((c) => c.depois)),
    melhorFim: achadas.length ? Math.max(...achadas.map((c) => c.pontosFim)) : null,
    piorFim: achadas.length ? Math.min(...achadas.map((c) => c.pontosFim)) : null,
  };
}
