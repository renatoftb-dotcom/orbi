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
  for (const l of lancamentos || []) {
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
  const doMes = (lancamentos || []).filter((l) => l && String(l.competencia) === String(mes));
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
function FormLancamentoEscritorio({ inicial, aoSalvar, aoCancelar, fechamentos }) {
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
    clienteId: f.cliente, obraId: f.projeto, empreendimentoId: f.projeto }, { fechamentos });

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


// ── Painel do financeiro ────────────────────────────────────────
// A tela de entrada: filtro em cima, os números do recorte no meio e o
// caminho para lançar, ver o extrato e fechar o mês.
function EFSeletor({ rotulo, valor, aoTrocar, opcoes }) {
  return (
    <label style={{ display: "grid", gap: 3 }}>
      <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .5, color: "#6b7280" }}>{rotulo}</span>
      <select value={valor} onChange={(e) => aoTrocar(e.target.value)}
        style={{ ...EF_ESTILO.input, padding: "7px 10px", minWidth: 130, cursor: "pointer" }}>
        {opcoes.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
      </select>
    </label>
  );
}

function PainelFinanceiroEscritorio({ lancs, linhas, fechamentos, filtro, aoFiltrar, aoIr }) {
  const S = EF_ESTILO;
  const anos = [...new Set((linhas || []).map((l) => l.mes.slice(0, 4)))].sort();
  const doFiltro = filtrarLancamentosEscritorio(lancs, filtro);
  const r = resumoDoPeriodoEscritorio(doFiltro);
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
          <button style={S.btnSec} onClick={() => aoIr("lancamentos")}>Lançamento</button>
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

// ── Fechamento do mês ───────────────────────────────────────────
// Conferência item a item contra o extrato do banco. Enquanto a diferença
// não zera, o mês não fecha; depois de fechado, não entra lançamento nele.
function FechamentoEscritorioTela({ lancs, linhas, fechamentos, mes, aoTrocarMes, aoMarcar, aoMarcarTodos, aoFechar, aoReabrir, ocupado }) {
  const S = EF_ESTILO;
  // A conferência é feita ao longo do mês, com o extrato parcial: por isso
  // a tela abre mostrando só o que ainda falta bater.
  const [soPendentes, setSoPendentes] = useState(true);
  const meses = (linhas || []).map((l) => l.mes);
  const linha = (linhas || []).find((l) => l.mes === mes);
  const conf = conferenciaDoMes(lancs, mes);
  const registro = (fechamentos || {})[mes] || {};
  const fechado = mesEstaFechado(mes, fechamentos);
  const [banco, setBanco] = useState(registro.saldoBanco == null ? "" : String(registro.saldoBanco).replace(".", ","));
  useEffect(() => {
    const reg = (fechamentos || {})[mes] || {};
    setBanco(reg.saldoBanco == null ? "" : String(reg.saldoBanco).replace(".", ","));
  }, [mes, fechamentos]);
  const saldoBanco = efNumero(banco);
  const calculado = linha ? linha.saldoExtrato : 0;
  const diferenca = diferencaDeFechamento(calculado, saldoBanco == null ? "" : saldoBanco);
  const podeFechar = !fechado && diferenca === 0 && !ocupado;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ ...S.card, display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
        <EFSeletor rotulo="Mês" valor={mes} aoTrocar={aoTrocarMes}
          opcoes={meses.map((m) => [m, efMesPorExtenso(m) + (mesEstaFechado(m, fechamentos) ? " ✓" : "")])} />
        <div style={{ display: "grid", gap: 3 }}>
          <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .5, color: "#6b7280" }}>Saldo do banco</span>
          <input style={{ ...S.input, maxWidth: 160 }} inputMode="decimal" value={banco} placeholder="0,00"
            disabled={fechado} onChange={(e) => setBanco(e.target.value)} />
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
                    <td style={{ padding: "6px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{efDinheiro(l.valor)}</td>
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

function FinanceiroEscritorio({ data, save, onReload, vista, aoIrPara }) {
  const S = EF_ESTILO;
  const perm = typeof getPermissoes === "function" ? getPermissoes() : { podeEditar: true, podeExcluir: true };
  // `vista` vem do menu lateral: cada item abre direto a sua tela e o
  // cabeçalho de abas some. Sem ela (Escritório aberto pelo caminho antigo),
  // as abas continuam aparecendo.
  const [aba, setAba] = useState(["resumo", "fechamento"].includes(vista) ? "extrato" : (vista || "extrato"));
  useEffect(() => { if (vista && !["resumo", "fechamento"].includes(vista)) setAba(vista); }, [vista]);
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
      {!vista && (
        <div style={S.abas}>
          {[["extrato", "Extrato"], ["lancamentos", `Lançamentos (${lancs.length})`], ["importar", "Importar"]].map(([k, r]) => (
            <button key={k} style={S.aba(aba === k)} onClick={() => setAba(k)}>{r}</button>
          ))}
        </div>
      )}

      {vista === "resumo" && (
        <PainelFinanceiroEscritorio
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
          aoFechar={fecharMes} aoReabrir={reabrirMes} ocupado={ocupado} />
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

      {!["resumo", "fechamento"].includes(vista) && aba === "lancamentos" && (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input style={{ ...S.input, maxWidth: 320 }} value={busca} placeholder="Buscar por descrição, fornecedor, cliente…"
              onChange={(e) => setBusca(e.target.value)} />
            {perm.podeEditar && !form && (
              <button style={S.btn} onClick={() => setForm({})}>+ Novo lançamento</button>
            )}
          </div>
          {form && <FormLancamentoEscritorio fechamentos={fechamentos} inicial={form} aoSalvar={salvarLancamento} aoCancelar={() => setForm(null)} />}
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
