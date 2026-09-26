/**
 * Quantos jogos um clube levou para chegar a X, edição por edição.
 *
 * "45 pontos" é a marca que todo mundo cita, mas ela não diz nada sozinha: o
 * que se quer saber é **quando** o clube costuma chegar lá. Vinte e cinco
 * jogos num ano, trinta e quatro no outro, e o ano em que não chegou — é essa
 * comparação que responde se a temporada está indo bem.
 *
 * O X é o mesmo para todas as edições, e o que varia é o número de jogos. Por
 * isso a barra mais curta é a melhor notícia em qualquer das métricas boas, e
 * a pior em derrotas e gols sofridos — a cor é que diz de que lado a marca
 * cai.
 *
 * O índice é o **jogo**, nunca a rodada: um clube com jogo adiado chega à 20ª
 * rodada com 18 jogos, e comparar isso com a 20ª rodada de outro ano seria
 * comparar campanhas de tamanhos diferentes.
 *
 * Trabalha sobre `campanhas_detalhe.json`, onde cada clube de cada edição é
 * `[equipe, pos_fim, vitorias, empates, gols_pro, gols_contra]`, tudo
 * acumulado jogo a jogo. Derrota e ponto não vêm no arquivo porque se
 * deduzem: derrota é o jogo menos a vitória e o empate, ponto é três vezes a
 * vitória mais o empate.
 *
 * Sem `import` nenhum, para `site/testes` carregar no Node.
 */

/** As métricas que a tela procura, e de que lado cada uma cai. */
export const METRICAS = {
  pontos: { nome: "pontos", sentido: "bom" },
  vitorias: { nome: "vitórias", sentido: "bom" },
  empates: { nome: "empates", sentido: "neutro" },
  derrotas: { nome: "derrotas", sentido: "ruim" },
  golsPro: { nome: "gols pró", sentido: "bom" },
  golsContra: { nome: "gols sofridos", sentido: "ruim" },
};

/**
 * O nome da métrica na língua de quem vai publicar.
 *
 * O ECBahia escreve **triunfo** e nunca "vitória"; o Podcast45 escreve
 * **vitória** e nunca "triunfo". A palavra chega de fora, em `triunfos`,
 * porque este módulo não conhece marca nenhuma — nem pode, para o Node
 * carregá-lo nos testes.
 */
export function nomeDaMetrica(metrica, { triunfos } = {}) {
  if (metrica === "vitorias" && triunfos) return triunfos;
  return METRICAS[metrica]?.nome ?? "pontos";
}

/** A curva acumulada daquela métrica, jogo a jogo. */
export function curvaDaMetrica(linha, metrica) {
  const [, , vitorias, empates, golsPro, golsContra] = linha ?? [];
  if (!vitorias) return [];
  switch (metrica) {
    case "vitorias": return vitorias;
    case "empates": return empates;
    case "derrotas": return vitorias.map((v, i) => i + 1 - v - empates[i]);
    case "golsPro": return golsPro;
    case "golsContra": return golsContra;
    default: return vitorias.map((v, i) => 3 * v + empates[i]);
  }
}

/**
 * Em que jogo a curva alcança o alvo, ou `null` quando ela não alcança.
 *
 * A curva é acumulada e nunca cai, então o primeiro jogo que chega ao alvo é
 * o que responde — não há por que varrer o resto.
 */
export function jogoQueAlcanca(curva, alvo) {
  const i = (curva ?? []).findIndex((v) => v >= alvo);
  return i === -1 ? null : i + 1;
}

/** Todas as edições daquela série em que o clube aparece, da mais nova à antiga. */
export function edicoesDoClube(dados, { serie, equipe }) {
  const anos = dados?.series?.[serie] ?? {};
  const achadas = [];
  for (const [ano, clubes] of Object.entries(anos)) {
    const linha = clubes.find(([nome]) => nome === equipe);
    if (linha) achadas.push({ ano: Number(ano), linha });
  }
  return achadas.sort((a, b) => b.ano - a.ano);
}

/**
 * Uma linha por edição: quando o clube chegou ao alvo, e onde terminou.
 *
 * `jogos` é `null` na edição em que ele não chegou — e é uma resposta, não uma
 * falta de resposta. `total` é quanto ele fez ao todo naquela métrica, que é o
 * que explica o `null`.
 */
export function marcosDoClube(dados, { serie, equipe, metrica, alvo }) {
  return edicoesDoClube(dados, { serie, equipe }).map(({ ano, linha }) => {
    const curva = curvaDaMetrica(linha, metrica);
    const posFim = linha[1];
    return {
      ano,
      encerrada: posFim !== null,
      posFim,
      jogos: jogoQueAlcanca(curva, alvo),
      jogosNaEdicao: curva.length,
      total: curva.length ? curva[curva.length - 1] : 0,
    };
  });
}

/**
 * A ordem das linhas.
 *
 * Por jogos, quem chegou primeiro em cima — é a pergunta da tela. Quem não
 * chegou vai para o fim, e entre esses o que chegou mais perto fica na frente:
 * a lista continua contando a mesma história depois do corte.
 */
export function ordenarMarcos(marcos, ordem = "jogos") {
  const lista = [...(marcos ?? [])];
  if (ordem === "edicao") return lista.sort((a, b) => b.ano - a.ano);
  return lista.sort((a, b) => {
    if (a.jogos === null || b.jogos === null) {
      if (a.jogos === b.jogos) return b.total - a.total || b.ano - a.ano;
      return a.jogos === null ? 1 : -1;
    }
    return a.jogos - b.jogos || b.ano - a.ano;
  });
}

/** O maior total do clube naquela métrica: é até onde o alvo pode ir. */
export function maiorTotal(marcos) {
  return (marcos ?? []).reduce((maior, m) => Math.max(maior, m.total), 0);
}

/**
 * O alvo que a tela abre.
 *
 * A mediana dos totais: metade das edições chega, metade não. Qualquer número
 * redondo escolhido a dedo seria bom para pontos e sem sentido para empates.
 */
export function alvoPadrao(marcos) {
  const totais = (marcos ?? []).map((m) => m.total).sort((a, b) => a - b);
  if (!totais.length) return 1;
  const meio = Math.floor(totais.length / 2);
  const mediana = totais.length % 2
    ? totais[meio] : (totais[meio - 1] + totais[meio]) / 2;
  return Math.max(1, Math.round(mediana));
}

/**
 * A edição mais recente da série, e o que cada clube tem nela.
 *
 * É a lista de clubes da tela e, junto, a resposta que serve de marca padrão:
 * "quantos jogos eu levava para chegar ao que tenho hoje" é a pergunta que se
 * faz olhando a tabela de agora.
 *
 * A ordem põe o melhor primeiro em qualquer métrica: mais gols pró é melhor,
 * menos gols sofridos também — o que muda é o sentido da conta, e é ele que
 * decide de que lado a lista começa.
 */
export function situacaoAtual(dados, { serie, metrica }) {
  const anos = Object.keys(dados?.series?.[serie] ?? {}).map(Number);
  if (!anos.length) return { ano: null, clubes: [] };

  const ano = Math.max(...anos);
  const ruim = METRICAS[metrica]?.sentido === "ruim";
  const clubes = (dados.series[serie][String(ano)] ?? []).map((linha) => {
    const curva = curvaDaMetrica(linha, metrica);
    return {
      equipe: linha[0],
      valor: curva.length ? curva[curva.length - 1] : 0,
      jogos: curva.length,
    };
  }).sort((a, b) => (ruim ? a.valor - b.valor : b.valor - a.valor)
                 || a.equipe.localeCompare(b.equipe, "pt-BR"));

  return { ano, clubes };
}

/**
 * Os números do alto do card.
 *
 * A média de jogos conta só quem alcançou: misturar o ano em que o clube não
 * chegou faria uma média de uma coisa com a ausência dela.
 */
export function resumoDosMarcos(marcos) {
  const lista = marcos ?? [];
  const chegaram = lista.filter((m) => m.jogos !== null);
  const media = chegaram.length
    ? chegaram.reduce((s, m) => s + m.jogos, 0) / chegaram.length : null;
  const maisRapido = chegaram.length
    ? chegaram.reduce((melhor, m) => (m.jogos < melhor.jogos ? m : melhor),
                      chegaram[0])
    : null;
  return {
    edicoes: lista.length,
    alcancaram: chegaram.length,
    media,
    maisRapido,
  };
}
