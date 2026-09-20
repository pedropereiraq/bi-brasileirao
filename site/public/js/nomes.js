/**
 * Nome de clube em caixa alta e baixa, para título de card.
 *
 * O banco guarda `RED BULL BRAGANTINO (SP)`. Title case ingênuo devolveria
 * "Crb" e "Vasco Da Gama", então há duas listas: siglas que continuam em caixa
 * alta e conectivos que continuam em minúscula.
 */
const SIGLAS = new Set(["ABC", "ASA", "CRB", "CSA", "XV"]);
const CONECTIVOS = new Set(["de", "da", "do", "das", "dos", "e"]);

/** `BAHIA (BA)` -> `Bahia`. */
export function nomeCurto(equipe) {
  return equipe.replace(/\s*\([A-Z]{2}\)$/, "");
}

/** `VASCO DA GAMA (RJ)` -> `Vasco da Gama`. */
export function nomeBonito(equipe) {
  return nomeCurto(equipe)
    .split(/\s+/)
    .map((palavra, i) => {
      if (SIGLAS.has(palavra)) return palavra;
      const minuscula = palavra.toLocaleLowerCase("pt-BR");
      if (i > 0 && CONECTIVOS.has(minuscula)) return minuscula;
      return minuscula.charAt(0).toLocaleUpperCase("pt-BR") + minuscula.slice(1);
    })
    .join(" ");
}

/** A sigla de estado, para desempatar clubes de nome parecido. */
export const uf = (equipe) => (equipe.match(/\(([A-Z]{2})\)$/) ?? [, ""])[1];
