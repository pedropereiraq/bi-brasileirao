/**
 * Card: as distâncias de cada clube para o que vem logo abaixo.
 *
 * A classificação é lida como uma fila, mas é uma escada de degraus muito
 * desiguais. O 4º com seis pontos de sobra e o 4º empatado com o 5º ocupam a
 * mesma linha da tabela e não são a mesma situação. As duas visões desta tela
 * atacam isso por lados diferentes:
 *
 * **Régua** (uma rodada): o eixo é a pontuação, e cada clube fica no ponto em
 * que está. A distância deixa de ser número e vira espaço — quem está isolado
 * aparece sozinho, quem está no pelotão aparece na pilha. Os empatados dividem
 * o mesmo ponto do eixo, e a altura da pilha passa a dizer onde a tabela está
 * cheia, que é uma segunda leitura de graça.
 *
 * O líder fica à esquerda e a pontuação cai para a direita: é a ordem em que a
 * classificação se lê, e "a equipe de baixo" passa a ser a que está adiante na
 * linha, no mesmo sentido da leitura.
 *
 * **Matriz** (a edição inteira): uma linha por degrau, uma coluna por rodada.
 * Mostra quando cada vão se abriu e se o campeonato foi se espalhando ou se
 * fechando — o que nenhuma tabela de uma rodada só pode dizer.
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
    subtitulo: "A tabela como escada: a altura de cada queda é a distância "
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

      const centro = (i) => x0 + (i + 0.5) * passo;

      // A régua de pontos à esquerda: sem ela a escada é uma silhueta bonita
      // sem escala, e o degrau de um ponto parece igual ao de oito.
      for (const marca of marcasDoEixo(baixo, alto)) {
        const ym = yDe(marca);
        linhaH(ctx, x0 - 8, x1, ym, COR.linha);
        texto(ctx, marca, x0 - 14, ym + 4,
              { tamanho: 10, peso: 700, alinha: "right", cor: COR.cinzaEscuro });
      }

      const alvos = [];
      for (const [i, clube] of coluna.entries()) {
        const xc = centro(i);
        const yc = yDe(clube.pontos);
        const de = xc - passo / 2;

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
          const xq = de + passo;
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
  const amplitudes = linhas.map((l) => l.amplitude ?? 0);
  // A amplitude do meio da edição contra a do fim: é o par que conta a
  // história do campeonato — quanto ele se esticou da metade para cá.
  const metade = linhas[Math.floor(linhas.length / 2) - 1] ?? linhas[0];

  const posicoes = Math.max(...linhas.map((l) => l.degraus.length));

  const spec = {
    titulo: `Como os degraus da Série ${serie} ${edicao.ano} se abriram`,
    subtitulo: "Uma linha por degrau da tabela, uma coluna por rodada: a cor é "
             + "a distância para a equipe de baixo",
    arquivo: `degraus-${serie}-${edicao.ano}-serie`,
    numeros: [
      { valor: `${maior?.distancia ?? 0}`, destaque: "azul",
        nome: maior ? `maior degrau · ${ordinal(maior.posicao)} na `
                    + `${maior.rodada}ª rodada` : "maior degrau" },
      { valor: `${ultima?.amplitude ?? 0}`,
        nome: `do líder ao lanterna na ${ultima?.rodada ?? 0}ª rodada` },
      { valor: `${metade?.amplitude ?? 0}`,
        nome: `do líder ao lanterna na ${metade?.rodada ?? 0}ª rodada` },
    ],
    nota: `Cada casa é a distância daquela posição para a de baixo ao fim `
        + `daquela rodada. Quanto mais forte, maior o vão; a casa clara é `
        + `empate de pontos.`,
    corpo: async (ctx, y) => {
      const base = CARD.altura - 84;
      const calha = 52;
      const x0 = MARGEM + calha;
      const x1 = CARD.largura - MARGEM - 170;
      const largura = (x1 - x0) / linhas.length;

      const alturaFaixa = 96;
      const topo = y + 26;
      const alturaGrade = base - alturaFaixa - 30 - topo;
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

      alvos.push(...faixaDaAmplitude(ctx, {
        linhas, amplitudes, x0, largura,
        y: topo + alturaGrade + 30, altura: alturaFaixa,
      }));

      await painel(ctx, {
        maior, ultima, clubes, x: x1 + 18, y: topo, largura: 152,
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
 * A amplitude rodada a rodada: o campeonato inteiro numa linha só.
 *
 * A matriz acima diz onde a tabela se partiu; esta faixa diz se ela está
 * esticando ou se fechando como um todo, que é a pergunta que se faz quando se
 * olha a edição de longe.
 */
function faixaDaAmplitude(ctx, { linhas, amplitudes, x0, largura, y, altura }) {
  texto(ctx, "amplitude da tabela: do líder ao lanterna", MARGEM, y - 6,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });

  const maximo = Math.max(1, ...amplitudes);
  const base = y + altura;
  const escala = (v) => (v / maximo) * (altura - 18);

  linhaH(ctx, x0, x0 + linhas.length * largura, base, COR.linha);

  const alvos = [];
  for (const [i, linha] of linhas.entries()) {
    const x = x0 + i * largura;
    const alturaBarra = escala(linha.amplitude ?? 0);
    caixa(ctx, x + 2, base - alturaBarra, largura - 4, alturaBarra,
          COR.azulMedio, 2);

    // O número em uma rodada a cada três: com 38 colunas, todos viram ruído.
    if (i === 0 || i === linhas.length - 1 || (i + 1) % 3 === 0) {
      texto(ctx, linha.amplitude, x + largura / 2, base - alturaBarra - 5,
            { tamanho: 9.5, peso: 700, alinha: "center", cor: COR.azulEscuro });
    }

    alvos.push({
      n: `${linha.rodada}ª rodada`,
      x, y: y - 10, l: largura, a: altura + 10,
      itens: [],
      diferenca: {
        rotulo: `${linha.amplitude}`,
        texto: "pontos entre o líder e o lanterna",
        cor: COR.azul,
      },
    });
  }
  return alvos;
}

async function painel(ctx, { maior, ultima, clubes, x, y, largura }) {
  if (!maior) return;

  caixa(ctx, x, y, largura, 188, COR.branco, 8);
  ctx.save();
  ctx.strokeStyle = COR.linha;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + .5, y + .5, largura - 1, 187, 8);
  ctx.stroke();
  ctx.restore();

  texto(ctx, "maior degrau da edição", x + 12, y + 20,
        { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .8,
          cor: COR.cinzaEscuro });
  texto(ctx, maior.distancia, x + 12, y + 58,
        { tamanho: 32, peso: 800, cor: COR.azul });
  texto(ctx, `do ${ordinal(maior.posicao)} para o ${ordinal(maior.posicao + 1)}`,
        x + 12, y + 78, { tamanho: 11, cor: COR.cinzaEscuro });
  texto(ctx, `na ${maior.rodada}ª rodada`, x + 12, y + 94,
        { tamanho: 11, cor: COR.cinzaEscuro });

  const lado = 26;
  desenharEscudo(ctx, await imagem(clubes?.[maior.equipe]?.escudo),
                 x + 12, y + 110, lado);
  texto(ctx, cortar(ctx, nomeBonito(maior.equipe), largura - 52, 11.5, 700),
        x + 46, y + 128, { tamanho: 11.5, peso: 700, cor: COR.azulEscuro });

  desenharEscudo(ctx, await imagem(clubes?.[maior.abaixo.equipe]?.escudo),
                 x + 12, y + 146, lado);
  texto(ctx, cortar(ctx, nomeBonito(maior.abaixo.equipe), largura - 52, 11.5, 400),
        x + 46, y + 164, { tamanho: 11.5, cor: COR.cinzaTexto });

  void ultima;
}
