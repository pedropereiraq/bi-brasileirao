/**
 * Aceleração e desaceleração por posição.
 *
 * O que precisa de guarda é de quem é o "depois". O sujeito é a posição, e as
 * duas pontas são medidas do mesmo jeito: pontos da posição divididos pela
 * rodada. O depois é a **média** desse ritmo nas rodadas seguintes, e não a
 * subtração das duas pontas — subtrair misturaria os totais de dois clubes
 * diferentes, e o resultado não seria o ritmo de ninguém.
 *
 * E edição em andamento fica de fora: sem fim, não há depois.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  extremosDoRitmo, ritmoDasPosicoes, ritmoPorRodada,
} from "../public/js/ritmo_posicao.js";

const edicao = (ano, celulas, rodadas = 10) => ({ ano, rodadas, celulas });

/**
 * `seguintes` é a pontuação da posição em cada rodada depois da analisada.
 * Aqui ela anda de `passo` em `passo` a partir de `pontos`, o que deixa o
 * ritmo de cada rodada seguinte fácil de conferir na mão.
 */
const celula = (posicao, equipe, pontos, passo, pontosFim,
                equipeFim = "OUTRO", rodada = 5, rodadas = 10) => ({
  posicao, equipe, pontos, pontosFim, equipeFim,
  seguintes: Array.from({ length: rodadas - rodada }, (_, i) => ({
    rodada: rodada + i + 1,
    pontos: pontos + passo * (i + 1),
  })),
});

// Duas edições de dez rodadas, analisadas na quinta.
const edicoes = [
  edicao(2020, [
    // 15 na 5ª (3,0/rodada) e +1 por rodada: 16/6, 17/7 … 20/10, média 2,29.
    celula(1, "ALFA", 15, 1, 20, "ZETA"),
    // 10 na 5ª (2,0) e +3 por rodada: 13/6, 16/7 … 25/10, média 2,35.
    celula(2, "BETA", 10, 3, 25, "ALFA"),
  ]),
  edicao(2021, [
    // 10 na 5ª (2,0) e +2 por rodada: 12/6, 14/7 … 20/10, exatamente 2,0.
    celula(1, "GAMA", 10, 2, 20, "GAMA"),
    // 5 na 5ª (1,0) e +3 por rodada: 8/6, 11/7 … 20/10, média 1,71.
    celula(2, "DELTA", 5, 3, 20, "OMEGA"),
  ]),
];

const arredondar = (v) => Math.round(v * 100) / 100;

const linhas = ritmoDasPosicoes(edicoes, { rodada: 5, posicoes: 2 });

test("o ritmo de cada posição sai da média das edições", () => {
  assert.equal(linhas[0].antes, 2.5, "3,0 e 2,0");
  assert.equal(arredondar(linhas[0].depois), 2.15, "2,29 e 2,0");
  assert.equal(arredondar(linhas[0].diferenca), -0.35);

  assert.equal(linhas[1].antes, 1.5, "2,0 e 1,0");
  assert.equal(arredondar(linhas[1].depois), 2.03, "2,35 e 1,71");
  assert.equal(arredondar(linhas[1].diferenca), 0.53);
});

test("o depois é a média dos ritmos das rodadas seguintes", () => {
  const primeiro = linhas[0].porEdicao.find((e) => e.ano === 2020);
  assert.equal(primeiro.equipe, "ALFA", "quem estava lá na rodada");
  assert.equal(primeiro.equipeFim, "ZETA", "quem terminou lá");

  // 16/6 + 17/7 + 18/8 + 19/9 + 20/10, dividido por cinco.
  const mao = [16 / 6, 17 / 7, 18 / 8, 19 / 9, 20 / 10]
    .reduce((s, v) => s + v, 0) / 5;
  assert.equal(primeiro.depois, mao);

  // E não é a subtração das pontas, que daria 1,0 — a conta que misturava os
  // totais de dois clubes diferentes.
  assert.notEqual(arredondar(primeiro.depois), 1);
});

test("posição que não muda de ritmo não acelera nem freia", () => {
  // GAMA: 10 na 5ª e +2 por rodada, então 2,0 em todas as rodadas seguintes.
  const parado = linhas[0].porEdicao.find((e) => e.ano === 2021);
  assert.equal(parado.antes, 2);
  assert.equal(parado.depois, 2);
  assert.equal(parado.diferenca, 0);
});

test("a contagem separa quem acelerou de quem desacelerou", () => {
  // Na 1ª posição, 2020 freou (3,0 → 2,29) e 2021 ficou parado em 2,0.
  assert.deepEqual([linhas[0].aceleraram, linhas[0].desaceleraram], [0, 1]);
  assert.deepEqual([linhas[1].aceleraram, linhas[1].desaceleraram], [2, 0]);
});

test("edição sem fim fica de fora da conta", () => {
  const comAndamento = ritmoDasPosicoes([
    ...edicoes,
    edicao(2026, [celula(1, "EM CURSO", 12, 1, null),
                  celula(2, "OUTRO", 9, 1, null)]),
  ], { rodada: 5, posicoes: 2 });

  assert.equal(comAndamento[0].amostras, 2);
  assert.equal(comAndamento[0].antes, linhas[0].antes);
});

test("rodada no fim da edição não deixa depois nenhum", () => {
  // Na última rodada não há rodada seguinte, e `seguintes` chega vazio.
  const semDepois = [edicao(2020, [
    { posicao: 1, equipe: "ALFA", pontos: 20, pontosFim: 20,
      equipeFim: "ALFA", seguintes: [] },
  ])];
  const noFim = ritmoDasPosicoes(semDepois, { rodada: 10, posicoes: 1 });

  assert.equal(noFim[0].amostras, 0);
  assert.equal(noFim[0].diferenca, null);
});

test("a variação é relativa ao que a posição vinha rendendo", () => {
  // 1ª posição: 2,5 antes e 2,15 depois, que é 14% menos.
  assert.equal(arredondar(linhas[0].variacao * 100), -14.17);
  assert.equal(arredondar(linhas[1].variacao * 100), 35.44);

  // Posição que não pontuou nada até a rodada não tem de quanto variar.
  const zerada = ritmoDasPosicoes([edicao(2020, [
    { posicao: 1, equipe: "ALFA", pontos: 0, pontosFim: 10, equipeFim: "ALFA",
      seguintes: [{ rodada: 6, pontos: 3 }] },
  ])], { rodada: 5, posicoes: 1 });
  assert.equal(zerada[0].variacao, null);
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
