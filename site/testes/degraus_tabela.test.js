/**
 * Os degraus da tabela.
 *
 * O que precisa de guarda é o empate. Zero é distância de verdade — dois
 * clubes com a mesma pontuação, separados só pelo desempate —, e o degrau
 * zerado não pode sumir da lista nem virar um nível novo na régua.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  amplitudeDaTabela, degrausDaColuna, maiorDaSerie, maiorDegrau,
  niveisDePontos, serieDeDegraus,
} from "../public/js/degraus_tabela.js";

const clube = (posicao, equipe, pontos) => ({ posicao, equipe, pontos });

const coluna = [
  clube(1, "ALFA", 40),
  clube(2, "BETA", 34),
  clube(3, "GAMA", 34),
  clube(4, "DELTA", 33),
  clube(5, "EPSILON", 25),
];

test("cada clube tem a distância para o que vem logo abaixo", () => {
  const degraus = degrausDaColuna(coluna);
  assert.deepEqual(degraus.map((d) => [d.posicao, d.distancia]),
    [[1, 6], [2, 0], [3, 1], [4, 8]]);
  assert.equal(degraus.length, 4, "o lanterna não tem ninguém abaixo");
  assert.equal(degraus[1].abaixo.equipe, "GAMA");
});

test("os empatados dividem o mesmo nível da régua", () => {
  const niveis = niveisDePontos(coluna);
  assert.deepEqual(niveis.map((n) => [n.pontos, n.clubes.length]),
    [[40, 1], [34, 2], [33, 1], [25, 1]]);
});

test("a amplitude é o campeonato inteiro, do líder ao lanterna", () => {
  assert.equal(amplitudeDaTabela(coluna), 15);
  assert.equal(amplitudeDaTabela([]), null);
});

test("o maior degrau desempata pelo mais alto na tabela", () => {
  const empatados = degrausDaColuna([
    clube(1, "ALFA", 40), clube(2, "BETA", 35),
    clube(3, "GAMA", 35), clube(4, "DELTA", 30),
  ]);
  // Dois degraus de 5: o do 1º e o do 3º. Vale o primeiro.
  assert.equal(maiorDegrau(empatados).posicao, 1);
  assert.equal(maiorDegrau([]), null);
});

test("a série percorre as rodadas que a edição alcançou", () => {
  const serie = serieDeDegraus([
    { rodada: 1, celulas: [clube(1, "ALFA", 3), clube(2, "BETA", 0)] },
    { rodada: 2, celulas: [clube(1, "ALFA", 6), clube(2, "BETA", 0)] },
  ]);

  assert.deepEqual(serie.map((l) => [l.rodada, l.amplitude]), [[1, 3], [2, 6]]);
  assert.deepEqual(serie.map((l) => l.degraus[0].distancia), [3, 6]);

  const maior = maiorDaSerie(serie);
  assert.deepEqual([maior.rodada, maior.distancia], [2, 6]);
  assert.equal(maiorDaSerie([]), null);
});
