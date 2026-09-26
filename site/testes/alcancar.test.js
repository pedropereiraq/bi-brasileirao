/**
 * Jogos para alcançar X.
 *
 * O que precisa de guarda: as contas que o arquivo não traz — derrota e ponto
 * —, o jogo em que a curva alcança a marca, e o lugar de quem não alcançou,
 * que é uma resposta e não um buraco.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  alvoPadrao, curvaDaMetrica, edicoesDoClube, jogoQueAlcanca, maiorTotal,
  marcosDoClube, ordenarMarcos, resumoDosMarcos, situacaoAtual,
} from "../public/js/alcancar.js";

/** Uma campanha como o arquivo entrega: acumulados jogo a jogo. */
const campanha = (equipe, posFim, { v, e, gp, gc }) => [equipe, posFim, v, e, gp, gc];

// Cinco jogos: V, E, D, V, V.
const cinco = campanha("BAHIA (BA)", 5, {
  v: [1, 1, 1, 2, 3],
  e: [0, 1, 1, 1, 1],
  gp: [2, 3, 3, 5, 7],
  gc: [0, 1, 3, 3, 4],
});

const dados = {
  series: {
    A: {
      2024: [cinco],
      2025: [campanha("BAHIA (BA)", 12, {
        v: [0, 0, 1, 1, 2], e: [1, 2, 2, 3, 3], gp: [1, 1, 3, 3, 6],
        gc: [1, 2, 2, 4, 5],
      })],
      2026: [campanha("BAHIA (BA)", null, {
        v: [1, 2, 3], e: [0, 0, 0], gp: [3, 5, 8], gc: [0, 1, 1],
      })],
    },
  },
};

test("o que o arquivo não traz se deduz: derrota e ponto", () => {
  assert.deepEqual(curvaDaMetrica(cinco, "vitorias"), [1, 1, 1, 2, 3]);
  assert.deepEqual(curvaDaMetrica(cinco, "empates"), [0, 1, 1, 1, 1]);
  assert.deepEqual(curvaDaMetrica(cinco, "derrotas"), [0, 0, 1, 1, 1],
    "jogo menos vitória menos empate");
  assert.deepEqual(curvaDaMetrica(cinco, "pontos"), [3, 4, 4, 7, 10],
    "três por vitória, um por empate");
  assert.deepEqual(curvaDaMetrica(cinco, "golsPro"), [2, 3, 3, 5, 7]);
  assert.deepEqual(curvaDaMetrica(cinco, "golsContra"), [0, 1, 3, 3, 4]);
  assert.deepEqual(curvaDaMetrica(undefined, "pontos"), []);
});

test("o jogo que alcança é o primeiro a chegar na marca", () => {
  assert.equal(jogoQueAlcanca([3, 4, 4, 7, 10], 7), 4);
  assert.equal(jogoQueAlcanca([3, 4, 4, 7, 10], 4), 2, "empatar na marca conta");
  assert.equal(jogoQueAlcanca([3, 4, 4, 7, 10], 11), null);
  assert.equal(jogoQueAlcanca([], 1), null);
});

test("as edições do clube vêm da mais nova para a mais antiga", () => {
  assert.deepEqual(
    edicoesDoClube(dados, { serie: "A", equipe: "BAHIA (BA)" }).map((e) => e.ano),
    [2026, 2025, 2024]);
  assert.deepEqual(edicoesDoClube(dados, { serie: "B", equipe: "BAHIA (BA)" }), []);
});

test("cada edição responde em que jogo chegou, ou que não chegou", () => {
  // Pontos acumulados: 2026 [3,6,9], 2025 [1,2,5,6,9], 2024 [3,4,4,7,10].
  const sete = marcosDoClube(dados,
    { serie: "A", equipe: "BAHIA (BA)", metrica: "pontos", alvo: 7 });
  assert.deepEqual(sete.map((m) => [m.ano, m.jogos]),
    [[2026, 3], [2025, 5], [2024, 4]]);
  assert.equal(sete[1].total, 9, "2025 terminou com 9 pontos");
  assert.equal(sete[0].encerrada, false, "a edição em curso não tem desfecho");
  assert.equal(sete[2].posFim, 5);

  // Dez pontos: só 2024 chegou, no último jogo.
  const dez = marcosDoClube(dados,
    { serie: "A", equipe: "BAHIA (BA)", metrica: "pontos", alvo: 10 });
  assert.deepEqual(dez.map((m) => [m.ano, m.jogos]),
    [[2026, null], [2025, null], [2024, 5]]);
});

test("por jogos, quem chegou primeiro sobe e quem não chegou vai ao fim", () => {
  const sete = marcosDoClube(dados,
    { serie: "A", equipe: "BAHIA (BA)", metrica: "pontos", alvo: 7 });
  assert.deepEqual(ordenarMarcos(sete, "jogos").map((m) => m.ano),
    [2026, 2024, 2025], "3, 4 e 5 jogos");
  assert.deepEqual(ordenarMarcos(sete, "edicao").map((m) => m.ano),
    [2026, 2025, 2024]);

  const dez = marcosDoClube(dados,
    { serie: "A", equipe: "BAHIA (BA)", metrica: "pontos", alvo: 10 });
  assert.deepEqual(ordenarMarcos(dez, "jogos").map((m) => m.ano),
    [2024, 2026, 2025], "quem não chegou desce, o mais novo na frente");
});

test("entre os que não chegaram, quem chegou mais perto fica na frente", () => {
  const longe = [
    { ano: 2020, jogos: null, total: 3 },
    { ano: 2021, jogos: null, total: 8 },
    { ano: 2022, jogos: 12, total: 40 },
  ];
  assert.deepEqual(ordenarMarcos(longe, "jogos").map((m) => m.ano),
    [2022, 2021, 2020]);
});

test("o alvo padrão é a mediana dos totais, e cabe na régua", () => {
  const marcos = marcosDoClube(dados,
    { serie: "A", equipe: "BAHIA (BA)", metrica: "pontos", alvo: 1 });
  // Totais: 9 (2026), 9 (2025), 10 (2024) → mediana 9.
  assert.equal(alvoPadrao(marcos), 9);
  assert.equal(maiorTotal(marcos), 10);
  assert.equal(alvoPadrao([]), 1, "sem edição, a régua começa em 1");
});

test("a média de jogos conta só quem alcançou", () => {
  const todas = resumoDosMarcos(marcosDoClube(dados,
    { serie: "A", equipe: "BAHIA (BA)", metrica: "pontos", alvo: 7 }));
  assert.equal(todas.edicoes, 3);
  assert.equal(todas.alcancaram, 3);
  assert.equal(todas.media, 4, "3, 4 e 5 jogos");
  assert.equal(todas.maisRapido.ano, 2026);

  const resumo = resumoDosMarcos(marcosDoClube(dados,
    { serie: "A", equipe: "BAHIA (BA)", metrica: "pontos", alvo: 10 }));
  assert.equal(resumo.edicoes, 3);
  assert.equal(resumo.alcancaram, 1);
  assert.equal(resumo.media, 5, "os anos sem alcance ficam fora da média");
  assert.equal(resumo.maisRapido.ano, 2024);

  const vazio = resumoDosMarcos([{ ano: 2020, jogos: null, total: 2 }]);
  assert.equal(vazio.media, null);
  assert.equal(vazio.maisRapido, null);
});

test("a situação atual sai da edição mais nova, com o melhor na frente", () => {
  const dois = {
    series: {
      A: {
        2025: [campanha("ALFA (SP)", 1, { v: [1], e: [0], gp: [2], gc: [0] })],
        2026: [
          campanha("ALFA (SP)", null, { v: [1, 1], e: [0, 1], gp: [2, 2], gc: [0, 3] }),
          campanha("BETA (RJ)", null, { v: [0, 1], e: [1, 1], gp: [1, 4], gc: [1, 1] }),
        ],
      },
    },
  };

  const pontos = situacaoAtual(dois, { serie: "A", metrica: "pontos" });
  assert.equal(pontos.ano, 2026, "a edição mais nova é a de hoje");
  assert.deepEqual(pontos.clubes.map((c) => [c.equipe, c.valor]),
    [["ALFA (SP)", 4], ["BETA (RJ)", 4]]);

  // Em gols sofridos, menos é melhor: a lista vira do avesso.
  const sofridos = situacaoAtual(dois, { serie: "A", metrica: "golsContra" });
  assert.deepEqual(sofridos.clubes.map((c) => [c.equipe, c.valor]),
    [["BETA (RJ)", 1], ["ALFA (SP)", 3]]);

  assert.deepEqual(situacaoAtual(dois, { serie: "B", metrica: "pontos" }),
    { ano: null, clubes: [] });
});
