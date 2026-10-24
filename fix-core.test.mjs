// Correções da área "core" (app.jsx, api.js, mensagens.jsx): gravação que
// cai no meio, erro do servidor x recusa, importação de backup e o HTML de
// e-mail externo. Roda com: node fix-core.test.mjs
import { readFileSync, writeFileSync, mkdtempSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { tmpdir } from "os";
import assert from "assert";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mod = (nome) => readFileSync(join(__dirname, "src", "modules", nome), "utf-8");

// api.js vira um módulo de verdade (tem import.meta), com fetch de mentira
let src = mod("api.js").replace(/const _API_URL = [\s\S]*?;\n/, 'const _API_URL = "http://teste";\n');
src += "\nexport { saveAllData, mesclar3, mesclarImportacao, resumoDaImportacao, projetosDosOrcamentos };\n";
const arq = join(mkdtempSync(join(tmpdir(), "fixcore-")), "api.mjs");
writeFileSync(arq, src);
const chamadas = [];
console.error = () => {}; // o "Erro ao salvar" esperado não polui a saída
globalThis.localStorage = { getItem: () => "tok", setItem() {}, removeItem() {} };
globalThis.fetch = async (url, op) => {
  chamadas.push(op.method + " " + url.replace("http://teste", ""));
  const corpo = op.body ? JSON.parse(op.body) : {};
  return { status: 200, json: async () => ({ ok: true, data: { ...corpo, _versao: "nova" } }) };
};
const A = await import(pathToFileURL(arq).href);

// gravarPendente e companhia, tirados do app.jsx, com refs e setters falsos
const app = mod("app.jsx");
const ini = app.indexOf("  const LISTAS_COM_VERSAO"), fim = app.indexOf("  // Backup (exportar/importar)");
const trecho = app.slice(ini, fim);
function montarGravacao({ alvo, base, falha }) {
  const ctx = { avisos: [], offline: null, telas: [], timers: 0 };
  const ref = (v) => ({ current: v });
  const f = new Function("mesclar3", "saveAllData", "dataRef", "syncedRef", "carregouDoServidorRef", "savingRef", "novaTentativaRef",
    "setData", "setBackendOffline", "setAvisoGravacao", "setTimeout", "clearTimeout", "enfileirarGravacao",
    trecho + "\nreturn { gravarPendente };");
  ctx.dataRef = ref(alvo); ctx.syncedRef = ref(base);
  ctx.fns = f(A.mesclar3, async () => { throw falha; }, ctx.dataRef, ctx.syncedRef, ref(true), ref(false), ref(null),
    (t) => ctx.telas.push(t), (v) => { ctx.offline = v; }, (a) => ctx.avisos.push(a), () => { ctx.timers++; return 1; }, () => {}, () => {});
  return ctx;
}

let passou = 0, falhou = 0;
async function teste(nome, fn) {
  try { await fn(); passou++; console.log(`  ok   ${nome}`); }
  catch (e) { falhou++; console.log(`FALHOU ${nome}`); console.log(`       ${e.message}`); }
}

// ── 3. 5xx / rede / 429 tentam de novo; só 4xx é recusa ───────────────
const base0 = { obras: [{ id: "o1", nome: "A", _versao: "v1" }] };
const alvo0 = { obras: [{ id: "o1", nome: "B", _versao: "v1" }] };
for (const [st, nome] of [[500, "500 (banco fora do ar)"], [503, "503"], [429, "429 (muitas requisições)"], [408, "408"], [undefined, "erro de rede"]]) {
  await teste(`gravação com ${nome}: fica pendente e tenta de novo, sem aviso de recusa`, async () => {
    const e = Object.assign(new Error("x"), st ? { status: st } : {});
    const c = montarGravacao({ alvo: alvo0, base: base0, falha: e });
    await c.fns.gravarPendente();
    assert.strictEqual(c.offline, true);
    assert.strictEqual(c.timers, 1);
    assert.strictEqual(c.avisos.length, 0);
    assert.strictEqual(c.syncedRef.current, base0, "a base não pode virar o alvo (a alteração seria dada por gravada)");
  });
}
await teste("gravação com 400: recusa definitiva, avisa e não tenta de novo", async () => {
  const c = montarGravacao({ alvo: alvo0, base: base0, falha: Object.assign(new Error("dado inválido"), { status: 400 }) });
  await c.fns.gravarPendente();
  assert.strictEqual(c.timers, 0);
  assert.ok(c.avisos[0] && c.avisos[0].erro);
});

// ── 11. rede cai no meio: o que gravou vai para a base e para a tela ────
await teste("queda no meio: registros que gravaram entram na base com a versão nova; o que falhou fica pendente", async () => {
  const base = { obras: [{ id: "o1", nome: "A", _versao: "v1" }, { id: "o2", nome: "X", _versao: "w1" }], lancamentos: [] };
  const alvo = { obras: [{ id: "o1", nome: "A2", _versao: "v1" }, { id: "o2", nome: "X2", _versao: "w1" }], lancamentos: [{ id: "l9", valor: 5 }] };
  const e = new TypeError("Failed to fetch");
  e.atualizados = { obras: { o1: { id: "o1", nome: "A2", _versao: "v2" } }, lancamentos: { l9: { id: "l9", valor: 5, _versao: "n1" } }, clientes: {}, orcamentosProjeto: {}, escritorio: null };
  const c = montarGravacao({ alvo, base, falha: e });
  await c.fns.gravarPendente();
  const sb = c.syncedRef.current;
  assert.deepStrictEqual(sb.obras.find((o) => o.id === "o1"), { id: "o1", nome: "A2", _versao: "v2" });
  assert.deepStrictEqual(sb.obras.find((o) => o.id === "o2"), { id: "o2", nome: "X", _versao: "w1" }, "o2 não gravou: base continua a antiga");
  assert.deepStrictEqual(sb.lancamentos, [{ id: "l9", valor: 5, _versao: "n1" }], "o lançamento novo que gravou entra na base");
  const tela = c.dataRef.current;
  assert.strictEqual(tela.obras.find((o) => o.id === "o1")._versao, "v2", "a tela recebe a versão nova");
  assert.strictEqual(tela.obras.find((o) => o.id === "o2").nome, "X2", "a mudança que falhou continua na tela");
  assert.strictEqual(c.offline, true);
  assert.strictEqual(c.timers, 1);
});
await teste("queda no meio: a nova tentativa não reenvia o que já gravou nem manda versão velha (sem falso conflito)", async () => {
  const base = { obras: [{ id: "o1", nome: "A", _versao: "v1" }, { id: "o2", nome: "X", _versao: "w1" }] };
  const alvo = { obras: [{ id: "o1", nome: "A2", _versao: "v1" }, { id: "o2", nome: "X2", _versao: "w1" }] };
  const e = new TypeError("Failed to fetch");
  e.atualizados = { obras: { o1: { id: "o1", nome: "A2", _versao: "v2" } }, lancamentos: {}, clientes: {}, orcamentosProjeto: {}, escritorio: null };
  const c = montarGravacao({ alvo, base, falha: e });
  await c.fns.gravarPendente();
  chamadas.length = 0;
  const corpos = [];
  const fetchAntes = globalThis.fetch;
  globalThis.fetch = async (url, op) => { corpos.push(JSON.parse(op.body || "{}")); return fetchAntes(url, op); };
  try { await A.saveAllData(c.dataRef.current, c.syncedRef.current); } finally { globalThis.fetch = fetchAntes; }
  assert.deepStrictEqual(corpos.map((x) => x.id), ["o2"], "só a obra que não gravou vai de novo");
  assert.strictEqual(corpos[0]._versao, "w1");
});

// ── 5. importar backup: por cima, sem apagar, com confirmação ─────────
const atual = {
  clientes: [{ id: "c1", nome: "Ana", _versao: "cv1" }, { id: "c2", nome: "Bia" }],
  obras: [{ id: "o1", nome: "Obra 1", _versao: "ov1" }], lancamentos: [{ id: "l1", valor: 10 }],
  orcamentosProjeto: [{ id: "or1", status: "ganho", clienteId: "c1", projeto: { colunaEtapa: "briefing" } }],
  fornecedores: [{ id: "f1", nome: "Loja" }], materiais: [{ id: "m1" }], receitasFinanceiro: [{ id: "r1" }],
  escritorio: { nome: "Padovan", equipe: [{ nome: "Renato" }], _versao: "ev1" }, cub: { x: 1 },
};
atual.projetos = A.projetosDosOrcamentos(atual.orcamentosProjeto);
await teste("arquivo parcial (só obras) é recusado", () => {
  assert.ok(A.mesclarImportacao(atual, { obras: [{ id: "o9" }] }).erro);
});
await teste("lista que não é lista, registro sem id, ou JSON que não é objeto: recusado", () => {
  const ok = { clientes: [], obras: [], lancamentos: [], orcamentosProjeto: [] };
  assert.ok(A.mesclarImportacao(atual, { ...ok, obras: { o1: {} } }).erro);
  assert.ok(A.mesclarImportacao(atual, { ...ok, fornecedores: "x" }).erro);
  assert.ok(A.mesclarImportacao(atual, { ...ok, clientes: [{ nome: "sem id" }] }).erro);
  assert.ok(A.mesclarImportacao(atual, { ...ok, escritorio: [1] }).erro);
  assert.ok(A.mesclarImportacao(atual, [1, 2]).erro);
  assert.ok(A.mesclarImportacao(atual, null).erro);
  assert.ok(!A.mesclarImportacao(atual, ok).erro);
});
const arquivo = {
  clientes: [{ id: "c1", nome: "Ana Maria", _versao: "velha" }, { id: "c3", nome: "Caio", _versao: "velha" }],
  obras: [], lancamentos: [{ id: "l2", valor: 7 }],
  orcamentosProjeto: [{ id: "or2", status: "ganho", clienteId: "c3", projeto: { colunaEtapa: "estudo" } }],
  escritorio: { nome: "Padovan Arq", _versao: "velha" },
};
await teste("importar mescla por id: substitui o de mesmo id, acrescenta o novo, não tira nada", () => {
  const m = A.mesclarImportacao(atual, arquivo);
  assert.deepStrictEqual(m.dados.clientes.map((c) => [c.id, c.nome, c._versao]), [["c1", "Ana Maria", "cv1"], ["c2", "Bia", undefined], ["c3", "Caio", undefined]]);
  assert.strictEqual(m.dados.obras.length, 1);
  assert.deepStrictEqual(m.dados.lancamentos.map((l) => l.id), ["l1", "l2"]);
  assert.deepStrictEqual(m.dados.fornecedores, atual.fornecedores);
  assert.deepStrictEqual(m.dados.escritorio, { nome: "Padovan Arq", equipe: [{ nome: "Renato" }], _versao: "ev1" });
  assert.deepStrictEqual(m.dados.projetos.map((p) => p.id).sort(), ["PRJ-or1", "PRJ-or2"]);
  assert.strictEqual(m.dados.cub, atual.cub);
});
await teste("gravar a importação não apaga nada no servidor (antes: DELETE de tudo que faltava no arquivo)", async () => {
  chamadas.length = 0;
  await A.saveAllData({ ...arquivo, projetos: [] }, atual);
  assert.ok(chamadas.some((c) => c.startsWith("DELETE")), "controle: gravar o arquivo como os dados inteiros apaga");
  chamadas.length = 0;
  await A.saveAllData(A.mesclarImportacao(atual, arquivo).dados, atual);
  assert.deepStrictEqual(chamadas.filter((c) => c.startsWith("DELETE")), []);
  assert.ok(chamadas.includes("POST /api/clientes") && chamadas.includes("PUT /api/escritorio"));
});
await teste("o projeto do orçamento ganho que já existia não vira 'finalizado' ao importar", async () => {
  const corpos = [];
  const fetchAntes = globalThis.fetch;
  globalThis.fetch = async (url, op) => { if (url.endsWith("/api/orcamentos")) corpos.push(JSON.parse(op.body)); return fetchAntes(url, op); };
  try { await A.saveAllData(A.mesclarImportacao(atual, arquivo).dados, atual); } finally { globalThis.fetch = fetchAntes; }
  assert.ok(!corpos.some((o) => o.id === "or1"), "or1 não mudou: não regrava");
  const or2 = corpos.find((o) => o.id === "or2");
  assert.ok(or2 && !or2.projeto.finalizado && or2.projeto.colunaEtapa === "estudo");
});
await teste("a confirmação diz quantos de cada tipo entram e quantos substituem", () => {
  const t = A.resumoDaImportacao(A.mesclarImportacao(atual, arquivo));
  assert.ok(/Clientes: 2 \(1 novo, 1 substitui o atual\)/.test(t), t);
  assert.ok(/Lançamentos: 1 \(1 novo\)/.test(t), t);
  assert.ok(/Orçamentos: 1 \(1 novo\)/.test(t), t);
  assert.ok(!/Obras:/.test(t), "lista vazia no arquivo não aparece");
  assert.ok(/Escritório/.test(t) && /Nada do que já está no sistema é apagado/.test(t), t);
});
await teste("importarDados (app.jsx) mescla e pede confirmação antes de gravar", () => {
  const f = app.slice(app.indexOf("  function importarDados"), app.indexOf("  // Renderiza modal de conflito"));
  assert.ok(/mesclarImportacao\(/.test(f) && /dialogo\.confirmar\(/.test(f) && /resumoDaImportacao\(/.test(f));
  assert.ok(!/await save\(parsed\)/.test(f), "não grava mais o arquivo como os dados inteiros");
  assert.ok(f.indexOf("dialogo.confirmar") < f.indexOf("await save("), "confirma antes de gravar");
});

// ── 4. HTML de e-mail externo não roda na página ─────────────────────
await teste("mensagens: body_html vai num iframe sandbox sem allow-scripts nem allow-same-origin", () => {
  const m = mod("mensagens.jsx");
  assert.ok(!/__html:\s*selecionada\.body_html/.test(m), "nada de dangerouslySetInnerHTML com o e-mail");
  const ifr = m.slice(m.indexOf("<iframe"), m.indexOf("/>", m.indexOf("<iframe")));
  assert.ok(/sandbox="/.test(ifr) && /srcDoc=\{/.test(ifr) && /selecionada\.body_html/.test(ifr), ifr);
  const sb = ifr.match(/sandbox="([^"]*)"/)[1];
  assert.ok(!/allow-scripts/.test(sb) && !/allow-same-origin/.test(sb), sb);
});

console.log(`\n${passou}/${passou + falhou} passaram`);
if (falhou) process.exit(1);
