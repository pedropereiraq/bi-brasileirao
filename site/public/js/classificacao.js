/**
 * Página do card de classificação.
 *
 * Fora do card ficam três decisões que mudam o que a tabela diz: por qual
 * critério ela é ordenada, o que cada faixa de posição vale naquele
 * regulamento, e que pedaço do campeonato entra na conta.
 *
 * As fronteiras das vagas são campo com mais e menos em vez de lista: o ajuste
 * quase sempre é de uma posição para cima ou para baixo, e um clique resolve.
 *
 * E elas ficam salvas no servidor, não no navegador: não são preferência de
 * quem está olhando, são o regulamento daquele ano. Quem mudar o limite muda
 * para todo mundo que abrir o card depois.
 */
import { clubesDaEdicao, tabela } from "/js/motor.js";
import {
  aoMudarTapetao, descontosDe,
} from "/js/tapetao.js";
import {
  lembrarSerie, serieLembrada,
} from "/js/preferencias.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_classificacao.js";
import { faixasDaSerie, limitesPadrao, limitesValidos } from "/js/vagas.js";
import {
  ligarSeletorDeRodadas, ligarSeletorDeUltimos,
} from "/js/seletor_posicoes.js";

const COR_DA_FAIXA = {
  verdeEscuro: "#38761D",
  verdeClaro: "#6AA84F",
  azul: "#0B5394",
  cinza: "#8A8A8A",
};

const estado = {
  edicoes: [], clubes: {}, vagasSalvas: {},
  serie: null, edicao: null, jogos: null, classificacao: [],
  criterio: "pontos",
  limites: {},
  // `form` é o que está nos campos; `recorte`, só o que de fato corta.
  form: { rodadaDe: 1, rodadaAte: null, ultimos: null, dataDe: "", dataAte: "" },
  recorte: {},
};

// As trilhas são refeitas a cada edição: o número de rodadas é o tamanho
// delas, e uma Série B de 38 não é a mesma régua de um Brasileirão de 46.
let trilhaRodadas = null;
let trilhaUltimos = null;

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
  definirMensagemSemCard("escolha uma edição para desenhar o card");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [edicoes, clubes, vagas] = await Promise.all([
    fetch("/dados/edicoes.json").then((r) => r.json()),
    fetch("/dados/clubes.json").then((r) => r.json()),
    // Sem a rota no ar — servidor estático de desenvolvimento, por exemplo —
    // a tela abre nos padrões em vez de não abrir.
    fetch("/api/vagas").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]);
  Object.assign(estado, { edicoes: edicoes.edicoes, clubes, vagasSalvas: vagas });

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
  await trocarSerie(url.serie ?? serieLembrada() ?? "A", url);
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
  lembrarSerie(estado.serie);
  pintarChaves("serie", serie);

  // Cada série tem faixas com nomes próprios: os limites vêm do que está
  // salvo para ela, e só então do padrão — nunca do que sobrou da outra.
  estado.limites = limitesValidos(serie,
    url.limites ?? estado.vagasSalvas?.[serie] ?? limitesPadrao(serie));
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
    // No fim da trilha, "últimos X" é a edição inteira — nasce desligado.
    ultimos: url.ultimos ?? edicao.rodadas,
    dataDe: url.dataDe ?? "",
    dataAte: url.dataAte ?? "",
  };
  montarTrilhas();
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
    guardarVagas();
    aplicar();
  };
}

/**
 * Guarda as fronteiras no servidor.
 *
 * Com um respiro: apertar o mais quatro vezes seguidas é um ajuste só, e
 * quatro gravações seriam três a mais. Falha em silêncio — perder o registro
 * de uma fronteira não pode derrubar o card que está na tela.
 */
let relogioDasVagas = null;
function guardarVagas() {
  clearTimeout(relogioDasVagas);
  relogioDasVagas = setTimeout(() => {
    const limites = limitesValidos(estado.serie, estado.limites);
    estado.vagasSalvas = { ...estado.vagasSalvas, [estado.serie]: limites };
    fetch("/api/vagas", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [estado.serie]: limites }),
    }).catch(() => { /* fica só nesta sessão */ });
  }, 600);
}

function pintarVagas() {
  const validos = limitesValidos(estado.serie, estado.limites);
  for (const saida of el("vagas").querySelectorAll("output")) {
    saida.textContent = validos[saida.dataset.faixa];
  }
}

/* -------------------------------------------------------------- recorte */
function ligarRecorte() {
  for (const id of ["data-de", "data-ate"]) {
    el(id).addEventListener("change", lerRecorte);
  }
  el("turno").addEventListener("click", (evento) => {
    const botao = evento.target.closest(".chave");
    if (botao) escolherTurno(Number(botao.dataset.turno));
  });
}

/**
 * As duas trilhas do recorte, refeitas quando a edição muda.
 *
 * A de rodadas tem duas pontas porque o recorte é um trecho: dizer só "até a
 * 12ª" esconde que existe um começo. A de últimos jogos tem uma ponta e nasce
 * no fim dela, onde "últimos 38 de 38" quer dizer recorte nenhum.
 */
function montarTrilhas() {
  const { edicao, form } = estado;
  trilhaRodadas = ligarSeletorDeRodadas({
    raiz: el("rodadas"), total: edicao.rodadas,
    de: form.rodadaDe, ate: form.rodadaAte,
    aoMudar: ({ de, ate }) => {
      estado.form = { ...estado.form, rodadaDe: de, rodadaAte: ate };
      pintarTurno();
      aplicar();
    },
  });
  trilhaUltimos = ligarSeletorDeUltimos({
    raiz: el("ultimos"), total: edicao.rodadas, valor: form.ultimos,
    aoMudar: (ultimos) => {
      estado.form = { ...estado.form, ultimos };
      aplicar();
    },
  });
}

/**
 * O recorte de um turno inteiro, que é o corte que mais se pede.
 *
 * A metade sai da própria edição, e não de um 19 fixo: série com outro número
 * de rodadas continua partindo ao meio. Clicar de novo no turno já escolhido
 * desfaz o recorte — o atalho tem de saber voltar.
 */
function escolherTurno(turno) {
  const { edicao, form } = estado;
  const meio = Math.floor(edicao.rodadas / 2);
  const faixa = turno === 1
    ? { rodadaDe: 1, rodadaAte: meio }
    : { rodadaDe: meio + 1, rodadaAte: edicao.rodadas };

  const jaEstava = form.rodadaDe === faixa.rodadaDe
                && form.rodadaAte === faixa.rodadaAte;
  estado.form = jaEstava
    ? { ...form, rodadaDe: 1, rodadaAte: edicao.rodadas }
    : { ...form, ...faixa };

  ajustarLimitesDoRecorte();
  aplicar();
}

/** Marca o atalho quando o recorte em vigor é exatamente o de um turno. */
function pintarTurno() {
  const { edicao, form } = estado;
  const meio = Math.floor(edicao.rodadas / 2);
  const atual = form.rodadaDe === 1 && form.rodadaAte === meio ? "1"
    : form.rodadaDe === meio + 1 && form.rodadaAte === edicao.rodadas ? "2" : "";
  for (const botao of el("turno").children) {
    botao.setAttribute("aria-pressed", String(botao.dataset.turno === atual));
  }
}

function ajustarLimitesDoRecorte() {
  const { edicao, form } = estado;
  for (const id of ["data-de", "data-ate"]) {
    el(id).min = edicao.primeira_data;
    el(id).max = edicao.ultima_data;
  }
  trilhaRodadas?.definir({ de: form.rodadaDe, ate: form.rodadaAte });
  trilhaUltimos?.definir({ ultimos: form.ultimos });
  pintarTurno();
  el("data-de").value = form.dataDe;
  el("data-ate").value = form.dataAte;
}

function lerRecorte() {
  estado.form = {
    ...estado.form,
    dataDe: el("data-de").value, dataAte: el("data-ate").value,
  };
  aplicar();
}

function limparRecorte() {
  estado.form = {
    rodadaDe: 1, rodadaAte: estado.edicao.rodadas,
    ultimos: estado.edicao.rodadas, dataDe: "", dataAte: "",
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
  // `ultimos` age por último e por clube: os X jogos mais recentes de cada um
  // entre os que sobraram dos outros filtros. No fim da trilha não corta nada.
  if (form.ultimos < edicao.rodadas) filtros.ultimos = form.ultimos;

  estado.classificacao = tabela(jogos, clubesDaEdicao(jogos), filtros, descontos());
  estado.recorte = filtros;
  resumir(filtros);
  atualizarUrl();
  redesenhar();
}

function resumir(filtros) {
  const cortado = Object.keys(filtros).length > 0;
  // Com "últimos X" o jogo de um clube pode não ser o jogo do adversário, e
  // somar participações e dividir por dois daria meio jogo. Nesse recorte o
  // que se conta é por equipe.
  el("resumo-recorte").textContent = !cortado
    ? `edição inteira · ${estado.edicao.realizados} de ${estado.edicao.jogos} jogos disputados`
    : filtros.ultimos
      ? `últimos ${filtros.ultimos} jogos de cada equipe`
        + ` · ${participacoesNoRecorte()} participações`
      : `${jogosNoRecorte()} jogos no recorte`;
  el("limpar").hidden = !cortado;
}

const participacoesNoRecorte = () =>
  estado.classificacao.reduce((soma, c) => soma + c.j, 0);

const jogosNoRecorte = () => participacoesNoRecorte() / 2;

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
    ultimos: inteiro("ultimos"),
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
