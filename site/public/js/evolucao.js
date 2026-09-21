/**
 * Página do card de evolução da pontuação.
 *
 * Fora do card: a série, o ano, a equipe e a trilha de posições. A trilha não
 * escolhe clubes — escolhe dois objetivos, e é o que separa esta tela do
 * comparativo de campanhas.
 */
import { clubesDaEdicao, tabela } from "/js/motor.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_evolucao.js";
import { ligarSeletorDePosicoes } from "/js/seletor_posicoes.js";
import { nomeComUf } from "/js/nomes.js";

const PADRAO = { pior: 17, melhor: 4 };

const estado = {
  edicoes: [], clubes: {}, referencias: {},
  serie: null, apelido: null, edicao: null, jogos: null, clube: null,
  referencia: null, ...PADRAO,
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

  const [edicoes, clubes, referencias] = await Promise.all([
    fetch("/dados/edicoes.json").then((r) => r.json()),
    fetch("/dados/clubes.json").then((r) => r.json()),
    fetch("/dados/referencias.json").then((r) => r.json()),
  ]);
  estado.edicoes = edicoes.edicoes;
  estado.clubes = clubes;
  estado.referencias = referencias;

  const url = daUrl();
  Object.assign(estado, {
    pior: url.pior ?? PADRAO.pior,
    melhor: url.melhor ?? PADRAO.melhor,
  });

  const series = [...new Set(estado.edicoes.map((e) => e.serie))].sort();
  el("serie").innerHTML = series
    .map((s) => `<option value="${s}">Série ${s}</option>`).join("");
  el("serie").addEventListener("change", () => trocarSerie(el("serie").value));
  el("ano").addEventListener("change", () => trocarAno(el("ano").value));
  el("equipe").addEventListener("change", () => {
    estado.clube = el("equipe").value;
    aplicar();
  });

  trilha = ligarSeletorDePosicoes({
    raiz: el("posicoes"),
    pior: estado.pior,
    melhor: estado.melhor,
    aoMudar: ({ pior, melhor }) => {
      Object.assign(estado, { pior, melhor });
      aplicar();
    },
  });

  await trocarSerie(url.serie ?? series[0], url);
}

const anosDaSerie = (serie) => estado.edicoes.filter((e) => e.serie === serie);

async function trocarSerie(serie, url = {}) {
  estado.serie = serie;
  estado.referencia = estado.referencias[serie] ?? null;
  el("serie").value = serie;

  if (!estado.referencia) {
    definirMensagemSemCard(
      `a Série ${serie} ainda não tem edição encerrada — sem ela não há régua`);
  } else {
    definirMensagemSemCard("escolha uma equipe para desenhar o card");
    const total = Object.keys(estado.referencia.media).length;
    // Séries com número de clubes diferente mudariam o alcance da trilha.
    trilha.definir({
      melhor: Math.min(estado.melhor, total - 1),
      pior: Math.min(estado.pior, total),
    });
    Object.assign(estado, trilha.valores());
  }

  const anos = anosDaSerie(serie);
  el("ano").innerHTML = anos
    .map((e) => `<option value="${e.apelido}">${e.ano}</option>`).join("");

  const desejado = url.ano ?? estado.apelido;
  const escolhido = anos.some((e) => e.apelido === desejado)
    ? desejado : anos[0].apelido;
  await trocarAno(escolhido, url.equipe, { silencioso: true });
  aplicar();
}

async function trocarAno(apelido, clubeDesejado, { silencioso = false } = {}) {
  const edicao = estado.edicoes.find((e) => e.apelido === apelido);
  if (!edicao) return;

  el("ano").value = apelido;
  const jogos = await fetch(`/dados/jogos/${apelido}.json`).then((r) => r.json());
  const clubes = clubesDaEdicao(jogos);

  el("equipe").innerHTML = clubes
    .map((c) => `<option value="${c}">${nomeComUf(c)}</option>`).join("");

  // Mantém o clube quando ele jogou naquele ano; senão propõe o líder, que é a
  // campanha que alguém abriria primeiro.
  const atual = clubeDesejado ?? estado.clube;
  const escolhido = clubes.includes(atual)
    ? atual : tabela(jogos, clubes, {})[0]?.equipe ?? clubes[0];

  Object.assign(estado, { apelido, edicao, jogos, clube: escolhido });
  el("equipe").value = escolhido;

  if (!silencioso) aplicar();
}

function aplicar() {
  atualizarUrl();
  redesenhar();
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  const inteiro = (chave) => {
    const v = Number(p.get(chave));
    return Number.isInteger(v) && v > 0 ? v : null;
  };
  return { serie: p.get("serie"), ano: p.get("ano"), equipe: p.get("equipe"),
           pior: inteiro("pior"), melhor: inteiro("melhor") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.apelido) p.set("ano", estado.apelido);
  if (estado.clube) p.set("equipe", estado.clube);
  p.set("melhor", estado.melhor);
  p.set("pior", estado.pior);
  history.replaceState(null, "", `#${p}`);
}
