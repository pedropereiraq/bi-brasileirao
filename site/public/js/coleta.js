/**
 * A coleta roda AQUI, no navegador de quem apertou o botão.
 *
 * O Sofascore recusa IP de datacenter — medido: 403 de três runners do GitHub e
 * de um Cloudflare Worker, 200 de conexão residencial. Mas ele recusa também
 * pelo cabeçalho `Referer`: uma requisição com `Referer` de outro site leva 403
 * mesmo vindo de um IP aceito.
 *
 * As duas coisas se resolvem daqui: o navegador de vocês está num IP
 * residencial, e `referrerPolicy: "no-referrer"` tira o `Referer`. O Sofascore
 * ainda manda `access-control-allow-origin: *`, então o CORS deixa ler.
 *
 * Medido em 28/08/2026: 14 de 14 requisições em 4,5 s, Séries A e B, rodadas 1
 * a 38, sem limite de taxa.
 *
 * **03/10/2026: o endereço mudou.** `api.sofascore.com` passou a responder 403
 * a tudo — de IP residencial, de 5G, de outra pessoa em outra casa, e até de
 * dentro do site deles com o Referer certo. O site do Sofascore continuou
 * funcionando porque ele passou a chamar `www.sofascore.com/api/v1`, mesmos
 * caminhos e mesmo CORS aberto. É o host daqui de baixo.
 *
 * O que sai daqui é o JSON íntegro, sem tratamento nenhum. Normalizar é
 * trabalho do motor Python, que é o que está provado contra a matriz do Excel.
 */

const TORNEIOS = { A: 325, B: 390 };
const TEMPORADAS = { "A:2026": 87678, "B:2026": 89840 };
const RODADAS = 38;
const BASE = "https://www.sofascore.com/api/v1";

// Sem Referer, sem cookie, sem cache — é o que a fonte aceita.
const OPCOES = { referrerPolicy: "no-referrer", credentials: "omit", cache: "no-store" };

export async function buscarJson(caminho) {
  const resposta = await fetch(BASE + caminho, OPCOES);
  if (resposta.status === 404) return null; // rodada ainda não sorteada
  if (!resposta.ok) {
    // O 403 tem duas causas possíveis, e o teste que as separa é trocar de
    // conexão: se só a sua falha, é a conexão; se nenhuma funciona, mudou do
    // lado deles — foi o que aconteceu em 03/10/2026, e a mensagem antiga,
    // que só falava em VPN, mandou todo mundo para o lado errado.
    throw new Error(
      `HTTP ${resposta.status} em ${caminho}. Se for 403: teste de outra ` +
      `conexão, porque VPN e saída em datacenter costumam ser recusadas. Se ` +
      `nenhuma conexão funcionar, a mudança foi do lado da fonte.`
    );
  }
  return resposta.json();
}

async function descobrirTemporada(serie, ano) {
  const conhecida = TEMPORADAS[`${serie}:${ano}`];
  if (conhecida) return conhecida;
  const dados = await buscarJson(`/unique-tournament/${TORNEIOS[serie]}/seasons`);
  const achada = (dados?.seasons ?? []).find((t) => String(t.year) === String(ano));
  if (!achada) throw new Error(`temporada ${ano} não encontrada para a Série ${serie}`);
  return achada.id;
}

/**
 * Baixa as 38 rodadas de uma série. `aoAndar` recebe (feitas, total) para a
 * barra de progresso.
 */
export async function coletarSerie(serie, ano, aoAndar = () => {}) {
  const temporada = await descobrirTemporada(serie, ano);
  const torneio = TORNEIOS[serie];
  const eventos = [];
  const semTabela = [];

  for (let rodada = 1; rodada <= RODADAS; rodada++) {
    const dados = await buscarJson(
      `/unique-tournament/${torneio}/season/${temporada}/events/round/${rodada}`
    );
    if (dados === null) semTabela.push(rodada);
    else eventos.push(...(dados.events ?? []));
    aoAndar(rodada, RODADAS);
  }

  if (eventos.length === 0) {
    throw new Error(`Série ${serie} ${ano}: a fonte não devolveu evento nenhum`);
  }
  return { eventos, semTabela };
}

/** Entrega o bruto ao site, que guarda antes de qualquer normalização. */
export async function depositar(serie, ano, eventos) {
  const resposta = await fetch("/api/coletar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ serie, ano, eventos }),
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(corpo.erro ?? `o site recusou o depósito (HTTP ${resposta.status})`);
  }
  return corpo;
}
