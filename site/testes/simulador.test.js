/**
 * Os palpites da reta final.
 *
 * O que precisa de guarda: o palpite é **do jogo**, e não da linha — o mesmo
 * confronto aparece na linha dos dois clubes, e dizer que um venceu tem de
 * dizer que o outro perdeu. E o placar é sempre 1 a 0 ou 0 a 0: qualquer
 * outro mexeria no saldo de gols, que é critério de desempate.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  DERROTA, EMPATE, EMPATOU, MANDANTE_VENCE, VISITANTE_VENCE, VITORIA,
  aplicarPalpites, contarPalpites, desfechoDaLinha, girarPalpite,
  jogosPendentes, palpiteDoJogo, pendentesDoClube, proximoDesfecho, variacoes,
} from "../public/js/simulador.js";
import { tabela } from "../public/js/motor.js";

/** [rodada, data, mandante, visitante, gols_m, gols_v, status] */
const jogos = [
  [1, "2026-05-01", "ALFA (SP)", "BETA (RJ)", 2, 0, "realizado"],
  [2, "2026-05-08", "GAMA (MG)", "ALFA (SP)", null, null, "agendado"],
  [2, "2026-05-08", "BETA (RJ)", "DELTA (BA)", null, null, "agendado"],
  [3, "2026-05-15", "ALFA (SP)", "DELTA (BA)", null, null, "agendado"],
];
const clubes = ["ALFA (SP)", "BETA (RJ)", "DELTA (BA)", "GAMA (MG)"];

test("pendente é o jogo sem placar, e ele leva o índice junto", () => {
  const pendentes = jogosPendentes(jogos);

  assert.deepEqual(pendentes.map((p) => p.indice), [1, 2, 3]);
  assert.equal(pendentes[0].mandante, "GAMA (MG)");
  assert.deepEqual(jogosPendentes([]), []);

  // Jogo marcado como realizado mas sem placar ainda não aconteceu.
  const semPlacar = jogosPendentes(
    [[1, "2026-05-01", "A", "B", null, null, "realizado"]]);
  assert.equal(semPlacar.length, 1);
});

test("a fileira do clube sabe de que lado ele joga", () => {
  const pendentes = jogosPendentes(jogos);
  const doAlfa = pendentesDoClube(pendentes, "ALFA (SP)");

  assert.deepEqual(doAlfa.map((p) => p.indice), [1, 3]);
  assert.deepEqual(doAlfa.map((p) => p.emCasa), [false, true]);
  assert.deepEqual(doAlfa.map((p) => p.adversario),
    ["GAMA (MG)", "DELTA (BA)"]);
  assert.deepEqual(pendentesDoClube(pendentes, "NINGUEM (SP)"), []);
});

test("o mesmo palpite se lê ao contrário na linha do adversário", () => {
  assert.equal(desfechoDaLinha(MANDANTE_VENCE, true), VITORIA);
  assert.equal(desfechoDaLinha(MANDANTE_VENCE, false), DERROTA);
  assert.equal(desfechoDaLinha(VISITANTE_VENCE, false), VITORIA);
  assert.equal(desfechoDaLinha(EMPATE, true), EMPATOU);
  assert.equal(desfechoDaLinha(null, true), null);

  // E a volta fecha o círculo.
  assert.equal(palpiteDoJogo(VITORIA, false), VISITANTE_VENCE);
  assert.equal(palpiteDoJogo(DERROTA, true), VISITANTE_VENCE);
  assert.equal(palpiteDoJogo(null, true), null);
});

test("o ciclo da etiqueta passa pelo branco e volta", () => {
  assert.equal(proximoDesfecho(null), VITORIA);
  assert.equal(proximoDesfecho(VITORIA), EMPATOU);
  assert.equal(proximoDesfecho(EMPATOU), DERROTA);
  assert.equal(proximoDesfecho(DERROTA), null, "desfazer é parte do ciclo");
});

test("girar pela linha do visitante grava o palpite do jogo, não o da linha", () => {
  // O ALFA joga fora contra o GAMA: a primeira volta na etiqueta dele é
  // vitória, que no jogo é vitória do visitante.
  const um = girarPalpite(new Map(), { indice: 1, emCasa: false });
  assert.equal(um.get(1), VISITANTE_VENCE);

  // E é derrota quando lido da linha do GAMA, que é o mandante.
  assert.equal(desfechoDaLinha(um.get(1), true), DERROTA);

  // Girando de novo pela linha do GAMA: a derrota dele vira branco, e o
  // palpite some dos dois lugares.
  const dois = girarPalpite(um, { indice: 1, emCasa: true });
  assert.equal(dois.has(1), false);

  const anterior = new Map([[1, MANDANTE_VENCE]]);
  girarPalpite(anterior, { indice: 1, emCasa: true });
  assert.equal(anterior.get(1), MANDANTE_VENCE, "o mapa antigo não muda");
});

test("o placar do palpite é sempre 1 a 0, ou 0 a 0", () => {
  const palpites = new Map([[1, VISITANTE_VENCE], [2, EMPATE]]);
  const simulados = aplicarPalpites(jogos, palpites);

  assert.deepEqual(simulados[1].slice(4), [0, 1, "realizado"]);
  assert.deepEqual(simulados[2].slice(4), [0, 0, "realizado"]);
  assert.equal(simulados[3], jogos[3], "jogo sem palpite continua o mesmo");
  assert.deepEqual(jogos[1].slice(4), [null, null, "agendado"],
    "a lista original não é tocada");

  // E a tabela simulada soma o que o palpite prometeu: o ALFA ganha fora.
  const hoje = tabela(jogos, clubes);
  const depois = tabela(simulados, clubes);
  assert.equal(hoje.find((c) => c.equipe === "ALFA (SP)").pts, 3);
  assert.equal(depois.find((c) => c.equipe === "ALFA (SP)").pts, 6);
  assert.equal(depois.find((c) => c.equipe === "BETA (RJ)").pts, 1,
    "o empate da outra partida rendeu um");
});

test("a variação é positiva quando o clube sobe", () => {
  const hoje = [{ equipe: "A", pos: 1 }, { equipe: "B", pos: 2 }];
  const depois = [{ equipe: "B", pos: 1 }, { equipe: "A", pos: 2 }];
  const mudou = variacoes(hoje, depois);

  assert.deepEqual(mudou.get("B"), { de: 2, para: 1, delta: 1 });
  assert.deepEqual(mudou.get("A"), { de: 1, para: 2, delta: -1 });
  assert.equal(variacoes(hoje, [{ equipe: "C", pos: 3 }]).get("C").delta, null);
});

test("a conta dos palpites ignora o que não está mais pendente", () => {
  const pendentes = jogosPendentes(jogos);
  const palpites = new Map([[1, EMPATE], [0, MANDANTE_VENCE]]);

  assert.deepEqual(contarPalpites(palpites, pendentes),
    { simulados: 1, restantes: 2, total: 3 });
  assert.deepEqual(contarPalpites(new Map(), pendentes),
    { simulados: 0, restantes: 3, total: 3 });
});
