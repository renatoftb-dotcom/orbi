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
// Módulos ainda não implementados (§10, passos 3-5) — esqueleto apenas,
// chamados na ordem certa por gerarOrcamentoObra() mas sem corpo ainda.
// ═══════════════════════════════════════════════════════════════
function instalacoesObraProjetos(cp, out) {}
function fundacao(cp, out) {}
function contrapisoInternoTerreo(cp, out) {}
function vigaRespaldoLajeTerreo(cp, out) {}
function paredesPav1(cp, out) {}
function vigaRespaldoLajePav1(cp, out) {}
function supraCobertura(cp, out) {}
function cobertura(cp, out) {}
function chapiscoReboco(cp, out) {}
function contrapisosExternos(cp, out) {}
function muroDivisa(cp, out) {}
function muroArrimo(cp, out) {}
function piscina(cp, out) {}

// ═══════════════════════════════════════════════════════════════
// normalizarProjeto — de obra.projeto (aninhado, §3.3) para cp (achatado,
// nomes que espelham os CP_* do VBA em camelCase). Mapa explícito abaixo,
// pra conferir contra a planilha; campo ausente sempre vira 0.
//
//   CP_AREA_CONSTRUIDA_EDIF            → arquitetura.areaConstruida
//   CP_M2_PAREDES_INTERNAS_EDIF        → arquitetura.m2ParedesInternas
//   CP_M2_PAREDES_EXTERNAS_EDIF        → arquitetura.m2ParedesExternas
//   CP_M2_PAREDES_20_TERREO_EDIF       → terreo.m2Parede20
//   CP_M2_PAREDES_25_TERREO_EDIF       → terreo.m2Parede25
//   CP_M2_PAREDES_15_TERREO_EDIF       → terreo.m2Parede15
//   CP_VAO_PORTAS_JANELAS_TERREO_EDIF  → terreo.vaoPortasJanelas
//   CP_COLUNAS_15/20/30_TERREO_EDIF    → engenharia.colunas.terreo.{15,20,30}
//   CP_AREA_FORMA_COLUNA_MAIOR_25CM    → engenharia.colunas.terreo.areaFormaMaior25cm
//   CP_CONCR_COLUNA_TERREO_EDIF        → engenharia.colunas.terreo.concreto
//   CP_CA*_COLUNA_TERREO_EDIF          → engenharia.colunas.terreo.ferro.{CA*}
//   CP_REVESTIMENTO_INTERNO_EDIF       → externa.revestimentoInterno
//   CP_PAVIMENTACAO_EXTERNA            → externa.pavimentacao
//   CP_COMPRIMENTO_MURO_DIVISA/ALTURA  → externa.muroDivisa.{comprimento,altura}
//   CP_COMPRIMENTO_ARRIMO/ALTURA_ARRIMO→ arrimo.{comprimento,altura}
//   CP_AREA_CONSTRUIDA_PISCINA         → piscina.areaConstruida
//   CALC_AREA_COBERTURA_TOTAL          → (calculado por cobertura(), ainda 0)
//   CP_PRESTADORES_*                   → prestadores.<camelCase>
// ═══════════════════════════════════════════════════════════════
function normalizarProjeto(projeto) {
  const p = projeto || {};
  const arq = p.arquitetura || {};
  const terreo = p.terreo || {};
  const pav1 = p.pav1 || {};
  const eng = p.engenharia || {};
  const colunasTerreo = (eng.colunas && eng.colunas.terreo) || {};
  const ferroColunasTerreo = colunasTerreo.ferro || {};
  const externa = p.externa || {};
  const muroDivisaIn = externa.muroDivisa || {};
  const arrimo = p.arrimo || {};
  const piscinaIn = p.piscina || {};
  const prestadoresIn = p.prestadores || {};

  return {
    tipologia: p.tipologia === "Sobrado" ? "Sobrado" : "Térrea",

    areaConstruida: numOrZero(arq.areaConstruida),
    m2ParedesInternas: numOrZero(arq.m2ParedesInternas),
    m2ParedesExternas: numOrZero(arq.m2ParedesExternas),

    m2Paredes20Terreo: numOrZero(terreo.m2Parede20),
    m2Paredes25Terreo: numOrZero(terreo.m2Parede25),
    m2Paredes15Terreo: numOrZero(terreo.m2Parede15),
    vaoPortasJanelasTerreo: numOrZero(terreo.vaoPortasJanelas),

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

    // Pav. 1 — ainda não usado por nenhum dos 3 pilotos, mas já achatado
    // pra quando paredesPav1() for implementado (passo 3 da spec).
    m2Paredes20Pav1: numOrZero(pav1.m2Parede20),
    m2Paredes25Pav1: numOrZero(pav1.m2Parede25),
    m2Paredes15Pav1: numOrZero(pav1.m2Parede15),
    vaoPortasJanelasPav1: numOrZero(pav1.vaoPortasJanelas),

    revestimentoInterno: numOrZero(externa.revestimentoInterno),
    pavimentacaoExterna: numOrZero(externa.pavimentacao),
    comprimentoMuroDivisa: numOrZero(muroDivisaIn.comprimento),
    alturaMuroDivisa: numOrZero(muroDivisaIn.altura),

    comprimentoArrimo: numOrZero(arrimo.comprimento),
    alturaArrimo: numOrZero(arrimo.altura),

    areaConstruidaPiscina: numOrZero(piscinaIn.areaConstruida),

    // Calculado por cobertura() (ainda não implementado — passo 4 da spec).
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
