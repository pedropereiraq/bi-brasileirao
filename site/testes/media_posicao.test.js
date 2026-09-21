/**
 * A grade de pontuação por posição e rodada.
 *
 * Duas regras precisam de guarda. A edição que ainda não chegou àquela rodada
 * não tem coluna — preencher com o que ela tem hoje seria inventar um número
 * que nunca existiu. E a edição em andamento fica fora da média: ela é a que
 * se quer comparar com a média, e entrar nela seria comparar um número com ele
 * mesmo diluído.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  anosComRodada, colunaDaEdicao, comparacaoComAMedia, estatisticasPorPosicao,
  grade, rodadaCorrente, rodadaMaxima, POSICOES,
} from "../public/js/media_posicao.js";

/**
 * Uma edição de faz-de-conta com 4 clubes, para as contas caberem na cabeça.
 * `porRodada` é [[pontos do 1º, do 2º, ...], ...].
 */
const edicao = (porRodada, { encerrada = true } = {}) => ({
  clubes: ["ALFA (SP)", "BETA (RJ)", "GAMA (MG)", "DELTA (BA)"],
  fim: encerrada
    ? porRodada.at(-1).map((pts, i) => [i + 1, pts])
    : [null, null, null, null],
  rodadas: porRodada.length,
  encerrada,
  grade: porRodada.map((pontos) => pontos.map((pts, i) => [i, pts])),
});

const dados = {
  series: {
    A: {
      2020: edicao([[3, 3, 1, 0], [6, 4, 2, 1], [9, 5, 3, 2]]),
      2021: edicao([[3, 1, 1, 0], [6, 4, 2, 0], [7, 6, 3, 1]]),
      2026: edicao([[3, 3, 0, 0], [6, 3, 1, 1]], { encerrada: false }),
    },
  },
};

test("só os anos que chegaram àquela rodada entram", () => {
  assert.deepEqual(anosComRodada(dados, { serie: "A", rodada: 2 }),
    [2020, 2021, 2026]);
  assert.deepEqual(anosComRodada(dados, { serie: "A", rodada: 3 }),
    [2020, 2021], "2026 só tem duas rodadas");
  assert.deepEqual(anosComRodada(dados, { serie: "B", rodada: 1 }), []);
  assert.deepEqual(anosComRodada(undefined, { serie: "A", rodada: 1 }), []);
});

test("a rodada máxima e a corrente", () => {
  assert.equal(rodadaMaxima(dados, { serie: "A" }), 3);
  // A corrente é a da edição sem desfecho.
  assert.equal(rodadaCorrente(dados, { serie: "A" }), 2);
  // Sem edição em andamento, a corrente é a última possível.
  const sóEncerradas = { series: { A: { 2020: dados.series.A[2020] } } };
  assert.equal(rodadaCorrente(sóEncerradas, { serie: "A" }), 3);
});

test("a coluna traz quem estava em cada posição, e onde terminou", () => {
  const coluna = colunaDaEdicao(dados, { serie: "A", ano: 2020, rodada: 2 });
  assert.deepEqual(coluna.celulas.map((c) => [c.posicao, c.equipe, c.pontos]),
    [[1, "ALFA (SP)", 6], [2, "BETA (RJ)", 4],
     [3, "GAMA (MG)", 2], [4, "DELTA (BA)", 1]]);
  // O desfecho é o da edição, não o da rodada.
  assert.deepEqual(coluna.celulas.map((c) => [c.posFim, c.pontosFim]),
    [[1, 9], [2, 5], [3, 3], [4, 2]]);
});

test("edição que não chegou à rodada não tem coluna", () => {
  assert.equal(colunaDaEdicao(dados, { serie: "A", ano: 2026, rodada: 3 }), null);
  assert.equal(colunaDaEdicao(dados, { serie: "A", ano: 1999, rodada: 1 }), null);
  assert.deepEqual(grade(dados, { serie: "A", rodada: 3 }).map((c) => c.ano),
    [2020, 2021]);
});

test("a edição em andamento tem coluna, mas não desfecho", () => {
  const coluna = colunaDaEdicao(dados, { serie: "A", ano: 2026, rodada: 2 });
  assert.equal(coluna.encerrada, false);
  assert.ok(coluna.celulas.every((c) => c.posFim === null && c.pontosFim === null));
});

test("a média por posição ignora a edição em andamento", () => {
  const colunas = grade(dados, { serie: "A", rodada: 2 });
  assert.equal(colunas.length, 3, "a grade mostra as três");

  const estatisticas = estatisticasPorPosicao(colunas);
  // 1º lugar na rodada 2: 6 em 2020 e 6 em 2021. O 6 de 2026 não conta.
  assert.deepEqual(estatisticas[0], { posicao: 1, minimo: 6, media: 6, maximo: 6, n: 2 });
  // 2º: 4 e 4. O 3 de 2026 ficaria de fora e não puxa a média.
  assert.deepEqual(estatisticas[1], { posicao: 2, minimo: 4, media: 4, maximo: 4, n: 2 });
  // 4º: 1 e 0.
  assert.deepEqual(estatisticas[3], { posicao: 4, minimo: 0, media: 0.5, maximo: 1, n: 2 });
});

test("sem edição encerrada, a estatística é vazia e não estoura", () => {
  const só2026 = { series: { A: { 2026: dados.series.A[2026] } } };
  const estatisticas = estatisticasPorPosicao(grade(só2026, { serie: "A", rodada: 2 }));
  assert.equal(estatisticas.length, POSICOES);
  assert.deepEqual(estatisticas[0],
    { posicao: 1, minimo: null, media: null, maximo: null, n: 0 });
});

test("a comparação diz quanto cada posição está acima ou abaixo da média", () => {
  const colunas = grade(dados, { serie: "A", rodada: 2 });
  const estatisticas = estatisticasPorPosicao(colunas);
  const atual = colunas.find((c) => c.ano === 2026);

  const comparada = comparacaoComAMedia(atual, estatisticas);
  assert.deepEqual(comparada.map((c) => c.diferenca), [0, -1, -1, 0.5]);
  assert.deepEqual(comparada.map((c) => c.pontos), [6, 3, 1, 1]);

  assert.deepEqual(comparacaoComAMedia(null, estatisticas), []);
});
