// A ponte entre as etapas do motor de orçamento e os ids de ETAPAS_OBRA.
// Roda com: node etapas-ponte.test.mjs
//
// O teste mais importante daqui não é nenhum caso que eu escrevi à mão: é o
// último, que lê o motor de orçamento e exige que TODA etapa que ele emite
// tenha tradução. Uma etapa nova sem apelido deixa de somar com o realizado
// e some em silêncio — é o tipo de erro que só aparece no fechamento.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mod = (nome) => readFileSync(join(__dirname, "src", "modules", nome), "utf-8");

const M = new Function(`
  ${mod("obra-financeiro.jsx")}
  return { ETAPAS_OBRA, normalizarNomeEtapa, pavimentoDaSubEtapa,
           etapaDoOrcamento, etapasDoOrcamentoSemMapa };
`)();

let passou = 0, falhou = 0;
function teste(nome, fn) {
  try { fn(); passou++; console.log(`  ok   ${nome}`); }
  catch (e) { falhou++; console.log(`FALHOU ${nome}`); console.log(`       ${e.message}`); }
}
const id = (e, s) => M.etapaDoOrcamento(e, s);
const existe = (x) => M.ETAPAS_OBRA.some((e) => e.id === x);

teste("o nome normalizado já resolve a maioria, sem apelido nenhum", () => {
  assert.strictEqual(id("Fundação"), "fundacao");
  assert.strictEqual(id("Chapisco e Reboco"), "chapisco_reboco", "a caixa não pode importar");
  assert.strictEqual(id("Instalações pré obra e projetos"), "pre_obra", "nem o hífen que falta");
  assert.strictEqual(id("Pisos e revestimentos"), "pisos_revest");
  assert.strictEqual(id("Prestadores de serviços"), "prestadores");
  assert.strictEqual(id("Marcação obra"), "marcacao_obra");
  assert.strictEqual(id("Pintura"), "pintura");
  assert.strictEqual(id("Forros"), "forros");
  assert.strictEqual(id("Esquadrias"), "esquadrias");
  assert.strictEqual(id("Contrapisos Externos"), "contrapiso_ext");
});

teste("o que a planilha escreve diferente tem apelido", () => {
  assert.strictEqual(id("Cobertura"), "coberturas");
  assert.strictEqual(id("Demolições e remoções"), "demolicoes");
  assert.strictEqual(id("Entulho"), "demolicoes", "entulho é a mesma etapa da demolição");
  assert.strictEqual(id("Locação Equipamentos"), "locacao_equip");
  assert.strictEqual(id("Muro Arrimo"), "arrimos", "arrimo segura terra; muro de divisa é outra coisa");
  assert.strictEqual(id("Muro Divisa"), "muros");
  assert.strictEqual(id("Contrapiso Interno"), "contrapiso_int_1");
  assert.strictEqual(id("Contrapiso Interno Pav 1"), "contrapiso_int_1");
});

teste("térreo da planilha é o pav. 1 da obra — e 'Pav 1' é o de cima", () => {
  // as duas subetapas aparecem lado a lado no motor ("Laje Térreo" e
  // "Laje Pav 1"), e é isso que fixa a leitura
  assert.strictEqual(id("Viga Respaldo e Laje", "Viga Respaldo Térreo"), "laje_1");
  assert.strictEqual(id("Viga Respaldo e Laje", "Laje Maciça Térreo"), "laje_1");
  assert.strictEqual(id("Viga Respaldo e Laje", "Viga Respaldo Pav 1"), "laje_2");
  assert.strictEqual(id("Viga Respaldo e Laje", "Laje Pav 1"), "laje_2");
  assert.strictEqual(id("Supra estrutura e paredes", "Paredes"), "supra_paredes_1",
    "sem dizer o pavimento, é o térreo");
  assert.strictEqual(id("Supra estrutura e paredes", "Supra Cobertura"), "supra_paredes_1");
  assert.strictEqual(M.pavimentoDaSubEtapa("Massiamento contrap Pav. Térreo"), 1);
  assert.strictEqual(M.pavimentoDaSubEtapa("Massiamento contrap Pav 1"), 2);
});

teste("Piscina é sete etapas na obra — quem decide é a subetapa", () => {
  assert.strictEqual(id("Piscina", "Brocas"), "piscina_fundacao");
  assert.strictEqual(id("Piscina", "Supra Estrutura"), "piscina_supra");
  assert.strictEqual(id("Piscina", "Paredes"), "piscina_supra");
  assert.strictEqual(id("Piscina", "Impermeabilização"), "piscina_imp");
  assert.strictEqual(id("Piscina", "Revestimento"), "piscina_revest");
  assert.strictEqual(id("Piscina", "Contrapiso"), "piscina_deck");
  assert.strictEqual(id("Piscina", "Diversas"), "piscina_equip");
  assert.strictEqual(id("Piscina", ""), "", "piscina sem subetapa não vira chute");
});

teste("todo id que a ponte devolve existe mesmo em ETAPAS_OBRA", () => {
  const amostra = ["Fundação", "Cobertura", "Muro Arrimo", "Muro Divisa", "Entulho",
    "Locação Equipamentos", "Contrapiso Interno", "Chapisco e Reboco"];
  for (const e of amostra) assert.ok(existe(id(e)), `${e} aponta para id que não existe: ${id(e)}`);
  for (const s of ["Brocas", "Supra Estrutura", "Impermeabilização", "Revestimento", "Contrapiso", "Diversas"]) {
    assert.ok(existe(id("Piscina", s)), `Piscina/${s} aponta para id inexistente`);
  }
  for (const s of ["Viga Respaldo Térreo", "Viga Respaldo Pav 1"]) assert.ok(existe(id("Viga Respaldo e Laje", s)));
});

teste("linha já traduzida passa reto, e lixo não vira etapa", () => {
  assert.strictEqual(id("fundacao"), "fundacao", "o id cru também serve");
  assert.strictEqual(id("Etapa que não existe"), "");
  assert.strictEqual(id(""), "");
  assert.strictEqual(id(null), "");
});

teste("o que não traduz é listado, não é enfiado em Outros", () => {
  const fora = M.etapasDoOrcamentoSemMapa([
    { etapa: "Fundação", subEtapa: "Brocas" },
    { etapa: "Construção existente", subEtapa: "Parede de drywall" },
    { etapa: "Construção existente", subEtapa: "Parede de drywall" },
    { etapa: "Fundação", subEtapa: "" },
  ]);
  assert.strictEqual(fora.length, 1);
  assert.strictEqual(fora[0].etapa, "Construção existente");
  assert.strictEqual(fora[0].linhas, 2, "conta quantas linhas estão caindo fora");
});

// ── A guarda de verdade ────────────────────────────────────────
teste("TODA etapa que o motor de orçamento emite tem tradução", () => {
  const src = mod("orcamento-obra.jsx");
  const nomes = new Set();
  for (const m of src.matchAll(/etapa: *"([^"]+)"/g)) nomes.add(m[1]);
  for (const m of src.matchAll(/const etapa = "([^"]+)"/g)) nomes.add(m[1]);
  assert.ok(nomes.size >= 20, `o motor deveria emitir dezenas de etapas, achei ${nomes.size}`);

  // as subetapas que o motor usa, para resolver as etapas que dependem delas
  const subs = new Set([""]);
  for (const m of src.matchAll(/subEtapa: *"([^"]+)"/g)) subs.add(m[1]);

  // Conhecidas e assumidas: "Construção existente" é a obra que já está em
  // pé numa reforma e não corresponde a UMA etapa — fica fora de propósito,
  // e aparece na tela como sem etapa até alguém classificar.
  const aceitasSemMapa = new Set(["Construção existente"]);

  const semMapa = [];
  for (const nome of nomes) {
    if (aceitasSemMapa.has(nome)) continue;
    // resolve se traduz sozinha OU com alguma subetapa do próprio motor
    const traduz = M.etapaDoOrcamento(nome, "")
      || [...subs].some((s) => M.etapaDoOrcamento(nome, s));
    if (!traduz) semMapa.push(nome);
  }
  assert.deepStrictEqual(semMapa, [],
    "etapa nova no motor sem apelido some do custo por etapa em silêncio");
});

console.log(`\n${passou} passou, ${falhou} falhou`);
if (falhou) process.exit(1);
