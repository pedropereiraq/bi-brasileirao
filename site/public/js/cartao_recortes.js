/**
 * Card: o retrato da largada de um clube, edição por edição.
 *
 * "Este começo é bom?" é uma pergunta sem resposta no abstrato. Ela só se
 * responde com as próprias edições anteriores do clube ao lado, no mesmo ponto
 * da campanha — e é isso que o card põe lado a lado: quantos pontos ele tinha
 * depois de N jogos em cada ano, e, pontilhado, o que aquilo virou no fim.
 *
 * A ordem é do melhor começo para o pior, não a cronológica. O assunto é onde
 * este começo se encaixa entre os começos anteriores; o ano fica em cada linha.
 */
import { CARD, COR, MARGEM, texto, caixa, linhaH } from "/js/cartao.js";
import { nomeBonito, artigoDefinido } from "/js/nomes.js";
import {
  recortesDoClube, resumoDosRecortes,
} from "/js/recorte_inicial.js";
import { zonaDaPosicao, zonasDaFaixa } from "/js/similares.js";

const POSICOES = 20;
const ALTURA_LINHA = 40;
const ALTURA_MINIMA = 22;

const num = (v) => v.toFixed(1).replace(".", ",");
const ordinal = (p) => `${p}º`;

/** Verde acima, cinza no meio, vermelho abaixo — como na tela de semelhantes. */
function coresDasZonas(faixa) {
  const zonas = zonasDaFaixa(faixa, POSICOES);
  if (zonas.length >= 3) {
    return { acima: COR.verde, dentro: COR.cinzaEscuro, abaixo: COR.vermelho };
  }
  if (zonas.length === 2) {
    return { [zonas[0].nome]: COR.verde, [zonas[1].nome]: COR.vermelho };
  }
  return { [zonas[0].nome]: COR.cinzaEscuro };
}

export function montarCartao(estado) {
  const { serie, equipe, jogos, faixa, clubes, campanhas } = estado;
  if (!campanhas || !equipe || !jogos) return null;

  const recortes = recortesDoClube(campanhas, { serie, equipe, jogos });
  const resumo = resumoDosRecortes(recortes);
  const cores = coresDasZonas(faixa);
  const nome = nomeBonito(equipe);
  const artigo = artigoDefinido(equipe);

  const spec = {
    titulo: `${artigo.toLocaleUpperCase("pt-BR")} ${nome} após ${jogos} `
          + `${jogos === 1 ? "jogo" : "jogos"} na Série ${serie}`,
    subtitulo: "",
    escudo: clubes?.[equipe]?.escudo,
    arquivo: `recortes-${nome}-${serie}-${jogos}jogos`,
    numeros: [],
    nota: "",
    corpo: async (ctx, y) => {
      if (!recortes.length) {
        semEdicoes(ctx, { y, nome, artigo, serie, jogos });
        return;
      }
      resumoEnxuto(ctx, { resumo, jogos, y });
      linhaH(ctx, MARGEM, CARD.largura - MARGEM, y + 76, COR.linha);
      spec.hover = await linhasDasEdicoes(ctx, {
        recortes, faixa, cores, jogos, y: y + 102,
      });
    },
  };
  return spec;
}

function semEdicoes(ctx, { y, nome, artigo, serie, jogos }) {
  texto(ctx, `Nenhuma edição com ${jogos} jogos disputados.`, MARGEM, y + 70,
        { tamanho: 26, peso: 700, cor: COR.azul, familia: "Bree Serif" });
  texto(ctx, `${artigo} ${nome} não chegou a esse ponto em nenhuma Série `
           + `${serie} do recorte que o BI cobre.`,
        MARGEM, y + 108, { tamanho: 16, cor: COR.cinzaTexto });
}

/* ------------------------------------------------------------- resumo */
function resumoEnxuto(ctx, { resumo, jogos, y }) {
  // A posição final média saiu: cada linha do card já traz a posição daquela
  // edição, e a média delas não diz nada que a coluna de etiquetas não diga.
  const itens = [
    { valor: resumo.total, nome: "edições nesta série", cor: COR.azul },
    { valor: num(resumo.mediaNoCorte), nome: `pontos em média em ${jogos} jogos`,
      cor: COR.azulEscuro },
  ];

  const largura = 244, altura = 56;
  itens.forEach((item, i) => {
    const x = MARGEM + i * (largura + 14);
    caixa(ctx, x, y, largura, altura, COR.branco, 7);
    ctx.save();
    ctx.strokeStyle = COR.linha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + .5, y + .5, largura - 1, altura - 1, 7);
    ctx.stroke();
    ctx.restore();
    caixa(ctx, x, y + 8, 4, altura - 16, item.cor, 2);

    texto(ctx, item.valor, x + 16, y + 30, { tamanho: 24, peso: 800, cor: item.cor });
    texto(ctx, item.nome, x + 16, y + 46,
          { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
            cor: COR.cinzaEscuro });
  });
}

/* ----------------------------------------------------- uma linha por ano */
const X_ANO = MARGEM;
const X_BARRA = MARGEM + 62;
const X_FIM_BARRA = 1300;
const X_PONTOS_FIM = 1384;
const X_TAG = 1404;
const LARGURA_TAG = 76;

async function linhasDasEdicoes(ctx, { recortes, faixa, cores, jogos, y }) {
  const disponivel = CARD.altura - 96 - y;
  const altura = Math.min(ALTURA_LINHA,
                          Math.max(ALTURA_MINIMA, disponivel / recortes.length));
  const larguraBarra = X_FIM_BARRA - X_BARRA;
  const maximo = Math.max(...recortes.map((r) => r.pontosFim), 1);
  const escala = (v) => (v / maximo) * larguraBarra;
  // A bolinha da pontuação é maior que a barra, mas não pode encostar na linha
  // de cima nem na de baixo: o raio sai da altura da linha.
  const raio = Math.min(14, altura / 2 - 1);

  cabecalho(ctx, { jogos, y: y - 12 });

  const pontosDoHover = [];

  for (const [i, recorte] of recortes.entries()) {
    const yLinha = y + i * altura;
    const meio = yLinha + altura / 2;
    const cor = recorte.encerrada
      ? cores[zonaDaPosicao(recorte.posFim, faixa)] ?? COR.cinzaEscuro
      : COR.azul;

    // A edição em andamento é a que motiva a pergunta: fica com fundo próprio.
    if (!recorte.encerrada) {
      caixa(ctx, X_ANO - 8, yLinha + 1, CARD.largura - MARGEM * 2 + 16,
            altura - 2, COR.azulLavado, 6);
    }

    texto(ctx, recorte.ano, X_ANO, meio + 5,
          { tamanho: 15, peso: 800, cor: COR.azulEscuro });

    // Trilho até o máximo, para as barras serem comparáveis entre si.
    caixa(ctx, X_BARRA, meio - 6, larguraBarra, 12, COR.cinzaClaro, 6);
    const cheio = Math.max(4, escala(recorte.pontosNoCorte));
    caixa(ctx, X_BARRA, meio - 6, cheio, 12, cor, 6);

    // A pontuação do corte vai numa bolinha na ponta da barra, e não dentro
    // dela: assim o número cresce sem engrossar a barra, que é o que dá a
    // proporção entre as edições.
    const centro = X_BARRA + Math.max(cheio, raio);

    // O que veio depois do corte, pontilhado até a pontuação final. Só nas
    // edições encerradas: na que está em curso não há "depois" ainda.
    if (recorte.encerrada && recorte.pontosFim > recorte.pontosNoCorte) {
      ctx.save();
      ctx.strokeStyle = cor;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.setLineDash([0.1, 8]);
      ctx.beginPath();
      ctx.moveTo(centro + raio + 7, meio);
      ctx.lineTo(X_BARRA + escala(recorte.pontosFim), meio);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.arc(centro, meio, raio, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    texto(ctx, recorte.pontosNoCorte, centro, meio + raio * 0.37,
          { tamanho: raio * 1.08, peso: 800, alinha: "center", cor: COR.branco });

    texto(ctx, recorte.pontosFim, X_PONTOS_FIM, meio + 5,
          { tamanho: 15, peso: 800, alinha: "right",
            cor: recorte.encerrada ? COR.azulEscuro : COR.cinzaEscuro });

    etiquetaDaPosicao(ctx, { recorte, cor, y: meio - 9 });

    pontosDoHover.push({
      n: recorte.ano,
      x: X_ANO - 8, y: yLinha, l: CARD.largura - MARGEM * 2 + 16, a: altura,
      ...dicaDoRecorte(recorte, { cor, jogos }),
    });
  }

  return {
    pontos: pontosDoHover, unidade: "", eixo: "caixa",
    topo: y, alturaPlot: recortes.length * altura,
    x0: MARGEM, x1: CARD.largura - MARGEM, largura: altura / 2,
  };
}

function cabecalho(ctx, { jogos, y }) {
  const rotulo = (t, x, alinha) =>
    texto(ctx, t, x, y, { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
                          cor: COR.cinzaEscuro, alinha });
  rotulo("ano", X_ANO, "left");
  rotulo(`pontos em ${jogos} jogos · e até o fim`, X_BARRA, "left");
  rotulo("fim", X_PONTOS_FIM, "right");
  rotulo("posição", X_TAG + LARGURA_TAG, "right");
}

function etiquetaDaPosicao(ctx, { recorte, cor, y }) {
  if (!recorte.encerrada) {
    // Sem desfecho não há posição final. Etiqueta vazada para não parecer uma.
    ctx.save();
    ctx.strokeStyle = COR.cinza;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(X_TAG, y, LARGURA_TAG, 18, 5);
    ctx.stroke();
    ctx.restore();
    texto(ctx, "em curso", X_TAG + LARGURA_TAG / 2, y + 13,
          { tamanho: 10, peso: 700, alinha: "center", cor: COR.cinzaEscuro });
    return;
  }
  caixa(ctx, X_TAG, y, LARGURA_TAG, 18, cor, 5);
  texto(ctx, `${ordinal(recorte.posFim)} lugar`, X_TAG + LARGURA_TAG / 2, y + 13,
        { tamanho: 11, peso: 800, alinha: "center", cor: COR.branco });
}

const pct = (v) => `${(v * 100).toFixed(1).replace(".", ",")}%`;
const variacao = (v) => (v === null ? "sem variação"
  : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(0)}%`);

function dicaDoRecorte(recorte, { cor, jogos }) {
  const detalhe = recorte.encerrada
    ? `${recorte.depois} pontos nos ${recorte.jogosDepois} jogos seguintes`
    : `${recorte.jogosTotais} jogos até agora — edição em andamento`;

  return {
    itens: [{
      // O ano já é o título da dica; repeti-lo aqui seria dizer duas vezes.
      rotulo: `${recorte.pontosNoCorte} em ${jogos} jogos`,
      cor,
      pontos: recorte.pontosFim,
      detalhe,
    }],
    diferenca: recorte.aproveitaDepois === null ? null : {
      rotulo: variacao(recorte.variacao),
      texto: `aproveitamento ${pct(recorte.aproveitaAntes)} → `
           + `${pct(recorte.aproveitaDepois)}`,
      cor: (recorte.variacao ?? 0) > 0 ? COR.azul
         : (recorte.variacao ?? 0) < 0 ? COR.vermelho : COR.cinzaEscuro,
    },
  };
}
