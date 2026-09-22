/**
 * FMI: pontos ganhos fora de casa menos pontos perdidos em casa.
 *
 * As duas metades partem de expectativas opostas, e é isso que o índice mede.
 * Fora de casa a régua é zero: tudo que se soma foi **ganho** — um empate vale
 * 1, um triunfo vale 3. Em casa a régua é 3: tudo que se deixa de somar foi
 * **perdido** — o empate custa 2, a derrota custa 3.
 *
 * Um clube que vence em casa e perde fora fica em zero: cumpriu o script. O
 * índice sobe para quem tira ponto de fora sem abrir mão do que é seu, e desce
 * para quem entrega em casa sem compensar na estrada. Por isso ele separa duas
 * campanhas de mesma pontuação que não são a mesma coisa.
 *
 * Trabalha sobre a classificação já separada por mando e sobre partidas já
 * convertidas — `{ rodada, data, mandante, visitante, realizado, gp, gc }`.
 * Sem `import`, para `site/testes` carregar no Node.
 */

/** O que o placar rendeu a quem fez `gp`. */
export function pontosDoPlacar(gp, gc) {
  if (gp === null || gc === null) return null;
  return gp > gc ? 3 : gp === gc ? 1 : 0;
}

/**
 * O índice de cada clube, do maior para o menor.
 *
 * `casa` e `fora` são as duas classificações do mesmo motor, com o filtro de
 * mando trocado — é de lá que saem os jogos e os pontos de cada lado.
 */
export function indiceDeCadaClube(casa, fora) {
  const emCasa = new Map(casa.map((c) => [c.equipe, c]));
  const naEstrada = new Map(fora.map((c) => [c.equipe, c]));
  const clubes = [...new Set([...emCasa.keys(), ...naEstrada.keys()])];

  return clubes
    .map((equipe) => {
      const dentro = emCasa.get(equipe);
      const longe = naEstrada.get(equipe);
      const ganhosFora = longe?.pts ?? 0;
      // Em casa a régua é 3 por jogo: o que não virou ponto foi perdido.
      const perdidosCasa = dentro ? dentro.j * 3 - dentro.pts : 0;
      return {
        equipe,
        ganhosFora,
        perdidosCasa,
        jogosFora: longe?.j ?? 0,
        jogosCasa: dentro?.j ?? 0,
        fmi: ganhosFora - perdidosCasa,
      };
    })
    .sort((a, b) => b.fmi - a.fmi
                 || b.ganhosFora - a.ganhosFora
                 || a.perdidosCasa - b.perdidosCasa);
}

/**
 * O confronto com cada adversário, pelos dois lados.
 *
 * `fora` traz o que o clube ganhou visitando; `casa`, o que ele perdeu
 * recebendo. Jogo que ainda não aconteceu vem como `null`, e não como zero:
 * zero ali diria "não ganhou nada", quando o que houve foi não ter jogado.
 */
export function confrontosDoClube(partidas, clube) {
  const saida = new Map();
  const registro = (adversario) => {
    if (!saida.has(adversario)) {
      saida.set(adversario, { adversario, fora: null, casa: null });
    }
    return saida.get(adversario);
  };

  for (const jogo of partidas) {
    if (jogo.mandante !== clube && jogo.visitante !== clube) continue;
    const emCasa = jogo.mandante === clube;
    const alvo = registro(emCasa ? jogo.visitante : jogo.mandante);

    if (!jogo.realizado) {
      alvo[emCasa ? "casa" : "fora"] ??= { jogou: false };
      continue;
    }

    const meus = emCasa ? jogo.gp : jogo.gc;
    const deles = emCasa ? jogo.gc : jogo.gp;
    const pontos = pontosDoPlacar(meus, deles);

    alvo[emCasa ? "casa" : "fora"] = emCasa
      ? { jogou: true, perdidos: 3 - pontos, pontos, gp: meus, gc: deles }
      : { jogou: true, ganhos: pontos, pontos, gp: meus, gc: deles };
  }
  return saida;
}

/**
 * O detalhe na ordem da classificação de hoje.
 *
 * É o que responde *onde* os pontos foram ganhos e perdidos: contra o topo da
 * tabela ou contra o fim dela. A ordem é a da classificação, e não a do
 * calendário, justamente porque a pergunta é sobre a região da tabela.
 */
export function detalheNaOrdemDaTabela(partidas, clube, classificacao) {
  const confrontos = confrontosDoClube(partidas, clube);
  return classificacao
    .filter((c) => c.equipe !== clube)
    .map((c) => ({
      pos: c.pos,
      adversario: c.equipe,
      ...(confrontos.get(c.equipe) ?? { adversario: c.equipe, fora: null, casa: null }),
    }));
}

/** Os totais do detalhe, para conferir com o índice da barra. */
export function somarDetalhe(detalhe) {
  return detalhe.reduce((soma, linha) => ({
    ganhosFora: soma.ganhosFora + (linha.fora?.ganhos ?? 0),
    perdidosCasa: soma.perdidosCasa + (linha.casa?.perdidos ?? 0),
  }), { ganhosFora: 0, perdidosCasa: 0 });
}
