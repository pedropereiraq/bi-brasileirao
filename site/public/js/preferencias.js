/**
 * O que o BI lembra de uma página para a outra.
 *
 * Série e equipe são escolhas sobre **o que** se está olhando, e não sobre
 * como: quem estava vendo a Série B do Remo e troca de tela quer continuar na
 * Série B do Remo. Os outros filtros são da pergunta de cada tela — rodada,
 * recorte, ordenação — e por isso cada uma volta ao padrão dela.
 *
 * O link ganha da memória: um endereço com `#serie=B` abre na Série B mesmo
 * que a última visita tenha sido na A, senão compartilhar um card deixaria de
 * funcionar.
 */
const CHAVES = { serie: "bi-serie", equipe: "bi-equipe" };

function ler(chave) {
  try {
    return localStorage.getItem(chave) || null;
  } catch {
    return null;
  }
}

function gravar(chave, valor) {
  if (!valor) return valor;
  try { localStorage.setItem(chave, valor); } catch { /* sem memória */ }
  return valor;
}

export const serieLembrada = () => ler(CHAVES.serie);
export const lembrarSerie = (serie) => gravar(CHAVES.serie, serie);

export const equipeLembrada = () => ler(CHAVES.equipe);
export const lembrarEquipe = (equipe) => gravar(CHAVES.equipe, equipe);
