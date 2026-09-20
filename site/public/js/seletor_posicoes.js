/**
 * Trilha de posições: a tabela deitada, do 20º à esquerda ao 1º à direita.
 *
 * Serve a duas telas com exigências diferentes. A evolução da pontuação usa
 * duas alças — a vermelha na posição pior, a verde na melhor — e o que
 * interessa ali é o intervalo entre elas. Os blocos de 6 jogos usam uma alça
 * só, a posição que vira meta.
 *
 * Por que uma trilha e não `<select>`: num par de listas o usuário não vê que
 * 4 e 17 são as bordas do G4 e do Z4; na trilha isso é a própria distância
 * entre as alças. Com uma alça só, ele vê de imediato quantos lugares separam
 * a meta do título e do rebaixamento.
 *
 * Com duas alças, a da esquerda nunca passa da direita. Em vez de trocar as
 * duas de papel no meio do arrasto — o que faria a cor saltar debaixo do dedo
 * — ela para encostada na vizinha.
 */
const MIN_DISTANCIA = 1;

/**
 * `alcas` vai da esquerda para a direita, ou seja, da pior posição para a
 * melhor. Cada uma é `{ nome, classe, descricao, valor }`; `aoMudar` recebe um
 * objeto com o valor de cada alça pelo nome.
 */
export function ligarTrilhaDePosicoes({ raiz, total = 20, alcas, aoMudar }) {
  const estado = Object.fromEntries(alcas.map((a) => [a.nome, a.valor]));
  const nomes = alcas.map((a) => a.nome);

  raiz.classList.add("trilha-posicoes");
  raiz.innerHTML = `
    <div class="trilha-fundo"></div>
    <div class="trilha-faixa"></div>
    <div class="trilha-marcas"></div>`
    + alcas.map((a) => `
    <button type="button" class="alca ${a.classe}" data-nome="${a.nome}"
            role="slider" aria-label="${a.descricao}"
            aria-valuemin="1" aria-valuemax="${total}"></button>`).join("");

  const faixa = raiz.querySelector(".trilha-faixa");
  const marcas = raiz.querySelector(".trilha-marcas");
  const elemento = Object.fromEntries(
    nomes.map((nome) => [nome, raiz.querySelector(`[data-nome="${nome}"]`)]));

  // Da posição para a fração da trilha: o 20º em 0, o 1º em 1.
  const fracao = (posicao) => (total - posicao) / (total - 1);
  const posicaoDe = (f) =>
    Math.min(total, Math.max(1, total - Math.round(f * (total - 1))));

  marcas.innerHTML = Array.from({ length: total }, (_, i) => total - i)
    .map((posicao) => `<button type="button" class="trilha-numero" data-posicao="${posicao}"
            style="left:${fracao(posicao) * 100}%">${posicao}</button>`)
    .join("");

  function pintar() {
    for (const nome of nomes) {
      const alca = elemento[nome];
      alca.style.left = `${fracao(estado[nome]) * 100}%`;
      alca.textContent = estado[nome];
      alca.setAttribute("aria-valuenow", estado[nome]);
      alca.setAttribute("aria-valuetext", `${estado[nome]}º lugar`);
    }

    // Com duas alças a faixa é o intervalo entre elas; com uma, é dela para a
    // frente — a meta e tudo que é melhor que a meta.
    const valores = nomes.map((nome) => estado[nome]);
    const daEsquerda = Math.max(...valores);
    const aDireita = nomes.length > 1 ? Math.min(...valores) : 1;
    const a = fracao(daEsquerda) * 100, b = fracao(aDireita) * 100;
    faixa.style.left = `${a}%`;
    faixa.style.width = `${b - a}%`;

    for (const marca of marcas.children) {
      const posicao = Number(marca.dataset.posicao);
      marca.classList.toggle("dentro", posicao <= daEsquerda && posicao >= aDireita);
    }
  }

  /** Os limites de uma alça são as vizinhas, quando existem. */
  function definir(nome, posicao, avisar = true) {
    const i = nomes.indexOf(nome);
    const piso = i > 0 ? estado[nomes[i - 1]] - MIN_DISTANCIA : total;
    const teto = i < nomes.length - 1 ? estado[nomes[i + 1]] + MIN_DISTANCIA : 1;
    const limitada = Math.min(piso, Math.max(teto, posicao));
    if (limitada === estado[nome]) return;
    estado[nome] = limitada;
    pintar();
    if (avisar) aoMudar({ ...estado });
  }

  const posicaoDoEvento = (evento) => {
    const caixa = raiz.getBoundingClientRect();
    return posicaoDe((evento.clientX - caixa.left) / caixa.width);
  };

  for (const nome of nomes) {
    const alca = elemento[nome];
    alca.addEventListener("pointerdown", (evento) => {
      evento.preventDefault();
      // Captura o ponteiro para o arrasto continuar mesmo quando o dedo sai da
      // alça. Falha quando o evento não vem de um ponteiro de verdade, e aí o
      // clique simples ainda funciona — não vale derrubar o resto do manipulador.
      try { alca.setPointerCapture(evento.pointerId); } catch { /* sem captura */ }
      alca.classList.add("arrastando");
    });
    alca.addEventListener("pointermove", (evento) => {
      if (!alca.hasPointerCapture(evento.pointerId)) return;
      definir(nome, posicaoDoEvento(evento));
    });
    const soltar = (evento) => {
      alca.classList.remove("arrastando");
      if (alca.hasPointerCapture(evento.pointerId)) {
        alca.releasePointerCapture(evento.pointerId);
      }
    };
    alca.addEventListener("pointerup", soltar);
    alca.addEventListener("pointercancel", soltar);

    // Teclado: a seta para a direita anda na direção do 1º lugar, que é para
    // onde a trilha cresce visualmente.
    alca.addEventListener("keydown", (evento) => {
      const passo = { ArrowRight: -1, ArrowUp: -1, ArrowLeft: 1, ArrowDown: 1 }[evento.key];
      if (passo === undefined) return;
      evento.preventDefault();
      definir(nome, estado[nome] + passo * (evento.shiftKey ? 5 : 1));
    });
  }

  // Clicar num número leva até ele a alça mais próxima. A classe é
  // `trilha-numero` e não `marca` porque `.marca` já é a logo do cabeçalho —
  // reaproveitar o nome faria o CSS da trilha deslocar a marca da página.
  marcas.addEventListener("click", (evento) => {
    const marca = evento.target.closest(".trilha-numero");
    if (!marca) return;
    const posicao = Number(marca.dataset.posicao);
    const nome = nomes.reduce((melhor, atual) =>
      Math.abs(posicao - estado[atual]) < Math.abs(posicao - estado[melhor])
        ? atual : melhor, nomes[0]);
    definir(nome, posicao);
    elemento[nome].focus();
  });

  pintar();
  return {
    valores: () => ({ ...estado }),
    // Todas de uma vez: aplicar uma e depois a outra faria a primeira esbarrar
    // no limite que a segunda ainda ia mudar.
    definir: (valores) => {
      let teto = 1;
      for (const nome of [...nomes].reverse()) {
        const querido = valores[nome] ?? estado[nome];
        estado[nome] = Math.min(total, Math.max(teto, querido));
        teto = estado[nome] + MIN_DISTANCIA;
      }
      pintar();
    },
  };
}

/** Duas alças: a posição pior em vermelho e a melhor em verde. */
export const ligarSeletorDePosicoes = ({ raiz, total, pior, melhor, aoMudar }) =>
  ligarTrilhaDePosicoes({
    raiz, total, aoMudar,
    alcas: [
      { nome: "pior", classe: "alca-pior", valor: pior,
        descricao: "posição pior, linha vermelha" },
      { nome: "melhor", classe: "alca-melhor", valor: melhor,
        descricao: "posição melhor, linha verde" },
    ],
  });

/** Uma alça só: a posição que vira meta. */
export const ligarSeletorDePosicao = ({ raiz, total, posicao, aoMudar }) =>
  ligarTrilhaDePosicoes({
    raiz, total,
    aoMudar: ({ meta }) => aoMudar(meta),
    alcas: [{ nome: "meta", classe: "alca-meta", valor: posicao,
              descricao: "posição usada como meta" }],
  });
