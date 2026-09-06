/**
 * Prova que o motor do navegador reproduz o motor Python.
 *
 * O gabarito é gerado por `testes/test_motor_navegador.py`, a partir do motor
 * que reproduz as 30.400 linhas da matriz do Excel sem divergência. Aqui se
 * cobra que o JavaScript devolva exatamente o mesmo — posição, pontos, jogos,
 * triunfos, empates, derrotas e gols — em toda edição, todo mando e toda etapa.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  tabela, clubesDaEdicao, campanha, porMando, chaveAlfabetica, formatoLongo,
} from "../public/js/motor.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const gabarito = JSON.parse(readFileSync(join(AQUI, "gabarito.json"), "utf-8"));

// Ordem das colunas em cada linha do esperado, definida no gerador do gabarito.
const [EQUIPE, POS, PTS, J, T, E, D, GP, GC] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

test("o gabarito foi gerado e tem as edições esperadas", () => {
  const apelidos = Object.keys(gabarito.edicoes);
  assert.ok(apelidos.length >= 4, `só ${apelidos.length} edições no gabarito`);
  for (const apelido of apelidos) {
    assert.ok(gabarito.edicoes[apelido].jogos.length > 0);
  }
});

for (const [apelido, registro] of Object.entries(gabarito.edicoes)) {
  const { jogos, esperado } = registro;
  const clubes = clubesDaEdicao(jogos);

  test(`${apelido}: a edição tem 20 clubes`, () => {
    assert.equal(clubes.length, 20);
  });

  for (const [local, etapas] of Object.entries(esperado)) {
    test(`${apelido} · ${local}: bate com o motor Python em toda etapa`, () => {
      for (const [etapa, linhasEsperadas] of Object.entries(etapas)) {
        const calculado = tabela(jogos, clubes, {
          mando: local,
          rodadaAte: Number(etapa),
        });

        assert.equal(calculado.length, linhasEsperadas.length,
          `${apelido} ${local} etapa ${etapa}: número de clubes`);

        for (const esperada of linhasEsperadas) {
          const obtida = calculado.find((c) => c.equipe === esperada[EQUIPE]);
          const onde = `${apelido} ${local} etapa ${etapa} ${esperada[EQUIPE]}`;
          assert.ok(obtida, `${onde}: clube ausente da tabela calculada`);
          assert.equal(obtida.pos, esperada[POS], `${onde}: posição`);
          assert.equal(obtida.pts, esperada[PTS], `${onde}: pontos`);
          assert.equal(obtida.j, esperada[J], `${onde}: jogos`);
          assert.equal(obtida.t, esperada[T], `${onde}: triunfos`);
          assert.equal(obtida.e, esperada[E], `${onde}: empates`);
          assert.equal(obtida.d, esperada[D], `${onde}: derrotas`);
          assert.equal(obtida.gp, esperada[GP], `${onde}: gols pró`);
          assert.equal(obtida.gc, esperada[GC], `${onde}: gols contra`);
        }
      }
    });
  }
}

// ------------------------------------------------------------- desempate
test("a ordem alfabética ignora acento", () => {
  assert.equal(chaveAlfabetica("SÃO PAULO (SP)"), "SAO PAULO (SP)");
  assert.ok(chaveAlfabetica("SÃO PAULO (SP)") < chaveAlfabetica("SPORT (PE)"));
  // Sem a normalização a ordem se inverteria — é o motivo de a função existir.
  assert.ok("SÃO PAULO (SP)" > "SPORT (PE)");
});

test("2025 A rodada 1: o empate absoluto segue a ordem alfabética", () => {
  const registro = gabarito.edicoes["A2025"];
  if (!registro) return; // edição não está no gabarito
  const linha = tabela(registro.jogos, clubesDaEdicao(registro.jogos),
                       { rodadaAte: 1 });
  const saoPaulo = linha.find((c) => c.equipe === "SÃO PAULO (SP)");
  const sport = linha.find((c) => c.equipe === "SPORT (PE)");
  assert.equal(saoPaulo.pts, sport.pts);
  assert.equal(saoPaulo.t, sport.t);
  assert.equal(saoPaulo.sg, sport.sg);
  assert.equal(saoPaulo.gp, sport.gp);
  assert.ok(saoPaulo.pos < sport.pos, "São Paulo deveria vir antes de Sport");
});

// --------------------------------------------------------------- filtros
const qualquer = Object.values(gabarito.edicoes)[0];

test("jogo sem placar não entra na conta", () => {
  const comPendente = [...qualquer.jogos.map((j) => [...j])];
  const alvo = comPendente.find((j) => j[6] === "realizado");
  const antes = formatoLongo(comPendente).length;
  alvo[6] = "agendado";
  assert.equal(formatoLongo(comPendente).length, antes - 2,
    "tirar um jogo deveria tirar as duas linhas dele");
});

test("casa + fora reconstroem a tabela completa", () => {
  const clubes = clubesDaEdicao(qualquer.jogos);
  const todos = tabela(qualquer.jogos, clubes, {});
  const casa = tabela(qualquer.jogos, clubes, { mando: "casa" });
  const fora = tabela(qualquer.jogos, clubes, { mando: "fora" });

  for (const clube of clubes) {
    const t = todos.find((c) => c.equipe === clube);
    const c = casa.find((x) => x.equipe === clube);
    const f = fora.find((x) => x.equipe === clube);
    assert.equal(c.pts + f.pts, t.pts, `${clube}: pontos`);
    assert.equal(c.j + f.j, t.j, `${clube}: jogos`);
    assert.equal(c.gp + f.gp, t.gp, `${clube}: gols pró`);
  }
});

test("intervalo de rodadas é a diferença entre dois acumulados", () => {
  const clubes = clubesDaEdicao(qualquer.jogos);
  const ate20 = tabela(qualquer.jogos, clubes, { rodadaAte: 20 });
  const ate9 = tabela(qualquer.jogos, clubes, { rodadaAte: 9 });
  const de10a20 = tabela(qualquer.jogos, clubes, { rodadaDe: 10, rodadaAte: 20 });

  for (const clube of clubes) {
    const a = ate20.find((c) => c.equipe === clube);
    const b = ate9.find((c) => c.equipe === clube);
    const c = de10a20.find((x) => x.equipe === clube);
    assert.equal(c.pts, a.pts - b.pts, `${clube}: pontos no intervalo`);
    assert.equal(c.j, a.j - b.j, `${clube}: jogos no intervalo`);
  }
});

test("últimos X jogos conta por clube, não no conjunto", () => {
  const clubes = clubesDaEdicao(qualquer.jogos);
  const ultimos5 = tabela(qualquer.jogos, clubes, { ultimos: 5 });
  for (const linha of ultimos5) {
    assert.ok(linha.j <= 5, `${linha.equipe}: ${linha.j} jogos em "últimos 5"`);
  }
  const somaJogos = ultimos5.reduce((s, c) => s + c.j, 0);
  assert.ok(somaJogos > 50, "cada clube deveria ter seus próprios 5 últimos");
});

test("a classificação é estável sob reordenação da entrada", () => {
  const clubes = clubesDaEdicao(qualquer.jogos);
  const direta = tabela(qualquer.jogos, clubes, {}).map((c) => c.equipe);
  const invertida = tabela([...qualquer.jogos].reverse(), clubes, {})
    .map((c) => c.equipe);
  assert.deepEqual(direta, invertida);
});

test("toda posição de 1 a 20 aparece uma vez só", () => {
  for (const registro of Object.values(gabarito.edicoes)) {
    const clubes = clubesDaEdicao(registro.jogos);
    for (const filtros of [{}, { mando: "casa" }, { ultimos: 3 },
                           { rodadaDe: 5, rodadaAte: 12 }]) {
      const linha = tabela(registro.jogos, clubes, filtros);
      const posicoes = linha.map((c) => c.pos).sort((a, b) => a - b);
      assert.deepEqual(posicoes, Array.from({ length: 20 }, (_, i) => i + 1));
    }
  }
});

// -------------------------------------------------------------- campanha
test("a campanha soma o mesmo que a tabela", () => {
  const clubes = clubesDaEdicao(qualquer.jogos);
  const linha = tabela(qualquer.jogos, clubes, {});
  const lider = linha[0];
  const passos = campanha(qualquer.jogos, lider.equipe, {});
  const ultimo = passos[passos.length - 1];

  assert.equal(ultimo.pts_ac, lider.pts, "pontos ao fim da campanha");
  assert.equal(ultimo.j_ac, lider.j, "jogos ao fim da campanha");
  assert.equal(ultimo.pos, lider.pos, "posição ao fim da campanha");
  assert.equal(passos.length, lider.j, "um passo por jogo disputado");
});

test("o resumo por mando é do clube pedido, e casa + fora fecha", () => {
  const clubes = clubesDaEdicao(qualquer.jogos);
  const tabelaCheia = tabela(qualquer.jogos, clubes, {});

  // Um clube do meio da tabela: se a função devolvesse o líder por engano,
  // pegar o líder como cobaia esconderia o erro.
  const clube = tabelaCheia[10].equipe;
  const total = tabelaCheia.find((c) => c.equipe === clube);
  const mandos = porMando(qualquer.jogos, clube, {});

  for (const mando of ["casa", "fora", "todos"]) {
    assert.equal(mandos[mando].equipe, clube, `${mando}: clube errado`);
  }
  assert.equal(mandos.casa.pts + mandos.fora.pts, total.pts, "pontos");
  assert.equal(mandos.casa.j + mandos.fora.j, total.j, "jogos");
  assert.equal(mandos.todos.pts, total.pts, "mando todos");
});
