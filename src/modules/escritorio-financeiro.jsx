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
  // Dinheiro que ENTRA para tocar o empreendimento — hoje o do próprio
  // escritório, amanhã o de um investidor. Fica em grupo separado de proprósito:
  // em "vendas" ele viraria lucro que ninguém recebeu, e em "investimento" viraria
  // custo em dobro (entra o dinheiro, depois sai para a obra).
  { id: "emp_aportes",     titulo: "APORTES EM EMPREENDIMENTO", sinal: +1, resultado: false, bloco: "empreendimento" },
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
  { id: "emp_aporte",     nome: "Aporte no empreendimento", grupo: "emp_aportes", unidades: ["empreendimento"], apelidos: [] },

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
function validarLancamentoEscritorio(l, opcoes) {
  const erros = [];
  const lan = l || {};
  const trava = bloqueioPorMesFechado(lan.competencia, (opcoes || {}).fechamentos);
  if (trava) erros.push(trava);
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
  const lista = lancamentosParaResultado(lancamentos).filter((l) => l && /^\d{4}-\d{2}$/.test(String(l.competencia)));
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
// `concluido` é o que separa recebimento de resultado. Um sinal de uma
// unidade não apura nada: o custo é das três casas, e jogar tudo contra o
// primeiro sinal mostraria um prejuízo que não existe. Enquanto o
// empreendimento não fecha, o que há é investido e recebido; o resultado
// aparece quando o cadastro deixa de estar em andamento.
function resultadoEmpreendimento(lancamentos, empreendimentoId, opcoes) {
  const o = opcoes || {};
  let investido = 0, vendido = 0, temVenda = false;
  for (const l of lancamentosParaResultado(lancamentos)) {
    if (!l || l.empreendimentoId !== empreendimentoId) continue;
    const conta = contaEscritorio(l.contaId);
    if (!conta) continue;
    if (conta.grupo === "emp_saidas") investido = efCentavos(investido + (Number(l.valor) || 0));
    if (conta.grupo === "emp_entradas") { vendido = efCentavos(vendido + (Number(l.valor) || 0)); temVenda = true; }
  }
  const apurado = temVenda && !!o.concluido;
  return {
    investido, vendido,
    recebido: vendido,
    parcial: temVenda && !o.concluido,
    resultado: apurado ? efCentavos(vendido - investido) : null,
  };
}

// ═════════════════════════════════════════════════════════════
// PONTE OBRA → ESCRITÓRIO
// ═════════════════════════════════════════════════════════════
// A obra registra o dinheiro pela lente de quem constrói: material, mão de
// obra, etapa. O escritório registra pela lente de quem tem a conta no banco:
// entrou, saiu, de quem era. É o mesmo dinheiro visto de dois lugares, e até
// agora ninguém ligava um ao outro — o extrato do escritório só sabia da obra
// quando alguém digitava.
//
// Quem decide o caminho é o dono do dinheiro, e são três casos:
//
//   empreendimento — a obra é do escritório. Tudo passa: terreno, construção,
//                    taxas e a venda. Nada disso forma resultado no mês; soma
//                    no valor do imóvel e vira lucro no dia da venda.
//   gestão         — a obra é do cliente e o dinheiro dele passa pela conta do
//                    escritório. Entra como consignação, sai como pagamento, e
//                    nenhum dos dois é receita: é dinheiro em trânsito.
//   clientePaga    — a obra é do cliente e ele paga os fornecedores direto. Só
//                    o gerenciamento atravessa, porque honorário é do escritório
//                    sempre — custo para ele, receita para cá.
//
// A conta que não tem destino não some: volta na lista de ignoradas, com o
// motivo. É assim que uma conta nova do plano da obra aparece aqui em vez de
// escorregar calada para "Pagamentos e compras".

const PONTE_GRUPOS_CUSTO = ["materiais", "maoDeObra", "servicos"];

function pontePlanoDaObra(opcoes) {
  const o = opcoes || {};
  if (Array.isArray(o.planoObra)) return o.planoObra;
  return typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : [];
}

function ponteGrupoDaConta(contaId, opcoes) {
  const c = pontePlanoDaObra(opcoes).find((x) => x && x.id === contaId);
  return c ? c.grupo : "";
}

function modoDaPonte(obra, cliente) {
  if (typeof ehEmpreendimento === "function" && ehEmpreendimento(cliente)) return "empreendimento";
  return (obra && obra.clientePagaDireto) ? "clientePaga" : "gestao";
}

// Conta da obra + modo → conta do escritório. "" quer dizer que não atravessa.
function destinoNoEscritorio(contaId, modo, opcoes) {
  const grupo = ponteGrupoDaConta(contaId, opcoes);
  if (modo === "empreendimento") {
    // gerenciar a própria obra não é receita: seria tirar de um bolso e pôr no outro
    if (contaId === "taxa_admin_obra") return "";
    if (contaId === "venda_imovel") return "emp_venda";
    if (contaId === "deposito_proprio") return "emp_aporte";
    if (grupo === "terreno") return "emp_terreno";
    if (grupo === "materiais" || grupo === "maoDeObra") return "emp_construcao";
    if (grupo === "servicos") return "emp_taxas";
    return "";
  }
  // honorário do escritório atravessa mesmo quando o cliente paga tudo direto
  if (contaId === "taxa_admin_obra") return "rec_gestao";
  if (modo === "clientePaga") return "";
  if (contaId === "deposito_proprio" || contaId === "liberacao_financ") return "dep_consignacao";
  if (contaId === "reembolsos") return "reembolsos";
  if (PONTE_GRUPOS_CUSTO.indexOf(grupo) >= 0) return "pagamentos_compras";
  return "";
}

// O id é derivado da origem, não sorteado: rodar a ponte duas vezes na mesma
// obra não cria o lançamento duas vezes.
function idDaPonte(obraId, tipo, refId) {
  return `ponte:${obraId || "?"}:${tipo}:${refId || "?"}`;
}

function ponteCompetencia(iso) {
  const d = String(iso || "").slice(0, 7);
  return /^\d{4}-\d{2}$/.test(d) ? d : "";
}

// ── Uma nota, uma linha no extrato ──────────────────────────────
// A conta a pagar é por item — é o que faz o custo por etapa funcionar. Mas
// o banco não debita item: debita a nota. Uma compra de onze itens virava
// onze linhas no extrato do escritório contra UM débito no extrato do
// banco, e conferir um contra o outro deixava de ser possível.
//
// Então o que atravessa é o pedido, com o valor total dos itens. O corte é
// por pedido + conta contábil + data de pagamento: um pedido que mistura
// contas do plano não cabe numa linha só (o destino no escritório é outro),
// e itens baixados em datas diferentes são débitos diferentes no banco.
function fontesDasContasPagas(contas) {
  const pagas = (contas || []).filter((c) => c && c.pago);
  const soltas = [], grupos = [], porChave = {};
  const num = (v) => Math.round((Number(v) || 0) * 100) / 100;
  const valorDe = (c) => num(Number(c.valorPago) || Number(c.valor) || 0);
  const dataDe = (c) => String(c.pagoEm || c.vencimento || "").slice(0, 10);
  const fonteDaConta = (c) => ({
    tipo: "conta", refId: refDaParcela(c), contaId: c.contaId || "",
    valor: valorDe(c), data: dataDe(c),
    descricao: c.descricao || "",
    fornecedor: c.favorecido || "", fornecedorId: c.prestadorId || "",
    documento: c.doc || c.numeroNota || c.numeroLoja || "",
    numeroDoc: c.numeroDoc || "",
    anexos: anexosDaTransacao(c),
  });
  for (const c of pagas) {
    if (!c.pedidoId) { soltas.push(fonteDaConta(c)); continue; }
    const chave = c.pedidoId + "|" + (c.contaId || "") + "|" + dataDe(c);
    if (!porChave[chave]) {
      porChave[chave] = { chave, itens: [], contas: [] };
      grupos.push(porChave[chave]);
    }
    porChave[chave].itens.push(c);
  }
  const doGrupo = (g) => {
    const itens = g.itens;
    // um item só não é grupo: continua sendo a própria conta, com o id de
    // ponte que ela sempre teve
    if (itens.length === 1) return fonteDaConta(itens[0]);
    const p = itens[0];
    const rotulo = p.numeroLoja || p.numeroNota || p.numeroPedido || "";
    const anexos = [], vistos = {};
    for (const c of itens) {
      for (const a of anexosDaTransacao(c) || []) {
        const k = (a && (a.id || a.url || a.nome)) || Math.random();
        if (vistos[k]) continue; vistos[k] = 1; anexos.push(a);
      }
    }
    return {
      tipo: "pedido", refId: g.chave, contaId: p.contaId || "",
      valor: num(itens.reduce((s, c) => s + valorDe(c), 0)),
      data: dataDe(p),
      descricao: (rotulo ? "Pedido " + rotulo : "Pedido") + " \u2014 " + itens.length + " itens",
      fornecedor: p.favorecido || "", fornecedorId: p.prestadorId || "",
      documento: p.doc || p.numeroNota || p.numeroLoja || "",
      numeroDoc: p.numeroDoc || "",
      anexos: anexos,
      // Os ids que ESTES itens teriam tido um a um. O que já atravessou
      // assim continua valendo: sem isto, a primeira ponte depois desta
      // mudança mandaria a mesma compra de novo, agora agrupada, e o
      // escritório contaria o gasto duas vezes.
      idsDeAntes: itens.map((c) => c.id),
    };
  };
  return soltas.concat(grupos.map(doGrupo));
}

// Monta o que a obra tem para mandar. NÃO grava: devolve as três listas e quem
// chama decide. `lancamentos` é o que entra; `existentes` já foi mandado antes;
// `bloqueados` esbarrou em mês fechado; `ignorados` não atravessa, com o motivo.
function lancamentosDaObraParaEscritorio(obra, cliente, opcoes) {
  const o = opcoes || {};
  const ob = obra || {};
  const modo = modoDaPonte(ob, cliente);
  const jaTem = new Set((o.lancamentos || []).map((l) => l && l.id).filter(Boolean));
  // A receita da gestão lançada no escritório e ligada à parcela não tem o
  // id da ponte, mas é a mesma transação: a origem dela basta.
  for (const l of o.lancamentos || []) {
    const g = l && l.origem;
    if (g && g.obraId && g.tipo && g.refId) jaTem.add(idDaPonte(g.obraId, g.tipo, g.refId));
  }
  const fechamentos = o.fechamentos || {};
  const lancamentos = [], ignorados = [], bloqueados = [], existentes = [];

  const empurrar = (fonte) => {
    const destino = destinoNoEscritorio(fonte.contaId, modo, o);
    if (!destino) {
      ignorados.push({ origem: fonte.refId, descricao: fonte.descricao, valor: fonte.valor,
        motivo: motivoDeIgnorar(fonte.contaId, modo, o) });
      return;
    }
    const id = idDaPonte(ob.id, fonte.tipo, fonte.refId);
    if (jaTem.has(id)) { existentes.push({ id, descricao: fonte.descricao, valor: fonte.valor }); return; }
    // atravessou antes item a item? então já está lá, só com outra cara
    const antes = (fonte.idsDeAntes || []).map((x) => idDaPonte(ob.id, "conta", x));
    if (antes.some((x) => jaTem.has(x))) {
      existentes.push({ id, descricao: fonte.descricao, valor: fonte.valor });
      return;
    }
    const competencia = ponteCompetencia(fonte.data);
    if (!competencia) {
      ignorados.push({ origem: fonte.refId, descricao: fonte.descricao, valor: fonte.valor,
        motivo: "sem data de pagamento" });
      return;
    }
    const trava = bloqueioPorMesFechado(competencia, fechamentos);
    if (trava) {
      bloqueados.push({ id, descricao: fonte.descricao, valor: fonte.valor, competencia, motivo: trava });
      return;
    }
    // O formato é o mesmo que o formulário do escritório grava — `unidadeId`,
    // cliente e projeto por nome —, senão o lançamento existiria no banco sem
    // aparecer em lugar nenhum da tela. `origem` é o extra que a ponte carrega
    // para saber de onde veio e não repetir.
    lancamentos.push({
      id,
      tipo: "escritorio",
      origem: { obraId: ob.id || "", tipo: fonte.tipo, refId: fonte.refId, contaObra: fonte.contaId },
      unidadeId: modo === "empreendimento" ? "empreendimento" : "gestao_obras",
      clienteId: (cliente && cliente.id) || ob.clienteId || "",
      cliente: (cliente && cliente.nome) || "",
      projeto: ob.nome || "",
      empreendimentoId: modo === "empreendimento" ? ((cliente && cliente.id) || "") : "",
      contaId: destino,
      valor: Math.round((Number(fonte.valor) || 0) * 100) / 100,
      competencia,
      lancadoEm: String(fonte.data || "").slice(0, 10),
      descricao: fonte.descricao || "",
      fornecedor: fonte.fornecedor || "",
      fornecedorId: fonte.fornecedorId || "",
      documento: fonte.documento || "",
      // O número de referência é da TRANSAÇÃO: a conta da obra e o
      // lançamento que ela gera aqui carregam o mesmo número. Os papéis, não:
      // o comprovante de obra e de empreendimento mora na obra (e no
      // cliente). Anexo no escritório é só o que a pessoa anexa num
      // lançamento do próprio escritório.
      numeroDoc: fonte.numeroDoc || "",
      anexos: [],
      contaBanco: "sim",
      // Quando ele nasceu, para a lista pôr o mais novo na frente dentro do
      // mês. Sem isto, o lançamento recém-criado cai no meio dos outros de
      // setembro e parece que não entrou.
      criadoEm: new Date().toISOString(),
    });
  };

  // Paga no cartão não atravessa: o banco não debitou esta compra, vai
  // debitar a FATURA. Mandar a compra agora e a fatura depois contaria o
  // mesmo dinheiro duas vezes no extrato. Fica em ignorados, com o motivo,
  // para o painel e a conferência dizerem onde ela está.
  const noCartao = (c) => !!(c && c.pago && (c.formaPagamento === "cartao" || c.cartaoId));
  const doCliente = (id) => (o.cartoes || []).some((k) => k && k.id === id);
  for (const c of o.contasPagar || []) {
    if (!noCartao(c)) continue;
    ignorados.push({ origem: c.id, descricao: c.descricao || "",
      valor: Number(c.valorPago) || Number(c.valor) || 0,
      motivo: doCliente(c.cartaoId)
        ? "pago no cartão do cliente — não passa pelo escritório"
        : "pago no cartão — entra no escritório pela fatura" });
  }
  // as contas pagas da obra — o dinheiro que saiu, uma linha por nota
  // a parcela de gestão com movimentos já é do extrato: veio daqui
  for (const fonte of fontesDasContasPagas((o.contasPagar || []).filter((c) => !noCartao(c) && !(c && Array.isArray(c.movimentos))))) empurrar(fonte);
  // as entradas da obra — o dinheiro que entrou
  for (const e of o.entradas || []) {
    if (!e) continue;
    empurrar({
      tipo: "entrada", refId: e.id, contaId: e.contaId || "deposito_proprio",
      valor: Number(e.valor) || 0,
      data: e.data || "",
      descricao: e.descricao || "Entrada da obra",
      fornecedor: "", documento: e.documento || "",
      numeroDoc: e.numeroDoc || "",
      anexos: anexosDaTransacao(e),
    });
  }

  const soma = (lista) => Math.round(lista.reduce((t, x) => t + (Number(x.valor) || 0), 0) * 100) / 100;
  return { modo, lancamentos, existentes, bloqueados, ignorados,
    total: soma(lancamentos), totalBloqueado: soma(bloqueados) };
}

// ══════════════════════════════════════════════════════════════
// CARTÃO DE CRÉDITO — A COMPRA, A FATURA E O BANCO
// ══════════════════════════════════════════════════════════════
// Três datas diferentes para o mesmo dinheiro, e confundi-las é o que fez
// a obra e o escritório pararem de bater:
//
//   1. a COMPRA — o concreto entrou na obra no dia 23/09. O custo da obra é
//      integral nesse dia, mesmo que o pagamento se espalhe. Parcelar é
//      decisão de caixa do escritório, não consumo da obra;
//   2. a FATURA — a compra (ou cada parcela dela) cai na fatura do mês,
//      pelo dia de fechamento do cartão. Comprou depois do fechamento, cai
//      na fatura seguinte;
//   3. o BANCO — debita a FATURA, uma linha só, no vencimento. É isso, e
//      só isso, que entra no extrato do escritório.
//
// Por isso a compra no cartão não atravessa sozinha para o escritório: ela
// viraria uma linha que o banco nunca debitou. Quem atravessa é a fatura.
function cartaoVazio() {
  return {
    id: (typeof uid === "function" ? uid() : String(Date.now())),
    nome: "", bandeira: "",
    diaFechamento: 1,   // dia em que a fatura fecha
    diaVencimento: 10,  // dia em que o banco debita
    ativo: true,
  };
}

function cartaoPorId(cartoes, id) {
  return (cartoes || []).find((c) => c && c.id === id) || null;
}

// Em que fatura cai uma compra feita nesta data. Comprou NO dia do
// fechamento ou depois, já é da fatura seguinte — é como o cartão funciona,
// e errar isso joga a compra um mês inteiro fora do lugar.
function faturaDaCompra(cartao, dataIso) {
  const d = String(dataIso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  const ano = Number(d.slice(0, 4)), mes = Number(d.slice(5, 7)), dia = Number(d.slice(8, 10));
  const fecha = Math.max(1, Math.min(31, Number((cartao || {}).diaFechamento) || 1));
  let m = mes, a = ano;
  if (dia >= fecha) { m += 1; if (m > 12) { m = 1; a += 1; } }
  return a + "-" + String(m).padStart(2, "0");
}

function somarCompetencia(comp, n) {
  const a = Number(String(comp || "").slice(0, 4)), m = Number(String(comp || "").slice(5, 7));
  if (!a || !m) return "";
  const total = (a * 12) + (m - 1) + (Number(n) || 0);
  return Math.floor(total / 12) + "-" + String((total % 12) + 1).padStart(2, "0");
}

// O plano de parcelas de uma compra: a primeira na fatura em que ela caiu,
// as seguintes mês a mês. O resíduo do arredondamento vai na última, como
// nas parcelas de contrato — senão a soma das parcelas não fecha no valor
// da compra, e a diferença some sem dono.
function parcelasDoCartao(cartao, dataCompra, valor, quantas) {
  const total = Math.round((Number(valor) || 0) * 100) / 100;
  const n = Math.max(1, Math.floor(Number(quantas) || 1));
  const primeira = faturaDaCompra(cartao, dataCompra);
  if (!(total > 0) || !primeira) return [];
  const base = Math.round((total / n) * 100) / 100;
  const parcelas = [];
  let soma = 0;
  for (let i = 0; i < n; i++) {
    const v = i === n - 1 ? Math.round((total - soma) * 100) / 100 : base;
    soma = Math.round((soma + v) * 100) / 100;
    parcelas.push({ parcela: i + 1, de: n, competencia: somarCompetencia(primeira, i), valor: v });
  }
  return parcelas;
}

// Marca a conta como paga no cartão. `pagoEm` continua sendo o DIA DA
// COMPRA — é o custo da obra —, e o plano de parcelas fica na conta para a
// fatura encontrar.
function pagamentoNoCartao(conta, cartao, dados) {
  const c = conta || {}, d = dados || {};
  const dataCompra = String(d.pagoEm || "").slice(0, 10);
  const valor = Math.round(((Number(d.valorPago) || Number(c.valor)) || 0) * 100) / 100;
  const parcelas = parcelasDoCartao(cartao, dataCompra, valor, d.parcelas);
  if (!parcelas.length) return null;
  return {
    formaPagamento: "cartao",
    cartaoId: (cartao || {}).id || "",
    parcelasCartao: parcelas,
  };
}

// Tudo que compõe UMA fatura: as parcelas de qualquer obra e os
// lançamentos do próprio escritório feitos naquele cartão, com a
// competência desta fatura.
function linhasDaFatura(obras, lancamentos, cartaoId, competencia, opcoes) {
  const op = opcoes || {};
  const linhas = [];
  if (!cartaoId || !competencia) return linhas;
  for (const o of obras || []) {
    // Para onde a compra iria no escritório se fosse à vista — o mesmo
    // caminho da ponte. É o que a fatura usa para se abrir no resultado.
    const cli = (op.clientes || []).find((x) => x && o && x.id === o.clienteId) || null;
    const modo = modoDaPonte(o, cli);
    for (const c of (o && o.contasPagar) || []) {
      if (!c || c.cartaoId !== cartaoId) continue;
      for (const p of c.parcelasCartao || []) {
        if (!p || p.competencia !== competencia) continue;
        linhas.push({
          origem: "obra", obraId: o.id || "", obra: o.nome || "",
          contaId: c.contaId || "", descricao: c.descricao || "",
          fornecedor: c.favorecido || "", numeroDoc: c.numeroDoc || "",
          compraEm: String(c.pagoEm || "").slice(0, 10),
          parcela: p.parcela, de: p.de, valor: Math.round((Number(p.valor) || 0) * 100) / 100,
          refId: c.id,
          // o papel da compra de obra fica na obra — a fatura não o copia
          anexos: [],
          ...(() => {
            const destino = destinoNoEscritorio(c.contaId, modo, op);
            return {
              destinoContaId: destino,
              unidadeId: destino ? (modo === "empreendimento" ? "empreendimento" : "gestao_obras") : "",
              empreendimentoId: destino && modo === "empreendimento" ? ((cli && cli.id) || o.clienteId || "") : "",
              clienteId: (cli && cli.id) || o.clienteId || "",
            };
          })(),
        });
      }
    }
  }
  for (const l of lancamentos || []) {
    if (!l || l.cartaoId !== cartaoId) continue;
    for (const p of l.parcelasCartao || []) {
      if (!p || p.competencia !== competencia) continue;
      linhas.push({
        origem: "escritorio", obraId: "", obra: "",
        contaId: l.contaId || "", descricao: l.descricao || "",
        fornecedor: l.fornecedor || "", numeroDoc: l.numeroDoc || "",
        compraEm: String(l.lancadoEm || "").slice(0, 10),
        parcela: p.parcela, de: p.de, valor: Math.round((Number(p.valor) || 0) * 100) / 100,
        refId: l.id,
        anexos: anexosDaTransacao(l),
        destinoContaId: l.contaId || "",
        unidadeId: l.unidadeId || "escritorio",
        empreendimentoId: l.empreendimentoId || "",
        clienteId: l.clienteId || "",
      });
    }
  }
  return linhas.sort((a, b) => String(a.compraEm).localeCompare(String(b.compraEm)));
}

// As competências já fechadas deste cartão — toda fatura que virou
// lançamento no extrato.
function faturasFechadas(lancamentos, cartaoId) {
  const set = new Set();
  for (const l of lancamentos || []) {
    const o = (l || {}).origem || {};
    if (o.tipo === "fatura" && o.cartaoId === cartaoId && o.competencia) set.add(o.competencia);
  }
  return set;
}

// O que entra quando você fecha a fatura de um mês: as parcelas daquele
// mês MAIS as que ficaram para trás — a compra lançada com atraso, cuja
// competência caiu num mês que você já fechou.
//
// Sem essa varredura, lançar uma compra depois de fechar o mês dela a
// deixaria órfã para sempre: ela nunca entraria em fatura nenhuma, e o
// extrato do escritório ficaria menor que a fatura do banco. Por isso as
// atrasadas vêm marcadas, e não escondidas: você vê que elas são de outro
// mês antes de confirmar.
function faturaParaFechar(cartao, obras, lancamentos, competencia, opcoes) {
  const cid = (cartao || {}).id || "";
  const fechadas = faturasFechadas(lancamentos, cid);
  const doMes = linhasDaFatura(obras, lancamentos, cid, competencia, opcoes);
  const atrasadas = [];
  for (const comp of competenciasDoCartao(obras, lancamentos, cid)) {
    if (comp >= competencia) continue;
    if (fechadas.has(comp)) continue;
    for (const l of linhasDaFatura(obras, lancamentos, cid, comp, opcoes)) {
      atrasadas.push({ ...l, competenciaOriginal: comp, atrasada: true });
    }
  }
  const linhas = atrasadas.concat(doMes);
  return {
    competencia,
    jaFechada: fechadas.has(competencia),
    linhas,
    doMes,
    atrasadas,
    total: totalDaFatura(linhas),
    totalDoMes: totalDaFatura(doMes),
    totalAtrasado: totalDaFatura(atrasadas),
  };
}

function totalDaFatura(linhas) {
  return Math.round((linhas || []).reduce((s, l) => s + (Number(l.valor) || 0), 0) * 100) / 100;
}

// Id derivado, como o da ponte: lançar a mesma fatura duas vezes não cria
// duas linhas no extrato.
function idDaFatura(cartaoId, competencia) {
  return `fatura:${cartaoId || "?"}:${competencia || "?"}`;
}

// A fatura virando a ÚNICA linha do extrato do escritório. O banco debitou
// um valor; o extrato mostra um valor. A composição fica guardada em
// `linhas`, para quem clicar ver de onde veio.
function lancamentoDaFatura(cartao, competencia, linhas, opcoes) {
  const o = opcoes || {};
  const total = totalDaFatura(linhas);
  if (!(total > 0)) return null;
  const venc = String(o.pagoEm || "").slice(0, 10)
    || (competencia + "-" + String(Math.max(1, Math.min(28, Number((cartao || {}).diaVencimento) || 10))).padStart(2, "0"));
  return {
    id: idDaFatura((cartao || {}).id, competencia),
    tipo: "escritorio",
    origem: { tipo: "fatura", cartaoId: (cartao || {}).id || "", competencia },
    unidadeId: "escritorio",
    contaId: "cartao_credito",
    valor: total,
    competencia: String(venc).slice(0, 7),
    lancadoEm: venc,
    descricao: `Fatura ${(cartao || {}).nome || "cartão"} — ${mesAnoPorExtenso(competencia)}`
      + (linhas.length === 1 ? " · 1 compra" : ` · ${linhas.length} compras`),
    fornecedor: (cartao || {}).nome || "",
    documento: "",
    numeroDoc: o.numeroDoc || "",
    contaBanco: "sim",
    // a composição, para a fatura poder ser aberta e conferida
    linhas: linhas.map((l) => ({ obra: l.obra, descricao: l.descricao, fornecedor: l.fornecedor,
      contaId: l.contaId, parcela: l.parcela, de: l.de, valor: l.valor, numeroDoc: l.numeroDoc,
      anexos: l.anexos || [],
      // para onde cada compra vai no resultado (ver lancamentosParaResultado)
      origem: l.origem || "", obraId: l.obraId || "", refId: l.refId || "", compraEm: l.compraEm || "",
      destinoContaId: l.destinoContaId || "", unidadeId: l.unidadeId || "",
      empreendimentoId: l.empreendimentoId || "", clienteId: l.clienteId || "" })),
    // As notas de cada compra sobem para a fatura: é com elas que a fatura se
    // explica na prestação de contas. Uma nota parcelada aparece uma vez só.
    anexos: (() => {
      const vistos = {}, todos = [];
      for (const l of linhas || []) for (const a of l.anexos || []) {
        const k = (a && (a.public_id || a.url)) || "";
        if (!k || vistos[k]) continue; vistos[k] = 1; todos.push(a);
      }
      return todos;
    })(),
    criadoEm: new Date().toISOString(),
  };
}

// ── A fatura no RESULTADO ───────────────────────────────────────
// No extrato e na conferência com o banco a fatura é UMA linha, porque o
// banco debitou um valor. No resultado ela não pode ficar inteira em
// "Cartão de crédito": o concreto pago no cartão é Construção do
// empreendimento, não despesa do escritório. Então, para somar, a fatura se
// abre nas compras que ela contém, cada uma na conta para onde iria se
// tivesse sido paga à vista. O total é o mesmo, no mesmo mês — o saldo do
// extrato não mexe um centavo; muda só em que linha o dinheiro aparece.
//
// A compra que o próprio escritório lança no cartão (com o plano de
// parcelas) é o outro lado da mesma moeda: ela não sai do banco no dia, sai
// dentro da fatura. Somá-la também contaria o mesmo dinheiro duas vezes —
// por isso ela fica fora da soma e entra pela fatura, na conta dela.
//
// Fatura antiga, sem o destino gravado nas linhas, continua como estava:
// inteira em Cartão de crédito.
function compraNoCartaoDoEscritorio(l) {
  const o = (l && l.origem) || {};
  return !!(l && l.cartaoId && Array.isArray(l.parcelasCartao) && l.parcelasCartao.length && o.tipo !== "fatura");
}

function contaQueSaiDoBanco(contaId) {
  const c = contaEscritorio(contaId);
  const g = c && grupoEscritorio(c.grupo);
  return !!(g && g.sinal < 0);
}

function lancamentosParaResultado(lancamentos) {
  const fora = [];
  for (const l of lancamentos || []) {
    if (!l) continue;
    if (compraNoCartaoDoEscritorio(l)) continue;
    const o = l.origem || {};
    const linhas = Array.isArray(l.linhas) ? l.linhas : [];
    if (o.tipo !== "fatura" || !linhas.some((x) => x && x.destinoContaId)) { fora.push(l); continue; }
    const partes = [];
    let soma = 0;
    linhas.forEach((x, i) => {
      const v = efCentavos(x && x.valor);
      if (!(v > 0)) return;
      soma = efCentavos(soma + v);
      // Destino que ENTRARIA no banco (receita, venda) não cabe numa
      // fatura: fica em Cartão de crédito, para o saldo não inverter.
      const destino = x.destinoContaId && contaQueSaiDoBanco(x.destinoContaId) ? x.destinoContaId : "";
      partes.push({
        ...l,
        id: `${l.id}:${i + 1}`,
        origem: { tipo: "faturaLinha", faturaId: l.id, cartaoId: o.cartaoId || "", competencia: o.competencia || "",
          obraId: x.obraId || "", refId: x.refId || "" },
        contaId: destino || l.contaId,
        unidadeId: destino ? (x.unidadeId || l.unidadeId) : l.unidadeId,
        empreendimentoId: destino ? (x.empreendimentoId || "") : (l.empreendimentoId || ""),
        clienteId: destino ? (x.clienteId || "") : (l.clienteId || ""),
        projeto: x.obra || "",
        valor: v,
        descricao: [x.descricao, x.de > 1 ? `parcela ${x.parcela}/${x.de}` : ""].filter(Boolean).join(" · "),
        fornecedor: x.fornecedor || "",
        anexos: x.anexos || [],
        linhas: undefined,
      });
    });
    const resto = efCentavos((Number(l.valor) || 0) - soma);
    // Valor da fatura menor que a soma das compras: algo foi editado à mão.
    // Abrir daria uma linha negativa — melhor somar a fatura como está.
    if (resto < 0 || !partes.length) { fora.push(l); continue; }
    if (resto > 0) partes.push({ ...l, id: `${l.id}:resto`, valor: resto, linhas: undefined,
      origem: { tipo: "faturaLinha", faturaId: l.id, cartaoId: o.cartaoId || "", competencia: o.competencia || "" },
      descricao: "Diferença da fatura (juros, tarifas)" });
    for (const p of partes) fora.push(p);
  }
  return fora;
}

// ── Mexer numa compra do cartão ─────────────────────────────────
// A compra é a fonte: a conta da obra (ou o lançamento do escritório) com o
// plano de parcelas. Editar refaz o plano a partir da data, do valor e do
// número de parcelas — e as faturas se refazem sozinhas, porque são lidas
// dele. A única trava é a fatura FECHADA: ela já virou linha no extrato e
// conferiu com o banco. Mexer no dinheiro de uma parcela que está nela
// deixaria o extrato dizendo uma coisa e a fatura outra.
function fechadasDaCompra(compra, lancamentos) {
  const t = compra || {};
  if (!t.cartaoId) return [];
  const fechadas = faturasFechadas(lancamentos, t.cartaoId);
  return [...new Set((t.parcelasCartao || []).map((p) => p && p.competencia)
    .filter((c) => c && fechadas.has(c)))].sort();
}

// `origem` é "obra" (conta a pagar) ou "escritorio" (lançamento). Devolve a
// compra nova, ou null quando o que veio não forma um plano (sem data, sem
// valor).
function compraEditada(compra, mudancas, cartao, origem) {
  const t = compra || {}, m = mudancas || {};
  const ehObra = origem === "obra";
  const dataAntes = String((ehObra ? t.pagoEm : t.lancadoEm) || "").slice(0, 10);
  const valorAntes = ehObra ? (Number(t.valorPago) || Number(t.valor) || 0) : (Number(t.valor) || 0);
  const data = m.data != null && m.data !== "" ? String(m.data).slice(0, 10) : dataAntes;
  const valor = m.valor != null && m.valor !== "" ? efCentavos(m.valor) : efCentavos(valorAntes);
  const parcelas = m.parcelas != null && m.parcelas !== ""
    ? Math.max(1, Math.floor(Number(m.parcelas) || 1)) : ((t.parcelasCartao || []).length || 1);
  const plano = parcelasDoCartao(cartao, data, valor, parcelas);
  if (!plano.length) return null;
  const base = { ...t, descricao: m.descricao != null ? String(m.descricao).trim() : (t.descricao || ""),
    formaPagamento: "cartao", cartaoId: (cartao || {}).id || "", parcelasCartao: plano };
  if (ehObra) {
    return { ...base, pagoEm: data, valorPago: valor, valor,
      vencimento: t.vencimento && t.vencimento !== dataAntes ? t.vencimento : data };
  }
  return { ...base, valor, lancadoEm: data, competencia: data.slice(0, 7) };
}

// O que mudou no DINHEIRO da compra — é isso que a fatura fechada trava.
// Trocar só a descrição passa.
function compraMexeuNoDinheiro(antes, depois) {
  const plano = (x) => JSON.stringify(((x || {}).parcelasCartao || []).map((p) => [p.competencia, p.valor]));
  return plano(antes) !== plano(depois) || (antes || {}).cartaoId !== (depois || {}).cartaoId;
}

// A fatura fechada com o valor que o banco debitou de verdade — juros,
// tarifa, anuidade. A composição não muda; a diferença aparece no resultado
// como uma linha a mais em Cartão de crédito.
function faturaAjustada(lanc, mudancas) {
  const l = lanc || {}, m = mudancas || {};
  const valor = m.valor != null && m.valor !== "" ? efCentavos(m.valor) : efCentavos(l.valor);
  const data = m.data ? String(m.data).slice(0, 10) : String(l.lancadoEm || "").slice(0, 10);
  if (!(valor > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  return { ...l, valor, lancadoEm: data, competencia: data.slice(0, 7) };
}

// As faturas que existem num cartão: toda competência que tem alguma linha.
function competenciasDoCartao(obras, lancamentos, cartaoId) {
  const set = new Set();
  for (const o of obras || []) {
    for (const c of (o && o.contasPagar) || []) {
      if (!c || c.cartaoId !== cartaoId) continue;
      for (const p of c.parcelasCartao || []) if (p && p.competencia) set.add(p.competencia);
    }
  }
  for (const l of lancamentos || []) {
    if (!l || l.cartaoId !== cartaoId) continue;
    for (const p of l.parcelasCartao || []) if (p && p.competencia) set.add(p.competencia);
  }
  return [...set].sort();
}

// ── A baixa atravessando sozinha ───────────────────────
// Quando o dinheiro é do escritório, esperar alguém lembrar de apertar um
// botão numa aba de dentro do Planejamento é pedir que o saldo do mês fique
// errado. A baixa já é a decisão: o dinheiro saiu da conta, e o extrato tem
// que saber.
//
// Duas guardas, e as duas importam:
//
//   1. Só as contas que ACABARAM de ser pagas. Rodar a ponte na obra inteira
//      traria de volta tudo que já foi pago antes — e o histórico antigo veio
//      por importação de base, sem id de ponte, então duplicaria em silêncio.
//   2. Só onde o dinheiro passa pela conta do escritório: empreendimento (a
//      obra é dele) e gestão (o dinheiro do cliente transita por lá). Obra
//      marcada como "o cliente paga direto" continua pelo botão: lá só o
//      honorário atravessa, e isso é decisão de quem fecha o mês.
// A baixa e a UNICA rota. Antes havia duas — a baixa, para o que e do
// escritorio, e um botao "mandar" para o resto —, e duas rotas para o mesmo
// dinheiro e exatamente como o mesmo gasto entra duas vezes: uma pela mao,
// outra pelo botao. O botao saiu; o que atravessa, atravessa na hora em que
// o dinheiro sai, sem depender de alguem lembrar.
//
// Nos modos em que so parte do dinheiro passa pela conta do escritorio (a
// obra em que o cliente paga os fornecedores direto, onde so o honorario
// atravessa), quem filtra ja e `destinoNoEscritorio`: o que nao tem destino
// nao vira lancamento. Entao liberar todos os modos aqui nao traz nada que
// nao devesse vir.
function ponteAutomaticaNaBaixa(modo) {
  return true;
}

function lancamentosDaBaixa(obra, cliente, contasPagas, opcoes) {
  const modo = modoDaPonte(obra, cliente);
  const vazio = { modo, lancamentos: [], bloqueados: [], ignorados: [], existentes: [], total: 0 };
  if (!ponteAutomaticaNaBaixa(modo)) return vazio;
  if (!(contasPagas || []).length) return vazio;
  // A ponte recebe SÓ as recém-pagas no lugar da lista inteira da obra; o
  // resto do cálculo — destino, competência, mês fechado, id derivado — é o
  // mesmo de sempre, para preview e automático nunca divergirem.
  const r = lancamentosDaObraParaEscritorio(obra, cliente,
    Object.assign({}, opcoes || {}, { contasPagar: contasPagas, entradas: [] }));
  return Object.assign({}, r, { modo });
}

// ── A transação é UMA, vista de dois lados ──────────────────────
// O lançamento do escritório nasce da conta da obra e aponta para ela em
// `origem`: a conta (tipo "conta"), o pedido inteiro (tipo "pedido", com a
// chave pedido|conta|data — a nota vira uma linha só no extrato) ou o
// número do papel (tipo "doc", o que veio da planilha antiga). Saber quem
// está ligado a quem é o que permite excluir de um lado e o outro ir junto.
function ligaContaAoLancamento(l, obraId, conta) {
  const o = (l && l.origem) || {};
  const c = conta || {};
  if (!o.obraId || o.obraId !== obraId || !c.id) return false;
  if (o.tipo === "conta") return o.refId === refDaParcela(c);
  if (o.tipo === "pedido") return !!c.pedidoId && String(o.refId || "").split("|")[0] === c.pedidoId;
  if (o.tipo === "doc") return !!c.doc && String(o.refId || "") === String(c.doc);
  return false;
}

function lancamentosLigadosAsContas(lancamentos, obraId, contas) {
  const cs = (contas || []).filter(Boolean);
  if (!cs.length) return [];
  return (lancamentos || []).filter((l) => l && cs.some((c) => ligaContaAoLancamento(l, obraId, c)));
}

// O caminho de volta: as contas da obra que um lançamento representa. O
// pedido leva os itens da mesma nota, conta contábil e data — exatamente o
// recorte que virou aquela linha no extrato.
function contasLigadasAoLancamento(obra, l) {
  const o = (l && l.origem) || {};
  const ob = obra || {};
  if (!o.obraId || o.obraId !== ob.id) return [];
  const contas = (ob.contasPagar || []).filter(Boolean);
  if (o.tipo === "conta") return contas.filter((c) => refDaParcela(c) === o.refId);
  if (o.tipo === "doc") return contas.filter((c) => c.doc && String(c.doc) === String(o.refId));
  if (o.tipo === "pedido") {
    const [ped, contaId, data] = String(o.refId || "").split("|");
    return contas.filter((c) => c.pedidoId === ped
      && (!contaId || (c.contaId || "") === contaId)
      && (!data || String(c.pagoEm || c.vencimento || "").slice(0, 10) === data));
  }
  return [];
}

// Conta que saiu da obra (ou deixou de ser paga) leva o lançamento dela
// junto. Relançar um pedido pago apaga as contas antigas e cria outras, com
// ids novos — e o lançamento velho ficava órfão no extrato, somando duas
// vezes o mesmo dinheiro no Investido do empreendimento. Quem some da obra
// some do extrato. Vale para o pedido agrupado (uma linha por nota) e para
// o lançamento antigo ligado pelo número do papel — antes só a conta solta
// saía, e a nota apagada continuava no extrato.
//
// Se só PARTE da nota saiu, a linha da nota sai inteira e `reenviar` diz
// quais contas pagas ficaram dela: quem chama manda essas de novo pela
// ponte, com o valor certo.
function semLancamentosDasContas(lancamentos, obraId, contasRemovidas, contasDepois) {
  const fora = {};
  for (const c of contasRemovidas || []) {
    if (c && c.id) fora[idDaPonte(obraId, "conta", c.id)] = true;
  }
  const ligados = lancamentosLigadosAsContas(lancamentos, obraId, contasRemovidas);
  for (const l of ligados) fora[l.id] = true;
  if (!Object.keys(fora).length) return { lancamentos: lancamentos || [], removidos: 0, reenviar: [] };
  const ficam = (lancamentos || []).filter((l) => !(l && fora[l.id]));
  const saiu = (lancamentos || []).filter((l) => l && fora[l.id]);
  const idsFora = new Set((contasRemovidas || []).map((c) => c && c.id));
  const reenviar = (contasDepois || []).filter((c) => c && c.pago && !idsFora.has(c.id)
    && saiu.some((l) => ligaContaAoLancamento(l, obraId, c)));
  return { lancamentos: ficam, removidos: (lancamentos || []).length - ficam.length, reenviar };
}

function motivoDeIgnorar(contaId, modo, opcoes) {
  const grupo = ponteGrupoDaConta(contaId, opcoes);
  if (!contaId || !grupo) return "conta da obra sem correspondência no escritório";
  if (modo === "clientePaga") return "o cliente paga direto: este dinheiro não passa pelo escritório";
  if (modo === "empreendimento") {
    if (contaId === "taxa_admin_obra") return "gerenciamento da obra própria não é receita";
    if (contaId === "liberacao_financ") return "financiamento é dívida, e não há conta para isso ainda";
    if (contaId === "cartao_credito") return "cartão de crédito não passa pelo escritório";
    return "não atravessa no empreendimento";
  }
  if (contaId === "cartao_credito") return "cartão de crédito não passa pelo escritório";
  if (contaId === "venda_imovel" || grupo === "terreno") return "é do empreendimento, não da gestão";
  return "não atravessa na gestão de obras";
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
  // dia/mês/ano com qualquer separador: cada banco escolhe o seu.
  m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(t);
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


// ── Ler planilha solta (.xlsx/.xlsm) e CSV ──────────────────────
// ── Leitura de planilha (.xlsx/.xlsm) sem dependência ───────────
// O arquivo é um ZIP de XMLs. O navegador já sabe descompactar
// (DecompressionStream), então o que falta é achar as peças dentro do zip e
// ler o XML da aba. Node 18+ também tem, então o teste roda igual.

function efLerU16(b, i) { return b[i] | (b[i + 1] << 8); }
function efLerU32(b, i) { return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0; }

// Índice do ZIP: percorre o diretório central e guarda onde cada arquivo
// começa. Não lê conteúdo — isso é sob demanda, um arquivo por vez.
function efIndiceZip(buffer) {
  const b = new Uint8Array(buffer);
  let fim = -1;
  for (let i = b.length - 22; i >= 0 && i >= b.length - 66000; i--) {
    if (efLerU32(b, i) === 0x06054b50) { fim = i; break; }
  }
  if (fim < 0) throw new Error("Arquivo não parece uma planilha (.xlsx ou .xlsm).");
  const total = efLerU16(b, fim + 10);
  let p = efLerU32(b, fim + 16);
  const itens = {};
  const texto = new TextDecoder("utf-8");
  for (let n = 0; n < total; n++) {
    if (efLerU32(b, p) !== 0x02014b50) break;
    const metodo = efLerU16(b, p + 10);
    const comprimido = efLerU32(b, p + 20);
    const tamNome = efLerU16(b, p + 28);
    const tamExtra = efLerU16(b, p + 30);
    const tamComent = efLerU16(b, p + 32);
    const local = efLerU32(b, p + 42);
    const nome = texto.decode(b.subarray(p + 46, p + 46 + tamNome));
    itens[nome] = { metodo, comprimido, local };
    p += 46 + tamNome + tamExtra + tamComent;
  }
  return { bytes: b, itens };
}

async function efInflar(pedaco, metodo) {
  if (metodo === 0) return pedaco;
  if (typeof DecompressionStream === "undefined") throw new Error("Este navegador não consegue abrir planilhas; cole os dados ou salve como CSV.");
  const fluxo = new Blob([pedaco]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const buf = await new Response(fluxo).arrayBuffer();
  return new Uint8Array(buf);
}

async function efArquivoDoZip(zip, nome) {
  const item = zip.itens[nome];
  if (!item) return null;
  const b = zip.bytes;
  const p = item.local;
  if (efLerU32(b, p) !== 0x04034b50) throw new Error("Planilha corrompida.");
  const inicio = p + 30 + efLerU16(b, p + 26) + efLerU16(b, p + 28);
  const cru = b.subarray(inicio, inicio + item.comprimido);
  const aberto = await efInflar(cru, item.metodo);
  return new TextDecoder("utf-8").decode(aberto);
}

// ── XML ─────────────────────────────────────────────────────────
function efTextoXml(t) {
  return String(t == null ? "" : t)
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

function efTextosCompartilhados(xml) {
  if (!xml) return [];
  const fora = [];
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g;
  let m;
  while ((m = re.exec(xml))) {
    const dentro = m[1] || "";
    let texto = "";
    const reT = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let t;
    while ((t = reT.exec(dentro))) texto += efTextoXml(t[1]);
    fora.push(texto);
  }
  return fora;
}

// Quais estilos são data: os formatos embutidos do Excel mais os
// personalizados cujo código tem dia/mês/ano fora das aspas.
const EF_FMT_DATA = new Set([14,15,16,17,18,19,20,21,22,27,28,29,30,31,32,33,34,35,36,45,46,47,50,51,52,53,54,55,56,57,58]);
function efEstilosDeData(xml) {
  const datas = new Set();
  if (!xml) return datas;
  const personalizados = {};
  const reN = /<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g;
  let m;
  while ((m = reN.exec(xml))) personalizados[m[1]] = efTextoXml(m[2]);
  const bloco = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml);
  if (!bloco) return datas;
  const reX = /<xf\b[^>]*?numFmtId="(\d+)"[^>]*?(?:\/>|>)/g;
  let i = 0, x;
  while ((x = reX.exec(bloco[1]))) {
    const id = Number(x[1]);
    let ehData = EF_FMT_DATA.has(id);
    if (!ehData && personalizados[x[1]]) {
      const limpo = personalizados[x[1]].replace(/\[[^\]]*\]/g, "").replace(/"[^"]*"/g, "").replace(/\\./g, "");
      ehData = /[ymd]/i.test(limpo) && !/^[^ymd]*$/i.test(limpo);
    }
    if (ehData) datas.add(i);
    i++;
  }
  return datas;
}

// Serial do Excel → "dd/mm/aaaa" (a base é 30/12/1899).
function efDataDoSerial(n) {
  const ms = Math.round((Number(n) - 25569) * 86400000);
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return String(n);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function efColunaDaRef(ref) {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

// Uma aba vira matriz de texto. Célula vazia vira "". Linha sem nada some.
function efLinhasDaAba(xml, textos, estilosData) {
  const linhas = [];
  const reLinha = /<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g;
  let mr;
  while ((mr = reLinha.exec(xml))) {
    const corpo = mr[1] || "";
    if (!corpo) continue;
    const celulas = [];
    let largura = 0;
    const reCel = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let mc;
    while ((mc = reCel.exec(corpo))) {
      const attrs = mc[1] || "";
      const dentro = mc[2] || "";
      const ref = /r="([A-Z]+)\d+"/.exec(attrs);
      const col = ref ? efColunaDaRef(ref[1]) : celulas.length;
      const tipo = (/t="([^"]+)"/.exec(attrs) || [])[1] || "n";
      const estilo = Number((/s="(\d+)"/.exec(attrs) || [])[1] || -1);
      let valor = "";
      if (tipo === "inlineStr") {
        const reT = /<t\b[^>]*>([\s\S]*?)<\/t>/g; let t;
        while ((t = reT.exec(dentro))) valor += efTextoXml(t[1]);
      } else {
        const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(dentro);
        const cru = v ? efTextoXml(v[1]) : "";
        if (tipo === "s") valor = textos[Number(cru)] || "";
        else if (tipo === "b") valor = cru === "1" ? "VERDADEIRO" : "FALSO";
        else if (tipo === "e") valor = "";
        else if (cru === "") valor = "";
        else if (estilosData.has(estilo) && Number(cru) > 0) valor = efDataDoSerial(cru);
        else valor = cru;
      }
      celulas[col] = valor;
      if (col + 1 > largura) largura = col + 1;
    }
    if (!largura) continue;
    const linha = [];
    for (let i = 0; i < largura; i++) linha.push(String(celulas[i] == null ? "" : celulas[i]).replace(/[\t\r\n]+/g, " ").trim());
    if (linha.every((c) => c === "")) continue;
    linhas.push(linha);
  }
  return linhas;
}

// Abre a planilha e devolve as abas com suas linhas.
async function efAbasDaPlanilha(buffer) {
  const zip = efIndiceZip(buffer);
  const textos = efTextosCompartilhados(await efArquivoDoZip(zip, "xl/sharedStrings.xml"));
  const estilosData = efEstilosDeData(await efArquivoDoZip(zip, "xl/styles.xml"));
  const livro = (await efArquivoDoZip(zip, "xl/workbook.xml")) || "";
  const rels = (await efArquivoDoZip(zip, "xl/_rels/workbook.xml.rels")) || "";
  const alvo = {};
  const reR = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
  let mr;
  while ((mr = reR.exec(rels))) alvo[mr[1]] = efTextoXml(mr[2]).replace(/^\/?xl\//, "").replace(/^\//, "");
  const abas = [];
  const reS = /<sheet\b[^>]*\/>/g;
  let ms;
  while ((ms = reS.exec(livro))) {
    const tag = ms[0];
    const nome = efTextoXml((/name="([^"]*)"/.exec(tag) || [])[1] || "");
    const rid = (/r:id="([^"]+)"/.exec(tag) || [])[1];
    const caminho = "xl/" + (alvo[rid] || `worksheets/sheet${abas.length + 1}.xml`);
    const xml = await efArquivoDoZip(zip, caminho);
    abas.push({ nome, linhas: xml ? efLinhasDaAba(xml, textos, estilosData) : [] });
  }
  return abas;
}


// CSV/TSV também servem: se o separador não for tabulação, converte —
// respeitando aspas, que é onde vírgula dentro de descrição costuma morar.
function efSeparadorDoTexto(texto) {
  const linha = String(texto || "").split(/\r?\n/).find((l) => l.trim() !== "") || "";
  const fora = linha.replace(/"[^"]*"/g, "");
  if (fora.indexOf("\t") >= 0) return "\t";
  const p = (fora.match(/;/g) || []).length;
  const v = (fora.match(/,/g) || []).length;
  if (p >= v && p > 0) return ";";
  if (v > 0) return ",";
  return "\t";
}

function efCsvParaTsv(texto, separador) {
  const sep = separador || efSeparadorDoTexto(texto);
  if (sep === "\t") return String(texto || "");
  const linhas = [];
  let campo = "", linha = [], aspas = false;
  const t = String(texto || "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
      else campo += c;
      continue;
    }
    if (c === '"') { aspas = true; continue; }
    if (c === sep) { linha.push(campo); campo = ""; continue; }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = "";
      continue;
    }
    campo += c;
  }
  if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.map((l) => l.map((c) => String(c).replace(/[\t\r\n]+/g, " ").trim()).join("\t")).join("\n");
}

// Qual aba tem os lançamentos: a primeira cuja primeira linha traz conta,
// valor e competência. Assim o arquivo pode ter P&L, resumo, o que for.
function efAbaDeLancamentos(abas) {
  const lista = abas || [];
  const pontos = (aba) => {
    const cab = (aba.linhas && aba.linhas[0]) || [];
    let achou = 0;
    for (const campo of ["conta", "valor", "competencia"]) {
      const nomes = EF_COLUNAS[campo] || [];
      if (cab.some((c) => nomes.includes(efSemAcento(c)))) achou++;
    }
    return achou;
  };
  let melhor = null, melhorPonto = 0;
  for (const aba of lista) {
    const p = pontos(aba);
    if (p > melhorPonto) { melhor = aba; melhorPonto = p; }
  }
  if (melhor && melhorPonto >= 2) return melhor;
  return lista.find((a) => (a.linhas || []).length > 1) || lista[0] || null;
}

// Arquivo solto (planilha, CSV ou texto) → as linhas em formato de colagem.
// Devolve também o nome da aba, para a tela dizer de onde leu.
async function efTextoDoArquivo(arquivo) {
  const nome = String((arquivo && arquivo.name) || "").toLowerCase();
  const ehPlanilha = /\.(xlsx|xlsm|xltx|xltm)$/.test(nome);
  if (ehPlanilha) {
    const abas = await efAbasDaPlanilha(await arquivo.arrayBuffer());
    const aba = efAbaDeLancamentos(abas);
    if (!aba || !aba.linhas.length) throw new Error("Não achei linhas nessa planilha.");
    return { texto: aba.linhas.map((l) => l.join("\t")).join("\n"), aba: aba.nome, abas: abas.map((a) => a.nome) };
  }
  if (/\.(xls|numbers|ods)$/.test(nome)) {
    throw new Error("Esse formato não abre aqui. Salve como .xlsx ou .csv e traga de novo.");
  }
  const texto = await arquivo.text();
  return { texto: efCsvParaTsv(texto), aba: "", abas: [] };
}


// ── Resumo do mês, para a tela de entrada ───────────────────────
// Não recalcula nada: lê as linhas que o extrato já produziu e separa o
// mês de referência do anterior, para a tela mostrar o número e a variação.
// `hoje` entra por parâmetro para o teste não depender do calendário.
function resumoEscritorio(linhas, opcoes) {
  const o = opcoes || {};
  const lista = (linhas || []).filter((l) => l && /^\d{4}-\d{2}$/.test(String(l.mes)));
  if (!lista.length) return null;
  const agora = o.hoje instanceof Date ? o.hoje : new Date();
  const mesDeHoje = o.mes || `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  // Mês de referência: o mês corrente quando ele já existe no extrato;
  // senão o último mês que o extrato alcança até hoje; senão o primeiro.
  const ateHoje = lista.filter((l) => String(l.mes) <= mesDeHoje);
  const atual = lista.find((l) => l.mes === mesDeHoje) || ateHoje[ateHoje.length - 1] || lista[0];
  const i = lista.indexOf(atual);
  const anterior = i > 0 ? lista[i - 1] : null;
  const ultimo = lista[lista.length - 1];

  const campos = (l) => ({
    receitas: (l.grupos && l.grupos.receitas) || 0,
    despesas: (l.grupos && l.grupos.despesas) || 0,
    resultado: l.saldoEscritorio || 0,
    retiradas: l.retiradas || 0,
    saldo: l.saldoExtrato || 0,
  });
  const a = campos(atual);
  const b = anterior ? campos(anterior) : null;
  const variacao = (chave) => {
    if (!b) return null;
    const antes = b[chave], agoraV = a[chave];
    if (!antes) return null;
    return (agoraV - antes) / Math.abs(antes);
  };

  return {
    mes: atual.mes,
    mesAnterior: anterior ? anterior.mes : "",
    ...a,
    anterior: b,
    variacao: { receitas: variacao("receitas"), despesas: variacao("despesas"), resultado: variacao("resultado") },
    // Lançamentos com competência à frente do mês de referência já entram
    // no saldo dos meses seguintes: a tela avisa em vez de esconder.
    futuro: ultimo.mes > atual.mes ? { ate: ultimo.mes, saldo: ultimo.saldoExtrato || 0 } : null,
  };
}

// "2026-09" → "setembro de 2026"; com abreviado, "set/26".
const EF_MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
function efMesPorExtenso(mes, curto) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(mes || ""));
  if (!m) return String(mes || "");
  const nome = EF_MESES[Number(m[2]) - 1] || "";
  if (curto) return `${nome.slice(0, 3)}/${m[1].slice(2)}`;
  return `${nome} de ${m[1]}`;
}

// "2026-10" → "Outubro 2026". É assim que o mês aparece para quem lê:
// fatura, competência, prévia de parcelas. O "2026-10" fica para o banco
// de dados e para os filtros.
function mesAnoPorExtenso(comp) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(comp || "").trim());
  if (!m) return String(comp || "");
  const nome = EF_MESES[Number(m[2]) - 1] || "";
  return nome.charAt(0).toUpperCase() + nome.slice(1) + " " + m[1];
}

// "2026-09-04" → "04/09/2026", sem passar por Date (fuso não mexe no dia).
function efDiaBR(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || "");
}


// ── Filtro do painel ────────────────────────────────────────────
// Ano, mês e unidade de negócio. Vazio em qualquer um significa "tudo".
function filtrarLancamentosEscritorio(lancamentos, filtro) {
  const f = filtro || {};
  return (lancamentos || []).filter((l) => {
    if (!l || !/^\d{4}-\d{2}$/.test(String(l.competencia))) return false;
    const [ano, mes] = String(l.competencia).split("-");
    if (f.ano && ano !== String(f.ano)) return false;
    if (f.mes && mes !== String(f.mes).padStart(2, "0")) return false;
    if (f.unidadeId && l.unidadeId !== f.unidadeId) return false;
    return true;
  });
}

// O que o período filtrado somou, por grupo e por conta. O saldo bancário
// não entra aqui: ele é do extrato inteiro, não de um recorte.
function resumoDoPeriodoEscritorio(lancamentos) {
  const grupos = {}, contas = {};
  for (const l of lancamentosParaResultado(lancamentos)) {
    const conta = contaEscritorio(l && l.contaId);
    if (!conta) continue;
    const v = Number(l.valor) || 0;
    grupos[conta.grupo] = (grupos[conta.grupo] || 0) + v;
    contas[conta.id] = (contas[conta.id] || 0) + v;
  }
  const g = (id) => efCentavos(grupos[id] || 0);
  const receitas = g("receitas"), despesas = g("despesas");
  const linhas = Object.keys(contas).map((id) => {
    const c = contaEscritorio(id);
    return { contaId: id, nome: c.nome, grupo: c.grupo, sinal: (grupoEscritorio(c.grupo) || {}).sinal || 1, valor: efCentavos(contas[id]) };
  }).sort((a, b) => b.valor - a.valor);
  return {
    receitas, despesas,
    resultado: efCentavos(receitas - despesas),
    retiradas: efCentavos(g("socios") - g("socios_entradas")),
    entradasGestao: g("gestao_entradas"),
    saidasGestao: g("gestao_saidas"),
    saldoGestao: efCentavos(g("gestao_entradas") - g("gestao_saidas")),
    investimentoEmpreendimento: g("emp_saidas"),
    vendasEmpreendimento: g("emp_entradas"),
    contas: linhas,
    quantidade: (lancamentos || []).length,
  };
}

// ── Fechamento do mês ───────────────────────────────────────────
// Fechar é dizer "conferi este mês contra o extrato do banco e bate".
// Depois disso o mês não recebe mais lançamento — nem por engano, nem por
// importação. O registro guarda o saldo do banco para poder reconferir.
function fechamentosDoEscritorio(data) {
  const f = (((data || {}).escritorio || {}).financeiro || {}).fechamentos;
  return (f && typeof f === "object") ? f : {};
}

function mesEstaFechado(mes, fechamentos) {
  const f = (fechamentos || {})[String(mes)];
  return !!(f && f.fechadoEm);
}

function ultimoMesFechado(fechamentos) {
  const meses = Object.keys(fechamentos || {}).filter((m) => mesEstaFechado(m, fechamentos)).sort();
  return meses.length ? meses[meses.length - 1] : "";
}

// Como está a conferência de um mês: quantos lançamentos já foram marcados
// como vistos no extrato do banco, e quanto ainda falta conferir.
function conferenciaDoMes(lancamentos, mes) {
  // A compra no cartão não aparece no banco — quem aparece é a fatura.
  const doMes = (lancamentos || []).filter((l) => l && String(l.competencia) === String(mes)
    && !compraNoCartaoDoEscritorio(l));
  const conferidos = doMes.filter((l) => l.conferido);
  const soma = (lista) => efCentavos(lista.reduce((s, l) => s + (Number(l.valor) || 0), 0));
  return {
    total: doMes.length,
    conferidos: conferidos.length,
    pendentes: doMes.length - conferidos.length,
    valorConferido: soma(conferidos),
    valorPendente: soma(doMes.filter((l) => !l.conferido)),
    lancamentos: doMes,
  };
}

// Diferença entre o que o extrato do VICKE diz e o que o banco diz.
// Positiva: o banco tem mais do que o sistema — falta lançar entrada.
function diferencaDeFechamento(saldoCalculado, saldoBanco) {
  if (saldoBanco == null || saldoBanco === "") return null;
  return efCentavos((Number(saldoBanco) || 0) - (Number(saldoCalculado) || 0));
}

// Um lançamento só entra em mês aberto. A regra vale para o formulário e
// para a importação — mês fechado é passado conferido, não se mexe.
function bloqueioPorMesFechado(competencia, fechamentos) {
  if (!competencia || !mesEstaFechado(competencia, fechamentos)) return "";
  return `${efMesPorExtenso(competencia)} já está fechado: não dá para lançar nesse mês.`;
}



// Arquivo solto → a tabela crua, sem supor formato. É o que o
// reconhecimento de colunas precisa para olhar o conteúdo.
async function efTabelaDoArquivo(arquivo) {
  const nome = String((arquivo && arquivo.name) || "").toLowerCase();
  if (/\.(xlsx|xlsm|xltx|xltm)$/.test(nome)) {
    const abas = await efAbasDaPlanilha(await arquivo.arrayBuffer());
    // A aba boa é a que tem mais linhas com data e número.
    const nota = (a) => (a.linhas || []).filter((l) => (l || []).some(efEhData) && (l || []).some((c) => efValorDeTexto(c) != null)).length;
    const escolhida = (abas || []).slice().sort((x, y) => nota(y) - nota(x))[0];
    if (!escolhida || !escolhida.linhas.length) throw new Error("Não achei linhas nessa planilha.");
    return { linhas: escolhida.linhas, aba: escolhida.nome, abas: (abas || []).map((a) => a.nome) };
  }
  if (/\.(xls|numbers|ods)$/.test(nome)) throw new Error("Esse formato não abre aqui. Salve como .xlsx ou .csv.");
  const texto = efCsvParaTsv(await arquivo.text());
  return { linhas: texto.split(/\r?\n/).filter((l) => l.trim() !== "").map((l) => l.split("\t")), aba: "", abas: [] };
}

// ── Reconhecer as colunas de uma tabela qualquer ────────────────
// Cada banco manda o extrato de um jeito e cada escritório tem a sua
// planilha. Em vez de exigir um cabeçalho conhecido, olhamos o CONTEÚDO:
// o que parece data é data, o que tem centavos e sinal é valor, o texto
// mais longo é o histórico. O nome da coluna, quando existe, só confirma.

function efEhData(t) {
  const s = String(t == null ? "" : t).trim();
  if (!s) return false;
  return /^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/.test(s) || /^\d{4}-\d{2}-\d{2}/.test(s);
}

// Número em formato brasileiro ou americano, com ou sem R$ e sinal.
function efValorDeTexto(t) {
  let s = String(t == null ? "" : t).replace(/\s|R\$| /gi, "").trim();
  if (!s) return null;
  const negativo = /^\(.*\)$/.test(s) || s.indexOf("-") >= 0;
  s = s.replace(/[()]/g, "").replace(/-/g, "");
  if (!/^[\d.,]+$/.test(s)) return null;
  const virgula = s.lastIndexOf(","), ponto = s.lastIndexOf(".");
  if (virgula >= 0 && virgula > ponto) s = s.replace(/\./g, "").replace(",", ".");
  else if (virgula >= 0) s = s.replace(/,/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

// Onde está o cabeçalho: a primeira linha das 15 primeiras cujas células
// são texto curto e que é seguida por linhas com dado de verdade. Extrato
// de banco costuma ter um título antes ("EXTRATO CONTA CORRENTE").
function efLinhaDoCabecalho(linhas, limite) {
  const ate = Math.min(linhas.length, limite || 15);
  let melhor = -1, melhorNota = 0;
  for (let i = 0; i < ate; i++) {
    const l = linhas[i] || [];
    const cheias = l.filter((c) => String(c || "").trim() !== "");
    if (cheias.length < 2) continue;
    const textoCurto = cheias.filter((c) => {
      const s = String(c).trim();
      return s.length <= 34 && !efEhData(s) && efValorDeTexto(s) == null;
    }).length;
    const seguintes = linhas.slice(i + 1, i + 6);
    const temDadoAbaixo = seguintes.some((s) => (s || []).some((c) => efEhData(c) || efValorDeTexto(c) != null));
    if (!temDadoAbaixo) continue;
    const nota = textoCurto / cheias.length + (cheias.length >= 3 ? 0.2 : 0);
    if (nota > melhorNota && textoCurto >= 2) { melhorNota = nota; melhor = i; }
  }
  return melhor;
}

const EF_NOMES = {
  data:      ["data", "data lancamento", "data do lancamento", "data mov", "data movimento", "dt", "data da operacao", "periodo contabil", "competencia"],
  valor:     ["valor", "valor total nota", "valor r$", "vlr", "montante", "valor da operacao", "valor lancamento"],
  debito:    ["debito", "saida", "pagamento", "debitos"],
  credito:   ["credito", "entrada", "recebimento", "creditos"],
  documento: ["documento", "doc", "nota", "nota / comprovante", "numero do documento", "num doc"],
  historico: ["historico", "descricao", "descricao lancamento", "lancamento", "memo", "detalhe", "fornecedor"],
  complemento: ["informacoes complementares", "informacoes", "complemento", "observacao", "detalhamento"],
  saldo:     ["saldo", "saldo do dia", "saldo apos"],
};

// Uma coluna por vez: o que as células dela parecem ser.
function efPerfilDaColuna(valores) {
  const cheias = valores.filter((v) => String(v == null ? "" : v).trim() !== "");
  if (!cheias.length) return { vazia: true };
  const datas = cheias.filter(efEhData).length;
  const numeros = cheias.map(efValorDeTexto).filter((n) => n != null);
  const comCentavos = numeros.filter((n) => Math.round(n * 100) % 100 !== 0).length;
  const negativos = numeros.filter((n) => n < 0).length;
  const textos = cheias.filter((v) => efEhData(v) === false && efValorDeTexto(v) == null);
  const comprimento = textos.length ? textos.reduce((s, t) => s + String(t).length, 0) / textos.length : 0;
  return {
    preenchimento: cheias.length / Math.max(valores.length, 1),
    pData: datas / cheias.length,
    pNumero: numeros.length / cheias.length,
    pCentavos: numeros.length ? comCentavos / numeros.length : 0,
    pNegativo: numeros.length ? negativos / numeros.length : 0,
    pTexto: textos.length / cheias.length,
    comprimento,
    distintos: new Set(cheias.map((v) => String(v))).size,
    total: cheias.length,
  };
}

// Junta tudo: devolve qual coluna é o quê, com a confiança de cada escolha.
function detectarColunasTabela(linhas, opcoes) {
  const o = opcoes || {};
  const iCab = o.linhaCabecalho != null ? o.linhaCabecalho : efLinhaDoCabecalho(linhas);
  const cabecalho = iCab >= 0 ? (linhas[iCab] || []).map((c) => efSemAcento(c)) : [];
  const corpo = linhas.slice(iCab >= 0 ? iCab + 1 : 0).filter((l) => (l || []).some((c) => String(c || "").trim() !== ""));
  const largura = Math.max(0, ...linhas.map((l) => (l || []).length));
  const perfis = [];
  for (let c = 0; c < largura; c++) perfis.push(efPerfilDaColuna(corpo.map((l) => (l || [])[c])));

  const peloNome = (campo, c) => {
    const nome = cabecalho[c] || "";
    if (!nome) return 0;
    const lista = EF_NOMES[campo] || [];
    if (lista.includes(nome)) return 1;
    return lista.some((n) => nome.indexOf(n) >= 0 || n.indexOf(nome) >= 0) ? 0.6 : 0;
  };

  const nota = {
    data: (p, c) => (p.vazia ? 0 : p.pData * 2 + peloNome("data", c)),
    valor: (p, c) => (p.vazia ? 0 : p.pNumero * 1.4 + p.pCentavos * 0.6 + p.pNegativo * 0.6 + peloNome("valor", c)
      - (peloNome("saldo", c) ? 2 : 0)),
    documento: (p, c) => (p.vazia ? 0 : peloNome("documento", c) * 1.5 + (p.pTexto > 0.3 && p.comprimento < 14 ? 0.4 : 0)),
    historico: (p, c) => (p.vazia ? 0 : p.pTexto * 1.2 + Math.min(p.comprimento / 40, 1) + peloNome("historico", c) * 2
      - (peloNome("complemento", c) ? 1 : 0)),
    complemento: (p, c) => (p.vazia ? 0 : p.pTexto * 0.8 + Math.min(p.comprimento / 60, 1) + peloNome("complemento", c) * 2),
  };

  const escolhido = {}, confianca = {}, usadas = new Set();
  for (const campo of ["data", "valor", "documento", "historico", "complemento"]) {
    let melhor = -1, melhorNota = 0, segunda = 0;
    perfis.forEach((p, c) => {
      if (usadas.has(c)) return;
      const n = nota[campo](p, c);
      if (n > melhorNota) { segunda = melhorNota; melhorNota = n; melhor = c; }
      else if (n > segunda) segunda = n;
    });
    const minimo = campo === "documento" ? 0.8 : (campo === "complemento" ? 1.2 : 0.9);
    if (melhor >= 0 && melhorNota >= minimo) {
      escolhido[campo] = melhor; usadas.add(melhor);
      confianca[campo] = Math.max(0, Math.min(1, (melhorNota - segunda) / Math.max(melhorNota, 0.001)));
    }
  }

  // Débito e crédito em colunas separadas: dois números sem sinal, um só
  // com saída e outro só com entrada. Nesse caso não existe "valor único".
  let debito = -1, credito = -1;
  perfis.forEach((p, c) => {
    if (p.vazia || p.pNumero < 0.7) return;
    if (peloNome("debito", c) >= 0.6) debito = c;
    if (peloNome("credito", c) >= 0.6) credito = c;
  });
  if (debito >= 0 && credito >= 0) {
    escolhido.debito = debito; escolhido.credito = credito;
    delete escolhido.valor; confianca.valor = 1;
  }

  // Coluna de saldo, quando existe, fica marcada para ser ignorada.
  let saldo = -1;
  perfis.forEach((p, c) => { if (!p.vazia && peloNome("saldo", c) >= 0.6) saldo = c; });
  if (saldo >= 0 && saldo !== escolhido.valor) escolhido.saldo = saldo;

  return {
    linhaCabecalho: iCab,
    colunas: escolhido,
    confianca,
    cabecalho: iCab >= 0 ? (linhas[iCab] || []).map((c) => String(c == null ? "" : c).trim()) : [],
    perfis,
    // Assinatura do formato: serve para lembrar o mapa deste banco/planilha.
    assinatura: (iCab >= 0 ? (linhas[iCab] || []) : []).map((c) => efSemAcento(c)).join("|"),
    completo: escolhido.data != null && (escolhido.valor != null || escolhido.debito != null),
  };
}

// Com o mapa em mãos, as linhas viram movimentos comparáveis.
function movimentosDaTabela(linhas, mapa) {
  const m = (mapa && mapa.colunas) || {};
  const corpo = linhas.slice((mapa && mapa.linhaCabecalho >= 0 ? mapa.linhaCabecalho : -1) + 1);
  const saida = [];
  corpo.forEach((l, i) => {
    const cel = (c) => (c == null ? "" : String((l || [])[c] == null ? "" : (l || [])[c]).trim());
    const data = cel(m.data);
    let valor = null;
    if (m.valor != null) valor = efValorDeTexto(cel(m.valor));
    else {
      const d = efValorDeTexto(cel(m.debito)), c = efValorDeTexto(cel(m.credito));
      if (d) valor = -Math.abs(d); else if (c) valor = Math.abs(c);
    }
    if (valor == null || !data) return;
    saida.push({
      linha: i + 1,
      data: efData(data) || data,
      valor,
      abs: Math.round(Math.abs(valor) * 100) / 100,
      documento: cel(m.documento),
      historico: [cel(m.historico), cel(m.complemento)].filter(Boolean).join(" · ").replace(/\s+/g, " ").trim(),
    });
  });
  return saida;
}

// ── Conciliação com o extrato do banco ──────────────────────────
// Linhas que não são movimento: saldo do dia, aplicação e resgate,
// e a perna bloqueada do cheque (que volta como liberação no dia seguinte).
const EF_NAO_E_MOVIMENTO = [
  "saldo", "s a l d o", "resgate rdc", "aplicacao", "aplicacao automatica", "resgate automatico",
  "rdc", "dep.cheque bloq", "deposito bloqueado 1d", "credito resgate", "deb fundo", "cdb",
];

// Dinheiro que só troca de bolso: transferência entre contas do próprio
// escritório. Não é receita nem despesa — a fila sugere "não é lançamento"
// (sugere: quem decide é quem fecha).
const EF_ENTRE_CONTAS = ["mesma titularidade", "mesma titular", "entre contas", "transf propria", "transferencia propria",
  "conta propria", "mesmo titular", "ted mesma", "pix mesma"];
function pareceEntreContas(historico) {
  const h = efSemAcento(historico || "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ");
  return EF_ENTRE_CONTAS.some((x) => h.indexOf(x) >= 0);
}

function efEhMovimento(historico) {
  const h = efSemAcento(historico);
  if (!h) return true;
  return !EF_NAO_E_MOVIMENTO.some((x) => h.indexOf(x) === 0);
}

// Casa por valor e pelo lado (entrada com entrada, saída com saída), como a
// planilha sempre fez. A data NÃO entra na regra: no
// fluxo real ela é o dia em que se contabiliza, não o dia do banco, então
// serviria só para casar errado. Com dois movimentos do mesmo valor no mês,
// vale a ordem do extrato — o mais antigo casa primeiro, e o que sobra na
// fila é o mais recente, que é justamente o que falta lançar. A tolerância
// de um centavo existe porque parcela dividida arredonda para lados
// diferentes; a distância de dias é informação na tela, não critério.
function conciliarExtrato(movimentos, lancamentos, opcoes) {
  const o = opcoes || {};
  const tolerancia = o.tolerancia == null ? 0.01 : o.tolerancia;
  const doBanco = (movimentos || []).filter((m) => m && efEhMovimento(m.historico));
  const foraDoBanco = (movimentos || []).filter((m) => m && !efEhMovimento(m.historico));
  // Entrada só casa com entrada, saída só com saída. Sem isto um depósito de
  // R$ 18.000 casava com um pagamento de R$ 18.000 e os dois sumiam da
  // conferência — cada um escondendo a falta do outro. A direção do
  // lançamento vem do grupo da conta (e um valor negativo inverte: é estorno);
  // sem conta classificada ela é desconhecida e casa com qualquer lado.
  const direcaoDoLancamento = (l) => {
    const c = contaEscritorio(l.contaId);
    const g = c && grupoEscritorio(c.grupo);
    const v = Number(l.valor) || 0;
    if (!g || !v) return 0;
    return (g.sinal < 0 ? -1 : 1) * (v < 0 ? -1 : 1);
  };
  const candidatos = (lancamentos || []).filter((l) => !compraNoCartaoDoEscritorio(l)).map((l, i) => ({
    l, i, abs: Math.round(Math.abs(Number(l.valor) || 0) * 100) / 100, usado: false, dir: direcaoDoLancamento(l),
  }));

  const distancia = (m, c) => {
    const d1 = String(m.data || "").slice(0, 10);
    const d2 = String(c.l.lancadoEm || c.l.competencia || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d1) || !/^\d{4}-\d{2}-\d{2}$/.test(d2)) return 9999;
    return Math.abs((new Date(d1) - new Date(d2)) / 86400000);
  };

  const casados = [], noBancoSemPar = [], naoLancar = [];
  const ignorados = o.ignorados || {};
  const emOrdem = doBanco.slice().sort((a, b) => String(a.data).localeCompare(String(b.data)));
  // O lançamento que nasceu de uma linha do extrato carrega o id dela: casa
  // com ELA, antes de qualquer comparação de valor — com dois Pix de R$ 60
  // no mês, o que foi lançado é o que sai da fila, não o primeiro que aparece.
  const jaCasados = new Set();
  for (const m of emOrdem) {
    if (!m.id) continue;
    const c = candidatos.find((x) => !x.usado && x.l.extratoId && x.l.extratoId === m.id);
    if (!c) continue;
    c.usado = true; jaCasados.add(m);
    casados.push({ extrato: m, lancamento: c.l, dias: distancia(m, c) === 9999 ? null : distancia(m, c),
      centavos: Math.round((c.abs - m.abs) * 100), ambiguo: false });
  }
  for (const m of emOrdem) {
    if (jaCasados.has(m)) continue;
    // "Não é lançamento" (transferência entre contas suas, estorno que se
    // anula): sai da fila sem virar lançamento, com o motivo guardado.
    if (m.id && ignorados[m.id]) { naoLancar.push({ ...m, motivo: ignorados[m.id].motivo || "" }); continue; }
    const dirM = Number(m.valor) < 0 ? -1 : (Number(m.valor) > 0 ? 1 : 0);
    const iguais = candidatos.filter((c) => !c.usado && Math.abs(c.abs - m.abs) <= tolerancia
      && (!c.dir || !dirM || c.dir === dirM));
    if (!iguais.length) { noBancoSemPar.push(m); continue; }
    const escolhido = iguais[0];
    escolhido.usado = true;
    casados.push({
      extrato: m, lancamento: escolhido.l,
      dias: distancia(m, escolhido) === 9999 ? null : distancia(m, escolhido),
      centavos: Math.round((escolhido.abs - m.abs) * 100),
      ambiguo: iguais.length > 1,
    });
  }
  const contabilizadoSemPar = candidatos.filter((c) => !c.usado).map((c) => c.l);
  const soma = (lista, f) => Math.round(lista.reduce((s, x) => s + Math.abs(Number(f(x)) || 0), 0) * 100) / 100;
  return {
    casados, noBancoSemPar, contabilizadoSemPar, foraDoBanco, naoLancar,
    resumo: {
      movimentos: doBanco.length,
      lancamentos: candidatos.length,
      casados: casados.length,
      noBanco: noBancoSemPar.length,
      contabilizado: contabilizadoSemPar.length,
      valorNoBanco: soma(noBancoSemPar, (m) => m.valor),
      valorContabilizado: soma(contabilizadoSemPar, (l) => l.valor),
      ignoradas: foraDoBanco.length,
      naoLancar: naoLancar.length,
    },
  };
}

// ── A fila do extrato ───────────────────────────────────────────
// Cada linha do banco ganha um id estável (data, valor, histórico,
// documento e a ordem entre iguais): é ele que guarda o "não é lançamento",
// liga o lançamento à linha de onde nasceu e deixa o extrato salvo de um
// dia para o outro sem duplicar quando o arquivo é arrastado de novo.
function comIdsDosMovimentos(movimentos) {
  const vistos = {};
  return (movimentos || []).filter(Boolean).map((m) => {
    const base = [String(m.data || "").slice(0, 10), (Number(m.valor) || 0).toFixed(2),
      efSemAcento(m.historico || "").replace(/\s+/g, " ").slice(0, 60), String(m.documento || "").trim()].join("|");
    vistos[base] = (vistos[base] || 0) + 1;
    return { ...m, id: base + "#" + vistos[base] };
  });
}

// O que vale guardar de cada linha: o resto se refaz.
function extratoParaGuardar(movimentos) {
  return comIdsDosMovimentos(movimentos).map((m) => ({
    id: m.id, data: m.data, valor: m.valor, abs: Math.round(Math.abs(Number(m.valor) || 0) * 100) / 100,
    historico: m.historico || "", documento: m.documento || "",
  }));
}

// O extrato guardado é por MÊS DO MOVIMENTO, não pelo mês que estava na
// tela quando o arquivo chegou: o extrato de setembro arrastado com outubro
// aberto continua sendo de setembro. Um arquivo novo substitui, nos meses
// que ele cobre, tudo o que estava guardado desses meses — onde quer que
// estivesse — e não mexe nos outros meses. O "não é lançamento" fica.
function mesDoMovimento(m) { return String((m && m.data) || "").slice(0, 7); }
function extratosComArquivo(extratos, movimentos, origem, agora) {
  const atuais = (extratos && typeof extratos === "object") ? extratos : {};
  const doArquivo = extratoParaGuardar(movimentos || []);
  const meses = [...new Set(doArquivo.map(mesDoMovimento).filter((x) => /^\d{4}-\d{2}$/.test(x)))];
  const novos = {};
  for (const [k, v] of Object.entries(atuais)) {
    const sobra = ((v && v.movimentos) || []).filter((m) => meses.indexOf(mesDoMovimento(m)) < 0);
    novos[k] = { ...v, movimentos: sobra };
  }
  for (const mes of meses) {
    novos[mes] = { ...(novos[mes] || {}), origem: origem || "", atualizadoEm: agora || new Date().toISOString(),
      movimentos: doArquivo.filter((m) => mesDoMovimento(m) === mes), ignorados: ((novos[mes] || {}).ignorados) || {} };
  }
  return { extratos: novos, meses };
}
// As linhas do mês, de onde estiverem guardadas (sem repetir).
function movimentosGuardadosDoMes(extratos, mes) {
  const vistos = new Set();
  const saida = [];
  for (const v of Object.values(extratos || {})) {
    for (const m of (v && v.movimentos) || []) {
      if (!m || mesDoMovimento(m) !== String(mes) || vistos.has(m.id)) continue;
      vistos.add(m.id); saida.push(m);
    }
  }
  return saida.sort((a, b) => String(a.data).localeCompare(String(b.data)));
}
function ignoradosGuardados(extratos) {
  const r = {};
  for (const v of Object.values(extratos || {})) Object.assign(r, (v && v.ignorados) || {});
  return r;
}
// Marca ou desmarca uma linha como "não é lançamento", sem duplicar a marca.
function extratosComIgnorado(extratos, mes, id, motivo, agora) {
  const novos = { ...(extratos || {}) };
  let tirou = false;
  for (const [k, v] of Object.entries(novos)) {
    if (v && v.ignorados && v.ignorados[id]) {
      const ig = { ...v.ignorados }; delete ig[id];
      novos[k] = { ...v, ignorados: ig }; tirou = true;
    }
  }
  if (tirou) return novos;
  const doMes = novos[mes] || { movimentos: [] };
  novos[mes] = { ...doMes, ignorados: { ...(doMes.ignorados || {}), [id]: { motivo: motivo || "não é lançamento", em: agora || new Date().toISOString() } } };
  return novos;
}

// O saldo do banco no fim do mês, lido do próprio extrato: a última linha
// "SALDO" do mês. Poupa digitar o número que o arquivo já traz.
function saldoDoExtratoNoMes(movimentos, mes) {
  const doMes = (movimentos || []).filter((m) => m && String(m.data || "").slice(0, 7) === String(mes)
    && /^s\s*a\s*l\s*d\s*o/.test(efSemAcento(m.historico || "")) && Number.isFinite(Number(m.valor)));
  if (!doMes.length) return null;
  const ultimo = doMes.slice().sort((a, b) => String(a.data).localeCompare(String(b.data)) || (a.linha || 0) - (b.linha || 0)).pop();
  return Math.round((Number(ultimo.valor) || 0) * 100) / 100;
}

// A "assinatura" de quem recebeu ou pagou, para reconhecer a mesma linha no
// mês seguinte: o CPF/CNPJ (mesmo mascarado, ***.144.048-**) e as palavras
// do histórico sem números, datas e o jargão do banco.
function documentoDoHistorico(historico) {
  const h = String(historico || "");
  const cnpj = /(\d{2}\.?\d{3}\.?\d{3}[\s/]?\d{4}-?\d{2})/.exec(h);
  if (cnpj) return cnpj[1].replace(/\D/g, "");
  const cpf = /\*{3}\.?(\d{3})\.?(\d{3})-?\*{2}/.exec(h) || /(\d{3})\.(\d{3})\.(\d{3})-(\d{2})/.exec(h);
  return cpf ? cpf.slice(1).join("") : "";
}

const EF_PALAVRAS_DO_BANCO = new Set(["pix", "emitido", "recebido", "outra", "if", "mesma", "pagamento", "transferencia",
  "ted", "doc", "deb", "debito", "cred", "credito", "conv", "tit", "compe", "nome", "cpf", "cnpj", "ag", "conta"]);
function chaveDoHistorico(historico) {
  return efSemAcento(historico || "").replace(/[^a-z\s]/g, " ").split(/\s+/)
    .filter((w) => w.length > 1 && !EF_PALAVRAS_DO_BANCO.has(w)).join(" ").trim();
}

// O que já se lançou de uma linha igual vira a sugestão desta: a conta, a
// unidade, o cliente/obra e o fornecedor do último lançamento com o mesmo
// CPF/CNPJ no histórico — ou, sem documento, com o mesmo histórico.
function sugestaoDoExtrato(movimento, lancamentos) {
  const m = movimento || {};
  const doc = documentoDoHistorico(m.historico);
  const chave = chaveDoHistorico(m.historico);
  const lado = Number(m.valor) < 0 ? -1 : 1;
  const quando = (l) => String(l.criadoEm || l.lancadoEm || "");
  const lista = (lancamentos || []).filter((l) => l && l.historicoBanco && l.contaId)
    .slice().sort((a, b) => quando(b).localeCompare(quando(a)));
  const ladoDe = (l) => {
    const c = contaEscritorio(l.contaId); const g = c && grupoEscritorio(c.grupo);
    return g ? (g.sinal < 0 ? -1 : 1) * ((Number(l.valor) || 0) < 0 ? -1 : 1) : 0;
  };
  const mesmoLado = (l) => !ladoDe(l) || ladoDe(l) === lado;
  const achado = (doc && lista.find((l) => mesmoLado(l) && documentoDoHistorico(l.historicoBanco) === doc))
    || (chave && lista.find((l) => mesmoLado(l) && chaveDoHistorico(l.historicoBanco) === chave))
    || null;
  if (!achado) return null;
  const campos = ["contaId", "unidadeId", "cliente", "clienteId", "empreendimentoId", "projeto", "obraId", "fornecedor", "fornecedorId"];
  const r = {};
  for (const k of campos) if (achado[k] != null && achado[k] !== "") r[k] = achado[k];
  // O que veio de uma obra (pela ponte) se relança pela obra: a sugestão
  // abre o formulário, nunca vira lançamento direto no plano do escritório.
  return { campos: r, de: achado, porDocumento: !!doc && documentoDoHistorico(achado.historicoBanco) === doc,
    daObra: !!achado.origem };
}

// O formulário de uma linha do banco, como ele abre na fila: data e valor do
// banco, competência = o mês que está sendo fechado, e o que a última linha
// igual ensinou. A data em que entrou no sistema é carimbada ao gravar.
function lancamentoDaLinhaDoExtrato(movimento, mes, sugestao) {
  const m = movimento || {};
  const base = lancamentoDoExtrato(m);
  return {
    ...base,
    competencia: /^\d{4}-\d{2}$/.test(String(mes)) ? String(mes) : base.competencia,
    valor: String(Math.abs(Number(m.valor) || 0).toFixed(2)).replace(".", ","),
    // o lado do banco (entrou ou saiu): é ele que diz se a conta escolhida
    // recebe um lançamento comum ou um estorno
    sinalDoBanco: Number(m.valor) < 0 ? -1 : 1,
    extratoId: m.id || "",
    historicoBanco: m.historico || "",
    // "Pix", "TED", "Tarifa" na coluna do documento do banco não é número de
    // papel: o campo é da nota ou do boleto.
    documento: /\d/.test(String(m.documento || "")) ? String(m.documento) : "",
    cliente: "", projeto: "", fornecedor: "", observacao: "",
    ...((sugestao && sugestao.campos) || {}),
    unidadeId: ((sugestao && sugestao.campos) || {}).unidadeId || "escritorio",
  };
}

// ── Estorno ─────────────────────────────────────────────────────
// Dinheiro que SAI do banco numa conta de entrada — a receita de gestão
// devolvida ao cliente — não é despesa nova nem receita: é estorno. Entra na
// própria conta com valor negativo, no mês em que o dinheiro voltou; o mês
// em que a receita entrou (já fechado) não muda. O mesmo vale ao contrário:
// entrada numa conta de despesa (a loja devolveu) abate a despesa.
function ehEstornoNaConta(contaId, sinalDoBanco) {
  const c = contaEscritorio(contaId);
  const g = c && grupoEscritorio(c.grupo);
  if (!g || !sinalDoBanco) return false;
  return (g.sinal < 0 ? -1 : 1) !== (Number(sinalDoBanco) < 0 ? -1 : 1);
}

function comSinalDeEstorno(l) {
  if (!l) return l;
  const { sinalDoBanco, ...resto } = l;
  const v = Math.round(Math.abs(efValorDoCampo(l.valor)) * 100) / 100;
  if (!ehEstornoNaConta(l.contaId, sinalDoBanco)) return { ...resto, valor: v };
  return { ...resto, valor: -v, estorno: true };
}

// Um clique: a linha igual à do mês passado vai com a mesma classificação,
// sem abrir o formulário. Só quando a sugestão basta — conta do escritório,
// cliente/obra que a conta pede, mês aberto. Senão, devolve o porquê e a
// tela abre o formulário.
function lancamentoRapidoDoExtrato(movimento, mes, sugestao, fechamentos) {
  if (!sugestao || !sugestao.campos || !sugestao.campos.contaId) return { erro: "Sem lançamento igual para copiar." };
  if (sugestao.daObra) return { erro: "Custo de obra: confira no formulário." };
  if (ehReceitaDaGestao(sugestao.campos)) return { erro: "Receita da gestão: escolha a parcela do contrato no formulário." };
  const base = lancamentoDaLinhaDoExtrato(movimento, mes, sugestao);
  const l = comSinalDeEstorno({ ...base, valor: Math.round(Math.abs(Number((movimento || {}).valor) || 0) * 100) / 100 });
  const ehEmp = l.unidadeId === "empreendimento";
  const erros = validarLancamentoEscritorio({ ...l, clienteId: l.clienteId || l.cliente,
    obraId: l.unidadeId === "gestao_obras" ? l.obraId : l.projeto,
    empreendimentoId: ehEmp ? l.empreendimentoId : l.projeto }, { fechamentos });
  return erros.length ? { erro: erros[0] } : { lancamento: l };
}

function lancamentoDoExtrato(movimento, extra) {
  const m = movimento || {};
  return {
    tipo: "escritorio",
    contaId: (extra || {}).contaId || null,
    unidadeId: (extra || {}).unidadeId || null,
    valor: Math.round(Math.abs(Number(m.valor) || 0) * 100) / 100,
    competencia: String(m.data || "").slice(0, 7),
    lancadoEm: String(m.data || "").slice(0, 10),
    descricao: (m.historico || "").slice(0, 120),
    documento: m.documento || "",
    contaBanco: "sim",
    conferido: true,
    conferidoEm: new Date().toISOString(),
    doExtrato: true,
  };
}

// O mapa de colunas de cada banco/planilha fica guardado por assinatura:
// da segunda vez o arquivo já entra reconhecido.
function layoutsDoEscritorio(data) {
  const l = (((data || {}).escritorio || {}).financeiro || {}).layouts;
  return (l && typeof l === "object") ? l : {};
}

function layoutSalvo(layouts, assinatura) {
  if (!assinatura) return null;
  const g = (layouts || {})[assinatura];
  return g && g.colunas ? g : null;
}


// ── Empreendimentos ─────────────────────────────────────────────
// Empreendimento é um cliente com um tique no cadastro: tem obra, contas e
// P&L como qualquer outro, mas o dinheiro dele não forma o resultado do mês
// — fica investido no imóvel até a venda.
function ehEmpreendimento(cliente) {
  return !!(cliente && cliente.servicos && cliente.servicos.empreendimento);
}

// Os cartões que pagam uma obra. Obra do escritório (empreendimento) usa os
// cartões do escritório. Obra de cliente NUNCA usa cartão do escritório: o
// cliente paga com o dele, cadastrado na própria obra (`obra.cartoes`). A
// compra no cartão do cliente não atravessa para o escritório nem entra em
// fatura do escritório — a fatura é do cliente.
function obraEhDoEscritorio(data, obra) {
  const d = data || {};
  const cli = obra ? (d.clientes || []).find((c) => c && c.id === obra.clienteId) : null;
  return ehEmpreendimento(cli);
}

function cartoesDaObra(data, obra) {
  if (!obra) return [];
  if (obraEhDoEscritorio(data, obra)) return ((data || {}).escritorio || {}).cartoes || [];
  return (obra.cartoes || []).filter((c) => c && c.ativo !== false);
}

// O cartão do cliente nasce na própria baixa: nome e os dois dias que
// decidem a fatura. Marcado `doCliente` para nunca ser confundido com um
// cartão do escritório.
function validarCartaoDoCliente(campos) {
  const c = campos || {};
  if (!String(c.nome || "").trim()) return "Dê um nome ao cartão do cliente (ex.: Nubank do João).";
  const f = Number(c.diaFechamento), v = Number(c.diaVencimento);
  if (!(f >= 1 && f <= 31)) return "O dia de fechamento do cartão vai de 1 a 31.";
  if (!(v >= 1 && v <= 31)) return "O dia de vencimento do cartão vai de 1 a 31.";
  return "";
}

function cartaoDoClienteNovo(campos, novoId) {
  const c = campos || {};
  return {
    id: typeof novoId === "function" ? novoId() : (typeof uid === "function" ? uid() : String(Date.now())),
    nome: String(c.nome || "").trim(),
    bandeira: String(c.bandeira || "").trim(),
    diaFechamento: Number(c.diaFechamento) || 1,
    diaVencimento: Number(c.diaVencimento) || 10,
    ativo: true,
    doCliente: true,
  };
}

function empreendimentosDoData(data) {
  return ((data || {}).clientes || []).filter(ehEmpreendimento);
}

function nomeDoEmpreendimento(data, id) {
  const c = ((data || {}).clientes || []).find((x) => x && x.id === id);
  return c ? c.nome : "";
}

// O valor digitado em português. "5.000,00" com Number() direto dá NaN — o
// ponto do milhar vira ponto decimal e a vírgula sobra, e o formulário
// respondia "Informe o valor" com o valor ali na tela. Quem lê certo é o
// campo numérico do contrato, e é dele que este formulário passa a viver.
function efValorDoCampo(v) {
  if (typeof numeroDeCampo === "function") return numeroDeCampo(v) || 0;
  const s = String(v == null ? "" : v).trim();
  const limpo = s.indexOf(",") >= 0 ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = parseFloat(limpo);
  return Number.isFinite(n) ? n : 0;
}

// ── O custo da obra, item a item ────────────────────────────────
// A conta a pagar sempre foi POR ITEM — é dela que saem o custo por etapa e
// a abertura por subconta. O que faltava era a tela de contabilização falar
// essa língua: ela criava uma conta com um valor seco, e o gasto entrava na
// obra sem etapa nenhuma.
//
// Quem manda no total é a linha do extrato: foi aquele dinheiro que saiu do
// banco. Os itens somam o preço de tabela; a diferença entre a soma e o que
// saiu é desconto, e se espalha proporcionalmente — é o mesmo
// `itensRateados` que o pedido da loja usa, não uma segunda regra.
//
// Soma MENOR que o pago não é desconto: é item faltando. Aceitar isso seria
// inventar um custo que o papel não tem.
// O preço de tabela de um item: o subtotal que o papel trouxe, ou
// quantidade × unitário. Delega ao `brutoDoItem` do pedido da loja quando
// ele está por perto — que é sempre, no app montado; a conta local existe
// para o teste deste módulo, que roda sozinho.
function efBrutoDoItem(i) {
  if (typeof brutoDoItem === "function") return brutoDoItem(i);
  const it = i || {};
  const sub = efValorDoCampo(it.bruto);
  if (sub > 0) return sub;
  return Math.round(efValorDoCampo(it.quantidade) * efValorDoCampo(it.unitario) * 100) / 100;
}

// Pagamento de uma coisa só — o empreiteiro, a diária, o frete — não é
// soma de itens: é um valor, numa etapa. Vira o único item do custo, igual
// a um item digitado, sem pedir que alguém o digite. A compra de vários
// itens continua item a item.
function itemUnicoDoCusto(valor, etapa, contaId, descricao, grupoMaterial) {
  const v = Math.round((Number(valor) || 0) * 100) / 100;
  return { descricao: String(descricao || "").trim(), insumoCodigo: "", grupoMaterial: grupoMaterial || "",
    quantidade: 1, unidade: "vb", unitario: v, bruto: v, etapa: etapa || "", contaId: contaId || "" };
}
function itensDoCustoOuUnico(itens, valor, etapa, contaId, descricao, grupoMaterial) {
  if ((itens || []).some((i) => i && efBrutoDoItem(i) > 0)) return itens;
  return Number(valor) > 0 ? [itemUnicoDoCusto(valor, etapa, contaId, descricao, grupoMaterial)] : [];
}

// A conta de mão de obra já diz onde o custo entra. Na base do escritório,
// empreiteiro, pedreiro, ajudante… vão para a etapa "Prestadores de
// serviços", grupo "Prestadores de serviços" — é o mesmo vínculo que o
// catálogo faz pelo grupo do insumo. Vem preenchido; dá para trocar.
const EF_PADRAO_MAO_DE_OBRA = { etapa: "prestadores", grupoMaterial: "Prestadores de serviços" };
function padraoDaContaDaObra(contaId, plano) {
  const lista = plano || (typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : []);
  const c = lista.find((x) => x && x.id === contaId);
  return c && c.grupo === "maoDeObra" ? { ...EF_PADRAO_MAO_DE_OBRA } : { etapa: "", grupoMaterial: "" };
}

function custoDoLancamento(valorPago, itens) {
  const red = (x) => Math.round(x * 100) / 100;
  const comValor = (itens || []).filter((i) => i && efBrutoDoItem(i) > 0);
  const bruto = red(comValor.reduce((s, i) => s + efBrutoDoItem(i), 0));
  const pago = red(Number(valorPago) || 0);
  const desconto = red(Math.max(0, bruto - pago));
  const falta = red(Math.max(0, pago - bruto));
  return {
    itens: comValor.length, bruto: bruto, pago: pago,
    desconto: desconto, falta: falta,
    // Centavo de arredondamento não é buraco: a tolerância é a mesma do
    // pedido da loja, meio centavo.
    fecha: Math.abs(bruto - pago) < 0.005,
  };
}

// O que falta para o custo poder ser gravado. A etapa é erro e não aviso —
// é o que impede a linha "Sem etapa" de crescer no quadro da obra.
function validarCustoEmItens(valorPago, itens, obraId) {
  const erros = [];
  const r = custoDoLancamento(valorPago, itens);
  if (!obraId) erros.push("Escolha a obra que recebe o custo.");
  if (!r.itens) erros.push("Lance pelo menos um item com quantidade e preço.");
  const semEtapa = (itens || []).filter((i) => i && efBrutoDoItem(i) > 0 && !String(i.etapa || "").trim()).length;
  if (semEtapa) erros.push(semEtapa === 1 ? "1 item está sem etapa." : semEtapa + " itens estão sem etapa.");
  if (!(r.pago > 0)) erros.push("Informe o valor pago.");
  else if (r.falta >= 0.005) {
    erros.push("A soma dos itens é menor que o valor pago — falta item, e o que falta não pode virar desconto.");
  }
  return { ok: !erros.length, erros: erros, resumo: r };
}

// ── Fornecedor: nem todo papel tem um nome que importe ──────────
// Tarifa bancária, estacionamento, a compra de R$ 12 na loja da esquina —
// identificar o fornecedor aí não paga o trabalho de cadastrá-lo. Quem não
// for escolhido entra como "Outros", que é um nome de verdade no relatório:
// some a linha em branco, e a soma de "Outros" diz quanto foi o miúdo.
const EF_FORNECEDOR_OUTROS = "Outros";
// Valor que o seletor usa para dizer "é Outros mesmo", distinto de "ainda
// não mexi no campo" — são a mesma coisa no fim, mas não na tela.
const EF_OPCAO_OUTROS = "__outros";
// O próprio escritório como fornecedor: na receita (e no estorno dela) quem
// presta o serviço é o escritório — não um cadastro de fornecedor.
const EF_OPCAO_ESCRITORIO = "__escritorio";

// Conta de receita do escritório pede o próprio escritório como fornecedor.
function fornecedorPadraoDaConta(contaId, nomeEscritorio) {
  const c = contaEscritorio(contaId);
  return c && c.grupo === "receitas" && nomeEscritorio ? nomeEscritorio : "";
}

function efNomeDoFornecedor(l) {
  return String((l || {}).fornecedor || "").trim() || EF_FORNECEDOR_OUTROS;
}

// ── Os papéis da transação ──────────────────────────────────────
// Nota fiscal, comprovante, boleto: numa lista só. O campo único de
// `comprovante` veio antes e continua valendo — ele é lido como o primeiro
// anexo, e o que já foi gravado não precisa ser remexido para aparecer.
function anexosDaTransacao(x) {
  const t = x || {};
  const lista = Array.isArray(t.anexos) ? t.anexos.filter(Boolean) : [];
  if (!t.comprovante) return lista;
  const jaEsta = lista.some((a) => a && (a.public_id || a.url) &&
    (a.public_id === t.comprovante.public_id || a.url === t.comprovante.url));
  return jaEsta ? lista : [t.comprovante].concat(lista);
}

// O nome que a pessoa reconhece: "Nota fiscal", "Comprovante". O tipo vem
// de quem anexou (a Entrada sabe se leu uma nota ou um comprovante); sem
// ele, o primeiro papel de uma conta paga é o comprovante.
function rotuloDoAnexo(a, i) {
  const tipo = (a || {}).tipo || "";
  if (tipo === "nota") return "Nota fiscal";
  if (tipo === "comprovante") return "Comprovante";
  if (tipo === "boleto") return "Boleto";
  if (tipo === "pedido") return "Pedido";
  if (tipo === "entrega") return "Entregue";
  if (tipo === "proposta") return "Proposta";
  return i === 0 ? "Comprovante" : "Anexo";
}

function comAnexos(x, lista) {
  // Guardar os dois seria pedir para divergirem: quem passa a mexer na lista
  // leva o comprovante antigo para dentro dela e o campo velho sai de cena.
  const novo = Object.assign({}, x || {}, { anexos: (lista || []).filter(Boolean) });
  delete novo.comprovante;
  return novo;
}

// ── De qual plano é a conta do lançamento ───────────────────────
// Dois planos convivem nesta tela, e é de propósito. Uma compra para a obra
// de um cliente, ou para um empreendimento do escritório, é custo DAQUELA
// obra: ela nasce lá, com o nome que a obra usa (Material, Mão de obra), e
// chega ao extrato do escritório pela ponte, já traduzida. O que é do
// escritório — ou do empreendimento mas de obra nenhuma, como corretagem e
// registro em cartório — entra direto no extrato, pelo plano do escritório.
//
// Antes disto o seletor oferecia só o plano do escritório, em qualquer
// unidade: escolhendo Empreendimento apareciam as contas de gestão, que ali
// não valem, e "Material" não aparecia em lugar nenhum.

// Unidade que fala de uma obra de cliente ou de um empreendimento.
function unidadePedeObra(unidadeId) {
  const u = UNIDADES_NEGOCIO.find((x) => x && x.id === unidadeId);
  return !!u && (!!u.exigeObra || !!u.exigeEmpreendimento);
}

// Os grupos do plano da obra que são custo. "excluidas" e as receitas ficam
// de fora: receita de obra tem porta própria, não se lança pelo extrato.
const EF_GRUPOS_CUSTO_OBRA = ["terreno", "materiais", "maoDeObra", "servicos"];

// O id vem prefixado porque os dois planos têm ids iguais — "cartao_credito"
// existe nos dois — e sem o prefixo o seletor não saberia de qual falava.
function valorDaConta(contaId, fonte) {
  return (fonte === "obra" ? "o:" : "e:") + String(contaId == null ? "" : contaId);
}

function contaEscolhida(valor) {
  const s = String(valor == null ? "" : valor);
  if (s.indexOf("o:") === 0) return { fonte: "obra", id: s.slice(2) };
  if (s.indexOf("e:") === 0) return { fonte: "escritorio", id: s.slice(2) };
  // lançamento antigo gravou o id puro, e ele é sempre do escritório
  return { fonte: s ? "escritorio" : "", id: s };
}

function contasDoLancamento(unidadeId, opcoes) {
  const escritorio = PLANO_CONTAS_ESCRITORIO
    .filter((c) => c && (!(c.unidades || []).length || c.unidades.indexOf(unidadeId) >= 0))
    .map((c) => ({ valor: valorDaConta(c.id, "escritorio"), id: c.id, nome: c.nome, grupo: c.grupo, fonte: "escritorio" }));
  if (!unidadePedeObra(unidadeId)) return { obra: [], escritorio: escritorio };
  const obra = pontePlanoDaObra(opcoes)
    .filter((c) => c && EF_GRUPOS_CUSTO_OBRA.indexOf(c.grupo) >= 0)
    .map((c) => ({ valor: valorDaConta(c.id, "obra"), id: c.id, nome: c.nome, grupo: c.grupo, fonte: "obra" }));
  return { obra: obra, escritorio: escritorio };
}

// As obras entre as quais o custo pode cair.
function obrasDoLancamento(data, clienteId) {
  if (!clienteId) return [];
  return (((data || {}).obras) || []).filter((o) => o && o.clienteId === clienteId);
}

// O que falta para lançar um custo na obra. É outra prova que a do
// escritório: aqui a conta é do plano da obra, e a obra é obrigatória —
// custo sem obra não tem onde morar.
function validarLancamentoNaObra(l, opcoes) {
  const erros = [];
  const lan = l || {};
  const conta = pontePlanoDaObra(opcoes).find((c) => c && c.id === lan.contaId);
  if (!conta) erros.push("Escolha a conta.");
  if (!lan.clienteId) erros.push("Informe o cliente ou o empreendimento.");
  if (!lan.obraIdAlvo) erros.push("Escolha a obra que recebe o custo.");
  const valor = Number(lan.valor);
  if (!Number.isFinite(valor) || !(valor > 0)) erros.push("Informe o valor.");
  if (!lan.lancadoEm) erros.push("Informe a data do pagamento.");
  else {
    const trava = bloqueioPorMesFechado(String(lan.lancadoEm).slice(0, 7), (opcoes || {}).fechamentos);
    if (trava) erros.push(trava);
  }
  return erros;
}

// Para onde o custo da obra vai aparecer no extrato do escritório. Serve de
// aviso na tela: quem lança "Material" num empreendimento precisa saber que
// do outro lado isso se chama "Construção", senão vai procurá-lo pelo nome
// errado no fechamento.
function destinoVisivelDoCusto(contaId, obra, cliente, opcoes) {
  if (!contaId || !obra) return null;
  const modo = modoDaPonte(obra, cliente);
  const destino = destinoNoEscritorio(contaId, modo, opcoes);
  if (!destino) return { modo: modo, conta: null };
  const c = contaEscritorio(destino);
  return { modo: modo, conta: c ? c.nome : "" };
}

// ── Por onde o dinheiro passou: regra, não pergunta ──────────────
// Escritório, Projetos e Empreendimento: quem paga é sempre o escritório —
// passa pela conta dele. Gestão de obras: só a remuneração da gestão (as
// receitas do escritório) passa pela conta; o resto da obra depende do
// cadastro dela — cliente que paga os fornecedores direto não passa pela
// conta do escritório.
function contaBancoPelaRegra(unidadeId, contaId, obra) {
  if (unidadeId !== "gestao_obras") return "sim";
  const c = contaEscritorio(contaId);
  const g = c && grupoEscritorio(c.grupo);
  if (g && g.bloco === "escritorio") return "sim";
  return obra && obra.clientePagaDireto ? "nao" : "sim";
}

// As obras que a gestão pode escolher: as do cliente quando ele já foi
// escolhido; senão todas as de clientes (empreendimento tem unidade própria).
function obrasDaGestao(obras, clientes, clienteId) {
  const emp = new Set((clientes || []).filter((c) => c && ehEmpreendimento(c)).map((c) => c.id));
  return (obras || []).filter((o) => o && o.id && !emp.has(o.clienteId) && (!clienteId || o.clienteId === clienteId));
}

// ══════════════════════════════════════════════════════════════
// RECEITA DA GESTÃO = SALDO DO MÊS NO CONTRATO DE GESTÃO DA OBRA
// ══════════════════════════════════════════════════════════════
// O honorário da gestão nasce na obra: o contrato de gestão vira parcelas
// em contas a pagar (conta "Gerenciamento de obra"), uma por mês. O que
// entra e sai no banco do escritório — o recebimento e o estorno — entra
// no MÊS em que é lançado, na parcela daquele mês: o que já foi pago num
// mês anterior fica onde está.
//
// Cada mês faz o seu saldo: o que entrou menos o que foi devolvido, contra
// o valor da parcela. A diferença, para mais ou para menos, vai para a
// parcela do mês seguinte, com um comentário curto dizendo de onde veio.
// O total do contrato não muda — só a distribuição entre as parcelas.
//
// A parcela guarda os seus `movimentos` ({ lancamentoId, em, valor }); o
// pagamento feito na própria obra, sem movimento, conta como um só. O
// contrato guarda o acerto de cada parcela em `ajustesSaldo` (e a frase em
// `notasSaldo`), para a parcela em aberto não voltar ao valor da regra
// quando as contas são regeradas.
const EF_CONTA_GESTAO_NA_OBRA = "taxa_admin_obra";
const EF_MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function ehReceitaDaGestao(l) {
  return !!l && l.unidadeId === "gestao_obras" && l.contaId === "rec_gestao";
}

function efCent(v) { return Math.round((Number(v) || 0) * 100) / 100; }

// O dia de hoje no fuso de quem usa (o ISO em UTC já vira o dia seguinte
// às 21h no Brasil). Com uma data dada, é ela.
function efDiaLocal(agoraIso) {
  if (agoraIso) return String(agoraIso).slice(0, 10);
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function efMesCurto(iso) {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso || ""));
  return m ? `${EF_MESES_CURTOS[Number(m[2]) - 1]}/${m[1].slice(2)}` : "";
}

function efMoedaCurta(v) {
  return "R$ " + Math.abs(efCent(v)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Versão antiga da ligação (o estorno reabria a parcela): a referência
// ganhava "#n" a cada estorno. Continua valendo para o que já foi gravado.
function refDaParcela(c) {
  const n = ((c && c.estornos) || []).length;
  return n ? `${c.id}#${n}` : ((c && c.id) || "");
}

function ehLigacaoDaGestao(origem) {
  const o = origem || {};
  return !!o.obraId && (o.tipo === "gestao" || o.tipo === "estorno"
    || (o.tipo === "conta" && o.contaObra === EF_CONTA_GESTAO_NA_OBRA));
}

// As parcelas de gestão da obra, por contrato, na ordem do vencimento.
function contasDaGestao(obra, contratoId) {
  return ((obra && obra.contasPagar) || [])
    .filter((c) => c && c.contaId === EF_CONTA_GESTAO_NA_OBRA
      && (contratoId === undefined || (c.contratoId || "") === (contratoId || "")))
    .slice()
    .sort((a, b) => String(a.vencimento || "").localeCompare(String(b.vencimento || ""))
      || (Number(a.parcela) || 0) - (Number(b.parcela) || 0));
}

// A parcela do mês: a que vence nele; sem nenhuma, a próxima; depois da
// última, a última.
function parcelaDoMesNaGestao(obra, competencia) {
  const comp = String(competencia || "").slice(0, 7);
  const todas = contasDaGestao(obra);
  if (!todas.length || !comp) return null;
  const mes = (c) => String(c.vencimento || "").slice(0, 7);
  return todas.find((c) => mes(c) === comp) || todas.find((c) => mes(c) > comp) || todas[todas.length - 1];
}

// Os movimentos do mês da parcela. O pagamento feito na obra, sem
// movimento guardado, é um movimento só.
function movimentosDaParcela(c) {
  if (c && Array.isArray(c.movimentos)) return c.movimentos;
  if (c && c.pago) return [{ em: c.pagoEm || "", valor: efCent(Number(c.valorPago) || Number(c.valor)), naObra: true }];
  return [];
}

// A parcela que o lançamento movimentou.
function parcelaDoLancamento(obra, l) {
  const o = (l && l.origem) || {};
  if (!obra || !o.obraId || o.obraId !== obra.id) return null;
  const contas = (obra.contasPagar || []).filter(Boolean);
  if (o.tipo === "gestao") return contas.find((c) => c.id === o.refId) || null;
  if (o.tipo === "estorno") return contas.find((c) => c.id === o.parcelaId) || null;
  if (o.tipo === "conta" && o.contaObra === EF_CONTA_GESTAO_NA_OBRA) {
    return contas.find((c) => refDaParcela(c) === o.refId) || null;
  }
  return null;
}

function efAto(conta, ato, quem, agora, detalhe) {
  return typeof registrarAto === "function" ? registrarAto(conta, ato, quem, agora, detalhe) : conta;
}
function efParcelaEmAberto(c, quem, agora) {
  if (typeof contaEmAberto === "function") return contaEmAberto(c, quem, agora);
  const { formaPagamento, cartaoId, parcelasCartao, ...r } = c;
  return { ...r, pago: false, pagoEm: "", valorPago: "", contabilizadoEm: "" };
}

// Refaz o saldo, mês a mês, de um contrato de gestão da obra: cada parcela
// paga fecha no que entrou no mês dela, e a diferença para o valor
// devido vai para a seguinte. Determinístico: pode rodar quantas vezes
// for, depois de incluir, mudar ou tirar um movimento.
function recalibrarGestao(obra, contratoId, quem, agoraIso) {
  const ob = obra || {};
  const agora = agoraIso || new Date().toISOString();
  const ct = ((ob.contratos || []).find((x) => x && x.id === contratoId)) || null;
  const saldoAntes = (ct && ct.ajustesSaldo) || {};
  const lista = contasDaGestao(ob, contratoId);
  if (!lista.length) return ob;
  const novas = {}, ajustes = {}, notas = {};
  let leva = 0, levaDe = "";
  lista.forEach((c, i) => {
    const base = efCent((Number(c.valor) || 0) - (Number(saldoAntes[c.id]) || 0));
    const devido = efCent(base + leva);
    const movs = movimentosDaParcela(c);
    const soma = efCent(movs.reduce((t, m) => t + (Number(m && m.valor) || 0), 0));
    const pagou = movs.some((m) => m && Number(m.valor) > 0);
    const prox = lista[i + 1] || null;
    const veio = leva ? `${leva > 0 ? "+" : "−"}${efMoedaCurta(leva)} do saldo de ${levaDe}` : "";
    let nc = { ...c };
    let nota = "";
    if (pagou) {
      const sobra = efCent(devido - soma);
      const datas = movs.map((m) => String((m && m.em) || "")).filter(Boolean).sort();
      const pagoEm = datas.length ? datas[datas.length - 1].slice(0, 10) : (c.pagoEm || "");
      const partes = [veio];
      if (Math.abs(sobra) >= 0.01) {
        partes.push(`${soma < 0 ? "devolvido " + efMoedaCurta(soma) + " no mês" : "pago " + efMoedaCurta(soma) + " de " + efMoedaCurta(devido)} · ${sobra > 0 ? "falta" : "sobra"} ${efMoedaCurta(sobra)} → `
          + (prox ? efMesCurto(prox.vencimento) : "sem parcela seguinte"));
      }
      nota = partes.filter(Boolean).join(" · ");
      nc = { ...nc, valor: soma, valorFatura: devido, pago: true, valorPago: soma, pagoEm,
        contabilizadoEm: c.contabilizadoEm || efDiaLocal(agoraIso) };
      if (!c.pago) nc = efAto(nc, "paga", quem, agora);
      ajustes[c.id] = efCent(soma - base);
      leva = sobra; levaDe = efMesCurto(pagoEm || c.vencimento);
    } else {
      // em aberto: recebe o saldo que veio; o estorno lançado neste mês,
      // antes de a parcela ser paga, soma no que ela deve
      let valor = efCent(devido - soma);
      const partes = [veio];
      if (soma < 0) partes.push(`estorno de ${efMoedaCurta(soma)} em ${efMesCurto((movs[movs.length - 1] || {}).em)}`);
      let resto = 0;
      if (valor < 0) { resto = valor; valor = 0; partes.push("coberta pelo pago a mais"); }
      nota = partes.filter(Boolean).join(" · ");
      if (c.pago) nc = efParcelaEmAberto(nc, quem, agora);
      nc = { ...nc, valor };
      delete nc.valorFatura;
      ajustes[c.id] = efCent(valor - base);
      leva = resto; levaDe = levaDe || efMesCurto(c.vencimento);
    }
    if (Math.abs(leva) >= 0.01 && !prox) nota = [nota, `saldo de ${leva > 0 ? "" : "−"}${efMoedaCurta(leva)} sem parcela seguinte`].filter(Boolean).join(" · ");
    if (nota) nc.notaSaldo = nota; else delete nc.notaSaldo;
    if (nota) notas[c.id] = nota;
    if (efCent(nc.valor) !== efCent(c.valor) && c.pago === nc.pago) nc = efAto(nc, "recalibrada", quem, agora, nota);
    novas[c.id] = nc;
  });
  for (const k of Object.keys(ajustes)) if (Math.abs(ajustes[k]) < 0.005) delete ajustes[k];
  const contratos = ct ? (ob.contratos || []).map((x) => {
    if (!x || x.id !== ct.id) return x;
    const y = { ...x };
    if (Object.keys(ajustes).length) y.ajustesSaldo = ajustes; else delete y.ajustesSaldo;
    if (Object.keys(notas).length) y.notasSaldo = notas; else delete y.notasSaldo;
    if (Math.abs(leva) >= 0.01) y.saldoGestao = efCent(leva); else delete y.saldoGestao;
    return y;
  }) : ob.contratos;
  return { ...ob, contratos,
    contasPagar: (ob.contasPagar || []).map((c) => (c && novas[c.id] ? novas[c.id] : c)) };
}

// Desfaz na obra o que o lançamento tinha feito. A forma de agora tira o
// movimento e refaz o saldo; as antigas (a receita que baixou a parcela, o
// estorno que a reabriu) voltam como estavam.
function desfazerGestaoNaObra(obra, l, quem, agoraIso) {
  const o = (l && l.origem) || {};
  const ob = obra || {};
  if (!ehLigacaoDaGestao(o) || o.obraId !== ob.id) return { obra: ob };
  const agora = agoraIso || new Date().toISOString();
  const p = parcelaDoLancamento(ob, l);
  if (!p) return { obra: ob };
  const troca = (nova) => ({ ...ob, contasPagar: (ob.contasPagar || []).map((c) => (c && c.id === p.id ? nova : c)) });
  if (o.tipo === "gestao") {
    const movs = (p.movimentos || []).filter((m) => m && m.lancamentoId !== l.id);
    let nova = { ...p, movimentos: movs };
    if (!movs.length) {
      delete nova.movimentos;
      if (nova.pago) nova = efParcelaEmAberto(nova, quem, agora);
    } else if (!movs.some((m) => Number(m.valor) > 0) && nova.pago) {
      nova = efParcelaEmAberto(nova, quem, agora);
    }
    return { obra: recalibrarGestao(troca(nova), p.contratoId || "", quem, agora) };
  }
  if (o.tipo === "conta") {
    if (!p.pago) return { obra: ob };
    if (o.baixou === false) {
      if (o.pagoEmAntes == null || o.pagoEmAntes === p.pagoEm) return { obra: ob };
      return { obra: troca(efAto({ ...p, pagoEm: o.pagoEmAntes }, "editada", quem, agora)) };
    }
    return { obra: troca(efParcelaEmAberto(p, quem, agora)) };
  }
  // estorno antigo: a parcela volta ao pagamento de antes
  const lista = p.estornos || [];
  const i = lista.findIndex((e) => e && e.lancamentoId === l.id);
  if (i < 0) return { obra: ob };
  if (i !== lista.length - 1 || p.pago) {
    return { obra: ob, erro: `A parcela ${p.parcela || ""} foi paga de novo depois deste estorno. Desfaça esse pagamento antes.`.replace("  ", " ") };
  }
  const e = lista[i];
  const a = e.antes || {};
  const nova = efAto({ ...p, pago: true, pagoEm: a.pagoEm || e.em || "", valorPago: efCent(a.valorPago || e.valor),
    contabilizadoEm: a.contabilizadoEm || efDiaLocal(agoraIso), estornos: lista.slice(0, i) }, "paga", quem, agora, "estorno desfeito");
  if (!nova.estornos.length) delete nova.estornos;
  return { obra: troca(nova) };
}

// O lançamento `l` (com id) entra no saldo do mês dele, na parcela daquele
// mês. `antes` é o lançamento como estava gravado: o que ele tinha feito é
// desfeito primeiro. Devolve a obra nova e a `origem` do lançamento.
function gestaoNaObra(obra, l, antes, quem, agoraIso) {
  const ob0 = obra || {};
  const lan = l || {};
  const agora = agoraIso || new Date().toISOString();
  let ob = ob0;
  const ant = antes && ehLigacaoDaGestao(antes.origem) && antes.origem.obraId === ob0.id ? antes : null;
  if (ant) {
    const d = desfazerGestaoNaObra(ob, ant, quem, agora);
    if (d.erro) return { obra: ob0, erro: d.erro };
    ob = d.obra;
  }
  const estorno = Number(lan.valor) < 0 || !!lan.estorno;
  const valor = efCent(Math.abs(Number(lan.valor) || 0));
  if (!(valor > 0)) return { obra: ob, origem: null };
  const em = String(lan.lancadoEm || "").slice(0, 10);
  const comp = String(lan.competencia || em).slice(0, 7);
  const p = parcelaDoMesNaGestao(ob, comp);
  if (!p) return { obra: ob, origem: null };
  const mov = { lancamentoId: lan.id || "", em: em || `${comp}-01`, valor: estorno ? -valor : valor };
  let movs;
  if (!estorno && p.pago && !Array.isArray(p.movimentos) && Math.abs(efCent(Number(p.valorPago) || Number(p.valor)) - valor) < 0.01) {
    // já baixada na obra, no mesmo valor: é esse pagamento — passa a ter a
    // data do banco
    movs = [mov];
  } else {
    movs = movimentosDaParcela(p).concat([mov]);
  }
  const obraMov = { ...ob, contasPagar: (ob.contasPagar || []).map((c) => (c && c.id === p.id ? { ...c, movimentos: movs } : c)) };
  return { obra: recalibrarGestao(obraMov, p.contratoId || "", quem, agora),
    origem: { obraId: ob.id, tipo: "gestao", refId: p.id, contratoId: p.contratoId || "", contaObra: EF_CONTA_GESTAO_NA_OBRA } };
}

// O que a tela mostra antes de gravar: a parcela do mês e o saldo dela, a
// parcela seguinte (antes e depois) e o pago do contrato.
function previaDaGestao(obra, l, antes) {
  const ob = obra || {};
  const r = gestaoNaObra(ob, l, antes, "", "2000-01-01T00:00:00Z");
  if (r.erro) return { erro: r.erro };
  if (!r.origem) return null;
  const pago = (o, cid) => efCent(contasDaGestao(o, cid).reduce((t, c) => t + movimentosDaParcela(c).reduce((s, m) => s + (Number(m.valor) || 0), 0), 0));
  const total = (o, cid) => efCent(contasDaGestao(o, cid).reduce((t, c) => t + (Number(c.valor) || 0), 0));
  const cid = r.origem.contratoId;
  const depois = contasDaGestao(r.obra, cid);
  const i = depois.findIndex((c) => c.id === r.origem.refId);
  const p = depois[i];
  const prox = depois.slice(i + 1).find((c) => !c.pago) || null;
  const proxAntes = prox ? (ob.contasPagar || []).find((c) => c && c.id === prox.id) : null;
  const pctDe = (v, t) => (t > 0 ? Math.round((v / t) * 1000) / 10 : 0);
  const tot = total(r.obra, cid);
  return {
    mes: efMesCurto(l && (l.competencia || l.lancadoEm)),
    parcela: { n: Number(p.parcela) || i + 1, de: Number(p.totalParcelas) || depois.length, pago: !!p.pago,
      valorPago: efCent(p.valorPago), fatura: efCent(p.valorFatura != null ? p.valorFatura : p.valor), nota: p.notaSaldo || "" },
    proxima: prox ? { n: Number(prox.parcela) || 0, vencimento: prox.vencimento || "", antes: efCent(proxAntes ? proxAntes.valor : prox.valor),
      depois: efCent(prox.valor), nota: prox.notaSaldo || "" } : null,
    contrato: { antes: pago(ob, cid), depois: pago(r.obra, cid), total: tot,
      pctAntes: pctDe(pago(ob, cid), tot), pctDepois: pctDe(pago(r.obra, cid), tot) },
  };
}

// UI — daqui para baixo é tela (JSX). Os testes cortam neste marcador.

// Os papéis da transação, cada um abrindo numa aba. É o mesmo componente
// na conta a pagar, no extrato do escritório e na fatura do cartão — o
// papel anexado na contabilização tem que ser achado de qualquer ponta.
function LinksDeAnexo({ transacao, compacto, aoTrocar, aoTirar, ocupado }) {
  // O arquivo abre no visor do VICKE, não por link cru: o storage guarda o
  // PDF sem extensão, e o navegador baixava um arquivo com nome de código
  // que o computador não sabe abrir. O visor reembala como PDF e o "Baixar"
  // de lá sai com o nome certo.
  // Com aoTrocar/aoTirar, cada papel ganha "trocar" e "tirar" — o papel em
  // branco ou errado se corrige ali mesmo, sem refazer a conta.
  const [vendo, setVendo] = useState(null);
  const [tirando, setTirando] = useState(null);
  const trocandoRef = useRef(null);
  const entrada = useRef(null);
  const lista = anexosDaTransacao(transacao).filter((a) => a && a.url);
  if (!lista.length) return null;
  const chave = (a, i) => a.public_id || a.url || String(i);
  const acao = { background: "none", border: "none", padding: 0, fontSize: 11, color: "#6b7280", cursor: ocupado ? "default" : "pointer", textDecoration: "underline", fontFamily: "inherit" };
  return (
    <span style={{ display: "inline-flex", gap: compacto ? 6 : 10, flexWrap: "wrap", alignItems: "center" }}>
      {vendo && typeof VisorProposta === "function" && (
        <VisorProposta anexo={vendo} aoFechar={() => setVendo(null)} />
      )}
      {aoTrocar && (
        <input ref={entrada} type="file" accept="application/pdf,image/*" style={{ display: "none" }}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f && trocandoRef.current) aoTrocar(trocandoRef.current, f); }} />
      )}
      {lista.map((a, i) => (
        <span key={chave(a, i)} style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <a href={a.url} target="_blank" rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              if (typeof VisorProposta === "function") { e.preventDefault(); setVendo(a); }
            }}
            title={a.nome || rotuloDoAnexo(a, i)}
            style={{ fontSize: compacto ? 11 : 11.5, color: a.tipo === "entrega" ? "#15803d" : "#0474f4", textDecoration: "none",
              fontWeight: a.tipo === "entrega" ? 600 : 400,
              whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 3 }}>
            <span aria-hidden="true">{a.tipo === "entrega" ? "\u2713" : "\u{1F4CE}"}</span>
            {compacto ? rotuloDoAnexo(a, i) : rotuloDoAnexo(a, i) + (a.nome ? " · " + a.nome : "")}
          </a>
          {aoTrocar && tirando !== chave(a, i) && (
            <button type="button" style={acao} disabled={!!ocupado}
              onClick={(e) => { e.stopPropagation(); trocandoRef.current = a; entrada.current && entrada.current.click(); }}>trocar</button>
          )}
          {aoTirar && (tirando === chave(a, i) ? (
            <span style={{ fontSize: 11, color: "#b91c1c" }}>
              tirar este papel?{" "}
              <button type="button" style={{ ...acao, color: "#b91c1c" }} disabled={!!ocupado}
                onClick={(e) => { e.stopPropagation(); setTirando(null); aoTirar(a); }}>sim</button>
              {" · "}
              <button type="button" style={acao} onClick={(e) => { e.stopPropagation(); setTirando(null); }}>não</button>
            </span>
          ) : (
            <button type="button" style={acao} disabled={!!ocupado}
              onClick={(e) => { e.stopPropagation(); setTirando(chave(a, i)); }}>tirar</button>
          ))}
        </span>
      ))}
    </span>
  );
}

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
  // boxSizing é o que impede o campo de transbordar a coluna: sem ele,
  // "100% + 20 de padding + 2 de borda" passa da largura da célula e as
  // bordas de um campo entram por cima do vizinho.
  input: { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 9,
    border: "1px solid rgba(38,36,33,0.18)", fontSize: 13, fontFamily: "inherit",
    background: "#fff", color: "#262421" },
  rot: { fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, lineHeight: 1.3 },
  btn: { background: "#0474f4", color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px",
    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  btnSec: { background: "#fff", color: "#262421", border: "1px solid rgba(38,36,33,0.18)", borderRadius: 10,
    padding: "8px 14px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" },
};

const EF_MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
// Na lista, o estorno aparece como estorno — não como valor negativo solto.
function efValorDoLancamento(l) {
  const v = Number((l || {}).valor) || 0;
  return v < 0 ? "estorno " + efDinheiro(-v) : efDinheiro(v);
}

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
    { titulo: "Empreendimentos", grupos: ["emp_aportes", "emp_entradas", "emp_saidas"], saldo: "saldoEmpreendimento", rotulo: "Saldo de empreendimentos" },
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
                <Fragment key={b.titulo}>
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
                </Fragment>
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
function FormLancamentoEscritorio({ inicial, aoSalvar, aoCancelar, fechamentos, clientes, obras, prestadores, aoCriarPrestador, insumos, cartoes, aoCadastrarInsumo, competenciaFixa, titulo, rotuloSalvar, atalhos, nomeEscritorio }) {
  const S = EF_ESTILO;
  const [f, setF] = useState(() => ({
    contaId: "", contaFonte: "", obraIdAlvo: "", fornecedorId: "", anexos: [], itens: [],
    unidadeId: "escritorio", valor: "", competencia: "", lancadoEm: "",
    cliente: "", clienteId: "", empreendimentoId: "", projeto: "", fornecedor: "", descricao: "", documento: "", contaBanco: "sim",
    ...(inicial || {}),
    ...(competenciaFixa ? { competencia: competenciaFixa } : {}),
    parcelas: (inicial && Array.isArray(inicial.parcelasCartao) && inicial.parcelasCartao.length) || (inicial && inicial.parcelas) || 1,
  }));
  const lancNovo = !(inicial && inicial.id);
  const [tentou, setTentou] = useState(false);
  const [erroAnexo, setErroAnexo] = useState("");
  const [novoPrest, setNovoPrest] = useState(null);   // { nome, categoria }
  const [erroPrest, setErroPrest] = useState("");
  const [lendoComprov, setLendoComprov] = useState(false);
  const [avisosLidos, setAvisosLidos] = useState([]);
  // O que o comprovante disse e o lançamento já dizia diferente. Não corrige
  // nada sozinho: só põe à vista, porque na conciliação do extrato isto
  // costuma ser comprovante colado na linha errada.
  const [divergencia, setDivergencia] = useState(null);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  // A mesma IA da Entrada: lê foto, print e PDF de qualquer papel.
  const iaDisponivel = typeof useIaDisponivel === "function" ? useIaDisponivel() : false;

  // ── O papel anexado vira o lançamento ──
  // Qualquer arquivo: foto, print e PDF vão para a IA (e o PDF que ela não
  // ler, para o leitor do VICKE); o XML da nota é lido aqui, exato. Do papel
  // saem fornecedor (pelo CNPJ, depois pelo nome), número da nota,
  // descrição e os itens — casados com o catálogo de insumos pelo mesmo
  // caminho da Entrada. Só preenche o que está VAZIO: valor e data são do
  // banco, e o que divergir vira aviso, não correção.
  const [lida, setLida] = useState(null);        // { origem, papel, itens, casados }
  const [progresso, setProgresso] = useState(null);
  async function lerPapel(arquivo) {
    setLendoComprov(true); setErroAnexo(""); setDivergencia(null); setAvisosLidos([]); setProgresso(null);
    try {
      const r = typeof lerPapelDoLancamento === "function"
        ? await lerPapelDoLancamento(arquivo, { iaDisponivel, aoProgresso: (pr) => setProgresso(pr) })
        : { ficha: null, erro: "Leitor indisponível." };
      if (!r.ficha) { setErroAnexo((r.erro || "Não reconheci o papel.") + " O arquivo fica anexado do mesmo jeito."); return; }
      aplicarFicha(r.ficha, r.origem);
      if (r.aviso) setAvisosLidos((x) => [r.aviso].concat(x));
    } catch (e) {
      setErroAnexo((e && e.message) || "Não consegui ler o papel — ele fica anexado do mesmo jeito.");
    } finally {
      setLendoComprov(false); setProgresso(null);
    }
  }
  function aplicarFicha(ficha, origem) {
    const pa = (ficha && ficha.papel) || {};
    const digitos = (x) => String(x || "").replace(/\D/g, "");
    // O valor do PAPEL (total da nota, valor pago) — nunca a soma dos itens,
    // que não tem o desconto do rodapé e sairia sempre "diferente do banco".
    const valorLido = Math.round((Number(pa.valor) || 0) * 100) / 100;
    const emitente = pa.fantasia || pa.lidoComo || "";
    const pelaCnpj = digitos(pa.cnpj).length >= 11
      ? (prestadores || []).find((x) => x && digitos(x.cnpjCpf) === digitos(pa.cnpj)) : null;
    const doCadastro = pelaCnpj || (pa.lidoComo && typeof prestadorDoComprovante === "function"
      ? (prestadorDoComprovante(prestadores || [], pa.lidoComo) || (pa.fantasia ? prestadorDoComprovante(prestadores || [], pa.fantasia) : null))
      : null);
    // Itens de nota, pedido ou cupom — casados com o catálogo.
    const comItens = (ficha.itens || []).filter((x) => x && String(x.descricao || "").trim());
    const ehDeItens = comItens.length && ["nota", "pedido", "lista"].indexOf(pa.tipo) >= 0;
    const lidos = ehDeItens && typeof itensDaEntrada === "function"
      ? itensDaEntrada({ itens: comItens }, "orcamento", insumos || []).map((x) => {
          const ins = x.insumoCodigo ? (insumos || []).find((m) => m && (m.codigo === x.insumoCodigo || m.id === x.insumoCodigo)) : null;
          return { ...x, textoLido: x.descricao,
            etapa: x.etapa || (ins && ins.etapaPadrao) || "",
            contaId: x.contaId || (ins && ins.contaPadrao) || "material",
            grupoMaterial: x.grupoMaterial || (ins && ins.grupo) || "" };
        })
      : [];
    const tipoPapel = pa.tipo === "comprovante" ? "comprovante" : (pa.ehNota || pa.tipo === "nfse" || pa.tipo === "nota") ? "nota"
      : (typeof tipoDoAnexoDaEntrada === "function" ? tipoDoAnexoDaEntrada(pa) : "pedido");
    setF((p) => {
      const novo = { ...p };
      if (valorLido > 0 && !(efValorDoCampo(p.valor) > 0)) novo.valor = valorLido.toFixed(2).replace(".", ",");
      if (pa.pagoEm && !p.lancadoEm) novo.lancadoEm = pa.pagoEm;
      if ((pa.pagoEm || pa.emitido) && !p.competencia) novo.competencia = (pa.pagoEm || pa.emitido).slice(0, 7);
      const semFornecedor = !p.fornecedorId && (!String(p.fornecedor || "").trim() || p.fornecedor === EF_FORNECEDOR_OUTROS);
      if (semFornecedor && doCadastro) { novo.fornecedorId = doCadastro.id; novo.fornecedor = doCadastro.nome || ""; }
      else if (semFornecedor && emitente) novo.fornecedor = emitente;
      const nota = pa.numeroNota || pa.numeroPedido || "";
      if (nota && !/\d/.test(String(p.documento || ""))) novo.documento = String(nota);
      if (!String(p.descricao || "").trim() || p.descricao === p.historicoBanco) {
        const resumo = [emitente, pa.numeroNota ? "NF " + pa.numeroNota : "",
          lidos.length ? (lidos.length === 1 ? lidos[0].descricao : lidos.length + " itens") : (pa.descricao || "")].filter(Boolean).join(" · ");
        if (resumo) novo.descricao = resumo.slice(0, 160);
      }
      if (lidos.length && !(p.itens || []).length) novo.itens = lidos;
      novo.notaLida = { tipo: pa.tipo || "", numero: pa.numeroNota || pa.numeroPedido || "", chave: pa.chave || "",
        emitido: pa.emitido || "", emitente: pa.lidoComo || "", cnpj: pa.cnpj || "", valor: valorLido,
        desconto: Number(pa.desconto) || 0, origem: origem || "" };
      // O último papel anexado, ainda sem nome, é este.
      const lista = anexosDaTransacao(p);
      let k = -1;
      for (let x = lista.length - 1; x >= 0; x--) if (lista[x] && !lista[x].tipo) { k = x; break; }
      if (k >= 0) return comAnexos(novo, lista.map((a, x) => (x === k ? { ...a, tipo: tipoPapel } : a)));
      return novo;
    });
    setLida({ origem: origem || "", papel: pa, itens: lidos.length, casados: lidos.filter((x) => x.insumoCodigo).length,
      cadastro: doCadastro || null });
    setAvisosLidos((ficha.avisos || []).filter((x) => !/Como foi pago|^Este arquivo tem|Confira os itens/.test(x)));
    const valorForm = efValorDoCampo(f.valor);
    const quando = pa.pagoEm || "";
    const difValor = valorLido > 0 && valorForm > 0 && Math.abs(valorLido - valorForm) >= 0.01;
    const difData = !!(quando && f.lancadoEm && quando !== f.lancadoEm);
    setDivergencia(difValor || difData
      ? { valor: difValor ? valorLido : 0, data: difData ? quando : "", favorecido: emitente || "" }
      : null);
  }
  // Conta do plano da OBRA: o lançamento não nasce aqui, nasce lá — e chega
  // ao extrato do escritório pela ponte, já traduzido.
  const naObra = f.contaFonte === "obra";
  const opcoesConta = contasDoLancamento(f.unidadeId, {});
  const obrasDoCliente = obrasDoLancamento({ obras: obras || [] }, f.clienteId);
  // Cliente com uma obra só não é uma escolha: é a resposta. Perguntar
  // seria pedir que ele confirmasse o óbvio em todo lançamento.
  useEffect(() => {
    if (f.contaFonte !== "obra") return;
    if (f.obraIdAlvo) return;
    if (obrasDoCliente.length !== 1) return;
    const unica = obrasDoCliente[0];
    setF((p) => ({ ...p, obraIdAlvo: unica.id, projeto: unica.nome || p.projeto }));
  }, [f.contaFonte, f.obraIdAlvo, f.clienteId, obrasDoCliente.length]);
  // Gestão de obras: a obra é obrigatória e vem do cadastro. Cliente com
  // uma obra só já a tem escolhida; lançamento copiado do mês passado traz
  // o nome dela, e o nome acha a obra.
  useEffect(() => {
    if (f.unidadeId !== "gestao_obras" || f.obraId || f.contaFonte === "obra") return;
    const lista = obrasDaGestao(obras, clientes, f.clienteId);
    const pelo = f.projeto ? lista.find((o) => efSemAcento(String(o.nome || "")).trim().toLowerCase() === efSemAcento(String(f.projeto)).trim().toLowerCase()) : null;
    const unica = !pelo && f.clienteId && lista.length === 1 ? lista[0] : null;
    const o = pelo || unica;
    if (o) setF((p) => ({ ...p, obraId: o.id, projeto: o.nome || p.projeto }));
  }, [f.unidadeId, f.obraId, f.clienteId, f.projeto, f.contaFonte]);
  // Receita: o fornecedor é o próprio escritório, já escolhido — se ninguém
  // escolheu outro.
  useEffect(() => {
    const padrao = fornecedorPadraoDaConta(f.contaId, nomeEscritorio);
    if (!padrao || f.fornecedorId) return;
    if (f.fornecedor && f.fornecedor !== EF_FORNECEDOR_OUTROS) return;
    setF((p) => ({ ...p, fornecedor: padrao, fornecedorId: "" }));
  }, [f.contaId]);
  const obraAlvo = obrasDoCliente.find((o) => o && o.id === f.obraIdAlvo) || null;
  const clienteAlvo = (clientes || []).find((c) => c && c.id === f.clienteId) || null;
  const destinoDoCusto = naObra ? destinoVisivelDoCusto(f.contaId, obraAlvo, clienteAlvo, {}) : null;
  // Nota com itens é material de obra quase sempre: a tela pergunta de qual
  // obra — primeiro as que o histórico do banco ou o papel citam.
  function escolherObra(o) {
    if (!o) return;
    const cli = (clientes || []).find((c) => c && c.id === o.clienteId) || null;
    const emp = !!(cli && ehEmpreendimento(cli));
    const unidade = emp ? "empreendimento" : "gestao_obras";
    const ops = contasDoLancamento(unidade, {});
    const mat = ops.obra.find((c) => c.id === "material") || ops.obra[0] || null;
    setF((p) => ({ ...p, unidadeId: unidade, contaFonte: mat ? "obra" : p.contaFonte, contaId: mat ? mat.id : p.contaId,
      clienteId: cli ? cli.id : p.clienteId, cliente: cli ? cli.nome : p.cliente,
      empreendimentoId: emp ? cli.id : "", obraIdAlvo: o.id, projeto: o.nome || p.projeto }));
  }
  const textoParaObra = [f.historicoBanco, f.descricao, lida && lida.papel && lida.papel.descricao].filter(Boolean).join(" ");
  const obrasCitadas = (!naObra && (f.itens || []).length && typeof obrasCitadasNoTexto === "function")
    ? obrasCitadasNoTexto(textoParaObra, obras || []).slice(0, 4) : [];
  function aceitarSugestoes() {
    const lista = f.itens || [];
    lista.forEach((it, i) => { if (!it.insumoCodigo && it.sugestao && it.sugestao.codigo) porInsumo(i, it.sugestao.codigo); });
  }

  // ── Os itens do custo ──
  const itensDoCusto = f.itens || [];
  // sem item: pagamento único — o valor inteiro numa etapa
  const custoUnico = naObra && !itensDoCusto.some((i) => i && efBrutoDoItem(i) > 0);
  const nomeContaObra = ((typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : []).find((c) => c && c.id === f.contaId) || {}).nome || "";
  // conta de mão de obra: etapa e grupo "Prestadores de serviços" já vêm
  const padraoConta = naObra ? padraoDaContaDaObra(f.contaId) : { etapa: "", grupoMaterial: "" };
  const etapaUnicaEfetiva = f.etapaUnica != null ? f.etapaUnica : padraoConta.etapa;
  const itensEfetivos = naObra
    ? itensDoCustoOuUnico(itensDoCusto, efValorDoCampo(f.valor), etapaUnicaEfetiva, f.contaId, f.descricao || nomeContaObra,
      etapaUnicaEfetiva && etapaUnicaEfetiva === padraoConta.etapa ? padraoConta.grupoMaterial : "")
    : itensDoCusto;
  const resumoCusto = naObra ? custoDoLancamento(efValorDoCampo(f.valor), itensDoCusto) : null;
  const etapasDaObra = typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : [];
  const opcoesInsumo = (insumos || [])
    .filter((i) => i && i.ativo !== false)
    .map((i) => ({ valor: i.codigo || i.id, rotulo: i.nome, grupo: i.grupo || "",
      extra: (i.aliases || []).join(" ") }));
  const mexerItem = (i, muda) => setF((p) => ({ ...p,
    itens: (p.itens || []).map((x, j) => (j === i ? { ...x, ...muda } : x)) }));
  // Mexeu na quantidade ou no preço: o total do item é refeito. O total que
  // veio do papel só vale enquanto ninguém mexe — senão o campo mostrava um
  // preço novo com o total antigo.
  const mexerQtdOuPreco = (i, muda) => setF((p) => ({ ...p,
    itens: (p.itens || []).map((x, j) => {
      if (j !== i) return x;
      const n = { ...x, ...muda };
      const q = efValorDoCampo(n.quantidade), u = efValorDoCampo(n.unitario);
      return { ...n, bruto: q > 0 && u > 0 ? Math.round(q * u * 100) / 100 : "" };
    }) }));
  const tirarItem = (i) => setF((p) => ({ ...p, itens: (p.itens || []).filter((x, j) => j !== i) }));
  // o item novo já vem com a etapa do pagamento único, se ela foi escolhida
  const novoItem = () => setF((p) => ({ ...p,
    itens: (p.itens || []).concat([{ ...(typeof itemDoPedidoVazio === "function" ? itemDoPedidoVazio()
      : { id: String(Date.now()), descricao: "", insumoCodigo: "", quantidade: "", unidade: "", unitario: "", etapa: "", contaId: "" }),
      ...((p.etapaUnica != null ? p.etapaUnica : padraoConta.etapa)
        ? { etapa: p.etapaUnica != null ? p.etapaUnica : padraoConta.etapa } : {}),
      ...(padraoConta.grupoMaterial && (p.etapaUnica == null || p.etapaUnica === padraoConta.etapa)
        ? { grupoMaterial: padraoConta.grupoMaterial } : {}) }]) }));
  // O insumo escolhido traz o que ele já sabe: unidade, etapa e conta
  // contábil. O que a pessoa tiver posto à mão continua valendo.
  const porInsumo = (i, codigo, recemCadastrado) => {
    const ins = recemCadastrado || (insumos || []).find((x) => x && (x.codigo === codigo || x.id === codigo)) || null;
    if (!ins) { mexerItem(i, { insumoCodigo: codigo }); return; }
    const atual = itensDoCusto[i] || {};
    // Item que veio do papel: o texto da loja vira apelido do insumo ao gravar.
    if (atual.textoLido && (ins.codigo || ins.id)) {
      setF((p) => ({ ...p, aprender: (p.aprender || []).filter((x) => x.descricao !== atual.textoLido)
        .concat([{ codigo: ins.codigo || ins.id, descricao: atual.textoLido }]) }));
    }
    mexerItem(i, {
      sugestao: null,
      insumoCodigo: ins.codigo || ins.id || "",
      descricao: atual.descricao || ins.nome || "",
      grupoMaterial: ins.grupo || "",
      unidade: atual.unidade || ins.unidade || "",
      etapa: atual.etapa || ins.etapaPadrao || "",
      contaId: atual.contaId || ins.contaPadrao || f.contaId || "",
      unitario: atual.unitario || (ins.precoReferencia > 0 ? ins.precoReferencia : ""),
    });
  };

  const conta = naObra ? null : contaEscritorio(f.contaId);
  const unidadesOk = conta && (conta.unidades || []).length ? conta.unidades : UNIDADES_NEGOCIO.map((u) => u.id);
  // Empreendimento é cliente com tique: quando a unidade é Empreendimento, a
  // lista de escolha só traz esses, e o id escolhido vale pelos dois campos.
  const ehEmp = f.unidadeId === "empreendimento";
  const doCadastro = (clientes || []).filter((c) => c && (ehEmp ? ehEmpreendimento(c) : true));
  const erros = naObra
    ? validarLancamentoNaObra({ ...f, valor: efValorDoCampo(f.valor) }, { fechamentos })
        .concat(validarCustoEmItens(efValorDoCampo(f.valor), itensEfetivos, f.obraIdAlvo).erros
          .filter((e) => !/Escolha a obra|Informe o valor pago/.test(e))
          .map((e) => (custoUnico && /sem etapa/.test(e) ? "Escolha a etapa da obra." : e)))
    : validarLancamentoEscritorio({ ...f, valor: efValorDoCampo(f.valor),
        clienteId: f.clienteId || f.cliente,
        // na gestão, a obra é escolhida da lista (o id); lançamento antigo,
        // de antes da lista, segue valendo pelo nome
        obraId: f.unidadeId === "gestao_obras" ? (f.obraId || (lancNovo ? "" : f.projeto)) : f.projeto,
        empreendimentoId: ehEmp ? f.empreendimentoId : f.projeto }, { fechamentos });

  // ── Pago no cartão ──
  // A compra entra integral, na data dela, na conta escolhida (ou na obra);
  // no banco ela só sai dentro da fatura. Por isso o lançamento fica fora da
  // conferência com o banco e do resultado até a fatura fechar.
  const cartoesAtivos = (cartoes || []).filter((c) => c && c.ativo !== false);
  const noCartao = f.formaPagamento === "cartao";
  // Lançamento novo: por onde o dinheiro passou sai da regra (unidade, conta
  // e cadastro da obra) — e linha do banco passou pelo banco, sempre. O
  // antigo, ao editar, fica como foi gravado.
  const obraDaGestao = f.unidadeId === "gestao_obras" && f.obraId ? (obras || []).find((o) => o && o.id === f.obraId) || null : null;
  const regraBanco = f.extratoId ? "sim" : contaBancoPelaRegra(f.unidadeId, f.contaId, obraDaGestao);
  // ── Receita da gestão: entra no saldo do mês do contrato ──
  // O recebimento e o estorno entram no mês em que são lançados, na parcela
  // daquele mês do contrato de gestão da obra; a diferença para o valor
  // dela vai para a parcela do mês seguinte.
  const estornoNoForm = !!(f.sinalDoBanco && f.contaId && ehEstornoNaConta(f.contaId, f.sinalDoBanco))
    || !!f.estorno || (!lancNovo && Number((inicial || {}).valor) < 0);
  const ligadoAntes = !!(inicial && ehLigacaoDaGestao(inicial.origem));
  const temGestao = !naObra && ehReceitaDaGestao(f) && !!obraDaGestao && contasDaGestao(obraDaGestao).length > 0;
  // O lançamento antigo, de antes da ligação, só entra se a pessoa marcar:
  // o pagamento dele pode já estar contado na parcela, baixado na obra.
  const foraDaGestao = f.foraDaGestao != null ? !!f.foraDaGestao : (!lancNovo && !ligadoAntes);
  const previaGestao = temGestao && !foraDaGestao
    ? previaDaGestao(obraDaGestao, { id: f.id || "__novo",
        valor: (estornoNoForm ? -1 : 1) * Math.abs(efValorDoCampo(f.valor)),
        lancadoEm: f.lancadoEm, competencia: competenciaFixa || f.competencia || String(f.lancadoEm || "").slice(0, 7) },
      ligadoAntes ? inicial : null)
    : null;
  const errosGestao = previaGestao && previaGestao.erro ? [previaGestao.erro] : [];
  const cartaoEscolhido = noCartao ? cartaoPorId(cartoesAtivos, f.cartaoId) : null;
  const planoCartao = cartaoEscolhido
    ? parcelasDoCartao(cartaoEscolhido, f.lancadoEm, efValorDoCampo(f.valor), f.parcelas) : [];
  const comoFoiPago = noCartao ? "cartao" : (f.contaBanco === "nao" ? "nao" : "sim");
  const errosCartao = !noCartao ? []
    : [!cartaoEscolhido ? "Escolha o cartão." : "", !f.lancadoEm ? "Informe a data da compra." : ""].filter(Boolean);
  const todosErros = erros.concat(errosCartao).concat(errosGestao);
  const comCartao = (x) => {
    if (!noCartao) return { ...x, formaPagamento: naObra ? "avista" : (x.formaPagamento === "cartao" ? "" : x.formaPagamento),
      cartaoId: "", parcelasCartao: undefined };
    return { ...x, formaPagamento: "cartao", cartaoId: cartaoEscolhido.id, contaBanco: "nao",
      parcelasCartao: planoCartao };
  };

  const campo = (rot, filho, chave) => <div data-campo={chave} style={{ minWidth: 0 }}><div style={S.rot}>{rot}</div>{filho}</div>;
  function salvar() {
    setTentou(true);
    if (todosErros.length) return;
    const limpos = (f.itens || []).map((x) => { const y = { ...x }; delete y.sugestao; delete y.textoLido; return y; });
    const g = { ...f, itens: limpos };
    if (naObra) {
      const { etapaUnica: _e, ...semEtapaUnica } = g;
      aoSalvar(comCartao({ ...semEtapaUnica, naObra: true, valor: efValorDoCampo(g.valor),
        itens: custoUnico ? itensEfetivos : limpos }));
      return;
    }
    // O contrato de gestão só é mexido quando a tela o mostrou; o lançamento
    // que estava ligado e deixou de ser receita da gestão sai do saldo.
    const { foraDaGestao: _fora, parcelaGestaoId: _p, parcelaGestaoObra: _o, ...semObraDaParcela } = g;
    const noContrato = temGestao ? !foraDaGestao : (ligadoAntes ? false : undefined);
    if (noContrato !== undefined) semObraDaParcela.noContratoGestao = noContrato;
    aoSalvar(comCartao({ ...semObraDaParcela, ...(competenciaFixa ? { competencia: competenciaFixa } : {}),
      ...(lancNovo && !noCartao ? { contaBanco: regraBanco } : {}),
      tipo: "escritorio", valor: efValorDoCampo(g.valor) }));
  }
  // Na fila, quem lança 50 linhas não larga o teclado: Enter num campo de
  // texto lança e abre a próxima, Esc fecha. A lista de escolha aberta e o
  // cadastro rápido de fornecedor ficam com as teclas deles (eles marcam o
  // evento como tratado).
  function aoTeclar(e) {
    if (!atalhos || e.defaultPrevented || novoPrest) return;
    if (e.key === "Escape") { e.preventDefault(); aoCancelar(); return; }
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
    const alvo = e.target || {};
    const tipo = String(alvo.type || "text").toLowerCase();
    if (alvo.tagName !== "INPUT" || ["checkbox", "radio", "file", "button", "submit"].indexOf(tipo) >= 0) return;
    e.preventDefault();
    salvar();
  }
  // Aberto pela fila, o cursor já vai para onde se trabalha: a conta, se
  // ainda falta; senão a descrição — e aí um Enter lança. É também o que
  // deixa o Esc funcionar logo depois do "Lançar e seguir".
  const refForm = useRef(null);
  useEffect(() => {
    if (!atalhos || !refForm.current) return;
    const alvo = refForm.current.querySelector(f.contaId ? '[data-campo="descricao"] input' : '[data-campo="conta"] button');
    if (alvo && typeof alvo.focus === "function") alvo.focus();
  }, []);
  return (
    <div ref={refForm} onKeyDown={aoTeclar} style={{ ...S.card, borderColor: "rgba(4,116,244,0.35)", background: "#f7fbff", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{titulo || (inicial && inicial.id ? "Editar lançamento" : "Novo lançamento")}</div>
        {/* O número da transação: é por ele que a prestação de contas acha
            o lançamento e os papéis dele. Sai da sequência sozinho ao
            gravar — não há o que digitar aqui. */}
        <div style={{ fontSize: 11.5, color: "#6b7280" }}>
          {f.numeroDoc ? <>referência <b style={{ color: "#111827" }}>{f.numeroDoc}</b></> : "a referência sai ao gravar"}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
        gap: 12, alignItems: "end" }}>
        {/* A unidade vem PRIMEIRO porque é ela que decide quais contas
            existem: no empreendimento não há "Depósito em consignação", e
            no escritório não há "Material". Trocar a unidade limpa a conta
            escolhida se ela não valer mais ali. */}
        {campo("Unidade de negócio", (
          <Selecao style={{ ...S.input, cursor: "pointer" }} value={f.unidadeId} onChange={(e) => {
            const nova = e.target.value;
            setF((p) => {
              const ops = contasDoLancamento(nova, {});
              const aindaVale = (p.contaFonte === "obra")
                ? ops.obra.some((c) => c.id === p.contaId)
                : ops.escritorio.some((c) => c.id === p.contaId);
              return { ...p, unidadeId: nova,
                contaId: aindaVale ? p.contaId : "",
                contaFonte: aindaVale ? p.contaFonte : "",
                obraIdAlvo: aindaVale && p.contaFonte === "obra" ? p.obraIdAlvo : "" };
            });
          }}>
            {UNIDADES_NEGOCIO.filter((u) => unidadesOk.includes(u.id)).map((u) => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </Selecao>
        ))}
        {campo("Conta", (
          <Selecao style={{ ...S.input, cursor: "pointer" }}
            value={f.contaId ? valorDaConta(f.contaId, f.contaFonte || "escritorio") : ""}
            onChange={(e) => {
              const esc = contaEscolhida(e.target.value);
              const c = esc.fonte === "escritorio" ? contaEscritorio(esc.id) : null;
              const us = c && (c.unidades || []).length ? c.unidades : [];
              setF((p) => ({ ...p, contaId: esc.id, contaFonte: esc.fonte,
                unidadeId: us.length && !us.includes(p.unidadeId) ? us[0] : p.unidadeId,
                obraIdAlvo: esc.fonte === "obra" ? p.obraIdAlvo : "" }));
            }}>
            <option value="">— escolha —</option>
            {/* Primeiro o que é custo de uma obra: é o caso mais comum vindo
                do extrato, e é o que não existia aqui até agora. */}
            {opcoesConta.obra.length > 0 && (
              <optgroup label="CUSTO DE UMA OBRA (entra na obra e atravessa)">
                {opcoesConta.obra.map((c) => <option key={c.valor} value={c.valor}>{c.nome}</option>)}
              </optgroup>
            )}
            {GRUPOS_ESCRITORIO.map((g) => {
              const doGrupo = opcoesConta.escritorio.filter((c) => c.grupo === g.id);
              if (!doGrupo.length) return null;
              return (
                <optgroup key={g.id} label={g.titulo}>
                  {doGrupo.map((c) => <option key={c.valor} value={c.valor}>{c.nome}</option>)}
                </optgroup>
              );
            })}
          </Selecao>
        ), "conta")}
        {campo("Valor", <input style={S.input} inputMode="decimal" value={f.valor} placeholder="0,00"
          onChange={(e) => set("valor", e.target.value)} />)}
        {/* No fechamento, a competência é o mês que se está fechando: não
            é uma escolha, e um mês errado aqui sumiria da conferência. */}
        {!naObra && (competenciaFixa
          ? campo("Competência", <div style={{ ...S.input, background: "#f3f4f6", color: "#374151",
              display: "flex", alignItems: "center", minHeight: 36 }}>
              {efMesPorExtenso(competenciaFixa)}<span style={{ color: "#9ca3af", marginLeft: 6, fontSize: 11.5 }}>· do fechamento</span></div>)
          : campo("Competência", <input style={S.input} type="month" value={f.competencia}
              onChange={(e) => set("competencia", e.target.value)} />))}
        {campo("Data do pagamento", <input style={S.input} type="date" value={f.lancadoEm}
          onChange={(e) => set("lancadoEm", e.target.value)} />)}
        {/* Lançamento novo: o "fora da conta" não é escolha — sai da regra.
            Sobra escolher entre a conta e o cartão do escritório. */}
        {lancNovo && !naObra ? campo("Como foi pago", (f.unidadeId === "gestao_obras" || f.extratoId || !(cartoesAtivos.length > 0 || noCartao)) ? (
          <div data-vk-como-pago="1" style={{ ...S.input, background: "#f3f4f6", color: "#374151", display: "flex", alignItems: "center", minHeight: 36 }}>
            {regraBanco === "sim" ? "Conta do escritório" : "Pago pelo cliente, fora da conta"}
          </div>
        ) : (
          <Selecao style={{ ...S.input, cursor: "pointer" }} value={noCartao ? "cartao" : "sim"} onChange={(e) => {
            const v = e.target.value;
            if (v === "cartao") {
              setF((p) => ({ ...p, formaPagamento: "cartao", contaBanco: "nao",
                cartaoId: p.cartaoId || (cartoesAtivos[0] ? cartoesAtivos[0].id : ""), parcelas: p.parcelas || 1 }));
            } else {
              setF((p) => ({ ...p, formaPagamento: "", contaBanco: "sim", cartaoId: "" }));
            }
          }}>
            <option value="sim">Conta do escritório</option>
            <option value="cartao">Cartão do escritório</option>
          </Selecao>
        )) : (campo("Como foi pago", (
          <Selecao style={{ ...S.input, cursor: "pointer" }} value={comoFoiPago} onChange={(e) => {
            const v = e.target.value;
            if (v === "cartao") {
              setF((p) => ({ ...p, formaPagamento: "cartao", contaBanco: "nao",
                cartaoId: p.cartaoId || (cartoesAtivos[0] ? cartoesAtivos[0].id : ""), parcelas: p.parcelas || 1 }));
            } else {
              setF((p) => ({ ...p, formaPagamento: "", contaBanco: v, cartaoId: "" }));
            }
          }}>
            <option value="sim">Conta do escritório</option>
            {(cartoesAtivos.length > 0 || noCartao) && <option value="cartao">Cartão do escritório</option>}
            <option value="nao">Fora da conta do escritório</option>
          </Selecao>
        )))}
        {noCartao && campo("Cartão", (
          <Selecao style={{ ...S.input, cursor: "pointer" }} value={f.cartaoId || ""} onChange={(e) => set("cartaoId", e.target.value)}>
            <option value="">Escolha…</option>
            {cartoesAtivos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Selecao>
        ))}
        {noCartao && campo("Parcelas", <input style={S.input} inputMode="numeric" value={f.parcelas}
          onChange={(e) => set("parcelas", e.target.value.replace(/\D/g, "").slice(0, 2))} />)}
        {campo(ehEmp ? "Empreendimento" : "Cliente", (
          <Selecao style={{ ...S.input, cursor: "pointer" }}
            value={f.clienteId || ""}
            onChange={(e) => {
              const c = doCadastro.find((x) => x.id === e.target.value);
              setF((p) => ({ ...p, clienteId: e.target.value, cliente: c ? c.nome : "",
                empreendimentoId: c && ehEmpreendimento(c) ? c.id : "" }));
            }}>
            <option value="">{f.cliente && !f.clienteId ? f.cliente : "— escolha —"}</option>
            {doCadastro.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}{ehEmpreendimento(c) && !ehEmp ? " · empreendimento" : ""}</option>
            ))}
          </Selecao>
        ))}
        {ehEmp && !doCadastro.length && (
          <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#b45309" }}>
            Nenhum empreendimento cadastrado ainda. Abra Clientes, cadastre o empreendimento e marque
            “É um empreendimento do escritório”.
          </div>
        )}
        {naObra
          ? campo("Obra que recebe o custo", (
              <SelectBusca style={S.input} value={f.obraIdAlvo}
                onChange={(v) => setF((p) => ({ ...p, obraIdAlvo: v,
                  projeto: (obrasDoCliente.find((o) => o && o.id === v) || {}).nome || p.projeto }))}
                placeholder="Procurar obra…"
                opcoes={[{ valor: "", rotulo: f.clienteId ? "— escolha a obra —" : "— escolha o cliente antes —" }]
                  .concat(obrasDoCliente.map((o) => ({ valor: o.id, rotulo: o.nome || "Obra" })))} />
            ))
          : f.unidadeId === "gestao_obras"
            ? campo("Obra", (
                <SelectBusca style={S.input} value={f.obraId || ""}
                  onChange={(v) => {
                    const o = (obras || []).find((x) => x && x.id === v) || null;
                    const cli = o ? (clientes || []).find((c) => c && c.id === o.clienteId) : null;
                    setF((p) => ({ ...p, obraId: v, projeto: o ? o.nome || "" : "",
                      clienteId: cli ? cli.id : p.clienteId, cliente: cli ? cli.nome : p.cliente }));
                  }}
                  placeholder="Procurar obra…"
                  opcoes={[{ valor: "", rotulo: "— escolha a obra —" }].concat(obrasDaGestao(obras, clientes, f.clienteId)
                    .map((o) => ({ valor: o.id, rotulo: o.nome || "Obra",
                      grupo: ((clientes || []).find((c) => c && c.id === o.clienteId) || {}).nome || "" })))} />
              ), "obra")
            : campo("Projeto", <input style={S.input} value={f.projeto} onChange={(e) => set("projeto", e.target.value)} />)}
        {campo("Fornecedor", (
          <SelectBusca style={S.input}
            /* Campo em branco já é "Outros" no fim, então ele diz isso desde
               o começo: o que está escrito ali é o que vai ser gravado. */
            value={f.fornecedorId
              || (nomeEscritorio && f.fornecedor === nomeEscritorio ? EF_OPCAO_ESCRITORIO
                : f.fornecedor && f.fornecedor !== EF_FORNECEDOR_OUTROS ? "" : EF_OPCAO_OUTROS)}
            onChange={(v) => {
              if (v === EF_OPCAO_OUTROS) { setF((p) => ({ ...p, fornecedorId: "", fornecedor: EF_FORNECEDOR_OUTROS })); return; }
              if (v === EF_OPCAO_ESCRITORIO) { setF((p) => ({ ...p, fornecedorId: "", fornecedor: nomeEscritorio })); return; }
              const pr = (prestadores || []).find((x) => x && x.id === v) || null;
              setF((p) => ({ ...p, fornecedorId: v, fornecedor: pr ? pr.nome : "" }));
            }}
            placeholder="Procurar fornecedor…"
            aoCriar={(termo) => { setErroPrest(""); setNovoPrest({ nome: termo || "", categoria: "Loja / Comércio" }); }}
            criarRotulo="fornecedor"
            opcoes={(nomeEscritorio ? [{ valor: EF_OPCAO_ESCRITORIO, rotulo: `${nomeEscritorio} — o próprio escritório` }] : [])
              .concat([{ valor: EF_OPCAO_OUTROS, rotulo: "Outros — não identificado" }])
              .concat(f.fornecedor && !f.fornecedorId && f.fornecedor !== EF_FORNECEDOR_OUTROS && f.fornecedor !== nomeEscritorio
                ? [{ valor: "", rotulo: f.fornecedor }] : [])
              .concat((prestadores || []).map((x) => ({ valor: x.id, rotulo: x.nome, grupo: x.categoria || "" })))} />
        ))}
        {novoPrest && (
          <div style={{ gridColumn: "1 / -1" }}>
            <CadastroRapidoDePrestador form={novoPrest} aoMudar={setNovoPrest} erro={erroPrest} fornecedores={prestadores}
              aoSalvar={() => {
                if (!String(novoPrest.nome || "").trim()) { setErroPrest("Escreva o nome."); return; }
                const criado = aoCriarPrestador ? aoCriarPrestador(novoPrest) : null;
                if (!criado) { setErroPrest("Não consegui cadastrar agora."); return; }
                setF((p) => ({ ...p, fornecedorId: criado.id, fornecedor: criado.nome || "" }));
                setNovoPrest(null); setErroPrest("");
              }}
              aoCancelar={() => { setNovoPrest(null); setErroPrest(""); }} />
          </div>
        )}
        {campo("Nº da nota / boleto", <input style={S.input} value={f.documento}
          placeholder="o número do papel, não a forma de pagamento"
          onChange={(e) => set("documento", e.target.value)} />)}
      </div>
      {/* O que este lançamento faz no contrato de gestão da obra, antes de
          gravar: a parcela que baixa (ou volta a abrir) e o percentual pago. */}
      {temGestao && (() => {
        const pctTxt = (v) => String(v).replace(".", ",") + "%";
        const caixa = { fontSize: 12.5, color: "#1e3a5f", background: "#f0f7ff", border: "1px solid rgba(4,116,244,0.25)",
          borderRadius: 10, padding: "9px 11px", lineHeight: 1.5, display: "grid", gap: 4 };
        const obraNome = (obraDaGestao && obraDaGestao.nome) || "da obra";
        const marca = (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#4b5563", cursor: "pointer" }}>
            <input type="checkbox" checked={!foraDaGestao} onChange={(e) => set("foraDaGestao", !e.target.checked)} />
            Entra no saldo do contrato de gestão de {obraNome}
          </label>
        );
        if (foraDaGestao || !previaGestao || previaGestao.erro) {
          return <div data-vk-gestao="fora" style={caixa}>{marca}{foraDaGestao && <span>Fora do contrato: as parcelas não mudam.</span>}</div>;
        }
        const pv = previaGestao;
        return (
          <div data-vk-gestao="saldo" style={caixa}>
            <div>
              Entra no saldo de <b>{pv.mes}</b> · parcela {pv.parcela.n}/{pv.parcela.de}:{" "}
              {pv.parcela.pago && pv.parcela.valorPago < 0
                ? <>no mês, devolvido mais do que entrou: <b>{efDinheiro(Math.abs(pv.parcela.valorPago))}</b>.</>
                : pv.parcela.pago
                ? <>pago no mês <b>{efDinheiro(pv.parcela.valorPago)}</b> de {efDinheiro(pv.parcela.fatura)}.</>
                : <>em aberto, deve <b>{efDinheiro(pv.parcela.fatura)}</b>.</>}
            </div>
            {pv.proxima && Math.abs(pv.proxima.antes - pv.proxima.depois) >= 0.01 && (
              <div>
                Parcela {pv.proxima.n} ({efMesCurto(pv.proxima.vencimento)}) passa de {efDinheiro(pv.proxima.antes)} a <b>{efDinheiro(pv.proxima.depois)}</b>
                {pv.proxima.nota ? <span style={{ color: "#4b5563" }}> — {pv.proxima.nota}</span> : null}.
              </div>
            )}
            <div>
              Contrato: pago {efDinheiro(pv.contrato.antes)} ({pctTxt(pv.contrato.pctAntes)})
              {Math.abs(pv.contrato.depois - pv.contrato.antes) >= 0.01
                ? <> → <b>{efDinheiro(pv.contrato.depois)}</b> ({pctTxt(pv.contrato.pctDepois)})</> : null} de {efDinheiro(pv.contrato.total)}.
            </div>
            {marca}
          </div>
        );
      })()}
      {/* Saída numa conta de entrada (ou o contrário): é estorno, e a tela
          diz antes de gravar — em vez de somar receita que voltou. */}
      {!naObra && f.sinalDoBanco && f.contaId && ehEstornoNaConta(f.contaId, f.sinalDoBanco) && (() => {
        const c = contaEscritorio(f.contaId);
        const g = c && grupoEscritorio(c.grupo);
        const entrada = g && g.sinal > 0;
        const mes = f.competencia ? efMesPorExtenso(f.competencia) : "do mês";
        return (
          <div data-vk-estorno="1" style={{ fontSize: 12.5, color: "#92400e", background: "#fffbeb", border: "1px solid rgba(180,83,9,0.25)",
            borderRadius: 10, padding: "9px 11px", marginBottom: 12, lineHeight: 1.45 }}>
            <b>Estorno.</b> {entrada ? "Dinheiro que saiu do banco" : "Dinheiro que entrou no banco"} numa conta de {entrada ? "receita" : "despesa"}:
            entra como <b>− {efDinheiro(Math.abs(efValorDoCampo(f.valor)))}</b> em <b>{c.nome}</b>, abatendo {entrada ? "a receita" : "a despesa"} de {mes}.
            O mês em que {entrada ? "a receita entrou" : "a despesa foi paga"}, se já fechado, não muda.
          </div>
        );
      })()}
      {campo("Descrição", <input style={S.input} value={f.descricao} onChange={(e) => set("descricao", e.target.value)} />, "descricao")}
      {/* ── O custo, item a item ──
          A conta a pagar sempre foi por item; é daqui que saem o custo por
          etapa e a abertura por subconta. Escolher o insumo traz unidade,
          etapa e conta contábil do catálogo — a etapa não se digita, ela
          vem com o material. */}
      {naObra && (
        <div style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 12, padding: 12, background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>{itensDoCusto.length ? "O que foi comprado" : "Onde entra na obra"}</div>
            <div style={{ fontSize: 11.5, color: "#6b7280" }}>
              o custo por etapa da obra sai daqui
            </div>
            {itensDoCusto.filter((x) => !x.insumoCodigo && x.sugestao && x.sugestao.codigo).length > 1 && (
              <button type="button" style={{ ...S.btnSec, marginLeft: "auto", padding: "4px 10px", fontSize: 11.5, color: "#0474f4",
                borderColor: "rgba(4,116,244,0.4)" }} onClick={aceitarSugestoes}>
                ✓ aceitar as {itensDoCusto.filter((x) => !x.insumoCodigo && x.sugestao && x.sugestao.codigo).length} sugestões
              </button>
            )}
          </div>

          {!itensDoCusto.length && (
            <div data-vk-custo-unico="1" style={{ display: "grid", gap: 10, marginBottom: 10, alignItems: "end",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div style={{ minWidth: 0 }}>
                <div style={S.rot}>Etapa da obra</div>
                <SelectBusca style={S.input} value={etapaUnicaEfetiva || ""}
                  onChange={(v) => set("etapaUnica", v)}
                  placeholder="Procurar etapa…"
                  opcoes={[{ valor: "", rotulo: "— escolha a etapa —" }]
                    .concat(etapasDaObra.map((e) => ({ valor: e.id, rotulo: e.nome || e.titulo || e.id })))} />
              </div>
              <div style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.45, paddingBottom: 4 }}>
                Pagamento único: <b style={{ color: "#111827" }}>{efDinheiro(efValorDoCampo(f.valor))}</b> inteiro nesta etapa
                {nomeContaObra ? <>, conta <b style={{ color: "#111827" }}>{nomeContaObra}</b></> : null}
                {padraoConta.etapa && etapaUnicaEfetiva === padraoConta.etapa ? <>, grupo <b style={{ color: "#111827" }}>{padraoConta.grupoMaterial}</b> (o padrão da conta)</> : null}.
                Compra de vários itens? Detalhe item a item.
              </div>
            </div>
          )}

          {itensDoCusto.map((it, i) => {
            const bruto = efBrutoDoItem(it);
            return (
              <div key={it.id || i} style={{ display: "grid", gap: 8, marginBottom: 10, paddingBottom: 10,
                borderBottom: i < itensDoCusto.length - 1 ? "1px solid rgba(38,36,33,0.08)" : "none",
                gridTemplateColumns: "1fr" }}>
                <div style={{ display: "grid", gap: 8,
                  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", alignItems: "end" }}>
                  <div style={{ minWidth: 0, gridColumn: "1 / -1" }}>
                    <div style={S.rot}>Item do catálogo</div>
                    {typeof CampoItemDoCatalogo === "function" ? (
                      <CampoItemDoCatalogo codigo={it.insumoCodigo} descricao={it.descricao} unidade={it.unidade}
                        insumos={insumos} aoEscolher={(ins) => porInsumo(i, ins.codigo || ins.id, ins)}
                        aoCadastrar={aoCadastrarInsumo}
                        aoLimpar={() => mexerItem(i, { insumoCodigo: "" })} />
                    ) : (
                      <SelectBusca style={S.input} value={it.insumoCodigo}
                        onChange={(v) => porInsumo(i, v)}
                        placeholder="Procurar no catálogo…"
                        opcoes={[{ valor: "", rotulo: it.descricao || "— escolha o material —" }].concat(opcoesInsumo)} />
                    )}
                    {/* O que veio do papel: a aposta do catálogo a um toque, e
                        o texto da loja à vista — é ele que vira apelido. */}
                    {!it.insumoCodigo && it.sugestao && it.sugestao.codigo && (
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6, fontSize: 12 }}>
                        <span style={{ color: "#4b5563" }}>Parece <b style={{ color: "#111827" }}>{it.sugestao.nome || it.sugestao.codigo}</b></span>
                        <button type="button" style={{ ...S.btnSec, padding: "3px 10px", fontSize: 11.5, color: "#0474f4", borderColor: "rgba(4,116,244,0.4)" }}
                          onClick={() => porInsumo(i, it.sugestao.codigo)}>✓ é este</button>
                      </div>
                    )}
                    {it.textoLido && (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                        na nota: “{it.textoLido}”{!it.insumoCodigo && !(it.sugestao && it.sugestao.codigo) ? " — não achei no catálogo; escolha ou cadastre acima" : ""}
                      </div>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={S.rot}>Quantidade</div>
                    {/* número em português: vírgula no decimal, ponto no milhar —
                        o leitor do papel entrega 6.55, e era assim que aparecia */}
                    <CampoNumeroBR estilo={S.input} valor={it.quantidade} casas={0} maxCasas={4} placeholder="0"
                      aoMudar={(v) => mexerQtdOuPreco(i, { quantidade: v })} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={S.rot}>Unidade</div>
                    <CampoUnidadeDoItem valor={it.unidade || ""} estilo={S.input}
                      unidades={typeof unidadesDoCatalogo === "function" ? unidadesDoCatalogo(insumos || []) : []}
                      insumo={it.insumoCodigo ? (insumos || []).find((m) => m && m.codigo === it.insumoCodigo) : null}
                      quantidade={it.quantidade} unitario={it.unitario}
                      aoConverter={(c) => mexerItem(i, { unidade: c.unidade, quantidade: c.quantidade, unitario: c.unitario })}
                      aoMudar={(v) => mexerItem(i, { unidade: v })} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={S.rot}>Preço unitário</div>
                    <CampoNumeroBR estilo={S.input} valor={it.unitario} casas={2} maxCasas={4} placeholder="0,00"
                      aoMudar={(v) => mexerQtdOuPreco(i, { unitario: v })} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={S.rot}>Total do item</div>
                    <div style={{ ...S.input, background: "#f9fafb", fontVariantNumeric: "tabular-nums",
                      display: "flex", alignItems: "center", minHeight: 36 }}>{efDinheiro(bruto)}</div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={S.rot}>Etapa</div>
                    <SelectBusca style={S.input} value={it.etapa}
                      onChange={(v) => mexerItem(i, { etapa: v })}
                      placeholder="Procurar etapa…"
                      opcoes={[{ valor: "", rotulo: "— escolha a etapa —" }]
                        .concat(etapasDaObra.map((e) => ({ valor: e.id, rotulo: e.nome || e.titulo || e.id })))} />
                  </div>
                  <div style={{ minWidth: 0, display: "flex", alignItems: "flex-end" }}>
                    <button type="button" style={{ ...S.btnSec, color: "#dc2626" }}
                      onClick={() => tirarItem(i)}>Tirar</button>
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
            <button type="button" style={S.btnSec} onClick={novoItem}>{itensDoCusto.length ? "+ item" : "Detalhar em itens"}</button>
            {resumoCusto && resumoCusto.itens > 0 && (
              <div style={{ fontSize: 12, color: "#4b5563" }}>
                soma dos itens <b style={{ color: "#111827" }}>{efDinheiro(resumoCusto.bruto)}</b>
                {" · "}pago <b style={{ color: "#111827" }}>{efDinheiro(resumoCusto.pago)}</b>
              </div>
            )}
          </div>

          {/* A diferença entre a soma e o que saiu do banco: para baixo é
              desconto e se rateia; para cima é item faltando, e aí não se
              grava — inventar custo que o papel não tem é pior que travar. */}
          {resumoCusto && resumoCusto.itens > 0 && resumoCusto.desconto >= 0.005 && (
            <div style={{ fontSize: 12, color: "#1e3a5f", marginTop: 8, padding: "8px 10px", borderRadius: 10,
              border: "1px solid rgba(4,116,244,0.3)", background: "#eef5ff" }}>
              A soma passa o pago em <b>{efDinheiro(resumoCusto.desconto)}</b> — entra como desconto,
              espalhado nos itens na proporção de cada um. É o mesmo rateio do pedido da loja.
            </div>
          )}
          {resumoCusto && resumoCusto.itens > 0 && resumoCusto.falta >= 0.005 && (
            <div style={{ fontSize: 12, color: "#b45309", marginTop: 8, padding: "8px 10px", borderRadius: 10,
              border: "1px solid rgba(245,158,11,0.45)", background: "#fffbeb" }}>
              Faltam <b>{efDinheiro(resumoCusto.falta)}</b> para fechar com o que saiu do banco —
              falta item. O que falta não pode virar desconto.
            </div>
          )}
        </div>
      )}

      {/* Lançando "Material" num empreendimento, do outro lado isso se chama
          "Construção". Quem fecha o mês precisa saber disso ANTES de gravar,
          senão vai procurar a vassoura pelo nome errado no extrato. */}
      {naObra && (
        <div style={{ fontSize: 12, lineHeight: 1.5, padding: "10px 12px", borderRadius: 10,
          border: "1px solid rgba(4,116,244,0.35)", background: "#eef5ff", color: "#1e3a5f" }}>
          {!obraAlvo ? (
            <>Escolha o cliente e a obra: este custo nasce na obra, e é de lá que ele atravessa para o extrato do escritório.</>
          ) : destinoDoCusto && destinoDoCusto.conta ? (
            <>
              Entra em <b>{(obraAlvo.nome || "obra")}</b> como custo, e aparece no extrato do
              escritório como <b>{destinoDoCusto.conta}</b> — um valor só, lido dos dois lados.
              A competência sai da data do pagamento.
            </>
          ) : (
            <>
              Entra em <b>{(obraAlvo.nome || "obra")}</b> como custo, mas <b>não</b> atravessa para o
              extrato do escritório:{" "}
              {destinoDoCusto && destinoDoCusto.modo === "clientePaga"
                ? "esta obra está marcada como “cliente paga direto”, então o dinheiro não passa pela conta do escritório."
                : "esta conta não tem correspondência no plano do escritório."}
            </>
          )}
        </div>
      )}
      {/* O comprovante fica guardado no lançamento. Não é obrigatório: a
          linha do extrato vale por si — mas a conciliação de daqui a um ano
          vai querer o papel junto. */}
      <div>
        <div style={S.rot}>
          Documentos — nota fiscal, comprovante, boleto (opcional)
        </div>
        {typeof CampoDocumentos === "function" ? (
          <CampoDocumentos
            anexos={anexosDaTransacao(f)}
            categoria="comprovante_pagamento"
            lendo={lendoComprov}
            aoLerPdf={lerPapel}
            aoLerOutro={lerPapel}
            leFoto={iaDisponivel !== false}
            progresso={progresso}
            rotuloLendo="Lendo o papel…"
            aceita="application/pdf,image/*,.xml,text/xml,application/xml,.txt,text/plain,.eml,.html"
            aoMudar={(lista) => setF((p) => { const novo = comAnexos(p, lista);
              if (!lista.length) { setDivergencia(null); setErroAnexo(""); }
              return novo; })}
            onErro={setErroAnexo} />
        ) : null}
        {erroAnexo && <div style={{ fontSize: 12, color: "#b45309", marginTop: 6 }}>{erroAnexo}</div>}
        {avisosLidos.map((x, k) => <div key={k} style={{ fontSize: 12, color: "#b45309", marginTop: 6 }}>{x}</div>)}
        {divergencia && (
          <div style={{ fontSize: 12, color: "#b45309", marginTop: 6, lineHeight: 1.45 }}>
            O papel não bate com esta linha:
            {divergencia.valor ? ` ele diz ${efDinheiro(divergencia.valor)}` : ""}
            {divergencia.data ? ` ${divergencia.valor ? "e" : "ele diz"} pago em ${typeof dataDoDiaBR === "function" ? dataDoDiaBR(divergencia.data) : divergencia.data}` : ""}
            {divergencia.favorecido ? ` (para ${divergencia.favorecido})` : ""}.
            Confira se é o papel desta linha do extrato — não mexi em nada.
          </div>
        )}
      </div>
      {lida && (
        <div style={{ fontSize: 12, lineHeight: 1.5, padding: "8px 10px", borderRadius: 10, background: "#fff",
          border: "1px solid rgba(38,36,33,0.12)", color: "#374151" }}>
          <b style={{ color: "#111827" }}>
            {lida.papel.tipo === "comprovante" ? "Comprovante" : lida.papel.tipo === "nfse" ? "Nota de serviço"
              : lida.papel.ehNota ? "Nota fiscal" : "Pedido"}{lida.papel.numeroNota || lida.papel.numeroPedido ? " " + (lida.papel.numeroNota || lida.papel.numeroPedido) : ""}
          </b>
          {(lida.papel.fantasia || lida.papel.lidoComo) ? " · " + (lida.papel.fantasia || lida.papel.lidoComo) : ""}
          {lida.papel.cnpj ? " · " + String(lida.papel.cnpj).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : ""}
          {lida.papel.emitido ? " · emitida " + lida.papel.emitido.split("-").reverse().join("/") : ""}
          {lida.papel.valor ? " · " + efDinheiro(lida.papel.valor) : ""}
          {Number(lida.papel.desconto) > 0 ? ` (desconto ${efDinheiro(lida.papel.desconto)})` : ""}
          {lida.itens ? ` · ${lida.itens} ${lida.itens === 1 ? "item" : "itens"}, ${lida.casados} no catálogo` : ""}
          <span style={{ color: "#9ca3af" }}> — lido {lida.origem === "xml" ? "do XML" : lida.origem === "ia" ? "pela IA" : "pelo leitor do VICKE"}</span>
          {lida.cadastro ? <span style={{ color: "#0474f4" }}> · fornecedor {lida.cadastro.nome}</span>
            : (lida.papel.lidoComo && !f.fornecedorId && !novoPrest && (
              <button type="button" style={{ background: "none", border: "none", padding: 0, marginLeft: 6, fontSize: 12, color: "#0474f4",
                cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}
                onClick={() => { setErroPrest(""); setNovoPrest({ nome: lida.papel.fantasia || lida.papel.lidoComo, categoria: "Loja / Comércio",
                  cnpjCpf: lida.papel.cnpj || "" }); }}>
                + cadastrar {lida.papel.fantasia || lida.papel.lidoComo}
              </button>
            ))}
        </div>
      )}
      {!naObra && (f.itens || []).length > 0 && (
        <div style={{ fontSize: 12, lineHeight: 1.5, padding: "8px 10px", borderRadius: 10,
          border: "1px solid rgba(4,116,244,0.3)", background: "#eef5ff", color: "#1e3a5f", display: "grid", gap: 6 }}>
          <div>
            <b>{f.itens.length} {f.itens.length === 1 ? "item" : "itens"} na nota</b>
            {": " + f.itens.slice(0, 4).map((x) => x.descricao).join(" · ") + (f.itens.length > 4 ? " …" : "")}.
            {" "}Se for material de obra, escolha a obra: o custo entra nela por etapa, item a item, com o catálogo.
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {obrasCitadas.map((o) => (
              <button key={o.id} type="button" style={{ ...S.btnSec, padding: "4px 10px", fontSize: 12, color: "#0474f4",
                borderColor: "rgba(4,116,244,0.4)" }} onClick={() => escolherObra(o)}>{o.nome}</button>
            ))}
            <div style={{ minWidth: 200, flex: "1 1 200px" }}>
              <SelectBusca style={S.input} value=""
                onChange={(v) => escolherObra((obras || []).find((o) => o && o.id === v))}
                placeholder="Procurar obra…"
                opcoes={[{ valor: "", rotulo: obrasCitadas.length ? "outra obra…" : "escolher a obra…" }]
                  .concat((obras || []).filter((o) => o && o.nome).map((o) => ({ valor: o.id, rotulo: o.nome })))} />
            </div>
          </div>
        </div>
      )}
      {noCartao && planoCartao.length > 0 && (
        <div style={{ fontSize: 12, color: "#4b5563" }}>
          Cai nas faturas de <b>{planoCartao.map((x) => `${mesAnoPorExtenso(x.competencia)} (${efDinheiro(x.valor)})`).join(" · ")}</b>.
          {" "}{naObra ? "O custo da obra é integral nesta data;" : "A compra conta na conta escolhida;"} o
          extrato do escritório recebe quando você fechar a fatura, em Cartões.
        </div>
      )}
      {tentou && todosErros.length > 0 && (
        <div style={{ fontSize: 12, color: "#b91c1c" }}>{todosErros.join(" · ")}</div>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
        {atalhos && <span style={{ fontSize: 11, color: "#9ca3af", marginRight: "auto" }}>Enter lança · Esc fecha</span>}
        <button style={EF_ESTILO.btnSec} onClick={aoCancelar}>Cancelar</button>
        <button style={EF_ESTILO.btn} onClick={salvar}>{rotuloSalvar || "Salvar"}</button>
      </div>
    </div>
  );
}

// A aba inteira. O extrato é o que se olha todo dia; a lista é onde se
// lança; a importação é a porta de entrada do histórico da planilha.

// Painel de entrada do Financeiro: o mês corrente em quatro números.
// Sem abas e sem botões — quem quiser detalhe vai pelo menu lateral.
function ResumoEscritorioPainel({ resumo, quantidade, aoVerExtrato }) {
  const S = EF_ESTILO;
  if (!resumo) {
    return (
      <div style={{ ...S.card, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
        Nenhum lançamento ainda. Traga o histórico em <strong>Importar</strong>, no menu ao lado.
      </div>
    );
  }
  const anterior = resumo.mesAnterior ? efMesPorExtenso(resumo.mesAnterior).split(" de ")[0] : "";
  const comparacao = (v) => {
    if (v == null || !anterior) return "";
    const p = Math.round(Math.abs(v) * 100);
    if (!p) return `no mesmo nível de ${anterior}`;
    return `${p}% ${v > 0 ? "acima" : "abaixo"} de ${anterior}`;
  };
  const cartao = (rotulo, valor, apoio, destaque) => (
    <div key={rotulo} style={{ ...S.card, display: "grid", gap: 2 }}>
      <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .5, color: "#6b7280" }}>{rotulo}</div>
      <div style={{ fontSize: destaque ? 26 : 20, fontWeight: 700, marginTop: 2, fontVariantNumeric: "tabular-nums",
        color: destaque ? "#0474f4" : "#262421" }}>{valor}</div>
      <div style={{ fontSize: 11.5, color: "#6b7280" }}>{apoio}</div>
    </div>
  );
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{efMesPorExtenso(resumo.mes).replace(/^./, (c) => c.toUpperCase())}</div>
        <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 2 }}>
          {quantidade} lançamentos no histórico
          {resumo.futuro ? ` · já inclui competências até ${efMesPorExtenso(resumo.futuro.ate, true)}` : ""}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        {cartao("Saldo do extrato", efDinheiro(resumo.saldo), `fechamento de ${efMesPorExtenso(resumo.mes, true)}`, true)}
        {cartao("Receitas do mês", efDinheiro(resumo.receitas), comparacao(resumo.variacao.receitas) || "projetos, gestão, comissões")}
        {cartao("Despesas do mês", efDinheiro(resumo.despesas), comparacao(resumo.variacao.despesas) || "custo do escritório")}
        {cartao("Resultado do mês", efDinheiro(resumo.resultado), comparacao(resumo.variacao.resultado) || "antes das retiradas")}
      </div>
      <div style={{ ...S.card, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", fontSize: 12.5, color: "#4b5563" }}>
        <span>Retiradas no mês: <strong style={{ color: "#262421" }}>{efDinheiro(resumo.retiradas)}</strong></span>
        {resumo.futuro && (
          <span>Saldo previsto até {efMesPorExtenso(resumo.futuro.ate, true)}: <strong style={{ color: "#262421" }}>{efDinheiro(resumo.futuro.saldo)}</strong></span>
        )}
        {aoVerExtrato && (
          <button onClick={aoVerExtrato} style={{ ...S.btnSec, marginLeft: "auto" }}>Ver o extrato completo</button>
        )}
      </div>
    </div>
  );
}



// Quadro dos empreendimentos: quanto já foi investido em cada um e o que
// sobrou quando vendeu. Enquanto não vende, resultado não existe — é imóvel
// parado, não lucro nem prejuízo.
function EmpreendimentosQuadro({ data, lancs, aoFiltrar }) {
  const S = EF_ESTILO;
  const lista = empreendimentosDoData(data);
  if (!lista.length) return null;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>Empreendimentos</div>
      <div style={S.quadro}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
          <thead>
            <tr>
              {["Empreendimento", "Investido", "Recebido em vendas", "Resultado", ""].map((h, i) => (
                <th key={i} style={{ textAlign: i === 0 || i === 4 ? "left" : "right", padding: "8px 12px",
                  fontSize: 11, color: "#6b7280", fontWeight: 600, borderBottom: "1px solid rgba(38,36,33,0.12)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => {
              // "Em andamento" desmarcado no cadastro = empreendimento fechado.
              const r = resultadoEmpreendimento(lancs, c.id, { concluido: c.ativo === false });
              return (
                <tr key={c.id} style={{ borderTop: "1px solid rgba(38,36,33,0.06)" }}>
                  <td style={{ padding: "7px 12px" }}>{c.nome}</td>
                  <td style={{ padding: "7px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{efDinheiro(r.investido)}</td>
                  <td style={{ padding: "7px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {r.recebido ? efDinheiro(r.recebido) : "—"}
                  </td>
                  <td style={{ padding: "7px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums",
                    color: r.resultado == null ? "#6b7280" : "#0474f4" }}>
                    {r.resultado != null ? efDinheiro(r.resultado)
                      : (r.parcial ? "venda em curso" : "em andamento")}
                  </td>
                  <td style={{ padding: "5px 12px" }}>
                    {aoFiltrar && <button style={S.btnSec} onClick={() => aoFiltrar(c.id)}>Ver lançamentos</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: "#6b7280" }}>
        O investido não entra no resultado do mês. Enquanto houver unidade por vender, o que entra é
        recebimento, não lucro — o resultado é apurado quando você desmarca “Em andamento” no cadastro.
      </div>
    </div>
  );
}

// ── Painel do financeiro ────────────────────────────────────────
// A tela de entrada: filtro em cima, os números do recorte no meio e o
// caminho para lançar, ver o extrato e fechar o mês.
function EFSeletor({ rotulo, valor, aoTrocar, opcoes }) {
  return (
    <label style={{ display: "grid", gap: 3 }}>
      <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .5, color: "#6b7280" }}>{rotulo}</span>
      <Selecao value={valor} onChange={(e) => aoTrocar(e.target.value)}
        style={{ ...EF_ESTILO.input, padding: "7px 10px", minWidth: 130, cursor: "pointer" }}>
        {opcoes.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
      </Selecao>
    </label>
  );
}

function PainelFinanceiroEscritorio({ lancs, linhas, fechamentos, filtro, aoFiltrar, aoIr, dadosDoPainel }) {
  const S = EF_ESTILO;
  const anos = [...new Set((linhas || []).map((l) => l.mes.slice(0, 4)))].sort();
  const doFiltro = filtrarLancamentosEscritorio(lancs, filtro);
  // o resultado olha a fatura aberta nas compras; a lista continua com uma linha
  const r = resumoDoPeriodoEscritorio(filtrarLancamentosEscritorio(lancamentosParaResultado(lancs), filtro));
  const unidade = UNIDADES_NEGOCIO.find((u) => u.id === filtro.unidadeId);

  // Saldo do extrato: é do banco inteiro, então só faz sentido sem recorte
  // de unidade. Mostra o saldo do último mês dentro do período filtrado.
  const dentro = (linhas || []).filter((l) => {
    const [a, m] = l.mes.split("-");
    if (filtro.ano && a !== filtro.ano) return false;
    if (filtro.mes && m !== filtro.mes) return false;
    return true;
  });
  const fim = dentro.length ? dentro[dentro.length - 1] : null;
  const fechadoAte = ultimoMesFechado(fechamentos);

  const periodo = filtro.mes
    ? efMesPorExtenso(`${filtro.ano || anos[anos.length - 1]}-${filtro.mes}`)
    : (filtro.ano ? `ano de ${filtro.ano}` : "todo o histórico");

  const cartao = (rotulo, valor, apoio, destaque) => (
    <div key={rotulo} style={{ ...S.card, display: "grid", gap: 2 }}>
      <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .5, color: "#6b7280" }}>{rotulo}</div>
      <div style={{ fontSize: destaque ? 24 : 19, fontWeight: 700, marginTop: 2, fontVariantNumeric: "tabular-nums",
        color: destaque ? "#0474f4" : "#262421" }}>{valor}</div>
      <div style={{ fontSize: 11.5, color: "#6b7280" }}>{apoio}</div>
    </div>
  );

  const porGrupo = GRUPOS_ESCRITORIO
    .map((g) => ({ grupo: g, contas: r.contas.filter((c) => c.grupo === g.id) }))
    .filter((b) => b.contas.length);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Filtro + caminhos */}
      <div style={{ ...S.card, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <EFSeletor rotulo="Ano" valor={filtro.ano} aoTrocar={(v) => aoFiltrar({ ...filtro, ano: v })}
          opcoes={[["", "Todos"], ...anos.map((a) => [a, a])]} />
        <EFSeletor rotulo="Mês" valor={filtro.mes} aoTrocar={(v) => aoFiltrar({ ...filtro, mes: v })}
          opcoes={[["", "Todos"], ...Array.from({ length: 12 }, (_, i) => {
            const m = String(i + 1).padStart(2, "0");
            return [m, efMesPorExtenso(`2000-${m}`).split(" de ")[0].replace(/^./, (c) => c.toUpperCase())];
          })]} />
        <EFSeletor rotulo="Unidade de negócio" valor={filtro.unidadeId} aoTrocar={(v) => aoFiltrar({ ...filtro, unidadeId: v })}
          opcoes={[["", "Todas"], ...UNIDADES_NEGOCIO.map((u) => [u.id, u.nome])]} />
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={S.btnSec} onClick={() => aoIr("base")}>Base de dados</button>
          <button style={S.btnSec} onClick={() => aoIr("extrato")}>Extrato</button>
          <button style={S.btn} onClick={() => aoIr("fechamento")}>Fechamento</button>
        </div>
      </div>

      {!doFiltro.length ? (
        <div style={{ ...S.card, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
          Nenhum lançamento em {periodo}{unidade ? ` para ${unidade.nome}` : ""}.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {periodo.replace(/^./, (c) => c.toUpperCase())}{unidade ? ` · ${unidade.nome}` : ""}
            </div>
            <div style={{ fontSize: 12.5, color: "#6b7280" }}>
              {r.quantidade} lançamentos
              {fechadoAte ? ` · fechado até ${efMesPorExtenso(fechadoAte, true)}` : " · nenhum mês fechado ainda"}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 12 }}>
            {!unidade && fim
              ? cartao("Saldo do extrato", efDinheiro(fim.saldoExtrato), `fechamento de ${efMesPorExtenso(fim.mes, true)}`, true)
              : cartao("Movimento no período", efDinheiro(r.receitas + r.entradasGestao + r.vendasEmpreendimento),
                  "entradas — o saldo do banco não se divide por unidade", true)}
            {cartao("Receitas", efDinheiro(r.receitas), "projetos, gestão, comissões")}
            {cartao("Despesas", efDinheiro(r.despesas), "custo do escritório")}
            {cartao("Resultado", efDinheiro(r.resultado), "antes das retiradas")}
            {cartao("Retiradas", efDinheiro(r.retiradas), "sócios e empréstimos")}
            {(r.entradasGestao || r.saidasGestao) ? cartao("Dinheiro de cliente",
              efDinheiro(Math.abs(r.saldoGestao)),
              `entrou ${efDinheiro(r.entradasGestao)} · saiu ${efDinheiro(r.saidasGestao)}`) : null}
            {(r.investimentoEmpreendimento || r.vendasEmpreendimento) ? cartao("Empreendimento",
              efDinheiro(r.vendasEmpreendimento - r.investimentoEmpreendimento),
              `investido ${efDinheiro(r.investimentoEmpreendimento)} · vendido ${efDinheiro(r.vendasEmpreendimento)}`) : null}
          </div>

          {/* Conferência em dia: a régua do fechamento, vista todo dia. */}
          {(() => {
            const emFoco = filtro.mes ? `${filtro.ano || anos[anos.length - 1]}-${filtro.mes}` : (fim ? fim.mes : "");
            if (!emFoco) return null;
            const c = conferenciaDoMes(lancs, emFoco);
            if (!c.total) return null;
            const pronto = !c.pendentes;
            return (
              <div style={{ ...S.card, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, color: "#4b5563" }}>
                <span>Conferência de {efMesPorExtenso(emFoco, true)}:{" "}
                  <strong style={{ color: pronto ? "#0474f4" : "#262421" }}>{c.conferidos} de {c.total}</strong> no extrato do banco</span>
                {!pronto && <span>falta conferir {efDinheiro(c.valorPendente)}</span>}
                <div style={{ flex: 1, minWidth: 120, height: 5, borderRadius: 3, background: "#eef2f7", overflow: "hidden" }}>
                  <div style={{ width: `${Math.round((c.conferidos / c.total) * 100)}%`, height: "100%", background: "#0474f4" }} />
                </div>
                <button style={S.btnSec} onClick={() => aoIr("fechamento", emFoco)}>
                  {pronto ? "Fechar o mês" : "Continuar conferindo"}
                </button>
              </div>
            );
          })()}

          <EmpreendimentosQuadro data={dadosDoPainel} lancs={lancs}
            aoFiltrar={() => aoFiltrar({ ...filtro, unidadeId: "empreendimento" })} />

          <div style={S.quadro}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
              <tbody>
                {porGrupo.map((b) => (
                  <Fragment key={b.grupo.id}>
                    <tr>
                      <td colSpan={2} style={{ padding: "8px 12px", fontWeight: 700, background: "#f5f7fa",
                        borderTop: "1px solid rgba(38,36,33,0.12)" }}>{b.grupo.titulo}</td>
                    </tr>
                    {b.contas.map((c) => (
                      <tr key={c.contaId} style={{ borderTop: "1px solid rgba(38,36,33,0.06)" }}>
                        <td style={{ padding: "7px 12px", color: "#4b5563" }}>{c.sinal < 0 ? "− " : "+ "}{c.nome}</td>
                        <td style={{ padding: "7px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{efDinheiro(c.valor)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}


// Barra do mapa de colunas: mostra o que foi reconhecido e deixa corrigir.
// Reconhecer errado em silêncio é pior do que perguntar.
function MapaDeColunas({ mapa, aoCorrigir }) {
  const S = EF_ESTILO;
  if (!mapa) return null;
  const campos = [["data", "Data"], ["valor", "Valor"], ["debito", "Débito"], ["credito", "Crédito"],
    ["historico", "Histórico"], ["complemento", "Complemento"], ["documento", "Documento"]];
  const largura = Math.max(mapa.cabecalho.length, ...mapa.perfis.map((_, i) => i + 1));
  const opcoes = [["", "—"]].concat(Array.from({ length: largura }, (_, i) =>
    [String(i), `${String.fromCharCode(65 + i)}${mapa.cabecalho[i] ? " · " + mapa.cabecalho[i] : ""}`]));
  const duvidoso = campos.some(([k]) => mapa.colunas[k] != null && (mapa.confianca[k] != null && mapa.confianca[k] < 0.3));
  return (
    <div style={{ ...S.card, display: "grid", gap: 10 }}>
      <div style={{ fontSize: 12.5, color: "#4b5563" }}>
        {mapa.lembrado
          ? "Reconheci este formato de outras vezes."
          : "Reconheci as colunas pelo conteúdo do arquivo."}
        {duvidoso ? " Confira as que ficaram em dúvida." : " Se alguma estiver trocada, corrija aqui."}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {campos.filter(([k]) => mapa.colunas[k] != null || ["data", "valor", "historico"].includes(k)).map(([k, r]) => (
          <label key={k} style={{ display: "grid", gap: 3 }}>
            <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .5, color: "#6b7280" }}>{r}</span>
            <Selecao value={mapa.colunas[k] == null ? "" : String(mapa.colunas[k])}
              onChange={(e) => aoCorrigir(k, e.target.value === "" ? null : Number(e.target.value))}
              style={{ ...S.input, padding: "7px 10px", minWidth: 150, cursor: "pointer",
                borderColor: (mapa.confianca[k] != null && mapa.confianca[k] < 0.3) ? "#f59e0b" : "rgba(38,36,33,0.18)" }}>
              {opcoes.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </Selecao>
          </label>
        ))}
      </div>
    </div>
  );
}

// A conferência contra o extrato: as duas filas que o fechamento precisa.
// ── A fila do extrato ───────────────────────────────────────────
// O que veio no banco e ainda não está na base, lançado ali mesmo: clicar na
// linha abre o formulário embaixo dela, já com data, valor e competência do
// fechamento; gravar tira a linha da fila e abre a seguinte. A linha igual à
// do mês passado vai num clique; várias iguais (tarifas) vão de uma vez.
function FilaDoExtrato({ linhas, naoLancar, fila, ocupado }) {
  const S = EF_ESTILO;
  const [aberto, setAberto] = useState("");
  const [motivo, setMotivo] = useState({});      // id → por que não foi direto
  const [marcados, setMarcados] = useState({});
  const [contaLote, setContaLote] = useState("");
  const [erroLote, setErroLote] = useState("");
  const [verIgnorados, setVerIgnorados] = useState(false);
  const lista = (linhas || []).filter((m) => m && m.id);
  const ids = lista.map((m) => m.id);
  const proximaDe = (id) => { const k = ids.indexOf(id); return ids[k + 1] || ids[k - 1] || ""; };
  const dataBR = (d) => String(d || "").slice(0, 10).split("-").reverse().join("/");
  const escolhidos = lista.filter((m) => marcados[m.id]);
  const totalLote = escolhidos.reduce((s, m) => s + Math.abs(Number(m.valor) || 0), 0);
  // A conta do lote segue o lado do dinheiro: saída só oferece despesa,
  // entrada só receita. Misturado, oferece tudo.
  const lados = new Set(escolhidos.map((m) => (Number(m.valor) < 0 ? -1 : 1)));
  const contasLote = contasDoLancamento("escritorio", {}).escritorio.filter((c) => {
    const g = grupoEscritorio(c.grupo);
    return lados.size !== 1 || !g || g.sinal === [...lados][0];
  });

  // Do formulário, segue para a próxima linha; do "Lançar assim", não abre nada.
  function lancar(m, l, seguir) {
    const prox = proximaDe(m.id);
    if (fila.lancar(l) === false) return;
    setMarcados((x) => { const n = { ...x }; delete n[m.id]; return n; });
    setMotivo((x) => { const n = { ...x }; delete n[m.id]; return n; });
    if (seguir) setAberto(prox);
  }
  function rapido(m) {
    const r = fila.rapido(m);
    if (r && r.lancamento) { lancar(m, r.lancamento, false); return; }
    setMotivo((x) => ({ ...x, [m.id]: (r && r.erro) || "" }));
    setAberto(m.id);
  }
  function lancarLote() {
    setErroLote("");
    if (!contaLote) { setErroLote("Escolha a conta."); return; }
    const r = fila.lancarVarias(escolhidos, contaLote, "escritorio");
    if (r && r.erro) { setErroLote(r.erro); return; }
    if (escolhidos.some((m) => m.id === aberto)) setAberto("");
    setMarcados({}); setContaLote("");
  }
  function marcarTudo(v) {
    setMarcados(v ? Object.fromEntries(ids.map((id) => [id, true])) : {});
  }
  // As que já têm classificação pronta (a mesma do mês passado, e que valida
  // sozinha): todas de uma vez, numa gravada só.
  const prontas = lista.filter((m) => { const r = fila.rapido(m); return r && r.lancamento; });
  function lancarSugeridas() {
    setErroLote("");
    const r = fila.lancarSugeridas(prontas);
    if (r && r.erro) { setErroLote(r.erro); return; }
    if (prontas.some((m) => m.id === aberto)) setAberto("");
    setMarcados({});
  }

  const dinheiro = (m) => (
    <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", fontWeight: 600,
      color: Number(m.valor) < 0 ? "#262421" : "#0474f4" }}>
      {efDinheiro(Math.abs(Number(m.valor) || 0))}
      <span style={{ fontSize: 10.5, fontWeight: 500, color: "#9ca3af", marginLeft: 5 }}>{Number(m.valor) < 0 ? "saída" : "entrada"}</span>
    </span>
  );

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {lista.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Falta lançar</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {lista.length} {lista.length === 1 ? "linha" : "linhas"} do banco · clique na linha para lançar
          </div>
          {prontas.length > 1 && (
            <button style={{ ...S.btnSec, padding: "5px 12px", fontSize: 12, color: "#0474f4", borderColor: "rgba(4,116,244,0.4)",
              opacity: ocupado ? .45 : 1 }} disabled={!!ocupado} onClick={lancarSugeridas}>
              ✓ Lançar as {prontas.length} sugeridas
            </button>
          )}
          <label style={{ marginLeft: "auto", fontSize: 12, color: "#4b5563", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={escolhidos.length === lista.length && lista.length > 0}
              onChange={(e) => marcarTudo(e.target.checked)} />
            Marcar todas
          </label>
        </div>
      )}

      {erroLote && !escolhidos.length && <div style={{ fontSize: 12, color: "#b45309" }}>{erroLote}</div>}
      {escolhidos.length > 0 && (
        <div style={{ ...S.card, padding: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
          borderColor: "rgba(4,116,244,0.35)", background: "#f7fbff" }}>
          <span style={{ fontSize: 12.5 }}>
            <b>{escolhidos.length}</b> {escolhidos.length === 1 ? "linha" : "linhas"} · {efDinheiro(totalLote)}
          </span>
          <Selecao style={{ ...S.input, width: "auto", minWidth: 200, flex: "1 1 200px", cursor: "pointer" }}
            value={contaLote} onChange={(e) => setContaLote(e.target.value)}>
            <option value="">— conta para todas —</option>
            {GRUPOS_ESCRITORIO.map((g) => {
              const doGrupo = contasLote.filter((c) => c.grupo === g.id);
              if (!doGrupo.length) return null;
              return <optgroup key={g.id} label={g.titulo}>
                {doGrupo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </optgroup>;
            })}
          </Selecao>
          <button style={{ ...S.btn, opacity: ocupado ? .45 : 1 }} disabled={!!ocupado} onClick={lancarLote}>
            Lançar {escolhidos.length === 1 ? "a linha" : `as ${escolhidos.length}`}
          </button>
          <button style={S.btnSec} onClick={() => setMarcados({})}>Limpar</button>
          {erroLote && <div style={{ flexBasis: "100%", fontSize: 12, color: "#b45309" }}>{erroLote}</div>}
          <div style={{ flexBasis: "100%", fontSize: 11.5, color: "#6b7280" }}>
            Para o que é do escritório e não pede cliente — tarifa, água, aluguel. Cada linha vira um lançamento, já conferido.
          </div>
        </div>
      )}

      {lista.length > 0 && (
        <div style={{ ...S.quadro, overflow: "visible" }}>
          {lista.map((m, k) => {
            const sug = fila.sugestao(m);
            const contaSug = sug && sug.campos && sug.campos.contaId ? contaEscritorio(sug.campos.contaId) : null;
            const aberta = aberto === m.id;
            const entreContas = pareceEntreContas(m.historico);
            return (
              <div key={m.id} style={{ borderTop: k ? "1px solid rgba(38,36,33,0.08)" : "none",
                background: aberta ? "#f7fbff" : "transparent" }}>
                <div onClick={() => setAberto(aberta ? "" : m.id)}
                  style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 12px", cursor: "pointer", flexWrap: "wrap" }}>
                  <input type="checkbox" checked={!!marcados[m.id]} onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setMarcados((x) => ({ ...x, [m.id]: e.target.checked }))} style={{ marginTop: 3 }} />
                  <div style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap", paddingTop: 1 }}>{dataBR(m.data)}</div>
                  <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: "#262421", overflowWrap: "anywhere" }}>{m.historico || m.documento || "—"}</div>
                    {entreContas && !contaSug && (
                      <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>
                        parece transferência entre contas suas — não entra no resultado
                      </div>
                    )}
                    {contaSug && (
                      <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>
                        como em {dataBR(sug.de.lancadoEm) || "lançamento anterior"}: <b style={{ color: "#374151" }}>{contaSug.nome}</b>
                        {sug.campos.cliente ? ` · ${sug.campos.cliente}` : ""}
                      </div>
                    )}
                  </div>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {dinheiro(m)}
                    {contaSug && !sug.daObra && !aberta && (
                      <button style={{ ...S.btnSec, padding: "5px 10px", fontSize: 12, color: "#0474f4", borderColor: "rgba(4,116,244,0.4)" }}
                        disabled={!!ocupado}
                        onClick={(e) => { e.stopPropagation(); rapido(m); }}>✓ Lançar assim</button>
                    )}
                    <button style={{ ...S.btnSec, padding: "5px 10px", fontSize: 12 }}
                      onClick={(e) => { e.stopPropagation(); setAberto(aberta ? "" : m.id); }}>{aberta ? "Fechar" : "Lançar"}</button>
                    {entreContas && !contaSug ? (
                      <button style={{ ...S.btnSec, padding: "5px 10px", fontSize: 12, color: "#0474f4", borderColor: "rgba(4,116,244,0.4)" }}
                        onClick={(e) => { e.stopPropagation(); if (aberta) setAberto(proximaDe(m.id)); fila.naoE(m, "transferência entre contas"); }}>
                        ✓ Não é lançamento
                      </button>
                    ) : (
                      <button style={{ background: "none", border: "none", padding: "5px 2px", fontSize: 11.5, color: "#6b7280",
                        cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}
                        onClick={(e) => { e.stopPropagation(); if (aberta) setAberto(proximaDe(m.id)); fila.naoE(m); }}>
                        Não é lançamento
                      </button>
                    )}
                  </div>
                </div>
                {aberta && (
                  <div style={{ padding: "0 12px 12px" }}>
                    {motivo[m.id] && (
                      <div style={{ fontSize: 12, color: "#b45309", margin: "0 0 8px" }}>
                        Não deu para lançar direto: {motivo[m.id]}
                      </div>
                    )}
                    <FormLancamentoEscritorio key={m.id} {...fila.formProps}
                      inicial={fila.inicial(m)} competenciaFixa={fila.mes}
                      titulo={`Lançar · ${dataBR(m.data)}`} rotuloSalvar="Lançar e seguir" atalhos
                      aoSalvar={(l) => lancar(m, l, true)} aoCancelar={() => setAberto("")} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(naoLancar || []).length > 0 && (
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          <button style={{ background: "none", border: "none", padding: 0, fontSize: 12, color: "#6b7280",
            cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}
            onClick={() => setVerIgnorados((v) => !v)}>
            {verIgnorados ? "Esconder" : "Ver"} {naoLancar.length} {naoLancar.length === 1 ? "linha marcada" : "linhas marcadas"} como “não é lançamento”
          </button>
          {verIgnorados && (
            <div style={{ ...S.quadro, marginTop: 6 }}>
              {naoLancar.map((m, k) => (
                <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "7px 12px",
                  borderTop: k ? "1px solid rgba(38,36,33,0.06)" : "none" }}>
                  <span style={{ whiteSpace: "nowrap" }}>{dataBR(m.data)}</span>
                  <span style={{ flex: "1 1 200px", color: "#4b5563", overflowWrap: "anywhere" }}>{m.historico || m.documento || "—"}
                    {m.motivo && m.motivo !== "não é lançamento" ? <span style={{ color: "#9ca3af" }}> · {m.motivo}</span> : null}</span>
                  {dinheiro(m)}
                  <button style={{ ...S.btnSec, padding: "4px 10px", fontSize: 11.5 }} onClick={() => fila.naoE(m)}>Desfazer</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConferenciaComExtrato({ resultado, mapa, aoCorrigir, aoLancar, aoMarcarCasados, aoDescartar, ocupado, fila }) {
  const S = EF_ESTILO;
  if (!resultado) return null;
  const r = resultado.resumo;
  const semConferir = (resultado.casados || []).filter((c) => c && c.lancamento && !c.lancamento.conferido).length;
  const cartao = (rot, n, apoio, cor) => (
    <div key={rot} style={{ ...S.card, display: "grid", gap: 2 }}>
      <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .5, color: "#6b7280" }}>{rot}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: cor || "#262421" }}>{n}</div>
      <div style={{ fontSize: 11.5, color: "#6b7280" }}>{apoio}</div>
    </div>
  );
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <MapaDeColunas mapa={mapa} aoCorrigir={aoCorrigir} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        {cartao("Casaram", r.casados, `de ${r.movimentos} movimentos do banco`, "#0474f4")}
        {cartao("No banco, falta lançar", r.noBanco, efDinheiro(r.valorNoBanco))}
        {cartao("Lançado, não veio no banco", r.contabilizado, efDinheiro(r.valorContabilizado))}
        {cartao("Fora da conta", r.ignoradas + (r.naoLancar || 0), "saldo, aplicação, o que não é lançamento")}
      </div>

      {/* Só os que bateram e ainda não estão conferidos: o que nasceu da
          fila já entra conferido e não pede mais clique. */}
      {semConferir > 0 && (
        <div style={{ ...S.card, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, color: "#4b5563" }}>
          <span>{semConferir === 1 ? "1 movimento bateu" : `${semConferir} movimentos bateram`} com lançamentos já registrados.</span>
          <button style={{ ...S.btn, marginLeft: "auto", opacity: ocupado ? .45 : 1 }} disabled={!!ocupado}
            onClick={aoMarcarCasados}>{semConferir === 1 ? "Marcar como conferido" : `Marcar os ${semConferir} como conferidos`}</button>
        </div>
      )}

      {fila ? (
        <FilaDoExtrato linhas={resultado.noBancoSemPar} naoLancar={resultado.naoLancar} fila={fila} ocupado={ocupado} />
      ) : resultado.noBancoSemPar.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>No extrato e ainda não contabilizado</div>
          <div style={S.quadro}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
              <tbody>
                {resultado.noBancoSemPar.map((m, i) => (
                  <tr key={i} style={{ borderTop: "1px solid rgba(38,36,33,0.06)" }}>
                    <td style={{ padding: "7px 12px", whiteSpace: "nowrap", color: "#6b7280" }}>
                      {String(m.data || "").split("-").reverse().join("/")}
                    </td>
                    <td style={{ padding: "7px 12px" }}>{m.historico || m.documento || "—"}</td>
                    <td style={{ padding: "7px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      {efDinheiro(Math.abs(m.valor))}
                    </td>
                    <td style={{ padding: "5px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <button style={S.btnSec} onClick={() => aoLancar(m)}>Lançar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {resultado.contabilizadoSemPar.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Contabilizado e não apareceu no extrato</div>
          <div style={S.quadro}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
              <tbody>
                {resultado.contabilizadoSemPar.map((l) => (
                  <tr key={l.id} style={{ borderTop: "1px solid rgba(38,36,33,0.06)" }}>
                    <td style={{ padding: "7px 12px", color: "#6b7280", whiteSpace: "nowrap" }}>
                      {(contaEscritorio(l.contaId) || {}).nome || "—"}
                    </td>
                    <td style={{ padding: "7px 12px" }}>{l.descricao || l.fornecedor || "—"}</td>
                    <td style={{ padding: "7px 12px", color: "#6b7280" }}>{[l.cliente, l.projeto].filter(Boolean).join(" · ")}</td>
                    <td style={{ padding: "7px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      {efValorDoLancamento(l)}
                    </td>
                    <td style={{ padding: "5px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <button style={S.btnSec} onClick={() => aoDescartar(l)}>Não passou pela conta</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11.5, color: "#6b7280" }}>
            Pode ser compra parcelada a vencer, pagamento agendado ou algo que não passa pela conta do escritório.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Fechamento do mês ───────────────────────────────────────────
// Conferência item a item contra o extrato do banco. Enquanto a diferença
// não zera, o mês não fecha; depois de fechado, não entra lançamento nele.
function FechamentoEscritorioTela({ lancs, linhas, fechamentos, mes, aoTrocarMes, aoMarcar, aoMarcarTodos, aoFechar, aoReabrir, ocupado, extrato }) {
  const S = EF_ESTILO;
  // A conferência é feita ao longo do mês, com o extrato parcial: por isso
  // a tela abre mostrando só o que ainda falta bater.
  const [soPendentes, setSoPendentes] = useState(true);
  const meses = (linhas || []).map((l) => l.mes);
  const linha = (linhas || []).find((l) => l.mes === mes);
  const conf = conferenciaDoMes(lancs, mes);
  const registro = (fechamentos || {})[mes] || {};
  const fechado = mesEstaFechado(mes, fechamentos);
  // O saldo do banco: o que foi informado ao fechar; sem ele, o da última
  // linha SALDO do extrato do mês — o arquivo já traz o número.
  const saldoLido = extrato && extrato.saldoLido != null ? extrato.saldoLido : null;
  const bancoInicial = (reg) => (reg.saldoBanco != null ? String(reg.saldoBanco).replace(".", ",")
    : saldoLido != null ? saldoLido.toFixed(2).replace(".", ",") : "");
  const [banco, setBanco] = useState(() => bancoInicial(registro));
  useEffect(() => {
    setBanco(bancoInicial((fechamentos || {})[mes] || {}));
  }, [mes, fechamentos, saldoLido]);
  const bancoDoExtrato = registro.saldoBanco == null && saldoLido != null && efNumero(banco) === saldoLido;
  const saldoBanco = efNumero(banco);
  const calculado = linha ? linha.saldoExtrato : 0;
  const diferenca = diferencaDeFechamento(calculado, saldoBanco == null ? "" : saldoBanco);
  const podeFechar = !fechado && diferenca === 0 && !ocupado;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ ...S.card, display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
        <EFSeletor rotulo="Mês" valor={mes} aoTrocar={aoTrocarMes}
          opcoes={meses.slice().sort((a, b) => String(b).localeCompare(String(a)))
            .map((m) => [m, efMesPorExtenso(m) + (mesEstaFechado(m, fechamentos) ? " ✓" : "")])} />
        <div style={{ display: "grid", gap: 3 }}>
          <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .5, color: "#6b7280" }}>Saldo do banco</span>
          <input style={{ ...S.input, maxWidth: 160 }} inputMode="decimal" value={banco} placeholder="0,00"
            disabled={fechado} onChange={(e) => setBanco(e.target.value)} />
          {bancoDoExtrato && <span style={{ fontSize: 10.5, color: "#6b7280" }}>lido do extrato</span>}
        </div>
        <div style={{ display: "grid", gap: 3 }}>
          <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .5, color: "#6b7280" }}>Saldo calculado</span>
          <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums", padding: "6px 0" }}>{efDinheiro(calculado)}</div>
        </div>
        <div style={{ display: "grid", gap: 3 }}>
          <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .5, color: "#6b7280" }}>Diferença</span>
          <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums", padding: "6px 0",
            color: diferenca === 0 ? "#0474f4" : (diferenca == null ? "#6b7280" : "#b45309") }}>
            {diferenca == null ? "informe o saldo" : efDinheiro(diferenca)}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {ocupado && <span style={{ fontSize: 12, color: "#6b7280" }}>{ocupado}</span>}
          {fechado ? (
            <button style={S.btnSec} onClick={() => aoReabrir(mes)}>Reabrir mês</button>
          ) : (
            <button style={{ ...S.btn, opacity: podeFechar ? 1 : .45 }} disabled={!podeFechar}
              onClick={() => aoFechar(mes, saldoBanco)}>Fechar {efMesPorExtenso(mes, true)}</button>
          )}
        </div>
      </div>

      {/* Trazer o extrato do banco: o arquivo vem como o banco manda e o
          reconhecimento das colunas é por conteúdo. */}
      {extrato && (
        <div style={{ ...S.card, display: "grid", gap: 10 }}>
          <div
            onDragOver={(e) => { e.preventDefault(); extrato.setArrastando(true); }}
            onDragLeave={(e) => { if (e.currentTarget === e.target) extrato.setArrastando(false); }}
            onDrop={(e) => { e.preventDefault(); extrato.receber(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); }}
            onClick={() => extrato.entrada.current && extrato.entrada.current.click()}
            style={{
              border: `1.5px dashed ${extrato.arrastando ? "#0474f4" : "rgba(38,36,33,0.22)"}`,
              background: extrato.arrastando ? "#eef5ff" : "#fff",
              borderRadius: 14, padding: "20px 16px", textAlign: "center", cursor: "pointer",
            }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: extrato.arrastando ? "#0474f4" : "#262421" }}>
              {extrato.arrastando ? "Pode soltar" : "Arraste aqui o extrato do banco"}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              {extrato.origem ? `Li de ${extrato.origem}`
                : extrato.guardado ? `Extrato guardado${extrato.guardado.origem ? ` (${extrato.guardado.origem})` : ""}, de ${String(extrato.guardado.atualizadoEm || "").slice(0, 10).split("-").reverse().join("/")} — arraste o novo para atualizar`
                : "qualquer banco — .xlsx, .xlsm, .csv ou .ofx exportado em planilha"}
            </div>
          </div>
          <input ref={extrato.entrada} type="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; extrato.receber(f); }} />
        </div>
      )}

      {/* Fila vazia e diferença zero: não sobra nada para fazer além de
          fechar — a tela oferece isso no alto, em vez de esperar que se
          procure o botão. */}
      {extrato && extrato.resultado && !fechado && diferenca === 0
        && !(extrato.resultado.noBancoSemPar || []).length && (
        <div style={{ ...S.card, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap",
          borderColor: "rgba(4,116,244,0.45)", background: "#eef5ff" }}>
          <div style={{ display: "grid", gap: 2 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0474f4" }}>Tudo bateu com o banco</div>
            <div style={{ fontSize: 12.5, color: "#1e3a5f" }}>
              Nenhuma linha do extrato falta lançar e o saldo fecha em {efDinheiro(calculado)}.
              {conf.pendentes > 0 ? ` Ainda há ${conf.pendentes} sem conferir — dá para fechar assim mesmo.` : ""}
            </div>
          </div>
          <button style={{ ...S.btn, marginLeft: "auto", opacity: ocupado ? .45 : 1 }} disabled={!!ocupado}
            onClick={() => aoFechar(mes, saldoBanco)}>Fechar {efMesPorExtenso(mes)}</button>
        </div>
      )}

      {extrato && extrato.resultado && (
        <ConferenciaComExtrato
          resultado={extrato.resultado} mapa={extrato.mapa} aoCorrigir={extrato.corrigir}
          aoLancar={extrato.lancar} aoMarcarCasados={extrato.marcarCasados}
          aoDescartar={extrato.descartar} ocupado={ocupado} fila={extrato.fila} />
      )}

      <div style={{ ...S.card, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, color: "#4b5563" }}>
        <span><strong style={{ color: "#262421" }}>{conf.conferidos}</strong> de {conf.total} conferidos</span>
        {conf.pendentes > 0 && <span>Falta conferir {efDinheiro(conf.valorPendente)} em {conf.pendentes} lançamentos</span>}
        {fechado && <span style={{ color: "#0474f4" }}>Mês fechado em {String(registro.fechadoEm || "").slice(0, 10).split("-").reverse().join("/")}</span>}
        <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} />
          Mostrar só o que falta conferir
        </label>
        {!fechado && conf.total > 0 && (
          <button style={S.btnSec} disabled={!!ocupado}
            onClick={() => aoMarcarTodos(mes, conf.pendentes > 0)}>
            {conf.pendentes > 0 ? "Marcar todos como conferidos" : "Desmarcar todos"}
          </button>
        )}
      </div>

      {!conf.total ? (
        <div style={{ ...S.card, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
          Nenhum lançamento em {efMesPorExtenso(mes)}.
        </div>
      ) : (
        <div style={{ ...S.quadro, maxHeight: 520 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
            <thead>
              <tr>
                {["", "Conta", "Cliente / obra", "Descrição", "Valor"].map((h, i) => (
                  <th key={i} style={{ position: "sticky", top: 0, background: "#fff", textAlign: i === 4 ? "right" : "left",
                    padding: "8px 12px", fontSize: 11, color: "#6b7280", fontWeight: 600,
                    borderBottom: "1px solid rgba(38,36,33,0.12)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {conf.lancamentos.filter((l) => !soPendentes || !l.conferido).map((l) => {
                const conta = contaEscritorio(l.contaId);
                return (
                  <tr key={l.id} style={{ borderTop: "1px solid rgba(38,36,33,0.06)", background: l.conferido ? "#f8fafc" : "transparent" }}>
                    <td style={{ padding: "6px 12px" }}>
                      <input type="checkbox" checked={!!l.conferido} disabled={fechado || !!ocupado}
                        onChange={() => aoMarcar(l)} style={{ cursor: fechado ? "default" : "pointer" }} />
                    </td>
                    <td style={{ padding: "6px 12px", color: l.conferido ? "#9ca3af" : "#262421" }}>{conta ? conta.nome : "—"}</td>
                    <td style={{ padding: "6px 12px", color: "#6b7280" }}>{[l.cliente, l.projeto].filter(Boolean).join(" · ") || "—"}</td>
                    <td style={{ padding: "6px 12px", color: "#6b7280" }}>{l.descricao || l.fornecedor || "—"}</td>
                    <td style={{ padding: "6px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{efValorDoLancamento(l)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Cartões do escritório e as faturas ──────────────────────────
// Uma tela só, porque é um fluxo só: cadastra o cartão, vê o que foi
// comprado nele, fecha a fatura. Fechar é o ato que leva o total para o
// extrato — e é manual de propósito: quem confere é você, contra a fatura
// que o banco mandou.
// Os cartões moram dentro do cadastro do escritório — é config do
// escritório, e de lá já vai e volta do banco sem precisar de rota nova.
function cartoesDoEscritorio(data) {
  return ((data || {}).escritorio || {}).cartoes || [];
}

// ── O cartão de um pagamento ────────────────────────────────────
// Usado na baixa do contas a pagar e na Entrada. Escolhe entre os cartões
// da obra; em obra de cliente, cadastra o cartão do cliente ali mesmo
// (`novoCartao`), que é gravado junto com o pagamento.
// `valor`: { cartaoId, parcelas, novoCartao: { nome, diaFechamento, diaVencimento } | null }
function CampoCartaoDoPagamento({ cartoes, doCliente, valor, aoMudar, total, dataCompra, isMobile, estilo, dinheiro }) {
  const v = valor || {};
  const lista = cartoes || [];
  const st = estilo || {};
  const input = st.input || { border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 10, padding: "8px 11px", fontSize: 13, width: "100%", boxSizing: "border-box", fontFamily: "inherit" };
  const label = st.label || { fontSize: 12, color: "#4b5563", fontWeight: 500, display: "block", marginBottom: 5 };
  const moeda = dinheiro || ((x) => (typeof fmtMoedaCtr === "function" ? fmtMoedaCtr(x) : "R$ " + Number(x || 0).toFixed(2)));
  const mudar = (m) => aoMudar({ ...v, ...m });
  const cadastrando = !!v.novoCartao || (doCliente && !lista.length);
  if (!doCliente && !lista.length) {
    return (
      <div style={{ fontSize: 11.5, color: "#b45309", marginTop: 8 }}>
        Nenhum cartão cadastrado. Cadastre em Escritório → Cartões.
      </div>
    );
  }
  const novo = v.novoCartao || { nome: "", diaFechamento: "", diaVencimento: "" };
  const cartao = cadastrando
    ? { diaFechamento: Number(novo.diaFechamento) || 0, diaVencimento: Number(novo.diaVencimento) || 0 }
    : (cartaoPorId(lista, v.cartaoId) || lista[0]);
  const previa = cartao && cartao.diaFechamento ? parcelasDoCartao(cartao, dataCompra, total, v.parcelas) : [];
  const link = { background: "none", border: "none", padding: 0, color: "#0474f4", cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, textDecoration: "underline" };
  return (
    <div data-vk-cartao-pagamento="1" style={{ marginTop: 10 }}>
      {cadastrando ? (
        <div style={{ border: "1px solid rgba(4,116,244,0.25)", background: "#f7fbff", borderRadius: 10, padding: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Cartão do cliente</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "2fr 1fr 1fr 1fr", gap: 8 }}>
            <div style={{ gridColumn: isMobile ? "1 / -1" : "auto" }}>
              <label style={label}>Nome do cartão</label>
              <input style={input} value={novo.nome} placeholder="ex.: Nubank do João" data-vk-cartao-nome="1"
                onChange={(e) => mudar({ novoCartao: { ...novo, nome: e.target.value } })} />
            </div>
            <div>
              <label style={label}>Fecha dia</label>
              <input style={input} inputMode="numeric" value={novo.diaFechamento} placeholder="25" data-vk-cartao-fecha="1"
                onChange={(e) => mudar({ novoCartao: { ...novo, diaFechamento: e.target.value.replace(/\D/g, "").slice(0, 2) } })} />
            </div>
            <div>
              <label style={label}>Vence dia</label>
              <input style={input} inputMode="numeric" value={novo.diaVencimento} placeholder="5" data-vk-cartao-vence="1"
                onChange={(e) => mudar({ novoCartao: { ...novo, diaVencimento: e.target.value.replace(/\D/g, "").slice(0, 2) } })} />
            </div>
            <div>
              <label style={label}>Parcelas</label>
              <input style={input} inputMode="numeric" value={v.parcelas || 1}
                onChange={(e) => mudar({ parcelas: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#4b5563", marginTop: 6 }}>
            Fica guardado nesta obra para as próximas baixas. Não é cartão do escritório.
            {lista.length > 0 && (
              <button type="button" style={{ ...link, marginLeft: 8 }} onClick={() => mudar({ novoCartao: null })}>usar um cartão já cadastrado</button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 10 }}>
            <div>
              <label style={label}>{doCliente ? "Cartão do cliente" : "Cartão"}</label>
              <SelectBusca style={input} value={v.cartaoId || (lista[0] || {}).id || ""}
                onChange={(id) => mudar({ cartaoId: id })}
                opcoes={lista.map((c) => ({ valor: c.id, rotulo: c.nome }))} />
            </div>
            <div>
              <label style={label}>Parcelas</label>
              <input style={input} inputMode="numeric" value={v.parcelas || 1}
                onChange={(e) => mudar({ parcelas: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
            </div>
          </div>
          {doCliente && (
            <button type="button" style={{ ...link, marginTop: 6 }}
              onClick={() => mudar({ novoCartao: { nome: "", diaFechamento: "", diaVencimento: "" } })}>＋ outro cartão do cliente</button>
          )}
        </>
      )}
      {previa.length > 0 && (
        <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 8, lineHeight: 1.6 }}>
          Vai cair {previa.length === 1 ? "na fatura de " : "nas faturas de "}
          <b style={{ color: "#111827" }}>
            {previa.map((p) => (typeof mesAnoPorExtenso === "function" ? mesAnoPorExtenso(p.competencia) : p.competencia) + " (" + moeda(p.valor) + ")").join(" · ")}
          </b>
          {doCliente
            ? ". O custo da obra entra nesta data; a fatura é do cliente e não passa pelo escritório."
            : ". O custo da obra é integral hoje; o extrato do escritório só recebe a fatura, quando você fechar."}
        </div>
      )}
    </div>
  );
}

function CartoesEscritorio({ data, save, isMobile, podeEditar, dialogo, quem }) {
  const S = EF_ESTILO;
  const cartoes = cartoesDoEscritorio(data);
  const obras = (data && data.obras) || [];
  const lancs = (data && data.lancamentos) || [];
  const [form, setForm] = useState(null);
  const [escolhido, setEscolhido] = useState(cartoes[0] ? cartoes[0].id : "");
  const [mes, setMes] = useState("");
  const [fechando, setFechando] = useState(false);
  const [editando, setEditando] = useState(null);       // { linha, descricao, data, valor, parcelas, cartaoId }
  const [editFatura, setEditFatura] = useState(null);   // { valor, data }
  const fechamentos = fechamentosDoEscritorio(data);

  const cartao = cartaoPorId(cartoes, escolhido) || cartoes[0] || null;
  const comps = cartao ? competenciasDoCartao(obras, lancs, cartao.id) : [];
  const fechadas = cartao ? faturasFechadas(lancs, cartao.id) : new Set();
  const compAtual = mes || comps.find((c) => !fechadas.has(c)) || comps[comps.length - 1] || "";
  const fatura = cartao && compAtual ? faturaParaFechar(cartao, obras, lancs, compAtual, { clientes: (data && data.clientes) || [] }) : null;

  function salvarCartao() {
    const f = form || {};
    if (!String(f.nome || "").trim()) { dialogo.alertar({ titulo: "Dê um nome ao cartão", tipo: "aviso" }); return; }
    const limpo = { ...f, nome: String(f.nome).trim(),
      diaFechamento: Math.max(1, Math.min(31, Number(f.diaFechamento) || 1)),
      diaVencimento: Math.max(1, Math.min(31, Number(f.diaVencimento) || 10)) };
    const existe = cartoes.some((c) => c.id === limpo.id);
    const lista = existe ? cartoes.map((c) => (c.id === limpo.id ? limpo : c)) : [...cartoes, limpo];
    save({ ...data, escritorio: { ...(data.escritorio || {}), cartoes: lista } });
    setEscolhido(limpo.id);
    setForm(null);
  }

  // A linha da fatura no extrato: é ela que diz que a fatura está fechada.
  // Excluir essa linha em Lançamentos é o que reabre a fatura.
  const lancDaFatura = cartao && compAtual ? lancs.find((l) => l && l.id === idDaFatura(cartao.id, compAtual)) || null : null;

  async function fecharFatura() {
    if (!fatura || !fatura.linhas.length || fechando || fatura.jaFechada) return;
    const ok = await dialogo.confirmar({
      titulo: `Fechar a fatura de ${mesAnoPorExtenso(compAtual)}?`,
      mensagem: `${efDinheiro(fatura.total)} entram no extrato do escritório como UMA linha, na conta Cartão de crédito`
        + (fatura.atrasadas.length ? `, incluindo ${fatura.atrasadas.length} compra(s) de meses que ficaram em aberto.` : ".")
        + " Confira contra a fatura que o banco mandou antes de confirmar.",
      confirmar: "Fechar fatura",
    });
    if (!ok) return;
    const previa = lancamentoDaFatura(cartao, compAtual, fatura.linhas, {});
    const trava = previa ? bloqueioPorMesFechado(previa.competencia, fechamentos) : "";
    if (trava) { dialogo.alertar({ titulo: "Não dá para fechar a fatura", mensagem: trava, tipo: "aviso" }); return; }
    setFechando(true);
    try {
      const l = previa;
      // A tela FICA no mês que acabou de fechar, mostrando o status novo.
      // Pular sozinha para o mês seguinte parecia que nada tinha acontecido
      // — e o botão de fechar estava lá de novo, agora de outra fatura.
      if (l) { await save({ ...data, lancamentos: [...lancs, l] }); setMes(compAtual); }
    } catch (e) {
      dialogo.alertar({ titulo: "A fatura não foi fechada", mensagem: (e && e.message) || "Tente de novo.", tipo: "aviso" });
    } finally { setFechando(false); }
  }

  // ── Editar / excluir uma compra da fatura ──
  // A compra mora na obra (conta a pagar) ou no escritório (lançamento);
  // aqui só se acha a fonte e grava nela — a fatura é lida de lá.
  const fonteDaLinha = (l) => {
    if (!l) return null;
    if (l.origem === "obra") {
      const obra = obras.find((o) => o && o.id === l.obraId);
      const c = obra && (obra.contasPagar || []).find((x) => x && x.id === l.refId);
      return c ? { tipo: "obra", obra, compra: c } : null;
    }
    const c = lancs.find((x) => x && x.id === l.refId);
    return c ? { tipo: "escritorio", compra: c } : null;
  };
  const gravarFonte = (f, nova) => {
    if (f.tipo === "obra") {
      return save({ ...data, obras: obras.map((o) => (o && o.id === f.obra.id
        ? { ...o, contasPagar: (o.contasPagar || []).flatMap((x) => (x && x.id === f.compra.id ? (nova ? [nova] : []) : [x])) }
        : o)) });
    }
    return save({ ...data, lancamentos: lancs.flatMap((x) => (x && x.id === f.compra.id ? (nova ? [nova] : []) : [x])) });
  };
  const travaDaFatura = (f) => {
    const fech = fechadasDaCompra(f.compra, lancs);
    return fech.length ? `Esta compra tem parcela na fatura de ${fech.map(mesAnoPorExtenso).join(", ")}, que já está fechada.`
      + " Reabra essa fatura (nos ⋯ ao lado do mês) para mudar valor, data, parcelas ou cartão." : "";
  };
  function abrirEdicao(l) {
    const f = fonteDaLinha(l);
    if (!f) { dialogo.alertar({ titulo: "Não achei esta compra", mensagem: "Ela pode ter sido apagada em outro lugar.", tipo: "aviso" }); return; }
    const c = f.compra;
    const valor = f.tipo === "obra" ? (Number(c.valorPago) || Number(c.valor) || 0) : (Number(c.valor) || 0);
    setEditFatura(null);
    setEditando({ linha: l, descricao: c.descricao || "", data: String((f.tipo === "obra" ? c.pagoEm : c.lancadoEm) || "").slice(0, 10),
      valor: valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      parcelas: String((c.parcelasCartao || []).length || 1), cartaoId: c.cartaoId || (cartao && cartao.id) || "" });
  }
  async function salvarEdicao() {
    const e = editando; if (!e) return;
    const f = fonteDaLinha(e.linha);
    if (!f) return;
    const cartaoNovo = cartaoPorId(cartoes, e.cartaoId);
    if (!cartaoNovo) { dialogo.alertar({ titulo: "Escolha o cartão", tipo: "aviso" }); return; }
    const nova = compraEditada(f.compra, { descricao: e.descricao, data: e.data, valor: efValorDoCampo(e.valor), parcelas: e.parcelas },
      cartaoNovo, f.tipo);
    if (!nova) { dialogo.alertar({ titulo: "Confira a data e o valor", mensagem: "A compra precisa de data e de valor maior que zero.", tipo: "aviso" }); return; }
    if (compraMexeuNoDinheiro(f.compra, nova)) {
      const trava = travaDaFatura(f);
      if (trava) { dialogo.alertar({ titulo: "Fatura fechada", mensagem: trava, tipo: "aviso" }); return; }
    }
    const final = f.tipo === "obra" && typeof registrarAto === "function"
      ? registrarAto(nova, "editada", quem || "", new Date().toISOString(), "pela fatura do cartão") : nova;
    try { await gravarFonte(f, final); setEditando(null); }
    catch (err) { dialogo.alertar({ titulo: "Não gravou", mensagem: (err && err.message) || "Tente de novo.", tipo: "aviso" }); }
  }
  async function excluirCompra(l) {
    const f = fonteDaLinha(l);
    if (!f) return;
    const trava = travaDaFatura(f);
    if (trava) { dialogo.alertar({ titulo: "Fatura fechada", mensagem: trava, tipo: "aviso" }); return; }
    const c = f.compra;
    const valor = f.tipo === "obra" ? (Number(c.valorPago) || Number(c.valor) || 0) : (Number(c.valor) || 0);
    const n = (c.parcelasCartao || []).length || 1;
    const ok = await dialogo.confirmar({
      titulo: "Excluir esta compra?",
      mensagem: `${c.descricao || "Compra"} · ${efDinheiro(valor)}${n > 1 ? ` em ${n}x` : ""}. Ela sai `
        + (f.tipo === "obra" ? `do contas a pagar da obra ${f.obra.nome || ""} ` : "dos lançamentos do escritório ")
        + "e de todas as faturas deste cartão.",
      confirmar: "Excluir", destrutivo: true,
    });
    if (!ok) return;
    if (editando && editando.linha && editando.linha.refId === l.refId) setEditando(null);
    try { await gravarFonte(f, null); }
    catch (err) { dialogo.alertar({ titulo: "Não excluiu", mensagem: (err && err.message) || "Tente de novo.", tipo: "aviso" }); }
  }

  // ── A fatura fechada: ajustar o valor debitado ou reabrir ──
  async function salvarFatura() {
    if (!editFatura || !lancDaFatura) return;
    const nova = faturaAjustada(lancDaFatura, { valor: efValorDoCampo(editFatura.valor), data: editFatura.data });
    if (!nova) { dialogo.alertar({ titulo: "Confira o valor e a data", tipo: "aviso" }); return; }
    const trava = bloqueioPorMesFechado(lancDaFatura.competencia, fechamentos) || bloqueioPorMesFechado(nova.competencia, fechamentos);
    if (trava) { dialogo.alertar({ titulo: "Mês fechado", mensagem: trava, tipo: "aviso" }); return; }
    try { await save({ ...data, lancamentos: lancs.map((x) => (x && x.id === nova.id ? nova : x)) }); setEditFatura(null); }
    catch (err) { dialogo.alertar({ titulo: "Não gravou", mensagem: (err && err.message) || "Tente de novo.", tipo: "aviso" }); }
  }
  async function reabrirFatura() {
    if (!lancDaFatura) return;
    const trava = bloqueioPorMesFechado(lancDaFatura.competencia, fechamentos);
    if (trava) { dialogo.alertar({ titulo: "Mês fechado", mensagem: trava + " Reabra o mês no Fechamento antes.", tipo: "aviso" }); return; }
    const ok = await dialogo.confirmar({
      titulo: `Reabrir a fatura de ${mesAnoPorExtenso(compAtual)}?`,
      mensagem: `A linha de ${efDinheiro(lancDaFatura.valor)} sai do extrato do escritório e a fatura volta a ficar aberta — `
        + "aí dá para editar ou excluir as compras dela e fechar de novo.",
      confirmar: "Reabrir", destrutivo: true,
    });
    if (!ok) return;
    try { await save({ ...data, lancamentos: lancs.filter((x) => !(x && x.id === lancDaFatura.id)) }); setEditFatura(null); }
    catch (err) { dialogo.alertar({ titulo: "Não reabriu", mensagem: (err && err.message) || "Tente de novo.", tipo: "aviso" }); }
  }

  const cel = { fontSize: 12.5, padding: "7px 10px", borderTop: "1px solid rgba(38,36,33,0.06)" };
  const num = { ...cel, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const cab = { fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4,
    fontWeight: 600, padding: "8px 10px", textAlign: "left" };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={S.card}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Cartões do escritório</div>
          {podeEditar && !form && (
            <button style={{ ...S.btnSec, marginLeft: "auto" }} onClick={() => setForm(cartaoVazio())}>＋ Novo cartão</button>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.5, marginBottom: 12 }}>
          A compra no cartão entra na obra pelo valor cheio, na data em que foi feita — o parcelamento é do caixa
          do escritório, não consumo da obra. O que vai para o extrato é a <b>fatura</b>, uma linha com o total,
          porque é isso que o banco debita.
        </div>

        {form && (
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr auto",
            alignItems: "end", padding: 12, border: "1px solid rgba(38,36,33,0.12)", borderRadius: 12, marginBottom: 12 }}>
            <div><div style={S.rot}>Nome do cartão</div>
              <input style={S.input} value={form.nome} placeholder="Sicoob Empresarial"
                onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><div style={S.rot}>Fecha no dia</div>
              <input style={S.input} inputMode="numeric" value={form.diaFechamento}
                onChange={(e) => setForm({ ...form, diaFechamento: e.target.value })} /></div>
            <div><div style={S.rot}>Vence no dia</div>
              <input style={S.input} inputMode="numeric" value={form.diaVencimento}
                onChange={(e) => setForm({ ...form, diaVencimento: e.target.value })} /></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.btn} onClick={salvarCartao}>Salvar</button>
              <button style={S.btnSec} onClick={() => setForm(null)}>Cancelar</button>
            </div>
          </div>
        )}

        {cartoes.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "#6b7280" }}>Nenhum cartão cadastrado ainda.</div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {cartoes.map((c) => (
              <button key={c.id} onClick={() => { setEscolhido(c.id); setMes(""); }}
                style={{ ...S.aba(cartao && c.id === cartao.id), textAlign: "left" }}>
                {c.nome}
                <span style={{ fontWeight: 400, opacity: 0.75 }}> · fecha {c.diaFechamento}, vence {c.diaVencimento}</span>
              </button>
            ))}
            {podeEditar && cartao && !form && (
              <button style={S.btnSec} onClick={() => setForm({ ...cartao })}>Editar {cartao.nome}</button>
            )}
          </div>
        )}
      </div>

      {cartao && (
        <div style={S.card}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Fatura</div>
            {comps.length > 0 && (
              <select style={{ ...S.input, width: "auto", minWidth: 150 }} value={compAtual}
                onChange={(e) => setMes(e.target.value)}>
                {comps.map((c) => (
                  <option key={c} value={c}>{mesAnoPorExtenso(c)}{fechadas.has(c) ? " · fechada" : " · aberta"}</option>
                ))}
              </select>
            )}
            {compAtual && (
              <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "3px 10px",
                background: fechadas.has(compAtual) ? "#0474f4" : "#fff",
                color: fechadas.has(compAtual) ? "#fff" : "#0474f4",
                border: "1px solid #0474f4" }}>
                {fechadas.has(compAtual) ? "Fechada" : "Aberta"}
              </span>
            )}
            {podeEditar && lancDaFatura && typeof MenuDeAcoes === "function" && (
              <MenuDeAcoes compacto toque={isMobile} title="Mais ações da fatura" itens={[
                { rotulo: "Editar valor debitado", onClick: () => { setEditando(null);
                  setEditFatura({ valor: (Number(lancDaFatura.valor) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    data: String(lancDaFatura.lancadoEm || "").slice(0, 10) }); } },
                { rotulo: "Reabrir fatura", destrutivo: true, onClick: reabrirFatura },
              ]} />
            )}
          </div>

          {!fatura || !fatura.linhas.length ? (
            <div style={{ fontSize: 12.5, color: "#6b7280" }}>
              {fatura && fatura.jaFechada
                ? "Esta fatura já foi fechada e está no extrato do escritório."
                : "Nenhuma compra neste cartão ainda. Lance uma compra em contas a pagar escolhendo Cartão na hora de pagar."}
            </div>
          ) : (
            <>
              <div style={{ ...S.quadro, marginBottom: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <th style={cab}>Compra</th>
                    {!isMobile && <th style={cab}>Obra</th>}
                    {!isMobile && <th style={cab}>Fornecedor</th>}
                    <th style={{ ...cab, textAlign: "center" }}>Parcela</th>
                    <th style={{ ...cab, textAlign: "right" }}>Valor</th>
                    {podeEditar && <th style={{ ...cab, width: isMobile ? 44 : 40 }} aria-label="Ações" />}
                  </tr></thead>
                  <tbody>
                    {fatura.linhas.map((l, i) => (
                      <tr key={i} style={l.atrasada ? { background: "#fffbeb" } : null}>
                        <td style={cel}>
                          {l.descricao}
                          <div style={{ fontSize: 10.5, color: "#9ca3af" }}>
                            {efDiaBR(l.compraEm)}{l.numeroDoc ? " · nº " + l.numeroDoc : ""}
                            {l.atrasada ? ` · de ${mesAnoPorExtenso(l.competenciaOriginal)}, ficou em aberto` : ""}
                          </div>
                          {/* onde a compra pesa no resultado: a fatura é uma linha no
                              banco, mas cada compra conta na conta dela */}
                          <div style={{ fontSize: 10.5, color: "#6b7280" }}>
                            no resultado: {((contaEscritorio(l.destinoContaId) || {}).nome) || "Cartão de crédito"}
                          </div>
                          <LinksDeAnexo transacao={l} compacto />
                        </td>
                        {!isMobile && <td style={cel}>{l.obra || "Escritório"}</td>}
                        {!isMobile && <td style={cel}>{l.fornecedor || "—"}</td>}
                        <td style={{ ...cel, textAlign: "center" }}>{l.de > 1 ? `${l.parcela}/${l.de}` : "—"}</td>
                        <td style={num}>{efDinheiro(l.valor)}</td>
                        {podeEditar && (
                          <td style={{ ...cel, textAlign: "right", padding: "4px 6px" }}>
                            {typeof MenuDeAcoes === "function" && (
                              <MenuDeAcoes compacto toque={isMobile} title="Mais ações da compra" itens={[
                                { rotulo: "Editar", onClick: () => abrirEdicao(l) },
                                { rotulo: "Excluir", destrutivo: true, onClick: () => excluirCompra(l) },
                              ]} />
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr>
                      <td style={{ ...cel, fontWeight: 700 }} colSpan={isMobile ? 2 : 4}>
                        TOTAL DA FATURA
                        {fatura.atrasadas.length > 0 && (
                          <div style={{ fontSize: 10.5, fontWeight: 400, color: "#92400e" }}>
                            inclui {efDinheiro(fatura.totalAtrasado)} de meses que ficaram em aberto
                          </div>
                        )}
                      </td>
                      <td style={{ ...num, fontWeight: 700 }}>{efDinheiro(fatura.total)}</td>
                      {podeEditar && <td style={cel} />}
                    </tr>
                  </tbody>
                </table>
              </div>

              {editando && (() => {
                const f = fonteDaLinha(editando.linha);
                const trava = f ? travaDaFatura(f) : "";
                const cartaoNovo = cartaoPorId(cartoes, editando.cartaoId);
                const plano = cartaoNovo ? parcelasDoCartao(cartaoNovo, editando.data, efValorDoCampo(editando.valor), editando.parcelas) : [];
                const mexe = (k, v) => setEditando({ ...editando, [k]: v });
                const bloq = !!trava;
                const inp = { ...S.input, ...(bloq ? { background: "#f3f4f6", color: "#6b7280" } : {}) };
                return (
                  <div style={{ border: "1px solid rgba(4,116,244,0.35)", background: "#f7fbff", borderRadius: 12, padding: 12,
                    display: "grid", gap: 10, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Editar compra
                      <span style={{ fontWeight: 400, color: "#6b7280" }}> · {editando.linha.obra || "Escritório"}</span></div>
                    {trava && <div style={{ fontSize: 12, color: "#92400e" }}>{trava} A descrição dá para mudar.</div>}
                    <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr 0.6fr 1.2fr", alignItems: "end" }}>
                      <div style={{ minWidth: 0 }}><div style={S.rot}>Descrição</div>
                        <input style={S.input} value={editando.descricao} onChange={(e) => mexe("descricao", e.target.value)} /></div>
                      <div style={{ minWidth: 0 }}><div style={S.rot}>Data da compra</div>
                        <input style={inp} type="date" disabled={bloq} value={editando.data} onChange={(e) => mexe("data", e.target.value)} /></div>
                      <div style={{ minWidth: 0 }}><div style={S.rot}>Valor total da compra</div>
                        <input style={inp} inputMode="decimal" disabled={bloq} value={editando.valor} onChange={(e) => mexe("valor", e.target.value)} /></div>
                      <div style={{ minWidth: 0 }}><div style={S.rot}>Parcelas</div>
                        <input style={inp} inputMode="numeric" disabled={bloq} value={editando.parcelas}
                          onChange={(e) => mexe("parcelas", e.target.value.replace(/\D/g, "").slice(0, 2))} /></div>
                      <div style={{ minWidth: 0 }}><div style={S.rot}>Cartão</div>
                        <select style={{ ...inp, cursor: bloq ? "default" : "pointer" }} disabled={bloq} value={editando.cartaoId}
                          onChange={(e) => mexe("cartaoId", e.target.value)}>
                          {cartoes.filter((c) => c && (c.ativo !== false || c.id === editando.cartaoId))
                            .map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select></div>
                    </div>
                    {!bloq && plano.length > 0 && (
                      <div style={{ fontSize: 12, color: "#4b5563" }}>
                        Fica nas faturas de <b>{plano.map((x) => `${mesAnoPorExtenso(x.competencia)} (${efDinheiro(x.valor)})`).join(" · ")}</b>.
                        {f && f.tipo === "obra" ? " O custo da obra muda junto, na data da compra." : ""}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button style={S.btnSec} onClick={() => setEditando(null)}>Cancelar</button>
                      <button style={S.btn} onClick={salvarEdicao}>Salvar</button>
                    </div>
                  </div>
                );
              })()}

              {editFatura && lancDaFatura && (
                <div style={{ border: "1px solid rgba(4,116,244,0.35)", background: "#f7fbff", borderRadius: 12, padding: 12,
                  display: "grid", gap: 10, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Valor que o banco debitou</div>
                  <div style={{ fontSize: 12, color: "#4b5563" }}>
                    Use quando a fatura do banco vier diferente da soma das compras — juros, tarifa, anuidade. A diferença
                    entra no resultado em Cartão de crédito; as compras continuam na conta delas.
                  </div>
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", alignItems: "end", maxWidth: 520 }}>
                    <div style={{ minWidth: 0 }}><div style={S.rot}>Valor debitado</div>
                      <input style={S.input} inputMode="decimal" value={editFatura.valor}
                        onChange={(e) => setEditFatura({ ...editFatura, valor: e.target.value })} /></div>
                    <div style={{ minWidth: 0 }}><div style={S.rot}>Data do débito</div>
                      <input style={S.input} type="date" value={editFatura.data}
                        onChange={(e) => setEditFatura({ ...editFatura, data: e.target.value })} /></div>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button style={S.btnSec} onClick={() => setEditFatura(null)}>Cancelar</button>
                    <button style={S.btn} onClick={salvarFatura}>Salvar</button>
                  </div>
                </div>
              )}

              {fatura.jaFechada ? (
                <div style={{ fontSize: 12.5, color: "#1f2937", padding: "10px 12px", borderRadius: 10,
                  background: "#eef5ff", border: "1px solid rgba(4,116,244,0.25)", lineHeight: 1.5 }}>
                  <b>Fatura fechada.</b> Está no extrato do escritório como uma linha de{" "}
                  <b>{efDinheiro(lancDaFatura ? lancDaFatura.valor : fatura.total)}</b>
                  {lancDaFatura && lancDaFatura.lancadoEm ? <>, em {efDiaBR(lancDaFatura.lancadoEm)}</> : null}.
                  {" "}Para mexer nas compras dela, use ⋯ → Reabrir fatura (ou exclua essa linha em Lançamentos).
                  {lancDaFatura && fatura.total - (Number(lancDaFatura.valor) || 0) >= 0.01 && (
                    <div style={{ color: "#92400e", marginTop: 4 }}>
                      Depois de fechada entrou compra nesta fatura ({efDinheiro(fatura.total)} hoje). Ela vai para a próxima
                      fatura aberta como atrasada.
                    </div>
                  )}
                  {lancDaFatura && (Number(lancDaFatura.valor) || 0) - fatura.total >= 0.01 && (
                    <div style={{ color: "#4b5563", marginTop: 4 }}>
                      O banco debitou {efDinheiro((Number(lancDaFatura.valor) || 0) - fatura.total)} a mais que as compras
                      (juros, tarifa) — essa diferença entra no resultado em Cartão de crédito.
                    </div>
                  )}
                </div>
              ) : podeEditar ? (
                <button style={{ ...S.btn, background: fechando ? "#9ca3af" : "#262421" }}
                  onClick={fecharFatura} disabled={fechando}>
                  {fechando ? "Fechando…" : `Fechar fatura · ${efDinheiro(fatura.total)}`}
                </button>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FinanceiroEscritorio({ data, save, onReload, vista, aoIrPara }) {
  const S = EF_ESTILO;
  const perm = typeof getPermissoes === "function" ? getPermissoes() : { podeEditar: true, podeExcluir: true };
  // `vista` vem do menu lateral: cada item abre direto a sua tela e o
  // cabeçalho de abas some. Sem ela (Escritório aberto pelo caminho antigo),
  // as abas continuam aparecendo.
  // "Lançamentos" virou a Base de dados: quem chega pelo nome antigo cai nela
  const abaDaVista = (v) => (v === "lancamentos" ? "base" : v);
  const [aba, setAbaCrua] = useState(["resumo", "fechamento"].includes(vista) ? "extrato" : (abaDaVista(vista) || "extrato"));
  const setAba = (v) => setAbaCrua(abaDaVista(v));
  useEffect(() => { if (vista && !["resumo", "fechamento"].includes(vista)) setAbaCrua(abaDaVista(vista)); }, [vista]);
  const [form, setForm] = useState(null);
  const [texto, setTexto] = useState("");
  const [lido, setLido] = useState(null);
  const [arrastando, setArrastando] = useState(false);
  const [origem, setOrigem] = useState("");
  const entradaArquivo = useRef(null);
  const [ocupado, setOcupado] = useState("");
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");
  // Filtro do painel e mês em conferência. O mês começa no primeiro que
  // ainda não foi fechado — é nele que o trabalho do dia acontece.
  const [filtro, setFiltro] = useState(() => {
    const hoje = new Date();
    return { ano: String(hoje.getFullYear()), mes: String(hoje.getMonth() + 1).padStart(2, "0"), unidadeId: "" };
  });
  const [mesFecho, setMesFecho] = useState("");

  const lancs = lancamentosDoEscritorio(data);
  const cfgFin = ((data || {}).escritorio || {}).financeiro || {};
  const saldoAbertura = Number(cfgFin.saldoAbertura) || 0;
  const linhas = extratoEscritorio(lancs, { saldoAbertura });
  const fechamentos = fechamentosDoEscritorio(data);
  const mesesDoExtrato = linhas.map((l) => l.mes);
  // O mês da conferência é o de hoje — é nele que o extrato parcial chega.
  // Se ele já estiver fechado, vai para o primeiro aberto depois dele; e se
  // o histórico nem chegou em hoje, fica no último mês que existe.
  const mesDeHoje = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const primeiroAberto = (mesesDoExtrato.includes(mesDeHoje) && !mesEstaFechado(mesDeHoje, fechamentos))
    ? mesDeHoje
    : (mesesDoExtrato.filter((m) => m >= mesDeHoje).find((m) => !mesEstaFechado(m, fechamentos))
      || mesesDoExtrato.find((m) => !mesEstaFechado(m, fechamentos))
      || mesesDoExtrato[mesesDoExtrato.length - 1] || "");
  const mesEmConferencia = mesFecho && mesesDoExtrato.includes(mesFecho) ? mesFecho : primeiroAberto;
  const [ano, setAno] = useState("");
  const anoAtual = ano || (linhas.length ? linhas[linhas.length - 1].mes.slice(0, 4) : String(new Date().getFullYear()));

  const outrosLancamentos = ((data || {}).lancamentos || []).filter((l) => !l || l.tipo !== "escritorio");
  const gravar = (novosDoEscritorio, extra) =>
    save({ ...data, ...(extra || {}), lancamentos: [...outrosLancamentos, ...novosDoEscritorio] }).catch(console.error);

  // O que a pessoa confirmou ("este item da nota é aquele insumo") vira
  // apelido no catálogo — é assim que a próxima nota da mesma loja casa
  // sozinha. Vai junto na gravada do lançamento, nunca numa separada.
  function catalogoQueAprendeu(l) {
    const pares = (l && Array.isArray(l.aprender)) ? l.aprender : [];
    if (!pares.length || typeof comApelidoDaLoja !== "function") return {};
    let lista = (data || {}).materiais || [];
    let mudou = false;
    for (const par of pares) {
      const r = comApelidoDaLoja(lista, par.codigo, par.descricao);
      lista = r.insumos; if (r.mudou) mudou = true;
    }
    return mudou ? { materiais: lista } : {};
  }
  const semAprender = (l) => { const x = { ...(l || {}) }; delete x.aprender; return x; };

  // Custo de uma obra lançado a partir do extrato. Ele NÃO vira lançamento
  // do escritório escrito à mão: vira conta a pagar na obra, já baixada, e
  // quem o põe no extrato é a mesma ponte que já traz as baixas feitas lá
  // dentro. Assim existe um número só — o custo por etapa da obra e o
  // Investido do empreendimento leem o mesmo lançamento, e desfazer de um
  // lado desfaz do outro.
  //
  // Obras e lançamentos vão na MESMA gravada: duas seguidas partem do mesmo
  // retrato antigo de `data`, e a segunda apaga o que a primeira escreveu.
  function lancarCustoNaObra(l) {
    const todas = (data || {}).obras || [];
    const obra = todas.find((o) => o && o.id === l.obraIdAlvo);
    if (!obra) return;
    const cliente = ((data || {}).clientes || []).find((c) => c && c.id === obra.clienteId) || null;
    const quem = typeof nomeDeQuem === "function" ? nomeDeQuem(perm && perm.usuario) : "";
    const valor = Number(l.valor) || 0;
    // UMA CONTA POR ITEM — é o que já faz o custo por etapa e a abertura por
    // subconta funcionarem, sem código novo: eles leem `etapa` e
    // `grupoMaterial` de cada conta. O `pedidoId` costura tudo de volta, e o
    // desconto (a diferença entre a soma dos itens e o que saiu do banco) se
    // espalha proporcionalmente pelo mesmo `itensRateados` do pedido da loja.
    const resumo = custoDoLancamento(valor, l.itens || []);
    const papel = { ...pedidoVazio(""),
      numeroNota: l.documento || "",
      data: l.lancadoEm, vencimento: l.lancadoEm,
      desconto: resumo.desconto,
      itens: (l.itens || []).filter((i) => i && efBrutoDoItem(i) > 0),
      observacao: String(l.descricao || "").trim() };
    const contasDoPapel = contasDoPedidoDaLoja({
      obraId: obra.id, cotacaoId: "", contaId: l.contaId,
      prestadorId: l.fornecedorId || "", favorecido: efNomeDoFornecedor(l),
      observacao: String(l.descricao || "").trim(),
    }, papel, typeof uid === "function" ? uid : undefined);

    // Um papel, um número. A nota tem dez itens e dez contas, mas é UMA
    // transação: dar dez referências faria a prestação de contas procurar
    // dez papéis que não existem.
    const numeroDoc = proximaReferencia(todas, lancamentosDoEscritorio(data));
    const papeis = anexosDaTransacao(l);
    // No cartão, cada conta leva o seu plano de parcelas: a fatura acha
    // por ele, e a ponte não manda a compra sozinha para o extrato.
    const cartaoDoCusto = l.formaPagamento === "cartao" ? cartaoPorId(cartoesDoEscritorio(data), l.cartaoId) : null;
    const novas = contasDoPapel.map((c) => {
      let paga = contaPaga(registrarAto({ ...c, numeroDoc: numeroDoc }, "criada", quem),
        { pagoEm: l.lancadoEm, valorPago: Number(c.valor) || 0 }, quem);
      const plano = cartaoDoCusto
        ? pagamentoNoCartao(paga, cartaoDoCusto, { pagoEm: l.lancadoEm, valorPago: Number(c.valor) || 0, parcelas: l.parcelas })
        : null;
      paga = plano ? { ...paga, ...plano } : { ...paga, formaPagamento: "avista" };
      return comAnexos(paga, papeis);
    });
    if (!novas.length) return;
    const obraNova = { ...obra, contasPagar: (obra.contasPagar || []).concat(novas) };
    const ponte = lancamentosDaBaixa(obraNova, cliente, novas,
      { fechamentos: fechamentosDoEscritorio(data), lancamentos: lancamentosDoEscritorio(data) });
    // Vindo da fila do extrato, o que atravessa leva a marca da linha do banco.
    const marca = l.extratoId ? { extratoId: l.extratoId, historicoBanco: l.historicoBanco || "",
      conferido: true, conferidoEm: l.conferidoEm || new Date().toISOString() } : null;
    const daPonte = marca ? ponte.lancamentos.map((x) => ({ ...x, ...marca })) : ponte.lancamentos;
    save({ ...data, ...catalogoQueAprendeu(l),
      obras: todas.map((o) => (o && o.id === obra.id ? obraNova : o)),
      lancamentos: [...outrosLancamentos, ...lancs, ...daPonte],
    }).catch(console.error);
    setForm(null);
  }

  // O fornecedor que ainda não existe entra sem sair da tela — quem está
  // conciliando o extrato não pode ser mandado para o cadastro e ter que
  // recomeçar a classificação quando voltar.
  function criarPrestadorDoLancamento(campos) {
    const todos = (data || {}).fornecedores || [];
    const nome = String((campos || {}).nome || "").trim();
    if (!nome) return null;
    const chave = (s) => efSemAcento(s);
    const igual = todos.find((x) => x && chave(x.nome) === chave(nome));
    if (igual) return igual;
    const novo = typeof criarPrestadorRapido === "function"
      ? criarPrestadorRapido({ nome, telefone: String((campos || {}).telefone || "").trim(),
          categoria: String((campos || {}).categoria || "").trim() || "Loja / Comércio",
          ...((campos || {}).cnpjCpf ? { cnpjCpf: String(campos.cnpjCpf), tipo: String(campos.cnpjCpf).replace(/\D/g, "").length === 11 ? "PF" : "PJ" } : {}) },
          typeof uid === "function" ? uid() : String(Date.now()))
      : null;
    if (!novo) return null;
    save({ ...data, fornecedores: todos.concat([novo]) }).catch(console.error);
    return novo;
  }

  // Receita da gestão (e o estorno dela): a parcela do contrato na obra
  // anda junto. Devolve o lançamento com a origem nova e as obras, para
  // irem na MESMA gravada — duas seguidas partiriam do mesmo retrato de
  // `data`, e a segunda apagaria a primeira.
  function comGestaoNaObra(l, antes) {
    const todas = (data || {}).obras || [];
    const quem = typeof nomeDeQuem === "function" ? nomeDeQuem(perm && perm.usuario) : "";
    const { noContratoGestao, foraDaGestao, parcelaGestaoId, parcelaGestaoObra, ...limpo } = l || {};
    if (noContratoGestao === undefined) return { lancamento: limpo, obras: null };
    const tinha = antes && ehLigacaoDaGestao(antes.origem) ? antes : null;
    const entra = !!(noContratoGestao && ehReceitaDaGestao(limpo) && limpo.obraId);
    let obras = todas;
    const naObra = (obraId, fn) => {
      const ob = obras.find((o) => o && o.id === obraId);
      if (!ob) return { erro: "A obra do contrato de gestão não foi encontrada." };
      const r = fn(ob);
      if (!r.erro) obras = obras.map((o) => (o && o.id === obraId ? r.obra : o));
      return r;
    };
    let base = tinha;
    let origem = limpo.origem;
    if (tinha && (!entra || tinha.origem.obraId !== limpo.obraId)) {
      const r = naObra(tinha.origem.obraId, (ob) => desfazerGestaoNaObra(ob, tinha, quem));
      if (r.erro && obras.some((o) => o && o.id === tinha.origem.obraId)) return { erro: r.erro };
      base = null; origem = undefined;
    }
    if (entra) {
      const r = naObra(limpo.obraId, (ob) => gestaoNaObra(ob, limpo, base, quem));
      if (r.erro) return { erro: r.erro };
      origem = r.origem || undefined;
    }
    const lancamento = { ...limpo };
    if (origem) lancamento.origem = origem; else delete lancamento.origem;
    return { lancamento, obras: obras === todas ? null : obras };
  }
  function avisarGestao(erro) {
    dialogo.alertar({ titulo: "Parcela da gestão", mensagem: erro, tipo: "aviso" });
  }

  function salvarLancamento(l) {
    if (l && l.naObra) { lancarCustoNaObra(l); return; }
    // A compra no cartão que já está numa fatura fechada só muda a
    // descrição por aqui; o dinheiro dela está conferido com o banco.
    const antes = l.id ? lancs.find((x) => x && x.id === l.id) : null;
    if (antes && compraNoCartaoDoEscritorio(antes) && fechadasDaCompra(antes, lancs).length
      && compraMexeuNoDinheiro(antes, l)) {
      dialogo.alertar({ titulo: "Está numa fatura fechada", tipo: "aviso",
        mensagem: `Esta compra tem parcela na fatura de ${fechadasDaCompra(antes, lancs).map(mesAnoPorExtenso).join(", ")}, `
          + "que já está fechada. Reabra a fatura em Cartões (⋯ ao lado do mês) para mudar valor, data, parcelas ou cartão." });
      return;
    }
    const id = l.id || (typeof uid === "function" ? uid() : String(Date.now()));
    const semEle = lancs.filter((x) => x.id !== id);
    // Toda transação sai daqui com referência. Quem já tem a sua não é
    // renumerado — número de papel entregue não muda.
    const numeroDoc = l.numeroDoc
      || proximaReferencia((data || {}).obras || [], lancs);
    // Quando entrou no sistema — é a "Data do lançamento" da base. Editar não
    // muda: o lançamento continua tendo entrado no dia em que entrou.
    const criadoEm = (antes && antes.criadoEm) || l.criadoEm || new Date().toISOString();
    const g = comGestaoNaObra({ ...l, id }, antes);
    if (g.erro) { avisarGestao(g.erro); return; }
    gravar([...semEle, { ...semAprender(g.lancamento), id, numeroDoc, criadoEm, fornecedor: efNomeDoFornecedor(l), tipo: "escritorio" }],
      { ...catalogoQueAprendeu(l), ...(g.obras ? { obras: g.obras } : {}) });
    setForm(null);
  }

  // O comprovante aberto no visor. Guardado aqui em cima porque a lista e o
  // formulário são duas telas do mesmo painel.
  const [vendoComprovante, setVendoComprovante] = useState(null);
  // A fatura do cartão é uma linha só no extrato, mas guarda as compras por
  // dentro: clicar nela abre a composição, cada compra com a sua nota.
  const [faturaAberta, setFaturaAberta] = useState(null);

  async function excluirLancamento(l) {
    // Mês conferido com o banco não perde linha: o saldo dele está fechado.
    const trava = bloqueioPorMesFechado(l.competencia, fechamentos);
    if (trava) { dialogo.alertar({ titulo: "Mês fechado", mensagem: trava + " Reabra o mês no Fechamento antes.", tipo: "aviso" }); return; }
    // Compra no cartão já dentro de fatura fechada: sai só reabrindo a fatura.
    const fechadasDela = compraNoCartaoDoEscritorio(l) ? fechadasDaCompra(l, lancs) : [];
    if (fechadasDela.length) {
      dialogo.alertar({ titulo: "Está numa fatura fechada", tipo: "aviso",
        mensagem: `Esta compra tem parcela na fatura de ${fechadasDela.map(mesAnoPorExtenso).join(", ")}, que já está fechada. `
          + "Reabra a fatura em Cartões (⋯ ao lado do mês) antes de excluir." });
      return;
    }
    // Receita da gestão ligada a uma parcela: a parcela do contrato não sai
    // da obra — a receita que a baixou a reabre, e o estorno excluído a
    // devolve paga.
    if (ehLigacaoDaGestao(l.origem)) {
      const quem = typeof nomeDeQuem === "function" ? nomeDeQuem(perm && perm.usuario) : "";
      const obG = (((data || {}).obras || []).find((o) => o && o.id === l.origem.obraId)) || null;
      const pG = obG ? parcelaDoLancamento(obG, l) : null;
      const d = obG ? desfazerGestaoNaObra(obG, l, quem) : { obra: null };
      if (d.erro) { avisarGestao(d.erro); return; }
      const mudou = !!(obG && d.obra && d.obra !== obG);
      const txtParcela = pG ? `parcela ${pG.parcela || ""}${pG.totalParcelas ? "/" + pG.totalParcelas : ""}`.replace(" /", "/") : "";
      const doSaldo = l.origem.tipo === "gestao";
      const ok = await dialogo.confirmar({
        titulo: "Excluir este lançamento?",
        mensagem: `${contaEscritorio(l.contaId)?.nome || "Lançamento"} · ${Number(l.valor) < 0 ? "estorno " + efDinheiro(Math.abs(Number(l.valor))) : efDinheiro(l.valor)} · ${mesAnoPorExtenso(l.competencia)}`
          + (mudou && doSaldo ? `. Sai do saldo de ${efMesCurto(l.competencia || l.lancadoEm)} do contrato de gestão de ${obG.nome || "obra"} — a ${txtParcela} e as seguintes são recalculadas.` : "")
          + (mudou && l.origem.tipo === "estorno" ? `. A ${txtParcela} do contrato de gestão de ${obG.nome || "obra"} volta a ficar paga — o estorno é desfeito.` : "")
          + (mudou && l.origem.tipo === "conta" ? `. A ${txtParcela} do contrato de gestão de ${obG.nome || "obra"} volta a ficar em aberto.` : ""),
        confirmar: "Excluir", destrutivo: true,
      });
      if (!ok) return;
      const novosG = lancs.filter((x) => x.id !== l.id);
      if (mudou) {
        save({ ...data, obras: ((data || {}).obras || []).map((o) => (o && o.id === obG.id ? d.obra : o)),
          lancamentos: [...outrosLancamentos, ...novosG] }).catch(console.error);
        return;
      }
      gravar(novosG);
      return;
    }
    const daFatura = ((l.origem || {}).tipo === "fatura");
    // Veio de uma obra: a conta de lá é a mesma transação, e sai junto.
    const origem = l.origem || {};
    const obra = origem.obraId ? (((data || {}).obras || []).find((o) => o && o.id === origem.obraId) || null) : null;
    const contasJuntas = obra ? contasLigadasAoLancamento(obra, l) : [];
    const entradaJunta = obra && origem.tipo === "entrada" ? (obra.entradas || []).find((e) => e && e.id === origem.refId) : null;
    const refs = [...new Set(contasJuntas.map((c) => c.numeroDoc).filter(Boolean))];
    const ok = await dialogo.confirmar({
      titulo: daFatura ? "Excluir a linha da fatura?" : "Excluir este lançamento?",
      mensagem: `${contaEscritorio(l.contaId)?.nome || "Lançamento"} · ${efDinheiro(l.valor)} · ${mesAnoPorExtenso(l.competencia)}`
        + (daFatura ? `. A fatura de ${mesAnoPorExtenso(l.origem.competencia)} volta a ficar ABERTA em Cartões — as compras dela continuam lá, `
          + "e dá para editar e fechar de novo." : "")
        + (compraNoCartaoDoEscritorio(l) ? ". A compra sai também das faturas abertas do cartão." : "")
        + (contasJuntas.length ? `. Sai também da obra ${obra.nome || ""}: ${contasJuntas.length === 1 ? "1 conta" : contasJuntas.length + " contas"}`
          + (refs.length ? ` (ref ${refs.join(", ")})` : "") + " — é a mesma transação." : "")
        + (entradaJunta ? `. Sai também a entrada da obra ${obra.nome || ""} — é a mesma transação.` : ""),
      confirmar: "Excluir", destrutivo: true,
    });
    if (!ok) return;
    const novos = lancs.filter((x) => x.id !== l.id);
    if (obra && (contasJuntas.length || entradaJunta)) {
      const fora = new Set(contasJuntas.map((c) => c.id));
      const obras = ((data || {}).obras || []).map((o) => (o && o.id === obra.id ? {
        ...o,
        contasPagar: (o.contasPagar || []).filter((c) => !(c && fora.has(c.id))),
        entradas: entradaJunta ? (o.entradas || []).filter((e) => !(e && e.id === entradaJunta.id)) : o.entradas,
      } : o));
      save({ ...data, obras, lancamentos: [...outrosLancamentos, ...novos] }).catch(console.error);
      return;
    }
    gravar(novos);
  }

  // Arquivo solto: lê a planilha (ou CSV), joga as linhas na caixa e já
  // confere. O usuário vê o mesmo resumo de sempre antes de gravar.
  async function receberArquivo(arquivo) {
    if (!arquivo) return;
    setArrastando(false);
    setOcupado(`Lendo ${arquivo.name}…`);
    setAviso(""); setLido(null); setOrigem("");
    try {
      const { texto: lidoTexto, aba } = await efTextoDoArquivo(arquivo);
      if (!String(lidoTexto || "").trim()) throw new Error("O arquivo está vazio.");
      setTexto(lidoTexto);
      setLido(interpretarColagemEscritorio(lidoTexto));
      setOrigem(aba ? `${arquivo.name} · aba “${aba}”` : arquivo.name);
      setOcupado("");
    } catch (e) {
      setOcupado("");
      setAviso("Não consegui ler o arquivo: " + ((e && e.message) || "formato não reconhecido"));
    }
  }

  // ── Extrato do banco na tela de fechamento ────────────────────
  // O arquivo vem como o banco manda: o mapa de colunas é reconhecido pelo
  // conteúdo, guardado por assinatura e reutilizado na próxima vez.
  const [tabelaExtrato, setTabelaExtrato] = useState(null);
  const [mapaExtrato, setMapaExtrato] = useState(null);
  const [arrastandoExtrato, setArrastandoExtrato] = useState(false);
  const [origemExtrato, setOrigemExtrato] = useState("");
  const entradaExtrato = useRef(null);
  const layouts = layoutsDoEscritorio(data);

  async function receberExtrato(arquivo) {
    if (!arquivo) return;
    setArrastandoExtrato(false);
    setOcupado(`Lendo ${arquivo.name}…`); setAviso("");
    try {
      const { linhas, aba } = await efTabelaDoArquivo(arquivo);
      if (!linhas || !linhas.length) throw new Error("O arquivo está vazio.");
      let mapa = detectarColunasTabela(linhas);
      const guardado = layoutSalvo(layouts, mapa.assinatura);
      if (guardado) mapa = { ...mapa, colunas: { ...guardado.colunas }, lembrado: true };
      setTabelaExtrato(linhas); setMapaExtrato(mapa);
      setOrigemExtrato(aba ? `${arquivo.name} · aba “${aba}”` : arquivo.name);
      setOcupado("");
      if (!mapa.completo) setAviso("Não reconheci a coluna de data ou de valor — escolha nos campos acima.");
    } catch (e) {
      setOcupado("");
      setAviso("Não consegui ler o extrato: " + ((e && e.message) || "formato não reconhecido"));
    }
  }

  function corrigirColuna(campo, coluna) {
    setMapaExtrato((m) => {
      if (!m) return m;
      const colunas = { ...m.colunas };
      if (coluna == null) delete colunas[campo]; else colunas[campo] = coluna;
      if (campo === "valor" && coluna != null) { delete colunas.debito; delete colunas.credito; }
      if ((campo === "debito" || campo === "credito") && coluna != null) delete colunas.valor;
      return { ...m, colunas, lembrado: false, confianca: { ...m.confianca, [campo]: 1 } };
    });
  }

  // O extrato lido fica guardado no mês: trocar de tela, fechar o navegador
  // ou voltar outro dia não apaga a fila. O arquivo arrastado de novo
  // substitui as linhas; o "não é lançamento" de cada linha fica.
  const extratosGuardados = (cfgFin.extratos && typeof cfgFin.extratos === "object") ? cfgFin.extratos : {};
  const doArquivoTodos = (tabelaExtrato && mapaExtrato && mapaExtrato.completo)
    ? comIdsDosMovimentos(movimentosDaTabela(tabelaExtrato, mapaExtrato)) : null;
  // Do arquivo, só as linhas do mês em conferência: o extrato de setembro
  // não entra no fechamento de outubro.
  const doArquivo = doArquivoTodos ? doArquivoTodos.filter((m) => mesDoMovimento(m) === String(mesEmConferencia)) : null;
  const guardadosDoMes = movimentosGuardadosDoMes(extratosGuardados, mesEmConferencia);
  const guardadoDoMes = extratosGuardados[mesEmConferencia]
    || (guardadosDoMes.length ? Object.values(extratosGuardados).find((v) => v && (v.movimentos || []).some((m) => mesDoMovimento(m) === String(mesEmConferencia))) : null)
    || null;
  const movimentosExtrato = (doArquivo && doArquivo.length) ? doArquivo : (guardadosDoMes.length ? guardadosDoMes : null);
  const ignoradosDoMes = ignoradosGuardados(extratosGuardados);
  const conciliacao = movimentosExtrato
    ? conciliarExtrato(movimentosExtrato, lancs.filter((l) => String(l.competencia) === String(mesEmConferencia)),
        { ignorados: ignoradosDoMes })
    : null;
  const saldoLidoDoExtrato = movimentosExtrato ? saldoDoExtratoNoMes(movimentosExtrato, mesEmConferencia) : null;

  function guardarExtratos(novos) {
    const esc = (data || {}).escritorio || {};
    return save({ ...data, escritorio: { ...esc, financeiro: { ...cfgFin, extratos: novos } } });
  }
  // Arquivo novo e com as colunas certas: guarda cada linha no mês dela
  // (uma vez por conteúdo) e, se o arquivo não tem nada do mês aberto, vai
  // para o mês dele.
  const assinaturaDoArquivo = doArquivoTodos ? doArquivoTodos.map((m) => m.id).join("~") : "";
  const guardandoExtrato = useRef("");
  useEffect(() => {
    if (!doArquivoTodos || !doArquivoTodos.length) return;
    if (guardandoExtrato.current === assinaturaDoArquivo) return;
    guardandoExtrato.current = assinaturaDoArquivo;
    const r = extratosComArquivo(extratosGuardados, doArquivoTodos, origemExtrato, new Date().toISOString());
    const mesesAbertos = r.meses.filter((m) => mesesDoExtrato.includes(m) && !mesEstaFechado(m, fechamentos)).sort();
    if (r.meses.length && !r.meses.includes(String(mesEmConferencia)) && mesesAbertos.length) {
      setMesFecho(mesesAbertos[mesesAbertos.length - 1]);
      setAviso(`O extrato é de ${r.meses.map((m) => efMesPorExtenso(m)).join(" e ")} — abri ${efMesPorExtenso(mesesAbertos[mesesAbertos.length - 1])}.`);
    }
    // O mapa das colunas deste banco vai na MESMA gravada: duas seguidas
    // partiriam do mesmo retrato de `data` e a segunda apagaria a primeira.
    const novosLayouts = mapaExtrato && mapaExtrato.assinatura && !mapaExtrato.lembrado
      ? { ...layouts, [mapaExtrato.assinatura]: { colunas: mapaExtrato.colunas, visto: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10) } }
      : layouts;
    const esc = (data || {}).escritorio || {};
    Promise.resolve(save({ ...data, escritorio: { ...esc, financeiro: { ...cfgFin, extratos: r.extratos, layouts: novosLayouts } } }))
      .then(() => { if (novosLayouts !== layouts) setMapaExtrato((m) => (m ? { ...m, lembrado: true } : m)); })
      .catch(console.error);
  }, [assinaturaDoArquivo]);

  // Guardar o mapa para a próxima vez que este banco aparecer.
  function lembrarLayout() {
    if (!mapaExtrato || !mapaExtrato.assinatura || mapaExtrato.lembrado) return Promise.resolve();
    const esc = (data || {}).escritorio || {};
    const novos = { ...layouts, [mapaExtrato.assinatura]: { colunas: mapaExtrato.colunas, visto: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10) } };
    return save({ ...data, escritorio: { ...esc, financeiro: { ...cfgFin, layouts: novos } } });
  }

  async function marcarCasadosDoExtrato() {
    if (!conciliacao || !conciliacao.casados.length) return;
    const agora = new Date().toISOString();
    const novos = conciliacao.casados.filter((c) => !c.lancamento.conferido)
      .map((c) => ({ ...c.lancamento, conferido: true, conferidoEm: agora }));
    setOcupado(`Marcando ${novos.length} lançamentos…`);
    try {
      const lote = 400;
      for (let i = 0; i < novos.length; i += lote) await api.lancamentos.batch(novos.slice(i, i + lote));
      await lembrarLayout();
      setOcupado("");
      setAviso(`${novos.length} lançamentos conferidos pelo extrato.`);
      if (onReload) await onReload();
    } catch (e) {
      setOcupado("");
      setAviso("Não consegui marcar: " + ((e && e.message) || "falha no envio"));
    }
  }

  // Lançar a partir da linha do banco: abre o formulário já preenchido.
  function lancarDoExtrato(movimento) {
    lembrarLayout().catch(console.error);
    setForm({
      ...lancamentoDoExtrato(movimento),
      valor: String(Math.abs(Number(movimento.valor) || 0)).replace(".", ","),
      cliente: "", projeto: "", fornecedor: "", observacao: "",
    });
    setAba("base");
    if (aoIrPara) aoIrPara("base");
  }

  // ── A fila: lançar sem sair do Fechamento ──
  // A linha do banco vira lançamento ali mesmo: competência = o mês que está
  // sendo fechado, conferido, ligado à linha (extratoId) e com o histórico do
  // banco guardado — é ele que ensina a próxima linha igual.
  function lancarLinhaDoExtrato(l) {
    const agora = new Date().toISOString();
    const marca = { extratoId: l.extratoId || "", historicoBanco: l.historicoBanco || "",
      conferido: true, conferidoEm: agora, contaBanco: l.contaBanco || "sim" };
    if (l && l.naObra) { const { sinalDoBanco, ...semSinal } = l; lancarCustoNaObra({ ...semSinal, ...marca }); return true; }
    l = comSinalDeEstorno(l);
    const id = typeof uid === "function" ? uid() : String(Date.now());
    const numeroDoc = l.numeroDoc || proximaReferencia((data || {}).obras || [], lancs);
    const g = comGestaoNaObra({ ...l, id }, null);
    if (g.erro) { avisarGestao(g.erro); return false; }
    gravar([...lancs, { ...semAprender(g.lancamento), ...marca, id, numeroDoc, criadoEm: agora, fornecedor: efNomeDoFornecedor(l), tipo: "escritorio" }],
      { ...catalogoQueAprendeu(l), ...(g.obras ? { obras: g.obras } : {}) });
    return true;
  }

  // Várias linhas iguais de uma vez (as tarifas do mês, a conta de água):
  // uma conta só para todas. O que a conta pedir a mais (cliente, obra)
  // manda lançar uma a uma.
  function lancarVariasDoExtrato(movimentos, contaId, unidadeId) {
    const agora = new Date().toISOString();
    let ref = null;
    const novos = [];
    for (const m of movimentos || []) {
      const l = comSinalDeEstorno({ ...lancamentoDaLinhaDoExtrato(m, mesEmConferencia, null), contaId, unidadeId,
        valor: Math.round(Math.abs(Number(m.valor) || 0) * 100) / 100 });
      const erros = validarLancamentoEscritorio(l, { fechamentos });
      if (erros.length) return { erro: erros[0] + " Lance esta conta uma linha por vez." };
      ref = proximaReferencia((data || {}).obras || [], lancs.concat(novos));
      novos.push({ ...l, id: (typeof uid === "function" ? uid() : String(Date.now())) + "_" + novos.length,
        numeroDoc: ref, criadoEm: agora, conferido: true, conferidoEm: agora,
        fornecedor: efNomeDoFornecedor(l), tipo: "escritorio" });
    }
    if (!novos.length) return { erro: "Nenhuma linha escolhida." };
    gravar([...lancs, ...novos]);
    setAviso(`${novos.length} lançamentos criados em ${(contaEscritorio(contaId) || {}).nome || "conta"}.`);
    return { ok: true };
  }

  // Todas as que a sugestão resolve sozinha: uma gravada só (várias seguidas
  // partiriam do mesmo retrato de `lancs` e só a última ficaria).
  function lancarSugeridasDoExtrato(movimentos) {
    const agora = new Date().toISOString();
    const novos = [];
    for (const m of movimentos || []) {
      const r = lancamentoRapidoDoExtrato(m, mesEmConferencia, sugestaoDoExtrato(m, lancs), fechamentos);
      if (!r.lancamento) continue;
      const l = r.lancamento;
      novos.push({ ...l, id: (typeof uid === "function" ? uid() : String(Date.now())) + "_" + novos.length,
        numeroDoc: proximaReferencia((data || {}).obras || [], lancs.concat(novos)),
        criadoEm: agora, conferido: true, conferidoEm: agora, contaBanco: "sim",
        fornecedor: efNomeDoFornecedor(l), tipo: "escritorio" });
    }
    if (!novos.length) return { erro: "Nenhuma linha com sugestão pronta." };
    gravar([...lancs, ...novos]);
    setAviso(`${novos.length} lançamentos criados pelas sugestões.`);
    return { ok: true };
  }

  // "Não é lançamento": a linha sai da fila com o motivo, sem virar nada.
  async function naoELancamento(m, motivo) {
    await guardarExtratos(extratosComIgnorado(extratosGuardados, mesEmConferencia, m.id, motivo, new Date().toISOString()));
  }

  // "Não passou pela conta": tira da fila sem apagar o lançamento.
  async function marcarForaDoBanco(l) {
    const ok = await dialogo.confirmar({
      titulo: "Marcar como fora da conta do escritório?",
      mensagem: `${(contaEscritorio(l.contaId) || {}).nome || "Lançamento"} · ${efDinheiro(l.valor)}. Ele sai da conferência do banco e continua no extrato do VICKE.`,
      confirmar: "Marcar",
    });
    if (!ok) return;
    gravar(lancs.map((x) => x.id === l.id ? { ...x, contaBanco: "nao", conferido: true, conferidoEm: new Date().toISOString() } : x));
  }

  // Conferência: marca um lançamento como visto no extrato do banco. É o
  // trabalho do dia a dia — por isso vai um a um, sem cerimônia.
  function marcarConferido(l) {
    const agora = new Date().toISOString();
    gravar(lancs.map((x) => x.id === l.id
      ? (x.conferido ? { ...x, conferido: false, conferidoEm: "" } : { ...x, conferido: true, conferidoEm: agora })
      : x));
  }

  // O mês inteiro de uma vez vai pelo lote: são centenas de lançamentos e o
  // save() normal mandaria um pedido para cada.
  async function marcarMesInteiro(mes, marcando) {
    const agora = new Date().toISOString();
    const alvo = lancs.filter((l) => String(l.competencia) === String(mes) && !!l.conferido !== marcando);
    if (!alvo.length) return;
    const novos = alvo.map((l) => marcando ? { ...l, conferido: true, conferidoEm: agora } : { ...l, conferido: false, conferidoEm: "" });
    setOcupado(marcando ? "Marcando o mês…" : "Desmarcando…");
    try {
      const lote = 400;
      for (let i = 0; i < novos.length; i += lote) await api.lancamentos.batch(novos.slice(i, i + lote));
      setOcupado("");
      if (onReload) await onReload();
    } catch (e) {
      setOcupado("");
      setAviso("Não consegui marcar: " + ((e && e.message) || "falha no envio"));
    }
  }

  function guardarFechamentos(novos) {
    const esc = (data || {}).escritorio || {};
    return save({ ...data, escritorio: { ...esc, financeiro: { ...cfgFin, fechamentos: novos } } });
  }

  async function fecharMes(mes, saldoBanco) {
    const conf = conferenciaDoMes(lancs, mes);
    if (conf.pendentes) {
      const seguir = await dialogo.confirmar({
        titulo: `Fechar ${efMesPorExtenso(mes)} com ${conf.pendentes} sem conferir?`,
        mensagem: `O saldo bate com o banco, mas ${efDinheiro(conf.valorPendente)} ainda não foi marcado como conferido. Depois de fechado, o mês não aceita lançamento novo.`,
        confirmar: "Fechar assim mesmo",
      });
      if (!seguir) return;
    }
    await guardarFechamentos({ ...fechamentos, [mes]: { saldoBanco: Number(saldoBanco) || 0, fechadoEm: new Date().toISOString() } });
    setAviso(`${efMesPorExtenso(mes)} fechado.`);
  }

  async function reabrirMes(mes) {
    const ok = await dialogo.confirmar({
      titulo: `Reabrir ${efMesPorExtenso(mes)}?`,
      mensagem: "O mês volta a aceitar lançamento. O saldo do banco que você informou fica guardado.",
      confirmar: "Reabrir",
    });
    if (!ok) return;
    const reg = fechamentos[mes] || {};
    await guardarFechamentos({ ...fechamentos, [mes]: { ...reg, fechadoEm: "" } });
    setAviso(`${efMesPorExtenso(mes)} reaberto.`);
  }

  // Importação: vai direto pelo lote, sem passar pelo save() normal — o
  // save compara o que mudou e mandaria os milhares de lançamentos um a um.
  async function importar() {
    if (!lido || !lido.resumo.prontos) return;
    const prontos = lido.itens.filter((i) => !i.erros.length)
      .map((i) => lancamentoDaColagem(i, `imp_${Date.now().toString(36)}_${i.linha}`));
    const emMesFechado = prontos.filter((l) => mesEstaFechado(l.competencia, fechamentos));
    if (emMesFechado.length) {
      setAviso(`${emMesFechado.length} linhas caem em meses já fechados e não podem entrar. Reabra o mês em Fechamento, ou tire essas linhas do arquivo.`);
      return;
    }
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

  const ultimo = linhas[linhas.length - 1];
  const fechados = linhas.filter((l) => l.mes <= "2026-08");
  const u12 = fechados.slice(-12);
  const media = (f) => (u12.length ? u12.reduce((s, m) => s + (f(m) || 0), 0) / u12.length : 0);

  return (
    <div style={S.wrap}>
      {!vista && (
        <div style={S.abas}>
          {[["extrato", "Extrato"], ["base", `Base de dados (${lancs.length})`], ["cartoes", "Cartões"], ["importar", "Importar"]].map(([k, r]) => (
            <button key={k} style={S.aba(aba === k)} onClick={() => setAba(k)}>{r}</button>
          ))}
        </div>
      )}

      {vista === "resumo" && (
        <PainelFinanceiroEscritorio
          dadosDoPainel={data}
          lancs={lancs} linhas={linhas} fechamentos={fechamentos}
          filtro={filtro} aoFiltrar={setFiltro}
          aoIr={(destino, mes) => {
            if (mes) setMesFecho(mes);
            if (aoIrPara) aoIrPara(destino); else setAba(destino);
          }} />
      )}

      {vista === "fechamento" && (
        <FechamentoEscritorioTela
          lancs={lancs} linhas={linhas} fechamentos={fechamentos}
          mes={mesEmConferencia} aoTrocarMes={setMesFecho}
          aoMarcar={marcarConferido} aoMarcarTodos={marcarMesInteiro}
          aoFechar={fecharMes} aoReabrir={reabrirMes} ocupado={ocupado}
          extrato={{
            arrastando: arrastandoExtrato, setArrastando: setArrastandoExtrato,
            origem: origemExtrato, entrada: entradaExtrato, receber: receberExtrato,
            mapa: mapaExtrato, corrigir: corrigirColuna, resultado: conciliacao,
            lancar: lancarDoExtrato, marcarCasados: marcarCasadosDoExtrato, descartar: marcarForaDoBanco,
            guardado: !(doArquivo && doArquivo.length) && guardadoDoMes ? guardadoDoMes : null,
            saldoLido: saldoLidoDoExtrato,
            fila: {
              mes: mesEmConferencia,
              inicial: (m) => lancamentoDaLinhaDoExtrato(m, mesEmConferencia, sugestaoDoExtrato(m, lancs)),
              sugestao: (m) => sugestaoDoExtrato(m, lancs),
              lancar: lancarLinhaDoExtrato,
              rapido: (m) => lancamentoRapidoDoExtrato(m, mesEmConferencia, sugestaoDoExtrato(m, lancs), fechamentos),
              lancarVarias: lancarVariasDoExtrato,
              lancarSugeridas: lancarSugeridasDoExtrato,
              naoE: naoELancamento,
              formProps: {
                fechamentos, clientes: (data || {}).clientes || [], obras: (data || {}).obras || [], lancamentos: lancs,
                nomeEscritorio: (((data || {}).escritorio || {}).nome || "").trim(),
                prestadores: ((data || {}).fornecedores || []).filter((x) => x && x.ativo !== false),
                insumos: ((data || {}).materiais || []).filter((x) => x && x.ativo !== false),
                cartoes: cartoesDoEscritorio(data),
                aoCadastrarInsumo: (campos) => typeof cadastrarInsumoNoCatalogo === "function" ? cadastrarInsumoNoCatalogo(data, save, campos) : null,
                aoCriarPrestador: criarPrestadorDoLancamento,
              },
            },
          }} />
      )}

      {aviso && <div style={{ fontSize: 12.5, color: "#0474f4" }}>{aviso}</div>}

      {!["resumo", "fechamento"].includes(vista) && aba === "extrato" && (
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

      {!["resumo", "fechamento"].includes(vista) && aba === "base" && (
        <div style={{ ...S.card, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Base de dados</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginTop: 2, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: "#4b5563" }}>Todos os lançamentos do escritório, uma linha por transação · o item a item das notas fica na base de cada obra</div>
            {perm.podeEditar && !form && (
              <button style={S.btn} onClick={() => setForm({})}>+ Novo lançamento</button>
            )}
          </div>
          {form && <div style={{ marginBottom: 14 }}><FormLancamentoEscritorio fechamentos={fechamentos} clientes={(data || {}).clientes || []}
            nomeEscritorio={(((data || {}).escritorio || {}).nome || "").trim()}
            obras={(data || {}).obras || []} lancamentos={lancs}
            prestadores={((data || {}).fornecedores || []).filter((x) => x && x.ativo !== false)}
            insumos={((data || {}).materiais || []).filter((x) => x && x.ativo !== false)}
            cartoes={cartoesDoEscritorio(data)}
            aoCadastrarInsumo={(campos) => typeof cadastrarInsumoNoCatalogo === "function"
              ? cadastrarInsumoNoCatalogo(data, save, campos) : null}
            aoCriarPrestador={criarPrestadorDoLancamento}
            inicial={form} aoSalvar={salvarLancamento} aoCancelar={() => setForm(null)} /></div>}
          {vendoComprovante && typeof VisorProposta === "function" && (
            <VisorProposta anexo={vendoComprovante} aoFechar={() => setVendoComprovante(null)} />
          )}
          <BaseDeDados obras={(data || {}).obras || []} clientes={(data || {}).clientes || []}
            prestadores={(data || {}).fornecedores || []}
            insumos={typeof insumosDoCatalogo === "function" ? insumosDoCatalogo(data) : []}
            lancamentos={lancamentosDoEscritorio(data)} doEscritorio
            acoes={{
              editar: perm.podeEditar ? (l) => { setForm(l); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); } : null,
              excluir: perm.podeExcluir ? (l) => excluirLancamento(l) : null,
              verPapel: (a) => setVendoComprovante(a),
            }}
            completar={perm.podeEditar !== false ? { data, save, quem: typeof nomeDeQuem === "function" ? nomeDeQuem(perm && perm.usuario) : "" } : null}
            isMobile={typeof window !== "undefined" && window.innerWidth < 768} nomeDoArquivo="base de dados" />
        </div>
      )}

      {!["resumo", "fechamento"].includes(vista) && aba === "cartoes" && (
        <CartoesEscritorio data={data} save={save} isMobile={typeof window !== "undefined" && window.innerWidth < 768}
          podeEditar={!!perm.podeEditar} dialogo={dialogo}
          quem={typeof nomeDeQuem === "function" ? nomeDeQuem(perm && perm.usuario) : ""} />
      )}

      {!["resumo", "fechamento"].includes(vista) && aba === "importar" && (
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
              Arraste o arquivo da planilha aqui — ele acha sozinho a aba da base de dados.
              Se preferir, cole as linhas copiadas do Excel. Nada é gravado antes de você conferir o resumo.
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); if (!arrastando) setArrastando(true); }}
              onDragLeave={(e) => { if (e.currentTarget === e.target) setArrastando(false); }}
              onDrop={(e) => { e.preventDefault(); receberArquivo(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); }}
              onClick={() => entradaArquivo.current && entradaArquivo.current.click()}
              style={{
                border: `1.5px dashed ${arrastando ? "#0474f4" : "rgba(38,36,33,0.22)"}`,
                background: arrastando ? "#eef5ff" : "#fff",
                borderRadius: 14, padding: "26px 16px", textAlign: "center", cursor: "pointer",
                transition: "background .12s, border-color .12s",
              }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: arrastando ? "#0474f4" : "#262421" }}>
                {arrastando ? "Pode soltar" : "Arraste a planilha aqui"}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                .xlsx, .xlsm ou .csv — ou clique para escolher
              </div>
              {origem && !arrastando && (
                <div style={{ fontSize: 12, color: "#0474f4", marginTop: 8 }}>Li de {origem}</div>
              )}
            </div>
            <input ref={entradaArquivo} type="file" accept=".xlsx,.xlsm,.xltx,.xltm,.csv,.tsv,.txt" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; receberArquivo(f); }} />
            <details>
              <summary style={{ fontSize: 12.5, color: "#4b5563", cursor: "pointer" }}>Ou colar as linhas</summary>
              <textarea style={{ ...S.input, minHeight: 130, marginTop: 8, fontFamily: "ui-monospace, monospace", fontSize: 11.5 }}
                value={texto} placeholder="Cole aqui as linhas copiadas do Excel"
                onChange={(e) => { setTexto(e.target.value); setLido(null); setOrigem(""); }} />
            </details>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              {ocupado && <span style={{ fontSize: 12, color: "#6b7280", marginRight: "auto" }}>{ocupado}</span>}
              <button style={S.btnSec} onClick={() => { setTexto(""); setLido(null); setOrigem(""); }}>Limpar</button>
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
