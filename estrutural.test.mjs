// Testes puros (node) do motor estrutural. Roda com: node estrutural.test.mjs
// Como o orcamento-obra.test.mjs: o módulo não tem export (o combine.js
// concatena tudo), então o fonte é lido e avaliado com new Function.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, "src", "modules", "estrutural.jsx"), "utf-8");
const M = new Function(`${src}\nreturn { ES_NBR, ES_PADRAO, esNos, esNoPedePilar, esLancar, esVerificar, esQuantitativos, esCantosPilar, esMenorVao, esFckOk };`)();

let ok = 0, falhou = 0;
const t = (nome, fn) => { try { fn(); ok++; } catch (e) { falhou++; console.log("FALHOU:", nome, "\n ", e.message); } };
const P = (x, y) => ({ x, y });
const W = (a, b, ab) => ({ a, b, t: 0.14, h: 2.8, ...(ab ? { ab } : {}) });

// casa 8 x 6 com parede interna em x = 5 (encontros em T em cima e embaixo)
const casa = [W(P(0, 0), P(8, 0)), W(P(8, 0), P(8, 6)), W(P(8, 6), P(0, 6)), W(P(0, 6), P(0, 0)), W(P(5, 0), P(5, 6))];
const V6 = { vaoMax: 6 }; // vão adotado de 6 m: as paredes de 6 m não pedem pilar no meio

t("NBR 6118 Tabela 7.2: cobrimentos nominais", () => {
  assert.deepStrictEqual(M.ES_NBR.cobrimento.laje, { 1: 20, 2: 25, 3: 35, 4: 45 });
  assert.deepStrictEqual(M.ES_NBR.cobrimento.vigaPilar, { 1: 25, 2: 30, 3: 40, 4: 50 });
});
t("NBR 6118 Tabela 7.1: classe mínima por CAA", () => {
  assert.deepStrictEqual(M.ES_NBR.classeMinima, { 1: 20, 2: 25, 3: 30, 4: 40 });
  assert.strictEqual(M.esFckOk({ caa: 2, fck: 20 }).ok, false);
  assert.strictEqual(M.esFckOk({ caa: 2, fck: 25 }).ok, true);
});
t("NBR 6118 Tabela 13.1: γn = 1,95 − 0,05 b", () => {
  assert.strictEqual(M.ES_NBR.gamaN(14), 1.25);
  assert.strictEqual(M.ES_NBR.gamaN(18), 1.05);
});
t("nós: 4 cantos + 2 encontros em T", () => {
  const nos = M.esNos(casa);
  assert.strictEqual(nos.filter(M.esNoPedePilar).length, 6);
});
t("lançamento (vão 6 m): 6 pilares nos cantos e encontros", () => {
  const e = M.esLancar(casa, [], V6);
  assert.strictEqual(e.pilares.length, 6);
  const ids = e.pilares.map((p) => `${p.x},${p.y}`).sort();
  assert.deepStrictEqual(ids, ["0,0", "0,6", "5,0", "5,6", "8,0", "8,6"].sort());
});
t("lançamento (vão 6 m): vigas entre pilares (5 + 3 em cima e embaixo, 6 nas laterais e no meio)", () => {
  const e = M.esLancar(casa, [], V6);
  const comp = e.vigas.map((v) => Math.round(Math.hypot(v.b.x - v.a.x, v.b.y - v.a.y) * 100) / 100).sort((a, b) => a - b);
  assert.deepStrictEqual(comp, [3, 3, 5, 5, 6, 6, 6]);
  assert.ok(e.vigas.every((v) => v.apoioA && v.apoioB));
});
t("baldrames só quando pedido", () => {
  assert.strictEqual(M.esLancar(casa, [], V6, { baldrames: true }).vigas.filter((v) => v.baldrame).length, 7);
  assert.strictEqual(M.esLancar(casa, [], {}).vigas.filter((v) => v.baldrame).length, 0);
});
t("parede de 12 m ganha pilares intermediários (vão máximo 5 m)", () => {
  const e = M.esLancar([W(P(0, 0), P(12, 0))], [], {});
  assert.strictEqual(e.pilares.length, 4); // pontas + 2 (12/3 = 4 m)
});
t("pilar intermediário não cai em janela: vai para a ombreira", () => {
  const jan = { id: "j", tipo: "janela_correr", x: 6, larg: 1.2, alt: 1.2, peit: 1.0 };
  const e = M.esLancar([W(P(0, 0), P(12, 0), [jan])], [], {});
  for (const p of e.pilares) assert.ok(p.x <= 5.4 - 0.15 + 1e-6 || p.x >= 6.6 + 0.15 - 1e-6 || p.x === 0 || p.x === 12, `pilar em ${p.x}`);
});
t("trechos da mesma curva não pedem pilar", () => {
  const arco = [W(P(0, 0), P(1, 0.2)), W(P(1, 0.2), P(2, 0.3))].map((w) => ({ ...w, curva: "c1" }));
  assert.strictEqual(M.esLancar(arco, [], {}).pilares.length, 2);
});
t("verificação: pilar 14 × 20 tem menos de 360 cm²", () => {
  const e = M.esLancar(casa, [], { pilar: { b: 0.14, h: 0.20 } });
  const av = M.esVerificar(e, casa, { pilar: { b: 0.14, h: 0.20 } });
  assert.ok(av.some((a) => a.tipo === "nbr" && /280 cm²/.test(a.texto)));
});
t("verificação: pilar 14 cm pede γn (atenção, não erro)", () => {
  const e = M.esLancar(casa, [], {});
  const av = M.esVerificar(e, casa, {});
  assert.ok(av.some((a) => a.tipo === "atencao" && /γn = 1,25/.test(a.texto)));
  assert.ok(!av.some((a) => a.tipo === "nbr"));
});
t("verificação: viga de 40 cm invade porta de 2,10 sob parede de 2,40", () => {
  const porta = { id: "p", tipo: "porta_giro", x: 2, larg: 0.8, alt: 2.1, peit: 0 };
  const ps = [{ ...W(P(0, 0), P(4, 0), [porta]), h: 2.4 }];
  const e = M.esLancar(ps, [], {});
  const av = M.esVerificar(e, ps, {});
  assert.ok(av.some((a) => a.tipo === "compat" && /invade o vão de porta em 10 cm/.test(a.texto)), JSON.stringify(av));
});
t("verificação: pilar desenhado sobre porta", () => {
  const porta = { id: "p", tipo: "porta_giro", x: 2, larg: 0.8, alt: 2.1, peit: 0 };
  const ps = [W(P(0, 0), P(4, 0), [porta])];
  const av = M.esVerificar({ pilares: [{ id: "P9", x: 2, y: 0, b: 0.14, h: 0.3, ang: 0 }], vigas: [], lajes: [] }, ps, {});
  assert.ok(av.some((a) => a.tipo === "compat" && /P9 cai dentro de uma porta/.test(a.texto)));
});
t("verificação: laje de piso com 7 cm (mínimo 8)", () => {
  const laje = { tipo: "laje", pts: [P(0, 0), P(4, 0), P(4, 4), P(0, 4)], esp: 0.07 };
  const e = M.esLancar([], [laje], {});
  const av = M.esVerificar(e, [], {});
  assert.ok(av.some((a) => a.tipo === "nbr" && /mínimo de 8 cm/.test(a.texto)));
});
t("verificação: C20 em área urbana (CAA II pede C25)", () => {
  const av = M.esVerificar({ pilares: [], vigas: [], lajes: [] }, [], { caa: 2, fck: 20 });
  assert.ok(av.some((a) => a.tipo === "nbr" && /C25/.test(a.texto)));
});
t("vão padrão de 5 m: paredes de 6 m ganham pilar no meio (9 pilares)", () => {
  assert.strictEqual(M.esLancar(casa, [], {}).pilares.length, 9);
});
t("verificação: pilar sem pilar embaixo (transição)", () => {
  const e = M.esLancar(casa, [], V6);
  const av = M.esVerificar(e, casa, {}, { pilaresAbaixo: e.pilares.filter((p) => p.x !== 5) });
  assert.strictEqual(av.filter((a) => /transição/.test(a.texto)).length, 2);
});
t("quantitativos: concreto e fôrma", () => {
  const laje = { tipo: "laje", pts: [P(0, 0), P(8, 0), P(8, 6), P(0, 6)], esp: 0.1 };
  const e = M.esLancar(casa, [laje], V6);
  const q = M.esQuantitativos(e, 2.8);
  // pilares: 6 × 0,14 × 0,30 × 2,8 = 0,7056 m³
  assert.ok(Math.abs(q.pilares.concreto - 0.7056) < 1e-9);
  // vigas: 34 m × 0,14 × 0,40 = 1,904 m³
  assert.ok(Math.abs(q.vigas.concreto - 1.904) < 1e-9);
  // laje: 48 m² × 0,10 = 4,8 m³
  assert.ok(Math.abs(q.lajes.concreto - 4.8) < 1e-9);
  assert.ok(Math.abs(q.concreto - (0.7056 + 1.904 + 4.8)) < 1e-9);
});
console.log(`${ok} passou, ${falhou} falhou`);
if (falhou) process.exit(1);
