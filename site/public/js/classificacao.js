/**
 * Página do card de classificação.
 *
 * Fora do card ficam três decisões que mudam o que a tabela diz: por qual
 * critério ela é ordenada, o que cada faixa de posição vale naquele
 * regulamento, e que pedaço do campeonato entra na conta.
 *
 * As fronteiras das vagas são campo com mais e menos em vez de lista: o ajuste
 * quase sempre é de uma posição para cima ou para baixo, e um clique resolve.
 */
import { clubesDaEdicao, tabela } from "/js/motor.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_classificacao.js";
import { faixasDaSerie, limitesPadrao, limitesValidos } from "/js/vagas.js";

const COR_DA_FAIXA = {
  verdeEscuro: "#38761D",
  verdeClaro: "#6AA84F",
  azul: "#0B5394",
  cinza: "#8A8A8A",
};

const estado = {
  edicoes: [], clubes: {},
  serie: null, edicao: null, jogos: null, classificacao: [],
  criterio: "pontos",
  limites: {},
  // `form` é o que está nos campos; `recorte`, só o que de fato corta.
  form: { rodadaDe: 1, rodadaAte: null, dataDe: "", dataAte: "" },
  recorte: {},
};

const el = (id) => document.getElementById(id);
let redesenhar = () => {};

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("escolha uma edição para desenhar o card");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [edicoes, clubes] = await Promise.all([
    fetch("/dados/edicoes.json").then((r) => r.json()),
    fetch("/dados/clubes.json").then((r) => r.json()),
  ]);
  Object.assign(estado, { edicoes: edicoes.edicoes, clubes });

  const url = daUrl();
  if (url.criterio) estado.criterio = url.criterio;

  montarChaves("criterio", [
    { valor: "pontos", rotulo: "Pontos" },
    { valor: "aproveitamento", rotulo: "Aproveitamento" },
  ], (valor) => { estado.criterio = valor; pintarChaves("criterio", valor); aplicar(); });

  montarChaves("serie",
    [...new Set(estado.edicoes.map((e) => e.serie))].sort()
      .map((s) => ({ valor: s, rotulo: `Série ${s}` })),
    (valor) => trocarSerie(valor));

  el("ano").addEventListener("change", () => trocarAno(el("ano").value));
  ligarRecorte();
  el("limpar").addEventListener("click", limparRecorte);

  pintarChaves("criterio", estado.criterio);
  await trocarSerie(url.serie ?? "A", url);
}

/* -------------------------------------------------------------- filtros */
function montarChaves(id, itens, aoEscolher) {
  const caixa = el(id);
  caixa.innerHTML = itens
    .map((i) => `<button type="button" class="chave" data-valor="${i.valor}"
                   aria-pressed="false">${i.rotulo}</button>`).join("");
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

async function trocarSerie(serie, url = {}) {
  estado.serie = serie;
  pintarChaves("serie", serie);

  // Cada série tem faixas com nomes próprios: os limites recomeçam no padrão
  // dela, e não no que sobrou da outra.
  estado.limites = url.limites ?? limitesPadrao(serie);
  montarVagas();

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
  Object.assign(estado, { edicao, jogos });

  // O recorte volta à edição inteira quando o ano troca: rodada 30 de um ano
  // não quer dizer nada no ano seguinte.
  estado.form = {
    rodadaDe: url.rodadaDe ?? 1,
    rodadaAte: url.rodadaAte ?? edicao.rodadas,
    dataDe: url.dataDe ?? "",
    dataAte: url.dataAte ?? "",
  };
  ajustarLimitesDoRecorte();
  aplicar();
}

/* ---------------------------------------------------------------- vagas */
function montarVagas() {
  const caixa = el("vagas");
  const validos = limitesValidos(estado.serie, estado.limites);
  caixa.innerHTML = faixasDaSerie(estado.serie).map((faixa) => `
    <div class="vaga">
      <span class="vaga-cor" style="background:${COR_DA_FAIXA[faixa.cor]}"></span>
      <span class="vaga-nome">${faixa.rotulo}</span>
      <button type="button" class="passo" data-faixa="${faixa.nome}"
              data-passo="-1" aria-label="menos uma posição em ${faixa.rotulo}">−</button>
      <output data-faixa="${faixa.nome}">${validos[faixa.nome]}</output>
      <button type="button" class="passo" data-faixa="${faixa.nome}"
              data-passo="1" aria-label="mais uma posição em ${faixa.rotulo}">+</button>
    </div>`).join("");

  caixa.onclick = (evento) => {
    const botao = evento.target.closest(".passo");
    if (!botao) return;
    const atual = limitesValidos(estado.serie, estado.limites);
    estado.limites = limitesValidos(estado.serie, {
      ...atual,
      [botao.dataset.faixa]: atual[botao.dataset.faixa] + Number(botao.dataset.passo),
    });
    pintarVagas();
    aplicar();
  };
}

function pintarVagas() {
  const validos = limitesValidos(estado.serie, estado.limites);
  for (const saida of el("vagas").querySelectorAll("output")) {
    saida.textContent = validos[saida.dataset.faixa];
  }
}

/* -------------------------------------------------------------- recorte */
function ligarRecorte() {
  for (const id of ["rodada-de", "rodada-ate", "data-de", "data-ate"]) {
    el(id).addEventListener("change", lerRecorte);
  }
}

function ajustarLimitesDoRecorte() {
  const { edicao, form } = estado;
  for (const id of ["rodada-de", "rodada-ate"]) {
    el(id).min = 1;
    el(id).max = edicao.rodadas;
  }
  for (const id of ["data-de", "data-ate"]) {
    el(id).min = edicao.primeira_data;
    el(id).max = edicao.ultima_data;
  }
  el("rodada-de").value = form.rodadaDe;
  el("rodada-ate").value = form.rodadaAte;
  el("data-de").value = form.dataDe;
  el("data-ate").value = form.dataAte;
}

function lerRecorte() {
  const inteiro = (id, padrao) => {
    const v = Number(el(id).value);
    return Number.isInteger(v) && v >= 1 ? Math.min(v, estado.edicao.rodadas) : padrao;
  };
  const de = inteiro("rodada-de", 1);
  const ate = Math.max(de, inteiro("rodada-ate", estado.edicao.rodadas));
  estado.form = {
    rodadaDe: de, rodadaAte: ate,
    dataDe: el("data-de").value, dataAte: el("data-ate").value,
  };
  ajustarLimitesDoRecorte();
  aplicar();
}

function limparRecorte() {
  estado.form = {
    rodadaDe: 1, rodadaAte: estado.edicao.rodadas, dataDe: "", dataAte: "",
  };
  ajustarLimitesDoRecorte();
  aplicar();
}

/* --------------------------------------------------------------- desenho */
function aplicar() {
  const { jogos, form, edicao } = estado;
  if (!jogos) return;

  // Só manda ao motor o que de fato corta: `rodadaAte` igual ao fim da edição
  // não é recorte, e o subtítulo do card não deve anunciá-lo.
  const filtros = {};
  if (form.rodadaDe > 1) filtros.rodadaDe = form.rodadaDe;
  if (form.rodadaAte < edicao.rodadas) filtros.rodadaAte = form.rodadaAte;
  if (form.dataDe) filtros.dataDe = form.dataDe;
  if (form.dataAte) filtros.dataAte = form.dataAte;

  estado.classificacao = tabela(jogos, clubesDaEdicao(jogos), filtros);
  estado.recorte = filtros;
  resumir(filtros);
  atualizarUrl();
  redesenhar();
}

function resumir(filtros) {
  const cortado = Object.keys(filtros).length > 0;
  el("resumo-recorte").textContent = cortado
    ? `${jogosNoRecorte()} jogos no recorte`
    : `edição inteira · ${estado.edicao.realizados} de ${estado.edicao.jogos} jogos disputados`;
  el("limpar").hidden = !cortado;
}

const jogosNoRecorte = () =>
  estado.classificacao.reduce((soma, c) => soma + c.j, 0) / 2;

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  const inteiro = (chave) => {
    const v = Number(p.get(chave));
    return p.get(chave) !== null && Number.isInteger(v) && v > 0 ? v : null;
  };
  const limites = p.get("vagas")
    ? Object.fromEntries(p.get("vagas").split(",").map((par) => {
        const [nome, valor] = par.split(":");
        return [nome, Number(valor)];
      }))
    : null;
  return {
    serie: p.get("serie"), ano: p.get("ano"), criterio: p.get("criterio"),
    rodadaDe: inteiro("rodadaDe"), rodadaAte: inteiro("rodadaAte"),
    dataDe: p.get("dataDe") ?? "", dataAte: p.get("dataAte") ?? "",
    limites,
  };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.edicao) p.set("ano", estado.edicao.apelido);
  p.set("criterio", estado.criterio);
  const validos = limitesValidos(estado.serie, estado.limites);
  p.set("vagas", Object.entries(validos).map(([n, v]) => `${n}:${v}`).join(","));
  for (const [chave, valor] of Object.entries(estado.recorte)) {
    p.set(chave, valor);
  }
  history.replaceState(null, "", `#${p}`);
}
