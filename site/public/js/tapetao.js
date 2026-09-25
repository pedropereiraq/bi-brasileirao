/**
 * Os pontos tirados no tapetão, e a chave que os desliga.
 *
 * O BI mostra a tabela como ela **ficou**: punição de tribunal é ponto que
 * saiu da tabela, e ignorá-la seria publicar um campeonato que não existiu —
 * a Portuguesa de 2013 terminaria em 12º, e ninguém terminou em 12º naquele
 * ano com aqueles pontos.
 *
 * Mas a outra pergunta é legítima: como teria sido o campeonato decidido só em
 * campo? Por isso a chave, que vale para o BI inteiro e fica guardada entre
 * visitas, do mesmo jeito que a marca.
 *
 * A punição não é de um jogo. Ela é de um clube, numa edição, **a partir de
 * uma rodada** — não muda placar, não muda vitória, não muda saldo. Só tira
 * pontos da tabela dali em diante. É por isso que o desconto entra no recorte
 * quando a rodada dele entra, exatamente como entraria um jogo daquela rodada.
 */
const CHAVE = "bi-tapetao";
const ouvintes = new Set();

let ligado = guardado();

function guardado() {
  try {
    return localStorage.getItem(CHAVE) !== "sem";
  } catch {
    // Navegador sem armazenamento: o padrão do BI vale para esta visita.
    return true;
  }
}

export const tapetaoLigado = () => ligado;

export function definirTapetao(novo) {
  if (novo === ligado) return;
  ligado = novo;
  try { localStorage.setItem(CHAVE, novo ? "com" : "sem"); } catch { /* sem memória */ }
  pintar();
  for (const ouvinte of ouvintes) ouvinte(ligado);
}

/** Quem precisa redesenhar quando a chave vira. */
export function aoMudarTapetao(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

/**
 * A tabela de punições, baixada uma vez por visita.
 *
 * São dez casos em vinte anos — o arquivo tem menos de meio quilobyte, e
 * carregá-lo junto com o resto evita que cada página precise saber que ele
 * existe.
 */
let punicoes = null;
const baixando = fetch("/dados/tapetao.json")
  .then((r) => r.json())
  .then((dados) => {
    punicoes = dados;
    // Quem já desenhou sem as punições redesenha agora: é mais simples do que
    // obrigar cada página a esperar por meio quilobyte.
    for (const ouvinte of ouvintes) ouvinte(ligado);
    return dados;
  })
  .catch(() => { punicoes = { series: {} }; return punicoes; });

export const carregarTapetao = () => baixando;

/**
 * Os descontos daquela edição, no formato que o motor espera.
 *
 * Devolve lista vazia com a chave desligada: assim quem chama não precisa
 * saber do estado, só passar o resultado adiante.
 */
export function descontosDe(serie, ano) {
  if (!ligado || !punicoes) return [];
  const casos = punicoes.series?.[serie]?.[String(ano)] ?? [];
  return casos.map(([equipe, rodada, pontos]) => ({ equipe, rodada, pontos }));
}

/** Liga os botões do cabeçalho, se a página os tiver. */
export function ligarChaveDeTapetao() {
  const caixa = document.getElementById("chave-tapetao");
  if (!caixa) return;
  caixa.addEventListener("click", (evento) => {
    const botao = evento.target.closest(".chave");
    if (botao) definirTapetao(botao.dataset.tapetao === "com");
  });
  pintar();
}

function pintar() {
  const caixa = document.getElementById("chave-tapetao");
  if (!caixa) return;
  for (const botao of caixa.children) {
    botao.setAttribute("aria-pressed",
      String((botao.dataset.tapetao === "com") === ligado));
  }
}

ligarChaveDeTapetao();
