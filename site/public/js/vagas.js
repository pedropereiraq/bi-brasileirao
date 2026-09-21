/**
 * As vagas de uma série: o que cada faixa da tabela vale ao fim do ano.
 *
 * A tabela é a mesma todo ano; o que muda é o regulamento. Em 2026 a Série A
 * dá quatro vagas diretas à Libertadores, uma à pré-Libertadores e o resto da
 * primeira metade à Sul-Americana — mas isso já foi diferente e vai ser de
 * novo. Por isso as fronteiras são filtro, e não constante: quem monta o card
 * empurra cada limite para onde o regulamento daquele ano mandava.
 *
 * As cores das faixas **não** mudam com a marca. Verde é vaga boa e vermelho é
 * rebaixamento em qualquer canal; trocar isso pelo par da identidade faria o
 * card mentir sobre o que está mostrando.
 *
 * Módulo sem dependência nenhuma de propósito: assim `site/testes` carrega no
 * Node e cobra a regra.
 */

/**
 * As faixas de cada série, da melhor para a pior. Cada uma vai da posição
 * seguinte à faixa anterior até o limite que leva o nome dela; o que sobra
 * depois da última é o rebaixamento.
 */
export const FAIXAS = {
  A: [
    { nome: "libertadores", rotulo: "Libertadores", padrao: 4, cor: "verdeEscuro" },
    { nome: "preLibertadores", rotulo: "Pré-Libertadores", padrao: 5, cor: "verdeClaro" },
    { nome: "sulAmericana", rotulo: "Sul-Americana", padrao: 11, cor: "azul" },
    { nome: "permanencia", rotulo: "Permanência", padrao: 16, cor: "cinza" },
  ],
  B: [
    { nome: "acesso", rotulo: "Acesso", padrao: 4, cor: "verdeEscuro" },
    { nome: "mataMata", rotulo: "Mata-mata", padrao: 6, cor: "verdeClaro" },
    { nome: "permanencia", rotulo: "Permanência", padrao: 16, cor: "cinza" },
  ],
};

/** O que sobra depois da última faixa. Não é filtro: é o resto. */
export const REBAIXAMENTO = { nome: "rebaixamento", rotulo: "Rebaixamento", cor: "vermelho" };

export const faixasDaSerie = (serie) => FAIXAS[serie] ?? FAIXAS.A;

/** Os limites que a tela abre, antes de o usuário mexer. */
export function limitesPadrao(serie) {
  return Object.fromEntries(faixasDaSerie(serie).map((f) => [f.nome, f.padrao]));
}

/**
 * Os limites em ordem crescente e dentro da tabela.
 *
 * Cada faixa precisa de pelo menos uma posição, e a última precisa deixar pelo
 * menos uma para o rebaixamento — senão o card teria uma cor sem nenhuma linha
 * e uma zona sem nome. Ajusta em cadeia, da melhor faixa para a pior.
 */
export function limitesValidos(serie, valores, total = 20) {
  const faixas = faixasDaSerie(serie);
  const saida = {};
  let piso = 0;
  faixas.forEach((faixa, i) => {
    // Quantas faixas ainda vêm depois desta, mais a do rebaixamento.
    const reservadas = faixas.length - i - 1 + 1;
    const teto = total - reservadas;
    const querido = valores?.[faixa.nome] ?? faixa.padrao;
    saida[faixa.nome] = Math.min(teto, Math.max(piso + 1, Math.round(querido)));
    piso = saida[faixa.nome];
  });
  return saida;
}

/**
 * A faixa de uma posição, com o intervalo dela — é o que o card pinta e o que
 * a legenda escreve.
 */
export function zonaDaPosicao(posicao, serie, limites, total = 20) {
  const validos = limitesValidos(serie, limites, total);
  let de = 1;
  for (const faixa of faixasDaSerie(serie)) {
    const ate = validos[faixa.nome];
    if (posicao <= ate) return { ...faixa, de, ate };
    de = ate + 1;
  }
  return { ...REBAIXAMENTO, de, ate: total };
}

/** As faixas com seus intervalos, na ordem da tabela — serve à legenda. */
export function zonasDaSerie(serie, limites, total = 20) {
  const validos = limitesValidos(serie, limites, total);
  const saida = [];
  let de = 1;
  for (const faixa of faixasDaSerie(serie)) {
    saida.push({ ...faixa, de, ate: validos[faixa.nome] });
    de = validos[faixa.nome] + 1;
  }
  if (de <= total) saida.push({ ...REBAIXAMENTO, de, ate: total });
  return saida;
}

/* ------------------------------------------------------------- ordenação */
/**
 * Reclassifica a tabela pelo critério escolhido.
 *
 * Por pontos é a ordem do próprio motor, que já vem pronta. Por aproveitamento
 * a conta é outra: quem jogou menos pode aparecer na frente, e é justamente
 * isso que se quer ver quando há jogo adiado. Os desempates seguem os mesmos
 * do regulamento, só que atrás do novo critério.
 *
 * Clube sem jogo nenhum no recorte não tem aproveitamento — fica por último,
 * em vez de virar zero e disputar com quem de fato não pontuou.
 */
export function ordenarPor(tabela, criterio) {
  if (criterio !== "aproveitamento") {
    return tabela.map((c, i) => ({ ...c, pos: i + 1 }));
  }
  const grau = (c) => (c.aproveitamento === null ? -1 : c.aproveitamento);
  return [...tabela]
    .sort((a, b) => (grau(b) - grau(a))
                 || (b.pts - a.pts)
                 || (b.t - a.t)
                 || (b.sg - a.sg)
                 || (b.gp - a.gp))
    .map((c, i) => ({ ...c, pos: i + 1 }));
}
