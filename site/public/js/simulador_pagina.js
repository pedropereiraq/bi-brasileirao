/**
 * Página do simulador da reta final.
 *
 * Fora do card só a série e o botão de limpar: a tela vale para a **edição em
 * andamento**, e escolher um ano encerrado seria simular o que já aconteceu.
 *
 * Ela também só abre no segundo turno. Com trinta jogos pela frente, palpitar
 * um a um não é simulação, é ficção — e a tabela que sairia dali não diria
 * nada sobre o campeonato. Antes disso a página aparece com o aviso, e mais
 * nada; é a mesma regra do comparativo de turnos.
 *
 * As duas tabelas saem do motor do navegador: a de hoje com os jogos como
 * estão, a simulada com os palpites já vestidos de placar. Nenhuma das duas é
 * tabela pronta — é o mesmo caminho de todo recorte do BI.
 */
import { MANDANTE, VISITANTE, tabela } from "/js/motor.js";
import { aoMudarTapetao, descontosDe } from "/js/tapetao.js";
import { lembrarSerie, serieLembrada } from "/js/preferencias.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_simulador.js";
import { avisoDoSegundoTurno } from "/js/segundo_turno.js";
import {
  aplicarPalpites, contarPalpites, girarPalpite, jogosPendentes, variacoes,
} from "/js/simulador.js";

const estado = {
  edicoes: [], clubes: {},
  serie: null, edicao: null, jogos: [], nomes: [],
  pendentes: [], palpites: new Map(),
  hoje: null, simulada: null, variacao: null, aviso: null,
  ano: null,
  aoPalpitar: ({ indice, emCasa }) => {
    estado.palpites = girarPalpite(estado.palpites, { indice, emCasa });
    aplicar();
  },
};

const el = (id) => document.getElementById(id);
let redesenhar = () => {};

// Virar a chave do tapetão muda as duas tabelas: a página inteira se redesenha.
aoMudarTapetao(() => aplicar());

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  redesenhar = ligarPaginaDeCard(
    () => (estado.aviso ? null : montarCartao(estado)));

  const [edicoes, clubes] = await Promise.all([
    fetch("/dados/edicoes.json").then((r) => r.json()),
    fetch("/dados/clubes.json").then((r) => r.json()),
  ]);
  Object.assign(estado, { edicoes: edicoes.edicoes, clubes });

  montarChaves("serie",
    [...new Set(estado.edicoes.map((e) => e.serie))].sort()
      .map((s) => [s, `Série ${s}`]),
    (valor) => trocarSerie(valor));

  el("limpar").addEventListener("click", () => {
    estado.palpites = new Map();
    aplicar();
  });

  await trocarSerie(daUrl().serie ?? serieLembrada() ?? "A");
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

/**
 * A edição em andamento da série.
 *
 * A mais recente entre as que não terminaram. Série sem edição aberta não tem
 * reta final para simular, e é isso que o aviso diz.
 */
function emAndamento(serie) {
  return estado.edicoes
    .filter((e) => e.serie === serie && !e.encerrada)
    .sort((a, b) => b.ano - a.ano)[0] ?? null;
}

async function trocarSerie(serie) {
  estado.serie = serie;
  lembrarSerie(serie);
  for (const botao of el("serie").children) {
    botao.setAttribute("aria-pressed", String(botao.dataset.valor === serie));
  }

  // Trocar de série é trocar de campeonato: os palpites da outra não valem
  // aqui, e mantê-los guardados pelo índice do jogo apontaria para jogos de
  // outra tabela.
  estado.palpites = new Map();
  const edicao = emAndamento(serie);
  estado.edicao = edicao;
  estado.ano = edicao?.ano ?? null;

  if (!edicao) {
    Object.assign(estado, { jogos: [], nomes: [], pendentes: [] });
    aplicar();
    return;
  }

  estado.jogos = await fetch(`/dados/jogos/${edicao.apelido}.json`)
    .then((r) => r.json());
  estado.nomes = [...new Set(
    estado.jogos.flatMap((j) => [j[MANDANTE], j[VISITANTE]]))].sort();
  estado.pendentes = jogosPendentes(estado.jogos);
  aplicar();
}

function aplicar() {
  const { edicao, jogos, nomes } = estado;

  estado.aviso = !edicao
    ? `A Série ${estado.serie} não tem edição em andamento para simular.`
    : avisoDoSegundoTurno({ jogos, rodadas: edicao.rodadas,
                            tela: "O simulador" });
  definirMensagemSemCard(estado.aviso ?? "sem jogos para simular");

  if (edicao && !estado.aviso) {
    const descontos = descontosDe(estado.serie, edicao.ano);
    estado.hoje = tabela(jogos, nomes, {}, descontos);
    estado.simulada = tabela(aplicarPalpites(jogos, estado.palpites), nomes, {},
                             descontos);
    estado.variacao = variacoes(estado.hoje, estado.simulada);
  }

  const conta = contarPalpites(estado.palpites, estado.pendentes);
  el("limpar").hidden = !conta.simulados;
  el("resumo-palpites").textContent = estado.aviso
    ? ""
    : conta.simulados
      ? `${conta.simulados} de ${conta.total} jogos simulados · `
        + `faltam ${conta.restantes}`
      : `${conta.total} jogos por disputar, nenhum simulado ainda`;

  el("rodape-edicao").textContent = edicao
    ? `Série ${estado.serie} ${edicao.ano} · ${edicao.realizados} de `
      + `${edicao.jogos} jogos disputados`
    : "";

  atualizarUrl();
  redesenhar();
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  return { serie: p.get("serie") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  history.replaceState(null, "", `#${p}`);
}
