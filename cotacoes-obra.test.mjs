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
const cotSrc = mod("cotacoes-obra.jsx");
const corteCot = cotSrc.indexOf("// UI — bloco de cotações da obra");
if (corteCot < 0) throw new Error("Marcador de início da UI não encontrado em cotacoes-obra.jsx");

let seq = 0;
const modulo = new Function(`
  var uid = () => "id" + (++__seq);
  ${mod("obra-financeiro.jsx")}
  ${cronoSrc.slice(0, corteCrono)}
  ${contratosSrc.slice(0, corteCtr)}
  ${cpSrc.slice(0, corteCp)}
  ${cotSrc.slice(0, cotSrc.lastIndexOf("// ═", corteCot))}
  return { cotacaoVazia, propostaVazia, valorProposta, propostasOrdenadas, propostaPorId,
           propostaEscolhida, melhorProposta, economiaDaCotacao,
           aprovacaoDaCotacao, registrarAprovacaoCotacao, situacaoCotacao,
           podeGerarContrato, contratoDaCotacao, tipoDoContaId, dadosDoContratoDaCotacao,
           podeExcluirCotacaoComContratos, resumoCotacoes, cotacoesAguardandoCliente,
           nomeDoFornecedor, PLANO_CONTAS,
           podeExcluirCotacao, removerProposta, removerCotacao, anexosDasPropostas,
           prestadorRapidoVazio, criarPrestadorRapido, pareceMesmoPdf,
           nomeDeQuem, carimbar, textoAutoria };
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

  const escolhida = { ...comprando, escolhidaId: "p1" };
  assert.strictEqual(M.situacaoCotacao(escolhida, []).id, "aguardando");

  const semAval = { ...escolhida, precisaAprovacaoCliente: false };
  assert.strictEqual(M.situacaoCotacao(semAval, []).id, "escolhida");

  const ap = M.registrarAprovacaoCotacao([], { cotacaoId: "ct1", propostaId: "p1", status: "aprovada", por: "Cliente" });
  assert.strictEqual(M.situacaoCotacao(escolhida, ap).id, "aprovada");

  const rec = M.registrarAprovacaoCotacao([], { cotacaoId: "ct1", status: "recusada", por: "Cliente" });
  assert.strictEqual(M.situacaoCotacao(escolhida, rec).id, "recusada");

  // é o CONTRATO que fecha o ciclo — e a cotação lançada pelo fluxo antigo
  // continua lendo como concluída
  const comContrato = [{ id: "ctr1", cotacaoId: "ct1" }];
  assert.strictEqual(M.situacaoCotacao(escolhida, ap, comContrato).id, "contratada");
  assert.strictEqual(M.situacaoCotacao({ ...escolhida, contaGeradaId: "x" }, ap).id, "contratada");
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
  const a = { ...comPropostas([9000, 12000]), id: "a", escolhidaId: "p0" };            // aguardando
  const b = { ...comPropostas([5000, 8000]), id: "b", escolhidaId: "p0" };             // aprovada
  const c = { ...comPropostas([1000, 4000]), id: "c" };                                 // comparando
  const aprov = M.registrarAprovacaoCotacao([], { cotacaoId: "b", status: "aprovada", por: "C" });
  const r = M.resumoCotacoes([a, b, c], aprov);
  assert.strictEqual(r.total, 3);
  assert.strictEqual(r.abertas, 1);
  assert.strictEqual(r.aguardandoCliente, 1);
  assert.strictEqual(r.aprovadas, 1);
  assert.strictEqual(r.economia, 3000); // só a de "b"; a de "a" ainda não foi aprovada
});

teste("a fila do cliente traz só o que depende dele", () => {
  const a = { ...comPropostas([9000, 12000]), id: "a", escolhidaId: "p0" };
  const b = { ...comPropostas([5000, 8000]), id: "b" };
  const fila = M.cotacoesAguardandoCliente([a, b], []);
  assert.deepStrictEqual(fila.map(c => c.id), ["a"]);
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

let falhas = 0;
for (const [nome, fn] of testes) {
  try { fn(); console.log("  ok   " + nome); }
  catch (e) { falhas++; console.log("  FALHOU " + nome + "\n         " + e.message); }
}
console.log(`\n${testes.length - falhas}/${testes.length} passaram`);
process.exit(falhas ? 1 : 0);
