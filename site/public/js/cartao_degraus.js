/**
 * Card: as distâncias de cada clube para o que vem logo abaixo.
 *
 * A classificação é lida como uma fila, mas é uma escada de degraus muito
 * desiguais. O 4º com seis pontos de sobra e o 4º empatado com o 5º ocupam a
 * mesma linha da tabela e não são a mesma situação. As duas visões desta tela
 * atacam isso por lados diferentes:
 *
 * **Escada** (uma rodada): posição no eixo x, pontuação no y, cada clube num
 * degrau na altura do que tem. A distância deixa de ser número e vira queda, e
 * degrau plano é empate de pontos.
 *
 * O lanterna fica à esquerda e o líder à direita, com a escada subindo: é o
 * sentido em que se sobe uma escada, e a altura passa a valer o que vale na
 * tabela — quem está mais alto está melhor.
 *
 * **Matriz** (a edição inteira): uma linha por degrau, uma coluna por rodada.
 * Mostra quando cada vão se abriu — o que nenhuma tabela de uma rodada só
 * pode dizer.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import {
  amplitudeDaTabela, degrausDaColuna, maiorDaSerie, maiorDegrau,
  niveisDePontos, serieDeDegraus,
} from "/js/degraus_tabela.js";

const ordinal = (p) => `${p}º`;
const plural = (n, um, muitos) => `${n} ${n === 1 ? um : muitos}`;

function mistura(de, para, t) {
  const canal = (cor, i) => parseInt(cor.slice(1 + i * 2, 3 + i * 2), 16);
  const valor = (i) => Math.round(canal(de, i) + (canal(para, i) - canal(de, i)) * t);
  return `rgb(${valor(0)}, ${valor(1)}, ${valor(2)})`;
}

export function montarCartao(estado) {
  return estado.modo === "serie" ? cartaoDaSerie(estado) : cartaoDaRegua(estado);
}

/* ================================================================ escada */
function cartaoDaRegua(estado) {
  const { serie, edicao, rodada, coluna, clubes } = estado;
  if (!edicao || !coluna?.length) return null;

  const degraus = degrausDaColuna(coluna);
  const niveis = niveisDePontos(coluna);
  const maior = maiorDegrau(degraus);
  const empatados = degraus.filter((d) => d.distancia === 0).length;

  const spec = {
    titulo: `Distâncias na tabela da Série ${serie} ${edicao.ano} na `
          + `${rodada}ª rodada`,
    subtitulo: "A tabela como escada: a altura de cada degrau é a distância "
             + "para a equipe de baixo",
    arquivo: `degraus-${serie}-${edicao.ano}-r${rodada}`,
    numeros: [
      { valor: `${maior?.distancia ?? 0}`, destaque: "azul",
        nome: maior ? `maior degrau · do ${ordinal(maior.posicao)} para o `
                    + `${ordinal(maior.posicao + 1)}` : "maior degrau" },
      { valor: `${amplitudeDaTabela(coluna)}`, nome: "do líder ao lanterna" },
      { valor: `${niveis.length}`, nome: "patamares de pontuação" },
      { valor: `${empatados}`,
        nome: empatados === 1 ? "degrau zerado" : "degraus zerados" },
    ],
    nota: `Cada clube ocupa um degrau na altura da própria pontuação. Degrau `
        + `plano é empate de pontos — os dois estão na mesma altura, e só o `
        + `desempate do regulamento decide quem fica em cima.`,
    corpo: async (ctx, y) => {
      const base = CARD.altura - 84;
      const x0 = MARGEM + 34;
      const x1 = CARD.largura - MARGEM - 10;
      const passo = (x1 - x0) / coluna.length;

      const alto = coluna[0].pontos;
      const baixo = coluna.at(-1).pontos;
      const vao = Math.max(1, alto - baixo);

      const ladoEscudo = Math.min(40, passo - 22);
      const yTopo = y + 30 + ladoEscudo;
      const yBase = base - 56;
      const yDe = (pontos) => yBase - ((pontos - baixo) / vao) * (yBase - yTopo);

      // O primeiro colocado à direita, no alto da escada.
      const centro = (i) => x1 - (i + 0.5) * passo;

      // A régua de pontos à esquerda: sem ela a escada é uma silhueta bonita
      // sem escala, e o degrau de um ponto parece igual ao de oito.
      for (const marca of marcasDoEixo(baixo, alto)) {
        const ym = yDe(marca);
        linhaH(ctx, x0 - 8, x1, ym, COR.linha);
        texto(ctx, marca, x0 - 14, ym + 4,
              { tamanho: 10, peso: 700, alinha: "right", cor: COR.cinzaEscuro });
      }
      void 0;

      const alvos = [];
      for (const [i, clube] of coluna.entries()) {
        const xc = centro(i);
        const yc = yDe(clube.pontos);
        const de = xc - passo / 2;
        const xq = de; // a queda para o próximo acontece na borda esquerda

        // O piso do degrau, da borda da coluna à outra: é ele que faz a
        // escada, e é sobre ele que o escudo se apoia.
        ctx.save();
        ctx.strokeStyle = COR.azul;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(de + 3, yc);
        ctx.lineTo(de + passo - 3, yc);
        ctx.stroke();
        ctx.restore();

        desenharEscudo(ctx, await imagem(clubes?.[clube.equipe]?.escudo),
                       xc - ladoEscudo / 2, yc - ladoEscudo - 7, ladoEscudo);

        texto(ctx, clube.pontos, xc, yc + 20,
              { tamanho: 13, peso: 800, alinha: "center", cor: COR.azulEscuro });
        texto(ctx, ordinal(clube.posicao), xc, yBase + 36,
              { tamanho: 11.5, peso: 700, alinha: "center",
                cor: COR.cinzaEscuro });

        // A queda para o próximo, desenhada onde ela acontece.
        const abaixo = coluna[i + 1];
        if (abaixo) {
          const yProximo = yDe(abaixo.pontos);
          ctx.save();
          ctx.strokeStyle = COR.cinza;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(xq, yc);
          ctx.lineTo(xq, yProximo);
          ctx.stroke();
          ctx.restore();

          etiquetaDoDegrau(ctx, xq, (yc + yProximo) / 2,
                           clube.pontos - abaixo.pontos, maior?.distancia ?? 1);
        }

        alvos.push({
          n: nomeBonito(clube.equipe),
          x: de, y: yTopo - ladoEscudo - 12, l: passo,
          a: yBase + 44 - (yTopo - ladoEscudo - 12),
          itens: [],
          diferenca: {
            rotulo: `${clube.pontos} pts`,
            texto: dicaDoClube(clube, degraus),
            cor: COR.azul,
          },
        });
      }

      texto(ctx, "pontos", x0 - 14, yTopo - ladoEscudo - 6,
            { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
              alinha: "right", cor: COR.cinzaEscuro });

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: y, alturaPlot: base - y,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
      };
    },
  };
  return spec;
}

/**
 * As linhas de referência do eixo: cinco marcas redondas dentro da faixa.
 *
 * O passo sai do tamanho da faixa para não virar um pente quando a tabela está
 * embolada nem uma linha só quando ela está esticada.
 */
function marcasDoEixo(baixo, alto) {
  const vao = Math.max(1, alto - baixo);
  const passo = Math.max(1, Math.round(vao / 5));
  const marcas = [];
  for (let v = Math.ceil(baixo / passo) * passo; v <= alto; v += passo) {
    marcas.push(v);
  }
  return marcas;
}

function dicaDoClube(clube, degraus) {
  const meu = degraus.find((d) => d.equipe === clube.equipe);
  if (!meu) return "lanterna: não há ninguém abaixo";
  if (meu.distancia === 0) {
    return `empatado com ${nomeBonito(meu.abaixo.equipe)}, logo abaixo`;
  }
  return `${plural(meu.distancia, "ponto", "pontos")} à frente de `
       + `${nomeBonito(meu.abaixo.equipe)}`;
}

/** A etiqueta da queda, mais forte quanto maior o degrau. */
function etiquetaDoDegrau(ctx, x, y, distancia, maior) {
  const t = Math.min(1, distancia / Math.max(1, maior));
  const l = distancia >= 10 ? 32 : 24;
  caixa(ctx, x - l / 2, y - 11, l, 20,
        distancia === 0 ? COR.cinzaClaro
          : mistura(COR.rampaBaixo, COR.rampaAlto, Math.max(.2, t)), 5);
  texto(ctx, distancia, x, y + 4,
        { tamanho: 12, peso: 800, alinha: "center",
          cor: t > 0.55 ? COR.branco : COR.azulEscuro });
}

/* ================================================================ matriz */
function cartaoDaSerie(estado) {
  const { serie, edicao, colunas, clubes } = estado;
  if (!edicao || !colunas?.length) return null;

  const linhas = serieDeDegraus(colunas);
  const maior = maiorDaSerie(linhas);
  const ultima = linhas.at(-1);
  const agora = maiorDegrau(ultima?.degraus ?? []);
  const posicoes = Math.max(...linhas.map((l) => l.degraus.length));

  const spec = {
    titulo: `Como os degraus da Série ${serie} ${edicao.ano} se abriram`,
    subtitulo: "Uma linha por degrau da tabela, uma coluna por rodada: a cor é "
             + "a distância para a equipe de baixo",
    arquivo: `degraus-${serie}-${edicao.ano}-serie`,
    // Sem faixa de números: os dois degraus que importam estão desenhados
    // com nome e pontuação no painel da direita, e repeti-los em caixa
    // grande só tiraria altura da grade.
    numeros: [],
    nota: `Cada casa é a distância daquela posição para a de baixo ao fim `
        + `daquela rodada. Quanto mais forte, maior o vão; a casa clara é `
        + `empate de pontos.`,
    corpo: async (ctx, y) => {
      const base = CARD.altura - 84;
      const calha = 52;
      const x0 = MARGEM + calha;
      const x1 = CARD.largura - MARGEM - 170;
      const largura = (x1 - x0) / linhas.length;

      const topo = y + 26;
      const alturaGrade = base - topo;
      const alturaLinha = alturaGrade / posicoes;

      const extremo = Math.max(1, ...linhas.flatMap(
        (l) => l.degraus.map((d) => d.distancia)));

      for (let r = 1; r <= linhas.length; r++) {
        if (r !== 1 && r !== linhas.length && r % 2 === 0) continue;
        texto(ctx, r, x0 + (r - 0.5) * largura, topo - 8,
              { tamanho: 10, alinha: "center", cor: COR.cinzaEscuro });
      }

      const alvos = [];
      for (let p = 1; p <= posicoes; p++) {
        const yLinha = topo + (p - 1) * alturaLinha;
        texto(ctx, `${p}·${p + 1}`, x0 - 8, yLinha + alturaLinha / 2 + 4,
              { tamanho: 10, peso: 700, alinha: "right", cor: COR.cinzaEscuro });

        for (const linha of linhas) {
          const degrau = linha.degraus[p - 1];
          if (!degrau) continue;
          const x = x0 + (linha.rodada - 1) * largura;
          const t = degrau.distancia / extremo;

          caixa(ctx, x + .5, yLinha + .5, largura - 1, alturaLinha - 1,
                degrau.distancia === 0 ? COR.cinzaClaro
                  : mistura(COR.fundo, COR.azul, Math.max(.12, t)), 2);
          texto(ctx, degrau.distancia, x + largura / 2,
                yLinha + alturaLinha / 2 + 4,
                { tamanho: 10, peso: t > .35 ? 800 : 400, alinha: "center",
                  cor: t > .5 ? COR.branco : COR.azulEscuro });

          alvos.push({
            n: `${ordinal(p)} na ${linha.rodada}ª rodada`,
            x, y: yLinha, l: largura, a: alturaLinha,
            itens: [
              { rotulo: nomeBonito(degrau.equipe), cor: COR.azul,
                pontos: degrau.pontos, detalhe: `${ordinal(p)} colocado` },
              { rotulo: nomeBonito(degrau.abaixo.equipe), cor: COR.cinzaEscuro,
                pontos: degrau.abaixo.pontos,
                detalhe: `${ordinal(p + 1)} colocado` },
            ],
            diferenca: {
              rotulo: `${degrau.distancia}`,
              texto: degrau.distancia === 0 ? "empatados em pontos"
                : plural(degrau.distancia, "ponto de degrau",
                         "pontos de degrau"),
              cor: degrau.distancia === 0 ? COR.cinzaEscuro : COR.azul,
            },
          });
        }
      }

      await painel(ctx, {
        titulo: "maior degrau da edição", degrau: maior, clubes,
        x: x1 + 18, y: topo, largura: 152,
      });
      await painel(ctx, {
        titulo: `maior degrau na ${ultima?.rodada ?? 0}ª rodada`,
        degrau: agora ? { ...agora, rodada: ultima.rodada } : null, clubes,
        x: x1 + 18, y: topo + 214, largura: 152,
      });

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: y, alturaPlot: base - y,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
      };
    },
  };
  return spec;
}

/**
 * Um degrau em destaque, com os dois clubes que o formam.
 *
 * Sem a pontuação dos dois o número do degrau fica no ar: seis pontos entre o
 * 4º e o 5º é uma coisa a 60 pontos e outra a 30, e é a dupla de números que
 * diz qual delas.
 */
async function painel(ctx, { titulo, degrau, clubes, x, y, largura }) {
  const altura = 196;
  caixa(ctx, x, y, largura, altura, COR.branco, 8);
  ctx.save();
  ctx.strokeStyle = COR.linha;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + .5, y + .5, largura - 1, altura - 1, 8);
  ctx.stroke();
  ctx.restore();

  texto(ctx, titulo, x + 12, y + 20,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });
  if (!degrau) {
    texto(ctx, "—", x + 12, y + 56, { tamanho: 32, peso: 800, cor: COR.cinza });
    return;
  }

  texto(ctx, degrau.distancia, x + 12, y + 60,
        { tamanho: 34, peso: 800, cor: COR.azul });
  texto(ctx, `do ${ordinal(degrau.posicao)} para o `
           + `${ordinal(degrau.posicao + 1)}`,
        x + 12, y + 80, { tamanho: 11, cor: COR.cinzaEscuro });
  if (degrau.rodada) {
    texto(ctx, `na ${degrau.rodada}ª rodada`, x + 12, y + 96,
          { tamanho: 11, cor: COR.cinzaEscuro });
  }

  const lado = 24;
  const linhas = [
    { equipe: degrau.equipe, pontos: degrau.pontos, peso: 700 },
    { equipe: degrau.abaixo.equipe, pontos: degrau.abaixo.pontos, peso: 400 },
  ];
  for (const [i, linha] of linhas.entries()) {
    const yl = y + 116 + i * 38;
    desenharEscudo(ctx, await imagem(clubes?.[linha.equipe]?.escudo),
                   x + 12, yl, lado);
    texto(ctx, cortar(ctx, nomeBonito(linha.equipe), largura - 82, 11, linha.peso),
          x + 42, yl + 10,
          { tamanho: 11, peso: linha.peso, cor: COR.azulEscuro });
    texto(ctx, `${linha.pontos} pts`, x + 42, yl + 23,
          { tamanho: 11.5, peso: 800, cor: COR.cinzaEscuro });
  }
}
