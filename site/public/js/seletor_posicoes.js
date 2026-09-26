/**
 * Trilha de números com uma ou duas alças.
 *
 * Nasceu para posições — a tabela deitada, do 20º à esquerda ao 1º à direita —
 * e serve também ao que cresce da esquerda para a direita: rodadas, jogos.
 * A diferença entre os dois casos é só a direção, e ela cabe num parâmetro:
 * por dentro tudo anda em **ordem visual**, o passo 1 é sempre o da ponta
 * esquerda, e cada trilha traduz esse passo no valor que ela mostra.
 *
 * Por que uma trilha e não `<select>`: num par de listas o usuário não vê que
 * 4 e 17 são as bordas do G4 e do Z4; na trilha isso é a própria distância
 * entre as alças. Num par de campos numéricos ele também não vê que a 19ª
 * rodada é o meio do campeonato.
 *
 * Com duas alças, a da esquerda nunca passa da direita. Em vez de trocar as
 * duas de papel no meio do arrasto — o que faria a cor saltar debaixo do dedo
 * — ela para encostada na vizinha.
 */
const MIN_DISTANCIA = 1;

/** Quantos números cabem legíveis na trilha antes de virarem risco. */
const MARCAS_VISIVEIS = 20;

/**
 * `alcas` vai da esquerda para a direita. Cada uma é `{ nome, classe,
 * descricao, valor }`; `aoMudar` recebe um objeto com o valor de cada alça
 * pelo nome.
 *
 * `crescente` põe o menor valor à esquerda; sem ele, a trilha desce — que é
 * como uma classificação se lê.
 */
export function ligarTrilha({ raiz, total = 20, alcas, aoMudar,
                              crescente = false, descrever, minimo = 1 }) {
  const estado = Object.fromEntries(alcas.map((a) => [a.nome, a.valor]));
  const nomes = alcas.map((a) => a.nome);
  const passos = Math.max(1, total - minimo);
  const rotular = descrever ?? ((v) => `${v}º lugar`);

  // Ordem visual: 1 é sempre a ponta esquerda, seja ela o 20º lugar ou a 1ª
  // rodada. Todo o resto do módulo pensa aqui dentro.
  const paraOrdem = (v) => (crescente ? v - minimo + 1 : total - v + 1);
  const daOrdem = (o) => (crescente ? o + minimo - 1 : total - o + 1);

  raiz.classList.add("trilha");
  raiz.innerHTML = `
    <div class="trilha-fundo"></div>
    <div class="trilha-faixa"></div>
    <div class="trilha-marcas"></div>`
    + alcas.map((a) => `
    <button type="button" class="alca ${a.classe}" data-nome="${a.nome}"
            role="slider" aria-label="${a.descricao}"
            aria-valuemin="${minimo}" aria-valuemax="${total}"></button>`).join("");

  const faixa = raiz.querySelector(".trilha-faixa");
  const marcas = raiz.querySelector(".trilha-marcas");
  const elemento = Object.fromEntries(
    nomes.map((nome) => [nome, raiz.querySelector(`[data-nome="${nome}"]`)]));

  const fracao = (valor) => (paraOrdem(valor) - 1) / passos;
  const valorDaFracao = (f) => daOrdem(
    Math.min(passos + 1, Math.max(1, Math.round(f * passos) + 1)));

  // Numa trilha de 38 rodadas os números se encostam: escreve-se um a cada
  // tantos, e as pontas sempre — elas são o que se procura primeiro.
  const salto = Math.ceil((passos + 1) / MARCAS_VISIVEIS);
  const escritos = Array.from({ length: passos + 1 }, (_, i) => daOrdem(i + 1))
    .filter((valor, i, lista) =>
      i === 0 || i === lista.length - 1 || i % salto === 0);

  marcas.innerHTML = escritos
    .map((valor) => `<button type="button" class="trilha-numero" data-valor="${valor}"
            style="left:${fracao(valor) * 100}%">${valor}</button>`)
    .join("");

  function pintar() {
    for (const nome of nomes) {
      const alca = elemento[nome];
      alca.style.left = `${fracao(estado[nome]) * 100}%`;
      alca.textContent = estado[nome];
      alca.setAttribute("aria-valuenow", estado[nome]);
      alca.setAttribute("aria-valuetext", rotular(estado[nome]));
    }

    // Com duas alças a faixa é o intervalo entre elas; com uma, é dela até a
    // ponta em que está o "tudo" — o 1º lugar nas posições, a origem nas
    // trilhas que crescem.
    const pontos = nomes.map((nome) => fracao(estado[nome]));
    const de = nomes.length > 1 ? Math.min(...pontos)
                                : (crescente ? 0 : Math.min(...pontos));
    const ate = nomes.length > 1 ? Math.max(...pontos)
                                 : (crescente ? Math.max(...pontos) : 1);
    faixa.style.left = `${de * 100}%`;
    faixa.style.width = `${(ate - de) * 100}%`;

    for (const marca of marcas.children) {
      const f = fracao(Number(marca.dataset.valor));
      marca.classList.toggle("dentro", f >= de - 1e-9 && f <= ate + 1e-9);
    }
  }

  /** Os limites de uma alça são as vizinhas, quando existem. */
  function definir(nome, valor, avisar = true) {
    const i = nomes.indexOf(nome);
    const piso = i > 0 ? paraOrdem(estado[nomes[i - 1]]) + MIN_DISTANCIA : 1;
    const teto = i < nomes.length - 1
      ? paraOrdem(estado[nomes[i + 1]]) - MIN_DISTANCIA : passos + 1;
    const limitada = daOrdem(Math.min(Math.max(paraOrdem(valor), piso), teto));
    if (limitada === estado[nome]) return;
    estado[nome] = limitada;
    pintar();
    if (avisar) aoMudar({ ...estado });
  }

  const valorDoEvento = (evento) => {
    const caixa = raiz.getBoundingClientRect();
    return valorDaFracao((evento.clientX - caixa.left) / caixa.width);
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
      definir(nome, valorDoEvento(evento));
    });
    const soltar = (evento) => {
      alca.classList.remove("arrastando");
      if (alca.hasPointerCapture(evento.pointerId)) {
        alca.releasePointerCapture(evento.pointerId);
      }
    };
    alca.addEventListener("pointerup", soltar);
    alca.addEventListener("pointercancel", soltar);

    // Teclado: a seta para a direita anda para a direita da trilha, seja qual
    // for o valor que more lá.
    alca.addEventListener("keydown", (evento) => {
      const passo = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[evento.key];
      if (passo === undefined) return;
      evento.preventDefault();
      const andar = passo * (evento.shiftKey ? 5 : 1);
      definir(nome, daOrdem(paraOrdem(estado[nome]) + andar));
    });
  }

  // Clicar num número leva até ele a alça mais próxima. A classe é
  // `trilha-numero` e não `marca` porque `.marca` já é a logo do cabeçalho —
  // reaproveitar o nome faria o CSS da trilha deslocar a marca da página.
  marcas.addEventListener("click", (evento) => {
    const marca = evento.target.closest(".trilha-numero");
    if (!marca) return;
    const valor = Number(marca.dataset.valor);
    const nome = nomes.reduce((melhor, atual) =>
      Math.abs(valor - estado[atual]) < Math.abs(valor - estado[melhor])
        ? atual : melhor, nomes[0]);
    definir(nome, valor);
    elemento[nome].focus();
  });

  pintar();
  return {
    valores: () => ({ ...estado }),
    // Todas de uma vez: aplicar uma e depois a outra faria a primeira esbarrar
    // no limite que a segunda ainda ia mudar.
    definir: (valores) => {
      let piso = 1;
      for (const nome of nomes) {
        const querido = paraOrdem(valores[nome] ?? estado[nome]);
        const ordem = Math.min(passos + 1, Math.max(piso, querido));
        estado[nome] = daOrdem(ordem);
        piso = ordem + MIN_DISTANCIA;
      }
      pintar();
    },
  };
}

/** Nome antigo, de quando a trilha só sabia de posições. */
export const ligarTrilhaDePosicoes = ligarTrilha;

/** Duas alças: a posição pior em vermelho e a melhor em verde. */
export const ligarSeletorDePosicoes = ({ raiz, total, pior, melhor, aoMudar }) =>
  ligarTrilha({
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
  ligarTrilha({
    raiz, total,
    aoMudar: ({ meta }) => aoMudar(meta),
    alcas: [{ nome: "meta", classe: "alca-meta", valor: posicao,
              descricao: "posição usada como meta" }],
  });

/**
 * Duas alças numa trilha que cresce: o intervalo de rodadas.
 *
 * O recorte por rodada é um trecho contínuo do campeonato, e a trilha mostra
 * de uma vez onde ele começa, onde termina e quanto ficou de fora — coisa que
 * dois campos numéricos lado a lado não mostram.
 */
export const ligarSeletorDeRodadas = ({ raiz, total, de, ate, aoMudar }) =>
  ligarTrilha({
    raiz, total, crescente: true, aoMudar,
    descrever: (v) => `${v}ª rodada`,
    alcas: [
      { nome: "de", classe: "alca-meta", valor: de,
        descricao: "primeira rodada do recorte" },
      { nome: "ate", classe: "alca-melhor", valor: ate,
        descricao: "última rodada do recorte" },
    ],
  });

/**
 * Uma alça numa trilha que cresce: quantos jogos de cada equipe entram.
 *
 * A ponta direita é o total, e é lá que ela nasce: "os últimos 38 jogos" de
 * uma edição de 38 rodadas são a edição inteira, ou seja, recorte nenhum. Não
 * é preciso um botão de desligar — a própria trilha tem o lugar do "todos".
 */
export const ligarSeletorDeUltimos = ({ raiz, total, valor, aoMudar }) =>
  ligarTrilha({
    raiz, total, crescente: true,
    aoMudar: ({ ultimos }) => aoMudar(ultimos),
    descrever: (v) => (v >= total ? "todos os jogos" : `últimos ${v} jogos`),
    alcas: [{ nome: "ultimos", classe: "alca-meta", valor,
              descricao: "quantos jogos de cada equipe entram" }],
  });
