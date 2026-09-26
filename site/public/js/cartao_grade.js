/**
 * Card: quem esteve em cada posição, rodada a rodada.
 *
 * Uma linha por lugar da tabela, uma coluna por rodada, e o escudo de quem
 * dormiu ali. Lida na vertical, cada coluna é a classificação daquele dia;
 * lida na horizontal, cada linha conta a história de um lugar — o 1º que
 * trocou de dono seis vezes, o 17º que teve o mesmo ocupante o ano inteiro.
 *
 * O clube em destaque acende em todas as rodadas, e o que aparece é o caminho
 * dele pela tabela: onde subiu, onde travou, onde caiu. É o mesmo dado da
 * evolução de posição, mas com os vizinhos ao lado — dá para ver quem ele
 * ultrapassou.
 *
 * Escolhida uma faixa de posições, a lista da esquerda conta quantas rodadas
 * cada clube passou nela. Com um clube aceso, a coluna da esquerda ganha o
 * gráfico dele: uma barra por posição, encostada na própria linha da grade, com
 * quantas rodadas ele dormiu ali. Sem nada escolhido, a grade ocupa o card
 * inteiro — os painéis são perguntas a mais, e não o assunto.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, imagem, desenharEscudo, ligacaoEmS,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import {
  caminhoDoClube, faixaOrdenada, gradeDePosicoes, resumoDaFaixa,
  rodadasNasPosicoes, rodadasPorPosicao,
} from "/js/grade_posicoes.js";

const CALHA = 46;
const LARGURA_PAINEL = 210;
const LARGURA_CLUBE = 132;
const VAO_PAINEL = 22;

const ordinal = (n) => `${n}º`;

export function montarCartao(estado) {
  const { serie, edicao, clubes, destaque, faixa, semTapetao,
          aoEscolherClube, aoEscolherPosicao } = estado;
  if (!edicao) return null;

  const grade = gradeDePosicoes(edicao, { semTapetao });
  if (!grade.length) return null;

  const posicoes = grade[0].casas.length;
  const limites = faixaOrdenada(faixa);
  const ranking = rodadasNasPosicoes(grade, limites);

  const spec = {
    titulo: `Quem esteve em cada posição da Série ${serie} ${edicao.ano}, `
          + `rodada a rodada`,
    subtitulo: destaque
      ? `${nomeBonito(destaque)} em destaque`
      : "Uma coluna por rodada: cada uma é a classificação daquele dia",
    arquivo: `grade-${serie}-${edicao.ano}`,
    numeros: [],
    nota: "",
    corpo: async (ctx, y) => {
      const topo = y + 28;
      const base = CARD.altura - 84;
      // Os dois painéis são independentes: quem acende um clube e escolhe uma
      // faixa está fazendo duas perguntas, e as duas cabem lado a lado.
      const calhaEsquerda = (destaque ? LARGURA_CLUBE + VAO_PAINEL : 0)
                          + (limites ? LARGURA_PAINEL + VAO_PAINEL : 0);
      const x0 = MARGEM + calhaEsquerda + CALHA;
      const largura = (CARD.largura - MARGEM - x0) / grade.length;
      const alturaLinha = (base - topo) / posicoes;

      if (destaque) {
        painelDoClube(ctx, {
          linhas: rodadasPorPosicao(grade, destaque),
          x: MARGEM, largura: LARGURA_CLUBE, topo, alturaLinha,
        });
      }
      if (limites) {
        painelDaFaixa(ctx, {
          ranking, limites, clubes,
          x: MARGEM + (destaque ? LARGURA_CLUBE + VAO_PAINEL : 0),
          largura: LARGURA_PAINEL, y: topo - 28, base,
        });
      }

      cabecalhoDasRodadas(ctx, { grade, x0, largura, y: topo - 10 });

      const alvos = [];
      for (let posicao = 1; posicao <= posicoes; posicao++) {
        const yLinha = topo + (posicao - 1) * alturaLinha;
        const naFaixa = limites && posicao >= limites.de && posicao <= limites.ate;

        if (naFaixa) {
          caixa(ctx, x0 - CALHA + 6, yLinha, CARD.largura - MARGEM - x0 + CALHA - 6,
                alturaLinha - 2, COR.azulLavado, 4);
        }

        texto(ctx, ordinal(posicao), x0 - 12, yLinha + alturaLinha / 2 + 4,
              { tamanho: 11.5, peso: 800, alinha: "right",
                cor: naFaixa ? COR.azul : COR.cinzaEscuro });

        // A calha da posição é o alvo que escolhe a faixa: clicar no escudo
        // escolhe o clube, clicar no número escolhe o lugar.
        alvos.push({
          posicao,
          x: x0 - CALHA, y: yLinha, l: CALHA - 4, a: alturaLinha - 2,
          n: `${ordinal(posicao)} lugar`,
          itens: [],
          diferenca: {
            rotulo: naFaixa ? "na faixa" : "ver a faixa",
            texto: naFaixa ? "está na lista da esquerda"
                           : "quantas rodadas cada clube passou aqui",
            cor: COR.azul,
          },
        });
      }

      const caminho = destaque
        ? new Map(caminhoDoClube(grade, destaque)
            .map((p) => [p.rodada, p.posicao])) : null;
      const ladoDoEscudo = Math.min(largura - 8, alturaLinha - 7);

      for (const { rodada, casas } of grade) {
        const x = x0 + (rodada - 1) * largura;
        for (const casa of casas) {
          const yLinha = topo + (casa.posicao - 1) * alturaLinha;
          const meio = yLinha + alturaLinha / 2;
          const marcado = destaque && casa.equipe === destaque;

          if (marcado) {
            caixa(ctx, x + 1, yLinha, largura - 2, alturaLinha - 2,
                  COR.destaque, 4);
          }

          const lado = Math.min(largura - 8, alturaLinha - 7);
          const escudo = await imagem(clubes?.[casa.equipe]?.escudo);
          desenharEscudo(ctx, escudo, x + (largura - lado) / 2, meio - lado / 2,
                         lado);

          alvos.push({
            equipe: casa.equipe,
            x: x + 1, y: yLinha, l: largura - 2, a: alturaLinha - 2,
            ...dicaDaCasa(casa, rodada),
          });
        }
      }

      if (caminho) {
        fioDoCaminho(ctx, { caminho, grade, x0, largura, topo, alturaLinha,
                            lado: ladoDoEscudo });
      }

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: y, alturaPlot: base - y,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
        aoClicar: (alvo) => {
          if (alvo.equipe) aoEscolherClube?.(alvo.equipe);
          else if (alvo.posicao) aoEscolherPosicao?.(alvo.posicao);
        },
      };
    },
  };
  return spec;
}

/* ------------------------------------------------------------- cabeçalho */
function cabecalhoDasRodadas(ctx, { grade, x0, largura, y }) {
  for (const { rodada } of grade) {
    if (rodada !== 1 && rodada !== grade.length && rodada % 2 === 0) continue;
    texto(ctx, rodada, x0 + (rodada - 0.5) * largura, y,
          { tamanho: 10, alinha: "center", cor: COR.cinzaEscuro });
  }
}

/**
 * O fio que liga as casas do clube em destaque.
 *
 * O escudo aceso já diz onde ele estava; o fio diz o movimento entre uma
 * rodada e outra, que é o que a grade sozinha obriga a montar de cabeça.
 *
 * Ele sai do meio da lateral de um quadro e entra no meio da lateral do
 * seguinte, em degrau de canto reto no vão entre as duas casas — e assim
 * nunca passa por cima de escudo nenhum, nem do dele.
 */
function fioDoCaminho(ctx, { caminho, grade, x0, largura, topo, alturaLinha,
                             lado }) {
  const pontos = grade
    .map(({ rodada }) => ({ rodada, posicao: caminho.get(rodada) }))
    .filter((p) => p.posicao);
  if (pontos.length < 2) return;

  const centroX = (rodada) => x0 + (rodada - 0.5) * largura;
  const centroY = (posicao) =>
    topo + (posicao - 1) * alturaLinha + alturaLinha / 2;
  const folga = lado / 2 + 3;

  for (let i = 1; i < pontos.length; i++) {
    const antes = pontos[i - 1], agora = pontos[i];
    ligacaoEmS(ctx, {
      x0: centroX(antes.rodada) + folga, y0: centroY(antes.posicao),
      x1: centroX(agora.rodada) - folga, y1: centroY(agora.posicao),
      cor: COR.destaque, espessura: 1.5, tracejado: [3, 3],
    });
  }
}

/* -------------------------------------------------------- painel do clube */
/**
 * Quantas rodadas o clube passou em cada posição.
 *
 * Encostado na grade e alinhado linha a linha: a barra da 4ª está na altura da
 * 4ª, e a leitura é de lado, sem procurar rótulo. O que aparece é a forma da
 * temporada — a barra longa é o lugar onde ele morou, as curtas são passagem.
 */
function painelDoClube(ctx, { linhas, x, largura, topo, alturaLinha }) {
  texto(ctx, "rodadas por posição", x, topo - 10,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });

  const maior = Math.max(1, ...linhas.map((l) => l.rodadas));
  const espaco = largura - 22;

  for (const linha of linhas) {
    if (!linha.rodadas) continue;
    const meio = topo + (linha.posicao - 1) * alturaLinha + alturaLinha / 2;
    const altura = Math.min(alturaLinha - 6, 18);

    // A barra é a cor do destaque diluída: é do clube aceso que ela fala, e um
    // cinza qualquer ali não se ligaria aos quadros da grade.
    const comprimento = (linha.rodadas / maior) * espaco;
    ctx.save();
    ctx.globalAlpha = .28;
    caixa(ctx, x, meio - altura / 2, comprimento, altura, COR.destaque, 3);
    ctx.restore();
    texto(ctx, linha.rodadas, x + comprimento + 7, meio + 4,
          { tamanho: 11.5, peso: 800, cor: COR.destaque });
  }
}

/* ---------------------------------------------------------------- painel */
/**
 * A lista da faixa escolhida.
 *
 * Só sigla e número de rodadas: a pergunta é "quem ocupou este pedaço da
 * tabela e por quanto tempo", e nome inteiro nessa largura viraria reticência.
 */
function painelDaFaixa(ctx, { ranking, limites, clubes, x, largura, y, base }) {
  const mesma = limites.de === limites.ate;
  const resumo = resumoDaFaixa(ranking);

  texto(ctx, "rodadas em cada posição", x, y + 12,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });
  // Em duas linhas escritas à mão: o canvas não quebra texto sozinho, e a
  // frase inteira numa linha só sairia pela borda do painel.
  const explicacao = ["Quantas rodadas cada clube",
                      mesma ? `terminou em ${ordinal(limites.de)}`
                            : `terminou entre o ${ordinal(limites.de)} e o `
                              + `${ordinal(limites.ate)}`];
  explicacao.forEach((linha, i) => {
    texto(ctx, linha, x, y + 34 + i * 17,
          { tamanho: 11.5, peso: 700, cor: COR.azulEscuro });
  });
  texto(ctx, `${resumo.clubes} ${resumo.clubes === 1 ? "clube" : "clubes"} `
           + `${resumo.clubes === 1 ? "passou" : "passaram"} por aqui`,
        x, y + 74, { tamanho: 11, cor: COR.cinzaEscuro });
  linhaH(ctx, x, x + largura, y + 84, COR.linha);

  const topo = y + 96;
  const altura = Math.min(26, (base - topo) / Math.max(ranking.length, 1));
  const maior = Math.max(1, ...ranking.map((l) => l.rodadas));

  for (const [i, linha] of ranking.entries()) {
    const yl = topo + i * altura;
    if (yl + altura > base) break;
    const meio = yl + altura / 2;

    // A barra é o mesmo número da direita, na forma em que a lista se lê de
    // uma olhada: quem dominou a faixa e quem só passou por ela.
    caixa(ctx, x, meio - 9, (linha.rodadas / maior) * largura, 18,
          COR.azulLavado, 3);

    const sigla = clubes?.[linha.equipe]?.sigla
      ?? nomeBonito(linha.equipe).slice(0, 3).toUpperCase();
    texto(ctx, sigla, x + 8, meio + 4,
          { tamanho: 12, peso: 700, cor: COR.azulEscuro });
    texto(ctx, linha.rodadas, x + largura - 8, meio + 4,
          { tamanho: 12.5, peso: 800, alinha: "right", cor: COR.azul });
  }
}

/* ------------------------------------------------------------------ dica */
function dicaDaCasa(casa, rodada) {
  return {
    n: `${rodada}ª rodada · ${ordinal(casa.posicao)}`,
    itens: [{
      rotulo: nomeBonito(casa.equipe), cor: COR.marca,
      pontos: casa.pontos, detalhe: `na ${rodada}ª rodada`,
    }],
    diferenca: null,
  };
}
