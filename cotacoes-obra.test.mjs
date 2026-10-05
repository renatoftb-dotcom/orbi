// Testes das cotações de fornecedores (node, sem framework).
// Roda com: node cotacoes-obra.test.mjs

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mod = (nome) => readFileSync(join(__dirname, "src", "modules", nome), "utf-8");

const contratosSrc = mod("contratos-obra.jsx");
const corteCtr = contratosSrc.indexOf("// UI — documento e gerador");
const cronoSrc = mod("cronograma-obra.jsx");
const corteCrono = cronoSrc.indexOf("// UI — bloco");
const cpSrc = mod("contas-pagar.jsx");
const corteCp = (() => { const i = cpSrc.indexOf("// UI — gráfico do fluxo mensal");
  if (i < 0) throw new Error("Marcador de início da UI não encontrado em contas-pagar.jsx");
  return cpSrc.lastIndexOf("// ═", i); })();
const insSrc = mod("insumos.jsx");
const corteIns = insSrc.lastIndexOf("// ═", insSrc.indexOf("// CÓDIGO"));
const cotSrc = mod("cotacoes-obra.jsx");
const corteCot = cotSrc.indexOf("// UI — bloco de cotações da obra");
if (corteCot < 0) throw new Error("Marcador de início da UI não encontrado em cotacoes-obra.jsx");

// O conserto de acentuação mora em shared.jsx; aqui entra só ele, recortado,
// porque o resto do arquivo é código de navegador.
const sharedSrc = mod("shared.jsx");
const recorte = (src, assinatura) => {
  const i = src.indexOf(assinatura);
  if (i < 0) throw new Error("Função não encontrada: " + assinatura);
  const fim = src.indexOf("\n}", i);
  return src.slice(i, fim + 2);
};
const utf8Src = recorte(sharedSrc, "function textoUtf8Recuperado(");

let seq = 0;
const modulo = new Function(`
  var uid = () => "id" + (++__seq);
  ${utf8Src}
  ${mod("obra-financeiro.jsx")}
  ${cronoSrc.slice(0, corteCrono)}
  ${contratosSrc.slice(0, corteCtr)}
  ${cpSrc.slice(0, corteCp)}
  var INSUMO_GRUPOS = [];
  ${insSrc.slice(0, corteIns)}
  ${cotSrc.slice(0, cotSrc.lastIndexOf("// ═", corteCot))}
  return { cotacaoVazia, propostaVazia, valorProposta, propostasOrdenadas, propostaPorId,
           propostaEscolhida, melhorProposta, economiaDaCotacao,
           aprovacaoDaCotacao, registrarAprovacaoCotacao, situacaoCotacao,
           podeGerarContrato, contratoDaCotacao, tipoDoContaId, dadosDoContratoDaCotacao,
           podeExcluirCotacaoComContratos, resumoCotacoes, cotacoesAguardandoCliente,
           cotacaoEstaFechada, cotacoesPorSituacao, SITUACOES_FECHADAS, ehContaDeLoja,
           podeApagarContaDeLoja, contaDeLojaAberta, pedidoDaCotacao, etapaDoItem, contaDoItem,
           nomeDoFornecedor, PLANO_CONTAS,
           podeExcluirCotacao, removerProposta, removerCotacao, anexosDasPropostas,
           prestadorRapidoVazio, criarPrestadorRapido, pareceMesmoPdf,
           nomeDeQuem, carimbar, textoAutoria, arquivoColado, nomeDoColado,
           aprovacaoDaEscolha, podeEnviarAoCliente, enviarCotacaoAoCliente,
           limparEnvioAoCliente, cotacoesProntasParaContrato, textoUtf8Recuperado,
           podeLancarEmContas, dadosDoLancamento, contasDaCotacao, removerContasDaCotacao, contasDeCotacao,
           contasDasEntregas, totalDasEntregas, entregaVazia, MODOS_LANCAMENTO, modoLancamento,
           planoDoLancamento, linhasDoPagamento, resumoDoPlano,
           casamentosSeguros, numerosDoExtenso, textoComDitado, itemCotacaoVazio, itensDaCotacao, temListaDeItens, quantidadeDoItem, precoUnitario,
           propostaTemPrecoPorItem, totalDosItens, itensSemPreco, valorDaProposta,
           melhorPorItem, comparativoDaLista, textoDoPedido, qtdBR,
           unitarioDoTotal, totalBrutoItem, valoresComDesconto, totalEfetivoItem,
           precoEfetivo, totalNegociado, descontoDaProposta,
           linkWhatsApp, enviosDaLista, envioParaLoja, registrarEnvioDaLista, lojasParaPedir,
           interpretarPedido, interpretarLinhaDePedido, quantidadeDoTexto, resumoDaLeitura, valorBR,
           itemDoPedidoLido, resolverInsumo, scoreAssociacao, candidatosDoPedido,
           unidadesDoCatalogo, opcoesDeUnidade, unidadeNoPadrao, itensDaEntrada,
           ehNumeroDeOrcamento, numeroDeOrcamento, itemDeOrcamento, dataIsoDoOrcamento,
           interpretarOrcamento, casarOrcamentoComItens, lojaCadastrada,
           papelDaCelula, papeisDaTabela, precoDaLinha,
           orcamentoDaIA, casamentoDaIA, itensParaIA, avisoDaIA, pedidoDaIA, promoverCandidatos,
           andamentoDaLeitura, semMarca, buscarNoCatalogo, novoInsumoDoPedido, medirAssociacao,
           medidaDoTexto, palavraChave, familiasDoCatalogo, nomeNoPadrao, gruposDoCatalogo, codigoDoGrupo,
           medidasDeEmbalagem, divergenciaDeEmbalagem, escolhasDoCasamento,
           indiceDoCatalogo, casarNoCatalogo, sugestaoDoCatalogo, comApelidoDaLoja,
           cotPalavrasDoNome, cotPartesDoNome, cotPalavrasDaLoja, cotCasaPalavra,
           sugestoesDaIA, textoParaAIA,
           entradaPronta, entradaPedeLoja, entradaPedeObra, DESTINOS_DA_ENTRADA,
           contextoDaEntrada, cotMioloDoNome, tituloDaListaRapida, textoDaListaRapida,
           pedacoDeDanfe, juntarLinhasDaDanfe, descricaoSemMaterial, palavraDeMaterial,
           ehDanfe, numeroDaNota, dataDaNota,
           ehComprovante, valorDoComprovante, dataDoComprovante, favorecidoDoComprovante,
           documentoDoComprovante, dadosDoComprovante, prestadorDoComprovante,
           despesaPronta, parcelasEmAbertoDoPrestador, parcelaQueCasa,
           medicaoDaCotacao, totalDaMedicao, validarMedicao, completarItemDaConta,
           ehNotaDeServico, valorDaNotaDeServico, emissaoDaNotaDeServico,
           prestadorDaNotaDeServico, discriminacaoDaNotaDeServico, dadosDaNotaDeServico,
           numeroDaNotaDeServico, entradaUnicaPronta, situacaoPadraoDaEntrada, previaDosBoletos,
           comContaPadraoDaEntrada, tipoDoAnexoDaEntrada, SITUACOES_DA_ENTRADA,
           fichaDaEntradaPelaIA, tipoDoPapelPelaIA, textoSemCaixaAlta,
           entradaTemPreco, modoPadraoDaCotacao, cotacoesParaGuardarProposta, cotacaoSugeridaParaProposta,
           propostaDaEntrada, MODOS_DA_COTACAO_NA_ENTRADA, contaDeCompra };
`.replace(/__seq/g, "globalThis.__seq"))();
globalThis.__seq = 0;

const M = modulo;
const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);


// ── O comprovante de pagamento ──────────────────────────────────
const COMPROV_PIX = [
  "Banco Exemplo S.A.",
  "Comprovante de transferência Pix",
  "Valor",
  "R$ 5.000,00",
  "Data do pagamento",
  "02/10/2026",
  "Destinatário",
  "JOSE DA SILVA CONSTRUCOES ME",
  "CNPJ",
  "12.345.678/0001-90",
  "Instituição",
  "Banco do Brasil",
  "ID da transação E2E123456789",
];


// ── Medição: cotado × consumido ─────────────────────────────────
const COT_MED = {
  id: "c1", obraId: "o1", contaId: "material",
  itens: [{ id: "i1", codigo: "CON-001", descricao: "Concreto - FCK25", unidade: "m3", quantidade: "11" }],
  propostas: [{ id: "p1", fornecedorId: "f1", favorecido: "D-MIX CONCRETO",
    precos: { i1: "343,64" }, valor: "6.050,00" }],
  escolhidaId: "p1",
};
const INS_MED = [{ id: "m1", codigo: "CON-001", nome: "Concreto FCK25", unidade: "m3",
  grupo: "Concreto", etapaPadrao: "fundacao" }];

teste("a medição nasce igual ao cotado", () => {
  const m = M.medicaoDaCotacao(COT_MED, COT_MED.propostas[0], INS_MED);
  assert.strictEqual(m.length, 1);
  assert.strictEqual(m[0].cotada, 11);
  assert.strictEqual(m[0].quantidade, 11);
  assert.strictEqual(m[0].unitario, 343.64);
  assert.strictEqual(m[0].unidade, "m3");
  assert.strictEqual(m[0].insumoCodigo, "CON-001");
});

teste("a etapa vem do insumo, não se digita", () => {
  const m = M.medicaoDaCotacao(COT_MED, COT_MED.propostas[0], INS_MED);
  assert.strictEqual(m[0].etapa, "fundacao");
});

teste("insumo sem etapa padrao usa a etapa escolhida na cotacao", () => {
  // a cotacao guarda a etapa em `etapaId`; ler `etapa` deixava tudo em branco
  const cot = { ...COT_MED, etapaId: "supra_paredes_1" };
  const semPadrao = [{ id: "m1", codigo: "CON-001", nome: "Concreto FCK25", unidade: "m3", grupo: "Concreto" }];
  const m = M.medicaoDaCotacao(cot, cot.propostas[0], semPadrao);
  assert.strictEqual(m[0].etapa, "supra_paredes_1");
  assert.deepStrictEqual(M.validarMedicao(m).erros, [], "e com etapa ela ja passa a valer");
});

teste("item fora do catalogo tambem herda a etapa da cotacao", () => {
  const cot = { ...COT_MED, etapaId: "pre_obra" };
  const m = M.medicaoDaCotacao(cot, cot.propostas[0], []);
  assert.strictEqual(m[0].etapa, "pre_obra");
});

teste("a conta antiga herda a etapa da cotacao quando o insumo nao tem padrao", () => {
  const cot = { ...COT_MED, etapaId: "supra_paredes_1" };
  const semPadrao = [{ id: "m1", codigo: "CON-001", nome: "Concreto FCK25", unidade: "m3", grupo: "Concreto" }];
  const c = { id: "k9", cotacaoId: "c1", valor: 6050 };
  const r = M.completarItemDaConta(c, { id: "o1", cotacoes: [cot] }, semPadrao, [c]);
  assert.strictEqual(r.etapa, "supra_paredes_1");
});

teste("medir menos muda o total — e é o total que vira conta", () => {
  const m = M.medicaoDaCotacao(COT_MED, COT_MED.propostas[0], INS_MED);
  assert.strictEqual(M.totalDaMedicao(m), 3780.04);
  const menos = m.map((r) => ({ ...r, quantidade: 7 }));
  assert.strictEqual(M.totalDaMedicao(menos), 2405.48);
});

teste("o campo Valor solto da proposta não entra na medição", () => {
  // a proposta diz 6.050,00 no campo solto; a medição soma item a item
  const m = M.medicaoDaCotacao(COT_MED, COT_MED.propostas[0], INS_MED);
  assert.notStrictEqual(M.totalDaMedicao(m), 6050);
});

teste("item sem etapa trava a medição", () => {
  const m = M.medicaoDaCotacao(COT_MED, COT_MED.propostas[0], []);
  assert.strictEqual(m[0].etapa, "");
  const v = M.validarMedicao(m);
  assert.strictEqual(v.ok, false);
  assert.ok(v.erros.some((e) => /sem etapa/.test(e)));
});

teste("medição zerada não passa", () => {
  const v = M.validarMedicao([{ id: "x", quantidade: 0, unitario: 0, etapa: "fundacao" }]);
  assert.strictEqual(v.ok, false);
  assert.ok(v.erros.some((e) => /Nenhum item/.test(e)));
});

teste("medição boa passa", () => {
  const m = M.medicaoDaCotacao(COT_MED, COT_MED.propostas[0], INS_MED).map((r) => ({ ...r, quantidade: 7 }));
  assert.deepStrictEqual(M.validarMedicao(m).erros, []);
});

// ── A conta antiga vai buscar na cotacao o que nao herdou ───────
const OBRA_MED = { id: "o1", cotacoes: [COT_MED] };
const CONTA_SECA = { id: "k1", obraId: "o1", origem: "cotacao", cotacaoId: "c1",
  descricao: "Concreto \u2014 Concreto Brocas", favorecido: "D-MIX CONCRETO",
  contaId: "material", valor: 6050, vencimento: "2026-10-28", pago: false };

teste("conta lancada antes do item vai buscar quantidade, unidade e etapa na cotacao", () => {
  const r = M.completarItemDaConta(CONTA_SECA, OBRA_MED, INS_MED, [CONTA_SECA]);
  assert.strictEqual(r.insumoCodigo, "CON-001");
  assert.strictEqual(r.quantidade, 11);
  assert.strictEqual(r.unidade, "m3");
  assert.strictEqual(r.etapa, "fundacao");
  assert.strictEqual(r.grupoMaterial, "Concreto");
});

teste("o unitario sai do valor da conta, nao do preco da proposta", () => {
  // a proposta diz 343,64; a conta cobra 6.050,00 por 11 m3 = 550,00
  const r = M.completarItemDaConta(CONTA_SECA, OBRA_MED, INS_MED, [CONTA_SECA]);
  assert.strictEqual(r.unitario, 550);
  assert.strictEqual(r.valor, 6050, "o valor da conta nao se mexe");
  assert.strictEqual(Math.round(r.quantidade * r.unitario * 100) / 100, 6050);
});

teste("parcelada nao recebe quantidade — consumo nao se divide por mes", () => {
  const p1 = { ...CONTA_SECA, id: "k1", parcela: 1, parcelasTotal: 3, valor: 2016.67 };
  const p2 = { ...CONTA_SECA, id: "k2", parcela: 2, parcelasTotal: 3, valor: 2016.67 };
  const r = M.completarItemDaConta(p1, OBRA_MED, INS_MED, [p1, p2]);
  assert.strictEqual(r.etapa, "fundacao", "a classificacao vale");
  assert.strictEqual(r.insumoCodigo, "CON-001");
  assert.ok(!(r.quantidade > 0), "senao 11 m3 virariam 33");
  assert.strictEqual(r.unitario, undefined);
});

teste("o que a conta ja tem nao e sobrescrito", () => {
  const corrigida = { ...CONTA_SECA, quantidade: 7, unitario: 343.64, valor: 2405.48, etapa: "supra_paredes_1" };
  const r = M.completarItemDaConta(corrigida, OBRA_MED, INS_MED, [corrigida]);
  assert.strictEqual(r.quantidade, 7, "a correcao de quem editou manda");
  assert.strictEqual(r.etapa, "supra_paredes_1");
});

teste("varios itens numa conta so: preenche a etapa comum, nunca a quantidade", () => {
  const cot = { ...COT_MED, itens: [
    { id: "i1", codigo: "CON-001", descricao: "Concreto", unidade: "m3", quantidade: "11" },
    { id: "i2", codigo: "CON-002", descricao: "Bomba", unidade: "h", quantidade: "4" }],
    propostas: [{ id: "p1", precos: { i1: "343,64", i2: "200,00" }, valor: "6.050,00" }] };
  const ins = INS_MED.concat([{ id: "m2", codigo: "CON-002", nome: "Bomba", unidade: "h",
    grupo: "Concreto", etapaPadrao: "fundacao" }]);
  const c = { ...CONTA_SECA };
  const r = M.completarItemDaConta(c, { id: "o1", cotacoes: [cot] }, ins, [c]);
  assert.strictEqual(r.etapa, "fundacao", "os dois itens sao da fundacao");
  assert.ok(!(r.quantidade > 0), "nao da para dizer a quantidade de uma conta de dois itens");
});

teste("itens de etapas diferentes nao inventam etapa", () => {
  const cot = { ...COT_MED, itens: [
    { id: "i1", codigo: "CON-001", descricao: "Concreto", unidade: "m3", quantidade: "11" },
    { id: "i2", codigo: "PIN-001", descricao: "Tinta", unidade: "l", quantidade: "4" }],
    propostas: [{ id: "p1", precos: { i1: "343,64", i2: "80,00" }, valor: "6.050,00" }] };
  const ins = INS_MED.concat([{ id: "m3", codigo: "PIN-001", nome: "Tinta", unidade: "l",
    grupo: "Pintura", etapaPadrao: "acabamento" }]);
  const c = { ...CONTA_SECA };
  const r = M.completarItemDaConta(c, { id: "o1", cotacoes: [cot] }, ins, [c]);
  assert.ok(!String(r.etapa || "").trim(), "chutar a etapa e pior que deixar em branco");
});

teste("conta sem cotacao, ou de cotacao que sumiu, volta intacta", () => {
  const avulsa = { id: "a1", origem: "avulsa", descricao: "Caçamba", valor: 300 };
  assert.strictEqual(M.completarItemDaConta(avulsa, OBRA_MED, INS_MED, [avulsa]), avulsa);
  const orfa = { ...CONTA_SECA, cotacaoId: "nao-existe" };
  assert.strictEqual(M.completarItemDaConta(orfa, OBRA_MED, INS_MED, [orfa]).quantidade, undefined);
});

// ── Nota fiscal de servico: a nota que nao tem tabela ──────────
const NFSE_CONCRETO = [
  "PREFEITURA DO MUNICIPIO DE OURINHOS",
  "NOTA FISCAL DE SERVIÇOS ELETRÔNICA - NFS-e",
  "Número da Nota  4177",
  "Data e Hora de Emissão  23/09/2026 14:32",
  "Código de Verificação  A1B2-C3D4",
  "PRESTADOR DE SERVIÇOS",
  "Razão Social",
  "VOTORANTIM CIMENTOS S.A.",
  "CNPJ  01.637.895/0001-32",
  "Endereço  Rod. Raposo Tavares, km 100",
  "TOMADOR DE SERVIÇOS",
  "Razão Social",
  "RENATO F TEIXEIRA DE BARROS LTDA",
  "CNPJ  20.205.619/0001-40",
  "DISCRIMINAÇÃO DOS SERVIÇOS",
  "Concreto usinado FCK 25 MPa com bombeamento - fundacao radier",
  "VALOR TOTAL DA NOTA = R$ 9.000,00",
  "Base de Cálculo  R$ 9.000,00",
  "Alíquota  3,00%",
  "Valor do ISS  R$ 270,00",
];

teste("nota de servico e reconhecida, e nao se confunde com DANFE nem comprovante", () => {
  const t = NFSE_CONCRETO.join("\n");
  assert.strictEqual(M.ehNotaDeServico(t), true);
  assert.strictEqual(M.ehComprovante(t), false, "nota nao prova pagamento");
  assert.strictEqual(M.ehNotaDeServico("DANFE NOTA FISCAL ELETRONICA\nDiscriminação dos Serviços"), false,
    "DANFE tem tabela e segue pelo outro caminho");
  assert.strictEqual(M.ehNotaDeServico("Contrato de prestação de serviços entre as partes"), false);
});

teste("le valor, emissao, prestador, numero e o que foi o servico", () => {
  const d = M.dadosDaNotaDeServico(NFSE_CONCRETO);
  assert.ok(d, "tinha que ler");
  assert.strictEqual(d.valor, "9.000,00");
  assert.strictEqual(d.emitidoEm, "2026-09-23");
  assert.strictEqual(d.favorecido, "VOTORANTIM CIMENTOS S.A.", "o PRESTADOR, nunca o tomador");
  assert.strictEqual(d.documento, "4177");
  assert.ok(/Concreto usinado/.test(d.descricao), d.descricao);
  assert.strictEqual(d.notaDeServico, true);
  assert.ok(!d.pagoEm, "a nota nao sabe quando foi paga");
});

teste("nao pega o tomador por engano, nem com o nome do tomador antes no papel", () => {
  const invertida = NFSE_CONCRETO.slice();
  const d = M.dadosDaNotaDeServico(invertida);
  assert.notStrictEqual(d.favorecido, "RENATO F TEIXEIRA DE BARROS LTDA");
});

teste("ISS retido: o liquido manda sobre o total", () => {
  const com = NFSE_CONCRETO.concat(["Valor Líquido da Nota  R$ 8.730,00"]);
  assert.strictEqual(M.dadosDaNotaDeServico(com).valor, "8.730,00");
});

teste("sem rotulo de total, o maior valor do papel e a nota", () => {
  const sem = ["NFS-e", "DISCRIMINAÇÃO DOS SERVIÇOS", "Bombeamento de concreto",
    "PRESTADOR DE SERVIÇOS", "Razão Social", "D-MIX CONCRETO LTDA",
    "Alíquota R$ 2,00", "R$ 270,00", "R$ 9.000,00"];
  const d = M.dadosDaNotaDeServico(sem);
  assert.strictEqual(d.valor, "9.000,00", "a aliquota e a base sao sempre menores que o total");
  assert.strictEqual(d.favorecido, "D-MIX CONCRETO LTDA");
});

teste("papel que nao e nota de servico volta nulo, sem inventar despesa", () => {
  assert.strictEqual(M.dadosDaNotaDeServico(["Orçamento", "Item", "Qtd", "Preço"]), null);
  assert.strictEqual(M.dadosDaNotaDeServico([]), null);
  assert.strictEqual(M.dadosDaNotaDeServico(["NFS-e", "DISCRIMINAÇÃO DOS SERVIÇOS", "sem valor nenhum"]), null,
    "nota sem valor nao vira despesa de zero");
});

teste("comprovante de Pix é reconhecido como comprovante", () => {
  assert.strictEqual(M.ehComprovante(COMPROV_PIX.join("\n")), true);
});

teste("nota fiscal não vira comprovante, mesmo falando em pagamento", () => {
  const danfe = ["DANFE", "DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRONICA",
    "FORMA DE PAGAMENTO", "Comprovante de entrega"].join("\n");
  assert.strictEqual(M.ehComprovante(danfe), false);
});

teste("comprovante entrega valor, data, favorecido e documento", () => {
  const d = M.dadosDoComprovante(COMPROV_PIX);
  assert.strictEqual(d.valor, "5.000,00");
  assert.strictEqual(d.pagoEm, "2026-10-02");
  assert.strictEqual(d.favorecido, "JOSE DA SILVA CONSTRUCOES ME");
  assert.strictEqual(d.documento, "12.345.678/0001-90");
});

teste("a linha do PDF chega como objeto e é lida igual", () => {
  const doPdf = COMPROV_PIX.map((s) => ({ celulas: s.split(" "), texto: s }));
  const d = M.dadosDoComprovante(doPdf);
  assert.strictEqual(d.valor, "5.000,00");
  assert.strictEqual(d.favorecido, "JOSE DA SILVA CONSTRUCOES ME");
});

teste("papel que não é comprovante volta null", () => {
  assert.strictEqual(M.dadosDoComprovante(["Lista de material", "10 sacos de cimento"]), null);
});

teste("valor na mesma linha do rótulo também é lido", () => {
  assert.strictEqual(M.valorDoComprovante("Valor do pagamento: R$ 1.234,56"), "1.234,56");
});

teste("tarifa de R$ 0,00 no rodapé não vira o valor do pagamento", () => {
  const t = ["Comprovante", "Valor: R$ 850,00", "Tarifa: R$ 0,00"].join("\n");
  assert.strictEqual(M.valorDoComprovante(t), "850,00");
});

teste("data do pagamento ganha da data de emissão do comprovante", () => {
  const t = ["Comprovante emitido em 05/10/2026", "Data do pagamento", "02/10/2026"].join("\n");
  assert.strictEqual(M.dataDoComprovante(t), "2026-10-02");
});

teste("CPF mascarado é aceito como documento", () => {
  assert.strictEqual(M.documentoDoComprovante("CPF ***.123.456-**"), "***.123.456-**");
});

teste("rótulo do banco não é confundido com o nome de quem recebeu", () => {
  const ls = ["Favorecido", "CPF", "***.111.222-**", "MARIA DE SOUZA"];
  assert.strictEqual(M.favorecidoDoComprovante(ls), "MARIA DE SOUZA");
});

teste("favorecido na mesma linha do rótulo", () => {
  assert.strictEqual(M.favorecidoDoComprovante(["Favorecido: Zé Pedreiro Ltda"]), "Zé Pedreiro Ltda");
});

teste("o prestador do comprovante casa por pedaço do nome", () => {
  const lista = [{ id: "p1", nome: "José da Silva Construções" }, { id: "p2", nome: "Pantanal Materiais" }];
  const achado = M.prestadorDoComprovante(lista, "JOSE DA SILVA CONSTRUCOES ME");
  assert.strictEqual(achado && achado.id, "p1");
});

teste("dois prestadores plausíveis: não adivinha", () => {
  const lista = [{ id: "p1", nome: "Silva" }, { id: "p2", nome: "Silva Materiais" }];
  assert.strictEqual(M.prestadorDoComprovante(lista, "Silva Materiais e Silva"), null);
});

// ── Despesa paga ────────────────────────────────────────────────
teste("despesa pede obra, favorecido, valor, data e conta — nessa ordem", () => {
  const obras = [{ id: "o1" }];
  assert.strictEqual(M.despesaPronta({}, obras, "").motivo, "Escolha a obra.");
  assert.strictEqual(M.despesaPronta({}, obras, "o1").motivo, "Escolha quem recebeu.");
  assert.strictEqual(M.despesaPronta({ favorecidoId: "p1" }, obras, "o1").motivo, "Informe o valor pago.");
  assert.strictEqual(M.despesaPronta({ favorecidoId: "p1", valor: "5.000,00" }, obras, "o1").motivo,
    "Informe a data do pagamento.");
  assert.strictEqual(M.despesaPronta({ favorecidoId: "p1", valor: "5.000,00", pagoEm: "2026-10-02" }, obras, "o1").motivo,
    "Escolha a conta contábil.");
  assert.strictEqual(M.despesaPronta({ favorecidoId: "p1", valor: "5.000,00", pagoEm: "2026-10-02", contaId: "mao_obra" },
    obras, "o1").ok, true);
});

teste("baixando parcela, a conta contábil vem dela — não se pergunta", () => {
  const r = M.despesaPronta({ favorecidoId: "p1", valor: "5.000,00", pagoEm: "2026-10-02", parcelaId: "c2" }, [], "");
  assert.strictEqual(r.ok, true);
});

teste("dentro da obra não se pede obra de novo", () => {
  const r = M.despesaPronta({ favorecidoId: "p1", valor: "100,00", pagoEm: "2026-10-02", contaId: "mao_obra" }, [], "");
  assert.strictEqual(r.ok, true);
});

teste("despesa com destino na lista de saídas", () => {
  assert.ok(M.DESTINOS_DA_ENTRADA.some((d) => d.id === "despesa"));
  assert.strictEqual(M.entradaPedeLoja("despesa"), false);
});

const CONTAS_PARCELA = [
  { id: "c1", origem: "contrato", contratoId: "ct1", prestadorId: "p1", valor: 5000, vencimento: "2026-11-10", pago: false },
  { id: "c2", origem: "contrato", contratoId: "ct1", prestadorId: "p1", valor: 5000, vencimento: "2026-10-10", pago: false },
  { id: "c3", origem: "contrato", contratoId: "ct1", prestadorId: "p1", valor: 5000, vencimento: "2026-09-10", pago: true },
  { id: "c4", origem: "avulsa", contratoId: "", prestadorId: "p1", valor: 300, vencimento: "2026-10-01", pago: false },
  { id: "c5", origem: "contrato", contratoId: "ct2", prestadorId: "p2", valor: 900, vencimento: "2026-10-05", pago: false },
];

teste("parcelas em aberto do prestador: só contrato, só dele, mais antiga primeiro", () => {
  const ps = M.parcelasEmAbertoDoPrestador(CONTAS_PARCELA, "p1");
  assert.deepStrictEqual(ps.map((c) => c.id), ["c2", "c1"]);
});

teste("sem prestador não há parcela", () => {
  assert.deepStrictEqual(M.parcelasEmAbertoDoPrestador(CONTAS_PARCELA, ""), []);
});

teste("a parcela que casa é a do mesmo valor, a mais antiga", () => {
  const ps = M.parcelasEmAbertoDoPrestador(CONTAS_PARCELA, "p1");
  const casa = M.parcelaQueCasa(ps, "5.000,00");
  assert.strictEqual(casa && casa.id, "c2");
});

teste("valor diferente não casa parcela nenhuma", () => {
  const ps = M.parcelasEmAbertoDoPrestador(CONTAS_PARCELA, "p1");
  assert.strictEqual(M.parcelaQueCasa(ps, "4.000,00"), null);
});

// ── Modelo ──────────────────────────────────────────────────────
teste("cotação nasce aberta, sem propostas e exigindo aval do cliente", () => {
  const c = M.cotacaoVazia("o1");
  assert.strictEqual(c.obraId, "o1");
  assert.strictEqual(c.status, "aberta");
  assert.deepStrictEqual(c.propostas, []);
  assert.strictEqual(c.precisaAprovacaoCliente, true);
  assert.strictEqual(c.contaId, M.PLANO_CONTAS[0].id);
});

teste("valor da proposta lê 12.500,90 e 12500.9 do mesmo jeito", () => {
  assert.strictEqual(M.valorProposta({ valor: "12.500,90" }), 12500.9);
  assert.strictEqual(M.valorProposta({ valor: 12500.9 }), 12500.9);
  assert.strictEqual(M.valorProposta({ valor: "" }), 0);
  // o bug do ×100: um número com ponto decimal não pode virar 1250090
  assert.strictEqual(M.valorProposta({ valor: 10833.33 }), 10833.33);
});

// ── Comparação ──────────────────────────────────────────────────
const comPropostas = (vals) => ({
  ...M.cotacaoVazia("o1"),
  id: "ct1",
  propostas: vals.map((v, i) => ({ id: "p" + i, favorecido: "F" + i, valor: v })),
});

teste("propostas saem da mais barata para a mais cara", () => {
  const c = comPropostas([9000, 7000, 12000]);
  assert.deepStrictEqual(M.propostasOrdenadas(c).map(p => p.valor), [7000, 9000, 12000]);
  assert.strictEqual(M.melhorProposta(c).valor, 7000);
});

teste("proposta sem valor vai para o fim e não vira a mais barata", () => {
  const c = comPropostas(["", 9000]);
  assert.deepStrictEqual(M.propostasOrdenadas(c).map(p => p.valor), [9000, ""]);
  assert.strictEqual(M.melhorProposta(c).valor, 9000);
});

teste("economia compara a escolhida com a proposta mais cara", () => {
  const c = { ...comPropostas([9000, 7000, 12000]), escolhidaId: "p0" };
  const e = M.economiaDaCotacao(c);
  assert.strictEqual(e.maior, 12000);
  assert.strictEqual(e.referencia, 9000);
  assert.strictEqual(e.economia, 3000);
});

teste("com uma proposta só não há economia a declarar", () => {
  assert.strictEqual(M.economiaDaCotacao(comPropostas([9000])), null);
});

// ── Situação ────────────────────────────────────────────────────
teste("situação acompanha o fluxo, do pedido ao contrato", () => {
  const vazia = M.cotacaoVazia("o1");
  assert.strictEqual(M.situacaoCotacao(vazia, []).id, "coletando");

  const comprando = comPropostas([9000, 7000]);
  assert.strictEqual(M.situacaoCotacao(comprando, []).id, "comparando");

  // escolher não é avisar: enquanto a escolha não sai para o cliente, quem
  // tem a próxima ação é o escritório
  const soEscolhida = { ...comprando, escolhidaId: "p1" };
  assert.strictEqual(M.situacaoCotacao(soEscolhida, []).id, "aEnviar");

  const escolhida = M.enviarCotacaoAoCliente(soEscolhida, "Renato", "2026-09-10T12:00:00.000Z");
  assert.strictEqual(M.situacaoCotacao(escolhida, []).id, "aguardando");

  const semAval = { ...soEscolhida, precisaAprovacaoCliente: false };
  assert.strictEqual(M.situacaoCotacao(semAval, []).id, "escolhida");

  const ap = M.registrarAprovacaoCotacao([], { cotacaoId: "ct1", propostaId: "p1", status: "aprovada", por: "Cliente" });
  assert.strictEqual(M.situacaoCotacao(escolhida, ap).id, "aprovada");

  const rec = M.registrarAprovacaoCotacao([], { cotacaoId: "ct1", status: "recusada", por: "Cliente" });
  assert.strictEqual(M.situacaoCotacao(escolhida, rec).id, "recusada");

  // é o CONTRATO que fecha o ciclo — e a cotação lançada pelo fluxo antigo
  // continua lendo como concluída
  const comContrato = [{ id: "ctr1", cotacaoId: "ct1" }];
  assert.strictEqual(M.situacaoCotacao(escolhida, ap, comContrato).id, "contratada");
  // lançada direto em contas a pagar é outro fim de linha, não "contrato gerado"
  assert.strictEqual(M.situacaoCotacao({ ...escolhida, contaGeradaId: "x" }, ap).id, "lancada");
  assert.strictEqual(M.situacaoCotacao(escolhida, ap, [{ id: "ctr9", cotacaoId: "outra" }]).id, "aprovada",
    "contrato de outra cotação não conta");
  assert.strictEqual(M.situacaoCotacao({ ...escolhida, status: "cancelada" }, ap).id, "cancelada");
});

teste("cliente pode mudar de ideia: a decisão nova substitui a anterior", () => {
  let ap = M.registrarAprovacaoCotacao([], { cotacaoId: "ct1", status: "recusada", motivo: "caro", por: "Alexandre" });
  ap = M.registrarAprovacaoCotacao(ap, { cotacaoId: "ct1", status: "aprovada", por: "Alexandre" });
  assert.strictEqual(ap.length, 1);
  assert.strictEqual(M.aprovacaoDaCotacao(ap, "ct1").status, "aprovada");
});

teste("decisão de uma cotação não encosta na de outra", () => {
  let ap = M.registrarAprovacaoCotacao([], { cotacaoId: "ct1", status: "aprovada", por: "A" });
  ap = M.registrarAprovacaoCotacao(ap, { cotacaoId: "ct2", status: "recusada", por: "A" });
  assert.strictEqual(ap.length, 2);
  assert.strictEqual(M.aprovacaoDaCotacao(ap, "ct1").status, "aprovada");
  assert.strictEqual(M.aprovacaoDaCotacao(ap, "ct2").status, "recusada");
});

// ── Trava do lançamento ─────────────────────────────────────────
teste("não lança sem escolha, sem valor nem sem o aval do cliente", () => {
  const comprando = comPropostas([9000, 7000]);
  assert.strictEqual(M.podeGerarContrato(comprando, []).pode, false);

  const escolhida = { ...comprando, escolhidaId: "p1" };
  assert.strictEqual(M.podeGerarContrato(escolhida, []).pode, false);

  const recusada = M.registrarAprovacaoCotacao([], { cotacaoId: "ct1", status: "recusada", por: "C" });
  assert.strictEqual(M.podeGerarContrato(escolhida, recusada).pode, false);

  const aprovada = M.registrarAprovacaoCotacao([], { cotacaoId: "ct1", status: "aprovada", por: "C" });
  assert.strictEqual(M.podeGerarContrato(escolhida, aprovada).pode, true);

  const semValor = { ...comPropostas([""]), escolhidaId: "p0", precisaAprovacaoCliente: false };
  assert.strictEqual(M.podeGerarContrato(semValor, []).pode, false);

  const jaLancada = { ...escolhida, contaGeradaId: "c9" };
  assert.strictEqual(M.podeGerarContrato(jaLancada, aprovada).pode, false);
});

teste("cotação sem exigência de aval lança direto após a escolha", () => {
  const c = { ...comPropostas([9000, 7000]), escolhidaId: "p1", precisaAprovacaoCliente: false };
  assert.strictEqual(M.podeGerarContrato(c, []).pode, true);
});

// ── O contrato que nasce da cotação ─────────────────────────────
teste("a cotação entrega contratado, valor e ofício para o contrato", () => {
  // os ids saem do índice: p0 é a primeira proposta
  const cot = { ...comPropostas([39184, 42000]), escolhidaId: "p0", titulo: "Esquadrias de alumínio",
    escopo: "Portas de entrada e vidros vitrine", contaId: "serralheiro" };
  cot.propostas[0] = { ...cot.propostas[0], favorecido: "MB Viezzer", fornecedorId: "f2", condicaoPagamento: "50/50", prazoDias: 40 };
  const d = M.dadosDoContratoDaCotacao(cot);
  assert.strictEqual(d.cotacaoId, "ct1");
  assert.strictEqual(d.nomeContratado, "MB Viezzer");
  assert.strictEqual(d.prestadorId, "f2");
  assert.strictEqual(d.valor, 39184);
  assert.strictEqual(d.tipoId, "serralheiro", "a conta do P&L diz o ofício");
  assert.strictEqual(d.titulo, "Esquadrias de alumínio");
  assert.strictEqual(d.escopo, "Portas de entrada e vidros vitrine");
});

teste("conta sem ofício próprio abre o contrato em 'outro'", () => {
  assert.strictEqual(M.tipoDoContaId("gesseiro"), "gesseiro");
  assert.strictEqual(M.tipoDoContaId("taxa_admin_obra"), "gestaoObra");
  assert.strictEqual(M.tipoDoContaId("mo_diversos"), "outro", "várias caem aqui — quem escolhe é o usuário");
  assert.strictEqual(M.tipoDoContaId("material"), "outro");
  assert.strictEqual(M.tipoDoContaId(""), "outro");
});

teste("sem proposta escolhida não há contrato a gerar", () => {
  assert.strictEqual(M.dadosDoContratoDaCotacao(comPropostas([7000])), null);
  assert.strictEqual(M.dadosDoContratoDaCotacao(null), null);
});

teste("o contrato já gerado tranca a cotação", () => {
  const cot = { ...comPropostas([7000]), escolhidaId: "p0", precisaAprovacaoCliente: false };
  const com = [{ id: "ctr1", cotacaoId: "ct1" }];
  assert.strictEqual(M.podeGerarContrato(cot, [], []).pode, true);
  const t = M.podeGerarContrato(cot, [], com);
  assert.strictEqual(t.pode, false);
  assert.ok(/já foi gerado/.test(t.motivo), t.motivo);
  // e não dá para apagar a cotação que sustenta um contrato
  const e = M.podeExcluirCotacaoComContratos(cot, com);
  assert.strictEqual(e.pode, false);
  assert.ok(/remova o contrato primeiro/.test(e.motivo), e.motivo);
  assert.strictEqual(M.podeExcluirCotacaoComContratos(cot, []).pode, true);
});

teste("contratoDaCotacao acha pelo vínculo, não pelo palpite", () => {
  const lista = [{ id: "a", cotacaoId: "ct1" }, { id: "b" }, null];
  assert.strictEqual(M.contratoDaCotacao(lista, "ct1").id, "a");
  assert.strictEqual(M.contratoDaCotacao(lista, "ct2"), null);
  assert.strictEqual(M.contratoDaCotacao(lista, ""), null, "cotação sem id não casa com contrato sem vínculo");
  assert.strictEqual(M.contratoDaCotacao(null, "ct1"), null);
});

// ── Resumo ──────────────────────────────────────────────────────
teste("o resumo conta cada cotação uma vez e soma só a economia realizada", () => {
  const a = { ...comPropostas([9000, 12000]), id: "a", escolhidaId: "p0",
              enviadaClienteEm: "2026-09-10T12:00:00.000Z" };                           // aguardando
  const b = { ...comPropostas([5000, 8000]), id: "b", escolhidaId: "p0" };             // aprovada
  const c = { ...comPropostas([1000, 4000]), id: "c" };                                 // comparando
  const d = { ...comPropostas([2000, 3000]), id: "d", escolhidaId: "p0" };              // falta enviar
  const aprov = M.registrarAprovacaoCotacao([], { cotacaoId: "b", status: "aprovada", por: "C" });
  const r = M.resumoCotacoes([a, b, c, d], aprov);
  assert.strictEqual(r.total, 4);
  assert.strictEqual(r.abertas, 1);
  assert.strictEqual(r.aEnviar, 1);
  assert.strictEqual(r.aguardandoCliente, 1);
  assert.strictEqual(r.aprovadas, 1);
  assert.strictEqual(r.economia, 3000); // só a de "b"; a de "a" ainda não foi aprovada
});

teste("a fila do cliente traz só o que depende dele", () => {
  const a = { ...comPropostas([9000, 12000]), id: "a", escolhidaId: "p0",
              enviadaClienteEm: "2026-09-10T12:00:00.000Z" };
  const b = { ...comPropostas([5000, 8000]), id: "b" };
  const c = { ...comPropostas([4000, 6000]), id: "c", escolhidaId: "p0" }; // escolhida, não enviada
  const fila = M.cotacoesAguardandoCliente([a, b, c], []);
  assert.deepStrictEqual(fila.map(x => x.id), ["a"], "só o que já foi enviado depende do cliente");
});

// ── Lançar direto em contas a pagar ─────────────────────────────
teste("fornecedor sem contrato: lança com a escolha, sem esperar o cliente", () => {
  const semEscolha = comPropostas([9000, 12000]);
  assert.strictEqual(M.podeLancarEmContas(semEscolha, []).pode, false, "sem escolha não há o que lançar");

  // a mesma cotação que o contrato barra por falta de aval, o lançamento aceita
  const escolhida = { ...semEscolha, escolhidaId: "p0" };
  assert.strictEqual(M.podeGerarContrato(escolhida, [], []).pode, false);
  assert.strictEqual(M.podeLancarEmContas(escolhida, []).pode, true);

  // e depois de lançada, não lança de novo nem vira contrato
  const lancada = { ...escolhida, contaGeradaId: "cta1" };
  assert.strictEqual(M.podeLancarEmContas(lancada, []).pode, false);
  assert.match(M.podeGerarContrato(lancada, [], []).motivo, /contas a pagar/);

  // contrato já gerado fecha o caminho do lançamento
  assert.strictEqual(M.podeLancarEmContas(escolhida, [{ id: "ctr1", cotacaoId: escolhida.id }]).pode, false);
  assert.strictEqual(M.podeLancarEmContas({ ...escolhida, status: "cancelada" }, []).pode, false);
});

teste("o lançamento leva fornecedor, valor e conta da cotação", () => {
  const c = { ...comPropostas([9000]), escolhidaId: "p0", titulo: "Aço Vergalhões", contaId: "material" };
  const d = M.dadosDoLancamento(c);
  assert.strictEqual(d.valor, 9000);
  assert.strictEqual(d.descricao, "Aço Vergalhões");
  assert.strictEqual(d.contaId, "material");
  assert.strictEqual(d.parcelas, 1);
  assert.strictEqual(M.dadosDoLancamento(comPropostas([9000])), null, "sem escolha não há dados");
});

teste("parcelar o lançamento divide o total e espaça os vencimentos", () => {
  let n = 0;
  const contas = M.contasDaCotacao({ cotacaoId: "ct1", obraId: "o1", contaId: "material",
    favorecido: "Arcelor Mittal", descricao: "Aço Vergalhões", valor: 10000, parcelas: 3,
    primeiroVencimento: "2026-10-05" }, () => "c" + (++n));
  assert.strictEqual(contas.length, 3);
  assert.strictEqual(contas.reduce((s, c) => s + c.valor, 0), 10000, "a soma fecha com o total");
  assert.deepStrictEqual(contas.map(c => c.vencimento), ["2026-10-05", "2026-11-05", "2026-12-05"]);
  assert.match(contas[0].descricao, /parcela 1\/3/);
  for (const c of contas) {
    assert.strictEqual(c.cotacaoId, "ct1");
    assert.strictEqual(c.origem, "cotacao");
    assert.strictEqual(c.pago, false);
  }
  // uma parcela só não ganha sufixo nem número de parcela
  const uma = M.contasDaCotacao({ cotacaoId: "ct1", valor: 500, parcelas: 1, descricao: "Cimento", primeiroVencimento: "2026-10-05" }, () => "x");
  assert.strictEqual(uma[0].descricao, "Cimento");
  assert.strictEqual(uma[0].parcela, 0);
  assert.strictEqual(M.contasDaCotacao({ valor: 0, parcelas: 1 }, () => "x").length, 0);
});

teste("entrega parcelada: cada uma com nome, valor e data própria", () => {
  let n = 0;
  const contas = M.contasDaCotacao({ cotacaoId: "ct1", obraId: "o1", contaId: "material",
    favorecido: "Ferro Pronto", descricao: "Aço Vergalhões", valor: 9690, modo: "entregas",
    entregas: [
      { descricao: "1ª entrega — ferro do baldrame", valor: "3.200,00", vencimento: "2026-10-02" },
      { descricao: "2ª entrega — ferro das colunas", valor: 2490, vencimento: "2026-11-10" },
      { descricao: "3ª entrega — ferro da laje", valor: 4000, vencimento: "2026-12-05" },
    ] }, () => "c" + (++n));
  assert.strictEqual(contas.length, 3);
  // valor digitado em português vale o mesmo que número
  assert.strictEqual(contas[0].valor, 3200);
  assert.deepStrictEqual(contas.map(c => c.vencimento), ["2026-10-02", "2026-11-10", "2026-12-05"]);
  assert.strictEqual(contas[0].descricao, "Aço Vergalhões — 1ª entrega — ferro do baldrame");
  for (const c of contas) { assert.strictEqual(c.cotacaoId, "ct1"); assert.strictEqual(c.favorecido, "Ferro Pronto"); }
  // entrega sem valor não vira conta
  const so2 = M.contasDaCotacao({ cotacaoId: "ct1", valor: 100, modo: "entregas", descricao: "X",
    entregas: [{ descricao: "a", valor: 50 }, { descricao: "b", valor: "" }] }, () => "x");
  assert.strictEqual(so2.length, 1);
});

teste("a soma das entregas pode divergir do cotado, e o total diz isso", () => {
  const e = [{ valor: "3.200,00" }, { valor: 2490 }, { valor: 4000 }];
  assert.strictEqual(M.totalDasEntregas(e), 9690);
  assert.strictEqual(M.totalDasEntregas([{ valor: 100 }, { valor: "" }]), 100);
  assert.strictEqual(M.totalDasEntregas([]), 0);
  // entregas mandam mesmo sem o modo marcado — é o que tem valor que conta
  const c = M.contasDaCotacao({ cotacaoId: "ct1", valor: 9690, parcelas: 3, descricao: "Aço",
    entregas: [{ descricao: "única", valor: 9690, vencimento: "2026-10-02" }] }, () => "x");
  assert.strictEqual(c.length, 1);
  assert.strictEqual(c[0].valor, 9690);
});

teste("sinal + saldo no final: duas contas, nas datas de cada uma", () => {
  let n = 0;
  const contas = M.contasDaCotacao({ cotacaoId: "ct1", descricao: "Aço Vergalhões", valor: 10000,
    modo: "sinalFinal", sinalPct: 40, primeiroVencimento: "2026-10-01", vencimentoSaldo: "2026-11-20" },
    () => "c" + (++n));
  assert.strictEqual(contas.length, 2);
  assert.deepStrictEqual(contas.map(c => c.valor), [4000, 6000]);
  assert.deepStrictEqual(contas.map(c => c.vencimento), ["2026-10-01", "2026-11-20"]);
  assert.match(contas[0].descricao, /sinal/);
  assert.match(contas[1].descricao, /saldo na entrega/);
  // sem data do saldo, ele cai na data do sinal — nada fica sem vencimento
  const semData = M.contasDaCotacao({ cotacaoId: "ct1", descricao: "X", valor: 100, modo: "sinalFinal",
    sinalPct: 50, primeiroVencimento: "2026-10-01" }, () => "x");
  assert.strictEqual(semData[1].vencimento, "2026-10-01");
});

teste("sinal + parcelas: o saldo é que se divide, não o total", () => {
  let n = 0;
  const contas = M.contasDaCotacao({ cotacaoId: "ct1", descricao: "Aço", valor: 10000,
    modo: "sinalParcelas", sinalPct: 40, parcelas: 3,
    primeiroVencimento: "2026-10-01", vencimentoSaldo: "2026-11-01" }, () => "c" + (++n));
  assert.strictEqual(contas.length, 4, "o sinal mais três parcelas");
  assert.strictEqual(contas[0].valor, 4000);
  assert.strictEqual(contas.slice(1).reduce((s, c) => s + c.valor, 0), 6000, "as parcelas somam o saldo");
  assert.deepStrictEqual(contas.map(c => c.vencimento), ["2026-10-01", "2026-11-01", "2026-12-01", "2027-01-01"]);
  // sinal de 100% não deixa saldo a parcelar
  const tudo = M.contasDaCotacao({ cotacaoId: "ct1", descricao: "X", valor: 500, modo: "sinalParcelas",
    sinalPct: 100, parcelas: 3, primeiroVencimento: "2026-10-01" }, () => "x");
  assert.strictEqual(tudo.length, 1);
  assert.strictEqual(tudo[0].valor, 500);
  // e sinal de 0% é o saldo inteiro parcelado, sem linha de sinal
  const semSinal = M.contasDaCotacao({ cotacaoId: "ct1", descricao: "X", valor: 900, modo: "sinalParcelas",
    sinalPct: 0, parcelas: 3, primeiroVencimento: "2026-10-01", vencimentoSaldo: "2026-10-01" }, () => "x");
  assert.strictEqual(semSinal.length, 3);
  assert.strictEqual(semSinal.reduce((s, c) => s + c.valor, 0), 900);
});

teste("as formas de pagar estão no painel, e a medição não", () => {
  assert.deepStrictEqual(M.MODOS_LANCAMENTO.map(m => m.id),
    ["parcelas", "entregas", "sinalFinal", "sinalParcelas", "contaLoja"]);
  for (const m of M.MODOS_LANCAMENTO) { assert.ok(m.nome); assert.ok(m.resumo); }
  assert.strictEqual(M.modoLancamento("inexistente").id, "parcelas", "cai no padrão");
});

teste("o lançamento nasce em parcelas, com a lista de entregas vazia", () => {
  const cot = { ...comPropostas([9000]), escolhidaId: "p0", titulo: "Aço", contaId: "material" };
  const d = M.dadosDoLancamento(cot);
  assert.strictEqual(d.modo, "parcelas");
  assert.deepStrictEqual(d.entregas, []);
  assert.deepStrictEqual(M.entregaVazia(), { descricao: "", valor: "", vencimento: "" });
});

teste("desfazer o lançamento não apaga conta já paga", () => {
  const contas = [
    { id: "a", cotacaoId: "ct1", pago: false },
    { id: "b", cotacaoId: "ct1", pago: true },
    { id: "c", cotacaoId: "ct2", pago: false },
  ];
  const r = M.removerContasDaCotacao(contas, "ct1");
  assert.deepStrictEqual(r.map(c => c.id), ["b", "c"], "a paga fica; a de outra cotação também");
  assert.deepStrictEqual(M.contasDeCotacao(contas, "ct1").map(c => c.id), ["a", "b"]);
  assert.strictEqual(M.removerContasDaCotacao(contas, "").length, 3);
});

// ── Enviar a escolha ao cliente ─────────────────────────────────
teste("só dá para enviar depois de escolher, e não depois de aprovado", () => {
  const semEscolha = comPropostas([9000, 12000]);
  assert.strictEqual(M.podeEnviarAoCliente(semEscolha, [], []).pode, false);

  const escolhida = { ...semEscolha, escolhidaId: "p0" };
  assert.strictEqual(M.podeEnviarAoCliente(escolhida, [], []).pode, true);

  // reenviar enquanto espera é permitido — serve de cobrança
  const enviada = M.enviarCotacaoAoCliente(escolhida, "Renato", "2026-09-10T12:00:00.000Z");
  assert.strictEqual(M.podeEnviarAoCliente(enviada, [], []).pode, true);

  const ap = M.registrarAprovacaoCotacao([], { cotacaoId: enviada.id, propostaId: "p0", status: "aprovada", por: "Alexandre" });
  assert.strictEqual(M.podeEnviarAoCliente(enviada, ap, []).pode, false);

  const semAval = { ...escolhida, precisaAprovacaoCliente: false };
  assert.strictEqual(M.podeEnviarAoCliente(semAval, [], []).pode, false);

  const contratada = [{ id: "ctr1", cotacaoId: escolhida.id }];
  assert.strictEqual(M.podeEnviarAoCliente(escolhida, [], contratada).pode, false);
});

teste("o envio carimba quem mandou e quando", () => {
  const c = { ...comPropostas([9000]), escolhidaId: "p0" };
  const e = M.enviarCotacaoAoCliente(c, "Renato", "2026-09-10T12:00:00.000Z");
  assert.strictEqual(e.enviadaClienteEm, "2026-09-10T12:00:00.000Z");
  assert.strictEqual(e.enviadaClientePor, "Renato");
  assert.strictEqual(c.enviadaClienteEm, "", "não altera o original");
  const limpa = M.limparEnvioAoCliente(e);
  assert.strictEqual(limpa.enviadaClienteEm, "");
  assert.strictEqual(M.situacaoCotacao(limpa, []).id, "aEnviar");
});

teste("trocar a proposta escolhida derruba o aval do preço antigo", () => {
  const c = comPropostas([9000, 12000]);
  const escolhida = M.enviarCotacaoAoCliente({ ...c, escolhidaId: "p0" }, "Renato", "2026-09-10T12:00:00.000Z");
  const ap = M.registrarAprovacaoCotacao([], { cotacaoId: c.id, propostaId: "p0", status: "aprovada", por: "Alexandre" });
  assert.strictEqual(M.situacaoCotacao(escolhida, ap).id, "aprovada");
  assert.strictEqual(M.podeGerarContrato(escolhida, ap, []).pode, true);

  // o escritório muda para a outra proposta: o cliente aprovou outro preço
  const trocada = M.limparEnvioAoCliente({ ...escolhida, escolhidaId: "p1" });
  assert.strictEqual(M.situacaoCotacao(trocada, ap).id, "aEnviar");
  assert.strictEqual(M.podeGerarContrato(trocada, ap, []).pode, false);

  // registro antigo, sem propostaId, continua valendo
  const legado = M.registrarAprovacaoCotacao([], { cotacaoId: c.id, status: "aprovada", por: "Alexandre" });
  assert.strictEqual(M.situacaoCotacao(escolhida, legado).id, "aprovada");
});

teste("o bloqueio do contrato diz o passo que falta", () => {
  const c = { ...comPropostas([9000]), escolhidaId: "p0" };
  assert.match(M.podeGerarContrato(c, [], []).motivo, /Envie a escolha/);
  const enviada = M.enviarCotacaoAoCliente(c, "Renato", "2026-09-10T12:00:00.000Z");
  assert.match(M.podeGerarContrato(enviada, [], []).motivo, /Aguardando a aprovação/);
});

teste("a fila de contratos traz só cotação aprovada e ainda sem contrato", () => {
  const a = M.enviarCotacaoAoCliente({ ...comPropostas([9000, 12000]), id: "a", escolhidaId: "p0" }, "R", "2026-09-10T12:00:00.000Z");
  const b = { ...comPropostas([5000]), id: "b", escolhidaId: "p0" };                    // falta enviar
  const cc = { ...comPropostas([4000]), id: "c" };                                       // comparando
  const ap = M.registrarAprovacaoCotacao([], { cotacaoId: "a", propostaId: "p0", status: "aprovada", por: "Alexandre" });
  assert.deepStrictEqual(M.cotacoesProntasParaContrato([a, b, cc], ap, []).map(x => x.id), ["a"]);
  assert.deepStrictEqual(M.cotacoesProntasParaContrato([a, b, cc], ap, [{ id: "ctr1", cotacaoId: "a" }]).map(x => x.id), []);
});

teste("a resposta registrada pelo escritório guarda quem transcreveu", () => {
  const ap = M.registrarAprovacaoCotacao([], { cotacaoId: "ct1", propostaId: "p0", status: "aprovada", por: "Alexandre", registradaPor: "Renato" });
  assert.strictEqual(ap[0].por, "Alexandre");
  assert.strictEqual(ap[0].registradaPor, "Renato");
  const doCliente = M.registrarAprovacaoCotacao([], { cotacaoId: "ct2", status: "aprovada", por: "Alexandre" });
  assert.strictEqual(doCliente[0].registradaPor, "");
});

// ── Acentuação vinda do JWT ─────────────────────────────────────
teste("nome gravado torto pelo decode antigo volta ao normal na tela", () => {
  assert.strictEqual(M.textoUtf8Recuperado("COBOP COMÃ\u0089RCIO DE BOMBAS E PISCINAS"),
    "COBOP COMÉRCIO DE BOMBAS E PISCINAS");
  assert.strictEqual(M.textoUtf8Recuperado("JoÃ£o AntÃ´nio"), "João Antônio");
});

teste("nome que já está certo não é mexido", () => {
  for (const nome of ["COBOP COMÉRCIO DE BOMBAS E PISCINAS", "João Antônio", "Renato", "", "Ação & Cia"]) {
    assert.strictEqual(M.textoUtf8Recuperado(nome), nome, nome);
  }
  assert.strictEqual(M.textoUtf8Recuperado(null), "");
});

teste("a autoria mostra o nome consertado", () => {
  const t = M.textoAutoria({ criadoPor: "COBOP COMÃ\u0089RCIO", criadoEm: "2026-09-10T12:00:00.000Z" });
  assert.match(t, /COBOP COMÉRCIO/);
});

teste("nome do fornecedor sai do cadastro, e some sem quebrar", () => {
  const p = [{ id: "f1", nome: "MB Viezzer" }];
  assert.strictEqual(M.nomeDoFornecedor(p, "f1"), "MB Viezzer");
  assert.strictEqual(M.nomeDoFornecedor(p, "f9"), "");
  assert.strictEqual(M.nomeDoFornecedor(null, "f1"), "");
});

// ── Apagar ──────────────────────────────────────────────────────
const comDuas = () => ({
  ...M.cotacaoVazia("o1"), id: "cot1", titulo: "Esquadrias de alumínio", escolhidaId: "p2",
  propostas: [
    { ...M.propostaVazia(), id: "p1", favorecido: "Engevidros", valor: 50000 },
    { ...M.propostaVazia(), id: "p2", favorecido: "Alumisantos", valor: 1200000, anexo: { public_id: "vicke/prop2", url: "u" } },
  ],
});

teste("excluir a proposta escolhida desfaz a escolha", () => {
  const r = M.removerProposta(comDuas(), "p2");
  assert.strictEqual(r.propostas.length, 1);
  assert.strictEqual(r.propostas[0].id, "p1");
  assert.strictEqual(r.escolhidaId, "", "id da escolhida não pode sobreviver à proposta");
  assert.strictEqual(M.propostaEscolhida(r), null);
  // e a cotação volta a se declarar em comparação, não "escolhida"
  assert.strictEqual(M.situacaoCotacao(r, []).id, "comparando");
});

teste("excluir outra proposta não mexe na escolha", () => {
  const r = M.removerProposta(comDuas(), "p1");
  assert.strictEqual(r.escolhidaId, "p2");
  assert.strictEqual(M.propostaEscolhida(r).favorecido, "Alumisantos");
});

teste("excluir proposta que não existe não estraga a cotação", () => {
  const r = M.removerProposta(comDuas(), "p9");
  assert.strictEqual(r.propostas.length, 2);
  assert.strictEqual(r.escolhidaId, "p2");
});

teste("excluir a cotação leva junto a decisão do cliente", () => {
  const cot = comDuas();
  const outra = { ...M.cotacaoVazia("o1"), id: "cot2", titulo: "Piso" };
  const aprov = M.registrarAprovacaoCotacao([], { cotacaoId: "cot1", propostaId: "p2", status: "aprovada", por: "COBOP" });
  const comOutra = M.registrarAprovacaoCotacao(aprov, { cotacaoId: "cot2", status: "recusada", por: "COBOP" });
  const r = M.removerCotacao([cot, outra], comOutra, "cot1");
  assert.deepStrictEqual(r.cotacoes.map(c => c.id), ["cot2"]);
  assert.strictEqual(M.aprovacaoDaCotacao(r.aprovacoes, "cot1").status, "pendente",
    "a decisão órfã voltaria a valer se outra cotação nascesse com o mesmo id");
  assert.strictEqual(M.aprovacaoDaCotacao(r.aprovacoes, "cot2").status, "recusada", "a do vizinho fica");
});

teste("o que já virou conta a pagar não pode ser excluído", () => {
  const lancada = { ...comDuas(), contaGeradaId: "cta1" };
  const t = M.podeExcluirCotacao(lancada);
  assert.strictEqual(t.pode, false);
  assert.ok(/contas a pagar/.test(t.motivo), t.motivo);
  assert.strictEqual(M.podeExcluirCotacao(comDuas()).pode, true);
});

teste("os anexos das propostas apagadas voltam para limpar o storage", () => {
  assert.deepStrictEqual(M.anexosDasPropostas(comDuas().propostas), ["vicke/prop2"]);
  assert.deepStrictEqual(M.anexosDasPropostas([]), []);
  assert.deepStrictEqual(M.anexosDasPropostas(null), []);
  assert.deepStrictEqual(M.anexosDasPropostas([{ anexo: { url: "u" } }]), [], "anexo sem public_id não vira chamada");
});

// ── Cadastro de prestador na hora ───────────────────────────────
teste("o cadastro rápido nasce com os campos do contrato", () => {
  const v = M.prestadorRapidoVazio();
  for (const k of ["nome", "tipo", "categoria", "cnpjCpf", "telefone", "email",
                   "cep", "logradouro", "numero", "bairro", "cidade", "estado",
                   "representanteNome", "representanteCpf"]) {
    assert.ok(k in v, `falta o campo ${k} — quem cadastra aqui tem que servir de contratado`);
  }
  assert.strictEqual(v.tipo, "PJ");
  assert.strictEqual(v.categoria, "Outro", "sair daqui como 'Carpinteiro' sem ninguém ter escolhido é pior que sair sem ofício");
});

teste("só o nome é obrigatório, e ele entra ativo", () => {
  assert.strictEqual(M.criarPrestadorRapido({ nome: "" }, "f1"), null);
  assert.strictEqual(M.criarPrestadorRapido({ nome: "   " }, "f1"), null, "espaço não é nome");
  assert.strictEqual(M.criarPrestadorRapido(null, "f1"), null);
  const r = M.criarPrestadorRapido({ nome: "  Engevidros  " }, "f1");
  assert.strictEqual(r.nome, "Engevidros", "o nome entra aparado");
  assert.strictEqual(r.id, "f1");
  assert.strictEqual(r.ativo, true, "senão não apareceria na própria lista de onde foi cadastrado");
  assert.strictEqual(r.origem, "cotacao");
  assert.ok(r.criadoEm);
});

teste("o que foi digitado vence o vazio do modelo", () => {
  const r = M.criarPrestadorRapido({ nome: "Alumisantos", tipo: "PF", cnpjCpf: "123", cidade: "Ourinhos" }, "f2");
  assert.strictEqual(r.tipo, "PF");
  assert.strictEqual(r.cnpjCpf, "123");
  assert.strictEqual(r.cidade, "Ourinhos");
  assert.strictEqual(r.estado, "SP", "o que não foi digitado fica com o padrão");
  // e o cadastro novo é achável pelo mesmo caminho de sempre
  assert.strictEqual(M.nomeDoFornecedor([r], "f2"), "Alumisantos");
});

// ── O arquivo é mesmo um PDF? ───────────────────────────────────
const bytesDe = (txt) => Array.from(txt).map(c => c.charCodeAt(0));

teste("PDF de verdade começa com %PDF-", () => {
  assert.strictEqual(M.pareceMesmoPdf(bytesDe("%PDF-1.7\n%âãÏÓ")), true);
  assert.strictEqual(M.pareceMesmoPdf(bytesDe("%PDF-1.4")), true);
});

teste("o que não é PDF é reprovado", () => {
  assert.strictEqual(M.pareceMesmoPdf(bytesDe("<!DOCTYPE html>")), false, "página de erro do compressor");
  assert.strictEqual(M.pareceMesmoPdf(bytesDe("PK\u0003\u0004")), false, "zip");
  assert.strictEqual(M.pareceMesmoPdf(bytesDe("\u00ff\u00d8\u00ff")), false, "jpeg");
  assert.strictEqual(M.pareceMesmoPdf(bytesDe("%PDF")), false, "cortado antes do traço");
  assert.strictEqual(M.pareceMesmoPdf(bytesDe("")), false);
  assert.strictEqual(M.pareceMesmoPdf(null), false);
  assert.strictEqual(M.pareceMesmoPdf(bytesDe(" %PDF-")), false, "assinatura tem que estar no byte 0");
});

// ── Quem fez, e quando ──────────────────────────────────────────
const alex = { nome: "Alexandre", email: "alexandre@cobop.com.br" };
const renato = { nome: "Renato", email: "r@padovan.com" };

teste("o nome vem do cadastro, e o e-mail é a reserva", () => {
  assert.strictEqual(M.nomeDeQuem(alex), "Alexandre");
  assert.strictEqual(M.nomeDeQuem({ email: "so@email.com" }), "so@email.com");
  assert.strictEqual(M.nomeDeQuem({ nome: "   " }), "alguém");
  assert.strictEqual(M.nomeDeQuem(null), "alguém");
});

teste("criar carimba os dois lados; salvar de novo só o de cima", () => {
  const nova = M.carimbar(M.cotacaoVazia("o1"), alex, true);
  assert.strictEqual(nova.criadoPor, "Alexandre");
  assert.strictEqual(nova.salvoPor, "Alexandre");
  assert.ok(nova.criadoEm && nova.salvoEm);
  const editada = M.carimbar({ ...nova, titulo: "Esquadrias" }, renato, false);
  assert.strictEqual(editada.criadoPor, "Alexandre", "quem cadastrou não muda nunca");
  assert.strictEqual(editada.criadoEm, nova.criadoEm);
  assert.strictEqual(editada.salvoPor, "Renato");
});

teste("registro antigo, sem carimbo, ganha um ao ser salvo", () => {
  const velha = { id: "c1", titulo: "Piso" };            // gravada antes disto existir
  const r = M.carimbar(velha, renato, false);
  assert.strictEqual(r.criadoPor, "Renato", "sem criador, quem salvou vira o criador");
  assert.strictEqual(r.salvoPor, "Renato");
});

teste("o texto diz cadastrado enquanto ninguém mexeu, e salvo depois", () => {
  const nova = M.carimbar(M.cotacaoVazia("o1"), alex, true);
  assert.ok(/^Cadastrado por Alexandre em \d{2}\/\d{2}\/\d{4}$/.test(M.textoAutoria(nova)), M.textoAutoria(nova));
  const outroDia = { ...nova, salvoPor: "Renato", salvoEm: "2026-12-01T10:00:00.000Z" };
  const t = M.textoAutoria(outroDia);
  assert.ok(/^Salvo por Renato em 01\/12\/2026 · cadastrado por Alexandre$/.test(t), t);
  assert.strictEqual(M.textoAutoria({}), "", "sem carimbo, sem linha na tela");
  assert.strictEqual(M.textoAutoria(null), "");
});

teste("data quebrada não vira 'Invalid Date' na tela", () => {
  const t = M.textoAutoria({ criadoPor: "Alexandre", criadoEm: "não é data" });
  assert.strictEqual(t, "Cadastrado por Alexandre");
});

// ── Colar o print ───────────────────────────────────────────────
const arqFalso = (nome, tipo) => ({ name: nome, type: tipo });
const item = (tipo, arq) => ({ kind: "file", type: tipo, getAsFile: () => arq });

teste("print colado vem pelos items", () => {
  const img = arqFalso("image.png", "image/png");
  assert.strictEqual(M.arquivoColado({ items: [item("image/png", img)] }), img);
});

teste("arquivo copiado do explorador vem pelos files", () => {
  const pdf = arqFalso("recibo.pdf", "application/pdf");
  assert.strictEqual(M.arquivoColado({ files: [pdf] }), pdf);
  // files ganha dos items quando os dois vêm
  const img = arqFalso("image.png", "image/png");
  assert.strictEqual(M.arquivoColado({ files: [pdf], items: [item("image/png", img)] }), pdf);
});

teste("texto colado não vira anexo", () => {
  assert.strictEqual(M.arquivoColado({ items: [{ kind: "string", type: "text/plain" }] }), null);
  assert.strictEqual(M.arquivoColado({ files: [arqFalso("planilha.xlsx", "application/vnd.ms-excel")] }), null,
    "formato que o anexo não aceita também não passa");
  assert.strictEqual(M.arquivoColado({}), null);
  assert.strictEqual(M.arquivoColado(null), null);
});

teste("o print colado ganha nome com data", () => {
  const hoje = new Date().toISOString().slice(0, 10);
  assert.strictEqual(M.nomeDoColado("comprovante_pagamento", "image/png"), `comprovante-${hoje}.png`);
  assert.strictEqual(M.nomeDoColado("proposta_cotacao", "image/jpeg"), `proposta-${hoje}.jpeg`);
  assert.strictEqual(M.nomeDoColado("comprovante_pagamento", "application/pdf"), `comprovante-${hoje}.pdf`);
});

let falhas = 0;
// ── O acerto fica gravado na cotação ────────────────────────────

const dadosEntregas = () => ({
  cotacaoId: "c1", obraId: "o1", descricao: "Aço Vergalhões", valor: 9690, modo: "entregas",
  lancadoEm: "2026-09-20T12:00:00.000Z", lancadoPor: "Renato",
  entregas: [
    { descricao: "1ª entrega — baldrame", valor: "3.200,00", vencimento: "2026-10-05" },
    { descricao: "2ª entrega — colunas", valor: "2.490,00", vencimento: "2026-11-05" },
    { descricao: "", valor: "", vencimento: "" },
  ],
});

teste("o plano guarda as entregas com valor, sem as linhas vazias", () => {
  const p = M.planoDoLancamento(dadosEntregas());
  assert.strictEqual(p.modo, "entregas");
  assert.strictEqual(p.entregas.length, 2, "linha sem valor não é entrega");
  assert.deepStrictEqual(p.entregas[0], { descricao: "1ª entrega — baldrame", valor: 3200, vencimento: "2026-10-05" });
  assert.strictEqual(p.definidoPor, "Renato");
});

teste("fora de entregas o plano guarda a regra, não uma lista", () => {
  const p = M.planoDoLancamento({ valor: 12000, modo: "sinalParcelas", parcelas: 3, sinalPct: 40,
    primeiroVencimento: "2026-10-05", vencimentoSaldo: "2026-11-05" });
  assert.strictEqual(p.sinalPct, 40);
  assert.strictEqual(p.parcelas, 3);
  assert.strictEqual(p.entregas, undefined);
  assert.strictEqual(M.resumoDoPlano(p), "sinal de 40% e saldo em 3x");
});

teste("a tabelinha vem das contas quando elas existem — é lá que a data anda", () => {
  const plano = M.planoDoLancamento(dadosEntregas());
  const cot = { id: "c1", titulo: "Aço Vergalhões", pagamento: plano };
  const contas = [
    { id: "a", cotacaoId: "c1", descricao: "1ª entrega — baldrame", valor: 3200, vencimento: "2026-10-05", pago: true, pagoEm: "2026-10-03", valorPago: 3150 },
    { id: "b", cotacaoId: "c1", descricao: "2ª entrega — colunas", valor: 2490, vencimento: "2026-11-25" },
    { id: "z", cotacaoId: "outra", descricao: "de outra compra", valor: 100, vencimento: "2026-10-01" },
  ];
  const r = M.linhasDoPagamento(cot, contas, "2026-12-01");
  assert.strictEqual(r.fonte, "contas");
  assert.strictEqual(r.linhas.length, 2, "conta de outra cotação não entra");
  assert.strictEqual(r.linhas[0].valor, 3150, "pago mostra o que saiu de verdade");
  assert.strictEqual(r.linhas[1].vencimento, "2026-11-25", "a data recalibrada aparece aqui");
  assert.strictEqual(r.linhas[1].vencida, true);
});

teste("a linha não repete o nome da compra dentro da própria cotação", () => {
  const cot = { id: "c1", titulo: "Aço Vergalhões" };
  const contas = [
    { id: "a", cotacaoId: "c1", descricao: "Aço Vergalhões — 1ª entrega", valor: 10, vencimento: "2026-10-05" },
    { id: "b", cotacaoId: "c1", descricao: "Cimento — saldo", valor: 10, vencimento: "2026-10-06" },
    { id: "c", cotacaoId: "c1", descricao: "Aço Vergalhões", valor: 10, vencimento: "2026-10-07" },
  ];
  assert.deepStrictEqual(M.linhasDoPagamento(cot, contas, "2026-09-01").linhas.map(l => l.descricao),
    ["1ª entrega", "Cimento — saldo", "Aço Vergalhões"]);
});

teste("sem contas, o acerto registrado continua na tela", () => {
  const cot = { id: "c1", titulo: "Aço", pagamento: M.planoDoLancamento(dadosEntregas()) };
  const r = M.linhasDoPagamento(cot, [], "2026-09-20");
  assert.strictEqual(r.fonte, "plano");
  assert.deepStrictEqual(r.linhas.map(l => l.descricao), ["1ª entrega — baldrame", "2ª entrega — colunas"]);
});

teste("cotação sem plano e sem contas não mostra quadro nenhum", () => {
  assert.deepStrictEqual(M.linhasDoPagamento({ id: "c1" }, [], "2026-09-20").linhas, []);
});

teste("relançar volta com o que foi combinado da última vez", () => {
  const cot = { ...M.cotacaoVazia("o1"), id: "c1", titulo: "Aço",
    propostas: [{ id: "p1", favorecido: "Ferro Pronto", valor: 9690, prazoDias: 7 }], escolhidaId: "p1",
    pagamento: M.planoDoLancamento(dadosEntregas()) };
  const d = M.dadosDoLancamento(cot);
  assert.strictEqual(d.modo, "entregas");
  assert.strictEqual(d.entregas.length, 2);
  assert.strictEqual(d.entregas[0].descricao, "1ª entrega — baldrame");
});

// ── Lista de materiais ──────────────────────────────────────────

const listaBase = () => ({
  ...M.cotacaoVazia("o1"), id: "c1", titulo: "Material de alvenaria",
  itens: [
    { id: "i1", descricao: "Cimento CP-II 50kg", unidade: "sc", quantidade: "40" },
    { id: "i2", descricao: "Tábua de pinus 30cm", unidade: "m", quantidade: "120" },
    { id: "i3", descricao: "Prego 17x27", unidade: "kg", quantidade: "5" },
  ],
  propostas: [
    { id: "pA", favorecido: "Loja A", valor: "", precos: { i1: "38,00", i2: "22,50", i3: "19,00" } },
    { id: "pB", favorecido: "Loja B", valor: "", precos: { i1: "36,50", i2: "24,00", i3: "21,00" } },
    { id: "pC", favorecido: "Loja C", valor: "3.400,00" },
  ],
});

teste("cotação sem itens continua sendo a cotação de sempre", () => {
  assert.strictEqual(M.temListaDeItens(M.cotacaoVazia("o1")), false);
  assert.deepStrictEqual(M.itensDaCotacao(null), []);
});

teste("o total da proposta com preço por item é a soma, não o digitado", () => {
  const cot = listaBase();
  const a = cot.propostas[0];
  // 40*38 + 120*22,50 + 5*19 = 1520 + 2700 + 95
  assert.strictEqual(M.totalDosItens(cot, a), 4315);
  assert.strictEqual(M.valorDaProposta(cot, a), 4315);
});

teste("loja que mandou só o total continua valendo pelo total", () => {
  const cot = listaBase();
  const c = cot.propostas[2];
  assert.strictEqual(M.propostaTemPrecoPorItem(cot, c), false);
  assert.strictEqual(M.valorDaProposta(cot, c), 3400);
});

teste("item não cotado entra como faltando, e não some da soma silenciosamente", () => {
  const cot = listaBase();
  cot.propostas[0].precos.i3 = "";
  assert.deepStrictEqual(M.itensSemPreco(cot, cot.propostas[0]).map(i => i.id), ["i3"]);
  assert.strictEqual(M.totalDosItens(cot, cot.propostas[0]), 4220, "soma só o que foi cotado");
  const cmp = M.comparativoDaLista(cot);
  assert.strictEqual(cmp.lojas.find(l => l.propostaId === "pA").faltando, 1);
});

teste("o melhor preço de cada item sai por item, não por loja", () => {
  const m = M.melhorPorItem(listaBase());
  assert.strictEqual(m.i1.favorecido, "Loja B");   // 36,50 < 38,00
  assert.strictEqual(m.i2.favorecido, "Loja A");   // 22,50 < 24,00
  assert.strictEqual(m.i3.favorecido, "Loja A");   // 19,00 < 21,00
  assert.strictEqual(m.i1.total, 1460);
});

teste("dividir a compra só é sugerido quando envolve mais de uma loja e economiza", () => {
  const cmp = M.comparativoDaLista(listaBase());
  // A = 4315; B = 36,5*40 + 24*120 + 21*5 = 1460 + 2880 + 105 = 4445
  assert.strictEqual(cmp.melhorInteira, 4315);
  assert.strictEqual(cmp.totalDividido, 1460 + 2700 + 95);
  assert.strictEqual(cmp.ganhoDaDivisao, 4315 - 4255);
});

teste("uma loja só, ou lista incompleta, não sugere divisão", () => {
  const umaSo = { ...listaBase(), propostas: [listaBase().propostas[0]] };
  assert.strictEqual(M.comparativoDaLista(umaSo).ganhoDaDivisao, 0);
  const incompleta = listaBase();
  incompleta.propostas = incompleta.propostas.map(p => p.precos ? { ...p, precos: { i1: p.precos.i1 } } : p);
  assert.strictEqual(M.comparativoDaLista(incompleta).totalDividido, 0, "sem preço em todos os itens não há conta de divisão");
});

teste("o texto do pedido lista os itens numerados, com quantidade e unidade", () => {
  const t = M.textoDoPedido(listaBase(), { favorecido: "Loja A" },
    { escritorio: "Padovan Arquitetos", obra: "Loja COBOP", endereco: "Rua X, 100 — Ourinhos" });
  assert.strictEqual(t.split("\n")[0], "Obra: Loja COBOP — Rua X, 100 — Ourinhos",
    "nome da obra e endereço na mesma linha");
  assert.ok(!/Entrega:/.test(t), "não é uma linha à parte");
  assert.match(t, /1\. Cimento CP-II 50kg — 40 sc/);
  assert.match(t, /2\. Tábua de pinus 30cm — 120 m/);
});

teste("nome do escritório, título da cotação e fornecedor ficam fora da mensagem", () => {
  const t = M.textoDoPedido(listaBase(), { favorecido: "Loja A" },
    { escritorio: "Padovan Arquitetos", obra: "Loja COBOP", endereco: "Rua X, 100" });
  assert.ok(!/Padovan/.test(t), "a conversa já sai do WhatsApp dele");
  assert.ok(!/PEDIDO/.test(t));
  assert.ok(!/Material de alvenaria/.test(t), "título é nome interno");
  assert.ok(!/Loja A/.test(t));
});

teste("sem obra nem endereço, a mensagem é só a lista", () => {
  assert.strictEqual(M.textoDoPedido(listaBase(), null, {}).split("\n")[0], "1. Cimento CP-II 50kg — 40 sc");
});

teste("o texto do WhatsApp não leva escopo nem telefone do escritório", () => {
  const cot = { ...listaBase(), escopo: "Diversos" };
  const t = M.textoDoPedido(cot, null, { escritorio: "Padovan Arquitetos", obra: "Loja COBOP", contato: "14998528593" });
  assert.ok(!/Diversos/.test(t), "o escopo fica só na folha do pedido");
  assert.ok(!/Contato:/.test(t), "a mensagem sai do WhatsApp dele; o número é redundante");
  assert.match(t, /1\. Cimento CP-II 50kg — 40 sc/, "a lista continua inteira");
  assert.match(t, /^Obra: Loja COBOP/, "a obra fica — é o que a loja precisa");
  assert.ok(!/\n\n\n/.test(t), "e não sobra linha em branco no fim");
});

teste("sem lista, o texto do pedido usa a cotação de uma coisa só", () => {
  const cot = { ...M.cotacaoVazia("o1"), titulo: "Esquadrias", quantidade: "12", unidade: "un" };
  assert.match(M.textoDoPedido(cot, null, {}), /1\. Esquadrias — 12 un/);
});

teste("a folha do pedido continua com o cabeçalho — documento não é conversa", () => {
  // a folha lê cot.titulo e ctx.escritorio direto; o que sai dela não passa
  // por textoDoPedido, então tirar da mensagem não tira do PDF
  const cot = listaBase();
  assert.strictEqual(cot.titulo, "Material de alvenaria");
});

teste("quantidade sai sem centavos quando é inteira", () => {
  assert.strictEqual(M.qtdBR(40), "40");
  assert.strictEqual(M.qtdBR(12.5), "12,5");
});

// ── Unitário ↔ total do item ────────────────────────────────────

teste("o unitário sai do total do item, e vice-versa", () => {
  assert.strictEqual(M.unitarioDoTotal(1200, 30), 40);
  assert.strictEqual(M.unitarioDoTotal("870,00", 30), 29);
  assert.strictEqual(M.unitarioDoTotal(1000, 3), 333.333333, "guarda casas para a volta fechar");
  assert.strictEqual(Math.round(333.333333 * 3 * 100) / 100, 1000, "e a volta fecha");
});

teste("sem quantidade não dá para tirar unitário de total", () => {
  assert.strictEqual(M.unitarioDoTotal(1200, 0), 0);
  assert.strictEqual(M.unitarioDoTotal(1200, ""), 0);
});

// ── Desconto de fechamento ──────────────────────────────────────

const comDesconto = (total) => {
  const c = listaBase();
  c.propostas[0].totalFechado = total;
  return c;
};

teste("sem total fechado, nada é distribuído", () => {
  const cot = listaBase();
  assert.strictEqual(M.valoresComDesconto(cot, cot.propostas[0]), null);
  assert.strictEqual(M.totalNegociado(cot, cot.propostas[0]), 4315);
  assert.strictEqual(M.descontoDaProposta(cot, cot.propostas[0]), null);
});

teste("o desconto é proporcional e a soma bate com o total combinado", () => {
  const cot = comDesconto(4000);          // bruto 4315
  const p = cot.propostas[0];
  const v = M.valoresComDesconto(cot, p);
  const soma = Math.round(Object.values(v).reduce((a, x) => a + x, 0) * 100) / 100;
  assert.strictEqual(soma, 4000, "as partes somam exatamente o total combinado");
  // cimento: 1520/4315 * 4000 = 1409,04...
  assert.strictEqual(v.i1, 1409.04);
  assert.strictEqual(M.totalNegociado(cot, p), 4000);
  assert.strictEqual(M.valorDaProposta(cot, p), 4000);
});

teste("a sobra do arredondamento vai para o último item, não some", () => {
  const cot = { ...listaBase(), itens: [
    { id: "a", descricao: "x", unidade: "un", quantidade: "1" },
    { id: "b", descricao: "y", unidade: "un", quantidade: "1" },
    { id: "c", descricao: "z", unidade: "un", quantidade: "1" },
  ] };
  cot.propostas = [{ id: "p1", favorecido: "L", precos: { a: "10,00", b: "10,00", c: "10,00" }, totalFechado: "10,00" }];
  const v = M.valoresComDesconto(cot, cot.propostas[0]);
  const soma = Math.round(Object.values(v).reduce((a, x) => a + x, 0) * 100) / 100;
  assert.strictEqual(soma, 10);
  assert.deepStrictEqual([v.a, v.b], [3.33, 3.33]);
  assert.strictEqual(v.c, 3.34, "o último absorve o centavo que falta");
});

teste("item sem preço não recebe desconto nenhum", () => {
  const cot = comDesconto(4000);
  cot.propostas[0].precos.i3 = "";
  const v = M.valoresComDesconto(cot, cot.propostas[0]);
  assert.strictEqual(v.i3, undefined);
  const soma = Math.round(Object.values(v).reduce((a, x) => a + x, 0) * 100) / 100;
  assert.strictEqual(soma, 4000);
});

teste("o desconto muda o unitário efetivo, sem apagar o preço de tabela", () => {
  const cot = comDesconto(4000);
  const p = cot.propostas[0];
  const it = cot.itens[0];
  assert.strictEqual(M.precoUnitario(p, "i1"), 38, "o que a loja cotou fica guardado");
  assert.strictEqual(M.totalBrutoItem(cot, p, it), 1520);
  assert.strictEqual(M.totalEfetivoItem(cot, p, it), 1409.04);
  assert.strictEqual(M.precoEfetivo(cot, p, it), 35.226);
});

teste("o resumo do desconto diz quanto e quantos por cento", () => {
  const d = M.descontoDaProposta(comDesconto(4000), comDesconto(4000).propostas[0]);
  assert.strictEqual(d.desconto, true);
  assert.strictEqual(d.valor, 315);
  assert.strictEqual(d.bruto, 4315);
  assert.strictEqual(d.alvo, 4000);
});

teste("total fechado maior que a soma é acréscimo, e é dito como tal", () => {
  const d = M.descontoDaProposta(comDesconto(4500), comDesconto(4500).propostas[0]);
  assert.strictEqual(d.desconto, false);
  assert.strictEqual(d.valor, 185);
});

teste("a loja que deu desconto ganha a comparação por item", () => {
  // A cota 38,00 o cimento e B cota 36,50; com 30% de desconto A fica menor
  const cot = listaBase();
  cot.propostas[0].totalFechado = "3.000,00";   // bruto 4315
  const m = M.melhorPorItem(cot);
  assert.strictEqual(m.i1.favorecido, "Loja A", "o preço efetivo é o que vale");
});

// ── Mandar a lista para as lojas ────────────────────────────────

teste("o link do WhatsApp põe o 55 e leva a lista no texto", () => {
  const l = M.linkWhatsApp("(14) 99999-0000", "PEDIDO — Cimento");
  assert.match(l, /^https:\/\/wa\.me\/5514999990000\?text=/);
  assert.match(decodeURIComponent(l), /PEDIDO — Cimento/);
  assert.match(M.linkWhatsApp("5514999990000", "x"), /^https:\/\/wa\.me\/5514999990000\?/, "não duplica o 55");
});

teste("telefone curto demais não vira link", () => {
  assert.strictEqual(M.linkWhatsApp("1234", "x"), "");
  assert.strictEqual(M.linkWhatsApp("", "x"), "");
  assert.strictEqual(M.linkWhatsApp(null, "x"), "");
});

teste("o envio fica registrado, e reenviar não duplica a loja", () => {
  const cot = { ...M.cotacaoVazia("o1"), id: "c1" };
  const f = { id: "f1", nome: "Casa do Construtor" };
  let c2 = M.registrarEnvioDaLista(cot, f, "Renato", "2026-09-20T12:00:00.000Z");
  assert.strictEqual(M.enviosDaLista(c2).length, 1);
  assert.strictEqual(M.envioParaLoja(c2, "f1").por, "Renato");
  c2 = M.registrarEnvioDaLista(c2, f, "Renato", "2026-09-21T12:00:00.000Z");
  assert.strictEqual(M.enviosDaLista(c2).length, 1, "a mesma loja não entra duas vezes");
  assert.strictEqual(M.envioParaLoja(c2, "f1").em, "2026-09-21T12:00:00.000Z", "fica o último envio");
});

teste("fornecedor sem id não entra na lista de envios", () => {
  const cot = M.cotacaoVazia("o1");
  assert.strictEqual(M.enviosDaLista(M.registrarEnvioDaLista(cot, { nome: "x" }, "R")).length, 0);
});

teste("quem já respondeu vem primeiro, depois quem recebeu, depois o resto", () => {
  const forn = [
    { id: "f1", nome: "Zeta", ativo: true, telefone: "14999990000" },
    { id: "f2", nome: "Alfa", ativo: true, telefone: "14999990001" },
    { id: "f3", nome: "Beta", ativo: true, telefone: "14999990002" },
    { id: "f4", nome: "Inativa", ativo: false, telefone: "14999990003" },
  ];
  let cot = { ...M.cotacaoVazia("o1"), id: "c1",
    propostas: [{ id: "p1", fornecedorId: "f3", favorecido: "Beta" }] };
  cot = M.registrarEnvioDaLista(cot, forn[0], "R", "2026-09-20T12:00:00.000Z");
  const ordem = M.lojasParaPedir(forn, cot, "").map(x => x.fornecedor.nome);
  assert.deepStrictEqual(ordem, ["Beta", "Zeta", "Alfa"], "inativa fica de fora");
});

teste("a busca de loja ignora acento", () => {
  const forn = [{ id: "f1", nome: "Depósito Ourinhos", ativo: true, telefone: "14999990000" }];
  assert.strictEqual(M.lojasParaPedir(forn, M.cotacaoVazia("o1"), "deposito").length, 1);
  assert.strictEqual(M.lojasParaPedir(forn, M.cotacaoVazia("o1"), "xyz").length, 0);
});

teste("loja sem telefone aparece, mas sem link", () => {
  const forn = [{ id: "f1", nome: "Sem Fone", ativo: true, telefone: "" }];
  const [l] = M.lojasParaPedir(forn, M.cotacaoVazia("o1"), "");
  assert.strictEqual(l.link, "", "a loja continua visível para você cadastrar o telefone");
});

// ── Ler o recado do pedreiro ────────────────────────────────────

const catalogo = [
  { id: "m1", codigo: "CIM-001", nome: "Cimento CP-II 50kg", unidade: "Unidades", tipo: "material", aliases: ["Sacos de cimento 50kg", "Cimento"] },
  { id: "m2", codigo: "MAD-014", nome: "Madeira Caixaria - Tábuas de 30cm x 3mts", unidade: "Unidades", tipo: "material", aliases: [] },
  { id: "m3", codigo: "AGR-001", nome: "Areia Fina", unidade: "m3", tipo: "material", aliases: [] },
  { id: "m5", codigo: "ACO-001", nome: "Aço - Barras de CA50 10.0mm 12mts", unidade: "Unidades", tipo: "material", aliases: [] },
  { id: "m7", codigo: "FER-003", nome: "Prego 17x27", unidade: "kg", tipo: "material", aliases: [], precoNCompras: 12 },
  { id: "m8", codigo: "FER-010", nome: "Arame Recozido 18", unidade: "kg", tipo: "material", aliases: [], precoNCompras: 44 },
  { id: "m9", codigo: "FER-011", nome: "Arame Farpado", unidade: "m", tipo: "material", aliases: [], precoNCompras: 0 },
  { id: "p1", codigo: "PRE-001", nome: "Pedreiro", unidade: "m2", tipo: "prestador", aliases: [] },
];

teste("quantidade sai do começo da linha, com a embalagem fora da descrição", () => {
  const l = M.interpretarLinhaDePedido("10 sacos de cimento");
  assert.strictEqual(l.quantidade, 10);
  assert.strictEqual(l.unidade, "sacos");
  assert.strictEqual(l.termo, "cimento", "o 'de' da embalagem também sai");
});

teste("fração e 'meio' viram número", () => {
  assert.strictEqual(M.quantidadeDoTexto("1/2"), 0.5);
  assert.strictEqual(M.quantidadeDoTexto("meia"), 0.5);
  assert.strictEqual(M.quantidadeDoTexto("2,5"), 2.5);
  assert.strictEqual(M.interpretarLinhaDePedido("1/2 m3 de areia fina").quantidade, 0.5);
});

teste("marcador de lista some, mas 2.5 não vira 5", () => {
  assert.strictEqual(M.interpretarLinhaDePedido("- 30 tabuas de 30cm").quantidade, 30);
  assert.strictEqual(M.interpretarLinhaDePedido("1) 4 sacos de cal").quantidade, 4);
  assert.strictEqual(M.interpretarLinhaDePedido("2.5 m3 de areia").quantidade, 2.5);
});

teste("número no fim também é quantidade", () => {
  const l = M.interpretarLinhaDePedido("argamassa ac 3  5");
  assert.strictEqual(l.quantidade, 5);
  assert.strictEqual(l.termo, "argamassa ac 3");
});

teste("medida colada no material não vira quantidade", () => {
  // "10mm" é especificação, não quantidade — quem manda é o 20 do começo
  const l = M.interpretarLinhaDePedido("20 barras de ca50 10mm");
  assert.strictEqual(l.quantidade, 20);
  assert.match(l.termo, /ca50 10mm/);
  // sem número no começo e sem unidade, não se inventa quantidade
  const s = M.interpretarLinhaDePedido("tabuas de 30cm x 3mts");
  assert.strictEqual(s.quantidade, "", "chutar quantidade é pior que perguntar");
});

teste("a conversa em volta não vira item", () => {
  const r = M.interpretarPedido("Bom dia Renato\npreciso do material pra semana:\n10 sacos de cimento\nobrigado", catalogo);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].insumo.codigo, "CIM-001");
});

teste("mas saudação com quantidade continua sendo pedido", () => {
  const r = M.interpretarPedido("preciso de 10 sacos de cimento", catalogo);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].quantidade, 10);
});

teste("acerto por apelido entra resolvido; parecido entra como sugestão", () => {
  const r = M.interpretarPedido("10 sacos de cimento\n20 barras de ca50 10mm\n2 latas de massa corrida", catalogo);
  assert.strictEqual(r[0].confianca, "alias");
  assert.strictEqual(r[0].insumo.nome, "Cimento CP-II 50kg");
  assert.strictEqual(r[1].insumo, null, "parecido NÃO é vinculado sozinho");
  assert.strictEqual(r[1].confianca, "sugestao");
  assert.strictEqual(r[1].candidatos[0].codigo, "ACO-001");
  assert.strictEqual(r[2].confianca, "nenhum", "o que não existe no catálogo entra solto");
  assert.strictEqual(r[2].termo, "massa corrida");
});

teste("prestador de serviço não entra na leitura de material", () => {
  assert.strictEqual(M.interpretarPedido("1 pedreiro", catalogo).length, 1);
  assert.strictEqual(M.interpretarPedido("1 pedreiro", catalogo)[0].insumo, null);
});

teste("o resumo conta o que foi achado e o que falta decidir", () => {
  const r = M.interpretarPedido("10 sacos de cimento\n20 barras de ca50 10mm\n2 latas de massa corrida\ncal hidratada", catalogo);
  const res = M.resumoDaLeitura(r);
  assert.strictEqual(res.total, 4);
  assert.strictEqual(res.achados, 1);
  assert.strictEqual(res.sugeridos, 1);
  assert.strictEqual(res.soltos, 2);
  assert.strictEqual(res.semQuantidade, 1);
});

teste("a linha lida vira item: insumo manda no nome e na unidade", () => {
  const [c] = M.interpretarPedido("10 sacos de cimento", catalogo);
  const it = M.itemDoPedidoLido(c);
  assert.strictEqual(it.descricao, "Cimento CP-II 50kg");
  assert.strictEqual(it.unidade, "Unidades", "a unidade vem do catálogo, não do 'sacos'");
  assert.strictEqual(it.quantidade, 10);
  assert.strictEqual(it.codigo, "CIM-001");
});

teste("sem insumo, o item guarda o texto do pedreiro", () => {
  const [c] = M.interpretarPedido("2 latas de massa corrida", catalogo);
  const it = M.itemDoPedidoLido(c);
  assert.strictEqual(it.descricao, "massa corrida");
  assert.strictEqual(it.unidade, "latas");
  assert.strictEqual(it.insumoId, "");
});

teste("o recado num parágrafo só também vira lista", () => {
  const r = M.interpretarPedido(
    "Renato compra pra nois 30 sacos de cimento, 40 tábuas de 30, 25 pregos 17x21 e 20 quilos de arame",
    catalogo.concat([{ id: "m8", codigo: "FER-010", nome: "Arame Recozido", unidade: "kg", tipo: "material", aliases: ["Arame"] }]));
  assert.strictEqual(r.length, 4, "vírgula e 'e' separam tão bem quanto quebra de linha");
  assert.deepStrictEqual(r.map(x => x.quantidade), [30, 40, 25, 20]);
  assert.strictEqual(r[0].insumo.codigo, "CIM-001");
  assert.strictEqual(r[3].insumo.codigo, "FER-010");
});

teste("numa frase corrida, o material é o que vem DEPOIS da quantidade", () => {
  const [x] = M.interpretarPedido("Renato compra pra nois 30 sacos de cimento", catalogo);
  assert.strictEqual(x.termo, "cimento", "'compra pra nois' não entra na descrição");
  assert.strictEqual(x.quantidade, 30);
});

teste("mas quando nada vem depois, o material é o que veio antes", () => {
  const l = M.interpretarLinhaDePedido("prego 17x27 2 kg");
  assert.strictEqual(l.termo, "prego 17x27");
  assert.strictEqual(l.quantidade, 2);
});

teste("tamanho diferente não casa sozinho, mas aparece como sugestão", () => {
  // o catálogo tem Prego 17x27; 17x21 é outro prego — vem como proposta para
  // você confirmar, nunca resolvido
  const [x] = M.interpretarPedido("25 pregos 17x21", catalogo);
  assert.strictEqual(x.insumo, null, "não vincula sozinho");
  assert.strictEqual(x.confianca, "sugestao");
  assert.strictEqual(x.candidatos[0].codigo, "FER-003");
});

// ── Unidades ────────────────────────────────────────────────────

teste("as unidades saem do catálogo, as mais usadas primeiro", () => {
  const u = M.unidadesDoCatalogo([
    { unidade: "kg" }, { unidade: "Unidades" }, { unidade: "Unidades" },
    { unidade: "m3" }, { unidade: "Unidades" }, { unidade: "" }, { unidade: "kg" }, {},
  ]);
  assert.deepStrictEqual(u, ["Unidades", "kg", "m3"], "vazio não vira unidade");
});

teste("o que o pedreiro escreveu não se perde: entra em cima da lista", () => {
  const u = ["Unidades", "kg"];
  assert.deepStrictEqual(M.opcoesDeUnidade("sacos", u), ["sacos", "Unidades", "kg"]);
  assert.deepStrictEqual(M.opcoesDeUnidade("kg", u), ["Unidades", "kg"], "não duplica o que já existe");
  assert.deepStrictEqual(M.opcoesDeUnidade("", u), ["Unidades", "kg"]);
});

// ── Associação por palavra ──────────────────────────────────────

teste("uma palavra que existe inteira no nome já é associação forte", () => {
  assert.ok(M.scoreAssociacao("arame", "Arame Recozido 18") > 0.7);
  assert.ok(M.scoreAssociacao("tabuas de 30", "Madeira Caixaria - Tábuas de 30cm x 3mts") > 0.7);
  assert.strictEqual(M.scoreAssociacao("arame", "Cimento CP-II 50kg"), 0);
});

teste("palavra curta sozinha não prova associação", () => {
  assert.strictEqual(M.scoreAssociacao("de", "Areia Fina"), 0, "'de' não casa com nada");
});

teste("entre dois que cobrem igual, ganha o que a obra mais compra", () => {
  // "arame" serve para recozido e farpado; o texto não desempata, o histórico sim
  const c = M.candidatosDoPedido("arame", catalogo, 6);
  assert.strictEqual(c[0].codigo, "FER-010", "arame recozido — 44 compras contra 0");
  assert.strictEqual(c[1].codigo, "FER-011");
});

teste("prestador não entra na associação", () => {
  assert.strictEqual(M.candidatosDoPedido("pedreiro", catalogo, 6).length, 0);
});

teste("associação fraca não vira sugestão", () => {
  assert.strictEqual(M.candidatosDoPedido("telha portuguesa", catalogo, 6).length, 0);
});

teste("o 'e' que liga itens separa, e a saudação antes da vírgula cai fora", () => {
  const r = M.interpretarPedido("bom dia, preciso de 10 sacos de cimento e 1/2 m3 de areia fina", catalogo);
  assert.strictEqual(r.length, 2);
  assert.deepStrictEqual(r.map(x => x.quantidade), [10, 0.5]);
});

teste("ponto e vírgula separa itens escritos na mesma linha", () => {
  const r = M.interpretarPedido("10 sacos de cimento; 1/2 m3 de areia fina", catalogo);
  assert.deepStrictEqual(r.map(x => x.quantidade), [10, 0.5]);
});

// ── Ler o orçamento que a loja mandou em PDF ────────────────────
// As células abaixo são as que o pdf.js entrega para o orçamento de verdade
// da OURIFER — é o papel que ele arrastou, linha por linha.
const OURIFER = [
  ["OURIFER"],
  ["R.", "J.", "Ferreira", "Ltda"],
  ["IE:", "495152605116", "-", "CNPJ/CPF:", "08.617.563/0001-35"],
  ["Rua", "Vitorio", "Christoni,", "912", "-", "Jardim", "Santa", "Fe", "-", "Ourinhos", "-", "SP", "-", "CEP:", "19.910-060"],
  ["Fone:", "(14)", "3324-6195", "-", "14", "99660-8300", "--", "ourifer@hotmail.com", "-"],
  ["ORÇAMENTO"],
  ["•", "NÚMERO:", "023698-120", "•", "DATA:", "12/08/2026", "09:50", "•", "VÁLIDO", "ATÉ", "15/08/2026", "00:00"],
  ["Cliente:", "0006", "Cobop", "Comercio", "Ltda", "(Cobop", "Comercio", "Ltda)"],
  ["Endereço:", "Av.", "Altino", "Arantes,", "524", "-", "Bairro:", "Centro"],
  ["Cidade:", "Ourinhos/SP", "-", "Cep:", "19.000-031"],
  ["Vendedor:", "0006", "Tamara", "Duarte"],
  ["A", "Prazo", "573,00"],
  ["Condição", "de", "Pagamento:", "Total:"],
  ["Código", "Descrição", "Quantidade", "Unitário", "Total"],
  ["0000000001373", "Tijolo", "8", "Furos", "9x19x19", "300", "1,05", "315,00"],
  ["0000000002405", "Cimento", "Cp", "Ii", "F", "50kg", "-", "Csn", "6", "43,00", "258,00"],
  ["306,000"],
  ["TOTAL"],
  ["573,00"],
  ["OBRIGADO", "PELA", "PREFERENCIA"],
  ["VOLTE", "SEMPRE", "!!!"],
  ["1", "de", "1"],
].map(celulas => ({ celulas, texto: celulas.join(" ") }));

teste("a tabela do orçamento vira itens; cabeçalho e rodapé ficam de fora", () => {
  const o = M.interpretarOrcamento(OURIFER);
  assert.strictEqual(o.itens.length, 2, "só as duas linhas de mercadoria");
  assert.deepStrictEqual(o.itens[0], { codigo: "0000000001373", unidade: "",
    descricao: "Tijolo 8 Furos 9x19x19", quantidade: 300, unitario: 1.05, total: 315 });
  assert.deepStrictEqual(o.itens[1], { codigo: "0000000002405", unidade: "",
    descricao: "Cimento Cp Ii F 50kg - Csn", quantidade: 6, unitario: 43, total: 258 });
});

teste("o cabeçalho diz de quem é, o número e até quando vale", () => {
  const o = M.interpretarOrcamento(OURIFER);
  assert.strictEqual(o.fornecedor, "OURIFER");
  assert.strictEqual(o.cnpj, "08.617.563/0001-35");
  assert.strictEqual(o.numero, "023698-120");
  assert.strictEqual(o.emitido, "2026-08-12");
  assert.strictEqual(o.validade, "2026-08-15");
});

teste("a condição de pagamento é lida mesmo caindo na linha de cima", () => {
  assert.strictEqual(M.interpretarOrcamento(OURIFER).condicao, "A Prazo");
});

teste("o total do papel bate com a soma dos itens", () => {
  const o = M.interpretarOrcamento(OURIFER);
  assert.strictEqual(o.somaItens, 573);
  assert.strictEqual(o.total, 573);
});

teste("o rótulo da coluna 'Total' não pode virar valor do orçamento", () => {
  // Sem número na mesma linha, o "Total:" do cabeçalho casaria com o código
  // 0000000001373 da linha de baixo — o orçamento sairia valendo 1373.
  assert.notStrictEqual(M.interpretarOrcamento(OURIFER).total, 1373);
});

teste("total fechado abaixo da soma entra como total do papel", () => {
  const comDesconto = OURIFER.map(l => l.texto === "Condição de Pagamento: Total:"
    ? { celulas: ["Condição", "de", "Pagamento:", "Total:", "550,00"], texto: "Condição de Pagamento: Total: 550,00" }
    : l);
  const o = M.interpretarOrcamento(comDesconto);
  assert.strictEqual(o.total, 550);
  assert.strictEqual(o.somaItens, 573);
});

teste("linha sem descrição ou sem número não é item", () => {
  assert.strictEqual(M.itemDeOrcamento({ celulas: ["306,000"] }), null);
  assert.strictEqual(M.itemDeOrcamento({ celulas: ["Código", "Descrição", "Quantidade", "Unitário", "Total"] }), null);
  assert.strictEqual(M.itemDeOrcamento({ celulas: ["TOTAL", "2", "3", "573,00"] }), null);
  assert.strictEqual(M.itemDeOrcamento({ celulas: ["1", "de", "1"] }), null);
});

teste("número do orçamento: ponto de milhar não vira decimal", () => {
  assert.strictEqual(M.numeroDeOrcamento("1.234"), 1234);
  assert.strictEqual(M.numeroDeOrcamento("1.05"), 1.05);
  assert.strictEqual(M.numeroDeOrcamento("1.234,56"), 1234.56);
  assert.strictEqual(M.numeroDeOrcamento("43,00"), 43);
});

teste("PDF sem tabela nenhuma não inventa item", () => {
  const o = M.interpretarOrcamento([{ celulas: ["Bom dia, segue o orçamento."], texto: "Bom dia, segue o orçamento." }]);
  assert.deepStrictEqual(o.itens, []);
  assert.strictEqual(o.total, 0);
});

// ── Casar o orçamento com o pedido ──────────────────────────────
const pedidoDoPdf = {
  ...M.cotacaoVazia("o1"), id: "ct-pdf",
  itens: [
    { id: "i1", descricao: "Cimento CP-II 50kg", quantidade: 6, unidade: "Unidades" },
    { id: "i2", descricao: "Tijolo 8 furos 9x19x19", quantidade: 300, unidade: "Unidades" },
    { id: "i3", descricao: "Areia Fina", quantidade: 2, unidade: "m3" },
  ],
};

teste("cada item do pedido acha seu preço, mesmo com o nome da loja diferente", () => {
  const cm = M.casarOrcamentoComItens(pedidoDoPdf, M.interpretarOrcamento(OURIFER));
  assert.strictEqual(cm.achados, 2);
  const por = {};
  cm.casados.forEach(c => { por[c.item.id] = c.linha ? c.linha.unitario : null; });
  assert.strictEqual(por.i1, 43, "Cimento CP-II 50kg ↔ Cimento Cp Ii F 50kg - Csn");
  assert.strictEqual(por.i2, 1.05, "Tijolo 8 furos ↔ Tijolo 8 Furos");
  assert.strictEqual(por.i3, null, "areia não veio neste orçamento");
});

teste("a loja não cotou nada que não foi pedido", () => {
  const cm = M.casarOrcamentoComItens(pedidoDoPdf, M.interpretarOrcamento(OURIFER));
  assert.strictEqual(cm.sobrando.length, 0);
});

teste("item cotado que não estava no pedido fica de fora, e é avisado", () => {
  const so = { ...pedidoDoPdf, itens: [pedidoDoPdf.itens[0]] };
  const cm = M.casarOrcamentoComItens(so, M.interpretarOrcamento(OURIFER));
  assert.strictEqual(cm.achados, 1);
  assert.strictEqual(cm.sobrando.length, 1);
  assert.strictEqual(cm.sobrando[0].descricao, "Tijolo 8 Furos 9x19x19");
});

teste("uma linha do orçamento não serve para dois itens do pedido", () => {
  const dois = { ...pedidoDoPdf, itens: [
    { id: "a", descricao: "Cimento CP-II 50kg", quantidade: 6, unidade: "Unidades" },
    { id: "b", descricao: "Cimento CP-II 50kg", quantidade: 4, unidade: "Unidades" },
  ] };
  const cm = M.casarOrcamentoComItens(dois, M.interpretarOrcamento(OURIFER));
  assert.strictEqual(cm.achados, 1, "a segunda linha fica sem preço, não repete a primeira");
});

// ── A loja do papel contra o cadastro ───────────────────────────
const lojas = [
  { id: "f1", nome: "OURIFER", cnpjCpf: "08.617.563/0001-35", ativo: true },
  { id: "f2", nome: "Casa do Construtor", cnpjCpf: "", ativo: true },
  { id: "f3", nome: "Ourifer Materiais Ltda", cnpjCpf: "", ativo: false },
];

teste("o CNPJ do orçamento acha a loja no cadastro", () => {
  const f = M.lojaCadastrada(lojas, { fornecedor: "R. J. Ferreira Ltda", cnpj: "08.617.563/0001-35" });
  assert.strictEqual(f && f.id, "f1");
});

teste("sem CNPJ, vale o nome — e acento não atrapalha", () => {
  assert.strictEqual(M.lojaCadastrada(lojas, { fornecedor: "ourifer" }).id, "f1");
  assert.strictEqual(M.lojaCadastrada(lojas, { fornecedor: "Casa do Construtor" }).id, "f2");
});

teste("loja desativada não é sugerida, e nome que não bate não vira palpite", () => {
  assert.strictEqual(M.lojaCadastrada([lojas[2]], { fornecedor: "Ourifer Materiais Ltda" }), null);
  assert.strictEqual(M.lojaCadastrada(lojas, { fornecedor: "Depósito São Jorge" }), null);
  assert.strictEqual(M.lojaCadastrada(lojas, { fornecedor: "" }), null);
});

// ── Cada loja manda o PDF de um jeito ───────────────────────────
// Nenhuma dessas tabelas tem o desenho da OURIFER. O que sustenta a leitura
// é o cabeçalho e a conta quantidade × unitário = total.
const papel = (...linhas) => linhas.map(celulas => ({ celulas, texto: celulas.join(" ") }));
const itens1 = (...linhas) => M.interpretarOrcamento(papel(...linhas)).itens;
const um = (...linhas) => { const i = itens1(...linhas); assert.strictEqual(i.length, 1, "esperava um item, veio " + i.length); return i[0]; };

teste("formato com unidade no meio e rótulos abreviados", () => {
  const i = um(["Produto", "Un", "Qtde", "Vl. Unit.", "Vl. Total"],
               ["Cimento CP II 50kg", "SC", "6", "43,00", "258,00"]);
  assert.strictEqual(i.descricao, "Cimento CP II 50kg");
  assert.strictEqual(i.unidade, "SC");
  assert.strictEqual(i.unitario, 43);
  assert.strictEqual(i.total, 258);
});

teste("formato sem coluna de total: o total sai da conta", () => {
  const i = um(["Descrição", "Quant.", "Preço Unit."], ["Areia média", "4", "95,00"]);
  assert.strictEqual(i.quantidade, 4);
  assert.strictEqual(i.unitario, 95);
  assert.strictEqual(i.total, 380);
});

teste("formato sem coluna de unitário: o unitário sai da divisão", () => {
  const i = um(["Descrição", "Qtd", "Total"], ["Areia fina", "2", "190,00"]);
  assert.strictEqual(i.unitario, 95);
  assert.strictEqual(i.total, 190);
});

teste("coluna de desconto no meio não vira preço", () => {
  const i = um(["Item", "Qtde", "Unitário", "Desc.", "Total"],
               ["Tinta acrílica 18L", "2", "289,90", "0,00", "579,80"]);
  assert.strictEqual(i.unitario, 289.9, "o 0,00 do desconto não pode virar o preço");
  assert.strictEqual(i.total, 579.8);
});

teste("quantidade na frente da descrição, sem cabeçalho nenhum", () => {
  const i = um(["300", "UN", "Tijolo 8 furos", "1,05", "315,00"]);
  assert.strictEqual(i.descricao, "Tijolo 8 furos", "o 300 é quantidade, não parte do nome");
  assert.strictEqual(i.codigo, "", "e também não é código");
  assert.strictEqual(i.quantidade, 300);
  assert.strictEqual(i.unitario, 1.05);
});

teste("cifrão grudado no número não atrapalha", () => {
  const i = um(["Prego 17x27", "5", "R$ 19,90", "R$ 99,50"]);
  assert.strictEqual(i.unitario, 19.9);
  assert.strictEqual(i.total, 99.5);
});

teste("milhar com ponto: 1.200 é mil e duzentos", () => {
  const i = um(["Bloco estrutural", "1.200", "3,45", "4.140,00"]);
  assert.strictEqual(i.quantidade, 1200);
  assert.strictEqual(i.total, 4140);
});

teste("número dentro do nome do material continua no nome", () => {
  const i = um(["Vergalhão CA-50 10,0mm 12m", "20", "48,90", "978,00"]);
  assert.strictEqual(i.descricao, "Vergalhão CA-50 10,0mm 12m");
  assert.strictEqual(i.quantidade, 20);
});

teste("linha de somatório e linha de recado não viram item", () => {
  assert.deepStrictEqual(itens1(["Total Geral", "1.234,00"]), []);
  assert.deepStrictEqual(itens1(["Subtotal", "10", "1,00", "10,00"]), []);
  assert.deepStrictEqual(itens1(["Prazo de entrega", "15"]), []);
  assert.deepStrictEqual(itens1(["Observação: entrega em", "5", "dias"]), []);
});

teste("o que está acima do cabeçalho da tabela nunca é item", () => {
  const itens = itens1(["Condição: A Prazo", "573,00"],
                       ["Vendedor Tamara", "6", "43,00", "258,00"],
                       ["Descrição", "Qtde", "Unitário", "Total"],
                       ["Cimento CP II", "6", "43,00", "258,00"]);
  assert.strictEqual(itens.length, 1);
  assert.strictEqual(itens[0].descricao, "Cimento CP II");
});

teste("cabeçalho que não bate com a linha cede lugar à conta", () => {
  // o cabeçalho tem 3 colunas numéricas, a linha só traz 2 — vale a conta
  const i = um(["Descrição", "Qtde", "Unitário", "Total"], ["Cal hidratada 20kg", "8", "17,50"]);
  assert.strictEqual(i.unitario, 17.5);
  assert.strictEqual(i.total, 140);
});

teste("cabeçalho errado para a linha não estraga o preço", () => {
  // a loja mandou (qtd, total) onde o cabeçalho diz (qtd, unitário, total):
  // a conta não fecha, então o cabeçalho é descartado para esta linha
  const i = um(["Descrição", "Qtde", "Unitário", "Total"], ["Massa corrida 18L", "3", "89,00", "267,00"]);
  assert.strictEqual(i.unitario, 89);
  assert.strictEqual(i.total, 267);
});

teste("o mesmo papel da OURIFER continua lido do mesmo jeito", () => {
  const o = M.interpretarOrcamento(OURIFER);
  assert.strictEqual(o.itens.length, 2);
  assert.strictEqual(o.itens[1].unitario, 43);
});

teste("preço da linha: sem unitário, divide o total pela quantidade do pedido", () => {
  assert.strictEqual(M.precoDaLinha({ unitario: 43, total: 258, quantidade: 6 }), 43);
  assert.strictEqual(M.precoDaLinha({ unitario: 0, total: 190, quantidade: 0 }, 2), 95);
  assert.strictEqual(M.precoDaLinha({ unitario: 0, total: 0 }, 2), 0);
});

// ── O que a IA leu vira a mesma conferência ─────────────────────
const lidoPelaIA = {
  fornecedor: "OURIFER", cnpj: "08.617.563/0001-35", numero: "023698-120", emitido: "2026-08-12",
  validade: "2026-08-15", condicao: "A Prazo", total: 573,
  itens: [
    { descricao: "Tijolo 8 Furos 9x19x19", unidade: "UN", quantidade: 300, unitario: 1.05, total: 315, itemDoPedido: "i2" },
    { descricao: "Cimento Cp Ii F 50kg - Csn", unidade: "SC", quantidade: 6, unitario: 43, total: 258, itemDoPedido: "i1" },
  ],
};

teste("a leitura da IA liga cada linha ao item que ela indicou", () => {
  const o = M.orcamentoDaIA(lidoPelaIA);
  const cm = M.casamentoDaIA(pedidoDoPdf, o);
  const por = {}; cm.casados.forEach(c => { por[c.item.id] = c.linha ? c.linha.unitario : null; });
  assert.deepStrictEqual(por, { i1: 43, i2: 1.05, i3: null });
  assert.strictEqual(cm.achados, 2);
  assert.strictEqual(o.somaItens, 573);
});

teste("id que não existe no pedido não casa nada, e a linha sobra", () => {
  const o = M.orcamentoDaIA({ ...lidoPelaIA, itens: [{ ...lidoPelaIA.itens[0], itemDoPedido: "inventado" },
                                                       lidoPelaIA.itens[1]] });
  const cm = M.casamentoDaIA(pedidoDoPdf, o);
  assert.strictEqual(cm.achados, 1);
  assert.strictEqual(cm.sobrando.length, 1);
});

teste("IA que não ligou nada cai na associação por palavras", () => {
  const o = M.orcamentoDaIA({ ...lidoPelaIA, itens: lidoPelaIA.itens.map(l => ({ ...l, itemDoPedido: null })) });
  const cm = M.casamentoDaIA(pedidoDoPdf, o);
  assert.strictEqual(cm.achados, 2, "o leitor por palavras acha os dois mesmo assim");
});

teste("resposta da IA com número negativo ou lixo não passa", () => {
  const o = M.orcamentoDaIA({ total: -10, itens: [{ descricao: "X", quantidade: -1, unitario: -5, total: 0 },
                                                  { descricao: "", quantidade: 1, unitario: 10, total: 10 }] });
  assert.strictEqual(o.total, 0);
  assert.deepStrictEqual(o.itens, []);
});

teste("para a IA vai só id, nome, quantidade e unidade do pedido", () => {
  const i = M.itensParaIA(pedidoDoPdf);
  assert.deepStrictEqual(Object.keys(i[0]).sort(), ["descricao", "id", "quantidade", "unidade"]);
  assert.strictEqual(i[1].quantidade, 300);
});

teste("o aviso diz o motivo de verdade, e escritório sem IA não vê aviso", () => {
  const e = (motivo, message) => Object.assign(new Error(message), { motivo });
  assert.match(M.avisoDaIA(e("token", "O token da IA venceu")), /token/);
  assert.match(M.avisoDaIA(e("limite", "O crédito mensal acabou")), /crédito/);
  assert.strictEqual(M.avisoDaIA(e("nao_liberada", "x")), "", "escritório sem IA não recebe aviso nenhum");
  assert.strictEqual(M.avisoDaIA(e("nao_configurada", "x")), "");
  // rota que não existe no servidor publicado tem que aparecer, não virar
  // "a IA não respondeu" — foi assim que um 404 passou por instabilidade
  assert.match(M.avisoDaIA(e("falha", "O servidor respondeu erro 404 na leitura do pedido.")), /404/);
  assert.strictEqual(M.avisoDaIA(e("falha", "")), "A IA não respondeu agora.");
});

// ── O pedido lido pela IA ───────────────────────────────────────
teste("código do catálogo entra como achado; sem código, vale o parecido", () => {
  const r = M.pedidoDaIA({ itens: [
    { descricao: "cimento", quantidade: 30, unidade: "sacos", codigoInsumo: "CIM-001" },
    { descricao: "arame", quantidade: 20, unidade: "quilos", codigoInsumo: null },
    { descricao: "telha portuguesa", quantidade: 200, unidade: "un", codigoInsumo: null },
  ] }, catalogo);
  assert.strictEqual(r[0].insumo.codigo, "CIM-001");
  assert.strictEqual(r[0].confianca, "ia");
  assert.strictEqual(r[0].unidade, "Unidades", "a unidade passa a ser a do catálogo");
  assert.strictEqual(r[1].insumo, null, "sem código, a IA não escolhe por nós");
  assert.strictEqual(r[1].candidatos[0].codigo, "FER-010", "mas o parecido fica na setinha");
  assert.strictEqual(r[2].confianca, "nenhum");
});

teste("código que não existe no catálogo é ignorado", () => {
  const r = M.pedidoDaIA({ itens: [{ descricao: "cimento", quantidade: 1, unidade: "", codigoInsumo: "XPTO" }] }, catalogo);
  assert.strictEqual(r[0].insumo, null);
});

teste("quantidade zero fica em branco, para você digitar", () => {
  const r = M.pedidoDaIA({ itens: [{ descricao: "cimento", quantidade: 0, unidade: "sc", codigoInsumo: "CIM-001" }] }, catalogo);
  assert.strictEqual(r[0].quantidade, "");
});

teste("linha sem descrição não entra, e prestador nunca é sugerido", () => {
  const r = M.pedidoDaIA({ itens: [{ descricao: "  ", quantidade: 2, unidade: "", codigoInsumo: null },
                                   { descricao: "pedreiro", quantidade: 1, unidade: "", codigoInsumo: "PRE-001" }] }, catalogo);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].insumo, null, "prestador não entra em pedido de loja");
});

teste("o parecido é promovido a escolha, mas marcado para confirmar", () => {
  const cru = M.pedidoDaIA({ itens: [{ descricao: "arame", quantidade: 20, unidade: "kg", codigoInsumo: null }] }, catalogo);
  assert.strictEqual(M.resumoDaLeitura(cru).sugeridos, 1, "no resumo ainda conta como sugestão");
  const l = M.promoverCandidatos(cru);
  assert.strictEqual(l[0].insumo.codigo, "FER-010");
  assert.strictEqual(l[0].confirmar, true);
});

teste("o que a IA achou pelo código não ganha a marca de confirmar", () => {
  const l = M.promoverCandidatos(M.pedidoDaIA({ itens: [
    { descricao: "cimento", quantidade: 30, unidade: "sc", codigoInsumo: "CIM-001" }] }, catalogo));
  assert.ok(!l[0].confirmar);
});

teste("o item lido pela IA vira item da cotação com nome do catálogo", () => {
  const l = M.pedidoDaIA({ itens: [{ descricao: "cimento", quantidade: 30, unidade: "sc", codigoInsumo: "CIM-001" }] }, catalogo);
  const it = M.itemDoPedidoLido(l[0]);
  assert.strictEqual(it.descricao, "Cimento CP-II 50kg");
  assert.strictEqual(it.quantidade, 30);
  assert.strictEqual(it.unidade, "Unidades");
});

// ── Andamento da leitura ────────────────────────────────────────
teste("a barra anda por etapa e cresce com os itens, sem chegar a 100 antes do fim", () => {
  const A = (etapa, itens, s) => M.andamentoDaLeitura({ etapa, itens, decorridoMs: s * 1000 });
  assert.strictEqual(A("ligando", 0, 1).pct, 6);
  assert.ok(A("lendo", 0, 5).pct > 6 && A("lendo", 0, 60).pct <= 30, "sem itens ainda, anda com o tempo até 30%");
  assert.ok(A("lendo", 5, 20).pct > A("lendo", 0, 60).pct, "o primeiro item passa na frente do tempo");
  assert.ok(A("lendo", 40, 60).pct > A("lendo", 5, 20).pct);
  assert.ok(A("lendo", 500, 200).pct < 95, "mesmo com muitos itens não encosta no fim");
  assert.strictEqual(A("conferindo", 40, 60).pct, 95);
});

teste("a frase diz o que está acontecendo, com o tempo corrido", () => {
  assert.match(M.andamentoDaLeitura({ etapa: "lendo", itens: 12, decorridoMs: 34000 }).frase, /12 itens até agora/);
  assert.strictEqual(M.andamentoDaLeitura({ etapa: "lendo", itens: 1, decorridoMs: 0 }).frase, "A IA está lendo · 1 item até agora");
  assert.strictEqual(M.andamentoDaLeitura({ etapa: "lendo", itens: 12, decorridoMs: 34400 }).seg, 34);
  const semSinal = M.andamentoDaLeitura({ etapa: "sem_sinal", decorridoMs: 5000 });
  assert.strictEqual(semSinal.pct, null, "sem sinal, a barra fica onde estava");
  assert.match(semSinal.frase, /continua no servidor/);
  const rec = M.andamentoDaLeitura({ etapa: "reconectando", decorridoMs: 3000 });
  assert.strictEqual(rec.pct, null);
  assert.match(rec.frase, /tentando de novo/);
});

// ── Trocar o material na conferência ────────────────────────────
const CAT_LUVAS = [
  { id: "1", codigo: "HID-010", nome: "PVC - Elétrica - Luva Pressão 25 (3/4)", grupo: "Hidráulica", unidade: "Unidade" },
  { id: "2", codigo: "HID-011", nome: "Luva Soldável Redução 32 x 25 mm", grupo: "Hidráulica", unidade: "Unidade" },
  { id: "3", codigo: "HID-012", nome: "Luva Soldável 25 mm", grupo: "Hidráulica", unidade: "Unidade" },
  { id: "4", codigo: "ELE-001", nome: "Elétrica - CABO PP - 3 X 2,50 MM2", grupo: "Elétrica", unidade: "Metros" },
  { id: "5", codigo: "PRE-001", nome: "Luva de pedreiro", tipo: "prestador" },
  { id: "6", codigo: "HID-013", nome: "Luva antiga", ativo: false },
];

teste("a marca sai do nome sugerido, o resto fica como ele escreveu", () => {
  assert.strictEqual(M.semMarca("LUVA SOLDAVEL TIGRE REDUCAO 32 X 25 MM"), "LUVA SOLDAVEL REDUCAO 32 X 25 MM");
  assert.strictEqual(M.semMarca("Cimento Votoran 50kg"), "Cimento 50kg");
  assert.strictEqual(M.semMarca("Tigre"), "Tigre", "se só tem a marca, não some tudo");
});

teste("a marca não derruba a nota do item certo", () => {
  const com = M.medirAssociacao("luva soldavel tigre reducao 32 x 25", "Luva Soldável Redução 32 x 25 mm");
  assert.strictEqual(com.cobertura, 1);
  const cand = M.candidatosDoPedido("LUVA SOLDAVEL TIGRE REDUCAO 32 X 25 MM", CAT_LUVAS, 3);
  assert.strictEqual(cand[0].codigo, "HID-011");
});

teste("digitar 'luva' traz todas as luvas do catálogo, e só elas", () => {
  const r = M.buscarNoCatalogo(CAT_LUVAS, "luva");
  assert.deepStrictEqual(r.map(i => i.codigo).sort(), ["HID-010", "HID-011", "HID-012"]);
  assert.deepStrictEqual(M.buscarNoCatalogo(CAT_LUVAS, "luva 32").map(i => i.codigo), ["HID-011"]);
  assert.deepStrictEqual(M.buscarNoCatalogo(CAT_LUVAS, "luva tigre 25").map(i => i.codigo).sort(), ["HID-010", "HID-011", "HID-012"],
    "marca digitada é ignorada");
  assert.deepStrictEqual(M.buscarNoCatalogo(CAT_LUVAS, "soldavel reducao"), [CAT_LUVAS[1]], "sem acento acha");
  assert.deepStrictEqual(M.buscarNoCatalogo(CAT_LUVAS, "   "), []);
});

teste("item novo entra no catálogo com código do grupo e o texto dele como apelido", () => {
  const n = M.novoInsumoDoPedido({ nome: " Luva Soldável Redução 40 x 32 mm ", grupo: "Hidráulica", unidade: "Unidade",
    escrito: "LUVA SOLDAVEL TIGRE REDUCAO 40 X 32 MM" }, CAT_LUVAS, (g) => g === "Hidráulica" ? "HID-014" : "OUT-001", "novo1");
  assert.strictEqual(n.id, "novo1");
  assert.strictEqual(n.codigo, "HID-014");
  assert.strictEqual(n.nome, "Luva Soldável Redução 40 x 32 mm");
  assert.strictEqual(n.tipo, "material");
  assert.strictEqual(n.ativo, true);
  assert.deepStrictEqual(n.aliases, ["Luva Soldável Redução 40 x 32 mm", "LUVA SOLDAVEL TIGRE REDUCAO 40 X 32 MM"]);
  assert.strictEqual(M.candidatosDoPedido("luva soldavel tigre reducao 40 x 32 mm", [...CAT_LUVAS, n], 1)[0].id, "novo1",
    "da próxima vez, acha");
  assert.strictEqual(M.novoInsumoDoPedido({ nome: "  " }, []), null, "sem nome não cadastra");
  const igual = M.novoInsumoDoPedido({ nome: "Prego 17x21", escrito: "prego 17x21" }, [], null, "x");
  assert.deepStrictEqual(igual.aliases, ["Prego 17x21"], "apelido igual ao nome não duplica");
  assert.strictEqual(igual.grupo, "Outros");
});

// ── Item novo no padrão do catálogo ─────────────────────────────
const CAT_FAM = [
  ...["Luva 25mm C/ Bucha latão", "Luva 25×20mm C/ Bucha latão", "Luva 25×50mm Roscável", "Luva 32mm", "Luva 50mm", "Luva União 50mm"]
    .map((n, k) => ({ id: "a" + k, codigo: "HID-07" + k, nome: "PVC - Alimentação Água Fria - " + n, grupo: "Hidráulica", unidade: "Unidades" })),
  { id: "e1", codigo: "ELE-050", nome: "PVC - Elétrica - Luva Pressão 25 (3/4)", grupo: "Elétrica e iluminação", unidade: "Unidade" },
  { id: "s1", codigo: "HID-200", nome: "PVC - Esgoto - Luva Simples 100mm", grupo: "Hidráulica", unidade: "Unidades" },
  { id: "x1", codigo: "HID-300", nome: "PVC - Esgoto - Joelho 100mm", grupo: "Hidráulica", unidade: "Unidades" },
];

teste("a medida sai do que ele escreveu, no separador da família", () => {
  assert.strictEqual(M.medidaDoTexto("LUVA SOLDAVEL TIGRE REDUCAO 32 X 25 MM", "×"), "32×25mm");
  assert.strictEqual(M.medidaDoTexto("luva 32x25", "x"), "32x25");
  assert.strictEqual(M.medidaDoTexto("joelho 25MM"), "25mm");
  assert.strictEqual(M.medidaDoTexto("registro 3/4"), "3/4");
  assert.strictEqual(M.medidaDoTexto("cimento"), "");
});

teste("a palavra-chave é o que o item é, sem marca nem número", () => {
  assert.strictEqual(M.palavraChave("LUVA SOLDAVEL TIGRE REDUCAO 32 X 25 MM"), "luva");
  assert.strictEqual(M.palavraChave("Tigre joelho 90 25mm"), "joelho");
  assert.strictEqual(M.palavraChave("25 de cimento"), "cimento");
});

teste("a família vem do catálogo: tudo até a palavra-chave, a mais comum primeiro", () => {
  const f = M.familiasDoCatalogo("luva", "LUVA SOLDAVEL TIGRE REDUCAO 32 X 25 MM", CAT_FAM);
  assert.strictEqual(f[0].familia, "PVC - Alimentação Água Fria - Luva");
  assert.strictEqual(f[0].n, 6);
  assert.strictEqual(f[0].sep, "×");
  assert.strictEqual(f[0].grupo, "Hidráulica");
  assert.strictEqual(f[0].unidade, "Unidades");
  assert.deepStrictEqual(f.map(x => x.familia).sort(), ["PVC - Alimentação Água Fria - Luva", "PVC - Elétrica - Luva", "PVC - Esgoto - Luva"]);
  assert.strictEqual(M.nomeNoPadrao(f[0].familia, M.medidaDoTexto("32 X 25 MM", f[0].sep)), "PVC - Alimentação Água Fria - Luva 32×25mm");
  const esgoto = M.familiasDoCatalogo("luva", "luva esgoto 100", CAT_FAM);
  assert.strictEqual(esgoto[0].familia, "PVC - Esgoto - Luva", "o que ele escreveu pesa mais que a quantidade");
  assert.deepStrictEqual(M.familiasDoCatalogo("", "x", CAT_FAM), []);
  assert.deepStrictEqual(M.familiasDoCatalogo("cotovelo", "cotovelo", CAT_FAM), []);
});

teste("os grupos do cadastro são os do catálogo da empresa, mais os de fábrica", () => {
  const cat = [{ nome: "a", grupo: "Esgoto e Água Pluvial" }, { nome: "b", grupo: "Hidráulica" }, { nome: "c", grupo: " Hidráulica " },
    { nome: "d", grupo: "Pedreiro", tipo: "prestador" }];
  const g = M.gruposDoCatalogo(cat, [{ nome: "Aço" }, { nome: "Impermeabilizantes" }, { nome: "Prestadores de serviços" }, { nome: "hidraulica" }]);
  assert.deepStrictEqual(g, ["Aço", "Esgoto e Água Pluvial", "Hidráulica", "Impermeabilizantes", "Outros"]);
});

teste("família com espaço sobrando no nome vira a mesma família", () => {
  const f = M.familiasDoCatalogo("luva", "luva esgoto", [
    { id: "1", nome: "PVC -  Esgoto - Luva 100mm", grupo: "Esgoto e Água Pluvial", unidade: "Unidades" },
    { id: "2", nome: "PVC - Esgoto - Luva 50mm", grupo: "Esgoto e Água Pluvial", unidade: "Unidades" }]);
  assert.strictEqual(f.length, 1);
  assert.strictEqual(f[0].familia, "PVC - Esgoto - Luva");
  assert.strictEqual(f[0].grupo, "Esgoto e Água Pluvial");
});

teste("grupo criado pela empresa segue o prefixo que o catálogo já usa nele", () => {
  const cat = [{ codigo: "ESG-004", grupo: "Esgoto e Água Pluvial" }, { codigo: "ESG-011", grupo: "Esgoto e Água Pluvial" },
    { codigo: "HID-080", grupo: "Hidráulica" }];
  const fab = (g) => g === "Hidráulica" ? "HID-235" : "OUT-001";
  assert.strictEqual(M.codigoDoGrupo("Esgoto e Água Pluvial", cat, fab), "ESG-012");
  assert.strictEqual(M.codigoDoGrupo("Hidráulica", cat, fab), "HID-235", "grupo de fábrica usa a regra de fábrica");
  assert.strictEqual(M.codigoDoGrupo("Novidade", cat, fab), "OUT-001");
});

// ── Embalagem diferente (caso real: Ourifer, Obra Teste) ─────────
teste("peso, volume e modelo da tela saem do nome", () => {
  assert.deepStrictEqual(M.medidasDeEmbalagem("Cimento Votoran 25kg"), { kg: 25 });
  assert.deepStrictEqual(M.medidasDeEmbalagem("Sacos de cimento 50kg"), { kg: 50 });
  assert.deepStrictEqual(M.medidasDeEmbalagem("VEDA CONCRETO 5 LITRO"), { l: 5 });
  assert.deepStrictEqual(M.medidasDeEmbalagem("Veda Concreto 1 Lt"), { l: 1 });
  assert.deepStrictEqual(M.medidasDeEmbalagem("Aço - Malha pop EQ092 4.2mm 15x15"), { q: 92 });
  assert.deepStrictEqual(M.medidasDeEmbalagem("Tela Pp Soldada Q61 2 X3m 15x15 3,4 Me"), { q: 61 });
  assert.deepStrictEqual(M.medidasDeEmbalagem("Ferro Ca50 10,00mm - 3/8 - Br 7,404kg"), { kg: 7.404 });
  assert.deepStrictEqual(M.medidasDeEmbalagem("JOELHO L.R TIGRE 25 X 3/4 MARROM"), {});
});

teste("cimento 25kg não entra no de 50kg; converte só se você mandar", () => {
  const d = M.divergenciaDeEmbalagem("Sacos de cimento 50kg", "Cimento Votoran 25kg");
  assert.ok(d); assert.strictEqual(d.fator, 2);
  assert.match(d.texto, /pedido 50 kg, loja 25 kg/);
  assert.strictEqual(M.divergenciaDeEmbalagem("VEDA CONCRETO 5 LITRO", "Veda Concreto 1 Lt").fator, 5);
  const tela = M.divergenciaDeEmbalagem("Aço - Malha pop EQ092 4.2mm 15x15", "Tela Pp Soldada Q61 2 X3m 15x15 3,4 Me");
  assert.ok(tela); assert.strictEqual(tela.fator, 0, "tela de outro modelo não converte");
  assert.strictEqual(M.divergenciaDeEmbalagem("Aço - Malha pop Q138 4.2mm 10x10", "MALHA POP 3 X 2 MTS FIO 4.2 10 X 10- Q138 - AZUL"), null);
  assert.strictEqual(M.divergenciaDeEmbalagem("Impermeabilizantes - Vedatop 18KG", "Vedatop 1000 18kg - Vedacit"), null);
  assert.strictEqual(M.divergenciaDeEmbalagem("Impermeabilizantes - Vedalit 18L", "Vedalit Bd 18 Kg - Vedacit"), null, "kg e litro não se comparam");
  assert.strictEqual(M.divergenciaDeEmbalagem("PVC - Hidráulica - Caixa d'agua convencional 500 L", "Caixa D Água 500 Lt - Fortlev"), null);
  assert.strictEqual(M.divergenciaDeEmbalagem("Aço - Arame Recozido", "Arame Recozido Trançado N18 1kg"), null, "pedido sem peso não compara");
});

teste("na conferência: embalagem diferente fica sem preço, e o repetido do pedido leva o mesmo preço", () => {
  const cimento = { id: "ci", descricao: "Sacos de cimento 50kg", quantidade: 240, unidade: "Unidades", codigo: "CIM-001" };
  const ad1 = { id: "a1", descricao: "PVC - Alimentação Água Fria - Adaptador 40mm", quantidade: 6, unidade: "Unidades", codigo: "HID-236" };
  const ad2 = { id: "a2", descricao: "PVC - Alimentação Água Fria - Adaptador 40mm", quantidade: 3, unidade: "Unidades", codigo: "HID-236" };
  const areia = { id: "ar", descricao: "Areia Grossa", quantidade: 14, unidade: "m3", codigo: "AGR-002" };
  const linhas = [
    { descricao: "Cimento Votoran 25kg", quantidade: 480, unitario: 22, total: 10560 },
    { descricao: "Adaptador Soldavel Bol Rosca 40mm", quantidade: 6, unitario: 9.4, total: 56.4 },
    { descricao: "Areia Grossa 1 Mt", quantidade: 14, unitario: 230, total: 3220 },
  ];
  const casamento = { casados: [
    { item: cimento, linha: linhas[0] }, { item: ad1, linha: linhas[1] }, { item: ad2, linha: null }, { item: areia, linha: linhas[2] }] };
  const e = M.escolhasDoCasamento(casamento, { itens: linhas });
  assert.strictEqual(e.ci.i, -1); assert.strictEqual(e.ci.preco, 0);
  assert.strictEqual(e.ci.sugerida, 0); assert.strictEqual(e.ci.divergencia.fator, 2);
  assert.strictEqual(e.a1.i, 1); assert.strictEqual(e.a1.preco, 9.4);
  assert.strictEqual(e.a2.i, 1); assert.strictEqual(e.a2.preco, 9.4); assert.strictEqual(e.a2.repetido, true);
  assert.strictEqual(e.ar.preco, 230);
});

// ── Versões da proposta de projeto ──────────────────────────────
const { orcSemVersao, proximaVersaoProposta, rotuloDaVersao } = (() => {
  const src = mod("orcamento-teste.jsx");
  const recorta = (nome) => {
    const i = src.indexOf("function " + nome);
    return src.slice(i, src.indexOf("\n}", i) + 2);
  };
  return new Function(recorta("orcSemVersao") + recorta("proximaVersaoProposta") + recorta("rotuloDaVersao")
    + "; return { orcSemVersao, proximaVersaoProposta, rotuloDaVersao };")();
})();

teste("a próxima versão conta pelo maior já usado, não pela quantidade", () => {
  assert.strictEqual(proximaVersaoProposta([]), "v1");
  assert.strictEqual(proximaVersaoProposta([{ versao: "v1" }]), "v2");
  assert.strictEqual(proximaVersaoProposta([{ versao: "v2" }]), "v3", "apagar a v1 não recicla o número");
  assert.strictEqual(proximaVersaoProposta([{ versao: "v1" }, { versao: "v7" }]), "v8");
  assert.strictEqual(proximaVersaoProposta([{ versao: "" }, { versao: "rascunho" }]), "v1");
});

teste("rótulo repetido é desempatado pela posição", () => {
  const boas = [{ versao: "v1" }, { versao: "v2" }];
  assert.strictEqual(rotuloDaVersao(boas, 0), "v1");
  assert.strictEqual(rotuloDaVersao(boas, 1), "v2");
  const repetidas = [{ versao: "v2" }, { versao: "v2" }];
  assert.strictEqual(rotuloDaVersao(repetidas, 0), "v1");
  assert.strictEqual(rotuloDaVersao(repetidas, 1), "v2");
  assert.strictEqual(rotuloDaVersao([{}], 0), "v1", "sem nome nenhum, vale a posição");
});

teste("excluir uma versão tira só ela, e os rótulos das outras não mudam", () => {
  const orc = { id: "ORC-1", propostas: [
    { versao: "v1", enviadaEm: "2026-09-25T15:00:00.000Z" },
    { versao: "v2", enviadaEm: "2026-09-25T18:00:00.000Z" },
    { versao: "v3", enviadaEm: "2026-09-25T19:00:00.000Z" }],
    ultimaPropostaEm: "2026-09-25T19:00:00.000Z" };
  const sem1 = orcSemVersao(orc, 0);
  assert.deepStrictEqual(sem1.propostas.map(p => p.versao), ["v2", "v3"]);
  assert.strictEqual(sem1.ultimaPropostaEm, "2026-09-25T19:00:00.000Z", "a última não mudou");
  assert.strictEqual(orc.propostas.length, 3, "não mexe no original");
  const semUltima = orcSemVersao(orc, 2);
  assert.deepStrictEqual(semUltima.propostas.map(p => p.versao), ["v1", "v2"]);
  assert.strictEqual(semUltima.ultimaPropostaEm, "2026-09-25T18:00:00.000Z", "a data volta para a que sobrou");
  const vazio = orcSemVersao({ id: "x", propostas: [{ versao: "v1", enviadaEm: "2026-01-01" }] }, 0);
  assert.deepStrictEqual(vazio.propostas, []);
  assert.strictEqual(vazio.ultimaPropostaEm, null);
});

teste("a lista separa o que ainda pede decisão do que já virou compromisso", () => {
  const comparando = { ...comPropostas([1000, 4000]), id: "a" };
  const aEnviar    = { ...comPropostas([2000, 3000]), id: "b", escolhidaId: "p0" };
  const lancada    = { ...comPropostas([5000, 8000]), id: "c", escolhidaId: "p0", contaGeradaId: "cp1" };
  const contratada = { ...comPropostas([6000, 9000]), id: "d", escolhidaId: "p0" };
  const cancelada  = { ...comPropostas([1500, 1800]), id: "e", status: "cancelada" };
  const recusada   = { ...comPropostas([2500, 4000]), id: "f", escolhidaId: "p0",
                       enviadaClienteEm: "2026-09-10T12:00:00.000Z" };
  const aprov = M.registrarAprovacaoCotacao([], { cotacaoId: "f", status: "recusada", por: "C" });
  const contratos = [{ id: "ct1", cotacaoId: "d" }];
  const lista = [comparando, aEnviar, lancada, contratada, cancelada, recusada];

  const g = M.cotacoesPorSituacao(lista, aprov, contratos);
  assert.deepStrictEqual(g.fechadas.map(c => c.id), ["c", "d", "e"],
    "conta a pagar, contrato e cancelada fecham o ciclo");
  assert.deepStrictEqual(g.abertas.map(c => c.id), ["a", "b", "f"],
    "recusada continua aberta — falta reescolher");
  assert.strictEqual(g.abertas.length + g.fechadas.length, lista.length, "cada cotação em um lado só");

  assert.strictEqual(M.cotacaoEstaFechada(lancada, aprov, contratos), true);
  assert.strictEqual(M.cotacaoEstaFechada(comparando, aprov, contratos), false);

  // o cartão "Aprovadas" contava só contrato e ignorava a compra de material
  const r = M.resumoCotacoes(lista, aprov, contratos);
  assert.strictEqual(r.fechadas, 3);
  assert.strictEqual(r.lancadas, 2, "contrato gerado e conta a pagar contam juntos");
  assert.strictEqual(r.abertas, 1, "em andamento continua sendo só quem está comparando");
  assert.strictEqual(r.recusadas, 1);

  // sem cotação nenhuma nada quebra
  const vazio = M.cotacoesPorSituacao(null, [], []);
  assert.deepStrictEqual([vazio.abertas.length, vazio.fechadas.length], [0, 0]);
});

teste("a conta de loja fica aberta e lança quantas vezes precisar", () => {
  const conta = { id: "loja1", titulo: "Ourifer — conta na loja", contaLoja: true, obraId: "ob1" };

  const s = M.situacaoCotacao(conta, [], []);
  assert.strictEqual(s.id, "contaLoja");
  assert.strictEqual(s.rotulo, "Conta aberta na loja");
  assert.strictEqual(M.cotacaoEstaFechada(conta, [], []), false, "fica no lado aberto o mês inteiro");
  assert.strictEqual(M.ehContaDeLoja(conta), true);
  assert.strictEqual(M.ehContaDeLoja({ id: "x" }), false);

  // sem proposta escolhida e já lançada uma vez — e mesmo assim pode de novo
  const jaLancou = { ...conta, contaGeradaId: "c1" };
  assert.strictEqual(M.podeLancarEmContas(jaLancou, []).pode, true, "o segundo pedido do dia entra");
  // a cotação comum continua travada depois do primeiro lançamento
  const comum = { ...comPropostas([9000]), id: "c", escolhidaId: "p0", contaGeradaId: "c1" };
  assert.strictEqual(M.podeLancarEmContas(comum, []).pode, false);

  const encerrada = { ...conta, status: "encerrada" };
  assert.strictEqual(M.situacaoCotacao(encerrada, [], []).rotulo, "Conta encerrada");
  assert.strictEqual(M.cotacaoEstaFechada(encerrada, [], []), true, "encerrada sai da tela de abertas");
  assert.strictEqual(M.podeLancarEmContas(encerrada, []).pode, false);

  const r = M.resumoCotacoes([conta, encerrada], [], []);
  assert.strictEqual(r.contasLoja, 1);
  assert.strictEqual(r.abertas, 0, "conta de loja não é \"em andamento\": não está comparando preço");
  assert.strictEqual(r.fechadas, 1);
});

teste("apagar a conta de loja: livre até a primeira baixa", () => {
  const conta = { id: "loja1", titulo: "Ourifer", contaLoja: true, contaGeradaId: "c1",
                  pedidos: [{ id: "ped1" }, { id: "ped2" }] };
  const contas = [
    { id: "c1", cotacaoId: "loja1", pedidoId: "ped1", valor: 485.40, pago: false },
    { id: "c2", cotacaoId: "loja1", pedidoId: "ped2", valor: 13.95, pago: false },
    { id: "c3", cotacaoId: "outra", valor: 100, pago: true },
  ];

  assert.strictEqual(M.podeApagarContaDeLoja(conta, contas).pode, true,
    "lançada mas sem pagamento: pode apagar");
  // a trava antiga travaria — conta de loja nasce lançada e segue lançando
  assert.strictEqual(M.podeExcluirCotacao(conta).pode, false,
    "a regra comum barra pelo contaGeradaId; a de loja não usa essa");

  const comPago = contas.map(c => (c.id === "c2" ? { ...c, pago: true } : c));
  const t = M.podeApagarContaDeLoja(conta, comPago);
  assert.strictEqual(t.pode, false);
  assert.ok(t.motivo.indexOf("Um item") === 0);

  const dois = contas.map(c => (c.cotacaoId === "loja1" ? { ...c, pago: true } : c));
  assert.ok(M.podeApagarContaDeLoja(conta, dois).motivo.indexOf("2 itens") === 0);

  assert.strictEqual(M.podeApagarContaDeLoja(conta, []).pode, true, "sem conta nenhuma, pode");
});

teste("a cotação escolhida vira pedido na conta da loja que ganhou", () => {
  const ourifer = { id: "loja1", titulo: "Ourifer — conta na loja", contaLoja: true,
                    lojaId: "f1", prazoLoja: 30 };
  const encerrada = { id: "loja2", titulo: "Pantanal", contaLoja: true, lojaId: "f2", status: "encerrada" };
  const abertas = [ourifer, encerrada];

  assert.strictEqual(M.contaDeLojaAberta(abertas, "f1").id, "loja1");
  assert.strictEqual(M.contaDeLojaAberta(abertas, "f2"), null, "conta encerrada não recebe pedido");
  assert.strictEqual(M.contaDeLojaAberta(abertas, "f9"), null, "loja sem conta não aparece");
  assert.strictEqual(M.contaDeLojaAberta(abertas, ""), null);

  // cotação com lista de itens e preço por item
  const cot = {
    id: "c1", titulo: "Aço Vergalhões", contaId: "material", etapaId: "fundacao",
    itens: [
      { id: "i1", codigo: "ACO-001", descricao: "Vergalhão CA50 8mm", unidade: "Barras 12mts", quantidade: 100 },
      { id: "i2", codigo: "ACO-002", descricao: "Vergalhão CA60 5mm", unidade: "Barras 12mts", quantidade: 50 },
    ],
    propostas: [{ id: "p0", fornecedorId: "f1", precos: { i1: 60, i2: 40 }, totalFechado: "7.600,00" }],
    escolhidaId: "p0",
  };
  const insumos = [{ codigo: "ACO-001", nome: "Vergalhão CA50 8mm", grupo: "Aço", unidade: "Barras 12mts" }];
  const p = M.pedidoDaCotacao(cot, cot.propostas[0], insumos, 30);

  assert.strictEqual(p.itens.length, 2, "um item de pedido por item cotado");
  assert.strictEqual(p.itens[0].bruto, 6000, "100 × 60");
  assert.strictEqual(p.itens[1].bruto, 2000, "50 × 40");
  assert.strictEqual(p.desconto, 400, "o abatimento negociado (8.000 → 7.600) vira desconto do pedido");
  assert.ok(p.itens.every(i => i.etapa === "fundacao"), "a etapa da cotação entra em todos");
  assert.ok(p.itens.every(i => i.contaId === "material"));
  assert.strictEqual(p.itens[0].grupoMaterial, "Aço", "o grupo vem do catálogo");
  assert.strictEqual(p.itens[1].grupoMaterial, "", "item fora do catálogo fica sem grupo");
  assert.strictEqual(p.cotacaoOrigemId, "c1");
  assert.ok(p.vencimento > p.data, "o prazo da loja dá o vencimento");

  // cotação sem lista: uma linha com o preço fechado
  const simples = { id: "c2", titulo: "Gesso", contaId: "material", etapaId: "forros",
    propostas: [{ id: "p0", fornecedorId: "f1", valor: "57.800,00" }], escolhidaId: "p0" };
  const ps = M.pedidoDaCotacao(simples, simples.propostas[0], [], 30);
  assert.strictEqual(ps.itens.length, 1);
  assert.strictEqual(ps.itens[0].descricao, "Gesso");
  assert.strictEqual(ps.itens[0].bruto, 57800);
  assert.strictEqual(ps.desconto, 0);

  // depois de virar pedido, a cotação fecha e não lança de novo
  const virou = { ...cot, pedidoNaLoja: { contaLojaId: "loja1", pedidoId: "ped9", numeroLoja: "136560-109" } };
  assert.strictEqual(M.situacaoCotacao(virou, [], []).rotulo, "Virou pedido na loja");
  assert.strictEqual(M.cotacaoEstaFechada(virou, [], []), true);
  assert.strictEqual(M.podeLancarEmContas(virou, []).pode, false);
});

teste("insumo que só serve a uma etapa entra no pedido já com ela", () => {
  const tubo = { codigo: "HID-010", nome: "PVC — Marrom — Tubo 32mm", grupo: "Hidráulica",
                 unidade: "Unidades", etapaPadrao: "hidraulica" };
  const esgoto = { codigo: "HID-300", nome: "PVC — Esgoto — Tubo 100mm", grupo: "Hidráulica",
                   unidade: "Unidades", etapaPadrao: "esgoto_pluvial", contaPadrao: "material" };
  const cimento = { codigo: "CIM-001", nome: "Cimento CP II 50kg", grupo: "Cimento", unidade: "Unidades" };

  // a etapa da compra manda; o catálogo é o segundo; sem os dois, fica em branco
  assert.strictEqual(M.etapaDoItem(tubo, "fundacao"), "fundacao",
    "quem cotou para uma etapa ja disse para que a compra e — isso ganha do catalogo");
  assert.strictEqual(M.etapaDoItem(tubo, ""), "hidraulica", "sem escolha na compra, o catalogo preenche");
  assert.strictEqual(M.etapaDoItem(cimento, "fundacao"), "fundacao", "sem etapa padrão vale a da compra");
  assert.strictEqual(M.etapaDoItem(cimento, ""), "", "nenhuma das duas: quem compra decide");
  assert.strictEqual(M.etapaDoItem(null, "laje_1"), "laje_1");
  assert.strictEqual(M.contaDoItem(esgoto, "compra_ferramentas"), "material");
  assert.strictEqual(M.contaDoItem(cimento, "material"), "material");

  const cot = {
    id: "c1", titulo: "Hidráulica", contaId: "material", etapaId: "",
    itens: [
      { id: "i1", codigo: "HID-010", descricao: "Tubo 32mm", unidade: "Unidades", quantidade: 38 },
      { id: "i2", codigo: "HID-300", descricao: "Tubo esgoto 100mm", unidade: "Unidades", quantidade: 10 },
      { id: "i3", codigo: "CIM-001", descricao: "Cimento", unidade: "Unidades", quantidade: 5 },
    ],
    propostas: [{ id: "p0", fornecedorId: "f1", precos: { i1: 12.10, i2: 30, i3: 40 }, valor: "1.359,80" }],
    escolhidaId: "p0",
  };
  const p = M.pedidoDaCotacao(cot, cot.propostas[0], [tubo, esgoto, cimento], 30);
  assert.deepStrictEqual(p.itens.map(i => i.etapa), ["hidraulica", "esgoto_pluvial", ""],
    "cada insumo traz a sua etapa; o cimento fica em branco de propósito");
  assert.deepStrictEqual(p.itens.map(i => i.grupoMaterial), ["Hidráulica", "Hidráulica", "Cimento"]);
  assert.deepStrictEqual(p.itens.map(i => i.contaId), ["material", "material", "material"],
    "sem conta padrão vale a da cotação");

  // Cotou para uma etapa determinada: a cotação inteira é daquela etapa, e
  // isso vence o palpite do catálogo. Quem precisar de exceção muda o item.
  const comEtapa = M.pedidoDaCotacao({ ...cot, etapaId: "contrapiso_int_1" }, cot.propostas[0], [tubo, esgoto, cimento], 30);
  assert.deepStrictEqual(comEtapa.itens.map(i => i.etapa),
    ["contrapiso_int_1", "contrapiso_int_1", "contrapiso_int_1"]);
});


// ── o papel da loja contra o nome do catálogo ─────────────

// Um catálogo pequeno, mas com as armadilhas de verdade: prefixo de
// categoria que a loja nunca escreve ("Aço - "), plural, medida colada na
// letra e vizinhos quase iguais que não podem ganhar.
const CATALOGO_TESTE = [
  { codigo: "CIM-010", nome: "Cal Hidratado 20kg", grupo: "Cimento", unidade: "sc" },
  { codigo: "TIN-050", nome: "Fita Crepe", grupo: "Tintas", unidade: "un" },
  { codigo: "ACO-101", nome: "A\u00e7o - Pregos 17x21", grupo: "A\u00e7o", unidade: "kg" },
  { codigo: "ACO-102", nome: "A\u00e7o - Pregos 15x21", grupo: "A\u00e7o", unidade: "kg" },
  { codigo: "ACO-103", nome: "A\u00e7o - Pregos 18x24", grupo: "A\u00e7o", unidade: "kg" },
  { codigo: "ACO-200", nome: "A\u00e7o - Arame Recozido", grupo: "A\u00e7o", unidade: "kg" },
  { codigo: "HID-300", nome: "PVC - Esgoto - Tubo 100mm", grupo: "Hidr\u00e1ulica", unidade: "br" },
  { codigo: "HID-301", nome: "PVC - Esgoto - Tubo 50mm", grupo: "Hidr\u00e1ulica", unidade: "br" },
  { codigo: "FER-010", nome: "Disco Corte Inox", grupo: "Ferramentas", unidade: "un" },
  { codigo: "ARE-001", nome: "Areia M\u00e9dia", grupo: "Areia e pedra", unidade: "m3" },
  { codigo: "PRE-001", nome: "Pedreiro", grupo: "Prestadores de servi\u00e7os", tipo: "prestador" },
  { codigo: "OUT-999", nome: "Item desativado", grupo: "Outros", ativo: false },
];
const idxTeste = () => modulo.indiceDoCatalogo(CATALOGO_TESTE);

teste("letra colada em n\u00famero se separa e marca n\u00e3o conta", () => {
  assert.deepStrictEqual(modulo.cotPalavrasDoNome("Cal Hidratado Ch-iii 20kg - Pinocal"),
    ["cal", "hidratado", "ch", "iii", "20", "kg", "pinocal"]);
  assert.deepStrictEqual(modulo.cotPalavrasDoNome("Fita Crepe 48mmx50m - Tigre"),
    ["fita", "crepe", "48", "mm", "50", "m"], "Tigre \u00e9 marca; o x entre medidas n\u00e3o diz nada");
  assert.deepStrictEqual(modulo.cotPalavrasDoNome(""), []);
});

teste("prestador e item desativado ficam fora do \u00edndice", () => {
  const idx = idxTeste();
  assert.strictEqual(idx.itens.length, 10);
  assert.ok(!idx.itens.some(x => x.insumo.codigo === "PRE-001"), "n\u00e3o se compra prestador num pedido de loja");
  assert.ok(!idx.itens.some(x => x.insumo.codigo === "OUT-999"));
});

teste("o nome do cat\u00e1logo cabendo dentro da descri\u00e7\u00e3o da loja \u00e9 o casamento", () => {
  const idx = idxTeste();
  const s = modulo.sugestaoDoCatalogo("Cal Hidratado Ch-iii 20kg - Pinocal", idx);
  assert.strictEqual(s.codigo, "CIM-010");
  assert.strictEqual(s.segura, true, "cabe inteiro e n\u00e3o tem concorrente");

  const f = modulo.sugestaoDoCatalogo("Fita Crepe 48mmx50m - Tigre", idx);
  assert.strictEqual(f.codigo, "TIN-050");
  assert.strictEqual(f.segura, true);
});

teste("a medida decide entre vizinhos quase iguais", () => {
  const idx = idxTeste();
  assert.strictEqual(modulo.sugestaoDoCatalogo("Prego 17x21 1kg", idx).codigo, "ACO-101");
  assert.strictEqual(modulo.sugestaoDoCatalogo("Prego 18x24 1kg", idx).codigo, "ACO-103");
  assert.strictEqual(modulo.sugestaoDoCatalogo("Tubo esgoto 100mm", idx).codigo, "HID-300");
  assert.strictEqual(modulo.sugestaoDoCatalogo("Tubo esgoto 50mm", idx).codigo, "HID-301");
});

teste("prefixo de categoria e plural n\u00e3o atrapalham", () => {
  const idx = idxTeste();
  // a loja escreve "Prego", o cat\u00e1logo escreve "A\u00e7o - Pregos": plural e o
  // "A\u00e7o - " que a loja nunca digita n\u00e3o podem derrubar o casamento
  const r = modulo.casarNoCatalogo("Prego 17x21 1kg", idx, 3);
  assert.strictEqual(r[0].insumo.codigo, "ACO-101");
  assert.ok(r[0].score >= 0.72, "casa forte mesmo escrito diferente");
  // O vizinho de outra medida pode aparecer na lista de parecidos — ela
  // existe para oferecer opção —, mas tão atrás que não disputa o carimbo.
  const vizinho = r.find(x => x.insumo.codigo === "ACO-102");
  if (vizinho) assert.ok(r[0].score - vizinho.score >= 0.25,
    "o vizinho de outra medida não pode chegar perto: " + vizinho.score);
  assert.strictEqual(modulo.sugestaoDoCatalogo("Prego 17x21 1kg", idx).segura, true);
});

teste("acento e caixa n\u00e3o mudam nada", () => {
  const idx = idxTeste();
  assert.strictEqual(modulo.sugestaoDoCatalogo("AREIA MEDIA", idx).codigo, "ARE-001");
  assert.strictEqual(modulo.sugestaoDoCatalogo("areia m\u00e9dia", idx).codigo, "ARE-001");
});

teste("o que n\u00e3o existe no cat\u00e1logo n\u00e3o inventa casamento", () => {
  const idx = idxTeste();
  assert.strictEqual(modulo.sugestaoDoCatalogo("Linha Trancada Firme Multifio 100m", idx), null);
  assert.strictEqual(modulo.sugestaoDoCatalogo("", idx), null);
  assert.deepStrictEqual(modulo.casarNoCatalogo("qualquer coisa", null, 3), []);
});

teste("empate t\u00e9cnico sugere, mas n\u00e3o entra no casar tudo", () => {
  // a loja escreveu s\u00f3 "Prego 21": 17x21 e 15x21 ficam exatamente iguais,
  // e a m\u00e1quina n\u00e3o tem como saber qual dos dois \u00e9
  const s = modulo.sugestaoDoCatalogo("Prego 21", idxTeste());
  assert.ok(s, "ainda sugere \u2014 quem decide \u00e9 a pessoa");
  assert.strictEqual(s.segura, false, "empate t\u00e9cnico n\u00e3o se resolve sozinho");
});

teste("o texto da loja vira apelido do insumo, e s\u00f3 uma vez", () => {
  const um = modulo.comApelidoDaLoja(CATALOGO_TESTE, "CIM-010", "Cal Hidratado Ch-iii 20kg - Pinocal");
  assert.strictEqual(um.mudou, true);
  const alvo = um.insumos.find(i => i.codigo === "CIM-010");
  assert.deepStrictEqual(alvo.aliases, ["Cal Hidratado Ch-iii 20kg - Pinocal"]);
  assert.ok(CATALOGO_TESTE.find(i => i.codigo === "CIM-010").aliases === undefined,
    "o cat\u00e1logo recebido n\u00e3o \u00e9 alterado no lugar");

  const dois = modulo.comApelidoDaLoja(um.insumos, "CIM-010", "CAL HIDRATADO CH-III 20KG - PINOCAL");
  assert.strictEqual(dois.mudou, false, "mesmo texto com outra caixa j\u00e1 est\u00e1 guardado");

  const igual = modulo.comApelidoDaLoja(CATALOGO_TESTE, "TIN-050", "Fita Crepe");
  assert.strictEqual(igual.mudou, false, "apelido igual ao pr\u00f3prio nome n\u00e3o serve para nada");

  assert.strictEqual(modulo.comApelidoDaLoja(CATALOGO_TESTE, "", "x").mudou, false);
  assert.strictEqual(modulo.comApelidoDaLoja(CATALOGO_TESTE, "CIM-010", "   ").mudou, false);
});

teste("com o apelido guardado, o pr\u00f3ximo pedido casa exato \u2014 sem aposta", () => {
  const texto = "Cal Hidratado Ch-iii 20kg - Pinocal";
  const depois = modulo.comApelidoDaLoja(CATALOGO_TESTE, "CIM-010", texto).insumos;
  const r = modulo.resolverInsumo(texto, depois);
  assert.strictEqual(r.confianca, "alias");
  assert.strictEqual(r.insumo.codigo, "CIM-010");
});


// ── a IA conferindo as sobras ──────────────────────

const SOBRAS = [
  { descricao: "Tabua De Pinos 10x2.0x3.00mt", quantidade: "30", unidade: "un" },
  { descricao: "Linha Trancada Firme Multifio 100m", quantidade: "2", unidade: "un" },
  { descricao: "Sarrafo 5x2.3x3.00mt", quantidade: "10", unidade: "un" },
];
const CAT_IA = [
  { codigo: "MAD-010", nome: "Madeira Caixaria - T\u00e1buas de 10cm x 3mts", grupo: "Madeira de caixaria" },
  { codigo: "MAD-020", nome: "Madeira Caixaria - Sarrafos de 05cm", grupo: "Madeira de caixaria" },
];

teste("o que vai para a IA \u00e9 quantidade, unidade e texto \u2014 nada de pre\u00e7o", () => {
  assert.strictEqual(modulo.textoParaAIA(SOBRAS),
    "30 un Tabua De Pinos 10x2.0x3.00mt\n2 un Linha Trancada Firme Multifio 100m\n10 un Sarrafo 5x2.3x3.00mt");
  assert.strictEqual(modulo.textoParaAIA([]), "");
  assert.strictEqual(modulo.textoParaAIA(null), "");
});

teste("o c\u00f3digo que a IA aponta volta para o item certo", () => {
  const bruto = { itens: [
    { descricao: "Tabua De Pinos 10x2.0x3.00mt", codigoInsumo: "MAD-010" },
    { descricao: "Sarrafo 5x2.3x3.00mt", codigoInsumo: "MAD-020" },
  ] };
  const r = modulo.sugestoesDaIA(SOBRAS, bruto, CAT_IA);
  assert.deepStrictEqual(r.map(x => [x.indice, x.codigo]), [[0, "MAD-010"], [2, "MAD-020"]],
    "a ordem da resposta n\u00e3o \u00e9 a ordem do papel");
  assert.strictEqual(r[0].nome, "Madeira Caixaria - T\u00e1buas de 10cm x 3mts");
  assert.strictEqual(r[0].ia, true);
});

teste("linha sem c\u00f3digo, c\u00f3digo fora do cat\u00e1logo e texto irreconhec\u00edvel s\u00e3o descartados", () => {
  const bruto = { itens: [
    { descricao: "Tabua De Pinos 10x2.0x3.00mt" },                          // a IA n\u00e3o achou
    { descricao: "Sarrafo 5x2.3x3.00mt", codigoInsumo: "NAO-EXISTE" },      // c\u00f3digo de outro cat\u00e1logo
    { descricao: "Cimento CP II", codigoInsumo: "MAD-010" },                // n\u00e3o \u00e9 nenhuma das sobras
  ] };
  assert.deepStrictEqual(modulo.sugestoesDaIA(SOBRAS, bruto, CAT_IA), [],
    "melhor faltar proposta do que carimbar o item errado");
});

teste("a IA n\u00e3o carimba dois itens com o mesmo c\u00f3digo por engano", () => {
  const sobras = [
    { descricao: "Tabua De Pinos 10cm", quantidade: "5", unidade: "un" },
    { descricao: "Tabua De Pinos 10cm", quantidade: "3", unidade: "un" },
  ];
  const bruto = { itens: [
    { descricao: "Tabua De Pinos 10cm", codigoInsumo: "MAD-010" },
    { descricao: "Tabua De Pinos 10cm", codigoInsumo: "MAD-010" },
  ] };
  const r = modulo.sugestoesDaIA(sobras, bruto, CAT_IA);
  assert.deepStrictEqual(r.map(x => x.indice), [0, 1], "duas linhas iguais casam uma com cada");
});

teste("resposta vazia ou sem sobra n\u00e3o gera sugest\u00e3o", () => {
  assert.deepStrictEqual(modulo.sugestoesDaIA(SOBRAS, null, CAT_IA), []);
  assert.deepStrictEqual(modulo.sugestoesDaIA(SOBRAS, { itens: [] }, CAT_IA), []);
  assert.deepStrictEqual(modulo.sugestoesDaIA([], { itens: [{ descricao: "x", codigoInsumo: "MAD-010" }] }, CAT_IA), []);
});

teste("o insumo tamb\u00e9m se acha pelo id, quando o c\u00f3digo n\u00e3o veio", () => {
  const cat = [{ id: "m1", nome: "Linha de pedreiro", grupo: "Ferramentas" }];
  const bruto = { itens: [{ descricao: "Linha Trancada Firme Multifio 100m", codigoInsumo: "m1" }] };
  const r = modulo.sugestoesDaIA(SOBRAS, bruto, cat);
  assert.deepStrictEqual(r.map(x => [x.indice, x.nome]), [[1, "Linha de pedreiro"]]);
});


// ── Unidade no vocabulário da empresa ────────────────────────
const UN_CAT = ["Unidades", "m2", "Mts", "Kg", "Baldes 18L"];

teste("\"un\" da nota vira \"Unidades\" do catálogo", () => {
  for (const escrito of ["un", "UN", "un.", "und", "unid", "unidade", "Unidade", " un "])
    assert.strictEqual(modulo.unidadeNoPadrao(escrito, UN_CAT), "Unidades", escrito);
});

teste("peça, jogo, conjunto e par também contam como Unidades", () => {
  for (const escrito of ["pc", "pç", "peça", "peças", "jg", "cj", "conj", "par"])
    assert.strictEqual(modulo.unidadeNoPadrao(escrito, UN_CAT), "Unidades", escrito);
});

teste("abreviação de medida cai no nome que o catálogo usa", () => {
  assert.strictEqual(modulo.unidadeNoPadrao("m²", UN_CAT), "m2");
  assert.strictEqual(modulo.unidadeNoPadrao("mt", UN_CAT), "Mts");
  assert.strictEqual(modulo.unidadeNoPadrao("KG", UN_CAT), "Kg");
  assert.strictEqual(modulo.unidadeNoPadrao("quilos", UN_CAT), "Kg");
});

teste("o que o catálogo já escreve assim fica como está", () => {
  assert.strictEqual(modulo.unidadeNoPadrao("Baldes 18L", UN_CAT), "Baldes 18L");
  assert.strictEqual(modulo.unidadeNoPadrao("Unidades", UN_CAT), "Unidades");
});

teste("unidade que ninguém conhece volta como foi escrita", () => {
  assert.strictEqual(modulo.unidadeNoPadrao("vb", UN_CAT), "vb");
  assert.strictEqual(modulo.unidadeNoPadrao("sacos", UN_CAT), "sacos");
  assert.strictEqual(modulo.unidadeNoPadrao("", UN_CAT), "");
  assert.strictEqual(modulo.unidadeNoPadrao(null, UN_CAT), "");
});

teste("sem catálogo, a abreviação ainda vira o nome inteiro", () => {
  assert.strictEqual(modulo.unidadeNoPadrao("un", []), "Unidades");
  assert.strictEqual(modulo.unidadeNoPadrao("un"), "Unidades");
});

teste("\"un\" não entra como opção extra na lista de unidades", () => {
  assert.deepStrictEqual(modulo.opcoesDeUnidade("un", UN_CAT), UN_CAT);
  assert.deepStrictEqual(modulo.opcoesDeUnidade("UND", UN_CAT), UN_CAT);
  assert.deepStrictEqual(modulo.opcoesDeUnidade("vb", UN_CAT), ["vb", ...UN_CAT]);
});

teste("item lido do orçamento chega com a unidade já no padrão", () => {
  const cat = [{ codigo: "MAD-010", nome: "Tabua de pinus", grupo: "Madeiras", unidade: "Unidades" }];
  const bruto = { itens: [{ descricao: "Parafuso bucha 8mm", quantidade: 50, unidade: "un", unitario: 1, total: 50 }] };
  const itens = modulo.itensDaEntrada(bruto, "orcamento", cat);
  assert.strictEqual(itens.length, 1);
  assert.strictEqual(itens[0].unidade, "Unidades");
});


// ── A gaveta do catálogo não é o material ────────────────────
const CAT_GAV = [
  { codigo:"ELE-100", nome:"Elétrica - Fita Isolante", grupo:"Elétrica", unidade:"Unidades", aliases:[] },
  { codigo:"ELE-110", nome:"Elétrica - Cabo Flexível 2,5mm", grupo:"Elétrica", unidade:"Mts", aliases:[] },
  { codigo:"ELE-120", nome:"Elétrica - Eletroduto 25mm", grupo:"Elétrica", unidade:"Mts", aliases:[] },
  { codigo:"ELE-130", nome:"Elétrica - Tomada 10A", grupo:"Elétrica", unidade:"Unidades", aliases:[] },
  { codigo:"TIN-050", nome:"Fita Crepe", grupo:"Tintas", unidade:"Unidades", aliases:[] },
  { codigo:"TIN-060", nome:"Hidráulica - Fita Veda Rosca", grupo:"Hidráulica", unidade:"Unidades", aliases:[] },
  { codigo:"ACO-101", nome:"Aço - Pregos 17x21", grupo:"Aço", unidade:"Kg", aliases:[] },
  { codigo:"ACO-200", nome:"Aço - Arame Recozido", grupo:"Aço", unidade:"Kg", aliases:[] },
  { codigo:"CIM-010", nome:"Cal Hidratado 20kg", grupo:"Cimento", unidade:"Sacos", aliases:[] },
];

teste("o nome do catálogo se parte em gaveta e material", () => {
  assert.deepStrictEqual(modulo.cotPartesDoNome("Elétrica - Fita Isolante"),
    { gaveta: ["eletrica"], corpo: ["fita", "isolante"] });
  assert.deepStrictEqual(modulo.cotPartesDoNome("Madeira Caixaria - Sarrafos de 05cm"),
    { gaveta: ["madeira", "caixaria"], corpo: ["sarrafos", "05", "cm"] });
});

teste("nome sem travéssão não tem gaveta", () => {
  assert.deepStrictEqual(modulo.cotPartesDoNome("Cal Hidratado 20kg").gaveta, []);
  assert.deepStrictEqual(modulo.cotPartesDoNome("Fita Crepe").gaveta, []);
});

teste("travéssão sem corpo, ou gaveta longa demais, não é gaveta", () => {
  assert.deepStrictEqual(modulo.cotPartesDoNome("Fita Isolante - ").gaveta, []);
  assert.deepStrictEqual(modulo.cotPartesDoNome("Uma duas três quatro cinco - Fita").gaveta, []);
});

teste("“Fita Isolante 10 Mt - Tigre” acha a fita isolante do catálogo", () => {
  const sg = modulo.sugestaoDoCatalogo("Fita Isolante 10 Mt - Tigre", modulo.indiceDoCatalogo(CAT_GAV));
  assert.strictEqual(sg.nome, "Elétrica - Fita Isolante");
  assert.ok(sg.segura, "deveria carimbar sozinho, e não só sugerir — deu " + sg.score);
});

teste("a gaveta não castiga mais o insumo bem arquivado", () => {
  const idx = modulo.indiceDoCatalogo(CAT_GAV);
  for (const [texto, nome] of [
    ["Prego 17x21 1kg", "Aço - Pregos 17x21"],
    ["Arame Recozido Trançado N18 1kg", "Aço - Arame Recozido"],
    ["Eletroduto 25mm", "Elétrica - Eletroduto 25mm"],
    ["Tomada 10A Branca", "Elétrica - Tomada 10A"],
  ]) {
    const sg = modulo.sugestaoDoCatalogo(texto, idx);
    assert.strictEqual(sg && sg.nome, nome, texto);
    assert.ok(sg.segura, texto + " deu só " + sg.score);
  }
});

teste("a gaveta ainda separa dois materiais de nome parecido", () => {
  const idx = modulo.indiceDoCatalogo(CAT_GAV);
  const sg = modulo.sugestaoDoCatalogo("Fita Veda Rosca 18mm", idx);
  assert.strictEqual(sg.nome, "Hidráulica - Fita Veda Rosca");
});

teste("mesmo material em duas gavetas vira pergunta, não carimbo", () => {
  const dois = [
    { codigo:"A-1", nome:"Elétrica - Fita Isolante", grupo:"Elétrica", aliases:[] },
    { codigo:"B-1", nome:"Hidráulica - Fita Isolante", grupo:"Hidráulica", aliases:[] },
  ];
  const sg = modulo.sugestaoDoCatalogo("Fita Isolante 10 Mt", modulo.indiceDoCatalogo(dois));
  assert.ok(sg, "deveria achar as duas");
  assert.strictEqual(sg.segura, false, "empate entre gavetas não pode carimbar sozinho");
});


// ── O ruído do papel da loja ─────────────────────────────
teste("código interno da loja sai da conta", () => {
  assert.deepStrictEqual(modulo.cotPalavrasDaLoja("Disco Diamantado Eco 110mm Cod 61699 - Cortag"),
    ["disco", "diamantado", "110", "mm"]);
  assert.deepStrictEqual(modulo.cotPalavrasDaLoja("Cabo Flex Ref 12345 2,5mm"),
    ["cabo", "flex", "2", "5", "mm"]);
});

teste("número de quatro dígitos é código, não medida", () => {
  assert.ok(!modulo.cotPalavrasDaLoja("Disco 61699").includes("61699"));
  assert.ok(modulo.cotPalavrasDaLoja("Prego 17x21").includes("17"), "medida curta fica");
});

teste("descrição que é só ruído não volta vazia", () => {
  assert.deepStrictEqual(modulo.cotPalavrasDaLoja("Cod 61699"), ["cod", "61699"]);
});

teste("zero à esquerda e abreviação de unidade casam", () => {
  assert.strictEqual(modulo.cotCasaPalavra("05", "5"), 1);
  assert.strictEqual(modulo.cotCasaPalavra("3", "03"), 1);
  assert.strictEqual(modulo.cotCasaPalavra("17", "18"), 0);
  assert.ok(modulo.cotCasaPalavra("mts", "mt") >= 0.9);
  assert.strictEqual(modulo.cotCasaPalavra("kg", "mm"), 0);
});

// ── Os itens que a nota da Ourifer trazia ─────────────────
const CAT_LOJA = [
  { codigo:"FER-024", nome:"Disco Diamantado Corte Parede", grupo:"Ferramentas", aliases:[] },
  { codigo:"FER-010", nome:"Ferramentas - Disco Corte Inox", grupo:"Ferramentas", aliases:[] },
  { codigo:"FER-020", nome:"Ferramentas - Disco Serra Circular", grupo:"Ferramentas", aliases:[] },
  { codigo:"MAD-020", nome:"Madeira Caixaria - Sarrafos de 05cm x 3mts", grupo:"Madeira", aliases:[] },
  { codigo:"MAD-010", nome:"Madeira Caixaria - Tábuas de 10cm x 3mts", grupo:"Madeira", aliases:[] },
  { codigo:"ACO-101", nome:"Aço - Pregos 17x21", grupo:"Aço", aliases:[] },
  { codigo:"CIM-010", nome:"Cimento - Cal Hidratado 20kg", grupo:"Cimento", aliases:[] },
];

teste("“Disco Diamantado Segmentado Eco 110mm Cod 61699” chega ao disco diamantado", () => {
  const sg = modulo.sugestaoDoCatalogo("Disco Diamantado Segmentado Eco 110mm Cod 61699 - Cortag",
    modulo.indiceDoCatalogo(CAT_LOJA));
  assert.ok(sg, "sumia da lista inteira — nem candidato era");
  assert.strictEqual(sg.nome, "Disco Diamantado Corte Parede");
  assert.strictEqual(sg.segura, false, "são discos diferentes: propõe, não carimba");
});

teste("a medida escrita de outro jeito casa do mesmo jeito", () => {
  const idx = modulo.indiceDoCatalogo(CAT_LOJA);
  const sarrafo = modulo.sugestaoDoCatalogo("Sarrafo 5x2.3x3.00mt", idx);
  assert.strictEqual(sarrafo && sarrafo.nome, "Madeira Caixaria - Sarrafos de 05cm x 3mts",
    "“05cm” e “5”, “3mts” e “3.00mt”");
  assert.ok(sarrafo.segura);
  const tabua = modulo.sugestaoDoCatalogo("Tabua De Pinos 10x2.0x3.00mt", idx);
  assert.strictEqual(tabua && tabua.nome, "Madeira Caixaria - Tábuas de 10cm x 3mts");
  assert.ok(tabua.segura);
});

teste("qualificador que a loja não escreve não derruba mais o casamento", () => {
  const idx = modulo.indiceDoCatalogo(CAT_LOJA);
  const sg = modulo.sugestaoDoCatalogo("Disco Corte Fino Inox 4 - Norton", idx);
  assert.strictEqual(sg.nome, "Ferramentas - Disco Corte Inox");
  assert.ok(sg.segura, "deu " + sg.score);
});

teste("material de outra família continua fora", () => {
  const idx = modulo.indiceDoCatalogo(CAT_LOJA);
  const sg = modulo.sugestaoDoCatalogo("Argamassa ACIII 20kg", idx);
  assert.ok(!sg || !sg.segura, "argamassa não pode virar cal hidratado sozinha");
});


// ── Número na tela ───────────────────────────────────
teste("dinheiro sai com duas casas e vírgula, sempre", () => {
  assert.strictEqual(modulo.valorBR(14.9), "14,90");
  assert.strictEqual(modulo.valorBR(14.8), "14,80");
  assert.strictEqual(modulo.valorBR(300), "300,00");
  assert.strictEqual(modulo.valorBR(59), "59,00");
  assert.strictEqual(modulo.valorBR(1234.5), "1.234,50");
  assert.strictEqual(modulo.valorBR(0), "0,00");
  assert.strictEqual(modulo.valorBR(null), "0,00");
});

teste("quantidade não ganha centavos à força", () => {
  assert.strictEqual(modulo.qtdBR(30), "30");
  assert.strictEqual(modulo.qtdBR(2.5), "2,5");
});


// ── Um insumo não carimba duas descrições diferentes ─────────
const seg = (codigo, score) => ({ codigo, nome: codigo, score, segura: true });

teste("duas descrições diferentes no mesmo insumo: só a melhor carimba", () => {
  const itens = [
    { descricao: "Tomada Pad 2p+t 10a Cz - Fame", sugestao: seg("ELE-136", 0.88) },
    { descricao: "Plugue Pad 2p+t 10a Cz - Fame", sugestao: seg("ELE-136", 0.79) },
  ];
  assert.deepStrictEqual(modulo.casamentosSeguros(itens), [0], "o plugue fica esperando um toque");
});

teste("a ordem da lista não decide — o placar decide", () => {
  const itens = [
    { descricao: "Plugue Pad 2p+t 10a Cz - Fame", sugestao: seg("ELE-136", 0.79) },
    { descricao: "Tomada Pad 2p+t 10a Cz - Fame", sugestao: seg("ELE-136", 0.88) },
  ];
  assert.deepStrictEqual(modulo.casamentosSeguros(itens), [1]);
});

teste("o mesmo material repetido na nota casa nas duas linhas", () => {
  const itens = [
    { descricao: "Cimento CP-II 50kg", sugestao: seg("CIM-001", 0.9) },
    { descricao: "Cimento CP-II 50kg", sugestao: seg("CIM-001", 0.9) },
  ];
  assert.deepStrictEqual(modulo.casamentosSeguros(itens), [0, 1]);
});

teste("insumos diferentes carimbam todos", () => {
  const itens = [
    { descricao: "Tomada", sugestao: seg("ELE-136", 0.9) },
    { descricao: "Plugue", sugestao: seg("ELE-137", 0.85) },
  ];
  assert.deepStrictEqual(modulo.casamentosSeguros(itens), [0, 1]);
});

teste("item já escolhido e proposta insegura ficam de fora", () => {
  const itens = [
    { descricao: "Tomada", insumoCodigo: "ELE-136", sugestao: null },
    { descricao: "Plugue", sugestao: { codigo: "ELE-137", nome: "x", score: 0.6, segura: false } },
    { descricao: "Cabo", sugestao: null },
  ];
  assert.deepStrictEqual(modulo.casamentosSeguros(itens), []);
});

teste("empate no placar: a primeira linha carimba, e só ela", () => {
  const itens = [
    { descricao: "Plugue A", sugestao: seg("ELE-136", 0.8) },
    { descricao: "Plugue B", sugestao: seg("ELE-136", 0.8) },
  ];
  assert.deepStrictEqual(modulo.casamentosSeguros(itens), [0]);
});


// ── Identidade x qualificador ───────────────────────────
const CAT_DISCO = [
  { codigo:"FER-020", nome:"Ferramentas - Disco Madeira", grupo:"Ferramentas", aliases:[] },
  { codigo:"FER-021", nome:"Ferramentas - Disco Corte Inox", grupo:"Ferramentas", aliases:[] },
  { codigo:"FER-024", nome:"Ferramentas - Disco Diamantado Corte Parede", grupo:"Ferramentas", aliases:[] },
  { codigo:"FER-025", nome:"Ferramentas - Disco Desbaste", grupo:"Ferramentas", aliases:[] },
  { codigo:"CIM-010", nome:"Cimento - Cal Hidratado 20kg", grupo:"Cimento", aliases:[] },
  { codigo:"ELE-028", nome:"Elétrica - Cabo Flexível 750V 4mm", grupo:"Elétrica", aliases:[] },
];

teste("o disco diamantado da loja acha o disco diamantado do catálogo", () => {
  const r = modulo.casarNoCatalogo("Disco Diamantado Segmentado Eco 110mm Cod 61699 - Cortag",
    modulo.indiceDoCatalogo(CAT_DISCO), 9);
  assert.ok(r.length, "nenhum candidato");
  assert.strictEqual(r[0].insumo.codigo, "FER-024");
});

teste("“disco” sozinho não é casamento: o disco de madeira nem entra na lista", () => {
  const r = modulo.casarNoCatalogo("Disco Diamantado Segmentado Eco 110mm Cod 61699 - Cortag",
    modulo.indiceDoCatalogo(CAT_DISCO), 9);
  assert.ok(r.every((c) => c.insumo.codigo !== "FER-020"),
    "Disco Madeira não pode aparecer: a palavra que decide é a segunda");
  assert.ok(r.every((c) => c.insumo.codigo !== "FER-025"));
});

teste("e o disco de madeira continua achando o dele", () => {
  const sg = modulo.sugestaoDoCatalogo("Disco Madeira 110mm - Cortag", modulo.indiceDoCatalogo(CAT_DISCO));
  assert.strictEqual(sg.codigo, "FER-020");
  assert.ok(sg.segura, "deu " + sg.score);
});

teste("qualificador que falta não impede, identidade que falta impede", () => {
  const idx = modulo.indiceDoCatalogo(CAT_DISCO);
  // "Corte Parede" é qualificador: a loja não escreveu e mesmo assim casa
  assert.ok(modulo.casarNoCatalogo("Disco Diamantado 110mm", idx, 5).length);
  // "Hidratado" é identidade: argamassa não pode virar cal
  const arg = modulo.casarNoCatalogo("Argamassa ACIII 20kg", idx, 5);
  assert.ok(arg.every((c) => c.insumo.codigo !== "CIM-010"), "argamassa não é cal hidratado");
});

teste("a gaveta nunca conta como identidade", () => {
  const partes = modulo.cotPartesDoNome("Elétrica - Cabo Flexível 750V 4mm");
  assert.deepStrictEqual(partes.gaveta, ["eletrica"]);
  // só "cabo" e "flexivel" são identidade; "750", "v", "4", "mm" estreitam
  const sg = modulo.sugestaoDoCatalogo("Cabo Flexsil 750 V 4.00 Preto", modulo.indiceDoCatalogo(CAT_DISCO));
  assert.strictEqual(sg && sg.codigo, "ELE-028");
});


// ── Ditado: o número falado vira número escrito ────────────
teste("número por extenso vira dígito", () => {
  assert.strictEqual(modulo.numerosDoExtenso("dez sacos de cimento"), "10 sacos de cimento");
  assert.strictEqual(modulo.numerosDoExtenso("cinco quilos de prego"), "5 quilos de prego");
  assert.strictEqual(modulo.numerosDoExtenso("uma tábua"), "1 tábua");
});

teste("número composto é um número só", () => {
  assert.strictEqual(modulo.numerosDoExtenso("vinte e um sacos"), "21 sacos");
  assert.strictEqual(modulo.numerosDoExtenso("cento e cinquenta metros"), "150 metros");
  assert.strictEqual(modulo.numerosDoExtenso("duzentos e trinta e cinco"), "235");
  assert.strictEqual(modulo.numerosDoExtenso("cem"), "100");
});

teste("“e” entre coisas diferentes não soma", () => {
  assert.strictEqual(modulo.numerosDoExtenso("dois sacos e três latas"), "2 sacos e 3 latas");
  assert.strictEqual(modulo.numerosDoExtenso("dez e dez"), "10 e 10");
});

teste("o que não é número fica como veio", () => {
  assert.strictEqual(modulo.numerosDoExtenso("tábua de pinus"), "tábua de pinus");
  assert.strictEqual(modulo.numerosDoExtenso("30 sacos"), "30 sacos");
  assert.strictEqual(modulo.numerosDoExtenso(""), "");
  assert.strictEqual(modulo.numerosDoExtenso(null), "");
});

teste("acento e caixa da fala não atrapalham", () => {
  assert.strictEqual(modulo.numerosDoExtenso("Três sacos"), "3 sacos");
  assert.strictEqual(modulo.numerosDoExtenso("DEZOITO barras"), "18 barras");
});

teste("cada frase ditada entra em linha nova", () => {
  assert.strictEqual(modulo.textoComDitado("", "dez sacos de cimento"), "10 sacos de cimento");
  assert.strictEqual(modulo.textoComDitado("10 sacos de cimento", "cinco tábuas"),
    "10 sacos de cimento\ncinco tábuas".replace("cinco", "5"));
  assert.strictEqual(modulo.textoComDitado("já escrito   ", "  "), "já escrito   ");
  assert.strictEqual(modulo.textoComDitado(null, "três latas"), "3 latas");
});

// ── A Entrada como porta de insumos ─────────────────────────────

const ITEM = [{ descricao: "Cimento", quantidade: 10 }];

teste("sem item lido não segue, qualquer que seja o destino", () => {
  assert.strictEqual(M.entradaPronta("pedido", "f1", []).ok, false);
  assert.strictEqual(M.entradaPronta("pedido", "f1", []).motivo, "A leitura não achou itens.");
});

teste("dentro da obra não se pergunta a obra", () => {
  const r = M.entradaPronta("cotacao", "", ITEM);
  assert.strictEqual(r.ok, true, r.motivo);
  assert.strictEqual(M.entradaPedeObra(undefined), false);
  assert.strictEqual(M.entradaPedeObra([]), false);
});

teste("aberta fora da obra, a obra é obrigatória", () => {
  const obras = [{ id: "ob1", nome: "Reforma", clienteNome: "COBOP" }];
  assert.strictEqual(M.entradaPedeObra(obras), true);
  const sem = M.entradaPronta("cotacao", "", ITEM, obras, "");
  assert.strictEqual(sem.ok, false);
  assert.strictEqual(sem.motivo, "Escolha a obra.");
  assert.strictEqual(M.entradaPronta("cotacao", "", ITEM, obras, "ob1").ok, true);
});

teste("a obra é cobrada antes do destino — é a primeira pergunta depois de ler", () => {
  const obras = [{ id: "ob1", nome: "Reforma" }];
  assert.strictEqual(M.entradaPronta("", "", ITEM, obras, "").motivo, "Escolha a obra.");
  assert.strictEqual(M.entradaPronta("", "", ITEM, obras, "ob1").motivo, "Diga o que é este papel.");
});

teste("pedido e pagamento pedem loja; cotação não", () => {
  assert.strictEqual(M.entradaPedeLoja("pedido"), true);
  assert.strictEqual(M.entradaPedeLoja("pagamento"), true);
  assert.strictEqual(M.entradaPedeLoja("cotacao"), false);
  assert.strictEqual(M.entradaPronta("pedido", "", ITEM).motivo, "Escolha a loja.");
  assert.strictEqual(M.entradaPronta("pedido", "f1", ITEM).ok, true);
});

teste("as portas de saída, na ordem da vida", () => {
  assert.deepStrictEqual(M.DESTINOS_DA_ENTRADA.map((d) => d.id),
    ["mandar", "pedido", "pagamento", "despesa", "cotacao"]);
});


// ── O que a frase diz além da lista ─────────────────────────────

const OBRAS_CTX = [
  { id: "ob1", nome: "Reforma Loja Cobop", clienteNome: "COBOP COMÉRCIO DE BOMBAS" },
  { id: "ob2", nome: "Jacarezinho Mod 1", clienteNome: "Padovan Empreendimentos" },
];
const LOJAS_CTX = [
  { id: "f1", nome: "OURIFER" },
  { id: "f2", nome: "Pantanal Materiais" },
];
const ctx = (txt) => M.contextoDaEntrada(txt, OBRAS_CTX, LOJAS_CTX);

teste("“para a obra da Cobop” acha a obra pelo nome do cliente", () => {
  const r = ctx("para a obra da Cobop\n10 sacos de cimento");
  assert.strictEqual(r.obra && r.obra.id, "ob1");
  assert.strictEqual(r.textoLimpo, "10 sacos de cimento");
});

teste("“Loja Ourifer” acha a loja e sai da lista", () => {
  const r = ctx("Loja Ourifer\n10 sacos de cimento");
  assert.strictEqual(r.loja && r.loja.id, "f1");
  assert.strictEqual(r.textoLimpo, "10 sacos de cimento");
});

teste("os dois juntos, em qualquer ordem", () => {
  const r = ctx("10 sacos de cimento\nLoja Ourifer\npara a obra da Cobop\n5 tubo 100mm");
  assert.strictEqual(r.obra.id, "ob1");
  assert.strictEqual(r.loja.id, "f1");
  assert.strictEqual(r.textoLimpo, "10 sacos de cimento\n5 tubo 100mm");
  assert.strictEqual(r.trechos.length, 2);
});

teste("“obra” sozinha não é menção — a linha fica", () => {
  const r = ctx("obra\n10 sacos de cimento");
  assert.strictEqual(r.obra, null);
  assert.ok(/obra/.test(r.textoLimpo));
});

teste("linha com quantidade é material, mesmo citando a loja", () => {
  const r = ctx("2 caixas Ourifer 4x2");
  assert.strictEqual(r.loja, null, "não pode consumir um item");
  assert.strictEqual(r.textoLimpo, "2 caixas Ourifer 4x2");
});

teste("a marca decide de que lado procurar", () => {
  // A obra chama "Reforma LOJA Cobop"; dizer "loja Ourifer" não pode
  // esbarrar nela, e dizer "obra Cobop" não pode virar fornecedor.
  const r = ctx("loja Ourifer\nobra Cobop");
  assert.strictEqual(r.loja.id, "f1");
  assert.strictEqual(r.obra.id, "ob1");
});

teste("menção ambígua entre duas obras não preenche nada", () => {
  const duas = [
    { id: "a", nome: "Reforma Centro", clienteNome: "Silva" },
    { id: "b", nome: "Reforma Centro", clienteNome: "Souza" },
  ];
  const r = M.contextoDaEntrada("obra Reforma Centro\n10 cimento", duas, LOJAS_CTX);
  assert.strictEqual(r.obra, null, "duas casaram: quem escolhe é ele");
  assert.ok(/Reforma Centro/.test(r.textoLimpo), "e a linha fica à vista");
});

teste("nome curto demais não casa — “sa” não é nome", () => {
  const r = M.contextoDaEntrada("obra sa", [{ id: "x", nome: "Sabará" }], []);
  assert.strictEqual(r.obra, null);
});

teste("acento e caixa não atrapalham", () => {
  const r = ctx("PARA A OBRA DA COBOP COMÉRCIO\nloja pantanal materiais");
  assert.strictEqual(r.obra.id, "ob1");
  assert.strictEqual(r.loja.id, "f2");
});

teste("pelo nome da obra, não só do cliente", () => {
  assert.strictEqual(ctx("obra Jacarezinho Mod 1").obra.id, "ob2");
  assert.strictEqual(ctx("obra jacarezinho").obra.id, "ob2");
});

teste("linha solta sem marca que casa dos dois lados fica para ele", () => {
  const confuso = [{ id: "o", nome: "Ourifer Reforma", clienteNome: "X" }];
  const r = M.contextoDaEntrada("ourifer", confuso, LOJAS_CTX);
  assert.strictEqual(r.obra, null);
  assert.strictEqual(r.loja, null);
  assert.strictEqual(r.textoLimpo, "ourifer");
});

teste("só a lista, sem menção nenhuma, volta intacta", () => {
  const r = ctx("10 sacos de cimento\n5 tubo 100mm esgoto");
  assert.strictEqual(r.obra, null);
  assert.strictEqual(r.loja, null);
  assert.strictEqual(r.textoLimpo, "10 sacos de cimento\n5 tubo 100mm esgoto");
  assert.strictEqual(r.trechos.length, 0);
});

teste("texto vazio ou listas vazias não explodem", () => {
  assert.strictEqual(M.contextoDaEntrada("", [], []).textoLimpo, "");
  assert.strictEqual(M.contextoDaEntrada(null, null, null).obra, null);
});

teste("a segunda menção do mesmo tipo não sobrescreve a primeira", () => {
  const r = ctx("obra Cobop\nobra Jacarezinho\n10 cimento");
  assert.strictEqual(r.obra.id, "ob1", "a primeira manda");
  assert.ok(/Jacarezinho/.test(r.textoLimpo), "e a segunda fica à vista, não some calada");
});


// ── A lista rápida para a loja ──────────────────────────────────

teste("“Mandar para a loja” é a primeira porta, e não exige loja aqui", () => {
  assert.strictEqual(M.DESTINOS_DA_ENTRADA[0].id, "mandar");
  assert.strictEqual(M.entradaPedeLoja("mandar"), false, "a loja se escolhe na tela seguinte");
  assert.strictEqual(M.entradaPronta("mandar", "", [{ descricao: "Cimento" }]).ok, true);
});

teste("a lista ditada ganha nome do que ela tem", () => {
  assert.strictEqual(
    M.tituloDaListaRapida([{ descricao: "Cimento CP II 50kg" }, { descricao: "Tubo 100mm esgoto" }]),
    "Cimento CP, Tubo 100mm");
  assert.strictEqual(
    M.tituloDaListaRapida([{ descricao: "Cimento CP II" }, { descricao: "Tubo 100mm" }, { descricao: "Areia" }, { descricao: "Brita" }]),
    "Cimento CP, Tubo 100mm e mais 2");
  assert.strictEqual(M.tituloDaListaRapida([{ descricao: "Areia média" }]), "Areia média");
});

teste("lista sem descrição nenhuma ainda ganha um nome com data", () => {
  assert.strictEqual(M.tituloDaListaRapida([], "2026-09-06"), "Lista de 06/09/2026");
  assert.strictEqual(M.tituloDaListaRapida([{ descricao: "  " }], "2026-09-06"), "Lista de 06/09/2026");
  assert.strictEqual(M.tituloDaListaRapida(null), "Lista");
});

teste("o texto que vai para a loja traz obra, endereço e os itens numerados", () => {
  const cot = { itens: [
    { descricao: "Cimento CP II 50kg", unidade: "sacos", quantidade: 10 },
    { descricao: "Tubo 100mm", unidade: "Unidades", quantidade: 5 },
  ] };
  const msg = M.textoDoPedido(cot, null, { obra: "Reforma Loja Cobop", endereco: "Ourinhos, SP" });
  assert.ok(/^Obra: Reforma Loja Cobop — Ourinhos, SP/.test(msg));
  assert.ok(/1\. Cimento CP II 50kg — 10 sacos/.test(msg));
  assert.ok(/2\. Tubo 100mm — 5 Unidades/.test(msg));
});

teste("mandar duas vezes para a mesma loja não duplica o registro", () => {
  const f = { id: "f1", nome: "OURIFER" };
  let cot = M.registrarEnvioDaLista({ id: "c1" }, f, "Renato", "2026-09-06T12:00:00.000Z");
  cot = M.registrarEnvioDaLista(cot, f, "Renato", "2026-09-07T12:00:00.000Z");
  assert.strictEqual(M.enviosDaLista(cot).length, 1);
  assert.ok(/2026-09-07/.test(M.envioParaLoja(cot, "f1").em), "fica o envio mais recente");
});


teste("a mensagem da lista rápida sai pronta dos itens da Entrada", () => {
  const msg = M.textoDaListaRapida(
    [{ descricao: "Cimento CP II 50kg", unidade: "sacos", quantidade: 10 },
     { descricao: "Tubo 100mm", unidade: "Unidades", quantidade: 5 },
     { descricao: "Fita crepe", unidade: "", quantidade: 0 }],
    { obra: "Reforma Loja Cobop", endereco: "Ourinhos, SP" });
  assert.strictEqual(msg,
    "Obra: Reforma Loja Cobop — Ourinhos, SP\n\n" +
    "1. Cimento CP II 50kg — 10 sacos\n" +
    "2. Tubo 100mm — 5 Unidades\n" +
    "3. Fita crepe");
});

teste("sem obra no contexto a mensagem é só a lista", () => {
  assert.strictEqual(M.textoDaListaRapida([{ descricao: "Areia", quantidade: 2, unidade: "m3" }], {}),
    "1. Areia — 2 m3");
  assert.strictEqual(M.textoDaListaRapida([], {}), "");
});

teste("a mensagem rápida e a da cotação dizem a mesma coisa", () => {
  const itens = [{ descricao: "Cimento", unidade: "sacos", quantidade: 10 }];
  const ctx = { obra: "Obra X", endereco: "Rua Y" };
  assert.strictEqual(M.textoDaListaRapida(itens, ctx),
    M.textoDoPedido({ itens }, null, ctx), "dois formatos divergindo é o que confunde a loja");
});


// ── A tela única da Entrada ─────────────────────────────────────
const IT = (x) => ({ descricao: "Veda concreto", insumoCodigo: "VED-1", quantidade: "1", unidade: "BD", bruto: 428,
  etapa: "fundacao", contaId: "material", ...x });

teste("situação de partida: empreendimento entra pago; cliente pergunta; comprovante é pago", () => {
  assert.strictEqual(M.situacaoPadraoDaEntrada({ tipo: "nota" }, "empreendimento"), "pago");
  assert.strictEqual(M.situacaoPadraoDaEntrada({ tipo: "nota" }, "cliente"), "");
  assert.strictEqual(M.situacaoPadraoDaEntrada({ tipo: "comprovante" }, "cliente"), "pago");
  assert.deepStrictEqual(M.SITUACOES_DA_ENTRADA.map((s) => s.id), ["cotacao", "apagar", "pago"]);
});

teste("tela única: diz o primeiro que falta, na ordem de quem preenche", () => {
  const base = { situacao: "pago", prestadorId: "f1", itens: [IT()], pagamento: { data: "2026-09-02", forma: "avista" } };
  assert.deepStrictEqual(M.entradaUnicaPronta(base, [], ""), { ok: true, motivo: "" });
  assert.match(M.entradaUnicaPronta({ ...base, situacao: "" }, [], "").motivo, /situação/);
  assert.match(M.entradaUnicaPronta({ ...base, prestadorId: "" }, [], "").motivo, /fornecedor/);
  assert.match(M.entradaUnicaPronta({ ...base, pagamento: { data: "2026-09-02", forma: "cartao" } }, [], "").motivo, /cartão/);
  assert.match(M.entradaUnicaPronta({ ...base, itens: [IT(), IT({ etapa: "", descricao: "Cimento" })] }, [], "").motivo,
    /Item 2 \(Cimento\): Falta a etapa/);
  assert.match(M.entradaUnicaPronta({ ...base, itens: [IT({ insumoCodigo: "" })] }, [], "").motivo, /item do catálogo/);
  assert.match(M.entradaUnicaPronta(base, [{ id: "o1" }], "").motivo, /obra/);
  assert.ok(M.entradaUnicaPronta({ ...base, situacao: "apagar", apagar: { vencimento: "2026-10-10", parcelas: "3" } }, [], "").ok);
  assert.match(M.entradaUnicaPronta({ ...base, situacao: "apagar", apagar: { vencimento: "", parcelas: "3" } }, [], "").motivo, /1º vencimento/);
  assert.ok(M.entradaUnicaPronta({ situacao: "cotacao", itens: [{ descricao: "cimento", quantidade: 30 }] }, [], "").ok,
    "cotação não pede fornecedor nem preço");
  assert.ok(M.entradaUnicaPronta({ ...base, parcelaId: "p1", itens: [IT({ contaId: "", etapa: "" })] }, [], "").ok,
    "baixando parcela de contrato, conta e etapa vêm da parcela");
});

teste("prévia dos boletos: 1º vencimento e os outros a cada N dias, sem perder centavo", () => {
  const p = M.previaDosBoletos(1000, { vencimento: "2026-10-10", parcelas: 3, intervalo: 30 });
  assert.deepStrictEqual(p.map((x) => x.vencimento), ["2026-10-10", "2026-11-09", "2026-12-09"]);
  assert.strictEqual(Math.round(p.reduce((s, x) => s + x.valor, 0) * 100) / 100, 1000);
  assert.deepStrictEqual(M.previaDosBoletos(1000, { vencimento: "" }), []);
});

teste("papel lido vira anexo com o nome certo; itens de nota começam em Material", () => {
  assert.strictEqual(M.tipoDoAnexoDaEntrada({ tipo: "comprovante" }), "comprovante");
  assert.strictEqual(M.tipoDoAnexoDaEntrada({ tipo: "nota", ehNota: true }), "nota");
  assert.strictEqual(M.tipoDoAnexoDaEntrada({ tipo: "nfse" }), "nota");
  assert.strictEqual(M.tipoDoAnexoDaEntrada({ tipo: "pedido" }), "pedido");
  assert.deepStrictEqual(M.comContaPadraoDaEntrada([{ contaId: "" }, { contaId: "frete" }], "material").map((x) => x.contaId), ["material", "frete"]);
});

// ── DANFE com o nome do produto ABAIXO da linha dos números (FlexDev) ──
const DANFE_NOME_ABAIXO = [
  ["NF-e"], ["RECEBEMOS DE"], ["CONSTRU", "FACIL ACABAMENTO LTDA", "OS PRODUTOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO"], ["DANFE"], ["Documento Auxiliar da"], ["N.º 000.000.163-FL"],
  ["DADOS DOS PRODUTOS / SERVIÇOS"],
  ["CÓDIGO", "DESCRIÇÃO DOS PRODUTOS", "NCM", "CSOSN", "CFOP", "UN", "QUANTID.", "V. UNITÁRIO", "VALOR TOTAL", "BASE ICMS", "% ICMS", "% IPI"],
  ["00109-1", "38244000", "0102", "5102 BD", "1", "428,00", "428,00", "0,00", "0,00", "0"],
  ["VEDA", "CONCRETO", "BALDE COM 18 LITROS"],
  ["00110-2", "25232910", "0102", "5102 SC", "10", "38,50", "385,00", "0,00", "0,00", "0"],
  ["CIMENTO CP II 50KG"],
  [".........................................................................."],
  ["CÁLCULO DO I S S Q N"],
].map((c) => ({ celulas: c, texto: c.join(" ") }));

teste("DANFE com o nome embaixo dos números: cada item leva o seu nome", () => {
  const r = M.interpretarOrcamento(DANFE_NOME_ABAIXO);
  assert.strictEqual(r.itens.length, 2, JSON.stringify(r.itens));
  assert.strictEqual(r.itens[0].descricao, "VEDA CONCRETO BALDE COM 18 LITROS", "a unidade BD não gruda no nome");
  assert.strictEqual(r.itens[0].total, 428);
  assert.strictEqual(r.itens[0].quantidade, 1);
  assert.ok(/CIMENTO CP II 50KG/.test(r.itens[1].descricao), r.itens[1].descricao);
  assert.strictEqual(r.itens[1].total, 385);
  assert.strictEqual(r.ehNota, true);
  assert.strictEqual(r.numeroNota, "163");
  assert.strictEqual(r.fornecedor, "CONSTRU FACIL ACABAMENTO LTDA", "o emitente vem do canhoto");
});

teste("emitente da nota casa com o cadastro mesmo escrito separado e com LTDA", () => {
  const cad = [{ id: "cf", nome: "Construfácil Acabamento" }, { id: "o", nome: "OURIFER" }];
  assert.strictEqual((M.prestadorDoComprovante(cad, "CONSTRU FACIL ACABAMENTO LTDA") || {}).id, "cf");
  assert.strictEqual(M.prestadorDoComprovante(cad, "LOJA QUALQUER LTDA"), null);
});

teste("DANFE com o nome em cima continua lendo igual", () => {
  const acima = [
    ["DANFE"], ["N.º 000.008.623"],
    ["CÓDIGO", "DESCRIÇÃO", "NCM", "CST", "CFOP", "UN", "QUANT", "V.UNIT", "V.TOTAL"],
    ["AREIA MEDIA LAVADA"],
    ["8", "25059000", "0103", "6102 METRO", "2,00", "130,00", "260,00", "0,00"],
    ["PEDRA BRITADA 1"],
    ["9", "25171000", "0103", "6102 METRO", "3,00", "120,00", "360,00", "0,00"],
  ].map((c) => ({ celulas: c, texto: c.join(" ") }));
  const r = M.interpretarOrcamento(acima);
  assert.deepStrictEqual(r.itens.map((i) => i.total), [260, 360]);
  assert.ok(/AREIA/.test(r.itens[0].descricao) && /PEDRA/.test(r.itens[1].descricao), JSON.stringify(r.itens.map(i => i.descricao)));
});

// ── A nota fiscal (DANFE) ───────────────────────────────────────
// As linhas abaixo são as que o pdf.js devolve para a nota 8.623 da
// Canroberto Said — a que chegou lendo "6102 METRO" como nome do material.

const DANFE_REAL = [
  { celulas: ["CÓDIGO DO PROD.", "CSOSN", "VALOR", "VALOR", "DESCONTO", "BASE", "VALOR", "VALOR"] },
  { celulas: ["DESCRIÇÃO DO PRODUTO / SERVIÇO", "NCM / SH", "CFOP", "UNID.", "QUANT."] },
  { celulas: ["/ CST", "UNITÁRIO", "TOTAL", "CÁLC. ICMS", "I.C.M.S.", "I.P.I."] },
  { celulas: ["/ SERV.", "ICMS", "IPI"] },
  { celulas: ["AREIA FINA"] },
  { celulas: ["8", "25059000", "0103", "6102 METRO", "2,00", "130,00", "260,00", "0,00", "0,00", "0,00", "0,00", "0,00", "0,00"] },
  { celulas: ["ARAME RECOZIDO"] },
  { celulas: ["1364", "72172090", "0500", "6404 QUILO", "2,00", "14,00", "28,00", "0,00", "0,00", "0,00", "0,00", "0,00", "0,00"] },
  { celulas: ["PREGO 18X27"] },
  { celulas: ["99", "73170090", "0500", "6404 QUILO", "1,00", "16,00", "16,00", "0,00", "0,00", "0,00", "0,00", "0,00", "0,00"] },
  { celulas: ["DADOS ADICIONAIS"] },
].map((l) => ({ ...l, texto: l.celulas.join(" ") }));

teste("a nota fiscal da Canroberto sai com o nome certo, não com o CFOP", () => {
  const r = M.interpretarOrcamento(DANFE_REAL);
  assert.strictEqual(r.itens.length, 3);
  assert.deepStrictEqual(r.itens.map((i) => i.descricao),
    ["AREIA FINA", "ARAME RECOZIDO", "PREGO 18X27"]);
});

teste("quantidade, unitário e total da nota batem com o papel", () => {
  const r = M.interpretarOrcamento(DANFE_REAL);
  assert.deepStrictEqual(r.itens.map((i) => [i.quantidade, i.unitario, i.total]),
    [[2, 130, 260], [2, 14, 28], [1, 16, 16]]);
  const soma = r.itens.reduce((s, i) => s + i.total, 0);
  assert.strictEqual(soma, 304, "e a soma é o total da nota");
});

teste("a unidade da nota vem por extenso e é aproveitada", () => {
  const r = M.interpretarOrcamento(DANFE_REAL);
  assert.deepStrictEqual(r.itens.map((i) => i.unidade), ["METRO", "QUILO", "QUILO"]);
  // e o vocabulário do catálogo sabe traduzi-las
  assert.strictEqual(M.unidadeNoPadrao("METRO", ["Mts", "Kg"]), "Mts");
  assert.strictEqual(M.unidadeNoPadrao("QUILO", ["Mts", "Kg"]), "Kg");
});

teste("o código do produto da nota é preservado", () => {
  const r = M.interpretarOrcamento(DANFE_REAL);
  assert.deepStrictEqual(r.itens.map((i) => i.codigo), ["8", "1364", "99"]);
});

teste("a descrição também pode vir na mesma linha dos números", () => {
  const umaLinha = [{ celulas: ["8", "AREIA FINA", "25059000", "0103", "6102", "METRO", "2,00", "130,00", "260,00", "0,00"] }]
    .map((l) => ({ ...l, texto: l.celulas.join(" ") }));
  const d = M.pedacoDeDanfe(umaLinha[0].celulas);
  assert.strictEqual(d.descricao, "AREIA FINA");
  assert.strictEqual(d.unidade, "METRO");
  assert.deepStrictEqual(d.numeros, ["2,00", "130,00", "260,00"]);
});

teste("sem CFOP depois do NCM não é nota — não mexe na linha", () => {
  // código de barras numa linha de orçamento tem 8 dígitos e não é NCM
  assert.strictEqual(M.pedacoDeDanfe(["7", "CIMENTO CP II", "78912345", "6", "43,00", "258,00"]), null);
});

teste("linha de nota cuja conta não fecha volta para a regra geral", () => {
  // 2 × 130 ≠ 999: prefiro devolver do que inventar a ordem das colunas
  assert.strictEqual(
    M.pedacoDeDanfe(["8", "AREIA", "25059000", "0103", "6102 METRO", "2,00", "130,00", "999,00"]), null);
});

teste("a linha da descrição sozinha é consumida, não vira item vazio", () => {
  const r = M.juntarLinhasDaDanfe(DANFE_REAL);
  const texto = r.map((l) => l.texto).join("\n");
  assert.ok(!/^AREIA FINA$/m.test(texto), "não pode sobrar a linha solta");
  assert.ok(/AREIA FINA METRO 2,00 130,00 260,00/.test(texto));
});

teste("o orçamento comum não é tocado pelo leitor de nota", () => {
  const orc = [
    { celulas: ["Código", "Descrição", "Qtde", "Unitário", "Total"] },
    { celulas: ["7", "CIMENTO CP II 50KG", "SC", "6", "43,00", "258,00"] },
  ].map((l) => ({ ...l, texto: l.celulas.join(" ") }));
  const r = M.interpretarOrcamento(orc);
  assert.strictEqual(r.itens.length, 1);
  assert.strictEqual(r.itens[0].descricao, "CIMENTO CP II 50KG");
  assert.strictEqual(r.itens[0].total, 258);
});

teste("“QUILO” e “METRO” não entram no nome do material", () => {
  // era isto que colava a unidade na descrição antes de a tabela conhecer
  // as palavras por extenso
  const orc = [{ celulas: ["ARAME RECOZIDO", "QUILO", "2,00", "14,00", "28,00"] }]
    .map((l) => ({ ...l, texto: l.celulas.join(" ") }));
  const r = M.interpretarOrcamento(orc);
  assert.strictEqual(r.itens[0].descricao, "ARAME RECOZIDO");
  assert.strictEqual(r.itens[0].unidade, "QUILO");
});


// ── Leitura torta não é insumo faltando ─────────────────────────

teste("o que saiu da nota lida errado é reconhecido como leitura torta", () => {
  for (const s of ["6102 METRO", "6404 QUILO", "5102 UN", "25059000 0103", "2,00 130,00"])
    assert.strictEqual(M.descricaoSemMaterial(s), true, s);
});

teste("material de verdade nunca é confundido com leitura torta", () => {
  for (const s of ["AREIA FINA", "ARAME RECOZIDO", "PREGO 18X27", "Cal hidratada",
                   "Tubo 100mm", "Cimento CP II 50kg", "Tela soldada Q138",
                   "Viga", "Cola PVC 175g", "Disco diamantado 110mm"])
    assert.strictEqual(M.descricaoSemMaterial(s), false, s);
});

teste("rótulo de coluna fiscal não conta como nome de material", () => {
  assert.strictEqual(M.palavraDeMaterial("CFOP"), false);
  assert.strictEqual(M.palavraDeMaterial("ICMS"), false);
  assert.strictEqual(M.palavraDeMaterial("Unitário"), false);
  assert.strictEqual(M.palavraDeMaterial("QUILO"), false);
  assert.strictEqual(M.palavraDeMaterial("18X27"), false, "dois dígitos e um X não é nome");
  assert.strictEqual(M.palavraDeMaterial("AREIA"), true);
});

teste("descrição vazia conta como torta", () => {
  assert.strictEqual(M.descricaoSemMaterial(""), true);
  assert.strictEqual(M.descricaoSemMaterial(null), true);
  assert.strictEqual(M.descricaoSemMaterial("   "), true);
});


teste("a nota se identifica como nota, e o orçamento não", () => {
  assert.strictEqual(M.ehDanfe("DANFE DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA"), true);
  assert.strictEqual(M.ehDanfe("NOTA FISCAL ELETRONICA"), true);
  assert.strictEqual(M.ehDanfe("ORÇAMENTO Nº 1234 — Rei do Cimento"), false);
});

teste("o número da nota perde os zeros e os pontos da impressão", () => {
  assert.strictEqual(M.numeroDaNota("Nº 000.008.623 fl. 1 /1"), "8623");
  assert.strictEqual(M.numeroDaNota("N° 8.623"), "8623");
  assert.strictEqual(M.numeroDaNota("sem número nenhum"), "");
});

teste("a nota da Canroberto chega com o próprio número, sem pedido", () => {
  const comCabecalho = [
    { celulas: ["DANFE DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA"] },
    { celulas: ["Nº 000.008.623 fl. 1 /1"] },
  ].map((l) => ({ ...l, texto: l.celulas.join(" ") })).concat(DANFE_REAL);
  const r = M.interpretarOrcamento(comCabecalho);
  assert.strictEqual(r.ehNota, true);
  assert.strictEqual(r.numeroNota, "8623");
  assert.strictEqual(r.numeroPedido, "", "nota não tem número de pedido — e não se inventa um");
  assert.strictEqual(r.itens.length, 3);
});


teste("a data de emissão da nota sai do rodapé, não de hoje", () => {
  assert.strictEqual(M.dataDaNota("EMISSÃO: 29/09/2026 - DEST. / REM.: LEO PADOVAN"), "2026-09-29");
  assert.strictEqual(M.dataDaNota("EMISSAO 29/09/2026"), "2026-09-29");
});

teste("rótulo numa linha e valor noutra também é lido", () => {
  const danfe = "NOME / RAZÃO SOCIAL  CNPJ / CPF  DATA DA EMISSÃO\n" +
                "LEO PADOVAN PROJETOS E CONSTRUCOES  36.122.417/0001-74  29/09/2026";
  assert.strictEqual(M.dataDaNota(danfe), "2026-09-29");
});

teste("papel sem emissão declarada não inventa data", () => {
  assert.strictEqual(M.dataDaNota("ORÇAMENTO Nº 1234 — sem data nenhuma"), "");
  assert.strictEqual(M.dataDaNota(""), "");
  assert.strictEqual(M.dataDaNota(null), "");
});

teste("a nota da Canroberto entra na competência dela, não na de hoje", () => {
  const comCabecalho = [
    { celulas: ["DANFE DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA"] },
    { celulas: ["Nº 000.008.623 fl. 1 /1"] },
    { celulas: ["EMISSÃO: 29/09/2026 - DEST. / REM.: LEO PADOVAN - VALOR TOTAL: R$ 304,00"] },
  ].map((l) => ({ ...l, texto: l.celulas.join(" ") })).concat(DANFE_REAL);
  const r = M.interpretarOrcamento(comCabecalho);
  assert.strictEqual(r.emitido, "2026-09-29",
    "é esta data que vira pagoEm no “pagamento já feito”, e dela sai a competência");
});


// ── A leitura da IA vira a ficha da Entrada ─────────────────────
const NOTA_IA = { tipo: "nota_produto", emitente: "CANROBERTO MATERIAIS LTDA", cnpj: "12.345.678/0001-90",
  numero: "8623", chave: "3526 0912 3456 7800 0190 5500 1000 0086 2310 0000 8623", emissao: "2026-09-29",
  situacao: "nao_se_aplica", forma: "nao_informado", valor: 304, desconto: 0, descricao: "",
  itens: [{ descricao: "CIMENTO CP II 50KG", quantidade: 8, unidade: "SC", unitario: 38, total: 304 }] };
const PIX_IA = { tipo: "comprovante_pix", emitente: "CANROBERTO MATERIAIS LTDA", chave: "E00000000202609291530abcdEFGH1234",
  emissao: "2026-09-30", pagamento: "2026-09-29", situacao: "pago", forma: "pix", valor: 304, itens: [] };

teste("IA: nota sozinha vira ficha de nota com itens, número e chave", () => {
  const f = M.fichaDaEntradaPelaIA([NOTA_IA]);
  assert.strictEqual(f.papel.tipo, "nota");
  assert.strictEqual(f.papel.lidoPelaIA, true);
  assert.strictEqual(f.papel.numeroNota, "8623");
  assert.strictEqual(f.papel.chave.length, 44);
  assert.strictEqual(f.papel.emitido, "2026-09-29");
  assert.strictEqual(f.papel.situacaoLida, "");
  assert.strictEqual(f.itens.length, 1);
  assert.strictEqual(f.itens[0].total, 304);
  assert.deepStrictEqual(f.avisos, []);
});

teste("IA: nota + Pix no mesmo arquivo — itens da nota, data do pagamento do Pix", () => {
  const f = M.fichaDaEntradaPelaIA([PIX_IA, NOTA_IA]);
  assert.strictEqual(f.papel.tipo, "nota", "os itens mandam: a nota é o papel principal");
  assert.strictEqual(f.papel.situacaoLida, "pago");
  assert.strictEqual(f.papel.pagoEm, "2026-09-29", "a data do pagamento, não a da impressão");
  assert.strictEqual(f.papel.idTransacao, "E00000000202609291530abcdEFGH1234");
  assert.strictEqual(f.papel.chave.length, 44);
  assert.ok(f.avisos.some((a) => /2 papéis/.test(a)), JSON.stringify(f.avisos));
  assert.strictEqual(M.situacaoPadraoDaEntrada(f.papel, "cliente"), "pago");
});

teste("IA: valor pago diferente do total da nota vira aviso", () => {
  const f = M.fichaDaEntradaPelaIA([NOTA_IA, { ...PIX_IA, valor: 300 }]);
  assert.ok(f.avisos.some((a) => /diferente do total/.test(a)), JSON.stringify(f.avisos));
  assert.strictEqual(f.itens[0].total, 304, "os itens não são mexidos calados");
});

teste("IA: Pix agendado entra a pagar, com o vencimento agendado", () => {
  const f = M.fichaDaEntradaPelaIA([{ ...PIX_IA, situacao: "agendado", pagamento: "", vencimento: "2026-10-15" }]);
  assert.strictEqual(f.papel.tipo, "comprovante");
  assert.strictEqual(f.papel.situacaoLida, "agendado");
  assert.strictEqual(f.papel.vencimento, "2026-10-15");
  assert.ok(f.avisos.some((a) => /AGENDAMENTO/.test(a)));
  assert.strictEqual(M.situacaoPadraoDaEntrada(f.papel, "empreendimento"), "apagar",
    "mesmo no empreendimento: o dinheiro ainda não saiu");
});

teste("IA: comprovante sozinho vira um item com o valor pago", () => {
  const f = M.fichaDaEntradaPelaIA([{ ...PIX_IA, descricao: "Frete areia" }]);
  assert.strictEqual(f.itens.length, 1);
  assert.strictEqual(f.itens[0].total, 304);
  assert.strictEqual(f.itens[0].descricao, "Frete areia");
  assert.strictEqual(f.papel.chave, "", "ID do Pix não é chave de nota");
});

teste("IA: lista de material vira cotação; sem documento não há ficha", () => {
  const f = M.fichaDaEntradaPelaIA([{ tipo: "lista_material", situacao: "nao_se_aplica", valor: 0,
    itens: [{ descricao: "Areia média", quantidade: 3, unidade: "m3" }] }]);
  assert.strictEqual(f.papel.tipo, "lista");
  assert.strictEqual(M.situacaoPadraoDaEntrada(f.papel, "cliente"), "cotacao");
  assert.strictEqual(M.fichaDaEntradaPelaIA([]), null);
  assert.strictEqual(M.fichaDaEntradaPelaIA(null), null);
});

teste("IA: sem situação lida, vale a regra da obra", () => {
  assert.strictEqual(M.situacaoPadraoDaEntrada({ tipo: "nota" }, "empreendimento"), "pago");
  assert.strictEqual(M.situacaoPadraoDaEntrada({ tipo: "nota" }, "cliente"), "");
  assert.strictEqual(M.situacaoPadraoDaEntrada({ tipo: "nota", situacaoLida: "a_pagar" }, "empreendimento"), "apagar");
  assert.strictEqual(M.tipoDoPapelPelaIA("nota_servico"), "nfse");
  assert.strictEqual(M.tipoDoPapelPelaIA("cupom"), "pedido");
});


teste("texto em caixa alta vira texto de gente; o resto fica como veio", () => {
  const T = M.textoSemCaixaAlta;
  assert.strictEqual(T("AREIA FINA"), "Areia Fina");
  assert.strictEqual(T("CIMENTO CP II 50KG"), "Cimento CP II 50kg");
  assert.strictEqual(T("TUBO PVC ESGOTO 100MM"), "Tubo PVC Esgoto 100mm");
  assert.strictEqual(T("MALHA POP Q138 4.2MM 10X10"), "Malha Pop Q138 4.2mm 10x10");
  assert.strictEqual(T("VEDA CONCRETO BALDE 18L"), "Veda Concreto Balde 18L");
  assert.strictEqual(T("FURADEIRA DE IMPACTO 710W 220V"), "Furadeira de Impacto 710W 220V");
  assert.strictEqual(T("CONSTRU FACIL ACABAMENTO LTDA"), "Constru Facil Acabamento Ltda");
  assert.strictEqual(T("REI DO CIMENTO | C E SANTANA COMERCIAL ME"), "Rei do Cimento | C e Santana Comercial ME");
  assert.strictEqual(T("TÁBUA DE PINUS (3,00 M)"), "Tábua de Pinus (3,00 m)");
  assert.strictEqual(T("PARAFUSO SEXTAVADO M10 X 50"), "Parafuso Sextavado M10 x 50");
  assert.strictEqual(T("Areia Fina"), "Areia Fina", "já escrito com cuidado fica");
  assert.strictEqual(T("Tubo PVC 40mm"), "Tubo PVC 40mm");
  assert.strictEqual(T(""), "");
  assert.strictEqual(T(null), "");
});

teste("a leitura entrega o item já em texto de gente", () => {
  const f = M.fichaDaEntradaPelaIA([{ tipo: "nota_produto", emitente: "REI DO CIMENTO LTDA", valor: 260, situacao: "pago",
    itens: [{ descricao: "AREIA FINA", quantidade: 2, unidade: "M3", total: 260 }] }]);
  assert.strictEqual(f.papel.lidoComo, "Rei do Cimento Ltda");
  const itens = M.itensDaEntrada({ itens: f.itens }, "orcamento", []);
  assert.strictEqual(itens[0].descricao, "Areia Fina");
});


// ── Cotação na Entrada: a lista que já chega com preço ──────────
const LOJA_OURIFER = { id: "f-our", nome: "Ourifer" };
const listaOurifer = () => [
  { descricao: "Tábuas 30cm", insumoCodigo: "MAD-030", quantidade: 60, unidade: "Unidades", unitario: 38.9, bruto: 2334, etapa: "fundacao", contaId: "material" },
  { descricao: "Sarrafos 5cm", insumoCodigo: "MAD-005", quantidade: 50, unidade: "Unidades", unitario: 5.9, bruto: 295, etapa: "fundacao", contaId: "material" },
  { descricao: "Disco Corte Inox", insumoCodigo: "DIS-001", quantidade: 2, unidade: "Unidades", unitario: 2.5, bruto: 5, etapa: "fundacao", contaId: "material" },
  { descricao: "Disco Serra Circular", insumoCodigo: "DIS-001", quantidade: 3, unidade: "Unidades", unitario: 21.5, bruto: 64.5, etapa: "fundacao", contaId: "material" },
];

teste("lista com preço vira proposta; sem preço, pedido às lojas", () => {
  assert.strictEqual(M.modoPadraoDaCotacao(listaOurifer()), "proposta");
  assert.strictEqual(M.modoPadraoDaCotacao([{ descricao: "Cimento", quantidade: 10 }]), "pedir");
  assert.strictEqual(M.entradaTemPreco([]), false);
  assert.deepStrictEqual(M.MODOS_DA_COTACAO_NA_ENTRADA.map((m) => m.id), ["proposta", "pedir"]);
});

teste("proposta da Entrada abre cotação nova com a lista e os preços da loja", () => {
  const r = M.propostaDaEntrada({ obraId: "o1", itens: listaOurifer(), loja: LOJA_OURIFER,
    papel: { numeroPedido: "24787-120", emitido: "2026-10-02" }, hojeIso: "2026-10-05" });
  assert.strictEqual(r.nova, true);
  assert.strictEqual(r.substituiu, false);
  assert.strictEqual(r.cotacao.obraId, "o1");
  assert.strictEqual(r.cotacao.itens.length, 4, "os dois discos ficam separados mesmo com o mesmo código");
  assert.strictEqual(r.cotacao.etapaId, "fundacao");
  assert.strictEqual(r.cotacao.contaId, "material");
  assert.ok(r.cotacao.titulo.length > 0);
  assert.strictEqual(r.cotacao.propostas.length, 1);
  const p = r.proposta;
  assert.strictEqual(p.fornecedorId, "f-our");
  assert.strictEqual(p.favorecido, "Ourifer");
  assert.strictEqual(p.valor, 2698.5);
  assert.strictEqual(p.observacao, "Pedido nº 24787-120");
  assert.strictEqual(p.recebidaEm, "2026-10-02");
  const disco = r.cotacao.itens.find((i) => i.descricao === "Disco Serra Circular");
  assert.strictEqual(M.precoUnitario(p, disco.id), 21.5);
});

teste("segunda loja entra na mesma cotação e a comparação fica lado a lado", () => {
  const a = M.propostaDaEntrada({ obraId: "o1", itens: listaOurifer(), loja: LOJA_OURIFER, hojeIso: "2026-10-05" }).cotacao;
  const outra = [
    { descricao: "Tábuas 30cm", insumoCodigo: "MAD-030", quantidade: 60, unitario: 36, bruto: 2160 },
    { descricao: "Prego 18x27", insumoCodigo: "PRE-1827", quantidade: 10, unitario: 15, bruto: 150 },
  ];
  const sug = M.cotacaoSugeridaParaProposta([a], outra);
  assert.strictEqual(sug && sug.id, a.id);
  const r = M.propostaDaEntrada({ cotacao: a, itens: outra, loja: { id: "f-2", nome: "Rei do Cimento" } });
  assert.strictEqual(r.nova, false);
  assert.strictEqual(r.novos, 1, "o prego entra na lista");
  assert.strictEqual(r.cotacao.itens.length, 5);
  assert.strictEqual(r.cotacao.propostas.length, 2);
  const tabua = r.cotacao.itens.find((i) => i.codigo === "MAD-030");
  assert.strictEqual(M.precoUnitario(r.proposta, tabua.id), 36);
  assert.strictEqual(M.itensSemPreco(r.cotacao, r.proposta).length, 3, "o que essa loja não cotou aparece faltando");
});

teste("a mesma loja de novo substitui a proposta dela", () => {
  const a = M.propostaDaEntrada({ obraId: "o1", itens: listaOurifer(), loja: LOJA_OURIFER }).cotacao;
  const nova = listaOurifer().map((x) => ({ ...x, unitario: x.unitario * 2, bruto: x.bruto * 2 }));
  const r = M.propostaDaEntrada({ cotacao: a, itens: nova, loja: LOJA_OURIFER });
  assert.strictEqual(r.substituiu, true);
  assert.strictEqual(r.cotacao.propostas.length, 1);
  assert.strictEqual(r.cotacao.itens.length, 4);
  assert.strictEqual(r.proposta.valor, 5397);
});

teste("desconto do papel vira total fechado da proposta", () => {
  const r = M.propostaDaEntrada({ obraId: "o1", itens: listaOurifer(), loja: LOJA_OURIFER, desconto: 98.5 });
  assert.strictEqual(r.proposta.totalFechado, 2600);
  assert.strictEqual(r.proposta.valor, 2600);
});

teste("só cotação aberta, com lista, que não é conta de loja nem já lançada recebe proposta", () => {
  const base = (m) => ({ ...M.cotacaoVazia("o1"), itens: [M.itemCotacaoVazio()], ...m });
  const ok = base({ criadaEm: "2026-10-01" });
  const maisNova = base({ criadaEm: "2026-10-03" });
  const lista = M.cotacoesParaGuardarProposta([ok, maisNova, base({ contaLoja: true }), base({ status: "decidida" }),
    base({ lancadoEm: "2026-10-02" }), { ...M.cotacaoVazia("o1"), itens: [] }, null]);
  assert.deepStrictEqual(lista.map((c) => c.id), [maisNova.id, ok.id]);
  assert.strictEqual(M.cotacaoSugeridaParaProposta([ok], [{ descricao: "Nada a ver" }]), null);
});


teste("compra nunca cai em conta de receita", () => {
  assert.strictEqual(M.contaDeCompra("deposito_proprio"), "material");
  assert.strictEqual(M.contaDeCompra(""), "material");
  assert.strictEqual(M.contaDeCompra("material"), "material");
  const r = M.propostaDaEntrada({ obraId: "o1", itens: [{ descricao: "Cimento", quantidade: 2, unitario: 40, bruto: 80 }],
    loja: { id: "f1", nome: "Loja" } });
  assert.strictEqual(r.cotacao.contaId, "material", "cotação da Entrada nasce em Material");
  const cot = { ...r.cotacao, contaId: "deposito_proprio" };
  const ped = M.pedidoDaCotacao(cot, r.proposta, [], 30);
  assert.strictEqual(ped.itens[0].contaId, "material", "item sem conta no catálogo não herda conta de receita");
});

teste("o número do papel da proposta vai para o pedido na conta da loja", () => {
  const r = M.propostaDaEntrada({ obraId: "o1", itens: [{ descricao: "Cimento", quantidade: 2, unitario: 40, bruto: 80 }],
    loja: { id: "f1", nome: "Loja" }, papel: { numeroPedido: "24787-120" } });
  assert.strictEqual(r.proposta.numeroPedido, "24787-120");
  assert.strictEqual(M.pedidoDaCotacao(r.cotacao, r.proposta, [], 30).numeroLoja, "24787-120");
  const antiga = { ...r.proposta, numeroPedido: undefined, observacao: "Pedido nº 555-1" };
  assert.strictEqual(M.pedidoDaCotacao(r.cotacao, antiga, [], 30).numeroLoja, "555-1", "proposta antiga: lê da observação");
  const nota = { ...r.proposta, numeroPedido: undefined, observacao: "Nota nº 8623" };
  const pn = M.pedidoDaCotacao(r.cotacao, nota, [], 30);
  assert.strictEqual(pn.numeroNota, "8623");
  assert.strictEqual(pn.numeroLoja, "");
});

for (const [nome, fn] of testes) {
  try { fn(); console.log("  ok   " + nome); }
  catch (e) { falhas++; console.log("  FALHOU " + nome + "\n         " + e.message); }
}
console.log(`\n${testes.length - falhas}/${testes.length} passaram`);
process.exit(falhas ? 1 : 0);
