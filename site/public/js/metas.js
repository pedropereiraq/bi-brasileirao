/**
 * Blocos de 6 jogos: a meta por bloco e o que cada bloco rendeu.
 *
 * Uma campanha de 38 jogos vira 6 blocos de 6 mais os 2 últimos. O bloco é uma
 * unidade que cabe na cabeça de quem acompanha: "precisamos de 7 pontos nos
 * próximos seis jogos" é uma frase que se cobra, e "precisamos de 1,1 ponto por
 * jogo" não é.
 *
 * Daí a meta por bloco ter de ser inteira. A média de quem termina em 17º na
 * Série A é 41,75 pontos; 41,75 dividido por 6 dá 6,96, que não é meta de
 * ninguém. O jeito de fechar a conta sem inventar decimal é deixar a sobra
 * para o bloco extra, que tem 2 jogos e pode pedir de 0 a 4 pontos.
 *
 * Módulo sem dependência nenhuma de propósito: assim `site/testes` carrega no
 * Node e cobra a regra.
 */
export const BLOCOS = 6;
export const JOGOS_POR_BLOCO = 6;
export const JOGOS_EXTRA = 2;

/** O extra tem 2 jogos, mas a meta dele não passa de 4 por decisão de projeto. */
export const META_EXTRA_MAX = 4;
const META_BLOCO_MAX = JOGOS_POR_BLOCO * 3;

/**
 * A meta inteira por bloco e a sobra do extra, o mais perto possível da média.
 *
 * Busca exaustiva em vez de fórmula: são 19 × 5 combinações, e a fórmula tem
 * que lidar com o caso em que a sobra ideal passa de 4 — o campeão da Série A
 * faz 76,95, e 76,95 ÷ 6 = 12,8. Com 12 por bloco sobrariam 4,95 para o extra,
 * que é mais do que ele aceita; com 13, o extra teria de ser negativo. A busca
 * escolhe o total alcançável mais próximo (12 e 4, total 76) sem caso especial
 * nenhum.
 */
export function metasDaPosicao(media) {
  let escolhida = null;
  for (let bloco = 0; bloco <= META_BLOCO_MAX; bloco++) {
    for (let extra = 0; extra <= META_EXTRA_MAX; extra++) {
      const total = BLOCOS * bloco + extra;
      const erro = Math.abs(total - media);
      if (!escolhida || erro < escolhida.erro) escolhida = { bloco, extra, total, erro };
    }
  }
  return escolhida;
}

export const pontosDoResultado = (resultado) =>
  resultado === "T" ? 3 : resultado === "E" ? 1 : 0;

/**
 * Reparte a agenda cronológica nos 7 blocos.
 *
 * `agenda` é a lista de `grafico_campanha.campanhaCompleta`: o n-ésimo jogo do
 * clube, disputado ou não. Blocos são fatias de jogos, não de rodadas — um
 * jogo adiado da 4ª disputado em agosto pertence ao bloco de agosto, que é
 * quando ele valeu pontos.
 */
export function dividirEmBlocos(agenda, metas) {
  const faixas = [];
  for (let i = 0; i < BLOCOS; i++) {
    faixas.push({
      nome: `Bloco ${i + 1}`,
      curto: `B${i + 1}`,
      de: i * JOGOS_POR_BLOCO + 1,
      ate: (i + 1) * JOGOS_POR_BLOCO,
      meta: metas.bloco,
    });
  }
  const deExtra = BLOCOS * JOGOS_POR_BLOCO + 1;
  faixas.push({
    nome: "Extra", curto: "EX",
    de: deExtra, ate: deExtra + JOGOS_EXTRA - 1, meta: metas.extra,
  });

  let acumulado = 0;
  return faixas.map((faixa) => {
    const jogos = agenda.filter((p) => p.n >= faixa.de && p.n <= faixa.ate);
    const disputados = jogos.filter((p) => p.realizado);
    const pontos = disputados.reduce(
      (soma, p) => soma + pontosDoResultado(p.jogo.resultado), 0);
    const completo = jogos.length > 0 && disputados.length === jogos.length;
    const saldo = completo ? pontos - faixa.meta : null;
    if (completo) acumulado += saldo;

    return {
      ...faixa,
      jogos,
      pontos,
      disputados: disputados.length,
      total: jogos.length,
      iniciado: disputados.length > 0,
      completo,
      saldo,
      // O acumulado só anda em bloco fechado. Somar um bloco pela metade diria
      // que a campanha está atrasada quando ela ainda tem jogos para fazer.
      acumulado: completo ? acumulado : null,
      // Quanto ainda falta para bater a meta, e em quantos jogos.
      falta: completo ? null : Math.max(0, faixa.meta - pontos),
      restam: jogos.length - disputados.length,
    };
  });
}

/** O balanço da campanha inteira, contando só o que já fechou. */
export function resumoDosBlocos(blocos) {
  const fechados = blocos.filter((b) => b.completo);
  return {
    blocosFechados: fechados.length,
    pontos: fechados.reduce((soma, b) => soma + b.pontos, 0),
    meta: fechados.reduce((soma, b) => soma + b.meta, 0),
    saldo: fechados.reduce((soma, b) => soma + b.saldo, 0),
    // O total inclui o que já foi feito no bloco em andamento: é a pontuação
    // da equipe hoje, e não bate com `pontos` de propósito.
    pontosTotais: blocos.reduce((soma, b) => soma + b.pontos, 0),
    metaTotal: blocos.reduce((soma, b) => soma + b.meta, 0),
  };
}
