// ═══════════════════════════════════════════════════════════════
// ORCAMENTO-OBRA — Motor de quantitativos de obra
// ═══════════════════════════════════════════════════════════════
// Transcrição do motor VBA original em docs/referencia-orcamento/vba/, que
// roda em produção numa planilha Excel. O .bas é a fonte de verdade das
// fórmulas — esta spec (docs/SPEC-ORCAMENTO-OBRA.md) diz como estruturar,
// mas onde ela divergir do .bas, o .bas vence (ver notas de divergência
// espalhadas abaixo, junto de cada função onde isso importou).
//
// Entrega atual (§10, passos 1 e 2 da spec): esqueleto + taxonomia +
// 3 módulos-piloto (paredesTerreo, pintura, prestadores), que fixam o padrão
// de transcrição pro resto do "caminho da casa" (passos 3-5, ainda não
// feitos). NÃO tem UI ainda (passo 6).
//
// Registrado em combine.js depois de "obra-financeiro.jsx" e antes de
// "clientes.jsx" — não logo depois de "outros.jsx" como a spec sugere
// literalmente, porque obra-financeiro.jsx já ocupa esse lugar e o §6 desta
// spec pede pra este módulo importar ETAPAS_OBRA de lá quando a ponte com o
// P&L for implementada; isso exige que obra-financeiro.jsx apareça antes no
// arquivo concatenado. Ainda não usamos ETAPAS_OBRA aqui (fica pro passo 6).
// ═══════════════════════════════════════════════════════════════

// ── Constantes globais (Z_DECLARAR_VARIAVEIS.bas) ──
const PERDA = 1.1; // 10% de perda, aplicado em toda linha onde o VBA a tem
const BARRA_FERRO_MTS = 12; // metros → barras: ceil(mts / 12 * 1.1)

const PESOS_FERRO = {
  CA60_4MM: 1.31,
  CA50_5MM: 1.92,
  CA50_6MM: 3.00,
  CA50_8MM: 4.80,
  CA50_10MM: 7.56,
  CA50_12MM: 11.56,
  CA50_16MM: 18.94,
  CA60_5MM: 1.92,
};

// Ordem das etapas (campo `ordem` de cada linha emitida), de Z_DECLARAR_VARIAVEIS.bas
const ORD = {
  prestadores: 0,
  instalacoes: 1,
  fundacao: 2,
  esgotoPluvial: 3,
  contrapisoInterno: 4,
  paredesTerreo: 5,
  vigaLajeTerreo: 6,
  paredesPav1: 7,
  vigaLajePav1: 8,
  supraCobertura: 9,
  cobertura: 10,
  reboco: 11,
  pintura: 12,
  contrapisoExterno: 13,
  muroDivisa: 14,
  muroArrimo: 15,
  piscina: 16,
  esquadrias: 17,
  itensProjeto: 18, // hidráulica, esgoto, elétrica, louças, aquecimento — lidos do projeto de engenharia (18–24)
  pisos: 25,        // pisos e revestimentos (módulo novo, sem equivalente no VBA)
};

// ── Classificação geral da obra (bloco "Geral" do formulário) ──
// tipoObra e padrao ficam no projeto e valem para todos os módulos: o padrão
// escolhe os kits "_ALTO" das instalações (Alto e Altíssimo) e, adiante,
// vai calibrar acabamentos; reforma ainda não altera o cálculo (registrado
// para as próximas entregas). temPiscina desliga o bloco e os prestadores
// da piscina quando a obra não tem uma.
const TIPOS_OBRA = [{ value: "nova", label: "Construção nova" }, { value: "reforma", label: "Reforma" }];
const PADROES_OBRA = ["MCMV", "Baixo", "Médio", "Alto", "Altíssimo"];
function padraoInstalacoes(padrao) { return padrao === "Alto" || padrao === "Altíssimo" ? "Alto" : "Médio"; }

// ── Preço — placeholder nesta entrega (§3.4) ──
// Preço de um item do orçamento: resolve no catálogo de Insumos (insumos.jsx,
// que vem antes no bundle) pelo nome emitido — nome, alias ou código — e
// devolve o preço já envelhecido pelo INCC via precoInsumo(). Sem catálogo
// ou sem cadastro → preco null (o item entra com total 0 e é listado em
// "preços que merecem atenção"), nunca um chute.
function precoDoInsumo(nomeItem, data, opts) {
  const lista = data && Array.isArray(data.materiais) ? data.materiais : [];
  if (typeof resolverInsumo !== "function" || typeof precoInsumo !== "function" || !lista.length) {
    return { preco: null, confianca: "sem_catalogo", codigo: null };
  }
  const r = resolverInsumo(nomeItem, lista, opts && opts.codigo ? { codigo: opts.codigo } : undefined);
  if (!r || !r.insumo) return { preco: null, confianca: "sem_insumo", codigo: null, candidatos: r ? r.candidatos : [] };
  const p = precoInsumo(r.insumo);
  return { preco: p.preco, confianca: p.confianca, codigo: r.insumo.codigo, meses: p.meses, corrigido: p.corrigido, insumo: r.insumo };
}

// ── Helper de emissão, usado por todo módulo de cálculo (§4) ──
function emitir(out, { ordem, item, tipo, etapa, subEtapa, unidade, qtd, preco, composicao, confianca, insumoCodigo }) {
  if (!qtd || qtd === 0) return; // regra do VBA: só emite se qtd ≠ 0
  const linha = { ordem, item, tipo, etapa, subEtapa, unidade, qtd: Number(qtd), preco: preco ?? null };
  if (composicao) linha.composicao = composicao; // item composto (esquadria): o que forma o preço unitário
  if (confianca) linha.confianca = confianca;
  if (insumoCodigo) linha.insumoCodigo = insumoCodigo;
  out.push(linha);
}

// Campo ausente vira 0, nunca NaN/undefined (regra 5 da §4 — equivalente ao
// `On Error Resume Next` do VBA quando uma célula CP_* está vazia).
function numOrZero(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

// ── Helpers de ferro, compartilhados por todos os módulos que somam barras
// por elemento estrutural (fundação, colunas, arrimo, piscina, cobertura) ──
function normalizarFerro(obj) {
  const o = obj || {};
  const out = {};
  for (const k of Object.keys(PESOS_FERRO)) out[k] = numOrZero(o[k]);
  return out;
}
function somarFerro(...objs) {
  const out = {};
  for (const k of Object.keys(PESOS_FERRO)) {
    out[k] = objs.reduce((acc, o) => acc + numOrZero(o && o[k]), 0);
  }
  return out;
}
function barrasPorBitola(somaPorBitola) {
  const out = {};
  for (const k of Object.keys(PESOS_FERRO)) {
    out[k] = Math.ceil(numOrZero(somaPorBitola[k]) / BARRA_FERRO_MTS * PERDA);
  }
  return out;
}
function pesoTotalFerro(barras) {
  return Object.keys(PESOS_FERRO).reduce((acc, k) => acc + numOrZero(barras[k]) * PESOS_FERRO[k], 0);
}
function somaN(...vals) {
  return vals.reduce((acc, v) => acc + numOrZero(v), 0);
}

const LABEL_BARRA = {
  CA60_4MM: "Aço - Barras de CA60 4.2mm 12mts",
  CA50_5MM: "Aço - Barras de CA50 5.0mm 12mts",
  CA50_6MM: "Aço - Barras de CA50 6.3mm 12mts",
  CA50_8MM: "Aço - Barras de CA50 8.0mm 12mts",
  CA50_10MM: "Aço - Barras de CA50 10.0mm 12mts",
  CA50_12MM: "Aço - Barras de CA50 12.5mm 12mts",
  CA50_16MM: "Aço - Barras de CA50 16mm 12mts",
  CA60_5MM: "Aço - Barras de CA60 5.0mm 12mts",
};
// Emite as 8 bitolas padrão, na ordem do PESOS_FERRO — usado pelos módulos
// que apenas somam elementos e emitem o conjunto completo (fundação, arrimo,
// piscina). Módulos com bitolas ausentes/tratamento especial (paredesTerreo,
// paredesPav1, supraCobertura) emitem manualmente, sem este helper.
function emitBarras(out, base, barras) {
  for (const k of Object.keys(PESOS_FERRO)) {
    emitir(out, { ...base, item: LABEL_BARRA[k], unidade: "Barras 12mts", qtd: barras[k] });
  }
}

// ═══════════════════════════════════════════════════════════════
// §5 — Prestadores: o único bloco com preço real (PRESTADORES.frm)
// ═══════════════════════════════════════════════════════════════

// Taxas com cálculo padrão (taxa × base). "Gestão de obra" fica fora daqui
// porque tem a própria escada regressiva (taxaGestaoObra, abaixo). Os demais
// itens que P_PRESTADORES.bas emite — Carpinteiro, Impermeabilizador,
// Instalador AR, Marceneiro Portas Internas, Serralheiro — não têm taxa
// padrão nenhuma no PRESTADORES.frm: são 100% valor digitado pelo usuário,
// tratados à parte dentro de prestadores().
const TAXAS_PRESTADORES = {
  equipePedreiros:        { base: "areaConstruida",   valor: 1000 }, // R$/m²
  pintor:                 { base: "areaConstruida",   valor: 100  },
  eletricista:            { base: "areaConstruida",   valor: 80   },
  encanador:              { base: "areaConstruida",   valor: 60   },
  pavimentacaoExterna:    { base: "areaPavimentacao", valor: 120  },
  muroDivisa:             { base: "m2MuroDivisa",     valor: 130  },
  muroArrimo:             { base: "m2MuroArrimo",     valor: 250  },
  pedreirosPiscina:       { base: "areaPiscina",      valor: 1000 },
  terraplanagem:          { base: "fixo",             valor: 8000 },
  instaladorAquecedores:  { base: "fixo",             valor: 2000 },
  instaladorEquipPiscina: { base: "fixo",             valor: 5000 },
};

// Gestão de obra: taxa REGRESSIVA por área construída (quanto maior a obra,
// menor o R$/m²). O PRESTADORES.frm implementa isso como uma cascata de
// `If area < N Then preco = X` sem ElseIf, que se sobrescreve sequencialmente
// — o resultado líquido dessa cascata é exatamente esta tabela (conferido à
// mão contra o .frm para 200, 250, 300, 350, 400, 450 e 500 m²).
function taxaGestaoObra(areaConstruida) {
  if (areaConstruida > 450) return 430;
  if (areaConstruida < 201) return 550;
  if (areaConstruida < 251) return 530;
  if (areaConstruida < 301) return 510;
  if (areaConstruida < 351) return 490;
  if (areaConstruida < 401) return 470;
  return 450; // 401–450 m²
}

// Valor "sugerido" (default) de um prestador com taxa padrão — o que o
// PRESTADORES.frm calcula quando o campo do usuário está vazio/zerado.
// Nome do insumo (tipo "prestador") que guarda a taxa de cada chave.
const INSUMO_PRESTADOR = {
  equipePedreiros: "Pedreiros Casa", pintor: "Pintor", eletricista: "Eletricista", encanador: "Encanador",
  pavimentacaoExterna: "Pedreiros Pavim. Externa", muroDivisa: "Pedreiros Muro Divisa", muroArrimo: "Pedreiros Muro Arrimo",
  pedreirosPiscina: "Pedreiros Piscina", terraplanagem: "Terraplanagem", instaladorAquecedores: "Instalador Aquecedores",
  instaladorEquipPiscina: "Instalador Equip. Piscina", carpinteiro: "Carpinteiro", impermeabilizador: "Impermeabilizador",
  marceneiroPortas: "Marceneiro Portas Internas", serralheiro: "Serralheiro",
};

// Taxa de um prestador: o catálogo de Insumos vence (é onde o escritório
// gerencia preço); sem cadastro ou sem preço, vale a taxa do VBA.
function taxaPrestador(chave, data) {
  const nome = INSUMO_PRESTADOR[chave];
  if (nome) {
    const r = precoDoInsumo(nome, data);
    if (r.preco != null && r.preco > 0) return { valor: r.preco, fonte: "insumo", confianca: r.confianca };
  }
  const t = TAXAS_PRESTADORES[chave];
  return t ? { valor: t.valor, fonte: "vba", confianca: "modulo" } : null;
}

function valorPadraoPrestador(chave, cp, data) {
  const t = TAXAS_PRESTADORES[chave];
  const taxa = taxaPrestador(chave, data);
  if (!taxa || !(taxa.valor > 0)) return 0;
  const base = t ? t.base : "areaConstruida";
  switch (base) {
    case "areaConstruida": return cp.areaConstruida * taxa.valor;
    case "areaPavimentacao": return cp.pavimentacaoExterna * taxa.valor;
    case "m2MuroDivisa": return cp.comprimentoMuroDivisa * cp.alturaMuroDivisa * taxa.valor;
    case "m2MuroArrimo": return cp.comprimentoArrimo * cp.alturaArrimo * taxa.valor;
    case "areaPiscina": return cp.areaConstruidaPiscina * taxa.valor;
    case "fixo": return taxa.valor;
    default: return 0;
  }
}

// Valor final de um prestador com taxa padrão: override do usuário
// (projeto.prestadores.<chave>) se não-zero, senão o valor sugerido —
// exatamente o `If ... = 0 Or ... = "" Then <default>` do PRESTADORES.frm.
// Prestadores que o VBA emitia "só com valor" (qtd = valor, sem preço):
// impermeabilizador, marceneiro, serralheiro. Agora: valor digitado → 1 verba
// com esse preço; sem valor digitado → taxa do catálogo × área construída.
function emitirPrestadorVerba(out, base, item, chave, cp, data) {
  const digitado = numOrZero(cp.prestadores && cp.prestadores[chave]);
  if (digitado !== 0) {
    emitir(out, { ...base, item, unidade: "Verba", qtd: 1, preco: digitado });
    return;
  }
  const taxa = taxaPrestador(chave, data);
  if (taxa && taxa.valor > 0 && cp.areaConstruida > 0) {
    emitir(out, { ...base, item, unidade: "m2", qtd: cp.areaConstruida, preco: taxa.valor, confianca: taxa.confianca });
  }
}

function valorPrestador(chave, cp, data) {
  const override = numOrZero(cp.prestadores && cp.prestadores[chave]);
  return override !== 0 ? override : valorPadraoPrestador(chave, cp, data);
}

// P_PRESTADORES.bas: lê os CALC_PRESTADORES_* (já resolvidos pelo
// PRESTADORES.frm, com default aplicado quando o usuário deixou vazio) e
// emite uma linha por prestador. Preço/qtd por item:
// - itens "por m²" (pedreiros, eletricista, encanador, pintor, gestão,
//   pavimentação, muros, piscina): qtd = base em m², preco = valor / qtd.
// - itens "valor fixo" (terraplanagem, instalador aquecedores, instalador
//   equip. piscina): qtd = 1, preco = valor.
// - itens sem taxa padrão (impermeabilizador, marceneiro, serralheiro):
//   só têm um valor digitado, sem qtd/preco separados — qtd = valor.
function prestadores(cp, out, data) {
  const base = {
    ordem: ORD.prestadores,
    tipo: "Prestadores de serviços",
    etapa: "Prestadores de serviços",
    subEtapa: "Prestadores de serviços",
  };

  const valorPedreiros = valorPrestador("equipePedreiros", cp, data);
  emitir(out, { ...base, item: "Pedreiros Casa", unidade: "m2", qtd: cp.areaConstruida, preco: valorPedreiros / cp.areaConstruida });

  const valorEletricista = valorPrestador("eletricista", cp, data);
  emitir(out, { ...base, item: "Eletricista", unidade: "m2", qtd: cp.areaConstruida, preco: valorEletricista / cp.areaConstruida });

  const valorEncanador = valorPrestador("encanador", cp, data);
  emitir(out, { ...base, item: "Encanador", unidade: "m2", qtd: cp.areaConstruida, preco: valorEncanador / cp.areaConstruida });

  const valorPintor = valorPrestador("pintor", cp, data);
  emitir(out, { ...base, item: "Pintor", unidade: "m2", qtd: cp.areaConstruida, preco: valorPintor / cp.areaConstruida });

  // Carpinteiro: base é a área TOTAL de cobertura (CALC_AREA_COBERTURA_TOTAL
  // no .bas), não a área construída — ainda 0 aqui porque cobertura() é um
  // módulo futuro (passo 4 da spec, §10). Sem taxa padrão no .frm.
  const valorCarpinteiro = numOrZero(cp.prestadores && cp.prestadores.carpinteiro) || valorPadraoPrestador("carpinteiro", cp, data);
  if (cp.areaCoberturaTotal > 0) emitir(out, { ...base, item: "Carpinteiro", unidade: "m2", qtd: cp.areaCoberturaTotal, preco: valorCarpinteiro / cp.areaCoberturaTotal });

  // Sem taxa padrão no .frm — só o valor digitado.
  emitirPrestadorVerba(out, base, "Impermeabilizador", "impermeabilizador", cp, data);

  // [BUG VBA — divergência com a spec §4.4, reportada e preservada]
  // P_PRESTADORES.bas testa `If CCALC_PRESTADORES_INSTALADOR_AR <> 0` — note
  // o "CCALC" com C duplicado. Essa variável nunca é declarada nem
  // preenchida em lugar nenhum do módulo (a de verdade, usada dentro do
  // bloco, é CALC_PRESTADORES_INSTALADOR_AR, sem o C extra). Em VBA, uma
  // Variant implícita nunca atribuída vale Empty, e `Empty <> 0` avalia como
  // False — então essa condição nunca é verdadeira e a linha "Instalador AR"
  // JAMAIS é emitida na planilha real, não importa o que o usuário digite.
  // Preservado de propósito (dead code fiel ao original); não corrigido
  // nesta entrega — reportado ao usuário como possível bug do VBA original.
  // (nenhuma chamada a emitir() aqui, de propósito)

  // Sem taxa padrão no .frm — só o valor digitado.
  emitirPrestadorVerba(out, base, "Marceneiro Portas Internas", "marceneiroPortas", cp, data);

  const valorGestao = (() => {
    const override = numOrZero(cp.prestadores && cp.prestadores.gestaoObra);
    return override !== 0 ? override : taxaGestaoObra(cp.areaConstruida) * cp.areaConstruida;
  })();
  emitir(out, { ...base, item: "Gestão Obra", unidade: "m2", qtd: cp.areaConstruida, preco: valorGestao / cp.areaConstruida });

  // [VBA] emitia sempre; aqui só quando a obra tem piscina (campo "Piscina" do bloco Geral).
  if (cp.temPiscina !== false) {
    const valorInstaladorEquipPiscina = valorPrestador("instaladorEquipPiscina", cp, data);
    emitir(out, { ...base, item: "Instalador Equip. Piscina", unidade: "Unidades", qtd: 1, preco: valorInstaladorEquipPiscina });
  }

  const valorPedreirosPiscina = valorPrestador("pedreirosPiscina", cp, data);
  emitir(out, { ...base, item: "Pedreiros Piscina", unidade: "m2", qtd: cp.areaConstruidaPiscina, preco: valorPedreirosPiscina / cp.areaConstruidaPiscina });

  const valorMuroArrimo = valorPrestador("muroArrimo", cp, data);
  const baseMuroArrimo = cp.alturaArrimo * cp.comprimentoArrimo;
  emitir(out, { ...base, item: "Pedreiros Muro Arrimo", unidade: "m2", qtd: baseMuroArrimo, preco: valorMuroArrimo / baseMuroArrimo });

  const valorMuroDivisa = valorPrestador("muroDivisa", cp, data);
  const baseMuroDivisa = cp.comprimentoMuroDivisa * cp.alturaMuroDivisa;
  emitir(out, { ...base, item: "Pedreiros Muro Divisa", unidade: "m2", qtd: baseMuroDivisa, preco: valorMuroDivisa / baseMuroDivisa });

  const valorPavimentacaoExterna = valorPrestador("pavimentacaoExterna", cp, data);
  emitir(out, { ...base, item: "Pedreiros Pavim. Externa", unidade: "m2", qtd: cp.pavimentacaoExterna, preco: valorPavimentacaoExterna / cp.pavimentacaoExterna });

  const valorTerraplanagem = valorPrestador("terraplanagem", cp, data);
  emitir(out, { ...base, item: "Terraplanagem", unidade: "Unidades", qtd: 1, preco: valorTerraplanagem });

  const valorInstaladorAquecedores = valorPrestador("instaladorAquecedores", cp, data);
  emitir(out, { ...base, item: "Instalador Aquecedores", unidade: "Unidades", qtd: 1, preco: valorInstaladorAquecedores });

  // Sem taxa padrão no .frm — só o valor digitado.
  emitirPrestadorVerba(out, base, "Serralheiro", "serralheiro", cp, data);
}

// ═══════════════════════════════════════════════════════════════
// F_PAREDES_TERREO.bas — paredes e colunas do pavimento térreo
// ═══════════════════════════════════════════════════════════════
function paredesTerreo(cp, out) {
  const tijolos6F = Math.ceil(cp.m2Paredes20Terreo * 40 * PERDA);
  const tijolos8F = Math.ceil((cp.m2Paredes25Terreo * 40 + cp.m2Paredes15Terreo * 20) * PERDA);
  // [VBA] aqui o *1.1 já está embutido em cada parcela — não há um *PERDA
  // extra por fora da soma, exatamente como no .bas.
  const areiaFinaAssent = Math.ceil(tijolos6F * 0.001638 * PERDA + tijolos8F * 0.002223 * PERDA);
  const vedalitFinaAssent = Math.ceil(areiaFinaAssent / 25 * PERDA);
  const cimentoFinaAssent = Math.ceil(areiaFinaAssent * 2 * PERDA);
  const contraverga = Math.ceil(cp.vaoPortasJanelasTerreo * 2 / 12 * PERDA);

  const tabuas15Colun = Math.ceil(cp.colunas15Terreo * 2.8 * 2 / 3 * PERDA);
  const tabuas20Colun = Math.ceil(cp.colunas20Terreo * 2.8 * 2 / 3 * PERDA);
  const tabuas30Colun = Math.ceil(cp.colunas30Terreo * 2.8 * 2 / 3 * PERDA);
  const sarrafo5Colun = Math.ceil(
    ((cp.colunas15Terreo * 2.8 * 2 / 0.5 * 0.2) +
      (cp.colunas20Terreo * 2.8 * 2 / 0.5 * 0.25) +
      (cp.colunas30Terreo * 2.8 * 2 / 0.5 * 0.35)) * PERDA / 3
  );
  const maderitesColun = Math.ceil(cp.areaFormaColunaMaior25cmTerreo / 2.42 * PERDA);
  const areiaGrossaColunas = Math.ceil(cp.concrColunaTerreo * 0.6 * PERDA);
  const pedraColunas = Math.ceil(cp.concrColunaTerreo * PERDA);
  const cimentoColunas = Math.ceil(pedraColunas * 6 * PERDA);

  const ca60_4mm = Math.ceil(cp.ca60_4mmColunaTerreo / BARRA_FERRO_MTS * PERDA);
  const ca50_5mm = Math.ceil(cp.ca50_5mmColunaTerreo / BARRA_FERRO_MTS * PERDA);
  const ca50_6mm = Math.ceil(cp.ca50_6mmColunaTerreo / BARRA_FERRO_MTS * PERDA);
  const ca50_8mm = Math.ceil(cp.ca50_8mmColunaTerreo / BARRA_FERRO_MTS * PERDA);
  const ca50_10mm = Math.ceil(cp.ca50_10mmColunaTerreo / BARRA_FERRO_MTS * PERDA);
  const ca50_12mm = Math.ceil(cp.ca50_12mmColunaTerreo / BARRA_FERRO_MTS * PERDA);
  const ca50_16mm = Math.ceil(cp.ca50_16mmColunaTerreo / BARRA_FERRO_MTS * PERDA);
  const ca60_5mm = Math.ceil(cp.ca60_5mmColunaTerreo / BARRA_FERRO_MTS * PERDA);

  // Soma dos pesos SEM ceiling — o .bas guarda isso num Double cru, só o
  // arame calculado a partir dele que leva ceil.
  const pesoFerroColunas =
    ca60_4mm * PESOS_FERRO.CA60_4MM +
    ca50_5mm * PESOS_FERRO.CA50_5MM +
    ca50_6mm * PESOS_FERRO.CA50_6MM +
    ca50_8mm * PESOS_FERRO.CA50_8MM +
    ca50_10mm * PESOS_FERRO.CA50_10MM +
    ca50_12mm * PESOS_FERRO.CA50_12MM +
    ca50_16mm * PESOS_FERRO.CA50_16MM +
    ca60_5mm * PESOS_FERRO.CA60_5MM;

  const arameColunas = Math.ceil(pesoFerroColunas * 0.06 * PERDA);
  // [VBA] sem *PERDA aqui — só o arame leva perda, o cálculo de pregos a
  // partir do arame não, confirmado contra o original.
  const pregos18x27 = Math.ceil(arameColunas * 0.55);

  const base = { ordem: ORD.paredesTerreo, tipo: "Bruto", etapa: "Supra estrutura e paredes" };
  const subParedes = "Paredes Pav. Térreo";
  const subSupra = "Supra estrutura Pav. Térreo";

  // Rótulos abaixo (incluindo o espaço duplo em "Bloco  6 Furos" e as
  // bitolas "20cm"/"25cm" nas tábuas que na verdade vêm de
  // CP_COLUNAS_15/20) são copiados ao pé da letra do .bas — não são erro de
  // digitação meu, são do sistema original, preservados por instrução.
  emitir(out, { ...base, subEtapa: subParedes, item: "Cerâmicas - Tijolo - Bloco  6 Furos", unidade: "Unidade", qtd: tijolos6F });
  emitir(out, { ...base, subEtapa: subParedes, item: "Cerâmicas - Tijolo - Bloco 8 Furos", unidade: "Unidade", qtd: tijolos8F });
  emitir(out, { ...base, subEtapa: subParedes, item: "Areia Fina", unidade: "m3", qtd: areiaFinaAssent });
  emitir(out, { ...base, subEtapa: subParedes, item: "Impermeabilizantes - Vedalit 18L", unidade: "Baldes 18L", qtd: vedalitFinaAssent });
  emitir(out, { ...base, subEtapa: subParedes, item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimentoFinaAssent });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Treliça H8 Barras 12mts", unidade: "Barras 12mts", qtd: contraverga });
  emitir(out, { ...base, subEtapa: subSupra, item: "Madeira Caixaria - Tábuas de 20cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas15Colun });
  emitir(out, { ...base, subEtapa: subSupra, item: "Madeira Caixaria - Tábuas de 25cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas20Colun });
  emitir(out, { ...base, subEtapa: subSupra, item: "Madeira Caixaria - Tábuas de 30cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas30Colun });
  emitir(out, { ...base, subEtapa: subSupra, item: "Madeira Caixaria - Sarrafos de 05cm x 3mts", unidade: "Barras 3 mts", qtd: sarrafo5Colun });
  emitir(out, { ...base, subEtapa: subSupra, item: "Madeira Caixaria - Madeirite Plastif. Preto 2,10x1,10mts 18mm", unidade: "Unidade", qtd: maderitesColun });
  emitir(out, { ...base, subEtapa: subSupra, item: "Areia Grossa", unidade: "m3", qtd: areiaGrossaColunas });
  emitir(out, { ...base, subEtapa: subSupra, item: "Pedra", unidade: "m3", qtd: pedraColunas });
  emitir(out, { ...base, subEtapa: subSupra, item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimentoColunas });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA60 4.2mm 12mts", unidade: "Barras 12mts", qtd: ca60_4mm });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 5.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_5mm });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 6.3mm 12mts", unidade: "Barras 12mts", qtd: ca50_6mm });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 8.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_8mm });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 10.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_10mm });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 12.5mm 12mts", unidade: "Barras 12mts", qtd: ca50_12mm });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 16mm 12mts", unidade: "Barras 12mts", qtd: ca50_16mm });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA60 5.0mm 12mts", unidade: "Barras 12mts", qtd: ca60_5mm });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Arame Recozido", unidade: "KG", qtd: arameColunas });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Pregos 18x27", unidade: "KG", qtd: pregos18x27 });
}

// ═══════════════════════════════════════════════════════════════
// M_PINTURA.bas — pintura (base + tintas)
// ═══════════════════════════════════════════════════════════════
function pintura(cp, out) {
  const paredeInterna = ((cp.m2ParedesInternas - cp.revestimentoInterno) * 2 + cp.m2ParedesExternas) * PERDA;
  const paredeExterna = cp.m2ParedesExternas * PERDA;
  const paredeTotal = paredeInterna + paredeExterna;

  const selador = Math.ceil((0.2 * paredeTotal) / 10 * PERDA);
  const massaCorrida = Math.ceil(((paredeInterna / 3) * 2.5) / 15 * PERDA);
  const fundoPreparador = Math.ceil((0.2 * paredeTotal) / 8 * PERDA);
  const tintas = Math.ceil(0.15 * paredeTotal / 9 * PERDA);

  const base = { ordem: ORD.pintura, tipo: "Acabamento", etapa: "Pintura" };

  // [DIVERGÊNCIA COM A SPEC §4.4 — reportada, não corrigida silenciosamente]
  // A spec afirma que M_PINTURA.bas usa `If CALC_X <> 0 Or CALC_X <> 0` como
  // uma condição sempre-verdadeira, e pede pra preservar esse "bug" emitindo
  // sempre. Lendo o M_PINTURA.bas linha a linha, a condição real é, por
  // exemplo, `If CALC_FUNDO_PREPARADOR <> 0 Or CALC_FUNDO_PREPARADOR <> 0`:
  // é a MESMA variável nos dois lados do Or. Logicamente isso é
  // (A≠0) OR (A≠0) = A≠0 — idêntico ao filtro normal de emitir(), não uma
  // tautologia. Não existem duas variáveis diferentes ali para tornar a
  // condição sempre verdadeira. Seguindo a regra "onde a spec divergir do
  // .bas, o .bas vence", a pintura aqui usa o emitir() padrão (só emite se
  // qtd≠0), como todo o resto do motor — que é o que a planilha real produz.
  // Reportado ao usuário; ajustar se ele confirmar uma leitura diferente do
  // VBA.
  emitir(out, { ...base, subEtapa: "Base", item: "Tintas - Fundo Preparador 18L", unidade: "Unidades", qtd: fundoPreparador });
  emitir(out, { ...base, subEtapa: "Base", item: "Tintas - Selador 18L", unidade: "Unidades", qtd: selador });
  emitir(out, { ...base, subEtapa: "Base", item: "Tintas - Massa Corrida 25KG", unidade: "Unidades", qtd: massaCorrida });
  emitir(out, { ...base, subEtapa: "Tintas", item: "Tintas - Tintas 18L", unidade: "Unidades", qtd: tintas });
}

// ═══════════════════════════════════════════════════════════════
// B_INSTALACOES_OBRA_PROJETOS.bas — ferramentas e insumos fixos de início de
// obra, mais 4 itens calculados a partir do gabarito.
// ═══════════════════════════════════════════════════════════════
function instalacoesObraProjetos(cp, out) {
  const baseInst = { ordem: ORD.instalacoes, tipo: "Bruto", etapa: "Instalações pré obra e projetos" };
  const baseFund = { ordem: ORD.instalacoes, tipo: "Bruto", etapa: "Fundação" };

  // Quantidades fixas — sempre presentes em qualquer orçamento (não dependem
  // de nenhum CP_ de projeto), exatamente como no .bas.
  emitir(out, { ...baseInst, subEtapa: "Bruto - Elétrica", item: "Elétrica - Poste Padrão - Trifásica C3", unidade: "Unidades", qtd: 1 });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Ferramentas - Serra Circular Dewalt DWE560-B2", unidade: "Unidades", qtd: 1 });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Ferramentas - Furadeira Dewalt 1/2 DWD502-BR 710W", unidade: "Unidades", qtd: 1 });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Ferramentas - Mangueira de Nível", unidade: "Mts", qtd: 25 });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Ferramentas - Lapis", unidade: "Rolos", qtd: 4 });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Disco Serra Circular", unidade: "Unidades", qtd: 2 });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Metal - Hidráulica - Torneira Jardim", unidade: "Unidades", qtd: 1 });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Ferramentas - Pá de bico com cabo", unidade: "Unidades", qtd: 4 });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Ferramentas - Cavadeira", unidade: "Unidades", qtd: 4 });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Ferramentas - Mangueira de Jardim", unidade: "Mts", qtd: 30 });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Ferramentas - Engate Rápido Mangueira Jardim", unidade: "Unidades", qtd: 1 });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Ferramentas - Torquesa Ferragem", unidade: "Unidades", qtd: 5 });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Ferramentas - Luva Mucambo", unidade: "Unidades", qtd: 10 });
  emitir(out, { ...baseFund, subEtapa: "Marcação Obra", item: "Ferramentas - Linha de pedreiro", unidade: "Unidades", qtd: 2 });
  emitir(out, { ...baseFund, subEtapa: "Marcação Obra", item: "Ferramentas - Carrinho Pedreiro", unidade: "Unidades", qtd: 4 });

  const tabua10 = Math.ceil(cp.gabarito / 3 * 1.2);
  const sarrafo5 = Math.ceil((cp.gabarito * 1.2 / 1.3 * 0.6 / 3) + 20);
  const prego18x27 = Math.ceil(0.05 * tabua10 / 2);
  const prego17x21 = prego18x27;

  emitir(out, { ...baseFund, subEtapa: "Marcação Obra", item: "Madeira Caixaria - Tábuas de 10cm x 3mts", unidade: "Barras 3mts", qtd: tabua10 });
  emitir(out, { ...baseFund, subEtapa: "Marcação Obra", item: "Madeira Caixaria - Sarrafos de 05cm x 3mts", unidade: "Barras 3mts", qtd: sarrafo5 });
  emitir(out, { ...baseFund, subEtapa: "Marcação Obra", item: "Aço - Pregos 18x27", unidade: "KG", qtd: prego18x27 });
  emitir(out, { ...baseFund, subEtapa: "Marcação Obra", item: "Aço - Pregos 17x21", unidade: "KG", qtd: prego17x21 });
}

// ═══════════════════════════════════════════════════════════════
// C_FUNDACAO.bas
// ═══════════════════════════════════════════════════════════════
function fundacao(cp, out) {
  const f = cp.fundacao;
  const perim = cp.perimetroParedesTerreo;

  const tabuas30 = Math.ceil(((perim * 2 / 3) + perim * 2 / 3 * 0.45 / 3) * PERDA);
  const sarrafo5 = Math.ceil(((perim * 2 / 0.7 * 0.45) + (perim / 0.75 * 0.3)) / 3 * PERDA);
  // [VBA] fator 1.15 (não 1.1) — perda de perfuração é diferente da perda de material
  const perfuracaoEstacas = f.qtdEstacas * f.profEstacas * 1.15;

  const soma = somarFerro(f.ferro.estacas, f.ferro.sapatas, f.ferro.arranques, f.ferro.baldrames);
  const barras = barrasPorBitola(soma);
  const peso = pesoTotalFerro(barras);
  const concreto = Math.ceil(somaN(f.concreto.estacas, f.concreto.sapatas, f.concreto.arranques, f.concreto.baldrames) * PERDA);
  const discoFerro = Math.ceil(peso * 0.01);
  const arame = Math.ceil(peso * 0.06);
  const prego = Math.ceil(0.55 * arame);
  const vedatop = Math.ceil((((perim * 2 * 0.3) + (perim * 0.15)) * 3 * PERDA) / 18);

  const base = { ordem: ORD.fundacao, tipo: "Bruto", etapa: "Fundação", subEtapa: "Brocas e baldrames" };
  emitBarras(out, base, barras);
  emitir(out, { ...base, item: "Disco Ferro", unidade: "Unidades", qtd: discoFerro });
  emitir(out, { ...base, item: "Aço - Arame Recozido", unidade: "KG", qtd: arame });
  emitir(out, { ...base, item: "Aço - Pregos 18x27", unidade: "KG", qtd: prego });
  emitir(out, { ...base, item: "Maquinário - Perfuração", unidade: "Mts", qtd: perfuracaoEstacas });
  emitir(out, { ...base, item: "Madeira Caixaria - Tábuas de 30cm x 3mts", unidade: "Barras 3mts", qtd: tabuas30 });
  emitir(out, { ...base, item: "Madeira Caixaria - Sarrafos de 05cm x 3mts", unidade: "Barras 3mts", qtd: sarrafo5 });
  emitir(out, { ...base, item: f.resistenciaConcreto || "Concreto", unidade: "m3", qtd: concreto });
  emitir(out, { ...base, item: "Concreto - Bomba", unidade: "Unidades", qtd: 1 });
  emitir(out, { ...base, subEtapa: "Impermeabilização", item: "Impermeabilizantes - Vedatop 18KG", unidade: "Baldes 18L", qtd: vedatop });
}

// ═══════════════════════════════════════════════════════════════
// E_CONTRAPISO_INTERNO_TERREO.bas
// ═══════════════════════════════════════════════════════════════
function contrapisoInternoTerreo(cp, out) {
  const area = cp.areaTerreo;
  const areiaGrossaContrap = Math.ceil(area * 0.6 * 0.1 * PERDA);
  const pedraContrap = Math.ceil(area * 0.1 * PERDA);
  const cimentoContrap = Math.ceil(pedraContrap * 6 * PERDA);
  const malhaPop = Math.ceil(area / (2.9 * 1.9 * PERDA));
  const cimentoMassiam = Math.ceil(area * 0.05 * 0.25 * 1200 / 50 * PERDA);
  const areiaGrossaMassiam = Math.ceil(area * 0.05 * 0.75 * PERDA);
  const biancoMassiam = Math.ceil(area / 60 * PERDA);

  const base = { ordem: ORD.contrapisoInterno, tipo: "Bruto", etapa: "Contrapiso Interno" };
  emitir(out, { ...base, subEtapa: "Contrapiso Interno Pav. Térreo", item: "Locação Ferramentas -  Compactador", unidade: "Dias", qtd: 2 });
  emitir(out, { ...base, subEtapa: "Contrapiso Interno Pav. Térreo", item: "Areia Grossa", unidade: "m3", qtd: areiaGrossaContrap });
  emitir(out, { ...base, subEtapa: "Contrapiso Interno Pav. Térreo", item: "Pedra", unidade: "m3", qtd: pedraContrap });
  emitir(out, { ...base, subEtapa: "Contrapiso Interno Pav. Térreo", item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimentoContrap });
  emitir(out, { ...base, subEtapa: "Contrapiso Interno Pav. Térreo", item: "Aço - Malha Pop EQ061 3.4mm 15x15", unidade: "Unidade", qtd: malhaPop });
  emitir(out, { ...base, subEtapa: "Massiamento contrap Pav. Térreo", item: "Sacos de cimento 50kg", unidade: "Unidade", qtd: cimentoMassiam });
  emitir(out, { ...base, subEtapa: "Massiamento contrap Pav. Térreo", item: "Areia Grossa", unidade: "m3", qtd: areiaGrossaMassiam });
  emitir(out, { ...base, subEtapa: "Massiamento contrap Pav. Térreo", item: "Impermeabilizantes - Bianco 18KG", unidade: "Unidades", qtd: biancoMassiam });
}

// ═══════════════════════════════════════════════════════════════
// G_VIGA_RESPALDO_LAJE_TERREO.bas
// ═══════════════════════════════════════════════════════════════
function vigaRespaldoLajeTerreo(cp, out) {
  const t = cp.terreo;
  const mesesEscoras = cp.tipologia === "Sobrado" ? 2.5 : 1.5;
  // [VBA] a string original de comparação é "Térreo" (masc.), não a "Térrea"
  // que normalizarProjeto usa para cp.tipologia — normalizado aqui só para
  // reproduzir a mesma comparação de string que CALC_TIPO_LOJE_TERREO_EDIF
  // faz no original (Concat(tipologia, tipoLoje)).
  const tipologiaVba = cp.tipologia === "Sobrado" ? "Sobrado" : "Térreo";

  const tabuas10 = Math.ceil((((t.perimetroLoje * 2 / 3) + t.perimetroLoje * 2 / 3 * 0.45 / 3)) * PERDA);
  const tabuas30 = Math.ceil((((cp.perimetroParedesTerreo * 2 / 3) + cp.perimetroParedesTerreo * 2 / 3 * 0.45 / 3)) * PERDA);
  const sarrafo5 = Math.ceil(((cp.perimetroParedesTerreo * 2 / 0.7 * 0.45) + (cp.perimetroParedesTerreo / 0.75 * 0.3)) / 3 * PERDA);

  const ferro = normalizarFerro(t.vigaRespaldo);
  const ca60_4mm = Math.ceil(ferro.CA60_4MM / BARRA_FERRO_MTS * PERDA);
  const ca50_5mm = Math.ceil(ferro.CA50_5MM / BARRA_FERRO_MTS * PERDA);
  const ca50_6mm = Math.ceil(ferro.CA50_6MM / BARRA_FERRO_MTS * PERDA);
  const ca50_8mm = Math.ceil(ferro.CA50_8MM / BARRA_FERRO_MTS * PERDA);
  const ca50_10mm = Math.ceil(ferro.CA50_10MM / BARRA_FERRO_MTS * PERDA);
  const ca50_12mm = Math.ceil(ferro.CA50_12MM / BARRA_FERRO_MTS * PERDA);
  const ca50_16mm = Math.ceil(ferro.CA50_16MM / BARRA_FERRO_MTS * PERDA);
  const ca60_5mm = Math.ceil(ferro.CA60_5MM / BARRA_FERRO_MTS * PERDA);
  const peso = ca60_4mm * PESOS_FERRO.CA60_4MM + ca50_5mm * PESOS_FERRO.CA50_5MM + ca50_6mm * PESOS_FERRO.CA50_6MM +
    ca50_8mm * PESOS_FERRO.CA50_8MM + ca50_10mm * PESOS_FERRO.CA50_10MM + ca50_12mm * PESOS_FERRO.CA50_12MM +
    ca50_16mm * PESOS_FERRO.CA50_16MM + ca60_5mm * PESOS_FERRO.CA60_5MM;
  const arame = Math.ceil(peso * 0.06 * PERDA);
  const prego = Math.ceil(arame * 0.55);

  const volumeConcretoLoje = Math.ceil(((t.areaLoje * 0.1) + t.concretoVigaRespaldo) * PERDA);
  const malhaPop = Math.ceil((t.areaLoje / (2.9 * 1.9)) * PERDA);

  const tipoConcat = tipologiaVba + t.tipoLoje;
  let nomeModelo = "";
  if (tipoConcat === "TérreoProtendida") nomeModelo = "Laje Pré Moldada Protendida Forro";
  else if (tipoConcat === "SobradoProtendida") nomeModelo = "Laje Pré Moldada Protendida Piso";
  else if (tipoConcat === "TérreoTreliça") nomeModelo = "Laje Pré Moldada Treliça Forro";
  else if (tipoConcat === "SobradoTreliça") nomeModelo = "Laje Pré Moldada Treliça Piso";

  const qtdLoje = Math.ceil(t.areaLoje * PERDA);
  const qtdEscoras = t.tipoLoje === "Protendida"
    ? Math.ceil(t.areaLoje * 0.6 * mesesEscoras * PERDA)
    : Math.ceil(t.areaLoje * mesesEscoras * PERDA);

  const lojeMacica = Math.ceil(t.areaLojeMacica * 0.15 * PERDA);
  const maderiteLojeMacica = Math.ceil(t.areaLojeMacica / 2.42 * PERDA);
  const escorasLojeMacica = Math.ceil(t.areaLojeMacica * mesesEscoras * PERDA);

  const etapa = "Viga Respaldo e Laje";
  const o = ORD.vigaLajeTerreo;
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Madeira Caixaria - Tábuas de 10cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas10 });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Madeira Caixaria - Tábuas de 30cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas30 });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Madeira Caixaria - Sarrafos de 05cm x 3mts", unidade: "Barras 3 mts", qtd: sarrafo5 });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Aço - Barras de CA60 4.2mm 12mts", unidade: "Barras 12mts", qtd: ca60_4mm });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Aço - Barras de CA50 5.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_5mm });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Aço - Barras de CA50 6.3mm 12mts", unidade: "Barras 12mts", qtd: ca50_6mm });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Aço - Barras de CA50 8.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_8mm });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Aço - Barras de CA50 10.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_10mm });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Aço - Barras de CA50 12.5mm 12mts", unidade: "Barras 12mts", qtd: ca50_12mm });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Aço - Barras de CA50 16mm 12mts", unidade: "Barras 12mts", qtd: ca50_16mm });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Aço - Barras de CA60 5.0mm 12mts", unidade: "Barras 12mts", qtd: ca60_5mm });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Aço - Arame Recozido", unidade: "KG", qtd: arame });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Aço - Pregos 18x27", unidade: "KG", qtd: prego });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Térreo", item: t.resistenciaConcretoLoje || "Concreto", unidade: "m3", qtd: volumeConcretoLoje });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Térreo", item: "Aço - Malha pop EQ092 4.2mm 15x15", unidade: "Unidades", qtd: malhaPop });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Térreo", item: nomeModelo, unidade: "m2", qtd: qtdLoje });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Térreo", item: "Locação Ferramentas - Escoras", unidade: "Unidade", qtd: qtdEscoras });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Térreo", item: "Concreto - Bomba", unidade: "Unidade", qtd: 1 });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Maciça Térreo", item: t.resistenciaConcretoLoje || "Concreto", unidade: "m3", qtd: lojeMacica });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Maciça Térreo", item: "Madeira Caixaria - Madeirite Plastif. Preto 2,10x1,10mts 18mm", unidade: "Unidade", qtd: maderiteLojeMacica });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Maciça Térreo", item: "Locação Ferramentas - Escoras", unidade: "Unidade", qtd: escorasLojeMacica });
}

// ═══════════════════════════════════════════════════════════════
// H_PAREDES_PAV_1.bas — parecido com F_PAREDES_TERREO, mas com diferenças
// reais do original preservadas (não generalizado): "tábuas 30" usa
// COLUNAS_25 (não 30), CA60 4.2mm nunca é calculado nem emitido aqui, e o
// rótulo de sub-etapa das colunas repete "Supra estrutura Pav. Térreo".
// ═══════════════════════════════════════════════════════════════
function paredesPav1(cp, out) {
  const p1 = cp.pav1;
  const tijolos6F = Math.ceil(p1.m2Parede20 * 40 * PERDA);
  const tijolos8F = Math.ceil((p1.m2Parede25 * 40 + p1.m2Parede15 * 20) * PERDA);
  const areiaFinaAssent = Math.ceil(tijolos6F * 0.001638 * PERDA + tijolos8F * 0.002223 * PERDA);
  const vedalitFinaAssent = Math.ceil(areiaFinaAssent / 25 * PERDA);
  const cimentoFinaAssent = Math.ceil(areiaFinaAssent * 2 * PERDA);
  const contraverga = Math.ceil(p1.vaoPortasJanelas * 2 / 12 * PERDA);

  const tabuas15Colun = Math.ceil(p1.colunas15 * 2.8 * 2 / 3 * PERDA);
  const tabuas20Colun = Math.ceil(p1.colunas20 * 2.8 * 2 / 3 * PERDA);
  // [VBA] usa CP_COLUNAS_25 aqui (não 30) — divergência real do original em
  // relação ao F_PAREDES_TERREO, preservada de propósito.
  const tabuas30Colun = Math.ceil(p1.colunas25 * 2.8 * 2 / 3 * PERDA);
  const sarrafo5Colun = Math.ceil(
    ((p1.colunas15 * 2.8 * 2 / 0.5 * 0.2) +
      (p1.colunas20 * 2.8 * 2 / 0.5 * 0.25) +
      (p1.colunas30 * 2.8 * 2 / 0.5 * 0.35)) * PERDA / 3
  );
  const maderitesColun = Math.ceil(p1.areaFormaColunaMaior25cm / 2.42 * PERDA);
  const areiaGrossaColunas = Math.ceil(p1.concrColuna * 0.6 * PERDA);
  const pedraColunas = Math.ceil(p1.concrColuna * PERDA);
  const cimentoColunas = Math.ceil(pedraColunas * 6 * PERDA);

  const ferro = normalizarFerro(p1.ferro);
  // [VBA] CA60_4mm nunca é calculado neste módulo (só declarado/emitido no
  // Térreo) — a condição correspondente em H_PAREDES_PAV_1.bas testa uma
  // variável nunca atribuída (sempre 0) e por isso NUNCA emite. Preservado:
  // nem calculamos nem emitimos essa linha aqui.
  const ca50_5mm = Math.ceil(ferro.CA50_5MM / BARRA_FERRO_MTS * PERDA);
  const ca50_6mm = Math.ceil(ferro.CA50_6MM / BARRA_FERRO_MTS * PERDA);
  const ca50_8mm = Math.ceil(ferro.CA50_8MM / BARRA_FERRO_MTS * PERDA);
  const ca50_10mm = Math.ceil(ferro.CA50_10MM / BARRA_FERRO_MTS * PERDA);
  const ca50_12mm = Math.ceil(ferro.CA50_12MM / BARRA_FERRO_MTS * PERDA);
  const ca50_16mm = Math.ceil(ferro.CA50_16MM / BARRA_FERRO_MTS * PERDA);
  const ca60_5mm = Math.ceil(ferro.CA60_5MM / BARRA_FERRO_MTS * PERDA);
  const pesoFerroColunas = ca50_5mm * PESOS_FERRO.CA50_5MM + ca50_6mm * PESOS_FERRO.CA50_6MM +
    ca50_8mm * PESOS_FERRO.CA50_8MM + ca50_10mm * PESOS_FERRO.CA50_10MM + ca50_12mm * PESOS_FERRO.CA50_12MM +
    ca50_16mm * PESOS_FERRO.CA50_16MM + ca60_5mm * PESOS_FERRO.CA60_5MM;
  const arameColunas = Math.ceil(pesoFerroColunas * 0.06 * PERDA);
  const pregos18x27 = Math.ceil(arameColunas * 0.55);

  const base = { ordem: ORD.paredesPav1, tipo: "Bruto", etapa: "Supra estrutura e paredes" };
  const subParedes = "Paredes Pav 1";
  // [VBA] rótulo copiado do módulo do Térreo, preservado do original.
  const subSupra = "Supra estrutura Pav. Térreo";

  emitir(out, { ...base, subEtapa: subParedes, item: "Cerâmicas - Tijolo - Bloco  6 Furos", unidade: "Unidade", qtd: tijolos6F });
  emitir(out, { ...base, subEtapa: subParedes, item: "Cerâmicas - Tijolo - Bloco 8 Furos", unidade: "Unidade", qtd: tijolos8F });
  emitir(out, { ...base, subEtapa: subParedes, item: "Areia Fina", unidade: "m3", qtd: areiaFinaAssent });
  emitir(out, { ...base, subEtapa: subParedes, item: "Impermeabilizantes - Vedalit 18L", unidade: "Baldes 18L", qtd: vedalitFinaAssent });
  emitir(out, { ...base, subEtapa: subParedes, item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimentoFinaAssent });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Treliça H8 Barras 12mts", unidade: "Barras 12mts", qtd: contraverga });
  emitir(out, { ...base, subEtapa: subSupra, item: "Madeira Caixaria - Tábuas de 20cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas15Colun });
  emitir(out, { ...base, subEtapa: subSupra, item: "Madeira Caixaria - Tábuas de 25cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas20Colun });
  emitir(out, { ...base, subEtapa: subSupra, item: "Madeira Caixaria - Tábuas de 30cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas30Colun });
  emitir(out, { ...base, subEtapa: subSupra, item: "Madeira Caixaria - Sarrafos de 05cm x 3mts", unidade: "Barras 3 mts", qtd: sarrafo5Colun });
  emitir(out, { ...base, subEtapa: subSupra, item: "Madeira Caixaria - Madeirite Plastif. Preto 2,10x1,10mts 18mm", unidade: "Unidade", qtd: maderitesColun });
  emitir(out, { ...base, subEtapa: subSupra, item: "Areia Grossa", unidade: "m3", qtd: areiaGrossaColunas });
  emitir(out, { ...base, subEtapa: subSupra, item: "Pedra", unidade: "m3", qtd: pedraColunas });
  emitir(out, { ...base, subEtapa: subSupra, item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimentoColunas });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 5.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_5mm });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 6.3mm 12mts", unidade: "Barras 12mts", qtd: ca50_6mm });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 8.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_8mm });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 10.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_10mm });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 12.5mm 12mts", unidade: "Barras 12mts", qtd: ca50_12mm });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 16mm 12mts", unidade: "Barras 12mts", qtd: ca50_16mm });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA60 5.0mm 12mts", unidade: "Barras 12mts", qtd: ca60_5mm });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Arame Recozido", unidade: "KG", qtd: arameColunas });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Pregos 18x27", unidade: "KG", qtd: pregos18x27 });
}

// ═══════════════════════════════════════════════════════════════
// I_VIGA_RESPALDO_LAJE_PAV_1.bas
// ═══════════════════════════════════════════════════════════════
function vigaRespaldoLajePav1(cp, out) {
  const p1 = cp.pav1;
  const tipologiaVba = cp.tipologia === "Sobrado" ? "Sobrado" : "Térreo";

  const tabuas10 = Math.ceil((((p1.perimetroLoje * 2 / 3) + p1.perimetroLoje * 2 / 3 * 0.45 / 3)) * PERDA);
  const tabuas30 = Math.ceil((((p1.perimetroParedes * 2 / 3) + p1.perimetroParedes * 2 / 3 * 0.45 / 3)) * PERDA);
  const sarrafo5 = Math.ceil(((p1.perimetroParedes * 2 / 0.7 * 0.45) + (p1.perimetroParedes / 0.75 * 0.3)) / 3 * PERDA);

  const ferro = normalizarFerro(p1.vigaRespaldo);
  const ca50_5mm = Math.ceil(ferro.CA50_5MM / BARRA_FERRO_MTS * PERDA);
  const ca50_6mm = Math.ceil(ferro.CA50_6MM / BARRA_FERRO_MTS * PERDA);
  const ca50_8mm = Math.ceil(ferro.CA50_8MM / BARRA_FERRO_MTS * PERDA);
  const ca50_10mm = Math.ceil(ferro.CA50_10MM / BARRA_FERRO_MTS * PERDA);
  const ca50_12mm = Math.ceil(ferro.CA50_12MM / BARRA_FERRO_MTS * PERDA);
  const ca50_16mm = Math.ceil(ferro.CA50_16MM / BARRA_FERRO_MTS * PERDA);
  const ca60_5mm = Math.ceil(ferro.CA60_5MM / BARRA_FERRO_MTS * PERDA);
  const peso = ca50_5mm * PESOS_FERRO.CA50_5MM + ca50_6mm * PESOS_FERRO.CA50_6MM + ca50_8mm * PESOS_FERRO.CA50_8MM +
    ca50_10mm * PESOS_FERRO.CA50_10MM + ca50_12mm * PESOS_FERRO.CA50_12MM + ca50_16mm * PESOS_FERRO.CA50_16MM + ca60_5mm * PESOS_FERRO.CA60_5MM;
  const arame = Math.ceil(peso * 0.06 * PERDA);
  const prego = Math.ceil(arame * 0.55);

  const volumeConcretoLoje = Math.ceil(((p1.areaLoje * 0.1) + p1.concretoVigaRespaldo) * PERDA);
  const malhaPop = Math.ceil((p1.areaLoje / (2.9 * 1.9)) * PERDA);

  const tipoConcat = tipologiaVba + p1.tipoLoje;
  let nomeModelo = "";
  if (tipoConcat === "TérreoProtendida") nomeModelo = "Laje Pré Moldada Protendida Forro";
  else if (tipoConcat === "SobradoProtendida") nomeModelo = "Laje Pré Moldada Protendida Piso";
  else if (tipoConcat === "TérreoTreliça") nomeModelo = "Laje Pré Moldada Treliça Forro";
  else if (tipoConcat === "SobradoTreliça") nomeModelo = "Laje Pré Moldada Treliça Piso";

  const qtdLoje = Math.ceil(p1.areaLoje * PERDA);
  // [VBA] meses de escora fixo em 1.5 aqui (não usa a variável de meses do
  // módulo do Térreo) — preservado literalmente.
  const qtdEscoras = p1.tipoLoje === "Protendida"
    ? Math.ceil(p1.areaLoje * 0.6 * 1.5 * PERDA)
    : Math.ceil(p1.areaLoje * 1.5 * PERDA);

  const lojeMacica = Math.ceil(p1.areaLojeMacica * 0.15 * PERDA);
  const maderiteLojeMacica = Math.ceil(p1.areaLojeMacica / 2.42 * PERDA);
  const escorasLojeMacica = Math.ceil(p1.areaLojeMacica * 1.5 * PERDA);

  // [VBA] bug real de copy-paste no original: usa a área de laje do TÉRREO
  // (não do Pav 1) para o massiamento do contrapiso do Pav 1. Preservado.
  const areaBase = cp.terreo.areaLoje;
  const cimentoMassiam = Math.ceil(areaBase * 0.05 * 0.25 * 1200 / 50 * PERDA);
  const areiaGrossaMassiam = Math.ceil(areaBase * 0.05 * 0.75 * PERDA);
  const biancoMassiam = Math.ceil(areaBase / 60 * PERDA);

  const etapa = "Viga Respaldo e Laje";
  const o = ORD.vigaLajePav1;
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Madeira Caixaria - Tábuas de 10cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas10 });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Madeira Caixaria - Tábuas de 30cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas30 });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Madeira Caixaria - Sarrafos de 05cm x 3mts", unidade: "Barras 3 mts", qtd: sarrafo5 });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Aço - Barras de CA50 5.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_5mm });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Aço - Barras de CA50 6.3mm 12mts", unidade: "Barras 12mts", qtd: ca50_6mm });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Aço - Barras de CA50 8.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_8mm });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Aço - Barras de CA50 10.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_10mm });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Aço - Barras de CA50 12.5mm 12mts", unidade: "Barras 12mts", qtd: ca50_12mm });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Aço - Barras de CA50 16mm 12mts", unidade: "Barras 12mts", qtd: ca50_16mm });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Aço - Barras de CA60 5.0mm 12mts", unidade: "Barras 12mts", qtd: ca60_5mm });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Aço - Arame Recozido", unidade: "KG", qtd: arame });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Aço - Pregos 18x27", unidade: "KG", qtd: prego });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Pav 1", item: p1.resistenciaConcretoLoje || "Concreto", unidade: "m3", qtd: volumeConcretoLoje });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Pav 1", item: "Aço - Malha pop EQ092 4.2mm 15x15", unidade: "Unidades", qtd: malhaPop });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Pav 1", item: nomeModelo, unidade: "m2", qtd: qtdLoje });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Pav 1", item: "Locação Ferramentas - Escoras", unidade: "Unidade", qtd: qtdEscoras });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Pav 1", item: "Concreto - Bomba", unidade: "Unidade", qtd: 1 });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Maciça Pav 1", item: p1.resistenciaConcretoLoje || "Concreto", unidade: "m3", qtd: lojeMacica });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Maciça Pav 1", item: "Madeira Caixaria - Madeirite Plastif. Preto 2,10x1,10mts 18mm", unidade: "Unidade", qtd: maderiteLojeMacica });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Maciça Pav 1", item: "Locação Ferramentas - Escoras", unidade: "Unidade", qtd: escorasLojeMacica });
  emitir(out, { ordem: ORD.contrapisoInterno, tipo: "Bruto", etapa: "Contrapiso Interno Pav 1", subEtapa: "Massiamento contrap Pav 1", item: "Sacos de cimento 50kg", unidade: "Unidade", qtd: cimentoMassiam });
  emitir(out, { ordem: ORD.contrapisoInterno, tipo: "Bruto", etapa: "Contrapiso Interno Pav 1", subEtapa: "Massiamento contrap Pav 1", item: "Areia Grossa", unidade: "m3", qtd: areiaGrossaMassiam });
  emitir(out, { ordem: ORD.contrapisoInterno, tipo: "Bruto", etapa: "Contrapiso Interno Pav 1", subEtapa: "Massiamento contrap Pav 1", item: "Impermeabilizantes - Bianco 18KG", unidade: "Unidade", qtd: biancoMassiam });
}

// ═══════════════════════════════════════════════════════════════
// J_SUPRA_COBERTURA.bas
// ═══════════════════════════════════════════════════════════════
function supraCobertura(cp, out) {
  const c = cp.cobertura;
  const somaFerro = somarFerro(c.vigaFerro, c.colunaFerro); // nenhum dos dois tem CA60_4MM (fica 0)
  const barras = barrasPorBitola(somaFerro);
  const peso = pesoTotalFerro(barras);
  const arame = Math.ceil(peso * 0.06 * PERDA);
  const prego = Math.ceil(arame * 0.55);

  const volumeConcreto = numOrZero(c.volumeConcretoColunaRespaldo) + numOrZero(c.volumeConcretoVigaRespaldo); // [VBA] soma crua, sem ceil
  const areiaGrossa = Math.ceil(volumeConcreto * 0.6 * PERDA);
  const pedra = Math.ceil(volumeConcreto * PERDA);
  const cimento = Math.ceil(pedra * 6 * PERDA);

  const tabuas20 = Math.ceil(c.colunas15 * 0.6 * 2 / 3 * PERDA);
  const tabuas25 = Math.ceil(c.colunas20 * 0.6 * 2 / 3 * PERDA);
  // [VBA] soma o perímetro da laje do Pav 1 aqui mesmo quando a tipologia é
  // Térrea — preservado literalmente do original.
  const tabuas30 = Math.ceil(((c.colunas25 * 0.6 * 2) + (cp.pav1.perimetroLoje * 2)) / 3 * PERDA);
  const maderites = Math.ceil(c.areaFormaColunaMaior25cm / 2.42 * PERDA);
  const sarrafo5 = Math.ceil(
    ((c.colunas15 * 0.6 * 2 / 0.5 * 0.2) +
      (c.colunas20 * 0.6 * 2 / 0.5 * 0.25) +
      (c.colunas25 * 0.6 * 2 / 0.5 * 0.35) +
      (cp.pav1.perimetroLoje * 2 / 0.7 * 0.45) +
      (cp.pav1.perimetroLoje / 0.75 * 0.3)) * PERDA / 3
  );

  const base = { ordem: ORD.supraCobertura, tipo: "Bruto", etapa: "Supra estrutura e paredes", subEtapa: "Supra Cobertura" };
  emitir(out, { ...base, item: "Aço - Barras de CA50 5.0mm 12mts", unidade: "Barras 12mts", qtd: barras.CA50_5MM });
  emitir(out, { ...base, item: "Aço - Barras de CA50 6.3mm 12mts", unidade: "Barras 12mts", qtd: barras.CA50_6MM });
  emitir(out, { ...base, item: "Aço - Barras de CA50 8.0mm 12mts", unidade: "Barras 12mts", qtd: barras.CA50_8MM });
  emitir(out, { ...base, item: "Aço - Barras de CA50 10.0mm 12mts", unidade: "Barras 12mts", qtd: barras.CA50_10MM });
  emitir(out, { ...base, item: "Aço - Barras de CA50 12.5mm 12mts", unidade: "Barras 12mts", qtd: barras.CA50_12MM });
  emitir(out, { ...base, item: "Aço - Barras de CA50 16mm 12mts", unidade: "Barras 12mts", qtd: barras.CA50_16MM });
  emitir(out, { ...base, item: "Aço - Barras de CA60 5.0mm 12mts", unidade: "Barras 12mts", qtd: barras.CA60_5MM });
  emitir(out, { ...base, item: "Aço - Arame Recozido", unidade: "KG", qtd: arame });
  emitir(out, { ...base, item: "Aço - Pregos 18x27", unidade: "KG", qtd: prego });
  emitir(out, { ...base, item: "Areia Grossa", unidade: "m3", qtd: areiaGrossa });
  emitir(out, { ...base, item: "Pedra", unidade: "m3", qtd: pedra });
  emitir(out, { ...base, item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimento });
  emitir(out, { ...base, item: "Madeira Caixaria - Tábuas de 20cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas20 });
  emitir(out, { ...base, item: "Madeira Caixaria - Tábuas de 25cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas25 });
  emitir(out, { ...base, item: "Madeira Caixaria - Tábuas de 30cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas30 });
  emitir(out, { ...base, item: "Madeira Caixaria - Sarrafos de 05cm x 3mts", unidade: "Barras 3 mts", qtd: sarrafo5 });
  emitir(out, { ...base, item: "Madeira Caixaria - Madeirite Plastif. Preto 2,10x1,10mts 18mm", unidade: "Unidade", qtd: maderites });
}

// ═══════════════════════════════════════════════════════════════
// K_COBERTURA.bas — o mais complexo: até 16 telhados, cada um com sua
// própria física de área inclinada / cumeeira / madeiramento por tipo de
// telha, tudo acumulado em baldes por material antes de emitir.
// ═══════════════════════════════════════════════════════════════
const AREA_TELHA = {
  "Telha Barro Portuguesa": 0.058,
  "Telha Barro Americana": 0.083,
  "Telha Americana Concreto": 0.095,
  "Telha Plana Concreto": 0.095,
  "Telha Fibrocimento 6mm": 1,
  "Telha Fibrocimento 8mm": 1,
  "Telha Metálica Termoacústica": 1,
  "Telha Metálica Simples": 1,
};
const AREA_CUMEEIRA_TELHA = {
  "Telha Barro Portuguesa": 0.41,
  "Telha Barro Americana": 0.44,
  "Telha Americana Concreto": 0.42,
  "Telha Plana Concreto": 0.33,
  "Telha Fibrocimento 6mm": 1,
  "Telha Fibrocimento 8mm": 1,
  "Telha Metálica Termoacústica": 1,
  "Telha Metálica Simples": 1,
};
const TELHAS_BARRO_CONCRETO = ["Telha Barro Portuguesa", "Telha Barro Americana", "Telha Americana Concreto", "Telha Plana Concreto"];
const TELHAS_FIBROCIMENTO = ["Telha Fibrocimento 6mm", "Telha Fibrocimento 8mm"];
const TELHAS_METALICAS = ["Telha Metálica Termoacústica", "Telha Metálica Simples"];

function calcularTelhado(t) {
  const tipo = t.tipo;
  const larg = numOrZero(t.largura);
  const comp = numOrZero(t.comprimento);
  const incl = numOrZero(t.inclinacao);
  const aguas = numOrZero(t.aguas);

  let espCaibros5x5 = 0;
  if (TELHAS_BARRO_CONCRETO.includes(tipo)) espCaibros5x5 = 0.5;
  if (TELHAS_FIBROCIMENTO.includes(tipo)) espCaibros5x5 = 1;
  if (TELHAS_METALICAS.includes(tipo)) espCaibros5x5 = 1.5;

  let espRipas25x5 = 0;
  if (tipo === "Telha Barro Portuguesa" || tipo === "Telha Plana Concreto" || tipo === "Telha Americana Concreto") espRipas25x5 = 0.34;
  if (tipo === "Telha Barro Americana") espRipas25x5 = 0.3;
  // Fibrocimento e metálicas ficam em 0 (default).

  let espApoio = 0;
  if (TELHAS_FIBROCIMENTO.includes(tipo)) espApoio = 1.02;
  if (TELHAS_METALICAS.includes(tipo)) espApoio = 1;
  // Barro/concreto ficam em 0 (default).

  let espBercos = 0;
  if (TELHAS_BARRO_CONCRETO.includes(tipo)) espBercos = 0.6;

  let espMaoFrancesa = 0;
  if (TELHAS_BARRO_CONCRETO.includes(tipo)) espMaoFrancesa = 1.2;

  const ESP_TERCAS_VIGA = 1.5;
  const vigas = Math.ceil((((larg / ESP_TERCAS_VIGA) + 1) * comp) * PERDA);

  const caibVar1 = aguas === 1
    ? Math.ceil(larg * ((incl ** 2) + 1) ** 0.5)
    : Math.ceil((larg / 2) * ((incl ** 2) + 1) ** 0.5);
  let caibVar2;
  if (espCaibros5x5 === 0) caibVar2 = 0;
  else if (aguas === 1) caibVar2 = Math.ceil(((comp * 2) + 2) / 2 / espCaibros5x5);
  else caibVar2 = Math.ceil(((comp * 2) + 1) / espCaibros5x5);
  const caibros = Math.ceil((caibVar1 * caibVar2) * PERDA);

  const ripas = espRipas25x5 === 0 ? 0 : Math.ceil((larg / espRipas25x5 * comp) * PERDA);
  const apoios = espApoio === 0 ? 0 : Math.ceil((larg / espApoio * 0.51) * PERDA);

  let espigVar1 = 0, espigVar2 = 0, espigVar3 = 0;
  if (!(aguas === 1 || aguas === 2)) { espigVar1 = larg / 2; espigVar2 = larg / 2; }
  if (aguas === 3) espigVar3 = 2;
  else if (aguas === 4) espigVar3 = 4;
  const espigao = Math.ceil((((espigVar1 ** 2 + espigVar2 ** 2) ** 0.5) * espigVar3) * PERDA);

  const berco = Math.ceil((espBercos * larg * 0.5) * PERDA);
  const maoFrancesa = Math.ceil((espMaoFrancesa * larg * 0.45) * PERDA);

  const areaInclinada = comp * larg * ((incl ** 2) + 1) ** 0.5;

  let cumeVar1 = 0;
  if (aguas === 3) cumeVar1 = 2;
  else if (aguas === 4) cumeVar1 = 4;
  let cumeVar2 = 0, cumeVar3 = 0;
  if (!(aguas === 1 || aguas === 2)) { cumeVar2 = larg / 2; cumeVar3 = larg / 2; }
  let cumeVar4;
  if (aguas === 3) cumeVar4 = comp - (larg / 2);
  else if (aguas === 4) cumeVar4 = comp - larg;
  else cumeVar4 = comp;

  const areaTelha = AREA_TELHA[tipo] ?? 0;
  const areaCumeeiraTelha = AREA_CUMEEIRA_TELHA[tipo] ?? 0;

  let perimetro1 = (larg + comp) * 2 * PERDA;
  const maior = Math.max(larg, comp);
  const menor = Math.min(larg, comp);
  let calcularMedida;
  switch (aguas) {
    case 1: calcularMedida = maior; break;
    case 2: calcularMedida = 2 * maior; break;
    case 3: calcularMedida = (2 * maior) + menor; break;
    case 4: calcularMedida = (larg + comp) * 2 * PERDA; break;
    default: calcularMedida = perimetro1;
  }
  const perimetro2 = calcularMedida;

  const mtsCumeeira = ((cumeVar1 * ((cumeVar2 ** 2) + (cumeVar3 ** 2)) ** 0.5) + cumeVar4) * PERDA;
  const telhas = areaTelha === 0 ? 0 : Math.ceil((areaInclinada / areaTelha) * PERDA);
  const denomCumeeira = areaCumeeiraTelha - 0.05;
  const cumeeira = denomCumeeira === 0 ? 0 : Math.ceil((mtsCumeeira / denomCumeeira) * PERDA);
  const prego1 = Math.ceil(areaInclinada * 0.016 * PERDA);
  const prego2 = Math.ceil(areaInclinada * 0.021 * PERDA);
  const manta = Math.ceil(areaInclinada * 1.2);

  // Telhas de barro/concreto não usam rufo (perímetro zerado no original).
  if (TELHAS_BARRO_CONCRETO.includes(tipo)) perimetro1 = 0;

  return { tipo, vigas, espigao, maoFrancesa, caibros, ripas, berco, apoios, prego1, prego2, manta, areaInclinada, telhas, cumeeira, perimetro1, perimetro2 };
}

function cobertura(cp, out) {
  let vigasTotal = 0, caibrosTotal = 0, ripasTotal = 0, bercoTotal = 0, prego1Total = 0, prego2Total = 0, mantaTotal = 0;
  let perimetroTotal1 = 0, perimetroTotal2 = 0, areaCoberturaTotal = 0;
  const telhasPorTipo = {};
  const cumeeiraPorTipo = {};

  for (const t of cp.coberturas) {
    if (!t || !t.tipo) continue;
    const r = calcularTelhado(t);
    vigasTotal += r.vigas + r.espigao + r.maoFrancesa;
    caibrosTotal += r.caibros;
    ripasTotal += r.ripas;
    bercoTotal += r.berco + r.apoios;
    prego1Total += r.prego1;
    prego2Total += r.prego2;
    mantaTotal += r.manta;
    perimetroTotal1 += r.perimetro1;
    perimetroTotal2 += r.perimetro2;
    areaCoberturaTotal += r.areaInclinada;
    telhasPorTipo[r.tipo] = (telhasPorTipo[r.tipo] || 0) + r.telhas;
    cumeeiraPorTipo[r.tipo] = (cumeeiraPorTipo[r.tipo] || 0) + r.cumeeira;
  }

  // Público no VBA original (CALC_AREA_COBERTURA_TOTAL) — lido depois por
  // prestadores() (Carpinteiro). Mutamos cp de propósito, espelhando isso.
  cp.areaCoberturaTotal = areaCoberturaTotal;

  // [VBA] bug real do original: logo antes do laço, o rótulo do primeiro
  // slot de telha é sobrescrito com o tipo do PRIMEIRO telhado cadastrado —
  // então a linha de "Telha Barro Portuguesa" (e sua cumeeira) sai com esse
  // rótulo trocado, mesmo carregando a quantidade acumulada de barro
  // português. Preservado; na prática só importa quando essa quantidade for
  // ≠0 e o primeiro telhado não for barro português.
  const labelPrimeiroSlot = (cp.coberturas[0] && cp.coberturas[0].tipo) || "";
  const ORDEM_TIPOS_TELHA = Object.keys(AREA_TELHA);

  const base = { ordem: ORD.cobertura, tipo: "Bruto", etapa: "Cobertura", subEtapa: "Telhas" };
  for (const tipoTelha of ORDEM_TIPOS_TELHA) {
    const rotulo = tipoTelha === "Telha Barro Portuguesa" ? labelPrimeiroSlot : tipoTelha;
    emitir(out, { ...base, item: rotulo, unidade: "Unidades", qtd: telhasPorTipo[tipoTelha] || 0 });
    emitir(out, { ...base, item: `Cumeeira ${rotulo}`, unidade: "Unidades", qtd: cumeeiraPorTipo[tipoTelha] || 0 });
  }
  emitir(out, { ...base, item: "Manta dupla face", unidade: "m2", qtd: mantaTotal });

  const baseMad = { ordem: ORD.cobertura, tipo: "Bruto", etapa: "Cobertura", subEtapa: "Madeiramento" };
  emitir(out, { ...baseMad, item: "Telhado - Estrutura - Eucalipto S/ Tratar - Vigas 5x15", unidade: "Mts", qtd: vigasTotal });
  emitir(out, { ...baseMad, item: "Telhado - Estrutura - Eucalipto S/ Tratar - Caibros 5x5", unidade: "Mts", qtd: caibrosTotal });
  emitir(out, { ...baseMad, item: "Telhado - Estrutura - Eucalipto S/ Tratar - Ripas 2,5x5", unidade: "Mts", qtd: ripasTotal });
  emitir(out, { ...baseMad, item: "Telhado - Estrutura - Eucalipto S/ Tratar - Vigas 5x20", unidade: "Mts", qtd: bercoTotal });
  emitir(out, { ...baseMad, item: "Aço - Pregos 18x27", unidade: "KG", qtd: prego1Total });
  emitir(out, { ...baseMad, item: "Aço - Pregos 20x42", unidade: "KG", qtd: prego2Total });

  const baseCalha = { ordem: ORD.cobertura, tipo: "Bruto", etapa: "Cobertura", subEtapa: "Calha" };
  emitir(out, { ...baseCalha, item: "Telhado - Calha", unidade: "Mts", qtd: perimetroTotal2 });
  emitir(out, { ...baseCalha, item: "Telhado - Pingadeira", unidade: "Mts", qtd: perimetroTotal1 - perimetroTotal2 });
  emitir(out, { ...baseCalha, item: "Telhado - Rufo", unidade: "Mts", qtd: perimetroTotal1 });
}

// ═══════════════════════════════════════════════════════════════
// L_CHAPISCO_REBOCO.bas
// ═══════════════════════════════════════════════════════════════
function chapiscoReboco(cp, out) {
  const m2 = cp.m2ParedesTotal;
  const volumeChapisco = m2 * PERDA * 2 * 0.005;
  const cimentoChapisco = (volumeChapisco * 0.2 * 1200 / 50) * PERDA;
  const areiaGrossaChapisco = Math.ceil((volumeChapisco * 0.8) * PERDA);

  const volumeReboco = m2 * PERDA * 2 * 0.025;
  const cimentoReboco = (volumeReboco * 0.125 * 1200 / 50) * PERDA;
  const areiaFinaReboco = Math.ceil((volumeReboco * 0.875) * PERDA);

  const aguaTotal = ((volumeChapisco * 0.36) * PERDA) + ((volumeReboco * 0.36) * PERDA);
  const cimentoTotal = Math.ceil(cimentoChapisco + cimentoReboco);
  const vedalit = Math.ceil((0.3 * cimentoTotal / 18) * PERDA);

  const base = { ordem: ORD.reboco, tipo: "Bruto", etapa: "Chapisco e Reboco", subEtapa: "Chapisco e Reboco" };
  emitir(out, { ...base, item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimentoTotal });
  emitir(out, { ...base, item: "Areia Grossa", unidade: "m3", qtd: areiaGrossaChapisco });
  emitir(out, { ...base, item: "Areia Fina", unidade: "m3", qtd: areiaFinaReboco });
  emitir(out, { ...base, item: "Água", unidade: "m3", qtd: aguaTotal });
  emitir(out, { ...base, item: "Impermeabilizantes - Vedalit 18L", unidade: "Unidades", qtd: vedalit });
}

// ═══════════════════════════════════════════════════════════════
// N_CONTRAPISOS_EXTERNOS.bas
// ═══════════════════════════════════════════════════════════════
function contrapisosExternos(cp, out) {
  const pav = cp.pavimentacaoExterna;
  const perim = cp.perimetroPavimentacao;

  const areiaGrossa = Math.ceil(pav * 0.6 * 0.1 * PERDA);
  // [VBA] sem ceiling aqui — diferente das outras fórmulas de "pedra".
  const pedra = pav * 0.1 * PERDA;
  const cimento = Math.ceil(pedra * 6 * PERDA);
  const malhaPop = Math.ceil((pav / (2.9 * 1.9)) * PERDA);
  const tabua20 = Math.ceil(perim / 3 * PERDA);
  const sarrafo5 = Math.ceil(perim / 0.7 * 0.3 / 3 * PERDA);

  const cimentoMassiam = Math.ceil(pav * 0.05 * 0.25 * 1200 / 50 * PERDA);
  const areiaGrossaMassiam = Math.ceil(pav * 0.05 * 0.75 * PERDA);
  const biancoMassiam = Math.ceil(pav / 60 * PERDA);

  const base = { ordem: ORD.contrapisoExterno, tipo: "Bruto", etapa: "Contrapisos Externos" };
  emitir(out, { ...base, subEtapa: "Concretagem", item: "Areia Grossa", unidade: "m3", qtd: areiaGrossa });
  emitir(out, { ...base, subEtapa: "Concretagem", item: "Pedra", unidade: "m3", qtd: pedra });
  emitir(out, { ...base, subEtapa: "Concretagem", item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimento });
  emitir(out, { ...base, subEtapa: "Concretagem", item: "Aço - Malha Pop EQ061 3.4mm 15x15", unidade: "Unidades", qtd: malhaPop });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Madeira Caixaria - Tábuas de 20cm x 3mts", unidade: "Unidades", qtd: tabua20 });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Madeira Caixaria - Sarrafos de 05cm x 3mts", unidade: "Unidades", qtd: sarrafo5 });
  emitir(out, { ...base, subEtapa: "Contrapisos Externos Massiamento", item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimentoMassiam });
  emitir(out, { ...base, subEtapa: "Contrapisos Externos Massiamento", item: "Areia Grossa", unidade: "m3", qtd: areiaGrossaMassiam });
  emitir(out, { ...base, subEtapa: "Contrapisos Externos Massiamento", item: "Impermeabilizantes - Bianco 18KG", unidade: "Unidade", qtd: biancoMassiam });
}

// ═══════════════════════════════════════════════════════════════
// O_MURO_DIVISA.bas
// ═══════════════════════════════════════════════════════════════
function muroDivisa(cp, out) {
  const comp = cp.comprimentoMuroDivisa;
  const alt = cp.alturaMuroDivisa;
  const PROF_BROCAS = 4;
  const DIAM_BROCAS = 0.125;

  const numBrocas = Math.ceil(comp / 2.5);
  const perfuracao = numBrocas * PROF_BROCAS * 1.15;
  const volBrocas = (numBrocas * 3.14 * (DIAM_BROCAS ** 2) * PROF_BROCAS) * PERDA;
  const volColunas = alt * numBrocas * 0.2 * 0.25 * PERDA;
  const volVigas = comp * 2 * 0.3 * 0.2 * PERDA;
  const concreto = volBrocas + volColunas + volVigas;
  const tabuas30 = Math.ceil(((comp * 2 / 3) + comp * 2 / 3 * 0.45 / 3) * 2 * PERDA);
  const sarrafo5 = Math.ceil(((comp * 2 / 0.7 * 0.45) + (comp / 0.75 * 0.3)) / 3 * PERDA);
  const ferro5 = Math.ceil(((PROF_BROCAS / 0.15 * DIAM_BROCAS * 2 * PERDA * numBrocas) + (alt / 0.15 * 0.9 * PERDA * numBrocas) + (comp / 0.15 * 1 * PERDA)) / 12 * PERDA);
  const ferro8 = Math.ceil(((numBrocas * PROF_BROCAS * 3 * PERDA) + (alt * 4 * numBrocas * PERDA) + (comp * 2 * 4 * PERDA)) / 12 * PERDA);
  const arame = Math.ceil(0.06 * ((ferro5 * PERDA * PESOS_FERRO.CA50_5MM) + (ferro8 * PERDA * PESOS_FERRO.CA50_8MM)));
  const prego = Math.ceil(0.55 * arame);

  const areaMuro = comp * alt * PERDA;
  const volChapisco = areaMuro * PERDA * 2 * 0.005;
  const volReboco = areaMuro * PERDA * 2 * 0.025;
  const tijolos = Math.ceil(areaMuro * 46.458 * PERDA);
  const areiaFinaAssent = tijolos * 0.002223 * PERDA;
  const areiaFinaReboco = volReboco * 0.875 * PERDA;
  const areiaFinaTotal = Math.ceil(areiaFinaAssent + areiaFinaReboco);
  const areiaGrossaChapisco = volChapisco * 0.8 * PERDA;
  const agua = ((volChapisco * 0.36) + (volReboco * 0.36)) * PERDA;
  const vedalit = Math.ceil((areiaFinaTotal / 25) * PERDA);
  const cimentoChapisco = (0.2 * volChapisco * 1200 / 50) * PERDA;
  const cimentoReboco = (0.125 * volReboco * 1200 / 50) * PERDA;
  const cimentoAssentamento = areiaFinaAssent * 2 * PERDA;
  const cimentoTotal = Math.ceil(cimentoChapisco + cimentoReboco + cimentoAssentamento);
  const vedatop = Math.ceil(((0.3 * comp) * 3 / 10) * PERDA + (comp * 3 / 18) * PERDA);

  const base = { ordem: ORD.muroDivisa, tipo: "Bruto", etapa: "Muro Divisa" };
  emitir(out, { ...base, subEtapa: "Muros", item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimentoTotal });
  emitir(out, { ...base, subEtapa: "Muros", item: "Areia fina", unidade: "m3", qtd: areiaFinaTotal });
  emitir(out, { ...base, subEtapa: "Muros", item: "Areia Grossa", unidade: "m3", qtd: areiaGrossaChapisco });
  emitir(out, { ...base, subEtapa: "Muros", item: "Água", unidade: "m3", qtd: agua });
  emitir(out, { ...base, subEtapa: "Perfuração", item: "Maquinário - Perfuração", unidade: "Mts", qtd: perfuracao });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Madeira Caixaria - Tábuas de 30cm x 3mts", unidade: "Barras 3mts", qtd: tabuas30 });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Madeira Caixaria - Sarrafos de 05cm x 3mts", unidade: "Barras 3mts", qtd: sarrafo5 });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Aço - Arame Recozido", unidade: "KG", qtd: arame });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Aço - Pregos 18x27", unidade: "KG", qtd: prego });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Aço - Barras de CA50 5.0mm 12mts", unidade: "Barras 12mts", qtd: ferro5 });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Aço - Barras de CA50 8.0mm 12mts", unidade: "Barras 12mts", qtd: ferro8 });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Concreto - FCK20", unidade: "m3", qtd: concreto });
  emitir(out, { ...base, subEtapa: "Impermeabilização", item: "Impermeabilizantes - Vedatop 18KG", unidade: "Unidades", qtd: vedatop });
  emitir(out, { ...base, subEtapa: "Paredes", item: "Cerâmicas - Tijolo - Bloco 8 Furos", unidade: "Unidades", qtd: tijolos });
  emitir(out, { ...base, subEtapa: "Paredes", item: "Impermeabilizantes - Vedalit 18L", unidade: "Unidades", qtd: vedalit });
}

// ═══════════════════════════════════════════════════════════════
// Q_MURO_ARRIMO.bas (Sub MURO_DE_CONTENCAO no original)
// ═══════════════════════════════════════════════════════════════
function muroArrimo(cp, out) {
  const a = cp.arrimo;

  const tijolos8F = Math.ceil((a.altura * a.comprimento * 40) * PERDA);
  const areiaFinaAssent = Math.ceil((tijolos8F * 0.002223 * PERDA));
  const vedalitFinaAssent = Math.ceil(areiaFinaAssent / 25 * PERDA);
  const cimentoFinaAssent = Math.ceil(areiaFinaAssent * 2 * PERDA);

  const tabuas15Colun = Math.ceil(a.colunas15 * 2.8 * 2 / 3 * PERDA);
  const tabuas20Colun = Math.ceil(a.colunas20 * 2.8 * 2 / 3 * PERDA);
  const tabuas30Colun = Math.ceil(a.colunas30 * 2.8 * 2 / 3 * PERDA);
  const sarrafo5Colun = Math.ceil(
    ((a.colunas15 * 2.8 * 2 / 0.5 * 0.2) +
      (a.colunas20 * 2.8 * 2 / 0.5 * 0.25) +
      (a.colunas30 * 2.8 * 2 / 0.5 * 0.35)) * PERDA / 3
  );
  const maderitesColun = Math.ceil(a.areaFormaColunaMaior25cm / 2.42 * PERDA);

  const tabuas30Arrimo = Math.ceil(((a.comprimento * 2 / 3) + a.comprimento * 2 / 3 * 0.45 / 3) * a.numeroVigas * PERDA);
  const sarrafo5Arrimo = Math.ceil(((a.comprimento * 2 / 0.7 * 0.45) + (a.comprimento / 0.75 * 0.3)) / 3 * a.numeroVigas * PERDA);
  const perfuracaoEstacas = a.qtdEstacas * a.profEstacas * 1.15;

  const soma = somarFerro(a.ferro.estacas, a.ferro.sapatas, a.ferro.arranques, a.ferro.baldrame, a.ferro.gigante, a.ferro.colunas, a.ferro.vigas);
  const barras = barrasPorBitola(soma);
  const peso = pesoTotalFerro(barras);
  const concreto = Math.ceil(somaN(a.concreto.estacas, a.concreto.sapatas, a.concreto.arranques, a.concreto.baldrame, a.concreto.gigante, a.concreto.colunas, a.concreto.vigas) * PERDA);

  const discoFerro = Math.ceil(peso * 0.01);
  const arame = Math.ceil(peso * 0.06);
  const prego = Math.ceil(0.55 * arame);
  const vedatop = Math.ceil(((a.altura * a.comprimento) * 3 * PERDA) / 18);

  const tabuas30Total = tabuas30Arrimo + tabuas30Colun;
  const sarrafo5Total = sarrafo5Arrimo + sarrafo5Colun;

  const base = { ordem: ORD.muroArrimo, tipo: "Bruto", etapa: "Muro Arrimo" };
  emitir(out, { ...base, subEtapa: "Assentamento", item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimentoFinaAssent });
  emitir(out, { ...base, subEtapa: "Assentamento", item: "Areia fina", unidade: "m3", qtd: areiaFinaAssent });
  emitir(out, { ...base, subEtapa: "Perfuração", item: "Maquinário - Perfuração", unidade: "Mts", qtd: perfuracaoEstacas });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Madeira Caixaria - Tábuas de 20cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas15Colun });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Madeira Caixaria - Tábuas de 25cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas20Colun });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Madeira Caixaria - Tábuas de 30cm x 3mts", unidade: "Barras 3mts", qtd: tabuas30Total });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Madeira Caixaria - Sarrafos de 05cm x 3mts", unidade: "Barras 3mts", qtd: sarrafo5Total });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Madeira Caixaria - Madeirite Plastif. Preto 2,10x1,10mts 18mm", unidade: "Unidades", qtd: maderitesColun });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Disco Ferro", unidade: "Unidades", qtd: discoFerro });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Aço - Arame Recozido", unidade: "KG", qtd: arame });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Aço - Pregos 18x27", unidade: "KG", qtd: prego });
  emitBarras(out, { ...base, subEtapa: "Supra Estrutura" }, barras);
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: a.resistenciaConcreto || "Concreto", unidade: "m3", qtd: concreto });
  emitir(out, { ...base, subEtapa: "Impermeabilização", item: "Impermeabilizantes - Vedatop 18KG", unidade: "Unidades", qtd: vedatop });
  emitir(out, { ...base, subEtapa: "Paredes", item: "Cerâmicas - Tijolo - Bloco 8 Furos", unidade: "Unidades", qtd: tijolos8F });
  emitir(out, { ...base, subEtapa: "Paredes", item: "Impermeabilizantes - Vedalit 18L", unidade: "Unidades", qtd: vedalitFinaAssent });
}

// ═══════════════════════════════════════════════════════════════
// R_PISCINA.bas
// ═══════════════════════════════════════════════════════════════
function piscina(cp, out) {
  const p = cp.piscina;

  const tabua10Marcacao = Math.ceil(p.gabaritoObra / 3 * 1.2);
  // [DIVERGÊNCIA COM A SPEC §9 — reportada, preservada de propósito]
  // Esta fórmula tem um "+20" fixo, então nunca zera mesmo com
  // gabaritoObra=0 — e PISCINA() roda incondicionalmente em todo orçamento
  // no .bas original, sem nenhum "if existe piscina". Resultado real: até
  // projeto sem piscina nenhuma emite uma linha perdida de "Sarrafos de
  // 05cm x 3mts: 20" (via sarrafo5Total). A spec (§9) diz que "todo bloco
  // opcional zerado (arrimo, piscina) não emite nada" — isso vale pra
  // arrimo (conferido, fórmulas ali são puramente multiplicativas), mas não
  // pra piscina por causa deste "+20". Não suprimido aqui — é o que a
  // planilha real produziria.
  const sarrafo5Marcacao = Math.ceil((p.gabaritoObra * 1.2 / 1.3 * 0.6 / 3) + 20);
  const prego18x27Marcacao = Math.ceil(0.05 * tabua10Marcacao / 2);
  const prego17x21Marcacao = prego18x27Marcacao;

  const perfuracaoEstacas = p.qtdEstacas * p.profundidadeEstacas * 1.15;

  const pedraContrap = Math.ceil(p.areaConstruida * 0.1 * PERDA);
  const cimentoContrap = Math.ceil(pedraContrap * 6 * PERDA);
  const malhaPopContrap = Math.ceil(p.areaConstruida / (2.9 * 1.9 * PERDA));
  const areiaGrossaContrap = Math.ceil(p.areaConstruida * 0.6 * 0.1 * PERDA);

  const tijolinhoMacico = Math.ceil(p.paredesM2Total * 84.2 * PERDA);
  const areiaFinaAssent = Math.ceil(tijolinhoMacico * 0.0291 * PERDA);
  const cimentoFinaAssent = Math.ceil(areiaFinaAssent * 2 * PERDA);

  const tabuas15Colun = Math.ceil(p.colunas15 * p.profundidade * 2 / 3 * PERDA);
  const tabuas20Colun = Math.ceil(p.colunas20 * p.profundidade * 2 / 3 * PERDA);
  const tabuas30Colun = Math.ceil(p.colunas25 * p.profundidade * 2 / 3 * PERDA);
  const QTD_NUMERO_VIGAS_PISCINA = 3;
  const tabuas30Vigas = Math.ceil(((p.perimetroParedes * 2 / 3) + p.perimetroParedes * 2 / 3 * 0.45 / 3) * QTD_NUMERO_VIGAS_PISCINA * PERDA);
  const tabuas30Total = tabuas30Colun + tabuas30Vigas;

  const sarrafo5Colun = Math.ceil(
    ((p.colunas15 * p.profundidade * 2 / 0.5 * 0.2) +
      (p.colunas20 * p.profundidade * 2 / 0.5 * 0.25) +
      (p.colunas25 * p.profundidade * 2 / 0.5 * 0.35)) * PERDA / 3
  );
  const sarrafo5Vigas = Math.ceil(((p.perimetroParedes * 2 / 0.7 * 0.45) + (p.perimetroParedes / 0.75 * 0.3)) / 3 * QTD_NUMERO_VIGAS_PISCINA * PERDA);
  const sarrafo5Total = sarrafo5Colun + sarrafo5Vigas + sarrafo5Marcacao;

  const maderitesColun = Math.ceil(p.areaFormaColunaMaior25cm / 2.42 * PERDA);

  const soma = somarFerro(p.ferro.estacas, p.ferro.sapatas, p.ferro.arranques, p.ferro.baldrame, p.ferro.contrapiso, p.ferro.colunas, p.ferro.vigas);
  const barras = barrasPorBitola(soma);
  const peso = pesoTotalFerro(barras);
  const concreto = Math.ceil(somaN(p.concreto.estacas, p.concreto.sapatas, p.concreto.arranques, p.concreto.baldrame, p.concreto.contrapiso, p.concreto.colunas, p.concreto.vigas) * PERDA);

  const discoFerro = Math.ceil(peso * 0.01);
  const arame = Math.ceil(peso * 0.06);
  const prego18x27 = Math.ceil((0.55 * arame) + prego18x27Marcacao);

  const vedatopBaldrames = Math.ceil((((p.perimetroParedes * 2 * 0.3) + (p.perimetroParedes * 0.15)) * 3 * PERDA) / 18);
  const vedatopParedesContrapiso = Math.ceil(((p.paredesM2Total + p.areaConstruida) * 3 * PERDA) / 18);
  const vedatopTotal = vedatopBaldrames + vedatopParedesContrapiso;
  const telaPoliester = Math.ceil((p.paredesM2Total + p.areaConstruida) * PERDA);

  const volumeChapisco = p.paredesM2Total * PERDA * 2 * 0.005;
  const cimentoChapisco = (volumeChapisco * 0.2 * 1200 / 50) * PERDA;
  const areiaGrossaChapisco = Math.ceil((volumeChapisco * 0.8) * PERDA);
  const aguaChapisco = (volumeChapisco * 0.36) * PERDA;

  const volumeReboco = p.paredesM2Total * PERDA * 2 * 0.025;
  const cimentoReboco = (volumeReboco * 0.125 * 1200 / 50) * PERDA;
  const areiaFinaReboco = Math.ceil((volumeReboco * 0.875) * PERDA);
  const aguaReboco = (volumeReboco * 0.36) * PERDA;

  const cimentoMassiamentoPiso = Math.ceil(p.areaConstruida * 0.05 * 0.25 * 1200 / 50 * PERDA);
  const areiaGrossaMassiamentoPiso = Math.ceil(p.areaConstruida * 0.05 * 0.75 * PERDA);

  const cimentoTotal = Math.ceil(cimentoContrap + cimentoFinaAssent + cimentoChapisco + cimentoReboco);
  const aguaTotal = aguaChapisco + aguaReboco;
  const vedalit = Math.ceil((0.3 * cimentoTotal / 18) * PERDA);
  const areiaGrossaTotal = areiaGrossaContrap + areiaGrossaChapisco + areiaGrossaMassiamentoPiso;
  const areiaFinaTotal = areiaFinaAssent + areiaFinaReboco;

  const revestimento = Math.ceil(p.paredesM2Total + p.areaConstruida * 1.2);
  const rejuntes = Math.ceil(revestimento * 0.095 / 5 * PERDA);
  const argamassas = Math.ceil(revestimento * 7.5 / 20 * PERDA);
  const discoPorcelanato = Math.ceil(revestimento * 0.005 * PERDA);

  const base = { ordem: ORD.piscina, tipo: "Bruto", etapa: "Piscina" };
  emitir(out, { ...base, subEtapa: "Brocas", item: "Maquinário - Perfuração", unidade: "Mts", qtd: perfuracaoEstacas });
  emitir(out, { ...base, subEtapa: "Contrapiso", item: "Locação Ferramentas -  Compactador", unidade: "Unidades", qtd: 2 });
  emitir(out, { ...base, subEtapa: "Contrapiso", item: "Pedra", unidade: "m3", qtd: pedraContrap });
  emitir(out, { ...base, subEtapa: "Paredes", item: "Cerâmicas - Tijolo - Tijolinho Maciço", unidade: "Unidades", qtd: tijolinhoMacico });
  emitir(out, { ...base, subEtapa: "Diversas", item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimentoTotal });
  emitir(out, { ...base, subEtapa: "Diversas", item: "Água", unidade: "m3", qtd: aguaTotal });
  emitir(out, { ...base, subEtapa: "Diversas", item: "Impermeabilizantes - Vedalit 18L", unidade: "Unidades", qtd: vedalit });
  emitir(out, { ...base, subEtapa: "Diversas", item: "Areia Grossa", unidade: "m3", qtd: areiaGrossaTotal });
  emitir(out, { ...base, subEtapa: "Diversas", item: "Areia Fina", unidade: "m3", qtd: areiaFinaTotal });
  emitir(out, { ...base, subEtapa: "Impermeabilização", item: "Impermeabilizantes - Vedatop Flexível 18KG", unidade: "Unidades", qtd: vedatopTotal });
  emitir(out, { ...base, subEtapa: "Impermeabilização", item: "Impermeabilizantes - Tela Poliester 50mts", unidade: "Unidades", qtd: telaPoliester });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Madeira Caixaria - Tábuas de 10cm x 3mts", unidade: "Unidades", qtd: tabua10Marcacao });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Madeira Caixaria - Tábuas de 20cm x 3mts", unidade: "Unidades", qtd: tabuas15Colun });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Madeira Caixaria - Tábuas de 25cm x 3mts", unidade: "Unidades", qtd: tabuas20Colun });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Madeira Caixaria - Tábuas de 30cm x 3mts", unidade: "Unidades", qtd: tabuas30Total });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Madeira Caixaria - Madeirite Plastif. Preto 2,10x1,10mts 18mm", unidade: "Unidades", qtd: maderitesColun });
  emitir(out, { ...base, subEtapa: "Contrapiso", item: "Aço - Malha pop EQ092 4.2mm 15x15", unidade: "Unidades", qtd: malhaPopContrap });
  emitBarras(out, { ...base, subEtapa: "Supra Estrutura" }, barras);
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: p.resistenciaConcreto || "Concreto", unidade: "m3", qtd: concreto });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Disco Ferro", unidade: "Unidades", qtd: discoFerro });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Aço - Arame Recozido", unidade: "Kg", qtd: arame });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Aço - Pregos 18x27", unidade: "Kg", qtd: prego18x27 });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Aço - Pregos 17x21", unidade: "Kg", qtd: prego17x21Marcacao });
  emitir(out, { ...base, tipo: "Acabamento", subEtapa: "Revestimento", item: "Revestimento", unidade: "m2", qtd: revestimento });
  emitir(out, { ...base, tipo: "Acabamento", subEtapa: "Revestimento", item: "Rejunte - 5kg", unidade: "Unidades", qtd: rejuntes });
  emitir(out, { ...base, tipo: "Acabamento", subEtapa: "Revestimento", item: "Argamassa AC 3 GF - 20kg", unidade: "Unidades", qtd: argamassas });
  emitir(out, { ...base, tipo: "Acabamento", subEtapa: "Revestimento", item: "Disco Porcelanato", unidade: "Unidades", qtd: discoPorcelanato });
}

// ═══════════════════════════════════════════════════════════════
// normalizarProjeto — de obra.projeto (aninhado, §3.3) para cp (achatado +
// alguns sub-objetos por elemento estrutural). Nomes espelham os CP_* do VBA
// em camelCase. Mapa explícito abaixo, pra conferir contra a planilha;
// campo ausente sempre vira 0. Os grupos "ferro" usam sempre as 8 chaves de
// PESOS_FERRO (CA60_4MM, CA50_5MM...CA50_16MM, CA60_5MM) — mesmo quando o
// .bas daquele elemento não usa todas (ex.: colunas de Pav 1 e cobertura não
// têm CA60_4MM; nesses casos o campo fica 0 e nunca é lido).
//
//   CP_AREA_CONSTRUIDA_EDIF                    → arquitetura.areaConstruida
//   CP_M2_PAREDES_EDIF                         → arquitetura.m2ParedesTotal
//   CP_M2_PAREDES_INTERNAS/EXTERNAS_EDIF       → arquitetura.m2ParedesInternas/Externas
//   CP_GABARITO_EDIF                           → arquitetura.gabarito
//   CP_M2_PAREDES_15/20/25_TERREO_EDIF         → terreo.m2Parede15/20/25
//   CP_VAO_PORTAS_JANELAS_TERREO_EDIF          → terreo.vaoPortasJanelas
//   CP_PERIMETRO_PAREDES_TERREO_EDIF           → terreo.perimetroParedes
//   CP_AREA_M2_TERREO_EDIF                     → terreo.area
//   CP_PERIMETRO_LOJE_TERREO_EDIF              → terreo.perimetroLoje
//   CP_AREA_LOJE_TERREO_EDIF                   → terreo.areaLoje
//   CP_AREA_LOJE_MACICA_TERREO_EDIF            → terreo.areaLojeMacica
//   CP_TIPO_LOJE_TERREO_EDIF                   → terreo.tipoLoje ("Protendida"|"Treliça")
//   CP_RESIST_CONCRETO_LOJE_TERREO_EDIF        → terreo.resistenciaConcretoLoje (string)
//   CP_CONCR_VIGA_RESPALDO_TERREO_EDIF         → terreo.concretoVigaRespaldo
//   CP_CA*_VIGA_RESPALDO_TERREO_EDIF           → terreo.vigaRespaldo.{CA*}
//   CP_COLUNAS_15/20/30_TERREO_EDIF            → engenharia.colunasTerreo.{15,20,30}
//   CP_AREA_FORMA_COLUNA_MAIOR_25CM            → engenharia.colunasTerreo.areaFormaMaior25cm
//   CP_CONCR_COLUNA_TERREO_EDIF                → engenharia.colunasTerreo.concreto
//   CP_CA*_COLUNA_TERREO_EDIF                  → engenharia.colunasTerreo.ferro.{CA*}
//   (idem para pav1.* / engenharia.colunasPav1 — mesmo shape do Térreo)
//   CP_PERIMETRO_LOJE_PAV_1_EDIF               → pav1.perimetroLoje
//   CP_PERIMETRO_PAREDES_PAV_1_EDIF            → pav1.perimetroParedes
//   CP_VOLUME_CONCRETO_VIGA_RESPALDO_PAV_1_EDIF→ pav1.concretoVigaRespaldo
//   CP_QTD_ESTACAS/PROF_ESTACAS_EDIF           → engenharia.fundacao.{qtdEstacas,profEstacas}
//   CP_RESISTENCIA_CONCRETO_EDIF               → engenharia.fundacao.resistenciaConcreto (string)
//   CP_CA*_{EST,SAP,ARR,BALD}_EDIF             → engenharia.fundacao.ferro.{estacas,sapatas,arranques,baldrames}.{CA*}
//   CP_CONCR_{EST,SAP,ARR,BALD}_EDIF           → engenharia.fundacao.concreto.{estacas,sapatas,arranques,baldrames}
//   CP_COLUNAS_15/20/25_COBERTURA_EDIF         → engenharia.coberturaEstrutura.colunas.{15,20,25}
//   CP_AREA_FORMA_COLUNA_COBERTURA_MAIOR_25CM  → engenharia.coberturaEstrutura.areaFormaMaior25cm
//   CP_CA*_VIGA/COLUNA_COBERTURA_EDIF          → engenharia.coberturaEstrutura.ferro.{viga,coluna}.{CA*}
//   CP_VOLUME_CONCRETO_{COLUNA,VIGA}_RESPALDO_COBERTURA_EDIF → engenharia.coberturaEstrutura.volumeConcreto.{coluna,viga}
//   CP_REVESTIMENTO_INTERNO_EDIF               → externa.revestimentoInterno
//   CP_PAVIMENTACAO_EXTERNA / PERIMETRO_PAV_EXTERNA → externa.pavimentacao / externa.perimetroPavimentacao
//   CP_COMPRIMENTO_MURO_DIVISA/ALTURA          → externa.muroDivisa.{comprimento,altura}
//   CP_COMPRIMENTO_ARRIMO/ALTURA_ARRIMO/NUMERO_VIGAS_ARRIMO/QTD_ESTACAS_ARRIMO/PROF_ESTACAS_ARRIMO → arrimo.{comprimento,altura,numeroVigas,qtdEstacas,profEstacas}
//   CP_COLUNAS_15/20/30_ARRIMO                 → arrimo.colunas.{15,20,30}
//   CP_AREA_FORMA_COLUNA_ARRIMO_MAIOR_25CM     → arrimo.areaFormaColunaMaior25cm
//   CP_RESISTENCIA_CONCRETO_ARRIMO             → arrimo.resistenciaConcreto (string)
//   CP_CA*_{ESTACAS,SAPATAS,ARRANQUES,BALDRAME,GIGANTE,COLUNAS,VIGAS}_ARRIMO → arrimo.ferro.{...7 elementos}.{CA*}
//   CP_CONCR_{...mesmos 7}_ARRIMO               → arrimo.concreto.{...7}
//   CP_AREA_CONSTRUIDA_PISCINA / PROFUNDIDADE_PISCINA → piscina.{areaConstruida,profundidade}
//   CP_PAREDES_M2_TOTAL_PISCINA / PERIMETRO_PAREDES_PISCINA → piscina.{paredesM2Total,perimetroParedes}
//   CP_QTD/PROFUNDIDADE_ESTACAS_PISCINA        → piscina.{qtdEstacas,profundidadeEstacas}
//   CP_GABARITO_OBRA_PISCINA                   → piscina.gabaritoObra
//   CP_COLUNAS_15/20/25_PISCINA                → piscina.colunas.{15,20,25}
//   CP_AREA_FORMA_COLUNA_MAIOR_25CM_PISCINA    → piscina.areaFormaColunaMaior25cm
//   CP_RESISTENCIA_CONCRETO_PISCINA            → piscina.resistenciaConcreto (string)
//   CP_CA*_{ESTACAS,SAPATAS,ARRANQUES,BALDRAME,CONTRAPISO,COLUNAS,VIGAS}_PISCINA → piscina.ferro.{...7}.{CA*}
//   CP_CONCR_{...mesmos 7}_PISCINA              → piscina.concreto.{...7}
//   CP_COBERTURA_N/COMP/LARG/AGUAS/INCL_N_EDIF  → cobertura[N] = {tipo,comprimento,largura,aguas,inclinacao}
//   CALC_AREA_COBERTURA_TOTAL                   → escrito de volta em cp pelo próprio cobertura() (var pública no VBA)
//   CP_PRESTADORES_*                            → prestadores.<camelCase>
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// ESQUADRIAS — catálogo de perfis por tipo (linhas GOLD e SUPREMA)
// ═══════════════════════════════════════════════════════════════
// Fontes:
//   • aba ESQUADRIAS da planilha de origem (esquadria.xlsx) — janela e porta
//     de correr 2/3/4 folhas e persiana integrada, linha Gold;
//   • catálogo Alcoa "nova Gold" (desenhos de montagem p.186-233, perfis
//     p.39-69) — porta de giro, maxim-ar e quadro fixo, e a lista de
//     acessórios de cada tipo;
//   • catálogo Go Perfil 2025 — pesos (kg/m) dos perfis Suprema.
//   • preços de referência: S_ESQUADRIAS.bas (R$/kg e R$/m² de vidro).
//
//   para cada perfil do tipo:  metros = regra(largura, altura, folhas)
//                              kg     = metros × kgPorMetro × quantidade
//   vidro 8mm (m²)           = (L − descL) × (H − descH) × quantidade
//                              (correr: desconta só 14 cm na altura, como a aba;
//                               giro/maxim-ar/fixo: descontos de corte do catálogo)
//   acessórios               = porEsquadria + porFolha × folhas (ou metros
//                              de perímetro, para borrachas e escovas)
//
// Chave: "FAMILIA|FOLHAS". A linha SUPREMA usa os pesos reais do Go Perfil,
// mas a função de cada perfil (marco, montante, travessa...) foi mapeada por
// analogia com a Gold — o resultado é uma aproximação e a UI avisa isso.
// ARQUIVO GERADO a partir de docs/referencia-orcamento/esquadrias-catalogo.json.

const ESQUADRIAS_PRECOS_VBA = { aluminioKg: 39.80, vidro8mmM2: 166.63 }; // referência do S_ESQUADRIAS.bas
const ESQUADRIAS_DESCONTO_ALTURA = 0.14; // "desconta 14 cm para altura útil, folhas, vidros, persiana"
const ESQUADRIAS_BARRA_MTS = 6;          // palhetas vendem em barra de 6 m

const ESQUADRIAS_FAMILIAS = [
  { id: "JANELA_CORRER",   nome: "Janela de correr",               folhas: [2, 3, 4] },
  { id: "PORTA_CORRER",    nome: "Porta de correr",                folhas: [2, 3, 4] },
  { id: "PORTA_GIRO",      nome: "Porta de giro",                  folhas: [1, 2] },
  { id: "MAXIM_AR",        nome: "Janela maxim-ar",                folhas: [1, 2] },
  { id: "QUADRO_FIXO",     nome: "Quadro fixo (vidro fixo)",       folhas: [1] },
  { id: "JANELA_PERSIANA", nome: "Janela com persiana integrada",  folhas: [2] },
];
const ESQUADRIAS_LINHAS = [
  { id: "GOLD",    nome: "Gold",    disponivel: true },
  { id: "SUPREMA", nome: "Suprema", disponivel: true, aproximada: true,
    aviso: "pesos do catálogo Go Perfil; função de cada perfil mapeada por analogia com a Gold — resultado aproximado. Só janela e porta de correr de 2 folhas têm lista." },
];

// Desconto de vidro por família (m). Correr segue a aba (só altura −14 cm);
// os demais vêm das cotas de corte dos desenhos de montagem Gold.
//   giro:     vidro L−205 (1F) / (L−373,5)/2 por folha (2F); H−286,3
//   maxim-ar: vidro A−126,9 por folha (A = largura da folha), montante GN070 32 mm; H−152,6
//   fixo:     vidro B−117,9 nos dois sentidos
const ESQUADRIAS_VIDRO = {
  PADRAO:      { descL: 0,     descH: ESQUADRIAS_DESCONTO_ALTURA, porFolha: false },
  PORTA_GIRO:  { descLPorFolhas: { 1: 0.205, 2: 0.3735 }, descH: 0.2863, porFolha: false },
  MAXIM_AR:    { descL: 0.1269, descH: 0.1526, porFolha: true, montante: 0.032 },
  QUADRO_FIXO: { descL: 0.1179, descH: 0.1179, porFolha: false },
};

// Acessórios por tipo (códigos Alcoa dos desenhos de montagem). Unidade
// "Unidades" conta por esquadria e por folha; "Mts" usa o perímetro.
//   perimetro:      2L + 2H (marco)
//   perimetroFolha: perímetro de cada folha × folhas
//   perimetroVidro: perímetro de cada vidro × folhas
const ESQUADRIAS_ACESSORIOS = {
  JANELA_CORRER: [
    { codigo: "KITGN06", descricao: "Kit roldana + guia da folha",      porFolha: 1 },
    { codigo: "FEC1106", descricao: "Fecho concha",                      porFolha: 1 },
    { codigo: "CAL966",  descricao: "Calço de vidro",                    porFolha: 4 },
    { codigo: "NYL545",  descricao: "Kit nylons de canto da folha",      porFolha: 1 },
    { codigo: "CON536",  descricao: "Conexão de canto do marco",         porEsquadria: 4 },
    { codigo: "TRA044",  descricao: "Trava antiretirada da folha",       porFolha: 1 },
    { codigo: "GUA006",  descricao: "Guarnição de vidro (borracha)",     metros: "perimetroVidro" },
    { codigo: "GUA526",  descricao: "Escova de vedação da folha",        metros: "perimetroFolha" },
    { codigo: "CHU838",  descricao: "Chumbador do contramarco",          porMetro: 0.5, metros: "perimetro" },
    { codigo: "PAR428",  descricao: "Parafuso de fixação",               porMetro: 0.3, metros: "perimetro" },
  ],
  PORTA_CORRER: [
    { codigo: "KITGN05", descricao: "Kit roldana de porta + guia",       porFolha: 1 },
    { codigo: "FEC1208", descricao: "Fecho de porta com chave",          porEsquadria: 1 },
    { codigo: "FEC1106", descricao: "Fecho concha (folhas secundárias)", porFolha: 1, porEsquadria: -1 },
    { codigo: "CAL966",  descricao: "Calço de vidro",                    porFolha: 4 },
    { codigo: "NYL042",  descricao: "Guia superior da folha",            porFolha: 2 },
    { codigo: "CON536",  descricao: "Conexão de canto do marco",         porEsquadria: 4 },
    { codigo: "GUA006",  descricao: "Guarnição de vidro (borracha)",     metros: "perimetroVidro" },
    { codigo: "GUA526",  descricao: "Escova de vedação da folha",        metros: "perimetroFolha" },
    { codigo: "CHU838",  descricao: "Chumbador do contramarco",          porMetro: 0.5, metros: "perimetro" },
    { codigo: "PAR428",  descricao: "Parafuso de fixação",               porMetro: 0.3, metros: "perimetro" },
  ],
  PORTA_GIRO: [
    { codigo: "DOB",     descricao: "Dobradiça de porta de giro",        porFolha: 3 },
    { codigo: "FECH",    descricao: "Fechadura com maçaneta (jogo)",     porEsquadria: 1 },
    { codigo: "KITGN16", descricao: "Kit batente central (2 folhas)",    porEsquadria: 1, apenasFolhas: 2 },
    { codigo: "CON547",  descricao: "Conexão de canto do marco",         porEsquadria: 4 },
    { codigo: "CON548",  descricao: "Conexão de canto da folha",         porFolha: 4 },
    { codigo: "NYL482",  descricao: "Nylon de canto",                    porFolha: 4 },
    { codigo: "CAL966",  descricao: "Calço de vidro",                    porFolha: 8 },
    { codigo: "GUA410",  descricao: "Guarnição de vidro (borracha)",     metros: "perimetroVidro" },
    { codigo: "GUA392",  descricao: "Escova inferior da folha",          metros: "larguraFolhas" },
    { codigo: "CHU840",  descricao: "Chumbador do contramarco",          porMetro: 0.5, metros: "perimetro" },
    { codigo: "PAR428",  descricao: "Parafuso de fixação",               porMetro: 0.3, metros: "perimetro" },
  ],
  MAXIM_AR: [
    { codigo: "BRA832",  descricao: "Par de braços maxim-ar",            porFolha: 1 },
    { codigo: "FEC1212", descricao: "Fecho maxim-ar",                    porFolha: 1 },
    { codigo: "CON547",  descricao: "Conexão de canto do marco",         porEsquadria: 4 },
    { codigo: "NYL482",  descricao: "Nylon de canto da folha",           porFolha: 4 },
    { codigo: "CAL966",  descricao: "Calço de vidro",                    porFolha: 4 },
    { codigo: "GUA410",  descricao: "Guarnição de vidro (borracha)",     metros: "perimetroVidro" },
    { codigo: "GUA172",  descricao: "Escova de vedação do marco",        metros: "perimetro" },
    { codigo: "CHU838",  descricao: "Chumbador do contramarco",          porMetro: 0.5, metros: "perimetro" },
    { codigo: "PAR694",  descricao: "Parafuso de fixação",               porMetro: 0.3, metros: "perimetro" },
  ],
  QUADRO_FIXO: [
    { codigo: "CON547",  descricao: "Conexão de canto do marco",         porEsquadria: 4 },
    { codigo: "CAL966",  descricao: "Calço de vidro",                    porEsquadria: 4 },
    { codigo: "GUA410",  descricao: "Guarnição de vidro (borracha)",     metros: "perimetroVidro" },
    { codigo: "CHU838",  descricao: "Chumbador do contramarco",          porMetro: 0.5, metros: "perimetro" },
    { codigo: "PAR428",  descricao: "Parafuso de fixação",               porMetro: 0.3, metros: "perimetro" },
  ],
  JANELA_PERSIANA: [
    { codigo: "KITGN06", descricao: "Kit roldana + guia da folha",      porFolha: 1 },
    { codigo: "FEC1106", descricao: "Fecho concha",                      porFolha: 1 },
    { codigo: "CAL966",  descricao: "Calço de vidro",                    porFolha: 4 },
    { codigo: "NYL743",  descricao: "Kit eixo/rolo da persiana",         porEsquadria: 1 },
    { codigo: "CON536",  descricao: "Conexão de canto do marco",         porEsquadria: 4 },
    { codigo: "GUA006",  descricao: "Guarnição de vidro (borracha)",     metros: "perimetroVidro" },
    { codigo: "GUA526",  descricao: "Escova de vedação da folha",        metros: "perimetroFolha" },
    { codigo: "CHU838",  descricao: "Chumbador do contramarco",          porMetro: 0.5, metros: "perimetro" },
    { codigo: "PAR428",  descricao: "Parafuso de fixação",               porMetro: 0.3, metros: "perimetro" },
  ],
};

const ESQUADRIAS_CATALOGO = {
GOLD: {
  "JANELA_CORRER|2": [
    { codigo: "RM039", perfil: "Guarnição largura superior e inferior", kgPorMetro: 0.205, regra: "2 LARGURAS" },
    { codigo: "RM005", perfil: "Guarnição laterais", kgPorMetro: 0.202, regra: "2 ALTURAS" },
    { codigo: "GN003", perfil: "Trilho superior", kgPorMetro: 1.176, regra: "1 LARGURA" },
    { codigo: "GN001", perfil: "Trilho inferior", kgPorMetro: 1.555, regra: "1 LARGURA" },
    { codigo: "GN004", perfil: "Marco lateral", kgPorMetro: 0.677, regra: "2 ALTURA" },
    { codigo: "GN008", perfil: "Montante lateral folha", kgPorMetro: 0.955, regra: "2 ALTURAS" },
    { codigo: "GN006", perfil: "Travessa folha", kgPorMetro: 0.697, regra: "2 LARGURAS" },
    { codigo: "GN010", perfil: "Mão amiga externo", kgPorMetro: 0.802, regra: "2 ALTURAS" },
    { codigo: "GN013", perfil: "Baguete travessa", kgPorMetro: 0.186, regra: "2 LARGURAS" },
    { codigo: "GN009", perfil: "Baguete laterais", kgPorMetro: 0.18, regra: "2 ALTURAS POR FOLHA" },
    { codigo: "GN005", perfil: "Batedeira lateral", kgPorMetro: 0.111, regra: "2 ALTURAS" },
    { codigo: "CM060", perfil: "Contra marco", kgPorMetro: 0.276, regra: "2 ALTURAS + 2 LARGURAS" },
  ],
  "JANELA_CORRER|3": [
    { codigo: "RM039", perfil: "Guarnição largura superior e inferior", kgPorMetro: 0.205, regra: "2 LARGURAS" },
    { codigo: "RM005", perfil: "Guarnição laterais", kgPorMetro: 0.202, regra: "2 ALTURAS" },
    { codigo: "GN023", perfil: "Trilho superior", kgPorMetro: 1.76, regra: "1 LARGURA" },
    { codigo: "GN021", perfil: "Trilho inferior", kgPorMetro: 2.317, regra: "1 LARGURA" },
    { codigo: "GN025", perfil: "Marco lateral", kgPorMetro: 1.057, regra: "2 ALTURA" },
    { codigo: "GN008", perfil: "Montante lateral folha", kgPorMetro: 0.955, regra: "2 ALTURAS" },
    { codigo: "GN006", perfil: "Travessa folha", kgPorMetro: 0.697, regra: "2 LARGURAS" },
    { codigo: "GN010", perfil: "Mão amiga externo", kgPorMetro: 0.802, regra: "4 ALTURAS" },
    { codigo: "GN013", perfil: "Baguete travessa", kgPorMetro: 0.186, regra: "2 LARGURAS" },
    { codigo: "GN009", perfil: "Baguete laterais", kgPorMetro: 0.18, regra: "2 ALTURAS POR FOLHA" },
    { codigo: "GN005", perfil: "Batedeira lateral", kgPorMetro: 0.111, regra: "2 ALTURAS" },
    { codigo: "CM060", perfil: "Contra marco", kgPorMetro: 0.276, regra: "2 ALTURAS + 2 LARGURAS" },
  ],
  "JANELA_CORRER|4": [
    { codigo: "RM039", perfil: "Guarnição largura superior e inferior", kgPorMetro: 0.205, regra: "2 LARGURAS" },
    { codigo: "RM005", perfil: "Guarnição laterais", kgPorMetro: 0.202, regra: "2 ALTURAS" },
    { codigo: "GN024", perfil: "Trilho superior", kgPorMetro: 2.494, regra: "1 LARGURA" },
    { codigo: "GN022", perfil: "Trilho inferior", kgPorMetro: 3.12, regra: "1 LARGURA" },
    { codigo: "GN026", perfil: "Marco lateral", kgPorMetro: 1.445, regra: "2 ALTURA" },
    { codigo: "GN008", perfil: "Montante lateral folha", kgPorMetro: 0.955, regra: "2 ALTURAS" },
    { codigo: "GN006", perfil: "Travessa folha", kgPorMetro: 0.697, regra: "2 LARGURAS" },
    { codigo: "GN010", perfil: "Mão amiga", kgPorMetro: 0.802, regra: "6 ALTURAS" },
    { codigo: "GN013", perfil: "Baguete travessa", kgPorMetro: 0.186, regra: "2 LARGURAS" },
    { codigo: "GN009", perfil: "Baguete laterais", kgPorMetro: 0.18, regra: "2 ALTURAS POR FOLHA" },
    { codigo: "GN005", perfil: "Batedeira lateral", kgPorMetro: 0.111, regra: "2 ALTURAS" },
    { codigo: "CM060", perfil: "Contra marco", kgPorMetro: 0.276, regra: "2 ALTURAS + 2 LARGURAS" },
  ],
  "PORTA_CORRER|2": [
    { codigo: "RM039", perfil: "Guarnição largura superior e inferior", kgPorMetro: 0.205, regra: "2 LARGURAS" },
    { codigo: "RM005", perfil: "Guarnição laterais", kgPorMetro: 0.202, regra: "2 ALTURAS" },
    { codigo: "GN003", perfil: "Trilho superior", kgPorMetro: 1.176, regra: "1 LARGURA" },
    { codigo: "GN001", perfil: "Trilho inferior", kgPorMetro: 1.555, regra: "1 LARGURA" },
    { codigo: "GN004", perfil: "Marco lateral", kgPorMetro: 0.677, regra: "2 ALTURA" },
    { codigo: "GN012", perfil: "Montante lateral folha", kgPorMetro: 1.148, regra: "2 ALTURAS" },
    { codigo: "GN007", perfil: "Travessa folha superior", kgPorMetro: 0.787, regra: "1 LARGURAS" },
    { codigo: "GN014", perfil: "Travessa folha inferior", kgPorMetro: 1.159, regra: "1 LARGURAS" },
    { codigo: "GN011", perfil: "Mão amiga externo", kgPorMetro: 1.064, regra: "2 ALTURAS" },
    { codigo: "GN013", perfil: "Baguete travessa", kgPorMetro: 0.186, regra: "2 LARGURAS" },
    { codigo: "GN009", perfil: "Baguete laterais", kgPorMetro: 0.18, regra: "2 ALTURAS POR FOLHA" },
    { codigo: "GN005", perfil: "Batedeira lateral", kgPorMetro: 0.111, regra: "2 ALTURAS" },
    { codigo: "RM038", perfil: "Soleira piso", kgPorMetro: 0.232, regra: "1 LARGURA" },
    { codigo: "CM174", perfil: "Contra marco superior e laterais", kgPorMetro: 0.409, regra: "1 LARGURA E 2 ALTURAS" },
    { codigo: "CM223", perfil: "Contra marco inferior", kgPorMetro: 0.59, regra: "1 LARGURA" },
  ],
  "PORTA_CORRER|3": [
    { codigo: "RM039", perfil: "Guarnição largura superior e inferior", kgPorMetro: 0.205, regra: "2 LARGURAS" },
    { codigo: "RM005", perfil: "Guarnição laterais", kgPorMetro: 0.202, regra: "2 ALTURAS" },
    { codigo: "GN023", perfil: "Trilho superior", kgPorMetro: 1.76, regra: "1 LARGURA" },
    { codigo: "GN021", perfil: "Trilho inferior", kgPorMetro: 2.317, regra: "1 LARGURA" },
    { codigo: "GN025", perfil: "Marco lateral", kgPorMetro: 1.057, regra: "2 ALTURA" },
    { codigo: "GN012", perfil: "Montante lateral folha", kgPorMetro: 1.148, regra: "2 ALTURAS" },
    { codigo: "GN007", perfil: "Travessa folha superior", kgPorMetro: 0.787, regra: "1 LARGURAS" },
    { codigo: "GN014", perfil: "Travessa folha inferior", kgPorMetro: 1.159, regra: "1 LARGURAS" },
    { codigo: "GN011", perfil: "Mão amiga externo", kgPorMetro: 1.064, regra: "4 ALTURAS" },
    { codigo: "GN013", perfil: "Baguete travessa", kgPorMetro: 0.186, regra: "2 LARGURAS" },
    { codigo: "GN009", perfil: "Baguete laterais", kgPorMetro: 0.18, regra: "2 ALTURAS POR FOLHA" },
    { codigo: "GN005", perfil: "Batedeira lateral", kgPorMetro: 0.111, regra: "2 ALTURAS" },
    { codigo: "RM038", perfil: "Soleira piso", kgPorMetro: 0.232, regra: "1 LARGURA" },
    { codigo: "CM174", perfil: "Contra marco superior e laterais", kgPorMetro: 0.409, regra: "1 LARGURA E 2 ALTURAS" },
    { codigo: "CM223", perfil: "Contra marco inferior", kgPorMetro: 0.59, regra: "1 LARGURA" },
  ],
  "PORTA_CORRER|4": [
    { codigo: "RM039", perfil: "Guarnição largura superior e inferior", kgPorMetro: 0.205, regra: "2 LARGURAS" },
    { codigo: "RM005", perfil: "Guarnição laterais", kgPorMetro: 0.202, regra: "2 ALTURAS" },
    { codigo: "GN024", perfil: "Trilho superior", kgPorMetro: 2.494, regra: "1 LARGURA" },
    { codigo: "GN022", perfil: "Trilho inferior", kgPorMetro: 3.12, regra: "1 LARGURA" },
    { codigo: "GN026", perfil: "Marco lateral", kgPorMetro: 1.445, regra: "2 ALTURA" },
    { codigo: "GN012", perfil: "Montante lateral folha", kgPorMetro: 1.148, regra: "2 ALTURAS" },
    { codigo: "GN007", perfil: "Travessa folha superior", kgPorMetro: 0.787, regra: "1 LARGURAS" },
    { codigo: "GN014", perfil: "Travessa folha inferior", kgPorMetro: 1.159, regra: "1 LARGURAS" },
    { codigo: "GN011", perfil: "Mão amiga externo", kgPorMetro: 1.064, regra: "6 ALTURAS" },
    { codigo: "GN013", perfil: "Baguete travessa", kgPorMetro: 0.186, regra: "2 LARGURAS" },
    { codigo: "GN009", perfil: "Baguete laterais", kgPorMetro: 0.18, regra: "2 ALTURAS POR FOLHA" },
    { codigo: "GN005", perfil: "Batedeira lateral", kgPorMetro: 0.111, regra: "2 ALTURAS" },
    { codigo: "RM038", perfil: "Soleira piso", kgPorMetro: 0.232, regra: "1 LARGURA" },
    { codigo: "CM174", perfil: "Contra marco superior e laterais", kgPorMetro: 0.409, regra: "1 LARGURA E 2 ALTURAS" },
    { codigo: "CM223", perfil: "Contra marco inferior", kgPorMetro: 0.59, regra: "1 LARGURA" },
  ],
  "JANELA_PERSIANA|2": [
    { codigo: "MN015", perfil: "Exterior rolo persiana", kgPorMetro: 0.881, regra: "1 LARGURA" },
    { codigo: "DS238", perfil: "Interior rolo persiana", kgPorMetro: 0.48, regra: "1 LARGURA" },
    { codigo: "GN038", perfil: "Fundo caixa rolo persiana", kgPorMetro: 0.704, regra: "1 LARGURA" },
    { codigo: "GN032", perfil: "Topo caixa rolo persiana", kgPorMetro: 1.047, regra: "1 LARGURA" },
    { codigo: "GUA483", perfil: "Mata térmica interna da caixa", kgPorMetro: null, regra: "3 LARGURAS" },
    { codigo: "GN039", perfil: "Tampa frontal caixa rolo persiana", kgPorMetro: 0.971, regra: "1 LARGURA" },
    { codigo: "RM039", perfil: "Guarnição largura superior e inferior", kgPorMetro: 0.205, regra: "2 LARGURAS" },
    { codigo: "RM005", perfil: "Guarnição laterais", kgPorMetro: 0.202, regra: "2 ALTURAS" },
    { codigo: "VZC122", perfil: "Palheta cega", kgPorMetro: null, regra: "PALHETA_CEGA" },
    { codigo: "VZP04", perfil: "Palheta ventilada", kgPorMetro: null, regra: "PALHETA_VENTILADA" },
    { codigo: "MN055", perfil: "Palheta final", kgPorMetro: 0.371, regra: "1 LARGURA" },
    { codigo: "GN033", perfil: "Trilho superior", kgPorMetro: 2.03, regra: "1 LARGURA" },
    { codigo: "GN001", perfil: "Trilho inferior", kgPorMetro: 1.555, regra: "1 LARGURA" },
    { codigo: "GN035", perfil: "Marco lateral", kgPorMetro: 0.906, regra: "2 ALTURA" },
    { codigo: "GN008", perfil: "Montante lateral folha", kgPorMetro: 0.955, regra: "2 ALTURAS" },
    { codigo: "GN006", perfil: "Travessa folha", kgPorMetro: 0.697, regra: "2 LARGURAS" },
    { codigo: "GN010", perfil: "Mão amiga externo", kgPorMetro: 0.802, regra: "2 ALTURAS" },
    { codigo: "GN013", perfil: "Baguete travessa", kgPorMetro: 0.186, regra: "2 LARGURAS" },
    { codigo: "GN009", perfil: "Baguete laterais", kgPorMetro: 0.18, regra: "2 ALTURAS POR FOLHA" },
    { codigo: "GN005", perfil: "Batedeira lateral", kgPorMetro: 0.111, regra: "2 ALTURAS" },
    { codigo: "GN037", perfil: "Batedeira lateral", kgPorMetro: 0.191, regra: "2 ALTURAS" },
    { codigo: "MH006", perfil: "Guia lateral persiana", kgPorMetro: 0.697, regra: "2 ALTURAS MENOS 14 CM" },
    { codigo: "CM060", perfil: "Contra marco", kgPorMetro: 0.276, regra: "2 ALTURAS + 2 LARGURAS" },
  ],
  // ── Porta de giro (catálogo Gold p.225-227) ──
  // marco GN020 em 3 lados; folha GN052 (montantes + travessa superior),
  // travessa intermediária GN061+GN063, travessa inferior GN014, pingadeira
  // GN055; batente central GN053 só em 2 folhas; baguete GN009 em cada vidro.
  "PORTA_GIRO|1": [
    { codigo: "CM200", perfil: "Contra marco", kgPorMetro: 0.198, regra: "1 LARGURA E 2 ALTURAS" },
    { codigo: "RM039", perfil: "Guarnição superior", kgPorMetro: 0.205, regra: "1 LARGURA" },
    { codigo: "RM005", perfil: "Guarnição laterais", kgPorMetro: 0.202, regra: "2 ALTURAS" },
    { codigo: "GN020", perfil: "Marco", kgPorMetro: 0.843, regra: "1 LARGURA E 2 ALTURAS" },
    { codigo: "GN052", perfil: "Montante da folha", kgPorMetro: 1.201, regra: "2 ALTURAS POR FOLHA" },
    { codigo: "GN052", perfil: "Travessa superior da folha", kgPorMetro: 1.201, regra: "1 LARGURA" },
    { codigo: "GN061", perfil: "Travessa intermediária", kgPorMetro: 0.787, regra: "1 LARGURA" },
    { codigo: "GN063", perfil: "Travessa intermediária (complemento)", kgPorMetro: 0.555, regra: "1 LARGURA" },
    { codigo: "GN014", perfil: "Travessa inferior da folha", kgPorMetro: 1.159, regra: "1 LARGURA" },
    { codigo: "GN055", perfil: "Pingadeira inferior", kgPorMetro: 0.181, regra: "1 LARGURA" },
    { codigo: "GN009", perfil: "Baguete", kgPorMetro: 0.18, regra: "2 ALTURAS POR FOLHA" },
    { codigo: "GN009", perfil: "Baguete travessas", kgPorMetro: 0.18, regra: "4 LARGURAS" },
  ],
  "PORTA_GIRO|2": [
    { codigo: "CM200", perfil: "Contra marco", kgPorMetro: 0.198, regra: "1 LARGURA E 2 ALTURAS" },
    { codigo: "RM039", perfil: "Guarnição superior", kgPorMetro: 0.205, regra: "1 LARGURA" },
    { codigo: "RM005", perfil: "Guarnição laterais", kgPorMetro: 0.202, regra: "2 ALTURAS" },
    { codigo: "GN020", perfil: "Marco", kgPorMetro: 0.843, regra: "1 LARGURA E 2 ALTURAS" },
    { codigo: "GN052", perfil: "Montante da folha", kgPorMetro: 1.201, regra: "2 ALTURAS POR FOLHA" },
    { codigo: "GN052", perfil: "Travessa superior da folha", kgPorMetro: 1.201, regra: "1 LARGURA" },
    { codigo: "GN061", perfil: "Travessa intermediária", kgPorMetro: 0.787, regra: "1 LARGURA" },
    { codigo: "GN063", perfil: "Travessa intermediária (complemento)", kgPorMetro: 0.555, regra: "1 LARGURA" },
    { codigo: "GN014", perfil: "Travessa inferior da folha", kgPorMetro: 1.159, regra: "1 LARGURA" },
    { codigo: "GN055", perfil: "Pingadeira inferior", kgPorMetro: 0.181, regra: "1 LARGURA" },
    { codigo: "GN053", perfil: "Batente central", kgPorMetro: 0.789, regra: "1 ALTURA" },
    { codigo: "GN009", perfil: "Baguete", kgPorMetro: 0.18, regra: "2 ALTURAS POR FOLHA" },
    { codigo: "GN009", perfil: "Baguete travessas", kgPorMetro: 0.18, regra: "4 LARGURAS" },
  ],
  // ── Maxim-ar (catálogo Gold p.223-224) ──
  // marco GN020 nos 4 lados + adaptador GN018; folha GN019; montante GN070
  // entre folhas; baguete GN013 no vidro.
  "MAXIM_AR|1": [
    { codigo: "CM200", perfil: "Contra marco", kgPorMetro: 0.198, regra: "2 ALTURAS + 2 LARGURAS" },
    { codigo: "RM039", perfil: "Guarnição largura superior e inferior", kgPorMetro: 0.205, regra: "2 LARGURAS" },
    { codigo: "RM005", perfil: "Guarnição laterais", kgPorMetro: 0.202, regra: "2 ALTURAS" },
    { codigo: "GN020", perfil: "Marco", kgPorMetro: 0.843, regra: "2 ALTURAS + 2 LARGURAS" },
    { codigo: "GN018", perfil: "Adaptador maxim-ar do marco", kgPorMetro: 0.711, regra: "2 ALTURAS + 2 LARGURAS" },
    { codigo: "GN019", perfil: "Folha maxim-ar", kgPorMetro: 0.263, regra: "2 ALTURAS + 2 LARGURAS" },
    { codigo: "GN013", perfil: "Baguete", kgPorMetro: 0.186, regra: "2 ALTURAS + 2 LARGURAS" },
  ],
  "MAXIM_AR|2": [
    { codigo: "CM200", perfil: "Contra marco", kgPorMetro: 0.198, regra: "2 ALTURAS + 2 LARGURAS" },
    { codigo: "RM039", perfil: "Guarnição largura superior e inferior", kgPorMetro: 0.205, regra: "2 LARGURAS" },
    { codigo: "RM005", perfil: "Guarnição laterais", kgPorMetro: 0.202, regra: "2 ALTURAS" },
    { codigo: "GN020", perfil: "Marco", kgPorMetro: 0.843, regra: "2 ALTURAS + 2 LARGURAS" },
    { codigo: "GN070", perfil: "Montante entre folhas", kgPorMetro: 0.422, regra: "1 ALTURA" },
    { codigo: "GN018", perfil: "Adaptador maxim-ar do marco", kgPorMetro: 0.711, regra: "2 ALTURAS POR FOLHA + 2 LARGURAS" },
    { codigo: "GN019", perfil: "Folha maxim-ar", kgPorMetro: 0.263, regra: "2 ALTURAS POR FOLHA + 2 LARGURAS" },
    { codigo: "GN013", perfil: "Baguete", kgPorMetro: 0.186, regra: "2 ALTURAS POR FOLHA + 2 LARGURAS" },
  ],
  // ── Quadro fixo (bandeira/peitoril fixo, catálogo Gold p.223 e p.232) ──
  // marco GN020 + adaptador de fixo GN074 + baguete GN013, nos 4 lados.
  "QUADRO_FIXO|1": [
    { codigo: "CM200", perfil: "Contra marco", kgPorMetro: 0.198, regra: "2 ALTURAS + 2 LARGURAS" },
    { codigo: "RM039", perfil: "Guarnição largura superior e inferior", kgPorMetro: 0.205, regra: "2 LARGURAS" },
    { codigo: "RM005", perfil: "Guarnição laterais", kgPorMetro: 0.202, regra: "2 ALTURAS" },
    { codigo: "GN020", perfil: "Marco", kgPorMetro: 0.843, regra: "2 ALTURAS + 2 LARGURAS" },
    { codigo: "GN074", perfil: "Adaptador de vidro fixo", kgPorMetro: 0.389, regra: "2 ALTURAS + 2 LARGURAS" },
    { codigo: "GN013", perfil: "Baguete", kgPorMetro: 0.186, regra: "2 ALTURAS + 2 LARGURAS" },
  ],
},
// Suprema: pesos do Go Perfil 2025 (p.27-44). Função dos perfis por
// analogia com a Gold — ver aviso em ESQUADRIAS_LINHAS.
SUPREMA: {
  "JANELA_CORRER|2": [
    { codigo: "SU-291", perfil: "Guarnição (4 lados)", kgPorMetro: 0.263, regra: "2 ALTURAS + 2 LARGURAS" },
    { codigo: "SU-001", perfil: "Trilho superior", kgPorMetro: 0.738, regra: "1 LARGURA" },
    { codigo: "SU-002", perfil: "Trilho inferior", kgPorMetro: 0.696, regra: "1 LARGURA" },
    { codigo: "SU-003", perfil: "Marco lateral", kgPorMetro: 0.52, regra: "2 ALTURAS" },
    { codigo: "SU-039", perfil: "Montante lateral folha", kgPorMetro: 0.52, regra: "2 ALTURAS" },
    { codigo: "SU-041", perfil: "Montante de fecho (mão amiga)", kgPorMetro: 0.507, regra: "2 ALTURAS" },
    { codigo: "SU-040", perfil: "Travessa folha", kgPorMetro: 0.48, regra: "2 LARGURAS" },
    { codigo: "SU-053", perfil: "Batedeira lateral", kgPorMetro: 0.469, regra: "2 ALTURAS" },
    { codigo: "SU-102", perfil: "Baguete", kgPorMetro: 0.111, regra: "2 ALTURAS POR FOLHA + 2 LARGURAS" },
    { codigo: "CM060", perfil: "Contra marco", kgPorMetro: 0.276, regra: "2 ALTURAS + 2 LARGURAS" },
  ],
  "PORTA_CORRER|2": [
    { codigo: "SU-291", perfil: "Guarnição (3 lados)", kgPorMetro: 0.263, regra: "1 LARGURA E 2 ALTURAS" },
    { codigo: "SU-001", perfil: "Trilho superior", kgPorMetro: 0.738, regra: "1 LARGURA" },
    { codigo: "SU-228", perfil: "Trilho inferior de porta", kgPorMetro: 0.688, regra: "1 LARGURA" },
    { codigo: "SU-003", perfil: "Marco lateral", kgPorMetro: 0.52, regra: "2 ALTURAS" },
    { codigo: "SU-044", perfil: "Montante lateral folha", kgPorMetro: 0.97, regra: "2 ALTURAS" },
    { codigo: "SU-225", perfil: "Montante de fecho (mão amiga)", kgPorMetro: 1.003, regra: "2 ALTURAS" },
    { codigo: "SU-047", perfil: "Travessa folha superior", kgPorMetro: 1.041, regra: "1 LARGURA" },
    { codigo: "SU-049", perfil: "Travessa folha inferior", kgPorMetro: 1.042, regra: "1 LARGURA" },
    { codigo: "SU-053", perfil: "Batedeira lateral", kgPorMetro: 0.469, regra: "2 ALTURAS" },
    { codigo: "SU-227", perfil: "Soleira piso", kgPorMetro: 0.55, regra: "1 LARGURA" },
    { codigo: "SU-102", perfil: "Baguete", kgPorMetro: 0.111, regra: "2 ALTURAS POR FOLHA + 2 LARGURAS" },
    { codigo: "CM174", perfil: "Contra marco superior e laterais", kgPorMetro: 0.409, regra: "1 LARGURA E 2 ALTURAS" },
  ],
},
};

// ── Regras de metragem ───────────────────────────────────────
// A aba escreve a regra em texto ("2 ALTURAS POR FOLHA", "1 LARGURA E 2
// ALTURAS"...). Aqui cada padrão vira uma função (largura, altura, folhas)
// → metros lineares. Regra desconhecida → 0 e um aviso, nunca um chute.
function metrosPorRegra(regra, L, H, folhas) {
  const r = String(regra || "").trim().toUpperCase();
  const Hu = Math.max(0, H - ESQUADRIAS_DESCONTO_ALTURA);
  if (r === "PALHETA_CEGA" || r === "PALHETA_VENTILADA") return null; // tratadas à parte
  if (r === "2 ALTURAS MENOS 14 CM") return 2 * Hu;
  if (r === "2 ALTURAS + 2 LARGURAS") return 2 * H + 2 * L;
  if (r === "1 LARGURA E 2 ALTURAS") return L + 2 * H;
  if (r === "2 ALTURAS POR FOLHA") return 2 * H * folhas;
  if (r === "2 ALTURAS POR FOLHA + 2 LARGURAS") return 2 * H * folhas + 2 * L;
  let m = /^(\d+)\s+(LARGURA|ALTURA)S?$/.exec(r);
  if (m) return Number(m[1]) * (m[2] === "LARGURA" ? L : H);
  return 0;
}

// Área e perímetros de vidro de uma esquadria, pela regra da família.
function vidroEsquadria(familia, L, H, folhas) {
  const v = ESQUADRIAS_VIDRO[familia] || ESQUADRIAS_VIDRO.PADRAO;
  const n = Math.max(1, folhas || 1);
  const hV = Math.max(0, H - v.descH);
  if (v.porFolha) {
    // cada folha tem seu vidro: largura da folha menos o desconto
    const lFolha = (L - (v.montante || 0) * (n - 1)) / n;
    const lV = Math.max(0, lFolha - v.descL);
    return { area: lV * hV * n, perimetro: 2 * (lV + hV) * n };
  }
  const descL = v.descLPorFolhas ? (v.descLPorFolhas[n] != null ? v.descLPorFolhas[n] : v.descLPorFolhas[1]) : v.descL;
  const lV = Math.max(0, L - descL);
  // correr/giro: um pano de vidro por folha, somando a largura total
  return { area: lV * hV, perimetro: 2 * (lV / n + hV) * n };
}

// Acessórios de uma esquadria → [{codigo, descricao, unidade, qtd}] (por peça).
function acessoriosEsquadria(familia, L, H, folhas) {
  const lista = ESQUADRIAS_ACESSORIOS[familia] || [];
  const n = Math.max(1, folhas || 1);
  const vidro = vidroEsquadria(familia, L, H, n);
  const medidas = {
    perimetro: 2 * L + 2 * H,
    perimetroFolha: 2 * (L / n + H) * n,
    perimetroVidro: vidro.perimetro,
    larguraFolhas: L,
  };
  const saida = [];
  for (const a of lista) {
    if (a.apenasFolhas != null && a.apenasFolhas !== n) continue;
    if (a.metros) {
      const m = medidas[a.metros] || 0;
      if (a.porMetro) saida.push({ codigo: a.codigo, descricao: a.descricao, unidade: "Unidades", qtd: Math.ceil(m / a.porMetro) });
      else saida.push({ codigo: a.codigo, descricao: a.descricao, unidade: "Mts", qtd: Math.round(m * 100) / 100 });
      continue;
    }
    const qtd = (a.porEsquadria || 0) + (a.porFolha || 0) * n;
    if (qtd > 0) saida.push({ codigo: a.codigo, descricao: a.descricao, unidade: "Unidades", qtd });
  }
  return saida;
}

// Palhetas da persiana integrada — regra literal da aba:
//   cega:       (H − 0,14) / 0,04 = nº de palhetas; × 20% × L = metros; ÷ 6 = barras
//   ventilada:  nº de palhetas × L = metros; ÷ 6 = barras; menos as barras de cega
function barrasPalhetas(L, H) {
  const n = Math.max(0, (H - ESQUADRIAS_DESCONTO_ALTURA) / 0.04);
  const cega = (n * 0.2 * L) / ESQUADRIAS_BARRA_MTS;
  const ventilada = Math.max(0, (n * L) / ESQUADRIAS_BARRA_MTS - cega);
  return { cega, ventilada };
}

// Uma esquadria → lista de {item, unidade, qtd, subEtapa}. Pura.
function calcularEsquadria(e, avisos) {
  const linha = ESQUADRIAS_CATALOGO[e.linha] || {};
  const chave = `${e.familia}|${e.folhas}`;
  const perfis = linha[chave];
  const familia = ESQUADRIAS_FAMILIAS.find((f) => f.id === e.familia);
  const rotulo = `${familia ? familia.nome : e.familia} ${e.folhas} folhas · ${e.linha}`;
  const saida = [];
  if (!perfis) {
    if (avisos) avisos.push({ tipo: "esquadria_sem_catalogo", mensagem: `Sem lista de perfis para ${rotulo}`, esquadria: e });
    return saida;
  }
  const L = numOrZero(e.largura), H = numOrZero(e.altura), q = numOrZero(e.qtd);
  if (!(L > 0) || !(H > 0) || !(q > 0)) return saida;
  const linhaDef = ESQUADRIAS_LINHAS.find((l) => l.id === e.linha);
  if (linhaDef && linhaDef.aproximada && avisos && !avisos.some((a) => a.tipo === "esquadria_linha_aproximada" && a.linha === e.linha)) {
    avisos.push({ tipo: "esquadria_linha_aproximada", linha: e.linha, mensagem: `Linha ${linhaDef.nome}: ${linhaDef.aviso}` });
  }

  for (const p of perfis) {
    if (p.regra === "PALHETA_CEGA" || p.regra === "PALHETA_VENTILADA") {
      const b = barrasPalhetas(L, H);
      const barras = (p.regra === "PALHETA_CEGA" ? b.cega : b.ventilada) * q;
      saida.push({ item: `Alumínio ${e.linha} - ${p.codigo} - ${p.perfil}`, codigo: p.codigo, unidade: "Barras 6mts", qtd: Math.ceil(barras), subEtapa: rotulo });
      continue;
    }
    const metros = metrosPorRegra(p.regra, L, H, e.folhas);
    if (metros === 0 && avisos) avisos.push({ tipo: "esquadria_regra", mensagem: `Regra "${p.regra}" não reconhecida em ${p.codigo}`, esquadria: e });
    if (!(metros > 0)) continue;
    if (p.kgPorMetro != null) {
      saida.push({ item: `Alumínio ${e.linha} - ${p.codigo} - ${p.perfil}`, codigo: p.codigo, unidade: "Kg", qtd: Math.round(metros * p.kgPorMetro * q * 100) / 100, subEtapa: rotulo });
    } else {
      // sem peso na aba (ex.: GUA483 mata térmica, vende em rolo) → metros lineares
      saida.push({ item: `${p.perfil} - ${p.codigo}`, codigo: p.codigo, unidade: "Mts", qtd: Math.ceil(metros * q), subEtapa: rotulo });
    }
  }
  // vidro: pela regra de desconto da família, por peça
  const vidro = vidroEsquadria(e.familia, L, H, e.folhas).area * q;
  if (vidro > 0) saida.push({ item: "Vidro 8mm", unidade: "m2", qtd: Math.round(vidro * 100) / 100, subEtapa: rotulo });
  // acessórios: contagem por esquadria/folha ou metros de perímetro
  for (const a of acessoriosEsquadria(e.familia, L, H, e.folhas)) {
    const qtd = a.unidade === "Mts" ? Math.ceil(a.qtd * q) : a.qtd * q;
    saida.push({ item: `Acessório esquadria - ${a.codigo} - ${a.descricao}`, codigo: a.codigo, unidade: a.unidade, qtd, subEtapa: rotulo });
  }
  return saida;
}

// Preço de um componente da esquadria (perfil, vidro ou acessório):
//   1. catálogo de insumos (insumos.jsx vem antes no bundle) — procura pelo
//      nome do item e pelo código Alcoa (cadastre o código como alias);
//   2. alumínio e vidro sem cadastro: referência do S_ESQUADRIAS.bas;
//   3. o resto (acessórios): mesmo caminho de preço do orçamento inteiro.
function precoComponenteEsquadria(comp, data) {
  if (typeof resolverInsumo === "function" && typeof precoInsumo === "function" && data && Array.isArray(data.materiais) && data.materiais.length) {
    const termos = comp.codigo ? [comp.codigo, comp.item] : [comp.item];
    for (const t of termos) {
      const r = resolverInsumo(t, data.materiais);
      if (r && r.insumo) {
        const p = precoInsumo(r.insumo);
        if (p && p.preco != null) return { preco: p.preco, fonte: "insumo" };
      }
    }
  }
  if (comp.unidade === "Kg") return { preco: ESQUADRIAS_PRECOS_VBA.aluminioKg, fonte: "referencia" };
  if (comp.item === "Vidro 8mm") return { preco: ESQUADRIAS_PRECOS_VBA.vidro8mmM2, fonte: "referencia" };
  const r = precoDoInsumo(comp.item, data);
  return r.preco != null ? { preco: r.preco, fonte: "insumo" } : { preco: 0, fonte: "sem_preco" };
}

function rotuloEsquadria(e) {
  const familia = ESQUADRIAS_FAMILIAS.find((f) => f.id === e.familia);
  const linha = ESQUADRIAS_LINHAS.find((l) => l.id === e.linha);
  const n = Number(e.folhas) || 1;
  const fmt = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${familia ? familia.nome : e.familia} ${n} folha${n !== 1 ? "s" : ""} · ${linha ? linha.nome : e.linha} · ${fmt(e.largura)} × ${fmt(e.altura)} m`;
}

// Módulo do motor — mesmo padrão dos demais: lê cp, emite em out.
// Sem fator de perda: esquadria é fabricada sob medida, não consumida em obra.
// Emite UMA linha por esquadria, com o preço unitário fechado (alumínio +
// vidro + acessórios); a composição fica em `composicao`, fora da tabela.
function esquadrias(cp, out, data) {
  const lista = Array.isArray(cp.esquadrias) ? cp.esquadrias : [];
  const avisos = cp._avisos || (cp._avisos = []);
  for (const e of lista) {
    const componentes = calcularEsquadria({ ...e, qtd: 1 }, avisos);
    if (!componentes.length) continue;
    let precoUnitario = 0;
    const composicao = componentes.map((c) => {
      const { preco, fonte } = precoComponenteEsquadria(c, data);
      precoUnitario += c.qtd * preco;
      return { item: c.item, codigo: c.codigo, unidade: c.unidade, qtd: c.qtd, preco, fonte, total: Math.round(c.qtd * preco * 100) / 100 };
    });
    const linha = ESQUADRIAS_LINHAS.find((l) => l.id === e.linha);
    const semPreco = composicao.filter((c) => c.fonte === "sem_preco");
    if (semPreco.length && !avisos.some((a) => a.tipo === "esquadria_componente_sem_preco")) {
      avisos.push({ tipo: "esquadria_componente_sem_preco", mensagem: `Componentes de esquadria sem preço em Insumos (${[...new Set(semPreco.map((c) => c.codigo || c.item))].slice(0, 6).join(", ")}${semPreco.length > 6 ? "…" : ""}) — entram com R$ 0 no preço fechado` });
    }
    emitir(out, {
      ordem: ORD.esquadrias, item: rotuloEsquadria(e), tipo: "Acabamento", etapa: "Esquadrias",
      subEtapa: linha ? `Linha ${linha.nome}` : e.linha, unidade: "Unidades", qtd: numOrZero(e.qtd),
      preco: Math.round(precoUnitario * 100) / 100, composicao, confianca: semPreco.length ? "parcial" : "modulo",
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// PISOS E REVESTIMENTOS — módulo novo (não existia no VBA)
// ═══════════════════════════════════════════════════════════════
// O NOVO MODELO ORÇAMENTO.xlsm tinha só os campos de entrada (GERAL!B49:B55:
// revestimentos internos/externos, piso interno/externo, deck, bancadas) sem
// fórmula nenhuma na casa; as únicas fórmulas de revestimento eram as da
// piscina (R_PISCINA.bas): argamassa AC3 7,5 kg/m², disco 0,005/m² e um
// rejunte de 0,095 kg/m² que não bate com nenhum fabricante. Aqui:
//   • peça: m² × PERDA, produto do projeto (escolhido no orçamento) ou o
//     genérico do padrão da obra (REV-054…065 na semente);
//   • argamassa colante: porcelanato / peça ≥ 45 cm / externo → AC-III
//     7,5 kg/m² (dupla colagem, mesma taxa da piscina); cerâmica e azulejo →
//     AC-II 4,5 kg/m²; sacos de 20 kg;
//   • rejunte: geometria da junta — comprimento de junta por m² ×
//     largura × profundidade × 1.600 kg/m³ × 1,5 (perda e sobra) — dá 0,24
//     kg/m² num 60x60 com 2 mm e 0,58 kg/m² num azulejo 10x20 com 2 mm, na
//     faixa das tabelas Quartzolit/Eliane; sacos de 5 kg;
//   • espaçadores: peça ≥ 60 cm usa clip nivelador (3 por peça) + cunha
//     (1 para cada 3 clips, reaproveitada); peça menor usa cruzeta (1 por
//     peça, pacote de 100);
//   • disco de porcelanato 0,005/m² (piscina), salva-piso 1 rolo/25 m²;
//   • deck (m² + Cetol 1 lata/20 m²), bancadas (m²), soleiras e peitoris
//     (m lineares × 0,15 m de largura), rodapé (poliestireno barra 2,40 m
//     ou recorte do próprio piso: m × 0,10 m²).
// Etapa "Pisos e revestimentos" (ORD.pisos = 25, Acabamento). O cronograma
// mede AZULEJO e PISO_CERAMICO a partir destes m².

const FORMATOS_PECA = [
  { id: "10x20", nome: "10 × 20 cm (azulejo)", a: 0.10, b: 0.20, esp: 8 },
  { id: "20x20", nome: "20 × 20 cm", a: 0.20, b: 0.20, esp: 8 },
  { id: "30x60", nome: "30 × 60 cm", a: 0.30, b: 0.60, esp: 9 },
  { id: "45x45", nome: "45 × 45 cm", a: 0.45, b: 0.45, esp: 9 },
  { id: "45x90", nome: "45 × 90 cm", a: 0.45, b: 0.90, esp: 10 },
  { id: "60x60", nome: "60 × 60 cm", a: 0.60, b: 0.60, esp: 10 },
  { id: "60x120", nome: "60 × 120 cm", a: 0.60, b: 1.20, esp: 10 },
  { id: "90x90", nome: "90 × 90 cm", a: 0.90, b: 0.90, esp: 10 },
  { id: "120x120", nome: "120 × 120 cm", a: 1.20, b: 1.20, esp: 11 },
];
const SUPERFICIES_PISOS = [
  { id: "pisoInterno", nome: "Piso interno", subEtapa: "Piso interno", tipo: "piso", externo: false },
  { id: "pisoExterno", nome: "Piso externo", subEtapa: "Piso externo", tipo: "piso", externo: true },
  { id: "revestimentoInterno", nome: "Revestimento de parede interno", subEtapa: "Revestimento interno", tipo: "parede", externo: false },
  { id: "revestimentoExterno", nome: "Revestimento de parede externo (fachada)", subEtapa: "Revestimento externo", tipo: "parede", externo: true },
];
// Genérico da semente por superfície e padrão da obra
const PISOS_GENERICOS = {
  pisoInterno:         { MCMV: "Piso - Cerâmica padrão Baixo", Baixo: "Piso - Cerâmica padrão Baixo", Médio: "Piso - Porcelanato padrão Médio", Alto: "Piso - Porcelanato padrão Alto", Altíssimo: "Piso - Porcelanato padrão Altíssimo" },
  pisoExterno:         { MCMV: "Piso - Externo cerâmico padrão Baixo", Baixo: "Piso - Externo cerâmico padrão Baixo", Médio: "Piso - Externo antiderrapante padrão Médio", Alto: "Piso - Externo antiderrapante padrão Alto", Altíssimo: "Piso - Externo antiderrapante padrão Altíssimo" },
  revestimentoInterno: { MCMV: "Revestimento - Azulejo padrão Baixo", Baixo: "Revestimento - Azulejo padrão Baixo", Médio: "Revestimento - Azulejo padrão Médio", Alto: "Revestimento - Porcelanato parede padrão Alto", Altíssimo: "Revestimento - Porcelanato parede padrão Altíssimo" },
  revestimentoExterno: { MCMV: "Piso - Externo cerâmico padrão Baixo", Baixo: "Piso - Externo cerâmico padrão Baixo", Médio: "Revestimento - Porcelanato parede padrão Alto", Alto: "Revestimento - Porcelanato parede padrão Alto", Altíssimo: "Revestimento - Porcelanato parede padrão Altíssimo" },
};
// Formato padrão quando não informado (peça cresce com o padrão)
const FORMATO_PADRAO = { pisoInterno: { MCMV: "45x45", Baixo: "45x45", Médio: "60x60", Alto: "90x90", Altíssimo: "120x120" },
  pisoExterno: { MCMV: "45x45", Baixo: "45x45", Médio: "60x60", Alto: "60x60", Altíssimo: "90x90" },
  revestimentoInterno: { MCMV: "30x60", Baixo: "30x60", Médio: "30x60", Alto: "45x90", Altíssimo: "60x120" },
  revestimentoExterno: { MCMV: "30x60", Baixo: "30x60", Médio: "30x60", Alto: "45x90", Altíssimo: "60x120" } };
const RODAPE_TIPOS = [{ value: "poliestireno", label: "Poliestireno 15 cm (barra 2,40 m)" }, { value: "mesmoPiso", label: "Recorte do próprio piso (10 cm)" }, { value: "nenhum", label: "Sem rodapé" }];
const SOLEIRA_PADRAO = "Soleiras Preto São Gabriel";
const SOLEIRA_LARGURA_M = 0.15;
// Bancadas de granito/mármore: cada bancada vira m² de pedra pronta — tampo
// (comprimento × profundidade), saia (frente, altura em cm), fundo/rodabanca
// (encosto na parede, altura em cm) e sapatas (apoios sob o tampo,
// quantidade × profundidade × largura em cm). A marmoraria cobra as tiras
// como m² de pedra; não há perda porque a peça vem pronta.
const BANCADA_PADRAO = { nome: "", comprimento: "", profundidade: 0.60, saiaCm: 5, fundoCm: 10, sapatas: 2, sapataCm: 10, produto: "" };
const BANCADA_PRODUTO_PADRAO = "Granito - Bancadas";
const BANCADAS_MAX = 20;
function medirBancada(b) {
  const C = numOrZero(b.comprimento), P = numOrZero(b.profundidade);
  const tampo = C * P;
  const saia = C * numOrZero(b.saiaCm) / 100;
  const fundo = C * numOrZero(b.fundoCm) / 100;
  const sapatas = numOrZero(b.sapatas) * P * numOrZero(b.sapataCm) / 100;
  const total = tampo + saia + fundo + sapatas;
  const r2 = (x) => Math.round(x * 100) / 100;
  return { tampo: r2(tampo), saia: r2(saia), fundo: r2(fundo), sapatas: r2(sapatas), total: r2(total) };
}
const ARGAMASSA_KG_M2 = { AC3: 7.5, AC2: 4.5 };
const REJUNTE_DENSIDADE = 1600, REJUNTE_FATOR = 1.5;

// Arredonda m² para cima em centésimos sem o ruído de ponto flutuante (100 × 1,1 = 110,00, não 110,01)
function ceil2(x) { return Math.ceil(x * 100 - 1e-7) / 100; }
function formatoPeca(id) { return FORMATOS_PECA.find((f) => f.id === id) || FORMATOS_PECA.find((f) => f.id === "60x60"); }
function ehPorcelanato(fmt, externo) { return externo || Math.min(fmt.a, fmt.b) >= 0.45; }
function juntaMmPadrao(fmt) { return Math.min(fmt.a, fmt.b) >= 0.60 ? 2 : (Math.max(fmt.a, fmt.b) <= 0.20 ? 2 : 3); }

// Consumos por m² de uma superfície: argamassa (kg), rejunte (kg), peças,
// clips/cunhas ou cruzetas. Puro, testável.
function consumoRevestimento(formatoId, externo, juntaMm) {
  const fmt = formatoPeca(formatoId);
  const porcelanato = ehPorcelanato(fmt, externo);
  const junta = juntaMm > 0 ? juntaMm : juntaMmPadrao(fmt);
  const pecasM2 = 1 / (fmt.a * fmt.b);
  const juntaM = (fmt.a + fmt.b) / (fmt.a * fmt.b); // metros de junta por m²
  const rejunteKg = juntaM * (junta / 1000) * (fmt.esp / 1000) * REJUNTE_DENSIDADE * REJUNTE_FATOR;
  const nivelador = Math.min(fmt.a, fmt.b) >= 0.60;
  return {
    formato: fmt, porcelanato, juntaMm: junta, pecasM2,
    argamassa: porcelanato ? "AC3" : "AC2", argamassaKg: porcelanato ? ARGAMASSA_KG_M2.AC3 : ARGAMASSA_KG_M2.AC2,
    rejunteKg: Math.round(rejunteKg * 1000) / 1000,
    nivelador, clipsM2: nivelador ? pecasM2 * 3 : 0, cruzetasM2: nivelador ? 0 : pecasM2,
  };
}

// ── Pré-preenchimento pelos cômodos ─────────────────────────────
// Usa as medidas por tamanho (Grande/Médio/Pequeno/Compacta) do orçamento
// de projetos (COMODOS em shared.jsx) e a contagem de cômodos do bloco
// Geral para estimar piso, revestimento de parede, rodapé, soleiras e
// bancadas. É ponto de partida: o botão preenche os campos e o usuário
// ajusta pelo projeto.
const TAMANHOS_COMODOS = ["Grande", "Médio", "Pequeno", "Compacta"];
const PE_DIREITO_REVESTIMENTO = 2.6; // altura de azulejo em áreas molhadas
const PORTA_M2 = 0.8 * 2.1, PORTA_LARGURA = 0.8;
// cômodo da obra → cômodo do orçamento de projetos, e regras de acabamento
const COMODO_OBRA_PROJETO = {
  banheiroSuite:  { comodo: "WC",             revestimento: "total",  bancada: { comprimento: "menor", profundidade: 0.5 } },
  banheiroSocial: { comodo: "WC",             revestimento: "total",  bancada: { comprimento: "menor", profundidade: 0.5 } },
  lavabo:         { comodo: "Lavabo",         revestimento: "total",  bancada: { comprimento: 0.8, profundidade: 0.45 } },
  cozinha:        { comodo: "Cozinha",        revestimento: "total",  bancada: { comprimento: "maior", profundidade: 0.6 } },
  lavanderia:     { comodo: "Lavanderia",     revestimento: "meia",   bancada: { comprimento: 1.2, profundidade: 0.6 } },
  areaGourmet:    { comodo: "Área de lazer",  revestimento: "parede", bancada: { comprimento: 2.0, profundidade: 0.6 } },
  dormitorio:     { comodo: "Dormitório",     rodape: true },
  closet:         { comodo: "Closet",         rodape: true },
  salaEstar:      { comodo: "Sala TV",        rodape: true },
  salaJantar:     { comodo: "Sala de jantar", rodape: true },
  escritorio:     { comodo: "Escritório",     rodape: true },
  circulacao:     { comodo: "Hall de entrada", rodape: true },
  garagem:        { comodo: "Garagem" },
  varanda:        { comodo: "Área de lazer" },
};
const NOME_AMBIENTE = (id) => { const t = (typeof AMBIENTES_TIPOS !== "undefined" ? AMBIENTES_TIPOS : []).find((a) => a.id === id); return t ? t.nome : id; };
function estimarPelosComodos(projeto) {
  const p = projeto || {};
  const tamanho = TAMANHOS_COMODOS.includes(p.tamanhoComodos) ? p.tamanhoComodos : "Médio";
  const comodos = typeof COMODOS !== "undefined" ? COMODOS : {};
  const ambientes = p.ambientes || {};
  const r = { tamanho, pisoInterno: 0, revestimentoInterno: 0, rodapeM: 0, soleirasM: 0, bancadas: [], detalhes: [] };
  const r1 = (x) => Math.round(x * 10) / 10;
  for (const [id, regra] of Object.entries(COMODO_OBRA_PROJETO)) {
    const n = Math.max(0, Math.round(numOrZero(ambientes[id])));
    if (!n) continue;
    const cfg = comodos[regra.comodo];
    const [L, W] = (cfg && cfg.medidas && cfg.medidas[tamanho]) || [0, 0];
    if (!(L > 0 && W > 0)) continue;
    const area = L * W, perimetro = 2 * (L + W);
    r.pisoInterno += n * area;
    let rev = 0;
    if (regra.revestimento === "total") rev = perimetro * PE_DIREITO_REVESTIMENTO - PORTA_M2;
    else if (regra.revestimento === "meia") rev = perimetro * 1.5;
    else if (regra.revestimento === "parede") rev = Math.max(L, W) * PE_DIREITO_REVESTIMENTO;
    r.revestimentoInterno += n * Math.max(0, rev);
    if (regra.rodape) r.rodapeM += n * Math.max(0, perimetro - PORTA_LARGURA);
    r.soleirasM += n * PORTA_LARGURA; // soleira da porta de cada cômodo
    if (regra.bancada) {
      const comp = regra.bancada.comprimento === "maior" ? Math.max(L, W) : regra.bancada.comprimento === "menor" ? Math.min(L, W) : regra.bancada.comprimento;
      for (let k = 0; k < n; k++) r.bancadas.push({ ...BANCADA_PADRAO, nome: NOME_AMBIENTE(id) + (n > 1 ? ` ${k + 1}` : ""), comprimento: r1(comp), profundidade: regra.bancada.profundidade });
    }
    r.detalhes.push({ id, nome: NOME_AMBIENTE(id), n, L, W, area: r1(n * area), revestimento: r1(n * Math.max(0, rev)) });
  }
  // peitoris das janelas cadastradas em esquadrias
  for (const e of (Array.isArray(p.esquadrias) ? p.esquadrias : [])) {
    if (/JANELA|MAXIM|FIXO/.test(String(e && e.familia || ""))) r.soleirasM += numOrZero(e.qtd) * numOrZero(e.largura);
  }
  r.pisoInterno = r1(r.pisoInterno); r.revestimentoInterno = r1(r.revestimentoInterno); r.rodapeM = r1(r.rodapeM); r.soleirasM = r1(r.soleirasM);
  return r;
}

function pisosRevestimentos(cp, out, data) {
  const base = { ordem: ORD.pisos, tipo: "Acabamento", etapa: "Pisos e revestimentos" };
  const ps = cp.pisos || {};
  const padrao = cp.padrao || "Médio";
  let m2Porcelanato = 0, m2PisoInterno = 0;
  const totais = { AC3: 0, AC2: 0, rejunteKg: 0, clips: 0, cruzetas: 0 };

  for (const sup of SUPERFICIES_PISOS) {
    const area = numOrZero(ps[sup.id] && ps[sup.id].m2);
    if (!(area > 0)) continue;
    const formatoId = (ps[sup.id] && ps[sup.id].formato) || FORMATO_PADRAO[sup.id][padrao] || "60x60";
    const c = consumoRevestimento(formatoId, sup.externo, numOrZero(ps[sup.id] && ps[sup.id].juntaMm));
    const produto = String((ps[sup.id] && ps[sup.id].produto) || "").trim() || PISOS_GENERICOS[sup.id][padrao] || PISOS_GENERICOS[sup.id]["Médio"];
    emitir(out, { ...base, subEtapa: sup.subEtapa, item: produto, unidade: "m2", qtd: ceil2(area * PERDA) });
    totais[c.argamassa] += area * c.argamassaKg;
    totais.rejunteKg += area * c.rejunteKg;
    totais.clips += area * c.clipsM2;
    totais.cruzetas += area * c.cruzetasM2;
    if (c.porcelanato) m2Porcelanato += area;
    if (sup.id === "pisoInterno") m2PisoInterno += area;
  }

  // Rodapé
  const rodapeM = numOrZero(ps.rodapeM);
  const rodapeTipo = ps.rodapeTipo || "poliestireno";
  if (rodapeM > 0 && rodapeTipo === "poliestireno") {
    emitir(out, { ...base, subEtapa: "Rodapé", item: "RODAPE POLIESTIRENO 15CM", unidade: "Barras 2,40m", qtd: Math.ceil(rodapeM / 2.4 * PERDA) });
  } else if (rodapeM > 0 && rodapeTipo === "mesmoPiso") {
    const produto = String((ps.pisoInterno && ps.pisoInterno.produto) || "").trim() || PISOS_GENERICOS.pisoInterno[padrao];
    const m2 = rodapeM * 0.10;
    emitir(out, { ...base, subEtapa: "Rodapé", item: produto, unidade: "m2", qtd: ceil2(m2 * PERDA) });
    totais.AC3 += m2 * ARGAMASSA_KG_M2.AC3;
    m2Porcelanato += m2;
  }

  // Soleiras e peitoris (m lineares × largura)
  const soleirasM = numOrZero(ps.soleirasM);
  if (soleirasM > 0) {
    const m2 = soleirasM * SOLEIRA_LARGURA_M;
    emitir(out, { ...base, subEtapa: "Soleiras e peitoris", item: String(ps.soleirasProduto || "").trim() || SOLEIRA_PADRAO, unidade: "m2", qtd: ceil2(m2 * PERDA) });
    totais.AC3 += m2 * ARGAMASSA_KG_M2.AC3;
  }

  // Bancadas — uma linha por bancada (tampo + saia + fundo + sapatas em m² de pedra),
  // com a medição guardada em `composicao`; sem lista, vale o m² digitado à moda antiga.
  const bancadas = Array.isArray(ps.bancadas) ? ps.bancadas : [];
  let algumaBancada = false;
  for (const b of bancadas) {
    const m = medirBancada(b);
    if (!(numOrZero(b.comprimento) > 0) || !(m.total > 0)) continue; // sem comprimento não é bancada
    algumaBancada = true;
    const produto = String(b.produto || "").trim() || BANCADA_PRODUTO_PADRAO;
    emitir(out, { ...base, subEtapa: `Bancada${b.nome ? " — " + b.nome : ""}`, item: produto, unidade: "m2", qtd: m.total,
      composicao: [
        { parte: "Tampo", m2: m.tampo }, { parte: "Saia", m2: m.saia }, { parte: "Fundo (rodabanca)", m2: m.fundo }, { parte: "Sapatas", m2: m.sapatas },
      ].filter((c) => c.m2 > 0) });
  }
  const bancadasM2 = numOrZero(ps.bancadasM2);
  if (!algumaBancada && bancadasM2 > 0) emitir(out, { ...base, subEtapa: "Bancadas", item: String(ps.bancadasProduto || "").trim() || BANCADA_PRODUTO_PADRAO, unidade: "m2", qtd: ceil2(bancadasM2) });

  // Deck
  const deckM2 = numOrZero(ps.deckM2);
  if (deckM2 > 0) {
    emitir(out, { ...base, subEtapa: "Deck", item: String(ps.deckProduto || "").trim() || "Piso - Deck", unidade: "m2", qtd: ceil2(deckM2 * PERDA) });
    emitir(out, { ...base, subEtapa: "Deck", item: "tintas - Cetol Deck", unidade: "Unidades", qtd: Math.ceil(deckM2 / 20) });
  }

  // Consumíveis somados
  if (totais.AC3 > 0) emitir(out, { ...base, subEtapa: "Assentamento", item: "Argamassa AC 3 GF - 20kg", unidade: "Unidades", qtd: Math.ceil(totais.AC3 / 20 * PERDA) });
  if (totais.AC2 > 0) emitir(out, { ...base, subEtapa: "Assentamento", item: "Argamassa AC 2 - 20kg", unidade: "Unidades", qtd: Math.ceil(totais.AC2 / 20 * PERDA) });
  if (totais.rejunteKg > 0) emitir(out, { ...base, subEtapa: "Assentamento", item: "Rejunte - 5kg", unidade: "Unidades", qtd: Math.ceil(totais.rejunteKg / 5) });
  if (totais.clips > 0) {
    emitir(out, { ...base, subEtapa: "Assentamento", item: "Pisos e revestimentos - Espaçador", unidade: "Unidades", qtd: Math.ceil(totais.clips * PERDA) });
    emitir(out, { ...base, subEtapa: "Assentamento", item: "Pisos e revestimentos - Cunha Niveladora", unidade: "Unidades", qtd: Math.ceil(totais.clips / 3) });
  }
  if (totais.cruzetas > 0) emitir(out, { ...base, subEtapa: "Assentamento", item: "Pisos e revestimentos - Espaçador Cruzeta", unidade: "Pacotes 100 un", qtd: Math.ceil(totais.cruzetas * PERDA / 100) });
  if (m2Porcelanato > 0) emitir(out, { ...base, subEtapa: "Assentamento", item: "Disco Porcelanato", unidade: "Unidades", qtd: Math.max(1, Math.ceil(m2Porcelanato * 0.005 * PERDA)) });
  if (m2PisoInterno > 0) emitir(out, { ...base, subEtapa: "Proteção", item: "Salva Piso 1,00m x 25mts", unidade: "Rolos", qtd: Math.ceil(m2PisoInterno / 25 * PERDA) });
}

// ═══════════════════════════════════════════════════════════════
// ITENS DO PROJETO — hidráulica, esgoto, elétrica, louças e metais,
// aquecimento, pressurização. A planilha de origem nunca quantificou esses
// grupos (só a mão de obra): o escritório lê o projeto de engenharia e
// insere a lista à mão. Cada linha é um insumo do catálogo + quantidade;
// o preço vem do módulo de Insumos como qualquer outro item.
// ═══════════════════════════════════════════════════════════════
const ETAPAS_PROJETO = [
  { id: "HIDRAULICA",  nome: "Hidráulica (água fria e quente)", tipo: "Bruto",      ordem: 18 },
  { id: "ESGOTO",      nome: "Esgoto e pluvial",                tipo: "Bruto",      ordem: 19 },
  { id: "ELETRICA",    nome: "Elétrica e iluminação",           tipo: "Bruto",      ordem: 20 },
  { id: "LOUCAS",      nome: "Louças e metais",                 tipo: "Acabamento", ordem: 21 },
  { id: "AQUECIMENTO", nome: "Aquecimento e pressurização",     tipo: "Acabamento", ordem: 22 },
  { id: "OUTROS",      nome: "Outros itens do projeto",         tipo: "Acabamento", ordem: 23 },
  { id: "PORTAS",      nome: "Portas internas",                 tipo: "Acabamento", ordem: 24 },
];
const ITENS_PROJETO_MAX = 600;

// Resolve uma linha digitada contra o catálogo: código gravado > nome.
// Devolve o insumo (ou null) sem chutar — "sugestão" nunca vira vínculo.
function resolverItemProjeto(item, data) {
  const lista = data && Array.isArray(data.materiais) ? data.materiais : [];
  if (typeof resolverInsumo !== "function" || !lista.length) return null;
  if (item.insumoCodigo) {
    const r = resolverInsumo(item.nome, lista, { codigo: item.insumoCodigo });
    if (r && r.insumo && r.confianca === "codigo") return r.insumo;
  }
  const r = resolverInsumo(item.nome, lista);
  return r && r.insumo ? r.insumo : null;
}

// Interpreta texto colado: uma linha por item, "nome ; qtd [; unidade]" —
// aceita ; , tab ou dois espaços como separador; "12 x nome" também.
function interpretarListaColada(texto) {
  const out = [];
  for (const bruta of String(texto || "").split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha) continue;
    let nome = linha, qtd = 1, unidade = "";
    let m = /^(\d+(?:[.,]\d+)?)\s*(?:x|un|und|pç|pc|pcs)?\s*[-–:]?\s*(.+)$/i.exec(linha);
    const partes = linha.split(/\s*(?:;|\t|,(?=\s*\d)|\s{2,})\s*/).filter(Boolean);
    if (partes.length >= 2 && /^\d+(?:[.,]\d+)?$/.test(partes[1].trim())) {
      nome = partes[0].trim(); qtd = Number(partes[1].replace(",", ".")); unidade = (partes[2] || "").trim();
    } else if (partes.length >= 2 && /^\d+(?:[.,]\d+)?$/.test(partes[partes.length - 1].trim())) {
      qtd = Number(partes[partes.length - 1].replace(",", ".")); nome = partes.slice(0, -1).join(" ").trim();
    } else if (m && m[2] && !/^\d/.test(m[2])) {
      qtd = Number(m[1].replace(",", ".")); nome = m[2].trim();
    }
    if (nome) out.push({ nome, qtd: Number.isFinite(qtd) && qtd > 0 ? qtd : 1, unidade });
  }
  return out;
}

function itensProjeto(cp, out, data) {
  const lista = Array.isArray(cp.itensProjeto) ? cp.itensProjeto : [];
  for (const it of lista) {
    if (!(it.qtd > 0) || !it.nome) continue;
    const etapa = ETAPAS_PROJETO.find((e) => e.id === it.etapa) || ETAPAS_PROJETO[ETAPAS_PROJETO.length - 1];
    const insumo = resolverItemProjeto(it, data);
    const nome = insumo ? insumo.nome : it.nome;
    const unidade = it.unidade || (insumo && insumo.unidade) || "Unidades";
    let preco = null, confianca;
    if (insumo && typeof precoInsumo === "function") {
      const p = precoInsumo(insumo);
      if (p && p.preco != null) { preco = p.preco; confianca = p.confianca; }
    }
    emitir(out, {
      ordem: etapa.ordem, item: nome, tipo: etapa.tipo, etapa: etapa.nome, subEtapa: "Projeto de engenharia",
      unidade, qtd: it.qtd, preco, confianca,
      insumoCodigo: insumo ? insumo.codigo : null,
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// INSTALAÇÕES POR AMBIENTE — estimativa preliminar por kits
// ═══════════════════════════════════════════════════════════════
// Quando não há projeto de engenharia, hidráulica, esgoto, elétrica, louças
// e metais, aquecimento e portas internas são estimados por "conjuntos de
// pontos por ambiente" (prática das composições paramétricas do SINAPI):
// a obra informa quantos ambientes de cada tipo tem, o padrão (Médio/Alto)
// e o sistema de aquecimento; cada ambiente puxa seus kits
// (composicoes-seed.jsx, editáveis em Insumos → Composições).
// Quando a lista do projeto chega (bloco "Itens do projeto"), a disciplina
// é marcada "do projeto" e a estimativa por kits daquela disciplina sai.
const DISCIPLINAS_INSTALACOES = ["HIDRAULICA", "ESGOTO", "ELETRICA", "LOUCAS", "AQUECIMENTO", "PORTAS"];

// Kits em vigor: semente + o que o escritório editou (data.escritorio.composicoes.kits)
function composicoesAtivas(data) {
  const base = typeof COMPOSICOES_SEED !== "undefined" ? COMPOSICOES_SEED : {};
  const cfg = data && data.escritorio && data.escritorio.composicoes;
  const over = (cfg && cfg.kits) || {};
  const kits = {};
  for (const id of Object.keys(base)) {
    kits[id] = over[id] && Array.isArray(over[id].itens) ? { ...base[id], itens: over[id].itens, editado: true } : base[id];
  }
  for (const id of Object.keys(over)) {
    if (kits[id] || !over[id] || !Array.isArray(over[id].itens)) continue;
    kits[id] = { nome: over[id].nome || id, disciplina: over[id].disciplina || "OUTROS", base: over[id].base || "ambiente", fonte: "escritório", itens: over[id].itens, editado: true };
  }
  return kits;
}
// Tipos de ambiente em vigor: semente + pontos elétricos editados pelo escritório
function ambientesAtivos(data) {
  const base = typeof AMBIENTES_TIPOS !== "undefined" ? AMBIENTES_TIPOS : [];
  const cfg = data && data.escritorio && data.escritorio.composicoes;
  const over = (cfg && cfg.ambientes) || {};
  return base.map((a) => over[a.id] ? { ...a, pontos: { ...(a.pontos || {}), ...(over[a.id].pontos || {}) } } : a);
}
function escolherKit(kits, id, padrao) {
  if (!id) return null;
  if (padrao === "Alto" && kits[id + "_ALTO"]) return kits[id + "_ALTO"];
  return kits[id] || null;
}

function instalacoesPorAmbiente(cp, out, data) {
  const amb = cp.ambientes || {};
  const inst = cp.instalacoes || {};
  const doProjeto = inst.doProjeto || {};
  const kits = composicoesAtivas(data);
  const tipos = ambientesAtivos(data);
  const pontosDef = typeof PONTOS_ELETRICOS !== "undefined" ? PONTOS_ELETRICOS : [];
  const sistemas = typeof SISTEMAS_AQUECIMENTO !== "undefined" ? SISTEMAS_AQUECIMENTO : [];
  const avisos = cp._avisos || (cp._avisos = []);
  if (!tipos.length || !Object.keys(kits).length) return;

  const acumulado = {};
  const add = (disc, nome, qtd, unidade) => {
    const k = disc + "|" + nome;
    const a = acumulado[k] || (acumulado[k] = { disc, nome, qtd: 0, unidade: unidade || "Unidades" });
    a.qtd += qtd;
  };
  const aplicarKit = (kit, vezes, disc) => {
    if (!kit || !(vezes > 0)) return;
    for (const it of kit.itens || []) {
      if (!it || !it.nome || !(Number(it.qtd) > 0)) continue;
      add(disc || kit.disciplina, String(it.nome).trim(), Number(it.qtd) * vezes, it.unidade);
    }
  };
  const temAquecimento = !!inst.aquecimento && inst.aquecimento !== "nenhum" && inst.aquecimento !== "eletrico";
  const totalPontos = {};
  for (const p of pontosDef) totalPontos[p.id] = 0;
  let algumAmbiente = false;

  for (const t of tipos) {
    const n = numOrZero(amb[t.id]);
    if (!(n > 0)) continue;
    algumAmbiente = true;
    for (const disc of Object.keys(t.kits || {})) {
      if (doProjeto[disc]) continue;
      for (const kitId of t.kits[disc] || []) {
        const base = kits[kitId];
        if (!base) {
          if (!avisos.some((a) => a.tipo === "kit_ausente" && a.kit === kitId)) avisos.push({ tipo: "kit_ausente", kit: kitId, mensagem: `Kit ${kitId} não existe nas composições` });
          continue;
        }
        if (base.requer === "aquecimento" && !temAquecimento) continue;
        aplicarKit(escolherKit(kits, kitId, inst.padrao), n, disc);
      }
    }
    if (!doProjeto.ELETRICA) for (const p of pontosDef) totalPontos[p.id] += numOrZero(t.pontos && t.pontos[p.id]) * n;
  }
  if (!algumAmbiente) return;

  if (!doProjeto.ELETRICA) {
    for (const p of pontosDef) aplicarKit(escolherKit(kits, p.kit, inst.padrao), totalPontos[p.id], "ELETRICA");
    aplicarKit(escolherKit(kits, "ELETRICA_POR_OBRA", inst.padrao), 1, "ELETRICA");
    const luz = numOrZero(totalPontos.iluminacao) + numOrZero(totalPontos.iluminacaoParalela);
    if (luz > 0) add("ELETRICA", "Elétrica - Disjuntor Unipolar 10A - 10kA", Math.ceil(luz / 8), "Unidades");
    if (totalPontos.tomadaGeral > 0) add("ELETRICA", "Elétrica - Disjuntor Unipolar 20A - 10kA", Math.ceil(totalPontos.tomadaGeral / 6), "Unidades");
  }
  if (!doProjeto.ESGOTO) aplicarKit(escolherKit(kits, "ESGOTO_POR_OBRA", inst.padrao), 1, "ESGOTO");
  if (!doProjeto.AQUECIMENTO) {
    const sis = sistemas.find((x) => x.id === inst.aquecimento);
    if (sis && sis.kit) aplicarKit(escolherKit(kits, sis.kit, inst.padrao), 1, "AQUECIMENTO");
    if (inst.pressurizador) aplicarKit(escolherKit(kits, "PRESSURIZADOR", inst.padrao), 1, "AQUECIMENTO");
  }

  for (const a of Object.values(acumulado)) {
    const etapa = ETAPAS_PROJETO.find((e) => e.id === a.disc) || ETAPAS_PROJETO.find((e) => e.id === "OUTROS");
    const metros = /^m(ts|etros)?$/i.test(String(a.unidade || ""));
    const qtd = metros ? Math.ceil(a.qtd * 10 - 1e-9) / 10 : Math.ceil(a.qtd - 1e-9);
    emitir(out, { ordem: etapa.ordem, item: a.nome, tipo: etapa.tipo, etapa: etapa.nome, subEtapa: "Estimativa por ambientes", unidade: a.unidade, qtd });
  }
  cp._pontosEletricos = totalPontos;
}

function normalizarSuperficie(sup, m2Antigo) {
  const o = sup || {};
  return { m2: numOrZero(o.m2) || numOrZero(m2Antigo), formato: o.formato || "", produto: o.produto || "", juntaMm: numOrZero(o.juntaMm) };
}
function normalizarProjeto(projeto) {
  const p = projeto || {};
  const arq = p.arquitetura || {};
  const terreoIn = p.terreo || {};
  const pav1In = p.pav1 || {};
  const eng = p.engenharia || {};
  const colunasTerreo = eng.colunasTerreo || {};
  const ferroColunasTerreo = colunasTerreo.ferro || {};
  const colunasPav1 = eng.colunasPav1 || {};
  const ferroColunasPav1 = colunasPav1.ferro || {};
  const fundacaoIn = eng.fundacao || {};
  const ferroFund = fundacaoIn.ferro || {};
  const concretoFund = fundacaoIn.concreto || {};
  const coberturaEst = eng.coberturaEstrutura || {};
  const ferroCobertura = coberturaEst.ferro || {};
  const volumeConcretoCobertura = coberturaEst.volumeConcreto || {};
  const externa = p.externa || {};
  const muroDivisaIn = externa.muroDivisa || {};
  const arrimoIn = p.arrimo || {};
  const ferroArrimo = arrimoIn.ferro || {};
  const concretoArrimo = arrimoIn.concreto || {};
  const colunasArrimo = arrimoIn.colunas || {};
  const piscinaIn = p.piscina || {};
  const ferroPiscina = piscinaIn.ferro || {};
  const concretoPiscina = piscinaIn.concreto || {};
  const colunasPiscina = piscinaIn.colunas || {};
  const prestadoresIn = p.prestadores || {};
  const coberturasIn = Array.isArray(p.cobertura) ? p.cobertura : [];
  const esquadriasIn = Array.isArray(p.esquadrias) ? p.esquadrias : [];
  const itensProjetoIn = Array.isArray(p.itensProjeto) ? p.itensProjeto : [];
  const ambientesIn = p.ambientes || {};
  const pisosIn = p.pisos || {};
  const instalacoesIn = p.instalacoes || {};

  const tipologia = p.tipologia === "Sobrado" ? "Sobrado" : "Térrea";
  const tipoObra = p.tipoObra === "reforma" ? "reforma" : "nova";
  const padrao = PADROES_OBRA.includes(p.padrao) ? p.padrao : (instalacoesIn.padrao === "Alto" ? "Alto" : "Médio");
  // Projeto antigo (sem o campo): tem piscina se já havia área digitada.
  const temPiscina = p.temPiscina == null ? numOrZero(piscinaIn.areaConstruida) > 0 : !!p.temPiscina;
  const piscinaAtiva = temPiscina ? piscinaIn : {};
  const ferroPiscinaAtiva = temPiscina ? ferroPiscina : {};
  const concretoPiscinaAtiva = temPiscina ? concretoPiscina : {};
  const colunasPiscinaAtiva = temPiscina ? colunasPiscina : {};

  return {
    tipologia,
    tipoObra,
    padrao,
    tamanhoComodos: TAMANHOS_COMODOS.includes(p.tamanhoComodos) ? p.tamanhoComodos : "Médio",
    temPiscina,

    areaConstruida: numOrZero(arq.areaConstruida),
    m2ParedesTotal: numOrZero(arq.m2ParedesTotal),
    m2ParedesInternas: numOrZero(arq.m2ParedesInternas),
    m2ParedesExternas: numOrZero(arq.m2ParedesExternas),
    gabarito: numOrZero(arq.gabarito),

    // Campos achatados historicamente usados por paredesTerreo() (pilotos
    // do Passo 2) — mantidos como estão, sem alterar seu comportamento já
    // testado.
    m2Paredes20Terreo: numOrZero(terreoIn.m2Parede20),
    m2Paredes25Terreo: numOrZero(terreoIn.m2Parede25),
    m2Paredes15Terreo: numOrZero(terreoIn.m2Parede15),
    vaoPortasJanelasTerreo: numOrZero(terreoIn.vaoPortasJanelas),
    colunas15Terreo: numOrZero(colunasTerreo["15"]),
    colunas20Terreo: numOrZero(colunasTerreo["20"]),
    colunas30Terreo: numOrZero(colunasTerreo["30"]),
    areaFormaColunaMaior25cmTerreo: numOrZero(colunasTerreo.areaFormaMaior25cm),
    concrColunaTerreo: numOrZero(colunasTerreo.concreto),
    ca60_4mmColunaTerreo: numOrZero(ferroColunasTerreo.CA60_4MM),
    ca50_5mmColunaTerreo: numOrZero(ferroColunasTerreo.CA50_5MM),
    ca50_6mmColunaTerreo: numOrZero(ferroColunasTerreo.CA50_6MM),
    ca50_8mmColunaTerreo: numOrZero(ferroColunasTerreo.CA50_8MM),
    ca50_10mmColunaTerreo: numOrZero(ferroColunasTerreo.CA50_10MM),
    ca50_12mmColunaTerreo: numOrZero(ferroColunasTerreo.CA50_12MM),
    ca50_16mmColunaTerreo: numOrZero(ferroColunasTerreo.CA50_16MM),
    ca60_5mmColunaTerreo: numOrZero(ferroColunasTerreo.CA60_5MM),
    perimetroParedesTerreo: numOrZero(terreoIn.perimetroParedes),
    areaTerreo: numOrZero(terreoIn.area),

    // cp.terreo — usado por vigaRespaldoLajeTerreo() (Pav. Térreo)
    terreo: {
      perimetroLoje: numOrZero(terreoIn.perimetroLoje),
      areaLoje: numOrZero(terreoIn.areaLoje),
      areaLojeMacica: numOrZero(terreoIn.areaLojeMacica),
      tipoLoje: terreoIn.tipoLoje || "",
      resistenciaConcretoLoje: terreoIn.resistenciaConcretoLoje || "",
      concretoVigaRespaldo: numOrZero(terreoIn.concretoVigaRespaldo),
      vigaRespaldo: normalizarFerro(terreoIn.vigaRespaldo),
    },

    // cp.pav1 — usado por paredesPav1() e vigaRespaldoLajePav1()
    pav1: {
      m2Parede20: numOrZero(pav1In.m2Parede20),
      m2Parede25: numOrZero(pav1In.m2Parede25),
      m2Parede15: numOrZero(pav1In.m2Parede15),
      vaoPortasJanelas: numOrZero(pav1In.vaoPortasJanelas),
      colunas15: numOrZero(colunasPav1["15"]),
      colunas20: numOrZero(colunasPav1["20"]),
      colunas25: numOrZero(colunasPav1["25"]),
      colunas30: numOrZero(colunasPav1["30"]),
      areaFormaColunaMaior25cm: numOrZero(colunasPav1.areaFormaMaior25cm),
      concrColuna: numOrZero(colunasPav1.concreto),
      ferro: normalizarFerro(ferroColunasPav1),
      perimetroLoje: numOrZero(pav1In.perimetroLoje),
      perimetroParedes: numOrZero(pav1In.perimetroParedes),
      areaLoje: numOrZero(pav1In.areaLoje),
      areaLojeMacica: numOrZero(pav1In.areaLojeMacica),
      tipoLoje: pav1In.tipoLoje || "",
      resistenciaConcretoLoje: pav1In.resistenciaConcretoLoje || "",
      concretoVigaRespaldo: numOrZero(pav1In.concretoVigaRespaldo),
      vigaRespaldo: normalizarFerro(pav1In.vigaRespaldo),
    },

    // cp.fundacao — usado por fundacao()
    fundacao: {
      qtdEstacas: numOrZero(fundacaoIn.qtdEstacas),
      profEstacas: numOrZero(fundacaoIn.profEstacas),
      resistenciaConcreto: fundacaoIn.resistenciaConcreto || "",
      ferro: {
        estacas: normalizarFerro(ferroFund.estacas),
        sapatas: normalizarFerro(ferroFund.sapatas),
        arranques: normalizarFerro(ferroFund.arranques),
        baldrames: normalizarFerro(ferroFund.baldrames),
      },
      concreto: {
        estacas: numOrZero(concretoFund.estacas),
        sapatas: numOrZero(concretoFund.sapatas),
        arranques: numOrZero(concretoFund.arranques),
        baldrames: numOrZero(concretoFund.baldrames),
      },
    },

    // cp.cobertura — engenharia de colunas/vigas da cobertura, usado por
    // supraCobertura(). Não confundir com cp.coberturas (array de telhados).
    cobertura: {
      colunas15: numOrZero(coberturaEst.colunas && coberturaEst.colunas["15"]),
      colunas20: numOrZero(coberturaEst.colunas && coberturaEst.colunas["20"]),
      colunas25: numOrZero(coberturaEst.colunas && coberturaEst.colunas["25"]),
      areaFormaColunaMaior25cm: numOrZero(coberturaEst.areaFormaMaior25cm),
      vigaFerro: normalizarFerro(ferroCobertura.viga),
      colunaFerro: normalizarFerro(ferroCobertura.coluna),
      volumeConcretoColunaRespaldo: numOrZero(volumeConcretoCobertura.coluna),
      volumeConcretoVigaRespaldo: numOrZero(volumeConcretoCobertura.viga),
    },

    // m² de revestimento de parede interno: bloco "Pisos e revestimentos"
    // (projeto antigo: campo externa.revestimentoInterno). Desconta da pintura.
    revestimentoInterno: numOrZero(pisosIn.revestimentoInterno && pisosIn.revestimentoInterno.m2) || numOrZero(externa.revestimentoInterno),
    pavimentacaoExterna: numOrZero(externa.pavimentacao),
    perimetroPavimentacao: numOrZero(externa.perimetroPavimentacao),
    comprimentoMuroDivisa: numOrZero(muroDivisaIn.comprimento),
    alturaMuroDivisa: numOrZero(muroDivisaIn.altura),

    comprimentoArrimo: numOrZero(arrimoIn.comprimento),
    alturaArrimo: numOrZero(arrimoIn.altura),

    // cp.arrimo — usado por muroArrimo()
    arrimo: {
      comprimento: numOrZero(arrimoIn.comprimento),
      altura: numOrZero(arrimoIn.altura),
      numeroVigas: numOrZero(arrimoIn.numeroVigas),
      qtdEstacas: numOrZero(arrimoIn.qtdEstacas),
      profEstacas: numOrZero(arrimoIn.profEstacas),
      colunas15: numOrZero(colunasArrimo["15"]),
      colunas20: numOrZero(colunasArrimo["20"]),
      colunas30: numOrZero(colunasArrimo["30"]),
      areaFormaColunaMaior25cm: numOrZero(arrimoIn.areaFormaColunaMaior25cm),
      resistenciaConcreto: arrimoIn.resistenciaConcreto || "",
      ferro: {
        estacas: normalizarFerro(ferroArrimo.estacas),
        sapatas: normalizarFerro(ferroArrimo.sapatas),
        arranques: normalizarFerro(ferroArrimo.arranques),
        baldrame: normalizarFerro(ferroArrimo.baldrame),
        gigante: normalizarFerro(ferroArrimo.gigante),
        colunas: normalizarFerro(ferroArrimo.colunas),
        vigas: normalizarFerro(ferroArrimo.vigas),
      },
      concreto: {
        estacas: numOrZero(concretoArrimo.estacas),
        sapatas: numOrZero(concretoArrimo.sapatas),
        arranques: numOrZero(concretoArrimo.arranques),
        baldrame: numOrZero(concretoArrimo.baldrame),
        gigante: numOrZero(concretoArrimo.gigante),
        colunas: numOrZero(concretoArrimo.colunas),
        vigas: numOrZero(concretoArrimo.vigas),
      },
    },

    areaConstruidaPiscina: numOrZero(piscinaAtiva.areaConstruida),

    // cp.piscina — usado por piscina()
    piscina: {
      areaConstruida: numOrZero(piscinaAtiva.areaConstruida),
      profundidade: numOrZero(piscinaAtiva.profundidade),
      paredesM2Total: numOrZero(piscinaAtiva.paredesM2Total),
      perimetroParedes: numOrZero(piscinaAtiva.perimetroParedes),
      qtdEstacas: numOrZero(piscinaAtiva.qtdEstacas),
      profundidadeEstacas: numOrZero(piscinaAtiva.profundidadeEstacas),
      gabaritoObra: numOrZero(piscinaAtiva.gabaritoObra),
      colunas15: numOrZero(colunasPiscinaAtiva["15"]),
      colunas20: numOrZero(colunasPiscinaAtiva["20"]),
      colunas25: numOrZero(colunasPiscinaAtiva["25"]),
      areaFormaColunaMaior25cm: numOrZero(piscinaAtiva.areaFormaColunaMaior25cm),
      resistenciaConcreto: piscinaAtiva.resistenciaConcreto || "",
      ferro: {
        estacas: normalizarFerro(ferroPiscinaAtiva.estacas),
        sapatas: normalizarFerro(ferroPiscinaAtiva.sapatas),
        arranques: normalizarFerro(ferroPiscinaAtiva.arranques),
        baldrame: normalizarFerro(ferroPiscinaAtiva.baldrame),
        contrapiso: normalizarFerro(ferroPiscinaAtiva.contrapiso),
        colunas: normalizarFerro(ferroPiscinaAtiva.colunas),
        vigas: normalizarFerro(ferroPiscinaAtiva.vigas),
      },
      concreto: {
        estacas: numOrZero(concretoPiscinaAtiva.estacas),
        sapatas: numOrZero(concretoPiscinaAtiva.sapatas),
        arranques: numOrZero(concretoPiscinaAtiva.arranques),
        baldrame: numOrZero(concretoPiscinaAtiva.baldrame),
        contrapiso: numOrZero(concretoPiscinaAtiva.contrapiso),
        colunas: numOrZero(concretoPiscinaAtiva.colunas),
        vigas: numOrZero(concretoPiscinaAtiva.vigas),
      },
    },

    // cp.coberturas — array de até 16 telhados, usado por cobertura(). Não
    // confundir com cp.cobertura (engenharia de colunas/vigas, singular).
    coberturas: coberturasIn.slice(0, 16).map((t) => ({
      tipo: (t && t.tipo) || "",
      comprimento: numOrZero(t && t.comprimento),
      largura: numOrZero(t && t.largura),
      aguas: numOrZero(t && t.aguas),
      // fração (0,35). Projeto antigo com 35 digitado como percentual → 0,35
      inclinacao: (() => { const i = numOrZero(t && t.inclinacao); return i > 1 ? i / 100 : i; })(),
    })),

    // Escrito por cobertura() (variável pública no VBA original) e lido
    // depois por prestadores() (base do Carpinteiro). Antes de cobertura()
    // rodar, fica 0 — igual ao VBA antes do loop.
    areaCoberturaTotal: 0,

    // cp.esquadrias — lista de esquadrias, usado por esquadrias()
    esquadrias: esquadriasIn.slice(0, 40).map((e) => ({
      familia: (e && e.familia) || "JANELA_CORRER",
      linha: (e && e.linha) || "GOLD",
      folhas: numOrZero(e && e.folhas) || 2,
      qtd: numOrZero(e && e.qtd),
      largura: numOrZero(e && e.largura),
      altura: numOrZero(e && e.altura),
    })),

    // cp.ambientes / cp.instalacoes — estimativa por kits (instalacoesPorAmbiente)
    ambientes: Object.keys(ambientesIn).reduce((acc, k) => { acc[k] = numOrZero(ambientesIn[k]); return acc; }, {}),
    instalacoes: {
      padrao: padraoInstalacoes(padrao), // derivado do padrão da obra (Alto/Altíssimo → kits _ALTO)
      aquecimento: instalacoesIn.aquecimento || "nenhum",
      pressurizador: !!instalacoesIn.pressurizador,
      doProjeto: DISCIPLINAS_INSTALACOES.reduce((acc, d) => { acc[d] = !!(instalacoesIn.doProjeto && instalacoesIn.doProjeto[d]); return acc; }, {}),
    },

    // cp.pisos — pisos, revestimentos, rodapé, soleiras, bancadas e deck
    pisos: {
      pisoInterno: normalizarSuperficie(pisosIn.pisoInterno),
      pisoExterno: normalizarSuperficie(pisosIn.pisoExterno),
      revestimentoInterno: normalizarSuperficie(pisosIn.revestimentoInterno, numOrZero(externa.revestimentoInterno)),
      revestimentoExterno: normalizarSuperficie(pisosIn.revestimentoExterno),
      rodapeM: numOrZero(pisosIn.rodapeM), rodapeTipo: pisosIn.rodapeTipo || "poliestireno",
      soleirasM: numOrZero(pisosIn.soleirasM), soleirasProduto: pisosIn.soleirasProduto || "",
      bancadasM2: numOrZero(pisosIn.bancadasM2), bancadasProduto: pisosIn.bancadasProduto || "",
      bancadas: (Array.isArray(pisosIn.bancadas) ? pisosIn.bancadas : []).slice(0, BANCADAS_MAX).map((b) => ({
        nome: String((b && b.nome) || "").trim(), comprimento: numOrZero(b && b.comprimento), profundidade: numOrZero(b && b.profundidade),
        saiaCm: numOrZero(b && b.saiaCm), fundoCm: numOrZero(b && b.fundoCm), sapatas: numOrZero(b && b.sapatas), sapataCm: numOrZero(b && b.sapataCm), produto: (b && b.produto) || "",
      })),
      deckM2: numOrZero(pisosIn.deckM2), deckProduto: pisosIn.deckProduto || "",
    },

    // cp.itensProjeto — lista digitada do projeto de engenharia
    itensProjeto: itensProjetoIn.slice(0, ITENS_PROJETO_MAX).map((it) => ({
      etapa: (it && it.etapa) || "OUTROS",
      nome: String((it && it.nome) || "").trim(),
      insumoCodigo: (it && it.insumoCodigo) || null,
      unidade: (it && it.unidade) || "",
      qtd: numOrZero(it && it.qtd),
    })),

    prestadores: {
      equipePedreiros: numOrZero(prestadoresIn.equipePedreiros),
      eletricista: numOrZero(prestadoresIn.eletricista),
      encanador: numOrZero(prestadoresIn.encanador),
      pintor: numOrZero(prestadoresIn.pintor),
      carpinteiro: numOrZero(prestadoresIn.carpinteiro),
      impermeabilizador: numOrZero(prestadoresIn.impermeabilizador),
      instaladorAr: numOrZero(prestadoresIn.instaladorAr),
      marceneiroPortas: numOrZero(prestadoresIn.marceneiroPortas),
      gestaoObra: numOrZero(prestadoresIn.gestaoObra),
      instaladorEquipPiscina: numOrZero(prestadoresIn.instaladorEquipPiscina),
      pedreirosPiscina: numOrZero(prestadoresIn.pedreirosPiscina),
      muroArrimo: numOrZero(prestadoresIn.muroArrimo),
      muroDivisa: numOrZero(prestadoresIn.muroDivisa),
      pavimentacaoExterna: numOrZero(prestadoresIn.pavimentacaoExterna),
      terraplanagem: numOrZero(prestadoresIn.terraplanagem),
      instaladorAquecedores: numOrZero(prestadoresIn.instaladorAquecedores),
      serralheiro: numOrZero(prestadoresIn.serralheiro),
    },
  };
}

// Último passo do motor: resolve preço (precoDoInsumo p/ tudo que não tem
// preço embutido, ou seja, tudo exceto prestadores) e agrega totais por tipo.
function precificarETotalizar(out, data) {
  const itens = out.map((linha) => {
    if (linha.preco != null) {
      // preço já resolvido pelo módulo (prestadores, esquadrias compostas)
      return { ...linha, total: Math.round(linha.qtd * linha.preco * 100) / 100, confianca: linha.confianca || "modulo" };
    }
    const r = precoDoInsumo(linha.item, data);
    const preco = r.preco != null ? r.preco : 0;
    return { ...linha, preco, total: Math.round(linha.qtd * preco * 100) / 100, confianca: r.confianca, insumoCodigo: r.codigo, semPreco: r.preco == null };
  });

  const somaPorTipo = (tipo) => itens.filter((i) => i.tipo === tipo).reduce((acc, i) => acc + i.total, 0);

  const totais = {
    bruto: somaPorTipo("Bruto"),
    acabamento: somaPorTipo("Acabamento"),
    prestadores: somaPorTipo("Prestadores de serviços"),
    geral: itens.reduce((acc, i) => acc + i.total, 0),
  };

  const qualidade = qualidadeDosPrecos(itens);
  const avisos = [];
  if (qualidade.semPreco.length) {
    avisos.push({ tipo: "sem_preco", mensagem: `${qualidade.semPreco.length} item(ns) sem preço no catálogo de Insumos — entram com R$ 0`, itens: qualidade.semPreco });
  }
  return { itens, totais, qualidade, avisos };
}

// Resumo da qualidade dos preços de um orçamento (§4 da SPEC-INSUMOS):
// quantos itens têm preço, de que confiança, e quais merecem atenção.
function qualidadeDosPrecos(itens) {
  const q = { total: 0, comPreco: 0, alta: 0, media: 0, baixa: 0, obsoleta: 0, manual: 0, modulo: 0, semPreco: [], atencao: [] };
  for (const i of itens) {
    q.total++;
    if (i.semPreco) { q.semPreco.push(i.item); continue; }
    q.comPreco++;
    if (i.confianca in q && typeof q[i.confianca] === "number") q[i.confianca]++;
    if (i.confianca === "obsoleta" || i.confianca === "baixa") q.atencao.push({ item: i.item, confianca: i.confianca, preco: i.preco, insumoCodigo: i.insumoCodigo });
  }
  return q;
}

// ═══════════════════════════════════════════════════════════════
// gerarOrcamentoObra — função pura, sem React, sem side-effect. Espelha a
// ordem de execução de A_GERAR_ORCAMENTO.bas.
// ═══════════════════════════════════════════════════════════════
function gerarOrcamentoObra(projeto, data) {
  const cp = normalizarProjeto(projeto);
  const out = [];

  instalacoesObraProjetos(cp, out);
  fundacao(cp, out);
  // ESGOTO_PLUVIAL_TERREO: comentado no próprio A_GERAR_ORCAMENTO.bas
  // original (chamada morta) — não implementar (§11 da spec).
  contrapisoInternoTerreo(cp, out);
  paredesTerreo(cp, out);
  vigaRespaldoLajeTerreo(cp, out);
  if (cp.tipologia === "Sobrado") {
    paredesPav1(cp, out);
    vigaRespaldoLajePav1(cp, out);
  }
  supraCobertura(cp, out);
  cobertura(cp, out);
  chapiscoReboco(cp, out);
  pintura(cp, out);
  contrapisosExternos(cp, out);
  muroDivisa(cp, out);
  muroArrimo(cp, out);
  // Piscina só quando marcada no bloco Geral (o .bas rodava sempre e deixava
  // linhas fixas — compactador, sarrafos — em obra sem piscina).
  if (cp.temPiscina) piscina(cp, out);
  esquadrias(cp, out, data);
  pisosRevestimentos(cp, out, data);
  instalacoesPorAmbiente(cp, out, data);
  itensProjeto(cp, out, data);
  prestadores(cp, out, data);

  const resultado = precificarETotalizar(out, data);
  resultado.avisos = (cp._avisos || []).concat(resultado.avisos || []);
  return resultado;
}

// Cor e legenda da confiança do preço de um item (tabela do resultado).
function corConfianca(confianca, semPreco) {
  if (semPreco) return "#dc2626";
  switch (confianca) {
    case "alta": case "manual": case "modulo": return "#16a34a";
    case "media": return "#ca8a04";
    case "baixa": case "parcial": return "#ea580c";
    case "obsoleta": return "#dc2626";
    default: return "#9ca3af";
  }
}
function rotuloConfianca(i) {
  if (i.semPreco) return "Sem preço no catálogo de Insumos";
  switch (i.confianca) {
    case "alta": return "Preço atual (compra recente, histórico consistente)";
    case "media": return "Preço de compra com menos de 12 meses";
    case "baixa": return "Preço antigo, corrigido pelo INCC — vale cotar";
    case "obsoleta": return "Preço com mais de 24 meses, corrigido pelo INCC — cotar";
    case "manual": return "Preço manual definido em Insumos";
    case "parcial": return "Esquadria com componentes sem preço em Insumos";
    case "modulo": return "Preço calculado pelo módulo";
    default: return "";
  }
}

// ═══════════════════════════════════════════════════════════════
// UI (§7) — card "Orçamento" dentro de GestaoObraPanel (clientes.jsx),
// view `orcamento` com três telas: vazio, formulário por blocos, resultado.
//
// Escopo desta entrega: os blocos "Fundação", "Colunas e vigas", "Muro de
// arrimo" e "Piscina" (engenharia detalhada, ~30 campos de ferro por bitola
// e por elemento cada) entram de forma SIMPLIFICADA — só os campos
// agregados (qtd de estacas, profundidade, resistência do concreto etc.),
// sem a matriz completa de ferro por elemento estrutural. O motor
// (gerarOrcamentoObra) já sabe ler essa matriz completa se ela vier
// preenchida por outro caminho (import, API futura) — só o formulário não a
// expõe ainda. Documentado aqui e no relatório final, não escondido.
// ═══════════════════════════════════════════════════════════════

const TIPOS_TELHA_UI = Object.keys(AREA_TELHA);
const OPCOES_FCK = ["Concreto - FCK20", "Concreto - FCK25", "Concreto - FCK30", "Concreto - FCK35"];

function setEmCaminho(obj, caminho, valor) {
  const partes = caminho.split(".");
  const novo = { ...obj };
  let atual = novo;
  for (let i = 0; i < partes.length - 1; i++) {
    const parte = partes[i];
    atual[parte] = { ...(atual[parte] || {}) };
    atual = atual[parte];
  }
  atual[partes[partes.length - 1]] = valor;
  return novo;
}

function lerCaminho(obj, caminho) {
  return caminho.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

function projetoVazio() {
  return {
    tipologia: "Sobrado",
    tipoObra: "nova",
    padrao: "Médio",
    tamanhoComodos: "Médio",
    temPiscina: false,
    arquitetura: {},
    terreo: {},
    pav1: {},
    engenharia: { fundacao: {} },
    externa: { muroDivisa: {} },
    arrimo: {},
    piscina: {},
    cobertura: [],
    esquadrias: [],
    pisos: {},
    ambientes: {},
    instalacoes: { padrao: "Médio", aquecimento: "nenhum", pressurizador: false, doProjeto: {} },
    itensProjeto: [],
    prestadores: {},
  };
}

function CampoNum({ label, valor, onChange, inteiro }) {
  // inteiro: contagens (ambientes, peças) — passo 1, sem negativos, sem decimais
  return (
    <div>
      <label style={C.label}>{label}</label>
      <input style={C.input} type="number" value={valor ?? ""} step={inteiro ? "1" : "0.01"} min={inteiro ? "0" : undefined}
        onChange={(e) => {
          if (e.target.value === "") return onChange("");
          const n = Number(e.target.value);
          onChange(inteiro ? Math.max(0, Math.round(n)) : n);
        }} />
    </div>
  );
}
// Percentual: o usuário digita 35 e vê "35%"; o projeto guarda 0.35 (fração,
// como a célula % da planilha e como o motor usa em sqrt(incl² + 1)).
function CampoPercentual({ label, valor, onChange }) {
  const [texto, setTexto] = useState(() => (valor === "" || valor == null ? "" : String(Math.round(Number(valor) * 10000) / 100)));
  useEffect(() => {
    const externo = valor === "" || valor == null ? "" : String(Math.round(Number(valor) * 10000) / 100);
    setTexto((t) => (Number(t.replace(",", ".")) === Number(externo) || (t === "" && externo === "") ? t : externo));
  }, [valor]);
  function aoDigitar(e) {
    const limpo = e.target.value.replace("%", "").replace(/[^0-9.,]/g, "");
    setTexto(limpo);
    if (limpo === "" || limpo === "." || limpo === ",") return onChange("");
    const n = Number(limpo.replace(",", "."));
    if (Number.isFinite(n)) onChange(Math.round(n * 100) / 10000);
  }
  return (
    <div>
      <label style={C.label}>{label}</label>
      <input style={C.input} inputMode="decimal" value={texto === "" ? "" : `${texto}%`} placeholder="0%"
        onChange={aoDigitar}
        onKeyDown={(e) => { if (e.key === "Backspace" && texto !== "") { e.preventDefault(); aoDigitar({ target: { value: texto.slice(0, -1) } }); } }} />
    </div>
  );
}
function CampoTexto({ label, valor, onChange, placeholder }) {
  return (
    <div>
      <label style={C.label}>{label}</label>
      <input style={C.input} value={valor ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function CampoSelect({ label, valor, onChange, opcoes }) {
  return (
    <div>
      <label style={C.label}>{label}</label>
      <select style={{ ...C.input, cursor: "pointer" }} value={valor ?? ""} onChange={(e) => onChange(e.target.value)}>
        {opcoes.map((o) => (
          <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
        ))}
      </select>
    </div>
  );
}

// Bitolas na ordem do PESOS_FERRO. Rótulo curto pro cabeçalho da grade;
// o nome comercial completo está em LABEL_BARRA.
const BITOLAS_FERRO = [
  { k: "CA60_4MM", label: "CA60 4.2" },
  { k: "CA50_5MM", label: "CA50 5.0" },
  { k: "CA50_6MM", label: "CA50 6.3" },
  { k: "CA50_8MM", label: "CA50 8.0" },
  { k: "CA50_10MM", label: "CA50 10" },
  { k: "CA50_12MM", label: "CA50 12.5" },
  { k: "CA50_16MM", label: "CA50 16" },
  { k: "CA60_5MM", label: "CA60 5.0" },
];

// Grade de armadura: uma linha por elemento estrutural, uma coluna por
// bitola (metros lineares), mais a coluna de concreto (m³). Substitui
// dezenas de campos soltos pela mesma matriz que a planilha de origem usa
// na aba GERAL (PREENCHIMENTO × ESTACAS/SAPATAS/ARRANQUES/BALDRAMES).
function GradeFerro({ elementos, pathFerro, pathConcreto, get, set, comConcreto = true }) {
  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>
        Metros lineares de cada bitola{comConcreto ? ", e m³ de concreto" : ""} por elemento. Campo vazio = 0.
      </div>
      <div style={{ overflowX: "auto", border: "1px solid rgba(38,36,33,0.14)", borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11.5, minWidth: 640 }}>
          <thead>
            <tr style={{ background: "#f7f7f8" }}>
              <th style={{ position: "sticky", left: 0, background: "#f7f7f8", padding: "7px 10px", textAlign: "left", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap" }}>Elemento</th>
              {BITOLAS_FERRO.map((b) => (
                <th key={b.k} style={{ padding: "7px 6px", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap" }}>{b.label}</th>
              ))}
              {comConcreto && <th style={{ padding: "7px 6px", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap" }}>Concreto m³</th>}
            </tr>
          </thead>
          <tbody>
            {elementos.map((el) => (
              <tr key={el.key} style={{ borderTop: "1px solid #f3f4f6" }}>
                <td style={{ position: "sticky", left: 0, background: "#fff", padding: "5px 10px", color: "#262421", fontWeight: 500, whiteSpace: "nowrap" }}>{el.label}</td>
                {BITOLAS_FERRO.map((b) => (
                  <td key={b.k} style={{ padding: 3 }}>
                    <input type="number" step="0.01" style={{ ...C.input, width: 72, padding: "5px 6px", fontSize: 11.5, borderRadius: 7 }}
                      value={get(`${pathFerro}.${el.key}.${b.k}`) ?? ""}
                      onChange={(e) => set(`${pathFerro}.${el.key}.${b.k}`, e.target.value === "" ? "" : Number(e.target.value))} />
                  </td>
                ))}
                {comConcreto && (
                  <td style={{ padding: 3 }}>
                    <input type="number" step="0.01" style={{ ...C.input, width: 72, padding: "5px 6px", fontSize: 11.5, borderRadius: 7, background: "#fcfcfd" }}
                      value={get(`${pathConcreto}.${el.key}`) ?? ""}
                      onChange={(e) => set(`${pathConcreto}.${el.key}`, e.target.value === "" ? "" : Number(e.target.value))} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Linha única de armadura (um só elemento, sem coluna de concreto) — para
// viga de respaldo e colunas, onde o concreto tem campo próprio.
function LinhaFerro({ rotulo, pathFerro, get, set }) {
  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>{rotulo} — metros lineares por bitola</div>
      <div style={{ overflowX: "auto", border: "1px solid rgba(38,36,33,0.14)", borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11.5, minWidth: 560 }}>
          <thead>
            <tr style={{ background: "#f7f7f8" }}>
              {BITOLAS_FERRO.map((b) => (
                <th key={b.k} style={{ padding: "7px 6px", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap" }}>{b.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {BITOLAS_FERRO.map((b) => (
                <td key={b.k} style={{ padding: 3 }}>
                  <input type="number" step="0.01" style={{ ...C.input, width: 72, padding: "5px 6px", fontSize: 11.5, borderRadius: 7 }}
                    value={get(`${pathFerro}.${b.k}`) ?? ""}
                    onChange={(e) => set(`${pathFerro}.${b.k}`, e.target.value === "" ? "" : Number(e.target.value))} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BlocoColapsavel({ titulo, subtitulo, aberto, onToggle, children }) {
  return (
    <div style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 12, marginBottom: 12, overflow: "hidden" }}>
      <button onClick={onToggle} type="button"
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#fafafa", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#262421" }}>{titulo}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {subtitulo && <span style={{ fontSize: 11, color: "#9ca3af" }}>{subtitulo}</span>}
          <span style={{ fontSize: 11, color: "#9ca3af" }}>{aberto ? "▲" : "▼"}</span>
        </span>
      </button>
      {aberto && <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>{children}</div>}
    </div>
  );
}

function formatoBRL(n) {
  return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function OrcamentoObraView({ obra, obras, data, save, onObraAtualizada, isMobile, onVoltar }) {
  const perm = getPermissoes();
  const [viewInterna, setViewInterna] = useState(obra.orcamento ? "resultado" : obra.projeto ? "form" : "vazio");
  const [projetoDraft, setProjetoDraft] = useState(() => obra.projeto || projetoVazio());
  const [blocosAbertos, setBlocosAbertos] = useState({ geral: true });
  const [etapasColapsadas, setEtapasColapsadas] = useState({});
  const [paredeTerreoExpandida, setParedeTerreoExpandida] = useState(false);
  const [espessuraTerreaAberta, setEspessuraTerreaAberta] = useState(false);

  function toggleBloco(k) { setBlocosAbertos((b) => ({ ...b, [k]: !b[k] })); }
  function toggleEtapa(k) { setEtapasColapsadas((b) => ({ ...b, [k]: !b[k] })); }
  function set(caminho, valor) { setProjetoDraft((p) => setEmCaminho(p, caminho, valor)); }
  function get(caminho) { return lerCaminho(projetoDraft, caminho); }

  const ehTerrea = projetoDraft.tipologia !== "Sobrado";
  const temPiscina = projetoDraft.temPiscina == null ? numOrZero(projetoDraft.piscina && projetoDraft.piscina.areaConstruida) > 0 : !!projetoDraft.temPiscina;

  // Mantém terreo.m2Parede20 sincronizado com "total − 15cm − 25cm" sempre
  // que a tipologia é Térrea — inclusive na primeira renderização, pra um
  // projeto salvo antes desta mudança já abrir com o valor certo.
  useEffect(() => {
    if (!ehTerrea) return;
    const total = numOrZero(projetoDraft.arquitetura?.m2ParedesTotal);
    const p15 = numOrZero(projetoDraft.terreo?.m2Parede15);
    const p25 = numOrZero(projetoDraft.terreo?.m2Parede25);
    const p20 = Math.max(0, total - p15 - p25);
    if (numOrZero(projetoDraft.terreo?.m2Parede20) !== p20) {
      setProjetoDraft((p) => setEmCaminho(p, "terreo.m2Parede20", p20));
    }
  }, [ehTerrea, projetoDraft.arquitetura?.m2ParedesTotal, projetoDraft.terreo?.m2Parede15, projetoDraft.terreo?.m2Parede25, projetoDraft.terreo?.m2Parede20]);

  // Térrea: um único campo de área construída, espelhado em arquitetura e
  // terreo (na prática são a mesma área quando não há Pav. 1).
  function setAreaConstruidaTerrea(v) {
    setProjetoDraft((p) => setEmCaminho(setEmCaminho(p, "arquitetura.areaConstruida", v), "terreo.area", v));
  }

  // M² de parede total sempre derivado de interna+externa — nunca digitado
  // direto, pra não ficar dessincronizado. Pra Térrea, o efeito acima cuida
  // de recalcular o 20cm automático sempre que o total mudar.
  function setParedeInterna(v) {
    setProjetoDraft((p) => {
      const externa = numOrZero(lerCaminho(p, "arquitetura.m2ParedesExternas"));
      return setEmCaminho(setEmCaminho(p, "arquitetura.m2ParedesInternas", v), "arquitetura.m2ParedesTotal", numOrZero(v) + externa);
    });
  }
  function setParedeExterna(v) {
    setProjetoDraft((p) => {
      const interna = numOrZero(lerCaminho(p, "arquitetura.m2ParedesInternas"));
      return setEmCaminho(setEmCaminho(p, "arquitetura.m2ParedesExternas", v), "arquitetura.m2ParedesTotal", interna + numOrZero(v));
    });
  }

  // Pav. Térreo (só Sobrado) — modo simples assume tudo em 20cm (zera
  // 15/25cm); o botão "Expandir" libera o detalhamento por espessura.
  function setParedeTerreoSimples(v) {
    setProjetoDraft((p) => setEmCaminho(setEmCaminho(setEmCaminho(p, "terreo.m2Parede20", v), "terreo.m2Parede15", 0), "terreo.m2Parede25", 0));
  }

  function recalcular() {
    const resultado = gerarOrcamentoObra(projetoDraft, data);
    const orcamento = {
      geradoEm: new Date().toISOString(),
      versao: (obra.orcamento?.versao || 0) + 1,
      itens: resultado.itens,
      totais: resultado.totais,
      qualidade: resultado.qualidade,
      avisos: resultado.avisos,
    };
    const obraAtualizada = { ...obra, projeto: projetoDraft, orcamento };
    const novasObras = obras.map((o) => (o.id === obra.id ? obraAtualizada : o));
    save({ ...data, obras: novasObras });
    onObraAtualizada(obraAtualizada);
    setViewInterna("resultado");
  }

  function exportarCSV() {
    const linhas = [["Etapa", "Sub-etapa", "Item", "Unidade", "Qtd", "Preço", "Total"]];
    for (const i of obra.orcamento.itens) {
      linhas.push([i.etapa, i.subEtapa || "", i.item, i.unidade, i.qtd, i.preco, i.total]);
    }
    const csv = linhas.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orcamento-${obra.nome || obra.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const coberturas = projetoDraft.cobertura || [];
  function addTelhado() {
    if (coberturas.length >= 16) return;
    set("cobertura", [...coberturas, { tipo: TIPOS_TELHA_UI[0], comprimento: "", largura: "", aguas: 1, inclinacao: "" }]);
  }
  function updateTelhado(idx, campo, valor) {
    const novas = coberturas.map((t, i) => (i === idx ? { ...t, [campo]: valor } : t));
    set("cobertura", novas);
  }
  function removeTelhado(idx) {
    set("cobertura", coberturas.filter((_, i) => i !== idx));
  }

  const bancadasLista = (projetoDraft.pisos && projetoDraft.pisos.bancadas) || [];
  function addBancada() {
    if (bancadasLista.length >= BANCADAS_MAX) return;
    set("pisos.bancadas", [...bancadasLista, { ...BANCADA_PADRAO }]);
  }
  function updateBancada(idx, campo, valor) {
    set("pisos.bancadas", bancadasLista.map((b, i) => (i === idx ? { ...b, [campo]: valor } : b)));
  }
  function removeBancada(idx) {
    set("pisos.bancadas", bancadasLista.filter((_, i) => i !== idx));
  }
  const esquadriasLista = projetoDraft.esquadrias || [];
  function addEsquadria() {
    if (esquadriasLista.length >= 40) return;
    set("esquadrias", [...esquadriasLista, { familia: "JANELA_CORRER", linha: "GOLD", folhas: 2, qtd: 1, largura: "", altura: "" }]);
  }
  function updateEsquadria(idx, campo, valor) {
    const novas = esquadriasLista.map((e, i) => {
      if (i !== idx) return e;
      const n = { ...e, [campo]: valor };
      // família com menos folhas disponíveis (persiana só tem 2) → ajusta
      if (campo === "familia") {
        const fam = ESQUADRIAS_FAMILIAS.find((f) => f.id === valor);
        if (fam && !fam.folhas.includes(Number(n.folhas))) n.folhas = fam.folhas[0];
      }
      return n;
    });
    set("esquadrias", novas);
  }
  function removeEsquadria(idx) {
    set("esquadrias", esquadriasLista.filter((_, i) => i !== idx));
  }

  // ── Itens do projeto de engenharia ──
  const itensProjetoLista = projetoDraft.itensProjeto || [];
  const [colarTexto, setColarTexto] = useState("");
  const [colarEtapa, setColarEtapa] = useState("HIDRAULICA");
  const [colarAberto, setColarAberto] = useState(false);
  const catalogoInsumos = data.materiais || [];
  function vincularItem(it) {
    const ins = resolverItemProjeto(it, data);
    return ins ? { ...it, nome: ins.nome, insumoCodigo: ins.codigo, unidade: it.unidade || ins.unidade || "" } : { ...it, insumoCodigo: null };
  }
  function addItemProjeto(etapa) {
    if (itensProjetoLista.length >= ITENS_PROJETO_MAX) return;
    set("itensProjeto", [...itensProjetoLista, { etapa: etapa || "HIDRAULICA", nome: "", insumoCodigo: null, unidade: "", qtd: 1 }]);
  }
  function updateItemProjeto(idx, campo, valor) {
    set("itensProjeto", itensProjetoLista.map((it, i) => {
      if (i !== idx) return it;
      const n = { ...it, [campo]: valor };
      return campo === "nome" ? vincularItem({ ...n, insumoCodigo: null, unidade: "" }) : n;
    }));
  }
  function removeItemProjeto(idx) {
    set("itensProjeto", itensProjetoLista.filter((_, i) => i !== idx));
  }
  function colarItensProjeto() {
    const novos = interpretarListaColada(colarTexto)
      .map((l) => vincularItem({ etapa: colarEtapa, nome: l.nome, insumoCodigo: null, unidade: l.unidade, qtd: l.qtd }));
    if (!novos.length) return;
    set("itensProjeto", [...itensProjetoLista, ...novos].slice(0, ITENS_PROJETO_MAX));
    setColarTexto(""); setColarAberto(false);
  }
  function statusItemProjeto(it) {
    if (!it.nome) return null;
    const ins = it.insumoCodigo ? catalogoInsumos.find((m) => m.codigo === it.insumoCodigo) : null;
    if (!ins) return { cor: "#b45309", texto: "não encontrado em Insumos — entra sem preço (R$ 0)" };
    const p = typeof precoInsumo === "function" ? precoInsumo(ins) : null;
    if (!p || p.preco == null) return { cor: "#b45309", texto: `${ins.codigo} · sem preço cadastrado` };
    return { cor: "#15803d", texto: `${ins.codigo} · ${formatoBRL(p.preco)}/${ins.unidade || "un"}` };
  }

  const wrap = { border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "16px", marginBottom: 20 };

  // ── Vazio ──────────────────────────────────────────────────
  if (viewInterna === "vazio") {
    return (
      <div style={wrap}>
        <button onClick={onVoltar} style={{ ...C.btnGhost, marginBottom: 16, fontSize: 12 }}>← Voltar</button>
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>Nenhum orçamento nesta obra.</div>
          {perm.podeEditar && (
            <button style={C.btn} onClick={() => setViewInterna("form")}>Preencher dados do projeto</button>
          )}
        </div>
      </div>
    );
  }

  // ── Formulário ─────────────────────────────────────────────
  if (viewInterna === "form") {
    return (
      <div style={wrap}>
        <button onClick={() => setViewInterna(obra.orcamento ? "resultado" : "vazio")} style={{ ...C.btnGhost, marginBottom: 16, fontSize: 12 }}>← Voltar</button>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#262421", marginBottom: 4 }}>Dados do projeto</div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>Campo vazio = 0. Um bloco sem nenhum dado não entra no orçamento.</div>

        <BlocoColapsavel titulo="Geral" aberto={!!blocosAbertos.geral} onToggle={() => toggleBloco("geral")}>
          <CampoSelect label="Tipo de obra" valor={projetoDraft.tipoObra || "nova"} onChange={(v) => set("tipoObra", v)} opcoes={TIPOS_OBRA} />
          <CampoSelect label="Tipologia" valor={projetoDraft.tipologia} onChange={(v) => set("tipologia", v)}
            opcoes={[{ value: "Sobrado", label: "Sobrado" }, { value: "Térrea", label: "Térrea" }]} />
          <CampoSelect label="Padrão" valor={projetoDraft.padrao || "Médio"} onChange={(v) => set("padrao", v)} opcoes={PADROES_OBRA} />
          <CampoSelect label="Tamanho dos cômodos" valor={projetoDraft.tamanhoComodos || "Médio"} onChange={(v) => set("tamanhoComodos", v)} opcoes={TAMANHOS_COMODOS} />
          <CampoSelect label="Piscina" valor={temPiscina ? "sim" : "nao"} onChange={(v) => set("temPiscina", v === "sim")} opcoes={[{ value: "nao", label: "Não" }, { value: "sim", label: "Sim" }]} />
          {ehTerrea ? (
            <CampoNum label="Área construída (m²)" valor={get("arquitetura.areaConstruida")} onChange={setAreaConstruidaTerrea} />
          ) : (
            <CampoNum label="Área construída (m²)" valor={get("arquitetura.areaConstruida")} onChange={(v) => set("arquitetura.areaConstruida", v)} />
          )}
          <CampoNum label="M² de parede interna" valor={get("arquitetura.m2ParedesInternas")} onChange={setParedeInterna} />
          <CampoNum label="M² de parede externa" valor={get("arquitetura.m2ParedesExternas")} onChange={setParedeExterna} />
          <div>
            <label style={C.label}>M² de parede total</label>
            <input style={{ ...C.input, background: "#f3f4f6", color: "#6b7280" }} value={numOrZero(get("arquitetura.m2ParedesTotal"))} disabled readOnly />
          </div>
          {ehTerrea && (
            <>
              <CampoNum label="Perímetro de paredes" valor={get("terreo.perimetroParedes")} onChange={(v) => set("terreo.perimetroParedes", v)} />
              <div style={{ gridColumn: "1 / -1" }}>
                <button type="button" style={{ ...C.btnGhost, fontSize: 11 }} onClick={() => setEspessuraTerreaAberta((v) => !v)}>
                  {espessuraTerreaAberta ? "Ocultar espessuras de parede" : "Especificar espessuras de parede (15/20/25cm)"}
                </button>
              </div>
              {espessuraTerreaAberta && (
                <>
                  <CampoNum label="M² parede 15cm" valor={get("terreo.m2Parede15")} onChange={(v) => set("terreo.m2Parede15", v)} />
                  <CampoNum label="M² parede 25cm" valor={get("terreo.m2Parede25")} onChange={(v) => set("terreo.m2Parede25", v)} />
                  <div>
                    <label style={C.label}>M² parede 20cm (automático)</label>
                    <input style={{ ...C.input, background: "#f3f4f6", color: "#6b7280" }} value={numOrZero(get("terreo.m2Parede20"))} disabled readOnly />
                  </div>
                </>
              )}
              <CampoNum label="Vãos de portas e janelas" valor={get("terreo.vaoPortasJanelas")} onChange={(v) => set("terreo.vaoPortasJanelas", v)} />
            </>
          )}
          <CampoNum label="Gabarito" valor={get("arquitetura.gabarito")} onChange={(v) => set("arquitetura.gabarito", v)} />
          <div style={{ gridColumn: "1 / -1", fontSize: 12, fontWeight: 600, color: "#374151", marginTop: 6 }}>Cômodos <span style={{ fontWeight: 400, color: "#9ca3af" }}>— áreas molhadas puxam hidráulica, esgoto, louças e portas; todos puxam elétrica</span></div>
          {(typeof AMBIENTES_TIPOS !== "undefined" ? AMBIENTES_TIPOS : []).filter((a) => a.molhado).map((a) => (
            <CampoNum key={a.id} label={a.nome} valor={get(`ambientes.${a.id}`)} onChange={(v) => set(`ambientes.${a.id}`, v)} inteiro />
          ))}
          <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "#9ca3af", marginTop: -4 }}>Cômodos secos:</div>
          {(typeof AMBIENTES_TIPOS !== "undefined" ? AMBIENTES_TIPOS : []).filter((a) => !a.molhado).map((a) => (
            <CampoNum key={a.id} label={a.nome} valor={get(`ambientes.${a.id}`)} onChange={(v) => set(`ambientes.${a.id}`, v)} inteiro />
          ))}
        </BlocoColapsavel>

        {!ehTerrea && (
          <BlocoColapsavel titulo="Pav. Térreo" aberto={!!blocosAbertos.terreo} onToggle={() => toggleBloco("terreo")}>
            <CampoNum label="Área (m²)" valor={get("terreo.area")} onChange={(v) => set("terreo.area", v)} />
            <CampoNum label="Perímetro de paredes" valor={get("terreo.perimetroParedes")} onChange={(v) => set("terreo.perimetroParedes", v)} />
            {!paredeTerreoExpandida ? (
              <CampoNum label="M² de parede (considera tudo 20cm)" valor={get("terreo.m2Parede20")} onChange={setParedeTerreoSimples} />
            ) : (
              <>
                <CampoNum label="M² parede 15cm" valor={get("terreo.m2Parede15")} onChange={(v) => set("terreo.m2Parede15", v)} />
                <CampoNum label="M² parede 20cm" valor={get("terreo.m2Parede20")} onChange={(v) => set("terreo.m2Parede20", v)} />
                <CampoNum label="M² parede 25cm" valor={get("terreo.m2Parede25")} onChange={(v) => set("terreo.m2Parede25", v)} />
              </>
            )}
            <CampoNum label="Vãos de portas e janelas" valor={get("terreo.vaoPortasJanelas")} onChange={(v) => set("terreo.vaoPortasJanelas", v)} />
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
              <button type="button" style={{ ...C.btnGhost, fontSize: 11 }} onClick={() => setParedeTerreoExpandida((v) => !v)}>
                {paredeTerreoExpandida ? "Simplificar (tudo 20cm)" : "Expandir espessuras de parede (15/20/25cm)"}
              </button>
            </div>
          </BlocoColapsavel>
        )}

        <BlocoColapsavel titulo={ehTerrea ? "Laje (forro)" : "Laje Térreo"} aberto={!!blocosAbertos.lajeTerreo} onToggle={() => toggleBloco("lajeTerreo")}>
          <CampoNum label="Área (m²)" valor={get("terreo.areaLoje")} onChange={(v) => set("terreo.areaLoje", v)} />
          <CampoNum label="Perímetro" valor={get("terreo.perimetroLoje")} onChange={(v) => set("terreo.perimetroLoje", v)} />
          <CampoNum label="Área maciça (m²)" valor={get("terreo.areaLojeMacica")} onChange={(v) => set("terreo.areaLojeMacica", v)} />
          <CampoSelect label="Tipo" valor={get("terreo.tipoLoje")} onChange={(v) => set("terreo.tipoLoje", v)}
            opcoes={[{ value: "", label: "—" }, { value: "Treliça", label: "Treliça" }, { value: "Protendida", label: "Protendida" }]} />
          <CampoSelect label="Resistência do concreto" valor={get("terreo.resistenciaConcretoLoje") || "Concreto - FCK25"} onChange={(v) => set("terreo.resistenciaConcretoLoje", v)} opcoes={OPCOES_FCK} />
        </BlocoColapsavel>

        {projetoDraft.tipologia === "Sobrado" && (
          <>
            <BlocoColapsavel titulo="Pav. 1" aberto={!!blocosAbertos.pav1} onToggle={() => toggleBloco("pav1")}>
              <CampoNum label="Perímetro de paredes" valor={get("pav1.perimetroParedes")} onChange={(v) => set("pav1.perimetroParedes", v)} />
              <CampoNum label="M² parede 15cm" valor={get("pav1.m2Parede15")} onChange={(v) => set("pav1.m2Parede15", v)} />
              <CampoNum label="M² parede 20cm" valor={get("pav1.m2Parede20")} onChange={(v) => set("pav1.m2Parede20", v)} />
              <CampoNum label="M² parede 25cm" valor={get("pav1.m2Parede25")} onChange={(v) => set("pav1.m2Parede25", v)} />
              <CampoNum label="Vãos de portas e janelas" valor={get("pav1.vaoPortasJanelas")} onChange={(v) => set("pav1.vaoPortasJanelas", v)} />
            </BlocoColapsavel>

            <BlocoColapsavel titulo="Laje Pav. 1" aberto={!!blocosAbertos.lajePav1} onToggle={() => toggleBloco("lajePav1")}>
              <CampoNum label="Área (m²)" valor={get("pav1.areaLoje")} onChange={(v) => set("pav1.areaLoje", v)} />
              <CampoNum label="Perímetro" valor={get("pav1.perimetroLoje")} onChange={(v) => set("pav1.perimetroLoje", v)} />
              <CampoNum label="Área maciça (m²)" valor={get("pav1.areaLojeMacica")} onChange={(v) => set("pav1.areaLojeMacica", v)} />
              <CampoSelect label="Tipo" valor={get("pav1.tipoLoje")} onChange={(v) => set("pav1.tipoLoje", v)}
                opcoes={[{ value: "", label: "—" }, { value: "Treliça", label: "Treliça" }, { value: "Protendida", label: "Protendida" }]} />
              <CampoSelect label="Resistência do concreto" valor={get("pav1.resistenciaConcretoLoje") || "Concreto - FCK25"} onChange={(v) => set("pav1.resistenciaConcretoLoje", v)} opcoes={OPCOES_FCK} />
            </BlocoColapsavel>
          </>
        )}

        <BlocoColapsavel titulo="Cobertura" subtitulo={`${coberturas.length} telhado${coberturas.length !== 1 ? "s" : ""}`} aberto={!!blocosAbertos.cobertura} onToggle={() => toggleBloco("cobertura")}>
          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 12 }}>
            {coberturas.map((t, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "2fr 1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end", padding: 10, background: "#fafafa", borderRadius: 8 }}>
                <CampoSelect label="Tipo de telha" valor={t.tipo} onChange={(v) => updateTelhado(idx, "tipo", v)} opcoes={TIPOS_TELHA_UI} />
                <CampoNum label="Comprimento" valor={t.comprimento} onChange={(v) => updateTelhado(idx, "comprimento", v)} />
                <CampoNum label="Largura" valor={t.largura} onChange={(v) => updateTelhado(idx, "largura", v)} />
                <CampoSelect label="Nº de águas" valor={t.aguas} onChange={(v) => updateTelhado(idx, "aguas", Number(v))} opcoes={[1, 2, 3, 4]} />
                <CampoPercentual label="Inclinação (%)" valor={t.inclinacao} onChange={(v) => updateTelhado(idx, "inclinacao", v)} />
                <button type="button" onClick={() => removeTelhado(idx)} style={{ ...C.btnGhost, color: "#dc2626", height: 36 }}>Remover</button>
              </div>
            ))}
            {coberturas.length < 16 && (
              <button type="button" style={{ ...C.btnSec, alignSelf: "flex-start" }} onClick={addTelhado}>＋ Adicionar telhado</button>
            )}
          </div>
        </BlocoColapsavel>

        <BlocoColapsavel titulo="Esquadrias" subtitulo={`${esquadriasLista.length} esquadria${esquadriasLista.length !== 1 ? "s" : ""} · alumínio por perfil + vidro`} aberto={!!blocosAbertos.esquadrias} onToggle={() => toggleBloco("esquadrias")}>
          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 12 }}>
            {esquadriasLista.map((e, idx) => {
              const fam = ESQUADRIAS_FAMILIAS.find((f) => f.id === e.familia) || ESQUADRIAS_FAMILIAS[0];
              const linhaSel = ESQUADRIAS_LINHAS.find((l) => l.id === e.linha);
              return (
                <div key={idx} style={{ padding: 10, background: "#fafafa", borderRadius: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "2fr 1fr 1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                    <CampoSelect label="Tipo" valor={e.familia} onChange={(v) => updateEsquadria(idx, "familia", v)}
                      opcoes={ESQUADRIAS_FAMILIAS.map((f) => ({ value: f.id, label: f.nome }))} />
                    <CampoSelect label="Linha" valor={e.linha} onChange={(v) => updateEsquadria(idx, "linha", v)}
                      opcoes={ESQUADRIAS_LINHAS.map((l) => ({ value: l.id, label: l.disponivel ? l.nome : `${l.nome} (em breve)` }))} />
                    <CampoSelect label="Folhas" valor={e.folhas} onChange={(v) => updateEsquadria(idx, "folhas", Number(v))} opcoes={fam.folhas} />
                    <CampoNum label="Quantidade" valor={e.qtd} onChange={(v) => updateEsquadria(idx, "qtd", v)} inteiro />
                    <CampoNum label="Largura (m)" valor={e.largura} onChange={(v) => updateEsquadria(idx, "largura", v)} />
                    <CampoNum label="Altura (m)" valor={e.altura} onChange={(v) => updateEsquadria(idx, "altura", v)} />
                    <button type="button" onClick={() => removeEsquadria(idx)} style={{ ...C.btnGhost, color: "#dc2626", height: 36 }}>Remover</button>
                  </div>
                  {linhaSel && !linhaSel.disponivel && (
                    <div style={{ fontSize: 11, color: "#b45309", marginTop: 6 }}>Linha {linhaSel.nome}: {linhaSel.aviso} — esta esquadria não entra no orçamento até a lista existir.</div>
                  )}
                  {linhaSel && linhaSel.disponivel && linhaSel.aproximada && (
                    <div style={{ fontSize: 11, color: "#b45309", marginTop: 6 }}>Linha {linhaSel.nome}: {linhaSel.aviso}</div>
                  )}
                  {linhaSel && !ESQUADRIAS_CATALOGO[linhaSel.id][`${e.familia}|${e.folhas}`] && (
                    <div style={{ fontSize: 11, color: "#b45309", marginTop: 6 }}>Sem lista de perfis para {fam.nome} {e.folhas} folha{Number(e.folhas) !== 1 ? "s" : ""} na linha {linhaSel.nome} — não entra no orçamento.</div>
                  )}
                </div>
              );
            })}
            {esquadriasLista.length < 40 && (
              <button type="button" style={{ ...C.btnSec, alignSelf: "flex-start" }} onClick={addEsquadria}>＋ Adicionar esquadria</button>
            )}
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              Calcula o alumínio por perfil (código Alcoa e kg), o vidro 8mm (descontos de corte por tipo) e os acessórios (roldanas, fechos, dobradiças, braços, borrachas, conexões, chumbadores e parafusos), segundo a lista de perfis da linha. No orçamento aparece uma linha por esquadria com o preço fechado; a composição fica guardada no item. Correr e persiana: aba ESQUADRIAS da planilha; giro, maxim-ar e fixo: desenhos de montagem do catálogo Alcoa Gold. Para usar seus preços, cadastre o alumínio, o vidro e os acessórios em Insumos com o código Alcoa como alias.
            </div>
          </div>
        </BlocoColapsavel>

        <BlocoColapsavel titulo="Pisos e revestimentos" subtitulo="peça, argamassa, rejunte, espaçadores, rodapé, soleiras, bancadas e deck" aberto={!!blocosAbertos.pisos} onToggle={() => toggleBloco("pisos")}>
          <datalist id="vk-insumos-pisos">
            {(data.materiais || []).filter((m) => /pisos e revestimentos|argamassas/i.test(String(m.grupo || "")) || /^(Piso|Revestimento|Soleiras|Granito)/i.test(String(m.nome || ""))).map((m) => <option key={m.codigo || m.nome} value={m.nome} />)}
          </datalist>
          <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#6b7280" }}>
            Informe os m² de cada superfície. Sem produto escolhido, entra o genérico do padrão da obra ({projetoDraft.padrao || "Médio"}); sem formato, o tamanho típico do padrão. A partir do formato o VICKE calcula argamassa (AC-III em porcelanato e externo, AC-II em cerâmica), rejunte pela geometria da junta, clips e cunhas (peça ≥ 60 cm) ou cruzetas, disco e salva-piso.
          </div>
          {(() => {
            const est = estimarPelosComodos(projetoDraft);
            const temComodos = est.detalhes.length > 0;
            const jaPreenchido = numOrZero(get("pisos.pisoInterno.m2")) > 0 || numOrZero(get("pisos.revestimentoInterno.m2")) > 0 || bancadasLista.length > 0;
            function aplicarEstimativa() {
              const aplicar = () => setProjetoDraft((pd) => {
                let n = setEmCaminho(pd, "pisos.pisoInterno.m2", est.pisoInterno);
                n = setEmCaminho(n, "pisos.revestimentoInterno.m2", est.revestimentoInterno);
                n = setEmCaminho(n, "pisos.rodapeM", est.rodapeM);
                n = setEmCaminho(n, "pisos.soleirasM", est.soleirasM);
                n = setEmCaminho(n, "pisos.bancadas", est.bancadas);
                return n;
              });
              if (jaPreenchido && typeof dialogo !== "undefined") {
                dialogo.confirmar({ titulo: "Substituir pelos cômodos?", mensagem: "Piso interno, revestimento interno, rodapé, soleiras e as bancadas serão substituídos pela estimativa do tamanho dos cômodos.", confirmar: "Substituir" }).then((ok) => { if (ok) aplicar(); });
              } else aplicar();
            }
            return (
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 12px" }}>
                <button type="button" style={{ ...C.btnSec, fontSize: 12, padding: "6px 12px" }} disabled={!temComodos} onClick={aplicarEstimativa}>Pré-preencher pelos cômodos ({projetoDraft.tamanhoComodos || "Médio"})</button>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  {temComodos
                    ? `estimativa: piso ${est.pisoInterno} m² · revestimento de parede ${est.revestimentoInterno} m² · rodapé ${est.rodapeM} m · soleiras e peitoris ${est.soleirasM} m · ${est.bancadas.length} bancada${est.bancadas.length !== 1 ? "s" : ""} — pelas medidas do orçamento de projetos (${est.detalhes.map((d) => `${d.n}× ${d.nome} ${d.L}×${d.W}`).join(", ")})`
                    : "informe os cômodos no bloco Geral para estimar piso, revestimento, rodapé, soleiras e bancadas pelo tamanho dos cômodos"}
                </span>
              </div>
            );
          })()}
          {SUPERFICIES_PISOS.map((sup) => (
            <div key={sup.id} style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "150px 200px 1fr", gap: 10, alignItems: "end", padding: "8px 0", borderTop: "1px solid #f3f4f6" }}>
              <CampoNum label={`${sup.nome} (m²)`} valor={get(`pisos.${sup.id}.m2`)} onChange={(v) => set(`pisos.${sup.id}.m2`, v)} />
              <CampoSelect label="Formato da peça" valor={get(`pisos.${sup.id}.formato`) || ""} onChange={(v) => set(`pisos.${sup.id}.formato`, v)}
                opcoes={[{ value: "", label: `automático (${FORMATO_PADRAO[sup.id][projetoDraft.padrao || "Médio"] || "60x60"})` }, ...FORMATOS_PECA.map((f) => ({ value: f.id, label: f.nome }))]} />
              <div>
                <label style={C.label}>Produto (Insumos)</label>
                <input style={C.input} list="vk-insumos-pisos" value={get(`pisos.${sup.id}.produto`) ?? ""} placeholder={PISOS_GENERICOS[sup.id][projetoDraft.padrao || "Médio"]} onChange={(e) => set(`pisos.${sup.id}.produto`, e.target.value)} />
              </div>
            </div>
          ))}
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "150px 200px 1fr", gap: 10, alignItems: "end", padding: "8px 0", borderTop: "1px solid #f3f4f6" }}>
            <CampoNum label="Rodapé (m)" valor={get("pisos.rodapeM")} onChange={(v) => set("pisos.rodapeM", v)} />
            <CampoSelect label="Tipo de rodapé" valor={get("pisos.rodapeTipo") || "poliestireno"} onChange={(v) => set("pisos.rodapeTipo", v)} opcoes={RODAPE_TIPOS} />
            <div />
          </div>
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "150px 200px 1fr", gap: 10, alignItems: "end", padding: "8px 0", borderTop: "1px solid #f3f4f6" }}>
            <CampoNum label="Soleiras e peitoris (m)" valor={get("pisos.soleirasM")} onChange={(v) => set("pisos.soleirasM", v)} />
            <div style={{ fontSize: 11, color: "#9ca3af" }}>largura {SOLEIRA_LARGURA_M * 100} cm</div>
            <div><label style={C.label}>Produto (Insumos)</label><input style={C.input} list="vk-insumos-pisos" value={get("pisos.soleirasProduto") ?? ""} placeholder={SOLEIRA_PADRAO} onChange={(e) => set("pisos.soleirasProduto", e.target.value)} /></div>
          </div>
          <div style={{ gridColumn: "1 / -1", padding: "8px 0", borderTop: "1px solid #f3f4f6" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Bancadas de granito / mármore <span style={{ fontWeight: 400, color: "#9ca3af" }}>— tampo + saia + fundo (rodabanca) + sapatas, em m² de pedra pronta</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {bancadasLista.map((b, idx) => {
                const m = medirBancada(b);
                return (
                  <div key={idx} style={{ padding: 10, background: "#fafafa", borderRadius: 8 }}>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1.4fr 1fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr auto", gap: 8, alignItems: "end" }}>
                      <CampoTexto label="Ambiente" valor={b.nome} onChange={(v) => updateBancada(idx, "nome", v)} placeholder="Cozinha, banheiro suíte…" />
                      <CampoNum label="Comprimento (m)" valor={b.comprimento} onChange={(v) => updateBancada(idx, "comprimento", v)} />
                      <CampoNum label="Profundidade (m)" valor={b.profundidade} onChange={(v) => updateBancada(idx, "profundidade", v)} />
                      <CampoNum label="Saia (cm)" valor={b.saiaCm} onChange={(v) => updateBancada(idx, "saiaCm", v)} />
                      <CampoNum label="Fundo (cm)" valor={b.fundoCm} onChange={(v) => updateBancada(idx, "fundoCm", v)} />
                      <CampoNum label="Sapatas (un)" valor={b.sapatas} onChange={(v) => updateBancada(idx, "sapatas", v)} inteiro />
                      <CampoNum label="Larg. sapata (cm)" valor={b.sapataCm} onChange={(v) => updateBancada(idx, "sapataCm", v)} />
                      <button type="button" onClick={() => removeBancada(idx)} style={{ ...C.btnGhost, color: "#dc2626", height: 36 }}>Remover</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, alignItems: "end", marginTop: 6 }}>
                      <div><label style={C.label}>Pedra (Insumos)</label><input style={C.input} list="vk-insumos-pisos" value={b.produto ?? ""} placeholder={BANCADA_PRODUTO_PADRAO} onChange={(e) => updateBancada(idx, "produto", e.target.value)} /></div>
                      <div style={{ fontSize: 12, color: "#374151", paddingBottom: 8 }}>
                        <b>{m.total.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²</b>
                        <span style={{ color: "#9ca3af" }}> · tampo {m.tampo} · saia {m.saia} · fundo {m.fundo} · sapatas {m.sapatas}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {bancadasLista.length < BANCADAS_MAX && (
                <button type="button" style={{ ...C.btnSec, alignSelf: "flex-start" }} onClick={addBancada}>＋ Adicionar bancada</button>
              )}
              {bancadasLista.length === 0 && numOrZero(get("pisos.bancadasM2")) > 0 && (
                <div style={{ fontSize: 11, color: "#b45309" }}>Este projeto tem {get("pisos.bancadasM2")} m² de bancada no campo antigo; adicione as bancadas acima para detalhar (o campo antigo deixa de valer quando houver lista).</div>
              )}
            </div>
          </div>
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "150px 200px 1fr", gap: 10, alignItems: "end", padding: "8px 0", borderTop: "1px solid #f3f4f6" }}>
            <CampoNum label="Deck (m²)" valor={get("pisos.deckM2")} onChange={(v) => set("pisos.deckM2", v)} />
            <div style={{ fontSize: 11, color: "#9ca3af" }}>+ Cetol 1 lata / 20 m²</div>
            <div><label style={C.label}>Produto (Insumos)</label><input style={C.input} list="vk-insumos-pisos" value={get("pisos.deckProduto") ?? ""} placeholder="Piso - Deck" onChange={(e) => set("pisos.deckProduto", e.target.value)} /></div>
          </div>
        </BlocoColapsavel>

        <BlocoColapsavel titulo="Instalações" subtitulo={`estimativa por kits a partir dos cômodos do bloco Geral · padrão ${padraoInstalacoes(projetoDraft.padrao)}`} aberto={!!blocosAbertos.ambientes} onToggle={() => toggleBloco("ambientes")}>
          <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#6b7280" }}>
            Sem projeto de engenharia, hidráulica, esgoto, elétrica, louças e portas são estimados por conjuntos de pontos por cômodo (prática do SINAPI), com os kits de Insumos → Composições e os cômodos informados no bloco Geral. Padrão Alto e Altíssimo usam os kits de acabamento superior.
          </div>
          <CampoSelect label="Aquecimento de água" valor={get("instalacoes.aquecimento") || "nenhum"} onChange={(v) => set("instalacoes.aquecimento", v)}
            opcoes={(typeof SISTEMAS_AQUECIMENTO !== "undefined" ? SISTEMAS_AQUECIMENTO : []).map((x) => ({ value: x.id, label: x.nome }))} />
          <CampoSelect label="Pressurizador" valor={get("instalacoes.pressurizador") ? "sim" : "nao"} onChange={(v) => set("instalacoes.pressurizador", v === "sim")} opcoes={[{ value: "nao", label: "Não" }, { value: "sim", label: "Sim" }]} />
          <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Disciplinas que vêm do projeto de engenharia (a estimativa por kits sai destas):</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {ETAPAS_PROJETO.filter((e) => DISCIPLINAS_INSTALACOES.includes(e.id)).map((e) => {
                const marcado = !!get(`instalacoes.doProjeto.${e.id}`);
                const temItens = itensProjetoLista.some((it) => it.etapa === e.id && it.nome);
                return (
                  <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151", padding: "6px 10px", border: "1px solid rgba(38,36,33,0.14)", borderRadius: 8, background: marcado ? "#eef2ff" : "#fff", cursor: "pointer" }}>
                    <input type="checkbox" checked={marcado} onChange={(ev) => set(`instalacoes.doProjeto.${e.id}`, ev.target.checked)} />
                    {e.nome}
                    {temItens && !marcado && <span style={{ color: "#b45309", fontSize: 11 }} title="Há itens do projeto nesta disciplina e a estimativa por kits também está ligada: vai somar os dois.">· soma com o projeto</span>}
                  </label>
                );
              })}
            </div>
          </div>
        </BlocoColapsavel>

        <BlocoColapsavel titulo="Itens do projeto de engenharia" subtitulo={`${itensProjetoLista.length} ite${itensProjetoLista.length !== 1 ? "ns" : "m"} · hidráulica, esgoto, elétrica, louças e metais, aquecimento`} aberto={!!blocosAbertos.itensProjeto} onToggle={() => toggleBloco("itensProjeto")}>
          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              A planilha nunca quantificou esses grupos — eles vêm do projeto de engenharia. Digite (ou cole) a lista do projeto; cada item é procurado no catálogo de Insumos pelo nome e precificado como os demais.
            </div>
            <datalist id="vk-insumos-lista">
              {catalogoInsumos.map((m) => <option key={m.id || m.codigo || m.nome} value={m.nome} />)}
            </datalist>
            {ETAPAS_PROJETO.map((et) => {
              const doGrupo = itensProjetoLista.map((it, idx) => ({ it, idx })).filter((x) => x.it.etapa === et.id);
              if (!doGrupo.length) return null;
              return (
                <div key={et.id} style={{ padding: 10, background: "#fafafa", borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#262421", marginBottom: 6 }}>{et.nome} <span style={{ color: "#9ca3af", fontWeight: 400 }}>· {doGrupo.length}</span></div>
                  {doGrupo.map(({ it, idx }) => {
                    const st = statusItemProjeto(it);
                    return (
                      <div key={idx} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "3fr 1fr 1fr 1.4fr auto", gap: 8, alignItems: "end", marginBottom: 6 }}>
                        <div>
                          <label style={C.label}>Insumo</label>
                          <input style={C.input} list="vk-insumos-lista" value={it.nome ?? ""} placeholder="nome do material (como em Insumos)"
                            onChange={(e) => updateItemProjeto(idx, "nome", e.target.value)} />
                          {st && <div style={{ fontSize: 10.5, color: st.cor, marginTop: 2 }}>{st.texto}</div>}
                        </div>
                        <CampoNum label="Quantidade" valor={it.qtd} onChange={(v) => updateItemProjeto(idx, "qtd", v)} />
                        <CampoTexto label="Unidade" valor={it.unidade} placeholder="auto" onChange={(v) => updateItemProjeto(idx, "unidade", v)} />
                        <CampoSelect label="Etapa" valor={it.etapa} onChange={(v) => updateItemProjeto(idx, "etapa", v)} opcoes={ETAPAS_PROJETO.map((e) => ({ value: e.id, label: e.nome }))} />
                        <button type="button" onClick={() => removeItemProjeto(idx)} style={{ ...C.btnGhost, color: "#dc2626", height: 36 }}>Remover</button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {itensProjetoLista.length < ITENS_PROJETO_MAX && (
                <button type="button" style={C.btnSec} onClick={() => addItemProjeto(colarEtapa)}>＋ Adicionar item</button>
              )}
              <button type="button" style={C.btnSec} onClick={() => setColarAberto(!colarAberto)}>{colarAberto ? "Fechar" : "Colar lista do projeto"}</button>
            </div>
            {colarAberto && (
              <div style={{ padding: 10, border: "1px dashed rgba(38,36,33,0.2)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                <CampoSelect label="Etapa dos itens colados" valor={colarEtapa} onChange={setColarEtapa} opcoes={ETAPAS_PROJETO.map((e) => ({ value: e.id, label: e.nome }))} />
                <div>
                  <label style={C.label}>Uma linha por item: nome ; quantidade ; unidade (a unidade é opcional)</label>
                  <textarea style={{ ...C.input, height: 140, fontFamily: "inherit", resize: "vertical" }} value={colarTexto} onChange={(e) => setColarTexto(e.target.value)}
                    placeholder={"PVC - Esgoto - Tubo 100mm ; 12\nPVC - Esgoto - Joelho 90° 100mm ; 8\nElétrica - Cabo Flex Cobre 2.5mm ; 300 ; Mts"} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" style={C.btnSec} onClick={colarItensProjeto}>Adicionar {interpretarListaColada(colarTexto).length} item(ns)</button>
                </div>
              </div>
            )}
          </div>
        </BlocoColapsavel>

        <BlocoColapsavel titulo="Pavimentação externa" aberto={!!blocosAbertos.externa} onToggle={() => toggleBloco("externa")}>
          <CampoNum label="Pavimentação externa (m²)" valor={get("externa.pavimentacao")} onChange={(v) => set("externa.pavimentacao", v)} />
          <CampoNum label="Perímetro da pavimentação" valor={get("externa.perimetroPavimentacao")} onChange={(v) => set("externa.perimetroPavimentacao", v)} />
        </BlocoColapsavel>

        <BlocoColapsavel titulo="Muro de divisa" aberto={!!blocosAbertos.muroDivisa} onToggle={() => toggleBloco("muroDivisa")}>
          <CampoNum label="Comprimento (m)" valor={get("externa.muroDivisa.comprimento")} onChange={(v) => set("externa.muroDivisa.comprimento", v)} />
          <CampoNum label="Altura (m)" valor={get("externa.muroDivisa.altura")} onChange={(v) => set("externa.muroDivisa.altura", v)} />
        </BlocoColapsavel>

        <BlocoColapsavel titulo="Engenharia — Fundação" subtitulo="brocas, sapatas, arranques e baldrames" aberto={!!blocosAbertos.fundacao} onToggle={() => toggleBloco("fundacao")}>
          <CampoNum label="Qtd. de estacas (brocas)" valor={get("engenharia.fundacao.qtdEstacas")} onChange={(v) => set("engenharia.fundacao.qtdEstacas", v)} />
          <CampoNum label="Profundidade (m)" valor={get("engenharia.fundacao.profEstacas")} onChange={(v) => set("engenharia.fundacao.profEstacas", v)} />
          <CampoSelect label="Resistência do concreto" valor={get("engenharia.fundacao.resistenciaConcreto") || "Concreto - FCK25"} onChange={(v) => set("engenharia.fundacao.resistenciaConcreto", v)} opcoes={OPCOES_FCK} />
          <GradeFerro get={get} set={set}
            pathFerro="engenharia.fundacao.ferro" pathConcreto="engenharia.fundacao.concreto"
            elementos={[
              { key: "estacas", label: "Brocas / estacas" },
              { key: "sapatas", label: "Sapatas" },
              { key: "arranques", label: "Arranques" },
              { key: "baldrames", label: "Baldrames" },
            ]} />
        </BlocoColapsavel>

        <BlocoColapsavel titulo="Engenharia — Pilares e vigas" subtitulo={ehTerrea ? "térreo e cobertura" : "térreo, pav. 1 e cobertura"} aberto={!!blocosAbertos.estrutura} onToggle={() => toggleBloco("estrutura")}>
          <div style={{ gridColumn: "1 / -1", fontSize: 12, fontWeight: 700, color: "#b5652f", textTransform: "uppercase", letterSpacing: 0.6 }}>Pav. Térreo</div>
          <CampoNum label="Qtd. pilares 15cm" valor={get("engenharia.colunasTerreo.15")} onChange={(v) => set("engenharia.colunasTerreo.15", v)} />
          <CampoNum label="Qtd. pilares 20cm" valor={get("engenharia.colunasTerreo.20")} onChange={(v) => set("engenharia.colunasTerreo.20", v)} />
          <CampoNum label="Qtd. pilares 30cm" valor={get("engenharia.colunasTerreo.30")} onChange={(v) => set("engenharia.colunasTerreo.30", v)} />
          <CampoNum label="Área de forma pilares > 25cm (m²)" valor={get("engenharia.colunasTerreo.areaFormaMaior25cm")} onChange={(v) => set("engenharia.colunasTerreo.areaFormaMaior25cm", v)} />
          <CampoNum label="Concreto pilares (m³)" valor={get("engenharia.colunasTerreo.concreto")} onChange={(v) => set("engenharia.colunasTerreo.concreto", v)} />
          <LinhaFerro rotulo="Armadura dos pilares do térreo" pathFerro="engenharia.colunasTerreo.ferro" get={get} set={set} />
          <CampoNum label="Concreto viga de respaldo (m³)" valor={get("terreo.concretoVigaRespaldo")} onChange={(v) => set("terreo.concretoVigaRespaldo", v)} />
          <LinhaFerro rotulo="Armadura da viga de respaldo do térreo" pathFerro="terreo.vigaRespaldo" get={get} set={set} />

          {!ehTerrea && (
            <>
              <div style={{ gridColumn: "1 / -1", fontSize: 12, fontWeight: 700, color: "#b5652f", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 8 }}>Pav. 1</div>
              <CampoNum label="Qtd. pilares 15cm" valor={get("engenharia.colunasPav1.15")} onChange={(v) => set("engenharia.colunasPav1.15", v)} />
              <CampoNum label="Qtd. pilares 20cm" valor={get("engenharia.colunasPav1.20")} onChange={(v) => set("engenharia.colunasPav1.20", v)} />
              <CampoNum label="Qtd. pilares 25cm" valor={get("engenharia.colunasPav1.25")} onChange={(v) => set("engenharia.colunasPav1.25", v)} />
              <CampoNum label="Qtd. pilares 30cm" valor={get("engenharia.colunasPav1.30")} onChange={(v) => set("engenharia.colunasPav1.30", v)} />
              <CampoNum label="Área de forma pilares > 25cm (m²)" valor={get("engenharia.colunasPav1.areaFormaMaior25cm")} onChange={(v) => set("engenharia.colunasPav1.areaFormaMaior25cm", v)} />
              <CampoNum label="Concreto pilares (m³)" valor={get("engenharia.colunasPav1.concreto")} onChange={(v) => set("engenharia.colunasPav1.concreto", v)} />
              <LinhaFerro rotulo="Armadura dos pilares do pav. 1" pathFerro="engenharia.colunasPav1.ferro" get={get} set={set} />
              <CampoNum label="Concreto viga de respaldo (m³)" valor={get("pav1.concretoVigaRespaldo")} onChange={(v) => set("pav1.concretoVigaRespaldo", v)} />
              <LinhaFerro rotulo="Armadura da viga de respaldo do pav. 1" pathFerro="pav1.vigaRespaldo" get={get} set={set} />
            </>
          )}

          <div style={{ gridColumn: "1 / -1", fontSize: 12, fontWeight: 700, color: "#b5652f", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 8 }}>Cobertura</div>
          <CampoNum label="Qtd. pilares 15cm" valor={get("engenharia.coberturaEstrutura.colunas.15")} onChange={(v) => set("engenharia.coberturaEstrutura.colunas.15", v)} />
          <CampoNum label="Qtd. pilares 20cm" valor={get("engenharia.coberturaEstrutura.colunas.20")} onChange={(v) => set("engenharia.coberturaEstrutura.colunas.20", v)} />
          <CampoNum label="Qtd. pilares 25cm" valor={get("engenharia.coberturaEstrutura.colunas.25")} onChange={(v) => set("engenharia.coberturaEstrutura.colunas.25", v)} />
          <CampoNum label="Área de forma pilares > 25cm (m²)" valor={get("engenharia.coberturaEstrutura.areaFormaMaior25cm")} onChange={(v) => set("engenharia.coberturaEstrutura.areaFormaMaior25cm", v)} />
          <CampoNum label="Concreto pilares (m³)" valor={get("engenharia.coberturaEstrutura.volumeConcreto.coluna")} onChange={(v) => set("engenharia.coberturaEstrutura.volumeConcreto.coluna", v)} />
          <CampoNum label="Concreto vigas (m³)" valor={get("engenharia.coberturaEstrutura.volumeConcreto.viga")} onChange={(v) => set("engenharia.coberturaEstrutura.volumeConcreto.viga", v)} />
          <LinhaFerro rotulo="Armadura dos pilares da cobertura" pathFerro="engenharia.coberturaEstrutura.ferro.coluna" get={get} set={set} />
          <LinhaFerro rotulo="Armadura das vigas da cobertura" pathFerro="engenharia.coberturaEstrutura.ferro.viga" get={get} set={set} />
        </BlocoColapsavel>

        <BlocoColapsavel titulo="Muro de arrimo" subtitulo="opcional" aberto={!!blocosAbertos.arrimo} onToggle={() => toggleBloco("arrimo")}>
          <CampoNum label="Comprimento (m)" valor={get("arrimo.comprimento")} onChange={(v) => set("arrimo.comprimento", v)} />
          <CampoNum label="Altura (m)" valor={get("arrimo.altura")} onChange={(v) => set("arrimo.altura", v)} />
          <CampoNum label="Nº de vigas" valor={get("arrimo.numeroVigas")} onChange={(v) => set("arrimo.numeroVigas", v)} />
          <CampoNum label="Qtd. de estacas" valor={get("arrimo.qtdEstacas")} onChange={(v) => set("arrimo.qtdEstacas", v)} />
          <CampoNum label="Profundidade estacas (m)" valor={get("arrimo.profEstacas")} onChange={(v) => set("arrimo.profEstacas", v)} />
          <CampoSelect label="Resistência do concreto" valor={get("arrimo.resistenciaConcreto") || "Concreto - FCK25"} onChange={(v) => set("arrimo.resistenciaConcreto", v)} opcoes={OPCOES_FCK} />
          <CampoNum label="Qtd. pilares 15cm" valor={get("arrimo.colunas.15")} onChange={(v) => set("arrimo.colunas.15", v)} />
          <CampoNum label="Qtd. pilares 20cm" valor={get("arrimo.colunas.20")} onChange={(v) => set("arrimo.colunas.20", v)} />
          <CampoNum label="Qtd. pilares 30cm" valor={get("arrimo.colunas.30")} onChange={(v) => set("arrimo.colunas.30", v)} />
          <CampoNum label="Área de forma pilares > 25cm (m²)" valor={get("arrimo.areaFormaColunaMaior25cm")} onChange={(v) => set("arrimo.areaFormaColunaMaior25cm", v)} />
          <GradeFerro get={get} set={set}
            pathFerro="arrimo.ferro" pathConcreto="arrimo.concreto"
            elementos={[
              { key: "estacas", label: "Brocas / estacas" },
              { key: "sapatas", label: "Sapatas" },
              { key: "arranques", label: "Arranques" },
              { key: "baldrame", label: "Baldrame" },
              { key: "gigante", label: "Gigantes" },
              { key: "colunas", label: "Pilares" },
              { key: "vigas", label: "Vigas" },
            ]} />
        </BlocoColapsavel>

        {temPiscina && (
        <BlocoColapsavel titulo="Piscina" subtitulo="marcada no bloco Geral" aberto={!!blocosAbertos.piscina} onToggle={() => toggleBloco("piscina")}>
          <CampoNum label="Área construída (m²)" valor={get("piscina.areaConstruida")} onChange={(v) => set("piscina.areaConstruida", v)} />
          <CampoNum label="Profundidade (m)" valor={get("piscina.profundidade")} onChange={(v) => set("piscina.profundidade", v)} />
          <CampoNum label="Paredes — m² total" valor={get("piscina.paredesM2Total")} onChange={(v) => set("piscina.paredesM2Total", v)} />
          <CampoNum label="Perímetro de paredes" valor={get("piscina.perimetroParedes")} onChange={(v) => set("piscina.perimetroParedes", v)} />
          <CampoNum label="Qtd. de estacas" valor={get("piscina.qtdEstacas")} onChange={(v) => set("piscina.qtdEstacas", v)} />
          <CampoNum label="Profundidade estacas (m)" valor={get("piscina.profundidadeEstacas")} onChange={(v) => set("piscina.profundidadeEstacas", v)} />
          <CampoNum label="Gabarito da obra" valor={get("piscina.gabaritoObra")} onChange={(v) => set("piscina.gabaritoObra", v)} />
          <CampoSelect label="Resistência do concreto" valor={get("piscina.resistenciaConcreto") || "Concreto - FCK25"} onChange={(v) => set("piscina.resistenciaConcreto", v)} opcoes={OPCOES_FCK} />
          <CampoNum label="Qtd. pilares 15cm" valor={get("piscina.colunas.15")} onChange={(v) => set("piscina.colunas.15", v)} />
          <CampoNum label="Qtd. pilares 20cm" valor={get("piscina.colunas.20")} onChange={(v) => set("piscina.colunas.20", v)} />
          <CampoNum label="Qtd. pilares 25cm" valor={get("piscina.colunas.25")} onChange={(v) => set("piscina.colunas.25", v)} />
          <CampoNum label="Área de forma pilares > 25cm (m²)" valor={get("piscina.areaFormaColunaMaior25cm")} onChange={(v) => set("piscina.areaFormaColunaMaior25cm", v)} />
          <GradeFerro get={get} set={set}
            pathFerro="piscina.ferro" pathConcreto="piscina.concreto"
            elementos={[
              { key: "estacas", label: "Brocas / estacas" },
              { key: "sapatas", label: "Sapatas" },
              { key: "arranques", label: "Arranques" },
              { key: "baldrame", label: "Baldrame" },
              { key: "contrapiso", label: "Contrapiso" },
              { key: "colunas", label: "Pilares" },
              { key: "vigas", label: "Vigas" },
            ]} />
        </BlocoColapsavel>
        )}

        <BlocoColapsavel titulo="Prestadores" subtitulo="valores sugeridos, editáveis" aberto={!!blocosAbertos.prestadores} onToggle={() => toggleBloco("prestadores")}>
          {Object.keys(TAXAS_PRESTADORES).filter((chave) => temPiscina || (chave !== "pedreirosPiscina" && chave !== "instaladorEquipPiscina")).map((chave) => (
            <CampoNum key={chave} label={chave} valor={get(`prestadores.${chave}`)} onChange={(v) => set(`prestadores.${chave}`, v)} />
          ))}
          <CampoNum label="gestaoObra" valor={get("prestadores.gestaoObra")} onChange={(v) => set("prestadores.gestaoObra", v)} />
          <CampoNum label="carpinteiro" valor={get("prestadores.carpinteiro")} onChange={(v) => set("prestadores.carpinteiro", v)} />
          <CampoNum label="impermeabilizador" valor={get("prestadores.impermeabilizador")} onChange={(v) => set("prestadores.impermeabilizador", v)} />
          <CampoNum label="marceneiroPortas" valor={get("prestadores.marceneiroPortas")} onChange={(v) => set("prestadores.marceneiroPortas", v)} />
          <CampoNum label="serralheiro" valor={get("prestadores.serralheiro")} onChange={(v) => set("prestadores.serralheiro", v)} />
        </BlocoColapsavel>

        {perm.podeEditar && (
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <button style={C.btnSec} onClick={() => setViewInterna(obra.orcamento ? "resultado" : "vazio")}>Cancelar</button>
            <button style={C.btn} onClick={recalcular}>Gerar orçamento</button>
          </div>
        )}
      </div>
    );
  }

  // ── Resultado ──────────────────────────────────────────────
  const orc = obra.orcamento;
  const custoPorM2 = projetoDraft.arquitetura?.areaConstruida ? orc.totais.geral / Number(projetoDraft.arquitetura.areaConstruida) : 0;

  const itensPorEtapa = [];
  const vistos = new Set();
  for (const item of orc.itens) {
    if (!vistos.has(item.etapa)) { vistos.add(item.etapa); itensPorEtapa.push({ ordem: item.ordem, etapa: item.etapa, itens: [] }); }
    itensPorEtapa.find((e) => e.etapa === item.etapa).itens.push(item);
  }
  itensPorEtapa.sort((a, b) => a.ordem - b.ordem);

  return (
    <div style={wrap}>
      <button onClick={onVoltar} style={{ ...C.btnGhost, marginBottom: 16, fontSize: 12 }}>← Voltar</button>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          ["Total geral", orc.totais.geral],
          ["Bruto", orc.totais.bruto],
          ["Acabamento", orc.totais.acabamento],
          ["Prestadores", orc.totais.prestadores],
          ["Custo por m²", custoPorM2],
        ].map(([label, valor]) => (
          <div key={label} style={{ background: "#fafafa", border: "1px solid #f3f4f6", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#262421" }}>{formatoBRL(valor)}</div>
          </div>
        ))}
      </div>

      {orc.qualidade ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#374151" }}>
            <b>{orc.qualidade.comPreco} de {orc.qualidade.total} itens precificados</b>
            {" · "}{orc.qualidade.alta + orc.qualidade.media} com preço atual
            {" · "}{orc.qualidade.baixa + orc.qualidade.obsoleta} corrigidos pelo INCC ou antigos
            {orc.qualidade.manual ? ` · ${orc.qualidade.manual} manual` : ""}
            {orc.qualidade.semPreco.length ? ` · ${orc.qualidade.semPreco.length} sem preço (R$ 0)` : ""}
            <span style={{ color: "#9ca3af" }}> — gerado em {new Date(orc.geradoEm).toLocaleDateString("pt-BR")}; recalcule para usar preços novos.</span>
          </div>
          {(orc.qualidade.semPreco.length > 0 || orc.qualidade.atencao.length > 0 || (orc.avisos || []).some((a) => a.tipo && a.tipo.startsWith("esquadria"))) && (
            <details style={{ marginTop: 8, fontSize: 12, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "8px 14px" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>Preços que merecem atenção ({orc.qualidade.semPreco.length + orc.qualidade.atencao.length})</summary>
              {orc.qualidade.semPreco.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontWeight: 600 }}>Sem preço no catálogo de Insumos — entram com R$ 0:</div>
                  <div>{orc.qualidade.semPreco.join(" · ")}</div>
                </div>
              )}
              {orc.qualidade.atencao.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontWeight: 600 }}>Preço antigo (corrigido pelo INCC) — vale cotar:</div>
                  <div>{orc.qualidade.atencao.map((a) => `${a.item} (${formatoBRL(a.preco)}, ${a.confianca})`).join(" · ")}</div>
                </div>
              )}
              {(orc.avisos || []).filter((a) => a.tipo && a.tipo.startsWith("esquadria")).map((a, i) => (
                <div key={i} style={{ marginTop: 6 }}>{a.mensagem}</div>
              ))}
            </details>
          )}
        </div>
      ) : (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#92400e", marginBottom: 16 }}>
          Orçamento gerado antes do catálogo de preços. Recalcule para precificar com o módulo de Insumos.
        </div>
      )}

      {(() => {
        const todasRecolhidas = itensPorEtapa.length > 0 && itensPorEtapa.every((g) => etapasColapsadas[g.etapa]);
        const alternarTodas = () => {
          if (todasRecolhidas) { setEtapasColapsadas({}); return; }
          const tudo = {};
          for (const g of itensPorEtapa) tudo[g.etapa] = true;
          setEtapasColapsadas(tudo);
        };
        return (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{itensPorEtapa.length} etapas · {orc.itens.length} itens</div>
            <button type="button" onClick={alternarTodas} style={{ ...C.btnSec, fontSize: 12, padding: "6px 12px" }}>
              {todasRecolhidas ? "Mostrar todos os itens ▼" : "Recolher todos os itens ▲"}
            </button>
          </div>
        );
      })()}

      <div style={{ overflowX: "auto", marginBottom: 16 }}>
        {itensPorEtapa.map((grupo) => {
          const subtotal = grupo.itens.reduce((acc, i) => acc + i.total, 0);
          const colapsado = etapasColapsadas[grupo.etapa];
          return (
            <div key={grupo.etapa} style={{ marginBottom: 8, border: "1px solid rgba(38,36,33,0.1)", borderRadius: 10, overflow: "hidden" }}>
              <button type="button" onClick={() => toggleEtapa(grupo.etapa)}
                style={{ width: "100%", display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#f9fafb", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#262421" }}>{grupo.etapa}</span>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{formatoBRL(subtotal)} {colapsado ? "▼" : "▲"}</span>
              </button>
              {!colapsado && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 560 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "#9ca3af", fontSize: 10, textTransform: "uppercase" }}>
                      <th style={{ padding: "6px 14px" }}>Item</th>
                      <th style={{ padding: "6px 14px" }}>Unidade</th>
                      <th style={{ padding: "6px 14px", textAlign: "right" }}>Qtd</th>
                      <th style={{ padding: "6px 14px", textAlign: "right" }}>Preço</th>
                      <th style={{ padding: "6px 14px", textAlign: "right" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.itens.map((i, idx) => (
                      <tr key={idx} style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "6px 14px", color: "#262421" }}>{i.item}</td>
                        <td style={{ padding: "6px 14px", color: "#6b7280" }}>{i.unidade}</td>
                        <td style={{ padding: "6px 14px", textAlign: "right", color: "#374151" }}>{Number(i.qtd).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                        <td style={{ padding: "6px 14px", textAlign: "right", color: "#374151", whiteSpace: "nowrap" }} title={rotuloConfianca(i)}>
                          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 4, marginRight: 6, background: corConfianca(i.confianca, i.semPreco) }} />
                          {formatoBRL(i.preco)}
                        </td>
                        <td style={{ padding: "6px 14px", textAlign: "right", color: "#262421", fontWeight: 600 }}>{formatoBRL(i.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 16 }}>
        Gerado em {new Date(orc.geradoEm).toLocaleString("pt-BR")}, versão {orc.versao}.
      </div>

      {perm.podeEditar && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={C.btn} onClick={recalcular}>Recalcular</button>
          <button style={C.btnSec} onClick={() => setViewInterna("form")}>Editar dados do projeto</button>
          <button style={C.btnSec} onClick={exportarCSV}>Exportar CSV</button>
        </div>
      )}
      {!perm.podeEditar && (
        <button style={C.btnSec} onClick={exportarCSV}>Exportar CSV</button>
      )}
    </div>
  );
}
