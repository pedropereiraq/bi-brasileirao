/**
 * Os próximos jogos de um grupo de clubes.
 *
 * Duas coisas precisam de guarda. O tamanho da lista sai do clube que tem mais
 * jogos pela frente, e não do que tem menos — cortar pelo menor esconderia o
 * jogo a mais de quem tem partida adiada, que é justamente a informação que
 * explica a diferença de calendário. E sem jogo pela frente não há média: zero
 * ali se leria como "adversários fortíssimos".
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  clubesNaFaixa, mediaDosAdversarios, proximosJogos, tamanhoDaLista,
} from "../public/js/proximos_jogos.js";

const passo = (n, adversario, realizado) =>
  ({ n, realizado, jogo: { adversario, mando: n % 2 ? "casa" : "fora" } });

/** Agenda com `feitos` jogos disputados e o resto contra os adversários dados. */
const agenda = (feitos, futuros) => [
  ...Array.from({ length: feitos }, (_, i) => passo(i + 1, "JÁ (XX)", true)),
  ...futuros.map((adv, i) => passo(feitos + i + 1, adv, false)),
];

const classificacao = [
  { equipe: "ALFA (SP)", pos: 1, pts: 50 },
  { equipe: "BETA (RJ)", pos: 2, pts: 48 },
  { equipe: "GAMA (MG)", pos: 3, pts: 45 },
  { equipe: "DELTA (BA)", pos: 9, pts: 30 },
  { equipe: "ÔMEGA (CE)", pos: 20, pts: 12 },
];

test("a faixa devolve quem ocupa aquelas posições, na ordem da tabela", () => {
  assert.deepEqual(clubesNaFaixa(classificacao, { melhor: 1, pior: 3 })
    .map((c) => c.equipe), ["ALFA (SP)", "BETA (RJ)", "GAMA (MG)"]);
  assert.deepEqual(clubesNaFaixa(classificacao, { melhor: 9, pior: 9 })
    .map((c) => c.equipe), ["DELTA (BA)"]);
  assert.deepEqual(clubesNaFaixa(classificacao, { melhor: 4, pior: 8 }), []);
});

test("só o que ainda não aconteceu, na ordem em que vem", () => {
  const minha = agenda(30, ["BETA (RJ)", "GAMA (MG)", "ÔMEGA (CE)"]);
  assert.deepEqual(proximosJogos(minha).map((p) => p.n), [31, 32, 33]);
  assert.deepEqual(proximosJogos(minha).map((p) => p.jogo.adversario),
    ["BETA (RJ)", "GAMA (MG)", "ÔMEGA (CE)"]);
  assert.deepEqual(proximosJogos(minha, { quantos: 2 }).map((p) => p.n), [31, 32]);
});

test("campanha encerrada não tem próximo jogo", () => {
  assert.deepEqual(proximosJogos(agenda(38, [])), []);
});

test("a lista tem o tamanho de quem tem mais jogos pela frente", () => {
  // O segundo clube tem um jogo adiado: três pela frente contra dois.
  const agendas = [
    agenda(36, ["BETA (RJ)", "GAMA (MG)"]),
    agenda(35, ["ALFA (SP)", "GAMA (MG)", "ÔMEGA (CE)"]),
  ];
  assert.equal(tamanhoDaLista(agendas), 3);
  assert.equal(tamanhoDaLista(agendas, { teto: 2 }), 2, "o teto manda");
  assert.equal(tamanhoDaLista([agenda(38, [])]), 0);
  assert.equal(tamanhoDaLista([]), 0, "sem clube nenhum não estoura");
});

test("a média dos adversários usa a posição de hoje de cada um", () => {
  const posicaoDe = (equipe) =>
    classificacao.find((c) => c.equipe === equipe)?.pos;
  const jogos = proximosJogos(agenda(35, ["ALFA (SP)", "DELTA (BA)", "ÔMEGA (CE)"]));
  assert.equal(mediaDosAdversarios(jogos, posicaoDe), (1 + 9 + 20) / 3);
});

test("sem jogo pela frente, a média é nula e não zero", () => {
  assert.equal(mediaDosAdversarios([], () => 1), null);
  // Adversário fora da classificação não entra na conta nem vira zero.
  const jogos = proximosJogos(agenda(37, ["FANTASMA (XX)"]));
  assert.equal(mediaDosAdversarios(jogos, () => undefined), null);
});
