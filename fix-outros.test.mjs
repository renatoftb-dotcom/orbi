// Testes das correções da revisão (área "outros") que não têm suíte própria.
//   node fix-outros.test.mjs
// Carrega só a parte pura de src/modules/teste-projeto.jsx (constantes do
// topo + geometria/quantitativo, cortados por marcadores; o JSX fica de fora).
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const raiz = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(raiz, "src", "modules", "teste-projeto.jsx"), "utf8");
const corte = (a, b) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error("Marcador não encontrado em teste-projeto.jsx: " + (i < 0 ? a : b));
  return src.slice(i, j);
};
const puro = corte("const TP_AZUL", "let _tpThreePromise") + "\n" + corte("// Geometria de polígonos", "// Editor em tela cheia.");
const T = new Function("useState", "useRef", "useEffect", puro + "\nreturn { tpDesenhoParaObra, tpDesenhoParaObraPavs };")(() => [], () => ({}), () => {});

const testes = [];
let falhas = 0;
const teste = (nome, fn) => testes.push([nome, fn]);

// Caixa 6×4 com parede no meio (x=3); amb1 à esquerda, amb2 à direita;
// porta de madeira na parede do meio quando `porta`.
const W = (ax, ay, bx, by, extra = {}) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by }, t: 0.14, h: 2.8, ...extra });
const caixa = (nome, amb1, amb2, porta) => ({ nome, paredes: [W(0, 0, 6, 0), W(6, 0, 6, 4), W(6, 4, 0, 4), W(0, 4, 0, 0),
    W(3, 0, 3, 4, porta ? { ab: [{ id: "o" + nome, tipo: "porta_giro", x: 2, larg: 0.8, alt: 2.1, peit: 0, mat: "madeira" }] } : {})],
  areas: [{ tipo: "ambiente", nome: amb1, pts: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }, { x: 0, y: 4 }] },
          { tipo: "ambiente", nome: amb2, pts: [{ x: 3, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 3, y: 4 }] }] });

teste("Sobrado: porta do andar de cima não vira porta de banheiro por causa do WC do térreo (bug 3)", () => {
  const terreo = caixa("Térreo", "WC", "Cozinha", false);
  const sup = caixa("Superior", "Escritório", "Quarto", true);
  const so = T.tpDesenhoParaObra(sup.paredes, sup.areas).projeto.portasDesenho;
  assert.deepStrictEqual([so.interna, so.banheiro], [1, 0]);
  const r = T.tpDesenhoParaObraPavs([terreo, sup]);
  assert.deepStrictEqual([r.projeto.portasDesenho.interna, r.projeto.portasDesenho.banheiro], [1, 0]);
  assert.strictEqual(r.projeto.portasDesenho.metros, 0.8);
  const linha = r.linhas.find(([k]) => k === "Portas internas (madeira)");
  assert.ok(linha && /^1 — 1 interna \+ 0 de banheiro/.test(linha[1]), linha && linha[1]);
});

teste("Sobrado: porta de banheiro em cada pavimento soma as duas", () => {
  const r = T.tpDesenhoParaObraPavs([caixa("Térreo", "WC", "Sala", true), caixa("Superior", "Lavabo", "Quarto", true)]);
  assert.deepStrictEqual([r.projeto.portasDesenho.interna, r.projeto.portasDesenho.banheiro], [0, 2]);
  assert.strictEqual(r.projeto.portasDesenho.metrosBanheiro, 1.6);
});

teste("Sobrado sem nenhuma abertura: sem portasDesenho", () => {
  const r = T.tpDesenhoParaObraPavs([caixa("Térreo", "Sala", "Cozinha", false), caixa("Superior", "Quarto", "Suíte", false)]);
  assert.strictEqual(r.projeto.portasDesenho, undefined);
});

for (const [nome, fn] of testes) {
  try { await fn(); console.log("  ok   " + nome); }
  catch (e) { falhas++; console.log("  FALHOU " + nome + "\n         " + e.message); }
}
console.log(`\n${testes.length - falhas}/${testes.length} passaram`);
process.exit(falhas ? 1 : 0);
