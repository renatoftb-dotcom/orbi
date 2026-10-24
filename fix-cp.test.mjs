// Testes das correções da área "contas a pagar" (pagamento conjunto, trava de
// mês fechado, cliente, cartão, contrato, datas locais). node puro.
//   TZ=America/Sao_Paulo node fix-cp.test.mjs   (o fuso é fixado abaixo)
//
// Além das funções puras, carrega PEDAÇOS da tela da obra (clientes.jsx) —
// confirmarPagamento, o desfazer, o excluir, as Entradas e efeitosDaBaixa —
// num fechamento com o mínimo de estado em volta, e grava como gravarObras:
// numera os papéis e aplica os efeitos da baixa no mesmo save.
process.env.TZ = "America/Sao_Paulo";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mod = (n) => readFileSync(join(__dirname, "src", "modules", n), "utf-8");
const cut = (s, m) => { const i = s.indexOf(m); if (i < 0) throw new Error("marcador não achado: " + m); return s.slice(0, i); };
const entre = (s, a, b) => {
  const i = s.indexOf(a); if (i < 0) throw new Error("marcador não achado: " + a);
  const j = s.indexOf(b, i); if (j < 0) throw new Error("marcador não achado: " + b);
  return s.slice(i, j);
};
const pick = (s, name) => {
  const a = s.indexOf("function " + name + "("); if (a < 0) throw new Error("função não achada: " + name);
  let d = 0, j = s.indexOf("{", a);
  for (; j < s.length; j++) { if (s[j] === "{") d++; else if (s[j] === "}") { d--; if (!d) break; } }
  return s.slice(a, j + 1);
};

const cp = mod("contas-pagar.jsx");
const cpSrc = cp.slice(0, cp.lastIndexOf("// ═", cp.indexOf("// UI — gráfico do fluxo mensal")));
const ins = mod("insumos.jsx");
const cli = mod("clientes.jsx");
const TELA = [
  entre(cli, "  const efeitosDaBaixa = (", "  // Qual obra da fatia teve as contas trocadas."),
  entre(cli, "  const travouNaFatura = (lista, acao) => {", "  // Apagar um pedido a partir do contas a pagar."),
  entre(cli, "  const apagarPedidoDeContas = async", "  // O vencimento combinado com a loja mudou"),
  entre(cli, "  const salvarPedidoEditado = (pedido) => {", "  // Prorrogar uma parcela de contrato"),
  entre(cli, "  // Confirma a baixa: a despesa entra no mês", "  // Recalibrar: muda a data do primeiro pagamento"),
  pick(cli, "lancarEntradaDaObra"),
  pick(cli, "lancarDespesaDaEntrada"),
].join("\n");

const G = new Function(`
  var uid = (() => { let k = 0; return () => "u" + (++k); })();
  ${mod("obra-financeiro.jsx")}
  ${cut(mod("cronograma-obra.jsx"), "// UI — bloco")}
  ${cut(mod("contratos-obra.jsx"), "// UI — documento e gerador")}
  ${cpSrc}
  ${cut(mod("escritorio-financeiro.jsx"), "// UI — daqui para baixo")}
  ${pick(ins, "contasRecemPagas")}
  ${pick(ins, "contasQueDeixaramDeSerPagas")}
  // Um "render" da tela da obra: o estado de agora, fechado como a tela
  // fecha. Cada gravação gera outro render.
  function tela(ctx) {
    var perm = ctx.perm || { podeGerenciarObra: true, podeEditar: true };
    var data = ctx.data, obras = data.obras, obraAtual = data.obras[0];
    var contasDaObra = obraAtual.contasPagar || [];
    var cliente = ctx.cliente || { id: "cli1", nome: "Cliente" };
    var hojeIso = "2026-10-24";
    var formPagamento = ctx.formPagamento || null, pedidoEditando = ctx.pedidoEditando || null;
    var prestadores = [];
    var dialogo = { alertar: (x) => { ctx.alertas.push(x); }, confirmar: async () => true };
    var quemSou = () => "eu";
    var numeroDeCampo = (v) => Number(v) || 0;
    var fmtMoedaCtr = (v) => "R$ " + Number(v || 0).toFixed(2);
    var setFormPagamento = () => {}, setPedidoEditando = () => {}, setObraSelecionada = () => {};
    var setAvisoPreco = () => {}, setAvisoExtrato = () => {};
    var aplicarComprasNoCatalogo = (m) => ({ materiais: m, relato: { aplicados: [], pendencias: [] } });
    var cartaoDoPagamento = (forma) => (forma === "cartao" ? { cartao: ctx.cartao, extra: null } : { cartao: null, extra: null });
    var lancarCotacaoEmContas = (dados) => { ctx.lancouCotacao.push(dados); return { gravado: true }; };
    var gravarObras = (novas) => ctx.gravar(novas);
    var gravarContas = (novasContas) => gravarObras(obras.map((o) => (o.id === obraAtual.id ? { ...o, contasPagar: novasContas } : o)));
    ${TELA}
    return { efeitosDaBaixa, confirmarPagamento, alternarPagamento, alternarPagamentoPedido, apagarPedidoDeContas,
             salvarPedidoEditado, lancarEntradaDaObra, lancarDespesaDaEntrada, lancarPedidoNoMesAberto, mesFechadoNaBaixa };
  }
  return (n) => eval(n);
`)();

// O estado da tela e o "save": numera os papéis das que acabaram de ser
// pagas (comPapeisNumerados) e aplica efeitosDaBaixa na mesma gravada.
function estado(data, extra) {
  const st = { data, alertas: [], lancouCotacao: [], gravacoes: 0, ...(extra || {}) };
  st.gravar = (obrasNovas) => {
    const velha = st.data.obras[0];
    const nova = obrasNovas.find((o) => o.id === velha.id);
    const antes = new Map((velha.contasPagar || []).map((c) => [c.id, c]));
    const qtd = (c) => (Array.isArray(c.anexos) ? c.anexos.filter(Boolean).length : 0) + (c.comprovante ? 1 : 0);
    const agora = (c) => { const a = antes.get(c.id); return !a || (c.pago && !a.pago) || qtd(c) !== qtd(a); };
    const proximo = G("proximoNumeroDePapel")(st.data.obras, G("lancamentosDoEscritorio")(st.data));
    const contas = G("numerarPapeisDasPagas")(nova.contasPagar || [], proximo, agora).contas;
    const obraNova = { ...nova, contasPagar: contas };
    const ef = G("tela")(st).efeitosDaBaixa(velha.contasPagar || [], contas, obraNova);
    st.data = { ...st.data, obras: [obraNova], ...(ef.extras || {}) };
    st.gravacoes++;
  };
  st.tela = (mais) => G("tela")(Object.assign(st, mais || {}));
  return st;
}
const esc = (st) => G("lancamentosDoEscritorio")(st.data).map((l) => [l.origem.tipo, l.origem.refId, l.valor]);
const contas = (st) => st.data.obras[0].contasPagar;
const doId = (st, id) => contas(st).find((c) => c.id === id);
const cent = (v) => Math.round(v * 100) / 100;

let passou = 0, falhou = 0;
const fila = [];
const teste = (nome, fn) => fila.push([nome, fn]);

const item = (id, ped, valor, extra) => ({ id, pedidoId: ped, numeroPedido: ped, obraId: "o1", contaId: "material", valor,
  vencimento: "2026-10-10", favorecido: "Ourifer", descricao: id, ...(extra || {}) });
const obra = (contasPagar, extra) => ({ id: "o1", clienteId: "cli1", nome: "Obra", contasPagar, ...(extra || {}) });
// um papel antigo com número de verdade, para a numeração andar como na vida
const PAPEL = { id: "z0", obraId: "o1", contaId: "material", valor: 1, vencimento: "2026-01-05", pago: true, pagoEm: "2026-01-05", valorPago: 1, doc: "4000", descricao: "antigo" };
// paga pela tela: a linha da loja (vários pedidos) ou de um pedido
const pagarLinha = async (st, pedidoIds, dia, forma, parcelas) => {
  const L = { pedidoIds, obraId: "o1", contas: contas(st).filter((c) => pedidoIds.indexOf(c.pedidoId) >= 0) };
  st.tela({ formPagamento: { pedido: L, dataContab: dia, forma: forma || "avista", parcelas } }).confirmarPagamento();
};

// ── 1. Pagamento conjunto: o lançamento "pg:" liga às contas ──────────
teste("1. desfazer um pedido de um pagamento conjunto deixa no extrato só o que continua pago", async () => {
  const st = estado({ obras: [obra([PAPEL, item("a1", "pA", 100), item("a2", "pA", 50), item("b1", "pB", 30)])], lancamentos: [] });
  await pagarLinha(st, ["pA", "pB"], "2026-10-20");
  assert.deepStrictEqual(esc(st).filter((x) => x[2] !== 1).map((x) => x[2]), [180]);
  const lanc = G("lancamentosDoEscritorio")(st.data).find((l) => l.valor === 180);
  assert.ok(lanc.origem.refId.startsWith("pg:"));
  // os três lados enxergam a ligação
  assert.strictEqual(G("lancamentosLigadosAsContas")([lanc], "o1", [doId(st, "a1")]).length, 1);
  assert.deepStrictEqual(G("contasLigadasAoLancamento")(st.data.obras[0], lanc).map((c) => c.id).sort(), ["a1", "a2", "b1"]);
  assert.strictEqual(G("cpLancamentoDaConta")([lanc], "o1", doId(st, "b1")), lanc);
  assert.strictEqual(G("linhasDaBase")(st.data.obras, { lancamentos: [lanc] }).find((l) => l.id === "a1").noEscritorio, true);
  // desfaz o pedido A
  await st.tela().alternarPagamentoPedido({ pago: true, obraId: "o1", contas: contas(st).filter((c) => c.pedidoId === "pA") });
  assert.deepStrictEqual(esc(st).filter((x) => x[2] !== 1), [["conta", "b1", 30]]);
  assert.strictEqual(doId(st, "a1").pagamentoConjunto, undefined, "desfazer tira a marca do conjunto");
  // paga A de novo, sozinho: um lançamento novo, sem duplicar
  await pagarLinha(st, ["pA"], "2026-10-25");
  const vals = esc(st).filter((x) => x[2] !== 1);
  assert.deepStrictEqual(vals.map((x) => x[2]).sort((a, b) => a - b), [30, 150]);
  assert.strictEqual(vals.find((x) => x[2] === 150)[1], "pA|material|2026-10-25");
  assert.notStrictEqual(doId(st, "a1").doc, doId(st, "b1").doc, "o novo pagamento não herda o papel do conjunto");
});

teste("1. excluir os pedidos de um pagamento conjunto leva o lançamento junto (e a trava do mês vê)", async () => {
  const st = estado({ obras: [obra([item("a1", "pA", 100), item("b1", "pB", 30)])], lancamentos: [] });
  await pagarLinha(st, ["pA", "pB"], "2026-10-20");
  assert.strictEqual(esc(st).length, 1);
  // mês fechado: a trava enxerga o lançamento do conjunto
  const fechado = { ...st.data, escritorio: { financeiro: { fechamentos: { "2026-10": { fechadoEm: "2026-11-03" } } } } };
  const st2 = estado(fechado);
  await st2.tela().apagarPedidoDeContas({ pedidoIds: ["pA", "pB"], obraId: "o1" });
  assert.strictEqual(st2.gravacoes, 0);
  assert.match(st2.alertas[0].titulo, /Mês fechado/);
  // mês aberto: sai tudo, sem órfão
  await st.tela().apagarPedidoDeContas({ pedidoIds: ["pA", "pB"], obraId: "o1" });
  assert.strictEqual(contas(st).length, 0);
  assert.deepStrictEqual(esc(st), []);
});

// ── 2. "Pagar os N pedidos" não remarca o pedido já pago ─────────────
teste("2. pagar a linha da loja não mexe no pedido pago antes (nem conjunto, nem cartão)", async () => {
  const st = estado({ obras: [obra([PAPEL, item("p1a", "P1", 100), item("p2a", "P2", 50), item("p3a", "P3", 30)])], lancamentos: [] });
  await pagarLinha(st, ["P1"], "2026-10-05");
  const p1 = doId(st, "p1a");
  st.cartao = { id: "k1", nome: "Visa", diaFechamento: 25, diaVencimento: 5 };
  await pagarLinha(st, ["P1", "P2", "P3"], "2026-10-20", "cartao", 1);
  assert.deepStrictEqual(doId(st, "p1a"), p1, "o pedido pago antes fica como estava");
  assert.ok(doId(st, "p2a").pagamentoConjunto && doId(st, "p2a").pagamentoConjunto === doId(st, "p3a").pagamentoConjunto);
  const f = G("linhasDaFatura")(st.data.obras, [], "k1", "2026-10", {});
  assert.deepStrictEqual(f.map((l) => l.refId).sort(), ["p2a", "p3a"]);
  assert.strictEqual(G("totalDaFatura")(f), 80);
});
teste("2. a linha da loja com um só pedido em aberto não vira pagamento conjunto", async () => {
  const st = estado({ obras: [obra([item("p1a", "P1", 100), item("p2a", "P2", 50)])], lancamentos: [] });
  await pagarLinha(st, ["P1"], "2026-10-05");
  await pagarLinha(st, ["P1", "P2"], "2026-10-20");
  assert.strictEqual(doId(st, "p2a").pagamentoConjunto, undefined);
  assert.strictEqual(doId(st, "p1a").pagamentoConjunto, undefined);
});

// ── 3. A marca do conjunto não sobrevive ao desfazer ─────────────────
teste("3. contaEmAberto tira pagamentoConjunto; contaPaga não herda marca velha", () => {
  const c = { id: "x", valor: 10, pago: true, pagoEm: "2026-10-01", valorPago: 10, pagamentoConjunto: "X", formaPagamento: "avista" };
  const aberta = G("contaEmAberto")(c, "eu");
  assert.strictEqual("pagamentoConjunto" in aberta, false);
  const paga = G("contaPaga")({ ...c, pago: false }, { pagoEm: "2026-10-05" }, "eu");
  assert.strictEqual("pagamentoConjunto" in paga, false);
});

// ── 4. Trava do mês fechado nas outras portas da baixa ───────────────
const SET_FECHADO = { escritorio: { financeiro: { fechamentos: { "2026-09": { fechadoEm: "2026-10-03" } } } } };
teste("4. Entrada paga à vista em mês fechado não grava (antes: conta paga e o lançamento nunca chegava)", () => {
  const st = estado({ ...SET_FECHADO, obras: [obra([])], lancamentos: [] });
  const r = st.tela().lancarEntradaDaObra({ situacao: "pago", pagamento: { data: "2026-09-28", forma: "pix" }, favorecido: "Loja",
    itens: [{ descricao: "cimento", total: 500, contaId: "material", etapa: "fundacao" }] }, null);
  assert.match(r.erro || "", /setembro de 2026 já está fechado/);
  assert.strictEqual(st.gravacoes, 0);
  // mês aberto: grava e o lançamento chega
  const r2 = st.tela().lancarEntradaDaObra({ situacao: "pago", pagamento: { data: "2026-10-02", forma: "pix" }, favorecido: "Loja",
    itens: [{ descricao: "cimento", total: 500, contaId: "material", etapa: "fundacao" }] }, null);
  assert.strictEqual(r2.gravado, true);
  assert.strictEqual(esc(st).length, 1);
});
teste("4. despesa da Entrada (avulsa e parcela) em mês fechado não grava; no cartão passa", () => {
  const st = estado({ ...SET_FECHADO, obras: [obra([{ id: "ct1", origem: "contrato", contratoId: "c", obraId: "o1", contaId: "empreiteiro", valor: 900, vencimento: "2026-09-10" }])], lancamentos: [] });
  const t = st.tela();
  assert.match(t.lancarDespesaDaEntrada({ valor: 300, pagoEm: "2026-09-15", contaId: "empreiteiro", favorecido: "Zé" }).erro || "", /já está fechado/);
  assert.match(t.lancarDespesaDaEntrada({ valor: 900, pagoEm: "2026-09-15", parcelaId: "ct1" }).erro || "", /já está fechado/);
  assert.strictEqual(st.gravacoes, 0);
  st.cartao = { id: "k1", nome: "Visa", diaFechamento: 25, diaVencimento: 5 };
  assert.strictEqual(st.tela().lancarDespesaDaEntrada({ valor: 300, pagoEm: "2026-09-15", contaId: "material", favorecido: "Loja", forma: "cartao", cartaoId: "k1" }).gravado, true);
});
teste("4. pedido lançado 'já pago' (e o regravado) em mês fechado não chega a lancarCotacaoEmContas", () => {
  const st = estado({ ...SET_FECHADO, obras: [obra([])], lancamentos: [] });
  const dados = { cotacaoId: "k", modo: "contaLoja", contaId: "material", pedido: { id: "p", jaPago: true, pagoEm: "2026-09-20", itens: [{ valor: 10 }] } };
  assert.match(st.tela().lancarPedidoNoMesAberto(dados).erro || "", /já está fechado/);
  st.tela({ pedidoEditando: { cotacao: { id: "k", lojaId: "l", obraId: "o1" } } }).salvarPedidoEditado({ id: "p", jaPago: true, pagoEm: "2026-09-20", itens: [{ valor: 10 }] });
  assert.strictEqual(st.lancouCotacao.length, 0);
  assert.match(st.alertas[0].titulo, /já está fechado/);
  // a prazo, ou num mês aberto, segue
  st.tela().lancarPedidoNoMesAberto({ ...dados, pedido: { ...dados.pedido, jaPago: false } });
  st.tela().lancarPedidoNoMesAberto({ ...dados, pedido: { ...dados.pedido, pagoEm: "2026-10-01" } });
  assert.strictEqual(st.lancouCotacao.length, 2);
});

// ── 5. Cliente paga direto: o honorário ainda atravessa ──────────────
teste("5. obra em que o cliente paga direto: honorário em mês fechado trava; material não", () => {
  const conta = (id, contaId) => ({ id, origem: "avulsa", obraId: "o1", contaId, valor: 2000, vencimento: "2026-09-30", descricao: id });
  const st = estado({ ...SET_FECHADO, obras: [obra([conta("g1", "taxa_admin_obra"), conta("m1", "material")], { clientePagaDireto: true })], lancamentos: [] });
  st.tela({ formPagamento: { conta: doId(st, "g1"), dataContab: "2026-09-30", valorPago: 2000 } }).confirmarPagamento();
  assert.strictEqual(st.gravacoes, 0);
  assert.match(st.alertas[0].mensagem, /já está fechado/);
  st.tela({ formPagamento: { conta: doId(st, "m1"), dataContab: "2026-09-30", valorPago: 2000 } }).confirmarPagamento();
  assert.strictEqual(st.gravacoes, 1);
  assert.strictEqual(doId(st, "m1").pago, true);
});

// ── 6. Cliente não deixa lançamento do escritório solto ──────────────
teste("6. cliente não desfaz o honorário pago pelo escritório nem apaga conta paga", async () => {
  const st = estado({ obras: [obra([
    { id: "g1", origem: "avulsa", obraId: "o1", contaId: "taxa_admin_obra", valor: 2000, vencimento: "2026-10-05", descricao: "Gerenciamento" },
    { id: "m1", origem: "avulsa", obraId: "o1", contaId: "material", valor: 50, vencimento: "2026-10-05", descricao: "Areia" },
    item("p1", "P1", 70)], { clientePagaDireto: true })], lancamentos: [] });
  for (const id of ["g1", "m1"]) st.tela({ formPagamento: { conta: doId(st, id), dataContab: "2026-10-05", valorPago: doId(st, id).valor } }).confirmarPagamento();
  await pagarLinha(st, ["P1"], "2026-10-05");
  assert.deepStrictEqual(esc(st).map((x) => x[1]), ["g1"]);
  const g = st.gravacoes;
  const cliente = { perm: { podeGerenciarObra: false, podeEditar: true, isCliente: true } };
  await st.tela(cliente).alternarPagamento(doId(st, "g1"));
  await st.tela(cliente).apagarPedidoDeContas({ pedidoIds: ["P1"], obraId: "o1" });
  assert.strictEqual(st.gravacoes, g, "nada gravado");
  assert.strictEqual(st.alertas.length, 2);
  // o material que ele mesmo pagou (sem destino no escritório) ele desfaz
  await st.tela(cliente).alternarPagamento(doId(st, "m1"));
  assert.strictEqual(doId(st, "m1").pago, false);
  assert.deepStrictEqual(esc(st).map((x) => x[1]), ["g1"]);
});

// ── 7. Parcela de contrato regerada guarda os papéis ─────────────────
teste("7. prorrogar uma parcela não apaga o boleto anexado a outra", () => {
  const ct = { ...G("contratoVazio")(null, "c1", "o1", "empreiteiro", "maoDeObra"), obraId: "o1", prestadorId: "p1", nomeContratado: "Zé",
    modalidade: "parcelado", valor: 3000, parcelas: 3, periodicidade: "mensais", primeiroVencimento: "2026-11-05", dataAssinatura: "2026-10-01" };
  let cs = G("sincronizarContasDaObra")([], [ct]);
  const boleto = { url: "u", public_id: "b1", nome: "4100.pdf", tipo: "boleto" };
  cs = cs.map((c, i) => (i === 1 ? { ...G("comAnexos")(c, [boleto]), doc: "4100", chaveNota: "CH" } : c));
  const aj = G("ajustarVencimentos")(ct, [{ id: cs[2].id, vencimento: "2027-02-10" }]);
  const depois = G("sincronizarContasDaObra")(cs, [aj]);
  assert.deepStrictEqual(depois[1].anexos, [boleto]);
  assert.strictEqual(depois[1].doc, "4100");
  assert.strictEqual(depois[1].chaveNota, "CH");
  assert.strictEqual(depois[2].vencimento, "2027-02-10");
  const comComprovante = G("sincronizarContasDaObra")([{ ...depois[0], comprovante: { url: "c" } }, ...depois.slice(1)], [aj]);
  assert.deepStrictEqual(comComprovante[0].comprovante, { url: "c" });
});

// ── 8/9. Datas locais (UTC-3) ────────────────────────────────────────
teste("8. contabilizadoEm é o dia local mesmo depois das 21h", () => {
  const c = G("contaPaga")({ id: "x", valor: 10 }, { pagoEm: "2026-10-24" }, "eu", "2026-10-25T01:30:00.000Z");
  assert.strictEqual(c.contabilizadoEm, "2026-10-24");
});
teste("9. base da obra: a data de entrada é o dia local do carimbo", () => {
  const c = { id: "x", obraId: "o1", contaId: "material", valor: 10, vencimento: "2026-10-30",
    registros: [{ ato: "criada", em: "2026-10-25T01:30:00.000Z", por: "eu" }] };
  const l = G("linhasDaBase")([{ id: "o1", nome: "O", contasPagar: [c] }], {})[0];
  assert.strictEqual(l.entradaEm, "2026-10-24");
  assert.strictEqual(l.dataLanc, "2026-10-24");
  const l2 = G("linhasDaBase")([{ id: "o1", nome: "O", contasPagar: [{ ...c, registros: [], lancadoEm: "2026-10-25T02:00:00.000Z" }] }], {})[0];
  assert.strictEqual(l2.entradaEm, "2026-10-24");
});

// ── 10. Parcela estornada: a base vê o lançamento "#n" ───────────────
teste("10. cpLancamentoDaConta acha o lançamento da parcela estornada e paga de novo", () => {
  const c = { id: "ct:3", origem: "contrato", contaId: "empreiteiro", pago: true, pagoEm: "2026-10-20", valor: 1000, valorPago: 1000, estornos: [{ em: "2026-10-01" }] };
  const ob = { id: "o1", contasPagar: [c] };
  const r = G("lancamentosDaObraParaEscritorio")(ob, { id: "cli" }, { contasPagar: [c] });
  assert.strictEqual(r.lancamentos[0].origem.refId, "ct:3#1");
  assert.strictEqual(G("cpLancamentoDaConta")(r.lancamentos, "o1", c), r.lancamentos[0]);
  assert.strictEqual(G("linhasDaBase")([ob], { lancamentos: r.lancamentos })[0].noEscritorio, true);
});

// ── 11. Parcelas do cartão: o pedido se divide uma vez ───────────────
teste("11. pedido de 3 itens de 10,00 em 3x no cartão: faturas de 10,00 / 10,00 / 10,00", async () => {
  const st = estado({ obras: [obra([item("i1", "P", 10), item("i2", "P", 10), item("i3", "P", 10)])], lancamentos: [],
  }, { cartao: { id: "k1", nome: "Visa", diaFechamento: 25, diaVencimento: 5 } });
  await pagarLinha(st, ["P"], "2026-10-20", "cartao", 3);
  const totais = ["2026-10", "2026-11", "2026-12"].map((m) => G("totalDaFatura")(G("linhasDaFatura")(st.data.obras, [], "k1", m, {})));
  assert.deepStrictEqual(totais, [10, 10, 10]);
  for (const c of contas(st)) assert.strictEqual(cent(c.parcelasCartao.reduce((t, p) => t + p.valor, 0)), 10, "cada item soma o seu valor");
  // itens desiguais: a soma por fatura é a do total dividido uma vez
  const lista = [7.01, 11.33, 5.5].map((v, i) => ({ id: "x" + i, cartaoId: "k1", valor: v,
    ...G("pagamentoNoCartao")({ valor: v }, { id: "k1", diaFechamento: 25 }, { pagoEm: "2026-10-20", valorPago: v, parcelas: 4 }) }));
  const ac = G("acertarParcelasDoCartaoNoPedido")(lista, ["x0", "x1", "x2"]);
  const porFatura = [0, 1, 2, 3].map((k) => cent(ac.reduce((t, c) => t + c.parcelasCartao[k].valor, 0)));
  assert.deepStrictEqual(porFatura, G("parcelasDoCartao")({ id: "k1", diaFechamento: 25 }, "2026-10-20", 23.84, 4).map((p) => p.valor));
  ac.forEach((c, i) => assert.strictEqual(cent(c.parcelasCartao.reduce((t, p) => t + p.valor, 0)), lista[i].valor));
});

for (const [nome, fn] of fila) {
  try { await fn(); passou++; console.log(`  ok  ${nome}`); }
  catch (e) { falhou++; console.log(`FALHOU  ${nome}`); console.log(`        ${e.message}`); }
}
console.log(`\n${passou} passou, ${falhou} falhou`);
if (falhou) process.exit(1);
