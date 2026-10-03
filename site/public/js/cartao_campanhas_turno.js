/**
 * Card: o ranking dos turnos, meia campanha de cada vez.
 *
 * É o histórico de campanhas com a unidade partida ao meio: o mesmo clube na
 * mesma edição vira duas linhas, e elas disputam o ranking entre si como
 * quaisquer outras. É o que permite perguntar se o melhor primeiro turno da
 * história foi melhor que o melhor segundo — comparação que a campanha
 * inteira esconde, porque ali os dois já vêm somados.
 *
 * No lugar da posição final entra a tag do turno: azul o primeiro, vermelho o
 * segundo. É o par da identidade, e não um juízo — nenhum dos dois turnos é o
 * lado bom da história.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeComUf } from "/js/nomes.js";
import { POR_PAGINA, pagina, paginas } from "/js/campanhas_historicas.js";

const COLUNAS = 4;
const LINHAS = POR_PAGINA / COLUNAS;
const VAO = 16;
const ALTURA_LINHA = 34;
const LARGURA_MAXIMA = 400;

const CAMPOS = { posicao: 34, ano: 36, escudo: 22, turno: 30, pontos: 34 };

const corDoTurno = () => ({ 1: COR.azul, 2: COR.vermelho });

export function montarCartao(estado) {
  const { ranking, paginaAtual, clubes, titulo, destaque, aoDestacar } = estado;
  if (!ranking?.length) return null;

  const quantas = paginas(ranking.length);
  const atual = Math.min(Math.max(1, paginaAtual || 1), quantas);
  const linhas = pagina(ranking, atual);
  const primeira = linhas[0]?.posicao ?? 1;
  const ultima = linhas[linhas.length - 1]?.posicao ?? 1;

  const spec = {
    titulo,
    subtitulo: `${primeira}º ao ${ultima}º de ${ranking.length} turnos`
             + `${quantas > 1 ? ` · página ${atual} de ${quantas}` : ""}`,
    arquivo: `turnos-${primeira}-${ultima}`,
    numeros: [],
    nota: "",
    corpo: async (ctx, y) => {
      const topo = y + 34;
      const base = CARD.altura - 84;
      const usadas = Math.min(COLUNAS, Math.ceil(linhas.length / LINHAS));
      const disponivel = CARD.largura - MARGEM * 2 - VAO * (usadas - 1);
      const largura = Math.min(LARGURA_MAXIMA, disponivel / usadas);
      const x0 = (CARD.largura - (largura * usadas + VAO * (usadas - 1))) / 2;
      const porColuna = Math.ceil(linhas.length / usadas);
      const altura = Math.min(ALTURA_LINHA, (base - topo) / porColuna);

      const alvos = [];
      for (const [i, linha] of linhas.entries()) {
        const coluna = Math.floor(i / porColuna);
        const x = x0 + coluna * (largura + VAO);
        const yl = topo + (i % porColuna) * altura;

        if (i % porColuna === 0) cabecalho(ctx, { x, largura, y: topo - 14 });
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
  rotulo("turno", x + largura - CAMPOS.pontos - 8, "right");
  rotulo("pts", x + largura - 4, "right");
}

async function desenharLinha(ctx, { linha, clubes, x, largura, y, altura,
                                    aceso = false }) {
  const meio = y + altura / 2;
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
  texto(ctx, linha.ano, x + CAMPOS.posicao, meio + 4,
        { tamanho: 11.5, peso: 700,
          cor: aceso ? COR.azulEscuro : COR.cinzaTexto });

  const lado = Math.min(CAMPOS.escudo, altura - 4);
  const escudo = await imagem(clubes?.[linha.equipe]?.escudo);
  desenharEscudo(ctx, escudo, x + CAMPOS.posicao + CAMPOS.ano,
                 meio - lado / 2, lado);

  const inicio = x + CAMPOS.posicao + CAMPOS.ano + CAMPOS.escudo + 6;
  const xTag = x + largura - CAMPOS.pontos - 8 - CAMPOS.turno;
  texto(ctx, cortar(ctx, nomeComUf(linha.equipe), xTag - inicio - 8, 12, 700),
        inicio, meio + 4, { tamanho: 12, peso: 700, cor: COR.azulEscuro });

  // A tag do turno: azul o primeiro, vermelho o segundo. É o par da
  // identidade, e não um juízo — nenhum dos dois é o lado bom da história.
  const altoTag = Math.min(18, altura - 8);
  caixa(ctx, xTag, meio - altoTag / 2, CAMPOS.turno, altoTag,
        corDoTurno()[linha.turno], 4);
  texto(ctx, `${linha.turno}º`, xTag + CAMPOS.turno / 2, meio + 4,
        { tamanho: 11, peso: 800, alinha: "center", cor: COR.branco });

  texto(ctx, linha.pontos, x + largura - 4, meio + 4,
        { tamanho: 13, peso: 800, alinha: "right",
          cor: aceso ? COR.destaque : COR.azul });
}

function dicaDaLinha(linha) {
  return {
    n: `${linha.posicao}º do ranking`,
    itens: [
      { rotulo: nomeComUf(linha.equipe), cor: corDoTurno()[linha.turno],
        pontos: null, texto: `${linha.pontos} pts`,
        detalhe: `${linha.turno}º turno de ${linha.ano}, em ${linha.jogos} jogos` },
      { rotulo: "a edição toda", cor: COR.cinzaEscuro, pontos: null,
        texto: linha.pontosFinais === null ? "—" : `${linha.pontosFinais} pts`,
        detalhe: linha.posicaoFinal === null
          ? "edição em andamento" : `terminou em ${linha.posicaoFinal}º` },
    ],
    diferenca: null,
  };
}
