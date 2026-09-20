/**
 * Página do card de evolução da pontuação.
 *
 * Fora do card: série, ano e as duas equipes. Dentro: só o card. Trocar
 * qualquer filtro redesenha na hora.
 */
import { clubesDaEdicao, tabela } from "/js/motor.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_evolucao.js";

const estado = {
  edicoes: [], clubes: {}, jogos: null, edicao: null,
  equipeA: null, equipeB: null,
};

const el = (id) => document.getElementById(id);
const nomeCurto = (equipe) => equipe.replace(/\s*\([A-Z]{2}\)$/, "");

let redesenhar = () => {};

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard(
    "escolha duas equipes diferentes para desenhar o card");
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

  el("serie").addEventListener("change", () => {
    const primeira = estado.edicoes.find((e) => e.serie === el("serie").value);
    trocarEdicao(primeira.apelido);
  });
  el("ano").addEventListener("change", () => trocarEdicao(el("ano").value));
  el("equipe-a").addEventListener("change", () => {
    estado.equipeA = el("equipe-a").value;
    evitarRepetida("a");
    aplicar();
  });
  el("equipe-b").addEventListener("change", () => {
    estado.equipeB = el("equipe-b").value;
    evitarRepetida("b");
    aplicar();
  });
  el("trocar").addEventListener("click", () => {
    [estado.equipeA, estado.equipeB] = [estado.equipeB, estado.equipeA];
    el("equipe-a").value = estado.equipeA;
    el("equipe-b").value = estado.equipeB;
    aplicar();
  });

  await trocarEdicao(daUrl().edicao ?? estado.edicoes[0].apelido);
}

async function trocarEdicao(apelido) {
  const edicao = estado.edicoes.find((e) => e.apelido === apelido);
  if (!edicao) return;

  el("serie").value = edicao.serie;
  el("ano").innerHTML = estado.edicoes
    .filter((e) => e.serie === edicao.serie)
    .map((e) => `<option value="${e.apelido}">${e.ano}</option>`).join("");
  el("ano").value = apelido;

  estado.jogos = await fetch(`/dados/jogos/${apelido}.json`).then((r) => r.json());
  estado.edicao = edicao;

  const clubes = clubesDaEdicao(estado.jogos);
  const opcoes = clubes
    .map((c) => `<option value="${c}">${nomeCurto(c)}</option>`).join("");
  el("equipe-a").innerHTML = opcoes;
  el("equipe-b").innerHTML = opcoes;

  // Ao trocar de edição, os clubes mudam. Mantém a escolha quando ela ainda
  // existe; senão, começa pelos dois primeiros da tabela, que é a comparação
  // que alguém abriria primeiro.
  const daUrlAtual = daUrl();
  const classificados = tabela(estado.jogos, clubes, {}).map((c) => c.equipe);
  estado.equipeA = escolher(estado.equipeA ?? daUrlAtual.a, clubes, classificados[0]);
  estado.equipeB = escolher(estado.equipeB ?? daUrlAtual.b, clubes, classificados[1]);
  if (estado.equipeA === estado.equipeB) {
    estado.equipeB = classificados.find((c) => c !== estado.equipeA);
  }

  el("equipe-a").value = estado.equipeA;
  el("equipe-b").value = estado.equipeB;
  aplicar();
}

const escolher = (desejada, disponiveis, reserva) =>
  disponiveis.includes(desejada) ? desejada : reserva;

/** Duas vezes a mesma equipe não desenha card; a outra cede o lugar. */
function evitarRepetida(mexida) {
  if (estado.equipeA !== estado.equipeB) return;
  const clubes = clubesDaEdicao(estado.jogos);
  const outra = clubes.find((c) => c !== estado.equipeA);
  if (mexida === "a") {
    estado.equipeB = outra;
    el("equipe-b").value = outra;
  } else {
    estado.equipeA = outra;
    el("equipe-a").value = outra;
  }
}

function aplicar() {
  atualizarUrl();
  redesenhar();
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  return { edicao: p.get("edicao"), a: p.get("a"), b: p.get("b") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.edicao) p.set("edicao", estado.edicao.apelido);
  if (estado.equipeA) p.set("a", estado.equipeA);
  if (estado.equipeB) p.set("b", estado.equipeB);
  history.replaceState(null, "", `#${p}`);
}
