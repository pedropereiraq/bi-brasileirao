/**
 * Card: as posições históricas de um clube.
 *
 * **Rodada a rodada**: uma linha por edição, uma coluna por rodada, e a
 * posição do clube em cada casa. Azul dentro do recorte marcado, vermelho
 * fora. O que se vê de longe é o retrato de vinte anos — onde o clube morou na
 * tabela, quanto tempo ficou e quando mudou de faixa.
 *
 * As primeiras rodadas podem sair da conta. No começo de campeonato a posição
 * ainda é ruído — três jogos separam o líder do 15º —, e quem pergunta por
 * regularidade não quer que esse ruído entre na estatística. As rodadas
 * descartadas continuam desenhadas, em cinza: some da conta, não da vista.
 *
 * **Posição final**: a mesma vida vista pelo desfecho, num eixo que as duas
 * séries dividem. A Série B mora abaixo da A, então cair e subir viram degraus
 * do mesmo gráfico em vez de duas histórias separadas. A edição em andamento
 * entra com a posição de hoje e um asterisco, porque ela ainda não é desfecho.
 */
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, polilinha,
} from "/js/cartao.js";
import { nomeBonito } from "/js/nomes.js";
import {
  POSICOES_POR_SERIE, contagemDoCorte, doEixo, resumoDaTrilha, trilhaFinal,
} from "/js/posicoes_historicas.js";

const ordinal = (p) => `${p}º`;
const pct = (v) => (v === null ? "—" : `${Math.round(v * 100)}%`);

const CORES_DA_SERIE = () => ({ A: COR.azul, B: COR.vermelho });

/** O rótulo de um ponto do eixo combinado: "4º" na A, "4º da B" na B. */
const rotuloDoEixo = (valor) => {
  const { serie, posicao } = doEixo(valor);
  return serie === "A" ? ordinal(posicao) : `${ordinal(posicao)} da B`;
};

export function montarCartao(estado) {
  return estado.modo === "final" ? cartaoFinal(estado) : cartaoRodadas(estado);
}

/* ======================================================= rodada a rodada */
function cartaoRodadas(estado) {
  const { equipe, serie, alvo, ignorar, trajetorias, clubes } = estado;
  if (!equipe || !trajetorias?.length) return null;

  const conta = contagemDoCorte(trajetorias, { alvo, ignorar });
  if (!conta.total) return null;

  const spec = {
    titulo: `${nomeBonito(equipe)} na Série ${serie}, rodada a rodada`,
    subtitulo: "",
    arquivo: `historico-${equipe}-${serie}-r${alvo}`,
    escudo: clubes?.[equipe]?.escudo,
    numeros: [
      { valor: pct(conta.fracao), destaque: "azul",
        nome: `das rodadas até o ${ordinal(alvo)}` },
      { valor: `${conta.acima}`, nome: `rodadas até o ${ordinal(alvo)}` },
      { valor: `${conta.abaixo}`, nome: `rodadas abaixo do ${ordinal(alvo)}` },
      { valor: `${conta.edicoes}`, nome: `edições na série ${serie}` },
    ],
    nota: ignorar
      ? `A posição marcada conta como dentro. As ${ignorar} primeiras rodadas `
        + `de cada edição ficam de fora da conta — desenhadas em cinza —, `
        + `porque no começo de campeonato a tabela ainda é ruído.`
      : `A posição marcada conta como dentro: marcar o ${ordinal(alvo)} é `
        + `perguntar pelas ${alvo} primeiras posições.`,
    corpo: async (ctx, y) => {
      const base = CARD.altura - 84;
      const calha = 56;
      const resumo = 150;
      const x0 = MARGEM + calha;
      const x1 = CARD.largura - MARGEM - resumo;

      const rodadas = Math.max(1, ...trajetorias.map((t) => t.posicoes.length));
      const largura = (x1 - x0) / rodadas;
      const topo = y + 26;
      const alturaLinha = (base - topo) / trajetorias.length;

      for (let r = 1; r <= rodadas; r++) {
        if (r !== 1 && r !== rodadas && r % 2 === 0) continue;
        texto(ctx, r, x0 + (r - 0.5) * largura, topo - 8,
              { tamanho: 10, alinha: "center", cor: COR.cinzaEscuro });
      }

      const alvos = [];
      for (const [i, trajetoria] of trajetorias.entries()) {
        const yLinha = topo + i * alturaLinha;
        const meio = yLinha + alturaLinha / 2;
        const doAno = conta.porAno[i];

        texto(ctx, trajetoria.ano, MARGEM + calha - 10, meio + 4,
              { tamanho: 11.5, peso: 700, alinha: "right",
                cor: doAno.participou ? COR.azulEscuro : COR.cinza });

        if (!doAno.participou) {
          caixa(ctx, x0, yLinha + 1, x1 - x0, alturaLinha - 3, COR.fundo, 3);
          texto(ctx, "sem participação", (x0 + x1) / 2, meio + 4,
                { tamanho: 11, peso: 700, maiuscula: true, espaco: 1.2,
                  alinha: "center", cor: COR.cinza });
          continue;
        }

        for (const [k, posicao] of trajetoria.posicoes.entries()) {
          if (posicao === null) continue;
          const x = x0 + k * largura;
          const fora = k < ignorar;
          const dentro = posicao <= alvo;

          caixa(ctx, x + .5, yLinha + .5, largura - 1, alturaLinha - 2,
                fora ? COR.cinzaClaro : dentro ? COR.azul : COR.negativo, 2);
          texto(ctx, posicao, x + largura / 2, meio + 4,
                { tamanho: 10, peso: 700, alinha: "center",
                  cor: fora ? COR.cinzaEscuro : COR.branco });

          alvos.push({
            n: `${trajetoria.ano} · ${k + 1}ª rodada`,
            x, y: yLinha, l: largura, a: alturaLinha - 2,
            itens: [],
            diferenca: {
              rotulo: ordinal(posicao),
              texto: fora ? "rodada fora da conta"
                : dentro ? `dentro do recorte até o ${ordinal(alvo)}`
                         : `abaixo do ${ordinal(alvo)}`,
              cor: fora ? COR.cinzaEscuro : dentro ? COR.azul : COR.negativo,
            },
          });
        }

        // O resumo do ano: a barra é a proporção, e o número é a conta.
        const xr = x1 + 14;
        const larguraBarra = resumo - 62;
        const fracao = doAno.total ? doAno.acima / doAno.total : 0;
        caixa(ctx, xr, meio - 6, larguraBarra, 12, COR.negativo, 3);
        if (fracao > 0) {
          caixa(ctx, xr, meio - 6, Math.max(2, larguraBarra * fracao), 12,
                COR.azul, 3);
        }
        texto(ctx, pct(doAno.total ? fracao : null),
              CARD.largura - MARGEM, meio + 4,
              { tamanho: 11.5, peso: 800, alinha: "right", cor: COR.azulEscuro });
      }

      texto(ctx, `dentro do ${ordinal(alvo)}`, x1 + 14, y + 18,
            { tamanho: 9.5, peso: 700, maiuscula: true, espaco: .7,
              cor: COR.cinzaEscuro });

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: y, alturaPlot: base - y,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
      };
    },
  };
  return spec;
}

/* ========================================================= posição final */
function cartaoFinal(estado) {
  const { equipe, series, alvo, edicoes, clubes } = estado;
  if (!equipe || !edicoes?.length) return null;

  const trilha = trilhaFinal(edicoes, { series });
  if (!trilha.length) return null;
  const resumo = resumoDaTrilha(trilha);

  const spec = {
    titulo: `Onde ${nomeBonito(equipe)} terminou, ano a ano`,
    subtitulo: "",
    arquivo: `historico-final-${equipe}`,
    escudo: clubes?.[equipe]?.escudo,
    numeros: [
      { valor: rotuloDoEixo(resumo.melhor.eixo), destaque: "azul",
        nome: `melhor campanha · ${resumo.melhor.ano}` },
      { valor: rotuloDoEixo(resumo.pior.eixo),
        nome: `pior campanha · ${resumo.pior.ano}` },
      { valor: `${resumo.porSerie.A}`, nome: "edições na série A" },
      { valor: `${resumo.porSerie.B}`, nome: "edições na série B" },
    ],
    nota: `A Série B vem abaixo da A no mesmo eixo: a 1ª da B fica logo depois `
        + `da 20ª da A, como na vida. O asterisco marca a edição em andamento, `
        + `que ainda não terminou onde está.`,
    corpo: async (ctx, y) => {
      const base = CARD.altura - 84;
      const calha = 62;
      const x0 = MARGEM + calha;
      const x1 = CARD.largura - MARGEM - 10;
      const topo = y + 22;
      const fundo = base - 30;

      const anos = trilha.map((p) => p.ano);
      const deAno = Math.min(...anos);
      const ateAno = Math.max(...anos);
      const passo = (x1 - x0) / Math.max(1, ateAno - deAno + 1);
      const xDe = (ano) => x0 + (ano - deAno + 0.5) * passo;

      const total = series.length > 1 ? POSICOES_POR_SERIE * 2
        : POSICOES_POR_SERIE;
      const base1 = series.includes("A") ? 0 : POSICOES_POR_SERIE;
      const yDe = (eixo) => topo + ((eixo - base1 - 0.5) / total) * (fundo - topo);

      // A faixa da série B, para o eixo se explicar sem legenda.
      if (series.includes("B") && series.length > 1) {
        caixa(ctx, x0 - 8, yDe(POSICOES_POR_SERIE + .5), x1 - x0 + 8,
              fundo - yDe(POSICOES_POR_SERIE + .5), COR.vermelhoLavado, 4);
      }

      for (let eixo = base1 + 1; eixo <= base1 + total; eixo++) {
        const { posicao } = doEixo(eixo);
        if (posicao % 5 !== 0 && posicao !== 1) continue;
        const ym = yDe(eixo);
        linhaH(ctx, x0 - 8, x1, ym, COR.linha);
        texto(ctx, ordinal(posicao), MARGEM + calha - 16, ym + 4,
              { tamanho: 10, peso: 700, alinha: "right", cor: COR.cinzaEscuro });
      }
      // O nome da série vai na borda direita: à esquerda ele encostaria na
      // régua de posições, e a faixa já diz onde uma série acaba e a outra
      // começa.
      for (const serie of series) {
        const ancora = serie === "A" ? 1 : POSICOES_POR_SERIE + 1;
        texto(ctx, `série ${serie}`, x1, yDe(ancora) - 12,
              { tamanho: 9.5, peso: 800, maiuscula: true, espaco: .8,
                alinha: "right", cor: CORES_DA_SERIE()[serie] });
      }

      // A linha do ponto marcado, que pode morar em qualquer das duas séries.
      if (alvo >= base1 + 1 && alvo <= base1 + total) {
        const ym = yDe(alvo);
        ctx.save();
        ctx.strokeStyle = COR.cinzaEscuro;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(x0 - 8, ym);
        ctx.lineTo(x1, ym);
        ctx.stroke();
        ctx.restore();
        texto(ctx, rotuloDoEixo(alvo), x1, ym - 7,
              { tamanho: 11, peso: 800, alinha: "right", cor: COR.cinzaEscuro });
      }

      // Os trechos ganham a cor da série do ano em que chegam: a descida de um
      // rebaixamento entra no vermelho junto com o clube.
      for (let i = 1; i < trilha.length; i++) {
        const antes = trilha[i - 1];
        const agora = trilha[i];
        if (agora.ano - antes.ano > 1) continue;
        polilinha(ctx, [[xDe(antes.ano), yDe(antes.eixo)],
                        [xDe(agora.ano), yDe(agora.eixo)]],
                  CORES_DA_SERIE()[agora.serie], 3);
      }

      const alvos = [];
      for (const ponto of trilha) {
        const px = xDe(ponto.ano);
        const py = yDe(ponto.eixo);
        const cor = CORES_DA_SERIE()[ponto.serie];

        ctx.save();
        ctx.fillStyle = COR.fundo;
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = cor;
        ctx.beginPath();
        ctx.arc(px, py, ponto.encerrada ? 6.5 : 8, 0, Math.PI * 2);
        ctx.fill();
        if (!ponto.encerrada) {
          ctx.fillStyle = COR.fundo;
          ctx.beginPath();
          ctx.arc(px, py, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        texto(ctx, ponto.posicao, px, py - 14,
              { tamanho: 11, peso: 800, alinha: "center", cor });

        texto(ctx, `${ponto.ano}${ponto.encerrada ? "" : "*"}`, px, base - 10,
              { tamanho: 10.5, peso: ponto.encerrada ? 400 : 800,
                alinha: "center",
                cor: ponto.encerrada ? COR.cinzaEscuro : COR.azulEscuro });

        alvos.push({
          n: `${ponto.ano}${ponto.encerrada ? "" : " · em andamento"}`,
          x: px - passo / 2, y: topo, l: passo, a: fundo - topo,
          itens: [],
          diferenca: {
            rotulo: `${ordinal(ponto.posicao)} da série ${ponto.serie}`,
            texto: ponto.encerrada ? "posição final"
                                   : "posição de hoje, edição em andamento",
            cor,
          },
        });
      }

      spec.hover = {
        pontos: alvos, eixo: "caixa", unidade: "",
        topo: y, alturaPlot: base - y,
        x0: MARGEM, x1: CARD.largura - MARGEM, largura: 20,
      };
    },
  };
  return spec;
}
