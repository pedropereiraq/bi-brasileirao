/**
 * Página do card de gols.
 *
 * Fora do card: a visão — gols pró, gols contra ou os dois —, a medida, a
 * série, a edição, a ordem do ranking e, opcional, um clube em destaque.
 *
 * A visão é o filtro principal porque ela troca a pergunta, e não o recorte:
 * "quem faz gol" e "quem sofre gol" são duas leituras da mesma edição, e cada
 * uma tem a sua ordem natural. Por isso trocar de visão reposiciona o critério
 * do ranking — nos gols pró, classificar por pontos seria voltar à tabela.
 *
 * A tabela sai do motor, com o tapetão valendo, porque o ranking mostra
 * posição e pontos ao lado dos gols. A punição não muda gol nenhum: ela só
 * pode mudar em que linha o clube aparece.
 */
import { clubesDaEdicao, tabela } from "/js/motor.js";
import { aoMudarTapetao, descontosDe } from "/js/tapetao.js";
import {
  equipeLembrada, lembrarEquipe, lembrarSerie, serieLembrada,
} from "/js/preferencias.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_gols.js";
import { VISOES } from "/js/gols.js";
import { nomeComUf } from "/js/nomes.js";

const CRITERIOS = {
  ambos: [
    { valor: "pontos", rotulo: "Pontos" },
    { valor: "pro", rotulo: "Gols pró" },
    { valor: "contra", rotulo: "Gols contra" },
  ],
  pro: [
    { valor: "pro", rotulo: "Gols" },
    { valor: "pontos", rotulo: "Pontos" },
  ],
  contra: [
    { valor: "contra", rotulo: "Gols" },
    { valor: "pontos", rotulo: "Pontos" },
  ],
};

const estado = {
  edicoes: [], clubes: {},
  serie: null, edicao: null, jogos: null, tabela: [],
  visao: "ambos", medida: "total", criterio: "pontos", destaque: "",
  // Clicar num clube do ranking acende o escudo dele no gráfico.
  aoEscolher: (equipe) => escolherDestaque(equipe),
};

// Os descontos de tapetão da edição em foco, vazios quando a chave está
// desligada. É o mesmo ajudante em todas as páginas que montam tabela.
const descontos = () =>
  descontosDe(estado.serie, estado.edicao?.ano ?? estado.ano);

const el = (id) => document.getElementById(id);
let redesenhar = () => {};

// Virar a chave do tapetão muda a tabela: a página inteira se redesenha.
aoMudarTapetao(() => recalcular());

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
  if (VISOES[url.visao]) estado.visao = url.visao;
  if (url.medida === "media" || url.medida === "total") estado.medida = url.medida;
  estado.criterio = VISOES[estado.visao].criterioPadrao;

  montarChaves("visao", [
    { valor: "pro", rotulo: "Gols pró" },
    { valor: "contra", rotulo: "Gols contra" },
    { valor: "ambos", rotulo: "Ambos" },
  ], (valor) => trocarVisao(valor));

  montarChaves("medida", [
    { valor: "total", rotulo: "Total de gols" },
    { valor: "media", rotulo: "Gols por jogo" },
  ], (valor) => {
    estado.medida = valor;
    pintarChaves("medida", valor);
    aplicar();
  });

  montarChaves("serie",
    [...new Set(estado.edicoes.map((e) => e.serie))].sort()
      .map((s) => ({ valor: s, rotulo: `Série ${s}` })),
    (valor) => trocarSerie(valor));

  el("ano").addEventListener("change", () => trocarAno(el("ano").value));
  el("destaque").addEventListener("change", () => {
    estado.destaque = lembrarEquipe(el("destaque").value);
    aplicar();
  });

  ligarChaves("criterio", (valor) => {
    estado.criterio = valor;
    pintarChaves("criterio", valor);
    aplicar();
  });

  pintarChaves("visao", estado.visao);
  pintarChaves("medida", estado.medida);
  montarCriterios(url.criterio);
  await trocarSerie(url.serie ?? serieLembrada() ?? "A", url);
}

function escreverChaves(id, itens) {
  el(id).innerHTML = itens
    .map((i) => `<button type="button" class="chave" data-valor="${i.valor}"
                   aria-pressed="false">${i.rotulo}</button>`).join("");
}

/**
 * O ouvinte fica na caixa, e não nos botões: o grupo de critérios é reescrito
 * a cada troca de visão, e ligar de novo empilharia um ouvinte por troca.
 */
function ligarChaves(id, aoEscolher) {
  el(id).addEventListener("click", (evento) => {
    const botao = evento.target.closest(".chave");
    if (botao) aoEscolher(botao.dataset.valor);
  });
}

function montarChaves(id, itens, aoEscolher) {
  escreverChaves(id, itens);
  ligarChaves(id, aoEscolher);
}

function pintarChaves(id, escolhido) {
  for (const botao of el(id).children) {
    botao.setAttribute("aria-pressed", String(botao.dataset.valor === escolhido));
  }
}

/**
 * Os critérios que a visão oferece.
 *
 * Nas visões de um lado só, "gols" é o próprio assunto da tela e vem primeiro;
 * em ambos, a ordem natural é a da tabela, e os gols são a alternativa.
 */
function montarCriterios(desejado) {
  const opcoes = CRITERIOS[estado.visao];
  escreverChaves("criterio", opcoes);
  const querido = opcoes.some((o) => o.valor === desejado)
    ? desejado : VISOES[estado.visao].criterioPadrao;
  estado.criterio = querido;
  pintarChaves("criterio", querido);
}

function trocarVisao(visao) {
  if (!VISOES[visao]) return;
  estado.visao = visao;
  pintarChaves("visao", visao);
  montarCriterios();
  aplicar();
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
  await trocarAno(escolhido, url);
}

async function trocarAno(apelido, url = {}) {
  const edicao = estado.edicoes.find((e) => e.apelido === apelido);
  if (!edicao) return;
  el("ano").value = apelido;

  const jogos = await fetch(`/dados/jogos/${apelido}.json`).then((r) => r.json());
  const clubes = clubesDaEdicao(jogos);
  Object.assign(estado, { edicao, jogos });
  estado.tabela = tabela(jogos, clubes, {}, descontos());

  // O destaque é por clube, e um clube não joga toda edição: some quando a
  // troca de ano o deixa de fora, em vez de destacar ninguém em silêncio.
  el("destaque").innerHTML = '<option value="">nenhuma</option>'
    + clubes.map((c) => `<option value="${c}">${nomeComUf(c)}</option>`).join("");
  const querido = url.destaque ?? estado.destaque ?? equipeLembrada();
  estado.destaque = clubes.includes(querido) ? querido : "";
  el("destaque").value = estado.destaque;

  aplicar();
}

/** A tabela muda quando a chave do tapetão vira; os gols, nunca. */
function recalcular() {
  if (estado.jogos) {
    estado.tabela = tabela(estado.jogos, clubesDaEdicao(estado.jogos), {},
                           descontos());
  }
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
    serie: p.get("serie"), ano: p.get("ano"), visao: p.get("visao"),
    medida: p.get("medida"), criterio: p.get("criterio"),
    destaque: p.get("destaque"),
  };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.edicao) p.set("ano", estado.edicao.apelido);
  p.set("visao", estado.visao);
  p.set("medida", estado.medida);
  p.set("criterio", estado.criterio);
  if (estado.destaque) p.set("destaque", estado.destaque);
  history.replaceState(null, "", `#${p}`);
}
