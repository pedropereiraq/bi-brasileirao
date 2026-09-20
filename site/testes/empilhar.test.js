/**
 * A regra é uma só: dois rótulos nunca se sobrepõem.
 *
 * O card de evolução põe três caixas na calha da direita, cada uma na altura
 * da linha que nomeia. Escolher 4º e 6º como referências dá duas linhas a
 * poucos pixels uma da outra, e foi assim que a versão anterior encostou duas
 * caixas — ela separava e depois um `Math.max` por item reencostava.
 *
 * Por isso o teste não confere um caso: varre todas as combinações de posições
 * vizinhas e mais mil sorteios, e cobra a folga em todos.
 *
 *     node --test site/testes/
 */
import test from "node:test";
import assert from "node:assert/strict";

import { empilhar, FOLGA } from "../public/js/empilhar.js";

const TOPO = 200, BASE = 620;          // a calha do card, em unidades da régua
const ALTURAS = [58, 34, 34];          // selo do clube e as duas pastilhas

/** Devolve a menor distância entre duas caixas vizinhas. */
function menorFolga(empilhados) {
  let menor = Infinity;
  for (let i = 1; i < empilhados.length; i++) {
    const acima = empilhados[i - 1], atual = empilhados[i];
    menor = Math.min(menor,
      (atual.y - atual.altura / 2) - (acima.y + acima.altura / 2));
  }
  return empilhados.length > 1 ? menor : Infinity;
}

const montar = (alvos) =>
  alvos.map((alvo, i) => ({ alvo, altura: ALTURAS[i % ALTURAS.length] }));

test("três caixas em alvos idênticos não se sobrepõem", () => {
  const saida = empilhar(montar([400, 400, 400]), {
    limiteTopo: TOPO, limiteBase: BASE,
  });
  assert.ok(menorFolga(saida) >= FOLGA - 1e-9,
    `folga de ${menorFolga(saida)} entre caixas no mesmo alvo`);
});

test("posições vizinhas: toda combinação de 1 a 20 mantém a folga", () => {
  // O alvo de cada régua é a altura em que ela termina, e a média por posição
  // cai devagar: entre o 4º e o 6º são poucos pixels.
  const alturaDaPosicao = (pos) => TOPO + ((pos - 1) / 19) * (BASE - TOPO);

  for (let melhor = 1; melhor <= 19; melhor++) {
    for (let pior = melhor + 1; pior <= 20; pior++) {
      for (const ptsClube of [TOPO, 300, 450, BASE]) {
        const saida = empilhar([
          { alvo: ptsClube, altura: 58 },
          { alvo: alturaDaPosicao(melhor), altura: 34 },
          { alvo: alturaDaPosicao(pior), altura: 34 },
        ], { limiteTopo: TOPO, limiteBase: BASE });

        assert.ok(menorFolga(saida) >= FOLGA - 1e-9,
          `${melhor}º x ${pior}º com o clube em ${ptsClube}: `
          + `folga de ${menorFolga(saida)}`);
      }
    }
  }
});

test("mil sorteios: nunca sobrepõe e nunca sai da calha", () => {
  // Gerador próprio para o teste ser repetível — um `Math.random` sem semente
  // faria a falha aparecer numa execução e sumir na seguinte.
  let semente = 20260920;
  const sorteio = () => {
    semente = (semente * 1103515245 + 12345) % 2147483648;
    return semente / 2147483648;
  };

  for (let i = 0; i < 1000; i++) {
    const alvos = ALTURAS.map(() => TOPO + sorteio() * (BASE - TOPO));
    const saida = empilhar(montar(alvos), { limiteTopo: TOPO, limiteBase: BASE });

    assert.ok(menorFolga(saida) >= FOLGA - 1e-9,
      `sorteio ${i}: folga de ${menorFolga(saida)} em ${JSON.stringify(alvos)}`);
    assert.ok(saida[0].y - saida[0].altura / 2 >= TOPO - 1e-9,
      `sorteio ${i}: a primeira caixa saiu pelo topo`);
    assert.ok(saida.at(-1).y + saida.at(-1).altura / 2 <= BASE + 1e-9,
      `sorteio ${i}: a última caixa passou da base`);
  }
});

test("sem espaço para todas, empilha do topo em vez de sobrepor", () => {
  // 58 + 34 + 34 + duas folgas = 150; a calha aqui tem 100.
  const saida = empilhar(montar([210, 240, 260]),
                         { limiteTopo: 200, limiteBase: 300 });
  assert.ok(menorFolga(saida) >= FOLGA - 1e-9,
    "as caixas se sobrepuseram quando o espaço acabou");
  assert.equal(saida[0].y - saida[0].altura / 2, 200);
});

test("a ordem de cima para baixo é a ordem dos alvos", () => {
  const saida = empilhar(montar([500, 250, 380]),
                         { limiteTopo: TOPO, limiteBase: BASE });
  assert.deepEqual(saida.map((item) => item.alvo), [250, 380, 500]);
});
