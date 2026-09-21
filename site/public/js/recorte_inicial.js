/**
 * Quantos pontos um clube tinha depois de N jogos, em cada edição que disputou.
 *
 * É o retrato da largada, edição por edição. Serve para a pergunta que se faz
 * toda temporada — "este começo é bom para o nosso padrão?" — e a resposta só
 * existe com as próprias edições anteriores do clube ao lado, no mesmo ponto
 * da campanha.
 *
 * O corte é por **jogo**, nunca por rodada: um clube com jogo adiado tem menos
 * jogos do que a rodada sugere, e comparar o 27º jogo de 2026 com a 27ª rodada
 * de 2014 seria comparar situações diferentes.
 *
 * Edição em que o clube ainda não chegou ao N-ésimo jogo fica de fora: ela não
 * tem o que responder. Edição em andamento entra — a largada dela já existe —,
 * mas sem desfecho.
 *
 * Módulo sem dependência nenhuma de propósito: assim `site/testes` carrega no
 * Node e cobra a regra.
 */

/** Todas as edições de uma série em que o clube aparece, da mais nova à antiga. */
export function edicoesDoClube(dados, { serie, equipe }) {
  const anos = dados?.series?.[serie] ?? {};
  const achadas = [];
  for (const [ano, clubes] of Object.entries(anos)) {
    const linha = clubes.find(([nome]) => nome === equipe);
    if (linha) achadas.push({ ano: Number(ano), linha });
  }
  return achadas.sort((a, b) => b.ano - a.ano);
}

/** Quantos jogos o clube já fez na edição em andamento da série, se estiver nela. */
export function jogosNaEdicaoCorrente(dados, { serie, equipe }) {
  for (const { linha } of edicoesDoClube(dados, { serie, equipe })) {
    const [, posFim, acumulado] = linha;
    if (posFim === null) return acumulado.length;
  }
  return null;
}

/**
 * O recorte de cada edição no N-ésimo jogo, ordenado do melhor começo ao pior.
 *
 * Ordenar por pontuação, e não por ano, é o assunto da tela: o que se quer ver
 * é onde este começo se encaixa entre os começos anteriores. O ano continua em
 * cada linha.
 */
export function recortesDoClube(dados, { serie, equipe, jogos }) {
  const saida = [];

  for (const { ano, linha } of edicoesDoClube(dados, { serie, equipe })) {
    const [, posFim, acumulado] = linha;
    if (acumulado.length < jogos) continue;

    const pontosNoCorte = acumulado[jogos - 1];
    const pontosFim = acumulado[acumulado.length - 1];
    const jogosDepois = acumulado.length - jogos;
    const aproveitaAntes = pontosNoCorte / (3 * jogos);
    const aproveitaDepois = jogosDepois > 0
      ? (pontosFim - pontosNoCorte) / (3 * jogosDepois) : null;

    saida.push({
      ano,
      posFim,
      // A edição em andamento não tem desfecho: ela mostra a largada e para
      // por aí. A pontuação "final" dela é a de hoje, não o fim de nada.
      encerrada: posFim !== null,
      jogosTotais: acumulado.length,
      jogosDepois,
      pontosNoCorte,
      pontosFim,
      depois: pontosFim - pontosNoCorte,
      aproveitaAntes,
      aproveitaDepois,
      variacao: aproveitaDepois === null || aproveitaAntes === 0
        ? null : (aproveitaDepois / aproveitaAntes - 1) * 100,
    });
  }

  saida.sort((a, b) => b.pontosNoCorte - a.pontosNoCorte || b.ano - a.ano);
  return saida;
}

/** O balanço do conjunto: quantas edições, e as médias do corte e do fim. */
export function resumoDosRecortes(recortes) {
  const media = (valores) => valores.length
    ? valores.reduce((soma, v) => soma + v, 0) / valores.length : null;
  const encerradas = recortes.filter((r) => r.encerrada);

  return {
    total: recortes.length,
    encerradas: encerradas.length,
    mediaNoCorte: media(recortes.map((r) => r.pontosNoCorte)),
    // Fim e posição só das encerradas: a edição em curso não terminou, e
    // entrar na média puxaria as duas para baixo sem dizer por quê.
    mediaFim: media(encerradas.map((r) => r.pontosFim)),
    posicaoMedia: media(encerradas.map((r) => r.posFim)),
    melhorCorte: recortes.length ? recortes[0] : null,
    piorCorte: recortes.length ? recortes[recortes.length - 1] : null,
  };
}
