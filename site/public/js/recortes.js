/**
 * Página do card de recortes iniciais.
 *
 * Fora do card: a divisão, a equipe, o jogo do corte e a faixa de posições
 * destacada. Escolher uma equipe leva o corte para o número de jogos que ela
 * tem hoje — é a pergunta que se faz na prática, "este começo é bom para o
 * nosso padrão?", e ela parte de onde a campanha está.
 *
 * Não há filtro de edição: o card cruza todas de uma vez.
 */
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_recortes.js";
import { ligarSeletorDePosicoes } from "/js/seletor_posicoes.js";
import { jogosNaEdicaoCorrente } from "/js/recorte_inicial.js";
import { nomeBonito, nomeComUf } from "/js/nomes.js";

// O G4 em verde, o Z4 em vermelho e o meio em cinza: as três faixas que
// qualquer leitor da tabela já tem na cabeça.
const PADRAO = { melhor: 5, pior: 16 };

const estado = {
  clubes: {}, campanhas: null,
  serie: null, equipe: null, jogos: 20, faixa: { ...PADRAO },
};

const el = (id) => document.getElementById(id);
let redesenhar = () => {};

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("escolha uma equipe para desenhar o card");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [clubes, campanhas] = await Promise.all([
    fetch("/dados/clubes.json").then((r) => r.json()),
    fetch("/dados/campanhas.json").then((r) => r.json()),
  ]);
  Object.assign(estado, { clubes, campanhas });

  const url = daUrl();
  estado.faixa = {
    melhor: url.melhor ?? PADRAO.melhor,
    pior: url.pior ?? PADRAO.pior,
  };

  montarChavesDeSerie(Object.keys(campanhas.series ?? {}).sort());

  el("equipe").addEventListener("change", () => {
    trocarEquipe(el("equipe").value);
  });
  el("jogos").addEventListener("input", () => {
    estado.jogos = Number(el("jogos").value);
    aplicar();
  });

  ligarSeletorDePosicoes({
    raiz: el("posicoes"),
    pior: estado.faixa.pior,
    melhor: estado.faixa.melhor,
    aoMudar: ({ pior, melhor }) => { estado.faixa = { pior, melhor }; aplicar(); },
  });

  trocarSerie(url.serie ?? "A", url);
}

/* ------------------------------------------------------ chaves de série */
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

/* ----------------------------------------------------------- filtragem */
function trocarSerie(serie, url = {}) {
  estado.serie = serie;
  for (const botao of el("serie").children) {
    botao.setAttribute("aria-pressed", String(botao.dataset.serie === serie));
  }

  // Todo clube que já apareceu na série, e não só os da edição corrente: o
  // card cruza as 21 edições, e um clube que subiu em 2010 e caiu em 2014 tem
  // recortes para mostrar.
  const nomes = new Set();
  for (const clubes of Object.values(estado.campanhas.series?.[serie] ?? {})) {
    for (const [equipe] of clubes) nomes.add(equipe);
  }
  const lista = [...nomes].sort((a, b) =>
    nomeBonito(a).localeCompare(nomeBonito(b), "pt-BR"));

  el("equipe").innerHTML = lista
    .map((e) => `<option value="${e}">${nomeComUf(e)}</option>`).join("");

  const desejada = url.equipe ?? estado.equipe;
  trocarEquipe(lista.includes(desejada) ? desejada : lista[0],
               { jogosDaUrl: url.jogos });
}

function trocarEquipe(equipe, { jogosDaUrl = null } = {}) {
  if (!equipe) return;
  estado.equipe = equipe;
  el("equipe").value = equipe;

  const im = el("escudo-equipe");
  im.src = estado.clubes[equipe]?.escudo ?? "";
  im.alt = nomeBonito(equipe);

  // O corte vai para onde a campanha está hoje. Sem edição corrente na série
  // — um clube que não está nela este ano —, vale a temporada inteira.
  const hoje = jogosNaEdicaoCorrente(estado.campanhas,
                                     { serie: estado.serie, equipe });
  estado.jogos = jogosDaUrl ?? hoje ?? 38;
  el("jogos").value = estado.jogos;
  aplicar();
}

function aplicar() {
  el("valor-jogos").textContent = estado.jogos;
  atualizarUrl();
  redesenhar();
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  const inteiro = (chave) => {
    const v = Number(p.get(chave));
    return p.get(chave) !== null && Number.isInteger(v) && v > 0 ? v : null;
  };
  return { serie: p.get("serie"), equipe: p.get("equipe"),
           jogos: inteiro("jogos"),
           melhor: inteiro("melhor"), pior: inteiro("pior") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.equipe) p.set("equipe", estado.equipe);
  p.set("jogos", estado.jogos);
  p.set("melhor", estado.faixa.melhor);
  p.set("pior", estado.faixa.pior);
  history.replaceState(null, "", `#${p}`);
}
