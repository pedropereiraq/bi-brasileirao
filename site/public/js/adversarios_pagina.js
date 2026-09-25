/**
 * Página do card de resultados por adversário.
 *
 * O primeiro filtro escolhe a pergunta. **Por equipe** olha a campanha de um
 * clube pelo lado de quem esteve do outro lado. **Ranking por bloco** vira a
 * pergunta do avesso: fixa uma faixa da tabela e mede todo mundo contra ela.
 * São filtros diferentes porque são perguntas diferentes — a primeira pede uma
 * equipe, a segunda pede um intervalo de posições e um mando.
 *
 * A classificação vem do motor do navegador, e não de tabela pronta: é a
 * mesma da tela de classificação, com os mesmos desempates.
 */
import {
  RODADA, DATA, MANDANTE, VISITANTE, GOLS_M, GOLS_V, STATUS, tabela,
} from "/js/motor.js";
import {
  aoMudarTapetao, descontosDe,
} from "/js/tapetao.js";
import {
  equipeLembrada, lembrarEquipe, lembrarSerie, serieLembrada,
} from "/js/preferencias.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_adversarios.js";
import { ladosDosJogos } from "/js/adversarios.js";
import { ligarSeletorDePosicoes } from "/js/seletor_posicoes.js";
import { nomeBonito } from "/js/nomes.js";

const estado = {
  edicoes: [], clubes: {},
  modo: "equipe", serie: null, edicao: null, equipe: "",
  faixa: { melhor: 1, pior: 4 }, mando: "ambos",
  jogos: [], classificacao: [], agenda: [], lados: [],
  aoEscolher: (equipe) => {
    if (!equipe || equipe === estado.equipe) return;
    estado.equipe = equipe;
    el("equipe").value = equipe;
    // Clicar num clube é escolher a equipe analisada; no ranking por bloco,
    // que não tem equipe, o clique não tem o que fazer.
    if (estado.modo === "equipe") aplicar();
  },
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
  definirMensagemSemCard("esta edição ainda não tem jogos desta equipe");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [edicoes, clubes] = await Promise.all([
    fetch("/dados/edicoes.json").then((r) => r.json()),
    fetch("/dados/clubes.json").then((r) => r.json()),
  ]);
  Object.assign(estado, { edicoes: edicoes.edicoes, clubes });

  montarChaves("modo", [
    ["equipe", "Por equipe"], ["ranking", "Ranking por bloco"],
  ], (valor) => { estado.modo = valor; aplicar(); });

  montarChaves("mando", [
    ["ambos", "Ambos"], ["casa", "Em casa"], ["fora", "Fora"],
  ], (valor) => { estado.mando = valor; aplicar(); });

  ligarSeletorDePosicoes({
    raiz: el("posicoes"),
    pior: estado.faixa.pior,
    melhor: estado.faixa.melhor,
    aoMudar: ({ pior, melhor }) => { estado.faixa = { pior, melhor }; aplicar(); },
  });

  montarChaves("serie",
    [...new Set(estado.edicoes.map((e) => e.serie))].sort()
      .map((s) => [s, `Série ${s}`]),
    (valor) => trocarSerie(valor));

  el("ano").addEventListener("change", () => trocarAno(el("ano").value));
  el("equipe").addEventListener("change", () => {
    estado.equipe = lembrarEquipe(el("equipe").value);
    aplicar();
  });

  const url = daUrl();
  if (url.modo === "ranking" || url.modo === "equipe") estado.modo = url.modo;
  if (["ambos", "casa", "fora"].includes(url.mando)) estado.mando = url.mando;
  if (url.de && url.ate) estado.faixa = { melhor: url.de, pior: url.ate };
  await trocarSerie(url.serie ?? serieLembrada() ?? "A", url);
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
  lembrarSerie(estado.serie);
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
    edicao, jogos, classificacao: tabela(jogos, clubes, {}, descontos()),
  });

  el("equipe").innerHTML = clubes
    .map((c) => `<option value="${c}">${nomeBonito(c)}</option>`).join("");
  const querido = url.equipe ?? estado.equipe ?? equipeLembrada();
  estado.equipe = clubes.includes(querido) ? querido : clubes[0];
  lembrarEquipe(estado.equipe);
  el("equipe").value = estado.equipe;

  aplicar();
}

/** Todo jogo do clube na edição, do ponto de vista dele. */
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
  for (const [id, escolhido] of [["modo", estado.modo], ["mando", estado.mando]]) {
    for (const botao of el(id).children) {
      botao.setAttribute("aria-pressed", String(botao.dataset.valor === escolhido));
    }
  }
  const noRanking = estado.modo === "ranking";
  el("campo-equipe").hidden = noRanking;
  el("campo-posicoes").hidden = !noRanking;
  el("campo-mando").hidden = !noRanking;

  estado.agenda = agendaDoClube(estado.jogos, estado.equipe);
  estado.lados = noRanking ? ladosDosJogos(Object.fromEntries(
    estado.classificacao.map((c) =>
      [c.equipe, agendaDoClube(estado.jogos, c.equipe)]))) : [];

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
  return { serie: p.get("serie"), ano: p.get("ano"), equipe: p.get("equipe"),
           modo: p.get("modo"), mando: p.get("mando"),
           de: Number(p.get("de")) || null, ate: Number(p.get("ate")) || null };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.edicao) p.set("ano", estado.edicao.apelido);
  p.set("modo", estado.modo);
  if (estado.modo === "ranking") {
    p.set("mando", estado.mando);
    p.set("de", estado.faixa.melhor);
    p.set("ate", estado.faixa.pior);
  } else if (estado.equipe) {
    p.set("equipe", estado.equipe);
  }
  history.replaceState(null, "", `#${p}`);
}
