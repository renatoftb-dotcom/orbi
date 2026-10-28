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
                      {!it.recebido && it.origem !== "obra" && perm.podeEditar !== false && !aberto && (
                        <button type="button" data-vk-receber-btn style={btn} onClick={() => abrir(it)}>Receber</button>
                      )}
                      {it.origem === "obra" && !it.recebido && (
                        aoAbrirObra
                          ? <button type="button" style={btn} onClick={() => aoAbrirObra(it.obraId)} title="A baixa do honorário é feita na obra (Contas a pagar)">Abrir a obra</button>
                          : <span style={{ fontSize: 11.5, color: "#6b7280" }}>baixa na obra</span>
                      )}
                      {it.recebido && (it.origem === "venda" || it.origem === "outro") && perm.podeEditar !== false && (
                        <button type="button" style={btn} onClick={() => desfazer(it)}>Desfazer</button>
                      )}
                      {!it.recebido && (it.origem === "venda" || it.origem === "outro") && perm.podeExcluir && !aberto && (
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
