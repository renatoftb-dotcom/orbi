// Testes puros (node, sem framework) do motor de cronograma de obra.
// Roda com: node cronograma-obra.test.mjs
// Mesmo esquema de orcamento-obra.test.mjs: lê os fontes, corta a parte de UI
// (JSX) e avalia o motor com `new Function`.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ler = (f) => readFileSync(join(__dirname, "src", "modules", f), "utf-8");
const cortar = (src, marcador, arquivo) => {
  const i = src.indexOf(marcador);
  if (i === -1) throw new Error(`Marcador "${marcador}" não encontrado em ${arquivo}`);
  return src.slice(0, i);
};
const src = [
  ler("composicoes-seed.jsx"),
  ler("cronograma-seed.jsx"),
  cortar(ler("orcamento-obra.jsx"), "// UI (§7)", "orcamento-obra.jsx"),
  cortar(ler("cronograma-obra.jsx"), "// UI — bloco", "cronograma-obra.jsx"),
].join("\n");

const M = new Function(`
  ${src}
  return {
    prazoParametricoMeses, medicoesCronograma, condicoesObra, resolverRedeCronograma, cpmCronograma,
    dataDoDiaUtil, dataUTC, isoData, ehDiaUtil, fisicoFinanceiro, custoPorEtapaCronograma,
    gerarCronogramaObra, etapasCronogramaAtivas, servicosCronogramaAtivos, gerarOrcamentoObra,
    ETAPAS_CRONOGRAMA_SEED, PRODUTIVIDADE_SEED, OFICIOS, DIAS_UTEIS_MES,
  };
`)();

let passou = 0, falhou = 0;
function teste(nome, fn) {
  try { fn(); passou++; console.log(`  ok  ${nome}`); }
  catch (e) { falhou++; console.log(`FALHOU  ${nome}`); console.log(`        ${e.message}`); }
}
const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} esperado ≈ ${b}, veio ${a}`);

const projetoSobrado = {
  tipologia: "Sobrado",
  arquitetura: { areaConstruida: 330.86, m2ParedesInternas: 282, m2ParedesExternas: 553, m2ParedesTotal: 835, gabarito: 80 },
  terreo: { m2Parede20: 452.05, vaoPortasJanelas: 49, area: 180, perimetroParedes: 120, areaLoje: 170, perimetroLoje: 60, concretoVigaRespaldo: 6 },
  pav1: { m2Parede20: 300, vaoPortasJanelas: 30, areaLoje: 150, perimetroLoje: 55, concretoVigaRespaldo: 5 },
  engenharia: {
    colunasTerreo: { "15": 4, "20": 10, concreto: 4, ferro: { CA50_10MM: 400, CA60_5MM: 300 } },
    colunasPav1: { "20": 10, concreto: 3.5, ferro: { CA50_10MM: 350, CA60_5MM: 250 } },
    fundacao: { qtdEstacas: 30, profEstacas: 4, concreto: { estacas: 4, baldrames: 8 }, ferro: { baldrames: { CA50_8MM: 600, CA60_5MM: 400 }, estacas: { CA50_8MM: 300 } } },
  },
  cobertura: [{ tipo: "Telha Barro Portuguesa", comprimento: 15, largura: 12, aguas: 2, inclinacao: 0.35 }],
  externa: { revestimentoInterno: 186, pavimentacao: 215, perimetroPavimentacao: 60, muroDivisa: { comprimento: 78, altura: 2 } },
  esquadrias: [{ familia: "JANELA_CORRER", folhas: 2, qtd: 6, largura: 1.5, altura: 1.2 }],
  ambientes: { banheiroSuite: 2, banheiroSocial: 1, cozinha: 1, lavanderia: 1, dormitorio: 3, salaEstar: 1, salaJantar: 1, circulacao: 1, garagem: 1 },
};
const projetoTerrea = { ...projetoSobrado, tipologia: "Térrea", pav1: undefined, arquitetura: { ...projetoSobrado.arquitetura, areaConstruida: 180 }, externa: { revestimentoInterno: 100, pavimentacao: 0 } };
const dataVazia = { materiais: [], escritorio: {} };

console.log("\n--- prazo paramétrico (tabela interpolada) ---");
teste("150 m² térrea = 14,3; sobrado = 15,8", () => {
  assert.strictEqual(M.prazoParametricoMeses(150, "Térrea", dataVazia), 14.3);
  assert.strictEqual(M.prazoParametricoMeses(150, "Sobrado", dataVazia), 15.8);
});
teste("125 m² interpola entre 100 e 150 (13,75 → 13,8), não arredonda para a faixa", () => {
  assert.strictEqual(M.prazoParametricoMeses(125, "Térrea", dataVazia), 13.8);
});
teste("abaixo da primeira linha vale a primeira; acima da última extrapola (500 m² → 24,2)", () => {
  assert.strictEqual(M.prazoParametricoMeses(40, "Térrea", dataVazia), 6.6);
  assert.strictEqual(M.prazoParametricoMeses(500, "Térrea", dataVazia), 24.2);
});
teste("tabela do escritório substitui a semente", () => {
  const d = { escritorio: { cronograma: { prazoTabela: [{ area: 100, terrea: 10 }, { area: 200, terrea: 20 }], sobradoExtra: 2 } } };
  assert.strictEqual(M.prazoParametricoMeses(150, "Térrea", d), 15);
  assert.strictEqual(M.prazoParametricoMeses(150, "Sobrado", d), 17);
});

console.log("\n--- rede de etapas ---");
teste("térrea sem arrimo: fundação depende da terraplanagem; sem pav. 1; cobertura depende da laje do térreo", () => {
  const { cp } = M.medicoesCronograma(projetoTerrea, dataVazia);
  const rede = M.resolverRedeCronograma(M.etapasCronogramaAtivas(dataVazia), M.condicoesObra(cp));
  const ids = rede.map((e) => e.id);
  assert.ok(!ids.includes("PAREDES_PAV1") && !ids.includes("LAJE_PAV1") && !ids.includes("ARRIMO") && !ids.includes("PISCINA"));
  const fund = rede.find((e) => e.id === "FUNDACAO");
  assert.deepStrictEqual(fund.links.map((l) => l.id + ":" + l.tipo), ["TERRAPLANAGEM:FS"]);
  const cob = rede.find((e) => e.id === "COBERTURA");
  assert.deepStrictEqual(cob.links.map((l) => l.id), ["LAJE_TERREO"]);
});
teste("sobrado: cobertura depende das duas lajes; contrapiso pav. 1 entra", () => {
  const { cp } = M.medicoesCronograma(projetoSobrado, dataVazia);
  const rede = M.resolverRedeCronograma(M.etapasCronogramaAtivas(dataVazia), M.condicoesObra(cp));
  const cob = rede.find((e) => e.id === "COBERTURA");
  assert.deepStrictEqual(cob.links.map((l) => l.id).sort(), ["LAJE_PAV1", "LAJE_TERREO"]);
  assert.ok(rede.some((e) => e.id === "CONTRAPISO_PAV1"));
});
teste("toda predecessora da semente existe", () => {
  const ids = new Set(M.ETAPAS_CRONOGRAMA_SEED.map((e) => e.id));
  for (const e of M.ETAPAS_CRONOGRAMA_SEED) for (const l of e.predecessoras) assert.ok(ids.has(l.id), `${e.id} → ${l.id}`);
});

console.log("\n--- CPM ---");
teste("cadeia A(10) → B FS(5) → C SS 50%(4): fim 16,5, todas críticas", () => {
  const rede = [
    { id: "A", nome: "A", links: [] },
    { id: "B", nome: "B", links: [{ id: "A", tipo: "FS", lag: 0, avanco: 0 }] },
    { id: "C", nome: "C", links: [{ id: "B", tipo: "SS", lag: 0, avanco: 0.5 }] },
  ];
  const r = M.cpmCronograma(rede, { A: 10, B: 5, C: 4 });
  perto(r.fim, 16.5, 1e-9);
  const c = r.etapas.find((e) => e.id === "C");
  perto(c.inicio, 12.5, 1e-9);
  assert.ok(r.etapas.every((e) => e.critico));
});
teste("ramo paralelo curto tem folga e não é crítico; lag negativo antecipa", () => {
  const rede = [
    { id: "A", nome: "A", links: [] },
    { id: "B", nome: "B", links: [{ id: "A", tipo: "FS", lag: -2, avanco: 0 }] },
    { id: "P", nome: "P", links: [{ id: "A", tipo: "FS", lag: 0, avanco: 0 }] },
    { id: "F", nome: "F", links: [{ id: "B", tipo: "FS", lag: 0, avanco: 0 }, { id: "P", tipo: "FS", lag: 0, avanco: 0 }] },
  ];
  const r = M.cpmCronograma(rede, { A: 10, B: 8, P: 3, F: 1 });
  perto(r.fim, 17, 1e-9);
  const p = r.etapas.find((e) => e.id === "P");
  perto(p.folga, 3, 1e-9);
  assert.ok(!p.critico);
  perto(r.etapas.find((e) => e.id === "B").inicio, 8, 1e-9);
});

console.log("\n--- calendário ---");
teste("07/09 é feriado: primeiro dia útil é 08/09; 5 dias úteis depois cai em 15/09/2026", () => {
  const ini = M.dataUTC("2026-09-07");
  assert.strictEqual(M.isoData(M.dataDoDiaUtil(ini, 0)), "2026-09-08");
  assert.strictEqual(M.isoData(M.dataDoDiaUtil(ini, 5)), "2026-09-15");
});
teste("sexta-feira santa e carnaval de 2027 não são dias úteis", () => {
  assert.ok(!M.ehDiaUtil(M.dataUTC("2027-03-26"))); // sexta santa (páscoa 28/03/2027)
  assert.ok(!M.ehDiaUtil(M.dataUTC("2027-02-09"))); // terça de carnaval
  assert.ok(M.ehDiaUtil(M.dataUTC("2027-03-25")));
});

console.log("\n--- medições ---");
const med = M.medicoesCronograma(projetoSobrado, dataVazia);
const q = (etapa, servico) => { const m = med.medicoes.find((x) => x.etapa === etapa && x.servico === servico); return m ? m.qtd : 0; };
teste("alvenaria do térreo = m² de parede; pav. 1 idem; muro = comprimento × altura", () => {
  perto(q("PAREDES_TERREO", "ALVENARIA"), 452.05, 0.01);
  perto(q("PAREDES_PAV1", "ALVENARIA"), 300, 0.01);
  perto(q("MURO_DIVISA", "ALVENARIA"), 156, 0.01);
});
teste("aço em kg: baldrames 600 m de 8 mm + 400 m de CA60 5 mm + estacas 300 m de 8 mm", () => {
  perto(q("FUNDACAO", "ARMACAO"), 600 * 4.8 / 12 + 400 * 1.92 / 12 + 300 * 4.8 / 12, 0.05);
});
teste("pontos: 3 banheiros + cozinha 0,5 + lavanderia 0,5 = 4 conjuntos de água fria; portas contam os cômodos com kit", () => {
  perto(q("INSTALACOES", "HIDRO_BANHEIRO"), 4, 1e-9);
  assert.ok(q("PORTAS", "PORTA") >= 6);
  assert.ok(q("INSTALACOES", "PONTO_LUZ") > 0 && q("INSTALACOES", "PONTO_TOMADA") > 0);
});
teste("telhado cerâmico entra em madeiramento e telha cerâmica, não em fibro", () => {
  assert.ok(q("COBERTURA", "MADEIRAMENTO") > 180);
  perto(q("COBERTURA", "TELHA_CERAMICA"), q("COBERTURA", "MADEIRAMENTO"), 0.01);
  assert.strictEqual(q("COBERTURA", "TELHA_FIBRO"), 0);
});
teste("esquadrias: 6 × 1,5 × 1,2 = 10,8 m²", () => perto(q("ESQUADRIAS", "ESQUADRIA"), 10.8, 0.01));

console.log("\n--- gerarCronogramaObra ---");
const cfg = { dataInicio: "2026-10-01", modo: "simplificado", eficiencia: 0.75 };
const res = M.gerarCronogramaObra(projetoSobrado, null, dataVazia, cfg);
teste("prazo pela tabela: 330,86 m² sobrado → 21,6 meses; simplificado fecha nesse prazo", () => {
  assert.strictEqual(res.prazoTabela, 21.6);
  perto(res.simplificado.fimDias, 21.6 * M.DIAS_UTEIS_MES, 0.5);
  assert.strictEqual(res.simplificado.meses, 21.6);
});
teste("prazo-alvo digitado substitui a tabela", () => {
  const r = M.gerarCronogramaObra(projetoSobrado, null, dataVazia, { ...cfg, prazoAlvoMeses: 12 });
  perto(r.simplificado.fimDias, 12 * M.DIAS_UTEIS_MES, 0.5);
  assert.ok(r.simplificado.fator < res.simplificado.fator);
});
teste("caminho crítico existe e limpeza é a última etapa", () => {
  assert.ok(res.simplificado.criticas.length >= 5);
  const ult = res.simplificado.etapas.reduce((a, e) => (e.fim > a.fim ? e : a));
  assert.strictEqual(ult.id, "LIMPEZA");
});
teste("produtividade: HH da alvenaria do térreo = 452,05 × 1,61 pedreiro; equipe necessária ≥ 1 por ofício usado", () => {
  const p = res.produtividade.etapas.find((e) => e.id === "PAREDES_TERREO");
  assert.ok(p.hh.pedreiro > 452.05 * 1.61 - 1);
  assert.ok(res.produtividade.hhTotal > 2000);
  for (const o of M.OFICIOS) if (res.produtividade.hhPorOficio[o.id] > 0) assert.ok(res.produtividade.equipeNecessaria[o.id] >= 1, o.id);
});
teste("com a equipe necessária, o prazo por produtividade fica dentro do alvo", () => {
  assert.ok(res.produtividade.prazoComEquipeNecessariaMeses <= res.prazoAlvo + 0.05, `${res.produtividade.prazoComEquipeNecessariaMeses} > ${res.prazoAlvo}`);
});
teste("equipe maior → prazo por produtividade menor; eficiência menor → maior", () => {
  const grande = M.gerarCronogramaObra(projetoSobrado, null, dataVazia, { ...cfg, equipe: { pedreiro: 12, servente: 12, carpinteiro: 4, armador: 3, pintor: 6 } });
  assert.ok(grande.produtividade.fimDias < res.produtividade.fimDias);
  const lenta = M.gerarCronogramaObra(projetoSobrado, null, dataVazia, { ...cfg, eficiencia: 0.5 });
  assert.ok(lenta.produtividade.fimDias > res.produtividade.fimDias);
});
teste("modo produtividade vira o ativo e as datas seguem o calendário", () => {
  const r = M.gerarCronogramaObra(projetoSobrado, null, dataVazia, { ...cfg, modo: "produtividade" });
  assert.strictEqual(r.ativo.fimDias, r.produtividade.fimDias);
  assert.strictEqual(r.ativo.etapas[0].dataInicio, "2026-10-01");
  assert.ok(r.ativo.dataFim > "2027-01-01");
});
teste("horas editadas pelo escritório entram no cálculo (alvenaria com 0 h de pedreiro)", () => {
  const d = { materiais: [], escritorio: { cronograma: { servicos: { ALVENARIA: { horas: { pedreiro: 0 } } } } } };
  const r = M.gerarCronogramaObra(projetoSobrado, null, d, cfg);
  const p = r.produtividade.etapas.find((e) => e.id === "PAREDES_TERREO");
  assert.ok(!p.hh.pedreiro || p.hh.pedreiro < res.produtividade.etapas.find((e) => e.id === "PAREDES_TERREO").hh.pedreiro);
});
teste("duração-base editada muda a distribuição sem mudar o prazo total", () => {
  const d = { materiais: [], escritorio: { cronograma: { etapas: { PINTURA: { duracaoBase: 6 } } } } };
  const r = M.gerarCronogramaObra(projetoSobrado, null, d, cfg);
  perto(r.simplificado.fimDias, res.simplificado.fimDias, 0.6);
  const pin = (x) => x.simplificado.etapas.find((e) => e.id === "PINTURA").duracao;
  assert.ok(pin(r) > pin(res));
});

console.log("\n--- físico-financeiro ---");
teste("custo por etapa: nome da etapa vence a ordem; prestadores diluem; soma bate", () => {
  const itens = [
    { ordem: 4, etapa: "Contrapiso Interno", total: 1000 },
    { ordem: 4, etapa: "Contrapiso Interno Pav 1", total: 500 },
    { ordem: 5, etapa: "Supra estrutura e paredes", total: 3000 },
    { ordem: 0, etapa: "Prestadores de serviços", total: 2000 },
    { ordem: 18, etapa: "Hidráulica (água fria e quente)", total: 700 },
  ];
  const { custo, geral } = M.custoPorEtapaCronograma(res.rede, itens);
  assert.strictEqual(custo.CONTRAPISO_TERREO, 1000);
  assert.strictEqual(custo.CONTRAPISO_PAV1, 500);
  assert.strictEqual(custo.PAREDES_TERREO, 3000);
  assert.strictEqual(custo.INSTALACOES, 700);
  assert.strictEqual(geral, 2000);
  const r = M.gerarCronogramaObra(projetoSobrado, { itens }, dataVazia, cfg);
  perto(r.financeiro.total, 7200, 0.05);
  assert.ok(r.financeiro.meses.length >= 20);
  perto(r.financeiro.meses[r.financeiro.meses.length - 1].pct, 1, 1e-9);
  assert.ok(r.financeiro.meses.every((m, i, a) => i === 0 || m.acumulado >= a[i - 1].acumulado));
});
teste("orçamento real do motor alimenta o físico-financeiro sem erro", () => {
  const orc = M.gerarOrcamentoObra(projetoSobrado, dataVazia);
  const r = M.gerarCronogramaObra(projetoSobrado, orc, dataVazia, cfg);
  assert.ok(r.financeiro && Array.isArray(r.financeiro.meses));
});

console.log(`\n${passou} passaram, ${falhou} falharam`);
if (falhou) process.exit(1);
