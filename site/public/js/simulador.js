/**
 * O que ainda pode acontecer: os jogos que faltam, um palpite de cada vez.
 *
 * A pergunta da reta final nunca é "quantos pontos preciso fazer", é "e se".
 * E se ganhar em casa do concorrente direto e perder fora do líder? O
 * simulador responde isso do jeito mais curto possível: cada jogo que falta
 * vira um palpite de três estados — venci, empatei, perdi —, e a tabela do
 * lado se refaz inteira a cada um.
 *
 * O palpite é **do jogo**, e não da linha. O mesmo Fla-Flu aparece na linha do
 * Flamengo e na do Fluminense, e dizer que o Flamengo vence é dizer que o
 * Fluminense perde: guardar o palpite pelo índice do jogo é o que impede as
 * duas linhas de discordarem uma da outra.
 *
 * O placar é sempre 1 a 0 ou 0 a 0. O simulador decide pontos, não gols — e um
 * placar inventado mexeria no saldo, que é critério de desempate. Com 1 a 0 o
 * saldo anda um por vitória, o mínimo para não distorcer a tabela.
 *
 * Sem `import` nenhum, para `site/testes` carregar no Node.
 */

/** Índices do array de um jogo, os mesmos de `motor.js`. */
const RODADA = 0, DATA = 1, MANDANTE = 2, VISITANTE = 3,
      GOLS_M = 4, GOLS_V = 5, STATUS = 6;
const REALIZADO = "realizado";

/** O desfecho de um jogo, do ponto de vista dele: quem venceu. */
export const MANDANTE_VENCE = "M", EMPATE = "E", VISITANTE_VENCE = "V";

/** O desfecho do ponto de vista de uma linha da tabela. */
export const VITORIA = "V", EMPATOU = "E", DERROTA = "D";

/** O ciclo de uma etiqueta: sem palpite, vitória, empate, derrota, e volta. */
const CICLO = [null, VITORIA, EMPATOU, DERROTA];

/** O placar de cada desfecho. Sempre 1 a 0, ou 0 a 0. */
const PLACAR = {
  [MANDANTE_VENCE]: [1, 0],
  [EMPATE]: [0, 0],
  [VISITANTE_VENCE]: [0, 1],
};

/**
 * Os jogos que ainda não aconteceram, em ordem de rodada.
 *
 * O índice vai junto porque é ele que identifica o palpite: é o mesmo jogo na
 * linha dos dois clubes, e o índice é o que os dois têm em comum.
 */
export function jogosPendentes(jogos) {
  return (jogos ?? [])
    .map((jogo, indice) => ({ indice, jogo }))
    .filter(({ jogo }) => jogo[STATUS] !== REALIZADO
                       || jogo[GOLS_M] === null || jogo[GOLS_V] === null)
    .map(({ indice, jogo }) => ({
      indice,
      rodada: jogo[RODADA],
      data: jogo[DATA],
      mandante: jogo[MANDANTE],
      visitante: jogo[VISITANTE],
    }))
    .sort((a, b) => a.rodada - b.rodada
      || (a.data < b.data ? -1 : a.data > b.data ? 1 : 0)
      || a.indice - b.indice);
}

/** Os jogos que faltam a um clube, com o mando e o adversário resolvidos. */
export function pendentesDoClube(pendentes, clube) {
  return (pendentes ?? [])
    .filter((p) => p.mandante === clube || p.visitante === clube)
    .map((p) => {
      const emCasa = p.mandante === clube;
      return { ...p, emCasa, adversario: emCasa ? p.visitante : p.mandante };
    });
}

/** O desfecho do jogo lido da linha de um clube: venceu, empatou, perdeu. */
export function desfechoDaLinha(palpite, emCasa) {
  if (!palpite) return null;
  if (palpite === EMPATE) return EMPATOU;
  const venceuOMandante = palpite === MANDANTE_VENCE;
  return venceuOMandante === emCasa ? VITORIA : DERROTA;
}

/** O caminho de volta: o que a linha diz vira o desfecho do jogo. */
export function palpiteDoJogo(desfecho, emCasa) {
  if (!desfecho) return null;
  if (desfecho === EMPATOU) return EMPATE;
  const oDonoVence = desfecho === VITORIA;
  return oDonoVence === emCasa ? MANDANTE_VENCE : VISITANTE_VENCE;
}

/**
 * O próximo estado de uma etiqueta, do ponto de vista da linha.
 *
 * Sem palpite → vitória → empate → derrota → sem palpite. Voltar ao branco faz
 * parte do ciclo: desfazer um palpite precisa ser tão barato quanto dar um.
 */
export function proximoDesfecho(atual) {
  const i = CICLO.indexOf(atual ?? null);
  return CICLO[(i + 1) % CICLO.length];
}

/**
 * Gira o palpite de um jogo, visto da linha de um clube.
 *
 * Devolve um mapa novo — o estado da página troca por inteiro, e mexer no
 * antigo esconderia a mudança de quem só compara referências.
 */
export function girarPalpite(palpites, { indice, emCasa }) {
  const novo = new Map(palpites ?? []);
  const seguinte = proximoDesfecho(desfechoDaLinha(novo.get(indice), emCasa));
  if (seguinte === null) novo.delete(indice);
  else novo.set(indice, palpiteDoJogo(seguinte, emCasa));
  return novo;
}

/**
 * Os jogos com os palpites aplicados.
 *
 * Cópia rasa da lista, e cópia da linha só onde há palpite: o resto continua
 * sendo o mesmo array que veio do servidor.
 */
export function aplicarPalpites(jogos, palpites) {
  const mapa = palpites ?? new Map();
  return (jogos ?? []).map((jogo, indice) => {
    const palpite = mapa.get(indice);
    if (!palpite || !PLACAR[palpite]) return jogo;
    const [gm, gv] = PLACAR[palpite];
    const copia = jogo.slice();
    copia[GOLS_M] = gm;
    copia[GOLS_V] = gv;
    copia[STATUS] = REALIZADO;
    return copia;
  });
}

/**
 * Quanto cada clube andou entre a tabela de hoje e a simulada.
 *
 * Positivo é subir, porque subir é ir para um número menor — a conta é feita
 * aqui uma vez, e não em cada lugar que precisa da seta.
 */
export function variacoes(atual, simulada) {
  const hoje = new Map((atual ?? []).map((c) => [c.equipe, c.pos]));
  return new Map((simulada ?? []).map((c) => {
    const de = hoje.get(c.equipe) ?? null;
    return [c.equipe, {
      de, para: c.pos,
      delta: de === null ? null : de - c.pos,
    }];
  }));
}

/** Quantos jogos já receberam palpite, dos que faltam. */
export function contarPalpites(palpites, pendentes) {
  const validos = new Set((pendentes ?? []).map((p) => p.indice));
  let quantos = 0;
  for (const indice of (palpites ?? new Map()).keys()) {
    if (validos.has(indice)) quantos += 1;
  }
  return { simulados: quantos, restantes: validos.size - quantos,
           total: validos.size };
}
