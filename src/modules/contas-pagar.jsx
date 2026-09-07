// ═══════════════════════════════════════════════════════════════
// CONTAS A PAGAR DA OBRA
// ═══════════════════════════════════════════════════════════════
// Salvar um contrato alimenta o fluxo de contas a pagar da obra: cada
// parcela da modalidade de pagamento vira uma conta com vencimento, valor e
// status. Regravar o contrato atualiza as parcelas em aberto e preserva o
// que já foi pago.
//
// As contas moram dentro da obra (obra.contasPagar) — como os contratos e a
// estimativa —, porque é a obra que o backend grava como documento JSON.
//
// Cada conta carrega o `contaId` do plano de contas (obra-financeiro.jsx),
// de modo que o que for pago já entra no realizado da obra, ao lado da
// estimativa do Planejamento.

// Tipo de profissional → conta do plano de contas. O que não tem conta
// própria cai em "mo_diversos".
const CONTA_POR_TIPO = {
  empreiteiro: "empreiteiro",
  eletricista: "eletricista",
  encanador: "encanador",
  pintor: "pintor",
  carpinteiro: "carpinteiro",
  marceneiro: "marceneiro",
  serralheiro: "serralheiro",
  gesseiro: "gesseiro",
  impermeabilizador: "impermeabilizacao",
  instaladorAr: "instalador_ar",
  terraplanagem: "terraplanagem",
  gestaoObra: "mo_diversos",
  instaladorAquecedores: "mo_diversos",
  equipPiscina: "mo_diversos",
  outro: "mo_diversos",
};
function contaDoTipo(tipoId) {
  const id = CONTA_POR_TIPO[tipoId] || "mo_diversos";
  return (typeof PLANO_CONTAS !== "undefined" && PLANO_CONTAS.some((c) => c.id === id)) ? id : "mo_diversos";
}

// ── Datas ───────────────────────────────────────────────────────
function isoParaData(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
function dataParaIso(d) {
  if (!d || isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function somarDias(iso, n) {
  const d = isoParaData(iso);
  if (!d) return "";
  d.setDate(d.getDate() + n);
  return dataParaIso(d);
}
function somarMeses(iso, n) {
  const d = isoParaData(iso);
  if (!d) return "";
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  // 31 de janeiro + 1 mês vira o último dia de fevereiro, não 3 de março
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
  return dataParaIso(d);
}
const DIAS_PERIODO = { semanais: 7, quinzenais: 15, mensais: 30 };
// Data-âncora do cronograma: o início previsto quando houver, senão a
// assinatura. Sem nenhuma das duas, as parcelas saem sem vencimento.
function ancoraContrato(c) {
  const o = c || {};
  return o.dataInicio || o.dataAssinatura || "";
}

// ── Parcelas do contrato ────────────────────────────────────────
// Traduz a modalidade de pagamento numa lista de parcelas com data e valor.
// É o mesmo racional do texto do contrato — quem muda um, muda o outro.
function parcelasAPagar(contrato) {
  const c = contrato || {};
  const total = valorContrato(c);
  const modo = modalidadeContrato(c);
  const ancora = ancoraContrato(c);
  const per = c.periodicidade || "quinzenais";
  const passo = DIAS_PERIODO[per] || 15;
  const rotuloPer = per === "semanais" ? "semanal" : per === "mensais" ? "mensal" : "quinzenal";
  const linhas = [];

  if (modo === "parcelado") {
    const n = Math.max(0, Math.floor(Number(c.parcelas) || 0));
    if (!n || !total) return [];
    const p = parcelasContrato(total, n);
    for (let i = 1; i <= n; i++) {
      linhas.push({
        n: i,
        descricao: `Parcela ${i}/${n} (${rotuloPer})`,
        valor: i === n ? p.ultima : p.base,
        vencimento: ancora ? somarDias(ancora, passo * i) : "",
      });
    }
  } else if (modo === "entradaParcelas") {
    const n = Math.max(0, Math.floor(Number(c.parcelas) || 0));
    const e = entradaESaldo(total, c.entradaPct, n || 1);
    if (e.entrada > 0) linhas.push({ n: 1, descricao: "Entrada", valor: e.entrada, vencimento: c.dataAssinatura || ancora });
    if (n && e.saldo > 0) {
      for (let i = 1; i <= n; i++) {
        linhas.push({
          n: linhas.length + 1,
          descricao: `Parcela ${i}/${n} (${rotuloPer})`,
          valor: i === n ? e.parcelas.ultima : e.parcelas.base,
          vencimento: ancora ? somarDias(ancora, passo * i) : "",
        });
      }
    }
  } else if (modo === "entradaFinal") {
    const porItem = (c.entradaEscopo || "contrato") === "item";
    const itens = (c.itens || []).filter((i) => i && (String(i.descricao || "").trim() || Number(i.valor)));
    const pct = (Number(c.entradaPct) || 0) / 100;
    if (porItem && itens.length) {
      // sem data: cada metade vence na liberação e na conclusão do item
      itens.forEach((it, idx) => {
        const v = Number(it.valor) || 0;
        const p1 = Math.floor(v * pct * 100) / 100;
        const nome = it.descricao || `Item ${idx + 1}`;
        linhas.push({ n: linhas.length + 1, descricao: `${nome} — entrada`, valor: p1, vencimento: "" });
        linhas.push({ n: linhas.length + 1, descricao: `${nome} — conclusão`, valor: Math.round((v - p1) * 100) / 100, vencimento: "" });
      });
    } else {
      const e = entradaESaldo(total, c.entradaPct, 1);
      if (e.entrada > 0) linhas.push({ n: 1, descricao: "Entrada", valor: e.entrada, vencimento: c.dataAssinatura || ancora });
      if (e.saldo > 0) linhas.push({ n: linhas.length + 1, descricao: "Saldo na conclusão", valor: e.saldo, vencimento: vencimentoFinal(c) });
    }
  } else if (modo === "medicao") {
    // uma medição por período dentro do prazo, com valor estimado
    const n = medicoesPrevistas(c);
    if (!n || !total) return [];
    const p = parcelasContrato(total, n);
    const perMed = c.medicaoPeriodicidade === "semanal" ? 7 : c.medicaoPeriodicidade === "quinzenal" ? 15 : 30;
    const prazoPag = Math.max(0, Math.floor(Number(c.medicaoPrazoDias) || 0));
    for (let i = 1; i <= n; i++) {
      linhas.push({
        n: i,
        descricao: `Medição ${i}/${n} (estimada)`,
        valor: i === n ? p.ultima : p.base,
        vencimento: ancora ? somarDias(ancora, perMed * i + prazoPag) : "",
        estimada: true,
      });
    }
  }
  return linhas;
}
// Quantas medições cabem no prazo contratado.
function medicoesPrevistas(c) {
  const pz = prazoContrato(c);
  const qtd = Number(pz.qtd) || 0;
  if (!qtd) return 0;
  const dias = pz.unidade === "meses" ? qtd * 30 : qtd;
  const per = c.medicaoPeriodicidade === "semanal" ? 7 : c.medicaoPeriodicidade === "quinzenal" ? 15 : 30;
  return Math.max(1, Math.floor(dias / per));
}
// Fim do prazo, contado da âncora.
function vencimentoFinal(c) {
  const ancora = ancoraContrato(c);
  const pz = prazoContrato(c);
  const qtd = Number(pz.qtd) || 0;
  if (!ancora || !qtd) return "";
  return pz.unidade === "meses" ? somarMeses(ancora, qtd) : somarDias(ancora, qtd);
}

// ── Contas geradas pelo contrato ────────────────────────────────
function contasDoContrato(contrato) {
  const c = contrato || {};
  return parcelasAPagar(c).map((p, idx) => ({
    id: `${c.id}:${idx + 1}`,
    origem: "contrato",
    contratoId: c.id,
    obraId: c.obraId,
    parcela: idx + 1,
    contaId: contaDoTipo(c.tipoProfissional),
    prestadorId: c.prestadorId || "",
    favorecido: c.nomeContratado || "",
    descricao: p.descricao,
    valor: p.valor,
    vencimento: p.vencimento || "",
    estimada: !!p.estimada,
    pago: false,
    pagoEm: "",
    valorPago: "",
    observacao: "",
  }));
}

// Regrava as contas de um contrato dentro da lista da obra:
//  - contas avulsas e de outros contratos ficam intactas;
//  - o que já foi pago é preservado como está (inclusive o valor pago);
//  - o resto é regerado a partir do contrato atual.
function sincronizarContasDoContrato(contas, contrato) {
  const lista = contas || [];
  const c = contrato || {};
  const outras = lista.filter((x) => x.origem !== "contrato" || x.contratoId !== c.id);
  const antigas = lista.filter((x) => x.origem === "contrato" && x.contratoId === c.id);
  const pagas = antigas.filter((x) => x.pago);
  const geradas = contasDoContrato(c).map((nova) => {
    const anterior = antigas.find((x) => x.id === nova.id);
    if (anterior && anterior.pago) return anterior;
    return anterior ? { ...nova, observacao: anterior.observacao || "" } : nova;
  });
  // parcela paga que não existe mais no contrato continua na lista: o
  // dinheiro saiu, e sumir com ela esconderia um pagamento real
  const orfas = pagas.filter((x) => !geradas.some((g) => g.id === x.id));
  return [...outras, ...geradas, ...orfas];
}
// Some as contas de um contrato removido, menos as que já foram pagas.
function removerContasDoContrato(contas, contratoId) {
  return (contas || []).filter((x) => x.origem !== "contrato" || x.contratoId !== contratoId || x.pago);
}

// ── Situação e totais ───────────────────────────────────────────
function situacaoConta(conta, hoje) {
  const c = conta || {};
  if (c.pago) return "pago";
  const venc = c.vencimento;
  if (!venc) return "semData";
  const hojeIso = hoje || dataParaIso(new Date());
  if (venc < hojeIso) return "vencido";
  if (venc <= somarDias(hojeIso, 7)) return "vencendo";
  return "aberto";
}
// Rótulos em texto, sem cor — a tela é neutra, como o resto do app. `forte`
// só marca o que o olho precisa achar primeiro (o que está vencido).
const SITUACAO_CONTA = {
  vencido:  { label: "Vencida",     forte: true },
  vencendo: { label: "Vence em 7d", forte: false },
  aberto:   { label: "Em aberto",   forte: false },
  semData:  { label: "Sem data",    forte: false },
  pago:     { label: "Paga",        forte: false },
};
function totaisContas(contas, hoje) {
  const r = { total: 0, aberto: 0, vencido: 0, pago: 0, qtdAberto: 0, qtdVencido: 0 };
  for (const c of contas || []) {
    const v = Number(c.valor) || 0;
    r.total += v;
    if (c.pago) { r.pago += Number(c.valorPago) || v; continue; }
    r.aberto += v; r.qtdAberto++;
    if (situacaoConta(c, hoje) === "vencido") { r.vencido += v; r.qtdVencido++; }
  }
  const red = (x) => Math.round(x * 100) / 100;
  return { total: red(r.total), aberto: red(r.aberto), vencido: red(r.vencido), pago: red(r.pago), qtdAberto: r.qtdAberto, qtdVencido: r.qtdVencido };
}
// Realizado por conta do plano de contas — é o que o Planejamento compara
// com a estimativa.
function realizadoPorConta(contas) {
  const r = {};
  for (const c of contas || []) {
    if (!c.pago) continue;
    const k = c.contaId || "mo_diversos";
    r[k] = Math.round(((r[k] || 0) + (Number(c.valorPago) || Number(c.valor) || 0)) * 100) / 100;
  }
  return r;
}
function realizadoPorPrestador(contas) {
  const r = {};
  for (const c of contas || []) {
    if (!c.pago) continue;
    const k = c.prestadorId || "__sem_prestador__";
    r[k] = Math.round(((r[k] || 0) + (Number(c.valorPago) || Number(c.valor) || 0)) * 100) / 100;
  }
  return r;
}
// Conta avulsa, fora de contrato.
function contaAvulsaVazia(obraId) {
  return {
    id: (typeof uid === "function" ? uid() : String(Date.now())),
    origem: "avulsa", obraId, contratoId: "", parcela: 0,
    contaId: (typeof PLANO_CONTAS !== "undefined" && PLANO_CONTAS[0] ? PLANO_CONTAS[0].id : "material"),
    prestadorId: "", favorecido: "", descricao: "", valor: "",
    vencimento: dataParaIso(new Date()),
    pago: false, pagoEm: "", valorPago: "", observacao: "",
  };
}
