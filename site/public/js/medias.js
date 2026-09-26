/**
 * Página do card de média de pontuação por posição e rodada.
 *
 * Fora do card: a série, a rodada e a faixa de posições destacada. A rodada
 * começa na do campeonato em andamento, que é a pergunta do dia — "como
 * estamos perto do normal" —, e não na primeira.
 *
 * O ano do painel da direita não é filtro de tela: escolhe-se clicando na
 * coluna dentro do card. Ele é uma leitura da grade, e a grade está ali.
 */
import { aoMudarTapetao, tapetaoLigado } from "/js/tapetao.js";
import {
  lembrarSerie, serieLembrada,
} from "/js/preferencias.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_medias.js";
import { ligarSeletorDePosicoes } from "/js/seletor_posicoes.js";
import { rodadaCorrente, rodadaMaxima } from "/js/media_posicao.js";

// O G4 em verde e o Z4 em vermelho: a borda de cada quadrado marca onde
// aquele clube foi terminar.
const PADRAO = { melhor: 5, pior: 16 };

const estado = {
  clubes: {}, posicoes: null,
  serie: null, rodada: null, anoEscolhido: null, faixa: { ...PADRAO },
  aoEscolherAno: (ano) => { estado.anoEscolhido = ano; aplicar(); },
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
  definirMensagemSemCard("nenhuma edição chegou a esta rodada");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [clubes, posicoes] = await Promise.all([
    fetch("/dados/clubes.json").then((r) => r.json()),
    fetch("/dados/posicoes.json").then((r) => r.json()),
  ]);
  Object.assign(estado, { clubes, posicoes });

  const url = daUrl();
  estado.faixa = {
    melhor: url.melhor ?? PADRAO.melhor,
    pior: url.pior ?? PADRAO.pior,
  };

  montarChavesDeSerie(Object.keys(posicoes.series ?? {}).sort());

  el("rodada").addEventListener("input", () => {
    estado.rodada = Number(el("rodada").value);
    aplicar();
  });

  ligarSeletorDePosicoes({
    raiz: el("posicoes"),
    pior: estado.faixa.pior,
    melhor: estado.faixa.melhor,
    aoMudar: ({ pior, melhor }) => { estado.faixa = { pior, melhor }; aplicar(); },
  });

  trocarSerie(url.serie ?? serieLembrada() ?? "A", url);
}

function montarChavesDeSerie(series) {
  const caixa = el("serie");
  caixa.innerHTML = series
    .map((s) => `<button type="button" class="chave" data-serie="${s}"
                   aria-pressed="false">Série ${s}</button>`).join("");
  caixa.addEventListener("click", (evento) => {
    const botao = evento.target.closest(".chave");
    if (botao) trocarSerie(botao.dataset.serie);
  });
}

function trocarSerie(serie, url = {}) {
  estado.serie = serie;
  lembrarSerie(estado.serie);
  for (const botao of el("serie").children) {
    botao.setAttribute("aria-pressed", String(botao.dataset.serie === serie));
  }

  const maxima = rodadaMaxima(estado.posicoes, { serie });
  el("rodada").max = maxima;

  // A rodada padrão é a do campeonato em andamento: é dela que parte a
  // pergunta que a tela responde.
  const corrente = rodadaCorrente(estado.posicoes, { serie });
  estado.rodada = Math.min(url.rodada ?? corrente, maxima);
  el("rodada").value = estado.rodada;

  // O ano em foco é o mais recente da série; o clique na grade troca.
  const anos = Object.keys(estado.posicoes.series?.[serie] ?? {}).map(Number);
  estado.anoEscolhido = url.ano ?? (anos.length ? Math.max(...anos) : null);
  aplicar();
}

function aplicar() {
  estado.semTapetao = !tapetaoLigado();
  el("valor-rodada").textContent = estado.rodada;
  atualizarUrl();
  redesenhar();
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  const inteiro = (chave) => {
    const v = Number(p.get(chave));
    return p.get(chave) !== null && Number.isInteger(v) && v > 0 ? v : null;
  };
  return { serie: p.get("serie"), rodada: inteiro("rodada"), ano: inteiro("ano"),
           melhor: inteiro("melhor"), pior: inteiro("pior") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  p.set("rodada", estado.rodada);
  if (estado.anoEscolhido) p.set("ano", estado.anoEscolhido);
  p.set("melhor", estado.faixa.melhor);
  p.set("pior", estado.faixa.pior);
  history.replaceState(null, "", `#${p}`);
}
