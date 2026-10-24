// Testes das correções da revisão de cotações (node, sem framework).
// Roda com: node fix-cot.test.mjs
// O usuário está no Brasil: a data "de hoje" é a local de UTC-3.
process.env.TZ = "America/Sao_Paulo";

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
const corteCp = (() => { const i = cpSrc.indexOf("// UI — gráfico do fluxo mensal"); return cpSrc.lastIndexOf("// ═", i); })();
const insSrc = mod("insumos.jsx");
const corteIns = insSrc.lastIndexOf("// ═", insSrc.indexOf("// CÓDIGO"));
const cotSrc = mod("cotacoes-obra.jsx");
const corteCot = cotSrc.indexOf("// UI — bloco de cotações da obra");
if (corteCot < 0) throw new Error("Marcador de início da UI não encontrado em cotacoes-obra.jsx");
const sharedSrc = mod("shared.jsx");
const recorte = (src, assinatura) => {
  const i = src.indexOf(assinatura);
  if (i < 0) throw new Error("Função não encontrada: " + assinatura);
  const fim = src.indexOf("\n}", i);
  return src.slice(i, fim + 2);
};
const utf8Src = recorte(sharedSrc, "function textoUtf8Recuperado(");
const clientesSrc = mod("clientes.jsx");

// Tudo o que o motor declara fica à mão pelo nome (Proxy + eval no escopo).
const M = new Function(`
  var __n = 0; var uid = () => "id" + (++__n);
  ${utf8Src}
  ${mod("obra-financeiro.jsx")}
  ${cronoSrc.slice(0, corteCrono)}
  ${contratosSrc.slice(0, corteCtr)}
  ${cpSrc.slice(0, corteCp)}
  var INSUMO_GRUPOS = [];
  ${insSrc.slice(0, corteIns)}
  ${cotSrc.slice(0, cotSrc.lastIndexOf("// ═", corteCot))}
  return new Proxy({}, { get: (_, k) => eval(k) });
`)();

// Corpo de uma função (do nome até a chave que fecha no nível dela).
const corpo = (src, assinatura) => {
  const i = src.indexOf(assinatura);
  if (i < 0) throw new Error("Não achei: " + assinatura);
  const ind = src.lastIndexOf("\n", i) + 1;
  const recuo = src.slice(ind, i);
  const fim = src.indexOf("\n" + recuo + "}", i);
  return src.slice(i, fim + recuo.length + 2);
};

const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);
const soma = (l) => Math.round(l.reduce((t, c) => t + c.valor, 0) * 100) / 100;

// ── 1. Total negociado chega às contas ──────────────────────────
const COT_NEG = () => ({ ...M.cotacaoVazia("o1"), id: "c1", titulo: "Cimento", contaId: "material", etapaId: "fundacao",
  itens: [{ id: "i1", descricao: "Cimento", unidade: "sc", quantidade: "10" }, { id: "i2", descricao: "Areia", unidade: "m3", quantidade: "2" }],
  propostas: [{ id: "p1", favorecido: "Loja", precos: { i1: 40, i2: 100 }, totalFechado: 500, valor: 500 }], escolhidaId: "p1" });

teste("1. proposta item a item com total fechado: as contas somam o negociado (500, não 600)", () => {
  const cot = COT_NEG();
  const esc = M.propostaEscolhida(cot);
  const med = M.medicaoDaCotacao(cot, esc, []);
  assert.strictEqual(M.totalDaMedicao(med), 500);
  const contas = M.contasDaCotacao({ ...M.dadosDoLancamento(cot), medicao: med, valor: M.totalDaMedicao(med) }, () => "x");
  assert.strictEqual(contas.length, 2);
  assert.strictEqual(soma(contas), 500);
});

teste("1. filhas de divisão com total ajustado lançam o total combinado", () => {
  let d = { ...M.cotacaoVazia("o1"), id: "d1", titulo: "Mat", contaId: "material", etapaId: "fundacao",
    itens: [{ id: "a", descricao: "A", quantidade: "1" }, { id: "b", descricao: "B", quantidade: "1" }],
    propostas: [{ id: "p1", favorecido: "L1", precos: { a: 100, b: 300 } }, { id: "p2", favorecido: "L2", precos: { a: 120, b: 250 } }] };
  d = M.escolherMaisBaratoEmCada(d);
  d = M.combinarTotalDaLoja(d, "p2", 200);
  const r = M.cotacoesDaDivisao(d, { quem: "x" });
  for (const f of r.filhas) {
    const esc = M.propostaEscolhida(f);
    const med = M.medicaoDaCotacao(f, esc, []);
    assert.strictEqual(M.totalDaMedicao(med), M.valorDaProposta(f, esc), f.titulo);
    const contas = M.contasDaCotacao({ ...M.dadosDoLancamento(f), medicao: med, valor: M.totalDaMedicao(med) }, () => "x");
    assert.strictEqual(soma(contas), M.valorDaProposta(f, esc), f.titulo);
  }
});

teste("1. desconto em centavos quebrados: a soma das contas fecha no centavo", () => {
  const cot = { ...COT_NEG(), itens: [{ id: "i1", descricao: "X", quantidade: "3" }, { id: "i2", descricao: "Y", quantidade: "7" }, { id: "i3", descricao: "Z", quantidade: "11" }],
    propostas: [{ id: "p1", favorecido: "L", precos: { i1: 13.37, i2: 9.99, i3: 4.41 }, totalFechado: 150 }] };
  const med = M.medicaoDaCotacao(cot, M.propostaEscolhida(cot), []);
  assert.strictEqual(M.totalDaMedicao(med), 150);
  const contas = M.contasDaCotacao({ ...M.dadosDoLancamento(cot), medicao: med, valor: M.totalDaMedicao(med) }, () => "x");
  assert.strictEqual(soma(contas), 150);
});

// ── 2. Conta do lançamento ─────────────────────────────────────
teste("2. cotação nova não nasce em conta de receita", () => {
  const c = M.cotacaoVazia("o");
  const conta = M.PLANO_CONTAS.find((x) => x.id === c.contaId);
  assert.ok(!conta || conta.grupo !== "receitas", c.contaId);
});

teste("2. cotação antiga com Depósito Recurso Próprio lança em conta de compra", () => {
  const cot = { ...M.cotacaoVazia("o1"), id: "c1", titulo: "Esquadrias", contaId: "deposito_proprio", etapaId: "fundacao",
    propostas: [{ id: "p1", favorecido: "Serralheria", valor: "12.500,00" }], escolhidaId: "p1" };
  const d = M.dadosDoLancamento(cot);
  assert.strictEqual(d.contaId, "material");
  assert.deepStrictEqual(M.contasDaCotacao(d, () => "x").map((c) => c.contaId), ["material"]);
});

teste("2. a conta escolhida no painel vale para os itens da medição", () => {
  const cot = COT_NEG();
  const med = M.medicaoDaCotacao(cot, M.propostaEscolhida(cot), []);
  const contas = M.contasDaCotacao({ ...M.dadosDoLancamento(cot), medicao: med, valor: 500, contaId: "frete" }, () => "x");
  assert.deepStrictEqual(contas.map((c) => c.contaId), ["frete", "frete"]);
});

// ── 3. IA sem crédito não trava a leitura ───────────────────────
teste("3. a tela de cotações declara o setIaDisponivel que as leituras chamam", () => {
  const v = corpo(cotSrc, "function CotacoesObraView(");
  assert.ok(/setIaDisponivel\(false\)/.test(v), "as leituras desligam a IA");
  assert.ok(/const setIaDisponivel\s*=/.test(v), "setIaDisponivel precisa existir no componente (senão ReferenceError no catch)");
});

// ── 4. Valor guardado velho ─────────────────────────────────────
const COT_VELHA = () => ({ ...M.cotacaoVazia("o1"), id: "c1", titulo: "Cimento", contaId: "material", etapaId: "fundacao",
  itens: [{ id: "i1", descricao: "Cimento", unidade: "sc", quantidade: "20" }],
  propostas: [{ id: "pA", favorecido: "A", precos: { i1: 40 }, valor: 400 }, { id: "pB", favorecido: "B", precos: { i1: 38 }, valor: 760 }] });

teste("4. quantidade mudou depois da proposta: comparação, contrato e lançamento usam o valor de agora", () => {
  const cot = COT_VELHA();
  assert.strictEqual(M.melhorProposta(cot).id, "pB");
  const e = M.economiaDaCotacao(cot);
  assert.deepStrictEqual([e.menor, e.maior], [760, 800]);
  const comA = { ...cot, escolhidaId: "pA" };
  assert.strictEqual(M.dadosDoContratoDaCotacao(comA).valor, 800);
  assert.strictEqual(M.dadosDoLancamento(comA).valor, 800);
});

teste("4. salvar a cotação refaz o total guardado de cada proposta item a item", () => {
  const r = M.comValoresDasPropostas(COT_VELHA());
  assert.deepStrictEqual(r.propostas.map((p) => p.valor), [800, 760]);
  const semLista = { propostas: [{ id: "p", valor: "12.000,00" }] };
  assert.strictEqual(M.comValoresDasPropostas(semLista), semLista, "proposta de total digitado não é mexida");
});

// ── 5. NF-e em XML ──────────────────────────────────────────────
const XML = `<nfeProc><NFe><infNFe Id="NFe35261012345678000199550010000012341000012345" versao="4.00"><ide><nNF>1234</nNF><dhEmi>2026-10-20T10:00:00-03:00</dhEmi></ide><emit><CNPJ>12345678000199</CNPJ><xNome>LOJA X</xNome></emit>
<det nItem="1"><prod><cProd>1</cProd><xProd>CIMENTO CP II 50KG</xProd><uCom>SC</uCom><qCom>20.0000</qCom><vUnCom>40.0000000000</vUnCom><vProd>800.00</vProd></prod></det>
<det nItem="2"><prod><cProd>2</cProd><xProd>AREIA MEDIA</xProd><uCom>M3</uCom><qCom>2.0000</qCom><vUnCom>100.00</vUnCom><vProd>200.00</vProd></prod></det>
<total><ICMSTot><vProd>1000.00</vProd><vFrete>80.00</vFrete><vIPI>20.00</vIPI><vDesc>50.00</vDesc><vNF>1050.00</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;

teste("5. NF-e: frete e IPI viram linhas do papel e a entrada fecha com o vNF, sem falso aviso", () => {
  const f = M.fichaDoXmlDaNfe(XML);
  assert.deepStrictEqual(f.itens.map((i) => [i.descricao, i.total]).slice(2), [["Frete", 80], ["IPI", 20]]);
  assert.strictEqual(f.itens[2].contaId, "frete");
  // a conta da tela (EntradaUnica): soma dos itens − desconto contra papel.total
  const totalDaEntrada = Math.round((f.itens.reduce((t, x) => t + M.brutoDoItem({ ...x, bruto: x.total }), 0) - f.papel.desconto) * 100) / 100;
  assert.strictEqual(totalDaEntrada, 1050);
  assert.strictEqual(f.papel.total, 1050);
  assert.deepStrictEqual(f.avisos, []);
});

teste("5. NF-e com campo que não se lê como linha: aviso claro em vez de silêncio", () => {
  const f = M.fichaDoXmlDaNfe(XML.replace("<vNF>1050.00</vNF>", "<vICMSDeson>10.00</vICMSDeson><vNF>1040.00</vNF>"));
  assert.strictEqual(f.avisos.length, 1);
  assert.ok(/1050,00.*1040,00/.test(f.avisos[0]), f.avisos[0]);
});

// ── 6. Apagar pedido/conta solta a cotação de origem ────────────
teste("6. apagar o pedido ou a conta da loja solta a cotação que tinha virado pedido", () => {
  const cots = [
    { id: "a", pedidoNaLoja: { contaLojaId: "loja1", pedidoId: "ped1" } },
    { id: "b", pedidoNaLoja: { contaLojaId: "loja1", pedidoId: "ped2" } },
    { id: "c", pedidoNaLoja: { contaLojaId: "loja2", pedidoId: "ped3" } },
  ];
  assert.deepStrictEqual(M.soltarPedidoNaLoja(cots, { pedidoIds: ["ped1"] }).map((c) => !!c.pedidoNaLoja), [false, true, true]);
  assert.deepStrictEqual(M.soltarPedidoNaLoja(cots, { contaLojaId: "loja1" }).map((c) => !!c.pedidoNaLoja), [false, false, true]);
  assert.strictEqual(M.situacaoCotacao(M.soltarPedidoNaLoja(cots, { pedidoIds: ["ped1"] })[0], []).id !== "naLoja", true);
});

teste("6. excluirPedidoDaLoja e apagarContaDeLoja usam o soltarPedidoNaLoja", () => {
  assert.ok(/soltarPedidoNaLoja\(/.test(corpo(clientesSrc, "function excluirPedidoDaLoja(")));
  assert.ok(/soltarPedidoNaLoja\(/.test(corpo(cotSrc, "async function apagarContaDeLoja(")));
});

// ── 7. Desfazer com parcela paga ────────────────────────────────
teste("7. desfazer o lançamento trava quando alguma conta já foi paga", () => {
  const contas = [{ id: "1", cotacaoId: "c1", valor: 1000, pago: true }, { id: "2", cotacaoId: "c1", valor: 2000, pago: false }];
  const r = M.podeDesfazerLancamento({ id: "c1" }, contas);
  assert.strictEqual(r.pode, false);
  assert.ok(/Desfaça o pagamento/.test(r.motivo));
  assert.strictEqual(M.podeDesfazerLancamento({ id: "c1" }, [contas[1]]).pode, true);
  assert.strictEqual(M.podeDesfazerLancamento({ id: "c2" }, contas).pode, true);
  assert.ok(/podeDesfazerLancamento\(/.test(corpo(clientesSrc, "function desfazerLancamentoDaCotacao(")));
});

// ── 8. Aprovação vale para o valor aprovado ─────────────────────
teste("8. editar a proposta aprovada (outro valor) pede nova aprovação; mesmo valor segue aprovado", () => {
  const cot = M.enviarCotacaoAoCliente({ ...COT_NEG(), precisaAprovacaoCliente: true, contaId: "esquadria" }, "R", "2026-10-01T12:00:00.000Z");
  const ap = M.registrarAprovacaoCotacao([], { cotacaoId: "c1", propostaId: "p1", status: "aprovada", por: "Cli", valor: 500 });
  assert.strictEqual(ap[0].valor, 500);
  assert.strictEqual(M.aprovacaoDaEscolha(cot, ap).status, "aprovada");
  const editada = { ...cot, propostas: [{ ...cot.propostas[0], totalFechado: 560 }] };
  const a2 = M.aprovacaoDaEscolha(editada, ap);
  assert.strictEqual(a2.status, "pendente");
  assert.strictEqual(a2.precisaReaprovar, true);
  assert.strictEqual(M.situacaoCotacao(editada, ap).id, "aguardando");
  assert.strictEqual(M.podeGerarContrato(editada, ap, []).pode, false);
  // registro antigo, sem valor, continua valendo
  const legado = M.registrarAprovacaoCotacao([], { cotacaoId: "c1", propostaId: "p1", status: "aprovada", por: "Cli" });
  assert.strictEqual(M.aprovacaoDaEscolha(editada, legado).status, "aprovada");
});

teste("8. a decisão gravada na tela leva o valor da proposta", () => {
  assert.ok(/valor:\s*escAtual \? valorDaProposta\(/.test(corpo(cotSrc, "function confirmarDecisao(")));
});

// ── 9. Ações financeiras só do escritório ───────────────────────
teste("9. lançar, desfazer e apagar pedido checam a permissão do escritório", () => {
  for (const f of ["function lancarCotacaoEmContas(", "function desfazerLancamentoDaCotacao(", "function excluirPedidoDaLoja("]) {
    assert.ok(/if \(!perm\.podeGerenciarObra\) return \{ erro:/.test(corpo(clientesSrc, f)), f);
  }
  const v = corpo(cotSrc, "function CotacoesObraView(");
  assert.ok(/const podeFinanceiro = ehEscritorio;/.test(v));
  for (const f of ["function abrirLancamento(", "function mandarParaContaDaLoja(", "async function desfazerLancamento(", "async function excluirProposta("]) {
    assert.ok(/if \(!podeFinanceiro\)/.test(corpo(cotSrc, f)), f);
  }
  assert.ok(/esc && destino === "pedido" && podeFinanceiro && \(/.test(v), "Gerar pedido");
  assert.ok(/podeFinanceiro && escolhida && cot\.contaGeradaId/.test(v), "Desfazer lançamento");
  assert.ok(/podeFinanceiro && !cot\.contaGeradaId && !cot\.pedidoNaLoja/.test(v), "Excluir proposta");
});

// ── 10. Preço da linha do papel ─────────────────────────────────
teste("10. linha com total e quantidade própria: unitário pela quantidade da linha", () => {
  const item = { id: "i1", descricao: "Cimento CP II 50kg", unidade: "sc", quantidade: "10" };
  assert.strictEqual(M.precoDaLinha({ descricao: "Cimento CP II 50kg", quantidade: 20, unidade: "sc", total: 800 }, 10, item), 40);
  // sem quantidade na linha, o total é do pedido inteiro
  assert.strictEqual(M.precoDaLinha({ descricao: "Cimento", unidade: "sc", total: 800 }, 10, item), 80);
});

// ── 11. Data local ──────────────────────────────────────────────
teste("11. proposta lida às 22h30 no Brasil é recebida hoje, não amanhã", () => {
  const RealDate = Date;
  const fixo = new RealDate("2026-10-24T22:30:00-03:00").getTime();
  globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [fixo])); } static now() { return fixo; } };
  try {
    const r = M.propostaDaEntrada({ obraId: "o1", itens: [{ descricao: "Cimento CP II", quantidade: 10, unitario: 40, bruto: 400 }], loja: { id: "f1", nome: "Loja" }, papel: {} });
    assert.strictEqual(r.proposta.recebidaEm, "2026-10-24");
  } finally { globalThis.Date = RealDate; }
});

// ── 12. Acréscimo no fechamento ─────────────────────────────────
teste("12. total fechado acima da soma: o pedido leva o acréscimo", () => {
  const cot = { ...M.cotacaoVazia("o1"), id: "c1", titulo: "Mat", contaId: "material", etapaId: "fundacao",
    itens: [{ id: "i1", descricao: "Cimento", unidade: "sc", quantidade: "10" }],
    propostas: [{ id: "p1", favorecido: "L", precos: { i1: 40 }, totalFechado: 450 }], escolhidaId: "p1" };
  const ped = M.pedidoDaCotacao(cot, M.propostaEscolhida(cot), [], 30);
  assert.strictEqual(M.totalDoPedido(ped), 450);
  assert.strictEqual(soma(M.itensRateados(ped)), 450);
  // e o desconto continua como era
  const comDesc = { ...cot, propostas: [{ ...cot.propostas[0], totalFechado: 360 }] };
  assert.strictEqual(M.pedidoDaCotacao(comDesc, M.propostaEscolhida(comDesc), [], 30).desconto, 40);
});

// ── 13. Virou pedido na loja: escolha e propostas travadas ──────
teste("13. com pedido na loja, Escolher/Desfazer e Excluir proposta somem e o handler recusa", () => {
  const v = corpo(cotSrc, "function CotacoesObraView(");
  assert.ok(/\{!cot\.contaGeradaId && !cot\.pedidoNaLoja && !contratoDaCotacao\(contratos, cot\.id\) && !cot\.divisaoDe && \(\s*<button style=\{isMobile && !escolhida/.test(v), "Escolher");
  assert.ok(/if \(cot\.pedidoNaLoja\) \{ setErro\(/.test(corpo(cotSrc, "async function excluirProposta(")));
});

// ── 14. Etapa do item na medição ────────────────────────────────
teste("14. a medição respeita a etapa própria do item, como o pedido", () => {
  const cot = { ...COT_NEG(), itens: [{ id: "i1", descricao: "Cimento", quantidade: "10", etapa: "alvenaria" }, { id: "i2", descricao: "Areia", quantidade: "2" }] };
  const med = M.medicaoDaCotacao(cot, M.propostaEscolhida(cot), []);
  assert.deepStrictEqual(med.map((r) => r.etapa), ["alvenaria", "fundacao"]);
  const ped = M.pedidoDaCotacao(cot, M.propostaEscolhida(cot), [], 0);
  assert.deepStrictEqual(ped.itens.map((r) => r.etapa), med.map((r) => r.etapa));
});

let falhas = 0;
for (const [nome, fn] of testes) {
  try { fn(); console.log("  ok   " + nome); }
  catch (e) { falhas++; console.log("  FALHOU " + nome + "\n         " + e.message); }
}
console.log(`\n${testes.length - falhas}/${testes.length} passaram`);
process.exit(falhas ? 1 : 0);
