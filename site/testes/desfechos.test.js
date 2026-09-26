/**
 * Posição final e pontuação, cruzadas.
 *
 * O que precisa de guarda: só campanha encerrada entra — a edição em curso não
 * terminou em lugar nenhum — e o cruzamento tem de guardar quem caiu em cada
 * casa, não só quantos, porque é disso que a dica do mouse vive.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  campanhasEncerradas, casa, cruzarPontosEPosicao, distribuicaoDaPosicao,
  resumoDaPontuacao, resumoDaPosicao,
} from "../public/js/desfechos.js";

const dados = {
  series: {
    A: {
      2024: {
        clubes: ["ALFA (SP)", "BETA (RJ)", "GAMA (MG)"],
        encerrada: true,
        fim: [[1, 70], [2, 64], [3, 64]],
      },
      2025: {
        clubes: ["ALFA (SP)", "BETA (RJ)", "GAMA (MG)"],
        encerrada: true,
        fim: [[2, 64], [1, 71], [3, 50]],
        fim_st: [[1, 68], [2, 67], [3, 50]],
      },
      2026: {
        clubes: ["ALFA (SP)", "BETA (RJ)"],
        encerrada: false,
        fim: [null, null],
      },
    },
  },
};

test("só campanha encerrada entra, e ela vem com ano e clube", () => {
  const campanhas = campanhasEncerradas(dados, { serie: "A" });

  assert.equal(campanhas.length, 6, "duas edições de três clubes");
  assert.ok(!campanhas.some((c) => c.ano === 2026),
    "a edição em curso não terminou em lugar nenhum");
  assert.deepEqual(campanhas[0], { ano: 2024, equipe: "ALFA (SP)", posicao: 1, pontos: 70 });
  assert.deepEqual(campanhasEncerradas(dados, { serie: "B" }), []);
});

test("sem tapetão, é o outro desfecho que vale", () => {
  const campanhas = campanhasEncerradas(dados, { serie: "A", semTapetao: true });
  const alfa = campanhas.find((c) => c.ano === 2025 && c.equipe === "ALFA (SP)");
  assert.deepEqual([alfa.posicao, alfa.pontos], [1, 68]);

  // Edição sem a variante publicada segue no desfecho único.
  const com = campanhasEncerradas(dados, { serie: "A" });
  const mesma = com.find((c) => c.ano === 2025 && c.equipe === "ALFA (SP)");
  assert.deepEqual([mesma.posicao, mesma.pontos], [2, 64]);
});

test("o cruzamento guarda quem caiu em cada casa, e os limites vêm do dado", () => {
  const campanhas = campanhasEncerradas(dados, { serie: "A" });
  const cruz = cruzarPontosEPosicao(campanhas);

  assert.deepEqual([cruz.minimo, cruz.maximo], [50, 71]);
  assert.equal(cruz.posicoes, 3);
  assert.equal(cruz.maior, 2, "64 pontos em 2º aconteceu duas vezes");

  // 64 pontos já deram 2º e 3º.
  assert.deepEqual(casa(cruz, 64, 2).map((c) => c.ano), [2024, 2025]);
  assert.deepEqual(casa(cruz, 64, 3).map((c) => c.equipe), ["GAMA (MG)"]);
  assert.deepEqual(casa(cruz, 99, 1), []);

  const vazio = cruzarPontosEPosicao([]);
  assert.deepEqual([vazio.minimo, vazio.maximo, vazio.maior], [0, 0, 0]);
});

test("duas campanhas na mesma casa contam duas", () => {
  const cruz = cruzarPontosEPosicao([
    { ano: 2020, equipe: "A", posicao: 1, pontos: 70 },
    { ano: 2021, equipe: "B", posicao: 1, pontos: 70 },
  ]);
  assert.equal(cruz.maior, 2);
  assert.equal(casa(cruz, 70, 1).length, 2);
});

test("o resumo responde pelas duas pontas", () => {
  const campanhas = campanhasEncerradas(dados, { serie: "A" });

  const segundo = resumoDaPosicao(campanhas, 2);
  assert.deepEqual([segundo.campanhas, segundo.minimo, segundo.maximo], [2, 64, 64]);

  const sessentaQuatro = resumoDaPontuacao(campanhas, 64);
  assert.deepEqual([sessentaQuatro.campanhas, sessentaQuatro.melhor,
                    sessentaQuatro.pior], [3, 2, 3]);

  assert.equal(resumoDaPosicao(campanhas, 19), null);
  assert.equal(resumoDaPontuacao(campanhas, 99), null);
});

test("a distribuição de uma posição vai do mínimo ao máximo, com os vazios", () => {
  const campanhas = [
    { ano: 2020, equipe: "A", posicao: 2, pontos: 64 },
    { ano: 2021, equipe: "B", posicao: 2, pontos: 64 },
    { ano: 2022, equipe: "C", posicao: 2, pontos: 67 },
    { ano: 2023, equipe: "D", posicao: 1, pontos: 80 },
  ];

  assert.deepEqual(distribuicaoDaPosicao(campanhas, 2), [
    { pontos: 64, quantidade: 2 },
    { pontos: 65, quantidade: 0 },
    { pontos: 66, quantidade: 0 },
    { pontos: 67, quantidade: 1 },
  ]);
  assert.deepEqual(distribuicaoDaPosicao(campanhas, 1), [{ pontos: 80, quantidade: 1 }]);
  assert.deepEqual(distribuicaoDaPosicao(campanhas, 9), []);
});
