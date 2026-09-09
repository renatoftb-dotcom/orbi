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
  return { PLANO_CONTAS, contratoVazio, valorContrato,
           parcelasAPagar, contasDoContrato, sincronizarContasDoContrato, removerContasDoContrato,
           situacaoConta, totaisContas, realizadoPorConta, realizadoPorPrestador,
           contaDoTipo, contaAvulsaVazia, somarDias, somarMeses, vencimentoFinal, medicoesPrevistas,
           tituloConta, detalheConta, agruparContas, filtrarContas, rotuloMes,
           VISOES_CONTAS, FILTROS_CONTAS, FILTRO_CONTAS_PADRAO, seriesDoFiltro,
           sincronizarContasDaObra, contasDesatualizadas, somarDias, contasDoContrato,
           extratoMensal, mesesDoExtrato, acumuladoAte, entradaObraVazia, mesDe,
           extratoMatriz, estimativaPorConta,
           GRUPOS_PL, linhasEstimativaPL, definirEstimativaDaConta, totaisEstimativaPL,
           itemDeQuadro, itensDetalhados, EST_ORIGEM_QUADRO,
           recalibrarContrato, previaRecalibragem, primeiroVencimentoContrato,
           contratoPorItem, recalibrarItens, datasDosItens, previaEntreContratos,
           tituloCurtoConta, apoioCurtoConta, tituloConta, detalheConta,
           proximoNumeroContrato, servicoDoContrato, fluxoMensal };
`)();

let passou = 0, falhou = 0;
function teste(nome, fn) {
  try { fn(); passou++; console.log(`  ok  ${nome}`); }
  catch (e) { falhou++; console.log(`FALHOU  ${nome}`); console.log(`        ${e.message}`); }
}
const base = (extra) => ({ ...modulo.contratoVazio(null, "c1", "o1", "empreiteiro", "maoDeObra"), obraId: "o1", prestadorId: "p1", nomeContratado: "Zé Empreiteiro", ...extra });
const soma = (linhas) => Math.round(linhas.reduce((a, l) => a + l.valor, 0) * 100) / 100;

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

console.log(`\n${passou} passou, ${falhou} falhou`);
if (falhou) process.exit(1);
