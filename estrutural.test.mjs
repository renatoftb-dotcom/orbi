// Testes puros (node) do motor estrutural. Roda com: node estrutural.test.mjs
// Como o orcamento-obra.test.mjs: o módulo não tem export (o combine.js
// concatena tudo), então o fonte é lido e avaliado com new Function.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, "src", "modules", "estrutural.jsx"), "utf-8");
const M = new Function(`${src}\nreturn { ES_NBR, ES_PADRAO, esNos, esNoPedePilar, esLancar, esVerificar, esQuantitativos, esCantosPilar, esMenorVao, esFckOk, esPilarNoVao };`)();

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
  const ids = e.pilares.map((p) => `${p.no.x},${p.no.y}`).sort();
  assert.deepStrictEqual(ids, ["0,0", "0,6", "5,0", "5,6", "8,0", "8,6"].sort());
});
t("lançamento (vão 6 m): vigas entre pilares (5 + 3 em cima e embaixo, 6 nas laterais e no meio)", () => {
  const e = M.esLancar(casa, [], V6);
  const comp = e.vigas.map((v) => Math.round(Math.hypot(v.b.x - v.a.x, v.b.y - v.a.y) * 100) / 100).sort((a, b) => a - b);
  assert.deepStrictEqual(comp, [3, 3, 5, 5, 6, 6, 6]);
  assert.ok(e.vigas.every((v) => v.apoioA && v.apoioB));
});
t("pilar não sai da parede: cantos entram na parede, T fica ao longo da parede que passa", () => {
  const dentro = (q) => casa.some((w) => {
    const L = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y), ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L;
    const s = (q.x - w.a.x) * ux + (q.y - w.a.y) * uy, d = (q.x - w.a.x) * -uy + (q.y - w.a.y) * ux;
    return s >= -w.t / 2 - 1e-4 && s <= L + w.t / 2 + 1e-4 && Math.abs(d) <= w.t / 2 + 1e-4;
  });
  for (const p of M.esLancar(casa, [], { ...V6, pilar: { b: 0.14, h: 0.30 } }).pilares) for (const c of M.esCantosPilar(p)) assert.ok(dentro(c), `${p.id} sai da parede em ${c.x.toFixed(3)},${c.y.toFixed(3)}`);
  // pilar 14 × 40 também
  for (const p of M.esLancar(casa, [], { ...V6, pilar: { b: 0.14, h: 0.40 } }).pilares) for (const c of M.esCantosPilar(p)) assert.ok(dentro(c), `${p.id} (14×40) sai da parede`);
});
t("19 × 19 em parede de 14: canto alinhado com as duas faces de fora, T com a face de fora", () => {
  const e = M.esLancar(casa, [], V6), achar = (x, y) => e.pilares.find((p) => p.no.x === x && p.no.y === y);
  const c = achar(0, 0); assert.ok(Math.abs(c.x - 0.025) < 1e-6 && Math.abs(c.y - 0.025) < 1e-6, `${c.x},${c.y}`);
  const t = achar(5, 0); assert.ok(Math.abs(t.x - 5) < 1e-6 && Math.abs(t.y - 0.025) < 1e-6, `${t.x},${t.y}`);
  // nenhuma face de pilar passa da face de fora da casa
  for (const p of e.pilares) for (const q of M.esCantosPilar(p)) assert.ok(q.x >= -0.07 - 1e-3 && q.x <= 8.07 + 1e-3 && q.y >= -0.07 - 1e-3 && q.y <= 6.07 + 1e-3, p.id);
});
t("nenhum pilar invade porta ou janela, nem com porta encostada no canto", () => {
  const porta = { id: "p", tipo: "porta_giro", x: 0.47, larg: 0.8, alt: 2.1, peit: 0 };   // começa a 7 cm do canto
  const jan = { id: "j", tipo: "janela_correr", x: 5.6, larg: 1.2, alt: 1.2, peit: 1 };   // encostada no T em x = 5
  const ps = [W(P(0, 0), P(8, 0), [porta, jan]), W(P(8, 0), P(8, 6)), W(P(8, 6), P(0, 6)), W(P(0, 6), P(0, 0)), W(P(5, 0), P(5, 6))];
  const e = M.esLancar(ps, [], V6);
  for (const p of e.pilares) assert.strictEqual(M.esPilarNoVao(p, ps), null, `${p.id} em ${p.x},${p.y}`);
  assert.ok(!M.esVerificar(e, ps, V6).some((a) => a.tipo === "compat"));
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
  for (const p of e.pilares) assert.strictEqual(M.esPilarNoVao(p, [W(P(0, 0), P(12, 0), [jan])]), null, `pilar em ${p.x}`);
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
t("padrão da norma: pilar 19 × 19 (sem γn, 361 cm²)", () => {
  assert.deepStrictEqual(M.ES_PADRAO.pilar, { b: 0.19, h: 0.19 });
  const av = M.esVerificar(M.esLancar(casa, [], {}), casa, {});
  assert.ok(!av.some((a) => a.tipo === "nbr")); assert.ok(!av.some((a) => /γn/.test(a.texto)));
});
t("verificação: pilar 14 cm pede γn (atenção, não erro)", () => {
  const P14 = { pilar: { b: 0.14, h: 0.30 } };
  const e = M.esLancar(casa, [], P14);
  const av = M.esVerificar(e, casa, P14);
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
  assert.ok(av.some((a) => a.tipo === "compat" && /P9 invade uma porta/.test(a.texto)));
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
  // pilares: 6 × 0,19 × 0,19 × 2,8 = 0,60648 m³
  assert.ok(Math.abs(q.pilares.concreto - 0.60648) < 1e-9);
  // vigas: 34 m × 0,14 × 0,40 = 1,904 m³
  assert.ok(Math.abs(q.vigas.concreto - 1.904) < 1e-9);
  // laje: 48 m² × 0,10 = 4,8 m³
  assert.ok(Math.abs(q.lajes.concreto - 4.8) < 1e-9);
  assert.ok(Math.abs(q.concreto - (0.60648 + 1.904 + 4.8)) < 1e-9);
});
console.log(`${ok} passou, ${falhou} falhou`);
if (falhou) process.exit(1);
