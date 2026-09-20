/**
 * Empilhar rótulos numa coluna sem deixar dois se sobreporem.
 *
 * O problema: cada rótulo quer ficar na altura da linha que ele nomeia, e duas
 * linhas vizinhas — o ritmo do 4º e o do 6º — ficam a poucos pixels uma da
 * outra. Querer os dois no lugar certo é querer os dois no mesmo lugar.
 *
 * A saída é em três passadas, nesta ordem:
 *
 * 1. cada um no seu alvo, mas nunca acima do topo;
 * 2. quem encostou no de cima desce;
 * 3. a pilha que passou da base sobe, de baixo para cima.
 *
 * A ordem importa. Limitar o topo no fim, depois de separar, obriga a descer a
 * pilha inteira — e aí a última caixa sai pela base. Limitar antes custa nada:
 * a passada seguinte já empurra a partir da posição corrigida.
 *
 * Quando nem empilhadas as caixas cabem no espaço disponível, elas vão coladas
 * ao topo na ordem das linhas: deixar de apontar a altura exata é ruim,
 * sobrepor é pior.
 *
 * Módulo sem dependência nenhuma de propósito: assim `site/testes` consegue
 * carregá-lo no Node e cobrar a regra.
 */
export const FOLGA = 12;

/**
 * `itens` é `[{ alvo, altura, ... }]`. Devolve os mesmos objetos ordenados de
 * cima para baixo, cada um com `y` — o **centro** da caixa.
 */
export function empilhar(itens, { limiteTopo, limiteBase, folga = FOLGA } = {}) {
  const ordenados = [...itens].sort((p, q) => p.alvo - q.alvo);
  if (!ordenados.length) return ordenados;

  const somaAlturas = ordenados.reduce((soma, item) => soma + item.altura, 0)
                    + folga * (ordenados.length - 1);

  if (somaAlturas > limiteBase - limiteTopo) {
    let y = limiteTopo;
    for (const item of ordenados) {
      item.y = y + item.altura / 2;
      y += item.altura + folga;
    }
    return ordenados;
  }

  // O limite do topo entra aqui, e não no fim. Uma linha que termina muito no
  // alto quer a caixa dela meio corpo acima do gráfico; corrigir isso depois
  // significa descer a pilha inteira, e aí a última caixa sai pela base.
  for (const item of ordenados) {
    item.y = Math.max(item.alvo, limiteTopo + item.altura / 2);
  }

  for (let i = 1; i < ordenados.length; i++) {
    const acima = ordenados[i - 1], atual = ordenados[i];
    const minimo = acima.y + acima.altura / 2 + folga + atual.altura / 2;
    if (atual.y < minimo) atual.y = minimo;
  }

  // De baixo para cima contra a base. Só sobe, e subir nunca reencosta: a
  // caixa de cima sempre sobe pelo menos tanto quanto a de baixo.
  let teto = limiteBase;
  for (let i = ordenados.length - 1; i >= 0; i--) {
    const item = ordenados[i];
    item.y = Math.min(item.y, teto - item.altura / 2);
    teto = item.y - item.altura / 2 - folga;
  }

  return ordenados;
}
