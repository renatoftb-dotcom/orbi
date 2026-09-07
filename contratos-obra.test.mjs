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
           TIPOS_PROFISSIONAL, tipoProfissional, prestadoresDoTipo, enderecoDaObra,
           MODALIDADES_PAGAMENTO, modalidadeContrato, entradaESaldo, prazoContrato,
           ESCOPOS_FORNECIMENTO, escopoContrato, escopoDoTipo, objetoPadrao, tituloServicoCtr,
           CONTRATO_OPCOES, opcaoAtiva, opcoesPadrao,
           textoMoedaCampo, textoPctCampo, textoInteiroCampo, digitandoNumero, dataExtensoCtr,
           mesclarPorCliente, contratosDasObras, contratosNasObras };
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
  assert.ok(t.includes("Todo o material necessário à execução dos serviços será fornecido pelo CONTRATANTE"));
  assert.ok(t.includes("7 (sete) meses"));
  assert.ok(t.includes("6 (seis) meses"), "garantia padrão do modelo de mão de obra");
  assert.ok(t.includes("45 (quarenta e cinco) dias corridos"), "tolerância antes da multa");
  assert.ok(t.includes("o lixamento do concreto"), "exclusões entram na cláusula do objeto");
  assert.strictEqual(d.anexo.length, 1);
  assert.strictEqual(d.anexo[0].titulo, "Preparação do contrapiso");
  // desmarcada a retenção, a cláusula some
  const semRetencao = modulo.montarContrato({ ...c, opcoes: { ...c.opcoes, retencao: false } }, { cliente, obra, prestador: serralheiro });
  assert.ok(!texto(semRetencao).includes("ficará retida"));
  // contrato antigo, sem o mapa de opções, ainda obedece ao campo retemUltima
  const { opcoes, ...antigo } = c;
  assert.ok(!texto(modulo.montarContrato({ ...antigo, retemUltima: false }, { cliente, obra, prestador: serralheiro })).includes("ficará retida"));
  assert.ok(texto(modulo.montarContrato({ ...antigo, retemUltima: true }, { cliente, obra, prestador: serralheiro })).includes("ficará retida"));
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

teste("obra marcada como 'endereço diferente' manda o seu próprio endereço para o contrato", () => {
  const obraPropria = { id: "o2", nome: "Chácara", enderecoProprio: true,
    logradouro: "Estrada do Limoeiro", numero: "km 4", bairro: "Zona Rural", cidade: "Jacarezinho", estado: "PR", cep: "86400-000" };
  assert.strictEqual(modulo.enderecoDaObra(obraPropria, cliente), "Estrada do Limoeiro, nº km 4, Zona Rural, Jacarezinho/PR, CEP 86400-000");
  const d = modulo.montarContrato(modulo.contratoVazio("empreitadaMaoDeObra", "c1", "o2", "empreiteiro"), { cliente, obra: obraPropria, prestador: serralheiro });
  assert.ok(texto(d).includes("Estrada do Limoeiro, nº km 4"));

  // marcada como "endereço do cliente": o que estiver gravado na obra é ignorado
  assert.strictEqual(modulo.enderecoDaObra({ ...obraPropria, enderecoProprio: false }, cliente),
    "Avenida Doutor Altino Arantes, nº 524, Centro, Ourinhos/SP, CEP 19.900-031");
  // obra sem endereço nenhum cai no cliente
  assert.ok(modulo.enderecoDaObra(obra, cliente).startsWith("Avenida Doutor Altino Arantes"));
  // obra antiga, sem a marcação, mantém o endereço que tiver
  const { enderecoProprio, ...antiga } = obraPropria;
  assert.ok(modulo.enderecoDaObra(antiga, cliente).startsWith("Estrada do Limoeiro"));
  // o campo digitado no gerador continua vencendo tudo
  const manual = modulo.montarContrato({ ...modulo.contratoVazio("empreitadaMaoDeObra", "c1", "o2"), enderecoObra: "Rua X, nº 10" }, { cliente, obra: obraPropria, prestador: serralheiro });
  assert.ok(texto(manual).includes("Rua X, nº 10"));
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
  // contrato novo nasce com os padrões do modelo, mas o prazo vem em branco
  const novo = modulo.contratoVazio("empreitadaGlobal", "c1", "o1");
  assert.strictEqual(novo.prazoQtd, "");
  assert.strictEqual(novo.prazoUnidade, "");
  assert.strictEqual(novo.modalidade, "entradaFinal");
  assert.strictEqual(novo.entradaPct, 50);
  assert.strictEqual(novo.garantiaMeses, 12);
  // o formulário é o mesmo para todo mundo: itens e anexo sempre disponíveis
  assert.strictEqual(novo.itens.length, 1);
  assert.strictEqual(novo.escopo.length, 1);
  const mo = modulo.contratoVazio("empreitadaMaoDeObra", "c1", "o1");
  assert.strictEqual(mo.modalidade, "parcelado");
  assert.strictEqual(mo.itens.length, 1);
  assert.strictEqual(mo.escopo.length, 1);
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
  // todo tipo (menos "Outro") nomeia o seu serviço, que é o que escreve o objeto
  for (const t of modulo.TIPOS_PROFISSIONAL) {
    if (t.id !== "outro") assert.ok(t.servico, `${t.id} sem nome de serviço`);
  }
});

teste("o objeto é o mesmo racional para todo prestador: tipo + o que inclui", () => {
  // o exemplo do escritório
  assert.strictEqual(modulo.objetoPadrao("serralheiro", "ambos"),
    "Fornecimento de serviços de serralheria incluindo mão de obra e fornecimento de material");
  assert.strictEqual(modulo.objetoPadrao("pintor", "maoDeObra"),
    "Fornecimento de serviços de pintura incluindo somente a mão de obra, sendo o material fornecido pelo CONTRATANTE");
  assert.strictEqual(modulo.objetoPadrao("marceneiro", "material"),
    "Fornecimento de serviços de marcenaria incluindo somente o fornecimento de material, sem mão de obra");
  assert.strictEqual(modulo.objetoPadrao("eletricista", "ambos"),
    "Fornecimento de serviços de instalações elétricas incluindo mão de obra e fornecimento de material");
  // "Outro" não tem serviço: o objeto fica em branco para ser escrito à mão
  assert.strictEqual(modulo.objetoPadrao("outro", "ambos"), "");

  // o contrato novo já nasce com esse texto e com o regime do escopo
  const c = modulo.contratoVazio(null, "c1", "o1", "serralheiro", "ambos");
  assert.strictEqual(c.escopoFornecimento, "ambos");
  assert.strictEqual(c.modelo, "empreitadaGlobal");
  assert.strictEqual(c.objeto, "Fornecimento de serviços de serralheria incluindo mão de obra e fornecimento de material");
  // somente mão de obra derruba o contrato para o regime de mão de obra
  assert.strictEqual(modulo.contratoVazio(null, "c1", "o1", "serralheiro", "maoDeObra").modelo, "empreitadaMaoDeObra");
  // sem escopo, o tipo escolhe o mais comum do ofício
  assert.strictEqual(modulo.escopoDoTipo("serralheiro"), "ambos");
  assert.strictEqual(modulo.escopoDoTipo("empreiteiro"), "maoDeObra");
  // contrato antigo, sem o campo, herda do modelo
  assert.strictEqual(modulo.escopoContrato({ modelo: "empreitadaGlobal" }), "ambos");
  assert.strictEqual(modulo.escopoContrato({ modelo: "empreitadaMaoDeObra" }), "maoDeObra");
});

teste("o preâmbulo e a cláusula do objeto saem genéricos, com o nome do serviço", () => {
  const doc = (tipoId, escopoId, extra) => modulo.montarContrato(
    { ...modulo.contratoVazio(null, "c1", "o1", tipoId, escopoId), ...(extra || {}) },
    { cliente, obra, prestador: serralheiro });
  const dS = doc("serralheiro", "ambos");
  assert.strictEqual(dS.nomeDoContrato, "Contrato de Prestação de Serviços de Serralheria");
  const tS = texto(dS);
  assert.ok(tS.includes("o presente Contrato de Prestação de Serviços de Serralheria"));
  assert.ok(tS.includes("dos serviços a seguir descritos: Fornecimento de serviços de serralheria incluindo mão de obra e fornecimento de material."));
  assert.ok(!tS.includes("Fornecimento e Montagem"), "o nome antigo era específico demais");
  assert.ok(!tS.includes("a fabricação, o transporte e a montagem"), "a cláusula 1.1 era específica de serralheria");
  // outro ofício, mesmo racional
  const tE = texto(doc("eletricista", "maoDeObra"));
  assert.ok(tE.includes("Contrato de Prestação de Serviços de Instalações Elétricas"));
  assert.ok(tE.includes("Fornecimento de serviços de instalações elétricas incluindo somente a mão de obra"));
  // regime acompanha o escopo
  assert.ok(texto(doc("marceneiro", "material")).includes("compreende exclusivamente o fornecimento do material especificado"));
  assert.ok(texto(doc("marceneiro", "ambos")).includes("compreendendo o fornecimento de todo o material"));
  assert.ok(texto(doc("pintor", "maoDeObra")).includes("Todo o material necessário à execução dos serviços será fornecido pelo CONTRATANTE"));
  // "Outro" cai no nome genérico e usa o objeto digitado
  const dO = doc("outro", "maoDeObra", { objeto: "Serviços de dedetização" });
  assert.strictEqual(dO.nomeDoContrato, "Contrato de Prestação de Serviços");
  assert.ok(texto(dO).includes("a seguir descritos: Serviços de dedetização."));
  assert.strictEqual(modulo.tituloServicoCtr("forro e revestimento em gesso"), "Forro e Revestimento em Gesso");
});

teste("a lista de prestadores mostra só os do tipo escolhido", () => {
  const lista = [
    { id: "p1", nome: "MB Viezzer", categoria: "Serralheiro" },
    { id: "p2", nome: "Elétrica Sol", categoria: "Eletricista" },
    { id: "p3", nome: "Alumínios SP", categoria: "Esquadria de Alumínio" },
    { id: "p4", nome: "Inativo", categoria: "Serralheiro", ativo: false },
  ];
  // serralheiro puxa também esquadria de alumínio, e ignora inativos
  assert.deepStrictEqual(modulo.prestadoresDoTipo(lista, "serralheiro").map((p) => p.id), ["p1", "p3"]);
  assert.ok(!modulo.prestadoresDoTipo(lista, "serralheiro").some((p) => p.categoria === "Eletricista"));
  assert.deepStrictEqual(modulo.prestadoresDoTipo(lista, "eletricista").map((p) => p.id), ["p2"]);
  // ninguém cadastrado naquela categoria: a lista sai vazia, não mistura ofícios
  assert.deepStrictEqual(modulo.prestadoresDoTipo(lista, "terraplanagem"), []);
  assert.deepStrictEqual(modulo.prestadoresDoTipo(lista, "encanador"), []);
  // "Outro" e ausência de tipo mostram todos
  assert.strictEqual(modulo.prestadoresDoTipo(lista, "outro").length, 3);
  assert.strictEqual(modulo.prestadoresDoTipo(lista, "").length, 3);
});

teste("modalidade parcelada aceita semanal, quinzenal e mensal", () => {
  const base = { ...modulo.contratoVazio("empreitadaMaoDeObra", "c1", "o1"), valor: 12000, modalidade: "parcelado", parcelas: 12 };
  const t = (per) => texto(modulo.montarContrato({ ...base, periodicidade: per }, { cliente, obra, prestador: serralheiro }));
  assert.ok(t("semanais").includes("12 (doze) parcelas semanais"));
  assert.ok(t("semanais").includes("a cada 7 (sete) dias"));
  assert.ok(t("quinzenais").includes("12 (doze) parcelas quinzenais"));
  assert.ok(t("quinzenais").includes("a cada 15 (quinze) dias"));
  assert.ok(t("mensais").includes("12 (doze) parcelas mensais"));
  assert.ok(t("mensais").includes("a cada 30 (trinta) dias"));
  assert.ok(t("mensais").includes("R$ 1.000,00"));
});

teste("modalidade por medição escreve a apuração periódica e o prazo de pagamento", () => {
  const c = { ...modulo.contratoVazio("empreitadaMaoDeObra", "c1", "o1"), valor: 50000,
    modalidade: "medicao", medicaoPeriodicidade: "quinzenal", medicaoPrazoDias: 10 };
  const t = texto(modulo.montarContrato(c, { cliente, obra, prestador: serralheiro }));
  assert.ok(t.includes("por medição quinzenal"));
  assert.ok(t.includes("percentual medido do valor total"));
  assert.ok(t.includes("em até 10 (dez) dias"));
  assert.ok(!t.includes("parcelas"), "medição não fala em parcelas");
});

teste("entrada + parcelas separa a entrada do saldo e fecha a conta", () => {
  const c = { ...modulo.contratoVazio("empreitadaMaoDeObra", "c1", "o1"), valor: 100000,
    modalidade: "entradaParcelas", entradaPct: 30, parcelas: 7, periodicidade: "mensais" };
  const e = modulo.entradaESaldo(100000, 30, 7);
  assert.strictEqual(e.entrada, 30000);
  assert.strictEqual(e.saldo, 70000);
  assert.ok(Math.abs(e.parcelas.base * 6 + e.parcelas.ultima - 70000) < 0.005);
  const t = texto(modulo.montarContrato(c, { cliente, obra, prestador: serralheiro }));
  assert.ok(t.includes("30% do valor total, correspondentes a R$ 30.000,00"));
  assert.ok(t.includes("saldo remanescente de R$ 70.000,00"));
  assert.ok(t.includes("7 (sete) parcelas mensais"));
});

teste("entrada + saldo no final: contrato todo ou item a item", () => {
  const itens = [{ descricao: "Portão", valor: 60000 }, { descricao: "Guarda-corpo", valor: 40000 }];
  const base = { ...modulo.contratoVazio("empreitadaGlobal", "c1", "o1"), itens, modalidade: "entradaFinal", entradaPct: 40 };
  // item a item monta o quadro de parcelas
  const porItem = modulo.montarContrato({ ...base, entradaEscopo: "item" }, { cliente, obra, prestador: serralheiro });
  assert.strictEqual(porItem.tabelaParcelas.length, 2);
  assert.strictEqual(porItem.tabelaParcelas[0].p1, 24000);
  assert.ok(texto(porItem).includes("item a item, na proporção de 40%"));
  // contrato todo: entrada única e saldo no aceite final, sem quadro
  const todo = modulo.montarContrato({ ...base, entradaEscopo: "contrato" }, { cliente, obra, prestador: serralheiro });
  assert.strictEqual(todo.tabelaParcelas.length, 0);
  const t = texto(todo);
  assert.ok(t.includes("40% do valor total, correspondentes a R$ 40.000,00"));
  assert.ok(t.includes("saldo de R$ 60.000,00"));
  assert.ok(t.includes("mediante o aceite final"));
});

teste("prazo não vem preenchido e aceita dias ou meses", () => {
  const c = modulo.contratoVazio("empreitadaGlobal", "c1", "o1");
  assert.deepStrictEqual(modulo.prazoContrato(c), { qtd: "", unidade: "" });
  // em branco, o contrato sai com a lacuna para preencher à mão
  assert.ok(texto(modulo.montarContrato(c, { cliente, obra, prestador: serralheiro })).includes("é de ______ dias ou meses"));
  assert.ok(texto(modulo.montarContrato({ ...c, prazoQtd: 90, prazoUnidade: "dias" }, { cliente, obra, prestador: serralheiro })).includes("90 (noventa) dias corridos"));
  assert.ok(texto(modulo.montarContrato({ ...c, prazoQtd: 9, prazoUnidade: "meses" }, { cliente, obra, prestador: serralheiro })).includes("9 (nove) meses"));
  // contrato antigo mantém o que tinha
  assert.deepStrictEqual(modulo.prazoContrato({ prazoDias: 120 }), { qtd: 120, unidade: "dias" });
  assert.deepStrictEqual(modulo.prazoContrato({ prazoMeses: 6 }), { qtd: 6, unidade: "meses" });
});

teste("cláusulas opcionais entram e saem sem quebrar a numeração", () => {
  const c = { ...modulo.contratoVazio("empreitadaMaoDeObra", "c1", "o1"), valor: 10000, parcelas: 4 };
  const tudoNao = {};
  for (const op of modulo.CONTRATO_OPCOES) tudoNao[op.id] = false;
  const magro = modulo.montarContrato({ ...c, opcoes: tudoNao }, { cliente, obra, prestador: serralheiro });
  const gordo = modulo.montarContrato({ ...c, opcoes: Object.fromEntries(modulo.CONTRATO_OPCOES.map(o => [o.id, true])), retencaoPct: "" }, { cliente, obra, prestador: serralheiro });
  // a garantia é a única opção que tira uma cláusula inteira
  assert.ok(!magro.clausulas.some(x => x.id === "garantia"));
  assert.ok(gordo.clausulas.some(x => x.id === "garantia"));
  // a numeração é sempre contínua e bate com a posição da cláusula
  for (const d of [magro, gordo]) {
    d.clausulas.forEach((x, i) => {
      x.itens.forEach((it, j) => assert.ok(it.startsWith(`${i + 1}.${j + 1}. `), `numeração fora de ordem: ${it.slice(0, 12)}`));
    });
    assert.ok(!texto(d).includes("{{"), "sobrou marcador de referência sem resolver");
  }
  // a referência cruzada acompanha a cláusula que sobrou
  const iPag = magro.clausulas.findIndex(x => x.id === "pagamento");
  assert.ok(texto(magro).includes(`ajustados na Cláusula ${["Primeira","Segunda","Terceira","Quarta","Quinta"][iPag]}`));
  // conteúdo que só existe quando a opção está ligada
  const tg = texto(gordo), tm = texto(magro);
  assert.ok(tg.includes("Anotação de Responsabilidade Técnica") && !tm.includes("Anotação de Responsabilidade Técnica"));
  assert.ok(tg.includes("seguro de responsabilidade civil") && !tm.includes("seguro de responsabilidade civil"));
  assert.ok(tg.includes("multa de 0,5%") && !tm.includes("por dia de atraso"));
  assert.ok(tg.includes("nota fiscal") && !tm.includes("nota fiscal"));
  assert.ok(tm.includes("Os equipamentos de maior porte serão fornecidos pelo CONTRATANTE"));
});

teste("máscaras formatam o que a pessoa digita e o backspace apaga dígito", () => {
  assert.strictEqual(modulo.textoMoedaCampo(9142.86), "9.142,86");
  assert.strictEqual(modulo.textoMoedaCampo(""), "");
  assert.strictEqual(modulo.textoPctCampo(0.5), "0,50%");
  assert.strictEqual(modulo.textoInteiroCampo(12), "12");
  // dígitos entram pela direita, como no aplicativo do banco
  assert.strictEqual(modulo.digitandoNumero("", "9", 2), 0.09);
  assert.strictEqual(modulo.digitandoNumero("0,09", "0,099", 2), 0.99);
  assert.strictEqual(modulo.digitandoNumero("99,00", "9.900", 0), 9900);
  // apagar o "%" ou a vírgula apaga um dígito de verdade
  assert.strictEqual(modulo.digitandoNumero("0,50%", "0,50", 2), 0.05);
  assert.strictEqual(modulo.digitandoNumero("0,09", "0,0", 2), 0);
});

teste("a tabela é ancorada no item que a anuncia, não no fim da cláusula", () => {
  const c = { ...modulo.contratoVazio("empreitadaGlobal", "c1", "o1", "serralheiro"), entradaPct: 50,
    exclusoes: "a revisão da estrutura existente",
    itens: [{ descricao: "Cobertura", valor: 60000 }, { descricao: "Vitrine", valor: 40000 }] };
  const d = modulo.montarContrato(c, { cliente, obra, prestador: serralheiro });
  const objeto = d.clausulas.find(x => x.id === "objeto");
  // 1.3 anuncia a tabela, 1.4 são as exclusões — a tabela fica entre as duas
  assert.strictEqual(objeto.tabelaItensApos, 2);
  assert.ok(objeto.itens[2].startsWith("1.3. Compõem o objeto"));
  assert.ok(objeto.itens[3].startsWith("1.4. Não integram"));
  // o quadro de parcelas segue o item que o anuncia
  const pg = d.clausulas.find(x => x.id === "pagamento");
  assert.ok(pg.itens[pg.tabelaParcelasApos].includes("conforme o quadro abaixo"));
  // sem exclusões, a âncora continua sendo o último item
  const semExcl = modulo.montarContrato({ ...c, exclusoes: "" }, { cliente, obra, prestador: serralheiro });
  assert.strictEqual(semExcl.clausulas.find(x => x.id === "objeto").tabelaItensApos, 2);
});

teste("data de assinatura vem do dia e sai por extenso no fecho", () => {
  const hoje = new Date().toISOString().slice(0, 10);
  assert.strictEqual(modulo.contratoVazio("empreitadaMaoDeObra", "c1", "o1").dataAssinatura, hoje);
  assert.strictEqual(modulo.dataExtensoCtr("2026-09-07"), "7 de setembro de 2026");
  assert.strictEqual(modulo.dataExtensoCtr("2026-01-31"), "31 de janeiro de 2026");
  assert.strictEqual(modulo.dataExtensoCtr(""), "");
  const d = modulo.montarContrato({ ...modulo.contratoVazio("empreitadaMaoDeObra", "c1", "o1"), dataAssinatura: "2026-03-05" }, { cliente, obra, prestador: serralheiro });
  assert.strictEqual(d.dataAssinaturaExtenso, "5 de março de 2026");
  // sem data, o contrato sai com a lacuna para preencher à mão
  assert.strictEqual(modulo.montarContrato({ ...modulo.contratoVazio("empreitadaMaoDeObra", "c1", "o1"), dataAssinatura: "" }, { cliente, obra, prestador: serralheiro }).dataAssinaturaExtenso, "");
});

teste("'Especificar' entra na cláusula do regime, e sem ele o texto padrão continua", () => {
  const base = { ...modulo.contratoVazio("empreitadaMaoDeObra", "c1", "o1", "empreiteiro"), valor: 1000 };
  const t = (extra) => texto(modulo.montarContrato({ ...base, ...extra }, { cliente, obra, prestador: serralheiro }));
  // ferramentas básicas, especificadas
  assert.ok(t({ ferramentasDetalhe: "colher, desempenadeira, prumo e nível" })
    .includes("Consideram-se ferramentas básicas, para os fins deste contrato, entre outras: colher, desempenadeira, prumo e nível."));
  // todas as ferramentas muda a abertura da frase
  assert.ok(t({ ferramentasEscopo: "todas", ferramentasDetalhe: "betoneira e serra circular" })
    .includes("Compreendem-se, entre outras: betoneira e serra circular."));
  // ponto final duplicado não passa
  assert.ok(!t({ ferramentasDetalhe: "colher e prumo." }).includes("prumo.."));
  // em branco, o texto padrão fica intacto
  const semDetalhe = t({});
  assert.ok(semDetalhe.includes("As ferramentas básicas necessárias à execução dos serviços serão fornecidas pelo CONTRATADO, por sua conta."));
  assert.ok(!semDetalhe.includes("Consideram-se ferramentas básicas"));
  // equipamentos: o detalhe substitui a lista de exemplo
  const eq = { opcoes: { ...base.opcoes, equipamentos: true }, equipamentosDetalhe: "andaimes e balancim" };
  assert.ok(t(eq).includes("todos os demais equipamentos necessários à execução dos serviços, tais como andaimes e balancim."));
  assert.ok(t({ opcoes: eq.opcoes }).includes("tais como andaimes, meios de içamento e acesso"));
  // a opção desmarcada ignora o que foi especificado
  assert.ok(!t({ opcoes: { ...base.opcoes, ferramentas: false }, ferramentasDetalhe: "colher e prumo" }).includes("colher e prumo"));
});

teste("exclusões não repetem a abertura quando a frase já vem pronta", () => {
  const base = modulo.contratoVazio("empreitadaGlobal", "c1", "o1", "serralheiro");
  const cl1 = (ex) => modulo.montarContrato({ ...base, exclusoes: ex }, { cliente, obra, prestador: serralheiro })
    .clausulas.find(x => x.id === "objeto").itens.slice(-1)[0];
  // lista em minúscula: o contrato põe a abertura
  assert.strictEqual(cl1("o lixamento do concreto e a montagem da piscina"),
    "1.3. Não integram o objeto deste contrato: o lixamento do concreto e a montagem da piscina.");
  // frase já escrita: entra como está, sem a abertura duplicada
  const pronta = cl1("Não integra o objeto deste contrato a revisão da estrutura existente. Não inclui o fornecimento de lápis.");
  assert.strictEqual(pronta, "1.3. Não integra o objeto deste contrato a revisão da estrutura existente. Não inclui o fornecimento de lápis.");
  assert.ok(!/Não integram o objeto deste contrato: Não integra/.test(pronta));
  // ponto final é garantido uma vez só
  assert.ok(cl1("o lixamento do concreto.").endsWith("o lixamento do concreto."));
  assert.ok(!cl1("o lixamento do concreto.").endsWith(".."));
  // espaço em branco não vira cláusula
  assert.strictEqual(modulo.montarContrato({ ...base, exclusoes: "   " }, { cliente, obra, prestador: serralheiro })
    .clausulas.find(x => x.id === "objeto").itens.length, 2);
});

teste("salvar a fatia de um cliente não apaga os registros dos outros", () => {
  const todos = [
    { id: "k1", clienteId: "c1", nome: "Contrato A" },
    { id: "k2", clienteId: "c2", nome: "Contrato de outro cliente" },
    { id: "k3", clienteId: "c1", nome: "Contrato B" },
    { id: "k4", clienteId: "c3", nome: "Contrato de um terceiro" },
  ];
  const fatiaC1 = todos.filter(x => x.clienteId === "c1");
  // editar um contrato do c1
  const editado = modulo.mesclarPorCliente(todos, "c1", fatiaC1.map(x => x.id === "k1" ? { ...x, nome: "Contrato A (v2)" } : x));
  assert.strictEqual(editado.length, 4);
  assert.ok(editado.find(x => x.id === "k2"), "o contrato do c2 tem de continuar lá");
  assert.ok(editado.find(x => x.id === "k4"), "o contrato do c3 tem de continuar lá");
  assert.strictEqual(editado.find(x => x.id === "k1").nome, "Contrato A (v2)");
  // acrescentar um contrato novo
  assert.strictEqual(modulo.mesclarPorCliente(todos, "c1", [...fatiaC1, { id: "k5", clienteId: "c1" }]).length, 5);
  // remover um contrato do c1
  const removido = modulo.mesclarPorCliente(todos, "c1", fatiaC1.filter(x => x.id !== "k1"));
  assert.strictEqual(removido.length, 3);
  assert.ok(!removido.find(x => x.id === "k1"));
  assert.ok(removido.find(x => x.id === "k2") && removido.find(x => x.id === "k4"));
  // coleção vazia ou ausente não quebra
  assert.deepStrictEqual(modulo.mesclarPorCliente(null, "c1", [{ id: "k9", clienteId: "c1" }]), [{ id: "k9", clienteId: "c1" }]);
  assert.deepStrictEqual(modulo.mesclarPorCliente(todos, "c9", []).length, 4);
});

teste("o representante legal do cliente sai no preâmbulo e na assinatura", () => {
  const d = modulo.montarContrato(modulo.contratoVazio(null, "c1", "o1", "serralheiro", "ambos"), { cliente, obra, prestador: serralheiro });
  assert.ok(texto(d).includes("neste ato representada por ALEXANDRE MARTINS RIBEIRO, inscrito no CPF sob o nº 354.518.208-80"));
  assert.strictEqual(d.assinaturas[0].representante, "Alexandre Martins Ribeiro");
  assert.strictEqual(d.assinaturas[0].cpf, "354.518.208-80");
  // sem representante cadastrado, a assinatura sai só com o nome da parte —
  // um contato qualquer da agenda não entra no lugar dele
  const { representanteNome, representanteCpf, ...semRep } = cliente;
  const d2 = modulo.montarContrato(modulo.contratoVazio(null, "c1", "o1", "serralheiro", "ambos"),
    { cliente: { ...semRep, contatos: [{ nome: "Recepção" }] }, obra, prestador: serralheiro });
  assert.strictEqual(d2.assinaturas[0].representante, "");
  assert.ok(!texto(d2).includes("Recepção"));
  const linhaContratante = d2.preambulo.find(l => l.startsWith("CONTRATANTE:"));
  assert.ok(!linhaContratante.includes("neste ato representada por"), "sem representante, o preâmbulo do contratante não inventa um");
});

teste("o contrato mora dentro da obra, que é o que o backend grava", () => {
  const obras = [
    { id: "o1", clienteId: "c1", nome: "Casa", estimativaPL: [{ id: "e1" }], contratos: [{ id: "k1", obraId: "o1", nomeContratado: "Serralheiro" }] },
    { id: "o2", clienteId: "c1", nome: "Piscina", contratos: [] },
  ];
  // leitura: os contratos das obras do cliente, com obraId e clienteId
  const lidos = modulo.contratosDasObras(obras, "c1");
  assert.strictEqual(lidos.length, 1);
  assert.deepStrictEqual({ id: lidos[0].id, obraId: lidos[0].obraId, clienteId: lidos[0].clienteId }, { id: "k1", obraId: "o1", clienteId: "c1" });

  // escrita: um contrato novo na obra 2 não mexe no da obra 1 nem no resto da obra
  const gravadas = modulo.contratosNasObras(obras, [...lidos, { id: "k2", obraId: "o2" }], "c1", "o2");
  assert.strictEqual(gravadas[0].contratos.length, 1);
  assert.strictEqual(gravadas[1].contratos.length, 1);
  assert.strictEqual(gravadas[1].contratos[0].id, "k2");
  assert.strictEqual(gravadas[1].contratos[0].clienteId, "c1");
  assert.deepStrictEqual(gravadas[0].estimativaPL, [{ id: "e1" }], "a estimativa da obra tem de sobreviver");
  assert.strictEqual(gravadas[0].nome, "Casa");

  // contrato sem obraId cai na obra aberta
  assert.strictEqual(modulo.contratosNasObras(obras, [{ id: "k3" }], "c1", "o2")[1].contratos[0].id, "k3");
  // remover: a obra fica com a lista vazia, não com a antiga
  assert.deepStrictEqual(modulo.contratosNasObras(obras, [], "c1", "o1")[0].contratos, []);
  // e o ciclo fecha: gravar e ler de volta dá a mesma coisa
  const ida = modulo.contratosNasObras(obras, [...lidos, { id: "k2", obraId: "o2" }], "c1", "o2");
  assert.deepStrictEqual(modulo.contratosDasObras(ida, "c1").map(c => c.id).sort(), ["k1", "k2"]);
});

console.log(`\n${passou} passou, ${falhou} falhou`);
if (falhou) process.exit(1);
