import {
  tabela, filtrar, formatoLongo, clubesDaEdicao, campanha, porMando,
} from "/js/motor.js";
import { registrarCartao } from "/js/cartao.js";
import { montarCartao } from "/js/cartao_classificacao.js";

const MAX_CHIPS = 5;

const estado = {
  edicoes: [], clubes: {}, jogos: null, apelido: null,
  longo: null, selecionado: null,
  filtros: { mando: "todos", rodadaDe: null, rodadaAte: null,
             dataDe: null, dataAte: null, ultimos: null },
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

  montarSeletoresDeEdicao();
  ligarFiltros();
  registrarCartao(() => montarCartao(estado));
  await trocarEdicao(daUrl() ?? estado.edicoes[0].apelido);
}

/* ------------------------------------------------------------- edição */
function montarSeletoresDeEdicao() {
  const series = [...new Set(estado.edicoes.map((e) => e.serie))].sort();
  el("serie").innerHTML = series
    .map((s) => `<option value="${s}">Série ${s}</option>`).join("");
  el("serie").addEventListener("change", () => {
    const primeira = estado.edicoes.find((e) => e.serie === el("serie").value);
    trocarEdicao(primeira.apelido);
  });
  el("edicao").addEventListener("change", () => trocarEdicao(el("edicao").value));
}

function preencherAnos(serie) {
  const daSerie = estado.edicoes.filter((e) => e.serie === serie);
  el("edicao").innerHTML = daSerie
    .map((e) => `<option value="${e.apelido}">${e.ano}</option>`).join("");
}

async function trocarEdicao(apelido) {
  const edicao = estado.edicoes.find((e) => e.apelido === apelido);
  if (!edicao) return;

  el("serie").value = edicao.serie;
  preencherAnos(edicao.serie);
  el("edicao").value = apelido;

  estado.jogos = await fetch(`/dados/jogos/${apelido}.json`).then((r) => r.json());
  estado.apelido = apelido;
  estado.edicao = edicao;
  estado.selecionado = null;

  limparFiltros({ manterMando: true });
  prepararLimitesDosFiltros(edicao);
  // `lerFiltros` e não `desenhar`: os seletores acabaram de ganhar valores, e é
  // ele que os copia para o estado antes de desenhar. Chamar `desenhar` direto
  // deixava o resumo falando de "rodada null".
  lerFiltros();
}

function prepararLimitesDosFiltros(edicao) {
  const rodadas = Array.from({ length: edicao.rodadas }, (_, i) => i + 1);
  el("rodada-de").innerHTML = rodadas.map((r) => `<option value="${r}">${r}</option>`).join("");
  el("rodada-ate").innerHTML = rodadas.map((r) => `<option value="${r}">${r}</option>`).join("");
  el("rodada-de").value = 1;
  el("rodada-ate").value = edicao.rodada_atual || edicao.rodadas;

  el("ultimos").innerHTML = '<option value="">todos</option>' +
    rodadas.map((n) => `<option value="${n}">${n} jogos</option>`).join("");
  el("ultimos").value = "";

  for (const campo of ["data-de", "data-ate"]) {
    el(campo).min = edicao.primeira_data;
    el(campo).max = edicao.ultima_data ?? edicao.primeira_data;
    el(campo).value = "";
  }
}

/* ------------------------------------------------------------ filtros */
function ligarFiltros() {
  el("mando").addEventListener("click", (evento) => {
    const botao = evento.target.closest("button[data-valor]");
    if (!botao) return;
    for (const b of el("mando").querySelectorAll("button")) {
      b.setAttribute("aria-pressed", String(b === botao));
    }
    lerFiltros();
  });

  for (const id of ["rodada-de", "rodada-ate", "ultimos", "data-de", "data-ate"]) {
    el(id).addEventListener("change", () => lerFiltros());
  }
  el("limpar").addEventListener("click", () => {
    limparFiltros();
    prepararLimitesDosFiltros(estado.edicao);
    lerFiltros();
  });
}

function limparFiltros({ manterMando = false } = {}) {
  if (!manterMando) {
    for (const b of el("mando").querySelectorAll("button")) {
      b.setAttribute("aria-pressed", String(b.dataset.valor === "todos"));
    }
    estado.filtros.mando = "todos";
  }
  Object.assign(estado.filtros, {
    rodadaDe: null, rodadaAte: null, dataDe: null, dataAte: null, ultimos: null,
  });
}

function lerFiltros() {
  const de = Number(el("rodada-de").value);
  const ate = Number(el("rodada-ate").value);
  // Intervalo invertido é engano de clique, não intenção: conserta em silêncio.
  if (de > ate) el("rodada-ate").value = String(de);

  estado.filtros = {
    mando: el("mando").querySelector('[aria-pressed="true"]').dataset.valor,
    rodadaDe: Number(el("rodada-de").value),
    rodadaAte: Number(el("rodada-ate").value),
    dataDe: el("data-de").value || null,
    dataAte: el("data-ate").value || null,
    ultimos: el("ultimos").value ? Number(el("ultimos").value) : null,
  };
  atualizarUrl();
  desenhar();
}

/** Frase que descreve o recorte — o número na tela nunca fica sem contexto. */
function descreverFiltro() {
  const f = estado.filtros;
  const e = estado.edicao;
  const partes = [];

  if (f.ultimos) partes.push(`<b>últimos ${f.ultimos} jogos</b> de cada clube`);
  const intervaloCheio = f.rodadaDe === 1 && f.rodadaAte >= (e.rodada_atual || e.rodadas);
  if (!intervaloCheio) {
    partes.push(f.rodadaDe === f.rodadaAte
      ? `<b>rodada ${f.rodadaDe}</b>`
      : `<b>rodadas ${f.rodadaDe} a ${f.rodadaAte}</b>`);
  }
  if (f.mando !== "todos") partes.push(`jogos <b>${f.mando === "casa" ? "em casa" : "fora"}</b>`);
  if (f.dataDe || f.dataAte) {
    partes.push(`entre <b>${f.dataDe ? dataBr(f.dataDe) : "o início"}</b> e ` +
                `<b>${f.dataAte ? dataBr(f.dataAte) : "hoje"}</b>`);
  }

  const escopo = partes.length ? partes.join(" · ") : "<b>toda a edição</b>, sem recorte";
  const disputados = estado.longo.length / 2;
  return `${escopo} — ${disputados} ${disputados === 1 ? "jogo" : "jogos"} na conta`;
}

/* ------------------------------------------------------------ desenho */
function desenhar() {
  estado.longo = filtrar(formatoLongo(estado.jogos), estado.filtros);
  const clubes = clubesDaEdicao(estado.jogos);
  const linhas = tabela(estado.jogos, clubes, estado.filtros);

  const e = estado.edicao;
  el("subtitulo").innerHTML =
    `Série ${e.serie} · ${e.ano} · ` +
    (e.encerrada ? "edição encerrada" : `rodada ${e.rodada_atual} de ${e.rodadas}`) +
    ` · ${e.realizados} de ${e.jogos} jogos disputados`;
  el("resumo").innerHTML = descreverFiltro();
  el("metodologia").textContent =
    "Pontos corridos com 20 clubes. Critérios de desempate: pontos, triunfos, " +
    "saldo de gols, gols pró e ordem alfabética. Jogo sem placar não entra na conta.";

  desenharTabela(linhas);
  if (estado.selecionado) desenharPainel(estado.selecionado);
}

function desenharTabela(linhas) {
  const corpo = el("corpo");
  corpo.innerHTML = linhas.map((c) => {
    const faixa = c.pos <= 4 ? "faixa-g4" : c.pos >= 17 ? "faixa-z4" : "";
    const selecionado = c.equipe === estado.selecionado;
    return `<tr class="${faixa}" data-clube="${escapar(c.equipe)}" ${selecionado ? 'aria-selected="true"' : ""}>
      <td class="pos">${c.pos}</td>
      <td class="clube">${celulaClube(c.equipe)}</td>
      <td class="pts">${c.pts}</td>
      <td>${c.j}</td>
      <td>${c.t}</td>
      <td>${c.e}</td>
      <td>${c.d}</td>
      <td class="fraco">${c.gp}</td>
      <td class="fraco">${c.gc}</td>
      <td>${c.sg > 0 ? "+" : ""}${c.sg}</td>
      <td>${c.aproveitamento === null ? "—" : Math.round(c.aproveitamento * 100) + "%"}</td>
      <td>${chipsDe(c.equipe)}</td>
    </tr>`;
  }).join("");

  for (const linha of corpo.querySelectorAll("tr")) {
    linha.addEventListener("click", () => selecionar(linha.dataset.clube));
  }
}

function chipsDe(clube) {
  const meus = estado.longo
    .filter((l) => l.equipe === clube)
    .sort((a, b) => (a.data === b.data ? a.rodada - b.rodada : a.data < b.data ? -1 : 1))
    .slice(-MAX_CHIPS);
  if (!meus.length) return '<span class="fraco">—</span>';
  return `<div class="chips">${meus.map((l) =>
    `<span class="chip ${l.resultado}" title="${tituloJogo(l)}">${l.resultado}</span>`
  ).join("")}</div>`;
}

function tituloJogo(l) {
  const local = l.mando === "casa" ? "em casa" : "fora";
  return `Rodada ${l.rodada} · ${dataBr(l.data)} · ${nomeCurto(l.adversario)} ` +
         `${local} · ${l.gp} × ${l.gc}`;
}

function celulaClube(equipe) {
  const info = estado.clubes[equipe] ?? {};
  const escudo = info.escudo
    ? `<img src="${info.escudo}" alt="" loading="lazy" onerror="this.remove()">`
    : "";
  return `<span class="clube-celula">${escudo}<span class="clube-nome">${nomeCurto(equipe)}</span>
    <span class="clube-uf">${uf(equipe)}</span></span>`;
}

const nomeCurto = (equipe) => equipe.replace(/\s*\([A-Z]{2}\)$/, "");
const uf = (equipe) => (equipe.match(/\(([A-Z]{2})\)$/) ?? [, ""])[1];

/* ------------------------------------------------------ painel do clube */
function selecionar(clube) {
  estado.selecionado = estado.selecionado === clube ? null : clube;
  atualizarUrl();
  if (!estado.selecionado) {
    el("painel").hidden = true;
    desenharTabela(tabela(estado.jogos, clubesDaEdicao(estado.jogos), estado.filtros));
    return;
  }
  desenhar();
  el("painel").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function desenharPainel(clube) {
  const painel = el("painel");
  const passos = campanha(estado.jogos, clube, estado.filtros);
  const mandos = porMando(estado.jogos, clube, estado.filtros);
  const linha = tabela(estado.jogos, clubesDaEdicao(estado.jogos), estado.filtros)
    .find((c) => c.equipe === clube);
  const info = estado.clubes[clube] ?? {};

  painel.hidden = false;
  painel.className = "cartao painel-clube";
  painel.innerHTML = `
    <div class="painel-cabecalho">
      ${info.escudo ? `<img src="${info.escudo}" alt="" onerror="this.remove()">` : ""}
      <div>
        <h2>${nomeCurto(clube)}</h2>
        <div class="lugar">${info.cidade ?? ""}${info.estado ? " · " + info.estado : ""}
          · ${linha.pos}º no recorte</div>
      </div>
      <button class="fechar" id="fechar-painel" aria-label="Fechar">×</button>
    </div>

    <div class="numeros">
      <div class="numero destaque"><div class="valor">${linha.pts}</div><div class="nome">pontos</div></div>
      <div class="numero"><div class="valor">${linha.j}</div><div class="nome">jogos</div></div>
      <div class="numero"><div class="valor">${linha.t}·${linha.e}·${linha.d}</div><div class="nome">T · E · D</div></div>
      <div class="numero"><div class="valor">${linha.sg > 0 ? "+" : ""}${linha.sg}</div><div class="nome">saldo</div></div>
      <div class="numero"><div class="valor">${linha.aproveitamento === null ? "—" : Math.round(linha.aproveitamento * 100) + "%"}</div><div class="nome">aproveitamento</div></div>
    </div>

    <div class="painel-corpo">
      <div class="bloco">
        <h3>Pontos por mando</h3>
        ${blocoMando(mandos)}
      </div>
      <div class="bloco">
        <h3>Evolução da posição</h3>
        ${graficoPosicao(passos)}
      </div>
      <div class="bloco">
        <h3>Evolução da pontuação</h3>
        ${graficoPontos(passos)}
      </div>
      <div class="bloco">
        <h3>Jogos no recorte <span class="clube-uf">(${passos.length})</span></h3>
        ${listaJogos(passos)}
      </div>
    </div>`;

  el("fechar-painel").addEventListener("click", () => selecionar(clube));
  ligarGraficosDoPainel(painel, passos);
}

function blocoMando(mandos) {
  // O total entra no máximo. Sem ele a barra de Total passava de 100% da caixa
  // e vazava para fora do cartão — era o que estava quebrado.
  const maximo = Math.max(mandos.casa.j, mandos.fora.j, mandos.todos.j, 1);
  const linha = (nome, m) => {
    if (!m.j) return `<div class="mando-linha"><span class="mando-nome">${nome}</span>
      <span class="fraco">sem jogos no recorte</span><span></span></div>`;
    const largura = (m.j / maximo) * 100;
    const pedaco = (n) => (n / m.j) * 100;
    return `<div class="mando-linha">
      <span class="mando-nome">${nome}</span>
      <span class="barra-empilhada" style="width:${largura}%"
            title="${m.t} triunfos, ${m.e} empates, ${m.d} derrotas">
        <i class="T" style="width:${pedaco(m.t)}%"></i>
        <i class="E" style="width:${pedaco(m.e)}%"></i>
        <i class="D" style="width:${pedaco(m.d)}%"></i>
      </span>
      <span class="mando-valor">${m.pts} pts · ${m.j}J · ${Math.round((m.pts / (3 * m.j)) * 100)}%</span>
    </div>`;
  };
  return `<div class="mando-barras">
    ${linha("Casa", mandos.casa)}
    ${linha("Fora", mandos.fora)}
    ${linha("Total", mandos.todos)}
  </div>`;
}

/* ------------------------------------------------------------ gráficos */
/*
 * SVG desenhado à mão, sem biblioteca. Cada gráfico leva faixas invisíveis de
 * captura sobre cada ponto: passar o mouse mostra a guia, destaca o ponto e
 * abre a dica com os números daquela rodada.
 */
const L = 420, A = 150, MARGEM = { e: 26, d: 10, t: 12, b: 22 };

function escalaX(i, n) {
  const util = L - MARGEM.e - MARGEM.d;
  return MARGEM.e + (n <= 1 ? util / 2 : (i / (n - 1)) * util);
}

/** Faixas de captura: cada uma cobre a vizinhança de um ponto. */
function alvos(n) {
  const util = L - MARGEM.e - MARGEM.d;
  const largura = n <= 1 ? util : util / (n - 1);
  return Array.from({ length: n }, (_, i) =>
    `<rect class="alvo" data-i="${i}" x="${escalaX(i, n) - largura / 2}" y="0"
           width="${largura}" height="${A}"/>`).join("");
}

function moldura(grade, rotulosX, conteudo, n, cor) {
  return `<div class="grafico-caixa">
    <svg class="grafico" viewBox="0 0 ${L} ${A}" preserveAspectRatio="xMidYMid meet">
      ${grade}${rotulosX}${conteudo}
      <line class="guia" x1="0" y1="${MARGEM.t}" x2="0" y2="${A - MARGEM.b}" opacity="0"/>
      <circle class="ponto" r="4.5" opacity="0" style="fill:${cor}"/>
      ${alvos(n)}
    </svg>
    <div class="dica" role="status"></div>
  </div>`;
}

function graficoPosicao(passos) {
  if (!passos.length) return '<p class="fraco">sem jogos no recorte</p>';
  const n = passos.length;
  const util = A - MARGEM.t - MARGEM.b;
  // Eixo invertido: 1º lugar no topo, como se lê uma tabela.
  const y = (p) => MARGEM.t + ((p.pos - 1) / 19) * util;

  const linha = passos.map((p, i) => `${escalaX(i, n)},${y(p)}`).join(" ");
  const grade = [1, 5, 10, 15, 20].map((pos) => {
    const yy = MARGEM.t + ((pos - 1) / 19) * util;
    return `<line class="grade" x1="${MARGEM.e}" y1="${yy}" x2="${L - MARGEM.d}" y2="${yy}"/>
            <text class="rotulo" x="4" y="${yy + 3}">${pos}º</text>`;
  }).join("");

  return moldura(grade, rotulosDeRodada(passos),
    `<polyline class="linha-pos" points="${linha}"/>`, n, "var(--azul)");
}

function graficoPontos(passos) {
  if (!passos.length) return '<p class="fraco">sem jogos no recorte</p>';
  const n = passos.length;
  const util = A - MARGEM.t - MARGEM.b;
  const maximo = Math.max(passos[n - 1].pts_ac, 1);
  const y = (p) => MARGEM.t + util - (p.pts_ac / maximo) * util;

  const linha = passos.map((p, i) => `${escalaX(i, n)},${y(p)}`).join(" ");
  const grade = [0, Math.round(maximo / 2), maximo].map((v) => {
    const yy = MARGEM.t + util - (v / maximo) * util;
    return `<line class="grade" x1="${MARGEM.e}" y1="${yy}" x2="${L - MARGEM.d}" y2="${yy}"/>
            <text class="rotulo" x="4" y="${yy + 3}">${v}</text>`;
  }).join("");

  return moldura(grade, rotulosDeRodada(passos),
    `<polyline class="linha-pts" points="${linha}"/>`, n, "var(--vermelho)");
}

function rotulosDeRodada(passos) {
  const n = passos.length;
  const quais = n <= 6 ? passos.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];
  return quais.map((i) =>
    `<text class="rotulo" x="${escalaX(i, n)}" y="${A - 6}" text-anchor="middle">R${passos[i].rodada}</text>`
  ).join("");
}

/**
 * Liga a interação de um gráfico já no DOM. `alturaDe` devolve o y de um passo
 * no sistema do viewBox; `texto` monta o conteúdo da dica.
 */
function ligarGrafico(caixa, passos, alturaDe, texto) {
  if (!caixa || !passos.length) return;
  const svg = caixa.querySelector("svg");
  const guia = caixa.querySelector(".guia");
  const ponto = caixa.querySelector(".ponto");
  const dica = caixa.querySelector(".dica");
  const n = passos.length;

  const mostrar = (i) => {
    const p = passos[i];
    const x = escalaX(i, n), y = alturaDe(p);
    guia.setAttribute("x1", x); guia.setAttribute("x2", x);
    guia.setAttribute("opacity", "1");
    ponto.setAttribute("cx", x); ponto.setAttribute("cy", y);
    ponto.setAttribute("opacity", "1");

    const caixaSvg = svg.getBoundingClientRect();
    dica.innerHTML = texto(p);
    dica.style.left = `${(x / L) * caixaSvg.width}px`;
    dica.style.top = `${(y / A) * caixaSvg.height - 8}px`;
    dica.dataset.visivel = "sim";
  };

  const esconder = () => {
    guia.setAttribute("opacity", "0");
    ponto.setAttribute("opacity", "0");
    dica.dataset.visivel = "nao";
  };

  for (const alvo of caixa.querySelectorAll(".alvo")) {
    const i = Number(alvo.dataset.i);
    alvo.addEventListener("pointerenter", () => mostrar(i));
    alvo.addEventListener("focus", () => mostrar(i));
  }
  svg.addEventListener("pointerleave", esconder);
  // Em toque, o dedo sai sem "pointerleave" às vezes; um toque fora fecha.
  document.addEventListener("pointerdown", (e) => {
    if (!caixa.contains(e.target)) esconder();
  });
}

/** Liga os dois gráficos do painel do clube. */
function ligarGraficosDoPainel(painel, passos) {
  const util = A - MARGEM.t - MARGEM.b;
  const maximo = Math.max(passos.length ? passos[passos.length - 1].pts_ac : 1, 1);
  const caixas = painel.querySelectorAll(".grafico-caixa");

  ligarGrafico(caixas[0], passos,
    (p) => MARGEM.t + ((p.pos - 1) / 19) * util,
    (p) => `<b>${p.pos}º</b> após a rodada ${p.rodada}<br>
            <span class="fraca">${dataBr(p.data)} · ${p.mando === "casa" ? "casa" : "fora"} ·
            ${nomeCurto(p.adversario)} ${p.gp} × ${p.gc}</span>`);

  ligarGrafico(caixas[1], passos,
    (p) => MARGEM.t + util - (p.pts_ac / maximo) * util,
    (p) => `<b>${p.pts_ac} pontos</b> em ${p.j_ac} jogos<br>
            <span class="fraca">rodada ${p.rodada} · ${p.t_ac}T ${p.e_ac}E ${p.d_ac}D ·
            saldo ${p.sg_ac > 0 ? "+" : ""}${p.sg_ac}</span>`);
}

function listaJogos(passos) {
  if (!passos.length) return '<p class="fraco">sem jogos no recorte</p>';
  const linhas = [...passos].reverse().map((p) => `<tr>
    <td class="rodada">R${p.rodada}</td>
    <td class="data">${dataBr(p.data)}</td>
    <td class="mando">${p.mando === "casa" ? "CASA" : "FORA"}</td>
    <td class="adversario">${nomeCurto(p.adversario)}</td>
    <td class="placar">${p.gp} × ${p.gc}</td>
    <td><span class="chip ${p.resultado}">${p.resultado}</span></td>
    <td class="posicao">${p.pos}º</td>
  </tr>`).join("");
  return `<div class="jogos-lista"><table class="jogos"><tbody>${linhas}</tbody></table></div>`;
}

/* --------------------------------------------------------------- apoio */
function dataBr(iso) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

const escapar = (s) => s.replace(/"/g, "&quot;");

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  return p.get("edicao");
}

function atualizarUrl() {
  const p = new URLSearchParams();
  p.set("edicao", estado.apelido);
  if (estado.selecionado) p.set("clube", estado.selecionado);
  history.replaceState(null, "", `#${p}`);
}
