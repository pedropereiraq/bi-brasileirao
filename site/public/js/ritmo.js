/**
 * Página de aceleração e desaceleração por posição.
 *
 * Fora do card só a série e a rodada: a tela cruza todas as edições
 * encerradas, e por isso não há filtro de edição — a edição é a amostra, não
 * o recorte. A posição aberta no painel sai do clique na tabela.
 *
 * A rodada começa na do campeonato em andamento, que é de onde a pergunta
 * nasce: quem está em cada posição hoje costuma acelerar ou frear daqui para
 * a frente?
 */
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_ritmo.js";
import {
  colunaDaEdicao, desfechoDaEdicao, rodadaCorrente, rodadaMaxima,
} from "/js/media_posicao.js";

const estado = {
  clubes: {}, posicoes: null,
  serie: null, rodada: null, posicao: null,
  edicoes: [], porRodada: [],
  aoEscolher: (posicao) => {
    estado.posicao = estado.posicao === posicao ? null : posicao;
    aplicar();
  },
};

const el = (id) => document.getElementById(id);
let redesenhar = () => {};

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("nenhuma edição encerrada chegou a esta rodada");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [clubes, posicoes] = await Promise.all([
    fetch("/dados/clubes.json").then((r) => r.json()),
    fetch("/dados/posicoes.json").then((r) => r.json()),
  ]);
  Object.assign(estado, { clubes, posicoes });

  montarChaves("serie",
    Object.keys(posicoes.series ?? {}).sort().map((s) => [s, `Série ${s}`]),
    (valor) => trocarSerie(valor));

  el("rodada").addEventListener("input", () => {
    estado.rodada = Number(el("rodada").value);
    aplicar();
  });

  const url = daUrl();
  if (url.posicao >= 1 && url.posicao <= 20) estado.posicao = url.posicao;
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

function trocarSerie(serie, url = {}) {
  estado.serie = serie;
  for (const botao of el("serie").children) {
    botao.setAttribute("aria-pressed", String(botao.dataset.valor === serie));
  }

  // A última rodada tem de sobrar campeonato depois dela: sem "depois" não há
  // aceleração que medir.
  const maxima = Math.max(1, rodadaMaxima(estado.posicoes, { serie }) - 1);
  el("rodada").max = maxima;
  const corrente = rodadaCorrente(estado.posicoes, { serie });
  estado.rodada = Math.min(url.rodada ?? estado.rodada ?? corrente, maxima);
  el("rodada").value = estado.rodada;
  aplicar();
}

/**
 * As edições encerradas da série, na rodada escolhida.
 *
 * Cada célula junta as duas pontas da mesma posição: quem estava nela naquela
 * rodada e quem terminou nela. São quase sempre clubes diferentes, e é o par
 * que impede de ler a conta como se fosse de um time só.
 */
function colunasDaRodada(serie, rodada) {
  const anos = estado.posicoes.series?.[serie] ?? {};
  const saida = [];
  for (const [ano, edicao] of Object.entries(anos)) {
    if (!edicao.encerrada || edicao.rodadas < rodada) continue;
    const coluna = colunaDaEdicao(estado.posicoes, { serie, ano, rodada });
    if (!coluna) continue;

    const fim = desfechoDaEdicao(estado.posicoes, { serie, ano });
    saida.push({
      ano: Number(ano), rodadas: edicao.rodadas,
      celulas: coluna.celulas.map((celula, i) => ({
        posicao: celula.posicao,
        equipe: celula.equipe,
        pontos: celula.pontos,
        equipeFim: fim[i]?.equipe ?? null,
        pontosFim: fim[i]?.pontos ?? null,
      })),
    });
  }
  return saida.sort((a, b) => a.ano - b.ano);
}

/**
 * A pontuação daquela posição em cada rodada, edição por edição.
 *
 * Só é montada quando há posição aberta: são trinta e oito colunas por edição,
 * e ninguém precisa delas enquanto o painel está fechado.
 */
function pontosPorRodada(serie, posicao) {
  const anos = Object.entries(estado.posicoes.series?.[serie] ?? {})
    .filter(([, edicao]) => edicao.encerrada);
  const rodadas = Math.max(0, ...anos.map(([, edicao]) => edicao.rodadas));

  return Array.from({ length: rodadas }, (_, i) => {
    const rodada = i + 1;
    const pontos = [];
    for (const [ano] of anos) {
      const coluna = colunaDaEdicao(estado.posicoes, { serie, ano, rodada });
      const celula = coluna?.celulas?.[posicao - 1];
      if (celula) pontos.push(celula.pontos);
    }
    return { rodada, pontos };
  });
}

function aplicar() {
  const { serie, rodada, posicao } = estado;
  el("valor-rodada").textContent = rodada;

  estado.edicoes = colunasDaRodada(serie, rodada);
  estado.porRodada = posicao ? pontosPorRodada(serie, posicao) : [];

  el("rodape-edicao").textContent =
    `Série ${serie} · ${estado.edicoes.length} edições encerradas chegaram à `
    + `${rodada}ª rodada`;
  atualizarUrl();
  redesenhar();
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  const inteiro = (chave) => {
    const v = Number(p.get(chave));
    return p.get(chave) !== null && Number.isInteger(v) && v > 0 ? v : null;
  };
  return { serie: p.get("serie"), rodada: inteiro("rodada"),
           posicao: inteiro("posicao") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  p.set("rodada", estado.rodada);
  if (estado.posicao) p.set("posicao", estado.posicao);
  history.replaceState(null, "", `#${p}`);
}
