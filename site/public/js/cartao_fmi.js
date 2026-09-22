/**
 * Card: FMI — pontos ganhos fora menos pontos perdidos em casa.
 *
 * O índice só se entende ao lado das duas metades que o formam, e elas partem
 * de expectativas opostas: fora, a régua é zero e tudo que se soma foi ganho;
 * em casa, a régua é três e tudo que se deixa de somar foi perdido. Por isso o
 * gráfico é uma borboleta em vez de uma barra: o eixo no meio separa o que foi
 * conquistado na estrada, à direita, do que foi entregue em casa, à esquerda, e
 * o índice é o que sobra de um lado sobre o outro.
 *
 * Um clube que vence em casa e perde fora fica em zero — cumpriu o script. O
 * índice sobe para quem tira ponto de fora sem abrir mão do que é seu.
 *
 * Com um clube escolhido, o card abre o detalhe **na ordem da classificação de
 * hoje**. É o que responde onde os pontos foram ganhos e perdidos: contra o
 * topo da tabela ou contra o fim dela. Ordenar pelo calendário responderia
 * outra pergunta.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito, artigoDefinido } from "/js/nomes.js";
import { marcaAtual } from "/js/marca.js";
import {
  detalheNaOrdemDaTabela, indiceDeCadaClube, somarDetalhe,
} from "/js/fmi.js";

const LARGURA_IDENTIDADE = 200;
const LARGURA_DETALHE = 560;
const VAO = 30;

const comSinal = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : "0");

export function montarCartao(estado) {
  const { serie, edicao, casa, fora, partidas, classificacao, clubes,
          destaque, aoEscolher } = estado;
  if (!edicao || !casa?.length) return null;

  const linhas = indiceDeCadaClube(casa, fora);
  const detalhe = destaque
    ? detalheNaOrdemDaTabela(partidas, destaque, classificacao) : null;

  const spec = {
    titulo: `FMI na Série ${serie} ${edicao.ano}`,
    subtitulo: "Pontos ganhos fora de casa menos pontos perdidos em casa",
    arquivo: `fmi-${serie}-${edicao.ano}`,
    numeros: [],
    nota: `Fora, ponto ganho é o que se soma — empate vale 1, `
        + `${marcaAtual().triunfo} vale 3. Em casa, ponto perdido é o que se `
        + `deixa de somar — empate custa 2, derrota custa 3.`,
    corpo: async (ctx, y) => {
      const base = CARD.altura - 84;
      const topo = y + 24;
      const alturaCabecalho = 20;
      const alturaLinha = (base - topo - alturaCabecalho) / linhas.length;

      const larguraGrafico = CARD.largura - MARGEM * 2
        - (detalhe ? LARGURA_DETALHE + VAO : 0);

      const alvos = await borboleta(ctx, {
        linhas, clubes, destaque, x: MARGEM, largura: larguraGrafico,
        topo, alturaCabecalho, alturaLinha,
      });

      if (detalhe) {
        alvos.push(...await painelDoDetalhe(ctx, {
          detalhe, clube: destaque, clubes,
          x: MARGEM + larguraGrafico + VAO, largura: LARGURA_DETALHE,
          topo, alturaCabecalho, base,
        }));
      }

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: y, alturaPlot: base - y,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
        aoClicar: aoEscolher
          ? (alvo) => { if (alvo.equipe) aoEscolher(alvo.equipe); }
          : undefined,
      };
    },
  };
  return spec;
}

/* ------------------------------------------------------------ borboleta */
async function borboleta(ctx, o) {
  const { linhas, clubes, destaque, x, largura, topo, alturaCabecalho,
          alturaLinha } = o;

  const xEixo = x + LARGURA_IDENTIDADE + (largura - LARGURA_IDENTIDADE) / 2;
  const meiaAsa = (largura - LARGURA_IDENTIDADE) / 2 - 42;
  const maximo = Math.max(1,
    ...linhas.map((l) => Math.max(l.ganhosFora, l.perdidosCasa)));
  const porPonto = meiaAsa / maximo;

  texto(ctx, "fmi", x + 4, topo + 12,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });
  texto(ctx, "perdidos em casa", xEixo - 12, topo + 12,
        { tamanho: 9.5, peso: 700, alinha: "right", maiuscula: true,
          espaco: .8, cor: COR.negativo });
  texto(ctx, "ganhos fora", xEixo + 12, topo + 12,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.positivo });
  linhaH(ctx, x, x + largura, topo + alturaCabecalho - 3, COR.linha);

  // O eixo atravessa as vinte linhas: é dele que as duas asas partem, e sem
  // ele cada barra viraria um número solto.
  const yBase = topo + alturaCabecalho;
  ctx.save();
  ctx.strokeStyle = COR.cinza;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(xEixo, yBase - 2);
  ctx.lineTo(xEixo, yBase + linhas.length * alturaLinha);
  ctx.stroke();
  ctx.restore();

  const alvos = [];
  for (const [i, linha] of linhas.entries()) {
    const yLinha = yBase + i * alturaLinha;
    const meio = yLinha + alturaLinha / 2;
    const marcado = destaque === linha.equipe;
    const alturaBarra = Math.min(20, alturaLinha - 8);

    if (marcado) caixa(ctx, x, yLinha, largura, alturaLinha - 2, COR.marca, 5);

    // O índice antes do escudo: é ele que ordena a lista, e quem lê de cima
    // para baixo está seguindo essa coluna.
    const corIndice = linha.fmi > 0 ? COR.positivo
                    : linha.fmi < 0 ? COR.negativo : COR.cinzaEscuro;
    caixa(ctx, x + 4, meio - 13, 52, 26,
          marcado ? COR.marcaTexto : corIndice, 6);
    texto(ctx, comSinal(linha.fmi), x + 30, meio + 6,
          { tamanho: 14, peso: 800, alinha: "center",
            cor: marcado ? corIndice : COR.branco });

    const lado = Math.min(22, alturaLinha - 6);
    desenharEscudo(ctx, await imagem(clubes?.[linha.equipe]?.escudo),
                   x + 66, meio - lado / 2, lado);
    texto(ctx, cortar(ctx, nomeBonito(linha.equipe), 104, 12, 700),
          x + 94, meio + 4,
          { tamanho: 12, peso: 700,
            cor: marcado ? COR.marcaTexto : COR.azulEscuro });

    const perdidos = linha.perdidosCasa * porPonto;
    const ganhos = linha.ganhosFora * porPonto;
    caixa(ctx, xEixo - perdidos, meio - alturaBarra / 2, perdidos, alturaBarra,
          COR.negativo, 4);
    caixa(ctx, xEixo, meio - alturaBarra / 2, ganhos, alturaBarra,
          COR.positivo, 4);

    texto(ctx, linha.perdidosCasa, xEixo - perdidos - 8, meio + 5,
          { tamanho: 12, peso: 800, alinha: "right",
            cor: marcado ? COR.marcaTexto : COR.negativo });
    texto(ctx, linha.ganhosFora, xEixo + ganhos + 8, meio + 5,
          { tamanho: 12, peso: 800,
            cor: marcado ? COR.marcaTexto : COR.positivo });

    alvos.push({
      n: nomeBonito(linha.equipe), equipe: linha.equipe,
      x, y: yLinha, l: largura, a: alturaLinha - 2,
      itens: [
        { rotulo: "ganhos fora", cor: COR.positivo, pontos: linha.ganhosFora,
          detalhe: `em ${linha.jogosFora} jogos` },
        { rotulo: "perdidos em casa", cor: COR.negativo,
          pontos: linha.perdidosCasa, detalhe: `em ${linha.jogosCasa} jogos` },
      ],
      diferenca: {
        rotulo: comSinal(linha.fmi),
        texto: destaque === linha.equipe
          ? "clique para fechar o detalhe" : "clique para ver onde",
        cor: corIndice,
      },
    });
  }
  return alvos;
}

/* -------------------------------------------------------------- detalhe */
/** A cor do que se ganhou fora: quanto mais pontos, mais forte. */
const tomGanho = (pontos) => (pontos === 3 ? COR.positivo
  : pontos === 1 ? mistura(COR.fundo, COR.positivo, .45) : null);

/** A cor do que se perdeu em casa: quanto mais pontos, mais forte. */
const tomPerda = (pontos) => (pontos === 3 ? COR.negativo
  : pontos === 2 ? mistura(COR.fundo, COR.negativo, .5) : null);

function mistura(de, para, t) {
  const canal = (cor, i) => parseInt(cor.slice(1 + i * 2, 3 + i * 2), 16);
  const valor = (i) => Math.round(canal(de, i) + (canal(para, i) - canal(de, i)) * t);
  return `rgb(${valor(0)}, ${valor(1)}, ${valor(2)})`;
}

async function painelDoDetalhe(ctx, o) {
  const { detalhe, clube, clubes, x, largura, topo, alturaCabecalho, base } = o;
  const totais = somarDetalhe(detalhe);

  texto(ctx, `onde ${artigoDefinido(clube)} ${nomeBonito(clube)} ganhou e perdeu`,
        x + 4, topo + 12,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });

  const xFora = x + largura - 190;
  const xCasa = x + largura - 90;
  texto(ctx, "ganhou fora", xFora + 40, topo + 12,
        { tamanho: 9.5, peso: 700, alinha: "center", maiuscula: true,
          espaco: .8, cor: COR.positivo });
  texto(ctx, "perdeu em casa", xCasa + 40, topo + 12,
        { tamanho: 9.5, peso: 700, alinha: "center", maiuscula: true,
          espaco: .8, cor: COR.negativo });
  linhaH(ctx, x, x + largura, topo + alturaCabecalho - 3, COR.linha);

  // Uma linha a mais no fim para os totais: é o que amarra o detalhe ao
  // número da barra e permite conferir a conta no próprio card.
  const yBase = topo + alturaCabecalho;
  const alturaLinha = (base - yBase) / (detalhe.length + 1);

  const alvos = [];
  for (const [i, linha] of detalhe.entries()) {
    const yLinha = yBase + i * alturaLinha;
    const meio = yLinha + alturaLinha / 2;
    if (i % 2 === 0) caixa(ctx, x, yLinha, largura, alturaLinha - 1, COR.branco, 4);

    texto(ctx, linha.pos, x + 14, meio + 4,
          { tamanho: 11, peso: 800, alinha: "center", cor: COR.cinzaEscuro });

    const lado = Math.min(20, alturaLinha - 6);
    desenharEscudo(ctx, await imagem(clubes?.[linha.adversario]?.escudo),
                   x + 26, meio - lado / 2, lado);
    texto(ctx, cortar(ctx, nomeBonito(linha.adversario), xFora - x - 60, 12, 700),
          x + 52, meio + 4,
          { tamanho: 12, peso: 700, cor: COR.azulEscuro });

    celula(ctx, { valor: linha.fora?.ganhos, jogou: linha.fora?.jogou,
                  tom: tomGanho, x: xFora, meio, alturaLinha });
    celula(ctx, { valor: linha.casa?.perdidos, jogou: linha.casa?.jogou,
                  tom: tomPerda, x: xCasa, meio, alturaLinha });

    alvos.push({
      n: nomeBonito(linha.adversario),
      x, y: yLinha, l: largura, a: alturaLinha - 1,
      itens: [
        { rotulo: "fora", cor: COR.positivo,
          pontos: linha.fora?.jogou ? linha.fora.ganhos : null,
          detalhe: linha.fora?.jogou
            ? `${linha.fora.gp}×${linha.fora.gc} · ponto ganho` : "ainda não jogou" },
        { rotulo: "em casa", cor: COR.negativo,
          pontos: linha.casa?.jogou ? linha.casa.perdidos : null,
          detalhe: linha.casa?.jogou
            ? `${linha.casa.gp}×${linha.casa.gc} · ponto perdido` : "ainda não jogou" },
      ],
      diferenca: {
        rotulo: `${linha.pos}º`,
        texto: nomeBonito(linha.adversario),
        cor: COR.cinzaTexto,
      },
    });
  }

  const yTotal = yBase + detalhe.length * alturaLinha;
  const meioTotal = yTotal + alturaLinha / 2;
  caixa(ctx, x, yTotal, largura, alturaLinha - 1, COR.cinzaClaro, 4);
  texto(ctx, "total", x + 52, meioTotal + 4,
        { tamanho: 11, peso: 800, maiuscula: true, espaco: .8,
          cor: COR.cinzaTexto });
  texto(ctx, totais.ganhosFora, xFora + 40, meioTotal + 5,
        { tamanho: 14, peso: 800, alinha: "center", cor: COR.positivo });
  texto(ctx, totais.perdidosCasa, xCasa + 40, meioTotal + 5,
        { tamanho: 14, peso: 800, alinha: "center", cor: COR.negativo });

  return alvos;
}

/**
 * A casa de um confronto.
 *
 * Zero ponto ganho e zero ponto perdido não ganham cor: são os dois desfechos
 * em que nada aconteceu fora do esperado, e pintá-los faria a tabela inteira
 * parecer acontecimento. Jogo que ainda não houve vem com traço.
 */
function celula(ctx, { valor, jogou, tom, x, meio, alturaLinha }) {
  if (!jogou) {
    texto(ctx, "—", x + 40, meio + 4,
          { tamanho: 12, alinha: "center", cor: COR.cinza });
    return;
  }
  const fundo = tom(valor);
  const alto = Math.min(22, alturaLinha - 6);
  if (fundo) caixa(ctx, x + 14, meio - alto / 2, 52, alto, fundo, 5);
  texto(ctx, valor, x + 40, meio + 5,
        { tamanho: 12.5, peso: 800, alinha: "center",
          cor: fundo ? COR.branco : COR.cinzaEscuro });
}
