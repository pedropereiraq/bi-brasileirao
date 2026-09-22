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
 * A distância entre duas posições, edição por edição, naquela rodada.
 *
 * A grade de médias responde "quanto vale cada posição"; esta responde "quanto
 * separa uma da outra", que é outra pergunta: um campeonato pode ter o 4º
 * lugar valendo o de sempre e mesmo assim ser o ano em que o G4 mais se
 * descolou do Z4.
 *
 * A diferença nunca é negativa — as posições saem de uma tabela ordenada, e
 * quem está acima tem pelo menos tantos pontos quanto quem está abaixo.
 */
export function distanciaEntrePosicoes(dados, { serie, rodada, melhor, pior }) {
  const cima = Math.min(melhor, pior);
  const baixo = Math.max(melhor, pior);

  const linhas = [];
  for (const ano of anosComRodada(dados, { serie, rodada })) {
    const coluna = colunaDaEdicao(dados, { serie, ano, rodada });
    const de = coluna?.celulas[cima - 1];
    const ate = coluna?.celulas[baixo - 1];
    if (!de || !ate) continue;
    linhas.push({
      ano, encerrada: coluna.encerrada,
      melhor: de, pior: ate, diferenca: de.pontos - ate.pontos,
    });
  }
  return linhas;
}

/**
 * Os três números do card e as duas médias que viram linha no gráfico.
 *
 * O extremo devolve a linha inteira, e não só o valor: quem olha a maior
 * distância quer saber de que ano ela é.
 */
export function resumoDaDistancia(linhas) {
  if (!linhas?.length) return null;

  const soma = (pegar) => linhas.reduce((s, l) => s + pegar(l), 0);
  const extremo = (vence) =>
    linhas.reduce((m, l) => (vence(l.diferenca, m.diferenca) ? l : m), linhas[0]);

  return {
    edicoes: linhas.length,
    media: soma((l) => l.diferenca) / linhas.length,
    maxima: extremo((v, m) => v > m),
    minima: extremo((v, m) => v < m),
    mediaMelhor: soma((l) => l.melhor.pontos) / linhas.length,
    mediaPior: soma((l) => l.pior.pontos) / linhas.length,
  };
}

/**
 * O que não chegou à tabela até aquela rodada, naquela edição.
 *
 * Toda rodada põe em disputa três pontos por jogo, e a tabela quase nunca
 * recebe os três: o empate distribui dois e queima o terceiro para sempre, e o
 * jogo por disputar retém os três até acontecer.
 *
 * É o que impede de ler uma coluna inteira abaixo da média como campeonato
 * fraco — pode ser só ponto que não foi distribuído.
 */
export function perdaDaTabela(dados, { serie, ano, rodada }) {
  const edicao = dados?.series?.[serie]?.[String(ano)];
  if (!edicao || edicao.rodadas < rodada) return null;

  const [queimados, retidos] = edicao.fluxo?.[rodada - 1] ?? [];
  if (queimados === undefined) return null;

  const possiveis = (edicao.clubes.length / 2) * rodada * 3;
  const faltando = queimados + retidos;
  return {
    queimados, retidos, possiveis, faltando,
    distribuidos: possiveis - faltando,
    fracao: possiveis > 0 ? faltando / possiveis : 0,
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

/**
 * A diferença para a média em cada posição, rodada a rodada.
 *
 * É a grade da tela de médias virada de lado: lá cada coluna é uma edição numa
 * rodada; aqui cada coluna é uma rodada de uma edição só. O que se ganha com
 * isso é o movimento — a sobra de pontos que numa rodada está no fim da tabela
 * aparece semanas depois no meio dela, e é esse deslocamento que a leitura
 * quer mostrar.
 *
 * A média de cada rodada é recalculada com as edições que chegaram àquela
 * rodada, e sempre sem a que está sendo desenhada: comparar uma edição com uma
 * média que a inclui é comparar um número com ele mesmo diluído.
 */
export function evolucaoDaDiferenca(dados, { serie, ano }) {
  const edicao = dados?.series?.[serie]?.[String(ano)];
  if (!edicao) return [];

  const saida = [];
  for (let rodada = 1; rodada <= edicao.rodadas; rodada++) {
    const colunas = grade(dados, { serie, rodada })
      .filter((coluna) => coluna.ano !== Number(ano));
    const estatisticas = estatisticasPorPosicao(colunas);
    const coluna = colunaDaEdicao(dados, { serie, ano, rodada });
    saida.push({ rodada, celulas: comparacaoComAMedia(coluna, estatisticas) });
  }
  return saida;
}
