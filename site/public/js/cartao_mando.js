/**
 * Card: mando de campo — a mesma edição lida três vezes.
 *
 * A tabela geral esconde de onde vieram os pontos. Separar casa e estrada
 * mostra duas coisas que ela não mostra: quem ainda tem jogos em casa na
 * reserva, e quem depende deles para pontuar.
 *
 * Por isso são três classificações lado a lado. A da esquerda é a geral, e as
 * colunas dela não são pontos: são **quantos jogos** cada clube já fez de cada
 * lado. Num campeonato de pontos corridos os dois números terminam iguais, mas
 * no meio do caminho raramente estão, e essa diferença explica boa parte da
 * tabela. As outras duas são a classificação de casa e a de fora, cada uma
 * pelo critério escolhido.
 *
 * Embaixo, o índice de independência do mando: quanto do aproveitamento de
 * casa o clube repete fora. É razão, e não diferença — perder vinte pontos
 * percentuais partindo de 70% não é o mesmo que partindo de 40%.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import { ordenarPor } from "/js/vagas.js";
import {
  jogosPorMando, linhasDeIndependencia, maiorDesequilibrio,
} from "/js/independencia.js";

const percentual = (v) =>
  v === null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")}%`;
const inteiroPorCento = (v) => (v === null ? "—" : `${Math.round(v * 100)}%`);

const LARGURA = { geral: 520, casa: 460, fora: 460 };
const VAO = 24;

export function montarCartao(estado) {
  const { serie, edicao, geral, casa, fora, criterio, destaque, clubes } = estado;
  if (!edicao || !geral?.length) return null;

  const porAproveitamento = criterio === "aproveitamento";
  const tabelas = {
    geral: ordenarPor(geral, criterio),
    casa: ordenarPor(casa, criterio),
    fora: ordenarPor(fora, criterio),
  };
  const jogos = jogosPorMando(casa, fora);
  const desequilibrio = maiorDesequilibrio(jogos);
  const independencia = linhasDeIndependencia(casa, fora);

  const spec = {
    titulo: `Mando de campo na Série ${serie} ${edicao.ano}`,
    subtitulo: porAproveitamento
      ? "Classificações por aproveitamento" : "",
    arquivo: `mando-${serie}-${edicao.ano}-${criterio}`,
    numeros: [],
    nota: "Independência do mando = aproveitamento fora dividido pelo "
        + "aproveitamento em casa. 100% quer dizer que o clube repete fora "
        + "exatamente o que faz em casa; abaixo disso, depende do mando.",
    corpo: async (ctx, y) => {
      const alturaGrafico = 152;
      const topo = y + 26;
      const base = CARD.altura - 88 - alturaGrafico - 24;
      const alturaCabecalho = 20;
      const alturaLinha = (base - topo - alturaCabecalho) / tabelas.geral.length;

      const x = {
        geral: MARGEM,
        casa: MARGEM + LARGURA.geral + VAO,
        fora: MARGEM + LARGURA.geral + LARGURA.casa + VAO * 2,
      };

      const yDaLinha = (posicao) =>
        topo + alturaCabecalho + (posicao - 1) * alturaLinha + alturaLinha / 2;

      await desenharTabela(ctx, {
        linhas: tabelas.geral, x: x.geral, largura: LARGURA.geral,
        titulo: "classificação geral", topo, alturaCabecalho, alturaLinha,
        clubes, destaque,
        colunas: [
          { rotulo: "casa", largura: 88,
            valor: (c) => String(jogos[c.equipe]?.casa ?? 0),
            tom: (c) => tomDoMando(jogos[c.equipe], "casa", desequilibrio) },
          { rotulo: "fora", largura: 88,
            valor: (c) => String(jogos[c.equipe]?.fora ?? 0),
            tom: (c) => tomDoMando(jogos[c.equipe], "fora", desequilibrio) },
        ],
      });

      for (const lado of ["casa", "fora"]) {
        await desenharTabela(ctx, {
          linhas: tabelas[lado], x: x[lado], largura: LARGURA[lado],
          titulo: lado === "casa" ? "só em casa" : "só fora de casa",
          topo, alturaCabecalho, alturaLinha, clubes, destaque,
          colunas: [{
            rotulo: porAproveitamento ? "aprov" : "pts", largura: 118,
            valor: (c) => (porAproveitamento
              ? percentual(c.aproveitamento) : String(c.pts)),
            destaque: true,
          }],
        });
      }

      if (destaque) {
        ligarAsTabelas(ctx, { tabelas, destaque, x, yDaLinha, alturaLinha });
      }

      const alvos = grafico(ctx, {
        independencia, destaque, clubes,
        y: base + 24, altura: alturaGrafico,
      });

      spec.hover = {
        pontos: [...alvosDasTabelas({ tabelas, x, topo, alturaCabecalho,
                                      alturaLinha, jogos, porAproveitamento }),
                 ...alvos],
        eixo: "caixa", unidade: "",
        topo: y, alturaPlot: CARD.altura - 88 - y,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
      };
    },
  };
  return spec;
}

/* -------------------------------------------------------------- tabelas */
/**
 * O tom do número de jogos.
 *
 * Só o lado que já jogou mais ganha fundo, e a intensidade acompanha o tamanho
 * do desequilíbrio dentro daquela edição — num campeonato equilibrado a tabela
 * inteira fica limpa, que é a informação correta.
 */
function tomDoMando(jogo, lado, maior) {
  if (!jogo || !maior) return 0;
  const saldo = lado === "casa" ? jogo.saldo : -jogo.saldo;
  return saldo <= 0 ? 0 : Math.min(1, saldo / maior);
}

async function desenharTabela(ctx, o) {
  const { linhas, x, largura, titulo, topo, alturaCabecalho, alturaLinha,
          colunas, clubes, destaque } = o;

  texto(ctx, titulo, x + 6, topo + 12,
        { tamanho: 10, peso: 700, maiuscula: true, espaco: .9,
          cor: COR.cinzaEscuro });

  const direita = x + largura;
  const posicoes = [];
  let cursor = direita;
  for (const coluna of [...colunas].reverse()) {
    cursor -= coluna.largura;
    posicoes.unshift({ ...coluna, x: cursor, centro: cursor + coluna.largura / 2 });
  }
  for (const coluna of posicoes) {
    texto(ctx, coluna.rotulo, coluna.centro, topo + 12,
          { tamanho: 10, peso: 700, alinha: "center", maiuscula: true,
            espaco: .9, cor: COR.cinzaEscuro });
  }
  linhaH(ctx, x, direita, topo + alturaCabecalho - 3, COR.linha);

  for (const [i, clube] of linhas.entries()) {
    const yLinha = topo + alturaCabecalho + i * alturaLinha;
    const meio = yLinha + alturaLinha / 2;
    const marcado = destaque && clube.equipe === destaque;

    if (marcado) caixa(ctx, x, yLinha, largura, alturaLinha - 1, COR.marca, 4);
    else if (i % 2 === 0) caixa(ctx, x, yLinha, largura, alturaLinha - 1, COR.branco, 4);

    const tinta = marcado ? COR.marcaTexto : COR.azulEscuro;
    texto(ctx, clube.pos, x + 20, meio + 4,
          { tamanho: 12, peso: 800, alinha: "center",
            cor: marcado ? COR.marcaTexto : COR.cinzaTexto });

    const lado = Math.min(20, alturaLinha - 4);
    const escudo = await imagem(clubes?.[clube.equipe]?.escudo);
    desenharEscudo(ctx, escudo, x + 34, meio - lado / 2, lado);

    const sigla = clubes?.[clube.equipe]?.sigla
      ?? nomeBonito(clube.equipe).slice(0, 3).toUpperCase();
    texto(ctx, sigla, x + 62, meio + 4,
          { tamanho: 12.5, peso: 700, cor: tinta });

    for (const coluna of posicoes) {
      const tom = coluna.tom ? coluna.tom(clube) : 0;
      if (tom > 0 && !marcado) {
        ctx.save();
        ctx.globalAlpha = 0.25 + tom * 0.75;
        caixa(ctx, coluna.x + 10, meio - 10, coluna.largura - 20, 20,
              COR.azulLavado, 5);
        ctx.restore();
      }
      texto(ctx, coluna.valor(clube), coluna.centro, meio + 5,
            { tamanho: coluna.destaque ? 13.5 : 13,
              peso: coluna.destaque || tom > 0 ? 800 : 400,
              alinha: "center",
              cor: marcado ? COR.marcaTexto
                 : coluna.destaque || tom > 0 ? COR.azulEscuro : COR.cinzaTexto });
    }
  }
}

/**
 * A linha que costura as três tabelas.
 *
 * Sem ela, achar o mesmo clube em três classificações diferentes é trabalho de
 * conferência. Com ela, a inclinação já conta a história: subindo da geral
 * para a de casa, o clube é melhor em casa do que a tabela sugere.
 */
function ligarAsTabelas(ctx, { tabelas, destaque, x, yDaLinha }) {
  const onde = (nome) => {
    const linha = tabelas[nome].find((c) => c.equipe === destaque);
    return linha ? yDaLinha(linha.pos) : null;
  };
  const yGeral = onde("geral"), yCasa = onde("casa"), yFora = onde("fora");
  if (yGeral === null || yCasa === null || yFora === null) return;

  ctx.save();
  ctx.strokeStyle = COR.marca;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x.geral + LARGURA.geral, yGeral);
  ctx.lineTo(x.casa, yCasa);
  ctx.moveTo(x.casa + LARGURA.casa, yCasa);
  ctx.lineTo(x.fora, yFora);
  ctx.stroke();
  ctx.restore();
}

/* -------------------------------------------------------------- gráfico */
/** Vermelho em quem depende do mando, verde em quem não depende. */
function corDoIndice(indice) {
  if (indice === null) return COR.cinzaClaro;
  const t = Math.min(1, Math.max(0, indice));
  return t < 0.5
    ? mistura(COR.negativo, COR.cinzaEscuro, t * 2)
    : mistura(COR.cinzaEscuro, COR.verde, (t - 0.5) * 2);
}

function mistura(de, para, t) {
  const canal = (cor, i) => parseInt(cor.slice(1 + i * 2, 3 + i * 2), 16);
  const valor = (i) => Math.round(canal(de, i) + (canal(para, i) - canal(de, i)) * t);
  return `rgb(${valor(0)}, ${valor(1)}, ${valor(2)})`;
}

function grafico(ctx, { independencia, destaque, clubes, y, altura }) {
  const largura = CARD.largura - MARGEM * 2;
  const quantos = independencia.length;
  const passo = largura / quantos;
  const larguraBarra = Math.min(48, passo - 10);

  texto(ctx, "independência do mando", MARGEM, y + 2,
        { tamanho: 10, peso: 700, maiuscula: true, espaco: .9,
          cor: COR.cinzaEscuro });

  const base = y + altura - 22;
  const teto = y + 22;
  const maximo = Math.max(1, ...independencia.map((l) => l.indice ?? 0));
  const escala = (v) => base - (v / maximo) * (base - teto);

  // A linha dos 100%: é dela que o gráfico fala, e sem ela cada coluna vira
  // um número solto.
  linhaH(ctx, MARGEM, CARD.largura - MARGEM, escala(1), COR.cinza, 1.5);
  texto(ctx, "100%", CARD.largura - MARGEM, escala(1) - 5,
        { tamanho: 10, peso: 700, alinha: "right", cor: COR.cinzaEscuro });

  const alvos = [];
  independencia.forEach((linha, i) => {
    const cx = MARGEM + passo * (i + 0.5);
    const topoBarra = linha.indice === null ? base - 3 : escala(linha.indice);
    const marcado = destaque && linha.equipe === destaque;

    caixa(ctx, cx - larguraBarra / 2, topoBarra, larguraBarra,
          Math.max(3, base - topoBarra), corDoIndice(linha.indice), 3);
    if (marcado) {
      ctx.save();
      ctx.strokeStyle = COR.marca;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(cx - larguraBarra / 2 - 2, topoBarra - 2,
                    larguraBarra + 4, Math.max(3, base - topoBarra) + 4, 4);
      ctx.stroke();
      ctx.restore();
    }

    texto(ctx, inteiroPorCento(linha.indice), cx, topoBarra - 6,
          { tamanho: 11, peso: 800, alinha: "center",
            cor: marcado ? COR.marca : COR.azulEscuro });

    const sigla = clubes?.[linha.equipe]?.sigla
      ?? nomeBonito(linha.equipe).slice(0, 3).toUpperCase();
    texto(ctx, sigla, cx, base + 15,
          { tamanho: 11, peso: marcado ? 800 : 700, alinha: "center",
            cor: marcado ? COR.marca : COR.cinzaTexto });

    alvos.push({
      n: nomeBonito(linha.equipe),
      x: cx - passo / 2, y: teto - 16, l: passo, a: base - teto + 34,
      itens: [
        { rotulo: "em casa", cor: COR.azul, pontos: linha.casa?.pts ?? 0,
          detalhe: `${percentual(linha.casa?.aproveitamento ?? null)} em `
                 + `${linha.casa?.j ?? 0} jogos` },
        { rotulo: "fora", cor: COR.cinzaEscuro, pontos: linha.fora?.pts ?? 0,
          detalhe: `${percentual(linha.fora?.aproveitamento ?? null)} em `
                 + `${linha.fora?.j ?? 0} jogos` },
      ],
      diferenca: {
        rotulo: inteiroPorCento(linha.indice),
        texto: linha.indice === null ? "sem ponto em casa"
             : linha.indice >= 1 ? "rende igual ou mais fora"
             : "depende do mando",
        cor: corDoIndice(linha.indice),
      },
    });
  });

  return alvos;
}

/* ----------------------------------------------------------------- hover */
function alvosDasTabelas(o) {
  const { tabelas, x, topo, alturaCabecalho, alturaLinha, jogos,
          porAproveitamento } = o;
  const alvos = [];

  const descrever = (clube, nome) => {
    if (nome === "geral") {
      const j = jogos[clube.equipe] ?? { casa: 0, fora: 0 };
      return {
        pontos: clube.pts,
        detalhe: `${j.casa} em casa · ${j.fora} fora · `
               + percentual(clube.aproveitamento),
      };
    }
    return {
      pontos: clube.pts,
      detalhe: `${clube.j} jogos · ${percentual(clube.aproveitamento)}`,
    };
  };

  for (const nome of ["geral", "casa", "fora"]) {
    tabelas[nome].forEach((clube, i) => {
      alvos.push({
        n: nomeBonito(clube.equipe),
        x: x[nome], y: topo + alturaCabecalho + i * alturaLinha,
        l: LARGURA[nome], a: alturaLinha,
        itens: [{
          rotulo: nome === "geral" ? "geral"
                : nome === "casa" ? "só em casa" : "só fora de casa",
          cor: COR.azul, ...descrever(clube, nome),
        }],
        diferenca: {
          rotulo: `${clube.pos}º`,
          texto: porAproveitamento ? "por aproveitamento" : "por pontos",
          cor: COR.cinzaTexto,
        },
      });
    });
  }
  return alvos;
}
