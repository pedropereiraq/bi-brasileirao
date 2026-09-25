/**
 * A vida de um clube nas tabelas, edição por edição.
 *
 * Duas perguntas diferentes moram aqui. Uma é de percurso: em quantas rodadas,
 * ao longo de vinte anos, aquele clube esteve dentro do recorte que interessa
 * — o G4, o Z4, a metade de cima. A outra é de desfecho: onde ele terminou,
 * ano a ano.
 *
 * A segunda precisa de um eixo que as duas séries dividam, porque a trajetória
 * de quase todo clube brasileiro atravessa as duas. A convenção é a da própria
 * tabela: a Série B mora abaixo da A, então a 1ª da B vem logo depois da 20ª
 * da A. Assim uma queda e um acesso viram degraus no mesmo eixo, e não dois
 * gráficos que ninguém consegue comparar.
 *
 * Módulo sem dependência nenhuma de propósito: recebe trajetórias já montadas
 * e devolve contas, o que deixa `site/testes` carregá-lo no Node.
 */
export const POSICOES_POR_SERIE = 20;

/** A posição no eixo que junta as duas séries. */
export const noEixo = (serie, posicao) =>
  (posicao === null || posicao === undefined ? null
    : serie === "B" ? POSICOES_POR_SERIE + posicao : posicao);

/** O caminho de volta: de um valor do eixo para a série e a posição. */
export const doEixo = (valor) => (valor > POSICOES_POR_SERIE
  ? { serie: "B", posicao: valor - POSICOES_POR_SERIE }
  : { serie: "A", posicao: valor });

/**
 * Quantas rodadas o clube passou dentro do recorte, e quantas fora.
 *
 * "Dentro" inclui a própria posição marcada: marcar o 4º é perguntar pelo G4,
 * e o G4 tem quatro clubes. As primeiras rodadas podem ficar de fora da conta
 * — no começo de campeonato a tabela ainda é ruído, e quem pergunta por
 * regularidade costuma querer descartá-las.
 */
export function contagemDoCorte(trajetorias, { alvo, ignorar = 0 } = {}) {
  const porAno = [];
  let acima = 0;
  let abaixo = 0;

  for (const trajetoria of trajetorias ?? []) {
    if (!trajetoria?.posicoes?.length) {
      porAno.push({ ano: trajetoria?.ano, participou: false,
                    acima: 0, abaixo: 0, total: 0 });
      continue;
    }

    const contadas = trajetoria.posicoes
      .slice(ignorar)
      .filter((p) => p !== null && p !== undefined);
    const dentro = contadas.filter((p) => p <= alvo).length;

    acima += dentro;
    abaixo += contadas.length - dentro;
    porAno.push({
      ano: trajetoria.ano, participou: true,
      acima: dentro, abaixo: contadas.length - dentro, total: contadas.length,
    });
  }

  const total = acima + abaixo;
  return {
    acima, abaixo, total,
    fracao: total ? acima / total : null,
    edicoes: porAno.filter((a) => a.participou).length,
    porAno,
  };
}

/**
 * As posições finais no eixo combinado, prontas para virar linha.
 *
 * Ano sem participação não vira ponto nenhum: a linha tem de abrir um buraco
 * ali, e não fingir que o clube esteve em algum lugar.
 */
export function trilhaFinal(edicoes, { series = ["A", "B"] } = {}) {
  return (edicoes ?? [])
    .filter((e) => e && series.includes(e.serie) && e.posicao)
    .map((e) => ({
      ano: e.ano, serie: e.serie, posicao: e.posicao,
      eixo: noEixo(e.serie, e.posicao),
      encerrada: e.encerrada !== false,
    }))
    .sort((a, b) => a.ano - b.ano);
}

/** O melhor e o pior desfecho da trilha, e quantas edições em cada série. */
export function resumoDaTrilha(trilha) {
  const pontos = trilha ?? [];
  if (!pontos.length) return { melhor: null, pior: null, porSerie: { A: 0, B: 0 } };

  return {
    melhor: pontos.reduce((m, p) => (p.eixo < m.eixo ? p : m)),
    pior: pontos.reduce((m, p) => (p.eixo > m.eixo ? p : m)),
    porSerie: {
      A: pontos.filter((p) => p.serie === "A").length,
      B: pontos.filter((p) => p.serie === "B").length,
    },
  };
}
