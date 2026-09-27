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
           efNumero, efCompetencia, lancamentosDoEscritorio };`)();

const testes = [];
const teste = (nome, fn) => testes.push([nome, fn]);
let falhas = 0;
const cent = (v) => Math.round(v * 100) / 100;

// ── Taxonomia ───────────────────────────────────────────────────
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
    { contaId: "emp_venda", unidadeId: "empreendimento", valor: 420000, competencia: "2026-09", empreendimentoId: "e1" }], "e1");
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

for (const [nome, fn] of testes) {
  try { fn(); console.log("  ok   " + nome); }
  catch (e) { falhas++; console.log("  FALHOU " + nome + "\n         " + e.message); }
}
console.log(`\n${testes.length - falhas}/${testes.length} passaram`);
process.exit(falhas ? 1 : 0);
