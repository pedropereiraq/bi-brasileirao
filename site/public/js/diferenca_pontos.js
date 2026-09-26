/**
 * A diferença de pontos entre dois pontos da tabela, rodada a rodada.
 *
 * "Ponto" aqui é um dos dois lados da comparação, e ele pode ser de duas
 * naturezas: uma **equipe**, que é sempre a mesma pessoa jurídica do começo ao
 * fim, ou uma **posição**, que troca de dono a cada rodada. São perguntas
 * diferentes: "quanto o Bahia abriu sobre o Vitória" é sobre dois clubes;
 * "quanto o Bahia está do G4" é sobre um clube e uma vaga; "quanto separa o 4º
 * do 17º" é sobre o formato do campeonato naquele ano, e nenhum clube em
 * particular.
 *
 * O índice é a **rodada**, e não o n-ésimo jogo, porque a diferença só existe
 * se os dois lados forem lidos no mesmo instante — e o instante comum a todo
 * mundo é a rodada. Um clube com jogo adiado aparece com menos jogos, e é essa
 * a informação: ele está atrás porque ainda não jogou.
 *
 * A fonte é a grade de `posicoes.json`, a mesma da média por posição e rodada.
 *
 * Módulo sem dependência nenhuma de propósito: assim `site/testes` carrega no
 * Node e cobra a regra.
 */

/** As três comparações que a tela oferece, e de que natureza é cada lado. */
export const MODOS = {
  "equipe-equipe": { rotulo: "Equipe × Equipe", lados: ["equipe", "equipe"] },
  "equipe-posicao": { rotulo: "Equipe × Posição", lados: ["equipe", "posicao"] },
  "posicao-posicao": { rotulo: "Posição × Posição", lados: ["posicao", "posicao"] },
};

/** A edição na grade publicada, ou `null` quando ela não existe. */
export function edicaoDe(dados, { serie, ano }) {
  return dados?.series?.[serie]?.[String(ano)] ?? null;
}

/**
 * A edição com a grade que a chave do tapetão escolheu.
 *
 * `posicoes.json` só publica a segunda grade onde ela difere, então não ter
 * `grade_st` significa "as duas são iguais". Trocar aqui, na página, deixa o
 * resto do módulo e os cards sem precisar saber que a chave existe.
 */
export function gradeQueVale(edicao, semTapetao) {
  if (!edicao || !semTapetao || !edicao.grade_st) return edicao ?? null;
  return { ...edicao, grade: edicao.grade_st, fim: edicao.fim_st ?? edicao.fim };
}

/** Quem estava em cada posição ao fim daquela rodada, do 1º ao último. */
export function colunaDaRodada(edicao, rodada) {
  const linha = edicao?.grade?.[rodada - 1];
  if (!linha) return null;
  return linha.map(([indice, pontos], i) => ({
    posicao: i + 1, equipe: edicao.clubes[indice], pontos,
  }));
}

/**
 * O lado, naquela coluna.
 *
 * Uma posição é sempre ocupada; uma equipe pode não estar na edição, e aí não
 * há comparação a fazer — melhor devolver nada do que devolver zero, que seria
 * lido como "não pontuou".
 */
export function ladoNaRodada(coluna, ponto) {
  if (!coluna || !ponto) return null;
  if (ponto.tipo === "posicao") return coluna[ponto.posicao - 1] ?? null;
  return coluna.find((c) => c.equipe === ponto.equipe) ?? null;
}

/**
 * A série inteira: uma entrada por rodada já disputada.
 *
 * `dif` é sempre `a − b`, positivo quando o primeiro lado está à frente. A
 * ordem dos lados é escolha de quem chama, e é ela que decide o que o card vai
 * chamar de vantagem.
 */
export function serieDaDiferenca(edicao, { a, b }) {
  if (!edicao) return [];
  const saida = [];
  for (let rodada = 1; rodada <= edicao.rodadas; rodada++) {
    const coluna = colunaDaRodada(edicao, rodada);
    const ladoA = ladoNaRodada(coluna, a);
    const ladoB = ladoNaRodada(coluna, b);
    if (!ladoA || !ladoB) continue;
    saida.push({
      rodada, a: ladoA, b: ladoB, dif: ladoA.pontos - ladoB.pontos,
    });
  }
  return saida;
}

/**
 * Os números que resumem a série.
 *
 * `maior` e `menor` guardam a primeira rodada em que o extremo aconteceu, e
 * não a última: o que interessa contar é quando a distância chegou lá.
 *
 * `viradas` conta as trocas de lado, ignorando os empates — passar por zero
 * indo de +2 a −1 é uma virada só, e não duas.
 */
export function resumoDaDiferenca(serie) {
  if (!serie.length) return null;

  const maior = serie.reduce((m, p) => (p.dif > m.dif ? p : m), serie[0]);
  const menor = serie.reduce((m, p) => (p.dif < m.dif ? p : m), serie[0]);
  const soma = serie.reduce((s, p) => s + p.dif, 0);

  let viradas = 0;
  let anterior = 0;
  for (const p of serie) {
    const sinal = Math.sign(p.dif);
    if (sinal === 0) continue;
    if (anterior !== 0 && sinal !== anterior) viradas += 1;
    anterior = sinal;
  }

  return {
    atual: serie.at(-1),
    maior,
    menor,
    media: soma / serie.length,
    viradas,
    contagem: {
      frente: serie.filter((p) => p.dif > 0).length,
      atras: serie.filter((p) => p.dif < 0).length,
      empate: serie.filter((p) => p.dif === 0).length,
    },
    rodadas: serie.length,
  };
}

/**
 * Por quantas mãos aquele lado passou, na ordem em que passou.
 *
 * Só faz sentido para o lado que é posição: uma equipe é sempre ela. Serve à
 * faixa do eixo, que mostra de quem era a vaga em cada rodada, e ao número que
 * diz quantos clubes ocuparam o lugar ao longo do campeonato.
 */
export function ocupantes(serie, lado) {
  const saida = [];
  for (const passo of serie) {
    const { equipe } = passo[lado];
    const ultimo = saida.at(-1);
    if (ultimo && ultimo.equipe === equipe) ultimo.ate = passo.rodada;
    else saida.push({ equipe, de: passo.rodada, ate: passo.rodada });
  }
  return saida;
}

/**
 * A campanha de um clube lida por rodada: onde ele estava e com quantos pontos
 * ao fim de cada uma.
 *
 * Mora aqui porque a fonte é a mesma grade, e ela é a única do BI que responde
 * "em que posição ele estava na rodada 12" sem recalcular a edição inteira no
 * navegador. Serve à evolução da campanha por posição.
 */
export function campanhaPorRodada(edicao, equipe) {
  const saida = [];
  for (let rodada = 1; rodada <= (edicao?.rodadas ?? 0); rodada++) {
    const celula = ladoNaRodada(colunaDaRodada(edicao, rodada),
                                { tipo: "equipe", equipe });
    if (celula) saida.push({ rodada, ...celula });
  }
  return saida;
}
