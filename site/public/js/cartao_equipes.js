/**
 * Card: o ranking de clubes, somado por cima das edições.
 *
 * O ranking de campanhas trata cada ano como uma linha; aqui o ano some e o
 * que sobra é quanto cada clube fez ao todo no trecho escolhido. A mesma lista
 * de jogos, somada por outra chave.
 *
 * Ao lado dos pontos vão as edições, os jogos e o aproveitamento, e não por
 * capricho: sem eles o número engana. Um clube de vinte e uma participações
 * soma mais do que um de quatro sem ter sido melhor em nada, e é o
 * aproveitamento que põe os dois na mesma régua. Deixar só a soma seria
 * publicar uma tabela de quem jogou mais.
 *
 * Três colunas em vez de quatro: a linha aqui tem quatro números, e não dois.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeComUf } from "/js/nomes.js";
import { POR_PAGINA_EQUIPES, pagina, paginas } from "/js/campanhas_historicas.js";

const COLUNAS = 3;
const LINHAS = POR_PAGINA_EQUIPES / COLUNAS;
const VAO = 18;
const ALTURA_LINHA = 34;

// Os números ficam à direita, encostados uns nos outros, porque é entre eles
// que o olho anda — o nome é só a etiqueta da linha.
const CAMPOS = { posicao: 32, escudo: 22, edicoes: 34, jogos: 44, pontos: 48,
                 aproveitamento: 52 };
const LARGURA_MAXIMA = 520;

const pct = (v) => `${Math.round(v * 100)}%`;

export function montarCartao(estado) {
  const { ranking, paginaAtual, clubes, titulo, nota, destaque,
          aoDestacar } = estado;
  if (!ranking?.length) return null;

  const quantas = paginas(ranking.length, POR_PAGINA_EQUIPES);
  const atual = Math.min(Math.max(1, paginaAtual || 1), quantas);
  const linhas = pagina(ranking, atual, POR_PAGINA_EQUIPES);

  const spec = {
    titulo,
    subtitulo: `${ranking.length} clubes`
             + `${quantas > 1 ? ` · página ${atual} de ${quantas}` : ""}`,
    arquivo: `equipes-${atual}`,
    numeros: [],
    nota,
    corpo: async (ctx, y) => {
      const topo = y + 34;
      const base = CARD.altura - 84;
      // Quantas colunas a página de fato precisa, e não quantas cabem: com
      // treze linhas no recorte, quatro colunas deixariam três quartos do card
      // em branco. A largura tem teto para o nome não descolar dos números, e
      // o bloco fica centrado no que sobra.
      const usadas = Math.min(COLUNAS, Math.ceil(linhas.length / LINHAS));
      const disponivel = CARD.largura - MARGEM * 2 - VAO * (usadas - 1);
      const largura = Math.min(LARGURA_MAXIMA, disponivel / usadas);
      const x0 = (CARD.largura - (largura * usadas + VAO * (usadas - 1))) / 2;
      // E a linha estica até a altura do card, pelo mesmo motivo: treze
      // campanhas com a altura de cem deixariam metade do card em branco. O
      // teto impede que três linhas virem três faixas.
      const emUso = Math.min(LINHAS, Math.ceil(linhas.length / usadas));
      const altura = Math.min(ALTURA_LINHA, (base - topo) / emUso);

      const alvos = [];
      for (const [i, linha] of linhas.entries()) {
        const coluna = Math.floor(i / LINHAS);
        const x = x0 + coluna * (largura + VAO);
        const yl = topo + (i % LINHAS) * altura;

        if (i % LINHAS === 0) cabecalho(ctx, { x, largura, y: topo - 14 });
        await desenharLinha(ctx, {
          linha, clubes, x, largura, y: yl, altura,
          aceso: Boolean(destaque) && linha.equipe === destaque,
        });
        alvos.push({ equipe: linha.equipe, x, y: yl, l: largura, a: altura,
                     ...dicaDaLinha(linha) });
      }

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: y, alturaPlot: base - y,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
        aoClicar: (alvo) => aoDestacar?.(alvo.equipe),
      };
    },
  };
  return spec;
}

/** As colunas de números, da direita para a esquerda. */
function xDosNumeros(x, largura) {
  const aproveitamento = x + largura - 4;
  const pontos = aproveitamento - CAMPOS.aproveitamento;
  const jogos = pontos - CAMPOS.pontos;
  const edicoes = jogos - CAMPOS.jogos;
  return { edicoes, jogos, pontos, aproveitamento };
}

function cabecalho(ctx, { x, largura, y }) {
  const rotulo = (t, xr, alinha = "left") =>
    texto(ctx, t, xr, y, { tamanho: 9, peso: 700, maiuscula: true, espaco: .7,
                           alinha, cor: COR.cinzaEscuro });
  const emX = xDosNumeros(x, largura);

  rotulo("#", x + 4);
  rotulo("equipe", x + CAMPOS.posicao + CAMPOS.escudo + 6);
  rotulo("ed", emX.edicoes, "right");
  rotulo("j", emX.jogos, "right");
  rotulo("pts", emX.pontos, "right");
  rotulo("apr", emX.aproveitamento, "right");
}

async function desenharLinha(ctx, { linha, clubes, x, largura, y, altura,
                                    aceso = false }) {
  const meio = y + altura / 2;
  const emX = xDosNumeros(x, largura);
  linhaH(ctx, x, x + largura, y + altura, COR.linha);

  if (aceso) {
    ctx.save();
    ctx.globalAlpha = .17;
    caixa(ctx, x, y + 1, largura, altura - 3, COR.destaque, 4);
    ctx.restore();
  }

  texto(ctx, linha.posicao, x + 4, meio + 4,
        { tamanho: 11.5, peso: aceso ? 800 : 700,
          cor: aceso ? COR.destaque : COR.cinzaEscuro });

  // O escudo fica dentro do campo reservado mesmo quando a linha estica:
  // crescer com ela o empurrava por cima do nome.
  const lado = Math.min(CAMPOS.escudo, altura - 4);
  const escudo = await imagem(clubes?.[linha.equipe]?.escudo);
  desenharEscudo(ctx, escudo, x + CAMPOS.posicao, meio - lado / 2, lado);

  const inicio = x + CAMPOS.posicao + CAMPOS.escudo + 6;
  texto(ctx, cortar(ctx, nomeComUf(linha.equipe),
                    emX.edicoes - CAMPOS.edicoes - inicio - 6, 12, 700),
        inicio, meio + 4, { tamanho: 12, peso: 700, cor: COR.azulEscuro });

  texto(ctx, linha.edicoes, emX.edicoes, meio + 4,
        { tamanho: 11, alinha: "right", cor: COR.cinzaEscuro });
  texto(ctx, linha.jogos, emX.jogos, meio + 4,
        { tamanho: 11, alinha: "right", cor: COR.cinzaTexto });
  texto(ctx, linha.pontos, emX.pontos, meio + 4,
        { tamanho: 13, peso: 800, alinha: "right",
          cor: aceso ? COR.destaque : COR.azul });
  texto(ctx, pct(linha.aproveitamento), emX.aproveitamento, meio + 4,
        { tamanho: 11.5, peso: 700, alinha: "right", cor: COR.cinzaTexto });
}

function dicaDaLinha(linha) {
  return {
    n: `${linha.posicao}º do ranking`,
    itens: [
      { rotulo: nomeComUf(linha.equipe), cor: COR.azul, pontos: null,
        texto: `${linha.pontos} pts`,
        detalhe: `em ${linha.jogos} jogos de ${linha.edicoes} `
               + `${linha.edicoes === 1 ? "edição" : "edições"}` },
      { rotulo: "aproveitamento", cor: COR.cinzaEscuro, pontos: null,
        texto: pct(linha.aproveitamento),
        detalhe: `${(linha.pontos / linha.jogos).toFixed(2).replace(".", ",")}`
               + " pontos por jogo" },
    ],
    diferenca: linha.melhorFim === null ? null : {
      rotulo: `${linha.melhorFim}º lugar`,
      texto: "o melhor desfecho dele no recorte",
      cor: COR.azulEscuro,
    },
  };
}
