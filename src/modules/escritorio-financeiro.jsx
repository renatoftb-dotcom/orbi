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
