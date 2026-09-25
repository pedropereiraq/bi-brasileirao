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

/**
 * Um lado de cada jogo: quem jogou, contra quem, em que campo e como acabou.
 *
 * É o formato que as duas contas do ranking pedem — a do clube contra o bloco
 * e a do bloco contra o clube são a mesma lista, agrupada por pontas
 * diferentes.
 */
export function ladosDosJogos(agendas) {
  const lados = [];
  for (const [equipe, agenda] of Object.entries(agendas ?? {})) {
    for (const jogo of agenda) lados.push({ ...jogo, equipe });
  }
  return lados;
}

const doMando = (lado, mando) =>
  (mando === "ambos" || !mando ? true : lado.mando === mando);

/**
 * A classificação considerando só os jogos contra os clubes do bloco.
 *
 * Ordena por aproveitamento, que é o único critério justo quando os clubes do
 * bloco também jogam entre si e acabam com números de jogos diferentes. Pontos
 * e jogos vêm junto porque 100% em dois jogos não é 100% em oito.
 */
export function rankingContraBloco(lados, { bloco, mando = "ambos" } = {}) {
  const alvo = new Set(bloco ?? []);
  const porClube = new Map();

  for (const lado of lados ?? []) {
    if (!alvo.has(lado.adversario) || !doMando(lado, mando)) continue;
    if (!porClube.has(lado.equipe)) porClube.set(lado.equipe, vazio());
    somar(porClube.get(lado.equipe), lado);
  }

  return [...porClube.entries()]
    .map(([equipe, conta]) => ({ equipe, ...comAproveitamento(conta) }))
    .filter((linha) => linha.jogos > 0)
    .sort((a, b) => (b.aproveitamento - a.aproveitamento)
      || (b.pontos - a.pontos) || (b.jogos - a.jogos)
      || a.equipe.localeCompare(b.equipe, "pt-BR"));
}

/**
 * Quanto cada clube do bloco entregou ao resto.
 *
 * É a mesma lista de jogos do ranking, agrupada pela outra ponta: o
 * aproveitamento aqui é o que os adversários tiraram daquele clube, de modo
 * que número alto quer dizer bloco generoso, e não campanha boa.
 */
export function cedidoPorMembro(lados, { bloco, mando = "ambos" } = {}) {
  const alvo = new Set(bloco ?? []);
  const porMembro = new Map(
    [...alvo].map((equipe) => [equipe, vazio()]));

  for (const lado of lados ?? []) {
    if (!alvo.has(lado.adversario) || !doMando(lado, mando)) continue;
    somar(porMembro.get(lado.adversario), lado);
  }

  return [...porMembro.entries()]
    .map(([equipe, conta]) => ({ equipe, ...comAproveitamento(conta) }))
    .sort((a, b) => (b.aproveitamento ?? -1) - (a.aproveitamento ?? -1));
}
