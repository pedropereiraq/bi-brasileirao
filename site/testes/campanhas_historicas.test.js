/**
 * O ranking histórico de campanhas.
 *
 * O que precisa de guarda: as duas leituras do recorte — por rodada e por
 * ordem de jogo não são a mesma coisa quando houve jogo adiado —, o mando, e a
 * regra do tapetão, que só entra onde ele cabe. E a campanha em andamento, que
 * não tem posição final e não pode ser tratada como se tivesse.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  campanhasDaSerie, descontoNoRecorte, montarRanking, pagina, paginas,
  pontosNoRecorte,
} from "../public/js/campanhas_historicas.js";

/**
 * Duas edições de três clubes. Em 2025 o ALFA teve o jogo da 1ª rodada adiado
 * para depois da 3ª: a ordem cronológica dele é 2ª, 3ª, 1ª, e é aí que as duas
 * leituras do recorte se separam.
 */
const dados = {
  series: {
    A: {
      2024: {
        clubes: ["ALFA (SP)", "BETA (RJ)", "GAMA (MG)"],
        encerrada: true,
        fim: [[1, 7], [2, 4], [3, 1]],
        rodadas: [[1, 2, 3], [1, 2, 3], [1, 2, 3]],
        mando: ["CFC", "FCF", "CFC"],
        pontos: ["313", "310", "100"],
      },
      2025: {
        clubes: ["ALFA (SP)", "BETA (RJ)"],
        encerrada: true,
        fim: [[2, 4], [1, 6]],
        fim_st: [[1, 7], [2, 6]],
        rodadas: [[2, 3, 1], [1, 2, 3]],
        mando: ["CFC", "FCF"],
        pontos: ["313", "330"],
      },
      2026: {
        clubes: ["ALFA (SP)", "BETA (RJ)"],
        encerrada: false,
        fim: [null, null],
        rodadas: [[1, 2], [1, 2]],
        mando: ["CF", "FC"],
        pontos: ["31", "13"],
      },
    },
  },
};

const edicao = (ano) => dados.series.A[String(ano)];

test("o recorte por rodada e o por ordem de jogo não são a mesma coisa", () => {
  // Os dois recortes pegam dois jogos do ALFA de 2025, mas não os mesmos. Por
  // rodada são os das rodadas 1 e 2 — o último que ele jogou e o primeiro.
  const porRodada = pontosNoRecorte(edicao(2025), 0,
    { porRodada: true, de: 1, ate: 2 });
  assert.deepEqual(porRodada, { pontos: 6, jogos: 2 });

  // Por ordem de jogo são os dois primeiros que ele jogou: rodadas 2 e 3.
  const porJogo = pontosNoRecorte(edicao(2025), 0,
    { porRodada: false, de: 1, ate: 2 });
  assert.deepEqual(porJogo, { pontos: 4, jogos: 2 });

  // E o jogo da 1ª rodada só entra na leitura por ordem no terceiro lugar.
  assert.deepEqual(pontosNoRecorte(edicao(2025), 0,
    { porRodada: true, de: 1, ate: 1 }), { pontos: 3, jogos: 1 });
  assert.deepEqual(pontosNoRecorte(edicao(2025), 0,
    { porRodada: false, de: 1, ate: 1 }), { pontos: 3, jogos: 1 });

  // Sem adiamento as duas coincidem.
  assert.deepEqual(pontosNoRecorte(edicao(2024), 0, { de: 1, ate: 2 }),
    pontosNoRecorte(edicao(2024), 0, { porRodada: false, de: 1, ate: 2 }));
});

test("o mando conta só os jogos daquele lado", () => {
  // ALFA 2024: CFC com 3, 1 e 3.
  assert.deepEqual(pontosNoRecorte(edicao(2024), 0, { mando: "casa" }),
    { pontos: 6, jogos: 2 });
  assert.deepEqual(pontosNoRecorte(edicao(2024), 0, { mando: "fora" }),
    { pontos: 1, jogos: 1 });
  assert.deepEqual(pontosNoRecorte(edicao(2024), 0, { mando: "todos" }),
    { pontos: 7, jogos: 3 });

  // O mando corta junto com a rodada, e não em vez dela.
  assert.deepEqual(pontosNoRecorte(edicao(2024), 0,
    { mando: "casa", de: 1, ate: 1 }), { pontos: 3, jogos: 1 });
});

test("o tapetão só entra onde cabe", () => {
  const punicoes = [{ equipe: "ALFA (SP)", rodada: 2, pontos: -3 }];

  assert.equal(descontoNoRecorte(punicoes, "ALFA (SP)",
    { porRodada: true, de: 1, ate: 3 }), -3);
  assert.equal(descontoNoRecorte(punicoes, "ALFA (SP)",
    { porRodada: true, de: 3, ate: 3 }), 0, "a punição ficou fora do recorte");

  // Punição não tem jogo nem lado de campo: nas duas leituras em que o índice
  // deixa de ser a rodada, ela não entra.
  assert.equal(descontoNoRecorte(punicoes, "ALFA (SP)",
    { porRodada: false, de: 1, ate: 3 }), 0);
  assert.equal(descontoNoRecorte(punicoes, "ALFA (SP)",
    { porRodada: true, de: 1, ate: 3, mando: "casa" }), 0);

  assert.equal(descontoNoRecorte([], "ALFA (SP)", {}), 0);
});

test("a campanha carrega o desfecho, e o tapetão troca qual desfecho é", () => {
  const com = campanhasDaSerie(dados, { serie: "A" })
    .find((c) => c.ano === 2025 && c.equipe === "ALFA (SP)");
  assert.deepEqual([com.posicaoFinal, com.pontosFinais], [2, 4]);

  const sem = campanhasDaSerie(dados, { serie: "A", semTapetao: true })
    .find((c) => c.ano === 2025 && c.equipe === "ALFA (SP)");
  assert.deepEqual([sem.posicaoFinal, sem.pontosFinais], [1, 7]);

  // A edição em andamento entra na lista sem desfecho nenhum.
  const agora = campanhasDaSerie(dados, { serie: "A" })
    .find((c) => c.ano === 2026);
  assert.equal(agora.posicaoFinal, null);
  assert.equal(agora.encerrada, false);
});

test("o ranking ordena, filtra e numera", () => {
  const melhores = montarRanking(dados, { serie: "A" });
  assert.equal(melhores[0].posicao, 1);
  assert.equal(melhores[0].pontos, 7, "sete pontos é o teto do fixture");
  assert.ok(melhores.every((c, i) => i === 0
    || melhores[i - 1].pontos >= c.pontos), "em ordem decrescente");

  const piores = montarRanking(dados, { serie: "A", ordem: "pior" });
  assert.equal(piores[0].pontos, 1);
  assert.equal(piores[0].posicao, 1, "a numeração é do ranking, não da tabela");

  // Empate em pontos: quem terminou melhor vem antes.
  const sete = melhores.filter((c) => c.pontos === 7);
  assert.ok(sete.length > 1);
  assert.ok(sete[0].posicaoFinal <= sete[1].posicaoFinal);
});

test("os filtros cortam por ano, por equipe e por posição final", () => {
  assert.deepEqual(
    [...new Set(montarRanking(dados, { serie: "A", deAno: 2025, ateAno: 2025 })
      .map((c) => c.ano))], [2025]);

  const soAlfa = montarRanking(dados,
    { serie: "A", equipes: new Set(["ALFA (SP)"]) });
  assert.ok(soAlfa.every((c) => c.equipe === "ALFA (SP)"));

  // Pedir uma faixa de posição é perguntar pelo desfecho, e a edição em
  // andamento não tem um: ela sai.
  const campeoes = montarRanking(dados,
    { serie: "A", posicaoDe: 1, posicaoAte: 1 });
  assert.ok(campeoes.every((c) => c.posicaoFinal === 1));
  assert.ok(!campeoes.some((c) => c.ano === 2026));

  // Com a faixa inteira aberta, ela volta.
  assert.ok(montarRanking(dados, { serie: "A" }).some((c) => c.ano === 2026));

  // Recorte em que um clube não jogou nada não vira linha zerada.
  const nada = montarRanking(dados,
    { serie: "A", porRodada: true, de: 9, ate: 9 });
  assert.deepEqual(nada, []);
});

test("a paginação não sai do lugar quando pedem página que não existe", () => {
  const ranking = Array.from({ length: 250 }, (_, i) => ({ posicao: i + 1 }));

  assert.equal(paginas(250, 104), 3);
  assert.equal(paginas(0, 104), 1, "ranking vazio ainda é uma página");
  assert.equal(pagina(ranking, 1, 104).length, 104);
  assert.equal(pagina(ranking, 3, 104).length, 42);
  assert.equal(pagina(ranking, 9, 104)[0].posicao, 209, "cai na última");
  assert.equal(pagina(ranking, 0, 104)[0].posicao, 1);
  assert.deepEqual(pagina([], 1, 104), []);
});
