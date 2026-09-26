/**
 * Página do card de distribuição de resultados.
 *
 * Duas perguntas, dois modos. **Na edição**: como este ano repartiu os jogos
 * entre mandante, empate e visitante, rodada a rodada, e o quanto isso foge do
 * normal da série. **No histórico**: como cada edição repartiu, e o que o
 * acumulado de todas diz.
 *
 * O filtro de edição só existe no primeiro: no histórico, a edição é o eixo.
 * O recorte de rodadas é o contrário — só existe no histórico, onde ele
 * responde a pergunta que a tela não respondia: se o mando pesa mais no começo
 * do ano do que na reta final. Na edição as rodadas já são o eixo.
 */
import { lembrarSerie, serieLembrada } from "/js/preferencias.js";
import { ligarPaginaDeCard, definirMensagemSemCard } from "/js/pagina_card.js";
import { montarCartao } from "/js/cartao_resultados.js";
import { ligarSeletorDeRodadas } from "/js/seletor_posicoes.js";
import { edicaoDe, maiorNumeroDeRodadas } from "/js/resultados.js";

const estado = {
  resultados: null, serie: null, ano: null, modo: "edicao",
  rodadas: 38, de: 1, ate: 38, intervalo: null,
};

const el = (id) => document.getElementById(id);
let redesenhar = () => {};
let trilha = null;

/**
 * O recorte de rodadas, ou `null` quando ele é o campeonato inteiro.
 *
 * O card usa o `null` para saber que não há recorte nenhum a anunciar no
 * título — "da 1ª à 38ª rodada" seria gastar a linha para não dizer nada.
 */
const intervalo = () =>
  (estado.de === 1 && estado.ate >= estado.rodadas
    ? null : { de: estado.de, ate: estado.ate });

inicializar().catch((erro) => {
  el("aviso-card").hidden = false;
  el("aviso-card").textContent = `não foi possível carregar: ${erro.message}`;
});

async function inicializar() {
  definirMensagemSemCard("esta série ainda não tem jogos para distribuir");
  redesenhar = ligarPaginaDeCard(() => montarCartao(estado));

  estado.resultados = await fetch("/dados/resultados.json").then((r) => r.json());

  const url = daUrl();
  if (url.modo === "historico" || url.modo === "edicao") estado.modo = url.modo;

  montarChaves("modo", [
    ["edicao", "Na edição"], ["historico", "Histórico"],
  ], (valor) => { estado.modo = valor; aplicar(); });

  montarChaves("serie",
    Object.keys(estado.resultados.series ?? {}).sort()
      .map((s) => [s, `Série ${s}`]),
    (valor) => trocarSerie(valor));

  el("ano").addEventListener("change", () => {
    estado.ano = Number(el("ano").value);
    aplicar();
  });

  trocarSerie(url.serie ?? serieLembrada() ?? "A", url);
}

/** A trilha das rodadas, refeita quando a série troca de tamanho. */
function montarTrilhaDeRodadas(total, url = {}) {
  estado.rodadas = total;
  estado.de = Math.min(Math.max(1, Number(url.de) || estado.de || 1), total);
  estado.ate = Math.min(Math.max(estado.de, Number(url.ate) || total), total);

  trilha = ligarSeletorDeRodadas({
    raiz: el("rodadas"), total, de: estado.de, ate: estado.ate,
    aoMudar: ({ de, ate }) => {
      Object.assign(estado, { de, ate });
      aplicar();
    },
  });
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

  const anos = Object.keys(estado.resultados.series?.[serie] ?? {})
    .map(Number).sort((a, b) => b - a);
  el("ano").innerHTML = anos.map((a) => `<option value="${a}">${a}</option>`).join("");

  const desejado = Number(url.ano ?? estado.ano);
  estado.ano = anos.includes(desejado) ? desejado : anos[0];
  el("ano").value = estado.ano;

  montarTrilhaDeRodadas(
    maiorNumeroDeRodadas(estado.resultados, { serie }) || 38, url);

  aplicar();
}

function aplicar() {
  pintarChaves("modo", estado.modo);
  pintarChaves("serie", estado.serie);

  // No histórico a edição é o eixo do gráfico, e escolher uma não muda nada.
  // Na edição as rodadas já são o eixo, e recortá-las seria recortar a tela.
  const historico = estado.modo === "historico";
  el("campo-ano").hidden = historico;
  el("campo-rodadas").hidden = !historico;

  const edicao = edicaoDe(estado.resultados,
    { serie: estado.serie, ano: estado.ano });
  const jogos = edicao?.total.reduce((s, v) => s + v, 0) ?? 0;
  const recorte = intervalo();
  estado.intervalo = historico ? recorte : null;
  el("resumo-rodadas").textContent = recorte
    ? (recorte.de === recorte.ate
        ? `só a ${recorte.de}ª rodada de cada edição`
        : `da ${recorte.de}ª à ${recorte.ate}ª rodada de cada edição`)
    : "o campeonato inteiro de cada edição";
  el("rodape-edicao").textContent = historico
    ? `Série ${estado.serie} · todas as edições do recorte`
    : `Série ${estado.serie} ${estado.ano} · ${jogos} jogos disputados`;

  atualizarUrl();
  redesenhar();
}

function daUrl() {
  const p = new URLSearchParams(location.hash.slice(1));
  return { serie: p.get("serie"), ano: p.get("ano"), modo: p.get("modo"),
           de: p.get("de"), ate: p.get("ate") };
}

function atualizarUrl() {
  const p = new URLSearchParams();
  if (estado.serie) p.set("serie", estado.serie);
  p.set("modo", estado.modo);
  if (estado.modo !== "historico" && estado.ano) p.set("ano", estado.ano);
  if (estado.modo === "historico" && intervalo()) {
    p.set("de", estado.de);
    p.set("ate", estado.ate);
  }
  history.replaceState(null, "", `#${p}`);
}
