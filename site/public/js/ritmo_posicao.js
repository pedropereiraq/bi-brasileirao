/**
 * Aceleração e desaceleração por posição.
 *
 * A pergunta: quem está no 5º lugar na 28ª rodada costuma correr mais ou menos
 * do que vinha correndo? O ritmo é **pontos por rodada** — o acumulado dividido
 * pelo número de rodadas —, e a conta compara o ritmo até ali com o ritmo do
 * que veio depois, para o mesmo clube.
 *
 * O detalhe que sustenta tudo: o clube que está em 5º na rodada 28 quase nunca
 * é o que termina em 5º. Por isso o "depois" não é o da posição, é o **do
 * clube que estava nela** — é ele que acelera ou desacelera. Medir a posição
 * contra ela mesma no fim mediria outra coisa: a inércia da tabela.
 *
 * Só entram edições encerradas. A que está em andamento não tem "depois", e
 * completá-la com o que ela tem hoje inventaria um fim que não aconteceu.
 *
 * Módulo sem dependência nenhuma de propósito: recebe as colunas já prontas e
 * devolve contas, o que deixa `site/testes` carregá-lo no Node.
 */
const media = (valores) => (valores.length
  ? valores.reduce((soma, v) => soma + v, 0) / valores.length : null);

/**
 * O ritmo de cada posição antes e depois da rodada escolhida.
 *
 * `edicoes` é uma lista de `{ano, rodadas, celulas}`, em que cada célula traz
 * `{posicao, equipe, pontos, pontosFim}` na rodada analisada.
 */
export function ritmoDasPosicoes(edicoes, { rodada, posicoes = 20 } = {}) {
  const saida = [];

  for (let posicao = 1; posicao <= posicoes; posicao++) {
    const porEdicao = [];

    for (const edicao of edicoes ?? []) {
      const celula = edicao.celulas?.[posicao - 1];
      const restantes = (edicao.rodadas ?? 38) - rodada;
      if (!celula || celula.pontosFim === null || restantes <= 0) continue;

      const antes = celula.pontos / rodada;
      const depois = (celula.pontosFim - celula.pontos) / restantes;
      porEdicao.push({
        ano: edicao.ano, equipe: celula.equipe,
        pontos: celula.pontos, pontosFim: celula.pontosFim,
        antes, depois, diferenca: depois - antes,
      });
    }

    const antes = media(porEdicao.map((e) => e.antes));
    const depois = media(porEdicao.map((e) => e.depois));
    saida.push({
      posicao, porEdicao,
      amostras: porEdicao.length,
      antes, depois,
      diferenca: antes === null ? null : depois - antes,
      aceleraram: porEdicao.filter((e) => e.diferenca > 0).length,
      desaceleraram: porEdicao.filter((e) => e.diferenca < 0).length,
    });
  }
  return saida;
}

/** Quem mais acelera e quem mais desacelera, para a manchete do card. */
export function extremosDoRitmo(linhas) {
  const validas = (linhas ?? []).filter((l) => l.diferenca !== null);
  if (!validas.length) return { acelera: null, desacelera: null };
  return {
    acelera: validas.reduce((m, l) => (l.diferenca > m.diferenca ? l : m)),
    desacelera: validas.reduce((m, l) => (l.diferenca < m.diferenca ? l : m)),
  };
}

/**
 * O ritmo médio daquela posição rodada a rodada.
 *
 * `porRodada` é `[{rodada, pontos: [...]}]`, uma entrada por rodada com a
 * pontuação que aquela posição tinha em cada edição. O ritmo é o acumulado
 * dividido pela rodada: a curva mostra se a posição vai ficando mais cara ou
 * mais barata ao longo do campeonato.
 */
export function ritmoPorRodada(porRodada) {
  return (porRodada ?? []).map(({ rodada, pontos }) => {
    const m = media(pontos ?? []);
    return { rodada, ritmo: m === null ? null : m / rodada, amostras: (pontos ?? []).length };
  });
}
