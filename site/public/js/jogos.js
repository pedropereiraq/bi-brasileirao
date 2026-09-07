/**
 * Tabela de jogos.
 *
 * Duas seleções, e as duas são menu: clicar num clube da classificação mostra
 * só os jogos dele; clicar numa barra do gráfico mostra só aquela rodada. As
 * duas combinam — clube e rodada ao mesmo tempo — e clicar de novo desfaz.
 *
 * O gráfico é sempre ordenado pelo número da rodada, de 1 a 38. O BI antigo
 * embaralhava (…20, 22, 23, 24, 25, 21, 26…) porque ordenava como texto.
 */
import { tabela, clubesDaEdicao, RODADA, DATA, MANDANTE, VISITANTE, GOLS_M,
         GOLS_V, STATUS } from "/js/motor.js";
import { registrarCartao } from "/js/cartao.js";
import { montarCartao } from "/js/cartao_jogos.js";

const estado = {
  edicoes: [], clubes: {}, jogos: null, apelido: null, edicao: null,
  clube: null, rodada: null, situacao: "todos",
};

const el = (id) => document.getElementById(id);

inicializar().catch((erro) => {
  el("subtitulo").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  const [edicoes, clubes] = await Promise.all([
    fetch("/dados/edicoes.json").then((r) => r.json()),
    fetch("/dados/clubes.json").then((r) => r.json()),
  ]);
  estado.edicoes = edicoes.edicoes;
  estado.clubes = clubes;

  montarSeletores();
  ligarControles();
  registrarCartao(() => montarCartao(estado));
  await trocarEdicao(daUrl().edicao ?? estado.edicoes[0].apelido);
}

/* ------------------------------------------------------------- edição */
function montarSeletores() {
  const series = [...new Set(estado.edicoes.map((e) => e.serie))].sort();
  el("serie").innerHTML = series
    .map((s) => `<option value="${s}">Série ${s}</option>`).join("");
  el("serie").addEventListener("change", () => {
    const primeira = estado.edicoes.find((e) => e.serie === el("serie").value);
    trocarEdicao(primeira.apelido);
  });
  el("edicao").addEventListener("change", () => trocarEdicao(el("edicao").value));
}

async function trocarEdicao(apelido) {
  const edicao = estado.edicoes.find((e) => e.apelido === apelido);
  if (!edicao) return;

  el("serie").value = edicao.serie;
  el("edicao").innerHTML = estado.edicoes
    .filter((e) => e.serie === edicao.serie)
    .map((e) => `<option value="${e.apelido}">${e.ano}</option>`).join("");
  el("edicao").value = apelido;

  estado.jogos = await fetch(`/dados/jogos/${apelido}.json`).then((r) => r.json());
  estado.apelido = apelido;
  estado.edicao = edicao;
  estado.clube = null;
  estado.rodada = null;
  desenhar();
}

function ligarControles() {
  el("situacao").addEventListener("click", (evento) => {
    const botao = evento.target.closest("button[data-valor]");
    if (!botao) return;
    for (const b of el("situacao").querySelectorAll("button")) {
      b.setAttribute("aria-pressed", String(b === botao));
    }
    estado.situacao = botao.dataset.valor;
    desenhar();
  });
  el("limpar").addEventListener("click", () => {
    estado.clube = null;
    estado.rodada = null;
    desenhar();
  });
}

/* ------------------------------------------------------------ seleção */
const realizado = (j) => j[STATUS] === "realizado"
  && j[GOLS_M] !== null && j[GOLS_V] !== null;

const doClube = (j, clube) => !clube
  || j[MANDANTE] === clube || j[VISITANTE] === clube;

/** Os jogos que a tabela mostra, com clube, rodada e situação aplicados. */
function jogosVisiveis() {
  return estado.jogos.filter((j) =>
    doClube(j, estado.clube)
    && (estado.rodada === null || j[RODADA] === estado.rodada)
    && (estado.situacao === "todos"
        || (estado.situacao === "realizados") === realizado(j))
  );
}

function selecionarClube(clube) {
  estado.clube = estado.clube === clube ? null : clube;
  desenhar();
}

function selecionarRodada(rodada) {
  estado.rodada = estado.rodada === rodada ? null : rodada;
  desenhar();
}

/* ------------------------------------------------------------ desenho */
function desenhar() {
  const e = estado.edicao;
  // O escopo dos números e do gráfico segue o clube, mas não a rodada: a
  // rodada é um recorte dentro do que o gráfico mostra, e zerá-lo tiraria a
  // referência de onde se clicou.
  const noEscopo = estado.jogos.filter((j) => doClube(j, estado.clube));
  const realizados = noEscopo.filter(realizado).length;
  const total = noEscopo.length;

  el("subtitulo").innerHTML = `Série ${e.serie} · ${e.ano} · `
    + (e.encerrada ? "edição encerrada" : `rodada ${e.rodada_atual} de ${e.rodadas}`)
    + (estado.clube ? ` · <b>${nomeCurto(estado.clube)}</b>` : "");

  el("n-realizados").textContent = realizados;
  el("n-pendentes").textContent = total - realizados;
  el("medidor").innerHTML = medidor(total ? realizados / total : 0);

  el("limpar").hidden = !estado.clube && estado.rodada === null;
  el("metodologia").textContent =
    "Jogo realizado é o que tem placar. Adiado e agendado contam como pendentes. "
    + "A classificação usa os critérios de desempate do BI: pontos, triunfos, "
    + "saldo de gols, gols pró e ordem alfabética.";

  desenharGrafico(noEscopo);
  desenharClassificacao();
  desenharJogos();
  atualizarUrl();
}

/* ------------------------------------------------- gráfico por rodada */
function desenharGrafico(noEscopo) {
  const rodadas = estado.edicao.rodadas;
  // Ordenado pelo número da rodada, sempre. Um mapa indexado por inteiro,
  // percorrido de 1 a N, não deixa a ordem virar detalhe de implementação.
  const porRodada = new Map();
  for (let r = 1; r <= rodadas; r++) porRodada.set(r, { total: 0, feitos: 0 });
  for (const j of noEscopo) {
    const bloco = porRodada.get(j[RODADA]);
    if (!bloco) continue;
    bloco.total += 1;
    if (realizado(j)) bloco.feitos += 1;
  }

  const maximo = Math.max(...[...porRodada.values()].map((b) => b.total), 1);

  el("grafico-rodadas").innerHTML = [...porRodada.entries()].map(([r, b]) => {
    const pendentes = b.total - b.feitos;
    const altura = (b.total / maximo) * 100;
    const parteFeita = b.total ? (b.feitos / b.total) * 100 : 0;
    const escolhida = estado.rodada === r;
    return `<button type="button" class="barra-rodada${escolhida ? " escolhida" : ""}"
      data-rodada="${r}" aria-pressed="${escolhida}"
      title="Rodada ${r}: ${b.feitos} realizados, ${pendentes} pendentes">
      <span class="pilha" style="height:${altura}%">
        ${pendentes ? `<i class="pendente" style="height:${100 - parteFeita}%">${
          b.total === pendentes ? pendentes : ""}</i>` : ""}
        ${b.feitos ? `<i class="feito" style="height:${parteFeita}%">${b.feitos}</i>` : ""}
      </span>
      <span class="rotulo-rodada">${r}</span>
    </button>`;
  }).join("");

  for (const barra of el("grafico-rodadas").querySelectorAll(".barra-rodada")) {
    barra.addEventListener("click", () => selecionarRodada(Number(barra.dataset.rodada)));
  }
}

function medidor(fracao) {
  const raio = 34, circunferencia = Math.PI * raio; // meio anel
  const preenchido = circunferencia * fracao;
  return `<svg viewBox="0 0 92 56" class="anel" role="img"
    aria-label="${Math.round(fracao * 100)} por cento executado">
    <path d="M12 46 A34 34 0 0 1 80 46" fill="none" stroke="var(--cinza-claro)"
          stroke-width="11" stroke-linecap="round"/>
    <path d="M12 46 A34 34 0 0 1 80 46" fill="none" stroke="var(--azul)"
          stroke-width="11" stroke-linecap="round"
          stroke-dasharray="${preenchido} ${circunferencia}"/>
    <text x="46" y="44" text-anchor="middle" class="anel-valor">${
      (fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</text>
  </svg>`;
}

/* --------------------------------------------- classificação como menu */
function desenharClassificacao() {
  const clubes = clubesDaEdicao(estado.jogos);
  const linhas = tabela(estado.jogos, clubes, {});

  el("corpo-classificacao").innerHTML = linhas.map((c) => {
    const info = estado.clubes[c.equipe] ?? {};
    const faixa = c.pos <= 4 ? "faixa-g4" : c.pos >= 17 ? "faixa-z4" : "";
    const escolhido = estado.clube === c.equipe;
    return `<tr class="${faixa}" data-clube="${escapar(c.equipe)}"
      ${escolhido ? 'aria-selected="true"' : ""}>
      <td class="pos">${c.pos}</td>
      <td class="escudo">${info.escudo
        ? `<img src="${info.escudo}" alt="" loading="lazy" onerror="this.remove()">` : ""}</td>
      <td class="sigla" title="${escapar(nomeCurto(c.equipe))}">${info.sigla ?? ""}</td>
      <td class="pg">${c.pts}</td>
      <td class="j">${c.j}</td>
    </tr>`;
  }).join("");

  for (const linha of el("corpo-classificacao").querySelectorAll("tr")) {
    linha.addEventListener("click", () => selecionarClube(linha.dataset.clube));
  }
}

/* -------------------------------------------------------- lista de jogos */
function desenharJogos() {
  const jogos = jogosVisiveis();

  const partes = [];
  if (estado.clube) partes.push(nomeCurto(estado.clube));
  if (estado.rodada !== null) partes.push(`rodada ${estado.rodada}`);
  el("titulo-jogos").textContent = partes.length ? `Jogos · ${partes.join(" · ")}` : "Jogos";
  el("contagem-jogos").textContent =
    `${jogos.length} ${jogos.length === 1 ? "jogo" : "jogos"}`;

  if (!jogos.length) {
    el("corpo-jogos").innerHTML =
      '<tr><td colspan="5" class="vazio">nenhum jogo neste recorte</td></tr>';
    return;
  }

  el("corpo-jogos").innerHTML = jogos.map((j) => {
    const feito = realizado(j);
    const destaque = (clube) => estado.clube === clube ? " destacado" : "";
    return `<tr class="${feito ? "" : "pendente"}">
      <td class="rod">${j[RODADA]}</td>
      <td class="data">${dataBr(j[DATA])}</td>
      <td class="mandante${destaque(j[MANDANTE])}">
        <span class="lado direita">${nomeCurto(j[MANDANTE])}${escudinho(j[MANDANTE])}</span>
      </td>
      <td class="placar">${feito
        ? `<span class="placar-numeros">${j[GOLS_M]}<i>×</i>${j[GOLS_V]}</span>`
        : '<span class="a-jogar">a jogar</span>'}</td>
      <td class="visitante${destaque(j[VISITANTE])}">
        <span class="lado">${escudinho(j[VISITANTE])}${nomeCurto(j[VISITANTE])}</span>
      </td>
    </tr>`;
  }).join("");
}

function escudinho(equipe) {
  const url = estado.clubes[equipe]?.escudo;
  return url ? `<img src="${url}" alt="" loading="lazy" onerror="this.remove()">` : "";
}

/* --------------------------------------------------------------- apoio */
const nomeCurto = (equipe) => equipe.replace(/\s*\([A-Z]{2}\)$/, "");
const escapar = (s) => s.replace(/"/g, "&quot;");

function dataBr(iso) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a.slice(2)}`;
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  return { edicao: p.get("edicao") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  p.set("edicao", estado.apelido);
  if (estado.clube) p.set("clube", estado.clube);
  if (estado.rodada !== null) p.set("rodada", estado.rodada);
  history.replaceState(null, "", `#${p}`);
}

export { jogosVisiveis, realizado, doClube, nomeCurto };
