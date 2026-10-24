// Testes das correções do financeiro do escritório (revisão "ef").
//   node fix-ef.test.mjs
// Cada teste reproduz um bug achado na revisão: falhava antes da correção.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const raiz = dirname(fileURLToPath(import.meta.url));
const arquivo = readFileSync(join(raiz, "src", "modules", "escritorio-financeiro.jsx"), "utf8");
const corte = arquivo.indexOf("// UI — daqui para baixo");
if (corte < 0) throw new Error("Marcador de início da UI não encontrado em escritorio-financeiro.jsx");
const src = arquivo.slice(0, corte);
const nomes = [...new Set([...src.matchAll(/^(?:async )?function ([A-Za-z0-9_]+)|^const ([A-Za-z0-9_]+) =/gm)].map((m) => m[1] || m[2]))];
const M = new Function(src + "\nreturn {" + nomes.join(",") + "};")();

const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);

// ── 1. Estorno editado mantém o sinal ───────────────────────────
teste("1. editar um estorno de −500 e salvar continua −500", () => {
  const inicial = { id: "e1", contaId: "utensilios", valor: -500, estorno: true };
  // o campo, com `negativo`, mostra e devolve o sinal ao sair
  const canon = M.valorBRDeFora(inicial.valor);
  const aoSair = M.valorBRCompleto(M.valorBRDigitado(M.valorBRNaTela(canon), { negativo: M.efSinalFixoDoEstorno(inicial) }));
  assert.strictEqual(aoSair, "-500,00");
  assert.strictEqual(M.efValorComSinalDoEstorno(aoSair, inicial), -500);
  // mesmo se a pessoa redigitar sem o sinal, o estorno fica estorno
  assert.strictEqual(M.efValorComSinalDoEstorno("450,00", inicial), -450);
  // lançamento antigo negativo sem a marca também
  assert.strictEqual(M.efValorComSinalDoEstorno("500,00", { id: "x", valor: -500 }), -500);
  // lançamento comum e lançamento novo: positivo como sempre
  assert.strictEqual(M.efValorComSinalDoEstorno("500,00", { id: "y", valor: 300 }), 500);
  assert.strictEqual(M.efValorComSinalDoEstorno("500,00", { valor: -500, estorno: true }), 500, "novo (sem id) vem pelo sinal do banco");
  assert.strictEqual(M.efSinalFixoDoEstorno({ id: "y", valor: 300 }), false);
});

// ── 2. Compra no cartão não conta 2x no Investido ───────────────
teste("2. investido: fatura fechada não soma a compra do cartão de novo por fora", () => {
  const planoObra = [{ id: "material", nome: "Material", grupo: "materiais" }];
  const cartao = { id: "k1", nome: "Visa", diaFechamento: 1, diaVencimento: 10 };
  const cli = { id: "e1", nome: "Jacarezinho Mod 1", servicos: { empreendimento: true } };
  const conta = { id: "cp1", contaId: "material", valor: 1000, valorPago: 1000, pago: true, pagoEm: "2026-09-15", formaPagamento: "cartao", cartaoId: "k1",
    parcelasCartao: M.parcelasDoCartao(cartao, "2026-09-15", 1000, 1), descricao: "cimento" };
  const obra = { id: "ob1", nome: "Mod 1", clienteId: "e1", contasPagar: [conta] };
  assert.deepStrictEqual(M.investidoDoEmpreendimento(cli, [obra], [], { planoObra }), { pelaConta: 0, foraDaConta: 1000, total: 1000 });
  const f = M.faturaParaFechar(cartao, [obra], [], "2026-10", { clientes: [cli], planoObra });
  const lf = M.lancamentoDaFatura(cartao, "2026-10", f.linhas, {});
  assert.deepStrictEqual(M.investidoDoEmpreendimento(cli, [obra], [lf], { planoObra }), { pelaConta: 1000, foraDaConta: 0, total: 1000 });
  // parcelada em 3: só a parcela da fatura fechada sai do "por fora"
  const c3 = { ...conta, id: "cp3", parcelasCartao: M.parcelasDoCartao(cartao, "2026-09-15", 900, 3), valor: 900, valorPago: 900 };
  const ob3 = { ...obra, contasPagar: [c3] };
  const f3 = M.faturaParaFechar(cartao, [ob3], [], "2026-10", { clientes: [cli], planoObra });
  const l3 = M.lancamentoDaFatura(cartao, "2026-10", f3.linhas, {});
  assert.deepStrictEqual(M.investidoDoEmpreendimento(cli, [ob3], [l3], { planoObra }), { pelaConta: 300, foraDaConta: 600, total: 900 });
});

// ── 3. Arquivo parcial não apaga o resto do mês; mês fechado não muda ──
teste("3. extrato parcial substitui só os dias que cobre", () => {
  const set = [
    { data: "2026-09-02", valor: -100, historico: "PIX EMITIDO A", documento: "" },
    { data: "2026-09-10", valor: -200, historico: "PIX EMITIDO B", documento: "" },
    { data: "2026-09-25", valor: -300, historico: "PIX EMITIDO C", documento: "" },
  ];
  let r = M.extratosComArquivo({}, M.comIdsDosMovimentos(set), "set.ofx", "t1");
  const ultimos30 = [
    { data: "2026-09-25", valor: -300, historico: "PIX EMITIDO C", documento: "" },
    { data: "2026-09-27", valor: -40, historico: "PIX EMITIDO E", documento: "" },
    { data: "2026-10-03", valor: -50, historico: "PIX EMITIDO D", documento: "" },
  ];
  r = M.extratosComArquivo(r.extratos, M.comIdsDosMovimentos(ultimos30), "out.ofx", "t2");
  assert.deepStrictEqual(r.meses, ["2026-09", "2026-10"]);
  assert.deepStrictEqual(M.movimentosGuardadosDoMes(r.extratos, "2026-09").map((m) => m.historico),
    ["PIX EMITIDO A", "PIX EMITIDO B", "PIX EMITIDO C", "PIX EMITIDO E"]);
  assert.deepStrictEqual(M.movimentosGuardadosDoMes(r.extratos, "2026-10").map((m) => m.historico), ["PIX EMITIDO D"]);
  // dentro dos dias cobertos, o arquivo novo manda: a linha que sumiu do banco sai
  const corrigido = [{ data: "2026-09-10", valor: -210, historico: "PIX EMITIDO B2", documento: "" }];
  const r2 = M.extratosComArquivo(r.extratos, M.comIdsDosMovimentos(corrigido), "c.ofx", "t3");
  assert.deepStrictEqual(M.movimentosGuardadosDoMes(r2.extratos, "2026-09").map((m) => m.historico),
    ["PIX EMITIDO A", "PIX EMITIDO B2", "PIX EMITIDO C", "PIX EMITIDO E"]);
});

teste("3. mês fechado: o extrato guardado não muda e a tela é avisada", () => {
  const set = [{ data: "2026-09-02", valor: -100, historico: "PIX EMITIDO A", documento: "" }];
  const r = M.extratosComArquivo({}, M.comIdsDosMovimentos(set), "set.ofx", "t1");
  const fechamentos = { "2026-09": { fechadoEm: "2026-10-05T10:00:00Z", saldoBanco: 0 } };
  const novo = [{ data: "2026-09-02", valor: -999, historico: "PIX EMITIDO Z", documento: "" },
    { data: "2026-10-01", valor: -50, historico: "PIX EMITIDO D", documento: "" }];
  const r2 = M.extratosComArquivo(r.extratos, M.comIdsDosMovimentos(novo), "n.ofx", "t2", { fechamentos });
  assert.deepStrictEqual(r2.fechados, ["2026-09"]);
  assert.deepStrictEqual(r2.meses, ["2026-10"]);
  assert.deepStrictEqual(M.movimentosGuardadosDoMes(r2.extratos, "2026-09").map((m) => m.historico), ["PIX EMITIDO A"]);
  assert.deepStrictEqual(M.movimentosGuardadosDoMes(r2.extratos, "2026-10").map((m) => m.historico), ["PIX EMITIDO D"]);
});

// ── 4. Saída direto na reserva tem teto ─────────────────────────
teste("4. pagamento sugerido direto em res_engenharia não deixa a reserva negativa", () => {
  const lancs = [
    { id: "r1", contaId: "rec_projetos", unidadeId: "projetos", clienteId: "c1", cliente: "Ana", valor: 5000, competencia: "2026-08", contaBanco: "sim" },
    { id: "r1_1", contaId: "parceiros", unidadeId: "projetos", clienteId: "c1", cliente: "Ana", valor: 1000, competencia: "2026-08", contaBanco: "nao", conferido: true },
    { id: "r1_2", contaId: "res_engenharia", unidadeId: "projetos", clienteId: "c1", cliente: "Ana", valor: 1000, competencia: "2026-08", contaBanco: "nao", conferido: true },
  ];
  const hist = "PIX EMITIDO OUTRA IF · Pix ***.144.048-** JOAO ENGENHEIRO";
  const m1 = { id: "x1", data: "2026-08-20", valor: -800, historico: hist, documento: "" };
  const l1base = { ...M.lancamentoDaLinhaDoExtrato(m1, "2026-08", { campos: { contaId: "parceiros", unidadeId: "projetos", clienteId: "c1", cliente: "Ana", fornecedor: "Joao" } }), valor: 800 };
  const l1 = M.comoPagamentoDaReserva(M.comSinalDeEstorno(l1base), lancs);
  assert.strictEqual(l1.contaId, "res_engenharia"); assert.strictEqual(l1.valor, -800);
  lancs.push({ ...l1, id: "p1", criadoEm: "2026-08-20T10:00:00Z" });
  // a 2ª parcela copia a 1ª (res_engenharia): só 200 cabem na reserva
  const m2 = { id: "x2", data: "2026-09-20", valor: -800, historico: hist, documento: "" };
  const sug = M.sugestaoDoExtrato(m2, lancs);
  assert.strictEqual(sug.campos.contaId, "res_engenharia");
  const r = M.lancamentoRapidoDoExtrato(m2, "2026-09", sug, {}, [], lancs);
  assert.ok(r.lancamento, r.erro);
  assert.strictEqual(r.lancamento.contaId, "parceiros");
  assert.strictEqual(r.lancamento.valor, 800, "a linha do banco inteira");
  const { recebimentoExtras, ...principal } = r.lancamento;
  lancs.push({ ...principal, id: "p2" }, ...recebimentoExtras.map((x, i) => ({ ...x, id: "p2_" + i })));
  assert.strictEqual(M.saldoDaReservaEngenharia(lancs, "c1"), 0, "a reserva zera, não fica negativa");
  const res = M.resumoDoPeriodoEscritorio(lancs);
  assert.strictEqual(res.contas.find((c) => c.contaId === "parceiros").valor, 1600, "pago ao engenheiro: 1.600");
  // reserva vazia: a saída inteira é custo em Parceiros
  const m3 = { id: "x3", data: "2026-10-20", valor: -500, historico: hist, documento: "" };
  const r3 = M.lancamentoRapidoDoExtrato(m3, "2026-10", M.sugestaoDoExtrato(m3, lancs), {}, [], lancs);
  assert.strictEqual(r3.lancamento.contaId, "parceiros"); assert.strictEqual(r3.lancamento.valor, 500);
  assert.ok(!r3.lancamento.estorno && !r3.lancamento.recebimentoExtras);
  // o par fora do banco (entrada na reserva) não passa pela régua
  assert.strictEqual(M.comoPagamentoDaReserva(lancs[2], lancs), null);
});

// ── 5. Vencimento antes do fechamento é no mês seguinte ─────────
teste("5. fatura que fecha 25 e vence 5 é debitada no mês seguinte", () => {
  const cartao = { id: "c1", nome: "Nubank", diaFechamento: 25, diaVencimento: 5 };
  const parc = M.parcelasDoCartao(cartao, "2026-09-10", 300, 1);
  assert.strictEqual(parc[0].competencia, "2026-09", "a competência da fatura não muda");
  const l = M.lancamentoDaFatura(cartao, "2026-09", [{ valor: 300, descricao: "x", origem: "escritorio" }], {});
  assert.strictEqual(l.lancadoEm, "2026-10-05");
  assert.strictEqual(l.competencia, "2026-10");
  assert.strictEqual(l.id, M.idDaFatura("c1", "2026-09"));
  // vence depois do fechamento: no mesmo mês, como antes
  const l2 = M.lancamentoDaFatura({ id: "c2", diaFechamento: 1, diaVencimento: 10 }, "2026-09", [{ valor: 10 }], {});
  assert.strictEqual(l2.lancadoEm, "2026-09-10");
  // virada do ano
  const l3 = M.lancamentoDaFatura(cartao, "2026-12", [{ valor: 10 }], {});
  assert.strictEqual(l3.lancadoEm, "2027-01-05");
});

// ── 6. Fechar fora de ordem não duplica ─────────────────────────
teste("6. fechar novembro antes de outubro: outubro fica fechado junto", () => {
  const cartao = { id: "k1", nome: "Visa", diaFechamento: 1, diaVencimento: 10 };
  const compra = (id, data, valor) => ({ id, tipo: "escritorio", contaId: "utensilios", unidadeId: "escritorio", valor, lancadoEm: data, competencia: data.slice(0, 7),
    cartaoId: "k1", formaPagamento: "cartao", parcelasCartao: M.parcelasDoCartao(cartao, data, valor, 1) });
  const lancs = [compra("a", "2026-09-15", 100), compra("b", "2026-10-15", 200)];
  const fNov = M.faturaParaFechar(cartao, [], lancs, "2026-11", {});
  assert.strictEqual(fNov.atrasadas.length, 1);
  const lNov = M.lancamentoDaFatura(cartao, "2026-11", fNov.linhas, {});
  assert.deepStrictEqual(lNov.origem.cobre, ["2026-10"]);
  lancs.push(lNov);
  const fOut = M.faturaParaFechar(cartao, [], lancs, "2026-10", {});
  assert.strictEqual(fOut.jaFechada, true, "outubro já entrou na fatura de novembro");
  assert.ok(M.faturasFechadas(lancs, "k1").has("2026-10"));
  // a compra de outubro está travada (está numa fatura fechada)
  assert.ok(M.fechadasDaCompra(lancs[0], lancs).length > 0);
  // fatura sem atrasadas não ganha o campo
  assert.strictEqual(M.lancamentoDaFatura(cartao, "2026-12", [{ valor: 5 }], {}).origem.cobre, undefined);
});

// ── 7. Ano com dois dígitos ─────────────────────────────────────
teste("7. data dd/mm/aa vira 20aa e o movimento entra no mês", () => {
  assert.strictEqual(M.efData("25/09/26"), "2026-09-25");
  assert.strictEqual(M.efData("5.1.27"), "2027-01-05");
  assert.strictEqual(M.efData("25/09/2026"), "2026-09-25");
  assert.strictEqual(M.efData("25/09/202"), "", "três dígitos não é ano");
  const linhas = [["Data", "Histórico", "Documento", "Valor"], ["25/09/26", "PIX EMITIDO OUTRA IF · Fulano", "123", "-150,00"], ["26/09/26", "PIX RECEBIDO · Cicrano", "124", "1.200,50"]];
  const movs = M.comIdsDosMovimentos(M.movimentosDaTabela(linhas, M.detectarColunasTabela(linhas)));
  assert.deepStrictEqual(movs.map((m) => m.data), ["2026-09-25", "2026-09-26"]);
  assert.deepStrictEqual(M.extratosComArquivo({}, movs, "x", "t").meses, ["2026-09"]);
  const ch = M.checagemDebitoCredito(movs, [], "2026-09").extrato;
  assert.deepStrictEqual([ch.debitos, ch.creditos, ch.linhas], [150, 1200.5, 2]);
});

// ── 8. Entidades Latin-1 no extrato em HTML ─────────────────────
teste("8. &Ccedil;&Atilde; viram ÇÃ e a aplicação sai da fila", () => {
  const html = `<html><body><table><tr><th>Data</th><th>Documento</th><th>Hist&oacute;rico</th><th>Valor</th></tr>
<tr><td>01/09/2026</td><td>1</td><td>APLICA&Ccedil;&Atilde;O RDC</td><td>5.000,00D</td></tr>
<tr><td>02/09/2026</td><td>2</td><td>D&Eacute;B.TIT.COMPE &ordm; &amp; &AMP;</td><td>100,00D</td></tr>
<tr><td>03/09/2026</td><td>3</td><td>APLICA&#199;&#195;O RDC</td><td>1.000,00D</td></tr></table></body></html>`;
  const linhas = M.efLinhasDoHtml(html);
  assert.strictEqual(linhas[0][2], "Histórico");
  assert.strictEqual(linhas[1][2], "APLICAÇÃO RDC");
  assert.strictEqual(linhas[2][2], "DÉB.TIT.COMPE º & &");
  assert.strictEqual(M.efTextoDaCelulaHtml("a&ccedil;&Ccedil;&yuml;&nbsp;&xyz;"), "açÇÿ &xyz;", "a caixa importa; o desconhecido fica");
  const movs = M.comIdsDosMovimentos(M.movimentosDaTabela(linhas, M.detectarColunasTabela(linhas)));
  assert.strictEqual(M.efEhMovimento(movs[0].historico), false);
  const ex = M.checagemDebitoCredito(movs, [], "2026-09").extrato;
  assert.deepStrictEqual([ex.debitos, ex.aplicacoes, ex.linhas], [100, 6000, 1]);
});

// ── 9. Receita financeira paga na conta entra nas entradas ──────
teste("9. rendimento ligado à linha do banco é crédito do extrato; o da aplicação continua à parte", () => {
  const movs = M.comIdsDosMovimentos([{ data: "2026-09-30", valor: 12.34, historico: "RENDIMENTO POUPANCA", documento: "" }]);
  const l = { ...M.lancamentoDaLinhaDoExtrato(movs[0], "2026-09", { campos: { contaId: "rec_financeira", unidadeId: "escritorio" } }), valor: 12.34 };
  const ch = M.checagemDebitoCredito(movs, [l], "2026-09");
  assert.strictEqual(ch.base.entradas, 12.34);
  assert.strictEqual(ch.base.rendimento, 0);
  assert.strictEqual(ch.bate, true);
  // o do fechamento (origem rendimento) e o fora do banco seguem como rendimento
  assert.strictEqual(M.ehRendimentoDaAplicacao({ contaId: "rec_financeira", valor: 5, origem: { tipo: "rendimento" }, contaBanco: "sim", extratoId: "x" }), true);
  assert.strictEqual(M.ehRendimentoDaAplicacao({ contaId: "rec_financeira", valor: 5, contaBanco: "nao" }), true);
  // planilha antiga, sem linha do banco: a descrição ainda decide
  assert.strictEqual(M.ehRendimentoDaAplicacao({ contaId: "rec_financeira", valor: 5, descricao: "Receita de aplicação financeira" }), true);
});

// ── 11. Investido sem varrer a base inteira por conta ───────────
teste("11. investido com 4.900 lançamentos e 3.000 contas: mesmo número, rápido", () => {
  const planoObra = [{ id: "material", nome: "Material", grupo: "materiais" }];
  const cli = { id: "e1", nome: "Jac", servicos: { empreendimento: true } };
  const obras = [];
  for (let o = 0; o < 6; o++) { const cp = []; for (let k = 0; k < 500; k++) cp.push({ id: `o${o}k${k}`, contaId: "material", valor: 100 + k, pago: true, pagoEm: "2026-05-10" }); obras.push({ id: "ob" + o, clienteId: "e1", contasPagar: cp }); }
  const lancs = [];
  for (let i = 0; i < 4900; i++) lancs.push({ id: "l" + i, contaId: i % 3 ? "desp_outros" : "emp_construcao", empreendimentoId: i % 3 ? "" : "e1", valor: 50, competencia: "2025-01", lancadoEm: "2025-01-02",
    origem: i % 5 === 0 ? { obraId: "ob1", tipo: "conta", refId: "x" + i } : undefined });
  // uma conta ligada de verdade e uma achada pela base antiga (mesmo valor, mesmo dia)
  lancs.push({ id: "lig", contaId: "emp_construcao", empreendimentoId: "e1", valor: 100, competencia: "2026-05", lancadoEm: "2026-05-10", origem: { obraId: "ob0", tipo: "conta", refId: "o0k0" } });
  lancs.push({ id: "antigo", contaId: "emp_construcao", empreendimentoId: "e1", valor: 599, competencia: "2026-05", lancadoEm: "2026-05-11" });
  const t = Date.now();
  const r = M.investidoDoEmpreendimento(cli, obras, lancs, { planoObra });
  const ms = Date.now() - t;
  // por fora: todas as contas menos a ligada (100) e as de 599 (uma por obra: 6 iguais → não acha uma só, contam todas)
  const todas = 6 * (500 * 100 + (499 * 500) / 2);
  assert.strictEqual(r.foraDaConta, todas - 100);
  assert.strictEqual(r.pelaConta, 1634 * 50 + 100 + 599);
  assert.ok(ms < 200, `levou ${ms} ms (antes ~500 ms)`);
});

// ── 12. Separador pelo conjunto das primeiras linhas ────────────
teste("12. CSV com título em cima: o separador vem das linhas de dados", () => {
  const csv = "Extrato Conta Corrente\nData;Historico;Valor\n01/09/2026;PIX EMITIDO;-150,00\n02/09/2026;TARIFA;-12,50\n";
  assert.strictEqual(M.efSeparadorDoTexto(csv), ";");
  const linhas = M.efCsvParaTsv(csv).split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split("\t"));
  assert.deepStrictEqual(linhas[1], ["Data", "Historico", "Valor"]);
  assert.strictEqual(M.detectarColunasTabela(linhas).completo, true);
  assert.strictEqual(M.efSeparadorDoTexto("Data,Valor\n01/09/2026,-150.00\n"), ",");
  assert.strictEqual(M.efSeparadorDoTexto("a\tb\n1\t2,5\n"), "\t");
  assert.strictEqual(M.efSeparadorDoTexto("só uma coluna\noutra"), "\t");
});

let falhas = 0;
for (const [nome, fn] of testes) {
  try { fn(); console.log("  ok   " + nome); }
  catch (e) { falhas++; console.log("  FALHOU " + nome + "\n         " + String((e && e.message) || e).split("\n").join("\n         ")); }
}
console.log(`\n${testes.length - falhas}/${testes.length} passaram`);
if (falhas) process.exit(1);
