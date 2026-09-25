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
 *
 * A mesma tela responde à pergunta virada do avesso: escolhido um bloco em vez
 * de um clube, ela mostra a classificação de todo mundo **só nos jogos contra
 * aquele bloco**, e quanto cada clube do bloco entregou ao resto. É a diferença
 * entre "de quem o Bahia tirou pontos" e "quem tirou pontos do G4".
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import { marcaAtual } from "/js/marca.js";
import {
  cedidoPorMembro, confrontosDoClube, pontosPorBloco, rankingContraBloco,
} from "/js/adversarios.js";

const LARGURA_TABELA = 520;
const VAO = 26;
const TAG = { largura: 52, altura: 21 };
const ALTURA_BARRA = 96;

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
  return estado.modo === "ranking" ? cartaoDoRanking(estado)
                                   : cartaoDaEquipe(estado);
}

/* ========================================================== por equipe */
function cartaoDaEquipe(estado) {
  const { serie, edicao, equipe, clubes, classificacao, agenda,
          aoEscolher } = estado;
  if (!edicao || !equipe || !classificacao?.length) return null;

  const posicaoDe = (nome) =>
    classificacao.find((c) => c.equipe === nome)?.pos ?? null;
  const confrontos = confrontosDoClube(agenda, posicaoDe);
  if (!confrontos.length) return null;

  const blocos = pontosPorBloco(confrontos, { total: classificacao.length });
  const minha = classificacao.find((c) => c.equipe === equipe);

  const spec = {
    titulo: `De quem ${nomeBonito(equipe)} tirou os pontos na Série ${serie} `
          + `${edicao.ano}`,
    subtitulo: "",
    arquivo: `adversarios-${serie}-${edicao.ano}-${equipe}`,
    escudo: clubes?.[equipe]?.escudo,
    // Sem faixa de números: a barra de distribuição faz o papel dela e diz
    // mais, porque mostra as cinco parcelas ao mesmo tempo.
    numeros: [],
    nota: `Os blocos agrupam os adversários pela posição de hoje, e não pela `
        + `da época do jogo: a pergunta é sobre a tabela que se tem na mão. `
        + `Jogo por disputar não entra em pontos possíveis.`,
    corpo: async (ctx, y) => {
      const base = CARD.altura - 84;

      const alvos = barraDaDistribuicao(ctx, {
        blocos, minha, x: MARGEM, largura: CARD.largura - MARGEM * 2, y,
      });
      const topo = y + ALTURA_BARRA;

      alvos.push(...await tabela(ctx, {
        classificacao, confrontos, equipe, clubes,
        x: MARGEM, largura: LARGURA_TABELA, y: topo, base,
      }));

      const x0 = MARGEM + LARGURA_TABELA + VAO;
      alvos.push(...painelDosBlocos(ctx, {
        blocos, x: x0, largura: CARD.largura - MARGEM - x0, y: topo, base,
      }));

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
      n: nomeBonito(clube.equipe), equipe: clube.equipe,
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
  texto(ctx, "aproveitamento por bloco da tabela", x, y + 18,
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

/**
 * De onde vieram os pontos, numa barra só.
 *
 * Cada parcela é um bloco da tabela, com a largura na fatia que ele representa
 * do total conquistado. É a resposta direta à pergunta da tela — e o
 * complemento do painel da direita, que mede aproveitamento: aqui não importa
 * o quanto se aproveitou de cada bloco, e sim de onde vieram os pontos que se
 * tem na mão.
 */
function barraDaDistribuicao(ctx, { blocos, minha, x, largura, y }) {
  const total = blocos.reduce((soma, b) => soma + b.pontos, 0);
  texto(ctx, `de onde vieram os ${total} pontos`, x, y + 16,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });
  if (minha) {
    texto(ctx, `${minha.j} jogos · ${ordinal(minha.pos)} na tabela`,
          x + largura, y + 16,
          { tamanho: 11, alinha: "right", cor: COR.cinzaEscuro });
  }
  if (!total) return [];

  const yBarra = y + 28;
  const altura = 40;
  const alvos = [];
  let cursor = x;

  for (const [i, bloco] of blocos.entries()) {
    const fatia = bloco.pontos / total;
    const l = largura * fatia;
    if (l <= 0) continue;

    const cor = corDoBloco(i, blocos.length);
    caixa(ctx, cursor, yBarra, Math.max(2, l - 2), altura, cor, 4);

    // O rótulo entra dentro da parcela quando cabe; se não couber, vira só o
    // número, e se nem ele couber, some — a barra continua legível sem.
    const dentro = `${bloco.pontos} pts · ${Math.round(fatia * 100)}%`;
    ctx.save();
    ctx.font = '800 13px "Assistant", sans-serif';
    const cabeTudo = ctx.measureText(dentro).width + 16 < l;
    const cabeNumero = ctx.measureText(`${bloco.pontos}`).width + 12 < l;
    ctx.restore();
    if (cabeTudo || cabeNumero) {
      texto(ctx, cabeTudo ? dentro : `${bloco.pontos}`,
            cursor + l / 2 - 1, yBarra + altura / 2 + 5,
            { tamanho: 13, peso: 800, alinha: "center", cor: COR.branco });
    }
    texto(ctx, `${ordinal(bloco.de)}–${ordinal(bloco.ate)}`,
          cursor + l / 2 - 1, yBarra + altura + 16,
          { tamanho: 10.5, peso: 700, alinha: "center", cor: COR.cinzaEscuro });

    alvos.push({
      n: `${ordinal(bloco.de)} ao ${ordinal(bloco.ate)}`,
      x: cursor, y: yBarra - 6, l, a: altura + 26,
      itens: [],
      diferenca: {
        rotulo: `${bloco.pontos} pts`,
        texto: `${Math.round(fatia * 100)}% de tudo o que se conquistou · `
             + `${pct(bloco.aproveitamento)} de aproveitamento contra o bloco`,
        cor,
      },
    });
    cursor += l;
  }
  return alvos;
}

/** Do topo da tabela ao fim dela: vermelho em cima, verde embaixo. */
function corDoBloco(i, quantos) {
  const t = quantos > 1 ? i / (quantos - 1) : .5;
  return t < .5 ? mistura(COR.negativo, COR.cinzaEscuro, t * 2)
                : mistura(COR.cinzaEscuro, COR.positivo, (t - .5) * 2);
}

/* ====================================================== ranking do bloco */
function cartaoDoRanking(estado) {
  const { serie, edicao, clubes, classificacao, lados, faixa, mando,
          aoEscolher } = estado;
  if (!edicao || !classificacao?.length) return null;

  const bloco = classificacao
    .filter((c) => c.pos >= faixa.melhor && c.pos <= faixa.pior)
    .map((c) => c.equipe);
  if (!bloco.length) return null;

  const ranking = rankingContraBloco(lados, { bloco, mando });
  const membros = cedidoPorMembro(lados, { bloco, mando });
  if (!ranking.length) return null;

  const posicaoDe = (nome) =>
    classificacao.find((c) => c.equipe === nome)?.pos ?? null;
  const ondeJoga = mando === "casa" ? " jogando em casa"
    : mando === "fora" ? " jogando fora" : "";

  const spec = {
    titulo: `Quem melhor pontuou contra o ${ordinal(faixa.melhor)} ao `
          + `${ordinal(faixa.pior)} da Série ${serie} ${edicao.ano}`,
    subtitulo: "",
    arquivo: `bloco-${serie}-${edicao.ano}-${faixa.melhor}-${faixa.pior}-${mando}`,
    numeros: [],
    nota: `Conta só os jogos${ondeJoga} contra quem ocupa hoje essas `
        + `posições. A ordem é por aproveitamento: os clubes do bloco também `
        + `jogam entre si, e acabam com números de jogos diferentes.`,
    corpo: async (ctx, y) => {
      const base = CARD.altura - 84;
      const larguraMembros = 620;

      const alvos = await painelDosMembros(ctx, {
        membros, clubes, posicaoDe, mando,
        x: MARGEM, largura: larguraMembros, y, base,
      });

      const x0 = MARGEM + larguraMembros + VAO;
      alvos.push(...await tabelaDoRanking(ctx, {
        ranking, clubes, bloco,
        x: x0, largura: CARD.largura - MARGEM - x0, y, base,
      }));

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

/**
 * Quanto cada clube do bloco entregou ao resto.
 *
 * O número aqui é o aproveitamento **dos adversários** contra aquele clube:
 * alto quer dizer freguês, e não campanha boa. É a leitura que explica o
 * ranking da direita — quem pontuou muito contra o bloco pode ter pegado o
 * membro mais generoso dele duas vezes.
 */
async function painelDosMembros(ctx, { membros, clubes, posicaoDe, mando,
                                       x, largura, y, base }) {
  texto(ctx, "quanto cada um do bloco entregou", x, y + 18,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .7,
          cor: COR.cinzaEscuro });
  texto(ctx, mando === "ambos" ? "todos os jogos"
          : mando === "casa" ? "adversários em casa" : "adversários fora",
        x + largura, y + 18,
        { tamanho: 10.5, alinha: "right", cor: COR.cinzaEscuro });
  linhaH(ctx, x, x + largura, y + 26, COR.linha);

  const topo = y + 34;
  const alturaLinha = Math.min(104, (base - topo) / Math.max(1, membros.length));
  const xTrilho = x + 232;
  const larguraTrilho = largura - 232 - 110;

  const alvos = [];
  for (const [i, membro] of membros.entries()) {
    const yl = topo + i * alturaLinha;
    const meio = yl + alturaLinha / 2;
    const lado = Math.min(30, alturaLinha - 14);

    desenharEscudo(ctx, await imagem(clubes?.[membro.equipe]?.escudo),
                   x + 6, meio - lado / 2, lado);
    texto(ctx, cortar(ctx, nomeBonito(membro.equipe), 150, 13.5, 700),
          x + 44, meio - 2,
          { tamanho: 13.5, peso: 700, cor: COR.azulEscuro });
    texto(ctx, `${ordinal(posicaoDe(membro.equipe) ?? 0)} · `
             + `${membro.jogos} jogos`, x + 44, meio + 15,
          { tamanho: 10.5, cor: COR.cinzaEscuro });
    // A campanha do membro no confronto, e não a dos adversários: quem lê a
    // linha quer saber o que aconteceu com ele.
    texto(ctx, `venceu ${membro.d}, empatou ${membro.e}, perdeu ${membro.t}`,
          x + 44, meio + 30, { tamanho: 10, cor: COR.cinza });

    caixa(ctx, xTrilho, meio - 11, larguraTrilho, 22, COR.cinzaClaro, 4);
    if (membro.aproveitamento !== null) {
      caixa(ctx, xTrilho, meio - 11,
            Math.max(3, larguraTrilho * membro.aproveitamento), 22,
            corDoAproveitamento(membro.aproveitamento), 4);
    }
    texto(ctx, `${membro.pontos} pts`, xTrilho + larguraTrilho + 12, meio + 5,
          { tamanho: 12.5, peso: 700, cor: COR.cinzaEscuro });
    texto(ctx, pct(membro.aproveitamento), x + largura, meio + 5,
          { tamanho: 14, peso: 800, alinha: "right", cor: COR.azulEscuro });

    alvos.push({
      n: nomeBonito(membro.equipe), equipe: membro.equipe,
      x, y: yl, l: largura, a: alturaLinha - 2,
      itens: [],
      diferenca: {
        rotulo: pct(membro.aproveitamento),
        texto: `de aproveitamento dos adversários contra ele · `
             + `${membro.t} ${marcaAtual().triunfos} deles, ${membro.e} `
             + `empates e ${membro.d} derrotas`,
        cor: corDoAproveitamento(membro.aproveitamento),
      },
    });
  }
  return alvos;
}

/** A classificação contando só os jogos contra o bloco. */
async function tabelaDoRanking(ctx, { ranking, clubes, bloco,
                                      x, largura, y, base }) {
  const membros = new Set(bloco);
  // A barra do aproveitamento ocupa os 126px antes do percentual; jogos e
  // pontos ficam antes dela, ou o número some debaixo da barra.
  const xAprov = x + largura;
  const xPts = xAprov - 142;
  const xJogos = xAprov - 192;

  texto(ctx, "classificação contra o bloco", x + 12, y + 18,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .7,
          cor: COR.cinzaEscuro });
  const cabecalho = (conteudo, xr) =>
    texto(ctx, conteudo, xr, y + 18,
          { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .7,
            alinha: "right", cor: COR.cinzaEscuro });
  cabecalho("j", xJogos);
  cabecalho("pts", xPts);
  cabecalho("aproveitamento", xAprov);
  linhaH(ctx, x, x + largura, y + 26, COR.linha);

  const topo = y + 32;
  const alturaLinha = (base - topo) / ranking.length;

  const alvos = [];
  for (const [i, linha] of ranking.entries()) {
    const yl = topo + i * alturaLinha;
    const meio = yl + alturaLinha / 2;
    const doBloco = membros.has(linha.equipe);

    caixa(ctx, x, yl, largura, alturaLinha - 2,
          doBloco ? COR.cinzaClaro : i % 2 ? COR.fundo : COR.branco, 4);

    texto(ctx, i + 1, x + 22, meio + 4,
          { tamanho: 11.5, peso: 800, alinha: "right", cor: COR.cinzaEscuro });

    const lado = Math.min(20, alturaLinha - 6);
    desenharEscudo(ctx, await imagem(clubes?.[linha.equipe]?.escudo),
                   x + 30, meio - lado / 2, lado);
    texto(ctx, cortar(ctx, nomeBonito(linha.equipe), xJogos - x - 92, 12.5, 700),
          x + 56, meio + 4,
          { tamanho: 12.5, peso: 700, cor: COR.azulEscuro });
    if (doBloco) {
      texto(ctx, "do bloco", xJogos - 44, meio + 4,
            { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .6,
              alinha: "right", cor: COR.cinza });
    }

    texto(ctx, linha.jogos, xJogos, meio + 4,
          { tamanho: 12, alinha: "right", cor: COR.cinzaEscuro });
    texto(ctx, linha.pontos, xPts, meio + 4,
          { tamanho: 12.5, peso: 700, alinha: "right", cor: COR.azulEscuro });

    const larguraBarra = 76;
    caixa(ctx, xAprov - larguraBarra - 50, meio - 7, larguraBarra, 14,
          COR.cinzaClaro, 3);
    caixa(ctx, xAprov - larguraBarra - 50, meio - 7,
          Math.max(2, larguraBarra * linha.aproveitamento), 14,
          corDoAproveitamento(linha.aproveitamento), 3);
    texto(ctx, pct(linha.aproveitamento), xAprov, meio + 5,
          { tamanho: 13, peso: 800, alinha: "right", cor: COR.azulEscuro });

    alvos.push({
      n: nomeBonito(linha.equipe), equipe: linha.equipe,
      x, y: yl, l: largura, a: alturaLinha - 2,
      itens: [],
      diferenca: {
        rotulo: pct(linha.aproveitamento),
        texto: `${linha.pontos} de ${linha.possiveis} pontos em `
             + `${linha.jogos} jogos · ${linha.t} ${marcaAtual().triunfos}, `
             + `${linha.e} empates e ${linha.d} derrotas`,
        cor: corDoAproveitamento(linha.aproveitamento),
      },
    });
  }
  return alvos;
}
