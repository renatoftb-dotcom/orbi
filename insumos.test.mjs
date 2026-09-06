// Testes do módulo de Insumos — node puro, sem framework.
//   node insumos.test.mjs
//
// Carrega só a parte pura de src/modules/insumos.jsx (tudo antes do bloco UI),
// que é JavaScript comum, sem JSX e sem React.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const raiz = dirname(fileURLToPath(import.meta.url));
const MODULES = join(raiz, "src", "modules");

const seedSrc = readFileSync(join(MODULES, "insumos-seed.jsx"), "utf8");
const modSrc = readFileSync(join(MODULES, "insumos.jsx"), "utf8");

const MARCA = "// UI";
const corte = modSrc.indexOf(MARCA);
if (corte < 0) throw new Error("Marcador de início da UI não encontrado em insumos.jsx");
const puro = modSrc.slice(0, corte);

let _n = 0;
const shim = `var uid = () => "id" + (++__c);\nvar __c = 0;\n`;

const api = new Function(
  shim + seedSrc + "\n" + puro + `
  return { INSUMOS_SEED, INSUMO_GRUPOS, normalizarTexto, similaridadeTexto,
           resolverInsumo, proximoCodigoInsumo, grupoInferido, prefixoDoGrupo,
           mesesEntre, fatorIncc, precoInsumo, atualizarPrecoReferencia,
           migrarMateriaisParaInsumos, semearInsumos };`
)();

// ── mini runner ──────────────────────────────────────────────
let ok = 0, falhas = [];
function t(nome, fn) {
  try { fn(); ok++; }
  catch (e) { falhas.push(nome + "\n    " + e.message); }
}
function eq(a, b, msg) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error((msg || "") + " esperado " + sb + ", veio " + sa);
}
function assert(c, msg) { if (!c) throw new Error(msg || "falhou"); }

const {
  INSUMOS_SEED, normalizarTexto, resolverInsumo, proximoCodigoInsumo,
  fatorIncc, precoInsumo, atualizarPrecoReferencia,
  migrarMateriaisParaInsumos, semearInsumos,
} = api;

const HOJE = "2026-09-05T12:00:00Z";

// ── semente ──────────────────────────────────────────────────
t("semente tem 190 insumos", () => eq(INSUMOS_SEED.length, 190));

t("todo código da semente é único", () => {
  const s = new Set(INSUMOS_SEED.map(x => x.codigo));
  eq(s.size, INSUMOS_SEED.length);
});

t("todo insumo da semente tem preço, exceto os 2 prestadores em aberto", () => {
  const semPreco = INSUMOS_SEED.filter(x => x.precoReferencia == null);
  eq(semPreco.map(x => x.nome).sort(), ["Gestão Obra", "Serralheiro"]);
});

t("semente tem 173 materiais e 17 prestadores", () => {
  eq(INSUMOS_SEED.filter(x => x.tipo === "material").length, 173);
  eq(INSUMOS_SEED.filter(x => x.tipo === "prestador").length, 17);
});

// ── normalização ─────────────────────────────────────────────
t("normalizarTexto tira acento, caixa e pontuação", () => {
  eq(normalizarTexto("Cerâmicas - Tijolo - Bloco  6 Furos"), "ceramicas tijolo bloco 6 furos");
  eq(normalizarTexto("  AREIA   FINA  "), "areia fina");
});

// ── resolução ────────────────────────────────────────────────
const catalogo = [
  { id: "a", codigo: "AGR-001", nome: "Areia Fina", grupo: "Areia e pedra", unidade: "m3", aliases: ["Areia Fina", "AREIA FINA LAVADA"] },
  { id: "b", codigo: "AGR-002", nome: "Areia Grossa", grupo: "Areia e pedra", unidade: "m3", aliases: ["Areia Grossa"] },
  { id: "c", codigo: "CIM-001", nome: "Sacos de cimento 50kg", grupo: "Cimento", unidade: "Unidades", aliases: ["Sacos de cimento 50kg"] },
];

t("resolve por código, ignorando o nome", () => {
  const r = resolverInsumo("qualquer coisa", catalogo, { codigo: "CIM-001" });
  eq(r.confianca, "codigo");
  eq(r.insumo.codigo, "CIM-001");
});

t("resolve por alias exato", () => {
  const r = resolverInsumo("AREIA FINA LAVADA", catalogo);
  eq(r.confianca, "alias");
  eq(r.insumo.codigo, "AGR-001");
});

t("resolve por nome normalizado (espaço e caixa diferentes)", () => {
  const r = resolverInsumo("  areia   FINA ", catalogo);
  assert(["alias", "normalizado"].includes(r.confianca), "confiança inesperada: " + r.confianca);
  eq(r.insumo.codigo, "AGR-001");
});

t("NÃO vincula 'Areia Fina Ensacada' a 'Areia Fina' — só sugere", () => {
  const r = resolverInsumo("Areia Fina Ensacada", catalogo);
  eq(r.insumo, null);
  eq(r.confianca, "sugestao");
  assert(r.candidatos.length > 0, "deveria trazer candidatos");
  eq(r.candidatos[0].insumo.codigo, "AGR-001");
});

t("termo sem parentesco devolve nenhum", () => {
  const r = resolverInsumo("zzz produto inexistente xpto", catalogo);
  eq(r.insumo, null);
  eq(r.confianca, "nenhum");
});

// ── código ───────────────────────────────────────────────────
t("próximo código continua o sequencial do grupo, pulando os códigos reservados pela semente", () => {
  eq(proximoCodigoInsumo("Areia e pedra", catalogo), "AGR-004"); // semente tem AGR-001..003
  eq(proximoCodigoInsumo("Cimento", catalogo), "CIM-002");
});

t("código de insumo inativado nunca é reciclado", () => {
  const comInativo = catalogo.concat([
    { id: "d", codigo: "AGR-003", nome: "Pedrisco", grupo: "Areia e pedra", ativo: false, aliases: [] },
  ]);
  eq(proximoCodigoInsumo("Areia e pedra", comInativo), "AGR-004");
});

t("grupo desconhecido cai em OUT", () => {
  eq(proximoCodigoInsumo("Grupo Que Não Existe", []), "OUT-001");
});

t("migração + semeadura sobre o cadastro legado do escritório não cruza códigos", () => {
  const legado = [
    { id: "m1", nome: "PVC - Esgoto - Tubo 100mm", unidade: "Unidades", categoria: "Tubulação PVC", ultimoPreco: 68.9 },
    { id: "m2", nome: "Elétrica - Cabo Flex Cobre 2.5mm", unidade: "Mts", categoria: "Elétrica e Iluminação", ultimoPreco: 2.35 },
    { id: "m3", nome: "Prestadores de Serviços - Eletricista", unidade: "m2", categoria: "Prestadores de Serviços", ultimoPreco: 42 },
    { id: "m4", nome: "Sacos de cimento 50kg", unidade: "Unidades", ultimoPreco: 37 },
  ];
  const mig = migrarMateriaisParaInsumos(legado);
  const r = semearInsumos(mig.materiais, INSUMOS_SEED);
  const tubo = r.materiais.find((x) => x.nome === "PVC - Esgoto - Tubo 100mm");
  const cabo = r.materiais.find((x) => x.nome === "Elétrica - Cabo Flex Cobre 2.5mm");
  assert(tubo.codigo !== "HID-001", "tubo não pode ficar com o código da torneira");
  assert(cabo.codigo !== "ELE-001", "cabo não pode ficar com o código do poste");
  eq(tubo.precoReferencia, 68.9);
  eq(cabo.precoReferencia, 2.35);
  const poste = r.materiais.find((x) => x.codigo === "ELE-001");
  eq(poste.nome, "Elétrica - Poste Padrão - Trifásica C3");
  // eletricista do cadastro casa com PRE-003 pelo alias, e não vira Pedreiros Casa
  const ele = r.materiais.find((x) => x.nome === "Prestadores de Serviços - Eletricista");
  eq(ele.codigo, "PRE-003");
  eq(r.materiais.find((x) => x.codigo === "PRE-001").nome, "Pedreiros Casa");
  // cimento legado herda CIM-001 e ganha o preço mais novo da semente
  const cim = r.materiais.find((x) => x.codigo === "CIM-001");
  eq(cim.nome, "Sacos de cimento 50kg");
  eq(cim.precoReferencia, 38);
  // nenhum código duplicado
  const cods = r.materiais.map((x) => x.codigo);
  eq(new Set(cods).size, cods.length);
});

// ── INCC e preço ─────────────────────────────────────────────
t("fator INCC de dez/2023 fica em torno de 1,19", () => {
  const f = fatorIncc("2023-12-04", HOJE);
  assert(f > 1.17 && f < 1.21, "fator fora do esperado: " + f);
});

t("preço recente com 3+ compras é confiança alta e não corrige", () => {
  const r = precoInsumo({ precoReferencia: 38, precoData: "2026-08-23", precoNCompras: 253 }, HOJE);
  eq(r.preco, 38);
  eq(r.confianca, "alta");
  eq(r.corrigido, false);
});

t("preço de dez/2023 é corrigido e marcado como baixo/obsoleto", () => {
  const r = precoInsumo({ precoReferencia: 16.78, precoData: "2023-12-04", precoNCompras: 14 }, HOJE);
  assert(r.corrigido, "deveria corrigir");
  assert(r.preco > 19 && r.preco < 21, "preço corrigido inesperado: " + r.preco);
  eq(r.confianca, "obsoleta");
});

t("preço manual vence tudo e não é corrigido", () => {
  const r = precoInsumo({ precoReferencia: 10, precoData: "2022-01-01", precoManual: 99.9 }, HOJE);
  eq(r.preco, 99.9);
  eq(r.confianca, "manual");
  eq(r.corrigido, false);
});

t("insumo sem preço devolve sem_preco", () => {
  eq(precoInsumo({ precoReferencia: null }, HOJE).confianca, "sem_preco");
});

// ── atualização por compra ───────────────────────────────────
const cimento = { codigo: "CIM-001", precoReferencia: 38, precoData: "2026-08-23", precoNCompras: 253 };

t("compra normal vira novo preço de referência", () => {
  const r = atualizarPrecoReferencia(cimento, {
    tipo: "custo", quantidade: 100, total: 4000, dataPagamento: "2026-09-01",
  });
  eq(r.precoReferencia, 40);
  eq(r.ultimoPreco, 40);
  eq(r.precoFonte, "compra");
  eq(r.precoData, "2026-09-01");
  eq(r.precoNCompras, 254);
});

t("compra 5x acima vai para precoPendente e não altera o preço", () => {
  const r = atualizarPrecoReferencia(cimento, {
    tipo: "custo", quantidade: 1, total: 190, dataPagamento: "2026-09-01",
  });
  eq(r.precoReferencia, 38);
  eq(r.precoPendente.valor, 190);
});

t("nota retroativa não rebaixa preço mais novo", () => {
  const r = atualizarPrecoReferencia(cimento, {
    tipo: "custo", quantidade: 10, total: 350, dataPagamento: "2025-01-10",
  });
  eq(r.precoReferencia, 38);
  eq(r.precoData, "2026-08-23");
});

t("preço manual nunca é sobrescrito por compra", () => {
  const m = Object.assign({}, cimento, { precoManual: 41 });
  const r = atualizarPrecoReferencia(m, { tipo: "custo", quantidade: 10, total: 390, dataPagamento: "2026-09-01" });
  eq(r.precoManual, 41);
  eq(r.precoReferencia, 38);
});

t("quantidade ou total zerado não contamina o preço", () => {
  eq(atualizarPrecoReferencia(cimento, { tipo: "custo", quantidade: 0, total: 100 }).precoReferencia, 38);
  eq(atualizarPrecoReferencia(cimento, { tipo: "custo", quantidade: 5, total: 0 }).precoReferencia, 38);
});

t("lançamento de receita não mexe em preço de insumo", () => {
  const r = atualizarPrecoReferencia(cimento, { tipo: "receita", quantidade: 1, total: 999 });
  eq(r.precoReferencia, 38);
});

// ── migração ─────────────────────────────────────────────────
t("material legado sem código ganha código, aliases e preço", () => {
  const legado = [{ id: "x1", nome: "Sacos de cimento 50kg", unidade: "Unidades", ultimoPreco: 37.5 }];
  const r = migrarMateriaisParaInsumos(legado);
  eq(r.alterados, 1);
  eq(r.materiais[0].codigo, "CIM-001");
  eq(r.materiais[0].aliases, ["Sacos de cimento 50kg"]);
  eq(r.materiais[0].precoReferencia, 37.5);
  eq(r.materiais[0].precoFonte, "compra");
});

t("migração é idempotente", () => {
  const legado = [{ id: "x1", nome: "Areia Fina", unidade: "m3", ultimoPreco: 120 }];
  const a = migrarMateriaisParaInsumos(legado);
  const b = migrarMateriaisParaInsumos(a.materiais);
  eq(b.alterados, 0);
  eq(a.materiais[0].codigo, b.materiais[0].codigo);
});

// ── semeadura ────────────────────────────────────────────────
t("semeadura em base vazia cria os 190", () => {
  const r = semearInsumos([], INSUMOS_SEED);
  eq(r.criados, 190);
  eq(r.materiais.length, 190);
});

t("semeadura é idempotente — segunda vez não cria nem altera", () => {
  const a = semearInsumos([], INSUMOS_SEED);
  const b = semearInsumos(a.materiais, INSUMOS_SEED);
  eq(b.criados, 0);
  eq(b.atualizados, 0);
  eq(b.materiais.length, 190);
});

t("semeadura não sobrescreve preço definido à mão", () => {
  const a = semearInsumos([], INSUMOS_SEED);
  const idx = a.materiais.findIndex(x => x.codigo === "CIM-001");
  a.materiais[idx] = Object.assign({}, a.materiais[idx], { precoManual: 55, precoReferencia: 1 });
  const b = semearInsumos(a.materiais, INSUMOS_SEED);
  const cim = b.materiais.find(x => x.codigo === "CIM-001");
  eq(cim.precoManual, 55);
  eq(cim.precoReferencia, 1);
});

t("semeadura não rebaixa preço mais recente que o da semente", () => {
  const a = semearInsumos([], INSUMOS_SEED);
  const idx = a.materiais.findIndex(x => x.codigo === "CIM-001");
  a.materiais[idx] = Object.assign({}, a.materiais[idx], { precoReferencia: 42, precoData: "2026-09-01" });
  const b = semearInsumos(a.materiais, INSUMOS_SEED);
  eq(b.materiais.find(x => x.codigo === "CIM-001").precoReferencia, 42);
});

t("semeadura casa material legado por nome e não duplica", () => {
  const legado = migrarMateriaisParaInsumos([
    { id: "x1", nome: "Sacos de cimento 50kg", unidade: "Unidades", ultimoPreco: 30 },
  ]).materiais;
  const r = semearInsumos(legado, INSUMOS_SEED);
  const cimentos = r.materiais.filter(x => normalizarTexto(x.nome) === "sacos de cimento 50kg");
  eq(cimentos.length, 1);
  eq(r.materiais.length, 190);
});

t("todo insumo semeado resolve por si mesmo", () => {
  const r = semearInsumos([], INSUMOS_SEED);
  const falhou = INSUMOS_SEED.filter(s => {
    const res = resolverInsumo(s.nome, r.materiais);
    return !res.insumo || res.insumo.codigo !== s.codigo;
  });
  eq(falhou.map(x => x.codigo), []);
});

// ── resultado ────────────────────────────────────────────────
t("semente compra_corrigida (já com fator) não é corrigida duas vezes", () => {
  // raw 67,26 × 1,1375 = 76,51 (semente); hoje o fator desde 2024-10-11 ainda é 1,1375 → fica 76,51
  const r = precoInsumo({ precoReferencia: 76.51, precoData: "2024-10-11", precoNCompras: 12, precoFatorInccAplicado: 1.1375 }, HOJE);
  assert(r.corrigido, "deveria marcar corrigido");
  assert(r.preco > 76 && r.preco < 78, "corrigiu duas vezes: " + r.preco);
});

t("material do cadastro antigo (só ultimoPreco) já vale como preço, com confiança baixa", () => {
  const r = precoInsumo({ nome: "PVC - Esgoto - Tubo 100mm", unidade: "Unidades", ultimoPreco: 68.9 }, HOJE);
  eq(r.preco, 68.9);
  eq(r.confianca, "baixa");
  eq(precoInsumo({ nome: "x", ultimoPreco: 0 }, HOJE).preco, null);
});

console.log("\n" + ok + " testes passaram" + (falhas.length ? ", " + falhas.length + " falharam" : ""));
if (falhas.length) {
  console.log("\nFALHAS:\n  - " + falhas.join("\n  - ") + "\n");
  process.exit(1);
}
