/**
 * A dificuldade da tabela.
 *
 * O que precisa de guarda é o cruzamento das três escolhas. Duas regras em
 * especial: considerar o local usa a tabela do adversário **no campo do jogo**
 * (quem visita enfrenta o mandante), e a escala de dureza tem de apontar para
 * o mesmo lado nos dois critérios, embora em posição o número baixo seja o
 * adversário forte e em aproveitamento seja o alto.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  dificuldadeDosClubes, escalaDaDureza, faixaDaPosicao, ordenarDificuldade,
} from "../public/js/dificuldade_tabela.js";

const tabela = (pares) => Object.fromEntries(
  pares.map(([equipe, pos, aproveitamento]) =>
    [equipe, { pos, aproveitamento }]));

// ALFA joga com os três outros: dois já aconteceram, um ainda vem.
const agendas = {
  ALFA: [
    { adversario: "BETA", mando: "casa", realizado: true, rodada: 1 },
    { adversario: "GAMA", mando: "fora", realizado: true, rodada: 2 },
    { adversario: "DELTA", mando: "fora", realizado: false, rodada: 3 },
  ],
  BETA: [{ adversario: "ALFA", mando: "fora", realizado: true, rodada: 1 }],
};

const geral = tabela([["ALFA", 1, .8], ["BETA", 2, .7],
                      ["GAMA", 3, .5], ["DELTA", 18, .2]]);
const casa = tabela([["ALFA", 1, .9], ["BETA", 4, .4],
                     ["GAMA", 2, .8], ["DELTA", 3, .7]]);
const fora = tabela([["ALFA", 2, .6], ["BETA", 1, .9],
                     ["GAMA", 18, .1], ["DELTA", 20, .0]]);

const doClube = (linhas, equipe) => linhas.find((l) => l.equipe === equipe);

test("sem considerar o local, o adversário vale a tabela geral", () => {
  const linhas = dificuldadeDosClubes({ agendas, geral, casa, fora,
    quando: "realizados", local: "ignorar", criterio: "posicao" });

  // BETA é o 2º, GAMA o 3º.
  assert.equal(doClube(linhas, "ALFA").media, 2.5);
});

test("considerando o local, vale a tabela do campo em que o jogo acontece", () => {
  const linhas = dificuldadeDosClubes({ agendas, geral, casa, fora,
    quando: "realizados", local: "considerar", criterio: "posicao" });

  // ALFA recebeu BETA (BETA é visitante: 1º na tabela de fora) e visitou GAMA
  // (GAMA é mandante: 2º na tabela de casa).
  assert.equal(doClube(linhas, "ALFA").media, 1.5);
});

test("os jogos a realizar são outro recorte, e não o resto do mesmo", () => {
  const linhas = dificuldadeDosClubes({ agendas, geral, casa, fora,
    quando: "aRealizar", local: "ignorar", criterio: "posicao" });
  const alfa = doClube(linhas, "ALFA");

  assert.equal(alfa.total, 1);
  assert.equal(alfa.media, 18, "só sobrou o DELTA");
  assert.equal(alfa.contagem.z4, 1);
  assert.equal(alfa.contagem.g4, 0);

  // Clube sem jogo pela frente aparece, e aparece vazio.
  const beta = doClube(linhas, "BETA");
  assert.equal(beta.total, 0);
  assert.equal(beta.media, null);
});

test("por aproveitamento, a conta muda de unidade mas não de recorte", () => {
  const linhas = dificuldadeDosClubes({ agendas, geral, casa, fora,
    quando: "realizados", local: "ignorar", criterio: "aproveitamento" });

  assert.equal(doClube(linhas, "ALFA").media, (.7 + .5) / 2);
});

test("a dificuldade separada por mando sai dos mesmos jogos", () => {
  const alfa = doClube(dificuldadeDosClubes({ agendas, geral, casa, fora,
    quando: "realizados", local: "ignorar", criterio: "posicao" }), "ALFA");

  assert.equal(alfa.mediaCasa, 2, "em casa só recebeu o BETA");
  assert.equal(alfa.mediaFora, 3, "fora só visitou o GAMA");
});

test("as faixas partem a tabela em cinco blocos de quatro", () => {
  assert.equal(faixaDaPosicao(1), "g4");
  assert.equal(faixaDaPosicao(4), "g4");
  assert.equal(faixaDaPosicao(5), "g8");
  assert.equal(faixaDaPosicao(12), "g12");
  assert.equal(faixaDaPosicao(16), "g16");
  assert.equal(faixaDaPosicao(20), "z4");
});

test("a dureza aponta para o mesmo lado nos dois critérios", () => {
  const linhas = [{ media: 4 }, { media: 10 }, { media: 16 }];

  const porPosicao = escalaDaDureza(linhas, "posicao");
  assert.equal(porPosicao(4), 1, "adversários no topo: tabela duríssima");
  assert.equal(porPosicao(16), 0);

  const porAproveitamento = escalaDaDureza(linhas, "aproveitamento");
  assert.equal(porAproveitamento(16), 1, "adversários pontuando muito");
  assert.equal(porAproveitamento(4), 0);
});

test("a ordem por dificuldade põe o mais duro na frente, e o vazio no fim", () => {
  const linhas = [
    { equipe: "FACIL", pos: 1, media: 15 },
    { equipe: "VAZIO", pos: 2, media: null },
    { equipe: "DURO", pos: 3, media: 5 },
  ];

  assert.deepEqual(
    ordenarDificuldade(linhas, { ordem: "dificuldade", criterio: "posicao" })
      .map((l) => l.equipe),
    ["DURO", "FACIL", "VAZIO"]);

  assert.deepEqual(
    ordenarDificuldade(linhas, { ordem: "classificacao", criterio: "posicao" })
      .map((l) => l.equipe),
    ["FACIL", "DURO", "VAZIO"]);
});
