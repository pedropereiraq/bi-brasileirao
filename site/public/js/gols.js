/**
 * Gols marcados e sofridos, e o que eles têm a ver com a posição.
 *
 * A classificação já traz as duas colunas, mas enterradas no meio das outras
 * seis: quem lê a tabela vê pontos, e os gols entram só como desempate. Esta
 * tela inverte a hierarquia — os gols são o assunto, e os pontos ficam ao
 * lado para dizer no que aquilo deu.
 *
 * Duas medidas, porque as duas respondem a perguntas diferentes: o **total**
 * diz quanto o clube produziu na edição, e a **média por jogo** diz a que
 * ritmo ele produz. Com jogo adiado as duas divergem, e é aí que a média vale
 * — um clube com dois jogos a menos aparece pequeno no total sem ter produzido
 * menos por jogo.
 *
 * Gols sofridos sobem na ordem, e não descem: a pergunta do ranking de gols
 * contra é quem sofre menos, não quem sofre mais.
 *
 * Trabalha sobre a classificação já montada pelo motor — `{ equipe, pos, pts,
 * j, gp, gc }` — e não tem `import` nenhum, para `site/testes` carregar no
 * Node e cobrar a regra.
 */

/** O campo de cada visão, e o que a tela chama de "os gols" nela. */
export const VISOES = {
  ambos: { campo: null, criterioPadrao: "pontos" },
  pro: { campo: "gp", criterioPadrao: "pro" },
  contra: { campo: "gc", criterioPadrao: "contra" },
};

const POR_JOGO = { gp: "gpPorJogo", gc: "gcPorJogo", sg: "sgPorJogo" };

/** Uma linha por clube, com o total e a média por jogo dos dois lados. */
export function linhasDeGols(tabela) {
  return (tabela ?? []).map((c) => {
    const sg = c.gp - c.gc;
    return {
      equipe: c.equipe, pos: c.pos, pts: c.pts, j: c.j,
      gp: c.gp, gc: c.gc, sg,
      // Sem jogo não há ritmo: `null` em vez de zero, que seria lido como
      // "não faz gol" quando o que houve foi não ter jogado.
      gpPorJogo: c.j > 0 ? c.gp / c.j : null,
      gcPorJogo: c.j > 0 ? c.gc / c.j : null,
      sgPorJogo: c.j > 0 ? sg / c.j : null,
    };
  });
}

/** O número que a tela está medindo, na medida escolhida. */
export function valorDe(linha, campo, medida = "total") {
  if (!linha) return null;
  return medida === "media" ? linha[POR_JOGO[campo]] ?? null : linha[campo];
}

/**
 * A ordem do ranking.
 *
 * Empate em gols mantém a ordem da classificação: são duas equipes que
 * marcaram o mesmo, e o que as separa é o que já as separava na tabela —
 * inventar um desempate novo aqui seria dizer que uma delas marcou mais.
 *
 * Clube sem jogo no recorte vai para o fim em qualquer critério: ele não tem
 * média, e zero gols sofridos o poria como melhor defesa da edição.
 */
export function ordenarPorGols(linhas, criterio = "pontos", medida = "total") {
  const campo = criterio === "pro" ? "gp" : criterio === "contra" ? "gc" : null;
  const ordem = [...(linhas ?? [])];
  if (!campo) return ordem.sort((a, b) => a.pos - b.pos);

  // Gols sofridos sobem; gols marcados descem.
  const sinal = campo === "gc" ? 1 : -1;
  const valor = (l) => (l.j > 0 ? valorDe(l, campo, medida) : null);
  return ordem.sort((a, b) => {
    const va = valor(a), vb = valor(b);
    if (va === null || vb === null) return (va === null) - (vb === null)
                                        || a.pos - b.pos;
    return sinal * (va - vb) || a.pos - b.pos;
  });
}

/**
 * Os números da edição inteira.
 *
 * O total de gols é a soma dos gols marcados — que é também a soma dos
 * sofridos, porque todo gol tem os dois lados. Os jogos são metade da soma
 * dos jogos dos clubes, pela mesma razão.
 */
export function resumoDaEdicao(linhas) {
  const lista = linhas ?? [];
  const gols = lista.reduce((soma, l) => soma + l.gp, 0);
  const jogos = lista.reduce((soma, l) => soma + l.j, 0) / 2;
  return {
    gols, jogos,
    porJogo: jogos > 0 ? gols / jogos : null,
  };
}

/**
 * O extremo de uma coluna, com a linha inteira junto.
 *
 * Devolve a linha, e não só o número, porque quem olha o maior ataque quer
 * saber de quem ele é.
 */
export function extremoDeGols(linhas, campo, { medida = "total",
                                               maior = true } = {}) {
  const lista = (linhas ?? []).filter((l) => l.j > 0);
  if (!lista.length) return null;
  return lista.reduce((melhor, l) => {
    const v = valorDe(l, campo, medida), m = valorDe(melhor, campo, medida);
    if (v === m) return l.pos < melhor.pos ? l : melhor;
    return (maior ? v > m : v < m) ? l : melhor;
  }, lista[0]);
}

/**
 * A reta que resume a nuvem, para o gráfico de posição × gols.
 *
 * Mínimos quadrados de gols em função da posição. Devolve `null` quando não há
 * o que ajustar — a reta existe para dar ao olho a tendência, e uma reta
 * inventada faria o contrário.
 */
export function retaDaTendencia(linhas, campo, medida = "total") {
  const lista = (linhas ?? []).filter((l) => l.j > 0);
  if (lista.length < 3) return null;

  const xs = lista.map((l) => l.pos);
  const ys = lista.map((l) => valorDe(l, campo, medida));
  const media = (v) => v.reduce((s, n) => s + n, 0) / v.length;
  const mx = media(xs), my = media(ys);

  let cima = 0, baixo = 0;
  for (let i = 0; i < xs.length; i++) {
    cima += (xs[i] - mx) * (ys[i] - my);
    baixo += (xs[i] - mx) ** 2;
  }
  if (baixo === 0) return null;
  const inclinacao = cima / baixo;
  return { inclinacao, intercepto: my - inclinacao * mx };
}

/**
 * Afasta escudos que se sobrepõem, sem mexer no ponto que eles marcam.
 *
 * Dois clubes com a mesma campanha caem no mesmo lugar do gráfico, e um
 * esconde o outro. Mover o dado seria mentir, então o que se move é o desenho:
 * o ponto continua onde está, o escudo sai de cima do vizinho, e o card liga
 * os dois com um fio quando eles se separam.
 *
 * Relaxação simples: cada par muito próximo se empurra, e uma mola fraca puxa
 * todo mundo de volta ao lugar de origem para que ninguém saia passeando pelo
 * gráfico.
 */
export function afastarEscudos(pontos, { minimo, limites, passos = 90 } = {}) {
  const lista = (pontos ?? []).map((p) => ({ ...p, xe: p.x, ye: p.y }));
  if (!minimo || lista.length < 2) {
    return lista.map((p) => ({ ...p, desviado: false }));
  }

  for (let passo = 0; passo < passos; passo++) {
    let mexeu = false;
    for (let i = 0; i < lista.length; i++) {
      for (let k = i + 1; k < lista.length; k++) {
        const a = lista[i], b = lista[k];
        let dx = b.xe - a.xe, dy = b.ye - a.ye;
        let dist = Math.hypot(dx, dy);
        if (dist >= minimo) continue;
        // Exatamente em cima um do outro: um empurrão inicial em diagonal,
        // senão não há direção para onde separar.
        if (dist === 0) { dx = 0.5; dy = 0.5; dist = Math.hypot(dx, dy); }
        const sobra = (minimo - dist) / 2;
        const ux = dx / dist, uy = dy / dist;
        a.xe -= ux * sobra; a.ye -= uy * sobra;
        b.xe += ux * sobra; b.ye += uy * sobra;
        mexeu = true;
      }
    }
    // A mola de volta ao ponto: fraca, para não desfazer o afastamento.
    for (const p of lista) {
      p.xe += (p.x - p.xe) * 0.05;
      p.ye += (p.y - p.ye) * 0.05;
      if (limites) {
        p.xe = Math.min(Math.max(p.xe, limites.x0), limites.x1);
        p.ye = Math.min(Math.max(p.ye, limites.y0), limites.y1);
      }
    }
    if (!mexeu) break;
  }

  return lista.map((p) => ({
    ...p, desviado: Math.hypot(p.xe - p.x, p.ye - p.y) > 2,
  }));
}
