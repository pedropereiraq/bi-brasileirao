/**
 * Quando uma edição entra no segundo turno.
 *
 * Duas telas do BI só fazem sentido depois disso. O comparativo de turnos
 * precisa dos dois lados do espelho: com o primeiro turno ainda correndo, a
 * coluna da volta está vazia e o card compararia uma campanha com o nada. O
 * simulador precisa de uma reta final: com trinta jogos pela frente, simular
 * resultado por resultado não é palpite, é ficção.
 *
 * O critério é o mesmo nos dois: a edição entrou no segundo turno quando pelo
 * menos um jogo da segunda metade das rodadas já foi disputado. Não é a data
 * nem a rodada do calendário — é o que aconteceu em campo, que é o que o BI
 * inteiro usa para dizer onde a edição está.
 *
 * Sem `import` nenhum, para `site/testes` carregar no Node.
 */

/** Índices do array de um jogo, os mesmos de `motor.js`. */
const RODADA = 0, STATUS = 6;
const REALIZADO = "realizado";

/** O padrão do Brasileirão: 38 rodadas, 19 por turno. */
export const RODADAS_POR_TURNO = 19;

/**
 * A primeira rodada do segundo turno.
 *
 * Sai do total de rodadas da edição quando ele vem junto: uma Série C de 19
 * rodadas tem o returno começando na 11ª, e fixar o 20 quebraria ali.
 */
export function primeiraRodadaDoReturno({ rodadas } = {}) {
  const total = Number(rodadas);
  if (!Number.isFinite(total) || total < 2) return RODADAS_POR_TURNO + 1;
  return Math.floor(total / 2) + 1;
}

/**
 * A edição já entrou no segundo turno?
 *
 * Basta um jogo disputado do returno. Jogo adiado da 20ª não segura a tela:
 * se a 21ª já rolou, o campeonato está no segundo turno, e é isso que a
 * pergunta quer saber.
 */
export function noSegundoTurno(jogos, { rodadas } = {}) {
  const primeira = primeiraRodadaDoReturno({ rodadas });
  return (jogos ?? []).some((j) =>
    j[STATUS] === REALIZADO && j[RODADA] >= primeira);
}

/**
 * O que dizer quando a tela ainda não vale.
 *
 * Uma frase por motivo, e não um aviso genérico: "espere o segundo turno" e
 * "esta edição já acabou" são impedimentos diferentes, e quem lê precisa saber
 * qual dos dois é.
 */
export function avisoDoSegundoTurno({ jogos, rodadas, tela = "esta tela" } = {}) {
  if (noSegundoTurno(jogos, { rodadas })) return null;
  const primeira = primeiraRodadaDoReturno({ rodadas });
  return `${tela} só vale a partir do segundo turno — esta edição ainda não `
       + `chegou à ${primeira}ª rodada.`;
}
