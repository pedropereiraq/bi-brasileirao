/**
 * Os pontos que a tabela não recebeu.
 *
 * O que precisa de guarda é a identidade: possíveis = distribuídos + queimados
 * no empate + retidos em jogo por disputar + tirados no tapetão. Se ela abrir,
 * o card estará explicando uma diferença para a média com uma conta que não
 * fecha.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  aproveitamentoDaTabela, fluxoDePontos,
} from "../public/js/fluxo_de_pontos.js";

const jogo = (rodada, gp = null, gc = null) => ({
  rodada, realizado: gp !== null, gp, gc,
});

test("o empate queima um ponto, e o jogo por disputar retém três", () => {
  const partidas = [
    jogo(1, 2, 1),   // triunfo: distribui 3
    jogo(1, 1, 1),   // empate: distribui 2, queima 1
    jogo(1),         // não aconteceu: retém 3
  ];
  const [primeira] = fluxoDePontos(partidas);

  assert.equal(primeira.possiveis, 9);
  assert.equal(primeira.queimados, 1);
  assert.equal(primeira.retidos, 3);
  assert.equal(primeira.distribuidos, 5, "3 do triunfo mais 2 do empate");
});

test("a conta fecha em toda rodada", () => {
  const partidas = [
    jogo(1, 2, 1), jogo(1, 0, 0), jogo(1, 3, 2),
    jogo(2, 1, 1), jogo(2), jogo(2, 2, 0),
    jogo(3), jogo(3), jogo(3, 1, 0),
  ];
  const descontos = [{ rodada: 2, pontos: -4 }];
  for (const linha of fluxoDePontos(partidas, descontos)) {
    assert.equal(
      linha.distribuidos + linha.queimados + linha.retidos + linha.tapetao,
      linha.possiveis, `rodada ${linha.rodada}`);
  }
});

test("o tapetão tira ponto que a tabela já tinha recebido", () => {
  // Dois triunfos: seis pontos em disputa, seis distribuídos em campo. O
  // tribunal tira quatro, e eles passam a faltar na tabela.
  const partidas = [jogo(1, 2, 1), jogo(1, 1, 0)];
  const [linha] = fluxoDePontos(partidas, [{ rodada: 1, pontos: -4 }]);

  assert.equal(linha.possiveis, 6);
  assert.equal(linha.queimados, 0);
  assert.equal(linha.retidos, 0);
  assert.equal(linha.tapetao, 4);
  assert.equal(linha.faltando, 4);
  assert.equal(linha.distribuidos, 2);
  assert.equal(aproveitamentoDaTabela(linha), 2 / 6);
});

test("o desconto só conta da rodada dele em diante, e não volta", () => {
  const partidas = [jogo(1, 2, 1), jogo(2, 2, 1), jogo(3, 2, 1)];
  const fluxo = fluxoDePontos(partidas, [{ rodada: 2, pontos: -3 }]);

  assert.deepEqual(fluxo.map((l) => l.tapetao), [0, 3, 3]);
});

test("sem desconto nenhum a terceira parcela é zero, e não undefined", () => {
  const [linha] = fluxoDePontos([jogo(1, 1, 1)]);
  assert.equal(linha.tapetao, 0);
});

test("o acumulado cresce rodada a rodada", () => {
  const partidas = [jogo(1, 1, 1), jogo(2, 1, 1), jogo(3, 2, 0)];
  const fluxo = fluxoDePontos(partidas);

  assert.deepEqual(fluxo.map((l) => l.jogos), [1, 2, 3]);
  assert.deepEqual(fluxo.map((l) => l.queimados), [1, 2, 2]);
  assert.deepEqual(fluxo.map((l) => l.distribuidos), [2, 4, 7]);
});

test("sem jogo nenhum não há fluxo", () => {
  assert.deepEqual(fluxoDePontos([]), []);
  assert.equal(aproveitamentoDaTabela(undefined), null);
});

test("o aproveitamento da tabela é a fração que chegou", () => {
  const [linha] = fluxoDePontos([jogo(1, 1, 1), jogo(1, 2, 0)]);
  // 6 possíveis, 1 queimado no empate: 5 na tabela.
  assert.equal(aproveitamentoDaTabela(linha), 5 / 6);
});
