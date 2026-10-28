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
           efNumero, efCompetencia, lancamentosDoEscritorio, lancamentoMexeuNoDinheiro, lancamentoVeioDaObra,
           efAbasDaPlanilha, efLinhasDaAba, efDataDoSerial, efEstilosDeData, efTextosCompartilhados,
           efCsvParaTsv, efAbaDeLancamentos, efTextoDoArquivo,
           resumoEscritorio, efMesPorExtenso, filtrarLancamentosEscritorio, resumoDoPeriodoEscritorio,
           fechamentosDoEscritorio, mesEstaFechado, ultimoMesFechado, conferenciaDoMes,
           diferencaDeFechamento, bloqueioPorMesFechado,
           detectarColunasTabela, movimentosDaTabela, conciliarExtrato, efEhMovimento, casamentoCerto, conferidosPeloExtrato, pistasDoCasamento,
           lancamentoDoExtrato, efValorDeTexto, efEhData, efLinhaDoCabecalho,
           layoutsDoEscritorio, layoutSalvo,
           ehEmpreendimento, empreendimentosDoData, nomeDoEmpreendimento, cartoesDaObra, obraEhDoEscritorio, validarCartaoDoCliente, cartaoDoClienteNovo,
           modoDaPonte, destinoNoEscritorio, lancamentosDaObraParaEscritorio, idDaPonte,
           fontesDasContasPagas, arquivoDoColar, saldoAplicacaoDoMes, comSaldoAplicacao, saldoBancoDoMes, comSaldoBanco, receitaFinanceiraDoMes, lancamentoDoRendimento, rendimentoLancadoNoMes, checagemDebitoCredito, rendimentoPelaAplicacao, ehLinhaDeEstorno, originalDoEstorno, sugestaoDeEstorno, lancamentoDoEstornoDoExtrato, contasDaObraSemLigacao, obrasDoDonoDoLancamento, contasIguaisNaObra, contaDaObraParaALinha, lancamentoDaLigacaoComObra, parcelaDoLancamento, investidoDoEmpreendimento, parcelasDosProjetos, parcelaDeProjetoParaALinha, rotuloDaParcelaDeProjeto, lancamentosDoRecebimento, lancamentosDoGanhoRecebido, lancamentosDaParcelaRecebida, lancamentosComGanhoRecebido, saldoDaReservaEngenharia, comoPagamentoDaReserva, lancamentoRapidoDoExtrato, valorBRDigitado, valorBRDeFora, valorBRNaTela, valorBRCompleto,
           cartaoVazio, cartaoPorId, faturaDaCompra, somarCompetencia, parcelasDoCartao,
           pagamentoNoCartao, linhasDaFatura, totalDaFatura, idDaFatura, lancamentoDaFatura,
           competenciasDoCartao, composicaoDoExtrato, efCabecalhoDeCartao, efParcelaDoTexto, movimentosDoCartao, comCompetenciaDaFatura, comIdsDoCartao, faturasGuardadasDoCartao, faturasComArquivo, financeiroComFaturas, faturasComIgnorado, mesDoPagamentoDaFatura, cartaoDoArquivo, conferenciaDaFatura, contasDaObraParaACompraDoCartao, contasNoCartao, checagemSemTransferencias, somarChecagens, conferenciaUnificada, faturaParaALinhaDoBanco, arquivoPareceDeOutraConta, parDaTransferencia, lancamentosDaTransferenciaComPar, contaDoArquivoPeloConteudo, CONTA_BANCARIA_PRINCIPAL, contasBancariasDoEscritorio, contaBancariaDoLancamento, lancamentosDaContaBancaria, extratosDaContaBancaria, financeiroComExtratos, comIdsDaContaBancaria, saldoBancoDaContaNoMes, comSaldoBancoDaConta, saldoPeloExtratoDaConta, lancamentosDaTransferencia, pareceEntreContas, contasDoLancamento,
           faturasFechadas, faturaParaFechar, lancamentosParaResultado, mesAnoPorExtenso, efDiaBR, fechadasDaCompra, compraEditada, compraMexeuNoDinheiro, faturaAjustada,
           lancamentosDaBaixa, ponteAutomaticaNaBaixa, semLancamentosDasContas, ligaContaAoLancamento, lancamentosLigadosAsContas, contasLigadasAoLancamento,
           unidadePedeObra, contasDoLancamento, valorDaConta, contaEscolhida,
           obrasDoLancamento, validarLancamentoNaObra, destinoVisivelDoCusto,
           efValorDoCampo, anexosDaTransacao, comAnexos,
           efNomeDoFornecedor, EF_FORNECEDOR_OUTROS,
           custoDoLancamento, validarCustoEmItens, itemUnicoDoCusto, itensDoCustoOuUnico, padraoDaContaDaObra,
           comIdsDosMovimentos, efMesmaLinhaDoBanco, extratoParaGuardar, saldoDoExtratoNoMes, documentoDoHistorico, chaveDoHistorico,
           sugestaoDoExtrato, palpiteDoExtrato, sugestaoCompletaDoExtrato, lancamentoDaLinhaDoExtrato, lancamentoRapidoDoExtrato, pareceEntreContas, ehEstornoNaConta, comSinalDeEstorno, contaBancoPelaRegra, obrasDaGestao, fornecedorPadraoDaConta, contaDeEntradaNoEscritorio, semFornecedorNaEntrada, clienteRapidoDoLancamento, ehLigacaoDaGestao, gestaoSemContratoVaiParaObra,
           ehReceitaDaGestao, contaEhEntradaEscritorio, rotuloDoPapelLido, refDaParcela, gestaoNaObra, desfazerGestaoNaObra, parcelaDoLancamento, parcelaDoMesNaGestao, recalibrarGestao, previaDaGestao, contasDaGestao,
           extratosComArquivo, movimentosGuardadosDoMes, ignoradosGuardados, extratosComIgnorado, efLinhasDoHtml, efLinhasDoOfx, saldoDoExtratoNoMes, efTabelaDoArquivo };`)();

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
  assert.ok(!("emitirNota" in l), "a coluna Emitir nota fiscal da planilha fica de fora");
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

teste("empreendimento: aporte (depósito próprio) atravessa fora da conta e não entra na checagem do banco", () => {
  const obra = { id: "obE", clienteId: "e1", nome: "Jacarezinho Módulo 1" };
  const cliente = { id: "e1", nome: "Jacarezinho Módulo 1", servicos: { empreendimento: true } };
  const r = M.lancamentosDaObraParaEscritorio(obra, cliente, {
    planoObra: PLANO_OBRA,
    contasPagar: [{ id: "m1", contaId: "material", valor: 20000, pago: true, valorPago: 20000, pagoEm: "2026-10-05" }],
    entradas: [{ id: "ap1", contaId: "deposito_proprio", valor: 50000, data: "2026-10-01" }],
  });
  const ap = r.lancamentos.find((l) => l.contaId === "emp_aporte");
  const mat = r.lancamentos.find((l) => l.contaId === "emp_construcao");
  assert.ok(ap && mat, JSON.stringify(r.lancamentos.map((l) => l.contaId)));
  assert.strictEqual(ap.contaBanco, "nao");
  assert.strictEqual(mat.contaBanco, "sim");
  const ch = M.checagemDebitoCredito([{ id: "b1", data: "2026-10-05", valor: -20000, historico: "PIX" }], r.lancamentos, "2026-10");
  assert.strictEqual(ch.difCredito, 0, "o aporte não é crédito do banco");
  assert.strictEqual(ch.difDebito, 0);
  const c = M.conciliarExtrato([{ id: "b1", data: "2026-10-05", valor: -20000, historico: "PIX" }], r.lancamentos, {});
  assert.ok(!c.contabilizadoSemPar.some((l) => l.contaId === "emp_aporte"), "não aparece como 'não veio no banco'");
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
  assert.deepStrictEqual(p.map((x) => x.valor), [333.34, 333.33, 333.33],
    "como o banco: o residuo vai na primeira, e a soma fecha na compra");
  // as compras da Cora, no centavo da fatura do banco
  assert.deepStrictEqual(M.parcelasDoCartao(CARTAO, "2026-09-01", 5326.88, 6).map((x) => x.valor), [887.83, 887.81, 887.81, 887.81, 887.81, 887.81]);
  assert.deepStrictEqual(M.parcelasDoCartao(CARTAO, "2026-08-20", 3892.72, 6).map((x) => x.valor), [648.82, 648.78, 648.78, 648.78, 648.78, 648.78]);
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
  // fecha 20, vence 1: a fatura de outubro (compras de 20/09 a 19/10) é
  // debitada em 1º de NOVEMBRO — vencimento antes do fechamento é no mês seguinte
  assert.strictEqual(l.lancadoEm, "2026-11-01", "o dia do vencimento do cartao, no mes seguinte");
  assert.strictEqual(l.competencia, "2026-11");
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

teste("compra de setembro lancada DEPOIS de fechar setembro entra em outubro como atrasada (e a ja faturada nao volta)", () => {
  const fSet = M.faturaParaFechar(CARTAO, OBRAS_CT, [], "2026-09");
  const fatSet = M.lancamentoDaFatura(CARTAO, "2026-09", fSet.linhas, {});
  // depois do fechamento, uma compra de setembro que tinha ficado de fora
  const obras = [{ ...OBRAS_CT[0], contasPagar: OBRAS_CT[0].contasPagar.concat([
    { id: "tarde", cartaoId: "k1", contaId: "material", descricao: "Bomba", pagoEm: "2026-09-25",
      parcelasCartao: [{ parcela: 1, de: 1, competencia: "2026-09", valor: 1520 }] }]) }];
  const f = M.faturaParaFechar(CARTAO, obras, [fatSet], "2026-10");
  assert.deepStrictEqual(f.atrasadas.map((l) => [l.refId, l.valor]), [["tarde", 1520]], "só a que ficou de fora");
  assert.strictEqual(f.total, 7700 + 1520);
  // fechada outubro (levando a atrasada), novembro não a traz de novo
  const fatOut = M.lancamentoDaFatura(CARTAO, "2026-10", f.linhas, {});
  const fNov = M.faturaParaFechar(CARTAO, obras, [fatSet, fatOut], "2026-11");
  assert.strictEqual(fNov.atrasadas.length, 0);
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
  // a fatura de outubro vence em 1º/11 (fecha 20, vence 1)
  const mes = (ls) => ls.find((x) => x.mes === "2026-11");
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
  assert.strictEqual(M.conferenciaDoMes([fat], "2026-11").total, 1, "a fatura de outubro, no mês em que o banco a debita");
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


teste("Por onde o dinheiro passou sai da regra: gestão só a receita passa pela conta; o resto, conforme a obra", () => {
  assert.strictEqual(M.contaBancoPelaRegra("escritorio", "luz_agua_net", null), "sim");
  assert.strictEqual(M.contaBancoPelaRegra("empreendimento", "emp_construcao", null), "sim");
  assert.strictEqual(M.contaBancoPelaRegra("projetos", "rec_projetos", null), "sim");
  const clientePaga = { id: "o1", clientePagaDireto: true }, escritorioPaga = { id: "o2", clientePagaDireto: false };
  assert.strictEqual(M.contaBancoPelaRegra("gestao_obras", "rec_gestao", clientePaga), "sim", "a gestão é paga ao escritório");
  assert.strictEqual(M.contaBancoPelaRegra("gestao_obras", "pagamentos_compras", clientePaga), "nao");
  assert.strictEqual(M.contaBancoPelaRegra("gestao_obras", "pagamentos_compras", escritorioPaga), "sim");
});

teste("Obras da gestão: as do cliente escolhido, nunca as de empreendimento", () => {
  const clientes = [{ id: "c1", nome: "Cobop" }, { id: "e1", nome: "Jacarezinho", empreendimento: true, ehEmpreendimento: true }];
  const obras = [{ id: "o1", clienteId: "c1", nome: "Reforma Loja Cobop" }, { id: "o2", clienteId: "e1", nome: "Jacarezinho Módulo 1" }, { id: "o3", clienteId: "c9", nome: "Outra" }];
  const todas = M.obrasDaGestao(obras, clientes, "").map((o) => o.id);
  assert.ok(todas.includes("o1") && todas.includes("o3"));
  assert.deepStrictEqual(M.obrasDaGestao(obras, clientes, "c1").map((o) => o.id), ["o1"]);
});

teste("Gestão de obras exige a obra; o lançamento rápido usa a obra gravada, não o nome", () => {
  const m = { id: "g#1", data: "2026-09-10", valor: 5000, historico: "PIX RECEBIDO COBOP" };
  const semObra = M.lancamentoRapidoDoExtrato(m, "2026-09", { campos: { contaId: "rec_gestao", unidadeId: "gestao_obras", clienteId: "c1", cliente: "Cobop", projeto: "Reforma" } }, {});
  assert.ok(semObra.erro);
  const comObra = M.lancamentoRapidoDoExtrato(m, "2026-09", { campos: { contaId: "reembolsos", unidadeId: "gestao_obras", clienteId: "c1", cliente: "Cobop", projeto: "Reforma", obraId: "o1" } }, {});
  assert.ok(comObra.lancamento, comObra.erro);
  // a receita da gestão baixa uma parcela do contrato: vai ao formulário
  const rec = M.lancamentoRapidoDoExtrato(m, "2026-09", { campos: { contaId: "rec_gestao", unidadeId: "gestao_obras", clienteId: "c1", cliente: "Cobop", projeto: "Reforma", obraId: "o1" } }, {});
  assert.ok(/parcela/.test(rec.erro || ""));
});


teste("Receita do escritório: o fornecedor é o próprio escritório", () => {
  assert.strictEqual(M.fornecedorPadraoDaConta("rec_gestao", "Padovan Arquitetos"), "Padovan Arquitetos");
  assert.strictEqual(M.fornecedorPadraoDaConta("rec_projetos", "Padovan Arquitetos"), "Padovan Arquitetos");
  assert.strictEqual(M.fornecedorPadraoDaConta("luz_agua_net", "Padovan Arquitetos"), "");
  assert.strictEqual(M.fornecedorPadraoDaConta("rec_gestao", ""), "");
});


// ── Receita da gestão: saldo do mês no contrato de gestão ───────
const obraGestaoT = () => ({
  id: "ob1", nome: "Reforma Loja Cobop", clienteId: "c1", clientePagaDireto: true,
  contratos: [{ id: "g", valor: 130000 }],
  contasPagar: [
    { id: "g:1", origem: "contrato", contratoId: "g", contaId: "taxa_admin_obra", parcela: 1, totalParcelas: 4, valor: 10833.33, vencimento: "2026-08-05", pago: true, pagoEm: "2026-08-05", valorPago: 10833.33 },
    { id: "g:2", origem: "contrato", contratoId: "g", contaId: "taxa_admin_obra", parcela: 2, totalParcelas: 4, valor: 10833.33, vencimento: "2026-09-05", pago: true, pagoEm: "2026-09-05", valorPago: 10833.33 },
    { id: "g:3", origem: "contrato", contratoId: "g", contaId: "taxa_admin_obra", parcela: 3, totalParcelas: 4, valor: 10833.33, vencimento: "2026-10-10", pago: false, pagoEm: "", valorPago: "" },
    { id: "g:4", origem: "contrato", contratoId: "g", contaId: "taxa_admin_obra", parcela: 4, totalParcelas: 4, valor: 10833.33, vencimento: "2026-11-05", pago: false, pagoEm: "", valorPago: "" },
    { id: "m1", contaId: "material", valor: 50, pago: true, pagoEm: "2026-09-01", valorPago: 50 },
  ],
});
const gP = (ob, id) => ob.contasPagar.find((c) => c.id === id);
const somaGestao = (ob) => cent(ob.contasPagar.filter((c) => c.contaId === "taxa_admin_obra").reduce((t, c) => t + c.valor, 0));

teste("Gestão: a parcela do mês é a que vence nele; sem nenhuma, a próxima; depois da última, a última", () => {
  const ob = obraGestaoT();
  assert.strictEqual(M.parcelaDoMesNaGestao(ob, "2026-09").id, "g:2");
  assert.strictEqual(M.parcelaDoMesNaGestao(ob, "2026-07").id, "g:1");
  assert.strictEqual(M.parcelaDoMesNaGestao(ob, "2027-03").id, "g:4");
});

teste("Gestão: setembro do Cobop — dois estornos e 18 mil no mês; agosto fica onde está, a falta vai para outubro", () => {
  let ob = obraGestaoT();
  const lan = (id, valor) => ({ id, valor, lancadoEm: "2026-09-28", competencia: "2026-09" });
  for (const l of [lan("E1", -10833.33), lan("E2", -10833.33), lan("R1", 18000)]) {
    const r = M.gestaoNaObra(ob, l, null, "Leo", "2026-10-08T10:00:00Z");
    assert.ok(!r.erro, r.erro);
    assert.strictEqual(r.origem.tipo, "gestao");
    assert.strictEqual(r.origem.refId, "g:2");
    ob = r.obra;
  }
  // agosto intocado
  assert.strictEqual(gP(ob, "g:1").pago, true);
  assert.strictEqual(gP(ob, "g:1").pagoEm, "2026-08-05");
  assert.strictEqual(gP(ob, "g:1").valorPago, 10833.33);
  // setembro fecha no que entrou: 10.833,33 − 21.666,66 + 18.000
  const p2 = gP(ob, "g:2");
  assert.strictEqual(p2.valorPago, 7166.67);
  assert.strictEqual(p2.valor, 7166.67);
  assert.strictEqual(p2.pagoEm, "2026-09-28");
  assert.match(p2.notaSaldo, /falta R\$ 3\.666,66 → out\/26/);
  // outubro recebe a falta, com o comentário
  assert.strictEqual(gP(ob, "g:3").valor, 14499.99);
  assert.match(gP(ob, "g:3").notaSaldo, /^soma R\$ 3\.666,66 que faltou em set\/26$/);
  assert.strictEqual(gP(ob, "g:4").valor, 10833.33);
  // o contrato não muda de tamanho; o acerto fica guardado nele
  assert.strictEqual(somaGestao(ob), 43333.32);
  assert.deepStrictEqual(ob.contratos[0].ajustesSaldo, { "g:2": -3666.66, "g:3": 3666.66 });
  assert.strictEqual(ob.contratos[0].notasSaldo["g:3"], gP(ob, "g:3").notaSaldo);
});

teste("Gestão: pago a mais abate a parcela seguinte", () => {
  const r = M.gestaoNaObra(obraGestaoT(), { id: "R", valor: 12000, lancadoEm: "2026-10-09", competencia: "2026-10" }, null, "Leo");
  assert.strictEqual(gP(r.obra, "g:3").valorPago, 12000);
  assert.match(gP(r.obra, "g:3").notaSaldo, /sobra R\$ 1\.166,67 → nov\/26/);
  assert.strictEqual(gP(r.obra, "g:4").valor, 9666.66);
  assert.match(gP(r.obra, "g:4").notaSaldo, /^desconta R\$ 1\.166,67 pago a mais em out\/26$/);
});

teste("Gestão: o cheque anexado à receita fica também na parcela da obra — e sai com o lançamento", () => {
  const cheque = { url: "https://x/cheque.jpg", nome: "cheque.jpg", tipo: "comprovante" };
  const ob0 = obraGestaoT();
  ob0.contasPagar = ob0.contasPagar.map((c) => (c.id === "g:3" ? { ...c, anexos: [{ url: "https://x/boleto.pdf", nome: "boleto.pdf" }] } : c));
  const l = { id: "R", valor: 18000, lancadoEm: "2026-10-10", competencia: "2026-10", anexos: [cheque] };
  const r = M.gestaoNaObra(ob0, l, null, "Leo");
  const p3 = gP(r.obra, "g:3");
  assert.strictEqual(p3.pago, true);
  assert.strictEqual(p3.pagoEm, "2026-10-10");
  assert.deepStrictEqual(p3.anexos.map((a) => a.nome), ["boleto.pdf", "cheque.jpg"]);
  assert.strictEqual(p3.anexos[1].lancamentoId, "R");
  // a parcela seguinte não ganha o papel
  assert.ok(!gP(r.obra, "g:4").anexos);
  // excluir o lançamento: o cheque sai, o boleto da obra fica
  const d = M.desfazerGestaoNaObra(r.obra, { ...l, origem: r.origem }, "Leo");
  assert.deepStrictEqual(gP(d.obra, "g:3").anexos.map((a) => a.nome), ["boleto.pdf"]);
  assert.strictEqual(gP(d.obra, "g:3").pago, false);
});

teste("Receita: o papel é comprovante do recebimento — cheque se diz cheque, nunca pedido", () => {
  assert.strictEqual(M.contaEhEntradaEscritorio("rec_gestao"), true);
  assert.strictEqual(M.contaEhEntradaEscritorio(""), false);
  const despesa = M.PLANO_CONTAS_ESCRITORIO.find((c) => { const g = M.grupoEscritorio(c.grupo); return g && g.sinal < 0; });
  assert.strictEqual(M.contaEhEntradaEscritorio(despesa.id), false);
  assert.strictEqual(M.rotuloDoPapelLido({ tipo: "pedido" }, true, "Cheque Sicoob no valor de dezoito mil reais"), "Cheque");
  assert.strictEqual(M.rotuloDoPapelLido({ tipo: "pedido" }, true, ""), "Comprovante do recebimento");
  assert.strictEqual(M.rotuloDoPapelLido({ tipo: "pedido" }, false, "cimento"), "Pedido");
  assert.strictEqual(M.rotuloDoPapelLido({ tipo: "nota", ehNota: true }, false, ""), "Nota fiscal");
});

teste("Gestão: recebimento igual ao já baixado na obra é o mesmo pagamento — não soma duas vezes", () => {
  const r = M.gestaoNaObra(obraGestaoT(), { id: "R", valor: 10833.33, lancadoEm: "2026-09-04", competencia: "2026-09" }, null, "Leo");
  const p2 = gP(r.obra, "g:2");
  assert.strictEqual(p2.valorPago, 10833.33);
  assert.strictEqual(p2.pagoEm, "2026-09-04");
  assert.deepStrictEqual(p2.movimentos.map((m) => m.lancamentoId), ["R"]);
  assert.strictEqual(gP(r.obra, "g:3").valor, 10833.33);
});

teste("Gestão: tirar o lançamento refaz o saldo; editar o valor também", () => {
  let ob = obraGestaoT();
  const e = { id: "E1", valor: -10833.33, lancadoEm: "2026-09-28", competencia: "2026-09" };
  const r1 = M.gestaoNaObra(ob, e, null, "Leo");
  assert.strictEqual(gP(r1.obra, "g:3").valor, 21666.66);
  const gravado = { ...e, origem: r1.origem };
  const ed = M.gestaoNaObra(r1.obra, { ...e, valor: -5000 }, gravado, "Leo");
  assert.strictEqual(gP(ed.obra, "g:2").valorPago, 5833.33);
  assert.strictEqual(gP(ed.obra, "g:3").valor, 15833.33);
  const d = M.desfazerGestaoNaObra(r1.obra, gravado, "Leo");
  assert.strictEqual(gP(d.obra, "g:2").valorPago, 10833.33);
  assert.strictEqual(gP(d.obra, "g:3").valor, 10833.33);
  assert.ok(!gP(d.obra, "g:3").notaSaldo);
  assert.ok(!d.obra.contratos[0].ajustesSaldo);
});

teste("Gestão: estorno num mês ainda em aberto soma no que a parcela deve", () => {
  const r = M.gestaoNaObra(obraGestaoT(), { id: "E", valor: -10833.33, lancadoEm: "2026-10-02", competencia: "2026-10" }, null, "Leo");
  const p3 = gP(r.obra, "g:3");
  assert.strictEqual(p3.pago, false);
  assert.strictEqual(p3.valor, 21666.66);
  assert.match(p3.notaSaldo, /estorno de R\$ 10\.833,33 em out\/26/);
});

teste("Gestão: o estorno antigo (que reabriu a parcela) volta ao pagamento de agosto quando é regravado", () => {
  const ob = obraGestaoT();
  ob.contasPagar = ob.contasPagar.map((c) => (c.id === "g:1" ? { ...c, pago: false, pagoEm: "", valorPago: "",
    estornos: [{ lancamentoId: "K", em: "2026-09-28", valor: 10833.33, antes: { pagoEm: "2026-08-05", valorPago: 10833.33, contabilizadoEm: "2026-09-10" } }] } : c));
  const antigo = { id: "K", valor: -10833.33, estorno: true, lancadoEm: "2026-09-28", competencia: "2026-09",
    origem: { obraId: "ob1", tipo: "estorno", refId: "g:1", parcelaId: "g:1", contaObra: "taxa_admin_obra" } };
  const r = M.gestaoNaObra(ob, antigo, antigo, "Leo");
  assert.ok(!r.erro, r.erro);
  assert.strictEqual(gP(r.obra, "g:1").pago, true);
  assert.strictEqual(gP(r.obra, "g:1").pagoEm, "2026-08-05");
  assert.ok(!gP(r.obra, "g:1").estornos);
  assert.strictEqual(r.origem.tipo, "gestao");
  assert.strictEqual(gP(r.obra, "g:2").valorPago, 0);
  assert.strictEqual(gP(r.obra, "g:3").valor, 21666.66);
});

teste("Gestão: a prévia mostra o mês, a parcela seguinte e o pago do contrato", () => {
  const pv = M.previaDaGestao(obraGestaoT(), { id: "R", valor: 18000, lancadoEm: "2026-09-28", competencia: "2026-09" }, null);
  assert.strictEqual(pv.mes, "set/26");
  assert.strictEqual(pv.parcela.n, 2);
  assert.strictEqual(pv.parcela.valorPago, 28833.33);
  assert.strictEqual(pv.proxima.antes, 10833.33);
  assert.strictEqual(pv.proxima.depois, 0);
  assert.strictEqual(pv.contrato.antes, 21666.66);
  assert.strictEqual(pv.contrato.depois, 39666.66);
});

teste("Gestão: a ponte não manda de novo a parcela que tem movimentos do escritório", () => {
  const r = M.gestaoNaObra(obraGestaoT(), { id: "R", valor: 12000, lancadoEm: "2026-10-09", competencia: "2026-10" }, null, "Leo");
  const ponte = M.lancamentosDaObraParaEscritorio(r.obra, { id: "c1" }, { contasPagar: [gP(r.obra, "g:3")], lancamentos: [], planoObra: [{ id: "taxa_admin_obra", grupo: "servicos" }] });
  assert.strictEqual(ponte.lancamentos.length, 0);
});


teste("pagamento único: sem item, o valor inteiro vira um item na etapa escolhida", () => {
  const u = M.itensDoCustoOuUnico([], 400, "fundacao", "empreiteiro", "Empreiteiro Jacarezinho");
  assert.strictEqual(u.length, 1);
  assert.deepStrictEqual([u[0].quantidade, u[0].unitario, u[0].bruto, u[0].etapa, u[0].contaId], [1, 400, 400, "fundacao", "empreiteiro"]);
  assert.ok(M.validarCustoEmItens(400, u, "o1").ok);
  // sem etapa ainda: pede a etapa, não um item
  const sem = M.validarCustoEmItens(400, M.itensDoCustoOuUnico([], 400, "", "empreiteiro", "x"), "o1");
  assert.ok(sem.erros.some((e) => /sem etapa/.test(e)) && !sem.erros.some((e) => /pelo menos um item/.test(e)));
  // compra com itens continua item a item
  const itens = [{ descricao: "Cimento", quantidade: 2, unitario: 40, etapa: "fundacao" }];
  assert.strictEqual(M.itensDoCustoOuUnico(itens, 80, "alvenaria", "material", "x"), itens);
  assert.deepStrictEqual(M.itensDoCustoOuUnico([], 0, "fundacao", "empreiteiro", "x"), []);
});


teste("conta de mão de obra já traz etapa e grupo 'Prestadores de serviços'", () => {
  const plano = [{ id: "empreiteiro", grupo: "maoDeObra" }, { id: "material", grupo: "materiais" }];
  assert.deepStrictEqual(M.padraoDaContaDaObra("empreiteiro", plano), { etapa: "prestadores", grupoMaterial: "Prestadores de serviços" });
  assert.deepStrictEqual(M.padraoDaContaDaObra("material", plano), { etapa: "", grupoMaterial: "" });
  const u = M.itensDoCustoOuUnico([], 400, "prestadores", "empreiteiro", "Empreiteiro", "Prestadores de serviços");
  assert.deepStrictEqual([u[0].etapa, u[0].grupoMaterial], ["prestadores", "Prestadores de serviços"]);
});

// ── O palpite da fila do extrato ───────────────────────────────
const PLANO_PX = [{ id: "empreiteiro", nome: "Empreiteiro", grupo: "maoDeObra" }, { id: "pedreiros", nome: "Pedreiros", grupo: "maoDeObra" },
  { id: "material", nome: "Material", grupo: "materiais" }, { id: "agua", nome: "Água", grupo: "consumo" },
  { id: "frete", nome: "Frete", grupo: "logistica" }, { id: "venda_imovel", nome: "Venda do imóvel", grupo: "receitas" }];
const CLI_PX = [{ id: "c1", nome: "Jacarezinho Módulo 1", servicos: { empreendimento: true } }, { id: "c2", nome: "Jacarezinho Módulo 2", servicos: { empreendimento: true } },
  { id: "c3", nome: "Cobop" }];
const CPX = (contaId, favorecido, d) => ({ id: contaId + favorecido + d, contaId, favorecido, valor: 100, pago: true, pagoEm: d });
const OBRAS_PX = [
  { id: "m1", clienteId: "c1", nome: "Jacarezinho Módulo 1", contasPagar: [
    CPX("empreiteiro", "Carlos Trindade - Empreiteiro", "2026-08-23"), CPX("empreiteiro", "Carlos Trindade - Empreiteiro", "2026-09-23"),
    CPX("empreiteiro", "Carlos Trindade - Empreiteiro", "2026-09-24"), CPX("empreiteiro", "Outros", "2026-07-14"),
    CPX("agua", "SANEPAR", "2026-07-01"), CPX("agua", "SANEPAR", "2026-08-01"), CPX("agua", "SANEPAR", "2026-09-01")] },
  { id: "m2", clienteId: "c2", nome: "Jacarezinho Módulo 2", contasPagar: [CPX("material", "Krona", "2026-09-30")] },
  { id: "cb", clienteId: "c3", nome: "Reforma Loja Cobop", contasPagar: [CPX("empreiteiro", "Zé Pedreiro", "2026-09-01"), CPX("empreiteiro", "Zé Pedreiro", "2026-09-15")] },
];
const FORN_PX = [{ id: "1un49r0", nome: "Carlos Trindade" }, { id: "san", nome: "SANEPAR" }, { id: "ng", nome: "NG Materiais Construção" }, { id: "out", nome: "Outros" }];
const CTX_PX = { obras: OBRAS_PX, clientes: CLI_PX, fornecedores: FORN_PX, plano: PLANO_PX };

teste("palpite: “empreiteiro Jacarezinho” → conta Empreiteiro, Módulo 1, Carlos Trindade", () => {
  const p = M.palpiteDoExtrato({ valor: -400, historico: "PIX EMITIDO OUTRA IF · Pagamento Pix ***.144.048-** empreiteiro Jacarezinho" }, CTX_PX);
  assert.ok(p && p.naObra);
  assert.deepStrictEqual([p.campos.unidadeId, p.campos.contaFonte, p.campos.contaId, p.campos.empreendimentoId, p.campos.obraIdAlvo, p.campos.fornecedorId, p.campos.fornecedor],
    ["empreendimento", "obra", "empreiteiro", "c1", "m1", "1un49r0", "Carlos Trindade"]);
  assert.ok(p.motivos.some((x) => /empreiteiro/.test(x) && /extrato/.test(x)));
  assert.ok(p.motivos.some((x) => /3 de 4 pagamentos de Empreiteiro nesta obra/.test(x)), p.motivos.join(" | "));
});

teste("palpite: fornecedor pelo nome traz a conta e a obra em que ele costuma entrar", () => {
  const p = M.palpiteDoExtrato({ valor: -81, historico: "DEB CONV SANEPAR 0925" }, CTX_PX);
  assert.deepStrictEqual([p.campos.contaId, p.campos.obraIdAlvo, p.campos.fornecedorId], ["agua", "m1", "san"]);
});

teste("palpite: sem pista não inventa; entrada não é palpitada; obra de cliente vira gestão de obras", () => {
  assert.strictEqual(M.palpiteDoExtrato({ valor: -10, historico: "TARIFA PACOTE" }, CTX_PX), null);
  assert.strictEqual(M.palpiteDoExtrato({ valor: 400, historico: "PIX RECEBIDO empreiteiro Jacarezinho" }, CTX_PX), null);
  const c = M.palpiteDoExtrato({ valor: -300, historico: "PIX empreiteiro Cobop" }, CTX_PX);
  assert.deepStrictEqual([c.campos.unidadeId, c.campos.obraIdAlvo, c.campos.empreendimentoId, c.campos.fornecedor], ["gestao_obras", "cb", "", "Zé Pedreiro"]);
  assert.strictEqual(c.campos.fornecedorId, undefined, "fora do cadastro, só o nome");
  // duas obras citadas e nenhuma decide: não escolhe obra (e sem obra, não monta custo de obra)
  const amb = M.palpiteDoExtrato({ valor: -50, historico: "PIX frete Jacarezinho" }, CTX_PX);
  assert.ok(!amb || !amb.campos.obraIdAlvo);
});

teste("palpite: item do catálogo citado diz a conta; o nome inteiro da obra decide entre módulos", () => {
  const ctx = { ...CTX_PX, insumos: [{ codigo: "AR1", nome: "Areia Média" }, { codigo: "VB1", nome: "Locação Ferramentas - Vibrador", contaPadrao: "frete" }] };
  const a = M.palpiteDoExtrato({ valor: -300, historico: "PIX 82.007.253 0001-51 arame areia jacarezinho modulo 2" }, ctx);
  assert.deepStrictEqual([a.campos.contaId, a.campos.obraIdAlvo], ["material", "m2"]);
  assert.ok(a.motivos.some((x) => /areia/.test(x) && /catálogo/.test(x)), a.motivos.join(" | "));
  const v = M.palpiteDoExtrato({ valor: -90, historico: "PIX vibrador Jacarezinho Módulo 1" }, ctx);
  assert.deepStrictEqual([v.campos.contaId, v.campos.obraIdAlvo], ["frete", "m1"], "a conta padrão do item manda");
  // sem obra citada, o catálogo não chuta (retirada de sócio não é material)
  assert.strictEqual(M.palpiteDoExtrato({ valor: -500, historico: "PIX areia Renato" }, ctx), null);
});

teste("documento do Pix que já foi de dois fornecedores não identifica ninguém", () => {
  const lancs = [
    { id: "e", contaId: "emp_construcao", unidadeId: "empreendimento", valor: 30, fornecedor: "Energiar", historicoBanco: "PIX EMITIDO OUTRA IF · Pagamento Pix ***.144.048-** Energiar", criadoEm: "2026-09-25T10:00:00Z" },
    { id: "n", contaId: "emp_construcao", unidadeId: "empreendimento", valor: 60, fornecedor: "NG Materiais Construção", historicoBanco: "PIX EMITIDO OUTRA IF · Pagamento Pix ***.144.048-** NG", criadoEm: "2026-09-26T10:00:00Z" },
  ];
  assert.strictEqual(M.sugestaoDoExtrato({ valor: -400, historico: "PIX EMITIDO OUTRA IF · Pagamento Pix ***.144.048-** empreiteiro Jacarezinho" }, lancs), null);
  const s = M.sugestaoCompletaDoExtrato({ valor: -400, historico: "PIX EMITIDO OUTRA IF · Pagamento Pix ***.144.048-** empreiteiro Jacarezinho" }, lancs, CTX_PX);
  assert.strictEqual(s.palpite, true);
  assert.strictEqual(s.campos.contaId, "empreiteiro");
  assert.strictEqual(s.campos.fornecedor, "Carlos Trindade");
  // e o lançar-assim (um clique) não usa palpite
  const r = M.lancamentoRapidoDoExtrato({ id: "x", data: "2026-09-28", valor: -400, historico: "x" }, "2026-09", M.sugestaoDoExtrato({ valor: -400, historico: "x" }, lancs), {});
  assert.ok(r.erro);
});

teste("a linha igual manda; o palpite só completa o fornecedor que faltava", () => {
  const lancs = [{ id: "a", contaId: "luz_agua_net", unidadeId: "escritorio", valor: 120, historicoBanco: "DEB CONV SANEPAR 0825", criadoEm: "2026-08-10T10:00:00Z" }];
  const s = M.sugestaoCompletaDoExtrato({ valor: -133.4, historico: "DEB CONV SANEPAR 0925" }, lancs, CTX_PX);
  assert.strictEqual(s.campos.contaId, "luz_agua_net");
  assert.strictEqual(s.campos.unidadeId, "escritorio");
  assert.strictEqual(s.campos.fornecedorId, "san");
  assert.ok(!s.palpite);
});


// ── casamento com certeza: o que não tem com o que confundir entra conferido ──
teste("casamento: valor único é certo; valor repetido sem pista é dúvida", () => {
  const banco = [
    { id: "b1", data: "2026-09-10", valor: -120, historico: "PIX EMITIDO OUTRA IF · Pagamento Pix 11.222.333 0001-44" },
    { id: "b2", data: "2026-09-14", valor: -80, historico: "PIX EMITIDO OUTRA IF · Pagamento Pix 34.030.843 0001-60" },
    { id: "b3", data: "2026-09-22", valor: -80, historico: "PIX EMITIDO OUTRA IF · Pagamento Pix 18.203.857 0001-10" },
  ];
  const lancs = [
    { id: "l1", valor: 120, contaId: "parceiros", competencia: "2026-09", descricao: "Cimento" },
    { id: "l2", valor: 80, contaId: "parceiros", competencia: "2026-09", descricao: "Vibrador concreto fundação", fornecedor: "Locadora Alfa" },
    { id: "l3", valor: 80, contaId: "parceiros", competencia: "2026-09", descricao: "Concretagem fundação", fornecedor: "Concreteira Beta" },
  ];
  const r = M.conciliarExtrato(banco, lancs);
  const par = (id) => r.casados.find((c) => c.extrato.id === id);
  assert.strictEqual(par("b1").certeza, "unico");
  assert.strictEqual(par("b2").certeza, "duvida");
  assert.strictEqual(par("b3").certeza, "duvida");
  assert.strictEqual(par("b2").alternativas.length, 1, "a outra opção vem para a pessoa trocar");
  assert.strictEqual(r.resumo.certos, 1); assert.strictEqual(r.resumo.duvidas, 2);
  // o CNPJ no cadastro do fornecedor desempata — e troca o par que a ordem faria
  const forn = [{ id: "fa", nome: "Locadora Alfa", cnpjCpf: "18.203.857/0001-10" }, { id: "fb", nome: "Concreteira Beta", cnpjCpf: "34.030.843/0001-60" }];
  const r2 = M.conciliarExtrato(banco, lancs, { fornecedores: forn });
  const p2 = (id) => r2.casados.find((c) => c.extrato.id === id);
  assert.strictEqual(p2("b2").lancamento.id, "l3"); assert.strictEqual(p2("b2").certeza, "desempate");
  assert.strictEqual(p2("b3").lancamento.id, "l2"); assert.strictEqual(p2("b3").certeza, "desempate");
});

teste("casamento: o que se aprendeu no histórico desempata; lançamentos iguais são equivalentes", () => {
  const banco = [
    { id: "x1", data: "2026-09-14", valor: -400, historico: "PIX EMITIDO OUTRA IF · Pagamento Pix ***.144.048-**" },
    { id: "x2", data: "2026-09-28", valor: -10833.33, historico: "DÉBITO DEVOLUÇÃO PIX · Devolução Pix ***.518.208-**" },
    { id: "x3", data: "2026-09-28", valor: -10833.33, historico: "DÉBITO DEVOLUÇÃO PIX · Devolução Pix ***.518.208-**" },
  ];
  const historico = [{ id: "h", fornecedor: "Danieli Costa Trindade", historicoBanco: "Pagamento Pix ***.144.048-**", competencia: "2026-08" }];
  const lancs = [
    { id: "e1", valor: 400, contaId: "parceiros", competencia: "2026-09", descricao: "Empreiteiro", fornecedor: "Outro" },
    { id: "e2", valor: 400, contaId: "parceiros", competencia: "2026-09", descricao: "Empreiteiro", fornecedor: "Danieli Costa Trindade" },
    { id: "d1", valor: 10833.33, contaId: "parceiros", competencia: "2026-09", descricao: "DÉBITO DEVOLUÇÃO PIX" },
    { id: "d2", valor: 10833.33, contaId: "parceiros", competencia: "2026-09", descricao: "DÉBITO DEVOLUÇÃO PIX" },
  ];
  const r = M.conciliarExtrato(banco, lancs, { historico });
  const par = (id) => r.casados.find((c) => c.extrato.id === id);
  assert.strictEqual(par("x1").lancamento.id, "e2"); assert.strictEqual(par("x1").certeza, "desempate");
  assert.strictEqual(par("x2").certeza, "equivalente"); assert.strictEqual(par("x3").certeza, "equivalente");
  assert.ok(M.casamentoCerto(par("x2")));
  // sobrou o e1: lançado e não veio no banco
  assert.deepStrictEqual(r.contabilizadoSemPar.map((l) => l.id), ["e1"]);
});

teste("conferência: o certo conta como conferido pelo extrato e é gravado ligado à linha", () => {
  const banco = [{ id: "b1", data: "2026-09-10", valor: -120, historico: "PIX EMITIDO · Pagamento Pix 11.222.333 0001-44" }];
  const lancs = [{ id: "l1", valor: 120, contaId: "parceiros", competencia: "2026-09", descricao: "Cimento" },
    { id: "l9", valor: 55, contaId: "parceiros", competencia: "2026-09", descricao: "Não veio no banco" }];
  const r = M.conciliarExtrato(banco, lancs);
  const certos = new Set(r.casados.filter(M.casamentoCerto).map((c) => c.lancamento.id));
  const c = M.conferenciaDoMes(lancs, "2026-09", { certos });
  assert.strictEqual(c.conferidos, 1); assert.strictEqual(c.peloExtrato, 1); assert.strictEqual(c.pendentes, 1);
  assert.strictEqual(c.valorPendente, 55);
  assert.ok(c.lancamentos.find((l) => l.id === "l1")._peloExtrato);
  const g = M.conferidosPeloExtrato(r, "2026-10-01T00:00:00Z");
  assert.strictEqual(g.length, 1);
  assert.strictEqual(g[0].conferido, true); assert.strictEqual(g[0].extratoId, "b1");
  assert.strictEqual(g[0].conferidoPor, "extrato"); assert.ok(/11\.222\.333/.test(g[0].historicoBanco));
  // sem certos, nada muda no comportamento antigo
  assert.strictEqual(M.conferenciaDoMes(lancs, "2026-09").conferidos, 0);
});


// ── extrato do banco em HTML (Sicoob) e OFX ──
const HTML_SICOOB = `<html><body><table><tr><td><strong>Conta:</strong></td><td>3.893-8 / LEO PADOVAN</td></tr></table>
<div class="titulo-tabela">LANÇAMENTOS</div><table class="home-extrato-exportar-table-html"><thead><tr><th>DATA</th><th>DOCUMENTO</th><th>DESCRIÇÃO</th><th>VALOR</th></tr></thead><tbody>
<tr><td>09/10/2026</td><td>Pix</td><td><strong>PIX EMITIDO OUTRA IF</strong><br><span style="white-space: pre-line;">Pagamento Pix
***.144.048-**
empreiteiro jacarezinho
</span></td><td class="text-right"> 400,00D</td></tr>
<tr><td>07/10/2026</td><td>Pix</td><td><strong>PIX RECEBIDO - OUTRA IF</strong><br><span>Recebimento Pix
36.122.417 0001-74</span></td><td> 1.800,00C</td></tr>
<tr><td>07/10/2026</td><td></td><td>SALDO DO DIA</td><td>2.369,64C</td></tr>
<tr><td>30/09/2026</td><td></td><td>SALDO BLOQUEADO ANTERIOR</td><td>0,00*</td></tr>
<tr><td>30/09/2026</td><td></td><td>SALDO ANTERIOR</td><td>7.778,19C</td></tr>
</tbody></table><div class="titulo-tabela">LANÇAMENTOS FUTUROS</div><table><tr><th>DATA</th><th>DOCUMENTO</th><th>DESCRIÇÃO</th><th>VALOR</th></tr>
<tr><td>20/10/2026</td><td>2211822</td><td><strong>DÉB.TIT.COMPE EFETIVADO</strong><br>Casa alugada jacarezinho</td><td>710,00D</td></tr></table>
<div>RESUMO</div><table><tr><td>Saldo em conta:</td><td>168,49C</td></tr></table></body></html>`;

teste("extrato HTML do Sicoob: lançamentos com lado C/D, sem os futuros nem o bloqueado", async () => {
  const linhas = M.efLinhasDoHtml(HTML_SICOOB);
  assert.deepStrictEqual(linhas[0], ["DATA", "DOCUMENTO", "DESCRIÇÃO", "VALOR"]);
  assert.strictEqual(linhas.length, 5, JSON.stringify(linhas));
  assert.strictEqual(linhas[1][2], "PIX EMITIDO OUTRA IF · Pagamento Pix ***.144.048-** empreiteiro jacarezinho");
  assert.ok(!linhas.some((l) => /Casa alugada/.test(l.join(" "))), "futuro fica fora");
  assert.ok(!linhas.some((l) => /BLOQUEADO/.test(l.join(" "))));
  assert.strictEqual(M.efValorDeTexto("400,00D"), -400);
  assert.strictEqual(M.efValorDeTexto("1.800,00C"), 1800);
  assert.strictEqual(M.efValorDeTexto("0,00*"), 0);
  // o caminho inteiro: arquivo → colunas → movimentos
  const t = await M.efTabelaDoArquivo({ name: "extrato.html", text: async () => HTML_SICOOB });
  const mapa = M.detectarColunasTabela(t.linhas);
  assert.ok(mapa.completo, JSON.stringify(mapa.colunas));
  const movs = M.comIdsDosMovimentos(M.movimentosDaTabela(t.linhas, mapa));
  assert.deepStrictEqual(movs.filter((m) => M.efEhMovimento(m.historico)).map((m) => m.valor).sort((a, b) => a - b), [-400, 1800]);
  assert.strictEqual(M.saldoDoExtratoNoMes(movs, "2026-10"), 2369.64);
  assert.strictEqual(M.saldoDoExtratoNoMes(movs, "2026-09"), 7778.19);
});

teste("extrato novo com o SALDO ANTERIOR do mês passado não apaga o mês passado", () => {
  const set = { "2026-09": { origem: "planilha", movimentos: [
    { id: "a", data: "2026-09-10", valor: -50, historico: "PIX EMITIDO X" },
    { id: "s", data: "2026-09-30", valor: 7778.19, historico: "SALDO DO DIA" }], ignorados: { a: { motivo: "x" } } } };
  const out = [{ data: "2026-10-09", valor: -400, historico: "PIX EMITIDO Y" },
    { data: "2026-09-30", valor: 7778.19, historico: "SALDO ANTERIOR" }];
  const r = M.extratosComArquivo(set, M.comIdsDosMovimentos(out), "out.html", "2026-10-11T00:00:00Z");
  assert.deepStrictEqual(r.meses, ["2026-10"]);
  assert.strictEqual(r.extratos["2026-09"].movimentos.length, 3, "setembro fica e ganha o saldo anterior");
  assert.strictEqual(r.extratos["2026-09"].origem, "planilha");
  assert.ok(r.extratos["2026-09"].ignorados.a);
  assert.strictEqual(r.extratos["2026-10"].movimentos.length, 1);
});

teste("extrato OFX: valor com sinal, histórico NAME+MEMO e o saldo final", async () => {
  const ofx = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261009120000[-3:BRT]<TRNAMT>-400.00<FITID>abc1<CHECKNUM>Pix<NAME>PIX EMITIDO OUTRA IF<MEMO>Pagamento Pix ***.144.048-** empreiteiro</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261007<TRNAMT>1800.00<FITID>abc2<MEMO>PIX RECEBIDO 36.122.417 0001-74</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>168.49<DTASOF>20261013</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
  const linhas = M.efLinhasDoOfx(ofx);
  assert.deepStrictEqual(linhas[1], ["09/10/2026", "Pix", "Pagamento Pix ***.144.048-** empreiteiro · PIX EMITIDO OUTRA IF", "-400,00"]);
  assert.deepStrictEqual(linhas[2], ["07/10/2026", "abc2", "PIX RECEBIDO 36.122.417 0001-74", "1800,00"]);
  assert.deepStrictEqual(linhas[3], ["13/10/2026", "", "SALDO DO DIA", "168,49"]);
  const t = await M.efTabelaDoArquivo({ name: "extrato.ofx", text: async () => ofx });
  const mapa = M.detectarColunasTabela(t.linhas);
  const movs = M.movimentosDaTabela(t.linhas, mapa);
  assert.deepStrictEqual(movs.map((m) => m.valor), [-400, 1800, 168.49]);
});


teste("OFX do Sicoob: tipo no MEMO vem primeiro (igual ao HTML), CHECKNUM 0 não é documento, RDC fica fora, cp1252", async () => {
  const ofx = "OFXHEADER:100\r\nDATA:OFXSGML\r\nCHARSET:1252\r\n<OFX><BANKTRANLIST>\r\n" +
    "<STMTTRN>\r\n<TRNTYPE>DEBIT</TRNTYPE>\r\n<DTPOSTED>20261009120000[-3:BRT]</DTPOSTED>\r\n<TRNAMT>-400.00</TRNAMT>\r\n<FITID>20261009400001</FITID>\r\n<CHECKNUM>0</CHECKNUM>\r\n<REFNUM>Pix</REFNUM>\r\n<MEMO>PIX EMITIDO OUTRA IF</MEMO>\r\n<NAME>Pagamento Pix ***.144.048-** empreiteiro jacarezinho</NAME>\r\n</STMTTRN>\r\n" +
    "<STMTTRN>\r\n<TRNTYPE>DEBIT</TRNTYPE>\r\n<DTPOSTED>20261007120000[-3:BRT]</DTPOSTED>\r\n<TRNAMT>-779.18</TRNAMT>\r\n<FITID>x</FITID>\r\n<CHECKNUM>2299269</CHECKNUM>\r\n<REFNUM>2299269</REFNUM>\r\n<MEMO>DÉB.TIT.COMPE EFETIVADO</MEMO>\r\n<NAME>Escritorio de contabilidade</NAME>\r\n</STMTTRN>\r\n" +
    "<STMTTRN>\r\n<TRNTYPE>CREDIT</TRNTYPE>\r\n<DTPOSTED>20261005120000[-3:BRT]</DTPOSTED>\r\n<TRNAMT>5000.00</TRNAMT>\r\n<FITID>y</FITID>\r\n<CHECKNUM>47120</CHECKNUM>\r\n<REFNUM>47120</REFNUM>\r\n<MEMO>RESGATE RDC</MEMO>\r\n</STMTTRN>\r\n" +
    "</BANKTRANLIST><LEDGERBAL>\r\n<BALAMT>168.49</BALAMT>\r\n<DTASOF>20261013120000[-3:BRT]</DTASOF>\r\n</LEDGERBAL></OFX>";
  // o arquivo como o banco manda: bytes em Windows-1252
  const bytes = Uint8Array.from(Array.from(ofx).map((c) => (c === "É" ? 0xC9 : c.charCodeAt(0))));
  const t = await M.efTabelaDoArquivo({ name: "extrato.ofx", arrayBuffer: async () => bytes.buffer, text: async () => "" });
  assert.deepStrictEqual(t.linhas[1], ["09/10/2026", "Pix", "PIX EMITIDO OUTRA IF · Pagamento Pix ***.144.048-** empreiteiro jacarezinho", "-400,00"]);
  assert.deepStrictEqual(t.linhas[2], ["07/10/2026", "2299269", "DÉB.TIT.COMPE EFETIVADO · Escritorio de contabilidade", "-779,18"]);
  const movs = M.comIdsDosMovimentos(M.movimentosDaTabela(t.linhas, M.detectarColunasTabela(t.linhas)));
  assert.strictEqual(movs.filter((m) => M.efEhMovimento(m.historico)).length, 2, "resgate RDC fica fora da conta");
  assert.strictEqual(M.saldoDoExtratoNoMes(movs, "2026-10"), 168.49);
  // a mesma linha lida do HTML tem o mesmo id
  const html = M.comIdsDosMovimentos(M.movimentosDaTabela(M.efLinhasDoHtml(HTML_SICOOB), M.detectarColunasTabela(M.efLinhasDoHtml(HTML_SICOOB))));
  const idHtml = html.find((m) => m.valor === -400).id, idOfx = movs.find((m) => m.valor === -400).id;
  assert.strictEqual(idOfx, idHtml);
});

teste("colar arquivo: pega o arquivo do Ctrl+V e ignora texto", () => {
  const f = { name: "extrato.ofx" };
  assert.strictEqual(M.arquivoDoColar({ files: [f] }), f);
  assert.strictEqual(M.arquivoDoColar({ files: [], items: [{ kind: "file", getAsFile: () => f }] }), f);
  assert.strictEqual(M.arquivoDoColar({ files: [], items: [{ kind: "string", getAsFile: () => null }] }), null);
  assert.strictEqual(M.arquivoDoColar(null), null);
});

teste("Campo de valor: pontos e vírgula na tela, número limpo no formulário", () => {
  const passo = (t) => M.valorBRNaTela(M.valorBRDigitado(t));
  assert.strictEqual(passo("1"), "1");
  assert.strictEqual(passo("1800"), "1.800");
  assert.strictEqual(passo("1.8000"), "18.000");       // o ponto da tela não conta
  assert.strictEqual(passo("18.000,"), "18.000,");
  assert.strictEqual(passo("18.000,509"), "18.000,50"); // duas casas
  assert.strictEqual(passo("1234567,8"), "1.234.567,8");
  assert.strictEqual(M.valorBRDigitado("18.000,50"), "18000,50");
  assert.strictEqual(M.efValorDoCampo(M.valorBRDigitado("18.000,50")), 18000.5);
  assert.strictEqual(M.efValorDoCampo(M.valorBRDigitado("18.000")), 18000);
  assert.strictEqual(M.valorBRDigitado(",5"), "0,5");
  assert.strictEqual(M.valorBRDigitado("007"), "7");
  assert.strictEqual(M.valorBRDigitado("-150,3"), "150,3");
  assert.strictEqual(M.valorBRDigitado("-150,3", { negativo: true }), "-150,3");
  assert.strictEqual(M.valorBRNaTela("-12345,6"), "-12.345,6");
  // ao sair: centavos
  assert.strictEqual(M.valorBRCompleto("18000"), "18000,00");
  assert.strictEqual(M.valorBRCompleto("18000,5"), "18000,50");
  assert.strictEqual(M.valorBRCompleto(""), "");
  assert.strictEqual(M.valorBRCompleto("-"), "");
  // o que já estava gravado
  assert.strictEqual(M.valorBRDeFora(18000.5), "18000,5");
  assert.strictEqual(M.valorBRDeFora("18000,00"), "18000,00");
  assert.strictEqual(M.valorBRDeFora("R$ 18.000,00"), "18000,00");
  assert.strictEqual(M.valorBRDeFora("1234.56"), "1234,56");
  assert.strictEqual(M.valorBRDeFora(-168.49), "-168,49");
});

teste("Estornos bancários: boleto debitado e estornado se anulam — saldo do dia volta, resultado não muda", () => {
  const c = M.contaEscritorio("estornos_bancarios");
  assert.ok(c && M.grupoEscritorio(c.grupo).resultado === false);
  // o débito entra como saída; o crédito, na mesma conta, como estorno
  const deb = M.comSinalDeEstorno({ contaId: "estornos_bancarios", valor: "1187,00", sinalDoBanco: -1 });
  const cred = M.comSinalDeEstorno({ contaId: "estornos_bancarios", valor: "1187,00", sinalDoBanco: 1 });
  assert.strictEqual(deb.valor, 1187); assert.ok(!deb.estorno);
  assert.strictEqual(cred.valor, -1187); assert.strictEqual(cred.estorno, true);
  const base = [{ id: "r", contaId: "rec_projetos", unidadeId: "escritorio", valor: 5000, competencia: "2026-01" }];
  const sem = M.extratoEscritorio(base, { de: "2026-01", ate: "2026-02" });
  const com = M.extratoEscritorio(base.concat([
    { id: "d", contaId: "estornos_bancarios", unidadeId: "escritorio", valor: 1187, competencia: "2026-01" },
    { id: "e", contaId: "estornos_bancarios", unidadeId: "escritorio", valor: -1187, competencia: "2026-01", estorno: true },
  ]), { de: "2026-01", ate: "2026-02" });
  assert.strictEqual(com[0].saldoExtrato, sem[0].saldoExtrato);
  assert.strictEqual(com[0].saldoEscritorio, sem[0].saldoEscritorio);
  assert.strictEqual(com[0].ajustes, 0);
  // estorno que só volta no mês seguinte: o saldo de janeiro fica 1.187 menor, fevereiro volta
  const atraso = M.extratoEscritorio(base.concat([
    { id: "d", contaId: "estornos_bancarios", unidadeId: "escritorio", valor: 1187, competencia: "2026-01" },
    { id: "e", contaId: "estornos_bancarios", unidadeId: "escritorio", valor: -1187, competencia: "2026-02", estorno: true },
  ]), { de: "2026-01", ate: "2026-02" });
  assert.strictEqual(atraso[0].saldoExtrato, sem[0].saldoExtrato - 1187);
  assert.strictEqual(atraso[1].saldoExtrato, sem[1].saldoExtrato);
  assert.strictEqual(atraso[0].saldoEscritorio, sem[0].saldoEscritorio);
  // na conferência, cada ponta casa com a sua linha do extrato
  const movs = [
    { data: "2026-01-12", valor: -1187, abs: 1187, historico: "DÉB.TIT.COMPE EFETIVADO", documento: "1987703" },
    { data: "2026-01-12", valor: 1187, abs: 1187, historico: "ESTORNO DÉB.TIT.COMPE EFETIVADO", documento: "1987703" },
  ];
  const r = M.conciliarExtrato(movs, [
    { id: "d", contaId: "estornos_bancarios", unidadeId: "escritorio", valor: 1187, competencia: "2026-01", lancadoEm: "2026-01-12" },
    { id: "e", contaId: "estornos_bancarios", unidadeId: "escritorio", valor: -1187, estorno: true, competencia: "2026-01", lancadoEm: "2026-01-12" },
  ]);
  assert.strictEqual(r.resumo.casados, 2);
  const lado = (id) => r.casados.find((x) => x.lancamento.id === id).extrato.valor;
  assert.strictEqual(lado("d"), -1187);
  assert.strictEqual(lado("e"), 1187);
});

teste("Obra encerrada: sem cliente e obra do cadastro, mas com o nome escrito", () => {
  const base = { contaId: "pagamentos_compras", unidadeId: "gestao_obras", valor: -1187, competencia: "2026-01" };
  const sem = M.validarLancamentoEscritorio(base);
  assert.ok(sem.includes("Informe o cliente.") && sem.includes("Informe a obra."));
  const marcado = M.validarLancamentoEscritorio({ ...base, obraEncerrada: true });
  assert.deepStrictEqual(marcado, ["Escreva o cliente ou a obra antiga."]);
  assert.deepStrictEqual(M.validarLancamentoEscritorio({ ...base, obraEncerrada: true, cliente: "Residencial Villa Toscana", projeto: "Vila Matilde" }), []);
  // no escritório a marca não muda nada
  assert.deepStrictEqual(M.validarLancamentoEscritorio({ contaId: "utensilios", unidadeId: "escritorio", valor: 10, competencia: "2026-01", obraEncerrada: true }), []);
});

teste("Saldo da aplicação: grava por mês sem fechar, e o fechamento não apaga", () => {
  let f = M.comSaldoAplicacao({}, "2026-09", 152340.5);
  assert.strictEqual(M.saldoAplicacaoDoMes(f, "2026-09"), 152340.5);
  assert.strictEqual(M.mesEstaFechado("2026-09", f), false);
  assert.strictEqual(M.saldoAplicacaoDoMes(f, "2026-10"), null);
  // mês já com fechamento: guarda junto, sem mexer no saldo do banco
  f = M.comSaldoAplicacao({ "2026-08": { saldoBanco: 100, fechadoEm: "2026-09-02" } }, "2026-08", 0);
  assert.deepStrictEqual(f["2026-08"], { saldoBanco: 100, fechadoEm: "2026-09-02", saldoAplicacao: 0 });
  assert.strictEqual(M.saldoAplicacaoDoMes(f, "2026-08"), 0);
  // apagar o campo tira só ele; registro vazio sai
  assert.deepStrictEqual(M.comSaldoAplicacao(f, "2026-08", "")["2026-08"], { saldoBanco: 100, fechadoEm: "2026-09-02" });
  assert.deepStrictEqual(M.comSaldoAplicacao(M.comSaldoAplicacao({}, "2026-07", 5), "2026-07", null), {});
});

teste("Saldo do banco digitado: grava no mês sem fechar; total = banco + aplicação", () => {
  let f = M.comSaldoAplicacao({}, "2025-12", 362206.36);
  f = M.comSaldoBanco(f, "2025-12", 227.9);
  assert.strictEqual(M.mesEstaFechado("2025-12", f), false);
  assert.strictEqual(Math.round((M.saldoBancoDoMes(f, "2025-12") + M.saldoAplicacaoDoMes(f, "2025-12")) * 100) / 100, 362434.26);
  assert.deepStrictEqual(M.comSaldoBanco(f, "2025-12", "")["2025-12"], { saldoAplicacao: 362206.36 });
});

teste("Receita financeira do mês: banco + aplicação − calculado; o lançamento zera a diferença", () => {
  // dezembro/2025: a apuração anual já fechou a conta
  assert.strictEqual(M.receitaFinanceiraDoMes(362434.26, 227.9, 362206.36), 0);
  assert.strictEqual(M.receitaFinanceiraDoMes(100000, 500, 101800), 2300);
  assert.strictEqual(M.receitaFinanceiraDoMes(100000, null, 101800), null);
  assert.strictEqual(M.receitaFinanceiraDoMes(100000, 500, null), null);
  const l = M.lancamentoDoRendimento("2026-01", 2300);
  assert.strictEqual(l.contaId, "rec_financeira"); assert.strictEqual(l.unidadeId, "escritorio");
  assert.strictEqual(l.lancadoEm, "2026-01-31"); assert.strictEqual(l.competencia, "2026-01");
  assert.strictEqual(l.contaBanco, "nao"); assert.strictEqual(l.conferido, true);
  assert.deepStrictEqual(M.validarLancamentoEscritorio(l), []);
  assert.strictEqual(M.lancamentoDoRendimento("2026-02", 1).lancadoEm, "2026-02-28");
  // com ele, o calculado chega em banco + aplicação
  const base = [{ id: "a", contaId: "rec_projetos", unidadeId: "escritorio", valor: 1000, competencia: "2026-01" }];
  const antes = M.extratoEscritorio(base, { saldoAbertura: 99000 })[0].saldoExtrato;
  const depois = M.extratoEscritorio(base.concat([{ ...l, id: "r" }]), { saldoAbertura: 99000 })[0].saldoExtrato;
  assert.strictEqual(M.receitaFinanceiraDoMes(antes, 500, 101800), 2300);
  assert.strictEqual(M.receitaFinanceiraDoMes(depois, 500, 101800), 0);
  // já lançado: ajusta o mesmo, não cria outro
  const ex = { ...l, id: "r" };
  assert.strictEqual(M.rendimentoLancadoNoMes([ex], "2026-01"), ex);
  const aj = M.lancamentoDoRendimento("2026-01", 50, ex);
  assert.strictEqual(aj.id, "r"); assert.strictEqual(aj.valor, 2350);
});

teste("Débitos × créditos: o que não passa no extrato entra nos dois lados; sinal invertido aparece", () => {
  const movs = [
    { data: "2025-12-02", valor: -1000, historico: "PIX EMITIDO OUTRA IF" },
    { data: "2025-12-03", valor: 500, historico: "PIX RECEBIDO - OUTRA IF" },
    { data: "2025-12-05", valor: -33000, historico: "APLICAÇÃO RDC" },
    { data: "2025-12-06", valor: 1480, historico: "RESGATE RDC" },
    { data: "2025-12-06", valor: 227.9, historico: "SALDO DO DIA" },
    { data: "2025-11-30", valor: -99, historico: "PIX EMITIDO OUTRA IF" },   // outro mês
  ];
  const l = (id, contaId, valor, extra) => ({ id, contaId, valor, competencia: "2025-12", unidadeId: "escritorio", ...(extra || {}) });
  const base = [l("a", "utensilios", 1000), l("b", "rec_projetos", 500),
    // comissão recebida e repassada, fora do extrato: os dois lados
    l("c", "rec_gestao", 5385.63), l("d", "pagamentos_compras", 5385.63),
    // rendimento da aplicação não entra na conta
    l("r", "rec_financeira", 21119.81, { descricao: "Receita de aplicação financeira" })];
  const r = M.checagemDebitoCredito(movs, base, "2025-12");
  assert.deepStrictEqual([r.extrato.debitos, r.extrato.creditos, r.extrato.aplicacoes, r.extrato.resgates], [1000, 500, 33000, 1480]);
  assert.deepStrictEqual([r.base.saidas, r.base.entradas, r.base.rendimento], [6385.63, 5885.63, 21119.81]);
  assert.strictEqual(r.bate, true); assert.strictEqual(r.foraDoExtrato, 5385.63);
  // a despesa de 1.000 lançada como receita: as diferenças se afastam 2.000
  const inv = M.checagemDebitoCredito(movs, base.map((x) => (x.id === "a" ? { ...x, contaId: "rec_projetos" } : x)), "2025-12");
  assert.strictEqual(inv.bate, false); assert.strictEqual(Math.abs(inv.desvio), 2000);
  assert.deepStrictEqual(inv.suspeitos.map((x) => x.id), ["a"]);
  // estorno (valor negativo) vai para o outro lado, como no banco
  const est = M.checagemDebitoCredito([{ data: "2025-12-09", valor: 90, historico: "ESTORNO" }], [l("e", "utensilios", -90)], "2025-12");
  assert.strictEqual(est.bate, true); assert.strictEqual(est.base.entradas, 90);
  // aplicação pelo caminho dela (números da planilha de dezembro)
  assert.deepStrictEqual(M.rendimentoPelaAplicacao(391301.31, 33000, 85964.76, 362206.36), { principal: 338336.55, rendimento: 23869.81 });
  assert.strictEqual(M.rendimentoPelaAplicacao(null, 1, 1, 1), null);
});

teste("Estorno no extrato: acha o PIX original e volta para a mesma conta", () => {
  const est = { id: "x1", data: "2026-03-10", valor: 298.1, historico: "ESTORNO PIX EMITIDO · Estorno Pix 76.966.860/0001-46" };
  assert.strictEqual(M.ehLinhaDeEstorno(est.historico), true);
  assert.strictEqual(M.ehLinhaDeEstorno("PIX EMITIDO OUTRA IF"), false);
  const lancs = [
    // mesmo valor, outro fornecedor, sem pista — perde para o do CNPJ
    { id: "a", contaId: "utensilios", unidadeId: "escritorio", valor: 298.1, competencia: "2026-02", lancadoEm: "2026-02-25", historicoBanco: "PIX EMITIDO OUTRA IF · Kalunga" },
    { id: "o", contaId: "pagamentos_compras", unidadeId: "gestao_obras", valor: 298.1, competencia: "2026-02", lancadoEm: "2026-02-23",
      clienteId: "c1", cliente: "Cliente X", obraId: "ob1", projeto: "Obra X", fornecedor: "Pão de Açucar", fornecedorId: "f1",
      historicoBanco: "PIX EMITIDO OUTRA IF · Pagamento Pix · 76.966.860 0001-46", descricao: "Compras" },
    // depois do estorno: não é o original
    { id: "d", contaId: "pagamentos_compras", unidadeId: "gestao_obras", valor: 298.1, competencia: "2026-03", lancadoEm: "2026-03-20" },
  ];
  const r = M.originalDoEstorno(est, lancs, {});
  assert.strictEqual(r.lancamento.id, "o"); assert.strictEqual(r.porDocumento, true);
  const sug = M.sugestaoDeEstorno(est, lancs, {});
  assert.strictEqual(sug.estorno, true); assert.strictEqual(sug.campos.contaId, "pagamentos_compras");
  assert.strictEqual(sug.campos.clienteId, "c1"); assert.strictEqual(sug.campos.estornoDe, "o");
  assert.match(sug.motivos[0], /^estorno do lançamento de 23\/02\/2026: Pagamentos e compras · Pão de Açucar/);
  const pronto = M.lancamentoDoEstornoDoExtrato(est, "2026-03", sug, {});
  assert.ok(pronto.lancamento, pronto.erro);
  assert.strictEqual(pronto.lancamento.valor, -298.1); assert.strictEqual(pronto.lancamento.estorno, true);
  assert.strictEqual(pronto.lancamento.contaId, "pagamentos_compras"); assert.strictEqual(pronto.lancamento.competencia, "2026-03");
  // a tela passa de novo pelo sinal ao gravar: o estorno continua negativo
  assert.strictEqual(M.comSinalDeEstorno(pronto.lancamento).valor, -298.1);
  // já estornado: não acha de novo
  assert.strictEqual(M.originalDoEstorno(est, lancs.concat([{ id: "e", estornoDe: "o", contaId: "pagamentos_compras", valor: -298.1, lancadoEm: "2026-03-10" }]), {}).lancamento.id, "a");
  // dois iguais sem pista nenhuma: não chuta
  const ambiguo = [{ id: "p", contaId: "utensilios", valor: 50, lancadoEm: "2026-03-01" }, { id: "q", contaId: "utensilios", valor: 50, lancadoEm: "2026-03-02" }];
  assert.strictEqual(M.originalDoEstorno({ data: "2026-03-10", valor: 50, historico: "ESTORNO PIX" }, ambiguo.concat([{ id: "z", contaId: "luz_agua_net", valor: 50, lancadoEm: "2026-03-03" }]), {}), null);
  // empatados com a MESMA classificação (três taxas iguais da prefeitura): qualquer um serve
  const iguais = [1, 2, 3].map((i) => ({ id: "t" + i, contaId: "pagamentos_compras", unidadeId: "gestao_obras", cliente: "Jacarezinho Mod 3 a 4",
    projeto: "Módulo 3 a 4", fornecedor: "Prefeitura Jacarezinho", valor: 298.1, lancadoEm: "2026-03-06" }));
  const r3 = M.originalDoEstorno({ data: "2026-03-10", valor: 298.1, historico: "ESTORNO PIX EMITIDO" }, iguais, {});
  assert.ok(r3 && r3.lancamento.fornecedor === "Prefeitura Jacarezinho");
});

teste("Estorno de custo de obra: volta para a obra, mesma conta e etapa", () => {
  const obra = { id: "ob3", nome: "Jacarezinho Módulo 3", clienteId: "e3",
    contasPagar: [{ id: "k1", contaId: "outras_taxas", etapa: "pre_obra", valor: 298.1, valorPago: 298.1, pago: true, pagoEm: "2026-02-23", descricao: "Taxa" }] };
  const cli = { id: "e3", nome: "Jacarezinho Módulo 3", servicos: { empreendimento: true } };
  const ponte = { id: "pt", contaId: "emp_taxas", unidadeId: "empreendimento", valor: 298.1, lancadoEm: "2026-02-23",
    historicoBanco: "PIX EMITIDO · 76.966.860/0001-46", origem: { obraId: "ob3", tipo: "conta", refId: "k1", contaObra: "outras_taxas" } };
  const est = { id: "x1", data: "2026-03-10", valor: 298.1, historico: "ESTORNO PIX EMITIDO · Estorno Pix 76.966.860/0001-46" };
  const sug = M.sugestaoDeEstorno(est, [ponte], { obras: [obra], clientes: [cli] });
  assert.strictEqual(sug.naObra, true);
  assert.deepStrictEqual([sug.campos.unidadeId, sug.campos.contaFonte, sug.campos.contaId, sug.campos.obraIdAlvo, sug.campos.etapaUnica],
    ["empreendimento", "obra", "outras_taxas", "ob3", "pre_obra"]);
  const pronto = M.lancamentoDoEstornoDoExtrato(est, "2026-03", sug, {});
  assert.ok(pronto.lancamento, pronto.erro);
  assert.strictEqual(pronto.lancamento.naObra, true); assert.strictEqual(pronto.lancamento.estornoNaObra, true);
  assert.strictEqual(pronto.lancamento.itens[0].etapa, "pre_obra"); assert.strictEqual(pronto.lancamento.valor, 298.1);
});

teste("Duas pontas: estorno de original da base antiga acha a conta na obra e liga; sem a conta, não estorna só de um lado", () => {
  const obra = { id: "ob1", nome: "Jacarezinho Módulo 1", clienteId: "e1",
    contasPagar: [{ id: "k1", contaId: "outras_taxas", etapa: "pre_obra", valor: 662.97, valorPago: 662.97, pago: true, pagoEm: "2026-03-06", doc: "4039", descricao: "IPTU 2026" }] };
  const cli = { id: "e1", nome: "Jacarezinho Módulo 1", servicos: { empreendimento: true } };
  const orig = { id: "o1", contaId: "emp_taxas", unidadeId: "empreendimento", clienteId: "e1", empreendimentoId: "e1", valor: 662.97,
    lancadoEm: "2026-03-06", documento: "4039", descricao: "IPTU 2026", fornecedor: "Prefeitura" };
  const est = { id: "x", data: "2026-03-10", valor: 662.97, historico: "ESTORNO PIX EMITIDO · Estorno Pix 76.966.860/0001-46" };
  const sug = M.sugestaoDeEstorno(est, [orig], { obras: [obra], clientes: [cli] });
  assert.strictEqual(sug.naObra, true); assert.ok(!sug.bloqueio);
  assert.deepStrictEqual(sug.campos.ligarOriginal, { id: "o1", origem: { obraId: "ob1", tipo: "conta", refId: "k1", contaObra: "outras_taxas" } });
  const pronto = M.lancamentoDoEstornoDoExtrato(est, "2026-03", sug, {});
  assert.ok(pronto.lancamento && pronto.lancamento.estornoNaObra && pronto.lancamento.ligarOriginal);
  // a conta já é de outro lançamento: não serve
  const outro = { id: "o2", contaId: "emp_taxas", valor: 662.97, origem: { obraId: "ob1", tipo: "conta", refId: "k1" } };
  assert.strictEqual(M.contasDaObraSemLigacao(orig, [obra], [orig, outro]).length, 0);
  // a obra existe mas não tem a conta: bloqueia o estorno rápido e abre no caminho da obra
  const vazia = { ...obra, contasPagar: [] };
  const sug2 = M.sugestaoDeEstorno(est, [orig], { obras: [vazia], clientes: [cli] });
  assert.ok(sug2.bloqueio && /só no escritório/.test(sug2.bloqueio));
  assert.deepStrictEqual([sug2.campos.contaFonte, sug2.campos.obraIdAlvo, sug2.campos.unidadeId], ["obra", "ob1", "empreendimento"]);
  assert.ok(M.lancamentoDoEstornoDoExtrato(est, "2026-03", sug2, {}).erro);
  // sem obra no VICKE (gestão antiga): estorna só no escritório, como antes
  const sug3 = M.sugestaoDeEstorno(est, [orig], { obras: [], clientes: [cli] });
  assert.ok(!sug3.bloqueio && !sug3.naObra);
  // "Lançar assim" de custo antigo só do escritório para cliente com obra: não
  const linha = { id: "y", data: "2026-04-02", valor: -100, historico: "PIX EMITIDO" };
  const copia = { campos: { contaId: "emp_taxas", unidadeId: "empreendimento", clienteId: "e1", empreendimentoId: "e1" } };
  assert.ok(/obra no VICKE/.test(M.lancamentoRapidoDoExtrato(linha, "2026-04", copia, {}, [obra]).erro || ""));
  assert.ok(!/obra no VICKE/.test(M.lancamentoRapidoDoExtrato(linha, "2026-04", copia, {}, []).erro || ""));
});

teste("Já está na obra: linha do banco acha a conta paga na obra sem lançamento no escritório e liga (sem lançar de novo)", () => {
  const cli = { id: "e1", nome: "Jacarezinho Módulo 1", servicos: { empreendimento: true } };
  const obra = { id: "ob1", nome: "Jacarezinho Módulo 1", clienteId: "e1", contasPagar: [
    { id: "k1", contaId: "empreiteiro", etapa: "fundacao", descricao: "Pintura formas metálicas", favorecido: "Paulo Serralheiro",
      valor: 1500, valorPago: 1500, pago: true, pagoEm: "2026-07-27", numeroDoc: "0059", doc: "4109" },
    { id: "k2", contaId: "empreiteiro", descricao: "Limpeza mato", valor: 1500, valorPago: 1500, pago: true, pagoEm: "2026-09-24", numeroDoc: "0151" }] };
  const ligado = { id: "l2", contaId: "emp_construcao", valor: 1500, origem: { obraId: "ob1", tipo: "conta", refId: "k2" } };
  const m = { id: "x", data: "2026-07-21", valor: -1500, historico: "PIX EMITIDO OUTRA IF · Pagamento Pix ***.469.198-** pintura formas metalicas Jacarezinho" };
  const ctx = { obras: [obra], clientes: [cli], planoObra: PLANO_OBRA_T };
  const sug = M.contaDaObraParaALinha(m, [ligado], ctx);
  assert.ok(sug && sug.jaNaObra); assert.deepStrictEqual(sug.contas.map((c) => c.id), ["k1"]);
  assert.match(sug.motivos[0], /já está na obra Jacarezinho Módulo 1: Pintura formas metálicas · Paulo Serralheiro · paga em 27\/07\/2026/);
  const r = M.lancamentoDaLigacaoComObra(m, "2026-07", sug, {}, [ligado]);
  assert.ok(r.lancamento, r.erro);
  assert.strictEqual(r.lancamento.id, "ponte:ob1:conta:k1");
  assert.deepStrictEqual([r.lancamento.contaId, r.lancamento.unidadeId, r.lancamento.valor, r.lancamento.competencia, r.lancamento.lancadoEm, r.lancamento.numeroDoc],
    ["emp_construcao", "empreendimento", 1500, "2026-07", "2026-07-21", "0059"]);
  assert.deepStrictEqual(r.lancamento.ligarObra, { obraId: "ob1", contaIds: ["k1"] });
  assert.strictEqual(r.lancamento.extratoId, "x");
  // já ligada: some da sugestão
  assert.strictEqual(M.contaDaObraParaALinha(m, [ligado, r.lancamento], ctx), null);
  // longe da data (mais de 20 dias) não é a mesma
  assert.strictEqual(M.contaDaObraParaALinha({ ...m, data: "2026-06-01" }, [ligado], ctx), null);
  // entrada no banco não procura custo
  assert.strictEqual(M.contaDaObraParaALinha({ ...m, valor: 1500 }, [ligado], ctx), null);
  // dois iguais sem pista no histórico: não escolhe
  const dois = { ...obra, contasPagar: [obra.contasPagar[0], { ...obra.contasPagar[0], id: "k3", descricao: "Outro serviço", favorecido: "" }] };
  assert.strictEqual(M.contaDaObraParaALinha({ ...m, historico: "PIX EMITIDO" }, [], { ...ctx, obras: [dois] }), null);
  // o formulário usa a mesma busca para travar o custo em dobro
  assert.strictEqual(M.contasIguaisNaObra(obra, 1500, "2026-07-21", [ligado], 20).length, 1);
});

teste("Conferência: sobrou sem linha do banco, mas o gêmeo (mesma conta e valor) já casou — provável duplicado", () => {
  const movs = [{ id: "m1", data: "2026-08-05", valor: 10833.33, historico: "PIX RECEBIDO - OUTRA IF · Recebimento Pix ALEXANDRE" }];
  const ponte = { id: "p1", contaId: "rec_gestao", unidadeId: "gestao_obras", valor: 10833.33, competencia: "2026-08", lancadoEm: "2026-08-05",
    descricao: "Parcela 1/12 (mensal)", origem: { obraId: "ob", tipo: "conta", refId: "x:1" }, contaBanco: "sim" };
  const antigo = { id: "a1", contaId: "rec_gestao", unidadeId: "gestao_obras", valor: 10833.33, competencia: "2026-08", lancadoEm: "2026-08-23",
    descricao: "Taxa de gestão de obra", contaBanco: "sim" };
  const r = M.conciliarExtrato(movs, [ponte, antigo], { mes: "2026-08" });
  assert.strictEqual(r.casados.length, 1); assert.strictEqual(r.casados[0].lancamento.id, "p1");
  assert.deepStrictEqual(r.contabilizadoSemPar.map((l) => l.id), ["a1"]);
  assert.strictEqual(r.duplicados.a1.lancamento.id, "p1");
  // valor diferente não é gêmeo
  const r2 = M.conciliarExtrato(movs, [ponte, { ...antigo, valor: 500 }], { mes: "2026-08" });
  assert.deepStrictEqual(Object.keys(r2.duplicados), []);
});

teste("Parcela de gestão: a ponte que guardou o #n de um estorno já desfeito ainda acha a parcela", () => {
  const obra = { id: "ob", contasPagar: [{ id: "ct:1", contaId: "taxa_admin_obra", pago: true, valor: 10833.33 }] };
  const l = { id: "p", origem: { obraId: "ob", tipo: "conta", refId: "ct:1#1", contaObra: "taxa_admin_obra" } };
  assert.strictEqual((M.parcelaDoLancamento(obra, l) || {}).id, "ct:1");
  assert.strictEqual(M.parcelaDoLancamento(obra, { ...l, origem: { ...l.origem, refId: "ct:2" } }), null);
});

teste("Conferência: saída que sobrou com entrada do mesmo valor sem lançamento no banco — sinal invertido (reembolso)", () => {
  const movs = [{ id: "d", data: "2026-08-11", valor: -57.47, historico: "DÉB.CONV.PREFEITURA" },
    { id: "c", data: "2026-08-11", valor: 57.47, historico: "PIX RECEBIDO - OUTRA IF · Recebimento Pix DAYANE GIACON SALARO" }];
  const pago = { id: "a", contaId: "pagamentos_compras", unidadeId: "gestao_obras", valor: 57.47, competencia: "2026-08", lancadoEm: "2026-08-11", contaBanco: "sim" };
  const errado = { id: "b", contaId: "pagamentos_compras", unidadeId: "projetos", valor: 57.47, competencia: "2026-08", lancadoEm: "2026-08-23", contaBanco: "sim" };
  const r = M.conciliarExtrato(movs, [pago, errado], { mes: "2026-08" });
  assert.deepStrictEqual(r.contabilizadoSemPar.map((l) => l.id), ["b"]);
  assert.strictEqual(r.invertidos.b.extrato.id, "c");
  assert.strictEqual(r.duplicados.b.lancamento.id, "a");      // também tem gêmeo — a tela mostra o invertido
});
teste("Já está na obra: a planilha da obra registra semanas depois do banco (até 45 dias à frente)", () => {
  const cli = { id: "e1", nome: "Jacarezinho Módulo 1", servicos: { empreendimento: true } };
  const obra = { id: "ob1", nome: "Jacarezinho Módulo 1", clienteId: "e1", contasPagar: [
    { id: "k", contaId: "frete", descricao: "Pedágio rodovia obra", valor: 12.8, valorPago: 12.8, pago: true, pagoEm: "2026-09-22", numeroDoc: "0098" }] };
  const plano = PLANO_OBRA_T.concat([]);
  const m = { id: "x", data: "2026-08-28", valor: -12.8, historico: "PIX EMITIDO OUTRA IF · Pagamento Pix 51.137.031 0001-20" };
  const sug = M.contaDaObraParaALinha(m, [], { obras: [obra], clientes: [cli], planoObra: plano });
  assert.ok(sug && sug.contas[0].id === "k");
  // 25 dias ANTES do banco já não serve
  assert.strictEqual(M.contaDaObraParaALinha({ ...m, data: "2026-10-17" }, [], { obras: [obra], clientes: [cli], planoObra: plano }), null);
});

teste("Investido do empreendimento: o que passou pela conta + o pago na obra por fora, sem contar duas vezes a base antiga", () => {
  const cli = { id: "e1", nome: "Jacarezinho Módulo 1", servicos: { empreendimento: true } };
  const obra = { id: "ob1", clienteId: "e1", contasPagar: [
    { id: "k1", contaId: "material", valor: 1000, valorPago: 1000, pago: true, pagoEm: "2026-07-01" },              // ligada
    { id: "k2", contaId: "material", valor: 7200, valorPago: 7200, pago: true, pagoEm: "2026-09-23" },              // só na obra (cartão)
    { id: "k3", contaId: "impostos", valor: 496.74, valorPago: 496.74, pago: true, pagoEm: "2025-05-07", doc: "3429" }, // base antiga sem ligação
    { id: "k4", contaId: "deposito_proprio", valor: 5000, valorPago: 5000, pago: true, pagoEm: "2026-09-24" },      // entrada: não é custo
    { id: "k5", contaId: "material", valor: 300, pago: false }] };                                                    // não paga
  const lancs = [
    { id: "a", contaId: "emp_construcao", empreendimentoId: "e1", valor: 1000, competencia: "2026-07", lancadoEm: "2026-07-01", origem: { obraId: "ob1", tipo: "conta", refId: "k1" } },
    { id: "b", contaId: "emp_taxas", empreendimentoId: "e1", unidadeId: "empreendimento", valor: 496.74, competencia: "2025-05", lancadoEm: "2025-05-07", documento: "3429" },
    { id: "c", contaId: "emp_taxas", empreendimentoId: "e1", valor: 1438.29, competencia: "2026-04", lancadoEm: "2026-04-16" }];  // só no escritório
  const r = M.investidoDoEmpreendimento(cli, [obra], lancs, { planoObra: PLANO_OBRA_T });
  assert.deepStrictEqual(r, { pelaConta: 2935.03, foraDaConta: 7200, total: 10135.03 });
});

teste("Base antiga sem ligação: duas contas iguais no mesmo dia se separam pelo número do papel", () => {
  const obra = { id: "ob", contasPagar: [
    { id: "r1", contaId: "outras_taxas", valor: 125.4, valorPago: 125.4, pago: true, pagoEm: "2025-05-21", doc: "3446" },
    { id: "r2", contaId: "outras_taxas", valor: 125.4, valorPago: 125.4, pago: true, pagoEm: "2025-05-21", doc: "3447" }] };
  const l = { id: "x", valor: 125.4, lancadoEm: "2025-05-21", documento: "3447" };
  assert.deepStrictEqual(M.contasDaObraSemLigacao(l, [obra], []).map((a) => a.k.id), ["r2"]);
  // sem papel: as duas servem, e quem chama não escolhe
  assert.strictEqual(M.contasDaObraSemLigacao({ ...l, documento: "" }, [obra], []).length, 2);
  // valor igual com 1 dia de diferença ainda é a mesma
  assert.strictEqual(M.contasDaObraSemLigacao({ id: "c", valor: 780, lancadoEm: "2026-09-23" },
    [{ id: "o2", contasPagar: [{ id: "c1", valor: 780, valorPago: 780, pago: true, pagoEm: "2026-09-24" }] }], []).length, 1);
});

teste("Projeto ganho: parcela a receber, recebida pela linha do banco; engenharia é receita, custo de parceiro e reserva, sem mexer no saldo", () => {
  const cli = { id: "g1", nome: "Gustavo (Santa Cruz)" };
  const orc = { id: "ORC-0088", clienteId: "g1", referencia: "Ampliação fundo residência", status: "ganho",
    fechamento: { valorTotalFechado: 16000, valorArqFechado: 12000, valorEngFechado: 4000, inclEng: true,
      condicao: { tipo: "antecipado", parcelas: [{ numero: 1, nome: "Antecipado", valor: 16000, data: "2026-10-10" }] } } };
  const ps = M.parcelasDosProjetos([orc, { ...orc, id: "X", status: "aberto" }], [cli], []);
  assert.strictEqual(ps.length, 1);
  assert.deepStrictEqual([ps[0].arq, ps[0].eng, ps[0].recebida], [12000, 4000, false]);
  const m = { id: "b1", data: "2026-10-11", valor: 16000, historico: "PIX RECEBIDO - OUTRA IF · Recebimento Pix GUSTAVO SILVA" };
  const ctx = { orcamentos: [orc], clientes: [cli] };
  const sug = M.parcelaDeProjetoParaALinha(m, [], ctx);
  assert.ok(sug && sug.parcelaProjeto.orcId === "ORC-0088");
  assert.strictEqual(M.parcelaDeProjetoParaALinha({ ...m, valor: -16000 }, [], ctx), null);     // saída não é recebimento
  assert.strictEqual(M.parcelaDeProjetoParaALinha({ ...m, valor: 15000 }, [], ctx), null);      // outro valor
  const r = M.lancamentosDoRecebimento(m, "2026-10", sug, {});
  const l = r.lancamento;
  assert.deepStrictEqual([l.contaId, l.unidadeId, l.valor, l.extratoId, l.origem.parte, l.competencia], ["rec_projetos", "projetos", 16000, "b1", "recebido", "2026-10"]);
  const [a, b] = l.recebimentoExtras;
  assert.deepStrictEqual([a.contaId, a.valor, a.contaBanco, b.contaId, b.valor, b.contaBanco], ["parceiros", 4000, "nao", "res_engenharia", 4000, "nao"]);
  // depois de recebida, não sugere de novo e sai do a receber
  const lancs = [{ ...l, id: "r1" }, { ...a, id: "r2" }, { ...b, id: "r3" }];
  assert.strictEqual(M.parcelaDeProjetoParaALinha(m, lancs, ctx), null);
  assert.strictEqual(M.parcelasDosProjetos([orc], [cli], lancs)[0].recebida, true);
  // no extrato: receita 16.000, custo de parceiro 4.000 (resultado 12.000), reserva 4.000, saldo +16.000 (o que caiu no banco)
  const ext = M.extratoEscritorio(lancs, { saldoAbertura: 0 });
  const out = ext.find((x) => x.mes === "2026-10");
  assert.deepStrictEqual([out.contas.rec_projetos, out.contas.parceiros, out.saldoEscritorio, out.saldoReservas, out.saldoExtrato], [16000, 4000, 12000, 4000, 16000]);
  // sem engenharia: só a receita
  const so = M.lancamentosDoRecebimento(m, "2026-10", { parcelaProjeto: { ...sug.parcelaProjeto, eng: 0 } }, {});
  assert.strictEqual(so.lancamento.recebimentoExtras.length, 0);
});

teste("Projeto ganho já pago (antecipado): lança receita e reserva na hora; o PIX do extrato casa depois e a reserva não fica 'faltando no banco'", () => {
  const cli = { id: "g1", nome: "Gustavo (Santa Cruz)" };
  const orc = { id: "ORC-0088", clienteId: "g1", referencia: "Ampliação fundo residência", status: "ganho",
    fechamento: { valorTotalFechado: 15000, valorArqFechado: 9916.15, valorEngFechado: 5083.85, inclEng: true,
      condicao: { tipo: "antecipado", parcelas: [{ nome: "1ª Parcela", valor: 15000, data: "2026-10-13" }] } } };
  let n = 0;
  const ctx = { clientes: [cli], lancamentos: [], fechamentos: {}, novoId: () => "id" + (++n), numeroDoc: (l) => String(4200 + l.length) };
  const r = M.lancamentosDoGanhoRecebido(orc, [1], ctx);
  assert.ok(!r.erro, r.erro);
  const ls = r.lancamentos;
  assert.deepStrictEqual(ls.map((l) => [l.contaId, l.valor, l.contaBanco, l.origem.parte]),
    [["rec_projetos", 15000, "sim", "recebido"], ["parceiros", 5083.85, "nao", "eng-custo"], ["res_engenharia", 5083.85, "nao", "eng-reserva"]]);
  assert.deepStrictEqual(ls.map((l) => l.parDe), [undefined, "id1", "id1"]);
  assert.deepStrictEqual(ls.map((l) => l.descricao), ["Recebimento de projeto — pagamento único antecipado",
    "Custo da engenharia (parceiro) — pagamento único antecipado", "Reserva para pagar a engenharia — pagamento único antecipado"]);
  assert.deepStrictEqual([M.rotuloDaParcelaDeProjeto("parcelado", 2, 4, "2ª Parcela"), M.rotuloDaParcelaDeProjeto("etapas", 1, 4, "Estudo Preliminar"),
    M.rotuloDaParcelaDeProjeto("parcelado", 1, 1, "1ª Parcela")], ["parcela 2/4", "etapa 1/4 · Estudo Preliminar", "pagamento único"]);
  assert.deepStrictEqual([ls[0].lancadoEm, ls[0].competencia, ls[0].clienteId, ls[0].extratoId], ["2026-10-13", "2026-10", "g1", undefined]);
  assert.ok(ls.every((l) => l.numeroDoc === ls[0].numeroDoc && l.tipo === "escritorio" && !("recebimentoExtras" in l)));
  // sai do a receber; a linha do banco não é sugerida como parcela de novo
  assert.strictEqual(M.parcelasDosProjetos([orc], [cli], ls)[0].recebida, true);
  const pix = { id: "b9", data: "2026-10-13", valor: 15000, historico: "PIX RECEBIDO GUSTAVO" };
  assert.strictEqual(M.parcelaDeProjetoParaALinha(pix, ls, { orcamentos: [orc], clientes: [cli] }), null);
  // na conferência: o PIX casa com a receita; a reserva (fora da conta) não aparece como faltando
  const c = M.conciliarExtrato([pix], ls, {});
  assert.deepStrictEqual([c.casados.length, c.casados[0].lancamento.id, c.contabilizadoSemPar.length, c.noBancoSemPar.length], [1, "id1", 0, 0]);
  // nem casa uma linha de 5.083,85 do banco com a reserva
  const c2 = M.conciliarExtrato([{ id: "b10", data: "2026-10-14", valor: 5083.85, historico: "PIX" }], ls, {});
  assert.deepStrictEqual([c2.noBancoSemPar.length, c2.contabilizadoSemPar.length], [1, 1]);
  // de novo não lança outra vez; sem data ou com mês fechado, não lança
  assert.strictEqual(M.lancamentosDoGanhoRecebido(orc, [1], { ...ctx, lancamentos: ls }).lancamentos.length, 0);
  const semData = { ...orc, fechamento: { ...orc.fechamento, condicao: { parcelas: [{ nome: "1ª Parcela", valor: 15000, data: "" }] } } };
  assert.ok(M.lancamentosDoGanhoRecebido(semData, [1], ctx).erro);
  assert.ok(/fechado/.test(M.lancamentosDoGanhoRecebido(orc, [1], { ...ctx, fechamentos: { "2026-10": { fechadoEm: "x" } } }).erro));
  assert.deepStrictEqual(M.lancamentosDoGanhoRecebido(orc, [], ctx).lancamentos, []);
  // pelo data inteiro: só a parcela marcada "recebida" entra; sem marca, nada muda
  const velho = { id: "v1", contaId: "rec_projetos", valor: 10 };
  const marcado = { ...orc, fechamento: { ...orc.fechamento, condicao: { parcelas: [{ numero: 1, nome: "1ª Parcela", valor: 15000, data: "2026-10-13", recebida: true }] } } };
  const d = { clientes: [cli], lancamentos: [velho], obras: [], escritorio: {} };
  const rr = M.lancamentosComGanhoRecebido(d, marcado);
  assert.deepStrictEqual([rr.lancamentos.length, rr.novos.length, rr.lancamentos[0]], [4, 3, velho]);
  const nada = M.lancamentosComGanhoRecebido(d, orc);
  assert.deepStrictEqual([nada.lancamentos, nada.novos.length], [d.lancamentos, 0]);
  const fechado = M.lancamentosComGanhoRecebido({ ...d, escritorio: { financeiro: { fechamentos: { "2026-10": { fechadoEm: "x" } } } } }, marcado);
  assert.ok(fechado.erro);
});

teste("Engenheiro pago: sai da reserva (o custo já entrou no recebimento), sem custo em dobro; só o que passa da reserva é custo em Parceiros", () => {
  const rec = [
    { id: "r1", tipo: "escritorio", contaId: "rec_projetos", valor: 15000, competencia: "2026-10", lancadoEm: "2026-10-13", clienteId: "g1", contaBanco: "sim" },
    { id: "r2", tipo: "escritorio", contaId: "parceiros", valor: 5083.85, competencia: "2026-10", lancadoEm: "2026-10-13", clienteId: "g1", contaBanco: "nao" },
    { id: "r3", tipo: "escritorio", contaId: "res_engenharia", valor: 5083.85, competencia: "2026-10", lancadoEm: "2026-10-13", clienteId: "g1", contaBanco: "nao" },
  ];
  assert.strictEqual(M.saldoDaReservaEngenharia(rec, "g1"), 5083.85);
  assert.strictEqual(M.saldoDaReservaEngenharia(rec, "outro"), 0);
  const pg = { tipo: "escritorio", unidadeId: "projetos", contaId: "parceiros", valor: 3000, competencia: "2026-11", lancadoEm: "2026-11-05", clienteId: "g1", contaBanco: "sim", descricao: "PIX ENG FULANO", sinalDoBanco: -1 };
  const r = M.comoPagamentoDaReserva(pg, rec);
  assert.deepStrictEqual([r.contaId, r.valor, r.estorno, r.contaBanco, "sinalDoBanco" in r], ["res_engenharia", -3000, true, "sim", false]);
  // passa da reserva: a linha do banco inteira em Parceiros e o par fora do banco tira a parte da reserva
  const p6 = M.comoPagamentoDaReserva({ ...pg, valor: 6000 }, rec);
  assert.deepStrictEqual([p6.contaId, p6.valor, p6.contaBanco, p6.pagoDaReserva], ["parceiros", 6000, "sim", 5083.85]);
  assert.deepStrictEqual(p6.recebimentoExtras.map((x) => [x.contaId, x.valor, x.contaBanco, x.clienteId, x.competencia]),
    [["parceiros", -5083.85, "nao", "g1", "2026-11"], ["res_engenharia", -5083.85, "nao", "g1", "2026-11"]]);
  const com6 = rec.concat([{ ...p6, id: "p6", recebimentoExtras: undefined }, ...p6.recebimentoExtras.map((x, i) => ({ ...x, id: "p6_" + i, parDe: "p6" }))]);
  const n6 = M.extratoEscritorio(com6, { saldoAbertura: 0 }).find((x) => x.mes === "2026-11");
  // custo novo só 916,15; reserva zera; o banco cai os 6.000
  assert.deepStrictEqual([n6.contas.parceiros, n6.saldoEscritorio, n6.saldoReservas, n6.saldoExtrato], [916.15, -916.15, -5083.85, 15000 - 6000]);
  assert.strictEqual(M.saldoDaReservaEngenharia(com6, "g1"), 0);
  // a conferência casa a linha de 6.000 com o pagamento e não acusa os pares
  const c6 = M.conciliarExtrato([{ id: "b6", data: "2026-11-05", valor: -6000, historico: "PIX ENG" }], com6.filter((x) => x.competencia === "2026-11"), {});
  assert.deepStrictEqual([c6.casados.length, c6.contabilizadoSemPar.length], [1, 0]);
  // e o débito/crédito do mês bate com o banco (os pares fora do banco não contam)
  const ck = M.checagemDebitoCredito([{ id: "b6", data: "2026-11-05", valor: -6000, historico: "PIX ENG" }], com6, "2026-11");
  assert.deepStrictEqual([ck.base.saidas, ck.base.entradas, ck.bate, ck.difDebito], [6000, 0, true, 0]);
  const ckOut = M.checagemDebitoCredito([{ id: "b0", data: "2026-10-13", valor: 15000, historico: "PIX GUSTAVO" }], rec, "2026-10");
  assert.deepStrictEqual([ckOut.base.entradas, ckOut.base.saidas, ckOut.bate, ckOut.difCredito], [15000, 0, true, 0]);
  assert.strictEqual(M.comoPagamentoDaReserva({ ...pg, clienteId: "outro" }, rec), null);   // cliente sem reserva
  assert.strictEqual(M.comoPagamentoDaReserva({ ...pg, contaId: "marketing" }, rec), null);
  // depois de pago: resultado de novembro sem custo; saldo cai 3.000; a reserva fica com 2.083,85
  const todos = rec.concat([{ ...r, id: "p1" }]);
  const nov = M.extratoEscritorio(todos, { saldoAbertura: 0 }).find((x) => x.mes === "2026-11");
  assert.deepStrictEqual([nov.saldoEscritorio, nov.saldoReservas, nov.saldoExtrato], [0, -3000, 15000 - 3000]);
  assert.strictEqual(M.saldoDaReservaEngenharia(todos, "g1"), 2083.85);
  // na conferência, o PIX de saída casa com o pagamento da reserva
  const c = M.conciliarExtrato([{ id: "b1", data: "2026-11-05", valor: -3000, historico: "PIX ENG" }], [{ ...r, id: "p1" }], {});
  assert.strictEqual(c.casados.length, 1);
  // a linha "igual à do mês passado" vai da reserva; passando dela, para o formulário
  const sug = { campos: { contaId: "parceiros", unidadeId: "projetos", clienteId: "g1", cliente: "Gustavo", descricao: "ENG" } };
  const q = M.lancamentoRapidoDoExtrato({ id: "b1", data: "2026-11-05", valor: -3000, historico: "PIX ENG" }, "2026-11", sug, {}, [], rec);
  assert.ok(q.lancamento, q.erro);
  assert.deepStrictEqual([q.lancamento.contaId, q.lancamento.valor], ["res_engenharia", -3000]);
  const q2 = M.lancamentoRapidoDoExtrato({ id: "b2", data: "2026-11-05", valor: -9000, historico: "PIX ENG" }, "2026-11", sug, {}, [], rec);
  assert.deepStrictEqual([q2.lancamento.contaId, q2.lancamento.valor, q2.lancamento.recebimentoExtras.length], ["parceiros", 9000, 2]);
  // sem a lista (chamadas antigas), nada muda
  assert.strictEqual(M.lancamentoRapidoDoExtrato({ id: "b1", data: "2026-11-05", valor: -3000, historico: "PIX ENG" }, "2026-11", sug, {}, []).lancamento.contaId, "parceiros");
});

teste("parcela da planilha antiga marcada 'não passou pela conta' e ainda não conferida casa com o débito — como dúvida", () => {
  const parcela = { id: "HP", contaId: "emp_construcao", unidadeId: "empreendimento", competencia: "2026-10", valor: 1886.67,
    descricao: "Hidráulica e Elétrica - Parcela", contaBanco: "nao", importado: true };
  const reserva = { id: "RS", contaId: "emp_construcao", competencia: "2026-10", valor: 500, contaBanco: "nao", conferido: true };
  const banco = [{ id: "b1", data: "2026-10-05", valor: -1886.67, historico: "DÉB.TIT.COMPE EFETIVADO" },
    { id: "b2", data: "2026-10-06", valor: -500, historico: "PIX ENVIADO" }];
  const r = M.conciliarExtrato(banco, [parcela, reserva]);
  const par = r.casados.find((c) => c.lancamento.id === "HP");
  assert.ok(par, "a parcela casa com o débito");
  assert.strictEqual(par.extrato.id, "b1");
  assert.strictEqual(par.certeza, "duvida", "contradiz a marcação: quem decide é a pessoa");
  assert.strictEqual(par.marcadoForaDaConta, true);
  assert.ok(!r.noBancoSemPar.some((m) => m.id === "b1"), "o débito sai do 'falta lançar'");
  assert.ok(!r.casados.some((c) => c.lancamento.id === "RS"), "o 'não' já conferido (reserva) continua fora");
  assert.ok(r.noBancoSemPar.some((m) => m.id === "b2"));
  assert.strictEqual(M.conferidosPeloExtrato(r).length, 0, "dúvida não entra conferida sozinha");
  // com um lançamento normal do mesmo valor, ele tem a preferência
  const normal = { id: "N1", contaId: "emp_construcao", competencia: "2026-10", valor: 1886.67, descricao: "outra" };
  const r2 = M.conciliarExtrato([banco[0]], [parcela, normal]);
  assert.strictEqual(r2.casados[0].lancamento.id, "N1");
  assert.ok(!r2.contabilizadoSemPar.some((l) => l.id === "HP"), "o 'não' que sobrou não vira 'lançado e não veio no banco'");
});

teste("receita não tem fornecedor: some do lançamento, também quando vem da linha igual de antes", () => {
  assert.strictEqual(M.contaDeEntradaNoEscritorio("rec_projetos"), true);
  assert.strictEqual(M.contaDeEntradaNoEscritorio("emp_construcao"), false);
  assert.deepStrictEqual(M.semFornecedorNaEntrada({ contaId: "rec_projetos", fornecedor: "Outros", fornecedorId: "f1" }),
    { contaId: "rec_projetos", fornecedor: "", fornecedorId: "" });
  assert.strictEqual(M.semFornecedorNaEntrada({ contaId: "emp_construcao", fornecedor: "AGROMETAL" }).fornecedor, "AGROMETAL");
  const l = M.lancamentoDaLinhaDoExtrato({ id: "x", data: "2026-10-02", valor: 1000, historico: "PIX RECEBIDO" }, "2026-10",
    { campos: { contaId: "rec_projetos", unidadeId: "projetos", fornecedor: "Outros", fornecedorId: "f9" } });
  assert.strictEqual(l.fornecedor, "");
  assert.strictEqual(l.fornecedorId, "");
});

teste("cliente novo de dentro do lançamento: nome obrigatório, serviço pela unidade, PJ pelo CNPJ", () => {
  assert.strictEqual(M.clienteRapidoDoLancamento({ nome: "  " }, "projetos", "x"), null);
  const c = M.clienteRapidoDoLancamento({ nome: " Alexandre ", telefone: "(14) 99999-0000" }, "projetos", "c1");
  assert.strictEqual(c.nome, "Alexandre");
  assert.strictEqual(c.tipo, "PF");
  assert.strictEqual(c.ativo, true);
  assert.strictEqual(c.servicos.projeto, true);
  assert.strictEqual(c.servicos.gestaoObra, false);
  assert.strictEqual(c.contatos[0].telefone, "(14) 99999-0000");
  const pj = M.clienteRapidoDoLancamento({ nome: "Cobop", cpfCnpj: "12.345.678/0001-90" }, "gestao_obras", "c2");
  assert.strictEqual(pj.tipo, "PJ");
  assert.strictEqual(pj.servicos.gestaoObra, true);
});

teste("gestão sem contrato: só vai para a obra quando o cliente faz os pagamentos", () => {
  if (M.gestaoSemContratoVaiParaObra({ id: "o1", clientePagaDireto: true }) !== true) throw new Error("cliente paga direto: deveria ir");
  if (M.gestaoSemContratoVaiParaObra({ id: "o1", clientePagaDireto: false }) !== false) throw new Error("escritório paga: não deveria ir");
  if (M.gestaoSemContratoVaiParaObra({ id: "o1" }) !== false) throw new Error("sem marca: não deveria ir");
  if (M.gestaoSemContratoVaiParaObra(null) !== false) throw new Error("sem obra: não deveria ir");
});

teste("gestão sem contrato: a conta paga de Gerenciamento na obra vira Receita Gestão ligada, e excluir apaga os dois lados", () => {
  const cli = { id: "cA", nome: "Alexandre Pimentel", servicos: { gestaoObra: true } };
  const ob = { id: "rp", nome: "Royal Park Prime", clienteId: "cA", contasPagar: [] };
  const conta = { id: "g1", contaId: "taxa_admin_obra", pago: true, pagoEm: "2026-10-07", valor: 1800, valorPago: 1800,
    descricao: "Gerenciamento de obra", favorecido: "Padovan", numeroDoc: "0201" };
  const obNova = { ...ob, contasPagar: [conta] };
  const r = M.lancamentosDaBaixa(obNova, cli, [conta], { ...OPC });
  assert.strictEqual(r.lancamentos.length, 1);
  const l = { ...r.lancamentos[0], origem: { ...r.lancamentos[0].origem, avulsa: true } };
  assert.strictEqual(l.contaId, "rec_gestao");
  assert.strictEqual(l.unidadeId, "gestao_obras");
  assert.strictEqual(l.valor, 1800);
  assert.strictEqual(l.competencia, "2026-10");
  // não é parcela de contrato: segue o caminho comum de duas pontas
  assert.strictEqual(M.ehLigacaoDaGestao(l.origem), false);
  assert.strictEqual(M.ehLigacaoDaGestao(r.lancamentos[0].origem), true, "sem a marca, seria tratado como parcela");
  assert.deepStrictEqual(M.contasLigadasAoLancamento(obNova, l).map((c) => c.id), ["g1"]);
  // a ponte não cria de novo
  const outra = M.lancamentosDaBaixa(obNova, cli, [conta], { ...OPC, lancamentos: [l] });
  assert.strictEqual(outra.lancamentos.length, 0);
});

teste("pt-BR: '1.500' e 'R$ 2.350' são milhar, não decimal; '1,5' e '0.5' continuam", () => {
  assert.strictEqual(M.efNumero("1.500"), 1500);
  assert.strictEqual(M.efNumero("2.350.000"), 2350000);
  assert.strictEqual(M.efNumero("1,5"), 1.5);
  assert.strictEqual(M.efNumero("1.234,56"), 1234.56);
  assert.strictEqual(M.efNumero("0.5"), 0.5);
  assert.strictEqual(M.efNumero("12.5"), 12.5);
  assert.strictEqual(Math.abs(M.efValorDeTexto("R$ 2.350")), 2350);
  assert.strictEqual(Math.abs(M.efValorDeTexto("108,02D")), 108.02);
});

teste("editar lançamento: o que mexe no dinheiro e o que veio da obra", () => {
  const a = { valor: 100, competencia: "2026-08", lancadoEm: "2026-08-10", contaId: "material" };
  assert.strictEqual(M.lancamentoMexeuNoDinheiro(a, { ...a, descricao: "outra" }), false, "descrição não mexe");
  assert.strictEqual(M.lancamentoMexeuNoDinheiro(a, { ...a, competencia: "2026-09" }), true, "mudar o mês mexe");
  assert.strictEqual(M.lancamentoMexeuNoDinheiro(a, { ...a, valor: 100.001 }), false);
  assert.strictEqual(M.lancamentoVeioDaObra({ origem: { obraId: "o1", tipo: "conta" } }), true);
  assert.strictEqual(M.lancamentoVeioDaObra({ origem: { obraId: "o1", tipo: "pedido" } }), true);
  assert.strictEqual(M.lancamentoVeioDaObra({ origem: { obraId: "o1", tipo: "gestao" } }), false, "gestão tem caminho próprio");
  assert.strictEqual(M.lancamentoVeioDaObra({ origem: { obraId: "o1", tipo: "conta", avulsa: true } }), false);
  assert.strictEqual(M.lancamentoVeioDaObra({}), false);
});

teste("pagamento de vários pedidos de uma vez: uma linha só no extrato", () => {
  const it = (id, ped, valor) => ({ id, pedidoId: ped, pago: true, pagoEm: "2026-10-20", valor, valorPago: valor, contaId: "material", pagamentoConjunto: "pg1", favorecido: "Ourifer" });
  const f = M.fontesDasContasPagas([it("a", "p1", 100), it("b", "p1", 50), it("c", "p2", 30)]);
  assert.strictEqual(f.length, 1);
  assert.strictEqual(f[0].valor, 180);
  assert.ok(/Pagamento de 2 pedidos/.test(f[0].descricao));
});

teste("fechamento jan/26: lançamento com 'não' antigo mas ligado à linha do banco casa com ela (não vai para Falta lançar)", () => {
  // os registros de produção de janeiro/2026, como estão gravados
  const linhas = [
    { abs: 4750, data: "2026-01-27", documento: "Pix", valor: 4750,
      historico: "PIX RECEBIDO - OUTRA IF - MESMA TIT. · Recebimento Pix LEO PADOVAN PROJETOS E CONSTRUCOES 36.122.417 0001-74 Projeto Nova Alcantara",
      id: "2026-01-27|4750.00|pix recebido - outra if - mesma tit. · recebimento pix leo p|Pix#1" },
    { abs: 1200, data: "2026-01-27", documento: "Pix", valor: 1200,
      historico: "PIX RECEBIDO - OUTRA IF - MESMA TIT. · Recebimento Pix LEO PADOVAN PROJETOS E CONSTRUCOES 36.122.417 0001-74 Projeto Nova Alcantara",
      id: "2026-01-27|1200.00|pix recebido - outra if - mesma tit. · recebimento pix leo p|Pix#1" },
    { abs: 6250, data: "2026-01-02", documento: "Pix", valor: -6250,
      historico: "PIX EMITIDO OUTRA IF · Pagamento Pix ***.544.328-** parcela esquadrias obras",
      id: "2026-01-02|-6250.00|pix emitido outra if · pagamento pix ***.544.328-** parcela |Pix#1" },
  ];
  const lancs = [
    { id: "imp_3538", tipo: "escritorio", competencia: "2026-01", conferido: true, contaBanco: "nao", contaId: "pagamentos_compras", unidadeId: "gestao_obras",
      valor: 6250, lancadoEm: "2025-07-01", extratoId: linhas[2].id },
    { id: "imp_3802", tipo: "escritorio", competencia: "2026-01", conferido: true, contaBanco: "nao", contaId: "rec_projetos", unidadeId: "projetos",
      valor: 1200, lancadoEm: "2025-08-19", extratoId: linhas[1].id },
    { id: "imp_3808", tipo: "escritorio", competencia: "2026-01", conferido: true, contaBanco: "nao", contaId: "rec_projetos", unidadeId: "projetos",
      valor: 4750, lancadoEm: "2025-08-19", extratoId: linhas[0].id },
    // fora da conta de verdade (sem linha do banco): continua fora
    { id: "res", tipo: "escritorio", competencia: "2026-01", conferido: true, contaBanco: "nao", contaId: "res_engenharia", valor: 300 },
  ];
  const r = M.conciliarExtrato(linhas, lancs, {});
  assert.strictEqual(r.noBancoSemPar.length, 0, "nenhuma linha em Falta lançar: " + r.noBancoSemPar.map((m) => m.valor));
  assert.deepStrictEqual(r.casados.map((c) => [c.lancamento.id, c.certeza]).sort(),
    [["imp_3538", "vinculo"], ["imp_3802", "vinculo"], ["imp_3808", "vinculo"]]);
  // e a checagem débito × crédito conta os três (a reserva continua fora)
  const ch = M.checagemDebitoCredito(linhas, lancs, "2026-01");
  assert.strictEqual(ch.base.saidas, 6250);
  assert.strictEqual(ch.base.entradas, 5950);
  assert.strictEqual(ch.difDebito, 0);
  assert.strictEqual(ch.difCredito, 0);
});

teste("fechamento out/26: um Pix pagou um pedido com itens de duas contas — os dois lançamentos casam com a mesma linha", () => {
  const linha = { id: "2026-10-09|-70.00|pix emitido|Pix#1", data: "2026-10-09", valor: -70, abs: 70, historico: "PIX EMITIDO OUTRA IF · Pagamento Pix loja" };
  const outra = { id: "2026-10-10|-30.00|tarifa|x#1", data: "2026-10-10", valor: -30, abs: 30, historico: "TARIFA" };
  const lancs = [
    { id: "p1", competencia: "2026-10", contaId: "emp_construcao", unidadeId: "empreendimento", valor: 62.14, conferido: true, extratoId: linha.id,
      origem: { tipo: "pedido", obraId: "xflr1rp", refId: "ch1sese|material|2026-10-09" } },
    { id: "p2", competencia: "2026-10", contaId: "emp_construcao", unidadeId: "empreendimento", valor: 7.86, conferido: true, extratoId: linha.id,
      origem: { tipo: "conta", obraId: "xflr1rp", refId: "k58e5p6" } },
  ];
  const r = M.conciliarExtrato([linha, outra], lancs, {});
  assert.deepStrictEqual(r.casados.map((c) => [c.lancamento.id, c.certeza, c.centavos, c.parteDe]), [["p1", "vinculo", 0, 2], ["p2", "vinculo", 0, 2]]);
  assert.strictEqual(r.contabilizadoSemPar.length, 0, "nenhum vai para 'lançado, não veio no banco'");
  assert.deepStrictEqual(r.noBancoSemPar.map((m) => m.valor), [-30]);
  assert.strictEqual(r.resumo.casados, 1, "uma linha do banco casou");
  assert.strictEqual(Object.keys(r.duplicados).length, 0);
});

teste("Projetos a receber: 'Receber' lança a parcela em Receita de projetos sem extrato (dia e valor informados)", () => {
  const cli = { id: "v1", nome: "Cliente do Victor" };
  const orc = { id: "ORC-0005", clienteId: "v1", referencia: "Residência", status: "ganho",
    fechamento: { valorTotalFechado: 12000, valorEngFechado: 3000, inclEng: true,
      condicao: { tipo: "parcelado", parcelas: [{ nome: "1ª Parcela", valor: 6000, data: "2026-10-05" }, { nome: "2ª Parcela", valor: 6000, data: "2026-11-05" }] } } };
  let n = 0;
  const ctx = { lancamentos: [], fechamentos: {}, novoId: () => "r" + (++n), numeroDoc: () => "4300", agora: "2026-10-23T12:00:00Z" };
  const [p1, p2] = M.parcelasDosProjetos([orc], [cli], []);
  const r = M.lancamentosDaParcelaRecebida(p1, "2026-10-08", "6.000,00", ctx);
  assert.ok(!r.erro, r.erro);
  assert.deepStrictEqual(r.lancamentos.map((l) => [l.contaId, l.valor, l.contaBanco, l.competencia, l.lancadoEm, l.origem.parte]),
    [["rec_projetos", 6000, "sim", "2026-10", "2026-10-08", "recebido"], ["parceiros", 1500, "nao", "2026-10", "2026-10-08", "eng-custo"],
     ["res_engenharia", 1500, "nao", "2026-10", "2026-10-08", "eng-reserva"]]);
  const depois = M.parcelasDosProjetos([orc], [cli], r.lancamentos);
  assert.deepStrictEqual(depois.map((p) => p.recebida), [true, false], "sai do a receber só a parcela recebida");
  // a receita aparece no resumo do mês
  const ext = M.extratoEscritorio(r.lancamentos, { saldoAbertura: 0 }).find((x) => x.mes === "2026-10");
  assert.strictEqual(ext.contas.rec_projetos, 6000);
  // de novo não lança; sem dia, sem valor ou em mês fechado, recusa
  assert.ok(M.lancamentosDaParcelaRecebida(depois[0], "2026-10-08", 6000, ctx).erro);
  assert.ok(M.lancamentosDaParcelaRecebida(p2, "", 6000, ctx).erro);
  assert.ok(M.lancamentosDaParcelaRecebida(p2, "2026-11-05", "0", ctx).erro);
  assert.ok(/fechado/.test(M.lancamentosDaParcelaRecebida(p2, "2026-09-30", 6000, { ...ctx, fechamentos: { "2026-09": { fechadoEm: "x" } } }).erro));
});

teste("extrato lido de novo com o documento escrito diferente (OURINHOS S → OURINHOSS): o lançamento continua ligado à linha", () => {
  const velho = M.comIdsDosMovimentos([{ data: "2026-09-24", valor: -145.83, historico: "DÉB.CONV.SANEAMENTO", documento: "OURINHOS S" },
    { data: "2026-09-28", valor: -90, historico: "DÉB.CONV.TELECOMUNICAÇÕES", documento: "VIVO - SP" }]);
  const novo = M.comIdsDosMovimentos([
    { data: "2026-09-24", valor: -145.83, historico: "DÉB.CONV.SANEAMENTO", documento: "OURINHOSS" },
    { data: "2026-09-24", valor: -145.83, historico: "DÉB.CONV.SANEAMENTO", documento: "OUTRA" },
    { data: "2026-09-28", valor: -90, historico: "DÉB.CONV.TELECOMUNICAÇÕES", documento: "VIVOSP" }]);
  assert.notStrictEqual(velho[0].id, novo[0].id, "o id mudou com a releitura");
  const lancs = [
    // o da segunda linha (OUTRA) foi lançado depois e ligado exatamente a ela
    { id: "b", tipo: "escritorio", contaId: "luz_agua_net", valor: 145.83, lancadoEm: "2026-09-24", competencia: "2026-09", extratoId: novo[1].id },
    { id: "a", tipo: "escritorio", contaId: "luz_agua_net", valor: 145.83, lancadoEm: "2026-09-24", competencia: "2026-09", extratoId: velho[0].id },
    { id: "c", tipo: "escritorio", contaId: "utensilios", valor: 90, lancadoEm: "2026-09-28", competencia: "2026-09", extratoId: velho[1].id },
  ];
  const r = M.conciliarExtrato(novo, lancs);
  const par = (lid) => { const x = r.casados.find((c) => c.lancamento.id === lid); return x && [x.extrato.id, x.certeza]; };
  assert.deepStrictEqual(par("a"), [novo[0].id, "vinculo"]);
  assert.deepStrictEqual(par("b"), [novo[1].id, "vinculo"]);
  assert.deepStrictEqual(par("c"), [novo[2].id, "vinculo"]);
  // data ou valor diferentes não ligam
  assert.ok(!M.efMesmaLinhaDoBanco(velho[0].id, velho[0].id.replace("-145.83", "-145.84")));
  assert.ok(!M.efMesmaLinhaDoBanco(velho[0].id, velho[0].id.replace("2026-09-24", "2026-09-25")));
});

teste("composição do número: cada célula do quadro abre nos lançamentos que somam exatamente o número", () => {
  const L = [
    { id: "a", competencia: "2026-09", lancadoEm: "2026-09-08", contaId: "rec_gestao", unidadeId: "gestao_obras", valor: 1800, descricao: "Gestão" },
    { id: "b", competencia: "2026-09", lancadoEm: "2026-09-14", contaId: "rec_projetos", unidadeId: "projetos", valor: 1000, descricao: "Projeto" },
    { id: "c", competencia: "2026-09", lancadoEm: "2026-09-20", contaId: "rec_projetos", unidadeId: "projetos", valor: -200, descricao: "estorno" },
    { id: "d", competencia: "2026-09", lancadoEm: "2026-09-09", contaId: "parceiros", unidadeId: "escritorio", valor: 2250, descricao: "Victor" },
    { id: "e", competencia: "2026-10", lancadoEm: "2026-10-02", contaId: "rec_projetos", unidadeId: "projetos", valor: 500, descricao: "outubro" },
    // fatura aberta nas compras: a compra do empreendimento sai do escritório
    { id: "f", competencia: "2026-09", lancadoEm: "2026-09-15", contaId: "cartao_credito", unidadeId: "escritorio", valor: 700,
      origem: { tipo: "fatura", cartaoId: "k", competencia: "2026-09" },
      linhas: [{ valor: 600, destinoContaId: "emp_construcao", unidadeId: "empreendimento", empreendimentoId: "x", descricao: "concreto" },
               { valor: 50, destinoContaId: "utensilios", unidadeId: "escritorio", descricao: "caneta" }] },
  ];
  const ext = M.extratoEscritorio(L, {});
  const set = ext.find((m) => m.mes === "2026-09");
  const tot = (alvo, p) => M.composicaoDoExtrato(L, alvo, p).total;
  assert.strictEqual(tot({ conta: "rec_projetos" }, "2026-09"), set.contas.rec_projetos);
  assert.strictEqual(tot({ conta: "rec_projetos" }, "2026-09"), 800);
  assert.strictEqual(tot({ grupo: "receitas" }, "2026-09"), set.grupos.receitas);
  assert.strictEqual(tot({ grupo: "despesas" }, "2026-09"), set.grupos.despesas);
  assert.strictEqual(tot({ saldo: "saldoEscritorio" }, "2026-09"), set.saldoEscritorio);
  assert.strictEqual(tot({ saldo: "saldoGestao" }, "2026-09"), set.saldoGestao);
  assert.strictEqual(tot({ saldo: "saldoEmpreendimento" }, "2026-09"), set.saldoEmpreendimento);
  // o ano soma os meses
  const ano = ext.filter((m) => m.mes.startsWith("2026")).reduce((s, m) => s + (m.contas.rec_projetos || 0), 0);
  assert.strictEqual(tot({ conta: "rec_projetos" }, "2026"), ano);
  // a fatura aparece pelas compras, não inteira em Cartão de crédito
  const cc = M.composicaoDoExtrato(L, { conta: "cartao_credito" }, "2026-09");
  assert.deepStrictEqual(cc.linhas.map((x) => x.valor), [50]);           // só a diferença (juros)
  const emp = M.composicaoDoExtrato(L, { conta: "emp_construcao" }, "2026-09");
  assert.strictEqual(emp.total, 600);
  // no saldo, a despesa entra com sinal negativo
  const se = M.composicaoDoExtrato(L, { saldo: "saldoEscritorio" }, "2026-09");
  assert.ok(se.linhas.some((x) => x.l.id === "d" && x.valor === -2250));
  // período inválido ou alvo vazio: nada
  assert.strictEqual(M.composicaoDoExtrato(L, { conta: "rec_projetos" }, "").linhas.length, 0);
  assert.strictEqual(M.composicaoDoExtrato(L, {}, "2026-09").linhas.length, 0);
});

teste("contas bancárias: a principal existe sempre; as outras vêm do cadastro; cada lançamento é da sua", () => {
  const data = { escritorio: { banco: "Sicoob", financeiro: { contasBancarias: [{ id: "cora", nome: "Cora", saldoInicial: 0 }, { id: "x", nome: "Velha", ativa: false }] } } };
  const cs = M.contasBancariasDoEscritorio(data);
  assert.deepStrictEqual(cs.map((c) => c.id), ["principal", "cora"]);
  assert.strictEqual(cs[0].nome, "Sicoob");
  assert.strictEqual(M.contasBancariasDoEscritorio({}).length, 1);
  assert.strictEqual(M.contaBancariaDoLancamento({}), "principal");
  const L = [{ id: "a" }, { id: "b", contaBancariaId: "cora" }];
  assert.deepStrictEqual(M.lancamentosDaContaBancaria(L, "principal").map((l) => l.id), ["a"]);
  assert.deepStrictEqual(M.lancamentosDaContaBancaria(L, "cora").map((l) => l.id), ["b"]);
  // extratos: a principal no lugar de sempre; a outra em extratosContas
  const fin = { extratos: { "2026-09": { movimentos: [1] } } };
  assert.deepStrictEqual(M.extratosDaContaBancaria(fin, "principal"), fin.extratos);
  assert.deepStrictEqual(M.extratosDaContaBancaria(fin, "cora"), {});
  const f2 = M.financeiroComExtratos(fin, "cora", { "2026-09": { movimentos: [2] } });
  assert.deepStrictEqual(f2.extratos, fin.extratos);
  assert.deepStrictEqual(f2.extratosContas.cora["2026-09"].movimentos, [2]);
  // ids da outra conta levam o prefixo, uma vez só
  const ms = M.comIdsDaContaBancaria([{ id: "2026-09-14|624.48|x|#1" }], "cora");
  assert.strictEqual(ms[0].id, "cora:2026-09-14|624.48|x|#1");
  assert.strictEqual(M.comIdsDaContaBancaria(ms, "cora")[0].id, ms[0].id);
  assert.strictEqual(M.comIdsDaContaBancaria([{ id: "y" }], "principal")[0].id, "y");
  // as contas internas de transferência não aparecem no formulário
  assert.ok(!M.contasDoLancamento("escritorio", {}).escritorio.some((c) => /^transf_/.test(c.id)));
});

teste("saldo do banco por conta: a principal no registro do mês; as outras em contas; a Cora somada do extrato", () => {
  let f = M.comSaldoBancoDaConta({}, "2026-09", "principal", 100);
  f = M.comSaldoBancoDaConta(f, "2026-09", "cora", 0);
  assert.strictEqual(M.saldoBancoDaContaNoMes(f, "2026-09", "principal"), 100);
  assert.strictEqual(M.saldoBancoDaContaNoMes(f, "2026-09", "cora"), 0);
  assert.strictEqual(M.saldoBancoDaContaNoMes(f, "2026-10", "cora"), null);
  f = M.comSaldoBancoDaConta(f, "2026-09", "cora", "");
  assert.strictEqual(M.saldoBancoDaContaNoMes(f, "2026-09", "cora"), null);
  assert.strictEqual(f["2026-09"].contas, undefined);
  const ext = { "2026-09": { movimentos: [
    { id: "1", data: "2026-09-08", valor: 1800, historico: "Roselene" }, { id: "2", data: "2026-09-09", valor: -2250, historico: "Victor" },
    { id: "3", data: "2026-09-14", valor: 624.48, historico: "LEO PADOVAN" }, { id: "4", data: "2026-09-15", valor: -2424.48, historico: "fatura" },
    { id: "5", data: "2026-09-08", valor: 1000, historico: "Lenilson" }, { id: "6", data: "2026-09-14", valor: 1250, historico: "Lilian" }] },
    "2026-10": { movimentos: [{ id: "7", data: "2026-10-02", valor: 500, historico: "x" }] } };
  assert.strictEqual(M.saldoPeloExtratoDaConta(ext, "2026-09", 0), 0);
  assert.strictEqual(M.saldoPeloExtratoDaConta(ext, "2026-10", 10), 510);
  assert.strictEqual(M.saldoPeloExtratoDaConta({}, "2026-09", 0), null);
});

teste("transferência entre contas: duas pontas ligadas, a da linha conferida; o total não muda e o resultado não vê", () => {
  const contas = [{ id: "principal", nome: "Sicoob" }, { id: "cora", nome: "Cora" }];
  const m = { id: "2026-09-14|-624.48|pix|#1", data: "2026-09-14", valor: -624.48, historico: "PIX EMITIDO MESMA TIT" };
  let n = 0;
  const r = M.lancamentosDaTransferencia(m, "2026-09", "principal", "cora", { contas, novoId: () => "t" + (++n), agora: "2026-10-27T00:00:00Z" });
  assert.ok(!r.erro, r.erro);
  const [sai, ent] = r.lancamentos;
  assert.strictEqual(sai.contaId, "transf_saida"); assert.strictEqual(sai.contaBancariaId, undefined);
  assert.strictEqual(sai.extratoId, m.id); assert.strictEqual(sai.conferido, true);
  assert.strictEqual(ent.contaId, "transf_entrada"); assert.strictEqual(ent.contaBancariaId, "cora");
  assert.strictEqual(ent.extratoId, undefined); assert.ok(!ent.conferido);
  assert.strictEqual(sai.transferenciaId, ent.transferenciaId);
  assert.strictEqual(sai.descricao, "Transferência para Cora");
  assert.strictEqual(ent.descricao, "Transferência de Sicoob");
  // vindo da linha de ENTRADA na Cora: a ponta da Cora é a ligada
  const r2 = M.lancamentosDaTransferencia({ id: "cora:x", data: "2026-09-14", valor: 624.48 }, "2026-09", "cora", "principal", { contas, novoId: () => "u" });
  assert.strictEqual(r2.lancamentos[0].contaBancariaId, undefined);   // saiu da principal
  assert.strictEqual(r2.lancamentos[1].extratoId, "cora:x");
  // mês fechado e conta igual recusam
  assert.ok(M.lancamentosDaTransferencia(m, "2026-09", "principal", "cora", { contas, fechamentos: { "2026-09": { fechadoEm: "x" } } }).erro);
  assert.ok(M.lancamentosDaTransferencia(m, "2026-09", "principal", "principal", { contas }).erro);
  // no extrato: total igual, resultado igual; por conta, o dinheiro mudou de bolso
  const base = [{ id: "r", competencia: "2026-09", contaId: "rec_projetos", unidadeId: "projetos", valor: 1000 }];
  const antes = M.extratoEscritorio(base, {}).find((x) => x.mes === "2026-09");
  const depois = M.extratoEscritorio(base.concat(r.lancamentos), {}).find((x) => x.mes === "2026-09");
  assert.strictEqual(depois.saldoExtrato, antes.saldoExtrato);
  assert.strictEqual(depois.saldoEscritorio, antes.saldoEscritorio);
  const sicoob = M.extratoEscritorio(M.lancamentosDaContaBancaria(base.concat(r.lancamentos), "principal"), {}).find((x) => x.mes === "2026-09");
  const cora = M.extratoEscritorio(M.lancamentosDaContaBancaria(base.concat(r.lancamentos), "cora"), {}).find((x) => x.mes === "2026-09");
  assert.strictEqual(sicoob.saldoExtrato, 375.52);
  assert.strictEqual(cora.saldoExtrato, 624.48);
});

teste("entre contas: o banco que não escreve 'mesma titularidade' é reconhecido pelo nome ou CNPJ do escritório", () => {
  const tit = ["36.122.417/0001-74", "LEO PADOVAN PROJETOS E CONSTRUCOES"];
  assert.ok(M.pareceEntreContas("LEO PADOVAN PROJETOS E CONSTRUCOES · Transf Pix recebida", tit));
  assert.ok(M.pareceEntreContas("PIX EMITIDO OUTRA IF · Pagamento Pix 36.122.417 0001-74", tit));
  assert.ok(M.pareceEntreContas("PIX EMITIDO OUTRA IF - MESMA TIT.", []));
  assert.ok(!M.pareceEntreContas("Roselene De Oliveira Pimentel · Pagamento recebido", tit));
  assert.ok(!M.pareceEntreContas("LEO PADOVAN PROJETOS", []));
});

teste("extrato da Cora em CSV: data, valor e o nome com o tipo da transação no histórico", () => {
  const linhas = [["Data", "Transação", "Tipo Transação", "Identificação", "Valor"],
    ["15/09/2026", "Pagamento da fatura", "DÉBITO", "Cora SCFI", "-2424.48"],
    ["14/09/2026", "Transf Pix recebida", "CRÉDITO", "LEO PADOVAN PROJETOS E CONSTRUCOES", "624.48"]];
  const mapa = M.detectarColunasTabela(linhas);
  assert.ok(mapa.completo);
  const ms = M.movimentosDaTabela(linhas, mapa);
  assert.deepStrictEqual(ms.map((m) => [m.data, m.valor]), [["2026-09-15", -2424.48], ["2026-09-14", 624.48]]);
  assert.ok(/Cora SCFI/.test(ms[0].historico) && /Pagamento da fatura/.test(ms[0].historico), ms[0].historico);
  assert.ok(/Transf Pix recebida/.test(ms[1].historico));
});

teste("extrato de outra conta guardado com o id da conta na frente — e a principal como sempre", () => {
  const movs = [{ data: "2026-09-14", valor: 624.48, historico: "LEO PADOVAN", documento: "" }];
  const r = M.extratosComArquivo({}, movs, "cora.csv", "agora", { contaId: "cora" });
  assert.ok(/^cora:2026-09-14\|624\.48\|/.test(r.extratos["2026-09"].movimentos[0].id), r.extratos["2026-09"].movimentos[0].id);
  const r2 = M.extratosComArquivo({}, movs, "x", "agora", {});
  assert.ok(/^2026-09-14\|624\.48\|/.test(r2.extratos["2026-09"].movimentos[0].id));
  // de novo o mesmo arquivo: não duplica
  const r3 = M.extratosComArquivo(r.extratos, movs, "cora.csv", "agora", { contaId: "cora" });
  assert.strictEqual(r3.extratos["2026-09"].movimentos.length, 1);
});

teste("arquivo de outra conta solto na aba errada: reconhecido, para não apagar as linhas desta conta", () => {
  const sicoob = M.extratosComArquivo({}, [
    { data: "2026-09-08", valor: -100, historico: "PIX EMITIDO A" }, { data: "2026-09-09", valor: 3000, historico: "PIX RECEBIDO ONE FIT" },
    { data: "2026-09-14", valor: -624.48, historico: "PIX EMITIDO MESMA TIT" }, { data: "2026-09-20", valor: -5, historico: "TARIFA" }], "s", "x", {}).extratos;
  const cora = [{ id: "a", data: "2026-09-08", valor: 1800, historico: "Roselene · Pagamento recebido" },
    { id: "b", data: "2026-09-15", valor: -2424.48, historico: "Cora SCFI · Pagamento da fatura" }];
  const r = M.arquivoPareceDeOutraConta(sicoob, cora.map((m) => ({ ...m, id: "2026-09|" + m.id })));
  assert.strictEqual(r.outra, true);
  assert.strictEqual(r.guardados, 3);
  // o mesmo extrato do Sicoob de novo (ou com dias a mais): é desta conta
  const deNovo = Object.values(sicoob).flatMap((v) => v.movimentos).concat([{ id: "nova", data: "2026-09-21", valor: -1, historico: "TARIFA" }]);
  assert.strictEqual(M.arquivoPareceDeOutraConta(sicoob, deNovo).outra, false);
  // conta sem nada guardado nesses dias: entra
  assert.strictEqual(M.arquivoPareceDeOutraConta({}, cora).outra, false);
});

teste("de qual conta é o arquivo: pelas linhas iguais às já guardadas de cada conta", () => {
  const sic = M.extratosComArquivo({}, [{ data: "2026-09-14", valor: -624.48, historico: "PIX EMITIDO MESMA TIT" }, { data: "2026-09-20", valor: -5, historico: "TARIFA" }], "s", "x", {}).extratos;
  const cor = M.extratosComArquivo({}, [{ data: "2026-09-08", valor: 1800, historico: "Roselene" }], "c", "x", { contaId: "k" }).extratos;
  const fin = { extratos: sic, extratosContas: { k: cor } };
  const contas = [{ id: "principal" }, { id: "k" }];
  const ids = (ms) => ms.map((m) => ({ ...m, id: [m.data, m.valor.toFixed(2), m.historico.toLowerCase(), ""].join("|") + "#1" }));
  assert.strictEqual(M.contaDoArquivoPeloConteudo(fin, contas, ids([{ data: "2026-09-20", valor: -5, historico: "TARIFA" }, { data: "2026-09-30", valor: -1, historico: "X" }])), "principal");
  assert.strictEqual(M.contaDoArquivoPeloConteudo(fin, contas, ids([{ data: "2026-09-08", valor: 1800, historico: "Roselene" }])), "k");
  assert.strictEqual(M.contaDoArquivoPeloConteudo(fin, contas, ids([{ data: "2026-10-01", valor: 9, historico: "nova" }])), null);
});

teste("transferência pelo par na outra conta: o Pix do Sicoob lançado como cartão vira a outra ponta", () => {
  const contas = [{ id: "principal", nome: "Sicoob" }, { id: "cora", nome: "Cora" }];
  const sic = M.extratosComArquivo({}, [{ data: "2026-09-14", valor: -624.48, historico: "PIX EMITIDO OUTRA IF - MESMA TIT. · Pagamento Pix 36.122.417" }], "s", "x", {}).extratos;
  const idSic = sic["2026-09"].movimentos[0].id;
  const fin = { extratos: sic };
  const cartao = { id: "c1", tipo: "escritorio", competencia: "2026-09", lancadoEm: "2026-09-24", contaId: "cartao_credito", unidadeId: "gestao_obras",
    valor: 624.48, extratoId: idSic, conferido: true, descricao: "Cartão de crédito Obra Jacarezinho" };
  const linhaCora = { id: "cora:2026-09-14|624.48|leo padovan|#1", data: "2026-09-14", valor: 624.48, historico: "LEO PADOVAN PROJETOS E CONSTRUCOES · Transf Pix recebida" };
  const par = M.parDaTransferencia(linhaCora, "cora", contas, fin, [cartao], []);
  assert.ok(par, "achou o par pelo MESMA TIT do Sicoob");
  assert.strictEqual(par.conta.id, "principal");
  assert.strictEqual(par.lancamento.id, "c1");
  let n = 0;
  const r = M.lancamentosDaTransferenciaComPar(linhaCora, "2026-09", "cora", par, { contas, novoId: () => "t" + (++n), agora: "A" });
  assert.ok(!r.erro, r.erro);
  assert.strictEqual(r.lancamentos.length, 1);
  assert.strictEqual(r.lancamentos[0].contaId, "transf_entrada");
  assert.strictEqual(r.lancamentos[0].contaBancariaId, "cora");
  assert.strictEqual(r.lancamentos[0].extratoId, linhaCora.id);
  const conv = r.alterados[0];
  assert.strictEqual(conv.id, "c1"); assert.strictEqual(conv.contaId, "transf_saida");
  assert.strictEqual(conv.extratoId, idSic); assert.strictEqual(conv.unidadeId, "escritorio");
  assert.strictEqual(conv.transferenciaId, r.lancamentos[0].transferenciaId);
  // resultado: os 624,48 saem das despesas; saldo total igual
  const antes = M.extratoEscritorio([cartao], {}).find((x) => x.mes === "2026-09");
  const depois = M.extratoEscritorio([conv, r.lancamentos[0]], {}).find((x) => x.mes === "2026-09");
  assert.strictEqual(antes.grupos.despesas, 624.48);
  assert.strictEqual(depois.grupos.despesas || 0, 0);
  // sem lançamento do outro lado: as duas pontas nascem ligadas
  const par2 = M.parDaTransferencia(linhaCora, "cora", contas, fin, [], []);
  const r2 = M.lancamentosDaTransferenciaComPar(linhaCora, "2026-09", "cora", par2, { contas, novoId: () => "u" });
  assert.strictEqual(r2.lancamentos.length, 2);
  assert.ok(r2.lancamentos.every((l) => l.extratoId && l.conferido));
  // sem cara de dinheiro próprio dos dois lados, ou valor/sinal diferentes: não é par
  const fin3 = { extratos: M.extratosComArquivo({}, [{ data: "2026-09-14", valor: -624.48, historico: "PIX PARA FULANO" }], "s", "x", {}).extratos };
  assert.strictEqual(M.parDaTransferencia({ ...linhaCora, historico: "Fulano · Pix" }, "cora", contas, fin3, [], []), null);
  assert.strictEqual(M.parDaTransferencia({ ...linhaCora, valor: -624.48 }, "cora", contas, fin, [], []), null);
  assert.strictEqual(M.parDaTransferencia({ ...linhaCora, data: "2026-09-25" }, "cora", contas, fin, [], []), null);
});

// ── Entrada única: cartão + contas ──────────────────────────────
const CORA = { id: "kc", nome: "CORA Visa", diaFechamento: 5, diaVencimento: 15, final: "8821", contaBancariaId: "cora" };
const FATURA_CSV = [
  ["Data", "Nome no Cartão/Final do Cartão", "Descrição", "Valor"],
  ["20/08/2026", "LEO PADOVAN / 8821", "MATERIAIS SILVA - Parcela 2/6", "R$ 648,78"],
  ["01/09/2026", "LEO PADOVAN / 8821", "CASA DO CONSTRUTOR 1/6", "634,48"],
  ["03/09/2026", "LEO PADOVAN / 8821", "ASSINATURA SOFTWARE", "99,90"],
  ["15/09/2026", "LEO PADOVAN / 8821", "Pagamento de fatura", "-2.424,48"],
];

teste("fatura de cartão: reconhece pelo cabeçalho, lê parcela, sinal e final", () => {
  assert.strictEqual(M.efCabecalhoDeCartao(FATURA_CSV), 0);
  assert.strictEqual(M.efCabecalhoDeCartao([["Data", "Histórico", "Valor"]]), -1);
  assert.deepStrictEqual(M.efParcelaDoTexto("PARC 02/06"), { parcela: 2, de: 6 });
  assert.strictEqual(M.efParcelaDoTexto("Compra 15/09/2026"), null);
  const r = M.movimentosDoCartao(FATURA_CSV);
  assert.strictEqual(r.final, "8821");
  assert.strictEqual(r.movimentos.length, 3);                 // o pagamento da fatura sai
  assert.strictEqual(r.movimentos[0].valor, -648.78);
  assert.strictEqual(r.movimentos[0].parcela, 2);
  assert.strictEqual(r.movimentos[2].valor, -99.9);
  assert.strictEqual(M.cartaoDoArquivo([CORA, { id: "x", nome: "Master", final: "1234" }], "8821").id, "kc");
  assert.strictEqual(M.cartaoDoArquivo([{ id: "x", nome: "Master" }], "8821").id, "x");   // único sem final
  assert.strictEqual(M.cartaoDoArquivo([{ id: "x", final: "1" }, { id: "y" }], "8821"), null);
});

teste("fatura de cartão: competência pela compra + parcela; arquivo de uma fatura só fica junto", () => {
  const r = M.movimentosDoCartao(FATURA_CSV);
  const c = M.comCompetenciaDaFatura(r.movimentos, CORA);
  // 20/08 cai em 09 (fecha dia 5) e a parcela 2 vai para 10? fatura da compra 20/08 = 2026-09, +1 = 2026-10
  // 01/09 → 2026-09; 03/09 → 2026-09. Pela data: 08/20→09, 09/01→09, 09/03→09 (uma só) → vale a data
  assert.deepStrictEqual(c.map((m) => m.competencia), ["2026-09", "2026-09", "2026-09"]);
  // com a data da compra de verdade (parcela 2 de julho), a leitura pela compra é a que junta
  const r2 = [{ data: "2026-07-20", valor: -648.78, parcela: 2, de: 6 }, { data: "2026-09-01", valor: -634.48, parcela: 1, de: 6 }];
  assert.deepStrictEqual(M.comCompetenciaDaFatura(r2, CORA).map((m) => m.competencia), ["2026-09", "2026-09"]);
  const ids = M.comIdsDoCartao(c, "kc");
  assert.ok(ids.every((m) => m.id.indexOf("cartao|kc|") === 0));
  assert.strictEqual(new Set(ids.map((m) => m.id)).size, 3);
  assert.strictEqual(M.mesDoPagamentoDaFatura(CORA, "2026-09"), "2026-09");
  assert.strictEqual(M.mesDoPagamentoDaFatura({ diaFechamento: 25, diaVencimento: 5 }, "2026-09"), "2026-10");
});

teste("fatura de cartão: guardar substitui a competência, mantém o ignorado, não mexe na fechada", () => {
  const movs = M.comIdsDoCartao([{ data: "2026-09-01", valor: -10, historico: "A", competencia: "2026-09" }], "kc");
  let r = M.faturasComArquivo({}, movs, "f.csv", "t1");
  assert.deepStrictEqual(r.competencias, ["2026-09"]);
  const ig = M.faturasComIgnorado(r.faturas, "2026-09", movs[0].id, "teste", "t");
  assert.ok(ig["2026-09"].ignorados[movs[0].id]);
  r = M.faturasComArquivo(ig, movs, "f2.csv", "t2");
  assert.ok(r.faturas["2026-09"].ignorados[movs[0].id]);
  r = M.faturasComArquivo(r.faturas, [{ ...movs[0], valor: -20 }], "f3", "t3", { fechadas: new Set(["2026-09"]) });
  assert.deepStrictEqual(r.fechadas, ["2026-09"]);
  assert.strictEqual(r.faturas["2026-09"].movimentos[0].valor, -10);
  // desmarcar o ignorado
  assert.ok(!M.faturasComIgnorado(ig, "2026-09", movs[0].id)["2026-09"].ignorados[movs[0].id]);
});

const OBRA_JAC = { id: "ob1", nome: "Jacarezinho", clienteId: "emp1", contasPagar: [
  { id: "c1", pago: true, pagoEm: "2026-09-01", valor: 3806.88, valorPago: 3806.88, contaId: "materiais", descricao: "Casa do construtor", numeroDoc: "500",
    formaPagamento: "cartao", cartaoId: "kc", parcelasCartao: [] },
] };
OBRA_JAC.contasPagar[0].parcelasCartao = M.parcelasDoCartao(CORA, "2026-09-01", 3806.88, 6);

teste("fatura de cartão: casa o arquivo com o VICKE; sobra o que falta lançar e o que não veio", () => {
  const movs = M.comIdsDoCartao(M.comCompetenciaDaFatura(M.movimentosDoCartao(FATURA_CSV).movimentos, CORA), "kc");
  const g = M.faturasComArquivo({}, movs, "f.csv", "t").faturas["2026-09"];
  const f = M.conferenciaDaFatura(CORA, g, [OBRA_JAC], [], "2026-09", { clientes: [] });
  assert.strictEqual(f.casadas.length, 1);                     // 634,48 da Casa do construtor
  assert.strictEqual(f.faltam.length, 2);                      // 648,78 e a assinatura
  assert.strictEqual(f.soNoVicke.length, 0);
  assert.strictEqual(f.totalArquivo, 1383.16);
  assert.strictEqual(f.pronta, false);
  // lançadas as duas, fica pronta para fechar
  const lancs = [
    { id: "e1", tipo: "escritorio", contaId: "desp_outros", unidadeId: "escritorio", valor: 99.9, lancadoEm: "2026-09-03", competencia: "2026-09",
      cartaoId: "kc", formaPagamento: "cartao", parcelasCartao: M.parcelasDoCartao(CORA, "2026-09-03", 99.9, 1) },
    { id: "e2", tipo: "escritorio", contaId: "desp_outros", unidadeId: "escritorio", valor: 648.78 * 6, lancadoEm: "2026-08-20", competencia: "2026-08",
      cartaoId: "kc", formaPagamento: "cartao", parcelasCartao: [{ parcela: 2, de: 6, competencia: "2026-09", valor: 648.78 }] },
  ];
  const f2 = M.conferenciaDaFatura(CORA, g, [OBRA_JAC], lancs, "2026-09", { clientes: [] });
  assert.strictEqual(f2.faltam.length, 0);
  assert.strictEqual(f2.pronta, true);
  // ignorada sai da fila
  const g3 = M.faturasComIgnorado({ "2026-09": g }, "2026-09", movs[2].id, "x", "t")["2026-09"];
  const f3 = M.conferenciaDaFatura(CORA, g3, [OBRA_JAC], [], "2026-09", { clientes: [] });
  assert.strictEqual(f3.faltam.length, 1);
  assert.strictEqual(f3.naoLancar.length, 1);
});

teste("compra do cartão que a obra tem à vista: acha a nota e converte com as parcelas certas", () => {
  const obra = { id: "ob2", nome: "Jac", contasPagar: [
    { id: "a", pago: true, pagoEm: "2026-09-08", valor: 2000, valorPago: 2000, numeroDoc: "700", contaId: "materiais" },
    { id: "b", pago: true, pagoEm: "2026-09-08", valor: 1892.72, valorPago: 1892.72, numeroDoc: "700", contaId: "ferramentas" },
    { id: "z", pago: true, pagoEm: "2026-09-08", valor: 50, valorPago: 50, numeroDoc: "701", contaId: "materiais" },
  ] };
  // 3892,72 em 6x = 648,82 + 5 × 648,78
  const m = { data: "2026-09-08", valor: -648.82, parcela: 1, de: 6 };
  const achado = M.contasDaObraParaACompraDoCartao(m, CORA, [obra], [], {});
  assert.ok(achado);
  assert.deepStrictEqual(achado.contas.map((c) => c.id).sort(), ["a", "b"]);
  assert.strictEqual(achado.total, 3892.72);
  const conv = M.contasNoCartao(achado.contas, CORA, achado.dataCompra, 6);
  const soma = (k) => Math.round(conv.reduce((s, c) => s + c.parcelasCartao[k].valor, 0) * 100) / 100;
  assert.strictEqual(soma(0), 648.82);
  for (let k = 1; k < 6; k++) assert.strictEqual(soma(k), 648.78);
  for (const c of conv) assert.strictEqual(Math.round(c.parcelasCartao.reduce((s, p) => s + p.valor, 0) * 100) / 100, c.valorPago);
  assert.ok(conv.every((c) => c.cartaoId === "kc" && c.formaPagamento === "cartao"));
  // a parcela 2 também acha (a mesma nota)
  assert.ok(M.contasDaObraParaACompraDoCartao({ ...m, valor: -648.78, parcela: 2 }, CORA, [obra], [], {}));
  // ligada a uma linha do banco: foi paga pela conta, não é esta
  const ponte = { id: "p", tipo: "escritorio", extratoId: "x", origem: { obraId: "ob2", tipo: "pedido", refId: "?" } };
  const ligado = M.contasDaObraParaACompraDoCartao(m, CORA, [obra], [{ ...ponte, origem: { obraId: "ob2", tipo: "conta", refId: "a" } }], {});
  assert.strictEqual(ligado === null || !ligado.contas.some((c) => c.id === "a"), true);
  // valor que não fecha: nada
  assert.strictEqual(M.contasDaObraParaACompraDoCartao({ ...m, valor: -700 }, CORA, [obra], [], {}), null);
});

teste("conferência unificada: junta as contas, tira a transferência do débito × crédito, põe o cartão na fila", () => {
  const contas = [{ id: "principal", nome: "Sicoob", principal: true }, { id: "cora", nome: "Cora" }];
  const sic = M.extratosComArquivo({}, [
    { data: "2026-09-10", valor: -100, historico: "TARIFA" },
    { data: "2026-09-14", valor: -624.48, historico: "PIX EMITIDO MESMA TIT" },
  ], "s", "t", {}).extratos;
  const cor = M.extratosComArquivo({}, [
    { data: "2026-09-14", valor: 624.48, historico: "Transf Pix recebida · LEO PADOVAN" },
    { data: "2026-09-15", valor: -50, historico: "Pagamento fornecedor" },
  ], "c", "t", { contaId: "cora" }).extratos;
  const idSic = Object.values(sic)[0].movimentos.find((m) => m.valor === -624.48).id;
  const idCor = Object.values(cor)[0].movimentos.find((m) => m.valor === 624.48).id;
  const lancs = [
    { id: "t1", tipo: "escritorio", contaId: "taxas_impostos", unidadeId: "escritorio", valor: 100, competencia: "2026-09", lancadoEm: "2026-09-10", contaBanco: "sim" },
    { id: "s", tipo: "escritorio", contaId: "transf_saida", unidadeId: "escritorio", valor: 624.48, competencia: "2026-09", lancadoEm: "2026-09-14", extratoId: idSic, contaBanco: "sim", transferenciaId: "tr" },
    { id: "e", tipo: "escritorio", contaId: "transf_entrada", unidadeId: "escritorio", valor: 624.48, competencia: "2026-09", lancadoEm: "2026-09-14", extratoId: idCor, contaBanco: "sim", contaBancariaId: "cora", transferenciaId: "tr" },
  ];
  const movsCartao = M.comIdsDoCartao(M.comCompetenciaDaFatura(M.movimentosDoCartao(FATURA_CSV).movimentos, CORA), "kc");
  const fin = { extratos: sic, extratosContas: { cora: cor }, faturasArquivo: { kc: M.faturasComArquivo({}, movsCartao, "f", "t").faturas } };
  const u = M.conferenciaUnificada({ fin, contas, cartoes: [CORA], lancamentos: lancs, obras: [OBRA_JAC], clientes: [], mes: "2026-09" });
  assert.strictEqual(u.meios.length, 3);
  // fila: o pagamento de 50 da Cora e as 2 compras do cartão que faltam
  const fila = u.resultado.noBancoSemPar;
  assert.strictEqual(fila.filter((m) => m._meio === "cora").length, 1);
  assert.strictEqual(fila.filter((m) => m._cartao).length, 2);
  assert.ok(fila.every((m) => m._meio));
  // débito × crédito sem a transferência: débitos 100 + 50, créditos 0
  assert.strictEqual(u.checagem.extrato.debitos, 150);
  assert.strictEqual(u.checagem.extrato.creditos, 0);
  assert.strictEqual(u.checagem.base.saidas, 100);
  assert.strictEqual(u.checagem.base.entradas, 0);
  assert.strictEqual(u.checagem.transferencias.debitos, 624.48);
  assert.strictEqual(u.checagem.transferencias.creditos, 624.48);
  assert.strictEqual(u.checagem.bate, false);                 // falta lançar os 50
  assert.strictEqual(u.resultado.contabilizadoSemPar.length, 0);
  assert.strictEqual(u.faturas.length, 1);
  // conta sem extrato no mês: não acusa os lançamentos dela
  const u2 = M.conferenciaUnificada({ fin: { extratos: sic }, contas, cartoes: [], lancamentos: lancs, mes: "2026-09" });
  assert.strictEqual(u2.resultado.contabilizadoSemPar.length, 0);
  assert.strictEqual(u2.meios[1].conciliacao, null);
});

teste("débito do banco que paga a fatura: acha a fatura aberta do cartão pago pela conta", () => {
  const m = { id: "x", data: "2026-09-15", valor: -634.48, historico: "Pagamento da fatura · Cora SCFI" };
  const f = M.faturaParaALinhaDoBanco(m, "cora", [CORA], [OBRA_JAC], [], {});
  assert.ok(f && f.exata);
  assert.strictEqual(f.cartao.id, "kc"); assert.strictEqual(f.competencia, "2026-09"); assert.strictEqual(f.compras, 1);
  // outra conta: não é dela
  assert.strictEqual(M.faturaParaALinhaDoBanco(m, "principal", [CORA], [OBRA_JAC], [], {}), null);
  // valor diferente, com cara de fatura: devolve a mais perto e a diferença
  const p = M.faturaParaALinhaDoBanco({ ...m, valor: -700 }, "cora", [CORA], [OBRA_JAC], [], {});
  assert.strictEqual(p.exata, false); assert.strictEqual(p.diferenca, 65.52);
  // sem cara de fatura e valor diferente: nada
  assert.strictEqual(M.faturaParaALinhaDoBanco({ ...m, valor: -700, historico: "PIX FULANO" }, "cora", [CORA], [OBRA_JAC], [], {}), null);
  // fatura já fechada: nada
  const fechada = { id: M.idDaFatura("kc", "2026-09"), tipo: "escritorio", origem: { tipo: "fatura", cartaoId: "kc", competencia: "2026-09" } };
  assert.strictEqual(M.faturaParaALinhaDoBanco(m, "cora", [CORA], [OBRA_JAC], [fechada], {}), null);
  // fatura que só vence depois do mês da linha: nada
  assert.strictEqual(M.faturaParaALinhaDoBanco({ ...m, data: "2026-08-15" }, "cora", [CORA], [OBRA_JAC], [], {}), null);
});

for (const [nome, fn] of testes) {
  try { await fn(); console.log("  ok   " + nome); }
  catch (e) { falhas++; console.log("  FALHOU " + nome + "\n         " + e.message); }
}
console.log(`\n${testes.length - falhas}/${testes.length} passaram`);
process.exit(falhas ? 1 : 0);
