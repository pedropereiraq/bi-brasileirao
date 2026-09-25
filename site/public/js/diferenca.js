/**
 * Página do card de diferença entre dois pontos da tabela.
 *
 * O primeiro filtro não escolhe um valor: escolhe **que pergunta** está sendo
 * feita. Equipe contra equipe é uma disputa; equipe contra posição é um
 * objetivo; posição contra posição é o formato do campeonato naquele ano. Os
 * controles que aparecem em seguida mudam junto, porque cada pergunta precisa
 * de outros dois operandos.
 *
 * A grade vem de `posicoes.json`, a mesma da média por posição e rodada; os
 * jogos da edição entram por causa da faixa do eixo, que mostra a agenda do
 * lado que é equipe.
 */
import { aoMudarTapetao, tapetaoLigado } from "/js/tapetao.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_diferenca.js";
import { MODOS, colunaDaRodada, edicaoDe } from "/js/diferenca_pontos.js";
import {
  ligarSeletorDePosicao, ligarSeletorDePosicoes,
} from "/js/seletor_posicoes.js";
import { nomeBonito, nomeComUf } from "/js/nomes.js";

const BAHIA = "BAHIA (BA)";
const PADRAO_FAIXA = { melhor: 4, pior: 17 };

const estado = {
  edicoes: [], clubes: {}, posicoes: null,
  serie: null, edicao: null, grade: null, jogos: null,
  modo: "equipe-equipe",
  equipeA: null, equipeB: null,
  posicao: 4, faixa: { ...PADRAO_FAIXA },
  a: null, b: null,
};

const el = (id) => document.getElementById(id);
let redesenhar = () => {};

// Virar a chave do tapetão muda a tabela: a página inteira se redesenha.
aoMudarTapetao(() => aplicar());
let trilhaUma = null;
let trilhaDuas = null;

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("escolha dois pontos para comparar");
  // Dois lados iguais não têm diferença nenhuma: a página avisa em vez de
  // desenhar uma linha reta no zero.
  redesenhar = ligarPaginaDeCard(
    () => (compararConsigo() ? null : montarCartao(estado)));

  const [edicoes, clubes, posicoes] = await Promise.all([
    fetch("/dados/edicoes.json").then((r) => r.json()),
    fetch("/dados/clubes.json").then((r) => r.json()),
    fetch("/dados/posicoes.json").then((r) => r.json()),
  ]);
  Object.assign(estado, { edicoes: edicoes.edicoes, clubes, posicoes });

  const url = daUrl();
  montarChaves("serie", [...new Set(estado.edicoes.map((e) => e.serie))].sort()
    .map((s) => ({ valor: s, rotulo: `Série ${s}` })), trocarSerie);
  montarChaves("modo", Object.entries(MODOS)
    .map(([valor, m]) => ({ valor, rotulo: m.rotulo })), trocarModo);

  el("ano").addEventListener("change", () => trocarAno(el("ano").value));
  el("equipe-a").addEventListener("change", () => {
    estado.equipeA = el("equipe-a").value;
    // A posição volta a ser a da equipe: o padrão do filtro é "onde ela está",
    // e manter a posição da equipe anterior seria uma escolha de ninguém.
    if (estado.modo === "equipe-posicao") levarPosicaoAoClube();
    aplicar();
  });
  el("equipe-b").addEventListener("change", () => {
    estado.equipeB = el("equipe-b").value;
    aplicar();
  });

  if (url.modo && MODOS[url.modo]) estado.modo = url.modo;
  if (url.posicao) estado.posicao = url.posicao;
  if (url.melhor && url.pior) estado.faixa = { melhor: url.melhor, pior: url.pior };

  trilhaUma = ligarSeletorDePosicao({
    raiz: el("posicao-uma"), posicao: estado.posicao,
    aoMudar: (posicao) => { estado.posicao = posicao; aplicar(); },
  });
  trilhaDuas = ligarSeletorDePosicoes({
    raiz: el("posicao-duas"), ...estado.faixa,
    aoMudar: ({ pior, melhor }) => { estado.faixa = { pior, melhor }; aplicar(); },
  });

  await trocarSerie(url.serie ?? "A", url);
}

/* -------------------------------------------------------------- filtros */
function montarChaves(id, itens, aoEscolher) {
  const caixa = el(id);
  caixa.innerHTML = itens
    .map((i) => `<button type="button" class="chave" data-valor="${i.valor}"
                   aria-pressed="false">${i.rotulo}</button>`).join("");
  caixa.addEventListener("click", (evento) => {
    const botao = evento.target.closest(".chave");
    if (botao) aoEscolher(botao.dataset.valor);
  });
}

function pintarChaves(id, escolhido) {
  for (const botao of el(id).children) {
    botao.setAttribute("aria-pressed", String(botao.dataset.valor === escolhido));
  }
}

async function trocarSerie(serie, url = {}) {
  estado.serie = serie;
  pintarChaves("serie", serie);

  const anos = estado.edicoes.filter((e) => e.serie === serie);
  el("ano").innerHTML = anos
    .map((e) => `<option value="${e.apelido}">${e.ano}</option>`).join("");

  const desejado = url.ano ?? estado.edicao?.apelido;
  const escolhido = anos.some((e) => e.apelido === desejado)
    ? desejado : anos[0].apelido;
  await trocarAno(escolhido, url);
}

async function trocarAno(apelido, url = {}) {
  const edicao = estado.edicoes.find((e) => e.apelido === apelido);
  if (!edicao) return;
  el("ano").value = apelido;

  const grade = edicaoDe(estado.posicoes, { serie: edicao.serie, ano: edicao.ano });
  const jogos = await fetch(`/dados/jogos/${apelido}.json`).then((r) => r.json());
  Object.assign(estado, { edicao, grade, jogos });

  const doEdital = grade?.clubes ?? [];
  for (const id of ["equipe-a", "equipe-b"]) {
    el(id).innerHTML = doEdital
      .map((c) => `<option value="${c}">${nomeComUf(c)}</option>`).join("");
  }

  const tabela = colunaDaRodada(grade, grade?.rodadas ?? 0) ?? [];
  const lider = tabela[0]?.equipe ?? doEdital[0];
  const vice = tabela[1]?.equipe ?? doEdital[1];

  // Mantém as equipes quando elas jogaram o ano escolhido; senão propõe o
  // Bahia — é o clube da casa — e o líder do outro lado.
  estado.equipeA = escolher([url.a, estado.equipeA, BAHIA, lider], doEdital);
  estado.equipeB = escolher([url.b, estado.equipeB, lider, vice], doEdital,
                            estado.equipeA);
  el("equipe-a").value = estado.equipeA;
  el("equipe-b").value = estado.equipeB;

  if (!url.posicao) levarPosicaoAoClube();
  trocarModo(estado.modo);
}

const escolher = (candidatos, disponiveis, proibido) =>
  candidatos.find((c) => c && c !== proibido && disponiveis.includes(c))
  ?? disponiveis.find((c) => c !== proibido) ?? disponiveis[0] ?? null;

/** A posição que a equipe ocupa agora: o padrão do filtro de uma alça só. */
function levarPosicaoAoClube() {
  const tabela = colunaDaRodada(estado.grade, estado.grade?.rodadas ?? 0);
  const onde = tabela?.find((c) => c.equipe === estado.equipeA);
  if (!onde) return;
  estado.posicao = onde.posicao;
  trilhaUma?.definir({ meta: onde.posicao });
}

function trocarModo(modo) {
  estado.modo = MODOS[modo] ? modo : "equipe-equipe";
  pintarChaves("modo", estado.modo);

  const [ladoA, ladoB] = MODOS[estado.modo].lados;
  el("bloco-equipes").hidden = ladoA !== "equipe";
  el("bloco-equipe-a").hidden = ladoA !== "equipe";
  el("bloco-equipe-b").hidden = estado.modo !== "equipe-equipe";
  el("bloco-posicao-uma").hidden = estado.modo !== "equipe-posicao";
  el("bloco-posicao-duas").hidden = estado.modo !== "posicao-posicao";
  el("rotulo-equipe-a").textContent = ladoB === "posicao" ? "Equipe" : "Primeira equipe";

  aplicar();
}

/* --------------------------------------------------------------- desenho */
function aplicar() {
  Object.assign(estado, ladosDoModo());
  resumir();
  atualizarUrl();
  redesenhar();
}

/**
 * Os dois lados, na ordem em que o card vai lê-los.
 *
 * O primeiro lado é o que define o sinal: diferença positiva quer dizer que
 * ele está à frente. Entre duas posições, a melhor vem primeiro — assim a
 * leitura é sempre "quanto o 4º abriu sobre o 17º", e não o contrário.
 */
function ladosDoModo() {
  const equipe = (nome) => ({ tipo: "equipe", equipe: nome });
  const posicao = (p) => ({ tipo: "posicao", posicao: p });

  if (estado.modo === "equipe-equipe") {
    return { a: equipe(estado.equipeA), b: equipe(estado.equipeB) };
  }
  if (estado.modo === "equipe-posicao") {
    return { a: equipe(estado.equipeA), b: posicao(estado.posicao) };
  }
  return { a: posicao(estado.faixa.melhor), b: posicao(estado.faixa.pior) };
}

/** O que está sendo comparado, em uma linha, fora do card. */
function resumir() {
  const nome = (lado) => lado.tipo === "equipe"
    ? nomeBonito(lado.equipe) : `${lado.posicao}º colocado`;
  const mesmoLado = compararConsigo();
  if (mesmoLado) definirMensagemSemCard("escolha duas equipes diferentes");

  el("resumo").textContent = mesmoLado
    ? "escolha duas equipes diferentes"
    : `${nome(estado.a)} × ${nome(estado.b)} · Série ${estado.serie} `
      + `${estado.edicao?.ano ?? ""}`;

  el("rodape-edicao").textContent = estado.edicao
    ? `${estado.edicao.realizados} de ${estado.edicao.jogos} jogos disputados · `
      + `${estado.grade?.rodadas ?? 0} rodadas na grade`
    : "";
}

/** Equipe contra ela mesma: filtro válido de preencher, card que não existe. */
const compararConsigo = () => estado.modo === "equipe-equipe"
  && estado.equipeA === estado.equipeB;

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  const inteiro = (chave) => {
    const v = Number(p.get(chave));
    return p.get(chave) !== null && Number.isInteger(v) && v > 0 ? v : null;
  };
  return {
    serie: p.get("serie"), ano: p.get("ano"), modo: p.get("modo"),
    a: p.get("a"), b: p.get("b"),
    posicao: inteiro("posicao"), melhor: inteiro("melhor"), pior: inteiro("pior"),
  };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.edicao) p.set("ano", estado.edicao.apelido);
  p.set("modo", estado.modo);
  if (estado.equipeA) p.set("a", estado.equipeA);
  if (estado.equipeB) p.set("b", estado.equipeB);
  p.set("posicao", estado.posicao);
  p.set("melhor", estado.faixa.melhor);
  p.set("pior", estado.faixa.pior);
  history.replaceState(null, "", `#${p}`);
}
