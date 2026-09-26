/**
 * Página do card de jogos para alcançar X.
 *
 * Fora do card: a divisão, a equipe, o que se procura e a marca. Não há filtro
 * de edição — o card cruza todas de uma vez, que é o ponto da tela.
 *
 * A marca nasce na mediana dos totais do clube naquela métrica: metade das
 * edições chega, metade não, e é daí que se começa a mexer. Trocar de métrica
 * refaz a régua, porque 45 pontos e 45 empates não são a mesma pergunta.
 */
import {
  equipeLembrada, lembrarEquipe, lembrarSerie, serieLembrada,
} from "/js/preferencias.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_alcancar.js";
import { ligarTrilha } from "/js/seletor_posicoes.js";
import {
  METRICAS, alvoPadrao, edicoesDoClube, maiorTotal, marcosDoClube,
  situacaoAtual,
} from "/js/alcancar.js";
import { marcaAtual, aoMudarMarca } from "/js/marca.js";
import { nomeComUf } from "/js/nomes.js";

const estado = {
  clubes: {}, campanhas: null,
  serie: null, equipe: null, metrica: "pontos", alvo: null, ordem: "jogos",
  // A edição em curso da série, que é a lista de clubes da tela e a marca que
  // cada um deles traz de casa.
  atual: { ano: null, clubes: [] },
  // A lista deitada mostra os clubes de hoje; quem já jogou a série em outros
  // anos fica atrás deste botão, para a fila não virar oitenta escudos.
  outras: false,
};

const el = (id) => document.getElementById(id);
let redesenhar = () => {};
let trilha = null;

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("escolha uma equipe para desenhar o card");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [clubes, campanhas] = await Promise.all([
    fetch("/dados/clubes.json").then((r) => r.json()),
    fetch("/dados/campanhas_detalhe.json").then((r) => r.json()),
  ]);
  Object.assign(estado, { clubes, campanhas });

  const url = daUrl();
  if (METRICAS[url.metrica]) estado.metrica = url.metrica;
  if (url.ordem === "edicao" || url.ordem === "jogos") estado.ordem = url.ordem;

  montarChaves("serie", Object.keys(campanhas.series ?? {}).sort()
    .map((s) => ({ valor: s, rotulo: `Série ${s}` })),
    (valor) => trocarSerie(valor));

  escreverMetricas();
  ligarChaves("metrica", (valor) => {
    estado.metrica = valor;
    pintarChaves("metrica", valor);
    // A régua muda de tamanho e de sentido: o alvo volta ao que o clube tem
    // hoje naquela conta, em vez de carregar um número que era de outra.
    montarListaDeClubes();
    montarTrilha(valorDeHoje());
    aplicar();
  });

  montarChaves("ordem", [
    { valor: "jogos", rotulo: "Jogos até a marca" },
    { valor: "edicao", rotulo: "Edição" },
  ], (valor) => {
    estado.ordem = valor;
    pintarChaves("ordem", valor);
    aplicar();
  });


  // "Triunfos" ou "vitórias" é escolha da marca: o rótulo se refaz junto.
  aoMudarMarca(() => {
    escreverMetricas();
    pintarChaves("metrica", estado.metrica);
  });

  el("clubes").addEventListener("click", (evento) => {
    const botao = evento.target.closest(".clube");
    if (!botao) return;
    // Clicar num clube leva a marca para o que ele tem hoje: é a comparação
    // que a tela existe para fazer — "em que jogo eu chegava a isto". Quem não
    // está na edição em curso não tem hoje, e cai na mediana das edições dele.
    const atual = estado.atual.clubes.find((c) => c.equipe === botao.dataset.equipe);
    trocarEquipe(botao.dataset.equipe, { alvoDaUrl: atual?.valor ?? null });
  });

  el("outras").addEventListener("click", () => {
    estado.outras = !estado.outras;
    montarListaDeClubes();
  });

  pintarChaves("ordem", estado.ordem);
  trocarSerie(url.serie ?? serieLembrada() ?? "A", url);
}

/* -------------------------------------------------------------- chaves */
function escreverChaves(id, itens) {
  el(id).innerHTML = itens
    .map((i) => `<button type="button" class="chave" data-valor="${i.valor}"
                   aria-pressed="false">${i.rotulo}</button>`).join("");
}

/** O ouvinte fica na caixa, e não nos botões: eles são reescritos. */
function ligarChaves(id, aoEscolher) {
  el(id).addEventListener("click", (evento) => {
    const botao = evento.target.closest(".chave");
    if (botao) aoEscolher(botao.dataset.valor);
  });
}

function montarChaves(id, itens, aoEscolher) {
  escreverChaves(id, itens);
  ligarChaves(id, aoEscolher);
}

function pintarChaves(id, escolhido) {
  for (const botao of el(id).children) {
    botao.setAttribute("aria-pressed", String(botao.dataset.valor === escolhido));
  }
}

function escreverMetricas() {
  const triunfos = marcaAtual().triunfos;
  escreverChaves("metrica", [
    { valor: "pontos", rotulo: "Pontos" },
    { valor: "vitorias", rotulo: triunfos.replace(/^./, (c) => c.toUpperCase()) },
    { valor: "empates", rotulo: "Empates" },
    { valor: "derrotas", rotulo: "Derrotas" },
    { valor: "golsPro", rotulo: "Gols pró" },
    { valor: "golsContra", rotulo: "Gols contra" },
  ]);
  pintarChaves("metrica", estado.metrica);
}

/* ----------------------------------------------------------- filtragem */
function trocarSerie(serie, url = {}) {
  estado.serie = serie;
  lembrarSerie(serie);
  pintarChaves("serie", serie);

  // A lista é a da edição em curso: é dela que sai o "hoje" que cada botão
  // mostra, e é com esse número que a tela compara os anos anteriores.
  montarListaDeClubes();
  const lista = estado.atual.clubes.map((c) => c.equipe);

  const desejada = url.equipe ?? estado.equipe ?? equipeLembrada();
  const escolhida = lista.includes(desejada) ? desejada : lista[0];
  const hoje = estado.atual.clubes.find((c) => c.equipe === escolhida)?.valor;
  trocarEquipe(escolhida, { alvoDaUrl: url.alvo ?? hoje });
}

function trocarEquipe(equipe, { alvoDaUrl = null } = {}) {
  if (!equipe) return;
  estado.equipe = equipe;
  lembrarEquipe(equipe);
  pintarListaDeClubes();

  montarTrilha(alvoDaUrl);
  aplicar();
}

/** O que o clube em foco tem hoje na métrica escolhida, se ele está na lista. */
const valorDeHoje = () =>
  estado.atual.clubes.find((c) => c.equipe === estado.equipe)?.valor ?? null;

/**
 * A lista deitada de clubes, com o número de hoje debaixo de cada escudo.
 *
 * Deitada, e não em `<select>`: o número embaixo é metade da informação — ver
 * de uma vez quem tem 47 e quem tem 28 é o que faz escolher o clube seguinte.
 */
function montarListaDeClubes() {
  estado.atual = situacaoAtual(estado.campanhas,
    { serie: estado.serie, metrica: estado.metrica });
  const nome = METRICAS[estado.metrica]?.nome ?? "";
  const lista = estado.outras ? outrasEquipes() : estado.atual.clubes;

  el("clubes").innerHTML = lista.map((c, i) => `
    <button type="button" class="clube" data-equipe="${c.equipe}"
            title="${nomeComUf(c.equipe)} · ${c.titulo}">
      <span class="clube-pos">${estado.outras ? "" : i + 1}</span>
      <img src="${estado.clubes[c.equipe]?.escudo ?? ""}" alt="${nomeComUf(c.equipe)}">
      <span class="clube-pts">${c.valor ?? "—"}</span>
      <span class="clube-situacao">${estado.outras ? c.rodape : nome}</span>
    </button>`).join("");

  el("outras").setAttribute("aria-pressed", String(estado.outras));
  el("outras").textContent = estado.outras
    ? `Equipes de ${estado.atual.ano ?? "hoje"}` : "Outras equipes";
  el("rotulo-clubes-dica").textContent = estado.outras
    ? "quem já jogou a série em outros anos · a marca abre na mediana das "
      + "edições do clube"
    : "clube da edição em curso, com o que ele tem hoje — clicar leva a marca "
      + "para esse número";
  pintarListaDeClubes();
}

/**
 * Os clubes que já jogaram a série mas não estão na edição em curso.
 *
 * Eles não têm um "hoje" para mostrar, então trazem quantas edições têm na
 * série: é o que diz se vale a pena olhar a comparação.
 */
function outrasEquipes() {
  const deHoje = new Set(estado.atual.clubes.map((c) => c.equipe));
  const nomes = new Set();
  for (const clubes of Object.values(estado.campanhas.series?.[estado.serie] ?? {})) {
    for (const [equipe] of clubes) if (!deHoje.has(equipe)) nomes.add(equipe);
  }

  return [...nomes]
    .map((equipe) => {
      const edicoes = edicoesDoClube(estado.campanhas,
        { serie: estado.serie, equipe }).length;
      return {
        equipe, valor: null,
        rodape: `${edicoes} ${edicoes === 1 ? "edição" : "edições"}`,
        titulo: `${edicoes} ${edicoes === 1 ? "edição" : "edições"} na série`,
      };
    })
    .sort((a, b) => nomeComUf(a.equipe).localeCompare(nomeComUf(b.equipe), "pt-BR"));
}

function pintarListaDeClubes() {
  for (const botao of el("clubes").children) {
    botao.classList.toggle("ativo", botao.dataset.equipe === estado.equipe);
  }
}

/**
 * A régua da marca, refeita a cada troca de clube ou de métrica.
 *
 * O teto é o maior total que o clube já fez naquela conta: pedir uma marca que
 * ele nunca alcançou em edição nenhuma daria uma tela de linhas vazias.
 */
function montarTrilha(alvoDesejado = null) {
  const { campanhas, serie, equipe, metrica } = estado;
  const marcos = marcosDoClube(campanhas, { serie, equipe, metrica, alvo: 1 });
  const teto = Math.max(1, maiorTotal(marcos));
  const querido = alvoDesejado ?? alvoPadrao(marcos);
  estado.alvo = Math.min(teto, Math.max(1, querido));

  trilha = ligarTrilha({
    raiz: el("alvo"), total: teto, crescente: true,
    descrever: (v) => `${v} ${METRICAS[metrica]?.nome ?? ""}`,
    alcas: [{ nome: "alvo", classe: "alca-meta", valor: estado.alvo,
              descricao: "a marca a alcançar" }],
    aoMudar: ({ alvo }) => { estado.alvo = alvo; aplicar(); },
  });
}

function aplicar() {
  const hoje = valorDeHoje();
  el("rotulo-alvo-valor").textContent =
    `${estado.alvo} ${METRICAS[estado.metrica]?.nome ?? ""}`
    + (hoje === null ? "" : ` · hoje: ${hoje}`);
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
           metrica: p.get("metrica"), ordem: p.get("ordem"),
           alvo: inteiro("alvo") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.equipe) p.set("equipe", estado.equipe);
  p.set("metrica", estado.metrica);
  p.set("alvo", estado.alvo);
  p.set("ordem", estado.ordem);
  history.replaceState(null, "", `#${p}`);
}
