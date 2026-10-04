// Testes das contas a pagar da obra (node, sem framework).
// Roda com: node contas-pagar.test.mjs

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mod = (nome) => readFileSync(join(__dirname, "src", "modules", nome), "utf-8");
const contratosSrc = mod("contratos-obra.jsx");
const corte = contratosSrc.indexOf("// UI — documento e gerador");
const plano = mod("obra-financeiro.jsx");

// o calendário de feriados mora no cronograma; as datas de sexta-feira
// dependem dele
const cronoSrc = mod("cronograma-obra.jsx");
const cronoCorte = cronoSrc.indexOf("// UI — bloco");

const modulo = new Function(`
  var uid = () => "id1";
  ${plano}
  ${cronoSrc.slice(0, cronoCorte)}
  ${contratosSrc.slice(0, corte)}
  ${(() => { const cp = mod("contas-pagar.jsx"); const i = cp.indexOf("// UI — gráfico do fluxo mensal");
             if (i < 0) throw new Error("Marcador de início da UI não encontrado em contas-pagar.jsx");
             return cp.slice(0, cp.lastIndexOf("// ═", i)); })()}
  return { recalibrarPedido, previaDoPedido, contasDoPedido, docDaConta, diasEntreIso,
           pedidoVazio, itemDoPedidoVazio, brutoDoItem, brutoDoPedido, totalDoPedido,
           itensRateados, contasDoPedidoDaLoja, validarPedido, chaveDoDocumento, pedidosPendentes, baixarPedidos,
           podeMexerNoPedido, removerContasDoPedido, linhasDePedido, linhasDeLoja,
           contasDoPedidoDeConta, unitarioDaConta, apagarPedidoInteiro, resumoDoQueSai,
           pixDoPagamento, pixResumido, TIPOS_PIX, nomeDoTipoPix,
           MODOS_LANCAMENTO, modoLancamento,
           contasDaCotacao, contasDeCotacao,
           PLANO_CONTAS, contratoVazio, valorContrato,
           parcelasAPagar, contasDoContrato, sincronizarContasDoContrato, removerContasDoContrato,
           situacaoConta, rotuloSituacaoConta, diasParaVencer,
           totaisContas, realizadoPorConta, realizadoPorPrestador,
           contaDoTipo, contaAvulsaVazia, somarDias, somarMeses, vencimentoFinal, medicoesPrevistas,
           tituloConta, detalheConta, agruparContas, filtrarContas, rotuloMes,
           VISOES_CONTAS, FILTROS_CONTAS, FILTRO_CONTAS_PADRAO, seriesDoFiltro,
           sincronizarContasDaObra, contasDesatualizadas, somarDias, contasDoContrato,
           extratoMensal, mesesDoExtrato, acumuladoAte, entradaObraVazia, mesDe,
           extratoMatriz, estimativaPorConta,
           GRUPOS_PL, linhasEstimativaPL, definirEstimativaDaConta, totaisEstimativaPL,
           subcontasDaConta, plPorEtapa, contaPorId,
           itemDeQuadro, itensDetalhados, EST_ORIGEM_QUADRO,
           CARGA_ESTIMATIVA_UNICA, estimativaCargaUnica,
           linhaFinalExtrato, fechoEstimativaPL, plDaObra, progressoCusto,
           prestadoresDoPL, CONTAS_PRESTADOR_EXTRA,
           aneisDosGrupos, visaoUsaAnel, VISOES_CONTAS_EM_ANEL,
           removerOrfasDeContrato, assinaturaContas, folhaDeComprovantes,
           recalibrarContrato, previaRecalibragem, primeiroVencimentoContrato,
           contratoPorItem, recalibrarItens, datasDosItens, previaEntreContratos,
           tituloCurtoConta, apoioCurtoConta, tituloConta, detalheConta,
           proximoNumeroContrato, servicoDoContrato, fluxoMensal,
           registrarAto, registrosDaConta, textoDoAto, ultimoAto, contaPaga, contaEmAberto, CP_ATOS, contasDaEntrada, papelJaLancado, gruposDeContasPorRef, casarPapelComContas, distribuirPapeisDoLote, ligacaoDoCsv, numeroDoArquivo, buscarContas, temPapel, FILTROS_PAPEL,
           CP_MAX_REGISTROS,
           recalibrarContasDoPedido, previaDatasDoPedido, numerarPedidosAntigos, numerarContas, proximaReferencia, cpMedicaoEmUmaData,
           ajustarValores, ajustesDeValorDoContrato, totalDaRecalibragem, conciliarValorDaConta,
           plPorEtapa, estimativaPorEtapaDoOrcamento,
           plPorInsumo, conferenciaDaLigacao, dimensoesDaConta,
           grupoCanonico, grupoDoItem, subcontasDaConta, GRUPOS_MATERIAL,
           detalheDaEdicaoDaConta,
           pagamentosEmAberto, ajustarVencimentos, limparAjustes, ajustesDoContrato,
           previaAjusteContrato, proximoNumeroDoc };
`)();

let passou = 0, falhou = 0;
function teste(nome, fn) {
  try { fn(); passou++; console.log(`  ok  ${nome}`); }
  catch (e) { falhou++; console.log(`FALHOU  ${nome}`); console.log(`        ${e.message}`); }
}
const base = (extra) => ({ ...modulo.contratoVazio(null, "c1", "o1", "empreiteiro", "maoDeObra"), obraId: "o1", prestadorId: "p1", nomeContratado: "Zé Empreiteiro", ...extra });
const soma = (linhas) => Math.round(linhas.reduce((a, l) => a + l.valor, 0) * 100) / 100;


// ── Número de referência da transação ───────────────────────────

// ── Medição vira conta por item ─────────────────────────────────
const MED = [{ id: "i1", insumoCodigo: "CON-001", descricao: "Concreto - FCK25",
  unidade: "m3", quantidade: 7, unitario: 343.64, etapa: "fundacao", grupoMaterial: "Concreto" }];
const DADOS_MED = { cotacaoId: "c1", obraId: "o1", contaId: "material",
  prestadorId: "f1", favorecido: "D-MIX CONCRETO", modo: "parcelas", parcelas: 1,
  primeiroVencimento: "2026-09-30", medicao: MED, valor: 2405.48, descricao: "Concreto" };


// ── Recalibrar valor, não só data ───────────────────────────────
const CONTAS_REC = [
  { id: "x1", cotacaoId: "cot1", descricao: "Parcela 1", vencimento: "2026-10-10", valor: 1000, pago: false, registros: [] },
  { id: "x2", cotacaoId: "cot1", descricao: "Parcela 2", vencimento: "2026-11-10", valor: 1000, pago: false, registros: [] },
  { id: "x3", cotacaoId: "cot1", descricao: "Parcela 3", vencimento: "2026-09-10", valor: 1000, pago: true, valorPago: 1000, registros: [] },
];


// ── Exceção de valor no contrato ────────────────────────────────

// ── Quantidade, preço e valor na conta a pagar ──────────────────
teste("mexer na quantidade refaz o valor", () => {
  const c = { quantidade: 11, unitario: 343.64, valor: 3780.04 };
  const r = modulo.conciliarValorDaConta(c, "quantidade", 7);
  assert.strictEqual(r.quantidade, 7);
  assert.strictEqual(r.unitario, 343.64);
  assert.strictEqual(r.valor, 2405.48);
});

teste("mexer no unitário refaz o valor", () => {
  const r = modulo.conciliarValorDaConta({ quantidade: 7, unitario: 343.64, valor: 2405.48 }, "unitario", 300);
  assert.strictEqual(r.valor, 2100);
});

teste("mexer no valor refaz o unitário — o valor é o que o fornecedor cobrou", () => {
  const r = modulo.conciliarValorDaConta({ quantidade: 7, unitario: 343.64, valor: 2405.48 }, "valor", 2100);
  assert.strictEqual(r.valor, 2100);
  assert.strictEqual(r.unitario, 300);
});

teste("sem quantidade, a conta é um valor seco e continua assim", () => {
  const r = modulo.conciliarValorDaConta({ descricao: "Caçamba", valor: 300 }, "valor", 250);
  assert.strictEqual(r.valor, 250);
  assert.strictEqual(r.unitario, undefined);
});

teste("pôr quantidade numa conta que só tinha valor deduz o unitário", () => {
  const r = modulo.conciliarValorDaConta({ valor: 600 }, "quantidade", 4);
  assert.strictEqual(r.unitario, 150);
  assert.strictEqual(r.valor, 600);
});

teste("quantidade zerada não divide por zero", () => {
  const r = modulo.conciliarValorDaConta({ quantidade: 7, unitario: 100, valor: 700 }, "quantidade", 0);
  assert.strictEqual(r.valor, 700, "sem quantidade o valor fica como estava");
  assert.ok(Number.isFinite(modulo.conciliarValorDaConta({ quantidade: 0, valor: 700 }, "valor", 500).valor));
});

teste("valor corrigido na parcela do contrato sobrevive ao recálculo da tela", () => {
  const ct = base({ valor: 3000, modalidade: "parcelado", parcelas: 3,
    periodicidade: "mensais", dataInicio: "2026-09-01" });
  const antes = modulo.contasDoContrato(ct);
  assert.strictEqual(antes.length, 3);
  const alvo = antes[0];
  const ajustado = modulo.ajustarValores(ct, [{ id: alvo.id, valor: 700 }]);
  const depois = modulo.contasDoContrato(ajustado);
  assert.strictEqual(depois[0].valor, 700);
  assert.strictEqual(depois[0].valorAjustado, true);
  assert.strictEqual(depois[1].valor, antes[1].valor, "as outras não se mexem");
  // e o recálculo de novo, como a tela faz a cada abertura, mantém o 700
  assert.strictEqual(modulo.contasDoContrato(ajustado)[0].valor, 700);
});

teste("voltar ao valor da regra apaga a exceção", () => {
  const ct = base({ valor: 3000, modalidade: "parcelado", parcelas: 3,
    periodicidade: "mensais", dataInicio: "2026-09-01" });
  const original = modulo.contasDoContrato(ct)[0];
  const ajustado = modulo.ajustarValores(ct, [{ id: original.id, valor: 700 }]);
  assert.ok(Object.keys(modulo.ajustesDeValorDoContrato(ajustado)).length);
  const devolvido = modulo.ajustarValores(ajustado, [{ id: original.id, valor: original.valor }]);
  assert.strictEqual(Object.keys(modulo.ajustesDeValorDoContrato(devolvido)).length, 0);
});

teste("recalibrar muda o valor da parcela em aberto", () => {
  const r = modulo.recalibrarContasDoPedido(CONTAS_REC, [{ id: "x1", valor: 700 }], "Renato", "2026-10-02T10:00:00Z");
  assert.strictEqual(r[0].valor, 700);
  assert.strictEqual(r[0].vencimento, "2026-10-10", "data não mexida continua igual");
  assert.strictEqual(r[1].valor, 1000);
});

teste("data e valor na mesma mexida, num registro só", () => {
  const r = modulo.recalibrarContasDoPedido(CONTAS_REC,
    [{ id: "x1", valor: 700, vencimento: "2026-10-20" }], "Renato", "2026-10-02T10:00:00Z");
  assert.strictEqual(r[0].valor, 700);
  assert.strictEqual(r[0].vencimento, "2026-10-20");
  const ato = (r[0].registros || []).slice(-1)[0];
  assert.ok(/→/.test(ato.detalhe || ""), JSON.stringify(ato));
  assert.ok(/R\$/.test(ato.detalhe || ""), "o registro conta a mudança de valor");
});

teste("parcela paga não se mexe — é fato consumado", () => {
  const r = modulo.recalibrarContasDoPedido(CONTAS_REC, [{ id: "x3", valor: 1 }], "Renato");
  assert.strictEqual(r[2].valor, 1000);
});

teste("valor igual não é mudança", () => {
  const r = modulo.recalibrarContasDoPedido(CONTAS_REC, [{ id: "x1", valor: 1000 }], "Renato");
  assert.strictEqual(r[0], CONTAS_REC[0]);
});

teste("valor zero ou vazio é ignorado, não zera a parcela", () => {
  const r = modulo.recalibrarContasDoPedido(CONTAS_REC, [{ id: "x1", valor: "" }, { id: "x2", valor: 0 }], "Renato");
  assert.strictEqual(r[0].valor, 1000);
  assert.strictEqual(r[1].valor, 1000);
});

teste("o total antes e depois, que é o que se confere", () => {
  const tot = modulo.totalDaRecalibragem([
    { id: "a", valorOriginal: 1000, valor: 700 },
    { id: "b", valorOriginal: 1000, valor: 1000 },
  ]);
  assert.strictEqual(tot.antes, 2000);
  assert.strictEqual(tot.depois, 1700);
  assert.strictEqual(tot.diferenca, -300);
  assert.strictEqual(tot.mudou, true);
});

teste("só mexeu em data: o total diz que não mudou", () => {
  const tot = modulo.totalDaRecalibragem([{ id: "a", valorOriginal: 1000, valor: 1000 }]);
  assert.strictEqual(tot.mudou, false);
});

teste("medição com uma data vira conta por item, com quantidade e etapa", () => {
  assert.strictEqual(modulo.cpMedicaoEmUmaData(DADOS_MED), true);
  let n = 0;
  const contas = modulo.contasDaCotacao(DADOS_MED, () => "k" + (++n));
  assert.strictEqual(contas.length, 1);
  assert.strictEqual(contas[0].insumoCodigo, "CON-001");
  assert.strictEqual(contas[0].quantidade, 7);
  assert.strictEqual(contas[0].unidade, "m3");
  assert.strictEqual(contas[0].etapa, "fundacao");
  assert.strictEqual(contas[0].cotacaoId, "c1");
  assert.strictEqual(Math.round(contas[0].valor * 100) / 100, 2405.48);
});

teste("parcelado volta a ser por parcela — consumo não se divide por mês", () => {
  const d = { ...DADOS_MED, parcelas: 3 };
  assert.strictEqual(modulo.cpMedicaoEmUmaData(d), false);
  const contas = modulo.contasDaCotacao(d, (() => { let n = 0; return () => "p" + (++n); })());
  assert.strictEqual(contas.length, 3);
  assert.strictEqual(contas[0].insumoCodigo, undefined);
});

teste("sem medição, nada muda", () => {
  const d = { ...DADOS_MED, medicao: [] };
  assert.strictEqual(modulo.cpMedicaoEmUmaData(d), false);
});

teste("a sequência é uma só: conta a pagar continua de onde o pedido parou", () => {
  const obras = [{ id: "o1", contratos: [{ numeroContrato: "0003" }], cotacoes: [{ numeroPedido: "0007" }], contasPagar: [] }];
  const contas = [{ id: "a" }, { id: "b" }];
  const r = modulo.numerarContas(contas, obras, []);
  assert.deepStrictEqual(r.map((c) => c.numeroDoc), ["0008", "0009"]);
});

teste("o lançamento do escritório também consome a sequência", () => {
  const obras = [{ id: "o1", contratos: [], cotacoes: [], contasPagar: [{ numeroDoc: "0011" }] }];
  const lancs = [{ numeroDoc: "0042" }];
  assert.strictEqual(modulo.proximaReferencia(obras, lancs), "0043");
  assert.deepStrictEqual(modulo.numerarContas([{ id: "x" }], obras, lancs).map((c) => c.numeroDoc), ["0043"]);
});

teste("quem já tem número não é renumerado", () => {
  const contas = [{ id: "a", numeroDoc: "0002" }, { id: "b" }];
  const r = modulo.numerarContas(contas, [], []);
  assert.strictEqual(r[0].numeroDoc, "0002");
  assert.strictEqual(r[1].numeroDoc, "0001");
});

teste("lista toda numerada volta intacta, sem criar objeto novo", () => {
  const contas = [{ id: "a", numeroDoc: "0002" }];
  assert.strictEqual(modulo.numerarContas(contas, [], []), contas);
});

teste("datas: soma dias e meses sem escorregar no fim do mês", () => {
  assert.strictEqual(modulo.somarDias("2026-09-07", 15), "2026-09-22");
  assert.strictEqual(modulo.somarDias("2026-12-25", 10), "2027-01-04");
  assert.strictEqual(modulo.somarMeses("2026-01-31", 1), "2026-02-28");
  assert.strictEqual(modulo.somarMeses("2026-11-30", 3), "2027-02-28");
  assert.strictEqual(modulo.somarDias("", 5), "");
});

teste("parcelado: uma conta por parcela, na periodicidade escolhida, fechando o total", () => {
  const c = base({ valor: 12000, modalidade: "parcelado", parcelas: 6, periodicidade: "mensais", dataInicio: "2026-09-01" });
  const l = modulo.parcelasAPagar(c);
  assert.strictEqual(l.length, 6);
  assert.strictEqual(soma(l), 12000);
  assert.strictEqual(l[0].valor, 2000);
  assert.strictEqual(l[0].vencimento, "2026-10-01");
  // "mensais" anda de mês em mês, preservando o dia
  assert.strictEqual(l[5].vencimento, "2027-03-01");
  assert.ok(l[0].descricao.includes("1/6") && l[0].descricao.includes("mensal"));
  // quinzenal é sexta sim, sexta não: a partir de 01/09/2026 (terça), a
  // primeira cai na segunda sexta — 11/09 — e as demais a cada 14 dias
  const q = modulo.parcelasAPagar({ ...c, periodicidade: "quinzenais" });
  assert.strictEqual(q[0].vencimento, "2026-09-11");
  assert.strictEqual(q[1].vencimento, "2026-09-25");
  // semanal: toda sexta, começando na primeira posterior ao início
  assert.strictEqual(modulo.parcelasAPagar({ ...c, periodicidade: "semanais" })[0].vencimento, "2026-09-04");
  // resíduo de arredondamento vai para a última
  const r = modulo.parcelasAPagar({ ...c, valor: 10000, parcelas: 3 });
  assert.strictEqual(soma(r), 10000);
  assert.notStrictEqual(r[2].valor, r[0].valor);
});

teste("entrada + parcelas: entrada na assinatura e o saldo dividido", () => {
  const c = base({ valor: 100000, modalidade: "entradaParcelas", entradaPct: 30, parcelas: 5,
    periodicidade: "mensais", dataAssinatura: "2026-09-07", dataInicio: "2026-10-01" });
  const l = modulo.parcelasAPagar(c);
  assert.strictEqual(l.length, 6);
  assert.strictEqual(l[0].descricao, "Entrada");
  assert.strictEqual(l[0].valor, 30000);
  assert.strictEqual(l[0].vencimento, "2026-09-07", "a entrada vence na assinatura");
  assert.strictEqual(l[1].vencimento, "2026-11-01", "as parcelas contam do início da obra, de mês em mês");
  assert.strictEqual(soma(l), 100000);
});

teste("entrada + saldo no final: contrato todo ou item a item", () => {
  const todo = modulo.parcelasAPagar(base({ modelo: "empreitadaGlobal", valor: 50000, modalidade: "entradaFinal",
    entradaEscopo: "contrato", entradaPct: 40, dataAssinatura: "2026-09-07", dataInicio: "2026-09-10",
    prazoQtd: 3, prazoUnidade: "meses" }));
  assert.deepStrictEqual(todo.map(x => x.valor), [20000, 30000]);
  assert.strictEqual(todo[0].vencimento, "2026-09-07");
  assert.strictEqual(todo[1].vencimento, "2026-12-10", "sem previsão informada, o saldo cai no fim do prazo");
  assert.ok(todo[1].estimada, "o saldo depende da conclusão: data estimada");
  assert.ok(!todo[0].estimada, "a entrada vence na assinatura, não é estimativa");

  // a previsão de conclusão informada manda no saldo
  const comPrevisao = modulo.parcelasAPagar(base({ modelo: "empreitadaGlobal", valor: 50000, modalidade: "entradaFinal",
    entradaEscopo: "contrato", entradaPct: 40, dataAssinatura: "2026-09-07", dataInicio: "2026-09-10",
    prazoQtd: 3, prazoUnidade: "meses", previsaoConclusao: "2027-01-20" }));
  assert.strictEqual(comPrevisao[1].vencimento, "2027-01-20");
  assert.ok(comPrevisao[1].estimada);

  // item a item: a entrada vence no início do item, o saldo na previsão dele
  const porItem = modulo.parcelasAPagar(base({ modelo: "empreitadaGlobal", modalidade: "entradaFinal",
    entradaEscopo: "item", entradaPct: 50, dataAssinatura: "2026-09-07", previsaoConclusao: "2026-12-20",
    itens: [{ descricao: "Portão", valor: 60000, inicio: "2026-10-01", previsao: "2026-11-30" },
            { descricao: "Vitrine", valor: 40000 }] }));
  assert.strictEqual(porItem.length, 4);
  assert.strictEqual(soma(porItem), 100000);
  assert.ok(porItem[0].descricao.startsWith("Portão — entrada"));
  assert.strictEqual(porItem[0].valor, 30000);
  assert.strictEqual(porItem[0].vencimento, "2026-10-01", "a entrada vence quando o item começa");
  assert.ok(porItem[0].estimada, "início planejado é estimativa");
  assert.strictEqual(porItem[1].vencimento, "2026-11-30", "a previsão do próprio item");
  assert.ok(porItem[1].estimada);
  // item sem datas próprias: entrada na assinatura (firme), saldo na previsão do contrato
  assert.strictEqual(porItem[2].vencimento, "2026-09-07");
  assert.ok(!porItem[2].estimada);
  assert.strictEqual(porItem[3].vencimento, "2026-12-20", "item sem previsão usa a do contrato");
});

teste("ressincronizar a obra corrige contas geradas por regras antigas", () => {
  const c = base({ id: "ct1", valor: 120000, modalidade: "parcelado", parcelas: 12, periodicidade: "mensais",
    diaVencimento: 5, dataInicio: "2026-09-20" });
  const certas = modulo.contasDoContrato(c);
  assert.strictEqual(certas[0].vencimento, "2026-10-05");
  assert.strictEqual(certas[3].vencimento, "2027-01-05", "todo mês no mesmo dia");
  // como saíam antes: 30 em 30 dias, escorregando o dia
  const antigas = certas.map((x, i) => ({ ...x, vencimento: modulo.somarDias("2026-09-20", 30 * (i + 1)) }));
  antigas[0] = { ...antigas[0], pago: true, valorPago: 10000, pagoEm: "2026-10-21" };
  assert.ok(modulo.contasDesatualizadas(antigas, [c]));
  const arrumadas = modulo.sincronizarContasDaObra(antigas, [c]);
  assert.ok(!modulo.contasDesatualizadas(arrumadas, [c]), "depois de ressincronizar, nada mais muda");
  const paga = arrumadas.find(x => x.id === antigas[0].id);
  assert.ok(paga.pago && paga.valorPago === 10000, "a parcela paga fica como está");
  assert.strictEqual(arrumadas.find(x => x.id === certas[3].id).vencimento, "2027-01-05");
  // contas avulsas não são tocadas
  const comAvulsa = [...antigas, { id: "av1", origem: "avulsa", descricao: "Caçamba", valor: 350, vencimento: "2026-10-02" }];
  assert.ok(modulo.sincronizarContasDaObra(comAvulsa, [c]).some(x => x.id === "av1"));
});

teste("medição: uma conta por medição dentro do prazo, marcada como estimada", () => {
  const c = base({ valor: 90000, modalidade: "medicao", medicaoPeriodicidade: "mensal", medicaoPrazoDias: 10,
    prazoQtd: 3, prazoUnidade: "meses", dataInicio: "2026-09-01" });
  assert.strictEqual(modulo.medicoesPrevistas(c), 3);
  const l = modulo.parcelasAPagar(c);
  assert.strictEqual(l.length, 3);
  assert.strictEqual(soma(l), 90000);
  assert.ok(l.every(x => x.estimada));
  assert.strictEqual(l[0].vencimento, "2026-10-11", "30 dias de medição + 10 de prazo de pagamento");
  // sem prazo definido não dá para prever medição nenhuma
  assert.deepStrictEqual(modulo.parcelasAPagar({ ...c, prazoQtd: "", prazoUnidade: "" }), []);
});

teste("contrato sem valor ou sem parcelas não gera conta", () => {
  assert.deepStrictEqual(modulo.parcelasAPagar(base({ valor: 0, modalidade: "parcelado", parcelas: 5 })), []);
  assert.deepStrictEqual(modulo.parcelasAPagar(base({ valor: 5000, modalidade: "parcelado", parcelas: "" })), []);
});

teste("a conta nasce com o favorecido, o prestador e a conta do plano de contas", () => {
  const c = base({ id: "ctr1", valor: 6000, modalidade: "parcelado", parcelas: 2, dataInicio: "2026-09-01" });
  const contas = modulo.contasDoContrato(c);
  assert.strictEqual(contas.length, 2);
  assert.deepStrictEqual(
    { id: contas[0].id, origem: contas[0].origem, contratoId: contas[0].contratoId, obraId: contas[0].obraId,
      contaId: contas[0].contaId, prestadorId: contas[0].prestadorId, favorecido: contas[0].favorecido, pago: contas[0].pago },
    { id: "ctr1:1", origem: "contrato", contratoId: "ctr1", obraId: "o1",
      contaId: "empreiteiro", prestadorId: "p1", favorecido: "Zé Empreiteiro", pago: false });
  // cada ofício cai na sua conta do plano de contas, e todas existem lá
  for (const t of ["empreiteiro", "serralheiro", "pintor", "encanador", "gestaoObra", "outro", "inexistente"]) {
    const id = modulo.contaDoTipo(t);
    assert.ok(modulo.PLANO_CONTAS.some(x => x.id === id), `conta ${id} não existe no plano de contas`);
  }
  assert.strictEqual(modulo.contaDoTipo("serralheiro"), "serralheiro");
  // gestão de obra é o gerenciamento, em SERVIÇOS & TAXAS
  assert.strictEqual(modulo.contaDoTipo("gestaoObra"), "taxa_admin_obra");
  assert.strictEqual(modulo.PLANO_CONTAS.find(x => x.id === "taxa_admin_obra").nome, "Gerenciamento de obra");
  assert.strictEqual(modulo.contaDoTipo("outro"), "mo_diversos");
});

teste("regravar o contrato atualiza o que está em aberto e preserva o que foi pago", () => {
  const c = base({ id: "ctr1", valor: 6000, modalidade: "parcelado", parcelas: 3, dataInicio: "2026-09-01" });
  const avulsa = { id: "av1", origem: "avulsa", obraId: "o1", descricao: "Caçamba", valor: 300, pago: false };
  const outroContrato = { id: "ctr2:1", origem: "contrato", contratoId: "ctr2", valor: 1000, pago: false };
  let contas = modulo.sincronizarContasDoContrato([avulsa, outroContrato], c);
  assert.strictEqual(contas.length, 5);
  // paga a primeira
  contas = contas.map(x => x.id === "ctr1:1" ? { ...x, pago: true, pagoEm: "2026-10-02", valorPago: 2000 } : x);
  // o contrato muda de valor: as parcelas em aberto acompanham, a paga não
  const depois = modulo.sincronizarContasDoContrato(contas, { ...c, valor: 9000 });
  const doContrato = depois.filter(x => x.contratoId === "ctr1");
  assert.strictEqual(doContrato.length, 3);
  assert.strictEqual(doContrato.find(x => x.id === "ctr1:1").valorPago, 2000, "a parcela paga fica como está");
  assert.strictEqual(doContrato.find(x => x.id === "ctr1:1").valor, 2000);
  assert.strictEqual(doContrato.find(x => x.id === "ctr1:2").valor, 3000, "as em aberto seguem o contrato");
  // avulsa e contrato alheio ficam intactos
  assert.ok(depois.find(x => x.id === "av1") && depois.find(x => x.id === "ctr2:1"));
  // encurtar o contrato tira as parcelas em aberto que sobraram, mas mantém a paga
  const menor = modulo.sincronizarContasDoContrato(depois, { ...c, parcelas: 1 });
  const restantes = menor.filter(x => x.contratoId === "ctr1");
  assert.strictEqual(restantes.length, 1);
  assert.strictEqual(restantes[0].id, "ctr1:1");
  // remover o contrato leva junto o que está em aberto e preserva o pago
  const semContrato = modulo.removerContasDoContrato(depois, "ctr1");
  assert.strictEqual(semContrato.filter(x => x.contratoId === "ctr1").length, 1);
  assert.ok(semContrato.find(x => x.contratoId === "ctr1").pago);
});

teste("situação da conta e totais", () => {
  const hoje = "2026-09-07";
  assert.strictEqual(modulo.situacaoConta({ vencimento: "2026-09-01" }, hoje), "vencido");
  assert.strictEqual(modulo.situacaoConta({ vencimento: "2026-09-10" }, hoje), "vencendo");
  assert.strictEqual(modulo.situacaoConta({ vencimento: "2026-10-30" }, hoje), "aberto");
  assert.strictEqual(modulo.situacaoConta({ vencimento: "" }, hoje), "semData");
  assert.strictEqual(modulo.situacaoConta({ vencimento: "2026-09-01", pago: true }, hoje), "pago");
  const t = modulo.totaisContas([
    { valor: 1000, vencimento: "2026-09-01" },
    { valor: 2000, vencimento: "2026-10-01" },
    { valor: 500, vencimento: "2026-08-01", pago: true, valorPago: 480 },
  ], hoje);
  assert.deepStrictEqual(t, { total: 3500, aberto: 3000, vencido: 1000, pago: 480, qtdAberto: 2, qtdVencido: 1 });
});

teste("o que foi pago vira realizado por conta e por prestador", () => {
  const contas = [
    { contaId: "empreiteiro", prestadorId: "p1", valor: 2000, pago: true },
    { contaId: "empreiteiro", prestadorId: "p1", valor: 2000, pago: true, valorPago: 1800 },
    { contaId: "serralheiro", prestadorId: "p2", valor: 5000, pago: true },
    { contaId: "serralheiro", prestadorId: "p2", valor: 5000, pago: false },
    { contaId: "material", valor: 300, pago: true },
  ];
  assert.deepStrictEqual(modulo.realizadoPorConta(contas), { empreiteiro: 3800, serralheiro: 5000, material: 300 });
  assert.deepStrictEqual(modulo.realizadoPorPrestador(contas), { p1: 3800, p2: 5000, __sem_prestador__: 300 });
});

teste("conta avulsa nasce válida", () => {
  const a = modulo.contaAvulsaVazia("o1");
  assert.strictEqual(a.origem, "avulsa");
  assert.strictEqual(a.obraId, "o1");
  assert.ok(modulo.PLANO_CONTAS.some(c => c.id === a.contaId));
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(a.vencimento));
  assert.strictEqual(a.pago, false);
});

teste("número do contrato é sequencial e único no escritório", () => {
  assert.strictEqual(modulo.proximoNumeroContrato([]), "0001");
  assert.strictEqual(modulo.proximoNumeroContrato([{ contratos: [] }]), "0001");
  const obras = [
    { id: "o1", contratos: [{ id: "a", numeroContrato: "0001" }, { id: "b", numeroContrato: "0007" }] },
    { id: "o2", contratos: [{ id: "c", numeroContrato: "0003" }] },
    { id: "o3" },
  ];
  assert.strictEqual(modulo.proximoNumeroContrato(obras), "0008", "conta a partir do maior de todas as obras");
  // contrato antigo sem número não atrapalha
  assert.strictEqual(modulo.proximoNumeroContrato([{ contratos: [{ id: "x" }, { id: "y", numeroContrato: "0012" }] }]), "0013");
  assert.strictEqual(modulo.proximoNumeroContrato([{ contratos: [{ numeroContrato: "0099" }] }]), "0100");
});

teste("a conta se identifica por contrato, serviço, empresa e parcela", () => {
  const c = { ...base({ id: "ctr1", numeroContrato: "0007", valor: 60000, modalidade: "parcelado",
    parcelas: 6, dataInicio: "2026-09-01" }), tipoProfissional: "serralheiro", nomeContratado: "MB Viezzer" };
  const contas = modulo.contasDoContrato(c);
  assert.strictEqual(contas.length, 6);
  assert.strictEqual(contas[1].numeroContrato, "0007");
  assert.strictEqual(contas[1].servico, "Serralheria");
  assert.strictEqual(contas[1].parcela, 2);
  assert.strictEqual(contas[1].totalParcelas, 6);
  assert.strictEqual(modulo.tituloConta(contas[1]), "Contrato 0007 · Serralheria · MB Viezzer · Parcela 2/6");
  // entrada + saldo também numera as parcelas
  const ef = modulo.contasDoContrato(base({ id: "c2", numeroContrato: "0008", valor: 10000,
    modalidade: "entradaFinal", entradaEscopo: "contrato", entradaPct: 40, dataAssinatura: "2026-09-07",
    prazoQtd: 2, prazoUnidade: "meses", dataInicio: "2026-09-10" }));
  assert.strictEqual(ef[0].totalParcelas, 2);
  assert.ok(modulo.tituloConta(ef[0]).includes("Parcela 1/2"));
  // conta avulsa cai na descrição
  assert.strictEqual(modulo.tituloConta({ origem: "avulsa", descricao: "Caçamba", favorecido: "" }), "Caçamba");
  // a linha de apoio não repete o que o título já diz
  assert.strictEqual(modulo.detalheConta(contas[1]), "quinzenal", "o contrato deste teste é quinzenal");
  assert.strictEqual(modulo.detalheConta({ origem: "avulsa", descricao: "Caçamba" }), "Caçamba");
  assert.strictEqual(modulo.detalheConta({ origem: "contrato", descricao: "Entrada" }), "Entrada");
});

teste("visão por mês agrupa e ordena o fluxo", () => {
  const contas = [
    { id: "1", vencimento: "2026-10-01", valor: 1000 },
    { id: "2", vencimento: "2026-09-15", valor: 500 },
    { id: "3", vencimento: "2026-10-20", valor: 700, pago: true, valorPago: 700 },
    { id: "4", vencimento: "", valor: 300 },
  ];
  const g = modulo.agruparContas(contas, "mes", { hoje: "2026-09-07" });
  assert.deepStrictEqual(g.map(x => x.titulo), ["Setembro de 2026", "Outubro de 2026", "Sem vencimento"]);
  assert.deepStrictEqual(g[1].itens.map(x => x.id), ["1", "3"], "dentro do mês, por data");
  assert.strictEqual(g[1].totais.total, 1700);
  assert.strictEqual(g[1].totais.aberto, 1000);
  assert.strictEqual(modulo.rotuloMes("2026-03"), "Março de 2026");
  assert.strictEqual(modulo.rotuloMes(""), "Sem vencimento");
  // ano
  assert.deepStrictEqual(modulo.agruparContas(contas, "ano", {}).map(x => x.titulo), ["2026", "Sem vencimento"]);
});

teste("visões por fornecedor e por contrato usam os nomes de fora", () => {
  const contas = [
    { id: "1", prestadorId: "p1", valor: 1000, contratoId: "ctr1" },
    { id: "2", prestadorId: "p2", valor: 5000, contratoId: "ctr2" },
    { id: "3", prestadorId: "p1", valor: 200, contratoId: "ctr1" },
    { id: "4", favorecido: "", valor: 50, origem: "avulsa" },
  ];
  const ctx = { nomePrestador: (id) => ({ p1: "Zé Empreiteiro", p2: "MB Viezzer" }[id] || ""),
                nomeContrato: (id) => ({ ctr1: "Contrato 0001 · Obra Civil", ctr2: "Contrato 0002 · Serralheria" }[id] || "") };
  const f = modulo.agruparContas(contas, "fornecedor", ctx);
  assert.deepStrictEqual(f.map(x => x.titulo), ["MB Viezzer", "Zé Empreiteiro", "Sem fornecedor"], "maior valor primeiro");
  assert.strictEqual(f[1].totais.total, 1200);
  const k = modulo.agruparContas(contas, "contrato", ctx);
  assert.deepStrictEqual(k.map(x => x.titulo), ["Contrato 0002 · Serralheria", "Contrato 0001 · Obra Civil", "Contas avulsas"]);
});

teste("filtros: a pagar, vencidas e pagas", () => {
  const hoje = "2026-09-07";
  const contas = [
    { id: "1", vencimento: "2026-09-01", valor: 100 },
    { id: "2", vencimento: "2026-10-01", valor: 200 },
    { id: "3", vencimento: "2026-08-01", valor: 300, pago: true },
  ];
  assert.deepStrictEqual(modulo.filtrarContas(contas, "todas", hoje).map(c => c.id), ["1", "2", "3"]);
  assert.deepStrictEqual(modulo.filtrarContas(contas, "aPagar", hoje).map(c => c.id), ["1", "2"]);
  assert.deepStrictEqual(modulo.filtrarContas(contas, "vencidas", hoje).map(c => c.id), ["1"]);
  assert.deepStrictEqual(modulo.filtrarContas(contas, "pagas", hoje).map(c => c.id), ["3"]);
  assert.deepStrictEqual(modulo.VISOES_CONTAS.map(v => v.id), ["mes", "ano", "fornecedor", "contrato"]);
  assert.deepStrictEqual(modulo.FILTROS_CONTAS.map(f => f.id), ["todas", "aPagar", "vencidas", "pagas"]);
});

teste("fluxo mensal: uma barra por mês, separando pago, a pagar e vencido", () => {
  const hoje = "2026-09-07";
  const contas = [
    { id: "1", vencimento: "2026-09-01", valor: 1000 },                       // vencida
    { id: "2", vencimento: "2026-09-20", valor: 500 },                        // a pagar
    { id: "3", vencimento: "2026-09-05", valor: 300, pago: true, valorPago: 280 },
    { id: "4", vencimento: "2026-10-10", valor: 2000 },
    { id: "5", vencimento: "", valor: 700 },                                  // fora do gráfico
  ];
  const f = modulo.fluxoMensal(contas, hoje);
  assert.deepStrictEqual(f.meses.map(m => m.chave), ["2026-09", "2026-10"], "em ordem cronológica");
  assert.deepStrictEqual(f.meses.map(m => m.rotulo), ["set/26", "out/26"]);
  const set = f.meses[0];
  assert.strictEqual(set.qtd, 3);
  assert.strictEqual(set.vencido, 1000);
  assert.strictEqual(set.aberto, 500);
  assert.strictEqual(set.pago, 280, "o pago entra pelo valor efetivamente pago");
  assert.strictEqual(set.total, 1780);
  assert.strictEqual(set.vencido + set.aberto + set.pago, set.total, "as três faixas fecham o total do mês");
  assert.strictEqual(f.maior, 2000, "a escala vem do maior mês");
  // o que não tem vencimento fica de fora e é contado à parte
  assert.strictEqual(f.semData, 1);
  assert.strictEqual(f.semDataValor, 700);
  // sem contas, o gráfico não existe
  assert.deepStrictEqual(modulo.fluxoMensal([], hoje), { meses: [], semData: 0, semDataValor: 0, maior: 0 });
});

teste("o gráfico abre só com 'a pagar' e segue os quadros do topo", () => {
  assert.strictEqual(modulo.FILTRO_CONTAS_PADRAO, "aPagar");
  // "a pagar" inclui o vencido, como o quadro do topo: a barra do mês soma os dois
  assert.deepStrictEqual(modulo.seriesDoFiltro(modulo.FILTRO_CONTAS_PADRAO), ["vencido", "aberto"]);
  assert.deepStrictEqual(modulo.seriesDoFiltro("pagas"), ["pago"]);
  assert.deepStrictEqual(modulo.seriesDoFiltro("vencidas"), ["vencido"]);
  assert.deepStrictEqual(modulo.seriesDoFiltro("todas"), ["pago", "vencido", "aberto"]);
  // filtro desconhecido não deixa o gráfico vazio
  assert.deepStrictEqual(modulo.seriesDoFiltro("qualquer"), ["pago", "vencido", "aberto"]);
  // todo filtro dos quadros tem faixa definida
  for (const f of modulo.FILTROS_CONTAS) assert.ok(modulo.seriesDoFiltro(f.id).length > 0, f.id);
});

teste("primeiro vencimento manda nas datas — contrato lançado atrasado", () => {
  // contrato registrado hoje, mas cuja primeira parcela venceu no mês passado
  const c = base({ valor: 12000, modalidade: "parcelado", parcelas: 6, periodicidade: "mensais",
    dataInicio: "2026-09-01", primeiroVencimento: "2026-08-10" });
  const l = modulo.parcelasAPagar(c);
  assert.strictEqual(l[0].vencimento, "2026-08-10", "a primeira parcela vence na data informada");
  assert.strictEqual(l[1].vencimento, "2026-09-10");
  assert.strictEqual(l[5].vencimento, "2027-01-10", "as demais andam de mês em mês, no mesmo dia");
  // sem o campo, volta a contar da âncora
  const semCampo = modulo.parcelasAPagar({ ...c, primeiroVencimento: "" });
  assert.strictEqual(semCampo[0].vencimento, "2026-10-01");
  // quinzenal a partir da data informada: mantém o dia da semana dela
  const q = modulo.parcelasAPagar({ ...c, periodicidade: "quinzenais" });
  assert.strictEqual(q[0].vencimento, "2026-08-10");
  assert.strictEqual(q[1].vencimento, "2026-08-24");
});

teste("dia de vencimento ancora as mensais (o 'todo dia 05' do gerenciamento)", () => {
  const c = base({ valor: 120000, modalidade: "parcelado", parcelas: 12, periodicidade: "mensais",
    dataInicio: "2026-09-20", diaVencimento: 5 });
  const l = modulo.parcelasAPagar(c);
  assert.strictEqual(l[0].vencimento, "2026-10-05", "o dia 05 seguinte ao início");
  assert.strictEqual(l[1].vencimento, "2026-11-05");
  assert.strictEqual(l[11].vencimento, "2027-09-05");
  // início antes do dia 05 do próprio mês: a primeira cai no mês do início
  const cedo = modulo.parcelasAPagar({ ...c, dataInicio: "2026-09-01" });
  assert.strictEqual(cedo[0].vencimento, "2026-09-05");
  // o primeiro vencimento informado tem prioridade sobre o dia
  const forcado = modulo.parcelasAPagar({ ...c, primeiroVencimento: "2026-08-05" });
  assert.strictEqual(forcado[0].vencimento, "2026-08-05");
  // o dia se mantém mês a mês, custe o que custar ao calendário: 31 continua
  // 31 onde existe, e só encolhe em fevereiro
  const trintaEUm = modulo.parcelasAPagar({ ...c, diaVencimento: 31 }).map(x => x.vencimento);
  assert.deepStrictEqual(trintaEUm.slice(0, 7),
    ["2026-09-30", "2026-10-31", "2026-11-30", "2026-12-31", "2027-01-31", "2027-02-28", "2027-03-31"]);
  // dia 30 idem, sem escorregar para março
  const trinta = modulo.parcelasAPagar({ ...c, diaVencimento: 30, dataInicio: "2026-12-01" }).map(x => x.vencimento);
  assert.deepStrictEqual(trinta.slice(0, 4), ["2026-12-30", "2027-01-30", "2027-02-28", "2027-03-30"]);
});

teste("extrato mensal: o mês vem da data de contabilização, não do vencimento", () => {
  const contas = [
    // vence em setembro, contabilizada em outubro: entra em outubro
    { id: "a", origem: "contrato", contaId: "empreiteiro", valor: 10000, vencimento: "2026-09-10",
      pago: true, pagoEm: "2026-10-02", valorPago: 10000, contabilizadoEm: "2026-10-15" },
    { id: "b", origem: "avulsa", contaId: "material", valor: 2500, vencimento: "2026-10-05",
      pago: true, pagoEm: "2026-10-05", valorPago: 2400 },
    { id: "c", origem: "avulsa", contaId: "frete", valor: 300, vencimento: "2026-10-20" }, // não paga
    { id: "d", origem: "avulsa", contaId: "taxa_admin_obra", valor: 1200, vencimento: "2026-09-30",
      pago: true, pagoEm: "2026-09-30", valorPago: 1200 },
  ];
  const entradas = [{ id: "e1", contaId: "deposito_proprio", valor: 20000, data: "2026-10-01" }];
  const out = modulo.extratoMensal(contas, entradas, "2026-10");
  assert.deepStrictEqual(out.grupos.map(g => g.grupo.id), ["receitas", "materiais", "maoDeObra"]);
  assert.strictEqual(out.entradas, 20000);
  // 10.000 de empreiteiro + 2.400 de material (o valor PAGO, não o previsto)
  assert.strictEqual(out.custos, 12400);
  assert.strictEqual(out.saldo, 7600);
  const materiais = out.grupos.find(g => g.grupo.id === "materiais");
  assert.deepStrictEqual(materiais.linhas.map(l => [l.conta.id, l.valor]), [["material", 2400]]);
  // setembro tem só a taxa de administração
  const set = modulo.extratoMensal(contas, entradas, "2026-09");
  assert.strictEqual(set.custos, 1200);
  assert.strictEqual(set.saldo, -1200);
  // meses com movimento, mais o mês corrente
  assert.deepStrictEqual(modulo.mesesDoExtrato(contas, entradas, "2026-11-08"), ["2026-09", "2026-10", "2026-11"]);
  // acumulado até outubro: 20.000 de entradas contra 13.600 de custos
  assert.deepStrictEqual(modulo.acumuladoAte(contas, entradas, "2026-10"), { entradas: 20000, custos: 13600, saldo: 6400 });
  assert.strictEqual(modulo.acumuladoAte(contas, entradas, "2026-09").saldo, -1200);
  // conta nova de entrada nasce como depósito de recurso próprio
  assert.strictEqual(modulo.entradaObraVazia("o1").contaId, "deposito_proprio");
  assert.strictEqual(modulo.mesDe("2026-10-02"), "2026-10");
});

teste("recalibrar joga o contrato inteiro para a nova data do 1º pagamento", () => {
  const c = base({ id: "ct9", valor: 120000, modalidade: "parcelado", parcelas: 12, periodicidade: "mensais",
    diaVencimento: 5, dataInicio: "2026-09-20" });
  assert.strictEqual(modulo.primeiroVencimentoContrato(c), "2026-10-05");
  // a obra atrasou: o primeiro pagamento passa para dezembro
  const novo = modulo.recalibrarContrato(c, "2026-12-05");
  assert.strictEqual(novo.primeiroVencimento, "2026-12-05");
  const datas = modulo.contasDoContrato(novo).map(x => x.vencimento);
  assert.deepStrictEqual(datas.slice(0, 3), ["2026-12-05", "2027-01-05", "2027-02-05"]);
  assert.strictEqual(datas[11], "2027-11-05", "as doze andam junto");

  // prévia: mostra de → para só das parcelas em aberto
  const contas = modulo.contasDoContrato(c).map((x, i) => i === 0 ? { ...x, pago: true, pagoEm: "2026-10-05", valorPago: 10000 } : x);
  const previa = modulo.previaRecalibragem(c, "2026-12-05", contas, 3);
  assert.strictEqual(previa.pagas, 1);
  assert.strictEqual(previa.total, 12);
  assert.strictEqual(previa.linhas.length, 3);
  assert.deepStrictEqual([previa.linhas[0].de, previa.linhas[0].para], ["2026-11-05", "2027-01-05"]);
  assert.ok(!previa.linhas.some(l => l.id === contas[0].id), "a parcela paga não entra na prévia");

  // gravando: a paga fica intocada, as demais recebem as datas novas
  const arrumadas = modulo.sincronizarContasDaObra(contas, [novo]);
  const paga = arrumadas.find(x => x.id === contas[0].id);
  assert.ok(paga.pago && paga.vencimento === "2026-10-05", "a parcela paga não se move");
  assert.strictEqual(arrumadas.find(x => x.id === contas[1].id).vencimento, "2027-01-05");
});

teste("no pagamento item a item, a recalibragem é item a item", () => {
  const c = base({ id: "ct7", modelo: "empreitadaGlobal", modalidade: "entradaFinal", entradaEscopo: "item",
    entradaPct: 50, dataAssinatura: "2026-09-01", previsaoConclusao: "2026-12-20",
    itens: [{ descricao: "Portão", valor: 60000, inicio: "2026-10-01", previsao: "2026-11-30" },
            { descricao: "Vitrine", valor: 40000 }] });
  assert.ok(modulo.contratoPorItem(c), "contrato item a item se recalibra por item");
  assert.ok(!modulo.contratoPorItem(base({ modalidade: "parcelado", parcelas: 6 })), "parcelado não");
  assert.deepStrictEqual(modulo.datasDosItens(c),
    [{ inicio: "2026-10-01", previsao: "2026-11-30" }, { inicio: "", previsao: "" }]);

  // a obra atrasou: cada item ganha o seu novo começo e a sua nova conclusão
  const novo = modulo.recalibrarItens(c, [{ inicio: "2026-11-03", previsao: "2027-01-15" },
                                          { inicio: "2027-01-20", previsao: "2027-03-10" }]);
  const datas = modulo.contasDoContrato(novo).map(x => [x.descricao, x.vencimento, !!x.estimada]);
  assert.deepStrictEqual(datas, [
    ["Portão — entrada", "2026-11-03", true],
    ["Portão — conclusão", "2027-01-15", true],
    ["Vitrine — entrada", "2027-01-20", true],
    ["Vitrine — conclusão", "2027-03-10", true],
  ]);
  // os valores não se mexem: metade na entrada, metade na conclusão
  assert.deepStrictEqual(modulo.contasDoContrato(novo).map(x => x.valor), [30000, 30000, 20000, 20000]);

  // prévia entre as duas versões, ignorando o que já foi pago
  const contas = modulo.contasDoContrato(c).map((x, i) => i === 0 ? { ...x, pago: true, pagoEm: "2026-10-01", valorPago: 30000 } : x);
  const previa = modulo.previaEntreContratos(c, novo, contas, 6);
  assert.strictEqual(previa.pagas, 1);
  assert.strictEqual(previa.linhas.length, 3, "a entrada já paga fica fora");
  assert.deepStrictEqual([previa.linhas[0].de, previa.linhas[0].para], ["2026-11-30", "2027-01-15"]);
  // gravando: a entrada paga do Portão não se move
  const arrumadas = modulo.sincronizarContasDaObra(contas, [novo]);
  assert.strictEqual(arrumadas.find(x => x.id === contas[0].id).vencimento, "2026-10-01");
  assert.strictEqual(arrumadas.find(x => x.id === contas[1].id).vencimento, "2027-01-15");
});

teste("a linha da conta é curta; o parágrafo do item fica no detalhe", () => {
  const c = { origem: "contrato", numeroContrato: "0004", servico: "Serralheria",
    favorecido: "MB VIEZZER MONTAGENS INDUSTRIAIS", parcela: 2, totalParcelas: 10, contaId: "serralheiro",
    descricao: "Continuidade da cobertura do espaço novo — ampliação e fechamento de cobertura metálica, com telha metálica simples, estrutura, calhas e rufos. Não inclui a revisão da estrutura existente. — conclusão" };
  assert.strictEqual(modulo.tituloCurtoConta(c), "Contrato 0004 · Parcela 2/10");
  assert.strictEqual(modulo.apoioCurtoConta(c), "MB VIEZZER MONTAGENS INDUSTRIAIS · Serralheria");
  // as duas linhas visíveis são curtas; o texto longo só aparece aberto
  assert.ok(modulo.tituloCurtoConta(c).length < 40);
  assert.ok(modulo.apoioCurtoConta(c).length < 60);
  assert.ok(modulo.detalheConta(c).length > 100, "o detalhe guarda a descrição inteira");
  // conta avulsa: a descrição é o próprio título
  const av = { origem: "avulsa", descricao: "Caçamba de entulho", contaId: "frete" };
  assert.strictEqual(modulo.tituloCurtoConta(av), "Caçamba de entulho");
  assert.strictEqual(modulo.apoioCurtoConta(av), "");
  // parcela sem contrato numerado ainda se identifica
  assert.strictEqual(modulo.tituloCurtoConta({ parcela: 1, totalParcelas: 6, descricao: "Parcela 1/6 (mensal)" }), "Parcela 1/6");
  // descrição curta diz mais que "Parcela 1/2" e fica no lugar dela
  assert.strictEqual(modulo.tituloCurtoConta({ numeroContrato: "0008", parcela: 2, totalParcelas: 2, descricao: "Saldo na conclusão" }),
    "Contrato 0008 · Saldo na conclusão");
  assert.strictEqual(modulo.tituloCurtoConta({ numeroContrato: "0008", parcela: 1, totalParcelas: 2, descricao: "Entrada" }),
    "Contrato 0008 · Entrada");
  assert.strictEqual(modulo.tituloCurtoConta({ numeroContrato: "0009", parcela: 1, totalParcelas: 4, descricao: "Portão basculante — entrada" }),
    "Contrato 0009 · Portão basculante — entrada");
});

teste("mudou a conta do plano, o que já foi pago é reclassificado junto", () => {
  const c = base({ id: "ctg", tipoProfissional: "gestaoObra", valor: 24000, modalidade: "parcelado",
    parcelas: 12, periodicidade: "mensais", diaVencimento: 5, dataInicio: "2026-08-01" });
  const geradas = modulo.contasDoContrato(c);
  assert.strictEqual(geradas[0].contaId, "taxa_admin_obra");
  // como estavam antes: parcela paga classificada na conta antiga
  const antigas = geradas.map((x, i) => ({ ...x, contaId: "mo_diversos",
    ...(i === 0 ? { pago: true, pagoEm: "2026-08-05", valorPago: 2000, contabilizadoEm: "2026-08-06" } : {}) }));
  assert.ok(modulo.contasDesatualizadas(antigas, [c]), "a conta do plano entra na comparação");
  const arrumadas = modulo.sincronizarContasDaObra(antigas, [c]);
  const paga = arrumadas.find(x => x.id === geradas[0].id);
  assert.strictEqual(paga.contaId, "taxa_admin_obra", "a classificação acompanha o contrato");
  assert.ok(paga.pago && paga.valorPago === 2000 && paga.pagoEm === "2026-08-05", "o pagamento fica intacto");
  assert.strictEqual(paga.contabilizadoEm, "2026-08-06");
  // e o extrato do mês passa a mostrá-la em SERVIÇOS & TAXAS
  const ex = modulo.extratoMensal(arrumadas, [], "2026-08");
  assert.deepStrictEqual(ex.grupos.map(g => g.grupo.id), ["servicos"]);
  assert.strictEqual(ex.grupos[0].linhas[0].conta.nome, "Gerenciamento de obra");
  assert.strictEqual(ex.custos, 2000);
});

teste("extrato em matriz: mês a mês, total da obra e estimativa ao lado", () => {
  const contas = [
    { id: "a", contaId: "empreiteiro", valor: 10000, pago: true, pagoEm: "2026-01-20", valorPago: 7150 },
    { id: "b", contaId: "empreiteiro", valor: 6000, pago: true, pagoEm: "2026-02-10", valorPago: 5795 },
    { id: "c", contaId: "material", valor: 500, pago: true, pagoEm: "2026-01-15", valorPago: 480 },
    { id: "d", contaId: "material", valor: 300, pago: true, pagoEm: "2026-02-02", valorPago: 274.9 },
    { id: "e", contaId: "taxa_admin_obra", valor: 2000, pago: true, pagoEm: "2026-03-05", valorPago: 2000 },
    { id: "f", contaId: "frete", valor: 200, pago: false, vencimento: "2026-03-10" },
  ];
  const entradas = [{ id: "e1", contaId: "deposito_proprio", valor: 8390, data: "2026-01-05" },
                    { id: "e2", contaId: "deposito_proprio", valor: 6800, data: "2026-03-01" }];
  const est = modulo.estimativaPorConta([{ contaId: "empreiteiro", valor: 40000 }, { contaId: "empreiteiro", valor: 5000 },
                                         { contaId: "material", valor: 12000 }]);
  assert.deepStrictEqual(est, { empreiteiro: 45000, material: 12000 });

  const m = modulo.extratoMatriz(contas, entradas, ["2026-01", "2026-02", "2026-03"], est);
  assert.deepStrictEqual(m.grupos.map(g => g.grupo.id), ["receitas", "materiais", "maoDeObra", "servicos"]);
  const linha = (grupo, conta) => m.grupos.find(g => g.grupo.id === grupo).linhas.find(l => l.conta.id === conta);
  assert.deepStrictEqual(linha("maoDeObra", "empreiteiro").valores, [7150, 5795, 0]);
  assert.strictEqual(linha("maoDeObra", "empreiteiro").total, 12945);
  assert.strictEqual(linha("maoDeObra", "empreiteiro").estimado, 45000, "a estimativa entra ao lado do contabilizado");
  assert.deepStrictEqual(linha("materiais", "material").valores, [480, 274.9, 0]);
  // a conta não paga não entra
  assert.strictEqual(m.grupos.find(g => g.grupo.id === "materiais").linhas.some(l => l.conta.id === "frete"), false);
  // totais por coluna e saldo
  assert.deepStrictEqual(m.entradas.valores, [8390, 0, 6800]);
  assert.deepStrictEqual(m.custos.valores, [7630, 6069.9, 2000]);
  assert.deepStrictEqual(m.saldo.valores, [760, -6069.9, 4800]);
  assert.strictEqual(m.custos.total, 15699.9);
  assert.strictEqual(m.saldo.total, -509.9);
  assert.strictEqual(m.custos.estimado, 57000, "estimativa dos três grupos de custo");

  // sem meses pedidos, sobra o total da obra — é como a tela abre
  const soTotal = modulo.extratoMatriz(contas, entradas, [], est);
  assert.deepStrictEqual(soTotal.meses, []);
  assert.strictEqual(soTotal.saldo.total, -509.9);
  assert.strictEqual(soTotal.grupos.find(g => g.grupo.id === "maoDeObra").total, 12945);
  // conta só estimada aparece, com contabilizado zero
  const so = modulo.extratoMatriz([], [], [], { pintor: 3000 });
  assert.strictEqual(so.grupos[0].linhas[0].conta.id, "pintor");
  assert.strictEqual(so.grupos[0].linhas[0].total, 0);
  assert.strictEqual(so.grupos[0].linhas[0].estimado, 3000);
});

teste("empreiteiro: sextas alternadas, e feriado antecipa para a quinta", () => {
  const c = base({ valor: 80000, modalidade: "parcelado", parcelas: 6, periodicidade: "quinzenais",
    tipoProfissional: "empreiteiro", dataInicio: "2026-03-06" });
  const datas = modulo.parcelasAPagar(c).map(x => x.vencimento);
  // 06/03/2026 é sexta: a primeira parcela cai na segunda sexta seguinte
  assert.strictEqual(datas[0], "2026-03-20");
  // 03/04/2026 é sexta-feira santa → paga-se na quinta, 02/04
  assert.strictEqual(datas[1], "2026-04-02");
  // a cadência não se perde: a seguinte volta para a sexta
  assert.strictEqual(datas[2], "2026-04-17");
  // 01/05/2026 (sexta, Dia do Trabalho) → 30/04
  assert.strictEqual(datas[3], "2026-04-30");
  assert.deepStrictEqual(datas.slice(4), ["2026-05-15", "2026-05-29"]);
  // desligando o ajuste, os feriados ficam
  const semAjuste = modulo.parcelasAPagar({ ...c, ajusteFeriado: "nenhum" }).map(x => x.vencimento);
  assert.deepStrictEqual(semAjuste.slice(0, 4), ["2026-03-20", "2026-04-03", "2026-04-17", "2026-05-01"]);
  // semanal também é sexta: 01/05 vira 30/04
  const sem = modulo.parcelasAPagar({ ...c, periodicidade: "semanais", parcelas: 3, dataInicio: "2026-04-20" });
  assert.deepStrictEqual(sem.map(x => x.vencimento), ["2026-04-24", "2026-04-30", "2026-05-08"]);
  // Natal de 2026 cai na sexta; e 01/01/2027 também → 31/12
  const natal = modulo.parcelasAPagar({ ...c, parcelas: 3, dataInicio: "2026-11-25" });
  assert.deepStrictEqual(natal.map(x => x.vencimento), ["2026-12-04", "2026-12-18", "2026-12-31"]);
  // outro dia da semana: quem paga na segunda escolhe segunda
  const naSegunda = modulo.parcelasAPagar({ ...c, diaSemana: 1, parcelas: 4, dataInicio: "2026-03-06" });
  assert.deepStrictEqual(naSegunda.map(x => x.vencimento), ["2026-03-16", "2026-03-30", "2026-04-13", "2026-04-27"]);
  assert.strictEqual(new Date(naSegunda[0].vencimento + "T12:00:00").getDay(), 1, "segunda-feira");
  // e o feriado antecipa igual: 20/11/2026 é sexta (Consciência Negra)
  const naSexta = modulo.parcelasAPagar({ ...c, parcelas: 2, dataInicio: "2026-10-23" });
  assert.deepStrictEqual(naSexta.map(x => x.vencimento), ["2026-11-06", "2026-11-19"]);
  // mensal não é afetado pela regra de dia da semana
  const mensal = modulo.parcelasAPagar({ ...c, periodicidade: "mensais", parcelas: 3, diaVencimento: 25, dataInicio: "2026-11-01" });
  assert.deepStrictEqual(mensal.map(x => x.vencimento), ["2026-11-25", "2026-12-25", "2027-01-25"]);
});

teste("quinzenal de 15 dias corridos: data fixa, sem dia da semana nem feriado", () => {
  const c = base({ valor: 60000, modalidade: "parcelado", parcelas: 6, periodicidade: "quinzeDias",
    dataInicio: "2026-03-06" });
  const datas = modulo.parcelasAPagar(c).map(x => x.vencimento);
  // 15 dias da âncora e daí de 15 em 15, caindo em qualquer dia da semana
  assert.deepStrictEqual(datas, ["2026-03-21", "2026-04-05", "2026-04-20", "2026-05-05", "2026-05-20", "2026-06-04"]);
  assert.strictEqual(new Date(datas[0] + "T12:00:00").getDay(), 6, "sábado — a data manda, não o dia da semana");
  // não antecipa em feriado: 01/05/2026 é sexta e feriado, e fica
  const noFeriado = modulo.parcelasAPagar({ ...c, parcelas: 2, dataInicio: "2026-04-16" }).map(x => x.vencimento);
  assert.deepStrictEqual(noFeriado, ["2026-05-01", "2026-05-16"]);
  // com o primeiro vencimento informado, conta dali
  const informado = modulo.parcelasAPagar({ ...c, parcelas: 3, primeiroVencimento: "2026-07-10" }).map(x => x.vencimento);
  assert.deepStrictEqual(informado, ["2026-07-10", "2026-07-25", "2026-08-09"]);
  // a descrição diz a cadência
  assert.ok(modulo.parcelasAPagar(c)[0].descricao.includes("a cada 15 dias"));
  // a quinzena de sextas continua como antes
  const sextas = modulo.parcelasAPagar({ ...c, periodicidade: "quinzenais" }).map(x => x.vencimento);
  assert.strictEqual(sextas[0], "2026-03-20");
});

// ── Quadro de estimativa por conta do P&L ───────────────────────
const linhas = (itens) => modulo.linhasEstimativaPL(itens, modulo.GRUPOS_PL, modulo.PLANO_CONTAS);
const daConta = (itens, id) => linhas(itens).find(l => l.contaId === id);

teste("o quadro tem uma linha para cada conta do plano, na ordem do plano", () => {
  const ls = linhas([]);
  assert.strictEqual(ls.length, modulo.PLANO_CONTAS.length, "toda conta precisa de um campo");
  assert.deepStrictEqual(ls.map(l => l.contaId).slice(0, 3), modulo.PLANO_CONTAS.slice(0, 3).map(c => c.id));
  // conta sem estimativa vem vazia, não zerada
  assert.strictEqual(daConta([], "material").valorQuadro, null);
  assert.strictEqual(daConta([], "material").total, 0);
  assert.strictEqual(daConta([], "material").editavel, true);
});

teste("digitar um valor cria o item de quadro; digitar de novo troca o mesmo", () => {
  const um = modulo.definirEstimativaDaConta([], "material", 120000, "e1");
  assert.strictEqual(um.length, 1);
  assert.strictEqual(um[0].origem, "quadro");
  assert.strictEqual(um[0].valor, 120000);
  assert.strictEqual(daConta(um, "material").valorQuadro, 120000);
  const dois = modulo.definirEstimativaDaConta(um, "material", 135500.5, "e2");
  assert.strictEqual(dois.length, 1, "não pode duplicar a linha da mesma conta");
  assert.strictEqual(dois[0].id, "e1", "o item é o mesmo, só o valor muda");
  assert.strictEqual(dois[0].valor, 135500.5);
});

teste("apagar o campo tira a conta da estimativa, não a estima em zero", () => {
  const com = modulo.definirEstimativaDaConta([], "frete", 3000, "e1");
  for (const vazio of ["", null, 0, "0"]) {
    const sem = modulo.definirEstimativaDaConta(com, "frete", vazio, "e2");
    assert.deepStrictEqual(sem, [], `"${vazio}" tinha que apagar o item`);
    assert.strictEqual(daConta(sem, "frete").valorQuadro, null);
  }
});

teste("conta com item detalhado não é editável pelo quadro", () => {
  const detalhado = [{ id: "d1", contaId: "empreiteiro", valor: 200000, observacao: "Contrato Zé" }];
  const l = daConta(detalhado, "empreiteiro");
  assert.strictEqual(l.editavel, false, "mexer no quadro esconderia de onde o valor veio");
  assert.strictEqual(l.detalhados, 1);
  assert.strictEqual(l.total, 200000);
  assert.strictEqual(l.valorQuadro, null);
});

teste("quadro e detalhe convivem na mesma conta e somam", () => {
  const misto = modulo.definirEstimativaDaConta(
    [{ id: "d1", contaId: "material", valor: 50000 }], "material", 20000, "e1");
  const l = daConta(misto, "material");
  assert.strictEqual(l.total, 70000);
  assert.strictEqual(l.valorQuadro, 20000);
  assert.strictEqual(l.detalhados, 1);
  // e o total por conta continua batendo com quem já lia a estimativa
  assert.strictEqual(modulo.estimativaPorConta(misto).material, 70000);
});

teste("o resultado estimado é entradas menos custos, sem as excluídas", () => {
  let itens = [];
  itens = modulo.definirEstimativaDaConta(itens, "deposito_proprio", 900000, "e1");
  itens = modulo.definirEstimativaDaConta(itens, "material", 400000, "e2");
  itens = modulo.definirEstimativaDaConta(itens, "empreiteiro", 250000, "e3");
  itens = modulo.definirEstimativaDaConta(itens, "impostos", 50000, "e4");
  itens = modulo.definirEstimativaDaConta(itens, "reembolsos", 30000, "e5");
  const t = modulo.totaisEstimativaPL(itens, modulo.GRUPOS_PL, modulo.PLANO_CONTAS);
  assert.strictEqual(t.porGrupo.receitas, 900000);
  assert.strictEqual(t.porGrupo.materiais, 400000);
  assert.strictEqual(t.porGrupo.maoDeObra, 250000);
  assert.strictEqual(t.porGrupo.servicos, 50000);
  assert.strictEqual(t.porGrupo.excluidas, 30000, "aparece no quadro");
  assert.strictEqual(t.resultado, 200000, "mas fica fora do resultado");
});

// ── Carga única da estimativa (Reforma Loja Cobop) ──────────────
const CARGA = modulo.CARGA_ESTIMATIVA_UNICA;
const ids = () => { let n = 0; return () => "s" + (++n); };
const obraCobop = (extra) => ({ id: "o1", nome: "Reforma Loja Cobop", ...extra });

teste("toda conta da carga existe no plano", () => {
  for (const id of Object.keys(CARGA.valores)) {
    assert.ok(modulo.PLANO_CONTAS.some(c => c.id === id), `conta "${id}" não existe no plano`);
  }
});

teste("a carga soma exatamente o total da planilha", () => {
  const v = CARGA.valores;
  const soma = Object.keys(v).reduce((a, k) => a + v[k], 0);
  assert.strictEqual(Math.round(soma * 100) / 100, CARGA.total);
  assert.strictEqual(CARGA.total, 1030000);
});

teste("preenche a obra nomeada e fecha no total", () => {
  const o = modulo.estimativaCargaUnica(obraCobop(), CARGA, ids());
  assert.ok(o, "a obra alvo tinha que ser preenchida");
  assert.strictEqual(o.estimativaPL.length, Object.keys(CARGA.valores).length);
  assert.ok(o.estimativaPL.every(i => i.origem === "quadro"), "entra como item de quadro, editável no Preencher");
  assert.ok(o.estimativaCarregadaEm, "sem a marca, carregaria de novo a cada render");
  const t = modulo.totaisEstimativaPL(o.estimativaPL, modulo.GRUPOS_PL, modulo.PLANO_CONTAS);
  assert.strictEqual(t.porGrupo.materiais, 367529.57);
  assert.strictEqual(t.porGrupo.maoDeObra, 528470.43);
  assert.strictEqual(t.porGrupo.servicos, 134000);
  const est = modulo.estimativaPorConta(o.estimativaPL);
  const soma = Object.keys(est).reduce((a, k) => a + est[k], 0);
  assert.strictEqual(Math.round(soma * 100) / 100, 1030000);
});

teste("o nome casa sem depender de acento nem de caixa", () => {
  for (const nome of ["Reforma Loja Cobop", "reforma loja cobop", "REFORMA LOJA COBOP", " Reforma Loja Cóbop "]) {
    assert.ok(modulo.estimativaCargaUnica(obraCobop({ nome }), CARGA, ids()), `"${nome}" tinha que casar`);
  }
});

teste("nenhuma outra obra é tocada", () => {
  for (const nome of ["Loja COBOP", "Reforma Loja Cobop 2", "Casa do Renato", "", null]) {
    assert.strictEqual(modulo.estimativaCargaUnica(obraCobop({ nome }), CARGA, ids()), null, `"${nome}" não podia casar`);
  }
});

teste("carrega uma vez só, e nunca por cima do que já foi digitado", () => {
  const marcada = obraCobop({ estimativaCarregadaEm: "2026-09-09T12:00:00.000Z" });
  assert.strictEqual(modulo.estimativaCargaUnica(marcada, CARGA, ids()), null, "a marca segura a segunda carga");
  // e mesmo sem a marca, estimativa existente manda
  const comDado = obraCobop({ estimativaPL: [{ id: "d1", contaId: "material", valor: 1 }] });
  assert.strictEqual(modulo.estimativaCargaUnica(comDado, CARGA, ids()), null, "não pode passar por cima de número digitado");
  // rodar de novo no resultado também não repete
  const uma = modulo.estimativaCargaUnica(obraCobop(), CARGA, ids());
  assert.strictEqual(modulo.estimativaCargaUnica(uma, CARGA, ids()), null);
});

// ── O cliente paga os fornecedores direto ───────────────────────
const plComCustos = () => {
  let itens = [];
  itens = modulo.definirEstimativaDaConta(itens, "material", 400000, "e1");
  itens = modulo.definirEstimativaDaConta(itens, "empreiteiro", 250000, "e2");
  itens = modulo.definirEstimativaDaConta(itens, "impostos", 50000, "e3");
  itens = modulo.definirEstimativaDaConta(itens, "reembolsos", 30000, "e4");
  return itens;
};

teste("sem o tique, o fecho da estimativa continua o resultado", () => {
  const f = modulo.fechoEstimativaPL(plComCustos(), modulo.GRUPOS_PL, modulo.PLANO_CONTAS, false);
  assert.strictEqual(f.rotulo, "Resultado estimado da obra");
  assert.strictEqual(f.valor, -700000, "sem entrada, o resultado é o custo no negativo");
});

teste("com o tique, o fecho vira o custo e nunca é negativo", () => {
  const f = modulo.fechoEstimativaPL(plComCustos(), modulo.GRUPOS_PL, modulo.PLANO_CONTAS, true);
  assert.strictEqual(f.rotulo, "Custo estimado da obra");
  assert.strictEqual(f.valor, 700000, "o mesmo número, positivo");
  assert.ok(f.valor >= 0);
  // "Excluídas" fica de fora dos dois jeitos
  assert.strictEqual(f.porGrupo.excluidas, 30000);
  assert.ok(!String(f.valor).includes("730000"));
});

teste("com entrada estimada, o tique ainda mostra só o custo", () => {
  const comEntrada = modulo.definirEstimativaDaConta(plComCustos(), "deposito_proprio", 900000, "e5");
  const sem = modulo.fechoEstimativaPL(comEntrada, modulo.GRUPOS_PL, modulo.PLANO_CONTAS, false);
  const com = modulo.fechoEstimativaPL(comEntrada, modulo.GRUPOS_PL, modulo.PLANO_CONTAS, true);
  assert.strictEqual(sem.valor, 200000);
  assert.strictEqual(com.valor, 700000, "o custo não muda por existir entrada lançada");
});

teste("a última linha do extrato troca de fecho com o tique", () => {
  const contas = [
    { id: "c1", obraId: "o1", contaId: "material", valor: 1000, pago: true, valorPago: 1000, pagoEm: "2026-03-10" },
    { id: "c2", obraId: "o1", contaId: "empreiteiro", valor: 500, pago: true, valorPago: 500, pagoEm: "2026-03-20" },
  ];
  const est = modulo.estimativaPorConta(plComCustos());
  const ex = modulo.extratoMatriz(contas, [], ["2026-03"], est);

  const saldo = modulo.linhaFinalExtrato(ex, false);
  assert.strictEqual(saldo.rotulo, "SALDO FINAL");
  assert.strictEqual(saldo.total, -1500, "sem entrada, o saldo é o custo no negativo");
  assert.strictEqual(saldo.negativo, true);

  const custo = modulo.linhaFinalExtrato(ex, true);
  assert.strictEqual(custo.rotulo, "CUSTO TOTAL");
  assert.strictEqual(custo.total, 1500, "o mesmo número, positivo");
  assert.strictEqual(custo.negativo, false);
  assert.deepStrictEqual(custo.valores, ex.custos.valores);
});

teste("a coluna Estimado passa a fechar nas duas linhas", () => {
  const contas = [{ id: "c1", obraId: "o1", contaId: "material", valor: 1000, pago: true, valorPago: 1000, pagoEm: "2026-03-10" }];
  const comEntrada = modulo.definirEstimativaDaConta(plComCustos(), "deposito_proprio", 900000, "e5");
  const ex = modulo.extratoMatriz(contas, [], ["2026-03"], modulo.estimativaPorConta(comEntrada));
  // custo estimado = 400.000 + 250.000 + 50.000
  assert.strictEqual(modulo.linhaFinalExtrato(ex, true).estimado, 700000);
  // saldo estimado = 900.000 − 700.000
  assert.strictEqual(modulo.linhaFinalExtrato(ex, false).estimado, 200000);
});

// ── O P&L da obra, conta a conta ────────────────────────────────
const pl = (itens, contas) => modulo.plDaObra(itens, contas, modulo.GRUPOS_PL, modulo.PLANO_CONTAS);
const pagas = [
  { id: "c1", obraId: "o1", contaId: "material",    valor: 300000, pago: true, valorPago: 300000, pagoEm: "2026-03-10" },
  { id: "c2", obraId: "o1", contaId: "empreiteiro", valor: 200000, pago: true, valorPago: 200000, pagoEm: "2026-04-15" },
  { id: "c3", obraId: "o1", contaId: "material",    valor:  50000, pago: false, vencimento: "2026-05-01" },
];

teste("o P&L junta estimado e realizado na estrutura do plano", () => {
  const r = pl(plComCustos(), pagas);
  const linha = (id) => r.blocos.flatMap(b => b.linhas).find(l => l.conta.id === id);
  assert.strictEqual(linha("material").estimado, 400000);
  assert.strictEqual(linha("material").realizado, 300000, "conta NÃO paga não entra no realizado");
  assert.strictEqual(linha("material").saldo, 100000);
  assert.strictEqual(linha("empreiteiro").realizado, 200000);
  assert.strictEqual(linha("impostos").realizado, 0, "estimado sem realizado aparece com zero");
  // os grupos vêm na ordem do plano
  assert.deepStrictEqual(r.blocos.map(b => b.grupo.id), ["materiais", "maoDeObra", "servicos", "excluidas"]);
});

teste("conta sem nenhum dos dois lados não ocupa linha", () => {
  const r = pl([], pagas);
  const ids = r.blocos.flatMap(b => b.linhas).map(l => l.conta.id);
  assert.deepStrictEqual(ids.sort(), ["empreiteiro", "material"], "só o que tem realizado");
  assert.ok(ids.length < modulo.PLANO_CONTAS.length);
  assert.strictEqual(pl([], []).vazio, true);
});

teste("o custo soma só os grupos de custo; excluídas fica de fora", () => {
  const r = pl(plComCustos(), pagas);
  assert.strictEqual(r.custo.estimado, 700000, "400 + 250 + 50, sem os 30 de reembolsos");
  assert.strictEqual(r.custo.realizado, 500000);
  const exc = r.blocos.find(b => b.grupo.id === "excluidas");
  assert.strictEqual(exc.estimado, 30000, "aparece no quadro");
});

teste("entradas e resultado saem dos dois lados", () => {
  const comEntrada = modulo.definirEstimativaDaConta(plComCustos(), "deposito_proprio", 900000, "e5");
  const r = pl(comEntrada, pagas);
  assert.strictEqual(r.entradas.estimado, 900000);
  assert.strictEqual(r.entradas.realizado, 0, "entrada não vem de conta a pagar");
  assert.strictEqual(r.resultado.estimado, 200000);
  assert.strictEqual(r.resultado.realizado, -500000);
});

console.log("\n--- anel de progresso do custo ---");
teste("o anel é o realizado sobre o estimado", () => {
  const p = modulo.progressoCusto({ estimado: 1000000, realizado: 500000 });
  assert.strictEqual(p.medivel, true);
  assert.strictEqual(p.pct, 50);
  assert.strictEqual(p.arco, 50);
  assert.strictEqual(p.acima, false);
  assert.strictEqual(p.resta, 500000);
});

teste("gasto acima do estimado avisa, e o anel não dá mais que a volta", () => {
  const p = modulo.progressoCusto({ estimado: 100000, realizado: 130000 });
  assert.strictEqual(p.pct, 130, "o número diz a verdade");
  assert.strictEqual(p.arco, 100, "o desenho não pode passar de uma volta");
  assert.strictEqual(p.acima, true);
  assert.strictEqual(p.resta, -30000);
});

teste("sem estimativa não há contra o que medir", () => {
  for (const c of [{ estimado: 0, realizado: 5000 }, { estimado: 0, realizado: 0 }, null]) {
    assert.strictEqual(modulo.progressoCusto(c).medivel, false, JSON.stringify(c));
  }
  // e nada de dividir por zero
  assert.strictEqual(modulo.progressoCusto({ estimado: 0, realizado: 9 }).pct, 0);
});

console.log("\n--- prestadores, um anel por ofício ---");
const prest = (itens, contas) => modulo.prestadoresDoPL(itens, contas, modulo.GRUPOS_PL, modulo.PLANO_CONTAS);
const estOficios = () => {
  let i = [];
  const por = { empreiteiro: 174800, eletricista: 34960, pintor: 43700, gesseiro: 85440,
                serralheiro: 117362, lixador_concreto: 3277.5, taxa_admin_obra: 134000 };
  let n = 0;
  for (const k of Object.keys(por)) i = modulo.definirEstimativaDaConta(i, k, por[k], "p" + (++n));
  return i;
};

teste("traz a mão de obra inteira mais o gerenciamento", () => {
  const r = prest(estOficios(), []);
  const ids = r.linhas.map(l => l.conta.id);
  assert.ok(ids.includes("taxa_admin_obra"), "gerenciamento é prestador, mesmo morando em Serviços");
  assert.ok(ids.includes("empreiteiro") && ids.includes("gesseiro") && ids.includes("serralheiro"));
  assert.strictEqual(r.total.estimado, 593539.5);
});

teste("do maior orçamento para o menor", () => {
  const r = prest(estOficios(), []);
  assert.deepStrictEqual(r.linhas.map(l => l.conta.id),
    ["empreiteiro", "taxa_admin_obra", "serralheiro", "gesseiro", "pintor", "eletricista", "lixador_concreto"]);
});

teste("material e imposto não são prestador", () => {
  const comMaterial = modulo.definirEstimativaDaConta(estOficios(), "material", 999999, "x1");
  const r = prest(modulo.definirEstimativaDaConta(comMaterial, "impostos", 50000, "x2"), []);
  const ids = r.linhas.map(l => l.conta.id);
  assert.ok(!ids.includes("material"), "material é insumo, não gente");
  assert.ok(!ids.includes("impostos"), "imposto é custo do escritório");
});

teste("cada ofício traz o seu anel", () => {
  const pagas = [
    { id: "c1", obraId: "o1", contaId: "empreiteiro", valor: 87400, pago: true, valorPago: 87400, pagoEm: "2026-03-10" },
    { id: "c2", obraId: "o1", contaId: "gesseiro", valor: 100000, pago: true, valorPago: 100000, pagoEm: "2026-04-10" },
    { id: "c3", obraId: "o1", contaId: "pintor", valor: 10000, pago: false, vencimento: "2026-05-10" },
  ];
  const r = prest(estOficios(), pagas);
  const de = (id) => r.linhas.find(l => l.conta.id === id);
  assert.strictEqual(de("empreiteiro").progresso.pct, 50);
  assert.strictEqual(de("empreiteiro").progresso.acima, false);
  assert.strictEqual(de("gesseiro").progresso.pct, 117, "gesseiro estourou");
  assert.strictEqual(de("gesseiro").progresso.acima, true);
  assert.strictEqual(de("gesseiro").progresso.arco, 100, "o anel não dá mais que a volta");
  assert.strictEqual(de("pintor").progresso.pct, 0, "conta em aberto não é realizado");
  assert.strictEqual(de("serralheiro").realizado, 0);
  assert.strictEqual(r.total.realizado, 187400);
});

teste("ofício que só tem pagamento aparece; sem nenhum lado, não", () => {
  const soPago = [{ id: "c1", obraId: "o1", contaId: "encanador", valor: 5000, pago: true, valorPago: 5000, pagoEm: "2026-03-01" }];
  const r = prest([], soPago);
  assert.deepStrictEqual(r.linhas.map(l => l.conta.id), ["encanador"]);
  assert.strictEqual(r.linhas[0].progresso.medivel, false, "sem estimativa não há anel");
  assert.strictEqual(prest([], []).vazio, true);
});

console.log("\n--- anéis por fornecedor e por contrato ---");
const contasDeDois = [
  // Zé Empreiteiro: 3 parcelas de 100, uma paga
  { id: "z1", obraId: "o1", contratoId: "ctr1", prestadorId: "f1", favorecido: "Zé Empreiteiro", valor: 100, pago: true, valorPago: 100, pagoEm: "2026-03-10", vencimento: "2026-03-10" },
  { id: "z2", obraId: "o1", contratoId: "ctr1", prestadorId: "f1", favorecido: "Zé Empreiteiro", valor: 100, pago: false, vencimento: "2026-04-10" },
  { id: "z3", obraId: "o1", contratoId: "ctr1", prestadorId: "f1", favorecido: "Zé Empreiteiro", valor: 100, pago: false, vencimento: "2026-01-10" }, // vencida
  // Serralheria: 1 conta paga inteira
  { id: "s1", obraId: "o1", contratoId: "ctr2", prestadorId: "f2", favorecido: "Serralheria", valor: 500, pago: true, valorPago: 500, pagoEm: "2026-02-01", vencimento: "2026-02-01" },
];
const gruposPor = (visao) => modulo.agruparContas(contasDeDois, visao, { hoje: "2026-03-15",
  nomePrestador: (id) => ({ f1: "Zé Empreiteiro", f2: "Serralheria" })[id],
  nomeContrato: (id) => ({ ctr1: "Empreitada da casa", ctr2: "Esquadrias" })[id] });

teste("só fornecedor e contrato viram anel; mês e ano seguem em barra", () => {
  assert.strictEqual(modulo.visaoUsaAnel("fornecedor"), true);
  assert.strictEqual(modulo.visaoUsaAnel("contrato"), true);
  assert.strictEqual(modulo.visaoUsaAnel("mes"), false, "série temporal é barra");
  assert.strictEqual(modulo.visaoUsaAnel("ano"), false);
  assert.strictEqual(modulo.visaoUsaAnel(undefined), false);
});

teste("por fornecedor, o anel é o pago sobre o devido", () => {
  const r = modulo.aneisDosGrupos(gruposPor("fornecedor"));
  const ze = r.linhas.find(l => /Zé/.test(l.titulo));
  assert.strictEqual(ze.total, 300);
  assert.strictEqual(ze.pago, 100);
  assert.strictEqual(ze.progresso.pct, 33);
  assert.strictEqual(ze.vencido, 100, "a parcela de janeiro está em atraso");
  const ser = r.linhas.find(l => /Serralheria/.test(l.titulo));
  assert.strictEqual(ser.progresso.pct, 100, "pago por inteiro fecha o anel");
  assert.strictEqual(ser.vencido, 0);
  assert.strictEqual(r.total.total, 800);
  assert.strictEqual(r.total.pago, 600);
});

teste("por contrato, o anel é o quanto do contrato já foi pago", () => {
  const r = modulo.aneisDosGrupos(gruposPor("contrato"));
  // agruparContas já ordena do maior total para o menor nas visões por nome
  assert.deepStrictEqual(r.linhas.map(l => l.titulo), ["Esquadrias", "Empreitada da casa"]);
  const de = (t) => r.linhas.find(l => l.titulo === t);
  assert.strictEqual(de("Empreitada da casa").progresso.pct, 33);
  assert.strictEqual(de("Esquadrias").progresso.pct, 100);
});

teste("grupo sem valor nenhum não ocupa cartão", () => {
  const r = modulo.aneisDosGrupos([{ chave: "x", titulo: "Vazio", totais: { total: 0, pago: 0, aberto: 0, vencido: 0 } }]);
  assert.strictEqual(r.vazio, true);
  assert.strictEqual(modulo.aneisDosGrupos([]).vazio, true);
  assert.strictEqual(modulo.aneisDosGrupos(null).vazio, true);
});

console.log("\n--- parcelas órfãs de contrato removido ---");
const ctr = { id: "ctr1", obraId: "o1", tipoProfissional: "empreitadaMaoDeObra", nomeContratado: "Zé",
              valor: 120000, parcelas: 2, primeiroVencimento: "2026-03-10", periodicidade: "mensais" };
const parcelas = () => modulo.contasDoContrato(ctr);

teste("remover o contrato leva as parcelas em aberto junto", () => {
  const antes = parcelas();
  assert.strictEqual(antes.length, 2);
  const depois = modulo.removerContasDoContrato(antes, "ctr1");
  assert.deepStrictEqual(depois, [], "nenhuma parcela em aberto pode sobrar");
});

teste("parcela paga fica, mesmo com o contrato removido", () => {
  const comPaga = parcelas().map((p, i) => (i === 0 ? { ...p, pago: true, valorPago: p.valor, pagoEm: "2026-03-10" } : p));
  const depois = modulo.removerContasDoContrato(comPaga, "ctr1");
  assert.strictEqual(depois.length, 1);
  assert.strictEqual(depois[0].pago, true, "o dinheiro saiu — esconder falsificaria o realizado");
});

teste("a faxina tira a órfã que sobrou de uma remoção antiga", () => {
  const orfas = parcelas();                        // contrato "ctr1" não existe mais
  const avulsa = { id: "a1", obraId: "o1", descricao: "Areia", valor: 500, pago: false };
  const r = modulo.removerOrfasDeContrato(orfas.concat([avulsa]), []);
  assert.deepStrictEqual(r.map(c => c.id), ["a1"], "só a avulsa fica");
});

teste("a faxina não encosta em parcela de contrato que existe", () => {
  const r = modulo.removerOrfasDeContrato(parcelas(), [ctr]);
  assert.strictEqual(r.length, 2);
  // e reconhece o contrato pela coleção antiga também
  const r2 = modulo.removerOrfasDeContrato(parcelas(), [{ id: "ctr1", clienteId: "c1" }]);
  assert.strictEqual(r2.length, 2, "lista completa inclui os contratos legados");
});

teste("órfã paga sobrevive à faxina", () => {
  const comPaga = parcelas().map((p, i) => (i === 0 ? { ...p, pago: true, valorPago: p.valor, pagoEm: "2026-03-10" } : p));
  const r = modulo.removerOrfasDeContrato(comPaga, []);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].pago, true);
});

teste("a faxina muda a assinatura, então a tela grava sozinha", () => {
  const antes = parcelas();
  const depois = modulo.removerOrfasDeContrato(antes, []);
  assert.notStrictEqual(modulo.assinaturaContas(depois), modulo.assinaturaContas(antes),
    "sem mudar a assinatura o efeito não gravaria e a órfã voltaria a aparecer");
});

console.log("\n--- folha de comprovantes ---");
const comp = (n) => ({ url: `http://x/${n}`, public_id: n, nome: `${n}.png`, bytes: 1000, formato: "png", resourceType: "image" });
const compPdf = { url: "http://x/p", public_id: "p", nome: "recibo.pdf", bytes: 2000, formato: "pdf", resourceType: "raw" };
const doFornecedor = [
  { id: "a", obraId: "o1", favorecido: "Padovan", descricao: "Parcela 2", valor: 9583.33, pago: true, valorPago: 9583.33, pagoEm: "2026-04-07", comprovante: comp("c2") },
  { id: "b", obraId: "o1", favorecido: "Padovan", descricao: "Parcela 1", valor: 9583.33, pago: true, valorPago: 9583.33, pagoEm: "2026-03-07", comprovante: comp("c1") },
  { id: "c", obraId: "o1", favorecido: "Padovan", descricao: "Parcela 3", valor: 9583.33, pago: true, valorPago: 9000, pagoEm: "2026-05-07", comprovante: compPdf },
  { id: "d", obraId: "o1", favorecido: "Padovan", descricao: "Parcela 4", valor: 9583.33, pago: true, valorPago: 9583.33, pagoEm: "2026-06-07" },
  { id: "e", obraId: "o1", favorecido: "Padovan", descricao: "Parcela 5", valor: 9583.33, pago: false, vencimento: "2026-07-07", comprovante: comp("x") },
];

teste("a folha junta só o que foi pago, em ordem de pagamento", () => {
  const f = modulo.folhaDeComprovantes(doFornecedor, "Padovan Arquitetos");
  assert.strictEqual(f.titulo, "Padovan Arquitetos");
  assert.deepStrictEqual(f.linhas.map(l => l.id), ["b", "a", "c", "d"], "conta em aberto não entra, e a ordem é a das datas");
  assert.strictEqual(f.periodo.de, "2026-03-07");
  assert.strictEqual(f.periodo.ate, "2026-06-07");
});

teste("o total é o que saiu, não o que estava previsto", () => {
  const f = modulo.folhaDeComprovantes(doFornecedor, "Padovan");
  assert.strictEqual(f.total, 37749.99, "9583,33 × 3 + os 9.000 efetivamente pagos na parcela 3");
});

teste("a folha separa foto, PDF e o que não tem comprovante", () => {
  const f = modulo.folhaDeComprovantes(doFornecedor, "Padovan");
  assert.strictEqual(f.comImagem, 2);
  assert.strictEqual(f.emPdf, 1, "PDF não desenha junto das fotos — vai listado");
  assert.strictEqual(f.semComprovante, 1);
  const pdf = f.linhas.find(l => l.id === "c");
  assert.strictEqual(pdf.ehPdf, true);
  assert.strictEqual(pdf.temImagem, false);
  const sem = f.linhas.find(l => l.id === "d");
  assert.strictEqual(sem.comprovante, null, "aparece como pendência, não some");
});

teste("fornecedor sem pagamento não gera folha", () => {
  const f = modulo.folhaDeComprovantes([{ id: "x", pago: false, valor: 100 }], "Ninguém");
  assert.strictEqual(f.vazio, true);
  assert.strictEqual(modulo.folhaDeComprovantes([], "x").vazio, true);
  assert.strictEqual(modulo.folhaDeComprovantes(null, "x").total, 0);
});


// ── recalibrar um pedido ────────────────────────────────────────
const pedidoContas = () => ([
  { id: "a", cotacaoId: "ct1", numeroPedido: "0004", favorecido: "Ferro Pronto", descricao: "1ª entrega", vencimento: "2026-10-02", pago: false },
  { id: "b", cotacaoId: "ct1", numeroPedido: "0004", favorecido: "Ferro Pronto", descricao: "2ª entrega", vencimento: "2026-11-10", pago: false },
  { id: "c", cotacaoId: "ct1", numeroPedido: "0004", favorecido: "Ferro Pronto", descricao: "3ª entrega", vencimento: "2026-12-05", pago: false },
  { id: "z", cotacaoId: "ct2", vencimento: "2026-10-20", pago: false },
]);

teste("o pedido escorrega inteiro, mantendo o intervalo entre as entregas", () => {
  const r = modulo.recalibrarPedido(pedidoContas(), "ct1", "2026-10-12");
  const doPedido = r.filter(c => c.cotacaoId === "ct1");
  assert.deepStrictEqual(doPedido.map(c => c.vencimento), ["2026-10-12", "2026-11-20", "2026-12-15"]);
  assert.strictEqual(r.find(c => c.id === "z").vencimento, "2026-10-20", "conta de outra cotação não se mexe");
});

teste("conta paga não anda, e a régua passa a ser a primeira em aberto", () => {
  const contas = pedidoContas();
  contas[0].pago = true;
  const r = modulo.recalibrarPedido(contas, "ct1", "2026-11-20");
  const doPedido = r.filter(c => c.cotacaoId === "ct1");
  assert.strictEqual(doPedido[0].vencimento, "2026-10-02", "a paga fica onde estava");
  assert.deepStrictEqual(doPedido.slice(1).map(c => c.vencimento), ["2026-11-20", "2026-12-15"]);
});

teste("sem data nova, ou sem nada em aberto, nada se move", () => {
  const contas = pedidoContas();
  assert.deepStrictEqual(modulo.recalibrarPedido(contas, "ct1", "").map(c => c.vencimento),
                         contas.map(c => c.vencimento));
  const todasPagas = contas.map(c => ({ ...c, pago: true }));
  assert.deepStrictEqual(modulo.recalibrarPedido(todasPagas, "ct1", "2026-12-01").map(c => c.vencimento),
                         todasPagas.map(c => c.vencimento));
});

teste("a prévia do pedido diz de onde para onde cada conta vai", () => {
  const p = modulo.previaDoPedido(pedidoContas(), "ct1", "2026-10-12", 6);
  assert.strictEqual(p.total, 3);
  assert.strictEqual(p.pagas, 0);
  assert.deepStrictEqual(p.linhas.map(l => [l.de, l.para]),
    [["2026-10-02", "2026-10-12"], ["2026-11-10", "2026-11-20"], ["2026-12-05", "2026-12-15"]]);
});

teste("a conta diz de onde nasceu: contrato ou pedido", () => {
  assert.strictEqual(modulo.docDaConta({ numeroContrato: "0003" }), "Contrato 0003");
  assert.strictEqual(modulo.docDaConta({ numeroPedido: "0004" }), "Pedido 0004");
  assert.strictEqual(modulo.docDaConta({}), "");
  assert.strictEqual(modulo.docDaConta({ numeroContrato: "0003", numeroPedido: "0004" }), "Contrato 0003");
  assert.match(modulo.tituloConta({ numeroPedido: "0004", favorecido: "Ferro Pronto", descricao: "1ª entrega" }), /^Pedido 0004 · Ferro Pronto/);
});

// ── Quem fez o quê ──────────────────────────────────────────────

teste("a baixa grava quem deu, quando e com que comprovante", () => {
  const conta = { id: "c1", valor: 1000, pago: false };
  const paga = modulo.contaPaga(conta, { pagoEm: "2026-09-10", valorPago: 1000,
    comprovante: { nome: "pix.png" } }, "Renato", "2026-09-20T12:00:00.000Z");
  assert.strictEqual(paga.pago, true);
  assert.strictEqual(paga.pagoEm, "2026-09-10");
  assert.strictEqual(paga.contabilizadoEm, "2026-09-20");
  const atos = modulo.registrosDaConta(paga).map(r => r.ato);
  assert.deepStrictEqual(atos, ["paga", "comprovante"], "baixa e anexo são dois atos");
  assert.strictEqual(modulo.ultimoAto(paga, "paga").por, "Renato");
  assert.strictEqual(modulo.registrosDaConta(paga)[1].detalhe, "pix.png");
});

teste("baixa sem comprovante não inventa ato de anexo", () => {
  const paga = modulo.contaPaga({ id: "c1", valor: 500 }, { pagoEm: "2026-09-10", valorPago: 500 },
    "Cliente", "2026-09-20T12:00:00.000Z");
  assert.deepStrictEqual(modulo.registrosDaConta(paga).map(r => r.ato), ["paga"]);
  assert.strictEqual(paga.comprovante, null);
});

teste("entrada a pagar em 3 boletos: uma conta por item e por parcela, mesma referência", () => {
  let k = 0;
  const contas = modulo.contasDaEntrada({
    situacao: "apagar", prestadorId: "f1", favorecido: "Construfácil", numeroNota: "163",
    apagar: { vencimento: "2026-10-10", parcelas: 3, intervalo: 30 },
    itens: [
      { descricao: "Veda concreto 18L", insumoCodigo: "VED-1", quantidade: "3", unidade: "BD", unitario: "428", total: "1284", etapa: "fundacao", contaId: "material" },
      { descricao: "Frete", total: "100", etapa: "fundacao", contaId: "frete" },
    ],
  }, { obraId: "ob1", numeroDoc: "0200", quem: "Renato", agora: "2026-10-03T12:00:00.000Z", novoId: () => "id" + (++k) });
  assert.strictEqual(contas.length, 6);
  assert.ok(contas.every((c) => c.numeroDoc === "0200" && c.numeroNota === "163" && !c.pago));
  assert.deepStrictEqual([...new Set(contas.map((c) => c.vencimento))], ["2026-10-10", "2026-11-09", "2026-12-09"]);
  assert.strictEqual(new Set(contas.map((c) => c.pedidoId)).size, 3, "cada boleto paga sozinho");
  const veda = contas.filter((c) => c.insumoCodigo === "VED-1");
  assert.strictEqual(Math.round(veda.reduce((s, c) => s + c.valor, 0) * 100) / 100, 1284);
  assert.strictEqual(Math.round(veda.reduce((s, c) => s + c.quantidade, 0) * 1000) / 1000, 3, "a quantidade soma a da nota");
  assert.ok(/parcela 2\/3/.test(contas[2].descricao), contas[2].descricao);
  const uma = modulo.contasDaEntrada({ situacao: "apagar", apagar: { vencimento: "2026-10-10", parcelas: 3 },
    itens: [{ descricao: "x", quantidade: 1, total: 428, contaId: "material" }] }, {});
  assert.deepStrictEqual(uma.map((c) => c.quantidade), [0.333, 0.333, 0.334], "a última leva o resto");
});

teste("entrada paga à vista: baixada, com o papel e a forma", () => {
  const contas = modulo.contasDaEntrada({
    situacao: "pago", prestadorId: "f1", favorecido: "Construfácil",
    pagamento: { data: "2026-09-02", forma: "avista" },
    itens: [{ descricao: "Veda", insumoCodigo: "VED-1", quantidade: 1, unitario: 428, etapa: "fundacao", contaId: "material" }],
  }, { obraId: "ob1", quem: "Renato", anexo: { url: "u", tipo: "nota", nome: "4183.pdf" } });
  assert.strictEqual(contas.length, 1);
  const c = contas[0];
  assert.strictEqual(c.pago, true);
  assert.strictEqual(c.pagoEm, "2026-09-02");
  assert.strictEqual(c.valorPago, 428);
  assert.strictEqual(c.formaPagamento, "avista");
  assert.strictEqual(c.comprovante.tipo, "nota");
});

teste("entrada paga no cartão: o plano vem de quem conhece o cartão", () => {
  const contas = modulo.contasDaEntrada({
    situacao: "pago", pagamento: { data: "2026-09-04", forma: "cartao", parcelas: 2 },
    itens: [{ descricao: "Concreto", total: 1000, contaId: "material", etapa: "fundacao" }],
  }, { cartao: { id: "k1" }, planoDoCartao: (c, ct, d) => ({ formaPagamento: "cartao", cartaoId: ct.id,
    parcelasCartao: [{ parcela: 1, de: d.parcelas, competencia: "2026-10", valor: 500 }, { parcela: 2, de: 2, competencia: "2026-11", valor: 500 }] }) });
  assert.strictEqual(contas[0].formaPagamento, "cartao");
  assert.strictEqual(contas[0].parcelasCartao.length, 2);
});

teste("item sem valor não vira conta", () => {
  assert.deepStrictEqual(modulo.contasDaEntrada({ situacao: "pago", itens: [{ descricao: "x" }] }, {}), []);
});

teste("desfazer pagamento no cartão tira a conta das faturas", () => {
  const paga = { id: "c9", valor: 300, pago: true, pagoEm: "2026-09-04", valorPago: 300, formaPagamento: "cartao", cartaoId: "k1",
    parcelasCartao: [{ parcela: 1, de: 1, competencia: "2026-10", valor: 300 }] };
  const aberta = modulo.contaEmAberto(paga, "Renato", "2026-10-03T12:00:00.000Z");
  assert.strictEqual(aberta.pago, false);
  assert.strictEqual(aberta.cartaoId, undefined);
  assert.strictEqual(aberta.parcelasCartao, undefined);
  assert.strictEqual(aberta.formaPagamento, undefined);
});

teste("desfazer registra o ato e preserva o comprovante", () => {
  const paga = modulo.contaPaga({ id: "c1", valor: 500 }, { pagoEm: "2026-09-10", valorPago: 500,
    comprovante: { nome: "pix.png" } }, "Renato", "2026-09-20T12:00:00.000Z");
  const aberta = modulo.contaEmAberto(paga, "Cliente", "2026-09-21T12:00:00.000Z");
  assert.strictEqual(aberta.pago, false);
  assert.strictEqual(aberta.valorPago, "");
  assert.ok(aberta.comprovante, "o documento do pagamento que houve não se apaga");
  const atos = modulo.registrosDaConta(aberta);
  assert.strictEqual(atos[atos.length - 1].ato, "desfeita");
  assert.strictEqual(atos[atos.length - 1].por, "Cliente");
});

teste("pagar de novo empilha a história, não a sobrescreve", () => {
  let c = modulo.contaPaga({ id: "c1", valor: 100 }, { pagoEm: "2026-09-10", valorPago: 100 }, "A", "2026-09-10T12:00:00.000Z");
  c = modulo.contaEmAberto(c, "B", "2026-09-11T12:00:00.000Z");
  c = modulo.contaPaga(c, { pagoEm: "2026-09-12", valorPago: 100 }, "C", "2026-09-12T12:00:00.000Z");
  assert.deepStrictEqual(modulo.registrosDaConta(c).map(r => r.por), ["A", "B", "C"]);
  assert.strictEqual(modulo.ultimoAto(c, "paga").por, "C");
});

teste("o histórico tem teto e corta o começo, não o fim", () => {
  let c = { id: "c1" };
  for (let i = 0; i < modulo.CP_MAX_REGISTROS + 5; i++) c = modulo.registrarAto(c, "editada", `u${i}`, "2026-09-20T12:00:00.000Z");
  const r = modulo.registrosDaConta(c);
  assert.strictEqual(r.length, modulo.CP_MAX_REGISTROS);
  assert.strictEqual(r[r.length - 1].por, `u${modulo.CP_MAX_REGISTROS + 4}`);
});

teste("o texto do ato sai legível", () => {
  assert.strictEqual(modulo.textoDoAto({ ato: "paga", por: "Renato", em: "2026-09-20T12:00:00.000Z" }),
    "Pagamento registrado por Renato em 20/09/2026");
  assert.strictEqual(modulo.textoDoAto({ ato: "criada", por: "", em: "" }), "Conta lançada");
});

teste("recalibrar o pedido registra o ato em cada conta que andou", () => {
  const contas = pedidoContas();
  const r = modulo.recalibrarPedido(contas, "ct1", "2026-10-12", "Cliente", "2026-09-20T12:00:00.000Z");
  const doPedido = r.filter(c => c.cotacaoId === "ct1");
  for (const c of doPedido) {
    const ato = modulo.ultimoAto(c, "recalibrada");
    assert.ok(ato, "cada conta movida conta a própria mudança");
    assert.strictEqual(ato.por, "Cliente");
    assert.match(ato.detalhe, /→/);
  }
  // sem nome, nada de registro — é o caminho de quem só simula a prévia
  const semNome = modulo.recalibrarPedido(contas, "ct1", "2026-10-12");
  assert.strictEqual(modulo.registrosDaConta(semNome.find(c => c.cotacaoId === "ct1")).length, 0);
});

teste("a parcela em aberto do contrato não perde o histórico na ressincronia", () => {
  const ct = base({ valor: 12000, parcelas: 2, dataInicio: "2026-01-10" });
  const geradas = modulo.contasDoContrato({ ...ct, obraId: "o1" });
  const comNota = geradas.map((c, i) => i === 0
    ? modulo.registrarAto({ ...c, observacao: "combinado por telefone" }, "editada", "Renato", "2026-09-20T12:00:00.000Z")
    : c);
  const sync = modulo.sincronizarContasDoContrato(comNota, { ...ct, obraId: "o1" });
  const primeira = sync.find(c => c.id === geradas[0].id);
  assert.strictEqual(primeira.observacao, "combinado por telefone");
  assert.strictEqual(modulo.registrosDaConta(primeira).length, 1);
});

// ── Recalibrar um pagamento só ──────────────────────────────────

teste("os pagamentos em aberto do pedido saem em ordem, sem os pagos", () => {
  const contas = pedidoContas();
  contas[0].pago = true;
  const d = modulo.pagamentosEmAberto(contas, "ct1", "pedido");
  assert.strictEqual(d.length, 2);
  assert.deepStrictEqual(d.map(x => x.vencimento), ["2026-11-10", "2026-12-05"]);
});

teste("mexer numa data move só aquela conta", () => {
  const contas = pedidoContas();
  const datas = modulo.pagamentosEmAberto(contas, "ct1", "pedido");
  datas[1].vencimento = "2026-11-30";
  const r = modulo.recalibrarContasDoPedido(contas, datas, "Renato", "2026-09-20T12:00:00.000Z");
  const doPedido = r.filter(c => c.cotacaoId === "ct1");
  assert.deepStrictEqual(doPedido.map(c => c.vencimento), ["2026-10-02", "2026-11-30", "2026-12-05"]);
  assert.strictEqual(modulo.registrosDaConta(doPedido[0]).length, 0, "quem não mudou não vira registro");
  assert.strictEqual(modulo.ultimoAto(doPedido[1], "recalibrada").por, "Renato");
});

teste("conta paga não se move nem quando a data é informada", () => {
  const contas = pedidoContas();
  contas[0].pago = true;
  const r = modulo.recalibrarContasDoPedido(contas, [{ id: contas[0].id, vencimento: "2027-01-01" }], "Renato");
  assert.strictEqual(r.find(c => c.id === contas[0].id).vencimento, "2026-10-02");
});

teste("a prévia data a data mostra o que ficou parado como parado", () => {
  const contas = pedidoContas();
  const datas = modulo.pagamentosEmAberto(contas, "ct1", "pedido");
  datas[0].vencimento = "2026-10-20";
  const p = modulo.previaDatasDoPedido(contas, "ct1", datas, 8);
  assert.deepStrictEqual(p.linhas.map(l => [l.de, l.para]),
    [["2026-10-02", "2026-10-20"], ["2026-11-10", "2026-11-10"], ["2026-12-05", "2026-12-05"]]);
});

// ── Numeração do pedido antigo ──────────────────────────────────

teste("pedido lançado sem número ganha o próximo da fila, e as contas junto", () => {
  const obra = { id: "o1", contratos: [{ id: "x", numeroContrato: "0003" }],
    cotacoes: [{ id: "ct1", titulo: "Aço", contaGeradaId: "a" }],
    contasPagar: [{ id: "a", cotacaoId: "ct1" }, { id: "b", cotacaoId: "ct1" }, { id: "c", contratoId: "x", numeroContrato: "0003" }] };
  const nova = modulo.numerarPedidosAntigos(obra, [obra]);
  assert.strictEqual(nova.cotacoes[0].numeroPedido, "0004");
  assert.deepStrictEqual(nova.contasPagar.map(c => c.numeroPedido || ""), ["0004", "0004", ""]);
  assert.strictEqual(modulo.docDaConta(nova.contasPagar[0]), "Pedido 0004");
});

teste("dois pedidos sem número, do mesmo fornecedor, ganham números diferentes", () => {
  const obra = { id: "o1", contratos: [],
    cotacoes: [{ id: "ct1", contaGeradaId: "a" }, { id: "ct2", contaGeradaId: "b" }],
    contasPagar: [{ id: "a", cotacaoId: "ct1" }, { id: "b", cotacaoId: "ct2" }] };
  const nova = modulo.numerarPedidosAntigos(obra, [obra]);
  assert.deepStrictEqual(nova.cotacoes.map(c => c.numeroPedido), ["0001", "0002"]);
});

teste("cotação sem conta gerada, ou já numerada, não é tocada", () => {
  const obra = { id: "o1", contratos: [], contasPagar: [],
    cotacoes: [{ id: "ct1", contaGeradaId: "", }, { id: "ct2", contaGeradaId: "b", numeroPedido: "0009" }] };
  assert.strictEqual(modulo.numerarPedidosAntigos(obra, [obra]), null, "nada a fazer, nada se grava");
});

// ── Uma parcela do contrato fora da régua ───────────────────────

const ctBase = () => base({ valor: 12000, parcelas: 3, periodicidade: "mensais", primeiroVencimento: "2026-10-05" });

teste("o ajuste vence a regra na parcela ajustada, e só nela", () => {
  const ct = ctBase();
  const antes = modulo.contasDoContrato(ct).map(c => c.vencimento);
  const ajustado = modulo.ajustarVencimentos(ct, [{ id: `${ct.id}:2`, vencimento: "2026-11-25" }]);
  const depois = modulo.contasDoContrato(ajustado);
  assert.strictEqual(depois[0].vencimento, antes[0]);
  assert.strictEqual(depois[1].vencimento, "2026-11-25");
  assert.strictEqual(depois[2].vencimento, antes[2]);
  assert.strictEqual(depois[1].ajustada, true);
});

teste("o ajuste sobrevive à ressincronização — é para isso que ele mora no contrato", () => {
  const ct = ctBase();
  const ajustado = modulo.ajustarVencimentos(ct, [{ id: `${ct.id}:2`, vencimento: "2026-11-25" }]);
  const contas = modulo.contasDoContrato(ajustado);
  const sync = modulo.sincronizarContasDoContrato(contas, ajustado);
  assert.strictEqual(sync.find(c => c.id === `${ct.id}:2`).vencimento, "2026-11-25");
});

teste("data igual à da regra não vira exceção, e exceção desfeita some", () => {
  const ct = ctBase();
  const daRegra = modulo.contasDoContrato(ct).map(c => ({ id: c.id, vencimento: c.vencimento }));
  assert.deepStrictEqual(modulo.ajustesDoContrato(modulo.ajustarVencimentos(ct, daRegra)), {},
    "mandar as datas da própria regra não anota exceção nenhuma");
  const mexido = modulo.ajustarVencimentos(ct, [{ id: `${ct.id}:2`, vencimento: "2026-11-25" }]);
  assert.deepStrictEqual(Object.keys(modulo.ajustesDoContrato(mexido)), [`${ct.id}:2`], "só a que mudou");
  const desfeito = modulo.ajustarVencimentos(mexido, [{ id: `${ct.id}:2`, vencimento: daRegra[1].vencimento }]);
  assert.deepStrictEqual(modulo.ajustesDoContrato(desfeito), {}, "voltou para a regra, deixa de ser exceção");
});

teste("a parcela não ajustada continua seguindo a regra quando o contrato muda", () => {
  const ct = ctBase();
  const ajustado = modulo.ajustarVencimentos(ct, [{ id: `${ct.id}:2`, vencimento: "2026-11-25" }]);
  const outro = { ...ajustado, primeiroVencimento: "2026-10-20" };
  const contas = modulo.contasDoContrato(outro);
  assert.strictEqual(contas[0].vencimento, "2026-10-20", "a 1ª acompanhou o contrato");
  assert.strictEqual(contas[1].vencimento, "2026-11-25", "a exceção continua sendo exceção");
  assert.strictEqual(contas[2].vencimento, "2026-12-20", "a 3ª acompanhou o contrato");
});

teste("recalibrar o contrato inteiro apaga as exceções do calendário antigo", () => {
  const ct = modulo.ajustarVencimentos(ctBase(), [{ id: "x:2", vencimento: "2026-11-25" }]);
  assert.ok(Object.keys(modulo.ajustesDoContrato(ct)).length);
  assert.deepStrictEqual(modulo.ajustesDoContrato(modulo.limparAjustes(ct)), {});
});

teste("a prévia do ajuste do contrato mostra parado como parado", () => {
  const ct = ctBase();
  const contas = modulo.contasDoContrato(ct);
  const p = modulo.previaAjusteContrato(ct, contas, [{ id: `${ct.id}:3`, vencimento: "2026-12-20" }], 8);
  assert.strictEqual(p.linhas.length, 3);
  assert.strictEqual(p.linhas[0].de, p.linhas[0].para);
  assert.strictEqual(p.linhas[2].para, "2026-12-20");
});

teste("parcela paga não entra na lista nem na prévia do ajuste", () => {
  const ct = ctBase();
  const contas = modulo.contasDoContrato(ct).map((c, i) => i === 0 ? { ...c, pago: true } : c);
  assert.deepStrictEqual(modulo.pagamentosEmAberto(contas, ct.id, "contrato").map(p => p.id),
    [`${ct.id}:2`, `${ct.id}:3`]);
  const p = modulo.previaAjusteContrato(ct, contas, [], 8);
  assert.strictEqual(p.pagas, 1);
  assert.strictEqual(p.linhas.length, 2);
});

teste("o dia no registro não escorrega para a véspera em fuso negativo", () => {
  const antes = process.env.TZ;
  process.env.TZ = "America/Sao_Paulo";
  const contas = pedidoContas();
  const r = modulo.recalibrarPedido(contas, "ct1", "2026-10-12", "Renato", "2026-09-20T12:00:00.000Z");
  const ato = modulo.ultimoAto(r.find(c => c.cotacaoId === "ct1"), "recalibrada");
  process.env.TZ = antes;
  assert.strictEqual(ato.detalhe, "02/10/2026 → 12/10/2026");
});

teste("empreendimento tem venda, terreno e tributos no P&L da obra", () => {
  const conta = (id) => modulo.PLANO_CONTAS.find(c => c.id === id);
  assert.strictEqual(conta("venda_imovel").grupo, "receitas");
  assert.strictEqual(conta("terreno_aquisicao").grupo, "terreno");
  for (const id of ["ir_receita", "inss", "iss"]) assert.strictEqual(conta(id).grupo, "servicos", id);
  const terreno = modulo.GRUPOS_PL.find(g => g.id === "terreno");
  assert.strictEqual(terreno.sinal, -1);
  assert.strictEqual(terreno.entra_no_resultado, true);
  // três casas: venda 630k, terreno 210k, obra 298.057,42, IR 4% da receita
  const itens = [
    { id: "1", contaId: "venda_imovel",      valor: 630000 },
    { id: "2", contaId: "terreno_aquisicao", valor: 210000 },
    { id: "3", contaId: "material",          valor: 222883.42 },
    { id: "4", contaId: "empreiteiro",       valor: 75174 },
    { id: "5", contaId: "ir_receita",        valor: 25200 },
  ];
  const pl = modulo.plDaObra(itens, [], modulo.GRUPOS_PL, modulo.PLANO_CONTAS);
  assert.strictEqual(pl.entradas.estimado, 630000);
  assert.strictEqual(pl.custo.estimado, 533257.42, "terreno entra no custo junto com obra e tributos");
  assert.strictEqual(pl.resultado.estimado, 96742.58);
  assert.strictEqual(Math.round((pl.entradas.estimado - 210000) * 100) / 100, 420000, "venda menos terreno é o lucro bruto");
});

teste("a conta abre em subcontas: grupo de material dos dois lados", () => {
  const itens = [
    { id: "e1", contaId: "material", grupoMaterial: "Concreto",   valor: 33125.20 },
    { id: "e2", contaId: "material", grupoMaterial: "Esquadrias", valor: 21712.46 },
    { id: "e3", contaId: "material", grupoMaterial: "Aço",        valor: 9645.62 },
    { id: "e4", contaId: "empreiteiro", grupoMaterial: "Prestadores de serviços", valor: 75174 },
  ];
  const contas = [
    { id: "c1", contaId: "material", grupoMaterial: "Concreto", valor: 14546.48, pago: true },
    { id: "c2", contaId: "material", grupoMaterial: "Aço",      valor: 7882.68,  pago: true },
    { id: "c3", contaId: "material", grupoMaterial: "Cimento",  valor: 1963.41,  pago: true },
    { id: "c4", contaId: "material", grupoMaterial: "Concreto", valor: 999,      pago: false },
  ];
  const linhas = modulo.subcontasDaConta(itens, contas, "material");
  assert.deepStrictEqual(linhas.map(l => l.chave), ["Concreto", "Esquadrias", "Aço", "Cimento"],
    "do maior para o menor, e o que só tem gasto entra no fim");
  const concreto = linhas.find(l => l.chave === "Concreto");
  assert.strictEqual(concreto.estimado, 33125.20);
  assert.strictEqual(concreto.realizado, 14546.48, "conta não paga não entra no realizado");
  assert.strictEqual(concreto.saldo, 18578.72);
  const cimento = linhas.find(l => l.chave === "Cimento");
  assert.strictEqual(cimento.estimado, 0, "gasto em grupo sem estimativa aparece mesmo assim");
  assert.strictEqual(cimento.saldo, -1963.41);
  assert.strictEqual(linhas.find(l => l.chave === "Esquadrias").realizado, 0);
  // a mesma função serve para etapa
  const porEtapa = modulo.subcontasDaConta(
    [{ contaId: "material", etapaId: "fundacao", valor: 100 }],
    [{ contaId: "material", etapa: "fundacao", valor: 40, pago: true }], "material", { chave: "etapa" });
  assert.strictEqual(porEtapa[0].nome, "Fundação");
  assert.strictEqual(porEtapa[0].saldo, 60);
  assert.deepStrictEqual(modulo.subcontasDaConta([], [], "material"), []);
});

teste("o P&L girado por etapa fecha com o P&L por conta", () => {
  const itens = [
    { contaId: "material",    grupoMaterial: "Concreto", etapaId: "fundacao",        valor: 19417.50 },
    { contaId: "material",    grupoMaterial: "Aço",      etapaId: "fundacao",        valor: 2461.35 },
    { contaId: "material",    grupoMaterial: "Tijolos e canaletas", etapaId: "supra_paredes_1", valor: 12112.90 },
    { contaId: "empreiteiro", grupoMaterial: "Prestadores de serviços", etapaId: "prestadores", valor: 54672 },
    { contaId: "venda_imovel",      etapaId: "", valor: 630000 },
    { contaId: "terreno_aquisicao", etapaId: "", valor: 210000 },
  ];
  const contas = [
    { contaId: "material",    etapa: "fundacao",    valor: 3892.72, pago: true },
    { contaId: "material",    etapa: "fundacao",    valor: 5326.88, pago: true },
    { contaId: "empreiteiro", etapa: "prestadores", valor: 4280,    pago: true },
    { contaId: "material",    etapa: "laje_1",      valor: 7200,    pago: true },
    { contaId: "venda_imovel", etapa: "outros",     valor: 12000,   pago: true },
    { contaId: "material",    etapa: "fundacao",    valor: 999,     pago: false },
  ];
  const r = modulo.plPorEtapa(itens, contas);
  assert.deepStrictEqual(r.linhas.map(l => l.etapaId), ["fundacao", "supra_paredes_1", "laje_1", "prestadores"],
    "ordem construtiva, com prestadores no fim");
  const fund = r.linhas.find(l => l.etapaId === "fundacao");
  assert.strictEqual(fund.estimado, 21878.85, "soma os grupos da mesma etapa");
  assert.strictEqual(fund.realizado, 9219.60);
  assert.strictEqual(fund.notas, 2, "conta não paga não entra");
  assert.strictEqual(r.linhas.find(l => l.etapaId === "laje_1").estimado, 0, "etapa só com gasto aparece");

  // venda e terreno ficam fora: etapa é obra, não negócio
  assert.ok(!r.linhas.some(l => l.etapaId === "outros"), "a venda não vira etapa");
  const pl = modulo.plDaObra(itens, contas, modulo.GRUPOS_PL, modulo.PLANO_CONTAS);
  assert.strictEqual(r.estimado, pl.custo.estimado - 210000, "o total bate com o custo do P&L sem o terreno");
  assert.strictEqual(r.realizado, pl.custo.realizado);
});

teste("só custo de obra tira venda, terreno e tributos das duas visões", () => {
  const itens = [
    { contaId: "material",     etapaId: "fundacao",    valor: 19417.50 },
    { contaId: "empreiteiro",  etapaId: "prestadores", valor: 54672 },
    { contaId: "taxa_admin_obra", etapaId: "",         valor: 5000 },
    { contaId: "ir_receita",   etapaId: "",            valor: 25200 },
    { contaId: "inss",         etapaId: "",            valor: 3000 },
    { contaId: "iss",          etapaId: "",            valor: 1200 },
    { contaId: "impostos",     etapaId: "fundacao",    valor: 800 },
    { contaId: "venda_imovel", etapaId: "",            valor: 630000 },
    { contaId: "terreno_aquisicao", etapaId: "",       valor: 210000 },
  ];
  const contas = [
    { contaId: "material",     etapa: "fundacao",    valor: 9219.60, pago: true },
    { contaId: "empreiteiro",  etapa: "prestadores", valor: 4280,    pago: true },
    { contaId: "ir_receita",   etapa: "",            valor: 480,     pago: true },
    { contaId: "venda_imovel", etapa: "",            valor: 12000,   pago: true },
    { contaId: "terreno_aquisicao", etapa: "",       valor: 70000,   pago: true },
  ];

  // leitura completa: tudo na mesa
  const cheio = modulo.plDaObra(itens, contas, modulo.GRUPOS_PL, modulo.PLANO_CONTAS);
  assert.ok(cheio.blocos.some(b => b.grupo.id === "receitas"), "completo mostra a receita");
  assert.ok(cheio.blocos.some(b => b.grupo.id === "terreno"), "completo mostra o terreno");
  assert.strictEqual(cheio.custo.estimado, 19417.50 + 54672 + 5000 + 25200 + 3000 + 1200 + 800 + 210000);

  // só custo: sem receita, sem terreno, sem tributo
  const custo = modulo.plDaObra(itens, contas, modulo.GRUPOS_PL, modulo.PLANO_CONTAS, { soCusto: true });
  assert.ok(!custo.blocos.some(b => b.grupo.id === "receitas"), "a venda sai do quadro");
  assert.ok(!custo.blocos.some(b => b.grupo.id === "terreno"), "o terreno sai do quadro");
  const servicos = custo.blocos.find(b => b.grupo.id === "servicos");
  assert.deepStrictEqual(servicos.linhas.map(l => l.conta.id), ["taxa_admin_obra"],
    "gerenciamento fica, imposto/IR/INSS/ISS saem");
  assert.strictEqual(custo.custo.estimado, 19417.50 + 54672 + 5000, "custo estimado só do canteiro");
  assert.strictEqual(custo.custo.realizado, 9219.60 + 4280, "realizado sem IR, venda e terreno");

  // por etapa, com o mesmo filtro, fecha igual ao por conta
  const etapaCheia = modulo.plPorEtapa(itens, contas);
  assert.strictEqual(etapaCheia.estimado, 19417.50 + 54672 + 5000 + 25200 + 3000 + 1200 + 800,
    "sem soCusto o tributo continua no quadro por etapa");
  const etapaCusto = modulo.plPorEtapa(itens, contas, { soCusto: true });
  assert.strictEqual(etapaCusto.estimado, custo.custo.estimado, "as duas visões fecham no mesmo total");
  assert.strictEqual(etapaCusto.realizado, custo.custo.realizado);
  const fund = etapaCusto.linhas.find(l => l.etapaId === "fundacao");
  assert.strictEqual(fund.estimado, 19417.50, "o imposto marcado com etapa também sai");

  // o dado não muda: mesma base, só outra leitura
  assert.strictEqual(itens.length, 9);
  assert.strictEqual(cheio.entradas.estimado, 630000, "a receita continua lá na leitura completa");
});

// ── Conta na loja ─────────────────────────────────
// Os números são do pedido 136560-109 da Ourifer, de 28/09/2026: onze itens,
// R$ 539,40 de tabela e R$ 54,00 de desconto no rodapé — paga-se R$ 485,40.
const OURIFER_136560 = [
  ["Tábua de pinus 10x2,0x3,00m", 300.00, "fundacao",   "Madeira de caixaria"],
  ["Sarrafo 5x2,3x3,00m",           59.00, "fundacao",   "Madeira de caixaria"],
  ["Prego 17x21 1kg",               14.90, "fundacao",   "Madeira de caixaria"],
  ["Prego 18x24 1kg",               14.90, "fundacao",   "Madeira de caixaria"],
  ["Disco de corte fino inox 4\"",   22.50, "fundacao",   "Ferramentas"],
  ["Lâmina de serra circular 110mm", 43.00, "fundacao", "Ferramentas"],
  ["Linha trancada multifio 100m",  20.00, "fundacao",   "Outros"],
  ["Disco diamantado 110mm",        16.90, "fundacao",   "Ferramentas"],
  ["Cal hidratado CH-III 20kg",     17.90, "chapisco_reboco", "Argamassas"],
  ["Fita crepe 48mmx50m",           15.50, "chapisco_reboco", "Outros"],
  ["Arame recozido trançado nº18 1kg", 14.80, "fundacao", "Aço"],
];
function pedidoOurifer(extra) {
  return Object.assign(modulo.pedidoVazio("P-001"), {
    id: "ped1", numeroLoja: "136560-109", data: "2026-09-28", vencimento: "2026-10-28",
    desconto: 54.00,
    itens: OURIFER_136560.map(([descricao, bruto, etapa, grupoMaterial], i) => ({
      id: "i" + i, descricao, bruto, etapa, grupoMaterial,
      quantidade: 1, unidade: "un", contaId: grupoMaterial === "Ferramentas" ? "compra_ferramentas" : "material",
    })),
  }, extra || {});
}

teste("o desconto do rodapé se reparte pelos itens e fecha no centavo", () => {
  const p = pedidoOurifer();
  assert.strictEqual(modulo.brutoDoPedido(p), 539.40, "a soma de tabela");
  assert.strictEqual(modulo.totalDoPedido(p), 485.40, "o que se paga");

  const itens = modulo.itensRateados(p);
  const soma = Math.round(itens.reduce((s, i) => s + i.valor, 0) * 100) / 100;
  assert.strictEqual(soma, 485.40, "a soma rateada é o total, no centavo");
  // o resíduo do arredondamento vai no maior item, como nas parcelas
  assert.strictEqual(itens[0].valor, 269.95, "a tábua absorve os dois centavos");
  assert.strictEqual(itens[8].valor, 16.11, "o cal");

  // sem desconto, ninguém mexe em nada
  const limpo = modulo.itensRateados(pedidoOurifer({ desconto: 0 }));
  assert.strictEqual(limpo[0].valor, 300, "sem desconto o item vale a tabela");

  // quantidade × unitário quando a loja não mandou o subtotal
  assert.strictEqual(modulo.brutoDoItem({ quantidade: 30, unitario: "10,00" }), 300);
  assert.strictEqual(modulo.brutoDoItem({ bruto: "1.234,50" }), 1234.5, "valor em português");
});

teste("o pedido vira uma conta por item, com etapa e grupo de material", () => {
  let n = 0;
  const contas = modulo.contasDoPedidoDaLoja(
    { obraId: "ob1", cotacaoId: "cot1", prestadorId: "f1", favorecido: "Ourifer", contaId: "material" },
    pedidoOurifer(), () => "c" + (++n));

  assert.strictEqual(contas.length, 11, "uma conta por item, não uma por pedido");
  assert.strictEqual(Math.round(contas.reduce((s, c) => s + c.valor, 0) * 100) / 100, 485.40);
  assert.ok(contas.every(c => c.pedidoId === "ped1" && c.numeroLoja === "136560-109"),
    "todas carregam o pedido, para a baixa em lote achar de volta");
  assert.ok(contas.every(c => c.vencimento === "2026-10-28" && !c.pago));

  // é isto que faz o P&L por etapa e a abertura por subconta funcionarem
  const cal = contas.find(c => c.descricao.indexOf("Cal") === 0);
  assert.strictEqual(cal.etapa, "chapisco_reboco");
  assert.strictEqual(cal.grupoMaterial, "Argamassas");
  assert.strictEqual(cal.contaId, "material");
  const disco = contas.find(c => c.descricao.indexOf("Disco de corte") === 0);
  assert.strictEqual(disco.contaId, "compra_ferramentas", "ferramenta não é material");

  // o mesmo caminho pelo despacho do modo
  const pelaCotacao = modulo.contasDaCotacao(
    { modo: "contaLoja", obraId: "ob1", cotacaoId: "cot1", pedido: pedidoOurifer() }, () => "x" + (++n));
  assert.strictEqual(pelaCotacao.length, 11);
  assert.strictEqual(modulo.modoLancamento("contaLoja").nome, "Conta na loja");
});

teste("o pedido não entra torto", () => {
  assert.deepStrictEqual(modulo.validarPedido(pedidoOurifer(), []).erros, [], "o pedido bom passa");

  const semEtapa = pedidoOurifer();
  semEtapa.itens = semEtapa.itens.map((i, k) => (k < 2 ? { ...i, etapa: "" } : i));
  const r = modulo.validarPedido(semEtapa, []);
  assert.strictEqual(r.ok, false);
  assert.ok(r.erros.some(e => e.indexOf("2 itens") === 0), "diz quantos, não só que tem");

  const repetido = modulo.validarPedido(pedidoOurifer({ id: "ped2" }), [pedidoOurifer()]);
  assert.ok(repetido.erros.some(e => e.indexOf("136560-109") >= 0), "número repetido na loja");
  // o mesmo pedido sendo reeditado não é duplicidade
  assert.deepStrictEqual(modulo.validarPedido(pedidoOurifer(), [pedidoOurifer()]).erros, []);

  const vazio = modulo.validarPedido(modulo.pedidoVazio("P-002"), []);
  assert.strictEqual(vazio.erros.length, 2, "sem item e sem número da loja");
});

teste("a fila de pagamento agrupa por loja e a baixa paga só o escolhido", () => {
  const conta = (id, pedidoId, valor, quem, venc) => ({
    id, pedidoId, numeroPedido: "P", numeroLoja: pedidoId, cotacaoId: "cot1", obraId: "ob1",
    prestadorId: quem, favorecido: quem, valor, vencimento: venc, pago: false,
  });
  const contas = [
    conta("a", "136560-109", 485.40, "Ourifer",  "2026-10-28"),
    conta("b", "136594-109",  13.95, "Ourifer",  "2026-10-28"),
    conta("c", "136614-109", 615.42, "Ourifer",  "2026-10-28"),
    conta("d", "9001",       200.00, "Pantanal", "2026-11-05"),
    { ...conta("e", "136400-109", 99, "Ourifer", "2026-09-10"), pago: true },
    { id: "f", obraId: "ob1", valor: 50, pago: false },                       // avulsa, sem pedido
    { ...conta("g", "8000", 70, "Ourifer", "2026-10-28"), obraId: "ob2" },    // outra obra
  ];

  const fila = modulo.pedidosPendentes(contas, { obraId: "ob1" });
  assert.deepStrictEqual(fila.lojas.map(l => l.favorecido), ["Ourifer", "Pantanal"], "maior primeiro");
  assert.strictEqual(fila.lojas[0].valor, 1114.77, "o acumulado da Ourifer no mês");
  assert.strictEqual(fila.lojas[0].pedidos.length, 3, "pago e conta avulsa ficam de fora");
  assert.strictEqual(fila.total, 1314.77);

  const escolhidos = fila.lojas[0].pedidos.map(p => p.pedidoId);
  const baixa = modulo.baixarPedidos(contas, escolhidos, { pagoEm: "2026-10-28" }, "Renato", "2026-10-28T12:00:00.000Z");
  assert.strictEqual(baixa.total, 1114.77, "a soma dos itens é o valor que sai do caixa");
  assert.ok(["a", "b", "c"].every(id => baixa.contas.find(c => c.id === id).pago));
  assert.strictEqual(baixa.contas.find(c => c.id === "d").pago, false, "a Pantanal não foi escolhida");
  assert.strictEqual(baixa.contas.find(c => c.id === "a").valorPago, 485.40);
  assert.strictEqual(modulo.pedidosPendentes(baixa.contas, { obraId: "ob1" }).lojas.length, 1,
    "depois da baixa só sobra a Pantanal");
});

teste("pedido lançado errado se conserta — até alguém pagar", () => {
  let n = 0;
  const contas = modulo.contasDoPedidoDaLoja(
    { obraId: "ob1", cotacaoId: "cot1", favorecido: "Ourifer", contaId: "material" },
    pedidoOurifer(), () => "c" + (++n));

  // nada pago: dá para refazer e dá para apagar
  assert.strictEqual(modulo.podeMexerNoPedido(contas, "ped1").pode, true);
  const limpo = modulo.removerContasDoPedido(contas, "ped1");
  assert.strictEqual(limpo.length, 0, "some o pedido inteiro");

  // conta de outro pedido não é tocada
  const comOutro = contas.concat([{ id: "z", pedidoId: "ped2", valor: 10, pago: false }]);
  assert.deepStrictEqual(modulo.removerContasDoPedido(comOutro, "ped1").map(c => c.id), ["z"]);

  // um item pago trava tudo: o gasto não pode sumir da obra
  const comPago = contas.map((c, i) => (i === 0 ? { ...c, pago: true, valorPago: c.valor } : c));
  const trava = modulo.podeMexerNoPedido(comPago, "ped1");
  assert.strictEqual(trava.pode, false);
  assert.ok(trava.motivo.indexOf("Um item") === 0, "diz que é um só");
  const doisPagos = contas.map((c, i) => (i < 2 ? { ...c, pago: true } : c));
  assert.ok(modulo.podeMexerNoPedido(doisPagos, "ped1").motivo.indexOf("2 itens") === 0);

  // e, se ainda assim a remoção for chamada, o que foi pago fica
  const sobra = modulo.removerContasDoPedido(comPago, "ped1");
  assert.strictEqual(sobra.length, 1);
  assert.strictEqual(sobra[0].pago, true);

  assert.strictEqual(modulo.podeMexerNoPedido(contas, "").pode, false, "sem id não mexe");
});

teste("a lista mostra o pedido, não os onze itens — e o item continua lá dentro", () => {
  let n = 0;
  const doPedido = modulo.contasDoPedidoDaLoja(
    { obraId: "ob1", cotacaoId: "cot1", favorecido: "Ourifer", prestadorId: "f1", contaId: "material" },
    pedidoOurifer(), () => "c" + (++n));
  const avulsa = { id: "av1", obraId: "ob1", descricao: "Caçamba de entulho", valor: 350, vencimento: "2026-10-05", pago: false };
  const parcela = { id: "pc1", obraId: "ob1", origem: "contrato", descricao: "Empreiteiro 1/3", valor: 5000, vencimento: "2026-10-10", pago: false };

  const linhas = modulo.linhasDePedido([avulsa].concat(doPedido).concat([parcela]));
  assert.deepStrictEqual(linhas.map(l => l.tipo), ["conta", "pedido", "conta"],
    "onze contas viram uma linha; avulsa e parcela passam direto");

  const ped = linhas[1];
  assert.strictEqual(ped.contas.length, 11, "os itens continuam dentro da linha");
  assert.strictEqual(ped.valor, 485.40, "o total do pedido é a soma dos itens");
  assert.strictEqual(ped.numeroLoja, "136560-109");
  assert.strictEqual(ped.favorecido, "Ourifer");
  assert.strictEqual(ped.vencimento, "2026-10-28", "vence pela data mais cedo dos itens");
  assert.strictEqual(ped.pago, false);
  assert.strictEqual(ped.aberto, 485.40);

  // meio pago: nem aberto nem quitado
  const meio = doPedido.map((c, i) => (i < 3 ? { ...c, pago: true, valorPago: c.valor } : c));
  const parcial = modulo.linhasDePedido(meio)[0];
  assert.strictEqual(parcial.parcial, true);
  assert.strictEqual(parcial.pago, false);
  assert.strictEqual(parcial.aberto, Math.round((485.40 - parcial.valorPago) * 100) / 100);

  // pago inteiro
  const tudo = modulo.linhasDePedido(doPedido.map(c => ({ ...c, pago: true, valorPago: c.valor })))[0];
  assert.strictEqual(tudo.pago, true);
  assert.strictEqual(tudo.valorPago, 485.40);
  assert.strictEqual(tudo.aberto, 0);

  // a baixa em lote carrega o comprovante para todos os itens do pedido
  const r = modulo.baixarPedidos(doPedido, ["ped1"],
    { pagoEm: "2026-10-28", comprovante: { nome: "boleto.pdf" } }, "Renato", "2026-10-28T12:00:00.000Z");
  assert.strictEqual(r.total, 485.40);
  assert.ok(r.contas.every(c => c.pago && c.comprovante && c.comprovante.nome === "boleto.pdf"),
    "um boleto só vale por todos os itens");

  assert.deepStrictEqual(modulo.linhasDePedido(null), []);
});

teste("os pedidos se acumulam debaixo do nome da loja, com o total somado", () => {
  let n = 0;
  const id = () => "c" + (++n);
  const base = { obraId: "ob1", cotacaoId: "cot1", favorecido: "Ourifer", prestadorId: "f1", contaId: "material" };
  const ped1 = modulo.contasDoPedidoDaLoja(base, pedidoOurifer(), id);
  const ped2 = modulo.contasDoPedidoDaLoja(base,
    { ...pedidoOurifer(), id: "ped2", numero: 2, numeroLoja: "136594-109", desconto: "",
      vencimento: "2026-11-28",
      itens: [{ id: "i1", descricao: "Arame recozido", quantidade: "1", unidade: "un", unitario: "13,95", bruto: "13,95", etapa: "fundacao" }] },
    id);
  const deOutraLoja = modulo.contasDoPedidoDaLoja(
    { ...base, favorecido: "Pantanal", prestadorId: "f2" },
    { ...pedidoOurifer(), id: "ped3", numero: 3, numeroLoja: "A-1", desconto: "",
      itens: [{ id: "i1", descricao: "Cimento", quantidade: "10", unidade: "sc", unitario: "40,00", bruto: "400,00", etapa: "fundacao" }] },
    id);
  const avulsa = { id: "av1", obraId: "ob1", descricao: "Ca\u00e7amba de entulho", valor: 350, vencimento: "2026-10-05", pago: false };

  const linhas = modulo.linhasDeLoja([avulsa].concat(ped1).concat(ped2).concat(deOutraLoja));
  assert.deepStrictEqual(linhas.map(l => l.tipo), ["conta", "loja", "loja"],
    "a avulsa passa direto; cada loja vira uma linha s\u00f3");

  const ourifer = linhas[1];
  assert.strictEqual(ourifer.favorecido, "Ourifer");
  assert.strictEqual(ourifer.pedidos.length, 2, "os dois pedidos ficam debaixo dela");
  assert.strictEqual(ourifer.valor, 499.35, "485,40 + 13,95 \u00e9 o que se deve \u00e0 loja");
  assert.strictEqual(ourifer.contas.length, 12, "os itens continuam l\u00e1, dois n\u00edveis abaixo");
  assert.strictEqual(ourifer.vencimento, "2026-10-28", "cobra pela data mais cedo dos pedidos");
  assert.deepStrictEqual(ourifer.pedidoIds, ["ped1", "ped2"]);
  assert.strictEqual(ourifer.pago, false);
  assert.strictEqual(ourifer.aberto, 499.35);
  assert.strictEqual(ourifer.pedidosEmAberto, 2);

  assert.strictEqual(linhas[2].favorecido, "Pantanal", "loja diferente n\u00e3o se mistura");
  assert.strictEqual(linhas[2].pedidos.length, 1);

  // um pedido pago, o outro n\u00e3o: a loja fica parcial
  const meio = ped1.map(c => ({ ...c, pago: true, valorPago: c.valor })).concat(ped2);
  const parcial = modulo.linhasDeLoja(meio)[0];
  assert.strictEqual(parcial.parcial, true);
  assert.strictEqual(parcial.pago, false);
  assert.strictEqual(parcial.valorPago, 485.40);
  assert.strictEqual(parcial.aberto, 13.95, "sobra o que ainda n\u00e3o foi pago");
  assert.strictEqual(parcial.pedidosEmAberto, 1);

  // tudo pago
  const quitada = modulo.linhasDeLoja(ped1.concat(ped2).map(c => ({ ...c, pago: true, valorPago: c.valor })))[0];
  assert.strictEqual(quitada.pago, true);
  assert.strictEqual(quitada.aberto, 0);

  // a loja liga para fechar: um pagamento s\u00f3 baixa os dois pedidos
  const r = modulo.baixarPedidos(ped1.concat(ped2), ourifer.pedidoIds,
    { pagoEm: "2026-10-28", comprovante: { nome: "pix.pdf" } }, "Renato", "2026-10-28T12:00:00.000Z");
  assert.strictEqual(r.total, 499.35);
  assert.ok(r.contas.every(c => c.pago), "os doze itens dos dois pedidos saem quitados");

  // na lista j\u00e1 separada por fornecedor o n\u00edvel da loja seria o nome repetido
  const semNivel = modulo.linhasDeLoja(ped1.concat(ped2), { semNivelDeLoja: true });
  assert.deepStrictEqual(semNivel.map(l => l.tipo), ["pedido", "pedido"]);
  assert.deepStrictEqual(semNivel[0].pedidoIds, ["ped1"], "o pedido sozinho tamb\u00e9m sabe se pagar");

  assert.deepStrictEqual(modulo.linhasDeLoja(null), []);
});

teste("o aviso conta os dias de verdade e acompanha a data", () => {
  const hoje = "2026-09-29";
  const rot = (venc, extra) => modulo.rotuloSituacaoConta(Object.assign({ vencimento: venc }, extra || {}), hoje).label;

  assert.strictEqual(rot("2026-09-29"), "Vence hoje");
  assert.strictEqual(rot("2026-09-30"), "Vence amanh\u00e3");
  assert.strictEqual(rot("2026-10-01"), "Vence em 2 dias");
  assert.strictEqual(rot("2026-10-06"), "Vence em 7 dias");
  // fora da semana volta a ser o estado, sem contagem
  assert.strictEqual(rot("2026-10-07"), "Em aberto");
  assert.strictEqual(rot("2026-10-28"), "Em aberto");

  // atraso: a loja pergunta h\u00e1 quanto tempo, n\u00e3o s\u00f3 que venceu
  assert.strictEqual(rot("2026-09-28"), "Venceu ontem");
  assert.strictEqual(rot("2026-09-26"), "Vencida h\u00e1 3 dias");

  // paga e sem data n\u00e3o contam dia nenhum
  assert.strictEqual(rot("2026-09-20", { pago: true }), "Paga");
  assert.strictEqual(rot(""), "Sem data");

  // mudar o vencimento muda a frase: \u00e9 o que estava faltando na tela
  const conta = { vencimento: "2026-10-06" };
  assert.strictEqual(modulo.rotuloSituacaoConta(conta, hoje).label, "Vence em 7 dias");
  assert.strictEqual(modulo.rotuloSituacaoConta({ ...conta, vencimento: hoje }, hoje).label, "Vence hoje");
});

teste("o que pede aten\u00e7\u00e3o hoje vem em negrito; o resto, n\u00e3o", () => {
  const hoje = "2026-09-29";
  const forte = (venc) => modulo.rotuloSituacaoConta({ vencimento: venc }, hoje).forte;
  assert.strictEqual(forte("2026-09-29"), true, "vence hoje \u00e9 para ver primeiro");
  assert.strictEqual(forte("2026-09-26"), true, "vencida tamb\u00e9m");
  assert.strictEqual(forte("2026-09-30"), false);
  assert.strictEqual(forte("2026-10-20"), false);
});

teste("os dias at\u00e9 o vencimento, com sinal", () => {
  const hoje = "2026-09-29";
  assert.strictEqual(modulo.diasParaVencer({ vencimento: "2026-09-29" }, hoje), 0);
  assert.strictEqual(modulo.diasParaVencer({ vencimento: "2026-10-06" }, hoje), 7);
  assert.strictEqual(modulo.diasParaVencer({ vencimento: "2026-09-26" }, hoje), -3);
  assert.strictEqual(modulo.diasParaVencer({ vencimento: "" }, hoje), null);
  assert.strictEqual(modulo.diasParaVencer(null, hoje), null);
});

teste("a faixa continua a mesma \u2014 os totais e os filtros n\u00e3o mudam", () => {
  const hoje = "2026-09-29";
  assert.strictEqual(modulo.situacaoConta({ vencimento: "2026-09-29" }, hoje), "vencendo");
  assert.strictEqual(modulo.situacaoConta({ vencimento: "2026-09-26" }, hoje), "vencido");
  assert.strictEqual(modulo.situacaoConta({ vencimento: "2026-10-20" }, hoje), "aberto");
});

teste("a chave que se copia: a da fatura ganha da do cadastro", () => {
  const loja = { id: "f1", nome: "R. J. Ferreira Ltda", pixTipo: "cnpj",
                 pixChave: "08.617.563/0001-35", pixBeneficiario: "OURIFER" };

  // sem nada na fatura, vale o cadastro
  const doCadastro = modulo.pixDoPagamento({ favorecido: "Ourifer" }, loja);
  assert.strictEqual(doCadastro.tem, true);
  assert.strictEqual(doCadastro.valor, "08.617.563/0001-35");
  assert.strictEqual(doCadastro.rotulo, "PIX · CNPJ", "o rótulo diz que é PIX, não só o tipo da chave");
  assert.strictEqual(doCadastro.beneficiario, "OURIFER");
  assert.strictEqual(doCadastro.copiaECola, false);

  // o copia-e-cola da fatura manda: ele já traz valor e identificador
  const colar = "00020126580014BR.GOV.BCB.PIX0136abc-123" + "x".repeat(60);
  const daFatura = modulo.pixDoPagamento({ pixCopiaECola: colar, favorecido: "Ourifer" }, loja);
  assert.strictEqual(daFatura.valor, colar);
  assert.strictEqual(daFatura.rotulo, "PIX copia e cola");
  assert.strictEqual(daFatura.copiaECola, true);
  assert.strictEqual(daFatura.beneficiario, "OURIFER", "o beneficiário continua vindo do cadastro");

  // chave própria da fatura, com o tipo dela
  const outra = modulo.pixDoPagamento({ pixChave: "pagamentos@ourifer.com.br", pixTipo: "email" }, loja);
  assert.strictEqual(outra.valor, "pagamentos@ourifer.com.br");
  assert.strictEqual(outra.rotulo, "PIX · E-mail");
  const porTelefone = modulo.pixDoPagamento({}, { nome: "Ferro Pronto Ourinhos LTDA", pixTipo: "telefone", pixChave: "18996979916" });
  assert.strictEqual(porTelefone.rotulo, "PIX · Telefone", "telefone como chave não pode parecer o telefone da loja");

  // sem chave em lugar nenhum, o botão não aparece
  assert.strictEqual(modulo.pixDoPagamento({ favorecido: "Pantanal" }, { id: "f2", nome: "Pantanal" }).tem, false);
  assert.strictEqual(modulo.pixDoPagamento(null, null).tem, false);

  // sem beneficiário cadastrado, vale o nome da loja
  const semNome = modulo.pixDoPagamento({}, { nome: "Pantanal", pixChave: "11122233344" });
  assert.strictEqual(semNome.beneficiario, "Pantanal");

  // o resumo só encurta o que não cabe
  assert.strictEqual(modulo.pixResumido("08.617.563/0001-35"), "08.617.563/0001-35");
  const curto = modulo.pixResumido(colar, 20);
  assert.ok(curto.length <= 20 && curto.indexOf("…") > 0, "corta no meio e marca");
  assert.strictEqual(modulo.pixResumido(""), "");

  assert.strictEqual(modulo.nomeDoTipoPix("aleatoria"), "Chave aleatória");
  assert.strictEqual(modulo.nomeDoTipoPix("xpto"), "Chave PIX", "tipo desconhecido não quebra");
  assert.strictEqual(modulo.TIPOS_PIX.length, 5);
});

teste("o pedido leva o copia-e-cola para as contas que gera", () => {
  let n = 0;
  const colar = "00020126580014BR.GOV.BCB.PIX";
  const contas = modulo.contasDoPedidoDaLoja(
    { obraId: "ob1", cotacaoId: "cot1", prestadorId: "f1", favorecido: "Ourifer" },
    pedidoOurifer({ pixCopiaECola: colar }), () => "c" + (++n));
  assert.ok(contas.every(c => c.pixCopiaECola === colar), "toda conta do pedido sabe como se paga");
  const linha = modulo.linhasDePedido(contas)[0];
  assert.strictEqual(linha.pixCopiaECola, colar, "e a linha da fila também");
  assert.strictEqual(modulo.pixDoPagamento(linha, { id: "f1", nome: "Ourifer" }).valor, colar);
});


// ── O item da conta a pagar ────────────────────────────
teste("a conta contábil do pedido sai uma vez, não por item", () => {
  assert.deepStrictEqual(modulo.contasDoPedidoDeConta(
    [{ contaId: "material" }, { contaId: "material" }, { contaId: "material" }]), ["material"]);
});

teste("pedido que mistura contas mostra as duas", () => {
  assert.deepStrictEqual(modulo.contasDoPedidoDeConta(
    [{ contaId: "material" }, { contaId: "ferramentas" }, { contaId: "material" }]),
    ["material", "ferramentas"]);
  assert.deepStrictEqual(modulo.contasDoPedidoDeConta([]), []);
  assert.deepStrictEqual(modulo.contasDoPedidoDeConta([{ contaId: "" }]), []);
});

teste("o unitário sai do valor rateado, não do preço de tabela", () => {
  assert.strictEqual(modulo.unitarioDaConta({ quantidade: 100, valor: 585 }), 5.85);
  assert.strictEqual(modulo.unitarioDaConta({ quantidade: 3, valor: 10 }), 3.33);
});

teste("item pago usa o que foi pago de verdade", () => {
  assert.strictEqual(modulo.unitarioDaConta({ quantidade: 2, valor: 100, pago: true, valorPago: 90 }), 45);
});

teste("sem quantidade ou sem valor não se inventa unitário", () => {
  assert.strictEqual(modulo.unitarioDaConta({ quantidade: 0, valor: 50 }), null);
  assert.strictEqual(modulo.unitarioDaConta({ quantidade: 5, valor: 0 }), null);
  assert.strictEqual(modulo.unitarioDaConta(null), null);
});


// ── Apagar um pedido que nunca devia ter entrado ──────────
const cpTeste = [
  { id: "a", pedidoId: "p1", valor: 100, pago: false },
  { id: "b", pedidoId: "p1", valor: 50, pago: true, valorPago: 48 },
  { id: "c", pedidoId: "p2", valor: 30, pago: false },
  { id: "d", pedidoId: "", valor: 20, pago: false },
];

teste("apagar o pedido leva também o que já foi baixado", () => {
  const r = modulo.apagarPedidoInteiro(cpTeste, "p1");
  assert.deepStrictEqual(r.map(c => c.id), ["c", "d"]);
});

teste("e não encosta em conta de outro pedido nem em avulsa", () => {
  assert.deepStrictEqual(modulo.apagarPedidoInteiro(cpTeste, "p2").map(c => c.id), ["a", "b", "d"]);
  assert.deepStrictEqual(modulo.apagarPedidoInteiro(cpTeste, "").map(c => c.id), ["a", "b", "c", "d"]);
  assert.deepStrictEqual(modulo.apagarPedidoInteiro(cpTeste, "naoexiste").map(c => c.id), ["a", "b", "c", "d"]);
});

teste("remover e apagar são coisas diferentes: um poupa o pago, o outro não", () => {
  // relançar um pedido poupa o que já foi pago
  assert.deepStrictEqual(modulo.removerContasDoPedido(cpTeste, "p1").map(c => c.id), ["b", "c", "d"]);
  // apagar diz que ele nunca existiu
  assert.deepStrictEqual(modulo.apagarPedidoInteiro(cpTeste, "p1").map(c => c.id), ["c", "d"]);
});

teste("o resumo diz em números o que vai sair", () => {
  assert.deepStrictEqual(modulo.resumoDoQueSai(cpTeste, "p1"),
    { quantas: 2, valor: 150, pagas: 1, valorPago: 48 });
  assert.deepStrictEqual(modulo.resumoDoQueSai(cpTeste, "p2"),
    { quantas: 1, valor: 30, pagas: 0, valorPago: 0 });
});

teste("pedido que não existe não tem o que sair", () => {
  assert.deepStrictEqual(modulo.resumoDoQueSai(cpTeste, "naoexiste"),
    { quantas: 0, valor: 0, pagas: 0, valorPago: 0 });
  assert.deepStrictEqual(modulo.resumoDoQueSai([], "p1"),
    { quantas: 0, valor: 0, pagas: 0, valorPago: 0 });
});

teste("a nota fiscal identifica a compra tão bem quanto o pedido", () => {
  // Nota fiscal não tem número de pedido. Exigir um deixava quem anexou a
  // nota sem saída: tinha que inventar um número para conseguir lançar.
  const comNota = pedidoOurifer({ numeroLoja: "", numeroNota: "8623" });
  assert.deepStrictEqual(modulo.validarPedido(comNota, []).erros, []);

  const comPedido = pedidoOurifer({ numeroNota: "" });
  assert.deepStrictEqual(modulo.validarPedido(comPedido, []).erros, []);

  const semNenhum = pedidoOurifer({ numeroLoja: "", numeroNota: "" });
  const r = modulo.validarPedido(semNenhum, []);
  assert.strictEqual(r.ok, false);
  assert.ok(r.erros.some(e => /n[úu]mero da nota fiscal/i.test(e)),
    "e o recado diz que a nota serve: " + r.erros.join(" | "));
});

teste("a mesma nota não entra duas vezes", () => {
  const nota = pedidoOurifer({ numeroLoja: "", numeroNota: "8623" });
  const outra = pedidoOurifer({ id: "ped2", numeroLoja: "", numeroNota: "8623" });
  const r = modulo.validarPedido(outra, [nota]);
  assert.ok(r.erros.some(e => /A nota 8623 j[áa] foi lan[çc]ada/.test(e)), r.erros.join(" | "));
  // reeditar a mesma não é duplicidade
  assert.deepStrictEqual(modulo.validarPedido(nota, [nota]).erros, []);
});

teste("zero à esquerda e ponto não criam uma nota nova", () => {
  // o papel imprime "Nº 000.008.623"; a pessoa digita "8623"
  assert.strictEqual(modulo.chaveDoDocumento("000.008.623"), "8623");
  assert.strictEqual(modulo.chaveDoDocumento("8623"), "8623");
  assert.strictEqual(modulo.chaveDoDocumento("8.623"), "8623");
  const a = pedidoOurifer({ numeroLoja: "", numeroNota: "000.008.623" });
  const b = pedidoOurifer({ id: "ped2", numeroLoja: "", numeroNota: "8623" });
  assert.ok(modulo.validarPedido(b, [a]).erros.some(e => /j[áa] foi lan[çc]ada/.test(e)),
    "senão a mesma nota entraria duas vezes sem ninguém notar");
});

teste("número de pedido com letra continua comparando como antes", () => {
  assert.strictEqual(modulo.chaveDoDocumento("136560-109"), "136560109");
  assert.strictEqual(modulo.chaveDoDocumento("A-0012"), "a0012", "letra não perde o zero");
});


// ── O registro da edicao conta a historia ──────────────────────
teste("o registro da edicao diz o que mudou, nao so que mudou", () => {
  const antes = { quantidade: 11, unidade: "m3", unitario: 343.64, valor: 3780.04, etapa: "fundacao" };
  const d = modulo.detalheDaEdicaoDaConta(antes, { ...antes, quantidade: 7, valor: 2405.48 });
  assert.ok(/quantidade 11 \u2192 7 m3/.test(d), d);
  assert.ok(/valor/.test(d) && /2\.405,48/.test(d), d);
  assert.ok(!/unit/.test(d), "o unitario nao mudou, nao entra no registro: " + d);
});

teste("sem mudanca nenhuma o detalhe sai vazio", () => {
  const c = { quantidade: 7, unidade: "m3", unitario: 100, valor: 700, etapa: "fundacao" };
  assert.strictEqual(modulo.detalheDaEdicaoDaConta(c, { ...c }), "");
});

teste("mudanca de etapa e de vencimento tambem ficam registradas", () => {
  const a = { valor: 700, etapa: "fundacao", vencimento: "2026-10-10" };
  const d = modulo.detalheDaEdicaoDaConta(a, { ...a, etapa: "estrutura", vencimento: "2026-11-10" });
  assert.ok(/etapa fundacao \u2192 estrutura/.test(d), d);
  assert.ok(/vencimento 2026-10-10 \u2192 2026-11-10/.test(d), d);
});

teste("valor digitado com virgula nao vira mudanca falsa", () => {
  // a tela devolve "3.780,04" como texto; o numero por tras e o mesmo
  const a = { quantidade: 11, unidade: "m3", valor: 3780.04 };
  assert.strictEqual(modulo.detalheDaEdicaoDaConta(a, { ...a, valor: "3.780,04" }), "");
});

// ── O numero de documento da parcela de contrato ───────────────
teste("a parcela de contrato nao perde o numero de documento na ressincronia", () => {
  const ct = { id: "k1", obraId: "o1", nomeContratado: "ADRIANO", tipoProfissional: "empreiteiro",
    valor: 10000, modalidade: "parcelado", parcelas: 2, periodicidade: "mensal", dataInicio: "2026-10-05" };
  const base = modulo.contasDoContrato(ct);
  assert.ok(base.length >= 2);
  // a tela numera uma vez
  const numeradas = modulo.numerarContas(base, [{ id: "o1", contasPagar: [] }], []);
  const n1 = numeradas[0].numeroDoc;
  assert.ok(n1, "a parcela tem que sair daqui com numero");
  // e a regra do contrato roda de novo, como a cada abertura da tela
  const depois = modulo.sincronizarContasDoContrato(numeradas, ct);
  const mesma = depois.find(c => c.id === numeradas[0].id);
  assert.strictEqual(mesma.numeroDoc, n1, "o numero nao pode mudar a cada abertura da tela");
});

teste("ja numerada, a lista nao consome numero novo", () => {
  const ct = { id: "k1", obraId: "o1", nomeContratado: "ADRIANO", tipoProfissional: "empreiteiro",
    valor: 10000, modalidade: "parcelado", parcelas: 2, periodicidade: "mensal", dataInicio: "2026-10-05" };
  const numeradas = modulo.numerarContas(modulo.contasDoContrato(ct), [{ id: "o1", contasPagar: [] }], []);
  const dedup = modulo.sincronizarContasDoContrato(numeradas, ct)
    .filter(c => c.origem === "contrato").map(c => c.numeroDoc);
  assert.strictEqual(new Set(dedup).size, dedup.length, "dois numeros iguais quebrariam a prestacao de contas");
});

teste("parcela paga tambem guarda o numero", () => {
  const ct = { id: "k1", obraId: "o1", nomeContratado: "ADRIANO", tipoProfissional: "empreiteiro",
    valor: 10000, modalidade: "parcelado", parcelas: 2, periodicidade: "mensal", dataInicio: "2026-10-05" };
  const numeradas = modulo.numerarContas(modulo.contasDoContrato(ct), [{ id: "o1", contasPagar: [] }], []);
  const paga = numeradas.map((c, i) => i === 0 ? { ...c, pago: true, pagoEm: "2026-10-05", valorPago: c.valor } : c);
  const depois = modulo.sincronizarContasDoContrato(paga, ct);
  assert.strictEqual(depois.find(c => c.id === paga[0].id).numeroDoc, numeradas[0].numeroDoc);
});


// ── Estimado × realizado por etapa, com o orçamento da obra ────
const ORC_OBRA = { versao: 1, itens: [
  { etapa: "Fundação", subEtapa: "Brocas e baldrames", item: "Concreto", unidade: "m3", qtd: 11, preco: 343.64, total: 3780.04 },
  { etapa: "Supra estrutura e paredes", subEtapa: "Paredes", item: "Tijolo", unidade: "un", qtd: 1000, preco: 2, total: 2000 },
  { etapa: "Viga Respaldo e Laje", subEtapa: "Laje Pav 1", item: "Laje", unidade: "m2", qtd: 50, preco: 100, total: 5000 },
  { etapa: "Construção existente", subEtapa: "Parede de drywall", item: "Drywall", unidade: "m2", qtd: 10, preco: 50, total: 500 },
] };

teste("o orcado por etapa sai do orcamento, traduzido para os ids da obra", () => {
  const por = modulo.estimativaPorEtapaDoOrcamento(ORC_OBRA);
  assert.strictEqual(por.fundacao, 3780.04);
  assert.strictEqual(por.supra_paredes_1, 2000);
  assert.strictEqual(por.laje_2, 5000, "'Pav 1' da planilha e o pavimento de cima");
  assert.strictEqual(por[""], 500, "o que nao traduz aparece como sem etapa, nao some");
});

teste("sem total gravado, o orcado sai de qtd x preco", () => {
  const por = modulo.estimativaPorEtapaDoOrcamento({ itens: [
    { etapa: "Fundação", item: "Concreto", qtd: 10, preco: 50 }] });
  assert.strictEqual(por.fundacao, 500);
});

teste("o quadro por etapa poe orcado e realizado lado a lado", () => {
  const contas = [
    { id: "c1", contaId: "material", etapa: "fundacao", valor: 2405.48, valorPago: 2405.48, pago: true },
    { id: "c2", contaId: "material", etapa: "supra_paredes_1", valor: 2500, valorPago: 2500, pago: true },
  ];
  const r = modulo.plPorEtapa([], contas, { orcamento: ORC_OBRA });
  assert.strictEqual(r.temOrcamento, true);
  const por = {};
  for (const l of r.linhas) por[l.etapaId] = l;
  assert.strictEqual(por.fundacao.orcado, 3780.04);
  assert.strictEqual(por.fundacao.realizado, 2405.48);
  assert.strictEqual(por.fundacao.saldoOrcado, 1374.56, "gastou menos do que orcou");
  assert.strictEqual(por.supra_paredes_1.saldoOrcado, -500, "esta e a etapa que estourou");
  assert.ok(por.laje_2, "etapa orcada e ainda nao gasta aparece");
  assert.strictEqual(por.laje_2.realizado, 0);
});

teste("sem orcamento, o quadro por etapa continua exatamente como era", () => {
  const contas = [{ id: "c1", contaId: "material", etapa: "fundacao", valor: 100, valorPago: 100, pago: true }];
  const r = modulo.plPorEtapa([{ contaId: "material", etapaId: "fundacao", valor: 150 }], contas, {});
  assert.strictEqual(r.temOrcamento, false);
  assert.strictEqual(r.orcado, null);
  assert.strictEqual(r.linhas[0].orcado, null);
  assert.strictEqual(r.linhas[0].estimado, 150);
  assert.strictEqual(r.linhas[0].saldo, 50);
});

teste("orcado e estimado nao se somam — sao duas contas do mesmo gasto", () => {
  const contas = [];
  const est = [{ contaId: "material", etapaId: "", valor: 11280.04 }];
  const r = modulo.plPorEtapa(est, contas, { orcamento: ORC_OBRA });
  assert.strictEqual(r.estimado, 11280.04, "o estimado do P&L fica intacto");
  assert.strictEqual(r.orcado, 11280.04, "e o orcamento soma o dele, na coluna dele");
  const linhaSem = r.linhas.find(l => l.etapaId === "");
  assert.strictEqual(linhaSem.estimado, 11280.04);
  assert.strictEqual(linhaSem.orcado, 500, "so o que o orcamento nao soube classificar");
});


// ── A corrente: orcamento → catalogo → compra → pagamento ──────
const INS_CAT = [
  { codigo: "CON-001", nome: "Concreto FCK25", unidade: "m3", grupo: "Concreto", etapaPadrao: "fundacao" },
  { codigo: "ACO-8",   nome: "Vergalhão 8mm",  unidade: "br", grupo: "Aço",      etapaPadrao: "fundacao" },
];
const ORC_LIG = { itens: [
  { etapa: "Fundação", item: "Concreto FCK25", insumoCodigo: "CON-001", unidade: "m3", qtd: 11, preco: 343.64, total: 3780.04 },
  { etapa: "Fundação", item: "Vergalhão 8mm",  insumoCodigo: "ACO-8",   unidade: "br", qtd: 40, preco: 12.14, total: 485.60 },
  { etapa: "Fundação", item: "Arame que ninguem cadastrou", unidade: "kg", qtd: 5, preco: 20, total: 100 },
] };
const CONTAS_LIG = [
  { id: "a", contaId: "material", insumoCodigo: "CON-001", etapa: "fundacao", numeroDoc: "0001",
    quantidade: 7, unidade: "m3", valor: 2405.48, valorPago: 2405.48, pago: true, pagoEm: "2026-10-05" },
  { id: "b", contaId: "material", insumoCodigo: "ACO-8", etapa: "fundacao", numeroDoc: "0002",
    quantidade: 40, unidade: "br", valor: 485.60, valorPago: 485.60, pago: true, pagoEm: "2026-10-06" },
  { id: "c", contaId: "material", descricao: "Caçamba", numeroDoc: "0003",
    valor: 300, valorPago: 300, pago: true, pagoEm: "2026-10-07" },
];

teste("por insumo: o confronto que responde em m3, nao so em reais", () => {
  const r = modulo.plPorInsumo(ORC_LIG, CONTAS_LIG, INS_CAT);
  const concreto = r.find(x => x.insumoCodigo === "CON-001");
  assert.strictEqual(concreto.nome, "Concreto FCK25");
  assert.strictEqual(concreto.qtdOrcada, 11);
  assert.strictEqual(concreto.qtdRealizada, 7, "consumiu menos do que orcou");
  assert.strictEqual(concreto.saldoQtd, 4);
  assert.strictEqual(concreto.orcado, 3780.04);
  assert.strictEqual(concreto.realizado, 2405.48);
  assert.strictEqual(concreto.unidade, "m3");
  assert.strictEqual(concreto.grupo, "Concreto");
});

teste("linha de orcamento sem codigo nao entra no confronto por insumo", () => {
  const r = modulo.plPorInsumo(ORC_LIG, CONTAS_LIG, INS_CAT);
  assert.strictEqual(r.length, 2, "o arame nao cadastrado nao vira linha fantasma");
  assert.ok(!r.some(x => !x.insumoCodigo));
});

teste("a conferencia aponta onde a corrente arrebenta, com quantos e quanto", () => {
  const obra = { id: "o1", clienteId: "c1", orcamento: ORC_LIG, contasPagar: CONTAS_LIG };
  const c = modulo.conferenciaDaLigacao(obra, INS_CAT);
  assert.strictEqual(c.ok, false);
  const por = {};
  for (const f of c.furos) por[f.titulo] = f;
  assert.strictEqual(por["Orçamento sem item do catálogo"].quantos, 1);
  assert.strictEqual(por["Orçamento sem item do catálogo"].valor, 100);
  assert.strictEqual(por["Pagamento sem etapa"].quantos, 1, "a caçamba");
  assert.strictEqual(por["Pagamento sem etapa"].valor, 300);
  assert.strictEqual(por["Material sem item do catálogo"].quantos, 1);
  assert.ok(!por["Transação sem número de referência"], "todas tem numero aqui");
});

teste("o quanto da obra e rastreavel ate o item orcado", () => {
  const obra = { id: "o1", clienteId: "c1", orcamento: ORC_LIG, contasPagar: CONTAS_LIG };
  const c = modulo.conferenciaDaLigacao(obra, INS_CAT);
  assert.strictEqual(c.totalPago, 3191.08);
  assert.strictEqual(c.ligado, 2891.08, "a caçamba nao tem insumo nem etapa");
  assert.strictEqual(c.pctLigado, 90.6);
});

teste("obra sem cliente nao chega a base nenhuma — e isso e um furo", () => {
  const c = modulo.conferenciaDaLigacao({ id: "o1", orcamento: { itens: [] }, contasPagar: [] }, INS_CAT);
  assert.ok(c.furos.some(f => /sem cliente/i.test(f.titulo)));
});

teste("corrente inteira ligada nao reclama de nada", () => {
  const c = modulo.conferenciaDaLigacao({
    id: "o1", clienteId: "c1",
    orcamento: { itens: [ORC_LIG.itens[0]] },
    contasPagar: [CONTAS_LIG[0]],
  }, INS_CAT);
  assert.strictEqual(c.ok, true, JSON.stringify(c.furos));
  assert.strictEqual(c.pctLigado, 100);
});

teste("a transacao carrega as dimensoes das tres bases", () => {
  const d = modulo.dimensoesDaConta(CONTAS_LIG[0],
    { id: "o1", nome: "Jacarezinho M1", clienteId: "c1", empreendimento: true },
    { id: "c1", nome: "Padovan" }, INS_CAT);
  assert.strictEqual(d.clienteId, "c1");
  assert.strictEqual(d.empreendimentoId, "c1", "obra do escritorio alimenta a base do empreendimento");
  assert.strictEqual(d.obraId, "o1");
  assert.strictEqual(d.insumoCodigo, "CON-001");
  assert.strictEqual(d.insumo, "Concreto FCK25");
  assert.strictEqual(d.grupoMaterial, "Concreto");
  assert.strictEqual(d.etapa, "fundacao");
  assert.strictEqual(d.competencia, "2026-10");
  assert.strictEqual(d.numeroDoc, "0001");
  assert.strictEqual(d.quantidade, 7);
});

teste("obra de cliente nao vira empreendimento do escritorio", () => {
  const d = modulo.dimensoesDaConta(CONTAS_LIG[0], { id: "o1", clienteId: "c1" }, { id: "c1", nome: "COBOP" }, INS_CAT);
  assert.strictEqual(d.empreendimentoId, "", "senao a obra do cliente entraria no resultado do escritorio");
});

teste("grupo: um vocabulario so, traduzindo o que ficou gravado antes", () => {
  assert.strictEqual(modulo.grupoCanonico("Louças"), "Louças e metais");
  assert.strictEqual(modulo.grupoCanonico("Metais"), "Louças e metais");
  assert.strictEqual(modulo.grupoCanonico("Tubulação PVC"), "Hidráulica");
  assert.strictEqual(modulo.grupoCanonico("locacao de ferramentas"), "Locação de equipamentos");
  assert.strictEqual(modulo.grupoCanonico("FORROS"), "Forros e gesso", "a caixa nao pode importar");
  assert.strictEqual(modulo.grupoCanonico("Cimento"), "Cimento", "o que ja esta certo passa reto");
  assert.strictEqual(modulo.grupoCanonico("Grupo novo que inventaram"), "Grupo novo que inventaram",
    "nao se joga fora informacao que nao se entende");
  assert.strictEqual(modulo.grupoCanonico(""), "");
});

teste("o quadro por grupo soma Loucas com Metais numa linha so", () => {
  const itens = [{ contaId: "material", grupoMaterial: "Louças", valor: 100 }];
  const contas = [{ contaId: "material", grupoMaterial: "Metais", valor: 60, valorPago: 60, pago: true }];
  const sub = modulo.subcontasDaConta(itens, contas, "material", {});
  assert.strictEqual(sub.length, 1, "antes eram duas linhas que nunca se encontravam");
  assert.strictEqual(sub[0].nome, "Louças e metais");
  assert.strictEqual(sub[0].estimado, 100);
  assert.strictEqual(sub[0].realizado, 60);
});

teste("o grupo vem do catalogo; o gravado e so reserva", () => {
  const ins = { codigo: "X", grupo: "Louças e metais" };
  assert.strictEqual(modulo.grupoDoItem(ins, "Tintas"), "Louças e metais", "o catalogo manda");
  assert.strictEqual(modulo.grupoDoItem(null, "Metais"), "Louças e metais", "sem catalogo, traduz o gravado");
  assert.strictEqual(modulo.grupoDoItem(null, ""), "");
});

teste("compra parcelada no boleto leva a etapa da cotacao para cada parcela", () => {
  const contas = modulo.contasDaCotacao({ cotacaoId: "c1", obraId: "o1", contaId: "material", etapaId: "fundacao",
    descricao: "Concreto", valor: 3000, parcelas: 3, primeiroVencimento: "2026-10-10", modo: "parcelas" },
    (() => { let i = 0; return () => "x" + (++i); })());
  assert.strictEqual(contas.length, 3);
  assert.ok(contas.every(c => c.etapa === "fundacao"), JSON.stringify(contas.map(c => c.etapa)));
});

teste("parcela de contrato leva a etapa quando o contrato e de uma etapa so", () => {
  const ct = { id: "k1", obraId: "o1", nomeContratado: "Paulo Serralheiro", tipoProfissional: "serralheiro",
    valor: 3000, modalidade: "parcelado", parcelas: 2, periodicidade: "mensal", dataInicio: "2026-10-05",
    etapa: "portoes" };
  assert.ok(modulo.contasDoContrato(ct).every(c => c.etapa === "portoes"));
  const civil = { ...ct, etapa: "" };
  assert.ok(modulo.contasDoContrato(civil).every(c => c.etapa === ""), "obra civil fica em branco");
});

teste("a conferencia nao chama de furo o que a regra dispensa", () => {
  const obra = { id: "o1", clienteId: "c1", orcamento: { itens: [] }, contasPagar: [
    { id: "t", contaId: "tarifas_bancarias", valor: 35, valorPago: 35, pago: true, pagoEm: "2026-10-01", numeroDoc: "1" },
    { id: "f", contaId: "frete", etapa: "fundacao", valor: 350, valorPago: 350, pago: true, pagoEm: "2026-10-01", numeroDoc: "2" },
    { id: "k", contaId: "empreiteiro", origem: "contrato", valor: 9142.86, valorPago: 9142.86, pago: true, pagoEm: "2026-10-09", numeroDoc: "3" },
  ] };
  const c = modulo.conferenciaDaLigacao(obra, []);
  assert.ok(!c.furos.some(f => /sem etapa/.test(f.titulo)), JSON.stringify(c.furos.map(f => f.titulo)));
  assert.ok(!c.furos.some(f => /sem item/.test(f.titulo)), "frete nao tem item");
});

teste("o mesmo papel nao entra duas vezes: chave da nota ou ID do Pix", () => {
  const chave = "35260912345678000190550010000086231000008623";
  const contas = modulo.contasDaEntrada({ situacao: "pago", pagamento: { data: "2026-09-29" },
    chaveNota: "3526 0912 3456 7800 0190 5500 1000 0086 2310 0000 8623", idTransacao: "e00000000202609291530abcdefgh1234",
    itens: [{ descricao: "Cimento", quantidade: 8, total: 304, contaId: "material" }] }, { obraId: "o1", numeroDoc: "0200" });
  assert.strictEqual(contas[0].chaveNota, chave);
  assert.strictEqual(contas[0].idTransacao, "E00000000202609291530ABCDEFGH1234");
  const obras = [{ id: "o0", nome: "Outra", contasPagar: [] }, { id: "o1", nome: "Jacarezinho M1", contasPagar: contas }];
  const porChave = modulo.papelJaLancado(obras, { chaveNota: chave });
  assert.deepStrictEqual(porChave, { obraId: "o1", obraNome: "Jacarezinho M1", ref: "0200", por: "chave" });
  const porPix = modulo.papelJaLancado(obras, { idTransacao: "E00000000202609291530abcdEFGH1234" });
  assert.strictEqual(porPix.por, "pix");
  assert.strictEqual(modulo.papelJaLancado(obras, { chaveNota: "123" }), null, "chave incompleta nao trava nada");
  assert.strictEqual(modulo.papelJaLancado(obras, {}), null);
  assert.strictEqual(modulo.papelJaLancado([{ id: "x", contasPagar: [{ chaveNota: "" }] }], { chaveNota: "" }), null);
});

// ── Papéis em lote ──
const CONTAS_LOTE = [
  { id: "a", numeroDoc: "0049", valor: 2541, pago: true, pagoEm: "2026-07-08", favorecido: "Pantanal Aço", descricao: "Formas" },
  { id: "b", numeroDoc: "0056", valor: 12.8, pago: true, pagoEm: "2026-07-14", favorecido: "Pedágio Jacarezinho" },
  { id: "c", numeroDoc: "0057", valor: 12.8, pago: true, pagoEm: "2026-07-14", favorecido: "Pedágio Jacarezinho" },
  { id: "d1", numeroDoc: "0105", valor: 315, pago: true, pagoEm: "2026-09-22", favorecido: "CONSTRU FACIL ACABAMENTO LTDA" },
  { id: "d2", numeroDoc: "0106", valor: 528, pago: true, pagoEm: "2026-09-22", favorecido: "CONSTRU FACIL ACABAMENTO LTDA" },
  { id: "d3", numeroDoc: "0107", valor: 26.8, pago: true, pagoEm: "2026-09-22", favorecido: "CONSTRU FACIL ACABAMENTO LTDA" },
  { id: "e1", numeroDoc: "0173", pedidoId: "p", valor: 260, pago: true, pagoEm: "2026-09-29", prestadorId: "rc", numeroNota: "8623", chaveNota: "4".repeat(44) },
  { id: "e2", numeroDoc: "0173", pedidoId: "p", valor: 44, pago: true, pagoEm: "2026-09-29", prestadorId: "rc", numeroNota: "8623" },
];
const GRUPOS_LOTE = modulo.gruposDeContasPorRef(CONTAS_LOTE, [{ id: "rc", nome: "Rei do Cimento" }]);

teste("lote: as contas se juntam pela referencia", () => {
  const g = GRUPOS_LOTE.find((x) => x.ref === "0173");
  assert.strictEqual(g.valor, 304);
  assert.deepStrictEqual(g.contaIds, ["e1", "e2"]);
  assert.strictEqual(g.favorecido, "Rei do Cimento");
});

teste("lote: valor unico e fornecedor parecido e casamento seguro", () => {
  const r = modulo.casarPapelComContas({ tipo: "comprovante", valor: 2541, pagoEm: "2026-07-22", lidoComo: "PANTANAL SOLUÇÕES EM FERRO" }, GRUPOS_LOTE);
  assert.strictEqual(r.seguro, true);
  assert.deepStrictEqual(r.candidatos[0].refs, ["0049"]);
});

teste("lote: chave da nota igual encerra a conversa", () => {
  const r = modulo.casarPapelComContas({ tipo: "nota", valor: 999, chave: "4".repeat(44) }, GRUPOS_LOTE);
  assert.strictEqual(r.seguro, true);
  assert.deepStrictEqual(r.candidatos[0].refs, ["0173"]);
});

teste("lote: nota dividida em etapas casa com a soma das refs seguidas", () => {
  const r = modulo.casarPapelComContas({ tipo: "nota", valor: 869.8, pagoEm: "2026-08-18", lidoComo: "CONSTRU FACIL ACABAMENTO" }, GRUPOS_LOTE);
  assert.deepStrictEqual(r.candidatos[0].refs, ["0105", "0106", "0107"]);
});

teste("lote: pedagios iguais empatam e nao vao marcados; cada um ganha uma conta", () => {
  const p1 = { tipo: "comprovante", valor: 12.8, pagoEm: "2026-07-04", lidoComo: "EPR LITORAL PIONEIRO" };
  const lidos = [p1, { ...p1 }].map((papel) => ({ papel, casamento: modulo.casarPapelComContas(papel, GRUPOS_LOTE) }));
  assert.strictEqual(lidos[0].casamento.seguro, false);
  assert.strictEqual(lidos[0].casamento.empate, true);
  const d = modulo.distribuirPapeisDoLote(lidos);
  assert.notStrictEqual(d[0].escolhido.refs[0], d[1].escolhido.refs[0]);
  assert.strictEqual(d[0].marcado, false);
});

teste("lote: nota e comprovante da mesma compra vao para a mesma conta", () => {
  const nota = { tipo: "nota", valor: 2541, lidoComo: "Pantanal" }, pix = { tipo: "comprovante", valor: 2541, lidoComo: "Pantanal" };
  const lidos = [nota, pix].map((papel) => ({ papel, casamento: modulo.casarPapelComContas(papel, GRUPOS_LOTE) }));
  const d = modulo.distribuirPapeisDoLote(lidos);
  assert.deepStrictEqual(d[0].escolhido.refs, ["0049"]);
  assert.deepStrictEqual(d[1].escolhido.refs, ["0049"]);
  const dois = modulo.distribuirPapeisDoLote([lidos[1], { ...lidos[1] }]);
  assert.strictEqual(dois[1].escolhido, null, "dois comprovantes do mesmo valor nao disputam a mesma conta");
});

teste("lote: sem valor parecido nao ha candidato", () => {
  const r = modulo.casarPapelComContas({ valor: 7206, lidoComo: "Daniel Tonet" }, GRUPOS_LOTE);
  assert.strictEqual(r.candidatos.length, 0);
  assert.strictEqual(r.seguro, false);
});

teste("lote: planilha de ligacao arquivo;ref", () => {
  const m = modulo.ligacaoDoCsv("arquivo;ref\n4113;0062+0063+0064\r\n4209,166\n\nlixo\n3274\t0001");
  assert.deepStrictEqual(m.get("4113"), ["0062", "0063", "0064"]);
  assert.deepStrictEqual(m.get("4209"), ["0166"]);
  assert.deepStrictEqual(m.get("3274"), ["0001"]);
  assert.strictEqual(m.size, 3);
  assert.strictEqual(modulo.numeroDoArquivo("4113 - nota.pdf"), "4113");
  assert.strictEqual(modulo.numeroDoArquivo("04113.pdf"), "4113");
  assert.strictEqual(modulo.numeroDoArquivo("nota.pdf"), "");
});

teste("procurar contas: ref, fornecedor, valor, papel e filtros", () => {
  const cs = [
    { id: "1", numeroDoc: "0049", descricao: "Formas metálicas", favorecido: "Pantanal Aço", valor: 2541, contaId: "material", etapa: "fundacao", anexos: [{ nome: "4096.pdf" }] },
    { id: "2", numeroDoc: "0056", descricao: "Pedágio", favorecido: "Pedágio Jacarezinho", valor: 12.8, contaId: "outros", etapa: "" },
    { id: "3", numeroDoc: "0173", descricao: "AREIA FINA", prestadorId: "rc", valor: 260, contaId: "material", etapa: "fundacao", numeroNota: "8623", comprovante: { nome: "nf.pdf" } },
  ];
  const op = { nomePrestador: (id) => (id === "rc" ? "Rei do Cimento" : ""), nomeConta: (id) => (id === "material" ? "Material" : "Outros") };
  const ids = (f) => modulo.buscarContas(cs, f, op).map((c) => c.id).join(",");
  assert.strictEqual(ids({ texto: "0049" }), "1");
  assert.strictEqual(ids({ texto: "pantanal aco" }), "1", "sem acento casa");
  assert.strictEqual(ids({ texto: "12,80" }), "2");
  assert.strictEqual(ids({ texto: "2.541,00" }), "1");
  assert.strictEqual(ids({ texto: "4096" }), "1", "pelo nome do papel");
  assert.strictEqual(ids({ texto: "rei cimento" }), "3", "pelo nome do prestador");
  assert.strictEqual(ids({ texto: "8623" }), "3");
  assert.strictEqual(ids({ texto: "reidocimento" }), "3", "nome colado tambem acha");
  assert.strictEqual(ids({ papel: "sem" }), "2");
  assert.strictEqual(ids({ papel: "com" }), "1,3");
  assert.strictEqual(ids({ contaId: "material", texto: "fundacao" }), "", "etapa so por id, nao por texto sem nomeEtapa");
  assert.strictEqual(ids({ contaId: "material", etapa: "fundacao" }), "1,3");
  assert.strictEqual(ids({}), "1,2,3");
  assert.strictEqual(modulo.temPapel(cs[1]), false);
});

console.log(`\n${passou} passou, ${falhou} falhou`);
if (falhou) process.exit(1);
