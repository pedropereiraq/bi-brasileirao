/**
 * Card: como a sobra de pontos anda pela tabela ao longo da edição.
 *
 * Nasce da tela de médias, virada de lado. Lá cada coluna é uma edição numa
 * rodada; aqui cada coluna é uma rodada da mesma edição, e cada linha é uma
 * posição. A cor de cada casa é a diferença entre o que aquela posição tinha
 * naquela rodada e o que ela costuma ter — azul acima do normal, vermelho
 * abaixo.
 *
 * O que essa grade mostra, e uma coluna sozinha não mostra, é o **movimento**.
 * Uma sobra de pontos que na décima rodada está no fim da tabela pode aparecer
 * no meio dela vinte rodadas depois: a mancha azul escorrega de uma faixa para
 * outra, e é isso que se quer ver.
 *
 * Embaixo, os pontos que não chegaram à tabela. Uma rodada de empates deixa
 * **toda** a grade abaixo do normal sem que ninguém tenha jogado mal — o
 * empate distribui dois em vez de três, e o ponto que sobra some. Um jogo
 * adiado não distribui nada até acontecer, e deixa uma região inteira
 * artificialmente baixa. Sem essa faixa ao pé da grade, as duas coisas
 * viravam "campeonato fraco".
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import { evolucaoDaDiferenca, POSICOES } from "/js/media_posicao.js";
import { aproveitamentoDaTabela, fluxoDePontos } from "/js/fluxo_de_pontos.js";

const RODADAS = 38;
const CALHA = 46;
const CALHA_DIR = 168;
const ALTURA_FLUXO = 104;

const ordinal = (n) => `${n}º`;
const num = (v) => (v === null ? "—" : v.toFixed(1).replace(".", ","));
const comSinal = (v) => (v > 0 ? `+${num(v)}` : v < 0 ? `−${num(-v)}` : "0");
const inteiroComSinal = (v) => {
  const inteiro = Math.round(v);
  return inteiro > 0 ? `+${inteiro}` : inteiro < 0 ? `−${-inteiro}` : "0";
};

export function montarCartao(estado) {
  const { serie, edicao, posicoes, partidas } = estado;
  if (!edicao || !posicoes) return null;

  const matriz = evolucaoDaDiferenca(posicoes, { serie, ano: edicao.ano });
  if (!matriz.length) return null;

  // A faixa acompanha a grade: rodada que ainda não começou reteria os três
  // pontos de cada jogo dela e esmagaria a escala das que já aconteceram.
  const fluxo = fluxoDePontos(partidas)
    .filter((linha) => linha.rodada <= matriz.length);
  const ultima = fluxo.at(-1);

  const extremo = Math.max(1, ...matriz.flatMap((coluna) =>
    coluna.celulas.map((c) => Math.abs(c.diferenca ?? 0))));

  const spec = {
    titulo: `Onde a tabela pontua acima e abaixo do normal na Série ${serie}`
          + ` ${edicao.ano}`,
    subtitulo: "Cada casa é uma posição numa rodada, contra a média das outras"
             + " edições",
    arquivo: `ondas-${serie}-${edicao.ano}`,
    numeros: [],
    nota: `Média = pontos daquela posição naquela rodada nas demais edições `
        + `encerradas da Série ${serie}. A edição desenhada fica de fora da `
        + `própria média.`,
    corpo: async (ctx, y) => {
      const x0 = MARGEM + CALHA;
      const x1 = CARD.largura - MARGEM - CALHA_DIR;
      const largura = (x1 - x0) / RODADAS;
      const base = CARD.altura - 84;

      const topo = y + 34;
      const alturaGrade = base - ALTURA_FLUXO - 26 - topo;
      const alturaLinha = alturaGrade / POSICOES;

      legenda(ctx, { x: MARGEM, y, extremo });

      const alvos = desenharGrade(ctx, {
        matriz, x0, largura, topo, alturaLinha, extremo,
      });

      for (let r = 1; r <= RODADAS; r++) {
        if (r !== 1 && r !== RODADAS && r % 2 === 0) continue;
        texto(ctx, r, x0 + (r - 0.5) * largura, topo - 8,
              { tamanho: 10, alinha: "center", cor: COR.cinzaEscuro });
      }

      alvos.push(...faixaDoFluxo(ctx, {
        fluxo, x0, largura, y: topo + alturaGrade + 26, altura: ALTURA_FLUXO,
      }));

      painelDaDireita(ctx, { x: x1 + 18, y: topo,
                             largura: CALHA_DIR - 18, ultima });

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: y, alturaPlot: base - y,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
      };
    },
  };
  return spec;
}

/* --------------------------------------------------------------- cores */
function mistura(de, para, t) {
  const canal = (cor, i) => parseInt(cor.slice(1 + i * 2, 3 + i * 2), 16);
  const valor = (i) => Math.round(canal(de, i) + (canal(para, i) - canal(de, i)) * t);
  return `rgb(${valor(0)}, ${valor(1)}, ${valor(2)})`;
}

/**
 * A cor de uma casa.
 *
 * Escala divergente com o zero no fundo do card: o normal não é uma cor, é a
 * ausência dela. Assim a mancha que interessa — a sobra, de um lado ou do
 * outro — aparece sozinha, sem competir com as casas em que nada acontece.
 */
function corDaDiferenca(diferenca, extremo) {
  if (diferenca === null) return { fundo: COR.cinzaClaro, tinta: COR.cinzaEscuro };
  const t = Math.min(1, Math.abs(diferenca) / extremo);
  return {
    fundo: mistura(COR.fundo, diferenca >= 0 ? COR.positivo : COR.negativo, t),
    // O número tem de se ler nas duas pontas da escala: escuro no quase
    // branco do meio, claro no tom cheio das bordas.
    tinta: t > 0.5 ? COR.branco : COR.azulEscuro,
    forca: t,
  };
}

function legenda(ctx, { x, y, extremo }) {
  const passos = 9;
  const largura = 16;
  texto(ctx, "abaixo da média", x, y + 12,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.negativo });

  let cursor = x + 124;
  for (let i = 0; i < passos; i++) {
    const t = (i / (passos - 1)) * 2 - 1;
    caixa(ctx, cursor, y + 2, largura, 12,
          corDaDiferenca(t * extremo, extremo).fundo, 2);
    cursor += largura + 2;
  }
  texto(ctx, "acima da média", cursor + 8, y + 12,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.positivo });
  texto(ctx, `extremo: ${comSinal(extremo)} pts`, cursor + 130, y + 12,
        { tamanho: 9.5, peso: 700, cor: COR.cinzaEscuro });
}

/* --------------------------------------------------------------- grade */
function desenharGrade(ctx, o) {
  const { matriz, x0, largura, topo, alturaLinha, extremo } = o;

  for (let p = 1; p <= POSICOES; p++) {
    const meio = topo + (p - 0.5) * alturaLinha;
    if (p === 1 || p % 5 === 0) {
      texto(ctx, ordinal(p), x0 - 10, meio + 4,
            { tamanho: 11, peso: 700, alinha: "right", cor: COR.cinzaEscuro });
    }
  }

  const alvos = [];
  for (const coluna of matriz) {
    const x = x0 + (coluna.rodada - 1) * largura;
    for (const [i, celula] of coluna.celulas.entries()) {
      const yLinha = topo + i * alturaLinha;
      const tom = corDaDiferenca(celula.diferenca, extremo);
      caixa(ctx, x + .5, yLinha + .5, largura - 1, alturaLinha - 1,
            tom.fundo, 2);

      // O valor dentro da casa: a cor diz onde olhar, o número diz quanto.
      // Arredondado ao ponto inteiro, que é a unidade da tabela — a casa
      // decimal fica na dica do mouse, onde há espaço para ela.
      if (celula.diferenca !== null) {
        texto(ctx, inteiroComSinal(celula.diferenca),
              x + largura / 2, yLinha + alturaLinha / 2 + 4,
              { tamanho: 10, peso: tom.forca > 0.35 ? 800 : 400,
                alinha: "center", cor: tom.tinta });
      }

      alvos.push({
        n: `${ordinal(i + 1)} na ${ordinal(coluna.rodada)} rodada`,
        x, y: yLinha, l: largura, a: alturaLinha,
        itens: [
          { rotulo: nomeBonito(celula.equipe), cor: COR.azul,
            pontos: celula.pontos,
            detalhe: `${ordinal(i + 1)} na ${ordinal(coluna.rodada)} rodada` },
          { rotulo: "média da posição", cor: COR.cinzaEscuro,
            pontos: num(celula.media),
            detalhe: "nas outras edições da série" },
        ],
        diferenca: celula.diferenca === null ? null : {
          rotulo: comSinal(celula.diferenca),
          texto: celula.diferenca >= 0 ? "acima do normal" : "abaixo do normal",
          cor: celula.diferenca >= 0 ? COR.positivo : COR.negativo,
        },
      });
    }
  }
  return alvos;
}

/* ---------------------------------------------------------------- fluxo */
/**
 * Os pontos que não chegaram à tabela, acumulados.
 *
 * Duas parcelas empilhadas, porque elas têm naturezas diferentes: o que o
 * empate queimou não volta nunca, e o que o jogo adiado retém volta quando ele
 * acontecer. Uma cor só diria que são a mesma coisa.
 */
function faixaDoFluxo(ctx, { fluxo, x0, largura, y, altura }) {
  texto(ctx, "% dos pontos em disputa que não chegaram à tabela", MARGEM,
        y - 6,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });

  // Em percentual, e não em pontos: o total em disputa cresce a cada rodada,
  // e uma coluna de pontos subiria sozinha mesmo com o campeonato perdendo
  // sempre a mesma fatia. A fração compara rodada com rodada.
  const fracao = (linha, chave) => linha[chave] / linha.possiveis;
  const maximo = Math.max(.02, ...fluxo.map((l) => fracao(l, "faltando")));
  const base = y + altura;
  const escala = (v) => (v / maximo) * (altura - 22);

  linhaH(ctx, x0, x0 + RODADAS * largura, base, COR.linha);

  const alvos = [];
  for (const linha of fluxo) {
    const x = x0 + (linha.rodada - 1) * largura;
    const alturaEmpate = escala(fracao(linha, "queimados"));
    const alturaRetido = escala(fracao(linha, "retidos"));

    caixa(ctx, x + 2, base - alturaEmpate, largura - 4, alturaEmpate,
          COR.cinzaEscuro, 2);
    if (alturaRetido > 0) {
      caixa(ctx, x + 2, base - alturaEmpate - alturaRetido, largura - 4,
            alturaRetido, COR.negativo, 2);
    }
    texto(ctx, `${Math.round(fracao(linha, "faltando") * 100)}%`,
          x + largura / 2, base - alturaEmpate - alturaRetido - 6,
          { tamanho: 9.5, peso: 800, alinha: "center", cor: COR.azulEscuro });

    alvos.push({
      n: `${ordinal(linha.rodada)} rodada`,
      x, y: y - 10, l: largura, a: altura + 10,
      itens: [
        { rotulo: "queimados no empate", cor: COR.cinzaEscuro,
          pontos: linha.queimados,
          detalhe: `${num(fracao(linha, "queimados") * 100)}% · não voltam mais` },
        { rotulo: "retidos em jogo por disputar", cor: COR.negativo,
          pontos: linha.retidos,
          detalhe: `${num(fracao(linha, "retidos") * 100)}% · voltam quando o `
                 + `jogo sair` },
      ],
      diferenca: {
        rotulo: `${Math.round(aproveitamentoDaTabela(linha) * 100)}%`,
        texto: `${linha.distribuidos} de ${linha.possiveis} pontos na tabela`,
        cor: COR.azulEscuro,
      },
    });
  }
  return alvos;
}

/* -------------------------------------------------------------- painel */
function painelDaDireita(ctx, { x, y, largura, ultima }) {
  if (!ultima) return;

  caixa(ctx, x, y, largura, 168, COR.branco, 8);
  ctx.save();
  ctx.strokeStyle = COR.linha;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + .5, y + .5, largura - 1, 167, 8);
  ctx.stroke();
  ctx.restore();

  texto(ctx, `na ${ordinal(ultima.rodada)} rodada`, x + 12, y + 20,
        { tamanho: 10.5, peso: 700, maiuscula: true, espaco: .9,
          cor: COR.cinzaEscuro });
  texto(ctx, `${Math.round(aproveitamentoDaTabela(ultima) * 100)}%`,
        x + 12, y + 56, { tamanho: 30, peso: 800, cor: COR.azul });
  texto(ctx, "dos pontos em disputa estão na tabela", x + 12, y + 74,
        { tamanho: 10.5, cor: COR.cinzaEscuro });

  const linhas = [
    ["queimados no empate", ultima.queimados, COR.cinzaEscuro],
    ["retidos em jogo por disputar", ultima.retidos, COR.negativo],
  ];
  linhas.forEach(([rotulo, valor, cor], i) => {
    const yLinha = y + 104 + i * 32;
    texto(ctx, valor, x + 12, yLinha,
          { tamanho: 15, peso: 800, cor });
    texto(ctx, rotulo, x + 12, yLinha + 14,
          { tamanho: 10, cor: COR.cinzaEscuro });
  });
}
