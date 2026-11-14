// Testes puros (node) do motor estrutural. Roda com: node estrutural.test.mjs
// Como o orcamento-obra.test.mjs: o módulo não tem export (o combine.js
// concatena tudo), então o fonte é lido e avaliado com new Function.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, "src", "modules", "estrutural.jsx"), "utf-8");
const M = new Function(`${src}\nreturn { esLancarPavimentos, esDescidaCargas, esTopoPavimento, esCargaParede, esCargaLaje, esCargaTelhado, ES_NBR, ES_PADRAO, esNos, esNoPedePilar, esLancar, esVerificar, esQuantitativos, esCantosPilar, esMenorVao, esFckOk, esPilarNoVao, esLinhaContinua, esPaineisLaje, esDimViga, esDimPilar, esDimensionar, esMRd, esConcreto, esPlacaApoiada, esDimLaje, esCalcularEstrutura, esParaOrcamento };`)();

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
  const e = M.esLancar(casa, [], { ...V6, pilar: { auto: false, b: 0.19, h: 0.19 } }), achar = (x, y) => e.pilares.find((p) => p.no.x === x && p.no.y === y);
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
t("seção automática: a menor que a norma aceita e cabe na parede", () => {
  assert.strictEqual(M.ES_PADRAO.pilar.auto, true);
  const e = M.esLancar(casa, [], {});
  assert.ok(e.pilares.every((p) => p.b === 0.14 && p.h === 0.30), "parede de 14 → 14 × 30");
  const av = M.esVerificar(e, casa, {});
  assert.ok(!av.some((a) => a.tipo === "nbr")); assert.ok(av.some((a) => /γn = 1,25/.test(a.texto)), "avisa o γn");
  const grossa = casa.map((w) => ({ ...w, t: 0.19 }));
  assert.ok(M.esLancar(grossa, [], {}).pilares.every((p) => p.b === 0.19 && p.h === 0.19), "parede de 19 → 19 × 19");
  const fina = casa.map((w) => ({ ...w, t: 0.09 }));
  assert.ok(M.esLancar(fina, [], {}).pilares.every((p) => p.b === 0.14 && p.h === 0.30), "parede de 9 → 14 × 30 (mínimo absoluto)");
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
t("verificação: laje maciça de piso com 7 cm (mínimo 8)", () => {
  const laje = { tipo: "laje", pts: [P(0, 0), P(4, 0), P(4, 4), P(0, 4)], esp: 0.07, carga: { tipo: "macica", uso: "residencial" } };
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
  const laje = { tipo: "laje", pts: [P(0, 0), P(8, 0), P(8, 6), P(0, 6)], esp: 0.1, carga: { tipo: "macica" } };
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
t("cargas: parede de 14 sem escolha = bloco cerâmico 11,5 + 1 cm por face (1,3 kN/m²)", () => {
  const c = M.esCargaParede({ a: P(0, 0), b: P(4, 0), t: 0.14, h: 2.8 }, 0.4);
  assert.strictEqual(c.g, 1.3); assert.ok(Math.abs(c.linha - 1.3 * 2.4) < 1e-9);
  const c2 = M.esCargaParede({ a: P(0, 0), b: P(4, 0), t: 0.14, h: 2.8, alv: { sist: "concreto_estrutural", bloco: 14, rev: 2 } }, 0);
  assert.strictEqual(c2.g, 2.7);
});
t("cargas: laje maciça 10 cm de piso = 2,5 + 1,0 + 0,285 e q = 1,5", () => {
  const c = M.esCargaLaje({ esp: 0.1, carga: { tipo: "macica" } }, "residencial");
  assert.ok(Math.abs(c.g - 3.785) < 1e-9); assert.strictEqual(c.q, 1.5);
  const s = M.esCargaLaje({ esp: 0.1, carga: { tipo: "macica", uso: "servico" } }, "forro"); assert.strictEqual(s.q, 2);
});
t("cargas: sem escolha, forro = treliçada EPS 8+4 e piso = protendida EPS 12+4 (peso pela geometria)", () => {
  const f = M.esCargaLaje({ esp: 0.12 }, "forro");
  assert.strictEqual(f.tipo, "trelicada"); assert.strictEqual(f.q, 0); assert.strictEqual(f.pre.he, 0.08); // 12 desenhada = 8 + 4
  // 25 × (0,04 + 0,12 × 0,08 / 0,42) + 0,2 × (0,30 × 0,08 / 0,42)
  const ppT = 25 * (0.04 + 0.12 * 0.08 / 0.42) + 0.2 * (0.30 * 0.08 / 0.42);
  assert.ok(Math.abs(f.pp - ppT) < 1e-9, f.pp);
  const p = M.esCargaLaje({ esp: 0.16 }, "residencial");
  assert.strictEqual(p.tipo, "protendida"); assert.strictEqual(p.pre.hTotal, 0.16);
  const ppP = 25 * (0.04 + 0.12 * 0.12 / 0.42) + 0.2 * (0.30 * 0.12 / 0.42);
  assert.ok(Math.abs(p.pp - ppP) < 1e-9);
  const cer = M.esCargaLaje({ esp: 0.12, carga: { tipo: "trelicada", ench: "ceramica" } }, "forro");
  assert.ok(Math.abs(cer.pp - (25 * (0.04 + 0.12 * 0.08 / 0.42) + 6 * (0.30 * 0.08 / 0.42))) < 1e-9);
});
t("cargas: telhado cerâmico com madeira até 40% = 0,7; fibrocimento 6 mm pede o peso da estrutura", () => {
  assert.strictEqual(M.esCargaTelhado({ telha: "Telha Barro Portuguesa" }, 30).g, 0.7);
  assert.strictEqual(M.esCargaTelhado({ telha: "Telha Barro Portuguesa" }, 45).falta, "estrutura");
  const f = M.esCargaTelhado({ telha: "Telha Fibrocimento 6mm" }, 15); assert.strictEqual(f.falta, "estrutura");
  const f2 = M.esCargaTelhado({ telha: "Telha Fibrocimento 6mm", pesoEstrutura: 0.2 }, 15); assert.ok(Math.abs(f2.g - (0.18 * Math.sqrt(1 + 0.15 ** 2) + 0.2)) < 1e-9);
  assert.strictEqual(M.esCargaTelhado({ telha: "Telha Plana Concreto", pesoEstrutura: 0.2 }, 30).falta, "telha");
});
t("continuidade: pilar do térreo sobre parede do pavimento de cima sobe junto (sem transição)", () => {
  const terreo = M.esLancar(casa, [], {});           // tem pilares em x = 5 (encontros em T)
  const cima = [W(P(0, 0), P(8, 0)), W(P(8, 0), P(8, 6)), W(P(8, 6), P(0, 6)), W(P(0, 6), P(0, 0))]; // sem a parede do meio
  const sem = M.esLancar(cima, [], {});
  assert.ok(sem.pilares.some((p) => Math.abs(p.no.x - 4) < 1e-6), "sem continuidade, o intermediário fica em x = 4");
  const com = M.esLancar(cima, [], {}, { pilaresAbaixo: terreo.pilares });
  assert.ok(com.pilares.some((p) => Math.abs(p.no.x - 5) < 1e-6 && p.no.y === 0) && com.pilares.some((p) => Math.abs(p.no.x - 5) < 1e-6 && p.no.y === 6));
  assert.ok(!com.pilares.some((p) => Math.abs(p.no.x - 4) < 1e-6), "não sobra intermediário em x = 4");
  const av = M.esVerificar(com, cima, {}, { pilaresAbaixo: terreo.pilares });
  assert.ok(!av.some((a) => /transição/.test(a.texto)), JSON.stringify(av.filter((a) => /transição/.test(a.texto))));
});
t("continuidade nos dois sentidos: encontro de cima desce quando há parede embaixo", () => {
  // térreo: caixa 10 × 6 (pilar intermediário cairia em x = 5); em cima: parede interna em x = 4
  const ter = [W(P(0, 0), P(10, 0)), W(P(10, 0), P(10, 6)), W(P(10, 6), P(0, 6)), W(P(0, 6), P(0, 0))];
  const cim = [...ter, W(P(4, 0), P(4, 6))];
  const [a, b] = M.esLancarPavimentos([{ paredes: ter }, { paredes: cim }], { vaoMax: 6 });
  assert.ok(a.pilares.some((p) => Math.abs(p.no.x - 4) < 1e-6 && p.no.y === 0), "o encontro x = 4 de cima desceu para o térreo");
  const av = M.esVerificar(b, cim, { vaoMax: 6 }, { pilaresAbaixo: a.pilares });
  assert.ok(!av.some((x) => /transição/.test(x.texto)), JSON.stringify(av.map((x) => x.texto)));
});
t("pilar contínuo: vai do fundo do baldrame ao piso de cima; viga com topo no piso de cima", () => {
  const laje = { tipo: "laje", pts: [P(0, 0), P(8, 0), P(8, 6), P(0, 6)], esp: 0.1, cota: 2.8 };
  const [a, b] = M.esLancarPavimentos([{ paredes: casa, areas: [laje], nivel: 0 }, { paredes: casa, areas: [laje], nivel: 2.9 }], V6);
  assert.ok(a.pilares.every((p) => p.base === -0.3 && p.topo === 2.9), JSON.stringify(a.pilares[0]));
  assert.ok(a.vigas.filter((v) => !v.baldrame).every((v) => v.topo === 2.9));
  // último pavimento: até o topo da laje dele (2,8 + 0,1)
  assert.ok(b.pilares.every((p) => p.base === 0 && p.topo === 2.9));
});
t("viga de piso sob parede de cima sem parede embaixo; sem pilar sobre vão livre", () => {
  // térreo: casa 8 × 6 com parede em x = 5; em cima: parede em x = 2,5 (sobre a sala) e parede y = 3 de 0 a 2,5
  const cima = [W(P(0, 0), P(8, 0)), W(P(8, 0), P(8, 6)), W(P(8, 6), P(0, 6)), W(P(0, 6), P(0, 0)), W(P(2.5, 0), P(2.5, 6)), W(P(0, 3), P(2.5, 3))];
  const [a, b] = M.esLancarPavimentos([{ paredes: casa, nivel: 0 }, { paredes: cima, nivel: 2.9 }], V6);
  const vps = a.vigas.filter((v) => v.vigaPiso);
  assert.strictEqual(vps.length, 2, JSON.stringify(vps.map((v) => [v.a, v.b])));
  assert.ok(vps.every((v) => v.topo === 2.9));
  // o encontro (2,5; 3) fica sobre a sala: não tem pilar em cima nem embaixo
  assert.ok(!b.pilares.some((p) => Math.abs(p.no.x - 2.5) < 0.05 && Math.abs(p.no.y - 3) < 0.05));
  // os encontros na fachada (2,5; 0) e (2,5; 6) descem até a fundação e apoiam a viga de piso
  for (const y of [0, 6]) assert.ok(a.pilares.some((p) => Math.abs(p.no.x - 2.5) < 0.05 && p.no.y === y), `pilar em 2,5; ${y} no térreo`);
  const vx = vps.find((v) => Math.abs(v.a.x - 2.5) < 0.05 && Math.abs(v.b.x - 2.5) < 0.05);
  assert.ok(vx && vx.apoioA && vx.apoioB, "viga de piso em x = 2,5 apoiada nos dois pilares");
  const av = M.esVerificar(b, cima, V6, { pilaresAbaixo: a.pilares });
  assert.ok(!av.some((x) => /transição/.test(x.texto)), JSON.stringify(av.map((x) => x.texto)));
});
t("pilar de cima a menos de 1 m de um pilar fixo de baixo, sobre porta: não entra (fica o de baixo)", () => {
  // térreo: fachada de 8 m com porta de 2 m em x = 3..5 e parede interna em x = 2,9 → T em (2,9; 0)
  const porta = { id: "p", tipo: "porta_giro", x: 4, larg: 2, alt: 2.1, peit: 0 };
  const ter = [W(P(0, 0), P(8, 0), [porta]), W(P(8, 0), P(8, 6)), W(P(8, 6), P(0, 6)), W(P(0, 6), P(0, 0)), W(P(2.9, 0), P(2.9, 6))];
  // em cima: parede interna em x = 3,5 (cai sobre a porta de baixo, a 0,6 m do T de baixo)
  const cim = [W(P(0, 0), P(8, 0)), W(P(8, 0), P(8, 6)), W(P(8, 6), P(0, 6)), W(P(0, 6), P(0, 0)), W(P(3.5, 0), P(3.5, 6))];
  const [a, b] = M.esLancarPavimentos([{ paredes: ter, nivel: 0 }, { paredes: cim, nivel: 2.9 }], V6);
  assert.ok(!b.pilares.some((p) => Math.abs(p.no.x - 3.5) < 0.05 && p.no.y === 0), "sem pilar em (3,5; 0) em cima");
  const av = M.esVerificar(b, cim, V6, { pilaresAbaixo: a.pilares });
  assert.ok(!av.some((x) => /transição/.test(x.texto) && /\(3,5/.test(x.texto)));
});
t("descida de cargas: o que chega na fundação é o peso de tudo (equilíbrio)", () => {
  const caixa = [W(P(0, 0), P(4, 0)), W(P(4, 0), P(4, 4)), W(P(4, 4), P(0, 4)), W(P(0, 4), P(0, 0))];
  const laje = { tipo: "laje", pts: [P(0, 0), P(4, 0), P(4, 4), P(0, 4)], esp: 0.1, cota: 2.8, carga: { tipo: "macica", uso: "residencial" } };
  for (const pavs of [
    [{ paredes: caixa, areas: [laje], nivel: 0, usoPadrao: "residencial" }],
    [{ paredes: caixa, areas: [laje], nivel: 0, usoPadrao: "residencial" }, { paredes: caixa, areas: [{ ...laje, carga: { tipo: "macica", uso: "forro" } }], nivel: 2.9, usoPadrao: "forro" }],
  ]) {
    const lanc = M.esLancarPavimentos(pavs, {});
    const d = M.esDescidaCargas(pavs, lanc, {});
    let esperadoG = 0, esperadoQ = 0;
    pavs.forEach((p, k) => {
      const topo = M.esTopoPavimento(pavs, k);
      for (const a of p.areas) { const c = M.esCargaLaje(a, p.usoPadrao); esperadoG += c.g * 16; esperadoQ += c.q * 16; }
      for (const v of lanc[k].vigas) esperadoG += 25 * v.b_ * v.h * Math.hypot(v.b.x - v.a.x, v.b.y - v.a.y);
      for (const pl of lanc[k].pilares) esperadoG += 25 * pl.b * pl.h * (pl.topo - pl.base);
      for (const w of p.paredes) esperadoG += M.esCargaParede(w, 0).g * Math.max(0, topo - 0.4) * 4;
    });
    const somaG = d.fundacao.reduce((t, f) => t + f.Ng, 0), somaQ = d.fundacao.reduce((t, f) => t + f.Nq, 0);
    assert.ok(Math.abs(somaG - esperadoG) < 0.5, `g: ${somaG.toFixed(2)} × ${esperadoG.toFixed(2)}`);
    assert.ok(Math.abs(somaQ - esperadoQ) < 0.2, `q: ${somaQ.toFixed(2)} × ${esperadoQ.toFixed(2)}`);
    // caixa simétrica: os quatro pilares de canto recebem o mesmo
    const ns = d.fundacao.map((f) => f.Nk); assert.ok(Math.max(...ns) - Math.min(...ns) < 0.5, ns.join(" "));
  }
});
t("viga contínua de dois vãos iguais: apoio do meio 1,25 wL e momento -wL²/8", () => {
  const r = M.esLinhaContinua([{ L: 4, I: 1, w: 10, pts: [] }, { L: 4, I: 1, w: 10, pts: [] }]);
  assert.ok(Math.abs(r[0].Mb + 20) < 1e-6 && Math.abs(r[1].Ma + 20) < 1e-6, `${r[0].Mb} ${r[1].Ma}`);
  assert.ok(Math.abs(r[0].RB + r[1].RA - 50) < 1e-6 && Math.abs(r[0].RA - 15) < 1e-6);
  assert.ok(Math.abs(r[0].Ma) < 1e-9 && Math.abs(r[1].Mb) < 1e-9, "pontas apoiadas sem momento");
});
t("laje pré-fabricada: vigotas no menor vão, carga só nas vigas onde apoiam", () => {
  const vigas = [{ a: P(0, 0), b: P(6, 0) }, { a: P(6, 0), b: P(6, 3) }, { a: P(6, 3), b: P(0, 3) }, { a: P(0, 3), b: P(0, 0) }];
  const r = M.esPaineisLaje([P(0, 0), P(6, 0), P(6, 3), P(0, 3)], vigas, "auto", false);
  assert.strictEqual(r.paineis.length, 1); const pn = r.paineis[0];
  assert.ok(Math.abs(pn.dir.y) > 0.99 && Math.abs(pn.vao - 3) < 0.05, `vão ${pn.vao}`);
  const tot = r.porViga.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(tot - 18) < 0.01, "área toda distribuída");
  assert.ok(r.porViga[1] + r.porViga[3] < 0.7, `bordas paralelas às vigotas quase sem carga: ${r.porViga[1]} ${r.porViga[3]}`);
  // girar as vigotas: a carga vai para as vigas curtas
  const g = M.esPaineisLaje([P(0, 0), P(6, 0), P(6, 3), P(0, 3)], vigas, "u", false);
  assert.ok(g.porViga[1] + g.porViga[3] > 16 && g.paineis[0].forcado);
  // maciça 6 × 3 (λ = 2): duas direções, as quatro vigas recebem
  const m = M.esPaineisLaje([P(0, 0), P(6, 0), P(6, 3), P(0, 3)], vigas, "auto", true);
  assert.ok(m.paineis[0].duas && m.porViga.every((a) => a > 1));
});
t("dimensionamento de viga: flexão, cisalhamento e flecha (conta à mão)", () => {
  // 14 × 40, L = 4, g = q = 10 kN/m → Md = 1,4 × 20 × 16 / 8 = 56 kN·m
  const r = M.esDimViga({ L: 4, g: 10, q: 10, b_: 0.14, h: 0.40, pontosTodos: [] }, {});
  assert.ok(Math.abs(r.Md - 56) < 0.01, `Md ${r.Md}`);
  // d = 0,40 - 0,03 - 0,005 - 0,00625; x = 1,25d(1 - √(1 - Md/(0,425 b d² fcd))); As = Md/(fyd(d - 0,4x))
  const d = 0.40 - 0.03 - 0.005 - 0.00625, fcd = 25000 / 1.4, k = 56 / (0.425 * 0.14 * d * d * fcd), x = 1.25 * d * (1 - Math.sqrt(1 - k));
  const As = 56 / (500000 / 1.15 * (d - 0.4 * x));
  assert.ok(Math.abs(r.AsCalc - As) < 1e-8 && r.barras.area >= As, `${r.AsCalc} ${As}`);
  assert.ok(r.estribo && r.estribo.s <= 0.6 * d + 1e-9);
  assert.ok(r.flecha.total > 0 && r.ok === (r.flecha.total <= 4 / 250));
  // 5 m com parede e carga alta não passa em 14 × 40 e diz a altura que passa
  const f = M.esDimViga({ L: 5, g: 20, q: 2, b_: 0.14, h: 0.40, pontosTodos: [], comParede: true }, {});
  assert.ok(!f.ok && f.hMin > 0.40, `hMin ${f.hMin}`);
});
t("dimensionamento de pilar: γn, momento mínimo, 2ª ordem e armadura mínima", () => {
  const r = M.esDimPilar({ b: 0.14, h: 0.30 }, { Ng: 100, Nq: 20 }, 2.9, {});
  assert.ok(Math.abs(r.Nd - 1.4 * 1.25 * 120) < 1e-6, `Nd ${r.Nd}`);
  const fraca = r.direcoes[0]; assert.ok(Math.abs(fraca.M1min - r.Nd * (0.015 + 0.03 * 0.14)) < 1e-9 && fraca.lam > 35 && fraca.M2 > 0);
  assert.ok(r.As >= 0.004 * 0.14 * 0.30 - 1e-12 && r.barras.n >= 4 && r.barras.d >= 10 && r.ok);
  // a seção com a armadura escolhida resiste ao Md
  assert.ok(M.esMRd(0.30, 0.14, 0.043, r.barras.area, r.Nd, M.esConcreto(25)) >= fraca.Md);
  // carga que esmaga o 14 × 30: falha e sugere seção maior
  const g = M.esDimPilar({ b: 0.14, h: 0.30 }, { Ng: 700, Nq: 100 }, 2.9, {});
  assert.ok(!g.ok && (g.hSugerida == null || g.hSugerida > 0.30));
});
t("placa quadrada apoiada (diferenças finitas) bate com Timoshenko", () => {
  const vigas = [{ a: P(0, 0), b: P(4, 0) }, { a: P(4, 0), b: P(4, 4) }, { a: P(4, 4), b: P(0, 4) }, { a: P(0, 4), b: P(0, 0) }];
  const pn = M.esPaineisLaje([P(0, 0), P(4, 0), P(4, 4), P(0, 4)], vigas, "auto", true).paineis[0];
  const r = M.esPlacaApoiada(pn.malha);
  // ν = 0,2: m = 0,0442 q a²; w·D = 0,00406 q a⁴ (malha de 10 cm, painel ~3,9 m entre faces bloqueadas)
  const a = 4 - 0.1; // a malha apoia a 5 cm do eixo (esDimLajeMacica corrige para o vão teórico)
  assert.ok(Math.abs(r.mx / (a * a) - 0.0442) < 0.003 && Math.abs(r.my / (a * a) - 0.0442) < 0.003, `mx/a² ${r.mx / a / a}`);
  assert.ok(Math.abs(r.u / a ** 4 - 0.00406) < 0.0003, `u/a⁴ ${r.u / a ** 4}`);
});
t("laje treliçada: vão curto passa, 5 m com 8 + 4 não passa na flecha e pede enchimento maior", () => {
  const vigas = (L) => [{ a: P(0, 0), b: P(8, 0) }, { a: P(8, 0), b: P(8, L) }, { a: P(8, L), b: P(0, L) }, { a: P(0, L), b: P(0, 0) }];
  const laje = (L) => ({ tipo: "laje", pts: [P(0, 0), P(8, 0), P(8, L), P(0, L)], esp: 0.12, carga: { tipo: "trelicada", uso: "forro" } });
  const pn = (L) => { const c = M.esCargaLaje(laje(L), "forro"), p0 = M.esPaineisLaje(laje(L).pts, vigas(L), "auto", false).paineis[0]; return { ...p0, tipo: "trelicada", g: c.g, q: c.q, pre: c.pre, esp: 0.12 }; };
  const curta = M.esDimLaje(pn(3), {}); assert.ok(curta.ok && Math.abs(curta.l - 3) < 0.05, JSON.stringify(curta.motivos));
  const longa = M.esDimLaje(pn(5.2), {}); assert.ok(!longa.ok && longa.heSugerido > 0.08, `he ${longa.heSugerido}`);
});
t("cálculo completo: viga que não passa sobe de altura e o orçamento recebe metros por bitola", () => {
  const caixa = [W(P(0, 0), P(5, 0)), W(P(5, 0), P(5, 4)), W(P(5, 4), P(0, 4)), W(P(0, 4), P(0, 0))].map((w) => ({ ...w, t: 0.19 }));
  const pavs = [{ paredes: caixa, areas: [{ tipo: "laje", pts: [P(0, 0), P(5, 0), P(5, 4), P(0, 4)], esp: 0.16, carga: { tipo: "protendida", uso: "residencial" } }], nivel: 0, usoPadrao: "residencial" },
    { paredes: caixa, areas: [{ tipo: "laje", pts: [P(0, 0), P(5, 0), P(5, 4), P(0, 4)], esp: 0.12, carga: { tipo: "trelicada", uso: "forro" } }], nivel: 2.9, usoPadrao: "forro" }];
  const c = M.esCalcularEstrutura(pavs, { vaoMax: 6 });
  for (const a of c.ajustes) assert.ok(a.para > a.de);
  c.dim.pavimentos.forEach((p) => Object.values(p.vigas).forEach((r) => assert.ok(r.ok, r.motivos.join(";"))));
  const o = M.esParaOrcamento(pavs, c);
  assert.strictEqual(o.colunasTerreo[20], c.lanc[0].pilares.length);
  const kgOrc = Object.entries(o.colunasTerreo.ferro).reduce((t, [k, m]) => t + m * { CA60_5MM: 0.154, CA50_6MM: 0.245, CA50_8MM: 0.395, CA50_10MM: 0.617, CA50_12MM: 0.963, CA50_16MM: 1.578 }[k], 0);
  const kgDim = Object.values(c.dim.pavimentos[0].pilares).reduce((t, r) => t + Object.values(r.aco).reduce((a, b) => a + b, 0), 0);
  assert.ok(Math.abs(kgOrc - kgDim) < 0.5, `${kgOrc} × ${kgDim}`);
  assert.ok(o.baldrames.concreto > 0 && o.vigaRespaldoPav1.concreto > 0);
});
console.log(`${ok} passou, ${falhou} falhou`);
if (falhou) process.exit(1);
