// ═══════════════════════════════════════════════════════════════
// CONTAS A RECEBER — o espelho do Contas a pagar, para o escritório
// ═══════════════════════════════════════════════════════════════
// Tudo o que o escritório tem a receber, numa lista só, por vencimento:
//   - Projetos: as parcelas dos orçamentos ganhos (fechamento.condicao);
//   - Gerenciamento: os honorários das obras (a conta da obra que atravessa
//     para Receita Gestão) — a baixa é feita na obra, que é quem manda para
//     o extrato;
//   - Vendas de empreendimento e outras receitas: cadastradas aqui, com
//     entrada e parcelas.
// Receber = o dinheiro entrou: vira o lançamento do escritório (Receita
// Projetos, Venda de imóvel, a conta escolhida…), no mês do dia informado.
// Se o extrato do banco já trouxe esse dinheiro e ele já foi lançado, o
// recebimento LIGA a esse lançamento em vez de criar outro.
//
// As contas a receber cadastradas aqui moram junto dos lançamentos, com
// tipo "receber": ganham versão e histórico como eles, e nunca entram nas
// contas do extrato (lancamentosDoEscritorio só olha tipo "escritorio").

// ── A receber: parte pura ──────────────────────────────────────
function crHoje() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function crCent(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function crValor(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof numeroDeCampo === "function") return Number(numeroDeCampo(v)) || 0;
  const s = String(v == null ? "" : v).replace(/[R$\s]/g, "").trim();
  // "20.000" sem vírgula é milhar, como no resto do app
  const limpo = s.indexOf(",") >= 0 ? s.replace(/\./g, "").replace(",", ".")
    : /^-?\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s;
  const n = parseFloat(limpo);
  return Number.isFinite(n) ? n : 0;
}
// Soma meses a uma data "AAAA-MM-DD" sem passar pelo fuso: o dia 31 vira o
// último dia do mês curto (31/01 + 1 = 28/02; + 2 = 31/03).
function crSomarMeses(iso, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return "";
  const ano = Number(m[1]), mes = Number(m[2]) - 1 + (Number(n) || 0), dia = Number(m[3]);
  const a = ano + Math.floor(mes / 12), mm = ((mes % 12) + 12) % 12;
  const ultimo = new Date(a, mm + 1, 0).getDate();
  return `${a}-${String(mm + 1).padStart(2, "0")}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
}
function crDataBR(iso) {
  const s = String(iso || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split("-").reverse().join("/") : "";
}

// Entrada + N parcelas mensais iguais; o centavo que sobra vai na última.
// Devolve as parcelas (somando o total) ou { erro }.
function crGerarParcelas(f) {
  const total = crCent(crValor(f && f.valorTotal));
  if (!(total > 0)) return { erro: "Informe o valor total." };
  const entrada = crCent(crValor(f.entrada));
  if (entrada < 0 || entrada > total) return { erro: "A entrada não pode passar do valor total." };
  const resto = crCent(total - entrada);
  const n = resto > 0 ? Math.max(1, parseInt(String(f.nParcelas || "").replace(/\D/g, ""), 10) || 1) : 0;
  const out = [];
  if (entrada > 0) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(f.dataEntrada || ""))) return { erro: "Informe a data da entrada." };
    out.push({ rotulo: "Entrada", valor: entrada, vencimento: f.dataEntrada });
  }
  if (n > 0) {
    const primeiro = String(f.primeiroVencimento || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(primeiro)) return { erro: "Informe o 1º vencimento das parcelas." };
    const base = Math.floor((resto / n) * 100) / 100;
    for (let i = 0; i < n; i++) {
      const valor = i === n - 1 ? crCent(resto - base * (n - 1)) : base;
      out.push({ rotulo: n === 1 ? (entrada > 0 ? "Saldo" : "Parcela única") : `Parcela ${i + 1}/${n}`, valor, vencimento: crSomarMeses(primeiro, i) });
    }
  }
  return { parcelas: out };
}

// O cadastro vira as contas a receber (uma por parcela, ligadas pelo grupo).
//   f   { tipo: "venda"|"outro", empreendimentoId, cliente, descricao,
//         valorTotal, entrada, dataEntrada, nParcelas, primeiroVencimento,
//         contaId, unidadeId }
//   ctx { clientes, novoId(), agora, quem }
function novasContasAReceber(f, ctx) {
  const c = ctx || {};
  const d = f || {};
  const venda = d.tipo !== "outro";
  if (venda && !d.empreendimentoId) return { erro: "Escolha o empreendimento." };
  if (!String(d.descricao || "").trim()) return { erro: venda ? "Diga o que foi vendido (ex.: Casa 2 — Lote 21)." : "Descreva a receita." };
  if (!venda && !d.contaId) return { erro: "Escolha a conta da receita." };
  const r = crGerarParcelas(d);
  if (r.erro) return r;
  const novoId = typeof c.novoId === "function" ? c.novoId : () => "rc" + Math.random().toString(36).slice(2, 9);
  const grupo = novoId();
  const emp = venda ? (c.clientes || []).find((x) => x && x.id === d.empreendimentoId) : null;
  const agora = c.agora || new Date().toISOString();
  return { contas: r.parcelas.map((p, i) => ({
    id: grupo + "_" + (i + 1),
    tipo: "receber",
    grupoReceber: grupo,
    origemReceber: venda ? "venda" : "outro",
    descricao: String(d.descricao).trim(),
    rotulo: p.rotulo,
    parcela: i + 1, de: r.parcelas.length,
    cliente: String(d.cliente || "").trim(),
    empreendimentoId: venda ? d.empreendimentoId : "",
    projeto: venda && emp ? emp.nome || "" : "",
    contaId: venda ? "emp_venda" : d.contaId,
    unidadeId: venda ? "empreendimento" : (d.unidadeId || "escritorio"),
    valor: p.valor,
    vencimento: p.vencimento,
    recebido: false,
    criadoEm: agora,
    criadoPor: c.quem || "",
  })) };
}

// Tudo a receber, de todas as fontes, num formato só.
function itensAReceber(data, opcoes) {
  const d = data || {};
  const o = opcoes || {};
  const out = [];
  const lancs = d.lancamentos || [];
  const doEscritorio = lancs.filter((l) => l && l.tipo === "escritorio");
  // projetos ganhos
  if (typeof parcelasDosProjetos === "function") {
    for (const p of parcelasDosProjetos(d.orcamentosProjeto, d.clientes, doEscritorio)) {
      if (p.recebida && !o.comRecebidos) continue;
      const l = p.recebida ? doEscritorio.find((x) => x && x.id === p.lancamentoId) : null;
      out.push({ id: `proj:${p.orcId}:${p.numero}`, origem: "projeto", quem: p.cliente || "—", referencia: p.referencia || "",
        rotulo: p.rotulo.charAt(0).toUpperCase() + p.rotulo.slice(1), vencimento: p.data || "", valor: p.valor,
        recebido: !!p.recebida, recebidoEm: l ? String(l.lancadoEm || "").slice(0, 10) : "", lancamentoId: p.lancamentoId || "",
        contaId: "rec_projetos", parcela: p });
    }
  }
  // honorários de gerenciamento (a conta da obra que vira Receita Gestão)
  for (const ob of d.obras || []) {
    if (!ob) continue;
    const cli = (d.clientes || []).find((x) => x && x.id === ob.clienteId) || null;
    const modo = typeof modoDaPonte === "function" ? modoDaPonte(ob, cli) : "";
    for (const c of ob.contasPagar || []) {
      if (!c || (c.pago && !o.comRecebidos)) continue;
      // venda de unidade do empreendimento: recebe-se lá, em Vendas
      if (c.vendaId) {
        out.push({ id: `obra:${ob.id}:${c.id}`, origem: "venda", daObra: true, quem: c.favorecido || "—",
          referencia: [ob.nome, c.descricao].filter(Boolean).join(" · "), rotulo: c.descricao || "Venda",
          vencimento: String(c.vencimento || "").slice(0, 10),
          valor: crCent(c.pago ? (c.valorPago || c.valor) : c.valor), recebido: !!c.pago, recebidoEm: String(c.pagoEm || "").slice(0, 10),
          contaId: "emp_venda", obraId: ob.id, contaObraId: c.id });
        continue;
      }
      const destino = typeof destinoNoEscritorio === "function" ? destinoNoEscritorio(c.contaId, modo) : "";
      const conta = destino && typeof contaEscritorio === "function" ? contaEscritorio(destino) : null;
      if (!conta || conta.grupo !== "receitas") continue;
      out.push({ id: `obra:${ob.id}:${c.id}`, origem: "obra", quem: (cli && cli.nome) || "—", referencia: ob.nome || "",
        rotulo: [c.descricao || "Honorário", c.servico].filter(Boolean).join(" · "), vencimento: String(c.vencimento || "").slice(0, 10),
        valor: crCent(c.pago ? (c.valorPago || c.valor) : c.valor), recebido: !!c.pago, recebidoEm: String(c.pagoEm || "").slice(0, 10),
        contaId: destino, obraId: ob.id, contaObraId: c.id });
    }
  }
  // vendas e outras receitas cadastradas aqui
  for (const r of lancs) {
    if (!r || r.tipo !== "receber") continue;
    if (r.recebido && !o.comRecebidos) continue;
    out.push({ id: r.id, origem: r.origemReceber === "venda" ? "venda" : "outro", quem: r.cliente || "—",
      referencia: r.origemReceber === "venda" ? [r.projeto, r.descricao].filter(Boolean).join(" · ") : r.descricao || "",
      rotulo: r.rotulo || "", vencimento: r.vencimento || "",
      valor: crCent(r.recebido ? (r.valorRecebido != null ? r.valorRecebido : r.valor) : r.valor), recebido: !!r.recebido,
      recebidoEm: r.recebidoEm || "", lancamentoId: r.lancamentoId || "", contaId: r.contaId, conta: r });
  }
  return out.sort((a, b) => String(a.vencimento || "9999").localeCompare(String(b.vencimento || "9999")) || String(a.quem).localeCompare(String(b.quem)));
}

function resumoAReceber(itens, hoje) {
  const h = hoje || crHoje();
  const em30 = (() => { const t = new Date(h + "T12:00:00"); t.setDate(t.getDate() + 30); return t.toISOString().slice(0, 10); })();
  let vencido = 0, proximos = 0, total = 0, n = 0;
  for (const i of itens || []) {
    if (!i || i.recebido) continue;
    total += i.valor; n++;
    if (i.vencimento && i.vencimento < h) vencido += i.valor;
    else if (i.vencimento && i.vencimento <= em30) proximos += i.valor;
  }
  return { vencido: crCent(vencido), proximos: crCent(proximos), total: crCent(total), quantos: n };
}

// Lançamentos do escritório que podem ser ESTE recebimento (o extrato já o
// trouxe): mesma conta (ou, para projeto, Receita Projetos), mesmo valor,
// ainda sem dono, e perto do vencimento.
function candidatosDoRecebimento(item, data) {
  const it = item || {};
  const lancs = ((data || {}).lancamentos || []);
  const usados = new Set(lancs.filter((r) => r && r.tipo === "receber" && r.lancamentoId).map((r) => r.lancamentoId));
  const venc = String(it.vencimento || "");
  const dias = (a, b) => (/^\d{4}-\d{2}-\d{2}$/.test(a) && /^\d{4}-\d{2}-\d{2}$/.test(b)
    ? Math.abs((new Date(a + "T12:00:00") - new Date(b + "T12:00:00")) / 86400000) : 0);
  return lancs.filter((l) => l && l.tipo === "escritorio" && !usados.has(l.id)
    && l.contaId === it.contaId && Math.abs(Math.abs(Number(l.valor) || 0) - Number(it.valor || 0)) < 0.01
    && !(l.origem && (l.origem.tipo === "projeto" || l.origem.tipo === "receber" || l.origem.obraId))
    && dias(String(l.lancadoEm || (l.competencia ? l.competencia + "-15" : "")).slice(0, 10), venc) <= 60)
    .slice(0, 5);
}

// O recebimento de uma conta cadastrada aqui (venda/outro). Devolve a lista
// nova de lançamentos (com a conta marcada, o lançamento do escritório e,
// se veio menos, o saldo como nova conta a receber) ou { erro }.
//   ctx { fechamentos, novoId(), numeroDoc(lista), agora, quem, usarLancamentoId }
function receberContaAReceber(lancamentos, contaId, dia, valor, ctx) {
  const c = ctx || {};
  const lista = (lancamentos || []).slice();
  const i = lista.findIndex((x) => x && x.id === contaId && x.tipo === "receber");
  if (i < 0) return { erro: "Conta a receber não encontrada." };
  const r = lista[i];
  if (r.recebido) return { erro: "Esta conta já foi recebida." };
  const agora = c.agora || new Date().toISOString();
  if (c.usarLancamentoId) {
    const l = lista.find((x) => x && x.id === c.usarLancamentoId && x.tipo === "escritorio");
    if (!l) return { erro: "Lançamento não encontrado." };
    lista[i] = { ...r, recebido: true, recebidoEm: String(l.lancadoEm || "").slice(0, 10) || (l.competencia || "") + "-01",
      valorRecebido: crCent(Math.abs(Number(l.valor) || 0)), lancamentoId: l.id, lancamentoExistente: true, recebidoPor: c.quem || "", alteradoEm: agora };
    return { lancamentos: lista };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dia || ""))) return { erro: "Informe o dia em que o dinheiro entrou." };
  const v = crCent(Math.abs(crValor(valor)));
  if (!(v > 0)) return { erro: "Informe o valor recebido." };
  if (v > crCent(r.valor) + 0.005) return { erro: "O valor passa do que falta receber nesta parcela (" + crCent(r.valor).toFixed(2).replace(".", ",") + ")." };
  const competencia = String(dia).slice(0, 7);
  if (typeof bloqueioPorMesFechado === "function") {
    const trava = bloqueioPorMesFechado(competencia, c.fechamentos || {});
    if (trava) return { erro: trava };
  }
  const novoId = typeof c.novoId === "function" ? c.novoId : () => "l" + Math.random().toString(36).slice(2, 9);
  const id = novoId();
  const lanc = {
    id, tipo: "escritorio", contaId: r.contaId, unidadeId: r.unidadeId || "escritorio",
    cliente: r.cliente || "", clienteId: r.empreendimentoId || "", empreendimentoId: r.empreendimentoId || "",
    projeto: r.projeto || "", valor: v, competencia, lancadoEm: String(dia),
    descricao: `${r.origemReceber === "venda" ? "Venda" : "Recebimento"} — ${r.descricao}${r.rotulo ? " · " + r.rotulo : ""}`,
    contaBanco: "sim", origem: { tipo: "receber", refId: r.id }, criadoEm: agora,
    numeroDoc: typeof c.numeroDoc === "function" ? c.numeroDoc(lista) : "",
  };
  lista[i] = { ...r, valor: v, recebido: true, recebidoEm: String(dia), valorRecebido: v, lancamentoId: id, recebidoPor: c.quem || "", alteradoEm: agora };
  lista.push(lanc);
  const falta = crCent(crCent(r.valor) - v);
  if (falta > 0) {
    lista.push({ ...r, id: r.id + "_s" + Date.now().toString(36), valor: falta, rotulo: (r.rotulo || "Parcela") + " (saldo)",
      recebido: false, recebidoEm: "", valorRecebido: undefined, lancamentoId: "", criadoEm: agora });
  }
  return { lancamentos: lista, lancamento: lanc, falta };
}

// Desfazer: a conta volta a aberta. O lançamento que o recebimento criou sai
// (se o mês não está fechado e ele não foi conferido com o banco); o que já
// existia e foi só ligado, fica.
function desfazerRecebimento(lancamentos, contaId, ctx) {
  const c = ctx || {};
  const lista = (lancamentos || []).slice();
  const i = lista.findIndex((x) => x && x.id === contaId && x.tipo === "receber");
  if (i < 0) return { erro: "Conta a receber não encontrada." };
  const r = lista[i];
  if (!r.recebido) return { erro: "Esta conta não está recebida." };
  const l = lista.find((x) => x && x.id === r.lancamentoId);
  if (l && !r.lancamentoExistente) {
    if (typeof bloqueioPorMesFechado === "function") {
      const trava = bloqueioPorMesFechado(l.competencia, c.fechamentos || {});
      if (trava) return { erro: trava + " Reabra o mês no Fechamento para desfazer." };
    }
    if (l.conferido && l.extratoId) return { erro: "O recebimento já foi conferido com o extrato do banco — desfaça a conferência antes." };
  }
  const { recebidoEm, valorRecebido, lancamentoId, lancamentoExistente, recebidoPor, ...resto } = r;
  lista[i] = { ...resto, recebido: false, alteradoEm: c.agora || new Date().toISOString() };
  return { lancamentos: lista.filter((x) => !(x && l && !r.lancamentoExistente && x.id === l.id)) };
}

// Parcela de projeto já lançada pelo extrato (sem a ligação de origem):
// ganha a ligação, e sai do "a receber" sem outro lançamento.
function ligarParcelaDeProjeto(lancamentos, parcela, lancamentoId) {
  const lista = (lancamentos || []).slice();
  const i = lista.findIndex((x) => x && x.id === lancamentoId && x.tipo === "escritorio");
  if (i < 0 || !parcela) return { erro: "Lançamento não encontrado." };
  if (lista[i].origem) return { erro: "Este lançamento já está ligado a outra coisa." };
  lista[i] = { ...lista[i], origem: { tipo: "projeto", orcId: parcela.orcId, parcela: parcela.numero, parte: "recebido" } };
  return { lancamentos: lista };
}
// ── Vendas do empreendimento ────────────────────────────────────
// As unidades (com o preço estimado) e a venda de cada uma: sinal (um ou
// mais), parcelas e a liberação do financiamento do banco. O que falta
// receber mora nas contas da obra com a conta "Venda de imóvel" e o
// `vendaId` — recebida, a ponte leva para o escritório (Venda de imóvel do
// empreendimento), como qualquer baixa da obra. Ficam fora do contas a pagar.
const CR_PARTES_DA_VENDA = { sinal: "Sinal", parcela: "Parcela", financiamento: "Financiamento" };
function unidadesDaObra(obra) { return ((obra || {}).unidadesVenda || []).filter(Boolean); }
function vendasDaObra(obra) { return ((obra || {}).vendas || []).filter(Boolean); }
function contasDaVenda(contas, vendaId) {
  const ordem = { sinal: 0, parcela: 1, financiamento: 2 };
  return (contas || []).filter((c) => c && c.vendaId === vendaId)
    .sort((a, b) => (ordem[a.parteVenda] - ordem[b.parteVenda]) || String(a.vencimento || a.pagoEm || "").localeCompare(String(b.vencimento || b.pagoEm || "")));
}
// Os sinais que já entraram na obra (Venda de imóvel, pagos, sem venda): a
// venda nova os aproveita em vez de lançar de novo.
function entradasDeVendaSoltas(contas) {
  return (contas || []).filter((c) => c && c.contaId === "venda_imovel" && c.pago && !c.vendaId);
}
// A venda e o que falta receber. `f`: { unidadeId, comprador, data, valor,
// sinais: [{ valor, data, contaId? }], nParcelas, valorParcela,
// primeiroVencimento, financiamento, dataFinanciamento }.
function planoDaVenda(f, ctx) {
  const o = ctx || {};
  const d = f || {};
  const un = (o.unidades || []).find((u) => u && u.id === d.unidadeId);
  if (!un) return { erro: "Escolha a unidade." };
  if (!String(d.comprador || "").trim()) return { erro: "Informe o comprador." };
  const valor = crCent(crValor(d.valor));
  if (!(valor > 0)) return { erro: "Informe o valor da venda." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.data || ""))) return { erro: "Informe a data da venda." };
  const soltas = new Map(entradasDeVendaSoltas(o.contas).map((c) => [c.id, c]));
  const sinais = (d.sinais || []).map((x) => {
    if (x && x.contaId) { const c = soltas.get(x.contaId); return c ? { contaId: c.id, valor: crCent(Number(c.valorPago) || Number(c.valor)), data: c.pagoEm || c.vencimento || "" } : null; }
    return { valor: crCent(crValor(x && x.valor)), data: String((x && x.data) || "") };
  }).filter((x) => x && x.valor > 0);
  for (const x of sinais) if (!x.contaId && !/^\d{4}-\d{2}-\d{2}$/.test(x.data)) return { erro: "Informe a data de cada sinal." };
  const n = Math.max(0, Math.floor(Number(d.nParcelas) || 0));
  const vp = crCent(crValor(d.valorParcela));
  if (n > 0 && !(vp > 0)) return { erro: "Informe o valor de cada parcela." };
  if (n > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(String(d.primeiroVencimento || ""))) return { erro: "Informe o 1º vencimento das parcelas." };
  const fin = crCent(crValor(d.financiamento));
  if (fin > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(String(d.dataFinanciamento || ""))) return { erro: "Informe a data prevista da liberação do financiamento." };
  const soma = crCent(sinais.reduce((t, x) => t + x.valor, 0) + n * vp + fin);
  if (Math.abs(soma - valor) > 0.01) {
    const dif = crCent(valor - soma);
    return { erro: `Sinal + parcelas + financiamento dão ${crBRL(soma)}; a venda é ${crBRL(valor)} — ${dif > 0 ? "faltam" : "sobram"} ${crBRL(Math.abs(dif))}.` };
  }
  const vendaId = o.novoId ? o.novoId() : "v" + Date.now().toString(36);
  const agora = o.agora || new Date().toISOString();
  const comprador = String(d.comprador).trim();
  const base = (parte, k, de, valorParte, venc) => ({
    id: o.novoId ? o.novoId() : vendaId + "_" + parte + k, obraId: o.obraId || "", origem: "avulsa",
    descricao: `${un.nome} · ${CR_PARTES_DA_VENDA[parte]}${de > 1 ? ` ${k}/${de}` : ""}`, favorecido: comprador,
    contaId: "venda_imovel", etapa: "outros", valor: valorParte, vencimento: venc, pago: false, pagoEm: "", valorPago: "",
    vendaId, parteVenda: parte, ...(de > 1 ? { parcela: k, totalParcelas: de } : {}), criadoEm: agora,
    registros: [{ em: agora, ato: "criada", por: o.quem || "", detalhe: `venda da ${un.nome} a ${comprador}` }],
  });
  const novas = [];
  const ligar = [];
  const sinaisNovos = sinais.filter((x) => !x.contaId);
  sinais.forEach((x) => { if (x.contaId) ligar.push(x.contaId); });
  sinaisNovos.forEach((x, i) => novas.push(base("sinal", i + 1, sinaisNovos.length, x.valor, x.data)));
  for (let k = 1; k <= n; k++) novas.push(base("parcela", k, n, vp, crSomarMeses(d.primeiroVencimento, k - 1)));
  if (fin > 0) novas.push(base("financiamento", 1, 1, fin, d.dataFinanciamento));
  const venda = { id: vendaId, unidadeId: un.id, comprador, data: d.data, valor, criadoEm: agora, por: o.quem || "",
    ...(String(d.observacao || "").trim() ? { observacao: String(d.observacao).trim() } : {}) };
  return { venda, novas, ligar };
}
function obraComVenda(obra, plano) {
  const o = obra || {};
  const ligar = new Set(plano.ligar || []);
  const contas = (o.contasPagar || []).map((c) => (c && ligar.has(c.id) ? { ...c, vendaId: plano.venda.id, parteVenda: "sinal" } : c))
    .concat(plano.novas || []);
  return { ...o, vendas: vendasDaObra(o).concat([plano.venda]), contasPagar: contas };
}
// Desfazer a venda: sai a venda e o que ainda não foi recebido. O que já foi
// recebido (o sinal que entrou) fica na obra como estava antes, sem a venda.
function obraSemVenda(obra, vendaId) {
  const o = obra || {};
  const contas = [];
  for (const c of o.contasPagar || []) {
    if (!c || c.vendaId !== vendaId) { contas.push(c); continue; }
    if (!c.pago) continue;
    const { vendaId: _v, parteVenda: _p, ...resto } = c;
    contas.push(resto);
  }
  return { ...o, vendas: vendasDaObra(o).filter((v) => v.id !== vendaId), contasPagar: contas };
}
// O quadro das unidades: a venda de cada uma, o recebido e o que falta.
function resumoDasVendas(obra) {
  const contas = (obra || {}).contasPagar || [];
  const vendas = vendasDaObra(obra);
  const linhas = unidadesDaObra(obra).map((u) => {
    const v = vendas.find((x) => x.unidadeId === u.id) || null;
    const cs = v ? contasDaVenda(contas, v.id) : [];
    const recebido = crCent(cs.filter((c) => c.pago).reduce((t, c) => t + (Number(c.valorPago) || Number(c.valor) || 0), 0));
    const aReceber = crCent(cs.filter((c) => !c.pago).reduce((t, c) => t + (Number(c.valor) || 0), 0));
    return { unidade: u, venda: v, contas: cs, recebido, aReceber, estimado: crCent(crValor(u.precoEstimado)) };
  });
  const soma = (k) => crCent(linhas.reduce((t, l) => t + (Number(l[k]) || 0), 0));
  return { linhas, unidades: linhas.length, vendidas: linhas.filter((l) => l.venda).length,
    estimado: soma("estimado"), vendido: crCent(linhas.reduce((t, l) => t + (l.venda ? l.venda.valor : 0), 0)),
    recebido: soma("recebido"), aReceber: soma("aReceber") };
}
function crBRL(v) { return "R$ " + crCent(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// ── A receber: fim da parte pura ───────────────────────────────

const CR_ORIGENS = [
  ["", "Todos"], ["projeto", "Projetos"], ["obra", "Gerenciamento"], ["venda", "Vendas"], ["outro", "Outras"],
];
const CR_ROTULO_ORIGEM = { projeto: "Projeto", obra: "Gerenciamento", venda: "Venda", outro: "Receita" };

function ContasAReceber({ data, save, aoAbrirObra }) {
  const S = typeof EF_ESTILO !== "undefined" ? EF_ESTILO : {};
  const [filtro, setFiltro] = useState("");
  // os quadros do topo e a barra clicada no gráfico filtram a lista, como no
  // Contas a pagar da obra
  const [quadro, setQuadro] = useState("aPagar");
  const [mesGrafico, setMesGrafico] = useState("");
  const [abrindo, setAbrindo] = useState("");
  const [dia, setDia] = useState("");
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState("");
  const [novo, setNovo] = useState(null);
  const [estreito, setEstreito] = useState(typeof window !== "undefined" && window.innerWidth < 640);
  useEffect(() => {
    const f = () => setEstreito(window.innerWidth < 640);
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  const perm = typeof getPermissoes === "function" ? getPermissoes() : { podeEditar: true, podeExcluir: true };
  const hoje = crHoje();
  const quem = typeof nomeDeQuem === "function" ? nomeDeQuem(perm.usuario) : ((perm.usuario && perm.usuario.nome) || "");
  const fechamentos = typeof fechamentosDoEscritorio === "function" ? fechamentosDoEscritorio(data) : {};
  const todos = itensAReceber(data, { comRecebidos: true });
  const noQuadro = (i) => (typeof efPassaNoFluxo === "function"
    ? efPassaNoFluxo({ vencimento: i.vencimento, pago: i.recebido }, quadro, mesGrafico, hoje) : !i.recebido);
  const itens = todos.filter((i) => (!filtro || i.origem === filtro) && noQuadro(i));
  const contasDoFluxo = todos.map((i) => ({ vencimento: i.vencimento, valor: i.valor, pago: i.recebido, valorPago: i.valor }));
  const dinheiro = (v) => (typeof efDinheiro === "function" ? efDinheiro(v) : "R$ " + crCent(v).toFixed(2).replace(".", ","));
  const novoId = () => (typeof uid === "function" ? uid() : "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
  const numeroDoc = (lista) => (typeof proximaReferencia === "function" ? proximaReferencia((data || {}).obras || [], lista.filter((x) => x && x.tipo === "escritorio")) : "");
  const gravar = (lancamentos) => Promise.resolve(save({ ...data, lancamentos })).catch(console.error);

  const abrir = (it) => {
    setAbrindo(it.id); setErro("");
    setDia(it.vencimento && it.vencimento <= hoje ? it.vencimento : hoje);
    setValor(crCent(it.valor).toFixed(2).replace(".", ","));
  };
  const fechar = () => { setAbrindo(""); setErro(""); };

  function receber(it, usarLancamentoId) {
    setErro("");
    const lancs = (data || {}).lancamentos || [];
    if (it.origem === "projeto") {
      if (usarLancamentoId) {
        const r = ligarParcelaDeProjeto(lancs, it.parcela, usarLancamentoId);
        if (r.erro) { setErro(r.erro); return; }
        gravar(r.lancamentos); fechar(); return;
      }
      if (typeof lancamentosDaParcelaRecebida !== "function") { setErro("Indisponível."); return; }
      const r = lancamentosDaParcelaRecebida(it.parcela, dia, valor, { lancamentos: lancs.filter((x) => x && x.tipo === "escritorio"),
        fechamentos, novoId, numeroDoc: (l) => numeroDoc(l), agora: new Date().toISOString() });
      if (r.erro) { setErro(r.erro); return; }
      gravar(lancs.concat(r.lancamentos)); fechar();
      if (typeof toast !== "undefined" && toast.sucesso) toast.sucesso("Recebimento lançado em Receita de projetos");
      return;
    }
    const r = receberContaAReceber(lancs, it.id, dia, valor, { fechamentos, novoId, numeroDoc, quem, usarLancamentoId });
    if (r.erro) { setErro(r.erro); return; }
    gravar(r.lancamentos); fechar();
    if (typeof toast !== "undefined" && toast.sucesso) toast.sucesso(r.falta > 0 ? `Recebido · ${dinheiro(r.falta)} continua a receber` : "Recebimento lançado");
  }
  async function desfazer(it) {
    const ok = await dialogo.confirmar({ titulo: "Desfazer este recebimento?",
      mensagem: it.conta && it.conta.lancamentoExistente
        ? "A conta volta a ficar a receber. O lançamento do extrato continua no escritório."
        : "A conta volta a ficar a receber e o lançamento que o recebimento criou sai do escritório.",
      confirmar: "Desfazer" });
    if (!ok) return;
    const r = desfazerRecebimento((data || {}).lancamentos || [], it.id, { fechamentos });
    if (r.erro) { dialogo.alertar({ titulo: "Não deu para desfazer", mensagem: r.erro, tipo: "aviso" }); return; }
    gravar(r.lancamentos);
  }
  async function excluir(it) {
    const irmas = ((data || {}).lancamentos || []).filter((x) => x && x.tipo === "receber" && x.grupoReceber === it.conta.grupoReceber && !x.recebido);
    const ok = await dialogo.confirmar({ titulo: "Excluir conta a receber?",
      mensagem: irmas.length > 1 ? `Só esta parcela (${it.rotulo}) sai. As outras ${irmas.length - 1} em aberto continuam.` : "A conta sai da lista.",
      confirmar: "Excluir", destrutivo: true });
    if (!ok) return;
    gravar(((data || {}).lancamentos || []).filter((x) => !(x && x.id === it.id)));
  }

  const btn = { ...(S.btnSec || {}), padding: "5px 12px", fontSize: 12 };
  const chip = (on) => ({ font: "inherit", fontSize: 12.5, padding: "5px 12px", borderRadius: 999, cursor: "pointer",
    border: `1px solid ${on ? "#0474f4" : "rgba(38,36,33,0.16)"}`, background: on ? "#eef5ff" : "#fff", color: on ? "#0474f4" : "#262421" });
  const porMes = {};
  for (const it of itens) { const k = (it.vencimento || "").slice(0, 7) || "sem data"; (porMes[k] = porMes[k] || []).push(it); }
  const nomeMes = (k) => (k === "sem data" ? "Sem data" : (typeof mesAnoPorExtenso === "function" ? mesAnoPorExtenso(k) : k));

  return (
    <div data-vk-a-receber-tela style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Contas a receber</div>
          <div style={{ fontSize: 12.5, color: "#6b7280" }}>Projetos ganhos, honorários de gerenciamento, vendas de empreendimento e outras receitas</div>
        </div>
        {perm.podeEditar !== false && !novo && (
          <button type="button" data-vk-nova-receber style={S.btn} onClick={() => setNovo({ tipo: "venda", empreendimentoId: "", cliente: "", descricao: "",
            valorTotal: "", entrada: "", dataEntrada: hoje, nParcelas: "", primeiroVencimento: crSomarMeses(hoje, 1), contaId: "rec_comissoes", unidadeId: "escritorio" })}>
            + Nova conta a receber
          </button>
        )}
      </div>

      {novo && <NovaContaAReceber data={data} f={novo} setF={setNovo} estreito={estreito}
        aoSalvar={(f) => {
          const r = novasContasAReceber(f, { clientes: (data || {}).clientes || [], novoId, quem });
          if (r.erro) return r;
          gravar(((data || {}).lancamentos || []).concat(r.contas));
          setNovo(null);
          if (typeof toast !== "undefined" && toast.sucesso) toast.sucesso(`${r.contas.length} ${r.contas.length === 1 ? "conta a receber criada" : "contas a receber criadas"}`);
          return { ok: true };
        }} />}

      {typeof FluxoDoEscritorio === "function" && (
        <FluxoDoEscritorio contas={contasDoFluxo} tipo="receber" filtro={quadro} aoFiltrar={setQuadro} mes={mesGrafico} aoEscolherMes={setMesGrafico}
          hoje={hoje} subPago="já entrou no banco" subTotal="recebido + a receber" uid="escritorio-receber" />
      )}

      <div data-vk-mantem-mes="1" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {CR_ORIGENS.map(([k, r]) => <button key={k} type="button" style={chip(filtro === k)} onClick={() => setFiltro(k)}>{r}</button>)}
      </div>

      <div data-vk-mantem-mes="1" style={{ display: "grid", gap: 14 }}>
      {!itens.length ? (
        <div style={{ ...(S.card || {}), textAlign: "center", color: "#6b7280", fontSize: 13 }}>
          Nada a receber{filtro || quadro !== "aPagar" || mesGrafico ? " neste filtro" : ""}. Projetos entram quando o orçamento é marcado como Ganho (com as parcelas); vendas e outras receitas, pelo “+ Nova conta a receber”.
        </div>
      ) : Object.keys(porMes).map((mes) => (
        <div key={mes} style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#4b5563" }}>
            <b style={{ color: "#262421" }}>{nomeMes(mes)}</b>
            <span>{dinheiro(porMes[mes].filter((i) => !i.recebido).reduce((t, i) => t + i.valor, 0))} a receber</span>
          </div>
          <div style={S.quadro}>
            {porMes[mes].map((it, i) => {
              const vencida = !it.recebido && it.vencimento && it.vencimento < hoje;
              const aberto = abrindo === it.id;
              const cands = aberto ? candidatosDoRecebimento(it, data) : [];
              return (
                <div key={it.id} data-vk-receber-linha style={{ padding: "10px 12px", borderTop: i ? "1px solid rgba(38,36,33,0.06)" : "none", display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", alignItems: "center" }}>
                    <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                      <div style={{ fontSize: 13 }}>{it.quem}{it.referencia ? <span style={{ color: "#6b7280" }}> · {it.referencia}</span> : null}</div>
                      <div style={{ fontSize: 11.5, color: "#6b7280" }}>
                        <span style={{ fontWeight: 600, color: "#4b5563" }}>{CR_ROTULO_ORIGEM[it.origem]}</span> · {it.rotulo}
                        {it.recebido ? ` · recebido em ${crDataBR(it.recebidoEm)}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginLeft: "auto", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <div style={{ fontSize: 12, color: it.recebido ? "#15803d" : vencida ? "#b91c1c" : "#6b7280", whiteSpace: "nowrap" }}>
                        {it.recebido ? "recebido" : it.vencimento ? (vencida ? "venceu " : "vence ") + crDataBR(it.vencimento) : "sem data"}
                      </div>
                      <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, whiteSpace: "nowrap", minWidth: 96, textAlign: "right" }}>{dinheiro(it.valor)}</div>
                      {!it.recebido && it.origem !== "obra" && !it.daObra && perm.podeEditar !== false && !aberto && (
                        <button type="button" data-vk-receber-btn style={btn} onClick={() => abrir(it)}>Receber</button>
                      )}
                      {(it.origem === "obra" || it.daObra) && !it.recebido && (
                        aoAbrirObra
                          ? <button type="button" style={btn} onClick={() => aoAbrirObra(it.obraId)} title={it.daObra ? "O recebimento da venda é feito no empreendimento (Vendas)" : "A baixa do honorário é feita na obra (Contas a pagar)"}>{it.daObra ? "Abrir o empreendimento" : "Abrir a obra"}</button>
                          : <span style={{ fontSize: 11.5, color: "#6b7280" }}>baixa na obra</span>
                      )}
                      {it.recebido && !it.daObra && (it.origem === "venda" || it.origem === "outro") && perm.podeEditar !== false && (
                        <button type="button" style={btn} onClick={() => desfazer(it)}>Desfazer</button>
                      )}
                      {!it.recebido && !it.daObra && (it.origem === "venda" || it.origem === "outro") && perm.podeExcluir && !aberto && (
                        <button type="button" style={{ ...btn, color: "#b91c1c" }} onClick={() => excluir(it)}>Excluir</button>
                      )}
                    </div>
                  </div>
                  {aberto && (
                    <div data-vk-receber-form-cr style={{ display: "grid", gap: 8, background: "#f8fafc", borderRadius: 10, padding: 10 }}>
                      {cands.length > 0 && (
                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={{ fontSize: 12, color: "#4b5563" }}>Já está no escritório? Use o lançamento que o extrato trouxe — sem lançar de novo:</div>
                          {cands.map((l) => (
                            <div key={l.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12.5 }}>
                              <span>{crDataBR(String(l.lancadoEm || "").slice(0, 10)) || l.competencia} · {dinheiro(Math.abs(l.valor))} · {String(l.descricao || "").slice(0, 60)}</span>
                              <button type="button" style={btn} onClick={() => receber(it, l.id)}>Usar este</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                        <label style={{ display: "grid", gap: 3 }}>
                          <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .5, color: "#6b7280" }}>Dia em que entrou</span>
                          <input type="date" value={dia} max={hoje} onChange={(e) => setDia(e.target.value)} style={{ ...(S.input || {}), width: 160 }} />
                        </label>
                        <label style={{ display: "grid", gap: 3 }}>
                          <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .5, color: "#6b7280" }}>Valor recebido</span>
                          <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} style={{ ...(S.input || {}), width: 130 }} />
                        </label>
                        <button type="button" data-vk-receber-confirmar-cr style={{ ...(S.btn || {}), padding: "7px 14px", fontSize: 12.5 }} onClick={() => receber(it)}>Lançar recebimento</button>
                        <button type="button" style={{ ...btn, padding: "7px 14px" }} onClick={fechar}>Cancelar</button>
                      </div>
                      {it.origem !== "projeto" && crCent(crValor(valor)) > 0 && crCent(crValor(valor)) < it.valor && (
                        <div style={{ fontSize: 12, color: "#92400e" }}>Recebendo menos: {dinheiro(crCent(it.valor - crValor(valor)))} continua a receber.</div>
                      )}
                      {erro && <div style={{ fontSize: 12, color: "#b91c1c" }}>{erro}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

function NovaContaAReceber({ data, f, setF, aoSalvar, estreito }) {
  const S = typeof EF_ESTILO !== "undefined" ? EF_ESTILO : {};
  const [erro, setErro] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const venda = f.tipo !== "outro";
  const empreendimentos = ((data || {}).clientes || []).filter((c) => c && c.servicos && c.servicos.empreendimento);
  const receitas = (typeof PLANO_CONTAS_ESCRITORIO !== "undefined" ? PLANO_CONTAS_ESCRITORIO : [])
    .filter((c) => c && c.grupo === "receitas");
  const previa = crGerarParcelas(f);
  const dinheiro = (v) => (typeof efDinheiro === "function" ? efDinheiro(v) : crCent(v).toFixed(2));
  const campo = (rot, el) => (
    <label style={{ display: "grid", gap: 3, minWidth: 0 }}>
      <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .5, color: "#6b7280" }}>{rot}</span>{el}
    </label>
  );
  const grade = { display: "grid", gridTemplateColumns: estreito ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 10 };
  return (
    <div data-vk-nova-receber-form style={{ ...(S.card || {}), display: "grid", gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>Nova conta a receber</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[["venda", "Venda de empreendimento"], ["outro", "Outra receita"]].map(([k, r]) => (
          <button key={k} type="button" onClick={() => set("tipo", k)} style={{ font: "inherit", fontSize: 12.5, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
            border: `1px solid ${f.tipo === k ? "#0474f4" : "rgba(38,36,33,0.16)"}`, background: f.tipo === k ? "#eef5ff" : "#fff", color: f.tipo === k ? "#0474f4" : "#262421" }}>{r}</button>
        ))}
      </div>
      <div style={grade}>
        {venda
          ? campo("Empreendimento", <select style={{ ...(S.input || {}), cursor: "pointer" }} value={f.empreendimentoId} onChange={(e) => set("empreendimentoId", e.target.value)}>
              <option value="">— escolha —</option>
              {empreendimentos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>)
          : campo("Conta da receita", <select style={{ ...(S.input || {}), cursor: "pointer" }} value={f.contaId} onChange={(e) => set("contaId", e.target.value)}>
              {receitas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>)}
        {campo(venda ? "Comprador" : "De quem", <input style={S.input} value={f.cliente} onChange={(e) => set("cliente", e.target.value)} placeholder={venda ? "nome de quem comprou" : "cliente ou pagador"} />)}
        {campo(venda ? "O que foi vendido" : "Descrição", <input style={S.input} value={f.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder={venda ? "ex.: Casa 2 — Lote 21" : "ex.: Comissão de indicação"} />)}
        {campo("Valor total", <input style={S.input} inputMode="decimal" value={f.valorTotal} onChange={(e) => set("valorTotal", e.target.value)} placeholder="0,00" />)}
        {campo("Entrada (R$)", <input style={S.input} inputMode="decimal" value={f.entrada} onChange={(e) => set("entrada", e.target.value)} placeholder="0,00 (sem entrada)" />)}
        {campo("Data da entrada", <input style={S.input} type="date" value={f.dataEntrada} onChange={(e) => set("dataEntrada", e.target.value)} />)}
        {campo("Nº de parcelas (mensais)", <input style={S.input} inputMode="numeric" value={f.nParcelas} onChange={(e) => set("nParcelas", e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="1" />)}
        {campo("1º vencimento", <input style={S.input} type="date" value={f.primeiroVencimento} onChange={(e) => set("primeiroVencimento", e.target.value)} />)}
      </div>
      {previa.parcelas && previa.parcelas.length > 0 && (
        <div style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.6 }}>
          {previa.parcelas.slice(0, 6).map((p) => `${p.rotulo}: ${dinheiro(p.valor)} em ${crDataBR(p.vencimento)}`).join(" · ")}
          {previa.parcelas.length > 6 ? ` · … (${previa.parcelas.length} no total)` : ""}
        </div>
      )}
      {erro && <div style={{ fontSize: 12, color: "#b91c1c" }}>{erro}</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button type="button" style={S.btnSec} onClick={() => setF(null)}>Cancelar</button>
        <button type="button" data-vk-nova-receber-salvar style={S.btn} onClick={() => { const r = aoSalvar(f); if (r && r.erro) setErro(r.erro); }}>Criar</button>
      </div>
    </div>
  );
}

// ── Vendas do empreendimento (tela) ─────────────────────────────
// As unidades com o preço estimado; a venda de cada uma (sinal, parcelas,
// financiamento do banco) e o que falta receber. Receber aqui é dar baixa
// na conta da obra — a ponte leva para o escritório.
function VendasDoEmpreendimento({ obra, podeEditar, isMobile, quem, aoGravarObra, travaDoMes, aoVoltar }) {
  const S = typeof EF_ESTILO !== "undefined" ? EF_ESTILO : {};
  const hoje = crHoje();
  const r = resumoDasVendas(obra);
  const contas = (obra || {}).contasPagar || [];
  const [formUn, setFormUn] = useState(null);       // { id?, nome, area, precoEstimado }
  const [formVenda, setFormVenda] = useState(null); // ver planoDaVenda
  const [erroVenda, setErroVenda] = useState("");
  const [recebendo, setRecebendo] = useState(null); // { conta, dia, valor, erro }
  const [aberta, setAberta] = useState({});
  const novoId = () => (typeof uid === "function" ? uid() : "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
  const dinheiro = (v) => crBRL(v);
  const rot = { fontSize: 10.5, textTransform: "uppercase", letterSpacing: .4, color: "#6b7280", fontWeight: 600 };
  const inp = { ...(S.input || {}), width: "100%" };
  const btn = { ...(S.btnSec || {}), padding: "5px 12px", fontSize: 12 };

  function salvarUnidade() {
    const f = formUn;
    if (!String(f.nome || "").trim()) { dialogo.alertar({ titulo: "Dê um nome à unidade", tipo: "aviso" }); return; }
    const u = { id: f.id || novoId(), nome: String(f.nome).trim(), area: String(f.area || "").trim(), precoEstimado: crCent(crValor(f.precoEstimado)) };
    const lista = unidadesDaObra(obra);
    aoGravarObra({ ...obra, unidadesVenda: f.id ? lista.map((x) => (x.id === f.id ? { ...x, ...u } : x)) : lista.concat([u]) });
    setFormUn(null);
  }
  async function excluirUnidade(u) {
    if (vendasDaObra(obra).some((v) => v.unidadeId === u.id)) {
      dialogo.alertar({ titulo: "Unidade vendida", tipo: "aviso", mensagem: "Desfaça a venda antes de excluir a unidade." });
      return;
    }
    const ok = await dialogo.confirmar({ titulo: "Excluir a unidade?", mensagem: u.nome, confirmar: "Excluir", destrutivo: true });
    if (ok) aoGravarObra({ ...obra, unidadesVenda: unidadesDaObra(obra).filter((x) => x.id !== u.id) });
  }
  function abrirVenda(u) {
    setErroVenda("");
    setFormVenda({ unidadeId: u.id, comprador: "", data: hoje, valor: u.precoEstimado ? Number(u.precoEstimado).toFixed(2).replace(".", ",") : "",
      sinais: [], nParcelas: "", valorParcela: "", primeiroVencimento: "", financiamento: "", dataFinanciamento: "", observacao: "" });
  }
  function salvarVenda() {
    const p = planoDaVenda(formVenda, { unidades: unidadesDaObra(obra), contas, obraId: obra.id, novoId, quem });
    if (p.erro) { setErroVenda(p.erro); return; }
    aoGravarObra(obraComVenda(obra, p));
    setFormVenda(null);
    if (typeof toast !== "undefined" && toast.sucesso) toast.sucesso("Venda registrada");
  }
  async function desfazerVenda(linha) {
    const ok = await dialogo.confirmar({ titulo: "Desfazer a venda?", confirmar: "Desfazer", destrutivo: true,
      mensagem: `${linha.unidade.nome} · ${linha.venda.comprador}. Sai o que ainda falta receber; o que já foi recebido fica na obra, sem a venda.` });
    if (ok) aoGravarObra(obraSemVenda(obra, linha.venda.id));
  }
  function receber() {
    const f = recebendo;
    const valor = crCent(crValor(f.valor));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(f.dia || ""))) { setRecebendo({ ...f, erro: "Informe o dia em que entrou." }); return; }
    if (!(valor > 0)) { setRecebendo({ ...f, erro: "Informe o valor recebido." }); return; }
    const c = f.conta;
    const paga = contaPaga(c, { pagoEm: f.dia, valorPago: Math.min(valor, Number(c.valor) || valor) }, quem || "");
    const trava = travaDoMes ? travaDoMes([paga]) : "";
    if (trava) { setRecebendo({ ...f, erro: trava }); return; }
    // recebeu menos: o resto continua a receber, na mesma data
    const falta = crCent((Number(c.valor) || 0) - valor);
    const resto = falta > 0.005 ? [{ ...c, id: novoId(), valor: falta, valorPago: "", pago: false, pagoEm: "",
      descricao: c.descricao + " (restante)", registros: [] }] : [];
    const lista = contas.flatMap((x) => (x && x.id === c.id ? [{ ...paga, valor: falta > 0.005 ? valor : paga.valor }].concat(resto) : [x]));
    aoGravarObra({ ...obra, contasPagar: lista });
    setRecebendo(null);
  }
  async function desfazerRecebimentoDaVenda(c) {
    const ok = await dialogo.confirmar({ titulo: "Desfazer este recebimento?", confirmar: "Desfazer",
      mensagem: `${c.descricao} · ${dinheiro(c.valorPago || c.valor)}. Volta a ficar a receber; o lançamento que foi para o escritório sai.` });
    if (ok) aoGravarObra({ ...obra, contasPagar: contas.map((x) => (x && x.id === c.id ? contaEmAberto(x, quem || "") : x)) });
  }

  const tile = (t, v, sub) => (
    <div style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 14, padding: "12px 14px", background: "#fff" }}>
      <div style={{ fontSize: 11.5, color: "#4b5563", marginBottom: 4 }}>{t}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{v}</div>
      {sub ? <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 3 }}>{sub}</div> : null}
    </div>
  );
  const fv = formVenda;
  const somaVenda = fv ? crCent((fv.sinais || []).reduce((t, x) => t + (x.contaId
    ? (Number((entradasDeVendaSoltas(contas).find((c) => c.id === x.contaId) || {}).valorPago) || 0) : crValor(x.valor)), 0)
    + (Math.floor(Number(fv.nParcelas) || 0) * crValor(fv.valorParcela)) + crValor(fv.financiamento)) : 0;
  const soltas = entradasDeVendaSoltas(contas);

  return (
    <div data-vk-vendas="1" style={{ display: "grid", gap: 14 }}>
      {aoVoltar && <button onClick={aoVoltar} style={{ background: "none", border: "none", padding: 0, color: "#4b5563", cursor: "pointer", fontFamily: "inherit", fontSize: 12, justifySelf: "start" }}>← Voltar</button>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 240px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Vendas</div>
          <div style={{ fontSize: 12.5, color: "#4b5563", marginTop: 2 }}>{(obra || {}).nome} — unidades, vendas e o que falta receber (sinal, parcelas e financiamento)</div>
        </div>
        {podeEditar && !formUn && <button data-vk-nova-unidade="1" style={S.btn} onClick={() => setFormUn({ nome: "", area: "", precoEstimado: "" })}>+ Unidade</button>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
        {tile("Unidades", `${r.vendidas} de ${r.unidades} vendidas`, `estimado ${dinheiro(r.estimado)}`)}
        {tile("Vendido", dinheiro(r.vendido), r.vendidas === 1 ? "1 venda" : `${r.vendidas} vendas`)}
        {tile("Recebido", dinheiro(r.recebido), "já entrou")}
        {tile("A receber", dinheiro(r.aReceber), "sinal, parcelas e financiamento")}
      </div>

      {formUn && (
        <div data-vk-form-unidade="1" style={{ ...(S.card || {}), display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4 }}><span style={rot}>Unidade</span>
            <input style={inp} value={formUn.nome} placeholder="Digite o nome da unidade" onChange={(e) => setFormUn({ ...formUn, nome: e.target.value })} /></label>
          <label style={{ display: "grid", gap: 4 }}><span style={rot}>Área (m²)</span>
            <input style={inp} inputMode="decimal" value={formUn.area} placeholder="0,00" onChange={(e) => setFormUn({ ...formUn, area: e.target.value })} /></label>
          <label style={{ display: "grid", gap: 4 }}><span style={rot}>Preço estimado de venda</span>
            <input style={inp} inputMode="decimal" value={formUn.precoEstimado} placeholder="0,00" onChange={(e) => setFormUn({ ...formUn, precoEstimado: e.target.value })} /></label>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
            <button style={S.btn} onClick={salvarUnidade}>Salvar</button>
            <button style={S.btnSec} onClick={() => setFormUn(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {!r.linhas.length && !formUn && (
        <div style={{ ...(S.card || {}), textAlign: "center", color: "#6b7280", fontSize: 13 }}>
          Nenhuma unidade cadastrada. Cadastre as unidades com o preço estimado; depois registre a venda de cada uma.
        </div>
      )}

      {r.linhas.map((l) => {
        const u = l.unidade, v = l.venda;
        const ab = aberta[u.id] !== false;
        return (
          <div key={u.id} data-vk-unidade={u.nome} style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 14, background: "#fff", overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "11px 14px", background: v ? "#f7fbff" : "#fafafa" }}>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#111827" }}>{u.nome}
                  <span style={{ fontSize: 11, fontWeight: 600, marginLeft: 8, padding: "2px 8px", borderRadius: 999,
                    background: v ? "#eef5ff" : "#f3f4f6", color: v ? "#0474f4" : "#4b5563" }}>{v ? "Vendida" : "Disponível"}</span></div>
                <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 2 }}>
                  {[u.area ? `${u.area} m²` : "", `estimado ${dinheiro(l.estimado)}`, v ? `vendida a ${v.comprador} em ${crDataBR(v.data)} por ${dinheiro(v.valor)}` : ""].filter(Boolean).join(" · ")}
                </div>
                {v && <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 2 }}>recebido <b>{dinheiro(l.recebido)}</b> · a receber <b>{dinheiro(l.aReceber)}</b></div>}
              </div>
              {podeEditar && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {!v && <button data-vk-registrar-venda="1" style={{ ...btn, color: "#fff", background: "#0474f4", borderColor: "#0474f4" }} onClick={() => abrirVenda(u)}>Registrar venda</button>}
                  {v && <button style={btn} onClick={() => setAberta({ ...aberta, [u.id]: !ab })}>{ab ? "Esconder" : "Ver recebimentos"}</button>}
                  <button style={btn} onClick={() => setFormUn({ id: u.id, nome: u.nome, area: u.area || "", precoEstimado: u.precoEstimado ? Number(u.precoEstimado).toFixed(2).replace(".", ",") : "" })}>Editar</button>
                  {v ? <button style={{ ...btn, color: "#b91c1c" }} onClick={() => desfazerVenda(l)}>Desfazer venda</button>
                    : <button style={{ ...btn, color: "#b91c1c" }} onClick={() => excluirUnidade(u)}>Excluir</button>}
                </div>
              )}
            </div>
            {v && ab && (
              <div style={{ borderTop: "1px solid rgba(38,36,33,0.08)" }}>
                {l.contas.map((c, i) => {
                  const vencida = !c.pago && c.vencimento && c.vencimento < hoje;
                  const aqui = recebendo && recebendo.conta.id === c.id;
                  return (
                    <div key={c.id} data-vk-receber-venda={c.id} style={{ padding: "9px 14px", borderTop: i ? "1px solid rgba(38,36,33,0.06)" : "none", display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12.5 }}>
                        <span style={{ flex: "1 1 200px", minWidth: 0 }}>
                          <b style={{ fontWeight: 600 }}>{CR_PARTES_DA_VENDA[c.parteVenda] || "Recebimento"}</b>
                          {c.totalParcelas ? ` ${c.parcela}/${c.totalParcelas}` : ""}
                          <span style={{ color: "#6b7280" }}> · {c.pago ? `recebido em ${crDataBR(c.pagoEm)}` : `${vencida ? "venceu" : "vence"} ${crDataBR(c.vencimento)}`}</span>
                        </span>
                        <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: c.pago ? "#047857" : vencida ? "#b91c1c" : "#111827" }}>
                          {dinheiro(c.pago ? (c.valorPago || c.valor) : c.valor)}</span>
                        {podeEditar && !c.pago && !aqui && (
                          <button data-vk-receber-parte="1" style={btn} onClick={() => setRecebendo({ conta: c, dia: c.vencimento && c.vencimento <= hoje ? c.vencimento : hoje,
                            valor: Number(c.valor).toFixed(2).replace(".", ","), erro: "" })}>Receber</button>
                        )}
                        {podeEditar && c.pago && <button style={btn} onClick={() => desfazerRecebimentoDaVenda(c)}>Desfazer</button>}
                      </div>
                      {aqui && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", background: "#f8fafc", borderRadius: 10, padding: 10 }}>
                          <label style={{ display: "grid", gap: 3 }}><span style={rot}>Dia em que entrou</span>
                            <input type="date" style={{ ...inp, width: 160 }} value={recebendo.dia} max={hoje} onChange={(e) => setRecebendo({ ...recebendo, dia: e.target.value })} /></label>
                          <label style={{ display: "grid", gap: 3 }}><span style={rot}>Valor recebido</span>
                            <input inputMode="decimal" style={{ ...inp, width: 140 }} value={recebendo.valor} onChange={(e) => setRecebendo({ ...recebendo, valor: e.target.value })} /></label>
                          <button data-vk-confirmar-recebimento="1" style={{ ...(S.btn || {}), padding: "7px 14px", fontSize: 12.5 }} onClick={receber}>Lançar recebimento</button>
                          <button style={{ ...btn, padding: "7px 14px" }} onClick={() => setRecebendo(null)}>Cancelar</button>
                          {recebendo.erro && <div style={{ flexBasis: "100%", fontSize: 12, color: "#b91c1c" }}>{recebendo.erro}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {fv && (
        <div data-vk-modal-venda="1" style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", zIndex: 1000, display: "flex",
          alignItems: "flex-start", justifyContent: "center", padding: "max(16px, 4vh) 12px", overflowY: "auto" }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "min(720px, 100%)", boxShadow: "0 20px 50px rgba(0,0,0,0.25)", padding: 18, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Registrar venda</div>
                <div style={{ fontSize: 12.5, color: "#6b7280" }}>{(unidadesDaObra(obra).find((u) => u.id === fv.unidadeId) || {}).nome} — sinal, parcelas e liberação do financiamento</div>
              </div>
              <button style={S.btnSec} onClick={() => setFormVenda(null)}>Fechar</button>
            </div>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr" }}>
              <label style={{ display: "grid", gap: 4 }}><span style={rot}>Comprador</span>
                <input data-vk-venda-comprador="1" style={inp} value={fv.comprador} placeholder="Digite o nome do comprador" onChange={(e) => setFormVenda({ ...fv, comprador: e.target.value })} /></label>
              <label style={{ display: "grid", gap: 4 }}><span style={rot}>Data da venda</span>
                <input type="date" style={inp} value={fv.data} onChange={(e) => setFormVenda({ ...fv, data: e.target.value })} /></label>
              <label style={{ display: "grid", gap: 4 }}><span style={rot}>Valor da venda</span>
                <input data-vk-venda-valor="1" inputMode="decimal" style={inp} value={fv.valor} placeholder="0,00" onChange={(e) => setFormVenda({ ...fv, valor: e.target.value })} /></label>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>Sinal</div>
              {soltas.length > 0 && (
                <div style={{ display: "grid", gap: 4, background: "#f8fafc", borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ fontSize: 11.5, color: "#4b5563" }}>Já recebido nesta obra (Venda de imóvel) — marque o que é sinal desta venda, sem lançar de novo:</div>
                  {soltas.map((c) => {
                    const marcado = (fv.sinais || []).some((x) => x.contaId === c.id);
                    return (
                      <label key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
                        <input type="checkbox" data-vk-sinal-existente={c.id} checked={marcado} onChange={(e) => setFormVenda({ ...fv,
                          sinais: e.target.checked ? (fv.sinais || []).concat([{ contaId: c.id }]) : (fv.sinais || []).filter((x) => x.contaId !== c.id) })} />
                        <span>{c.descricao || "Venda de imóvel"} · {crDataBR(c.pagoEm)} · <b>{dinheiro(c.valorPago || c.valor)}</b></span>
                      </label>
                    );
                  })}
                </div>
              )}
              {(fv.sinais || []).map((x, i) => x.contaId ? null : (
                <div key={i} style={{ display: "grid", gap: 8, gridTemplateColumns: isMobile ? "1fr 1fr auto" : "160px 160px auto", alignItems: "end" }}>
                  <label style={{ display: "grid", gap: 4 }}><span style={rot}>Valor</span>
                    <input inputMode="decimal" style={inp} value={x.valor || ""} placeholder="0,00" onChange={(e) => setFormVenda({ ...fv, sinais: fv.sinais.map((y, j) => (j === i ? { ...y, valor: e.target.value } : y)) })} /></label>
                  <label style={{ display: "grid", gap: 4 }}><span style={rot}>Data</span>
                    <input type="date" style={inp} value={x.data || ""} onChange={(e) => setFormVenda({ ...fv, sinais: fv.sinais.map((y, j) => (j === i ? { ...y, data: e.target.value } : y)) })} /></label>
                  <button style={btn} onClick={() => setFormVenda({ ...fv, sinais: fv.sinais.filter((_, j) => j !== i) })}>Tirar</button>
                </div>
              ))}
              <button data-vk-mais-sinal="1" style={{ ...btn, justifySelf: "start" }} onClick={() => setFormVenda({ ...fv, sinais: (fv.sinais || []).concat([{ valor: "", data: hoje }]) })}>+ Sinal a receber</button>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>Parcelas</div>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: isMobile ? "1fr 1fr" : "120px 160px 160px" }}>
                <label style={{ display: "grid", gap: 4 }}><span style={rot}>Quantidade</span>
                  <input data-vk-venda-n="1" inputMode="numeric" style={inp} value={fv.nParcelas} placeholder="0" onChange={(e) => setFormVenda({ ...fv, nParcelas: e.target.value.replace(/\D/g, "").slice(0, 3) })} /></label>
                <label style={{ display: "grid", gap: 4 }}><span style={rot}>Valor de cada</span>
                  <input data-vk-venda-vp="1" inputMode="decimal" style={inp} value={fv.valorParcela} placeholder="0,00" onChange={(e) => setFormVenda({ ...fv, valorParcela: e.target.value })} /></label>
                <label style={{ display: "grid", gap: 4, gridColumn: isMobile ? "1 / -1" : "auto" }}><span style={rot}>1º vencimento</span>
                  <input data-vk-venda-venc="1" type="date" style={inp} value={fv.primeiroVencimento} onChange={(e) => setFormVenda({ ...fv, primeiroVencimento: e.target.value })} /></label>
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>Financiamento do banco</div>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: isMobile ? "1fr 1fr" : "160px 160px" }}>
                <label style={{ display: "grid", gap: 4 }}><span style={rot}>Valor</span>
                  <input data-vk-venda-fin="1" inputMode="decimal" style={inp} value={fv.financiamento} placeholder="0,00" onChange={(e) => setFormVenda({ ...fv, financiamento: e.target.value })} /></label>
                <label style={{ display: "grid", gap: 4 }}><span style={rot}>Liberação prevista</span>
                  <input data-vk-venda-fin-data="1" type="date" style={inp} value={fv.dataFinanciamento} onChange={(e) => setFormVenda({ ...fv, dataFinanciamento: e.target.value })} /></label>
              </div>
            </div>

            <div data-vk-venda-conferencia="1" style={{ fontSize: 12.5, padding: "8px 12px", borderRadius: 10,
              background: Math.abs(somaVenda - crValor(fv.valor)) < 0.01 ? "#ecfdf5" : "#fffbeb",
              color: Math.abs(somaVenda - crValor(fv.valor)) < 0.01 ? "#047857" : "#92400e" }}>
              Sinal + parcelas + financiamento = <b>{dinheiro(somaVenda)}</b> · venda {dinheiro(crValor(fv.valor))}
              {Math.abs(somaVenda - crValor(fv.valor)) < 0.01 ? " ✓" : ` · ${somaVenda < crValor(fv.valor) ? "faltam" : "sobram"} ${dinheiro(Math.abs(crValor(fv.valor) - somaVenda))}`}
            </div>
            {erroVenda && <div style={{ fontSize: 12.5, color: "#b91c1c" }}>{erroVenda}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button style={S.btnSec} onClick={() => setFormVenda(null)}>Cancelar</button>
              <button data-vk-salvar-venda="1" style={S.btn} onClick={salvarVenda}>Registrar venda</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
