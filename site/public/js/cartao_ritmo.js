/**
 * Card: quem acelera e quem desacelera, por posição.
 *
 * O sujeito é a posição, e não um clube. O ritmo até a rodada é o do time que
 * estava lá; o ritmo depois é o que a posição rendeu até o fim, e no caminho
 * ela troca de dono várias vezes. Por isso, onde aparece clube, aparecem os
 * dois: quem ocupava a posição na rodada analisada e quem terminou nela.
 *
 * A tabela da esquerda é a resposta inteira em vinte linhas, com a mudança
 * média em barra que cresce para os dois lados do zero. O que a média esconde
 * é a dispersão — diferença perto de zero pode ser posição morna ou metade das
 * edições acelerando e metade freando —, e é isso que o clique abre: a curva
 * do ritmo rodada a rodada, que diz **quando** a posição fica mais cara, e uma
 * barra por edição, que diz **em quantas** delas houve aceleração de verdade.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
  polilinha,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import { extremosDoRitmo, ritmoDasPosicoes, ritmoPorRodada } from "/js/ritmo_posicao.js";

const LARGURA_TABELA = 470;
const VAO = 20;

const ordinal = (p) => `${p}º`;
const num = (v, casas = 2) =>
  (v === null || v === undefined ? "—" : v.toFixed(casas).replace(".", ","));
const comSinal = (v, casas = 2) => (v === null || v === undefined ? "—"
  : `${v > 0 ? "+" : v < 0 ? "−" : ""}${num(Math.abs(v), casas)}`);

function mistura(de, para, t) {
  const canal = (cor, i) => parseInt(cor.slice(1 + i * 2, 3 + i * 2), 16);
  const valor = (i) => Math.round(canal(de, i) + (canal(para, i) - canal(de, i)) * t);
  return `rgb(${valor(0)}, ${valor(1)}, ${valor(2)})`;
}

/** Verde para quem acelerou, vermelho para quem desacelerou. */
const corDaMudanca = (diferenca, extremo) => {
  if (diferenca === null) return COR.cinzaClaro;
  const t = Math.min(1, Math.abs(diferenca) / Math.max(.01, extremo));
  return mistura(COR.fundo, diferenca >= 0 ? COR.verde : COR.negativo, t);
};

export function montarCartao(estado) {
  const { serie, rodada, edicoes, porRodada, posicao, clubes, aoEscolher } = estado;
  if (!rodada || !edicoes?.length) return null;

  const linhas = ritmoDasPosicoes(edicoes, { rodada });
  if (!linhas.some((l) => l.amostras)) return null;

  const { acelera, desacelera } = extremosDoRitmo(linhas);
  const aberta = posicao ? linhas.find((l) => l.posicao === posicao) : null;
  const amostras = Math.max(...linhas.map((l) => l.amostras));

  const spec = {
    titulo: `Quem acelera e quem desacelera na Série ${serie} depois da `
          + `${rodada}ª rodada`,
    subtitulo: "",
    arquivo: `ritmo-${serie}-r${rodada}`,
    numeros: [
      { valor: comSinal(acelera?.diferenca), destaque: "azul",
        nome: acelera ? `quem mais acelera · ${ordinal(acelera.posicao)}`
                      : "quem mais acelera" },
      { valor: comSinal(desacelera?.diferenca),
        nome: desacelera ? `quem mais desacelera · ${ordinal(desacelera.posicao)}`
                         : "quem mais desacelera" },
      { valor: `${amostras}`, nome: "edições encerradas na conta" },
    ],
    nota: `Ritmo é pontos por rodada da posição, e não de um clube: o antes `
        + `é do time que estava ali na ${rodada}ª rodada, o depois é do que `
        + `terminou na mesma posição. Clique para abrir as edições.`,
    corpo: async (ctx, y) => {
      const base = CARD.altura - 84;
      const cheia = CARD.largura - MARGEM * 2;

      const alvos = await tabela(ctx, {
        linhas, posicao: aberta?.posicao, rodada,
        x: MARGEM, largura: aberta ? LARGURA_TABELA : cheia, y, base,
      });

      if (aberta) {
        const x0 = MARGEM + LARGURA_TABELA + VAO;
        alvos.push(...await painel(ctx, {
          linha: aberta, porRodada, rodada, clubes,
          x: x0, largura: CARD.largura - MARGEM - x0, y, base,
        }));
      }

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: y, alturaPlot: base - y,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
        aoClicar: aoEscolher
          ? (alvo) => { if (alvo.posicao) aoEscolher(alvo.posicao); }
          : undefined,
      };
    },
  };
  return spec;
}

/* ------------------------------------------------------------- tabela */
async function tabela(ctx, { linhas, posicao, rodada, x, largura, y, base }) {
  const colunas = {
    posicao: x + 34,
    antes: x + 150,
    depois: x + 250,
    chip: { de: x + 286, ate: x + 356 },
  };
  const barra = largura > 700
    ? { de: x + 380, ate: x + largura - 20 } : null;

  const topo = y + 30;
  const alturaLinha = (base - topo) / linhas.length;
  const extremo = Math.max(.01, ...linhas.map((l) => Math.abs(l.diferenca ?? 0)));

  const cabecalho = (conteudo, xr, alinha = "right") =>
    texto(ctx, conteudo, xr, y + 18,
          { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .7,
            alinha, cor: COR.cinzaEscuro });

  cabecalho("posição", x + 12, "left");
  cabecalho(`ritmo até a ${rodada}ª`, colunas.antes);
  cabecalho("depois", colunas.depois);
  cabecalho("mudança", colunas.chip.ate);
  if (barra) {
    cabecalho("aceleração média · edições em que acelerou",
              (barra.de + barra.ate) / 2, "center");
  }

  const alvos = [];
  for (const [i, linha] of linhas.entries()) {
    const yLinha = topo + i * alturaLinha;
    const meio = yLinha + alturaLinha / 2;
    const marcada = linha.posicao === posicao;

    caixa(ctx, x, yLinha, largura, alturaLinha - 2,
          marcada ? COR.cinzaClaro : i % 2 ? COR.fundo : COR.branco, 4);
    if (marcada) caixa(ctx, x, yLinha, 4, alturaLinha - 2, COR.azul, 2);

    texto(ctx, ordinal(linha.posicao), colunas.posicao, meio + 5,
          { tamanho: 14, peso: 800, alinha: "right", cor: COR.azulEscuro });

    texto(ctx, num(linha.antes), colunas.antes, meio + 5,
          { tamanho: 13, peso: 700, alinha: "right", cor: COR.cinzaTexto });
    texto(ctx, num(linha.depois), colunas.depois, meio + 5,
          { tamanho: 13, peso: 700, alinha: "right", cor: COR.cinzaTexto });

    const l = colunas.chip.ate - colunas.chip.de;
    const forte = Math.abs(linha.diferenca ?? 0) / extremo > .55;
    caixa(ctx, colunas.chip.de, meio - 12, l, 24,
          corDaMudanca(linha.diferenca, extremo), 5);
    texto(ctx, comSinal(linha.diferenca), colunas.chip.de + l / 2, meio + 5,
          { tamanho: 12.5, peso: 800, alinha: "center",
            cor: forte ? COR.branco : COR.azulEscuro });

    // A mudança média em barra, para os dois lados do zero: a mesma
    // informação do número ao lado, na forma em que vinte linhas se comparam
    // de uma olhada. Ao fim dela, em quantas edições a posição acelerou.
    if (barra) {
      const meioBarra = (barra.de + barra.ate) / 2;
      ctx.save();
      ctx.strokeStyle = COR.cinza;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(meioBarra, yLinha + 3);
      ctx.lineTo(meioBarra, yLinha + alturaLinha - 6);
      ctx.stroke();
      ctx.restore();

      const meia = (barra.ate - barra.de) / 2 - 46;
      const comprimento = (Math.abs(linha.diferenca ?? 0) / extremo) * meia;
      const acelerou = (linha.diferenca ?? 0) >= 0;
      caixa(ctx, acelerou ? meioBarra : meioBarra - comprimento, meio - 8,
            Math.max(2, comprimento), 16,
            acelerou ? COR.verde : COR.negativo, 3);
      texto(ctx, `${linha.aceleraram} de ${linha.amostras}`,
            acelerou ? meioBarra + comprimento + 10
                     : meioBarra - comprimento - 10, meio + 4,
            { tamanho: 10.5, peso: 700, alinha: acelerou ? "left" : "right",
              cor: COR.cinzaEscuro });
    }

    alvos.push({
      n: `${ordinal(linha.posicao)} colocado`,
      posicao: linha.posicao,
      x, y: yLinha, l: largura, a: alturaLinha - 2,
      itens: [],
      diferenca: {
        rotulo: comSinal(linha.diferenca),
        texto: `${num(linha.antes)} → ${num(linha.depois)} pontos por rodada `
             + `da posição · ${linha.aceleraram} de ${linha.amostras} edições `
             + `aceleraram`,
        cor: (linha.diferenca ?? 0) >= 0 ? COR.verde : COR.negativo,
      },
    });
  }

  linhaH(ctx, x, x + largura, y + 26, COR.linha);
  return alvos;
}

/* ------------------------------------------------------------- painel */
async function painel(ctx, { linha, porRodada, rodada, clubes, x, largura,
                             y, base }) {
  const alturaCurva = 230;
  const alvos = [];

  curvaDoRitmo(ctx, {
    serie: ritmoPorRodada(porRodada), rodada, x, largura, y, altura: alturaCurva,
    posicao: linha.posicao,
  });
  alvos.push(...await porEdicao(ctx, {
    linha, clubes, x, largura, y: y + alturaCurva + 26, base,
  }));
  return alvos;
}

/**
 * O ritmo médio daquela posição rodada a rodada.
 *
 * É a curva que diz **quando** a posição fica mais cara. A vertical marca a
 * rodada analisada: o que está à direita dela é o "depois" da tabela.
 *
 * Começa na quarta rodada, e não na primeira. Ritmo é acumulado dividido por
 * rodadas, e nas três primeiras ele só pode valer 3, 1,5 ou 1 — números que
 * não dizem nada sobre a posição e esmagam a escala do resto do campeonato,
 * que é onde a curva tem o que mostrar.
 */
function curvaDoRitmo(ctx, { serie, rodada, x, largura, y, altura, posicao }) {
  const calha = 42;
  const plotX = x + calha;
  const plotL = largura - calha;
  const inicio = Math.max(1, Math.min(4, rodada));

  texto(ctx, `ritmo médio do ${ordinal(posicao)} colocado, da ${inicio}ª `
           + `rodada em diante`, x, y + 12,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });

  const validos = serie.filter((p) => p.ritmo !== null && p.rodada >= inicio);
  if (validos.length < 2) return;

  const topo = y + 30;
  const fundo = y + altura;
  const alto = Math.max(...validos.map((p) => p.ritmo));
  const baixo = Math.min(...validos.map((p) => p.ritmo));
  const vao = Math.max(.05, alto - baixo);
  const ultima = serie.at(-1)?.rodada ?? 38;
  const xDe = (r) => plotX + ((r - inicio) / Math.max(1, ultima - inicio)) * plotL;
  const yDe = (v) => fundo - ((v - baixo) / vao) * (fundo - topo);

  for (const marca of [baixo, (baixo + alto) / 2, alto]) {
    const ym = yDe(marca);
    linhaH(ctx, plotX, plotX + plotL, ym, COR.linha);
    texto(ctx, num(marca), plotX - 8, ym + 4,
          { tamanho: 10, peso: 700, alinha: "right", cor: COR.cinzaEscuro });
  }

  ctx.save();
  ctx.strokeStyle = COR.cinza;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(xDe(rodada), topo - 6);
  ctx.lineTo(xDe(rodada), fundo);
  ctx.stroke();
  ctx.restore();
  texto(ctx, `${rodada}ª`, xDe(rodada), topo - 10,
        { tamanho: 10, peso: 800, alinha: "center", cor: COR.cinzaEscuro });

  polilinha(ctx, validos.map((p) => [xDe(p.rodada), yDe(p.ritmo)]), COR.azul, 3);
  for (const r of [inicio, Math.round((inicio + ultima) / 2), ultima]) {
    texto(ctx, r, xDe(r), fundo + 16,
          { tamanho: 10, alinha: "center", cor: COR.cinzaEscuro });
  }
}

/**
 * Uma barra por edição, para os dois lados do zero.
 *
 * A média diz o que costuma acontecer; esta faixa diz em quantas edições
 * aconteceu. Diferença média perto de zero pode ser posição morna ou pode ser
 * metade das edições acelerando e metade freando — e as duas coisas não se
 * parecem nada aqui.
 */
async function porEdicao(ctx, { linha, clubes, x, largura, y, base }) {
  texto(ctx, `edição a edição: ${linha.aceleraram} aceleraram, `
           + `${linha.desaceleraram} desaceleraram`, x, y + 12,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });

  const lista = [...linha.porEdicao].sort((a, b) => a.ano - b.ano);
  if (!lista.length) return [];

  const topo = y + 28;
  const passo = largura / lista.length;
  const extremo = Math.max(.1, ...lista.map((e) => Math.abs(e.diferenca)));
  const meio = topo + (base - 30 - topo) / 2;
  const escala = ((base - 30 - topo) / 2 - 16) / extremo;

  linhaH(ctx, x, x + largura, meio, COR.linha);

  const alvos = [];
  for (const [i, edicao] of lista.entries()) {
    const cx = x + (i + 0.5) * passo;
    const altura = Math.abs(edicao.diferenca) * escala;
    const acelerou = edicao.diferenca >= 0;
    const l = Math.min(34, passo - 8);

    caixa(ctx, cx - l / 2, acelerou ? meio - altura : meio, l, Math.max(2, altura),
          acelerou ? COR.verde : COR.negativo, 3);

    // Os dois donos da posição: quem estava nela na rodada e quem terminou
    // nela. Quando são o mesmo clube, um escudo só — ele ficou o caminho todo.
    const mesmos = edicao.equipeFim === edicao.equipe;
    const lado = Math.min(20, (passo - 12) / (mesmos ? 1 : 2));
    const yEscudos = acelerou ? meio - altura - lado - 6 : meio + altura + 6;
    const donos = mesmos ? [edicao.equipe] : [edicao.equipe, edicao.equipeFim];
    const larguraDonos = donos.length * lado + (donos.length - 1) * 3;
    for (const [k, dono] of donos.entries()) {
      desenharEscudo(ctx, await imagem(clubes?.[dono]?.escudo),
                     cx - larguraDonos / 2 + k * (lado + 3), yEscudos, lado);
    }

    texto(ctx, edicao.ano, cx, base - 10,
          { tamanho: 10, peso: 700, alinha: "center", cor: COR.cinzaEscuro });

    alvos.push({
      n: `${edicao.ano}`,
      x: cx - passo / 2, y: topo, l: passo, a: base - 20 - topo,
      itens: [
        { rotulo: nomeBonito(edicao.equipe), cor: COR.azul,
          pontos: edicao.pontos, detalhe: "estava na posição nesta rodada" },
        { rotulo: nomeBonito(edicao.equipeFim ?? edicao.equipe),
          cor: COR.cinzaEscuro, pontos: edicao.pontosFim,
          detalhe: "terminou a edição nesta posição" },
      ],
      diferenca: {
        rotulo: comSinal(edicao.diferenca),
        texto: `${num(edicao.antes)} → ${num(edicao.depois)} pontos por rodada`,
        cor: acelerou ? COR.verde : COR.negativo,
      },
    });
  }
  return alvos;
}
