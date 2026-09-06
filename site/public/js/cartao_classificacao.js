/**
 * Os cards da página de Classificação.
 *
 * Dois, conforme o que está na tela: sem clube selecionado, a tabela do
 * recorte; com clube, a campanha dele. O subtítulo carrega sempre o recorte e
 * o período — card sai da página sozinho e não pode ir sem contexto.
 *
 * A moldura (cabeçalho, régua, faixa de números, rodapé) é de `cartao.js`.
 * Aqui mora só o corpo.
 */
import { tabela, clubesDaEdicao, campanha, porMando } from "/js/motor.js";
import {
  CARD, COR, MARGEM, texto, caixa, linhaH, cortar, imagem, desenharEscudo,
  barraTED,
} from "/js/cartao.js";
import { corpoDoClube } from "/js/cartao_clube.js";

const CORES_RESULTADO = { T: COR.azul, E: COR.cinzaEscuro, D: COR.vermelho };

const NOTA = "Critérios de desempate: pontos, triunfos, saldo de gols, gols pró "
           + "e ordem alfabética. Jogo sem placar não entra na conta.";

const nomeCurto = (equipe) => equipe.replace(/\s*\([A-Z]{2}\)$/, "");

function dataBr(iso) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** O recorte em uma linha, para o subtítulo. */
function recorteEmTexto({ filtros: f, edicao: e }) {
  const partes = [`Série ${e.serie} · ${e.ano}`];
  if (f.ultimos) partes.push(`últimos ${f.ultimos} jogos de cada clube`);

  const cheio = f.rodadaDe === 1 && f.rodadaAte >= (e.rodada_atual || e.rodadas);
  if (cheio) {
    partes.push(e.encerrada ? "edição completa" : `até a rodada ${e.rodada_atual}`);
  } else {
    partes.push(f.rodadaDe === f.rodadaAte
      ? `rodada ${f.rodadaDe}` : `rodadas ${f.rodadaDe} a ${f.rodadaAte}`);
  }
  if (f.mando !== "todos") {
    partes.push(f.mando === "casa" ? "só em casa" : "só fora de casa");
  }
  if (f.dataDe || f.dataAte) {
    partes.push(`${f.dataDe ? dataBr(f.dataDe) : "início"} a `
              + `${f.dataAte ? dataBr(f.dataAte) : "hoje"}`);
  }
  return partes.join(" · ");
}

export function montarCartao(estado) {
  return estado.selecionado ? cartaoDoClube(estado) : cartaoDaTabela(estado);
}

/* ------------------------------------------------------- card da tabela */
function cartaoDaTabela(estado) {
  const clubes = clubesDaEdicao(estado.jogos);
  const linhas = tabela(estado.jogos, clubes, estado.filtros);
  const disputados = estado.longo.length / 2;
  const lider = linhas[0];

  return {
    titulo: `Classificação · Série ${estado.edicao.serie} ${estado.edicao.ano}`,
    subtitulo: recorteEmTexto(estado),
    nota: NOTA,
    numeros: [
      { valor: nomeCurto(lider.equipe), nome: "líder do recorte", destaque: "azul" },
      { valor: lider.pts, nome: "pontos do líder" },
      { valor: disputados, nome: "jogos na conta" },
      { valor: lider.aproveitamento === null ? "—"
             : `${Math.round(lider.aproveitamento * 100)}%`,
        nome: "aproveitamento do líder" },
    ],
    corpo: async (ctx, y) => {
      const colunas = 2, porColuna = 10, vao = 44;
      const largura = (CARD.largura - MARGEM * 2 - vao) / colunas;
      const alturaLinha = 52;

      for (let c = 0; c < colunas; c++) {
        const x = MARGEM + c * (largura + vao);
        cabecalhoDaTabela(ctx, x, y, largura);
        for (let i = 0; i < porColuna; i++) {
          const linha = linhas[c * porColuna + i];
          if (!linha) continue;
          await linhaDaTabela(ctx, linha, estado, x, y + 28 + i * alturaLinha, largura);
        }
      }
    },
  };
}

function cabecalhoDaTabela(ctx, x, y, largura) {
  const base = { tamanho: 11.5, peso: 700, cor: COR.cinzaEscuro, maiuscula: true,
                 espaco: .9 };
  texto(ctx, "clube", x + 40, y + 12, base);
  texto(ctx, "T·E·D", x + largura - 214, y + 12, { ...base, alinha: "center" });
  texto(ctx, "J", x + largura - 124, y + 12, { ...base, alinha: "right" });
  texto(ctx, "SG", x + largura - 68, y + 12, { ...base, alinha: "right" });
  texto(ctx, "P", x + largura - 8, y + 12, { ...base, alinha: "right" });
  linhaH(ctx, x, x + largura, y + 20, COR.linha, 2);
}

async function linhaDaTabela(ctx, linha, estado, x, y, largura) {
  const meio = y + 26;

  // Faixa de G4 e Z4 — as duas que valem em toda edição de 20 clubes desde 2006.
  if (linha.pos <= 4) caixa(ctx, x, y + 4, 4, 40, COR.azul, 2);
  else if (linha.pos >= 17) caixa(ctx, x, y + 4, 4, 40, COR.vermelho, 2);

  texto(ctx, linha.pos, x + 26, meio + 6,
        { tamanho: 17, peso: 700, cor: COR.azulEscuro, alinha: "right" });

  const escudo = await imagem(estado.clubes[linha.equipe]?.escudo);
  desenharEscudo(ctx, escudo, x + 38, y + 8, 30);

  texto(ctx, cortar(ctx, nomeCurto(linha.equipe), largura - 310, 18, 600),
        x + 76, meio + 6, { tamanho: 18, peso: 600, cor: COR.azulEscuro });

  barraTED(ctx, x + largura - 268, meio - 6, 108, 14, linha);
  texto(ctx, linha.j, x + largura - 124, meio + 6,
        { tamanho: 16, cor: COR.cinzaTexto, alinha: "right" });
  texto(ctx, `${linha.sg > 0 ? "+" : ""}${linha.sg}`, x + largura - 68, meio + 6,
        { tamanho: 16, cor: COR.cinzaTexto, alinha: "right" });
  texto(ctx, linha.pts, x + largura - 8, meio + 7,
        { tamanho: 21, peso: 800, cor: COR.azul, alinha: "right" });

  linhaH(ctx, x, x + largura, y + 46);
}

/* -------------------------------------------------------- card do clube */
function cartaoDoClube(estado) {
  const clube = estado.selecionado;
  const passos = campanha(estado.jogos, clube, estado.filtros);
  const mandos = porMando(estado.jogos, clube, estado.filtros);
  const linha = tabela(estado.jogos, clubesDaEdicao(estado.jogos), estado.filtros)
    .find((c) => c.equipe === clube);

  return {
    titulo: `${nomeCurto(clube)} · campanha`,
    subtitulo: recorteEmTexto(estado),
    escudo: estado.clubes[clube]?.escudo,
    nota: NOTA,
    numeros: [
      { valor: `${linha.pos}º`, nome: "posição no recorte", destaque: "azul" },
      { valor: linha.pts, nome: "pontos" },
      { valor: `${linha.t}·${linha.e}·${linha.d}`, nome: "triunfos·empates·derrotas" },
      { valor: `${linha.sg > 0 ? "+" : ""}${linha.sg}`, nome: "saldo de gols" },
      { valor: linha.aproveitamento === null ? "—"
             : `${Math.round(linha.aproveitamento * 100)}%`, nome: "aproveitamento" },
    ],
    corpo: corpoDoClube({ passos, mandos }),
  };
}
