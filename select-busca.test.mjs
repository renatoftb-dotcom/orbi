// Testes do SelectBusca — node puro, sem framework.
//   node select-busca.test.mjs
//
// Carrega só os auxiliares puros de src/modules/shared.jsx (buscaNormal,
// opcoesNormalizadas, filtrarOpcoes) — o trecho entre os dois marcadores,
// que é JavaScript comum, sem JSX e sem React.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const raiz = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(raiz, "src", "modules", "shared.jsx"), "utf8");

const ABRE = "// \u2500\u2500 SelectBusca: parte pura";
const FECHA = "// \u2500\u2500 SelectBusca: fim da parte pura";
const a = src.indexOf(ABRE), b = src.indexOf(FECHA);
if (a < 0 || b < 0) throw new Error("Marcadores da parte pura do SelectBusca não encontrados em shared.jsx");
const puro = src.slice(a, b);

const api = new Function(puro + "\nreturn { buscaNormal, opcoesNormalizadas, filtrarOpcoes };")();

let ok = 0; const falhas = [];
function t(nome, fn) {
  try { fn(); ok++; } catch (e) { falhas.push(nome + "\n    " + e.message); }
}
function eq(a, b, msg) {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error((msg || "") + " esperado " + y + ", veio " + x);
}
function assert(c, msg) { if (!c) throw new Error(msg || "falso"); }

const { buscaNormal, opcoesNormalizadas, filtrarOpcoes } = api;

// ── buscaNormal ─────────────────────────────────

t("buscaNormal tira acento, caixa e espaço sobrando", () => {
  eq(buscaNormal("  TÁBUA   de Pinus "), "tabua de pinus");
  eq(buscaNormal("Cerâmica 60×60"), "ceramica 60\u00d760");
  eq(buscaNormal(null), "");
  eq(buscaNormal(undefined), "");
  eq(buscaNormal(12), "12");
});

// ── opcoesNormalizadas ──────────────────────────

t("lista de texto vira valor = rótulo", () => {
  const l = opcoesNormalizadas(["m2", "un"]);
  eq(l.length, 2);
  eq(l[0].valor, "m2"); eq(l[0].rotulo, "m2"); eq(l[0].grupo, "");
});

t("aceita id/nome, valor/rotulo e value/label", () => {
  const l = opcoesNormalizadas([
    { id: "fundacao", nome: "Fundação" },
    { valor: "laje", rotulo: "Laje" },
    { value: "reboco", label: "Reboco" },
  ]);
  eq(l.map(o => o.valor), ["fundacao", "laje", "reboco"]);
  eq(l.map(o => o.rotulo), ["Fundação", "Laje", "Reboco"]);
});

t("grupo aninhado achata e carimba o cabeçalho em cada opção", () => {
  const l = opcoesNormalizadas([
    { grupo: "Custos diretos", opcoes: [{ id: "material", nome: "Material" }, { id: "mo", nome: "Mão de obra" }] },
    { grupo: "Impostos", opcoes: [{ id: "iss", nome: "ISS" }] },
  ]);
  eq(l.length, 3);
  eq(l.map(o => o.grupo), ["Custos diretos", "Custos diretos", "Impostos"]);
  eq(l[2].valor, "iss");
});

t("macro de ETAPAS_OBRA serve de grupo", () => {
  const l = opcoesNormalizadas([{ id: "sapatas", nome: "Sapatas", macro: "Fundação" }]);
  eq(l[0].grupo, "Fundação");
});

t("nulos e lista fora de formato não quebram", () => {
  eq(opcoesNormalizadas(null).length, 0);
  eq(opcoesNormalizadas(undefined).length, 0);
  eq(opcoesNormalizadas([null, undefined, "un"]).length, 1);
});

t("a chave de busca junta rótulo, grupo, extra e valor, sem acento", () => {
  const l = opcoesNormalizadas([{ id: "c1", nome: "Cerâmica", grupo: "Pisos", extra: "Ourifer" }]);
  assert(l[0].busca.indexOf("ceramica") >= 0, "rótulo");
  assert(l[0].busca.indexOf("pisos") >= 0, "grupo");
  assert(l[0].busca.indexOf("ourifer") >= 0, "extra");
  assert(l[0].busca.indexOf("c1") >= 0, "valor");
});

// ── filtrarOpcoes ─────────────────────────────

const ETAPAS = opcoesNormalizadas([
  { id: "marcacao_obra", nome: "Marcação obra", macro: "Fundação" },
  { id: "fundacao", nome: "Fundação", macro: "Fundação" },
  { id: "laje_1", nome: "Laje 1", macro: "Estrutura" },
  { id: "reboco_interno", nome: "Reboco interno", macro: "Acabamento" },
  { id: "reboco_externo", nome: "Reboco externo", macro: "Fachada" },
  { id: "hidraulica", nome: "Hidráulica", macro: "Instalações" },
]);

t("termo vazio devolve a lista inteira, na ordem", () => {
  eq(filtrarOpcoes(ETAPAS, "").map(o => o.valor), ETAPAS.map(o => o.valor));
  eq(filtrarOpcoes(ETAPAS, "   ").length, ETAPAS.length);
});

t("três letras já marcam a opção certa na primeira posição", () => {
  const r = filtrarOpcoes(ETAPAS, "reb");
  eq(r.length, 2);
  eq(r[0].valor, "reboco_interno");
});

t("quem começa com o termo passa na frente de quem só contém", () => {
  const r = filtrarOpcoes(ETAPAS, "fund");
  // "Fundação" começa com fund; "Marcação obra" só casa pelo macro.
  eq(r[0].valor, "fundacao");
  assert(r.map(o => o.valor).indexOf("marcacao_obra") > 0, "marcação vem depois");
});

t("pedaços soltos casam em qualquer ordem", () => {
  eq(filtrarOpcoes(ETAPAS, "reb int").map(o => o.valor), ["reboco_interno"]);
  eq(filtrarOpcoes(ETAPAS, "int reb").map(o => o.valor), ["reboco_interno"]);
});

t("acha sem acento e sem ligar para a caixa", () => {
  eq(filtrarOpcoes(ETAPAS, "hidraulica").map(o => o.valor), ["hidraulica"]);
  eq(filtrarOpcoes(ETAPAS, "HIDRÁULICA").map(o => o.valor), ["hidraulica"]);
});

t("o macro também acha: 'instal' cai na hidráulica", () => {
  eq(filtrarOpcoes(ETAPAS, "instal").map(o => o.valor), ["hidraulica"]);
});

t("nada casa → lista vazia, não a lista inteira", () => {
  eq(filtrarOpcoes(ETAPAS, "zzz").length, 0);
});

t("o filtro não mexe na lista recebida", () => {
  const antes = ETAPAS.map(o => o.valor);
  filtrarOpcoes(ETAPAS, "reb");
  eq(ETAPAS.map(o => o.valor), antes);
});

// ── resultado ─────────────────────────────────

if (falhas.length) {
  console.log("\n❌ " + falhas.length + " falha(s):\n");
  falhas.forEach(f => console.log("  • " + f));
  process.exit(1);
}
console.log("✅ " + ok + " testes do SelectBusca passaram");
