/**
 * Seletor de duas posições numa trilha de 20 a 1.
 *
 * A trilha é a tabela deitada: o 20º à esquerda, o 1º à direita. Duas alças
 * correm sobre ela — a vermelha marca a posição pior, a verde a melhor — e a
 * faixa entre elas é o intervalo que o card compara.
 *
 * Por que uma trilha e não dois `<select>`: as duas escolhas são uma coisa só,
 * um intervalo. Num par de listas o usuário não vê que 4 e 17 são as bordas do
 * G4 e do Z4; na trilha isso é a própria distância entre as alças.
 *
 * A alça vermelha nunca passa da verde. Em vez de trocar as duas de papel no
 * meio do arrasto — o que faria a cor saltar debaixo do dedo — ela para
 * encostada na vizinha.
 */
const MIN_DISTANCIA = 1;

export function ligarSeletorDePosicoes({ raiz, total = 20, pior, melhor, aoMudar }) {
  const estado = { pior, melhor };

  raiz.classList.add("trilha-posicoes");
  raiz.innerHTML = `
    <div class="trilha-fundo"></div>
    <div class="trilha-faixa"></div>
    <div class="trilha-marcas"></div>
    <button type="button" class="alca alca-pior" data-lado="pior"
            role="slider" aria-label="posição pior, linha vermelha"
            aria-valuemin="1" aria-valuemax="${total}"></button>
    <button type="button" class="alca alca-melhor" data-lado="melhor"
            role="slider" aria-label="posição melhor, linha verde"
            aria-valuemin="1" aria-valuemax="${total}"></button>`;

  const faixa = raiz.querySelector(".trilha-faixa");
  const marcas = raiz.querySelector(".trilha-marcas");
  const alcas = {
    pior: raiz.querySelector(".alca-pior"),
    melhor: raiz.querySelector(".alca-melhor"),
  };

  // Da posição para a fração da trilha: o 20º em 0, o 1º em 1.
  const fracao = (posicao) => (total - posicao) / (total - 1);
  const posicaoDe = (f) =>
    Math.min(total, Math.max(1, total - Math.round(f * (total - 1))));

  marcas.innerHTML = Array.from({ length: total }, (_, i) => total - i)
    .map((posicao) => `<button type="button" class="trilha-numero" data-posicao="${posicao}"
            style="left:${fracao(posicao) * 100}%">${posicao}</button>`)
    .join("");

  function pintar() {
    for (const lado of ["pior", "melhor"]) {
      const alca = alcas[lado];
      alca.style.left = `${fracao(estado[lado]) * 100}%`;
      alca.textContent = estado[lado];
      alca.setAttribute("aria-valuenow", estado[lado]);
      alca.setAttribute("aria-valuetext", `${estado[lado]}º lugar`);
    }
    const a = fracao(estado.pior) * 100, b = fracao(estado.melhor) * 100;
    faixa.style.left = `${a}%`;
    faixa.style.width = `${b - a}%`;
    for (const marca of marcas.children) {
      const posicao = Number(marca.dataset.posicao);
      marca.classList.toggle("dentro",
        posicao <= estado.pior && posicao >= estado.melhor);
    }
  }

  function definir(lado, posicao, avisar = true) {
    const limite = lado === "pior"
      ? Math.min(total, Math.max(estado.melhor + MIN_DISTANCIA, posicao))
      : Math.max(1, Math.min(estado.pior - MIN_DISTANCIA, posicao));
    if (limite === estado[lado]) return;
    estado[lado] = limite;
    pintar();
    if (avisar) aoMudar({ ...estado });
  }

  const posicaoDoEvento = (evento) => {
    const caixa = raiz.getBoundingClientRect();
    return posicaoDe((evento.clientX - caixa.left) / caixa.width);
  };

  for (const lado of ["pior", "melhor"]) {
    const alca = alcas[lado];
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
      definir(lado, posicaoDoEvento(evento));
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
      definir(lado, estado[lado] + passo * (evento.shiftKey ? 5 : 1));
    });
  }

  // Clicar num número leva até ele a alça mais próxima. A classe é
  // `trilha-numero` e não `marca` porque `.marca` já é a logo do cabeçalho —
  // reaproveitar o nome faria o CSS da trilha deslocar a marca da página.
  marcas.addEventListener("click", (evento) => {
    const marca = evento.target.closest(".trilha-numero");
    if (!marca) return;
    const posicao = Number(marca.dataset.posicao);
    const lado = Math.abs(posicao - estado.pior) <= Math.abs(posicao - estado.melhor)
      ? "pior" : "melhor";
    definir(lado, posicao);
    alcas[lado].focus();
  });

  pintar();
  return {
    valores: () => ({ ...estado }),
    // As duas de uma vez: aplicar uma e depois a outra faria a primeira
    // esbarrar no limite que a segunda ainda ia mudar.
    definir: (valores) => {
      const melhor = Math.max(1, Math.min(total - MIN_DISTANCIA,
                                          valores.melhor ?? estado.melhor));
      const pior = Math.min(total, Math.max(melhor + MIN_DISTANCIA,
                                            valores.pior ?? estado.pior));
      Object.assign(estado, { melhor, pior });
      pintar();
    },
  };
}
