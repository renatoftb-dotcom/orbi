// O catálogo é a fonte única da etapa e do grupo da estimativa.
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
// projetoVazio() e camposPreenchidos() moram depois do marcador de UI (são
// usadas pelo formulário), mas são JS puro e o botão de limpar depende delas
// — recorta as duas e junta ao motor.
const recorte = (nome) => {
  const i = srcCompleto.indexOf(`function ${nome}(`);
  if (i === -1) throw new Error(`function ${nome} não encontrada em orcamento-obra.jsx`);
  const fim = srcCompleto.indexOf("\n}", i);
  return srcCompleto.slice(i, fim + 2);
};
const mClassificacao = srcCompleto.match(/const CLASSIFICACAO_OBRA = \[[^\]]*\];/);
if (!mClassificacao) throw new Error("const CLASSIFICACAO_OBRA não encontrada");
// O prazo da obra mora no cronograma; a locação de canteiro depende dele.
const srcCrono = readFileSync(join(__dirname, "src", "modules", "cronograma-obra.jsx"), "utf-8");
const idxCrono = srcCrono.indexOf("// UI — bloco");
const srcCronoSeed = readFileSync(join(__dirname, "src", "modules", "cronograma-seed.jsx"), "utf-8");
const src = mComodos[0] + "\n" + srcCronoSeed + "\n" + srcCrono.slice(0, idxCrono > 0 ? idxCrono : srcCrono.length) + "\n" + srcSeedComposicoes + "\n" + srcCompleto.slice(0, idx)
  + "\n" + recorte("projetoVazio") + "\n" + recorte("projetoParaFormulario")
  + "\n" + mClassificacao[0] + "\n" + recorte("camposPreenchidos");

const modulo = new Function(`
  ${src}
  ${readFileSync(join(__dirname, "src", "modules", "obra-financeiro.jsx"), "utf-8")}
  return { gerarOrcamentoObra, etapaDaLinhaDoOrcamento, origemDaEtapaDaLinha, grupoDaLinhaDoOrcamento,
           etapaDoOrcamento, etapasDoOrcamentoSemMapa, ETAPAS_OBRA };
`)();
const M = modulo;

let passou = 0, falhou = 0;
function teste(nome, fn) {
  try { fn(); passou++; console.log(`  ok   ${nome}`); }
  catch (e) { falhou++; console.log(`FALHOU ${nome}`); console.log(`       ${e.message}`); }
}

const COMPLETO = {
    tipologia: "Sobrado", padrao: "Alto", tamanhoComodos: "Médio", temPiscina: true,
    arquitetura: { areaConstruida: 260, areaTerreo: 130, gabarito: 60, m2ParedesTotal: 420, m2ParedesInternas: 260, m2ParedesExternas: 160 },
    terreo: { perimetroParedes: 48, perimetroLoje: 50, m2Parede20: 180, m2Parede15: 20, area: 130, vaoPortasJanelas: 12, peDireito: 2.8, m2Laje: 130 },
    pav1: { perimetroParedes: 44, perimetroLoje: 46, m2Parede20: 160, area: 130, m2Laje: 130 },
    ambientes: { cozinha: 1, lavanderia: 1, wc: 2, wcSuite: 1, lavabo: 1, dormitorio: 3, suite: 1, salaTV: 1, areaLazer: 1, garagem: 1 },
    esquadrias: [{ familia: "JANELA_CORRER", linha: "GOLD", folhas: 2, qtd: 4, largura: 1.5, altura: 1.2 }],
    cobertura: [{ tipo: "Telha Barro Portuguesa", comprimento: 12, largura: 10, aguas: 4, inclinacao: 0.3 },
                { tipo: "Telha Fibrocimento 6mm", comprimento: 6, largura: 4, aguas: 2, inclinacao: 0.15 }],
    pisos: { pisoInterno: { m2: 130 }, revestimentoInterno: { m2: 60 }, soleirasM: 10, deckM2: 20 },
    externa: { pavimentacao: 80, perimetroPavimentacao: 40, muroDivisa: { comprimento: 40, altura: 2.5 } },
    arrimo: { comprimento: 20, altura: 2, numeroVigas: 2, qtdEstacas: 8, profEstacas: 3, areaFormaColunaMaior25cm: 10,
      resistenciaConcreto: "Concreto - FCK25", colunas: { "15": 4, "20": 4, "30": 2 },
      ferro: { estacas: { CA50_10MM: 200 }, colunas: { CA50_8MM: 120 }, vigas: { CA50_10MM: 90 } },
      concreto: { estacas: 2, colunas: 3, vigas: 3 } },
    engenharia: {
      fundacao: { qtdEstacas: 20, profEstacas: 4, resistenciaConcreto: "Concreto - FCK25", ferro: { baldrames: { CA50_8MM: 600 }, estacas: { CA50_8MM: 240 } }, concreto: { estacas: 3, baldrames: 5 } },
      colunasTerreo: { qtd: 20, ferro: { CA50_10MM: 400 }, concreto: 6 },
      colunasPav1: { qtd: 18, ferro: { CA50_10MM: 360 }, concreto: 5 },
    },
    piscina: { areaConstruida: 32, comprimento: 8, largura: 4, profundidade: 1.5, paredesM2Total: 60, perimetroParedes: 24, gabaritoObra: 30, m2Parede20: 60, ferro: { CA50_8MM: 200 }, concreto: 10 },
    prestadores: { pedreirosObra: 90000, terraplanagem: 8000, impermeabilizador: 5000, marceneiroPortas: 12000, serralheiro: 9000 },
    instalacoes: { aquecimento: "boiler", pressurizador: true, doProjeto: {} },
    itensProjeto: [{ etapa: "HIDRAULICA", nome: "PVC -  Alimentação - Marrom - Tubo 25mm", qtd: 60, unidade: "Barras 6mts" }],
  };

// um pedaço do catálogo como está em produção: a base do registro é de
// Hidráulica, mesmo vindo do kit de louças do banheiro
const CATALOGO = [
  { codigo: "LOU-047", nome: "Metal - Hidráulica - Base Registro Gaveta 3/4", etapaPadrao: "hidraulica", grupo: "Louças e metais" },
  { codigo: "LOU-103", nome: "Louças - Sanitário padrão Alto", etapaPadrao: "loucas_metais", grupo: "Louças e metais" },
  { codigo: "CIM-001", nome: "Sacos de cimento 50kg", etapaPadrao: "", grupo: "Cimento" },
  { codigo: "PRE-016", nome: "Terraplanagem", etapaPadrao: "terraplanagem", grupo: "Prestadores de serviços" },
];
const r = M.gerarOrcamentoObra(COMPLETO, { materiais: [] });
const linhas = r.itens;

teste("obra nova: TODA linha da estimativa tem etapa da obra", () => {
  const sem = [...new Set(linhas.filter((l) => !M.etapaDaLinhaDoOrcamento(l, CATALOGO)).map((l) => l.etapa + " / " + (l.subEtapa || "")))];
  assert.deepStrictEqual(sem, [], "linha sem etapa some do confronto estimado × realizado");
});

teste("obra nova: insumo com etapa no catálogo fica na etapa do catálogo, venha de que fórmula vier", () => {
  for (const l of linhas) {
    const ins = CATALOGO.find((c) => c.nome === l.item);
    if (!ins || !ins.etapaPadrao) continue;
    assert.strictEqual(M.etapaDaLinhaDoOrcamento(l, CATALOGO), ins.etapaPadrao, `${l.item} (${l.etapa})`);
  }
  const reg = linhas.find((l) => l.item === "Metal - Hidráulica - Base Registro Gaveta 3/4");
  assert.ok(reg, "o kit de louças emite a base do registro");
  assert.strictEqual(reg.etapa, "Louças e metais", "a fórmula calcula no kit de louças");
  assert.strictEqual(M.etapaDaLinhaDoOrcamento(reg, CATALOGO), "hidraulica", "e a etapa é a do catálogo");
  const o = M.origemDaEtapaDaLinha(reg, CATALOGO);
  assert.deepStrictEqual([o.nome, o.peloCatalogo, o.etapaDaFormula], ["Hidráulica", true, "Louças e metais"]);
  assert.strictEqual(M.grupoDaLinhaDoOrcamento(reg, CATALOGO), "Louças e metais");
});

teste("insumo sem etapa no catálogo: manda a fórmula, uso a uso", () => {
  const cim = linhas.filter((l) => l.item === "Sacos de cimento 50kg");
  const ids = [...new Set(cim.map((l) => M.etapaDaLinhaDoOrcamento(l, CATALOGO)))];
  assert.ok(ids.length > 3, "cimento entra em várias etapas: " + ids.join(", "));
  for (const l of cim) assert.strictEqual(M.etapaDaLinhaDoOrcamento(l, CATALOGO), M.etapaDoOrcamento(l.etapa, l.subEtapa));
});

teste("prestador liga ao catálogo pelo nome; sem catálogo, vale a fórmula", () => {
  const ter = { item: "Terraplanagem", etapa: "Prestadores de serviços", subEtapa: "Prestadores de serviços" };
  assert.strictEqual(M.etapaDaLinhaDoOrcamento(ter, CATALOGO), "terraplanagem");
  assert.strictEqual(M.etapaDaLinhaDoOrcamento(ter, []), "prestadores");
  // etapa do catálogo que não existe na obra não vale: cai na fórmula
  assert.strictEqual(M.etapaDaLinhaDoOrcamento(ter, [{ nome: "Terraplanagem", etapaPadrao: "xyz" }]), "prestadores");
});

teste("o catálogo é lido na hora: mudou lá, a estimativa acompanha sem regerar", () => {
  const reg = linhas.find((l) => l.item === "Metal - Hidráulica - Base Registro Gaveta 3/4");
  const outro = CATALOGO.map((c) => c.codigo === "LOU-047" ? { ...c, etapaPadrao: "loucas_metais" } : c);
  assert.strictEqual(M.etapaDaLinhaDoOrcamento(reg, outro), "loucas_metais");
});

teste("as disciplinas de instalações têm o nome da obra", () => {
  assert.strictEqual(M.etapaDoOrcamento("Hidráulica (água fria e quente)"), "hidraulica");
  assert.strictEqual(M.etapaDoOrcamento("Elétrica e iluminação"), "eletrica");
  assert.strictEqual(M.etapaDoOrcamento("Louças e metais"), "loucas_metais");
  assert.strictEqual(M.etapaDoOrcamento("Outros itens do projeto"), "outros");
  assert.strictEqual(M.etapaDoOrcamento("Esgoto e pluvial"), "esgoto_pluvial");
  assert.strictEqual(M.etapaDoOrcamento("Aquecimento e pressurização"), "aquecimento");
  assert.strictEqual(M.etapaDoOrcamento("Portas internas"), "portas_internas");
});

console.log(`\n${passou} passou, ${falhou} falhou`);
if (falhou) process.exit(1);
