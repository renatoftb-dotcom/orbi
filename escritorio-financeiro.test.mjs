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
           efCsvParaTsv, efAbaDeLancamentos, efTextoDoArquivo };`)();

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

for (const [nome, fn] of testes) {
  try { await fn(); console.log("  ok   " + nome); }
  catch (e) { falhas++; console.log("  FALHOU " + nome + "\n         " + e.message); }
}
console.log(`\n${testes.length - falhas}/${testes.length} passaram`);
process.exit(falhas ? 1 : 0);
