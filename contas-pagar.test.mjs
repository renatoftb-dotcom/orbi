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

const modulo = new Function(`
  var uid = () => "id1";
  ${plano}
  ${contratosSrc.slice(0, corte)}
  ${mod("contas-pagar.jsx")}
  return { PLANO_CONTAS, contratoVazio, valorContrato,
           parcelasAPagar, contasDoContrato, sincronizarContasDoContrato, removerContasDoContrato,
           situacaoConta, totaisContas, realizadoPorConta, realizadoPorPrestador,
           contaDoTipo, contaAvulsaVazia, somarDias, somarMeses, vencimentoFinal, medicoesPrevistas };
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
  // "mensais" anda de 30 em 30 dias, como diz a cláusula de pagamento
  assert.strictEqual(l[5].vencimento, "2027-02-28");
  assert.ok(l[0].descricao.includes("1/6") && l[0].descricao.includes("mensal"));
  // quinzenal anda de 15 em 15
  const q = modulo.parcelasAPagar({ ...c, periodicidade: "quinzenais" });
  assert.strictEqual(q[0].vencimento, "2026-09-16");
  assert.strictEqual(q[1].vencimento, "2026-10-01");
  // semanal, de 7 em 7
  assert.strictEqual(modulo.parcelasAPagar({ ...c, periodicidade: "semanais" })[0].vencimento, "2026-09-08");
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
  assert.strictEqual(l[1].vencimento, "2026-10-31", "as parcelas contam do início da obra");
  assert.strictEqual(soma(l), 100000);
});

teste("entrada + saldo no final: contrato todo ou item a item", () => {
  const todo = modulo.parcelasAPagar(base({ modelo: "empreitadaGlobal", valor: 50000, modalidade: "entradaFinal",
    entradaEscopo: "contrato", entradaPct: 40, dataAssinatura: "2026-09-07", dataInicio: "2026-09-10",
    prazoQtd: 3, prazoUnidade: "meses" }));
  assert.deepStrictEqual(todo.map(x => x.valor), [20000, 30000]);
  assert.strictEqual(todo[0].vencimento, "2026-09-07");
  assert.strictEqual(todo[1].vencimento, "2026-12-10", "o saldo vence no fim do prazo");

  // item a item: duas contas por item, sem data (dependem da liberação)
  const porItem = modulo.parcelasAPagar(base({ modelo: "empreitadaGlobal", modalidade: "entradaFinal",
    entradaEscopo: "item", entradaPct: 50, itens: [{ descricao: "Portão", valor: 60000 }, { descricao: "Vitrine", valor: 40000 }] }));
  assert.strictEqual(porItem.length, 4);
  assert.strictEqual(soma(porItem), 100000);
  assert.ok(porItem[0].descricao.startsWith("Portão — entrada"));
  assert.strictEqual(porItem[0].valor, 30000);
  assert.strictEqual(porItem[0].vencimento, "");
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
  assert.strictEqual(modulo.contaDoTipo("gestaoObra"), "mo_diversos");
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

console.log(`\n${passou} passou, ${falhou} falhou`);
if (falhou) process.exit(1);
