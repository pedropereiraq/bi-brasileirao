/**
 * A pontuação de cada posição numa rodada, edição por edição.
 *
 * A pergunta é "como está o campeonato deste ano perto do que costuma ser".
 * A resposta não é uma linha do tempo: é uma grade — cada posição da tabela
 * numa linha, cada edição numa coluna — em que se lê de relance se a briga
 * pelo título está mais dura ou se o meio da tabela está mais embolado que o
 * normal.
 *
 * O índice é a **rodada**, e não o n-ésimo jogo. São perguntas diferentes:
 * "como está o campeonato na rodada 10" é sobre o campeonato, que anda por
 * rodada, enquanto "o clube depois de 10 jogos" é sobre a campanha dele.
 *
 * Módulo sem dependência nenhuma de propósito: assim `site/testes` carrega no
 * Node e cobra a regra.
 */
export const POSICOES = 20;

/** Os anos da série que já chegaram àquela rodada, do mais antigo ao mais novo. */
export function anosComRodada(dados, { serie, rodada }) {
  const anos = dados?.series?.[serie] ?? {};
  return Object.keys(anos)
    .filter((ano) => anos[ano].rodadas >= rodada)
    .map(Number)
    .sort((a, b) => a - b);
}

/** Até que rodada dá para ir numa série: a maior que alguma edição alcançou. */
export function rodadaMaxima(dados, { serie }) {
  const anos = Object.values(dados?.series?.[serie] ?? {});
  return anos.length ? Math.max(...anos.map((e) => e.rodadas)) : 0;
}

/** A rodada em que a edição em andamento está; sem ela, a última possível. */
export function rodadaCorrente(dados, { serie }) {
  const anos = dados?.series?.[serie] ?? {};
  for (const edicao of Object.values(anos)) {
    if (!edicao.encerrada) return edicao.rodadas;
  }
  return rodadaMaxima(dados, { serie });
}

/**
 * A coluna de uma edição naquela rodada: quem estava em cada posição, com
 * quantos pontos, e onde terminou.
 *
 * Edição que ainda não chegou à rodada devolve `null` — a coluna dela não
 * existe, e preencher com o que ela tem hoje seria inventar.
 */
export function colunaDaEdicao(dados, { serie, ano, rodada }) {
  const edicao = dados?.series?.[serie]?.[String(ano)];
  if (!edicao || edicao.rodadas < rodada) return null;

  return {
    ano: Number(ano),
    encerrada: edicao.encerrada,
    celulas: edicao.grade[rodada - 1].map(([indice, pontos], i) => {
      const fim = edicao.fim[indice];
      return {
        posicao: i + 1,
        equipe: edicao.clubes[indice],
        pontos,
        posFim: fim ? fim[0] : null,
        pontosFim: fim ? fim[1] : null,
      };
    }),
  };
}

/**
 * Quem terminou em cada posição daquela edição, e com quantos pontos.
 *
 * Não é a mesma coisa que a coluna da rodada: o 5º da rodada 28 raramente é o
 * 5º do fim. Por isso o desfecho é indexado pela posição **final**, e não pela
 * da rodada escolhida.
 *
 * Edição em andamento devolve uma lista de `null`: não terminou nada ainda.
 */
export function desfechoDaEdicao(dados, { serie, ano }) {
  const edicao = dados?.series?.[serie]?.[String(ano)];
  const vazio = Array.from({ length: POSICOES }, () => null);
  if (!edicao?.encerrada) return vazio;

  const porPosicao = [...vazio];
  edicao.fim.forEach((desfecho, indice) => {
    if (!desfecho) return;
    const [posicao, pontos] = desfecho;
    if (posicao >= 1 && posicao <= POSICOES) {
      porPosicao[posicao - 1] = { equipe: edicao.clubes[indice], pontos };
    }
  });
  return porPosicao;
}

/** A grade inteira: uma coluna por edição que chegou àquela rodada. */
export function grade(dados, { serie, rodada }) {
  return anosComRodada(dados, { serie, rodada })
    .map((ano) => colunaDaEdicao(dados, { serie, ano, rodada }))
    .filter(Boolean);
}

/**
 * Mínimo, média e máximo de cada posição.
 *
 * Só as edições encerradas entram. A do ano corrente é justamente a que se
 * quer comparar com a média — pôr ela dentro da própria média seria comparar
 * um número com ele mesmo diluído.
 */
export function estatisticasPorPosicao(colunas) {
  const encerradas = colunas.filter((c) => c.encerrada);

  return Array.from({ length: POSICOES }, (_, i) => {
    const valores = encerradas
      .map((coluna) => coluna.celulas[i]?.pontos)
      .filter((v) => v !== undefined);
    if (!valores.length) return { posicao: i + 1, minimo: null, media: null, maximo: null, n: 0 };
    return {
      posicao: i + 1,
      minimo: Math.min(...valores),
      media: valores.reduce((soma, v) => soma + v, 0) / valores.length,
      maximo: Math.max(...valores),
      n: valores.length,
    };
  });
}

/**
 * A coluna escolhida contra a média: é aqui que se vê em que região da tabela
 * as equipes estão pontuando mais ou menos do que o normal.
 */
export function comparacaoComAMedia(coluna, estatisticas) {
  if (!coluna) return [];
  return coluna.celulas.map((celula, i) => {
    const media = estatisticas[i]?.media ?? null;
    return {
      ...celula,
      media,
      diferenca: media === null ? null : celula.pontos - media,
    };
  });
}
