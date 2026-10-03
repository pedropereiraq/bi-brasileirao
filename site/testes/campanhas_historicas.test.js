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
  POR_PAGINA, campanhasDaSerie, descontoNoRecorte, montarRanking,
  montarRankingDeEquipes, montarRankingDeTurnos, pagina, paginas,
  pontosNoRecorte, rodadasDaEdicao, rodadasDoTurno,
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

  // A página fecha em cem: "do 101º ao 200º" se lê sem conta.
  assert.equal(POR_PAGINA, 100);
  assert.equal(paginas(250), 3);
  assert.equal(pagina(ranking, 2)[0].posicao, 101);

  assert.equal(paginas(250, 104), 3);
  assert.equal(paginas(0, 104), 1, "ranking vazio ainda é uma página");
  assert.equal(pagina(ranking, 1, 104).length, 104);
  assert.equal(pagina(ranking, 3, 104).length, 42);
  assert.equal(pagina(ranking, 9, 104)[0].posicao, 209, "cai na última");
  assert.equal(pagina(ranking, 0, 104)[0].posicao, 1);
  assert.deepEqual(pagina([], 1, 104), []);
});

test("o ranking por equipe soma as edições do clube", () => {
  const equipes = montarRankingDeEquipes(dados, { serie: "A" });

  // O ALFA jogou as três edições do fixture: 7 + 7 + 4 pontos em 8 jogos.
  const alfa = equipes.find((e) => e.equipe === "ALFA (SP)");
  assert.deepEqual([alfa.pontos, alfa.jogos, alfa.edicoes], [18, 8, 3]);
  assert.equal(alfa.melhorFim, 1, "o melhor desfecho que ele já teve");
  assert.equal(Math.round(alfa.aproveitamento * 100), 75);

  // O GAMA só existe em 2024, e não vira linha de três edições.
  const gama = equipes.find((e) => e.equipe === "GAMA (MG)");
  assert.deepEqual([gama.pontos, gama.jogos, gama.edicoes], [1, 3, 1]);

  assert.deepEqual(equipes.map((e) => e.posicao), [1, 2, 3]);
  assert.ok(equipes[0].pontos >= equipes[1].pontos, "do maior para o menor");
});

test("o recorte vale igual no ranking por equipe", () => {
  // Só a 1ª rodada: o ALFA fez 3 em 2024, 3 em 2025 e 3 em 2026.
  const primeira = montarRankingDeEquipes(dados,
    { serie: "A", porRodada: true, de: 1, ate: 1 });
  const alfa = primeira.find((e) => e.equipe === "ALFA (SP)");
  assert.deepEqual([alfa.pontos, alfa.jogos, alfa.edicoes], [9, 3, 3]);

  // Recorte por ano, e o clube que some do intervalo some do ranking.
  const so2024 = montarRankingDeEquipes(dados,
    { serie: "A", deAno: 2024, ateAno: 2024 });
  assert.equal(so2024.length, 3);
  assert.equal(so2024.find((e) => e.equipe === "ALFA (SP)").edicoes, 1);

  const soBeta = montarRankingDeEquipes(dados,
    { serie: "A", equipes: new Set(["BETA (RJ)"]) });
  assert.deepEqual(soBeta.map((e) => e.equipe), ["BETA (RJ)"]);

  // Recorte sem jogo nenhum não devolve clubes zerados.
  assert.deepEqual(montarRankingDeEquipes(dados,
    { serie: "A", porRodada: true, de: 9, ate: 9 }), []);
});

test("o turno é a metade exata da edição", () => {
  assert.deepEqual(rodadasDoTurno(38, 1), { de: 1, ate: 19 });
  assert.deepEqual(rodadasDoTurno(38, 2), { de: 20, ate: 38 });

  // Edição ímpar: a rodada do meio cai no segundo turno.
  assert.deepEqual(rodadasDoTurno(5, 1), { de: 1, ate: 2 });
  assert.deepEqual(rodadasDoTurno(5, 2), { de: 3, ate: 5 });

  // O tamanho sai da maior rodada jogada, e não de um número guardado.
  assert.equal(rodadasDaEdicao(edicao(2024)), 3);
  assert.equal(rodadasDaEdicao(undefined), 0);
});

test("cada clube vira duas linhas, uma por turno", () => {
  const todos = montarRankingDeTurnos(dados, { serie: "A", deAno: 2024, ateAno: 2024 });

  // Três clubes, dois turnos: seis linhas, menos as que não tiveram jogo.
  assert.equal(todos.length, 6);
  assert.deepEqual([...new Set(todos.map((l) => l.turno))].sort(), [1, 2]);

  // 2024 tem 3 rodadas: o 1º turno é só a 1ª e o 2º é a 2ª e a 3ª.
  const alfa1 = todos.find((l) => l.equipe === "ALFA (SP)" && l.turno === 1);
  const alfa2 = todos.find((l) => l.equipe === "ALFA (SP)" && l.turno === 2);
  assert.deepEqual([alfa1.pontos, alfa1.jogos], [3, 1]);
  assert.deepEqual([alfa2.pontos, alfa2.jogos], [4, 2], "1 e 3");

  // A numeração é do ranking inteiro, misturando os dois turnos.
  assert.deepEqual(todos.map((l) => l.posicao), [1, 2, 3, 4, 5, 6]);
  assert.ok(todos[0].pontos >= todos[1].pontos);
});

test("o filtro de turno tira o que não foi pedido", () => {
  const so1 = montarRankingDeTurnos(dados, { serie: "A", turnos: [1] });
  assert.ok(so1.every((l) => l.turno === 1));

  const so2 = montarRankingDeTurnos(dados, { serie: "A", turnos: [2] });
  assert.ok(so2.every((l) => l.turno === 2));

  assert.deepEqual(montarRankingDeTurnos(dados, { serie: "A", turnos: [] }), []);
});

test("o turno carrega o desfecho da edição, e o mando recorta junto", () => {
  const linhas = montarRankingDeTurnos(dados,
    { serie: "A", deAno: 2024, ateAno: 2024 });
  const alfa = linhas.find((l) => l.equipe === "ALFA (SP)" && l.turno === 1);
  assert.equal(alfa.posicaoFinal, 1, "a posição final é da edição inteira");

  // ALFA 2024 é CFC: em casa, o 1º turno tem só o jogo da 1ª rodada.
  const emCasa = montarRankingDeTurnos(dados,
    { serie: "A", deAno: 2024, ateAno: 2024, mando: "casa" })
    .find((l) => l.equipe === "ALFA (SP)" && l.turno === 1);
  assert.deepEqual([emCasa.pontos, emCasa.jogos], [3, 1]);

  // E a edição em andamento só passa com a faixa de posição aberta.
  assert.ok(montarRankingDeTurnos(dados, { serie: "A" }).some((l) => l.ano === 2026));
  assert.ok(!montarRankingDeTurnos(dados,
    { serie: "A", posicaoDe: 1, posicaoAte: 1 }).some((l) => l.ano === 2026));
});
