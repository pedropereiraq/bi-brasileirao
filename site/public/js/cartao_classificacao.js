/**
 * Card: a classificação de uma edição, com as vagas pintadas.
 *
 * É a tabela de sempre, e o que ela tem de próprio são duas escolhas que ficam
 * fora dela.
 *
 * A primeira é o critério. Por pontos é a ordem oficial; por aproveitamento é
 * a pergunta de quem tem jogo adiado — quanto vale a campanha por jogo
 * disputado, e não quanto já foi somado. A coluna que manda vira destaque, e a
 * outra continua na tabela, porque a comparação entre as duas é metade da
 * graça.
 *
 * A segunda é o que cada faixa da tabela vale. O regulamento muda de ano para
 * ano, então as fronteiras são filtro; as cores delas, não — verde é vaga boa
 * e vermelho é rebaixamento em qualquer marca, e trocá-las pelo par da
 * identidade faria o card mentir sobre o que mostra.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito, uf } from "/js/nomes.js";
import { marcaAtual } from "/js/marca.js";
import { ordenarPor, zonaDaPosicao, zonasDaSerie } from "/js/vagas.js";

/**
 * As cores das faixas, fixas de propósito.
 *
 * Saem da paleta do ECBahia porque foi de lá que vieram, mas aqui são
 * literais: elas não acompanham a marca, e pedi-las a `COR` faria o verde da
 * Libertadores virar outra coisa quando o card veste o 45.
 */
const COR_DA_FAIXA = {
  verdeEscuro: "#38761D",
  verdeClaro: "#6AA84F",
  azul: "#0B5394",
  cinza: "#8A8A8A",
  vermelho: "#CC4125",
};

const ordinal = (n) => `${n}º`;
const dataBr = (iso) => iso.split("-").reverse().join("/");
const percentual = (v) =>
  v === null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")}%`;

export function montarCartao(estado) {
  const { serie, edicao, classificacao, criterio, limites, recorte } = estado;
  if (!edicao || !classificacao?.length) return null;

  const linhas = ordenarPor(classificacao, criterio);
  const total = linhas.length;
  const porAproveitamento = criterio === "aproveitamento";

  const spec = {
    titulo: `Classificação da Série ${serie} ${edicao.ano}`,
    subtitulo: descreverRecorte({ criterio, recorte, edicao }),
    arquivo: `classificacao-${serie}-${edicao.ano}-${criterio}`,
    numeros: [],
    nota: "",
    corpo: async (ctx, y) => {
      const zonas = zonasDaSerie(serie, limites, total);
      legendaDasVagas(ctx, { zonas, y });

      const topo = y + 34;
      const base = CARD.altura - 84;
      const alturaCabecalho = 26;
      const alturaLinha = (base - topo - alturaCabecalho) / total;

      const colunas = montarColunas(porAproveitamento);
      desenharCabecalho(ctx, { colunas, y: topo, altura: alturaCabecalho });

      const alvos = [];
      for (const [i, clube] of linhas.entries()) {
        const yLinha = topo + alturaCabecalho + i * alturaLinha;
        const zona = zonaDaPosicao(clube.pos, serie, limites, total);
        await desenharLinha(ctx, {
          clube, zona, colunas, indice: i, y: yLinha, altura: alturaLinha,
          clubes: estado.clubes, porAproveitamento,
        });
        alvos.push({
          n: nomeBonito(clube.equipe),
          x: MARGEM, y: yLinha, l: CARD.largura - MARGEM * 2, a: alturaLinha,
          ...dicaDoClube(clube, zona, porAproveitamento),
        });
      }

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo, alturaPlot: base - topo,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
      };
    },
  };
  return spec;
}

/**
 * O recorte vai no subtítulo porque muda o que a tabela é.
 *
 * Uma classificação até a 12ª rodada não é a classificação; sem dizer isso, o
 * card publicado sozinho vira um número errado. Já o critério só aparece
 * quando não é o de sempre: ninguém precisa ler "ordenado por pontos".
 */
function descreverRecorte({ criterio, recorte, edicao }) {
  const partes = [];
  if (criterio === "aproveitamento") partes.push("Classificada por aproveitamento");
  if (recorte?.rodadaDe || recorte?.rodadaAte) {
    const de = recorte.rodadaDe ?? 1;
    const ate = recorte.rodadaAte ?? edicao.rodadas;
    partes.push(de > 1 ? `da ${ordinal(de)} à ${ordinal(ate)} rodada`
                       : `até a ${ordinal(ate)} rodada`);
  }
  if (recorte?.dataDe || recorte?.dataAte) {
    partes.push(recorte.dataDe && recorte.dataAte
      ? `de ${dataBr(recorte.dataDe)} a ${dataBr(recorte.dataAte)}`
      : recorte.dataDe ? `a partir de ${dataBr(recorte.dataDe)}`
      : `até ${dataBr(recorte.dataAte)}`);
  }
  if (!partes.length) return "";
  return partes.join(" · ").replace(/^./, (c) => c.toUpperCase());
}

/* -------------------------------------------------------------- legenda */
function legendaDasVagas(ctx, { zonas, y }) {
  let x = MARGEM;
  for (const zona of zonas) {
    caixa(ctx, x, y + 4, 12, 12, COR_DA_FAIXA[zona.cor], 3);
    const rotulo = zona.de === zona.ate
      ? `${zona.rotulo} · ${ordinal(zona.de)}`
      : `${zona.rotulo} · ${zona.de}º ao ${ordinal(zona.ate)}`;
    texto(ctx, rotulo, x + 18, y + 14,
          { tamanho: 12.5, peso: 700, cor: COR.cinzaTexto });
    ctx.save();
    ctx.font = '700 12.5px "Assistant", sans-serif';
    x += 18 + ctx.measureText(rotulo).width + 26;
    ctx.restore();
  }
}

/* --------------------------------------------------------------- tabela */
/**
 * As colunas, da esquerda para a direita.
 *
 * `destaque` marca a que decide a ordem: ela ganha a pastilha e o corpo maior.
 * A outra continua ali, em tamanho normal — é a comparação entre as duas que
 * responde "está bem colocado ou está com jogo a menos".
 */
function montarColunas(porAproveitamento) {
  const marca = marcaAtual();
  return [
    { chave: "pts", rotulo: "PTS", largura: 108, destaque: !porAproveitamento },
    { chave: "j", rotulo: "J", largura: 74 },
    // "T" de triunfo no ECBahia, "V" de vitória no Podcast45.
    { chave: "t", rotulo: marca.triunfo[0].toUpperCase(), largura: 74 },
    { chave: "e", rotulo: "E", largura: 74 },
    { chave: "d", rotulo: "D", largura: 74 },
    { chave: "gp", rotulo: "GP", largura: 78 },
    { chave: "gc", rotulo: "GC", largura: 78 },
    { chave: "sg", rotulo: "SG", largura: 80 },
    { chave: "aproveitamento", rotulo: "APROV", largura: 122,
      destaque: porAproveitamento },
  ];
}

const LARGURA_POS = 46;
const LARGURA_ESCUDO = 34;

/** O x em que cada coluna numérica termina, medido a partir da direita. */
function posicoesDasColunas(colunas) {
  const fim = CARD.largura - MARGEM - 8;
  const soma = colunas.reduce((s, c) => s + c.largura, 0);
  let x = fim - soma;
  return colunas.map((coluna) => {
    const caixaColuna = { ...coluna, x, centro: x + coluna.largura / 2 };
    x += coluna.largura;
    return caixaColuna;
  });
}

function desenharCabecalho(ctx, { colunas, y, altura }) {
  texto(ctx, "pos", MARGEM + LARGURA_POS / 2, y + altura - 8,
        { tamanho: 10, peso: 700, alinha: "center", maiuscula: true,
          espaco: .9, cor: COR.cinzaEscuro });
  texto(ctx, "time", MARGEM + LARGURA_POS + LARGURA_ESCUDO + 12, y + altura - 8,
        { tamanho: 10, peso: 700, maiuscula: true, espaco: .9,
          cor: COR.cinzaEscuro });

  for (const coluna of posicoesDasColunas(colunas)) {
    texto(ctx, coluna.rotulo, coluna.centro, y + altura - 8,
          { tamanho: 10, peso: 700, alinha: "center", maiuscula: true,
            espaco: .9, cor: coluna.destaque ? COR.azulEscuro : COR.cinzaEscuro });
  }
  linhaH(ctx, MARGEM, CARD.largura - MARGEM, y + altura - 2, COR.linha);
}

async function desenharLinha(ctx, o) {
  const { clube, zona, colunas, indice, y, altura, clubes,
          porAproveitamento } = o;
  const meio = y + altura / 2;
  const largura = CARD.largura - MARGEM * 2;

  if (indice % 2 === 0) caixa(ctx, MARGEM, y, largura, altura - 1, COR.branco, 4);

  // A posição dentro de uma pastilha da cor da faixa: é a cor que responde
  // "isso é vaga de quê", e o número sozinho não responderia.
  const corDaZona = COR_DA_FAIXA[zona.cor];
  const alturaPastilha = Math.min(24, altura - 6);
  caixa(ctx, MARGEM + 4, meio - alturaPastilha / 2, 32, alturaPastilha,
        corDaZona, 5);
  texto(ctx, clube.pos, MARGEM + 20, meio + 5,
        { tamanho: 13.5, peso: 800, alinha: "center", cor: COR.branco });

  const lado = Math.min(26, altura - 4);
  const escudo = await imagem(clubes?.[clube.equipe]?.escudo);
  desenharEscudo(ctx, escudo, MARGEM + LARGURA_POS, meio - lado / 2, lado);

  const xNome = MARGEM + LARGURA_POS + LARGURA_ESCUDO + 12;
  const colunasX = posicoesDasColunas(colunas);
  const cabeNome = colunasX[0].x - xNome - 16;
  const nome = nomeBonito(clube.equipe);
  texto(ctx, cortar(ctx, nome, cabeNome - 34, 15, 700), xNome, meio + 5,
        { tamanho: 15, peso: 700, cor: COR.azulEscuro });

  // O estado atrás do nome desfaz o homônimo — América, Atlético e Botafogo
  // dividem tabela mais de uma vez na história das duas séries.
  ctx.save();
  ctx.font = '700 15px "Assistant", sans-serif';
  const larguraNome = ctx.measureText(cortar(ctx, nome, cabeNome - 34, 15, 700)).width;
  ctx.restore();
  texto(ctx, uf(clube.equipe), xNome + larguraNome + 7, meio + 4,
        { tamanho: 11, peso: 700, cor: COR.cinzaEscuro });

  for (const coluna of colunasX) {
    const valor = coluna.chave === "aproveitamento"
      ? percentual(clube.aproveitamento)
      : coluna.chave === "sg" && clube.sg > 0 ? `+${clube.sg}`
      : String(clube[coluna.chave]);

    if (coluna.destaque) {
      const alturaChip = Math.min(26, altura - 4);
      caixa(ctx, coluna.x + 6, meio - alturaChip / 2, coluna.largura - 12,
            alturaChip, COR.marca, 5);
      texto(ctx, valor, coluna.centro, meio + 6,
            { tamanho: 16, peso: 800, alinha: "center", cor: COR.marcaTexto });
      continue;
    }
    texto(ctx, valor, coluna.centro, meio + 5,
          { tamanho: 14, peso: coluna.chave === "pts" ? 800 : 400,
            alinha: "center",
            cor: coluna.chave === "pts" ? COR.azulEscuro : COR.cinzaTexto });
  }
  void porAproveitamento;
}

/* ----------------------------------------------------------------- hover */
function dicaDoClube(clube, zona, porAproveitamento) {
  const marca = marcaAtual();
  return {
    itens: [{
      rotulo: nomeBonito(clube.equipe),
      cor: COR_DA_FAIXA[zona.cor],
      pontos: clube.pts,
      detalhe: `${clube.j} jogos · ${clube.t} ${clube.t === 1 ? marca.triunfo : marca.triunfos}`
             + ` · ${clube.e} E · ${clube.d} D · ${clube.gp}×${clube.gc}`,
    }],
    diferenca: {
      rotulo: porAproveitamento ? percentual(clube.aproveitamento) : `${clube.pts} pts`,
      texto: `${zona.rotulo} · ${zona.de}º ao ${ordinal(zona.ate)}`,
      cor: COR_DA_FAIXA[zona.cor],
    },
  };
}
