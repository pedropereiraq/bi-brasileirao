/**
 * Os próximos jogos de um grupo de clubes, lado a lado.
 *
 * A pergunta é a da reta final: quem tem a tabela mais dura daqui para a
 * frente. Ela só faz sentido entre concorrentes diretos — os quatro que brigam
 * pela Libertadores, os cinco que brigam contra o rebaixamento —, e por isso o
 * filtro é uma faixa de posições, e não um clube.
 *
 * Só a edição em andamento tem "próximos jogos": nas encerradas não sobrou
 * nenhum.
 *
 * Módulo sem dependência nenhuma de propósito: recebe a agenda já montada e
 * devolve contas, o que deixa `site/testes` carregá-lo no Node.
 */

/** Os clubes que ocupam hoje as posições da faixa, na ordem da tabela. */
export function clubesNaFaixa(classificacao, { melhor, pior }) {
  return classificacao.filter((c) => c.pos >= melhor && c.pos <= pior);
}

/**
 * Os jogos que ainda vêm, em ordem cronológica.
 *
 * `agenda` é a lista de `campanhaCompleta`: o n-ésimo jogo do clube, disputado
 * ou não. O que sobra aqui é só o que ainda não aconteceu.
 */
export function proximosJogos(agenda, { quantos = Infinity } = {}) {
  return agenda.filter((passo) => !passo.realizado).slice(0, quantos);
}

/**
 * A posição média dos adversários que ainda virão.
 *
 * É o número que responde "quem pegou a parte pesada da tabela": média baixa é
 * calendário duro, média alta é calendário fácil. Sem jogo pela frente não há
 * média — e `0` ali seria lido como "adversários fortíssimos".
 */
export function mediaDosAdversarios(jogos, posicaoDe) {
  const posicoes = jogos
    .map((passo) => posicaoDe(passo.jogo.adversario))
    .filter((p) => typeof p === "number");
  if (!posicoes.length) return null;
  return posicoes.reduce((soma, p) => soma + p, 0) / posicoes.length;
}

/**
 * Quantos jogos a lista vai mostrar: o maior número de jogos que resta a um
 * dos clubes, com teto.
 *
 * O mesmo tamanho para todas as colunas — clubes com jogo adiado têm um a mais
 * que os outros, e cortar pelo menor esconderia justamente esse jogo.
 */
export function tamanhoDaLista(agendas, { teto = 10 } = {}) {
  const restantes = agendas.map((agenda) => proximosJogos(agenda).length);
  return Math.min(teto, Math.max(0, ...restantes));
}
