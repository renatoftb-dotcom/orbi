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
  // O banco debita e devolve: boleto estornado, débito em duplicidade
  // devolvido. As duas pontas entram na mesma conta — o débito como saída,
  // o crédito como estorno — e se anulam. Mexe no saldo do banco no dia,
  // nunca no resultado.
  { id: "ajustes_bancarios", titulo: "ESTORNOS E AJUSTES BANCÁRIOS", sinal: -1, resultado: false, bloco: "ajustes" },
  // Dinheiro guardado para pagar alguém: a parte da engenharia que veio junto
  // com o projeto. No recebimento ela é receita (o projeto inteiro) e custo
  // de parceiro — e o dinheiro fica aqui até ser pago ao engenheiro, quando
  // sai como estorno da reserva (sem custo de novo).
  { id: "reservas", titulo: "RESERVAS A REPASSAR", sinal: +1, resultado: false, bloco: "reservas" },
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

  // ── estornos do banco (não é resultado; débito e crédito se anulam) ──
  { id: "res_engenharia", nome: "Reserva engenharia (a repassar)", grupo: "reservas", unidades: ["projetos", "escritorio"],
    apelidos: ["Reserva engenharia"] },
  { id: "estornos_bancarios", nome: "Estornos bancários",    grupo: "ajustes_bancarios", unidades: ["escritorio"],
    apelidos: ["Estornos bancários", "Estorno bancário", "Estorno de boleto"] },
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
  // Obra encerrada (ou ajuste de obra antiga, de antes do cadastro): quem
  // lança marca e assume. Não pede cliente e obra do cadastro — pede o nome,
  // escrito, para o lançamento não ficar sem dono na base.
  if (lan.obraEncerrada && unidade && (unidade.exigeCliente || unidade.exigeObra)) {
    if (!String(lan.cliente || "").trim() && !String(lan.projeto || "").trim()) erros.push("Escreva o cliente ou a obra antiga.");
  } else {
    if (unidade && unidade.exigeCliente && !lan.clienteId) erros.push("Informe o cliente.");
    if (unidade && unidade.exigeObra && !lan.obraId) erros.push("Informe a obra.");
  }
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
    // débito e crédito estornado se anulam no mês; o que sobrar (estorno
    // que só volta no mês seguinte) mexe no saldo enquanto não volta
    const ajustes = g("ajustes_bancarios");
    const saldoReservas = g("reservas");
    saldo = saldo + saldoGestao + paraInvestimento + saldoEmpreendimento - ajustes + saldoReservas;
    const contas = {}; for (const k in linha.contas) contas[k] = efCentavos(linha.contas[k]);
    const grupos = {}; for (const k in linha.grupos) grupos[k] = efCentavos(linha.grupos[k]);
    return {
      mes: m,
      contas,
      grupos,
      saldoGestao: efCentavos(saldoGestao),
      saldoEscritorio: efCentavos(saldoEscritorio),
      saldoEmpreendimento: efCentavos(saldoEmpreendimento),
      saldoReservas: efCentavos(saldoReservas),
      retiradas: efCentavos(socios),
      ajustes: efCentavos(ajustes),
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
  // "Emitir nota fiscal" saiu das bases (out/2026): a coluna da planilha
  // antiga é reconhecida só para não ser confundida com a da nota — e fica de fora.
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

// ── Saldo da aplicação (investimento) ──────────────────────────
// O dinheiro aplicado (RDC) não passa pelo extrato da conta: as aplicações
// e os resgates ficam fora da conta. O saldo dele é informado à mão, mês a
// mês, e mora no mesmo registro do fechamento — sem precisar fechar o mês.
// Não mexe no saldo da conta nem no resultado: é para ver o total.
function saldoAplicacaoDoMes(fechamentos, mes) {
  const r = (fechamentos || {})[String(mes)];
  const v = r && r.saldoAplicacao;
  return v == null || v === "" || !Number.isFinite(Number(v)) ? null : efCentavos(Number(v));
}
function comSaldoAplicacao(fechamentos, mes, valor) {
  const f = { ...(fechamentos || {}) };
  const reg = { ...(f[String(mes)] || {}) };
  const n = valor == null || valor === "" ? null : Number(valor);
  if (n == null || !Number.isFinite(n)) delete reg.saldoAplicacao;
  else reg.saldoAplicacao = efCentavos(n);
  if (Object.keys(reg).length) f[String(mes)] = reg; else delete f[String(mes)];
  return f;
}

// ── Receita financeira apurada no mês ───────────────────────────
// As idas e vindas da aplicação (RDC) ficam fora da conta, então o dinheiro
// aplicado continua dentro do saldo calculado: ele é "conta + aplicação",
// sem o rendimento. O que o escritório tem de fato (banco + aplicação) menos
// o calculado é o rendimento do mês — a receita financeira. Antes era
// apurada uma vez por ano, em dezembro; de dez/2025 em diante, todo mês.
function receitaFinanceiraDoMes(saldoCalculado, saldoBanco, saldoAplicacao) {
  if (saldoBanco == null || saldoAplicacao == null || saldoBanco === "" || saldoAplicacao === "") return null;
  return efCentavos((Number(saldoBanco) || 0) + (Number(saldoAplicacao) || 0) - (Number(saldoCalculado) || 0));
}
// O lançamento que zera a diferença: Receita Financeira no último dia do
// mês, fora da conta corrente (o rendimento nasce dentro da aplicação, não
// passa pelo extrato), já conferido. Se o mês já tem o seu, ele é ajustado
// em vez de nascer outro.
function lancamentoDoRendimento(mes, valor, existente) {
  const [a, m] = String(mes).split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const nome = efMesPorExtenso(mes);
  if (existente) return { ...existente, valor: efCentavos((Number(existente.valor) || 0) + (Number(valor) || 0)) };
  return { contaId: "rec_financeira", unidadeId: "escritorio", competencia: mes,
    lancadoEm: `${mes}-${String(ultimo).padStart(2, "0")}`, valor: efCentavos(valor),
    descricao: `Receita de aplicação financeira — rendimento de ${nome}`, fornecedor: "Aplicação financeira",
    contaBanco: "nao", conferido: true, conferidoPor: "aplicacao", origem: { tipo: "rendimento", mes } };
}
function rendimentoLancadoNoMes(lancamentos, mes) {
  return (lancamentos || []).find((l) => l && l.origem && l.origem.tipo === "rendimento" && String(l.competencia) === String(mes)) || null;
}

// O saldo do banco informado no mês (gravado ao sair do campo ou no fecho).
function saldoBancoDoMes(fechamentos, mes) {
  const r = (fechamentos || {})[String(mes)];
  const v = r && r.saldoBanco;
  return v == null || v === "" || !Number.isFinite(Number(v)) ? null : efCentavos(Number(v));
}
function comSaldoBanco(fechamentos, mes, valor) {
  const f = { ...(fechamentos || {}) };
  const reg = { ...(f[String(mes)] || {}) };
  const n = valor == null || valor === "" ? null : Number(valor);
  if (n == null || !Number.isFinite(n)) delete reg.saldoBanco;
  else reg.saldoBanco = efCentavos(n);
  if (Object.keys(reg).length) f[String(mes)] = reg; else delete f[String(mes)];
  return f;
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
// `opcoes.certos`: ids dos lançamentos que o extrato casou sem dúvida — contam
// como conferidos (pelo extrato) mesmo antes de gravados; a gravação vem no
// fechamento do mês.
function conferenciaDoMes(lancamentos, mes, opcoes) {
  const certos = (opcoes && opcoes.certos) || null;
  // A compra no cartão não aparece no banco — quem aparece é a fatura.
  const doMes = (lancamentos || []).filter((l) => l && String(l.competencia) === String(mes)
    && !compraNoCartaoDoEscritorio(l));
  const pelo = (l) => !l.conferido && !!certos && certos.has(l.id);
  const visto = (l) => !!l.conferido || pelo(l);
  const conferidos = doMes.filter(visto);
  const soma = (lista) => efCentavos(lista.reduce((s, l) => s + (Number(l.valor) || 0), 0));
  return {
    total: doMes.length,
    conferidos: conferidos.length,
    pendentes: doMes.length - conferidos.length,
    peloExtrato: doMes.filter(pelo).length,
    valorConferido: soma(conferidos),
    valorPendente: soma(doMes.filter((l) => !visto(l))),
    lancamentos: doMes.map((l) => (pelo(l) ? { ...l, _peloExtrato: true } : l)),
  };
}

// Os lançamentos que o extrato casou com certeza, prontos para gravar como
// conferidos: ligados à linha do banco (extratoId) e com o histórico dela,
// que é o que ensina o próximo casamento.
function conferidosPeloExtrato(resultado, agora) {
  const quando = agora || new Date().toISOString();
  return ((resultado && resultado.casados) || [])
    .filter((c) => casamentoCerto(c) && c.lancamento && !c.lancamento.conferido)
    .map((c) => ({ ...c.lancamento, conferido: true, conferidoEm: quando, conferidoPor: "extrato",
      extratoId: c.lancamento.extratoId || c.extrato.id || "",
      historicoBanco: c.lancamento.historicoBanco || c.extrato.historico || "" }));
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



// ── Extrato exportado em HTML (Sicoob e afins) ──────────────────
// A página traz várias tabelas: o cabeçalho da conta, LANÇAMENTOS,
// LANÇAMENTOS FUTUROS e o RESUMO. Valem as linhas com data e valor das
// tabelas de lançamento — os FUTUROS ficam de fora, porque ainda não
// passaram pelo banco (entram no extrato do mês em que acontecerem).
// Dentro da célula, a quebra de linha vira " · " e o resto um espaço:
// "PIX EMITIDO OUTRA IF · Pagamento Pix 53.859.112 0001-69 cimento".
function efTextoDaCelulaHtml(html) {
  const ent = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\u0001")
    .replace(/<\/(strong|b|div|p)>/gi, "\u0001")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === "#") return String.fromCharCode(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return ent[e.toLowerCase()] != null ? ent[e.toLowerCase()] : m;
    })
    .split("\u0001").map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean).join(" · ");
}
function efLinhasDoHtml(html) {
  const h = String(html || "").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "");
  const saida = [];
  const re = /<table[\s\S]*?<\/table>/gi;
  let m, fim = 0;
  while ((m = re.exec(h))) {
    // o título que vem antes da tabela (o texto entre a anterior e esta)
    const antes = efTextoDaCelulaHtml(h.slice(fim, m.index)).toUpperCase();
    fim = m.index + m[0].length;
    if (/FUTURO/.test(antes.slice(-80))) continue;
    const linhas = [];
    const reTr = /<tr[\s\S]*?<\/tr>/gi;
    let tr;
    while ((tr = reTr.exec(m[0]))) {
      const celulas = [];
      const reTd = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let td;
      while ((td = reTd.exec(tr[0]))) celulas.push(efTextoDaCelulaHtml(td[1]));
      if (celulas.some((c) => c !== "")) linhas.push(celulas);
    }
    // só tabela de lançamento: tem linha com data E valor em centavos
    // "SALDO BLOQUEADO" é cheque a compensar, não saldo da conta: fica fora
    const comDado = linhas.filter((l) => l.some(efEhData) && l.some((c) => /\d,\d{2}/.test(c) && efValorDeTexto(c) != null)
      && !l.some((c) => /SALDO BLOQUEADO/i.test(c)));
    if (!comDado.length) continue;
    // o cabeçalho entra uma vez só, para o reconhecimento das colunas
    const cab = linhas.find((l) => !l.some(efEhData) && l.length >= 3);
    if (cab && !saida.length) saida.push(cab);
    comDado.forEach((l) => saida.push(l));
  }
  return saida;
}

// ── Extrato em OFX ──────────────────────────────────────────────
// Cada <STMTTRN> é um lançamento: data (DTPOSTED), valor já com sinal
// (TRNAMT), o código do banco (FITID/CHECKNUM) e o histórico (NAME/MEMO). O
// saldo final (LEDGERBAL) vira uma linha "SALDO DO DIA", que é como o
// fechamento lê o saldo do banco. Vale para o OFX antigo (SGML, sem
// fechar as tags) e o novo (XML).
function efLinhasDoOfx(texto) {
  const t = String(texto || "");
  const campo = (bloco, nome) => {
    const r = new RegExp("<" + nome + ">([^<\\r\\n]*)", "i").exec(bloco);
    return r ? r[1].trim() : "";
  };
  const data = (d) => (/^\d{8}/.test(d) ? `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}` : "");
  const valor = (v) => {
    const n = Number(String(v || "").replace(",", "."));
    return v !== "" && Number.isFinite(n) ? (n < 0 ? "-" : "") + Math.abs(n).toFixed(2).replace(".", ",") : "";
  };
  const linhas = [["Data", "Documento", "Histórico", "Valor"]];
  const re = /<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi;
  let m;
  while ((m = re.exec(t))) {
    const b = m[1];
    // O Sicoob põe o TIPO no MEMO ("PIX EMITIDO OUTRA IF", "RESGATE RDC") e
    // o detalhe no NAME. Tipo primeiro: o histórico sai igual ao do HTML
    // (a mesma linha não duplica se um mês vier num formato e depois no
    // outro) e "RESGATE RDC" continua sendo reconhecido como fora da conta.
    const hist = [campo(b, "MEMO"), campo(b, "NAME")].filter(Boolean)
      .filter((x, i, a) => a.indexOf(x) === i).join(" · ");
    const cheque = campo(b, "CHECKNUM");
    const doc = (cheque && cheque !== "0" ? cheque : "") || campo(b, "REFNUM") || campo(b, "FITID");
    linhas.push([data(campo(b, "DTPOSTED")), doc, hist || campo(b, "TRNTYPE"), valor(campo(b, "TRNAMT"))]);
  }
  const saldo = /<LEDGERBAL>([\s\S]*?)(?=<\/LEDGERBAL>|<AVAILBAL>|<\/STMTRS>)/i.exec(t);
  if (saldo && linhas.length > 1) {
    const d = data(campo(saldo[1], "DTASOF"));
    const v = valor(campo(saldo[1], "BALAMT"));
    if (d && v) linhas.push([d, "", "SALDO DO DIA", v]);
  }
  return linhas.length > 1 ? linhas : [];
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
  // OFX de banco brasileiro vem em Windows-1252 (CHARSET:1252): lido como
  // UTF-8, "DÉB.TIT" viraria "D�B.TIT".
  let bruto;
  if (typeof arquivo.arrayBuffer === "function" && typeof TextDecoder !== "undefined") {
    const buf = await arquivo.arrayBuffer();
    bruto = new TextDecoder("utf-8").decode(buf);
    const cabeca = bruto.slice(0, 600);
    if (/CHARSET:\s*(1252|ISO-?8859-?1)|encoding="(windows-1252|iso-8859-1)"/i.test(cabeca) || (/\.ofx$/.test(nome) && bruto.indexOf("\uFFFD") >= 0)) {
      bruto = new TextDecoder("windows-1252").decode(buf);
    }
  } else {
    bruto = await arquivo.text();
  }
  if (/\.ofx$/.test(nome) || /<OFX>|OFXHEADER/i.test(bruto.slice(0, 2000))) {
    const linhas = efLinhasDoOfx(bruto);
    if (!linhas.length) throw new Error("Não achei lançamentos nesse OFX.");
    return { linhas, aba: "OFX", abas: [] };
  }
  if (/\.html?$/.test(nome) || /^\s*(<!doctype html|<html|<table)/i.test(bruto.slice(0, 500))) {
    const linhas = efLinhasDoHtml(bruto);
    if (!linhas.length) throw new Error("Não achei a tabela de lançamentos nesse HTML.");
    return { linhas, aba: "HTML", abas: [] };
  }
  const texto = efCsvParaTsv(bruto);
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
  // O Sicoob (e outros) escrevem o lado no fim: "108,02D" é saída,
  // "763,50C" é entrada; o "*" marca saldo bloqueado.
  let lado = 0;
  const cd = /^([\d.,]+)([CD])\*?$/i.exec(s);
  if (cd) { s = cd[1]; lado = cd[2].toUpperCase() === "D" ? -1 : 1; }
  else if (/^[\d.,]+\*$/.test(s)) s = s.slice(0, -1);
  const negativo = lado < 0 || /^\(.*\)$/.test(s) || s.indexOf("-") >= 0;
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
  // O que não passou pela conta (contaBanco "nao": a parte da engenharia que
  // vai para a reserva, o rendimento da aplicação, o marcado "fora da conta")
  // não tem linha no banco para casar — nem deve aparecer como faltando nele.
  // Exceção: marcado "não passou pela conta" mas AINDA NÃO conferido — o
  // caso da compra parcelada da planilha antiga, em que as parcelas a vencer
  // vieram com "não" e depois foram debitadas. Ele ainda pode ter a linha do
  // banco: entra por último, e o par que fizer vem como dúvida, para a
  // pessoa confirmar (e a confirmação corrige o "não").
  const candidatos = (lancamentos || []).filter((l) => !compraNoCartaoDoEscritorio(l) && !(l && l.contaBanco === "nao" && l.conferido)).map((l, i) => ({
    l, i, abs: Math.round(Math.abs(Number(l.valor) || 0) * 100) / 100, usado: false, dir: direcaoDoLancamento(l),
    nao: !!(l && l.contaBanco === "nao"),
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
      centavos: Math.round((c.abs - m.abs) * 100), ambiguo: false, certeza: "vinculo", pontos: 0, alternativas: [] });
  }
  // Os demais casam por valor e lado — mas, quando o mesmo valor aparece
  // mais de uma vez, a escolha não é mais "o primeiro da lista": ganha o par
  // que tem PISTA (o CPF/CNPJ do histórico é o do fornecedor; o nome do
  // histórico está no lançamento). Sem pista nenhuma, vale a ordem de antes
  // (o mais antigo casa primeiro). E cada par sai com o grau de certeza:
  //   vinculo     — o lançamento nasceu desta linha;
  //   unico       — um valor só, dos dois lados: não tem com o que confundir;
  //   desempate   — havia outro do mesmo valor, mas a pista decidiu;
  //   equivalente — havia outro, mas trocar não muda nada (dois lançamentos
  //                 iguais para duas linhas iguais);
  //   duvida      — sobrou para a pessoa olhar.
  const livres = [];
  for (const m of emOrdem) {
    if (jaCasados.has(m)) continue;
    // "Não é lançamento" (transferência entre contas suas, estorno que se
    // anula): sai da fila sem virar lançamento, com o motivo guardado.
    if (m.id && ignorados[m.id]) { naoLancar.push({ ...m, motivo: ignorados[m.id].motivo || "" }); continue; }
    livres.push(m);
  }
  const dirDe = (m) => (Number(m.valor) < 0 ? -1 : (Number(m.valor) > 0 ? 1 : 0));
  const absDe = (m) => (m.abs != null ? Number(m.abs) : Math.round(Math.abs(Number(m.valor) || 0) * 100) / 100);
  const compativel = (m, c) => !c.usado && Math.abs(c.abs - absDe(m)) <= tolerancia
    && (!c.dir || !dirDe(m) || c.dir === dirDe(m));
  const pistas = typeof pistasDoCasamento === "function" ? pistasDoCasamento(lancamentos, o) : null;
  const pares = [];
  livres.forEach((m, im) => {
    candidatos.forEach((c) => {
      if (!compativel(m, c)) return;
      pares.push({ m, im, c, pontos: pistas ? pistas.pontos(m, c.l) : 0 });
    });
  });
  // mais pista primeiro; empatado, a ordem de antes (extrato, depois lista)
  pares.sort((a, b) => (Number(a.c.nao) - Number(b.c.nao)) || (b.pontos - a.pontos) || (a.im - b.im) || (a.c.i - b.c.i));
  const doMov = new Map();
  for (const p of pares) {
    if (p.c.usado || doMov.has(p.m)) continue;
    p.c.usado = true;
    doMov.set(p.m, p);
  }
  // as alternativas de cada par: outros lançamentos que serviam a esta linha
  // e outras linhas que serviam a este lançamento
  const igualLanc = (a, b) => ["contaId", "descricao", "obraId", "projeto", "cliente", "fornecedor", "unidadeId"]
    .every((k) => efSemAcento(a[k] || "") === efSemAcento(b[k] || ""))
    && Math.abs(Math.abs(Number(a.valor) || 0) - Math.abs(Number(b.valor) || 0)) <= tolerancia;
  const igualMov = (a, b) => efSemAcento(a.historico || "") === efSemAcento(b.historico || "")
    && Math.abs((Number(a.valor) || 0) - (Number(b.valor) || 0)) <= tolerancia;
  // A certeza é medida contra TROCAS: dar a esta linha outro lançamento (e
  // ao dono dele, este) tem de custar pista. Trocar com quem é igual não
  // custa nada, mas também não muda nada — é "equivalente".
  const pontosDe = (m, c) => { const x = pares.find((y) => y.m === m && y.c === c); return x ? x.pontos : null; };
  const donoDe = new Map(); doMov.forEach((p, m) => donoDe.set(p.c, m));
  for (const m of livres) {
    const p = doMov.get(m);
    if (!p) { noBancoSemPar.push(m); continue; }
    const outrosLanc = pares.filter((x) => x.m === m && x.c !== p.c);
    const outrasLinhas = pares.filter((x) => x.c === p.c && x.m !== m);
    let certeza = "unico";
    if (outrosLanc.length || outrasLinhas.length) {
      const trocas = [];
      for (const x of outrosLanc) {
        const dono = donoDe.get(x.c);
        if (!dono) { trocas.push({ ganho: p.pontos - x.pontos, igual: igualLanc(x.c.l, p.c.l) }); continue; }
        const volta = pontosDe(dono, p.c);
        if (volta == null) continue;                 // o dono não aceita este lançamento: não há troca
        trocas.push({ ganho: p.pontos + doMov.get(dono).pontos - x.pontos - volta,
          igual: igualLanc(x.c.l, p.c.l) || igualMov(dono, m) });
      }
      for (const x of outrasLinhas) {
        if (!doMov.get(x.m)) trocas.push({ ganho: p.pontos - x.pontos, igual: igualMov(x.m, m) });
      }
      const arriscadas = trocas.filter((t) => t.ganho < 3);
      if (!arriscadas.length) certeza = trocas.length ? "desempate" : "unico";
      else if (arriscadas.every((t) => t.igual)) certeza = "equivalente";
      else certeza = "duvida";
    }
    // marcado "não passou pela conta": casa, mas quem decide é a pessoa
    if (p.c.nao) certeza = "duvida";
    casados.push({
      extrato: m, lancamento: p.c.l,
      dias: distancia(m, p.c) === 9999 ? null : distancia(m, p.c),
      centavos: Math.round((p.c.abs - absDe(m)) * 100),
      ambiguo: outrosLanc.length > 0 || outrasLinhas.length > 0,
      certeza, pontos: p.pontos, marcadoForaDaConta: p.c.nao,
      // as outras opções para a pessoa trocar o par, quando há dúvida
      alternativas: certeza === "duvida" ? outrosLanc.map((x) => x.c.l) : [],
    });
  }
  // a fila sai na ordem do extrato, como antes
  noBancoSemPar.sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const contabilizadoSemPar = candidatos.filter((c) => !c.usado && !c.nao).map((c) => c.l);
  // Provável duplicado: sobrou sem linha do banco, mas há outro lançamento na
  // MESMA conta e do mesmo valor que já casou — uma entrada no banco, dois
  // lançamentos (a base antiga importada e a ponte da obra, por exemplo).
  const duplicados = {};
  for (const l of contabilizadoSemPar) {
    const v = Math.round(Math.abs(Number(l && l.valor) || 0) * 100);
    const gemeo = casados.find((c) => c.lancamento && c.lancamento.id !== l.id && c.lancamento.contaId === l.contaId
      && Math.round(Math.abs(Number(c.lancamento.valor) || 0) * 100) === v);
    if (gemeo) duplicados[l.id] = { lancamento: gemeo.lancamento, extrato: gemeo.extrato };
  }
  // Sinal invertido: sobrou uma SAÍDA e o banco tem uma ENTRADA do mesmo valor
  // ainda sem lançamento (ou o contrário) — o reembolso lançado como pagamento.
  const invertidos = {};
  for (const l of contabilizadoSemPar) {
    const v = Math.round(Math.abs(Number(l && l.valor) || 0) * 100);
    const c = contaEscritorio(l && l.contaId); const g = c && grupoEscritorio(c.grupo);
    if (!g) continue;
    const lado = (g.sinal < 0 ? -1 : 1) * ((Number(l.valor) || 0) < 0 ? -1 : 1);
    const oposta = noBancoSemPar.find((m) => Math.round(Math.abs(Number(m.valor) || 0) * 100) === v && (Number(m.valor) < 0 ? -1 : 1) === -lado);
    if (oposta) invertidos[l.id] = { extrato: oposta };
  }
  const soma = (lista, f) => Math.round(lista.reduce((s, x) => s + Math.abs(Number(f(x)) || 0), 0) * 100) / 100;
  return {
    casados, noBancoSemPar, contabilizadoSemPar, foraDoBanco, naoLancar, duplicados, invertidos,
    resumo: {
      movimentos: doBanco.length,
      lancamentos: candidatos.filter((c) => !c.nao || c.usado).length,
      casados: casados.length,
      noBanco: noBancoSemPar.length,
      contabilizado: contabilizadoSemPar.length,
      valorNoBanco: soma(noBancoSemPar, (m) => m.valor),
      valorContabilizado: soma(contabilizadoSemPar, (l) => l.valor),
      ignoradas: foraDoBanco.length,
      naoLancar: naoLancar.length,
      certos: casados.filter((c) => c.certeza !== "duvida").length,
      duvidas: casados.filter((c) => c.certeza === "duvida").length,
    },
  };
}

// Um par é certo quando não há com o que confundir, quando a pista decidiu
// ou quando trocar não mudaria nada. Esses entram conferidos sozinhos.
function casamentoCerto(c) {
  return !!c && c.certeza !== "duvida";
}

// ── Pistas para desempatar o casamento ──────────────────────────
// O banco escreve pouco: "Pagamento Pix 34.030.843 0001-60" ou
// "Pix ***.144.048-**". Três jeitos de reconhecer de quem é:
//   1. o CPF/CNPJ do fornecedor no cadastro;
//   2. o que já se aprendeu: linhas antigas com esse documento foram
//      lançadas para esse fornecedor (só vale se foi sempre o mesmo);
//   3. palavras do histórico que estão no lançamento (o nome de quem pagou).
// A data não entra: no lançamento é o dia em que se contabilizou.
function pistasDoCasamento(lancamentos, opcoes) {
  const o = opcoes || {};
  const so = (t) => String(t || "").replace(/\D/g, "");
  const nome = (t) => efSemAcento(t || "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const docsDoFornecedor = {};
  for (const f of o.fornecedores || []) {
    const d = so(f && (f.cnpjCpf || f.cnpj || f.cpf || f.documento));
    if (!d) continue;
    if (f.id) docsDoFornecedor["id:" + f.id] = d;
    if (f.nome) docsDoFornecedor["nome:" + nome(f.nome)] = d;
  }
  // documento do histórico → fornecedores já lançados com ele
  const aprendido = {};
  for (const l of o.historico || lancamentos || []) {
    if (!l || !l.historicoBanco) continue;
    const d = documentoDoHistorico(l.historicoBanco);
    const quem = nome(l.fornecedor || "");
    if (!d || !quem) continue;
    (aprendido[d] = aprendido[d] || new Set()).add(quem);
  }
  const genericas = new Set(["pagamento", "recebimento", "transferencia", "outra", "emitido", "recebido", "pix", "debito", "credito",
    "conv", "ltda", "comercio", "servicos", "servico", "materiais", "material", "construcao", "obra", "obras", "de", "da", "do", "e"]);
  return {
    pontos(m, l) {
      if (!m || !l) return 0;
      let p = 0;
      const doc = documentoDoHistorico(m.historico);
      if (doc) {
        if (l.historicoBanco && documentoDoHistorico(l.historicoBanco) === doc) p += 10;
        const dCad = docsDoFornecedor["id:" + (l.fornecedorId || "")] || docsDoFornecedor["nome:" + nome(l.fornecedor)] || "";
        if (dCad && (dCad.indexOf(doc) >= 0 || doc.indexOf(dCad) >= 0)) p += 10;
        const ja = aprendido[doc];
        if (ja && ja.size === 1 && ja.has(nome(l.fornecedor))) p += 8;
      }
      const palavrasM = new Set(chaveDoHistorico(m.historico).split(" ").filter((w) => w.length >= 4 && !genericas.has(w)));
      if (palavrasM.size) {
        const texto = " " + nome([l.fornecedor, l.descricao, l.cliente, l.projeto].join(" ")) + " ";
        let achadas = 0;
        palavrasM.forEach((w) => { if (texto.indexOf(" " + w + " ") >= 0) achadas++; });
        p += Math.min(6, achadas * 3);
      }
      return p;
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

// ── Débitos × créditos do mês (o "check" da planilha de análise) ─
// Soma os débitos e os créditos do extrato da conta (sem as idas e vindas da
// aplicação, que ficam à parte) e as saídas e entradas contabilizadas no
// mês. O que foi contabilizado e não passou pelo extrato (comissão recebida
// e repassada, por exemplo) aparece nos DOIS lados com o mesmo valor — as
// duas diferenças têm que ser iguais. Diferenças desiguais querem dizer
// lançamento faltando ou com o sinal invertido: um valor V do lado errado
// afasta as duas diferenças em 2V.
function efEhAplicacaoFinanceira(historico) {
  const h = efSemAcento(historico);
  return /\brdc\b|^aplicacao|^resgate|credito resgate|\bcdb\b|deb fundo/.test(h);
}
function ehRendimentoDaAplicacao(l) {
  if (!l || l.contaId !== "rec_financeira") return false;
  return (l.origem && l.origem.tipo === "rendimento") || l.contaBanco === "nao" || /aplica|rendimento|renda fixa/i.test(String(l.descricao || ""));
}
function checagemDebitoCredito(movimentos, lancamentos, mes) {
  const c = (v) => efCentavos(v);
  const ext = { debitos: 0, creditos: 0, aplicacoes: 0, resgates: 0, linhas: 0 };
  for (const m of movimentos || []) {
    if (!m || mesDoMovimento(m) !== String(mes)) continue;
    const v = Number(m.valor) || 0;
    if (!v) continue;
    if (!efEhMovimento(m.historico)) {
      if (efEhAplicacaoFinanceira(m.historico)) { if (v < 0) ext.aplicacoes -= v; else ext.resgates += v; }
      continue;
    }
    ext.linhas++;
    if (v < 0) ext.debitos -= v; else ext.creditos += v;
  }
  const base = { saidas: 0, entradas: 0, rendimento: 0, linhas: 0 };
  const lista = [];
  for (const l of lancamentos || []) {
    if (!l || String(l.competencia) !== String(mes)) continue;
    if (compraNoCartaoDoEscritorio(l)) continue;           // no banco quem aparece é a fatura
    const v = Number(l.valor) || 0;
    if (!v) continue;
    if (ehRendimentoDaAplicacao(l)) { base.rendimento += v; continue; }
    if (l.contaBanco === "nao") continue;                  // não passou pelo banco (custo e reserva da engenharia)
    const conta = contaEscritorio(l.contaId);
    const g = conta && grupoEscritorio(conta.grupo);
    const sinalConta = g && g.sinal ? g.sinal : 1;
    const entra = (sinalConta > 0) === (v > 0);           // estorno (valor negativo) vai ao contrário
    base.linhas++;
    if (entra) base.entradas += Math.abs(v); else base.saidas += Math.abs(v);
    lista.push({ l, entra, valor: c(Math.abs(v)) });
  }
  for (const k in ext) ext[k] = k === "linhas" ? ext[k] : c(ext[k]);
  for (const k in base) base[k] = k === "linhas" ? base[k] : c(base[k]);
  const difDebito = c(base.saidas - ext.debitos);
  const difCredito = c(base.entradas - ext.creditos);
  const desvio = c(difCredito - difDebito);
  const bate = Math.abs(desvio) < 0.01;
  // um valor do lado errado: entrou como saída (ou o contrário) — afasta 2V
  const metade = c(Math.abs(desvio) / 2);
  const suspeitos = bate ? [] : lista.filter((x) => Math.abs(x.valor - metade) < 0.01 || Math.abs(x.valor - Math.abs(desvio)) < 0.01)
    .map((x) => ({ ...x.l, _lado: x.entra ? "entrada" : "saída" }));
  return { extrato: ext, base, difDebito, difCredito, desvio, bate,
    foraDoExtrato: bate ? difDebito : null, suspeitos };
}

// A aplicação pelo caminho dela: o saldo anterior + o que foi aplicado − o
// que foi resgatado é o que estaria lá sem rendimento; o informado menos
// isso é o rendimento. Tem que bater com banco + aplicação − calculado.
function rendimentoPelaAplicacao(saldoAnterior, aplicacoes, resgates, saldoAtual) {
  if (saldoAnterior == null || saldoAtual == null) return null;
  const principal = efCentavos(Number(saldoAnterior) + (Number(aplicacoes) || 0) - (Number(resgates) || 0));
  return { principal, rendimento: efCentavos(Number(saldoAtual) - principal) };
}
function extratosComArquivo(extratos, movimentos, origem, agora) {
  const atuais = (extratos && typeof extratos === "object") ? extratos : {};
  const doArquivo = extratoParaGuardar(movimentos || []);
  // Só substitui o mês que o arquivo traz de verdade (com movimento). O
  // extrato de outubro começa com o "SALDO ANTERIOR" de 30/09: essa linha
  // sozinha não pode apagar o setembro inteiro que já estava guardado —
  // ela só se junta a ele.
  const valido = (x) => /^\d{4}-\d{2}$/.test(x);
  const meses = [...new Set(doArquivo.filter((m) => efEhMovimento(m.historico)).map(mesDoMovimento).filter(valido))];
  const soSaldo = [...new Set(doArquivo.map(mesDoMovimento).filter(valido))].filter((x) => meses.indexOf(x) < 0);
  const novos = {};
  for (const [k, v] of Object.entries(atuais)) {
    const sobra = ((v && v.movimentos) || []).filter((m) => meses.indexOf(mesDoMovimento(m)) < 0);
    novos[k] = { ...v, movimentos: sobra };
  }
  for (const mes of meses) {
    novos[mes] = { ...(novos[mes] || {}), origem: origem || "", atualizadoEm: agora || new Date().toISOString(),
      movimentos: doArquivo.filter((m) => mesDoMovimento(m) === mes), ignorados: ((novos[mes] || {}).ignorados) || {} };
  }
  for (const mes of soSaldo) {
    const ja = new Set(Object.values(novos).flatMap((v) => ((v && v.movimentos) || []).map((m) => m.id)));
    const juntar = doArquivo.filter((m) => mesDoMovimento(m) === mes && !ja.has(m.id));
    if (!juntar.length) continue;
    const atual = novos[mes] || { origem: origem || "", atualizadoEm: agora || new Date().toISOString(), movimentos: [], ignorados: {} };
    novos[mes] = { ...atual, movimentos: ((atual.movimentos) || []).concat(juntar) };
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
    && /^s\s*a\s*l\s*d\s*o/.test(efSemAcento(m.historico || "")) && !/bloquead/.test(efSemAcento(m.historico || ""))
    && Number.isFinite(Number(m.valor)));
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
  // O CPF mascarado do Pix às vezes é o de quem PAGA (o próprio titular), e
  // aparece igual em pagamentos a lojas diferentes. Documento que já foi de
  // mais de um fornecedor não identifica ninguém: não vale como pista.
  const comDoc = doc ? lista.filter((l) => mesmoLado(l) && documentoDoHistorico(l.historicoBanco) === doc) : [];
  const docUnico = new Set(comDoc.map((l) => efSemAcento(l.fornecedorId || l.fornecedor || l.contaId))).size === 1;
  const achado = (docUnico && comDoc[0])
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

// ── O palpite: quando não há linha igual para copiar ────────────
// Lê o histórico do banco e o que já foi lançado (no escritório e nas
// obras) e propõe o resto do lançamento, com o porquê de cada campo:
//  - a CONTA da obra pela palavra no extrato ("empreiteiro", "pedreiro",
//    "frete", "eletricista"...);
//  - a OBRA pelo nome citado ("Jacarezinho"); citada mais de uma, fica a
//    que tem pagamentos dessa conta (ou desse fornecedor);
//  - o FORNECEDOR pelo nome no extrato ("SANEPAR") ou, sem nome, pelo
//    histórico: quem recebe quase todos os pagamentos dessa conta nessa obra;
//  - e o caminho de volta: fornecedor conhecido traz a conta e a obra em
//    que ele costuma entrar.
// Só propõe. Nada disso lança sozinho: o formulário abre preenchido e a
// pessoa confere.
const EF_PALAVRAS_GENERICAS = new Set(["material", "materiais", "outros", "outras", "diversos", "taxas", "servicos",
  "adicionais", "construcao", "comercio", "ltda", "loja", "casa", "obra", "obras", "equipamentos", "geral", "compra",
  "compras", "pagamento", "pagamentos", "empresa", "industria", "distribuidora", "mercado", "deposito", "modulo",
  "lotes", "infraestrutura", "alvara", "reforma", "eireli", "epp", "me", "sa", "aluguel", "locacao", "receita",
  "conta", "contas", "vale", "sobre", "escritorio", "reembolso", "reembolsos", "retirada", "transf"]);
function efPalavras(t, min) {
  return efSemAcento(t).replace(/[^a-z0-9]+/g, " ").split(" ")
    .filter((w) => w.length >= (min || 4) && !/^\d+$/.test(w) && !EF_PALAVRAS_GENERICAS.has(w));
}
function efTextoTem(alvo, w) {
  if (alvo.indexOf(" " + w + " ") >= 0) return true;
  // singular/plural: "pedreiros" no plano, "pedreiro" no extrato
  if (w.endsWith("s") && alvo.indexOf(" " + w.slice(0, -1) + " ") >= 0) return true;
  return alvo.indexOf(" " + w + "s ") >= 0;
}
// O favorecido gravado na conta ("Carlos Trindade - Empreiteiro") é o
// fornecedor do cadastro ("Carlos Trindade")?
function efMesmoFornecedor(nomeCadastro, favorecido) {
  const a = efPalavras(nomeCadastro, 3);
  if (!a.length) return false;
  const alvo = " " + efSemAcento(favorecido).replace(/[^a-z0-9]+/g, " ") + " ";
  return a.every((w) => alvo.indexOf(" " + w + " ") >= 0);
}
function efDominante(contagem, minimo, ignorar) {
  const todos = Object.entries(contagem);
  const total = todos.reduce((t, x) => t + x[1], 0);
  // o que não pode ganhar ("Outros") ainda conta no total
  const lista = todos.filter((x) => x[0] !== ignorar).sort((x, y) => y[1] - x[1]);
  if (!lista.length || lista[0][1] < (minimo || 2) || lista[0][1] / total < 0.6) return null;
  return { chave: lista[0][0], vezes: lista[0][1], total };
}

function efSemCategoria(nome) {
  const t = String(nome || "");
  const i = t.indexOf(" - ");
  return i > 0 ? t.slice(i + 3) : t;
}
const EF_DF_CACHE = typeof WeakMap !== "undefined" ? new WeakMap() : null;
function efFrequenciaNoCatalogo(insumos) {
  if (EF_DF_CACHE && EF_DF_CACHE.has(insumos)) return EF_DF_CACHE.get(insumos);
  const df = new Map();
  for (const ins of insumos || []) {
    if (!ins) continue;
    for (const w of new Set(efPalavras(ins.nome, 5))) df.set(w, (df.get(w) || 0) + 1);
  }
  if (EF_DF_CACHE) EF_DF_CACHE.set(insumos, df);
  return df;
}

function palpiteDoExtrato(movimento, ctx) {
  const m = movimento || {}, c = ctx || {};
  if (!(Number(m.valor) < 0)) return null;      // por ora, só o que SAI (custos)
  const texto = String(m.historico || "");
  const alvo = " " + efSemAcento(texto).replace(/[^a-z0-9]+/g, " ") + " ";
  const obras = (c.obras || []).filter((o) => o && o.id);
  const clientes = c.clientes || [];
  const fornecedores = (c.fornecedores || []).filter((f) => f && f.nome && f.ativo !== false);
  const plano = (c.plano || (typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : []))
    .filter((x) => x && x.grupo !== "receitas" && x.grupo !== "excluidas");
  const motivos = [];

  // 1. o fornecedor pelo CNPJ/CPF inteiro no extrato, ou pelo nome escrito
  let forn = null;
  let melhor = 0;
  const docs = (texto.match(/\d[\d.\/\s-]{9,20}\d/g) || []).map((x) => x.replace(/\D/g, "")).filter((x) => x.length === 11 || x.length === 14);
  if (docs.length) {
    const doDoc = fornecedores.filter((f) => docs.indexOf(String(f.cnpjCpf || "").replace(/\D/g, "")) >= 0);
    if (doDoc.length === 1) { forn = doDoc[0]; motivos.push(`fornecedor ${forn.nome}: o CNPJ/CPF do extrato é o do cadastro`); }
  }
  for (const f of forn ? [] : fornecedores) {
    if (f.nome === EF_FORNECEDOR_OUTROS) continue;
    const ws = efPalavras(f.nome, 4).slice(0, 3);
    if (!ws.length || !ws.every((w) => efTextoTem(alvo, w))) continue;
    const peso = ws.join("").length;
    if (peso > melhor) { melhor = peso; forn = f; }
  }
  if (forn && !motivos.length) motivos.push(`fornecedor ${forn.nome}: o nome está no extrato`);

  // contas gravadas nas obras, para contar o histórico
  const contasDe = (o) => (o.contasPagar || []).filter(Boolean);
  // obras citadas pelo nome; o nome inteiro ("Jacarezinho Módulo 1") vale
  // mais que uma palavra dele ("Jacarezinho", que é de seis obras)
  const citadas = obras.map((o) => {
    const inteiro = efSemAcento(o.nome).replace(/[^a-z0-9]+/g, " ").trim();
    const bate = efPalavras(o.nome, 4).filter((w) => efTextoTem(alvo, w)).length;
    return { o, bate: bate + (bate && inteiro && alvo.indexOf(" " + inteiro + " ") >= 0 ? 10 : 0) };
  }).filter((x) => x.bate > 0);

  // 2. a conta da obra pela palavra. Mais de uma palavra bate ("conta de
  // água da casa dos pedreiros")? Fica a conta que essas obras já usam;
  // empate, a palavra mais longa.
  const candidatas = [];
  for (const ct of plano) {
    const w = efPalavras(ct.nome, 4).find((x) => efTextoTem(alvo, x));
    if (w) candidatas.push({ ct, w });
  }
  const baseHist = citadas.length ? citadas.map((x) => x.o) : obras;
  const usos = (ct) => baseHist.reduce((t, o) => t + contasDe(o).filter((x) => x.contaId === ct.id).length, 0);
  candidatas.sort((a, b) => (usos(b.ct) - usos(a.ct)) || (b.w.length - a.w.length));
  let conta = candidatas.length ? candidatas[0].ct : null;
  if (conta) motivos.push(`conta ${conta.nome}: a palavra “${candidatas[0].w}” está no extrato`);
  const ehDoForn = (x, f) => !!f && (x.prestadorId === f.id || efMesmoFornecedor(f.nome, x.favorecido));

  // 3. fornecedor conhecido, conta não: a conta em que ele costuma entrar
  if (forn && !conta) {
    const cont = {};
    for (const o of obras) for (const x of contasDe(o)) if (ehDoForn(x, forn) && x.contaId) cont[x.contaId] = (cont[x.contaId] || 0) + 1;
    const d = efDominante(cont, 2);
    const ct = d && plano.find((x) => x.id === d.chave);
    if (ct) { conta = ct; motivos.push(`conta ${ct.nome}: ${d.vezes} de ${d.total} pagamentos a ${forn.nome}`); }
  }

  // 3b. nem palavra de conta nem fornecedor: o item do catálogo citado
  // ("cimento", "areia", "vibrador") diz a conta — a do item, ou Material
  // Só com obra citada no extrato (uma retirada de sócio não é material de
  // obra), e só com palavra que distingue o item: o prefixo de categoria
  // ("Elétrica - ", "Ferramentas - ") e a palavra que aparece em muitos
  // itens não dizem nada.
  if (!conta && citadas.length && (c.insumos || []).length) {
    const deObra = new Set(obras.flatMap((o) => efPalavras(o.nome, 4)));
    const df = efFrequenciaNoCatalogo(c.insumos);
    let achou = null; melhor = 0;
    for (const ins of c.insumos) {
      if (!ins || ins.ativo === false) continue;
      for (const nome of [efSemCategoria(ins.nome)].concat(ins.aliases || [])) {
        const ws = efPalavras(nome, 5).filter((w) => !deObra.has(w) && !EF_PALAVRAS_DO_BANCO.has(w) && (df.get(w) || 0) <= 12);
        const bate = ws.filter((w) => efTextoTem(alvo, w));
        const peso = bate.join("").length;
        if (peso > melhor) { melhor = peso; achou = { ins, w: bate[0] }; }
      }
    }
    const ct = achou && plano.find((x) => x.id === (achou.ins.contaPadrao || "material"));
    if (ct) { conta = ct; motivos.push(`conta ${ct.nome}: “${achou.w}” é do item ${achou.ins.nome} do catálogo`); }
  }

  // 4. a obra: citada no extrato; entre as citadas, a que tem essa conta
  const pontos = (o) => {
    const cs = contasDe(o);
    return {
      conta: conta ? cs.filter((x) => x.contaId === conta.id).length : 0,
      forn: forn ? cs.filter((x) => ehDoForn(x, forn)).length : 0,
      ultima: cs.reduce((u, x) => { const d = String(x.pagoEm || x.vencimento || ""); return d > u ? d : u; }, ""),
    };
  };
  // o nome inteiro citado manda; depois, o histórico
  const ordem = (a, b) => (Math.floor(b.bate / 10) - Math.floor(a.bate / 10)) || (b.p.forn - a.p.forn) || (b.p.conta - a.p.conta)
    || (b.bate - a.bate) || b.p.ultima.localeCompare(a.p.ultima);
  let obra = null;
  if (citadas.length) {
    const lista = citadas.map((x) => ({ ...x, p: pontos(x.o) })).sort(ordem);
    const [a, b] = lista;
    const decide = !b || a.bate > b.bate || a.p.forn > b.p.forn || a.p.conta > b.p.conta;
    if (decide) {
      obra = a.o;
      const pq = a.p.forn ? `é onde estão os pagamentos a ${forn.nome}`
        : a.p.conta ? `é onde estão os pagamentos de ${conta.nome}` : "o nome está no extrato";
      motivos.push(`obra ${obra.nome}: ${citadas.length > 1 ? "citada no extrato e " : ""}${pq}`);
    }
  } else if (forn || conta) {
    // nenhuma citada: a obra onde esse fornecedor (ou essa conta) mais aparece
    const cont = {};
    for (const o of obras) { const p = pontos(o); const n = forn ? p.forn : 0; if (n) cont[o.id] = n; }
    const d = efDominante(cont, 2);
    if (d) { obra = obras.find((o) => o.id === d.chave); motivos.push(`obra ${obra.nome}: ${d.vezes} de ${d.total} pagamentos a ${forn.nome}`); }
  }

  // 5. conta e obra conhecidas, fornecedor não: quem recebe essa conta nessa obra
  let fornTexto = "";
  if (!forn && conta) {
    const fonte = obra ? [obra] : obras;
    const cont = {};
    for (const o of fonte) for (const x of contasDe(o)) {
      if (x.contaId !== conta.id) continue;
      const nome = String(x.favorecido || "").trim() || (fornecedores.find((f) => f.id === x.prestadorId) || {}).nome || "";
      if (nome) cont[nome] = (cont[nome] || 0) + 1;
    }
    const d = efDominante(cont, 2, EF_FORNECEDOR_OUTROS);
    if (d) {
      forn = fornecedores.find((f) => efMesmoFornecedor(f.nome, d.chave)) || null;
      if (!forn) fornTexto = d.chave;
      motivos.push(`fornecedor ${forn ? forn.nome : d.chave}: ${d.vezes} de ${d.total} pagamentos de ${conta.nome}${obra ? " nesta obra" : ""}`);
    }
  }

  const campos = {};
  if (obra && conta) {
    const cli = clientes.find((x) => x && x.id === obra.clienteId) || null;
    const emp = typeof ehEmpreendimento === "function" ? ehEmpreendimento(cli) : !!(cli && cli.servicos && cli.servicos.empreendimento);
    Object.assign(campos, {
      unidadeId: emp ? "empreendimento" : "gestao_obras", contaFonte: "obra", contaId: conta.id,
      clienteId: cli ? cli.id : "", cliente: cli ? cli.nome : "", empreendimentoId: emp && cli ? cli.id : "",
      obraIdAlvo: obra.id, projeto: obra.nome || "",
    });
  }
  if (forn) { campos.fornecedorId = forn.id; campos.fornecedor = forn.nome; }
  else if (fornTexto) campos.fornecedor = fornTexto;
  if (!Object.keys(campos).length) return null;
  return { campos, motivos, naObra: campos.contaFonte === "obra" };
}

// A sugestão que a fila mostra e o formulário abre: a linha igual do mês
// passado manda; o palpite completa o que ela não diz — ou propõe tudo,
// quando não há linha igual (ou a igual veio de uma obra pela ponte, que não
// diz a conta da obra). O "✓ Lançar assim" continua só para a linha igual.
function sugestaoCompletaDoExtrato(movimento, lancamentos, ctx) {
  const est = sugestaoDeEstorno(movimento, lancamentos, ctx);
  if (est) return est;
  const naObra = contaDaObraParaALinha(movimento, lancamentos, ctx);
  if (naObra) return naObra;
  const parcelaProj = parcelaDeProjetoParaALinha(movimento, lancamentos, ctx);
  if (parcelaProj) return parcelaProj;
  const exato = sugestaoDoExtrato(movimento, lancamentos);
  const p = palpiteDoExtrato(movimento, { ...(ctx || {}), lancamentos });
  if (!p) return exato;
  if (exato && !exato.daObra) {
    const campos = { ...exato.campos };
    const doForn = !campos.fornecedorId && !(campos.fornecedor && campos.fornecedor !== EF_FORNECEDOR_OUTROS);
    if (doForn && (p.campos.fornecedorId || p.campos.fornecedor)) {
      if (p.campos.fornecedorId) campos.fornecedorId = p.campos.fornecedorId;
      campos.fornecedor = p.campos.fornecedor;
      return { ...exato, campos, motivos: p.motivos.filter((x) => /^fornecedor /.test(x)) };
    }
    return exato;
  }
  const campos = p.naObra ? { ...p.campos } : { ...((exato && exato.campos) || {}), ...p.campos };
  return { campos, de: exato ? exato.de : null, porDocumento: false, daObra: p.naObra || !!(exato && exato.daObra),
    palpite: true, motivos: p.motivos };
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
    // receita não tem fornecedor, nem quando a linha igual de antes tinha
    ...(contaDeEntradaNoEscritorio(((sugestao && sugestao.campos) || {}).contaId) ? { fornecedor: "", fornecedorId: "" } : {}),
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
  // já passou por aqui (o sinal do banco saiu e o estorno ficou negativo):
  // uma segunda passada não pode desfazer o estorno
  if (sinalDoBanco == null && l.estorno && efValorDoCampo(l.valor) < 0) return { ...resto, valor: -v, estorno: true };
  if (!ehEstornoNaConta(l.contaId, sinalDoBanco)) return { ...resto, valor: v };
  return { ...resto, valor: -v, estorno: true };
}

// Um clique: a linha igual à do mês passado vai com a mesma classificação,
// sem abrir o formulário. Só quando a sugestão basta — conta do escritório,
// cliente/obra que a conta pede, mês aberto. Senão, devolve o porquê e a
// tela abre o formulário.
function lancamentoRapidoDoExtrato(movimento, mes, sugestao, fechamentos, obras, lancamentos) {
  if (!sugestao || !sugestao.campos || !sugestao.campos.contaId) return { erro: "Sem lançamento igual para copiar." };
  if (sugestao.daObra) return { erro: "Custo de obra: confira no formulário." };
  // Regra das duas pontas: copiar um custo antigo só do escritório para um
  // cliente que hoje tem obra no VICKE deixaria a obra sem a conta.
  const cs = sugestao.campos;
  if ((cs.unidadeId === "gestao_obras" || cs.unidadeId === "empreendimento") && EF_CONTAS_COM_PONTA_NA_OBRA.indexOf(cs.contaId) >= 0
    && obrasDoDonoDoLancamento(cs, obras || []).length) {
    return { erro: "Este cliente tem obra no VICKE: escolha a conta em “Custo de uma obra” para entrar no escritório e na obra, ligado." };
  }
  if (ehReceitaDaGestao(sugestao.campos)) return { erro: "Receita da gestão: escolha a parcela do contrato no formulário." };
  const base = lancamentoDaLinhaDoExtrato(movimento, mes, sugestao);
  const l = comSinalDeEstorno({ ...base, valor: Math.round(Math.abs(Number((movimento || {}).valor) || 0) * 100) / 100 });
  const ehEmp = l.unidadeId === "empreendimento";
  const erros = validarLancamentoEscritorio({ ...l, clienteId: l.clienteId || l.cliente,
    obraId: l.unidadeId === "gestao_obras" ? l.obraId : l.projeto,
    empreendimentoId: ehEmp ? l.empreendimentoId : l.projeto }, { fechamentos });
  if (erros.length) return { erro: erros[0] };
  // Engenheiro de um cliente com engenharia guardada: paga da reserva (o
  // custo já entrou no recebimento); o que passar dela é custo em Parceiros.
  if (lancamentos) {
    const daReserva = comoPagamentoDaReserva(l, lancamentos);
    if (daReserva) return { lancamento: daReserva };
  }
  return { lancamento: l };
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
  // mesma regra de obra-financeiro (padraoDaContaObra) — uma fonte só
  if (!plano && typeof padraoDaContaObra === "function") return padraoDaContaObra(contaId);
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

// ── Cliente novo de dentro do lançamento ────────────────────────
// O mínimo para o lançamento ter dono: nome, e se houver, documento e
// WhatsApp. O serviço marcado segue a unidade do lançamento (Projetos →
// projeto, Gestão → gestão de obra); o resto do cadastro se completa depois
// em Clientes. Empreendimento não nasce aqui: ele precisa da obra junto.
function clienteRapidoDoLancamento(campos, unidadeId, id) {
  const c = campos || {};
  const nome = String(c.nome || "").trim();
  if (!nome) return null;
  const doc = String(c.cpfCnpj || "").trim();
  const digitos = doc.replace(/\D/g, "");
  const hoje = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return {
    id, tipo: digitos.length === 14 ? "PJ" : "PF", nome, cpfCnpj: doc, email: "",
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "SP",
    representanteNome: "", representanteCpf: "",
    contatos: [{ id: id + "_c", nome: "", telefone: String(c.telefone || "").trim(), cargo: "", whatsapp: !!String(c.telefone || "").trim() }],
    observacoes: "", ativo: true, desde: hoje, status: "",
    servicos: { projeto: unidadeId === "projetos", acompanhamentoObra: false, gestaoObra: unidadeId === "gestao_obras", empreendimento: false },
    criadoEm: new Date().toISOString(), origem: "lancamento",
  };
}

// Conta de entrada (receita, venda, aporte, reserva): dinheiro que CHEGA não
// tem fornecedor — quem paga é o cliente, que já tem campo próprio.
function contaDeEntradaNoEscritorio(contaId) {
  const c = contaEscritorio(contaId);
  const g = c && grupoEscritorio(c.grupo);
  return !!(g && g.sinal > 0);
}
function semFornecedorNaEntrada(l) {
  if (!l || !contaDeEntradaNoEscritorio(l.contaId)) return l;
  return { ...l, fornecedor: "", fornecedorId: "" };
}

// Item do custo que ninguém preencheu: sem descrição, sem catálogo, sem preço.
function itemDoCustoEmBranco(x) {
  if (!x) return true;
  return !String(x.descricao || "").trim() && !x.insumoCodigo && !(Number(String(x.bruto || "").replace(/\./g, "").replace(",", ".")) > 0)
    && !(Number(String(x.unitario || "").replace(/\./g, "").replace(",", ".")) > 0);
}

function efNomeDoFornecedor(l) {
  // entrada não tem fornecedor: não vira "Outros" ao gravar
  if (l && contaDeEntradaNoEscritorio(l.contaId)) return "";
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

// Contas do escritório que, para um cliente/empreendimento com obra no VICKE,
// têm a outra ponta na obra: o custo nasce lá e atravessa.
const EF_CONTAS_COM_PONTA_NA_OBRA = ["pagamentos_compras", "emp_terreno", "emp_construcao", "emp_taxas"];

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

// Conta de entrada do escritório (receita): o papel anexado é o
// comprovante do que entrou — cheque, PIX, depósito —, nunca nota de compra
// com itens para lançar em obra.
function contaEhEntradaEscritorio(contaId) {
  const c = contaEscritorio(contaId);
  const g = c && grupoEscritorio(c.grupo);
  return !!(g && g.sinal > 0);
}

// O nome do papel lido, como a pessoa o reconhece. Cheque se diz cheque;
// numa receita, o papel é o comprovante do recebimento — a IA às vezes o
// lê como "pedido", e a tela dizia "Pedido 85".
function rotuloDoPapelLido(papel, entrada, textoExtra) {
  const pa = papel || {};
  const texto = [pa.descricao, pa.lidoComo, pa.fantasia, textoExtra].filter(Boolean).join(" ");
  if (/\bcheques?\b/i.test(texto)) return "Cheque";
  if (pa.tipo === "comprovante") return "Comprovante";
  if (entrada) return "Comprovante do recebimento";
  if (pa.tipo === "nfse") return "Nota de serviço";
  return pa.ehNota ? "Nota fiscal" : "Pedido";
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

// Receita Gestão de obra SEM contrato de gestão: entra também na obra, como
// conta paga de "Gerenciamento de obra", só quando o cadastro da obra diz
// que o cliente faz os pagamentos. Obra em que o dinheiro passa pelo
// escritório fica com a receita só no escritório.
function gestaoSemContratoVaiParaObra(obra) {
  return !!(obra && obra.clientePagaDireto);
}

function ehLigacaoDaGestao(origem) {
  const o = origem || {};
  // a conta avulsa de gestão (obra sem contrato) é uma transação comum de
  // duas pontas: excluir um lado apaga o outro, não reabre parcela
  if (o.avulsa) return false;
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
    // a referência guarda o "#n" do estorno que havia quando atravessou; se o
    // estorno foi desfeito depois, a parcela é a mesma pelo id
    return contas.find((c) => refDaParcela(c) === o.refId)
      || contas.find((c) => c.id === String(o.refId || "").split("#")[0]) || null;
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
    const veio = leva ? (leva > 0 ? `soma ${efMoedaCurta(leva)} que faltou em ${levaDe}`
      : `desconta ${efMoedaCurta(leva)} pago a mais em ${levaDe}`) : "";
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
    // Os papéis dos recebimentos (o cheque, o comprovante do PIX) ficam
    // também na parcela da obra: quem abre a conta da obra vê o papel.
    // Os que vieram de lançamento levam o id dele e saem junto com ele.
    const dosMovs = [];
    movs.forEach((m) => ((m && m.anexos) || []).forEach((a) => { if (a) dosMovs.push({ ...a, lancamentoId: m.lancamentoId || "" }); }));
    const juntos = (Array.isArray(c.anexos) ? c.anexos : []).filter((a) => a && !a.lancamentoId).concat(dosMovs);
    if (juntos.length) nc.anexos = juntos; else delete nc.anexos;
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
  const papeis = anexosDaTransacao(lan).filter((a) => a && (a.url || a.public_id));
  const mov = { lancamentoId: lan.id || "", em: em || `${comp}-01`, valor: estorno ? -valor : valor,
    ...(papeis.length ? { anexos: papeis.map((a) => ({ ...a })) } : {}) };
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

// ── Campo de valor em reais, formatado enquanto se digita ──────────
// A tela mostra 18.000,50; o que vai para o formulário é "18000,50" — sem
// ponto de milhar, que o leitor de número (numeroDeCampo, efNumero) leria
// como decimal quando não há vírgula. Os pontos são da tela: quem digita
// só põe os números e, se quiser centavos, a vírgula.
function valorBRDigitado(texto, opcoes) {
  const bruto = String(texto == null ? "" : texto);
  const neg = !!(opcoes && opcoes.negativo) && /^\s*-/.test(bruto);
  let t = bruto.replace(/[^\d,]/g, "");
  const i = t.indexOf(",");
  if (i >= 0) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/,/g, "").slice(0, 2);
  t = t.replace(/^0+(?=\d)/, "");
  if (t.charAt(0) === ",") t = "0" + t;
  return (neg ? "-" : "") + t;
}
// O valor que já estava no formulário (número, "18000,00", "18.000,00").
// Sem vírgula, o ponto é decimal — a mesma leitura do resto do sistema.
function valorBRDeFora(v) {
  if (v == null || v === "") return "";
  if (typeof v === "number") return Number.isFinite(v) ? valorBRDigitado(String(v).replace(".", ","), { negativo: true }) : "";
  const s = String(v).replace(/r\$/i, "").replace(/\s/g, "");
  return valorBRDigitado(s.indexOf(",") >= 0 ? s.replace(/\./g, "") : s.replace(".", ","), { negativo: true });
}
function valorBRNaTela(canon) {
  const s = String(canon || "");
  const neg = s.charAt(0) === "-";
  const partes = (neg ? s.slice(1) : s).split(",");
  const inteira = (partes[0] || "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "-" : "") + inteira + (partes.length > 1 ? "," + partes[1] : "");
}
// Ao sair do campo: sempre com os centavos.
function valorBRCompleto(canon) {
  const s = String(canon || "");
  if (!s || s === "-") return "";
  const neg = s.charAt(0) === "-";
  const partes = (neg ? s.slice(1) : s).split(",");
  if (!partes[0] && !partes[1]) return "";
  return (neg ? "-" : "") + (partes[0] || "0") + "," + String(partes[1] || "").padEnd(2, "0").slice(0, 2);
}

// Ctrl+V de um arquivo copiado no Explorer/Finder: o navegador entrega o
// arquivo no evento de colar. Só interessa o primeiro arquivo — texto colado
// (um número no campo de saldo, por exemplo) segue o caminho normal.
function arquivoDoColar(dados) {
  if (!dados) return null;
  const arquivos = dados.files;
  if (arquivos && arquivos.length) return arquivos[0];
  const itens = dados.items || [];
  for (let i = 0; i < itens.length; i++) {
    const it = itens[i];
    if (it && it.kind === "file" && typeof it.getAsFile === "function") {
      const f = it.getAsFile();
      if (f) return f;
    }
  }
  return null;
}

// ── Estorno no extrato: achar o lançamento original ─────────────
// "ESTORNO PIX EMITIDO · Estorno Pix 76.966.860/0001-46" é o banco
// devolvendo um pagamento. O original é a saída do MESMO valor, antes, de
// preferência com o mesmo documento (CNPJ/CPF) no histórico do banco ou no
// cadastro do fornecedor. Achado, o estorno vai para a mesma conta, unidade,
// cliente/obra e fornecedor — e, se o original nasceu numa obra, para a
// mesma conta e etapa da obra.
function ehLinhaDeEstorno(historico) { return /^estorno\b/.test(efSemAcento(historico)); }
function ladoNoBancoDoLancamento(l) {
  const c = contaEscritorio(l && l.contaId); const g = c && grupoEscritorio(c.grupo);
  return g ? (g.sinal < 0 ? -1 : 1) * ((Number(l.valor) || 0) < 0 ? -1 : 1) : 0;
}
function originalDoEstorno(movimento, lancamentos, opcoes) {
  const m = movimento || {};
  if (!ehLinhaDeEstorno(m.historico)) return null;
  const valor = efCentavos(Math.abs(Number(m.valor) || 0));
  if (!(valor > 0)) return null;
  const ladoOriginal = Number(m.valor) > 0 ? -1 : 1;     // o crédito estorna uma saída
  const ate = String(m.data || "").slice(0, 10);
  const desde = (() => { const d = new Date(ate + "T12:00:00Z"); if (isNaN(d)) return ""; d.setUTCDate(d.getUTCDate() - 180); return d.toISOString().slice(0, 10); })();
  const doc = documentoDoHistorico(m.historico);
  const digitos = (x) => String(x || "").replace(/\D/g, "");
  const fornPorId = new Map(((opcoes && opcoes.fornecedores) || []).filter(Boolean).map((f) => [f.id, f]));
  const jaEstornados = new Set((lancamentos || []).map((l) => l && l.estornoDe).filter(Boolean));
  const dataDe = (l) => String(l.lancadoEm || "").slice(0, 10);
  const cands = (lancamentos || []).filter((l) => l && !l.estorno && !jaEstornados.has(l.id)
    && Math.abs(efCentavos(Math.abs(Number(l.valor) || 0)) - valor) < 0.01
    && ladoNoBancoDoLancamento(l) === ladoOriginal
    && dataDe(l) && (!ate || dataDe(l) <= ate) && (!desde || dataDe(l) >= desde));
  if (!cands.length) return null;
  const pontos = (l) => {
    let p = 0;
    if (doc && documentoDoHistorico(l.historicoBanco) === doc) p += 10;
    const f = l.fornecedorId ? fornPorId.get(l.fornecedorId) : null;
    if (doc && f && digitos(f.cnpjCpf) === doc) p += 6;
    if (/pix/i.test(m.historico || "") && /pix/i.test(l.historicoBanco || "")) p += 1;
    return p;
  };
  const lista = cands.map((l) => ({ l, p: pontos(l) }))
    .sort((a, b) => (b.p - a.p) || dataDe(b.l).localeCompare(dataDe(a.l)));
  const [a, b] = lista;
  // Empate sem pista (dois pagamentos do mesmo valor): se os empatados têm a
  // MESMA classificação — três taxas iguais da prefeitura na mesma obra —,
  // qualquer um serve e o estorno sai igual. Se diferem, não se chuta.
  if (b && a.p === b.p && a.p < 6) {
    const chave = (l) => [l.contaId, l.unidadeId, l.clienteId || l.cliente, l.projeto, l.obraId, l.empreendimentoId,
      efSemAcento(l.fornecedor), (l.origem || {}).obraId, (l.origem || {}).contaObra].map((x) => String(x || "")).join("|");
    const empatados = lista.filter((x) => x.p === a.p);
    if (empatados.some((x) => chave(x.l) !== chave(a.l))) return null;
  }
  return { lancamento: a.l, porDocumento: a.p >= 6 };
}
// A sugestão do estorno: os campos do original. Original que nasceu numa
// obra volta para a obra, na mesma conta e etapa (item a item, se eram
// vários) — e a tela grava como estorno.
// A conta da obra que é a outra ponta de um lançamento da base antiga, que
// veio sem ligação: o mesmo papel (doc = documento) ou o mesmo valor pago até
// 3 dias de diferença — e que nenhum outro lançamento já reclame para si.
function contasDaObraSemLigacao(o, obras, lancamentos) {
  const dia = String((o && o.lancadoEm) || "").slice(0, 10);
  const valor = efCentavos(Math.abs(Number(o && o.valor) || 0));
  const achadas = [], peloPapel = [];
  for (const ob of obras || []) {
    if (!ob) continue;
    for (const k of (ob.contasPagar || [])) {
      if (!k || !k.pago || k.estorno) continue;
      const v = efCentavos(Math.abs(Number(k.valorPago) || Number(k.valor) || 0));
      const mesmoPapel = !!o.documento && String(k.doc || "") === String(o.documento);
      // mesmo valor no mesmo dia — ou até 3 dias de diferença (a obra anota o
      // dia em que lançou, o escritório o dia do banco)
      const mesmoDia = Math.abs(v - valor) < 0.01 && efDias(String(k.pagoEm || "").slice(0, 10), dia) <= 3;
      if (!mesmoPapel && !mesmoDia) continue;
      if (lancamentosLigadosAsContas(lancamentos, ob.id, [k]).length) continue;
      (mesmoPapel ? peloPapel : achadas).push({ ob, k });
    }
  }
  // o mesmo papel decide: duas RRTs iguais no mesmo dia se separam pelo número
  return peloPapel.length ? peloPapel : achadas;
}
// As obras do dono do lançamento (cliente da gestão ou empreendimento).
function obrasDoDonoDoLancamento(o, obras) {
  const origem = (o && o.origem) || {};
  if (origem.obraId) return (obras || []).filter((x) => x && x.id === origem.obraId);
  const dono = (o && (o.empreendimentoId || o.clienteId)) || "";
  return dono ? (obras || []).filter((x) => x && x.clienteId === dono) : [];
}

function sugestaoDeEstorno(movimento, lancamentos, ctx) {
  const c = ctx || {};
  const achado = originalDoEstorno(movimento, lancamentos, c);
  if (!achado) return null;
  const o = achado.lancamento;
  const dia = String(o.lancadoEm || "").slice(0, 10).split("-").reverse().join("/");
  const nomeConta = (contaEscritorio(o.contaId) || {}).nome || o.contaId;
  const motivos = [`estorno do lançamento de ${dia}: ${nomeConta}${o.fornecedor ? " · " + o.fornecedor : ""}${o.projeto ? " · " + o.projeto : ""}`
    + (achado.porDocumento ? " (mesmo CNPJ/CPF)" : " (mesmo valor)")];
  const desc = "Estorno — " + String(o.descricao || nomeConta).replace(/^estorno\s*[—-]\s*/i, "");
  const origem = o.origem || {};
  let obra = origem.obraId ? ((c.obras || []).find((x) => x && x.id === origem.obraId) || null) : null;
  let contasDaObra = obra ? contasLigadasAoLancamento(obra, o) : [];
  // Regra das duas pontas: o que existe no escritório E na obra/empreendimento
  // estorna nas duas. Original de obra que não está ligado (veio da base
  // antiga) procura a conta dele na obra — mesmo papel, ou mesmo valor no
  // mesmo dia — e, achando uma só, liga junto com o estorno. Não achando,
  // não estorna só de um lado: manda para o formulário, já no caminho da obra.
  let ligarOriginal = null;
  const ladoDeObra = o.unidadeId === "gestao_obras" || o.unidadeId === "empreendimento" || !!origem.obraId;
  if (ladoDeObra && !(obra && contasDaObra.length)) {
    const dono = o.empreendimentoId || o.clienteId || "";
    const obrasDele = origem.obraId ? (obra ? [obra] : [])
      : (dono ? (c.obras || []).filter((x) => x && x.clienteId === dono) : []);
    if (obrasDele.length || origem.obraId) {
      const candidatas = contasDaObraSemLigacao(o, obrasDele, lancamentos);
      if (candidatas.length === 1) {
        obra = candidatas[0].ob; contasDaObra = [candidatas[0].k];
        ligarOriginal = { id: o.id, origem: { obraId: obra.id, tipo: "conta", refId: candidatas[0].k.id, contaObra: candidatas[0].k.contaId } };
      } else {
        const ob0 = obrasDele.length === 1 ? obrasDele[0] : null;
        const cli = (c.clientes || []).find((x) => x && x.id === ((ob0 && ob0.clienteId) || dono)) || null;
        const emp = ehEmpreendimento(cli) || o.unidadeId === "empreendimento";
        const nomes = obrasDele.map((x) => x.nome).filter(Boolean).join(", ") || "da obra";
        return { campos: { unidadeId: emp ? "empreendimento" : "gestao_obras", contaFonte: "obra", contaId: "",
            clienteId: cli ? cli.id : (o.clienteId || ""), cliente: cli ? cli.nome : (o.cliente || ""), empreendimentoId: emp ? (cli ? cli.id : dono) : "",
            obraIdAlvo: ob0 ? ob0.id : "", projeto: ob0 ? (ob0.nome || "") : (o.projeto || ""),
            fornecedor: o.fornecedor || "", fornecedorId: o.fornecedorId || "", descricao: desc, estornoDe: o.id },
          de: o, estorno: true, daObra: true, naObra: true, motivos,
          bloqueio: `O lançamento original está só no escritório — a obra ${nomes} não tem a conta dele ligada. `
            + "Escolha a conta e a etapa da obra para o estorno sair nas duas bases." };
      }
    }
  }
  if (obra && contasDaObra.length) {
    const cli = (c.clientes || []).find((x) => x && x.id === obra.clienteId) || null;
    const emp = ehEmpreendimento(cli);
    const c0 = contasDaObra[0];
    const campos = {
      unidadeId: emp ? "empreendimento" : "gestao_obras", contaFonte: "obra", contaId: c0.contaId,
      clienteId: cli ? cli.id : "", cliente: cli ? cli.nome : "", empreendimentoId: emp && cli ? cli.id : "",
      obraIdAlvo: obra.id, projeto: obra.nome || "", fornecedor: o.fornecedor || "", fornecedorId: o.fornecedorId || "",
      descricao: desc, estornoDe: o.id, ...(ligarOriginal ? { ligarOriginal } : {}),
    };
    if (contasDaObra.length === 1) campos.etapaUnica = c0.etapa || "";
    else campos.itens = contasDaObra.map((x) => ({ descricao: x.descricao || "", insumoCodigo: x.insumoCodigo || "",
      grupoMaterial: x.grupoMaterial || "", quantidade: Math.abs(Number(x.quantidade) || 1), unidade: x.unidade || "vb",
      unitario: Math.abs(Number(x.unitario) || 0), bruto: efCentavos(Math.abs(Number(x.valorPago) || Number(x.valor) || 0)),
      etapa: x.etapa || "", contaId: x.contaId || c0.contaId }));
    return { campos, de: o, estorno: true, daObra: true, naObra: true, motivos };
  }
  const campos = { descricao: desc, estornoDe: o.id };
  for (const k of ["contaId", "unidadeId", "cliente", "clienteId", "empreendimentoId", "projeto", "obraId", "fornecedor", "fornecedorId", "obraEncerrada"]) {
    if (o[k] != null && o[k] !== "") campos[k] = o[k];
  }
  return { campos, de: o, estorno: true, daObra: false, motivos };
}
// O lançamento pronto do estorno, para gravar sem abrir o formulário.
function lancamentoDoEstornoDoExtrato(movimento, mes, sug, fechamentos) {
  if (!sug || !sug.estorno) return { erro: "Sem o lançamento original." };
  if (sug.bloqueio) return { erro: sug.bloqueio };
  const base = lancamentoDaLinhaDoExtrato(movimento, mes, sug);
  const valor = efCentavos(Math.abs(Number((movimento || {}).valor) || 0));
  if (sug.naObra) {
    const c = sug.campos;
    const nomeConta = ((typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : []).find((x) => x && x.id === c.contaId) || {}).nome || "";
    const itens = (c.itens && c.itens.length) ? c.itens : itensDoCustoOuUnico([], valor, c.etapaUnica || "", c.contaId, c.descricao || nomeConta, "");
    if (!itens.length || itens.some((i) => !i.etapa)) return { erro: "Estorno de obra: confira a etapa no formulário." };
    const { etapaUnica, sinalDoBanco, ...resto } = base;
    const trava = bloqueioPorMesFechado(String(base.lancadoEm || "").slice(0, 7), fechamentos);
    if (trava) return { erro: trava };
    return { lancamento: { ...resto, valor, itens, naObra: true, estornoNaObra: true } };
  }
  const l = comSinalDeEstorno({ ...base, valor });
  const ehEmp = l.unidadeId === "empreendimento";
  // o original pode ser da base antiga (obra pelo nome, sem cadastro): o
  // estorno espelha o original e vale pelo mesmo nome
  const erros = validarLancamentoEscritorio({ ...l, clienteId: l.clienteId || l.cliente,
    obraId: l.unidadeId === "gestao_obras" ? (l.obraId || l.projeto) : l.projeto,
    empreendimentoId: ehEmp ? l.empreendimentoId : l.projeto }, { fechamentos });
  return erros.length ? { erro: erros[0] } : { lancamento: l };
}

// ── Já está na obra: a outra ponta lançada antes ────────────────
// A conta foi lançada (ou importada) na obra e paga, mas nunca atravessou
// para o escritório — e agora a linha do banco aparece pendente. Lançá-la
// "de novo" pelo custo de obra criaria um segundo custo na obra. A trava:
// antes de lançar, procurar nas obras uma conta paga, do mesmo valor, perto
// da data do banco, que nenhum lançamento do escritório reclame — e LIGAR em
// vez de lançar.
function efDias(a, b) {
  const t = (s) => new Date(String(s || "").slice(0, 10) + "T12:00:00Z").getTime();
  const d = Math.abs(t(a) - t(b)) / 864e5;
  return Number.isFinite(d) ? d : Infinity;
}
function efPalavrasDaLinha(t) { return new Set(efSemAcento(t).split(/[^a-z0-9]+/).filter((w) => w.length >= 4)); }
// As contas pagas de uma obra que valem `valor`, até `janela` dias de `dia`,
// sem lançamento do escritório ligado. Pedido com vários itens conta como
// UMA transação (a mesma nota), como na ponte.
function contasIguaisNaObra(obra, valor, dia, lancamentos, janela) {
  const ob = obra || {};
  const v = efCentavos(Math.abs(Number(valor) || 0));
  // a planilha da obra costuma registrar semanas DEPOIS do banco (a data é a
  // do lançamento, não a do pagamento): aceita até `depois` dias à frente e
  // `antes` dias para trás
  const j = typeof janela === "object" && janela ? janela : { antes: janela == null ? 20 : janela, depois: janela == null ? 45 : janela };
  const achadas = [];
  const fontes = fontesDasContasPagas((ob.contasPagar || []).filter((c) => c && !c.estorno
    && !(c.formaPagamento === "cartao" || c.cartaoId) && !Array.isArray(c.movimentos)));
  for (const fonte of fontes) {
    if (Math.abs(efCentavos(fonte.valor) - v) >= 0.01) continue;
    const dias = efDias(fonte.data, dia);
    const depois = String(fonte.data || "").slice(0, 10) >= String(dia || "").slice(0, 10);
    if (!(dias <= (depois ? j.depois : j.antes))) continue;
    const contas = contasLigadasAoLancamento(ob, { origem: { obraId: ob.id, tipo: fonte.tipo, refId: fonte.refId } });
    if (!contas.length) continue;
    const id = idDaPonte(ob.id, fonte.tipo, fonte.refId);
    if ((lancamentos || []).some((l) => l && l.id === id)) continue;
    if (lancamentosLigadosAsContas(lancamentos, ob.id, contas).length) continue;
    achadas.push({ obra: ob, fonte, contas, dias });
  }
  return achadas;
}
function contaDaObraParaALinha(movimento, lancamentos, ctx) {
  const m = movimento || {};
  if (!(Number(m.valor) < 0)) return null;            // só o que saiu do banco
  const c = ctx || {};
  const hist = efPalavrasDaLinha(m.historico);
  const cands = [];
  for (const ob of c.obras || []) {
    if (!ob) continue;
    const cli = (c.clientes || []).find((x) => x && x.id === ob.clienteId) || null;
    const modo = modoDaPonte(ob, cli);
    for (const a of contasIguaisNaObra(ob, m.valor, m.data, lancamentos, { antes: 20, depois: 45 })) {
      if (!destinoNoEscritorio(a.fonte.contaId, modo, c)) continue;   // não passa pelo escritório
      const desc = efPalavrasDaLinha(a.fonte.descricao + " " + (a.fonte.fornecedor || "") + " " + (ob.nome || ""));
      let texto = 0; for (const w of desc) if (hist.has(w)) texto++;
      cands.push({ ...a, cliente: cli, texto });
    }
  }
  if (!cands.length) return null;
  cands.sort((x, y) => (y.texto - x.texto) || (x.dias - y.dias));
  const [a, b] = cands;
  // dois do mesmo valor sem nada que os separe: não escolhe por conta própria
  if (b && b.texto === a.texto && b.dias === a.dias) return null;
  const dia = String(a.fonte.data || "").slice(0, 10).split("-").reverse().join("/");
  return {
    jaNaObra: true, daObra: true, obra: a.obra, cliente: a.cliente, fonte: a.fonte, contas: a.contas, planoObra: c.planoObra,
    campos: { unidadeId: ehEmpreendimento(a.cliente) ? "empreendimento" : "gestao_obras", contaFonte: "obra", contaId: a.fonte.contaId,
      clienteId: (a.cliente && a.cliente.id) || a.obra.clienteId || "", cliente: (a.cliente && a.cliente.nome) || "",
      obraIdAlvo: a.obra.id, projeto: a.obra.nome || "", fornecedor: a.fonte.fornecedor || "", descricao: a.fonte.descricao || "" },
    motivos: [`já está na obra ${a.obra.nome || ""}: ${a.fonte.descricao || "conta"}${a.fonte.fornecedor ? " · " + a.fonte.fornecedor : ""} · paga em ${dia}`],
  };
}
// O lançamento do escritório que liga a linha do banco à conta da obra: é o
// mesmo que a ponte faria na baixa (mesmo id, mesma conta de destino, mesmo
// número de referência), com a data e o mês do banco.
function lancamentoDaLigacaoComObra(movimento, mes, sug, fechamentos, lancamentos) {
  if (!sug || !sug.jaNaObra) return { erro: "Sem conta na obra para ligar." };
  const r = lancamentosDaObraParaEscritorio(sug.obra, sug.cliente,
    { contasPagar: sug.contas, entradas: [], fechamentos, lancamentos, planoObra: sug.planoObra });
  const l = r.lancamentos[0];
  if (!l) return { erro: ((r.bloqueados[0] || r.ignorados[0] || {}).motivo) || "A conta da obra não atravessa para o escritório." };
  const m = movimento || {};
  const competencia = /^\d{4}-\d{2}$/.test(String(mes)) ? String(mes) : String(m.data || "").slice(0, 7);
  const trava = bloqueioPorMesFechado(competencia, fechamentos);
  if (trava) return { erro: trava };
  return { lancamento: { ...l, competencia, lancadoEm: String(m.data || l.lancadoEm).slice(0, 10),
    extratoId: m.id || "", historicoBanco: m.historico || "",
    ligarObra: { obraId: sug.obra.id, contaIds: sug.contas.map((c) => c.id) } } };
}

// ── Investido no empreendimento: o custo da obra inteira ─────────
// O escritório só vê o que passou pela conta dele. O empreendimento custou
// mais: compra no cartão, boleto pago por fora, aporte de sócio. O investido
// é o que o escritório tem (o banco manda) MAIS as contas pagas na obra que
// não têm lançamento no escritório — nem ligado, nem achável pelo papel ou
// pelo valor no dia (base antiga ainda sem ligação não conta duas vezes).
function investidoDoEmpreendimento(cliente, obras, lancamentos, opcoes) {
  const o = opcoes || {};
  const id = (cliente && cliente.id) || "";
  const pelaConta = resultadoEmpreendimento(lancamentos, id, o).investido;
  const obrasDele = (obras || []).filter((x) => x && x.clienteId === id);
  // as contas da obra que a base antiga do escritório já tem, sem ligação
  const achadas = new Set();
  for (const l of lancamentos || []) {
    if (!l || l.empreendimentoId !== id || (l.origem && l.origem.obraId)) continue;
    const c = contaEscritorio(l.contaId);
    if (!c || c.grupo !== "emp_saidas") continue;
    const a = contasDaObraSemLigacao(l, obrasDele, lancamentos);
    if (a.length === 1) achadas.add(a[0].k.id);
  }
  let foraDaConta = 0;
  for (const ob of obrasDele) {
    for (const k of ob.contasPagar || []) {
      if (!k || !k.pago || achadas.has(k.id)) continue;
      if (EF_GRUPOS_CUSTO_OBRA.indexOf(ponteGrupoDaConta(k.contaId, o)) < 0) continue;
      if (lancamentosLigadosAsContas(lancamentos, ob.id, [k]).length) continue;
      foraDaConta = efCentavos(foraDaConta + (Number(k.valorPago) || Number(k.valor) || 0));
    }
  }
  return { pelaConta, foraDaConta, total: efCentavos(pelaConta + foraDaConta) };
}

// ── Projetos ganhos: o que falta receber ─────────────────────────
// O orçamento ganho guarda o que foi fechado: valor, desconto e a condição
// (antecipado, parcelado, por etapas), com cada parcela, valor e data. Isso
// é o "a receber" do escritório — e nada vira receita antes do dinheiro cair
// no banco. Quando cai, a parcela inteira é Receita Projetos; a parte da
// engenharia é também custo de Parceiros e fica na reserva até pagar o
// engenheiro. Recebida = há lançamento ligado à parcela (origem "projeto").
// Como a parcela aparece nas descrições: "pagamento único antecipado",
// "parcela 2/4", "etapa 1/4 · Estudo Preliminar".
function rotuloDaParcelaDeProjeto(tipo, numero, total, nome) {
  if (total === 1) return tipo === "antecipado" ? "pagamento único antecipado" : "pagamento único";
  if (tipo === "etapas") return `etapa ${numero}/${total}${nome ? " · " + nome : ""}`;
  return `parcela ${numero}/${total}`;
}
function parcelasDosProjetos(orcamentos, clientes, lancamentos) {
  const out = [];
  const recebidos = new Map();
  for (const l of lancamentos || []) {
    const o = l && l.origem;
    if (!o || o.tipo !== "projeto" || o.parte !== "recebido") continue;
    recebidos.set(o.orcId + "|" + o.parcela, l);
  }
  for (const o of orcamentos || []) {
    if (!o || o.status !== "ganho" || !o.fechamento) continue;
    const f = o.fechamento;
    const ps = ((f.condicao && f.condicao.parcelas) || []).filter((p) => p && Number(p.valor) > 0);
    if (!ps.length) continue;
    const total = efCentavos(Number(f.valorTotalFechado) || ps.reduce((t, p) => t + Number(p.valor), 0));
    const eng = f.inclEng === false ? 0 : efCentavos(Number(f.valorEngFechado) || 0);
    const fracEng = total > 0 ? Math.min(1, Math.max(0, eng / total)) : 0;
    const cli = (clientes || []).find((c) => c && c.id === o.clienteId) || null;
    const tipo = (f.condicao && f.condicao.tipo) || "";
    ps.forEach((p, i) => {
      const numero = Number(p.numero) || i + 1;
      const valor = efCentavos(p.valor);
      const engParte = efCentavos(valor * fracEng);
      const l = recebidos.get(o.id + "|" + numero) || null;
      out.push({ orcId: o.id, numero, totalParcelas: ps.length, nome: p.nome || `Parcela ${numero}`,
        rotulo: rotuloDaParcelaDeProjeto(tipo, numero, ps.length, p.nome), valor, data: String(p.data || "").slice(0, 10),
        arq: efCentavos(valor - engParte), eng: engParte, clienteId: o.clienteId || "", cliente: (cli && cli.nome) || "",
        referencia: o.referencia || "", recebida: !!l, lancamentoId: l ? l.id : "" });
    });
  }
  return out;
}
// A linha de crédito do banco que é uma parcela de projeto a receber: o
// mesmo valor; com duas parcelas iguais, decide o nome do cliente no
// histórico e depois a data mais perto do vencimento.
function parcelaDeProjetoParaALinha(movimento, lancamentos, ctx) {
  const m = movimento || {};
  if (!(Number(m.valor) > 0)) return null;
  const c = ctx || {};
  const v = efCentavos(Number(m.valor));
  const hist = efPalavrasDaLinha(m.historico);
  const cands = parcelasDosProjetos(c.orcamentos, c.clientes, lancamentos)
    .filter((p) => !p.recebida && Math.abs(p.valor - v) < 0.01)
    .map((p) => { let t = 0; for (const w of efPalavrasDaLinha(p.cliente)) if (hist.has(w)) t++; return { p, t, d: p.data ? efDias(p.data, m.data) : 999 }; })
    .sort((a, b) => (b.t - a.t) || (a.d - b.d));
  if (!cands.length) return null;
  const [a, b] = cands;
  if (b && b.t === a.t && b.d === a.d) return null;
  const p = a.p;
  return { parcelaProjeto: p, daObra: false,
    campos: { unidadeId: "projetos", contaId: "rec_projetos", clienteId: p.clienteId, cliente: p.cliente, projeto: p.referencia,
      descricao: `Recebimento de projeto — ${p.rotulo}` },
    motivos: [`parcela ${p.numero}/${p.totalParcelas} do projeto ${p.cliente}${p.referencia ? " · " + p.referencia : ""}`] };
}
// O recebimento: a linha inteira em Receita Projetos (é o que o banco
// mostra) e, se o projeto tem engenharia, a parte dela entra como custo em
// Parceiros e como dinheiro guardado na reserva — um par fora do banco, que
// não muda o saldo.
// ── Engenharia: custo reconhecido no recebimento, pago pela reserva ──
// O projeto recebido entra inteiro em Receita de projetos; a parte da
// engenharia vira, no mesmo dia, custo em "Parceiros Arquitetos e
// Engenheiros" e dinheiro guardado na Reserva engenharia (os dois fora da
// conta). Quando o engenheiro é pago, o dinheiro sai da RESERVA — o custo já
// foi reconhecido; lançar em Parceiros de novo contaria duas vezes.
function saldoDaReservaEngenharia(lancamentos, clienteId) {
  if (!clienteId) return 0;
  let t = 0;
  for (const l of lancamentos || []) if (l && l.contaId === "res_engenharia" && l.clienteId === clienteId) t += Number(l.valor) || 0;
  return efCentavos(t);
}
// Saída em Parceiros de um cliente que tem engenharia guardada:
//   cabe na reserva  → vira saída da reserva (valor negativo na conta dela,
//                      pela conta do banco) — nada de custo de novo;
//   passa da reserva → o pagamento fica em Parceiros (é a linha do banco,
//                      inteira) e um par fora do banco tira dele a parte que
//                      a reserva cobre: só o que passou é custo novo.
function comoPagamentoDaReserva(l, lancamentos) {
  if (!l || l.contaId !== "parceiros" || l.estorno) return null;
  const v = efCentavos(Math.abs(efValorDoCampo(l.valor)));
  const saldo = saldoDaReservaEngenharia(lancamentos, l.clienteId);
  if (!(v > 0) || !(saldo > 0)) return null;
  const { sinalDoBanco: _s, ...resto } = l;
  if (v <= saldo + 0.005) {
    return { ...resto, contaId: "res_engenharia", valor: -v, estorno: true, pagoDaReserva: v,
      descricao: l.descricao || "Pagamento da engenharia (da reserva)" };
  }
  const comum = { tipo: "escritorio", unidadeId: l.unidadeId, clienteId: l.clienteId, cliente: l.cliente, projeto: l.projeto,
    competencia: l.competencia, lancadoEm: l.lancadoEm, fornecedor: l.fornecedor || "", contaBanco: "nao", conferido: true, estorno: true };
  const nome = l.descricao || "Pagamento da engenharia";
  return { ...resto, valor: v, pagoDaReserva: saldo, recebimentoExtras: [
    { ...comum, contaId: "parceiros", valor: -saldo, descricao: `Parte paga pela reserva — ${nome}` },
    { ...comum, contaId: "res_engenharia", valor: -saldo, descricao: `Reserva engenharia usada — ${nome}` },
  ] };
}

function lancamentosDoRecebimento(movimento, mes, sug, fechamentos) {
  const m = movimento || {};
  const p = sug && sug.parcelaProjeto;
  if (!p) return { erro: "Sem parcela de projeto." };
  const competencia = /^\d{4}-\d{2}$/.test(String(mes)) ? String(mes) : String(m.data || "").slice(0, 7);
  const trava = bloqueioPorMesFechado(competencia, fechamentos);
  if (trava) return { erro: trava };
  const valor = efCentavos(Math.abs(Number(m.valor) || 0));
  const comum = { tipo: "escritorio", unidadeId: "projetos", clienteId: p.clienteId, cliente: p.cliente, projeto: p.referencia,
    competencia, lancadoEm: String(m.data || "").slice(0, 10), fornecedor: "" };
  const orig = (parte) => ({ tipo: "projeto", orcId: p.orcId, parcela: p.numero, parte });
  const principal = { ...comum, contaId: "rec_projetos", valor, contaBanco: "sim",
    descricao: `Recebimento de projeto — ${p.rotulo}`, origem: orig("recebido"),
    extratoId: m.id || "", historicoBanco: m.historico || "" };
  const eng = efCentavos(Math.min(p.eng, valor));
  const extras = eng > 0 ? [
    { ...comum, contaId: "parceiros", valor: eng, contaBanco: "nao", conferido: true,
      descricao: `Custo da engenharia (parceiro) — ${p.rotulo}`, origem: orig("eng-custo") },
    { ...comum, contaId: "res_engenharia", valor: eng, contaBanco: "nao", conferido: true,
      descricao: `Reserva para pagar a engenharia — ${p.rotulo}`, origem: orig("eng-reserva") },
  ] : [];
  return { lancamento: { ...principal, recebimentoExtras: extras } };
}

// Projeto ganho com parcela JÁ RECEBIDA (o antecipado que caiu na conta no
// dia do fechamento): os mesmos lançamentos do "Receber parcela" da fila —
// a parcela inteira em Receita de projetos, pela conta, e a parte da
// engenharia indo para a reserva —, sem esperar o extrato. Quando o extrato
// chegar, a linha do PIX casa com o lançamento pelo valor.
//   orc         o orçamento já com status "ganho" e o fechamento
//   numeros     as parcelas recebidas (1, 2…)
//   ctx         { clientes, lancamentos, fechamentos, novoId(), numeroDoc(lista), agora }
function lancamentosDoGanhoRecebido(orc, numeros, ctx) {
  const c = ctx || {};
  const quais = new Set((numeros || []).map(Number));
  if (!orc || !quais.size) return { lancamentos: [] };
  const lancs = (c.lancamentos || []).slice();
  const parcelas = parcelasDosProjetos([orc], c.clientes, lancs).filter((p) => quais.has(p.numero) && !p.recebida);
  const novos = [];
  for (const p of parcelas) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.data)) return { erro: `A ${p.nome} está sem data — informe o dia em que o cliente pagou.` };
    const r = lancamentosDoRecebimento({ id: "", data: p.data, valor: p.valor, historico: "" }, p.data.slice(0, 7), { parcelaProjeto: p }, c.fechamentos);
    if (r.erro) return { erro: r.erro };
    const { recebimentoExtras, extratoId: _e, historicoBanco: _h, ...principal } = r.lancamento;
    const agora = c.agora || new Date().toISOString();
    const id = typeof c.novoId === "function" ? c.novoId() : String(Date.now());
    const numeroDoc = typeof c.numeroDoc === "function" ? c.numeroDoc(lancs.concat(novos)) : "";
    novos.push({ ...principal, id, numeroDoc, criadoEm: agora },
      ...recebimentoExtras.map((x, i) => ({ ...x, id: id + "_" + (i + 1), parDe: id, numeroDoc, criadoEm: agora, conferidoEm: agora })));
  }
  return { lancamentos: novos };
}
// O mesmo, a partir do data inteiro — é o que as telas de "Marcar como Ganho"
// chamam. Devolve a lista de lançamentos já com os novos (ou o erro).
function lancamentosComGanhoRecebido(data, orcGanho) {
  const d = data || {};
  const atuais = d.lancamentos || [];
  const ps = ((orcGanho && orcGanho.fechamento && orcGanho.fechamento.condicao) || {}).parcelas || [];
  const numeros = ps.map((p, i) => (p && p.recebida ? Number(p.numero) || i + 1 : 0)).filter(Boolean);
  if (!numeros.length) return { lancamentos: atuais, novos: [] };
  const r = lancamentosDoGanhoRecebido(orcGanho, numeros, {
    clientes: d.clientes || [], lancamentos: atuais, fechamentos: fechamentosDoEscritorio(d),
    novoId: typeof uid === "function" ? uid : undefined,
    numeroDoc: typeof proximaReferencia === "function" ? (lista) => proximaReferencia(d.obras || [], lista) : undefined,
  });
  if (r.erro) return { erro: r.erro };
  return { lancamentos: atuais.concat(r.lancamentos), novos: r.lancamentos };
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
function ExtratoEscritorioQuadro({ linhas, ano, aoTrocarAno, fechamentos }) {
  const S = EF_ESTILO;
  // O quadro rola dentro de uma caixa que termina no pé da janela: a barra
  // de rolagem para o lado fica sempre à vista (não lá embaixo, depois da
  // última linha), e os meses no alto e os nomes das contas à esquerda
  // ficam presos enquanto se rola — como "congelar painéis" no Excel.
  const caixaRef = useRef(null);
  if (typeof useArrastarParaRolar === "function") useArrastarParaRolar(caixaRef);
  const [alturaCaixa, setAlturaCaixa] = useState(0);
  useEffect(() => {
    const medir = () => {
      const g = caixaRef.current;
      if (!g || typeof window === "undefined") return;
      const topo = g.getBoundingClientRect().top;
      const alt = Math.max(280, Math.round(window.innerHeight - Math.max(topo, 0) - 16));
      setAlturaCaixa((a) => (Math.abs(a - alt) > 2 ? alt : a));
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  });
  const anos = [...new Set(linhas.map((l) => l.mes.slice(0, 4)))];
  const doAno = linhas.filter((l) => l.mes.startsWith(ano));
  if (!doAno.length) {
    return <div style={{ ...S.card, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
      Nenhum lançamento em {ano}.
    </div>;
  }
  const blocos = [
    { titulo: "Gestão de obras — dinheiro do cliente", grupos: ["gestao_entradas", "gestao_saidas"], saldo: "saldoGestao", rotulo: "Saldo da gestão",
      totais: { gestao_entradas: "Entradas da gestão", gestao_saidas: "Saídas da gestão" } },
    { titulo: "Escritório", grupos: ["receitas", "despesas"], saldo: "saldoEscritorio", rotulo: "Resultado do escritório",
      totais: { receitas: "Receitas do escritório", despesas: "Custo do escritório" } },
    { titulo: "Empreendimentos", grupos: ["emp_aportes", "emp_entradas", "emp_saidas"], saldo: "saldoEmpreendimento", rotulo: "Saldo de empreendimentos",
      totais: { emp_aportes: "Aportes", emp_entradas: "Vendas", emp_saidas: "Investido" } },
    { titulo: "Sócios", grupos: ["socios", "socios_entradas"], saldo: "retiradas", rotulo: "Retiradas e empréstimos",
      totais: { socios: "Retiradas e empréstimos", socios_entradas: "Devoluções e aportes" } },
    { titulo: "Estornos bancários", grupos: ["ajustes_bancarios"], saldo: "ajustes", rotulo: "Em aberto com o banco" },
    { titulo: "Reservas", grupos: ["reservas"], saldo: "saldoReservas", rotulo: "Reserva a repassar (engenharia)" },
  ];
  const soma = (f) => doAno.reduce((s, m) => s + (f(m) || 0), 0);
  const cel = (v) => (!v ? <span style={{ color: "#d1d5db" }}>—</span>
    : <span style={v < 0 ? { color: "#b91c1c" } : undefined}>{efDinheiro(v)}</span>);
  const td = { padding: "7px 12px", textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  // no celular a coluna dos nomes não pode comer a tela: até 42% da largura,
  // e o nome comprido quebra a linha em vez de empurrar os meses para fora
  const tdNome = { ...td, textAlign: "left", position: "sticky", left: 0, background: "#fff", minWidth: "min(230px, 42vw)",
    maxWidth: "max(230px, 42vw)", whiteSpace: "normal", zIndex: 1,
    boxShadow: "1px 0 0 rgba(38,36,33,0.10)" };
  // título dos meses: preso no alto; o canto (preso nos dois sentidos) por cima de tudo
  const th = { ...td, fontSize: 11, textTransform: "uppercase", letterSpacing: .4, position: "sticky", top: 0, background: "#fff", zIndex: 2,
    boxShadow: "0 1px 0 rgba(38,36,33,0.12)" };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={S.abas}>
        {anos.map((a) => (
          <button key={a} style={S.aba(a === ano)} onClick={() => aoTrocarAno(a)}>{a}</button>
        ))}
      </div>
      <div ref={caixaRef} data-vk-extrato-quadro="1" style={{ ...S.quadro, maxHeight: alturaCaixa || "calc(100vh - 140px)", overscrollBehavior: "contain" }}>
        <style>{`[data-vk-extrato-quadro="1"]::-webkit-scrollbar{width:12px;height:12px}
[data-vk-extrato-quadro="1"]::-webkit-scrollbar-track{background:#f3f4f6}
[data-vk-extrato-quadro="1"]::-webkit-scrollbar-thumb{background:#9ca3af;border-radius:8px;border:3px solid #f3f4f6}
[data-vk-extrato-quadro="1"]::-webkit-scrollbar-thumb:hover{background:#6b7280}`}</style>
        <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", fontSize: 12.5 }}>
          <thead>
            <tr style={{ color: "#6b7280" }}>
              <th style={{ ...th, ...tdNome, fontSize: 11, textTransform: "uppercase", letterSpacing: .4, top: 0, zIndex: 3,
                boxShadow: "1px 1px 0 rgba(38,36,33,0.12)" }}></th>
              {doAno.map((m) => (
                <th key={m.mes} style={th}>
                  {EF_MES_CURTO[Number(m.mes.slice(5)) - 1]}
                </th>
              ))}
              <th style={th}>Ano</th>
            </tr>
          </thead>
          <tbody>
            {/* Cada grupo abre pelo TOTAL (a primeira coisa que se lê) e as
                contas que o compõem vêm logo abaixo, menores e mais claras.
                No fim do bloco, o saldo. Bloco de um grupo só abre direto
                pelo saldo — o total do grupo seria o mesmo número. */}
            {blocos.map((b) => {
              const contas = b.grupos.flatMap((g) => PLANO_CONTAS_ESCRITORIO.filter((c) => c.grupo === g));
              const usadas = contas.filter((c) => doAno.some((m) => (m.contas[c.id] || 0) !== 0));
              if (!usadas.length && !doAno.some((m) => m[b.saldo])) return null;
              const grupos = b.grupos.filter((g) => usadas.some((c) => c.grupo === g));
              const umSo = grupos.length <= 1;
              const linhaTitulo = { background: "#f5f7fa", borderTop: "1px solid rgba(38,36,33,0.12)" };
              const tdGrupo = { ...td, fontWeight: 600, fontSize: 13, color: "#262421", paddingTop: 10, paddingBottom: 4 };
              const tdItem = { ...td, fontSize: 11.5, color: "#6b7280", paddingTop: 3, paddingBottom: 3 };
              const tdSaldo = { ...td, fontWeight: 700, fontSize: 13, borderTop: "1px solid rgba(38,36,33,0.14)", background: "#fbfcfd", paddingTop: 9, paddingBottom: 9 };
              const itens = (lista) => lista.map((c, k) => (
                <tr key={c.id} data-vk-item-conta={c.id}>
                  <td style={{ ...tdNome, ...tdItem, textAlign: "left", whiteSpace: "normal", paddingLeft: 30, paddingBottom: k === lista.length - 1 ? 8 : 3 }}>{c.nome}</td>
                  {doAno.map((m) => <td key={m.mes} style={{ ...tdItem, paddingBottom: k === lista.length - 1 ? 8 : 3 }}>{cel(m.contas[c.id] || 0)}</td>)}
                  <td style={{ ...tdItem, paddingBottom: k === lista.length - 1 ? 8 : 3 }}>{cel(soma((m) => m.contas[c.id] || 0))}</td>
                </tr>
              ));
              const sinalDe = (g) => ((grupoEscritorio(g) || {}).sinal < 0 ? "−" : "+");
              return (
                <Fragment key={b.titulo}>
                  <tr>
                    <td style={{ ...tdNome, ...linhaTitulo, fontWeight: 700, fontSize: 11.5, textTransform: "uppercase", letterSpacing: .5, color: "#374151" }}>{b.titulo}</td>
                    {doAno.map((m) => <td key={m.mes} style={{ ...td, ...linhaTitulo }} />)}
                    <td style={{ ...td, ...linhaTitulo }} />
                  </tr>
                  {umSo ? (
                    <>
                      <tr data-vk-total-grupo={grupos[0] || b.saldo}>
                        <td style={{ ...tdNome, ...tdGrupo, textAlign: "left", whiteSpace: "normal" }}>{b.rotulo}</td>
                        {doAno.map((m) => <td key={m.mes} style={tdGrupo}>{cel(m[b.saldo] || 0)}</td>)}
                        <td style={tdGrupo}>{cel(soma((m) => m[b.saldo] || 0))}</td>
                      </tr>
                      {itens(usadas)}
                    </>
                  ) : (
                    <>
                      {grupos.map((g) => (
                        <Fragment key={g}>
                          <tr data-vk-total-grupo={g}>
                            <td style={{ ...tdNome, ...tdGrupo, textAlign: "left", whiteSpace: "normal" }}>
                              <span style={{ color: "#9ca3af", fontWeight: 500, marginRight: 6 }}>{sinalDe(g)}</span>{(b.totais || {})[g] || g}
                            </td>
                            {doAno.map((m) => <td key={m.mes} style={tdGrupo}>{cel((m.grupos || {})[g] || 0)}</td>)}
                            <td style={tdGrupo}>{cel(soma((m) => (m.grupos || {})[g] || 0))}</td>
                          </tr>
                          {itens(usadas.filter((c) => c.grupo === g))}
                        </Fragment>
                      ))}
                      <tr data-vk-saldo-bloco={b.saldo}>
                        <td style={{ ...tdNome, ...tdSaldo, textAlign: "left", whiteSpace: "normal" }}>= {b.rotulo}</td>
                        {doAno.map((m) => <td key={m.mes} style={tdSaldo}>{cel(m[b.saldo] || 0)}</td>)}
                        <td style={tdSaldo}>{cel(soma((m) => m[b.saldo] || 0))}</td>
                      </tr>
                    </>
                  )}
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
            {/* A aplicação, informada no Fechamento: fora da conta, então
                fora do saldo do extrato — somada só no total disponível. */}
            {doAno.some((m) => saldoAplicacaoDoMes(fechamentos, m.mes) != null) && (() => {
              const apl = (m) => saldoAplicacaoDoMes(fechamentos, m.mes);
              // na coluna do ano, o último mês que tem a aplicação informada
              const ult = doAno.slice().reverse().find((m) => apl(m) != null);
              const vazio = <span style={{ color: "#d1d5db" }}>—</span>;
              return (
                <>
                  <tr data-vk-linha-aplicacao="1">
                    <td style={{ ...tdNome, color: "#4b5563" }}>Aplicação (investimento)</td>
                    {doAno.map((m) => <td key={m.mes} style={td}>{apl(m) == null ? vazio : cel(apl(m))}</td>)}
                    <td style={td}>{apl(ult) == null ? vazio : cel(apl(ult))}</td>
                  </tr>
                  {/* conta corrente (o saldo do banco informado) + aplicação */}
                  <tr data-vk-linha-total="1">
                    <td style={{ ...tdNome, fontWeight: 700 }}>Total disponível <span style={{ fontWeight: 400, color: "#6b7280" }}>(banco + aplicação)</span></td>
                    {doAno.map((m) => { const bco = saldoBancoDoMes(fechamentos, m.mes);
                      return <td key={m.mes} style={{ ...td, fontWeight: 700 }}>{apl(m) == null || bco == null ? vazio : cel(efCentavos(bco + apl(m)))}</td>; })}
                    <td style={{ ...td, fontWeight: 700 }}>{(() => { const bco = ult ? saldoBancoDoMes(fechamentos, ult.mes) : null;
                      return !ult || bco == null ? vazio : cel(efCentavos(bco + apl(ult))); })()}</td>
                  </tr>
                </>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Formulário de um lançamento. As travas são as do validarLancamento: a
// mensagem aparece antes de gravar, não depois.
function CadastroRapidoDeCliente({ form, aoMudar, erro, aoSalvar, aoCancelar }) {
  const S = EF_ESTILO;
  if (!form) return null;
  const mexer = (k, v) => aoMudar({ ...form, [k]: v });
  const noEnter = (e) => { if (e.key === "Enter") { e.preventDefault(); aoSalvar(); } };
  const rot = { fontSize: 11.5, color: "#4b5563", fontWeight: 600, marginBottom: 4 };
  return (
    <div data-vk-cliente-rapido style={{ marginTop: 4, padding: 12, borderRadius: 12, border: "1.5px solid #0474f4", background: "#f7fbff" }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0474f4", marginBottom: 8 }}>Cadastrar cliente</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <div style={{ flex: "2 1 220px", minWidth: 0 }}>
          <div style={rot}>Nome *</div>
          <input style={S.input} autoFocus value={form.nome || ""} onChange={(e) => mexer("nome", e.target.value)} onKeyDown={noEnter} />
        </div>
        <div style={{ flex: "1 1 170px", minWidth: 0 }}>
          <div style={rot}>CPF / CNPJ</div>
          <input style={S.input} value={form.cpfCnpj || ""} onChange={(e) => mexer("cpfCnpj", e.target.value)} onKeyDown={noEnter} placeholder="opcional" />
        </div>
        <div style={{ flex: "1 1 170px", minWidth: 0 }}>
          <div style={rot}>WhatsApp</div>
          <input style={S.input} value={form.telefone || ""} onChange={(e) => mexer("telefone", e.target.value)} onKeyDown={noEnter} placeholder="(14) 99999-9999" />
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>Só o nome é obrigatório — o resto do cadastro se completa depois em Clientes.</div>
      {erro && <div style={{ fontSize: 11.5, color: "#dc2626", marginTop: 6 }}>{erro}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button type="button" style={{ ...S.btn, fontSize: 12, padding: "6px 14px" }} onClick={aoSalvar}>Cadastrar e usar</button>
        <button type="button" style={{ ...S.btnSec, fontSize: 12, padding: "6px 14px" }} onClick={aoCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

function FormLancamentoEscritorio({ inicial, aoSalvar, aoCancelar, fechamentos, clientes, obras, lancamentos, prestadores, aoCriarPrestador, aoCriarCliente, insumos, cartoes, aoCadastrarInsumo, competenciaFixa, titulo, rotuloSalvar, atalhos, nomeEscritorio, motivos }) {
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
  const [outroPagamento, setOutroPagamento] = useState(false);
  const [pagarDaReserva, setPagarDaReserva] = useState(true);
  const [erroAnexo, setErroAnexo] = useState("");
  const [novoPrest, setNovoPrest] = useState(null);   // { nome, categoria }
  const [novoCli, setNovoCli] = useState(null);       // { nome, cpfCnpj, telefone }
  const [erroCli, setErroCli] = useState("");
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
    // Numa receita o papel é o comprovante do que entrou: sem itens, sem
    // pergunta de obra para material.
    const entrada = f.contaFonte !== "obra" && contaEhEntradaEscritorio(f.contaId);
    const textoDosItens = comItens.map((x) => x.descricao).join(" ");
    const rotulo = rotuloDoPapelLido(pa, entrada, textoDosItens);
    const ehDeItens = !entrada && rotulo !== "Cheque" && comItens.length && ["nota", "pedido", "lista"].indexOf(pa.tipo) >= 0;
    const lidos = ehDeItens && typeof itensDaEntrada === "function"
      ? itensDaEntrada({ itens: comItens }, "orcamento", insumos || []).map((x) => {
          const ins = x.insumoCodigo ? (insumos || []).find((m) => m && (m.codigo === x.insumoCodigo || m.id === x.insumoCodigo)) : null;
          return { ...x, textoLido: x.descricao,
            etapa: x.etapa || (typeof etapaFixaDoInsumo === "function" ? etapaFixaDoInsumo(ins) : (ins && ins.etapaPadrao)) || "",
            contaId: (ins && ins.contaPadrao) || x.contaId || "material",
            grupoMaterial: x.grupoMaterial || (ins && ins.grupo) || "" };
        })
      : [];
    const tipoPapel = (entrada || rotulo === "Cheque" || pa.tipo === "comprovante") ? "comprovante" : (pa.ehNota || pa.tipo === "nfse" || pa.tipo === "nota") ? "nota"
      : (typeof tipoDoAnexoDaEntrada === "function" ? tipoDoAnexoDaEntrada(pa) : "pedido");
    setF((p) => {
      const novo = { ...p };
      if (valorLido > 0 && !(efValorDoCampo(p.valor) > 0)) novo.valor = valorLido.toFixed(2).replace(".", ",");
      if (pa.pagoEm && !p.lancadoEm) novo.lancadoEm = pa.pagoEm;
      // numa receita, a data do papel (a do cheque) não é o mês do recebimento
      const dataDoPapel = pa.pagoEm || (entrada ? "" : pa.emitido);
      if (dataDoPapel && !p.competencia) novo.competencia = dataDoPapel.slice(0, 7);
      // receita: quem presta o serviço é o escritório — o nome do banco ou
      // de quem assinou o cheque não vira fornecedor
      const semFornecedor = !entrada && !p.fornecedorId && (!String(p.fornecedor || "").trim() || p.fornecedor === EF_FORNECEDOR_OUTROS);
      if (semFornecedor && doCadastro) { novo.fornecedorId = doCadastro.id; novo.fornecedor = doCadastro.nome || ""; }
      else if (semFornecedor && emitente) novo.fornecedor = emitente;
      const nota = pa.numeroNota || pa.numeroPedido || "";
      if (nota && !/\d/.test(String(p.documento || ""))) novo.documento = String(nota);
      if (!String(p.descricao || "").trim() || p.descricao === p.historicoBanco) {
        const resumo = [emitente, pa.numeroNota ? "NF " + pa.numeroNota : "",
          lidos.length ? (lidos.length === 1 ? lidos[0].descricao : lidos.length + " itens")
            : (pa.descricao || (comItens.length === 1 ? comItens[0].descricao : ""))].filter(Boolean).join(" · ");
        if (resumo) novo.descricao = resumo.slice(0, 160);
      }
      // a linha em branco (aberta no "+ item" e não preenchida) não segura
      // os itens do papel: só o que a pessoa já escreveu é que fica
      if (lidos.length && (p.itens || []).every(itemDoCustoEmBranco)) novo.itens = lidos;
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
    setLida({ origem: origem || "", papel: pa, rotulo, itens: lidos.length, casados: lidos.filter((x) => x.insumoCodigo).length, lidos,
      cadastro: entrada ? null : (doCadastro || null) });
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
  // Crédito do banco numa conta de custo da obra (PIX estornado, loja que
  // devolveu): é estorno — abate o custo, não soma.
  const estornoNaObra = naObra && Number(f.sinalDoBanco) > 0;
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
    if (f.unidadeId !== "gestao_obras" || f.obraId || f.contaFonte === "obra" || f.obraEncerrada) return;
    const lista = obrasDaGestao(obras, clientes, f.clienteId);
    const pelo = f.projeto ? lista.find((o) => efSemAcento(String(o.nome || "")).trim().toLowerCase() === efSemAcento(String(f.projeto)).trim().toLowerCase()) : null;
    const unica = !pelo && f.clienteId && lista.length === 1 ? lista[0] : null;
    const o = pelo || unica;
    if (o) setF((p) => ({ ...p, obraId: o.id, projeto: o.nome || p.projeto }));
  }, [f.unidadeId, f.obraId, f.clienteId, f.projeto, f.contaFonte]);
  // Receita (e toda conta de entrada) não tem fornecedor: o campo some e o
  // lançamento grava sem ele.
  const entradaSemFornecedor = !naObra && contaDeEntradaNoEscritorio(f.contaId);
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
  const entradaNoForm = !naObra && contaEhEntradaEscritorio(f.contaId);
  const obraJaEscolhida = f.obraId ? (obras || []).find((o) => o && o.id === f.obraId) || null : null;
  const obrasCitadas = (() => {
    if (naObra || entradaNoForm || !(f.itens || []).length) return [];
    const citadas = typeof obrasCitadasNoTexto === "function" ? obrasCitadasNoTexto(textoParaObra, obras || []) : [];
    // a obra já escolhida no lançamento vem primeiro: é ela, quase sempre
    const lista = obraJaEscolhida ? [obraJaEscolhida].concat(citadas.filter((o) => o && o.id !== obraJaEscolhida.id)) : citadas;
    return lista.slice(0, 4);
  })();
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
      etapa: (typeof etapaFixaDoInsumo === "function" ? etapaFixaDoInsumo(ins) : (ins && ins.etapaPadrao)) || (typeof familiaDoInsumo === "function" && familiaDoInsumo(ins) ? "" : atual.etapa) || "",
      contaId: ins.contaPadrao || atual.contaId || f.contaId || "",
      unitario: atual.unitario || (ins.precoReferencia > 0 ? ins.precoReferencia : ""),
    });
  };

  const conta = naObra ? null : contaEscritorio(f.contaId);
  const unidadesOk = conta && (conta.unidades || []).length ? conta.unidades : UNIDADES_NEGOCIO.map((u) => u.id);
  // Empreendimento é cliente com tique: quando a unidade é Empreendimento, a
  // lista de escolha só traz esses, e o id escolhido vale pelos dois campos.
  const ehEmp = f.unidadeId === "empreendimento";
  const unidadeDoForm = UNIDADES_NEGOCIO.find((u) => u.id === f.unidadeId) || null;
  const podeObraAntiga = f.contaFonte !== "obra" && !ehEmp && !!unidadeDoForm && (unidadeDoForm.exigeCliente || unidadeDoForm.exigeObra);
  const obraAntiga = podeObraAntiga && !!f.obraEncerrada;
  const doCadastro = (clientes || []).filter((c) => c && (ehEmp ? ehEmpreendimento(c) : true));
  const erros = naObra
    ? validarLancamentoNaObra({ ...f, valor: efValorDoCampo(f.valor) }, { fechamentos })
        .concat(validarCustoEmItens(efValorDoCampo(f.valor), itensEfetivos, f.obraIdAlvo).erros
          .filter((e) => !/Escolha a obra|Informe o valor pago/.test(e))
          .map((e) => (custoUnico && /sem etapa/.test(e) ? "Escolha a etapa da obra." : e)))
    : validarLancamentoEscritorio({ ...f, valor: efValorDoCampo(f.valor), obraEncerrada: obraAntiga,
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
  // Obra SEM contrato de gestão, com o cliente pagando direto: sem parcela,
  // a receita ficaria só no escritório. Lança dos dois lados: uma conta paga
  // de "Gerenciamento de obra" na obra, ligada a este lançamento.
  const jaLigadoNaObra = !!(inicial && inicial.origem && inicial.origem.obraId);
  const gestaoSemContrato = !naObra && ehReceitaDaGestao(f) && !!obraDaGestao && contasDaGestao(obraDaGestao).length === 0
    && gestaoSemContratoVaiParaObra(obraDaGestao) && !jaLigadoNaObra && !(f.sinalDoBanco && ehEstornoNaConta(f.contaId, f.sinalDoBanco)) && !f.estorno
    && !(!lancNovo && Number((inicial || {}).valor) < 0);
  // Não é pergunta: quem decide é o cadastro da obra ("O cliente realiza
  // os pagamentos"). Marcado, vai para a obra sozinho; desmarcado, fica só
  // no escritório.
  const gestaoAvulsa = gestaoSemContrato;
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
  // Regra das duas pontas: cliente/empreendimento com obra no VICKE não
  // recebe custo só no escritório — vai pela conta da obra, que lança nos
  // dois lados ligados (e o estorno, quando vier, sai dos dois).
  const errosDuasPontas = (lancNovo && !naObra && (f.unidadeId === "gestao_obras" || f.unidadeId === "empreendimento")
    && EF_CONTAS_COM_PONTA_NA_OBRA.indexOf(f.contaId) >= 0 && obrasDoCliente.length > 0)
    ? [`${obrasDoCliente.length === 1 ? "A obra " + (obrasDoCliente[0].nome || "") + " está" : "As obras deste cliente estão"} no VICKE: escolha a conta em “Custo de uma obra” — assim entra no escritório e na obra, ligado.`]
    : [];
  // Trava contra o custo em dobro: a obra já tem uma conta paga, do mesmo
  // valor e perto desta data, que o escritório ainda não tem. O certo é
  // ligar (na fila do extrato, "Ligar à obra"); lançar de novo só marcando
  // que é outro pagamento.
  const iguaisNaObra = (lancNovo && naObra && !estornoNaObra && obraAlvo && efValorDoCampo(f.valor) > 0 && f.lancadoEm)
    ? contasIguaisNaObra(obraAlvo, efValorDoCampo(f.valor), f.lancadoEm, lancamentos || [], { antes: 20, depois: 45 }) : [];
  const errosDobro = iguaisNaObra.length && !outroPagamento
    ? ["Já existe essa conta paga na obra — marque “é outro pagamento” para lançar de novo."] : [];
  // Engenheiro pago de um cliente que tem engenharia guardada na reserva: o
  // custo já entrou quando o projeto foi recebido — o pagamento sai da reserva.
  const saldoReservaCli = (lancNovo && !naObra && !noCartao && f.contaId === "parceiros" && !estornoNoForm)
    ? saldoDaReservaEngenharia(lancamentos || [], f.clienteId) : 0;
  const usaReserva = saldoReservaCli > 0 && pagarDaReserva;
  const excedeReserva = usaReserva ? efCentavos(Math.max(0, efValorDoCampo(f.valor) - saldoReservaCli)) : 0;
  const todosErros = erros.concat(errosCartao).concat(errosGestao).concat(errosDuasPontas).concat(errosDobro);
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
    const g = { ...f, itens: entradaNoForm ? [] : limpos };
    if (naObra) {
      const { etapaUnica: _e, ...semEtapaUnica } = g;
      aoSalvar(comCartao({ ...semEtapaUnica, naObra: true, valor: efValorDoCampo(g.valor), estornoNaObra,
        itens: custoUnico ? itensEfetivos : limpos }));
      return;
    }
    // O contrato de gestão só é mexido quando a tela o mostrou; o lançamento
    // que estava ligado e deixou de ser receita da gestão sai do saldo.
    const { foraDaGestao: _fora, parcelaGestaoId: _p, parcelaGestaoObra: _o, ...semObraDaParcela } = g;
    if (obraAntiga) { semObraDaParcela.obraEncerrada = true; semObraDaParcela.clienteId = ""; semObraDaParcela.obraId = ""; }
    else delete semObraDaParcela.obraEncerrada;
    const noContrato = temGestao ? !foraDaGestao : (ligadoAntes ? false : undefined);
    if (noContrato !== undefined) semObraDaParcela.noContratoGestao = noContrato;
    const { gestaoAvulsa: _ga, ...semMarcaAvulsa } = semObraDaParcela;
    const pronto = semFornecedorNaEntrada(comCartao({ ...semMarcaAvulsa, ...(competenciaFixa ? { competencia: competenciaFixa } : {}),
      ...(lancNovo && !noCartao ? { contaBanco: regraBanco } : {}),
      ...(gestaoAvulsa ? { gestaoAvulsaNaObra: true } : {}),
      tipo: "escritorio", valor: efValorDoCampo(g.valor) }));
    aoSalvar((usaReserva && comoPagamentoDaReserva(pronto, lancamentos || [])) || pronto);
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
      {/* O porquê de cada campo que veio preenchido sem linha igual para
          copiar — para conferir antes de lançar, não para lançar no escuro. */}
      {lancNovo && (motivos || []).length > 0 && (
        <div data-vk-palpite-form="1" style={{ fontSize: 12, color: "#1e3a8a", background: "#eef5ff", border: "1px solid rgba(4,116,244,0.22)",
          borderRadius: 10, padding: "8px 10px", lineHeight: 1.5 }}>
          <b>Pré-preenchido pelo histórico</b> — confira antes de lançar:
          {(motivos || []).map((x, i) => <div key={i}>· {x}</div>)}
        </div>
      )}
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
            {/* Todas as unidades, sempre. Antes a lista vinha cortada pela conta
                já escolhida (a sugestão "Reembolsos" escondia Empreendimento e
                Escritório); trocar para uma unidade em que a conta não vale
                limpa a conta, e escolhe-se a dela. */}
            {UNIDADES_NEGOCIO.map((u) => (
              <option key={u.id} value={u.id}>{u.nome}{unidadesOk.includes(u.id) ? "" : " · troca a conta"}</option>
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
        {campo("Valor", <CampoValorBR style={S.input} valor={f.valor} placeholder="0,00"
          aoMudar={(v) => set("valor", v)} />)}
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
        {obraAntiga ? campo("Cliente", <input style={S.input} value={f.cliente || ""} placeholder="como está na base antiga"
          onChange={(e) => setF((p) => ({ ...p, cliente: e.target.value, clienteId: "" }))} />) : campo(ehEmp ? "Empreendimento" : "Cliente", (
          <Selecao style={{ ...S.input, cursor: "pointer" }}
            value={f.clienteId || ""}
            aoCriar={!ehEmp && aoCriarCliente ? (termo) => { setErroCli(""); setNovoCli({ nome: termo || "", cpfCnpj: "", telefone: "" }); } : undefined}
            criarRotulo="cliente"
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
        {novoCli && (
          <div style={{ gridColumn: "1 / -1" }}>
            <CadastroRapidoDeCliente form={novoCli} aoMudar={setNovoCli} erro={erroCli}
              aoSalvar={() => {
                if (!String(novoCli.nome || "").trim()) { setErroCli("Escreva o nome."); return; }
                const criado = aoCriarCliente ? aoCriarCliente(novoCli, f.unidadeId) : null;
                if (!criado) { setErroCli("Não consegui cadastrar agora."); return; }
                setF((p) => ({ ...p, clienteId: criado.id, cliente: criado.nome || "", empreendimentoId: "" }));
                setNovoCli(null); setErroCli("");
              }}
              aoCancelar={() => { setNovoCli(null); setErroCli(""); }} />
          </div>
        )}
        {ehEmp && !doCadastro.length && (
          <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#b45309" }}>
            Nenhum empreendimento cadastrado ainda. Abra Clientes, cadastre o empreendimento e marque
            “É um empreendimento do escritório”.
          </div>
        )}
        {obraAntiga
          ? campo("Obra", <input style={S.input} value={f.projeto || ""} placeholder="como está na base antiga"
              onChange={(e) => setF((p) => ({ ...p, projeto: e.target.value, obraId: "" }))} />)
          : naObra
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
        {!entradaSemFornecedor && campo("Fornecedor", (
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
      {/* Obra encerrada: a obra antiga não está no cadastro (ou já fechou) e
          o lançamento é um acerto dela — um estorno, uma devolução. Marcado,
          cliente e obra viram texto e a trava de "informe a obra" sai. */}
      {podeObraAntiga && (
        <label data-vk-obra-encerrada="1" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#4b5563", cursor: "pointer", marginTop: -4 }}>
          <input type="checkbox" checked={!!f.obraEncerrada}
            onChange={(e) => { const v = e.target.checked;
              setF((p) => ({ ...p, obraEncerrada: v, ...(v ? { clienteId: "", obraId: "" } : {}) })); }} />
          Obra encerrada / ajuste de obra antiga — lançar sem cliente e obra do cadastro
        </label>
      )}
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
            {(() => {
              // O outro lado da mesma transação: a conta da obra do cliente.
              const nomeNaObra = (((typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : []).find((c) => c && c.id === EF_CONTA_GESTAO_NA_OBRA)) || {}).nome || "Gestão de obra";
              const papeis = anexosDaTransacao(f).length;
              const oPapel = !papeis ? "" : lida && lida.rotulo === "Cheque" && papeis === 1 ? "o cheque" : papeis === 1 ? "o comprovante" : `os ${papeis} papéis`;
              const dia = String(f.lancadoEm || "").slice(0, 10).split("-").reverse().join("/");
              return (
                <div data-vk-gestao-obra="1">
                  Na obra <b>{obraNome}</b>, conta <b>{nomeNaObra}</b>: a parcela {pv.parcela.n}/{pv.parcela.de}{" "}
                  {pv.parcela.pago ? <>fica <b>paga</b>{dia ? ` em ${dia}` : ""}</> : "continua em aberto"}
                  {oPapel ? <>, com {oPapel} anexado{papeis > 1 ? "s" : ""}</> : null}.
                </div>
              );
            })()}
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
                  opcoes={typeof opcoesDeEtapaDoLancamento === "function" ? opcoesDeEtapaDoLancamento(null, "— escolha a etapa —")
                    : [{ valor: "", rotulo: "— escolha a etapa —" }]
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
                  {(() => {
                    const insEt = it.insumoCodigo ? (insumos || []).find((m) => m && (m.codigo === it.insumoCodigo || m.id === it.insumoCodigo)) : null;
                    const pedePav = typeof faltaPavimento === "function" && faltaPavimento(insEt, it.etapa);
                    return (
                      <div style={{ minWidth: 0 }}>
                        <div style={{ ...S.rot, color: pedePav ? "#b45309" : S.rot.color }}>{pedePav ? "Etapa — escolha o pavimento" : "Etapa"}</div>
                        <SelectBusca style={pedePav ? { ...S.input, borderColor: "#f59e0b" } : S.input} value={it.etapa}
                          onChange={(v) => mexerItem(i, { etapa: v })}
                          placeholder={pedePav ? "Térreo, Pav 1 ou Pav 2…" : "Procurar etapa…"}
                          opcoes={typeof opcoesDeEtapaDoLancamento === "function" ? opcoesDeEtapaDoLancamento(insEt, "— escolha a etapa —")
                            : [{ valor: "", rotulo: "— escolha a etapa —" }]
                            .concat(etapasDaObra.map((e) => ({ valor: e.id, rotulo: e.nome || e.titulo || e.id })))} />
                      </div>
                    );
                  })()}
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
            {/* os itens que o papel trouxe e não estão na lista (ela já tinha
                coisa escrita quando o papel foi lido): um clique traz */}
            {lida && (lida.lidos || []).length > 0 && !itensDoCusto.some((x) => x && x.textoLido) && (
              <button type="button" data-vk-itens-do-papel style={{ ...S.btnSec, color: "#0474f4" }}
                onClick={() => setF((p) => ({ ...p, itens: (p.itens || []).filter((x) => !itemDoCustoEmBranco(x)).concat(lida.lidos) }))}>
                Trazer {lida.lidos.length === 1 ? "o item" : `os ${lida.lidos.length} itens`} do papel
              </button>
            )}
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
          ) : destinoDoCusto && destinoDoCusto.conta && estornoNaObra ? (
            <span data-vk-estorno-obra="1">
              <b>Estorno.</b> Dinheiro que entrou no banco numa conta de custo da obra: entra em <b>{(obraAlvo.nome || "obra")}</b> como
              <b> − {efDinheiro(Math.abs(efValorDoCampo(f.valor)))}</b> em <b>{nomeContaObra || "a conta"}</b>, abatendo o custo (na etapa escolhida),
              e no extrato do escritório como estorno em <b>{destinoDoCusto.conta}</b> — entrada, como no banco.
            </span>
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
      {saldoReservaCli > 0 && (
        <label data-vk-paga-reserva="1" style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.5, cursor: "pointer",
          color: "#1e3a8a", background: "#eff6ff", border: "1px solid rgba(4,116,244,0.3)", borderRadius: 10, padding: "9px 11px" }}>
          <input type="checkbox" checked={pagarDaReserva} onChange={(e) => setPagarDaReserva(e.target.checked)} style={{ marginTop: 3, accentColor: "#0474f4", flexShrink: 0 }} />
          <span>
            <b>Pagar da reserva da engenharia</b> — este cliente tem <b>{efDinheiro(saldoReservaCli)}</b> guardados. O custo do engenheiro já entrou em
            Parceiros quando o projeto foi recebido; o pagamento sai da reserva, sem contar o custo de novo.
            {excedeReserva > 0 && <> Passa da reserva: <b>{efDinheiro(saldoReservaCli)}</b> saem dela e só <b>{efDinheiro(excedeReserva)}</b> entram como custo novo em Parceiros.</>}
          </span>
        </label>
      )}
      {iguaisNaObra.length > 0 && (
        <div data-vk-dobro-obra="1" style={{ fontSize: 12.5, color: "#92400e", background: "#fffbeb", border: "1px solid rgba(180,83,9,0.3)",
          borderRadius: 10, padding: "9px 11px", lineHeight: 1.5 }}>
          <b>Já está na obra.</b> {(obraAlvo && obraAlvo.nome) || "A obra"} já tem {iguaisNaObra.length === 1 ? "esta conta paga" : iguaisNaObra.length + " contas pagas"} de{" "}
          <b>{efDinheiro(efValorDoCampo(f.valor))}</b>, sem lançamento no escritório:{" "}
          {iguaisNaObra.slice(0, 3).map((a) => `${a.fonte.descricao || "conta"} (${String(a.fonte.data || "").split("-").reverse().join("/")})`).join(", ")}.
          {" "}Se é o mesmo pagamento, cancele e use <b>“Ligar à obra”</b> na linha do extrato — lançar aqui criaria o custo duas vezes.
          <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6, cursor: "pointer", color: "#374151" }}>
            <input type="checkbox" data-vk-outro-pagamento checked={outroPagamento} onChange={(e) => setOutroPagamento(e.target.checked)} />
            É outro pagamento — lançar mesmo assim
          </label>
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
            {lida.rotulo || rotuloDoPapelLido(lida.papel, entradaNoForm)}{lida.papel.numeroNota || lida.papel.numeroPedido ? " " + (lida.papel.numeroNota || lida.papel.numeroPedido) : ""}
          </b>
          {(lida.papel.fantasia || lida.papel.lidoComo) ? " · " + (lida.papel.fantasia || lida.papel.lidoComo) : ""}
          {lida.papel.cnpj ? " · " + String(lida.papel.cnpj).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : ""}
          {lida.papel.emitido ? (lida.rotulo === "Cheque" || /^Comprovante/.test(lida.rotulo || "") ? " · de " : " · emitida ") + lida.papel.emitido.split("-").reverse().join("/") : ""}
          {lida.papel.valor ? " · " + efDinheiro(lida.papel.valor) : ""}
          {Number(lida.papel.desconto) > 0 ? ` (desconto ${efDinheiro(lida.papel.desconto)})` : ""}
          {lida.itens ? ` · ${lida.itens} ${lida.itens === 1 ? "item" : "itens"}, ${lida.casados} no catálogo` : ""}
          <span style={{ color: "#9ca3af" }}> — lido {lida.origem === "xml" ? "do XML" : lida.origem === "ia" ? "pela IA" : "pelo leitor do VICKE"}</span>
          {lida.cadastro ? <span style={{ color: "#0474f4" }}> · fornecedor {lida.cadastro.nome}</span>
            : (lida.papel.lidoComo && !entradaNoForm && !f.fornecedorId && !novoPrest && (
              <button type="button" style={{ background: "none", border: "none", padding: 0, marginLeft: 6, fontSize: 12, color: "#0474f4",
                cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}
                onClick={() => { setErroPrest(""); setNovoPrest({ nome: lida.papel.fantasia || lida.papel.lidoComo, categoria: "Loja / Comércio",
                  cnpjCpf: lida.papel.cnpj || "" }); }}>
                + cadastrar {lida.papel.fantasia || lida.papel.lidoComo}
              </button>
            ))}
        </div>
      )}
      {!naObra && !entradaNoForm && (f.itens || []).length > 0 && (
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
        <div style={{ fontSize: 12, color: "#b91c1c" }}>
          {todosErros.join(" · ")}
          {/* A trava de cliente e obra fica no pé; a saída dela (obra
              encerrada) mora lá em cima, junto dos campos. O atalho fica aqui,
              onde o olho já está. */}
          {podeObraAntiga && !obraAntiga && todosErros.some((e) => /Informe o cliente|Informe a obra/.test(e)) && (
            <button type="button" data-vk-obra-encerrada-atalho="1"
              onClick={() => setF((p) => ({ ...p, obraEncerrada: true, clienteId: "", obraId: "" }))}
              style={{ background: "none", border: "none", padding: 0, marginLeft: 8, fontSize: 12, color: "#0474f4",
                cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>
              É obra encerrada / ajuste de obra antiga?
            </button>
          )}
        </div>
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
              const r0 = resultadoEmpreendimento(lancs, c.id, { concluido: c.ativo === false });
              const inv = investidoDoEmpreendimento(c, (data || {}).obras || [], lancs);
              // o resultado da venda é contra o custo inteiro, não só o que passou pela conta
              const r = { ...r0, investido: inv.total, resultado: r0.resultado == null ? null : efCentavos(r0.vendido - inv.total) };
              return (
                <tr key={c.id} style={{ borderTop: "1px solid rgba(38,36,33,0.06)" }}>
                  <td style={{ padding: "7px 12px" }}>{c.nome}</td>
                  <td style={{ padding: "7px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {efDinheiro(r.investido)}
                    {inv.foraDaConta !== 0 && (
                      <div data-vk-investido-partes style={{ fontSize: 11, color: "#6b7280", marginTop: 2, lineHeight: 1.35 }}>
                        <span style={{ whiteSpace: "nowrap" }}>{efDinheiro(inv.pelaConta)} pela conta</span>{" · "}
                        <span style={{ whiteSpace: "nowrap" }}>{efDinheiro(inv.foraDaConta)} por fora</span>
                      </div>
                    )}
                  </td>
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
        Investido é o custo da obra inteira: o que passou pela conta do escritório mais o que foi pago na obra por fora
        (cartão, boleto de outra conta) e ainda não tem lançamento aqui. O investido não entra no resultado do mês. Enquanto houver unidade por vender, o que entra é
        recebimento, não lucro — o resultado é apurado quando você desmarca “Em andamento” no cadastro.
      </div>
    </div>
  );
}

// Projetos ganhos com parcela ainda por receber: o "a receber" do
// escritório. Some sozinho quando a parcela é recebida pela fila do extrato.
function ProjetosAReceberQuadro({ data, lancs }) {
  const S = EF_ESTILO;
  const pend = parcelasDosProjetos((data || {}).orcamentosProjeto, (data || {}).clientes, lancs)
    .filter((p) => !p.recebida).sort((a, b) => String(a.data).localeCompare(String(b.data)));
  if (!pend.length) return null;
  const hoje = new Date().toISOString().slice(0, 10);
  const total = efCentavos(pend.reduce((t, p) => t + p.valor, 0));
  const td = { padding: "7px 12px", fontSize: 12.5 };
  return (
    <div data-vk-a-receber style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Projetos a receber</div>
        <div style={{ fontSize: 12, color: "#4b5563" }}>{pend.length} parcela{pend.length > 1 ? "s" : ""} · <b>{efDinheiro(total)}</b></div>
      </div>
      <div style={S.quadro}>
        {pend.map((p, i) => {
          const vencida = p.data && p.data < hoje;
          return (
            <div key={p.orcId + "|" + p.numero} style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", alignItems: "center",
              borderTop: i ? "1px solid rgba(38,36,33,0.06)" : "none", ...td }}>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <div>{p.cliente || "—"}{p.referencia ? <span style={{ color: "#6b7280" }}> · {p.referencia}</span> : null}</div>
                <div style={{ fontSize: 11.5, color: "#6b7280" }}>
                  {p.rotulo.charAt(0).toUpperCase() + p.rotulo.slice(1)}{p.eng > 0 ? ` · ${efDinheiro(p.eng)} é engenharia (custo de parceiro, guardado na reserva)` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "baseline", marginLeft: "auto" }}>
                <div style={{ fontSize: 12, color: vencida ? "#b91c1c" : "#6b7280", whiteSpace: "nowrap" }}>
                  {p.data ? (vencida ? "venceu " : "vence ") + p.data.split("-").reverse().join("/") : "sem data"}
                </div>
                <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, whiteSpace: "nowrap", minWidth: 100, textAlign: "right" }}>{efDinheiro(p.valor)}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11.5, color: "#6b7280" }}>
        Vem dos orçamentos marcados como Ganho. Quando o dinheiro cai no banco, a linha do extrato já sugere a parcela — “✓ Receber parcela”.
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

          <ProjetosAReceberQuadro data={dadosDoPainel} lancs={lancs} />

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
  const prontas = lista.filter((m) => { const r = fila.rapido(m); return r && r.lancamento && !r.lancamento.naObra && !r.lancamento.ligarObra && !r.lancamento.recebimentoExtras; });
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
                    {sug && sug.palpite && (
                      <div data-vk-palpite="1" style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>
                        sugestão: <b style={{ color: "#374151" }}>{[
                          sug.campos.contaFonte === "obra" ? ((typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : []).find((x) => x.id === sug.campos.contaId) || {}).nome : (contaSug && contaSug.nome),
                          sug.campos.projeto, sug.campos.fornecedor].filter(Boolean).join(" · ")}</b>
                      </div>
                    )}
                    {sug && sug.estorno && !sug.bloqueio && (
                      <div data-vk-estorno-achado="1" style={{ fontSize: 11.5, color: "#047857", marginTop: 2 }}>
                        ↺ {(sug.motivos || [])[0]} — volta para a mesma conta, como estorno{sug.naObra ? ", no escritório e na obra" : ""}
                      </div>
                    )}
                    {sug && sug.parcelaProjeto && (
                      <div data-vk-parcela-projeto="1" style={{ fontSize: 11.5, color: "#0474f4", marginTop: 2 }}>
                        ⇠ {(sug.motivos || [])[0]} — {sug.parcelaProjeto.eng > 0
                          ? `${efDinheiro(Number(m.valor))} receita de projeto · ${efDinheiro(Math.min(sug.parcelaProjeto.eng, Number(m.valor)))} de engenharia em Parceiros, guardado na reserva`
                          : "receita de projeto"}
                      </div>
                    )}
                    {sug && sug.jaNaObra && (
                      <div data-vk-ja-na-obra="1" style={{ fontSize: 11.5, color: "#0474f4", marginTop: 2 }}>
                        ⇄ {(sug.motivos || [])[0]} — liga as duas pontas, sem lançar de novo
                      </div>
                    )}
                    {sug && sug.estorno && sug.bloqueio && (
                      <div data-vk-estorno-sem-ligacao="1" style={{ fontSize: 11.5, color: "#b45309", marginTop: 2 }}>
                        ↺ {(sug.motivos || [])[0]}. {sug.bloqueio}
                      </div>
                    )}
                    {contaSug && !(sug && (sug.palpite || sug.estorno || sug.parcelaProjeto)) && (
                      <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>
                        como em {dataBR(sug.de.lancadoEm) || "lançamento anterior"}: <b style={{ color: "#374151" }}>{contaSug.nome}</b>
                        {sug.campos.cliente ? ` · ${sug.campos.cliente}` : ""}
                      </div>
                    )}
                  </div>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {dinheiro(m)}
                    {sug && sug.parcelaProjeto && !aberta ? (
                      <button data-vk-receber-parcela="1" style={{ ...S.btnSec, padding: "5px 10px", fontSize: 12, color: "#0474f4", borderColor: "rgba(4,116,244,0.4)" }}
                        disabled={!!ocupado}
                        onClick={(e) => { e.stopPropagation(); rapido(m); }}>✓ Receber parcela</button>
                    ) : sug && sug.jaNaObra && !aberta ? (
                      <button data-vk-ligar-obra="1" style={{ ...S.btnSec, padding: "5px 10px", fontSize: 12, color: "#0474f4", borderColor: "rgba(4,116,244,0.4)" }}
                        disabled={!!ocupado}
                        onClick={(e) => { e.stopPropagation(); rapido(m); }}>✓ Ligar à obra</button>
                    ) : sug && sug.estorno && !sug.bloqueio && !aberta ? (
                      <button data-vk-lancar-estorno="1" style={{ ...S.btnSec, padding: "5px 10px", fontSize: 12, color: "#047857", borderColor: "rgba(4,120,87,0.45)" }}
                        disabled={!!ocupado}
                        onClick={(e) => { e.stopPropagation(); rapido(m); }}>✓ Lançar estorno</button>
                    ) : contaSug && !sug.daObra && !aberta && (
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
                      inicial={fila.inicial(m)} competenciaFixa={fila.mes} motivos={(sug && sug.motivos) || []}
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

function ConferenciaComExtrato({ resultado, mapa, aoCorrigir, aoLancar, aoMarcarCasados, aoConfirmarPar, aoDescartar, aoExcluir, ocupado, fila }) {
  const S = EF_ESTILO;
  const [escolha, setEscolha] = useState({});
  if (!resultado) return null;
  const r = resultado.resumo;
  const casados = (resultado.casados || []).filter((c) => c && c.lancamento);
  const certosAbertos = casados.filter((c) => casamentoCerto(c) && !c.lancamento.conferido).length;
  const duvidas = casados.filter((c) => !casamentoCerto(c) && !c.lancamento.conferido);
  const dia = (d) => String(d || "").slice(0, 10).split("-").reverse().join("/");
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

      {/* O que casou sem dúvida não pede clique: conta como conferido e é
          gravado assim no fechamento do mês. Só a dúvida vem para a pessoa. */}
      {certosAbertos > 0 && (
        <div data-vk-certos="1" style={{ ...S.card, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, color: "#4b5563" }}>
          <span><strong style={{ color: "#0474f4" }}>{certosAbertos}</strong> {certosAbertos === 1 ? "lançamento casou" : "lançamentos casaram"} com o banco sem dúvida
            — já contam como conferidos e ficam gravados assim quando você fechar o mês.</span>
        </div>
      )}
      {duvidas.length > 0 && (
        <div data-vk-duvidas="1" style={{ ...S.card, display: "grid", gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              {duvidas.length === 1 ? "1 casamento em dúvida" : `${duvidas.length} casamentos em dúvida`}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
              {duvidas.every((c) => c.marcadoForaDaConta)
                ? "O banco tem a linha, mas o lançamento está marcado como “não passou pela conta”. Confira o par."
                : "O mesmo valor aparece mais de uma vez e o banco não diz de quem é. Confira o par — ou troque pelo lançamento certo."}
            </div>
          </div>
          {duvidas.map((c) => {
            const m = c.extrato;
            const opcoes = [c.lancamento].concat(c.alternativas || []);
            const idEscolhido = escolha[m.id] || c.lancamento.id;
            const escolhido = opcoes.find((l) => l.id === idEscolhido) || c.lancamento;
            const rot = (l) => [l.descricao || l.fornecedor || "—", [l.cliente, l.projeto].filter(Boolean).join(" · "),
              l.lancadoEm ? "lançado " + dia(l.lancadoEm) : ""].filter(Boolean).join(" — ");
            return (
              <div key={m.id || m.historico + m.data} style={{ border: "1px solid rgba(38,36,33,0.12)", borderRadius: 12, padding: "10px 12px",
                display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .5, color: "#6b7280" }}>No banco · {dia(m.data)}</div>
                  <div style={{ fontSize: 12.5, color: "#262421", wordBreak: "break-word" }}>{m.historico || "—"}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{efDinheiro(Math.abs(m.valor))}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .5, color: "#6b7280" }}>É este lançamento?</div>
                  {c.marcadoForaDaConta && escolhido.id === c.lancamento.id && (
                    <div data-vk-marcado-fora style={{ fontSize: 11.5, color: "#b45309", marginBottom: 4, lineHeight: 1.4 }}>
                      Está marcado como “não passou pela conta” (parcela a vencer da planilha antiga, provavelmente). Confirmar liga à linha do banco e corrige para “passou”.
                    </div>
                  )}
                  {opcoes.length > 1 ? (
                    <select value={idEscolhido} onChange={(e) => setEscolha((x) => ({ ...x, [m.id]: e.target.value }))}
                      style={{ ...S.input, width: "100%", fontSize: 12.5 }}>
                      {opcoes.map((l) => <option key={l.id} value={l.id}>{rot(l)}</option>)}
                    </select>
                  ) : (
                    <div style={{ fontSize: 12.5 }}>{rot(escolhido)}</div>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button style={{ ...S.btn, opacity: ocupado ? .45 : 1 }} disabled={!!ocupado || !aoConfirmarPar}
                    onClick={() => aoConfirmarPar && aoConfirmarPar(m, escolhido)}>Confirmar</button>
                </div>
              </div>
            );
          })}
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
          {/* Uma linha por lançamento que quebra no celular: o que é (conta,
              descrição, cliente) em cima, valor e ações embaixo — a tabela
              larga escondia, no celular, justamente qual era o lançamento. */}
          <div style={{ ...S.quadro, overflow: "visible" }}>
            {resultado.contabilizadoSemPar.map((l, i) => (
              <div key={l.id} data-vk-sem-par style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 12px",
                padding: "8px 12px", borderTop: i ? "1px solid rgba(38,36,33,0.06)" : "none", fontSize: 12.5 }}>
                <div style={{ flex: "1 1 260px", minWidth: 0, display: "flex", flexWrap: "wrap", gap: "2px 12px" }}>
                  <span style={{ color: "#6b7280", minWidth: 130 }}>{(contaEscritorio(l.contaId) || {}).nome || "—"}</span>
                  <span style={{ flex: "1 1 160px", minWidth: 0 }}>{l.descricao || l.fornecedor || "—"}</span>
                  <span style={{ color: "#6b7280", flex: "1 1 160px", minWidth: 0 }}>{[l.cliente, l.projeto].filter(Boolean).join(" · ")}</span>
                  {(resultado.invertidos || {})[l.id] && (() => {
                    const m = resultado.invertidos[l.id].extrato;
                    const entrada = Number(m.valor) > 0;
                    return (
                      <span data-vk-invertido style={{ flexBasis: "100%", fontSize: 11.5, color: "#b45309" }}>
                        ⚠ sinal invertido? O banco tem uma {entrada ? "entrada" : "saída"} do mesmo valor em {String(m.data || "").slice(0, 10).split("-").reverse().join("/")} ainda
                        sem lançamento ({String(m.historico || "").slice(0, 70)}). Se for {entrada ? "o reembolso deste pagamento" : "o pagamento desta entrada"}, edite
                        este lançamento para {entrada ? "uma conta de entrada (Reembolsos)" : "uma conta de saída"} — não exclua.
                      </span>
                    );
                  })()}
                  {(resultado.duplicados || {})[l.id] && !(resultado.invertidos || {})[l.id] && (() => {
                    const g = resultado.duplicados[l.id];
                    const d = (x) => String(x || "").slice(0, 10).split("-").reverse().join("/");
                    const ligado = !!(g.lancamento.origem && g.lancamento.origem.obraId);
                    return (
                      <span data-vk-duplicado style={{ flexBasis: "100%", fontSize: 11.5, color: "#b45309" }}>
                        ⚠ provável duplicado: “{g.lancamento.descricao || "lançamento"}” ({d(g.lancamento.lancadoEm)}), do mesmo valor e na mesma conta,
                        já casou com a linha do banco de {d(g.extrato.data)}.{ligado ? " Aquele está ligado à obra — exclua este." : ""}
                      </span>
                    );
                  })()}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", marginRight: 6 }}>{efValorDoLancamento(l)}</span>
                  <button style={S.btnSec} onClick={() => aoDescartar(l)}>Não passou pela conta</button>
                  {/* Lançado por engano: sai da base ali mesmo. A exclusão é a
                      mesma da Base de dados — trava de mês fechado, a conta da
                      obra que é a mesma transação sai junto, e pede confirmação. */}
                  {aoExcluir && (
                    <button data-vk-excluir-sem-par style={{ ...S.btnSec, color: "#b91c1c" }} disabled={!!ocupado}
                      onClick={() => aoExcluir(l)}>Excluir</button>
                  )}
                </div>
              </div>
            ))}
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
// O campo de valor da tela: pontos de milhar e vírgula aparecem enquanto
// se digita; o cursor fica onde estava, contado pelos números.
function CampoValorBR({ valor, aoMudar, negativo, style, onBlur, ...resto }) {
  const ref = useRef(null);
  const cursor = useRef(null);
  const canon = valorBRDeFora(valor);
  const tela = valorBRNaTela(canon);
  const conta = (t) => (String(t).match(/[\d,-]/g) || []).length;
  useEffect(() => {
    const el = ref.current;
    if (cursor.current == null || !el || (typeof document !== "undefined" && document.activeElement !== el)) { cursor.current = null; return; }
    const alvo = cursor.current;
    cursor.current = null;
    let pos = 0, n = 0;
    while (pos < el.value.length && n < alvo) { if (/[\d,-]/.test(el.value.charAt(pos))) n++; pos++; }
    try { el.setSelectionRange(pos, pos); } catch (e) { /* campo sem seleção */ }
  });
  return (
    <input ref={ref} {...resto} style={style} type="text" inputMode="decimal" value={tela}
      onChange={(e) => {
        const bruto = e.target.value;
        const sel = e.target.selectionStart == null ? bruto.length : e.target.selectionStart;
        let novo = valorBRDigitado(bruto, { negativo });
        let antes = conta(valorBRDigitado(bruto.slice(0, sel), { negativo }));
        // Apagar só o ponto de milhar não mudaria nada (ele volta): apaga o
        // número ao lado dele, como a pessoa esperava.
        const tipo = (e.nativeEvent && e.nativeEvent.inputType) || "";
        if (novo === canon && bruto.length === tela.length - 1 && /^delete/.test(tipo)) {
          const k = tipo === "deleteContentForward" ? antes : antes - 1;
          if (k >= 0 && k < canon.length && /\d/.test(canon.charAt(k))) {
            novo = valorBRDigitado(canon.slice(0, k) + canon.slice(k + 1), { negativo });
            antes = k;
          }
        }
        cursor.current = Math.min(antes, conta(novo));
        aoMudar(novo);
      }}
      onBlur={(e) => {
        const completo = valorBRCompleto(valorBRDigitado(e.target.value, { negativo }));
        if (completo !== canon) aoMudar(completo);
        if (onBlur) onBlur(e);
      }} />
  );
}

function FechamentoEscritorioTela({ lancs, linhas, fechamentos, mes, aoTrocarMes, aoMarcar, aoMarcarTodos, aoFechar, aoReabrir, ocupado, extrato, aoGuardarAplicacao, aoGuardarBanco, aoLancarRendimento }) {
  const S = EF_ESTILO;
  // A conferência é feita ao longo do mês, com o extrato parcial: por isso
  // a tela abre mostrando só o que ainda falta bater.
  const [soPendentes, setSoPendentes] = useState(true);
  const meses = (linhas || []).map((l) => l.mes);
  const linha = (linhas || []).find((l) => l.mes === mes);
  const certos = useMemo(() => new Set(((extrato && extrato.resultado && extrato.resultado.casados) || [])
    .filter((c) => casamentoCerto(c) && c.lancamento).map((c) => c.lancamento.id)), [extrato && extrato.resultado]);
  const conf = conferenciaDoMes(lancs, mes, { certos });
  // O lançamento que casou com o banco, mas em dúvida: a confirmação também
  // fica na linha dele aqui, não só no quadro lá de cima.
  const duvidaDe = useMemo(() => {
    const m = {};
    for (const c of ((extrato && extrato.resultado && extrato.resultado.casados) || [])) {
      if (c && c.lancamento && !casamentoCerto(c) && !c.lancamento.conferido) m[c.lancamento.id] = c;
    }
    return m;
  }, [extrato && extrato.resultado]);
  const registro = (fechamentos || {})[mes] || {};
  const fechado = mesEstaFechado(mes, fechamentos);
  // O saldo do banco: o que foi informado ao fechar; sem ele, o da última
  // linha SALDO do extrato do mês — o arquivo já traz o número.
  const saldoLido = extrato && extrato.saldoLido != null ? extrato.saldoLido : null;
  const bancoInicial = (reg) => (reg.saldoBanco != null && reg.saldoBanco !== "" ? Number(reg.saldoBanco).toFixed(2).replace(".", ",")
    : saldoLido != null ? saldoLido.toFixed(2).replace(".", ",") : "");
  const [banco, setBanco] = useState(() => bancoInicial(registro));
  // Volta ao gravado só quando muda o mês ou o saldo gravado/lido — não a
  // cada gravação do registro (a aplicação grava nele e apagava o saldo do
  // banco que estava sendo digitado).
  const saldoBancoGravado = ((fechamentos || {})[mes] || {}).saldoBanco;
  useEffect(() => {
    setBanco(bancoInicial((fechamentos || {})[mes] || {}));
  }, [mes, saldoBancoGravado, saldoLido]);
  const bancoDoExtrato = registro.saldoBanco == null && saldoLido != null && efNumero(banco) === saldoLido;
  const saldoBanco = efNumero(banco);
  const calculado = linha ? linha.saldoExtrato : 0;
  const aplicacaoGravada = saldoAplicacaoDoMes(fechamentos, mes);
  const [aplicacao, setAplicacao] = useState(aplicacaoGravada == null ? "" : aplicacaoGravada.toFixed(2).replace(".", ","));
  // Com a aplicação informada, a régua é banco + aplicação: a diferença
  // para o calculado é a receita financeira do mês.
  const aplicacaoAtual = efNumero(aplicacao);
  const rendimentoDoMes = rendimentoLancadoNoMes(lancs, mes);
  const comAplicacao = aplicacaoAtual != null;
  const diferenca = comAplicacao
    ? receitaFinanceiraDoMes(calculado, saldoBanco, aplicacaoAtual)
    : diferencaDeFechamento(calculado, saldoBanco == null ? "" : saldoBanco);
  const podeFechar = !fechado && diferenca === 0 && !ocupado;
  useEffect(() => {
    setAplicacao(aplicacaoGravada == null ? "" : aplicacaoGravada.toFixed(2).replace(".", ","));
  }, [mes, aplicacaoGravada]);
  // Colar o extrato: com a tela de fechamento aberta, um Ctrl+V de arquivo
  // em qualquer ponto dela entra como se tivesse sido arrastado.
  const receberRef = useRef(null);
  receberRef.current = extrato && extrato.receber;
  const temExtrato = !!extrato;
  useEffect(() => {
    if (!temExtrato || typeof window === "undefined") return undefined;
    const aoColar = (e) => {
      const f = arquivoDoColar(e.clipboardData);
      if (!f || !receberRef.current) return;
      e.preventDefault();
      receberRef.current(f);
    };
    window.addEventListener("paste", aoColar);
    return () => window.removeEventListener("paste", aoColar);
  }, [temExtrato]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Todos os blocos com a mesma régua: rótulo, campo (38px) e uma linha
          de apoio embaixo. Assim os campos e os números ficam sempre na mesma
          altura, tenham ou não a linha de apoio. */}
      {(() => {
        const rot = { fontSize: 10.5, textTransform: "uppercase", letterSpacing: .5, color: "#6b7280", lineHeight: "14px", height: 14, whiteSpace: "nowrap" };
        const apoio = { fontSize: 10.5, color: "#6b7280", lineHeight: "14px", minHeight: 14, whiteSpace: "nowrap" };
        const caixa = { height: 38, boxSizing: "border-box" };
        const numero = { ...caixa, display: "flex", alignItems: "center", fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
        const bloco = (chave, rotulo, controle, linhaDeApoio, extra) => (
          <div key={chave} data-vk-bloco-fecho={chave} style={{ display: "grid", gridTemplateRows: "14px 38px auto", gap: 4, ...(extra || {}) }}>
            <span style={rot}>{rotulo}</span>
            {controle}
            <span style={apoio}>{linhaDeApoio || "\u00a0"}</span>
          </div>
        );
        const totalComBanco = aplicacaoGravada != null && saldoBanco != null ? efCentavos(saldoBanco + aplicacaoGravada) : null;
        return (
          <div style={{ ...S.card, display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            {bloco("mes", "Mês", (
              <Selecao value={mes} onChange={(e) => aoTrocarMes(e.target.value)}
                style={{ ...S.input, ...caixa, padding: "7px 10px", width: 190, cursor: "pointer" }}>
                {meses.slice().sort((a, b) => String(b).localeCompare(String(a)))
                  .map((m) => <option key={m} value={m}>{efMesPorExtenso(m) + (mesEstaFechado(m, fechamentos) ? " ✓" : "")}</option>)}
              </Selecao>
            ))}
            {bloco("banco", "Saldo do banco", (
              <CampoValorBR style={{ ...S.input, ...caixa, width: 150 }} valor={banco} placeholder="0,00" negativo
                disabled={fechado} aoMudar={setBanco}
                onBlur={(e) => {
                  // grava o saldo digitado no mês (sem fechar): é ele que soma
                  // com a aplicação no total do Extrato
                  if (!aoGuardarBanco || fechado) return;
                  const v = efNumero(valorBRCompleto(valorBRDigitado(e.target.value, { negativo: true })));
                  if (v !== saldoBancoGravado) aoGuardarBanco(mes, v == null ? "" : v);
                }} />
            ), bancoDoExtrato ? "lido do extrato" : "")}
            {bloco("calculado", "Saldo calculado", <div style={numero}>{efDinheiro(calculado)}</div>)}
            {bloco("diferenca", comAplicacao ? "Receita financeira" : "Diferença", (
              <div style={{ ...numero, color: diferenca === 0 ? "#0474f4" : (diferenca == null ? "#6b7280" : comAplicacao && diferenca > 0 ? "#047857" : "#b45309") }}>
                {diferenca == null ? "informe o saldo" : efDinheiro(diferenca)}
              </div>
            ), comAplicacao && diferenca != null
              ? (diferenca > 0 ? "banco + aplicação − calculado" : diferenca < 0 ? "calculado maior: confira os lançamentos" : rendimentoDoMes ? "rendimento lançado" : "")
              : "")}
            {/* A aplicação não entra na conferência com o banco: é outro saldo,
                informado à mão, e grava ao sair do campo — sem fechar o mês. */}
            {aoGuardarAplicacao && bloco("aplicacao", "Saldo da aplicação", (
              <CampoValorBR style={{ ...S.input, ...caixa, width: 150 }} valor={aplicacao} placeholder="0,00" disabled={fechado}
                aoMudar={setAplicacao}
                onBlur={(e) => {
                  const v = efNumero(valorBRCompleto(valorBRDigitado(e.target.value)));
                  if (v !== aplicacaoGravada) aoGuardarAplicacao(mes, v == null ? "" : v);
                }} />
            ), aplicacaoGravada == null ? "investimento · fim do mês" : "", { paddingLeft: 16, borderLeft: "1px solid rgba(38,36,33,0.12)" })}
            {/* O total é o que o escritório tem: a conta corrente (o saldo do
                banco) mais o que está aplicado. */}
            {aoGuardarAplicacao && aplicacaoGravada != null && bloco("total", "Conta + aplicação", (
              <div data-vk-total-disponivel="1" style={numero}>{totalComBanco == null ? <span style={{ fontSize: 13, fontWeight: 500, color: "#6b7280" }}>informe o saldo do banco</span> : efDinheiro(totalComBanco)}</div>
            ))}
            {bloco("acao", "", (
              <div style={{ ...caixa, display: "flex", gap: 8, alignItems: "center" }}>
                {ocupado && <span style={{ fontSize: 12, color: "#6b7280" }}>{ocupado}</span>}
                {/* O rendimento apurado vira lançamento em Receita Financeira:
                    com ele, o calculado chega em banco + aplicação e o mês fecha. */}
                {!fechado && comAplicacao && diferenca > 0 && aoLancarRendimento && (
                  <button data-vk-lancar-rendimento="1" style={{ ...S.btn, ...caixa, background: "#047857", borderColor: "#047857" }}
                    disabled={!!ocupado} onClick={() => aoLancarRendimento(mes, diferenca)}>
                    Lançar receita financeira
                  </button>
                )}
                {fechado ? (
                  <button style={{ ...S.btnSec, ...caixa }} onClick={() => aoReabrir(mes)}>Reabrir mês</button>
                ) : (
                  <button style={{ ...S.btn, ...caixa, opacity: podeFechar ? 1 : .45 }} disabled={!podeFechar}
                    onClick={() => aoFechar(mes, saldoBanco)}>Fechar {efMesPorExtenso(mes, true)}</button>
                )}
              </div>
            ), "", { marginLeft: "auto" })}
          </div>
        );
      })()}

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
              {extrato.arrastando ? "Pode soltar" : "Arraste, cole (Ctrl+V) ou clique para escolher o extrato"}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              {extrato.origem ? `Li de ${extrato.origem}`
                : extrato.guardado ? `Extrato guardado${extrato.guardado.origem ? ` (${extrato.guardado.origem})` : ""}, de ${String(extrato.guardado.atualizadoEm || "").slice(0, 10).split("-").reverse().join("/")} — traga o novo para atualizar`
                : "qualquer banco — OFX, HTML, .xlsx, .xlsm ou .csv"}
            </div>
          </div>
          <input ref={extrato.entrada} type="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt,.ofx,.html,.htm" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; extrato.receber(f); }} />
        </div>
      )}

      {/* O "check" da planilha de análise: débitos × saídas e créditos ×
          entradas. As duas diferenças têm que ser iguais — o que foi
          contabilizado fora do extrato entra nos dois lados. */}
      {extrato && extrato.checagem && (() => {
        const ch = extrato.checagem;
        const ant = (() => { const [a, m] = String(mes).split("-").map(Number); const d = new Date(Date.UTC(a, m - 2, 1)); return d.toISOString().slice(0, 7); })();
        const aplAnterior = saldoAplicacaoDoMes(fechamentos, ant);
        const pelaAplicacao = rendimentoPelaAplicacao(aplAnterior, ch.extrato.aplicacoes, ch.extrato.resgates, aplicacaoAtual);
        const th = { textAlign: "right", fontSize: 10, textTransform: "uppercase", letterSpacing: .3, color: "#6b7280", fontWeight: 600, padding: "4px 6px", whiteSpace: "nowrap" };
        const td = { textAlign: "right", padding: "6px 6px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
        const tdN = { ...td, textAlign: "left", color: "#374151" };
        const efNum = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const cor = ch.bate ? "#0474f4" : "#b45309";
        // O que ainda está na fila "falta lançar" explica a diferença? Então
        // não é sinal invertido: é lançar o que falta.
        const pend = ((extrato.resultado && extrato.resultado.noBancoSemPar) || []).filter((m) => m && efEhMovimento(m.historico));
        const pendDeb = efCentavos(pend.filter((m) => Number(m.valor) < 0).reduce((t, m) => t - Number(m.valor), 0));
        const pendCred = efCentavos(pend.filter((m) => Number(m.valor) > 0).reduce((t, m) => t + Number(m.valor), 0));
        const restoDesvio = efCentavos((ch.difCredito + pendCred) - (ch.difDebito + pendDeb));
        const faltaExplica = !ch.bate && pend.length > 0 && Math.abs(restoDesvio) < 0.01;
        return (
          <div data-vk-checagem="1" style={{ ...S.card, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Débitos × créditos do mês</div>
              <div style={{ fontSize: 12, color: cor, fontWeight: 600 }}>
                {ch.bate
                  ? (Math.abs(ch.foraDoExtrato) >= 0.01
                    ? `✓ bate — ${efDinheiro(Math.abs(ch.foraDoExtrato))} contabilizado fora do extrato, nos dois lados`
                    : "✓ bate — tudo o que foi contabilizado passou pelo extrato")
                  : faltaExplica ? `falta lançar ${pend.length === 1 ? "1 linha" : pend.length + " linhas"} do extrato`
                  : `✗ não bate — as diferenças se afastam ${efDinheiro(Math.abs(ch.desvio))}`}
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              {/* valores sem "R$" (dito no título da coluna): cabe no celular */}
              <table style={{ borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead><tr><th style={{ ...th, textAlign: "left", paddingLeft: 0 }}>R$</th><th style={th}>Extrato</th><th style={th}>Contabilizado</th><th style={th}>Diferença</th></tr></thead>
                <tbody>
                  <tr><td style={{ ...tdN, paddingLeft: 0 }}>Débitos</td><td style={td}>{efNum(ch.extrato.debitos)}</td><td style={td}>{efNum(ch.base.saidas)}</td>
                    <td style={{ ...td, fontWeight: 700, color: cor }}>{efNum(Math.abs(ch.difDebito))}</td></tr>
                  <tr><td style={{ ...tdN, paddingLeft: 0 }}>Créditos</td><td style={td}>{efNum(ch.extrato.creditos)}</td><td style={td}>{efNum(ch.base.entradas)}</td>
                    <td style={{ ...td, fontWeight: 700, color: cor }}>{efNum(Math.abs(ch.difCredito))}</td></tr>
                </tbody>
              </table>
            </div>
            {faltaExplica && (
              <div style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.5 }}>
                A diferença é o que ainda falta lançar do extrato ({pend.length === 1 ? "1 linha" : pend.length + " linhas"}
                {pendCred ? `, ${efDinheiro(pendCred)} em créditos` : ""}{pendDeb ? `, ${efDinheiro(pendDeb)} em débitos` : ""}) — lançando, o check fecha.
              </div>
            )}
            {!ch.bate && !faltaExplica && (
              <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
                Falta lançamento ou tem valor com o sinal invertido. Um valor do lado errado afasta as diferenças em duas vezes ele:
                procure um lançamento de <b>{efDinheiro(Math.abs(ch.desvio) / 2)}</b>
                {ch.suspeitos.length ? <> — no mês: {ch.suspeitos.slice(0, 6).map((l, i) => (
                  <span key={i}>{i ? " · " : ""}<b>{l.descricao || "sem descrição"}</b> ({contaEscritorio(l.contaId)?.nome || l.contaId}, entrou como {l._lado})</span>
                ))}</> : "."}
              </div>
            )}
            <div style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.6 }}>
              <b>Aplicação no extrato:</b> aplicado {efDinheiro(ch.extrato.aplicacoes)} · resgatado {efDinheiro(ch.extrato.resgates)}
              {pelaAplicacao
                ? <> · {efMesPorExtenso(ant, true)} {efDinheiro(aplAnterior)} + aplicado − resgatado = <b>{efDinheiro(pelaAplicacao.principal)}</b>;
                    informado {efDinheiro(aplicacaoAtual)} → rendimento <b style={{ color: "#047857" }}>{efDinheiro(pelaAplicacao.rendimento)}</b>
                    {diferenca != null && comAplicacao && Math.abs(pelaAplicacao.rendimento - (diferenca + (ch.base.rendimento || 0))) >= 0.01
                      ? <span style={{ color: "#b45309" }}> (não bate com banco + aplicação − calculado: confira)</span> : null}</>
                : aplicacaoAtual == null ? " · informe o saldo da aplicação do mês" : ` · informe a aplicação de ${efMesPorExtenso(ant)} para conferir o rendimento por ela`}
              {ch.base.rendimento ? <> · receita financeira lançada no mês: {efDinheiro(ch.base.rendimento)}</> : null}
            </div>
          </div>
        );
      })()}

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
          aoLancar={extrato.lancar} aoMarcarCasados={extrato.marcarCasados} aoConfirmarPar={extrato.confirmarPar}
          aoDescartar={extrato.descartar} aoExcluir={extrato.excluir} ocupado={ocupado} fila={extrato.fila} />
      )}

      <div style={{ ...S.card, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, color: "#4b5563" }}>
        <span><strong style={{ color: "#262421" }}>{conf.conferidos}</strong> de {conf.total} conferidos
          {conf.peloExtrato > 0 && <span style={{ color: "#6b7280" }}> ({conf.peloExtrato} pelo extrato)</span>}</span>
        {conf.pendentes > 0 && <span>Falta conferir {efDinheiro(conf.valorPendente)} em {conf.pendentes} lançamentos</span>}
        {fechado && <span style={{ color: "#0474f4" }}>Mês fechado em {String(registro.fechadoEm || "").slice(0, 10).split("-").reverse().join("/")}</span>}
        <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} />
          Mostrar só o que falta conferir
        </label>
        {/* Com o extrato conferindo sozinho, "desmarcar todos" só desfaria a
            parte gravada e confundiria: some quando há conferidos pelo extrato. */}
        {!fechado && conf.total > 0 && (conf.pendentes > 0 || !conf.peloExtrato) && (
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
      ) : soPendentes && !conf.pendentes ? (
        <div style={{ ...S.card, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
          Nada falta conferir em {efMesPorExtenso(mes)}.
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
              {conf.lancamentos.filter((l) => !soPendentes || !(l.conferido || l._peloExtrato)).map((l) => {
                const conta = contaEscritorio(l.contaId);
                return (
                  <tr key={l.id} style={{ borderTop: "1px solid rgba(38,36,33,0.06)", background: (l.conferido || l._peloExtrato) ? "#f8fafc" : "transparent" }}>
                    <td style={{ padding: "6px 12px", whiteSpace: "nowrap" }}>
                      {l._peloExtrato ? (
                        <span title="Casou com o banco sem dúvida — fica conferido ao fechar o mês"
                          style={{ fontSize: 10.5, color: "#0474f4", fontWeight: 600 }}>✓ extrato</span>
                      ) : (
                        <input type="checkbox" checked={!!l.conferido} disabled={fechado || !!ocupado}
                          onChange={() => aoMarcar(l)} style={{ cursor: fechado ? "default" : "pointer" }} />
                      )}
                    </td>
                    <td style={{ padding: "6px 12px", color: l.conferido ? "#9ca3af" : "#262421" }}>{conta ? conta.nome : "—"}</td>
                    <td style={{ padding: "6px 12px", color: "#6b7280" }}>{[l.cliente, l.projeto].filter(Boolean).join(" · ") || "—"}</td>
                    <td style={{ padding: "6px 12px", color: "#6b7280" }}>{l.descricao || l.fornecedor || "—"}
                      {duvidaDe[l.id] && !l.conferido && (
                        <div data-vk-par-na-linha={l.id} style={{ fontSize: 11.5, color: "#b45309", marginTop: 3, lineHeight: 1.4 }}>
                          No banco em {String(duvidaDe[l.id].extrato.data || "").slice(0, 10).split("-").reverse().join("/")}
                          {duvidaDe[l.id].extrato.historico ? ` (${String(duvidaDe[l.id].extrato.historico).slice(0, 40)})` : ""}
                          {duvidaDe[l.id].marcadoForaDaConta ? " — estava marcado “não passou pela conta”." : "."}{" "}
                          {extrato && extrato.confirmarPar && !fechado && (
                            <button type="button" disabled={!!ocupado} onClick={() => extrato.confirmarPar(duvidaDe[l.id].extrato, l)}
                              style={{ color: "#0474f4", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600 }}>
                              É este — confirmar
                            </button>
                          )}
                        </div>
                      )}
                    </td>
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
                        <CampoValorBR style={inp} disabled={bloq} valor={editando.valor} aoMudar={(v) => mexe("valor", v)} /></div>
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
                      <CampoValorBR style={S.input} valor={editFatura.valor}
                        aoMudar={(v) => setEditFatura({ ...editFatura, valor: v })} /></div>
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
  // o que o palpite da fila do extrato lê: obras (com as contas), clientes
  // e o cadastro de fornecedores
  const ctxDoPalpite = { obras: (data || {}).obras || [], clientes: (data || {}).clientes || [], fornecedores: (data || {}).fornecedores || [],
    orcamentos: (data || {}).orcamentosProjeto || [],
    insumos: (data || {}).materiais || [] };
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
  // Receita da gestão de obra SEM contrato: vira conta paga de
  // "Gerenciamento de obra" na obra, e o lançamento do escritório nasce dela
  // pela ponte (Receita Gestão), ligado — as duas pontas da mesma transação.
  // Editando um lançamento que já existia, ele é substituído pelo ligado,
  // com a mesma referência e a mesma marca do extrato.
  function lancarGestaoAvulsaNaObra(l, marca) {
    const { gestaoAvulsaNaObra: _g, sinalDoBanco: _s, noContratoGestao: _n, ...resto } = l || {};
    const valor = Math.round(Math.abs(Number(resto.valor) || 0) * 100) / 100;
    if (!(valor > 0) || !resto.obraId) return false;
    const obraAlvo = (((data || {}).obras) || []).find((o) => o && o.id === resto.obraId) || null;
    if (!gestaoSemContratoVaiParaObra(obraAlvo)) return false;
    const nomeEsc = String(((data || {}).escritorio || {}).nome || "").trim() || "Escritório";
    lancarCustoNaObra({ ...resto, ...(marca || {}), naObra: true, obraIdAlvo: resto.obraId, contaId: EF_CONTA_GESTAO_NA_OBRA,
      itens: [itemUnicoDoCusto(valor, "", EF_CONTA_GESTAO_NA_OBRA, "Gerenciamento de obra", "")],
      fornecedor: nomeEsc, fornecedorId: "", valor, formaPagamento: "", estornoNaObra: false,
      gestaoAvulsa: { descricao: String(resto.descricao || "").trim(), substitui: resto.id || "", numeroDoc: resto.numeroDoc || "",
        criadoEm: resto.criadoEm || "" } });
    return true;
  }

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
    const av = l.gestaoAvulsa || null;
    const numeroDoc = (av && av.numeroDoc) || proximaReferencia(todas, lancamentosDoEscritorio(data));
    const papeis = anexosDaTransacao(l);
    // No cartão, cada conta leva o seu plano de parcelas: a fatura acha
    // por ele, e a ponte não manda a compra sozinha para o extrato.
    const cartaoDoCusto = l.formaPagamento === "cartao" ? cartaoPorId(cartoesDoEscritorio(data), l.cartaoId) : null;
    // Estorno (crédito do banco numa conta de custo): as contas nascem com
    // valor e quantidade negativos — o custo da etapa cai — e a ponte leva o
    // valor negativo ao escritório, que é o estorno de lá.
    const est = !!l.estornoNaObra;
    const contasDoLancamento = est ? contasDoPapel.map((c) => ({ ...c, estorno: true,
      valor: -Math.abs(Number(c.valor) || 0),
      ...(c.quantidade != null && c.quantidade !== "" ? { quantidade: -Math.abs(Number(c.quantidade) || 0) } : {}),
      descricao: /^estorno/i.test(String(c.descricao || "")) ? c.descricao : ("Estorno — " + (c.descricao || "")).trim() })) : contasDoPapel;
    const novas = contasDoLancamento.map((c) => {
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
    const daPonte = (marca ? ponte.lancamentos.map((x) => ({ ...x, ...marca })) : ponte.lancamentos)
      .map((x) => (est ? { ...x, estorno: true, ...(l.estornoDe ? { estornoDe: l.estornoDe } : {}) } : x))
      // gestão avulsa: o lançamento leva a descrição que a pessoa escreveu e
      // a marca de que a conta da obra não é parcela de contrato
      .map((x) => (av ? { ...x, origem: { ...(x.origem || {}), avulsa: true },
        ...(av.descricao ? { descricao: av.descricao } : {}), ...(av.criadoEm ? { criadoEm: av.criadoEm } : {}) } : x));
    // Original da base antiga achado na obra pelo estorno: fica ligado à conta
    // dele agora — as duas pontas passam a ser a mesma transação.
    const lig = l.ligarOriginal;
    const lancsLigados0 = lig && lig.id ? lancs.map((x) => (x && x.id === lig.id ? { ...x, origem: lig.origem } : x)) : lancs;
    // o lançamento que existia (editado para ligar à obra) dá lugar ao ligado
    const lancsLigados = av && av.substitui && daPonte.length ? lancsLigados0.filter((x) => x && x.id !== av.substitui) : lancsLigados0;
    save({ ...data, ...catalogoQueAprendeu(l),
      obras: todas.map((o) => (o && o.id === obra.id ? obraNova : o)),
      lancamentos: [...outrosLancamentos, ...lancsLigados, ...daPonte],
    }).catch(console.error);
    setForm(null);
  }

  // O fornecedor que ainda não existe entra sem sair da tela — quem está
  // conciliando o extrato não pode ser mandado para o cadastro e ter que
  // recomeçar a classificação quando voltar.
  // Cliente novo de dentro do lançamento: mesmo nome já cadastrado é o mesmo
  // cliente (não duplica).
  function criarClienteDoLancamento(campos, unidadeId) {
    const todos = (data || {}).clientes || [];
    const nome = String((campos || {}).nome || "").trim();
    if (!nome) return null;
    const igual = todos.find((x) => x && efSemAcento(x.nome) === efSemAcento(nome));
    if (igual) return igual;
    const novo = clienteRapidoDoLancamento(campos, unidadeId, typeof uid === "function" ? uid() : String(Date.now()));
    if (!novo) return null;
    save({ ...data, clientes: todos.concat([novo]) }).catch(console.error);
    return novo;
  }

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

  // Receita financeira do mês (rendimento da aplicação): um lançamento por
  // mês, ajustado se já existir. Pergunta antes, com o valor e o mês.
  async function lancarRendimento(mes, valor) {
    if (!(valor > 0)) return;
    const existente = rendimentoLancadoNoMes(lancs, mes);
    const ok = await dialogo.confirmar({
      titulo: `Lançar a receita financeira de ${efMesPorExtenso(mes)}?`,
      mensagem: existente
        ? `O rendimento já lançado no mês (${efDinheiro(existente.valor)}) passa a ${efDinheiro(efCentavos(Number(existente.valor) + valor))}.`
        : `Entra ${efDinheiro(valor)} em Receita Financeira (Escritório), no último dia do mês, fora da conta corrente — o rendimento nasce dentro da aplicação. Com ele, o calculado chega em banco + aplicação.`,
      confirmar: "Lançar",
    });
    if (!ok) return;
    salvarLancamento(lancamentoDoRendimento(mes, valor, existente));
  }

  function salvarLancamento(l) {
    if (l && l.naObra) { lancarCustoNaObra(l); return; }
    if (l && l.gestaoAvulsaNaObra) {
      const antes = l.id ? lancs.find((x) => x && x.id === l.id) : null;
      const marca = antes && antes.extratoId ? { extratoId: antes.extratoId, historicoBanco: antes.historicoBanco || "",
        conferido: !!antes.conferido, conferidoEm: antes.conferidoEm || "" } : null;
      if (lancarGestaoAvulsaNaObra({ ...l, numeroDoc: l.numeroDoc || (antes && antes.numeroDoc) || "", criadoEm: (antes && antes.criadoEm) || "" }, marca)) return;
    }
    // Lançamento novo que vem com pares fora do banco (o pagamento do
    // engenheiro que passa da reserva): grava os dois juntos, ligados.
    if (l && !l.id && Array.isArray(l.recebimentoExtras)) {
      const { recebimentoExtras, sinalDoBanco: _s, ...semExtras } = l;
      const agora = new Date().toISOString();
      const base = typeof uid === "function" ? uid() : String(Date.now());
      const numeroDoc = l.numeroDoc || proximaReferencia((data || {}).obras || [], lancs);
      gravar([...lancs, { ...semExtras, id: base, numeroDoc, criadoEm: agora, fornecedor: efNomeDoFornecedor(l), tipo: "escritorio" },
        ...recebimentoExtras.map((x, i) => ({ ...x, id: base + "_" + (i + 1), parDe: base, numeroDoc, criadoEm: agora, conferidoEm: agora }))]);
      setForm(null);
      return;
    }
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
          + (!pG ? `. Atenção: ele é da gestão de ${(obG && obG.nome) || "uma obra"}, mas a parcela dele não foi encontrada no contrato — nada muda na obra; confira lá depois.` : "")
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
    let obra = origem.obraId ? (((data || {}).obras || []).find((o) => o && o.id === origem.obraId) || null) : null;
    let contasJuntas = obra ? contasLigadasAoLancamento(obra, l) : [];
    const entradaJunta = obra && origem.tipo === "entrada" ? (obra.entradas || []).find((e) => e && e.id === origem.refId) : null;
    // Regra das duas pontas: lançamento da base antiga, sem ligação, cuja
    // conta existe na obra (mesmo papel ou mesmo valor no mesmo dia) sai junto
    // com ela — senão a obra ficaria com um custo que o escritório não tem.
    if (!contasJuntas.length && !entradaJunta && (l.unidadeId === "gestao_obras" || l.unidadeId === "empreendimento")) {
      const achadas = contasDaObraSemLigacao(l, obrasDoDonoDoLancamento(l, (data || {}).obras || []), lancs);
      if (achadas.length === 1) { obra = achadas[0].ob; contasJuntas = [achadas[0].k]; }
    }
    const refs = [...new Set(contasJuntas.map((c) => c.numeroDoc).filter(Boolean))];
    // Pares lançados juntos (recebimento do projeto, pagamento da engenharia):
    // são a mesma transação — saem todos, nunca só um lado.
    const idPrincipal = l.parDe || l.id;
    const paresJuntos = lancs.filter((x) => x && x.id !== l.id && (x.id === idPrincipal || x.parDe === idPrincipal));
    const ok = await dialogo.confirmar({
      titulo: daFatura ? "Excluir a linha da fatura?" : "Excluir este lançamento?",
      mensagem: `${contaEscritorio(l.contaId)?.nome || "Lançamento"} · ${efDinheiro(l.valor)} · ${mesAnoPorExtenso(l.competencia)}`
        + (daFatura ? `. A fatura de ${mesAnoPorExtenso(l.origem.competencia)} volta a ficar ABERTA em Cartões — as compras dela continuam lá, `
          + "e dá para editar e fechar de novo." : "")
        + (compraNoCartaoDoEscritorio(l) ? ". A compra sai também das faturas abertas do cartão." : "")
        + (contasJuntas.length ? `. Sai também da obra ${obra.nome || ""}: ${contasJuntas.length === 1 ? "1 conta" : contasJuntas.length + " contas"}`
          + (refs.length ? ` (ref ${refs.join(", ")})` : "") + " — é a mesma transação." : "")
        + (entradaJunta ? `. Sai também a entrada da obra ${obra.nome || ""} — é a mesma transação.` : "")
        + (paresJuntos.length ? `. Saem junto ${paresJuntos.length === 1 ? "1 lançamento ligado" : paresJuntos.length + " lançamentos ligados"} (${paresJuntos.map((x) => (contaEscritorio(x.contaId) || {}).nome || "lançamento").join(", ")}) — é a mesma transação.` : "")
        + (origem.obraId && !contasJuntas.length && !entradaJunta
          ? `. Atenção: ele aponta para ${obra ? "a obra " + (obra.nome || "") : "uma obra"}, mas a conta de lá não foi encontrada — nada muda na obra; confira lá depois.` : ""),
      confirmar: "Excluir", destrutivo: true,
    });
    if (!ok) return;
    const saem = new Set([l.id, ...paresJuntos.map((x) => x.id)]);
    const novos = lancs.filter((x) => !saem.has(x.id));
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
  // O arquivo só vale para este mês se trouxer movimento dele: o extrato de
  // outubro tem o "SALDO ANTERIOR" de 30/09, e isso não é o setembro.
  const arquivoServe = !!(doArquivo && doArquivo.some((m) => efEhMovimento(m.historico)));
  const movimentosExtrato = arquivoServe ? doArquivo : (guardadosDoMes.length ? guardadosDoMes : null);
  const ignoradosDoMes = ignoradosGuardados(extratosGuardados);
  const conciliacao = movimentosExtrato
    ? conciliarExtrato(movimentosExtrato, lancs.filter((l) => String(l.competencia) === String(mesEmConferencia)),
        { ignorados: ignoradosDoMes, fornecedores: (data && data.fornecedores) || [], historico: lancs })
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
    if (l && l.gestaoAvulsaNaObra && lancarGestaoAvulsaNaObra(l, marca)) return true;
    // Parcela de projeto recebida: a linha inteira em Receita Projetos e,
    // havendo engenharia, o custo do parceiro e a reserva que vai pagá-lo.
    if (l && Array.isArray(l.recebimentoExtras)) {
      const { recebimentoExtras, sinalDoBanco: _s, ...semExtras } = l;
      const base = typeof uid === "function" ? uid() : String(Date.now());
      const numeroDoc = proximaReferencia((data || {}).obras || [], lancs);
      const novos = [{ ...semExtras, ...marca, id: base, numeroDoc, criadoEm: agora },
        ...recebimentoExtras.map((x, i) => ({ ...x, id: base + "_" + (i + 1), parDe: base, numeroDoc, criadoEm: agora, conferidoEm: agora }))];
      gravar([...lancs, ...novos]);
      return true;
    }
    // A conta já estava paga na obra: liga, não lança de novo. A conta passa
    // a constar como paga pela conta do escritório, e o lançamento é o da
    // ponte — mesmo id e mesma referência da conta.
    if (l && l.ligarObra) {
      const { ligarObra, sinalDoBanco: _s, ...semLig } = l;
      const quem = typeof nomeDeQuem === "function" ? nomeDeQuem(perm && perm.usuario) : "";
      const ids = new Set(ligarObra.contaIds || []);
      const obras = ((data || {}).obras || []).map((o) => (o && o.id === ligarObra.obraId ? { ...o,
        contasPagar: (o.contasPagar || []).map((c) => (c && ids.has(c.id) ? { ...c, passouPelaConta: true,
          registros: [...(c.registros || []), { em: agora, ato: "ligada ao extrato", por: quem, detalhe: l.historicoBanco || "" }] } : c)) } : o));
      save({ ...data, obras, lancamentos: [...outrosLancamentos, ...lancs, { ...semLig, ...marca, criadoEm: agora }] }).catch(console.error);
      return true;
    }
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
  // Um clique na linha do banco: o estorno com o original achado vai direto,
  // até o de obra (nas duas pontas); senão, a linha igual do mês passado.
  function rapidoDoExtrato(m) {
    const est = sugestaoDeEstorno(m, lancs, ctxDoPalpite);
    if (est) return lancamentoDoEstornoDoExtrato(m, mesEmConferencia, est, fechamentos);
    const naObra = contaDaObraParaALinha(m, lancs, ctxDoPalpite);
    if (naObra) return lancamentoDaLigacaoComObra(m, mesEmConferencia, naObra, fechamentos, lancs);
    const parcelaProj = parcelaDeProjetoParaALinha(m, lancs, ctxDoPalpite);
    if (parcelaProj) return lancamentosDoRecebimento(m, mesEmConferencia, parcelaProj, fechamentos);
    return lancamentoRapidoDoExtrato(m, mesEmConferencia, sugestaoDoExtrato(m, lancs), fechamentos, (data || {}).obras || [], lancs);
  }

  function lancarSugeridasDoExtrato(movimentos) {
    const agora = new Date().toISOString();
    const novos = [];
    for (const m of movimentos || []) {
      // o mesmo caminho do botão da linha — o estorno com o original achado
      // vai como estorno; o que entra numa obra fica para lançar um a um
      const r = rapidoDoExtrato(m);
      if (!r.lancamento || r.lancamento.naObra || r.lancamento.ligarObra || r.lancamento.recebimentoExtras) continue;
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

  // Confirmar um par em dúvida: liga o lançamento à linha do banco e marca
  // conferido. Com a ligação gravada, o próximo casamento já sabe.
  async function confirmarParDoExtrato(m, l) {
    if (!m || !l) return;
    // a linha do banco é a prova de que passou pela conta: o "não" da
    // planilha antiga (parcela a vencer) deixa de valer
    const novo = { ...l, conferido: true, conferidoEm: new Date().toISOString(), conferidoPor: "extrato",
      extratoId: m.id || l.extratoId || "", historicoBanco: m.historico || l.historicoBanco || "",
      ...(l.contaBanco === "nao" ? { contaBanco: "sim" } : {}) };
    setOcupado("Confirmando…");
    try {
      await api.lancamentos.batch([novo]);
      setOcupado("");
      if (onReload) await onReload();
    } catch (e) {
      setOcupado("");
      setAviso("Não consegui confirmar: " + ((e && e.message) || "falha no envio"));
    }
  }

  async function fecharMes(mes, saldoBanco) {
    const certosDoMes = mes === mesEmConferencia && conciliacao ? conferidosPeloExtrato(conciliacao) : [];
    const conf = conferenciaDoMes(lancs, mes, { certos: new Set(certosDoMes.map((l) => l.id)) });
    if (conf.pendentes) {
      const seguir = await dialogo.confirmar({
        titulo: `Fechar ${efMesPorExtenso(mes)} com ${conf.pendentes} sem conferir?`,
        mensagem: `O saldo bate com o banco, mas ${efDinheiro(conf.valorPendente)} ainda não foi marcado como conferido. Depois de fechado, o mês não aceita lançamento novo.`,
        confirmar: "Fechar assim mesmo",
      });
      if (!seguir) return;
    }
    // o que casou sem dúvida vai gravado como conferido, junto com o fecho
    if (certosDoMes.length) {
      setOcupado(`Gravando ${certosDoMes.length} conferidos pelo extrato…`);
      try {
        const lote = 400;
        for (let i = 0; i < certosDoMes.length; i += lote) await api.lancamentos.batch(certosDoMes.slice(i, i + lote));
        setOcupado("");
      } catch (e) {
        setOcupado("");
        setAviso("Não consegui gravar os conferidos: " + ((e && e.message) || "falha no envio") + ". O mês não foi fechado.");
        return;
      }
    }
    await guardarFechamentos({ ...fechamentos, [mes]: { ...(fechamentos[mes] || {}), saldoBanco: Number(saldoBanco) || 0, fechadoEm: new Date().toISOString() } });
    if (certosDoMes.length && onReload) await onReload();
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
          aoGuardarAplicacao={(mes, v) => guardarFechamentos(comSaldoAplicacao(fechamentos, mes, v)).catch(console.error)}
          aoGuardarBanco={(mes, v) => guardarFechamentos(comSaldoBanco(fechamentos, mes, v)).catch(console.error)}
          aoLancarRendimento={lancarRendimento}
          extrato={{
            arrastando: arrastandoExtrato, setArrastando: setArrastandoExtrato,
            origem: origemExtrato, entrada: entradaExtrato, receber: receberExtrato,
            mapa: mapaExtrato, corrigir: corrigirColuna, resultado: conciliacao,
            lancar: lancarDoExtrato, marcarCasados: marcarCasadosDoExtrato, confirmarPar: confirmarParDoExtrato, descartar: marcarForaDoBanco, excluir: perm.podeExcluir ? excluirLancamento : null,
            guardado: !arquivoServe && guardadoDoMes ? guardadoDoMes : null,
            saldoLido: saldoLidoDoExtrato,
            checagem: movimentosExtrato ? checagemDebitoCredito(movimentosExtrato, lancs, mesEmConferencia) : null,
            fila: {
              mes: mesEmConferencia,
              inicial: (m) => lancamentoDaLinhaDoExtrato(m, mesEmConferencia, sugestaoCompletaDoExtrato(m, lancs, ctxDoPalpite)),
              sugestao: (m) => sugestaoCompletaDoExtrato(m, lancs, ctxDoPalpite),
              lancar: lancarLinhaDoExtrato,
              rapido: rapidoDoExtrato,
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
                aoCriarCliente: criarClienteDoLancamento,
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
              <ExtratoEscritorioQuadro linhas={linhas} ano={anoAtual} aoTrocarAno={setAno} fechamentos={fechamentos} />
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
            aoCriarCliente={criarClienteDoLancamento}
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
