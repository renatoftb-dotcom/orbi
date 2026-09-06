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
// COMODOS (medidas por tamanho do orçamento de projetos) vem de shared.jsx — só esse trecho.
const srcShared = readFileSync(join(__dirname, "src", "modules", "shared.jsx"), "utf-8");
const mComodos = srcShared.match(/var COMODOS = \{[\s\S]*?\n\};/);
if (!mComodos) throw new Error("var COMODOS não encontrado em shared.jsx");
const src = mComodos[0] + "\n" + srcSeedComposicoes + "\n" + srcCompleto.slice(0, idx);

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
    consumoRevestimento, pisosRevestimentos, FORMATOS_PECA, medirBancada, estimarPelosComodos, vaosAutomaticos, autosPisos, padraoObra, PISOS_GENERICOS, nomeItemKit,
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
  assert.strictEqual(est.find((i) => i.item === "Louças - Sanitário padrão Médio").qtd, 3);
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

teste("inclinação do telhado: 0,35 e 35 (digitado como %) dão o mesmo resultado", () => {
  const a = normalizarProjeto({ tipologia: "Térrea", cobertura: [{ tipo: "Telha Barro Portuguesa", comprimento: 10, largura: 8, aguas: 2, inclinacao: 0.35 }] });
  const b = normalizarProjeto({ tipologia: "Térrea", cobertura: [{ tipo: "Telha Barro Portuguesa", comprimento: 10, largura: 8, aguas: 2, inclinacao: 35 }] });
  assert.strictEqual(a.coberturas[0].inclinacao, 0.35);
  assert.strictEqual(b.coberturas[0].inclinacao, 0.35);
});


console.log("\n--- bloco Geral: tipo de obra, padrão e piscina ---");
teste("padrão Altíssimo/Alto → kits Alto; MCMV/Baixo/Médio → Médio; reforma registrada", () => {
  assert.strictEqual(normalizarProjeto({ padrao: "Altíssimo" }).instalacoes.padrao, "Alto");
  assert.strictEqual(normalizarProjeto({ padrao: "Alto" }).instalacoes.padrao, "Alto");
  assert.strictEqual(normalizarProjeto({ padrao: "MCMV" }).instalacoes.padrao, "Médio");
  assert.strictEqual(normalizarProjeto({ padrao: "Baixo" }).padrao, "Baixo");
  assert.strictEqual(normalizarProjeto({ tipoObra: "reforma" }).tipoObra, "reforma");
  assert.strictEqual(normalizarProjeto({}).tipoObra, "nova");
  // projeto antigo: instalacoes.padrao Alto vira padrão Alto
  assert.strictEqual(normalizarProjeto({ instalacoes: { padrao: "Alto" } }).padrao, "Alto");
});
teste("sem piscina: dados da piscina são ignorados e os prestadores da piscina não entram", () => {
  const base = { ...projetoReferencia, piscina: { areaConstruida: 32, profundidade: 1.4, paredesM2Total: 40, concreto: { contrapiso: 5 } } };
  const com = gerarOrcamentoObra({ ...base, temPiscina: true }, { materiais: [] });
  const sem = gerarOrcamentoObra({ ...base, temPiscina: false }, { materiais: [] });
  assert.ok(com.itens.some((i) => i.item === "Pedreiros Piscina"));
  assert.ok(com.itens.some((i) => i.item === "Instalador Equip. Piscina"));
  assert.ok(com.itens.some((i) => i.etapa === "Piscina"));
  assert.ok(!sem.itens.some((i) => i.item === "Pedreiros Piscina" || i.item === "Instalador Equip. Piscina" || i.etapa === "Piscina"));
  // projeto antigo sem o campo: tem piscina se havia área digitada
  assert.strictEqual(normalizarProjeto(base).temPiscina, true);
  assert.strictEqual(normalizarProjeto(projetoReferencia).temPiscina, false);
});


console.log("\n--- pisos e revestimentos ---");
teste("consumos por formato: 60x60 = porcelanato AC-III, rejunte ≈ 0,16 kg/m², 8,3 clips/m²; 10x20 = AC-II, cruzetas, rejunte ≈ 0,58", () => {
  const g = modulo.consumoRevestimento("60x60", false, 0);
  assert.strictEqual(g.argamassa, "AC3"); assert.strictEqual(g.juntaMm, 2); assert.ok(Math.abs(g.rejunteKg - 0.16) < 0.005); assert.ok(Math.abs(g.clipsM2 - 8.33) < 0.01); assert.strictEqual(g.cruzetasM2, 0);
  const a = modulo.consumoRevestimento("10x20", false, 0);
  assert.strictEqual(a.argamassa, "AC2"); assert.ok(Math.abs(a.rejunteKg - 0.576) < 0.005); assert.ok(Math.abs(a.cruzetasM2 - 50) < 0.01); assert.strictEqual(a.clipsM2, 0);
  assert.strictEqual(modulo.consumoRevestimento("45x45", true, 0).argamassa, "AC3"); // externo sempre AC-III
  assert.strictEqual(modulo.consumoRevestimento("30x60", false, 4).juntaMm, 4);
});
teste("módulo: genérico pelo padrão, produto do projeto vence, consumíveis somados", () => {
  const proj = { tipologia: "Térrea", padrao: "Alto", arquitetura: { areaConstruida: 150 }, pisos: { pisoInterno: { m2: 100 }, revestimentoInterno: { m2: 50, formato: "10x20", produto: "Pisos e revestimentos - REVESTIMENTO BRANCO 10X20" }, rodapeM: 48, soleirasM: 10 } };
  const r = gerarOrcamentoObra(proj, { materiais: [] });
  const it = r.itens.filter((i) => i.etapa === "Pisos e revestimentos");
  const achar = (nome) => it.find((i) => i.item === nome);
  assert.strictEqual(achar("Piso - Porcelanato padrão Alto").qtd, 125.76);           // (100 + rodapé 48 × 0,10) × 1,2 (perda de peças)
  assert.strictEqual(achar("Pisos e revestimentos - REVESTIMENTO BRANCO 10X20").qtd, 60); // 50 × 1,2
  assert.ok(!achar("Revestimento - Porcelanato parede padrão Alto"));
  // AC3: piso 104,8 m² (90x90 → porcelanato) 7,5 + soleiras 1,5 m² × 7,5 = 797,25 kg → /20 × 1,1 = 43,8 → 44
  assert.strictEqual(achar("Argamassa AC 3 GF - 20kg").qtd, 44);
  // AC2: azulejo 50 × 4,5 = 225 kg → 12,4 → 13
  assert.strictEqual(achar("Argamassa AC 2 - 20kg").qtd, 13);
  assert.ok(!achar("RODAPE POLIESTIRENO 15CM"));                                      // rodapé é recorte do piso
  assert.strictEqual(achar("Soleira padrão Alto").qtd, 1.65);                        // 10 × 0,15 × 1,1 — pedra pelo padrão da obra
  assert.ok(achar("Rejunte - 5kg").qtd >= 6);
  assert.ok(achar("Pisos e revestimentos - Espaçador").qtd > 0 && achar("Pisos e revestimentos - Cunha Niveladora").qtd > 0);
  assert.ok(achar("Pisos e revestimentos - Espaçador Cruzeta").qtd > 0);
  assert.strictEqual(achar("Salva Piso 1,00m x 25mts").qtd, 5);                      // 104,8/25 × 1,1 = 4,6 → 5
  assert.ok(achar("Disco Porcelanato").qtd >= 1);
  // revestimento interno desconta da pintura (mesmo campo de antes)
  assert.strictEqual(normalizarProjeto(proj).revestimentoInterno, 50);
});
teste("padrão Baixo usa cerâmica; rodapé soma no m² do piso; sem m² nada é emitido", () => {
  const r = gerarOrcamentoObra({ tipologia: "Térrea", padrao: "Baixo", arquitetura: { areaConstruida: 60 }, pisos: { pisoInterno: { m2: 50, produto: "" }, rodapeM: 30 } }, { materiais: [] });
  const it = r.itens.filter((i) => i.etapa === "Pisos e revestimentos");
  const ceram = it.filter((i) => i.item === "Piso - Cerâmica padrão Baixo");
  assert.strictEqual(ceram.length, 1);
  assert.strictEqual(ceram[0].qtd, 63.6); // (50 + 30 × 0,10) × 1,2
  assert.ok(!it.some((i) => i.item === "RODAPE POLIESTIRENO 15CM"));
  // área construída preenche o piso interno sozinha; sem área nem cômodos, nada
  const auto = gerarOrcamentoObra({ tipologia: "Térrea", arquitetura: { areaConstruida: 60 } }, { materiais: [] });
  assert.strictEqual(auto.itens.find((i) => i.subEtapa === "Piso interno").qtd, 72); // 60 × 1,2
  const vazio = gerarOrcamentoObra({ tipologia: "Térrea", arquitetura: {} }, { materiais: [] });
  assert.ok(!vazio.itens.some((i) => i.etapa === "Pisos e revestimentos"));
});

teste("bancada: tampo + saia + fundo + sapatas em m² de pedra; uma linha por bancada, com a medição na composição", () => {
  const m = modulo.medirBancada({ comprimento: 3, profundidade: 0.6, saiaCm: 5, fundoCm: 10, sapatas: 2, sapataCm: 10 });
  assert.deepStrictEqual(m, { tampo: 1.8, saia: 0.15, fundo: 0.3, sapatas: 0.12, total: 2.37 });
  const r = gerarOrcamentoObra({ tipologia: "Térrea", arquitetura: { areaConstruida: 100 }, pisos: { bancadasM2: 9, bancadas: [
    { nome: "Cozinha", comprimento: 3, profundidade: 0.6, saiaCm: 5, fundoCm: 10, sapatas: 2, sapataCm: 10 },
    { nome: "Banheiro", comprimento: 1.2, profundidade: 0.5, saiaCm: 5, fundoCm: 10, sapatas: 0, sapataCm: 10, produto: "Soleiras Preto São Gabriel" },
    { nome: "vazia", comprimento: 0, profundidade: 0.6, saiaCm: 5, fundoCm: 10, sapatas: 2, sapataCm: 10 },
  ] } }, { materiais: [] });
  const b = r.itens.filter((i) => i.etapa === "Pisos e revestimentos" && i.subEtapa === "Bancadas");
  assert.strictEqual(b.length, 2); // uma linha por pedra
  assert.strictEqual(b[0].item, "Granito padrão Médio"); assert.strictEqual(b[0].qtd, 2.37);
  assert.strictEqual(b[0].composicao[0].bancada, "Cozinha"); assert.strictEqual(b[0].composicao[0].sapatas, 0.12);
  assert.strictEqual(b[1].item, "Soleiras Preto São Gabriel"); assert.strictEqual(b[1].qtd, 0.78); // 0,6 + 0,06 + 0,12
  // duas bancadas na mesma pedra somam numa linha só
  const r2 = gerarOrcamentoObra({ tipologia: "Térrea", arquitetura: { areaConstruida: 100 }, pisos: { bancadas: [{ nome: "A", comprimento: 2, profundidade: 0.6, saiaCm: 5, fundoCm: 10, sapatas: 2, sapataCm: 10 }, { nome: "B", comprimento: 1, profundidade: 0.5, saiaCm: 5, fundoCm: 10, sapatas: 2, sapataCm: 10 }] } }, { materiais: [] });
  const g = r2.itens.filter((i) => i.subEtapa === "Bancadas");
  assert.strictEqual(g.length, 1); assert.strictEqual(g[0].composicao.length, 2); assert.strictEqual(g[0].qtd, 1.62 + 0.75);
});

teste("estimativa pelos cômodos (tamanho Médio): piso, revestimento, rodapé, soleiras e bancadas", () => {
  const est = modulo.estimarPelosComodos({ tamanhoComodos: "Médio", ambientes: { banheiroSuite: 2, cozinha: 1, dormitorio: 3 }, esquadrias: [{ familia: "JANELA_CORRER", qtd: 4, largura: 1.5 }] });
  // WC Médio 3×1,4 (×2), Cozinha 4×3, Dormitório 3×4 (×3)
  assert.strictEqual(est.pisoInterno, 56.4);
  assert.strictEqual(est.revestimentoInterno, 83.4);   // pé-direito 2,80: 2×(8,8×2,8−1,68) + (14×2,8−1,68)
  assert.strictEqual(est.rodapeM, 39.6);               // 3×(14−0,8)
  assert.strictEqual(est.soleirasM, 10.8);             // 6 portas × 0,8 + 4 janelas × 1,5
  assert.strictEqual(est.bancadas.length, 3);
  // bancada = metade da parede mais comprida: WC 3 m → 1,5; cozinha 4 m → 2
  assert.deepStrictEqual(est.bancadas.map((b) => [b.nome, b.comprimento, b.profundidade]), [["Cozinha", 2, 0.6], ["WC 1", 1.5, 0.5], ["WC 2", 1.5, 0.5]]);
  // cômodo editado: banheiro 4 × 2, meia parede, bancada 100% × 0,6
  const ed = modulo.estimarPelosComodos({ tamanhoComodos: "Médio", ambientes: { banheiroSocial: 1 }, comodosCfg: { banheiroSocial: { L: 4, W: 2, revestir: "meia", bancadaFracao: 1, bancadaProfundidade: 0.6 } } });
  assert.strictEqual(ed.pisoInterno, 8); assert.strictEqual(ed.revestimentoInterno, 18); // 12 × 1,5
  assert.deepStrictEqual(ed.bancadas.map((b) => [b.comprimento, b.profundidade]), [[4, 0.6]]);
  // saia, fundo e sapatas entram na bancada automática e são editáveis por cômodo
  const r0 = gerarOrcamentoObra({ tipologia: "Térrea", arquitetura: { areaConstruida: 80 }, tamanhoComodos: "Médio", ambientes: { cozinha: 1 } }, { materiais: [] });
  const g0 = r0.itens.find((i) => i.subEtapa === "Bancadas");
  assert.deepStrictEqual([g0.composicao[0].tampo, g0.composicao[0].saia, g0.composicao[0].fundo, g0.composicao[0].sapatas], [1.2, 0.1, 0.2, 0.12]);
  assert.strictEqual(g0.qtd, 1.62);
  const r1 = gerarOrcamentoObra({ tipologia: "Térrea", arquitetura: { areaConstruida: 80 }, tamanhoComodos: "Médio", ambientes: { cozinha: 1 }, comodosCfg: { cozinha: { saiaCm: 10, fundoCm: 15, sapatas: 3, sapataCm: 12 } } }, { materiais: [] });
  const g1 = r1.itens.find((i) => i.subEtapa === "Bancadas");
  assert.deepStrictEqual([g1.composicao[0].saia, g1.composicao[0].fundo, g1.composicao[0].sapatas], [0.2, 0.3, 0.22]); // 2×0,10; 2×0,15; 3×0,6×0,12
  // sem nada digitado, revestimento e bancadas do orçamento vêm dos cômodos
  const cp = normalizarProjeto({ tamanhoComodos: "Médio", ambientes: { cozinha: 1 } });
  assert.strictEqual(cp.revestimentoInterno, 37.5);
  // ids antigos migram (banheiroSuite/banheiroSocial → wc, salaEstar → salaTV)
  const mig = normalizarProjeto({ ambientes: { banheiroSuite: 2, banheiroSocial: 1, salaEstar: 1 } }).ambientes;
  assert.strictEqual(mig.wc, 3); assert.strictEqual(mig.salaTV, 1); assert.ok(!("banheiroSuite" in mig));
  assert.strictEqual(cp.pisos.bancadas.length, 1); assert.strictEqual(cp.pisos.bancadas[0].comprimento, 2);
  const r = gerarOrcamentoObra({ tipologia: "Térrea", arquitetura: { areaConstruida: 80 }, tamanhoComodos: "Médio", ambientes: { cozinha: 1 } }, { materiais: [] });
  assert.ok(r.itens.some((i) => i.subEtapa === "Bancadas" && i.item === "Granito padrão Médio" && i.qtd > 1));
  assert.ok(r.itens.some((i) => i.subEtapa === "Revestimento interno"));
  const g = modulo.estimarPelosComodos({ tamanhoComodos: "Grande", ambientes: { cozinha: 1 } });
  assert.strictEqual(g.pisoInterno, 24); // 6×4
  assert.strictEqual(modulo.estimarPelosComodos({}).detalhes.length, 0);
  // WC Suítes usa as medidas do WC; WC Suíte Master um tamanho acima (Médio → Grande 3,5 × 2)
  const wcs = modulo.estimarPelosComodos({ tamanhoComodos: "Médio", ambientes: { wcSuite: 1, wcSuiteMaster: 1 } });
  assert.deepStrictEqual(wcs.detalhes.map((d) => [d.nome, d.L, d.W]), [["WC Suíte Master", 3.5, 2], ["WC Suítes", 3, 1.4]]);
  assert.strictEqual(normalizarProjeto({ tamanhoComodos: "Compacta" }).tamanhoComodos, "Compacta");
  assert.strictEqual(normalizarProjeto({}).tamanhoComodos, "Médio");
});

teste("vãos automáticos: portas internas 0,80 (1 verga) + esquadrias (janela 2 vergas, porta externa 1); rodapé pelo perímetro; soleiras pelo vão das esquadrias", () => {
  const proj = { tipologia: "Térrea", arquitetura: { areaConstruida: 120 }, terreo: { perimetroParedes: 90, m2Parede20: 300 },
    ambientes: { dormitorio: 3, wc: 2, cozinha: 1 }, // 3 + 2 portas (cozinha sem porta)
    esquadrias: [{ familia: "JANELA_CORRER", qtd: 4, largura: 1.5 }, { familia: "PORTA_CORRER", qtd: 1, largura: 2.4 }] };
  const v = modulo.vaosAutomaticos(proj);
  assert.strictEqual(v.portasInternas, 5);
  assert.strictEqual(v.metrosVergas, 5 * 0.8 + 2.4 + 2 * 6); // 18,4
  assert.strictEqual(v.vaoEquivalente, 9.2);
  const cp = normalizarProjeto(proj);
  assert.strictEqual(cp.vaoPortasJanelasTerreo, 9.2);
  const au = modulo.autosPisos(proj);
  assert.strictEqual(au.pisoInterno, 120);
  assert.strictEqual(au.rodapeM, 86);      // 90 − 5 × 0,8
  assert.strictEqual(au.soleirasM, 8.4);   // 6 + 2,4
  assert.strictEqual(cp.pisos.rodapeM, 86); assert.strictEqual(cp.pisos.soleirasM, 8.4); assert.strictEqual(cp.pisos.pisoInterno.m2, 120);
  // digitado vence o automático; projeto antigo sem cômodos/esquadrias mantém o vão digitado
  assert.strictEqual(normalizarProjeto({ ...proj, pisos: { rodapeM: 50 } }).pisos.rodapeM, 50);
  assert.strictEqual(normalizarProjeto({ tipologia: "Térrea", terreo: { vaoPortasJanelas: 49 } }).vaoPortasJanelasTerreo, 49);
  // sobrado reparte pelo m² de parede
  const sob = normalizarProjeto({ ...proj, tipologia: "Sobrado", pav1: { m2Parede20: 100, perimetroParedes: 30 } });
  assert.strictEqual(sob.vaoPortasJanelasTerreo, 6.9); assert.strictEqual(sob.pav1.vaoPortasJanelas, 2.3);
  assert.strictEqual(modulo.autosPisos({ ...proj, tipologia: "Sobrado", pav1: { perimetroParedes: 30 } }).rodapeM, 116);
  // piso externo em branco = área da pavimentação externa; digitado vence
  assert.strictEqual(modulo.autosPisos({ ...proj, externa: { pavimentacao: 45.5 } }).pisoExterno, 45.5);
  assert.strictEqual(normalizarProjeto({ ...proj, externa: { pavimentacao: 45.5 } }).pisos.pisoExterno.m2, 45.5);
  assert.strictEqual(normalizarProjeto({ ...proj, externa: { pavimentacao: 45.5 }, pisos: { pisoExterno: { m2: 30 } } }).pisos.pisoExterno.m2, 30);
  assert.strictEqual(au.pisoExterno, 0);
});

teste("padrão da obra: tela e motor usam a mesma regra; genérico do padrão Médio nunca é porcelanato Alto", () => {
  assert.strictEqual(modulo.padraoObra({}), "Médio");
  assert.strictEqual(modulo.padraoObra({ instalacoes: { padrao: "Alto" } }), "Alto");
  assert.strictEqual(modulo.padraoObra({ padrao: "Médio", instalacoes: { padrao: "Alto" } }), "Médio");
  assert.strictEqual(normalizarProjeto({ padrao: "Médio", instalacoes: { padrao: "Alto" } }).padrao, "Médio");
  for (const sup of Object.keys(modulo.PISOS_GENERICOS)) assert.ok(!/Alto|Altíssimo/.test(modulo.PISOS_GENERICOS[sup]["Médio"]), sup);
  const cp = normalizarProjeto({ padrao: "Médio", arquitetura: { areaConstruida: 100 }, pisos: { revestimentoExterno: { m2: 40 } } });
  const out = []; modulo.pisosRevestimentos(cp, out);
  assert.ok(out.some((l) => l.item === "Piso - Porcelanato padrão Médio"));
  assert.ok(out.some((l) => l.item === "Revestimento - Porcelanato parede padrão Médio"));
  assert.ok(!out.some((l) => /padrão Alt/.test(l.item)));
  // granito e soleira acompanham o padrão da obra; produto digitado vence
  const alt = normalizarProjeto({ padrao: "Altíssimo", arquitetura: { areaConstruida: 100 }, pisos: { soleirasM: 10, bancadas: [{ nome: "Cozinha", comprimento: 2, profundidade: 0.6, saiaCm: 5, fundoCm: 10, sapatas: 2, sapataCm: 10 }] } });
  const o2 = []; modulo.pisosRevestimentos(alt, o2);
  assert.ok(o2.some((l) => l.subEtapa === "Bancadas" && l.item === "Granito padrão Altíssimo"));
  assert.ok(o2.some((l) => l.subEtapa === "Soleiras e peitoris" && l.item === "Soleira padrão Altíssimo"));
  const dig = normalizarProjeto({ padrao: "MCMV", arquitetura: { areaConstruida: 100 }, pisos: { soleirasM: 10, soleirasProduto: "Minha pedra" } });
  const o3 = []; modulo.pisosRevestimentos(dig, o3);
  assert.ok(o3.some((l) => l.subEtapa === "Soleiras e peitoris" && l.item === "Minha pedra"));
});

teste("louças e metais pelo padrão da obra: abaixo de Alto é misturador, Alto/Altíssimo monocomando", () => {
  const itens = (padrao) => gerarOrcamentoObra({ tipologia: "Térrea", padrao, arquitetura: { areaConstruida: 100 }, ambientes: { wc: 1, cozinha: 1 } }, { materiais: [] }).itens.filter((i) => i.subEtapa === "Estimativa por ambientes").map((i) => i.item);
  const mcmv = itens("MCMV"), alt = itens("Altíssimo"), medio = itens("Médio");
  assert.ok(mcmv.includes("Louças - Sanitário padrão MCMV") && mcmv.includes("Metal - Torneira Lavatório padrão MCMV") && mcmv.includes("Metal - Torneira Cozinha e Lazer padrão MCMV"));
  assert.ok(mcmv.includes("Metal - Hidráulica - Base Misturador Chuveiro 3/4") && mcmv.includes("Metal - Acabamento Misturador Chuveiro padrão MCMV"));
  assert.ok(!mcmv.some((n) => /Monocomando/.test(n)));
  assert.ok(medio.includes("Metal - Acabamento Misturador Chuveiro padrão Médio") && !medio.some((n) => /Monocomando/.test(n)));
  assert.ok(alt.includes("Louças - Sanitário padrão Altíssimo") && alt.includes("Metal - Acabamento Monocomando Chuveiro padrão Altíssimo") && alt.includes("Metal - Hidráulica - Base Registro Monocomando Chuveiro 3/4"));
  assert.ok(!alt.some((n) => /Misturador/.test(n)));
  assert.ok(!alt.some((n) => /\{padr/.test(n)) && !mcmv.some((n) => /\{padr/.test(n)));
  assert.strictEqual(modulo.nomeItemKit("Louças - Cuba padrão {padrão}", "Alto"), "Louças - Cuba padrão Alto");
});

console.log(`\n${passou} passou, ${falhou} falhou`);
if (falhou > 0) process.exit(1);
