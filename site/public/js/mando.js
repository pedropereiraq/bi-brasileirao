/**
 * Página do card de mando de campo.
 *
 * Fora do card: a série, o ano, o critério e — opcional — um clube em
 * destaque. O destaque é o que transforma três classificações em uma leitura
 * só: sem ele o card é um panorama, com ele é a história de um time.
 *
 * As três tabelas saem do mesmo motor, com o filtro de mando mudando: geral,
 * `mando: "casa"` e `mando: "fora"`. É de propósito que a conta não seja feita
 * aqui — a classificação de casa tem de ser a mesma classificação, com os
 * mesmos critérios de desempate, só que sobre menos jogos.
 */
import { clubesDaEdicao, tabela } from "/js/motor.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_mando.js";
import { nomeComUf } from "/js/nomes.js";

const estado = {
  edicoes: [], clubes: {},
  serie: null, edicao: null, jogos: null,
  geral: [], casa: [], fora: [],
  // O aproveitamento é o que a tela compara: com números de jogos
  // diferentes em casa e fora, pontos somados não se comparam.
  criterio: "aproveitamento", destaque: "",
  // O card chama de volta quando alguém clica num clube: escolher o destaque
  // na própria lista é mais rápido do que achar a sigla no filtro.
  aoEscolher: (equipe) => escolherDestaque(equipe),
};

const el = (id) => document.getElementById(id);
let redesenhar = () => {};

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("escolha uma edição para desenhar o card");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [edicoes, clubes] = await Promise.all([
    fetch("/dados/edicoes.json").then((r) => r.json()),
    fetch("/dados/clubes.json").then((r) => r.json()),
  ]);
  Object.assign(estado, { edicoes: edicoes.edicoes, clubes });

  const url = daUrl();
  if (url.criterio) estado.criterio = url.criterio;

  montarChaves("criterio", [
    { valor: "pontos", rotulo: "Pontos" },
    { valor: "aproveitamento", rotulo: "Aproveitamento" },
  ], (valor) => {
    estado.criterio = valor;
    pintarChaves("criterio", valor);
    aplicar();
  });

  montarChaves("serie",
    [...new Set(estado.edicoes.map((e) => e.serie))].sort()
      .map((s) => ({ valor: s, rotulo: `Série ${s}` })),
    (valor) => trocarSerie(valor));

  el("ano").addEventListener("change", () => trocarAno(el("ano").value));
  el("destaque").addEventListener("change", () => {
    estado.destaque = el("destaque").value;
    aplicar();
  });

  pintarChaves("criterio", estado.criterio);
  await trocarSerie(url.serie ?? "A", url);
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

  const jogos = await fetch(`/dados/jogos/${apelido}.json`).then((r) => r.json());
  const clubes = clubesDaEdicao(jogos);
  Object.assign(estado, {
    edicao, jogos,
    geral: tabela(jogos, clubes, {}),
    casa: tabela(jogos, clubes, { mando: "casa" }),
    fora: tabela(jogos, clubes, { mando: "fora" }),
  });

  // O destaque é por clube, e um clube não joga toda edição: some quando a
  // troca de ano o deixa de fora, em vez de destacar ninguém em silêncio.
  el("destaque").innerHTML = '<option value="">nenhuma</option>'
    + clubes.map((c) => `<option value="${c}">${nomeComUf(c)}</option>`).join("");
  const querido = url.destaque ?? estado.destaque;
  estado.destaque = clubes.includes(querido) ? querido : "";
  el("destaque").value = estado.destaque;

  aplicar();
}

/** Clicar no clube que já está em destaque tira o destaque: é o mesmo gesto. */
function escolherDestaque(equipe) {
  estado.destaque = estado.destaque === equipe ? "" : equipe;
  el("destaque").value = estado.destaque;
  aplicar();
}

function aplicar() {
  resumir();
  atualizarUrl();
  redesenhar();
}

function resumir() {
  const { edicao } = estado;
  el("rodape-edicao").textContent = edicao
    ? `Série ${estado.serie} ${edicao.ano} · ${edicao.realizados} de `
      + `${edicao.jogos} jogos disputados`
    : "";
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  return {
    serie: p.get("serie"), ano: p.get("ano"),
    criterio: p.get("criterio"), destaque: p.get("destaque"),
  };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.edicao) p.set("ano", estado.edicao.apelido);
  p.set("criterio", estado.criterio);
  if (estado.destaque) p.set("destaque", estado.destaque);
  history.replaceState(null, "", `#${p}`);
}
