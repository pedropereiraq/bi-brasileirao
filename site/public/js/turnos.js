/**
 * Os dois turnos de um clube, pareados pelo confronto.
 *
 * A tabela do Brasileirão é espelhada: a rodada 20 é o returno da rodada 1, a
 * 21 o da 2, e assim até a 38. Isso dá a esta tela o eixo que ela precisa —
 * cada coluna é **um adversário**, com a ida e a volta uma em cima da outra, e
 * a pergunta "contra quem ganhei pontos no primeiro e deixei de ganhar no
 * segundo" vira leitura direta em vez de conta de cabeça.
 *
 * O pareamento é por rodada, e não por adversário, porque é a rodada que
 * define o turno. Se alguma edição quebrar o espelho, a coluna avisa
 * (`espelhado: false`) em vez de mentir que os dois jogos são o mesmo
 * confronto.
 *
 * O acumulado é o da **ordem das rodadas**, não o cronológico: o valor na
 * coluna n é o que o clube somou nos jogos já disputados das rodadas até ali.
 * Jogo adiado deixa a linha plana na coluna dele e entra quando acontecer — é
 * a mesma semântica da tabela do dia.
 *
 * Módulo sem dependência nenhuma de propósito: recebe a agenda já montada e
 * devolve contas, o que deixa `site/testes` carregá-lo no Node.
 */
export const RODADAS_POR_TURNO = 19;

const PONTOS = { T: 3, E: 1, D: 0 };

const pontosDoJogo = (jogo) =>
  (jogo?.realizado ? PONTOS[jogo.resultado] ?? 0 : null);

/** A ida e a volta de cada confronto, na ordem das rodadas do primeiro turno. */
export function confrontosDosTurnos(agenda, { porTurno = RODADAS_POR_TURNO } = {}) {
  const porRodada = new Map();
  for (const jogo of agenda ?? []) porRodada.set(jogo.rodada, jogo);

  const confrontos = [];
  let somaIda = 0;
  let somaVolta = 0;

  for (let n = 1; n <= porTurno; n++) {
    const ida = porRodada.get(n) ?? null;
    const volta = porRodada.get(n + porTurno) ?? null;
    const pontosIda = pontosDoJogo(ida);
    const pontosVolta = pontosDoJogo(volta);

    somaIda += pontosIda ?? 0;
    somaVolta += pontosVolta ?? 0;

    confrontos.push({
      n, ida, volta,
      adversario: ida?.adversario ?? volta?.adversario ?? null,
      espelhado: Boolean(ida && volta && ida.adversario === volta.adversario),
      pontosIda, pontosVolta,
      // O que a volta devolveu do que a ida tinha dado. Só existe com os dois
      // jogos na mão: comparar com um jogo que não aconteceu seria inventar.
      saldo: pontosIda === null || pontosVolta === null
        ? null : pontosVolta - pontosIda,
      acumuladoIda: somaIda,
      acumuladoVolta: somaVolta,
    });
  }
  return confrontos;
}

/**
 * O que um turno somou, e a que velocidade.
 *
 * `ultima` é a última coluna com jogo disputado: é onde a linha do turno
 * termina. Sem ela, o segundo turno de uma edição em andamento seria
 * desenhado plano até o fim, como se o clube tivesse parado de pontuar.
 */
export function resumoDoTurno(confrontos, lado = "ida") {
  const chave = lado === "volta" ? "pontosVolta" : "pontosIda";
  const pontos = confrontos.map((c) => c[chave]);
  const jogos = pontos.filter((p) => p !== null).length;
  const total = pontos.reduce((soma, p) => soma + (p ?? 0), 0);

  return {
    lado, jogos, pontos: total,
    porJogo: jogos ? total / jogos : null,
    aproveitamento: jogos ? total / (3 * jogos) : null,
    ultima: pontos.reduce((ultima, p, i) => (p === null ? ultima : i + 1), 0),
  };
}

/**
 * A diferença entre os turnos nos confrontos em que dá para comparar.
 *
 * Num campeonato em andamento, o returno tem menos jogos que a ida, e subtrair
 * um total do outro compara dezenove jogos com nove. Aqui a conta para na
 * última coluna em que os dois turnos jogaram: nos mesmos confrontos, o que
 * mudou foi isto.
 */
export function saldoComparavel(confrontos) {
  const ate = confrontos.reduce(
    (ultima, c, i) => (c.saldo === null ? ultima : i + 1), 0);
  if (!ate) return { colunas: 0, ida: 0, volta: 0, diferenca: 0, completo: false };

  const { acumuladoIda, acumuladoVolta } = confrontos[ate - 1];
  return {
    colunas: ate,
    ida: acumuladoIda,
    volta: acumuladoVolta,
    diferenca: acumuladoVolta - acumuladoIda,
    completo: ate === confrontos.length,
  };
}

/**
 * Contra quem o clube melhorou e contra quem piorou.
 *
 * Só entram os confrontos com os dois jogos disputados, e a ordem é a do
 * tamanho da mudança: é uma lista para responder "o que mudou", e o que não
 * mudou não tem o que dizer.
 */
export function ondeMudou(confrontos) {
  return confrontos
    .filter((c) => c.saldo !== null && c.saldo !== 0)
    .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo) || a.n - b.n);
}
