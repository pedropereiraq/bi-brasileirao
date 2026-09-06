/**
 * Corpo do card de campanha de um clube.
 *
 * Grade 2×2 ocupando a altura útil: a skill é explícita em que card com buraco
 * branco embaixo é card mal montado. A primeira versão deixava metade do card
 * vazia; esta preenche.
 *
 *   pontos por mando   |  evolução da posição
 *   evolução da pontuação | jogos do recorte
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, barraTED,
} from "/js/cartao.js";

const CORES_RESULTADO = { T: COR.azul, E: COR.cinzaEscuro, D: COR.vermelho };

const VAO = 44;
const LARGURA_BLOCO = (CARD.largura - MARGEM * 2 - VAO) / 2;
const ALTURA_LINHA = 258;

export function corpoDoClube({ passos, mandos }) {
  return (ctx, y) => {
    const dir = MARGEM + LARGURA_BLOCO + VAO;

    blocoMando(ctx, MARGEM, y, LARGURA_BLOCO, mandos);
    grafico(ctx, dir, y, LARGURA_BLOCO, passos, "posicao");

    const y2 = y + ALTURA_LINHA;
    grafico(ctx, MARGEM, y2, LARGURA_BLOCO, passos, "pontos");
    tiraDeJogos(ctx, dir, y2, LARGURA_BLOCO, passos);
  };
}

function titulo(ctx, t, x, y) {
  texto(ctx, t, x, y + 15,
        { tamanho: 20, peso: 700, cor: COR.azul, familia: "Bree Serif" });
  linhaH(ctx, x, x + LARGURA_BLOCO, y + 26, COR.linha, 2);
}

/* -------------------------------------------------------------- mando */
function blocoMando(ctx, x, y, largura, mandos) {
  titulo(ctx, "Pontos por mando", x, y);
  const maximo = Math.max(mandos.casa.j, mandos.fora.j, mandos.todos.j, 1);

  const linhas = [["Casa", mandos.casa], ["Fora", mandos.fora], ["Total", mandos.todos]];
  linhas.forEach(([nome, m], i) => {
    const yy = y + 52 + i * 62;
    texto(ctx, nome, x, yy + 22, { tamanho: 14, peso: 700, maiuscula: true,
                                   espaco: 1, cor: COR.cinzaEscuro });
    const disponivel = largura - 300;
    barraTED(ctx, x + 84, yy + 4, (m.j / maximo) * disponivel, 26, m);
    texto(ctx, m.j ? `${m.pts} pts · ${m.j}J` : "sem jogos",
          x + largura, yy + 16,
          { tamanho: 16, peso: 800, cor: COR.azulEscuro, alinha: "right" });
    if (m.j) {
      texto(ctx, `${m.t}T · ${m.e}E · ${m.d}D · ${aproveitamento(m)}`,
            x + largura, yy + 34,
            { tamanho: 13, cor: COR.cinzaEscuro, alinha: "right" });
    }
  });

  texto(ctx, "azul, triunfo · cinza, empate · vermelho, derrota",
        x, y + 52 + 3 * 62 + 6, { tamanho: 13, cor: COR.cinzaEscuro });
}

const aproveitamento = (m) => `${Math.round((m.pts / (3 * m.j)) * 100)}%`;

/* ----------------------------------------------------------- gráficos */
function grafico(ctx, x, y, largura, passos, tipo) {
  const ehPosicao = tipo === "posicao";
  titulo(ctx, ehPosicao ? "Evolução da posição" : "Evolução da pontuação", x, y);

  if (!passos.length) {
    texto(ctx, "sem jogos no recorte", x, y + 70,
          { tamanho: 15, cor: COR.cinzaEscuro });
    return;
  }

  const topo = y + 48, altura = 150, esquerda = x + 42;
  const util = largura - 42;
  const px = (i) => esquerda + (passos.length <= 1
    ? util / 2 : (i / (passos.length - 1)) * util);

  const maximo = Math.max(passos.at(-1).pts_ac, 1);
  const py = ehPosicao
    ? (p) => topo + ((p.pos - 1) / 19) * altura
    : (p) => topo + altura - (p.pts_ac / maximo) * altura;

  const marcas = ehPosicao
    ? [1, 5, 10, 15, 20].map((v) => [v, `${v}º`, topo + ((v - 1) / 19) * altura])
    : [0, Math.round(maximo / 2), maximo].map(
        (v) => [v, String(v), topo + altura - (v / maximo) * altura]);

  for (const [, rotulo, yy] of marcas) {
    linhaH(ctx, esquerda, x + largura, yy, COR.cinzaClaro);
    texto(ctx, rotulo, x + 34, yy + 4,
          { tamanho: 12, cor: COR.cinzaEscuro, alinha: "right" });
  }

  const cor = ehPosicao ? COR.azul : COR.vermelho;
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.beginPath();
  passos.forEach((p, i) => (i ? ctx.lineTo(px(i), py(p)) : ctx.moveTo(px(i), py(p))));
  ctx.stroke();
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.arc(px(passos.length - 1), py(passos.at(-1)), 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Rótulo do último ponto: é o número que o leitor procura primeiro.
  const ultimo = passos.at(-1);
  texto(ctx, ehPosicao ? `${ultimo.pos}º` : `${ultimo.pts_ac} pts`,
        px(passos.length - 1) - 12, py(ultimo) - 14,
        { tamanho: 17, peso: 800, cor, alinha: "right" });

  texto(ctx, `R${passos[0].rodada}`, esquerda, topo + altura + 26,
        { tamanho: 12, cor: COR.cinzaEscuro });
  texto(ctx, `R${ultimo.rodada}`, x + largura, topo + altura + 26,
        { tamanho: 12, cor: COR.cinzaEscuro, alinha: "right" });
}

/* -------------------------------------------------------------- jogos */
function tiraDeJogos(ctx, x, y, largura, passos) {
  titulo(ctx, `Jogos no recorte (${passos.length})`, x, y);
  if (!passos.length) return;

  // Quebra em linhas: 26 jogos não cabem numa tira só na metade da largura.
  const porLinha = Math.min(14, passos.length);
  const vao = 6;
  const lado = Math.min(40, (largura - vao * (porLinha - 1)) / porLinha);

  passos.forEach((p, i) => {
    const coluna = i % porLinha, linha = Math.floor(i / porLinha);
    const cx = x + coluna * (lado + vao);
    const cy = y + 50 + linha * (lado + 26);
    caixa(ctx, cx, cy, lado, lado, CORES_RESULTADO[p.resultado], 5);
    texto(ctx, p.resultado, cx + lado / 2, cy + lado / 2 + 6,
          { tamanho: 16, peso: 800, cor: COR.branco, alinha: "center" });
    texto(ctx, p.rodada, cx + lado / 2, cy + lado + 15,
          { tamanho: 11, cor: COR.cinzaEscuro, alinha: "center" });
  });

  const linhas = Math.ceil(passos.length / porLinha);
  const yFim = y + 50 + linhas * (lado + 26);

  // Os três últimos jogos por extenso, que é o que se lê primeiro.
  const ultimos = passos.slice(-3).reverse();
  texto(ctx, "Últimos jogos", x, yFim + 12,
        { tamanho: 13, peso: 700, maiuscula: true, espaco: 1, cor: COR.cinzaEscuro });
  ultimos.forEach((p, i) => {
    const yy = yFim + 36 + i * 22;
    texto(ctx, `R${p.rodada}`, x, yy, { tamanho: 13.5, cor: COR.cinzaEscuro });
    texto(ctx, `${p.mando === "casa" ? "casa" : "fora"} · ${nomeCurto(p.adversario)}`,
          x + 46, yy, { tamanho: 13.5, cor: COR.azulEscuro });
    texto(ctx, `${p.gp} × ${p.gc}`, x + largura, yy,
          { tamanho: 13.5, peso: 800, cor: CORES_RESULTADO[p.resultado],
            alinha: "right" });
  });
}

const nomeCurto = (equipe) => equipe.replace(/\s*\([A-Z]{2}\)$/, "");
