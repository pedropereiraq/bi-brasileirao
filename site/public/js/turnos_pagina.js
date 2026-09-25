/**
 * Página do card de comparativo de turnos.
 *
 * Fora do card só a série, a edição e a equipe: a tela é sobre um clube numa
 * edição, e o resto — os dois turnos, os confrontos, as duas classificações —
 * sai daí sozinho. A equipe também troca por clique dentro do card.
 *
 * As duas classificações são o motor do navegador com um filtro de rodada,
 * e não uma tabela pronta: "só o primeiro turno" é um recorte como qualquer
 * outro, e é assim que o BI inteiro funciona.
 */
import {
  RODADA, DATA, MANDANTE, VISITANTE, GOLS_M, GOLS_V, STATUS, tabela,
} from "/js/motor.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_turnos.js";
import { RODADAS_POR_TURNO } from "/js/turnos.js";
import { nomeBonito } from "/js/nomes.js";

const estado = {
  edicoes: [], clubes: {},
  serie: null, edicao: null, equipe: "", jogos: [], agenda: [], tabelas: null,
  aoEscolher: (equipe) => {
    if (!equipe || equipe === estado.equipe) return;
    estado.equipe = equipe;
    el("equipe").value = equipe;
    aplicar();
  },
};

const el = (id) => document.getElementById(id);
let redesenhar = () => {};

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("esta edição ainda não tem primeiro turno para comparar");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [edicoes, clubes] = await Promise.all([
    fetch("/dados/edicoes.json").then((r) => r.json()),
    fetch("/dados/clubes.json").then((r) => r.json()),
  ]);
  Object.assign(estado, { edicoes: edicoes.edicoes, clubes });

  montarChaves("serie",
    [...new Set(estado.edicoes.map((e) => e.serie))].sort()
      .map((s) => [s, `Série ${s}`]),
    (valor) => trocarSerie(valor));

  el("ano").addEventListener("change", () => trocarAno(el("ano").value));
  el("equipe").addEventListener("change", () => {
    estado.equipe = el("equipe").value;
    aplicar();
  });

  const url = daUrl();
  await trocarSerie(url.serie ?? "A", url);
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

async function trocarSerie(serie, url = {}) {
  estado.serie = serie;
  for (const botao of el("serie").children) {
    botao.setAttribute("aria-pressed", String(botao.dataset.valor === serie));
  }

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
  const clubes = [...new Set(jogos.flatMap((j) => [j[MANDANTE], j[VISITANTE]]))]
    .sort();

  Object.assign(estado, {
    edicao, jogos,
    tabelas: {
      ida: tabela(jogos, clubes, { rodadaAte: RODADAS_POR_TURNO }),
      volta: tabela(jogos, clubes, { rodadaDe: RODADAS_POR_TURNO + 1 }),
    },
  });

  el("equipe").innerHTML = clubes
    .map((c) => `<option value="${c}">${nomeBonito(c)}</option>`).join("");
  const querido = url.equipe ?? estado.equipe;
  estado.equipe = clubes.includes(querido) ? querido : clubes[0];
  el("equipe").value = estado.equipe;

  aplicar();
}

/** A agenda do clube: todo jogo da edição, disputado ou não, com o placar. */
function agendaDoClube(jogos, clube) {
  const desfecho = (gp, gc) => (gp > gc ? "T" : gp === gc ? "E" : "D");
  const minhas = [];
  for (const j of jogos) {
    const emCasa = j[MANDANTE] === clube;
    if (!emCasa && j[VISITANTE] !== clube) continue;

    const feito = j[STATUS] === "realizado"
      && j[GOLS_M] !== null && j[GOLS_V] !== null;
    const gp = feito ? (emCasa ? j[GOLS_M] : j[GOLS_V]) : null;
    const gc = feito ? (emCasa ? j[GOLS_V] : j[GOLS_M]) : null;
    minhas.push({
      rodada: j[RODADA], data: j[DATA],
      adversario: emCasa ? j[VISITANTE] : j[MANDANTE],
      mando: emCasa ? "casa" : "fora",
      realizado: feito, gp, gc,
      resultado: feito ? desfecho(gp, gc) : null,
    });
  }
  return minhas;
}

function aplicar() {
  estado.agenda = agendaDoClube(estado.jogos, estado.equipe);

  const { edicao } = estado;
  el("rodape-edicao").textContent = edicao
    ? `Série ${estado.serie} ${edicao.ano} · ${edicao.realizados} de `
      + `${edicao.jogos} jogos disputados`
    : "";
  atualizarUrl();
  redesenhar();
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  return { serie: p.get("serie"), ano: p.get("ano"), equipe: p.get("equipe") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.edicao) p.set("ano", estado.edicao.apelido);
  if (estado.equipe) p.set("equipe", estado.equipe);
  history.replaceState(null, "", `#${p}`);
}
