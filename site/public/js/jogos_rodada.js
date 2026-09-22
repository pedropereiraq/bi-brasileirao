/**
 * O calendário de uma edição: o que já foi jogado, o que falta, e onde falta.
 *
 * Num campeonato de pontos corridos a rodada é a unidade do calendário, mas
 * ela não fecha sozinha: jogo adiado deixa a rodada aberta por semanas, e é
 * essa pendência que explica por que dois clubes com a mesma campanha estão em
 * posições diferentes. Por isso o módulo conta rodada a rodada quantos jogos
 * já aconteceram, e sabe dizer, por clube, quais são os que faltam.
 *
 * Trabalha sobre partidas já convertidas — `{ rodada, data, mandante,
 * visitante, realizado, gp, gc }` —, e não sobre o formato cru dos dados. É o
 * que deixa `site/testes` carregá-lo no Node: sem `import`, sem `motor.js`.
 */

/** Uma linha por rodada, da primeira à última, com o que já foi disputado. */
export function resumoDasRodadas(partidas) {
  const porRodada = new Map();
  for (const jogo of partidas) {
    const atual = porRodada.get(jogo.rodada) ?? { total: 0, realizados: 0 };
    atual.total += 1;
    if (jogo.realizado) atual.realizados += 1;
    porRodada.set(jogo.rodada, atual);
  }

  return [...porRodada.entries()]
    .map(([rodada, conta]) => ({
      rodada,
      total: conta.total,
      realizados: conta.realizados,
      completa: conta.realizados === conta.total,
    }))
    .sort((a, b) => a.rodada - b.rodada);
}

/** Quanto do campeonato já foi disputado. */
export function andamentoDoCampeonato(partidas) {
  const total = partidas.length;
  const realizados = partidas.filter((j) => j.realizado).length;
  return { total, realizados, fracao: total ? realizados / total : 0 };
}

/**
 * Os jogos de uma rodada, na ordem em que aconteceram (ou vão acontecer).
 *
 * A ordem é a da data, e não a do sorteio: uma rodada que se espalha por
 * cinco dias se lê como um calendário, não como uma lista.
 */
export function jogosDaRodada(partidas, rodada) {
  return partidas
    .filter((jogo) => jogo.rodada === rodada)
    .sort((a, b) => (a.data === b.data ? 0 : a.data < b.data ? -1 : 1));
}

/**
 * A rodada que o card abre: a última que já teve algum jogo.
 *
 * Não é a última rodada *completa* — o interesse costuma estar justamente na
 * que está acontecendo agora, com jogos já disputados e outros por vir.
 */
export function rodadaCorrente(partidas) {
  const comJogo = partidas.filter((j) => j.realizado).map((j) => j.rodada);
  return comJogo.length ? Math.max(...comJogo) : 1;
}

/**
 * O número de jogos mais comum da tabela.
 *
 * É a régua contra a qual se mede quem está adiantado e quem está atrasado.
 * Havendo empate entre duas quantidades, vale a maior: ela é a do calendário
 * em dia, e a menor é a de quem ficou para trás.
 */
export function modaDeJogos(tabela) {
  const contagem = new Map();
  for (const clube of tabela) {
    contagem.set(clube.j, (contagem.get(clube.j) ?? 0) + 1);
  }
  let moda = 0;
  let quantos = -1;
  for (const [jogos, vezes] of contagem) {
    if (vezes > quantos || (vezes === quantos && jogos > moda)) {
      moda = jogos;
      quantos = vezes;
    }
  }
  return moda;
}

/**
 * Os jogos que faltam a cada clube, em ordem de rodada.
 *
 * Indexado por clube porque a pergunta é sempre sobre um deles: "o Bahia tem
 * um jogo a menos — contra quem?".
 *
 * `atrasado` distingue os dois tipos de pendência, e a régua é a rodada, não a
 * data: jogo que ficou para trás é o de uma rodada que o campeonato já
 * passou. Pela data não dava — um adiado sem nova data marcada aparece com
 * data futura, e um jogo da rodada corrente ainda por disputar apareceria como
 * atrasado só por estar marcado para amanhã.
 */
export function pendentesPorClube(partidas) {
  const corrente = rodadaCorrente(partidas);
  const saida = {};
  const anotar = (clube, jogo, mando) => {
    (saida[clube] ??= []).push({
      rodada: jogo.rodada,
      data: jogo.data,
      mando,
      atrasado: jogo.rodada < corrente,
      adversario: mando === "casa" ? jogo.visitante : jogo.mandante,
    });
  };

  for (const jogo of partidas) {
    if (jogo.realizado) continue;
    anotar(jogo.mandante, jogo, "casa");
    anotar(jogo.visitante, jogo, "fora");
  }
  for (const lista of Object.values(saida)) {
    lista.sort((a, b) => a.rodada - b.rodada);
  }
  return saida;
}
