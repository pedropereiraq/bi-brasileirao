/**
 * Página do card de média móvel.
 *
 * Fora do card: a leitura — pontos por jogo ou aproveitamento —, a série, a
 * edição, a equipe, o tamanho da janela e as duas posições que viram régua.
 *
 * As réguas saem da mesma grade que alimenta a tela de médias por posição: a
 * média de pontos com que cada posição termina a série, dividida pelas
 * rodadas. É o que põe a fase de hoje na mesma unidade de um destino — "neste
 * ritmo, dá G4".
 */
import {
  RODADA, DATA, MANDANTE, VISITANTE, GOLS_M, GOLS_V, STATUS, clubesDaEdicao,
} from "/js/motor.js";
import { aoMudarTapetao, tapetaoLigado } from "/js/tapetao.js";
import {
  equipeLembrada, lembrarEquipe, lembrarSerie, serieLembrada,
} from "/js/preferencias.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_media_movel.js";
import { campanhaCompleta } from "/js/grafico_campanha.js";
import {
  ligarSeletorDePosicoes, ligarTrilha,
} from "/js/seletor_posicoes.js";
import { estatisticasPorPosicao, grade } from "/js/media_posicao.js";
import { referenciaDaPosicao } from "/js/media_movel.js";
import { COR } from "/js/cartao.js";
import { nomeComUf } from "/js/nomes.js";

const PADRAO = { melhor: 4, pior: 17 };

const estado = {
  edicoes: [], clubes: {}, posicoes: null,
  serie: null, edicao: null, jogos: null, equipe: "", campanha: [],
  modo: "pontuacao", janela: 5, faixa: { ...PADRAO }, referencias: [],
};

const el = (id) => document.getElementById(id);
let redesenhar = () => {};
let trilhaJanela = null;

// A chave do tapetão troca a grade das réguas: elas se refazem junto.
aoMudarTapetao(() => aplicar());

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("escolha uma equipe com jogos suficientes para a janela");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [edicoes, clubes, posicoes] = await Promise.all([
    fetch("/dados/edicoes.json").then((r) => r.json()),
    fetch("/dados/clubes.json").then((r) => r.json()),
    fetch("/dados/posicoes.json").then((r) => r.json()),
  ]);
  Object.assign(estado, { edicoes: edicoes.edicoes, clubes, posicoes });

  const url = daUrl();
  if (url.modo === "aproveitamento" || url.modo === "pontuacao") {
    estado.modo = url.modo;
  }
  if (url.janela) estado.janela = url.janela;
  estado.faixa = {
    melhor: url.melhor ?? PADRAO.melhor,
    pior: url.pior ?? PADRAO.pior,
  };

  montarChaves("modo", [
    ["pontuacao", "Pontos por jogo"], ["aproveitamento", "Aproveitamento"],
  ], (valor) => { estado.modo = valor; aplicar(); });

  montarChaves("serie",
    [...new Set(estado.edicoes.map((e) => e.serie))].sort()
      .map((s) => [s, `Série ${s}`]),
    (valor) => trocarSerie(valor));

  el("ano").addEventListener("change", () => trocarAno(el("ano").value));
  el("equipe").addEventListener("change", () => {
    estado.equipe = lembrarEquipe(el("equipe").value);
    trocarEquipe(estado.equipe);
  });

  ligarSeletorDePosicoes({
    raiz: el("posicoes"),
    pior: estado.faixa.pior, melhor: estado.faixa.melhor,
    aoMudar: ({ pior, melhor }) => { estado.faixa = { pior, melhor }; aplicar(); },
  });

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

function pintarChaves(id, escolhido) {
  for (const botao of el(id).children) {
    botao.setAttribute("aria-pressed", String(botao.dataset.valor === escolhido));
  }
}

async function trocarSerie(serie, url = {}) {
  estado.serie = serie;
  lembrarSerie(serie);
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
  const clubes = clubesDaEdicao(jogos);
  Object.assign(estado, { edicao, jogos });

  el("equipe").innerHTML = clubes
    .map((c) => `<option value="${c}">${nomeComUf(c)}</option>`).join("");
  const querida = url.equipe ?? estado.equipe ?? equipeLembrada();
  estado.equipe = clubes.includes(querida) ? querida : clubes[0];
  el("equipe").value = estado.equipe;

  trocarEquipe(estado.equipe, url);
}

function trocarEquipe(equipe, url = {}) {
  estado.campanha = campanhaCompleta(estado.jogos, equipe);

  // A janela nunca passa do que o clube já jogou: pedir vinte jogos a quem fez
  // oito devolveria um gráfico vazio em vez de uma resposta.
  const disputados = estado.campanha.filter((p) => p.realizado).length;
  montarTrilhaDaJanela(Math.max(1, disputados), url.janela ?? estado.janela);
  aplicar();
}

/** A trilha do tamanho da janela, refeita quando a campanha muda de tamanho. */
function montarTrilhaDaJanela(total, desejada) {
  estado.janela = Math.min(Math.max(1, desejada ?? 5), total);
  trilhaJanela = ligarTrilha({
    raiz: el("janela"), total, crescente: true, minimo: 1,
    descrever: (v) => `${v} ${v === 1 ? "jogo" : "jogos"}`,
    alcas: [{ nome: "janela", classe: "alca-meta", valor: estado.janela,
              descricao: "quantos jogos entram na janela" }],
    aoMudar: ({ janela }) => { estado.janela = janela; aplicar(); },
  });
}

/**
 * As duas réguas: a média por jogo com que cada posição termina a série.
 *
 * Só as edições encerradas entram na média — é `estatisticasPorPosicao` quem
 * cuida disso —, e a divisão é pelas rodadas da edição em foco, que é a régua
 * em que a curva do clube está desenhada.
 */
function calcularReferencias() {
  const { posicoes, serie, edicao, faixa } = estado;
  const rodadas = edicao?.rodadas ?? 38;
  const colunas = grade(posicoes, { serie, rodada: rodadas,
                                    semTapetao: !tapetaoLigado() });
  const estatisticas = estatisticasPorPosicao(colunas);

  return [
    { posicao: faixa.melhor, cor: COR.verde },
    { posicao: faixa.pior, cor: COR.negativo },
  ].map(({ posicao, cor }) => {
    const referencia = referenciaDaPosicao(estatisticas, posicao, rodadas);
    return referencia ? { ...referencia, cor } : { posicao, media: null, cor };
  });
}

function aplicar() {
  pintarChaves("modo", estado.modo);
  estado.referencias = calcularReferencias();

  const disputados = estado.campanha.filter((p) => p.realizado).length;
  el("valor-janela").textContent = `${estado.janela} de ${disputados} jogos`;
  el("rodape-edicao").textContent = estado.edicao
    ? `Série ${estado.serie} ${estado.edicao.ano} · ${estado.edicao.realizados} `
      + `de ${estado.edicao.jogos} jogos disputados`
    : "";

  atualizarUrl();
  redesenhar();
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  const inteiro = (chave) => {
    const v = Number(p.get(chave));
    return p.get(chave) !== null && Number.isInteger(v) && v > 0 ? v : null;
  };
  return { serie: p.get("serie"), ano: p.get("ano"), equipe: p.get("equipe"),
           modo: p.get("modo"), janela: inteiro("janela"),
           melhor: inteiro("melhor"), pior: inteiro("pior") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.edicao) p.set("ano", estado.edicao.apelido);
  if (estado.equipe) p.set("equipe", estado.equipe);
  p.set("modo", estado.modo);
  p.set("janela", estado.janela);
  p.set("melhor", estado.faixa.melhor);
  p.set("pior", estado.faixa.pior);
  history.replaceState(null, "", `#${p}`);
}
