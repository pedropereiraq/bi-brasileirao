/**
 * A dificuldade da tabela de cada clube.
 *
 * A pergunta é velha e sempre a mesma: quem pegou a parte pesada do
 * calendário. A resposta depende de três escolhas que não são detalhe, e é por
 * isso que elas ficam fora do card, à vista:
 *
 *   quando   — os jogos que já passaram ou os que ainda vêm. São perguntas
 *              diferentes: uma explica a campanha, a outra prevê a reta final.
 *   local    — o adversário vale o que ele é na tabela geral, ou o que ele é
 *              **no campo em que o jogo acontece**? O time que faz 70% em casa
 *              e 30% fora não é o mesmo adversário nas duas viagens.
 *   critério — posição ou aproveitamento. A posição é a leitura de quem vê a
 *              tabela; o aproveitamento mede a distância real entre eles, que
 *              a posição achata (o 5º e o 9º podem estar a um ponto).
 *
 * As faixas G-4 a Z-4 são sempre da tabela **geral**: elas dizem de que região
 * do campeonato veio o adversário, e essa região é uma só, não muda com o
 * mando.
 *
 * Módulo sem dependência nenhuma de propósito: recebe agendas e tabelas já
 * prontas e devolve contas, o que deixa `site/testes` carregá-lo no Node.
 */
export const FAIXAS = [
  { chave: "g4", rotulo: "G-4", ate: 4 },
  { chave: "g8", rotulo: "G-8", ate: 8 },
  { chave: "g12", rotulo: "G-12", ate: 12 },
  { chave: "g16", rotulo: "G-16", ate: 16 },
  { chave: "z4", rotulo: "Z-4", ate: 20 },
];

export const faixaDaPosicao = (posicao) =>
  FAIXAS.find((f) => posicao <= f.ate)?.chave ?? FAIXAS.at(-1).chave;

const media = (valores) => (valores.length
  ? valores.reduce((soma, v) => soma + v, 0) / valores.length : null);

/**
 * A tabela do adversário conforme o mando do jogo.
 *
 * `mando` é o do clube analisado: se ele joga fora, o adversário joga em casa,
 * e é a tabela de mandante dele que diz com quem se está lidando.
 */
function tabelaDoAdversario({ geral, casa, fora }, { local, mando }) {
  if (local !== "considerar") return geral;
  return mando === "fora" ? casa : fora;
}

/**
 * A dificuldade de cada clube, com os jogos que a sustentam.
 *
 * Devolve sempre todos os clubes, inclusive os que não têm jogo no recorte —
 * clube sem jogo a realizar tem média nula, e sumir da lista seria pior do que
 * aparecer vazio.
 */
export function dificuldadeDosClubes({ agendas, geral, casa, fora,
                                       quando = "realizados",
                                       local = "ignorar",
                                       criterio = "posicao" }) {
  const querRealizados = quando === "realizados";
  const valorDe = (linha) => (criterio === "posicao"
    ? linha?.pos ?? null
    : linha?.aproveitamento ?? null);

  return Object.entries(agendas).map(([equipe, agenda]) => {
    const jogos = agenda
      .filter((jogo) => Boolean(jogo.realizado) === querRealizados)
      .map((jogo) => {
        const referencia = tabelaDoAdversario({ geral, casa, fora },
          { local, mando: jogo.mando });
        return {
          ...jogo,
          posicao: geral[jogo.adversario]?.pos ?? null,
          valor: valorDe(referencia[jogo.adversario]),
        };
      });

    const validos = (lista) => lista.map((j) => j.valor)
      .filter((v) => typeof v === "number");

    const contagem = Object.fromEntries(FAIXAS.map((f) => [f.chave, 0]));
    for (const jogo of jogos) {
      if (jogo.posicao !== null) contagem[faixaDaPosicao(jogo.posicao)] += 1;
    }

    return {
      equipe,
      pos: geral[equipe]?.pos ?? null,
      jogos,
      total: jogos.length,
      contagem,
      media: media(validos(jogos)),
      mediaCasa: media(validos(jogos.filter((j) => j.mando === "casa"))),
      mediaFora: media(validos(jogos.filter((j) => j.mando === "fora"))),
    };
  });
}

/**
 * Quanto a média pesa, de 0 (a tabela mais leve da tela) a 1 (a mais dura).
 *
 * A média sozinha diz pouco: posição média 9,1 é dura ou fácil? A resposta só
 * aparece ao lado das concorrentes. E o sentido se inverte entre os critérios
 * — em posição, número baixo é adversário forte; em aproveitamento, é o alto.
 * A escala resolve os dois para o mesmo lado, e o card não precisa saber.
 */
export function escalaDaDureza(linhas, criterio = "posicao") {
  const medias = linhas.map((l) => l.media).filter((m) => typeof m === "number");
  if (!medias.length) return () => .5;

  const menor = Math.min(...medias);
  const maior = Math.max(...medias);
  return (valor) => {
    if (typeof valor !== "number" || maior === menor) return .5;
    const t = (valor - menor) / (maior - menor);
    return criterio === "posicao" ? 1 - t : t;
  };
}

/**
 * A ordem da lista.
 *
 * Por dificuldade, o mais duro primeiro; por classificação, a tabela de hoje.
 * Clube sem jogo no recorte vai para o fim nas duas: ele não tem dificuldade
 * nenhuma a mostrar, e no topo seria lido como a tabela mais fácil do
 * campeonato.
 */
export function ordenarDificuldade(linhas, { ordem = "dificuldade",
                                             criterio = "posicao" } = {}) {
  const dureza = escalaDaDureza(linhas, criterio);
  return [...linhas].sort((a, b) => {
    if ((a.media === null) !== (b.media === null)) return a.media === null ? 1 : -1;
    if (ordem === "classificacao") return (a.pos ?? 99) - (b.pos ?? 99);
    return (dureza(b.media) - dureza(a.media)) || ((a.pos ?? 99) - (b.pos ?? 99));
  });
}
