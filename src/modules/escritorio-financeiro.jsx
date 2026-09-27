// ═══════════════════════════════════════════════════════════════
// ESCRITÓRIO-FINANCEIRO — Taxonomia e cálculo do extrato do escritório
// ═══════════════════════════════════════════════════════════════
// Nasce da planilha que o escritório usa desde 2020 (4.780 lançamentos,
// jan/2020 a nov/2026). Lá são duas abas: uma base de dados, uma linha por
// lançamento, e um P&L mensal montado a partir dela. O P&L não tem fórmula
// nenhuma — são valores colados —, e é esse o motivo deste módulo existir:
// aqui a conta é feita na hora, a partir dos lançamentos.
//
// A regra de ouro da migração: os saldos mensais fechados contra o extrato
// bancário até agosto/2026 NÃO mudam. Podemos reclassificar conta, renomear
// e reagrupar; a matemática e o saldo final de cada mês continuam iguais.
// Por isso a conta de cada bloco é uma soma por conta contábil e mês, do
// mesmo jeito que a planilha faz — e os testes conferem os 83 meses.
//
// Nesta primeira entrega o módulo tem SÓ a taxonomia, as regras de
// validação e o cálculo. Nenhuma UI. Os `id` de conta e unidade são chave
// gravada no lançamento: nunca renomear nem reordenar depois que houver
// dado gravado.
// ═══════════════════════════════════════════════════════════════

// ── Unidades de negócio ─────────────────────────────────────────
// É o eixo que diz de quem é o dinheiro, e ele decide o resto:
//  - Escritório      — o que é do escritório, e é o único que forma resultado.
//  - Projetos        — honorário e custo direto de um projeto.
//  - Gestão de obras — dinheiro do cliente que só PASSA pela conta do
//                      escritório: ele deposita, o escritório paga a obra.
//  - Empreendimento  — investimento do próprio escritório (terreno, casa
//                      para vender). Não é despesa: vira valor do imóvel, e
//                      só vira resultado no dia da venda.
const UNIDADES_NEGOCIO = [
  { id: "escritorio",     nome: "Escritório",      exigeCliente: false, exigeObra: false, exigeEmpreendimento: false },
  { id: "projetos",       nome: "Projetos",        exigeCliente: true,  exigeObra: false, exigeEmpreendimento: false },
  { id: "gestao_obras",   nome: "Gestão de obras", exigeCliente: true,  exigeObra: true,  exigeEmpreendimento: false },
  { id: "empreendimento", nome: "Empreendimento",  exigeCliente: false, exigeObra: false, exigeEmpreendimento: true  },
];

// ── Blocos do extrato ───────────────────────────────────────────
// `sinal` é o que o bloco faz com o dinheiro na conta bancária (+1 entra,
// -1 sai). `resultado` diz se o bloco forma o resultado do escritório —
// dinheiro de cliente em trânsito e investimento em imóvel não formam.
const GRUPOS_ESCRITORIO = [
  { id: "gestao_entradas", titulo: "ENTRADAS GESTÃO",      sinal: +1, resultado: false, bloco: "gestao" },
  { id: "gestao_saidas",   titulo: "SAÍDAS GESTÃO",        sinal: -1, resultado: false, bloco: "gestao" },
  { id: "receitas",        titulo: "RECEITAS ESCRITÓRIO",  sinal: +1, resultado: true,  bloco: "escritorio" },
  { id: "despesas",        titulo: "DESPESAS ESCRITÓRIO",  sinal: -1, resultado: true,  bloco: "escritorio" },
  { id: "emp_entradas",    titulo: "VENDAS DE EMPREENDIMENTO", sinal: +1, resultado: false, bloco: "empreendimento" },
  { id: "emp_saidas",      titulo: "INVESTIMENTO EM EMPREENDIMENTO", sinal: -1, resultado: false, bloco: "empreendimento" },
  { id: "socios",          titulo: "RETIRADAS E OUTROS",   sinal: -1, resultado: false, bloco: "socios" },
  { id: "socios_entradas", titulo: "DEVOLUÇÕES E APORTES", sinal: +1, resultado: false, bloco: "socios" },
];

// ── Plano de contas ─────────────────────────────────────────────
// `apelidos` são os nomes exatos que aparecem na planilha — é por eles que
// o importador reconhece o histórico. A comparação ignora maiúsculas e
// acentos, como o SOMASE do Excel faz.
const PLANO_CONTAS_ESCRITORIO = [
  // ── entradas de gestão (dinheiro do cliente) ──────────────
  { id: "dep_consignacao", nome: "Depósito em consignação", grupo: "gestao_entradas", unidades: ["gestao_obras"],
    apelidos: ["Depósito em consignação"] },
  { id: "reembolsos",      nome: "Reembolsos",              grupo: "gestao_entradas", unidades: ["gestao_obras", "projetos"],
    apelidos: ["Reembolsos"] },

  // ── saídas de gestão ──────────────────────────────────────
  { id: "pagamentos_compras", nome: "Pagamentos e compras", grupo: "gestao_saidas", unidades: ["gestao_obras", "projetos"],
    apelidos: ["Pagamentos e compras"] },

  // ── receitas do escritório ────────────────────────────────
  { id: "rec_projetos",   nome: "Receita Projetos",  grupo: "receitas", unidades: ["projetos", "escritorio"],
    apelidos: ["Receita Projetos", "Receita projetos"] },
  { id: "rec_gestao",     nome: "Receita Gestão",    grupo: "receitas", unidades: ["gestao_obras", "escritorio"],
    apelidos: ["Receita Gestão"] },
  { id: "rec_comissoes",  nome: "Receita Comissões", grupo: "receitas", unidades: ["escritorio", "projetos"],
    apelidos: ["Receita Comissões"] },
  { id: "rec_financeira", nome: "Receita Financeira", grupo: "receitas", unidades: ["escritorio"],
    apelidos: ["Receita Financeira"] },

  // ── despesas do escritório ────────────────────────────────
  { id: "parceiros",        nome: "Parceiros Arquitetos e Engenheiros", grupo: "despesas", unidades: ["escritorio", "projetos"],
    apelidos: ["Parceiros Arquitetos e Engenheiros"] },
  { id: "marketing",        nome: "Marketing e Publicidade",  grupo: "despesas", unidades: ["escritorio"], apelidos: ["Marketing e Publicidade"] },
  { id: "cartao_credito",   nome: "Cartão de crédito",        grupo: "despesas", unidades: ["escritorio"], apelidos: ["Cartão de crédito"] },
  { id: "luz_agua_net",     nome: "Luz, Água e Internet",     grupo: "despesas", unidades: ["escritorio"], apelidos: ["Luz, Água e Internet"] },
  { id: "jardim_limpeza",   nome: "Jardim e limpeza",         grupo: "despesas", unidades: ["escritorio"], apelidos: ["Jardim e limpeza"] },
  { id: "contabilidade",    nome: "Contabilidade e outros",   grupo: "despesas", unidades: ["escritorio"], apelidos: ["Contabilidade e outros"] },
  { id: "utensilios",       nome: "Utensílios em geral",      grupo: "despesas", unidades: ["escritorio"], apelidos: ["Utensílios em geral"] },
  { id: "imobilizado",      nome: "Investimento (Máquinas, reforma)", grupo: "despesas", unidades: ["escritorio"],
    apelidos: ["Investimento (Máquinas, reforma)"] },
  { id: "taxas_impostos",   nome: "Taxas e impostos",         grupo: "despesas", unidades: ["escritorio", "projetos"], apelidos: ["Taxas e impostos"] },
  { id: "rrt_impressoes",   nome: "RRTs e Impressões",        grupo: "despesas", unidades: ["escritorio", "projetos"], apelidos: ["RRTs e Impressões"] },
  { id: "desp_outros",      nome: "Outros",                   grupo: "despesas", unidades: ["escritorio"], apelidos: ["Outros"] },

  // ── empreendimento (novo) ─────────────────────────────────
  // Enquanto constrói, cada custo soma no valor do imóvel e não no
  // resultado do mês. No dia da venda, a receita entra e o custo
  // acumulado sai de uma vez — é lá que o lucro aparece.
  { id: "emp_terreno",    nome: "Aquisição de terreno",   grupo: "emp_saidas",   unidades: ["empreendimento"], apelidos: [] },
  { id: "emp_construcao", nome: "Construção",             grupo: "emp_saidas",   unidades: ["empreendimento"], apelidos: [] },
  { id: "emp_taxas",      nome: "Taxas e registros",      grupo: "emp_saidas",   unidades: ["empreendimento"], apelidos: [] },
  { id: "emp_corretagem", nome: "Corretagem",             grupo: "emp_saidas",   unidades: ["empreendimento"], apelidos: [] },
  { id: "emp_venda",      nome: "Venda de imóvel",        grupo: "emp_entradas", unidades: ["empreendimento"], apelidos: [] },

  // ── sócios (não é resultado; é conta corrente) ────────────
  // O escritório paga algo do sócio pela conta dele e depois é reembolsado.
  // Isso não é despesa nem receita: é dinheiro indo e voltando, e some
  // quando as duas pontas se encontram.
  { id: "retiradas_socios",  nome: "Retiradas Sócios",       grupo: "socios",          unidades: ["escritorio"], apelidos: ["Retiradas Sócios"] },
  { id: "emprestimos",       nome: "Empréstimos",            grupo: "socios",          unidades: ["escritorio"], apelidos: ["Empréstimos"] },
  { id: "adiant_socio",      nome: "Adiantamento a sócio",   grupo: "socios",          unidades: ["escritorio"], apelidos: [] },
  { id: "reemb_socio",       nome: "Reembolso de sócio",     grupo: "socios_entradas", unidades: ["escritorio"], apelidos: [] },
];

// ── Texto sem acento e sem caixa, para casar apelido ────────────
function efSemAcento(t) {
  return String(t == null ? "" : t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function contaEscritorio(id) {
  return PLANO_CONTAS_ESCRITORIO.find((c) => c.id === id) || null;
}

function grupoEscritorio(id) {
  return GRUPOS_ESCRITORIO.find((g) => g.id === id) || null;
}

// Nome da planilha → id da conta. O que não casa volta null e vai para a
// fila de classificação do importador: a planilha tem seis linhas com
// conta de obra (Empreiteiro, Serralheiro, Frete) que o P&L dela também
// não soma em lugar nenhum.
function contaPeloApelido(nome) {
  const alvo = efSemAcento(nome);
  if (!alvo) return null;
  for (const c of PLANO_CONTAS_ESCRITORIO) {
    if (efSemAcento(c.nome) === alvo) return c.id;
    for (const a of c.apelidos || []) if (efSemAcento(a) === alvo) return c.id;
  }
  return null;
}

function unidadePeloApelido(nome) {
  const alvo = efSemAcento(nome);
  if (!alvo) return null;
  const u = UNIDADES_NEGOCIO.find((x) => efSemAcento(x.nome) === alvo || x.id === alvo);
  return u ? u.id : null;
}

// ── Regras do lançamento novo ───────────────────────────────────
// Valem do corte em diante. O histórico importado entra como está: ele já
// foi conferido contra o extrato, e reescrever o passado mudaria saldo.
function validarLancamentoEscritorio(l) {
  const erros = [];
  const lan = l || {};
  const conta = contaEscritorio(lan.contaId);
  if (!conta) erros.push("Escolha a conta.");
  if (!lan.competencia || !/^\d{4}-\d{2}$/.test(String(lan.competencia))) erros.push("Informe o mês de competência.");
  const valor = Number(lan.valor);
  if (!Number.isFinite(valor) || valor === 0) erros.push("Informe o valor.");

  const unidade = UNIDADES_NEGOCIO.find((u) => u.id === lan.unidadeId);
  if (!unidade) erros.push("Escolha a unidade de negócio.");
  if (conta && unidade && (conta.unidades || []).length && !conta.unidades.includes(unidade.id)) {
    const nomes = conta.unidades.map((id) => (UNIDADES_NEGOCIO.find((u) => u.id === id) || {}).nome).filter(Boolean);
    erros.push(`A conta “${conta.nome}” não é do Escritório: escolha ${nomes.join(" ou ")}.`);
  }
  if (unidade && unidade.exigeCliente && !lan.clienteId) erros.push("Informe o cliente.");
  if (unidade && unidade.exigeObra && !lan.obraId) erros.push("Informe a obra.");
  if (unidade && unidade.exigeEmpreendimento && !lan.empreendimentoId) erros.push("Informe o empreendimento.");
  return erros;
}

// ── Cálculo ─────────────────────────────────────────────────────
// Uma soma por conta e mês, como a planilha faz. O sinal vem do grupo, e
// não do valor: na base tudo é positivo, e os poucos negativos são estorno
// dentro do próprio grupo.
function mesesEntreEscritorio(de, ate) {
  const meses = [];
  if (!/^\d{4}-\d{2}$/.test(String(de)) || !/^\d{4}-\d{2}$/.test(String(ate))) return meses;
  let [a, m] = String(de).split("-").map(Number);
  const [aF, mF] = String(ate).split("-").map(Number);
  while (a < aF || (a === aF && m <= mF)) {
    meses.push(`${a}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; a++; }
  }
  return meses;
}

const efCentavos = (v) => Math.round((Number(v) || 0) * 100) / 100;

// Devolve, por mês: o valor de cada conta, o total de cada grupo, os saldos
// de cada bloco e o saldo do extrato acumulado.
//
//   saldo do extrato = saldo anterior + saldo da gestão + saldo do
//                      escritório − retiradas + saldo do empreendimento
//
// É a mesma conta da planilha, com o bloco de empreendimento a mais.
function extratoEscritorio(lancamentos, opcoes) {
  const o = opcoes || {};
  const lista = (lancamentos || []).filter((l) => l && /^\d{4}-\d{2}$/.test(String(l.competencia)));
  const todos = lista.map((l) => String(l.competencia)).sort();
  const de = o.de || todos[0] || "";
  const ate = o.ate || todos[todos.length - 1] || "";
  const meses = mesesEntreEscritorio(de, ate);

  const porMes = {};
  for (const l of lista) {
    const conta = contaEscritorio(l.contaId);
    if (!conta) continue;                       // não classificado fica de fora, como na planilha
    const m = String(l.competencia);
    const linha = porMes[m] || (porMes[m] = { contas: {}, grupos: {} });
    // Soma em precisão cheia e arredonda só no que sai daqui: arredondar a
    // cada parcela afastaria o saldo do extrato do banco centavo a centavo,
    // ao longo de 83 meses.
    linha.contas[conta.id] = (linha.contas[conta.id] || 0) + (Number(l.valor) || 0);
    linha.grupos[conta.grupo] = (linha.grupos[conta.grupo] || 0) + (Number(l.valor) || 0);
  }

  let saldo = Number(o.saldoAbertura) || 0;
  return meses.map((m) => {
    const linha = porMes[m] || { contas: {}, grupos: {} };
    const g = (id) => linha.grupos[id] || 0;
    const saldoGestao = g("gestao_entradas") - g("gestao_saidas");
    const saldoEscritorio = g("receitas") - g("despesas");
    const saldoEmpreendimento = g("emp_entradas") - g("emp_saidas");
    const socios = g("socios") - g("socios_entradas");
    const paraInvestimento = saldoEscritorio - socios;
    saldo = saldo + saldoGestao + paraInvestimento + saldoEmpreendimento;
    const contas = {}; for (const k in linha.contas) contas[k] = efCentavos(linha.contas[k]);
    const grupos = {}; for (const k in linha.grupos) grupos[k] = efCentavos(linha.grupos[k]);
    return {
      mes: m,
      contas,
      grupos,
      saldoGestao: efCentavos(saldoGestao),
      saldoEscritorio: efCentavos(saldoEscritorio),
      saldoEmpreendimento: efCentavos(saldoEmpreendimento),
      retiradas: efCentavos(socios),
      paraInvestimento: efCentavos(paraInvestimento),
      saldoExtrato: efCentavos(saldo),
    };
  });
}

// Quanto já foi investido em cada empreendimento e o que sobrou na venda.
// Enquanto não vende, `resultado` é null — investimento em andamento não é
// lucro nem prejuízo, é dinheiro parado em imóvel.
function resultadoEmpreendimento(lancamentos, empreendimentoId) {
  let investido = 0, vendido = 0, temVenda = false;
  for (const l of lancamentos || []) {
    if (!l || l.empreendimentoId !== empreendimentoId) continue;
    const conta = contaEscritorio(l.contaId);
    if (!conta) continue;
    if (conta.grupo === "emp_saidas") investido = efCentavos(investido + (Number(l.valor) || 0));
    if (conta.grupo === "emp_entradas") { vendido = efCentavos(vendido + (Number(l.valor) || 0)); temVenda = true; }
  }
  return { investido, vendido, resultado: temVenda ? efCentavos(vendido - investido) : null };
}

// ── Leitura de uma colagem da planilha ──────────────────────────
// O jeito mais curto de trazer seis anos de histórico é copiar as linhas no
// Excel e colar aqui: o navegador recebe as colunas separadas por TAB. Cada
// linha vira um lançamento; o que não for reconhecido volta com o motivo,
// sem gravar nada.
const EF_COLUNAS = {
  cliente: ["nome cliente", "cliente"],
  unidade: ["unidade negocio", "unidade de negocio", "unidade"],
  projeto: ["projeto / obra", "projeto/obra", "projeto", "obra"],
  fornecedor: ["fornecedor"],
  descricao: ["descricao lancamento", "descricao", "historico"],
  conta: ["conta contabil", "conta"],
  documento: ["nota / comprovante", "nota/comprovante", "nota", "documento"],
  emitirNota: ["emitir nota fiscal", "emitir nf"],
  valor: ["valor total nota", "valor"],
  competencia: ["periodo contabil", "competencia", "periodo"],
  lancadoEm: ["data do lancamento", "data"],
  contaBanco: ["cc escritorio", "conta do escritorio", "cc"],
};

// "1.234,56", "1234.56", "R$ 1.234,56" → 1234.56. Devolve null quando não é
// número: linha sem valor não vira lançamento.
function efNumero(txt) {
  const t = String(txt == null ? "" : txt).replace(/r\$/i, "").replace(/\s/g, "").trim();
  if (!t) return null;
  const limpo = t.indexOf(",") >= 0 ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

// Aceita 25/09/2026, 2026-09-25 e 09/2026 — e devolve sempre o mês.
function efCompetencia(txt) {
  const t = String(txt == null ? "" : txt).trim();
  let m = /^(\d{4})-(\d{2})(-\d{2})?/.exec(t);
  if (m) return `${m[1]}-${m[2]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, "0")}`;
  m = /^(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return `${m[2]}-${String(m[1]).padStart(2, "0")}`;
  return "";
}

function efData(txt) {
  const t = String(txt == null ? "" : txt).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
  return "";
}

// "Sim" passou pela conta do escritório; "Não" não passou. O resto do que
// a planilha tem nesse campo ("Reemb", "ok", "Não consta no extrato") não é
// resposta a essa pergunta — fica como observação e o campo vem vazio.
function efContaBanco(txt) {
  const t = efSemAcento(txt);
  if (t === "sim" || t === "s") return "sim";
  if (t === "nao" || t === "n") return "nao";
  return "";
}

function interpretarColagemEscritorio(texto, opcoes) {
  const o = opcoes || {};
  const linhas = String(texto == null ? "" : texto).split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!linhas.length) return { itens: [], cabecalho: null, resumo: { total: 0, prontos: 0, comErro: 0 } };

  const parte = (l) => l.split("\t").map((c) => c.trim());
  const primeira = parte(linhas[0]);
  // Cabeçalho é a linha cujas colunas casam com os nomes conhecidos.
  const mapa = {};
  let temCabecalho = false;
  primeira.forEach((titulo, i) => {
    const t = efSemAcento(titulo);
    for (const campo in EF_COLUNAS) {
      if (EF_COLUNAS[campo].includes(t)) { mapa[campo] = i; temCabecalho = true; }
    }
  });
  const corpo = temCabecalho ? linhas.slice(1) : linhas;
  const pos = temCabecalho ? mapa : o.colunas || {};

  const itens = corpo.map((linha, n) => {
    const c = parte(linha);
    const pega = (campo) => (pos[campo] == null ? "" : (c[pos[campo]] || ""));
    const contaOriginal = pega("conta");
    const contaId = contaPeloApelido(contaOriginal);
    const unidadeOriginal = pega("unidade");
    const item = {
      linha: n + 1,
      contaId,
      contaOriginal,
      unidadeId: unidadePeloApelido(unidadeOriginal),
      unidadeOriginal,
      cliente: pega("cliente"),
      projeto: pega("projeto"),
      fornecedor: pega("fornecedor"),
      descricao: pega("descricao"),
      documento: pega("documento"),
      emitirNota: efSemAcento(pega("emitirNota")) === "sim",
      valor: efNumero(pega("valor")),
      competencia: efCompetencia(pega("competencia")),
      lancadoEm: efData(pega("lancadoEm")),
      contaBanco: efContaBanco(pega("contaBanco")),
      observacao: efContaBanco(pega("contaBanco")) ? "" : String(pega("contaBanco") || "").trim(),
      erros: [],
    };
    if (item.valor == null) item.erros.push("sem valor");
    if (!item.competencia) item.erros.push("sem competência");
    if (!contaId) item.erros.push(contaOriginal ? `conta “${contaOriginal}” não existe no plano` : "sem conta");
    return item;
  });

  return {
    itens,
    cabecalho: temCabecalho ? mapa : null,
    resumo: {
      total: itens.length,
      prontos: itens.filter((i) => !i.erros.length).length,
      comErro: itens.filter((i) => i.erros.length).length,
    },
  };
}

// O item lido vira lançamento gravável. O histórico entra como está: as
// regras novas valem do corte em diante, e reescrever o passado mudaria um
// saldo já conferido contra o banco.
function lancamentoDaColagem(item, novoId) {
  const i = item || {};
  return {
    id: novoId || (typeof uid === "function" ? uid() : String(Math.random()).slice(2)),
    tipo: "escritorio",
    contaId: i.contaId || null,
    unidadeId: i.unidadeId || null,
    valor: Number(i.valor) || 0,
    competencia: i.competencia || "",
    lancadoEm: i.lancadoEm || "",
    cliente: i.cliente || "",
    projeto: i.projeto || "",
    fornecedor: i.fornecedor || "",
    descricao: i.descricao || "",
    documento: i.documento || "",
    emitirNota: !!i.emitirNota,
    contaBanco: i.contaBanco || "",
    observacao: i.observacao || "",
    importado: true,
    contaOriginal: i.contaOriginal || "",
    unidadeOriginal: i.unidadeOriginal || "",
  };
}

// Só os lançamentos do escritório — a tabela `lancamentos` também guarda as
// notas de material de obra, que são outra coisa.
function lancamentosDoEscritorio(data) {
  return ((data && data.lancamentos) || []).filter((l) => l && l.tipo === "escritorio");
}

// UI — daqui para baixo é tela (JSX). Os testes cortam neste marcador.
// ── UI — a aba Financeiro do Escritório ─────────────────────────
// Três telas: o extrato mês a mês (que é o que você já olhava na planilha),
// a lista de lançamentos e a importação. Tudo em cima das mesmas funções
// puras acima, que são as testadas.

const EF_ESTILO = {
  wrap: { display: "grid", gap: 16 },
  abas: { display: "flex", gap: 8, flexWrap: "wrap" },
  aba: (on) => ({ font: "inherit", fontSize: 13, padding: "7px 16px", borderRadius: 10, cursor: "pointer",
    border: `1px solid ${on ? "#0474f4" : "rgba(38,36,33,0.14)"}`, background: on ? "#0474f4" : "#fff",
    color: on ? "#fff" : "#262421", fontWeight: on ? 600 : 500, fontFamily: "inherit" }),
  card: { background: "#fff", border: "1px solid rgba(38,36,33,0.14)", borderRadius: 14, padding: 16 },
  quadro: { background: "#fff", border: "1px solid rgba(38,36,33,0.14)", borderRadius: 14, overflow: "auto" },
  input: { width: "100%", padding: "8px 10px", borderRadius: 9, border: "1px solid rgba(38,36,33,0.18)",
    fontSize: 13, fontFamily: "inherit", background: "#fff", color: "#262421" },
  rot: { fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 },
  btn: { background: "#0474f4", color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px",
    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  btnSec: { background: "#fff", color: "#262421", border: "1px solid rgba(38,36,33,0.18)", borderRadius: 10,
    padding: "8px 14px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" },
};

const EF_MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function efDinheiro(v) {
  const n = Number(v) || 0;
  return (n < 0 ? "− " : "") + "R$ " + Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// O extrato: blocos em linhas, meses em colunas. Mesma leitura da planilha,
// com cada bloco somando só o que é dele.
function ExtratoEscritorioQuadro({ linhas, ano, aoTrocarAno }) {
  const S = EF_ESTILO;
  const anos = [...new Set(linhas.map((l) => l.mes.slice(0, 4)))];
  const doAno = linhas.filter((l) => l.mes.startsWith(ano));
  if (!doAno.length) {
    return <div style={{ ...S.card, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
      Nenhum lançamento em {ano}.
    </div>;
  }
  const blocos = [
    { titulo: "Gestão de obras — dinheiro do cliente", grupos: ["gestao_entradas", "gestao_saidas"], saldo: "saldoGestao", rotulo: "Saldo da gestão" },
    { titulo: "Escritório", grupos: ["receitas", "despesas"], saldo: "saldoEscritorio", rotulo: "Resultado do escritório" },
    { titulo: "Empreendimentos", grupos: ["emp_entradas", "emp_saidas"], saldo: "saldoEmpreendimento", rotulo: "Saldo de empreendimentos" },
    { titulo: "Sócios", grupos: ["socios", "socios_entradas"], saldo: "retiradas", rotulo: "Retiradas e empréstimos" },
  ];
  const soma = (f) => doAno.reduce((s, m) => s + (f(m) || 0), 0);
  const cel = (v) => (!v ? <span style={{ color: "#d1d5db" }}>—</span>
    : <span style={v < 0 ? { color: "#b91c1c" } : undefined}>{efDinheiro(v)}</span>);
  const td = { padding: "7px 12px", textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  const tdNome = { ...td, textAlign: "left", position: "sticky", left: 0, background: "#fff", minWidth: 230 };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={S.abas}>
        {anos.map((a) => (
          <button key={a} style={S.aba(a === ano)} onClick={() => aoTrocarAno(a)}>{a}</button>
        ))}
      </div>
      <div style={S.quadro}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
          <thead>
            <tr style={{ color: "#6b7280" }}>
              <th style={{ ...tdNome, fontSize: 11, textTransform: "uppercase", letterSpacing: .4, borderBottom: "1px solid rgba(38,36,33,0.12)" }}></th>
              {doAno.map((m) => (
                <th key={m.mes} style={{ ...td, fontSize: 11, textTransform: "uppercase", letterSpacing: .4, borderBottom: "1px solid rgba(38,36,33,0.12)" }}>
                  {EF_MES_CURTO[Number(m.mes.slice(5)) - 1]}
                </th>
              ))}
              <th style={{ ...td, fontSize: 11, textTransform: "uppercase", letterSpacing: .4, borderBottom: "1px solid rgba(38,36,33,0.12)" }}>Ano</th>
            </tr>
          </thead>
          <tbody>
            {blocos.map((b) => {
              const contas = b.grupos.flatMap((g) => PLANO_CONTAS_ESCRITORIO.filter((c) => c.grupo === g));
              const usadas = contas.filter((c) => doAno.some((m) => (m.contas[c.id] || 0) !== 0));
              if (!usadas.length && !doAno.some((m) => m[b.saldo])) return null;
              return (
                <React.Fragment key={b.titulo}>
                  <tr>
                    <td style={{ ...tdNome, fontWeight: 700, background: "#f5f7fa", borderTop: "1px solid rgba(38,36,33,0.12)" }}>{b.titulo}</td>
                    {doAno.map((m) => <td key={m.mes} style={{ ...td, background: "#f5f7fa", borderTop: "1px solid rgba(38,36,33,0.12)" }} />)}
                    <td style={{ ...td, background: "#f5f7fa", borderTop: "1px solid rgba(38,36,33,0.12)" }} />
                  </tr>
                  {usadas.map((c) => {
                    const sinal = (grupoEscritorio(c.grupo) || {}).sinal;
                    return (
                      <tr key={c.id}>
                        <td style={{ ...tdNome, paddingLeft: 26, color: "#6b7280" }}>{sinal < 0 ? "− " : "+ "}{c.nome}</td>
                        {doAno.map((m) => <td key={m.mes} style={td}>{cel(m.contas[c.id] || 0)}</td>)}
                        <td style={td}>{cel(soma((m) => m.contas[c.id] || 0))}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td style={{ ...tdNome, fontWeight: 600 }}>{b.rotulo}</td>
                    {doAno.map((m) => <td key={m.mes} style={{ ...td, fontWeight: 600 }}>{cel(m[b.saldo] || 0)}</td>)}
                    <td style={{ ...td, fontWeight: 600 }}>{cel(soma((m) => m[b.saldo] || 0))}</td>
                  </tr>
                </React.Fragment>
              );
            })}
            <tr>
              <td style={{ ...tdNome, fontWeight: 700, background: "#f0f7ff", borderTop: "2px solid #0474f4" }}>Saldo do extrato</td>
              {doAno.map((m) => (
                <td key={m.mes} style={{ ...td, fontWeight: 700, background: "#f0f7ff", borderTop: "2px solid #0474f4" }}>{cel(m.saldoExtrato)}</td>
              ))}
              <td style={{ ...td, fontWeight: 700, background: "#f0f7ff", borderTop: "2px solid #0474f4" }}>
                {cel(doAno[doAno.length - 1].saldoExtrato)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Formulário de um lançamento. As travas são as do validarLancamento: a
// mensagem aparece antes de gravar, não depois.
function FormLancamentoEscritorio({ inicial, aoSalvar, aoCancelar }) {
  const S = EF_ESTILO;
  const [f, setF] = useState(() => ({
    contaId: "", unidadeId: "escritorio", valor: "", competencia: "", lancadoEm: "",
    cliente: "", projeto: "", fornecedor: "", descricao: "", documento: "", contaBanco: "sim",
    ...(inicial || {}),
  }));
  const [tentou, setTentou] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const conta = contaEscritorio(f.contaId);
  const unidadesOk = conta && (conta.unidades || []).length ? conta.unidades : UNIDADES_NEGOCIO.map((u) => u.id);
  const erros = validarLancamentoEscritorio({ ...f, valor: Number(String(f.valor).replace(",", ".")) || 0,
    clienteId: f.cliente, obraId: f.projeto, empreendimentoId: f.projeto });

  const campo = (rot, filho) => <div><div style={S.rot}>{rot}</div>{filho}</div>;
  return (
    <div style={{ ...S.card, borderColor: "rgba(4,116,244,0.35)", background: "#f7fbff", display: "grid", gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{inicial && inicial.id ? "Editar lançamento" : "Novo lançamento"}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        {campo("Conta", (
          <select style={{ ...S.input, cursor: "pointer" }} value={f.contaId} onChange={(e) => {
            const c = contaEscritorio(e.target.value);
            const us = c && (c.unidades || []).length ? c.unidades : [];
            setF((p) => ({ ...p, contaId: e.target.value, unidadeId: us.length && !us.includes(p.unidadeId) ? us[0] : p.unidadeId }));
          }}>
            <option value="">— escolha —</option>
            {GRUPOS_ESCRITORIO.map((g) => {
              const doGrupo = PLANO_CONTAS_ESCRITORIO.filter((c) => c.grupo === g.id);
              if (!doGrupo.length) return null;
              return (
                <optgroup key={g.id} label={g.titulo}>
                  {doGrupo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </optgroup>
              );
            })}
          </select>
        ))}
        {campo("Unidade de negócio", (
          <select style={{ ...S.input, cursor: "pointer" }} value={f.unidadeId} onChange={(e) => set("unidadeId", e.target.value)}>
            {UNIDADES_NEGOCIO.filter((u) => unidadesOk.includes(u.id)).map((u) => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
        ))}
        {campo("Valor", <input style={S.input} inputMode="decimal" value={f.valor} placeholder="0,00"
          onChange={(e) => set("valor", e.target.value)} />)}
        {campo("Competência", <input style={S.input} type="month" value={f.competencia}
          onChange={(e) => set("competencia", e.target.value)} />)}
        {campo("Data do pagamento", <input style={S.input} type="date" value={f.lancadoEm}
          onChange={(e) => set("lancadoEm", e.target.value)} />)}
        {campo("Passou pela conta do escritório", (
          <select style={{ ...S.input, cursor: "pointer" }} value={f.contaBanco} onChange={(e) => set("contaBanco", e.target.value)}>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        ))}
        {campo("Cliente", <input style={S.input} value={f.cliente} onChange={(e) => set("cliente", e.target.value)} />)}
        {campo("Projeto / obra", <input style={S.input} value={f.projeto} onChange={(e) => set("projeto", e.target.value)} />)}
        {campo("Fornecedor", <input style={S.input} value={f.fornecedor} onChange={(e) => set("fornecedor", e.target.value)} />)}
        {campo("Documento", <input style={S.input} value={f.documento} onChange={(e) => set("documento", e.target.value)} />)}
      </div>
      {campo("Descrição", <input style={S.input} value={f.descricao} onChange={(e) => set("descricao", e.target.value)} />)}
      {tentou && erros.length > 0 && (
        <div style={{ fontSize: 12, color: "#b91c1c" }}>{erros.join(" · ")}</div>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button style={EF_ESTILO.btnSec} onClick={aoCancelar}>Cancelar</button>
        <button style={EF_ESTILO.btn} onClick={() => {
          setTentou(true);
          if (erros.length) return;
          aoSalvar({ ...f, tipo: "escritorio", valor: Number(String(f.valor).replace(",", ".")) || 0 });
        }}>Salvar</button>
      </div>
    </div>
  );
}

// A aba inteira. O extrato é o que se olha todo dia; a lista é onde se
// lança; a importação é a porta de entrada do histórico da planilha.
function FinanceiroEscritorio({ data, save, onReload }) {
  const S = EF_ESTILO;
  const perm = typeof getPermissoes === "function" ? getPermissoes() : { podeEditar: true, podeExcluir: true };
  const [aba, setAba] = useState("extrato");
  const [form, setForm] = useState(null);
  const [texto, setTexto] = useState("");
  const [lido, setLido] = useState(null);
  const [ocupado, setOcupado] = useState("");
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");

  const lancs = lancamentosDoEscritorio(data);
  const cfgFin = ((data || {}).escritorio || {}).financeiro || {};
  const saldoAbertura = Number(cfgFin.saldoAbertura) || 0;
  const linhas = extratoEscritorio(lancs, { saldoAbertura });
  const [ano, setAno] = useState("");
  const anoAtual = ano || (linhas.length ? linhas[linhas.length - 1].mes.slice(0, 4) : String(new Date().getFullYear()));

  const outrosLancamentos = ((data || {}).lancamentos || []).filter((l) => !l || l.tipo !== "escritorio");
  const gravar = (novosDoEscritorio) =>
    save({ ...data, lancamentos: [...outrosLancamentos, ...novosDoEscritorio] }).catch(console.error);

  function salvarLancamento(l) {
    const id = l.id || (typeof uid === "function" ? uid() : String(Date.now()));
    const semEle = lancs.filter((x) => x.id !== id);
    gravar([...semEle, { ...l, id, tipo: "escritorio" }]);
    setForm(null);
  }

  async function excluirLancamento(l) {
    const ok = await dialogo.confirmar({
      titulo: "Excluir este lançamento?",
      mensagem: `${contaEscritorio(l.contaId)?.nome || "Lançamento"} · ${efDinheiro(l.valor)} · ${l.competencia}`,
      confirmar: "Excluir", destrutivo: true,
    });
    if (!ok) return;
    gravar(lancs.filter((x) => x.id !== l.id));
  }

  // Importação: vai direto pelo lote, sem passar pelo save() normal — o
  // save compara o que mudou e mandaria os milhares de lançamentos um a um.
  async function importar() {
    if (!lido || !lido.resumo.prontos) return;
    const prontos = lido.itens.filter((i) => !i.erros.length)
      .map((i) => lancamentoDaColagem(i, `imp_${Date.now().toString(36)}_${i.linha}`));
    setOcupado(`Importando ${prontos.length} lançamentos…`);
    setAviso("");
    try {
      const lote = 400;
      for (let i = 0; i < prontos.length; i += lote) {
        await api.lancamentos.batch(prontos.slice(i, i + lote));
        setOcupado(`Importando… ${Math.min(i + lote, prontos.length)} de ${prontos.length}`);
      }
      setTexto(""); setLido(null);
      setOcupado("");
      setAviso(`${prontos.length} lançamentos importados.`);
      if (onReload) await onReload();
      setAba("extrato");
    } catch (e) {
      setOcupado("");
      setAviso("Não consegui importar: " + ((e && e.message) || "falha no envio"));
    }
  }

  const filtrados = (() => {
    const t = efSemAcento(busca);
    const lista = lancs.slice().sort((a, b) => String(b.competencia).localeCompare(String(a.competencia)));
    if (!t) return lista.slice(0, 300);
    return lista.filter((l) => efSemAcento([l.descricao, l.fornecedor, l.cliente, l.projeto,
      (contaEscritorio(l.contaId) || {}).nome].join(" ")).indexOf(t) >= 0).slice(0, 300);
  })();

  const ultimo = linhas[linhas.length - 1];
  const fechados = linhas.filter((l) => l.mes <= "2026-08");
  const u12 = fechados.slice(-12);
  const media = (f) => (u12.length ? u12.reduce((s, m) => s + (f(m) || 0), 0) / u12.length : 0);

  return (
    <div style={S.wrap}>
      <div style={S.abas}>
        {[["extrato", "Extrato"], ["lancamentos", `Lançamentos (${lancs.length})`], ["importar", "Importar"]].map(([k, r]) => (
          <button key={k} style={S.aba(aba === k)} onClick={() => setAba(k)}>{r}</button>
        ))}
      </div>

      {aviso && <div style={{ fontSize: 12.5, color: "#0474f4" }}>{aviso}</div>}

      {aba === "extrato" && (
        <>
          {!lancs.length ? (
            <div style={{ ...S.card, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
              Nenhum lançamento ainda. Traga o histórico pela aba <strong>Importar</strong>, ou lance o primeiro em Lançamentos.
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
                {[["Saldo do extrato", efDinheiro(ultimo.saldoExtrato), ultimo.mes],
                  ["Receitas — média 12m", efDinheiro(media((m) => m.grupos.receitas || 0)), "projetos, gestão, comissões"],
                  ["Despesas — média 12m", efDinheiro(media((m) => m.grupos.despesas || 0)), "custo do escritório"],
                  ["Resultado — média 12m", efDinheiro(media((m) => m.saldoEscritorio || 0)), "antes das retiradas"]].map(([r, n, p]) => (
                  <div key={r} style={S.card}>
                    <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .5, color: "#6b7280" }}>{r}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{n}</div>
                    <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>{p}</div>
                  </div>
                ))}
              </div>
              <ExtratoEscritorioQuadro linhas={linhas} ano={anoAtual} aoTrocarAno={setAno} />
            </>
          )}
        </>
      )}

      {aba === "lancamentos" && (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input style={{ ...S.input, maxWidth: 320 }} value={busca} placeholder="Buscar por descrição, fornecedor, cliente…"
              onChange={(e) => setBusca(e.target.value)} />
            {perm.podeEditar && !form && (
              <button style={S.btn} onClick={() => setForm({})}>+ Novo lançamento</button>
            )}
          </div>
          {form && <FormLancamentoEscritorio inicial={form} aoSalvar={salvarLancamento} aoCancelar={() => setForm(null)} />}
          <div style={S.quadro}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: "#6b7280", textAlign: "left" }}>
                  {["Competência", "Conta", "Unidade", "Cliente / obra", "Descrição", "Valor", ""].map((h, i) => (
                    <th key={h + i} style={{ padding: "7px 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: .4,
                      borderBottom: "1px solid rgba(38,36,33,0.12)", textAlign: i === 5 ? "right" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((l) => {
                  const c = contaEscritorio(l.contaId);
                  const u = UNIDADES_NEGOCIO.find((x) => x.id === l.unidadeId);
                  return (
                    <tr key={l.id} style={{ borderTop: "1px solid rgba(38,36,33,0.06)" }}>
                      <td style={{ padding: "7px 12px", whiteSpace: "nowrap" }}>{l.competencia}</td>
                      <td style={{ padding: "7px 12px" }}>{c ? c.nome : <span style={{ color: "#b45309" }}>{l.contaOriginal || "sem conta"}</span>}</td>
                      <td style={{ padding: "7px 12px", color: "#6b7280" }}>{u ? u.nome : l.unidadeOriginal || "—"}</td>
                      <td style={{ padding: "7px 12px", color: "#6b7280" }}>{[l.cliente, l.projeto].filter(Boolean).join(" · ") || "—"}</td>
                      <td style={{ padding: "7px 12px" }}>{l.descricao || l.fornecedor || "—"}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{efDinheiro(l.valor)}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                        {perm.podeEditar && (
                          <button style={{ ...S.btnSec, padding: "4px 9px" }} onClick={() => setForm(l)}>Editar</button>
                        )}
                        {perm.podeExcluir && (
                          <button style={{ ...S.btnSec, padding: "4px 9px", marginLeft: 6, color: "#dc2626" }}
                            onClick={() => excluirLancamento(l)}>Excluir</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtrados.length >= 300 && (
            <div style={{ fontSize: 11.5, color: "#6b7280" }}>Mostrando os 300 mais recentes. Use a busca para achar o resto.</div>
          )}
        </>
      )}

      {aba === "importar" && (
        <>
          <div style={{ ...S.card, display: "grid", gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Saldo de abertura</div>
            <div style={{ fontSize: 12.5, color: "#4b5563" }}>
              O saldo que a conta do escritório tinha antes do primeiro lançamento. É dele que o extrato parte.
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input style={{ ...S.input, maxWidth: 200 }} inputMode="decimal" defaultValue={saldoAbertura || ""}
                placeholder="0,00" onBlur={(e) => {
                  const v = efNumero(e.target.value) || 0;
                  if (v === saldoAbertura) return;
                  save({ ...data, escritorio: { ...((data || {}).escritorio || {}), financeiro: { ...cfgFin, saldoAbertura: v } } }).catch(console.error);
                }} />
              <span style={{ fontSize: 12, color: "#6b7280" }}>hoje: {efDinheiro(saldoAbertura)}</span>
            </div>
          </div>

          <div style={{ ...S.card, display: "grid", gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Trazer a planilha</div>
            <div style={{ fontSize: 12.5, color: "#4b5563", lineHeight: 1.5 }}>
              No Excel, selecione as linhas da base de dados <strong>com o cabeçalho</strong> e copie. Cole aqui embaixo.
              Nada é gravado antes de você conferir o resumo.
            </div>
            <textarea style={{ ...S.input, minHeight: 130, fontFamily: "ui-monospace, monospace", fontSize: 11.5 }}
              value={texto} placeholder="Cole aqui as linhas copiadas do Excel"
              onChange={(e) => { setTexto(e.target.value); setLido(null); }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button style={S.btnSec} onClick={() => { setTexto(""); setLido(null); }}>Limpar</button>
              <button style={S.btn} onClick={() => setLido(interpretarColagemEscritorio(texto))}>Conferir</button>
            </div>
          </div>

          {lido && (
            <div style={{ ...S.card, display: "grid", gap: 10 }}>
              <div style={{ fontSize: 12.5 }}>
                <strong>{lido.resumo.total}</strong> linhas lidas ·{" "}
                <strong style={{ color: "#0474f4" }}>{lido.resumo.prontos} prontas</strong>
                {lido.resumo.comErro ? ` · ${lido.resumo.comErro} para revisar` : ""}
                {!lido.cabecalho && <span style={{ color: "#b45309" }}> · não achei o cabeçalho na primeira linha</span>}
              </div>
              {lido.resumo.comErro > 0 && (
                <div style={{ ...S.quadro, maxHeight: 220 }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                    <tbody>
                      {lido.itens.filter((i) => i.erros.length).slice(0, 50).map((i) => (
                        <tr key={i.linha} style={{ borderTop: "1px solid rgba(38,36,33,0.06)" }}>
                          <td style={{ padding: "6px 10px", color: "#6b7280" }}>linha {i.linha}</td>
                          <td style={{ padding: "6px 10px" }}>{i.descricao || i.fornecedor || "—"}</td>
                          <td style={{ padding: "6px 10px", color: "#b45309" }}>{i.erros.join(" · ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                {ocupado && <span style={{ fontSize: 12, color: "#6b7280", marginRight: "auto" }}>{ocupado}</span>}
                <button style={{ ...S.btn, opacity: lido.resumo.prontos && !ocupado ? 1 : .45 }}
                  disabled={!lido.resumo.prontos || !!ocupado} onClick={importar}>
                  Importar {lido.resumo.prontos} lançamentos
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: "#6b7280" }}>
                As linhas para revisar não são gravadas. O histórico entra como está: as regras novas valem para o que você lançar daqui em diante.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
