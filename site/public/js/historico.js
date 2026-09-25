/**
 * Página de posições históricas.
 *
 * O filtro é um só — a equipe —, e o resto muda com a pergunta. Rodada a
 * rodada é sobre percurso: pede uma série, um ponto de corte e a chance de
 * descartar as primeiras rodadas. Posição final é sobre desfecho: aceita as
 * duas séries no mesmo eixo, e o ponto de corte pode morar em qualquer uma.
 *
 * Tudo sai de `posicoes.json`, varrendo a grade de cada edição atrás do clube.
 */
import { aoMudarTapetao, tapetaoLigado } from "/js/tapetao.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_historico.js";
import { POSICOES_POR_SERIE } from "/js/posicoes_historicas.js";
import { nomeComUf } from "/js/nomes.js";

const estado = {
  clubes: {}, posicoes: null,
  modo: "rodadas", equipe: "", serie: "A", series: ["A", "B"],
  alvo: 4, ignorar: 0,
  trajetorias: [], edicoes: [],
};

const el = (id) => document.getElementById(id);
let redesenhar = () => {};

// Virar a chave do tapetão muda a tabela: a página inteira se redesenha.
aoMudarTapetao(() => aplicar());

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("esta equipe não tem edições neste recorte");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [clubes, posicoes] = await Promise.all([
    fetch("/dados/clubes.json").then((r) => r.json()),
    fetch("/dados/posicoes.json").then((r) => r.json()),
  ]);
  Object.assign(estado, { clubes, posicoes });

  montarChaves("modo", [
    ["rodadas", "Rodada a rodada"], ["final", "Posição final"],
  ], trocarModo);

  montarChaves("serie", [
    ["A", "Série A"], ["B", "Série B"], ["AB", "Ambas"],
  ], escolherSerie);

  el("equipe").innerHTML = todosOsClubes()
    .map((c) => `<option value="${c}">${nomeComUf(c)}</option>`).join("");

  el("equipe").addEventListener("change", () => {
    estado.equipe = el("equipe").value;
    aplicar();
  });
  el("alvo").addEventListener("input", () => {
    estado.alvo = Number(el("alvo").value);
    aplicar();
  });
  el("ignorar").addEventListener("input", () => {
    estado.ignorar = Number(el("ignorar").value);
    aplicar();
  });

  const url = daUrl();
  if (url.modo === "final" || url.modo === "rodadas") estado.modo = url.modo;
  escolherSerie(url.serie ?? "A", { semDesenhar: true });
  const querida = url.equipe ?? "BAHIA (BA)";
  estado.equipe = todosOsClubes().includes(querida) ? querida : todosOsClubes()[0];
  el("equipe").value = estado.equipe;
  if (url.alvo) estado.alvo = url.alvo;
  if (url.ignorar !== null) estado.ignorar = url.ignorar;

  aplicar();
}

function montarChaves(id, itens, aoEscolher) {
  const caixa = el(id);
  caixa.innerHTML = itens
    .map(([valor, rotulo]) => `<button type="button" class="chave"
           data-valor="${valor}" aria-pressed="false">${rotulo}</button>`).join("");
  caixa.addEventListener("click", (evento) => {
    const botao = evento.target.closest(".chave");
    if (botao) aoEscolher(botao.dataset.valor);
  });
}

/**
 * Trocar de pergunta troca o que a série pode ser.
 *
 * "Ambas" só existe no desfecho: rodada a rodada compara posições dentro de
 * uma série, e misturar as duas ali não diria nada. A escolha de "ambas" fica
 * guardada em `series` e volta a valer quando se volta ao desfecho — o modo
 * rodada a rodada simplesmente não a enxerga, e desenha `serie`.
 */
function trocarModo(valor) {
  estado.modo = valor;
  aplicar();
}

function escolherSerie(valor, { semDesenhar = false } = {}) {
  if (valor === "AB" && estado.modo !== "final") return;
  estado.series = valor === "AB" ? ["A", "B"] : [valor];
  estado.serie = valor === "AB" ? "A" : valor;
  if (!semDesenhar) aplicar();
}

/** Todo clube que passou por alguma edição, sem repetir. */
function todosOsClubes() {
  const nomes = new Set();
  for (const anos of Object.values(estado.posicoes.series ?? {})) {
    for (const edicao of Object.values(anos)) {
      for (const clube of edicao.clubes) nomes.add(clube);
    }
  }
  return [...nomes].sort((a, b) => nomeComUf(a).localeCompare(nomeComUf(b), "pt-BR"));
}

/**
 * A posição do clube em cada rodada daquela edição.
 *
 * A grade já vem ordenada por posição, então a posição é o lugar do clube na
 * linha da rodada. Edição sem o clube devolve `null`: é ano sem participação,
 * e não ano com posição desconhecida.
 */
function trajetoria(serie, ano) {
  const edicao = estado.posicoes.series?.[serie]?.[String(ano)];
  if (!edicao) return null;
  const indice = edicao.clubes.indexOf(estado.equipe);

  if (indice < 0) {
    return { ano: Number(ano), serie, posicoes: [], encerrada: edicao.encerrada,
             final: null };
  }

  const semTapetao = !tapetaoLigado();
  const grade = semTapetao && edicao.grade_st ? edicao.grade_st : edicao.grade;
  const fim = semTapetao && edicao.fim_st ? edicao.fim_st : edicao.fim;
  const posicoes = grade.map((linha) => {
    const lugar = linha.findIndex(([i]) => i === indice);
    return lugar < 0 ? null : lugar + 1;
  });
  return {
    ano: Number(ano), serie, posicoes, encerrada: edicao.encerrada,
    final: edicao.encerrada ? (fim[indice]?.[0] ?? null)
                            : (posicoes.at(-1) ?? null),
  };
}

const anosDaSerie = (serie) =>
  Object.keys(estado.posicoes.series?.[serie] ?? {}).map(Number)
    .sort((a, b) => a - b);

function aplicar() {
  const noFinal = estado.modo === "final";
  for (const id of ["modo", "serie"]) {
    const escolhido = id === "modo" ? estado.modo
      : (noFinal && estado.series.length > 1 ? "AB" : estado.serie);
    for (const botao of el(id).children) {
      const ligado = botao.dataset.valor === escolhido;
      botao.setAttribute("aria-pressed", String(ligado));
      // "Ambas" fica fora de alcance no modo rodada a rodada.
      botao.disabled = botao.dataset.valor === "AB" && !noFinal;
    }
  }

  el("campo-ignorar").hidden = noFinal;
  const maximo = noFinal && estado.series.length > 1
    ? POSICOES_POR_SERIE * 2 : POSICOES_POR_SERIE;
  el("alvo").max = maximo;
  estado.alvo = Math.min(estado.alvo, maximo);
  el("alvo").value = estado.alvo;
  el("valor-alvo").textContent = rotuloDoAlvo();
  el("valor-ignorar").textContent = estado.ignorar;

  estado.trajetorias = noFinal ? []
    : anosDaSerie(estado.serie).map((ano) => trajetoria(estado.serie, ano))
      .filter(Boolean);

  estado.edicoes = !noFinal ? []
    : estado.series.flatMap((serie) => anosDaSerie(serie)
      .map((ano) => trajetoria(serie, ano))
      .filter((t) => t && t.final)
      .map((t) => ({ ano: t.ano, serie, posicao: t.final,
                     encerrada: t.encerrada })));

  el("rodape-edicao").textContent = noFinal
    ? `${estado.edicoes.length} edições com participação`
    : `Série ${estado.serie} · ${anosDaSerie(estado.serie).length} edições na grade`;

  atualizarUrl();
  redesenhar();
}

function rotuloDoAlvo() {
  const { alvo } = estado;
  if (estado.modo === "final" && estado.series.length > 1
      && alvo > POSICOES_POR_SERIE) {
    return `${alvo - POSICOES_POR_SERIE}º da B`;
  }
  return `${alvo}º`;
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  const inteiro = (chave) => {
    const v = Number(p.get(chave));
    return p.get(chave) !== null && Number.isInteger(v) && v >= 0 ? v : null;
  };
  return { modo: p.get("modo"), serie: p.get("serie"), equipe: p.get("equipe"),
           alvo: inteiro("alvo"), ignorar: inteiro("ignorar") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  p.set("modo", estado.modo);
  p.set("serie", estado.modo === "final" && estado.series.length > 1
    ? "AB" : estado.serie);
  if (estado.equipe) p.set("equipe", estado.equipe);
  p.set("alvo", estado.alvo);
  if (estado.modo !== "final") p.set("ignorar", estado.ignorar);
  history.replaceState(null, "", `#${p}`);
}
