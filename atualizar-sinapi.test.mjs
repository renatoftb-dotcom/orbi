// Testes do scripts/atualizar-sinapi.mjs (node, sem framework).
// Roda com: node atualizar-sinapi.test.mjs — copia as sementes para uma
// pasta temporária e roda o script lá, sem tocar no repositório.

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
import assert from "assert";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tmp = join(tmpdir(), `vicke-sinapi-${process.pid}`);
mkdirSync(join(tmp, "src", "modules"), { recursive: true });
mkdirSync(join(tmp, "scripts"), { recursive: true });
mkdirSync(join(tmp, "docs", "referencia-orcamento"), { recursive: true });
for (const f of ["cronograma-seed.jsx", "insumos-seed-cadastro.jsx"]) cpSync(join(__dirname, "src", "modules", f), join(tmp, "src", "modules", f));
cpSync(join(__dirname, "scripts", "atualizar-sinapi.mjs"), join(tmp, "scripts", "atualizar-sinapi.mjs"));
const script = join(tmp, "scripts", "atualizar-sinapi.mjs");
const rodar = (...args) => execFileSync(process.execPath, [script, ...args], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });

let passou = 0, falhou = 0;
function teste(nome, fn) {
  try { fn(); passou++; console.log(`  ok  ${nome}`); }
  catch (e) { falhou++; console.log(`FALHOU  ${nome}`); console.log(`        ${e.message}`); }
}

const lista = JSON.parse(rodar("listar"));
teste("listar: 62 composições (11 horistas + receitas), 14 insumos, 2 serviços manuais", () => {
  assert.strictEqual(lista.composicoes.length, 62);
  assert.strictEqual(lista.composicoes.filter((c) => c.horista).length, 11);
  assert.strictEqual(lista.insumos.length, 14);
  assert.deepStrictEqual(lista.servicosManuais, ["HIDRO_BANHEIRO", "ESGOTO_BANHEIRO"]);
  assert.ok(lista.composicoes.every((c) => /^https:\/\/buscadorsinapi\.com\.br\/sp\/composicao\/\d+$/.test(c.url)));
});

const seedSrc = readFileSync(join(tmp, "src", "modules", "cronograma-seed.jsx"), "utf-8");
const S = new Function(seedSrc + "\nreturn { PRECO_HORA_SEED, PRODUTIVIDADE_SEED };")();
function coletaBase() {
  const c = { referencia: "jul/2026", coletadoEm: "2026-09-06", composicoes: {}, insumos: {} };
  for (const p of Object.values(S.PRECO_HORA_SEED)) c.composicoes[p.codigo] = { precoDesonerado: p.desonerado, precoOnerado: p.onerado, maoDeObra: [] };
  c.composicoes["103328"] = { precoDesonerado: 112.67, precoOnerado: 117.47, maoDeObra: [{ nome: "PEDREIRO COM ENCARGOS COMPLEMENTARES", coeficiente: 1.61 }, { nome: "SERVENTE COM ENCARGOS COMPLEMENTARES", coeficiente: 0.805 }] };
  c.composicoes["88485"] = { maoDeObra: [{ nome: "Pintor", coeficiente: 0.0666 }, { nome: "Servente", coeficiente: 0.0222 }] };
  c.composicoes["88497"] = { maoDeObra: [{ nome: "PINTOR", coeficiente: 0.361 }, { nome: "SERVENTE", coeficiente: 0.1203 }] };
  c.composicoes["88489"] = { maoDeObra: [{ nome: "PINTOR", coeficiente: 0.1631 }, { nome: "SERVENTE", coeficiente: 0.0544 }] };
  c.composicoes["92761"] = { maoDeObra: [{ nome: "ARMADOR", coeficiente: 0.0561 }, { nome: "AJUDANTE DE ARMADOR", coeficiente: 0.0092 }] };
  c.composicoes["92802"] = { maoDeObra: [{ nome: "ARMADOR", coeficiente: 0.0162 }, { nome: "AJUDANTE DE ARMADOR", coeficiente: 0.0026 }] };
  c.insumos["2391"] = { precoDesonerado: 322.39 };
  return c;
}
const arq = (nome, obj) => { const p = join(tmp, nome); writeFileSync(p, JSON.stringify(obj)); return p; };

teste("coleta igual à semente: 0 alterações (pintura, armação e alvenaria recalculadas batem)", () => {
  const out = rodar("aplicar", arq("c0.json", coletaBase()), "--simular");
  assert.ok(/0 alteração/.test(out), out.split("\n").slice(0, 4).join(" | "));
});

teste("mudanças pequenas são aplicadas; grandes ficam pendentes; --simular não grava", () => {
  const c = coletaBase();
  c.referencia = "ago/2026";
  c.composicoes["88309"].precoDesonerado = 36.2; c.composicoes["88309"].precoOnerado = 38.3;
  c.composicoes["103328"].maoDeObra[0].coeficiente = 1.7;
  c.composicoes["88267"].precoDesonerado = 54; c.composicoes["88267"].precoOnerado = 57;
  c.insumos["2391"].precoDesonerado = 330;
  const p = arq("c1.json", c);
  const sim = rodar("aplicar", p, "--simular");
  assert.ok(/4 alteração/.test(sim));
  assert.ok(/pedreiro \(88309\): 35\.18 \/ 37\.26 → 36\.2 \/ 38\.3/.test(sim));
  assert.ok(/ALVENARIA: .*"pedreiro":1\.7/.test(sim));
  assert.ok(/encanador \(88267\).*não aplicado/.test(sim));
  assert.ok(/ELE-038 .*322\.39 → 330/.test(sim));
  assert.strictEqual(readFileSync(join(tmp, "src", "modules", "cronograma-seed.jsx"), "utf-8"), seedSrc);

  rodar("aplicar", p);
  const novo = readFileSync(join(tmp, "src", "modules", "cronograma-seed.jsx"), "utf-8");
  const N = new Function(novo + "\nreturn { PRECO_HORA_SEED, PRODUTIVIDADE_SEED, PRECO_HORA_REFERENCIA };")();
  assert.strictEqual(N.PRECO_HORA_SEED.pedreiro.desonerado, 36.2);
  assert.strictEqual(N.PRECO_HORA_SEED.encanador.desonerado, 38.54);
  assert.strictEqual(N.PRODUTIVIDADE_SEED.ALVENARIA.horas.pedreiro, 1.7);
  assert.strictEqual(N.PRECO_HORA_REFERENCIA, "SINAPI SP ago/2026");
  const ins = readFileSync(join(tmp, "src", "modules", "insumos-seed-cadastro.jsx"), "utf-8");
  assert.ok(/ELE-038[^\n]*precoReferencia:330[^\n]*precoData:"2026-09-06"[^\n]*SINAPI-SP ago\/2026/.test(ins));
  new Function(ins + "\nreturn 1;")();
  assert.ok(existsSync(join(tmp, "docs", "referencia-orcamento", "SINAPI-ATUALIZACAO-ago-2026.md")));
});

teste("--forcar aplica a variação grande", () => {
  const c = coletaBase();
  c.composicoes["88267"].precoDesonerado = 54; c.composicoes["88267"].precoOnerado = 57;
  rodar("aplicar", arq("c2.json", c), "--forcar");
  const N = new Function(readFileSync(join(tmp, "src", "modules", "cronograma-seed.jsx"), "utf-8") + "\nreturn PRECO_HORA_SEED;")();
  assert.strictEqual(N.encanador.desonerado, 54);
});

teste("coleta sem referência é rejeitada", () => {
  assert.throws(() => rodar("aplicar", arq("c3.json", { composicoes: {} })), /referencia/);
});

rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou) process.exit(1);
