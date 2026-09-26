/**
 * Página do card de pontuação final por posição.
 *
 * Fora do card, só as séries: a tela é sobre o que já se produziu ao longo das
 * edições, e é do acúmulo delas que a mancha ganha sentido. Não há filtro de
 * edição nem de equipe — nenhum dos dois mudaria a pergunta.
 *
 * As séries se marcam juntas. A B é o mesmo torneio de 38 rodadas, e somar as
 * duas dobra a amostra de cada posição; quem quiser uma só, desmarca a outra.
 * Pelo menos uma fica sempre marcada: sem série nenhuma não há card.
 */
import { aoMudarTapetao, tapetaoLigado } from "/js/tapetao.js";
import { lembrarSerie, serieLembrada } from "/js/preferencias.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_desfechos.js";
import { campanhasEncerradas } from "/js/desfechos.js";

const estado = {
  posicoes: null, series: ["A"], semTapetao: false,
};

const el = (id) => document.getElementById(id);
let redesenhar = () => {};

// Virar a chave do tapetão troca os desfechos: a tela inteira se redesenha.
aoMudarTapetao(() => aplicar());

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("esta série ainda não tem edições encerradas");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  estado.posicoes = await fetch("/dados/posicoes.json").then((r) => r.json());

  const disponiveis = Object.keys(estado.posicoes.series ?? {}).sort();
  montarChaves("serie", disponiveis.map((s) => [s, `Série ${s}`]),
               (valor) => alternarSerie(valor));

  const pedidas = (daUrl().series ?? "").split(",")
    .filter((s) => disponiveis.includes(s));
  estado.series = pedidas.length
    ? pedidas
    : [disponiveis.includes(serieLembrada()) ? serieLembrada() : disponiveis[0]];
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

function pintarChaves(id, marcadas) {
  for (const botao of el(id).children) {
    botao.setAttribute("aria-pressed",
                       String(marcadas.includes(botao.dataset.valor)));
  }
}

/** Desmarcar a última marcada não faz nada: sem série nenhuma não há card. */
function alternarSerie(serie) {
  const marcada = estado.series.includes(serie);
  if (marcada && estado.series.length === 1) return;
  estado.series = marcada
    ? estado.series.filter((s) => s !== serie)
    : [...estado.series, serie].sort();
  if (estado.series.length === 1) lembrarSerie(estado.series[0]);
  aplicar();
}

function aplicar() {
  estado.semTapetao = !tapetaoLigado();
  pintarChaves("serie", estado.series);

  const campanhas = campanhasEncerradas(estado.posicoes,
    { serie: estado.series, semTapetao: estado.semTapetao });
  const anos = [...new Set(campanhas.map((c) => c.ano))];
  const nome = estado.series.length === 1
    ? `Série ${estado.series[0]}`
    : `Séries ${estado.series.join(" e ")}`;
  el("rodape-edicao").textContent = anos.length
    ? `${nome} · ${new Set(campanhas.map((c) => `${c.serie}${c.ano}`)).size} `
      + `edições encerradas, de ${Math.min(...anos)} a ${Math.max(...anos)}`
    : "";

  atualizarUrl();
  redesenhar();
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  return { series: p.get("series") ?? p.get("serie") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  p.set("series", estado.series.join(","));
  history.replaceState(null, "", `#${p}`);
}
