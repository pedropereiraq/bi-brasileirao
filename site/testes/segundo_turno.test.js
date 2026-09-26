/**
 * A regra que abre o simulador e o comparativo de turnos.
 *
 * O que precisa de guarda: o critério é o jogo disputado, e não a rodada do
 * calendário — uma edição cuja 20ª rodada foi adiada mas que já jogou a 21ª
 * está no segundo turno —, e a primeira rodada do returno sai do tamanho da
 * edição, para uma tabela mais curta não herdar o 20 do Brasileirão.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  avisoDoSegundoTurno, noSegundoTurno, primeiraRodadaDoReturno,
} from "../public/js/segundo_turno.js";

const jogo = (rodada, status) => [rodada, "2026-05-01", "A", "B", 1, 0, status];

test("o returno começa na metade das rodadas da edição", () => {
  assert.equal(primeiraRodadaDoReturno({ rodadas: 38 }), 20);
  assert.equal(primeiraRodadaDoReturno({ rodadas: 22 }), 12);
  assert.equal(primeiraRodadaDoReturno({}), 20, "sem o total, o padrão de 38");
});

test("basta um jogo do returno já disputado", () => {
  const primeiroTurno = [jogo(19, "realizado"), jogo(20, "agendado")];
  assert.equal(noSegundoTurno(primeiroTurno, { rodadas: 38 }), false);

  // A 20ª ficou para depois, mas a 21ª aconteceu: o campeonato está no
  // segundo turno, e é isso que a tela pergunta.
  const comAdiado = [jogo(20, "agendado"), jogo(21, "realizado")];
  assert.equal(noSegundoTurno(comAdiado, { rodadas: 38 }), true);

  assert.equal(noSegundoTurno([], { rodadas: 38 }), false);
  assert.equal(noSegundoTurno(undefined), false);
});

test("o aviso só existe enquanto a tela não vale", () => {
  const aviso = avisoDoSegundoTurno({
    jogos: [jogo(3, "realizado")], rodadas: 38, tela: "O simulador",
  });
  assert.match(aviso, /^O simulador só vale a partir do segundo turno/);
  assert.match(aviso, /20ª rodada/);

  assert.equal(avisoDoSegundoTurno({
    jogos: [jogo(25, "realizado")], rodadas: 38,
  }), null);
});
