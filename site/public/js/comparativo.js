/**
 * Página do card de comparativo de campanhas.
 *
 * Fora do card: a série, e um par ano + equipe para cada campanha. Os anos são
 * independentes, de propósito — é o que permite cruzar o Bahia de 2026 com o
 * Bahia de 2019, ou com outro clube de outro ano.
 */
import { clubesDaEdicao, tabela } from "/js/motor.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_comparativo.js";
import { nomeBonito } from "/js/nomes.js";

const estado = {
  edicoes: [], clubes: {}, serie: null,
  a: { apelido: null, edicao: null, jogos: null, clube: null },
  b: { apelido: null, edicao: null, jogos: null, clube: null },
};

const el = (id) => document.getElementById(id);
let redesenhar = () => {};

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("escolha duas campanhas diferentes");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [edicoes, clubes] = await Promise.all([
    fetch("/dados/edicoes.json").then((r) => r.json()),
    fetch("/dados/clubes.json").then((r) => r.json()),
  ]);
  estado.edicoes = edicoes.edicoes;
  estado.clubes = clubes;

  const series = [...new Set(estado.edicoes.map((e) => e.serie))].sort();
  el("serie").innerHTML = series
    .map((s) => `<option value="${s}">Série ${s}</option>`).join("");
  el("serie").addEventListener("change", () => trocarSerie(el("serie").value));

  for (const lado of ["a", "b"]) {
    el(`ano-${lado}`).addEventListener("change",
      () => trocarAno(lado, el(`ano-${lado}`).value));
    el(`equipe-${lado}`).addEventListener("change", () => {
      estado[lado].clube = el(`equipe-${lado}`).value;
      aplicar();
    });
  }
  el("trocar").addEventListener("click", inverter);

  const url = daUrl();
  await trocarSerie(url.serie ?? series[0], url);
}

const anosDaSerie = (serie) => estado.edicoes.filter((e) => e.serie === serie);

async function trocarSerie(serie, url = {}) {
  estado.serie = serie;
  el("serie").value = serie;

  const anos = anosDaSerie(serie);
  const opcoes = anos
    .map((e) => `<option value="${e.apelido}">${e.ano}</option>`).join("");
  for (const lado of ["a", "b"]) el(`ano-${lado}`).innerHTML = opcoes;

  // Ao trocar de série, os anos guardados podem não existir mais.
  await trocarAno("a", valido(url.anoA ?? estado.a.apelido, anos) ?? anos[0].apelido,
                  url.a, { silencioso: true });
  await trocarAno("b", valido(url.anoB ?? estado.b.apelido, anos) ?? anos[0].apelido,
                  url.b, { silencioso: true });
  aplicar();
}

const valido = (apelido, anos) =>
  anos.some((e) => e.apelido === apelido) ? apelido : null;

async function trocarAno(lado, apelido, clubeDesejado, { silencioso = false } = {}) {
  const edicao = estado.edicoes.find((e) => e.apelido === apelido);
  if (!edicao) return;

  el(`ano-${lado}`).value = apelido;
  const jogos = await fetch(`/dados/jogos/${apelido}.json`).then((r) => r.json());
  const clubes = clubesDaEdicao(jogos);

  el(`equipe-${lado}`).innerHTML = clubes
    .map((c) => `<option value="${c}">${nomeBonito(c)}</option>`).join("");

  // Mantém o clube quando ele jogou naquele ano; senão propõe um da frente da
  // tabela, que é a campanha que alguém abriria primeiro.
  const classificados = tabela(jogos, clubes, {}).map((c) => c.equipe);
  const atual = clubeDesejado ?? estado[lado].clube;
  const escolhido = clubes.includes(atual) ? atual
    : classificados[lado === "a" ? 0 : 1] ?? clubes[0];

  Object.assign(estado[lado], { apelido, edicao, jogos, clube: escolhido });
  el(`equipe-${lado}`).value = escolhido;

  if (!silencioso) aplicar();
}

function inverter() {
  const { a, b } = estado;
  [estado.a, estado.b] = [b, a];
  for (const lado of ["a", "b"]) {
    el(`ano-${lado}`).value = estado[lado].apelido;
    el(`equipe-${lado}`).innerHTML = clubesDaEdicao(estado[lado].jogos)
      .map((c) => `<option value="${c}">${nomeBonito(c)}</option>`).join("");
    el(`equipe-${lado}`).value = estado[lado].clube;
  }
  aplicar();
}

function aplicar() {
  atualizarUrl();
  redesenhar();
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  return { serie: p.get("serie"), anoA: p.get("anoA"), a: p.get("a"),
           anoB: p.get("anoB"), b: p.get("b") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.a.apelido) { p.set("anoA", estado.a.apelido); p.set("a", estado.a.clube); }
  if (estado.b.apelido) { p.set("anoB", estado.b.apelido); p.set("b", estado.b.clube); }
  history.replaceState(null, "", `#${p}`);
}
