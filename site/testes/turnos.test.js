/**
 * O cruzamento dos dois turnos.
 *
 * Duas regras precisam de guarda. O pareamento é por rodada (n e n+19), e não
 * por adversário — é a rodada que define o turno, e o espelho da tabela é um
 * fato da edição, não uma premissa da conta. E o acumulado é o da ordem das
 * rodadas: jogo adiado deixa a linha plana na coluna dele em vez de sumir com
 * a coluna.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  confrontosDosTurnos, ondeMudou, resumoDoTurno, saldoComparavel,
} from "../public/js/turnos.js";

const jogo = (rodada, adversario, mando, resultado) => ({
  rodada, adversario, mando,
  realizado: resultado !== null,
  resultado,
});

// Um campeonato de faz-de-conta com três rodadas por turno.
const agenda = [
  jogo(1, "BETA", "casa", "T"),
  jogo(2, "GAMA", "fora", "D"),
  jogo(3, "DELTA", "casa", "E"),
  jogo(4, "BETA", "fora", "D"),
  jogo(5, "GAMA", "casa", "T"),
  jogo(6, "DELTA", "fora", null),
];
const confrontos = confrontosDosTurnos(agenda, { porTurno: 3 });

test("cada coluna junta a ida e a volta do mesmo confronto", () => {
  assert.deepEqual(confrontos.map((c) => c.adversario), ["BETA", "GAMA", "DELTA"]);
  assert.deepEqual(confrontos.map((c) => c.espelhado), [true, true, true]);
  assert.deepEqual(confrontos.map((c) => [c.ida.mando, c.volta.mando]),
    [["casa", "fora"], ["fora", "casa"], ["casa", "fora"]]);
});

test("o saldo diz o que a volta devolveu do que a ida tinha dado", () => {
  assert.deepEqual(confrontos.map((c) => c.pontosIda), [3, 0, 1]);
  assert.deepEqual(confrontos.map((c) => c.pontosVolta), [0, 3, null]);
  assert.deepEqual(confrontos.map((c) => c.saldo), [-3, 3, null],
    "sem os dois jogos não há comparação");
});

test("o acumulado segue a ordem das rodadas", () => {
  assert.deepEqual(confrontos.map((c) => c.acumuladoIda), [3, 3, 4]);
  assert.deepEqual(confrontos.map((c) => c.acumuladoVolta), [0, 3, 3],
    "o jogo que não aconteceu deixa a linha plana");
});

test("o resumo para onde o turno parou", () => {
  const ida = resumoDoTurno(confrontos, "ida");
  assert.deepEqual([ida.jogos, ida.pontos, ida.ultima], [3, 4, 3]);
  assert.equal(ida.porJogo, 4 / 3);
  assert.equal(ida.aproveitamento, 4 / 9);

  const volta = resumoDoTurno(confrontos, "volta");
  assert.deepEqual([volta.jogos, volta.pontos, volta.ultima], [2, 3, 2],
    "a linha do returno termina no último jogo disputado");
});

test("uma edição sem espelho avisa em vez de inventar o confronto", () => {
  const torta = confrontosDosTurnos([
    jogo(1, "BETA", "casa", "T"),
    jogo(2, "GAMA", "fora", "D"),
    jogo(3, "DELTA", "fora", "T"),
  ], { porTurno: 2 });

  assert.equal(torta[0].espelhado, false, "a rodada 3 é de outro adversário");
  assert.equal(torta[0].adversario, "BETA");
  assert.equal(torta[0].volta.adversario, "DELTA");
});

test("onde mudou traz só o que mudou, do maior para o menor", () => {
  const lista = ondeMudou(confrontos);
  assert.deepEqual(lista.map((c) => [c.adversario, c.saldo]),
    [["BETA", -3], ["GAMA", 3]]);
});

test("sem agenda não há colunas com jogo", () => {
  const vazio = confrontosDosTurnos([], { porTurno: 3 });
  assert.equal(vazio.length, 3);
  assert.deepEqual(vazio.map((c) => c.adversario), [null, null, null]);
  assert.equal(resumoDoTurno(vazio, "ida").porJogo, null);
});

test("a diferença entre os turnos para onde a comparação para", () => {
  // O returno só jogou duas das três colunas: comparar 4 com 3 seria comparar
  // três jogos com dois.
  const saldo = saldoComparavel(confrontos);
  assert.deepEqual([saldo.colunas, saldo.ida, saldo.volta], [2, 3, 3]);
  assert.equal(saldo.diferenca, 0, "nos dois confrontos comparáveis, empate");
  assert.equal(saldo.completo, false);
});

test("com os dois turnos inteiros, a diferença é a dos totais", () => {
  const cheios = confrontosDosTurnos([
    jogo(1, "BETA", "casa", "T"), jogo(2, "BETA", "fora", "E"),
  ], { porTurno: 1 });
  const saldo = saldoComparavel(cheios);

  assert.equal(saldo.completo, true);
  assert.equal(saldo.diferenca, -2);
});
