/**
 * Página do card de classificação por rodada.
 *
 * Fora do card: a série, a edição, o clube em destaque e a faixa de posições.
 *
 * A faixa nasce vazia de propósito. A grade inteira é o assunto da tela, e a
 * lista da esquerda é uma segunda pergunta — quem ocupou este pedaço da tabela
 * e por quanto tempo. Enquanto ninguém pergunta, a grade fica com o card todo.
 *
 * O clube em destaque e a faixa também se escolhem dentro do card: clicar num
 * escudo acende o clube, clicar no número da posição abre a faixa daquele
 * lugar. É o gesto mais curto — a alternativa é procurar a sigla numa lista de
 * vinte.
 */
import { aoMudarTapetao, tapetaoLigado } from "/js/tapetao.js";
import {
  equipeLembrada, lembrarEquipe, lembrarSerie, serieLembrada,
} from "/js/preferencias.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_grade.js";
import { ligarSeletorDePosicoes } from "/js/seletor_posicoes.js";
import { nomeComUf } from "/js/nomes.js";

const estado = {
  posicoes: null, clubes: {},
  serie: null, ano: null, edicao: null,
  destaque: "", faixa: null, semTapetao: false,
  aoEscolherClube: (equipe) => escolherDestaque(equipe),
  aoEscolherPosicao: (posicao) => escolherPosicao(posicao),
};

const el = (id) => document.getElementById(id);
let redesenhar = () => {};
let trilha = null;

// Virar a chave do tapetão troca a grade: a tela inteira se redesenha.
aoMudarTapetao(() => aplicar());

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("esta edição ainda não tem rodadas para mostrar");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [clubes, posicoes] = await Promise.all([
    fetch("/dados/clubes.json").then((r) => r.json()),
    fetch("/dados/posicoes.json").then((r) => r.json()),
  ]);
  Object.assign(estado, { clubes, posicoes });

  montarChaves("serie",
    Object.keys(posicoes.series ?? {}).sort().map((s) => [s, `Série ${s}`]),
    (valor) => trocarSerie(valor));

  el("ano").addEventListener("change", () => trocarAno(el("ano").value));
  el("destaque").addEventListener("change", () => {
    estado.destaque = lembrarEquipe(el("destaque").value);
    aplicar();
  });
  el("limpar-faixa").addEventListener("click", () => limparFaixa());

  trilha = ligarSeletorDePosicoes({
    raiz: el("posicoes"), pior: 20, melhor: 1,
    aoMudar: ({ pior, melhor }) => {
      estado.faixa = { de: melhor, ate: pior };
      aplicar();
    },
  });

  const url = daUrl();
  if (url.de && url.ate) estado.faixa = { de: url.de, ate: url.ate };
  trocarSerie(url.serie ?? serieLembrada() ?? "A", url);
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
  lembrarSerie(serie);
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

  // O destaque é por clube, e um clube não joga toda edição: some quando a
  // troca de ano o deixa de fora, em vez de destacar ninguém em silêncio.
  const clubes = edicao?.clubes ?? [];
  el("destaque").innerHTML = '<option value="">nenhuma</option>'
    + [...clubes].sort((a, b) => nomeComUf(a).localeCompare(nomeComUf(b), "pt-BR"))
        .map((c) => `<option value="${c}">${nomeComUf(c)}</option>`).join("");
  const querido = url.destaque ?? estado.destaque ?? equipeLembrada();
  estado.destaque = clubes.includes(querido) ? querido : "";
  el("destaque").value = estado.destaque;

  aplicar();
}

/** Clicar no clube que já está em destaque tira o destaque: é o mesmo gesto. */
function escolherDestaque(equipe) {
  estado.destaque = estado.destaque === equipe ? "" : equipe;
  if (estado.destaque) lembrarEquipe(estado.destaque);
  el("destaque").value = estado.destaque;
  aplicar();
}

/**
 * Clicar no número da posição abre a faixa daquele lugar.
 *
 * Clicar de novo na mesma posição fecha: é o mesmo gesto, e sem isso só o
 * botão de limpar desfaria o que um clique fez.
 */
function escolherPosicao(posicao) {
  const { faixa } = estado;
  const sozinha = faixa && faixa.de === posicao && faixa.ate === posicao;
  estado.faixa = sozinha ? null : { de: posicao, ate: posicao };
  if (estado.faixa) trilha?.definir({ pior: posicao, melhor: posicao });
  aplicar();
}

function limparFaixa() {
  estado.faixa = null;
  trilha?.definir({ pior: 20, melhor: 1 });
  aplicar();
}

function aplicar() {
  estado.semTapetao = !tapetaoLigado();

  // A trilha fica apagada enquanto não há faixa escolhida: ela existe, mas
  // não está dizendo nada ainda.
  el("posicoes").classList.toggle("trilha-apagada", !estado.faixa);
  el("limpar-faixa").hidden = !estado.faixa;
  el("resumo-faixa").textContent = estado.faixa
    ? (estado.faixa.de === estado.faixa.ate
        ? `contando as rodadas no ${estado.faixa.de}º lugar`
        : `contando as rodadas entre o ${estado.faixa.de}º e o `
          + `${estado.faixa.ate}º`)
    : "sem faixa escolhida — a grade ocupa o card inteiro";

  el("rodape-edicao").textContent = estado.edicao
    ? `Série ${estado.serie} ${estado.ano} · `
      + `${estado.edicao.grade?.length ?? 0} rodadas na grade`
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
  return { serie: p.get("serie"), ano: inteiro("ano"),
           destaque: p.get("destaque"), de: inteiro("de"), ate: inteiro("ate") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.ano) p.set("ano", estado.ano);
  if (estado.destaque) p.set("destaque", estado.destaque);
  if (estado.faixa) {
    p.set("de", estado.faixa.de);
    p.set("ate", estado.faixa.ate);
  }
  history.replaceState(null, "", `#${p}`);
}
