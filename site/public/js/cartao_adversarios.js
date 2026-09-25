/**
 * Card: de quem o clube tirou os pontos.
 *
 * À esquerda, a classificação de hoje com o que o clube fez contra cada um dos
 * vinte: uma coluna para o jogo em casa, outra para o de fora. É a leitura de
 * confronto, a que o torcedor faz de cabeça — "contra esse a gente ganhou os
 * dois" —, agora na ordem da tabela, que é onde ela ganha sentido.
 *
 * À direita, a mesma campanha somada por região da tabela. Quarenta e cinco
 * pontos tirados do pelotão de baixo e quarenta e cinco tirados de quem briga
 * em cima são campanhas diferentes, e a tabela sozinha não distingue as duas.
 * Cada bloco traz o aproveitamento geral e o de cada campo, porque é comum um
 * clube só pontuar contra os grandes dentro de casa.
 *
 * A régua de cor do aproveitamento tem o meio em 50%, e não em zero: meio
 * aproveitamento é a fronteira que o futebol brasileiro usa para quase tudo —
 * abaixo dela se briga contra a queda, acima se briga por vaga.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import { marcaAtual } from "/js/marca.js";
import {
  confrontosDoClube, extremosDosBlocos, pontosPorBloco,
} from "/js/adversarios.js";

const LARGURA_TABELA = 520;
const VAO = 26;
const TAG = { largura: 52, altura: 21 };

const ordinal = (p) => `${p}º`;
const pct = (v) => (v === null ? "—" : `${Math.round(v * 100)}%`);

function mistura(de, para, t) {
  const canal = (cor, i) => parseInt(cor.slice(1 + i * 2, 3 + i * 2), 16);
  const valor = (i) => Math.round(canal(de, i) + (canal(para, i) - canal(de, i)) * t);
  return `rgb(${valor(0)}, ${valor(1)}, ${valor(2)})`;
}

/** Meio aproveitamento no cinza; daí para baixo vermelho, para cima verde. */
function corDoAproveitamento(valor) {
  if (valor === null) return COR.cinzaClaro;
  const t = Math.min(1, Math.max(0, valor));
  return t < .5 ? mistura(COR.negativo, COR.cinzaEscuro, t * 2)
                : mistura(COR.cinzaEscuro, COR.positivo, (t - .5) * 2);
}

const corDoResultado = (resultado) => (resultado === "T" ? COR.positivo
  : resultado === "E" ? COR.cinzaEscuro : COR.negativo);

export function montarCartao(estado) {
  const { serie, edicao, equipe, clubes, classificacao, agenda } = estado;
  if (!edicao || !equipe || !classificacao?.length) return null;

  const posicaoDe = (nome) =>
    classificacao.find((c) => c.equipe === nome)?.pos ?? null;
  const confrontos = confrontosDoClube(agenda, posicaoDe);
  if (!confrontos.length) return null;

  const blocos = pontosPorBloco(confrontos, { total: classificacao.length });
  const { melhor, pior } = extremosDosBlocos(blocos);
  const geral = confrontos.reduce((soma, c) => ({
    pontos: soma.pontos + c.pontos,
    possiveis: soma.possiveis + c.possiveis,
  }), { pontos: 0, possiveis: 0 });
  const minha = classificacao.find((c) => c.equipe === equipe);

  const rotuloDoBloco = (bloco) => (bloco
    ? `${ordinal(bloco.de)} ao ${ordinal(bloco.ate)}` : "—");

  const spec = {
    titulo: `De quem ${nomeBonito(equipe)} tirou os pontos na Série ${serie} `
          + `${edicao.ano}`,
    subtitulo: "",
    arquivo: `adversarios-${serie}-${edicao.ano}-${equipe}`,
    escudo: clubes?.[equipe]?.escudo,
    numeros: [
      { valor: `${geral.pontos}`, destaque: "azul",
        nome: `pontos em ${minha?.j ?? 0} jogos · ${pct(
          geral.possiveis ? geral.pontos / geral.possiveis : null)}` },
      { valor: pct(melhor?.aproveitamento ?? null),
        nome: `melhor bloco · ${rotuloDoBloco(melhor)}` },
      { valor: pct(pior?.aproveitamento ?? null),
        nome: `pior bloco · ${rotuloDoBloco(pior)}` },
      { valor: `${minha?.pos ?? "—"}º`, nome: "posição hoje" },
    ],
    nota: `Os blocos agrupam os adversários pela posição de hoje, e não pela `
        + `da época do jogo: a pergunta é sobre a tabela que se tem na mão. `
        + `Jogo por disputar não entra em pontos possíveis.`,
    corpo: async (ctx, y) => {
      const base = CARD.altura - 84;

      const alvos = await tabela(ctx, {
        classificacao, confrontos, equipe, clubes,
        x: MARGEM, largura: LARGURA_TABELA, y, base,
      });

      const x0 = MARGEM + LARGURA_TABELA + VAO;
      alvos.push(...painelDosBlocos(ctx, {
        blocos, x: x0, largura: CARD.largura - MARGEM - x0, y, base,
      }));

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: y, alturaPlot: base - y,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
      };
    },
  };
  return spec;
}

/* ------------------------------------------------------------- tabela */
async function tabela(ctx, { classificacao, confrontos, equipe, clubes,
                             x, largura, y, base }) {
  const xFora = x + largura - TAG.largura - 4;
  const xCasa = xFora - TAG.largura - 8;
  const topo = y + 30;
  const alturaLinha = (base - topo) / classificacao.length;

  const cabecalho = (conteudo, xr) =>
    texto(ctx, conteudo, xr + TAG.largura / 2, y + 18,
          { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .7,
            alinha: "center", cor: COR.cinzaEscuro });
  texto(ctx, "classificação de hoje", x + 12, y + 18,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .7,
          cor: COR.cinzaEscuro });
  cabecalho("em casa", xCasa);
  cabecalho("fora", xFora);
  linhaH(ctx, x, x + largura, y + 26, COR.linha);

  const porAdversario = new Map(confrontos.map((c) => [c.adversario, c]));

  const alvos = [];
  for (const [i, clube] of classificacao.entries()) {
    const yLinha = topo + i * alturaLinha;
    const meio = yLinha + alturaLinha / 2;
    const meu = clube.equipe === equipe;

    caixa(ctx, x, yLinha, largura, alturaLinha - 2,
          meu ? COR.cinzaClaro : i % 2 ? COR.fundo : COR.branco, 4);
    if (meu) caixa(ctx, x, yLinha, 4, alturaLinha - 2, COR.azul, 2);

    texto(ctx, clube.pos, x + 24, meio + 4,
          { tamanho: 11.5, peso: 800, alinha: "right", cor: COR.cinzaEscuro });

    const lado = Math.min(20, alturaLinha - 6);
    desenharEscudo(ctx, await imagem(clubes?.[clube.equipe]?.escudo),
                   x + 32, meio - lado / 2, lado);

    texto(ctx, cortar(ctx, nomeBonito(clube.equipe), xCasa - x - 68, 12.5,
                      meu ? 800 : 700),
          x + 58, meio + 4,
          { tamanho: 12.5, peso: meu ? 800 : 700, cor: COR.azulEscuro });

    if (meu) {
      texto(ctx, `${clube.pts} pts`, xCasa + TAG.largura, meio + 4,
            { tamanho: 12, peso: 800, alinha: "center", cor: COR.azul });
      continue;
    }

    const confronto = porAdversario.get(clube.equipe);
    etiqueta(ctx, xCasa, meio, confronto?.casa);
    etiqueta(ctx, xFora, meio, confronto?.fora);

    alvos.push({
      n: nomeBonito(clube.equipe),
      x, y: yLinha, l: largura, a: alturaLinha - 2,
      itens: [
        { rotulo: "em casa", cor: COR.azul,
          pontos: confronto?.casa ? pontosDoJogo(confronto.casa) : null,
          detalhe: descrever(confronto?.casa) },
        { rotulo: "fora", cor: COR.vermelho,
          pontos: confronto?.fora ? pontosDoJogo(confronto.fora) : null,
          detalhe: descrever(confronto?.fora) },
      ],
      diferenca: {
        rotulo: `${confronto?.pontos ?? 0} de ${confronto?.possiveis ?? 0}`,
        texto: `pontos no confronto · ${ordinal(clube.pos)} na tabela`,
        cor: corDoAproveitamento(confronto?.aproveitamento ?? null),
      },
    });
  }
  return alvos;
}

const pontosDoJogo = (jogo) => (!jogo?.realizado ? null
  : jogo.resultado === "T" ? 3 : jogo.resultado === "E" ? 1 : 0);

const descrever = (jogo) => (!jogo ? "sem jogo no recorte"
  : jogo.realizado ? `${jogo.gp}×${jogo.gc} na ${jogo.rodada}ª rodada`
                   : `${jogo.rodada}ª rodada · a jogar`);

/** O placar do confronto, na cor do desfecho. */
function etiqueta(ctx, x, meio, jogo) {
  if (!jogo) {
    texto(ctx, "—", x + TAG.largura / 2, meio + 4,
          { tamanho: 12, alinha: "center", cor: COR.cinza });
    return;
  }
  if (!jogo.realizado) {
    linhaH(ctx, x + TAG.largura / 2 - 8, x + TAG.largura / 2 + 8, meio,
           COR.cinzaClaro, 2);
    return;
  }
  caixa(ctx, x, meio - TAG.altura / 2, TAG.largura, TAG.altura,
        corDoResultado(jogo.resultado), 5);
  texto(ctx, `${jogo.gp}×${jogo.gc}`, x + TAG.largura / 2, meio + 5,
        { tamanho: 12.5, peso: 800, alinha: "center", cor: COR.branco });
}

/* ------------------------------------------------------------- blocos */
function painelDosBlocos(ctx, { blocos, x, largura, y, base }) {
  texto(ctx, "de onde vieram os pontos", x, y + 18,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .7,
          cor: COR.cinzaEscuro });
  linhaH(ctx, x, x + largura, y + 26, COR.linha);

  const topo = y + 40;
  const alturaBloco = (base - topo) / blocos.length;
  // A calha da esquerda guarda o nome do bloco e as duas linhas de contagem;
  // as barras começam depois dela, e nenhum rótulo divide linha com outro.
  const xTrilho = x + 196;
  const larguraTrilho = largura - 196 - 136;

  const alvos = [];
  for (const [i, bloco] of blocos.entries()) {
    const yb = topo + i * alturaBloco;

    texto(ctx, `${ordinal(bloco.de)} ao ${ordinal(bloco.ate)}`, x, yb + 16,
          { tamanho: 15, peso: 800, cor: COR.azulEscuro });
    texto(ctx, `${bloco.adversarios} adversários · ${bloco.jogos} jogos`,
          x, yb + 34, { tamanho: 10.5, cor: COR.cinzaEscuro });
    texto(ctx, `${bloco.pontos} de ${bloco.possiveis} pontos`, x, yb + 50,
          { tamanho: 11, peso: 700, cor: COR.cinzaTexto });

    // A barra cheia é o bloco inteiro; as duas finas, cada campo. Juntas
    // respondem a pergunta que a soma esconde: onde esses pontos foram feitos.
    const faixas = [
      { rotulo: "", conta: bloco, altura: 22, tamanho: 13.5, y: yb + 4 },
      { rotulo: "em casa", conta: bloco.casa, altura: 13, tamanho: 10.5,
        y: yb + 32 },
      { rotulo: "fora", conta: bloco.fora, altura: 13, tamanho: 10.5,
        y: yb + 52 },
    ];

    for (const faixa of faixas) {
      caixa(ctx, xTrilho, faixa.y, larguraTrilho, faixa.altura,
            COR.cinzaClaro, 4);
      if (faixa.conta.aproveitamento !== null) {
        caixa(ctx, xTrilho, faixa.y,
              Math.max(3, larguraTrilho * faixa.conta.aproveitamento),
              faixa.altura, corDoAproveitamento(faixa.conta.aproveitamento), 4);
      }
      texto(ctx, `${pct(faixa.conta.aproveitamento)}${faixa.rotulo
              ? ` ${faixa.rotulo}` : ""}`,
            xTrilho + larguraTrilho + 12, faixa.y + faixa.altura / 2 + 4,
            { tamanho: faixa.tamanho, peso: faixa.rotulo ? 700 : 800,
              cor: faixa.rotulo ? COR.cinzaEscuro : COR.azulEscuro });
    }

    alvos.push({
      n: `${ordinal(bloco.de)} ao ${ordinal(bloco.ate)}`,
      x, y: yb, l: largura, a: alturaBloco - 6,
      itens: [
        { rotulo: "em casa", cor: COR.azul, pontos: bloco.casa.pontos,
          detalhe: `${bloco.casa.jogos} jogos · `
                 + `${pct(bloco.casa.aproveitamento)}` },
        { rotulo: "fora", cor: COR.vermelho, pontos: bloco.fora.pontos,
          detalhe: `${bloco.fora.jogos} jogos · `
                 + `${pct(bloco.fora.aproveitamento)}` },
      ],
      diferenca: {
        rotulo: pct(bloco.aproveitamento),
        texto: `${bloco.t} ${marcaAtual().triunfos}, ${bloco.e} empates e `
             + `${bloco.d} derrotas`,
        cor: corDoAproveitamento(bloco.aproveitamento),
      },
    });
  }
  return alvos;
}
