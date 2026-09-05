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
const srcCompleto = readFileSync(join(__dirname, "src", "modules", "orcamento-obra.jsx"), "utf-8");

// O arquivo tem JSX na parte de UI (§7), que este harness em Node puro (sem
// Babel) não consegue avaliar via `new Function`. O motor de cálculo é 100%
// JS puro e termina antes do marcador abaixo — cortamos ali.
const marcador = "// UI (§7)";
const idx = srcCompleto.indexOf(marcador);
if (idx === -1) throw new Error(`Marcador "${marcador}" não encontrado em orcamento-obra.jsx`);
const src = srcCompleto.slice(0, idx);

const modulo = new Function(`
  ${src}
  return {
    PERDA, BARRA_FERRO_MTS, PESOS_FERRO, ORD, TAXAS_PRESTADORES,
    taxaGestaoObra, emitir, precoDoInsumo,
    paredesTerreo, pintura, prestadores,
    normalizarProjeto, gerarOrcamentoObra, precificarETotalizar,
    calcularEsquadria, metrosPorRegra, barrasPalhetas, ESQUADRIAS_CATALOGO,
    vidroEsquadria, acessoriosEsquadria, ESQUADRIAS_FAMILIAS, ESQUADRIAS_ACESSORIOS,
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

console.log("\n--- esquadrias() — catálogo GOLD ---");
const { calcularEsquadria, metrosPorRegra, barrasPalhetas, ESQUADRIAS_CATALOGO, gerarOrcamentoObra,
        vidroEsquadria, acessoriosEsquadria, ESQUADRIAS_FAMILIAS, ESQUADRIAS_ACESSORIOS } = modulo;
const kgDe = (linhas) => linhas.filter((l) => l.unidade === "Kg").reduce((a, l) => a + l.qtd, 0);

teste("regras de metragem da aba viram metros", () => {
  assert.strictEqual(metrosPorRegra("2 LARGURAS", 1.5, 1.2, 2), 3);
  assert.strictEqual(metrosPorRegra("2 ALTURA", 1.5, 1.2, 2), 2.4);
  assert.strictEqual(metrosPorRegra("1 LARGURAS", 1.5, 1.2, 2), 1.5);
  assert.ok(Math.abs(metrosPorRegra("6 ALTURAS", 1.5, 1.2, 4) - 7.2) < 1e-9);
  assert.ok(Math.abs(metrosPorRegra("2 ALTURAS POR FOLHA", 1.5, 1.2, 3) - 7.2) < 1e-9);
  assert.strictEqual(metrosPorRegra("2 ALTURAS + 2 LARGURAS", 1.5, 1.2, 2), 5.4);
  assert.strictEqual(metrosPorRegra("1 LARGURA E 2 ALTURAS", 1.5, 1.2, 2), 3.9);
  assert.ok(Math.abs(metrosPorRegra("2 ALTURAS MENOS 14 CM", 1.5, 1.2, 2) - 2.12) < 1e-9);
  assert.strictEqual(metrosPorRegra("REGRA INVENTADA", 1.5, 1.2, 2), 0);
});

teste("catálogo GOLD tem os 7 tipos da aba + giro, maxim-ar e fixo do catálogo Alcoa", () => {
  const chaves = Object.keys(ESQUADRIAS_CATALOGO.GOLD).sort();
  assert.deepStrictEqual(chaves, [
    "JANELA_CORRER|2", "JANELA_CORRER|3", "JANELA_CORRER|4", "JANELA_PERSIANA|2",
    "MAXIM_AR|1", "MAXIM_AR|2", "PORTA_CORRER|2", "PORTA_CORRER|3", "PORTA_CORRER|4",
    "PORTA_GIRO|1", "PORTA_GIRO|2", "QUADRO_FIXO|1",
  ]);
  // toda combinação família×folhas oferecida na UI tem lista na Gold
  for (const f of ESQUADRIAS_FAMILIAS) for (const n of f.folhas) assert.ok(ESQUADRIAS_CATALOGO.GOLD[`${f.id}|${n}`], `${f.id}|${n}`);
  // toda família tem lista de acessórios
  for (const f of ESQUADRIAS_FAMILIAS) assert.ok(ESQUADRIAS_ACESSORIOS[f.id].length > 0, f.id);
});

teste("regra '2 ALTURAS POR FOLHA + 2 LARGURAS' (maxim-ar/baguete)", () => {
  assert.ok(Math.abs(metrosPorRegra("2 ALTURAS POR FOLHA + 2 LARGURAS", 1.5, 1.2, 2) - 7.8) < 1e-9);
});

teste("vidro: correr desconta 14 cm na altura; giro/fixo/maxim-ar usam as cotas de corte do catálogo", () => {
  assert.ok(Math.abs(vidroEsquadria("JANELA_CORRER", 1.5, 1.2, 2).area - 1.5 * 1.06) < 1e-9);
  // porta de giro 1F 0,90×2,10: (0,90−0,205)×(2,10−0,2863)
  assert.ok(Math.abs(vidroEsquadria("PORTA_GIRO", 0.9, 2.1, 1).area - 0.695 * 1.8137) < 1e-9);
  // fixo 1,00×1,00: (1−0,1179)²
  assert.ok(Math.abs(vidroEsquadria("QUADRO_FIXO", 1, 1, 1).area - 0.8821 ** 2) < 1e-9);
  // maxim-ar 2F 1,20×0,60: cada folha (1,20−0,032)/2 − 0,1269, altura 0,60−0,1526
  const mx = vidroEsquadria("MAXIM_AR", 1.2, 0.6, 2);
  assert.ok(Math.abs(mx.area - 2 * ((1.2 - 0.032) / 2 - 0.1269) * (0.6 - 0.1526)) < 1e-9);
});

teste("porta de giro 2 folhas GOLD 1,60×2,10 → alumínio, vidro, 6 dobradiças, 1 fechadura, kit batente central", () => {
  const avisos = [];
  const linhas = calcularEsquadria({ familia: "PORTA_GIRO", linha: "GOLD", folhas: 2, qtd: 1, largura: 1.6, altura: 2.1 }, avisos);
  assert.strictEqual(avisos.length, 0);
  const kg = kgDe(linhas);
  assert.ok(kg > 25 && kg < 35, `kg fora da faixa esperada: ${kg}`);
  assert.ok(linhas.some((l) => l.item.includes("GN053")), "batente central só em 2 folhas");
  assert.strictEqual(linhas.find((l) => l.item.includes("DOB")).qtd, 6);
  assert.strictEqual(linhas.find((l) => l.item.includes("FECH")).qtd, 1);
  assert.strictEqual(linhas.find((l) => l.item.includes("KITGN16")).qtd, 1);
  const vidro = linhas.find((l) => l.item === "Vidro 8mm");
  assert.ok(Math.abs(vidro.qtd - Math.round((1.6 - 0.3735) * (2.1 - 0.2863) * 100) / 100) < 1e-9);
  // 1 folha: sem batente central nem kit
  const uma = calcularEsquadria({ familia: "PORTA_GIRO", linha: "GOLD", folhas: 1, qtd: 1, largura: 0.9, altura: 2.1 }, []);
  assert.ok(!uma.some((l) => l.item.includes("GN053")));
  assert.ok(!uma.some((l) => l.item.includes("KITGN16")));
  assert.strictEqual(uma.find((l) => l.item.includes("DOB")).qtd, 3);
});

teste("maxim-ar 1 folha e quadro fixo GOLD emitem perfis, vidro e acessórios", () => {
  const mx = calcularEsquadria({ familia: "MAXIM_AR", linha: "GOLD", folhas: 1, qtd: 2, largura: 0.8, altura: 0.6 }, []);
  assert.ok(kgDe(mx) > 0);
  assert.strictEqual(mx.find((l) => l.item.includes("BRA832")).qtd, 2);   // 1 par por folha × 2 peças
  assert.strictEqual(mx.find((l) => l.item.includes("FEC1212")).qtd, 2);
  const fx = calcularEsquadria({ familia: "QUADRO_FIXO", linha: "GOLD", folhas: 1, qtd: 1, largura: 1, altura: 1 }, []);
  assert.strictEqual(fx.filter((l) => l.unidade === "Kg").length, 6);
  assert.strictEqual(fx.find((l) => l.item === "Vidro 8mm").qtd, 0.78);
  assert.strictEqual(fx.find((l) => l.item.includes("CHU838")).qtd, 8);  // perímetro 4 m ÷ 0,5
});

teste("acessórios: porta de correr tem fecho com chave 1× e concha nas demais folhas; borracha em metros", () => {
  const a = acessoriosEsquadria("PORTA_CORRER", 2, 2.1, 3);
  assert.strictEqual(a.find((x) => x.codigo === "FEC1208").qtd, 1);
  assert.strictEqual(a.find((x) => x.codigo === "FEC1106").qtd, 2);
  assert.strictEqual(a.find((x) => x.codigo === "KITGN05").qtd, 3);
  const gua = a.find((x) => x.codigo === "GUA006");
  assert.strictEqual(gua.unidade, "Mts");
  assert.ok(gua.qtd > 0);
});

teste("SUPREMA: janela de correr 2 folhas emite com perfis SU-, mais leve que a Gold, e avisa que é aproximada", () => {
  const avisos = [];
  const su = calcularEsquadria({ familia: "JANELA_CORRER", linha: "SUPREMA", folhas: 2, qtd: 1, largura: 1.5, altura: 1.2 }, avisos);
  const au = calcularEsquadria({ familia: "JANELA_CORRER", linha: "GOLD", folhas: 2, qtd: 1, largura: 1.5, altura: 1.2 }, []);
  assert.ok(su.some((l) => l.item.includes("SU-001")));
  assert.ok(kgDe(su) < kgDe(au), `${kgDe(su)} vs ${kgDe(au)}`);
  assert.strictEqual(avisos.filter((a) => a.tipo === "esquadria_linha_aproximada").length, 1);
  // aviso não repete na segunda esquadria da mesma linha
  calcularEsquadria({ familia: "PORTA_CORRER", linha: "SUPREMA", folhas: 2, qtd: 1, largura: 2, altura: 2.1 }, avisos);
  assert.strictEqual(avisos.filter((a) => a.tipo === "esquadria_linha_aproximada").length, 1);
});

teste("janela correr 2 folhas GOLD 1,50×1,20 → ~16,3 kg de alumínio e 1,59 m² de vidro", () => {
  const linhas = calcularEsquadria({ familia: "JANELA_CORRER", linha: "GOLD", folhas: 2, qtd: 1, largura: 1.5, altura: 1.2 }, []);
  const kg = linhas.filter((l) => l.unidade === "Kg").reduce((a, l) => a + l.qtd, 0);
  assert.ok(kg > 16.2 && kg < 16.4, `kg fora da faixa: ${kg}`);
  const vidro = linhas.find((l) => l.item === "Vidro 8mm");
  assert.strictEqual(vidro.qtd, 1.59);
  // RM039: 2 larguras × 0,205 kg/m
  const rm039 = linhas.find((l) => l.item.includes("RM039"));
  assert.strictEqual(rm039.qtd, 0.62);
});

teste("quantidade multiplica tudo", () => {
  const um = calcularEsquadria({ familia: "PORTA_CORRER", linha: "GOLD", folhas: 2, qtd: 1, largura: 2, altura: 2.1 }, []);
  const tres = calcularEsquadria({ familia: "PORTA_CORRER", linha: "GOLD", folhas: 2, qtd: 3, largura: 2, altura: 2.1 }, []);
  const kg1 = um.filter((l) => l.unidade === "Kg").reduce((a, l) => a + l.qtd, 0);
  const kg3 = tres.filter((l) => l.unidade === "Kg").reduce((a, l) => a + l.qtd, 0);
  assert.ok(Math.abs(kg3 - kg1 * 3) < 0.05, `${kg3} vs ${kg1 * 3}`);
});

teste("palhetas da persiana seguem a regra literal da aba", () => {
  // H=1,40 → (1,40−0,14)/0,04 = 31,5 palhetas; L=2 → cega = 31,5×0,2×2/6 = 2,1 barras
  const b = barrasPalhetas(2, 1.4);
  assert.ok(Math.abs(b.cega - 2.1) < 1e-9);
  assert.ok(Math.abs(b.ventilada - (31.5 * 2 / 6 - 2.1)) < 1e-9);
});

teste("tipo sem lista na linha (maxim-ar SUPREMA) não emite e avisa", () => {
  const avisos = [];
  const linhas = calcularEsquadria({ familia: "MAXIM_AR", linha: "SUPREMA", folhas: 1, qtd: 1, largura: 1.5, altura: 1.2 }, avisos);
  assert.strictEqual(linhas.length, 0);
  assert.strictEqual(avisos.length, 1);
  assert.ok(avisos[0].mensagem.includes("SUPREMA"));
});

teste("esquadria sem medida não emite nada", () => {
  assert.strictEqual(calcularEsquadria({ familia: "JANELA_CORRER", linha: "GOLD", folhas: 2, qtd: 1, largura: 0, altura: 1.2 }, []).length, 0);
});

teste("gerarOrcamentoObra emite etapa Esquadrias na ordem 17 e repassa avisos", () => {
  const r = gerarOrcamentoObra({ tipologia: "Térrea", esquadrias: [
    { familia: "JANELA_CORRER", linha: "GOLD", folhas: 2, qtd: 1, largura: 1.5, altura: 1.2 },
    { familia: "MAXIM_AR", linha: "SUPREMA", folhas: 1, qtd: 1, largura: 1.5, altura: 1.2 },
  ] }, { materiais: [] });
  const esq = r.itens.filter((i) => i.etapa === "Esquadrias");
  // 12 perfis + vidro + 10 acessórios da janela de correr Gold; maxim-ar Suprema sem lista → nada
  assert.strictEqual(esq.length, 12 + 1 + ESQUADRIAS_ACESSORIOS.JANELA_CORRER.length);
  assert.ok(esq.every((i) => i.ordem === 17 && i.tipo === "Acabamento"));
  assert.strictEqual(r.avisos.length, 1);
});

console.log(`\n${passou} passou, ${falhou} falhou`);
if (falhou > 0) process.exit(1);
