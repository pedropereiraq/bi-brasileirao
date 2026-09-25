/**
 * Página do card de próximos jogos.
 *
 * Fora do card: a série e uma faixa de posições. Só isso — a tela é sobre a
 * edição em andamento, porque é a única que tem "próximos jogos", e a faixa
 * escolhe os concorrentes diretos cujo calendário se quer comparar.
 */
import { clubesDaEdicao, tabela } from "/js/motor.js";
import {
  aoMudarTapetao, descontosDe,
} from "/js/tapetao.js";
import {
  lembrarSerie, serieLembrada,
} from "/js/preferencias.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_proximos.js";
import { ligarSeletorDePosicoes } from "/js/seletor_posicoes.js";
import { nomeComUf } from "/js/nomes.js";

// Da liderança ao 6º: a briga pela Libertadores, que é a comparação de
// calendário que mais se faz na reta final.
const PADRAO = { melhor: 1, pior: 6 };

const estado = {
  edicoes: [], clubes: {},
  serie: null, edicao: null, jogos: null, classificacao: [],
  faixa: { ...PADRAO },
};

// Os descontos de tapetão da edição em foco, vazios quando a chave está
// desligada. É o mesmo ajudante em todas as páginas que montam tabela.
const descontos = () =>
  descontosDe(estado.serie, estado.edicao?.ano ?? estado.ano);

const el = (id) => document.getElementById(id);
let redesenhar = () => {};

// Virar a chave do tapetão muda a tabela: a página inteira se redesenha.
aoMudarTapetao(() => aplicar());

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("nenhum clube nesta faixa");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [edicoes, clubes] = await Promise.all([
    fetch("/dados/edicoes.json").then((r) => r.json()),
    fetch("/dados/clubes.json").then((r) => r.json()),
  ]);
  Object.assign(estado, { edicoes: edicoes.edicoes, clubes });

  const url = daUrl();
  estado.faixa = {
    melhor: url.melhor ?? PADRAO.melhor,
    pior: url.pior ?? PADRAO.pior,
  };

  montarChavesDeSerie([...new Set(estado.edicoes.map((e) => e.serie))].sort());

  ligarSeletorDePosicoes({
    raiz: el("posicoes"),
    pior: estado.faixa.pior,
    melhor: estado.faixa.melhor,
    aoMudar: ({ pior, melhor }) => { estado.faixa = { pior, melhor }; aplicar(); },
  });

  await trocarSerie(url.serie ?? serieLembrada() ?? "A");
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

async function trocarSerie(serie) {
  estado.serie = serie;
  lembrarSerie(estado.serie);
  for (const botao of el("serie").children) {
    botao.setAttribute("aria-pressed", String(botao.dataset.serie === serie));
  }

  // A edição é sempre a corrente: numa encerrada não sobrou próximo jogo.
  const edicao = estado.edicoes.find((e) => e.serie === serie && !e.encerrada)
    ?? estado.edicoes.find((e) => e.serie === serie);
  estado.edicao = edicao;

  const jogos = await fetch(`/dados/jogos/${edicao.apelido}.json`)
    .then((r) => r.json());
  estado.jogos = jogos;
  estado.classificacao = tabela(jogos, clubesDaEdicao(jogos), {}, descontos());

  el("rodape-edicao").textContent =
    `Série ${serie} ${edicao.ano} · ${edicao.realizados} de ${edicao.jogos} `
    + `jogos disputados`;
  aplicar();
}

function aplicar() {
  resumirFaixa();
  atualizarUrl();
  redesenhar();
}

/** Quem está na faixa agora, fora do card, para o filtro ter consequência. */
function resumirFaixa() {
  const alvo = el("resumo-faixa");
  if (!alvo) return;
  const dentro = estado.classificacao
    .filter((c) => c.pos >= estado.faixa.melhor && c.pos <= estado.faixa.pior);
  alvo.innerHTML = dentro.length
    ? dentro.map((c) => `<b>${c.pos}º</b> ${nomeComUf(c.equipe)}`).join(" · ")
    : "ninguém nesta faixa";
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  const inteiro = (chave) => {
    const v = Number(p.get(chave));
    return p.get(chave) !== null && Number.isInteger(v) && v > 0 ? v : null;
  };
  return { serie: p.get("serie"), melhor: inteiro("melhor"), pior: inteiro("pior") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  p.set("melhor", estado.faixa.melhor);
  p.set("pior", estado.faixa.pior);
  history.replaceState(null, "", `#${p}`);
}
