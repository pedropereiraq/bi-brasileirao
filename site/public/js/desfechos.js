/**
 * Quanto cada pontuação rendeu, e quanto custou cada posição.
 *
 * As duas perguntas são a mesma tabela lida de dois jeitos. "68 pontos dão
 * título?" se responde olhando a coluna dos 68 e vendo em que posições ela
 * caiu nas edições passadas; "quanto precisa fazer para ser campeão?" se
 * responde olhando a linha do 1º lugar e vendo a faixa de pontuações que já
 * bastaram. O cruzamento é o mesmo; o que muda é qual eixo a tela põe em pé.
 *
 * Só campanhas encerradas entram: a edição em curso não tem desfecho, e
 * contá-la seria dizer que o 5º de hoje terminou em 5º.
 *
 * A fonte é `fim` de `posicoes.json` — `[posição, pontos]` por clube —, com a
 * variante sem tapetão quando a chave está desligada.
 *
 * Sem `import` nenhum, para `site/testes` carregar no Node.
 */

const fimDaEdicao = (edicao, semTapetao) =>
  (semTapetao && edicao?.fim_st ? edicao.fim_st : edicao?.fim);

/**
 * Uma linha por campanha encerrada da série: ano, clube, posição e pontos.
 */
export function campanhasEncerradas(dados, { serie, semTapetao } = {}) {
  const anos = dados?.series?.[serie] ?? {};
  const saida = [];

  for (const [ano, edicao] of Object.entries(anos)) {
    if (!edicao?.encerrada) continue;
    const fim = fimDaEdicao(edicao, semTapetao) ?? [];
    fim.forEach((desfecho, indice) => {
      if (!desfecho) return;
      const [posicao, pontos] = desfecho;
      saida.push({ ano: Number(ano), equipe: edicao.clubes[indice],
                   posicao, pontos });
    });
  }

  return saida.sort((a, b) => a.ano - b.ano || a.posicao - b.posicao);
}

/** A chave de uma casa da tabela. */
const chave = (pontos, posicao) => `${pontos}:${posicao}`;

/**
 * O cruzamento de pontuação e posição.
 *
 * `porCasa` guarda as campanhas de cada cruzamento, e não só a contagem: é o
 * que a dica do mouse mostra — o ano e o time, que é o que dá sentido ao tom.
 *
 * Os limites saem dos dados, e não de um intervalo fixo: numa Série B de 38
 * rodadas ninguém faz 80 pontos, e esticar a tabela até lá encheria meio card
 * de casas vazias.
 */
export function cruzarPontosEPosicao(campanhas) {
  const lista = campanhas ?? [];
  if (!lista.length) {
    return { minimo: 0, maximo: 0, posicoes: 0, porCasa: new Map(), maior: 0 };
  }

  const pontuacoes = lista.map((c) => c.pontos);
  const porCasa = new Map();
  for (const campanha of lista) {
    const k = chave(campanha.pontos, campanha.posicao);
    if (!porCasa.has(k)) porCasa.set(k, []);
    porCasa.get(k).push(campanha);
  }

  return {
    minimo: Math.min(...pontuacoes),
    maximo: Math.max(...pontuacoes),
    posicoes: Math.max(...lista.map((c) => c.posicao)),
    porCasa,
    maior: Math.max(...[...porCasa.values()].map((c) => c.length)),
  };
}

/** As campanhas de uma casa, da mais antiga à mais nova. */
export function casa(cruzamento, pontos, posicao) {
  return cruzamento?.porCasa.get(chave(pontos, posicao)) ?? [];
}

/**
 * O resumo de uma faixa — uma linha ou uma coluna da tabela.
 *
 * Serve às duas leituras: a pontuação mínima que já bastou para uma posição, a
 * máxima que já não bastou, e quantas campanhas caíram ali.
 */
export function resumoDaPosicao(campanhas, posicao) {
  const daPosicao = (campanhas ?? []).filter((c) => c.posicao === posicao);
  if (!daPosicao.length) return null;
  const pontos = daPosicao.map((c) => c.pontos);
  return {
    posicao,
    campanhas: daPosicao.length,
    minimo: Math.min(...pontos),
    maximo: Math.max(...pontos),
    media: pontos.reduce((s, p) => s + p, 0) / pontos.length,
  };
}

/**
 * Quantas campanhas de cada pontuação naquela posição.
 *
 * Vai do mínimo ao máximo da própria posição, com zero onde não houve
 * ninguém: é a forma da distribuição que interessa — se ela é apertada, a
 * posição tem preço quase fixo; se é larga, o mesmo lugar já custou coisas
 * muito diferentes.
 */
export function distribuicaoDaPosicao(campanhas, posicao) {
  const daPosicao = (campanhas ?? []).filter((c) => c.posicao === posicao);
  if (!daPosicao.length) return [];

  const pontos = daPosicao.map((c) => c.pontos);
  const minimo = Math.min(...pontos), maximo = Math.max(...pontos);
  const conta = new Map();
  for (const p of pontos) conta.set(p, (conta.get(p) ?? 0) + 1);

  return Array.from({ length: maximo - minimo + 1 }, (_, i) => {
    const valor = minimo + i;
    return { pontos: valor, quantidade: conta.get(valor) ?? 0 };
  });
}

/** O mesmo resumo, pela outra ponta: o que cada pontuação já rendeu. */
export function resumoDaPontuacao(campanhas, pontos) {
  const daPontuacao = (campanhas ?? []).filter((c) => c.pontos === pontos);
  if (!daPontuacao.length) return null;
  const posicoes = daPontuacao.map((c) => c.posicao);
  return {
    pontos,
    campanhas: daPontuacao.length,
    melhor: Math.min(...posicoes),
    pior: Math.max(...posicoes),
    media: posicoes.reduce((s, p) => s + p, 0) / posicoes.length,
  };
}
