/**
 * Os degraus da tabela: a distância de cada clube para o que vem logo abaixo.
 *
 * A classificação é lida como uma fila, mas não é uma fila: é uma escada de
 * degraus de alturas muito diferentes. Um 4º lugar com seis pontos de sobra
 * para o 5º e um 4º lugar empatado com o 5º ocupam a mesma linha da tabela e
 * não são a mesma situação — a tabela esconde isso, e é isso que esta tela
 * mostra.
 *
 * Duas leituras nascem daqui. Numa rodada, a régua: onde a tabela se parte e
 * onde ela se embola. Ao longo da edição, a matriz: quando cada degrau se
 * abriu, e se o campeonato foi ficando mais espalhado ou mais apertado.
 *
 * Módulo sem dependência nenhuma de propósito: recebe a coluna da rodada já
 * pronta — uma lista de `{posicao, equipe, pontos}` em ordem de classificação
 * — e devolve contas, o que deixa `site/testes` carregá-lo no Node.
 */

/**
 * Um degrau por posição, menos a última: o lanterna não tem ninguém abaixo.
 *
 * A distância pode ser zero, e zero aqui é informação: dois clubes empatados
 * em pontos, separados só pelo critério de desempate.
 */
export function degrausDaColuna(coluna) {
  const linhas = coluna ?? [];
  return linhas.slice(0, -1).map((clube, i) => {
    const abaixo = linhas[i + 1];
    return {
      posicao: clube.posicao ?? i + 1,
      equipe: clube.equipe,
      pontos: clube.pontos,
      abaixo,
      distancia: clube.pontos - abaixo.pontos,
    };
  });
}

/**
 * Os clubes agrupados por pontuação, do mais alto para o mais baixo.
 *
 * É o que empilha os empatados na régua: eles ocupam o mesmo ponto do eixo, e
 * a pilha em si vira informação — onde a tabela está cheia.
 */
export function niveisDePontos(coluna) {
  const niveis = [];
  for (const clube of coluna ?? []) {
    const ultimo = niveis.at(-1);
    if (ultimo && ultimo.pontos === clube.pontos) ultimo.clubes.push(clube);
    else niveis.push({ pontos: clube.pontos, clubes: [clube] });
  }
  return niveis;
}

/** Do líder ao lanterna: o tamanho do campeonato naquela rodada. */
export const amplitudeDaTabela = (coluna) =>
  (!coluna?.length ? null : coluna[0].pontos - coluna.at(-1).pontos);

/**
 * O maior degrau da lista.
 *
 * Empate de altura fica com o degrau mais alto na tabela: um vão de cinco
 * pontos entre o 4º e o 5º diz mais sobre o campeonato que o mesmo vão entre o
 * 17º e o 18º, porque é ele que decide vaga.
 */
export function maiorDegrau(degraus) {
  if (!degraus?.length) return null;
  return degraus.reduce((maior, d) =>
    (d.distancia > maior.distancia ? d : maior), degraus[0]);
}

/**
 * A edição inteira: um degrau por posição em cada rodada.
 *
 * `colunas` é a lista de rodadas na ordem delas, e rodada que a edição ainda
 * não alcançou simplesmente não entra — preencher com a tabela de hoje seria
 * inventar uma rodada que não existiu.
 */
export function serieDeDegraus(colunas) {
  return (colunas ?? []).map((coluna, i) => ({
    rodada: coluna?.rodada ?? i + 1,
    degraus: degrausDaColuna(coluna?.celulas ?? coluna),
    amplitude: amplitudeDaTabela(coluna?.celulas ?? coluna),
  }));
}

/** O maior degrau de toda a edição, com a rodada em que aconteceu. */
export function maiorDaSerie(serie) {
  let melhor = null;
  for (const linha of serie ?? []) {
    const maior = maiorDegrau(linha.degraus);
    if (maior && (!melhor || maior.distancia > melhor.distancia)) {
      melhor = { ...maior, rodada: linha.rodada };
    }
  }
  return melhor;
}
