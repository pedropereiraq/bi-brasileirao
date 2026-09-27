/**
 * O menu do BI, num lugar só.
 *
 * São trinta telas. Enfileiradas, elas ocupavam três linhas de pílulas em que
 * nada se achava: a lista era longa demais para ser lida e curta demais para
 * ser procurada. Agora são seis seções com menu suspenso, e o cabeçalho volta
 * a uma linha.
 *
 * A divisão é por **de que a tela fala**, e não por que gráfico ela desenha:
 * a tabela de agora, um clube, duas campanhas comparadas, o que vinte edições
 * ensinam, o que ainda vem. É a pergunta que leva alguém ao menu.
 *
 * A lista mora aqui e em nenhum outro lugar. Antes ela estava copiada nas
 * trinta páginas, e tela nova era trinta edições — que é exatamente o tipo de
 * trabalho que se esquece de fazer em uma delas.
 */

/** As seções, na ordem em que aparecem. */
export const SECOES = [
  {
    nome: "A edição",
    telas: [
      ["/classificacao.html", "Classificação"],
      ["/jogos.html", "Jogos"],
      ["/gols.html", "Gols"],
      ["/ultimos.html", "Últimos X jogos"],
      ["/grade.html", "Classificação por rodada"],
      ["/mando.html", "Mando de campo"],
      ["/fmi.html", "FMI"],
      ["/ondas.html", "Distribuição de pontos"],
      ["/degraus.html", "Distâncias para a equipe de baixo"],
    ],
  },
  {
    nome: "Um clube",
    telas: [
      ["/evolucao.html", "Evolução da campanha"],
      ["/media-movel.html", "Média móvel em X jogos"],
      ["/turnos.html", "Comparativo de turnos"],
      ["/adversarios.html", "Resultados por adversário"],
      ["/recortes.html", "Recortes iniciais"],
      ["/historico.html", "Posições históricas"],
      ["/alcancar.html", "Jogos para alcançar X"],
    ],
  },
  {
    nome: "Comparações",
    telas: [
      ["/comparativo.html", "Comparativo de campanhas"],
      ["/semelhantes.html", "Campanhas semelhantes"],
      ["/diferenca.html", "Diferença entre dois pontos"],
    ],
  },
  {
    nome: "O histórico",
    telas: [
      ["/desfechos.html", "Pontuação final por posição"],
      ["/resultados.html", "Distribuição de resultados"],
      ["/medias.html", "Média por posição e rodada"],
      ["/ritmo.html", "Aceleração por posição"],
      ["/distancias.html", "Distância entre posições"],
    ],
  },
  {
    nome: "A reta final",
    telas: [
      ["/proximos.html", "Próximos jogos"],
      ["/dificuldade.html", "Dificuldade de tabela"],
      ["/blocos.html", "Blocos de 6 jogos"],
      ["/simulador.html", "Simulador"],
    ],
  },
  // Uma tela só: menu suspenso para um item é um clique cobrado à toa.
  { nome: "Dados", telas: [["/atualizar.html", "Atualizar dados"]] },
];

/** A página aberta, com "/" e "/index.html" valendo a mesma coisa. */
export function telaAtual(caminho) {
  const limpo = (caminho ?? "/").replace(/\/index\.html$/, "/");
  return limpo === "" ? "/" : limpo;
}

/** A seção a que uma tela pertence, ou `null` para a capa. */
export function secaoDaTela(caminho) {
  const atual = telaAtual(caminho);
  return SECOES.find((s) => s.telas.some(([href]) => href === atual)) ?? null;
}

const escapar = (t) => String(t).replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * O HTML do menu.
 *
 * Função pura, para o teste poder olhar o que sai sem um navegador: a garantia
 * que interessa é que toda tela esteja em exatamente uma seção e que a que
 * está aberta se reconheça.
 */
export function montarMenu(caminho) {
  const atual = telaAtual(caminho);
  const capa = atual === "/";

  const inicio = `<a class="menu-inicio" href="/"${
    capa ? ' aria-current="page"' : ""}>Telas</a>`;

  const secoes = SECOES.map((secao) => {
    const aqui = secao.telas.some(([href]) => href === atual);
    // Seção de uma tela só é link direto: abrir um menu para escolher a
    // única opção seria cobrar um clique para não decidir nada.
    if (secao.telas.length === 1) {
      const [href, rotulo] = secao.telas[0];
      return `<a class="menu-botao" href="${href}"${
        aqui ? ' aria-current="page"' : ""}>${escapar(rotulo)}</a>`;
    }

    const itens = secao.telas.map(([href, rotulo]) =>
      `<a href="${href}"${href === atual ? ' aria-current="page"' : ""}>`
      + `${escapar(rotulo)}</a>`).join("");

    return `<div class="menu">
        <button type="button" class="menu-botao" aria-expanded="false"
                ${aqui ? 'data-aqui="sim"' : ""}>${escapar(secao.nome)}</button>
        <div class="menu-lista" hidden>${itens}</div>
      </div>`;
  }).join("");

  return inicio + secoes;
}

/* --------------------------------------------------------------- na tela */
// O módulo também é lido pelo Node, no teste que garante que toda tela está
// no menu: fora do navegador não há `document`, e o resto do arquivo é conta.
if (typeof document !== "undefined") {
  const raiz = document.getElementById("navegacao");
  if (raiz) {
    raiz.innerHTML = montarMenu(location.pathname);
    ligar(raiz);
  }
}

function ligar(raiz) {
  const fechar = (exceto) => {
    for (const menu of raiz.querySelectorAll(".menu")) {
      if (menu === exceto) continue;
      menu.querySelector(".menu-botao").setAttribute("aria-expanded", "false");
      menu.querySelector(".menu-lista").hidden = true;
    }
  };

  raiz.addEventListener("click", (evento) => {
    const botao = evento.target.closest("button.menu-botao");
    if (!botao) return;
    const menu = botao.closest(".menu");
    const aberto = botao.getAttribute("aria-expanded") === "true";
    fechar(menu);
    botao.setAttribute("aria-expanded", String(!aberto));
    menu.querySelector(".menu-lista").hidden = aberto;
  });

  // Clicar fora fecha, e Esc também: um menu aberto por engano não pode ficar
  // por cima dos filtros da página até alguém acertar o botão de novo.
  document.addEventListener("click", (evento) => {
    if (!raiz.contains(evento.target)) fechar(null);
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") fechar(null);
  });
}
