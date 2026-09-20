/**
 * Quem já esteve nesta situação, e o que a busca não pode deixar entrar.
 *
 * As duas regras que importam aqui são exclusões, e exclusão é o tipo de coisa
 * que some numa refatoração sem ninguém notar: campanha sem desfecho não entra,
 * e campanha que não chegou àquele jogo também não. As duas apareceriam como
 * resultado plausível se falhassem.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  campanhasSemelhantes, distribuicaoPorPosicao, resumoDasSemelhantes,
  zonaDaPosicao, zonasDaFaixa,
} from "../public/js/similares.js";

/** Campanha de 38 jogos que soma `porJogo` a cada jogo, para o teste. */
const reta = (porJogo, jogos = 38) =>
  Array.from({ length: jogos }, (_, i) => porJogo * (i + 1));

const dados = {
  series: {
    A: {
      2020: [
        ["ALFA (SP)", 1, reta(2)],           // 6 em 3 jogos, 76 no fim
        ["BETA (RJ)", 12, reta(1)],          // 3 em 3 jogos, 38 no fim
        ["GAMA (MG)", 20, [2, 4, 6, ...Array(35).fill(0).map((_, i) => 6 + i)]],
      ],
      2021: [
        ["DELTA (BA)", 4, reta(2)],          // 6 em 3 jogos também
        ["ÉPSILON (PE)", 8, [1, 3, 6, ...Array(35).fill(0).map((_, i) => 7 + i * 2)]],
      ],
      2026: [
        ["ZETA (CE)", null, reta(2, 10)],    // em andamento: 6 em 3 jogos
      ],
    },
    B: {
      2020: [["ETA (PA)", 1, reta(2)]],
    },
  },
};

const faixa = { melhor: 1, pior: 4 };

test("acha toda campanha encerrada com aquela pontuação naquele jogo", () => {
  const achadas = campanhasSemelhantes(dados, { serie: "A", jogos: 3, pontos: 6 });
  assert.deepEqual(achadas.map((c) => `${c.equipe} ${c.ano}`),
    ["ALFA (SP) 2020", "DELTA (BA) 2021", "ÉPSILON (PE) 2021", "GAMA (MG) 2020"]);
  assert.deepEqual(achadas.map((c) => c.posFim), [1, 4, 8, 20]);
});

test("campanha sem desfecho não entra na resposta", () => {
  const achadas = campanhasSemelhantes(dados, { serie: "A", jogos: 3, pontos: 6 });
  assert.ok(!achadas.some((c) => c.equipe.startsWith("ZETA")),
    "a edição em andamento entrou no que 'já aconteceu'");
});

test("quem não chegou àquele jogo não entra", () => {
  // A campanha em andamento tem 10 jogos; no jogo 20 ela não existe.
  const dez = { series: { A: { 2025: [["TETA (RS)", 5, reta(2, 10)]] } } };
  assert.equal(
    campanhasSemelhantes(dez, { serie: "A", jogos: 20, pontos: 40 }).length, 0);
  assert.equal(
    campanhasSemelhantes(dez, { serie: "A", jogos: 10, pontos: 20 }).length, 1);
});

test("a série pedida é a única que responde", () => {
  const achadas = campanhasSemelhantes(dados, { serie: "B", jogos: 3, pontos: 6 });
  assert.deepEqual(achadas.map((c) => c.equipe), ["ETA (PA)"]);
});

test("série sem dado nenhum devolve lista vazia, não estoura", () => {
  assert.deepEqual(campanhasSemelhantes(dados, { serie: "C", jogos: 3, pontos: 6 }), []);
  assert.deepEqual(campanhasSemelhantes(undefined, { serie: "A", jogos: 3, pontos: 6 }), []);
});

test("a ordem é da melhor posição final para a pior", () => {
  // Posição e pontuação não dão a mesma ordem: 67 pontos valeram o 2º lugar em
  // 2006 e o 4º em 2025. O que se compara aqui é onde a campanha foi parar.
  const achadas = campanhasSemelhantes(dados, { serie: "A", jogos: 3, pontos: 6 });
  const posicoes = achadas.map((c) => c.posFim);
  assert.deepEqual(posicoes, [...posicoes].sort((a, b) => a - b));
});

test("a faixa corta a tabela em uma, duas ou três partes", () => {
  assert.deepEqual(zonasDaFaixa({ melhor: 1, pior: 4 }).map((z) => z.nome),
    ["dentro", "abaixo"]);
  assert.deepEqual(zonasDaFaixa({ melhor: 17, pior: 20 }).map((z) => z.nome),
    ["acima", "dentro"]);
  assert.deepEqual(zonasDaFaixa({ melhor: 5, pior: 16 }).map((z) => z.nome),
    ["acima", "dentro", "abaixo"]);
  assert.deepEqual(zonasDaFaixa({ melhor: 1, pior: 20 }).map((z) => z.nome),
    ["dentro"]);
  // As partes cobrem as 20 posições sem buraco nem sobreposição.
  for (const faixa of [{ melhor: 1, pior: 4 }, { melhor: 5, pior: 16 },
                       { melhor: 17, pior: 20 }, { melhor: 10, pior: 10 }]) {
    const cobertas = zonasDaFaixa(faixa)
      .flatMap((z) => Array.from({ length: z.ate - z.de + 1 }, (_, i) => z.de + i));
    assert.deepEqual(cobertas, Array.from({ length: 20 }, (_, i) => i + 1));
  }
});

test("cada campanha diz quanto somou depois do corte", () => {
  const [alfa] = campanhasSemelhantes(dados, { serie: "A", jogos: 3, pontos: 6 });
  assert.equal(alfa.pontosFim, 76);
  assert.equal(alfa.depois, 70, "76 no fim menos os 6 do corte");
  assert.equal(alfa.jogosDepois, 35);
});

test("o aproveitamento antes e depois, e a variação de um para o outro", () => {
  // ALFA soma 2 por jogo o tempo todo: 6 em 3 e 70 nos 35 seguintes. O
  // aproveitamento é o mesmo dos dois lados, então a variação é zero.
  const [alfa] = campanhasSemelhantes(dados, { serie: "A", jogos: 3, pontos: 6 });
  assert.equal(alfa.aproveitaAntes, 6 / 9);
  assert.equal(alfa.aproveitaDepois, 70 / 105);
  assert.ok(Math.abs(alfa.variacao) < 1e-9, "mesma campanha, variação zero");

  // GAMA faz 6 em 3 e só mais 34 em 35: despencou.
  const gama = campanhasSemelhantes(dados, { serie: "A", jogos: 3, pontos: 6 })
    .find((c) => c.equipe.startsWith("GAMA"));
  assert.equal(gama.aproveitaAntes, 6 / 9);
  assert.equal(gama.aproveitaDepois, 34 / 105);
  assert.ok(gama.variacao < -50, `variação de ${gama.variacao}`);
});

test("sem jogo depois do corte, não há aproveitamento depois", () => {
  const cheia = { series: { A: { 2020: [["ÔMEGA (SP)", 3, reta(2)]] } } };
  const [c] = campanhasSemelhantes(cheia, { serie: "A", jogos: 38, pontos: 76 });
  assert.equal(c.jogosDepois, 0);
  assert.equal(c.aproveitaDepois, null);
  assert.equal(c.variacao, null, "dividir por zero jogo não vira porcentagem");
});

test("sem pontos antes do corte, não há variação percentual", () => {
  // 0 em 3 jogos: melhorar 100% de zero não quer dizer nada.
  const zerada = { series: { A: { 2020: [["ZERO (SP)", 18,
    [0, 0, 0, ...Array(35).fill(0).map((_, i) => i + 1)]]] } } };
  const [c] = campanhasSemelhantes(zerada, { serie: "A", jogos: 3, pontos: 0 });
  assert.equal(c.aproveitaAntes, 0);
  assert.ok(c.aproveitaDepois > 0);
  assert.equal(c.variacao, null);
});

test("a zona sai da faixa destacada", () => {
  assert.equal(zonaDaPosicao(1, { melhor: 4, pior: 6 }), "acima");
  assert.equal(zonaDaPosicao(5, { melhor: 4, pior: 6 }), "dentro");
  assert.equal(zonaDaPosicao(4, { melhor: 4, pior: 6 }), "dentro");
  assert.equal(zonaDaPosicao(6, { melhor: 4, pior: 6 }), "dentro");
  assert.equal(zonaDaPosicao(7, { melhor: 4, pior: 6 }), "abaixo");
});

test("a distribuição soma o total e respeita as 20 posições", () => {
  const achadas = campanhasSemelhantes(dados, { serie: "A", jogos: 3, pontos: 6 });
  const contagem = distribuicaoPorPosicao(achadas);
  assert.equal(contagem.length, 20);
  assert.equal(contagem.reduce((s, v) => s + v, 0), achadas.length);
  assert.deepEqual(
    contagem.map((n, i) => [i + 1, n]).filter(([, n]) => n),
    [[1, 1], [4, 1], [8, 1], [20, 1]]);
});

test("o resumo conta as zonas e trata o conjunto vazio", () => {
  const achadas = campanhasSemelhantes(dados, { serie: "A", jogos: 3, pontos: 6 });
  const r = resumoDasSemelhantes(achadas, faixa);
  assert.equal(r.total, 4);
  assert.equal(r.dentro, 2, "o 1º e o 4º estão dentro de 1 a 4");
  assert.equal(r.abaixo, 2, "o 8º e o 20º ficaram fora");
  assert.equal(r.acima, 0);
  assert.equal(r.alcancaram, 2);

  // 1º, 4º, 8º e 20º: média 8,25.
  assert.equal(r.posicaoMedia, 8.25);
  assert.equal(r.mediaFim, (76 + 76 + 75 + 40) / 4);

  const vazio = resumoDasSemelhantes([], faixa);
  assert.equal(vazio.total, 0);
  assert.equal(vazio.mediaFim, null);
  assert.equal(vazio.posicaoMedia, null);
  assert.equal(vazio.melhorFim, null);
});
