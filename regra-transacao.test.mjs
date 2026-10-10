// A regra única da transação: o que todo lançamento precisa carregar.
// Roda com: node regra-transacao.test.mjs
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mod = (nome) => readFileSync(join(__dirname, "src", "modules", nome), "utf-8");
const M = new Function(`
  function numeroDeCampo(v) {
    if (typeof v === "number") return v;
    const n = parseFloat(String(v == null ? "" : v).replace(/\\./g, "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  }
  ${mod("obra-financeiro.jsx")}
  return { exigenciasDaTransacao, faltasDaTransacao, frasesDasFaltas, comPadraoDoInsumo, ligarAoCatalogo, ligarObrasAoCatalogo };
`)();

let passou = 0, falhou = 0;
function teste(nome, fn) {
  try { fn(); passou++; console.log(`  ok   ${nome}`); }
  catch (e) { falhou++; console.log(`FALHOU ${nome}`); console.log(`       ${e.message}`); }
}
const base = { obraId: "o1", valor: 100, vencimento: "2026-10-01" };

teste("material pede item, quantidade, etapa e fornecedor", () => {
  const f = M.faltasDaTransacao({ ...base, contaId: "material" });
  assert.deepStrictEqual(f, ["o fornecedor", "o item do catálogo", "a quantidade", "a etapa"]);
});

teste("material completo passa", () => {
  const f = M.faltasDaTransacao({ ...base, contaId: "material", favorecido: "Votorantim",
    insumoCodigo: "CON-001", quantidade: 7, etapa: "fundacao" });
  assert.deepStrictEqual(f, []);
});

teste("pago exige a forma de pagamento — e a que diz se atravessa agora ou na fatura", () => {
  const ok = { ...base, contaId: "material", favorecido: "V", insumoCodigo: "C", quantidade: 1, etapa: "fundacao" };
  assert.deepStrictEqual(M.faltasDaTransacao({ ...ok, pago: true, pagoEm: "2026-10-01" }), ["a forma de pagamento"]);
  assert.deepStrictEqual(M.faltasDaTransacao({ ...ok, pago: true, pagoEm: "2026-10-01", formaPagamento: "cartao" }), []);
});

teste("frete e agua sao custo de material sem item — nao ha o que contar", () => {
  for (const contaId of ["frete", "agua", "aluguel_equip", "terraplanagem"]) {
    const f = M.faltasDaTransacao({ ...base, contaId, favorecido: "X", etapa: "fundacao" });
    assert.deepStrictEqual(f, [], contaId);
  }
});

teste("mao de obra pede etapa e fornecedor, nao item", () => {
  assert.deepStrictEqual(M.faltasDaTransacao({ ...base, contaId: "empreiteiro" }), ["o fornecedor", "a etapa"]);
});

teste("receita nao pede etapa, fornecedor nem forma", () => {
  const f = M.faltasDaTransacao({ ...base, contaId: "venda_imovel", pago: true, pagoEm: "2026-10-01" });
  assert.deepStrictEqual(f, []);
});

teste("terreno pede fornecedor, nao etapa", () => {
  assert.deepStrictEqual(M.faltasDaTransacao({ ...base, contaId: "terreno_aquisicao" }), ["o fornecedor"]);
});

teste("tributo e tarifa nao sao de etapa nenhuma", () => {
  for (const contaId of ["iss", "inss", "tarifas_bancarias", "impostos"]) {
    const f = M.faltasDaTransacao({ ...base, contaId, favorecido: "Prefeitura" });
    assert.deepStrictEqual(f, [], contaId);
  }
});

teste("parcela de contrato sem etapa passa — o contrato de obra civil atravessa a obra inteira", () => {
  const f = M.faltasDaTransacao({ ...base, contaId: "empreiteiro", origem: "contrato", favorecido: "Adriano" });
  assert.deepStrictEqual(f, []);
  // mas se o contrato diz a etapa, a parcela leva
  const e = M.exigenciasDaTransacao({ contaId: "empreiteiro", origem: "contrato", etapa: "fundacao" });
  assert.strictEqual(e.etapa, true);
});

teste("o basico sempre: obra, conta, valor, data", () => {
  assert.deepStrictEqual(M.faltasDaTransacao({}), ["a obra", "a conta contábil", "o valor", "a data"]);
});

teste("valor digitado com virgula conta como valor", () => {
  const f = M.faltasDaTransacao({ obraId: "o1", contaId: "venda_imovel", valor: "5.326,88", vencimento: "2026-10-01" });
  assert.deepStrictEqual(f, []);
});

teste("parcela de compra parcelada no boleto nao pede item — o consumo foi um so", () => {
  const f = M.faltasDaTransacao({ ...base, contaId: "material", favorecido: "V", etapa: "fundacao",
    parcela: 2, parcelasTotal: 3 });
  assert.deepStrictEqual(f, [], "senao 11 m3 virariam 33");
  // mas a etapa continua sendo pedida
  assert.deepStrictEqual(M.faltasDaTransacao({ ...base, contaId: "material", favorecido: "V", parcelasTotal: 3 }),
    ["a etapa"]);
});

teste("a frase que a tela mostra", () => {
  assert.strictEqual(M.frasesDasFaltas([]), "");
  assert.strictEqual(M.frasesDasFaltas(["a etapa"]), "Falta a etapa.");
  assert.strictEqual(M.frasesDasFaltas(["o item do catálogo", "a quantidade", "a etapa"]),
    "Falta o item do catálogo, a quantidade e a etapa.");
});

const CAT = [{ codigo: "CIM-1", nome: "Cimento", etapaPadrao: "alvenaria", grupo: "Cimento e argamassa" },
  { id: "DSC-1", nome: "Disco de corte", etapaPadrao: "ferramentas", grupo: "Ferramentas" },
  { codigo: "SEM-1", nome: "Sem etapa", grupo: "Diversos" }];

teste("item do catalogo traz etapa e grupo, so no que esta em branco", () => {
  const a = M.comPadraoDoInsumo({ insumoCodigo: "CIM-1", etapa: "", grupoMaterial: "" }, CAT);
  assert.strictEqual(a.etapa, "alvenaria");
  assert.strictEqual(a.grupoMaterial, "Cimento e argamassa");
  const b = M.comPadraoDoInsumo({ insumoCodigo: "DSC-1", etapa: "fundacao" }, CAT);
  assert.strictEqual(b.etapa, "fundacao", "a etapa escolhida na compra manda");
  assert.strictEqual(b.grupoMaterial, "Ferramentas");
  const c = M.comPadraoDoInsumo({ insumoCodigo: "SEM-1", etapa: "" }, CAT);
  assert.strictEqual(c.etapa, "", "catalogo sem etapa nao inventa etapa");
  const d = { insumoCodigo: "NAO-EXISTE", etapa: "" };
  assert.strictEqual(M.comPadraoDoInsumo(d, CAT), d);
  // mao de obra sem insumo cai na regra da conta
  assert.strictEqual(M.ligarAoCatalogo({ contaId: "empreiteiro", etapa: "" }, CAT).etapa, "prestadores");
});

teste("na gravacao, so a conta nova ou mexida e ligada; obra parada nao muda", () => {
  const velha = { id: "v", insumoCodigo: "CIM-1", etapa: "", valor: 10 };
  const o1 = { id: "o1", contasPagar: [velha] };
  const o2 = { id: "o2", contasPagar: [{ id: "x", insumoCodigo: "CIM-1", etapa: "" }] };
  const antigas = [o1, o2];
  const nova = { id: "n", insumoCodigo: "CIM-1", etapa: "", valor: 20 };
  const novas = [{ ...o1, contasPagar: [velha, nova] }, o2];
  const r = M.ligarObrasAoCatalogo(novas, antigas, CAT);
  assert.strictEqual(r[1], o2, "obra que nao mudou nao e tocada");
  assert.strictEqual(r[0].contasPagar[0], velha, "conta antiga intacta");
  assert.strictEqual(r[0].contasPagar[1].etapa, "alvenaria");
  // nada a ligar: devolve a mesma lista
  const iguais = [{ ...o1, contasPagar: [velha, { id: "m", contaId: "material", etapa: "fundacao" }] }];
  assert.strictEqual(M.ligarObrasAoCatalogo(iguais, antigas, CAT), iguais);
});

console.log(`\n${passou} passou, ${falhou} falhou`);
if (falhou) process.exit(1);
