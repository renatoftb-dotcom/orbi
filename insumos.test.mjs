// Testes do módulo de Insumos — node puro, sem framework.
//   node insumos.test.mjs
//
// Carrega só a parte pura de src/modules/insumos.jsx (tudo antes do bloco UI),
// que é JavaScript comum, sem JSX e sem React.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const raiz = dirname(fileURLToPath(import.meta.url));
const MODULES = join(raiz, "src", "modules");

const seedSrc = readFileSync(join(MODULES, "insumos-seed.jsx"), "utf8");
const modSrc = readFileSync(join(MODULES, "insumos.jsx"), "utf8");

const MARCA = "// UI";
const corte = modSrc.indexOf(MARCA);
if (corte < 0) throw new Error("Marcador de início da UI não encontrado em insumos.jsx");
const puro = modSrc.slice(0, corte);

let _n = 0;
const shim = `var uid = () => "id" + (++__c);\nvar __c = 0;\n`;

const api = new Function(
  shim + seedSrc + "\n" + puro + `
  return { definirEtapaPadraoEmLote, sugerirEtapaDoInsumo, sugestoesDeEtapa,
           INSUMOS_SEED, INSUMO_GRUPOS, normalizarTexto, similaridadeTexto,
           resolverInsumo, proximoCodigoInsumo, grupoInferido, prefixoDoGrupo,
           mesesEntre, fatorIncc, precoInsumo, atualizarPrecoReferencia, comprasDoInsumo,
           previaDePrecosPorCompra, aplicarComprasNoCatalogo, contasRecemPagas,
           contasQueDeixaramDeSerPagas,
           chaveUnidade, unidadeCanonica, mesmaUnidade, unidadeDoPreco, divergenciaDeUnidade,
           migrarMateriaisParaInsumos, semearInsumos };`
)();

// ── mini runner ──────────────────────────────────────────────
let ok = 0, falhas = [];
function t(nome, fn) {
  try { fn(); ok++; }
  catch (e) { falhas.push(nome + "\n    " + e.message); }
}
function eq(a, b, msg) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error((msg || "") + " esperado " + sb + ", veio " + sa);
}
function assert(c, msg) { if (!c) throw new Error(msg || "falhou"); }

const {
  INSUMOS_SEED, normalizarTexto, resolverInsumo, proximoCodigoInsumo,
  fatorIncc, precoInsumo, atualizarPrecoReferencia,
  migrarMateriaisParaInsumos, semearInsumos,
} = api;

const HOJE = "2026-09-05T12:00:00Z";

// ── semente ──────────────────────────────────────────────────
t("semente tem 210 insumos", () => eq(INSUMOS_SEED.length, 210));

t("todo código da semente é único", () => {
  const s = new Set(INSUMOS_SEED.map(x => x.codigo));
  eq(s.size, INSUMOS_SEED.length);
});

t("todo insumo da semente tem preço, exceto os 2 prestadores em aberto", () => {
  const semPreco = INSUMOS_SEED.filter(x => x.precoReferencia == null);
  eq(semPreco.map(x => x.nome).sort(), ["Gestão Obra", "Serralheiro"]);
});

t("semente tem 181 materiais e 29 prestadores", () => {
  eq(INSUMOS_SEED.filter(x => x.tipo === "material").length, 181);
  eq(INSUMOS_SEED.filter(x => x.tipo === "prestador").length, 29);
});

// ── normalização ─────────────────────────────────────────────
t("normalizarTexto tira acento, caixa e pontuação", () => {
  eq(normalizarTexto("Cerâmicas - Tijolo - Bloco  6 Furos"), "ceramicas tijolo bloco 6 furos");
  eq(normalizarTexto("  AREIA   FINA  "), "areia fina");
});

// ── resolução ────────────────────────────────────────────────
const catalogo = [
  { id: "a", codigo: "AGR-001", nome: "Areia Fina", grupo: "Areia e pedra", unidade: "m3", aliases: ["Areia Fina", "AREIA FINA LAVADA"] },
  { id: "b", codigo: "AGR-002", nome: "Areia Grossa", grupo: "Areia e pedra", unidade: "m3", aliases: ["Areia Grossa"] },
  { id: "c", codigo: "CIM-001", nome: "Sacos de cimento 50kg", grupo: "Cimento", unidade: "Unidades", aliases: ["Sacos de cimento 50kg"] },
];

t("resolve por código, ignorando o nome", () => {
  const r = resolverInsumo("qualquer coisa", catalogo, { codigo: "CIM-001" });
  eq(r.confianca, "codigo");
  eq(r.insumo.codigo, "CIM-001");
});

t("resolve por alias exato", () => {
  const r = resolverInsumo("AREIA FINA LAVADA", catalogo);
  eq(r.confianca, "alias");
  eq(r.insumo.codigo, "AGR-001");
});

t("resolve por nome normalizado (espaço e caixa diferentes)", () => {
  const r = resolverInsumo("  areia   FINA ", catalogo);
  assert(["alias", "normalizado"].includes(r.confianca), "confiança inesperada: " + r.confianca);
  eq(r.insumo.codigo, "AGR-001");
});

t("NÃO vincula 'Areia Fina Ensacada' a 'Areia Fina' — só sugere", () => {
  const r = resolverInsumo("Areia Fina Ensacada", catalogo);
  eq(r.insumo, null);
  eq(r.confianca, "sugestao");
  assert(r.candidatos.length > 0, "deveria trazer candidatos");
  eq(r.candidatos[0].insumo.codigo, "AGR-001");
});

t("termo sem parentesco devolve nenhum", () => {
  const r = resolverInsumo("zzz produto inexistente xpto", catalogo);
  eq(r.insumo, null);
  eq(r.confianca, "nenhum");
});

// ── código ───────────────────────────────────────────────────
t("próximo código continua o sequencial do grupo, pulando os códigos reservados pela semente", () => {
  eq(proximoCodigoInsumo("Areia e pedra", catalogo), "AGR-004"); // semente tem AGR-001..003
  eq(proximoCodigoInsumo("Cimento", catalogo), "CIM-002");
});

t("código de insumo inativado nunca é reciclado", () => {
  const comInativo = catalogo.concat([
    { id: "d", codigo: "AGR-003", nome: "Pedrisco", grupo: "Areia e pedra", ativo: false, aliases: [] },
  ]);
  eq(proximoCodigoInsumo("Areia e pedra", comInativo), "AGR-004");
});

t("grupo desconhecido cai em OUT", () => {
  eq(proximoCodigoInsumo("Grupo Que Não Existe", []), "OUT-001");
});

t("migração + semeadura sobre o cadastro legado do escritório não cruza códigos", () => {
  const legado = [
    { id: "m1", nome: "PVC - Esgoto - Tubo 100mm", unidade: "Unidades", categoria: "Tubulação PVC", ultimoPreco: 68.9 },
    { id: "m2", nome: "Elétrica - Cabo Flex Cobre 2.5mm", unidade: "Mts", categoria: "Elétrica e Iluminação", ultimoPreco: 2.35 },
    { id: "m3", nome: "Prestadores de Serviços - Eletricista", unidade: "m2", categoria: "Prestadores de Serviços", ultimoPreco: 42 },
    { id: "m4", nome: "Sacos de cimento 50kg", unidade: "Unidades", ultimoPreco: 37 },
  ];
  const mig = migrarMateriaisParaInsumos(legado);
  const r = semearInsumos(mig.materiais, INSUMOS_SEED);
  const tubo = r.materiais.find((x) => x.nome === "PVC - Esgoto - Tubo 100mm");
  const cabo = r.materiais.find((x) => x.nome === "Elétrica - Cabo Flex Cobre 2.5mm");
  assert(tubo.codigo !== "HID-001", "tubo não pode ficar com o código da torneira");
  assert(cabo.codigo !== "ELE-001", "cabo não pode ficar com o código do poste");
  eq(tubo.precoReferencia, 68.9);
  eq(cabo.precoReferencia, 2.35);
  const poste = r.materiais.find((x) => x.codigo === "ELE-001");
  eq(poste.nome, "Elétrica - Poste Padrão - Trifásica C3");
  // eletricista do cadastro casa com PRE-003 pelo alias, e não vira Pedreiros Casa
  const ele = r.materiais.find((x) => x.nome === "Prestadores de Serviços - Eletricista");
  eq(ele.codigo, "PRE-003");
  eq(r.materiais.find((x) => x.codigo === "PRE-001").nome, "Pedreiros Casa");
  // cimento legado herda CIM-001 e ganha o preço mais novo da semente
  const cim = r.materiais.find((x) => x.codigo === "CIM-001");
  eq(cim.nome, "Sacos de cimento 50kg");
  eq(cim.precoReferencia, 38);
  // nenhum código duplicado
  const cods = r.materiais.map((x) => x.codigo);
  eq(new Set(cods).size, cods.length);
});

// ── INCC e preço ─────────────────────────────────────────────
t("fator INCC de dez/2023 fica em torno de 1,19", () => {
  const f = fatorIncc("2023-12-04", HOJE);
  assert(f > 1.17 && f < 1.21, "fator fora do esperado: " + f);
});

t("preço recente com 3+ compras é confiança alta e não corrige", () => {
  const r = precoInsumo({ precoReferencia: 38, precoData: "2026-08-23", precoNCompras: 253 }, HOJE);
  eq(r.preco, 38);
  eq(r.confianca, "alta");
  eq(r.corrigido, false);
});

t("preço de dez/2023 é corrigido e marcado como baixo/obsoleto", () => {
  const r = precoInsumo({ precoReferencia: 16.78, precoData: "2023-12-04", precoNCompras: 14 }, HOJE);
  assert(r.corrigido, "deveria corrigir");
  assert(r.preco > 19 && r.preco < 21, "preço corrigido inesperado: " + r.preco);
  eq(r.confianca, "obsoleta");
});

t("preço manual vence tudo e não é corrigido", () => {
  const r = precoInsumo({ precoReferencia: 10, precoData: "2022-01-01", precoManual: 99.9 }, HOJE);
  eq(r.preco, 99.9);
  eq(r.confianca, "manual");
  eq(r.corrigido, false);
});

t("insumo sem preço devolve sem_preco", () => {
  eq(precoInsumo({ precoReferencia: null }, HOJE).confianca, "sem_preco");
});

// ── atualização por compra ───────────────────────────────────
const cimento = { codigo: "CIM-001", precoReferencia: 38, precoData: "2026-08-23", precoNCompras: 253 };

t("compra normal vira novo preço de referência", () => {
  const r = atualizarPrecoReferencia(cimento, {
    tipo: "custo", quantidade: 100, total: 4000, dataPagamento: "2026-09-01",
  });
  eq(r.precoReferencia, 40);
  eq(r.ultimoPreco, 40);
  eq(r.precoFonte, "compra");
  eq(r.precoData, "2026-09-01");
  eq(r.precoNCompras, 254);
});

t("compra 5x acima vai para precoPendente e não altera o preço", () => {
  const r = atualizarPrecoReferencia(cimento, {
    tipo: "custo", quantidade: 1, total: 192, dataPagamento: "2026-09-01",
  });
  eq(r.precoReferencia, 38);
  eq(r.precoPendente.valor, 192);
});

t("nota retroativa não rebaixa preço mais novo", () => {
  const r = atualizarPrecoReferencia(cimento, {
    tipo: "custo", quantidade: 10, total: 350, dataPagamento: "2025-01-10",
  });
  eq(r.precoReferencia, 38);
  eq(r.precoData, "2026-08-23");
});

t("preço manual nunca é sobrescrito por compra", () => {
  const m = Object.assign({}, cimento, { precoManual: 41 });
  const r = atualizarPrecoReferencia(m, { tipo: "custo", quantidade: 10, total: 390, dataPagamento: "2026-09-01" });
  eq(r.precoManual, 41);
  eq(r.precoReferencia, 38);
});

t("quantidade ou total zerado não contamina o preço", () => {
  eq(atualizarPrecoReferencia(cimento, { tipo: "custo", quantidade: 0, total: 100 }).precoReferencia, 38);
  eq(atualizarPrecoReferencia(cimento, { tipo: "custo", quantidade: 5, total: 0 }).precoReferencia, 38);
});

t("lançamento de receita não mexe em preço de insumo", () => {
  const r = atualizarPrecoReferencia(cimento, { tipo: "receita", quantidade: 1, total: 999 });
  eq(r.precoReferencia, 38);
});

// ── migração ─────────────────────────────────────────────────
t("material legado sem código ganha código, aliases e preço", () => {
  const legado = [{ id: "x1", nome: "Sacos de cimento 50kg", unidade: "Unidades", ultimoPreco: 37.5 }];
  const r = migrarMateriaisParaInsumos(legado);
  eq(r.alterados, 1);
  eq(r.materiais[0].codigo, "CIM-001");
  eq(r.materiais[0].aliases, ["Sacos de cimento 50kg"]);
  eq(r.materiais[0].precoReferencia, 37.5);
  eq(r.materiais[0].precoFonte, "compra");
});

t("migração é idempotente", () => {
  const legado = [{ id: "x1", nome: "Areia Fina", unidade: "m3", ultimoPreco: 120 }];
  const a = migrarMateriaisParaInsumos(legado);
  const b = migrarMateriaisParaInsumos(a.materiais);
  eq(b.alterados, 0);
  eq(a.materiais[0].codigo, b.materiais[0].codigo);
});

// ── semeadura ────────────────────────────────────────────────
t("semeadura em base vazia cria os 210", () => {
  const r = semearInsumos([], INSUMOS_SEED);
  eq(r.criados, 210);
  eq(r.materiais.length, 210);
});

t("semeadura é idempotente — segunda vez não cria nem altera", () => {
  const a = semearInsumos([], INSUMOS_SEED);
  const b = semearInsumos(a.materiais, INSUMOS_SEED);
  eq(b.criados, 0);
  eq(b.atualizados, 0);
  eq(b.materiais.length, 210);
});

t("semeadura não sobrescreve preço definido à mão", () => {
  const a = semearInsumos([], INSUMOS_SEED);
  const idx = a.materiais.findIndex(x => x.codigo === "CIM-001");
  a.materiais[idx] = Object.assign({}, a.materiais[idx], { precoManual: 55, precoReferencia: 1 });
  const b = semearInsumos(a.materiais, INSUMOS_SEED);
  const cim = b.materiais.find(x => x.codigo === "CIM-001");
  eq(cim.precoManual, 55);
  eq(cim.precoReferencia, 1);
});

t("semeadura não rebaixa preço mais recente que o da semente", () => {
  const a = semearInsumos([], INSUMOS_SEED);
  const idx = a.materiais.findIndex(x => x.codigo === "CIM-001");
  a.materiais[idx] = Object.assign({}, a.materiais[idx], { precoReferencia: 42, precoData: "2026-09-01" });
  const b = semearInsumos(a.materiais, INSUMOS_SEED);
  eq(b.materiais.find(x => x.codigo === "CIM-001").precoReferencia, 42);
});

t("semeadura casa material legado por nome e não duplica", () => {
  const legado = migrarMateriaisParaInsumos([
    { id: "x1", nome: "Sacos de cimento 50kg", unidade: "Unidades", ultimoPreco: 30 },
  ]).materiais;
  const r = semearInsumos(legado, INSUMOS_SEED);
  const cimentos = r.materiais.filter(x => normalizarTexto(x.nome) === "sacos de cimento 50kg");
  eq(cimentos.length, 1);
  eq(r.materiais.length, 210);
});

t("todo insumo semeado resolve por si mesmo", () => {
  const r = semearInsumos([], INSUMOS_SEED);
  const falhou = INSUMOS_SEED.filter(s => {
    const res = resolverInsumo(s.nome, r.materiais);
    return !res.insumo || res.insumo.codigo !== s.codigo;
  });
  eq(falhou.map(x => x.codigo), []);
});

// ── resultado ────────────────────────────────────────────────
t("semente compra_corrigida (já com fator) não é corrigida duas vezes", () => {
  // raw 67,26 × 1,1375 = 76,51 (semente); hoje o fator desde 2024-10-11 ainda é 1,1375 → fica 76,51
  const r = precoInsumo({ precoReferencia: 76.51, precoData: "2024-10-11", precoNCompras: 12, precoFatorInccAplicado: 1.1375 }, HOJE);
  assert(r.corrigido, "deveria marcar corrigido");
  assert(r.preco > 76 && r.preco < 78, "corrigiu duas vezes: " + r.preco);
});

t("material do cadastro antigo (só ultimoPreco) já vale como preço, com confiança baixa", () => {
  const r = precoInsumo({ nome: "PVC - Esgoto - Tubo 100mm", unidade: "Unidades", ultimoPreco: 68.9 }, HOJE);
  eq(r.preco, 68.9);
  eq(r.confianca, "baixa");
  eq(precoInsumo({ nome: "x", ultimoPreco: 0 }, HOJE).preco, null);
});

t("a etapa padrão se define em lote, e só no que foi marcado", () => {
  const cat = [
    { id: "a", codigo: "HID-009", nome: "PVC - Marrom - Tubo 25mm", grupo: "Hidráulica" },
    { id: "b", codigo: "HID-300", nome: "PVC - Esgoto 100mm", grupo: "Hidráulica", etapaPadrao: "esgoto_pluvial" },
    { id: "c", codigo: "CIM-001", nome: "Cimento CP II", grupo: "Cimento" },
    { codigo: "SEM-ID", nome: "Insumo antigo sem id", grupo: "Outros" },
  ];

  const r = api.definirEtapaPadraoEmLote(cat, ["a", "SEM-ID"], "hidraulica");
  eq(r.mudados, 2, "casa por id e, na falta dele, por código:");
  eq(r.insumos[0].etapaPadrao, "hidraulica");
  eq(r.insumos[3].etapaPadrao, "hidraulica");
  eq(r.insumos[1].etapaPadrao, "esgoto_pluvial", "quem não foi marcado não muda:");
  assert(r.insumos[2].etapaPadrao === undefined, "o cimento continua sem etapa");
  assert(r.insumos !== cat, "devolve lista nova");
  assert(r.insumos[2] === cat[2], "o item intocado é o mesmo objeto");

  // reaplicar a mesma etapa não conta como mudança
  eq(api.definirEtapaPadraoEmLote(r.insumos, ["a"], "hidraulica").mudados, 0);

  // etapa vazia tira a marcação
  const limpo = api.definirEtapaPadraoEmLote(cat, ["b"], "");
  eq(limpo.insumos[1].etapaPadrao, "");
  eq(limpo.mudados, 1);

  eq(api.definirEtapaPadraoEmLote([], ["a"], "x"), { insumos: [], mudados: 0 });
  eq(api.definirEtapaPadraoEmLote(cat, [], "x").mudados, 0);
});

t("a sugestão de etapa lê o nome antes do grupo, e cala quando não sabe", () => {
  const sug = (nome, grupo, etapaPadrao) => api.sugerirEtapaDoInsumo({ nome, grupo, etapaPadrao });

  // o nome manda: joelho existe na água fria e no esgoto
  eq(sug("PVC - Esgoto - Joelho 100mm", "Hidráulica"), "esgoto_pluvial");
  eq(sug("PVC - Alimentação Água Fria - Joelho 90° 25mm", "Hidráulica"), "hidraulica");
  eq(sug("PVC - Esgoto - Ralo Click Inox 10cm", "Hidráulica"), "esgoto_pluvial");
  eq(sug("PVC - Esgoto - Porta Grelha Ralo PVC 15CM", "Hidráulica"), "esgoto_pluvial");

  // elétrico cadastrado no grupo errado ainda assim vai para elétrica
  eq(sug("PVC - Elétrica - Caixa 4x2\" pvc embutir", "Hidráulica"), "eletrica");
  eq(sug("PVC - Elétrica - Corrugado Kanaflex 1.1/2''", "Hidráulica"), "eletrica");

  eq(sug("Equipamentos e Sistemas - Bomba Circulação Boiler", "Hidráulica"), "aquecimento");

  // sem pista no nome, o grupo resolve — mas só os grupos de etapa única
  eq(sug("Tinta acrílica branca 18L", "Tintas"), "pintura");
  eq(sug("Telha de concreto", "Telhas"), "coberturas");
  eq(sug("Cimento CP II 50kg", "Cimento"), "", "cimento serve meia obra: fica em branco");
  eq(sug("Areia média", "Areia e pedra"), "");
  eq(sug("Tábua de pinus", "Madeira de caixaria"), "", "caixaria serve fundação e laje");

  // quem já tem etapa não recebe sugestão
  eq(sug("PVC - Esgoto - Ralo", "Hidráulica", "pre_obra"), "");

  const cat = [
    { id: "1", nome: "PVC - Esgoto - Ralo Click Inox 10cm", grupo: "Hidráulica" },
    { id: "2", nome: "PVC - Esgoto - Porta Grelha 15CM", grupo: "Hidráulica" },
    { id: "3", nome: "PVC - Alimentação Água Fria - Luva 25mm", grupo: "Hidráulica" },
    { id: "4", nome: "Cimento CP II 50kg", grupo: "Cimento" },
    { id: "5", nome: "PVC - Esgoto - Tubo 100mm", grupo: "Hidráulica", etapaPadrao: "esgoto_pluvial" },
    { id: "6", nome: "Insumo desativado", grupo: "Tintas", ativo: false },
  ];
  const r = api.sugestoesDeEtapa(cat);
  eq(r.grupos.map(g => [g.etapaId, g.quantos]), [["esgoto_pluvial", 2], ["hidraulica", 1]],
     "maior grupo primeiro; quem já tem etapa e o inativo ficam fora:");
  eq(r.total, 3);
  eq(r.semSugestao, 1, "o cimento é contado como sem sugestão");
  // sem a tabela de etapas por perto (este harness não a carrega), o nome
  // cai no próprio id em vez de quebrar
  eq(r.grupos[0].nome, "esgoto_pluvial");
});

// ── Grupo que serve a uma etapa só ───────────────────────
t("grupo que serve a uma etapa só propõe essa etapa", () => {
  const sug = (nome, grupo, etapaPadrao) => api.sugerirEtapaDoInsumo({ nome, grupo, etapaPadrao });

  // ferramenta e equipamento têm etapa própria na planilha do escritório
  eq(sug("Chave Philips Chata 3x150", "Ferramentas"), "ferramentas");
  eq(sug("Disco Diamantado Corte Parede", "Ferramentas"), "ferramentas");
  eq(sug("Betoneira 400L", "Locação de equipamentos"), "locacao_equip");
  eq(sug("Marceneiro Portas Internas", "Prestadores de serviços"), "prestadores");

  // etapa escolhida à mão nunca é sobrescrita por proposta
  eq(sug("Chave Philips", "Ferramentas", "eletrica"), "");

  // e o que entra em meia obra continua em branco
  eq(sug("Areia média", "Areia e pedra"), "");
  eq(sug("Parafuso bucha 8mm", "Fixação"), "");
});

t("as compras do insumo vêm do escritório E das obras", () => {
  const insumo = { codigo: "ELE-062", nome: "Elétrica - Fita Isolante" };
  const data = {
    lancamentos: [
      { id: "l1", insumoCodigo: "ELE-062", quantidade: 10, valor: 49, dataPagamento: "2026-03-10", fornecedorId: "f9" },
      { id: "l2", insumoCodigo: "OUTRO", quantidade: 5, valor: 20, data: "2026-03-11" },
    ],
    obras: [{ id: "ob1", nome: "Reforma Cobop", contasPagar: [
      { id: "c1", insumoCodigo: "ELE-062", quantidade: 1, valor: 4.90, vencimento: "2026-09-28", prestadorId: "f1", favorecido: "OURIFER" },
      { id: "c2", insumoCodigo: "ELE-062", quantidade: 2, valor: 12, pago: true, valorPago: 10, pagoEm: "2026-05-02" },
      { id: "c3", insumoCodigo: "ACO-101", quantidade: 3, valor: 30 },
    ] }],
  };
  const r = api.comprasDoInsumo(insumo, data);
  eq(r.length, 3, "duas da obra e uma do escritório");
  eq(r.map(c => c.id), ["l1", "c2", "c1"], "ordenadas pela data");
  eq(r.map(c => c.origem), ["escritorio", "obra", "obra"]);
});

t("o valor da compra é o que de fato saiu", () => {
  const insumo = { codigo: "X" };
  const pago = api.comprasDoInsumo(insumo, { obras: [{ id:"o", contasPagar: [
    { insumoCodigo: "X", quantidade: 2, valor: 12, pago: true, valorPago: 10, pagoEm: "2026-05-02" }] }] });
  eq(pago[0].total, 10, "baixado vale o valorPago, já rateado com o desconto");
  eq(pago[0].unitario, 5);
  const aberto = api.comprasDoInsumo(insumo, { obras: [{ id:"o", contasPagar: [
    { insumoCodigo: "X", quantidade: 2, valor: 12, vencimento: "2026-05-02" }] }] });
  eq(aberto[0].total, 12, "em aberto vale o valor da conta");
  eq(aberto[0].pago, false);
});

t("conta sem quantidade, sem valor ou sem data não vira compra", () => {
  const insumo = { codigo: "X" };
  const r = api.comprasDoInsumo(insumo, { obras: [{ id:"o", contasPagar: [
    { insumoCodigo: "X", quantidade: 0, valor: 12, vencimento: "2026-01-01" },
    { insumoCodigo: "X", quantidade: 2, valor: 0, vencimento: "2026-01-01" },
    { insumoCodigo: "X", quantidade: 2, valor: 12 },
  ] }] });
  eq(r.length, 0);
});

t("insumo sem código não puxa compra nenhuma", () => {
  eq(api.comprasDoInsumo({ nome: "sem codigo" }, { lancamentos: [{ insumoCodigo: "", quantidade: 1, valor: 1, data: "2026-01-01" }] }).length, 0);
  eq(api.comprasDoInsumo(null, {}).length, 0);
  eq(api.comprasDoInsumo({ codigo: "X" }, null).length, 0);
});


// ── previaDePrecosPorCompra — o levantamento não grava, só conta ─────────

// Uma obra com uma conta paga, pronta para montar os cenários.
function conta(codigo, qtd, valor, data) {
  return { insumoCodigo: codigo, quantidade: qtd, valor: valor, valorPago: valor,
           pago: true, pagoEm: data, vencimento: data };
}
function mundo(contas) { return { obras: [{ id: "o1", nome: "Obra 1", contasPagar: contas }] }; }

t("insumo sem compra não aparece no levantamento", () => {
  const r = api.previaDePrecosPorCompra(
    [{ codigo: "MAT.001", nome: "Cimento", precoReferencia: 40 }], mundo([]));
  eq(r.linhas.length, 0);
  eq(r.resumo.comCompras, 0);
});

t("compra normal atualiza o preço e mede a variação", () => {
  const r = api.previaDePrecosPorCompra(
    [{ codigo: "MAT.001", nome: "Cimento", precoReferencia: 40, precoData: "2026-01-01" }],
    mundo([conta("MAT.001", 10, 500, "2026-03-01")]));
  eq(r.linhas.length, 1);
  eq(r.linhas[0].situacao, "atualiza");
  eq(r.linhas[0].precoAntes, 40);
  eq(r.linhas[0].precoDepois, 50);
  eq(r.linhas[0].variacao, 25);
  eq(r.resumo.atualiza, 1);
  eq(r.resumo.compras, 1);
});

t("preço manual fica intocado e é contado à parte", () => {
  const r = api.previaDePrecosPorCompra(
    [{ codigo: "MAT.001", nome: "Cimento", precoReferencia: 40, precoManual: 38 }],
    mundo([conta("MAT.001", 10, 500, "2026-03-01")]));
  eq(r.linhas[0].situacao, "manual");
  eq(r.linhas[0].precoAntes, 38);
  eq(r.linhas[0].precoDepois, 38);
  eq(r.resumo.manual, 1);
  eq(r.resumo.atualiza, 0);
});

t("salto suspeito cai em pendência, não no preço", () => {
  const r = api.previaDePrecosPorCompra(
    [{ codigo: "MAT.001", nome: "Cimento", precoReferencia: 40, precoData: "2026-01-01" }],
    mundo([conta("MAT.001", 1, 400, "2026-03-01")]));
  eq(r.linhas[0].situacao, "pendente");
  eq(r.linhas[0].precoAntes, 40);
  eq(r.linhas[0].precoDepois, 400);
  eq(r.linhas[0].variacao, null);
  eq(r.resumo.pendente, 1);
  eq(r.resumo.atualiza, 0);
});

t("queda suspeita também cai em pendência", () => {
  const r = api.previaDePrecosPorCompra(
    [{ codigo: "MAT.001", nome: "Cimento", precoReferencia: 40, precoData: "2026-01-01" }],
    mundo([conta("MAT.001", 10, 50, "2026-03-01")]));
  eq(r.linhas[0].situacao, "pendente");
  eq(r.linhas[0].precoDepois, 5);
});

t("nota retroativa não rebaixa preço mais novo", () => {
  const r = api.previaDePrecosPorCompra(
    [{ codigo: "MAT.001", nome: "Cimento", precoReferencia: 40, precoData: "2026-06-01" }],
    mundo([conta("MAT.001", 10, 450, "2026-02-01")]));
  eq(r.linhas[0].situacao, "semMudanca");
  eq(r.linhas[0].precoAntes, 40);
  eq(r.linhas[0].precoDepois, 40);
  eq(r.resumo.semMudanca, 1);
});

t("compra que repete o preço de hoje ainda atualiza a data", () => {
  const r = api.previaDePrecosPorCompra(
    [{ codigo: "MAT.001", nome: "Cimento", precoReferencia: 50, precoData: "2026-01-01" }],
    mundo([conta("MAT.001", 10, 500, "2026-03-01")]));
  eq(r.linhas[0].situacao, "atualiza");
  eq(r.linhas[0].precoAntes, 50);
  eq(r.linhas[0].precoDepois, 50);
  eq(r.linhas[0].variacao, 0);
});

t("várias compras aplicam na ordem: a última manda", () => {
  const r = api.previaDePrecosPorCompra(
    [{ codigo: "MAT.001", nome: "Cimento", precoReferencia: 40, precoData: "2026-01-01" }],
    mundo([
      conta("MAT.001", 10, 450, "2026-02-01"),
      conta("MAT.001", 10, 520, "2026-04-01"),
    ]));
  eq(r.linhas[0].compras, 2);
  eq(r.linhas[0].precoDepois, 52);
  eq(r.resumo.compras, 2);
});

t("insumo sem preço de referência aceita a primeira compra", () => {
  const r = api.previaDePrecosPorCompra(
    [{ codigo: "MAT.001", nome: "Cimento", precoReferencia: null }],
    mundo([conta("MAT.001", 4, 100, "2026-03-01")]));
  eq(r.linhas[0].situacao, "atualiza");
  eq(r.linhas[0].precoAntes, null);
  eq(r.linhas[0].precoDepois, 25);
  eq(r.linhas[0].variacao, null);
});

t("insumo inativo fica fora do levantamento", () => {
  const r = api.previaDePrecosPorCompra(
    [{ codigo: "MAT.001", nome: "Cimento", precoReferencia: 40, ativo: false }],
    mundo([conta("MAT.001", 10, 500, "2026-03-01")]));
  eq(r.linhas.length, 0);
  eq(r.resumo.comCompras, 0);
});

t("pendência vem antes de atualização na ordem de conferência", () => {
  const r = api.previaDePrecosPorCompra([
    { codigo: "MAT.001", nome: "Cimento", precoReferencia: 40, precoData: "2026-01-01" },
    { codigo: "MAT.002", nome: "Areia",   precoReferencia: 40, precoData: "2026-01-01" },
    { codigo: "MAT.003", nome: "Brita",   precoReferencia: 40, precoManual: 40 },
  ], mundo([
    conta("MAT.001", 10, 440, "2026-03-01"),   // atualiza
    conta("MAT.002", 1, 400, "2026-03-01"),    // pendente
    conta("MAT.003", 10, 600, "2026-03-01"),   // manual
  ]));
  eq(r.linhas.map((l) => l.situacao).join(","), "pendente,atualiza,manual");
});

t("o levantamento não toca no insumo que recebeu", () => {
  const insumo = { codigo: "MAT.001", nome: "Cimento", precoReferencia: 40, precoData: "2026-01-01" };
  api.previaDePrecosPorCompra([insumo], mundo([conta("MAT.001", 10, 500, "2026-03-01")]));
  eq(insumo.precoReferencia, 40);
  eq(insumo.precoData, "2026-01-01");
  eq(insumo.precoPendente, undefined);
});

t("lista vazia ou dados ausentes não explodem", () => {
  eq(api.previaDePrecosPorCompra([], {}).linhas.length, 0);
  eq(api.previaDePrecosPorCompra(null, null).linhas.length, 0);
  eq(api.previaDePrecosPorCompra([null], {}).resumo.comCompras, 0);
});


// ── unidade ─────────────────────────────────────────────────────────────

t("abreviação da loja é a mesma unidade do catálogo", () => {
  eq(api.mesmaUnidade("un", "Unidades"), true);
  eq(api.mesmaUnidade("PÇ", "Unidades"), true);
  eq(api.mesmaUnidade("m", "Mts"), true);
  eq(api.mesmaUnidade("ML", "Mts"), true);
  eq(api.mesmaUnidade("KG", "Kg"), true);
  eq(api.mesmaUnidade("rl", "Rolos"), true);
});

t("metro e rolo não são a mesma unidade", () => {
  eq(api.mesmaUnidade("m", "Rolos"), false);
  eq(api.mesmaUnidade("Mts", "Unidades"), false);
  eq(api.mesmaUnidade("Kg", "Lts"), false);
});

t("unidade desconhecida de um lado só vale por ela mesma", () => {
  eq(api.mesmaUnidade("vb", "vb"), true);
  eq(api.mesmaUnidade("sacos", "Unidades"), false);
});

t("unidade em branco é dúvida, não divergência", () => {
  eq(api.mesmaUnidade("", "Mts"), null);
  eq(api.mesmaUnidade("Mts", null), null);
  eq(api.mesmaUnidade(undefined, undefined), null);
});

t("a unidade do preço é a do último preço, e cai na do cadastro", () => {
  eq(api.unidadeDoPreco({ unidade: "Rolos" }), "Rolos");
  eq(api.unidadeDoPreco({ unidade: "Rolos", precoUnidade: "Mts" }), "Mts");
  eq(api.unidadeDoPreco({}), "");
});

// ── a guarda de unidade em atualizarPrecoReferencia ──────────────────────

t("linha de pedreiro: catálogo em rolo, loja cobra o metro — para e não altera", () => {
  const insumo = { codigo: "FER.001", nome: "Linha de pedreiro",
    unidade: "Rolos", precoReferencia: 48, precoData: "2026-01-01" };
  const r = api.atualizarPrecoReferencia(insumo, {
    tipo: "custo", quantidade: 100, total: 48, data: "2026-03-01", unidade: "m", id: "L1" });
  eq(r.precoReferencia, 48, "o preço do rolo continua de pé");
  eq(r.precoPendente.motivo, "unidade");
  eq(r.precoPendente.valor, 0.48);
  eq(r.precoPendente.unidade, "m");
  eq(r.precoPendente.unidadePreco, "Rolos");
});

t("cano: catálogo na barra, loja cota o metro — para por unidade", () => {
  const insumo = { codigo: "HID.001", nome: "Cano PVC 100mm barra 6m",
    unidade: "Unidades", precoReferencia: 90, precoData: "2026-01-01" };
  const r = api.atualizarPrecoReferencia(insumo, {
    tipo: "custo", quantidade: 60, total: 900, data: "2026-03-01", unidade: "Mts" });
  eq(r.precoReferencia, 90);
  eq(r.precoPendente.motivo, "unidade");
  eq(r.precoPendente.valor, 15);
});

t("a guarda de unidade pega o que o fator 3x não pegaria", () => {
  // Barra de 2m: razão 1,6 passa folgada pelo salto, mas a unidade não bate.
  const insumo = { codigo: "X", unidade: "Mts", precoReferencia: 2.5, precoData: "2026-01-01" };
  const r = api.atualizarPrecoReferencia(insumo, {
    tipo: "custo", quantidade: 10, total: 40, data: "2026-03-01", unidade: "un" });
  eq(r.precoPendente.motivo, "unidade");
  eq(r.precoReferencia, 2.5);
});

t("unidade bate: o preço entra e carrega a unidade conferida", () => {
  const insumo = { codigo: "X", unidade: "Rolos", precoReferencia: 48, precoData: "2026-01-01" };
  const r = api.atualizarPrecoReferencia(insumo, {
    tipo: "custo", quantidade: 2, total: 104, data: "2026-03-01", unidade: "rl" });
  eq(r.precoReferencia, 52);
  eq(r.precoUnidade, "rl");
  eq(r.precoUnidadeConferida, true);
  eq(r.precoPendente, null);
});

t("unidade divergente para até sem preço anterior", () => {
  const insumo = { codigo: "X", unidade: "Rolos", precoReferencia: null };
  const r = api.atualizarPrecoReferencia(insumo, {
    tipo: "custo", quantidade: 100, total: 48, data: "2026-03-01", unidade: "m" });
  eq(r.precoPendente.motivo, "unidade");
  eq(r.precoReferencia, null);
});

t("sem unidade na compra o preço entra, mas marcado como não conferido", () => {
  const insumo = { codigo: "X", unidade: "Rolos", precoReferencia: 48, precoData: "2026-01-01" };
  const r = api.atualizarPrecoReferencia(insumo, {
    tipo: "custo", quantidade: 2, total: 104, data: "2026-03-01" });
  eq(r.precoReferencia, 52);
  eq(r.precoUnidadeConferida, false);
  eq(r.precoPendente, null);
});

t("insumo sem unidade cadastrada não bloqueia nada", () => {
  const insumo = { codigo: "X", precoReferencia: 48, precoData: "2026-01-01" };
  const r = api.atualizarPrecoReferencia(insumo, {
    tipo: "custo", quantidade: 2, total: 104, data: "2026-03-01", unidade: "rl" });
  eq(r.precoReferencia, 52);
  eq(r.precoUnidadeConferida, false);
});

t("salto continua sendo salto, com o motivo escrito", () => {
  const insumo = { codigo: "X", unidade: "Kg", precoReferencia: 10, precoData: "2026-01-01" };
  const r = api.atualizarPrecoReferencia(insumo, {
    tipo: "custo", quantidade: 1, total: 100, data: "2026-03-01", unidade: "kg" });
  eq(r.precoPendente.motivo, "salto");
  eq(r.precoReferencia, 10);
});

t("a unidade do preço manda sobre a do cadastro na próxima conferência", () => {
  // Cadastro diz Rolos, mas o último preço foi gravado em Mts: a compra em
  // metro passa a ser a comparável.
  const insumo = { codigo: "X", unidade: "Rolos", precoUnidade: "Mts",
    precoReferencia: 0.5, precoData: "2026-01-01" };
  const r = api.atualizarPrecoReferencia(insumo, {
    tipo: "custo", quantidade: 100, total: 52, data: "2026-03-01", unidade: "m" });
  eq(r.precoReferencia, 0.52);
  eq(r.precoPendente, null);
});

// ── previaDePrecosPorCompra com unidade ─────────────────────────────────

t("a prévia separa quem para por unidade de quem para por salto", () => {
  const r = api.previaDePrecosPorCompra([
    { codigo: "A", nome: "Linha", unidade: "Rolos", precoReferencia: 48, precoData: "2026-01-01" },
    { codigo: "B", nome: "Cimento", unidade: "Unidades", precoReferencia: 40, precoData: "2026-01-01" },
  ], { obras: [{ id: "o1", contasPagar: [
    { insumoCodigo: "A", quantidade: 100, valor: 48, unidade: "m", pago: true, pagoEm: "2026-03-01" },
    { insumoCodigo: "B", quantidade: 1, valor: 400, unidade: "un", pago: true, pagoEm: "2026-03-01" },
  ] }] });
  eq(r.resumo.pendente, 2);
  eq(r.resumo.porUnidade, 1);
  eq(r.resumo.porSalto, 1);
  const porCod = {}; for (const l of r.linhas) porCod[l.insumo.codigo] = l;
  eq(porCod.A.motivo, "unidade");
  eq(porCod.A.unidadeCompra, "m");
  eq(porCod.A.unidadePreco, "Rolos");
  eq(porCod.B.motivo, "salto");
});

// ── aplicarComprasNoCatalogo ────────────────────────────────────────────

t("a baixa aplica o preço e relata o que fez", () => {
  const mats = [{ codigo: "A", nome: "Cimento", unidade: "Unidades", precoReferencia: 40, precoData: "2026-01-01" }];
  const r = api.aplicarComprasNoCatalogo(mats, [
    { id: "c1", insumoCodigo: "A", quantidade: 10, valor: 500, valorPago: 450,
      unidade: "un", pago: true, pagoEm: "2026-03-01" },
  ]);
  eq(r.materiais[0].precoReferencia, 45, "vale o valor PAGO, não o de tabela");
  eq(r.relato.aplicados.length, 1);
  eq(r.relato.aplicados[0].precoAntes, 40);
  eq(r.relato.aplicados[0].precoDepois, 45);
  eq(r.relato.aplicados[0].conferida, true);
  eq(r.relato.pendencias.length, 0);
});

t("a baixa com unidade errada não muda o catálogo e vira pendência relatada", () => {
  const mats = [{ codigo: "A", nome: "Linha de pedreiro", unidade: "Rolos", precoReferencia: 48, precoData: "2026-01-01" }];
  const r = api.aplicarComprasNoCatalogo(mats, [
    { id: "c1", insumoCodigo: "A", quantidade: 100, valor: 48, unidade: "m", pago: true, pagoEm: "2026-03-01" },
  ]);
  eq(r.materiais[0].precoReferencia, 48);
  eq(r.relato.aplicados.length, 0);
  eq(r.relato.pendencias.length, 1);
  eq(r.relato.pendencias[0].motivo, "unidade");
  eq(r.relato.pendencias[0].unidadeCompra, "m");
  eq(r.relato.pendencias[0].unidadePreco, "Rolos");
  eq(r.relato.pendencias[0].precoDaCompra, 0.48);
});

t("nada a aplicar devolve a MESMA lista, para não gravar à toa", () => {
  const mats = [{ codigo: "A", nome: "Cimento", precoReferencia: 40, precoManual: 40 }];
  const r = api.aplicarComprasNoCatalogo(mats, [
    { id: "c1", insumoCodigo: "A", quantidade: 10, valor: 500, pago: true, pagoEm: "2026-03-01" },
  ]);
  if (r.materiais !== mats) throw new Error("devia devolver a mesma referência");
});

t("conta sem código de insumo é contada e ignorada", () => {
  const mats = [{ codigo: "A", nome: "Cimento", precoReferencia: 40 }];
  const r = api.aplicarComprasNoCatalogo(mats, [
    { id: "c1", insumoCodigo: "", quantidade: 1, valor: 10, pago: true, pagoEm: "2026-03-01" },
    { id: "c2", insumoCodigo: "ZZZ", quantidade: 1, valor: 10, pago: true, pagoEm: "2026-03-01" },
  ]);
  eq(r.relato.semCodigo, 2);
  if (r.materiais !== mats) throw new Error("não devia mexer na lista");
});

t("duas contas do mesmo insumo na mesma baixa: a mais nova manda", () => {
  const mats = [{ codigo: "A", nome: "Cimento", unidade: "un", precoReferencia: 40, precoData: "2026-01-01" }];
  const r = api.aplicarComprasNoCatalogo(mats, [
    { id: "c2", insumoCodigo: "A", quantidade: 10, valor: 520, unidade: "un", pago: true, pagoEm: "2026-04-01" },
    { id: "c1", insumoCodigo: "A", quantidade: 10, valor: 450, unidade: "un", pago: true, pagoEm: "2026-02-01" },
  ]);
  eq(r.materiais[0].precoReferencia, 52);
});

t("aplicarComprasNoCatalogo não muta a lista nem os insumos recebidos", () => {
  const insumo = { codigo: "A", nome: "Cimento", unidade: "un", precoReferencia: 40, precoData: "2026-01-01" };
  const mats = [insumo];
  api.aplicarComprasNoCatalogo(mats, [
    { id: "c1", insumoCodigo: "A", quantidade: 10, valor: 500, unidade: "un", pago: true, pagoEm: "2026-03-01" },
  ]);
  eq(insumo.precoReferencia, 40);
  eq(mats[0].precoReferencia, 40);
});

t("catálogo vazio não explode", () => {
  eq(api.aplicarComprasNoCatalogo([], [{ id: "c", insumoCodigo: "A", quantidade: 1, valor: 1 }]).relato.aplicados.length, 0);
  eq(api.aplicarComprasNoCatalogo(null, null).relato.aplicados.length, 0);
});

// ── contasRecemPagas ────────────────────────────────────────────────────

t("só as que acabaram de virar pagas entram", () => {
  const antes = [
    { id: "1", insumoCodigo: "A", pago: true },
    { id: "2", insumoCodigo: "B", pago: false },
    { id: "3", insumoCodigo: "C", pago: false },
  ];
  const depois = [
    { id: "1", insumoCodigo: "A", pago: true },
    { id: "2", insumoCodigo: "B", pago: true },
    { id: "3", insumoCodigo: "C", pago: false },
    { id: "4", insumoCodigo: "D", pago: true },
  ];
  eq(api.contasRecemPagas(antes, depois).map((c) => c.id).join(","), "2,4",
    "a 1 já estava paga, a 3 segue aberta, a 4 nasceu paga");
});

t("conta sem insumo casado AINDA é uma conta paga", () => {
  // Quem pergunta "o que acabou de ser pago" não quer só o que tem catálogo:
  // o extrato do escritório precisa do dinheiro que saiu, com código ou sem.
  eq(api.contasRecemPagas([], [{ id: "1", pago: true, insumoCodigo: "" }]).length, 1);
  // e o preço do catálogo, esse sim, ignora quem não tem código
  const mats = [{ codigo: "A", nome: "Cimento", precoReferencia: 40 }];
  const r = api.aplicarComprasNoCatalogo(mats, [{ id: "1", insumoCodigo: "", quantidade: 1, valor: 10, pago: true, pagoEm: "2026-03-01" }]);
  eq(r.relato.aplicados.length, 0);
  eq(r.relato.semCodigo, 1);
});

t("desfazer baixa não vira compra", () => {
  eq(api.contasRecemPagas([{ id: "1", insumoCodigo: "A", pago: true }],
                          [{ id: "1", insumoCodigo: "A", pago: false }]).length, 0);
});


// ── Unidade trocada na nota, pega antes de lançar ───────────────

const AREIA = { codigo: "AGR-001", nome: "Areia Fina", unidade: "m3" };

t("areia em METRO quando o catálogo usa m3 é divergência", () => {
  const d = api.divergenciaDeUnidade("Mts", AREIA);
  eq(d.daLoja, "Mts");
  eq(d.doCatalogo, "m3");
  eq(api.divergenciaDeUnidade("METRO", AREIA).doCatalogo, "m3");
});

t("a mesma unidade escrita diferente não é divergência", () => {
  eq(api.divergenciaDeUnidade("m3", AREIA), null);
  eq(api.divergenciaDeUnidade("M3", AREIA), null);
  eq(api.divergenciaDeUnidade("m³", AREIA), null);
});

t("sem insumo casado não há o que comparar", () => {
  eq(api.divergenciaDeUnidade("Mts", null), null);
  eq(api.divergenciaDeUnidade("Mts", undefined), null);
});

t("unidade em branco de um dos lados é dúvida, não divergência", () => {
  eq(api.divergenciaDeUnidade("", AREIA), null);
  eq(api.divergenciaDeUnidade("Mts", { codigo: "X" }), null);
});

t("a unidade do ÚLTIMO preço manda sobre a do cadastro", () => {
  // trocar a unidade do cadastro não pode acusar todas as compras antigas
  const comPreco = { codigo: "X", unidade: "Rolos", precoUnidade: "Mts" };
  eq(api.divergenciaDeUnidade("Mts", comPreco), null);
  eq(api.divergenciaDeUnidade("Rolos", comPreco).doCatalogo, "Mts");
});

t("abreviação da loja casa com a palavra do catálogo", () => {
  eq(api.divergenciaDeUnidade("un", { codigo: "X", unidade: "Unidades" }), null);
  eq(api.divergenciaDeUnidade("KG", { codigo: "X", unidade: "Kg" }), null);
  eq(api.divergenciaDeUnidade("QUILO", { codigo: "X", unidade: "Kg" }), null);
});


// ── O estorno: o que deixou de ser pago ─────────────────────────

t("desfazer a baixa devolve a conta para o estorno", () => {
  const r = api.contasQueDeixaramDeSerPagas(
    [{ id: "1", pago: true }, { id: "2", pago: true }],
    [{ id: "1", pago: false }, { id: "2", pago: true }]);
  eq(r.map((c) => c.id).join(","), "1");
});

t("conta apagada também deixou de ser paga", () => {
  const r = api.contasQueDeixaramDeSerPagas([{ id: "1", pago: true }], []);
  eq(r.length, 1, "sumiu da obra — o dinheiro dela tem que voltar do extrato");
});

t("relançar troca o id: a antiga conta como estorno e a nova como baixa", () => {
  const antes = [{ id: "velho", pago: true, valor: 260 }];
  const depois = [{ id: "novo", pago: true, valor: 260 }];
  eq(api.contasQueDeixaramDeSerPagas(antes, depois).map((c) => c.id).join(","), "velho");
  eq(api.contasRecemPagas(antes, depois).map((c) => c.id).join(","), "novo");
});

t("conta que continua paga não estorna nada", () => {
  eq(api.contasQueDeixaramDeSerPagas([{ id: "1", pago: true }], [{ id: "1", pago: true }]).length, 0);
});

t("conta que nunca foi paga não entra no estorno", () => {
  eq(api.contasQueDeixaramDeSerPagas([{ id: "1", pago: false }], []).length, 0);
});

t("listas vazias não explodem", () => {
  eq(api.contasQueDeixaramDeSerPagas(null, null).length, 0);
  eq(api.contasQueDeixaramDeSerPagas([], []).length, 0);
});


console.log("\n" + ok + " testes passaram" + (falhas.length ? ", " + falhas.length + " falharam" : ""));
if (falhas.length) {
  console.log("\nFALHAS:\n  - " + falhas.join("\n  - ") + "\n");
  process.exit(1);
}
