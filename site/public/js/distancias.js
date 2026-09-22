/**
 * Página do card de distância entre duas posições.
 *
 * Fora do card: a série, a rodada, o range de posições e o alinhamento do
 * gráfico. O alinhamento é filtro de leitura, não de dado — muda a pergunta
 * que o mesmo gráfico responde —, e por isso fica junto dos outros, e não
 * escondido dentro do card.
 *
 * A rodada começa na do campeonato em andamento: a pergunta do dia é como
 * esta edição se compara às outras, e não como era a de 2006.
 */
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_distancias.js";
import { ligarSeletorDePosicoes } from "/js/seletor_posicoes.js";
import { rodadaCorrente, rodadaMaxima } from "/js/media_posicao.js";

// As duas fronteiras que o campeonato inteiro persegue: a última vaga na
// Libertadores e a primeira cadeira do rebaixamento.
const PADRAO = { melhor: 4, pior: 17 };
const ALINHAMENTOS = ["pontuacao", "topo", "base", "centro"];
// O eixo central é o que responde primeiro à pergunta da tela: quanto
// separa as duas posições. A escala de pontos responde a seguinte — em
// que patamar da tabela isso aconteceu —, e fica a um clique.
const PADRAO_ALINHAMENTO = "centro";

const estado = {
  posicoes: null,
  serie: null, rodada: null, faixa: { ...PADRAO }, alinhamento: PADRAO_ALINHAMENTO,
};

const el = (id) => document.getElementById(id);
let redesenhar = () => {};

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("escolha duas posições diferentes nesta rodada");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  estado.posicoes = await fetch("/dados/posicoes.json").then((r) => r.json());

  const url = daUrl();
  estado.faixa = {
    melhor: url.melhor ?? PADRAO.melhor,
    pior: url.pior ?? PADRAO.pior,
  };
  estado.alinhamento = ALINHAMENTOS.includes(url.alinhamento)
    ? url.alinhamento : PADRAO_ALINHAMENTO;

  montarChavesDeSerie(Object.keys(estado.posicoes.series ?? {}).sort());

  el("alinhamento").addEventListener("click", (evento) => {
    const botao = evento.target.closest(".chave");
    if (!botao) return;
    estado.alinhamento = botao.dataset.valor;
    aplicar();
  });

  el("rodada").addEventListener("input", () => {
    estado.rodada = Number(el("rodada").value);
    aplicar();
  });

  ligarSeletorDePosicoes({
    raiz: el("posicoes"),
    pior: estado.faixa.pior,
    melhor: estado.faixa.melhor,
    aoMudar: ({ pior, melhor }) => { estado.faixa = { pior, melhor }; aplicar(); },
  });

  trocarSerie(url.serie ?? "A", url);
}

function montarChavesDeSerie(series) {
  const caixa = el("serie");
  caixa.innerHTML = series
    .map((s) => `<button type="button" class="chave" data-serie="${s}"
                   aria-pressed="false">Série ${s}</button>`).join("");
  caixa.addEventListener("click", (evento) => {
    const botao = evento.target.closest(".chave");
    if (botao) trocarSerie(botao.dataset.serie);
  });
}

function trocarSerie(serie, url = {}) {
  estado.serie = serie;
  for (const botao of el("serie").children) {
    botao.setAttribute("aria-pressed", String(botao.dataset.serie === serie));
  }

  const maxima = rodadaMaxima(estado.posicoes, { serie });
  el("rodada").max = maxima;
  const corrente = rodadaCorrente(estado.posicoes, { serie });
  estado.rodada = Math.min(url.rodada ?? corrente, maxima);
  el("rodada").value = estado.rodada;
  aplicar();
}

function aplicar() {
  el("valor-rodada").textContent = estado.rodada;
  for (const botao of el("alinhamento").children) {
    botao.setAttribute("aria-pressed",
      String(botao.dataset.valor === estado.alinhamento));
  }
  atualizarUrl();
  redesenhar();
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  const inteiro = (chave) => {
    const v = Number(p.get(chave));
    return p.get(chave) !== null && Number.isInteger(v) && v > 0 ? v : null;
  };
  return { serie: p.get("serie"), rodada: inteiro("rodada"),
           melhor: inteiro("melhor"), pior: inteiro("pior"),
           alinhamento: p.get("alinhamento") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  p.set("rodada", estado.rodada);
  p.set("melhor", estado.faixa.melhor);
  p.set("pior", estado.faixa.pior);
  p.set("alinhamento", estado.alinhamento);
  history.replaceState(null, "", `#${p}`);
}
