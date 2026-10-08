// Testes do módulo financeiro do ESCRITÓRIO — node puro, sem framework.
//   node escritorio-financeiro.test.mjs
//
// O módulo é só taxonomia, regra e cálculo: JavaScript comum, sem JSX.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const raiz = dirname(fileURLToPath(import.meta.url));
const arquivo = readFileSync(join(raiz, "src", "modules", "escritorio-financeiro.jsx"), "utf8");
const corte = arquivo.indexOf("// UI — daqui para baixo");
if (corte < 0) throw new Error("Marcador de início da UI não encontrado em escritorio-financeiro.jsx");
const src = arquivo.slice(0, corte);
const M = new Function(src + `
  return { UNIDADES_NEGOCIO, GRUPOS_ESCRITORIO, PLANO_CONTAS_ESCRITORIO, contaEscritorio, grupoEscritorio,
           contaPeloApelido, unidadePeloApelido, validarLancamentoEscritorio, mesesEntreEscritorio,
           extratoEscritorio, resultadoEmpreendimento, interpretarColagemEscritorio, lancamentoDaColagem,
           efNumero, efCompetencia, lancamentosDoEscritorio,
           efAbasDaPlanilha, efLinhasDaAba, efDataDoSerial, efEstilosDeData, efTextosCompartilhados,
           efCsvParaTsv, efAbaDeLancamentos, efTextoDoArquivo,
           resumoEscritorio, efMesPorExtenso, filtrarLancamentosEscritorio, resumoDoPeriodoEscritorio,
           fechamentosDoEscritorio, mesEstaFechado, ultimoMesFechado, conferenciaDoMes,
           diferencaDeFechamento, bloqueioPorMesFechado,
           detectarColunasTabela, movimentosDaTabela, conciliarExtrato, efEhMovimento,
           lancamentoDoExtrato, efValorDeTexto, efEhData, efLinhaDoCabecalho,
           layoutsDoEscritorio, layoutSalvo,
           ehEmpreendimento, empreendimentosDoData, nomeDoEmpreendimento, cartoesDaObra, obraEhDoEscritorio, validarCartaoDoCliente, cartaoDoClienteNovo,
           modoDaPonte, destinoNoEscritorio, lancamentosDaObraParaEscritorio, idDaPonte,
           fontesDasContasPagas,
           cartaoVazio, cartaoPorId, faturaDaCompra, somarCompetencia, parcelasDoCartao,
           pagamentoNoCartao, linhasDaFatura, totalDaFatura, idDaFatura, lancamentoDaFatura,
           competenciasDoCartao,
           faturasFechadas, faturaParaFechar, lancamentosParaResultado, mesAnoPorExtenso, efDiaBR, fechadasDaCompra, compraEditada, compraMexeuNoDinheiro, faturaAjustada,
           lancamentosDaBaixa, ponteAutomaticaNaBaixa, semLancamentosDasContas, ligaContaAoLancamento, lancamentosLigadosAsContas, contasLigadasAoLancamento,
           unidadePedeObra, contasDoLancamento, valorDaConta, contaEscolhida,
           obrasDoLancamento, validarLancamentoNaObra, destinoVisivelDoCusto,
           efValorDoCampo, anexosDaTransacao, comAnexos,
           efNomeDoFornecedor, EF_FORNECEDOR_OUTROS,
           custoDoLancamento, validarCustoEmItens,
           comIdsDosMovimentos, extratoParaGuardar, saldoDoExtratoNoMes, documentoDoHistorico, chaveDoHistorico,
           sugestaoDoExtrato, lancamentoDaLinhaDoExtrato, lancamentoRapidoDoExtrato, pareceEntreContas, ehEstornoNaConta, comSinalDeEstorno,
           extratosComArquivo, movimentosGuardadosDoMes, ignoradosGuardados, extratosComIgnorado };`)();

const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);
let falhas = 0;
const cent = (v) => Math.round(v * 100) / 100;

// ── Taxonomia ───────────────────────────────────────────────────

// ── De qual plano é a conta ─────────────────────────────────────
const PLANO_OBRA_T = [
  { id: "material",      nome: "Material",            grupo: "materiais" },
  { id: "frete",         nome: "Frete",               grupo: "materiais" },
  { id: "empreiteiro",   nome: "Empreiteiro",         grupo: "maoDeObra" },
  { id: "impostos",      nome: "Impostos",            grupo: "servicos" },
  { id: "terreno_aquisicao", nome: "Aquisição de terreno", grupo: "terreno" },
  { id: "deposito_proprio",  nome: "Depósito Recurso Próprio", grupo: "receitas" },
  { id: "cartao_credito",    nome: "Cartão de crédito", grupo: "receitas" },
];
const OPC_OBRA = { planoObra: PLANO_OBRA_T };


// ── Os papéis da transação ──────────────────────────────────────

// ── Fornecedor não identificado ─────────────────────────────────

// ── Custo da obra, item a item ──────────────────────────────────
const IT = (q, u, etapa) => ({ id: "i" + q + u, descricao: "x", quantidade: q, unitario: u,
  etapa: etapa === undefined ? "fundacao" : etapa });

teste("itens que somam o valor pago: fecha, sem desconto", () => {
  const r = M.custoDoLancamento(100, [IT(2, 30), IT(4, 10)]);
  assert.strictEqual(r.bruto, 100);
  assert.strictEqual(r.desconto, 0);
  assert.strictEqual(r.falta, 0);
  assert.strictEqual(r.fecha, true);
});

teste("soma maior que o pago vira desconto", () => {
  const r = M.custoDoLancamento(90, [IT(2, 30), IT(4, 10)]);
  assert.strictEqual(r.bruto, 100);
  assert.strictEqual(r.desconto, 10);
  assert.strictEqual(r.falta, 0);
});

teste("soma menor que o pago é item faltando, não desconto", () => {
  const r = M.custoDoLancamento(150, [IT(2, 30)]);
  assert.strictEqual(r.falta, 90);
  assert.strictEqual(r.desconto, 0);
  const v = M.validarCustoEmItens(150, [IT(2, 30)], "o1");
  assert.strictEqual(v.ok, false);
  assert.ok(v.erros.some((e) => /menor que o valor pago/.test(e)), JSON.stringify(v.erros));
});

teste("centavo de arredondamento não é buraco", () => {
  const r = M.custoDoLancamento(100, [IT(3, 33.333)]);
  assert.strictEqual(r.fecha, true);
});

teste("item sem etapa trava o lançamento", () => {
  const v = M.validarCustoEmItens(60, [IT(2, 30, "")], "o1");
  assert.strictEqual(v.ok, false);
  assert.ok(v.erros.some((e) => /sem etapa/.test(e)));
});

teste("sem obra e sem item, diz as duas coisas", () => {
  const v = M.validarCustoEmItens(0, [], "");
  assert.ok(v.erros.some((e) => /Escolha a obra/.test(e)));
  assert.ok(v.erros.some((e) => /pelo menos um item/.test(e)));
  assert.ok(v.erros.some((e) => /valor pago/.test(e)));
});

teste("tudo no lugar: passa", () => {
  const v = M.validarCustoEmItens(59.96, [IT(4, 14.99)], "o1");
  assert.deepStrictEqual(v.erros, []);
  assert.strictEqual(v.ok, true);
});

teste("item sem valor não conta nem como item nem como etapa faltando", () => {
  const v = M.validarCustoEmItens(60, [IT(2, 30), { id: "vazio", quantidade: "", unitario: "", etapa: "" }], "o1");
  assert.deepStrictEqual(v.erros, []);
});

teste("sem fornecedor escolhido, a transação entra como Outros", () => {
  assert.strictEqual(M.efNomeDoFornecedor({}), "Outros");
  assert.strictEqual(M.efNomeDoFornecedor({ fornecedor: "" }), "Outros");
  assert.strictEqual(M.efNomeDoFornecedor({ fornecedor: "   " }), "Outros");
  assert.strictEqual(M.efNomeDoFornecedor(null), "Outros");
});

teste("fornecedor escolhido continua sendo ele", () => {
  assert.strictEqual(M.efNomeDoFornecedor({ fornecedor: "OURIFER" }), "OURIFER");
  assert.strictEqual(M.efNomeDoFornecedor({ fornecedor: " Pantanal " }), "Pantanal");
});

teste("Outros é um nome de verdade, não uma linha em branco", () => {
  assert.strictEqual(M.EF_FORNECEDOR_OUTROS, "Outros");
  assert.strictEqual(M.efNomeDoFornecedor({ fornecedor: "Outros" }), "Outros");
});

teste("o comprovante antigo é lido como o primeiro documento", () => {
  const c = { comprovante: { url: "u1", nome: "pix.pdf" } };
  assert.deepStrictEqual(M.anexosDaTransacao(c).map((a) => a.nome), ["pix.pdf"]);
});

teste("comprovante antigo + lista nova aparecem juntos, sem repetir", () => {
  const c = { comprovante: { url: "u1", public_id: "p1", nome: "pix.pdf" },
    anexos: [{ url: "u2", public_id: "p2", nome: "nota.pdf" }] };
  assert.deepStrictEqual(M.anexosDaTransacao(c).map((a) => a.nome), ["pix.pdf", "nota.pdf"]);
  const jaDentro = { comprovante: { url: "u1", public_id: "p1" },
    anexos: [{ url: "u1", public_id: "p1" }] };
  assert.strictEqual(M.anexosDaTransacao(jaDentro).length, 1);
});

teste("sem papel nenhum, a lista é vazia", () => {
  assert.deepStrictEqual(M.anexosDaTransacao({}), []);
  assert.deepStrictEqual(M.anexosDaTransacao(null), []);
});

teste("ao mexer na lista, o campo antigo sai de cena — guardar os dois é pedir divergência", () => {
  const c = { id: "x", comprovante: { url: "u1" }, anexos: [] };
  const novo = M.comAnexos(c, [{ url: "u1" }, { url: "u2" }]);
  assert.strictEqual("comprovante" in novo, false);
  assert.strictEqual(novo.anexos.length, 2);
  assert.strictEqual(novo.id, "x");
});

teste("unidade que fala de obra: gestão de obras e empreendimento", () => {
  assert.strictEqual(M.unidadePedeObra("empreendimento"), true);
  assert.strictEqual(M.unidadePedeObra("gestao_obras"), true);
  assert.strictEqual(M.unidadePedeObra("escritorio"), false);
  assert.strictEqual(M.unidadePedeObra("projetos"), false);
  assert.strictEqual(M.unidadePedeObra(""), false);
});

teste("no escritório só aparece o plano do escritório, filtrado pela unidade", () => {
  const r = M.contasDoLancamento("escritorio", OPC_OBRA);
  assert.deepStrictEqual(r.obra, []);
  assert.ok(r.escritorio.some((c) => c.id === "luz_agua_net"));
  // conta de gestão não vale no escritório
  assert.ok(!r.escritorio.some((c) => c.id === "dep_consignacao"));
});

teste("o bug: empreendimento não pode oferecer conta de gestão", () => {
  const r = M.contasDoLancamento("empreendimento", OPC_OBRA);
  assert.ok(!r.escritorio.some((c) => c.id === "dep_consignacao"));
  assert.ok(!r.escritorio.some((c) => c.id === "pagamentos_compras"));
  assert.ok(r.escritorio.some((c) => c.id === "emp_construcao"));
});

teste("no empreendimento o plano da obra entra, só com os grupos de custo", () => {
  const r = M.contasDoLancamento("empreendimento", OPC_OBRA);
  const ids = r.obra.map((c) => c.id);
  assert.ok(ids.indexOf("material") >= 0, "material tem que aparecer");
  assert.ok(ids.indexOf("empreiteiro") >= 0);
  assert.ok(ids.indexOf("terreno_aquisicao") >= 0);
  // receita de obra não se lança pelo extrato
  assert.ok(ids.indexOf("deposito_proprio") < 0);
});

teste("o prefixo distingue os dois planos quando o id se repete", () => {
  const r = M.contasDoLancamento("empreendimento", OPC_OBRA);
  const doEsc = r.escritorio.find((c) => c.id === "emp_construcao");
  assert.strictEqual(doEsc.valor, "e:emp_construcao");
  assert.deepStrictEqual(M.contaEscolhida("o:material"), { fonte: "obra", id: "material" });
  assert.deepStrictEqual(M.contaEscolhida("e:material"), { fonte: "escritorio", id: "material" });
});

teste("lançamento antigo, sem prefixo, continua sendo do escritório", () => {
  assert.deepStrictEqual(M.contaEscolhida("luz_agua_net"), { fonte: "escritorio", id: "luz_agua_net" });
  assert.deepStrictEqual(M.contaEscolhida(""), { fonte: "", id: "" });
});

teste("as obras oferecidas são as do cliente escolhido", () => {
  const data = { obras: [{ id: "o1", clienteId: "c1" }, { id: "o2", clienteId: "c2" }, { id: "o3", clienteId: "c1" }] };
  assert.deepStrictEqual(M.obrasDoLancamento(data, "c1").map((o) => o.id), ["o1", "o3"]);
  assert.deepStrictEqual(M.obrasDoLancamento(data, ""), []);
});

teste("custo na obra: cobra conta, cliente, obra, valor e data", () => {
  const vazio = M.validarLancamentoNaObra({}, OPC_OBRA);
  assert.ok(vazio.includes("Escolha a conta."));
  assert.ok(vazio.includes("Informe o cliente ou o empreendimento."));
  assert.ok(vazio.includes("Escolha a obra que recebe o custo."));
  assert.ok(vazio.includes("Informe o valor."));
  assert.ok(vazio.includes("Informe a data do pagamento."));
  const bom = M.validarLancamentoNaObra({ contaId: "material", clienteId: "c1", obraIdAlvo: "o1",
    valor: 59.96, lancadoEm: "2026-09-24" }, OPC_OBRA);
  assert.deepStrictEqual(bom, []);
});

teste("custo na obra respeita mês fechado, pela data do pagamento", () => {
  const r = M.validarLancamentoNaObra({ contaId: "material", clienteId: "c1", obraIdAlvo: "o1",
    valor: 10, lancadoEm: "2026-08-10" }, { ...OPC_OBRA, fechamentos: { "2026-08": { fechadoEm: "x" } } });
  assert.ok(r.some((e) => /fechad/i.test(e)), JSON.stringify(r));
});

teste("a tela avisa onde o custo vai aparecer no escritório", () => {
  const emp = { id: "o1", clienteId: "c3" };
  const clienteEmp = { id: "c3", servicos: { empreendimento: true } };
  const r = M.destinoVisivelDoCusto("material", emp, clienteEmp, OPC_OBRA);
  assert.strictEqual(r.modo, "empreendimento");
  assert.strictEqual(r.conta, "Construção");
});

teste("na gestão de obras o mesmo custo chega como Pagamentos e compras", () => {
  const obra = { id: "o1", clienteId: "c1" };
  const cliente = { id: "c1", servicos: { gestaoObra: true } };
  const r = M.destinoVisivelDoCusto("material", obra, cliente, OPC_OBRA);
  assert.strictEqual(r.modo, "gestao");
  assert.strictEqual(r.conta, "Pagamentos e compras");
});

teste("cliente que paga direto: o custo não atravessa, e a tela diz", () => {
  const obra = { id: "o1", clienteId: "c1", clientePagaDireto: true };
  const cliente = { id: "c1", servicos: { gestaoObra: true } };
  const r = M.destinoVisivelDoCusto("material", obra, cliente, OPC_OBRA);
  assert.strictEqual(r.modo, "clientePaga");
  assert.strictEqual(r.conta, null);
});

teste("valor em português no campo: 5.000,00 não vira NaN", () => {
  assert.strictEqual(M.efValorDoCampo("5.000,00"), 5000);
  assert.strictEqual(M.efValorDoCampo("59,96"), 59.96);
  assert.strictEqual(M.efValorDoCampo(""), 0);
  assert.strictEqual(M.efValorDoCampo(1234.5), 1234.5);
});

teste("toda conta aponta para um grupo que existe, e todo id é único", () => {
  const ids = new Set();
  for (const c of M.PLANO_CONTAS_ESCRITORIO) {
    assert.ok(!ids.has(c.id), `id repetido: ${c.id}`);
    ids.add(c.id);
    assert.ok(M.grupoEscritorio(c.grupo), `grupo inexistente em ${c.id}: ${c.grupo}`);
    for (const u of c.unidades || []) {
      assert.ok(M.UNIDADES_NEGOCIO.some(x => x.id === u), `unidade inexistente em ${c.id}: ${u}`);
    }
  }
});

teste("os nomes da planilha caem na conta certa, sem ligar para caixa e acento", () => {
  assert.strictEqual(M.contaPeloApelido("Receita Projetos"), "rec_projetos");
  assert.strictEqual(M.contaPeloApelido("Receita projetos"), "rec_projetos", "a planilha tem os dois jeitos");
  assert.strictEqual(M.contaPeloApelido("RECEITA PROJETOS"), "rec_projetos");
  assert.strictEqual(M.contaPeloApelido("Deposito em consignacao"), "dep_consignacao", "sem acento também casa");
  assert.strictEqual(M.contaPeloApelido("Investimento (Máquinas, reforma)"), "imobilizado");
  assert.strictEqual(M.contaPeloApelido("Empreiteiro"), null, "conta de obra não é do escritório");
  assert.strictEqual(M.contaPeloApelido(""), null);
  assert.strictEqual(M.unidadePeloApelido("Gestão de obras"), "gestao_obras");
  assert.strictEqual(M.unidadePeloApelido("gestao_obras"), "gestao_obras");
  assert.strictEqual(M.unidadePeloApelido("Empreendimento"), "empreendimento");
});

// ── Regras do lançamento ────────────────────────────────────────
const base = { contaId: "luz_agua_net", unidadeId: "escritorio", valor: 100, competencia: "2026-09" };

teste("lançamento completo do escritório passa", () => {
  assert.deepStrictEqual(M.validarLancamentoEscritorio(base), []);
});

teste("conta de trânsito não aceita a unidade Escritório", () => {
  const e = M.validarLancamentoEscritorio({ ...base, contaId: "pagamentos_compras" });
  assert.ok(e.some(x => /não é do Escritório/.test(x)), e.join(" | "));
  const ok = M.validarLancamentoEscritorio({ contaId: "pagamentos_compras", unidadeId: "gestao_obras",
    valor: 100, competencia: "2026-09", clienteId: "c1", obraId: "o1" });
  assert.deepStrictEqual(ok, []);
});

teste("gestão de obras exige cliente e obra; empreendimento exige o empreendimento", () => {
  const e = M.validarLancamentoEscritorio({ contaId: "dep_consignacao", unidadeId: "gestao_obras", valor: 1, competencia: "2026-09" });
  assert.ok(e.some(x => /cliente/i.test(x)) && e.some(x => /obra/i.test(x)), e.join(" | "));
  const emp = M.validarLancamentoEscritorio({ contaId: "emp_construcao", unidadeId: "empreendimento", valor: 1, competencia: "2026-09" });
  assert.ok(emp.some(x => /empreendimento/i.test(x)), emp.join(" | "));
  assert.deepStrictEqual(
    M.validarLancamentoEscritorio({ contaId: "emp_construcao", unidadeId: "empreendimento", valor: 1, competencia: "2026-09", empreendimentoId: "e1" }),
    []);
});

teste("pagamento do sócio pela conta do escritório é do Escritório mesmo", () => {
  assert.deepStrictEqual(M.validarLancamentoEscritorio({ ...base, contaId: "adiant_socio" }), []);
  assert.deepStrictEqual(M.validarLancamentoEscritorio({ ...base, contaId: "reemb_socio" }), []);
});

teste("valor zero, mês torto e conta inexistente são barrados", () => {
  assert.ok(M.validarLancamentoEscritorio({ ...base, valor: 0 }).some(x => /valor/i.test(x)));
  assert.ok(M.validarLancamentoEscritorio({ ...base, competencia: "09/2026" }).some(x => /competência/i.test(x)));
  assert.ok(M.validarLancamentoEscritorio({ ...base, contaId: "nao_existe" }).some(x => /conta/i.test(x)));
});

// ── Cálculo do extrato ──────────────────────────────────────────
teste("a sequência de meses cobre o intervalo inteiro, virando o ano", () => {
  assert.deepStrictEqual(M.mesesEntreEscritorio("2026-11", "2027-02"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  assert.deepStrictEqual(M.mesesEntreEscritorio("2026-03", "2026-03"), ["2026-03"]);
  assert.deepStrictEqual(M.mesesEntreEscritorio("2026-05", "2026-01"), []);
});

const lancs = [
  { contaId: "dep_consignacao",   unidadeId: "gestao_obras", valor: 12000, competencia: "2026-09" },
  { contaId: "pagamentos_compras", unidadeId: "gestao_obras", valor: 22706.41, competencia: "2026-09" },
  { contaId: "rec_projetos",      unidadeId: "projetos",    valor: 10500, competencia: "2026-09" },
  { contaId: "rec_gestao",        unidadeId: "gestao_obras", valor: 10833, competencia: "2026-09" },
  { contaId: "luz_agua_net",      unidadeId: "escritorio",  valor: 355.14, competencia: "2026-09" },
  { contaId: "contabilidade",     unidadeId: "escritorio",  valor: 796.57, competencia: "2026-09" },
  { contaId: "retiradas_socios",  unidadeId: "escritorio",  valor: 24000, competencia: "2026-09" },
  { contaId: "rec_projetos",      unidadeId: "projetos",    valor: 5000, competencia: "2026-10" },
];

teste("cada bloco soma só o que é dele, e o saldo do extrato acumula", () => {
  const [set, out] = M.extratoEscritorio(lancs, { saldoAbertura: 100000 });
  assert.strictEqual(set.mes, "2026-09");
  assert.strictEqual(set.saldoGestao, 12000 - 22706.41);
  assert.strictEqual(set.saldoEscritorio, cent((10500 + 10833) - (355.14 + 796.57)));
  assert.strictEqual(set.retiradas, 24000);
  assert.strictEqual(set.paraInvestimento, cent(set.saldoEscritorio - 24000));
  assert.strictEqual(set.saldoExtrato, cent(100000 + set.saldoGestao + set.paraInvestimento));
  assert.strictEqual(out.mes, "2026-10");
  assert.strictEqual(out.saldoExtrato, cent(set.saldoExtrato + 5000), "mês seguinte parte do saldo anterior");
});

teste("lançamento sem conta reconhecida fica de fora da conta, não quebra o saldo", () => {
  const [mes] = M.extratoEscritorio([...lancs.slice(0, 1), { contaId: null, unidadeId: "escritorio", valor: 999, competencia: "2026-09" }],
    { saldoAbertura: 0, de: "2026-09", ate: "2026-09" });
  assert.strictEqual(mes.saldoExtrato, 12000);
});

teste("empreendimento entra no saldo do banco e fica fora do resultado do escritório", () => {
  const [mes] = M.extratoEscritorio([
    { contaId: "emp_construcao", unidadeId: "empreendimento", valor: 30000, competencia: "2026-09", empreendimentoId: "e1" },
    { contaId: "rec_projetos", unidadeId: "projetos", valor: 10000, competencia: "2026-09" },
  ], { saldoAbertura: 50000, de: "2026-09", ate: "2026-09" });
  assert.strictEqual(mes.saldoEscritorio, 10000, "construir casa para vender não é despesa do escritório");
  assert.strictEqual(mes.saldoEmpreendimento, -30000);
  assert.strictEqual(mes.saldoExtrato, 30000, "mas sai do banco");
});

teste("resultado do empreendimento só existe depois da venda", () => {
  const obra = [
    { contaId: "emp_terreno",    unidadeId: "empreendimento", valor: 80000,  competencia: "2026-01", empreendimentoId: "e1" },
    { contaId: "emp_construcao", unidadeId: "empreendimento", valor: 220000, competencia: "2026-06", empreendimentoId: "e1" },
    { contaId: "emp_construcao", unidadeId: "empreendimento", valor: 50000,  competencia: "2026-06", empreendimentoId: "e2" },
  ];
  const andando = M.resultadoEmpreendimento(obra, "e1");
  assert.strictEqual(andando.investido, 300000);
  assert.strictEqual(andando.resultado, null, "enquanto não vende, não há lucro nem prejuízo");
  const vendido = M.resultadoEmpreendimento([...obra,
    { contaId: "emp_corretagem", unidadeId: "empreendimento", valor: 18000, competencia: "2026-09", empreendimentoId: "e1" },
    { contaId: "emp_venda", unidadeId: "empreendimento", valor: 420000, competencia: "2026-09", empreendimentoId: "e1" }],
    "e1", { concluido: true });
  assert.strictEqual(vendido.investido, 318000);
  assert.strictEqual(vendido.vendido, 420000);
  assert.strictEqual(vendido.resultado, 102000);
  assert.strictEqual(M.resultadoEmpreendimento(obra, "e2").investido, 50000, "um empreendimento não contamina o outro");
});

// ── Colagem da planilha ─────────────────────────────────────────
const CAB = "#\tCod. Cliente\tNome Cliente\tUnidade negócio\tProjeto / obra\tFornecedor\tDescrição Lançamento\tConta contábil\tNota / Comprovante\tEmitir nota fiscal\tValor total nota\tPeríodo Contábil\tData do lançamento\tCC Escritório";
const linha = (...c) => c.join("\t");

teste("a colagem do Excel vira lançamento, com conta, unidade e competência", () => {
  const txt = [CAB,
    linha("6352", "202229", "Jacarezinho", "Gestão de obras", "Módulo 1", "SANEPAR", "Conta de água obra",
          "Pagamentos e compras", "4212", "Não", "70,49", "24/09/2026", "24/09/2026", "Sim"),
  ].join("\n");
  const r = M.interpretarColagemEscritorio(txt);
  assert.strictEqual(r.resumo.total, 1);
  assert.strictEqual(r.resumo.prontos, 1);
  const i = r.itens[0];
  assert.strictEqual(i.contaId, "pagamentos_compras");
  assert.strictEqual(i.unidadeId, "gestao_obras");
  assert.strictEqual(i.valor, 70.49);
  assert.strictEqual(i.competencia, "2026-09");
  assert.strictEqual(i.lancadoEm, "2026-09-24");
  assert.strictEqual(i.contaBanco, "sim");
  assert.strictEqual(i.fornecedor, "SANEPAR");
  assert.strictEqual(i.documento, "4212");
});

teste("linha com conta desconhecida ou sem valor volta com o motivo, e não vira lançamento", () => {
  const txt = [CAB,
    linha("1", "", "X", "Gestão de obras", "", "", "Serralheiro feito", "Serralheiro", "", "Não", "100", "01/2026", "", ""),
    linha("2", "", "X", "Escritório", "", "", "sem valor", "Utensílios em geral", "", "Não", "", "01/2026", "", ""),
  ].join("\n");
  const r = M.interpretarColagemEscritorio(txt);
  assert.strictEqual(r.resumo.prontos, 0);
  assert.match(r.itens[0].erros[0], /Serralheiro/);
  assert.deepStrictEqual(r.itens[1].erros, ["sem valor"]);
});

teste("o campo da conta bancária só aceita sim e não; o resto vira observação", () => {
  const txt = [CAB,
    linha("1", "", "", "Escritório", "", "", "a", "Utensílios em geral", "", "Não", "10", "01/2026", "", "Não consta no extrato"),
    linha("2", "", "", "Escritório", "", "", "b", "Utensílios em geral", "", "Não", "10", "01/2026", "", "Não"),
  ].join("\n");
  const r = M.interpretarColagemEscritorio(txt);
  assert.strictEqual(r.itens[0].contaBanco, "");
  assert.strictEqual(r.itens[0].observacao, "Não consta no extrato");
  assert.strictEqual(r.itens[1].contaBanco, "nao");
  assert.strictEqual(r.itens[1].observacao, "");
});

teste("número e competência aceitam os formatos que o Excel entrega", () => {
  assert.strictEqual(M.efNumero("1.234,56"), 1234.56);
  assert.strictEqual(M.efNumero("R$ 1.234,56"), 1234.56);
  assert.strictEqual(M.efNumero("1234.56"), 1234.56);
  assert.strictEqual(M.efNumero(""), null);
  assert.strictEqual(M.efNumero("abc"), null);
  assert.strictEqual(M.efCompetencia("24/09/2026"), "2026-09");
  assert.strictEqual(M.efCompetencia("2026-09-24 00:00:00"), "2026-09");
  assert.strictEqual(M.efCompetencia("9/2026"), "2026-09");
  assert.strictEqual(M.efCompetencia("setembro"), "");
});

teste("o lançamento gravado carrega a marca do escritório e o que veio da planilha", () => {
  const [item] = M.interpretarColagemEscritorio([CAB,
    linha("1", "", "Cliente X", "Projetos", "Casa", "Loja", "Plotagem", "RRTs e Impressões", "99", "Sim", "120,50", "03/2026", "10/03/2026", "Sim")].join("\n")).itens;
  const l = M.lancamentoDaColagem(item, "imp1");
  assert.strictEqual(l.id, "imp1");
  assert.strictEqual(l.tipo, "escritorio");
  assert.strictEqual(l.contaId, "rrt_impressoes");
  assert.strictEqual(l.unidadeId, "projetos");
  assert.strictEqual(l.valor, 120.5);
  assert.strictEqual(l.emitirNota, true);
  assert.strictEqual(l.importado, true);
  assert.strictEqual(l.contaOriginal, "RRTs e Impressões");
});

teste("só os lançamentos do escritório entram na conta", () => {
  const d = { lancamentos: [{ id: "a", tipo: "escritorio" }, { id: "b", obraId: "o1" }, null] };
  assert.deepStrictEqual(M.lancamentosDoEscritorio(d).map(l => l.id), ["a"]);
  assert.deepStrictEqual(M.lancamentosDoEscritorio({}), []);
});


// ── Uma planilha .xlsx de verdade, montada aqui (zip sem compressão) ──
// Sem dependência: o leitor aceita entrada "stored", então o teste escreve
// o zip na mão e exercita o mesmo caminho que o navegador percorre.
function crc32(bytes) {
  let c, tabela = crc32.tabela;
  if (!tabela) {
    tabela = crc32.tabela = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabela[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = tabela[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipSemCompressao(arquivos) {
  const cod = new TextEncoder();
  const partes = [], central = [];
  let desloc = 0;
  const u16 = (n) => [n & 255, (n >>> 8) & 255];
  const u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  for (const nome in arquivos) {
    const dados = cod.encode(arquivos[nome]);
    const n = cod.encode(nome);
    const crc = crc32(dados);
    const local = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(dados.length), u32(dados.length), u16(n.length), u16(0));
    partes.push(new Uint8Array(local), n, dados);
    central.push([].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(dados.length), u32(dados.length), u16(n.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(desloc),
      Array.from(n)));
    desloc += local.length + n.length + dados.length;
  }
  const dir = [].concat(...central);
  const fim = [].concat(u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
    u32(dir.length), u32(desloc), u16(0));
  partes.push(new Uint8Array(dir), new Uint8Array(fim));
  const total = partes.reduce((s, p) => s + p.length, 0);
  const saida = new Uint8Array(total);
  let i = 0;
  for (const p of partes) { saida.set(p, i); i += p.length; }
  return saida.buffer;
}

function planilhaDeTeste() {
  const cel = (ref, v, extra) => `<c r="${ref}"${extra || ""}><v>${v}</v></c>`;
  const sheet = `<worksheet><sheetData>`
    + `<row r="1">${["A","B","C","D"].map((c,i)=>cel(c+"1", i, ' t="s"')).join("")}</row>`
    + `<row r="2">${cel("A2", 4, ' t="s"')}${cel("B2", 7500)}${cel("C2", 43831, ' s="1"')}${cel("D2", 5, ' t="s"')}</row>`
    + `<row r="3">${cel("A3", 6, ' t="s"')}${cel("B3", "635.81")}${cel("C3", 43831, ' s="1"')}${cel("D3", 5, ' t="s"')}</row>`
    + `</sheetData></worksheet>`;
  const textos = ["Conta contábil", "Valor total nota", "Período Contábil", "Unidade negócio",
    "Receita Projetos", "Escritório", "Luz, Água e Internet"];
  return zipSemCompressao({
    "xl/workbook.xml": `<workbook><sheets><sheet name="Base de dados" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/sharedStrings.xml": `<sst>${textos.map((t) => `<si><t>${t.replace(/&/g, "&amp;")}</t></si>`).join("")}</sst>`,
    "xl/styles.xml": `<styleSheet><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>`,
    "xl/worksheets/sheet1.xml": sheet,
  });
}

// ── Ler arquivo: planilha, CSV e escolha de aba ─────────────────
teste("a data em serial do Excel vira dd/mm/aaaa", () => {
  assert.strictEqual(M.efDataDoSerial(43831), "01/01/2020");   // 1º de janeiro de 2020
  assert.strictEqual(M.efDataDoSerial(45999), "08/12/2025");
  assert.strictEqual(M.efDataDoSerial(46022), "31/12/2025");  // virada de ano, sem escorregar um dia
});

teste("o formato personalizado com dia/mês/ano conta como data, e o de dinheiro não", () => {
  const styles = `<styleSheet><numFmts count="2">`
    + `<numFmt numFmtId="165" formatCode="[$-416]dd\\-mmm\\-yy;@"/>`
    + `<numFmt numFmtId="166" formatCode="&quot;R$&quot;\\ #,##0.00"/>`
    + `</numFmts><cellXfs count="4">`
    + `<xf numFmtId="0"/><xf numFmtId="166"/><xf numFmtId="165"/><xf numFmtId="14"/>`
    + `</cellXfs></styleSheet>`;
  const datas = M.efEstilosDeData(styles);
  assert.ok(!datas.has(0), "geral não é data");
  assert.ok(!datas.has(1), "R$ não é data");
  assert.ok(datas.has(2), "dd-mmm-yy é data");
  assert.ok(datas.has(3), "formato 14 embutido é data");
});

teste("a aba vira matriz: texto compartilhado, número, data e célula vazia", () => {
  const textos = M.efTextosCompartilhados(
    `<sst><si><t>Receita Projetos</t></si><si><r><t>Luz, </t></r><r><t>Água e Internet</t></r></si></sst>`);
  assert.deepStrictEqual(textos, ["Receita Projetos", "Luz, Água e Internet"]);
  const xml = `<worksheet><sheetData>`
    + `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>`
    + `<row r="2"><c r="A2"><v>7500</v></c><c r="B2" s="1"><v>43831</v></c><c r="C2" t="inlineStr"><is><t>Obra &amp; Cia</t></is></c></row>`
    + `<row r="3"/>`
    + `</sheetData></worksheet>`;
  const linhas = M.efLinhasDaAba(xml, textos, new Set([1]));
  assert.strictEqual(linhas.length, 2, "linha vazia não entra");
  assert.deepStrictEqual(linhas[0], ["Receita Projetos", "", "Luz, Água e Internet"]);
  assert.deepStrictEqual(linhas[1], ["7500", "01/01/2020", "Obra & Cia"]);
});

teste("CSV com vírgula dentro de aspas não parte a coluna no meio", () => {
  const tsv = M.efCsvParaTsv(`Conta,Descrição,Valor\r\nOutros,"Luz, água e net","1.234,56"`);
  assert.deepStrictEqual(tsv.split("\n").map((l) => l.split("\t")),
    [["Conta", "Descrição", "Valor"], ["Outros", "Luz, água e net", "1.234,56"]]);
  // já vindo com tabulação, passa direto
  assert.strictEqual(M.efCsvParaTsv("a\tb\nc\td"), "a\tb\nc\td");
  // ponto e vírgula (Excel em português) também
  assert.deepStrictEqual(M.efCsvParaTsv("Conta;Valor\nOutros;10").split("\n")[1].split("\t"), ["Outros", "10"]);
});

teste("de várias abas, escolhe a que tem cabeçalho de lançamento", () => {
  const abas = [
    { nome: "Resumo", linhas: [["Mês", "Saldo"], ["jan", "10"]] },
    { nome: "Base de dados", linhas: [["Nome Cliente", "Conta contábil", "Valor total nota", "Período Contábil"], ["x", "Outros", "10", "01/2026"]] },
  ];
  assert.strictEqual(M.efAbaDeLancamentos(abas).nome, "Base de dados");
  // sem cabeçalho reconhecível, fica com a primeira que tem conteúdo
  assert.strictEqual(M.efAbaDeLancamentos([{ nome: "A", linhas: [] }, { nome: "B", linhas: [["x"], ["y"]] }]).nome, "B");
});

teste("planilha montada na hora atravessa o caminho inteiro até virar lançamento", async () => {
  const buffer = await planilhaDeTeste();
  const abas = await M.efAbasDaPlanilha(buffer);
  assert.deepStrictEqual(abas.map((a) => a.nome), ["Base de dados"]);
  const aba = M.efAbaDeLancamentos(abas);
  const tsv = aba.linhas.map((l) => l.join("\t")).join("\n");
  const lido = M.interpretarColagemEscritorio(tsv);
  assert.strictEqual(lido.resumo.total, 2);
  assert.strictEqual(lido.resumo.prontos, 2);
  const lancs = lido.itens.map((i, n) => M.lancamentoDaColagem(i, "t" + n));
  assert.strictEqual(lancs[0].contaId, "rec_projetos");
  assert.strictEqual(lancs[0].competencia, "2020-01");
  assert.strictEqual(lancs[0].valor, 7500);
  assert.strictEqual(lancs[1].contaId, "luz_agua_net");
  assert.strictEqual(cent(lancs[1].valor), 635.81);
  const extrato = M.extratoEscritorio(lancs);
  assert.strictEqual(extrato.length, 1);
  assert.strictEqual(cent(extrato[0].saldoExtrato), cent(7500 - 635.81));
});


// ── Resumo do mês ───────────────────────────────────────────────
teste("o resumo pega o mês corrente, compara com o anterior e avisa do que está à frente", () => {
  const linhas = [
    { mes: "2026-07", grupos: { receitas: 10000, despesas: 4000 }, saldoEscritorio: 6000, retiradas: 1000, saldoExtrato: 50000 },
    { mes: "2026-08", grupos: { receitas: 20000, despesas: 5000 }, saldoEscritorio: 15000, retiradas: 2000, saldoExtrato: 63000 },
    { mes: "2026-09", grupos: { receitas: 15000, despesas: 5000 }, saldoEscritorio: 10000, retiradas: 2000, saldoExtrato: 71000 },
    { mes: "2026-11", grupos: { receitas: 1000, despesas: 0 }, saldoEscritorio: 1000, retiradas: 0, saldoExtrato: 72000 },
  ];
  const r = M.resumoEscritorio(linhas, { hoje: new Date("2026-09-27T12:00:00Z") });
  assert.strictEqual(r.mes, "2026-09");
  assert.strictEqual(r.mesAnterior, "2026-08");
  assert.strictEqual(r.saldo, 71000);
  assert.strictEqual(r.resultado, 10000);
  assert.strictEqual(r.retiradas, 2000);
  assert.strictEqual(cent(r.variacao.receitas), -0.25);      // caiu um quarto
  assert.strictEqual(r.variacao.despesas, 0);                 // igual ao mês anterior
  assert.deepStrictEqual(r.futuro, { ate: "2026-11", saldo: 72000 });
});

teste("mês sem movimento nenhum ainda cai no último mês fechado, e o primeiro mês não tem com quem comparar", () => {
  const linhas = [
    { mes: "2026-06", grupos: { receitas: 9000, despesas: 1000 }, saldoEscritorio: 8000, retiradas: 0, saldoExtrato: 30000 },
    { mes: "2026-07", grupos: { receitas: 7000, despesas: 2000 }, saldoEscritorio: 5000, retiradas: 0, saldoExtrato: 35000 },
  ];
  // hoje é setembro, mas o extrato só vai até julho
  const r = M.resumoEscritorio(linhas, { hoje: new Date("2026-09-27T12:00:00Z") });
  assert.strictEqual(r.mes, "2026-07");
  assert.strictEqual(r.futuro, null);
  const primeiro = M.resumoEscritorio(linhas, { mes: "2026-06" });
  assert.strictEqual(primeiro.mesAnterior, "");
  assert.strictEqual(primeiro.variacao.receitas, null, "sem mês anterior, não inventa variação");
  assert.strictEqual(M.resumoEscritorio([]), null);
});

teste("o mês vira texto de gente", () => {
  assert.strictEqual(M.efMesPorExtenso("2026-09"), "setembro de 2026");
  assert.strictEqual(M.efMesPorExtenso("2026-03", true), "mar/26");
  assert.strictEqual(M.efMesPorExtenso(""), "");
});


// ── Painel: filtro e resumo do período ──────────────────────────
const lancParaFiltro = (id, competencia, contaId, unidadeId, valor) =>
  ({ id, tipo: "escritorio", competencia, contaId, unidadeId, valor });

teste("o filtro corta por ano, por mês e por unidade — e vazio quer dizer tudo", () => {
  const lista = [
    lancParaFiltro("a", "2025-03", "rec_projetos", "projetos", 1000),
    lancParaFiltro("b", "2026-03", "rec_projetos", "projetos", 2000),
    lancParaFiltro("c", "2026-04", "marketing", "escritorio", 300),
    lancParaFiltro("d", "2026-03", "dep_consignacao", "gestao_obras", 5000),
    { id: "e", competencia: "", contaId: "rec_projetos", valor: 9 },
  ];
  const ids = (f) => M.filtrarLancamentosEscritorio(lista, f).map((l) => l.id);
  assert.deepStrictEqual(ids({}), ["a", "b", "c", "d"], "lançamento sem competência fica de fora");
  assert.deepStrictEqual(ids({ ano: "2026" }), ["b", "c", "d"]);
  assert.deepStrictEqual(ids({ ano: "2026", mes: "03" }), ["b", "d"]);
  assert.deepStrictEqual(ids({ unidadeId: "escritorio" }), ["c"]);
  assert.deepStrictEqual(ids({ ano: "2026", mes: "3" }), ["b", "d"], "mês com um dígito também serve");
});

teste("o resumo do período soma por grupo e lista as contas do maior para o menor", () => {
  const r = M.resumoDoPeriodoEscritorio([
    lancParaFiltro("a", "2026-03", "rec_projetos", "projetos", 10000),
    lancParaFiltro("b", "2026-03", "rec_gestao", "gestao_obras", 2000),
    lancParaFiltro("c", "2026-03", "marketing", "escritorio", 500),
    lancParaFiltro("d", "2026-03", "cartao_credito", "escritorio", 1500),
    lancParaFiltro("e", "2026-03", "dep_consignacao", "gestao_obras", 7000),
    lancParaFiltro("f", "2026-03", "pagamentos_compras", "gestao_obras", 6000),
    lancParaFiltro("g", "2026-03", "retiradas_socios", "escritorio", 3000),
  ]);
  assert.strictEqual(r.receitas, 12000);
  assert.strictEqual(r.despesas, 2000);
  assert.strictEqual(r.resultado, 10000);
  assert.strictEqual(r.retiradas, 3000);
  assert.strictEqual(r.saldoGestao, 1000);
  assert.strictEqual(r.quantidade, 7);
  assert.strictEqual(r.contas[0].nome, "Receita Projetos");
  assert.strictEqual(r.contas[0].sinal, 1);
  assert.strictEqual(r.contas.find((c) => c.contaId === "marketing").sinal, -1);
});

// ── Fechamento ──────────────────────────────────────────────────
teste("fechar é dizer que bate com o banco: diferença, conferência e trava", () => {
  const fechamentos = { "2026-07": { saldoBanco: 1000, fechadoEm: "2026-08-02T10:00:00Z" }, "2026-08": { saldoBanco: 2000 } };
  assert.strictEqual(M.mesEstaFechado("2026-07", fechamentos), true);
  assert.strictEqual(M.mesEstaFechado("2026-08", fechamentos), false, "saldo informado sem fechar não fecha o mês");
  assert.strictEqual(M.ultimoMesFechado(fechamentos), "2026-07");
  assert.strictEqual(M.ultimoMesFechado({}), "");
  assert.strictEqual(M.diferencaDeFechamento(1000, 1000), 0);
  assert.strictEqual(M.diferencaDeFechamento(1000, 1200.5), 200.5, "banco maior: falta lançar entrada");
  assert.strictEqual(M.diferencaDeFechamento(1000, ""), null, "sem saldo do banco não há diferença a mostrar");
  assert.ok(M.bloqueioPorMesFechado("2026-07", fechamentos).includes("julho de 2026"));
  assert.strictEqual(M.bloqueioPorMesFechado("2026-09", fechamentos), "");
  assert.deepStrictEqual(M.fechamentosDoEscritorio({ escritorio: { financeiro: { fechamentos } } }), fechamentos);
  assert.deepStrictEqual(M.fechamentosDoEscritorio({}), {});
});

teste("a conferência conta o que já foi visto no extrato e o que falta", () => {
  const lista = [
    { id: "a", competencia: "2026-07", contaId: "rec_projetos", valor: 1000, conferido: true },
    { id: "b", competencia: "2026-07", contaId: "marketing", valor: 250 },
    { id: "c", competencia: "2026-08", contaId: "marketing", valor: 999 },
  ];
  const c = M.conferenciaDoMes(lista, "2026-07");
  assert.strictEqual(c.total, 2);
  assert.strictEqual(c.conferidos, 1);
  assert.strictEqual(c.pendentes, 1);
  assert.strictEqual(c.valorConferido, 1000);
  assert.strictEqual(c.valorPendente, 250);
});

teste("mês fechado recusa lançamento novo, mês aberto aceita", () => {
  const fechamentos = { "2026-07": { saldoBanco: 1, fechadoEm: "2026-08-02" } };
  const base = { contaId: "marketing", unidadeId: "escritorio", valor: 100 };
  const fechado = M.validarLancamentoEscritorio({ ...base, competencia: "2026-07" }, { fechamentos });
  assert.ok(fechado.some((e) => e.includes("julho de 2026")), "avisa qual mês está fechado");
  assert.deepStrictEqual(M.validarLancamentoEscritorio({ ...base, competencia: "2026-09" }, { fechamentos }), []);
  assert.deepStrictEqual(M.validarLancamentoEscritorio({ ...base, competencia: "2026-07" }), [], "sem a lista de fechamentos, nada muda");
});


// ── Reconhecer as colunas de qualquer planilha ──────────────────
teste("cada banco manda de um jeito: acha cabeçalho, débito/crédito separados e ignora o saldo", () => {
  const outroBanco = [
    ["Banco XPTO - Extrato"], [],
    ["Data mov.", "Histórico", "Documento", "Débito", "Crédito", "Saldo"],
    ["01/09/2026", "TARIFA MENSALIDADE", "123", "35,00", "", "1.000,00"],
    ["02/09/2026", "TED RECEBIDA", "124", "", "2.500,00", "3.465,00"],
    ["03/09/2026", "PAGTO FORNECEDOR", "125", "1.234,56", "", "2.230,44"],
  ];
  const mapa = M.detectarColunasTabela(outroBanco);
  assert.strictEqual(mapa.linhaCabecalho, 2, "cabeçalho na terceira linha");
  assert.strictEqual(mapa.colunas.data, 0);
  assert.strictEqual(mapa.colunas.debito, 3);
  assert.strictEqual(mapa.colunas.credito, 4);
  assert.strictEqual(mapa.colunas.saldo, 5);
  assert.strictEqual(mapa.colunas.valor, undefined, "coluna de saldo não vira valor");
  const mov = M.movimentosDaTabela(outroBanco, mapa);
  assert.strictEqual(mov.length, 3);
  assert.strictEqual(mov[0].valor, -35, "débito entra negativo");
  assert.strictEqual(mov[1].valor, 2500, "crédito entra positivo");
});

teste("valor com R$, milhar e parênteses vira número; data em qualquer separador vira ano-mês-dia", () => {
  const t = [["DT", "DESCRICAO", "VLR"], ["01-09-2026", "Compra material", "R$ 1.234,56"], ["02.09.2026", "Estorno", "(R$ 100,00)"]];
  const mov = M.movimentosDaTabela(t, M.detectarColunasTabela(t));
  assert.strictEqual(mov[0].valor, 1234.56);
  assert.strictEqual(mov[1].valor, -100, "parênteses é negativo");
  assert.strictEqual(mov[0].data, "2026-09-01");
  assert.strictEqual(mov[1].data, "2026-09-02");
  assert.strictEqual(M.efValorDeTexto("1234.56"), 1234.56, "formato americano também");
  assert.strictEqual(M.efValorDeTexto("abc"), null);
});

teste("sem cabeçalho nenhum, o conteúdo entrega quem é quem", () => {
  const t = [["01/09/2026", "Pagamento pix fornecedor", "-250,00"], ["02/09/2026", "Recebimento cliente", "3.000,00"]];
  const mapa = M.detectarColunasTabela(t);
  assert.strictEqual(mapa.linhaCabecalho, -1);
  assert.ok(mapa.completo);
  assert.strictEqual(mapa.colunas.data, 0);
  assert.strictEqual(mapa.colunas.historico, 1);
  assert.strictEqual(M.movimentosDaTabela(t, mapa).length, 2);
});

teste("a planilha do escritório é reconhecida pelas mesmas regras", () => {
  const t = [
    ["#", "Cod. Cliente", "Nome Cliente", "Unidade negócio", "Projeto / obra", "Fornecedor", "Descrição Lançamento",
     "Conta contábil", "Nota / Comprovante", "Emitir nota fiscal", "Valor total nota", "Período Contábil"],
    ["1", "202229", "Obra X", "Gestão de obras", "Módulo 1", "Loja", "Cimento", "Pagamentos e compras", "4096", "Não", "780", "23/09/2026"],
  ];
  const mapa = M.detectarColunasTabela(t);
  assert.strictEqual(mapa.colunas.valor, 10, "Valor total nota");
  assert.strictEqual(mapa.colunas.data, 11, "Período Contábil");
  assert.strictEqual(mapa.colunas.historico, 6, "Descrição Lançamento");
});

// ── Conciliação com o extrato ───────────────────────────────────
teste("saldo, aplicação e a perna bloqueada do cheque não são movimento", () => {
  assert.ok(M.efEhMovimento("PIX EMITIDO OUTRA IF"));
  assert.ok(M.efEhMovimento("DÉB.CONV.SANEAMENTO"));
  assert.ok(!M.efEhMovimento("SALDO DO DIA"));
  assert.ok(!M.efEhMovimento("SALDO ANTERIOR"));
  assert.ok(!M.efEhMovimento("RESGATE RDC"));
  assert.ok(!M.efEhMovimento("DEP.CHEQUE BLOQ.1D"));
  assert.ok(M.efEhMovimento("LIBERAÇÃO DE DEPÓSITO BLOQUEADO"), "a liberação é o dinheiro entrando de verdade");
});

teste("conciliar é casar por valor: sobra o que é novo no banco e o que ainda não passou", () => {
  const movimentos = [
    { data: "2026-09-08", valor: -1886.67, abs: 1886.67, historico: "DÉB.TIT.COMPE" },
    { data: "2026-09-14", valor: -400, abs: 400, historico: "PIX empreiteiro" },
    { data: "2026-09-28", valor: -400, abs: 400, historico: "PIX empreiteiro" },
    { data: "2026-09-15", valor: 7500, abs: 7500, historico: "LIBERAÇÃO DE DEPÓSITO BLOQUEADO" },
    { data: "2026-09-14", valor: 7500, abs: 7500, historico: "DEP.CHEQUE BLOQ.1D" },
    { data: "2026-09-30", valor: 0, abs: 0, historico: "SALDO DO DIA" },
  ];
  const lancamentos = [
    { id: "a", valor: 1886.67, competencia: "2026-09", lancadoEm: "2026-09-23" },
    { id: "b", valor: 400, competencia: "2026-09", lancadoEm: "2026-09-24" },
    { id: "c", valor: 7500, competencia: "2026-09", lancadoEm: "2026-09-24" },
    { id: "d", valor: 1902.82, competencia: "2026-09", lancadoEm: "2026-09-26" },
  ];
  const r = M.conciliarExtrato(movimentos, lancamentos);
  assert.strictEqual(r.resumo.movimentos, 4);
  assert.strictEqual(r.resumo.ignoradas, 2);
  assert.strictEqual(r.resumo.casados, 3);
  assert.deepStrictEqual(r.noBancoSemPar.map((m) => m.data), ["2026-09-28"]);
  assert.deepStrictEqual(r.contabilizadoSemPar.map((l) => l.id), ["d"]);
  assert.strictEqual(r.casados.find((c) => c.lancamento.id === "b").extrato.data, "2026-09-14",
    "com dois do mesmo valor, casa o mais antigo do extrato e sobra o mais recente na fila");
  assert.strictEqual(r.resumo.valorNoBanco, 400);
});

teste("parcela arredondada para lados diferentes ainda casa, e o centavo aparece", () => {
  const banco = [{ data: "2026-09-28", valor: -1902.81, abs: 1902.81, historico: "DÉB.TIT.COMPE" }];
  const planilha = [{ id: "x", valor: 1902.82, competencia: "2026-09" }];
  const r = M.conciliarExtrato(banco, planilha);
  assert.strictEqual(r.resumo.casados, 1);
  assert.strictEqual(r.casados[0].centavos, 1);
  assert.strictEqual(M.conciliarExtrato(banco, planilha, { tolerancia: 0 }).resumo.casados, 0);
});

teste("a linha do banco vira lançamento com o que o banco já sabe", () => {
  const novo = M.lancamentoDoExtrato({ data: "2026-09-25", valor: -60, historico: "PIX · tubo passagem Ar", documento: "Pix" },
    { contaId: "pagamentos_compras", unidadeId: "gestao_obras" });
  assert.strictEqual(novo.valor, 60, "valor entra positivo: o sinal é do grupo da conta");
  assert.strictEqual(novo.competencia, "2026-09");
  assert.strictEqual(novo.lancadoEm, "2026-09-25");
  assert.strictEqual(novo.contaId, "pagamentos_compras");
  assert.strictEqual(novo.conferido, true);
  assert.strictEqual(novo.contaBanco, "sim");
  assert.strictEqual(novo.tipo, "escritorio");
});

teste("o mapa de colunas fica guardado por assinatura do arquivo", () => {
  const layouts = { "data|historico|valor": { colunas: { data: 0, valor: 2 }, visto: "2026-09-27" } };
  assert.ok(M.layoutSalvo(layouts, "data|historico|valor"));
  assert.strictEqual(M.layoutSalvo(layouts, "outro|formato"), null);
  assert.strictEqual(M.layoutSalvo(layouts, ""), null);
  assert.deepStrictEqual(M.layoutsDoEscritorio({ escritorio: { financeiro: { layouts } } }), layouts);
  assert.deepStrictEqual(M.layoutsDoEscritorio({}), {});
});


// ── Empreendimento é cliente com tique ──────────────────────────
teste("o tique no cadastro do cliente é o que faz dele um empreendimento", () => {
  const data = { clientes: [
    { id: "c1", nome: "COBOP", servicos: { gestaoObra: true } },
    { id: "c2", nome: "Casa Jardim Europa", servicos: { empreendimento: true } },
    { id: "c3", nome: "Sem serviços" },
  ] };
  assert.strictEqual(M.ehEmpreendimento(data.clientes[1]), true);
  assert.strictEqual(M.ehEmpreendimento(data.clientes[0]), false);
  assert.strictEqual(M.ehEmpreendimento(data.clientes[2]), false);
  assert.strictEqual(M.ehEmpreendimento(null), false);
  assert.deepStrictEqual(M.empreendimentosDoData(data).map((c) => c.id), ["c2"]);
  assert.strictEqual(M.nomeDoEmpreendimento(data, "c2"), "Casa Jardim Europa");
  assert.strictEqual(M.nomeDoEmpreendimento(data, "xx"), "");
  assert.deepStrictEqual(M.empreendimentosDoData({}), []);
});

teste("lançamento de empreendimento exige escolher qual, e o custo só vira lucro na venda", () => {
  const base = { contaId: "emp_construcao", unidadeId: "empreendimento", valor: 5000, competencia: "2026-09" };
  assert.ok(M.validarLancamentoEscritorio(base).some((e) => /empreendimento/i.test(e)), "sem empreendimento, recusa");
  assert.deepStrictEqual(M.validarLancamentoEscritorio({ ...base, empreendimentoId: "c2" }), []);

  const lancs = [
    { id: "1", contaId: "emp_terreno", unidadeId: "empreendimento", empreendimentoId: "c2", valor: 80000, competencia: "2026-01" },
    { id: "2", contaId: "emp_construcao", unidadeId: "empreendimento", empreendimentoId: "c2", valor: 120000, competencia: "2026-05" },
    { id: "3", contaId: "emp_construcao", unidadeId: "empreendimento", empreendimentoId: "outro", valor: 9999, competencia: "2026-05" },
  ];
  const andando = M.resultadoEmpreendimento(lancs, "c2");
  assert.strictEqual(andando.investido, 200000, "só o que é daquele empreendimento");
  assert.strictEqual(andando.resultado, null, "sem venda não há resultado");

  const comVenda = lancs.concat(
    [{ id: "4", contaId: "emp_venda", unidadeId: "empreendimento", empreendimentoId: "c2", valor: 260000, competencia: "2026-09" }]);
  const vendido = M.resultadoEmpreendimento(comVenda, "c2", { concluido: true });
  assert.strictEqual(vendido.vendido, 260000);
  assert.strictEqual(vendido.resultado, 60000, "lucro aparece de uma vez quando o empreendimento fecha");
  assert.strictEqual(vendido.parcial, false);
});

teste("o investimento em empreendimento sai do saldo do banco sem virar despesa do mês", () => {
  const lancs = [
    { contaId: "rec_projetos", competencia: "2026-09", valor: 10000 },
    { contaId: "emp_construcao", competencia: "2026-09", valor: 4000, empreendimentoId: "c2" },
  ];
  const [mes] = M.extratoEscritorio(lancs, { saldoAbertura: 0 });
  assert.strictEqual(mes.saldoEscritorio, 10000, "o custo do imóvel não é despesa do escritório");
  assert.strictEqual(mes.saldoEmpreendimento, -4000);
  assert.strictEqual(mes.saldoExtrato, 6000, "mas o dinheiro saiu da conta");
});

teste("sinal de uma unidade é recebimento, não lucro: sem fechar, não apura resultado", () => {
  const lancs = [
    { contaId: "emp_construcao", empreendimentoId: "c2", valor: 90800.67, competencia: "2026-08" },
    { contaId: "emp_venda", empreendimentoId: "c2", valor: 7000, competencia: "2026-09" },
    { contaId: "emp_venda", empreendimentoId: "c2", valor: 5000, competencia: "2026-09" },
  ];
  const emCurso = M.resultadoEmpreendimento(lancs, "c2");
  assert.strictEqual(emCurso.investido, 90800.67);
  assert.strictEqual(emCurso.recebido, 12000);
  assert.strictEqual(emCurso.parcial, true, "venda começou mas não fechou");
  assert.strictEqual(emCurso.resultado, null, "não inventa prejuízo de 78 mil com o sinal de uma casa");
  const fechado = M.resultadoEmpreendimento(lancs, "c2", { concluido: true });
  assert.strictEqual(fechado.resultado, cent(12000 - 90800.67));
  assert.strictEqual(fechado.parcial, false);
});


// \u2500\u2500 Ponte obra \u2192 escrit\u00f3rio \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

// O plano da obra mora em obra-financeiro.jsx, que n\u00e3o entra neste recorte:
// entra aqui como dado, que \u00e9 justamente como a ponte o recebe.
const PLANO_OBRA = [
  { id: "deposito_proprio",  grupo: "receitas" },
  { id: "liberacao_financ",  grupo: "receitas" },
  { id: "cartao_credito",    grupo: "receitas" },
  { id: "venda_imovel",      grupo: "receitas" },
  { id: "terreno_aquisicao", grupo: "terreno" },
  { id: "material",          grupo: "materiais" },
  { id: "frete",             grupo: "materiais" },
  { id: "pedreiros",         grupo: "maoDeObra" },
  { id: "impostos",          grupo: "servicos" },
  { id: "taxa_admin_obra",   grupo: "servicos" },
  { id: "reembolsos",        grupo: "excluidas" },
];
const OPC = { planoObra: PLANO_OBRA };
const dest = (contaId, modo) => M.destinoNoEscritorio(contaId, modo, OPC);

teste("o dono do dinheiro decide o caminho", () => {
  assert.strictEqual(M.modoDaPonte({}, { servicos: { empreendimento: true } }), "empreendimento");
  assert.strictEqual(M.modoDaPonte({ clientePagaDireto: true }, { servicos: {} }), "clientePaga");
  assert.strictEqual(M.modoDaPonte({}, { servicos: {} }), "gestao");
  assert.strictEqual(M.modoDaPonte({}, null), "gestao");
});

teste("gest\u00e3o de obras: dep\u00f3sito entra, custo sai, honor\u00e1rio vira receita", () => {
  assert.strictEqual(dest("deposito_proprio", "gestao"), "dep_consignacao");
  assert.strictEqual(dest("liberacao_financ", "gestao"), "dep_consignacao");
  assert.strictEqual(dest("material", "gestao"), "pagamentos_compras");
  assert.strictEqual(dest("frete", "gestao"), "pagamentos_compras");
  assert.strictEqual(dest("pedreiros", "gestao"), "pagamentos_compras");
  assert.strictEqual(dest("impostos", "gestao"), "pagamentos_compras");
  assert.strictEqual(dest("reembolsos", "gestao"), "reembolsos");
  assert.strictEqual(dest("taxa_admin_obra", "gestao"), "rec_gestao");
  // o que \u00e9 do empreendimento n\u00e3o entra na gest\u00e3o
  assert.strictEqual(dest("cartao_credito", "gestao"), "");
  assert.strictEqual(dest("venda_imovel", "gestao"), "");
  assert.strictEqual(dest("terreno_aquisicao", "gestao"), "");
});

teste("honor\u00e1rio atravessa mesmo quando o cliente paga tudo direto", () => {
  assert.strictEqual(dest("taxa_admin_obra", "clientePaga"), "rec_gestao");
  assert.strictEqual(dest("material", "clientePaga"), "");
  assert.strictEqual(dest("pedreiros", "clientePaga"), "");
  assert.strictEqual(dest("deposito_proprio", "clientePaga"), "");
});

teste("empreendimento: terreno, constru\u00e7\u00e3o, taxas e venda \u2014 sem honor\u00e1rio de si mesmo", () => {
  assert.strictEqual(dest("terreno_aquisicao", "empreendimento"), "emp_terreno");
  assert.strictEqual(dest("material", "empreendimento"), "emp_construcao");
  assert.strictEqual(dest("pedreiros", "empreendimento"), "emp_construcao");
  assert.strictEqual(dest("impostos", "empreendimento"), "emp_taxas");
  assert.strictEqual(dest("venda_imovel", "empreendimento"), "emp_venda");
  assert.strictEqual(dest("deposito_proprio", "empreendimento"), "emp_aporte");
  assert.strictEqual(dest("taxa_admin_obra", "empreendimento"), "");
  assert.strictEqual(dest("liberacao_financ", "empreendimento"), "");
  assert.strictEqual(dest("cartao_credito", "empreendimento"), "");
});

teste("o aporte n\u00e3o vira venda nem investimento", () => {
  const conta = M.contaEscritorio("emp_aporte");
  assert.ok(conta, "a conta existe");
  assert.strictEqual(conta.grupo, "emp_aportes");
  const g = M.grupoEscritorio("emp_aportes");
  assert.strictEqual(g.sinal, +1);
  assert.strictEqual(g.resultado, false, "dinheiro que entra para tocar a obra n\u00e3o \u00e9 resultado");
  // e a apura\u00e7\u00e3o do empreendimento continua olhando s\u00f3 venda contra investimento
  const r = M.resultadoEmpreendimento([
    { empreendimentoId: "e1", contaId: "emp_aporte",     valor: 200000 },
    { empreendimentoId: "e1", contaId: "emp_construcao", valor: 150000 },
  ], "e1", { concluido: true });
  assert.strictEqual(r.investido, 150000);
  assert.strictEqual(r.vendido, 0, "aporte n\u00e3o \u00e9 venda");
  assert.strictEqual(r.resultado, null, "sem venda n\u00e3o h\u00e1 lucro a apurar");
});

teste("a obra manda o que pagou, com a compet\u00eancia do pagamento", () => {
  const obra = { id: "ob1", clienteId: "c1", nome: "Reforma Loja Cobop" };
  const cliente = { id: "c1", nome: "COBOP", servicos: {} };
  const r = M.lancamentosDaObraParaEscritorio(obra, cliente, {
    planoObra: PLANO_OBRA,
    contasPagar: [
      { id: "a1", contaId: "material", valor: 1000, pago: true, valorPago: 1000, pagoEm: "2026-10-05",
        descricao: "Vergalh\u00e3o", favorecido: "Ourifer", numeroNota: "123" },
      { id: "a2", contaId: "taxa_admin_obra", valor: 500, pago: true, valorPago: 500, pagoEm: "2026-10-10" },
      { id: "a3", contaId: "material", valor: 300, pago: false, vencimento: "2026-11-01" },
    ],
    entradas: [{ id: "e1", contaId: "deposito_proprio", valor: 5000, data: "2026-10-01" }],
  });
  assert.strictEqual(r.modo, "gestao");
  assert.strictEqual(r.lancamentos.length, 3, "conta n\u00e3o paga n\u00e3o atravessa");
  const porConta = {};
  for (const l of r.lancamentos) porConta[l.contaId] = l;
  assert.strictEqual(porConta.pagamentos_compras.valor, 1000);
  assert.strictEqual(porConta.pagamentos_compras.competencia, "2026-10");
  assert.strictEqual(porConta.pagamentos_compras.fornecedor, "Ourifer");
  assert.strictEqual(porConta.pagamentos_compras.unidadeId, "gestao_obras");
  assert.strictEqual(porConta.pagamentos_compras.tipo, "escritorio");
  assert.strictEqual(porConta.pagamentos_compras.projeto, "Reforma Loja Cobop",
    "o extrato mostra a obra pelo nome, na coluna Cliente / obra");
  assert.strictEqual(porConta.pagamentos_compras.cliente, "COBOP");
  assert.strictEqual(porConta.pagamentos_compras.origem.refId, "a1");
  assert.strictEqual(porConta.rec_gestao.valor, 500);
  assert.strictEqual(porConta.dep_consignacao.valor, 5000);
  assert.strictEqual(r.total, 6500);
});

teste("rodar duas vezes n\u00e3o duplica: o id vem da origem", () => {
  const obra = { id: "ob1", clienteId: "c1" };
  const cliente = { id: "c1", servicos: {} };
  const base = { planoObra: PLANO_OBRA, entradas: [],
    contasPagar: [{ id: "a1", contaId: "material", valor: 1000, pago: true, valorPago: 1000, pagoEm: "2026-10-05" }] };
  const um = M.lancamentosDaObraParaEscritorio(obra, cliente, base);
  assert.strictEqual(um.lancamentos.length, 1);
  assert.strictEqual(um.lancamentos[0].id, M.idDaPonte("ob1", "conta", "a1"));
  const dois = M.lancamentosDaObraParaEscritorio(obra, cliente, { ...base, lancamentos: um.lancamentos });
  assert.strictEqual(dois.lancamentos.length, 0, "j\u00e1 foi mandado");
  assert.strictEqual(dois.existentes.length, 1);
});

// ── Uma nota, uma linha no extrato ──────────────────────────────
const PEDIDO_PAGO = [
  { id: "i1", pedidoId: "p1", contaId: "material", numeroLoja: "136560-109", numeroDoc: "0012",
    favorecido: "OURIFER", descricao: "Vergalhão 8mm", valor: 200, valorPago: 200, pago: true, pagoEm: "2026-10-05" },
  { id: "i2", pedidoId: "p1", contaId: "material", numeroLoja: "136560-109", numeroDoc: "0012",
    favorecido: "OURIFER", descricao: "Arame recozido", valor: 85.40, valorPago: 85.40, pago: true, pagoEm: "2026-10-05" },
  { id: "i3", pedidoId: "p1", contaId: "material", numeroLoja: "136560-109", numeroDoc: "0012",
    favorecido: "OURIFER", descricao: "Prego", valor: 200, valorPago: 200, pago: true, pagoEm: "2026-10-05" },
];
const OBRA_P = { id: "ob1", clienteId: "c1", nome: "Reforma Loja Cobop" };
const CLI_P = { id: "c1", nome: "COBOP", servicos: {} };
const basePonte = (contas) => ({ planoObra: PLANO_OBRA, entradas: [], contasPagar: contas });

teste("o pedido atravessa como UMA linha, com o total dos itens", () => {
  const r = M.lancamentosDaObraParaEscritorio(OBRA_P, CLI_P, basePonte(PEDIDO_PAGO));
  assert.strictEqual(r.lancamentos.length, 1, "o banco debitou a nota, nao os tres itens");
  const l = r.lancamentos[0];
  assert.strictEqual(l.valor, 485.40, "o extrato so confere se bater com o debito");
  assert.strictEqual(l.fornecedor, "OURIFER");
  assert.strictEqual(l.numeroDoc, "0012");
  assert.strictEqual(l.documento, "136560-109");
  assert.ok(/136560-109/.test(l.descricao) && /3 itens/.test(l.descricao), l.descricao);
});

teste("o que ja atravessou item a item nao atravessa de novo agrupado", () => {
  const antigos = PEDIDO_PAGO.map((c) => ({ id: M.idDaPonte("ob1", "conta", c.id) }));
  const r = M.lancamentosDaObraParaEscritorio(OBRA_P, CLI_P,
    { ...basePonte(PEDIDO_PAGO), lancamentos: antigos });
  assert.strictEqual(r.lancamentos.length, 0, "senao o escritorio contaria o gasto duas vezes");
  assert.strictEqual(r.existentes.length, 1);
});

teste("rodar duas vezes com o agrupamento tambem nao duplica", () => {
  const um = M.lancamentosDaObraParaEscritorio(OBRA_P, CLI_P, basePonte(PEDIDO_PAGO));
  const dois = M.lancamentosDaObraParaEscritorio(OBRA_P, CLI_P,
    { ...basePonte(PEDIDO_PAGO), lancamentos: um.lancamentos });
  assert.strictEqual(dois.lancamentos.length, 0);
});

teste("itens do mesmo pedido pagos em datas diferentes sao debitos diferentes", () => {
  const contas = PEDIDO_PAGO.map((c, i) => i === 2 ? { ...c, pagoEm: "2026-10-20" } : c);
  const r = M.lancamentosDaObraParaEscritorio(OBRA_P, CLI_P, basePonte(contas));
  assert.strictEqual(r.lancamentos.length, 2);
  assert.deepStrictEqual(r.lancamentos.map((l) => l.valor).sort((a, b) => a - b), [200, 285.40]);
});

teste("pedido que mistura contas do plano nao cabe numa linha so", () => {
  const contas = PEDIDO_PAGO.map((c, i) => i === 2 ? { ...c, contaId: "taxa_admin_obra" } : c);
  const r = M.lancamentosDaObraParaEscritorio(OBRA_P, CLI_P, basePonte(contas));
  assert.strictEqual(r.lancamentos.length, 2, "o destino no escritorio e outro");
  const porConta = {};
  for (const l of r.lancamentos) porConta[l.contaId] = l.valor;
  assert.strictEqual(porConta.pagamentos_compras, 285.40);
  assert.strictEqual(porConta.rec_gestao, 200);
});

teste("item solto de pedido continua com o id de ponte que sempre teve", () => {
  const r = M.lancamentosDaObraParaEscritorio(OBRA_P, CLI_P, basePonte([PEDIDO_PAGO[0]]));
  assert.strictEqual(r.lancamentos[0].id, M.idDaPonte("ob1", "conta", "i1"),
    "um item so nao e grupo — e o que ja atravessou assim nao pode virar linha nova");
});

teste("conta sem pedido segue uma a uma", () => {
  const f = M.fontesDasContasPagas([
    { id: "a1", contaId: "material", valor: 100, pago: true, pagoEm: "2026-10-05" },
    { id: "a2", contaId: "material", valor: 50, pago: true, pagoEm: "2026-10-05" },
    { id: "a3", contaId: "material", valor: 70, pago: false },
  ]);
  assert.strictEqual(f.length, 2, "conta nao paga nao atravessa");
  assert.deepStrictEqual(f.map((x) => x.tipo), ["conta", "conta"]);
});

// ── Cartão de crédito: a compra, a fatura e o banco ────────────
const CARTAO = { id: "k1", nome: "Sicoob Empresarial", diaFechamento: 20, diaVencimento: 1 };

teste("comprou antes do fechamento, cai na fatura do mes; no dia ou depois, na seguinte", () => {
  assert.strictEqual(M.faturaDaCompra(CARTAO, "2026-09-19"), "2026-09");
  assert.strictEqual(M.faturaDaCompra(CARTAO, "2026-09-20"), "2026-10", "no dia do fechamento ja e a seguinte");
  assert.strictEqual(M.faturaDaCompra(CARTAO, "2026-09-23"), "2026-10");
  assert.strictEqual(M.faturaDaCompra(CARTAO, "2026-12-28"), "2027-01", "vira o ano");
  assert.strictEqual(M.faturaDaCompra(CARTAO, ""), "");
});

teste("a vista no cartao e uma parcela so, na fatura em que caiu", () => {
  const p = M.parcelasDoCartao(CARTAO, "2026-09-23", 7200, 1);
  assert.strictEqual(p.length, 1);
  assert.strictEqual(p[0].competencia, "2026-10");
  assert.strictEqual(p[0].valor, 7200);
});

teste("parcelado anda mes a mes e fecha no centavo", () => {
  const p = M.parcelasDoCartao(CARTAO, "2026-09-23", 1000, 3);
  assert.deepStrictEqual(p.map((x) => x.competencia), ["2026-10", "2026-11", "2026-12"]);
  assert.deepStrictEqual(p.map((x) => x.valor), [333.33, 333.33, 333.34],
    "o residuo vai na ultima, senao a soma nao fecha na compra");
  assert.strictEqual(M.totalDaFatura(p), 1000);
});

teste("o custo da obra e integral na data da compra, nao nas parcelas", () => {
  const conta = { id: "c1", valor: 1000, descricao: "Concreto" };
  const r = M.pagamentoNoCartao(conta, CARTAO, { pagoEm: "2026-09-23", valorPago: 1000, parcelas: 3 });
  assert.strictEqual(r.formaPagamento, "cartao");
  assert.strictEqual(r.cartaoId, "k1");
  assert.strictEqual(r.parcelasCartao.length, 3);
  // quem grava `pagoEm` e a baixa; o que importa aqui e que o plano nao mexe nisso
  assert.ok(!("pagoEm" in r), "a data da compra e da baixa, o cartao nao a desloca");
});

teste("a fatura junta as parcelas daquela competencia, de qualquer obra", () => {
  const obras = [
    { id: "o1", nome: "Jacarezinho M1", contasPagar: [
      { id: "a", cartaoId: "k1", contaId: "material", descricao: "Concreto", favorecido: "Votorantim",
        pagoEm: "2026-09-23", numeroDoc: "0130",
        parcelasCartao: [{ parcela:1, de:3, competencia:"2026-10", valor:1000 },
                         { parcela:2, de:3, competencia:"2026-11", valor:1000 },
                         { parcela:3, de:3, competencia:"2026-12", valor:1000 }] },
      { id: "b", cartaoId: "k1", contaId: "material", descricao: "Lajes", favorecido: "TONET",
        pagoEm: "2026-09-25", numeroDoc: "0132",
        parcelasCartao: [{ parcela:1, de:1, competencia:"2026-10", valor:7200 }] },
      { id: "c", cartaoId: "outro", contaId: "material", descricao: "De outro cartao",
        pagoEm: "2026-09-25", parcelasCartao: [{ parcela:1, de:1, competencia:"2026-10", valor:999 }] },
    ] },
    { id: "o2", nome: "Jacarezinho M2", contasPagar: [
      { id: "d", cartaoId: "k1", contaId: "material", descricao: "Cimento", favorecido: "Rei do Cimento",
        pagoEm: "2026-09-22", parcelasCartao: [{ parcela:1, de:1, competencia:"2026-10", valor:300 }] },
    ] },
  ];
  const lanc = [{ id: "L1", cartaoId: "k1", contaId: "pagamentos_compras", descricao: "Papelaria",
    lancadoEm: "2026-09-24", parcelasCartao: [{ parcela:1, de:1, competencia:"2026-10", valor:120 }] }];
  const linhas = M.linhasDaFatura(obras, lanc, "k1", "2026-10");
  assert.strictEqual(linhas.length, 4, "duas obras mais o escritorio; o outro cartao fica de fora");
  assert.strictEqual(M.totalDaFatura(linhas), 8620);
  assert.ok(linhas.some((l) => l.origem === "escritorio" && l.valor === 120));
  assert.ok(!linhas.some((l) => l.descricao === "De outro cartao"));
  // novembro leva so a segunda parcela do concreto
  const nov = M.linhasDaFatura(obras, lanc, "k1", "2026-11");
  assert.strictEqual(nov.length, 1);
  assert.strictEqual(M.totalDaFatura(nov), 1000);
  assert.strictEqual(nov[0].parcela, 2);
  assert.deepStrictEqual(M.competenciasDoCartao(obras, lanc, "k1"), ["2026-10", "2026-11", "2026-12"]);
});

teste("a fatura vira UMA linha no extrato, com o total e a composicao por dentro", () => {
  const linhas = [
    { obra: "Jacarezinho M1", descricao: "Concreto", fornecedor: "Votorantim", contaId: "material", parcela:1, de:3, valor: 1000 },
    { obra: "Jacarezinho M1", descricao: "Lajes", fornecedor: "TONET", contaId: "material", parcela:1, de:1, valor: 7200 },
  ];
  const l = M.lancamentoDaFatura(CARTAO, "2026-10", linhas, {});
  assert.strictEqual(l.valor, 8200, "o banco debitou isto, e so isto");
  assert.strictEqual(l.contaId, "cartao_credito");
  assert.strictEqual(l.unidadeId, "escritorio");
  assert.strictEqual(l.lancadoEm, "2026-10-01", "o dia do vencimento do cartao");
  assert.strictEqual(l.competencia, "2026-10");
  assert.strictEqual(l.linhas.length, 2, "a composicao fica guardada para conferencia");
  assert.ok(/Sicoob Empresarial/.test(l.descricao) && /2 compras/.test(l.descricao), l.descricao);
});

teste("lancar a mesma fatura duas vezes nao cria duas linhas", () => {
  const linhas = [{ descricao: "x", valor: 100 }];
  const a = M.lancamentoDaFatura(CARTAO, "2026-10", linhas, {});
  const b = M.lancamentoDaFatura(CARTAO, "2026-10", linhas, {});
  assert.strictEqual(a.id, b.id);
  assert.strictEqual(a.id, M.idDaFatura("k1", "2026-10"));
});

teste("fatura vazia nao vira lancamento", () => {
  assert.strictEqual(M.lancamentoDaFatura(CARTAO, "2026-10", [], {}), null);
  assert.strictEqual(M.totalDaFatura([]), 0);
});

// ── Fechar a fatura: o mês mais o que ficou para trás ──────────
const OBRAS_CT = [{ id: "o1", nome: "Jacarezinho M1", contasPagar: [
  { id: "a", cartaoId: "k1", contaId: "material", descricao: "Concreto", pagoEm: "2026-09-23",
    parcelasCartao: [{ parcela:1, de:2, competencia:"2026-09", valor:500 },
                     { parcela:2, de:2, competencia:"2026-10", valor:500 }] },
  { id: "b", cartaoId: "k1", contaId: "material", descricao: "Lajes", pagoEm: "2026-10-02",
    parcelasCartao: [{ parcela:1, de:1, competencia:"2026-10", valor:7200 }] },
]}];

teste("fechar o mes leva as parcelas do mes", () => {
  const f = M.faturaParaFechar(CARTAO, OBRAS_CT, [], "2026-09");
  assert.strictEqual(f.total, 500);
  assert.strictEqual(f.atrasadas.length, 0);
  assert.strictEqual(f.jaFechada, false);
});

teste("compra lancada com atraso entra na proxima fatura, marcada como atrasada", () => {
  // setembro ja foi fechado; so depois alguem lancou uma compra de setembro
  const setFechado = [M.lancamentoDaFatura(CARTAO, "2026-09", [{ descricao:"x", valor:500 }], {})];
  const f = M.faturaParaFechar(CARTAO, OBRAS_CT, setFechado, "2026-10");
  assert.strictEqual(f.totalDoMes, 7700, "lajes 7200 + a 2a parcela do concreto 500");
  assert.strictEqual(f.atrasadas.length, 0, "setembro esta fechado, nao volta");
  assert.strictEqual(f.total, 7700);
});

teste("o mes anterior em aberto e varrido junto — nao deixa parcela orfa", () => {
  const f = M.faturaParaFechar(CARTAO, OBRAS_CT, [], "2026-10");
  assert.strictEqual(f.totalAtrasado, 500, "a parcela de setembro, que nunca foi fechada");
  assert.strictEqual(f.totalDoMes, 7700);
  assert.strictEqual(f.total, 8200);
  assert.ok(f.atrasadas.every((l) => l.atrasada && l.competenciaOriginal === "2026-09"));
});

teste("fatura ja fechada se reconhece, para nao lancar duas vezes", () => {
  const out = [M.lancamentoDaFatura(CARTAO, "2026-10", [{ descricao:"x", valor:8200 }], {})];
  const f = M.faturaParaFechar(CARTAO, OBRAS_CT, out, "2026-10");
  assert.strictEqual(f.jaFechada, true);
});

teste("fechadas sao lidas pela origem do lancamento, nao pelo texto", () => {
  const l = M.lancamentoDaFatura(CARTAO, "2026-10", [{ descricao:"x", valor:10 }], {});
  assert.strictEqual(l.origem.tipo, "fatura");
  assert.strictEqual(l.origem.cartaoId, "k1");
  assert.strictEqual(l.origem.competencia, "2026-10");
});

teste("conta paga no cartao nao atravessa na baixa — so a fatura atravessa", () => {
  // empreendimento: a baixa atravessa sozinha. Menos no cartao.
  const obra = { id: "ob1", clienteId: "c1", nome: "Jacarezinho M1" };
  const emp = { id: "c1", nome: "Padovan", servicos: { empreendimento: true } };
  const noCartao = { id: "k1", contaId: "material", valor: 5326.88, valorPago: 5326.88, pago: true,
    pagoEm: "2026-09-23", formaPagamento: "cartao", cartaoId: "sicoob",
    parcelasCartao: [{ parcela:1, de:1, competencia:"2026-10", valor:5326.88 }] };
  const aVista = { id: "k2", contaId: "material", valor: 100, valorPago: 100, pago: true, pagoEm: "2026-09-23" };
  const r = M.lancamentosDaBaixa(obra, emp, [noCartao, aVista], { planoObra: PLANO_OBRA });
  assert.strictEqual(r.lancamentos.length, 1, "so a compra a vista atravessa");
  assert.strictEqual(r.lancamentos[0].valor, 100);
  const ig = r.ignorados.find((x) => x.origem === "k1");
  assert.ok(ig, "a do cartao aparece em ignorados");
  assert.ok(/fatura/.test(ig.motivo), ig.motivo);
});

teste("o painel da obra tambem nao manda conta paga no cartao", () => {
  const r = M.lancamentosDaObraParaEscritorio(
    { id: "ob1", clienteId: "c1", nome: "Obra" }, { id: "c1", servicos: { empreendimento: true } },
    { planoObra: PLANO_OBRA, entradas: [], contasPagar: [
      { id: "a", contaId: "material", valor: 1000, valorPago: 1000, pago: true, pagoEm: "2026-09-23",
        formaPagamento: "cartao", cartaoId: "k1" }] });
  assert.strictEqual(r.lancamentos.length, 0);
  assert.strictEqual(r.total, 0);
});

teste("a fatura nao copia o papel da compra de obra; o do proprio escritorio continua", () => {
  const nota = { public_id: "n1", url: "https://x/nota.pdf", nome: "4177.pdf", tipo: "nota" };
  const meu = { public_id: "e1", url: "https://x/recibo.pdf", nome: "recibo.pdf", tipo: "comprovante" };
  const obras = [{ id: "o1", nome: "Jacarezinho M1", contasPagar: [
    { id: "a", cartaoId: "k1", contaId: "material", descricao: "Concreto", pagoEm: "2026-09-23",
      comprovante: nota,
      parcelasCartao: [{ parcela:1, de:2, competencia:"2026-10", valor:500 },
                       { parcela:2, de:2, competencia:"2026-11", valor:500 }] },
  ]}];
  const doEscritorio = [{ id: "l1", tipo: "escritorio", cartaoId: "k1", contaId: "softwares", descricao: "Assinatura",
    lancadoEm: "2026-09-23", anexos: [meu], parcelasCartao: [{ parcela: 1, de: 1, competencia: "2026-10", valor: 50 }] }];
  const linhas = M.linhasDaFatura(obras, doEscritorio, "k1", "2026-10");
  const daObra = linhas.find((x) => x.origem === "obra"), doEsc = linhas.find((x) => x.origem === "escritorio");
  assert.strictEqual(daObra.anexos.length, 0, "o papel da obra fica na obra");
  assert.strictEqual(doEsc.anexos.length, 1, "o que foi anexado no escritorio continua");
  const l = M.lancamentoDaFatura(CARTAO, "2026-10", linhas, {});
  assert.deepStrictEqual(l.anexos.map((x) => x.nome), ["recibo.pdf"]);
});

teste("compra no cartao nao atravessa sozinha para o escritorio", () => {
  // quem atravessa e a fatura; a compra viraria uma linha que o banco nunca debitou
  const r = M.lancamentosDaObraParaEscritorio(
    { id: "ob1", clienteId: "c1", nome: "Obra" }, { id: "c1", servicos: {} },
    { planoObra: PLANO_OBRA, entradas: [], contasPagar: [
      { id: "a", contaId: "cartao_credito", valor: 1000, valorPago: 1000, pago: true, pagoEm: "2026-09-23" }] });
  assert.strictEqual(r.lancamentos.length, 0);
  assert.ok(r.ignorados.some((x) => /cart[ãa]o/i.test(x.motivo)), JSON.stringify(r.ignorados));
});

teste("m\u00eas fechado n\u00e3o recebe lan\u00e7amento \u2014 fica separado, com o motivo", () => {
  const r = M.lancamentosDaObraParaEscritorio({ id: "ob1", clienteId: "c1" }, { id: "c1", servicos: {} }, {
    planoObra: PLANO_OBRA,
    fechamentos: { "2026-08": { fechadoEm: "2026-09-02" } },
    contasPagar: [
      { id: "a1", contaId: "material", valor: 800, pago: true, valorPago: 800, pagoEm: "2026-08-20" },
      { id: "a2", contaId: "material", valor: 900, pago: true, valorPago: 900, pagoEm: "2026-10-20" },
    ],
  });
  assert.strictEqual(r.lancamentos.length, 1);
  assert.strictEqual(r.lancamentos[0].valor, 900);
  assert.strictEqual(r.bloqueados.length, 1);
  assert.strictEqual(r.bloqueados[0].competencia, "2026-08");
  assert.strictEqual(r.totalBloqueado, 800);
  assert.ok(/fechado/i.test(r.bloqueados[0].motivo));
});

teste("o que n\u00e3o atravessa volta dito, n\u00e3o some", () => {
  const r = M.lancamentosDaObraParaEscritorio({ id: "ob1", clienteId: "c1", clientePagaDireto: true },
    { id: "c1", servicos: {} }, {
      planoObra: PLANO_OBRA,
      contasPagar: [
        { id: "a1", contaId: "material", valor: 1000, pago: true, valorPago: 1000, pagoEm: "2026-10-05" },
        { id: "a2", contaId: "taxa_admin_obra", valor: 500, pago: true, valorPago: 500, pagoEm: "2026-10-10" },
        { id: "a3", contaId: "cartao_credito", valor: 700, pago: true, valorPago: 700, pagoEm: "2026-10-11" },
      ],
    });
  assert.strictEqual(r.modo, "clientePaga");
  assert.strictEqual(r.lancamentos.length, 1, "s\u00f3 o honor\u00e1rio");
  assert.strictEqual(r.lancamentos[0].contaId, "rec_gestao");
  assert.strictEqual(r.ignorados.length, 2);
  assert.ok(r.ignorados.every((x) => x.motivo), "cada ignorado diz por qu\u00ea");
});

teste("empreendimento carimba o empreendimento, n\u00e3o a obra", () => {
  const r = M.lancamentosDaObraParaEscritorio({ id: "ob9", clienteId: "e1" },
    { id: "e1", servicos: { empreendimento: true } }, {
      planoObra: PLANO_OBRA,
      contasPagar: [
        { id: "a1", contaId: "terreno_aquisicao", valor: 120000, pago: true, valorPago: 120000, pagoEm: "2026-03-10" },
        { id: "a2", contaId: "pedreiros", valor: 20000, pago: true, valorPago: 20000, pagoEm: "2026-06-10" },
        { id: "a3", contaId: "venda_imovel", valor: 400000, pago: true, valorPago: 400000, pagoEm: "2026-12-10" },
      ],
    });
  assert.strictEqual(r.modo, "empreendimento");
  assert.deepStrictEqual(r.lancamentos.map((l) => l.contaId).sort(),
    ["emp_construcao", "emp_terreno", "emp_venda"]);
  assert.ok(r.lancamentos.every((l) => l.unidadeId === "empreendimento"));
  assert.ok(r.lancamentos.every((l) => l.empreendimentoId === "e1"),
    "no empreendimento o carimbo \u00e9 o empreendimento, e \u00e9 por ele que a apura\u00e7\u00e3o soma");
});

teste("sem data de pagamento n\u00e3o vira lan\u00e7amento", () => {
  const r = M.lancamentosDaObraParaEscritorio({ id: "ob1", clienteId: "c1" }, { id: "c1", servicos: {} }, {
    planoObra: PLANO_OBRA,
    contasPagar: [{ id: "a1", contaId: "material", valor: 100, pago: true, valorPago: 100, pagoEm: "" }],
  });
  assert.strictEqual(r.lancamentos.length, 0);
  assert.strictEqual(r.ignorados.length, 1);
  assert.ok(/data/i.test(r.ignorados[0].motivo));
});

teste("obra vazia n\u00e3o quebra", () => {
  const r = M.lancamentosDaObraParaEscritorio(null, null, { planoObra: PLANO_OBRA });
  assert.deepStrictEqual([r.lancamentos.length, r.ignorados.length, r.total], [0, 0, 0]);
});

teste("o lan\u00e7amento que a ponte gera passa na valida\u00e7\u00e3o do escrit\u00f3rio", () => {
  const r = M.lancamentosDaObraParaEscritorio(
    { id: "ob1", clienteId: "c1", nome: "Reforma Loja Cobop" },
    { id: "c1", nome: "COBOP", servicos: {} },
    { planoObra: PLANO_OBRA,
      contasPagar: [{ id: "a1", contaId: "material", valor: 1000, pago: true, valorPago: 1000, pagoEm: "2026-10-05" }] });
  const l = r.lancamentos[0];
  // a valida\u00e7\u00e3o pede obraId; na grava\u00e7\u00e3o ele vem do campo "projeto"
  const erros = M.validarLancamentoEscritorio({ ...l, obraId: l.projeto }, {});
  assert.deepStrictEqual(erros, [], "sen\u00e3o o lan\u00e7amento nasceria recusado");

  const emp = M.lancamentosDaObraParaEscritorio(
    { id: "ob9", clienteId: "e1", nome: "Casa Jardim Europa" },
    { id: "e1", nome: "Jardim Europa", servicos: { empreendimento: true } },
    { planoObra: PLANO_OBRA,
      contasPagar: [{ id: "a1", contaId: "pedreiros", valor: 2000, pago: true, valorPago: 2000, pagoEm: "2026-10-05" }] });
  assert.deepStrictEqual(M.validarLancamentoEscritorio(emp.lancamentos[0], {}), []);
});

// ── A baixa atravessando sozinha ────────────────────────────────

const EMP = { id: "c9", nome: "Jacarezinho Módulo 1", servicos: { empreendimento: true } };
const CLI = { id: "c1", nome: "COBOP", servicos: { gestaoObra: true } };
const OBRA = { id: "ob1", nome: "Jacarezinho Módulo 1" };

const conta = (id, contaId, valor) => ({
  id, contaId, pago: true, pagoEm: "2026-09-28",
  valor, valorPago: valor, descricao: "AREIA FINA", favorecido: "Rei do Cimento",
  numeroNota: "8623",
});

teste("a ponte leva a referencia, mas nao o comprovante da obra", () => {
  const c = { ...conta("k9", "material", 100), anexos: [{ url: "u", public_id: "p", nome: "4204.pdf", tipo: "nota" }], numeroDoc: "0158" };
  const l = M.lancamentosDaBaixa(OBRA, EMP, [c], { ...OPC }).lancamentos[0];
  assert.strictEqual(l.numeroDoc, "0158");
  assert.deepStrictEqual(l.anexos, []);
});

teste("no empreendimento a baixa vai sozinha para Construção", () => {
  const r = M.lancamentosDaBaixa(OBRA, EMP, [conta("k1", "material", 304)], { ...OPC });
  assert.strictEqual(r.modo, "empreendimento");
  assert.strictEqual(r.lancamentos.length, 1);
  const l = r.lancamentos[0];
  assert.strictEqual(l.contaId, "emp_construcao");
  assert.strictEqual(l.unidadeId, "empreendimento");
  assert.strictEqual(l.empreendimentoId, "c9", "é por aqui que o quadro do empreendimento soma");
  assert.strictEqual(l.valor, 304);
  assert.strictEqual(l.documento, "8623", "a nota identifica o lançamento");
  assert.strictEqual(l.competencia, "2026-09");
});

teste("na gestão a baixa vai sozinha para Pagamentos e compras", () => {
  const r = M.lancamentosDaBaixa(OBRA, CLI, [conta("k1", "material", 304)], { ...OPC });
  assert.strictEqual(r.modo, "gestao");
  assert.strictEqual(r.lancamentos[0].contaId, "pagamentos_compras");
  assert.strictEqual(r.lancamentos[0].unidadeId, "gestao_obras");
});

teste("obra em que o cliente paga direto: a baixa atravessa, mas só o que é do escritório", () => {
  // O botão de mandar em lote saiu: a baixa é a única rota, em qualquer
  // modo. Quem filtra é o destino — material que o cliente pagou direto não
  // tem destino no escritório e continua de fora.
  assert.strictEqual(M.ponteAutomaticaNaBaixa("clientePaga"), true, "a rota existe");
  const r = M.lancamentosDaBaixa({ ...OBRA, clientePagaDireto: true }, CLI, [conta("k1", "material", 304)], { ...OPC });
  assert.strictEqual(r.modo, "clientePaga");
  assert.strictEqual(r.lancamentos.length, 0, "o dinheiro do material não passou pela conta do escritório");
  assert.ok(r.ignorados.length, "e isso aparece como ignorado, com o motivo");
});

teste("só as recém-pagas atravessam — o histórico importado não volta", () => {
  // A obra tem meses de contas pagas; a baixa de hoje manda UMA.
  const hoje = conta("k9", "material", 304);
  const r = M.lancamentosDaBaixa(OBRA, EMP, [hoje], { ...OPC });
  assert.strictEqual(r.lancamentos.length, 1);
  assert.strictEqual(r.lancamentos[0].origem.refId, "k9");
});

teste("o mesmo lançamento não entra duas vezes", () => {
  const c = conta("k1", "material", 304);
  const primeiro = M.lancamentosDaBaixa(OBRA, EMP, [c], { ...OPC });
  const denovo = M.lancamentosDaBaixa(OBRA, EMP, [c], { ...OPC, lancamentos: primeiro.lancamentos });
  assert.strictEqual(denovo.lancamentos.length, 0);
  assert.strictEqual(denovo.existentes.length, 1);
});

teste("mês fechado segura o lançamento em vez de furar o fechamento", () => {
  const r = M.lancamentosDaBaixa(OBRA, EMP, [conta("k1", "material", 304)],
    { ...OPC, fechamentos: { "2026-09": { fechadoEm: "2026-10-01" } } });
  assert.strictEqual(r.lancamentos.length, 0);
  assert.strictEqual(r.bloqueados.length, 1);
  assert.ok(/fechado/i.test(r.bloqueados[0].motivo));
});

teste("conta sem destino no escritório não vira lançamento", () => {
  const r = M.lancamentosDaBaixa(OBRA, EMP, [conta("k1", "cartao_credito", 100)], { ...OPC });
  assert.strictEqual(r.lancamentos.length, 0);
  assert.ok(r.ignorados.length >= 1, "e volta na lista de ignoradas, com o motivo");
});

teste("sem conta paga nenhuma, nada acontece", () => {
  assert.strictEqual(M.lancamentosDaBaixa(OBRA, EMP, [], { ...OPC }).lancamentos.length, 0);
  assert.strictEqual(M.lancamentosDaBaixa(OBRA, EMP, null, { ...OPC }).lancamentos.length, 0);
});


teste("conta que sai da obra leva o lançamento dela junto", () => {
  // Relançar um pedido pago apaga as contas e cria outras com ids novos: sem
  // isto o lançamento velho ficava somando o mesmo dinheiro duas vezes.
  const antigo = M.lancamentosDaBaixa(OBRA, EMP, [conta("k1", "material", 260)], { ...OPC }).lancamentos;
  assert.strictEqual(antigo.length, 1);
  const r = M.semLancamentosDasContas(antigo, "ob1", [{ id: "k1" }]);
  assert.strictEqual(r.lancamentos.length, 0);
  assert.strictEqual(r.removidos, 1);
});

teste("apagar a nota inteira leva a linha agrupada do extrato (o caso do pedido 8623)", () => {
  const itens = ["a", "b", "c"].map((id) => ({ ...conta(id, "material", 100), pedidoId: "mzil9s0", obraId: "ob1" }));
  const lancs = M.lancamentosDaBaixa(OBRA, EMP, itens, { ...OPC }).lancamentos;
  assert.strictEqual(lancs.length, 1, "uma nota, uma linha");
  assert.strictEqual(lancs[0].origem.tipo, "pedido");
  const r = M.semLancamentosDasContas(lancs, "ob1", itens, []);
  assert.strictEqual(r.lancamentos.length, 0, "antes só a conta solta saía; a nota ficava órfã");
  assert.strictEqual(r.removidos, 1);
});

teste("saiu PARTE da nota: a linha sai e o que sobrou volta pela ponte com o valor novo", () => {
  const itens = ["a", "b", "c"].map((id) => ({ ...conta(id, "material", 100), pedidoId: "p1", obraId: "ob1" }));
  const lancs = M.lancamentosDaBaixa(OBRA, EMP, itens, { ...OPC }).lancamentos;
  const r = M.semLancamentosDasContas(lancs, "ob1", [itens[0]], itens.slice(1));
  assert.strictEqual(r.lancamentos.length, 0);
  assert.deepStrictEqual(r.reenviar.map((c) => c.id), ["b", "c"]);
  const de_novo = M.lancamentosDaBaixa(OBRA, EMP, r.reenviar, { ...OPC, lancamentos: r.lancamentos }).lancamentos;
  assert.strictEqual(de_novo.length, 1);
  assert.strictEqual(de_novo[0].valor, 200);
});

teste("lançamento antigo ligado pelo número do papel também sai junto", () => {
  const l = { id: "imp_1", tipo: "escritorio", valor: 621.69, competencia: "2026-09", origem: { obraId: "ob1", tipo: "doc", refId: "4204" } };
  const contas = [{ id: "x1", doc: "4204", pago: true, obraId: "ob1" }, { id: "x2", doc: "4204", pago: true }, { id: "x3", doc: "4205", pago: true }];
  assert.strictEqual(M.ligaContaAoLancamento(l, "ob1", contas[0]), true);
  assert.strictEqual(M.ligaContaAoLancamento(l, "ob2", contas[0]), false, "outra obra não");
  assert.strictEqual(M.ligaContaAoLancamento(l, "ob1", contas[2]), false);
  assert.deepStrictEqual(M.contasLigadasAoLancamento({ id: "ob1", contasPagar: contas }, l).map((c) => c.id), ["x1", "x2"]);
  const r = M.semLancamentosDasContas([l], "ob1", [contas[0]], contas.slice(1));
  assert.strictEqual(r.removidos, 1);
  assert.deepStrictEqual(r.reenviar.map((c) => c.id), ["x2"]);
});

teste("do escritório para a obra: o pedido devolve só os itens daquela linha", () => {
  const obra = { id: "ob1", contasPagar: [
    { id: "a", pedidoId: "p1", contaId: "material", pagoEm: "2026-09-29" },
    { id: "b", pedidoId: "p1", contaId: "material", pagoEm: "2026-09-29" },
    { id: "c", pedidoId: "p1", contaId: "frete", pagoEm: "2026-09-29" },
    { id: "d", pedidoId: "p2", contaId: "material", pagoEm: "2026-09-29" },
  ] };
  const l = { origem: { obraId: "ob1", tipo: "pedido", refId: "p1|material|2026-09-29" } };
  assert.deepStrictEqual(M.contasLigadasAoLancamento(obra, l).map((c) => c.id), ["a", "b"]);
  assert.deepStrictEqual(M.contasLigadasAoLancamento(obra, { origem: { obraId: "ob1", tipo: "conta", refId: "d" } }).map((c) => c.id), ["d"]);
  assert.deepStrictEqual(M.contasLigadasAoLancamento(obra, { origem: { obraId: "outra", tipo: "conta", refId: "d" } }), []);
  assert.deepStrictEqual(M.contasLigadasAoLancamento(obra, {}), []);
});

teste("conta de OUTRA obra com o mesmo id não é tocada", () => {
  const meu = M.lancamentosDaBaixa(OBRA, EMP, [conta("k1", "material", 260)], { ...OPC }).lancamentos;
  const r = M.semLancamentosDasContas(meu, "ob-outra", [{ id: "k1" }]);
  assert.strictEqual(r.lancamentos.length, 1, "o id da ponte carrega a obra — e é por isso que carrega");
  assert.strictEqual(r.removidos, 0);
});

teste("sem conta removida, a lista volta intacta", () => {
  const meu = M.lancamentosDaBaixa(OBRA, EMP, [conta("k1", "material", 260)], { ...OPC }).lancamentos;
  assert.strictEqual(M.semLancamentosDasContas(meu, "ob1", []).lancamentos.length, 1);
  assert.strictEqual(M.semLancamentosDasContas(meu, "ob1", null).removidos, 0);
  assert.strictEqual(M.semLancamentosDasContas(null, "ob1", [{ id: "k1" }]).lancamentos.length, 0);
});

teste("o lançamento da ponte nasce com a hora, para ir ao topo da lista", () => {
  const l = M.lancamentosDaBaixa(OBRA, EMP, [conta("k1", "material", 260)], { ...OPC }).lancamentos[0];
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(l.criadoEm), "criadoEm: " + l.criadoEm);
});


// ── A fatura no resultado: abre nas compras, sem mexer no saldo ──
const OBRAS_RES = [
  { id: "ob1", nome: "Jacarezinho Módulo 1", clienteId: "c9", contasPagar: [
    { id: "cc", cartaoId: "k1", contaId: "material", descricao: "Concreto", favorecido: "Votorantim", pagoEm: "2026-09-23",
      parcelasCartao: [{ parcela:1, de:3, competencia:"2026-10", valor:1775.63 }] } ] },
  { id: "ob2", nome: "Loja COBOP", clienteId: "c1", contasPagar: [
    { id: "cb", cartaoId: "k1", contaId: "material", descricao: "Tinta", favorecido: "Loja", pagoEm: "2026-09-25",
      parcelasCartao: [{ parcela:1, de:1, competencia:"2026-10", valor:200 }] } ] },
];
const LANC_RES = [{ id: "E1", tipo: "escritorio", unidadeId: "escritorio", contaId: "marketing", descricao: "Anúncio",
  lancadoEm: "2026-09-24", competencia: "2026-09", valor: 300, cartaoId: "k1",
  parcelasCartao: [{ parcela:1, de:1, competencia:"2026-10", valor:300 }] }];
const OPC_RES = { clientes: [EMP, CLI], planoObra: PLANO_OBRA };
const faturaRes = () => {
  const f = M.faturaParaFechar(CARTAO, OBRAS_RES, LANC_RES, "2026-10", OPC_RES);
  return M.lancamentoDaFatura(CARTAO, "2026-10", f.linhas, {});
};

teste("cada compra da fatura sabe para onde vai no escritório", () => {
  const l = faturaRes();
  const por = (d) => l.linhas.find((x) => x.descricao === d);
  assert.strictEqual(por("Concreto").destinoContaId, "emp_construcao");
  assert.strictEqual(por("Concreto").empreendimentoId, "c9");
  assert.strictEqual(por("Tinta").destinoContaId, "pagamentos_compras");
  assert.strictEqual(por("Anúncio").destinoContaId, "marketing");
});

teste("no resultado a fatura abre nas compras; no saldo nada muda", () => {
  const fat = faturaRes();
  const fechado = { ...fat, linhas: fat.linhas.map((x) => ({ ...x, destinoContaId: "" })) };
  const comAberta = M.extratoEscritorio([fat], { saldoAbertura: 10000 });
  const inteira = M.extratoEscritorio([fechado], { saldoAbertura: 10000 });
  const mes = (ls) => ls.find((x) => x.mes === "2026-10");
  assert.strictEqual(mes(comAberta).saldoExtrato, mes(inteira).saldoExtrato, "o banco debitou o mesmo valor");
  assert.strictEqual(mes(inteira).contas.cartao_credito, 2275.63);
  assert.strictEqual(mes(comAberta).contas.cartao_credito, undefined);
  assert.strictEqual(mes(comAberta).contas.emp_construcao, 1775.63);
  assert.strictEqual(mes(comAberta).contas.pagamentos_compras, 200);
  assert.strictEqual(mes(comAberta).contas.marketing, 300);
});

teste("concreto no cartão é investimento do empreendimento, não despesa do escritório", () => {
  const fat = faturaRes();
  const todos = [...LANC_RES, fat];
  assert.strictEqual(M.resultadoEmpreendimento(todos, "c9").investido, 1775.63);
  const r = M.resumoDoPeriodoEscritorio(todos);
  assert.strictEqual(r.despesas, 300, "só o anúncio é despesa do escritório — e uma vez só");
  assert.strictEqual(r.investimentoEmpreendimento, 1775.63);
  assert.strictEqual(r.saidasGestao, 200);
});

teste("compra do escritório no cartão não conta antes da fatura fechar", () => {
  const r = M.resumoDoPeriodoEscritorio(LANC_RES);
  assert.strictEqual(r.despesas, 0, "o banco ainda não debitou");
  assert.strictEqual(M.lancamentosParaResultado(LANC_RES).length, 0);
});

teste("fatura antiga, sem destino nas linhas, continua inteira em cartão", () => {
  const velha = M.lancamentoDaFatura(CARTAO, "2026-09", [{ descricao: "x", valor: 500 }], {});
  const ls = M.lancamentosParaResultado([velha]);
  assert.strictEqual(ls.length, 1);
  assert.strictEqual(ls[0].contaId, "cartao_credito");
});

teste("juros na fatura viram uma linha a mais em cartão; fatura menor que as compras não abre", () => {
  const fat = faturaRes();
  const maior = M.lancamentosParaResultado([{ ...fat, valor: 2300 }]);
  const resto = maior.find((x) => /:resto$/.test(x.id));
  assert.ok(resto && resto.contaId === "cartao_credito" && resto.valor === 24.37, JSON.stringify(resto));
  const menor = M.lancamentosParaResultado([{ ...fat, valor: 2000 }]);
  assert.strictEqual(menor.length, 1, "não abre — abrir daria linha negativa");
  assert.ok(maior.every((x) => x.valor > 0) && menor.every((x) => x.valor > 0));
});


teste("compra no cartão fica fora da conferência com o banco; a fatura entra", () => {
  const fat = faturaRes();
  const doSet = [{ ...LANC_RES[0] }, { id: "P1", contaId: "luz_agua_net", competencia: "2026-09", valor: 90, lancadoEm: "2026-09-10" }];
  const c = M.conferenciaDoMes(doSet, "2026-09");
  assert.strictEqual(c.total, 1, "só a luz — o anúncio no cartão não passa pelo banco");
  assert.strictEqual(M.conferenciaDoMes([fat], "2026-10").total, 1);
  const r = M.conciliarExtrato([{ data: "2026-09-24", valor: -300, historico: "PIX ENVIADO" }], doSet);
  assert.ok(!JSON.stringify(r).includes('"E1"'), "não casa a compra no cartão com movimento do banco");
});


teste("mês e dia como se lê: Outubro 2026, 04/09/2026", () => {
  assert.strictEqual(M.mesAnoPorExtenso("2026-10"), "Outubro 2026");
  assert.strictEqual(M.mesAnoPorExtenso("2027-03"), "Março 2027");
  assert.strictEqual(M.mesAnoPorExtenso(""), "");
  assert.strictEqual(M.efDiaBR("2026-09-04"), "04/09/2026");
  assert.ok(/Outubro 2026/.test(faturaRes().descricao), faturaRes().descricao);
});


teste("editar a compra refaz as parcelas e as faturas", () => {
  const c = OBRAS_RES[0].contasPagar[0];
  const comp = { ...c, valorPago: 5326.88, valor: 5326.88, parcelasCartao: M.parcelasDoCartao(CARTAO, "2026-09-23", 5326.88, 3) };
  const nova = M.compraEditada(comp, { valor: 5326.9, parcelas: 5 }, CARTAO, "obra");
  assert.strictEqual(nova.parcelasCartao.length, 5);
  assert.strictEqual(nova.valorPago, 5326.9);
  assert.strictEqual(Math.round(nova.parcelasCartao.reduce((s, p) => s + p.valor, 0) * 100) / 100, 5326.9);
  assert.ok(M.compraMexeuNoDinheiro(comp, nova));
  assert.ok(!M.compraMexeuNoDinheiro(comp, M.compraEditada(comp, { descricao: "Concretagem fundação" }, CARTAO, "obra")),
    "trocar só a descrição não mexe no dinheiro");
  const esc = M.compraEditada(LANC_RES[0], { data: "2026-10-05" }, CARTAO, "escritorio");
  assert.strictEqual(esc.competencia, "2026-10");
  assert.strictEqual(esc.parcelasCartao[0].competencia, "2026-10", "antes do dia 20, cai na fatura do mês");
  assert.strictEqual(M.compraEditada(comp, { valor: 0 }, CARTAO, "obra"), null);
});

teste("compra com parcela em fatura fechada fica travada", () => {
  const comp = { ...OBRAS_RES[0].contasPagar[0], parcelasCartao: M.parcelasDoCartao(CARTAO, "2026-09-23", 300, 3) };
  assert.deepStrictEqual(M.fechadasDaCompra(comp, []), []);
  const fechada = M.lancamentoDaFatura(CARTAO, "2026-10", [{ descricao: "x", valor: 100 }], {});
  assert.deepStrictEqual(M.fechadasDaCompra(comp, [fechada]), ["2026-10"]);
});

teste("ajustar o valor debitado da fatura fechada", () => {
  const f = faturaRes();
  const a = M.faturaAjustada(f, { valor: 2310.5, data: "2026-11-01" });
  assert.strictEqual(a.valor, 2310.5);
  assert.strictEqual(a.competencia, "2026-11");
  assert.strictEqual(a.linhas.length, f.linhas.length, "a composição não muda");
  assert.strictEqual(M.faturaAjustada(f, { valor: 0 }), null);
});


teste("cartão do escritório só aparece em obra do escritório (empreendimento)", () => {
  const data = { clientes: [{ id: "c1", nome: "Cobop" }, { id: "e1", nome: "Jacarezinho", servicos: { empreendimento: true } }],
    escritorio: { cartoes: [{ id: "k1", nome: "Sicoob" }] } };
  assert.deepStrictEqual(M.cartoesDaObra(data, { id: "o1", clienteId: "c1" }), [], "obra de cliente paga com o dinheiro do cliente");
  assert.deepStrictEqual(M.cartoesDaObra(data, { id: "o2", clienteId: "e1" }).map((c) => c.id), ["k1"]);
  assert.deepStrictEqual(M.cartoesDaObra(data, null), []);
});

teste("cliente paga com o cartão DELE, cadastrado na obra — nunca com o do escritório", () => {
  const data = { clientes: [{ id: "c1" }, { id: "e1", servicos: { empreendimento: true } }],
    escritorio: { cartoes: [{ id: "k1", nome: "Sicoob" }] } };
  const obraCli = { id: "o1", clienteId: "c1", cartoes: [{ id: "kc", nome: "Nubank do João", diaFechamento: 3, diaVencimento: 10, doCliente: true }] };
  assert.deepStrictEqual(M.cartoesDaObra(data, obraCli).map((c) => c.id), ["kc"]);
  assert.strictEqual(M.obraEhDoEscritorio(data, obraCli), false);
  assert.strictEqual(M.obraEhDoEscritorio(data, { clienteId: "e1" }), true);
  assert.ok(M.validarCartaoDoCliente({ nome: "", diaFechamento: 3, diaVencimento: 10 }));
  assert.ok(M.validarCartaoDoCliente({ nome: "X", diaFechamento: 40, diaVencimento: 10 }));
  assert.strictEqual(M.validarCartaoDoCliente({ nome: "Nubank", diaFechamento: "3", diaVencimento: "10" }), "");
  const novo = M.cartaoDoClienteNovo({ nome: " Nubank ", diaFechamento: "3", diaVencimento: "10" }, () => "kn");
  assert.deepStrictEqual([novo.id, novo.nome, novo.diaFechamento, novo.diaVencimento, novo.doCliente], ["kn", "Nubank", 3, 10, true]);
});

teste("conciliar: entrada só casa com entrada, saída só com saída", () => {
  const banco = [
    { data: "2026-09-28", valor: 18000, abs: 18000, historico: "DEPOSITO EM DINHEIRO" },
    { data: "2026-09-29", valor: -18000, abs: 18000, historico: "PIX EMITIDO" },
  ];
  // só o pagamento foi lançado (conta de despesa); o depósito não
  const lancs = [{ id: "pag", valor: 18000, contaId: "parceiros", competencia: "2026-09" }];
  const r = M.conciliarExtrato(banco, lancs);
  assert.strictEqual(r.resumo.casados, 1);
  assert.strictEqual(r.casados[0].extrato.valor, -18000, "o pagamento casa com a saída, não com o depósito");
  assert.deepStrictEqual(r.noBancoSemPar.map((m) => m.valor), [18000], "o depósito fica na fila para lançar");
  // receita casa com a entrada
  const r2 = M.conciliarExtrato(banco, [{ id: "rec", valor: 18000, contaId: "rec_projetos", competencia: "2026-09" }]);
  assert.strictEqual(r2.casados[0].extrato.valor, 18000);
  // estorno (valor negativo numa despesa) é entrada
  const r3 = M.conciliarExtrato([{ data: "2026-09-28", valor: 10833.33, abs: 10833.33, historico: "DEVOLUCAO PIX" }],
    [{ id: "est", valor: -10833.33, contaId: "parceiros", competencia: "2026-09" }]);
  assert.strictEqual(r3.resumo.casados, 1);
});

teste("fila do extrato: id estável por linha, e iguais não colidem", () => {
  const a = M.comIdsDosMovimentos([
    { data: "2026-09-10", valor: -60, historico: "PIX EMITIDO  JOSE" },
    { data: "2026-09-10", valor: -60, historico: "PIX EMITIDO JOSE" },
    { data: "2026-09-11", valor: 100, historico: "Depósito" },
  ]);
  assert.notStrictEqual(a[0].id, a[1].id, "dois Pix iguais no dia têm ids diferentes");
  const b = M.comIdsDosMovimentos([{ data: "2026-09-10", valor: -60, historico: "PIX EMITIDO JOSE" }]);
  assert.strictEqual(b[0].id, a[0].id, "o mesmo arquivo arrastado de novo dá o mesmo id");
  const g = M.extratoParaGuardar(a);
  assert.deepStrictEqual(Object.keys(g[2]).sort(), ["abs", "data", "documento", "historico", "id", "valor"]);
  assert.strictEqual(g[0].abs, 60);
});

teste("saldo do banco lido da última linha SALDO do mês", () => {
  const mov = [
    { data: "2026-09-01", valor: 1000, historico: "SALDO ANTERIOR" },
    { data: "2026-09-15", valor: -50, historico: "TARIFA" },
    { data: "2026-09-30", valor: 950, historico: "Saldo do dia" },
    { data: "2026-10-01", valor: 900, historico: "SALDO" },
  ];
  assert.strictEqual(M.saldoDoExtratoNoMes(mov, "2026-09"), 950);
  assert.strictEqual(M.saldoDoExtratoNoMes(mov, "2026-08"), null);
});

teste("sugestão: a linha igual do mês passado ensina a conta (por CPF/CNPJ ou histórico)", () => {
  assert.strictEqual(M.documentoDoHistorico("PIX EMITIDO ***.144.048-** JOSE"), "144048");
  assert.strictEqual(M.documentoDoHistorico("PAG TIT 12.345.678/0001-90"), "12345678000190");
  const lancs = [
    { id: "a", contaId: "luz_agua_net", unidadeId: "escritorio", valor: 120, historicoBanco: "DEB CONV SABESP 0825", criadoEm: "2026-08-10T10:00:00Z", lancadoEm: "2026-08-10" },
    { id: "b", contaId: "jardim_limpeza", unidadeId: "escritorio", valor: 200, historicoBanco: "PIX EMITIDO ***.144.048-** JOSE", criadoEm: "2026-08-12T10:00:00Z" },
  ];
  const s1 = M.sugestaoDoExtrato({ valor: -133.4, historico: "DEB CONV SABESP 0925" }, lancs);
  assert.strictEqual(s1.campos.contaId, "luz_agua_net");
  assert.strictEqual(s1.porDocumento, false);
  const s2 = M.sugestaoDoExtrato({ valor: -200, historico: "PIX EMITIDO OUTRA IF ***.144.048-** JOSE S" }, lancs);
  assert.strictEqual(s2.campos.contaId, "jardim_limpeza");
  assert.strictEqual(s2.porDocumento, true);
  assert.strictEqual(M.sugestaoDoExtrato({ valor: 200, historico: "DEB CONV SABESP" }, lancs), null, "entrada não copia uma despesa");
  assert.strictEqual(M.sugestaoDoExtrato({ valor: -5, historico: "IOF" }, lancs), null);
  const daPonte = M.sugestaoDoExtrato({ valor: -80, historico: "PIX LOJA X" },
    [{ id: "p", contaId: "luz_agua_net", valor: 80, historicoBanco: "PIX LOJA X", origem: { tipo: "conta" } }]);
  assert.strictEqual(daPonte.daObra, true);
});

teste("linha do extrato vira o formulário: competência do fechamento, data e valor do banco", () => {
  const m = { id: "x#1", data: "2026-10-02", valor: -59.96, historico: "PIX VASSOURA" };
  const l = M.lancamentoDaLinhaDoExtrato(m, "2026-09", { campos: { contaId: "jardim_limpeza" } });
  assert.deepStrictEqual([l.competencia, l.lancadoEm, l.valor, l.extratoId, l.historicoBanco, l.contaId, l.unidadeId],
    ["2026-09", "2026-10-02", "59,96", "x#1", "PIX VASSOURA", "jardim_limpeza", "escritorio"]);
});

teste("lançar assim: só com sugestão que basta e mês aberto", () => {
  const m = { id: "t#1", data: "2026-09-05", valor: -120, historico: "DEB CONV SABESP" };
  const ok = M.lancamentoRapidoDoExtrato(m, "2026-09", { campos: { contaId: "luz_agua_net", unidadeId: "escritorio" } }, {});
  assert.ok(ok.lancamento);
  assert.strictEqual(ok.lancamento.valor, 120);
  assert.strictEqual(ok.lancamento.competencia, "2026-09");
  assert.ok(M.lancamentoRapidoDoExtrato(m, "2026-09", null, {}).erro);
  assert.ok(M.lancamentoRapidoDoExtrato(m, "2026-09", { campos: { contaId: "luz_agua_net" }, daObra: true }, {}).erro);
  const fechado = M.lancamentoRapidoDoExtrato(m, "2026-09", { campos: { contaId: "luz_agua_net" } },
    { "2026-09": { fechadoEm: "2026-10-01T00:00:00Z", saldoBanco: 1 } });
  assert.ok(fechado.erro, "mês fechado não recebe");
  const pedeCliente = M.lancamentoRapidoDoExtrato({ ...m, valor: 500 }, "2026-09", { campos: { contaId: "rec_projetos", unidadeId: "projetos" } }, {});
  assert.ok(pedeCliente.erro, "conta que pede cliente abre o formulário");
});

teste("conciliar: o lançamento da fila casa com a SUA linha; 'não é lançamento' sai da fila", () => {
  const mov = M.comIdsDosMovimentos([
    { data: "2026-09-10", valor: -60, historico: "PIX A" },
    { data: "2026-09-20", valor: -60, historico: "PIX B" },
    { data: "2026-09-21", valor: -1000, historico: "TRANSF MESMA TITULARIDADE" },
  ]).map((m) => ({ ...m, abs: Math.abs(m.valor) }));
  const lanc = [{ id: "l", valor: 60, contaId: "jardim_limpeza", competencia: "2026-09", lancadoEm: "2026-09-10", extratoId: mov[1].id }];
  const r = M.conciliarExtrato(mov, lanc, { ignorados: { [mov[2].id]: { motivo: "transferência" } } });
  assert.strictEqual(r.casados.length, 1);
  assert.strictEqual(r.casados[0].extrato.id, mov[1].id, "casa com a linha de onde nasceu, mesmo com data mais longe");
  assert.deepStrictEqual(r.noBancoSemPar.map((m) => m.id), [mov[0].id]);
  assert.deepStrictEqual(r.naoLancar.map((m) => m.motivo), ["transferência"]);
  assert.strictEqual(r.resumo.naoLancar, 1);
});

teste("transferência entre contas próprias é reconhecida pelo histórico", () => {
  for (const h of ["TRANSF MESMA TITULARIDADE", "PIX EMITIDO MESMA TITULARIDADE", "Transferência entre contas", "TED MESMA TITULAR"])
    assert.ok(M.pareceEntreContas(h), h);
  for (const h of ["PIX EMITIDO JOSE", "DEB CONV SABESP", "", "TARIFA PIX"]) assert.ok(!M.pareceEntreContas(h), h);
});

teste("extrato guardado por mês do movimento, não pelo mês aberto na tela", () => {
  // o extrato de setembro foi arrastado com outubro aberto (o que já aconteceu)
  const antigo = { "2026-10": { origem: "Setembro 2026.xlsm", movimentos: M.extratoParaGuardar([
    { data: "2026-09-01", valor: -529, historico: "PIX OURIMADEIRAS" }, { data: "2026-08-30", valor: -10, historico: "TARIFA" }]),
    ignorados: { x: { motivo: "teste" } } } };
  assert.deepStrictEqual(M.movimentosGuardadosDoMes(antigo, "2026-09").map((m) => m.valor), [-529]);
  assert.deepStrictEqual(M.movimentosGuardadosDoMes(antigo, "2026-10"), []);
  // o arquivo do banco de setembro chega: substitui setembro onde estiver, não mexe em agosto
  const r = M.extratosComArquivo(antigo, [{ data: "2026-09-01", valor: -529, historico: "PIX EMITIDO OURIMADEIRAS" },
    { data: "2026-09-02", valor: -3.2, historico: "TARIFA PIX" }], "extrato-202609.xlsx", "2026-10-06T00:00:00Z");
  assert.deepStrictEqual(r.meses, ["2026-09"]);
  assert.deepStrictEqual(M.movimentosGuardadosDoMes(r.extratos, "2026-09").map((m) => m.historico), ["PIX EMITIDO OURIMADEIRAS", "TARIFA PIX"]);
  assert.deepStrictEqual(M.movimentosGuardadosDoMes(r.extratos, "2026-08").map((m) => m.valor), [-10]);
  assert.strictEqual(r.extratos["2026-09"].origem, "extrato-202609.xlsx");
  assert.ok(M.ignoradosGuardados(r.extratos).x, "o 'não é lançamento' fica");
  // marcar e desmarcar
  const id = r.extratos["2026-09"].movimentos[1].id;
  const m1 = M.extratosComIgnorado(r.extratos, "2026-09", id, "tarifa estornada", "t");
  assert.strictEqual(M.ignoradosGuardados(m1)[id].motivo, "tarifa estornada");
  const m2 = M.extratosComIgnorado(m1, "2026-09", id);
  assert.ok(!M.ignoradosGuardados(m2)[id]);
  assert.ok(!M.ignoradosGuardados(M.extratosComIgnorado(antigo, "2026-09", "x")).x, "desmarca onde estiver guardado");
});

teste("documento do banco ('Pix', 'TED') não vira número da nota", () => {
  assert.strictEqual(M.lancamentoDaLinhaDoExtrato({ id: "a", data: "2026-09-01", valor: -1, documento: "Pix" }, "2026-09", null).documento, "");
  assert.strictEqual(M.lancamentoDaLinhaDoExtrato({ id: "a", data: "2026-09-01", valor: -1, documento: "000123" }, "2026-09", null).documento, "000123");
});


teste("Estorno: saída do banco numa conta de receita entra negativa e casa com a saída", () => {
  const m = { id: "dev#1", data: "2026-09-28", valor: -10833.33, historico: "DÉBITO DEVOLUÇÃO PIX · Devolução Pix ***.518.208-**" };
  const f = M.lancamentoDaLinhaDoExtrato(m, "2026-09", null);
  assert.strictEqual(f.sinalDoBanco, -1);
  assert.ok(M.ehEstornoNaConta("rec_gestao", -1));
  assert.ok(!M.ehEstornoNaConta("rec_gestao", 1), "entrada em receita é receita comum");
  assert.ok(!M.ehEstornoNaConta("luz_agua_net", -1), "saída em despesa é despesa comum");
  assert.ok(M.ehEstornoNaConta("luz_agua_net", 1), "entrada em despesa é estorno da despesa");
  const l = M.comSinalDeEstorno({ ...f, contaId: "rec_gestao", unidadeId: "escritorio" });
  assert.strictEqual(l.valor, -10833.33);
  assert.strictEqual(l.estorno, true);
  assert.strictEqual(l.competencia, "2026-09");
  assert.ok(!("sinalDoBanco" in l));
  const comum = M.comSinalDeEstorno({ ...f, contaId: "luz_agua_net" });
  assert.strictEqual(comum.valor, 10833.33);
  assert.ok(!comum.estorno);
  // a conciliação casa o estorno com a saída do banco
  const r = M.conciliarExtrato([m], [{ ...l, id: "e1" }]);
  assert.strictEqual(r.casados.length, 1);
  assert.strictEqual(r.noBancoSemPar.length, 0);
  // e a receita do mês cai
  const res = M.resumoDoPeriodoEscritorio([lancParaFiltro("a", "2026-09", "rec_gestao", "escritorio", 20000),
    { ...lancParaFiltro("e1", "2026-09", "rec_gestao", "escritorio", -10833.33) }]);
  assert.strictEqual(Math.round(res.receitas * 100) / 100, Math.round((20000 - 10833.33) * 100) / 100);
});

for (const [nome, fn] of testes) {
  try { await fn(); console.log("  ok   " + nome); }
  catch (e) { falhas++; console.log("  FALHOU " + nome + "\n         " + e.message); }
}
console.log(`\n${testes.length - falhas}/${testes.length} passaram`);
process.exit(falhas ? 1 : 0);
