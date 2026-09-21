/**
 * A diferença entre dois pontos da tabela, rodada a rodada.
 *
 * O que precisa de guarda é a natureza dos lados. Uma equipe é a mesma do
 * começo ao fim; uma posição troca de dono, e a série tem de acompanhar a
 * vaga, não o clube que estava nela na primeira rodada. E `dif` é sempre
 * `a − b`: trocar a ordem dos lados troca o sinal, que é o que o card lê como
 * vantagem.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  colunaDaRodada, edicaoDe, ladoNaRodada, ocupantes, resumoDaDiferenca,
  serieDaDiferenca,
} from "../public/js/diferenca_pontos.js";

const CLUBES = ["ALFA (SP)", "BETA (RJ)", "GAMA (MG)", "DELTA (BA)"];

/**
 * Três rodadas de faz-de-conta. Cada linha é a tabela daquela rodada, do 1º
 * ao 4º, como `[índice do clube, pontos]`.
 *
 *   R1  ALFA 3 · GAMA 3 · BETA 1 · DELTA 0
 *   R2  GAMA 6 · ALFA 4 · BETA 2 · DELTA 1
 *   R3  GAMA 7 · BETA 5 · ALFA 4 · DELTA 4
 */
const edicao = {
  clubes: CLUBES,
  rodadas: 3,
  encerrada: true,
  fim: [[3, 7], [2, 5], [1, 4], [4, 4]],
  grade: [
    [[0, 3], [2, 3], [1, 1], [3, 0]],
    [[2, 6], [0, 4], [1, 2], [3, 1]],
    [[2, 7], [1, 5], [0, 4], [3, 4]],
  ],
};

const dados = { series: { A: { 2026: edicao } } };

const equipe = (nome) => ({ tipo: "equipe", equipe: nome });
const posicao = (p) => ({ tipo: "posicao", posicao: p });

test("a edição vem pela série e pelo ano, em número ou em texto", () => {
  assert.equal(edicaoDe(dados, { serie: "A", ano: 2026 }), edicao);
  assert.equal(edicaoDe(dados, { serie: "A", ano: "2026" }), edicao);
  assert.equal(edicaoDe(dados, { serie: "A", ano: 2025 }), null);
  assert.equal(edicaoDe(undefined, { serie: "A", ano: 2026 }), null);
});

test("a coluna da rodada nomeia o clube de cada posição", () => {
  assert.deepEqual(colunaDaRodada(edicao, 2), [
    { posicao: 1, equipe: "GAMA (MG)", pontos: 6 },
    { posicao: 2, equipe: "ALFA (SP)", pontos: 4 },
    { posicao: 3, equipe: "BETA (RJ)", pontos: 2 },
    { posicao: 4, equipe: "DELTA (BA)", pontos: 1 },
  ]);
  assert.equal(colunaDaRodada(edicao, 4), null, "rodada que não aconteceu");
});

test("o lado é a vaga ou o clube, conforme a natureza", () => {
  const coluna = colunaDaRodada(edicao, 3);
  assert.equal(ladoNaRodada(coluna, posicao(2)).equipe, "BETA (RJ)");
  assert.equal(ladoNaRodada(coluna, equipe("ALFA (SP)")).posicao, 3);
  // Clube de fora da edição não vira zero: vira nada.
  assert.equal(ladoNaRodada(coluna, equipe("ÔMEGA (CE)")), null);
  assert.equal(ladoNaRodada(coluna, posicao(9)), null);
  assert.equal(ladoNaRodada(null, posicao(1)), null);
});

test("equipe contra equipe: a diferença é a mesma dupla o tempo todo", () => {
  const serie = serieDaDiferenca(edicao,
    { a: equipe("ALFA (SP)"), b: equipe("BETA (RJ)") });
  assert.deepEqual(serie.map((p) => p.dif), [2, 2, -1]);
  assert.deepEqual(serie.map((p) => p.rodada), [1, 2, 3]);
});

test("equipe contra posição: a vaga muda de dono e a série acompanha", () => {
  const serie = serieDaDiferenca(edicao,
    { a: equipe("ALFA (SP)"), b: posicao(1) });
  // Na 1ª rodada o próprio ALFA é o líder: a diferença é zero.
  assert.deepEqual(serie.map((p) => p.dif), [0, -2, -3]);
  assert.deepEqual(serie.map((p) => p.b.equipe),
    ["ALFA (SP)", "GAMA (MG)", "GAMA (MG)"]);
});

test("posição contra posição: a distância entre dois lugares da tabela", () => {
  const serie = serieDaDiferenca(edicao, { a: posicao(1), b: posicao(3) });
  assert.deepEqual(serie.map((p) => p.dif), [2, 4, 3]);
  // Trocar a ordem dos lados troca o sinal, e nada mais.
  const invertida = serieDaDiferenca(edicao, { a: posicao(3), b: posicao(1) });
  assert.deepEqual(invertida.map((p) => p.dif), [-2, -4, -3]);
});

test("sem edição não há série", () => {
  assert.deepEqual(serieDaDiferenca(null, { a: posicao(1), b: posicao(2) }), []);
  // Clube que não jogou aquela edição some da série inteira.
  assert.deepEqual(serieDaDiferenca(edicao,
    { a: equipe("ÔMEGA (CE)"), b: posicao(1) }), []);
});

test("o resumo guarda a primeira rodada de cada extremo", () => {
  const serie = serieDaDiferenca(edicao,
    { a: equipe("ALFA (SP)"), b: equipe("BETA (RJ)") });
  const r = resumoDaDiferenca(serie);
  assert.equal(r.atual.dif, -1);
  assert.equal(r.maior.dif, 2);
  assert.equal(r.maior.rodada, 1, "empatado em 2, vale a primeira vez");
  assert.equal(r.menor.dif, -1);
  assert.equal(r.media, (2 + 2 - 1) / 3);
  assert.deepEqual(r.contagem, { frente: 2, atras: 1, empate: 0 });
  assert.equal(r.rodadas, 3);
  assert.equal(resumoDaDiferenca([]), null);
});

test("virada é troca de lado, e o empate no caminho não conta duas vezes", () => {
  const comZero = [{ dif: 2 }, { dif: 0 }, { dif: -1 }, { dif: -3 }];
  assert.equal(resumoDaDiferenca(comZero).viradas, 1);
  const vaiEVolta = [{ dif: 1 }, { dif: -1 }, { dif: 2 }];
  assert.equal(resumoDaDiferenca(vaiEVolta).viradas, 2);
  const semTroca = [{ dif: 3 }, { dif: 5 }, { dif: 4 }];
  assert.equal(resumoDaDiferenca(semTroca).viradas, 0);
  // Série que só empata não tem lado nenhum.
  assert.equal(resumoDaDiferenca([{ dif: 0 }, { dif: 0 }]).viradas, 0);
});

test("os ocupantes de uma vaga vêm em blocos de rodadas seguidas", () => {
  const serie = serieDaDiferenca(edicao, { a: posicao(1), b: posicao(3) });
  assert.deepEqual(ocupantes(serie, "b"), [
    { equipe: "BETA (RJ)", de: 1, ate: 2 },
    { equipe: "ALFA (SP)", de: 3, ate: 3 },
  ]);
  assert.deepEqual(ocupantes(serie, "a"), [
    { equipe: "ALFA (SP)", de: 1, ate: 1 },
    { equipe: "GAMA (MG)", de: 2, ate: 3 },
  ]);
  assert.deepEqual(ocupantes([], "a"), []);
});
