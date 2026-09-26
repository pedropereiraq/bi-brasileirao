/**
 * Página do card de posição final por pontos.
 *
 * Fora do card, só a série: a tela é sobre o que a série inteira já produziu,
 * e é do acúmulo de edições que a mancha ganha sentido. Não há filtro de
 * edição nem de equipe — nenhum dos dois mudaria a pergunta.
 */
import { aoMudarTapetao, tapetaoLigado } from "/js/tapetao.js";
import { lembrarSerie, serieLembrada } from "/js/preferencias.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_desfechos.js";
import { campanhasEncerradas } from "/js/desfechos.js";

const estado = {
  posicoes: null, serie: null, semTapetao: false,
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

  const url = daUrl();

  montarChaves("serie",
    Object.keys(estado.posicoes.series ?? {}).sort().map((s) => [s, `Série ${s}`]),
    (valor) => trocarSerie(valor));

  trocarSerie(url.serie ?? serieLembrada() ?? "A");
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

function pintarChaves(id, escolhido) {
  for (const botao of el(id).children) {
    botao.setAttribute("aria-pressed", String(botao.dataset.valor === escolhido));
  }
}

function trocarSerie(serie) {
  estado.serie = serie;
  lembrarSerie(serie);
  aplicar();
}

function aplicar() {
  estado.semTapetao = !tapetaoLigado();
  pintarChaves("serie", estado.serie);

  const campanhas = campanhasEncerradas(estado.posicoes,
    { serie: estado.serie, semTapetao: estado.semTapetao });
  const anos = [...new Set(campanhas.map((c) => c.ano))];
  el("rodape-edicao").textContent = anos.length
    ? `Série ${estado.serie} · ${anos.length} edições encerradas, de `
      + `${Math.min(...anos)} a ${Math.max(...anos)}`
    : "";

  atualizarUrl();
  redesenhar();
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  return { serie: p.get("serie") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  history.replaceState(null, "", `#${p}`);
}
