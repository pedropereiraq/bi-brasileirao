/**
 * A distribuição entre mandante, empate e visitante.
 *
 * O que precisa de guarda: rodada sem jogo não vira zero por cento — vira
 * nada —, e o acumulado da série sabe deixar de fora a edição em curso e a
 * que está sendo comparada com ele.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  acumuladoDaSerie, diferencaEmPontos, edicaoDe, edicoesDaSerie, fracoes,
  rodadasExtremas,
} from "../public/js/resultados.js";

const dados = {
  series: {
    A: {
      2024: { rodadas: [[6, 2, 2], [4, 4, 2]], total: [10, 6, 4], encerrada: true },
      2025: { rodadas: [[5, 5, 0], [3, 3, 4]], total: [8, 8, 4], encerrada: true },
      2026: { rodadas: [[8, 1, 1], [0, 0, 0]], total: [8, 1, 1], encerrada: false },
    },
  },
};

test("a fração é a divisão pelo total, e rodada sem jogo não tem fração", () => {
  assert.deepEqual(fracoes([5, 3, 2]), [0.5, 0.3, 0.2]);
  assert.equal(fracoes([0, 0, 0]), null, "rodada por disputar não é 0%");
  assert.equal(fracoes(undefined), null);
});

test("a edição vem com as rodadas e o desfecho dela", () => {
  const edicao = edicaoDe(dados, { serie: "A", ano: 2025 });
  assert.deepEqual(edicao.total, [8, 8, 4]);
  assert.equal(edicao.encerrada, true);
  assert.equal(edicao.rodadas.length, 2);
  assert.equal(edicaoDe(dados, { serie: "B", ano: 2025 }), null);

  assert.deepEqual(edicoesDaSerie(dados, { serie: "A" }).map((e) => e.ano),
    [2024, 2025, 2026], "da mais antiga à mais nova");
});

test("o acumulado deixa de fora a edição em curso e a que se compara", () => {
  const tudo = acumuladoDaSerie(dados, { serie: "A" });
  assert.deepEqual(tudo.total, [18, 14, 8], "2026 não entra: ainda acontece");
  assert.equal(tudo.edicoes, 2);

  const semDoisMilVinteCinco = acumuladoDaSerie(dados,
    { serie: "A", exceto: 2025 });
  assert.deepEqual(semDoisMilVinteCinco.total, [10, 6, 4]);
  assert.equal(semDoisMilVinteCinco.edicoes, 1);

  const comAEmCurso = acumuladoDaSerie(dados,
    { serie: "A", soEncerradas: false });
  assert.deepEqual(comAEmCurso.total, [26, 15, 9]);
});

test("a diferença com o histórico sai em pontos percentuais", () => {
  const diferenca = diferencaEmPontos([6, 2, 2], [5, 3, 2]);
  assert.deepEqual(diferenca.map((v) => Math.round(v)), [10, -10, 0]);
  assert.equal(diferencaEmPontos([0, 0, 0], [5, 3, 2]), null);
});

test("as rodadas extremas ignoram as que ainda não aconteceram", () => {
  const extremos = rodadasExtremas(
    [[8, 1, 1], [2, 2, 6], [0, 0, 0]], 0);

  assert.equal(extremos.maior.rodada, 1, "80% de mandante");
  assert.equal(extremos.menor.rodada, 2, "20% de mandante");
  assert.equal(rodadasExtremas([[0, 0, 0]], 0), null);
});
