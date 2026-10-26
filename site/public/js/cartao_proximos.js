/**
 * Card: os próximos jogos de um grupo de concorrentes diretos.
 *
 * A pergunta da reta final é quem tem a tabela mais dura daqui para a frente,
 * e ela só existe entre quem disputa a mesma coisa — os quatro da briga pela
 * Libertadores, os cinco que fogem do rebaixamento. Por isso o filtro é uma
 * faixa de posições: o card monta uma coluna para cada clube que está nela
 * hoje e põe os calendários lado a lado.
 *
 * A posição do adversário vai numa etiqueta de cor, do vermelho (líder, jogo
 * duro) ao verde (lanterna, jogo fácil). É a cor que faz a coluna ser lida de
 * relance; o número está ali para quem quiser conferir.
 *
 * No rodapé a escala é outra: a média de posição de cada coluna é comparada
 * com a das outras da tela, vermelho na tabela mais dura e verde na mais leve.
 * Entre concorrentes diretos a pergunta nunca é "9,1 é duro?", e sim "quem
 * pegou a pior parte?" — e a cor absoluta deixava oito colunas quase iguais.
 *
 * Abaixo do índice vem a mesma conta partida pelo mando, porque a média geral
 * esconde a metade que decide: tabela dura em casa e leve fora é uma reta
 * final, o contrário é outra, e as duas dão o mesmo número.
 *
 * E o jogo contra alguém que também está na tela ganha uma borda de realce,
 * com a contagem no fim da coluna. Ele vale o dobro na conta: são seis pontos
 * disputados entre dois concorrentes, e não três contra um terceiro. As duas
 * coisas só aparecem até doze colunas — acima disso a coluna fica estreita
 * demais para carregar borda e contagem sem amassar o resto.
 *
 * Com muitos clubes na faixa a coluna estreita, e a linha de jogo cede peça
 * por peça em vez de amassar tudo: o nome inteiro vira sigla, a sigla sai, sai
 * a etiqueta de posição, sai a pílula de mando. O escudo fica até o fim — é o
 * que identifica o adversário sem depender de largura. Quando a etiqueta sai,
 * a cor dela passa para uma tira na borda da linha, que não custa espaço
 * nenhum.
 */
import {
  CARD, COR, MARGEM, texto, caixa, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import { campanhaCompleta } from "/js/grafico_campanha.js";
import {
  cabemConfrontos, clubesNaFaixa, confrontosDiretos, escalaDeDificuldade,
  jogosPorMando, mediaDosAdversarios, proximosJogos, tamanhoDaLista,
} from "/js/proximos_jogos.js";

const POSICOES = 20;
const VAO = 12;
const ALTURA_MINIMA_DO_JOGO = 21;

// O rodapé: o índice, as duas linhas de mando e — quando cabe — a contagem de
// confrontos diretos. Reservar a altura aqui evita a lista crescer e encolher
// conforme o recorte muda de tamanho.
const RODAPE = { comDiretos: 134, semDiretos: 104 };

// Abaixo desta largura a linha de mando perde o "· 3j" e fica só com o rótulo
// e o número: é a mesma lógica da linha de jogo, que cede peça por peça.
const LARGURA_MANDO_COMPLETO = 92;

// As peças da linha de jogo, em largura útil (já com o respiro à direita).
const PECA = { mando: 40, escudo: 26, rotulo: 40, badge: 40 };
const LARGURA_BADGE = 34;
const TAMANHO_DO_ROTULO = 14.5;

const num = (v) => v.toFixed(1).replace(".", ",");
const ordinal = (p) => `${p}º`;

// Vermelho no 1º, cinza no meio da tabela, verde no 20º.
// A ponta verde e o meio cinza saem da paleta: o par vermelho–verde é o que
// o card diz, e o cinza do meio precisa acompanhar o fundo da marca.
const BADGE_VERDE = () => COR.positivo;
const BADGE_MEIO = () => COR.cinzaEscuro;

/** Interpola duas cores hexadecimais. */
function mistura(de, para, t) {
  const canal = (cor, i) => parseInt(cor.slice(1 + i * 2, 3 + i * 2), 16);
  const valor = (i) => Math.round(canal(de, i) + (canal(para, i) - canal(de, i)) * t);
  return `rgb(${valor(0)}, ${valor(1)}, ${valor(2)})`;
}

/**
 * O que cabe numa coluna daquela largura.
 *
 * Os limites são a soma das peças mais os respiros, e cada corte devolve a
 * largura de uma delas. Em vez de contar clubes, mede o que de fato aperta.
 */
function oQueCabe(largura) {
  const cheia = 6 + PECA.mando + PECA.escudo + PECA.rotulo + PECA.badge;
  return {
    sigla: largura >= cheia,
    posicao: largura >= cheia - PECA.rotulo,
    mando: largura >= cheia - PECA.rotulo - PECA.badge,
  };
}

/** O vão entre o escudo e a etiqueta, onde o nome do adversário é escrito. */
function vaoDoRotulo({ largura, cabe, lado, temBadge }) {
  const de = (cabe.posicao ? 6 : 12) + (cabe.mando ? PECA.mando : 12) + lado + 6;
  const ate = largura - 6 - (cabe.posicao && temBadge ? LARGURA_BADGE + 6 : 0);
  return { de, ate };
}

/**
 * O nome inteiro ou as três letras.
 *
 * Com poucos clubes na tela a coluna é larga e o nome cabe — e nome inteiro se
 * lê sem decodificar sigla. A escolha vale para o card todo: metade das
 * colunas com nome e metade com sigla ficaria remendado. E mede o maior nome
 * em jogo em vez de contar clubes, porque "Red Bull Bragantino" e "Vasco" não
 * ocupam o mesmo espaço.
 */
function cabeONomeInteiro(ctx, { nomes, nomesDoTopo, largura, cabe, lado }) {
  if (!cabe.sigla || !nomes.length) return false;
  const vao = vaoDoRotulo({ largura, cabe, lado, temBadge: true });
  const maior = (lista, fonte) => {
    ctx.save();
    ctx.font = fonte;
    const l = Math.max(0, ...lista.map((n) => ctx.measureText(n).width));
    ctx.restore();
    return l;
  };
  return maior(nomes, `800 ${TAMANHO_DO_ROTULO}px "Assistant", sans-serif`)
           <= vao.ate - vao.de - 6
      && maior(nomesDoTopo, '800 17px "Assistant", sans-serif')
           <= largura - 16;
}

/** A rampa da dificuldade: 0 é o jogo mais duro, 1 o mais fácil. */
function corDaFracao(fracao) {
  const t = Math.min(1, Math.max(0, fracao));
  return t < 0.5
    ? mistura(COR.negativo, BADGE_MEIO(), t * 2)
    : mistura(BADGE_MEIO(), BADGE_VERDE(), (t - 0.5) * 2);
}

/** A dificuldade daquele adversário virando cor. */
function corDaPosicao(posicao) {
  return corDaFracao((posicao - 1) / (POSICOES - 1));
}

export function montarCartao(estado) {
  const { serie, edicao, jogos, classificacao, faixa, clubes } = estado;
  if (!jogos || !classificacao?.length) return null;

  const escolhidos = clubesNaFaixa(classificacao, faixa);
  const naTabela = (equipe) => classificacao.find((c) => c.equipe === equipe);
  const posicaoDe = (equipe) => naTabela(equipe)?.pos;

  // Quem está na tela é quem está na faixa: é contra esses que o confronto é
  // direto, e é o tamanho desse grupo que decide se o realce cabe.
  const naTela = escolhidos.map((c) => c.equipe);
  const marcarDiretos = cabemConfrontos(escolhidos.length);

  const colunas = escolhidos.map((clube) => {
    const agenda = campanhaCompleta(jogos, clube.equipe);
    return { clube, agenda, proximos: proximosJogos(agenda) };
  });

  const spec = {
    titulo: `Próximos jogos do ${ordinal(faixa.melhor)} ao `
          + `${ordinal(faixa.pior)} na Série ${serie} ${edicao.ano}`,
    subtitulo: "",
    arquivo: `proximos-${serie}-${faixa.melhor}a${faixa.pior}`,
    numeros: [],
    nota: "",
    corpo: async (ctx, y) => {
      if (!colunas.length) {
        semClubes(ctx, { y, faixa });
        return;
      }
      spec.hover = await colunasDosClubes(ctx, {
        colunas, posicaoDe, naTabela, clubes, naTela, marcarDiretos,
        y: y + 12,
      });
    },
  };
  return spec;
}

function semClubes(ctx, { y, faixa }) {
  texto(ctx, "Nenhum clube nesta faixa.", MARGEM, y + 70,
        { tamanho: 26, peso: 700, cor: COR.azul, familia: "Bree Serif" });
  texto(ctx, `A tabela não tem ninguém entre o ${ordinal(faixa.melhor)} e o `
           + `${ordinal(faixa.pior)} lugar.`,
        MARGEM, y + 108, { tamanho: 16, cor: COR.cinzaTexto });
}

/* ------------------------------------------------------------- colunas */
async function colunasDosClubes(ctx, { colunas, posicaoDe, naTabela,
                                      clubes, naTela, marcarDiretos, y }) {
  const largura =
    (CARD.largura - MARGEM * 2 - VAO * (colunas.length - 1)) / colunas.length;
  const xDaColuna = (i) => MARGEM + i * (largura + VAO);

  const alturaTopo = 104;
  const alturaRodape = marcarDiretos ? RODAPE.comDiretos : RODAPE.semDiretos;
  const disponivel = CARD.altura - 96 - y - alturaTopo - alturaRodape - 16;

  // O teto sai da altura, e não de um número redondo. Com teto fixo em 10, o
  // clube que tem um jogo adiado — e portanto um a mais pela frente — perdia
  // justamente esse jogo, que é o que explica a diferença de calendário.
  const quantos = tamanhoDaLista(colunas.map((c) => c.agenda),
    { teto: Math.floor(disponivel / ALTURA_MINIMA_DO_JOGO) });

  // A lista ocupa a altura que sobrou: com dez jogos pela frente as linhas
  // ficam justas, com três elas crescem e o card não termina no meio.
  const alturaJogo = quantos
    ? Math.min(48, Math.max(ALTURA_MINIMA_DO_JOGO, disponivel / quantos)) : 0;
  const alvos = [];

  const cabe = oQueCabe(largura);
  const lado = Math.min(20, alturaJogo - 8);
  cabe.nome = cabeONomeInteiro(ctx, {
    nomes: colunas.flatMap((c) => c.proximos.slice(0, quantos)
      .map((passo) => nomeBonito(passo.jogo.adversario))),
    nomesDoTopo: colunas.map((c) => nomeBonito(c.clube.equipe)),
    largura, cabe, lado,
  });

  // A dificuldade de cada coluna é lida contra as outras da tela.
  const medias = colunas.map(
    (c) => mediaDosAdversarios(c.proximos, posicaoDe));
  const escala = escalaDeDificuldade(medias);

  const yLista = y + alturaTopo;
  const yRodape = yLista + quantos * alturaJogo + 14;

  // O título do rodapé é o mesmo para todas as colunas: uma vez, à esquerda.
  texto(ctx, "posição média dos adversários", MARGEM, yRodape + 10,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .7,
          cor: COR.cinzaEscuro });
  if (marcarDiretos) {
    texto(ctx, "confrontos diretos", MARGEM, yRodape + 110,
          { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .7,
            cor: COR.destaque });
  }

  for (const [i, coluna] of colunas.entries()) {
    const x = xDaColuna(i);
    await cabecalhoDoClube(ctx, { coluna, clubes, cabe, x, largura, y });

    // Os confrontos diretos desta coluna, pelo número do jogo: é o que a
    // linha consulta para saber se leva borda.
    const diretos = new Set(marcarDiretos
      ? confrontosDiretos(coluna.proximos, naTela).map((p) => p.n) : []);

    for (let k = 0; k < quantos; k++) {
      const passo = coluna.proximos[k];
      const yJogo = yLista + k * alturaJogo;
      caixa(ctx, x, yJogo, largura, alturaJogo - 2,
            k % 2 ? COR.fundo : COR.branco, 4);
      if (!passo) continue;

      const direto = diretos.has(passo.n);
      await linhaDeJogo(ctx, {
        passo, posicao: posicaoDe(passo.jogo.adversario), clubes, cabe, direto,
        x, largura, y: yJogo, altura: alturaJogo - 2,
      });

      alvos.push({
        n: `${nomeBonito(coluna.clube.equipe)} · jogo ${passo.n}`,
        x, y: yJogo, l: largura, a: alturaJogo - 2,
        ...dicaDoJogo(passo, naTabela(passo.jogo.adversario), direto),
      });
    }

    const mando = jogosPorMando(coluna.proximos);
    rodapeDaColuna(ctx, {
      media: medias[i], cor: corDaFracao(escala(medias[i])),
      restantes: coluna.proximos.length,
      mando: {
        casa: { quantos: mando.casa.length,
                media: mediaDosAdversarios(mando.casa, posicaoDe) },
        fora: { quantos: mando.fora.length,
                media: mediaDosAdversarios(mando.fora, posicaoDe) },
      },
      diretos: marcarDiretos ? diretos.size : null,
      x, largura, y: yRodape,
    });
  }

  return {
    pontos: alvos, eixo: "caixa", unidade: "",
    topo: y, alturaPlot: CARD.altura - 96 - y,
    x0: MARGEM, x1: CARD.largura - MARGEM, largura: largura / 2,
  };
}

async function cabecalhoDoClube(ctx, { coluna, clubes, cabe, x, largura,
                                      y }) {
  const { clube } = coluna;
  const centro = x + largura / 2;

  caixa(ctx, x, y, largura, 96, COR.branco, 8);
  ctx.save();
  ctx.strokeStyle = COR.linha;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + .5, y + .5, largura - 1, 95, 8);
  ctx.stroke();
  ctx.restore();

  caixa(ctx, x, y, largura, 20, COR.azul, 8);
  caixa(ctx, x, y + 12, largura, 8, COR.azul, 0);
  texto(ctx, ordinal(clube.pos), centro, y + 15,
        { tamanho: 11.5, peso: 800, alinha: "center", cor: COR.branco,
          maiuscula: true, espaco: .6 });

  const escudo = await imagem(clubes[clube.equipe]?.escudo);
  desenharEscudo(ctx, escudo, centro - 15, y + 26, 30);

  const rotulo = cabe.nome ? nomeBonito(clube.equipe)
    : (clubes[clube.equipe]?.sigla
       ?? nomeBonito(clube.equipe).slice(0, 3).toUpperCase());
  texto(ctx, cortar(ctx, rotulo, largura - 12, 17, 800), centro, y + 76,
        { tamanho: 17, peso: 800, alinha: "center", cor: COR.azulEscuro });
  texto(ctx, `${clube.pts} pts`, centro, y + 91,
        { tamanho: 11, peso: 700, alinha: "center", cor: COR.cinzaEscuro });
}

async function linhaDeJogo(ctx, { passo, posicao, clubes, cabe, direto,
                                  x, largura, y, altura }) {
  const meio = y + altura / 2;
  const emCasa = passo.jogo.mando === "casa";
  const cor = typeof posicao === "number" ? corDaPosicao(posicao) : null;

  // A borda de realce do confronto direto. É um contorno, e não um
  // preenchimento, justamente porque a cor de dentro da linha já está falando
  // de outra coisa — a dificuldade do adversário. Nenhum outro elemento do
  // card é um anel, e é isso que faz a marca ser lida de relance.
  if (direto) {
    ctx.save();
    ctx.strokeStyle = COR.destaque;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, largura - 2, altura - 2, 4);
    ctx.stroke();
    ctx.restore();
  }

  // Sem etiqueta de posição, a cor dela vira uma tira na borda: a dificuldade
  // do jogo é o assunto da coluna e não pode sair junto com o número.
  if (!cabe.posicao && cor) caixa(ctx, x, y, 4, altura, cor, 2);

  const temBadge = cabe.posicao && cor !== null;
  let cursor = x + (cabe.posicao || !cor ? 6 : 12);

  if (cabe.mando) {
    // A pílula tem a mesma largura nos dois casos: casa e fora alternam linha
    // a linha, e larguras diferentes fariam a coluna serrilhar.
    const larguraPilula = PECA.mando - 6;
    caixa(ctx, cursor, meio - 7, larguraPilula, 14,
          emCasa ? COR.azulLavado : COR.cinzaClaro, 4);
    texto(ctx, emCasa ? "casa" : "fora", cursor + larguraPilula / 2, meio + 4,
          { tamanho: 9, peso: 800, alinha: "center", maiuscula: true, espaco: .4,
            cor: emCasa ? COR.azul : COR.cinzaEscuro });
    cursor += PECA.mando;
  } else {
    // Sem a pílula, o mando vira um ponto: azul em casa, vazado fora.
    ctx.save();
    ctx.fillStyle = emCasa ? COR.azul : COR.fundo;
    ctx.strokeStyle = COR.cinza;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cursor + 3, meio, 3, 0, Math.PI * 2);
    if (emCasa) ctx.fill(); else ctx.stroke();
    ctx.restore();
    cursor += 12;
  }

  const lado = Math.min(20, altura - 6);
  const escudo = await imagem(clubes[passo.jogo.adversario]?.escudo);
  desenharEscudo(ctx, escudo, cursor, meio - lado / 2, lado);
  cursor += lado + 6;

  if (cabe.sigla) {
    // Centralizado no vão que sobrou: encostado no escudo, rótulos de
    // tamanhos diferentes deixavam a coluna toda desalinhada.
    const rotulo = cabe.nome ? nomeBonito(passo.jogo.adversario)
      : (clubes[passo.jogo.adversario]?.sigla
         ?? nomeBonito(passo.jogo.adversario).slice(0, 3).toUpperCase());
    const ate = x + largura - 6 - (temBadge ? LARGURA_BADGE + 6 : 0);
    texto(ctx, cortar(ctx, rotulo, ate - cursor, TAMANHO_DO_ROTULO, 800),
          (cursor + ate) / 2, meio + 5,
          { tamanho: TAMANHO_DO_ROTULO, peso: 800, alinha: "center",
            cor: COR.azulEscuro });
  }

  if (!temBadge) return;
  // A etiqueta cresce até onde a linha deixa: é o número que responde se o
  // jogo é duro, e não pode ser o menor tipo do card.
  const alturaBadge = Math.min(22, altura - 4);
  const tamanho = Math.min(14, alturaBadge - 6);
  caixa(ctx, x + largura - 6 - LARGURA_BADGE, meio - alturaBadge / 2,
        LARGURA_BADGE, alturaBadge, cor, 5);
  texto(ctx, posicao, x + largura - 6 - LARGURA_BADGE / 2, meio + tamanho / 2 + 1,
        { tamanho, peso: 800, alinha: "center", cor: COR.branco });
}

function rodapeDaColuna(ctx, { media, cor, restantes, mando, diretos,
                               x, largura, y }) {
  if (media === null) {
    texto(ctx, "sem jogos", x + largura / 2, y + 36,
          { tamanho: 15, peso: 700, alinha: "center", cor: COR.cinza });
    return;
  }
  caixa(ctx, x, y + 16, largura, 30, cor, 6);
  texto(ctx, num(media), x + largura / 2, y + 37,
        { tamanho: 17, peso: 800, alinha: "center", cor: COR.branco });
  texto(ctx, `em ${restantes} ${restantes === 1 ? "jogo" : "jogos"}`,
        x + largura / 2, y + 59,
        { tamanho: 10, alinha: "center", cor: COR.cinzaEscuro });

  linhaDeMando(ctx, { rotulo: "casa", ...mando.casa, x, largura, y: y + 66 });
  linhaDeMando(ctx, { rotulo: "fora", ...mando.fora, x, largura, y: y + 82 });

  if (diretos === null) return;
  caixa(ctx, x, y + 114, largura, 16,
        mistura(COR.branco, COR.destaque, .16), 4);
  texto(ctx, diretos === 0 ? "nenhum"
             : `${diretos} ${diretos === 1 ? "jogo" : "jogos"}`,
        x + largura / 2, y + 125,
        { tamanho: 9.5, peso: 800, alinha: "center", maiuscula: true,
          espaco: .4, cor: COR.destaque });
}

/**
 * A tabela de um lado só: quantos jogos e quanto pesam.
 *
 * Duas linhas finas em vez de duas colunas lado a lado — com dezesseis clubes
 * na tela a metade de uma coluna não comporta rótulo, contagem e número, e
 * empilhado cada linha ainda tem a largura inteira para trabalhar.
 */
function linhaDeMando(ctx, { rotulo, quantos, media, x, largura, y }) {
  const altura = 15;
  const meio = y + altura / 2;
  caixa(ctx, x, y, largura, altura, COR.branco, 3);

  const completo = largura >= LARGURA_MANDO_COMPLETO;
  texto(ctx, completo ? `${rotulo} · ${quantos}j` : rotulo, x + 5, meio + 3.5,
        { tamanho: 9, peso: 700, maiuscula: true, espaco: .5,
          cor: COR.cinzaEscuro });
  texto(ctx, media === null ? "—" : num(media), x + largura - 5, meio + 4,
        { tamanho: 11.5, peso: 800, alinha: "right",
          cor: media === null ? COR.cinza : COR.azulEscuro });
}

const dataBr = (iso) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

function dicaDoJogo(passo, adversario, direto) {
  const emCasa = passo.jogo.mando === "casa";
  const posicao = adversario?.pos;
  return {
    itens: [{
      rotulo: nomeBonito(passo.jogo.adversario),
      cor: typeof posicao === "number" ? corDaPosicao(posicao) : COR.cinzaEscuro,
      // Os pontos do adversário, e não os do dono da coluna: a dica é sobre o
      // jogo que vem, e quem interessa ali é quem vai estar do outro lado.
      pontos: adversario?.pts ?? null,
      // O confronto direto vai na dica porque a borda sozinha não se explica:
      // é aqui que ela ganha nome, sem precisar de nota no rodapé do card.
      detalhe: `${emCasa ? "em casa" : "fora"} · ${dataBr(passo.jogo.data)}`
             + (direto ? " · confronto direto" : ""),
    }],
    diferenca: typeof posicao !== "number" ? null : {
      rotulo: ordinal(posicao),
      texto: `${adversario.j} jogos · posição de hoje`,
      cor: corDaPosicao(posicao),
    },
  };
}
