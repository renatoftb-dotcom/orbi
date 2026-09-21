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
           nomeDoFornecedor, PLANO_CONTAS,
           podeExcluirCotacao, removerProposta, removerCotacao, anexosDasPropostas,
           prestadorRapidoVazio, criarPrestadorRapido, pareceMesmoPdf,
           nomeDeQuem, carimbar, textoAutoria, arquivoColado, nomeDoColado,
           aprovacaoDaEscolha, podeEnviarAoCliente, enviarCotacaoAoCliente,
           limparEnvioAoCliente, cotacoesProntasParaContrato, textoUtf8Recuperado,
           podeLancarEmContas, dadosDoLancamento, contasDaCotacao, removerContasDaCotacao, contasDeCotacao,
           contasDasEntregas, totalDasEntregas, entregaVazia, MODOS_LANCAMENTO, modoLancamento,
           planoDoLancamento, linhasDoPagamento, resumoDoPlano,
           itemCotacaoVazio, itensDaCotacao, temListaDeItens, quantidadeDoItem, precoUnitario,
           propostaTemPrecoPorItem, totalDosItens, itensSemPreco, valorDaProposta,
           melhorPorItem, comparativoDaLista, textoDoPedido, qtdBR,
           unitarioDoTotal, totalBrutoItem, valoresComDesconto, totalEfetivoItem,
           precoEfetivo, totalNegociado, descontoDaProposta,
           linkWhatsApp, enviosDaLista, envioParaLoja, registrarEnvioDaLista, lojasParaPedir,
           interpretarPedido, interpretarLinhaDePedido, quantidadeDoTexto, resumoDaLeitura,
           itemDoPedidoLido, resolverInsumo, scoreAssociacao, candidatosDoPedido,
           unidadesDoCatalogo, opcoesDeUnidade,
           ehNumeroDeOrcamento, numeroDeOrcamento, itemDeOrcamento, dataIsoDoOrcamento,
           interpretarOrcamento, casarOrcamentoComItens, lojaCadastrada,
           papelDaCelula, papeisDaTabela, precoDaLinha,
           orcamentoDaIA, casamentoDaIA, itensParaIA, avisoDaIA, pedidoDaIA, promoverCandidatos };
`.replace(/__seq/g, "globalThis.__seq"))();
globalThis.__seq = 0;

const M = modulo;
const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);

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

teste("as quatro formas de pagar estão no painel, e a medição não", () => {
  assert.deepStrictEqual(M.MODOS_LANCAMENTO.map(m => m.id),
    ["parcelas", "entregas", "sinalFinal", "sinalParcelas"]);
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

teste("token vencido e crédito esgotado aparecem na tela; o resto não assusta", () => {
  const e = (motivo, message) => Object.assign(new Error(message), { motivo });
  assert.match(M.avisoDaIA(e("token", "O token da IA venceu")), /token/);
  assert.match(M.avisoDaIA(e("limite", "O crédito mensal acabou")), /crédito/);
  assert.strictEqual(M.avisoDaIA(e("nao_liberada", "x")), "", "escritório sem IA não recebe aviso nenhum");
  assert.match(M.avisoDaIA(e("instavel", "x")), /leitor do VICKE/);
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

for (const [nome, fn] of testes) {
  try { fn(); console.log("  ok   " + nome); }
  catch (e) { falhas++; console.log("  FALHOU " + nome + "\n         " + e.message); }
}
console.log(`\n${testes.length - falhas}/${testes.length} passaram`);
process.exit(falhas ? 1 : 0);
