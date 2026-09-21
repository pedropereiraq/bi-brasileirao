/**
 * O índice de independência do mando.
 *
 * O que precisa de guarda é o caso em que ele não existe: sem ponto em casa a
 * conta dividiria por zero, e devolver zero diria "totalmente dependente"
 * quando o que houve foi não ter de onde depender. Esses clubes vão para o fim
 * da lista, não para o fundo do ranking.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  independenciaDoMando, jogosPorMando, linhasDeIndependencia,
  maiorDesequilibrio,
} from "../public/js/independencia.js";

/** Uma linha de tabela como o motor entrega. */
const linha = (equipe, pts, j) => ({
  equipe, pts, j, aproveitamento: j > 0 ? pts / (3 * j) : null,
});

test("o índice é a razão entre os dois aproveitamentos", () => {
  // 60% em casa, 30% fora: leva metade do que tem.
  const casa = linha("ALFA (SP)", 18, 10);   // 18/30 = 60%
  const fora = linha("ALFA (SP)", 9, 10);    // 9/30 = 30%
  assert.equal(independenciaDoMando(casa, fora), 0.5);

  // Mesmo aproveitamento nos dois: independente do mando.
  assert.equal(independenciaDoMando(casa, linha("ALFA (SP)", 18, 10)), 1);
});

test("render mais fora que em casa passa de 100%", () => {
  const casa = linha("BETA (RJ)", 9, 10);
  const fora = linha("BETA (RJ)", 18, 10);
  assert.equal(independenciaDoMando(casa, fora), 2);
});

test("sem ponto em casa não há índice", () => {
  const casa = linha("GAMA (MG)", 0, 8);
  const fora = linha("GAMA (MG)", 12, 8);
  assert.equal(independenciaDoMando(casa, fora), null);
  // Sem jogo em casa também não: aproveitamento nulo não é aproveitamento zero.
  assert.equal(independenciaDoMando(linha("GAMA (MG)", 0, 0), fora), null);
  assert.equal(independenciaDoMando(null, fora), null);
});

test("a lista vem do mais independente para o menos, com os sem índice no fim", () => {
  const casa = [linha("ALFA (SP)", 18, 10), linha("BETA (RJ)", 9, 10),
                linha("GAMA (MG)", 0, 10)];
  const fora = [linha("ALFA (SP)", 9, 10), linha("BETA (RJ)", 9, 10),
                linha("GAMA (MG)", 6, 10)];

  const linhas = linhasDeIndependencia(casa, fora);
  assert.deepEqual(linhas.map((l) => l.equipe),
    ["BETA (RJ)", "ALFA (SP)", "GAMA (MG)"]);
  assert.equal(linhas[0].indice, 1);
  assert.equal(linhas[1].indice, 0.5);
  assert.equal(linhas[2].indice, null, "sem ponto em casa fica por último");
});

test("os jogos de cada lado, e o saldo entre eles", () => {
  const casa = [linha("ALFA (SP)", 18, 12), linha("BETA (RJ)", 9, 9)];
  const fora = [linha("ALFA (SP)", 9, 9), linha("BETA (RJ)", 9, 12)];

  const jogos = jogosPorMando(casa, fora);
  assert.deepEqual(jogos["ALFA (SP)"], { casa: 12, fora: 9, saldo: 3 });
  assert.deepEqual(jogos["BETA (RJ)"], { casa: 9, fora: 12, saldo: -3 });
  assert.equal(maiorDesequilibrio(jogos), 3);
  assert.equal(maiorDesequilibrio({}), 0);
});
