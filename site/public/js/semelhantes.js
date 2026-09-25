/**
 * Página do card de campanhas semelhantes.
 *
 * Fora do card: a série e a situação — jogos e pontos — que se quer
 * investigar. A classificação ao lado é sempre a da edição corrente, e serve
 * de atalho: clicar num clube leva os controles à situação dele hoje.
 *
 * Os controles de jogos e pontos são `<input type=range>` e não a trilha de
 * posições. A trilha é uma tabela deitada, com 20 posições nomeadas; aqui são
 * escalas contínuas, e o controle nativo já traz teclado, toque e leitor de
 * tela de graça.
 */
import { clubesDaEdicao, tabela } from "/js/motor.js";
import {
  aoMudarTapetao, descontosDe,
} from "/js/tapetao.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_semelhantes.js";
import { ligarSeletorDePosicoes } from "/js/seletor_posicoes.js";
import { nomeComUf } from "/js/nomes.js";

const PADRAO = { melhor: 1, pior: 4 };

const estado = {
  edicoes: [], clubes: {}, campanhas: null, referencias: {},
  serie: null, apelido: null, edicao: null, referencia: null,
  jogos: 20, pontos: 30, faixa: { ...PADRAO },
};

// Os descontos de tapetão da edição em foco, vazios quando a chave está
// desligada. É o mesmo ajudante em todas as páginas que montam tabela.
const descontos = () =>
  descontosDe(estado.serie, estado.edicao?.ano ?? estado.ano);

const el = (id) => document.getElementById(id);
let redesenhar = () => {};

// Virar a chave do tapetão muda a tabela: a página inteira se redesenha.
aoMudarTapetao(() => aplicar());
let trilha = null;

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("escolha uma situação para desenhar o card");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [edicoes, clubes, referencias, campanhas] = await Promise.all([
    fetch("/dados/edicoes.json").then((r) => r.json()),
    fetch("/dados/clubes.json").then((r) => r.json()),
    fetch("/dados/referencias.json").then((r) => r.json()),
    fetch("/dados/campanhas.json").then((r) => r.json()),
  ]);
  Object.assign(estado, {
    edicoes: edicoes.edicoes, clubes, referencias, campanhas,
  });

  const url = daUrl();
  estado.faixa = {
    melhor: url.melhor ?? PADRAO.melhor,
    pior: url.pior ?? PADRAO.pior,
  };

  montarChavesDeSerie([...new Set(estado.edicoes.map((e) => e.serie))].sort());

  el("jogos").addEventListener("input", () => {
    estado.jogos = Number(el("jogos").value);
    ajustarLimiteDePontos();
    aplicar();
  });
  el("pontos").addEventListener("input", () => {
    estado.pontos = Number(el("pontos").value);
    aplicar();
  });

  trilha = ligarSeletorDePosicoes({
    raiz: el("posicoes"),
    pior: estado.faixa.pior,
    melhor: estado.faixa.melhor,
    aoMudar: ({ pior, melhor }) => { estado.faixa = { pior, melhor }; aplicar(); },
  });

  await trocarSerie(url.serie ?? "A", url);
}

/* ------------------------------------------------------ chaves de série */
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

function pintarChaves() {
  for (const botao of el("serie").children) {
    botao.setAttribute("aria-pressed", String(botao.dataset.serie === estado.serie));
  }
}

/* ----------------------------------------------------------- filtragem */
async function trocarSerie(serie, url = {}) {
  estado.serie = serie;
  estado.referencia = estado.referencias[serie] ?? null;
  pintarChaves();

  // Sempre a edição corrente: ela só existe aqui para dar o atalho dos clubes,
  // e um seletor de ano levaria a escolher a classificação de 2014 para
  // investigar uma situação que não é de 2014.
  const anos = estado.edicoes.filter((e) => e.serie === serie);
  await carregarEdicao(anos[0].apelido);

  // A situação vem da URL quando ela traz uma; senão, do líder da edição.
  if (url.jogos && url.pontos !== null && url.pontos !== undefined) {
    estado.jogos = url.jogos;
    estado.pontos = url.pontos;
  }
  ajustarLimiteDePontos();
  aplicar();
}

async function carregarEdicao(apelido) {
  const edicao = estado.edicoes.find((e) => e.apelido === apelido);
  if (!edicao) return;
  estado.apelido = apelido;
  estado.edicao = edicao;

  const jogos = await fetch(`/dados/jogos/${apelido}.json`).then((r) => r.json());
  const classificados = tabela(jogos, clubesDaEdicao(jogos), {}, descontos());
  desenharClubes(classificados);
  el("rotulo-clubes").firstChild.textContent =
    `Classificação da Série ${estado.serie} ${edicao.ano} `;

  if (classificados.length) {
    estado.jogos = classificados[0].j || estado.jogos;
    estado.pontos = classificados[0].pts ?? estado.pontos;
  }
}

function desenharClubes(classificados) {
  // Deitada, na ordem da tabela: o escudo identifica, e pontos e jogos são a
  // situação que o clique leva para os controles. O nome sai — vinte nomes
  // lado a lado não cabem, e o escudo já diz quem é.
  el("clubes").innerHTML = classificados.map((c) => `
    <button type="button" class="clube" data-equipe="${c.equipe}"
            title="${nomeComUf(c.equipe)} · ${c.pts} pontos em ${c.j} jogos">
      <span class="clube-pos">${c.pos}</span>
      <img src="${estado.clubes[c.equipe]?.escudo ?? ""}" alt="${nomeComUf(c.equipe)}">
      <span class="clube-pts">${c.pts}</span>
      <span class="clube-situacao">${c.j} jogos</span>
    </button>`).join("");

  el("clubes").onclick = (evento) => {
    const botao = evento.target.closest(".clube");
    if (!botao) return;
    irParaClube(classificados.find((c) => c.equipe === botao.dataset.equipe));
  };
}

function irParaClube(clube) {
  if (!clube || !clube.j) return;
  estado.jogos = clube.j;
  estado.pontos = clube.pts;
  ajustarLimiteDePontos();
  aplicar();
}

/**
 * O teto de pontos depende dos jogos: 20 jogos não rendem 61 pontos. Sem isso
 * o controle deixaria escolher uma situação que não pode ter existido, e o
 * card responderia "nenhuma campanha" por um motivo errado.
 */
function ajustarLimiteDePontos() {
  const teto = estado.jogos * 3;
  el("pontos").max = teto;
  estado.pontos = Math.min(estado.pontos, teto);
  el("jogos").value = estado.jogos;
  el("pontos").value = estado.pontos;
}

function aplicar() {
  el("valor-jogos").textContent = estado.jogos;
  el("valor-pontos").textContent = estado.pontos;
  marcarClubeAtivo();
  atualizarUrl();
  redesenhar();
}

/** Destaca o clube da edição que está exatamente na situação escolhida. */
function marcarClubeAtivo() {
  for (const botao of el("clubes").children) {
    const pontos = Number(botao.querySelector(".clube-pts").textContent);
    const jogos = parseInt(botao.querySelector(".clube-situacao").textContent, 10);
    botao.classList.toggle("ativo",
      pontos === estado.pontos && jogos === estado.jogos);
  }
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  const inteiro = (chave) => {
    const v = Number(p.get(chave));
    return p.get(chave) !== null && Number.isInteger(v) ? v : null;
  };
  return { serie: p.get("serie"),
           jogos: inteiro("jogos"), pontos: inteiro("pontos"),
           melhor: inteiro("melhor"), pior: inteiro("pior") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  p.set("jogos", estado.jogos);
  p.set("pontos", estado.pontos);
  p.set("melhor", estado.faixa.melhor);
  p.set("pior", estado.faixa.pior);
  history.replaceState(null, "", `#${p}`);
  void trilha;
}
