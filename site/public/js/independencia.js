/**
 * Mando de campo: quanto de casa o clube leva para a estrada.
 *
 * O índice de independência é o aproveitamento fora dividido pelo
 * aproveitamento em casa. Cem por cento quer dizer que o clube repete fora
 * exatamente o que faz em casa — é independente do mando. Abaixo disso ele
 * depende da própria torcida; acima, rende mais viajando, o que acontece e
 * costuma ser sintoma de time que joga melhor sem ter de propor o jogo.
 *
 * A razão diz mais que a diferença. Um clube com 70% em casa e 50% fora perdeu
 * vinte pontos percentuais, o mesmo que um de 40% e 20% — só que o primeiro
 * manteve cinco sétimos do que tinha e o segundo, metade. É a proporção que
 * responde "o quanto ele leva consigo".
 *
 * Quem não pontuou em casa não tem índice: a conta dividiria por zero, e zerar
 * seria dizer que ele é dependente quando o que houve foi não ter de onde
 * depender.
 *
 * Módulo sem dependência nenhuma de propósito: assim `site/testes` carrega no
 * Node e cobra a regra.
 */

/** A razão entre os dois aproveitamentos, ou `null` quando não existe. */
export function independenciaDoMando(casa, fora) {
  if (!casa || !fora) return null;
  if (casa.aproveitamento === null || fora.aproveitamento === null) return null;
  if (casa.aproveitamento === 0) return null;
  return fora.aproveitamento / casa.aproveitamento;
}

/**
 * Uma linha por clube, com os dois recortes lado a lado e o índice.
 *
 * Ordenada do mais independente para o menos, e quem não tem índice fica no
 * fim — não é o pior, é o que não dá para medir.
 */
export function linhasDeIndependencia(casa, fora) {
  const emCasa = new Map(casa.map((c) => [c.equipe, c]));
  const naEstrada = new Map(fora.map((c) => [c.equipe, c]));
  const clubes = [...new Set([...emCasa.keys(), ...naEstrada.keys()])];

  return clubes
    .map((equipe) => {
      const dentro = emCasa.get(equipe) ?? null;
      const longe = naEstrada.get(equipe) ?? null;
      return {
        equipe,
        casa: dentro,
        fora: longe,
        indice: independenciaDoMando(dentro, longe),
      };
    })
    .sort((a, b) => {
      if (a.indice === null && b.indice === null) return 0;
      if (a.indice === null) return 1;
      if (b.indice === null) return -1;
      return b.indice - a.indice;
    });
}

/**
 * Quantos jogos cada clube fez de cada lado.
 *
 * Num campeonato de pontos corridos os dois números terminam iguais, mas no
 * meio do caminho raramente estão: é aí que se vê quem já gastou os jogos em
 * casa e quem ainda tem essa reserva.
 */
export function jogosPorMando(casa, fora) {
  const emCasa = new Map(casa.map((c) => [c.equipe, c.j]));
  const naEstrada = new Map(fora.map((c) => [c.equipe, c.j]));
  const clubes = [...new Set([...emCasa.keys(), ...naEstrada.keys()])];

  return Object.fromEntries(clubes.map((equipe) => {
    const dentro = emCasa.get(equipe) ?? 0;
    const longe = naEstrada.get(equipe) ?? 0;
    return [equipe, { casa: dentro, fora: longe, saldo: dentro - longe }];
  }));
}

/** O maior desequilíbrio de calendário da edição, para calibrar a cor. */
export function maiorDesequilibrio(jogos) {
  const valores = Object.values(jogos).map((j) => Math.abs(j.saldo));
  return valores.length ? Math.max(...valores) : 0;
}
