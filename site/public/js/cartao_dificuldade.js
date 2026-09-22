/**
 * Card: a dificuldade da tabela de cada clube.
 *
 * A lista inteira é o card: uma barra por clube, com o número que a sustenta
 * e a contagem de adversários por região da tabela. Ela ocupa tudo enquanto
 * ninguém for escolhido — o detalhe de um clube é uma segunda pergunta, e
 * abrir um por conta própria seria responder o que não se perguntou.
 *
 * Escolhido um clube, o painel abre à direita: de onde vêm os adversários
 * dele, quanto pesa a tabela em casa e fora, e **em que região da tabela**
 * estão os jogos. Essa última é a pergunta que a lista cronológica não
 * respondia: ela dizia contra quem, na ordem do calendário, e era preciso
 * decorar a classificação para enxergar o desenho. Com a classificação
 * inteira desenhada e uma etiqueta em cada confronto, o desenho aparece
 * sozinho — as etiquetas se acumulam na faixa do campeonato em que o clube
 * ainda tem trabalho.
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

// Triunfo, empate e derrota na tríade da marca, a mesma da barra de campanha.
const corDoResultado = (resultado) =>
  resultado === "T" ? COR.positivo
  : resultado === "E" ? COR.cinzaEscuro : COR.negativo;
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
  // Sem escolha não há painel: o padrão é a tabela, e só.
  const aberto = destaque ? linhas.find((l) => l.equipe === destaque) : null;
  const classificacao = Object.values(tabelas.geral)
    .sort((a, b) => a.pos - b.pos);

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
      const cheia = CARD.largura - MARGEM * 2;

      const alvos = await lista(ctx, {
        linhas, clubes, criterio, dureza, destaque: aberto?.equipe,
        x: MARGEM, largura: aberto ? LARGURA_LISTA : cheia, y, base,
      });

      if (aberto) {
        const xPainel = MARGEM + LARGURA_LISTA + VAO;
        alvos.push(...await painel(ctx, {
          linha: aberto, classificacao, clubes, criterio, quando,
          x: xPainel, largura: CARD.largura - MARGEM - xPainel, y, base,
        }));
      }

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
  const ladoFaixa = 34;
  const vaoFaixa = 3;

  // As colunas se penduram na borda direita: sem o painel aberto a lista
  // ocupa o card inteiro, e é a barra que cresce — é ela que compara.
  const colunas = { ordem: x + 14, escudo: x + 28, nome: x + 54 };
  colunas.faixas = x + largura - FAIXAS.length * (ladoFaixa + vaoFaixa) - 2;
  colunas.jogos = colunas.faixas - 18;
  colunas.valor = colunas.jogos - 32;
  colunas.barra = { de: x + 216, ate: colunas.valor - 70 };

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
async function painel(ctx, { linha, classificacao, clubes, criterio, quando,
                             x, largura, y, base }) {
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
  alvos.push(...tabelaComEtiquetas(ctx, {
    linha, classificacao, quando, x: x + 320, largura: largura - 320,
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

/**
 * A classificação inteira, com etiqueta nos jogos que entram na conta.
 *
 * A régua aqui é a tabela, e não o calendário. Uma lista cronológica diz
 * contra quem se joga; esta diz **onde**, e é isso que se quer ver — três
 * etiquetas coladas no topo são uma reta final contra o G-4, as mesmas três
 * espalhadas embaixo são outra história inteiramente.
 *
 * A etiqueta muda com o recorte, porque a pergunta muda. No que ainda vem,
 * o que interessa é onde se joga: azul para casa, vermelho para fora, que é o
 * par da marca. No que já passou, onde se jogou é história velha — o que
 * interessa é o que se tirou de lá, e a etiqueta vira o placar, na cor do
 * desfecho.
 *
 * Quem joga duas vezes contra o mesmo adversário no recorte ganha as duas
 * etiquetas, na ordem em que os jogos vêm.
 */
function tabelaComEtiquetas(ctx, { linha, classificacao, quando, x, largura,
                                   y, base }) {
  texto(ctx, quando === "realizados" ? "onde os jogos aconteceram"
                                     : "onde os jogos serão disputados",
        x, y - 10,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });

  const porAdversario = new Map();
  for (const jogo of linha.jogos) {
    if (!porAdversario.has(jogo.adversario)) porAdversario.set(jogo.adversario, []);
    porAdversario.get(jogo.adversario).push(jogo);
  }

  const altura = Math.min(28, (base - y) / Math.max(1, classificacao.length));
  const TAG = { largura: 52, altura: 18, vao: 5 };
  const xTags = x + largura - 2 * TAG.largura - TAG.vao;

  const alvos = [];
  for (const [i, clube] of classificacao.entries()) {
    const jogos = porAdversario.get(clube.equipe) ?? [];
    const proprio = clube.equipe === linha.equipe;
    const yl = y + i * altura;
    const meio = yl + altura / 2;

    if (jogos.length) caixa(ctx, x, yl, largura, altura - 1, COR.branco, 3);
    if (proprio) caixa(ctx, x, yl, largura, altura - 1, COR.cinzaClaro, 3);

    texto(ctx, clube.pos, x + 20, meio + 4,
          { tamanho: 11.5, peso: 800, alinha: "right",
            cor: jogos.length || proprio ? COR.azulEscuro : COR.cinzaEscuro });
    texto(ctx, cortar(ctx, nomeBonito(clube.equipe), xTags - x - 38, 12.5, 700),
          x + 30, meio + 4,
          { tamanho: 12.5, peso: jogos.length || proprio ? 700 : 400,
            cor: jogos.length || proprio ? COR.azulEscuro : COR.cinzaTexto });

    jogos.slice(0, 2).forEach((jogo, k) => {
      const xt = xTags + k * (TAG.largura + TAG.vao);
      const passado = quando === "realizados" && jogo.gp !== null;
      caixa(ctx, xt, meio - TAG.altura / 2, TAG.largura, TAG.altura,
            passado ? corDoResultado(jogo.resultado)
                    : jogo.mando === "casa" ? COR.azul : COR.vermelho, 4);
      texto(ctx, passado ? `${jogo.gp}×${jogo.gc}`
                         : jogo.mando === "casa" ? "casa" : "fora",
            xt + TAG.largura / 2, meio + 4,
            { tamanho: passado ? 11.5 : 10, peso: 800,
              maiuscula: !passado, espaco: passado ? 0 : .7,
              alinha: "center", cor: COR.branco });
    });

    if (jogos.length) {
      alvos.push({
        n: `${nomeBonito(clube.equipe)} · ${ordinal(clube.pos)}`,
        x, y: yl, l: largura, a: altura - 1,
        itens: [],
        diferenca: {
          rotulo: jogos.length === 1 ? "1 jogo" : `${jogos.length} jogos`,
          texto: jogos.map((j) => `${j.rodada}ª rodada `
                 + `${j.mando === "casa" ? "em casa" : "fora"}`
                 + (j.gp === null ? "" : ` · ${j.gp}×${j.gc}`)).join(" · "),
          cor: jogos[0].mando === "casa" ? COR.azul : COR.vermelho,
        },
      });
    }
  }
  return alvos;
}
