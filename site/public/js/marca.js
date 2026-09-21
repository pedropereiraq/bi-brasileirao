/**
 * Qual marca o BI está vestindo.
 *
 * O mesmo BI serve a duas casas: o ECBahia Números, no Twitter, e o Podcast45,
 * no YouTube. Os números são os mesmos, a roupa não — e um card sai para
 * publicação com uma assinatura só. Por isso a escolha é uma chave no
 * cabeçalho, vale para a página e para o card que sai dela, e fica lembrada no
 * navegador: quem produz para um canal não quer trocar a marca a cada tela.
 *
 * Aqui mora só o que a marca *é*, inclusive a palavra: o ECBahia escreve
 * **triunfo** e nunca "vitória"; o Podcast45 escreve **vitória** e nunca
 * "triunfo". Quem monta uma frase de card pega em `marcaAtual().triunfo` em
 * vez de escrever a palavra direto.
 *
 * A paleta de cada uma está em `cartao.js` (para o canvas) e em `bi.css`
 * (para a página), cada uma na língua do seu meio.
 *
 * Módulo sem dependência nenhuma de propósito: `cartao.js` o importa, e uma
 * dependência de volta faria um ciclo.
 */
export const MARCAS = {
  ecbahia: {
    nome: "ECBahia Números",
    curto: "ecbahia",
    logo: "/img/marca.png",
    // O logotipo é deitado: 250px na régua de 1600, como manda a skill.
    larguraNoCard: 250,
    topoNoCard: 40,
    assinatura: "@ECBahiaNumeros",
    rodape: "<b>ecbahia</b>numeros",
    triunfo: "triunfo",
    triunfos: "triunfos",
  },
  podcast45: {
    nome: "Podcast45",
    curto: "45",
    logo: "/img/marca-podcast45.png",
    // O selo é redondo: nos mesmos 250px ele desceria até a régua e brigaria
    // com o título. Entra com a altura do bloco do cabeçalho.
    larguraNoCard: 100,
    topoNoCard: 22,
    assinatura: "Podcast45 · 45 minutos",
    rodape: "<b>podcast</b>45",
    triunfo: "vitória",
    triunfos: "vitórias",
  },
};

const CHAVE = "bi-marca";
const PADRAO = "ecbahia";

const ouvintes = new Set();
let escolhida = guardada();

/** O que ficou salvo da última visita, quando ainda existe. */
function guardada() {
  try {
    const salva = localStorage.getItem(CHAVE);
    return MARCAS[salva] ? salva : PADRAO;
  } catch {
    // Navegador sem armazenamento (janela anônima, permissão negada): a
    // escolha vale só para esta sessão, e isso não pode derrubar a página.
    return PADRAO;
  }
}

export const marcaEscolhida = () => escolhida;
export const marcaAtual = () => MARCAS[escolhida];

export function definirMarca(nome) {
  if (!MARCAS[nome] || nome === escolhida) return;
  escolhida = nome;
  try { localStorage.setItem(CHAVE, nome); } catch { /* sem memória */ }
  vestir();
  for (const ouvinte of ouvintes) ouvinte(nome);
}

/** Quem precisa redesenhar quando a marca troca — as páginas de card. */
export function aoMudarMarca(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

/**
 * Põe a marca na página.
 *
 * O `data-marca` no `<html>` é o que o CSS lê para trocar a paleta inteira; o
 * resto aqui é o que o CSS não alcança — o arquivo do logotipo e o texto da
 * assinatura.
 */
function vestir() {
  const marca = MARCAS[escolhida];
  document.documentElement.dataset.marca = escolhida;

  for (const img of document.querySelectorAll(".marca img")) {
    img.src = marca.logo;
    img.alt = marca.nome;
  }
  for (const alvo of document.querySelectorAll("[data-assinatura]")) {
    alvo.innerHTML = marca.rodape;
  }
  for (const botao of document.querySelectorAll("#chave-marca .chave")) {
    botao.setAttribute("aria-pressed", String(botao.dataset.marca === escolhida));
  }
}

function ligar() {
  vestir();
  document.getElementById("chave-marca")?.addEventListener("click", (evento) => {
    const botao = evento.target.closest(".chave");
    if (botao) definirMarca(botao.dataset.marca);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", ligar);
} else {
  ligar();
}
