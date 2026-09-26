/**
 * Quantos pontos estão na tabela, e quantos ficaram pelo caminho.
 *
 * Uma rodada de dez jogos põe trinta pontos em disputa, mas raramente trinta
 * chegam à tabela. Um empate distribui dois em vez de três — o ponto que
 * sobra some do campeonato, e não volta. Um jogo adiado não distribui nada
 * enquanto não acontece: os três pontos ficam retidos, e voltam depois. E o
 * tapetão tira da tabela ponto que já tinha sido distribuído em campo: o jogo
 * aconteceu, o placar vale, mas o tribunal desfez a soma.
 *
 * A distinção importa para ler a tabela contra a média. Uma rodada com muitos
 * empates deixa **toda** a tabela abaixo do normal sem que ninguém tenha
 * jogado mal, e uma rodada com jogo atrasado deixa uma região inteira
 * artificialmente baixa até o jogo sair. Sem essa conta ao lado, as duas
 * coisas viram "campeonato fraco".
 *
 * A identidade fecha em cima: possíveis = distribuídos + queimados no empate +
 * retidos em jogo por disputar + tirados no tapetão.
 *
 * Trabalha sobre partidas já convertidas — `{ rodada, realizado, gp, gc }` — e
 * sobre os descontos da edição — `{ rodada, pontos }`, com `pontos` negativo.
 * Sem `import`, para `site/testes` carregar no Node.
 */

/**
 * O acumulado até cada rodada, uma linha por rodada.
 *
 * O desconto entra na rodada a partir da qual ele vale, como a punição vale na
 * tabela: somo a lista inteira até ali em vez de acumular rodada por rodada
 * porque a punição não precisa cair numa rodada com jogo.
 */
export function fluxoDePontos(partidas, descontos = []) {
  const rodadas = [...new Set(partidas.map((j) => j.rodada))]
    .sort((a, b) => a - b);

  const saida = [];
  let total = 0;
  let empates = 0;
  let pendentes = 0;

  for (const rodada of rodadas) {
    const daRodada = partidas.filter((j) => j.rodada === rodada);
    total += daRodada.length;
    empates += daRodada.filter((j) => j.realizado && j.gp === j.gc).length;
    pendentes += daRodada.filter((j) => !j.realizado).length;

    const possiveis = total * 3;
    const queimados = empates;          // um ponto por empate
    const retidos = pendentes * 3;      // três por jogo que não aconteceu
    const tapetao = descontos           // o que o tribunal tirou até aqui
      .filter((d) => d.rodada <= rodada)
      .reduce((soma, d) => soma - d.pontos, 0);
    const faltando = queimados + retidos + tapetao;
    saida.push({
      rodada,
      jogos: total,
      possiveis,
      queimados,
      retidos,
      tapetao,
      distribuidos: possiveis - faltando,
      faltando,
    });
  }
  return saida;
}

/**
 * Quanto do que estava em jogo chegou à tabela, de 0 a 1.
 *
 * Serve ao rótulo: "94% dos pontos em disputa estão na tabela" diz numa frase
 * o que as duas parcelas dizem em números.
 */
export function aproveitamentoDaTabela(linha) {
  if (!linha?.possiveis) return null;
  return linha.distribuidos / linha.possiveis;
}
