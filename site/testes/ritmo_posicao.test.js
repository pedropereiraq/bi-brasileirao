/**
 * Aceleração e desaceleração por posição.
 *
 * O que precisa de guarda é de quem é o "depois". O sujeito é a posição: o
 * ritmo depois é o que **ela** rendeu até o fim, e não o que o clube que
 * estava nela foi fazer — quase nunca é o mesmo clube, e os dois nomes têm de
 * chegar juntos ao card. E edição em andamento fica de fora: sem fim, não há
 * depois.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  extremosDoRitmo, ritmoDasPosicoes, ritmoPorRodada,
} from "../public/js/ritmo_posicao.js";

const edicao = (ano, celulas, rodadas = 10) => ({ ano, rodadas, celulas });
const celula = (posicao, equipe, pontos, pontosFim, equipeFim = "OUTRO") =>
  ({ posicao, equipe, pontos, pontosFim, equipeFim });

// Duas edições de dez rodadas, analisadas na quinta. `pontosFim` é o do clube
// que TERMINOU na posição, e `equipeFim` diz quem foi.
const edicoes = [
  edicao(2020, [
    celula(1, "ALFA", 15, 20, "ZETA"),   // 3,0/rodada e depois 1,0
    celula(2, "BETA", 10, 25, "ALFA"),   // 2,0/rodada e depois 3,0
  ]),
  edicao(2021, [
    celula(1, "GAMA", 10, 20, "GAMA"),   // 2,0 e depois 2,0: manteve
    celula(2, "DELTA", 5, 20, "OMEGA"),  // 1,0 e depois 3,0
  ]),
];

const linhas = ritmoDasPosicoes(edicoes, { rodada: 5, posicoes: 2 });

test("o ritmo de cada posição sai da média das edições", () => {
  assert.equal(linhas[0].antes, 2.5, "3,0 e 2,0");
  assert.equal(linhas[0].depois, 1.5, "1,0 e 2,0");
  assert.equal(linhas[0].diferenca, -1);

  assert.equal(linhas[1].antes, 1.5);
  assert.equal(linhas[1].depois, 3);
  assert.equal(linhas[1].diferenca, 1.5);
});

test("o depois é o da posição, e os dois clubes viajam com ele", () => {
  const primeiro = linhas[0].porEdicao.find((e) => e.ano === 2020);
  // A posição tinha 15 pontos na 5ª e fechou com 20: cinco em cinco rodadas.
  assert.equal(primeiro.equipe, "ALFA", "quem estava lá na rodada");
  assert.equal(primeiro.equipeFim, "ZETA", "quem terminou lá");
  assert.equal(primeiro.depois, 1);
});

test("a contagem separa quem acelerou de quem desacelerou", () => {
  assert.deepEqual([linhas[0].aceleraram, linhas[0].desaceleraram], [0, 1]);
  assert.deepEqual([linhas[1].aceleraram, linhas[1].desaceleraram], [2, 0]);
});

test("edição sem fim fica de fora da conta", () => {
  const comAndamento = ritmoDasPosicoes([
    ...edicoes,
    edicao(2026, [celula(1, "EM CURSO", 12, null),
                  celula(2, "OUTRO", 9, null)]),
  ], { rodada: 5, posicoes: 2 });

  assert.equal(comAndamento[0].amostras, 2);
  assert.equal(comAndamento[0].antes, linhas[0].antes);
});

test("rodada no fim da edição não deixa depois nenhum", () => {
  const noFim = ritmoDasPosicoes(edicoes, { rodada: 10, posicoes: 2 });
  assert.equal(noFim[0].amostras, 0);
  assert.equal(noFim[0].diferenca, null);
});

test("os extremos são a manchete: quem mais acelera e quem mais desacelera", () => {
  const { acelera, desacelera } = extremosDoRitmo(linhas);
  assert.equal(acelera.posicao, 2);
  assert.equal(desacelera.posicao, 1);
  assert.deepEqual(extremosDoRitmo([]), { acelera: null, desacelera: null });
});

test("o ritmo rodada a rodada é o acumulado dividido pela rodada", () => {
  const serie = ritmoPorRodada([
    { rodada: 1, pontos: [3, 0] },
    { rodada: 2, pontos: [6, 3] },
    { rodada: 3, pontos: [] },
  ]);

  assert.equal(serie[0].ritmo, 1.5);
  assert.equal(serie[1].ritmo, 2.25);
  assert.equal(serie[2].ritmo, null, "rodada sem edição não tem ritmo");
});
