/**
 * Card: o ranking histórico de campanhas.
 *
 * Uma campanha é um clube numa edição, e desde 2006 são oitocentas e poucas por
 * série. Nenhum card cabe isso, e nem deveria: o que se publica é uma página do
 * ranking — as cem primeiras, as cem seguintes —, e é a tela que vira a página.
 *
 * Quatro colunas, e não uma lista comprida. Uma coluna de vinte e seis linhas
 * usa a altura inteira do card e sobra largura para as outras três; uma lista
 * única de vinte e seis nomes deixaria três quartos do card vazios.
 *
 * O título diz o recorte por extenso, porque é ele que dá sentido ao número:
 * "melhores campanhas" e "melhores campanhas nos 10 primeiros jogos fora de
 * casa" são rankings diferentes, e o card publicado precisa dizer qual é.
 *
 * Um clube aceso pinta todas as campanhas dele, e não tira nenhuma das outras.
 * É a leitura que o ranking sozinho não dá: onde o mesmo clube aparece de novo
 * — e a que distância —, com o resto da lista ali para dar a medida. Filtrar
 * responderia outra pergunta, e para isso existe o filtro de equipe, fora.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeComUf } from "/js/nomes.js";
import { POR_PAGINA, pagina, paginas } from "/js/campanhas_historicas.js";

const COLUNAS = 4;
const LINHAS = POR_PAGINA / COLUNAS;
const VAO = 16;
const ALTURA_LINHA = 24;

// A largura de cada campo dentro da coluna, da esquerda para a direita.
const CAMPOS = { posicao: 34, ano: 36, escudo: 22, equipe: 178, fim: 28, pontos: 34 };

const ordinal = (n) => `${n}º`;

export function montarCartao(estado) {
  const { ranking, paginaAtual, clubes, titulo, nota, destaque,
          aoDestacar } = estado;
  if (!ranking?.length) return null;

  const quantas = paginas(ranking.length);
  const atual = Math.min(Math.max(1, paginaAtual || 1), quantas);
  const linhas = pagina(ranking, atual);
  const primeira = linhas[0]?.posicao ?? 1;
  const ultima = linhas[linhas.length - 1]?.posicao ?? 1;

  const spec = {
    titulo,
    // Onde esta página cai dentro do ranking. Vai no subtítulo porque é
    // legenda do título — dentro do corpo ela brigaria com o cabeçalho da
    // última coluna, que encosta na borda direita do card.
    subtitulo: `${primeira}º ao ${ultima}º de ${ranking.length} campanhas`
             + `${quantas > 1 ? ` · página ${atual} de ${quantas}` : ""}`,
    arquivo: `campanhas-${primeira}-${ultima}`,
    numeros: [],
    nota,
    corpo: async (ctx, y) => {
      const topo = y + 34;
      const base = CARD.altura - 84;
      const largura = (CARD.largura - MARGEM * 2 - VAO * (COLUNAS - 1)) / COLUNAS;
      const altura = Math.min(ALTURA_LINHA, (base - topo) / LINHAS);

      const alvos = [];
      for (const [i, linha] of linhas.entries()) {
        const coluna = Math.floor(i / LINHAS);
        const x = MARGEM + coluna * (largura + VAO);
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

function cabecalho(ctx, { x, largura, y }) {
  const rotulo = (t, xr, alinha = "left") =>
    texto(ctx, t, xr, y, { tamanho: 9, peso: 700, maiuscula: true, espaco: .7,
                           alinha, cor: COR.cinzaEscuro });

  rotulo("#", x + 4);
  rotulo("ano", x + CAMPOS.posicao);
  rotulo("equipe", x + CAMPOS.posicao + CAMPOS.ano + CAMPOS.escudo + 6);
  rotulo("fim", x + largura - CAMPOS.pontos - 6, "right");
  rotulo("pts", x + largura - 4, "right");
}

/**
 * Uma campanha na linha.
 *
 * A posição do ranking à esquerda e a pontuação à direita, com o nome do clube
 * no meio: são os dois números que se comparam de linha a linha, e o nome é o
 * que se lê depois de achar a linha.
 */
async function desenharLinha(ctx, { linha, clubes, x, largura, y, altura,
                                    aceso = false }) {
  const meio = y + altura / 2;
  linhaH(ctx, x, x + largura, y + altura, COR.linha);

  // A linha acesa ganha fundo, e não cor de texto: são quatro colunas de
  // vinte e seis linhas, e o que se procura é a mancha, não a palavra.
  if (aceso) {
    ctx.save();
    ctx.globalAlpha = .17;
    caixa(ctx, x, y + 1, largura, altura - 3, COR.destaque, 4);
    ctx.restore();
  }

  let cursor = x + 4;
  texto(ctx, linha.posicao, cursor, meio + 4,
        { tamanho: 11.5, peso: aceso ? 800 : 700,
          cor: aceso ? COR.destaque : COR.cinzaEscuro });
  cursor = x + CAMPOS.posicao;

  texto(ctx, linha.ano, cursor, meio + 4,
        { tamanho: 11.5, peso: 700,
          cor: aceso ? COR.azulEscuro : COR.cinzaTexto });
  cursor += CAMPOS.ano;

  const lado = Math.min(CAMPOS.escudo, altura - 4);
  const escudo = await imagem(clubes?.[linha.equipe]?.escudo);
  desenharEscudo(ctx, escudo, cursor, meio - lado / 2, lado);
  cursor += CAMPOS.escudo + 6;

  const espaco = largura - (cursor - x) - CAMPOS.fim - CAMPOS.pontos - 8;
  texto(ctx, cortar(ctx, nomeComUf(linha.equipe), espaco, 12, 700),
        cursor, meio + 4, { tamanho: 12, peso: 700, cor: COR.azulEscuro });

  // Onde a campanha terminou. Traço na edição em andamento: ela não terminou
  // em lugar nenhum ainda, e um zero ali seria mentira.
  texto(ctx, linha.posicaoFinal === null ? "—" : ordinal(linha.posicaoFinal),
        x + largura - CAMPOS.pontos - 6, meio + 4,
        { tamanho: 11, peso: 700, alinha: "right", cor: COR.cinzaEscuro });

  texto(ctx, linha.pontos, x + largura - 4, meio + 4,
        { tamanho: 13, peso: 800, alinha: "right",
          cor: aceso ? COR.destaque : COR.azul });
}

function dicaDaLinha(linha) {
  return {
    n: `${ordinal(linha.posicao)} do ranking`,
    itens: [
      { rotulo: nomeComUf(linha.equipe), cor: COR.azul, pontos: null,
        texto: `${linha.pontos} pts`, detalhe: `em ${linha.jogos} jogos` },
      { rotulo: `Série ${linha.ano}`, cor: COR.cinzaEscuro, pontos: null,
        texto: linha.posicaoFinal === null ? "—" : ordinal(linha.posicaoFinal),
        detalhe: linha.encerrada ? "posição final" : "edição em andamento" },
    ],
    diferenca: linha.descontados
      ? { rotulo: `${linha.descontados} no tapetão`,
          texto: "já descontados destes pontos", cor: COR.negativo }
      : null,
  };
}
