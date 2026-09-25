/**
 * Posições históricas de um clube.
 *
 * Duas regras precisam de guarda. A posição marcada conta como dentro — marcar
 * o 4º é perguntar pelo G4, e o G4 tem quatro clubes. E o eixo combinado põe a
 * Série B abaixo da A, de modo que a 1ª da B vem logo depois da 20ª da A: é o
 * que faz queda e acesso virarem degraus no mesmo gráfico.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  contagemDoCorte, doEixo, noEixo, resumoDaTrilha, trilhaFinal,
} from "../public/js/posicoes_historicas.js";

const trajetorias = [
  { ano: 2020, posicoes: [8, 6, 4, 3, 5] },
  { ano: 2021, posicoes: [] },              // sem participação
  { ano: 2022, posicoes: [1, 2, 2, 4, 9] },
];

test("a posição marcada conta como dentro do recorte", () => {
  const conta = contagemDoCorte(trajetorias, { alvo: 4 });
  // 2020: 4, 3 dentro; 2022: 1, 2, 2, 4 dentro.
  assert.deepEqual([conta.acima, conta.abaixo, conta.total], [6, 4, 10]);
  assert.equal(conta.fracao, .6);
  assert.equal(conta.edicoes, 2);
});

test("as rodadas iniciais podem sair da conta", () => {
  const conta = contagemDoCorte(trajetorias, { alvo: 4, ignorar: 3 });
  // Sobram 3 e 5 em 2020; 4 e 9 em 2022.
  assert.deepEqual([conta.acima, conta.abaixo, conta.total], [2, 2, 4]);
});

test("ano sem participação entra na lista, mas não na conta", () => {
  const conta = contagemDoCorte(trajetorias, { alvo: 4 });
  const vazio = conta.porAno.find((a) => a.ano === 2021);
  assert.equal(vazio.participou, false);
  assert.equal(vazio.total, 0);
});

test("o eixo combinado põe a série B abaixo da A", () => {
  assert.equal(noEixo("A", 20), 20);
  assert.equal(noEixo("B", 1), 21);
  assert.equal(noEixo("B", 20), 40);
  assert.deepEqual(doEixo(21), { serie: "B", posicao: 1 });
  assert.deepEqual(doEixo(4), { serie: "A", posicao: 4 });
  assert.equal(noEixo("A", null), null);
});

const edicoes = [
  { ano: 2022, serie: "A", posicao: 17 },
  { ano: 2023, serie: "B", posicao: 3 },
  { ano: 2024, serie: "A", posicao: 12 },
  { ano: 2025, serie: "A", posicao: null },
  { ano: 2026, serie: "A", posicao: 6, encerrada: false },
];

test("a trilha ignora ano sem posição e ordena por ano", () => {
  const trilha = trilhaFinal(edicoes);
  assert.deepEqual(trilha.map((p) => [p.ano, p.eixo]),
    [[2022, 17], [2023, 23], [2024, 12], [2026, 6]]);
  assert.equal(trilha.at(-1).encerrada, false);
});

test("o filtro de série corta a trilha", () => {
  assert.deepEqual(trilhaFinal(edicoes, { series: ["B"] }).map((p) => p.ano),
    [2023]);
});

test("o resumo sai do eixo, e não da posição dentro da série", () => {
  const resumo = resumoDaTrilha(trilhaFinal(edicoes));
  // O 3º da B (eixo 23) é pior que o 17º da A (eixo 17).
  assert.equal(resumo.melhor.ano, 2026);
  assert.equal(resumo.pior.ano, 2023);
  assert.deepEqual(resumo.porSerie, { A: 3, B: 1 });
});
