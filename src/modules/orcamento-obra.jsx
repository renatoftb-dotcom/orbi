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
  forros: 26,       // forros (módulo novo, sem equivalente no VBA)
  // Reforma. Demolição e entulho vêm antes de tudo (negativos) porque é o
  // que acontece primeiro na obra; a execução sobre o existente vem depois
  // de todas as etapas da parte nova.
  demolicao: -2,
  entulho: -1,
  existente: 27,
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
// Padrão em vigor no projeto. Projeto antigo sem o campo: herda do padrão das
// instalações (Alto → Alto), senão Médio. Motor e tela usam a mesma regra,
// para o que aparece no select ser exatamente o que o cálculo usa.
function padraoObra(projeto) {
  const p = projeto || {};
  if (PADROES_OBRA.includes(p.padrao)) return p.padrao;
  return p.instalacoes && p.instalacoes.padrao === "Alto" ? "Alto" : "Médio";
}

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

// ── Memória de cálculo (§ memória) ─────────────────────────────
// Todo item emitido pode levar `memoria`: a sequência de passos que leva do
// dado do projeto até a quantidade final, para a tela da engrenagem no
// quantitativo. Quatro tipos de passo:
//   dado   — número lido do projeto (com o bloco de onde veio)
//   conta  — fórmula em palavras + a mesma conta com os números substituídos
//   teto   — o arredondamento para cima (peça inteira: barra, saco, balde)
//   nota   — explicação em texto, sem conta
// A substituição dos números é automática: a fórmula é escrita com os nomes
// ("perímetro ÷ 3 × 1,10") e os pares [nome, valor] viram a linha com os
// números. Nomes maiores primeiro, para "perímetro" não estragar "perímetro
// da pavimentação".
function numMem(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) : String(x);
}
function contaMem(formula, subs) {
  let c = String(formula);
  for (const [nome, v] of (subs || []).slice().sort((a, b) => String(b[0]).length - String(a[0]).length)) {
    c = c.split(nome).join(numMem(v));
  }
  return c;
}
const MEM = {
  dado: (rotulo, valor, unidade, fonte) => ({ tipo: "dado", rotulo, valor: numMem(valor), unidade: unidade || "", fonte: fonte || "" }),
  conta: (rotulo, formula, subs, valor, unidade) => ({ tipo: "conta", rotulo, formula, conta: contaMem(formula, subs), valor: numMem(valor), unidade: unidade || "" }),
  teto: (bruto, valor, unidade, rotulo) => ({ tipo: "teto", rotulo: rotulo || "Arredonda para cima (peça inteira)", conta: `${numMem(bruto)} → ${numMem(valor)}`, valor: numMem(valor), unidade: unidade || "" }),
  nota: (texto) => ({ tipo: "nota", texto }),
};
// Itens de canteiro: quantidade fixa da planilha do escritório, sem conta.
const MEM_CANTEIRO = (texto) => [MEM.nota(texto || "Quantidade fixa do canteiro: entra igual em qualquer obra, não depende das medidas do projeto. Herdada da planilha do escritório; para mudar, edite o item no orçamento.")];

// ── Helper de emissão, usado por todo módulo de cálculo (§4) ──
function emitir(out, { ordem, item, tipo, etapa, subEtapa, unidade, qtd, preco, composicao, confianca, insumoCodigo, memoria }) {
  if (!qtd || qtd === 0) return; // regra do VBA: só emite se qtd ≠ 0
  const linha = { ordem, item, tipo, etapa, subEtapa, unidade, qtd: Number(qtd), preco: preco ?? null };
  if (composicao) linha.composicao = composicao; // item composto (esquadria): o que forma o preço unitário
  if (memoria) linha.memoria = memoria;          // passos do cálculo da quantidade (tela da engrenagem)
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
    out[k] = teto(numOrZero(somaPorBitola[k]) / BARRA_FERRO_MTS * PERDA);
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
function emitBarras(out, base, barras, memoriaDaBitola) {
  for (const k of Object.keys(PESOS_FERRO)) {
    emitir(out, { ...base, item: LABEL_BARRA[k], unidade: "Barras 12mts", qtd: barras[k], memoria: memoriaDaBitola ? memoriaDaBitola(k) : undefined });
  }
}
// Memória de um prestador: valor total (digitado ou sugerido pela taxa do
// escritório) dividido pela base de medida, para virar preço unitário.
function memoriaPrestador(chave, rotuloBase, base, valorTotal, cp, data) {
  const digitado = numOrZero(cp.prestadores && cp.prestadores[chave]);
  const taxa = typeof taxaPrestador === "function" ? taxaPrestador(chave, data) : null;
  const passos = [
    MEM.nota(digitado !== 0
      ? "Valor digitado por você no bloco Prestadores — é ele que vale, a sugestão do escritório fica de lado."
      : `Valor sugerido pelo escritório (tabela de prestadores em Insumos${taxa && taxa.confianca ? `, confiança ${taxa.confianca}` : ""}), porque nada foi digitado no bloco Prestadores.`),
  ];
  if (digitado === 0 && taxa && taxa.valor > 0) {
    passos.push(MEM.dado("Taxa de referência", taxa.valor, "R$ por unidade da base", "tabela de prestadores"));
  }
  passos.push(MEM.dado(rotuloBase, base, "", "medidas do projeto"));
  passos.push(MEM.conta("Valor total do serviço", digitado !== 0 ? "valor digitado" : "taxa × base", digitado !== 0 ? [] : [["taxa", taxa ? taxa.valor : 0], ["base", base]], valorTotal, "R$"));
  passos.push(MEM.conta("Preço unitário que entra na tabela", "valor ÷ base", [["valor", valorTotal], ["base", base]], base > 0 ? valorTotal / base : 0, "R$ por unidade"));
  passos.push(MEM.dado("Quantidade no orçamento", base, "", "a própria base de medida"));
  return passos;
}
// Memória de uma bitola lançada como um número só de metros.
function memoriaBitolaSimples(k, metros, barras, ondeVem) {
  const bruto = numOrZero(metros) / BARRA_FERRO_MTS * PERDA;
  return [
    MEM.nota(`Metros de ${LABEL_BARRA[k]} lançados ${ondeVem}.`),
    MEM.dado("Metros lançados no projeto", metros, "m", "bloco de engenharia"),
    MEM.conta("Barras de 12 m, com 10% de perda", "metros ÷ 12 × 1,10", [["metros", metros]], bruto, "barras"),
    MEM.teto(bruto, barras, "barras", "Arredonda para cima (barra inteira)"),
  ];
}
// ── Memórias reaproveitadas por térreo, pav. 1, muros e piscina ──
// As fórmulas de alvenaria e de concreto se repetem em vários módulos do
// VBA; os textos ficam aqui uma vez só, parametrizados pelo lugar da obra.
const MEMB = {
  tijolo6: (onde, m20, bruto, valor) => [
    MEM.nota("Bloco de 6 furos é o tijolo da parede de 20 cm: 40 tijolos por m² de parede."),
    MEM.dado(`Paredes de 20 cm ${onde}`, m20, "m²", "bloco de medidas do pavimento"),
    MEM.conta("Tijolos, com 10% de quebra", "parede 20 cm × 40 × 1,10", [["parede 20 cm", m20]], bruto, "tijolos"),
    MEM.teto(bruto, valor, "tijolos"),
  ],
  tijolo8: (onde, m25, m15, bruto, valor) => [
    MEM.nota("Bloco de 8 furos atende dois casos: parede de 25 cm (40 por m²) e parede de 15 cm (20 por m², assentado deitado)."),
    MEM.dado(`Paredes de 25 cm ${onde}`, m25, "m²", "bloco de medidas do pavimento"),
    MEM.dado(`Paredes de 15 cm ${onde}`, m15, "m²", "bloco de medidas do pavimento"),
    MEM.conta("Tijolos, com 10% de quebra", "(parede 25 cm × 40 + parede 15 cm × 20) × 1,10", [["parede 25 cm", m25], ["parede 15 cm", m15]], bruto, "tijolos"),
    MEM.teto(bruto, valor, "tijolos"),
  ],
  areiaAssentamento: (t6, t8, bruto, valor) => [
    MEM.nota("Argamassa de assentamento: 0,001638 m³ de areia por tijolo de 6 furos e 0,002223 por tijolo de 8 furos (o de 8 tem junta maior)."),
    MEM.dado("Tijolos de 6 furos", t6, "tijolos", "passo anterior"),
    MEM.dado("Tijolos de 8 furos", t8, "tijolos", "passo anterior"),
    MEM.conta("Areia, com 10% de perda", "6 furos × 0,001638 × 1,10 + 8 furos × 0,002223 × 1,10", [["6 furos", t6], ["8 furos", t8]], bruto, "m³"),
    MEM.teto(bruto, valor, "m³", "Arredonda para cima (a areia vem em m³ inteiro)"),
  ],
  vedalitAssentamento: (areia, bruto, valor) => [
    MEM.nota("Vedalit na argamassa de assentamento: um balde para cada 25 m³ de areia."),
    MEM.dado("Areia fina do assentamento", areia, "m³", "passo anterior"),
    MEM.conta("Baldes, com 10% de perda", "areia ÷ 25 × 1,10", [["areia", areia]], bruto, "baldes"),
    MEM.teto(bruto, valor, "baldes", "Arredonda para cima (balde fechado)"),
  ],
  cimentoAssentamento: (areia, bruto, valor) => [
    MEM.nota("Cimento da argamassa de assentamento: 2 sacos por m³ de areia."),
    MEM.dado("Areia fina do assentamento", areia, "m³", "passo anterior"),
    MEM.conta("Sacos, com 10% de perda", "areia × 2 × 1,10", [["areia", areia]], bruto, "sacos"),
    MEM.teto(bruto, valor, "sacos de 50 kg", "Arredonda para cima (saco fechado)"),
  ],
  trelicaVergas: (onde, vao, bruto, valor) => [
    MEM.nota("Treliça das vergas e contravergas. O VICKE soma sozinho: cada porta interna de 0,80 m leva uma verga, cada janela leva verga e contraverga, cada porta externa leva uma verga. Metade desse total é o vão equivalente usado aqui."),
    MEM.dado(`Vão equivalente de portas e janelas ${onde}`, vao, "m", "calculado das esquadrias e dos cômodos"),
    MEM.conta("Barras de 12 m, com 10% de perda", "vão × 2 ÷ 12 × 1,10", [["vão", vao]], bruto, "barras"),
    MEM.teto(bruto, valor, "barras", "Arredonda para cima (barra inteira)"),
  ],
  tabuaColuna: (onde, larguraCm, colunas, bruto, valor) => [
    MEM.nota(`Fôrma das colunas ${onde}: duas tábuas por face, 2,80 m de altura, em peças de 3 m. A tábua é sempre um degrau mais larga que a coluna, para o concreto não vazar pelas laterais.`),
    MEM.dado(`Colunas de ${larguraCm} cm`, colunas, "colunas", "bloco Engenharia — Pilares e vigas"),
    MEM.conta("Tábuas de 3 m, com 10% de perda", "colunas × 2,80 × 2 ÷ 3 × 1,10", [["colunas", colunas]], bruto, "tábuas"),
    MEM.teto(bruto, valor, "tábuas de 3 m", "Arredonda para cima (tábua inteira)"),
  ],
  sarrafoColunas: (c15, c20, c30, bruto, valor) => [
    MEM.nota("Gravatas que apertam a fôrma das colunas, uma a cada 50 cm de altura, nas duas faces. Cada gravata acompanha a largura da coluna (0,20 / 0,25 / 0,35 m)."),
    MEM.dado("Colunas de 15 cm", c15, "colunas", "bloco Engenharia — Pilares e vigas"),
    MEM.dado("Colunas de 20 cm", c20, "colunas", "bloco Engenharia — Pilares e vigas"),
    MEM.dado("Colunas de 30 cm", c30, "colunas", "bloco Engenharia — Pilares e vigas"),
    MEM.conta("Sarrafos de 3 m, com 10% de perda", "(c15 × 2,80 × 2 ÷ 0,50 × 0,20 + c20 × 2,80 × 2 ÷ 0,50 × 0,25 + c30 × 2,80 × 2 ÷ 0,50 × 0,35) × 1,10 ÷ 3",
      [["c15", c15], ["c20", c20], ["c30", c30]], bruto, "sarrafos"),
    MEM.teto(bruto, valor, "sarrafos de 3 m", "Arredonda para cima (sarrafo inteiro)"),
  ],
  madeirite: (area, bruto, valor) => [
    MEM.nota("Coluna com mais de 25 cm sai de fôrma de madeirite, não de tábua. Cada chapa de 2,10 × 1,10 m dá 2,42 m² de fôrma."),
    MEM.dado("Área de fôrma das colunas acima de 25 cm", area, "m²", "bloco Engenharia — Pilares e vigas"),
    MEM.conta("Chapas, com 10% de perda", "área ÷ 2,42 × 1,10", [["área", area]], bruto, "chapas"),
    MEM.teto(bruto, valor, "chapas", "Arredonda para cima (chapa inteira)"),
  ],
  areiaConcreto: (rotulo, concreto, bruto, valor) => [
    MEM.nota("Traço do concreto: 60% de areia por volume."),
    MEM.dado(rotulo, concreto, "m³", "bloco de engenharia"),
    MEM.conta("Areia, com 10% de perda", "concreto × 0,60 × 1,10", [["concreto", concreto]], bruto, "m³"),
    MEM.teto(bruto, valor, "m³", "Arredonda para cima (a areia vem em m³ inteiro)"),
  ],
  pedraConcreto: (rotulo, concreto, bruto, valor) => [
    MEM.dado(rotulo, concreto, "m³", "bloco de engenharia"),
    MEM.conta("Pedra, com 10% de perda", "concreto × 1,10", [["concreto", concreto]], bruto, "m³"),
    MEM.teto(bruto, valor, "m³", "Arredonda para cima (a pedra vem em m³ inteiro)"),
  ],
  cimentoDaPedra: (pedra, bruto, valor) => [
    MEM.dado("Pedra do concreto", pedra, "m³", "passo anterior"),
    MEM.conta("Cimento: 6 sacos por m³ de pedra, com 10% de perda", "pedra × 6 × 1,10", [["pedra", pedra]], bruto, "sacos"),
    MEM.teto(bruto, valor, "sacos de 50 kg", "Arredonda para cima (saco fechado)"),
  ],
  arameDoPeso: (peso, bruto, valor) => [
    MEM.nota("Arame para amarrar as armaduras: 0,06 kg por quilo de ferro comprado (barras inteiras × peso da barra)."),
    MEM.conta("Peso do ferro", "soma das bitolas", [], peso, "kg"),
    MEM.conta("Arame, com 10% de perda", "peso × 0,06 × 1,10", [["peso", peso]], bruto, "kg"),
    MEM.teto(bruto, valor, "kg"),
  ],
  pregoDoArame: (arame, bruto, valor) => [
    MEM.nota("Pregos da fôrma, proporcionais ao arame."),
    MEM.dado("Arame recozido", arame, "kg", "passo anterior"),
    MEM.conta("Pregos", "arame × 0,55", [["arame", arame]], bruto, "kg"),
    MEM.teto(bruto, valor, "kg"),
  ],
};
// Memória padrão de uma bitola: metros por elemento → total → barras de 12 m
// com 10% de perda → arredonda. `partes` são pares [elemento, metros].
function memoriaBitola(k, partes, barras) {
  const usadas = partes.filter(([, v]) => numOrZero(v) > 0);
  const total = usadas.reduce((acc, [, v]) => acc + numOrZero(v), 0);
  const bruto = total / BARRA_FERRO_MTS * PERDA;
  return [
    MEM.nota(`Metros de ${LABEL_BARRA[k]} lançados no projeto, elemento por elemento.`),
    ...usadas.map(([nome, v]) => MEM.dado(`Metros em ${nome}`, v, "m", "bloco de engenharia")),
    MEM.conta("Metros da bitola na etapa", usadas.map(([nome]) => nome).join(" + "), usadas, total, "m"),
    MEM.conta("Barras de 12 m, com 10% de perda", "metros ÷ 12 × 1,10", [["metros", total]], bruto, "barras"),
    MEM.teto(bruto, barras[k], "barras", "Arredonda para cima (barra inteira)"),
  ];
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
    emitir(out, { ...base, item, unidade: "Verba", qtd: 1, preco: digitado, memoria: [
      MEM.nota(`${item}: serviço sem taxa de referência no escritório — entra como verba fechada, com o valor que você digitou no bloco Prestadores.`),
      MEM.conta("Valor da verba", "valor digitado", [], digitado, "R$"),
      MEM.dado("Quantidade no orçamento", 1, "verba", "serviço fechado"),
    ] });
    return;
  }
  const taxa = taxaPrestador(chave, data);
  if (taxa && taxa.valor > 0 && cp.areaConstruida > 0) {
    emitir(out, { ...base, item, unidade: "m2", qtd: cp.areaConstruida, preco: taxa.valor, confianca: taxa.confianca, memoria: [
      MEM.nota(`${item}: nada digitado no bloco Prestadores, então entra a taxa de referência do escritório, medida por m² de área construída.`),
      MEM.dado("Taxa de referência", taxa.valor, "R$/m²", "tabela de prestadores"),
      MEM.dado("Quantidade no orçamento", cp.areaConstruida, "m²", "bloco Geral"),
    ] });
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
  emitir(out, { ...base, item: "Pedreiros Casa", unidade: "m2", qtd: cp.areaConstruida, preco: valorPedreiros / cp.areaConstruida, memoria: memoriaPrestador("equipePedreiros", "Área construída da casa (m²)", cp.areaConstruida, valorPedreiros, cp, data) });

  const valorEletricista = valorPrestador("eletricista", cp, data);
  emitir(out, { ...base, item: "Eletricista", unidade: "m2", qtd: cp.areaConstruida, preco: valorEletricista / cp.areaConstruida, memoria: memoriaPrestador("eletricista", "Área construída da casa (m²)", cp.areaConstruida, valorEletricista, cp, data) });

  const valorEncanador = valorPrestador("encanador", cp, data);
  emitir(out, { ...base, item: "Encanador", unidade: "m2", qtd: cp.areaConstruida, preco: valorEncanador / cp.areaConstruida, memoria: memoriaPrestador("encanador", "Área construída da casa (m²)", cp.areaConstruida, valorEncanador, cp, data) });

  const valorPintor = valorPrestador("pintor", cp, data);
  emitir(out, { ...base, item: "Pintor", unidade: "m2", qtd: cp.areaConstruida, preco: valorPintor / cp.areaConstruida, memoria: memoriaPrestador("pintor", "Área construída da casa (m²)", cp.areaConstruida, valorPintor, cp, data) });

  // Carpinteiro: base é a área TOTAL de cobertura (CALC_AREA_COBERTURA_TOTAL
  // no .bas), não a área construída — ainda 0 aqui porque cobertura() é um
  // módulo futuro (passo 4 da spec, §10). Sem taxa padrão no .frm.
  const valorCarpinteiro = numOrZero(cp.prestadores && cp.prestadores.carpinteiro) || valorPadraoPrestador("carpinteiro", cp, data);
  if (cp.areaCoberturaTotal > 0) emitir(out, { ...base, item: "Carpinteiro", unidade: "m2", qtd: cp.areaCoberturaTotal, preco: valorCarpinteiro / cp.areaCoberturaTotal, memoria: memoriaPrestador("carpinteiro", "Área inclinada total dos telhados (m²)", cp.areaCoberturaTotal, valorCarpinteiro, cp, data) });

  // Sem taxa padrão no .frm — só o valor digitado.
  emitirPrestadorVerba(out, base, "Impermeabilizador", "impermeabilizador", cp, data);

  // No VBA, esta linha testava `CCALC_PRESTADORES_INSTALADOR_AR` (com "C"
  // duplicado) — uma variável que nunca era atribuída, então o Instalador AR
  // nunca era emitido, por mais que o usuário digitasse o valor. Corrigido
  // em set/2026: entra como verba, igual aos outros prestadores sem taxa
  // padrão. A infra dos pontos de ar (eletroduto, cabo, dreno, tomada) já
  // vem pelo ponto elétrico de ar condicionado, na etapa de Elétrica.
  emitirPrestadorVerba(out, base, "Instalador AR", "instaladorAr", cp, data);

  // Sem taxa padrão no .frm — só o valor digitado.
  emitirPrestadorVerba(out, base, "Marceneiro Portas Internas", "marceneiroPortas", cp, data);

  const valorGestao = (() => {
    const override = numOrZero(cp.prestadores && cp.prestadores.gestaoObra);
    return override !== 0 ? override : taxaGestaoObra(cp.areaConstruida) * cp.areaConstruida;
  })();
  emitir(out, { ...base, item: "Gestão Obra", unidade: "m2", qtd: cp.areaConstruida, preco: valorGestao / cp.areaConstruida, memoria: [
    MEM.nota("Gestão de obra: o escritório cobra por m² numa escada regressiva — quanto maior a obra, menor o valor por metro. Valor digitado no bloco Prestadores vence a escada."),
    MEM.dado("Área construída da casa", cp.areaConstruida, "m²", "bloco Geral"),
    MEM.conta("Taxa da escada para esta área", "tabela de gestão de obra", [], taxaGestaoObra(cp.areaConstruida), "R$/m²"),
    MEM.conta("Valor total da gestão", "taxa × área", [["taxa", taxaGestaoObra(cp.areaConstruida)], ["área", cp.areaConstruida]], valorGestao, "R$"),
    MEM.conta("Preço unitário na tabela", "valor ÷ área", [["valor", valorGestao], ["área", cp.areaConstruida]], cp.areaConstruida > 0 ? valorGestao / cp.areaConstruida : 0, "R$/m²"),
    MEM.dado("Quantidade no orçamento", cp.areaConstruida, "m²", "a própria área construída"),
  ] });

  // [VBA] emitia sempre; aqui só quando a obra tem piscina (campo "Piscina" do bloco Geral).
  if (cp.temPiscina !== false) {
    const valorInstaladorEquipPiscina = valorPrestador("instaladorEquipPiscina", cp, data);
    emitir(out, { ...base, item: "Instalador Equip. Piscina", unidade: "Unidades", qtd: 1, preco: valorInstaladorEquipPiscina, memoria: [
    MEM.nota("Instalação dos equipamentos da piscina (bomba, filtro, aquecimento): valor fechado, uma vez por obra."),
    MEM.conta("Valor do serviço", numOrZero(cp.prestadores && cp.prestadores.instaladorEquipPiscina) !== 0 ? "valor digitado" : "sugestão do escritório", [], valorInstaladorEquipPiscina, "R$"),
    MEM.dado("Quantidade no orçamento", 1, "verba", "serviço fechado"),
  ] });
  }

  const valorPedreirosPiscina = valorPrestador("pedreirosPiscina", cp, data);
  emitir(out, { ...base, item: "Pedreiros Piscina", unidade: "m2", qtd: cp.areaConstruidaPiscina, preco: valorPedreirosPiscina / cp.areaConstruidaPiscina, memoria: memoriaPrestador("pedreirosPiscina", "Área construída da piscina (m²)", cp.areaConstruidaPiscina, valorPedreirosPiscina, cp, data) });

  const valorMuroArrimo = valorPrestador("muroArrimo", cp, data);
  const baseMuroArrimo = cp.alturaArrimo * cp.comprimentoArrimo;
  emitir(out, { ...base, item: "Pedreiros Muro Arrimo", unidade: "m2", qtd: baseMuroArrimo, preco: valorMuroArrimo / baseMuroArrimo, memoria: memoriaPrestador("muroArrimo", "Área do muro de arrimo (altura × comprimento, m²)", baseMuroArrimo, valorMuroArrimo, cp, data) });

  const valorMuroDivisa = valorPrestador("muroDivisa", cp, data);
  const baseMuroDivisa = cp.comprimentoMuroDivisa * cp.alturaMuroDivisa;
  emitir(out, { ...base, item: "Pedreiros Muro Divisa", unidade: "m2", qtd: baseMuroDivisa, preco: valorMuroDivisa / baseMuroDivisa, memoria: memoriaPrestador("muroDivisa", "Área do muro de divisa (comprimento × altura, m²)", baseMuroDivisa, valorMuroDivisa, cp, data) });

  const valorPavimentacaoExterna = valorPrestador("pavimentacaoExterna", cp, data);
  emitir(out, { ...base, item: "Pedreiros Pavim. Externa", unidade: "m2", qtd: cp.pavimentacaoExterna, preco: valorPavimentacaoExterna / cp.pavimentacaoExterna, memoria: memoriaPrestador("pavimentacaoExterna", "Área de pavimentação externa (m²)", cp.pavimentacaoExterna, valorPavimentacaoExterna, cp, data) });

  const valorTerraplanagem = valorPrestador("terraplanagem", cp, data);
  emitir(out, { ...base, item: "Terraplanagem", unidade: "Unidades", qtd: 1, preco: valorTerraplanagem, memoria: [
    MEM.nota("Terraplanagem: valor fechado para a obra, não medido por m²."),
    MEM.conta("Valor do serviço", numOrZero(cp.prestadores && cp.prestadores.terraplanagem) !== 0 ? "valor digitado" : "sugestão do escritório", [], valorTerraplanagem, "R$"),
    MEM.dado("Quantidade no orçamento", 1, "verba", "serviço fechado"),
  ] });

  const valorInstaladorAquecedores = valorPrestador("instaladorAquecedores", cp, data);
  emitir(out, { ...base, item: "Instalador Aquecedores", unidade: "Unidades", qtd: 1, preco: valorInstaladorAquecedores, memoria: [
    MEM.nota("Instalação dos aquecedores: valor fechado, uma vez por obra."),
    MEM.conta("Valor do serviço", numOrZero(cp.prestadores && cp.prestadores.instaladorAquecedores) !== 0 ? "valor digitado" : "sugestão do escritório", [], valorInstaladorAquecedores, "R$"),
    MEM.dado("Quantidade no orçamento", 1, "verba", "serviço fechado"),
  ] });

  // Sem taxa padrão no .frm — só o valor digitado.
  emitirPrestadorVerba(out, base, "Serralheiro", "serralheiro", cp, data);
}

// ═══════════════════════════════════════════════════════════════
// F_PAREDES_TERREO.bas — paredes e colunas do pavimento térreo
// ═══════════════════════════════════════════════════════════════
function paredesTerreo(cp, out) {
  const tijolos6FBruto = cp.m2Paredes20Terreo * 40 * PERDA;
  const tijolos6F = teto(tijolos6FBruto);
  const tijolos8FBruto = (cp.m2Paredes25Terreo * 40 + cp.m2Paredes15Terreo * 20) * PERDA;
  const tijolos8F = teto(tijolos8FBruto);
  // [VBA] aqui o *1.1 já está embutido em cada parcela — não há um *PERDA
  // extra por fora da soma, exatamente como no .bas.
  const areiaFinaAssentBruto = tijolos6F * 0.001638 * PERDA + tijolos8F * 0.002223 * PERDA;
  const areiaFinaAssent = teto(areiaFinaAssentBruto);
  const vedalitFinaAssentBruto = areiaFinaAssent / 25 * PERDA;
  const vedalitFinaAssent = teto(vedalitFinaAssentBruto);
  const cimentoFinaAssentBruto = areiaFinaAssent * 2 * PERDA;
  const cimentoFinaAssent = teto(cimentoFinaAssentBruto);
  const contravergaBruto = cp.vaoPortasJanelasTerreo * 2 / 12 * PERDA;
  const contraverga = teto(contravergaBruto);

  const tabuas15ColunBruto = cp.colunas15Terreo * 2.8 * 2 / 3 * PERDA;
  const tabuas15Colun = teto(tabuas15ColunBruto);
  const tabuas20ColunBruto = cp.colunas20Terreo * 2.8 * 2 / 3 * PERDA;
  const tabuas20Colun = teto(tabuas20ColunBruto);
  const tabuas30ColunBruto = cp.colunas30Terreo * 2.8 * 2 / 3 * PERDA;
  const tabuas30Colun = teto(tabuas30ColunBruto);
  const sarrafo5ColunBruto =
    ((cp.colunas15Terreo * 2.8 * 2 / 0.5 * 0.2) +
      (cp.colunas20Terreo * 2.8 * 2 / 0.5 * 0.25) +
      (cp.colunas30Terreo * 2.8 * 2 / 0.5 * 0.35)) * PERDA / 3;
  const sarrafo5Colun = teto(sarrafo5ColunBruto);
  const maderitesColunBruto = cp.areaFormaColunaMaior25cmTerreo / 2.42 * PERDA;
  const maderitesColun = teto(maderitesColunBruto);
  const areiaGrossaColunasBruto = cp.concrColunaTerreo * 0.6 * PERDA;
  const areiaGrossaColunas = teto(areiaGrossaColunasBruto);
  const pedraColunasBruto = cp.concrColunaTerreo * PERDA;
  const pedraColunas = teto(pedraColunasBruto);
  const cimentoColunasBruto = pedraColunas * 6 * PERDA;
  const cimentoColunas = teto(cimentoColunasBruto);

  const ca60_4mm = teto(cp.ca60_4mmColunaTerreo / BARRA_FERRO_MTS * PERDA);
  const ca50_5mm = teto(cp.ca50_5mmColunaTerreo / BARRA_FERRO_MTS * PERDA);
  const ca50_6mm = teto(cp.ca50_6mmColunaTerreo / BARRA_FERRO_MTS * PERDA);
  const ca50_8mm = teto(cp.ca50_8mmColunaTerreo / BARRA_FERRO_MTS * PERDA);
  const ca50_10mm = teto(cp.ca50_10mmColunaTerreo / BARRA_FERRO_MTS * PERDA);
  const ca50_12mm = teto(cp.ca50_12mmColunaTerreo / BARRA_FERRO_MTS * PERDA);
  const ca50_16mm = teto(cp.ca50_16mmColunaTerreo / BARRA_FERRO_MTS * PERDA);
  const ca60_5mm = teto(cp.ca60_5mmColunaTerreo / BARRA_FERRO_MTS * PERDA);

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

  const arameColunasBruto = pesoFerroColunas * 0.06 * PERDA;
  const arameColunas = teto(arameColunasBruto);
  // [VBA] sem *PERDA aqui — só o arame leva perda, o cálculo de pregos a
  // partir do arame não, confirmado contra o original.
  const pregos18x27Bruto = arameColunas * 0.55;
  const pregos18x27 = teto(pregos18x27Bruto);

  const base = { ordem: ORD.paredesTerreo, tipo: "Bruto", etapa: "Supra estrutura e paredes" };
  const subParedes = "Paredes Pav. Térreo";
  const subSupra = "Supra estrutura Pav. Térreo";

  // Rótulos abaixo (incluindo o espaço duplo em "Bloco  6 Furos" e as
  // bitolas "20cm"/"25cm" nas tábuas que na verdade vêm de
  // CP_COLUNAS_15/20) são copiados ao pé da letra do .bas — não são erro de
  // digitação meu, são do sistema original, preservados por instrução.
  emitir(out, { ...base, subEtapa: subParedes, item: "Cerâmicas - Tijolo - Bloco  6 Furos", unidade: "Unidade", qtd: tijolos6F, memoria: MEMB.tijolo6("no térreo", cp.m2Paredes20Terreo, tijolos6FBruto, tijolos6F) });
  emitir(out, { ...base, subEtapa: subParedes, item: "Cerâmicas - Tijolo - Bloco 8 Furos", unidade: "Unidade", qtd: tijolos8F, memoria: MEMB.tijolo8("no térreo", cp.m2Paredes25Terreo, cp.m2Paredes15Terreo, tijolos8FBruto, tijolos8F) });
  emitir(out, { ...base, subEtapa: subParedes, item: "Areia Fina", unidade: "m3", qtd: areiaFinaAssent, memoria: MEMB.areiaAssentamento(tijolos6F, tijolos8F, areiaFinaAssentBruto, areiaFinaAssent) });
  emitir(out, { ...base, subEtapa: subParedes, item: "Impermeabilizantes - Vedalit 18L", unidade: "Baldes 18L", qtd: vedalitFinaAssent, memoria: MEMB.vedalitAssentamento(areiaFinaAssent, vedalitFinaAssentBruto, vedalitFinaAssent) });
  emitir(out, { ...base, subEtapa: subParedes, item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimentoFinaAssent, memoria: MEMB.cimentoAssentamento(areiaFinaAssent, cimentoFinaAssentBruto, cimentoFinaAssent) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Treliça H8 Barras 12mts", unidade: "Barras 12mts", qtd: contraverga, memoria: MEMB.trelicaVergas("do térreo", cp.vaoPortasJanelasTerreo, contravergaBruto, contraverga) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Madeira Caixaria - Tábuas de 20cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas15Colun, memoria: MEMB.tabuaColuna("do térreo", 15, cp.colunas15Terreo, tabuas15ColunBruto, tabuas15Colun) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Madeira Caixaria - Tábuas de 25cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas20Colun, memoria: MEMB.tabuaColuna("do térreo", 20, cp.colunas20Terreo, tabuas20ColunBruto, tabuas20Colun) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Madeira Caixaria - Tábuas de 30cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas30Colun, memoria: MEMB.tabuaColuna("do térreo", 30, cp.colunas30Terreo, tabuas30ColunBruto, tabuas30Colun) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Madeira Caixaria - Sarrafos de 05cm x 3mts", unidade: "Barras 3 mts", qtd: sarrafo5Colun, memoria: MEMB.sarrafoColunas(cp.colunas15Terreo, cp.colunas20Terreo, cp.colunas30Terreo, sarrafo5ColunBruto, sarrafo5Colun) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Madeira Caixaria - Madeirite Plastif. Preto 2,10x1,10mts 18mm", unidade: "Unidade", qtd: maderitesColun, memoria: MEMB.madeirite(cp.areaFormaColunaMaior25cmTerreo, maderitesColunBruto, maderitesColun) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Areia Grossa", unidade: "m3", qtd: areiaGrossaColunas, memoria: MEMB.areiaConcreto("Concreto das colunas do térreo", cp.concrColunaTerreo, areiaGrossaColunasBruto, areiaGrossaColunas) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Pedra", unidade: "m3", qtd: pedraColunas, memoria: MEMB.pedraConcreto("Concreto das colunas do térreo", cp.concrColunaTerreo, pedraColunasBruto, pedraColunas) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimentoColunas, memoria: MEMB.cimentoDaPedra(pedraColunas, cimentoColunasBruto, cimentoColunas) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA60 4.2mm 12mts", unidade: "Barras 12mts", qtd: ca60_4mm, memoria: memoriaBitolaSimples("CA60_4MM", cp.ca60_4mmColunaTerreo, ca60_4mm, "nas colunas do térreo") });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 5.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_5mm, memoria: memoriaBitolaSimples("CA50_5MM", cp.ca50_5mmColunaTerreo, ca50_5mm, "nas colunas do térreo") });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 6.3mm 12mts", unidade: "Barras 12mts", qtd: ca50_6mm, memoria: memoriaBitolaSimples("CA50_6MM", cp.ca50_6mmColunaTerreo, ca50_6mm, "nas colunas do térreo") });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 8.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_8mm, memoria: memoriaBitolaSimples("CA50_8MM", cp.ca50_8mmColunaTerreo, ca50_8mm, "nas colunas do térreo") });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 10.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_10mm, memoria: memoriaBitolaSimples("CA50_10MM", cp.ca50_10mmColunaTerreo, ca50_10mm, "nas colunas do térreo") });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 12.5mm 12mts", unidade: "Barras 12mts", qtd: ca50_12mm, memoria: memoriaBitolaSimples("CA50_12MM", cp.ca50_12mmColunaTerreo, ca50_12mm, "nas colunas do térreo") });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 16mm 12mts", unidade: "Barras 12mts", qtd: ca50_16mm, memoria: memoriaBitolaSimples("CA50_16MM", cp.ca50_16mmColunaTerreo, ca50_16mm, "nas colunas do térreo") });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA60 5.0mm 12mts", unidade: "Barras 12mts", qtd: ca60_5mm, memoria: memoriaBitolaSimples("CA60_5MM", cp.ca60_5mmColunaTerreo, ca60_5mm, "nas colunas do térreo") });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Arame Recozido", unidade: "KG", qtd: arameColunas, memoria: MEMB.arameDoPeso(pesoFerroColunas, arameColunasBruto, arameColunas) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Pregos 18x27", unidade: "KG", qtd: pregos18x27, memoria: MEMB.pregoDoArame(arameColunas, pregos18x27Bruto, pregos18x27) });
}

// ═══════════════════════════════════════════════════════════════
// M_PINTURA.bas — pintura (base + tintas)
// ═══════════════════════════════════════════════════════════════
function pintura(cp, out) {
  const paredeInterna = ((cp.m2ParedesInternas - cp.revestimentoInterno) * 2 + cp.m2ParedesExternas) * PERDA;
  const paredeExterna = cp.m2ParedesExternas * PERDA;
  const paredeTotal = paredeInterna + paredeExterna;

  const seladorBruto = (0.2 * paredeTotal) / 10 * PERDA;
  const selador = teto(seladorBruto);
  const massaCorridaBruto = ((paredeInterna / 3) * 2.5) / 15 * PERDA;
  const massaCorrida = teto(massaCorridaBruto);
  const fundoPreparadorBruto = (0.2 * paredeTotal) / 8 * PERDA;
  const fundoPreparador = teto(fundoPreparadorBruto);
  const tintasBruto = 0.15 * paredeTotal / 9 * PERDA;
  const tintas = teto(tintasBruto);

  const passosArea = [
    MEM.nota("Área a pintar: as paredes internas contam duas faces e descontam o que é revestido de cerâmica; as externas entram uma vez na conta das internas (herdado da planilha) e mais uma vez como fachada."),
    MEM.dado("Paredes internas", cp.m2ParedesInternas, "m²", "calculado dos blocos de parede"),
    MEM.dado("Revestimento de parede (cerâmica/porcelanato)", cp.revestimentoInterno, "m²", "bloco Pisos e revestimentos"),
    MEM.dado("Paredes externas (fachada)", cp.m2ParedesExternas, "m²", "calculado dos blocos de parede"),
    MEM.conta("Área interna, com 10% de perda", "((internas − revestimento) × 2 + externas) × 1,10", [["internas", cp.m2ParedesInternas], ["revestimento", cp.revestimentoInterno], ["externas", cp.m2ParedesExternas]], paredeInterna, "m²"),
    MEM.conta("Área externa, com 10% de perda", "externas × 1,10", [["externas", cp.m2ParedesExternas]], paredeExterna, "m²"),
    MEM.conta("Área total a pintar", "interna + externa", [["interna", paredeInterna], ["externa", paredeExterna]], paredeTotal, "m²"),
  ];
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
  emitir(out, { ...base, subEtapa: "Base", item: "Tintas - Fundo Preparador 18L", unidade: "Unidades", qtd: fundoPreparador, memoria: [
    ...passosArea,
    MEM.nota("Fundo preparador: 0,2 litro por m², lata de 18 litros que rende 8 demãos-área."),
    MEM.conta("Latas, com 10% de perda", "área × 0,20 ÷ 8 × 1,10", [["área", paredeTotal]], fundoPreparadorBruto, "latas"),
    MEM.teto(fundoPreparadorBruto, fundoPreparador, "latas de 18 L", "Arredonda para cima (lata fechada)"),
  ] });
  emitir(out, { ...base, subEtapa: "Base", item: "Tintas - Selador 18L", unidade: "Unidades", qtd: selador, memoria: [
    ...passosArea,
    MEM.nota("Selador: 0,2 litro por m², lata de 18 litros com rendimento de 10."),
    MEM.conta("Latas, com 10% de perda", "área × 0,20 ÷ 10 × 1,10", [["área", paredeTotal]], seladorBruto, "latas"),
    MEM.teto(seladorBruto, selador, "latas de 18 L", "Arredonda para cima (lata fechada)"),
  ] });
  emitir(out, { ...base, subEtapa: "Base", item: "Tintas - Massa Corrida 25KG", unidade: "Unidades", qtd: massaCorrida, memoria: [
    ...passosArea,
    MEM.nota("Massa corrida só nas áreas internas, e só em um terço delas (a planilha considera que nem toda parede leva massa): 2,5 kg por m², saco de 25 kg com rendimento 15."),
    MEM.conta("Sacos, com 10% de perda", "interna ÷ 3 × 2,50 ÷ 15 × 1,10", [["interna", paredeInterna]], massaCorridaBruto, "sacos"),
    MEM.teto(massaCorridaBruto, massaCorrida, "sacos de 25 kg", "Arredonda para cima (saco fechado)"),
  ] });
  emitir(out, { ...base, subEtapa: "Tintas", item: "Tintas - Tintas 18L", unidade: "Unidades", qtd: tintas, memoria: [
    ...passosArea,
    MEM.nota("Tinta: 0,15 litro por m² de parede, lata de 18 litros com rendimento 9."),
    MEM.conta("Latas, com 10% de perda", "área × 0,15 ÷ 9 × 1,10", [["área", paredeTotal]], tintasBruto, "latas"),
    MEM.teto(tintasBruto, tintas, "latas de 18 L", "Arredonda para cima (lata fechada)"),
  ] });
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
  const memPoste = MEM_CANTEIRO("Padrão de entrada de energia da obra: um por obra. Trifásico C3 é o padrão adotado pelo escritório; se a obra for monofásica, troque o item.");
  const memFerramenta = MEM_CANTEIRO();
  emitir(out, { ...baseInst, subEtapa: "Bruto - Elétrica", item: "Elétrica - Poste Padrão - Trifásica C3", unidade: "Unidades", qtd: 1, memoria: memPoste });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Ferramentas - Serra Circular Dewalt DWE560-B2", unidade: "Unidades", qtd: 1, memoria: memFerramenta });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Ferramentas - Furadeira Dewalt 1/2 DWD502-BR 710W", unidade: "Unidades", qtd: 1, memoria: memFerramenta });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Ferramentas - Mangueira de Nível", unidade: "Mts", qtd: 25, memoria: memFerramenta });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Ferramentas - Lapis", unidade: "Rolos", qtd: 4, memoria: memFerramenta });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Disco Serra Circular", unidade: "Unidades", qtd: 2, memoria: memFerramenta });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Metal - Hidráulica - Torneira Jardim", unidade: "Unidades", qtd: 1, memoria: memFerramenta });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Ferramentas - Pá de bico com cabo", unidade: "Unidades", qtd: 4, memoria: memFerramenta });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Ferramentas - Cavadeira", unidade: "Unidades", qtd: 4, memoria: memFerramenta });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Ferramentas - Mangueira de Jardim", unidade: "Mts", qtd: 30, memoria: memFerramenta });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Ferramentas - Engate Rápido Mangueira Jardim", unidade: "Unidades", qtd: 1, memoria: memFerramenta });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Ferramentas - Torquesa Ferragem", unidade: "Unidades", qtd: 5, memoria: memFerramenta });
  emitir(out, { ...baseInst, subEtapa: "Marcação Obra", item: "Ferramentas - Luva Mucambo", unidade: "Unidades", qtd: 10, memoria: memFerramenta });
  emitir(out, { ...baseFund, subEtapa: "Marcação Obra", item: "Ferramentas - Linha de pedreiro", unidade: "Unidades", qtd: 2, memoria: memFerramenta });
  emitir(out, { ...baseFund, subEtapa: "Marcação Obra", item: "Ferramentas - Carrinho Pedreiro", unidade: "Unidades", qtd: 4, memoria: memFerramenta });

  const gab = cp.gabarito;
  const tabua10Bruto = gab / 3 * 1.2;
  const tabua10 = teto(tabua10Bruto);
  const sarrafo5Bruto = (gab * 1.2 / 1.3 * 0.6 / 3) + 20;
  const sarrafo5 = teto(sarrafo5Bruto);
  const prego18x27Bruto = 0.05 * tabua10 / 2;
  const prego18x27 = teto(prego18x27Bruto);
  const prego17x21 = prego18x27;
  const memGabarito = MEM.dado("Gabarito da obra (perímetro do cavalete de marcação)", gab, "m", "bloco Geral");

  emitir(out, { ...baseFund, subEtapa: "Marcação Obra", item: "Madeira Caixaria - Tábuas de 10cm x 3mts", unidade: "Barras 3mts", qtd: tabua10, memoria: [
    MEM.nota("O gabarito é o cavalete de tábuas que cerca a obra e guarda os eixos das paredes até a fundação sair do chão."),
    memGabarito,
    MEM.conta("Tábuas de 3 m, com 20% de emendas e recortes", "gabarito ÷ 3 × 1,20", [["gabarito", gab]], tabua10Bruto, "tábuas"),
    MEM.teto(tabua10Bruto, tabua10, "tábuas de 3 m", "Arredonda para cima (tábua inteira)"),
  ] });
  emitir(out, { ...baseFund, subEtapa: "Marcação Obra", item: "Madeira Caixaria - Sarrafos de 05cm x 3mts", unidade: "Barras 3mts", qtd: sarrafo5, memoria: [
    MEM.nota("Sarrafos: as estacas verticais que seguram as tábuas do gabarito, cravadas a cada 1,30 m, mais 20 de folga para escoras e travamento dos cantos."),
    memGabarito,
    MEM.conta("Sarrafos do gabarito", "gabarito × 1,20 ÷ 1,30 × 0,60 ÷ 3 + 20", [["gabarito", gab]], sarrafo5Bruto, "sarrafos"),
    MEM.teto(sarrafo5Bruto, sarrafo5, "sarrafos de 3 m", "Arredonda para cima (sarrafo inteiro)"),
  ] });
  emitir(out, { ...baseFund, subEtapa: "Marcação Obra", item: "Aço - Pregos 18x27", unidade: "KG", qtd: prego18x27, memoria: [
    MEM.nota("Pregos do gabarito: 0,05 kg por tábua pregada, metade em cada bitola (18x27 e 17x21)."),
    MEM.dado("Tábuas de 10 cm do gabarito", tabua10, "tábuas", "passo anterior"),
    MEM.conta("Pregos 18x27", "tábuas × 0,05 ÷ 2", [["tábuas", tabua10]], prego18x27Bruto, "kg"),
    MEM.teto(prego18x27Bruto, prego18x27, "kg", "Arredonda para cima (embalagem fechada)"),
  ] });
  emitir(out, { ...baseFund, subEtapa: "Marcação Obra", item: "Aço - Pregos 17x21", unidade: "KG", qtd: prego17x21, memoria: [
    MEM.nota("Mesma conta dos pregos 18x27 — a outra metade do consumo do gabarito."),
    MEM.dado("Tábuas de 10 cm do gabarito", tabua10, "tábuas", "passo anterior"),
    MEM.conta("Pregos 17x21", "tábuas × 0,05 ÷ 2", [["tábuas", tabua10]], prego18x27Bruto, "kg"),
    MEM.teto(prego18x27Bruto, prego17x21, "kg", "Arredonda para cima (embalagem fechada)"),
  ] });
}

// ═══════════════════════════════════════════════════════════════
// C_FUNDACAO.bas
// ═══════════════════════════════════════════════════════════════
function fundacao(cp, out) {
  const f = cp.fundacao;
  const perim = cp.perimetroParedesTerreo;

  const tabuas30Bruto = ((perim * 2 / 3) + perim * 2 / 3 * 0.45 / 3) * PERDA;
  const tabuas30 = teto(tabuas30Bruto);
  const sarrafo5Bruto = ((perim * 2 / 0.7 * 0.45) + (perim / 0.75 * 0.3)) / 3 * PERDA;
  const sarrafo5 = teto(sarrafo5Bruto);
  // [VBA] fator 1.15 (não 1.1) — perda de perfuração é diferente da perda de material
  const perfuracaoEstacas = f.qtdEstacas * f.profEstacas * 1.15;

  const soma = somarFerro(f.ferro.estacas, f.ferro.sapatas, f.ferro.arranques, f.ferro.baldrames);
  const barras = barrasPorBitola(soma);
  const peso = pesoTotalFerro(barras);
  const concretoBruto = somaN(f.concreto.estacas, f.concreto.sapatas, f.concreto.arranques, f.concreto.baldrames) * PERDA;
  const concreto = teto(concretoBruto);
  const discoFerroBruto = peso * 0.01;
  const discoFerro = teto(discoFerroBruto);
  const arameBruto = peso * 0.06;
  const arame = teto(arameBruto);
  const pregoBruto = 0.55 * arame;
  const prego = teto(pregoBruto);
  const vedatopBruto = (((perim * 2 * 0.3) + (perim * 0.15)) * 3 * PERDA) / 18;
  const vedatop = teto(vedatopBruto);

  const memPerim = MEM.dado("Perímetro das paredes do térreo", perim, "m", "bloco Pav. Térreo");
  // Só os elementos com volume lançado entram na memória — listar "sapatas 0"
  // em obra sem sapata só atrapalha a conferência.
  const partesConcreto = [["estacas", f.concreto.estacas], ["sapatas", f.concreto.sapatas], ["arranques", f.concreto.arranques], ["baldrames", f.concreto.baldrames]].filter(([, v]) => numOrZero(v) > 0);
  const memPeso = [
    MEM.nota("O consumo de disco, arame e prego sai do peso do ferro já comprado (barras × peso por barra), não do comprimento."),
    ...Object.keys(PESOS_FERRO).filter((k) => numOrZero(barras[k]) > 0).map((k) => MEM.dado(`${LABEL_BARRA[k]}: ${numMem(barras[k])} barras × ${numMem(PESOS_FERRO[k])} kg`, numOrZero(barras[k]) * PESOS_FERRO[k], "kg", "passo das barras")),
    MEM.conta("Peso total do ferro da fundação", "soma das bitolas", [], peso, "kg"),
  ];

  const base = { ordem: ORD.fundacao, tipo: "Bruto", etapa: "Fundação", subEtapa: "Brocas e baldrames" };
  emitBarras(out, base, barras, (k) => memoriaBitola(k, [["estacas", f.ferro.estacas[k]], ["sapatas", f.ferro.sapatas[k]], ["arranques", f.ferro.arranques[k]], ["baldrames", f.ferro.baldrames[k]]], barras));
  emitir(out, { ...base, item: "Disco Ferro", unidade: "Unidades", qtd: discoFerro, memoria: [
    ...memPeso,
    MEM.conta("Discos de corte", "peso × 0,01", [["peso", peso]], discoFerroBruto, "discos"),
    MEM.teto(discoFerroBruto, discoFerro, "discos"),
  ] });
  emitir(out, { ...base, item: "Aço - Arame Recozido", unidade: "KG", qtd: arame, memoria: [
    ...memPeso,
    MEM.conta("Arame para amarrar as armaduras", "peso × 0,06", [["peso", peso]], arameBruto, "kg"),
    MEM.teto(arameBruto, arame, "kg"),
  ] });
  emitir(out, { ...base, item: "Aço - Pregos 18x27", unidade: "KG", qtd: prego, memoria: [
    MEM.nota("Pregos da caixaria dos baldrames, proporcionais ao arame já calculado."),
    MEM.dado("Arame recozido da fundação", arame, "kg", "passo anterior"),
    MEM.conta("Pregos", "arame × 0,55", [["arame", arame]], pregoBruto, "kg"),
    MEM.teto(pregoBruto, prego, "kg"),
  ] });
  emitir(out, { ...base, item: "Maquinário - Perfuração", unidade: "Mts", qtd: perfuracaoEstacas, memoria: [
    MEM.nota("Metros perfurados que a empresa de brocas cobra. A folga aqui é de 15% (e não os 10% de material): conta com o refugo do trado e o retrabalho de estaca que desmorona."),
    MEM.dado("Quantidade de estacas (brocas)", f.qtdEstacas, "estacas", "bloco Engenharia — Fundação"),
    MEM.dado("Profundidade de cada estaca", f.profEstacas, "m", "bloco Engenharia — Fundação"),
    MEM.conta("Metros perfurados", "estacas × profundidade × 1,15", [["estacas", f.qtdEstacas], ["profundidade", f.profEstacas]], perfuracaoEstacas, "m"),
  ] });
  emitir(out, { ...base, item: "Madeira Caixaria - Tábuas de 30cm x 3mts", unidade: "Barras 3mts", qtd: tabuas30, memoria: [
    MEM.nota("Caixaria dos baldrames: duas laterais ao longo de todo o perímetro (perímetro × 2), em tábuas de 3 m, mais 45 cm de travessas a cada trecho."),
    memPerim,
    MEM.conta("Tábuas, com 10% de perda", "(perímetro × 2 ÷ 3 + perímetro × 2 ÷ 3 × 0,45 ÷ 3) × 1,10", [["perímetro", perim]], tabuas30Bruto, "tábuas"),
    MEM.teto(tabuas30Bruto, tabuas30, "tábuas de 3 m", "Arredonda para cima (tábua inteira)"),
  ] });
  emitir(out, { ...base, item: "Madeira Caixaria - Sarrafos de 05cm x 3mts", unidade: "Barras 3mts", qtd: sarrafo5, memoria: [
    MEM.nota("Sarrafos da caixaria: gravatas a cada 70 cm nas duas faces (0,45 m cada) e escoras a cada 75 cm (0,30 m cada)."),
    memPerim,
    MEM.conta("Sarrafos, com 10% de perda", "(perímetro × 2 ÷ 0,70 × 0,45 + perímetro ÷ 0,75 × 0,30) ÷ 3 × 1,10", [["perímetro", perim]], sarrafo5Bruto, "sarrafos"),
    MEM.teto(sarrafo5Bruto, sarrafo5, "sarrafos de 3 m", "Arredonda para cima (sarrafo inteiro)"),
  ] });
  emitir(out, { ...base, item: f.resistenciaConcreto || "Concreto", unidade: "m3", qtd: concreto, memoria: [
    MEM.nota(`Volume de concreto lançado no bloco Engenharia — Fundação, elemento por elemento. Resistência escolhida: ${f.resistenciaConcreto || "Concreto"}.`),
    ...partesConcreto.map(([nome, v]) => MEM.dado(nome[0].toUpperCase() + nome.slice(1), v, "m³", "bloco Engenharia — Fundação")),
    MEM.conta("Volume com 10% de perda", `(${partesConcreto.map(([nome]) => nome).join(" + ")}) × 1,10`, partesConcreto, concretoBruto, "m³"),
    MEM.teto(concretoBruto, concreto, "m³", "Arredonda para cima (a usina entrega em m³ inteiro)"),
  ] });
  emitir(out, { ...base, item: "Concreto - Bomba", unidade: "Unidades", qtd: 1, memoria: MEM_CANTEIRO("Uma bombeada de concreto por obra na fundação. Se a concretagem for feita em mais de um dia, aumente a quantidade no item.") });
  emitir(out, { ...base, subEtapa: "Impermeabilização", item: "Impermeabilizantes - Vedatop 18KG", unidade: "Baldes 18L", qtd: vedatop, memoria: [
    MEM.nota("Impermeabilização do baldrame: as duas faces (30 cm de altura cada) mais o topo (15 cm de largura), com 3 kg por m² e 10% de perda. Balde de 18 kg."),
    memPerim,
    MEM.conta("Baldes de 18 kg", "(perímetro × 2 × 0,30 + perímetro × 0,15) × 3 × 1,10 ÷ 18", [["perímetro", perim]], vedatopBruto, "baldes"),
    MEM.teto(vedatopBruto, vedatop, "baldes", "Arredonda para cima (balde fechado)"),
  ] });
}

// ═══════════════════════════════════════════════════════════════
// E_CONTRAPISO_INTERNO_TERREO.bas
// ═══════════════════════════════════════════════════════════════
function contrapisoInternoTerreo(cp, out) {
  const area = cp.areaTerreo;
  const areiaGrossaContrapBruto = area * 0.6 * 0.1 * PERDA;
  const areiaGrossaContrap = teto(areiaGrossaContrapBruto);
  const pedraContrapBruto = area * 0.1 * PERDA;
  const pedraContrap = teto(pedraContrapBruto);
  const cimentoContrapBruto = pedraContrap * 6 * PERDA;
  const cimentoContrap = teto(cimentoContrapBruto);
  const malhaPopBruto = area / (2.9 * 1.9 * PERDA);
  const malhaPop = teto(malhaPopBruto);
  const cimentoMassiamBruto = area * 0.05 * 0.25 * 1200 / 50 * PERDA;
  const cimentoMassiam = teto(cimentoMassiamBruto);
  const areiaGrossaMassiamBruto = area * 0.05 * 0.75 * PERDA;
  const areiaGrossaMassiam = teto(areiaGrossaMassiamBruto);
  const biancoMassiamBruto = area / 60 * PERDA;
  const biancoMassiam = teto(biancoMassiamBruto);

  const memArea = MEM.dado("Área do pavimento térreo", area, "m²", "bloco Pav. Térreo");
  const notaContrap = MEM.nota("Contrapiso do térreo: 10 cm de concreto magro sobre o solo compactado, traço com 60% de areia por volume de pedra.");
  const notaMassiam = MEM.nota("Massiamento: a camada fina de 5 cm de argamassa que nivela o contrapiso para receber o piso.");

  const base = { ordem: ORD.contrapisoInterno, tipo: "Bruto", etapa: "Contrapiso Interno" };
  emitir(out, { ...base, subEtapa: "Contrapiso Interno Pav. Térreo", item: "Locação Ferramentas -  Compactador", unidade: "Dias", qtd: 2, memoria: MEM_CANTEIRO("Dois dias de compactador alugado para apiloar o solo antes de concretar o contrapiso. Terreno mole ou obra grande pede mais dias — ajuste no item.") });
  emitir(out, { ...base, subEtapa: "Contrapiso Interno Pav. Térreo", item: "Areia Grossa", unidade: "m3", qtd: areiaGrossaContrap, memoria: [
    notaContrap, memArea,
    MEM.conta("Areia do concreto magro, com 10% de perda", "área × 0,60 × 0,10 × 1,10", [["área", area]], areiaGrossaContrapBruto, "m³"),
    MEM.teto(areiaGrossaContrapBruto, areiaGrossaContrap, "m³", "Arredonda para cima (a areia vem em m³ inteiro)"),
  ] });
  emitir(out, { ...base, subEtapa: "Contrapiso Interno Pav. Térreo", item: "Pedra", unidade: "m3", qtd: pedraContrap, memoria: [
    notaContrap, memArea,
    MEM.conta("Pedra da camada de 10 cm, com 10% de perda", "área × 0,10 × 1,10", [["área", area]], pedraContrapBruto, "m³"),
    MEM.teto(pedraContrapBruto, pedraContrap, "m³", "Arredonda para cima (a pedra vem em m³ inteiro)"),
  ] });
  emitir(out, { ...base, subEtapa: "Contrapiso Interno Pav. Térreo", item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimentoContrap, memoria: [
    notaContrap,
    MEM.dado("Pedra do contrapiso", pedraContrap, "m³", "passo anterior"),
    MEM.conta("Cimento: 6 sacos por m³ de pedra, com 10% de perda", "pedra × 6 × 1,10", [["pedra", pedraContrap]], cimentoContrapBruto, "sacos"),
    MEM.teto(cimentoContrapBruto, cimentoContrap, "sacos de 50 kg", "Arredonda para cima (saco fechado)"),
  ] });
  emitir(out, { ...base, subEtapa: "Contrapiso Interno Pav. Térreo", item: "Aço - Malha Pop EQ061 3.4mm 15x15", unidade: "Unidade", qtd: malhaPop, memoria: [
    MEM.nota("Tela soldada do contrapiso. Cada painel tem 2,90 × 1,90 m; a perda de 10% entra dividindo (as telas se sobrepõem, então cobrem menos área que a nominal)."),
    memArea,
    MEM.conta("Painéis de tela", "área ÷ (2,90 × 1,90 × 1,10)", [["área", area]], malhaPopBruto, "painéis"),
    MEM.teto(malhaPopBruto, malhaPop, "painéis", "Arredonda para cima (painel inteiro)"),
  ] });
  emitir(out, { ...base, subEtapa: "Massiamento contrap Pav. Térreo", item: "Sacos de cimento 50kg", unidade: "Unidade", qtd: cimentoMassiam, memoria: [
    notaMassiam, memArea,
    MEM.conta("Cimento: 5 cm de camada, 25% de cimento, 1.200 kg/m³, saco de 50 kg, 10% de perda", "área × 0,05 × 0,25 × 1.200 ÷ 50 × 1,10", [["área", area]], cimentoMassiamBruto, "sacos"),
    MEM.teto(cimentoMassiamBruto, cimentoMassiam, "sacos de 50 kg", "Arredonda para cima (saco fechado)"),
  ] });
  emitir(out, { ...base, subEtapa: "Massiamento contrap Pav. Térreo", item: "Areia Grossa", unidade: "m3", qtd: areiaGrossaMassiam, memoria: [
    notaMassiam, memArea,
    MEM.conta("Areia: 5 cm de camada, 75% de areia, com 10% de perda", "área × 0,05 × 0,75 × 1,10", [["área", area]], areiaGrossaMassiamBruto, "m³"),
    MEM.teto(areiaGrossaMassiamBruto, areiaGrossaMassiam, "m³", "Arredonda para cima (a areia vem em m³ inteiro)"),
  ] });
  emitir(out, { ...base, subEtapa: "Massiamento contrap Pav. Térreo", item: "Impermeabilizantes - Bianco 18KG", unidade: "Unidades", qtd: biancoMassiam, memoria: [
    MEM.nota("Bianco (aditivo impermeabilizante) na argamassa do massiamento: um balde de 18 kg rende 60 m²."),
    memArea,
    MEM.conta("Baldes, com 10% de perda", "área ÷ 60 × 1,10", [["área", area]], biancoMassiamBruto, "baldes"),
    MEM.teto(biancoMassiamBruto, biancoMassiam, "baldes", "Arredonda para cima (balde fechado)"),
  ] });
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

  const tabuas10Bruto = (((t.perimetroLoje * 2 / 3) + t.perimetroLoje * 2 / 3 * 0.45 / 3)) * PERDA;
  const tabuas10 = teto(tabuas10Bruto);
  const tabuas30Bruto = (((cp.perimetroParedesTerreo * 2 / 3) + cp.perimetroParedesTerreo * 2 / 3 * 0.45 / 3)) * PERDA;
  const tabuas30 = teto(tabuas30Bruto);
  const sarrafo5Bruto = ((cp.perimetroParedesTerreo * 2 / 0.7 * 0.45) + (cp.perimetroParedesTerreo / 0.75 * 0.3)) / 3 * PERDA;
  const sarrafo5 = teto(sarrafo5Bruto);

  const ferro = normalizarFerro(t.vigaRespaldo);
  const ca60_4mm = teto(ferro.CA60_4MM / BARRA_FERRO_MTS * PERDA);
  const ca50_5mm = teto(ferro.CA50_5MM / BARRA_FERRO_MTS * PERDA);
  const ca50_6mm = teto(ferro.CA50_6MM / BARRA_FERRO_MTS * PERDA);
  const ca50_8mm = teto(ferro.CA50_8MM / BARRA_FERRO_MTS * PERDA);
  const ca50_10mm = teto(ferro.CA50_10MM / BARRA_FERRO_MTS * PERDA);
  const ca50_12mm = teto(ferro.CA50_12MM / BARRA_FERRO_MTS * PERDA);
  const ca50_16mm = teto(ferro.CA50_16MM / BARRA_FERRO_MTS * PERDA);
  const ca60_5mm = teto(ferro.CA60_5MM / BARRA_FERRO_MTS * PERDA);
  const peso = ca60_4mm * PESOS_FERRO.CA60_4MM + ca50_5mm * PESOS_FERRO.CA50_5MM + ca50_6mm * PESOS_FERRO.CA50_6MM +
    ca50_8mm * PESOS_FERRO.CA50_8MM + ca50_10mm * PESOS_FERRO.CA50_10MM + ca50_12mm * PESOS_FERRO.CA50_12MM +
    ca50_16mm * PESOS_FERRO.CA50_16MM + ca60_5mm * PESOS_FERRO.CA60_5MM;
  const arameBruto = peso * 0.06 * PERDA;
  const arame = teto(arameBruto);
  const pregoBruto = arame * 0.55;
  const prego = teto(pregoBruto);

  const volumeConcretoLojeBruto = ((t.areaLoje * 0.1) + t.concretoVigaRespaldo) * PERDA;
  const volumeConcretoLoje = teto(volumeConcretoLojeBruto);
  const malhaPopBruto = (t.areaLoje / (2.9 * 1.9)) * PERDA;
  const malhaPop = teto(malhaPopBruto);

  const tipoConcat = tipologiaVba + t.tipoLoje;
  let nomeModelo = "";
  if (tipoConcat === "TérreoProtendida") nomeModelo = "Laje Pré Moldada Protendida Forro";
  else if (tipoConcat === "SobradoProtendida") nomeModelo = "Laje Pré Moldada Protendida Piso";
  else if (tipoConcat === "TérreoTreliça") nomeModelo = "Laje Pré Moldada Treliça Forro";
  else if (tipoConcat === "SobradoTreliça") nomeModelo = "Laje Pré Moldada Treliça Piso";

  const qtdLojeBruto = t.areaLoje * PERDA;
  const qtdLoje = teto(qtdLojeBruto);
  const qtdEscorasBruto = t.tipoLoje === "Protendida" ? t.areaLoje * 0.6 * mesesEscoras * PERDA : t.areaLoje * mesesEscoras * PERDA;
  const qtdEscoras = teto(qtdEscorasBruto);

  const lojeMacicaBruto = t.areaLojeMacica * 0.15 * PERDA;
  const lojeMacica = teto(lojeMacicaBruto);
  const maderiteLojeMacicaBruto = t.areaLojeMacica / 2.42 * PERDA;
  const maderiteLojeMacica = teto(maderiteLojeMacicaBruto);
  const escorasLojeMacicaBruto = t.areaLojeMacica * mesesEscoras * PERDA;
  const escorasLojeMacica = teto(escorasLojeMacicaBruto);

  const memViga = (k) => memoriaBitolaSimples(k, ferro[k], { CA60_4MM: ca60_4mm, CA50_5MM: ca50_5mm, CA50_6MM: ca50_6mm, CA50_8MM: ca50_8mm, CA50_10MM: ca50_10mm, CA50_12MM: ca50_12mm, CA50_16MM: ca50_16mm, CA60_5MM: ca60_5mm }[k], "na viga de respaldo do térreo");
  const memEscoras = (area, bruto, valor) => [
    MEM.nota(`Escoras alugadas por mês: ${mesesEscoras} ${mesesEscoras === 1 ? "mês" : "meses"} de escoramento (${cp.tipologia === "Sobrado" ? "sobrado: a laje fica escorada mais tempo" : "obra térrea"}).${t.tipoLoje === "Protendida" ? " Laje protendida usa 0,6 escora por m², menos que a treliçada." : ""}`),
    MEM.dado("Área da laje", area, "m²", "bloco Laje Térreo"),
    MEM.conta("Escoras, com 10% de perda", t.tipoLoje === "Protendida" ? "área × 0,60 × meses × 1,10" : "área × meses × 1,10", [["área", area], ["meses", mesesEscoras]], bruto, "escoras"),
    MEM.teto(bruto, valor, "escoras"),
  ];
  const etapa = "Viga Respaldo e Laje";
  const o = ORD.vigaLajeTerreo;
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Madeira Caixaria - Tábuas de 10cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas10, memoria: [
    MEM.nota("Fôrma do fundo da viga de respaldo, que acompanha o perímetro da laje."),
    MEM.dado("Perímetro da laje do térreo", t.perimetroLoje, "m", "bloco Laje (forro)"),
    MEM.conta("Tábuas de 3 m, com 10% de perda", "(perímetro × 2 ÷ 3 + perímetro × 2 ÷ 3 × 0,45 ÷ 3) × 1,10", [["perímetro", t.perimetroLoje]], tabuas10Bruto, "tábuas"),
    MEM.teto(tabuas10Bruto, tabuas10, "tábuas de 3 m", "Arredonda para cima (tábua inteira)"),
  ] });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Madeira Caixaria - Tábuas de 30cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas30, memoria: [
    MEM.nota("Laterais da fôrma da viga de respaldo, duas por trecho, ao longo do perímetro das paredes."),
    MEM.dado("Perímetro das paredes do térreo", cp.perimetroParedesTerreo, "m", "bloco Pav. Térreo"),
    MEM.conta("Tábuas de 3 m, com 10% de perda", "(perímetro × 2 ÷ 3 + perímetro × 2 ÷ 3 × 0,45 ÷ 3) × 1,10", [["perímetro", cp.perimetroParedesTerreo]], tabuas30Bruto, "tábuas"),
    MEM.teto(tabuas30Bruto, tabuas30, "tábuas de 3 m", "Arredonda para cima (tábua inteira)"),
  ] });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Madeira Caixaria - Sarrafos de 05cm x 3mts", unidade: "Barras 3 mts", qtd: sarrafo5, memoria: [
    MEM.nota("Gravatas a cada 70 cm nas duas faces (0,45 m cada) e escoras a cada 75 cm (0,30 m cada) da fôrma da viga."),
    MEM.dado("Perímetro das paredes do térreo", cp.perimetroParedesTerreo, "m", "bloco Pav. Térreo"),
    MEM.conta("Sarrafos de 3 m, com 10% de perda", "(perímetro × 2 ÷ 0,70 × 0,45 + perímetro ÷ 0,75 × 0,30) ÷ 3 × 1,10", [["perímetro", cp.perimetroParedesTerreo]], sarrafo5Bruto, "sarrafos"),
    MEM.teto(sarrafo5Bruto, sarrafo5, "sarrafos de 3 m", "Arredonda para cima (sarrafo inteiro)"),
  ] });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Aço - Barras de CA60 4.2mm 12mts", unidade: "Barras 12mts", qtd: ca60_4mm, memoria: memViga("CA60_4MM") });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Aço - Barras de CA50 5.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_5mm, memoria: memViga("CA50_5MM") });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Aço - Barras de CA50 6.3mm 12mts", unidade: "Barras 12mts", qtd: ca50_6mm, memoria: memViga("CA50_6MM") });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Aço - Barras de CA50 8.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_8mm, memoria: memViga("CA50_8MM") });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Aço - Barras de CA50 10.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_10mm, memoria: memViga("CA50_10MM") });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Aço - Barras de CA50 12.5mm 12mts", unidade: "Barras 12mts", qtd: ca50_12mm, memoria: memViga("CA50_12MM") });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Aço - Barras de CA50 16mm 12mts", unidade: "Barras 12mts", qtd: ca50_16mm, memoria: memViga("CA50_16MM") });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Aço - Barras de CA60 5.0mm 12mts", unidade: "Barras 12mts", qtd: ca60_5mm, memoria: memViga("CA60_5MM") });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Aço - Arame Recozido", unidade: "KG", qtd: arame, memoria: MEMB.arameDoPeso(peso, arameBruto, arame) });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Térreo", item: "Aço - Pregos 18x27", unidade: "KG", qtd: prego, memoria: MEMB.pregoDoArame(arame, pregoBruto, prego) });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Térreo", item: t.resistenciaConcretoLoje || "Concreto", unidade: "m3", qtd: volumeConcretoLoje, memoria: [
    MEM.nota("Capa de concreto da laje pré-moldada (10 cm) somada ao volume da viga de respaldo."),
    MEM.dado("Área da laje do térreo", t.areaLoje, "m²", "bloco Laje (forro)"),
    MEM.dado("Concreto da viga de respaldo", t.concretoVigaRespaldo, "m³", "bloco Laje (forro)"),
    MEM.conta("Volume com 10% de perda", "(área × 0,10 + viga) × 1,10", [["área", t.areaLoje], ["viga", t.concretoVigaRespaldo]], volumeConcretoLojeBruto, "m³"),
    MEM.teto(volumeConcretoLojeBruto, volumeConcretoLoje, "m³", "Arredonda para cima (a usina entrega em m³ inteiro)"),
  ] });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Térreo", item: "Aço - Malha pop EQ092 4.2mm 15x15", unidade: "Unidades", qtd: malhaPop, memoria: [
    MEM.nota("Tela da capa da laje. Cada painel tem 2,90 × 1,90 m."),
    MEM.dado("Área da laje do térreo", t.areaLoje, "m²", "bloco Laje (forro)"),
    MEM.conta("Painéis, com 10% de perda", "área ÷ (2,90 × 1,90) × 1,10", [["área", t.areaLoje]], malhaPopBruto, "painéis"),
    MEM.teto(malhaPopBruto, malhaPop, "painéis", "Arredonda para cima (painel inteiro)"),
  ] });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Térreo", item: nomeModelo, unidade: "m2", qtd: qtdLoje, memoria: [
    MEM.nota(`Laje pré-moldada escolhida no projeto: ${nomeModelo || "(modelo não definido)"} — o tipo (${t.tipoLoje || "—"}) e a tipologia da casa definem se é laje de forro ou de piso.`),
    MEM.dado("Área da laje do térreo", t.areaLoje, "m²", "bloco Laje (forro)"),
    MEM.conta("Área com 10% de perda", "área × 1,10", [["área", t.areaLoje]], qtdLojeBruto, "m²"),
    MEM.teto(qtdLojeBruto, qtdLoje, "m²"),
  ] });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Térreo", item: "Locação Ferramentas - Escoras", unidade: "Unidade", qtd: qtdEscoras, memoria: memEscoras(t.areaLoje, qtdEscorasBruto, qtdEscoras) });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Térreo", item: "Concreto - Bomba", unidade: "Unidade", qtd: 1, memoria: MEM_CANTEIRO("Uma bombeada de concreto para a laje do térreo. Concretagem em mais de um dia pede mais — ajuste no item.") });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Maciça Térreo", item: t.resistenciaConcretoLoje || "Concreto", unidade: "m3", qtd: lojeMacica, memoria: [
    MEM.nota("Trecho de laje maciça (concretada no lugar), com 15 cm de espessura."),
    MEM.dado("Área de laje maciça no térreo", t.areaLojeMacica, "m²", "bloco Laje (forro)"),
    MEM.conta("Volume com 10% de perda", "área × 0,15 × 1,10", [["área", t.areaLojeMacica]], lojeMacicaBruto, "m³"),
    MEM.teto(lojeMacicaBruto, lojeMacica, "m³", "Arredonda para cima (a usina entrega em m³ inteiro)"),
  ] });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Maciça Térreo", item: "Madeira Caixaria - Madeirite Plastif. Preto 2,10x1,10mts 18mm", unidade: "Unidade", qtd: maderiteLojeMacica, memoria: [
    MEM.nota("Fundo de fôrma da laje maciça, em chapas de 2,10 × 1,10 m (2,42 m² cada)."),
    MEM.dado("Área de laje maciça no térreo", t.areaLojeMacica, "m²", "bloco Laje (forro)"),
    MEM.conta("Chapas, com 10% de perda", "área ÷ 2,42 × 1,10", [["área", t.areaLojeMacica]], maderiteLojeMacicaBruto, "chapas"),
    MEM.teto(maderiteLojeMacicaBruto, maderiteLojeMacica, "chapas", "Arredonda para cima (chapa inteira)"),
  ] });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Maciça Térreo", item: "Locação Ferramentas - Escoras", unidade: "Unidade", qtd: escorasLojeMacica, memoria: [
    MEM.nota(`Escoras da laje maciça: ${mesesEscoras} ${mesesEscoras === 1 ? "mês" : "meses"} de aluguel, uma por m².`),
    MEM.dado("Área de laje maciça no térreo", t.areaLojeMacica, "m²", "bloco Laje (forro)"),
    MEM.conta("Escoras, com 10% de perda", "área × meses × 1,10", [["área", t.areaLojeMacica], ["meses", mesesEscoras]], escorasLojeMacicaBruto, "escoras"),
    MEM.teto(escorasLojeMacicaBruto, escorasLojeMacica, "escoras"),
  ] });
}

// ═══════════════════════════════════════════════════════════════
// H_PAREDES_PAV_1.bas — parecido com F_PAREDES_TERREO, mas com diferenças
// reais do original preservadas (não generalizado): "tábuas 30" usa
// COLUNAS_25 (não 30), CA60 4.2mm nunca é calculado nem emitido aqui, e o
// rótulo de sub-etapa das colunas repete "Supra estrutura Pav. Térreo".
// ═══════════════════════════════════════════════════════════════
function paredesPav1(cp, out) {
  const p1 = cp.pav1;
  const tijolos6FBruto = p1.m2Parede20 * 40 * PERDA;
  const tijolos6F = teto(tijolos6FBruto);
  const tijolos8FBruto = (p1.m2Parede25 * 40 + p1.m2Parede15 * 20) * PERDA;
  const tijolos8F = teto(tijolos8FBruto);
  const areiaFinaAssentBruto = tijolos6F * 0.001638 * PERDA + tijolos8F * 0.002223 * PERDA;
  const areiaFinaAssent = teto(areiaFinaAssentBruto);
  const vedalitFinaAssentBruto = areiaFinaAssent / 25 * PERDA;
  const vedalitFinaAssent = teto(vedalitFinaAssentBruto);
  const cimentoFinaAssentBruto = areiaFinaAssent * 2 * PERDA;
  const cimentoFinaAssent = teto(cimentoFinaAssentBruto);
  const contravergaBruto = p1.vaoPortasJanelas * 2 / 12 * PERDA;
  const contraverga = teto(contravergaBruto);

  const tabuas15ColunBruto = p1.colunas15 * 2.8 * 2 / 3 * PERDA;
  const tabuas15Colun = teto(tabuas15ColunBruto);
  const tabuas20ColunBruto = p1.colunas20 * 2.8 * 2 / 3 * PERDA;
  const tabuas20Colun = teto(tabuas20ColunBruto);
  // O VBA usava só CP_COLUNAS_25 aqui, e as colunas de 30 cm do pav. 1
  // ficavam sem fôrma nenhuma (o térreo, que não tem campo de 25, usava as
  // de 30). Corrigido em set/2026: a tábua de 30 cm atende as colunas de 25
  // e as de 30 — nenhuma coluna fica sem fôrma.
  const colunasTabua30Pav1 = p1.colunas25 + p1.colunas30;
  const tabuas30ColunBruto = colunasTabua30Pav1 * 2.8 * 2 / 3 * PERDA;
  const tabuas30Colun = teto(tabuas30ColunBruto);
  const sarrafo5ColunBruto =
    ((p1.colunas15 * 2.8 * 2 / 0.5 * 0.2) +
      (p1.colunas20 * 2.8 * 2 / 0.5 * 0.25) +
      (colunasTabua30Pav1 * 2.8 * 2 / 0.5 * 0.35)) * PERDA / 3;
  const sarrafo5Colun = teto(sarrafo5ColunBruto);
  const maderitesColunBruto = p1.areaFormaColunaMaior25cm / 2.42 * PERDA;
  const maderitesColun = teto(maderitesColunBruto);
  const areiaGrossaColunasBruto = p1.concrColuna * 0.6 * PERDA;
  const areiaGrossaColunas = teto(areiaGrossaColunasBruto);
  const pedraColunasBruto = p1.concrColuna * PERDA;
  const pedraColunas = teto(pedraColunasBruto);
  const cimentoColunasBruto = pedraColunas * 6 * PERDA;
  const cimentoColunas = teto(cimentoColunasBruto);

  const ferro = normalizarFerro(p1.ferro);
  // No VBA, a linha de CA60 4,2 mm do pav. 1 testava uma variável que nunca
  // era atribuída (sempre 0), então o ferro de 4,2 mm lançado nas colunas do
  // pav. 1 simplesmente sumia do orçamento. Corrigido em set/2026: calculado
  // e emitido como as demais bitolas.
  const ca60_4mm = teto(ferro.CA60_4MM / BARRA_FERRO_MTS * PERDA);
  const ca50_5mm = teto(ferro.CA50_5MM / BARRA_FERRO_MTS * PERDA);
  const ca50_6mm = teto(ferro.CA50_6MM / BARRA_FERRO_MTS * PERDA);
  const ca50_8mm = teto(ferro.CA50_8MM / BARRA_FERRO_MTS * PERDA);
  const ca50_10mm = teto(ferro.CA50_10MM / BARRA_FERRO_MTS * PERDA);
  const ca50_12mm = teto(ferro.CA50_12MM / BARRA_FERRO_MTS * PERDA);
  const ca50_16mm = teto(ferro.CA50_16MM / BARRA_FERRO_MTS * PERDA);
  const ca60_5mm = teto(ferro.CA60_5MM / BARRA_FERRO_MTS * PERDA);
  const pesoFerroColunas = ca60_4mm * PESOS_FERRO.CA60_4MM + ca50_5mm * PESOS_FERRO.CA50_5MM + ca50_6mm * PESOS_FERRO.CA50_6MM +
    ca50_8mm * PESOS_FERRO.CA50_8MM + ca50_10mm * PESOS_FERRO.CA50_10MM + ca50_12mm * PESOS_FERRO.CA50_12MM +
    ca50_16mm * PESOS_FERRO.CA50_16MM + ca60_5mm * PESOS_FERRO.CA60_5MM;
  const arameColunasBruto = pesoFerroColunas * 0.06 * PERDA;
  const arameColunas = teto(arameColunasBruto);
  const pregos18x27Bruto = arameColunas * 0.55;
  const pregos18x27 = teto(pregos18x27Bruto);

  const base = { ordem: ORD.paredesPav1, tipo: "Bruto", etapa: "Supra estrutura e paredes" };
  const subParedes = "Paredes Pav 1";
  // O VBA repetia aqui o rótulo do módulo do térreo ("Supra estrutura Pav.
  // Térreo"), então os itens do pav. 1 apareciam sob o nome do pavimento de
  // baixo. Corrigido em set/2026.
  const subSupra = "Supra estrutura Pav 1";

  emitir(out, { ...base, subEtapa: subParedes, item: "Cerâmicas - Tijolo - Bloco  6 Furos", unidade: "Unidade", qtd: tijolos6F, memoria: MEMB.tijolo6("no pav. 1", p1.m2Parede20, tijolos6FBruto, tijolos6F) });
  emitir(out, { ...base, subEtapa: subParedes, item: "Cerâmicas - Tijolo - Bloco 8 Furos", unidade: "Unidade", qtd: tijolos8F, memoria: MEMB.tijolo8("no pav. 1", p1.m2Parede25, p1.m2Parede15, tijolos8FBruto, tijolos8F) });
  emitir(out, { ...base, subEtapa: subParedes, item: "Areia Fina", unidade: "m3", qtd: areiaFinaAssent, memoria: MEMB.areiaAssentamento(tijolos6F, tijolos8F, areiaFinaAssentBruto, areiaFinaAssent) });
  emitir(out, { ...base, subEtapa: subParedes, item: "Impermeabilizantes - Vedalit 18L", unidade: "Baldes 18L", qtd: vedalitFinaAssent, memoria: MEMB.vedalitAssentamento(areiaFinaAssent, vedalitFinaAssentBruto, vedalitFinaAssent) });
  emitir(out, { ...base, subEtapa: subParedes, item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimentoFinaAssent, memoria: MEMB.cimentoAssentamento(areiaFinaAssent, cimentoFinaAssentBruto, cimentoFinaAssent) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Treliça H8 Barras 12mts", unidade: "Barras 12mts", qtd: contraverga, memoria: MEMB.trelicaVergas("do pav. 1", p1.vaoPortasJanelas, contravergaBruto, contraverga) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Madeira Caixaria - Tábuas de 20cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas15Colun, memoria: MEMB.tabuaColuna("do pav. 1", 15, p1.colunas15, tabuas15ColunBruto, tabuas15Colun) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Madeira Caixaria - Tábuas de 25cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas20Colun, memoria: MEMB.tabuaColuna("do pav. 1", 20, p1.colunas20, tabuas20ColunBruto, tabuas20Colun) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Madeira Caixaria - Tábuas de 30cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas30Colun, memoria: MEMB.tabuaColuna("do pav. 1", "25 e 30", colunasTabua30Pav1, tabuas30ColunBruto, tabuas30Colun) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Madeira Caixaria - Sarrafos de 05cm x 3mts", unidade: "Barras 3 mts", qtd: sarrafo5Colun, memoria: MEMB.sarrafoColunas(p1.colunas15, p1.colunas20, colunasTabua30Pav1, sarrafo5ColunBruto, sarrafo5Colun) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Madeira Caixaria - Madeirite Plastif. Preto 2,10x1,10mts 18mm", unidade: "Unidade", qtd: maderitesColun, memoria: MEMB.madeirite(p1.areaFormaColunaMaior25cm, maderitesColunBruto, maderitesColun) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Areia Grossa", unidade: "m3", qtd: areiaGrossaColunas, memoria: MEMB.areiaConcreto("Concreto das colunas do pav. 1", p1.concrColuna, areiaGrossaColunasBruto, areiaGrossaColunas) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Pedra", unidade: "m3", qtd: pedraColunas, memoria: MEMB.pedraConcreto("Concreto das colunas do pav. 1", p1.concrColuna, pedraColunasBruto, pedraColunas) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimentoColunas, memoria: MEMB.cimentoDaPedra(pedraColunas, cimentoColunasBruto, cimentoColunas) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA60 4.2mm 12mts", unidade: "Barras 12mts", qtd: ca60_4mm, memoria: memoriaBitolaSimples("CA60_4MM", ferro.CA60_4MM, ca60_4mm, "nas colunas do pav. 1") });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 5.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_5mm, memoria: memoriaBitolaSimples("CA50_5MM", ferro.CA50_5MM, ca50_5mm, "nas colunas do pav. 1") });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 6.3mm 12mts", unidade: "Barras 12mts", qtd: ca50_6mm, memoria: memoriaBitolaSimples("CA50_6MM", ferro.CA50_6MM, ca50_6mm, "nas colunas do pav. 1") });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 8.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_8mm, memoria: memoriaBitolaSimples("CA50_8MM", ferro.CA50_8MM, ca50_8mm, "nas colunas do pav. 1") });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 10.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_10mm, memoria: memoriaBitolaSimples("CA50_10MM", ferro.CA50_10MM, ca50_10mm, "nas colunas do pav. 1") });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 12.5mm 12mts", unidade: "Barras 12mts", qtd: ca50_12mm, memoria: memoriaBitolaSimples("CA50_12MM", ferro.CA50_12MM, ca50_12mm, "nas colunas do pav. 1") });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA50 16mm 12mts", unidade: "Barras 12mts", qtd: ca50_16mm, memoria: memoriaBitolaSimples("CA50_16MM", ferro.CA50_16MM, ca50_16mm, "nas colunas do pav. 1") });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Barras de CA60 5.0mm 12mts", unidade: "Barras 12mts", qtd: ca60_5mm, memoria: memoriaBitolaSimples("CA60_5MM", ferro.CA60_5MM, ca60_5mm, "nas colunas do pav. 1") });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Arame Recozido", unidade: "KG", qtd: arameColunas, memoria: MEMB.arameDoPeso(pesoFerroColunas, arameColunasBruto, arameColunas) });
  emitir(out, { ...base, subEtapa: subSupra, item: "Aço - Pregos 18x27", unidade: "KG", qtd: pregos18x27, memoria: MEMB.pregoDoArame(arameColunas, pregos18x27Bruto, pregos18x27) });
}

// ═══════════════════════════════════════════════════════════════
// I_VIGA_RESPALDO_LAJE_PAV_1.bas
// ═══════════════════════════════════════════════════════════════
function vigaRespaldoLajePav1(cp, out) {
  const p1 = cp.pav1;
  const tipologiaVba = cp.tipologia === "Sobrado" ? "Sobrado" : "Térreo";

  const tabuas10Bruto = (((p1.perimetroLoje * 2 / 3) + p1.perimetroLoje * 2 / 3 * 0.45 / 3)) * PERDA;
  const tabuas10 = teto(tabuas10Bruto);
  const tabuas30Bruto = (((p1.perimetroParedes * 2 / 3) + p1.perimetroParedes * 2 / 3 * 0.45 / 3)) * PERDA;
  const tabuas30 = teto(tabuas30Bruto);
  const sarrafo5Bruto = ((p1.perimetroParedes * 2 / 0.7 * 0.45) + (p1.perimetroParedes / 0.75 * 0.3)) / 3 * PERDA;
  const sarrafo5 = teto(sarrafo5Bruto);

  const ferro = normalizarFerro(p1.vigaRespaldo);
  const ca50_5mm = teto(ferro.CA50_5MM / BARRA_FERRO_MTS * PERDA);
  const ca50_6mm = teto(ferro.CA50_6MM / BARRA_FERRO_MTS * PERDA);
  const ca50_8mm = teto(ferro.CA50_8MM / BARRA_FERRO_MTS * PERDA);
  const ca50_10mm = teto(ferro.CA50_10MM / BARRA_FERRO_MTS * PERDA);
  const ca50_12mm = teto(ferro.CA50_12MM / BARRA_FERRO_MTS * PERDA);
  const ca50_16mm = teto(ferro.CA50_16MM / BARRA_FERRO_MTS * PERDA);
  const ca60_5mm = teto(ferro.CA60_5MM / BARRA_FERRO_MTS * PERDA);
  const peso = ca50_5mm * PESOS_FERRO.CA50_5MM + ca50_6mm * PESOS_FERRO.CA50_6MM + ca50_8mm * PESOS_FERRO.CA50_8MM +
    ca50_10mm * PESOS_FERRO.CA50_10MM + ca50_12mm * PESOS_FERRO.CA50_12MM + ca50_16mm * PESOS_FERRO.CA50_16MM + ca60_5mm * PESOS_FERRO.CA60_5MM;
  const arameBruto = peso * 0.06 * PERDA;
  const arame = teto(arameBruto);
  const pregoBruto = arame * 0.55;
  const prego = teto(pregoBruto);

  const volumeConcretoLojeBruto = ((p1.areaLoje * 0.1) + p1.concretoVigaRespaldo) * PERDA;
  const volumeConcretoLoje = teto(volumeConcretoLojeBruto);
  const malhaPopBruto = (p1.areaLoje / (2.9 * 1.9)) * PERDA;
  const malhaPop = teto(malhaPopBruto);

  const tipoConcat = tipologiaVba + p1.tipoLoje;
  let nomeModelo = "";
  if (tipoConcat === "TérreoProtendida") nomeModelo = "Laje Pré Moldada Protendida Forro";
  else if (tipoConcat === "SobradoProtendida") nomeModelo = "Laje Pré Moldada Protendida Piso";
  else if (tipoConcat === "TérreoTreliça") nomeModelo = "Laje Pré Moldada Treliça Forro";
  else if (tipoConcat === "SobradoTreliça") nomeModelo = "Laje Pré Moldada Treliça Piso";

  const qtdLojeBruto = p1.areaLoje * PERDA;
  const qtdLoje = teto(qtdLojeBruto);
  // [VBA] meses de escora fixo em 1.5 aqui (não usa a variável de meses do
  // módulo do Térreo) — preservado literalmente.
  const qtdEscorasBruto = p1.tipoLoje === "Protendida" ? p1.areaLoje * 0.6 * 1.5 * PERDA : p1.areaLoje * 1.5 * PERDA;
  const qtdEscoras = teto(qtdEscorasBruto);

  const lojeMacicaBruto = p1.areaLojeMacica * 0.15 * PERDA;
  const lojeMacica = teto(lojeMacicaBruto);
  const maderiteLojeMacicaBruto = p1.areaLojeMacica / 2.42 * PERDA;
  const maderiteLojeMacica = teto(maderiteLojeMacicaBruto);
  const escorasLojeMacicaBruto = p1.areaLojeMacica * 1.5 * PERDA;
  const escorasLojeMacica = teto(escorasLojeMacicaBruto);

  // O VBA original usava aqui a área de laje do TÉRREO para o massiamento do
  // contrapiso do Pav. 1 (copy-paste do módulo do térreo). Corrigido em
  // set/2026: usa a área construída do próprio Pav. 1, que por padrão vem
  // pré-preenchida com a área da laje do térreo — mesmo número na maioria
  // das obras, mas editável quando os pavimentos têm áreas diferentes.
  const areaBase = numOrZero(cp.pav1.area) || cp.terreo.areaLoje;
  const cimentoMassiamBruto = areaBase * 0.05 * 0.25 * 1200 / 50 * PERDA;
  const cimentoMassiam = teto(cimentoMassiamBruto);
  const areiaGrossaMassiamBruto = areaBase * 0.05 * 0.75 * PERDA;
  const areiaGrossaMassiam = teto(areiaGrossaMassiamBruto);
  const biancoMassiamBruto = areaBase / 60 * PERDA;
  const biancoMassiam = teto(biancoMassiamBruto);

  const memVigaP1 = (k) => memoriaBitolaSimples(k, ferro[k], { CA50_5MM: ca50_5mm, CA50_6MM: ca50_6mm, CA50_8MM: ca50_8mm, CA50_10MM: ca50_10mm, CA50_12MM: ca50_12mm, CA50_16MM: ca50_16mm, CA60_5MM: ca60_5mm }[k], "na viga de respaldo do pav. 1");
  const notaMassiamP1 = MEM.nota("Massiamento do contrapiso do pav. 1: camada de 5 cm que nivela a laje para o piso. Usa a área construída do pav. 1 (em branco, a área da laje do térreo).");
  const etapa = "Viga Respaldo e Laje";
  const o = ORD.vigaLajePav1;
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Madeira Caixaria - Tábuas de 10cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas10, memoria: [
    MEM.nota("Fôrma do fundo da viga de respaldo do pav. 1, ao longo do perímetro da laje."),
    MEM.dado("Perímetro da laje do pav. 1", p1.perimetroLoje, "m", "bloco Laje Pav. 1"),
    MEM.conta("Tábuas de 3 m, com 10% de perda", "(perímetro × 2 ÷ 3 + perímetro × 2 ÷ 3 × 0,45 ÷ 3) × 1,10", [["perímetro", p1.perimetroLoje]], tabuas10Bruto, "tábuas"),
    MEM.teto(tabuas10Bruto, tabuas10, "tábuas de 3 m", "Arredonda para cima (tábua inteira)"),
  ] });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Madeira Caixaria - Tábuas de 30cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas30, memoria: [
    MEM.nota("Laterais da fôrma da viga de respaldo do pav. 1."),
    MEM.dado("Perímetro das paredes do pav. 1", p1.perimetroParedes, "m", "bloco Pav. 1"),
    MEM.conta("Tábuas de 3 m, com 10% de perda", "(perímetro × 2 ÷ 3 + perímetro × 2 ÷ 3 × 0,45 ÷ 3) × 1,10", [["perímetro", p1.perimetroParedes]], tabuas30Bruto, "tábuas"),
    MEM.teto(tabuas30Bruto, tabuas30, "tábuas de 3 m", "Arredonda para cima (tábua inteira)"),
  ] });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Madeira Caixaria - Sarrafos de 05cm x 3mts", unidade: "Barras 3 mts", qtd: sarrafo5, memoria: [
    MEM.nota("Gravatas a cada 70 cm nas duas faces e escoras a cada 75 cm da fôrma da viga do pav. 1."),
    MEM.dado("Perímetro das paredes do pav. 1", p1.perimetroParedes, "m", "bloco Pav. 1"),
    MEM.conta("Sarrafos de 3 m, com 10% de perda", "(perímetro × 2 ÷ 0,70 × 0,45 + perímetro ÷ 0,75 × 0,30) ÷ 3 × 1,10", [["perímetro", p1.perimetroParedes]], sarrafo5Bruto, "sarrafos"),
    MEM.teto(sarrafo5Bruto, sarrafo5, "sarrafos de 3 m", "Arredonda para cima (sarrafo inteiro)"),
  ] });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Aço - Barras de CA50 5.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_5mm, memoria: memVigaP1("CA50_5MM") });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Aço - Barras de CA50 6.3mm 12mts", unidade: "Barras 12mts", qtd: ca50_6mm, memoria: memVigaP1("CA50_6MM") });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Aço - Barras de CA50 8.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_8mm, memoria: memVigaP1("CA50_8MM") });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Aço - Barras de CA50 10.0mm 12mts", unidade: "Barras 12mts", qtd: ca50_10mm, memoria: memVigaP1("CA50_10MM") });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Aço - Barras de CA50 12.5mm 12mts", unidade: "Barras 12mts", qtd: ca50_12mm, memoria: memVigaP1("CA50_12MM") });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Aço - Barras de CA50 16mm 12mts", unidade: "Barras 12mts", qtd: ca50_16mm, memoria: memVigaP1("CA50_16MM") });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Aço - Barras de CA60 5.0mm 12mts", unidade: "Barras 12mts", qtd: ca60_5mm, memoria: memVigaP1("CA60_5MM") });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Aço - Arame Recozido", unidade: "KG", qtd: arame, memoria: MEMB.arameDoPeso(peso, arameBruto, arame) });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Viga Respaldo Pav 1", item: "Aço - Pregos 18x27", unidade: "KG", qtd: prego, memoria: MEMB.pregoDoArame(arame, pregoBruto, prego) });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Pav 1", item: p1.resistenciaConcretoLoje || "Concreto", unidade: "m3", qtd: volumeConcretoLoje, memoria: [
    MEM.nota("Capa de concreto da laje pré-moldada do pav. 1 (10 cm) somada ao volume da viga de respaldo."),
    MEM.dado("Área da laje do pav. 1", p1.areaLoje, "m²", "bloco Laje Pav. 1"),
    MEM.dado("Concreto da viga de respaldo", p1.concretoVigaRespaldo, "m³", "bloco Laje Pav. 1"),
    MEM.conta("Volume com 10% de perda", "(área × 0,10 + viga) × 1,10", [["área", p1.areaLoje], ["viga", p1.concretoVigaRespaldo]], volumeConcretoLojeBruto, "m³"),
    MEM.teto(volumeConcretoLojeBruto, volumeConcretoLoje, "m³", "Arredonda para cima (a usina entrega em m³ inteiro)"),
  ] });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Pav 1", item: "Aço - Malha pop EQ092 4.2mm 15x15", unidade: "Unidades", qtd: malhaPop, memoria: [
    MEM.nota("Tela da capa da laje do pav. 1. Cada painel tem 2,90 × 1,90 m."),
    MEM.dado("Área da laje do pav. 1", p1.areaLoje, "m²", "bloco Laje Pav. 1"),
    MEM.conta("Painéis, com 10% de perda", "área ÷ (2,90 × 1,90) × 1,10", [["área", p1.areaLoje]], malhaPopBruto, "painéis"),
    MEM.teto(malhaPopBruto, malhaPop, "painéis", "Arredonda para cima (painel inteiro)"),
  ] });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Pav 1", item: nomeModelo, unidade: "m2", qtd: qtdLoje, memoria: [
    MEM.nota(`Laje pré-moldada do pav. 1: ${nomeModelo || "(modelo não definido)"}.`),
    MEM.dado("Área da laje do pav. 1", p1.areaLoje, "m²", "bloco Laje Pav. 1"),
    MEM.conta("Área com 10% de perda", "área × 1,10", [["área", p1.areaLoje]], qtdLojeBruto, "m²"),
    MEM.teto(qtdLojeBruto, qtdLoje, "m²"),
  ] });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Pav 1", item: "Locação Ferramentas - Escoras", unidade: "Unidade", qtd: qtdEscoras, memoria: [
    MEM.nota(`Escoras da laje do pav. 1: 1,5 mês de aluguel.${p1.tipoLoje === "Protendida" ? " Laje protendida usa 0,6 escora por m², menos que a treliçada." : ""}`),
    MEM.dado("Área da laje do pav. 1", p1.areaLoje, "m²", "bloco Laje Pav. 1"),
    MEM.conta("Escoras, com 10% de perda", p1.tipoLoje === "Protendida" ? "área × 0,60 × 1,50 × 1,10" : "área × 1,50 × 1,10", [["área", p1.areaLoje]], qtdEscorasBruto, "escoras"),
    MEM.teto(qtdEscorasBruto, qtdEscoras, "escoras"),
  ] });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Pav 1", item: "Concreto - Bomba", unidade: "Unidade", qtd: 1, memoria: MEM_CANTEIRO("Uma bombeada de concreto para a laje do pav. 1.") });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Maciça Pav 1", item: p1.resistenciaConcretoLoje || "Concreto", unidade: "m3", qtd: lojeMacica, memoria: [
    MEM.nota("Trecho de laje maciça do pav. 1, com 15 cm de espessura."),
    MEM.dado("Área de laje maciça no pav. 1", p1.areaLojeMacica, "m²", "bloco Laje Pav. 1"),
    MEM.conta("Volume com 10% de perda", "área × 0,15 × 1,10", [["área", p1.areaLojeMacica]], lojeMacicaBruto, "m³"),
    MEM.teto(lojeMacicaBruto, lojeMacica, "m³", "Arredonda para cima (a usina entrega em m³ inteiro)"),
  ] });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Maciça Pav 1", item: "Madeira Caixaria - Madeirite Plastif. Preto 2,10x1,10mts 18mm", unidade: "Unidade", qtd: maderiteLojeMacica, memoria: [
    MEM.nota("Fundo de fôrma da laje maciça do pav. 1, em chapas de 2,42 m²."),
    MEM.dado("Área de laje maciça no pav. 1", p1.areaLojeMacica, "m²", "bloco Laje Pav. 1"),
    MEM.conta("Chapas, com 10% de perda", "área ÷ 2,42 × 1,10", [["área", p1.areaLojeMacica]], maderiteLojeMacicaBruto, "chapas"),
    MEM.teto(maderiteLojeMacicaBruto, maderiteLojeMacica, "chapas", "Arredonda para cima (chapa inteira)"),
  ] });
  emitir(out, { ordem: o, tipo: "Bruto", etapa, subEtapa: "Laje Maciça Pav 1", item: "Locação Ferramentas - Escoras", unidade: "Unidade", qtd: escorasLojeMacica, memoria: [
    MEM.nota("Escoras da laje maciça do pav. 1: 1,5 mês de aluguel, uma por m²."),
    MEM.dado("Área de laje maciça no pav. 1", p1.areaLojeMacica, "m²", "bloco Laje Pav. 1"),
    MEM.conta("Escoras, com 10% de perda", "área × 1,50 × 1,10", [["área", p1.areaLojeMacica]], escorasLojeMacicaBruto, "escoras"),
    MEM.teto(escorasLojeMacicaBruto, escorasLojeMacica, "escoras"),
  ] });
  emitir(out, { ordem: ORD.contrapisoInterno, tipo: "Bruto", etapa: "Contrapiso Interno Pav 1", subEtapa: "Massiamento contrap Pav 1", item: "Sacos de cimento 50kg", unidade: "Unidade", qtd: cimentoMassiam, memoria: [
    notaMassiamP1,
    MEM.dado("Área construída do pav. 1", areaBase, "m²", "bloco Pav. 1"),
    MEM.conta("Cimento: 5 cm, 25% de cimento, 1.200 kg/m³, saco de 50 kg, 10% de perda", "área × 0,05 × 0,25 × 1.200 ÷ 50 × 1,10", [["área", areaBase]], cimentoMassiamBruto, "sacos"),
    MEM.teto(cimentoMassiamBruto, cimentoMassiam, "sacos de 50 kg", "Arredonda para cima (saco fechado)"),
  ] });
  emitir(out, { ordem: ORD.contrapisoInterno, tipo: "Bruto", etapa: "Contrapiso Interno Pav 1", subEtapa: "Massiamento contrap Pav 1", item: "Areia Grossa", unidade: "m3", qtd: areiaGrossaMassiam, memoria: [
    notaMassiamP1,
    MEM.dado("Área construída do pav. 1", areaBase, "m²", "bloco Pav. 1"),
    MEM.conta("Areia: 5 cm de camada, 75% de areia, com 10% de perda", "área × 0,05 × 0,75 × 1,10", [["área", areaBase]], areiaGrossaMassiamBruto, "m³"),
    MEM.teto(areiaGrossaMassiamBruto, areiaGrossaMassiam, "m³", "Arredonda para cima (a areia vem em m³ inteiro)"),
  ] });
  emitir(out, { ordem: ORD.contrapisoInterno, tipo: "Bruto", etapa: "Contrapiso Interno Pav 1", subEtapa: "Massiamento contrap Pav 1", item: "Impermeabilizantes - Bianco 18KG", unidade: "Unidade", qtd: biancoMassiam, memoria: [
    notaMassiamP1,
    MEM.dado("Área construída do pav. 1", areaBase, "m²", "bloco Pav. 1"),
    MEM.conta("Baldes de Bianco (rende 60 m²), com 10% de perda", "área ÷ 60 × 1,10", [["área", areaBase]], biancoMassiamBruto, "baldes"),
    MEM.teto(biancoMassiamBruto, biancoMassiam, "baldes", "Arredonda para cima (balde fechado)"),
  ] });
}

// ═══════════════════════════════════════════════════════════════
// J_SUPRA_COBERTURA.bas
// ═══════════════════════════════════════════════════════════════
function supraCobertura(cp, out) {
  const c = cp.cobertura;
  const somaFerro = somarFerro(c.vigaFerro, c.colunaFerro); // nenhum dos dois tem CA60_4MM (fica 0)
  const barras = barrasPorBitola(somaFerro);
  const peso = pesoTotalFerro(barras);
  const arameBruto = peso * 0.06 * PERDA;
  const arame = teto(arameBruto);
  const pregoBruto = arame * 0.55;
  const prego = teto(pregoBruto);

  const volumeConcreto = numOrZero(c.volumeConcretoColunaRespaldo) + numOrZero(c.volumeConcretoVigaRespaldo); // [VBA] soma crua, sem ceil
  const areiaGrossaBruto = volumeConcreto * 0.6 * PERDA;
  const areiaGrossa = teto(areiaGrossaBruto);
  const pedraBruto = volumeConcreto * PERDA;
  const pedra = teto(pedraBruto);
  const cimentoBruto = pedra * 6 * PERDA;
  const cimento = teto(cimentoBruto);

  const tabuas20Bruto = c.colunas15 * 0.6 * 2 / 3 * PERDA;
  const tabuas20 = teto(tabuas20Bruto);
  const tabuas25Bruto = c.colunas20 * 0.6 * 2 / 3 * PERDA;
  const tabuas25 = teto(tabuas25Bruto);
  // [VBA] soma o perímetro da laje do Pav 1 aqui mesmo quando a tipologia é
  // Térrea — preservado literalmente do original.
  const tabuas30Bruto = ((c.colunas25 * 0.6 * 2) + (cp.pav1.perimetroLoje * 2)) / 3 * PERDA;
  const tabuas30 = teto(tabuas30Bruto);
  const maderitesBruto = c.areaFormaColunaMaior25cm / 2.42 * PERDA;
  const maderites = teto(maderitesBruto);
  const sarrafo5Bruto =
    ((c.colunas15 * 0.6 * 2 / 0.5 * 0.2) +
      (c.colunas20 * 0.6 * 2 / 0.5 * 0.25) +
      (c.colunas25 * 0.6 * 2 / 0.5 * 0.35) +
      (cp.pav1.perimetroLoje * 2 / 0.7 * 0.45) +
      (cp.pav1.perimetroLoje / 0.75 * 0.3)) * PERDA / 3;
  const sarrafo5 = teto(sarrafo5Bruto);

  const memSupra = (k) => memoriaBitola(k, [["vigas de respaldo", c.vigaFerro[k]], ["pilaretes", c.colunaFerro[k]]], barras);
  const notaSupra = MEM.nota("Supra cobertura: as vigas de respaldo e os pilaretes de 60 cm que fecham a alvenaria e apoiam o telhado.");
  const memTabuaPilarete = (larguraCm, colunas, bruto, valor) => [
    notaSupra,
    MEM.dado(`Pilaretes de ${larguraCm} cm`, colunas, "pilaretes", "bloco Engenharia — Pilares e vigas"),
    MEM.conta("Tábuas de 3 m, com 10% de perda", "pilaretes × 0,60 × 2 ÷ 3 × 1,10", [["pilaretes", colunas]], bruto, "tábuas"),
    MEM.teto(bruto, valor, "tábuas de 3 m", "Arredonda para cima (tábua inteira)"),
  ];
  const base = { ordem: ORD.supraCobertura, tipo: "Bruto", etapa: "Supra estrutura e paredes", subEtapa: "Supra Cobertura" };
  emitir(out, { ...base, item: "Aço - Barras de CA50 5.0mm 12mts", unidade: "Barras 12mts", qtd: barras.CA50_5MM, memoria: memSupra("CA50_5MM") });
  emitir(out, { ...base, item: "Aço - Barras de CA50 6.3mm 12mts", unidade: "Barras 12mts", qtd: barras.CA50_6MM, memoria: memSupra("CA50_6MM") });
  emitir(out, { ...base, item: "Aço - Barras de CA50 8.0mm 12mts", unidade: "Barras 12mts", qtd: barras.CA50_8MM, memoria: memSupra("CA50_8MM") });
  emitir(out, { ...base, item: "Aço - Barras de CA50 10.0mm 12mts", unidade: "Barras 12mts", qtd: barras.CA50_10MM, memoria: memSupra("CA50_10MM") });
  emitir(out, { ...base, item: "Aço - Barras de CA50 12.5mm 12mts", unidade: "Barras 12mts", qtd: barras.CA50_12MM, memoria: memSupra("CA50_12MM") });
  emitir(out, { ...base, item: "Aço - Barras de CA50 16mm 12mts", unidade: "Barras 12mts", qtd: barras.CA50_16MM, memoria: memSupra("CA50_16MM") });
  emitir(out, { ...base, item: "Aço - Barras de CA60 5.0mm 12mts", unidade: "Barras 12mts", qtd: barras.CA60_5MM, memoria: memSupra("CA60_5MM") });
  emitir(out, { ...base, item: "Aço - Arame Recozido", unidade: "KG", qtd: arame, memoria: MEMB.arameDoPeso(peso, arameBruto, arame) });
  emitir(out, { ...base, item: "Aço - Pregos 18x27", unidade: "KG", qtd: prego, memoria: MEMB.pregoDoArame(arame, pregoBruto, prego) });
  emitir(out, { ...base, item: "Areia Grossa", unidade: "m3", qtd: areiaGrossa, memoria: MEMB.areiaConcreto("Concreto das vigas de respaldo e pilaretes", volumeConcreto, areiaGrossaBruto, areiaGrossa) });
  emitir(out, { ...base, item: "Pedra", unidade: "m3", qtd: pedra, memoria: MEMB.pedraConcreto("Concreto das vigas de respaldo e pilaretes", volumeConcreto, pedraBruto, pedra) });
  emitir(out, { ...base, item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimento, memoria: MEMB.cimentoDaPedra(pedra, cimentoBruto, cimento) });
  emitir(out, { ...base, item: "Madeira Caixaria - Tábuas de 20cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas20, memoria: memTabuaPilarete(15, c.colunas15, tabuas20Bruto, tabuas20) });
  emitir(out, { ...base, item: "Madeira Caixaria - Tábuas de 25cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas25, memoria: memTabuaPilarete(20, c.colunas20, tabuas25Bruto, tabuas25) });
  emitir(out, { ...base, item: "Madeira Caixaria - Tábuas de 30cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas30, memoria: [
    notaSupra,
    MEM.dado("Pilaretes de 25 cm", c.colunas25, "pilaretes", "bloco Engenharia — Pilares e vigas"),
    MEM.dado("Perímetro da laje do pav. 1", cp.pav1.perimetroLoje, "m", "bloco Laje Pav. 1"),
    MEM.conta("Tábuas de 3 m, com 10% de perda", "(pilaretes × 0,60 × 2 + perímetro da laje × 2) ÷ 3 × 1,10", [["pilaretes", c.colunas25], ["perímetro da laje", cp.pav1.perimetroLoje]], tabuas30Bruto, "tábuas"),
    MEM.teto(tabuas30Bruto, tabuas30, "tábuas de 3 m", "Arredonda para cima (tábua inteira)"),
  ] });
  emitir(out, { ...base, item: "Madeira Caixaria - Sarrafos de 05cm x 3mts", unidade: "Barras 3 mts", qtd: sarrafo5, memoria: [
    MEM.nota("Gravatas dos pilaretes (uma a cada 50 cm) mais as gravatas e escoras da fôrma da viga de respaldo, que acompanha o perímetro da laje."),
    MEM.dado("Pilaretes de 15 / 20 / 25 cm", c.colunas15 + c.colunas20 + c.colunas25, "pilaretes", "bloco Engenharia — Pilares e vigas"),
    MEM.dado("Perímetro da laje do pav. 1", cp.pav1.perimetroLoje, "m", "bloco Laje Pav. 1"),
    MEM.conta("Sarrafos de 3 m, com 10% de perda", "(p15 × 0,60 × 2 ÷ 0,50 × 0,20 + p20 × 0,60 × 2 ÷ 0,50 × 0,25 + p25 × 0,60 × 2 ÷ 0,50 × 0,35 + perímetro × 2 ÷ 0,70 × 0,45 + perímetro ÷ 0,75 × 0,30) × 1,10 ÷ 3",
      [["p15", c.colunas15], ["p20", c.colunas20], ["p25", c.colunas25], ["perímetro", cp.pav1.perimetroLoje]], sarrafo5Bruto, "sarrafos"),
    MEM.teto(sarrafo5Bruto, sarrafo5, "sarrafos de 3 m", "Arredonda para cima (sarrafo inteiro)"),
  ] });
  emitir(out, { ...base, item: "Madeira Caixaria - Madeirite Plastif. Preto 2,10x1,10mts 18mm", unidade: "Unidade", qtd: maderites, memoria: MEMB.madeirite(c.areaFormaColunaMaior25cm, maderitesBruto, maderites) });
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
  const vigas = teto((((larg / ESP_TERCAS_VIGA) + 1) * comp) * PERDA);

  const caibVar1 = aguas === 1
    ? teto(larg * ((incl ** 2) + 1) ** 0.5)
    : teto((larg / 2) * ((incl ** 2) + 1) ** 0.5);
  let caibVar2;
  if (espCaibros5x5 === 0) caibVar2 = 0;
  else if (aguas === 1) caibVar2 = teto(((comp * 2) + 2) / 2 / espCaibros5x5);
  else caibVar2 = teto(((comp * 2) + 1) / espCaibros5x5);
  const caibros = teto((caibVar1 * caibVar2) * PERDA);

  const ripas = espRipas25x5 === 0 ? 0 : teto((larg / espRipas25x5 * comp) * PERDA);
  const apoios = espApoio === 0 ? 0 : teto((larg / espApoio * 0.51) * PERDA);

  let espigVar1 = 0, espigVar2 = 0, espigVar3 = 0;
  if (!(aguas === 1 || aguas === 2)) { espigVar1 = larg / 2; espigVar2 = larg / 2; }
  if (aguas === 3) espigVar3 = 2;
  else if (aguas === 4) espigVar3 = 4;
  const espigao = teto((((espigVar1 ** 2 + espigVar2 ** 2) ** 0.5) * espigVar3) * PERDA);

  const berco = teto((espBercos * larg * 0.5) * PERDA);
  const maoFrancesa = teto((espMaoFrancesa * larg * 0.45) * PERDA);

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
  const telhas = areaTelha === 0 ? 0 : teto((areaInclinada / areaTelha) * PERDA);
  const denomCumeeira = areaCumeeiraTelha - 0.05;
  const cumeeira = denomCumeeira === 0 ? 0 : teto((mtsCumeeira / denomCumeeira) * PERDA);
  const prego1 = teto(areaInclinada * 0.016 * PERDA);
  const prego2 = teto(areaInclinada * 0.021 * PERDA);
  const manta = teto(areaInclinada * 1.2);

  // Telhas de barro/concreto não usam rufo (perímetro zerado no original).
  if (TELHAS_BARRO_CONCRETO.includes(tipo)) perimetro1 = 0;

  return { tipo, vigas, espigao, maoFrancesa, caibros, ripas, berco, apoios, prego1, prego2, manta, areaInclinada, telhas, cumeeira, perimetro1, perimetro2 };
}

function cobertura(cp, out) {
  let vigasTotal = 0, caibrosTotal = 0, ripasTotal = 0, bercoTotal = 0, prego1Total = 0, prego2Total = 0, mantaTotal = 0;
  let perimetroTotal1 = 0, perimetroTotal2 = 0, areaCoberturaTotal = 0;
  const telhasPorTipo = {};
  const cumeeiraPorTipo = {};

  const det = [];
  for (const t of cp.coberturas) {
    if (!t || !t.tipo) continue;
    const r = calcularTelhado(t);
    det.push({ t, r });
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

  // No VBA, o rótulo do primeiro slot de telha era sobrescrito com o tipo do
  // PRIMEIRO telhado cadastrado: a linha saía com a quantidade de barro
  // português e o nome de outra telha — e o preço vinha do insumo errado.
  // Corrigido em set/2026: cada linha usa o nome da sua própria telha.
  const ORDEM_TIPOS_TELHA = Object.keys(AREA_TELHA);

  // Memória: cada telhado entra com a sua parcela (já arredondada dentro de
  // calcularTelhado) e a linha do orçamento é a soma das parcelas.
  const rotuloTelhado = (d, i) => `Telhado ${i + 1} — ${d.t.tipo}, ${numMem(d.t.comprimento)} × ${numMem(d.t.largura)} m, ${numMem(d.t.aguas)} água${numOrZero(d.t.aguas) === 1 ? "" : "s"}, inclinação ${numMem(numOrZero(d.t.inclinacao) * 100)}%`;
  const memSoma = (nota, pega, total, unidade, lista) => {
    const usa = lista || det;
    return [
      MEM.nota(nota),
      ...usa.map((d, i) => MEM.dado(rotuloTelhado(d, det.indexOf(d)), pega(d.r), unidade, "cálculo do telhado")),
      MEM.conta("Total da obra", usa.map((d) => `telhado ${det.indexOf(d) + 1}`).join(" + "), usa.map((d) => [`telhado ${det.indexOf(d) + 1}`, pega(d.r)]), total, unidade),
    ];
  };
  const base = { ordem: ORD.cobertura, tipo: "Bruto", etapa: "Cobertura", subEtapa: "Telhas" };
  for (const tipoTelha of ORDEM_TIPOS_TELHA) {
    const rotulo = tipoTelha;
    const doTipo = det.filter((d) => d.r.tipo === tipoTelha);
    emitir(out, { ...base, item: rotulo, unidade: "Unidades", qtd: telhasPorTipo[tipoTelha] || 0,
      memoria: memSoma(`Telhas de ${tipoTelha}: a área inclinada de cada telhado dividida pela área útil da peça, com 10% de quebra.`,
        (r) => r.telhas, telhasPorTipo[tipoTelha] || 0, "telhas", doTipo) });
    emitir(out, { ...base, item: `Cumeeira ${rotulo}`, unidade: "Unidades", qtd: cumeeiraPorTipo[tipoTelha] || 0,
      memoria: memSoma(`Cumeeiras de ${tipoTelha}: peças da linha de topo e dos espigões de cada telhado.`, (r) => r.cumeeira, cumeeiraPorTipo[tipoTelha] || 0, "peças", doTipo) });
  }
  emitir(out, { ...base, item: "Manta dupla face", unidade: "m2", qtd: mantaTotal, memoria: memSoma("Manta dupla face sob as telhas: a área inclinada de cada telhado, com perda.", (r) => r.manta, mantaTotal, "m²") });

  const baseMad = { ordem: ORD.cobertura, tipo: "Bruto", etapa: "Cobertura", subEtapa: "Madeiramento" };
  emitir(out, { ...baseMad, item: "Telhado - Estrutura - Eucalipto S/ Tratar - Vigas 5x15", unidade: "Mts", qtd: vigasTotal, memoria: [
    MEM.nota("Vigas 5×15: as terças (uma a cada 1,50 m ao longo da largura), mais os espigões dos telhados de 4 águas e as mãos-francesas."),
    ...det.map((d, i) => MEM.dado(rotuloTelhado(d, i), d.r.vigas + d.r.espigao + d.r.maoFrancesa, "m", "terças + espigão + mão-francesa")),
    MEM.conta("Total da obra", det.map((_, i) => `telhado ${i + 1}`).join(" + "), det.map((d, i) => [`telhado ${i + 1}`, d.r.vigas + d.r.espigao + d.r.maoFrancesa]), vigasTotal, "m"),
  ] });
  emitir(out, { ...baseMad, item: "Telhado - Estrutura - Eucalipto S/ Tratar - Caibros 5x5", unidade: "Mts", qtd: caibrosTotal, memoria: memSoma("Caibros 5×5: correm no sentido da inclinação, espaçados conforme o tipo de telha (0,50 m em barro e concreto, 1 m em fibrocimento, 1,50 m em metálica).", (r) => r.caibros, caibrosTotal, "m") });
  emitir(out, { ...baseMad, item: "Telhado - Estrutura - Eucalipto S/ Tratar - Ripas 2,5x5", unidade: "Mts", qtd: ripasTotal, memoria: memSoma("Ripas 2,5×5: só em telha de barro e concreto, espaçadas pelo passo da telha (0,34 m na portuguesa e nas de concreto, 0,30 m na americana). Fibrocimento e metálica não levam ripa.", (r) => r.ripas, ripasTotal, "m") });
  emitir(out, { ...baseMad, item: "Telhado - Estrutura - Eucalipto S/ Tratar - Vigas 5x20", unidade: "Mts", qtd: bercoTotal, memoria: [
    MEM.nota("Vigas 5×20: o berço (viga de apoio no respaldo) mais os apoios extras que fibrocimento e metálica exigem."),
    ...det.map((d, i) => MEM.dado(rotuloTelhado(d, i), d.r.berco + d.r.apoios, "m", "berço + apoios")),
    MEM.conta("Total da obra", det.map((_, i) => `telhado ${i + 1}`).join(" + "), det.map((d, i) => [`telhado ${i + 1}`, d.r.berco + d.r.apoios]), bercoTotal, "m"),
  ] });
  emitir(out, { ...baseMad, item: "Aço - Pregos 18x27", unidade: "KG", qtd: prego1Total, memoria: memSoma("Pregos 18x27 do madeiramento, proporcionais aos metros de madeira de cada telhado.", (r) => r.prego1, prego1Total, "kg") });
  emitir(out, { ...baseMad, item: "Aço - Pregos 20x42", unidade: "KG", qtd: prego2Total, memoria: memSoma("Pregos 20x42 do madeiramento (peças mais grossas), proporcionais aos metros de madeira de cada telhado.", (r) => r.prego2, prego2Total, "kg") });

  const baseCalha = { ordem: ORD.cobertura, tipo: "Bruto", etapa: "Cobertura", subEtapa: "Calha" };
  emitir(out, { ...baseCalha, item: "Telhado - Calha", unidade: "Mts", qtd: perimetroTotal2, memoria: memSoma("Calha: os metros de beiral de cada telhado que recebem calha (nos telhados de barro, a planilha zera o perímetro de rufo e conta só a calha).", (r) => r.perimetro2, perimetroTotal2, "m") });
  emitir(out, { ...baseCalha, item: "Telhado - Pingadeira", unidade: "Mts", qtd: perimetroTotal1 - perimetroTotal2, memoria: [
    MEM.nota("Pingadeira: o que sobra do perímetro do telhado depois de descontar o que já é calha."),
    MEM.conta("Perímetro total dos telhados", "soma dos telhados", [], perimetroTotal1, "m"),
    MEM.conta("Metros de calha", "soma dos telhados", [], perimetroTotal2, "m"),
    MEM.conta("Pingadeira", "perímetro − calha", [["perímetro", perimetroTotal1], ["calha", perimetroTotal2]], perimetroTotal1 - perimetroTotal2, "m"),
  ] });
  emitir(out, { ...baseCalha, item: "Telhado - Rufo", unidade: "Mts", qtd: perimetroTotal1, memoria: memSoma("Rufo: acompanha todo o perímetro do telhado.", (r) => r.perimetro1, perimetroTotal1, "m") });
}

// ═══════════════════════════════════════════════════════════════
// L_CHAPISCO_REBOCO.bas
// ═══════════════════════════════════════════════════════════════
function chapiscoReboco(cp, out) {
  const m2 = cp.m2ParedesTotal;
  const volumeChapisco = m2 * PERDA * 2 * 0.005;
  const cimentoChapisco = (volumeChapisco * 0.2 * 1200 / 50) * PERDA;
  const areiaGrossaChapiscoBruto = (volumeChapisco * 0.8) * PERDA;
  const areiaGrossaChapisco = teto(areiaGrossaChapiscoBruto);

  const volumeReboco = m2 * PERDA * 2 * 0.025;
  const cimentoReboco = (volumeReboco * 0.125 * 1200 / 50) * PERDA;
  const areiaFinaRebocoBruto = (volumeReboco * 0.875) * PERDA;
  const areiaFinaReboco = teto(areiaFinaRebocoBruto);

  const aguaTotal = ((volumeChapisco * 0.36) * PERDA) + ((volumeReboco * 0.36) * PERDA);
  const cimentoTotalBruto = cimentoChapisco + cimentoReboco;
  const cimentoTotal = teto(cimentoTotalBruto);
  const vedalitBruto = (0.3 * cimentoTotal / 18) * PERDA;
  const vedalit = teto(vedalitBruto);

  const memParedes = MEM.dado("Área total de paredes a revestir (duas faces das internas + externas)", m2, "m²", "calculado dos blocos de parede");
  const notaCamadas = MEM.nota("Duas camadas por face: chapisco de 5 mm e reboco de 25 mm. O volume já entra com 10% de perda.");
  const base = { ordem: ORD.reboco, tipo: "Bruto", etapa: "Chapisco e Reboco", subEtapa: "Chapisco e Reboco" };
  emitir(out, { ...base, item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimentoTotal, memoria: [
    notaCamadas, memParedes,
    MEM.conta("Volume de chapisco", "área × 1,10 × 2 × 0,005", [["área", m2]], volumeChapisco, "m³"),
    MEM.conta("Volume de reboco", "área × 1,10 × 2 × 0,025", [["área", m2]], volumeReboco, "m³"),
    MEM.conta("Cimento do chapisco (20% do volume, 1.200 kg/m³, saco de 50 kg)", "chapisco × 0,20 × 1.200 ÷ 50 × 1,10", [["chapisco", volumeChapisco]], cimentoChapisco, "sacos"),
    MEM.conta("Cimento do reboco (12,5% do volume)", "reboco × 0,125 × 1.200 ÷ 50 × 1,10", [["reboco", volumeReboco]], cimentoReboco, "sacos"),
    MEM.conta("Cimento total", "chapisco + reboco", [["chapisco", cimentoChapisco], ["reboco", cimentoReboco]], cimentoTotalBruto, "sacos"),
    MEM.teto(cimentoTotalBruto, cimentoTotal, "sacos de 50 kg", "Arredonda para cima (saco fechado)"),
  ] });
  emitir(out, { ...base, item: "Areia Grossa", unidade: "m3", qtd: areiaGrossaChapisco, memoria: [
    MEM.nota("Areia grossa é a do chapisco (80% do volume da camada)."),
    memParedes,
    MEM.conta("Volume de chapisco", "área × 1,10 × 2 × 0,005", [["área", m2]], volumeChapisco, "m³"),
    MEM.conta("Areia, com 10% de perda", "chapisco × 0,80 × 1,10", [["chapisco", volumeChapisco]], areiaGrossaChapiscoBruto, "m³"),
    MEM.teto(areiaGrossaChapiscoBruto, areiaGrossaChapisco, "m³", "Arredonda para cima (a areia vem em m³ inteiro)"),
  ] });
  emitir(out, { ...base, item: "Areia Fina", unidade: "m3", qtd: areiaFinaReboco, memoria: [
    MEM.nota("Areia fina é a do reboco (87,5% do volume da camada)."),
    memParedes,
    MEM.conta("Volume de reboco", "área × 1,10 × 2 × 0,025", [["área", m2]], volumeReboco, "m³"),
    MEM.conta("Areia, com 10% de perda", "reboco × 0,875 × 1,10", [["reboco", volumeReboco]], areiaFinaRebocoBruto, "m³"),
    MEM.teto(areiaFinaRebocoBruto, areiaFinaReboco, "m³", "Arredonda para cima (a areia vem em m³ inteiro)"),
  ] });
  emitir(out, { ...base, item: "Água", unidade: "m3", qtd: aguaTotal, memoria: [
    MEM.nota("Água de amassamento das duas argamassas: 0,36 m³ por m³ de massa. Não arredonda — entra como está."),
    MEM.conta("Água do chapisco", "chapisco × 0,36 × 1,10", [["chapisco", volumeChapisco]], volumeChapisco * 0.36 * PERDA, "m³"),
    MEM.conta("Água do reboco", "reboco × 0,36 × 1,10", [["reboco", volumeReboco]], volumeReboco * 0.36 * PERDA, "m³"),
    MEM.conta("Água total", "chapisco + reboco", [["chapisco", volumeChapisco * 0.36 * PERDA], ["reboco", volumeReboco * 0.36 * PERDA]], aguaTotal, "m³"),
  ] });
  emitir(out, { ...base, item: "Impermeabilizantes - Vedalit 18L", unidade: "Unidades", qtd: vedalit, memoria: [
    MEM.nota("Vedalit na massa: 0,3 litro por saco de cimento, em baldes de 18 litros."),
    MEM.dado("Cimento do chapisco e reboco", cimentoTotal, "sacos", "passo anterior"),
    MEM.conta("Baldes, com 10% de perda", "cimento × 0,30 ÷ 18 × 1,10", [["cimento", cimentoTotal]], vedalitBruto, "baldes"),
    MEM.teto(vedalitBruto, vedalit, "baldes", "Arredonda para cima (balde fechado)"),
  ] });
}

// ═══════════════════════════════════════════════════════════════
// N_CONTRAPISOS_EXTERNOS.bas
// ═══════════════════════════════════════════════════════════════
function contrapisosExternos(cp, out) {
  const pav = cp.pavimentacaoExterna;
  const perim = cp.perimetroPavimentacao;

  const areiaGrossaBruto = pav * 0.6 * 0.1 * PERDA;
  const areiaGrossa = teto(areiaGrossaBruto);
  // O VBA não arredondava esta linha — era a única "pedra" do sistema a sair
  // quebrada (8,8 m³). Corrigido em set/2026: arredonda para cima como todas
  // as outras, que é como a pedreira entrega.
  const pedraBruto = pav * 0.1 * PERDA;
  const pedra = teto(pedraBruto);
  const cimentoBruto = pedra * 6 * PERDA;
  const cimento = teto(cimentoBruto);
  const malhaPopBruto = (pav / (2.9 * 1.9)) * PERDA;
  const malhaPop = teto(malhaPopBruto);
  const tabua20Bruto = perim / 3 * PERDA;
  const tabua20 = teto(tabua20Bruto);
  const sarrafo5Bruto = perim / 0.7 * 0.3 / 3 * PERDA;
  const sarrafo5 = teto(sarrafo5Bruto);

  const cimentoMassiamBruto = pav * 0.05 * 0.25 * 1200 / 50 * PERDA;
  const cimentoMassiam = teto(cimentoMassiamBruto);
  const areiaGrossaMassiamBruto = pav * 0.05 * 0.75 * PERDA;
  const areiaGrossaMassiam = teto(areiaGrossaMassiamBruto);
  const biancoMassiamBruto = pav / 60 * PERDA;
  const biancoMassiam = teto(biancoMassiamBruto);

  const memPav = MEM.dado("Área de pavimentação externa", pav, "m²", "bloco Pavimentação externa");
  const memPerimPav = MEM.dado("Perímetro da pavimentação", perim, "m", "bloco Pavimentação externa");
  const base = { ordem: ORD.contrapisoExterno, tipo: "Bruto", etapa: "Contrapisos Externos" };
  emitir(out, { ...base, subEtapa: "Concretagem", item: "Areia Grossa", unidade: "m3", qtd: areiaGrossa, memoria: [
    MEM.nota("Contrapiso externo: 10 cm de concreto magro, traço com 60% de areia."),
    memPav,
    MEM.conta("Areia, com 10% de perda", "área × 0,60 × 0,10 × 1,10", [["área", pav]], areiaGrossaBruto, "m³"),
    MEM.teto(areiaGrossaBruto, areiaGrossa, "m³", "Arredonda para cima (a areia vem em m³ inteiro)"),
  ] });
  emitir(out, { ...base, subEtapa: "Concretagem", item: "Pedra", unidade: "m3", qtd: pedra, memoria: [
    MEM.nota("Pedra da camada de 10 cm do contrapiso externo."),
    memPav,
    MEM.conta("Pedra, com 10% de perda", "área × 0,10 × 1,10", [["área", pav]], pedraBruto, "m³"),
    MEM.teto(pedraBruto, pedra, "m³", "Arredonda para cima (a pedra vem em m³ inteiro)"),
  ] });
  emitir(out, { ...base, subEtapa: "Concretagem", item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimento, memoria: [
    MEM.dado("Pedra do contrapiso externo", pedra, "m³", "passo anterior"),
    MEM.conta("Cimento: 6 sacos por m³ de pedra, com 10% de perda", "pedra × 6 × 1,10", [["pedra", pedra]], cimentoBruto, "sacos"),
    MEM.teto(cimentoBruto, cimento, "sacos de 50 kg", "Arredonda para cima (saco fechado)"),
  ] });
  emitir(out, { ...base, subEtapa: "Concretagem", item: "Aço - Malha Pop EQ061 3.4mm 15x15", unidade: "Unidades", qtd: malhaPop, memoria: [
    MEM.nota("Tela do contrapiso externo. Cada painel tem 2,90 × 1,90 m."),
    memPav,
    MEM.conta("Painéis, com 10% de perda", "área ÷ (2,90 × 1,90) × 1,10", [["área", pav]], malhaPopBruto, "painéis"),
    MEM.teto(malhaPopBruto, malhaPop, "painéis", "Arredonda para cima (painel inteiro)"),
  ] });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Madeira Caixaria - Tábuas de 20cm x 3mts", unidade: "Unidades", qtd: tabua20, memoria: [
    MEM.nota("Fôrma da borda do contrapiso externo, contornando o perímetro em tábuas de 3 m. Rodapé e soleira não usam este perímetro."),
    memPerimPav,
    MEM.conta("Tábuas, com 10% de perda", "perímetro ÷ 3 × 1,10", [["perímetro", perim]], tabua20Bruto, "tábuas"),
    MEM.teto(tabua20Bruto, tabua20, "tábuas de 3 m", "Arredonda para cima (tábua inteira)"),
  ] });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Madeira Caixaria - Sarrafos de 05cm x 3mts", unidade: "Unidades", qtd: sarrafo5, memoria: [
    MEM.nota("Estacas que seguram a fôrma da borda, uma a cada 70 cm, com 30 cm cada."),
    memPerimPav,
    MEM.conta("Sarrafos, com 10% de perda", "perímetro ÷ 0,70 × 0,30 ÷ 3 × 1,10", [["perímetro", perim]], sarrafo5Bruto, "sarrafos"),
    MEM.teto(sarrafo5Bruto, sarrafo5, "sarrafos de 3 m", "Arredonda para cima (sarrafo inteiro)"),
  ] });
  emitir(out, { ...base, subEtapa: "Contrapisos Externos Massiamento", item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimentoMassiam, memoria: [
    MEM.nota("Massiamento: camada de 5 cm que nivela o contrapiso externo."),
    memPav,
    MEM.conta("Cimento: 25% da camada, 1.200 kg/m³, saco de 50 kg, 10% de perda", "área × 0,05 × 0,25 × 1.200 ÷ 50 × 1,10", [["área", pav]], cimentoMassiamBruto, "sacos"),
    MEM.teto(cimentoMassiamBruto, cimentoMassiam, "sacos de 50 kg", "Arredonda para cima (saco fechado)"),
  ] });
  emitir(out, { ...base, subEtapa: "Contrapisos Externos Massiamento", item: "Areia Grossa", unidade: "m3", qtd: areiaGrossaMassiam, memoria: [
    MEM.nota("Areia do massiamento: 75% da camada de 5 cm."),
    memPav,
    MEM.conta("Areia, com 10% de perda", "área × 0,05 × 0,75 × 1,10", [["área", pav]], areiaGrossaMassiamBruto, "m³"),
    MEM.teto(areiaGrossaMassiamBruto, areiaGrossaMassiam, "m³", "Arredonda para cima (a areia vem em m³ inteiro)"),
  ] });
  emitir(out, { ...base, subEtapa: "Contrapisos Externos Massiamento", item: "Impermeabilizantes - Bianco 18KG", unidade: "Unidade", qtd: biancoMassiam, memoria: [
    MEM.nota("Bianco na argamassa do massiamento: um balde de 18 kg rende 60 m²."),
    memPav,
    MEM.conta("Baldes, com 10% de perda", "área ÷ 60 × 1,10", [["área", pav]], biancoMassiamBruto, "baldes"),
    MEM.teto(biancoMassiamBruto, biancoMassiam, "baldes", "Arredonda para cima (balde fechado)"),
  ] });
}

// ═══════════════════════════════════════════════════════════════
// O_MURO_DIVISA.bas
// ═══════════════════════════════════════════════════════════════
function muroDivisa(cp, out) {
  const comp = cp.comprimentoMuroDivisa;
  const alt = cp.alturaMuroDivisa;
  const PROF_BROCAS = 4;
  const DIAM_BROCAS = 0.125;

  const numBrocas = teto(comp / 2.5);
  const perfuracao = numBrocas * PROF_BROCAS * 1.15;
  const volBrocas = (numBrocas * 3.14 * (DIAM_BROCAS ** 2) * PROF_BROCAS) * PERDA;
  const volColunas = alt * numBrocas * 0.2 * 0.25 * PERDA;
  const volVigas = comp * 2 * 0.3 * 0.2 * PERDA;
  const concreto = volBrocas + volColunas + volVigas;
  const tabuas30Bruto = ((comp * 2 / 3) + comp * 2 / 3 * 0.45 / 3) * 2 * PERDA;
  const tabuas30 = teto(tabuas30Bruto);
  const sarrafo5Bruto = ((comp * 2 / 0.7 * 0.45) + (comp / 0.75 * 0.3)) / 3 * PERDA;
  const sarrafo5 = teto(sarrafo5Bruto);
  const ferro5Bruto = ((PROF_BROCAS / 0.15 * DIAM_BROCAS * 2 * PERDA * numBrocas) + (alt / 0.15 * 0.9 * PERDA * numBrocas) + (comp / 0.15 * 1 * PERDA)) / 12 * PERDA;
  const ferro5 = teto(ferro5Bruto);
  const ferro8Bruto = ((numBrocas * PROF_BROCAS * 3 * PERDA) + (alt * 4 * numBrocas * PERDA) + (comp * 2 * 4 * PERDA)) / 12 * PERDA;
  const ferro8 = teto(ferro8Bruto);
  const pesoFerroMuro = (ferro5 * PERDA * PESOS_FERRO.CA50_5MM) + (ferro8 * PERDA * PESOS_FERRO.CA50_8MM);
  const arameBruto = 0.06 * pesoFerroMuro;
  const arame = teto(arameBruto);
  const pregoBruto = 0.55 * arame;
  const prego = teto(pregoBruto);

  const areaMuro = comp * alt * PERDA;
  const volChapisco = areaMuro * PERDA * 2 * 0.005;
  const volReboco = areaMuro * PERDA * 2 * 0.025;
  const tijolosBruto = areaMuro * 46.458 * PERDA;
  const tijolos = teto(tijolosBruto);
  const areiaFinaAssent = tijolos * 0.002223 * PERDA;
  const areiaFinaReboco = volReboco * 0.875 * PERDA;
  const areiaFinaTotalBruto = areiaFinaAssent + areiaFinaReboco;
  const areiaFinaTotal = teto(areiaFinaTotalBruto);
  const areiaGrossaChapisco = volChapisco * 0.8 * PERDA;
  const agua = ((volChapisco * 0.36) + (volReboco * 0.36)) * PERDA;
  const vedalitBruto = (areiaFinaTotal / 25) * PERDA;
  const vedalit = teto(vedalitBruto);
  const cimentoChapisco = (0.2 * volChapisco * 1200 / 50) * PERDA;
  const cimentoReboco = (0.125 * volReboco * 1200 / 50) * PERDA;
  const cimentoAssentamento = areiaFinaAssent * 2 * PERDA;
  const cimentoTotalBruto = cimentoChapisco + cimentoReboco + cimentoAssentamento;
  const cimentoTotal = teto(cimentoTotalBruto);
  const vedatopBruto = ((0.3 * comp) * 3 / 10) * PERDA + (comp * 3 / 18) * PERDA;
  const vedatop = teto(vedatopBruto);

  const memMuro = [MEM.dado("Comprimento do muro de divisa", comp, "m", "bloco Muro de divisa"), MEM.dado("Altura do muro", alt, "m", "bloco Muro de divisa")];
  const memBrocas = MEM.conta("Brocas: uma a cada 2,50 m", "comprimento ÷ 2,50 → arredonda para cima", [["comprimento", comp]], numBrocas, "brocas");
  const base = { ordem: ORD.muroDivisa, tipo: "Bruto", etapa: "Muro Divisa" };
  emitir(out, { ...base, subEtapa: "Muros", item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimentoTotal, memoria: [
    MEM.nota("Cimento do muro: soma do chapisco (20% do volume), do reboco (12,5%) e do assentamento dos tijolos (2 sacos por m³ de areia). Massa a 1.200 kg/m³, saco de 50 kg."),
    MEM.conta("Área do muro, com 10% de perda", "comprimento × altura × 1,10", [["comprimento", comp], ["altura", alt]], areaMuro, "m²"),
    MEM.conta("Cimento do chapisco", "0,20 × volume de chapisco × 1.200 ÷ 50 × 1,10", [["volume de chapisco", volChapisco]], cimentoChapisco, "sacos"),
    MEM.conta("Cimento do reboco", "0,125 × volume de reboco × 1.200 ÷ 50 × 1,10", [["volume de reboco", volReboco]], cimentoReboco, "sacos"),
    MEM.conta("Cimento do assentamento", "areia do assentamento × 2 × 1,10", [["areia do assentamento", areiaFinaAssent]], cimentoAssentamento, "sacos"),
    MEM.conta("Cimento total", "chapisco + reboco + assentamento", [["chapisco", cimentoChapisco], ["reboco", cimentoReboco], ["assentamento", cimentoAssentamento]], cimentoTotalBruto, "sacos"),
    MEM.teto(cimentoTotalBruto, cimentoTotal, "sacos de 50 kg", "Arredonda para cima (saco fechado)"),
  ] });
  emitir(out, { ...base, subEtapa: "Muros", item: "Areia fina", unidade: "m3", qtd: areiaFinaTotal, memoria: [
    MEM.nota("Areia fina do muro: a do assentamento dos tijolos mais a do reboco."),
    MEM.dado("Tijolos do muro", tijolos, "tijolos", "passo dos tijolos"),
    MEM.conta("Areia do assentamento", "tijolos × 0,002223 × 1,10", [["tijolos", tijolos]], areiaFinaAssent, "m³"),
    MEM.conta("Areia do reboco", "volume de reboco × 0,875 × 1,10", [["volume de reboco", volReboco]], areiaFinaReboco, "m³"),
    MEM.conta("Areia fina total", "assentamento + reboco", [["assentamento", areiaFinaAssent], ["reboco", areiaFinaReboco]], areiaFinaTotalBruto, "m³"),
    MEM.teto(areiaFinaTotalBruto, areiaFinaTotal, "m³", "Arredonda para cima (a areia vem em m³ inteiro)"),
  ] });
  emitir(out, { ...base, subEtapa: "Muros", item: "Areia Grossa", unidade: "m3", qtd: areiaGrossaChapisco, memoria: [
    MEM.nota("Areia grossa é a do chapisco do muro (80% do volume da camada). Não arredonda — a planilha original deixa o número cheio."),
    MEM.conta("Volume de chapisco (5 mm nas duas faces)", "área do muro × 1,10 × 2 × 0,005", [["área do muro", areaMuro]], volChapisco, "m³"),
    MEM.conta("Areia, com 10% de perda", "volume de chapisco × 0,80 × 1,10", [["volume de chapisco", volChapisco]], areiaGrossaChapisco, "m³"),
  ] });
  emitir(out, { ...base, subEtapa: "Muros", item: "Água", unidade: "m3", qtd: agua, memoria: [
    MEM.nota("Água de amassamento: 0,36 m³ por m³ de argamassa, chapisco e reboco somados."),
    MEM.conta("Água", "(chapisco × 0,36 + reboco × 0,36) × 1,10", [["chapisco", volChapisco], ["reboco", volReboco]], agua, "m³"),
  ] });
  emitir(out, { ...base, subEtapa: "Perfuração", item: "Maquinário - Perfuração", unidade: "Mts", qtd: perfuracao, memoria: [
    MEM.nota("Brocas do muro: 4 m de profundidade cada, com 15% de folga de perfuração (refugo do trado e retrabalho)."),
    ...memMuro, memBrocas,
    MEM.conta("Metros perfurados", "brocas × 4 × 1,15", [["brocas", numBrocas]], perfuracao, "m"),
  ] });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Madeira Caixaria - Tábuas de 30cm x 3mts", unidade: "Barras 3mts", qtd: tabuas30, memoria: [
    MEM.nota("Fôrma das vigas de baldrame e respaldo do muro — duas vigas, cada uma com duas laterais ao longo do comprimento."),
    ...memMuro,
    MEM.conta("Tábuas de 3 m, com 10% de perda", "(comprimento × 2 ÷ 3 + comprimento × 2 ÷ 3 × 0,45 ÷ 3) × 2 × 1,10", [["comprimento", comp]], tabuas30Bruto, "tábuas"),
    MEM.teto(tabuas30Bruto, tabuas30, "tábuas de 3 m", "Arredonda para cima (tábua inteira)"),
  ] });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Madeira Caixaria - Sarrafos de 05cm x 3mts", unidade: "Barras 3mts", qtd: sarrafo5, memoria: [
    MEM.nota("Gravatas a cada 70 cm e escoras a cada 75 cm da fôrma do muro."),
    ...memMuro,
    MEM.conta("Sarrafos de 3 m, com 10% de perda", "(comprimento × 2 ÷ 0,70 × 0,45 + comprimento ÷ 0,75 × 0,30) ÷ 3 × 1,10", [["comprimento", comp]], sarrafo5Bruto, "sarrafos"),
    MEM.teto(sarrafo5Bruto, sarrafo5, "sarrafos de 3 m", "Arredonda para cima (sarrafo inteiro)"),
  ] });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Aço - Arame Recozido", unidade: "KG", qtd: arame, memoria: [
    MEM.nota("Arame para amarrar as armaduras do muro: 0,06 kg por quilo de ferro."),
    MEM.conta("Peso do ferro do muro", "(barras 5 mm × 1,10 × 1,92 + barras 8 mm × 1,10 × 4,80)", [["barras 5 mm", ferro5], ["barras 8 mm", ferro8]], pesoFerroMuro, "kg"),
    MEM.conta("Arame", "peso × 0,06", [["peso", pesoFerroMuro]], arameBruto, "kg"),
    MEM.teto(arameBruto, arame, "kg"),
  ] });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Aço - Pregos 18x27", unidade: "KG", qtd: prego, memoria: MEMB.pregoDoArame(arame, pregoBruto, prego) });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Aço - Barras de CA50 5.0mm 12mts", unidade: "Barras 12mts", qtd: ferro5, memoria: [
    MEM.nota("Ferro de 5 mm do muro: estribos das brocas (a cada 15 cm, dois ramos de 12,5 cm de diâmetro), estribos das colunas (a cada 15 cm, 0,90 m cada) e estribos das vigas (a cada 15 cm, 1 m cada)."),
    ...memMuro, memBrocas,
    MEM.conta("Barras de 12 m, com 10% de perda", "(4 ÷ 0,15 × 0,125 × 2 × 1,10 × brocas + altura ÷ 0,15 × 0,90 × 1,10 × brocas + comprimento ÷ 0,15 × 1 × 1,10) ÷ 12 × 1,10",
      [["brocas", numBrocas], ["altura", alt], ["comprimento", comp]], ferro5Bruto, "barras"),
    MEM.teto(ferro5Bruto, ferro5, "barras", "Arredonda para cima (barra inteira)"),
  ] });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Aço - Barras de CA50 8.0mm 12mts", unidade: "Barras 12mts", qtd: ferro8, memoria: [
    MEM.nota("Ferro de 8 mm do muro: as barras longitudinais — 3 por broca, 4 por coluna e 4 em cada uma das duas vigas."),
    ...memMuro, memBrocas,
    MEM.conta("Barras de 12 m, com 10% de perda", "(brocas × 4 × 3 × 1,10 + altura × 4 × brocas × 1,10 + comprimento × 2 × 4 × 1,10) ÷ 12 × 1,10",
      [["brocas", numBrocas], ["altura", alt], ["comprimento", comp]], ferro8Bruto, "barras"),
    MEM.teto(ferro8Bruto, ferro8, "barras", "Arredonda para cima (barra inteira)"),
  ] });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Concreto - FCK20", unidade: "m3", qtd: concreto, memoria: [
    MEM.nota("Concreto do muro: brocas + colunas + duas vigas. Não arredonda — entra como está."),
    ...memMuro, memBrocas,
    MEM.conta("Volume das brocas", "brocas × 3,14 × 0,125² × 4 × 1,10", [["brocas", numBrocas]], volBrocas, "m³"),
    MEM.conta("Volume das colunas (20 × 25 cm)", "altura × brocas × 0,20 × 0,25 × 1,10", [["altura", alt], ["brocas", numBrocas]], volColunas, "m³"),
    MEM.conta("Volume das vigas (30 × 20 cm, duas)", "comprimento × 2 × 0,30 × 0,20 × 1,10", [["comprimento", comp]], volVigas, "m³"),
    MEM.conta("Concreto total", "brocas + colunas + vigas", [["brocas", volBrocas], ["colunas", volColunas], ["vigas", volVigas]], concreto, "m³"),
  ] });
  emitir(out, { ...base, subEtapa: "Impermeabilização", item: "Impermeabilizantes - Vedatop 18KG", unidade: "Unidades", qtd: vedatop, memoria: [
    MEM.nota("Impermeabilização da base do muro: faixa de 30 cm com 3 kg/m² (rendimento 10) mais a pintura do baldrame (rendimento 18)."),
    ...memMuro,
    MEM.conta("Baldes, com 10% de perda", "(0,30 × comprimento × 3 ÷ 10 + comprimento × 3 ÷ 18) × 1,10", [["comprimento", comp]], vedatopBruto, "baldes"),
    MEM.teto(vedatopBruto, vedatop, "baldes", "Arredonda para cima (balde fechado)"),
  ] });
  emitir(out, { ...base, subEtapa: "Paredes", item: "Cerâmicas - Tijolo - Bloco 8 Furos", unidade: "Unidades", qtd: tijolos, memoria: [
    MEM.nota("Muro em bloco de 8 furos assentado de forma a dar 46,458 tijolos por m² (medida da planilha do escritório)."),
    ...memMuro,
    MEM.conta("Área do muro, com 10% de perda", "comprimento × altura × 1,10", [["comprimento", comp], ["altura", alt]], areaMuro, "m²"),
    MEM.conta("Tijolos, com 10% de quebra", "área × 46,458 × 1,10", [["área", areaMuro]], tijolosBruto, "tijolos"),
    MEM.teto(tijolosBruto, tijolos, "tijolos"),
  ] });
  emitir(out, { ...base, subEtapa: "Paredes", item: "Impermeabilizantes - Vedalit 18L", unidade: "Unidades", qtd: vedalit, memoria: MEMB.vedalitAssentamento(areiaFinaTotal, vedalitBruto, vedalit) });
}

// ═══════════════════════════════════════════════════════════════
// Q_MURO_ARRIMO.bas (Sub MURO_DE_CONTENCAO no original)
// ═══════════════════════════════════════════════════════════════
function muroArrimo(cp, out) {
  const a = cp.arrimo;

  const tijolos8FBruto = (a.altura * a.comprimento * 40) * PERDA;
  const tijolos8F = teto(tijolos8FBruto);
  const areiaFinaAssentBruto = tijolos8F * 0.002223 * PERDA;
  const areiaFinaAssent = teto(areiaFinaAssentBruto);
  const vedalitFinaAssentBruto = areiaFinaAssent / 25 * PERDA;
  const vedalitFinaAssent = teto(vedalitFinaAssentBruto);
  const cimentoFinaAssentBruto = areiaFinaAssent * 2 * PERDA;
  const cimentoFinaAssent = teto(cimentoFinaAssentBruto);

  const tabuas15ColunBruto = a.colunas15 * 2.8 * 2 / 3 * PERDA;
  const tabuas15Colun = teto(tabuas15ColunBruto);
  const tabuas20ColunBruto = a.colunas20 * 2.8 * 2 / 3 * PERDA;
  const tabuas20Colun = teto(tabuas20ColunBruto);
  const tabuas30ColunBruto = a.colunas30 * 2.8 * 2 / 3 * PERDA;
  const tabuas30Colun = teto(tabuas30ColunBruto);
  const sarrafo5ColunBruto =
    ((a.colunas15 * 2.8 * 2 / 0.5 * 0.2) +
      (a.colunas20 * 2.8 * 2 / 0.5 * 0.25) +
      (a.colunas30 * 2.8 * 2 / 0.5 * 0.35)) * PERDA / 3;
  const sarrafo5Colun = teto(sarrafo5ColunBruto);
  const maderitesColunBruto = a.areaFormaColunaMaior25cm / 2.42 * PERDA;
  const maderitesColun = teto(maderitesColunBruto);

  const tabuas30ArrimoBruto = ((a.comprimento * 2 / 3) + a.comprimento * 2 / 3 * 0.45 / 3) * a.numeroVigas * PERDA;
  const tabuas30Arrimo = teto(tabuas30ArrimoBruto);
  const sarrafo5ArrimoBruto = ((a.comprimento * 2 / 0.7 * 0.45) + (a.comprimento / 0.75 * 0.3)) / 3 * a.numeroVigas * PERDA;
  const sarrafo5Arrimo = teto(sarrafo5ArrimoBruto);
  const perfuracaoEstacas = a.qtdEstacas * a.profEstacas * 1.15;

  const soma = somarFerro(a.ferro.estacas, a.ferro.sapatas, a.ferro.arranques, a.ferro.baldrame, a.ferro.gigante, a.ferro.colunas, a.ferro.vigas);
  const barras = barrasPorBitola(soma);
  const peso = pesoTotalFerro(barras);
  const partesConcretoArrimo = [["estacas", a.concreto.estacas], ["sapatas", a.concreto.sapatas], ["arranques", a.concreto.arranques], ["baldrame", a.concreto.baldrame], ["gigante", a.concreto.gigante], ["colunas", a.concreto.colunas], ["vigas", a.concreto.vigas]].filter(([, v]) => numOrZero(v) > 0);
  const concretoBruto = somaN(a.concreto.estacas, a.concreto.sapatas, a.concreto.arranques, a.concreto.baldrame, a.concreto.gigante, a.concreto.colunas, a.concreto.vigas) * PERDA;
  const concreto = teto(concretoBruto);

  const discoFerroBruto = peso * 0.01;
  const discoFerro = teto(discoFerroBruto);
  const arameBruto = peso * 0.06;
  const arame = teto(arameBruto);
  const pregoBruto = 0.55 * arame;
  const prego = teto(pregoBruto);
  const vedatopBruto = ((a.altura * a.comprimento) * 3 * PERDA) / 18;
  const vedatop = teto(vedatopBruto);

  const tabuas30Total = tabuas30Arrimo + tabuas30Colun;
  const sarrafo5Total = sarrafo5Arrimo + sarrafo5Colun;

  const memArrimo = [MEM.dado("Comprimento do muro de arrimo", a.comprimento, "m", "bloco Muro de arrimo"), MEM.dado("Altura do muro de arrimo", a.altura, "m", "bloco Muro de arrimo")];
  const memPesoArrimo = [
    MEM.nota("Disco e arame saem do peso do ferro comprado (barras inteiras × peso por barra)."),
    MEM.conta("Peso do ferro do arrimo", "soma das bitolas", [], peso, "kg"),
  ];
  const base = { ordem: ORD.muroArrimo, tipo: "Bruto", etapa: "Muro Arrimo" };
  emitir(out, { ...base, subEtapa: "Assentamento", item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimentoFinaAssent, memoria: MEMB.cimentoAssentamento(areiaFinaAssent, cimentoFinaAssentBruto, cimentoFinaAssent) });
  emitir(out, { ...base, subEtapa: "Assentamento", item: "Areia fina", unidade: "m3", qtd: areiaFinaAssent, memoria: [
    MEM.nota("Argamassa de assentamento do arrimo: 0,002223 m³ de areia por tijolo de 8 furos."),
    MEM.dado("Tijolos do arrimo", tijolos8F, "tijolos", "passo dos tijolos"),
    MEM.conta("Areia, com 10% de perda", "tijolos × 0,002223 × 1,10", [["tijolos", tijolos8F]], areiaFinaAssentBruto, "m³"),
    MEM.teto(areiaFinaAssentBruto, areiaFinaAssent, "m³", "Arredonda para cima (a areia vem em m³ inteiro)"),
  ] });
  emitir(out, { ...base, subEtapa: "Perfuração", item: "Maquinário - Perfuração", unidade: "Mts", qtd: perfuracaoEstacas, memoria: [
    MEM.nota("Metros perfurados das estacas do arrimo, com 15% de folga de perfuração."),
    MEM.dado("Quantidade de estacas", a.qtdEstacas, "estacas", "bloco Muro de arrimo"),
    MEM.dado("Profundidade de cada estaca", a.profEstacas, "m", "bloco Muro de arrimo"),
    MEM.conta("Metros perfurados", "estacas × profundidade × 1,15", [["estacas", a.qtdEstacas], ["profundidade", a.profEstacas]], perfuracaoEstacas, "m"),
  ] });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Madeira Caixaria - Tábuas de 20cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas15Colun, memoria: MEMB.tabuaColuna("do arrimo", 15, a.colunas15, tabuas15ColunBruto, tabuas15Colun) });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Madeira Caixaria - Tábuas de 25cm x 3mts", unidade: "Barras 3 mts", qtd: tabuas20Colun, memoria: MEMB.tabuaColuna("do arrimo", 20, a.colunas20, tabuas20ColunBruto, tabuas20Colun) });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Madeira Caixaria - Tábuas de 30cm x 3mts", unidade: "Barras 3mts", qtd: tabuas30Total, memoria: [
    MEM.nota("Tábuas de 30 cm somam duas fôrmas: a das vigas do arrimo (uma por viga, ao longo do comprimento) e a das colunas de 30 cm."),
    ...memArrimo,
    MEM.dado("Número de vigas do arrimo", a.numeroVigas, "vigas", "bloco Muro de arrimo"),
    MEM.conta("Tábuas das vigas", "(comprimento × 2 ÷ 3 + comprimento × 2 ÷ 3 × 0,45 ÷ 3) × vigas × 1,10 → arredonda", [["comprimento", a.comprimento], ["vigas", a.numeroVigas]], tabuas30Arrimo, "tábuas"),
    MEM.conta("Tábuas das colunas de 30 cm", "colunas × 2,80 × 2 ÷ 3 × 1,10 → arredonda", [["colunas", a.colunas30]], tabuas30Colun, "tábuas"),
    MEM.conta("Total de tábuas de 30 cm", "vigas + colunas", [["vigas", tabuas30Arrimo], ["colunas", tabuas30Colun]], tabuas30Total, "tábuas de 3 m"),
  ] });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Madeira Caixaria - Sarrafos de 05cm x 3mts", unidade: "Barras 3mts", qtd: sarrafo5Total, memoria: [
    MEM.nota("Sarrafos somam as gravatas e escoras das vigas do arrimo e as gravatas das colunas."),
    ...memArrimo,
    MEM.conta("Sarrafos das vigas", "(comprimento × 2 ÷ 0,70 × 0,45 + comprimento ÷ 0,75 × 0,30) ÷ 3 × vigas × 1,10 → arredonda", [["comprimento", a.comprimento], ["vigas", a.numeroVigas]], sarrafo5Arrimo, "sarrafos"),
    MEM.conta("Sarrafos das colunas", "(c15 × 2,80 × 2 ÷ 0,50 × 0,20 + c20 × … + c30 × …) × 1,10 ÷ 3 → arredonda", [["c15", a.colunas15], ["c20", a.colunas20], ["c30", a.colunas30]], sarrafo5Colun, "sarrafos"),
    MEM.conta("Total de sarrafos", "vigas + colunas", [["vigas", sarrafo5Arrimo], ["colunas", sarrafo5Colun]], sarrafo5Total, "sarrafos de 3 m"),
  ] });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Madeira Caixaria - Madeirite Plastif. Preto 2,10x1,10mts 18mm", unidade: "Unidades", qtd: maderitesColun, memoria: MEMB.madeirite(a.areaFormaColunaMaior25cm, maderitesColunBruto, maderitesColun) });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Disco Ferro", unidade: "Unidades", qtd: discoFerro, memoria: [
    ...memPesoArrimo,
    MEM.conta("Discos de corte", "peso × 0,01", [["peso", peso]], discoFerroBruto, "discos"),
    MEM.teto(discoFerroBruto, discoFerro, "discos"),
  ] });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Aço - Arame Recozido", unidade: "KG", qtd: arame, memoria: [
    ...memPesoArrimo,
    MEM.conta("Arame", "peso × 0,06", [["peso", peso]], arameBruto, "kg"),
    MEM.teto(arameBruto, arame, "kg"),
  ] });
  emitir(out, { ...base, subEtapa: "Caixaria", item: "Aço - Pregos 18x27", unidade: "KG", qtd: prego, memoria: MEMB.pregoDoArame(arame, pregoBruto, prego) });
  emitBarras(out, { ...base, subEtapa: "Supra Estrutura" }, barras, (k) => memoriaBitola(k, [["estacas", a.ferro.estacas[k]], ["sapatas", a.ferro.sapatas[k]], ["arranques", a.ferro.arranques[k]], ["baldrame", a.ferro.baldrame[k]], ["gigante", a.ferro.gigante[k]], ["colunas", a.ferro.colunas[k]], ["vigas", a.ferro.vigas[k]]], barras));
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: a.resistenciaConcreto || "Concreto", unidade: "m3", qtd: concreto, memoria: [
    MEM.nota(`Concreto do arrimo lançado no bloco Muro de arrimo, elemento por elemento. Resistência: ${a.resistenciaConcreto || "Concreto"}.`),
    ...partesConcretoArrimo.map(([nome, v]) => MEM.dado(nome[0].toUpperCase() + nome.slice(1), v, "m³", "bloco Muro de arrimo")),
    MEM.conta("Volume com 10% de perda", `(${partesConcretoArrimo.map(([nome]) => nome).join(" + ")}) × 1,10`, partesConcretoArrimo, concretoBruto, "m³"),
    MEM.teto(concretoBruto, concreto, "m³", "Arredonda para cima (a usina entrega em m³ inteiro)"),
  ] });
  emitir(out, { ...base, subEtapa: "Impermeabilização", item: "Impermeabilizantes - Vedatop 18KG", unidade: "Unidades", qtd: vedatop, memoria: [
    MEM.nota("Impermeabilização da face de terra do arrimo: 3 kg por m², balde de 18 kg."),
    ...memArrimo,
    MEM.conta("Baldes, com 10% de perda", "altura × comprimento × 3 × 1,10 ÷ 18", [["altura", a.altura], ["comprimento", a.comprimento]], vedatopBruto, "baldes"),
    MEM.teto(vedatopBruto, vedatop, "baldes", "Arredonda para cima (balde fechado)"),
  ] });
  emitir(out, { ...base, subEtapa: "Paredes", item: "Cerâmicas - Tijolo - Bloco 8 Furos", unidade: "Unidades", qtd: tijolos8F, memoria: [
    MEM.nota("Fechamento do arrimo em bloco de 8 furos: 40 tijolos por m² de muro."),
    ...memArrimo,
    MEM.conta("Tijolos, com 10% de quebra", "altura × comprimento × 40 × 1,10", [["altura", a.altura], ["comprimento", a.comprimento]], tijolos8FBruto, "tijolos"),
    MEM.teto(tijolos8FBruto, tijolos8F, "tijolos"),
  ] });
  emitir(out, { ...base, subEtapa: "Paredes", item: "Impermeabilizantes - Vedalit 18L", unidade: "Unidades", qtd: vedalitFinaAssent, memoria: MEMB.vedalitAssentamento(areiaFinaAssent, vedalitFinaAssentBruto, vedalitFinaAssent) });
}

// ═══════════════════════════════════════════════════════════════
// R_PISCINA.bas
// ═══════════════════════════════════════════════════════════════
function piscina(cp, out) {
  const p = cp.piscina;

  const tabua10MarcacaoBruto = p.gabaritoObra / 3 * 1.2;
  const tabua10Marcacao = teto(tabua10MarcacaoBruto);
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
  const sarrafo5Marcacao = teto((p.gabaritoObra * 1.2 / 1.3 * 0.6 / 3) + 20);
  const prego18x27MarcacaoBruto = 0.05 * tabua10Marcacao / 2;
  const prego18x27Marcacao = teto(prego18x27MarcacaoBruto);
  const prego17x21Marcacao = prego18x27Marcacao;

  const perfuracaoEstacas = p.qtdEstacas * p.profundidadeEstacas * 1.15;

  const pedraContrapBruto = p.areaConstruida * 0.1 * PERDA;
  const pedraContrap = teto(pedraContrapBruto);
  const cimentoContrap = teto(pedraContrap * 6 * PERDA);
  const malhaPopContrapBruto = p.areaConstruida / (2.9 * 1.9 * PERDA);
  const malhaPopContrap = teto(malhaPopContrapBruto);
  const areiaGrossaContrap = teto(p.areaConstruida * 0.6 * 0.1 * PERDA);

  const tijolinhoMacicoBruto = p.paredesM2Total * 84.2 * PERDA;
  const tijolinhoMacico = teto(tijolinhoMacicoBruto);
  const areiaFinaAssent = teto(tijolinhoMacico * 0.0291 * PERDA);
  const cimentoFinaAssent = teto(areiaFinaAssent * 2 * PERDA);

  const tabuas15ColunBruto = p.colunas15 * p.profundidade * 2 / 3 * PERDA;
  const tabuas15Colun = teto(tabuas15ColunBruto);
  const tabuas20ColunBruto = p.colunas20 * p.profundidade * 2 / 3 * PERDA;
  const tabuas20Colun = teto(tabuas20ColunBruto);
  const tabuas30Colun = teto(p.colunas25 * p.profundidade * 2 / 3 * PERDA);
  const QTD_NUMERO_VIGAS_PISCINA = 3;
  const tabuas30Vigas = teto(((p.perimetroParedes * 2 / 3) + p.perimetroParedes * 2 / 3 * 0.45 / 3) * QTD_NUMERO_VIGAS_PISCINA * PERDA);
  const tabuas30Total = tabuas30Colun + tabuas30Vigas;

  const sarrafo5Colun = teto(
    ((p.colunas15 * p.profundidade * 2 / 0.5 * 0.2) +
      (p.colunas20 * p.profundidade * 2 / 0.5 * 0.25) +
      (p.colunas25 * p.profundidade * 2 / 0.5 * 0.35)) * PERDA / 3
  );
  const sarrafo5Vigas = teto(((p.perimetroParedes * 2 / 0.7 * 0.45) + (p.perimetroParedes / 0.75 * 0.3)) / 3 * QTD_NUMERO_VIGAS_PISCINA * PERDA);
  const sarrafo5Total = sarrafo5Colun + sarrafo5Vigas + sarrafo5Marcacao;

  const maderitesColunBruto = p.areaFormaColunaMaior25cm / 2.42 * PERDA;
  const maderitesColun = teto(maderitesColunBruto);

  const soma = somarFerro(p.ferro.estacas, p.ferro.sapatas, p.ferro.arranques, p.ferro.baldrame, p.ferro.contrapiso, p.ferro.colunas, p.ferro.vigas);
  const barras = barrasPorBitola(soma);
  const peso = pesoTotalFerro(barras);
  const partesConcPisc = [["estacas", p.concreto.estacas], ["sapatas", p.concreto.sapatas], ["arranques", p.concreto.arranques], ["baldrame", p.concreto.baldrame], ["contrapiso", p.concreto.contrapiso], ["colunas", p.concreto.colunas], ["vigas", p.concreto.vigas]].filter(([, v]) => numOrZero(v) > 0);
  const concretoBruto = somaN(p.concreto.estacas, p.concreto.sapatas, p.concreto.arranques, p.concreto.baldrame, p.concreto.contrapiso, p.concreto.colunas, p.concreto.vigas) * PERDA;
  const concreto = teto(concretoBruto);

  const discoFerroBruto = peso * 0.01;
  const discoFerro = teto(discoFerroBruto);
  const arameBruto = peso * 0.06;
  const arame = teto(arameBruto);
  const prego18x27Bruto = (0.55 * arame) + prego18x27Marcacao;
  const prego18x27 = teto(prego18x27Bruto);

  const vedatopBaldrames = teto((((p.perimetroParedes * 2 * 0.3) + (p.perimetroParedes * 0.15)) * 3 * PERDA) / 18);
  const vedatopParedesContrapiso = teto(((p.paredesM2Total + p.areaConstruida) * 3 * PERDA) / 18);
  const vedatopTotal = vedatopBaldrames + vedatopParedesContrapiso;
  const telaPoliesterBruto = (p.paredesM2Total + p.areaConstruida) * PERDA;
  const telaPoliester = teto(telaPoliesterBruto);

  const volumeChapisco = p.paredesM2Total * PERDA * 2 * 0.005;
  const cimentoChapisco = (volumeChapisco * 0.2 * 1200 / 50) * PERDA;
  const areiaGrossaChapisco = teto((volumeChapisco * 0.8) * PERDA);
  const aguaChapisco = (volumeChapisco * 0.36) * PERDA;

  const volumeReboco = p.paredesM2Total * PERDA * 2 * 0.025;
  const cimentoReboco = (volumeReboco * 0.125 * 1200 / 50) * PERDA;
  const areiaFinaReboco = teto((volumeReboco * 0.875) * PERDA);
  const aguaReboco = (volumeReboco * 0.36) * PERDA;

  const cimentoMassiamentoPiso = teto(p.areaConstruida * 0.05 * 0.25 * 1200 / 50 * PERDA);
  const areiaGrossaMassiamentoPiso = teto(p.areaConstruida * 0.05 * 0.75 * PERDA);

  const cimentoTotalBruto = cimentoContrap + cimentoFinaAssent + cimentoChapisco + cimentoReboco;
  const cimentoTotal = teto(cimentoTotalBruto);
  const aguaTotal = aguaChapisco + aguaReboco;
  const vedalitBruto = (0.3 * cimentoTotal / 18) * PERDA;
  const vedalit = teto(vedalitBruto);
  const areiaGrossaTotal = areiaGrossaContrap + areiaGrossaChapisco + areiaGrossaMassiamentoPiso;
  const areiaFinaTotal = areiaFinaAssent + areiaFinaReboco;

  const revestimentoBruto = p.paredesM2Total + p.areaConstruida * 1.2;
  const revestimento = teto(revestimentoBruto);
  const rejuntesBruto = revestimento * 0.095 / 5 * PERDA;
  const rejuntes = teto(rejuntesBruto);
  const argamassasBruto = revestimento * 7.5 / 20 * PERDA;
  const argamassas = teto(argamassasBruto);
  const discoPorcelanatoBruto = revestimento * 0.005 * PERDA;
  const discoPorcelanato = teto(discoPorcelanatoBruto);

  const memPiscina = [
    MEM.dado("Área construída da piscina (fundo)", p.areaConstruida, "m²", "bloco Piscina"),
    MEM.dado("Paredes da piscina", p.paredesM2Total, "m²", "bloco Piscina"),
  ];
  const memTabuaPiscina = (larguraCm, colunas, bruto, valor) => [
    MEM.nota("Fôrma das colunas da piscina, com a altura igual à profundidade da piscina."),
    MEM.dado(`Colunas de ${larguraCm} cm`, colunas, "colunas", "bloco Piscina"),
    MEM.dado("Profundidade da piscina", p.profundidade, "m", "bloco Piscina"),
    MEM.conta("Tábuas de 3 m, com 10% de perda", "colunas × profundidade × 2 ÷ 3 × 1,10", [["colunas", colunas], ["profundidade", p.profundidade]], bruto, "tábuas"),
    MEM.teto(bruto, valor, "tábuas de 3 m", "Arredonda para cima (tábua inteira)"),
  ];
  const base = { ordem: ORD.piscina, tipo: "Bruto", etapa: "Piscina" };
  emitir(out, { ...base, subEtapa: "Brocas", item: "Maquinário - Perfuração", unidade: "Mts", qtd: perfuracaoEstacas, memoria: [
    MEM.nota("Metros perfurados das estacas da piscina, com 15% de folga de perfuração."),
    MEM.dado("Quantidade de estacas", p.qtdEstacas, "estacas", "bloco Piscina"),
    MEM.dado("Profundidade de cada estaca", p.profundidadeEstacas, "m", "bloco Piscina"),
    MEM.conta("Metros perfurados", "estacas × profundidade × 1,15", [["estacas", p.qtdEstacas], ["profundidade", p.profundidadeEstacas]], perfuracaoEstacas, "m"),
  ] });
  emitir(out, { ...base, subEtapa: "Contrapiso", item: "Locação Ferramentas -  Compactador", unidade: "Unidades", qtd: 2, memoria: MEM_CANTEIRO("Dois dias de compactador para apiloar o fundo da cava antes de concretar o contrapiso da piscina.") });
  emitir(out, { ...base, subEtapa: "Contrapiso", item: "Pedra", unidade: "m3", qtd: pedraContrap, memoria: [
    MEM.nota("Contrapiso do fundo da piscina: 10 cm de concreto."),
    ...memPiscina,
    MEM.conta("Pedra, com 10% de perda", "área × 0,10 × 1,10", [["área", p.areaConstruida]], pedraContrapBruto, "m³"),
    MEM.teto(pedraContrapBruto, pedraContrap, "m³", "Arredonda para cima (a pedra vem em m³ inteiro)"),
  ] });
  emitir(out, { ...base, subEtapa: "Paredes", item: "Cerâmicas - Tijolo - Tijolinho Maciço", unidade: "Unidades", qtd: tijolinhoMacico, memoria: [
    MEM.nota("Parede da piscina em tijolinho maciço: 84,2 tijolos por m² (medida da planilha do escritório)."),
    ...memPiscina,
    MEM.conta("Tijolos, com 10% de quebra", "paredes × 84,2 × 1,10", [["paredes", p.paredesM2Total]], tijolinhoMacicoBruto, "tijolos"),
    MEM.teto(tijolinhoMacicoBruto, tijolinhoMacico, "tijolos"),
  ] });
  emitir(out, { ...base, subEtapa: "Diversas", item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimentoTotal, memoria: [
    MEM.nota("Cimento da piscina numa linha só: contrapiso, assentamento dos tijolinhos, chapisco e reboco."),
    MEM.conta("Cimento do contrapiso", "pedra × 6 × 1,10 → arredonda", [["pedra", pedraContrap]], cimentoContrap, "sacos"),
    MEM.conta("Cimento do assentamento", "areia do assentamento × 2 × 1,10 → arredonda", [["areia do assentamento", areiaFinaAssent]], cimentoFinaAssent, "sacos"),
    MEM.conta("Cimento do chapisco", "volume de chapisco × 0,20 × 1.200 ÷ 50 × 1,10", [["volume de chapisco", volumeChapisco]], cimentoChapisco, "sacos"),
    MEM.conta("Cimento do reboco", "volume de reboco × 0,125 × 1.200 ÷ 50 × 1,10", [["volume de reboco", volumeReboco]], cimentoReboco, "sacos"),
    MEM.conta("Cimento total", "contrapiso + assentamento + chapisco + reboco", [["contrapiso", cimentoContrap], ["assentamento", cimentoFinaAssent], ["chapisco", cimentoChapisco], ["reboco", cimentoReboco]], cimentoTotalBruto, "sacos"),
    MEM.teto(cimentoTotalBruto, cimentoTotal, "sacos de 50 kg", "Arredonda para cima (saco fechado)"),
  ] });
  emitir(out, { ...base, subEtapa: "Diversas", item: "Água", unidade: "m3", qtd: aguaTotal, memoria: [
    MEM.nota("Água de amassamento do chapisco e do reboco da piscina: 0,36 m³ por m³ de massa. Não arredonda."),
    MEM.conta("Água do chapisco", "volume de chapisco × 0,36 × 1,10", [["volume de chapisco", volumeChapisco]], aguaChapisco, "m³"),
    MEM.conta("Água do reboco", "volume de reboco × 0,36 × 1,10", [["volume de reboco", volumeReboco]], aguaReboco, "m³"),
    MEM.conta("Água total", "chapisco + reboco", [["chapisco", aguaChapisco], ["reboco", aguaReboco]], aguaTotal, "m³"),
  ] });
  emitir(out, { ...base, subEtapa: "Diversas", item: "Impermeabilizantes - Vedalit 18L", unidade: "Unidades", qtd: vedalit, memoria: [
    MEM.nota("Vedalit na massa da piscina: 0,3 litro por saco de cimento, em baldes de 18 litros."),
    MEM.dado("Cimento total da piscina", cimentoTotal, "sacos", "passo anterior"),
    MEM.conta("Baldes, com 10% de perda", "cimento × 0,30 ÷ 18 × 1,10", [["cimento", cimentoTotal]], vedalitBruto, "baldes"),
    MEM.teto(vedalitBruto, vedalit, "baldes", "Arredonda para cima (balde fechado)"),
  ] });
  emitir(out, { ...base, subEtapa: "Diversas", item: "Areia Grossa", unidade: "m3", qtd: areiaGrossaTotal, memoria: [
    MEM.nota("Areia grossa da piscina numa linha só: contrapiso, chapisco e massiamento do piso. Cada parcela já vem arredondada."),
    MEM.conta("Areia do contrapiso", "área × 0,60 × 0,10 × 1,10 → arredonda", [["área", p.areaConstruida]], areiaGrossaContrap, "m³"),
    MEM.conta("Areia do chapisco", "volume de chapisco × 0,80 × 1,10 → arredonda", [["volume de chapisco", volumeChapisco]], areiaGrossaChapisco, "m³"),
    MEM.conta("Areia do massiamento do piso", "área × 0,05 × 0,75 × 1,10 → arredonda", [["área", p.areaConstruida]], areiaGrossaMassiamentoPiso, "m³"),
    MEM.conta("Areia grossa total", "contrapiso + chapisco + massiamento", [["contrapiso", areiaGrossaContrap], ["chapisco", areiaGrossaChapisco], ["massiamento", areiaGrossaMassiamentoPiso]], areiaGrossaTotal, "m³"),
  ] });
  emitir(out, { ...base, subEtapa: "Diversas", item: "Areia Fina", unidade: "m3", qtd: areiaFinaTotal, memoria: [
    MEM.nota("Areia fina da piscina: a do assentamento dos tijolinhos mais a do reboco."),
    MEM.conta("Areia do assentamento", "tijolinhos × 0,0291 × 1,10 → arredonda", [["tijolinhos", tijolinhoMacico]], areiaFinaAssent, "m³"),
    MEM.conta("Areia do reboco", "volume de reboco × 0,875 × 1,10 → arredonda", [["volume de reboco", volumeReboco]], areiaFinaReboco, "m³"),
    MEM.conta("Areia fina total", "assentamento + reboco", [["assentamento", areiaFinaAssent], ["reboco", areiaFinaReboco]], areiaFinaTotal, "m³"),
  ] });
  emitir(out, { ...base, subEtapa: "Impermeabilização", item: "Impermeabilizantes - Vedatop Flexível 18KG", unidade: "Unidades", qtd: vedatopTotal, memoria: [
    MEM.nota("Impermeabilização da piscina: baldrames (faixa de 30 cm nas duas faces mais 15 cm de topo) e toda a superfície molhada (paredes + fundo), a 3 kg/m², balde de 18 kg."),
    ...memPiscina,
    MEM.dado("Perímetro das paredes da piscina", p.perimetroParedes, "m", "bloco Piscina"),
    MEM.conta("Baldes dos baldrames", "(perímetro × 2 × 0,30 + perímetro × 0,15) × 3 × 1,10 ÷ 18 → arredonda", [["perímetro", p.perimetroParedes]], vedatopBaldrames, "baldes"),
    MEM.conta("Baldes das paredes e do fundo", "(paredes + fundo) × 3 × 1,10 ÷ 18 → arredonda", [["paredes", p.paredesM2Total], ["fundo", p.areaConstruida]], vedatopParedesContrapiso, "baldes"),
    MEM.conta("Total", "baldrames + paredes e fundo", [["baldrames", vedatopBaldrames], ["paredes e fundo", vedatopParedesContrapiso]], vedatopTotal, "baldes"),
  ] });
  emitir(out, { ...base, subEtapa: "Impermeabilização", item: "Impermeabilizantes - Tela Poliester 50mts", unidade: "Unidades", qtd: telaPoliester, memoria: [
    MEM.nota("Tela de poliéster que estrutura a impermeabilização, sobre toda a superfície molhada."),
    ...memPiscina,
    MEM.conta("Metros, com 10% de perda", "(paredes + fundo) × 1,10", [["paredes", p.paredesM2Total], ["fundo", p.areaConstruida]], telaPoliesterBruto, "m"),
    MEM.teto(telaPoliesterBruto, telaPoliester, "m"),
  ] });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Madeira Caixaria - Tábuas de 10cm x 3mts", unidade: "Unidades", qtd: tabua10Marcacao, memoria: [
    MEM.nota("Gabarito de marcação da piscina, igual ao da casa: cavalete de tábuas em volta da cava."),
    MEM.dado("Gabarito da obra da piscina", p.gabaritoObra, "m", "bloco Piscina"),
    MEM.conta("Tábuas de 3 m, com 20% de emendas", "gabarito ÷ 3 × 1,20", [["gabarito", p.gabaritoObra]], tabua10MarcacaoBruto, "tábuas"),
    MEM.teto(tabua10MarcacaoBruto, tabua10Marcacao, "tábuas de 3 m", "Arredonda para cima (tábua inteira)"),
  ] });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Madeira Caixaria - Tábuas de 20cm x 3mts", unidade: "Unidades", qtd: tabuas15Colun, memoria: memTabuaPiscina(15, p.colunas15, tabuas15ColunBruto, tabuas15Colun) });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Madeira Caixaria - Tábuas de 25cm x 3mts", unidade: "Unidades", qtd: tabuas20Colun, memoria: memTabuaPiscina(20, p.colunas20, tabuas20ColunBruto, tabuas20Colun) });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Madeira Caixaria - Tábuas de 30cm x 3mts", unidade: "Unidades", qtd: tabuas30Total, memoria: [
    MEM.nota("Tábuas de 30 cm somam a fôrma das colunas de 25 cm e a das três vigas que cintam a piscina."),
    MEM.dado("Perímetro das paredes da piscina", p.perimetroParedes, "m", "bloco Piscina"),
    MEM.conta("Tábuas das colunas", "colunas × profundidade × 2 ÷ 3 × 1,10 → arredonda", [["colunas", p.colunas25], ["profundidade", p.profundidade]], tabuas30Colun, "tábuas"),
    MEM.conta("Tábuas das 3 vigas", "(perímetro × 2 ÷ 3 + perímetro × 2 ÷ 3 × 0,45 ÷ 3) × 3 × 1,10 → arredonda", [["perímetro", p.perimetroParedes]], tabuas30Vigas, "tábuas"),
    MEM.conta("Total", "colunas + vigas", [["colunas", tabuas30Colun], ["vigas", tabuas30Vigas]], tabuas30Total, "tábuas de 3 m"),
  ] });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Madeira Caixaria - Madeirite Plastif. Preto 2,10x1,10mts 18mm", unidade: "Unidades", qtd: maderitesColun, memoria: MEMB.madeirite(p.areaFormaColunaMaior25cm, maderitesColunBruto, maderitesColun) });
  emitir(out, { ...base, subEtapa: "Contrapiso", item: "Aço - Malha pop EQ092 4.2mm 15x15", unidade: "Unidades", qtd: malhaPopContrap, memoria: [
    MEM.nota("Tela do contrapiso da piscina. Painel de 2,90 × 1,90 m; a perda entra dividindo (as telas se sobrepõem)."),
    ...memPiscina,
    MEM.conta("Painéis", "área ÷ (2,90 × 1,90 × 1,10)", [["área", p.areaConstruida]], malhaPopContrapBruto, "painéis"),
    MEM.teto(malhaPopContrapBruto, malhaPopContrap, "painéis", "Arredonda para cima (painel inteiro)"),
  ] });
  emitBarras(out, { ...base, subEtapa: "Supra Estrutura" }, barras, (k) => memoriaBitola(k, [["estacas", p.ferro.estacas[k]], ["sapatas", p.ferro.sapatas[k]], ["arranques", p.ferro.arranques[k]], ["baldrame", p.ferro.baldrame[k]], ["contrapiso", p.ferro.contrapiso[k]], ["colunas", p.ferro.colunas[k]], ["vigas", p.ferro.vigas[k]]], barras));
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: p.resistenciaConcreto || "Concreto", unidade: "m3", qtd: concreto, memoria: [
    MEM.nota(`Concreto da piscina lançado no bloco Piscina, elemento por elemento. Resistência: ${p.resistenciaConcreto || "Concreto"}.`),
    ...partesConcPisc.map(([nome, v]) => MEM.dado(nome[0].toUpperCase() + nome.slice(1), v, "m³", "bloco Piscina")),
    MEM.conta("Volume com 10% de perda", `(${partesConcPisc.map(([nome]) => nome).join(" + ")}) × 1,10`, partesConcPisc, concretoBruto, "m³"),
    MEM.teto(concretoBruto, concreto, "m³", "Arredonda para cima (a usina entrega em m³ inteiro)"),
  ] });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Disco Ferro", unidade: "Unidades", qtd: discoFerro, memoria: [
    MEM.nota("Disco de corte do ferro da piscina: 0,01 por quilo de ferro comprado."),
    MEM.conta("Peso do ferro da piscina", "soma das bitolas", [], peso, "kg"),
    MEM.conta("Discos", "peso × 0,01", [["peso", peso]], discoFerroBruto, "discos"),
    MEM.teto(discoFerroBruto, discoFerro, "discos"),
  ] });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Aço - Arame Recozido", unidade: "Kg", qtd: arame, memoria: [
    MEM.nota("Arame para amarrar as armaduras da piscina: 0,06 kg por quilo de ferro."),
    MEM.conta("Peso do ferro da piscina", "soma das bitolas", [], peso, "kg"),
    MEM.conta("Arame", "peso × 0,06", [["peso", peso]], arameBruto, "kg"),
    MEM.teto(arameBruto, arame, "kg"),
  ] });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Aço - Pregos 18x27", unidade: "Kg", qtd: prego18x27, memoria: [
    MEM.nota("Pregos 18x27 da piscina: os da fôrma (proporcionais ao arame) mais os do gabarito de marcação."),
    MEM.conta("Pregos da fôrma", "arame × 0,55", [["arame", arame]], 0.55 * arame, "kg"),
    MEM.dado("Pregos do gabarito", prego18x27Marcacao, "kg", "passo do gabarito"),
    MEM.conta("Total", "fôrma + gabarito", [["fôrma", 0.55 * arame], ["gabarito", prego18x27Marcacao]], prego18x27Bruto, "kg"),
    MEM.teto(prego18x27Bruto, prego18x27, "kg"),
  ] });
  emitir(out, { ...base, subEtapa: "Supra Estrutura", item: "Aço - Pregos 17x21", unidade: "Kg", qtd: prego17x21Marcacao, memoria: [
    MEM.nota("Pregos 17x21: a outra metade do consumo do gabarito de marcação da piscina."),
    MEM.dado("Tábuas de 10 cm do gabarito", tabua10Marcacao, "tábuas", "passo do gabarito"),
    MEM.conta("Pregos", "tábuas × 0,05 ÷ 2", [["tábuas", tabua10Marcacao]], prego18x27MarcacaoBruto, "kg"),
    MEM.teto(prego18x27MarcacaoBruto, prego17x21Marcacao, "kg"),
  ] });
  emitir(out, { ...base, tipo: "Acabamento", subEtapa: "Revestimento", item: "Revestimento", unidade: "m2", qtd: revestimento, memoria: [
    MEM.nota("Revestimento da piscina: as paredes inteiras mais o fundo com 20% a mais (recortes em volta dos dispositivos e do ralo)."),
    ...memPiscina,
    MEM.conta("Área a revestir", "paredes + fundo × 1,20", [["paredes", p.paredesM2Total], ["fundo", p.areaConstruida]], revestimentoBruto, "m²"),
    MEM.teto(revestimentoBruto, revestimento, "m²"),
  ] });
  emitir(out, { ...base, tipo: "Acabamento", subEtapa: "Revestimento", item: "Rejunte - 5kg", unidade: "Unidades", qtd: rejuntes, memoria: [
    MEM.nota("Rejunte da pastilha da piscina: 0,095 kg por m², embalagem de 5 kg."),
    MEM.dado("Área revestida", revestimento, "m²", "passo anterior"),
    MEM.conta("Embalagens, com 10% de perda", "área × 0,095 ÷ 5 × 1,10", [["área", revestimento]], rejuntesBruto, "embalagens"),
    MEM.teto(rejuntesBruto, rejuntes, "embalagens de 5 kg", "Arredonda para cima (embalagem fechada)"),
  ] });
  emitir(out, { ...base, tipo: "Acabamento", subEtapa: "Revestimento", item: "Argamassa AC 3 GF - 20kg", unidade: "Unidades", qtd: argamassas, memoria: [
    MEM.nota("Argamassa AC-III (área submersa): 7,5 kg por m², saco de 20 kg."),
    MEM.dado("Área revestida", revestimento, "m²", "passo anterior"),
    MEM.conta("Sacos, com 10% de perda", "área × 7,5 ÷ 20 × 1,10", [["área", revestimento]], argamassasBruto, "sacos"),
    MEM.teto(argamassasBruto, argamassas, "sacos de 20 kg", "Arredonda para cima (saco fechado)"),
  ] });
  emitir(out, { ...base, tipo: "Acabamento", subEtapa: "Revestimento", item: "Disco Porcelanato", unidade: "Unidades", qtd: discoPorcelanato, memoria: [
    MEM.nota("Disco de corte das peças da piscina: 0,005 por m² revestido."),
    MEM.dado("Área revestida", revestimento, "m²", "passo do revestimento"),
    MEM.conta("Discos, com 10% de perda", "área × 0,005 × 1,10", [["área", revestimento]], discoPorcelanatoBruto, "discos"),
    MEM.teto(discoPorcelanatoBruto, discoPorcelanato, "discos"),
  ] });
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
      if (a.porMetro) saida.push({ codigo: a.codigo, descricao: a.descricao, unidade: "Unidades", qtd: teto(m / a.porMetro) });
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
      saida.push({ item: `Alumínio ${e.linha} - ${p.codigo} - ${p.perfil}`, codigo: p.codigo, unidade: "Barras 6mts", qtd: teto(barras), subEtapa: rotulo });
      continue;
    }
    const metros = metrosPorRegra(p.regra, L, H, e.folhas);
    if (metros === 0 && avisos) avisos.push({ tipo: "esquadria_regra", mensagem: `Regra "${p.regra}" não reconhecida em ${p.codigo}`, esquadria: e });
    if (!(metros > 0)) continue;
    if (p.kgPorMetro != null) {
      saida.push({ item: `Alumínio ${e.linha} - ${p.codigo} - ${p.perfil}`, codigo: p.codigo, unidade: "Kg", qtd: Math.round(metros * p.kgPorMetro * q * 100) / 100, subEtapa: rotulo });
    } else {
      // sem peso na aba (ex.: GUA483 mata térmica, vende em rolo) → metros lineares
      saida.push({ item: `${p.perfil} - ${p.codigo}`, codigo: p.codigo, unidade: "Mts", qtd: teto(metros * q), subEtapa: rotulo });
    }
  }
  // vidro: pela regra de desconto da família, por peça
  const vidro = vidroEsquadria(e.familia, L, H, e.folhas).area * q;
  if (vidro > 0) saida.push({ item: "Vidro 8mm", unidade: "m2", qtd: Math.round(vidro * 100) / 100, subEtapa: rotulo });
  // acessórios: contagem por esquadria/folha ou metros de perímetro
  for (const a of acessoriosEsquadria(e.familia, L, H, e.folhas)) {
    const qtd = a.unidade === "Mts" ? teto(a.qtd * q) : a.qtd * q;
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
      memoria: [
        MEM.nota(`Esquadria cadastrada no bloco Esquadrias. A quantidade é a que você digitou; o preço unitário é fechado pelo VICKE somando os perfis de alumínio da linha ${linha ? linha.nome : e.linha}, o vidro e os acessórios — a lista completa aparece na composição do item, na própria tabela.`),
        MEM.dado("Medidas da peça", `${numMem(e.largura)} × ${numMem(e.altura)} m, ${numMem(e.folhas)} folha${numOrZero(e.folhas) === 1 ? "" : "s"}`, "", "bloco Esquadrias"),
        MEM.dado("Componentes que formam o preço", composicao.length, "itens", "catálogo de perfis da linha"),
        MEM.dado("Quantidade no orçamento", numOrZero(e.qtd), "unidades", "bloco Esquadrias"),
      ],
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
  revestimentoExterno: { MCMV: "Piso - Externo cerâmico padrão Baixo", Baixo: "Piso - Externo cerâmico padrão Baixo", Médio: "Revestimento - Porcelanato parede padrão Médio", Alto: "Revestimento - Porcelanato parede padrão Alto", Altíssimo: "Revestimento - Porcelanato parede padrão Altíssimo" },
};
// Formato padrão quando não informado (peça cresce com o padrão)
const FORMATO_PADRAO = { pisoInterno: { MCMV: "45x45", Baixo: "45x45", Médio: "60x60", Alto: "90x90", Altíssimo: "120x120" },
  pisoExterno: { MCMV: "45x45", Baixo: "45x45", Médio: "60x60", Alto: "60x60", Altíssimo: "90x90" },
  revestimentoInterno: { MCMV: "30x60", Baixo: "30x60", Médio: "30x60", Alto: "45x90", Altíssimo: "60x120" },
  revestimentoExterno: { MCMV: "30x60", Baixo: "30x60", Médio: "30x60", Alto: "45x90", Altíssimo: "60x120" } };
const RODAPE_ALTURA_M = 0.10; // rodapé = recorte do próprio piso interno, 10 cm, somado ao m² do piso
// Pedras (granito de bancada e soleira) por padrão da obra — item genérico da
// semente (REV-067…076); o quantitativo mostra só "Granito padrão X" /
// "Soleira padrão X". Produto digitado na bancada/soleira continua vencendo.
const GRANITO_GENERICOS = { MCMV: "Granito padrão MCMV", Baixo: "Granito padrão Baixo", Médio: "Granito padrão Médio", Alto: "Granito padrão Alto", Altíssimo: "Granito padrão Altíssimo" };
const SOLEIRA_GENERICOS = { MCMV: "Soleira padrão MCMV", Baixo: "Soleira padrão Baixo", Médio: "Soleira padrão Médio", Alto: "Soleira padrão Alto", Altíssimo: "Soleira padrão Altíssimo" };
const granitoPadrao = (padrao) => GRANITO_GENERICOS[padrao] || GRANITO_GENERICOS["Médio"];
const soleiraPadrao = (padrao) => SOLEIRA_GENERICOS[padrao] || SOLEIRA_GENERICOS["Médio"];
const SOLEIRA_LARGURA_M = 0.15;
// Bancadas de granito/mármore: cada bancada vira m² de pedra pronta — tampo
// (comprimento × profundidade), saia (frente, altura em cm), fundo/rodabanca
// (encosto na parede, altura em cm) e sapatas (apoios sob o tampo,
// quantidade × profundidade × largura em cm). A marmoraria cobra as tiras
// como m² de pedra; não há perda porque a peça vem pronta.
const BANCADA_PADRAO = { nome: "", comprimento: "", profundidade: 0.60, saiaCm: 5, fundoCm: 10, sapatas: 2, sapataCm: 10, produto: "" };
const BANCADAS_MAX = 20;
// Ilha: comprimento = parede mais comprida do cômodo menos esta folga (m)
const ILHA_FOLGA_M = 1;
function medirBancada(b) {
  const C = numOrZero(b.comprimento), P = numOrZero(b.profundidade);
  const tampo = C * P;
  const r2i = (x) => Math.round(x * 100) / 100;
  // Ilha: solta no meio do ambiente, sem parede atrás. As quatro faces são de
  // pedra (perímetro × altura da saia) e já sustentam o tampo — sem fundo
  // (rodabanca) e sem sapatas.
  if (b.ilha) {
    const laterais = 2 * (C + P) * numOrZero(b.saiaCm) / 100;
    return { tampo: r2i(tampo), laterais: r2i(laterais), total: r2i(tampo + laterais) };
  }
  const saia = C * numOrZero(b.saiaCm) / 100;
  const fundo = C * numOrZero(b.fundoCm) / 100;
  const sapatas = numOrZero(b.sapatas) * P * numOrZero(b.sapataCm) / 100;
  const total = tampo + saia + fundo + sapatas;
  const r2 = (x) => Math.round(x * 100) / 100;
  return { tampo: r2(tampo), saia: r2(saia), fundo: r2(fundo), sapatas: r2(sapatas), total: r2(total) };
}
const PERDA_PECAS = 1.2; // peças cerâmicas (piso e revestimento): 20% de recortes e quebras; consumíveis seguem os 10% gerais
const ARGAMASSA_KG_M2 = { AC3: 7.5, AC2: 4.5 };
const REJUNTE_DENSIDADE = 1600, REJUNTE_FATOR = 1.5;

// Arredonda para cima ignorando o ruído de ponto flutuante: 150 × 40 × 1,1
// dá 6600.000000000001 em JavaScript, e Math.ceil viraria 6601 tijolos. A
// tolerância de 1e-9 é milhões de vezes menor que qualquer quantidade real
// de obra, então só apaga o ruído — nunca um centésimo de verdade.
function teto(x) { return Math.ceil(x - 1e-9); }
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

// ── Cômodos: medidas, revestimento e bancada por cômodo ─────────
// Cada cômodo da obra tem medidas de partida por tamanho (Grande/Médio/
// Pequeno/Compacta) — a mesma tabela COMODOS do orçamento de projetos
// (shared.jsx) — e regras de acabamento: quais paredes recebem
// revestimento e se há bancada. O usuário pode abrir o cômodo e editar
// comprimento, largura, pé-direito, revestimento e bancada
// (projeto.comodosCfg[id]); o que não for editado segue o tamanho escolhido.
// Revestimento "todas": todas as paredes do piso ao pé-direito menos a
// porta. Bancada: fração do lado mais comprido (padrão metade).
const TAMANHOS_COMODOS = ["Grande", "Médio", "Pequeno", "Compacta"];
const PE_DIREITO_PADRAO = 2.8;
const PORTA_M2 = 0.8 * 2.1, PORTA_LARGURA = 0.8;
const REVESTIR_OPCOES = [
  { value: "todas", label: "Todas as paredes (até o pé-direito)" },
  { value: "meia", label: "Meia parede (1,50 m)" },
  { value: "maior", label: "Só a parede mais comprida" },
  { value: "nenhuma", label: "Sem revestimento" },
];
// Regras de acabamento por cômodo (medidas: COMODOS[nome] do orçamento de
// projetos, pelo tamanho). Molhados: todas as paredes revestidas e bancada
// na metade da parede mais comprida; secos: rodapé.
// Fração da parede mais comprida ocupada pela bancada: 100% nas áreas de
// trabalho (cozinha, lavanderia, área de lazer/gourmet — a bancada corre a
// parede inteira) e 50% nos lavabos e WCs. Editável cômodo a cômodo.
const COMODO_OBRA_PROJETO = {
  garagem:       { revestir: "nenhuma" },
  hallEntrada:   { revestir: "nenhuma", rodape: true },
  salaTV:        { revestir: "nenhuma", rodape: true },
  living:        { revestir: "nenhuma", rodape: true },
  salaJantar:    { revestir: "nenhuma", rodape: true },
  escritorio:    { revestir: "nenhuma", rodape: true },
  lavabo:        { revestir: "todas", bancada: { fracao: 0.5, profundidade: 0.45 } },
  cozinha:       { revestir: "todas", bancada: { fracao: 1, profundidade: 0.6, ilha: true } },
  lavanderia:    { revestir: "todas", bancada: { fracao: 1, profundidade: 0.6 } },
  deposito:      { revestir: "nenhuma" },
  areaLazer:     { revestir: "maior", bancada: { fracao: 1, profundidade: 0.6, ilha: true } },
  lavaboLazer:   { revestir: "todas", bancada: { fracao: 0.5, profundidade: 0.45 } },
  sauna:         { revestir: "nenhuma" },
  academia:      { revestir: "nenhuma", rodape: true },
  brinquedoteca: { revestir: "nenhuma", rodape: true },
  louceiro:      { revestir: "nenhuma", rodape: true },
  jardim:        { revestir: "nenhuma", semMedidas: true },
  dormitorio:    { revestir: "nenhuma", rodape: true },
  closet:        { revestir: "nenhuma", rodape: true },
  wcSuiteMaster: { revestir: "todas", bancada: { fracao: 0.5, profundidade: 0.5 }, medidas: "WC", tamanhoMais: 1 }, // um tamanho acima do WC
  wcSuite:       { revestir: "todas", bancada: { fracao: 0.5, profundidade: 0.5 }, medidas: "WC" },
  wc:            { revestir: "todas", bancada: { fracao: 0.5, profundidade: 0.5 } },
  suite:         { revestir: "nenhuma", rodape: true },
  closetSuite:   { revestir: "nenhuma", rodape: true },
  suiteMaster:   { revestir: "nenhuma", rodape: true },
  escada:        { revestir: "nenhuma" },
};
// Contagem de cômodos com ids antigos → atuais (projetos gravados antes)
function migrarAmbientes(ambientes) {
  const mapa = typeof AMBIENTES_MIGRACAO !== "undefined" ? AMBIENTES_MIGRACAO : {};
  const out = {};
  for (const [k, v] of Object.entries(ambientes || {})) {
    const id = mapa[k] || k;
    const n = numOrZero(v);
    if (!n && !(id in out)) { out[id] = out[id] || v; continue; }
    out[id] = numOrZero(out[id]) + n;
  }
  return out;
}
const NOME_AMBIENTE = (id) => { const t = (typeof AMBIENTES_TIPOS !== "undefined" ? AMBIENTES_TIPOS : []).find((a) => a.id === id); return t ? t.nome : id; };
// Medidas de partida do cômodo pelo tamanho da obra
function comodoPadrao(id, tamanho) {
  const regra = COMODO_OBRA_PROJETO[id] || { revestir: "nenhuma" };
  const comodos = typeof COMODOS !== "undefined" ? COMODOS : {};
  const cfg = regra.semMedidas ? null : comodos[regra.medidas || NOME_AMBIENTE(id)];
  // tamanhoMais: um degrau acima na escala Grande > Médio > Pequeno > Compacta
  const idx = Math.max(0, TAMANHOS_COMODOS.indexOf(tamanho) - (regra.tamanhoMais || 0));
  const [L, W] = (cfg && cfg.medidas && cfg.medidas[TAMANHOS_COMODOS[idx]]) || [0, 0];
  return { L, W, peDireito: PE_DIREITO_PADRAO, revestir: regra.revestir, temBancada: !!regra.bancada, bancadaFracao: regra.bancada ? regra.bancada.fracao : 0.5, bancadaProfundidade: regra.bancada ? regra.bancada.profundidade : 0.6,
    permiteIlha: !!(regra.bancada && regra.bancada.ilha), temIlha: false,
    saiaCm: BANCADA_PADRAO.saiaCm, fundoCm: BANCADA_PADRAO.fundoCm, sapatas: BANCADA_PADRAO.sapatas, sapataCm: BANCADA_PADRAO.sapataCm, rodape: !!regra.rodape };
}
// Configuração efetiva: padrão do tamanho + edições do usuário
function comodoConfig(projeto, id) {
  const p = projeto || {};
  const tamanho = TAMANHOS_COMODOS.includes(p.tamanhoComodos) ? p.tamanhoComodos : "Médio";
  const base = comodoPadrao(id, tamanho);
  const cfgs = p.comodosCfg || {};
  let o = cfgs[id];
  if (!o) { // edição gravada com id antigo
    const mapa = typeof AMBIENTES_MIGRACAO !== "undefined" ? AMBIENTES_MIGRACAO : {};
    for (const [antigo, novo] of Object.entries(mapa)) if (novo === id && cfgs[antigo]) { o = cfgs[antigo]; break; }
  }
  o = o || {};
  const num = (v, d) => (v === "" || v == null || !Number.isFinite(Number(v)) ? d : Number(v));
  return {
    L: num(o.L, base.L), W: num(o.W, base.W), peDireito: num(o.peDireito, base.peDireito),
    revestir: REVESTIR_OPCOES.some((r) => r.value === o.revestir) ? o.revestir : base.revestir,
    temBancada: o.temBancada == null ? base.temBancada : !!o.temBancada,
    bancadaFracao: num(o.bancadaFracao, base.bancadaFracao), bancadaProfundidade: num(o.bancadaProfundidade, base.bancadaProfundidade),
    permiteIlha: base.permiteIlha, temIlha: base.permiteIlha && (o.temIlha == null ? base.temIlha : !!o.temIlha),
    saiaCm: num(o.saiaCm, base.saiaCm), fundoCm: num(o.fundoCm, base.fundoCm), sapatas: num(o.sapatas, base.sapatas), sapataCm: num(o.sapataCm, base.sapataCm),
    rodape: base.rodape, editado: Object.keys(o).length > 0, tamanho,
  };
}
// Quantidades de um cômodo (unitárias)
function calcularComodo(cfg) {
  const L = numOrZero(cfg.L), W = numOrZero(cfg.W), pd = numOrZero(cfg.peDireito) || PE_DIREITO_PADRAO;
  const area = L * W, perimetro = 2 * (L + W), maior = Math.max(L, W);
  let revestimento = 0;
  if (L > 0 && W > 0) {
    if (cfg.revestir === "todas") revestimento = Math.max(0, perimetro * pd - PORTA_M2);
    else if (cfg.revestir === "meia") revestimento = perimetro * 1.5;
    else if (cfg.revestir === "maior") revestimento = maior * pd;
  }
  const r2 = (x) => Math.round(x * 100) / 100;
  const bancada = cfg.temBancada && maior > 0
    ? { comprimento: r2(maior * numOrZero(cfg.bancadaFracao)), profundidade: numOrZero(cfg.bancadaProfundidade), saiaCm: numOrZero(cfg.saiaCm), fundoCm: numOrZero(cfg.fundoCm), sapatas: numOrZero(cfg.sapatas), sapataCm: numOrZero(cfg.sapataCm) }
    : null;
  const medida = bancada ? medirBancada(bancada) : null;
  // Ilha (cozinha e área de lazer): 1 m mais curta que a parede mais comprida
  const ilha = cfg.temIlha && maior > ILHA_FOLGA_M
    ? { comprimento: r2(maior - ILHA_FOLGA_M), profundidade: numOrZero(cfg.bancadaProfundidade), saiaCm: numOrZero(cfg.saiaCm), ilha: true }
    : null;
  const medidaIlha = ilha ? medirBancada(ilha) : null;
  return { area: r2(area), perimetro: r2(perimetro), revestimento: r2(revestimento), bancada, ilha, ilhaPartes: medidaIlha,
    bancadaM2: r2((medida ? medida.total : 0) + (medidaIlha ? medidaIlha.total : 0)), bancadaPartes: medida, rodape: cfg.rodape ? r2(Math.max(0, perimetro - PORTA_LARGURA)) : 0 };
}
// Vãos para vergas/contravergas, automáticos: portas internas (1 por cômodo
// com kit de porta, 0,80 m, só verga) + esquadrias (portas externas 1 verga;
// janelas, maxim-ar e fixos verga + contraverga). O VBA lia um "vão de
// portas e janelas" digitado e fazia treliça = vão × 2 / 12; aqui o campo
// deixa de existir e o motor entrega o vão equivalente (metros de verga ÷ 2)
// para a mesma fórmula. Sobrado: reparte pelo m² de parede de cada pavimento.
function vaosAutomaticos(projeto) {
  const p = projeto || {};
  const tipos = typeof AMBIENTES_TIPOS !== "undefined" ? AMBIENTES_TIPOS : [];
  const amb = migrarAmbientes(p.ambientes || {});
  let portasInternas = 0;
  for (const t of tipos) if (((t.kits || {}).PORTAS || []).length) portasInternas += Math.max(0, Math.round(numOrZero(amb[t.id])));
  let metrosPortasExternas = 0, metrosJanelas = 0;
  for (const e of (Array.isArray(p.esquadrias) ? p.esquadrias : [])) {
    const m = numOrZero(e && e.qtd) * numOrZero(e && e.largura);
    if (/^PORTA/.test(String(e && e.familia || ""))) metrosPortasExternas += m; else metrosJanelas += m;
  }
  const metrosVergas = portasInternas * PORTA_LARGURA + metrosPortasExternas + 2 * metrosJanelas;
  const r1 = (x) => Math.round(x * 100) / 100;
  return { portasInternas, metrosPortasInternas: r1(portasInternas * PORTA_LARGURA), metrosPortasExternas: r1(metrosPortasExternas), metrosJanelas: r1(metrosJanelas), vaoEsquadrias: r1(metrosPortasExternas + metrosJanelas), metrosVergas: r1(metrosVergas), vaoEquivalente: r1(metrosVergas / 2) };
}
// Rateio automático entre pavimentos. No sobrado, o que o usuário lança no
// bloco Geral (m² de parede total e perímetro de paredes) vale para a casa
// inteira; cada pavimento entra com metade até que alguém digite o seu. A
// área construída do Pav. 1 parte da área da laje do térreo — é o piso do
// pavimento de cima. Tudo editável: digitou, o digitado vence.
function autosPavimentos(projeto) {
  const p = projeto || {};
  const arq = p.arquitetura || {}, terreo = p.terreo || {};
  const sobrado = p.tipologia === "Sobrado";
  const fatia = sobrado ? 0.5 : 1;
  const r1 = (x) => Math.round(x * 10) / 10;
  return {
    sobrado,
    paredePavimento: r1(numOrZero(arq.m2ParedesTotal) * fatia),
    perimetroPavimento: r1(numOrZero(arq.perimetroParedes) * fatia),
    areaPav1: r1(numOrZero(terreo.areaLoje)),
  };
}
// Soma das espessuras lançadas num pavimento (0 = nada digitado, vale o rateio)
function paredeDigitada(pav) {
  const o = pav || {};
  return numOrZero(o.m2Parede20) + numOrZero(o.m2Parede15) + numOrZero(o.m2Parede25);
}
// Valores automáticos do bloco Pisos e revestimentos quando o campo está em branco
function autosPisos(projeto) {
  const p = projeto || {};
  const arq = p.arquitetura || {}, terreo = p.terreo || {}, pav1 = p.pav1 || {}, externa = p.externa || {};
  const v = vaosAutomaticos(p);
  const est = estimarPelosComodos(p);
  const perimetro = numOrZero(terreo.perimetroParedes) + (p.tipologia === "Sobrado" ? numOrZero(pav1.perimetroParedes) : 0);
  const r1 = (x) => Math.round(x * 10) / 10;
  return {
    pisoInterno: r1(numOrZero(arq.areaConstruida)),
    pisoExterno: r1(numOrZero(externa.pavimentacao)), // mesma área do bloco Pavimentação externa
    rodapeM: r1(Math.max(0, perimetro - v.portasInternas * PORTA_LARGURA)),
    soleirasM: r1(v.vaoEsquadrias),
    revestimentoInterno: est.revestimentoInterno,
    bancadas: est.bancadas,
    vaos: v,
  };
}
// Estimativa da obra inteira pelos cômodos (contagem × unitário)
function estimarPelosComodos(projeto) {
  const p = projeto || {};
  const ambientes = migrarAmbientes(p.ambientes || {});
  const r = { tamanho: TAMANHOS_COMODOS.includes(p.tamanhoComodos) ? p.tamanhoComodos : "Médio", pisoInterno: 0, revestimentoInterno: 0, rodapeM: 0, soleirasM: 0, perimetroComodos: 0, bancadas: [], detalhes: [] };
  const r1 = (x) => Math.round(x * 10) / 10;
  for (const id of Object.keys(COMODO_OBRA_PROJETO)) {
    const n = Math.max(0, Math.round(numOrZero(ambientes[id])));
    if (!n) continue;
    const cfg = comodoConfig(p, id);
    const c = calcularComodo(cfg);
    if (!(c.area > 0)) continue;
    r.pisoInterno += n * c.area;
    r.revestimentoInterno += n * c.revestimento;
    r.rodapeM += n * c.rodape;
    r.perimetroComodos += n * c.perimetro;
    r.soleirasM += n * PORTA_LARGURA;
    for (let k = 0; k < n; k++) {
      const sufixo = n > 1 ? ` ${k + 1}` : "";
      if (c.bancada) r.bancadas.push({ ...BANCADA_PADRAO, ...c.bancada, nome: NOME_AMBIENTE(id) + sufixo });
      if (c.ilha) r.bancadas.push({ ...BANCADA_PADRAO, fundoCm: 0, sapatas: 0, ...c.ilha, nome: NOME_AMBIENTE(id) + sufixo + " — ilha" });
    }
    r.detalhes.push({ id, nome: NOME_AMBIENTE(id), n, L: cfg.L, W: cfg.W, area: r1(n * c.area), revestimento: r1(n * c.revestimento), bancadaM2: r1(n * c.bancadaM2) });
  }
  for (const e of (Array.isArray(p.esquadrias) ? p.esquadrias : [])) {
    if (/JANELA|MAXIM|FIXO/.test(String(e && e.familia || ""))) r.soleirasM += numOrZero(e.qtd) * numOrZero(e.largura);
  }
  r.pisoInterno = r1(r.pisoInterno); r.revestimentoInterno = r1(r.revestimentoInterno); r.rodapeM = r1(r.rodapeM); r.soleirasM = r1(r.soleirasM); r.perimetroComodos = r1(r.perimetroComodos);
  return r;
}

function pisosRevestimentos(cp, out, data) {
  const base = { ordem: ORD.pisos, tipo: "Acabamento", etapa: "Pisos e revestimentos" };
  const ps = cp.pisos || {};
  const padrao = cp.padrao || "Médio";
  let m2Porcelanato = 0, m2PisoInterno = 0;
  const totais = { AC3: 0, AC2: 0, rejunteKg: 0, clips: 0, cruzetas: 0 };

  // Rodapé é recorte do próprio piso interno: m × 0,10 somados ao m² do piso
  const rodapeM = numOrZero(ps.rodapeM);
  const rodapeM2 = rodapeM * RODAPE_ALTURA_M;
  for (const sup of SUPERFICIES_PISOS) {
    const area = numOrZero(ps[sup.id] && ps[sup.id].m2) + (sup.id === "pisoInterno" ? rodapeM2 : 0);
    if (!(area > 0)) continue;
    const formatoId = (ps[sup.id] && ps[sup.id].formato) || FORMATO_PADRAO[sup.id][padrao] || "60x60";
    const c = consumoRevestimento(formatoId, sup.externo, numOrZero(ps[sup.id] && ps[sup.id].juntaMm));
    const produto = String((ps[sup.id] && ps[sup.id].produto) || "").trim() || PISOS_GENERICOS[sup.id][padrao] || PISOS_GENERICOS[sup.id]["Médio"];
    emitir(out, { ...base, subEtapa: sup.subEtapa, item: produto, unidade: "m2", qtd: ceil2(area * PERDA_PECAS), memoria: [
      MEM.nota(`${sup.nome}: ${String((ps[sup.id] && ps[sup.id].produto) || "").trim() ? "produto escolhido no projeto" : `sem produto escolhido, entra o genérico do padrão ${padrao}`}. Formato ${c.formato.nome}${(ps[sup.id] && ps[sup.id].formato) ? "" : " (padrão da obra)"}.${sup.id === "pisoInterno" ? " O rodapé é recorte do próprio piso: entra somado aqui, não como item separado." : ""}`),
      MEM.dado(`${sup.nome} informado`, numOrZero(ps[sup.id] && ps[sup.id].m2), "m²", "bloco Pisos e revestimentos"),
      ...(sup.id === "pisoInterno" && rodapeM > 0 ? [
        MEM.dado("Rodapé", rodapeM, "m", "bloco Pisos e revestimentos"),
        MEM.conta("Rodapé em m² de piso (faixa de 10 cm)", "rodapé × 0,10", [["rodapé", rodapeM]], rodapeM2, "m²"),
        MEM.conta("Área a assentar", "piso + rodapé", [["piso", numOrZero(ps[sup.id] && ps[sup.id].m2)], ["rodapé", rodapeM2]], area, "m²"),
      ] : []),
      MEM.conta(`Peças com ${Math.round((PERDA_PECAS - 1) * 100)}% de perda (recortes e quebras)`, "área × 1,20", [["área", area]], area * PERDA_PECAS, "m²"),
      MEM.teto(area * PERDA_PECAS, ceil2(area * PERDA_PECAS), "m²", "Arredonda em centésimos de m²"),
    ] });
    totais[c.argamassa] += area * c.argamassaKg;
    totais.rejunteKg += area * c.rejunteKg;
    totais.clips += area * c.clipsM2;
    totais.cruzetas += area * c.cruzetasM2;
    if (c.porcelanato) m2Porcelanato += area;
    if (sup.id === "pisoInterno") m2PisoInterno += area;
  }


  // Soleiras e peitoris (m lineares × largura)
  const soleirasM = numOrZero(ps.soleirasM);
  if (soleirasM > 0) {
    const m2 = soleirasM * SOLEIRA_LARGURA_M;
    emitir(out, { ...base, subEtapa: "Soleiras e peitoris", item: String(ps.soleirasProduto || "").trim() || soleiraPadrao(padrao), unidade: "m2", qtd: ceil2(m2 * PERDA), memoria: [
      MEM.nota(`Soleiras e peitoris em pedra, faixa de ${SOLEIRA_LARGURA_M * 100} cm. Em branco, os metros vêm do vão das esquadrias e das portas internas; a pedra é a do padrão ${padrao} quando você não escolhe outra.`),
      MEM.dado("Metros de soleira e peitoril", soleirasM, "m", "bloco Pisos e revestimentos"),
      MEM.conta("Metros quadrados de pedra", `metros × ${numMem(SOLEIRA_LARGURA_M)}`, [["metros", soleirasM]], m2, "m²"),
      MEM.conta("Com 10% de perda", "m² × 1,10", [["m²", m2]], m2 * PERDA, "m²"),
      MEM.teto(m2 * PERDA, ceil2(m2 * PERDA), "m²", "Arredonda em centésimos de m²"),
    ] });
    totais.AC3 += m2 * ARGAMASSA_KG_M2.AC3;
  }

  // Bancadas — uma linha por bancada (tampo + saia + fundo + sapatas em m² de pedra),
  // com a medição guardada em `composicao`; sem lista, vale o m² digitado à moda antiga.
  // Bancadas — totalizadas por pedra (uma linha por produto), com cada
  // bancada e suas partes guardadas em `composicao`.
  const bancadas = Array.isArray(ps.bancadas) ? ps.bancadas : [];
  const porPedra = {};
  for (const b of bancadas) {
    const m = medirBancada(b);
    if (!(numOrZero(b.comprimento) > 0) || !(m.total > 0)) continue; // sem comprimento não é bancada
    const produto = String(b.produto || "").trim() || granitoPadrao(padrao);
    const acc = porPedra[produto] || (porPedra[produto] = { m2: 0, composicao: [] });
    acc.m2 += m.total;
    acc.composicao.push(b.ilha
      ? { bancada: b.nome || "Ilha", m2: m.total, tampo: m.tampo, laterais: m.laterais }
      : { bancada: b.nome || "Bancada", m2: m.total, tampo: m.tampo, saia: m.saia, fundo: m.fundo, sapatas: m.sapatas });
  }
  for (const [produto, acc] of Object.entries(porPedra)) {
    emitir(out, { ...base, subEtapa: "Bancadas", item: produto, unidade: "m2", qtd: Math.round(acc.m2 * 100) / 100, composicao: acc.composicao, memoria: [
      MEM.nota("Pedra pronta de marmoraria: some o tampo, a saia da frente, o fundo (rodabanca) e as sapatas de apoio de cada bancada. Não há perda — a peça vem cortada na medida. A ilha entra com as quatro laterais no lugar da saia e do fundo."),
      ...acc.composicao.map((x) => MEM.dado(x.bancada, x.m2, "m²", x.laterais != null ? `tampo ${numMem(x.tampo)} + laterais ${numMem(x.laterais)}` : `tampo ${numMem(x.tampo)} + saia ${numMem(x.saia)} + fundo ${numMem(x.fundo)} + sapatas ${numMem(x.sapatas)}`)),
      MEM.conta("Total nesta pedra", acc.composicao.map((x) => x.bancada).join(" + "), acc.composicao.map((x) => [x.bancada, x.m2]), Math.round(acc.m2 * 100) / 100, "m²"),
    ] });
  }
  const bancadasM2 = numOrZero(ps.bancadasM2);
  if (!Object.keys(porPedra).length && bancadasM2 > 0) emitir(out, { ...base, subEtapa: "Bancadas", item: String(ps.bancadasProduto || "").trim() || granitoPadrao(padrao), unidade: "m2", qtd: ceil2(bancadasM2), memoria: [
    MEM.nota("Bancadas informadas como um m² total, sem a lista peça a peça. Para ver tampo, saia, fundo e sapatas de cada uma, cadastre as bancadas no bloco Pisos e revestimentos ou marque a bancada no cômodo."),
    MEM.dado("Metros quadrados de bancada", bancadasM2, "m²", "bloco Pisos e revestimentos"),
    MEM.teto(bancadasM2, ceil2(bancadasM2), "m²", "Arredonda em centésimos de m²"),
  ] });

  // Deck
  const deckM2 = numOrZero(ps.deckM2);
  if (deckM2 > 0) {
    emitir(out, { ...base, subEtapa: "Deck", item: String(ps.deckProduto || "").trim() || "Piso - Deck", unidade: "m2", qtd: ceil2(deckM2 * PERDA), memoria: [
      MEM.nota("Deck de madeira, com 10% de perda de recortes."),
      MEM.dado("Área de deck", deckM2, "m²", "bloco Pisos e revestimentos"),
      MEM.conta("Com 10% de perda", "área × 1,10", [["área", deckM2]], deckM2 * PERDA, "m²"),
      MEM.teto(deckM2 * PERDA, ceil2(deckM2 * PERDA), "m²", "Arredonda em centésimos de m²"),
    ] });
    emitir(out, { ...base, subEtapa: "Deck", item: "tintas - Cetol Deck", unidade: "Unidades", qtd: teto(deckM2 / 20), memoria: [
      MEM.nota("Cetol para o deck: uma lata rende 20 m²."),
      MEM.dado("Área de deck", deckM2, "m²", "bloco Pisos e revestimentos"),
      MEM.conta("Latas", "área ÷ 20", [["área", deckM2]], deckM2 / 20, "latas"),
      MEM.teto(deckM2 / 20, teto(deckM2 / 20), "latas", "Arredonda para cima (lata fechada)"),
    ] });
  }

  // Consumíveis somados
  if (totais.AC3 > 0) emitir(out, { ...base, subEtapa: "Assentamento", item: "Argamassa AC 3 GF - 20kg", unidade: "Unidades", qtd: teto(totais.AC3 / 20 * PERDA), memoria: [
    MEM.nota(`Argamassa AC-III: usada em porcelanato e em tudo que é externo, a ${numMem(ARGAMASSA_KG_M2.AC3)} kg por m². Soma todas as superfícies desse tipo mais as soleiras. Saco de 20 kg.`),
    MEM.conta("Argamassa necessária", "soma das superfícies em AC-III", [], totais.AC3, "kg"),
    MEM.conta("Sacos, com 10% de perda", "kg ÷ 20 × 1,10", [["kg", totais.AC3]], totais.AC3 / 20 * PERDA, "sacos"),
    MEM.teto(totais.AC3 / 20 * PERDA, teto(totais.AC3 / 20 * PERDA), "sacos de 20 kg", "Arredonda para cima (saco fechado)"),
  ] });
  if (totais.AC2 > 0) emitir(out, { ...base, subEtapa: "Assentamento", item: "Argamassa AC 2 - 20kg", unidade: "Unidades", qtd: teto(totais.AC2 / 20 * PERDA), memoria: [
    MEM.nota(`Argamassa AC-II: cerâmica em área interna, a ${numMem(ARGAMASSA_KG_M2.AC2)} kg por m². Saco de 20 kg.`),
    MEM.conta("Argamassa necessária", "soma das superfícies em AC-II", [], totais.AC2, "kg"),
    MEM.conta("Sacos, com 10% de perda", "kg ÷ 20 × 1,10", [["kg", totais.AC2]], totais.AC2 / 20 * PERDA, "sacos"),
    MEM.teto(totais.AC2 / 20 * PERDA, teto(totais.AC2 / 20 * PERDA), "sacos de 20 kg", "Arredonda para cima (saco fechado)"),
  ] });
  if (totais.rejunteKg > 0) emitir(out, { ...base, subEtapa: "Assentamento", item: "Rejunte - 5kg", unidade: "Unidades", qtd: teto(totais.rejunteKg / 5), memoria: [
    MEM.nota("Rejunte pela geometria da junta de cada superfície: metros de junta por m² × largura da junta × espessura da peça × densidade 1.600 kg/m³, com fator 1,5 de acomodação. Embalagem de 5 kg."),
    MEM.conta("Rejunte necessário", "soma das superfícies", [], totais.rejunteKg, "kg"),
    MEM.conta("Embalagens", "kg ÷ 5", [["kg", totais.rejunteKg]], totais.rejunteKg / 5, "embalagens"),
    MEM.teto(totais.rejunteKg / 5, teto(totais.rejunteKg / 5), "embalagens de 5 kg", "Arredonda para cima (embalagem fechada)"),
  ] });
  if (totais.clips > 0) {
    emitir(out, { ...base, subEtapa: "Assentamento", item: "Pisos e revestimentos - Espaçador", unidade: "Unidades", qtd: teto(totais.clips * PERDA), memoria: [
    MEM.nota("Clips niveladores: só em peça de 60 cm ou maior, 3 por peça."),
    MEM.conta("Clips necessários", "3 × peças das superfícies com peça ≥ 60 cm", [], totais.clips, "clips"),
    MEM.conta("Com 10% de perda", "clips × 1,10", [["clips", totais.clips]], totais.clips * PERDA, "clips"),
    MEM.teto(totais.clips * PERDA, teto(totais.clips * PERDA), "clips"),
  ] });
    emitir(out, { ...base, subEtapa: "Assentamento", item: "Pisos e revestimentos - Cunha Niveladora", unidade: "Unidades", qtd: teto(totais.clips / 3), memoria: [
    MEM.nota("Cunhas do sistema de nivelamento: uma para cada 3 clips (a cunha é reutilizada)."),
    MEM.dado("Clips niveladores", totais.clips, "clips", "passo anterior"),
    MEM.conta("Cunhas", "clips ÷ 3", [["clips", totais.clips]], totais.clips / 3, "cunhas"),
    MEM.teto(totais.clips / 3, teto(totais.clips / 3), "cunhas"),
  ] });
  }
  if (totais.cruzetas > 0) emitir(out, { ...base, subEtapa: "Assentamento", item: "Pisos e revestimentos - Espaçador Cruzeta", unidade: "Pacotes 100 un", qtd: teto(totais.cruzetas * PERDA / 100), memoria: [
    MEM.nota("Cruzetas: nas peças menores que 60 cm, uma por peça. Pacote de 100."),
    MEM.conta("Cruzetas necessárias", "peças das superfícies com peça < 60 cm", [], totais.cruzetas, "cruzetas"),
    MEM.conta("Pacotes, com 10% de perda", "cruzetas × 1,10 ÷ 100", [["cruzetas", totais.cruzetas]], totais.cruzetas * PERDA / 100, "pacotes"),
    MEM.teto(totais.cruzetas * PERDA / 100, teto(totais.cruzetas * PERDA / 100), "pacotes de 100", "Arredonda para cima (pacote fechado)"),
  ] });
  if (m2Porcelanato > 0) emitir(out, { ...base, subEtapa: "Assentamento", item: "Disco Porcelanato", unidade: "Unidades", qtd: Math.max(1, teto(m2Porcelanato * 0.005 * PERDA)), memoria: [
    MEM.nota("Disco de corte de porcelanato: 0,005 por m² de porcelanato, no mínimo um."),
    MEM.conta("Área em porcelanato", "soma das superfícies", [], m2Porcelanato, "m²"),
    MEM.conta("Discos, com 10% de perda", "área × 0,005 × 1,10", [["área", m2Porcelanato]], m2Porcelanato * 0.005 * PERDA, "discos"),
    MEM.teto(m2Porcelanato * 0.005 * PERDA, Math.max(1, teto(m2Porcelanato * 0.005 * PERDA)), "discos", "Arredonda para cima (mínimo de 1 disco)"),
  ] });
  if (m2PisoInterno > 0) emitir(out, { ...base, subEtapa: "Proteção", item: "Salva Piso 1,00m x 25mts", unidade: "Rolos", qtd: teto(m2PisoInterno / 25 * PERDA), memoria: [
    MEM.nota("Salva-piso para proteger o piso assentado até o fim da obra: rolo de 1 m × 25 m."),
    MEM.conta("Área de piso interno", "piso interno + rodapé", [], m2PisoInterno, "m²"),
    MEM.conta("Rolos, com 10% de perda", "área ÷ 25 × 1,10", [["área", m2PisoInterno]], m2PisoInterno / 25 * PERDA, "rolos"),
    MEM.teto(m2PisoInterno / 25 * PERDA, teto(m2PisoInterno / 25 * PERDA), "rolos", "Arredonda para cima (rolo inteiro)"),
  ] });
}


// ═══════════════════════════════════════════════════════════════
// FORROS — módulo novo (não existia no VBA)
// ═══════════════════════════════════════════════════════════════
// O modelo antigo nunca quantificou forro: o cronograma já contava o tempo
// do gesseiro, mas o orçamento não comprava o material. Aqui cada forro é
// uma linha (pavimento + tipo + área); no sobrado a lista já vem com os
// dois pavimentos, cada um com a área da sua laje, e o usuário edita ou
// acrescenta trechos de outro tipo (parte em gesso, parte em madeira).
const FORRO_TIPOS = [
  { id: "gessoAcartonado", nome: "Gesso acartonado (drywall)", produto: "Gesso - Drywall" },
  { id: "gessoPlaca",      nome: "Gesso em placa (liso)",      produto: "Gesso - Placas 12,5mm  0,60x2,00" },
  { id: "madeira",         nome: "Madeira (pinus)",            produto: "Forro - Forro Pinus 3mts" },
  { id: "pvc",             nome: "PVC",                        produto: "Forro - PVC" },
];
const FORRO_TIPO_PADRAO = "gessoAcartonado";
// Consumo por m² de forro, por tipo. Referência: composição SINAPI 96110
// (forro de gesso acartonado) e prática do escritório para os demais.
// `borda` é por metro de acabamento no encontro com a parede.
const FORRO_CONSUMO = {
  gessoAcartonado: {
    itens: [
      { nome: "Gesso - PERFIL F530 X 3,00m", porM2: 2.2 / 3, unidade: "Unidades", nota: "perfis a cada 45 cm, em barras de 3 m" },
      { nome: "Gesso - PARAFUSO 3,5X25mm PA - CX/1000Q", porM2: 15 / 1000, unidade: "Unidades", nota: "15 parafusos por m², caixa de 1.000" },
      { nome: "Gesso - FITA TELADA 90M", porM2: 1.5 / 90, unidade: "Unidades", nota: "1,5 m de junta por m², rolo de 90 m" },
      { nome: "Gesso - Arame Galvanizado 20", porM2: 0.15, unidade: "Kg", nota: "penduais de fixação na laje" },
    ],
    borda: { nome: "Gesso - Tabica 3mts", porMetro: 1 / 3, unidade: "Unidades", nota: "tabica em barras de 3 m no encontro com a parede" },
  },
  gessoPlaca: {
    itens: [
      { nome: "Gesso - Arame Galvanizado 20", porM2: 0.25, unidade: "Kg", nota: "amarração das placas na laje" },
      { nome: "Gesso - Saco Gesso 4kg", porM2: 0.5 / 4, unidade: "Unidades", nota: "gesso de rejunte, 0,5 kg por m²" },
      { nome: "Gesso - Sisal 1kg", porM2: 0.05, unidade: "Unidades", nota: "sisal das juntas" },
    ],
    borda: { nome: "Gesso - Tabica 3mts", porMetro: 1 / 3, unidade: "Unidades", nota: "tabica em barras de 3 m no encontro com a parede" },
  },
  madeira: {
    itens: [
      { nome: "Forro - Sarrafo 5cm Cedrinho", porM2: 2.2, unidade: "Mts", nota: "barroteamento a cada 45 cm" },
      { nome: "Aço - Pregos 17x21", porM2: 0.05, unidade: "KG", nota: "pregos de fixação" },
    ],
    borda: { nome: "Forro - Meia Cana Pinus", porMetro: 1, unidade: "Mts", nota: "meia-cana no encontro com a parede" },
  },
  pvc: {
    itens: [
      { nome: "Forro - Sarrafo 5cm Cedrinho", porM2: 2.2, unidade: "Mts", nota: "barroteamento a cada 45 cm" },
      { nome: "Aço - Pregos 17x21", porM2: 0.03, unidade: "KG", nota: "pregos de fixação" },
    ],
    borda: { nome: "Forro - Meia Cana Pinus", porMetro: 1, unidade: "Mts", nota: "acabamento de borda" },
  },
};
const FORROS_MAX = 8;
function forroTipo(id) { return FORRO_TIPOS.find((t) => t.id === id) || FORRO_TIPOS[0]; }
// Lista automática de forros: um por pavimento, com a área da sua laje.
function autosForros(projeto) {
  const p = projeto || {};
  const terreo = p.terreo || {}, pav1 = p.pav1 || {};
  const sobrado = p.tipologia === "Sobrado";
  const r1 = (x) => Math.round(numOrZero(x) * 10) / 10;
  const lista = [{ pavimento: sobrado ? "Térreo" : "Forro da casa", tipo: FORRO_TIPO_PADRAO, area: r1(terreo.areaLoje) }];
  if (sobrado) lista.push({ pavimento: "Pav. 1", tipo: FORRO_TIPO_PADRAO, area: r1(pav1.areaLoje) });
  return lista.filter((f) => f.area > 0);
}
function forros(cp, out) {
  const lista = Array.isArray(cp.forros) ? cp.forros.filter((f) => numOrZero(f.area) > 0) : [];
  if (!lista.length) return;
  const areaTotal = lista.reduce((acc, f) => acc + numOrZero(f.area), 0);
  const perimetroTotal = numOrZero(cp.perimetroComodos);
  const base = { ordem: ORD.forros, tipo: "Acabamento", etapa: "Forros" };
  // Consumíveis somados entre os forros, para não repetir a mesma linha
  const somados = {};
  const somar = (nome, unidade, qtd, origem) => {
    const k = nome + "|" + unidade;
    const a = somados[k] || (somados[k] = { nome, unidade, qtd: 0, origens: [] });
    a.qtd += qtd;
    a.origens.push({ origem, qtd });
  };
  for (const f of lista) {
    const t = forroTipo(f.tipo);
    const c = FORRO_CONSUMO[t.id] || FORRO_CONSUMO[FORRO_TIPO_PADRAO];
    const area = numOrZero(f.area);
    const produto = String(f.produto || "").trim() || t.produto;
    const rotulo = f.pavimento || t.nome;
    // Borda: o perímetro dos cômodos rateado pela área deste forro
    const borda = areaTotal > 0 ? perimetroTotal * (area / areaTotal) : 0;
    emitir(out, { ...base, subEtapa: rotulo, item: produto, unidade: "m2", qtd: ceil2(area * PERDA), memoria: [
      MEM.nota(`Forro de ${t.nome.toLowerCase()} em ${rotulo}. A área vem do bloco Forros e Cobertura — no sobrado, cada pavimento já entra com a área da sua laje.`),
      MEM.dado("Área de forro", area, "m²", "bloco Forros e Cobertura"),
      MEM.conta("Com 10% de perda (recortes)", "área × 1,10", [["área", area]], area * PERDA, "m²"),
      MEM.teto(area * PERDA, ceil2(area * PERDA), "m²", "Arredonda em centésimos de m²"),
    ] });
    for (const it of c.itens) somar(it.nome, it.unidade, area * it.porM2, `${rotulo}: ${numMem(area)} m² × ${numMem(it.porM2)} (${it.nota})`);
    if (borda > 0 && c.borda) somar(c.borda.nome, c.borda.unidade, borda * c.borda.porMetro, `${rotulo}: ${numMem(borda)} m de borda × ${numMem(c.borda.porMetro)} (${c.borda.nota})`);
  }
  for (const a of Object.values(somados)) {
    const bruto = a.qtd * PERDA;
    emitir(out, { ...base, subEtapa: "Fixação e acabamento", item: a.nome, unidade: a.unidade, qtd: teto(bruto), memoria: [
      MEM.nota("Material de fixação e acabamento do forro, somado entre os trechos. O perímetro do acabamento de borda vem dos cômodos do bloco Geral, rateado pela área de cada forro."),
      ...a.origens.map((o) => MEM.dado(o.origem, o.qtd, a.unidade, "consumo do tipo de forro")),
      MEM.conta("Soma dos trechos", a.origens.map((_, i) => `trecho ${i + 1}`).join(" + "), a.origens.map((o, i) => [`trecho ${i + 1}`, o.qtd]), a.qtd, a.unidade),
      MEM.conta("Com 10% de perda", "quantidade × 1,10", [["quantidade", a.qtd]], bruto, a.unidade),
      MEM.teto(bruto, teto(bruto), a.unidade),
    ] });
  }
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
      memoria: [
        MEM.nota(`Item lançado à mão no bloco Itens do projeto de engenharia — a quantidade vem da leitura do projeto, o VICKE não calcula. ${insumo ? `Casou com ${insumo.codigo} no catálogo de Insumos${preco != null ? "" : " (sem preço cadastrado)"}.` : "Não achou correspondente no catálogo de Insumos, então entra sem preço."}`),
        MEM.dado("Quantidade lançada", it.qtd, unidade, "bloco Itens do projeto de engenharia"),
      ],
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
// Nome de item de kit resolvido para a obra: o marcador {padrão} vira o
// padrão em vigor ("Louças - Sanitário padrão {padrão}" → "… padrão Médio").
function nomeItemKit(nome, padrao) {
  return String(nome || "").replace(/\{padr[ãa]o\}/gi, padrao || "Médio").trim();
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
  const add = (disc, nome, qtd, unidade, origem) => {
    const k = disc + "|" + nome;
    const a = acumulado[k] || (acumulado[k] = { disc, nome, qtd: 0, unidade: unidade || "Unidades", origens: [] });
    a.qtd += qtd;
    if (origem) a.origens.push({ origem, qtd });
  };
  const padraoDaObra = PADROES_OBRA.includes(cp.padrao) ? cp.padrao : "Médio";
  const aplicarKit = (kit, vezes, disc, origem) => {
    if (!kit || !(vezes > 0)) return;
    for (const it of kit.itens || []) {
      if (!it || !it.nome || !(Number(it.qtd) > 0)) continue;
      // "{padrão}" no nome do item = genérico por padrão da obra (louças e metais)
      add(disc || kit.disciplina, nomeItemKit(it.nome, padraoDaObra), Number(it.qtd) * vezes, it.unidade,
        `${origem || kit.nome || "conjunto"} — ${numMem(it.qtd)} por conjunto × ${numMem(vezes)}`);
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
        aplicarKit(escolherKit(kits, kitId, inst.padrao), n, disc, `${t.nome} (${numMem(n)}×) · ${(escolherKit(kits, kitId, inst.padrao) || {}).nome || kitId}`);
      }
    }
    if (!doProjeto.ELETRICA) for (const p of pontosDef) totalPontos[p.id] += numOrZero(t.pontos && t.pontos[p.id]) * n;
  }
  if (!algumAmbiente) return;

  if (!doProjeto.ELETRICA) {
    for (const p of pontosDef) aplicarKit(escolherKit(kits, p.kit, inst.padrao), totalPontos[p.id], "ELETRICA", `${p.nome} (${numMem(totalPontos[p.id])} pontos somados nos cômodos)`);
    aplicarKit(escolherKit(kits, "ELETRICA_POR_OBRA", inst.padrao), 1, "ELETRICA", "Uma vez por obra (quadro, entrada e aterramento)");
    const luz = numOrZero(totalPontos.iluminacao) + numOrZero(totalPontos.iluminacaoParalela);
    if (luz > 0) add("ELETRICA", "Elétrica - Disjuntor Unipolar 10A - 10kA", teto(luz / 8), "Unidades", `Um circuito de iluminação a cada 8 pontos de luz (${numMem(luz)} pontos)`);
    if (totalPontos.tomadaGeral > 0) add("ELETRICA", "Elétrica - Disjuntor Unipolar 20A - 10kA", teto(totalPontos.tomadaGeral / 6), "Unidades", `Um circuito de tomadas a cada 6 tomadas de uso geral (${numMem(totalPontos.tomadaGeral)} tomadas)`);
  }
  if (!doProjeto.ESGOTO) aplicarKit(escolherKit(kits, "ESGOTO_POR_OBRA", inst.padrao), 1, "ESGOTO", "Uma vez por obra (caixas, ramal de saída e ventilação)");
  if (!doProjeto.AQUECIMENTO) {
    const sis = sistemas.find((x) => x.id === inst.aquecimento);
    if (sis && sis.kit) aplicarKit(escolherKit(kits, sis.kit, inst.padrao), 1, "AQUECIMENTO", `Sistema de aquecimento escolhido: ${sis.nome || inst.aquecimento}`);
    if (inst.pressurizador) aplicarKit(escolherKit(kits, "PRESSURIZADOR", inst.padrao), 1, "AQUECIMENTO", "Pressurizador marcado no bloco Instalações");
  }

  for (const a of Object.values(acumulado)) {
    const etapa = ETAPAS_PROJETO.find((e) => e.id === a.disc) || ETAPAS_PROJETO.find((e) => e.id === "OUTROS");
    const metros = /^m(ts|etros)?$/i.test(String(a.unidade || ""));
    const qtd = metros ? teto(a.qtd * 10 - 1e-9) / 10 : teto(a.qtd - 1e-9);
    emitir(out, { ordem: etapa.ordem, item: a.nome, tipo: etapa.tipo, etapa: etapa.nome, subEtapa: "Estimativa por ambientes", unidade: a.unidade, qtd, memoria: [
      MEM.nota(`Estimativa por conjuntos: sem projeto de engenharia lançado, o VICKE monta a lista a partir dos cômodos marcados no bloco Geral e dos pontos elétricos de cada um. Os conjuntos são editáveis em Insumos → Composições. Padrão da obra: ${padraoDaObra}.`),
      ...a.origens.map((o) => MEM.dado(o.origem, o.qtd, a.unidade, "conjunto por cômodo")),
      MEM.conta("Soma de todos os conjuntos", a.origens.map((_, i) => `parcela ${i + 1}`).join(" + "), a.origens.map((o, i) => [`parcela ${i + 1}`, o.qtd]), a.qtd, a.unidade),
      MEM.teto(a.qtd, qtd, a.unidade, metros ? "Arredonda para cima em décimos de metro" : "Arredonda para cima (peça inteira)"),
    ] });
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
  const estimativaComodos = estimarPelosComodos(p);
  const autos = autosPisos(p);
  const vaosAuto = autos.vaos;
  // Rateio automático entre pavimentos (Geral → térreo e pav. 1, 50% cada
  // no sobrado); o pavimento que tiver espessura digitada usa a sua.
  const autoPav = autosPavimentos(p);
  const parTerreoDigitada = paredeDigitada(terreoIn);
  const parPav1Digitada = paredeDigitada(pav1In);
  const parede20Terreo = parTerreoDigitada > 0 ? numOrZero(terreoIn.m2Parede20) : autoPav.paredePavimento;
  const parede20Pav1 = parPav1Digitada > 0 ? numOrZero(pav1In.m2Parede20) : autoPav.paredePavimento;
  const perimetroTerreo = numOrZero(terreoIn.perimetroParedes) || autoPav.perimetroPavimento;
  const perimetroPav1 = numOrZero(pav1In.perimetroParedes) || autoPav.perimetroPavimento;
  // parcela do térreo nos vãos (sobrado reparte pelo m² de parede de cada pavimento)
  const m2ParTerreo = parede20Terreo + numOrZero(terreoIn.m2Parede15) + numOrZero(terreoIn.m2Parede25);
  const m2ParPav1 = (p.tipologia === "Sobrado") ? parede20Pav1 + numOrZero(pav1In.m2Parede15) + numOrZero(pav1In.m2Parede25) : 0;
  const shareTerreo = p.tipologia !== "Sobrado" ? 1 : (m2ParTerreo + m2ParPav1 > 0 ? m2ParTerreo / (m2ParTerreo + m2ParPav1) : 0.5);
  const instalacoesIn = p.instalacoes || {};

  const tipologia = p.tipologia === "Sobrado" ? "Sobrado" : "Térrea";
  const tipoObra = p.tipoObra === "reforma" ? "reforma" : "nova";
  const padrao = padraoObra(p);
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
    // Reforma: as áreas medidas na visita. Só são lidas quando
    // tipoObra = "reforma"; em obra nova o bloco nem aparece no formulário.
    existente: p.existente || {},
    tamanhoComodos: TAMANHOS_COMODOS.includes(p.tamanhoComodos) ? p.tamanhoComodos : "Médio",
    temPiscina,

    areaConstruida: numOrZero(arq.areaConstruida),
    m2ParedesTotal: numOrZero(arq.m2ParedesTotal),
    m2ParedesInternas: numOrZero(arq.m2ParedesInternas),
    m2ParedesExternas: numOrZero(arq.m2ParedesExternas),
    gabarito: numOrZero(arq.gabarito),
    perimetroParedesGeral: numOrZero(arq.perimetroParedes),

    // Campos achatados historicamente usados por paredesTerreo() (pilotos
    // do Passo 2) — mantidos como estão, sem alterar seu comportamento já
    // testado.
    m2Paredes20Terreo: parede20Terreo,
    m2Paredes25Terreo: numOrZero(terreoIn.m2Parede25),
    m2Paredes15Terreo: numOrZero(terreoIn.m2Parede15),
    // vão equivalente para vergas/contravergas — automático (cômodos + esquadrias);
    // projeto antigo sem cômodos nem esquadrias mantém o valor digitado
    vaoPortasJanelasTerreo: vaosAuto.vaoEquivalente > 0 ? Math.round(vaosAuto.vaoEquivalente * shareTerreo * 100) / 100 : numOrZero(terreoIn.vaoPortasJanelas),
    vaos: vaosAuto,
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
    perimetroParedesTerreo: perimetroTerreo,
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
      m2Parede20: parede20Pav1,
      m2Parede25: numOrZero(pav1In.m2Parede25),
      m2Parede15: numOrZero(pav1In.m2Parede15),
      vaoPortasJanelas: vaosAuto.vaoEquivalente > 0 ? Math.round(vaosAuto.vaoEquivalente * (1 - shareTerreo) * 100) / 100 : numOrZero(pav1In.vaoPortasJanelas),
      colunas15: numOrZero(colunasPav1["15"]),
      colunas20: numOrZero(colunasPav1["20"]),
      colunas25: numOrZero(colunasPav1["25"]),
      colunas30: numOrZero(colunasPav1["30"]),
      areaFormaColunaMaior25cm: numOrZero(colunasPav1.areaFormaMaior25cm),
      concrColuna: numOrZero(colunasPav1.concreto),
      ferro: normalizarFerro(ferroColunasPav1),
      perimetroLoje: numOrZero(pav1In.perimetroLoje),
      perimetroParedes: perimetroPav1,
      // Área construída do pav. 1 — em branco, a área da laje do térreo
      area: numOrZero(pav1In.area) || autoPav.areaPav1,
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

    // m² de revestimento de parede interno: digitado no bloco "Pisos e
    // revestimentos"; em branco, o automático pelos cômodos; projeto antigo,
    // o campo externa.revestimentoInterno. Desconta da pintura.
    revestimentoInterno: numOrZero(pisosIn.revestimentoInterno && pisosIn.revestimentoInterno.m2) || estimativaComodos.revestimentoInterno || numOrZero(externa.revestimentoInterno),
    comodosEstimativa: estimativaComodos,
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
    ambientes: (() => { const m = migrarAmbientes(ambientesIn); for (const k of Object.keys(m)) m[k] = numOrZero(m[k]); return m; })(),
    instalacoes: {
      padrao: padraoInstalacoes(padrao), // derivado do padrão da obra (Alto/Altíssimo → kits _ALTO)
      aquecimento: instalacoesIn.aquecimento || "nenhum",
      pressurizador: !!instalacoesIn.pressurizador,
      doProjeto: DISCIPLINAS_INSTALACOES.reduce((acc, d) => { acc[d] = !!(instalacoesIn.doProjeto && instalacoesIn.doProjeto[d]); return acc; }, {}),
    },

    // cp.pisos — pisos, revestimentos, rodapé, soleiras, bancadas e deck
    pisos: {
      pisoInterno: normalizarSuperficie(pisosIn.pisoInterno, autos.pisoInterno),
      pisoExterno: normalizarSuperficie(pisosIn.pisoExterno, autos.pisoExterno),
      revestimentoInterno: normalizarSuperficie(pisosIn.revestimentoInterno, estimativaComodos.revestimentoInterno || numOrZero(externa.revestimentoInterno)),
      revestimentoExterno: normalizarSuperficie(pisosIn.revestimentoExterno),
      rodapeM: numOrZero(pisosIn.rodapeM) || autos.rodapeM,
      soleirasM: numOrZero(pisosIn.soleirasM) || autos.soleirasM, soleirasProduto: pisosIn.soleirasProduto || "",
      bancadasM2: numOrZero(pisosIn.bancadasM2), bancadasProduto: pisosIn.bancadasProduto || "",
      // lista digitada; em branco, as bancadas automáticas dos cômodos
      bancadas: ((Array.isArray(pisosIn.bancadas) && pisosIn.bancadas.length) ? pisosIn.bancadas : estimativaComodos.bancadas).slice(0, BANCADAS_MAX).map((b) => ({
        nome: String((b && b.nome) || "").trim(), comprimento: numOrZero(b && b.comprimento), profundidade: numOrZero(b && b.profundidade),
        saiaCm: numOrZero(b && b.saiaCm), fundoCm: numOrZero(b && b.fundoCm), sapatas: numOrZero(b && b.sapatas), sapataCm: numOrZero(b && b.sapataCm), produto: (b && b.produto) || "",
        ilha: !!(b && b.ilha),
      })),
      deckM2: numOrZero(pisosIn.deckM2), deckProduto: pisosIn.deckProduto || "",
    },

    // cp.forros — lista de forros (pavimento + tipo + área); em branco, um
    // por pavimento com a área da respectiva laje
    forros: ((Array.isArray(p.forros) && p.forros.length) ? p.forros : autosForros(p)).slice(0, FORROS_MAX).map((f) => ({
      pavimento: String((f && f.pavimento) || "").trim(),
      tipo: FORRO_TIPOS.some((t) => t.id === (f && f.tipo)) ? f.tipo : FORRO_TIPO_PADRAO,
      area: numOrZero(f && f.area),
      produto: (f && f.produto) || "",
    })),
    perimetroComodos: estimativaComodos.perimetroComodos,

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
// REFORMA — construção existente
// ═══════════════════════════════════════════════════════════════
// Numa reforma convivem duas obras. A parte NOVA (ampliação, laje nova,
// telhado novo) já é o que todos os blocos deste arquivo calculam — os
// campos são os mesmos. O que faltava é a parte que mexe no que já está
// construído: derrubar, arrancar, e refazer por cima.
//
// Este bloco só roda quando tipoObra = "reforma", e lê um punhado de áreas
// que o arquiteto mede na visita: parede a demolir, revestimento a remover,
// piso a assentar, e assim por diante. Não há modelo de prédio aqui — o que
// entra é o que foi medido.
//
// Os coeficientes de material são os MESMOS do resto do motor (40 tijolos
// por m² de parede de 20, chapisco de 5 mm e reboco de 25, contrapiso de
// 10 cm, argamassa e rejunte por formato de peça). Reforma não muda a
// física da construção: muda o que é feito, não como.

// Serviços de demolição e instalação: mão de obra medida por m² ou por
// unidade. O preço vem do catálogo de Insumos quando o escritório cadastra
// o serviço; sem cadastro, vale a referência abaixo — que é ponto de
// partida, não verdade, e cada escritório calibra com o próprio empreiteiro.
const SERVICOS_REFORMA = {
  paredeDemolir:        { item: "Demolição de alvenaria",              unidade: "m2",       valor: 35  },
  revestimentoRemover:  { item: "Remoção de revestimento de parede",   unidade: "m2",       valor: 22  },
  pisoRemover:          { item: "Remoção de piso",                     unidade: "m2",       valor: 18  },
  contrapisoRemover:    { item: "Retirada de contrapiso",              unidade: "m2",       valor: 30  },
  forroRemover:         { item: "Remoção de forro",                    unidade: "m2",       valor: 15  },
  esquadriaRetirar:     { item: "Retirada de esquadria",               unidade: "Unidades", valor: 60  },
  loucaMetalRetirar:    { item: "Retirada de louças e metais",         unidade: "Unidades", valor: 45  },
  loucaMetalInstalar:   { item: "Instalação de louças e metais",       unidade: "Unidades", valor: 120 },
};
const CACAMBA_ITEM = "Caçamba de entulho 5m³";
const CACAMBA_VALOR = 320;   // R$ por caçamba retirada
const CACAMBA_M3 = 5;
// Volume de entulho gerado por m² de cada demolição, em m³. Parede de 20 cm
// com reboco dos dois lados dá 0,25; piso cerâmico com a cola, 0,02.
const ENTULHO_M3_POR_M2 = {
  paredeDemolir: 0.25, revestimentoRemover: 0.03, pisoRemover: 0.02,
  contrapisoRemover: 0.07, forroRemover: 0.01,
};
// Entulho solto ocupa mais espaço que o material inteiro que saiu da parede.
const ENTULHO_EMPOLAMENTO = 1.4;

// Preço de um serviço de reforma: Insumos vence; sem cadastro, a referência.
function taxaServicoReforma(chave, data) {
  const s = SERVICOS_REFORMA[chave];
  if (!s) return null;
  const r = precoDoInsumo(s.item, data);
  if (r.preco != null && r.preco > 0) return { valor: r.preco, fonte: "insumo", confianca: r.confianca, codigo: r.codigo };
  return { valor: s.valor, fonte: "referencia", confianca: "modulo" };
}

function demolicoesRemocoes(cp, out, data) {
  const ex = cp.existente || {};
  const base = { ordem: ORD.demolicao, tipo: "Prestadores de serviços", etapa: "Demolições e remoções", subEtapa: "Construção existente" };
  for (const chave of ["paredeDemolir", "revestimentoRemover", "pisoRemover", "contrapisoRemover", "forroRemover", "esquadriaRetirar", "loucaMetalRetirar"]) {
    const qtd = numOrZero(ex[chave]);
    if (!(qtd > 0)) continue;
    const s = SERVICOS_REFORMA[chave];
    const taxa = taxaServicoReforma(chave, data);
    emitir(out, {
      ...base, item: s.item, unidade: s.unidade, qtd, preco: taxa.valor,
      confianca: taxa.confianca, insumoCodigo: taxa.codigo,
      memoria: [
        MEM.nota(taxa.fonte === "insumo"
          ? `${s.item}: preço do catálogo de Insumos.`
          : `${s.item}: o serviço não está no catálogo de Insumos, então entra a referência do módulo. Cadastre-o em Insumos para usar o preço do seu empreiteiro.`),
        MEM.dado("Quantidade medida na visita", qtd, s.unidade === "m2" ? "m²" : "unidades", "bloco Construção existente"),
        MEM.dado("Preço unitário", taxa.valor, s.unidade === "m2" ? "R$/m²" : "R$/un", taxa.fonte === "insumo" ? "catálogo de Insumos" : "referência do módulo"),
      ],
    });
  }
}

function entulhoDaReforma(cp, out, data) {
  const ex = cp.existente || {};
  const passos = [];
  let volume = 0;
  for (const [chave, coef] of Object.entries(ENTULHO_M3_POR_M2)) {
    const m2 = numOrZero(ex[chave]);
    if (!(m2 > 0)) continue;
    const v = m2 * coef;
    volume += v;
    passos.push(MEM.conta(SERVICOS_REFORMA[chave].item, `m² × ${numMem(coef)}`, [["m²", m2]], v, "m³"));
  }
  if (!(volume > 0)) return;
  const solto = volume * ENTULHO_EMPOLAMENTO;
  const cacambasBruto = solto / CACAMBA_M3;
  const cacambas = teto(cacambasBruto);
  const r = precoDoInsumo(CACAMBA_ITEM, data);
  const preco = r.preco != null && r.preco > 0 ? r.preco : CACAMBA_VALOR;
  emitir(out, {
    ordem: ORD.entulho, tipo: "Prestadores de serviços", etapa: "Entulho", subEtapa: "Construção existente",
    item: CACAMBA_ITEM, unidade: "Unidades", qtd: cacambas, preco,
    confianca: r.preco != null && r.preco > 0 ? r.confianca : "modulo",
    insumoCodigo: r.preco != null && r.preco > 0 ? r.codigo : null,
    memoria: [
      MEM.nota("O entulho sai do que foi demolido. Cada demolição gera um volume por m², somado aqui."),
      ...passos,
      MEM.conta("Volume demolido", "soma das demolições", [], volume, "m³"),
      MEM.conta("Entulho solto (o material quebrado ocupa mais espaço que na parede)", `volume × ${numMem(ENTULHO_EMPOLAMENTO)}`, [["volume", volume]], solto, "m³"),
      MEM.conta(`Caçambas de ${CACAMBA_M3} m³`, `entulho ÷ ${CACAMBA_M3}`, [["entulho", solto]], cacambasBruto, "caçambas"),
      MEM.teto(cacambasBruto, cacambas, "caçambas", "Arredonda para cima (caçamba inteira)"),
    ],
  });
}

// Execução sobre o que já existe: parede nova em área existente, reboco,
// contrapiso, piso, revestimento, pintura e a instalação das louças.
function execucaoNoExistente(cp, out, data) {
  const ex = cp.existente || {};
  const padrao = cp.padrao || "Médio";
  const base = { ordem: ORD.existente, etapa: "Construção existente" };
  const bruto = { ...base, tipo: "Bruto" };
  const acab = { ...base, tipo: "Acabamento" };

  // ── Parede a construir (20 cm, os mesmos 40 tijolos por m²) ──
  const m2Parede = numOrZero(ex.paredeConstruir);
  if (m2Parede > 0) {
    const tijolosBruto = m2Parede * 40 * PERDA;
    const tijolos = teto(tijolosBruto);
    const areiaBruto = tijolos * 0.001638 * PERDA;
    const areia = teto(areiaBruto);
    const vedalitBruto = areia / 25 * PERDA;
    const vedalit = teto(vedalitBruto);
    const cimentoBruto = areia * 2 * PERDA;
    const cimento = teto(cimentoBruto);
    const memParede = MEM.dado("Parede a construir", m2Parede, "m²", "bloco Construção existente");
    const sub = "Parede nova no existente";
    emitir(out, { ...bruto, subEtapa: sub, item: "Tijolos 6 Furos", unidade: "Unidades", qtd: tijolos, memoria: [
      MEM.nota("Parede de 20 cm: 40 tijolos de 6 furos por m², o mesmo consumo da obra nova."),
      memParede,
      MEM.conta("Tijolos, com 10% de perda", "área × 40 × 1,10", [["área", m2Parede]], tijolosBruto, "tijolos"),
      MEM.teto(tijolosBruto, tijolos, "tijolos", "Arredonda para cima (tijolo inteiro)"),
    ] });
    emitir(out, { ...bruto, subEtapa: sub, item: "Areia Fina", unidade: "m3", qtd: areia, memoria: [
      MEM.nota("Argamassa de assentamento: 0,001638 m³ de areia por tijolo."),
      MEM.dado("Tijolos", tijolos, "unidades", "passo anterior"),
      MEM.conta("Areia, com 10% de perda", "tijolos × 0,001638 × 1,10", [["tijolos", tijolos]], areiaBruto, "m³"),
      MEM.teto(areiaBruto, areia, "m³", "Arredonda para cima (a areia vem em m³ inteiro)"),
    ] });
    emitir(out, { ...bruto, subEtapa: sub, item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimento, memoria: [
      MEM.dado("Areia da argamassa", areia, "m³", "passo anterior"),
      MEM.conta("Cimento: 2 sacos por m³ de areia, com 10% de perda", "areia × 2 × 1,10", [["areia", areia]], cimentoBruto, "sacos"),
      MEM.teto(cimentoBruto, cimento, "sacos de 50 kg", "Arredonda para cima (saco fechado)"),
    ] });
    emitir(out, { ...bruto, subEtapa: sub, item: "Impermeabilizantes - Vedalit 18L", unidade: "Unidades", qtd: vedalit, memoria: [
      MEM.dado("Areia da argamassa", areia, "m³", "passo anterior"),
      MEM.conta("Baldes, com 10% de perda", "areia ÷ 25 × 1,10", [["areia", areia]], vedalitBruto, "baldes"),
      MEM.teto(vedalitBruto, vedalit, "baldes", "Arredonda para cima (balde fechado)"),
    ] });
  }

  // ── Chapisco e reboco (parede nova e parede existente a revestir) ──
  const m2Reboco = numOrZero(ex.rebocoNovo) || m2Parede;
  if (m2Reboco > 0) {
    const volChapisco = m2Reboco * PERDA * 2 * 0.005;
    const volReboco = m2Reboco * PERDA * 2 * 0.025;
    const cimentoBruto = (volChapisco * 0.2 * 1200 / 50) * PERDA + (volReboco * 0.125 * 1200 / 50) * PERDA;
    const cimento = teto(cimentoBruto);
    const areiaGrossaBruto = volChapisco * 0.8 * PERDA;
    const areiaGrossa = teto(areiaGrossaBruto);
    const areiaFinaBruto = volReboco * 0.875 * PERDA;
    const areiaFina = teto(areiaFinaBruto);
    const sub = "Chapisco e reboco no existente";
    const memArea = MEM.dado("Área a chapiscar e rebocar", m2Reboco, "m²", numOrZero(ex.rebocoNovo) > 0 ? "bloco Construção existente" : "igual à parede a construir");
    const notaCamadas = MEM.nota("Duas faces por parede, chapisco de 5 mm e reboco de 25 mm — os mesmos coeficientes da obra nova.");
    emitir(out, { ...bruto, subEtapa: sub, item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimento, memoria: [
      notaCamadas, memArea,
      MEM.conta("Volume de chapisco", "área × 1,10 × 2 × 0,005", [["área", m2Reboco]], volChapisco, "m³"),
      MEM.conta("Volume de reboco", "área × 1,10 × 2 × 0,025", [["área", m2Reboco]], volReboco, "m³"),
      MEM.conta("Cimento das duas camadas", "chapisco × 0,20 × 1.200 ÷ 50 × 1,10 + reboco × 0,125 × 1.200 ÷ 50 × 1,10", [["chapisco", volChapisco], ["reboco", volReboco]], cimentoBruto, "sacos"),
      MEM.teto(cimentoBruto, cimento, "sacos de 50 kg", "Arredonda para cima (saco fechado)"),
    ] });
    emitir(out, { ...bruto, subEtapa: sub, item: "Areia Grossa", unidade: "m3", qtd: areiaGrossa, memoria: [
      MEM.nota("Areia grossa é a do chapisco (80% do volume da camada)."), memArea,
      MEM.conta("Areia, com 10% de perda", "chapisco × 0,80 × 1,10", [["chapisco", volChapisco]], areiaGrossaBruto, "m³"),
      MEM.teto(areiaGrossaBruto, areiaGrossa, "m³", "Arredonda para cima (a areia vem em m³ inteiro)"),
    ] });
    emitir(out, { ...bruto, subEtapa: sub, item: "Areia Fina", unidade: "m3", qtd: areiaFina, memoria: [
      MEM.nota("Areia fina é a do reboco (87,5% do volume da camada)."), memArea,
      MEM.conta("Areia, com 10% de perda", "reboco × 0,875 × 1,10", [["reboco", volReboco]], areiaFinaBruto, "m³"),
      MEM.teto(areiaFinaBruto, areiaFina, "m³", "Arredonda para cima (a areia vem em m³ inteiro)"),
    ] });
  }

  // ── Contrapiso novo (10 cm + massiamento, como no térreo) ──
  const m2Contrapiso = numOrZero(ex.contrapisoNovo);
  if (m2Contrapiso > 0) {
    const areiaBruto = m2Contrapiso * 0.6 * 0.1 * PERDA;
    const areia = teto(areiaBruto);
    const pedraBruto = m2Contrapiso * 0.1 * PERDA;
    const pedra = teto(pedraBruto);
    const cimentoBruto = pedra * 6 * PERDA;
    const cimento = teto(cimentoBruto);
    const malhaBruto = m2Contrapiso / (2.9 * 1.9 * PERDA);
    const malha = teto(malhaBruto);
    const sub = "Contrapiso novo";
    const memArea = MEM.dado("Contrapiso a executar", m2Contrapiso, "m²", "bloco Construção existente");
    const nota = MEM.nota("Contrapiso de 10 cm com tela, os mesmos coeficientes do contrapiso do térreo.");
    emitir(out, { ...bruto, subEtapa: sub, item: "Areia Grossa", unidade: "m3", qtd: areia, memoria: [
      nota, memArea,
      MEM.conta("Areia, com 10% de perda", "área × 0,60 × 0,10 × 1,10", [["área", m2Contrapiso]], areiaBruto, "m³"),
      MEM.teto(areiaBruto, areia, "m³", "Arredonda para cima (a areia vem em m³ inteiro)"),
    ] });
    emitir(out, { ...bruto, subEtapa: sub, item: "Pedra", unidade: "m3", qtd: pedra, memoria: [
      nota, memArea,
      MEM.conta("Pedra da camada de 10 cm, com 10% de perda", "área × 0,10 × 1,10", [["área", m2Contrapiso]], pedraBruto, "m³"),
      MEM.teto(pedraBruto, pedra, "m³", "Arredonda para cima (a pedra vem em m³ inteiro)"),
    ] });
    emitir(out, { ...bruto, subEtapa: sub, item: "Sacos de cimento 50kg", unidade: "Unidades", qtd: cimento, memoria: [
      nota, MEM.dado("Pedra do contrapiso", pedra, "m³", "passo anterior"),
      MEM.conta("Cimento: 6 sacos por m³ de pedra, com 10% de perda", "pedra × 6 × 1,10", [["pedra", pedra]], cimentoBruto, "sacos"),
      MEM.teto(cimentoBruto, cimento, "sacos de 50 kg", "Arredonda para cima (saco fechado)"),
    ] });
    emitir(out, { ...bruto, subEtapa: sub, item: "Aço - Malha Pop EQ061 3.4mm 15x15", unidade: "Unidade", qtd: malha, memoria: [
      MEM.nota("Tela soldada do contrapiso: painel de 2,90 × 1,90 m. A perda entra dividindo, porque as telas se sobrepõem."),
      memArea,
      MEM.conta("Painéis", "área ÷ (2,90 × 1,90 × 1,10)", [["área", m2Contrapiso]], malhaBruto, "painéis"),
      MEM.teto(malhaBruto, malha, "painéis", "Arredonda para cima (painel inteiro)"),
    ] });
  }

  // ── Piso e revestimento a assentar ──
  for (const [campo, supId, nome] of [["pisoAssentar", "pisoInterno", "Piso a assentar"], ["revestimentoAssentar", "revestimentoInterno", "Revestimento a assentar"]]) {
    const area = numOrZero(ex[campo]);
    if (!(area > 0)) continue;
    const formatoId = FORMATO_PADRAO[supId][padrao] || "60x60";
    const c = consumoRevestimento(formatoId, false, 0);
    const produto = PISOS_GENERICOS[supId][padrao] || PISOS_GENERICOS[supId]["Médio"];
    const pecas = ceil2(area * PERDA_PECAS);
    const argKg = area * c.argamassaKg;
    const rejKg = area * c.rejunteKg;
    const sub = nome;
    const memArea = MEM.dado(nome, area, "m²", "bloco Construção existente");
    emitir(out, { ...acab, subEtapa: sub, item: produto, unidade: "m2", qtd: pecas, memoria: [
      MEM.nota(`Sem produto escolhido nesta etapa, entra o genérico do padrão ${padrao}, formato ${c.formato.nome}. Para especificar marca e formato, use o bloco Pisos e revestimentos.`),
      memArea,
      MEM.conta(`Peças com ${Math.round((PERDA_PECAS - 1) * 100)}% de perda (recortes e quebras)`, "área × 1,20", [["área", area]], area * PERDA_PECAS, "m²"),
      MEM.teto(area * PERDA_PECAS, pecas, "m²", "Arredonda em centésimos de m²"),
    ] });
    emitir(out, { ...acab, subEtapa: sub, item: c.argamassa === "AC3" ? "Argamassa AC-III 20kg" : "Argamassa AC-II 20kg", unidade: "Unidades", qtd: teto(argKg / 20 * PERDA), memoria: [
      MEM.nota(`${c.porcelanato ? "Porcelanato pede AC-III" : "Cerâmica pede AC-II"}: ${numMem(c.argamassaKg)} kg por m², saco de 20 kg.`),
      memArea,
      MEM.conta("Argamassa", `área × ${numMem(c.argamassaKg)}`, [["área", area]], argKg, "kg"),
      MEM.teto(argKg / 20 * PERDA, teto(argKg / 20 * PERDA), "sacos de 20 kg", "Arredonda para cima (saco fechado)"),
    ] });
    emitir(out, { ...acab, subEtapa: sub, item: "Rejunte 1kg", unidade: "Unidades", qtd: teto(rejKg * PERDA), memoria: [
      MEM.nota(`Rejunte calculado pela junta do formato ${c.formato.nome}: ${numMem(c.rejunteKg)} kg por m².`),
      memArea,
      MEM.conta("Rejunte, com 10% de perda", `área × ${numMem(c.rejunteKg)} × 1,10`, [["área", area]], rejKg * PERDA, "kg"),
      MEM.teto(rejKg * PERDA, teto(rejKg * PERDA), "kg", "Arredonda para cima (embalagem fechada)"),
    ] });
  }

  // ── Pintura do existente ──
  const m2Pintura = numOrZero(ex.pinturaExistente);
  if (m2Pintura > 0) {
    const area = m2Pintura * PERDA;
    const seladorBruto = (0.2 * area) / 10 * PERDA;
    const massaBruto = ((area / 3) * 2.5) / 15 * PERDA;
    const fundoBruto = (0.2 * area) / 8 * PERDA;
    const tintaBruto = 0.15 * area / 9 * PERDA;
    const sub = "Pintura do existente";
    const memArea = MEM.dado("Área a pintar", m2Pintura, "m²", "bloco Construção existente");
    const notaComum = MEM.nota("Mesmos rendimentos da pintura da obra nova. Parede velha costuma pedir mais massa; ajuste o item se for o caso.");
    for (const [item, bruto2, texto] of [
      ["Tintas - Fundo Preparador 18L", fundoBruto, "Fundo preparador: 0,2 litro por m², lata que rende 8."],
      ["Tintas - Selador 18L", seladorBruto, "Selador: 0,2 litro por m², lata que rende 10."],
      ["Tintas - Massa Corrida 25KG", massaBruto, "Massa corrida: um terço da área, 2,5 kg por m², saco que rende 15."],
      ["Tintas - Tinta Acrílica 18L", tintaBruto, "Tinta: 0,15 litro por m², lata que rende 9."],
    ]) {
      emitir(out, { ...acab, subEtapa: sub, item, unidade: "Unidades", qtd: teto(bruto2), memoria: [
        notaComum, memArea, MEM.nota(texto),
        MEM.conta("Área com 10% de perda", "área × 1,10", [["área", m2Pintura]], area, "m²"),
        MEM.teto(bruto2, teto(bruto2), "latas", "Arredonda para cima (embalagem fechada)"),
      ] });
    }
  }

  // ── Instalação de louças e metais ──
  const un = numOrZero(ex.loucaMetalInstalar);
  if (un > 0) {
    const taxa = taxaServicoReforma("loucaMetalInstalar", data);
    const s = SERVICOS_REFORMA.loucaMetalInstalar;
    emitir(out, {
      ordem: ORD.existente, tipo: "Prestadores de serviços", etapa: "Construção existente",
      subEtapa: "Louças e metais", item: s.item, unidade: s.unidade, qtd: un, preco: taxa.valor,
      confianca: taxa.confianca, insumoCodigo: taxa.codigo,
      memoria: [
        MEM.nota("Mão de obra de instalação — a louça e o metal em si entram pelo bloco de itens do projeto."),
        MEM.dado("Peças a instalar", un, "unidades", "bloco Construção existente"),
        MEM.dado("Preço unitário", taxa.valor, "R$/un", taxa.fonte === "insumo" ? "catálogo de Insumos" : "referência do módulo"),
      ],
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// gerarOrcamentoObra — função pura, sem React, sem side-effect. Espelha a
// ordem de execução de A_GERAR_ORCAMENTO.bas.
// ═══════════════════════════════════════════════════════════════
function gerarOrcamentoObra(projeto, data) {
  const cp = normalizarProjeto(projeto);
  const out = [];

  // Reforma: o que se derruba vem antes de tudo o que se levanta.
  if (cp.tipoObra === "reforma") {
    demolicoesRemocoes(cp, out, data);
    entulhoDaReforma(cp, out, data);
  }
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
  forros(cp, out);
  instalacoesPorAmbiente(cp, out, data);
  itensProjeto(cp, out, data);
  prestadores(cp, out, data);
  if (cp.tipoObra === "reforma") execucaoNoExistente(cp, out, data);

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
    existente: {},   // reforma: o que se mexe no que já está construído
    cobertura: [],
    esquadrias: [],
    pisos: {},
    ambientes: { cozinha: 1, lavanderia: 1 }, // essenciais já contados
    comodosCfg: {},
    instalacoes: { padrao: "Médio", aquecimento: "nenhum", pressurizador: false, doProjeto: {} },
    itensProjeto: [],
    prestadores: {},
  };
}

// Célula de formulário: rótulo em cima, input embaixo. Em grades, a célula
// ocupa a altura toda da linha e o input fica no pé — assim os inputs de uma
// mesma linha ficam sempre alinhados mesmo quando um rótulo quebra em 2 linhas.
const CAMPO_CELULA = { display: "flex", flexDirection: "column", justifyContent: "flex-end", minWidth: 0 };
function CampoNum({ label, valor, onChange, inteiro }) {
  // inteiro: contagens (ambientes, peças) — passo 1, sem negativos, sem decimais
  return (
    <div style={CAMPO_CELULA}>
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
    <div style={CAMPO_CELULA}>
      <label style={C.label}>{label}</label>
      <input style={C.input} inputMode="decimal" value={texto === "" ? "" : `${texto}%`} placeholder="0%"
        onChange={aoDigitar}
        onKeyDown={(e) => { if (e.key === "Backspace" && texto !== "") { e.preventDefault(); aoDigitar({ target: { value: texto.slice(0, -1) } }); } }} />
    </div>
  );
}
function CampoTexto({ label, valor, onChange, placeholder }) {
  return (
    <div style={CAMPO_CELULA}>
      <label style={C.label}>{label}</label>
      <input style={C.input} value={valor ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function CampoSelect({ label, valor, onChange, opcoes }) {
  return (
    <div style={CAMPO_CELULA}>
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
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>
        Metros lineares de cada bitola{comConcreto ? ", e m³ de concreto" : ""} por elemento. Campo vazio = 0.
      </div>
      <div style={{ overflowX: "auto", border: "1px solid rgba(38,36,33,0.14)", borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11.5, minWidth: 640 }}>
          <thead>
            <tr style={{ background: "#f7f7f8" }}>
              <th style={{ position: "sticky", left: 0, background: "#f7f7f8", padding: "7px 10px", textAlign: "left", fontWeight: 600, color: "#4b5563", whiteSpace: "nowrap" }}>Elemento</th>
              {BITOLAS_FERRO.map((b) => (
                <th key={b.k} style={{ padding: "7px 6px", fontWeight: 600, color: "#4b5563", whiteSpace: "nowrap" }}>{b.label}</th>
              ))}
              {comConcreto && <th style={{ padding: "7px 6px", fontWeight: 600, color: "#4b5563", whiteSpace: "nowrap" }}>Concreto m³</th>}
            </tr>
          </thead>
          <tbody>
            {elementos.map((el) => (
              <tr key={el.key} style={{ borderTop: "1px solid #f3f4f6" }}>
                <td style={{ position: "sticky", left: 0, background: "#fff", padding: "5px 10px", color: "#111827", fontWeight: 500, whiteSpace: "nowrap" }}>{el.label}</td>
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
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>{rotulo} — metros lineares por bitola</div>
      <div style={{ overflowX: "auto", border: "1px solid rgba(38,36,33,0.14)", borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11.5, minWidth: 560 }}>
          <thead>
            <tr style={{ background: "#f7f7f8" }}>
              {BITOLAS_FERRO.map((b) => (
                <th key={b.k} style={{ padding: "7px 6px", fontWeight: 600, color: "#4b5563", whiteSpace: "nowrap" }}>{b.label}</th>
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
        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{titulo}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {subtitulo && <span style={{ fontSize: 11, color: "#6b7280" }}>{subtitulo}</span>}
          <span style={{ fontSize: 11, color: "#6b7280" }}>{aberto ? "▲" : "▼"}</span>
        </span>
      </button>
      {aberto && <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>{children}</div>}
    </div>
  );
}

function formatoBRL(n) {
  return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Lista de cômodos do bloco Geral: só os cômodos que a obra tem (quantidade
// > 0), com botão para adicionar. Molhados primeiro, em tabela compacta com
// as colunas Revest. (m² de parede) e Granito (m² de bancada) calculadas
// pelas medidas do tamanho escolhido; o nome é um botão que abre a edição
// (medidas, revestimento, bancada). Secos só têm a contagem.
function ListaComodos({ projeto, get, set, comodoAberto, setComodoAberto, isMobile }) {
  const tipos = typeof AMBIENTES_TIPOS !== "undefined" ? AMBIENTES_TIPOS : [];
  const grupos = typeof AMBIENTES_GRUPOS !== "undefined" ? AMBIENTES_GRUPOS : [...new Set(tipos.map((a) => a.grupo || ""))];
  const ordenados = grupos.flatMap((g) => tipos.filter((a) => (a.grupo || "") === g));
  const qtd = (id) => Math.max(0, Math.round(numOrZero(get(`ambientes.${id}`))));
  const presentes = ordenados.filter((a) => qtd(a.id) > 0);
  const ausentes = ordenados.filter((a) => qtd(a.id) === 0);
  const molhados = presentes.filter((a) => a.molhado), secos = presentes.filter((a) => !a.molhado);
  const fmt = (x) => Number(x).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const inputQtd = { width: 48, padding: "4px 4px", border: "1.5px solid #1f2a37", borderRadius: 7, fontSize: 13, fontFamily: "inherit", textAlign: "center", background: "#fff" };
  const colunasMolhado = isMobile ? "1fr 52px 60px 60px 20px" : "170px 52px 72px 72px 20px";
  const colunasSeco = isMobile ? "1fr 52px 20px" : "150px 52px 20px";
  const cabecalho = { fontSize: 10, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, textAlign: "center" };
  function setQtd(id, v) { set(`ambientes.${id}`, v === "" ? "" : Math.max(0, Math.round(Number(v)))); }
  function setCfg(id, campo, valor) { set(`comodosCfg.${id}.${campo}`, valor); }
  function restaurar(id) { const cfgs = { ...(projeto.comodosCfg || {}) }; delete cfgs[id]; set("comodosCfg", cfgs); }
  const [adicionando, setAdicionando] = useState(false);

  // função (não componente): componente definido dentro do render remontaria o input a cada tecla
  function linha(a) {
    const n = qtd(a.id);
    const cfg = comodoConfig(projeto, a.id);
    const c = calcularComodo(cfg);
    const aberto = comodoAberto === a.id;
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: a.molhado ? colunasMolhado : colunasSeco, gap: 8, alignItems: "center", padding: "3px 0" }}>
          {a.molhado ? (
            <button type="button" onClick={() => setComodoAberto(aberto ? null : a.id)} title="Editar medidas, revestimento e bancada"
              style={{ textAlign: "left", cursor: "pointer", fontFamily: "inherit", fontSize: 13, padding: "5px 10px", borderRadius: 8, border: `1.5px solid ${aberto ? "#0474f4" : "rgba(38,36,33,0.18)"}`, background: "#fff", color: "#1f2a37", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {a.nome}{cfg.editado ? " *" : ""}
            </button>
          ) : (
            <div style={{ fontSize: 13, color: "#1f2a37", padding: "5px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nome}</div>
          )}
          <input type="number" min="0" step="1" style={inputQtd} value={get(`ambientes.${a.id}`) ?? ""} onChange={(e) => setQtd(a.id, e.target.value)} />
          {a.molhado && <div style={{ fontSize: 13, color: "#111827", textAlign: "center" }}>{c.revestimento > 0 ? fmt(n * c.revestimento) : "—"}</div>}
          {a.molhado && <div style={{ fontSize: 13, color: "#111827", textAlign: "center" }}>{c.bancadaM2 > 0 ? fmt(n * c.bancadaM2) : "—"}</div>}
          <button type="button" onClick={() => { setQtd(a.id, 0); if (aberto) setComodoAberto(null); }} title="Tirar da obra" style={{ ...C.btnGhost, fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
        </div>
        {aberto && a.molhado && (
          <div style={{ margin: "4px 0 8px", padding: 10, background: "#fafafa", border: "1px solid #eee", borderRadius: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 8 }}>
              <CampoNum label="Comprimento (m)" valor={cfg.L} onChange={(v) => setCfg(a.id, "L", v)} />
              <CampoNum label="Largura (m)" valor={cfg.W} onChange={(v) => setCfg(a.id, "W", v)} />
              <CampoNum label="Pé-direito (m)" valor={cfg.peDireito} onChange={(v) => setCfg(a.id, "peDireito", v)} />
              <CampoSelect label="Revestimento nas paredes" valor={cfg.revestir} onChange={(v) => setCfg(a.id, "revestir", v)} opcoes={REVESTIR_OPCOES} />
              <CampoSelect label="Bancada" valor={cfg.temBancada ? "sim" : "nao"} onChange={(v) => setCfg(a.id, "temBancada", v === "sim")} opcoes={[{ value: "nao", label: "Não" }, { value: "sim", label: "Sim" }]} />
              {cfg.permiteIlha && (
                <CampoSelect label="Ilha" valor={cfg.temIlha ? "sim" : "nao"} onChange={(v) => setCfg(a.id, "temIlha", v === "sim")} opcoes={[{ value: "nao", label: "Não" }, { value: "sim", label: "Sim" }]} />
              )}
              {cfg.temBancada && (
                <>
                  <CampoPercentual label="Bancada (% da parede maior)" valor={cfg.bancadaFracao} onChange={(v) => setCfg(a.id, "bancadaFracao", v)} />
                  <CampoNum label="Profundidade (m)" valor={cfg.bancadaProfundidade} onChange={(v) => setCfg(a.id, "bancadaProfundidade", v)} />
                  <CampoNum label="Saia (cm)" valor={cfg.saiaCm} onChange={(v) => setCfg(a.id, "saiaCm", v)} />
                  <CampoNum label="Fundo / frontão (cm)" valor={cfg.fundoCm} onChange={(v) => setCfg(a.id, "fundoCm", v)} />
                  <CampoNum label="Sapatas (un)" valor={cfg.sapatas} onChange={(v) => setCfg(a.id, "sapatas", v)} inteiro />
                  <CampoNum label="Largura da sapata (cm)" valor={cfg.sapataCm} onChange={(v) => setCfg(a.id, "sapataCm", v)} />
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 6, fontSize: 11.5, color: "#4b5563", flexWrap: "wrap" }}>
              <span>Por cômodo: {fmt(c.area)} m² · perímetro {fmt(c.perimetro)} m · revestimento {fmt(c.revestimento)} m²{c.bancadaM2 > 0 ? ` · granito ${fmt(c.bancadaM2)} m²` : ""}{c.bancadaPartes ? ` = bancada ${fmt(c.bancadaPartes.total)} (tampo ${fmt(c.bancadaPartes.tampo)} de ${fmt(c.bancada.comprimento)} × ${fmt(c.bancada.profundidade)} m + saia ${fmt(c.bancadaPartes.saia)} + fundo ${fmt(c.bancadaPartes.fundo)} + sapatas ${fmt(c.bancadaPartes.sapatas)})` : ""}{c.ilhaPartes ? ` + ilha ${fmt(c.ilhaPartes.total)} (tampo ${fmt(c.ilhaPartes.tampo)} de ${fmt(c.ilha.comprimento)} × ${fmt(c.ilha.profundidade)} m + laterais ${fmt(c.ilhaPartes.laterais)})` : ""}</span>
              {cfg.editado && <button type="button" style={{ ...C.btnGhost, fontSize: 11.5 }} onClick={() => restaurar(a.id)}>Voltar ao padrão ({cfg.tamanho})</button>}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(380px, 460px) minmax(220px, 280px)", gap: isMobile ? 12 : 28, alignItems: "start" }}>
        <div>
          {molhados.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: colunasMolhado, gap: 8, alignItems: "end", padding: "0 0 2px" }}>
              <div style={{ ...cabecalho, textAlign: "left" }}>Áreas molhadas</div><div style={cabecalho}>Qtd</div><div style={cabecalho}>Revest. m²</div><div style={cabecalho}>Granito m²</div><div />
            </div>
          )}
          {molhados.map((a) => <div key={a.id}>{linha(a)}</div>)}
        </div>
        <div>
          {secos.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: colunasSeco, gap: 8, alignItems: "end", padding: "0 0 2px" }}>
              <div style={{ ...cabecalho, textAlign: "left" }}>Demais cômodos</div><div style={cabecalho}>Qtd</div><div />
            </div>
          )}
          {secos.map((a) => <div key={a.id}>{linha(a)}</div>)}
        </div>
      </div>
      <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {adicionando ? (
          <select autoFocus style={{ ...C.input, width: "auto", minWidth: 220 }} defaultValue="" onBlur={() => setAdicionando(false)}
            onChange={(e) => { if (e.target.value) { setQtd(e.target.value, 1); setComodoAberto(null); } setAdicionando(false); }}>
            <option value="">Escolha o cômodo…</option>
            {grupos.map((g) => {
              const opts = ausentes.filter((a) => (a.grupo || "") === g);
              return opts.length ? <optgroup key={g} label={g}>{opts.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</optgroup> : null;
            })}
          </select>
        ) : (
          ausentes.length > 0 && <button type="button" style={{ ...C.btnSec, fontSize: 12, padding: "6px 12px" }} onClick={() => setAdicionando(true)}>＋ Adicionar cômodo</button>
        )}
        {presentes.length === 0 && <span style={{ fontSize: 12, color: "#6b7280" }}>nenhum cômodo ainda</span>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Memória de cálculo — a tela da engrenagem
// ═══════════════════════════════════════════════════════════════
// Os passos não são gravados junto do orçamento (dobrariam o tamanho do
// registro da obra): são recalculados a partir do projeto quando a tela do
// resultado abre, e casados com a linha da tabela por etapa + sub-etapa +
// item. Orçamento antigo, gerado antes de um item ganhar memória, mostra a
// linha sem engrenagem.
function chaveMemoria(i) { return `${i.etapa}|${i.subEtapa || ""}|${i.item}`; }
function mapaMemorias(projeto, data) {
  const m = {};
  if (!projeto) return m;
  try {
    for (const i of gerarOrcamentoObra(projeto, data).itens) if (i.memoria) m[chaveMemoria(i)] = i.memoria;
  } catch (e) { /* projeto incompleto: a tabela segue, só sem memória */ }
  return m;
}
const MEM_S = {
  fundo: { position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, zIndex: 60, overflowY: "auto" },
  card: { background: "#fff", borderRadius: 14, maxWidth: 680, width: "100%", margin: "24px auto", boxShadow: "0 18px 50px rgba(0,0,0,0.25)", overflow: "hidden" },
  topo: { padding: "14px 18px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  passo: { display: "flex", gap: 10, padding: "10px 0", borderTop: "1px solid #f6f6f6" },
  bolinha: { flex: "0 0 22px", height: 22, borderRadius: 11, background: "#f3f4f6", color: "#4b5563", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" },
  formula: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11.5, color: "#4b5563" },
  conta: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5, color: "#111827" },
};
function MemoriaCalculo({ item, passos, onFechar }) {
  const qtd = Number(item.qtd).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  let n = 0;
  return (
    <div style={MEM_S.fundo} onClick={onFechar}>
      <div style={MEM_S.card} onClick={(e) => e.stopPropagation()}>
        <div style={MEM_S.topo}>
          <div>
            <div style={{ fontSize: 10.5, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Memória de cálculo · {item.etapa}{item.subEtapa ? ` › ${item.subEtapa}` : ""}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginTop: 3 }}>{item.item}</div>
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>Quantidade no orçamento: <b style={{ color: "#111827" }}>{qtd} {item.unidade}</b></div>
          </div>
          <button type="button" onClick={onFechar} style={{ ...C.btnGhost, fontSize: 18, padding: "0 4px", lineHeight: 1 }} title="Fechar">×</button>
        </div>
        <div style={{ padding: "4px 18px 14px" }}>
          {!passos || !passos.length ? (
            <div style={{ fontSize: 12.5, color: "#4b5563", padding: "14px 0" }}>
              A memória deste item ainda não foi escrita. Estamos publicando etapa por etapa — por enquanto valem "Instalações pré obra e projetos" e "Fundação".
            </div>
          ) : passos.map((p, idx) => {
            if (p.tipo === "nota") {
              return <div key={idx} style={{ ...MEM_S.passo, color: "#4b5563", fontSize: 12.5, lineHeight: 1.5 }}>{p.texto}</div>;
            }
            n += 1;
            return (
              <div key={idx} style={MEM_S.passo}>
                <div style={MEM_S.bolinha}>{n}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: "#111827", fontWeight: 600 }}>{p.rotulo}</div>
                  {p.tipo === "dado" && (
                    <div style={{ fontSize: 12.5, color: "#111827", marginTop: 2 }}>
                      <b>{p.valor}</b> {p.unidade}
                      {p.fonte ? <span style={{ color: "#6b7280" }}> · lido do {p.fonte}</span> : null}
                    </div>
                  )}
                  {p.tipo === "conta" && (
                    <div style={{ marginTop: 3 }}>
                      <div style={MEM_S.formula}>{p.formula}</div>
                      <div style={MEM_S.conta}>{p.conta} = <b>{p.valor}</b> {p.unidade}</div>
                    </div>
                  )}
                  {p.tipo === "teto" && (
                    <div style={{ ...MEM_S.conta, marginTop: 3 }}>{p.conta} <span style={{ color: "#6b7280" }}>{p.unidade}</span></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: "10px 18px", background: "#fafafa", borderTop: "1px solid #f3f4f6", fontSize: 11.5, color: "#4b5563" }}>
          Os números vêm do projeto que gerou este orçamento. Mudou uma medida? Edite os dados do projeto e recalcule — a memória acompanha.
        </div>
      </div>
    </div>
  );
}

function OrcamentoObraView({ obra, obras, data, save, onObraAtualizada, isMobile, onVoltar }) {
  // O orçamento/quantitativo é do escritório: o cliente final só consulta.
  // podeEditar é verdadeiro para ele (é o que libera baixar conta e lançar
  // despesa), então aqui o portão certo é podeGerenciarObra.
  const permBase = getPermissoes();
  const perm = { ...permBase, podeEditar: permBase.podeGerenciarObra === undefined ? permBase.podeEditar : permBase.podeGerenciarObra };
  const [viewInterna, setViewInterna] = useState(obra.orcamento ? "resultado" : obra.projeto ? "form" : "vazio");
  const [projetoDraft, setProjetoDraft] = useState(() => {
    const p = obra.projeto || projetoVazio();
    return p.ambientes ? { ...p, ambientes: migrarAmbientes(p.ambientes) } : p;
  });
  const [blocosAbertos, setBlocosAbertos] = useState({ geral: true });
  const [etapasColapsadas, setEtapasColapsadas] = useState({});
  const [paredeTerreoExpandida, setParedeTerreoExpandida] = useState(false);
  const [paredePav1Expandida, setParedePav1Expandida] = useState(false);
  const [espessuraTerreaAberta, setEspessuraTerreaAberta] = useState(false);
  const [comodoAberto, setComodoAberto] = useState(null);
  const [memoriaAberta, setMemoriaAberta] = useState(null);
  // Prazo estimado da obra, do mesmo motor da tela Cronograma — para o
  // cabeçalho do resultado ficar com prazo e custo lado a lado.
  const prazoObra = useMemo(() => {
    if (viewInterna !== "resultado" || !obra.orcamento || !obra.projeto) return null;
    try {
      if (typeof gerarCronogramaObra !== "function") return null;
      const r = gerarCronogramaObra(obra.projeto, obra.orcamento, data, obra.cronograma || {});
      return r && r.ativo && r.ativo.meses > 0 ? r.ativo : null;
    } catch (e) { return null; }
  }, [viewInterna, obra.projeto, obra.orcamento, obra.cronograma, data]);

  const memorias = useMemo(() => (viewInterna === "resultado" && obra.orcamento ? mapaMemorias(obra.projeto, data) : {}), [viewInterna, obra.projeto, obra.orcamento, data]);

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
  // Pav. 1 — mesmo racional do térreo: modo simples zera 15/25cm
  function setParedePav1Simples(v) {
    setProjetoDraft((p) => setEmCaminho(setEmCaminho(setEmCaminho(p, "pav1.m2Parede20", v), "pav1.m2Parede15", 0), "pav1.m2Parede25", 0));
  }

  function recalcular() {
    const resultado = gerarOrcamentoObra(projetoDraft, data);
    const orcamento = {
      geradoEm: new Date().toISOString(),
      versao: (obra.orcamento?.versao || 0) + 1,
      itens: resultado.itens.map(({ memoria, ...i }) => i), // memória é recalculada na tela, não gravada
      totais: resultado.totais,
      qualidade: resultado.qualidade,
      avisos: resultado.avisos,
    };
    const obraAtualizada = { ...obra, projeto: projetoDraft, orcamento };
    // mesma armadilha do cronograma: `obras` é a fatia deste cliente, e
    // substituir data.obras por ela apagaria as obras dos demais.
    const novasObras = mesclarPorCliente(data.obras, obra.clienteId, obras.map((o) => (o.id === obra.id ? obraAtualizada : o)));
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

  // Forros: lista com pavimento, tipo e área. Em branco, a lista automática
  // (um por pavimento, com a área da laje) — a primeira edição materializa.
  const forrosAuto = autosForros(projetoDraft);
  const forrosLista = (Array.isArray(projetoDraft.forros) && projetoDraft.forros.length) ? projetoDraft.forros : forrosAuto;
  const forrosDigitados = Array.isArray(projetoDraft.forros) && projetoDraft.forros.length > 0;
  function addForro() {
    if (forrosLista.length >= FORROS_MAX) return;
    set("forros", [...forrosLista, { pavimento: "", tipo: FORRO_TIPO_PADRAO, area: "" }]);
  }
  function updateForro(idx, campo, valor) {
    set("forros", forrosLista.map((f, i) => (i === idx ? { ...f, [campo]: valor } : f)));
  }
  function removeForro(idx) {
    set("forros", forrosLista.filter((_, i) => i !== idx));
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
          <div style={{ fontSize: 14, color: "#4b5563", marginBottom: 16 }}>Nenhum orçamento nesta obra.</div>
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
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Dados do projeto</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Campo vazio = 0. Um bloco sem nenhum dado não entra no orçamento.</div>

        <BlocoColapsavel titulo="Geral" aberto={!!blocosAbertos.geral} onToggle={() => toggleBloco("geral")}>
          <CampoSelect label="Tipo de obra" valor={projetoDraft.tipoObra || "nova"} onChange={(v) => set("tipoObra", v)} opcoes={TIPOS_OBRA} />
          <CampoSelect label="Tipologia" valor={projetoDraft.tipologia} onChange={(v) => set("tipologia", v)}
            opcoes={[{ value: "Sobrado", label: "Sobrado" }, { value: "Térrea", label: "Térrea" }]} />
          <CampoSelect label="Padrão" valor={padraoObra(projetoDraft)} onChange={(v) => set("padrao", v)} opcoes={PADROES_OBRA} />
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
            <input style={{ ...C.input, background: "#f3f4f6", color: "#4b5563" }} value={numOrZero(get("arquitetura.m2ParedesTotal"))} disabled readOnly />
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
                    <input style={{ ...C.input, background: "#f3f4f6", color: "#4b5563" }} value={numOrZero(get("terreo.m2Parede20"))} disabled readOnly />
                  </div>
                </>
              )}
            </>
          )}
          {!ehTerrea && (
            <CampoNum label="Perímetro de paredes (casa toda)" valor={get("arquitetura.perimetroParedes")} onChange={(v) => set("arquitetura.perimetroParedes", v)} />
          )}
          <CampoNum label="Gabarito" valor={get("arquitetura.gabarito")} onChange={(v) => set("arquitetura.gabarito", v)} />
          <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 6 }}>Cômodos</div>
            <ListaComodos projeto={projetoDraft} get={get} set={set} comodoAberto={comodoAberto} setComodoAberto={setComodoAberto} isMobile={isMobile} />
          </div>
        </BlocoColapsavel>

        {(projetoDraft.tipoObra === "reforma") && (
          <BlocoColapsavel titulo="Construção existente" aberto={!!blocosAbertos.existente} onToggle={() => toggleBloco("existente")}>
            <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#4b5563", marginBottom: 4 }}>
              O que será feito no que já está construído. A parte <b>nova</b> da reforma (ampliação, laje, telhado)
              continua nos blocos de sempre — este bloco é só o que se derruba e se refaz por cima do existente.
            </div>
            <div style={{ gridColumn: "1 / -1", fontSize: 11.5, fontWeight: 700, color: "#111827", marginTop: 8 }}>Demolir e remover</div>
            <CampoNum label="Parede a demolir (m²)" valor={get("existente.paredeDemolir")} onChange={(v) => set("existente.paredeDemolir", v)} />
            <CampoNum label="Revestimento de parede a remover (m²)" valor={get("existente.revestimentoRemover")} onChange={(v) => set("existente.revestimentoRemover", v)} />
            <CampoNum label="Piso a remover (m²)" valor={get("existente.pisoRemover")} onChange={(v) => set("existente.pisoRemover", v)} />
            <CampoNum label="Contrapiso a retirar (m²)" valor={get("existente.contrapisoRemover")} onChange={(v) => set("existente.contrapisoRemover", v)} />
            <CampoNum label="Forro a remover (m²)" valor={get("existente.forroRemover")} onChange={(v) => set("existente.forroRemover", v)} />
            <CampoNum label="Esquadrias a retirar (un)" valor={get("existente.esquadriaRetirar")} onChange={(v) => set("existente.esquadriaRetirar", v)} />
            <CampoNum label="Louças e metais a retirar (un)" valor={get("existente.loucaMetalRetirar")} onChange={(v) => set("existente.loucaMetalRetirar", v)} />

            <div style={{ gridColumn: "1 / -1", fontSize: 11.5, fontWeight: 700, color: "#111827", marginTop: 8 }}>Construir e assentar</div>
            <CampoNum label="Parede a construir (m²)" valor={get("existente.paredeConstruir")} onChange={(v) => set("existente.paredeConstruir", v)} />
            <div style={CAMPO_CELULA}>
              <label style={C.label}>Chapisco e reboco (m²)</label>
              <input style={C.input} type="number" step="0.01" value={get("existente.rebocoNovo") ?? ""}
                placeholder={`vazio: igual à parede a construir (${numOrZero(get("existente.paredeConstruir"))})`}
                onChange={(e) => set("existente.rebocoNovo", e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <CampoNum label="Contrapiso novo (m²)" valor={get("existente.contrapisoNovo")} onChange={(v) => set("existente.contrapisoNovo", v)} />
            <CampoNum label="Piso a assentar (m²)" valor={get("existente.pisoAssentar")} onChange={(v) => set("existente.pisoAssentar", v)} />
            <CampoNum label="Revestimento a assentar (m²)" valor={get("existente.revestimentoAssentar")} onChange={(v) => set("existente.revestimentoAssentar", v)} />
            <CampoNum label="Parede a pintar (m²)" valor={get("existente.pinturaExistente")} onChange={(v) => set("existente.pinturaExistente", v)} />
            <CampoNum label="Louças e metais a instalar (un)" valor={get("existente.loucaMetalInstalar")} onChange={(v) => set("existente.loucaMetalInstalar", v)} />
            <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: "#6b7280", marginTop: 6 }}>
              O entulho e as caçambas saem sozinhos do que você marcou para demolir.
              Os serviços de demolição usam o preço do catálogo de Insumos quando cadastrados;
              sem cadastro, entram com a referência do módulo e aparecem na memória de cálculo.
            </div>
          </BlocoColapsavel>
        )}

        {!ehTerrea && (
          <BlocoColapsavel titulo="Pav. Térreo" aberto={!!blocosAbertos.terreo} onToggle={() => toggleBloco("terreo")}>
            <CampoNum label="Área (m²)" valor={get("terreo.area")} onChange={(v) => set("terreo.area", v)} />
            <div style={CAMPO_CELULA}>
              <label style={C.label}>Perímetro de paredes</label>
              <input style={C.input} type="number" step="0.01" value={get("terreo.perimetroParedes") ?? ""}
                placeholder={`auto: ${autosPavimentos(projetoDraft).perimetroPavimento} (metade do Geral)`}
                onChange={(e) => set("terreo.perimetroParedes", e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            {!paredeTerreoExpandida ? (
              <div style={CAMPO_CELULA}>
                <label style={C.label}>M² de parede (considera tudo 20cm)</label>
                <input style={C.input} type="number" step="0.01" value={get("terreo.m2Parede20") ?? ""}
                  placeholder={`auto: ${autosPavimentos(projetoDraft).paredePavimento} (metade do Geral)`}
                  onChange={(e) => setParedeTerreoSimples(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
            ) : (
              <>
                <CampoNum label="M² parede 15cm" valor={get("terreo.m2Parede15")} onChange={(v) => set("terreo.m2Parede15", v)} />
                <CampoNum label="M² parede 20cm" valor={get("terreo.m2Parede20")} onChange={(v) => set("terreo.m2Parede20", v)} />
                <CampoNum label="M² parede 25cm" valor={get("terreo.m2Parede25")} onChange={(v) => set("terreo.m2Parede25", v)} />
              </>
            )}
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
              {(() => { const au = autosPavimentos(projetoDraft); return (<>
                <div style={CAMPO_CELULA}>
                  <label style={C.label}>Área construída (m²)</label>
                  <input style={C.input} type="number" step="0.01" value={get("pav1.area") ?? ""}
                    placeholder={`auto: ${au.areaPav1} (laje do térreo)`}
                    onChange={(e) => set("pav1.area", e.target.value === "" ? "" : Number(e.target.value))} />
                </div>
                <div style={CAMPO_CELULA}>
                  <label style={C.label}>Perímetro de paredes</label>
                  <input style={C.input} type="number" step="0.01" value={get("pav1.perimetroParedes") ?? ""}
                    placeholder={`auto: ${au.perimetroPavimento} (metade do Geral)`}
                    onChange={(e) => set("pav1.perimetroParedes", e.target.value === "" ? "" : Number(e.target.value))} />
                </div>
                {!paredePav1Expandida ? (
                  <div style={CAMPO_CELULA}>
                    <label style={C.label}>M² de parede (considera tudo 20cm)</label>
                    <input style={C.input} type="number" step="0.01" value={get("pav1.m2Parede20") ?? ""}
                      placeholder={`auto: ${au.paredePavimento} (metade do Geral)`}
                      onChange={(e) => setParedePav1Simples(e.target.value === "" ? "" : Number(e.target.value))} />
                  </div>
                ) : (
                  <>
                    <CampoNum label="M² parede 15cm" valor={get("pav1.m2Parede15")} onChange={(v) => set("pav1.m2Parede15", v)} />
                    <CampoNum label="M² parede 20cm" valor={get("pav1.m2Parede20")} onChange={(v) => set("pav1.m2Parede20", v)} />
                    <CampoNum label="M² parede 25cm" valor={get("pav1.m2Parede25")} onChange={(v) => set("pav1.m2Parede25", v)} />
                  </>
                )}
                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
                  <button type="button" style={{ ...C.btnGhost, fontSize: 11 }} onClick={() => setParedePav1Expandida((v) => !v)}>
                    {paredePav1Expandida ? "Simplificar (tudo 20cm)" : "Expandir espessuras de parede (15/20/25cm)"}
                  </button>
                </div>
                <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: "#4b5563" }}>
                  Em branco, cada pavimento entra com metade do que está no bloco Geral (parede {au.paredePavimento} m², perímetro {au.perimetroPavimento} m). Digitou aqui, o digitado vence.
                </div>
              </>); })()}
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

        <BlocoColapsavel titulo="Forros e Cobertura" subtitulo={`${forrosLista.length} forro${forrosLista.length !== 1 ? "s" : ""} · ${coberturas.length} telhado${coberturas.length !== 1 ? "s" : ""}`} aberto={!!blocosAbertos.cobertura} onToggle={() => toggleBloco("cobertura")}>
          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>Forros</div>
            {forrosLista.map((f, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1.2fr 1.6fr 1fr 1.6fr auto", gap: 8, alignItems: "end", padding: 10, background: "#fafafa", borderRadius: 8 }}>
                <CampoTexto label="Onde" valor={f.pavimento} onChange={(v) => updateForro(idx, "pavimento", v)} placeholder={forrosAuto[idx] ? forrosAuto[idx].pavimento : "trecho"} />
                <CampoSelect label="Tipo de forro" valor={f.tipo || FORRO_TIPO_PADRAO} onChange={(v) => updateForro(idx, "tipo", v)}
                  opcoes={FORRO_TIPOS.map((t) => ({ value: t.id, label: t.nome }))} />
                <div style={CAMPO_CELULA}>
                  <label style={C.label}>Área (m²)</label>
                  <input style={C.input} type="number" step="0.01" value={f.area ?? ""}
                    placeholder={forrosAuto[idx] ? `auto: ${forrosAuto[idx].area} (laje)` : ""}
                    onChange={(e) => updateForro(idx, "area", e.target.value === "" ? "" : Number(e.target.value))} />
                </div>
                <div style={CAMPO_CELULA}>
                  <label style={C.label}>Produto (Insumos)</label>
                  <input style={C.input} list="vk-insumos-forros" value={f.produto ?? ""} placeholder={forroTipo(f.tipo).produto}
                    onChange={(e) => updateForro(idx, "produto", e.target.value)} />
                </div>
                <button type="button" onClick={() => removeForro(idx)} style={{ ...C.btnGhost, color: "#dc2626", height: 36 }}>Remover</button>
              </div>
            ))}
            <datalist id="vk-insumos-forros">
              {(data.materiais || []).filter((m) => /forros e gesso/i.test(String(m.grupo || ""))).map((m) => <option key={m.codigo || m.nome} value={m.nome} />)}
            </datalist>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {forrosLista.length < FORROS_MAX && (
                <button type="button" style={C.btnSec} onClick={addForro}>＋ Adicionar forro</button>
              )}
              <span style={{ fontSize: 11.5, color: "#4b5563" }}>
                {forrosDigitados
                  ? "Lista sua. Para voltar ao automático, remova todos os trechos."
                  : `Automático: ${ehTerrea ? "a área da laje" : "cada pavimento com a área da sua laje"}. Edite ou acrescente trechos de outro tipo (parte em gesso, parte em madeira).`}
                {" "}O acabamento de borda (tabica ou meia-cana) sai do perímetro dos cômodos do bloco Geral.
              </span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginTop: 4 }}>Cobertura</div>
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
            <div style={{ fontSize: 11, color: "#6b7280" }}>
              Calcula o alumínio por perfil (código Alcoa e kg), o vidro 8mm (descontos de corte por tipo) e os acessórios (roldanas, fechos, dobradiças, braços, borrachas, conexões, chumbadores e parafusos), segundo a lista de perfis da linha. No orçamento aparece uma linha por esquadria com o preço fechado; a composição fica guardada no item. Correr e persiana: aba ESQUADRIAS da planilha; giro, maxim-ar e fixo: desenhos de montagem do catálogo Alcoa Gold. Para usar seus preços, cadastre o alumínio, o vidro e os acessórios em Insumos com o código Alcoa como alias.
            </div>
          </div>
        </BlocoColapsavel>

        <BlocoColapsavel titulo="Pavimentação externa" subtitulo="contrapiso externo · a área pré-preenche o piso externo" aberto={!!blocosAbertos.externa} onToggle={() => toggleBloco("externa")}>
          <CampoNum label="Pavimentação externa (m²)" valor={get("externa.pavimentacao")} onChange={(v) => set("externa.pavimentacao", v)} />
          <CampoNum label="Perímetro da pavimentação (m)" valor={get("externa.perimetroPavimentacao")} onChange={(v) => set("externa.perimetroPavimentacao", v)} />
          <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#4b5563" }}>
            A área dimensiona o contrapiso (concreto, malha pop, massiamento) e vira o automático do piso externo em Pisos e revestimentos. O perímetro só dimensiona a caixaria da borda do contrapiso (tábuas e sarrafos) — rodapé e soleira não entram aqui.
          </div>
        </BlocoColapsavel>

        <BlocoColapsavel titulo="Pisos e revestimentos" subtitulo="peça, argamassa, rejunte, espaçadores, rodapé, soleiras, bancadas e deck" aberto={!!blocosAbertos.pisos} onToggle={() => toggleBloco("pisos")}>
          <datalist id="vk-insumos-pisos">
            {(data.materiais || []).filter((m) => /pisos e revestimentos|argamassas/i.test(String(m.grupo || "")) || /^(Piso|Revestimento|Soleira|Granito)/i.test(String(m.nome || ""))).map((m) => <option key={m.codigo || m.nome} value={m.nome} />)}
          </datalist>
          <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#4b5563" }}>
            Informe os m² de cada superfície. Sem produto escolhido, entra o genérico do padrão da obra ({padraoObra(projetoDraft)}); sem formato, o tamanho típico do padrão. Peças com {Math.round((PERDA_PECAS - 1) * 100)}% de perda (recortes e quebras); a partir do formato o VICKE calcula argamassa (AC-III em porcelanato e externo, AC-II em cerâmica), rejunte pela geometria da junta, clips e cunhas (peça ≥ 60 cm) ou cruzetas, disco e salva-piso.
          </div>
          {(() => { const au = autosPisos(projetoDraft); return (
            <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#4b5563", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 12px" }}>
              Em branco, o VICKE usa o automático: piso interno = área construída ({au.pisoInterno} m²) · piso externo = pavimentação externa ({au.pisoExterno} m²) · revestimento de parede = cômodos ({au.revestimentoInterno} m²) · rodapé = perímetro das paredes menos portas ({au.rodapeM} m) · soleiras e peitoris = vão das esquadrias ({au.soleirasM} m) · bancadas = cômodos ({au.bancadas.length}). Vergas e contravergas: {au.vaos.portasInternas} porta{au.vaos.portasInternas !== 1 ? "s" : ""} interna{au.vaos.portasInternas !== 1 ? "s" : ""} de 0,80 + {au.vaos.metrosPortasExternas} m de portas externas + {au.vaos.metrosJanelas} m de janelas (verga e contraverga) = {au.vaos.metrosVergas} m de treliça.
            </div>
          ); })()}
          {SUPERFICIES_PISOS.map((sup) => (
            <div key={sup.id} style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "150px 200px 1fr", gap: 10, alignItems: "end", padding: "8px 0", borderTop: "1px solid #f3f4f6" }}>
              {sup.id === "revestimentoInterno" || sup.id === "pisoInterno" || sup.id === "pisoExterno" ? (
                <div style={CAMPO_CELULA}>
                  <label style={C.label}>{sup.nome} (m²)</label>
                  <input style={C.input} type="number" step="0.01" value={get(`pisos.${sup.id}.m2`) ?? ""}
                    placeholder={sup.id === "pisoInterno" ? `auto: ${autosPisos(projetoDraft).pisoInterno} (área construída)` : sup.id === "pisoExterno" ? `auto: ${autosPisos(projetoDraft).pisoExterno} (pavimentação externa)` : `auto: ${autosPisos(projetoDraft).revestimentoInterno} (cômodos)`}
                    onChange={(e) => set(`pisos.${sup.id}.m2`, e.target.value === "" ? "" : Number(e.target.value))} />
                </div>
              ) : (
                <CampoNum label={`${sup.nome} (m²)`} valor={get(`pisos.${sup.id}.m2`)} onChange={(v) => set(`pisos.${sup.id}.m2`, v)} />
              )}
              <CampoSelect label="Formato da peça" valor={get(`pisos.${sup.id}.formato`) || ""} onChange={(v) => set(`pisos.${sup.id}.formato`, v)}
                opcoes={[{ value: "", label: `automático (${FORMATO_PADRAO[sup.id][padraoObra(projetoDraft)] || "60x60"})` }, ...FORMATOS_PECA.map((f) => ({ value: f.id, label: f.nome }))]} />
              <div>
                <label style={C.label}>Produto (Insumos)</label>
                <input style={C.input} list="vk-insumos-pisos" value={get(`pisos.${sup.id}.produto`) ?? ""} placeholder={PISOS_GENERICOS[sup.id][padraoObra(projetoDraft)]} onChange={(e) => set(`pisos.${sup.id}.produto`, e.target.value)} />
              </div>
            </div>
          ))}
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "150px 200px 1fr", gap: 10, alignItems: "end", padding: "8px 0", borderTop: "1px solid #f3f4f6" }}>
            <div><label style={C.label}>Rodapé (m)</label><input style={C.input} type="number" step="0.01" value={get("pisos.rodapeM") ?? ""} placeholder={`auto: ${autosPisos(projetoDraft).rodapeM} (perímetro)`} onChange={(e) => set("pisos.rodapeM", e.target.value === "" ? "" : Number(e.target.value))} /></div>
            <div style={{ fontSize: 11, color: "#6b7280", paddingBottom: 8, gridColumn: isMobile ? "auto" : "2 / -1" }}>recorte do próprio piso interno, {RODAPE_ALTURA_M * 100} cm de altura — os m² entram somados ao piso</div>
          </div>
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "150px 200px 1fr", gap: 10, alignItems: "end", padding: "8px 0", borderTop: "1px solid #f3f4f6" }}>
            <div><label style={C.label}>Soleiras e peitoris (m)</label><input style={C.input} type="number" step="0.01" value={get("pisos.soleirasM") ?? ""} placeholder={`auto: ${autosPisos(projetoDraft).soleirasM} (esquadrias)`} onChange={(e) => set("pisos.soleirasM", e.target.value === "" ? "" : Number(e.target.value))} /></div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>largura {SOLEIRA_LARGURA_M * 100} cm</div>
            <div><label style={C.label}>Produto (Insumos)</label><input style={C.input} list="vk-insumos-pisos" value={get("pisos.soleirasProduto") ?? ""} placeholder={soleiraPadrao(padraoObra(projetoDraft))} onChange={(e) => set("pisos.soleirasProduto", e.target.value)} /></div>
          </div>
          <div style={{ gridColumn: "1 / -1", padding: "8px 0", borderTop: "1px solid #f3f4f6" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 4 }}>Bancadas de granito / mármore <span style={{ fontWeight: 400, color: "#6b7280" }}>— tampo + saia + fundo (rodabanca) + sapatas, em m² de pedra pronta</span></div>
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
                      <div><label style={C.label}>Pedra (Insumos)</label><input style={C.input} list="vk-insumos-pisos" value={b.produto ?? ""} placeholder={granitoPadrao(padraoObra(projetoDraft))} onChange={(e) => updateBancada(idx, "produto", e.target.value)} /></div>
                      <div style={{ fontSize: 12, color: "#111827", paddingBottom: 8 }}>
                        <b>{m.total.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²</b>
                        <span style={{ color: "#6b7280" }}> · tampo {m.tampo} · saia {m.saia} · fundo {m.fundo} · sapatas {m.sapatas}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {bancadasLista.length < BANCADAS_MAX && (
                <button type="button" style={{ ...C.btnSec, alignSelf: "flex-start" }} onClick={addBancada}>＋ Adicionar bancada</button>
              )}
              {bancadasLista.length === 0 && estimarPelosComodos(projetoDraft).bancadas.length > 0 && (
                <div style={{ fontSize: 12, color: "#111827", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px" }}>
                  Automático pelos cômodos: {estimarPelosComodos(projetoDraft).bancadas.map((b) => `${b.nome} ${Number(b.comprimento).toLocaleString("pt-BR")} × ${Number(b.profundidade).toLocaleString("pt-BR")} m`).join(" · ")} — em {granitoPadrao(padraoObra(projetoDraft))}. Adicione bancadas aqui para substituir.
                </div>
              )}
              {bancadasLista.length === 0 && numOrZero(get("pisos.bancadasM2")) > 0 && (
                <div style={{ fontSize: 11, color: "#b45309" }}>Este projeto tem {get("pisos.bancadasM2")} m² de bancada no campo antigo; adicione as bancadas acima para detalhar (o campo antigo deixa de valer quando houver lista).</div>
              )}
            </div>
          </div>
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "150px 200px 1fr", gap: 10, alignItems: "end", padding: "8px 0", borderTop: "1px solid #f3f4f6" }}>
            <CampoNum label="Deck (m²)" valor={get("pisos.deckM2")} onChange={(v) => set("pisos.deckM2", v)} />
            <div style={{ fontSize: 11, color: "#6b7280" }}>+ Cetol 1 lata / 20 m²</div>
            <div><label style={C.label}>Produto (Insumos)</label><input style={C.input} list="vk-insumos-pisos" value={get("pisos.deckProduto") ?? ""} placeholder="Piso - Deck" onChange={(e) => set("pisos.deckProduto", e.target.value)} /></div>
          </div>
        </BlocoColapsavel>

        <BlocoColapsavel titulo="Instalações" subtitulo={`estimativa por kits a partir dos cômodos do bloco Geral · padrão ${padraoInstalacoes(padraoObra(projetoDraft))}`} aberto={!!blocosAbertos.ambientes} onToggle={() => toggleBloco("ambientes")}>
          <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#4b5563" }}>
            Sem projeto de engenharia, hidráulica, esgoto, elétrica, louças e portas são estimados por conjuntos de pontos por cômodo (prática do SINAPI), com os kits de Insumos → Composições e os cômodos informados no bloco Geral. Padrão Alto e Altíssimo usam os kits de acabamento superior.
          </div>
          <CampoSelect label="Aquecimento de água" valor={get("instalacoes.aquecimento") || "nenhum"} onChange={(v) => set("instalacoes.aquecimento", v)}
            opcoes={(typeof SISTEMAS_AQUECIMENTO !== "undefined" ? SISTEMAS_AQUECIMENTO : []).map((x) => ({ value: x.id, label: x.nome }))} />
          <CampoSelect label="Pressurizador" valor={get("instalacoes.pressurizador") ? "sim" : "nao"} onChange={(v) => set("instalacoes.pressurizador", v === "sim")} opcoes={[{ value: "nao", label: "Não" }, { value: "sim", label: "Sim" }]} />
          <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 6 }}>Disciplinas que vêm do projeto de engenharia (a estimativa por kits sai destas):</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {ETAPAS_PROJETO.filter((e) => DISCIPLINAS_INSTALACOES.includes(e.id)).map((e) => {
                const marcado = !!get(`instalacoes.doProjeto.${e.id}`);
                const temItens = itensProjetoLista.some((it) => it.etapa === e.id && it.nome);
                return (
                  <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#111827", padding: "6px 10px", border: "1px solid rgba(38,36,33,0.14)", borderRadius: 8, background: marcado ? "#eef2ff" : "#fff", cursor: "pointer" }}>
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
            <div style={{ fontSize: 12, color: "#4b5563" }}>
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
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 6 }}>{et.nome} <span style={{ color: "#6b7280", fontWeight: 400 }}>· {doGrupo.length}</span></div>
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
          <div style={{ gridColumn: "1 / -1", fontSize: 12, fontWeight: 700, color: "#0474f4", textTransform: "uppercase", letterSpacing: 0.6 }}>Pav. Térreo</div>
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
              <div style={{ gridColumn: "1 / -1", fontSize: 12, fontWeight: 700, color: "#0474f4", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 8 }}>Pav. 1</div>
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

          <div style={{ gridColumn: "1 / -1", fontSize: 12, fontWeight: 700, color: "#0474f4", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 8 }}>Cobertura</div>
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

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : `repeat(${prazoObra ? 6 : 5}, 1fr)`, gap: 12, marginBottom: 16 }}>
        {[
          ...(prazoObra ? [["Prazo", `${Number(prazoObra.meses).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} meses`, prazoObra.dataFim ? `entrega ${fmtDataCrono(prazoObra.dataFim)}` : ""]] : []),
          ["Total geral", formatoBRL(orc.totais.geral)],
          ["Bruto", formatoBRL(orc.totais.bruto)],
          ["Acabamento", formatoBRL(orc.totais.acabamento)],
          ["Prestadores", formatoBRL(orc.totais.prestadores)],
          ["Custo por m²", formatoBRL(custoPorM2)],
        ].map(([label, valor, rodape]) => (
          <div key={label} style={{ background: "#fafafa", border: "1px solid #f3f4f6", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{valor}</div>
            {rodape ? <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{rodape}</div> : null}
          </div>
        ))}
      </div>

      {orc.qualidade ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#111827" }}>
            <b>{orc.qualidade.comPreco} de {orc.qualidade.total} itens precificados</b>
            {" · "}{orc.qualidade.alta + orc.qualidade.media} com preço atual
            {" · "}{orc.qualidade.baixa + orc.qualidade.obsoleta} corrigidos pelo INCC ou antigos
            {orc.qualidade.manual ? ` · ${orc.qualidade.manual} manual` : ""}
            {orc.qualidade.semPreco.length ? ` · ${orc.qualidade.semPreco.length} sem preço (R$ 0)` : ""}
            <span style={{ color: "#6b7280" }}> — gerado em {new Date(orc.geradoEm).toLocaleDateString("pt-BR")}; recalcule para usar preços novos.</span>
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
            <div style={{ fontSize: 12, color: "#4b5563" }}>{itensPorEtapa.length} etapas · {orc.itens.length} itens</div>
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
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>{grupo.etapa}</span>
                <span style={{ fontSize: 12, color: "#4b5563" }}>{formatoBRL(subtotal)} {colapsado ? "▼" : "▲"}</span>
              </button>
              {!colapsado && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 560 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "#6b7280", fontSize: 10, textTransform: "uppercase" }}>
                      <th style={{ padding: "6px 14px" }}>Item</th>
                      <th style={{ padding: "6px 14px" }}>Unidade</th>
                      <th style={{ padding: "6px 14px", textAlign: "right" }}>Qtd</th>
                      <th style={{ padding: "6px 14px", textAlign: "right" }}>Preço</th>
                      <th style={{ padding: "6px 14px", textAlign: "right" }}>Total</th>
                      <th style={{ padding: "6px 6px", width: 28 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.itens.map((i, idx) => (
                      <tr key={idx} style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "6px 14px", color: "#111827" }}>{i.item}</td>
                        <td style={{ padding: "6px 14px", color: "#4b5563" }}>{i.unidade}</td>
                        <td style={{ padding: "6px 14px", textAlign: "right", color: "#111827" }}>{Number(i.qtd).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                        <td style={{ padding: "6px 14px", textAlign: "right", color: "#111827", whiteSpace: "nowrap" }} title={rotuloConfianca(i)}>
                          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 4, marginRight: 6, background: corConfianca(i.confianca, i.semPreco) }} />
                          {formatoBRL(i.preco)}
                        </td>
                        <td style={{ padding: "6px 14px", textAlign: "right", color: "#111827", fontWeight: 600 }}>{formatoBRL(i.total)}</td>
                        <td style={{ padding: "6px 6px", textAlign: "center" }}>
                          {memorias[chaveMemoria(i)] && (
                            <button type="button" onClick={() => setMemoriaAberta(i)} title="Memória de cálculo: como se chegou nesta quantidade"
                              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 2, color: "#6b7280", fontFamily: "inherit" }}>⚙</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 16 }}>
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

      {memoriaAberta && (
        <MemoriaCalculo item={memoriaAberta} passos={memorias[chaveMemoria(memoriaAberta)]} onFechar={() => setMemoriaAberta(null)} />
      )}
    </div>
  );
}
