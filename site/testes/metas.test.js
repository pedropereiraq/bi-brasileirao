/**
 * A meta por bloco tem de ser inteira, e a sobra tem de caber no extra.
 *
 * A regra parece uma divisão simples e não é: a média de quem termina em 1º na
 * Série A é 76,95, e 76,95 ÷ 6 = 12,8. Com 12 por bloco a sobra seria 4,95,
 * mais do que o extra aceita; com 13, o extra teria de ser negativo. Nenhum dos
 * dois arredondamentos óbvios funciona sempre, e é isso que este teste cobra.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  BLOCOS, JOGOS_POR_BLOCO, JOGOS_EXTRA, META_EXTRA_MAX,
  metasDaPosicao, dividirEmBlocos, resumoDosBlocos, pontosDoResultado,
} from "../public/js/metas.js";

test("os 7 blocos cobrem os 38 jogos, sem sobra nem repetição", () => {
  assert.equal(BLOCOS * JOGOS_POR_BLOCO + JOGOS_EXTRA, 38);
});

test("a meta por bloco é sempre inteira e o extra fica entre 0 e 4", () => {
  for (let media = 0; media <= 114; media += 0.05) {
    const m = metasDaPosicao(media);
    assert.ok(Number.isInteger(m.bloco), `bloco não inteiro em ${media}`);
    assert.ok(Number.isInteger(m.extra), `extra não inteiro em ${media}`);
    assert.ok(m.extra >= 0 && m.extra <= META_EXTRA_MAX,
      `extra ${m.extra} fora de 0..${META_EXTRA_MAX} em ${media}`);
    assert.equal(m.total, BLOCOS * m.bloco + m.extra);
  }
});

test("o total escolhido é o alcançável mais próximo da média", () => {
  // Força bruta independente da implementação: todos os totais que a regra
  // permite, e o mais perto vence.
  const alcancaveis = [];
  for (let bloco = 0; bloco <= JOGOS_POR_BLOCO * 3; bloco++) {
    for (let extra = 0; extra <= META_EXTRA_MAX; extra++) {
      alcancaveis.push(BLOCOS * bloco + extra);
    }
  }
  for (let media = 0; media <= 114; media += 0.13) {
    const m = metasDaPosicao(media);
    const melhorErro = Math.min(...alcancaveis.map((t) => Math.abs(t - media)));
    assert.ok(Math.abs(m.total - media) <= melhorErro + 1e-9,
      `média ${media}: escolheu ${m.total}, havia algo mais perto`);
  }
});

test("os casos que motivaram a regra", () => {
  // 17º da Série A: 41,75 -> 7 por bloco, 0 no extra. É a meta do card antigo.
  assert.deepEqual(resumo(metasDaPosicao(41.75)), { bloco: 7, extra: 0, total: 42 });
  // 4º: 63,95 -> 10 e 4.
  assert.deepEqual(resumo(metasDaPosicao(63.95)), { bloco: 10, extra: 4, total: 64 });
  // 1º: 76,95 -> 12 e 4. Com 13 o extra ficaria negativo.
  assert.deepEqual(resumo(metasDaPosicao(76.95)), { bloco: 12, extra: 4, total: 76 });
});

const resumo = ({ bloco, extra, total }) => ({ bloco, extra, total });

/* ------------------------------------------------- repartição da agenda */
const agendaFalsa = (resultados) =>
  resultados.map((resultado, i) => ({
    n: i + 1,
    realizado: resultado !== null,
    jogo: { resultado },
  }));

test("a repartição segue a ordem dos jogos, não a das rodadas", () => {
  const blocos = dividirEmBlocos(agendaFalsa(Array(38).fill("T")),
                                 { bloco: 7, extra: 0 });
  assert.equal(blocos.length, 7);
  assert.deepEqual(blocos.map((b) => [b.de, b.ate]),
    [[1, 6], [7, 12], [13, 18], [19, 24], [25, 30], [31, 36], [37, 38]]);
  assert.deepEqual(blocos.slice(0, 6).map((b) => b.pontos), [18, 18, 18, 18, 18, 18]);
  assert.equal(blocos[6].pontos, 6);
});

test("bloco pela metade não tem saldo, tem o que falta", () => {
  // 8 jogos disputados: bloco 1 fechado, bloco 2 com 2 de 6.
  const resultados = [...Array(8).fill("E"), ...Array(30).fill(null)];
  const blocos = dividirEmBlocos(agendaFalsa(resultados), { bloco: 7, extra: 0 });

  assert.equal(blocos[0].completo, true);
  assert.equal(blocos[0].pontos, 6);
  assert.equal(blocos[0].saldo, -1);

  assert.equal(blocos[1].completo, false);
  assert.equal(blocos[1].iniciado, true);
  assert.equal(blocos[1].saldo, null, "bloco aberto não pode ter saldo");
  assert.equal(blocos[1].pontos, 2);
  assert.equal(blocos[1].falta, 5);
  assert.equal(blocos[1].restam, 4);

  assert.equal(blocos[2].iniciado, false);
});

test("o acumulado só anda em bloco fechado", () => {
  // Bloco 1 com 18 (+11), bloco 2 com 0 (−7), bloco 3 pela metade.
  const resultados = [
    ...Array(6).fill("T"), ...Array(6).fill("D"),
    ...Array(3).fill("T"), ...Array(23).fill(null),
  ];
  const blocos = dividirEmBlocos(agendaFalsa(resultados), { bloco: 7, extra: 0 });
  assert.deepEqual(blocos.map((b) => b.acumulado), [11, 4, null, null, null, null, null]);

  const r = resumoDosBlocos(blocos);
  assert.equal(r.blocosFechados, 2);
  assert.equal(r.saldo, 4);
  assert.equal(r.pontos, 18, "o balanço fechado não conta o bloco aberto");
  assert.equal(r.pontosTotais, 27, "o total conta tudo que a equipe fez");
});

test("triunfo vale 3, empate 1, derrota 0", () => {
  assert.equal(pontosDoResultado("T"), 3);
  assert.equal(pontosDoResultado("E"), 1);
  assert.equal(pontosDoResultado("D"), 0);
});

test("começo de campeonato: nenhum bloco fechado, e o resumo aguenta", () => {
  const resultados = [...Array(3).fill("T"), ...Array(35).fill(null)];
  const blocos = dividirEmBlocos(agendaFalsa(resultados), { bloco: 7, extra: 0 });
  assert.ok(blocos.every((b) => !b.completo));
  assert.deepEqual(blocos.map((b) => b.acumulado), Array(7).fill(null));

  const r = resumoDosBlocos(blocos);
  assert.equal(r.blocosFechados, 0);
  assert.equal(r.saldo, 0);
  assert.equal(r.pontos, 0);
  assert.equal(r.pontosTotais, 9);
  assert.equal(r.metaTotal, 42);
});
