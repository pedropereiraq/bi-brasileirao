/**
 * Card: o calendário da edição — o que já foi jogado e o que falta.
 *
 * Três leituras do mesmo assunto, e é a pendência que costura as três.
 *
 * No alto, uma barra diz quanto do campeonato já aconteceu. Abaixo dela, uma
 * coluna por rodada: cheia quando os dez jogos saíram, pela metade quando
 * sobrou jogo adiado. É o mapa de onde o calendário travou, e clicar numa
 * coluna troca a rodada que a lista de baixo mostra.
 *
 * À direita, a classificação com uma coluna a mais: quantos jogos cada clube
 * tem a mais ou a menos que o número mais comum da tabela. Essa coluna é a
 * resposta para "por que ele está na frente com menos pontos" — e o mouse
 * sobre o clube diz exatamente quais jogos faltam.
 *
 * Zero não ganha cor. Estar em dia é o normal, e pintar o normal faria a
 * coluna inteira parecer informação.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import {
  andamentoDoCampeonato, jogosDaRodada, modaDeJogos, pendentesPorClube,
  resumoDasRodadas,
} from "/js/jogos_rodada.js";

const LARGURA_DIREITA = 336;
const VAO = 32;

const ordinal = (n) => `${n}º`;
const comSinal = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : "0");
const dataBr = (iso) => (iso ? iso.split("-").reverse().slice(0, 2).join("/") : "");
const porCento = (v) => `${(v * 100).toFixed(1).replace(".", ",")}%`;

export function montarCartao(estado) {
  const { serie, edicao, partidas, classificacao, clubes, rodada,
          aoEscolherRodada } = estado;
  if (!edicao || !partidas?.length) return null;

  const rodadas = resumoDasRodadas(partidas);
  const andamento = andamentoDoCampeonato(partidas);
  const moda = modaDeJogos(classificacao);
  const pendentes = pendentesPorClube(partidas);
  const daRodada = jogosDaRodada(partidas, rodada);

  const spec = {
    titulo: `Jogos da Série ${serie} ${edicao.ano}`,
    subtitulo: "",
    arquivo: `jogos-${serie}-${edicao.ano}-r${rodada}`,
    numeros: [],
    nota: `Diferença de jogos = quantos cada clube tem a mais ou a menos que `
        + `${moda}, o número mais comum da tabela.`,
    corpo: async (ctx, y) => {
      const largEsq = CARD.largura - MARGEM * 2 - LARGURA_DIREITA - VAO;
      const xDir = MARGEM + largEsq + VAO;
      const base = CARD.altura - 84;

      barraDeAndamento(ctx, { andamento, x: MARGEM, y: y + 6,
                              largura: CARD.largura - MARGEM * 2 });

      const alvosRodadas = desenharRodadas(ctx, {
        rodadas, rodada, x: MARGEM, y: y + 64, largura: largEsq,
      });

      const alvosJogos = await listaDeJogos(ctx, {
        jogos: daRodada, rodada, clubes, x: MARGEM, y: y + 214,
        largura: largEsq, base,
      });

      const alvosTabela = await classificacaoLateral(ctx, {
        classificacao, clubes, moda, pendentes,
        x: xDir, largura: LARGURA_DIREITA, y: y + 64, base,
      });

      spec.hover = {
        pontos: [...alvosRodadas, ...alvosJogos, ...alvosTabela],
        eixo: "caixa", unidade: "",
        topo: y, alturaPlot: base - y,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
        // Só as colunas de rodada respondem ao clique: é o único alvo que
        // muda o card, e prometer clique no resto seria mentira.
        aoClicar: aoEscolherRodada
          ? (alvo) => { if (alvo.rodada) aoEscolherRodada(alvo.rodada); }
          : undefined,
      };
    },
  };
  return spec;
}

/* ------------------------------------------------------------ andamento */
function barraDeAndamento(ctx, { andamento, x, y, largura }) {
  const altura = 22;
  texto(ctx, "andamento do campeonato", x, y + 2,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });
  texto(ctx, `${andamento.realizados} de ${andamento.total} jogos · `
           + porCento(andamento.fracao),
        x + largura, y + 2,
        { tamanho: 11.5, peso: 700, alinha: "right", cor: COR.azulEscuro });

  caixa(ctx, x, y + 10, largura, altura, COR.cinzaClaro, altura / 2);
  const feito = Math.max(altura, largura * andamento.fracao);
  caixa(ctx, x, y + 10, feito, altura, COR.marca, altura / 2);
}

/* -------------------------------------------------------------- rodadas */
/**
 * Uma coluna por rodada, cheia quando ela fechou.
 *
 * A altura é sempre a mesma — o que varia é o quanto dela está pintado. Barras
 * de alturas diferentes diriam "esta rodada teve menos jogos", e não é isso:
 * toda rodada tem dez, o que muda é quantos já aconteceram.
 */
function desenharRodadas(ctx, { rodadas, rodada, x, y, largura }) {
  texto(ctx, "rodadas", x, y + 2,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });

  const alturaBarra = 96;
  const topo = y + 12;
  const passo = largura / rodadas.length;
  const larguraBarra = Math.min(26, passo - 6);

  const alvos = [];
  for (const [i, r] of rodadas.entries()) {
    const cx = x + passo * (i + 0.5);
    const xb = cx - larguraBarra / 2;
    const escolhida = r.rodada === rodada;

    caixa(ctx, xb, topo, larguraBarra, alturaBarra, COR.cinzaClaro, 4);
    const fracao = r.total ? r.realizados / r.total : 0;
    if (fracao > 0) {
      const alto = alturaBarra * fracao;
      caixa(ctx, xb, topo + alturaBarra - alto, larguraBarra, alto,
            r.completa ? COR.marca : COR.azulMedio, 4);
    }
    if (escolhida) {
      ctx.save();
      ctx.strokeStyle = COR.marca;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(xb - 3, topo - 3, larguraBarra + 6, alturaBarra + 6, 6);
      ctx.stroke();
      ctx.restore();
    }

    // Só os números que cabem: de dois em dois, mais a rodada escolhida.
    if (escolhida || r.rodada === 1 || r.rodada % 2 === 1
        || r.rodada === rodadas.length) {
      texto(ctx, r.rodada, cx, topo + alturaBarra + 16,
            { tamanho: 10.5, peso: escolhida ? 800 : 400, alinha: "center",
              cor: escolhida ? COR.marca : COR.cinzaEscuro });
    }

    alvos.push({
      n: `${ordinal(r.rodada)} rodada`, rodada: r.rodada,
      x: cx - passo / 2, y: topo - 6, l: passo, a: alturaBarra + 28,
      itens: [{
        rotulo: `${ordinal(r.rodada)} rodada`,
        cor: r.completa ? COR.marca : COR.azulMedio,
        pontos: null,
        detalhe: `${r.realizados} de ${r.total} jogos disputados`,
      }],
      diferenca: {
        rotulo: r.completa ? "completa" : `faltam ${r.total - r.realizados}`,
        texto: "clique para ver os jogos",
        cor: r.completa ? COR.verde : COR.cinzaTexto,
      },
    });
  }
  return alvos;
}

/* ---------------------------------------------------------------- jogos */
async function listaDeJogos(ctx, { jogos, rodada, clubes, x, y, largura, base }) {
  texto(ctx, `jogos da ${ordinal(rodada)} rodada`, x, y + 2,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });
  linhaH(ctx, x, x + largura, y + 10, COR.linha);

  if (!jogos.length) {
    texto(ctx, "nenhum jogo nesta rodada", x, y + 40,
          { tamanho: 15, cor: COR.cinza });
    return [];
  }

  const topo = y + 16;
  const alturaLinha = Math.min(56, (base - topo) / jogos.length);
  const sigla = (equipe) => clubes?.[equipe]?.sigla
    ?? nomeBonito(equipe).slice(0, 3).toUpperCase();

  const alvos = [];
  for (const [i, jogo] of jogos.entries()) {
    const yLinha = topo + i * alturaLinha;
    const meio = yLinha + alturaLinha / 2;
    if (i % 2 === 0) caixa(ctx, x, yLinha, largura, alturaLinha - 2, COR.branco, 5);

    texto(ctx, dataBr(jogo.data), x + 14, meio + 5,
          { tamanho: 12.5, peso: 700, cor: COR.cinzaEscuro });

    const lado = Math.min(26, alturaLinha - 10);
    const centro = x + largura * 0.5;

    texto(ctx, sigla(jogo.mandante), centro - 108, meio + 5,
          { tamanho: 14, peso: 800, alinha: "right", cor: COR.azulEscuro });
    desenharEscudo(ctx, await imagem(clubes?.[jogo.mandante]?.escudo),
                   centro - 98, meio - lado / 2, lado);

    if (jogo.realizado) {
      caixa(ctx, centro - 34, meio - 14, 68, 28, COR.marca, 6);
      texto(ctx, `${jogo.gp} × ${jogo.gc}`, centro, meio + 6,
            { tamanho: 15, peso: 800, alinha: "center", cor: COR.marcaTexto });
    } else {
      caixa(ctx, centro - 34, meio - 14, 68, 28, COR.cinzaClaro, 6);
      texto(ctx, "×", centro, meio + 6,
            { tamanho: 15, peso: 800, alinha: "center", cor: COR.cinzaEscuro });
    }

    desenharEscudo(ctx, await imagem(clubes?.[jogo.visitante]?.escudo),
                   centro + 72, meio - lado / 2, lado);
    texto(ctx, sigla(jogo.visitante), centro + 108, meio + 5,
          { tamanho: 14, peso: 800, cor: COR.azulEscuro });

    texto(ctx, jogo.realizado ? "encerrado" : "a jogar", x + largura - 14,
          meio + 5,
          { tamanho: 11, peso: 700, alinha: "right", maiuscula: true,
            espaco: .7, cor: jogo.realizado ? COR.cinzaEscuro : COR.vermelho });

    alvos.push({
      n: `${nomeBonito(jogo.mandante)} × ${nomeBonito(jogo.visitante)}`,
      x, y: yLinha, l: largura, a: alturaLinha - 2,
      itens: [
        { rotulo: nomeBonito(jogo.mandante), cor: COR.azul,
          pontos: jogo.realizado ? jogo.gp : null, detalhe: "em casa" },
        { rotulo: nomeBonito(jogo.visitante), cor: COR.cinzaEscuro,
          pontos: jogo.realizado ? jogo.gc : null, detalhe: "fora" },
      ],
      diferenca: {
        rotulo: dataBr(jogo.data),
        texto: jogo.realizado ? "encerrado" : "ainda por jogar",
        cor: jogo.realizado ? COR.cinzaTexto : COR.vermelho,
      },
    });
  }
  return alvos;
}

/* -------------------------------------------------------- classificação */
function tomDaDiferenca(dif, maior) {
  if (dif === 0 || !maior) return null;
  const t = Math.min(1, Math.abs(dif) / maior);
  const escuro = dif > 0 ? COR.azul : COR.vermelho;
  return {
    fundo: mistura(COR.fundo, escuro, 0.3 + t * 0.7),
    tinta: t > 0.4 ? COR.branco : COR.azulEscuro,
  };
}

function mistura(de, para, t) {
  const canal = (cor, i) => parseInt(cor.slice(1 + i * 2, 3 + i * 2), 16);
  const valor = (i) => Math.round(canal(de, i) + (canal(para, i) - canal(de, i)) * t);
  return `rgb(${valor(0)}, ${valor(1)}, ${valor(2)})`;
}

async function classificacaoLateral(ctx, o) {
  const { classificacao, clubes, moda, pendentes, x, largura, y, base } = o;
  const colunas = [
    { rotulo: "pts", largura: 52 },
    { rotulo: "j", largura: 40 },
    { rotulo: "dif", largura: 54 },
  ];

  texto(ctx, "classificação", x + 4, y + 2,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });

  const direita = x + largura;
  const posicoes = [];
  let cursor = direita;
  for (const coluna of [...colunas].reverse()) {
    cursor -= coluna.largura;
    posicoes.unshift({ ...coluna, x: cursor, centro: cursor + coluna.largura / 2 });
  }
  for (const coluna of posicoes) {
    texto(ctx, coluna.rotulo, coluna.centro, y + 2,
          { tamanho: 9.5, peso: 700, alinha: "center", maiuscula: true,
            espaco: .8, cor: COR.cinzaEscuro });
  }
  linhaH(ctx, x, direita, y + 10, COR.linha);

  const topo = y + 16;
  const alturaLinha = (base - topo) / classificacao.length;
  const maior = Math.max(1, ...classificacao.map((c) => Math.abs(c.j - moda)));

  const alvos = [];
  for (const [i, clube] of classificacao.entries()) {
    const yLinha = topo + i * alturaLinha;
    const meio = yLinha + alturaLinha / 2;
    if (i % 2 === 0) caixa(ctx, x, yLinha, largura, alturaLinha - 1, COR.branco, 4);

    texto(ctx, clube.pos, x + 14, meio + 4,
          { tamanho: 11.5, peso: 800, alinha: "center", cor: COR.cinzaEscuro });

    const lado = Math.min(20, alturaLinha - 6);
    desenharEscudo(ctx, await imagem(clubes?.[clube.equipe]?.escudo),
                   x + 26, meio - lado / 2, lado);

    const sigla = clubes?.[clube.equipe]?.sigla
      ?? nomeBonito(clube.equipe).slice(0, 3).toUpperCase();
    texto(ctx, sigla, x + 52, meio + 4,
          { tamanho: 12, peso: 700, cor: COR.azulEscuro });

    const dif = clube.j - moda;
    const valores = [String(clube.pts), String(clube.j), comSinal(dif)];
    posicoes.forEach((coluna, k) => {
      const tom = k === 2 ? tomDaDiferenca(dif, maior) : null;
      if (tom) {
        const alturaChip = Math.min(22, alturaLinha - 6);
        caixa(ctx, coluna.x + 4, meio - alturaChip / 2, coluna.largura - 8,
              alturaChip, tom.fundo, 5);
      }
      texto(ctx, valores[k], coluna.centro, meio + 4,
            { tamanho: 12, peso: k === 0 || tom ? 800 : 400, alinha: "center",
              cor: tom ? tom.tinta : k === 0 ? COR.azulEscuro : COR.cinzaTexto });
    });

    alvos.push({
      n: nomeBonito(clube.equipe),
      x, y: yLinha, l: largura, a: alturaLinha - 1,
      ...dicaDoClube(clube, dif, pendentes[clube.equipe] ?? [], clubes),
    });
  }
  return alvos;
}

/**
 * A dica do clube lista os jogos que faltam.
 *
 * É a pergunta que a coluna de diferença provoca — "um jogo a menos contra
 * quem?" — e responder no próprio card evita a viagem até a tabela de jogos.
 */
function dicaDoClube(clube, dif, pendentes, clubes) {
  const sigla = (equipe) => clubes?.[equipe]?.sigla
    ?? nomeBonito(equipe).slice(0, 3).toUpperCase();

  const itens = [{
    rotulo: nomeBonito(clube.equipe),
    cor: COR.azul,
    pontos: clube.pts,
    detalhe: `${clube.j} jogos · ${ordinal(clube.pos)} lugar`,
  }];

  for (const jogo of pendentes.slice(0, 4)) {
    itens.push({
      rotulo: `${ordinal(jogo.rodada)} rodada`,
      cor: COR.vermelho,
      pontos: null,
      detalhe: `${jogo.mando === "casa" ? "casa" : "fora"} · `
             + `${sigla(jogo.adversario)} · ${dataBr(jogo.data)}`,
    });
  }

  return {
    itens,
    diferenca: {
      rotulo: comSinal(dif),
      texto: dif === 0 ? "calendário em dia"
           : dif > 0 ? "jogos a mais que a maioria"
           : `${pendentes.length} jogos pendentes`,
      cor: dif === 0 ? COR.cinzaTexto : dif > 0 ? COR.azul : COR.vermelho,
    },
  };
}
