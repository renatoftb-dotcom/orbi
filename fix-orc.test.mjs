// Testes das correções do orçamento de projeto (orcamento-teste.jsx,
// modelo-padrao.jsx, template-edicao.jsx, app.jsx) — node puro, sem framework.
//   node fix-orc.test.mjs
//
// Carrega só as partes puras (entre os marcadores "parte pura") e, para o
// cenário do número reusado, as regras do financeiro do escritório. O que é
// só de tela é conferido no texto do módulo (ver os testes "tela:").
process.env.TZ = process.env.TZ || "America/Sao_Paulo";

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import assert from "assert";

const raiz = dirname(fileURLToPath(import.meta.url));
const ler = (f) => readFileSync(join(raiz, "src", "modules", f), "utf8");
const trecho = (src, abre, fecha, nome) => {
  const a = src.indexOf(abre), b = src.indexOf(fecha, a);
  if (a < 0 || b < 0) throw new Error("Marcadores não encontrados: " + nome);
  return src.slice(a, b);
};

const orcSrc = ler("orcamento-teste.jsx");
const apiSrc = ler("api.js");
const puroOrc = trecho(orcSrc, "// ── Orçamento: parte pura", "// ── Orçamento: fim da parte pura", "orcamento-teste.jsx");
const mesclar = trecho(apiSrc, "function _igualJson", "// Grava um registro com versão", "api.js mesclar3");
const O = new Function(mesclar + "\n" + puroOrc + `
  return { orcHojeLocal, orcSomarMeses, orcDividirIgual, orcGerarParcelasIguais, orcRedimensionarParcelas,
    orcRemoverParcelaIgual, orcCascataParcela, orcTemParcelaSemValor, orcMaiorNumeroUsado, proximoIdOrcamento,
    orcValoresBase, orcValorTotal, orcOpcoesDoGanho, orcStatusAoSalvarRascunho, orcMesclarComAtual };`)();

const efArq = ler("escritorio-financeiro.jsx");
const F = new Function(efArq.slice(0, efArq.indexOf("// UI — daqui para baixo")) +
  "\nreturn { parcelasDosProjetos, lancamentosComGanhoRecebido };")();

const mpSrc = ler("modelo-padrao.jsx");
const E = new Function(trecho(mpSrc, "// ── Escopo: parte pura", "// ── Escopo: fim da parte pura", "modelo-padrao.jsx") +
  "\nreturn { escopoBlocoLivre, sincronizarEscopoComEtapas };")();

const teSrc = ler("template-edicao.jsx");
const T = new Function(trecho(teSrc, "function tplParseMoeda", "function TplInputMoeda", "template-edicao.jsx") +
  "\nreturn { tplParseMoeda, tplNumOu };")();

const appSrc = ler("app.jsx");

const testes = [];
let falhas = 0;
const teste = (nome, fn) => testes.push([nome, fn]);
const soma = (ps) => Math.round(ps.reduce((s, p) => s + p.valor, 0) * 100) / 100;

// ── 1. Número ORC nunca reusado ─────────────────────────────────
teste("1. Excluir o ORC de maior número não libera o número: o novo não herda recebimentos nem projeto", () => {
  const ganho = (id, cli, valor) => ({ id, clienteId: cli, status: "ganho", fechamento: { valorTotalFechado: valor, valorEngFechado: 0,
    condicao: { tipo: "parcelado", parcelas: [{ numero: 1, nome: "1ª Parcela", valor: valor / 2, data: "2026-10-01", recebida: true },
      { numero: 2, nome: "2ª Parcela", valor: valor / 2, data: "2026-11-01" }] } } });
  const clientes = [{ id: "C1", nome: "Ana" }, { id: "C2", nome: "Bruno" }];
  const data = { clientes, orcamentosProjeto: [ganho("ORC-0001", "C1", 1000), ganho("ORC-0002", "C1", 20000)], lancamentos: [], obras: [],
    projetos: [{ id: "PRJ-1", orcId: "ORC-0002" }] };
  data.lancamentos = F.lancamentosComGanhoRecebido(data, data.orcamentosProjeto[1]).lancamentos;
  assert.ok(data.lancamentos.some((l) => l.origem && l.origem.orcId === "ORC-0002"), "lançamento do ORC-0002 existe");
  data.orcamentosProjeto = data.orcamentosProjeto.filter((o) => o.id !== "ORC-0002");    // excluído
  const novoId = O.proximoIdOrcamento(data);
  assert.strictEqual(novoId, "ORC-0003");
  const novo = ganho(novoId, "C2", 8000); novo.fechamento.condicao.parcelas[0].recebida = false;
  const ps = F.parcelasDosProjetos([...data.orcamentosProjeto, novo], clientes, data.lancamentos).filter((p) => p.orcId === novoId);
  assert.deepStrictEqual(ps.map((p) => p.recebida), [false, false], "nenhuma parcela do novo aparece como recebida");
  assert.ok(!data.projetos.some((p) => p.orcId === novoId), "nenhum projeto aponta para o número novo");
});

teste("1. Número novo considera orcamentosProjeto, projetos, lançamentos e qualquer outro orcId", () => {
  assert.strictEqual(O.proximoIdOrcamento({}), "ORC-0001");
  assert.strictEqual(O.proximoIdOrcamento({ orcamentosProjeto: [{ id: "ORC-0004" }, { id: "X-9" }] }), "ORC-0005");
  assert.strictEqual(O.proximoIdOrcamento({ orcamentosProjeto: [{ id: "ORC-0004" }], projetos: [{ orcId: "ORC-0007" }] }), "ORC-0008");
  assert.strictEqual(O.proximoIdOrcamento({ orcamentosProjeto: [], lancamentos: [{ origem: { tipo: "projeto", orcId: "ORC-0012" } }] }), "ORC-0013");
  assert.strictEqual(O.proximoIdOrcamento({ receitasFinanceiro: [{ orcId: "ORC-0020" }], obras: [{ x: { y: [{ orc_id: "ORC-0021" }] } }] }), "ORC-0022");
  assert.strictEqual(O.proximoIdOrcamento({ orcamentosProjeto: [{ id: "ORC-9999" }] }), "ORC-10000");
});

teste("1. tela: app.jsx (orçamento em tela cheia) usa o mesmo cálculo do próximo número", () => {
  const a = appSrc.indexOf("<FormOrcamentoProjetoTeste"), b = appSrc.indexOf("onVoltar=", a);
  const onSalvar = appSrc.slice(a, b);
  assert.ok(/proximoIdOrcamento\(dataAtual\)/.test(onSalvar), "onSalvar chama proximoIdOrcamento");
  assert.ok(!/maxSeq/.test(onSalvar), "não calcula mais só pela lista");
  const s = orcSrc.slice(orcSrc.indexOf("async function salvarOrcamento"), orcSrc.indexOf("function abrirNovoOrcamento"));
  assert.ok(/proximoIdOrcamento\(dataAtual\)/.test(s));
});

// ── 2. PDFs só saem depois do ganho gravado ────────────────────
teste("2. tela: confirmarGanho só apaga os PDFs das outras versões depois do erro checado e no .then do save", () => {
  const s = orcSrc.slice(orcSrc.indexOf("async function confirmarGanho"), orcSrc.indexOf("async function salvarOrcamento"));
  const iErro = s.indexOf("if (recebido.erro)");
  const iApaga = s.indexOf("esquecerArquivoDaProposta(");
  assert.ok(iErro > 0 && iApaga > iErro, "apagar vem depois de checar recebido.erro");
  assert.ok(/\.then\(\(\) => \{ props\.forEach\(\(p, i\) => \{ if \(i !== iVer\) esquecerArquivoDaProposta\(p\)/.test(s), "apaga no .then do save");
  assert.strictEqual(s.split("esquecerArquivoDaProposta(").length - 1, 1, "uma chamada só");
});

// ── 3. Ver não rebaixa para rascunho ────────────────────────────
teste("3. Salvar rascunho não rebaixa ganho/perdido/aberto", () => {
  assert.strictEqual(O.orcStatusAoSalvarRascunho(null), "rascunho");
  assert.strictEqual(O.orcStatusAoSalvarRascunho({}), "rascunho");
  assert.strictEqual(O.orcStatusAoSalvarRascunho({ status: "rascunho" }), "rascunho");
  assert.strictEqual(O.orcStatusAoSalvarRascunho({ status: "ganho" }), "ganho");
  assert.strictEqual(O.orcStatusAoSalvarRascunho({ status: "perdido" }), "perdido");
  assert.strictEqual(O.orcStatusAoSalvarRascunho({ status: "aberto" }), "aberto");
});

teste("3. tela: TesteOrcamento passa modoVer ao formulário; salvarRascunhoEVoltar usa o status preservado", () => {
  const a = orcSrc.indexOf("<FormOrcamentoProjetoTeste"), b = orcSrc.indexOf("/>", a);
  assert.ok(orcSrc.slice(a, b).includes(`modoVer={modoAbertura === "ver" && (orcBase?.status || "rascunho") !== "rascunho"}`),
    "ver um ganho/perdido/aberto não pergunta; rascunho continua perguntando");
  const s = orcSrc.slice(orcSrc.indexOf("async function salvarRascunhoEVoltar"), orcSrc.indexOf("function descartarEVoltar"));
  assert.ok(/orcStatusAoSalvarRascunho\(orcBase\)/.test(s));
  assert.ok(!/status: "rascunho"/.test(s), "não força status rascunho");
});

// ── 4. Visualizador ─────────────────────────────────────────────
teste("4. tela: PropostaVisualizer da lista só recebe excluir versão/editar com permissão; salvarOrcamento travado", () => {
  const a = orcSrc.indexOf("<PropostaVisualizer"), b = orcSrc.indexOf("{/* Modal de confirmação de ganho */}", a);
  const v = orcSrc.slice(a, b);
  assert.ok(/aoExcluirVersao=\{!perm\.podeExcluir \? null :/.test(v));
  assert.ok(/onEditar=\{!perm\.podeEditar \? null :/.test(v));
  const s = orcSrc.slice(orcSrc.indexOf("async function salvarOrcamento"), orcSrc.indexOf("function abrirNovoOrcamento"));
  assert.ok(/if \(!perm\.podeEditar\) return;/.test(s));
});

// ── 5. Cascata de parcelas ──────────────────────────────────────
teste("5. Cascata: parcela não passa do que sobra; compensadora nunca negativa; parcela ≤ 0 trava", () => {
  let ps = [{ valor: 5000, data: "2026-10-24" }, { valor: 5000, data: "2026-11-24" }];
  ps = O.orcCascataParcela(ps, 0, 12000, 10000);
  assert.deepStrictEqual(ps.map((p) => p.valor), [10000, 0]);
  assert.strictEqual(soma(ps), 10000);
  assert.ok(ps.every((p) => p.valor >= 0));
  assert.strictEqual(O.orcTemParcelaSemValor(ps, 10000), true, "parcela zerada trava o Confirmar");
  const tres = [{ valor: 4000 }, { valor: 3000 }, { valor: 3000 }];
  assert.deepStrictEqual(O.orcCascataParcela(tres, 1, 2500, 10000).map((p) => p.valor), [4000, 2500, 3500]);
  assert.deepStrictEqual(O.orcCascataParcela(tres, 2, 9000, 10000).map((p) => p.valor), [0, 3000, 7000], "última: a 1ª compensa, limitada");
  assert.deepStrictEqual(O.orcCascataParcela(tres, 0, -2000, 10000).map((p) => p.valor), [0, 7000, 3000], "negativo vira 0");
  assert.strictEqual(O.orcTemParcelaSemValor([{ valor: 5000 }, { valor: 5000 }], 10000), false);
  assert.strictEqual(O.orcTemParcelaSemValor([{ valor: 10001 }, { valor: -1 }], 10000), true);
  assert.strictEqual(O.orcTemParcelaSemValor([{ valor: 0 }], 0), false, "ganho de valor zero continua confirmável");
});

// ── 6. Opções do ganho da versão escolhida ──────────────────────
teste("6. Desconto/nº de parcelas/tipo saem da versão escolhida, não da última", () => {
  const v1 = { tipoPgto: "padrao", descPacote: 0, parcPacote: 6, descArq: 2, parcArq: 2 };
  const v2 = { tipoPgto: "etapas", descPacCtrt: 20, parcPacCtrt: 10 };
  const orc = { tipoPgto: "etapas", propostas: [v1, v2] };
  const r1 = O.orcOpcoesDoGanho(orc, v1, true, true, []);
  assert.deepStrictEqual(r1, { descAntecipado: 0, qtdParcelado: 6, blocoLabel: "Pacote Completo" });
  const r2 = O.orcOpcoesDoGanho(orc, v2, true, true, [{ marcado: true }]);
  assert.deepStrictEqual(r2, { descAntecipado: 20, qtdParcelado: 10, blocoLabel: "Pacote de Etapas" });
  assert.deepStrictEqual(O.orcOpcoesDoGanho({}, null, true, false, []), { descAntecipado: 5, qtdParcelado: 3, blocoLabel: "Apenas Arquitetura" });
  const s = orcSrc.slice(orcSrc.indexOf("function ModalConfirmarGanho"), orcSrc.indexOf("// ── Cálculos derivados ──"));
  assert.ok(/orcOpcoesDoGanho\(orc, ultPropImp,/.test(s), "o modal passa a versão escolhida");
});

// ── 7. Datas no fim do mês ──────────────────────────────────────
teste("7. Parcelas no dia 29-31 não pulam fevereiro (último dia do mês)", () => {
  const ps = O.orcGerarParcelasIguais(4, 10000, "Parcela", "2026-01-31");
  assert.deepStrictEqual(ps.map((p) => p.data), ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  assert.deepStrictEqual(ps.map((p) => p.valor), [2500, 2500, 2500, 2500]);
  assert.deepStrictEqual(O.orcGerarParcelasIguais(3, 2028.31, "Parcela", "2027-12-29").map((p) => [p.data, p.valor]),
    [["2027-12-29", 676.11], ["2028-01-29", 676.1], ["2028-02-29", 676.1]]);
  assert.strictEqual(soma(O.orcGerarParcelasIguais(3, 2028.31, "Parcela", "2027-12-29")), 2028.31);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(O.orcHojeLocal()));
  const s = orcSrc.slice(orcSrc.indexOf("function ModalConfirmarGanho"), orcSrc.indexOf("function confirmar()", orcSrc.indexOf("function ModalConfirmarGanho")));
  const codigo = s.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(!/toISOString/.test(codigo), "o modal não usa mais toISOString para datas de parcela");
});

// ── 8. + Adicionar etapa ────────────────────────────────────────
teste("8. + Adicionar etapa: um mês depois da última, em data local; vazia não lança", () => {
  assert.strictEqual(O.orcSomarMeses("2026-03-01", 1), "2026-04-01");
  assert.strictEqual(O.orcSomarMeses("2026-05-31", 1), "2026-06-30");
  assert.strictEqual(O.orcSomarMeses("2026-06-15", 1), "2026-07-15");
  assert.strictEqual(O.orcSomarMeses("2026-01-31", 1), "2026-02-28");
  assert.strictEqual(O.orcSomarMeses("2026-12-10", 1), "2027-01-10");
  assert.strictEqual(O.orcSomarMeses("2026-03-31", -1), "2026-02-28");
  assert.doesNotThrow(() => O.orcSomarMeses("", 1));
  assert.strictEqual(O.orcSomarMeses("", 1), O.orcSomarMeses(O.orcHojeLocal(), 1));
  const s = orcSrc.slice(orcSrc.indexOf("function adicionarParcela"), orcSrc.indexOf("function removerParcela"));
  assert.ok(/orcSomarMeses\(ult && ult\.data, 1\)/.test(s) && !/new Date\(ult\.data\)/.test(s));
});

// ── 9. Rascunho com todos os campos ─────────────────────────────
teste("9. tela: salvarRascunhoEVoltar grava o mesmo objeto que Gerar Orçamento (montarOrcParaSalvar)", () => {
  const s = orcSrc.slice(orcSrc.indexOf("async function salvarRascunhoEVoltar"), orcSrc.indexOf("function descartarEVoltar"));
  assert.ok(/\.\.\.montarOrcParaSalvar\(\)\.orcParaSalvar/.test(s));
  const g = orcSrc.slice(orcSrc.indexOf("function gerarProposta()"), orcSrc.indexOf("function montarOrcParaSalvar()"));
  assert.ok(/montarOrcParaSalvar\(\)/.test(g));
  const m = orcSrc.slice(orcSrc.indexOf("function montarOrcParaSalvar()"), orcSrc.indexOf("if (propostaData) {", orcSrc.indexOf("function montarOrcParaSalvar()")));
  for (const campo of ["nUnidades", "repeticao", "qtdPavimentos", "vagasPorUnidade", "grupoQtds", "grupoParams", "incluiMarcenaria",
    "etapasIsoladas", "entArq, entPac", "formaPagamento", "resultado"]) assert.ok(m.includes(campo), "faltou " + campo);
});

// ── 10. Gravar sobre o registro atual ───────────────────────────
teste("10. Gravação junta com o registro atual: mudança da outra pessoa (após 409) não é desfeita", () => {
  const base = { id: "ORC-0003", status: "aberto", probabilidade: 50, referencia: "Casa A", _versao: 1 };
  const atual = { ...base, probabilidade: 75, _versao: 2 };                 // outra pessoa mudou
  const nosso = { ...base, referencia: "Casa B" };                          // o formulário mudou a referência
  const r = O.orcMesclarComAtual(base, nosso, atual);
  assert.strictEqual(r.probabilidade, 75, "mudança da outra pessoa fica");
  assert.strictEqual(r.referencia, "Casa B", "a nossa também");
  assert.strictEqual(r._versao, 2);
  // os dois mudaram o mesmo campo: vale o nosso (como a gravação do app)
  assert.strictEqual(O.orcMesclarComAtual(base, { ...base, probabilidade: 25 }, atual).probabilidade, 25);
  // novo, sem registro atual ou sem base: o que veio
  const novo = { referencia: "X" };
  assert.strictEqual(O.orcMesclarComAtual(null, novo, null), novo);
  assert.strictEqual(O.orcMesclarComAtual(null, nosso, atual), nosso);
  const s = orcSrc.slice(orcSrc.indexOf("async function salvarOrcamento"), orcSrc.indexOf("function abrirNovoOrcamento"));
  assert.ok(/orcMesclarComAtual\(orcBase, orc, atual\)/.test(s) && /dadosRef\.current/.test(s));
});

// ── 11. Engenharia não incluída ─────────────────────────────────
teste("11. Lista/ordenação/ganho não somam engenharia (ou arquitetura) que ficou de fora", () => {
  const semEng = { incluiEng: false, resultado: { precoArq: 1000, precoEng: 500 } };
  assert.strictEqual(O.orcValorTotal(semEng), 1000);
  assert.strictEqual(O.orcValorTotal({ resultado: { precoArq: 1000, precoEng: 500 } }), 1500);
  // proposta antiga sem arqEdit/engEdit: o calculo tem precoEng, mas a proposta não incluía
  const prop = { incluiEng: false, calculo: { precoArq: 2000, precoEng: 800 } };
  assert.strictEqual(O.orcValorTotal({ propostas: [prop] }), 2000);
  assert.deepStrictEqual(O.orcValoresBase({}, prop), { arq: 2000, eng: 0 });
  assert.deepStrictEqual(O.orcValoresBase({ incluiArq: false, resultado: { precoArq: 1, precoEng: 9 } }, null), { arq: 0, eng: 9 });
  assert.strictEqual(O.orcValorTotal({ propostas: [{ ...prop, valorTotalExibido: 2345 }] }), 2345, "valor exibido continua mandando");
  assert.ok(/orcValoresBase\(orc, ultPropImp\)/.test(orcSrc), "o modal de ganho usa orcValoresBase");
  assert.strictEqual((orcSrc.match(/const valorTotal = orcValorTotal\(orc\);/g) || []).length, 2, "card e linha da tabela");
});

// ── 12. Mudar nº de parcelas mantém datas ──────────────────────
teste("12. Mudar nº de parcelas/remover parcela mantém datas e nomes das que ficam", () => {
  const atuais = [{ nome: "1ª Parcela", valor: 3000, data: "2026-11-10" }, { nome: "2ª Parcela", valor: 3000, data: "2026-12-20" },
    { nome: "3ª Parcela", valor: 3000, data: "2027-02-05" }];
  const mais = O.orcRedimensionarParcelas(atuais, 4, 9000, "Parcela");
  assert.deepStrictEqual(mais.map((p) => [p.nome, p.data, p.valor]),
    [["1ª Parcela", "2026-11-10", 2250], ["2ª Parcela", "2026-12-20", 2250], ["3ª Parcela", "2027-02-05", 2250], ["4ª Parcela", "2027-03-05", 2250]]);
  const menos = O.orcRedimensionarParcelas(atuais, 2, 9000, "Parcela");
  assert.deepStrictEqual(menos.map((p) => [p.data, p.valor]), [["2026-11-10", 4500], ["2026-12-20", 4500]]);
  const sem2 = O.orcRemoverParcelaIgual(atuais, 1, 9000, "Parcela");
  assert.deepStrictEqual(sem2.map((p) => [p.nome, p.data, p.valor]), [["1ª Parcela", "2026-11-10", 4500], ["2ª Parcela", "2027-02-05", 4500]]);
  assert.strictEqual(soma(O.orcRedimensionarParcelas(atuais, 7, 1000, "Parcela")), 1000);
  assert.strictEqual(O.orcRemoverParcelaIgual([atuais[0]], 0, 9000, "Parcela").length, 1, "a única não sai");
});

// ── 13. Blocos livres do escopo ─────────────────────────────────
teste("13. Escopo: bloco livre (+ bloco) fica ao reabrir; bloco de etapa removida sai; sem Engenharia vai no fim", () => {
  const livre = { etapaId: 1761300000000, titulo: "Paisagismo", custom: true, isEng: false };
  const eng = { etapaId: 5, titulo: "Eng", isEng: true };
  const e6 = { etapaId: 6, titulo: "Interiores", custom: true, isEng: false };
  const prev = [{ etapaId: 1, titulo: "EV" }, { etapaId: 2, titulo: "EP" }, livre, e6, eng];
  const r = E.sincronizarEscopoComEtapas(prev, [{ id: 1 }, { id: 2 }]);
  assert.deepStrictEqual(r.map((b) => b.etapaId), [1, 2, 1761300000000, 5], "livre fica; etapa 6 removida sai");
  const r2 = E.sincronizarEscopoComEtapas([{ etapaId: 1, titulo: "EV" }, livre], [{ id: 1 }, { id: 7, nome: "Nova" }]);
  assert.deepStrictEqual(r2.map((b) => b.etapaId), [1, 1761300000000, 7], "sem Engenharia: etapa nova vai no fim");
  const r3 = E.sincronizarEscopoComEtapas([{ etapaId: 1 }, eng], [{ id: 1 }, { id: 7, nome: "Nova" }]);
  assert.deepStrictEqual(r3.map((b) => b.etapaId), [1, 7, 5], "com Engenharia: antes dela");
  assert.strictEqual(E.escopoBlocoLivre(e6), false);
});

// ── 14/15. Template de edição ───────────────────────────────────
teste("14. Template: 0% de desconto/entrada fica 0% (não vira o padrão)", () => {
  assert.strictEqual(T.tplNumOu(0, 5), 0);
  assert.strictEqual(T.tplNumOu("0", 10), 0);
  assert.strictEqual(T.tplNumOu(undefined, 15), 15);
  assert.strictEqual(T.tplNumOu(null, 50), 50);
  assert.strictEqual(T.tplNumOu("", 50), 50);
  assert.strictEqual(T.tplNumOu("abc", 5), 5);
  assert.strictEqual(T.tplNumOu(7.5, 5), 7.5);
  assert.ok(!/Number\(safeData\.desc[A-Za-z]+\) \|\|/.test(teSrc) && !/Number\(_fpFin\.ent[A-Za-z]+\) \|\|/.test(teSrc));
  assert.ok(!/orcBase\??\.(desc|ent)[A-Za-z]*\s*\|\|/.test(orcSrc), "o formulário também não troca 0% pelo padrão ao reabrir");
});

teste("15. Template: valor com ponto decimal (2500.50) é 2.500,50, não 250.050,00", () => {
  assert.strictEqual(T.tplParseMoeda("2500.50"), 2500.5);
  assert.strictEqual(T.tplParseMoeda("2500.5"), 2500.5);
  assert.strictEqual(T.tplParseMoeda("1.234,56"), 1234.56);
  assert.strictEqual(T.tplParseMoeda("1234,5"), 1234.5);
  assert.strictEqual(T.tplParseMoeda("2.500"), 2500);
  assert.strictEqual(T.tplParseMoeda("1.234.567"), 1234567);
  assert.strictEqual(T.tplParseMoeda("1.234.567,89"), 1234567.89);
  assert.strictEqual(T.tplParseMoeda(""), 0);
  assert.strictEqual(T.tplParseMoeda("abc"), 0);
});

for (const [nome, fn] of testes) {
  try { await fn(); console.log("  ok   " + nome); }
  catch (e) { falhas++; console.log("  FALHOU " + nome + "\n         " + e.message); }
}
console.log(`\n${testes.length - falhas}/${testes.length} passaram`);
process.exit(falhas ? 1 : 0);
