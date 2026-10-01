// ═══════════════════════════════════════════════════════════════
// INSUMOS — catálogo central, chave única e gestão de preço
// ═══════════════════════════════════════════════════════════════
// Spec: docs/SPEC-INSUMOS.md (absorve docs/PRECOS-REFERENCIA.md).
//
// É a peça que liga estimativa e realizado:
//
//   ESTIMATIVA (orcamento-obra.jsx)  ──lê preço──►  INSUMOS  ◄──atualiza preço──  COMPRAS (lançamentos)
//                                                      │
//                                       chave: insumo.codigo (imutável)
//
// Reaproveita a tabela `materiais` (data.materiais, JSONB). `id` continua sendo
// a chave de banco; `codigo` é a chave de negócio — estável, legível, NUNCA
// alterada nem reciclada depois de gravada.
//
// Este módulo NÃO altera orcamento-obra.jsx nem o importador de NF de
// outros.jsx — essa fiação é a entrega seguinte (§11 passos 3 e 7 da spec).
// Aqui ficam o catálogo, o resolvedor e a tela de gestão.
// ═══════════════════════════════════════════════════════════════

// ── Prefixo de código por grupo. Grupo novo = prefixo novo aqui. ──
var INSUMO_GRUPOS = [
  { prefixo: "ACO", nome: "Aço" },
  { prefixo: "AGR", nome: "Areia e pedra" },
  { prefixo: "ARG", nome: "Argamassas" },
  { prefixo: "CAL", nome: "Calhas e rufos" },
  { prefixo: "CIM", nome: "Cimento" },
  { prefixo: "CON", nome: "Concreto" },
  { prefixo: "CXA", nome: "Madeira de caixaria" },
  { prefixo: "ELE", nome: "Elétrica e iluminação" },
  { prefixo: "FER", nome: "Ferramentas" },
  { prefixo: "FIX", nome: "Fixação" },
  { prefixo: "HID", nome: "Hidráulica" },
  { prefixo: "IMP", nome: "Impermeabilizantes" },
  { prefixo: "LAJ", nome: "Lajes" },
  { prefixo: "LOC", nome: "Locação de equipamentos" },
  { prefixo: "MAD", nome: "Madeira de estrutura" },
  { prefixo: "PRE", nome: "Prestadores de serviços" },
  { prefixo: "REV", nome: "Pisos e revestimentos" },
  { prefixo: "TIJ", nome: "Tijolos e canaletas" },
  { prefixo: "TIN", nome: "Tintas" },
  { prefixo: "TLH", nome: "Telhas" },
  { prefixo: "ESQ", nome: "Esquadrias" },
  { prefixo: "LOU", nome: "Louças e metais" },
  { prefixo: "POR", nome: "Portas e fechaduras" },
  { prefixo: "FOR", nome: "Forros e gesso" },
  { prefixo: "EQP", nome: "Equipamentos e sistemas" },
  { prefixo: "OUT", nome: "Outros" },
];

var INSUMO_UNIDADES = [
  "Unidades", "m2", "m3", "Mts", "Kg", "Baldes 18L",
  "Barras 12mts", "Barras 3mts", "Rolos", "Dias",
];

// INCC acumulado anual (FGV). 2026 = janeiro a agosto.
// Atualizar uma vez por ano; não vale automatizar coleta.
var INCC_ANUAL = { 2022: 0.0941, 2023: 0.0334, 2024: 0.0633, 2025: 0.0609, 2026: 0.0559 };
var INCC_MESES_ANO_CORRENTE = 8; // meses já fechados de 2026 dentro de INCC_ANUAL[2026]

// Fora dessa faixa a compra não vira preço sozinha (guarda contra digitação).
var INSUMO_FATOR_SUSPEITO = 3;

// ═══════════════════════════════════════════════════════════════
// NORMALIZAÇÃO E RESOLUÇÃO
// ═══════════════════════════════════════════════════════════════

// Sem acento, minúsculo, pontuação virando espaço, espaços colapsados.
function normalizarTexto(s) {
  return String(s == null ? "" : s)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Levenshtein simples sobre strings já normalizadas.
function distanciaTexto(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  var linha = [];
  for (var j = 0; j <= b.length; j++) linha[j] = j;
  for (var i = 1; i <= a.length; i++) {
    var ant = linha[0];
    linha[0] = i;
    for (var k = 1; k <= b.length; k++) {
      var tmp = linha[k];
      linha[k] = Math.min(
        linha[k] + 1,
        linha[k - 1] + 1,
        ant + (a[i - 1] === b[k - 1] ? 0 : 1)
      );
      ant = tmp;
    }
  }
  return linha[b.length];
}

// 0..1 — combina similaridade de string com sobreposição de palavras, porque
// "Areia Fina" x "Areia Fina Ensacada" tem distância pequena mas sentido
// diferente, e a sobreposição de tokens ajuda a separar.
function similaridadeTexto(a, b) {
  if (!a || !b) return 0;
  var maxLen = Math.max(a.length, b.length);
  var porDistancia = 1 - distanciaTexto(a, b) / maxLen;
  var ta = a.split(" ").filter(Boolean);
  var tb = b.split(" ").filter(Boolean);
  var comuns = ta.filter(t => tb.indexOf(t) >= 0).length;
  var porToken = comuns / Math.max(ta.length, tb.length);
  return porDistancia * 0.5 + porToken * 0.5;
}

/**
 * Resolve um termo (nome vindo de nota fiscal, do motor de orçamento, do que
 * for) para um insumo do catálogo.
 *
 * Cascata determinística. NUNCA vincula por similaridade — abaixo de
 * "normalizado" devolve candidatos e quem decide é uma pessoa.
 *
 * @returns {{ insumo, confianca:"codigo"|"alias"|"normalizado"|"sugestao"|"nenhum", candidatos:Array }}
 */
function resolverInsumo(termo, insumos, opts) {
  var lista = insumos || [];
  var codigo = opts && opts.codigo;

  if (codigo) {
    var porCodigo = lista.find(x => x.codigo === codigo);
    if (porCodigo) return { insumo: porCodigo, confianca: "codigo", candidatos: [] };
  }

  var n = normalizarTexto(termo);
  if (!n) return { insumo: null, confianca: "nenhum", candidatos: [] };

  for (var i = 0; i < lista.length; i++) {
    var ins = lista[i];
    var aliases = ins.aliases || [];
    for (var j = 0; j < aliases.length; j++) {
      if (normalizarTexto(aliases[j]) === n) {
        return { insumo: ins, confianca: "alias", candidatos: [] };
      }
    }
  }

  var porNome = lista.find(x => normalizarTexto(x.nome) === n);
  if (porNome) return { insumo: porNome, confianca: "normalizado", candidatos: [] };

  var ranking = lista
    .map(x => ({ insumo: x, score: similaridadeTexto(n, normalizarTexto(x.nome)) }))
    .filter(r => r.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    insumo: null,
    confianca: ranking.length ? "sugestao" : "nenhum",
    candidatos: ranking,
  };
}

// ══════════════════════════════════════════════════════════════
// UNIDADE — o vocabulário mora aqui, perto do catálogo
// ══════════════════════════════════════════════════════════════
// A nota da loja escreve "un", "UN", "und", "pç" para a mesma coisa que o
// catálogo chama de "Unidades". Quem precisa saber disso é a Entrada do
// pedido (para não criar duas unidades iguais) e o preço de referência (para
// não comparar preço de metro com preço de rolo). Fica aqui, uma vez, e a
// Entrada usa daqui — a mesma lição da descrição que estava escrita em três
// lugares e errada em dois.
var UNIDADE_SINONIMOS = {
  un: "Unidades", uns: "Unidades", und: "Unidades", unds: "Unidades",
  unid: "Unidades", unids: "Unidades", unidade: "Unidades", unidades: "Unidades",
  pc: "Unidades", pcs: "Unidades", pca: "Unidades", peca: "Unidades", pecas: "Unidades",
  jg: "Unidades", jogo: "Unidades", jogos: "Unidades",
  cj: "Unidades", conj: "Unidades", conjunto: "Unidades", conjuntos: "Unidades",
  par: "Unidades", pares: "Unidades",
  kg: "Kg", kgs: "Kg", quilo: "Kg", quilos: "Kg", kilo: "Kg", kilos: "Kg",
  m2: "m2", "m\u00b2": "m2",
  m3: "m3", "m\u00b3": "m3",
  m: "Mts", mt: "Mts", mts: "Mts", ml: "Mts", metro: "Mts", metros: "Mts",
  l: "Lts", lt: "Lts", lts: "Lts", litro: "Lts", litros: "Lts",
  rl: "Rolos", rolo: "Rolos", rolos: "Rolos",
  dia: "Dias", dias: "Dias",
  mes: "Meses", meses: "Meses",
};

// A chave de comparação: sem acento, sem ponto, minúscula.
function chaveUnidade(texto) {
  return String(texto == null ? "" : texto)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[.\s]/g, "").trim();
}

// A unidade reduzida ao nome canônico, para comparar "un" com "Unidades".
function unidadeCanonica(texto) {
  var k = chaveUnidade(texto);
  if (!k) return "";
  return UNIDADE_SINONIMOS[k] || k;
}

// Duas unidades são a mesma coisa? Unidade em branco de um dos lados é
// `null` — "não sei", que é diferente de "não é". Quem chama decide o que
// fazer com a dúvida; aqui não se chuta.
function mesmaUnidade(a, b) {
  var ca = unidadeCanonica(a), cb = unidadeCanonica(b);
  if (!ca || !cb) return null;
  return ca === cb;
}

// ═══════════════════════════════════════════════════════════════
// CÓDIGO
// ═══════════════════════════════════════════════════════════════

function prefixoDoGrupo(grupo) {
  var g = INSUMO_GRUPOS.find(x => normalizarTexto(x.nome) === normalizarTexto(grupo));
  return g ? g.prefixo : "OUT";
}

// Sequencial a partir do MAIOR já usado no prefixo — inclui inativos, porque
// código de insumo inativado nunca é reciclado.
// Os códigos da semente (INSUMOS_SEED) são reservados: um material legado
// nunca recebe um código que a semente vai reivindicar depois — senão a
// semeadura casaria por código com o item errado.
function proximoCodigoInsumo(grupo, insumos) {
  var pre = prefixoDoGrupo(grupo);
  var maior = 0;
  var considerar = function (i) {
    if (!i || !i.codigo) return;
    var m = /^([A-Z]{3})-(\d{3,})$/.exec(i.codigo);
    if (m && m[1] === pre) maior = Math.max(maior, parseInt(m[2], 10));
  };
  (insumos || []).forEach(considerar);
  if (typeof INSUMOS_SEED !== "undefined") INSUMOS_SEED.forEach(considerar);
  var n = String(maior + 1);
  while (n.length < 3) n = "0" + n;
  return pre + "-" + n;
}

// Grupo inferido do nome, usado só na migração de materiais legados.
function grupoInferido(nome) {
  var n = normalizarTexto(nome);
  var regras = [
    [/^aco (barras|trelica|malha)/, "Aço"],
    [/^aco (prego|arame)|parafuso/, "Fixação"],
    [/^areia|^pedra$|pedrisco/, "Areia e pedra"],
    [/cimento/, "Cimento"],
    [/^argamassa|^rejunte/, "Argamassas"],
    [/tijolo|bloco|canaleta/, "Tijolos e canaletas"],
    [/^concreto/, "Concreto"],
    [/^cumeeira|^telha |^telhado telha|^telhado metalica/, "Telhas"],
    [/^telhado estrutura|caibro|ripa|viga 5x/, "Madeira de estrutura"],
    [/^telhado (calha|rufo|pingadeira)|^calha/, "Calhas e rufos"],
    [/madeira caixaria|madeirite|sarrafo|tabua/, "Madeira de caixaria"],
    [/impermeabiliz|^manta|vedalit|vedatop/, "Impermeabilizantes"],
    [/^tintas|tinta |selador|massa corrida/, "Tintas"],
    [/^laje/, "Lajes"],
    [/^locacao|^maquinario|andaime|escora/, "Locação de equipamentos"],
    [/^ferramentas|^disco/, "Ferramentas"],
    [/^eletrica|cabo |disjuntor|luminaria/, "Elétrica e iluminação"],
    [/^metal hidraulica|^pvc|^agua$|torneira|registro/, "Hidráulica"],
    [/^revestimento|^pisos e revestimentos|porcelanato/, "Pisos e revestimentos"],
    [/^prestadores|pedreiro|pintor|eletricista|encanador|serralheiro/, "Prestadores de serviços"],
  ];
  for (var i = 0; i < regras.length; i++) if (regras[i][0].test(n)) return regras[i][1];
  return "Outros";
}

// ═══════════════════════════════════════════════════════════════
// PREÇO
// ═══════════════════════════════════════════════════════════════

function mesesEntre(dataIso, ate) {
  if (!dataIso) return Infinity;
  var d = new Date(dataIso + (String(dataIso).length === 10 ? "T00:00:00" : ""));
  if (isNaN(d.getTime())) return Infinity;
  var fim = ate ? new Date(ate) : new Date();
  return (fim.getFullYear() - d.getFullYear()) * 12 + (fim.getMonth() - d.getMonth());
}

// Índice INCC sintético mês a mês, montado do acumulado anual.
function indiceIncc(ano, mes) {
  var base = 100;
  var anos = Object.keys(INCC_ANUAL).map(Number).sort((a, b) => a - b);
  for (var i = 0; i < anos.length; i++) {
    var a = anos[i];
    var mesesDoAno = (i === anos.length - 1) ? INCC_MESES_ANO_CORRENTE : 12;
    var taxaMes = Math.pow(1 + INCC_ANUAL[a], 1 / mesesDoAno) - 1;
    for (var m = 1; m <= 12; m++) {
      if (a === ano && m === mes) return base;
      if (m <= mesesDoAno) base *= (1 + taxaMes);
    }
  }
  return base;
}

function fatorIncc(dataIso, ate) {
  if (!dataIso) return 1;
  var d = new Date(dataIso + (String(dataIso).length === 10 ? "T00:00:00" : ""));
  if (isNaN(d.getTime())) return 1;
  var fim = ate ? new Date(ate) : new Date();
  var de = indiceIncc(Math.max(d.getFullYear(), 2022), d.getMonth() + 1);
  var para = indiceIncc(fim.getFullYear(), fim.getMonth() + 1);
  if (!de || !para) return 1;
  return Math.round((para / de) * 10000) / 10000;
}

/**
 * Preço efetivo de um insumo, com envelhecimento aplicado.
 * Ponto ÚNICO de resolução de preço — nada mais no app pode ter preço fixo.
 */
function precoInsumo(insumo, ate) {
  if (!insumo) return { preco: null, confianca: "sem_preco", meses: null, corrigido: false };
  if (insumo.precoManual != null) {
    return { preco: insumo.precoManual, confianca: "manual", meses: null, corrigido: false };
  }
  if (insumo.precoReferencia == null) {
    // Material do cadastro antigo, ainda não migrado: só tem ultimoPreco.
    // Vale como referência (sem data → confiança baixa) até a semeadura
    // preencher os campos novos.
    if (insumo.ultimoPreco != null && Number(insumo.ultimoPreco) > 0) {
      return { preco: Math.round(Number(insumo.ultimoPreco) * 100) / 100, confianca: "baixa", meses: null, corrigido: false, legado: true };
    }
    return { preco: null, confianca: "sem_preco", meses: null, corrigido: false };
  }
  var meses = mesesEntre(insumo.precoData, ate);
  var corrigido = meses >= 12 && isFinite(meses);
  // precoReferencia pode já vir corrigido (semente: "compra_corrigida" guarda
  // o valor corrigido e o fator usado). Corrige só o que falta desde então,
  // nunca duas vezes.
  var jaAplicado = Number(insumo.precoFatorInccAplicado || 1) || 1;
  var fator = corrigido ? fatorIncc(insumo.precoData, ate) / jaAplicado : 1;
  if (corrigido && fator < 1) fator = 1;
  var preco = Math.round(insumo.precoReferencia * fator * 100) / 100;

  var confianca;
  if (!isFinite(meses)) confianca = "baixa";
  else if (meses < 6 && (insumo.precoNCompras || 0) >= 3) confianca = "alta";
  else if (meses < 12) confianca = "media";
  else if (meses < 24) confianca = "baixa";
  else confianca = "obsoleta";

  return { preco: preco, confianca: confianca, meses: meses, corrigido: corrigido, fator: fator };
}

// ── As compras de um insumo ────────────────────────────
// Elas vivem em dois lugares. Os lançamentos do escritório — o que a Padovan
// compra para si — e as contas a pagar das obras, que é onde o material é de
// fato comprado. A ficha do insumo lia só o primeiro: você lançava a nota da
// loja, o código do insumo era gravado certinho em cada item, e a ficha
// continuava dizendo que aquele material nunca tinha sido comprado.
//
// O valor usado é o que de fato saiu: com o pedido baixado vale o valorPago,
// que já vem rateado com o desconto da loja; em aberto, vale o valor da
// conta. A data é a da baixa quando existe, e o vencimento enquanto não há.
function comprasDoInsumo(insumo, data) {
  if (!insumo || !insumo.codigo) return [];
  var cod = insumo.codigo;
  var out = [];
  var juntar = function (c) {
    var qtd = Number(c.qtd) || 0;
    var total = Number(c.total) || 0;
    if (!(qtd > 0) || !(total > 0) || !c.data) return;
    c.qtd = qtd; c.total = total;
    c.unitario = Math.round((total / qtd) * 10000) / 10000;
    out.push(c);
  };
  ((data && data.lancamentos) || []).forEach(function (l) {
    if (!l || l.insumoCodigo !== cod) return;
    juntar({ origem: "escritorio", id: l.id || "",
      data: l.dataPagamento || l.data || "",
      qtd: Number(l.quantidade) || 0,
      total: Number(l.total != null ? l.total : l.valor) || 0,
      unidade: l.unidade || "",
      fornecedorId: l.fornecedorId || "", pago: true });
  });
  ((data && data.obras) || []).forEach(function (o) {
    ((o && o.contasPagar) || []).forEach(function (c) {
      if (!c || c.insumoCodigo !== cod) return;
      juntar({ origem: "obra", id: c.id || "", obraId: o.id || "", obraNome: o.nome || "",
        data: c.pagoEm || c.vencimento || "",
        qtd: Number(c.quantidade) || 0,
        total: Number(c.pago ? (c.valorPago || c.valor) : c.valor) || 0,
        unidade: c.unidade || "",
        fornecedorId: c.prestadorId || "", favorecido: c.favorecido || "",
        pago: !!c.pago });
    });
  });
  return out.sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); });
}


// A unidade a que o preço de referência se refere. O catálogo tem a unidade
// do insumo, mas é a do ÚLTIMO preço que importa comparar — senão trocar a
// unidade do cadastro faria todas as compras antigas parecerem divergentes.
function unidadeDoPreco(insumo) {
  var i = insumo || {};
  return i.precoUnidade || i.unidade || "";
}

/**
 * Atualiza o preço de referência a partir de um lançamento de compra.
 * Pura: recebe insumo + lançamento, devolve insumo novo (ou o mesmo).
 *
 * Duas guardas, e as duas param no mesmo lugar — a fila de pendência:
 *
 * 1. UNIDADE. "Linha de pedreiro" no catálogo é o rolo de 100 m; a loja cobra
 *    por metro. Cano é vendido em barra de 6 m, e tem loja que cota o metro. Se
 *    a unidade da compra não é a unidade do preço, o número não é comparável
 *    — e sobrescrever seria trocar R$ 48,00 o rolo por R$ 0,48 o metro, sem
 *    ninguém ver. Converter sozinho seria pior: o fator está no nome do
 *    produto ("rolo 100 m"), que a loja escreve como quer. Então para e
 *    pergunta.
 * 2. SALTO. Mesma unidade, preço três vezes maior ou menor: erro de digitação,
 *    ou compra de outra coisa com o código errado.
 *
 * Unidade em branco de um dos lados não é divergência — é dúvida. A compra
 * passa (o salto ainda a vigia), mas o preço fica marcado como não conferido,
 * para a ficha poder dizer isso.
 */
function atualizarPrecoReferencia(insumo, lancamento) {
  if (!insumo || !lancamento) return insumo;
  if (insumo.precoManual != null) return insumo;
  if (lancamento.tipo && lancamento.tipo !== "custo") return insumo;

  var qtd = Number(lancamento.quantidade);
  var total = Number(lancamento.total != null ? lancamento.total : lancamento.valor);
  if (!(qtd > 0) || !(total > 0)) return insumo;

  var unitario = Math.round((total / qtd) * 100) / 100;
  var data = lancamento.dataPagamento || lancamento.data || null;
  var uniCompra = lancamento.unidade || "";
  var uniPreco = unidadeDoPreco(insumo);
  var confere = mesmaUnidade(uniCompra, uniPreco);

  var pendencia = function (motivo) {
    return Object.assign({}, insumo, {
      precoPendente: {
        valor: unitario, data: data, lancamentoId: lancamento.id || null,
        motivo: motivo, unidade: uniCompra, unidadePreco: uniPreco,
      },
    });
  };

  // Guarda 1: unidade diferente. Vale mesmo sem preço anterior — nascer com o
  // preço do metro num catálogo que cobra o rolo é o mesmo estrago.
  if (confere === false) return pendencia("unidade");

  // Guarda 2: salto suspeito.
  var ref = insumo.precoReferencia;
  if (ref > 0) {
    var razao = unitario / ref;
    if (razao > INSUMO_FATOR_SUSPEITO || razao < 1 / INSUMO_FATOR_SUSPEITO) return pendencia("salto");
  }

  // Nota retroativa não rebaixa preço mais novo.
  if (insumo.precoData && data && data < insumo.precoData) return insumo;

  return Object.assign({}, insumo, {
    precoReferencia: unitario,
    ultimoPreco: unitario, // campo legado — o importador de NF ainda lê
    precoFonte: "compra",
    precoData: data,
    // A unidade viaja com o preço: é ela que a próxima compra vai conferir.
    precoUnidade: uniCompra || uniPreco || "",
    precoUnidadeConferida: confere === true,
    precoNCompras: (insumo.precoNCompras || 0) + 1,
    precoFatorInccAplicado: 1,
    precoPendente: null,
    precoAtualizadoEm: new Date().toISOString(),
  });
}

// ── Da baixa da conta para o preço do catálogo ────────────
// O catálogo só aprende quando o dinheiro sai: é na baixa que se conhece o
// valor realmente pago (com desconto rateado) e a data que conta. Esta função
// recebe as contas que ACABARAM de ser pagas e devolve o catálogo novo mais o
// relatório do que fez — porque o que ela recusou é mais importante do que o
// que ela aceitou, e alguém tem que poder contar isso na tela.
//
// Pura: nada de save, nada de alert. Quem chama grava e avisa.
function aplicarComprasNoCatalogo(materiais, contas) {
  var lista = (materiais || []).slice();
  var relato = { aplicados: [], pendencias: [], semCodigo: 0 };
  if (!lista.length) return { materiais: materiais || [], relato: relato };

  var porCodigo = {};
  for (var k = 0; k < lista.length; k++) {
    if (lista[k] && lista[k].codigo) porCodigo[lista[k].codigo] = k;
  }

  // Mais de uma conta do mesmo insumo na mesma baixa: a mais nova manda, mas
  // todas passam pela guarda, na ordem em que foram pagas.
  var ordenadas = (contas || []).slice().sort(function (a, b) {
    return String((a && (a.pagoEm || a.vencimento)) || "")
      .localeCompare(String((b && (b.pagoEm || b.vencimento)) || ""));
  });

  ordenadas.forEach(function (c) {
    if (!c) return;
    var cod = c.insumoCodigo || "";
    if (!cod) { relato.semCodigo++; return; }
    var pos = porCodigo[cod];
    if (pos == null) { relato.semCodigo++; return; }

    var antes = lista[pos];
    var qtd = Number(c.quantidade) || 0;
    var total = Number(c.valorPago != null && c.valorPago !== "" ? c.valorPago : c.valor) || 0;
    if (!(qtd > 0) || !(total > 0)) return;

    var depois = atualizarPrecoReferencia(antes, {
      tipo: "custo", quantidade: qtd, total: total,
      data: c.pagoEm || c.vencimento || "", unidade: c.unidade || "", id: c.id || "",
    });
    if (depois === antes) return;
    lista[pos] = depois;

    var novaPendencia = depois.precoPendente
      && (!antes.precoPendente || antes.precoPendente.lancamentoId !== depois.precoPendente.lancamentoId);
    if (novaPendencia) {
      relato.pendencias.push({
        codigo: cod, nome: antes.nome || cod, contaId: c.id || "",
        descricao: c.descricao || "", motivo: depois.precoPendente.motivo || "salto",
        unidadeCompra: depois.precoPendente.unidade || "",
        unidadePreco: depois.precoPendente.unidadePreco || "",
        precoAntes: antes.precoReferencia != null ? antes.precoReferencia : null,
        precoDaCompra: depois.precoPendente.valor,
      });
    } else if (depois.precoReferencia !== antes.precoReferencia
            || depois.precoData !== antes.precoData) {
      relato.aplicados.push({
        codigo: cod, nome: antes.nome || cod, contaId: c.id || "",
        precoAntes: antes.precoReferencia != null ? antes.precoReferencia : null,
        precoDepois: depois.precoReferencia,
        unidade: depois.precoUnidade || "",
        conferida: !!depois.precoUnidadeConferida,
      });
    }
  });

  if (!relato.aplicados.length && !relato.pendencias.length) {
    return { materiais: materiais || [], relato: relato };
  }
  return { materiais: lista, relato: relato };
}

// As contas que acabaram de virar pagas entre dois retratos da mesma lista. É
// este diff que liga a baixa ao resto do sistema sem precisar lembrar de
// chamar nada em cada botão de pagar — e sem reaplicar o que já estava pago.
//
// NÃO exige insumo casado: isto responde "o que acabou de ser pago", e quem
// usa decide o que fazer. O preço do catálogo ignora conta sem código (não
// há insumo para atualizar); o extrato do escritório, não — dinheiro que sai
// da conta sai com ou sem catálogo, e filtrar aqui fazia a nota de um
// material fora do catálogo nunca chegar ao financeiro.
function contasRecemPagas(antes, depois) {
  var eraPaga = {};
  (antes || []).forEach(function (c) { if (c && c.id) eraPaga[c.id] = !!c.pago; });
  return (depois || []).filter(function (c) {
    return c && c.pago && !eraPaga[c.id];
  });
}

// ── O que as compras fariam com o preço do catálogo ────────
// Antes de deixar as notas reescreverem o catálogo, é preciso ver o estrago:
// quais insumos mudariam de preço, de quanto para quanto, e quais cairiam na
// fila de pendência por salto suspeito. Esta função não grava nada — ela
// SIMULA, aplicando as compras na ordem em que aconteceram, pela mesma
// `atualizarPrecoReferencia` que valeria de verdade. Preview e ação usando o
// mesmo motor é o que impede os dois de divergirem.
function previaDePrecosPorCompra(insumos, data) {
  var linhas = [];
  var resumo = { comCompras: 0, atualiza: 0, pendente: 0, semMudanca: 0, manual: 0, compras: 0,
                 porUnidade: 0, porSalto: 0 };
  (insumos || []).forEach(function (i) {
    if (!i || i.ativo === false) return;
    var compras = comprasDoInsumo(i, data);
    if (!compras.length) return;
    resumo.comCompras++;
    resumo.compras += compras.length;

    if (i.precoManual != null) {
      resumo.manual++;
      linhas.push({ insumo: i, compras: compras.length, situacao: "manual",
        precoAntes: i.precoManual, precoDepois: i.precoManual, variacao: 0 });
      return;
    }

    // Aplica uma a uma, como a vida aplicaria.
    var atual = i;
    compras.forEach(function (c) {
      atual = atualizarPrecoReferencia(atual, {
        tipo: "custo", quantidade: c.qtd, total: c.total, data: c.data, id: c.id,
        unidade: c.unidade || "",
      });
    });

    var antes = i.precoReferencia != null ? i.precoReferencia : null;
    var depois = atual.precoReferencia != null ? atual.precoReferencia : null;
    var virouPendente = !!atual.precoPendente && !i.precoPendente;
    var situacao = virouPendente ? "pendente"
      : (antes !== depois || atual.precoData !== i.precoData) ? "atualiza" : "semMudanca";
    resumo[situacao]++;
    if (virouPendente) resumo[atual.precoPendente.motivo === "unidade" ? "porUnidade" : "porSalto"]++;
    linhas.push({ insumo: i, compras: compras.length, situacao: situacao,
      precoAntes: antes, precoDepois: virouPendente ? atual.precoPendente.valor : depois,
      motivo: virouPendente ? (atual.precoPendente.motivo || "salto") : null,
      unidadeCompra: virouPendente ? (atual.precoPendente.unidade || "") : "",
      unidadePreco: virouPendente ? (atual.precoPendente.unidadePreco || "") : "",
      ultimaCompra: compras[compras.length - 1],
      variacao: (antes > 0 && depois > 0 && !virouPendente)
        ? Math.round((depois / antes - 1) * 1000) / 10 : null });
  });
  // O que mais muda primeiro — é por onde se começa a conferir.
  linhas.sort(function (a, b) {
    var ordem = { pendente: 0, atualiza: 1, semMudanca: 2, manual: 3 };
    if (ordem[a.situacao] !== ordem[b.situacao]) return ordem[a.situacao] - ordem[b.situacao];
    return Math.abs(b.variacao || 0) - Math.abs(a.variacao || 0);
  });
  return { linhas: linhas, resumo: resumo };
}


// ═══════════════════════════════════════════════════════════════
// MIGRAÇÃO E SEMEADURA — ambas idempotentes
// ═══════════════════════════════════════════════════════════════

// Material legado (sem codigo) ganha código, aliases e preço de referência.
function migrarMateriaisParaInsumos(materiais) {
  var lista = (materiais || []).slice();
  var alterados = 0;
  for (var i = 0; i < lista.length; i++) {
    var m = lista[i];
    if (m.codigo) continue;
    var grupo = m.grupo || grupoInferido(m.nome);
    // Se o nome já é um insumo da semente, herda o código dela (o preço e o
    // grupo entram depois, na semeadura). Senão, próximo código livre.
    var daSemente = null;
    if (typeof INSUMOS_SEED !== "undefined") {
      var rs = resolverInsumo(m.nome, INSUMOS_SEED);
      if (rs.insumo && (rs.confianca === "alias" || rs.confianca === "normalizado")
          && !lista.some(function (x) { return x.codigo === rs.insumo.codigo; })) daSemente = rs.insumo;
    }
    if (daSemente) grupo = daSemente.grupo || grupo;
    var novo = Object.assign({}, m, {
      codigo: daSemente ? daSemente.codigo : proximoCodigoInsumo(grupo, lista),
      grupo: grupo,
      tipo: m.tipo || "material",
      ativo: m.ativo !== false,
      aliases: (m.aliases && m.aliases.length) ? m.aliases : [m.nome],
      precoReferencia: m.precoReferencia != null ? m.precoReferencia
                     : (m.ultimoPreco != null ? m.ultimoPreco : null),
      precoFonte: m.precoFonte || (m.ultimoPreco != null ? "compra" : null),
      precoData: m.precoData || null,
      precoNCompras: m.precoNCompras || 0,
      precoFatorInccAplicado: m.precoFatorInccAplicado || 1,
      precoManual: m.precoManual != null ? m.precoManual : null,
      precoPendente: m.precoPendente || null,
    });
    lista[i] = novo;
    alterados++;
  }
  return { materiais: lista, alterados: alterados };
}

// União de nomes sem repetir o mesmo termo normalizado (a base tem grafias que
// só diferem em caixa ou espaço final).
function unirAliases() {
  var vistos = {}, out = [];
  for (var i = 0; i < arguments.length; i++) {
    (arguments[i] || []).forEach(function (a) {
      var k = normalizarTexto(a);
      if (!k || vistos[k]) return;
      vistos[k] = 1; out.push(String(a).trim());
    });
  }
  return out;
}

// Aplica INSUMOS_SEED sobre o catálogo. Nunca sobrescreve precoManual nem um
// preço cuja data seja mais recente que a da semente.
function semearInsumos(materiais, seed) {
  var lista = (materiais || []).slice();
  var criados = 0, atualizados = 0, ignorados = 0;

  var nomesDaSemente = function (s) {
    return [s.nome].concat(s.aliases || []).map(normalizarTexto);
  };
  (seed || INSUMOS_SEED).forEach(function (s) {
    var idx = lista.findIndex(x => x.codigo === s.codigo);
    if (idx >= 0) {
      // Código igual mas nome incompatível = colisão (material legado que
      // recebeu esse código antes da reserva). Recodifica o legado e segue.
      var x = lista[idx];
      var nomesX = [x.nome].concat(x.aliases || []).map(normalizarTexto);
      var ns = nomesDaSemente(s);
      var compativel = nomesX.some(function (n) { return ns.indexOf(n) >= 0; });
      if (!compativel) {
        lista[idx] = Object.assign({}, x, { codigo: proximoCodigoInsumo(x.grupo || grupoInferido(x.nome), lista) });
        idx = -1;
      }
    }
    if (idx < 0) {
      var r = resolverInsumo(s.nome, lista);
      if (r.insumo && (r.confianca === "alias" || r.confianca === "normalizado")) {
        idx = lista.indexOf(r.insumo);
      }
    }

    if (idx < 0) {
      lista.push(Object.assign({
        id: uid(),
        ativo: true,
        precoManual: null,
        precoPendente: null,
        fornecedorPreferido: null,
        precoAtualizadoEm: new Date().toISOString(),
      }, s, { aliases: unirAliases(s.aliases) }));
      criados++;
      return;
    }

    var atual = lista[idx];
    var patch = {};
    if (!atual.codigo) patch.codigo = s.codigo;
    if (!atual.grupo) patch.grupo = s.grupo;
    if (!atual.unidade) patch.unidade = s.unidade;
    if (!atual.tipo) patch.tipo = s.tipo;
    if (s.baseCalculo && !atual.baseCalculo) patch.baseCalculo = s.baseCalculo;
    if (s.observacao && !atual.observacao) patch.observacao = s.observacao;

    var uniao = unirAliases(atual.aliases && atual.aliases.length ? atual.aliases : [atual.nome], s.aliases);
    if (JSON.stringify(uniao) !== JSON.stringify(atual.aliases || [])) patch.aliases = uniao;

    // preço: só se o insumo não tem preço, ou o da semente é mais novo
    var podePreco = atual.precoManual == null
      && (atual.precoReferencia == null
          || (s.precoData && (!atual.precoData || s.precoData > atual.precoData)));
    if (podePreco && s.precoReferencia != null) {
      patch.precoReferencia = s.precoReferencia;
      patch.ultimoPreco = s.precoReferencia;
      patch.precoFonte = s.precoFonte;
      patch.precoData = s.precoData;
      patch.precoNCompras = s.precoNCompras || 0;
      patch.precoFatorInccAplicado = s.precoFatorInccAplicado || 1;
      patch.precoAtualizadoEm = new Date().toISOString();
    }

    if (Object.keys(patch).length) {
      lista[idx] = Object.assign({}, atual, patch);
      atualizados++;
    } else {
      ignorados++;
    }
  });

  return { materiais: lista, criados: criados, atualizados: atualizados, ignorados: ignorados };
}

// ═══════════════════════════════════════════════════════════════
// ── Sugerir a etapa pelo nome do insumo ─────────────────────────
// Marcar duzentos itens à mão é o tipo de trabalho que não se faz — e por
// isso a etapa ficaria vazia para sempre. Mas o nome do catálogo carrega a
// resposta na maioria dos casos: "PVC - Esgoto - Ralo" só serve ao esgoto,
// "Caixa 4x2 pvc embutir" só à elétrica. Então a máquina PROPÕE e você
// confere — ela nunca grava sozinha, e nunca mexe no que já tem etapa.
//
// A ordem importa: a regra mais específica ganha. "PVC - Esgoto - Joelho"
// é esgoto, não água fria, embora joelho também exista na alimentação.
var SUGESTOES_POR_NOME = [
  ["esgoto_pluvial", /\besgoto\b|\bralo\b|\bgrelha\b|caixa sifonada|\bpluvial\b|\bsifao\b|tubo de queda/],
  ["coberturas",     /\btelha\b|telhas|cumeeira|\bcalha\b|\brufo\b|manta termica|manta asfaltica de telhado/],
  ["aquecimento",    /\bboiler\b|aquecedor|pressurizador|bomba circulacao|placa solar|coletor solar/],
  ["eletrica",       /\beletric|conduite|corrugado|kanaflex|tomada|interruptor|disjuntor|cabo flex|caixa 4x2|caixa 4x4|octogonal|\bquadro de distribuicao\b/],
  ["hidraulica",     /agua fria|agua quente|alimentacao|hidraulica|\bregistro\b|\bnipel\b|\bengate\b|caixa d.?agua/],
];

// Quando o nome não diz nada, o grupo ainda diz — mas só para os grupos que
// servem a UMA etapa. Cimento, areia, aço e madeira de caixaria ficam de
// fora de propósito: entram em meia obra, e chutar aqui seria pior que o
// campo em branco.
var SUGESTOES_POR_GRUPO = {
  "Tintas": "pintura",
  "Telhas": "coberturas",
  "Calhas e rufos": "coberturas",
  "Elétrica e iluminação": "eletrica",
  "Hidráulica": "hidraulica",
  "Tubulação PVC": "hidraulica",
  "Pisos e revestimentos": "pisos_revest",
  "Louças e metais": "loucas_metais",
  "Louças": "loucas_metais",
  "Metais": "loucas_metais",
  "Forros e gesso": "forros",
  "Forros": "forros",
  "Esquadrias": "esquadrias",
  "Portas e fechaduras": "portas_internas",
  "Tijolos e canaletas": "supra_paredes_1",
  "Lajes": "laje_1",
  "Trilhos e capas de laje": "laje_1",
  "Impermeabilizantes": "impermeabilizacao",
  "Granito": "soleiras_peitoris",
  "Marcenaria": "marcenaria",
  "Entulhos": "demolicoes",
  // Ferramenta comprada e equipamento alugado têm etapa própria na planilha
  // do escritório, e o grupo serve a ela e a mais nenhuma — não há o que
  // chutar aqui. Sem estas três linhas, toda compra de ferramenta chegava ao
  // pedido com a etapa em branco, mesmo o catálogo sabendo o grupo.
  "Ferramentas": "ferramentas",
  "Locação de equipamentos": "locacao_equip",
  "Prestadores de serviços": "prestadores",
};

function sugerirEtapaDoInsumo(insumo) {
  if (!insumo || insumo.etapaPadrao) return "";
  var nome = normalizarTexto(insumo.nome || "");
  for (var k = 0; k < SUGESTOES_POR_NOME.length; k++) {
    if (SUGESTOES_POR_NOME[k][1].test(nome)) return SUGESTOES_POR_NOME[k][0];
  }
  return SUGESTOES_POR_GRUPO[insumo.grupo] || "";
}

// As propostas agrupadas por etapa, da maior para a menor — é assim que se
// confere: "sessenta itens viraram esgoto, faz sentido?".
function sugestoesDeEtapa(insumos) {
  var por = {};
  (insumos || []).forEach(function (x) {
    if (!x || x.ativo === false) return;
    var etapa = sugerirEtapaDoInsumo(x);
    if (!etapa) return;
    if (!por[etapa]) por[etapa] = { etapaId: etapa, itens: [] };
    por[etapa].itens.push(x);
  });
  var fora = Object.keys(por).map(function (id) {
    var e = (typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : []).find(function (x) { return x.id === id; });
    return { etapaId: id, nome: e ? e.nome : id, itens: por[id].itens, quantos: por[id].itens.length };
  });
  fora.sort(function (a, b) { return b.quantos - a.quantos; });
  var total = fora.reduce(function (s, g) { return s + g.quantos; }, 0);
  var semSugestao = (insumos || []).filter(function (x) {
    return x && x.ativo !== false && !x.etapaPadrao && !sugerirEtapaDoInsumo(x);
  }).length;
  return { grupos: fora, total: total, semSugestao: semSugestao };
}

// ── Etapa padrão em lote ──────────────────────────────
// Um catálogo tem centenas de itens e a etapa de cada um não se descobre
// sozinha — tubo de água fria e tubo de esgoto têm o mesmo grupo e etapas
// diferentes. Então quem sabe é quem compra, e o que a tela deve dar é um
// jeito de dizer isso para cinquenta itens de uma vez, não um por um.
function definirEtapaPadraoEmLote(insumos, chaves, etapaId) {
  var alvo = {};
  (chaves || []).forEach(function (k) { alvo[k] = true; });
  var mudados = 0;
  var lista = (insumos || []).map(function (x) {
    if (!x) return x;
    var chave = x.id || x.codigo;
    if (!chave || !alvo[chave]) return x;
    if ((x.etapaPadrao || "") === (etapaId || "")) return x;
    mudados++;
    return Object.assign({}, x, { etapaPadrao: etapaId || "" });
  });
  return { insumos: lista, mudados: mudados };
}

// UI
// ═══════════════════════════════════════════════════════════════

var INS = {
  fundo: "#fafafb", grafite: "#1a1a1a", cobre: "#0474f4", azul: "#1e3a5f",
  inkSoft: "#78716c", borda: "1.5px solid rgba(38,36,33,0.16)",
};
var INS_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

var INS_S = {
  input: { border: INS.borda, borderRadius: 12, padding: "9px 12px", fontSize: 13, color: "#111827", outline: "none", background: "#fff", fontFamily: "inherit", width: "100%", boxSizing: "border-box" },
  label: { fontSize: 12, color: "#4b5563", fontWeight: 500, display: "block", marginBottom: 5 },
  btn: { background: "#262421", color: "#fff", border: "none", borderRadius: 12, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  btnSec: { background: "#fff", color: "#111827", border: INS.borda, borderRadius: 12, padding: "9px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" },
  btnGhost: { background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontFamily: "inherit", fontSize: 13 },
  card: { border: INS.borda, borderRadius: 16, background: "#fff", padding: 16 },
};

var CONF_INSUMO = {
  alta:      { label: "Atual",     cor: "#10b981" },
  media:     { label: "Recente",   cor: "#84cc16" },
  baixa:     { label: "Antigo",    cor: "#f59e0b" },
  obsoleta:  { label: "Obsoleto",  cor: "#dc2626" },
  manual:    { label: "Manual",    cor: "#1e3a5f" },
  sem_preco: { label: "Sem preço", cor: "#9ca3af" },
};

// Quantidade com vírgula, como o resto: "2,5", nunca "2.5".
function qtdIns(n) {
  const v = Number(n);
  if (!isFinite(v)) return String(n == null ? "" : n);
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtBRLIns(v) {
  if (v == null) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDataIns(d) {
  if (!d) return "—";
  var dt = new Date(String(d).length === 10 ? d + "T00:00:00" : d);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("pt-BR");
}

function PontoConfianca({ conf, tamanho }) {
  var c = CONF_INSUMO[conf] || CONF_INSUMO.sem_preco;
  var t = tamanho || 8;
  return <span title={c.label} style={{ display: "inline-block", width: t, height: t, borderRadius: "50%", background: c.cor, flexShrink: 0 }} />;
}

// ── Formulário ───────────────────────────────────────────────
function InsumoForm({ insumo, insumos, onSalvar, onCancelar, isMobile }) {
  var ehNovo = !insumo.codigo;
  var [f, setF] = useState(function () {
    return Object.assign({
      nome: "", grupo: "Outros", unidade: "Unidades", tipo: "material",
      precoManual: null, observacao: "", ativo: true, aliases: [],
      etapaPadrao: "", contaPadrao: "",
    }, insumo);
  });
  var [novoAlias, setNovoAlias] = useState("");

  function set(k, v) { setF(function (p) { var o = Object.assign({}, p); o[k] = v; return o; }); }

  function addAlias() {
    var t = novoAlias.trim();
    if (!t) return;
    var jaTem = (f.aliases || []).some(a => normalizarTexto(a) === normalizarTexto(t));
    if (jaTem) { setNovoAlias(""); return; }
    set("aliases", (f.aliases || []).concat([t]));
    setNovoAlias("");
  }

  function salvar() {
    if (!f.nome || !f.nome.trim()) {
      dialogo.alertar({ titulo: "Informe o nome do insumo", tipo: "aviso" });
      return;
    }
    var out = Object.assign({}, f, { nome: f.nome.trim() });
    if (!out.aliases || !out.aliases.length) out.aliases = [out.nome];
    if (!out.codigo) {
      out.id = out.id || uid();
      out.codigo = proximoCodigoInsumo(out.grupo, insumos);
      out.precoFonte = out.precoManual != null ? "manual" : null;
      out.precoNCompras = 0;
      out.precoFatorInccAplicado = 1;
    }
    if (out.precoManual === "" ) out.precoManual = null;
    if (out.precoManual != null) out.precoManual = Number(out.precoManual);
    out.precoAtualizadoEm = new Date().toISOString();
    onSalvar(out);
  }

  return (
    <div style={INS_S.card}>
      <button onClick={onCancelar} style={Object.assign({}, INS_S.btnGhost, { marginBottom: 16, fontSize: 12 })}>← Voltar</button>
      <div style={{ fontSize: 16, fontWeight: 700, color: INS.grafite, marginBottom: 4 }}>
        {ehNovo ? "Novo insumo" : f.nome}
      </div>
      {!ehNovo && (
        <div style={{ fontSize: 12, color: INS.inkSoft, marginBottom: 18 }}>
          Código <strong style={{ fontFamily: "ui-monospace, monospace" }}>{f.codigo}</strong> — não muda depois de criado
        </div>
      )}
      {ehNovo && (
        <div style={{ fontSize: 12, color: INS.inkSoft, marginBottom: 18 }}>
          O código é gerado a partir do grupo e não muda depois de criado.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div style={isMobile ? {} : { gridColumn: "1 / -1" }}>
          <label style={INS_S.label}>Nome *</label>
          <input style={INS_S.input} value={f.nome} onChange={e => set("nome", e.target.value)} />
        </div>
        <div>
          <label style={INS_S.label}>Grupo</label>
          <SelectBusca style={INS_S.input} value={f.grupo} onChange={v => set("grupo", v)}
            placeholder="Procurar grupo…" vazio="— escolher —"
            opcoes={INSUMO_GRUPOS.map(function (g) {
              return { valor: g.nome, rotulo: g.nome + " (" + g.prefixo + ")" };
            })} />
        </div>
        <div>
          <label style={INS_S.label}>Unidade</label>
          <SelectBusca style={INS_S.input} value={f.unidade} onChange={v => set("unidade", v)}
            placeholder="Procurar unidade…" vazio="— escolher —" opcoes={INSUMO_UNIDADES} />
        </div>
        <div>
          <label style={INS_S.label}>Tipo</label>
          <Selecao style={Object.assign({}, INS_S.input, { cursor: "pointer" })} value={f.tipo} onChange={e => set("tipo", e.target.value)}>
            <option value="material">Material</option>
            <option value="prestador">Prestador de serviço</option>
          </Selecao>
        </div>
        {/* Tubo de esgoto só serve à etapa de esgoto; cimento serve a
            quase todas. Por isso a etapa aqui é opcional: preenchida, o item
            já entra com ela no pedido; em branco, quem decide é a compra. */}
        <div>
          <label style={INS_S.label}>Etapa padrão</label>
          <SelectBusca style={INS_S.input} value={f.etapaPadrao || ""}
            onChange={v => set("etapaPadrao", v)} placeholder="Procurar etapa…"
            opcoes={[{ valor: "", rotulo: "— decide na compra —" }].concat(
              (typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : []).map(function (et) {
                return { valor: et.id, rotulo: et.nome, grupo: et.macro || "" };
              }))} />
        </div>
        <div>
          <label style={INS_S.label}>Conta padrão do P&amp;L</label>
          <SelectBusca style={INS_S.input} value={f.contaPadrao || ""}
            onChange={v => set("contaPadrao", v)} placeholder="Procurar conta…"
            opcoes={[{ valor: "", rotulo: "— Material —" }].concat(
              (typeof GRUPOS_PL !== "undefined" ? GRUPOS_PL : [])
                .filter(function (g) { return g.id !== "receitas" && g.id !== "terreno"; })
                .map(function (g) {
                  return {
                    grupo: g.titulo,
                    opcoes: (typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : [])
                      .filter(function (c) { return c.grupo === g.id; })
                      .map(function (c) { return { valor: c.id, rotulo: c.nome }; }),
                  };
                }))} />
        </div>
        <div>
          <label style={INS_S.label}>Preço manual (R$)</label>
          <input style={INS_S.input} type="number" step="0.01" placeholder="deixe vazio para usar o automático"
            value={f.precoManual == null ? "" : f.precoManual}
            onChange={e => set("precoManual", e.target.value === "" ? null : e.target.value)} />
          <div style={{ fontSize: 11, color: INS.inkSoft, marginTop: 4 }}>
            Preenchido, congela o preço: nenhuma compra o sobrescreve.
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={INS_S.label}>Como este insumo também é chamado</label>
        <div style={{ fontSize: 11, color: INS.inkSoft, marginBottom: 8 }}>
          Cada nome aqui faz o vínculo automático funcionar quando a nota do fornecedor vem escrita diferente.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {(f.aliases || []).map((a, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f2f2f4", borderRadius: 8, padding: "4px 8px", fontSize: 12 }}>
              {a}
              <button onClick={() => set("aliases", f.aliases.filter((_, j) => j !== i))}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
            </span>
          ))}
          {!(f.aliases || []).length && <span style={{ fontSize: 12, color: "#6b7280" }}>Nenhum ainda — o nome principal é usado.</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={INS_S.input} value={novoAlias} placeholder="Ex.: CIMENTO CP II 50KG"
            onChange={e => setNovoAlias(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAlias(); } }} />
          <button style={INS_S.btnSec} onClick={addAlias}>Adicionar</button>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={INS_S.label}>Observação</label>
        <textarea style={Object.assign({}, INS_S.input, { resize: "vertical" })} rows={2}
          value={f.observacao || ""} onChange={e => set("observacao", e.target.value)} />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#111827", marginBottom: 18, cursor: "pointer" }}>
        <input type="checkbox" checked={f.ativo !== false} onChange={e => set("ativo", e.target.checked)} />
        Ativo
      </label>

      <div style={{ display: "flex", gap: 10 }}>
        <button style={INS_S.btn} onClick={salvar}>Salvar</button>
        <button style={INS_S.btnSec} onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

// ── Detalhe ──────────────────────────────────────────────────
function InsumoDetalhe({ insumo, data, onEditar, onVoltar, onAceitarPendente, onDescartarPendente, isMobile }) {
  var p = precoInsumo(insumo);
  var conf = CONF_INSUMO[p.confianca] || CONF_INSUMO.sem_preco;

  // Escritório e obras, na mesma lista.
  var compras = comprasDoInsumo(insumo, data);

  var usoEstimativas = (data.obras || []).filter(o =>
    o.orcamento && (o.orcamento.itens || []).some(i => i.insumoCodigo === insumo.codigo)
  ).length;

  return (
    <div>
      <button onClick={onVoltar} style={Object.assign({}, INS_S.btnGhost, { marginBottom: 16, fontSize: 12 })}>← Voltar</button>

      <div style={Object.assign({}, INS_S.card, { marginBottom: 16 })}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, color: INS.inkSoft, fontFamily: "ui-monospace, monospace", letterSpacing: 0.5 }}>{insumo.codigo}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: INS.grafite, marginTop: 2 }}>{insumo.nome}</div>
            <div style={{ fontSize: 12, color: INS.inkSoft, marginTop: 4 }}>
              {insumo.grupo} · {insumo.unidade} · {insumo.tipo === "prestador" ? "Prestador" : "Material"}
              {insumo.ativo === false && <span style={{ color: "#dc2626", fontWeight: 600 }}> · inativo</span>}
            </div>
          </div>
          <button style={INS_S.btnSec} onClick={onEditar}>Editar</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 14, marginTop: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Preço</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: INS.grafite, display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
              <PontoConfianca conf={p.confianca} tamanho={9} />{fmtBRLIns(p.preco)}
            </div>
            <div style={{ fontSize: 11, color: conf.cor, fontWeight: 600 }}>{conf.label}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Origem</div>
            <div style={{ fontSize: 13, color: "#111827", marginTop: 6 }}>
              {insumo.precoManual != null ? "Definido à mão"
                : insumo.precoFonte === "compra" ? "Última compra"
                : insumo.precoFonte === "compra_corrigida" ? "Compra corrigida"
                : insumo.precoFonte === "cotacao" ? "Cotação interna"
                : insumo.precoFonte === "mercado" ? "Referência de mercado"
                : "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Data base</div>
            <div style={{ fontSize: 13, color: "#111827", marginTop: 6 }}>{fmtDataIns(insumo.precoData)}</div>
            {p.corrigido && <div style={{ fontSize: 11, color: INS.inkSoft }}>corrigido ×{p.fator}</div>}
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Compras</div>
            <div style={{ fontSize: 13, color: "#111827", marginTop: 6 }}>{insumo.precoNCompras || 0}</div>
          </div>
        </div>

        {insumo.observacao && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(38,36,33,0.08)", fontSize: 12.5, color: "#4b5563", lineHeight: 1.5 }}>
            {insumo.observacao}
          </div>
        )}
      </div>

      {insumo.precoPendente && (() => {
        var pend = insumo.precoPendente;
        var porUnidade = pend.motivo === "unidade";
        var uc = pend.unidade || "?", up = pend.unidadePreco || unidadeDoPreco(insumo) || "?";
        return (
        <div style={{ border: "1.5px solid #f59e0b", background: "#fffbeb", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>
            {porUnidade ? "Compra em outra unidade" : "Compra fora da faixa esperada"}
          </div>
          <div style={{ fontSize: 12.5, color: "#78350f", marginBottom: 12 }}>
            {porUnidade ? (
              <>
                A compra de {fmtDataIns(pend.data)} saiu a {fmtBRLIns(pend.valor)} por <b>{uc}</b>,
                mas este insumo tem preço por <b>{up}</b> — hoje {fmtBRLIns(p.preco)}. Preço de {uc} e preço
                de {up} não são o mesmo número, então <b>nada foi alterado</b>.
                {" "}Aceite só se {fmtBRLIns(pend.valor)} for mesmo o preço por {up}; se a loja cotou em {uc},
                corrija a unidade no pedido ou lance o preço à mão.
              </>
            ) : (
              <>
                Uma compra de {fmtDataIns(pend.data)} registrou {fmtBRLIns(pend.valor)},
                muito distante do preço atual de {fmtBRLIns(p.preco)}. O preço não foi alterado.
                {uc !== "?" ? <> A compra veio em <b>{uc}</b>.</> : null}
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={INS_S.btn} onClick={onAceitarPendente}>Aceitar como novo preço</button>
            <button style={INS_S.btnSec} onClick={onDescartarPendente}>Descartar</button>
          </div>
        </div>
        );
      })()}

      <div style={Object.assign({}, INS_S.card, { marginBottom: 16 })}>
        <div style={{ fontSize: 13, fontWeight: 700, color: INS.grafite, marginBottom: 12 }}>
          Histórico de compras {compras.length ? `(${compras.length})` : ""}
        </div>
        {!compras.length ? (
          <div style={{ fontSize: 12.5, color: "#6b7280" }}>
            Nenhuma compra vinculada a este insumo ainda. O histórico se forma conforme as notas são lançadas nas obras.
          </div>
        ) : (
          <div>
            <GraficoPrecoInsumo compras={compras} />
            <div style={{ overflowX: "auto", marginTop: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#6b7280", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    <th style={{ padding: "6px 8px" }}>Data</th>
                    <th style={{ padding: "6px 8px" }}>Origem</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Qtd</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Total</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Unitário</th>
                  </tr>
                </thead>
                <tbody>
                  {compras.slice().reverse().map((c, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "7px 8px" }}>
                        {fmtDataIns(c.data)}
                        {c.origem === "obra" && !c.pago && (
                          <span style={{ fontSize: 10, color: "#b45309", marginLeft: 5 }}>a pagar</span>
                        )}
                      </td>
                      {/* De onde veio a compra: a obra que comprou, ou o
                          escritório. Sem isto a lista mistura as duas e ninguém
                          sabe a qual nota um preço estranho pertence. */}
                      <td style={{ padding: "7px 8px", color: "#4b5563", maxWidth: 180,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={c.origem === "obra" ? (c.obraNome || "Obra") : "Escritório"}>
                        {c.origem === "obra" ? (c.obraNome || "Obra") : "Escritório"}
                        {c.favorecido ? <span style={{ color: "#9ca3af" }}> · {c.favorecido}</span> : null}
                      </td>
                      <td style={{ padding: "7px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{qtdIns(c.qtd)}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtBRLIns(c.total)}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtBRLIns(c.unitario)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div style={INS_S.card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: INS.grafite, marginBottom: 10 }}>Onde é usado</div>
        <div style={{ fontSize: 12.5, color: "#4b5563" }}>
          {usoEstimativas} orçamento{usoEstimativas === 1 ? "" : "s"} de obra · {compras.length} lançamento{compras.length === 1 ? "" : "s"} de compra
        </div>
        {(insumo.aliases || []).length > 1 && (
          <div style={{ marginTop: 12, fontSize: 12, color: INS.inkSoft }}>
            Também reconhecido como: {(insumo.aliases || []).slice(1).join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}

// Gráfico de linha em SVG puro — sem biblioteca.
function GraficoPrecoInsumo({ compras }) {
  if (!compras || compras.length < 2) return null;
  var W = 640, H = 130, PAD = 10;
  var vals = compras.map(c => c.unitario);
  var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
  if (max === min) { max = max * 1.1 || 1; min = min * 0.9; }
  var pts = compras.map(function (c, i) {
    var x = PAD + (i / (compras.length - 1)) * (W - PAD * 2);
    var y = H - PAD - ((c.unitario - min) / (max - min)) * (H - PAD * 2);
    return { x: x, y: y, c: c };
  });
  var d = pts.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
  var area = d + " L" + pts[pts.length - 1].x.toFixed(1) + " " + (H - PAD) + " L" + pts[0].x.toFixed(1) + " " + (H - PAD) + " Z";
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={"0 0 " + W + " " + H} width="100%" height={H} style={{ display: "block", minWidth: 320 }} role="img"
        aria-label={"Evolução do preço unitário: de " + fmtBRLIns(compras[0].unitario) + " a " + fmtBRLIns(compras[compras.length - 1].unitario)}>
        <path d={area} fill="rgba(30,58,95,0.07)" />
        <path d={d} fill="none" stroke={INS.azul} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.6" fill="#fff" stroke={INS.azul} strokeWidth="1.6">
            <title>{fmtDataIns(p.c.data) + " — " + fmtBRLIns(p.c.unitario)}</title>
          </circle>
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280", marginTop: 2 }}>
        <span>{fmtDataIns(compras[0].data)} · {fmtBRLIns(min)}</span>
        <span>{fmtDataIns(compras[compras.length - 1].data)} · {fmtBRLIns(max)}</span>
      </div>
    </div>
  );
}

// ── Módulo ───────────────────────────────────────────────────
// ── Composições: kits por ambiente (estimativa preliminar de instalações) ──
// Lê COMPOSICOES_SEED / AMBIENTES_TIPOS (composicoes-seed.jsx) e grava o que
// o escritório mudar em data.escritorio.composicoes = { kits: {id: {itens}}, ambientes: {id: {pontos}} }.
function ComposicoesEditor({ data, save, insumos, podeEditar, onVoltar }) {
  var cfg = (data.escritorio && data.escritorio.composicoes) || {};
  var seed = typeof COMPOSICOES_SEED !== "undefined" ? COMPOSICOES_SEED : {};
  var tipos = typeof AMBIENTES_TIPOS !== "undefined" ? AMBIENTES_TIPOS : [];
  var disciplinas = typeof COMPOSICOES_DISCIPLINAS !== "undefined" ? COMPOSICOES_DISCIPLINAS : [];
  var pontosDef = typeof PONTOS_ELETRICOS !== "undefined" ? PONTOS_ELETRICOS : [];
  var [aba, setAba] = useState("kits");
  var [disc, setDisc] = useState(disciplinas.length ? disciplinas[0].id : "");
  var [aberto, setAberto] = useState({});

  function kitAtual(id) {
    var o = cfg.kits && cfg.kits[id];
    return o && Array.isArray(o.itens) ? Object.assign({}, seed[id], { itens: o.itens, editado: true }) : seed[id];
  }
  function gravarCfg(novaCfg) {
    save(Object.assign({}, data, { escritorio: Object.assign({}, data.escritorio || {}, { composicoes: novaCfg }) }));
  }
  function setItensKit(id, itens) {
    var kits = Object.assign({}, cfg.kits || {});
    kits[id] = { itens: itens };
    gravarCfg(Object.assign({}, cfg, { kits: kits }));
  }
  function restaurarKit(id) {
    var kits = Object.assign({}, cfg.kits || {});
    delete kits[id];
    gravarCfg(Object.assign({}, cfg, { kits: kits }));
  }
  function setPonto(ambId, pontoId, valor) {
    var ambs = Object.assign({}, cfg.ambientes || {});
    var atual = Object.assign({}, (ambs[ambId] && ambs[ambId].pontos) || {});
    atual[pontoId] = Number(valor) || 0;
    ambs[ambId] = { pontos: atual };
    gravarCfg(Object.assign({}, cfg, { ambientes: ambs }));
  }
  function pontosDe(t) {
    var o = cfg.ambientes && cfg.ambientes[t.id];
    return Object.assign({}, t.pontos || {}, (o && o.pontos) || {});
  }
  function statusNome(nome) {
    // "{padrão}" no nome = genérico por padrão da obra; confere pelo Médio
    var porPadrao = /\{padr[ãa]o\}/i.test(String(nome || ""));
    var r = resolverInsumo(porPadrao ? String(nome).replace(/\{padr[ãa]o\}/gi, "Médio") : nome, insumos);
    if (!r.insumo) return { cor: "#b45309", texto: porPadrao ? "genérico do padrão Médio não está em Insumos" : "não está em Insumos" };
    if (porPadrao) { var pp = precoInsumo(r.insumo); return { cor: "#15803d", texto: "por padrão da obra · Médio " + r.insumo.codigo + (pp.preco != null ? " · " + fmtBRLIns(pp.preco) : "") }; }
    var p = precoInsumo(r.insumo);
    return p.preco != null ? { cor: "#15803d", texto: r.insumo.codigo + " · " + fmtBRLIns(p.preco) } : { cor: "#b45309", texto: r.insumo.codigo + " · sem preço" };
  }

  var ids = Object.keys(seed).filter(function (id) { return (seed[id].disciplina || "OUTROS") === disc; });

  return (
    <div>
      <button style={INS_S.btnGhost} onClick={onVoltar}>← Insumos</button>
      <div style={{ fontSize: 22, fontWeight: 700, color: INS.grafite, margin: "8px 0 2px" }}>Composições</div>
      <div style={{ fontSize: 12.5, color: INS.inkSoft, marginBottom: 14 }}>
        Kits que a estimativa usa quando a obra ainda não tem projeto de engenharia: o que entra por banheiro, cozinha, lavanderia, por ponto elétrico e por obra. Quantidades de partida das composições paramétricas do SINAPI, com os nomes do seu cadastro. Edite e o VICKE passa a usar o seu número.
      </div>
      <datalist id="vk-insumos-lista-comp">{insumos.map(function (m) { return <option key={m.id || m.codigo || m.nome} value={m.nome} />; })}</datalist>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button style={aba === "kits" ? INS_S.btn : INS_S.btnSec} onClick={function () { setAba("kits"); }}>Kits</button>
        <button style={aba === "pontos" ? INS_S.btn : INS_S.btnSec} onClick={function () { setAba("pontos"); }}>Pontos elétricos por cômodo</button>
        {typeof CronogramaEditor === "function" && <button style={aba === "cronograma" ? INS_S.btn : INS_S.btnSec} onClick={function () { setAba("cronograma"); }}>Cronograma</button>}
        {typeof ProdutividadeEditor === "function" && <button style={aba === "produtividade" ? INS_S.btn : INS_S.btnSec} onClick={function () { setAba("produtividade"); }}>Produtividade (HH)</button>}
      </div>

      {aba === "cronograma" && <CronogramaEditor data={data} save={save} podeEditar={podeEditar} />}
      {aba === "produtividade" && <ProdutividadeEditor data={data} save={save} podeEditar={podeEditar} />}

      {aba === "pontos" && (
        <div style={INS_S.card}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
              <thead><tr style={{ textAlign: "left", color: "#6b7280", fontSize: 10.5, textTransform: "uppercase" }}>
                <th style={{ padding: "6px 8px" }}>Cômodo</th>
                {pontosDef.map(function (p) { return <th key={p.id} style={{ padding: "6px 8px", textAlign: "right" }}>{p.nome}</th>; })}
              </tr></thead>
              <tbody>
                {tipos.map(function (t) {
                  var pt = pontosDe(t);
                  return (
                    <tr key={t.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "6px 8px", color: "#111827" }}>{t.nome}</td>
                      {pontosDef.map(function (p) {
                        return <td key={p.id} style={{ padding: "4px 8px", textAlign: "right" }}>
                          <input type="number" min="0" step="1" disabled={!podeEditar} value={pt[p.id] == null ? 0 : pt[p.id]}
                            onChange={function (e) { setPonto(t.id, p.id, e.target.value); }}
                            style={Object.assign({}, INS_S.input, { width: 64, textAlign: "right", padding: "5px 8px" })} />
                        </td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 8 }}>Por unidade de cômodo. Cada ponto vira o kit correspondente (aba Kits → Elétrica). Circuitos: 1 disjuntor 10A a cada 8 pontos de luz e 1 de 20A a cada 6 tomadas gerais, calculados pelo motor.</div>
        </div>
      )}

      {aba === "kits" && (
        <div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {disciplinas.map(function (d) {
              return <button key={d.id} style={Object.assign({}, disc === d.id ? INS_S.btn : INS_S.btnSec, { padding: "6px 12px", fontSize: 12 })} onClick={function () { setDisc(d.id); }}>{d.nome}</button>;
            })}
          </div>
          {ids.map(function (id) {
            var kit = kitAtual(id);
            var ab = !!aberto[id];
            return (
              <div key={id} style={Object.assign({}, INS_S.card, { marginBottom: 10, padding: 0, overflow: "hidden" })}>
                <button type="button" onClick={function () { var n = Object.assign({}, aberto); n[id] = !ab; setAberto(n); }}
                  style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#fafafa", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                  <span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: INS.grafite }}>{kit.nome}</span>
                    <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 8 }}>{kit.base === "ponto" ? "por ponto" : kit.base === "obra" ? "por obra" : "por ambiente"} · {kit.itens.length} itens · {kit.editado ? "editado pelo escritório" : kit.fonte}</span>
                  </span>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>{ab ? "▲" : "▼"}</span>
                </button>
                {ab && (
                  <div style={{ padding: 12 }}>
                    {kit.itens.map(function (it, idx) {
                      var st = statusNome(it.nome);
                      return (
                        <div key={idx} style={{ display: "grid", gridTemplateColumns: "3fr 90px 110px auto", gap: 8, alignItems: "center", marginBottom: 6 }}>
                          <div>
                            <input list="vk-insumos-lista-comp" disabled={!podeEditar} value={it.nome || ""} style={INS_S.input}
                              onChange={function (e) { var n = kit.itens.slice(); n[idx] = Object.assign({}, it, { nome: e.target.value }); setItensKit(id, n); }} />
                            <div style={{ fontSize: 10.5, color: st.cor, marginTop: 2 }}>{st.texto}</div>
                          </div>
                          <input type="number" step="0.1" min="0" disabled={!podeEditar} value={it.qtd == null ? "" : it.qtd} style={Object.assign({}, INS_S.input, { textAlign: "right" })}
                            onChange={function (e) { var n = kit.itens.slice(); n[idx] = Object.assign({}, it, { qtd: e.target.value === "" ? "" : Number(e.target.value) }); setItensKit(id, n); }} />
                          <input disabled={!podeEditar} value={it.unidade || ""} placeholder="Unidades" style={INS_S.input}
                            onChange={function (e) { var n = kit.itens.slice(); n[idx] = Object.assign({}, it, { unidade: e.target.value }); setItensKit(id, n); }} />
                          <button type="button" disabled={!podeEditar} style={Object.assign({}, INS_S.btnGhost, { color: "#dc2626" })}
                            onClick={function () { setItensKit(id, kit.itens.filter(function (_, i) { return i !== idx; })); }}>Remover</button>
                        </div>
                      );
                    })}
                    {podeEditar && (
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button type="button" style={INS_S.btnSec} onClick={function () { setItensKit(id, kit.itens.concat([{ nome: "", qtd: 1, unidade: "Unidades" }])); }}>＋ Item</button>
                        {kit.editado && <button type="button" style={INS_S.btnSec} onClick={function () { restaurarKit(id); }}>Restaurar padrão</button>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!ids.length && <div style={{ fontSize: 12.5, color: "#4b5563" }}>Nenhum kit nesta disciplina.</div>}
        </div>
      )}
    </div>
  );
}

function Insumos({ data, save }) {
  var perm = getPermissoes();
  var [view, setView] = useState("lista");
  var [sel, setSel] = useState(null);
  var [busca, setBusca] = useState("");
  var [filtroGrupo, setFiltroGrupo] = useState("");
  var [filtroConf, setFiltroConf] = useState("");
  // "" = qualquer etapa; "__sem__" = só quem ainda não tem etapa padrão.
  var [filtroEtapa, setFiltroEtapa] = useState("");
  var [semeando, setSemeando] = useState(false);
  var [marcados, setMarcados] = useState({});
  var [etapaLote, setEtapaLote] = useState("");
  var [sugestao, setSugestao] = useState(null);   // { grupos, fora: {etapaId:true} }
  var [previaPrecos, setPreviaPrecos] = useState(null);  // { linhas, resumo } - levantamento, nunca grava

  var [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(function () {
    function onResize() { setIsMobile(window.innerWidth < 768); }
    window.addEventListener("resize", onResize);
    return function () { window.removeEventListener("resize", onResize); };
  }, []);

  var insumos = useMemo(function () { return data.materiais || []; }, [data.materiais]);
  var pendentesMigracao = insumos.filter(i => !i.codigo).length;
  var faltamDaSemente = useMemo(function () {
    var codigos = {};
    insumos.forEach(i => { if (i.codigo) codigos[i.codigo] = 1; });
    return INSUMOS_SEED.filter(s => !codigos[s.codigo]).length;
  }, [insumos]);

  var enriquecidos = useMemo(function () {
    return insumos.map(function (i) {
      var p = precoInsumo(i);
      return { i: i, p: p };
    });
  }, [insumos]);

  var ORDEM_CONF = { sem_preco: 0, obsoleta: 1, baixa: 2, media: 3, manual: 4, alta: 5 };
  var filtrados = useMemo(function () {
    var n = normalizarTexto(busca);
    return enriquecidos
      .filter(function (x) {
        if (filtroGrupo && x.i.grupo !== filtroGrupo) return false;
        if (filtroConf && x.p.confianca !== filtroConf) return false;
        if (filtroEtapa === "__sem__" && (x.i.etapaPadrao || "")) return false;
        if (filtroEtapa && filtroEtapa !== "__sem__" && x.i.etapaPadrao !== filtroEtapa) return false;
        if (!n) return true;
        if (normalizarTexto(x.i.codigo).indexOf(n) >= 0) return true;
        if (normalizarTexto(x.i.nome).indexOf(n) >= 0) return true;
        return (x.i.aliases || []).some(a => normalizarTexto(a).indexOf(n) >= 0);
      })
      .sort(function (a, b) {
        var d = (ORDEM_CONF[a.p.confianca] || 0) - (ORDEM_CONF[b.p.confianca] || 0);
        if (d !== 0) return d;
        return String(a.i.nome).localeCompare(String(b.i.nome), "pt-BR");
      });
  }, [enriquecidos, busca, filtroGrupo, filtroConf, filtroEtapa]);

  var resumo = useMemo(function () {
    var r = { total: enriquecidos.length, alta: 0, media: 0, baixa: 0, obsoleta: 0, sem_preco: 0, manual: 0, pendentes: 0, semEtapa: 0 };
    enriquecidos.forEach(function (x) {
      if (r[x.p.confianca] != null) r[x.p.confianca]++;
      if (x.i.precoPendente) r.pendentes++;
      if (!(x.i.etapaPadrao || "")) r.semEtapa++;
    });
    return r;
  }, [enriquecidos]);

  function salvarInsumo(novo) {
    var lista = insumos.slice();
    var idx = lista.findIndex(x => x.id === novo.id || (novo.codigo && x.codigo === novo.codigo));
    if (idx >= 0) lista[idx] = novo; else lista.push(novo);
    save(Object.assign({}, data, { materiais: lista }));
    setSel(novo);
    setView("detalhe");
  }

  // "Quero ver quem ainda está sem etapa" é sempre o mesmo gesto: filtrar a
  // lista e marcar todos. Um clique faz os dois — a barra de seleção já abre
  // com eles marcados, prontos para receber a etapa ou para só serem lidos.
  function verOsSemEtapa() {
    setFiltroEtapa("__sem__");
    setFiltroGrupo("");
    setFiltroConf("");
    setBusca("");
    var novo = {};
    enriquecidos.forEach(function (x) {
      if (!(x.i.etapaPadrao || "")) novo[x.i.id || x.i.codigo] = true;
    });
    setMarcados(novo);
  }

  function aplicarEtapaEmLote() {
    var chaves = Object.keys(marcados).filter(function (k) { return marcados[k]; });
    if (!chaves.length) return;
    var r = definirEtapaPadraoEmLote(insumos, chaves, etapaLote);
    save(Object.assign({}, data, { materiais: r.insumos }));
    setMarcados({});
    setEtapaLote("");
    dialogo.alertar({
      titulo: r.mudados === 1 ? "1 insumo atualizado" : r.mudados + " insumos atualizados",
      mensagem: etapaLote
        ? "Da próxima compra em diante eles já entram nessa etapa."
        : "A etapa saiu: esses itens voltam a perguntar na compra.",
    });
  }

  // Levantamento, não ação: mostra o que as compras FARIAM com o catálogo.
  // Nada é gravado ao abrir — é a conferida antes da decisão.
  function abrirPreviaPrecos() {
    var r = previaDePrecosPorCompra(insumos, data);
    if (!r.resumo.comCompras) {
      dialogo.alertar({ titulo: "Nenhuma compra vinculada ainda",
        mensagem: "Nenhum insumo tem compra com código casado — nem nos lançamentos do escritório, nem nas contas a pagar das obras." });
      return;
    }
    setPreviaPrecos(r);
  }

  function abrirSugestoes() {
    var s = sugestoesDeEtapa(insumos);
    if (!s.total) {
      dialogo.alertar({ titulo: "Nada a sugerir",
        mensagem: "Ou todos os insumos já têm etapa, ou nenhum nome deixa claro qual é." });
      return;
    }
    setSugestao({ grupos: s.grupos, semSugestao: s.semSugestao, fora: {} });
  }

  function aplicarSugestoes() {
    if (!sugestao) return;
    var lista = insumos, mudados = 0;
    sugestao.grupos.forEach(function (g) {
      if (sugestao.fora[g.etapaId]) return;
      var chaves = g.itens.map(function (x) { return x.id || x.codigo; });
      var r = definirEtapaPadraoEmLote(lista, chaves, g.etapaId);
      lista = r.insumos; mudados += r.mudados;
    });
    save(Object.assign({}, data, { materiais: lista }));
    setSugestao(null);
    dialogo.alertar({
      titulo: mudados === 1 ? "1 insumo ganhou etapa" : mudados + " insumos ganharam etapa",
      mensagem: "Confira na coluna Etapa padrão e ajuste o que estiver errado — dá para trocar em lote.",
    });
  }

  function rodarSemeadura() {
    setSemeando(true);
    try {
      var mig = migrarMateriaisParaInsumos(insumos);
      var sem = semearInsumos(mig.materiais, INSUMOS_SEED);
      save(Object.assign({}, data, { materiais: sem.materiais }));
      dialogo.alertar({
        titulo: "Catálogo atualizado",
        mensagem: sem.criados + " insumo(s) criado(s), " + sem.atualizados + " atualizado(s), "
          + sem.ignorados + " já estavam em dia" + (mig.alterados ? ". " + mig.alterados + " material antigo ganhou código." : "."),
        tipo: "sucesso",
      });
    } catch (e) {
      dialogo.alertar({ titulo: "Não foi possível semear", mensagem: e.message, tipo: "erro" });
    }
    setSemeando(false);
  }

  function aplicarPendente(insumo, aceitar) {
    var lista = insumos.map(function (x) {
      if (x.codigo !== insumo.codigo) return x;
      if (!aceitar) return Object.assign({}, x, { precoPendente: null });
      // Aceitar é dizer "este valor é o preço NA MINHA UNIDADE". A unidade do
      // preço não vira a da loja — se virasse, aceitar uma vez o preço do metro
      // num catálogo que cobra o rolo calaria a guarda para sempre. E fica
      // conferida: foi conferida por ele, à mão, que é a conferida que vale.
      return Object.assign({}, x, {
        precoReferencia: insumo.precoPendente.valor,
        ultimoPreco: insumo.precoPendente.valor,
        precoFonte: "compra",
        precoData: insumo.precoPendente.data,
        precoUnidade: unidadeDoPreco(x),
        precoUnidadeConferida: true,
        precoNCompras: (x.precoNCompras || 0) + 1,
        precoFatorInccAplicado: 1,
        precoPendente: null,
        precoAtualizadoEm: new Date().toISOString(),
      });
    });
    save(Object.assign({}, data, { materiais: lista }));
    setSel(lista.find(x => x.codigo === insumo.codigo));
  }

  // ── formulário ──
  if (view === "form" && sel) {
    return (
      <div style={{ padding: isMobile ? 16 : "28px 32px", background: INS.fundo, minHeight: "100%", fontFamily: INS_FONT }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <InsumoForm insumo={sel} insumos={insumos} isMobile={isMobile}
            onSalvar={salvarInsumo}
            onCancelar={() => { setView(sel.codigo ? "detalhe" : "lista"); }} />
        </div>
      </div>
    );
  }

  // ── detalhe ──
  if (view === "composicoes") {
    return (
      <div style={{ padding: isMobile ? 16 : "28px 32px", background: INS.fundo, minHeight: "100%", fontFamily: INS_FONT }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <ComposicoesEditor data={data} save={save} insumos={insumos} podeEditar={perm.podeAlterarConfig} onVoltar={() => setView("lista")} />
        </div>
      </div>
    );
  }

  if (view === "detalhe" && sel) {
    var atual = insumos.find(x => x.codigo === sel.codigo) || sel;
    return (
      <div style={{ padding: isMobile ? 16 : "28px 32px", background: INS.fundo, minHeight: "100%", fontFamily: INS_FONT }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <InsumoDetalhe insumo={atual} data={data} isMobile={isMobile}
            onEditar={() => { if (!perm.podeEditar) return; setSel(atual); setView("form"); }}
            onVoltar={() => { setView("lista"); setSel(null); }}
            onAceitarPendente={() => aplicarPendente(atual, true)}
            onDescartarPendente={() => aplicarPendente(atual, false)} />
        </div>
      </div>
    );
  }

  // ── lista ──
  return (
    <div style={{ padding: isMobile ? 16 : "28px 32px", background: INS.fundo, minHeight: "100%", fontFamily: INS_FONT }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: INS.grafite, letterSpacing: "-0.01em" }}>Insumos</div>
            <div style={{ fontSize: 12.5, color: INS.inkSoft, marginTop: 2 }}>
              Catálogo de materiais e serviços. É daqui que a estimativa lê preço e é aqui que as compras o atualizam.
            </div>
          </div>
          {perm.podeAlterarConfig && typeof COMPOSICOES_SEED !== "undefined" && (
            <button style={INS_S.btnSec} onClick={() => setView("composicoes")}>Composições (kits por ambiente)</button>
          )}
          {perm.podeEditar && (
            <button style={INS_S.btn} onClick={() => { setSel({}); setView("form"); }}>+ Novo insumo</button>
          )}
        </div>

        {(faltamDaSemente > 0 || pendentesMigracao > 0) && perm.podeAlterarConfig && (
          <div style={{ border: "1.5px solid #1e3a5f", background: "#f5f8fc", borderRadius: 16, padding: 16, margin: "18px 0" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: INS.azul, marginBottom: 4 }}>
              {insumos.length === 0 ? "Catálogo vazio" : "Catálogo incompleto"}
            </div>
            <div style={{ fontSize: 12.5, color: "#111827", marginBottom: 12 }}>
              {faltamDaSemente > 0 && <>Faltam <strong>{faltamDaSemente}</strong> insumos do catálogo padrão (materiais, louças e metais, esquadrias e prestadores, com preço de referência). </>}
              {pendentesMigracao > 0 && <><strong>{pendentesMigracao}</strong> material antigo ainda não tem código. </>}
              A operação é segura de repetir: nunca sobrescreve preço definido à mão nem preço mais recente que o da semente.
            </div>
            <button style={INS_S.btn} disabled={semeando} onClick={rodarSemeadura}>
              {semeando ? "Aplicando…" : "Carregar catálogo padrão"}
            </button>
          </div>
        )}

        {resumo.total > 0 && (
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "18px 0", fontSize: 12.5, color: "#4b5563" }}>
            <span><strong style={{ color: INS.grafite }}>{resumo.total}</strong> insumos</span>
            <span><PontoConfianca conf="alta" /> {resumo.alta} atual</span>
            <span><PontoConfianca conf="media" /> {resumo.media} recente</span>
            <span><PontoConfianca conf="baixa" /> {resumo.baixa} antigo</span>
            <span><PontoConfianca conf="obsoleta" /> {resumo.obsoleta} obsoleto</span>
            {resumo.sem_preco > 0 && <span><PontoConfianca conf="sem_preco" /> {resumo.sem_preco} sem preço</span>}
            {resumo.pendentes > 0 && <span style={{ color: "#b45309", fontWeight: 600 }}>{resumo.pendentes} aguardando confirmação</span>}
            {resumo.semEtapa > 0 && (
              <button type="button" onClick={verOsSemEtapa}
                title="filtra a lista e marca todos de uma vez"
                style={{ background: "none", border: "none", padding: 0, fontFamily: "inherit",
                  fontSize: 12.5, color: INS.azul, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>
                {resumo.semEtapa} sem etapa padrão
              </button>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          <input style={INS_S.input} placeholder="Buscar por nome, código ou apelido…" value={busca} onChange={e => setBusca(e.target.value)} />
          <SelectBusca style={INS_S.input} value={filtroGrupo} onChange={v => setFiltroGrupo(v)}
            placeholder="Procurar grupo…"
            opcoes={[{ valor: "", rotulo: "Todos os grupos" }].concat(
              INSUMO_GRUPOS.map(function (g) { return { valor: g.nome, rotulo: g.nome }; }))} />
          <Selecao style={Object.assign({}, INS_S.input, { cursor: "pointer" })} value={filtroConf} onChange={e => setFiltroConf(e.target.value)}>
            <option value="">Qualquer preço</option>
            <option value="alta">Atual</option>
            <option value="media">Recente</option>
            <option value="baixa">Antigo</option>
            <option value="obsoleta">Obsoleto</option>
            <option value="sem_preco">Sem preço</option>
            <option value="manual">Definido à mão</option>
          </Selecao>
          <SelectBusca style={INS_S.input} value={filtroEtapa} onChange={v => setFiltroEtapa(v)}
            placeholder="Procurar etapa…"
            opcoes={[{ valor: "", rotulo: "Qualquer etapa" },
                     { valor: "__sem__", rotulo: "— sem etapa padrão —" }].concat(
              (typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : []).map(function (et) {
                return { valor: et.id, rotulo: et.nome, grupo: et.macro || "" };
              }))} />
        </div>

        {perm.podeEditar && insumos.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <button style={INS_S.btnSec} onClick={abrirSugestoes}>Sugerir etapas pelo nome</button>
            <button style={{ ...INS_S.btnSec, marginLeft: 8 }} onClick={abrirPreviaPrecos}>
              O que as compras fariam no preço
            </button>
            <div style={{ fontSize: 11.5, color: INS.inkSoft, marginTop: 6 }}>
              Os dois são levantamento: mostram o que mudaria e esperam você conferir antes de gravar.
            </div>
          </div>
        )}

        {previaPrecos && (() => {
          var R = previaPrecos.resumo;
          var brl = function (v) { return v == null ? "—" : fmtBRLIns(v); };
          var cor = { pendente: "#b45309", atualiza: "#0474f4", semMudanca: "#6b7280", manual: "#6b7280" };
          var rotulo = { pendente: "para e pergunta", atualiza: "atualiza", semMudanca: "sem mudança", manual: "preço manual" };
          var porque = function (l) {
            if (l.situacao !== "pendente") return "";
            return l.motivo === "unidade"
              ? "compra em " + (l.unidadeCompra || "?") + ", preço em " + (l.unidadePreco || "?")
              : "salto maior que 3×";
          };
          var th = { padding: "6px 8px", textAlign: "left", fontSize: 10.5, color: INS.inkSoft,
            textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 };
          var td = { padding: "6px 8px", fontSize: 12 };
          var num = { textAlign: "right", fontVariantNumeric: "tabular-nums" };
          return (
            <div style={{ border: "1px solid #0474f4", borderRadius: 14, padding: 14, marginBottom: 14, background: "#fff" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: INS.grafite, marginBottom: 2 }}>
                O que as compras fariam no preço do catálogo
              </div>
              <div style={{ fontSize: 11.5, color: INS.inkSoft, marginBottom: 12 }}>
                Levantamento. Nada foi gravado — isto é a simulação de aplicar {R.compras} compra{R.compras !== 1 ? "s" : ""} de
                {" "}{R.comCompras} insumo{R.comCompras !== 1 ? "s" : ""}, na ordem em que aconteceram.
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12, fontSize: 12 }}>
                <span><b style={{ color: "#0474f4", fontSize: 15 }}>{R.atualiza}</b> mudariam de preço</span>
                <span><b style={{ color: "#b45309", fontSize: 15 }}>{R.pendente}</b> parariam para conferir
                  {R.pendente > 0 ? ` (${R.porUnidade} por unidade, ${R.porSalto} por salto)` : ""}</span>
                <span><b style={{ fontSize: 15 }}>{R.semMudanca}</b> ficariam como estão</span>
                {R.manual > 0 && <span><b style={{ fontSize: 15 }}>{R.manual}</b> com preço manual, intocados</span>}
              </div>
              <div style={{ maxHeight: 360, overflowY: "auto", border: "1px solid #eef0f3", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <th style={th}>Insumo</th>
                    <th style={{ ...th, ...num }}>Compras</th>
                    <th style={{ ...th, ...num }}>Hoje</th>
                    <th style={{ ...th, ...num }}>Viraria</th>
                    <th style={{ ...th, ...num }}>Variação</th>
                    <th style={th}>Situação</th>
                  </tr></thead>
                  <tbody>
                    {previaPrecos.linhas.map(function (l, k) {
                      return (
                        <tr key={k} style={{ borderTop: "1px solid #f3f4f6" }}>
                          <td style={{ ...td, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            title={l.insumo.nome}>
                            <span style={{ color: INS.inkSoft, fontSize: 10.5 }}>{l.insumo.codigo}</span> {l.insumo.nome}
                          </td>
                          <td style={{ ...td, ...num, color: INS.inkSoft }}>{l.compras}</td>
                          <td style={{ ...td, ...num }}>{brl(l.precoAntes)}</td>
                          <td style={{ ...td, ...num, fontWeight: 600 }}>{brl(l.precoDepois)}</td>
                          <td style={{ ...td, ...num, color: l.variacao == null ? INS.inkSoft : l.variacao > 0 ? "#b45309" : "#15803d" }}>
                            {l.variacao == null ? "—" : (l.variacao > 0 ? "+" : "") + l.variacao.toLocaleString("pt-BR") + "%"}
                          </td>
                          <td style={{ ...td, color: cor[l.situacao], fontWeight: l.situacao === "pendente" ? 600 : 400 }}>
                            {rotulo[l.situacao]}
                            {porque(l) ? <div style={{ fontSize: 10.5, fontWeight: 400, color: INS.inkSoft }}>{porque(l)}</div> : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                <button style={INS_S.btnSec} onClick={function () { setPreviaPrecos(null); }}>Fechar</button>
              </div>
            </div>
          );
        })()}

        {sugestao && (
          <div style={{ border: "1px solid #0474f4", borderRadius: 14, padding: 14, marginBottom: 14, background: "#fff" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: INS.grafite, marginBottom: 2 }}>Etapas sugeridas</div>
            <div style={{ fontSize: 11.5, color: INS.inkSoft, marginBottom: 12 }}>
              Nada foi gravado ainda. Desmarque o grupo que não fizer sentido e clique em Aplicar.
              {sugestao.semSugestao > 0 ? " " + sugestao.semSugestao + " insumos ficaram sem sugestão — o nome não diz, e chutar seria pior." : ""}
            </div>
            {sugestao.grupos.map(function (g) {
              var dentro = !sugestao.fora[g.etapaId];
              return (
                <div key={g.etapaId} style={{ borderTop: "1px solid #f3f4f6", padding: "8px 0" }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                    <input type="checkbox" checked={dentro}
                      onChange={e => setSugestao(Object.assign({}, sugestao, {
                        fora: Object.assign({}, sugestao.fora, { [g.etapaId]: !e.target.checked }),
                      }))} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: INS.grafite }}>{g.nome}</span>
                    <span style={{ fontSize: 12, color: INS.inkSoft }}>{g.quantos} {g.quantos === 1 ? "insumo" : "insumos"}</span>
                  </label>
                  <div style={{ fontSize: 11.5, color: INS.inkSoft, marginTop: 3, marginLeft: 24,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: dentro ? 1 : 0.45 }}>
                    {g.itens.slice(0, 4).map(function (x) { return x.nome; }).join(" · ")}
                    {g.quantos > 4 ? " · …" : ""}
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
              <button style={INS_S.btnSec} onClick={() => setSugestao(null)}>Cancelar</button>
              <button style={INS_S.btn} onClick={aplicarSugestoes}>Aplicar</button>
            </div>
          </div>
        )}

        {(() => {
          var chaves = Object.keys(marcados).filter(function (k) { return marcados[k]; });
          if (!chaves.length || !perm.podeEditar) return null;
          return (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
              padding: "10px 12px", marginBottom: 12, borderRadius: 12,
              border: "1px solid #0474f4", background: "#eef5ff" }}>
              <span style={{ fontSize: 12.5, color: "#0474f4", fontWeight: 600 }}>
                {chaves.length === 1 ? "1 selecionado" : chaves.length + " selecionados"}
              </span>
              <span style={{ fontSize: 12.5, color: "#4b5563" }}>Etapa padrão:</span>
              <SelectBusca style={Object.assign({}, INS_S.input, { width: "auto", minWidth: 220 })}
                value={etapaLote} onChange={v => setEtapaLote(v)} placeholder="Procurar etapa…"
                opcoes={[{ valor: "", rotulo: "— tirar a etapa —" }].concat(
                  (typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : []).map(function (et) {
                    return { valor: et.id, rotulo: et.nome, grupo: et.macro || "" };
                  }))} />
              <button style={INS_S.btn} onClick={aplicarEtapaEmLote}>Aplicar</button>
              <button style={INS_S.btnGhost} onClick={() => setMarcados({})}>Limpar seleção</button>
            </div>
          );
        })()}

        {filtrados.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: "#6b7280", fontSize: 12.5, border: "1px dashed rgba(38,36,33,0.18)", borderRadius: 16, background: "#fff" }}>
            {insumos.length === 0 ? "Nenhum insumo cadastrado ainda." : "Nenhum insumo com esses filtros."}
          </div>
        ) : (
          <div style={{ background: "#fff", border: INS.borda, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: isMobile ? 0 : 720 }}>
                <thead>
                  <tr style={{ background: "#f7f7f8", color: "#4b5563", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left" }}>
                    {perm.podeEditar && (
                      <th style={{ padding: "10px 8px", width: 34 }}>
                        <input type="checkbox" title="Marcar todos os filtrados"
                          checked={filtrados.length > 0 && filtrados.every(function (x) { return marcados[x.i.id || x.i.codigo]; })}
                          onChange={e => {
                            var novo = Object.assign({}, marcados);
                            filtrados.forEach(function (x) { novo[x.i.id || x.i.codigo] = e.target.checked; });
                            setMarcados(novo);
                          }} />
                      </th>
                    )}
                    <th style={{ padding: "10px 12px", fontWeight: 600 }}>Código</th>
                    <th style={{ padding: "10px 12px", fontWeight: 600 }}>Insumo</th>
                    {!isMobile && <th style={{ padding: "10px 12px", fontWeight: 600 }}>Grupo</th>}
                    {!isMobile && <th style={{ padding: "10px 12px", fontWeight: 600 }}>Etapa padrão</th>}
                    {!isMobile && <th style={{ padding: "10px 12px", fontWeight: 600 }}>Un.</th>}
                    <th style={{ padding: "10px 12px", fontWeight: 600, textAlign: "right" }}>Preço</th>
                    {!isMobile && <th style={{ padding: "10px 12px", fontWeight: 600 }}>Base</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(function (x) {
                    return (
                      <tr key={x.i.id || x.i.codigo}
                        onClick={() => { setSel(x.i); setView("detalhe"); }}
                        style={{ borderTop: "1px solid #f3f4f6", cursor: "pointer", opacity: x.i.ativo === false ? 0.5 : 1 }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#fafafa"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                        {perm.podeEditar && (
                          <td style={{ padding: "10px 8px" }} onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={!!marcados[x.i.id || x.i.codigo]}
                              onChange={e => setMarcados(Object.assign({}, marcados, { [x.i.id || x.i.codigo]: e.target.checked }))} />
                          </td>
                        )}
                        <td style={{ padding: "10px 12px", fontFamily: "ui-monospace, monospace", fontSize: 11.5, color: INS.inkSoft, whiteSpace: "nowrap" }}>{x.i.codigo || "—"}</td>
                        <td style={{ padding: "10px 12px", color: INS.grafite, fontWeight: 500 }}>
                          {x.i.nome}
                          {x.i.precoPendente && <span style={{ marginLeft: 8, fontSize: 11, color: "#b45309", fontWeight: 600 }}>
                            · {x.i.precoPendente.motivo === "unidade" ? "unidade" : "confirmar"}</span>}
                        </td>
                        {!isMobile && <td style={{ padding: "10px 12px", color: "#4b5563" }}>{x.i.grupo}</td>}
                        {!isMobile && (
                          <td style={{ padding: "10px 12px", color: x.i.etapaPadrao ? "#111827" : "#9ca3af" }}>
                            {(function () {
                              if (!x.i.etapaPadrao) return "—";
                              var et = (typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : [])
                                .find(function (e) { return e.id === x.i.etapaPadrao; });
                              return et ? et.nome : x.i.etapaPadrao;
                            })()}
                          </td>
                        )}
                        {!isMobile && <td style={{ padding: "10px 12px", color: "#4b5563" }}>{x.i.unidade}</td>}
                        <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: INS.grafite, whiteSpace: "nowrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, justifyContent: "flex-end" }}>
                            <PontoConfianca conf={x.p.confianca} />
                            {fmtBRLIns(x.p.preco)}
                          </span>
                        </td>
                        {!isMobile && (
                          <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 11.5, whiteSpace: "nowrap" }}>
                            {fmtDataIns(x.i.precoData)}{x.p.corrigido ? " ×" + x.p.fator : ""}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 14, lineHeight: 1.6 }}>
          O preço com 12 meses ou mais é corrigido pelo INCC automaticamente. Definir um preço à mão congela o valor:
          nenhuma compra passa por cima dele.
        </div>
      </div>
    </div>
  );
}
