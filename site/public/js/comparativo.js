/**
 * Página do card de comparativo de campanhas.
 *
 * A primeira escolha é o que as linhas medem: pontuação ou posição. Ela decide
 * também a ordem do eixo — pontuação anda em ordem cronológica, porque rodada
 * não é tempo; posição anda por rodada, porque posição só existe quando todo
 * mundo jogou o mesmo tanto.
 *
 * Depois: a série, e um par ano + equipe para cada campanha. Os anos são
 * independentes, de propósito — é o que permite cruzar o Bahia de 2026 com o
 * Bahia de 2019, ou com outro clube de outro ano.
 */
import { clubesDaEdicao, tabela } from "/js/motor.js";
import {
  aoMudarTapetao, descontosDe,
} from "/js/tapetao.js";
import {
  lembrarSerie, serieLembrada,
} from "/js/preferencias.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_comparativo.js";
import { nomeComUf } from "/js/nomes.js";
import { edicaoDe } from "/js/diferenca_pontos.js";

const estado = {
  edicoes: [], clubes: {}, posicoes: null, serie: null, modo: "pontuacao",
  a: { apelido: null, edicao: null, jogos: null, clube: null, grade: null },
  b: { apelido: null, edicao: null, jogos: null, clube: null, grade: null },
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
  definirMensagemSemCard("escolha duas campanhas diferentes");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [edicoes, clubes, posicoes] = await Promise.all([
    fetch("/dados/edicoes.json").then((r) => r.json()),
    fetch("/dados/clubes.json").then((r) => r.json()),
    fetch("/dados/posicoes.json").then((r) => r.json()),
  ]);
  estado.edicoes = edicoes.edicoes;
  estado.clubes = clubes;
  estado.posicoes = posicoes;

  const series = [...new Set(estado.edicoes.map((e) => e.serie))].sort();
  el("serie").innerHTML = series
    .map((s) => `<option value="${s}">Série ${s}</option>`).join("");
  el("serie").addEventListener("change", () => trocarSerie(el("serie").value));

  for (const lado of ["a", "b"]) {
    el(`ano-${lado}`).addEventListener("change",
      () => trocarAno(lado, el(`ano-${lado}`).value));
    el(`equipe-${lado}`).addEventListener("change", () => {
      estado[lado].clube = el(`equipe-${lado}`).value;
      aplicar();
    });
  }
  el("trocar").addEventListener("click", inverter);

  const url = daUrl();
  if (url.modo === "posicao" || url.modo === "pontuacao") estado.modo = url.modo;
  montarChavesDeModo();
  await trocarSerie(url.serie ?? series[0], url);
}

/**
 * A chave que decide o que as linhas medem. Vem antes de tudo porque muda o
 * eixo, o título e o que a diferença conta.
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
      outro.setAttribute("aria-pressed",
                         String(outro.dataset.valor === estado.modo));
    }
    aplicar();
  });
}

/** A premissa da ordem muda com o modo, e ela é escrita fora do card. */
function explicarOrdem() {
  const alvo = el("nota-ordem");
  if (!alvo) return;
  alvo.innerHTML = estado.modo === "posicao"
    ? `<b>Ordem da rodada, não cronológica.</b> Posição só existe quando todo
       mundo jogou o mesmo tanto, então o eixo é a rodada: jogo adiado conta na
       rodada a que pertence, e é por isso que um clube pode aparecer atrás com
       um jogo a menos.`
    : `<b>Ordem cronológica, não a da rodada.</b> O eixo é o n-ésimo jogo de
       cada clube, na ordem em que ele foi disputado. Rodada não é tempo: um
       jogo adiado da 4ª disputado em agosto poria o acumulado de agosto lá
       atrás — e comparar anos diferentes só funciona pelo n-ésimo jogo.`;
}

const anosDaSerie = (serie) => estado.edicoes.filter((e) => e.serie === serie);

async function trocarSerie(serie, url = {}) {
  estado.serie = serie;
  lembrarSerie(estado.serie);
  el("serie").value = serie;

  const anos = anosDaSerie(serie);
  const opcoes = anos
    .map((e) => `<option value="${e.apelido}">${e.ano}</option>`).join("");
  for (const lado of ["a", "b"]) el(`ano-${lado}`).innerHTML = opcoes;

  // Ao trocar de série, os anos guardados podem não existir mais.
  await trocarAno("a", valido(url.anoA ?? estado.a.apelido, anos) ?? anos[0].apelido,
                  url.a, { silencioso: true });
  await trocarAno("b", valido(url.anoB ?? estado.b.apelido, anos) ?? anos[0].apelido,
                  url.b, { silencioso: true });
  aplicar();
}

const valido = (apelido, anos) =>
  anos.some((e) => e.apelido === apelido) ? apelido : null;

async function trocarAno(lado, apelido, clubeDesejado, { silencioso = false } = {}) {
  const edicao = estado.edicoes.find((e) => e.apelido === apelido);
  if (!edicao) return;

  el(`ano-${lado}`).value = apelido;
  const jogos = await fetch(`/dados/jogos/${apelido}.json`).then((r) => r.json());
  const clubes = clubesDaEdicao(jogos);

  el(`equipe-${lado}`).innerHTML = clubes
    .map((c) => `<option value="${c}">${nomeComUf(c)}</option>`).join("");

  // Mantém o clube quando ele jogou naquele ano; senão propõe um da frente da
  // tabela, que é a campanha que alguém abriria primeiro.
  const classificados = tabela(jogos, clubes, {}, descontos()).map((c) => c.equipe);
  const atual = clubeDesejado ?? estado[lado].clube;
  const escolhido = clubes.includes(atual) ? atual
    : classificados[lado === "a" ? 0 : 1] ?? clubes[0];

  Object.assign(estado[lado], { apelido, edicao, jogos, clube: escolhido });
  el(`equipe-${lado}`).value = escolhido;

  if (!silencioso) aplicar();
}

function inverter() {
  const { a, b } = estado;
  [estado.a, estado.b] = [b, a];
  for (const lado of ["a", "b"]) {
    el(`ano-${lado}`).value = estado[lado].apelido;
    el(`equipe-${lado}`).innerHTML = clubesDaEdicao(estado[lado].jogos)
      .map((c) => `<option value="${c}">${nomeComUf(c)}</option>`).join("");
    el(`equipe-${lado}`).value = estado[lado].clube;
  }
  aplicar();
}

function aplicar() {
  for (const lado of ["a", "b"]) {
    estado[lado].grade = estado[lado].edicao
      ? edicaoDe(estado.posicoes,
                 { serie: estado.serie, ano: estado[lado].edicao.ano })
      : null;
  }
  explicarOrdem();
  atualizarUrl();
  redesenhar();
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  return { serie: p.get("serie"), modo: p.get("modo"),
           anoA: p.get("anoA"), a: p.get("a"),
           anoB: p.get("anoB"), b: p.get("b") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  p.set("modo", estado.modo);
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.a.apelido) { p.set("anoA", estado.a.apelido); p.set("a", estado.a.clube); }
  if (estado.b.apelido) { p.set("anoB", estado.b.apelido); p.set("b", estado.b.clube); }
  history.replaceState(null, "", `#${p}`);
}
