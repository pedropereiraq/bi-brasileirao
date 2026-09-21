/**
 * Card: os próximos jogos de um grupo de concorrentes diretos.
 *
 * A pergunta da reta final é quem tem a tabela mais dura daqui para a frente,
 * e ela só existe entre quem disputa a mesma coisa — os quatro da briga pela
 * Libertadores, os cinco que fogem do rebaixamento. Por isso o filtro é uma
 * faixa de posições: o card monta uma coluna para cada clube que está nela
 * hoje e põe os calendários lado a lado.
 *
 * A posição do adversário vai numa etiqueta de cor, do vermelho (líder, jogo
 * duro) ao verde (lanterna, jogo fácil). É a cor que faz a coluna ser lida de
 * relance; o número está ali para quem quiser conferir.
 */
import {
  CARD, COR, MARGEM, texto, caixa, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import { campanhaCompleta } from "/js/grafico_campanha.js";
import {
  clubesNaFaixa, mediaDosAdversarios, proximosJogos, tamanhoDaLista,
} from "/js/proximos_jogos.js";

const POSICOES = 20;
const VAO = 12;
const TETO_DE_JOGOS = 10;

const num = (v) => v.toFixed(1).replace(".", ",");
const ordinal = (p) => `${p}º`;

// Vermelho no 1º, cinza no meio da tabela, verde no 20º. O verde é o do badge,
// um tom abaixo do verde da identidade, para o número branco continuar legível.
const BADGE_VERDE = "#58913F";
const BADGE_MEIO = "#8A8A8A";

/** Interpola duas cores hexadecimais. */
function mistura(de, para, t) {
  const canal = (cor, i) => parseInt(cor.slice(1 + i * 2, 3 + i * 2), 16);
  const valor = (i) => Math.round(canal(de, i) + (canal(para, i) - canal(de, i)) * t);
  return `rgb(${valor(0)}, ${valor(1)}, ${valor(2)})`;
}

/** A dificuldade daquele adversário virando cor. */
function corDaPosicao(posicao) {
  const t = Math.min(1, Math.max(0, (posicao - 1) / (POSICOES - 1)));
  return t < 0.5
    ? mistura(COR.vermelho, BADGE_MEIO, t * 2)
    : mistura(BADGE_MEIO, BADGE_VERDE, (t - 0.5) * 2);
}

export function montarCartao(estado) {
  const { serie, edicao, jogos, classificacao, faixa, clubes } = estado;
  if (!jogos || !classificacao?.length) return null;

  const escolhidos = clubesNaFaixa(classificacao, faixa);
  const naTabela = (equipe) => classificacao.find((c) => c.equipe === equipe);
  const posicaoDe = (equipe) => naTabela(equipe)?.pos;

  const colunas = escolhidos.map((clube) => {
    const agenda = campanhaCompleta(jogos, clube.equipe);
    return { clube, agenda, proximos: proximosJogos(agenda) };
  });
  const quantos = tamanhoDaLista(colunas.map((c) => c.agenda),
                                 { teto: TETO_DE_JOGOS });

  const spec = {
    titulo: `Próximos jogos do ${ordinal(faixa.melhor)} ao `
          + `${ordinal(faixa.pior)} na Série ${serie} ${edicao.ano}`,
    subtitulo: "",
    arquivo: `proximos-${serie}-${faixa.melhor}a${faixa.pior}`,
    numeros: [],
    nota: "",
    corpo: async (ctx, y) => {
      if (!colunas.length) {
        semClubes(ctx, { y, faixa });
        return;
      }
      spec.hover = await colunasDosClubes(ctx, {
        colunas, quantos, posicaoDe, naTabela, clubes, y: y + 12,
      });
    },
  };
  return spec;
}

function semClubes(ctx, { y, faixa }) {
  texto(ctx, "Nenhum clube nesta faixa.", MARGEM, y + 70,
        { tamanho: 26, peso: 700, cor: COR.azul, familia: "Bree Serif" });
  texto(ctx, `A tabela não tem ninguém entre o ${ordinal(faixa.melhor)} e o `
           + `${ordinal(faixa.pior)} lugar.`,
        MARGEM, y + 108, { tamanho: 16, cor: COR.cinzaTexto });
}

/* ------------------------------------------------------------- colunas */
async function colunasDosClubes(ctx, { colunas, quantos, posicaoDe, naTabela,
                                      clubes, y }) {
  const largura =
    (CARD.largura - MARGEM * 2 - VAO * (colunas.length - 1)) / colunas.length;
  const xDaColuna = (i) => MARGEM + i * (largura + VAO);

  const alturaTopo = 104;
  const alturaRodape = 60;
  const disponivel = CARD.altura - 96 - y - alturaTopo - alturaRodape - 16;
  // A lista ocupa a altura que sobrou: com dez jogos pela frente as linhas
  // ficam justas, com três elas crescem e o card não termina no meio.
  const alturaJogo = quantos
    ? Math.min(48, Math.max(20, disponivel / quantos)) : 0;
  const alvos = [];

  for (const [i, coluna] of colunas.entries()) {
    const x = xDaColuna(i);
    await cabecalhoDoClube(ctx, { coluna, clubes, x, largura, y });

    const yLista = y + alturaTopo;
    for (let k = 0; k < quantos; k++) {
      const passo = coluna.proximos[k];
      const yJogo = yLista + k * alturaJogo;
      caixa(ctx, x, yJogo, largura, alturaJogo - 2,
            k % 2 ? COR.fundo : COR.branco, 4);
      if (!passo) continue;

      await linhaDeJogo(ctx, {
        passo, posicao: posicaoDe(passo.jogo.adversario), clubes,
        x, largura, y: yJogo, altura: alturaJogo - 2,
      });

      alvos.push({
        n: `${nomeBonito(coluna.clube.equipe)} · jogo ${passo.n}`,
        x, y: yJogo, l: largura, a: alturaJogo - 2,
        ...dicaDoJogo(passo, naTabela(passo.jogo.adversario)),
      });
    }

    rodapeDaColuna(ctx, {
      media: mediaDosAdversarios(coluna.proximos, posicaoDe),
      restantes: coluna.proximos.length,
      x, largura, y: yLista + quantos * alturaJogo + 14,
    });
  }

  return {
    pontos: alvos, eixo: "caixa", unidade: "",
    topo: y, alturaPlot: CARD.altura - 96 - y,
    x0: MARGEM, x1: CARD.largura - MARGEM, largura: largura / 2,
  };
}

async function cabecalhoDoClube(ctx, { coluna, clubes, x, largura, y }) {
  const { clube } = coluna;
  const centro = x + largura / 2;

  caixa(ctx, x, y, largura, 96, COR.branco, 8);
  ctx.save();
  ctx.strokeStyle = COR.linha;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + .5, y + .5, largura - 1, 95, 8);
  ctx.stroke();
  ctx.restore();

  caixa(ctx, x, y, largura, 20, COR.azul, 8);
  caixa(ctx, x, y + 12, largura, 8, COR.azul, 0);
  texto(ctx, ordinal(clube.pos), centro, y + 15,
        { tamanho: 11.5, peso: 800, alinha: "center", cor: COR.branco,
          maiuscula: true, espaco: .6 });

  const escudo = await imagem(clubes[clube.equipe]?.escudo);
  desenharEscudo(ctx, escudo, centro - 15, y + 26, 30);

  const sigla = clubes[clube.equipe]?.sigla
    ?? nomeBonito(clube.equipe).slice(0, 3).toUpperCase();
  texto(ctx, cortar(ctx, sigla, largura - 12, 17, 800), centro, y + 76,
        { tamanho: 17, peso: 800, alinha: "center", cor: COR.azulEscuro });
  texto(ctx, `${clube.pts} pts`, centro, y + 91,
        { tamanho: 11, peso: 700, alinha: "center", cor: COR.cinzaEscuro });
}

async function linhaDeJogo(ctx, { passo, posicao, clubes, x, largura, y, altura }) {
  const meio = y + altura / 2;
  const emCasa = passo.jogo.mando === "casa";

  // A pílula de mando fica na mesma largura nos dois casos: casa e fora
  // alternam linha a linha, e larguras diferentes fariam a coluna serrilhar.
  const larguraPilula = 34;
  caixa(ctx, x + 6, meio - 7, larguraPilula, 14,
        emCasa ? COR.azulLavado : COR.cinzaClaro, 4);
  texto(ctx, emCasa ? "casa" : "fora", x + 6 + larguraPilula / 2, meio + 4,
        { tamanho: 9, peso: 800, alinha: "center", maiuscula: true, espaco: .4,
          cor: emCasa ? COR.azul : COR.cinzaEscuro });

  const lado = Math.min(20, altura - 6);
  const escudo = await imagem(clubes[passo.jogo.adversario]?.escudo);
  desenharEscudo(ctx, escudo, x + 46, meio - lado / 2, lado);

  const sigla = clubes[passo.jogo.adversario]?.sigla
    ?? nomeBonito(passo.jogo.adversario).slice(0, 3).toUpperCase();
  texto(ctx, sigla, x + 72, meio + 4,
        { tamanho: 12.5, peso: 700, cor: COR.azulEscuro });

  if (typeof posicao !== "number") return;
  const larguraBadge = 26;
  caixa(ctx, x + largura - 6 - larguraBadge, meio - 8, larguraBadge, 16,
        corDaPosicao(posicao), 4);
  texto(ctx, posicao, x + largura - 6 - larguraBadge / 2, meio + 4,
        { tamanho: 11, peso: 800, alinha: "center", cor: COR.branco });
}

function rodapeDaColuna(ctx, { media, restantes, x, largura, y }) {
  texto(ctx, "posição média dos adversários", x + largura / 2, y + 10,
        { tamanho: 8.5, peso: 700, alinha: "center", maiuscula: true,
          espaco: .6, cor: COR.cinzaEscuro });

  if (media === null) {
    texto(ctx, "sem jogos", x + largura / 2, y + 36,
          { tamanho: 15, peso: 700, alinha: "center", cor: COR.cinza });
    return;
  }
  caixa(ctx, x, y + 16, largura, 30, corDaPosicao(media), 6);
  texto(ctx, num(media), x + largura / 2, y + 37,
        { tamanho: 17, peso: 800, alinha: "center", cor: COR.branco });
  texto(ctx, `em ${restantes} ${restantes === 1 ? "jogo" : "jogos"}`,
        x + largura / 2, y + 60,
        { tamanho: 10, alinha: "center", cor: COR.cinzaEscuro });
}

const dataBr = (iso) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

function dicaDoJogo(passo, adversario) {
  const emCasa = passo.jogo.mando === "casa";
  const posicao = adversario?.pos;
  return {
    itens: [{
      rotulo: nomeBonito(passo.jogo.adversario),
      cor: typeof posicao === "number" ? corDaPosicao(posicao) : COR.cinzaEscuro,
      // Os pontos do adversário, e não os do dono da coluna: a dica é sobre o
      // jogo que vem, e quem interessa ali é quem vai estar do outro lado.
      pontos: adversario?.pts ?? null,
      detalhe: `${emCasa ? "em casa" : "fora"} · ${dataBr(passo.jogo.data)}`,
    }],
    diferenca: typeof posicao !== "number" ? null : {
      rotulo: ordinal(posicao),
      texto: `${adversario.j} jogos · posição de hoje`,
      cor: corDaPosicao(posicao),
    },
  };
}
