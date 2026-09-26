/**
 * Página do card de jogos para alcançar X.
 *
 * Fora do card: a divisão, a equipe, o que se procura e a marca. Não há filtro
 * de edição — o card cruza todas de uma vez, que é o ponto da tela.
 *
 * A marca nasce na mediana dos totais do clube naquela métrica: metade das
 * edições chega, metade não, e é daí que se começa a mexer. Trocar de métrica
 * refaz a régua, porque 45 pontos e 45 empates não são a mesma pergunta.
 */
import {
  equipeLembrada, lembrarEquipe, lembrarSerie, serieLembrada,
} from "/js/preferencias.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_alcancar.js";
import { ligarTrilha } from "/js/seletor_posicoes.js";
import {
  METRICAS, alvoPadrao, maiorTotal, marcosDoClube,
} from "/js/alcancar.js";
import { marcaAtual, aoMudarMarca } from "/js/marca.js";
import { nomeBonito, nomeComUf } from "/js/nomes.js";

const estado = {
  clubes: {}, campanhas: null,
  serie: null, equipe: null, metrica: "pontos", alvo: null, ordem: "jogos",
};

const el = (id) => document.getElementById(id);
let redesenhar = () => {};
let trilha = null;

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("escolha uma equipe para desenhar o card");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [clubes, campanhas] = await Promise.all([
    fetch("/dados/clubes.json").then((r) => r.json()),
    fetch("/dados/campanhas_detalhe.json").then((r) => r.json()),
  ]);
  Object.assign(estado, { clubes, campanhas });

  const url = daUrl();
  if (METRICAS[url.metrica]) estado.metrica = url.metrica;
  if (url.ordem === "edicao" || url.ordem === "jogos") estado.ordem = url.ordem;

  montarChaves("serie", Object.keys(campanhas.series ?? {}).sort()
    .map((s) => ({ valor: s, rotulo: `Série ${s}` })),
    (valor) => trocarSerie(valor));

  escreverMetricas();
  ligarChaves("metrica", (valor) => {
    estado.metrica = valor;
    pintarChaves("metrica", valor);
    // A régua muda de tamanho e de sentido: o alvo volta ao padrão da nova
    // métrica em vez de carregar um número que era de outra conta.
    montarTrilha();
    aplicar();
  });

  montarChaves("ordem", [
    { valor: "jogos", rotulo: "Jogos até a marca" },
    { valor: "edicao", rotulo: "Edição" },
  ], (valor) => {
    estado.ordem = valor;
    pintarChaves("ordem", valor);
    aplicar();
  });

  el("equipe").addEventListener("change", () => trocarEquipe(el("equipe").value));

  // "Triunfos" ou "vitórias" é escolha da marca: o rótulo se refaz junto.
  aoMudarMarca(() => {
    escreverMetricas();
    pintarChaves("metrica", estado.metrica);
  });

  pintarChaves("ordem", estado.ordem);
  trocarSerie(url.serie ?? serieLembrada() ?? "A", url);
}

/* -------------------------------------------------------------- chaves */
function escreverChaves(id, itens) {
  el(id).innerHTML = itens
    .map((i) => `<button type="button" class="chave" data-valor="${i.valor}"
                   aria-pressed="false">${i.rotulo}</button>`).join("");
}

/** O ouvinte fica na caixa, e não nos botões: eles são reescritos. */
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

function escreverMetricas() {
  const triunfos = marcaAtual().triunfos;
  escreverChaves("metrica", [
    { valor: "pontos", rotulo: "Pontos" },
    { valor: "vitorias", rotulo: triunfos.replace(/^./, (c) => c.toUpperCase()) },
    { valor: "empates", rotulo: "Empates" },
    { valor: "derrotas", rotulo: "Derrotas" },
    { valor: "golsPro", rotulo: "Gols pró" },
    { valor: "golsContra", rotulo: "Gols contra" },
  ]);
  pintarChaves("metrica", estado.metrica);
}

/* ----------------------------------------------------------- filtragem */
function trocarSerie(serie, url = {}) {
  estado.serie = serie;
  lembrarSerie(serie);
  pintarChaves("serie", serie);

  // Todo clube que já apareceu na série, e não só os da edição corrente: a
  // tela cruza as edições todas, e quem subiu em 2010 e caiu em 2014 tem
  // marcas para mostrar.
  const nomes = new Set();
  for (const clubes of Object.values(estado.campanhas.series?.[serie] ?? {})) {
    for (const [equipe] of clubes) nomes.add(equipe);
  }
  const lista = [...nomes].sort((a, b) =>
    nomeBonito(a).localeCompare(nomeBonito(b), "pt-BR"));

  el("equipe").innerHTML = lista
    .map((e) => `<option value="${e}">${nomeComUf(e)}</option>`).join("");

  const desejada = url.equipe ?? estado.equipe ?? equipeLembrada();
  trocarEquipe(lista.includes(desejada) ? desejada : lista[0],
               { alvoDaUrl: url.alvo });
}

function trocarEquipe(equipe, { alvoDaUrl = null } = {}) {
  if (!equipe) return;
  estado.equipe = equipe;
  lembrarEquipe(equipe);
  el("equipe").value = equipe;

  const im = el("escudo-equipe");
  im.src = estado.clubes[equipe]?.escudo ?? "";
  im.alt = nomeBonito(equipe);

  montarTrilha(alvoDaUrl);
  aplicar();
}

/**
 * A régua da marca, refeita a cada troca de clube ou de métrica.
 *
 * O teto é o maior total que o clube já fez naquela conta: pedir uma marca que
 * ele nunca alcançou em edição nenhuma daria uma tela de linhas vazias.
 */
function montarTrilha(alvoDesejado = null) {
  const { campanhas, serie, equipe, metrica } = estado;
  const marcos = marcosDoClube(campanhas, { serie, equipe, metrica, alvo: 1 });
  const teto = Math.max(1, maiorTotal(marcos));
  const querido = alvoDesejado ?? alvoPadrao(marcos);
  estado.alvo = Math.min(teto, Math.max(1, querido));

  trilha = ligarTrilha({
    raiz: el("alvo"), total: teto, crescente: true,
    descrever: (v) => `${v} ${METRICAS[metrica]?.nome ?? ""}`,
    alcas: [{ nome: "alvo", classe: "alca-meta", valor: estado.alvo,
              descricao: "a marca a alcançar" }],
    aoMudar: ({ alvo }) => { estado.alvo = alvo; aplicar(); },
  });
}

function aplicar() {
  el("rotulo-alvo-valor").textContent =
    `${estado.alvo} ${METRICAS[estado.metrica]?.nome ?? ""}`;
  atualizarUrl();
  redesenhar();
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  const inteiro = (chave) => {
    const v = Number(p.get(chave));
    return p.get(chave) !== null && Number.isInteger(v) && v > 0 ? v : null;
  };
  return { serie: p.get("serie"), equipe: p.get("equipe"),
           metrica: p.get("metrica"), ordem: p.get("ordem"),
           alvo: inteiro("alvo") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.equipe) p.set("equipe", estado.equipe);
  p.set("metrica", estado.metrica);
  p.set("alvo", estado.alvo);
  p.set("ordem", estado.ordem);
  history.replaceState(null, "", `#${p}`);
}
