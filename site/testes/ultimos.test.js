/**
 * As colunas da tela de últimos X jogos.
 *
 * O que precisa de guarda é a régua das colunas: dez no meio do campeonato,
 * menos no começo, e nunca uma coluna que repita a tabela que está ao lado
 * dela. O resto da tela é desenho.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  jogosDaEdicao, posicoesDoClube, recortesDeUltimos, resumoDoRecorte,
  variacaoDaPosicao,
} from "../public/js/ultimos.js";

const linha = (equipe, pos, { pts = 10, j = 10 } = {}) => ({ equipe, pos, pts, j });

test("com o campeonato andado, são dez recortes, do 1 ao 10", () => {
  assert.deepEqual(recortesDeUltimos(28), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(recortesDeUltimos(11), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("no começo, o maior recorte para um jogo antes da tabela cheia", () => {
  // Com quatro jogos, "últimos 4" seria a própria classificação ao lado dela.
  assert.deepEqual(recortesDeUltimos(4), [1, 2, 3]);
  assert.deepEqual(recortesDeUltimos(2), [1]);
  assert.deepEqual(recortesDeUltimos(1), [], "um jogo só não tem o que recortar");
  assert.deepEqual(recortesDeUltimos(0), []);
});

test("os jogos da edição são os do clube que mais jogou", () => {
  assert.equal(jogosDaEdicao([
    linha("A (SP)", 1, { j: 27 }), linha("B (SP)", 2, { j: 28 }),
  ]), 28, "jogo adiado não encolhe a edição");
  assert.equal(jogosDaEdicao([]), 0);
  assert.equal(jogosDaEdicao(undefined), 0);
});

test("a posição do clube sai coluna a coluna, e some onde ele não está", () => {
  const colunas = [
    { tabela: [linha("A (SP)", 1), linha("B (SP)", 2)] },
    { tabela: [linha("B (SP)", 1), linha("A (SP)", 2)] },
    { tabela: [linha("B (SP)", 1)] },
  ];
  assert.deepEqual(posicoesDoClube(colunas, "A (SP)"), [1, 2, null]);
  assert.deepEqual(posicoesDoClube(colunas, "C (SP)"), [null, null, null]);
});

test("subir na tabela é variação positiva, mesmo sendo número menor", () => {
  assert.equal(variacaoDaPosicao(12, 4), 8, "do 12º ao 4º são oito para cima");
  assert.equal(variacaoDaPosicao(4, 12), -8);
  assert.equal(variacaoDaPosicao(4, 4), 0);
  assert.equal(variacaoDaPosicao(null, 4), null);
  assert.equal(variacaoDaPosicao(4, null), null);
});

test("o resumo traz o aproveitamento do recorte e o que ele mudou", () => {
  const resumo = resumoDoRecorte(
    { equipe: "BAHIA (BA)", pos: 3, pts: 10, j: 5 }, 8);
  assert.equal(resumo.pts, 10);
  assert.equal(resumo.aproveitamento, 10 / 15);
  assert.equal(resumo.variacao, 5);

  const parado = resumoDoRecorte({ equipe: "X (SP)", pos: 1, pts: 0, j: 0 }, 1);
  assert.equal(parado.aproveitamento, null, "sem jogo não há aproveitamento");
  assert.equal(resumoDoRecorte(null, 1), null);
});
