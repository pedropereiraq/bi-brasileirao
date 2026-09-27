/**
 * O menu do BI.
 *
 * O que precisa de guarda é o que a divisão em seções criou de novo: uma tela
 * pode ficar de fora do menu, ou aparecer em duas seções, e nos dois casos o
 * BI continua funcionando — só não se chega mais nela pelo cabeçalho. E a
 * seção da página aberta tem de se reconhecer, senão ninguém sabe onde está.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";

import {
  SECOES, montarMenu, secaoDaTela, telaAtual,
} from "../public/js/navegacao.js";

const todas = SECOES.flatMap((s) => s.telas.map(([href]) => href));

test("toda tela do site está no menu, e uma vez só", () => {
  const publicadas = readdirSync(new URL("../public/", import.meta.url))
    .filter((nome) => nome.endsWith(".html") && nome !== "index.html")
    .map((nome) => `/${nome}`)
    .sort();

  assert.deepEqual([...todas].sort(), publicadas,
    "tela nova sem entrada no menu não se acha pelo cabeçalho");
  assert.equal(new Set(todas).size, todas.length,
    "a mesma tela em duas seções deixa a divisão sem sentido");
});

test("a capa e o index são a mesma página", () => {
  assert.equal(telaAtual("/"), "/");
  assert.equal(telaAtual("/index.html"), "/");
  assert.equal(telaAtual(undefined), "/");
  assert.equal(telaAtual("/gols.html"), "/gols.html");
});

test("cada tela sabe de que seção é", () => {
  assert.equal(secaoDaTela("/gols.html").nome, "A edição");
  assert.equal(secaoDaTela("/simulador.html").nome, "A reta final");
  assert.equal(secaoDaTela("/"), null, "a capa não é de seção nenhuma");
});

test("o menu marca a tela aberta e a seção dela", () => {
  const html = montarMenu("/media-movel.html");

  assert.match(html, /<a href="\/media-movel\.html" aria-current="page">/);
  assert.match(html, /data-aqui="sim">Um clube</);
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1,
    "só a tela aberta fica marcada");
  assert.doesNotMatch(html, /class="menu-inicio" href="\/" aria-current/);

  // Na capa, quem se acende é o botão de início, e nenhuma seção.
  const capa = montarMenu("/");
  assert.match(capa, /class="menu-inicio" href="\/" aria-current="page"/);
  assert.doesNotMatch(capa, /data-aqui/);
});

test("seção de uma tela só é link, e não menu suspenso", () => {
  const html = montarMenu("/atualizar.html");
  assert.match(html,
    /<a class="menu-botao" href="\/atualizar\.html" aria-current="page">/);
  assert.equal(SECOES.filter((s) => s.telas.length === 1).length, 1);
  assert.equal((html.match(/<button/g) ?? []).length, SECOES.length - 1);
});
