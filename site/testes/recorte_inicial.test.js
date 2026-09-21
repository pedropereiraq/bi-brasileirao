/**
 * O recorte inicial de um clube, edição por edição.
 *
 * Duas regras precisam de guarda. Edição em que o clube ainda não chegou ao
 * N-ésimo jogo não entra — ela não tem o que responder, e entraria com o
 * acumulado do último jogo que fez, como se fosse o do jogo pedido. E a edição
 * em andamento entra na largada mas não nas médias de fim: ela não terminou.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  edicoesDoClube, jogosNaEdicaoCorrente, recortesDoClube, resumoDosRecortes,
} from "../public/js/recorte_inicial.js";

/** Campanha que soma `porJogo` a cada jogo. */
const reta = (porJogo, jogos = 38) =>
  Array.from({ length: jogos }, (_, i) => porJogo * (i + 1));

const dados = {
  series: {
    A: {
      2020: [["BAHIA (BA)", 12, reta(1)], ["OUTRO (SP)", 1, reta(2)]],
      2021: [["BAHIA (BA)", 3, reta(2)]],
      2023: [["OUTRO (SP)", 8, reta(1)]],                    // sem o Bahia
      2026: [["BAHIA (BA)", null, reta(2, 10)]],             // em andamento
    },
    B: {
      2022: [["BAHIA (BA)", 1, reta(2)]],
    },
  },
};

const alvo = { serie: "A", equipe: "BAHIA (BA)" };

test("lista as edições do clube na série, da mais nova para a mais antiga", () => {
  assert.deepEqual(edicoesDoClube(dados, alvo).map((e) => e.ano),
    [2026, 2021, 2020]);
  assert.deepEqual(edicoesDoClube(dados, { serie: "B", equipe: "BAHIA (BA)" })
    .map((e) => e.ano), [2022]);
  assert.deepEqual(edicoesDoClube(dados, { serie: "A", equipe: "NINGUÉM (XX)" }), []);
  assert.deepEqual(edicoesDoClube(undefined, alvo), []);
});

test("os jogos de hoje saem da edição sem desfecho", () => {
  assert.equal(jogosNaEdicaoCorrente(dados, alvo), 10);
  // Numa série em que o clube não está na edição corrente, não há resposta.
  assert.equal(jogosNaEdicaoCorrente(dados, { serie: "B", equipe: "BAHIA (BA)" }), null);
});

test("o recorte pega a pontuação exatamente no jogo pedido", () => {
  const r = recortesDoClube(dados, { ...alvo, jogos: 5 });
  assert.deepEqual(r.map((x) => [x.ano, x.pontosNoCorte]),
    [[2026, 10], [2021, 10], [2020, 5]]);
});

test("edição que não chegou àquele jogo fica de fora", () => {
  // 2026 tem 10 jogos; no 20º ela não existe.
  const r = recortesDoClube(dados, { ...alvo, jogos: 20 });
  assert.deepEqual(r.map((x) => x.ano), [2021, 2020]);
});

test("a ordem é do melhor começo para o pior, com o ano desempatando", () => {
  const r = recortesDoClube(dados, { ...alvo, jogos: 5 });
  const pontos = r.map((x) => x.pontosNoCorte);
  assert.deepEqual(pontos, [...pontos].sort((a, b) => b - a));
  // 2026 e 2021 empatam em 10; a mais recente vem primeiro.
  assert.deepEqual(r.slice(0, 2).map((x) => x.ano), [2026, 2021]);
});

test("a edição em andamento tem largada, não desfecho", () => {
  const [corrente] = recortesDoClube(dados, { ...alvo, jogos: 5 });
  assert.equal(corrente.ano, 2026);
  assert.equal(corrente.encerrada, false);
  assert.equal(corrente.posFim, null);
  assert.equal(corrente.jogosTotais, 10);
  assert.equal(corrente.pontosFim, 20, "é a pontuação de hoje, não a final");
});

test("aproveitamento antes e depois do corte", () => {
  const r = recortesDoClube(dados, { ...alvo, jogos: 5 });
  const y2020 = r.find((x) => x.ano === 2020);
  assert.equal(y2020.aproveitaAntes, 5 / 15);
  assert.equal(y2020.aproveitaDepois, 33 / (3 * 33));
  assert.ok(Math.abs(y2020.variacao) < 1e-9, "mesma campanha, variação zero");
});

test("corte no último jogo não tem aproveitamento depois", () => {
  const r = recortesDoClube(dados, { ...alvo, jogos: 38 });
  assert.deepEqual(r.map((x) => x.ano), [2021, 2020]);
  for (const x of r) {
    assert.equal(x.jogosDepois, 0);
    assert.equal(x.aproveitaDepois, null);
    assert.equal(x.variacao, null);
  }
});

test("o resumo só usa edições encerradas para fim e posição", () => {
  const r = recortesDoClube(dados, { ...alvo, jogos: 5 });
  const resumo = resumoDosRecortes(r);

  assert.equal(resumo.total, 3);
  assert.equal(resumo.encerradas, 2);
  assert.equal(resumo.mediaNoCorte, (10 + 10 + 5) / 3, "a largada conta todas");
  assert.equal(resumo.mediaFim, (76 + 38) / 2, "o fim só conta as encerradas");
  assert.equal(resumo.posicaoMedia, (3 + 12) / 2);
  assert.equal(resumo.melhorCorte.ano, 2026);
  assert.equal(resumo.piorCorte.ano, 2020);
});

test("clube sem edição nenhuma devolve resumo vazio, não estoura", () => {
  const r = recortesDoClube(dados, { serie: "A", equipe: "NINGUÉM (XX)", jogos: 5 });
  const resumo = resumoDosRecortes(r);
  assert.equal(resumo.total, 0);
  assert.equal(resumo.mediaNoCorte, null);
  assert.equal(resumo.mediaFim, null);
  assert.equal(resumo.melhorCorte, null);
});
