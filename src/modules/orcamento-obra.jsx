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
};

// ── Preço — placeholder nesta entrega (§3.4) ──
const PRECO_PADRAO = 1;

// Ponto único de resolução de preço. Hoje devolve 1 para tudo. Depois:
// busca em data.materiais por nome → ultimoPreco; se não achar, média das
// últimas compras em data.lancamentos; se não achar, 1.
function precoDoInsumo(nomeItem, data) {
  return PRECO_PADRAO;
}

// ── Helper de emissão, usado por todo módulo de cálculo (§4) ──
function emitir(out, { ordem, item, tipo, etapa, subEtapa, unidade, qtd, preco }) {
  if (!qtd || qtd === 0) return; // regra do VBA: só emite se qtd ≠ 0
  out.push({ ordem, item, tipo, etapa, subEtapa, unidade, qtd: Number(qtd), preco: preco ?? null });
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
function valorPadraoPrestador(chave, cp) {
  const t = TAXAS_PRESTADORES[chave];
  if (!t) return 0;
  switch (t.base) {
    case "areaConstruida": return cp.areaConstruida * t.valor;
    case "areaPavimentacao": return cp.pavimentacaoExterna * t.valor;
    case "m2MuroDivisa": return cp.comprimentoMuroDivisa * cp.alturaMuroDivisa * t.valor;
    case "m2MuroArrimo": return cp.comprimentoArrimo * cp.alturaArrimo * t.valor;
    case "areaPiscina": return cp.areaConstruidaPiscina * t.valor;
    case "fixo": return t.valor;
    default: return 0;
  }
}

// Valor final de um prestador com taxa padrão: override do usuário
// (projeto.prestadores.<chave>) se não-zero, senão o valor sugerido —
// exatamente o `If ... = 0 Or ... = "" Then <default>` do PRESTADORES.frm.
function valorPrestador(chave, cp) {
  const override = numOrZero(cp.prestadores && cp.prestadores[chave]);
  return override !== 0 ? override : valorPadraoPrestador(chave, cp);
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
function prestadores(cp, out) {
  const base = {
    ordem: ORD.prestadores,
    tipo: "Prestadores de serviços",
    etapa: "Prestadores de serviços",
    subEtapa: "Prestadores de serviços",
  };

  const valorPedreiros = valorPrestador("equipePedreiros", cp);
  emitir(out, { ...base, item: "Pedreiros Casa", unidade: "m2", qtd: cp.areaConstruida, preco: valorPedreiros / cp.areaConstruida });

  const valorEletricista = valorPrestador("eletricista", cp);
  emitir(out, { ...base, item: "Eletricista", unidade: "m2", qtd: cp.areaConstruida, preco: valorEletricista / cp.areaConstruida });

  const valorEncanador = valorPrestador("encanador", cp);
  emitir(out, { ...base, item: "Encanador", unidade: "m2", qtd: cp.areaConstruida, preco: valorEncanador / cp.areaConstruida });

  const valorPintor = valorPrestador("pintor", cp);
  emitir(out, { ...base, item: "Pintor", unidade: "m2", qtd: cp.areaConstruida, preco: valorPintor / cp.areaConstruida });

  // Carpinteiro: base é a área TOTAL de cobertura (CALC_AREA_COBERTURA_TOTAL
  // no .bas), não a área construída — ainda 0 aqui porque cobertura() é um
  // módulo futuro (passo 4 da spec, §10). Sem taxa padrão no .frm.
  const valorCarpinteiro = numOrZero(cp.prestadores && cp.prestadores.carpinteiro);
  emitir(out, { ...base, item: "Carpinteiro", unidade: "m2", qtd: cp.areaCoberturaTotal, preco: valorCarpinteiro / cp.areaCoberturaTotal });

  // Sem taxa padrão no .frm — só o valor digitado.
  const valorImpermeabilizador = numOrZero(cp.prestadores && cp.prestadores.impermeabilizador);
  emitir(out, { ...base, item: "Impermeabilizador", unidade: "Unidades", qtd: valorImpermeabilizador });

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
  const valorMarceneiro = numOrZero(cp.prestadores && cp.prestadores.marceneiroPortas);
  emitir(out, { ...base, item: "Marceneiro Portas Internas", unidade: "Unidades", qtd: valorMarceneiro });

  const valorGestao = (() => {
    const override = numOrZero(cp.prestadores && cp.prestadores.gestaoObra);
    return override !== 0 ? override : taxaGestaoObra(cp.areaConstruida) * cp.areaConstruida;
  })();
  emitir(out, { ...base, item: "Gestão Obra", unidade: "m2", qtd: cp.areaConstruida, preco: valorGestao / cp.areaConstruida });

  const valorInstaladorEquipPiscina = valorPrestador("instaladorEquipPiscina", cp);
  emitir(out, { ...base, item: "Instalador Equip. Piscina", unidade: "Unidades", qtd: 1, preco: valorInstaladorEquipPiscina });

  const valorPedreirosPiscina = valorPrestador("pedreirosPiscina", cp);
  emitir(out, { ...base, item: "Pedreiros Piscina", unidade: "m2", qtd: cp.areaConstruidaPiscina, preco: valorPedreirosPiscina / cp.areaConstruidaPiscina });

  const valorMuroArrimo = valorPrestador("muroArrimo", cp);
  const baseMuroArrimo = cp.alturaArrimo * cp.comprimentoArrimo;
  emitir(out, { ...base, item: "Pedreiros Muro Arrimo", unidade: "m2", qtd: baseMuroArrimo, preco: valorMuroArrimo / baseMuroArrimo });

  const valorMuroDivisa = valorPrestador("muroDivisa", cp);
  const baseMuroDivisa = cp.comprimentoMuroDivisa * cp.alturaMuroDivisa;
  emitir(out, { ...base, item: "Pedreiros Muro Divisa", unidade: "m2", qtd: baseMuroDivisa, preco: valorMuroDivisa / baseMuroDivisa });

  const valorPavimentacaoExterna = valorPrestador("pavimentacaoExterna", cp);
  emitir(out, { ...base, item: "Pedreiros Pavim. Externa", unidade: "m2", qtd: cp.pavimentacaoExterna, preco: valorPavimentacaoExterna / cp.pavimentacaoExterna });

  const valorTerraplanagem = valorPrestador("terraplanagem", cp);
  emitir(out, { ...base, item: "Terraplanagem", unidade: "Unidades", qtd: 1, preco: valorTerraplanagem });

  const valorInstaladorAquecedores = valorPrestador("instaladorAquecedores", cp);
  emitir(out, { ...base, item: "Instalador Aquecedores", unidade: "Unidades", qtd: 1, preco: valorInstaladorAquecedores });

  // Sem taxa padrão no .frm — só o valor digitado.
  const valorSerralheiro = numOrZero(cp.prestadores && cp.prestadores.serralheiro);
  emitir(out, { ...base, item: "Serralheiro", unidade: "Unidades", qtd: valorSerralheiro });
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

  const tipologia = p.tipologia === "Sobrado" ? "Sobrado" : "Térrea";

  return {
    tipologia,

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

    revestimentoInterno: numOrZero(externa.revestimentoInterno),
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

    areaConstruidaPiscina: numOrZero(piscinaIn.areaConstruida),

    // cp.piscina — usado por piscina()
    piscina: {
      areaConstruida: numOrZero(piscinaIn.areaConstruida),
      profundidade: numOrZero(piscinaIn.profundidade),
      paredesM2Total: numOrZero(piscinaIn.paredesM2Total),
      perimetroParedes: numOrZero(piscinaIn.perimetroParedes),
      qtdEstacas: numOrZero(piscinaIn.qtdEstacas),
      profundidadeEstacas: numOrZero(piscinaIn.profundidadeEstacas),
      gabaritoObra: numOrZero(piscinaIn.gabaritoObra),
      colunas15: numOrZero(colunasPiscina["15"]),
      colunas20: numOrZero(colunasPiscina["20"]),
      colunas25: numOrZero(colunasPiscina["25"]),
      areaFormaColunaMaior25cm: numOrZero(piscinaIn.areaFormaColunaMaior25cm),
      resistenciaConcreto: piscinaIn.resistenciaConcreto || "",
      ferro: {
        estacas: normalizarFerro(ferroPiscina.estacas),
        sapatas: normalizarFerro(ferroPiscina.sapatas),
        arranques: normalizarFerro(ferroPiscina.arranques),
        baldrame: normalizarFerro(ferroPiscina.baldrame),
        contrapiso: normalizarFerro(ferroPiscina.contrapiso),
        colunas: normalizarFerro(ferroPiscina.colunas),
        vigas: normalizarFerro(ferroPiscina.vigas),
      },
      concreto: {
        estacas: numOrZero(concretoPiscina.estacas),
        sapatas: numOrZero(concretoPiscina.sapatas),
        arranques: numOrZero(concretoPiscina.arranques),
        baldrame: numOrZero(concretoPiscina.baldrame),
        contrapiso: numOrZero(concretoPiscina.contrapiso),
        colunas: numOrZero(concretoPiscina.colunas),
        vigas: numOrZero(concretoPiscina.vigas),
      },
    },

    // cp.coberturas — array de até 16 telhados, usado por cobertura(). Não
    // confundir com cp.cobertura (engenharia de colunas/vigas, singular).
    coberturas: coberturasIn.slice(0, 16).map((t) => ({
      tipo: (t && t.tipo) || "",
      comprimento: numOrZero(t && t.comprimento),
      largura: numOrZero(t && t.largura),
      aguas: numOrZero(t && t.aguas),
      inclinacao: numOrZero(t && t.inclinacao),
    })),

    // Escrito por cobertura() (variável pública no VBA original) e lido
    // depois por prestadores() (base do Carpinteiro). Antes de cobertura()
    // rodar, fica 0 — igual ao VBA antes do loop.
    areaCoberturaTotal: 0,

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
    const preco = linha.preco != null ? linha.preco : precoDoInsumo(linha.item, data);
    return { ...linha, preco, total: linha.qtd * preco };
  });

  const somaPorTipo = (tipo) => itens.filter((i) => i.tipo === tipo).reduce((acc, i) => acc + i.total, 0);

  const totais = {
    bruto: somaPorTipo("Bruto"),
    acabamento: somaPorTipo("Acabamento"),
    prestadores: somaPorTipo("Prestadores de serviços"),
    geral: itens.reduce((acc, i) => acc + i.total, 0),
  };

  return { itens, totais, avisos: [] };
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
  piscina(cp, out);
  prestadores(cp, out);

  return precificarETotalizar(out, data);
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
    arquitetura: {},
    terreo: {},
    pav1: {},
    engenharia: { fundacao: {} },
    externa: { muroDivisa: {} },
    arrimo: {},
    piscina: {},
    cobertura: [],
    prestadores: {},
  };
}

function CampoNum({ label, valor, onChange }) {
  return (
    <div>
      <label style={C.label}>{label}</label>
      <input style={C.input} type="number" value={valor ?? ""} step="0.01"
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
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

  function toggleBloco(k) { setBlocosAbertos((b) => ({ ...b, [k]: !b[k] })); }
  function toggleEtapa(k) { setEtapasColapsadas((b) => ({ ...b, [k]: !b[k] })); }
  function set(caminho, valor) { setProjetoDraft((p) => setEmCaminho(p, caminho, valor)); }
  function get(caminho) { return lerCaminho(projetoDraft, caminho); }

  function recalcular() {
    const resultado = gerarOrcamentoObra(projetoDraft, data);
    const orcamento = {
      geradoEm: new Date().toISOString(),
      versao: (obra.orcamento?.versao || 0) + 1,
      itens: resultado.itens,
      totais: resultado.totais,
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
          <CampoSelect label="Tipologia" valor={projetoDraft.tipologia} onChange={(v) => set("tipologia", v)}
            opcoes={[{ value: "Sobrado", label: "Sobrado" }, { value: "Térrea", label: "Térrea" }]} />
          <CampoNum label="Área construída (m²)" valor={get("arquitetura.areaConstruida")} onChange={(v) => set("arquitetura.areaConstruida", v)} />
          <CampoNum label="M² de parede total" valor={get("arquitetura.m2ParedesTotal")} onChange={(v) => set("arquitetura.m2ParedesTotal", v)} />
          <CampoNum label="M² de parede interna" valor={get("arquitetura.m2ParedesInternas")} onChange={(v) => set("arquitetura.m2ParedesInternas", v)} />
          <CampoNum label="M² de parede externa" valor={get("arquitetura.m2ParedesExternas")} onChange={(v) => set("arquitetura.m2ParedesExternas", v)} />
          <CampoNum label="Gabarito" valor={get("arquitetura.gabarito")} onChange={(v) => set("arquitetura.gabarito", v)} />
        </BlocoColapsavel>

        <BlocoColapsavel titulo="Pav. Térreo" aberto={!!blocosAbertos.terreo} onToggle={() => toggleBloco("terreo")}>
          <CampoNum label="Área (m²)" valor={get("terreo.area")} onChange={(v) => set("terreo.area", v)} />
          <CampoNum label="Perímetro de paredes" valor={get("terreo.perimetroParedes")} onChange={(v) => set("terreo.perimetroParedes", v)} />
          <CampoNum label="M² parede 15cm" valor={get("terreo.m2Parede15")} onChange={(v) => set("terreo.m2Parede15", v)} />
          <CampoNum label="M² parede 20cm" valor={get("terreo.m2Parede20")} onChange={(v) => set("terreo.m2Parede20", v)} />
          <CampoNum label="M² parede 25cm" valor={get("terreo.m2Parede25")} onChange={(v) => set("terreo.m2Parede25", v)} />
          <CampoNum label="Vãos de portas e janelas" valor={get("terreo.vaoPortasJanelas")} onChange={(v) => set("terreo.vaoPortasJanelas", v)} />
        </BlocoColapsavel>

        <BlocoColapsavel titulo="Laje Térreo" aberto={!!blocosAbertos.lajeTerreo} onToggle={() => toggleBloco("lajeTerreo")}>
          <CampoNum label="Área (m²)" valor={get("terreo.areaLoje")} onChange={(v) => set("terreo.areaLoje", v)} />
          <CampoNum label="Perímetro" valor={get("terreo.perimetroLoje")} onChange={(v) => set("terreo.perimetroLoje", v)} />
          <CampoNum label="Área maciça (m²)" valor={get("terreo.areaLojeMacica")} onChange={(v) => set("terreo.areaLojeMacica", v)} />
          <CampoSelect label="Tipo" valor={get("terreo.tipoLoje")} onChange={(v) => set("terreo.tipoLoje", v)}
            opcoes={[{ value: "", label: "—" }, { value: "Treliça", label: "Treliça" }, { value: "Protendida", label: "Protendida" }]} />
          <CampoTexto label="Resistência do concreto" valor={get("terreo.resistenciaConcretoLoje")} onChange={(v) => set("terreo.resistenciaConcretoLoje", v)} placeholder="ex.: Concreto - FCK25" />
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
              <CampoTexto label="Resistência do concreto" valor={get("pav1.resistenciaConcretoLoje")} onChange={(v) => set("pav1.resistenciaConcretoLoje", v)} placeholder="ex.: Concreto - FCK25" />
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
                <CampoNum label="Inclinação" valor={t.inclinacao} onChange={(v) => updateTelhado(idx, "inclinacao", v)} />
                <button type="button" onClick={() => removeTelhado(idx)} style={{ ...C.btnGhost, color: "#dc2626", height: 36 }}>Remover</button>
              </div>
            ))}
            {coberturas.length < 16 && (
              <button type="button" style={{ ...C.btnSec, alignSelf: "flex-start" }} onClick={addTelhado}>＋ Adicionar telhado</button>
            )}
          </div>
        </BlocoColapsavel>

        <BlocoColapsavel titulo="Revestimento e externa" aberto={!!blocosAbertos.externa} onToggle={() => toggleBloco("externa")}>
          <CampoNum label="Revestimento interno (m²)" valor={get("externa.revestimentoInterno")} onChange={(v) => set("externa.revestimentoInterno", v)} />
          <CampoNum label="Pavimentação externa (m²)" valor={get("externa.pavimentacao")} onChange={(v) => set("externa.pavimentacao", v)} />
          <CampoNum label="Perímetro da pavimentação" valor={get("externa.perimetroPavimentacao")} onChange={(v) => set("externa.perimetroPavimentacao", v)} />
        </BlocoColapsavel>

        <BlocoColapsavel titulo="Muro de divisa" aberto={!!blocosAbertos.muroDivisa} onToggle={() => toggleBloco("muroDivisa")}>
          <CampoNum label="Comprimento (m)" valor={get("externa.muroDivisa.comprimento")} onChange={(v) => set("externa.muroDivisa.comprimento", v)} />
          <CampoNum label="Altura (m)" valor={get("externa.muroDivisa.altura")} onChange={(v) => set("externa.muroDivisa.altura", v)} />
        </BlocoColapsavel>

        <BlocoColapsavel titulo="Engenharia — Fundação" subtitulo="simplificado" aberto={!!blocosAbertos.fundacao} onToggle={() => toggleBloco("fundacao")}>
          <CampoNum label="Qtd. de estacas" valor={get("engenharia.fundacao.qtdEstacas")} onChange={(v) => set("engenharia.fundacao.qtdEstacas", v)} />
          <CampoNum label="Profundidade (m)" valor={get("engenharia.fundacao.profEstacas")} onChange={(v) => set("engenharia.fundacao.profEstacas", v)} />
          <CampoTexto label="Resistência do concreto" valor={get("engenharia.fundacao.resistenciaConcreto")} onChange={(v) => set("engenharia.fundacao.resistenciaConcreto", v)} placeholder="ex.: Concreto - FCK25" />
        </BlocoColapsavel>

        <BlocoColapsavel titulo="Muro de arrimo" subtitulo="opcional · simplificado" aberto={!!blocosAbertos.arrimo} onToggle={() => toggleBloco("arrimo")}>
          <CampoNum label="Comprimento (m)" valor={get("arrimo.comprimento")} onChange={(v) => set("arrimo.comprimento", v)} />
          <CampoNum label="Altura (m)" valor={get("arrimo.altura")} onChange={(v) => set("arrimo.altura", v)} />
          <CampoNum label="Nº de vigas" valor={get("arrimo.numeroVigas")} onChange={(v) => set("arrimo.numeroVigas", v)} />
          <CampoNum label="Qtd. de estacas" valor={get("arrimo.qtdEstacas")} onChange={(v) => set("arrimo.qtdEstacas", v)} />
          <CampoNum label="Profundidade estacas (m)" valor={get("arrimo.profEstacas")} onChange={(v) => set("arrimo.profEstacas", v)} />
          <CampoTexto label="Resistência do concreto" valor={get("arrimo.resistenciaConcreto")} onChange={(v) => set("arrimo.resistenciaConcreto", v)} placeholder="ex.: Concreto - FCK25" />
        </BlocoColapsavel>

        <BlocoColapsavel titulo="Piscina" subtitulo="opcional · simplificado" aberto={!!blocosAbertos.piscina} onToggle={() => toggleBloco("piscina")}>
          <CampoNum label="Área construída (m²)" valor={get("piscina.areaConstruida")} onChange={(v) => set("piscina.areaConstruida", v)} />
          <CampoNum label="Profundidade (m)" valor={get("piscina.profundidade")} onChange={(v) => set("piscina.profundidade", v)} />
          <CampoNum label="Paredes — m² total" valor={get("piscina.paredesM2Total")} onChange={(v) => set("piscina.paredesM2Total", v)} />
          <CampoNum label="Perímetro de paredes" valor={get("piscina.perimetroParedes")} onChange={(v) => set("piscina.perimetroParedes", v)} />
          <CampoNum label="Qtd. de estacas" valor={get("piscina.qtdEstacas")} onChange={(v) => set("piscina.qtdEstacas", v)} />
          <CampoNum label="Profundidade estacas (m)" valor={get("piscina.profundidadeEstacas")} onChange={(v) => set("piscina.profundidadeEstacas", v)} />
          <CampoNum label="Gabarito da obra" valor={get("piscina.gabaritoObra")} onChange={(v) => set("piscina.gabaritoObra", v)} />
          <CampoTexto label="Resistência do concreto" valor={get("piscina.resistenciaConcreto")} onChange={(v) => set("piscina.resistenciaConcreto", v)} placeholder="ex.: Concreto - FCK25" />
        </BlocoColapsavel>

        <BlocoColapsavel titulo="Prestadores" subtitulo="valores sugeridos, editáveis" aberto={!!blocosAbertos.prestadores} onToggle={() => toggleBloco("prestadores")}>
          {Object.keys(TAXAS_PRESTADORES).map((chave) => (
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

      <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#92400e", marginBottom: 16 }}>
        Preços ainda não cadastrados: todo insumo está a R$ 1,00. As quantidades são reais; os valores, não.
      </div>

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
                        <td style={{ padding: "6px 14px", textAlign: "right", color: "#374151" }}>{formatoBRL(i.preco)}</td>
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
