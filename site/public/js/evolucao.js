/**
 * Página do card de evolução da campanha.
 *
 * A primeira escolha é o que a linha mede: pontuação ou posição. Ela decide
 * também a ordem do eixo — pontuação anda em ordem cronológica, porque rodada
 * não é tempo; posição anda por rodada, porque posição só existe quando todo
 * mundo jogou o mesmo tanto.
 *
 * Depois: a série, o ano, a equipe e a trilha de posições. A trilha não
 * escolhe clubes — escolhe dois objetivos, e é o que separa esta tela do
 * comparativo de campanhas.
 */
import { clubesDaEdicao, tabela } from "/js/motor.js";
import {
  aoMudarTapetao, descontosDe,
} from "/js/tapetao.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_evolucao.js";
import { ligarSeletorDePosicoes } from "/js/seletor_posicoes.js";
import { nomeComUf } from "/js/nomes.js";
import { edicaoDe } from "/js/diferenca_pontos.js";

const PADRAO = { pior: 17, melhor: 4 };

const estado = {
  edicoes: [], clubes: {}, referencias: {}, posicoes: null,
  modo: "pontuacao",
  serie: null, apelido: null, edicao: null, jogos: null, clube: null,
  referencia: null, grade: null, ...PADRAO,
};

// Os descontos de tapetão da edição em foco, vazios quando a chave está
// desligada. É o mesmo ajudante em todas as páginas que montam tabela.
const descontos = () =>
  descontosDe(estado.serie, estado.edicao?.ano ?? estado.ano);

const el = (id) => document.getElementById(id);
let redesenhar = () => {};

// Virar a chave do tapetão muda a tabela: a página inteira se redesenha.
aoMudarTapetao(() => aplicar());
let trilha = null;

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("escolha uma equipe para desenhar o card");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [edicoes, clubes, referencias, posicoes] = await Promise.all([
    fetch("/dados/edicoes.json").then((r) => r.json()),
    fetch("/dados/clubes.json").then((r) => r.json()),
    fetch("/dados/referencias.json").then((r) => r.json()),
    fetch("/dados/posicoes.json").then((r) => r.json()),
  ]);
  estado.edicoes = edicoes.edicoes;
  estado.clubes = clubes;
  estado.referencias = referencias;
  estado.posicoes = posicoes;

  const url = daUrl();
  if (url.modo === "posicao" || url.modo === "pontuacao") estado.modo = url.modo;
  montarChavesDeModo();
  Object.assign(estado, {
    pior: url.pior ?? PADRAO.pior,
    melhor: url.melhor ?? PADRAO.melhor,
  });

  const series = [...new Set(estado.edicoes.map((e) => e.serie))].sort();
  el("serie").innerHTML = series
    .map((s) => `<option value="${s}">Série ${s}</option>`).join("");
  el("serie").addEventListener("change", () => trocarSerie(el("serie").value));
  el("ano").addEventListener("change", () => trocarAno(el("ano").value));
  el("equipe").addEventListener("change", () => {
    estado.clube = el("equipe").value;
    aplicar();
  });

  trilha = ligarSeletorDePosicoes({
    raiz: el("posicoes"),
    pior: estado.pior,
    melhor: estado.melhor,
    aoMudar: ({ pior, melhor }) => {
      Object.assign(estado, { pior, melhor });
      aplicar();
    },
  });

  await trocarSerie(url.serie ?? series[0], url);
}

/**
 * A chave que decide o que a linha mede. Vem antes de tudo porque muda o eixo,
 * as réguas e até o título do card.
 */
function montarChavesDeModo() {
  const caixa = el("modo");
  caixa.innerHTML = [
    { valor: "pontuacao", rotulo: "Pontuação" },
    { valor: "posicao", rotulo: "Posição" },
  ].map((m) => `<button type="button" class="chave" data-valor="${m.valor}"
                  aria-pressed="${m.valor === estado.modo}">${m.rotulo}</button>`)
   .join("");
  caixa.addEventListener("click", (evento) => {
    const botao = evento.target.closest(".chave");
    if (!botao) return;
    estado.modo = botao.dataset.valor;
    for (const outro of caixa.children) {
      outro.setAttribute("aria-pressed", String(outro.dataset.valor === estado.modo));
    }
    aplicar();
  });
}

/**
 * A premissa da ordem muda com o modo, e ela é escrita fora do card.
 */
function explicarOrdem() {
  const alvo = el("nota-ordem");
  if (!alvo) return;
  alvo.innerHTML = estado.modo === "posicao"
    ? `<b>Ordem da rodada, não cronológica.</b> Posição só existe quando todo
       mundo jogou o mesmo tanto, então o eixo é a rodada: jogo adiado conta na
       rodada a que pertence, e é por isso que um clube pode aparecer atrás com
       um jogo a menos.`
    : `<b>Ordem cronológica, não a da rodada.</b> O eixo é o n-ésimo jogo do
       clube, na ordem em que ele foi disputado. Rodada não é tempo: um jogo
       adiado da 4ª disputado em agosto poria o acumulado de agosto lá atrás.`;
}

const anosDaSerie = (serie) => estado.edicoes.filter((e) => e.serie === serie);

async function trocarSerie(serie, url = {}) {
  estado.serie = serie;
  estado.referencia = estado.referencias[serie] ?? null;
  el("serie").value = serie;

  if (!estado.referencia) {
    definirMensagemSemCard(
      `a Série ${serie} ainda não tem edição encerrada — sem ela não há régua`);
  } else {
    definirMensagemSemCard("escolha uma equipe para desenhar o card");
    const total = Object.keys(estado.referencia.media).length;
    // Séries com número de clubes diferente mudariam o alcance da trilha.
    trilha.definir({
      melhor: Math.min(estado.melhor, total - 1),
      pior: Math.min(estado.pior, total),
    });
    Object.assign(estado, trilha.valores());
  }

  const anos = anosDaSerie(serie);
  el("ano").innerHTML = anos
    .map((e) => `<option value="${e.apelido}">${e.ano}</option>`).join("");

  const desejado = url.ano ?? estado.apelido;
  const escolhido = anos.some((e) => e.apelido === desejado)
    ? desejado : anos[0].apelido;
  await trocarAno(escolhido, url.equipe, { silencioso: true });
  aplicar();
}

async function trocarAno(apelido, clubeDesejado, { silencioso = false } = {}) {
  const edicao = estado.edicoes.find((e) => e.apelido === apelido);
  if (!edicao) return;

  el("ano").value = apelido;
  const jogos = await fetch(`/dados/jogos/${apelido}.json`).then((r) => r.json());
  const clubes = clubesDaEdicao(jogos);

  el("equipe").innerHTML = clubes
    .map((c) => `<option value="${c}">${nomeComUf(c)}</option>`).join("");

  // Mantém o clube quando ele jogou naquele ano; senão propõe o líder, que é a
  // campanha que alguém abriria primeiro.
  const atual = clubeDesejado ?? estado.clube;
  const escolhido = clubes.includes(atual)
    ? atual : tabela(jogos, clubes, {}, descontos())[0]?.equipe ?? clubes[0];

  Object.assign(estado, { apelido, edicao, jogos, clube: escolhido });
  el("equipe").value = escolhido;

  if (!silencioso) aplicar();
}

function aplicar() {
  estado.grade = estado.edicao
    ? edicaoDe(estado.posicoes, { serie: estado.serie, ano: estado.edicao.ano })
    : null;
  explicarOrdem();
  atualizarUrl();
  redesenhar();
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  const inteiro = (chave) => {
    const v = Number(p.get(chave));
    return Number.isInteger(v) && v > 0 ? v : null;
  };
  return { serie: p.get("serie"), ano: p.get("ano"), equipe: p.get("equipe"),
           modo: p.get("modo"),
           pior: inteiro("pior"), melhor: inteiro("melhor") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  p.set("modo", estado.modo);
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.apelido) p.set("ano", estado.apelido);
  if (estado.clube) p.set("equipe", estado.clube);
  p.set("melhor", estado.melhor);
  p.set("pior", estado.pior);
  history.replaceState(null, "", `#${p}`);
}
