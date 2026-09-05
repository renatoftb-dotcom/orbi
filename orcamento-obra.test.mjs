// Testes puros (node, sem framework) do motor de orçamento de obra.
// Cobre as asserções de prestadores e taxaGestaoObra da §9 da spec
// (docs/SPEC-ORCAMENTO-OBRA.md). Roda com: node orcamento-obra.test.mjs
//
// Não dá pra `import` direto de src/modules/orcamento-obra.jsx (não tem
// export — o combine.js concatena tudo num escopo global de propósito).
// Este teste lê o arquivo fonte e faz `new Function` com as declarações
// necessárias, expondo só o que precisa pra testar.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, "src", "modules", "orcamento-obra.jsx"), "utf-8");

const modulo = new Function(`
  ${src}
  return {
    PERDA, BARRA_FERRO_MTS, PESOS_FERRO, ORD, TAXAS_PRESTADORES,
    taxaGestaoObra, emitir, precoDoInsumo,
    paredesTerreo, pintura, prestadores,
    normalizarProjeto, gerarOrcamentoObra, precificarETotalizar,
  };
`)();

const {
  PESOS_FERRO, taxaGestaoObra, paredesTerreo, pintura, prestadores, normalizarProjeto,
} = modulo;

let passou = 0;
let falhou = 0;

function teste(nome, fn) {
  try {
    fn();
    passou++;
    console.log(`  ok  ${nome}`);
  } catch (e) {
    falhou++;
    console.log(`FALHOU  ${nome}`);
    console.log(`        ${e.message}`);
  }
}

function centavos(x) {
  return Math.round(x * 100);
}

function acharItem(out, nome) {
  const item = out.find((i) => i.item === nome);
  assert.ok(item, `linha "${nome}" não foi emitida`);
  return item;
}

function totalDe(item) {
  return item.qtd * item.preco;
}

// ── Caso de referência, §9 da spec ──
const projetoReferencia = {
  tipologia: "Sobrado",
  arquitetura: {
    areaConstruida: 330.86,
    m2ParedesInternas: 282,
    m2ParedesExternas: 553,
  },
  terreo: {
    m2Parede20: 452.05,
    vaoPortasJanelas: 49,
  },
  externa: {
    revestimentoInterno: 186,
    pavimentacao: 215,
    muroDivisa: { comprimento: 78, altura: 2 },
  },
};

const cpReferencia = normalizarProjeto(projetoReferencia);

console.log("\n--- taxaGestaoObra (§9) ---");
teste("200 m² → 550", () => assert.strictEqual(taxaGestaoObra(200), 550));
teste("250 m² → 530", () => assert.strictEqual(taxaGestaoObra(250), 530));
teste("300 m² → 510", () => assert.strictEqual(taxaGestaoObra(300), 510));
teste("350 m² → 490", () => assert.strictEqual(taxaGestaoObra(350), 490));
teste("400 m² → 470", () => assert.strictEqual(taxaGestaoObra(400), 470));
teste("450 m² → 450", () => assert.strictEqual(taxaGestaoObra(450), 450));
teste("500 m² → 430", () => assert.strictEqual(taxaGestaoObra(500), 430));

console.log("\n--- prestadores() — caso de referência (bater ao centavo) ---");
const outPrestadores = [];
prestadores(cpReferencia, outPrestadores);

const casosCentavos = [
  ["Pedreiros Casa", 330860.00],
  ["Pintor", 33086.00],
  ["Eletricista", 26468.80],
  ["Encanador", 19851.60],
  ["Gestão Obra", 162121.40],
  ["Pedreiros Pavim. Externa", 25800.00],
  ["Pedreiros Muro Divisa", 20280.00],
  ["Terraplanagem", 8000.00],
];

for (const [nome, esperado] of casosCentavos) {
  teste(`${nome} = R$ ${esperado.toFixed(2)}`, () => {
    const item = acharItem(outPrestadores, nome);
    assert.strictEqual(centavos(totalDe(item)), centavos(esperado));
  });
}

console.log("\n--- Barras de ferro (§9) ---");
teste("ceil(804/12 × 1.1) = 74 barras de CA50 8mm, peso 355.2kg", () => {
  const cp = normalizarProjeto({
    arquitetura: {},
    terreo: {},
  });
  cp.ca50_8mmColunaTerreo = 804;
  const out = [];
  paredesTerreo(cp, out);
  const item = acharItem(out, "Aço - Barras de CA50 8.0mm 12mts");
  assert.strictEqual(item.qtd, 74);
  assert.strictEqual(item.qtd * PESOS_FERRO.CA50_8MM, 355.2);
});

console.log("\n--- paredesTerreo() — caso de referência ---");
const outParedes = [];
paredesTerreo(cpReferencia, outParedes);
teste("nenhuma linha com qtd = 0", () => {
  for (const item of outParedes) assert.notStrictEqual(item.qtd, 0);
});
console.log(`  (paredesTerreo emitiu ${outParedes.length} linhas com os inputs de referência)`);

console.log("\n--- pintura() — caso de referência ---");
const outPintura = [];
pintura(cpReferencia, outPintura);
console.log(`  (pintura emitiu ${outPintura.length} linhas com os inputs de referência)`);

console.log(`\n--- prestadores() — resumo ---`);
console.log(`  (prestadores emitiu ${outPrestadores.length} linhas com os inputs de referência)`);

console.log(`\n${passou} passou, ${falhou} falhou`);
if (falhou > 0) process.exit(1);
