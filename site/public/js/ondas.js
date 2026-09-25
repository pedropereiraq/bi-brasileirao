/**
 * Página do card de distribuição de pontos ao longo da edição.
 *
 * Fora do card só a série e a edição: a tela é sobre um campeonato inteiro, e
 * não sobre um recorte dele. A grade já mostra as 38 rodadas de uma vez.
 *
 * A conversão dos jogos para partidas fica aqui, para o módulo do fluxo viver
 * sem `import` e ser carregado pelos testes no Node.
 */
import {
  RODADA, DATA, MANDANTE, VISITANTE, GOLS_M, GOLS_V, STATUS,
} from "/js/motor.js";
import { aoMudarTapetao, tapetaoLigado } from "/js/tapetao.js";
import {
  lembrarSerie, serieLembrada,
} from "/js/preferencias.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_ondas.js";

const estado = {
  edicoes: [], posicoes: null,
  serie: null, edicao: null, partidas: [],
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
  definirMensagemSemCard("esta edição ainda não tem com que se comparar");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [edicoes, posicoes] = await Promise.all([
    fetch("/dados/edicoes.json").then((r) => r.json()),
    fetch("/dados/posicoes.json").then((r) => r.json()),
  ]);
  Object.assign(estado, { edicoes: edicoes.edicoes, posicoes });

  montarChaves("serie",
    [...new Set(estado.edicoes.map((e) => e.serie))].sort()
      .map((s) => ({ valor: s, rotulo: `Série ${s}` })),
    (valor) => trocarSerie(valor));

  el("ano").addEventListener("change", () => trocarAno(el("ano").value));

  const url = daUrl();
  await trocarSerie(url.serie ?? serieLembrada() ?? "A", url);
}

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
  lembrarSerie(estado.serie);
  pintarChaves("serie", serie);

  const anos = estado.edicoes.filter((e) => e.serie === serie);
  el("ano").innerHTML = anos
    .map((e) => `<option value="${e.apelido}">${e.ano}</option>`).join("");

  const desejado = url.ano ?? estado.edicao?.apelido;
  const escolhido = anos.some((e) => e.apelido === desejado)
    ? desejado : anos[0].apelido;
  await trocarAno(escolhido);
}

const converter = (jogos) => jogos.map((j) => {
  const feito = j[STATUS] === "realizado"
    && j[GOLS_M] !== null && j[GOLS_V] !== null;
  return {
    rodada: j[RODADA],
    data: j[DATA],
    mandante: j[MANDANTE],
    visitante: j[VISITANTE],
    realizado: feito,
    gp: feito ? j[GOLS_M] : null,
    gc: feito ? j[GOLS_V] : null,
  };
});

async function trocarAno(apelido) {
  const edicao = estado.edicoes.find((e) => e.apelido === apelido);
  if (!edicao) return;
  el("ano").value = apelido;

  const jogos = await fetch(`/dados/jogos/${apelido}.json`).then((r) => r.json());
  Object.assign(estado, { edicao, partidas: converter(jogos) });
  aplicar();
}

function aplicar() {
  const { edicao } = estado;
  el("rodape-edicao").textContent = edicao
    ? `Série ${estado.serie} ${edicao.ano} · ${edicao.realizados} de `
      + `${edicao.jogos} jogos disputados`
    : "";
  atualizarUrl();
  redesenhar();
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  return { serie: p.get("serie"), ano: p.get("ano") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.edicao) p.set("ano", estado.edicao.apelido);
  history.replaceState(null, "", `#${p}`);
}
