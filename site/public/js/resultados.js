/**
 * Onde foram parar os pontos de cada jogo: mandante, empate ou visitante.
 *
 * É a pergunta sobre o campeonato, e não sobre um clube. Jogar em casa ainda
 * vale o que valia? Esta edição está mais equilibrada do que as anteriores? A
 * resposta é a mesma distribuição de três colunas, lida de dois jeitos: rodada
 * a rodada dentro de uma edição, ou edição a edição ao longo da série.
 *
 * Trabalha sobre `resultados.json`, onde cada edição traz `rodadas` — uma
 * linha `[mandante, empate, visitante]` por rodada — e o `total` delas.
 *
 * Sem `import` nenhum, para `site/testes` carregar no Node.
 */

/** Os três desfechos possíveis, na ordem em que a barra os empilha. */
export const DESFECHOS = ["mandante", "empate", "visitante"];

const vazio = () => [0, 0, 0];

/** A soma de duas linhas de três colunas. */
const somar = (a, b) => a.map((v, i) => v + (b[i] ?? 0));

/**
 * A fração de cada desfecho, de 0 a 1.
 *
 * Sem jogo nenhum não há fração: devolve `null` em vez de zeros, que seriam
 * lidos como "nenhuma vitória do mandante" quando o que houve foi rodada
 * ainda não disputada.
 */
export function fracoes(linha) {
  const total = (linha ?? []).reduce((s, v) => s + v, 0);
  if (!total) return null;
  return linha.map((v) => v / total);
}

/** A edição pedida, com as rodadas e o total já somado. */
export function edicaoDe(dados, { serie, ano }) {
  const edicao = dados?.series?.[serie]?.[String(ano)];
  if (!edicao) return null;
  return {
    ano: Number(ano),
    encerrada: Boolean(edicao.encerrada),
    rodadas: edicao.rodadas ?? [],
    total: edicao.total ?? vazio(),
  };
}

/** Uma linha por edição da série, da mais antiga à mais nova. */
export function edicoesDaSerie(dados, { serie }) {
  const anos = Object.keys(dados?.series?.[serie] ?? {}).map(Number)
    .sort((a, b) => a - b);
  return anos.map((ano) => edicaoDe(dados, { serie, ano })).filter(Boolean);
}

/**
 * O acumulado da série inteira.
 *
 * `exceto` tira uma edição da conta — é o que permite comparar a edição em
 * foco com as outras sem compará-la consigo mesma diluída. Edição em curso
 * fica sempre de fora: metade de um ano não é um ano.
 */
export function acumuladoDaSerie(dados, { serie, exceto = null,
                                          soEncerradas = true } = {}) {
  const edicoes = edicoesDaSerie(dados, { serie })
    .filter((e) => (!soEncerradas || e.encerrada) && e.ano !== exceto);
  return {
    edicoes: edicoes.length,
    total: edicoes.reduce((acc, e) => somar(acc, e.total), vazio()),
  };
}

/**
 * A diferença entre duas distribuições, em pontos percentuais.
 *
 * É o que a comparação com o histórico quer dizer: "esta edição tem cinco
 * pontos percentuais a mais de vitória do mandante do que o normal da série".
 */
export function diferencaEmPontos(linha, referencia) {
  const a = fracoes(linha), b = fracoes(referencia);
  if (!a || !b) return null;
  return a.map((v, i) => (v - b[i]) * 100);
}

/**
 * A rodada mais desequilibrada para cada lado, para o resumo do card.
 *
 * Rodada sem jogo disputado não concorre: ela não é equilibrada nem
 * desequilibrada, é uma rodada que ainda não aconteceu.
 */
export function rodadasExtremas(rodadas, coluna) {
  const validas = (rodadas ?? [])
    .map((linha, i) => ({ rodada: i + 1, linha, fracao: fracoes(linha) }))
    .filter((r) => r.fracao);
  if (!validas.length) return null;

  const valor = (r) => r.fracao[coluna];
  return {
    maior: validas.reduce((m, r) => (valor(r) > valor(m) ? r : m), validas[0]),
    menor: validas.reduce((m, r) => (valor(r) < valor(m) ? r : m), validas[0]),
  };
}
