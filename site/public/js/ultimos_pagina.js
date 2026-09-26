/**
 * Página do card de últimos X jogos.
 *
 * Fora do card só a série e a edição: a tela é sobre um campeonato inteiro
 * lido em onze profundidades, e qualquer outro filtro seria um recorte dentro
 * do recorte. O clube em destaque não se escolhe em lista — clica-se nele em
 * qualquer das colunas, que é onde o olho já está.
 *
 * As onze classificações saem do mesmo motor, mudando só o `ultimos`: é o
 * filtro que pega os X jogos mais recentes **de cada clube**, na ordem
 * cronológica, e é por isso que ele responde por fase e não por rodada.
 */
import { clubesDaEdicao, tabela } from "/js/motor.js";
import { aoMudarTapetao, descontosDe } from "/js/tapetao.js";
import {
  equipeLembrada, lembrarEquipe, lembrarSerie, serieLembrada,
} from "/js/preferencias.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_ultimos.js";
import { jogosDaEdicao, recortesDeUltimos } from "/js/ultimos.js";

const estado = {
  edicoes: [], clubes: {},
  serie: null, edicao: null, jogos: null, colunas: [], destaque: "",
  aoEscolher: (equipe) => escolherDestaque(equipe),
};

// Os descontos de tapetão da edição em foco, vazios quando a chave está
// desligada. É o mesmo ajudante em todas as páginas que montam tabela.
const descontos = () =>
  descontosDe(estado.serie, estado.edicao?.ano ?? estado.ano);

const el = (id) => document.getElementById(id);
let redesenhar = () => {};

// Virar a chave do tapetão muda a tabela cheia: as colunas se refazem.
aoMudarTapetao(() => montarColunas());

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("esta edição ainda não tem jogos para recortar");
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

  const url = daUrl();
  await trocarSerie(url.serie ?? serieLembrada() ?? "A", url);
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
  lembrarSerie(estado.serie);
  pintarChaves("serie", serie);

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

  // O destaque é por clube, e um clube não joga toda edição.
  const querido = url.destaque ?? estado.destaque ?? equipeLembrada();
  const clubes = clubesDaEdicao(jogos);
  estado.destaque = clubes.includes(querido) ? querido : "";

  montarColunas();
}

/**
 * As onze classificações.
 *
 * A cheia leva o tapetão, como toda tabela do BI. Os recortes não: punição de
 * tribunal não é ponto de jogo, e descontá-la de uma coluna de três jogos
 * diria que o clube jogou pior do que jogou.
 */
function montarColunas() {
  const { jogos } = estado;
  if (!jogos) return;

  const clubes = clubesDaEdicao(jogos);
  const cheia = tabela(jogos, clubes, {}, descontos());
  const recortes = recortesDeUltimos(jogosDaEdicao(cheia));

  estado.colunas = [
    ...recortes.map((n) => ({ n, tabela: tabela(jogos, clubes, { ultimos: n }) })),
    { n: null, tabela: cheia },
  ];
  aplicar();
}

/** Clicar no clube que já está em destaque tira o destaque: é o mesmo gesto. */
function escolherDestaque(equipe) {
  estado.destaque = estado.destaque === equipe ? "" : equipe;
  if (estado.destaque) lembrarEquipe(estado.destaque);
  aplicar();
}

function aplicar() {
  const { edicao, colunas } = estado;
  const recortes = colunas.length - 1;
  el("rodape-edicao").textContent = edicao
    ? `Série ${estado.serie} ${edicao.ano} · ${edicao.realizados} de `
      + `${edicao.jogos} jogos disputados · ${recortes} `
      + `${recortes === 1 ? "recorte" : "recortes"} além da tabela cheia`
    : "";
  atualizarUrl();
  redesenhar();
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  return { serie: p.get("serie"), ano: p.get("ano"), destaque: p.get("destaque") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.edicao) p.set("ano", estado.edicao.apelido);
  if (estado.destaque) p.set("destaque", estado.destaque);
  history.replaceState(null, "", `#${p}`);
}
