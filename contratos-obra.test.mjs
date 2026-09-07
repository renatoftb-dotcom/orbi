// Testes do gerador de contratos (node, sem framework).
// Roda com: node contratos-obra.test.mjs
// Corta o módulo antes da UI e exercita só a montagem do documento.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, "src", "modules", "contratos-obra.jsx"), "utf-8");
const corte = src.indexOf("// UI — documento e gerador");
if (corte < 0) throw new Error("Marcador de início da UI não encontrado em contratos-obra.jsx");

const modulo = new Function(`
  var uid = () => "id1";
  ${src.slice(0, corte)}
  return { CONTRATO_MODELOS, contratoModelo, contratoVazio, valorContrato, parcelasContrato,
           porExtensoCtr, moedaExtensoCtr, qualificarParte, montarContrato, fmtMoedaCtr,
           TIPOS_PROFISSIONAL, tipoProfissional, prestadoresDoTipo };
`)();

let passou = 0, falhou = 0;
function teste(nome, fn) {
  try { fn(); passou++; console.log(`  ok  ${nome}`); }
  catch (e) { falhou++; console.log(`FALHOU  ${nome}`); console.log(`        ${e.message}`); }
}

const cliente = {
  id: "c1", tipo: "PJ", nome: "COBOP Comércio de Bombas e Piscinas Ltda", cpfCnpj: "44.945.459/0001-33",
  logradouro: "Avenida Doutor Altino Arantes", numero: "524", bairro: "Centro", cidade: "Ourinhos", estado: "SP", cep: "19.900-031",
  representanteNome: "Alexandre Martins Ribeiro", representanteCpf: "354.518.208-80",
};
const serralheiro = {
  id: "p1", tipo: "PJ", nome: "MB Viezzer Montagens Industriais", cnpjCpf: "04.113.680/0001-00",
  logradouro: "Rua Francisco Nunes de Melo", numero: "135", bairro: "Vila São Francisco", cidade: "Ourinhos", estado: "SP", cep: "19.905-155",
  representanteNome: "Marcio Brugalli Viezzer", representanteCpf: "997.352.450-00", categoria: "Serralheiro",
};
const obra = { id: "o1", nome: "Loja COBOP" };
const texto = (d) => [
  ...d.preambulo,
  ...d.clausulas.flatMap((c) => [c.titulo, ...c.itens]),
  ...d.anexo.map((a) => `${a.titulo} ${a.texto}`),
].join("\n");

teste("número por extenso segue a regra do 'e' antes da última parcela", () => {
  assert.strictEqual(modulo.porExtensoCtr(9142), "nove mil, cento e quarenta e dois");
  assert.strictEqual(modulo.porExtensoCtr(9040), "nove mil e quarenta");
  assert.strictEqual(modulo.porExtensoCtr(9100), "nove mil e cem");
  assert.strictEqual(modulo.porExtensoCtr(128000), "cento e vinte e oito mil");
  assert.strictEqual(modulo.porExtensoCtr(99000), "noventa e nove mil");
  assert.strictEqual(modulo.porExtensoCtr(1000000), "um milhão");
  assert.strictEqual(modulo.moedaExtensoCtr(9142.86), "nove mil, cento e quarenta e dois reais e oitenta e seis centavos");
  assert.strictEqual(modulo.moedaExtensoCtr(1), "um real");
});

teste("parcelas: arredonda ao centavo e ajusta a última (128.000 em 14 = 13 × 9.142,86 + 9.142,82)", () => {
  const p = modulo.parcelasContrato(128000, 14);
  assert.strictEqual(p.base, 9142.86);
  assert.strictEqual(p.ultima, 9142.82);
  assert.strictEqual(p.iguais, false);
  assert.ok(Math.abs(p.base * 13 + p.ultima - 128000) < 0.005, "a soma das parcelas tem de fechar o total");
  const exato = modulo.parcelasContrato(12000, 12);
  assert.strictEqual(exato.base, 1000);
  assert.strictEqual(exato.iguais, true);
});

teste("qualificação da parte monta o preâmbulo com CNPJ, endereço e representante", () => {
  const q = modulo.qualificarParte({ ...serralheiro, tipo: "PJ" });
  assert.ok(q.startsWith("MB VIEZZER MONTAGENS INDUSTRIAIS, pessoa jurídica de direito privado"));
  assert.ok(q.includes("inscrita no CNPJ sob o nº 04.113.680/0001-00"));
  assert.ok(q.includes("Rua Francisco Nunes de Melo, nº 135, Vila São Francisco, Ourinhos/SP, CEP 19.905-155"));
  assert.ok(q.includes("neste ato representada por MARCIO BRUGALLI VIEZZER, inscrito no CPF sob o nº 997.352.450-00"));
  // pessoa física: CPF, "residente e domiciliado", sem representante
  const pf = modulo.qualificarParte({ tipo: "PF", nome: "João da Silva", cnpjCpf: "111.222.333-44", logradouro: "Rua A", numero: "10", cidade: "Ourinhos", estado: "SP", representanteNome: "Alguém" });
  assert.ok(pf.includes("pessoa física, inscrito no CPF sob o nº 111.222.333-44"), pf);
  assert.ok(pf.includes("residente e domiciliado na Rua A, nº 10, Ourinhos/SP"), pf);
  assert.ok(!pf.includes("representada por"), pf);
});

teste("empreitada global: total pela soma dos itens, tabela de itens e pagamento 50/50 por item", () => {
  const c = {
    ...modulo.contratoVazio("empreitadaGlobal", "c1", "o1"), prestadorId: "p1", prazoDias: 120, entradaPct: 50,
    objeto: "Fornecimento e montagem de estruturas metálicas e coberturas",
    itens: [
      { descricao: "Continuidade da cobertura do espaço novo", valor: 16158.55 },
      { descricao: "Revestimento das paredes em telhas brancas RT 10", valor: 31336.05 },
      { descricao: "Vitrine frontal, parte mais baixa", valor: 28133.20 },
      { descricao: "Estrutura metálica da marquise da entrada", valor: 9089.19 },
      { descricao: "Revestimento em ACM preto nas vitrines", valor: 14283.01 },
    ],
  };
  assert.strictEqual(modulo.valorContrato(c), 99000);
  const d = modulo.montarContrato(c, { cliente, obra, prestador: serralheiro });
  assert.strictEqual(d.total, 99000);
  assert.strictEqual(d.tabelaItens.length, 5);
  assert.strictEqual(d.tabelaItens[0].valor, 16158.55);
  // 50/50 por item, com a soma das duas parcelas fechando o item
  const p = d.tabelaParcelas.find((x) => x.n === 1);
  assert.strictEqual(p.p1, 8079.27);
  assert.strictEqual(Math.round((p.p1 + p.p2) * 100) / 100, 16158.55);
  assert.strictEqual(Math.round(d.tabelaParcelas.reduce((a, x) => a + x.p1 + x.p2, 0) * 100) / 100, 99000);

  const t = texto(d);
  assert.ok(t.includes("CONTRATADA: MB VIEZZER MONTAGENS INDUSTRIAIS"));
  assert.ok(t.includes("CONTRATANTE: COBOP COMÉRCIO DE BOMBAS E PISCINAS LTDA"));
  assert.ok(t.includes("R$ 99.000,00 (noventa e nove mil reais)"));
  assert.ok(t.includes("120 (cento e vinte) dias corridos"));
  assert.ok(t.includes("empreitada global"), "o regime tem de ser o global");
  assert.ok(t.includes("12 (doze) meses"), "garantia padrão do modelo global");
  assert.ok(t.includes("à CONTRATADA"), "objeto indireto com crase");
  assert.ok(!t.includes("ANEXO I"), "o modelo global não usa anexo descritivo");
  assert.strictEqual(d.anexo.length, 0);
});

teste("empreitada de mão de obra: material do contratante, parcelas quinzenais, retenção e ANEXO I", () => {
  const c = {
    ...modulo.contratoVazio("empreitadaMaoDeObra", "c1", "o1"), prestadorId: "p1",
    valor: 128000, parcelas: 14, prazoMeses: 7, retemUltima: true,
    objeto: "Empreitada de mão de obra — obra civil",
    exclusoes: "o lixamento do concreto e a montagem hidráulica da piscina",
    escopo: [{ titulo: "Preparação do contrapiso", texto: "Execução de toda a base do piso.\nRegularização do nível e da brita." }],
  };
  const d = modulo.montarContrato(c, { cliente, obra, prestador: serralheiro });
  assert.strictEqual(d.total, 128000);
  const t = texto(d);
  assert.ok(t.includes("ao CONTRATADO o valor total de R$ 128.000,00 (cento e vinte e oito mil reais)"));
  assert.ok(t.includes("13 (treze) parcelas no valor de R$ 9.142,86"));
  assert.ok(t.includes("R$ 9.142,82"));
  assert.ok(t.includes("A última parcela ficará retida"));
  assert.ok(t.includes("Todo o material de construção necessário à execução dos serviços será fornecido pelo CONTRATANTE"));
  assert.ok(t.includes("7 (sete) meses"));
  assert.ok(t.includes("6 (seis) meses"), "garantia padrão do modelo de mão de obra");
  assert.ok(t.includes("45 (quarenta e cinco) dias corridos"), "tolerância antes da multa");
  assert.ok(t.includes("o lixamento do concreto"), "exclusões entram na cláusula do objeto");
  assert.strictEqual(d.anexo.length, 1);
  assert.strictEqual(d.anexo[0].titulo, "Preparação do contrapiso");
  // sem retenção, a cláusula some
  const semRetencao = modulo.montarContrato({ ...c, retemUltima: false }, { cliente, obra, prestador: serralheiro });
  assert.ok(!texto(semRetencao).includes("ficará retida"));
});

teste("endereço da obra, foro e cidade caem no cadastro do cliente quando não informados", () => {
  const d = modulo.montarContrato(modulo.contratoVazio("empreitadaMaoDeObra", "c1", "o1"), { cliente, obra, prestador: serralheiro });
  const t = texto(d);
  assert.ok(t.includes("Avenida Doutor Altino Arantes, nº 524, Centro, Ourinhos/SP"));
  assert.ok(t.includes("foro da Comarca de Ourinhos"));
  assert.strictEqual(d.cidadeAssinatura, "Ourinhos/SP");
  // endereço próprio da obra vence o do cliente
  const outro = modulo.montarContrato({ ...modulo.contratoVazio("empreitadaMaoDeObra", "c1", "o1"), enderecoObra: "Rua X, nº 10, Jacarezinho/PR" }, { cliente, obra, prestador: serralheiro });
  assert.ok(texto(outro).includes("Rua X, nº 10, Jacarezinho/PR"));
});

teste("sem prestador escolhido o contrato sai com o nome digitado e sem qualificação", () => {
  const d = modulo.montarContrato({ ...modulo.contratoVazio("empreitadaMaoDeObra", "c1", "o1"), nomeContratado: "Fulano Empreiteira" }, { cliente, obra, prestador: null });
  const t = texto(d);
  assert.ok(t.includes("CONTRATADO: FULANO EMPREITEIRA"));
  assert.ok(!t.includes("inscrita no CNPJ sob o nº ,"));
  assert.strictEqual(d.assinaturas[1].nome, "Fulano Empreiteira");
});

teste("dois modelos disponíveis, cada um com o seu padrão", () => {
  assert.deepStrictEqual(modulo.CONTRATO_MODELOS.map((m) => m.id), ["empreitadaMaoDeObra", "empreitadaGlobal"]);
  assert.strictEqual(modulo.contratoModelo("empreitadaGlobal").padrao.garantiaMeses, 12);
  assert.strictEqual(modulo.contratoModelo("empreitadaMaoDeObra").padrao.garantiaMeses, 6);
  assert.strictEqual(modulo.contratoModelo("inexistente").id, "empreitadaMaoDeObra"); // fallback
  // contrato novo já nasce com os padrões do modelo
  const novo = modulo.contratoVazio("empreitadaGlobal", "c1", "o1");
  assert.strictEqual(novo.prazoDias, 120);
  assert.strictEqual(novo.entradaPct, 50);
  assert.strictEqual(novo.itens.length, 1);
  assert.strictEqual(novo.escopo.length, 0);
});

teste("tipos de profissional cobrem os prestadores do catálogo e sugerem regime e objeto", () => {
  const nomes = modulo.TIPOS_PROFISSIONAL.map((t) => t.nome);
  for (const n of ["Empreiteiro", "Eletricista", "Serralheiro", "Pintor", "Carpinteiro", "Encanador",
                   "Impermeabilizador", "Instalador de ar condicionado", "Marceneiro", "Terraplanagem"]) {
    assert.ok(nomes.includes(n), `falta o tipo ${n}`);
  }
  // a lista sai em ordem alfabética, com "Outro" fechando
  const semOutro = nomes.slice(0, -1);
  assert.strictEqual(nomes[nomes.length - 1], "Outro");
  assert.deepStrictEqual(semOutro, [...semOutro].sort((a, b) => a.localeCompare(b, "pt-BR")));
  // ids únicos e todo tipo aponta para um modelo que existe
  assert.strictEqual(new Set(modulo.TIPOS_PROFISSIONAL.map((t) => t.id)).size, modulo.TIPOS_PROFISSIONAL.length);
  for (const t of modulo.TIPOS_PROFISSIONAL) {
    assert.ok(modulo.CONTRATO_MODELOS.some((m) => m.id === t.modelo), `${t.id} aponta para modelo inexistente`);
  }
  // mão de obra para quem só põe mão de obra; global para quem fornece
  assert.strictEqual(modulo.tipoProfissional("empreiteiro").modelo, "empreitadaMaoDeObra");
  assert.strictEqual(modulo.tipoProfissional("serralheiro").modelo, "empreitadaGlobal");
  assert.strictEqual(modulo.tipoProfissional("marceneiro").modelo, "empreitadaGlobal");
  assert.strictEqual(modulo.tipoProfissional("inexistente"), null);
});

teste("o tipo escolhido já preenche o objeto e o regime do contrato novo", () => {
  const c = modulo.contratoVazio("empreitadaGlobal", "c1", "o1", "serralheiro");
  assert.strictEqual(c.tipoProfissional, "serralheiro");
  assert.strictEqual(c.objeto, "Fornecimento e montagem de estruturas e esquadrias metálicas");
  const d = modulo.montarContrato({ ...c, itens: [{ descricao: "Portão", valor: 1000 }] }, { cliente, obra, prestador: serralheiro });
  assert.strictEqual(d.total, 1000);
  // sem tipo, nada é sugerido (compatível com os contratos já gravados)
  const semTipo = modulo.contratoVazio("empreitadaMaoDeObra", "c1", "o1");
  assert.strictEqual(semTipo.tipoProfissional, "");
  assert.strictEqual(semTipo.objeto, "");
});

teste("a lista de prestadores é filtrada pela categoria do tipo, com queda para todos", () => {
  const lista = [
    { id: "p1", nome: "MB Viezzer", categoria: "Serralheiro" },
    { id: "p2", nome: "Elétrica Sol", categoria: "Eletricista" },
    { id: "p3", nome: "Alumínios SP", categoria: "Esquadria de Alumínio" },
    { id: "p4", nome: "Inativo", categoria: "Serralheiro", ativo: false },
  ];
  // serralheiro puxa também esquadria de alumínio, e ignora inativos
  assert.deepStrictEqual(modulo.prestadoresDoTipo(lista, "serralheiro").map((p) => p.id), ["p1", "p3"]);
  assert.deepStrictEqual(modulo.prestadoresDoTipo(lista, "eletricista").map((p) => p.id), ["p2"]);
  // ninguém cadastrado naquela categoria: mostra todos em vez de um select vazio
  assert.strictEqual(modulo.prestadoresDoTipo(lista, "terraplanagem").length, 3);
  // "Outro" e ausência de tipo mostram todos
  assert.strictEqual(modulo.prestadoresDoTipo(lista, "outro").length, 3);
  assert.strictEqual(modulo.prestadoresDoTipo(lista, "").length, 3);
});

console.log(`\n${passou} passou, ${falhou} falhou`);
if (falhou) process.exit(1);
