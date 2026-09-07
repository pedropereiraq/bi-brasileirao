/**
 * Card da Tabela de jogos.
 *
 * Reflete o que está selecionado: o andamento da edição inteira, ou o de um
 * clube, ou o de uma rodada. O corpo é o gráfico de rodadas grande — que é o
 * visual principal desta página — mais a lista dos jogos do recorte.
 */
import {
  tabela, clubesDaEdicao, RODADA, DATA, MANDANTE, VISITANTE, GOLS_M, GOLS_V,
  STATUS,
} from "/js/motor.js";
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
} from "/js/cartao.js";

const nomeCurto = (equipe) => equipe.replace(/\s*\([A-Z]{2}\)$/, "");

const realizado = (j) => j[STATUS] === "realizado"
  && j[GOLS_M] !== null && j[GOLS_V] !== null;

const doClube = (j, clube) => !clube
  || j[MANDANTE] === clube || j[VISITANTE] === clube;

function dataBr(iso) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a.slice(2)}`;
}

export function montarCartao(estado) {
  const noEscopo = estado.jogos.filter((j) => doClube(j, estado.clube));
  const feitos = noEscopo.filter(realizado).length;
  const total = noEscopo.length;
  const percentual = total ? (feitos / total) * 100 : 0;

  const visiveis = estado.jogos.filter((j) =>
    doClube(j, estado.clube)
    && (estado.rodada === null || j[RODADA] === estado.rodada)
    && (estado.situacao === "todos"
        || (estado.situacao === "realizados") === realizado(j)));

  const recorte = [`Série ${estado.edicao.serie} · ${estado.edicao.ano}`];
  if (estado.clube) recorte.push(nomeCurto(estado.clube));
  if (estado.rodada !== null) recorte.push(`rodada ${estado.rodada}`);
  if (estado.situacao !== "todos") recorte.push(`só ${estado.situacao}`);
  recorte.push(estado.edicao.encerrada
    ? "edição encerrada" : `rodada ${estado.edicao.rodada_atual} de ${estado.edicao.rodadas}`);

  return {
    titulo: estado.clube
      ? `${nomeCurto(estado.clube)} · jogos`
      : `Tabela de jogos · Série ${estado.edicao.serie} ${estado.edicao.ano}`,
    subtitulo: recorte.join(" · "),
    escudo: estado.clube ? estado.clubes[estado.clube]?.escudo : null,
    nota: "Jogo realizado é o que tem placar. Adiado e agendado contam como "
        + "pendentes.",
    numeros: [
      { valor: `${percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
        nome: "executado", destaque: "azul" },
      { valor: feitos, nome: "jogos realizados" },
      { valor: total - feitos, nome: "jogos pendentes" },
      { valor: total, nome: "jogos na edição" },
    ],
    corpo: async (ctx, y) => {
      const alturaGrafico = graficoDeRodadas(ctx, MARGEM, y,
        CARD.largura - MARGEM * 2, noEscopo, estado);
      await listaDeJogos(ctx, MARGEM, y + alturaGrafico + 22,
        CARD.largura - MARGEM * 2, visiveis, estado);
    },
  };
}

/* --------------------------------------------------- gráfico de rodadas */
function graficoDeRodadas(ctx, x, y, largura, noEscopo, estado) {
  titulo(ctx, "Jogos por rodada", x, y, largura);

  const rodadas = estado.edicao.rodadas;
  // Percorrido de 1 a N: a ordem é do laço, não da ordenação de uma lista.
  const porRodada = new Map();
  for (let r = 1; r <= rodadas; r++) porRodada.set(r, { total: 0, feitos: 0 });
  for (const j of noEscopo) {
    const bloco = porRodada.get(j[RODADA]);
    if (!bloco) continue;
    bloco.total += 1;
    if (realizado(j)) bloco.feitos += 1;
  }

  const maximo = Math.max(...[...porRodada.values()].map((b) => b.total), 1);
  const topo = y + 40, alturaMax = 120;
  const vao = 5;
  const larguraBarra = (largura - vao * (rodadas - 1)) / rodadas;

  for (const [r, b] of porRodada) {
    const cx = x + (r - 1) * (larguraBarra + vao);
    const alturaTotal = (b.total / maximo) * alturaMax;
    const alturaFeita = b.total ? (b.feitos / b.total) * alturaTotal : 0;
    const base = topo + alturaMax;
    const selecionada = estado.rodada === r;

    caixa(ctx, cx, base - alturaTotal, larguraBarra, alturaTotal,
          selecionada ? COR.azulClaro : COR.cinzaClaro, 3);
    if (alturaFeita > 0) {
      caixa(ctx, cx, base - alturaFeita, larguraBarra, alturaFeita, COR.azul, 3);
      if (larguraBarra > 16 && alturaFeita > 16) {
        texto(ctx, b.feitos, cx + larguraBarra / 2, base - alturaFeita / 2 + 5,
              { tamanho: 13, peso: 800, cor: COR.branco, alinha: "center" });
      }
    }
    texto(ctx, r, cx + larguraBarra / 2, base + 18,
          { tamanho: 11, cor: selecionada ? COR.azul : COR.cinzaEscuro,
            peso: selecionada ? 800 : 400, alinha: "center" });
  }

  texto(ctx, "azul, realizados · cinza, pendentes", x, topo + alturaMax + 40,
        { tamanho: 13, cor: COR.cinzaEscuro });
  return 40 + alturaMax + 48;
}

/* ------------------------------------------------------- lista de jogos */
async function listaDeJogos(ctx, x, y, largura, jogos, estado) {
  const alturaLinha = 34;
  const espaco = CARD.altura - 76 - y - 30;
  const linhasPossiveis = Math.max(1, Math.floor(espaco / alturaLinha));
  const colunas = Math.min(3, Math.max(1, Math.ceil(jogos.length / linhasPossiveis)));
  const cabe = linhasPossiveis * colunas;

  // Quando não cabe tudo, o que se escolhe mostrar muda o sentido do card.
  // A cauda crua da lista são os jogos da rodada 38 — todos "a jogar", o que
  // não diz nada. O útil é o fim do que já aconteceu, ou o começo do que vem.
  const cabeTudo = jogos.length <= cabe;
  const querPendentes = estado.situacao === "pendentes";
  let mostrados, rotulo;

  if (cabeTudo) {
    mostrados = jogos;
    rotulo = `Jogos (${jogos.length})`;
  } else if (querPendentes) {
    mostrados = jogos.slice(0, cabe);
    rotulo = `Próximos jogos (${cabe} de ${jogos.length})`;
  } else {
    const feitos = jogos.filter(realizado);
    const pendentes = jogos.filter((j) => !realizado(j));
    // Os últimos disputados; se sobrar espaço, completa com os próximos.
    const ultimos = feitos.slice(-cabe);
    mostrados = ultimos.length >= cabe
      ? ultimos
      : [...ultimos, ...pendentes.slice(0, cabe - ultimos.length)];
    rotulo = `Jogos mais recentes (${mostrados.length} de ${jogos.length})`;
  }
  titulo(ctx, rotulo, x, y, largura);

  if (!jogos.length) {
    texto(ctx, "nenhum jogo neste recorte", x, y + 54,
          { tamanho: 15, cor: COR.cinzaEscuro });
    return;
  }

  const vao = 36;
  const larguraColuna = (largura - vao * (colunas - 1)) / colunas;
  const porColuna = Math.ceil(mostrados.length / colunas);

  for (const [i, jogo] of mostrados.entries()) {
    const coluna = Math.floor(i / porColuna);
    const linha = i % porColuna;
    await linhaDeJogo(ctx, jogo, estado,
      x + coluna * (larguraColuna + vao), y + 44 + linha * alturaLinha,
      larguraColuna);
  }
}

async function linhaDeJogo(ctx, jogo, estado, x, y, largura) {
  const feito = realizado(jogo);
  const meio = y + 20;
  const centro = x + largura * 0.62;

  texto(ctx, jogo[RODADA], x + 16, meio,
        { tamanho: 13, peso: 700, cor: COR.azulEscuro, alinha: "right" });
  texto(ctx, dataBr(jogo[DATA]), x + 26, meio,
        { tamanho: 12.5, cor: COR.cinzaEscuro });

  const corTime = feito ? COR.azulEscuro : COR.cinzaTexto;
  const escudoM = await imagem(estado.clubes[jogo[MANDANTE]]?.escudo);
  const escudoV = await imagem(estado.clubes[jogo[VISITANTE]]?.escudo);

  texto(ctx, cortar(ctx, nomeCurto(jogo[MANDANTE]), largura * 0.28, 14, 600),
        centro - 96, meio, { tamanho: 14, peso: 600, cor: corTime, alinha: "right" });
  desenharEscudo(ctx, escudoM, centro - 90, y + 6, 22);

  if (feito) {
    texto(ctx, `${jogo[GOLS_M]} × ${jogo[GOLS_V]}`, centro, meio,
          { tamanho: 15, peso: 800, cor: COR.azulEscuro, alinha: "center" });
  } else {
    texto(ctx, "a jogar", centro, meio,
          { tamanho: 11.5, cor: COR.cinzaEscuro, alinha: "center" });
  }

  desenharEscudo(ctx, escudoV, centro + 68, y + 6, 22);
  texto(ctx, cortar(ctx, nomeCurto(jogo[VISITANTE]), largura * 0.28, 14, 600),
        centro + 96, meio, { tamanho: 14, peso: 600, cor: corTime });

  linhaH(ctx, x, x + largura, y + 30);
}

function titulo(ctx, t, x, y, largura) {
  texto(ctx, t, x, y + 15,
        { tamanho: 20, peso: 700, cor: COR.azul, familia: "Bree Serif" });
  linhaH(ctx, x, x + largura, y + 26, COR.linha, 2);
}
