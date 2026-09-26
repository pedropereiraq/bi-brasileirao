/**
 * A grade de quem esteve em cada posição.
 *
 * O que precisa de guarda: a leitura da grade publicada — que é por índice de
 * clube, e trocar índice por posição embaralharia a tela inteira — e a
 * contagem de rodadas numa faixa, que é o que a lista da esquerda afirma.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  caminhoDoClube, faixaOrdenada, gradeDePosicoes, resumoDaFaixa,
  rodadasNasPosicoes,
} from "../public/js/grade_posicoes.js";

/**
 * Três clubes, três rodadas. Cada linha da grade é uma rodada, já ordenada
 * por posição: `[índice do clube, pontos]`.
 */
const edicao = {
  clubes: ["ALFA (SP)", "BETA (RJ)", "GAMA (MG)"],
  rodadas: 3,
  encerrada: true,
  grade: [
    [[0, 3], [1, 1], [2, 0]],
    [[1, 4], [0, 3], [2, 1]],
    [[1, 7], [2, 4], [0, 3]],
  ],
  grade_st: [
    [[0, 3], [1, 1], [2, 0]],
    [[0, 6], [1, 4], [2, 1]],
    [[0, 9], [1, 7], [2, 4]],
  ],
};

test("a grade vira nomes, mantendo a ordem das posições", () => {
  const grade = gradeDePosicoes(edicao);

  assert.equal(grade.length, 3);
  assert.deepEqual(grade[0].casas.map((c) => c.equipe),
    ["ALFA (SP)", "BETA (RJ)", "GAMA (MG)"]);
  assert.deepEqual(grade[2].casas.map((c) => c.equipe),
    ["BETA (RJ)", "GAMA (MG)", "ALFA (SP)"]);
  assert.deepEqual(grade[2].casas.map((c) => c.posicao), [1, 2, 3]);
  assert.equal(grade[2].casas[0].pontos, 7);
  assert.deepEqual(gradeDePosicoes(undefined), []);
});

test("sem tapetão, é a outra grade que vale", () => {
  const grade = gradeDePosicoes(edicao, { semTapetao: true });
  assert.deepEqual(grade[2].casas.map((c) => c.equipe),
    ["ALFA (SP)", "BETA (RJ)", "GAMA (MG)"]);

  // Edição sem a variante publicada continua na grade única.
  const semVariante = { ...edicao, grade_st: undefined };
  assert.equal(gradeDePosicoes(semVariante, { semTapetao: true })[2].casas[0].equipe,
    "BETA (RJ)");
});

test("a faixa sai ordenada, venha como vier", () => {
  assert.deepEqual(faixaOrdenada({ de: 4, ate: 1 }), { de: 1, ate: 4 });
  assert.deepEqual(faixaOrdenada({ de: 2, ate: 2 }), { de: 2, ate: 2 });
  assert.equal(faixaOrdenada(null), null);
});

test("a lista conta rodadas na faixa, e deixa de fora quem nunca esteve", () => {
  const grade = gradeDePosicoes(edicao);

  const lider = rodadasNasPosicoes(grade, { de: 1, ate: 1 });
  assert.deepEqual(lider, [
    { equipe: "ALFA (SP)", rodadas: 1 },
    { equipe: "BETA (RJ)", rodadas: 2 },
  ].sort((a, b) => b.rodadas - a.rodadas));
  assert.ok(!lider.some((l) => l.equipe === "GAMA (MG)"),
    "quem nunca liderou não entra na lista");

  const duasPrimeiras = rodadasNasPosicoes(grade, { de: 1, ate: 2 });
  assert.equal(duasPrimeiras.length, 3);
  assert.equal(duasPrimeiras.reduce((s, l) => s + l.rodadas, 0), 6,
    "três rodadas × duas posições");
});

test("sem faixa não há lista", () => {
  assert.deepEqual(rodadasNasPosicoes(gradeDePosicoes(edicao), null), []);
  assert.deepEqual(rodadasNasPosicoes([], { de: 1, ate: 4 }), []);
});

test("o caminho do clube traz a posição em cada rodada", () => {
  const grade = gradeDePosicoes(edicao);
  assert.deepEqual(caminhoDoClube(grade, "ALFA (SP)").map((p) => p.posicao),
    [1, 2, 3]);
  assert.deepEqual(caminhoDoClube(grade, "DELTA (BA)").map((p) => p.posicao),
    [null, null, null]);
});

test("o resumo da faixa conta clubes e rodadas", () => {
  const ranking = rodadasNasPosicoes(gradeDePosicoes(edicao), { de: 1, ate: 2 });
  assert.deepEqual(resumoDaFaixa(ranking), { clubes: 3, rodadas: 6 });
  assert.deepEqual(resumoDaFaixa([]), { clubes: 0, rodadas: 0 });
});
