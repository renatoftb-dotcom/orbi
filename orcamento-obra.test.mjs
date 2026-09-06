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
const srcSeedComposicoes = readFileSync(join(__dirname, "src", "modules", "composicoes-seed.jsx"), "utf-8");
const src = srcSeedComposicoes + "\n" + srcCompleto.slice(0, idx);

const modulo = new Function(`
  ${src}
  return {
    PERDA, BARRA_FERRO_MTS, PESOS_FERRO, ORD, TAXAS_PRESTADORES,
    taxaGestaoObra, emitir, precoDoInsumo,
    paredesTerreo, pintura, prestadores,
    normalizarProjeto, gerarOrcamentoObra, precificarETotalizar,
    calcularEsquadria, metrosPorRegra, barrasPalhetas, ESQUADRIAS_CATALOGO,
    vidroEsquadria, acessoriosEsquadria, ESQUADRIAS_FAMILIAS, ESQUADRIAS_ACESSORIOS,
    interpretarListaColada, ETAPAS_PROJETO,
    instalacoesPorAmbiente, composicoesAtivas, COMPOSICOES_SEED, AMBIENTES_TIPOS, PONTOS_ELETRICOS,
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
const { calcularEsquadria, metrosPorRegra, barrasPalhetas, ESQUADRIAS_CATALOGO, gerarOrcamentoObra, precoDoInsumo,
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
  // uma linha por esquadria; maxim-ar Suprema sem lista → nada
  assert.strictEqual(esq.length, 1);
  assert.ok(esq.every((i) => i.ordem === 17 && i.tipo === "Acabamento" && i.unidade === "Unidades"));
  assert.strictEqual(esq[0].item, "Janela de correr 2 folhas · Gold · 1,50 × 1,20 m");
  // composição guardada no item: 12 perfis + vidro + acessórios
  assert.strictEqual(esq[0].composicao.length, 12 + 1 + ESQUADRIAS_ACESSORIOS.JANELA_CORRER.length);
  assert.ok(r.avisos.some((a) => a.tipo === "esquadria_sem_catalogo"), "aviso do tipo sem lista");
  assert.ok(r.avisos.some((a) => a.tipo === "esquadria_componente_sem_preco"), "sem catálogo de insumos → acessórios sem preço");
});

teste("preço fechado da esquadria = alumínio × R$ 39,80/kg + vidro × R$ 166,63/m² + acessórios, e a quantidade multiplica", () => {
  const um = gerarOrcamentoObra({ tipologia: "Térrea", esquadrias: [
    { familia: "PORTA_GIRO", linha: "GOLD", folhas: 2, qtd: 1, largura: 1.6, altura: 2.1 },
  ] }, { materiais: [] }).itens.find((i) => i.etapa === "Esquadrias");
  // sem catálogo de insumos: alumínio e vidro pela referência do VBA, acessórios a R$ 0 (marcados sem_preco)
  const esperado = um.composicao.reduce((a, c) => a + c.qtd * (c.unidade === "Kg" ? 39.8 : c.item === "Vidro 8mm" ? 166.63 : 0), 0);
  assert.ok(um.composicao.some((c) => c.fonte === "sem_preco"));
  assert.strictEqual(um.confianca, "parcial");
  assert.ok(Math.abs(um.preco - esperado) < 0.01, `${um.preco} vs ${esperado}`);
  assert.ok(um.preco > 1400 && um.preco < 1600, `preço fora da faixa: ${um.preco}`);
  const tres = gerarOrcamentoObra({ tipologia: "Térrea", esquadrias: [
    { familia: "PORTA_GIRO", linha: "GOLD", folhas: 2, qtd: 3, largura: 1.6, altura: 2.1 },
  ] }, { materiais: [] }).itens.find((i) => i.etapa === "Esquadrias");
  assert.strictEqual(tres.qtd, 3);
  assert.strictEqual(tres.preco, um.preco);
  assert.ok(Math.abs(tres.total - um.preco * 3) < 0.01);
});

console.log("\n--- precificação pelo catálogo de Insumos ---");
teste("sem catálogo, todo item entra com preço 0, semPreco e aviso; qualidade resume", () => {
  const r = gerarOrcamentoObra(projetoReferencia, { materiais: [] });
  assert.ok(r.itens.length > 20);
  const materiais = r.itens.filter((i) => i.tipo !== "Prestadores de serviços" && i.etapa !== "Esquadrias");
  assert.ok(materiais.every((i) => i.preco === 0 && i.semPreco === true && i.total === 0));
  assert.strictEqual(r.qualidade.semPreco.length, materiais.length);
  assert.ok(r.avisos.some((a) => a.tipo === "sem_preco"));
  // prestadores continuam com a taxa do VBA
  const ped = r.itens.find((i) => i.item === "Pedreiros Casa");
  assert.strictEqual(ped.preco, 1000);
  assert.strictEqual(ped.confianca, "modulo");
});

teste("precoDoInsumo devolve null sem catálogo (nunca R$ 1)", () => {
  const r = precoDoInsumo("Cimento CP II 50kg", { materiais: [] });
  assert.strictEqual(r.preco, null);
});

console.log("\n--- itens do projeto de engenharia ---");
const { interpretarListaColada, ETAPAS_PROJETO } = modulo;
teste("colar lista: 'nome ; qtd ; unidade', 'nome<TAB>qtd', '12 x nome' e linha sem número", () => {
  const l = interpretarListaColada("PVC - Esgoto - Tubo 100mm ; 12\nElétrica - Cabo Flex Cobre 2.5mm\t300\tMts\n8 x PVC - Esgoto - Joelho 90° 100mm\nCaixa d'água 1000L\n\n");
  assert.strictEqual(l.length, 4);
  assert.deepStrictEqual(l[0], { nome: "PVC - Esgoto - Tubo 100mm", qtd: 12, unidade: "" });
  assert.deepStrictEqual(l[1], { nome: "Elétrica - Cabo Flex Cobre 2.5mm", qtd: 300, unidade: "Mts" });
  assert.deepStrictEqual(l[2], { nome: "PVC - Esgoto - Joelho 90° 100mm", qtd: 8, unidade: "" });
  assert.deepStrictEqual(l[3], { nome: "Caixa d'água 1000L", qtd: 1, unidade: "" });
});

teste("itens do projeto entram na etapa escolhida; sem catálogo ficam sem preço e avisados", () => {
  const r = gerarOrcamentoObra({ tipologia: "Térrea", itensProjeto: [
    { etapa: "ESGOTO", nome: "PVC - Esgoto - Tubo 100mm", qtd: 12 },
    { etapa: "LOUCAS", nome: "Louça - Bacia com caixa acoplada", qtd: 3, unidade: "Unidades" },
    { etapa: "ESGOTO", nome: "sem quantidade", qtd: 0 },
  ] }, { materiais: [] });
  const esg = r.itens.filter((i) => i.etapa === "Esgoto e pluvial");
  assert.strictEqual(esg.length, 1);
  assert.strictEqual(esg[0].qtd, 12);
  assert.strictEqual(esg[0].tipo, "Bruto");
  assert.strictEqual(esg[0].ordem, ETAPAS_PROJETO.find((e) => e.id === "ESGOTO").ordem);
  assert.ok(esg[0].semPreco);
  const lou = r.itens.find((i) => i.etapa === "Louças e metais");
  assert.strictEqual(lou.tipo, "Acabamento");
  assert.strictEqual(lou.unidade, "Unidades");
  assert.ok(r.qualidade.semPreco.includes("PVC - Esgoto - Tubo 100mm"));
});

console.log("\n--- instalações por ambiente (kits) ---");
const { instalacoesPorAmbiente, composicoesAtivas, COMPOSICOES_SEED, AMBIENTES_TIPOS, PONTOS_ELETRICOS } = modulo;

teste("todo tipo de ambiente aponta para kits que existem; todo ponto elétrico tem kit", () => {
  for (const t of AMBIENTES_TIPOS) for (const disc of Object.keys(t.kits)) for (const id of t.kits[disc]) {
    assert.ok(COMPOSICOES_SEED[id], `${t.id} → ${id}`);
    assert.strictEqual(COMPOSICOES_SEED[id].disciplina, disc, `${id} disciplina`);
  }
  for (const p of PONTOS_ELETRICOS) assert.ok(COMPOSICOES_SEED[p.kit], p.kit);
  for (const [id, k] of Object.entries(COMPOSICOES_SEED)) for (const it of k.itens) assert.ok(it.nome && it.qtd > 0 && it.unidade, `${id}: ${JSON.stringify(it)}`);
});

teste("casa com 2 suítes, 1 lavabo, cozinha, lavanderia e 3 dormitórios gera kits somados por item, portas e circuitos", () => {
  const r = gerarOrcamentoObra({ tipologia: "Térrea", ambientes: { banheiroSuite: 2, lavabo: 1, cozinha: 1, lavanderia: 1, dormitorio: 3, salaEstar: 1 },
    instalacoes: { padrao: "Médio", aquecimento: "nenhum", pressurizador: false } }, { materiais: [] });
  const est = r.itens.filter((i) => i.subEtapa === "Estimativa por ambientes");
  assert.ok(est.length > 40, `poucos itens: ${est.length}`);
  // cada item aparece uma vez por disciplina (somado entre ambientes)
  const chaves = est.map((i) => i.etapa + "|" + i.item);
  assert.strictEqual(new Set(chaves).size, chaves.length);
  // sanitários: 2 suítes + 1 lavabo = 3
  assert.strictEqual(est.find((i) => i.item === "Louças - Sanitário").qtd, 3);
  // registros gaveta: 2 por suíte, lavabo, cozinha e lavanderia = 10
  assert.strictEqual(est.find((i) => i.item === "Metal - Hidráulica - Base Registro Gaveta 3/4").qtd, 10);
  // portas: 2 suítes + lavabo (WC) + 3 dormitórios + lavanderia (interna) = 7 folhas, 21 dobradiças
  assert.strictEqual(est.find((i) => i.item === "Portas Internas Comum").qtd, 7);
  assert.strictEqual(est.find((i) => i.item === "Fechaduras - Dobradiças- STAM").qtd, 21);
  // sem aquecimento → nada de CPVC
  assert.ok(!est.some((i) => /CPVC/.test(i.item)));
  // pontos: tomadas gerais = 2×2 + 1 + 4 + 2 + 3×4 + 5 = 24 → 4 disjuntores 20A + 2 das tomadas específicas… (aqui só o de circuito geral)
  const dj20 = est.find((i) => i.item === "Elétrica - Disjuntor Unipolar 20A - 10kA");
  assert.ok(dj20.qtd >= 4, `disjuntores 20A: ${dj20.qtd}`);
  assert.strictEqual(est.find((i) => i.item === "Elétrica - Disjuntor Bipolar 32A - 10kA").qtd, 2); // 2 chuveiros
  assert.ok(est.every((i) => i.ordem >= 18 && i.ordem <= 24));
  assert.ok(est.some((i) => i.etapa === "Portas internas" && i.tipo === "Acabamento"));
});

teste("padrão Alto troca os kits _ALTO; aquecimento solar e pressurizador entram por obra", () => {
  const r = gerarOrcamentoObra({ tipologia: "Térrea", ambientes: { banheiroSuite: 1 },
    instalacoes: { padrao: "Alto", aquecimento: "solar", pressurizador: true } }, { materiais: [] });
  const est = r.itens.filter((i) => i.subEtapa === "Estimativa por ambientes");
  assert.ok(est.some((i) => i.item === "Metal - Sifão Metálico"));
  assert.ok(!est.some((i) => i.item === "Metal - Sifão Flexível"));
  assert.ok(est.some((i) => i.item === "Portas Internas Sincol Sólida"));
  assert.ok(est.some((i) => i.item === "Equipamentos e Sistemas - Boiler Pressurizado 500 L"));
  assert.ok(est.some((i) => i.item === "Equipamentos e Sistemas - Pressurizador Casa"));
  assert.ok(est.some((i) => /CPVC -Tubo 22mm/.test(i.item)), "água quente do banheiro com aquecimento");
});

teste("disciplina marcada 'do projeto' sai da estimativa por kits; sem ambientes não emite nada", () => {
  const r = gerarOrcamentoObra({ tipologia: "Térrea", ambientes: { banheiroSuite: 1, cozinha: 1 },
    instalacoes: { padrao: "Médio", aquecimento: "nenhum", doProjeto: { HIDRAULICA: true, ELETRICA: true } } }, { materiais: [] });
  const est = r.itens.filter((i) => i.subEtapa === "Estimativa por ambientes");
  assert.ok(!est.some((i) => i.etapa === "Hidráulica (água fria e quente)"));
  assert.ok(!est.some((i) => i.etapa === "Elétrica e iluminação"));
  assert.ok(est.some((i) => i.etapa === "Esgoto e pluvial"));
  assert.ok(est.some((i) => i.etapa === "Louças e metais"));
  const vazio = gerarOrcamentoObra({ tipologia: "Térrea", ambientes: {}, instalacoes: { aquecimento: "solar" } }, { materiais: [] });
  assert.strictEqual(vazio.itens.filter((i) => i.subEtapa === "Estimativa por ambientes").length, 0);
});

teste("kit editado pelo escritório (data.escritorio.composicoes) vence a semente", () => {
  const data = { materiais: [], escritorio: { composicoes: { kits: { LOUCAS_LAVABO: { itens: [{ nome: "Louças - Sanitário", qtd: 1, unidade: "Unidades" }, { nome: "Item do escritório", qtd: 2, unidade: "Unidades" }] } },
    ambientes: { lavabo: { pontos: { tomadaGeral: 3 } } } } } };
  const kits = composicoesAtivas(data);
  assert.strictEqual(kits.LOUCAS_LAVABO.itens.length, 2);
  assert.ok(kits.LOUCAS_LAVABO.editado);
  assert.ok(!kits.LOUCAS_BANHEIRO.editado);
  const r = gerarOrcamentoObra({ tipologia: "Térrea", ambientes: { lavabo: 2 }, instalacoes: { padrao: "Médio", aquecimento: "nenhum" } }, data);
  const est = r.itens.filter((i) => i.subEtapa === "Estimativa por ambientes");
  assert.strictEqual(est.find((i) => i.item === "Item do escritório").qtd, 4);
  // 3 tomadas gerais por lavabo × 2 = 6 → 6 tomadas 10A
  assert.strictEqual(est.find((i) => /Tomada hexagonal.*10A/.test(i.item)).qtd, 6);
});

console.log(`\n${passou} passou, ${falhou} falhou`);
if (falhou > 0) process.exit(1);
