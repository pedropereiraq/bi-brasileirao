/**
 * Card: mando de campo — a mesma edição lida três vezes, e o índice ao lado.
 *
 * A tabela geral esconde de onde vieram os pontos. Separar casa e estrada
 * mostra duas coisas que ela não mostra: quem ainda tem jogos em casa na
 * reserva, e quem depende deles para pontuar.
 *
 * As três listas ficam estreitas de propósito, encostadas à esquerda. Elas são
 * ranking — posição, escudo, sigla e um número —, e ranking não precisa de
 * largura, precisa de altura para caber os vinte. O espaço que sobra vai todo
 * para o índice de independência, em barras horizontais: com vinte clubes, a
 * barra deitada põe o nome de cada um na horizontal e deixa a ordem ser lida
 * de cima para baixo, como qualquer outra lista do card.
 *
 * Azul é casa e vermelho é estrada. Na lista de jogos quem ganha cor é a
 * diferença entre os dois lados, e não cada lado: 14 e 14 são dois números
 * sem assunto, e o assunto é o zero que eles produzem. Azul quando sobrou
 * jogo em casa, vermelho quando sobrou fora, sem preenchimento nenhum quando
 * está equilibrado — um campeonato em dia deixa a coluna limpa, que é a
 * informação correta. Nas listas de pontos o degradê vai do menor valor da
 * coluna ao maior, e a comparação é sempre dentro da própria coluna.
 *
 * Nas duas listas de recorte, a seta diz quantas posições o clube ganha ou
 * perde em relação à geral. É o número que responde de uma vez o que as três
 * listas lado a lado só sugerem — e vale mesmo sem nenhum clube em destaque,
 * quando a linha que costura as tabelas não existe.
 *
 * O índice de independência é o aproveitamento fora dividido pelo de casa. É
 * razão, e não diferença — perder vinte pontos percentuais partindo de 70% não
 * é o mesmo que partindo de 40%.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import { ordenarPor } from "/js/vagas.js";
import {
  jogosPorMando, linhasDeIndependencia, maiorDesequilibrio,
} from "/js/independencia.js";

const percentual = (v) =>
  v === null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")}%`;
const inteiroPorCento = (v) => (v === null ? "—" : `${Math.round(v * 100)}%`);

const LARGURA = { geral: 292, casa: 238, fora: 238 };
const VAO = 14;
const VAO_GRAFICO = 40;

export function montarCartao(estado) {
  const { serie, edicao, geral, casa, fora, criterio, destaque, clubes,
          aoEscolher } = estado;
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
  const naGeral = new Map(tabelas.geral.map((c) => [c.equipe, c.pos]));
  // Subir na tabela é diminuir o número da posição: o sinal inverte para que
  // positivo queira dizer "ganhou posições".
  const variacao = (clube) => {
    const geralPos = naGeral.get(clube.equipe);
    return geralPos === undefined ? null : geralPos - clube.pos;
  };

  // Cada degradê é calibrado dentro da própria coluna: é lá que a comparação
  // acontece, e usar uma escala comum apagaria a variação da menor delas.
  const valorDe = (c) => (porAproveitamento ? c.aproveitamento ?? 0 : c.pts);
  const faixaPontos = {
    casa: extremos(tabelas.casa.map(valorDe)),
    fora: extremos(tabelas.fora.map(valorDe)),
  };

  const spec = {
    titulo: `Mando de campo na Série ${serie} ${edicao.ano}`,
    subtitulo: porAproveitamento ? "Classificações por aproveitamento" : "",
    arquivo: `mando-${serie}-${edicao.ano}-${criterio}`,
    numeros: [],
    nota: "Independência do mando = aproveitamento fora dividido pelo "
        + "aproveitamento em casa. 100% quer dizer que o clube repete fora "
        + "exatamente o que faz em casa; abaixo disso, depende do mando.",
    corpo: async (ctx, y) => {
      const topo = y + 26;
      const base = CARD.altura - 84;
      const alturaCabecalho = 20;
      const alturaLinha = (base - topo - alturaCabecalho) / tabelas.geral.length;

      const x = {
        geral: MARGEM,
        casa: MARGEM + LARGURA.geral + VAO,
        fora: MARGEM + LARGURA.geral + LARGURA.casa + VAO * 2,
      };
      const xGrafico = x.fora + LARGURA.fora + VAO_GRAFICO;

      const formato = (faixa, escuro) => (clube) =>
        degrade(valorDe(clube), faixa, escuro);

      const alvos = [];

      alvos.push(...await desenharTabela(ctx, {
        linhas: tabelas.geral, nome: "geral", x: x.geral, largura: LARGURA.geral,
        titulo: "quantidade de jogos", topo, alturaCabecalho, alturaLinha,
        clubes, destaque,
        colunas: [
          { rotulo: "dif", largura: 60,
            valor: (c) => comSinal(jogos[c.equipe]?.saldo ?? 0),
            pintar: (c) => tomDoSaldo(jogos[c.equipe]?.saldo ?? 0, desequilibrio) },
          { rotulo: "casa", largura: 52,
            valor: (c) => String(jogos[c.equipe]?.casa ?? 0) },
          { rotulo: "fora", largura: 52,
            valor: (c) => String(jogos[c.equipe]?.fora ?? 0) },
        ],
      }));

      for (const lado of ["casa", "fora"]) {
        alvos.push(...await desenharTabela(ctx, {
          linhas: tabelas[lado], nome: lado, x: x[lado], largura: LARGURA[lado],
          titulo: lado === "casa" ? "só em casa" : "só fora de casa",
          topo, alturaCabecalho, alturaLinha, clubes, destaque, variacao,
          colunas: [{
            rotulo: porAproveitamento ? "aprov" : "pts", largura: 72,
            valor: (c) => (porAproveitamento
              ? percentual(c.aproveitamento) : String(c.pts)),
            pintar: formato(faixaPontos[lado],
                            lado === "casa" ? COR.azul : COR.vermelho),
          }],
        }));
      }

      if (destaque) {
        ligarAsTabelas(ctx, { tabelas, destaque, x, topo, alturaCabecalho,
                              alturaLinha });
      }

      alvos.push(...await barras(ctx, {
        independencia, destaque, clubes, x: xGrafico,
        largura: CARD.largura - MARGEM - xGrafico,
        topo, alturaCabecalho, alturaLinha,
      }));

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: y, alturaPlot: CARD.altura - 84 - y,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
        // Clicar num clube em qualquer das quatro listas troca o destaque:
        // achar a sigla no filtro para comparar quatro rankings seria voltar
        // ao começo a cada leitura.
        aoClicar: aoEscolher ? (alvo) => aoEscolher(alvo.equipe) : undefined,
      };
    },
  };
  return spec;
}

/* ------------------------------------------------------------- degradês */
/**
 * Os limites da coluna, sem forçar o zero.
 *
 * Numa coluna que vai de 13 a 15 jogos, esticar a escala até zero deixaria as
 * três tonalidades quase iguais — e é justamente a diferença entre 13 e 15 que
 * o degradê existe para mostrar.
 */
const extremos = (valores) => ({
  minimo: Math.min(...valores),
  maximo: Math.max(...valores),
});

/** "+2", "−1", "0": o sinal é o assunto da coluna. */
const comSinal = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : "0");

/**
 * A cor da diferença entre os dois mandos.
 *
 * Zero não ganha preenchimento: estar em dia é o estado normal de um
 * campeonato de pontos corridos, e pintá-lo faria a coluna inteira parecer
 * informação. Sobrou jogo em casa, azul; sobrou fora, vermelho — a mesma
 * dupla de cores do resto do card.
 */
function tomDoSaldo(saldo, maior) {
  if (saldo === 0 || !maior) return null;
  const t = Math.min(1, Math.abs(saldo) / maior);
  const escuro = saldo > 0 ? COR.azul : COR.vermelho;
  return {
    fundo: mistura(COR.fundo, escuro, 0.25 + t * 0.75),
    tinta: t > 0.4 ? COR.branco : COR.azulEscuro,
  };
}

function mistura(de, para, t) {
  const canal = (cor, i) => parseInt(cor.slice(1 + i * 2, 3 + i * 2), 16);
  const valor = (i) => Math.round(canal(de, i) + (canal(para, i) - canal(de, i)) * t);
  return `rgb(${valor(0)}, ${valor(1)}, ${valor(2)})`;
}

/**
 * O valor virando cor: o menor da coluna quase branco, o maior no tom cheio.
 *
 * A tinta do número acompanha o fundo — em cima do tom cheio ela precisa ser
 * clara, e no quase branco precisa ser escura.
 */
function degrade(valor, { minimo, maximo }, escuro) {
  const t = maximo === minimo ? 1 : (valor - minimo) / (maximo - minimo);
  return {
    fundo: mistura(COR.fundo, escuro, 0.12 + t * 0.88),
    tinta: t > 0.5 ? COR.branco : COR.azulEscuro,
    forca: t,
  };
}

/* -------------------------------------------------------------- tabelas */
async function desenharTabela(ctx, o) {
  const { linhas, nome, x, largura, titulo, topo, alturaCabecalho, alturaLinha,
          colunas, clubes, destaque, variacao } = o;

  texto(ctx, titulo, x + 4, topo + 12,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });

  const direita = x + largura;
  const posicoes = [];
  let cursor = direita;
  for (const coluna of [...colunas].reverse()) {
    cursor -= coluna.largura;
    posicoes.unshift({ ...coluna, x: cursor, centro: cursor + coluna.largura / 2 });
  }
  // Cada coluna diz o que é: sem isto, "14 14" é um par de números soltos.
  for (const coluna of posicoes) {
    texto(ctx, coluna.rotulo, coluna.centro, topo + 12,
          { tamanho: 9.5, peso: 700, alinha: "center", maiuscula: true,
            espaco: .8, cor: COR.cinzaEscuro });
  }
  linhaH(ctx, x, direita, topo + alturaCabecalho - 3, COR.linha);

  const alvos = [];
  for (const [i, clube] of linhas.entries()) {
    const yLinha = topo + alturaCabecalho + i * alturaLinha;
    const meio = yLinha + alturaLinha / 2;
    const marcado = destaque && clube.equipe === destaque;

    if (marcado) caixa(ctx, x - 3, yLinha, largura + 6, alturaLinha - 2, COR.marca, 5);

    texto(ctx, clube.pos, x + 16, meio + 4,
          { tamanho: 12, peso: 800, alinha: "center",
            cor: marcado ? COR.marcaTexto : COR.cinzaEscuro });

    const lado = Math.min(22, alturaLinha - 6);
    const escudo = await imagem(clubes?.[clube.equipe]?.escudo);
    desenharEscudo(ctx, escudo, x + 28, meio - lado / 2, lado);

    const sigla = clubes?.[clube.equipe]?.sigla
      ?? nomeBonito(clube.equipe).slice(0, 3).toUpperCase();
    texto(ctx, sigla, x + 56, meio + 4,
          { tamanho: 12.5, peso: 700,
            cor: marcado ? COR.marcaTexto : COR.azulEscuro });

    if (variacao) {
      desenharVariacao(ctx, {
        valor: variacao(clube), x: posicoes[0].x - 56, meio, marcado,
      });
    }

    for (const coluna of posicoes) {
      // Coluna sem `pintar`, ou com tom nulo, sai como número simples: é o que
      // deixa o degradê significar alguma coisa onde ele existe.
      const tom = coluna.pintar ? coluna.pintar(clube) : null;
      if (tom) {
        const alturaChip = Math.min(24, alturaLinha - 6);
        caixa(ctx, coluna.x + 4, meio - alturaChip / 2, coluna.largura - 8,
              alturaChip, tom.fundo, 5);
      }
      texto(ctx, coluna.valor(clube), coluna.centro, meio + 5,
            { tamanho: 12.5, peso: tom ? 800 : 700, alinha: "center",
              cor: marcado ? COR.marcaTexto
                 : tom ? tom.tinta : COR.cinzaTexto });
    }

    alvos.push({
      n: nomeBonito(clube.equipe), equipe: clube.equipe,
      x: x - 3, y: yLinha, l: largura + 6, a: alturaLinha - 2,
      ...dicaDaLinha(clube, nome),
    });
  }
  return alvos;
}

/**
 * A seta de quantas posições o recorte muda em relação à geral.
 *
 * Verde e vermelho aqui são literais, e não o par da identidade: subir e
 * descer na tabela é o contraste que o leitor já traz de casa, e trocá-lo pelo
 * azul e vermelho da marca tiraria a leitura imediata.
 *
 * Quem não se move fica com um traço: nem seta verde nem vermelha, porque não
 * houve ganho nem perda.
 */
function desenharVariacao(ctx, { valor, x, meio, marcado }) {
  if (valor === null) return;
  const cor = marcado ? COR.marcaTexto
            : valor > 0 ? COR.verde : valor < 0 ? COR.negativo : COR.cinza;

  if (valor === 0) {
    linhaH(ctx, x + 2, x + 12, meio, cor, 2);
    return;
  }

  const sobe = valor > 0;
  ctx.save();
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.moveTo(x + 7, meio + (sobe ? -6 : 6));
  ctx.lineTo(x + 13, meio + (sobe ? 3 : -3));
  ctx.lineTo(x + 1, meio + (sobe ? 3 : -3));
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  texto(ctx, Math.abs(valor), x + 18, meio + 5,
        { tamanho: 12, peso: 800, cor });
}

function dicaDaLinha(clube, nome) {
  const recorte = nome === "geral" ? "no geral"
                : nome === "casa" ? "só em casa" : "só fora de casa";
  return {
    itens: [{
      rotulo: recorte,
      cor: nome === "fora" ? COR.vermelho : COR.azul,
      pontos: clube.pts,
      detalhe: `${clube.j} jogos · ${percentual(clube.aproveitamento)} · `
             + `${clube.t}T ${clube.e}E ${clube.d}D`,
    }],
    diferenca: {
      rotulo: `${clube.pos}º`,
      texto: recorte,
      cor: COR.cinzaTexto,
    },
  };
}

/**
 * A linha que costura as três tabelas.
 *
 * Sem ela, achar o mesmo clube em três classificações diferentes é trabalho de
 * conferência. Com ela, a inclinação já conta a história: subindo da geral
 * para a de casa, o clube é melhor em casa do que a tabela sugere.
 */
function ligarAsTabelas(ctx, o) {
  const { tabelas, destaque, x, topo, alturaCabecalho, alturaLinha } = o;
  const onde = (nome) => {
    const linha = tabelas[nome].find((c) => c.equipe === destaque);
    if (!linha) return null;
    return topo + alturaCabecalho + (linha.pos - 1) * alturaLinha + alturaLinha / 2;
  };

  const yGeral = onde("geral"), yCasa = onde("casa"), yFora = onde("fora");
  if (yGeral === null || yCasa === null || yFora === null) return;

  ctx.save();
  ctx.strokeStyle = COR.marca;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x.geral + LARGURA.geral + 3, yGeral);
  ctx.lineTo(x.casa - 3, yCasa);
  ctx.moveTo(x.casa + LARGURA.casa + 3, yCasa);
  ctx.lineTo(x.fora - 3, yFora);
  ctx.stroke();
  ctx.restore();
}

/* -------------------------------------------------------------- barras */
/** Vermelho em quem depende do mando, verde em quem não depende. */
function corDoIndice(indice) {
  if (indice === null) return COR.cinzaClaro;
  const t = Math.min(1, Math.max(0, indice));
  return t < 0.5
    ? mistura(COR.negativo, COR.cinzaEscuro, t * 2)
    : mistura(COR.cinzaEscuro, COR.verde, (t - 0.5) * 2);
}

async function barras(ctx, o) {
  const { independencia, destaque, clubes, x, largura, topo, alturaCabecalho,
          alturaLinha } = o;

  texto(ctx, "independência do mando", x + 4, topo + 12,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });
  linhaH(ctx, x, x + largura, topo + alturaCabecalho - 3, COR.linha);

  const xTrilho = x + 78;
  const larguraTrilho = largura - 78 - 54;
  const maximo = Math.max(1, ...independencia.map((l) => l.indice ?? 0));
  const escala = (v) => xTrilho + (v / maximo) * larguraTrilho;
  const yBase = topo + alturaCabecalho;
  const yFim = yBase + independencia.length * alturaLinha;

  // A linha dos 100%: é dela que o gráfico fala, e sem ela cada barra vira um
  // número solto.
  ctx.save();
  ctx.strokeStyle = COR.cinza;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(escala(1), yBase - 2);
  ctx.lineTo(escala(1), yFim);
  ctx.stroke();
  ctx.restore();
  texto(ctx, "100%", escala(1), topo + 12,
        { tamanho: 9.5, peso: 700, alinha: "center", cor: COR.cinzaEscuro });

  const alvos = [];
  for (const [i, linha] of independencia.entries()) {
    const yLinha = yBase + i * alturaLinha;
    const meio = yLinha + alturaLinha / 2;
    const marcado = destaque && linha.equipe === destaque;
    const alturaBarra = Math.min(22, alturaLinha - 8);

    if (marcado) {
      caixa(ctx, x - 3, yLinha, largura + 6, alturaLinha - 2, COR.marca, 5);
    }

    const lado = Math.min(22, alturaLinha - 6);
    const escudo = await imagem(clubes?.[linha.equipe]?.escudo);
    desenharEscudo(ctx, escudo, x + 6, meio - lado / 2, lado);

    const sigla = clubes?.[linha.equipe]?.sigla
      ?? nomeBonito(linha.equipe).slice(0, 3).toUpperCase();
    texto(ctx, sigla, x + 34, meio + 4,
          { tamanho: 12.5, peso: 700,
            cor: marcado ? COR.marcaTexto : COR.azulEscuro });

    const fim = linha.indice === null ? xTrilho + 3 : escala(linha.indice);
    caixa(ctx, xTrilho, meio - alturaBarra / 2,
          Math.max(3, fim - xTrilho), alturaBarra, corDoIndice(linha.indice), 4);
    texto(ctx, inteiroPorCento(linha.indice), fim + 8, meio + 5,
          { tamanho: 12.5, peso: 800,
            cor: marcado ? COR.marcaTexto : COR.azulEscuro });

    alvos.push({
      n: nomeBonito(linha.equipe), equipe: linha.equipe,
      x: x - 3, y: yLinha, l: largura + 6, a: alturaLinha - 2,
      itens: [
        { rotulo: "em casa", cor: COR.azul, pontos: linha.casa?.pts ?? 0,
          detalhe: `${percentual(linha.casa?.aproveitamento ?? null)} em `
                 + `${linha.casa?.j ?? 0} jogos` },
        { rotulo: "fora", cor: COR.vermelho, pontos: linha.fora?.pts ?? 0,
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
  }
  return alvos;
}
