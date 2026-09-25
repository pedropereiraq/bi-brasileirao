/**
 * De quem o clube tirou os pontos.
 *
 * A tabela diz quantos pontos um time fez; não diz de quem. E isso muda a
 * leitura inteira: 45 pontos tirados do pelotão de baixo e 45 tirados de quem
 * brigava em cima são campanhas diferentes, ainda que empatadas na tabela.
 *
 * O confronto é a unidade natural aqui — num returno de pontos corridos, cada
 * adversário rende duas partidas, uma em cada campo —, e os blocos de quatro
 * posições agrupam os adversários pela região em que estão **hoje**. É a
 * região de hoje, e não a da época do jogo, porque a pergunta é sobre a tabela
 * que se tem na mão: contra os quatro primeiros de agora, quanto se fez?
 *
 * Módulo sem dependência nenhuma de propósito: recebe a agenda já montada e
 * devolve contas, o que deixa `site/testes` carregá-lo no Node.
 */
const PONTOS = { T: 3, E: 1, D: 0 };

const vazio = () => ({ jogos: 0, pontos: 0, possiveis: 0, t: 0, e: 0, d: 0 });

function somar(conta, jogo) {
  if (!jogo?.realizado) return conta;
  conta.jogos += 1;
  conta.possiveis += 3;
  conta.pontos += PONTOS[jogo.resultado] ?? 0;
  if (jogo.resultado === "T") conta.t += 1;
  else if (jogo.resultado === "E") conta.e += 1;
  else conta.d += 1;
  return conta;
}

const comAproveitamento = (conta) => ({
  ...conta,
  aproveitamento: conta.possiveis ? conta.pontos / conta.possiveis : null,
});

/**
 * Um registro por adversário, com o jogo de cada campo.
 *
 * `posicaoDe` devolve a posição de hoje do adversário: é ela que põe o
 * confronto num bloco da tabela.
 */
export function confrontosDoClube(agenda, posicaoDe = () => null) {
  const porAdversario = new Map();

  for (const jogo of agenda ?? []) {
    if (!porAdversario.has(jogo.adversario)) {
      porAdversario.set(jogo.adversario,
        { adversario: jogo.adversario, casa: null, fora: null });
    }
    const registro = porAdversario.get(jogo.adversario);
    // Jogo já registrado naquele campo não some: fica o primeiro, e o segundo
    // seria um dado torto que ninguém saberia ler.
    if (!registro[jogo.mando]) registro[jogo.mando] = jogo;
  }

  return [...porAdversario.values()].map((registro) => ({
    ...registro,
    posicao: posicaoDe(registro.adversario) ?? null,
    ...comAproveitamento(
      somar(somar(vazio(), registro.casa), registro.fora)),
  }));
}

/**
 * Os pontos por bloco da tabela, e dentro de cada um a divisão por mando.
 *
 * O último bloco absorve a sobra quando o total não é múltiplo do tamanho:
 * melhor um bloco de cinco no fim do que um bloco de um.
 */
export function pontosPorBloco(confrontos, { tamanho = 4, total = 20 } = {}) {
  const blocos = [];

  for (let de = 1; de <= total; de += tamanho) {
    // Absorve a sobra só quando o bloco seguinte ficaria incompleto: com 20
    // posições e blocos de quatro, ninguém é absorvido.
    const ate = de + tamanho * 2 - 1 > total ? total : de + tamanho - 1;
    const dentro = (confrontos ?? [])
      .filter((c) => c.posicao !== null && c.posicao >= de && c.posicao <= ate);

    const geral = vazio();
    const casa = vazio();
    const fora = vazio();
    for (const confronto of dentro) {
      somar(casa, confronto.casa);
      somar(fora, confronto.fora);
      somar(somar(geral, confronto.casa), confronto.fora);
    }

    blocos.push({
      de, ate, adversarios: dentro.length,
      ...comAproveitamento(geral),
      casa: comAproveitamento(casa),
      fora: comAproveitamento(fora),
    });
    if (ate === total) break;
  }
  return blocos;
}

/** O bloco que mais rendeu e o que menos rendeu, entre os que tiveram jogo. */
export function extremosDosBlocos(blocos) {
  const validos = (blocos ?? []).filter((b) => b.jogos > 0);
  if (!validos.length) return { melhor: null, pior: null };
  return {
    melhor: validos.reduce((m, b) =>
      (b.aproveitamento > m.aproveitamento ? b : m)),
    pior: validos.reduce((m, b) =>
      (b.aproveitamento < m.aproveitamento ? b : m)),
  };
}
