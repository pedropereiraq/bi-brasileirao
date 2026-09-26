/**
 * Card: quantos jogos o clube levou para chegar a X, edição por edição.
 *
 * A marca é a mesma em todas as linhas; o que muda é quando ela caiu. Uma
 * barra curta é um ano em que a conta fechou cedo — ótimo quando a marca é de
 * pontos, péssimo quando é de gols sofridos. Por isso a cor não sai da
 * posição final nem da edição: sai da própria métrica, e diz de que lado
 * daquela conta o clube está.
 *
 * A edição em que o clube não chegou à marca aparece com o trilho vazio e o
 * total que ele fez. É a resposta mais informativa da tela — "nunca chegou lá"
 * —, e escondê-la deixaria a lista contando só metade da história.
 *
 * A linha pontilhada vertical é a média dos anos em que ele chegou: é contra
 * ela que se lê se esta temporada está adiantada ou atrasada.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH,
} from "/js/cartao.js";
import { nomeBonito, artigoDefinido } from "/js/nomes.js";
import {
  METRICAS, marcosDoClube, ordenarMarcos, resumoDosMarcos,
} from "/js/alcancar.js";

const ALTURA_LINHA = 40;
const ALTURA_MINIMA = 22;

const X_ANO = MARGEM;
const X_BARRA = MARGEM + 62;
const X_FIM_BARRA = 1300;
const X_TOTAL = 1384;
const X_TAG = 1404;
const LARGURA_TAG = 76;

const num = (v) => v.toFixed(1).replace(".", ",");
const ordinal = (p) => `${p}º`;

/** Verde no que é bom alcançar, cinza no empate, vermelho no que dói. */
const corDaMetrica = (metrica) => ({
  bom: COR.verde, neutro: COR.cinzaEscuro, ruim: COR.negativo,
}[METRICAS[metrica]?.sentido] ?? COR.cinzaEscuro);

export function montarCartao(estado) {
  const { serie, equipe, metrica, alvo, ordem, clubes, campanhas } = estado;
  if (!campanhas || !equipe || !alvo) return null;

  const marcos = ordenarMarcos(
    marcosDoClube(campanhas, { serie, equipe, metrica, alvo }), ordem);
  const resumo = resumoDosMarcos(marcos);
  const cor = corDaMetrica(metrica);
  const nome = nomeBonito(equipe);
  const artigo = artigoDefinido(equipe);
  const rotulo = METRICAS[metrica]?.nome ?? "pontos";

  const spec = {
    titulo: `Quantos jogos ${artigo} ${nome} levou para chegar a ${alvo} `
          + `${rotulo} na Série ${serie}`,
    subtitulo: "",
    escudo: clubes?.[equipe]?.escudo,
    arquivo: `alcancar-${nome}-${serie}-${metrica}-${alvo}`,
    numeros: [],
    nota: "",
    corpo: async (ctx, y) => {
      if (!marcos.length) {
        semEdicoes(ctx, { y, nome, artigo, serie });
        return;
      }
      resumoEnxuto(ctx, { resumo, cor, rotulo, alvo, y });
      linhaH(ctx, MARGEM, CARD.largura - MARGEM, y + 76, COR.linha);
      spec.hover = linhasDasEdicoes(ctx, {
        marcos, resumo, cor, rotulo, alvo, y: y + 102,
      });
    },
  };
  return spec;
}

function semEdicoes(ctx, { y, nome, artigo, serie }) {
  texto(ctx, "Nenhuma edição para comparar.", MARGEM, y + 70,
        { tamanho: 26, peso: 700, cor: COR.azul, familia: "Bree Serif" });
  texto(ctx, `${artigo} ${nome} não aparece em nenhuma Série ${serie} do `
           + `recorte que o BI cobre.`,
        MARGEM, y + 108, { tamanho: 16, cor: COR.cinzaTexto });
}

/* --------------------------------------------------------------- resumo */
function resumoEnxuto(ctx, { resumo, cor, rotulo, alvo, y }) {
  const itens = [
    { valor: `${resumo.alcancaram} de ${resumo.edicoes}`,
      nome: `edições que chegaram a ${alvo} ${rotulo}`, cor: COR.azul },
    { valor: resumo.media === null ? "—" : num(resumo.media),
      nome: "jogos em média para chegar", cor },
    { valor: resumo.maisRapido ? `${resumo.maisRapido.jogos} jogos` : "—",
      nome: resumo.maisRapido ? `mais rápido · ${resumo.maisRapido.ano}`
                              : "nunca chegou lá",
      cor: COR.azulEscuro },
  ];

  const largura = 244, altura = 56;
  itens.forEach((item, i) => {
    const x = MARGEM + i * (largura + 14);
    caixa(ctx, x, y, largura, altura, COR.branco, 7);
    ctx.save();
    ctx.strokeStyle = COR.linha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + .5, y + .5, largura - 1, altura - 1, 7);
    ctx.stroke();
    ctx.restore();
    caixa(ctx, x, y + 8, 4, altura - 16, item.cor, 2);

    texto(ctx, item.valor, x + 16, y + 30,
          { tamanho: 24, peso: 800, cor: item.cor });
    texto(ctx, item.nome, x + 16, y + 46,
          { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
            cor: COR.cinzaEscuro });
  });
}

/* ----------------------------------------------------- uma linha por ano */
function linhasDasEdicoes(ctx, { marcos, resumo, cor, rotulo, alvo, y }) {
  const disponivel = CARD.altura - 96 - y;
  const altura = Math.min(ALTURA_LINHA,
                          Math.max(ALTURA_MINIMA, disponivel / marcos.length));
  const larguraBarra = X_FIM_BARRA - X_BARRA;
  // A régua é a edição mais longa: assim a barra diz em que altura da
  // temporada a marca caiu, e não só quantos jogos foram.
  const maximo = Math.max(...marcos.map((m) => m.jogosNaEdicao), 1);
  const escala = (v) => (v / maximo) * larguraBarra;
  const raio = Math.min(14, altura / 2 - 1);

  cabecalho(ctx, { rotulo, alvo, y: y - 12 });

  const base = y + marcos.length * altura;
  const pontosDoHover = [];

  for (const [i, marco] of marcos.entries()) {
    const yLinha = y + i * altura;
    const meio = yLinha + altura / 2;
    const chegou = marco.jogos !== null;

    // A edição em andamento é a que motiva a pergunta: fica com fundo próprio.
    if (!marco.encerrada) {
      caixa(ctx, X_ANO - 8, yLinha + 1, CARD.largura - MARGEM * 2 + 16,
            altura - 2, COR.azulLavado, 6);
    }

    texto(ctx, marco.ano, X_ANO, meio + 5,
          { tamanho: 15, peso: 800, cor: COR.azulEscuro });

    // Trilho até a edição inteira, para as barras serem comparáveis.
    caixa(ctx, X_BARRA, meio - 6, larguraBarra, 12, COR.cinzaClaro, 6);

    if (!chegou) {
      texto(ctx, `não chegou · ${marco.total} em ${marco.jogosNaEdicao} jogos`,
            X_BARRA + 10, meio + 4,
            { tamanho: 11.5, peso: 700, cor: COR.cinzaEscuro });
    } else {
      const cheio = Math.max(4, escala(marco.jogos));
      caixa(ctx, X_BARRA, meio - 6, cheio, 12, cor, 6);

      const centro = X_BARRA + Math.max(cheio, raio);
      ctx.save();
      ctx.fillStyle = cor;
      ctx.beginPath();
      ctx.arc(centro, meio, raio, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      texto(ctx, marco.jogos, centro, meio + raio * 0.37,
            { tamanho: raio * 1.08, peso: 800, alinha: "center",
              cor: COR.branco });
    }

    texto(ctx, marco.total, X_TOTAL, meio + 5,
          { tamanho: 15, peso: 800, alinha: "right",
            cor: marco.encerrada ? COR.azulEscuro : COR.cinzaEscuro });

    etiquetaDaPosicao(ctx, { marco, y: meio - 9 });

    pontosDoHover.push({
      n: marco.ano,
      x: X_ANO - 8, y: yLinha, l: CARD.largura - MARGEM * 2 + 16, a: altura,
      ...dicaDoMarco(marco, { cor, rotulo, alvo }),
    });
  }

  // Por cima das barras, e não por baixo: o fundo da edição em andamento
  // apagaria a linha justamente na que mais interessa comparar.
  if (resumo.media !== null) {
    mediaDeJogos(ctx, { x: X_BARRA + escala(resumo.media), y: y - 4, base,
                        media: resumo.media });
  }

  return {
    pontos: pontosDoHover, unidade: "", eixo: "caixa",
    topo: y, alturaPlot: marcos.length * altura,
    x0: MARGEM, x1: CARD.largura - MARGEM, largura: altura / 2,
  };
}

function cabecalho(ctx, { rotulo, alvo, y }) {
  const escrever = (t, x, alinha) =>
    texto(ctx, t, x, y, { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
                          cor: COR.cinzaEscuro, alinha });
  escrever("ano", X_ANO, "left");
  escrever(`jogos até ${alvo} ${rotulo}`, X_BARRA, "left");
  escrever("no fim", X_TOTAL, "right");
  escrever("posição", X_TAG + LARGURA_TAG, "right");
}

/** A média em pé, atravessando as barras: é contra ela que se compara. */
function mediaDeJogos(ctx, { x, y, base, media }) {
  ctx.save();
  ctx.strokeStyle = COR.azulEscuro;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, base);
  ctx.stroke();
  ctx.restore();
  // O rótulo vai embaixo da linha, onde não há barra para cobrir.
  texto(ctx, `média ${num(media)} jogos`, x, base + 16,
        { tamanho: 10.5, peso: 700, alinha: "center", cor: COR.azulEscuro });
}

function etiquetaDaPosicao(ctx, { marco, y }) {
  if (!marco.encerrada) {
    // Sem desfecho não há posição final. Etiqueta vazada para não parecer uma.
    ctx.save();
    ctx.strokeStyle = COR.cinza;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(X_TAG, y, LARGURA_TAG, 18, 5);
    ctx.stroke();
    ctx.restore();
    texto(ctx, "em curso", X_TAG + LARGURA_TAG / 2, y + 13,
          { tamanho: 10, peso: 700, alinha: "center", cor: COR.cinzaEscuro });
    return;
  }
  // A posição entra como informação, e não como cor: quem colore esta tela é
  // a métrica, e duas escalas de cor na mesma linha brigariam entre si.
  caixa(ctx, X_TAG, y, LARGURA_TAG, 18, COR.cinzaClaro, 5);
  texto(ctx, `${ordinal(marco.posFim)} lugar`, X_TAG + LARGURA_TAG / 2, y + 13,
        { tamanho: 11, peso: 800, alinha: "center", cor: COR.azulEscuro });
}

function dicaDoMarco(marco, { cor, rotulo, alvo }) {
  const desfecho = marco.encerrada
    ? `terminou em ${ordinal(marco.posFim)}`
    : `edição em andamento · ${marco.jogosNaEdicao} jogos até agora`;

  return {
    itens: [{
      rotulo: marco.jogos === null
        ? `não chegou a ${alvo} ${rotulo}`
        : `${alvo} ${rotulo} no ${marco.jogos}º jogo`,
      cor,
      pontos: null,
      texto: `${marco.total} no fim`,
      detalhe: desfecho,
    }],
    diferenca: marco.jogos === null ? null : {
      rotulo: `${marco.jogosNaEdicao - marco.jogos} jogos depois`,
      texto: `para o resto da edição`,
      cor: COR.cinzaEscuro,
    },
  };
}
