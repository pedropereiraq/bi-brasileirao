/**
 * O FMI e as duas metades dele.
 *
 * O que precisa de guarda são as duas réguas opostas: fora, a expectativa é
 * zero e tudo que se soma foi ganho; em casa, a expectativa é 3 e tudo que se
 * deixa de somar foi perdido. Trocar uma pela outra inverteria o sinal do
 * índice sem que nada no card denunciasse.
 *
 * E o jogo que ainda não aconteceu, que precisa vir nulo: zero ali diria "não
 * ganhou nada" onde o que houve foi não ter jogado.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  confrontosDoClube, detalheNaOrdemDaTabela, indiceDeCadaClube, pontosDoPlacar,
  somarDetalhe,
} from "../public/js/fmi.js";

test("o placar vira pontos pela regra de sempre", () => {
  assert.equal(pontosDoPlacar(2, 1), 3);
  assert.equal(pontosDoPlacar(1, 1), 1);
  assert.equal(pontosDoPlacar(0, 2), 0);
  assert.equal(pontosDoPlacar(null, null), null);
});

test("fora se ganha do zero; em casa se perde do três", () => {
  // ALFA: 10 pontos em 6 jogos fora, e em casa 12 de 18 possíveis.
  const casa = [{ equipe: "ALFA (SP)", pts: 12, j: 6 }];
  const fora = [{ equipe: "ALFA (SP)", pts: 10, j: 6 }];

  const [alfa] = indiceDeCadaClube(casa, fora);
  assert.equal(alfa.ganhosFora, 10);
  assert.equal(alfa.perdidosCasa, 6, "18 possíveis menos 12 somados");
  assert.equal(alfa.fmi, 4);
});

test("quem cumpre o script — vence em casa, perde fora — fica em zero", () => {
  const casa = [{ equipe: "BETA (RJ)", pts: 18, j: 6 }];
  const fora = [{ equipe: "BETA (RJ)", pts: 0, j: 6 }];
  assert.equal(indiceDeCadaClube(casa, fora)[0].fmi, 0);
});

test("a lista vem do maior índice para o menor", () => {
  const casa = [
    { equipe: "ALFA (SP)", pts: 12, j: 6 },
    { equipe: "BETA (RJ)", pts: 18, j: 6 },
    { equipe: "GAMA (MG)", pts: 6, j: 6 },
  ];
  const fora = [
    { equipe: "ALFA (SP)", pts: 10, j: 6 },
    { equipe: "BETA (RJ)", pts: 0, j: 6 },
    { equipe: "GAMA (MG)", pts: 3, j: 6 },
  ];
  assert.deepEqual(indiceDeCadaClube(casa, fora).map((c) => [c.equipe, c.fmi]),
    [["ALFA (SP)", 4], ["BETA (RJ)", 0], ["GAMA (MG)", -9]]);
});

/* ------------------------------------------------------------- detalhe */
const jogo = (mandante, visitante, gp = null, gc = null) => ({
  rodada: 1, data: "2026-05-01", mandante, visitante,
  realizado: gp !== null, gp, gc,
});

const partidas = [
  jogo("ALFA (SP)", "BETA (RJ)", 1, 1),     // ALFA em casa: empate, perde 2
  jogo("BETA (RJ)", "ALFA (SP)", 0, 2),     // ALFA fora: triunfo, ganha 3
  jogo("ALFA (SP)", "GAMA (MG)", 0, 1),     // ALFA em casa: derrota, perde 3
  jogo("GAMA (MG)", "ALFA (SP)"),           // ALFA fora: ainda não jogou
];

test("o confronto guarda os dois lados, e o que não houve fica nulo", () => {
  const confrontos = confrontosDoClube(partidas, "ALFA (SP)");

  assert.equal(confrontos.get("BETA (RJ)").casa.perdidos, 2);
  assert.equal(confrontos.get("BETA (RJ)").fora.ganhos, 3);
  assert.equal(confrontos.get("GAMA (MG)").casa.perdidos, 3);
  assert.equal(confrontos.get("GAMA (MG)").fora.jogou, false);
  assert.equal(confrontos.get("GAMA (MG)").fora.ganhos, undefined,
    "jogo que não houve não vale zero ponto ganho");
});

test("o detalhe sai na ordem da tabela, sem o próprio clube", () => {
  const classificacao = [
    { equipe: "GAMA (MG)", pos: 1 },
    { equipe: "ALFA (SP)", pos: 2 },
    { equipe: "BETA (RJ)", pos: 3 },
  ];
  const detalhe = detalheNaOrdemDaTabela(partidas, "ALFA (SP)", classificacao);

  assert.deepEqual(detalhe.map((l) => l.adversario), ["GAMA (MG)", "BETA (RJ)"]);
  assert.deepEqual(detalhe.map((l) => l.pos), [1, 3]);
  // E os totais do detalhe têm de bater com o índice.
  assert.deepEqual(somarDetalhe(detalhe), { ganhosFora: 3, perdidosCasa: 5 });
});
