/**
 * De quem o clube tirou os pontos.
 *
 * Duas regras precisam de guarda. Jogo não realizado não entra em possível
 * nenhum — senão o aproveitamento contra um bloco cai só porque o returno
 * ainda não chegou. E o bloco é o da posição de **hoje** do adversário, que é
 * a tabela que se tem na mão quando se faz a pergunta.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  confrontosDoClube, extremosDosBlocos, pontosPorBloco,
} from "../public/js/adversarios.js";

const jogo = (adversario, mando, resultado, gp = 1, gc = 0) => ({
  adversario, mando, realizado: resultado !== null, resultado, gp, gc,
});

const posicoes = { LIDER: 1, VICE: 2, MEIO: 9, LANTERNA: 20 };
const posicaoDe = (equipe) => posicoes[equipe] ?? null;

const agenda = [
  jogo("LIDER", "casa", "T"),
  jogo("LIDER", "fora", "D"),
  jogo("VICE", "casa", "E"),
  jogo("VICE", "fora", null),      // ainda não aconteceu
  jogo("MEIO", "casa", "T"),
  jogo("MEIO", "fora", "T"),
  jogo("LANTERNA", "casa", "D"),
  jogo("LANTERNA", "fora", "E"),
];

const confrontos = confrontosDoClube(agenda, posicaoDe);

test("cada adversário junta os dois campos num registro só", () => {
  const contra = confrontos.find((c) => c.adversario === "LIDER");
  assert.equal(contra.casa.resultado, "T");
  assert.equal(contra.fora.resultado, "D");
  assert.equal(contra.pontos, 3);
  assert.equal(contra.posicao, 1);
});

test("jogo por disputar não conta como ponto perdido", () => {
  const contra = confrontos.find((c) => c.adversario === "VICE");
  assert.equal(contra.jogos, 1, "só o de casa aconteceu");
  assert.equal(contra.possiveis, 3);
  assert.equal(contra.aproveitamento, 1 / 3);
});

test("os blocos agrupam pela posição de hoje", () => {
  const blocos = pontosPorBloco(confrontos, { tamanho: 4, total: 20 });
  assert.deepEqual(blocos.map((b) => [b.de, b.ate]),
    [[1, 4], [5, 8], [9, 12], [13, 16], [17, 20]]);

  const topo = blocos[0];
  assert.equal(topo.adversarios, 2, "líder e vice");
  assert.equal(topo.pontos, 4, "3 do triunfo mais 1 do empate");
  assert.equal(topo.possiveis, 9, "três jogos disputados");

  const meio = blocos[2];
  assert.equal(meio.pontos, 6);
  assert.equal(meio.aproveitamento, 1);
});

test("dentro do bloco, cada campo tem a sua conta", () => {
  const [topo] = pontosPorBloco(confrontos, { tamanho: 4, total: 20 });
  assert.deepEqual([topo.casa.pontos, topo.casa.jogos], [4, 2]);
  assert.deepEqual([topo.fora.pontos, topo.fora.jogos], [0, 1]);
});

test("bloco sem adversário aparece vazio, e não some", () => {
  const [, segundo] = pontosPorBloco(confrontos, { tamanho: 4, total: 20 });
  assert.equal(segundo.adversarios, 0);
  assert.equal(segundo.aproveitamento, null);
});

test("o último bloco absorve a sobra em vez de virar um bloco de um", () => {
  const blocos = pontosPorBloco(confrontos, { tamanho: 4, total: 18 });
  assert.deepEqual(blocos.at(-1), blocos.find((b) => b.de === 13));
  assert.deepEqual([blocos.at(-1).de, blocos.at(-1).ate], [13, 18]);
});

test("os extremos ignoram bloco sem jogo", () => {
  const { melhor, pior } = extremosDosBlocos(
    pontosPorBloco(confrontos, { tamanho: 4, total: 20 }));
  assert.equal(melhor.de, 9, "100% contra o meio");
  assert.equal(pior.de, 17, "um ponto em dois jogos contra a lanterna");
  assert.deepEqual(extremosDosBlocos([]), { melhor: null, pior: null });
});
