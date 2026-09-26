/**
 * Card: a classificação com a memória cada vez mais curta.
 *
 * À direita, a tabela inteira — a que vale. À esquerda dela, a mesma tabela
 * contando só os dez últimos jogos de cada clube; ao lado, nove; e assim até a
 * coluna da ponta esquerda, em que só o jogo mais recente conta.
 *
 * Lida da direita para a esquerda, a tela mostra de onde o clube vem; da
 * esquerda para a direita, para onde ele está indo. Quem sobe muito ao andar
 * para a esquerda está em fase melhor do que a classificação ainda diz, e
 * quem despenca está vivendo de pontos que fez há dois meses.
 *
 * O número da posição ganha fundo quando a coluna discorda da tabela cheia:
 * azul em quem aparece mais acima do que termina, vermelho em quem aparece
 * mais abaixo. É o degradê que faz a fase de cada clube saltar aos olhos sem
 * precisar comparar vinte linhas de cabeça.
 *
 * O tapetão fica de fora dos recortes: punição de tribunal não é ponto de
 * jogo, e uma coluna de "últimos 3 jogos" com quatro pontos a menos seria uma
 * coluna que não conta o que aconteceu em campo. Na tabela cheia ela vale,
 * como em todo o BI.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, imagem, desenharEscudo, ligacaoEmS,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import { posicoesDoClube, resumoDoRecorte } from "/js/ultimos.js";

const VAO = 14;

const ordinal = (n) => `${n}º`;
const percentual = (v) =>
  (v === null ? "—" : `${Math.round(v * 100)}%`);
const comSinal = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : "0");

export function montarCartao(estado) {
  const { serie, edicao, colunas, clubes, destaque, aoEscolher } = estado;
  if (!edicao || !colunas?.length) return null;

  const atual = colunas.at(-1);
  const total = atual.tabela.length;
  const largura = (CARD.largura - MARGEM * 2 - VAO * (colunas.length - 1))
                / colunas.length;

  // A posição na tabela cheia é a régua de todas as outras colunas.
  const naTabela = new Map(atual.tabela.map((c) => [c.equipe, c.pos]));
  const maiorVariacao = Math.max(1, ...colunas.flatMap((coluna) =>
    coluna.tabela.map((c) => Math.abs((naTabela.get(c.equipe) ?? c.pos) - c.pos))));

  const spec = {
    titulo: `Classificação pelos últimos jogos na Série ${serie} ${edicao.ano}`,
    subtitulo: "Cada coluna é a mesma tabela contando só os jogos mais "
             + "recentes de cada equipe",
    arquivo: `ultimos-${serie}-${edicao.ano}`,
    numeros: [],
    // A nota divide a linha com a assinatura: cabe uma frase.
    nota: "Recorte cronológico e por equipe. O fundo do número da posição diz "
        + "quantos lugares a coluna move o clube em relação à tabela cheia.",
    corpo: async (ctx, y) => {
      const topo = y + 26;
      const base = CARD.altura - 84;
      const alturaCabecalho = 26;
      const alturaLinha = (base - topo - alturaCabecalho) / total;
      const xDaColuna = (i) => MARGEM + i * (largura + VAO);

      const alvos = [];
      for (const [i, coluna] of colunas.entries()) {
        alvos.push(...await desenharColuna(ctx, {
          coluna, naTabela, maiorVariacao, clubes, destaque,
          x: xDaColuna(i), largura, topo, alturaCabecalho, alturaLinha,
        }));
      }

      if (destaque) {
        costurar(ctx, {
          colunas, destaque, xDaColuna, largura, topo, alturaCabecalho,
          alturaLinha,
        });
      }

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: y, alturaPlot: base - y,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
        // Clicar acende o clube nas onze colunas: procurar a mesma sigla em
        // onze listas é o trabalho que a tela existe para poupar.
        aoClicar: aoEscolher ? (alvo) => aoEscolher(alvo.equipe) : undefined,
      };
    },
  };
  return spec;
}

/* -------------------------------------------------------------- colunas */
async function desenharColuna(ctx, o) {
  const { coluna, naTabela, maiorVariacao, clubes, destaque, x, largura, topo,
          alturaCabecalho, alturaLinha } = o;
  const inteira = coluna.n === null;
  const base = topo + alturaCabecalho + coluna.tabela.length * alturaLinha;

  // A coluna da tabela cheia é a referência, e ganha moldura: ela não é mais
  // um recorte entre outros, é aquilo com que os outros se comparam.
  if (inteira) {
    caixa(ctx, x - 4, topo - 4, largura + 8, base - topo + 10, COR.branco, 8);
    caixa(ctx, x - 4, topo - 4, largura + 8, alturaCabecalho + 2, COR.marca, 8);
  }

  texto(ctx, rotuloDaColuna(coluna.n), x + largura / 2, topo + 13,
        { tamanho: 10, peso: 700, alinha: "center", maiuscula: true,
          espaco: .6, cor: inteira ? COR.marcaTexto : COR.cinzaEscuro });
  if (!inteira) linhaH(ctx, x, x + largura, topo + alturaCabecalho - 4, COR.linha);

  const alvos = [];
  for (const [i, clube] of coluna.tabela.entries()) {
    const yLinha = topo + alturaCabecalho + i * alturaLinha;
    const meio = yLinha + alturaLinha / 2;
    const marcado = destaque && clube.equipe === destaque;
    const posicaoAtual = naTabela.get(clube.equipe) ?? null;
    const resumo = resumoDoRecorte(clube, posicaoAtual);

    if (marcado) {
      caixa(ctx, x - 2, yLinha + 1, largura + 4, alturaLinha - 2, COR.marca, 5);
    }

    // O fundo do número diz o quanto a coluna discorda da tabela cheia.
    const tom = inteira || marcado
      ? null : tomDaVariacao(resumo?.variacao ?? 0, maiorVariacao);
    if (tom) {
      caixa(ctx, x + 2, meio - 11, 24, 22, tom.fundo, 5);
    }
    texto(ctx, clube.pos, x + 14, meio + 4,
          { tamanho: 11.5, peso: 800, alinha: "center",
            cor: marcado ? COR.marcaTexto : tom ? tom.tinta : COR.cinzaEscuro });

    const lado = Math.min(20, alturaLinha - 6);
    const escudo = await imagem(clubes?.[clube.equipe]?.escudo);
    desenharEscudo(ctx, escudo, x + 30, meio - lado / 2, lado);

    const sigla = clubes?.[clube.equipe]?.sigla
      ?? nomeBonito(clube.equipe).slice(0, 3).toUpperCase();
    texto(ctx, sigla, x + 56, meio + 4,
          { tamanho: 11.5, peso: 700,
            cor: marcado ? COR.marcaTexto : COR.azulEscuro });

    texto(ctx, clube.pts, x + largura - 6, meio + 4,
          { tamanho: 12, peso: 800, alinha: "right",
            cor: marcado ? COR.marcaTexto : COR.cinzaTexto });

    alvos.push({
      equipe: clube.equipe,
      x: x - 2, y: yLinha + 1, l: largura + 4, a: alturaLinha - 2,
      ...dicaDaLinha(coluna, resumo),
    });
  }
  return alvos;
}

const rotuloDaColuna = (n) =>
  (n === null ? "tabela cheia" : n === 1 ? "último jogo" : `últimos ${n}`);

/**
 * O fundo do número da posição.
 *
 * Divergência zero não ganha cor: coluna que concorda com a tabela é o estado
 * normal, e pintá-la faria a grade inteira parecer informação.
 */
function tomDaVariacao(variacao, maior) {
  if (!variacao) return null;
  const t = Math.min(1, Math.abs(variacao) / maior);
  const escuro = variacao > 0 ? COR.positivo : COR.negativo;
  return {
    fundo: mistura(COR.fundo, escuro, 0.18 + t * 0.72),
    tinta: t > 0.45 ? COR.branco : COR.azulEscuro,
  };
}

function mistura(de, para, t) {
  const canal = (cor, i) => parseInt(cor.slice(1 + i * 2, 3 + i * 2), 16);
  const valor = (i) => Math.round(canal(de, i) + (canal(para, i) - canal(de, i)) * t);
  return `rgb(${valor(0)}, ${valor(1)}, ${valor(2)})`;
}

function dicaDaLinha(coluna, resumo) {
  if (!resumo) return { n: "", itens: [] };
  const onde = coluna.n === null ? "na edição inteira"
    : coluna.n === 1 ? "no último jogo" : `nos últimos ${coluna.n} jogos`;
  const variacao = resumo.variacao;
  return {
    n: `${nomeBonito(resumo.equipe)} · ${ordinal(resumo.pos)}`,
    itens: [
      { rotulo: `pontos ${onde}`, cor: COR.marca, pontos: resumo.pts,
        detalhe: `${resumo.j} ${resumo.j === 1 ? "jogo" : "jogos"} · `
               + `${percentual(resumo.aproveitamento)} de aproveitamento` },
    ],
    diferenca: coluna.n === null || variacao === null ? null : {
      rotulo: `${comSinal(variacao)} ${Math.abs(variacao) === 1 ? "posição" : "posições"}`,
      texto: "em relação à tabela cheia",
      cor: variacao > 0 ? COR.positivo
         : variacao < 0 ? COR.negativo : COR.cinzaEscuro,
    },
  };
}

/**
 * O fio que costura o clube em destaque de coluna em coluna.
 *
 * Em S de cantos retos: onze listas coladas não deixam espaço para diagonais,
 * que cruzariam nomes de outros clubes no caminho. O degrau acontece no vão
 * entre duas colunas, onde não há nada escrito.
 */
function costurar(ctx, o) {
  const { colunas, destaque, xDaColuna, largura, topo, alturaCabecalho,
          alturaLinha } = o;
  const posicoes = posicoesDoClube(colunas, destaque);
  const yDaPosicao = (pos) =>
    topo + alturaCabecalho + (pos - 1) * alturaLinha + alturaLinha / 2;

  for (let i = 0; i < colunas.length - 1; i++) {
    const daqui = posicoes[i], dali = posicoes[i + 1];
    if (daqui == null || dali == null) continue;
    ligacaoEmS(ctx, {
      x0: xDaColuna(i) + largura + 2, y0: yDaPosicao(daqui),
      x1: xDaColuna(i + 1) - 2, y1: yDaPosicao(dali),
    });
  }
}
