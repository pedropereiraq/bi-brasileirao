/**
 * Gols marcados, gols sofridos e a ordem em que a tela os põe.
 *
 * O que precisa de guarda aqui é a ordem — gols sofridos sobem e gols
 * marcados descem, e a média muda o ranking quando há jogo adiado — e o
 * afastamento dos escudos, que é a única parte do card que mexe em posição:
 * ela pode mover o desenho, nunca o dado.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  afastarEscudos, extremoDeGols, linhasDeGols, ordenarPorGols, resumoDaEdicao,
  retaDaTendencia, valorDe,
} from "../public/js/gols.js";

/** Um clube como o motor entrega: posição, pontos, jogos e os dois gols. */
const clube = (equipe, pos, { j = 10, gp = 10, gc = 10, pts = 15 } = {}) =>
  ({ equipe, pos, pts, j, gp, gc });

const edicao = [
  clube("ALFA (SP)", 1, { j: 10, gp: 20, gc: 5, pts: 24 }),
  clube("BETA (RJ)", 2, { j: 8, gp: 12, gc: 8, pts: 18 }),
  clube("GAMA (MG)", 3, { j: 10, gp: 12, gc: 12, pts: 14 }),
  clube("DELTA (BA)", 4, { j: 10, gp: 6, gc: 25, pts: 5 }),
];

test("a linha traz o total e o ritmo, e não inventa ritmo sem jogo", () => {
  const [alfa, beta] = linhasDeGols(edicao);
  assert.equal(alfa.gp, 20);
  assert.equal(alfa.sg, 15);
  assert.equal(alfa.gpPorJogo, 2);
  assert.equal(beta.gpPorJogo, 1.5, "12 gols em 8 jogos");

  const [sem] = linhasDeGols([clube("ZETA (CE)", 1, { j: 0, gp: 0, gc: 0 })]);
  assert.equal(sem.gpPorJogo, null, "sem jogo não há gols por jogo");
  assert.equal(valorDe(sem, "gp", "media"), null);
  assert.equal(valorDe(sem, "gp", "total"), 0);
});

test("por pontos, a ordem é a da classificação", () => {
  const ordem = ordenarPorGols(linhasDeGols(edicao), "pontos");
  assert.deepEqual(ordem.map((l) => l.pos), [1, 2, 3, 4]);
});

test("gols marcados descem; gols sofridos sobem", () => {
  const linhas = linhasDeGols(edicao);

  const pro = ordenarPorGols(linhas, "pro");
  assert.deepEqual(pro.map((l) => l.gp), [20, 12, 12, 6]);
  assert.equal(pro[1].equipe, "BETA (RJ)",
    "empate em gols mantém a ordem da tabela");

  const contra = ordenarPorGols(linhas, "contra");
  assert.deepEqual(contra.map((l) => l.gc), [5, 8, 12, 25],
    "o ranking de gols sofridos começa em quem sofreu menos");
});

test("a média muda o ranking de quem tem jogo a menos", () => {
  const linhas = linhasDeGols(edicao);
  // Beta marcou menos que Gama no total, mas marca mais por jogo.
  assert.deepEqual(ordenarPorGols(linhas, "pro", "total").map((l) => l.equipe),
    ["ALFA (SP)", "BETA (RJ)", "GAMA (MG)", "DELTA (BA)"]);
  assert.deepEqual(ordenarPorGols(linhas, "pro", "media").map((l) => l.equipe),
    ["ALFA (SP)", "BETA (RJ)", "GAMA (MG)", "DELTA (BA)"]);

  const comAdiado = linhasDeGols([
    clube("ALFA (SP)", 1, { j: 10, gp: 15 }),
    clube("BETA (RJ)", 2, { j: 5, gp: 10 }),
  ]);
  assert.deepEqual(ordenarPorGols(comAdiado, "pro", "total").map((l) => l.gp),
    [15, 10]);
  assert.deepEqual(
    ordenarPorGols(comAdiado, "pro", "media").map((l) => l.equipe),
    ["BETA (RJ)", "ALFA (SP)"], "2 por jogo passa à frente de 1,5");
});

test("clube sem jogo vai para o fim, e não vira a melhor defesa", () => {
  const linhas = linhasDeGols([
    ...edicao, clube("ZETA (CE)", 5, { j: 0, gp: 0, gc: 0, pts: 0 }),
  ]);
  const contra = ordenarPorGols(linhas, "contra");
  assert.equal(contra.at(-1).equipe, "ZETA (CE)");
  assert.equal(contra[0].equipe, "ALFA (SP)");
});

test("o resumo da edição soma um lado só, porque todo gol tem dois", () => {
  const resumo = resumoDaEdicao(linhasDeGols(edicao));
  assert.equal(resumo.gols, 50, "20 + 12 + 12 + 6");
  assert.equal(resumo.jogos, 19, "38 participações em jogos são 19 jogos");
  assert.equal(resumo.porJogo, 50 / 19);
  assert.equal(resumoDaEdicao([]).porJogo, null);
});

test("o extremo devolve a linha inteira, e ignora quem não jogou", () => {
  const linhas = linhasDeGols([
    ...edicao, clube("ZETA (CE)", 5, { j: 0, gp: 0, gc: 0 }),
  ]);
  assert.equal(extremoDeGols(linhas, "gp").equipe, "ALFA (SP)");
  assert.equal(extremoDeGols(linhas, "gc", { maior: false }).equipe,
    "ALFA (SP)", "melhor defesa é o menor número de gols sofridos");
  assert.equal(extremoDeGols(linhas, "gc").equipe, "DELTA (BA)");
  assert.equal(extremoDeGols([], "gp"), null);
});

test("a reta da tendência recupera a reta que gerou os pontos", () => {
  const linhas = linhasDeGols([
    clube("A (SP)", 1, { gp: 40 }), clube("B (SP)", 2, { gp: 35 }),
    clube("C (SP)", 3, { gp: 30 }), clube("D (SP)", 4, { gp: 25 }),
  ]);
  const reta = retaDaTendencia(linhas, "gp");
  assert.equal(reta.inclinacao, -5);
  assert.equal(reta.intercepto, 45);
  assert.equal(retaDaTendencia(linhas.slice(0, 2), "gp"), null);
});

test("escudos em cima um do outro se afastam; o ponto fica onde está", () => {
  const limites = { x0: 0, x1: 400, y0: 0, y1: 400 };
  const saida = afastarEscudos(
    [{ x: 200, y: 200, equipe: "A" }, { x: 200, y: 200, equipe: "B" }],
    { minimo: 30, limites });

  assert.equal(saida.length, 2);
  for (const p of saida) {
    assert.equal(p.x, 200, "o dado não se move");
    assert.equal(p.y, 200);
    assert.ok(p.desviado, "o desenho se move");
  }
  const distancia = Math.hypot(saida[0].xe - saida[1].xe,
                               saida[0].ye - saida[1].ye);
  assert.ok(distancia > 20, `ficaram a ${distancia.toFixed(1)} um do outro`);
});

test("escudos longe um do outro não se mexem, e ninguém sai do gráfico", () => {
  const limites = { x0: 0, x1: 400, y0: 0, y1: 400 };
  const pontos = [{ x: 20, y: 20 }, { x: 380, y: 380 }, { x: 20, y: 380 }];
  const saida = afastarEscudos(pontos, { minimo: 30, limites });

  for (const [i, p] of saida.entries()) {
    assert.equal(p.desviado, false, `escudo ${i} não precisava se mexer`);
  }

  // Um canto cheio: todos continuam dentro da moldura do gráfico.
  const amontoados = Array.from({ length: 8 }, () => ({ x: 395, y: 395 }));
  for (const p of afastarEscudos(amontoados, { minimo: 30, limites })) {
    assert.ok(p.xe >= limites.x0 && p.xe <= limites.x1, `x ${p.xe}`);
    assert.ok(p.ye >= limites.y0 && p.ye <= limites.y1, `y ${p.ye}`);
  }
});
