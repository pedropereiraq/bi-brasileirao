/**
 * Card: a dificuldade da tabela de cada clube.
 *
 * À esquerda, a lista inteira: uma barra por clube, com o número que a
 * sustenta e a contagem de adversários por região da tabela. À direita, o
 * clube escolhido aberto — de onde vêm os adversários dele, quais são os
 * jogos, e quanto pesa a tabela em casa e fora.
 *
 * A cor é a mesma da tela de próximos jogos, e de propósito: vermelho na
 * tabela mais dura da tela, verde na mais leve, cinza no meio. Duas telas que
 * respondem à mesma pergunta não podem falar línguas diferentes.
 *
 * A barra é relativa ao que está na tela, e não a um máximo teórico. Posição
 * média 9,1 não é dura nem fácil sozinha: ela é o que for ao lado das outras
 * dezenove, e é essa comparação que a barra desenha.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import {
  FAIXAS, dificuldadeDosClubes, escalaDaDureza, faixaDaPosicao,
  ordenarDificuldade,
} from "/js/dificuldade_tabela.js";

const POSICOES = 20;
const LARGURA_LISTA = 720;
const VAO = 24;

const ordinal = (p) => `${p}º`;
const num = (v) => (v === null ? "—" : v.toFixed(1).replace(".", ","));
const pct = (v) => (v === null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")}%`);

// A posição do meio de cada faixa: é ela que dá a cor da faixa, pela mesma
// rampa que pinta a etiqueta de um adversário.
const MEIO_DA_FAIXA = { g4: 2.5, g8: 6.5, g12: 10.5, g16: 14.5, z4: 18.5 };

function mistura(de, para, t) {
  const canal = (cor, i) => parseInt(cor.slice(1 + i * 2, 3 + i * 2), 16);
  const valor = (i) => Math.round(canal(de, i) + (canal(para, i) - canal(de, i)) * t);
  return `rgb(${valor(0)}, ${valor(1)}, ${valor(2)})`;
}

/** A rampa da dificuldade: 0 é o mais duro, 1 o mais fácil. */
function corDaFracao(fracao) {
  const t = Math.min(1, Math.max(0, fracao));
  return t < 0.5
    ? mistura(COR.negativo, COR.cinzaEscuro, t * 2)
    : mistura(COR.cinzaEscuro, COR.positivo, (t - 0.5) * 2);
}

const corDaPosicao = (posicao) => corDaFracao((posicao - 1) / (POSICOES - 1));
const corDaFaixa = (chave) => corDaPosicao(MEIO_DA_FAIXA[chave]);

const rotuloDoCriterio = (criterio) =>
  criterio === "posicao" ? "posição média dos adversários"
                         : "aproveitamento médio dos adversários";

const valorDoCriterio = (v, criterio) =>
  criterio === "posicao" ? num(v) : pct(v);

export function montarCartao(estado) {
  const { serie, edicao, criterio, quando, local, ordem, destaque, clubes,
          agendas, tabelas, aoEscolher } = estado;
  if (!edicao || !tabelas) return null;

  const linhas = ordenarDificuldade(
    dificuldadeDosClubes({
      agendas, geral: tabelas.geral, casa: tabelas.casa, fora: tabelas.fora,
      quando, local, criterio,
    }),
    { ordem, criterio });
  if (!linhas.length) return null;

  const dureza = escalaDaDureza(linhas, criterio);
  const aberto = linhas.find((l) => l.equipe === destaque) ?? linhas[0];

  const spec = {
    titulo: `Dificuldade de tabela na Série ${serie} ${edicao.ano}`,
    subtitulo: [
      quando === "realizados" ? "jogos já realizados" : "jogos a realizar",
      rotuloDoCriterio(criterio),
      local === "considerar" ? "adversário no campo do jogo"
                             : "adversário na tabela geral",
    ].join(" · "),
    arquivo: `dificuldade-${serie}-${edicao.ano}-${quando}-${criterio}`,
    numeros: [],
    nota: local === "considerar"
      ? `Com o local considerado, cada adversário vale o que ele é no campo em `
      + `que o jogo acontece: quem visita enfrenta a campanha de mandante do `
      + `outro. As faixas G-4 a Z-4 seguem a classificação geral.`
      : `Cada adversário vale o que ele é na classificação geral de hoje. As `
      + `faixas G-4 a Z-4 são os cinco blocos de quatro posições da tabela.`,
    corpo: async (ctx, y) => {
      const base = CARD.altura - 84;

      const alvos = await lista(ctx, {
        linhas, clubes, criterio, dureza, destaque: aberto?.equipe,
        x: MARGEM, largura: LARGURA_LISTA, y, base,
      });

      const xPainel = MARGEM + LARGURA_LISTA + VAO;
      alvos.push(...await painel(ctx, {
        linha: aberto, clubes, criterio, quando,
        x: xPainel, largura: CARD.largura - MARGEM - xPainel, y, base,
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

/* ----------------------------------------------------------------- lista */
async function lista(ctx, { linhas, clubes, criterio, dureza, destaque,
                            x, largura, y, base }) {
  const colunas = {
    ordem: x + 14,
    escudo: x + 28,
    nome: x + 54,
    barra: { de: x + 216, ate: x + 416 },
    valor: x + 486,
    jogos: x + 518,
    faixas: x + 536,
  };
  const ladoFaixa = 34;
  const vaoFaixa = 3;

  const topo = y + 30;
  const alturaLinha = (base - topo) / linhas.length;

  const cabecalho = (conteudo, xr, alinha = "center") =>
    texto(ctx, conteudo, xr, y + 18,
          { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .7,
            alinha, cor: COR.cinzaEscuro });

  cabecalho("clube", colunas.nome, "left");
  cabecalho(criterio === "posicao" ? "posição média" : "aproveitamento médio",
            (colunas.barra.de + colunas.barra.ate) / 2);
  cabecalho("j", colunas.jogos, "right");
  FAIXAS.forEach((faixa, i) => {
    const xf = colunas.faixas + i * (ladoFaixa + vaoFaixa);
    cabecalho(faixa.rotulo, xf + ladoFaixa / 2);
  });

  const maiorContagem = Math.max(1, ...linhas.flatMap((l) =>
    FAIXAS.map((f) => l.contagem[f.chave])));

  const alvos = [];
  for (const [i, linha] of linhas.entries()) {
    const yLinha = topo + i * alturaLinha;
    const meio = yLinha + alturaLinha / 2;
    const marcado = linha.equipe === destaque;

    caixa(ctx, x, yLinha, largura, alturaLinha - 2,
          marcado ? COR.cinzaClaro : i % 2 ? COR.fundo : COR.branco, 4);
    // O cinza sozinho se perde entre as faixas alternadas; o talho na borda
    // esquerda diz de longe qual linha o painel está mostrando.
    if (marcado) caixa(ctx, x, yLinha, 4, alturaLinha - 2, COR.azul, 2);

    texto(ctx, i + 1, colunas.ordem, meio + 4,
          { tamanho: 11.5, peso: 800, alinha: "center", cor: COR.cinzaEscuro });

    const lado = Math.min(20, alturaLinha - 8);
    desenharEscudo(ctx, await imagem(clubes?.[linha.equipe]?.escudo),
                   colunas.escudo, meio - lado / 2, lado);

    texto(ctx, cortar(ctx, nomeBonito(linha.equipe),
                      colunas.barra.de - colunas.nome - 12, 12.5, 700),
          colunas.nome, meio + 4,
          { tamanho: 12.5, peso: 700, cor: COR.azulEscuro });

    // A barra: comprimento e cor dizem a mesma coisa — o quanto aquela tabela
    // pesa perto das outras da tela.
    const t = dureza(linha.media);
    const larguraMax = colunas.barra.ate - colunas.barra.de;
    caixa(ctx, colunas.barra.de, meio - 7, larguraMax, 14, COR.cinzaClaro, 7);
    if (linha.media !== null) {
      // Piso de 16px: no zero da escala a barra viraria um ponto, e ponto não
      // se lê como barra curta — se lê como defeito.
      caixa(ctx, colunas.barra.de, meio - 7, Math.max(16, larguraMax * t), 14,
            corDaFracao(1 - t), 7);
    }
    texto(ctx, valorDoCriterio(linha.media, criterio), colunas.valor, meio + 5,
          { tamanho: 13.5, peso: 800, alinha: "right", cor: COR.azulEscuro });

    texto(ctx, linha.total, colunas.jogos, meio + 4,
          { tamanho: 11.5, alinha: "right", cor: COR.cinzaEscuro });

    FAIXAS.forEach((faixa, k) => {
      const xf = colunas.faixas + k * (ladoFaixa + vaoFaixa);
      const quantos = linha.contagem[faixa.chave];
      if (quantos > 0) {
        caixa(ctx, xf, meio - 11, ladoFaixa, 22,
              mistura(COR.branco, corDaFaixa(faixa.chave),
                      .24 + .56 * (quantos / maiorContagem)), 4);
      }
      texto(ctx, quantos || "—", xf + ladoFaixa / 2, meio + 4,
            { tamanho: 12, peso: quantos ? 800 : 400, alinha: "center",
              cor: quantos ? COR.azulEscuro : COR.cinza });
    });

    // A dica não usa `itens`: nada aqui se mede em pontos, e o formato de
    // item carimba "pts" no número. O valor vai no destaque, que é texto
    // livre, e o resto vira uma linha só.
    alvos.push({
      n: `${nomeBonito(linha.equipe)} · ${ordinal(linha.pos)} na tabela`,
      equipe: linha.equipe,
      x, y: yLinha, l: largura, a: alturaLinha - 2,
      itens: [],
      diferenca: {
        rotulo: valorDoCriterio(linha.media, criterio),
        texto: `${rotuloDoCriterio(criterio)} em ${linha.total} jogos · `
             + `em casa ${valorDoCriterio(linha.mediaCasa, criterio)} · `
             + `fora ${valorDoCriterio(linha.mediaFora, criterio)}`,
        cor: corDaFracao(1 - t),
      },
    });
  }

  linhaH(ctx, x, x + largura, y + 26, COR.linha);
  return alvos;
}

/* ---------------------------------------------------------------- painel */
async function painel(ctx, { linha, clubes, criterio, quando, x, largura,
                             y, base }) {
  if (!linha) return [];

  const lado = 34;
  desenharEscudo(ctx, await imagem(clubes?.[linha.equipe]?.escudo),
                 x, y - 4, lado);
  texto(ctx, nomeBonito(linha.equipe), x + lado + 12, y + 16,
        { tamanho: 19, peso: 800, cor: COR.azulEscuro });
  texto(ctx, `${ordinal(linha.pos)} na tabela`, x + largura, y + 16,
        { tamanho: 12.5, peso: 700, alinha: "right", cor: COR.cinzaEscuro });

  const caixas = [
    ["tabela toda", linha.media],
    ["jogos em casa", linha.mediaCasa],
    ["jogos fora", linha.mediaFora],
  ];
  const larguraCaixa = (largura - 16) / 3;
  const yCaixas = y + 34;
  caixas.forEach(([rotulo, valor], i) => {
    const xc = x + i * (larguraCaixa + 8);
    caixa(ctx, xc, yCaixas, larguraCaixa, 76, i === 0 ? COR.marca : COR.branco, 8);
    if (i > 0) {
      ctx.save();
      ctx.strokeStyle = COR.linha;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(xc + .5, yCaixas + .5, larguraCaixa - 1, 75, 8);
      ctx.stroke();
      ctx.restore();
    }
    texto(ctx, valorDoCriterio(valor, criterio), xc + 16, yCaixas + 46,
          { tamanho: 32, peso: 800,
            cor: i === 0 ? COR.marcaTexto : COR.azulEscuro });
    texto(ctx, rotulo, xc + 16, yCaixas + 66,
          { tamanho: 11, peso: 700, maiuscula: true, espaco: 1,
            cor: i === 0 ? COR.marcaSuave : COR.cinzaEscuro });
  });

  const topo = yCaixas + 96;
  const alvos = pizza(ctx, {
    linha, x, largura: 300, y: topo, base,
  });
  alvos.push(...agenda(ctx, {
    linha, clubes, quando, x: x + 320, largura: largura - 320,
    y: topo, base,
  }));
  return alvos;
}

/**
 * De onde vêm os adversários.
 *
 * A pizza é a resposta certa aqui, e não uma barra: são cinco partes de um
 * todo fechado — os jogos daquele clube no recorte —, e o que se quer ver é a
 * fatia, não o valor absoluto de cada faixa. A contagem exata fica na legenda
 * ao lado, para a pizza não precisar carregar número dentro.
 */
function pizza(ctx, { linha, x, largura, y, base }) {
  const total = FAIXAS.reduce((s, f) => s + linha.contagem[f.chave], 0);
  const raio = 84;
  const cx = x + raio + 10;
  const cy = y + raio + 6;

  if (!total) {
    texto(ctx, "sem jogos neste recorte", x, cy,
          { tamanho: 13, cor: COR.cinzaEscuro });
    return [];
  }

  let inicio = -Math.PI / 2;
  const alvos = [];
  for (const faixa of FAIXAS) {
    const quantos = linha.contagem[faixa.chave];
    if (!quantos) continue;
    const fim = inicio + (quantos / total) * Math.PI * 2;

    ctx.save();
    ctx.fillStyle = corDaFaixa(faixa.chave);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, raio, inicio, fim);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COR.fundo;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // O número só entra na fatia que o comporta; nas finas ele encostaria na
    // borda e brigaria com a vizinha. A legenda tem todos, sempre.
    if (quantos / total > .08) {
      const meio = (inicio + fim) / 2;
      texto(ctx, quantos, cx + Math.cos(meio) * raio * .62,
            cy + Math.sin(meio) * raio * .62 + 5,
            { tamanho: 15, peso: 800, alinha: "center", cor: COR.branco });
    }
    inicio = fim;
  }

  const yLegenda = cy + raio + 26;
  FAIXAS.forEach((faixa, i) => {
    const yl = yLegenda + i * 22;
    const quantos = linha.contagem[faixa.chave];
    caixa(ctx, x, yl - 9, 12, 12, corDaFaixa(faixa.chave), 3);
    texto(ctx, faixa.rotulo, x + 20, yl,
          { tamanho: 12, peso: 700,
            cor: quantos ? COR.azulEscuro : COR.cinzaEscuro });
    texto(ctx, quantos ? `${quantos} ${quantos === 1 ? "jogo" : "jogos"}` : "—",
          x + 78, yl,
          { tamanho: 12, cor: COR.cinzaEscuro });
    texto(ctx, quantos ? `${Math.round((quantos / total) * 100)}%` : "",
          x + largura - 20, yl,
          { tamanho: 12, peso: 700, alinha: "right", cor: COR.cinzaEscuro });
  });

  texto(ctx, "adversários por faixa da tabela", x, y - 10,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });
  return [];
}

/** Os jogos do recorte, na ordem em que aconteceram ou vão acontecer. */
function agenda(ctx, { linha, clubes, quando, x, largura, y, base }) {
  texto(ctx, quando === "realizados" ? "jogos já realizados" : "jogos a realizar",
        x, y - 10,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });

  const jogos = linha.jogos;
  if (!jogos.length) return [];

  const altura = Math.min(28, (base - y) / Math.max(1, jogos.length));
  const xPos = x + largura - 96;
  const xMando = x + largura - 58;

  for (const [i, jogo] of jogos.entries()) {
    const yl = y + i * altura;
    const meio = yl + altura / 2;
    if (i % 2 === 0) caixa(ctx, x, yl, largura, altura - 1, COR.branco, 3);

    texto(ctx, `${jogo.rodada}ª`, x + 22, meio + 4,
          { tamanho: 10.5, alinha: "right", cor: COR.cinzaEscuro });
    texto(ctx, cortar(ctx, nomeBonito(jogo.adversario), xPos - x - 44, 12.5, 700),
          x + 32, meio + 4,
          { tamanho: 12.5, peso: 700, cor: COR.azulEscuro });

    if (jogo.posicao !== null) {
      caixa(ctx, xPos - 2, meio - 10, 30, 20, corDaPosicao(jogo.posicao), 4);
      texto(ctx, jogo.posicao, xPos + 13, meio + 5,
            { tamanho: 12, peso: 800, alinha: "center", cor: COR.branco });
    }

    texto(ctx, jogo.mando === "casa" ? "casa" : "fora", xMando, meio + 4,
          { tamanho: 11, peso: 700, maiuscula: true, espaco: .6,
            cor: jogo.mando === "casa" ? COR.azul : COR.cinzaEscuro });
  }
  return [];
}
