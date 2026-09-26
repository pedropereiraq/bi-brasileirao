/**
 * A média móvel dos últimos X jogos.
 *
 * O que precisa de guarda é a janela: ela tem sempre o mesmo tamanho, anda um
 * jogo por vez e só existe a partir do X-ésimo jogo. Meia janela não é uma
 * janela menor — é uma conta que não se pode fazer.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  mediaMovel, pontosPorJogo, referenciaDaPosicao, resumoDaSerie, valorDaJanela,
} from "../public/js/media_movel.js";

/** A campanha como `grafico_campanha` entrega: um passo por jogo do calendário. */
const passo = (n, resultado, rodada = n) => ({
  n, realizado: resultado !== null,
  jogo: { rodada, resultado, adversario: `ADV${n}` },
});

// T E D T T D E T  →  3 1 0 3 3 0 1 3
const campanha = [
  passo(1, "T"), passo(2, "E"), passo(3, "D"), passo(4, "T"),
  passo(5, "T"), passo(6, "D"), passo(7, "E"), passo(8, "T"),
  passo(9, null), // ainda não aconteceu
];

test("só jogo disputado entra, e ele vale o que rendeu", () => {
  const jogos = pontosPorJogo(campanha);
  assert.deepEqual(jogos.map((j) => j.pontos), [3, 1, 0, 3, 3, 0, 1, 3]);
  assert.deepEqual(jogos.map((j) => j.n), [1, 2, 3, 4, 5, 6, 7, 8],
    "a numeração é a dos jogos disputados, sem buraco");
  assert.deepEqual(pontosPorJogo([]), []);
});

test("cada ponto é uma janela do mesmo tamanho, andando um jogo por vez", () => {
  const serie = mediaMovel(pontosPorJogo(campanha), 3);

  assert.deepEqual(serie.map((j) => [j.de, j.ate]),
    [[1, 3], [2, 4], [3, 5], [4, 6], [5, 7], [6, 8]]);
  assert.deepEqual(serie.map((j) => j.pontos), [4, 4, 6, 6, 4, 4]);
  assert.equal(serie[0].media, 4 / 3);
  assert.equal(serie.at(-1).ate, 8, "o ponto mais à direita é o jogo mais novo");
  assert.deepEqual(serie.at(-1).jogos.map((j) => j.n), [6, 7, 8]);
});

test("sem jogos para uma janela inteira, não há conta a fazer", () => {
  const jogos = pontosPorJogo(campanha);
  assert.deepEqual(mediaMovel(jogos, 20), []);
  assert.deepEqual(mediaMovel(jogos, 0), []);
  assert.deepEqual(mediaMovel([], 5), []);

  // Janela igual ao número de jogos dá um ponto só: a campanha inteira.
  const unica = mediaMovel(jogos, 8);
  assert.equal(unica.length, 1);
  assert.equal(unica[0].pontos, 14);
});

test("o aproveitamento é a mesma média dividida por três", () => {
  const [janela] = mediaMovel(pontosPorJogo(campanha), 3);
  assert.equal(valorDaJanela(janela, "pontuacao"), 4 / 3);
  assert.equal(valorDaJanela(janela, "aproveitamento"), 4 / 9);
});

test("o resumo traz a janela de hoje e os dois extremos", () => {
  const resumo = resumoDaSerie(mediaMovel(pontosPorJogo(campanha), 3));

  assert.equal(resumo.atual.ate, 8);
  assert.deepEqual([resumo.melhor.de, resumo.melhor.ate], [3, 5],
    "o melhor empatado fica com a primeira aparição");
  assert.deepEqual([resumo.pior.de, resumo.pior.ate], [1, 3]);
  assert.equal(resumoDaSerie([]), null);
});

test("a régua de uma posição vira pontos por jogo", () => {
  const estatisticas = [
    { posicao: 1, media: 76 }, { posicao: 2, media: 68 },
    { posicao: 3, media: null },
  ];
  const lider = referenciaDaPosicao(estatisticas, 1, 38);
  assert.equal(lider.pontos, 76);
  assert.equal(lider.media, 2);

  assert.equal(referenciaDaPosicao(estatisticas, 3, 38), null,
    "posição sem média não vira linha");
  assert.equal(referenciaDaPosicao(estatisticas, 9, 38), null);
  assert.equal(referenciaDaPosicao(estatisticas, 1, 0), null);
});
