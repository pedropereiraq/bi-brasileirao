/**
 * Os próximos jogos de um grupo de clubes.
 *
 * Duas coisas precisam de guarda. O tamanho da lista sai do clube que tem mais
 * jogos pela frente, e não do que tem menos — cortar pelo menor esconderia o
 * jogo a mais de quem tem partida adiada, que é justamente a informação que
 * explica a diferença de calendário. E sem jogo pela frente não há média: zero
 * ali se leria como "adversários fortíssimos".
 *
 * O confronto direto também precisa de guarda: ele conta nas duas colunas, e
 * só o adversário que está na tela entra — o filtro é uma faixa de posições, e
 * quem caiu fora dela não é concorrente de ninguém ali.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  TETO_CONFRONTOS, cabemConfrontos, clubesNaFaixa, confrontosDiretos,
  escalaDeDificuldade, jogosPorMando, mediaDosAdversarios, proximosJogos,
  tamanhoDaLista,
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

test("a dificuldade é medida contra as outras colunas da tela", () => {
  const escala = escalaDeDificuldade([9.1, 12.1, 8.3, null]);
  assert.equal(escala(8.3), 0, "a menor média é a tabela mais dura");
  assert.equal(escala(12.1), 1, "a maior média é a mais leve");
  assert.ok(escala(9.1) > 0 && escala(9.1) < 1, "o meio fica no meio");
  assert.equal(escala(null), .5, "sem média não há dificuldade");
});

test("sem nada para comparar, a dificuldade fica no meio", () => {
  assert.equal(escalaDeDificuldade([9.1])(9.1), .5, "uma coluna só");
  assert.equal(escalaDeDificuldade([7, 7])(7), .5, "empate geral");
  assert.equal(escalaDeDificuldade([])(3), .5, "lista vazia não estoura");
});

test("o mando separa os próximos jogos em duas metades", () => {
  // O ajudante alterna o mando pela paridade de `n`: 36 é fora, 37 é casa.
  const jogos = proximosJogos(agenda(35, ["ALFA (SP)", "BETA (RJ)", "GAMA (MG)"]));
  const { casa, fora } = jogosPorMando(jogos);
  assert.deepEqual(casa.map((p) => p.n), [37]);
  assert.deepEqual(fora.map((p) => p.n), [36, 38]);
  assert.equal(casa.length + fora.length, jogos.length, "ninguém se perde");
});

test("sem jogo pela frente as duas metades ficam vazias", () => {
  assert.deepEqual(jogosPorMando([]), { casa: [], fora: [] });
});

test("a média por mando é a média geral restrita àquela metade", () => {
  const posicaoDe = (equipe) =>
    classificacao.find((c) => c.equipe === equipe)?.pos;
  // 36 fora contra ALFA (1º), 37 em casa contra DELTA (9º), 38 fora contra ÔMEGA (20º).
  const jogos = proximosJogos(agenda(35, ["ALFA (SP)", "DELTA (BA)", "ÔMEGA (CE)"]));
  const { casa, fora } = jogosPorMando(jogos);
  assert.equal(mediaDosAdversarios(casa, posicaoDe), 9);
  assert.equal(mediaDosAdversarios(fora, posicaoDe), (1 + 20) / 2);
});

test("confronto direto é só contra quem está na tela", () => {
  const naTela = ["ALFA (SP)", "BETA (RJ)", "GAMA (MG)"];
  const jogos = proximosJogos(
    agenda(35, ["BETA (RJ)", "DELTA (BA)", "GAMA (MG)"]));
  assert.deepEqual(confrontosDiretos(jogos, naTela).map((p) => p.jogo.adversario),
    ["BETA (RJ)", "GAMA (MG)"], "DELTA está fora da faixa e não conta");
  assert.equal(confrontosDiretos(jogos, []).length, 0, "tela vazia, nada direto");
});

test("o mesmo jogo é confronto direto para os dois lados", () => {
  const naTela = ["ALFA (SP)", "BETA (RJ)"];
  const doAlfa = proximosJogos(agenda(37, ["BETA (RJ)"]));
  const doBeta = proximosJogos(agenda(37, ["ALFA (SP)"]));
  assert.equal(confrontosDiretos(doAlfa, naTela).length, 1);
  assert.equal(confrontosDiretos(doBeta, naTela).length, 1);
});

test("o realce dos confrontos diretos tem teto de doze clubes", () => {
  assert.equal(TETO_CONFRONTOS, 12);
  assert.ok(cabemConfrontos(1), "uma coluna só já marca");
  assert.ok(cabemConfrontos(12), "doze ainda cabe");
  assert.ok(!cabemConfrontos(13), "treze já não");
  assert.ok(!cabemConfrontos(20), "a tabela inteira muito menos");
  assert.ok(!cabemConfrontos(0), "sem clube não há o que marcar");
});

