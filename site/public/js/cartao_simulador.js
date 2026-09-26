/**
 * Card: a reta final jogo a jogo, do jeito que você quiser.
 *
 * À esquerda a tabela de hoje, à direita a tabela que sai dos palpites, e no
 * meio o que separa uma da outra: as etiquetas dos jogos que faltam, na ordem
 * em que vêm, com o mando e o escudo do adversário. Cada etiqueta é um
 * resultado do dono da linha — venceu, empatou, perdeu — e a cor diz qual.
 *
 * O mesmo jogo aparece em duas linhas, e o palpite é do jogo: dizer que um
 * venceu é dizer que o outro perdeu, e as duas etiquetas viram juntas. É o que
 * impede a simulação de somar pontos que não existem.
 *
 * O placar é sempre 1 a 0, ou 0 a 0 no empate. O simulador decide pontos, não
 * gols, e placar inventado mexeria no saldo, que é critério de desempate.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import {
  DERROTA, EMPATOU, VITORIA, contarPalpites, desfechoDaLinha, pendentesDoClube,
} from "/js/simulador.js";

const LARGURA_HOJE = 116;
const LARGURA_SIMULADA = 152;
const VAO = 20;
// A etiqueta cresce até ocupar a faixa: com dez jogos pela frente sobra
// largura, e largura sobrando vira sigla do adversário ao lado do escudo —
// escudo de 19 pixels no Twitter é adivinhação.
const TAG = { maxima: 96, minima: 30, altura: 26, vao: 5, comSigla: 74 };

const ordinal = (n) => `${n}º`;
const comSinal = (v) => (v > 0 ? `+${v}` : `−${-v}`);

const corDoDesfecho = (desfecho) =>
  (desfecho === VITORIA ? COR.positivo
   : desfecho === EMPATOU ? COR.cinzaEscuro
   : desfecho === DERROTA ? COR.negativo : null);

const NOME_DO_DESFECHO = {
  [VITORIA]: "vitória", [EMPATOU]: "empate", [DERROTA]: "derrota",
};

export function montarCartao(estado) {
  const { serie, ano, clubes, hoje, simulada, pendentes, palpites, variacao,
          aoPalpitar } = estado;
  if (!hoje?.length || !simulada?.length) return null;

  const conta = contarPalpites(palpites, pendentes);
  const sigla = (equipe) => clubes?.[equipe]?.sigla
    ?? nomeBonito(equipe).slice(0, 3).toUpperCase();

  const spec = {
    titulo: `Simulação da reta final da Série ${serie} ${ano}`,
    subtitulo: conta.simulados
      ? `${conta.simulados} de ${conta.total} jogos que faltam já simulados`
      : `${conta.total} jogos por disputar · a tabela da direita ainda é a de hoje`,
    arquivo: `simulador-${serie}-${ano}`,
    numeros: [],
    nota: "O palpite vale 1 a 0 para quem vence, ou 0 a 0 no empate: o "
        + "simulador decide pontos, não placar.",
    corpo: async (ctx, y) => {
      const topo = y + 34;
      const base = CARD.altura - 84;
      const alturaLinha = (base - topo) / hoje.length;

      const xHoje = MARGEM;
      const xJogos = xHoje + LARGURA_HOJE + VAO;
      const xSimulada = CARD.largura - MARGEM - LARGURA_SIMULADA;
      const espacoJogos = xSimulada - VAO - xJogos;

      // A etiqueta encolhe até a fileira mais longa caber. Cortar a fileira
      // seria esconder justamente o jogo que decide a temporada.
      const maiorFileira = Math.max(1, ...hoje.map(
        (c) => pendentesDoClube(pendentes, c.equipe).length));
      const larguraTag = Math.max(TAG.minima, Math.min(
        TAG.maxima, espacoJogos / maiorFileira - TAG.vao));

      cabecalhos(ctx, { xHoje, xJogos, xSimulada, y: topo - 12 });
      legenda(ctx, { x: xJogos, y: base + 22 });

      const alvos = [];
      for (const [i, linha] of hoje.entries()) {
        const yl = topo + i * alturaLinha;
        const meio = yl + alturaLinha / 2;
        linhaH(ctx, MARGEM, CARD.largura - MARGEM, yl + alturaLinha, COR.linha);

        colunaDeHoje(ctx, { linha, sigla, x: xHoje, meio });
        colunaSimulada(ctx, {
          linha: simulada[i], variacao, sigla, x: xSimulada, meio,
        });

        const jogos = pendentesDoClube(pendentes, linha.equipe);
        for (const [k, jogo] of jogos.entries()) {
          const x = xJogos + k * (larguraTag + TAG.vao);
          const desfecho = desfechoDaLinha(palpites?.get(jogo.indice),
                                           jogo.emCasa);
          const escudo = await imagem(clubes?.[jogo.adversario]?.escudo);
          etiqueta(ctx, {
            x, y: meio - TAG.altura / 2, largura: larguraTag,
            emCasa: jogo.emCasa, desfecho, escudo,
            sigla: sigla(jogo.adversario),
          });

          alvos.push({
            indice: jogo.indice, emCasa: jogo.emCasa,
            x, y: meio - TAG.altura / 2, l: larguraTag, a: TAG.altura,
            ...dicaDoJogo(jogo, linha.equipe, desfecho),
          });
        }
      }

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: y, alturaPlot: base - y,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
        aoClicar: (alvo) => aoPalpitar?.(alvo),
      };
    },
  };
  return spec;
}

/* ------------------------------------------------------------- cabeçalhos */
function cabecalhos(ctx, { xHoje, xJogos, xSimulada, y }) {
  const rotulo = (t, x) =>
    texto(ctx, t, x, y, { tamanho: 9.5, peso: 700, maiuscula: true,
                          espaco: .8, cor: COR.cinzaEscuro });
  rotulo("hoje", xHoje);
  rotulo("os jogos que faltam →", xJogos);
  rotulo("simulada", xSimulada);
}

/**
 * A legenda das cores.
 *
 * Fica no rodapé do gráfico porque é do card, e não da tela: quem abre a
 * imagem no Twitter precisa saber o que é azul e o que é vermelho sem ter a
 * página do lado.
 */
function legenda(ctx, { x, y }) {
  let cursor = x;
  for (const desfecho of [VITORIA, EMPATOU, DERROTA]) {
    caixa(ctx, cursor, y - 10, 13, 13, corDoDesfecho(desfecho), 3);
    const nome = NOME_DO_DESFECHO[desfecho];
    texto(ctx, nome, cursor + 19, y,
          { tamanho: 10.5, peso: 700, cor: COR.cinzaEscuro });
    cursor += 19 + nome.length * 6.2 + 20;
  }
  texto(ctx, "C de casa, F de fora · sem cor, jogo ainda sem palpite",
        cursor + 8, y, { tamanho: 10.5, cor: COR.cinzaEscuro });
}

/* ---------------------------------------------------------------- colunas */
function colunaDeHoje(ctx, { linha, sigla, x, meio }) {
  texto(ctx, ordinal(linha.pos), x + 22, meio + 4,
        { tamanho: 12, peso: 700, alinha: "right", cor: COR.cinzaEscuro });
  texto(ctx, sigla(linha.equipe), x + 32, meio + 4,
        { tamanho: 12.5, peso: 700, cor: COR.cinzaTexto });
  texto(ctx, linha.pts, x + LARGURA_HOJE - 10, meio + 4,
        { tamanho: 13.5, peso: 800, alinha: "right", cor: COR.azulEscuro });
}

/**
 * A tabela simulada, com a variação ao lado.
 *
 * A variação é a razão de a coluna existir: a posição sozinha obrigaria a
 * procurar o mesmo clube na tabela da esquerda para saber se ele subiu.
 */
function colunaSimulada(ctx, { linha, variacao, sigla, x, meio }) {
  texto(ctx, ordinal(linha.pos), x + 22, meio + 4,
        { tamanho: 12.5, peso: 800, alinha: "right", cor: COR.azul });
  texto(ctx, sigla(linha.equipe), x + 32, meio + 4,
        { tamanho: 12.5, peso: 700, cor: COR.azulEscuro });
  texto(ctx, linha.pts, x + 116, meio + 4,
        { tamanho: 13.5, peso: 800, alinha: "right", cor: COR.azulEscuro });

  // Quem não se mexeu não ganha marca nenhuma: a coluna existe para o olho
  // achar o que mudou, e uma fileira de "=" esconderia os dois que mudaram.
  const delta = variacao?.get(linha.equipe)?.delta ?? 0;
  if (!delta) return;
  texto(ctx, comSinal(delta), x + LARGURA_SIMULADA, meio + 4,
        { tamanho: 12, peso: 800, alinha: "right",
          cor: delta > 0 ? COR.positivo : COR.negativo });
}

/* -------------------------------------------------------------- etiqueta */
/**
 * Uma etiqueta de jogo: o mando e o escudo do adversário.
 *
 * Sem palpite ela fica vazada, com o contorno só — é o estado em que a maior
 * parte delas passa a vida, e um preenchimento cinza ali pesaria a fileira
 * inteira sem dizer nada.
 */
function etiqueta(ctx, { x, y, largura, emCasa, desfecho, escudo, sigla }) {
  const cor = corDoDesfecho(desfecho);
  if (cor) {
    caixa(ctx, x, y, largura, TAG.altura, cor, 5);
  } else {
    caixa(ctx, x, y, largura, TAG.altura, COR.branco, 5);
    ctx.save();
    ctx.strokeStyle = COR.linha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + .5, y + .5, largura - 1, TAG.altura - 1, 5);
    ctx.stroke();
    ctx.restore();
  }

  const tinta = cor ? COR.branco : COR.cinzaEscuro;
  const meio = y + TAG.altura / 2;
  texto(ctx, emCasa ? "C" : "F", x + 11, meio + 4,
        { tamanho: 11.5, peso: 800, alinha: "center", cor: tinta });

  const lado = TAG.altura - 6;
  desenharEscudo(ctx, escudo, x + 21, meio - lado / 2, lado);

  if (largura >= TAG.comSigla) {
    texto(ctx, sigla, x + 26 + lado, meio + 4,
          { tamanho: 11.5, peso: 700, cor: tinta });
  }
}

/* ------------------------------------------------------------------ dica */
function dicaDoJogo(jogo, equipe, desfecho) {
  return {
    n: `${jogo.rodada}ª rodada`,
    itens: [
      { rotulo: nomeBonito(jogo.mandante), cor: COR.azul, pontos: null,
        texto: "mandante", detalhe: "" },
      { rotulo: nomeBonito(jogo.visitante), cor: COR.cinzaEscuro, pontos: null,
        texto: "visitante", detalhe: "" },
    ],
    diferenca: {
      rotulo: desfecho ? NOME_DO_DESFECHO[desfecho] : "sem palpite",
      texto: desfecho
        ? `simulada ${jogo.emCasa ? "em casa" : "fora"} para ${nomeBonito(equipe)}`
        : `${jogo.emCasa ? "em casa" : "fora"} contra `
          + `${nomeBonito(jogo.adversario)}`,
      cor: corDoDesfecho(desfecho) ?? COR.cinzaEscuro,
    },
  };
}
