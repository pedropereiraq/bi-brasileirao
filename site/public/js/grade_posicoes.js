/**
 * Quem esteve em cada posição, rodada a rodada.
 *
 * A tabela de hoje diz onde os clubes estão; esta grade diz por onde eles
 * passaram. Lida na horizontal, cada linha é um lugar da tabela e conta quem
 * dormiu ali em cada rodada — o 1º que trocou de dono seis vezes, o 17º que
 * teve o mesmo ocupante o campeonato inteiro. Lida na vertical, cada coluna é
 * uma rodada, e a coluna inteira é a classificação daquele dia.
 *
 * A fonte é a grade de `posicoes.json`, já ordenada pelos desempates do motor:
 * `grade[rodada - 1][posicao - 1]` é `[índice do clube, pontos]`.
 *
 * Sem `import` nenhum, para `site/testes` carregar no Node.
 */

/** A grade escolhida pela chave do tapetão. */
const gradeDaEdicao = (edicao, semTapetao) =>
  (semTapetao && edicao?.grade_st ? edicao.grade_st : edicao?.grade);

/**
 * A grade em nomes: uma linha por rodada, uma casa por posição.
 *
 * Devolve o clube e a pontuação dele, porque a dica do card precisa dos dois e
 * varrer a grade de novo para achar o ponto seria varrer duas vezes.
 */
export function gradeDePosicoes(edicao, { semTapetao } = {}) {
  const grade = gradeDaEdicao(edicao, semTapetao);
  if (!grade?.length) return [];
  return grade.map((coluna, i) => ({
    rodada: i + 1,
    casas: coluna.map(([indice, pontos], p) => ({
      posicao: p + 1,
      equipe: edicao.clubes[indice],
      pontos,
    })),
  }));
}

/** O intervalo pedido, sempre do menor número ao maior. */
export function faixaOrdenada(faixa) {
  if (!faixa) return null;
  const de = Math.min(faixa.de, faixa.ate);
  const ate = Math.max(faixa.de, faixa.ate);
  return { de, ate };
}

/**
 * Quantas rodadas cada clube passou naquelas posições.
 *
 * Quem nunca esteve lá fica de fora: a lista responde quem ocupou a faixa, e
 * uma fila de zeros só empurraria os nomes que interessam para baixo.
 *
 * O desempate é alfabético pelo próprio nome — dois clubes com oito rodadas no
 * G4 empataram mesmo, e qualquer outro critério inventaria uma diferença.
 */
export function rodadasNasPosicoes(grade, faixa) {
  const limites = faixaOrdenada(faixa);
  if (!limites || !grade?.length) return [];

  const conta = new Map();
  for (const { casas } of grade) {
    for (const casa of casas) {
      if (casa.posicao < limites.de || casa.posicao > limites.ate) continue;
      conta.set(casa.equipe, (conta.get(casa.equipe) ?? 0) + 1);
    }
  }

  return [...conta.entries()]
    .map(([equipe, rodadas]) => ({ equipe, rodadas }))
    .sort((a, b) => b.rodadas - a.rodadas || a.equipe.localeCompare(b.equipe));
}

/**
 * Por onde um clube andou: a posição dele em cada rodada.
 *
 * `null` na rodada em que ele não aparece — a grade de uma edição em curso
 * pode estar mais curta do que a régua do card.
 */
export function caminhoDoClube(grade, equipe) {
  return (grade ?? []).map(({ rodada, casas }) => {
    const casa = casas.find((c) => c.equipe === equipe);
    return { rodada, posicao: casa ? casa.posicao : null,
             pontos: casa ? casa.pontos : null };
  });
}

/**
 * Quantas posições diferentes a faixa viu, e quantas trocas de dono.
 *
 * Serve ao texto que explica a lista: "sete clubes passaram pelo G4" é mais
 * informativo do que a lista sozinha.
 */
export function resumoDaFaixa(ranking) {
  const lista = ranking ?? [];
  return {
    clubes: lista.length,
    rodadas: lista.reduce((soma, l) => soma + l.rodadas, 0),
  };
}
