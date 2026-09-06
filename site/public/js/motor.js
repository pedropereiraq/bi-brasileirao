/**
 * Motor de classificação do navegador.
 *
 * Espelha `bi/motor.py`. Existe porque os filtros do site — intervalo de
 * rodadas, últimos X jogos, mando, intervalo de datas — são um número infinito
 * de recortes, e nenhum conjunto de tabelas pré-calculadas cobre todos. A
 * partir da lista de jogos, qualquer recorte é exato.
 *
 * Ter dois motores só é seguro porque um prova o outro: o Python reproduz as
 * 30.400 linhas da matriz do Excel, e `site/testes/motor.test.js` prova que
 * este devolve exatamente o mesmo, em toda edição, etapa e mando.
 *
 * Critérios de desempate, nesta ordem — os mesmos do Python:
 *   pontos, triunfos, saldo de gols, gols pró, ordem alfabética sem acento.
 */

/** Índices do array de um jogo. Espelha CAMPOS_JOGO em bi/publicacao.py. */
export const RODADA = 0, DATA = 1, MANDANTE = 2, VISITANTE = 3,
             GOLS_M = 4, GOLS_V = 5, STATUS = 6;

const REALIZADO = "realizado";

/** `ATLÉTICO (MG)` -> `ATLETICO (MG)`. Acento não pode mudar a ordem. */
export function chaveAlfabetica(nome) {
  return nome.normalize("NFD").replace(/\p{Mn}/gu, "");
}

/**
 * Uma linha por clube por jogo disputado, já com o desfecho resolvido.
 * Jogo sem placar não gera linha: para efeito de tabela, ele não aconteceu.
 */
export function formatoLongo(jogos) {
  const linhas = [];
  for (const jogo of jogos) {
    if (jogo[STATUS] !== REALIZADO) continue;
    const gm = jogo[GOLS_M], gv = jogo[GOLS_V];
    if (gm === null || gv === null) continue;
    linhas.push(lado(jogo, true, gm, gv), lado(jogo, false, gv, gm));
  }
  return linhas;
}

function lado(jogo, emCasa, gp, gc) {
  const sg = gp - gc;
  return {
    rodada: jogo[RODADA],
    data: jogo[DATA],
    equipe: jogo[emCasa ? MANDANTE : VISITANTE],
    adversario: jogo[emCasa ? VISITANTE : MANDANTE],
    mando: emCasa ? "casa" : "fora",
    gp, gc, sg,
    resultado: sg > 0 ? "T" : sg === 0 ? "E" : "D",  // T de triunfo
    pts: sg > 0 ? 3 : sg === 0 ? 1 : 0,
  };
}

/**
 * Aplica os filtros a um formato longo.
 *
 * A composição é: mando, rodada e data cortam o conjunto; **`ultimos` age por
 * último e por clube**, pegando os N jogos mais recentes de cada um entre os
 * que sobraram. É o que faz "últimos 5 jogos em casa" significar o que se
 * espera, e não "os 5 últimos jogos, se forem em casa".
 */
export function filtrar(longo, filtros = {}) {
  const { mando, rodadaDe, rodadaAte, dataDe, dataAte, ultimos } = filtros;
  let saida = longo.filter((l) =>
    (!mando || mando === "todos" || l.mando === mando) &&
    (rodadaDe == null || l.rodada >= rodadaDe) &&
    (rodadaAte == null || l.rodada <= rodadaAte) &&
    (!dataDe || l.data >= dataDe) &&
    (!dataAte || l.data <= dataAte)
  );

  if (ultimos != null && ultimos > 0) {
    const porClube = new Map();
    for (const l of saida) {
      if (!porClube.has(l.equipe)) porClube.set(l.equipe, []);
      porClube.get(l.equipe).push(l);
    }
    saida = [];
    for (const jogosDoClube of porClube.values()) {
      jogosDoClube.sort(comparaCronologico);
      saida.push(...jogosDoClube.slice(-ultimos));
    }
  }
  return saida;
}

function comparaCronologico(a, b) {
  return a.data === b.data ? a.rodada - b.rodada : (a.data < b.data ? -1 : 1);
}

/**
 * Agrega e classifica. `clubes` garante que todo clube da edição apareça na
 * tabela, mesmo sem nenhum jogo no recorte — senão um filtro estreito faria
 * clube sumir em vez de aparecer zerado.
 */
export function classificar(longo, clubes) {
  const porClube = new Map();
  for (const nome of clubes) porClube.set(nome, zerado(nome));

  for (const l of longo) {
    const c = porClube.get(l.equipe) ?? zerado(l.equipe);
    porClube.set(l.equipe, c);
    c.j += 1;
    c.pts += l.pts;
    if (l.resultado === "T") c.t += 1;
    else if (l.resultado === "E") c.e += 1;
    else c.d += 1;
    c.gp += l.gp;
    c.gc += l.gc;
  }

  const tabela = [...porClube.values()];
  for (const c of tabela) {
    c.sg = c.gp - c.gc;
    c.aproveitamento = c.j > 0 ? c.pts / (3 * c.j) : null;
  }
  tabela.sort(comparaClassificacao);
  tabela.forEach((c, i) => { c.pos = i + 1; });
  return tabela;
}

function zerado(equipe) {
  return {
    equipe, pos: 0, pts: 0, j: 0, t: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0,
    aproveitamento: null, _alfabetica: chaveAlfabetica(equipe),
  };
}

function comparaClassificacao(a, b) {
  return (b.pts - a.pts)
      || (b.t - a.t)
      || (b.sg - a.sg)
      || (b.gp - a.gp)
      || (a._alfabetica < b._alfabetica ? -1 : a._alfabetica > b._alfabetica ? 1 : 0);
}

/** Atalho: dos jogos crus à tabela, com filtros. */
export function tabela(jogos, clubes, filtros = {}) {
  return classificar(filtrar(formatoLongo(jogos), filtros), clubes);
}

/** Todos os clubes da edição, inclusive os de jogos ainda não realizados. */
export function clubesDaEdicao(jogos) {
  const nomes = new Set();
  for (const j of jogos) { nomes.add(j[MANDANTE]); nomes.add(j[VISITANTE]); }
  return [...nomes].sort();
}

// ------------------------------------------------------------ campanha
/**
 * A campanha de um clube: cada jogo com o acumulado até ali, e a posição que
 * ele ocupava naquela etapa. A posição é recalculada para toda a edição em
 * cada etapa — é o que permite desenhar a linha de evolução.
 */
export function campanha(jogos, clube, filtros = {}) {
  const clubes = clubesDaEdicao(jogos);
  const longo = filtrar(formatoLongo(jogos), filtros);
  const meus = longo.filter((l) => l.equipe === clube).sort(comparaCronologico);

  // Posição do clube ao fim de cada rodada com jogo dele, considerando a
  // edição inteira até aquela rodada (com os demais filtros valendo).
  const passos = [];
  const acumulado = { pts: 0, j: 0, t: 0, e: 0, d: 0, gp: 0, gc: 0 };

  for (const l of meus) {
    acumulado.j += 1;
    acumulado.pts += l.pts;
    if (l.resultado === "T") acumulado.t += 1;
    else if (l.resultado === "E") acumulado.e += 1;
    else acumulado.d += 1;
    acumulado.gp += l.gp;
    acumulado.gc += l.gc;

    // A posição na rodada R é sobre tudo o que se jogou até a rodada R —
    // é a definição que o motor Python usa e que a matriz do Excel registra.
    const ateAqui = longo.filter((o) => o.rodada <= l.rodada);
    const posicao = classificar(ateAqui, clubes).find((c) => c.equipe === clube);

    passos.push({
      ...l,
      pts_ac: acumulado.pts,
      j_ac: acumulado.j,
      t_ac: acumulado.t,
      e_ac: acumulado.e,
      d_ac: acumulado.d,
      gp_ac: acumulado.gp,
      gc_ac: acumulado.gc,
      sg_ac: acumulado.gp - acumulado.gc,
      pos: posicao ? posicao.pos : null,
    });
  }
  return passos;
}

/**
 * Resumo de um clube por mando, para o painel dele.
 *
 * Restringe as linhas ao clube **antes** de classificar. Classificar a edição
 * inteira e pegar a primeira linha devolveria o líder daquele mando, não o
 * clube pedido — foi assim que esta função nasceu errada, e o teste pegou.
 */
export function porMando(jogos, clube, filtros = {}) {
  const longo = formatoLongo(jogos);
  const saida = {};
  for (const mando of ["casa", "fora", "todos"]) {
    const meus = filtrar(longo, { ...filtros, mando })
      .filter((l) => l.equipe === clube);
    saida[mando] = classificar(meus, [clube])[0];
  }
  return saida;
}
