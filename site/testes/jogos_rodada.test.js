/**
 * O calendário de uma edição.
 *
 * O que precisa de guarda: a rodada aberta — a que tem jogo disputado e jogo
 * por vir —, porque é dela que o card fala; e a moda de jogos, que é a régua
 * de quem está adiantado ou atrasado, e que num empate tem de valer a maior,
 * a do calendário em dia.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  andamentoDoCampeonato, jogosDaRodada, modaDeJogos, pendentesPorClube,
  resumoDasRodadas, rodadaCorrente,
} from "../public/js/jogos_rodada.js";

const jogo = (rodada, data, mandante, visitante, gp = null, gc = null) => ({
  rodada, data, mandante, visitante,
  realizado: gp !== null, gp, gc,
});

const partidas = [
  jogo(1, "2026-01-28", "ALFA (SP)", "BETA (RJ)", 2, 1),
  jogo(1, "2026-01-28", "GAMA (MG)", "DELTA (BA)", 0, 0),
  jogo(2, "2026-02-04", "BETA (RJ)", "GAMA (MG)", 1, 3),
  jogo(2, "2026-08-20", "DELTA (BA)", "ALFA (SP)"),
  jogo(3, "2026-02-11", "ALFA (SP)", "GAMA (MG)"),
  jogo(3, "2026-02-11", "DELTA (BA)", "BETA (RJ)"),
];

test("cada rodada conta o que já foi disputado", () => {
  assert.deepEqual(resumoDasRodadas(partidas), [
    { rodada: 1, total: 2, realizados: 2, completa: true },
    { rodada: 2, total: 2, realizados: 1, completa: false },
    { rodada: 3, total: 2, realizados: 0, completa: false },
  ]);
});

test("o andamento é a fração de jogos já disputados", () => {
  const andamento = andamentoDoCampeonato(partidas);
  assert.equal(andamento.total, 6);
  assert.equal(andamento.realizados, 3);
  assert.equal(andamento.fracao, 0.5);
  assert.deepEqual(andamentoDoCampeonato([]), { total: 0, realizados: 0, fracao: 0 });
});

test("a rodada corrente é a última com algum jogo disputado", () => {
  // A 2ª tem um jogo feito e um adiado para agosto: é nela que o card abre,
  // e não na 1ª, que é a última completa.
  assert.equal(rodadaCorrente(partidas), 2);
  assert.equal(rodadaCorrente([jogo(5, "2026-03-01", "A", "B")]), 1,
    "sem jogo disputado, começa na primeira");
});

test("os jogos de uma rodada saem em ordem de data", () => {
  const segunda = jogosDaRodada(partidas, 2);
  assert.deepEqual(segunda.map((j) => j.data), ["2026-02-04", "2026-08-20"]);
  assert.deepEqual(jogosDaRodada(partidas, 9), []);
});

test("a moda de jogos desempata pela maior, que é a do calendário em dia", () => {
  assert.equal(modaDeJogos([{ j: 14 }, { j: 14 }, { j: 13 }]), 14);
  // Duas quantidades com o mesmo número de clubes: vale a maior.
  assert.equal(modaDeJogos([{ j: 13 }, { j: 14 }]), 14);
  assert.equal(modaDeJogos([]), 0);
});

test("os pendentes de cada clube vêm com mando e adversário", () => {
  const pendentes = pendentesPorClube(partidas);
  assert.deepEqual(pendentes["ALFA (SP)"], [
    { rodada: 2, data: "2026-08-20", mando: "fora", adversario: "DELTA (BA)" },
    { rodada: 3, data: "2026-02-11", mando: "casa", adversario: "GAMA (MG)" },
  ]);
  // Quem já jogou tudo não aparece na lista.
  assert.equal(pendentesPorClube(partidas.slice(0, 2))["ALFA (SP)"], undefined);
});
