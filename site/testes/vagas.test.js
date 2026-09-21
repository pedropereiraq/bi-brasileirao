/**
 * As faixas de vaga e a ordenação da classificação.
 *
 * O que precisa de guarda: os intervalos que os limites padrão produzem — é
 * deles que sai a cor de cada linha do card —, o ajuste em cadeia quando um
 * limite invade o vizinho, e o critério por aproveitamento, que muda a ordem
 * e a posição de cada clube.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  limitesPadrao, limitesValidos, ordenarPor, zonaDaPosicao, zonasDaSerie,
} from "../public/js/vagas.js";

const nomes = (serie, limites) =>
  Array.from({ length: 20 }, (_, i) => zonaDaPosicao(i + 1, serie, limites).nome);

test("os limites padrão da Série A dão as cinco faixas do regulamento", () => {
  assert.deepEqual(limitesPadrao("A"), {
    libertadores: 4, preLibertadores: 5, sulAmericana: 11, permanencia: 16,
  });

  const faixas = nomes("A", limitesPadrao("A"));
  assert.deepEqual(faixas.slice(0, 4), Array(4).fill("libertadores"));
  assert.deepEqual(faixas.slice(4, 5), ["preLibertadores"]);
  assert.deepEqual(faixas.slice(5, 11), Array(6).fill("sulAmericana"));
  assert.deepEqual(faixas.slice(11, 16), Array(5).fill("permanencia"));
  assert.deepEqual(faixas.slice(16), Array(4).fill("rebaixamento"));
});

test("a Série B não tem faixa de continental: do 7º ao 16º é permanência", () => {
  assert.deepEqual(limitesPadrao("B"), {
    acesso: 4, mataMata: 6, permanencia: 16,
  });

  const faixas = nomes("B", limitesPadrao("B"));
  assert.deepEqual(faixas.slice(0, 4), Array(4).fill("acesso"));
  assert.deepEqual(faixas.slice(4, 6), Array(2).fill("mataMata"));
  assert.deepEqual(faixas.slice(6, 16), Array(10).fill("permanencia"));
  assert.deepEqual(faixas.slice(16), Array(4).fill("rebaixamento"));
});

test("um limite nunca passa por cima do vizinho", () => {
  // A pré-Libertadores puxada para trás empurra quem vem depois.
  const apertado = limitesValidos("A",
    { libertadores: 4, preLibertadores: 4, sulAmericana: 4, permanencia: 4 });
  assert.deepEqual(apertado,
    { libertadores: 4, preLibertadores: 5, sulAmericana: 6, permanencia: 7 });

  // E ninguém invade o rebaixamento: a última faixa para no 19º.
  const esticado = limitesValidos("A",
    { libertadores: 30, preLibertadores: 30, sulAmericana: 30, permanencia: 30 });
  assert.deepEqual(esticado,
    { libertadores: 16, preLibertadores: 17, sulAmericana: 18, permanencia: 19 });
  assert.equal(zonaDaPosicao(20, "A", esticado).nome, "rebaixamento");
});

test("as zonas saem com o intervalo de cada uma, para a legenda", () => {
  const zonas = zonasDaSerie("A", limitesPadrao("A"));
  assert.deepEqual(zonas.map((z) => [z.nome, z.de, z.ate]), [
    ["libertadores", 1, 4],
    ["preLibertadores", 5, 5],
    ["sulAmericana", 6, 11],
    ["permanencia", 12, 16],
    ["rebaixamento", 17, 20],
  ]);
  // As cores não dependem da marca: verde é vaga boa em qualquer canal.
  assert.deepEqual(zonas.map((z) => z.cor),
    ["verdeEscuro", "verdeClaro", "azul", "cinza", "vermelho"]);
});

/* ------------------------------------------------------------- ordenação */
const linha = (equipe, pts, j, extras = {}) => ({
  equipe, pts, j, t: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0,
  aproveitamento: j > 0 ? pts / (3 * j) : null, ...extras,
});

test("por pontos, a ordem é a que o motor já entregou", () => {
  const tabela = [linha("ALFA (SP)", 30, 15), linha("BETA (RJ)", 28, 15)];
  const saida = ordenarPor(tabela, "pontos");
  assert.deepEqual(saida.map((c) => [c.equipe, c.pos]),
    [["ALFA (SP)", 1], ["BETA (RJ)", 2]]);
});

test("por aproveitamento, quem jogou menos pode passar à frente", () => {
  // 20 em 8 jogos (83%) vale mais que 30 em 15 (67%).
  const tabela = [linha("ALFA (SP)", 30, 15), linha("BETA (RJ)", 20, 8)];
  const saida = ordenarPor(tabela, "aproveitamento");
  assert.deepEqual(saida.map((c) => [c.equipe, c.pos]),
    [["BETA (RJ)", 1], ["ALFA (SP)", 2]]);
});

test("sem jogo no recorte não há aproveitamento, e o clube vai para o fim", () => {
  const tabela = [linha("ALFA (SP)", 0, 0), linha("BETA (RJ)", 0, 3)];
  const saida = ordenarPor(tabela, "aproveitamento");
  assert.deepEqual(saida.map((c) => c.equipe), ["BETA (RJ)", "ALFA (SP)"]);
});

test("aproveitamento empatado cai nos desempates do regulamento", () => {
  const tabela = [
    linha("ALFA (SP)", 10, 5, { t: 3, sg: 1 }),
    linha("BETA (RJ)", 10, 5, { t: 3, sg: 4 }),
  ];
  const saida = ordenarPor(tabela, "aproveitamento");
  assert.deepEqual(saida.map((c) => c.equipe), ["BETA (RJ)", "ALFA (SP)"],
    "mesmo aproveitamento e mesmos triunfos: decide o saldo");
});
