/**
 * Página das distâncias para a equipe de baixo.
 *
 * O primeiro filtro escolhe a pergunta, e não um recorte: "rodada específica"
 * pergunta como a tabela está partida hoje, "rodada a rodada" pergunta quando
 * ela se partiu. São gráficos diferentes porque são perguntas diferentes, e
 * por isso o filtro de rodada só existe na primeira.
 *
 * Tudo sai de `posicoes.json`: a grade de cada rodada já vem ordenada pelos
 * desempates do motor, que é o que faz "a equipe de baixo" ser a de baixo
 * mesmo quando as duas têm os mesmos pontos.
 */
import { aoMudarTapetao, tapetaoLigado } from "/js/tapetao.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_degraus.js";
import {
  colunaDaEdicao, rodadaCorrente, rodadaMaxima,
} from "/js/media_posicao.js";

const estado = {
  clubes: {}, posicoes: null,
  serie: null, ano: null, rodada: null, modo: "rodada",
  edicao: null, coluna: null, colunas: [],
};

const el = (id) => document.getElementById(id);
let redesenhar = () => {};

// Virar a chave do tapetão muda a tabela: a página inteira se redesenha.
aoMudarTapetao(() => aplicar());

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("esta edição ainda não chegou a esta rodada");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [clubes, posicoes] = await Promise.all([
    fetch("/dados/clubes.json").then((r) => r.json()),
    fetch("/dados/posicoes.json").then((r) => r.json()),
  ]);
  Object.assign(estado, { clubes, posicoes });

  montarChaves("modo", [
    ["rodada", "Rodada específica"], ["serie", "Rodada a rodada"],
  ], (valor) => { estado.modo = valor; aplicar(); });

  montarChaves("serie",
    Object.keys(posicoes.series ?? {}).sort().map((s) => [s, `Série ${s}`]),
    (valor) => trocarSerie(valor));

  el("ano").addEventListener("change", () => trocarAno(el("ano").value));
  el("rodada").addEventListener("input", () => {
    estado.rodada = Number(el("rodada").value);
    aplicar();
  });

  const url = daUrl();
  if (url.modo === "serie" || url.modo === "rodada") estado.modo = url.modo;
  trocarSerie(url.serie ?? "A", url);
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

function trocarSerie(serie, url = {}) {
  estado.serie = serie;
  pintarChaves("serie", serie);

  const anos = Object.keys(estado.posicoes.series?.[serie] ?? {})
    .map(Number).sort((a, b) => b - a);
  el("ano").innerHTML = anos.map((a) => `<option value="${a}">${a}</option>`).join("");

  const desejado = url.ano ?? estado.ano;
  trocarAno(anos.includes(Number(desejado)) ? desejado : anos[0], url);
}

function trocarAno(ano, url = {}) {
  estado.ano = Number(ano);
  el("ano").value = ano;

  const edicao = estado.posicoes.series?.[estado.serie]?.[String(ano)] ?? null;
  estado.edicao = edicao ? { ...edicao, ano: Number(ano) } : null;

  const maxima = edicao?.rodadas ?? rodadaMaxima(estado.posicoes,
    { serie: estado.serie });
  el("rodada").max = maxima;

  // A rodada padrão é a última que esta edição alcançou: é a tabela de hoje
  // quando a edição está em andamento, e a final quando ela já acabou.
  const corrente = Math.min(
    rodadaCorrente(estado.posicoes, { serie: estado.serie }), maxima);
  estado.rodada = Math.min(url.rodada ?? estado.rodada ?? corrente, maxima);
  el("rodada").value = estado.rodada;

  aplicar();
}

function aplicar() {
  const { serie, ano, rodada, edicao } = estado;
  pintarChaves("modo", estado.modo);
  el("campo-rodada").hidden = estado.modo === "serie";
  el("valor-rodada").textContent = rodada;

  estado.coluna = colunaDaEdicao(estado.posicoes,
    { serie, ano, rodada, semTapetao: !tapetaoLigado() })
    ?.celulas ?? null;
  estado.colunas = estado.modo !== "serie" || !edicao ? []
    : Array.from({ length: edicao.rodadas }, (_, i) => {
      const coluna = colunaDaEdicao(estado.posicoes,
        { serie, ano, rodada: i + 1, semTapetao: !tapetaoLigado() });
      return coluna ? { rodada: i + 1, celulas: coluna.celulas } : null;
    }).filter(Boolean);

  el("rodape-edicao").textContent = edicao
    ? `Série ${serie} ${ano} · ${edicao.rodadas} rodadas na grade`
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
  return { serie: p.get("serie"), ano: inteiro("ano"), rodada: inteiro("rodada"),
           modo: p.get("modo") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.ano) p.set("ano", estado.ano);
  p.set("modo", estado.modo);
  if (estado.modo !== "serie") p.set("rodada", estado.rodada);
  history.replaceState(null, "", `#${p}`);
}
