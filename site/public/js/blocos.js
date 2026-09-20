/**
 * Página do card de blocos de 6 jogos.
 *
 * Fora do card: a série, o ano, a equipe e uma posição — a que vira meta. A
 * trilha é a mesma da evolução da pontuação, com uma alça só.
 */
import { clubesDaEdicao, tabela } from "/js/motor.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_blocos.js";
import { ligarSeletorDePosicao } from "/js/seletor_posicoes.js";
import { metasDaPosicao } from "/js/metas.js";
import { nomeBonito } from "/js/nomes.js";

// 17º é a primeira posição fora do rebaixamento: a meta que mais se cobra.
const PADRAO = 17;

const estado = {
  edicoes: [], clubes: {}, referencias: {},
  serie: null, apelido: null, edicao: null, jogos: null, clube: null,
  referencia: null, posicao: PADRAO,
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
  estado.posicao = url.posicao ?? PADRAO;

  const series = [...new Set(estado.edicoes.map((e) => e.serie))].sort();
  el("serie").innerHTML = series
    .map((s) => `<option value="${s}">Série ${s}</option>`).join("");
  el("serie").addEventListener("change", () => trocarSerie(el("serie").value));
  el("ano").addEventListener("change", () => trocarAno(el("ano").value));
  el("equipe").addEventListener("change", () => {
    estado.clube = el("equipe").value;
    aplicar();
  });

  trilha = ligarSeletorDePosicao({
    raiz: el("posicoes"),
    posicao: estado.posicao,
    aoMudar: (posicao) => { estado.posicao = posicao; aplicar(); },
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
      `a Série ${serie} ainda não tem edição encerrada — sem ela não há meta`);
  } else {
    definirMensagemSemCard("escolha uma equipe para desenhar o card");
    const total = Object.keys(estado.referencia.media).length;
    trilha.definir({ meta: Math.min(estado.posicao, total) });
    estado.posicao = trilha.valores().meta;
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
    .map((c) => `<option value="${c}">${nomeBonito(c)}</option>`).join("");

  const atual = clubeDesejado ?? estado.clube;
  const escolhido = clubes.includes(atual)
    ? atual : tabela(jogos, clubes, {})[0]?.equipe ?? clubes[0];

  Object.assign(estado, { apelido, edicao, jogos, clube: escolhido });
  el("equipe").value = escolhido;

  if (!silencioso) aplicar();
}

function aplicar() {
  atualizarUrl();
  resumirMeta();
  redesenhar();
}

/**
 * O que a posição escolhida significa, fora do card.
 *
 * A trilha mostra "17"; o que interessa saber antes de olhar o card é que 17
 * quer dizer 7 pontos por bloco. Sem isso o filtro é um número sem consequência.
 */
function resumirMeta() {
  const alvo = el("resumo-meta");
  if (!alvo) return;
  const media = estado.referencia?.media?.[String(estado.posicao)];
  if (media === undefined) { alvo.textContent = ""; return; }

  const metas = metasDaPosicao(media);
  alvo.innerHTML = `quem termina em <b>${estado.posicao}º</b> na Série `
    + `${estado.serie} faz em média <b>${media.toFixed(1).replace(".", ",")}</b> `
    + `pontos — meta de <b>${metas.bloco}</b> por bloco e <b>${metas.extra}</b> `
    + `no extra, <b>${metas.total}</b> no total`;
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  const posicao = Number(p.get("posicao"));
  return { serie: p.get("serie"), ano: p.get("ano"), equipe: p.get("equipe"),
           posicao: Number.isInteger(posicao) && posicao > 0 ? posicao : null };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.apelido) p.set("ano", estado.apelido);
  if (estado.clube) p.set("equipe", estado.clube);
  p.set("posicao", estado.posicao);
  history.replaceState(null, "", `#${p}`);
}
