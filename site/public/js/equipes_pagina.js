/**
 * Página do ranking por equipes.
 *
 * É o ranking de campanhas somado por outra chave: lá a linha é um clube num
 * ano, aqui é o clube inteiro. Por isso não há filtro de equipe nem de posição
 * final — a equipe é o eixo da tela, e o desfecho de uma edição não diz nada
 * sobre uma soma de vinte e uma.
 *
 * Região e estado continuam, porque eles não escolhem uma linha: recortam o
 * conjunto que vai ser ranqueado, que é outra coisa.
 */
import { aoMudarTapetao, tapetaoLigado, descontosDe } from "/js/tapetao.js";
import { lembrarSerie, serieLembrada } from "/js/preferencias.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_equipes.js";
import { ligarTrilha, ligarSeletorDeRodadas } from "/js/seletor_posicoes.js";
import { nomeBonito } from "/js/nomes.js";
import {
  POR_PAGINA_EQUIPES, anosDaSerie, montarRankingDeEquipes, paginas,
} from "/js/campanhas_historicas.js";

const estado = {
  dados: null, clubes: {}, serie: null,
  anos: [], deAno: null, ateAno: null,
  porRodada: true, de: 1, ate: 38, etapas: 38,
  regiao: "", uf: "",
  paginaAtual: 1, ranking: [], semTapetao: false,
  titulo: "", nota: "", destaque: "",
  aoDestacar: (equipe) => {
    estado.destaque = estado.destaque === equipe ? "" : equipe;
    aplicar();
  },
};

const el = (id) => document.getElementById(id);
let redesenhar = () => {};

aoMudarTapetao(() => aplicar());

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("nenhuma equipe sobrou com estes filtros");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [dados, clubes] = await Promise.all([
    fetch("/dados/campanhas_jogos.json").then((r) => r.json()),
    fetch("/dados/clubes.json").then((r) => r.json()),
  ]);
  Object.assign(estado, { dados, clubes });

  montarChaves("serie", Object.keys(dados.series ?? {}).sort()
    .map((s) => [s, `Série ${s}`]), (v) => trocarSerie(v));
  montarChaves("recorte", [["rodada", "Por rodada"],
                           ["jogo", "Por ordem dos jogos"]],
    (v) => { estado.porRodada = v === "rodada"; aplicar(); });

  for (const id of ["regiao", "uf"]) {
    el(id).addEventListener("change", () => {
      estado[id] = el(id).value;
      if (id === "regiao") estado.uf = "";
      escreverListas();
      estado.paginaAtual = 1;
      aplicar();
    });
  }

  el("pagina").addEventListener("input", () => {
    estado.paginaAtual = Number(el("pagina").value);
    aplicar();
  });
  el("anterior").addEventListener("click", () => virar(-1));
  el("proxima").addEventListener("click", () => virar(1));
  el("limpar-destaque").addEventListener("click", () => {
    estado.destaque = "";
    aplicar();
  });

  trocarSerie(serieLembrada() ?? "A");
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

function pintarChaves(id, escolhido) {
  for (const botao of el(id).children) {
    botao.setAttribute("aria-pressed", String(botao.dataset.valor === escolhido));
  }
}

/* -------------------------------------------------------------- filtros */
function trocarSerie(serie) {
  estado.serie = serie;
  lembrarSerie(serie);
  estado.anos = anosDaSerie(estado.dados, serie);
  estado.deAno = estado.anos[0];
  estado.ateAno = estado.anos[estado.anos.length - 1];

  ligarTrilha({
    raiz: el("edicoes"), crescente: true,
    minimo: estado.anos[0], total: estado.anos[estado.anos.length - 1],
    descrever: (v) => `edição de ${v}`,
    alcas: [
      { nome: "de", classe: "alca-meta", valor: estado.deAno,
        descricao: "primeira edição do recorte" },
      { nome: "ate", classe: "alca-melhor", valor: estado.ateAno,
        descricao: "última edição do recorte" },
    ],
    aoMudar: ({ de, ate }) => {
      Object.assign(estado, { deAno: de, ateAno: ate, paginaAtual: 1 });
      aplicar();
    },
  });

  estado.etapas = Math.max(38, ...estado.anos.map((ano) => {
    const edicao = estado.dados.series[serie][String(ano)];
    return Math.max(0, ...(edicao.rodadas ?? [])
      .map((r) => (r.length ? r[r.length - 1] : 0)));
  }));
  estado.de = 1;
  estado.ate = estado.etapas;
  ligarSeletorDeRodadas({
    raiz: el("etapas"), total: estado.etapas, de: 1, ate: estado.etapas,
    aoMudar: ({ de, ate }) => {
      Object.assign(estado, { de, ate, paginaAtual: 1 });
      aplicar();
    },
  });

  Object.assign(estado, { regiao: "", uf: "", paginaAtual: 1, destaque: "" });
  escreverListas();
  aplicar();
}

/** Todos os clubes que a série já teve. */
function clubesDaSerie() {
  const nomes = new Set();
  for (const ano of estado.anos) {
    for (const nome of estado.dados.series[estado.serie][String(ano)].clubes) {
      nomes.add(nome);
    }
  }
  return [...nomes];
}

function escreverListas() {
  const todos = clubesDaSerie();
  const ficha = (nome) => estado.clubes[nome] ?? {};

  const regioes = [...new Set(todos.map((n) => ficha(n).regiao).filter(Boolean))].sort();
  el("regiao").innerHTML = '<option value="">todas</option>'
    + regioes.map((r) => `<option value="${r}">${r}</option>`).join("");
  el("regiao").value = estado.regiao;

  const daRegiao = todos.filter((n) => !estado.regiao || ficha(n).regiao === estado.regiao);
  const ufs = [...new Set(daRegiao.map((n) => ficha(n).estado).filter(Boolean))].sort();
  el("uf").innerHTML = '<option value="">todos</option>'
    + ufs.map((u) => `<option value="${u}">${u}</option>`).join("");
  el("uf").value = estado.uf;
}

/** O conjunto de clubes do recorte, ou `null` quando é todo mundo. */
function equipesEscolhidas() {
  if (!estado.regiao && !estado.uf) return null;
  const ficha = (nome) => estado.clubes[nome] ?? {};
  return new Set(clubesDaSerie().filter((n) =>
    (!estado.regiao || ficha(n).regiao === estado.regiao)
    && (!estado.uf || ficha(n).estado === estado.uf)));
}

/* --------------------------------------------------------------- título */
function tituloDoRanking() {
  const partes = ["As equipes que mais pontuaram", `na Série ${estado.serie}`];

  if (estado.uf) partes.push(`entre as de ${estado.uf}`);
  else if (estado.regiao) partes.push(`entre as do ${estado.regiao}`);

  if (estado.deAno !== estado.anos[0]
      || estado.ateAno !== estado.anos[estado.anos.length - 1]) {
    partes.push(estado.deAno === estado.ateAno
      ? `em ${estado.deAno}` : `de ${estado.deAno} a ${estado.ateAno}`);
  }

  if (estado.de !== 1 || estado.ate !== estado.etapas) {
    if (estado.porRodada) {
      partes.push(estado.de === estado.ate
        ? `só na ${estado.de}ª rodada` : `da ${estado.de}ª à ${estado.ate}ª rodada`);
    } else {
      partes.push(estado.de === 1
        ? `nos ${estado.ate} primeiros jogos de cada edição`
        : `do ${estado.de}º ao ${estado.ate}º jogo de cada edição`);
    }
  }
  return partes.join(" ");
}

function notaDoRanking() {
  return "A soma junta todas as edições do recorte, e por isso vêm junto as "
       + "edições, os jogos e o aproveitamento: quem participou mais soma mais "
       + "sem ter sido melhor.";
}

/* -------------------------------------------------------------- páginas */
function virar(passo) {
  const quantas = paginas(estado.ranking.length, POR_PAGINA_EQUIPES);
  estado.paginaAtual = Math.min(Math.max(1, estado.paginaAtual + passo), quantas);
  aplicar();
}

function aplicar() {
  estado.semTapetao = !tapetaoLigado();
  pintarChaves("serie", estado.serie);
  pintarChaves("recorte", estado.porRodada ? "rodada" : "jogo");

  estado.ranking = montarRankingDeEquipes(estado.dados, {
    serie: estado.serie,
    deAno: estado.deAno, ateAno: estado.ateAno,
    porRodada: estado.porRodada, de: estado.de, ate: estado.ate,
    equipes: equipesEscolhidas(),
    semTapetao: estado.semTapetao,
    descontosDoAno: (ano) => descontosDe(estado.serie, ano),
  });

  const quantas = paginas(estado.ranking.length, POR_PAGINA_EQUIPES);
  estado.paginaAtual = Math.min(Math.max(1, estado.paginaAtual), quantas);
  estado.titulo = tituloDoRanking();
  estado.nota = notaDoRanking();

  const aceso = estado.ranking.find((e) => e.equipe === estado.destaque);
  if (estado.destaque && !aceso) estado.destaque = "";
  el("limpar-destaque").hidden = !estado.destaque;
  el("resumo-destaque").textContent = aceso
    ? `${nomeBonito(aceso.equipe)} em destaque · ${aceso.posicao}º com `
      + `${aceso.pontos} pontos`
    : "";

  const barra = el("pagina");
  barra.max = String(quantas);
  barra.value = String(estado.paginaAtual);
  barra.disabled = quantas === 1;
  el("anterior").disabled = estado.paginaAtual === 1;
  el("proxima").disabled = estado.paginaAtual === quantas;
  el("resumo-pagina").textContent = estado.ranking.length
    ? `${estado.ranking.length} clubes`
      + `${quantas > 1 ? ` · página ${estado.paginaAtual} de ${quantas}` : ""}`
    : "";

  el("resumo-edicoes").textContent = `${estado.deAno} a ${estado.ateAno}`;
  el("resumo-etapas").textContent = estado.porRodada
    ? `da ${estado.de}ª à ${estado.ate}ª rodada`
    : `do ${estado.de}º ao ${estado.ate}º jogo de cada campanha`;

  redesenhar();
}
