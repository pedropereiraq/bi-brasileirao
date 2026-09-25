/**
 * Página do card de dificuldade de tabela.
 *
 * Fora do card, três escolhas obrigatórias — quais jogos, se o local conta, e
 * em que unidade se mede — mais a ordem da lista e o clube aberto no painel.
 * Nenhuma delas é detalhe: cada uma responde a uma pergunta diferente com os
 * mesmos jogos, e por isso todas ficam à vista.
 *
 * O padrão de "quais jogos" segue o calendário. Na primeira metade, a pergunta
 * é o que já passou — é ela que explica a campanha até aqui. Da metade em
 * diante, vira o que falta, que é a pergunta da reta final.
 */
import {
  RODADA, DATA, MANDANTE, VISITANTE, GOLS_M, GOLS_V, STATUS, tabela,
} from "/js/motor.js";
import {
  aoMudarTapetao, descontosDe,
} from "/js/tapetao.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_dificuldade.js";
import { nomeBonito } from "/js/nomes.js";

const estado = {
  edicoes: [], clubes: {},
  serie: null, edicao: null, agendas: {}, tabelas: null,
  quando: "realizados", local: "ignorar", criterio: "posicao",
  ordem: "dificuldade", destaque: "",
  aoEscolher: (equipe) => {
    estado.destaque = estado.destaque === equipe ? "" : equipe;
    el("destaque").value = estado.destaque;
    aplicar();
  },
};

const GRUPOS = {
  quando: [["realizados", "Jogos realizados"], ["aRealizar", "Jogos a realizar"]],
  local: [["ignorar", "Não considerar o local"],
          ["considerar", "Considerar o local"]],
  criterio: [["posicao", "Pela posição"], ["aproveitamento", "Pelo aproveitamento"]],
  ordem: [["dificuldade", "Dificuldade"], ["classificacao", "Classificação"]],
};

// Os descontos de tapetão da edição em foco, vazios quando a chave está
// desligada. É o mesmo ajudante em todas as páginas que montam tabela.
const descontos = () =>
  descontosDe(estado.serie, estado.edicao?.ano ?? estado.ano);

const el = (id) => document.getElementById(id);
let redesenhar = () => {};

// Virar a chave do tapetão muda a tabela: a página inteira se redesenha.
aoMudarTapetao(() => aplicar());
let escolhaDoUsuario = { quando: false };

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("esta edição ainda não tem jogos para comparar");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  const [edicoes, clubes] = await Promise.all([
    fetch("/dados/edicoes.json").then((r) => r.json()),
    fetch("/dados/clubes.json").then((r) => r.json()),
  ]);
  Object.assign(estado, { edicoes: edicoes.edicoes, clubes });

  for (const [id, itens] of Object.entries(GRUPOS)) {
    montarChaves(id, itens, (valor) => {
      estado[id] = valor;
      if (id === "quando") escolhaDoUsuario.quando = true;
      aplicar();
    });
  }

  montarChaves("serie",
    [...new Set(estado.edicoes.map((e) => e.serie))].sort()
      .map((s) => [s, `Série ${s}`]),
    (valor) => trocarSerie(valor));

  el("ano").addEventListener("change", () => trocarAno(el("ano").value));
  el("destaque").addEventListener("change", () => {
    estado.destaque = el("destaque").value;
    aplicar();
  });

  const url = daUrl();
  for (const id of Object.keys(GRUPOS)) {
    if (GRUPOS[id].some(([valor]) => valor === url[id])) {
      estado[id] = url[id];
      if (id === "quando") escolhaDoUsuario.quando = true;
    }
  }
  await trocarSerie(url.serie ?? "A", url);
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
  const clubes = [...new Set(jogos.flatMap((j) => [j[MANDANTE], j[VISITANTE]]))].sort();

  const porNome = (lista) => Object.fromEntries(lista.map((c) => [c.equipe, c]));
  Object.assign(estado, {
    edicao,
    agendas: montarAgendas(jogos, clubes),
    tabelas: {
      geral: porNome(tabela(jogos, clubes, {}, descontos())),
      casa: porNome(tabela(jogos, clubes, { mando: "casa" }, descontos())),
      fora: porNome(tabela(jogos, clubes, { mando: "fora" }, descontos())),
    },
  });

  // O padrão só vale enquanto o usuário não escolher: depois disso, trocar de
  // edição não pode desfazer a escolha dele.
  if (!escolhaDoUsuario.quando) estado.quando = padraoDoQuando(edicao);

  el("destaque").innerHTML = '<option value="">nenhuma</option>'
    + clubes.map((c) => `<option value="${c}">${nomeBonito(c)}</option>`).join("");
  const querido = url.destaque ?? estado.destaque;
  estado.destaque = clubes.includes(querido) ? querido : "";
  el("destaque").value = estado.destaque;

  aplicar();
}

/**
 * Até a metade do campeonato, o que já passou; daí em diante, o que falta.
 *
 * Edição encerrada não tem o que faltar: nela a pergunta é sempre a primeira.
 */
function padraoDoQuando(edicao) {
  if (edicao.realizados >= edicao.jogos) return "realizados";
  return edicao.realizados / edicao.jogos >= .5 ? "aRealizar" : "realizados";
}

function montarAgendas(jogos, clubes) {
  const agendas = Object.fromEntries(clubes.map((c) => [c, []]));
  // O placar vai junto, do ponto de vista de cada lado: no recorte dos jogos
  // já realizados é ele que vira etiqueta, no lugar do mando.
  const desfecho = (gp, gc) => (gp > gc ? "T" : gp === gc ? "E" : "D");
  for (const j of jogos) {
    const feito = j[STATUS] === "realizado"
      && j[GOLS_M] !== null && j[GOLS_V] !== null;
    const comum = { rodada: j[RODADA], data: j[DATA], realizado: feito };
    const gm = feito ? j[GOLS_M] : null;
    const gv = feito ? j[GOLS_V] : null;
    agendas[j[MANDANTE]]?.push({
      ...comum, adversario: j[VISITANTE], mando: "casa",
      gp: gm, gc: gv, resultado: feito ? desfecho(gm, gv) : null,
    });
    agendas[j[VISITANTE]]?.push({
      ...comum, adversario: j[MANDANTE], mando: "fora",
      gp: gv, gc: gm, resultado: feito ? desfecho(gv, gm) : null,
    });
  }
  for (const lista of Object.values(agendas)) {
    lista.sort((a, b) => (a.data === b.data ? a.rodada - b.rodada
                                            : a.data < b.data ? -1 : 1));
  }
  return agendas;
}

function aplicar() {
  for (const id of Object.keys(GRUPOS)) pintarChaves(id, estado[id]);

  const { edicao } = estado;
  el("rodape-edicao").textContent = edicao
    ? `Série ${estado.serie} ${edicao.ano} · ${edicao.realizados} de `
      + `${edicao.jogos} jogos disputados`
    : "";
  atualizarUrl();
  redesenhar();
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  return {
    serie: p.get("serie"), ano: p.get("ano"), destaque: p.get("destaque"),
    quando: p.get("quando"), local: p.get("local"),
    criterio: p.get("criterio"), ordem: p.get("ordem"),
  };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  if (estado.edicao) p.set("ano", estado.edicao.apelido);
  for (const id of Object.keys(GRUPOS)) p.set(id, estado[id]);
  if (estado.destaque) p.set("destaque", estado.destaque);
  history.replaceState(null, "", `#${p}`);
}
