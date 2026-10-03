/**
 * O ranking de todas as campanhas, de todas as edições.
 *
 * Uma campanha é um clube numa edição. São oitocentas e poucas desde 2006, e a
 * pergunta que esta tela responde é sempre a mesma com recortes diferentes:
 * qual foi a melhor — ou a pior — campanha sob uma condição. Os vinte
 * primeiros jogos. Só fora de casa. Só entre as que terminaram no rebaixamento.
 * Só as equipes do Nordeste. O ranking é o mesmo; o que muda é o que entra.
 *
 * O recorte tem duas leituras, e elas não são a mesma coisa. **Por rodada**
 * pega os jogos das rodadas 1 a 10 — os dez que a tabela marcou para ele,
 * tenham sido jogados quando tiverem sido. **Por ordem dos jogos** pega os dez
 * primeiros que ele de fato jogou, que numa edição com adiamento inclui um
 * jogo da 12ª e deixa de fora o da 7ª. Uma pergunta é sobre o trecho do
 * campeonato; a outra, sobre o começo da campanha.
 *
 * O tapetão entra só quando o recorte é por rodada e o mando é o cheio:
 * punição de tribunal não tem jogo nem lado de campo, e somá-la a um recorte
 * de "pontos feitos fora de casa" seria inventar um jogo fora de casa.
 *
 * Trabalha sobre `campanhas_jogos.json`, onde cada clube de cada edição tem
 * três listas do mesmo tamanho — a rodada, o mando e o ponto de cada jogo, na
 * ordem em que aconteceram. Sem `import` nenhum, para o Node carregar.
 */

/**
 * Quantas campanhas por página do card.
 *
 * Cem, e não o quanto coubesse: "do 101º ao 200º" se lê sem conta, e é o
 * número que alguém repete em voz alta ao falar do card.
 */
export const POR_PAGINA = 100;

/**
 * E quantos clubes por página do ranking por equipe.
 *
 * Menos, porque a linha ali tem quatro números em vez de dois e pede três
 * colunas no lugar de quatro. Setenta e cinco cobre a Série A inteira — são 44
 * clubes em 21 edições — e parte a B em duas.
 */
export const POR_PAGINA_EQUIPES = 75;

/** O desfecho da edição, pela chave do tapetão. */
const fimDaEdicao = (edicao, semTapetao) =>
  (semTapetao && edicao?.fim_st ? edicao.fim_st : edicao?.fim);

/**
 * Os pontos de um clube dentro do recorte, e quantos jogos entraram.
 *
 * `porRodada` escolhe o índice: a rodada em que o jogo foi disputado, ou a
 * posição dele na campanha. É a única diferença entre as duas leituras.
 */
export function pontosNoRecorte(edicao, indice, {
  porRodada = true, de = 1, ate = Infinity, mando = "todos",
} = {}) {
  const rodadas = edicao?.rodadas?.[indice] ?? [];
  const mandos = edicao?.mando?.[indice] ?? "";
  const pontos = edicao?.pontos?.[indice] ?? "";

  let soma = 0;
  let jogos = 0;
  for (let k = 0; k < pontos.length; k++) {
    const onde = porRodada ? rodadas[k] : k + 1;
    if (onde < de || onde > ate) continue;
    if (mando !== "todos" && mandos[k] !== (mando === "casa" ? "C" : "F")) continue;
    soma += Number(pontos[k]);
    jogos += 1;
  }
  return { pontos: soma, jogos };
}

/**
 * O que o tapetão tira do recorte.
 *
 * Só por rodada e só no mando cheio — ver o cabeçalho. Fora disso a punição
 * não tem onde entrar, e fingir que tem seria pior do que deixá-la de fora.
 */
export function descontoNoRecorte(descontos, equipe, {
  porRodada = true, de = 1, ate = Infinity, mando = "todos",
} = {}) {
  if (!porRodada || mando !== "todos") return 0;
  return (descontos ?? [])
    .filter((d) => d.equipe === equipe && d.rodada >= de && d.rodada <= ate)
    .reduce((soma, d) => soma + d.pontos, 0);
}

/** Os anos publicados de uma série, do mais antigo ao mais novo. */
export function anosDaSerie(dados, serie) {
  return Object.keys(dados?.series?.[serie] ?? {}).map(Number)
    .sort((a, b) => a - b);
}

/**
 * Todas as campanhas da série, já com os pontos do recorte.
 *
 * Devolve tudo o que a linha do ranking precisa mostrar: o ano, o clube, onde
 * ele terminou e quanto fez no recorte. A posição no ranking vem depois, na
 * ordenação — é ela que depende de quem mais entrou.
 */
export function campanhasDaSerie(dados, {
  serie, semTapetao = false, descontosDoAno = () => [], ...recorte
} = {}) {
  const saida = [];

  for (const ano of anosDaSerie(dados, serie)) {
    const edicao = dados.series[serie][String(ano)];
    const fim = fimDaEdicao(edicao, semTapetao) ?? [];
    const descontos = descontosDoAno(ano);

    for (const [i, equipe] of (edicao.clubes ?? []).entries()) {
      const { pontos, jogos } = pontosNoRecorte(edicao, i, recorte);
      const desconto = descontoNoRecorte(descontos, equipe, recorte);
      const desfecho = fim[i] ?? null;

      saida.push({
        ano, equipe, jogos,
        encerrada: Boolean(edicao.encerrada),
        pontos: pontos + desconto,
        descontados: desconto,
        posicaoFinal: desfecho ? desfecho[0] : null,
        pontosFinais: desfecho ? desfecho[1] : null,
      });
    }
  }
  return saida;
}

/**
 * A ordem do ranking.
 *
 * Empate em pontos se desfaz pela posição final — fazer 50 pontos e terminar
 * em 8º é uma campanha melhor do que fazer 50 e terminar em 15º, porque o
 * resto da tabela era mais difícil — e depois pelo ano, do mais antigo ao mais
 * novo, que é a ordem em que as coisas aconteceram.
 */
export function compararCampanhas(a, b, ordem = "melhor") {
  const sinal = ordem === "pior" ? -1 : 1;
  const posicao = (c) => (c.posicaoFinal ?? 99);
  return sinal * (b.pontos - a.pontos)
      || sinal * (posicao(a) - posicao(b))
      || a.ano - b.ano
      || a.equipe.localeCompare(b.equipe, "pt-BR");
}

/**
 * O ranking pronto, filtrado e numerado.
 *
 * Campanha em andamento não tem posição final, e por isso só passa pelo filtro
 * de posição quando ele está inteiro aberto: pedir "entre o 1º e o 4º" é uma
 * pergunta sobre o desfecho, e ela ainda não tem resposta para 2026.
 */
export function montarRanking(dados, {
  serie, deAno = -Infinity, ateAno = Infinity,
  posicaoDe = 1, posicaoAte = Infinity, equipes = null,
  ordem = "melhor", semTapetao = false, descontosDoAno,
  ...recorte
} = {}) {
  // "Aberto de tudo" é o filtro que não restringe nada, e quem sabe qual é o
  // último lugar da tabela é quem chama: uma Série de 20 clubes e uma de 22
  // teriam tetos diferentes. Por isso o aberto é `Infinity`, e não um número.
  const abertoDeTudo = posicaoDe <= 1 && !Number.isFinite(posicaoAte);

  return campanhasDaSerie(dados, { serie, semTapetao, descontosDoAno, ...recorte })
    .filter((c) => c.ano >= deAno && c.ano <= ateAno)
    .filter((c) => !equipes || equipes.has(c.equipe))
    .filter((c) => (c.posicaoFinal === null
      ? abertoDeTudo
      : c.posicaoFinal >= posicaoDe && c.posicaoFinal <= posicaoAte))
    .filter((c) => c.jogos > 0)
    .sort((a, b) => compararCampanhas(a, b, ordem))
    .map((c, i) => ({ ...c, posicao: i + 1 }));
}

/**
 * O mesmo recorte somado por clube, e não por campanha.
 *
 * Aqui a edição some: o que sobra é quanto cada clube fez ao todo no trecho
 * escolhido. É uma pergunta diferente da do ranking de campanhas — lá a
 * unidade é o ano, aqui é o clube — e a mesma lista de jogos responde às duas.
 *
 * Vão junto as edições e os jogos porque sem eles o número engana: um clube de
 * vinte e uma participações soma mais do que um de quatro sem ter sido melhor
 * em nada. O aproveitamento é o que compara os dois, e por isso está ao lado.
 */
export function montarRankingDeEquipes(dados, {
  serie, deAno = -Infinity, ateAno = Infinity, equipes = null,
  semTapetao = false, descontosDoAno, ...recorte
} = {}) {
  const porClube = new Map();

  for (const c of campanhasDaSerie(dados,
    { serie, semTapetao, descontosDoAno, ...recorte })) {
    if (c.ano < deAno || c.ano > ateAno) continue;
    if (equipes && !equipes.has(c.equipe)) continue;
    // Clube sem jogo no recorte não entra: ele não fez zero pontos naquele
    // trecho, ele não esteve lá.
    if (!c.jogos) continue;

    const linha = porClube.get(c.equipe)
      ?? { equipe: c.equipe, pontos: 0, jogos: 0, edicoes: 0, melhorFim: null };
    linha.pontos += c.pontos;
    linha.jogos += c.jogos;
    linha.edicoes += 1;
    if (c.posicaoFinal !== null
        && (linha.melhorFim === null || c.posicaoFinal < linha.melhorFim)) {
      linha.melhorFim = c.posicaoFinal;
    }
    porClube.set(c.equipe, linha);
  }

  return [...porClube.values()]
    .map((l) => ({ ...l, aproveitamento: l.jogos ? l.pontos / (3 * l.jogos) : 0 }))
    .sort((a, b) => b.pontos - a.pontos
      || b.aproveitamento - a.aproveitamento
      || a.equipe.localeCompare(b.equipe, "pt-BR"))
    .map((l, i) => ({ ...l, posicao: i + 1 }));
}

/** Quantas páginas o ranking ocupa, no mínimo uma. */
export const paginas = (total, porPagina = POR_PAGINA) =>
  Math.max(1, Math.ceil(total / porPagina));

/** A fatia de uma página, contando a partir de 1. */
export function pagina(ranking, numero, porPagina = POR_PAGINA) {
  const quantas = paginas(ranking?.length ?? 0, porPagina);
  const atual = Math.min(Math.max(1, numero || 1), quantas);
  return (ranking ?? []).slice((atual - 1) * porPagina, atual * porPagina);
}

/* ----------------------------------------------------------------- turnos */
/** Os dois turnos, na ordem em que acontecem. */
export const TURNOS = [1, 2];

/**
 * Quantas rodadas a edição teve.
 *
 * Sai da maior rodada que algum clube jogou: o arquivo guarda a rodada de
 * cada jogo, e não o tamanho da tabela.
 */
export function rodadasDaEdicao(edicao) {
  return Math.max(0, ...(edicao?.rodadas ?? [])
    .map((r) => (r.length ? r[r.length - 1] : 0)));
}

/**
 * O intervalo de rodadas de um turno.
 *
 * A metade exata, como manda o returno: numa edição de 38 rodadas o primeiro
 * turno vai da 1ª à 19ª e o segundo da 20ª à 38ª. Edição de tamanho ímpar
 * deixa a rodada do meio no segundo, que é onde ela cai na prática — o
 * primeiro turno termina quando todos já se enfrentaram uma vez.
 */
export function rodadasDoTurno(rodadas, turno) {
  const metade = Math.floor(rodadas / 2);
  return turno === 1 ? { de: 1, ate: metade } : { de: metade + 1, ate: rodadas };
}

/**
 * O ranking dos turnos, uma linha por clube por turno.
 *
 * A unidade deixa de ser a campanha e passa a ser **meia** campanha: o mesmo
 * clube na mesma edição vira duas linhas, e elas competem entre si como
 * quaisquer outras. É o que permite perguntar se o melhor primeiro turno da
 * história foi melhor que o melhor segundo.
 *
 * Aqui não há recorte de trecho: o turno **é** o trecho. Somar um recorte de
 * rodadas por cima dele seria um filtro que ninguém consegue pensar.
 */
export function montarRankingDeTurnos(dados, {
  serie, deAno = -Infinity, ateAno = Infinity, equipes = null,
  turnos = TURNOS, posicaoDe = 1, posicaoAte = Infinity,
  ordem = "melhor", mando = "todos", semTapetao = false, descontosDoAno,
} = {}) {
  const abertoDeTudo = posicaoDe <= 1 && !Number.isFinite(posicaoAte);
  const saida = [];

  for (const ano of anosDaSerie(dados, serie)) {
    if (ano < deAno || ano > ateAno) continue;
    const edicao = dados.series[serie][String(ano)];
    const fim = fimDaEdicao(edicao, semTapetao) ?? [];
    const descontos = descontosDoAno?.(ano) ?? [];
    const rodadas = rodadasDaEdicao(edicao);

    for (const [i, equipe] of (edicao.clubes ?? []).entries()) {
      if (equipes && !equipes.has(equipe)) continue;
      const desfecho = fim[i] ?? null;
      const posicaoFinal = desfecho ? desfecho[0] : null;
      if (posicaoFinal === null
        ? !abertoDeTudo
        : posicaoFinal < posicaoDe || posicaoFinal > posicaoAte) continue;

      for (const turno of turnos) {
        const recorte = { porRodada: true, mando, ...rodadasDoTurno(rodadas, turno) };
        const { pontos, jogos } = pontosNoRecorte(edicao, i, recorte);
        if (!jogos) continue;

        saida.push({
          ano, equipe, turno, jogos,
          encerrada: Boolean(edicao.encerrada),
          pontos: pontos + descontoNoRecorte(descontos, equipe, recorte),
          posicaoFinal,
          pontosFinais: desfecho ? desfecho[1] : null,
        });
      }
    }
  }

  const sinal = ordem === "pior" ? -1 : 1;
  return saida
    .sort((a, b) => sinal * (b.pontos - a.pontos)
      || a.ano - b.ano || a.turno - b.turno
      || a.equipe.localeCompare(b.equipe, "pt-BR"))
    .map((l, i) => ({ ...l, posicao: i + 1 }));
}
