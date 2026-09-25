/**
 * Página do card de jogos.
 *
 * Fora do card só a série e o ano: a rodada que a lista mostra não é filtro de
 * tela, é escolha feita no próprio gráfico — clicar na coluna de uma rodada
 * troca a lista de baixo. Ela abre na última rodada que já teve jogo, que é
 * onde o interesse costuma estar.
 *
 * A conversão do formato cru para partidas acontece aqui, e não no módulo de
 * calendário: é o que deixa `jogos_rodada.js` viver sem `import` nenhum e ser
 * carregado pelos testes no Node.
 */
import {
  clubesDaEdicao, tabela, RODADA, DATA, MANDANTE, VISITANTE, GOLS_M, GOLS_V,
  STATUS,
} from "/js/motor.js";
import {
  aoMudarTapetao, descontosDe,
} from "/js/tapetao.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_jogos.js";
import { rodadaCorrente } from "/js/jogos_rodada.js";

const estado = {
  edicoes: [], clubes: {},
  serie: null, edicao: null, partidas: [], classificacao: [],
  rodada: 1,
  aoEscolherRodada: (rodada) => escolherRodada(rodada),
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
  definirMensagemSemCard("escolha uma edição para desenhar o card");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [edicoes, clubes] = await Promise.all([
    fetch("/dados/edicoes.json").then((r) => r.json()),
    fetch("/dados/clubes.json").then((r) => r.json()),
  ]);
  Object.assign(estado, { edicoes: edicoes.edicoes, clubes });

  montarChaves("serie",
    [...new Set(estado.edicoes.map((e) => e.serie))].sort()
      .map((s) => ({ valor: s, rotulo: `Série ${s}` })),
    (valor) => trocarSerie(valor));

  el("ano").addEventListener("change", () => trocarAno(el("ano").value));
  el("rodada").addEventListener("input", () => {
    escolherRodada(Number(el("rodada").value));
  });

  const url = daUrl();
  await trocarSerie(url.serie ?? "A", url);
}

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

  const anos = estado.edicoes.filter((e) => e.serie === serie);
  el("ano").innerHTML = anos
    .map((e) => `<option value="${e.apelido}">${e.ano}</option>`).join("");

  const desejado = url.ano ?? estado.edicao?.apelido;
  const escolhido = anos.some((e) => e.apelido === desejado)
    ? desejado : anos[0].apelido;
  await trocarAno(escolhido, url);
}

/**
 * Do formato cru para partidas.
 *
 * Um jogo só conta como realizado quando tem placar dos dois lados: o status
 * sozinho já apareceu marcado sem gols, e aí o card mostraria um "0 × 0" que
 * nunca aconteceu.
 */
const converter = (jogos) => jogos.map((j) => {
  const feito = j[STATUS] === "realizado"
    && j[GOLS_M] !== null && j[GOLS_V] !== null;
  return {
    rodada: j[RODADA],
    data: j[DATA],
    mandante: j[MANDANTE],
    visitante: j[VISITANTE],
    realizado: feito,
    gp: feito ? j[GOLS_M] : null,
    gc: feito ? j[GOLS_V] : null,
  };
});

async function trocarAno(apelido, url = {}) {
  const edicao = estado.edicoes.find((e) => e.apelido === apelido);
  if (!edicao) return;
  el("ano").value = apelido;

  const jogos = await fetch(`/dados/jogos/${apelido}.json`).then((r) => r.json());
  const partidas = converter(jogos);
  Object.assign(estado, {
    edicao, partidas,
    classificacao: tabela(jogos, clubesDaEdicao(jogos), {}, descontos()),
  });

  el("rodada").max = edicao.rodadas;
  // A rodada da URL só vale se existir naquela edição; senão, a corrente.
  const querida = url.rodada && url.rodada <= edicao.rodadas
    ? url.rodada : rodadaCorrente(partidas);
  escolherRodada(querida);
}

function escolherRodada(rodada) {
  estado.rodada = Math.min(Math.max(1, rodada), estado.edicao?.rodadas ?? 38);
  el("rodada").value = estado.rodada;
  el("valor-rodada").textContent = `${estado.rodada}ª`;
  aplicar();
}

function aplicar() {
  resumir();
  atualizarUrl();
  redesenhar();
}

function resumir() {
  const { edicao } = estado;
  el("rodape-edicao").textContent = edicao
    ? `Série ${estado.serie} ${edicao.ano} · ${edicao.realizados} de `
      + `${edicao.jogos} jogos disputados`
    : "";
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  const rodada = Number(p.get("rodada"));
  return {
    serie: p.get("serie"), ano: p.get("ano"),
    rodada: Number.isInteger(rodada) && rodada > 0 ? rodada : null,
  };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.edicao) p.set("ano", estado.edicao.apelido);
  p.set("rodada", estado.rodada);
  history.replaceState(null, "", `#${p}`);
}
