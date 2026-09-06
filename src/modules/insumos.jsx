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

/**
 * Atualiza o preço de referência a partir de um lançamento de compra.
 * Pura: recebe insumo + lançamento, devolve insumo novo (ou o mesmo).
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

  var ref = insumo.precoReferencia;
  if (ref > 0) {
    var razao = unitario / ref;
    if (razao > INSUMO_FATOR_SUSPEITO || razao < 1 / INSUMO_FATOR_SUSPEITO) {
      return Object.assign({}, insumo, {
        precoPendente: { valor: unitario, data: data, lancamentoId: lancamento.id || null },
      });
    }
  }

  // Nota retroativa não rebaixa preço mais novo.
  if (insumo.precoData && data && data < insumo.precoData) return insumo;

  return Object.assign({}, insumo, {
    precoReferencia: unitario,
    ultimoPreco: unitario, // campo legado — o importador de NF ainda lê
    precoFonte: "compra",
    precoData: data,
    precoNCompras: (insumo.precoNCompras || 0) + 1,
    precoFatorInccAplicado: 1,
    precoPendente: null,
    precoAtualizadoEm: new Date().toISOString(),
  });
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
// UI
// ═══════════════════════════════════════════════════════════════

var INS = {
  fundo: "#fafafb", grafite: "#1a1a1a", cobre: "#b5652f", azul: "#1e3a5f",
  inkSoft: "#78716c", borda: "1.5px solid rgba(38,36,33,0.16)",
};
var INS_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

var INS_S = {
  input: { border: INS.borda, borderRadius: 12, padding: "9px 12px", fontSize: 13, color: "#262421", outline: "none", background: "#fff", fontFamily: "inherit", width: "100%", boxSizing: "border-box" },
  label: { fontSize: 12, color: "#6b7280", fontWeight: 500, display: "block", marginBottom: 5 },
  btn: { background: "#262421", color: "#fff", border: "none", borderRadius: 12, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  btnSec: { background: "#fff", color: "#374151", border: INS.borda, borderRadius: 12, padding: "9px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" },
  btnGhost: { background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontFamily: "inherit", fontSize: 13 },
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
          <select style={Object.assign({}, INS_S.input, { cursor: "pointer" })} value={f.grupo} onChange={e => set("grupo", e.target.value)}>
            {INSUMO_GRUPOS.map(g => <option key={g.prefixo} value={g.nome}>{g.nome} ({g.prefixo})</option>)}
          </select>
        </div>
        <div>
          <label style={INS_S.label}>Unidade</label>
          <select style={Object.assign({}, INS_S.input, { cursor: "pointer" })} value={f.unidade} onChange={e => set("unidade", e.target.value)}>
            {INSUMO_UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label style={INS_S.label}>Tipo</label>
          <select style={Object.assign({}, INS_S.input, { cursor: "pointer" })} value={f.tipo} onChange={e => set("tipo", e.target.value)}>
            <option value="material">Material</option>
            <option value="prestador">Prestador de serviço</option>
          </select>
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
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
            </span>
          ))}
          {!(f.aliases || []).length && <span style={{ fontSize: 12, color: "#9ca3af" }}>Nenhum ainda — o nome principal é usado.</span>}
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

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151", marginBottom: 18, cursor: "pointer" }}>
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

  var compras = (data.lancamentos || [])
    .filter(l => l.insumoCodigo === insumo.codigo)
    .map(l => ({
      data: l.dataPagamento || l.data,
      qtd: Number(l.quantidade) || 0,
      total: Number(l.total != null ? l.total : l.valor) || 0,
      fornecedorId: l.fornecedorId,
    }))
    .filter(c => c.qtd > 0 && c.total > 0 && c.data)
    .map(c => Object.assign(c, { unitario: c.total / c.qtd }))
    .sort((a, b) => String(a.data).localeCompare(String(b.data)));

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
            <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Preço</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: INS.grafite, display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
              <PontoConfianca conf={p.confianca} tamanho={9} />{fmtBRLIns(p.preco)}
            </div>
            <div style={{ fontSize: 11, color: conf.cor, fontWeight: 600 }}>{conf.label}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Origem</div>
            <div style={{ fontSize: 13, color: "#374151", marginTop: 6 }}>
              {insumo.precoManual != null ? "Definido à mão"
                : insumo.precoFonte === "compra" ? "Última compra"
                : insumo.precoFonte === "compra_corrigida" ? "Compra corrigida"
                : insumo.precoFonte === "cotacao" ? "Cotação interna"
                : insumo.precoFonte === "mercado" ? "Referência de mercado"
                : "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Data base</div>
            <div style={{ fontSize: 13, color: "#374151", marginTop: 6 }}>{fmtDataIns(insumo.precoData)}</div>
            {p.corrigido && <div style={{ fontSize: 11, color: INS.inkSoft }}>corrigido ×{p.fator}</div>}
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Compras</div>
            <div style={{ fontSize: 13, color: "#374151", marginTop: 6 }}>{insumo.precoNCompras || 0}</div>
          </div>
        </div>

        {insumo.observacao && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(38,36,33,0.08)", fontSize: 12.5, color: "#4b5563", lineHeight: 1.5 }}>
            {insumo.observacao}
          </div>
        )}
      </div>

      {insumo.precoPendente && (
        <div style={{ border: "1.5px solid #f59e0b", background: "#fffbeb", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>Compra fora da faixa esperada</div>
          <div style={{ fontSize: 12.5, color: "#78350f", marginBottom: 12 }}>
            Uma compra de {fmtDataIns(insumo.precoPendente.data)} registrou {fmtBRLIns(insumo.precoPendente.valor)},
            muito distante do preço atual de {fmtBRLIns(p.preco)}. O preço não foi alterado.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={INS_S.btn} onClick={onAceitarPendente}>Aceitar como novo preço</button>
            <button style={INS_S.btnSec} onClick={onDescartarPendente}>Descartar</button>
          </div>
        </div>
      )}

      <div style={Object.assign({}, INS_S.card, { marginBottom: 16 })}>
        <div style={{ fontSize: 13, fontWeight: 700, color: INS.grafite, marginBottom: 12 }}>
          Histórico de compras {compras.length ? `(${compras.length})` : ""}
        </div>
        {!compras.length ? (
          <div style={{ fontSize: 12.5, color: "#9ca3af" }}>
            Nenhuma compra vinculada a este insumo ainda. O histórico se forma conforme as notas são lançadas nas obras.
          </div>
        ) : (
          <div>
            <GraficoPrecoInsumo compras={compras} />
            <div style={{ overflowX: "auto", marginTop: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#9ca3af", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    <th style={{ padding: "6px 8px" }}>Data</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Qtd</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Total</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Unitário</th>
                  </tr>
                </thead>
                <tbody>
                  {compras.slice().reverse().map((c, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "7px 8px" }}>{fmtDataIns(c.data)}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.qtd}</td>
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
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
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
    var r = resolverInsumo(nome, insumos);
    if (!r.insumo) return { cor: "#b45309", texto: "não está em Insumos" };
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
      </div>

      {aba === "pontos" && (
        <div style={INS_S.card}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
              <thead><tr style={{ textAlign: "left", color: "#9ca3af", fontSize: 10.5, textTransform: "uppercase" }}>
                <th style={{ padding: "6px 8px" }}>Cômodo</th>
                {pontosDef.map(function (p) { return <th key={p.id} style={{ padding: "6px 8px", textAlign: "right" }}>{p.nome}</th>; })}
              </tr></thead>
              <tbody>
                {tipos.map(function (t) {
                  var pt = pontosDe(t);
                  return (
                    <tr key={t.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "6px 8px", color: "#262421" }}>{t.nome}</td>
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
          <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 8 }}>Por unidade de cômodo. Cada ponto vira o kit correspondente (aba Kits → Elétrica). Circuitos: 1 disjuntor 10A a cada 8 pontos de luz e 1 de 20A a cada 6 tomadas gerais, calculados pelo motor.</div>
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
                    <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 8 }}>{kit.base === "ponto" ? "por ponto" : kit.base === "obra" ? "por obra" : "por ambiente"} · {kit.itens.length} itens · {kit.editado ? "editado pelo escritório" : kit.fonte}</span>
                  </span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{ab ? "▲" : "▼"}</span>
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
          {!ids.length && <div style={{ fontSize: 12.5, color: "#6b7280" }}>Nenhum kit nesta disciplina.</div>}
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
  var [semeando, setSemeando] = useState(false);

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
  }, [enriquecidos, busca, filtroGrupo, filtroConf]);

  var resumo = useMemo(function () {
    var r = { total: enriquecidos.length, alta: 0, media: 0, baixa: 0, obsoleta: 0, sem_preco: 0, manual: 0, pendentes: 0 };
    enriquecidos.forEach(function (x) {
      if (r[x.p.confianca] != null) r[x.p.confianca]++;
      if (x.i.precoPendente) r.pendentes++;
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
      return Object.assign({}, x, {
        precoReferencia: insumo.precoPendente.valor,
        ultimoPreco: insumo.precoPendente.valor,
        precoFonte: "compra",
        precoData: insumo.precoPendente.data,
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
            <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 12 }}>
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
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          <input style={INS_S.input} placeholder="Buscar por nome, código ou apelido…" value={busca} onChange={e => setBusca(e.target.value)} />
          <select style={Object.assign({}, INS_S.input, { cursor: "pointer" })} value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)}>
            <option value="">Todos os grupos</option>
            {INSUMO_GRUPOS.map(g => <option key={g.prefixo} value={g.nome}>{g.nome}</option>)}
          </select>
          <select style={Object.assign({}, INS_S.input, { cursor: "pointer" })} value={filtroConf} onChange={e => setFiltroConf(e.target.value)}>
            <option value="">Qualquer preço</option>
            <option value="alta">Atual</option>
            <option value="media">Recente</option>
            <option value="baixa">Antigo</option>
            <option value="obsoleta">Obsoleto</option>
            <option value="sem_preco">Sem preço</option>
            <option value="manual">Definido à mão</option>
          </select>
        </div>

        {filtrados.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: "#9ca3af", fontSize: 12.5, border: "1px dashed rgba(38,36,33,0.18)", borderRadius: 16, background: "#fff" }}>
            {insumos.length === 0 ? "Nenhum insumo cadastrado ainda." : "Nenhum insumo com esses filtros."}
          </div>
        ) : (
          <div style={{ background: "#fff", border: INS.borda, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: isMobile ? 0 : 720 }}>
                <thead>
                  <tr style={{ background: "#f7f7f8", color: "#6b7280", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left" }}>
                    <th style={{ padding: "10px 12px", fontWeight: 600 }}>Código</th>
                    <th style={{ padding: "10px 12px", fontWeight: 600 }}>Insumo</th>
                    {!isMobile && <th style={{ padding: "10px 12px", fontWeight: 600 }}>Grupo</th>}
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
                        <td style={{ padding: "10px 12px", fontFamily: "ui-monospace, monospace", fontSize: 11.5, color: INS.inkSoft, whiteSpace: "nowrap" }}>{x.i.codigo || "—"}</td>
                        <td style={{ padding: "10px 12px", color: INS.grafite, fontWeight: 500 }}>
                          {x.i.nome}
                          {x.i.precoPendente && <span style={{ marginLeft: 8, fontSize: 11, color: "#b45309", fontWeight: 600 }}>· confirmar</span>}
                        </td>
                        {!isMobile && <td style={{ padding: "10px 12px", color: "#6b7280" }}>{x.i.grupo}</td>}
                        {!isMobile && <td style={{ padding: "10px 12px", color: "#6b7280" }}>{x.i.unidade}</td>}
                        <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: INS.grafite, whiteSpace: "nowrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, justifyContent: "flex-end" }}>
                            <PontoConfianca conf={x.p.confianca} />
                            {fmtBRLIns(x.p.preco)}
                          </span>
                        </td>
                        {!isMobile && (
                          <td style={{ padding: "10px 12px", color: "#9ca3af", fontSize: 11.5, whiteSpace: "nowrap" }}>
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

        <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 14, lineHeight: 1.6 }}>
          O preço com 12 meses ou mais é corrigido pelo INCC automaticamente. Definir um preço à mão congela o valor:
          nenhuma compra passa por cima dele.
        </div>
      </div>
    </div>
  );
}
