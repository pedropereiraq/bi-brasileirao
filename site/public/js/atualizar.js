import { coletarSerie, depositar } from "/js/coleta.js";

const SERIES = ["A", "B"];
const botao = document.querySelector("#atualizar");
const progresso = document.querySelector("#progresso");
const barra = document.querySelector("#barra");
const passo = document.querySelector("#passo");
const recado = document.querySelector("#recado");
const situacao = document.querySelector("#situacao");

const anoCorrente = () =>
  Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
    }).format(new Date())
  );

botao.addEventListener("click", atualizar);
mostrarEstado();
setInterval(mostrarEstado, 20000);

async function atualizar() {
  const ano = anoCorrente();
  botao.disabled = true;
  progresso.hidden = false;
  dizer("", "");

  let entrega = null;
  try {
    // Uma série de cada vez: a barra fica honesta e a fonte não leva rajada.
    for (const [indice, serie] of SERIES.entries()) {
      const base = indice * 50;
      const { eventos, semTabela } = await coletarSerie(serie, ano, (feitas, total) => {
        andar(base + (feitas / total) * 45, `Série ${serie}: rodada ${feitas} de ${total}`);
      });

      andar(base + 47, `Série ${serie}: entregando ${eventos.length} registros`);
      entrega = await depositar(serie, ano, eventos);

      if (semTabela.length) {
        console.info(`Série ${serie}: rodadas sem tabela publicada`, semTabela);
      }
    }

    // O depósito e o pedido de recálculo são duas coisas, e podem terminar
    // diferente: o bruto é guardado antes, e o pedido ao GitHub pode falhar
    // depois. Anunciar "está rodando" nesse caso é a própria tela mentindo —
    // foi o que escondeu um token vencido por dois dias.
    if (entrega?.recalculo === "pedido") {
      andar(100, "Recálculo pedido");
      dizer(
        "Dados entregues. O recálculo está rodando e leva alguns minutos — " +
          "pode fechar a aba, ele não depende dela.",
        "bom"
      );
    } else {
      andar(100, "Dados entregues, recálculo não");
      dizer(
        `Os dados foram entregues e estão guardados, mas o recálculo não foi `
          + `pedido: ${entrega?.recalculo ?? "motivo desconhecido"}. Os números `
          + `do site continuam os de antes até o pedido passar.`,
        "ruim"
      );
    }
  } catch (e) {
    andar(0, "");
    dizer(e.message, "ruim");
  } finally {
    botao.disabled = false;
    mostrarEstado();
  }
}

function andar(porcento, texto) {
  barra.style.width = `${Math.min(100, Math.max(0, porcento))}%`;
  passo.textContent = texto;
}

function dizer(texto, tipo) {
  recado.textContent = texto;
  recado.className = `recado ${tipo}`;
}

async function mostrarEstado() {
  let estado = {};
  try {
    estado = await (await fetch("/api/estado", { cache: "no-store" })).json();
  } catch {
    return;
  }
  const ano = anoCorrente();

  for (const serie of SERIES) {
    const dado = estado[`${serie}:${ano}`];
    escrever(
      serie,
      dado
        ? `${dado.eventos} registros · ${quando(dado.depositado_em)}`
        : "nunca atualizada"
    );
  }

  // O motivo da falha vem junto no estado; escondê-lo deixava a tela dizendo
  // "não foi possível pedir" sem dizer por quê, que é a única coisa que
  // importa quando isso acontece.
  const r = estado.recalculo;
  escrever(
    "recalculo",
    r ? [r.situacao, r.erro, quando(r.em)].filter(Boolean).join(" · ") : "—"
  );
}

function escrever(campo, texto) {
  const alvo = situacao.querySelector(`[data-campo="${campo}"]`);
  if (alvo) alvo.textContent = texto;
}

function quando(iso) {
  if (!iso) return "—";
  const data = new Date(iso);
  const minutos = Math.round((Date.now() - data) / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}
