/**
 * Aceleração e desaceleração por posição.
 *
 * A pergunta: o 5º lugar na 28ª rodada costuma valer mais ou menos pontos por
 * rodada do que vai valer depois? O sujeito é a **posição**, e não um clube.
 *
 * As duas pontas são medidas do mesmo jeito — pontos da posição divididos pela
 * rodada —, e é isso que as torna comparáveis. O **antes** é essa conta na
 * rodada escolhida. O **depois** é a média dessa conta em cada uma das rodadas
 * seguintes: a posição tem um ritmo na 29ª, outro na 30ª, e o que interessa é
 * o nível médio em que ela passou a correr.
 *
 * O que **não** serve é subtrair as duas pontas — "pontos do 5º no fim menos
 * pontos do 5º na 28ª" mistura os totais de dois clubes diferentes, e o
 * resultado não é o ritmo de ninguém: em 2023 daria 1,9 por rodada, que não é
 * nem do Athletico, que caiu da posição, nem do Botafogo, que terminou nela
 * com muito mais do que 45 pontos na bagagem.
 *
 * Os dois clubes viajam junto com o número — o que ocupava a posição na rodada
 * e o que terminou nela — porque quase nunca são o mesmo, e ver os dois é o
 * que impede de ler a conta como se fosse de um time.
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
 * `edicoes` é uma lista de `{ano, rodadas, celulas}`. Cada célula traz
 * `{posicao, equipe, pontos}` — quem estava na posição na rodada analisada e
 * com quantos pontos —, `{equipeFim, pontosFim}` para o card mostrar as duas
 * pontas, e `seguintes`, que é `[{rodada, pontos}]` com a pontuação da posição
 * em cada rodada depois da escolhida. É de `seguintes` que sai o depois.
 */
export function ritmoDasPosicoes(edicoes, { rodada, posicoes = 20 } = {}) {
  const saida = [];

  for (let posicao = 1; posicao <= posicoes; posicao++) {
    const porEdicao = [];

    for (const edicao of edicoes ?? []) {
      const celula = edicao.celulas?.[posicao - 1];
      const seguintes = celula?.seguintes ?? [];
      if (!celula || celula.pontosFim === null || !seguintes.length) continue;

      const antes = celula.pontos / rodada;
      const depois = media(seguintes.map((s) => s.pontos / s.rodada));
      porEdicao.push({
        ano: edicao.ano,
        equipe: celula.equipe, pontos: celula.pontos,
        equipeFim: celula.equipeFim ?? null, pontosFim: celula.pontosFim,
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
