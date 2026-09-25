/**
 * Página do card de FMI.
 *
 * Fora do card só a série, a edição e o clube em destaque — e o destaque também
 * se escolhe clicando na barra, que é o gesto natural quando a pergunta nasce
 * olhando o gráfico.
 *
 * As duas classificações por mando saem do mesmo motor, com o filtro trocado;
 * a conversão dos jogos para partidas fica aqui, para o módulo do índice viver
 * sem `import` e ser carregado pelos testes no Node.
 */
import {
  clubesDaEdicao, tabela, RODADA, DATA, MANDANTE, VISITANTE, GOLS_M, GOLS_V,
  STATUS,
} from "/js/motor.js";
import {
  aoMudarTapetao, descontosDe,
} from "/js/tapetao.js";
import {
  equipeLembrada, lembrarEquipe, lembrarSerie, serieLembrada,
} from "/js/preferencias.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_fmi.js";
import { nomeComUf } from "/js/nomes.js";

const estado = {
  edicoes: [], clubes: {},
  serie: null, edicao: null, partidas: [],
  casa: [], fora: [], classificacao: [],
  destaque: "",
  aoEscolher: (equipe) => escolherDestaque(equipe),
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
  el("destaque").addEventListener("change", () => {
    estado.destaque = lembrarEquipe(el("destaque").value);
    aplicar();
  });

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
  const clubes = clubesDaEdicao(jogos);
  Object.assign(estado, {
    edicao,
    partidas: converter(jogos),
    classificacao: tabela(jogos, clubes, {}, descontos()),
    casa: tabela(jogos, clubes, { mando: "casa" }, descontos()),
    fora: tabela(jogos, clubes, { mando: "fora" }, descontos()),
  });

  el("destaque").innerHTML = '<option value="">nenhuma</option>'
    + clubes.map((c) => `<option value="${c}">${nomeComUf(c)}</option>`).join("");
  const querido = url.destaque ?? estado.destaque ?? equipeLembrada();
  estado.destaque = clubes.includes(querido) ? querido : "";
  el("destaque").value = estado.destaque;

  aplicar();
}

/** Clicar no clube que já está aberto fecha o detalhe: é o mesmo gesto. */
function escolherDestaque(equipe) {
  estado.destaque = estado.destaque === equipe ? "" : equipe;
  el("destaque").value = estado.destaque;
  aplicar();
}

function aplicar() {
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
  return { serie: p.get("serie"), ano: p.get("ano"), destaque: p.get("destaque") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.edicao) p.set("ano", estado.edicao.apelido);
  if (estado.destaque) p.set("destaque", estado.destaque);
  history.replaceState(null, "", `#${p}`);
}
