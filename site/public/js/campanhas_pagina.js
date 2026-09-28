/**
 * Página do ranking histórico de campanhas.
 *
 * É a tela com mais filtros do BI, e por um motivo: o ranking é sempre o mesmo
 * — todas as campanhas de uma série, ordenadas por pontos — e tudo o que
 * interessa está em *quais* campanhas entram e *qual pedaço* delas conta. Cada
 * filtro aqui é uma pergunta diferente feita com a mesma lista.
 *
 * O título do card conta o recorte por extenso. "Melhores campanhas" e
 * "melhores campanhas nos 10 primeiros jogos fora de casa" são rankings
 * diferentes, e o card sai publicado sem os filtros do lado.
 *
 * A paginação fica fora do card porque é navegação, e não dado: o card é uma
 * página do ranking, e qual delas é escolha de quem está olhando.
 *
 * Acender um clube dentro do card não é filtrar: as outras campanhas
 * continuam todas lá, e é delas que vem a medida de onde as dele caem. Quem
 * quer só um clube tem o filtro de equipe, aqui fora.
 */
import { aoMudarTapetao, tapetaoLigado, descontosDe } from "/js/tapetao.js";
import { lembrarSerie, serieLembrada } from "/js/preferencias.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_campanhas.js";
import { ligarTrilha, ligarSeletorDeRodadas } from "/js/seletor_posicoes.js";
import { artigo, nomeBonito, nomeComUf } from "/js/nomes.js";
import {
  anosDaSerie, montarRanking, paginas,
} from "/js/campanhas_historicas.js";

const POSICOES = 20;

const estado = {
  dados: null, clubes: {}, serie: null,
  anos: [], deAno: null, ateAno: null,
  porRodada: true, de: 1, ate: 38, etapas: 38,
  mando: "todos", ordem: "melhor",
  posicaoDe: 1, posicaoAte: POSICOES,
  regiao: "", uf: "", equipe: "",
  paginaAtual: 1, ranking: [], semTapetao: false,
  titulo: "", destaque: "",
  aoDestacar: (equipe) => {
    // Clicar no clube já aceso apaga: é o mesmo gesto, e sem isso só o botão
    // de limpar desfaria o que um clique fez.
    estado.destaque = estado.destaque === equipe ? "" : equipe;
    aplicar();
  },
};

const el = (id) => document.getElementById(id);
let redesenhar = () => {};
let trilhaAnos = null;
let trilhaEtapas = null;
let trilhaPosicoes = null;

aoMudarTapetao(() => aplicar());

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("nenhuma campanha sobrou com estes filtros");
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
  montarChaves("mando", [["todos", "Casa e fora"], ["casa", "Só em casa"],
                         ["fora", "Só fora"]],
    (v) => { estado.mando = v; aplicar(); });
  montarChaves("ordem", [["melhor", "Melhores"], ["pior", "Piores"]],
    (v) => { estado.ordem = v; estado.paginaAtual = 1; aplicar(); });

  for (const id of ["regiao", "uf", "equipe"]) {
    el(id).addEventListener("change", () => {
      estado[id === "uf" ? "uf" : id] = el(id).value;
      // Escolher uma região limpa o estado e a equipe que já não cabem nela.
      if (id === "regiao") { estado.uf = ""; estado.equipe = ""; }
      if (id === "uf") estado.equipe = "";
      escreverListasDeClube();
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

  // A trilha anda em anos, e não em posições: é o ano que está escrito na
  // alça e nas marcas, e é ele que se procura. Os limites saem dos dados, de
  // modo que a régua cresce sozinha quando entra uma edição nova.
  trilhaAnos = ligarTrilha({
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

  // O teto do recorte é a edição mais longa da série: uma régua do tamanho da
  // mais curta esconderia o fim das outras.
  estado.etapas = Math.max(...estado.anos.map((ano) => {
    const edicao = estado.dados.series[serie][String(ano)];
    return Math.max(...(edicao.rodadas ?? [[0]]).map((r) => r.length ? r[r.length - 1] : 0));
  }), 38);
  estado.de = 1;
  estado.ate = estado.etapas;
  trilhaEtapas = ligarSeletorDeRodadas({
    raiz: el("etapas"), total: estado.etapas, de: 1, ate: estado.etapas,
    aoMudar: ({ de, ate }) => {
      Object.assign(estado, { de, ate, paginaAtual: 1 });
      aplicar();
    },
  });

  trilhaPosicoes = ligarTrilha({
    raiz: el("posicoes"), total: POSICOES, crescente: true, minimo: 1,
    descrever: (v) => `${v}º lugar`,
    alcas: [
      { nome: "de", classe: "alca-melhor", valor: 1,
        descricao: "melhor posição final do recorte" },
      { nome: "ate", classe: "alca-meta", valor: POSICOES,
        descricao: "pior posição final do recorte" },
    ],
    aoMudar: ({ de, ate }) => {
      Object.assign(estado, { posicaoDe: de, posicaoAte: ate, paginaAtual: 1 });
      aplicar();
    },
  });

  Object.assign(estado, { regiao: "", uf: "", equipe: "", paginaAtual: 1 });
  escreverListasDeClube();
  aplicar();
}

/** Todos os clubes que a série já teve, em ordem alfabética pelo nome bonito. */
function clubesDaSerie() {
  const nomes = new Set();
  for (const ano of estado.anos) {
    for (const nome of estado.dados.series[estado.serie][String(ano)].clubes) {
      nomes.add(nome);
    }
  }
  return [...nomes].sort((a, b) => nomeComUf(a).localeCompare(nomeComUf(b), "pt-BR"));
}

/**
 * As três listas encaixadas: região, estado e equipe.
 *
 * Cada uma filtra a seguinte. Escolher o Nordeste e depois abrir a lista de
 * equipes com os setenta clubes da série de volta seria fazer o trabalho duas
 * vezes.
 */
function escreverListasDeClube() {
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

  const daUf = daRegiao.filter((n) => !estado.uf || ficha(n).estado === estado.uf);
  el("equipe").innerHTML = '<option value="">todas</option>'
    + daUf.map((n) => `<option value="${n}">${nomeComUf(n)}</option>`).join("");
  el("equipe").value = estado.equipe;
}

/** O conjunto de clubes que passa no filtro, ou `null` quando é todo mundo. */
function equipesEscolhidas() {
  if (estado.equipe) return new Set([estado.equipe]);
  if (!estado.regiao && !estado.uf) return null;
  const ficha = (nome) => estado.clubes[nome] ?? {};
  return new Set(clubesDaSerie().filter((n) =>
    (!estado.regiao || ficha(n).regiao === estado.regiao)
    && (!estado.uf || ficha(n).estado === estado.uf)));
}

/* --------------------------------------------------------------- título */
/**
 * O recorte por extenso, para o card dizer sozinho o que está mostrando.
 *
 * O clube entra colado no substantivo — "as melhores campanhas do Bahia na
 * Série A" —, e não no fim da frase: é dele que o ranking passa a falar, e
 * pendurar o nome depois de todos os recortes faria a frase dizer que o
 * assunto é a série.
 */
function tituloDoRanking() {
  const partes = [estado.ordem === "pior" ? "As piores campanhas"
                                          : "As melhores campanhas"];

  // "As melhores campanhas do Bahia na Série A", mas "as melhores campanhas
  // da Série A" quando não há clube: sem ele a série é o complemento do
  // substantivo, e com ele passa a ser o lugar onde a campanha aconteceu.
  if (estado.equipe) {
    partes.push(`${artigo(estado.equipe)} ${nomeBonito(estado.equipe)}`,
                `na Série ${estado.serie}`);
  } else {
    partes.push(`da Série ${estado.serie}`);
  }

  if (!estado.equipe && estado.uf) {
    partes.push(`entre as equipes ${preposicao(estado.uf)}`);
  } else if (!estado.equipe && estado.regiao) {
    partes.push(`entre as equipes do ${estado.regiao}`);
  }

  if (estado.deAno !== estado.anos[0]
      || estado.ateAno !== estado.anos[estado.anos.length - 1]) {
    partes.push(estado.deAno === estado.ateAno
      ? `em ${estado.deAno}` : `de ${estado.deAno} a ${estado.ateAno}`);
  }

  if (estado.mando !== "todos") {
    partes.push(estado.mando === "casa" ? "em casa" : "fora de casa");
  }

  if (estado.de !== 1 || estado.ate !== estado.etapas) {
    if (estado.porRodada) {
      partes.push(estado.de === estado.ate
        ? `só na ${estado.de}ª rodada` : `da ${estado.de}ª à ${estado.ate}ª rodada`);
    } else {
      partes.push(estado.de === 1
        ? `nos ${estado.ate} primeiros jogos`
        : `do ${estado.de}º ao ${estado.ate}º jogo`);
    }
  }

  if (estado.posicaoDe !== 1 || estado.posicaoAte !== POSICOES) {
    partes.push(estado.posicaoDe === estado.posicaoAte
      ? `entre as que terminaram em ${estado.posicaoDe}º`
      : `entre as que terminaram do ${estado.posicaoDe}º ao ${estado.posicaoAte}º`);
  }

  return partes.join(" ");
}

const preposicao = (uf) => `de ${uf}`;

/* -------------------------------------------------------------- páginas */
function virar(passo) {
  const quantas = paginas(estado.ranking.length);
  estado.paginaAtual = Math.min(Math.max(1, estado.paginaAtual + passo), quantas);
  aplicar();
}

function aplicar() {
  estado.semTapetao = !tapetaoLigado();
  pintarChaves("serie", estado.serie);
  pintarChaves("recorte", estado.porRodada ? "rodada" : "jogo");
  pintarChaves("mando", estado.mando);
  pintarChaves("ordem", estado.ordem);

  estado.ranking = montarRanking(estado.dados, {
    serie: estado.serie,
    deAno: estado.deAno, ateAno: estado.ateAno,
    porRodada: estado.porRodada, de: estado.de, ate: estado.ate,
    mando: estado.mando, ordem: estado.ordem,
    posicaoDe: estado.posicaoDe,
    // Alça no último lugar é "qualquer posição", e é o que deixa a edição em
    // andamento — que ainda não terminou em lugar nenhum — entrar no ranking.
    posicaoAte: estado.posicaoAte >= POSICOES ? Infinity : estado.posicaoAte,
    equipes: equipesEscolhidas(),
    semTapetao: estado.semTapetao,
    descontosDoAno: (ano) => descontosDe(estado.serie, ano),
  });

  const quantas = paginas(estado.ranking.length);
  estado.paginaAtual = Math.min(Math.max(1, estado.paginaAtual), quantas);
  estado.titulo = tituloDoRanking();

  // Clube aceso que sumiu do recorte deixa de estar aceso: manter o destaque
  // num clube que não aparece em lugar nenhum é prometer uma marca invisível.
  const acesas = estado.ranking.filter((c) => c.equipe === estado.destaque);
  if (estado.destaque && !acesas.length) estado.destaque = "";
  el("limpar-destaque").hidden = !estado.destaque;
  el("resumo-destaque").textContent = estado.destaque
    ? `${nomeBonito(estado.destaque)} em destaque · `
      + `${acesas.length} ${acesas.length === 1 ? "campanha" : "campanhas"}`
      + `, ${acesas[0].posicao}º a ${acesas[acesas.length - 1].posicao}º`
    : "";

  const barra = el("pagina");
  barra.max = String(quantas);
  barra.value = String(estado.paginaAtual);
  barra.disabled = quantas === 1;
  el("anterior").disabled = estado.paginaAtual === 1;
  el("proxima").disabled = estado.paginaAtual === quantas;
  el("resumo-pagina").textContent = estado.ranking.length
    ? `página ${estado.paginaAtual} de ${quantas} · ${estado.ranking.length} campanhas`
    : "";

  el("resumo-edicoes").textContent = `${estado.deAno} a ${estado.ateAno}`;
  el("resumo-etapas").textContent = estado.porRodada
    ? `da ${estado.de}ª à ${estado.ate}ª rodada`
    : `do ${estado.de}º ao ${estado.ate}º jogo de cada campanha`;
  el("resumo-posicoes").textContent = estado.posicaoDe === 1
    && estado.posicaoAte === POSICOES
    ? "qualquer posição final"
    : `terminaram do ${estado.posicaoDe}º ao ${estado.posicaoAte}º`;

  redesenhar();
}
