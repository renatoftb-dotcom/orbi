// Contas a receber (contas-receber.jsx) — node puro, sem framework.
//   node contas-receber.test.mjs
// Carrega a parte pura do financeiro do escritório (as regras de projeto e da
// ponte da obra) e a parte pura do Contas a receber.
process.env.TZ = process.env.TZ || "America/Sao_Paulo";

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const raiz = dirname(fileURLToPath(import.meta.url));
const ler = (f) => readFileSync(join(raiz, "src", "modules", f), "utf8");
const ef = ler("escritorio-financeiro.jsx");
const cr = ler("contas-receber.jsx");
const puroEf = ef.slice(0, ef.indexOf("// UI — daqui para baixo"));
const a = cr.indexOf("// ── A receber: parte pura"), b = cr.indexOf("// ── A receber: fim da parte pura");
if (a < 0 || b < 0) throw new Error("marcadores da parte pura não encontrados");
const M = new Function(puroEf + "\n" + cr.slice(a, b) + `
  return { crSomarMeses, crGerarParcelas, novasContasAReceber, itensAReceber, resumoAReceber, candidatosDoRecebimento,
    receberContaAReceber, desfazerRecebimento, ligarParcelaDeProjeto, extratoEscritorio, lancamentosDoEscritorio,
    planoDaVenda, obraComVenda, obraSemVenda, resumoDasVendas, entradasDeVendaSoltas, contasDaVenda };`)();

const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);
const soma = (l) => Math.round(l.reduce((t, x) => t + x.valor, 0) * 100) / 100;
let n = 0;
const novoId = () => "id" + (++n);

teste("parcelas: entrada + 3 mensais somam o total; dia 31 vira o último dia do mês curto", () => {
  const r = M.crGerarParcelas({ valorTotal: "100.000,00", entrada: "20.000", dataEntrada: "2026-10-31", nParcelas: "3", primeiroVencimento: "2027-01-31" });
  assert.ok(!r.erro, r.erro);
  assert.deepStrictEqual(r.parcelas.map((p) => [p.rotulo, p.valor, p.vencimento]),
    [["Entrada", 20000, "2026-10-31"], ["Parcela 1/3", 26666.66, "2027-01-31"], ["Parcela 2/3", 26666.66, "2027-02-28"], ["Parcela 3/3", 26666.68, "2027-03-31"]]);
  assert.strictEqual(soma(r.parcelas), 100000);
  assert.ok(M.crGerarParcelas({ valorTotal: "", nParcelas: 1 }).erro);
  assert.ok(M.crGerarParcelas({ valorTotal: 100, entrada: 200, dataEntrada: "2026-10-01" }).erro, "entrada maior que o total");
  // à vista: só a entrada
  assert.deepStrictEqual(M.crGerarParcelas({ valorTotal: 500, entrada: 500, dataEntrada: "2026-10-10" }).parcelas.map((p) => p.rotulo), ["Entrada"]);
});

const CLIENTES = [{ id: "emp1", nome: "Jacarezinho Módulo 1", servicos: { empreendimento: true } }, { id: "c1", nome: "Ana" }];

teste("venda de empreendimento vira contas a receber (tipo receber) e não entra no extrato do escritório", () => {
  const r = M.novasContasAReceber({ tipo: "venda", empreendimentoId: "emp1", cliente: "Bruno", descricao: "Casa 2 — Lote 21",
    valorTotal: 300000, entrada: 60000, dataEntrada: "2026-10-20", nParcelas: 2, primeiroVencimento: "2026-11-20" }, { clientes: CLIENTES, novoId, quem: "Renato" });
  assert.ok(!r.erro, r.erro);
  assert.strictEqual(r.contas.length, 3);
  assert.ok(r.contas.every((c) => c.tipo === "receber" && c.contaId === "emp_venda" && c.unidadeId === "empreendimento" && c.empreendimentoId === "emp1" && c.projeto === "Jacarezinho Módulo 1"));
  assert.strictEqual(soma(r.contas), 300000);
  assert.strictEqual(M.lancamentosDoEscritorio({ lancamentos: r.contas }).length, 0);
  assert.ok(M.novasContasAReceber({ tipo: "venda", descricao: "x", valorTotal: 1, entrada: 1, dataEntrada: "2026-10-01" }, {}).erro, "sem empreendimento");
  assert.ok(M.novasContasAReceber({ tipo: "outro", descricao: "x", valorTotal: 1, entrada: 1, dataEntrada: "2026-10-01" }, {}).erro, "sem conta");
});

teste("receber: lança Venda de imóvel no mês do dia; recebido a menos deixa o saldo a receber; mês fechado recusa", () => {
  const { contas } = M.novasContasAReceber({ tipo: "venda", empreendimentoId: "emp1", cliente: "Bruno", descricao: "Casa 2",
    valorTotal: 100000, entrada: 0, nParcelas: 1, primeiroVencimento: "2026-10-15" }, { clientes: CLIENTES, novoId });
  const id = contas[0].id;
  const fech = { "2026-09": { fechadoEm: "x" } };
  assert.ok(/fechado/.test(M.receberContaAReceber(contas, id, "2026-09-30", 100000, { fechamentos: fech, novoId }).erro));
  const r = M.receberContaAReceber(contas, id, "2026-10-16", "80.000,00", { fechamentos: fech, novoId, quem: "Renato" });
  assert.ok(!r.erro, r.erro);
  assert.strictEqual(r.falta, 20000);
  const lanc = r.lancamentos.find((l) => l.tipo === "escritorio");
  assert.deepStrictEqual([lanc.contaId, lanc.valor, lanc.competencia, lanc.unidadeId, lanc.empreendimentoId, lanc.contaBanco, lanc.origem.tipo],
    ["emp_venda", 80000, "2026-10", "empreendimento", "emp1", "sim", "receber"]);
  const abertas = r.lancamentos.filter((l) => l.tipo === "receber" && !l.recebido);
  assert.deepStrictEqual(abertas.map((l) => l.valor), [20000], "o saldo continua a receber");
  // no extrato do escritório: venda de 80.000 no bloco do empreendimento
  const ext = M.extratoEscritorio(M.lancamentosDoEscritorio({ lancamentos: r.lancamentos }), { saldoAbertura: 0 }).find((x) => x.mes === "2026-10");
  assert.strictEqual(ext.saldoEmpreendimento, 80000);
  // a lista: 1 recebida (escondida por padrão) e o saldo aberto
  const itens = M.itensAReceber({ lancamentos: r.lancamentos, clientes: CLIENTES });
  assert.deepStrictEqual(itens.map((i) => [i.origem, i.valor]), [["venda", 20000]]);
  // desfazer tira o lançamento criado
  const d = M.desfazerRecebimento(r.lancamentos, id, { fechamentos: fech });
  assert.ok(!d.erro, d.erro);
  assert.ok(!d.lancamentos.some((l) => l.id === lanc.id));
  assert.ok(!d.lancamentos.find((l) => l.id === id).recebido);
  // valor acima do que falta: recusa
  assert.ok(M.receberContaAReceber(contas, id, "2026-10-16", 100001, { novoId }).erro);
});

teste("o extrato já trouxe a venda: o recebimento liga ao lançamento existente, sem duplicar; desfazer não apaga esse lançamento", () => {
  const { contas } = M.novasContasAReceber({ tipo: "venda", empreendimentoId: "emp1", cliente: "Bruno", descricao: "Casa 3",
    valorTotal: 50000, entrada: 0, nParcelas: 1, primeiroVencimento: "2026-10-10" }, { clientes: CLIENTES, novoId });
  const doExtrato = { id: "lx", tipo: "escritorio", contaId: "emp_venda", valor: 50000, competencia: "2026-10", lancadoEm: "2026-10-12", descricao: "PIX RECEBIDO BRUNO", extratoId: "b1", conferido: true };
  const lancs = contas.concat([doExtrato, { id: "ly", tipo: "escritorio", contaId: "emp_venda", valor: 49000, competencia: "2026-10", lancadoEm: "2026-10-12" }]);
  const it = M.itensAReceber({ lancamentos: lancs, clientes: CLIENTES })[0];
  assert.deepStrictEqual(M.candidatosDoRecebimento(it, { lancamentos: lancs }).map((l) => l.id), ["lx"]);
  const r = M.receberContaAReceber(lancs, it.id, "", "", { usarLancamentoId: "lx" });
  assert.ok(!r.erro, r.erro);
  assert.strictEqual(r.lancamentos.filter((l) => l.tipo === "escritorio").length, 2, "nenhum lançamento novo");
  assert.strictEqual(M.candidatosDoRecebimento(it, { lancamentos: r.lancamentos }).length, 0, "já usado");
  const d = M.desfazerRecebimento(r.lancamentos, it.id, {});
  assert.ok(d.lancamentos.some((l) => l.id === "lx"), "o lançamento do extrato fica");
});

teste("a lista junta projetos ganhos, honorários de gerenciamento das obras e as vendas", () => {
  const orc = { id: "ORC-0001", clienteId: "c1", referencia: "Casa Ana", status: "ganho",
    fechamento: { valorTotalFechado: 10000, condicao: { tipo: "parcelado", parcelas: [{ nome: "1ª", valor: 5000, data: "2026-10-05" }, { nome: "2ª", valor: 5000, data: "2026-11-05" }] } } };
  const obra = { id: "o1", nome: "Reforma Loja", clienteId: "c1", contasPagar: [
    { id: "g1", contaId: "taxa_admin_obra", descricao: "Parcela 4/12", valor: 10833.33, vencimento: "2026-11-05" },
    { id: "g0", contaId: "taxa_admin_obra", descricao: "Parcela 3/12", valor: 10833.33, vencimento: "2026-10-05", pago: true },
    { id: "m1", contaId: "material", descricao: "Cimento", valor: 300, vencimento: "2026-10-10" }] };
  const itens = M.itensAReceber({ orcamentosProjeto: [orc], obras: [obra], clientes: CLIENTES, lancamentos: [] });
  assert.deepStrictEqual(itens.map((i) => [i.origem, i.vencimento, i.valor]),
    [["projeto", "2026-10-05", 5000], ["projeto", "2026-11-05", 5000], ["obra", "2026-11-05", 10833.33]]);
  const res = M.resumoAReceber(itens, "2026-10-24");
  assert.deepStrictEqual([res.vencido, res.proximos, res.total], [5000, 15833.33, 20833.33]);
  // a parcela de projeto já lançada pelo extrato (sem origem) se liga
  const doExtrato = { id: "lp", tipo: "escritorio", contaId: "rec_projetos", valor: 5000, competencia: "2026-10", lancadoEm: "2026-10-06" };
  const cand = M.candidatosDoRecebimento(itens[0], { lancamentos: [doExtrato] });
  assert.deepStrictEqual(cand.map((l) => l.id), ["lp"]);
  const r = M.ligarParcelaDeProjeto([doExtrato], itens[0].parcela, "lp");
  const depois = M.itensAReceber({ orcamentosProjeto: [orc], obras: [], clientes: CLIENTES, lancamentos: r.lancamentos });
  assert.deepStrictEqual(depois.map((i) => i.vencimento), ["2026-11-05"], "a 1ª saiu do a receber");
});

let ok = 0, falhou = 0;
teste("vendas do empreendimento: unidade, sinal já recebido + parcelas + financiamento; o que falta receber", () => {
  const sinal1 = { id: "s1", contaId: "venda_imovel", descricao: "Pagamento sinal Residência 01", valor: 5000, valorPago: 5000, pago: true, pagoEm: "2026-09-24" };
  const sinal2 = { id: "s2", contaId: "venda_imovel", descricao: "Residência 01", valor: 7000, valorPago: 7000, pago: true, pagoEm: "2026-09-24" };
  const obra = { id: "o1", nome: "Módulo 1", unidadesVenda: [{ id: "u1", nome: "Residência 01", area: "45,93", precoEstimado: 210000 }, { id: "u2", nome: "Residência 02", precoEstimado: 210000 }],
    contasPagar: [sinal1, sinal2, { id: "x", contaId: "material", valor: 100, pago: true }] };
  assert.deepStrictEqual(M.entradasDeVendaSoltas(obra.contasPagar).map((c) => c.id), ["s1", "s2"]);
  const f = { unidadeId: "u1", comprador: "Comprador Exemplo", data: "2026-09-20", valor: "200.000,00",
    sinais: [{ contaId: "s1" }, { contaId: "s2" }], nParcelas: "4", valorParcela: "2.000,00", primeiroVencimento: "2026-10-20",
    financiamento: "180.000,00", dataFinanciamento: "2027-03-15" };
  // a soma não fecha: avisa quanto falta
  assert.match(M.planoDaVenda({ ...f, financiamento: "170.000" }, { unidades: obra.unidadesVenda, contas: obra.contasPagar }).erro, /faltam R\$ 10\.000,00/);
  let n = 0;
  const p = M.planoDaVenda(f, { unidades: obra.unidadesVenda, contas: obra.contasPagar, obraId: "o1", novoId: () => "n" + (++n), quem: "R" });
  assert.ok(!p.erro, p.erro);
  assert.deepStrictEqual(p.ligar, ["s1", "s2"]);
  assert.deepStrictEqual(p.novas.map((c) => [c.parteVenda, c.valor, c.vencimento, c.contaId, c.pago]),
    [["parcela", 2000, "2026-10-20", "venda_imovel", false], ["parcela", 2000, "2026-11-20", "venda_imovel", false], ["parcela", 2000, "2026-12-20", "venda_imovel", false],
     ["parcela", 2000, "2027-01-20", "venda_imovel", false], ["financiamento", 180000, "2027-03-15", "venda_imovel", false]]);
  const o2 = M.obraComVenda(obra, p);
  assert.deepStrictEqual(o2.contasPagar.filter((c) => c.vendaId).map((c) => c.id), ["s1", "s2", "n2", "n3", "n4", "n5", "n6"]);
  const r = M.resumoDasVendas(o2);
  assert.deepStrictEqual([r.unidades, r.vendidas, r.estimado, r.vendido, r.recebido, r.aReceber], [2, 1, 420000, 200000, 12000, 188000]);
  assert.strictEqual(r.linhas[0].contas[0].parteVenda, "sinal");
  // desfazer: sai o que falta receber; os sinais ficam na obra, soltos de novo
  const o3 = M.obraSemVenda(o2, p.venda.id);
  assert.deepStrictEqual(o3.contasPagar.map((c) => c.id), ["s1", "s2", "x"]);
  assert.ok(!o3.contasPagar[0].vendaId && !o3.vendas.length);
});

for (const [nome, fn] of testes) {
  try { fn(); ok++; console.log("  ok  " + nome); }
  catch (e) { falhou++; console.log("  FALHOU  " + nome + "\n        " + (e && e.message)); }
}
console.log(`\n${ok}/${ok + falhou} passaram`);
if (falhou) process.exit(1);
