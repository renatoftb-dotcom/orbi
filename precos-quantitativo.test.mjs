// Todo item que o quantitativo emite tem que existir no catálogo de Insumos.
//   node precos-quantitativo.test.mjs
//
// Por que este teste existe: o nome do item é uma string solta. Escrever
// "Tijolos 6 Furos" em vez de "Cerâmicas - Tijolo - Bloco  6 Furos" (com o
// espaço duplo do cadastro) não quebra nada — o item simplesmente sai com
// R$ 0,00 no orçamento, e ninguém percebe até somar o total à mão. Foi
// exatamente o que aconteceu com o tijolo da reforma. Este teste roda o
// motor inteiro contra a semente e exige que cada linha ache seu preço.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const raiz = dirname(fileURLToPath(import.meta.url));
const MODULES = join(raiz, "src", "modules");
const ler = (n) => readFileSync(join(MODULES, n), "utf8");

const orcSrc = ler("orcamento-obra.jsx");
const corteOrc = orcSrc.indexOf("// UI (§7)");
if (corteOrc < 0) throw new Error('Marcador "// UI (§7)" não encontrado em orcamento-obra.jsx');
const insSrc = ler("insumos.jsx");
const corteIns = insSrc.indexOf("// UI");
if (corteIns < 0) throw new Error('Marcador "// UI" não encontrado em insumos.jsx');
const sharedSrc = ler("shared.jsx");
const mComodos = sharedSrc.match(/var COMODOS = \{[\s\S]*?\n\};/);
if (!mComodos) throw new Error("var COMODOS não encontrado em shared.jsx");

const modulo = new Function(`
  var uid = () => "id1";
  ${mComodos[0]}
  ${ler("insumos-seed-cadastro.jsx")}
  ${ler("insumos-seed.jsx")}
  ${insSrc.slice(0, corteIns)}
  ${ler("composicoes-seed.jsx")}
  ${orcSrc.slice(0, corteOrc)}
  return { INSUMOS_SEED, semearInsumos, gerarOrcamentoObra, resolverInsumo, normalizarProjeto, linhasPrestadores, OPCOES_FCK, nomeConcreto };
`)();

// O catálogo como fica depois de "Insumos → Carregar catálogo padrão".
const catalogo = modulo.semearInsumos([], modulo.INSUMOS_SEED).materiais;

const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);

const conferir = (nome, projeto) => {
  const r = modulo.gerarOrcamentoObra(projeto, { materiais: catalogo });
  const semPreco = r.itens.filter((i) => i.semPreco).map((i) => `${i.etapa} / ${i.subEtapa || "—"} → "${i.item}"`);
  assert.deepStrictEqual([...new Set(semPreco)], [],
    `${nome}: item(ns) que não existem no catálogo de Insumos — saem com R$ 0`);
  assert.ok(r.itens.length > 0, `${nome}: não gerou nenhuma linha`);
  return r;
};

teste("obra nova: todo item emitido acha preço no catálogo", () => {
  conferir("obra nova", {
    tipoObra: "nova", tipologia: "Sobrado", padrao: "Médio",
    arquitetura: { areaConstruida: 260, m2ParedesInternas: 320, m2ParedesExternas: 210, m2ParedesTotal: 530, gabarito: 2.8, perimetroParedes: 78 },
    terreo: { area: 130 }, pav1: { area: 130 },
    externa: { pavimentacaoExterna: 60, perimetroPavimentacao: 40, muroDivisa: { comprimento: 30, altura: 2.2 } },
    cobertura: [{ tipo: "Telha Barro Portuguesa", largura: 10, comprimento: 14, aguas: 4, inclinacao: 30 }],
    pisos: { pisoInterno: { m2: 120 }, revestimentoInterno: { m2: 40 }, rodapeM: 90, soleirasM: 12 },
  });
});

teste("reforma: todo item da construção existente acha preço no catálogo", () => {
  const r = conferir("reforma", {
    tipoObra: "reforma", tipologia: "Térrea", padrao: "Médio",
    arquitetura: { areaConstruida: 120, m2ParedesInternas: 150, m2ParedesExternas: 90, m2ParedesTotal: 240 },
    terreo: { area: 120 },
    existente: {
      contrapiso: { remover: 30, executar: 30 }, alvenaria: { remover: 40, executar: 12 },
      drywall: { remover: 8, executar: 20 }, forro: { remover: 25, executar: 25 },
      piso: { remover: 30, executar: 30 }, revestimento: { remover: 18, executar: 18 },
      calcada: { remover: 10, executar: 10 }, banheiro: { remover: 2, executar: 2 },
      esquadria: { remover: 4, executar: 4 }, pintura: { executar: 90 },
    },
  });
  // as linhas da reforma existem mesmo e têm preço > 0
  const daReforma = r.itens.filter((i) => /Demolições|Entulho|Construção existente/.test(i.etapa));
  assert.ok(daReforma.length >= 20, `esperava a reforma inteira, vieram ${daReforma.length} linhas`);
  for (const i of daReforma) {
    assert.ok(i.preco > 0, `${i.etapa} / ${i.item}: preço ${i.preco}`);
    assert.ok(i.total > 0, `${i.etapa} / ${i.item}: total ${i.total}`);
  }
});

teste("o tijolo da reforma é o mesmo insumo da obra nova", () => {
  const nova = modulo.gerarOrcamentoObra({
    tipoObra: "nova", tipologia: "Térrea", padrao: "Médio",
    arquitetura: { areaConstruida: 100, m2ParedesTotal: 200, m2ParedesInternas: 120, m2ParedesExternas: 80 },
    terreo: { area: 100, m2Parede20: 200 },
  }, { materiais: catalogo });
  const reforma = modulo.gerarOrcamentoObra({
    tipoObra: "reforma", tipologia: "Térrea", padrao: "Médio",
    arquitetura: {}, terreo: {}, existente: { alvenaria: { executar: 200 } },
  }, { materiais: catalogo });
  const tijNova = nova.itens.find((i) => /Bloco {1,2}6 Furos/.test(i.item));
  const tijRef = reforma.itens.find((i) => /Bloco {1,2}6 Furos/.test(i.item));
  assert.ok(tijNova, "obra nova não emitiu tijolo de 6 furos");
  assert.ok(tijRef, "reforma não emitiu tijolo de 6 furos");
  assert.strictEqual(tijRef.item, tijNova.item, "os dois têm que usar o MESMO nome de insumo");
  assert.strictEqual(tijRef.insumoCodigo, tijNova.insumoCodigo);
  assert.strictEqual(tijRef.preco, tijNova.preco);
  assert.ok(tijRef.preco > 0, "o tijolo da reforma saiu com preço zero");
  // mesma área de parede, mesma quantidade
  assert.strictEqual(tijRef.qtd, tijNova.qtd);
});

teste("o concreto sai com a resistência no nome mesmo sem tocar no select", () => {
  // O defeito: o formulário MOSTRAVA "Concreto - FCK25" selecionado, mas só
  // gravava a escolha se o usuário mexesse no campo. Quem preenchia o projeto
  // estrutural e deixava o select como estava recebia um item chamado
  // "Concreto" — nome que não existe no catálogo — e a fundação inteira saía
  // com R$ 0,00 sem nenhum aviso.
  const r = conferir("estrutural sem escolher a resistência", {
    tipoObra: "nova", tipologia: "Térrea", padrao: "Médio",
    arquitetura: { areaConstruida: 150, m2ParedesTotal: 260, m2ParedesInternas: 160, m2ParedesExternas: 100, perimetroParedes: 60 },
    terreo: { area: 150, m2Parede20: 260, lajeArea: 150, concretoVigaRespaldo: 4 },
    engenharia: { fundacao: { qtdEstacas: 20, profEstacas: 4, concreto: { estacas: 3, baldrames: 5 } } },
  });
  const concretos = r.itens.filter((i) => /^Concreto/.test(i.item) && i.item !== "Concreto - Bomba");
  assert.ok(concretos.length >= 2, `esperava concreto na fundação e na laje, vieram ${concretos.length}`);
  for (const i of concretos) {
    assert.ok(/FCK\d+$/.test(i.item), `"${i.item}" (${i.subEtapa}) não carrega a resistência`);
    assert.ok(i.preco > 0, `${i.item} em ${i.subEtapa} saiu sem preço`);
  }
  assert.ok(!r.itens.some((i) => i.item === "Concreto"), '"Concreto" pelado nunca pode ser emitido');
});

teste("cada resistência oferecida no formulário existe no catálogo", () => {
  // O select oferecia FCK35, que não tinha cadastro nenhum: escolher a mais
  // resistente das quatro era a única que zerava a linha.
  for (const nome of modulo.OPCOES_FCK) {
    const achado = modulo.resolverInsumo(nome, catalogo);
    assert.ok(achado && achado.insumo, `"${nome}" está no select e não existe em Insumos`);
    assert.ok(achado.insumo.precoReferencia > 0, `"${nome}" existe mas está sem preço`);
  }
  // e a escolha vira mesmo o nome do item
  const comFck35 = modulo.gerarOrcamentoObra({
    tipoObra: "nova", tipologia: "Térrea", padrao: "Médio",
    arquitetura: { areaConstruida: 150 }, terreo: { area: 150 },
    engenharia: { fundacao: { resistenciaConcreto: "Concreto - FCK35", concreto: { baldrames: 5 } } },
  }, { materiais: catalogo });
  const linha = comFck35.itens.find((i) => i.item === "Concreto - FCK35");
  assert.ok(linha, "escolher FCK35 tem que emitir FCK35");
  assert.ok(linha.preco > 0, "FCK35 saiu sem preço");
});

teste("o preço do prestador vem do catálogo de Insumos, não da planilha", () => {
  const cp = modulo.normalizarProjeto({ tipoObra: "nova", tipologia: "Térrea", padrao: "Médio",
    arquitetura: { areaConstruida: 200 }, terreo: { area: 200 } });
  const comCatalogo = modulo.linhasPrestadores(cp, { materiais: catalogo });
  const pintor = comCatalogo.find((l) => l.chave === "pintor");
  assert.strictEqual(pintor.fontePreco, "insumo", "com o insumo cadastrado, o preço tem que vir dele");
  const doCatalogo = catalogo.find((i) => i.codigo === "PRE-002");
  assert.strictEqual(pintor.preco, doCatalogo.precoReferencia,
    `esperava o preço do cadastro (${doCatalogo.precoReferencia}), veio ${pintor.preco}`);

  const semCatalogo = modulo.linhasPrestadores(cp, { materiais: [] });
  assert.strictEqual(semCatalogo.find((l) => l.chave === "pintor").fontePreco, "referencia",
    "sem cadastro, cai na referência da planilha");
});

teste("todo prestador do quadro acha preço depois do catálogo padrão", () => {
  const cp = modulo.normalizarProjeto({ tipoObra: "nova", tipologia: "Térrea", padrao: "Médio",
    arquitetura: { areaConstruida: 200 }, terreo: { area: 200 },
    externa: { pavimentacao: 60, muroDivisa: { comprimento: 30, altura: 2 } },
    arrimo: { comprimento: 10, altura: 3 }, temPiscina: true, piscina: { areaConstruida: 32 },
    cobertura: [{ tipo: "Telha Barro Portuguesa", largura: 10, comprimento: 12, aguas: 4, inclinacao: 30 }] });
  const linhas = modulo.linhasPrestadores(cp, { materiais: catalogo });
  // A regra que importa: nenhum prestador entra no orçamento com R$ 0.
  // Serralheiro é verba fechada e não tem preço de referência — ele aparece
  // no quadro para o usuário digitar, mas desmarcado.
  const zerados = linhas.filter((l) => l.incluir && l.preco <= 0).map((l) => l.item);
  assert.deepStrictEqual(zerados, [], "prestador marcado com preço zero entraria somando nada");
  const semPreco = linhas.filter((l) => l.disponivel && l.sugerido <= 0).map((l) => l.item);
  assert.deepStrictEqual(semPreco, ["Serralheiro"],
    "só o serralheiro fica sem referência; qualquer outro sem preço é cadastro faltando em Insumos");
  for (const l of linhas.filter((x) => x.disponivel && x.sugerido > 0)) {
    assert.ok(l.preco > 0 && l.qtd > 0, `${l.item}: quadro com quantidade ou preço zerado`);
  }
});

let falhas = 0;
for (const [nome, fn] of testes) {
  try { fn(); console.log("  ok   " + nome); }
  catch (e) { falhas++; console.log("  FALHOU " + nome + "\n         " + e.message.split("\n").slice(0, 6).join("\n         ")); }
}
console.log(`\n${testes.length - falhas}/${testes.length} passaram`);
process.exit(falhas ? 1 : 0);
