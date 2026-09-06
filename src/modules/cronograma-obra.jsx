// ═══════════════════════════════════════════════════════════════
// CRONOGRAMA-OBRA — Prazo, rede de etapas, produtividade e físico-financeiro
// ═══════════════════════════════════════════════════════════════
// Motor puro (sem React) + UI. Entra no combine.js depois de
// orcamento-obra.jsx (usa normalizarProjeto, calcularTelhado, ambientesAtivos)
// e antes de clientes.jsx. Dados de partida em cronograma-seed.jsx.
// Spec: docs/SPEC-CRONOGRAMA.md.
//
// Dois modos, mesma rede de etapas (CPM com FS/SS, folga e caminho crítico):
//   simplificado  — prazo total pela tabela área × tipologia (ou digitado);
//                   as durações-base das etapas são escaladas por um fator
//                   único, achado por bisseção, até o caminho crítico bater
//                   exatamente com esse prazo.
//   produtividade — horas-homem por etapa = Σ quantidade medida × horas por
//                   unidade (SINAPI); duração = HH ÷ (equipe × 8 h × eficiência).
//                   Etapa sem serviço medido usa a duração paramétrica do modo
//                   simplificado. Dado um prazo-alvo, a mesma conta ao
//                   contrário dimensiona a equipe.
// ═══════════════════════════════════════════════════════════════

// ── Configuração ativa: semente + overrides do escritório ──
function cronogramaCfg(data) {
  return (data && data.escritorio && data.escritorio.cronograma) || {};
}
function etapasCronogramaAtivas(data) {
  const seed = typeof ETAPAS_CRONOGRAMA_SEED !== "undefined" ? ETAPAS_CRONOGRAMA_SEED : [];
  const ov = cronogramaCfg(data).etapas || {};
  return seed.map((e) => {
    const o = ov[e.id];
    if (!o || o.duracaoBase == null) return e;
    const d = Number(o.duracaoBase);
    return Number.isFinite(d) && d > 0 ? { ...e, duracaoBase: d, editado: true } : e;
  });
}
function servicosCronogramaAtivos(data) {
  const seed = typeof PRODUTIVIDADE_SEED !== "undefined" ? PRODUTIVIDADE_SEED : {};
  const ov = cronogramaCfg(data).servicos || {};
  const out = {};
  for (const id of Object.keys(seed)) {
    const o = ov[id];
    out[id] = o && o.horas ? { ...seed[id], horas: { ...seed[id].horas, ...o.horas }, editado: true } : seed[id];
  }
  return out;
}
function prazoTabelaAtiva(data) {
  const cfg = cronogramaCfg(data);
  const seed = typeof PRAZO_TABELA_SEED !== "undefined" ? PRAZO_TABELA_SEED : [];
  const tab = Array.isArray(cfg.prazoTabela) && cfg.prazoTabela.length ? cfg.prazoTabela : seed;
  return tab
    .map((l) => ({ area: Number(l.area), terrea: Number(l.terrea) }))
    .filter((l) => l.area > 0 && l.terrea > 0)
    .sort((a, b) => a.area - b.area);
}
function extraSobradoMeses(data) {
  const cfg = cronogramaCfg(data);
  const v = Number(cfg.sobradoExtra);
  return Number.isFinite(v) ? v : (typeof PRAZO_SOBRADO_EXTRA_MESES !== "undefined" ? PRAZO_SOBRADO_EXTRA_MESES : 1.5);
}
// Preço da hora por ofício: valor do escritório (data.escritorio.cronograma
// .precoHora[oficio]) vence; senão SINAPI no regime pedido (desonerado padrão).
function precosHoraAtivos(data, regime) {
  const seed = typeof PRECO_HORA_SEED !== "undefined" ? PRECO_HORA_SEED : {};
  const ov = cronogramaCfg(data).precoHora || {};
  const reg = regime === "onerado" ? "onerado" : "desonerado";
  const out = {};
  for (const id of Object.keys({ ...seed, ...ov })) {
    const s = seed[id], o = Number(ov[id]);
    if (Number.isFinite(o) && o > 0) out[id] = { preco: o, fonte: "escritório", codigo: s ? s.codigo : null, sinapi: s || null, regime: reg };
    else if (s) out[id] = { preco: s[reg], fonte: "SINAPI " + s.codigo, codigo: s.codigo, sinapi: s, regime: reg };
  }
  return out;
}
function prestadorDoServico(etapaId, servicoId) {
  const pe = typeof PRESTADOR_POR_ETAPA !== "undefined" ? PRESTADOR_POR_ETAPA : {};
  const ps = typeof PRESTADOR_POR_SERVICO !== "undefined" ? PRESTADOR_POR_SERVICO : {};
  return pe[etapaId] || ps[servicoId] || "outros";
}
// Custo de mão de obra de referência: HH medidas × R$/h, agrupado pelo
// prestador do orçamento que executa cada serviço; comparado ao valor
// contratado (linhas "Prestadores de serviços" do orçamento). Também grava
// `custoRef` em cada linha de medição.
function maoDeObraReferencia(medicoesDetalhe, precoHora, eficiencia, orcamento, areaConstruida) {
  const r2 = (x) => Math.round(x * 100) / 100;
  const rotulos = typeof PRESTADORES_ROTULO !== "undefined" ? PRESTADORES_ROTULO : {};
  const nomeDe = typeof INSUMO_PRESTADOR !== "undefined" ? INSUMO_PRESTADOR : {};
  const porPrestador = {}, porOficio = {};
  for (const m of medicoesDetalhe) {
    const chave = prestadorDoServico(m.etapa, m.servico);
    const p = porPrestador[chave] || (porPrestador[chave] = { chave, rotulo: rotulos[chave] || chave, hh: 0, custoRef: 0, servicos: [] });
    let custoLinha = 0;
    for (const of of Object.keys(m.horas || {})) {
      const ph = precoHora[of];
      const c = ph ? m.horas[of] * ph.preco : 0;
      custoLinha += c;
      p.hh += m.horas[of];
      const o = porOficio[of] || (porOficio[of] = { hh: 0, custoRef: 0, precoHora: ph ? ph.preco : 0, fonte: ph ? ph.fonte : "sem preço" });
      o.hh += m.horas[of];
      o.custoRef += c;
    }
    m.custoRef = r2(custoLinha);
    p.custoRef += custoLinha;
    if (!p.servicos.includes(m.servico)) p.servicos.push(m.servico);
  }
  const itens = (orcamento && Array.isArray(orcamento.itens)) ? orcamento.itens : [];
  const ef = eficiencia > 0 ? eficiencia : 1;
  const lista = Object.values(porPrestador).map((p) => {
    const nome = nomeDe[p.chave];
    const orcadoItens = nome ? itens.filter((i) => i.tipo === "Prestadores de serviços" && i.item === nome) : [];
    const orcado = orcadoItens.length ? orcadoItens.reduce((a, i) => a + numOrZero(i.total), 0) : null;
    return { ...p, hh: Math.round(p.hh), custoRef: r2(p.custoRef), custoEficiencia: r2(p.custoRef / ef), orcado: orcado != null ? r2(orcado) : null, temPrestador: !!nome };
  }).sort((a, b) => b.custoRef - a.custoRef);
  const totalRef = r2(lista.reduce((a, p) => a + p.custoRef, 0));
  const totalOrcadoComparavel = r2(lista.filter((p) => p.orcado != null).reduce((a, p) => a + p.orcado, 0));
  const totalRefComparavel = r2(lista.filter((p) => p.orcado != null).reduce((a, p) => a + p.custoRef, 0));
  for (const of of Object.keys(porOficio)) { porOficio[of].hh = Math.round(porOficio[of].hh); porOficio[of].custoRef = r2(porOficio[of].custoRef); }
  const area = numOrZero(areaConstruida);
  return {
    porPrestador: lista, porOficio, totalRef, totalEficiencia: r2(totalRef / ef), totalOrcadoComparavel, totalRefComparavel,
    porM2Ref: area > 0 ? r2(totalRef / area) : null, porM2Eficiencia: area > 0 ? r2(totalRef / ef / area) : null,
    eficiencia: ef, regime: Object.values(precoHora)[0] ? Object.values(precoHora)[0].regime : "desonerado",
  };
}
function equipePadrao() {
  const out = {};
  for (const o of (typeof OFICIOS !== "undefined" ? OFICIOS : [])) out[o.id] = o.padrao;
  return out;
}

// ── Prazo paramétrico (meses) — tabela interpolada, não por faixa ──
// O modelo antigo arredondava a área para a faixa seguinte (125 m² → 150) e
// aplicava a tabela como degrau; aqui interpola entre as linhas e, acima da
// última, extrapola com a inclinação do último trecho.
function prazoParametricoMeses(areaConstruida, tipologia, data) {
  const tab = prazoTabelaAtiva(data);
  const area = numOrZero(areaConstruida);
  if (!tab.length || area <= 0) return 0;
  let meses;
  if (area <= tab[0].area) meses = tab[0].terrea;
  else {
    let i = tab.findIndex((l) => l.area >= area);
    if (i === -1) i = tab.length - 1;
    const a = tab[i - 1], b = tab[i];
    meses = a.terrea + (b.terrea - a.terrea) * (area - a.area) / (b.area - a.area);
  }
  if (tipologia === "Sobrado") meses += extraSobradoMeses(data);
  return Math.round(meses * 10) / 10;
}

// ── Medições: quantidades de serviço por etapa, dos mesmos inputs do orçamento ──
function ferroKgDe(obj) {
  // metros por bitola → kg (PESOS_FERRO é kg por barra de 12 m); recursivo
  // para {estacas:{...}, sapatas:{...}}.
  if (!obj || typeof obj !== "object") return 0;
  let kg = 0;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (k in PESOS_FERRO) kg += numOrZero(v) * PESOS_FERRO[k] / BARRA_FERRO_MTS;
    else if (v && typeof v === "object") kg += ferroKgDe(v);
  }
  return kg;
}
function ferroColunasAchatado(cp, sufixo) {
  const o = {};
  for (const k of Object.keys(PESOS_FERRO)) o[k] = numOrZero(cp[k.toLowerCase() + sufixo]);
  return o;
}
function condicoesObra(cp) {
  return {
    sobrado: cp.tipologia === "Sobrado",
    arrimo: cp.arrimo.comprimento > 0 && cp.arrimo.altura > 0,
    muro: cp.comprimentoMuroDivisa > 0 && cp.alturaMuroDivisa > 0,
    piscina: cp.piscina.areaConstruida > 0,
    pavimentacao: cp.pavimentacaoExterna > 0,
  };
}
const ALTURA_PILAR_M = 2.8;
function medicoesCronograma(projeto, data) {
  const cp = normalizarProjeto(projeto);
  const m = [];
  const add = (etapa, servico, qtd, nota) => {
    const q = Math.round(numOrZero(qtd) * 100) / 100;
    if (q > 0) m.push({ etapa, servico, qtd: q, nota });
  };
  const sobrado = cp.tipologia === "Sobrado";

  // Telhado por tipo (calcularTelhado dá a área inclinada de cada água)
  const telhado = { ceramica: 0, fibro: 0, metalica: 0, total: 0 };
  for (const t of cp.coberturas) {
    if (!t.tipo || !(t.comprimento > 0) || !(t.largura > 0)) continue;
    const a = numOrZero(calcularTelhado(t).areaInclinada);
    if (TELHAS_FIBROCIMENTO.includes(t.tipo)) telhado.fibro += a;
    else if (TELHAS_METALICAS.includes(t.tipo)) telhado.metalica += a;
    else telhado.ceramica += a;
    telhado.total += a;
  }

  // Fundação
  const f = cp.fundacao;
  add("FUNDACAO", "BROCA", f.qtdEstacas * f.profEstacas);
  add("FUNDACAO", "ESCAVACAO", cp.perimetroParedesTerreo * 0.3 * 0.5, "vala 30 × 50 cm no perímetro das paredes do térreo");
  add("FUNDACAO", "CONCRETO", f.concreto.estacas + f.concreto.sapatas + f.concreto.arranques + f.concreto.baldrames);
  add("FUNDACAO", "ARMACAO", ferroKgDe(f.ferro));
  add("FUNDACAO", "FORMA", cp.perimetroParedesTerreo * 0.3 * 2, "duas faces de 30 cm dos baldrames");
  add("IMPERM_BALDRAME", "IMPERM_BALDRAME", cp.perimetroParedesTerreo * 0.5, "topo e laterais do baldrame (50 cm) no perímetro");
  add("CONTRAPISO_TERREO", "CONTRAPISO", cp.areaTerreo);

  // Térreo
  add("PAREDES_TERREO", "ALVENARIA", cp.m2Paredes15Terreo + cp.m2Paredes20Terreo + cp.m2Paredes25Terreo);
  add("PAREDES_TERREO", "VERGAS", cp.vaoPortasJanelasTerreo * 2, "verga + contraverga por metro de vão");
  add("PAREDES_TERREO", "CONCRETO", cp.concrColunaTerreo);
  add("PAREDES_TERREO", "ARMACAO", ferroKgDe(ferroColunasAchatado(cp, "ColunaTerreo")));
  add("PAREDES_TERREO", "FORMA", (cp.colunas15Terreo * 0.6 + cp.colunas20Terreo * 0.8 + cp.colunas30Terreo * 1.2) * ALTURA_PILAR_M + cp.areaFormaColunaMaior25cmTerreo, "perímetro dos pilares × 2,80 m");
  add("LAJE_TERREO", "LAJE", cp.terreo.areaLoje);
  add("LAJE_TERREO", "CONCRETO", cp.terreo.concretoVigaRespaldo + cp.terreo.areaLojeMacica * 0.1);
  add("LAJE_TERREO", "ARMACAO", ferroKgDe(cp.terreo.vigaRespaldo));
  add("LAJE_TERREO", "FORMA", cp.terreo.perimetroLoje * 0.4 + cp.terreo.areaLojeMacica, "duas faces de 20 cm da viga de respaldo + fundo da laje maciça");

  // Pav. 1
  if (sobrado) {
    const p = cp.pav1;
    add("PAREDES_PAV1", "ALVENARIA", p.m2Parede15 + p.m2Parede20 + p.m2Parede25);
    add("PAREDES_PAV1", "VERGAS", p.vaoPortasJanelas * 2, "verga + contraverga por metro de vão");
    add("PAREDES_PAV1", "CONCRETO", p.concrColuna);
    add("PAREDES_PAV1", "ARMACAO", ferroKgDe(p.ferro));
    add("PAREDES_PAV1", "FORMA", (p.colunas15 * 0.6 + p.colunas20 * 0.8 + p.colunas25 * 1.0 + p.colunas30 * 1.2) * ALTURA_PILAR_M + p.areaFormaColunaMaior25cm, "perímetro dos pilares × 2,80 m");
    add("LAJE_PAV1", "LAJE", p.areaLoje);
    add("LAJE_PAV1", "CONCRETO", p.concretoVigaRespaldo + p.areaLojeMacica * 0.1);
    add("LAJE_PAV1", "ARMACAO", ferroKgDe(p.vigaRespaldo));
    add("LAJE_PAV1", "FORMA", p.perimetroLoje * 0.4 + p.areaLojeMacica, "duas faces de 20 cm da viga de respaldo + fundo da laje maciça");
    add("CONTRAPISO_PAV1", "CONTRAPISO", Math.max(0, cp.areaConstruida - cp.areaTerreo), "área construída menos a do térreo");
  }

  // Cobertura
  const cb = cp.cobertura;
  add("COBERTURA", "CONCRETO", cb.volumeConcretoColunaRespaldo + cb.volumeConcretoVigaRespaldo);
  add("COBERTURA", "ARMACAO", ferroKgDe(cb.vigaFerro) + ferroKgDe(cb.colunaFerro));
  add("COBERTURA", "FORMA", (cb.colunas15 * 0.6 + cb.colunas20 * 0.8 + cb.colunas25 * 1.0) * ALTURA_PILAR_M + cb.areaFormaColunaMaior25cm, "perímetro dos pilares × 2,80 m");
  add("COBERTURA", "MADEIRAMENTO", telhado.total);
  add("COBERTURA", "TELHA_CERAMICA", telhado.ceramica);
  add("COBERTURA", "TELHA_FIBRO", telhado.fibro);
  add("COBERTURA", "TELHA_METALICA", telhado.metalica);

  // Instalações por ambiente (mesma contagem da estimativa por kits)
  const tipos = typeof AMBIENTES_TIPOS !== "undefined" ? AMBIENTES_TIPOS : [];
  const tiposAtivos = typeof ambientesAtivos === "function" ? ambientesAtivos(data) : tipos;
  let luz = 0, tomadas = 0, hidro = 0, esgoto = 0, portas = 0, banheiros = 0;
  for (const t of tiposAtivos) {
    const n = numOrZero(cp.ambientes[t.id]);
    if (!n) continue;
    const pt = t.pontos || {};
    luz += n * (numOrZero(pt.iluminacao) + numOrZero(pt.iluminacaoParalela));
    tomadas += n * (numOrZero(pt.tomadaGeral) + numOrZero(pt.tomadaEspecifica) + numOrZero(pt.chuveiro));
    const kits = t.kits || {};
    const kh = kits.HIDRAULICA || [], ke = kits.ESGOTO || [];
    if (kh.includes("AGUA_FRIA_BANHEIRO")) { hidro += n; banheiros += n; } else if (kh.length) hidro += n * 0.5;
    if (ke.includes("ESGOTO_BANHEIRO")) esgoto += n; else if (ke.length) esgoto += n * 0.5;
    if ((kits.PORTAS || []).length) portas += n;
  }
  add("INSTALACOES", "PONTO_LUZ", luz);
  add("INSTALACOES", "PONTO_TOMADA", tomadas);
  add("INSTALACOES", "HIDRO_BANHEIRO", hidro, "banheiro = 1; cozinha, lavanderia, gourmet = 0,5");
  add("INSTALACOES", "ESGOTO_BANHEIRO", esgoto, "banheiro = 1; cozinha, lavanderia, gourmet = 0,5");

  // Reboco e pintura — mesmas áreas do orçamento (duas faces das internas,
  // face interna + externa das externas)
  const faceInt = cp.m2ParedesInternas * 2 + cp.m2ParedesExternas;
  const faceExt = cp.m2ParedesExternas;
  add("REBOCO", "CHAPISCO_INT", faceInt);
  add("REBOCO", "REBOCO_INT", faceInt);
  add("REBOCO", "CHAPISCO_EXT", faceExt);
  add("REBOCO", "REBOCO_EXT", faceExt);
  add("IMPERM_MOLHADAS", "IMPERM_MANTA", banheiros * 5 + cp.arrimo.comprimento * cp.arrimo.altura, "5 m² por banheiro + face do arrimo");

  // Externa
  add("CONTRAPISO_EXTERNO", "CALCADA", cp.pavimentacaoExterna);
  const m2Muro = cp.comprimentoMuroDivisa * cp.alturaMuroDivisa;
  add("MURO_DIVISA", "ALVENARIA", m2Muro);
  add("MURO_DIVISA", "CHAPISCO_EXT", m2Muro * 2, "duas faces");
  add("MURO_DIVISA", "REBOCO_EXT", m2Muro * 2, "duas faces");
  const ar = cp.arrimo;
  add("ARRIMO", "BROCA", ar.qtdEstacas * ar.profEstacas);
  add("ARRIMO", "CONCRETO", Object.keys(ar.concreto).reduce((a, k) => a + numOrZero(ar.concreto[k]), 0));
  add("ARRIMO", "ARMACAO", ferroKgDe(ar.ferro));
  add("ARRIMO", "FORMA", ar.comprimento * ar.altura * 2, "duas faces do arrimo");
  const pi = cp.piscina;
  add("PISCINA", "BROCA", pi.qtdEstacas * pi.profundidadeEstacas);
  add("PISCINA", "CONCRETO", Object.keys(pi.concreto).reduce((a, k) => a + numOrZero(pi.concreto[k]), 0));
  add("PISCINA", "ARMACAO", ferroKgDe(pi.ferro));
  add("PISCINA", "ALVENARIA", pi.paredesM2Total);
  add("PISCINA", "REBOCO_INT", pi.paredesM2Total + pi.areaConstruida);
  add("PISCINA", "AZULEJO", pi.paredesM2Total + pi.areaConstruida);

  // Acabamentos
  add("REVESTIMENTOS", "AZULEJO", cp.revestimentoInterno);
  add("REVESTIMENTOS", "PISO_CERAMICO", cp.areaConstruida, "área construída");
  add("FORROS", "FORRO_GESSO", cp.areaConstruida, "área construída — zere o serviço em Composições se a obra não tem forro");
  add("ESQUADRIAS", "ESQUADRIA", cp.esquadrias.reduce((a, e) => a + e.qtd * e.largura * e.altura, 0));
  add("PINTURA", "PINTURA_INT", Math.max(0, cp.m2ParedesInternas - cp.revestimentoInterno) * 2 + cp.m2ParedesExternas);
  add("PINTURA", "PINTURA_EXT", cp.m2ParedesExternas + m2Muro * 2);
  add("PORTAS", "PORTA", portas);

  return { cp, medicoes: m, telhado };
}

// ── Rede: etapas ativas na obra, com predecessoras resolvidas ──
// Etapa fora da obra (sem arrimo, térrea…) sai da rede; quem dependia dela
// passa a depender das predecessoras dela, com o mesmo tipo de vínculo.
function resolverRedeCronograma(etapas, cond) {
  const porId = {};
  for (const e of etapas) porId[e.id] = e;
  const ativa = (e) => !e.condicao || !!cond[e.condicao];
  const ativos = etapas.filter(ativa);
  const ativoIds = new Set(ativos.map((e) => e.id));

  function predsDe(e, visitados) {
    const out = [];
    for (const l of e.predecessoras || []) {
      if (ativoIds.has(l.id)) out.push({ id: l.id, tipo: l.tipo === "SS" ? "SS" : "FS", lag: numOrZero(l.lag), avanco: l.avanco == null ? 0 : Number(l.avanco) });
      else {
        const p = porId[l.id];
        if (p && !visitados.has(p.id)) { visitados.add(p.id); for (const l2 of predsDe(p, visitados)) out.push(l2); }
      }
    }
    // de-duplica por id+tipo (fica o vínculo mais restritivo)
    const dedup = {};
    for (const l of out) {
      const k = l.id + "|" + l.tipo;
      if (!dedup[k] || l.lag > dedup[k].lag || l.avanco > dedup[k].avanco) dedup[k] = l;
    }
    return Object.values(dedup);
  }
  return ativos.map((e) => ({ ...e, links: predsDe(e, new Set([e.id])) }));
}

// ── CPM: passagem à frente e para trás, folga e caminho crítico ──
// Durações em dias úteis (fracionárias). FS: ES ≥ EF(pred) + lag;
// SS: ES ≥ ES(pred) + avanco × duração(pred).
function cpmCronograma(rede, duracoes) {
  const ids = rede.map((e) => e.id);
  const porId = {};
  for (const e of rede) porId[e.id] = e;
  const dur = {};
  for (const id of ids) dur[id] = Math.max(0, numOrZero(duracoes[id]));

  // ordem topológica (Kahn); vínculo para etapa desconhecida é ignorado
  const grau = {}, suc = {};
  for (const id of ids) { grau[id] = 0; suc[id] = []; }
  for (const e of rede) for (const l of e.links) if (porId[l.id]) { grau[e.id]++; suc[l.id].push({ id: e.id, link: l }); }
  const fila = ids.filter((id) => grau[id] === 0);
  const ordem = [];
  while (fila.length) {
    const id = fila.shift();
    ordem.push(id);
    for (const s of suc[id]) if (--grau[s.id] === 0) fila.push(s.id);
  }
  const ciclo = ordem.length !== ids.length;

  const ES = {}, EF = {};
  for (const id of ordem) {
    let es = 0;
    for (const l of porId[id].links) {
      if (!porId[l.id]) continue;
      if (l.tipo === "SS") es = Math.max(es, ES[l.id] + l.avanco * dur[l.id]);
      else es = Math.max(es, EF[l.id] + l.lag);
    }
    ES[id] = Math.max(0, es);
    EF[id] = ES[id] + dur[id];
  }
  const fim = ordem.reduce((a, id) => Math.max(a, EF[id]), 0);

  const LF = {}, LS = {};
  for (let i = ordem.length - 1; i >= 0; i--) {
    const id = ordem[i];
    let lf = fim;
    for (const s of suc[id]) {
      const l = s.link;
      if (l.tipo === "SS") lf = Math.min(lf, LS[s.id] - l.avanco * dur[id] + dur[id]);
      else lf = Math.min(lf, LS[s.id] - l.lag);
    }
    LF[id] = lf;
    LS[id] = lf - dur[id];
  }

  const etapas = rede.map((e) => {
    const folga = Math.max(0, LS[e.id] - ES[e.id]);
    return { id: e.id, nome: e.nome, grupo: e.grupo, inicio: ES[e.id], fim: EF[e.id], duracao: dur[e.id], folga, critico: folga < 0.01 && dur[e.id] > 0, links: e.links };
  });
  return { fim, etapas, ciclo };
}

// Bisseção de um multiplicador k tal que f(k) ≈ alvo, f crescente.
function bissecao(f, alvo, lo, hi) {
  if (f(hi) < alvo) return hi;
  if (f(lo) > alvo) return lo;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < alvo) lo = mid; else hi = mid;
    if (hi - lo < 1e-6) break;
  }
  return (lo + hi) / 2;
}

// ── Calendário: dias úteis → datas (fins de semana e feriados nacionais) ──
function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}
const _feriadosCache = {};
function feriadosDoAno(ano) {
  if (_feriadosCache[ano]) return _feriadosCache[ano];
  const s = new Set();
  const fixos = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];
  for (const f of fixos) s.add(`${ano}-${f}`);
  const p = pascoa(ano);
  for (const off of [-48, -47, -2, 60]) { // carnaval (2ª e 3ª), sexta santa, corpus christi
    const d = new Date(p.getTime() + off * 86400000);
    s.add(d.toISOString().slice(0, 10));
  }
  _feriadosCache[ano] = s;
  return s;
}
function ehDiaUtil(d) {
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !feriadosDoAno(d.getUTCFullYear()).has(d.toISOString().slice(0, 10));
}
function dataUTC(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}
// Data do n-ésimo dia útil a partir de `inicio` (n = 0 → primeiro dia útil ≥ inicio).
function dataDoDiaUtil(inicio, n) {
  const d = new Date(inicio.getTime());
  let restam = Math.max(0, Math.round(n));
  while (!ehDiaUtil(d)) d.setUTCDate(d.getUTCDate() + 1);
  while (restam > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (ehDiaUtil(d)) restam--;
  }
  return d;
}
function isoData(d) { return d ? d.toISOString().slice(0, 10) : null; }
function chaveMes(d) { return d.toISOString().slice(0, 7); }

// ── Físico-financeiro: custo por etapa distribuído por dia útil → por mês ──
function custoPorEtapaCronograma(rede, itens) {
  const custo = {};
  let geral = 0;
  for (const e of rede) custo[e.id] = 0;
  for (const it of itens || []) {
    const total = numOrZero(it.total);
    // nome da etapa do orçamento vence a ordem (ex.: "Contrapiso Interno Pav 1"
    // tem a mesma ordem do contrapiso do térreo)
    const e = rede.find((x) => (x.custoEtapas || []).includes(it.etapa)) || rede.find((x) => (x.custoOrdens || []).includes(it.ordem));
    if (e) custo[e.id] += total; else geral += total;
  }
  return { custo, geral };
}
function fisicoFinanceiro(cpmRes, rede, itens, dataInicio) {
  const { custo, geral } = custoPorEtapaCronograma(rede, itens);
  const meses = {};
  const addDia = (dia, valor) => {
    if (!(valor > 0)) return;
    const k = chaveMes(dataDoDiaUtil(dataInicio, dia));
    meses[k] = (meses[k] || 0) + valor;
  };
  for (const e of cpmRes.etapas) {
    const c = custo[e.id];
    if (!(c > 0)) continue;
    if (!(e.duracao > 0)) { addDia(e.inicio, c); continue; }
    const dias = Math.ceil(e.duracao - 1e-9);
    for (let k = 0; k < dias; k++) addDia(e.inicio + k, c / e.duracao * Math.min(1, e.duracao - k));
  }
  const totalDias = Math.max(1, Math.ceil(cpmRes.fim - 1e-9));
  for (let k = 0; k < totalDias; k++) addDia(k, geral / totalDias);
  const total = Object.values(meses).reduce((a, v) => a + v, 0);
  let acc = 0;
  const lista = Object.keys(meses).sort().map((k) => {
    acc += meses[k];
    return { mes: k, valor: Math.round(meses[k] * 100) / 100, acumulado: Math.round(acc * 100) / 100, pct: total > 0 ? acc / total : 0 };
  });
  return { meses: lista, total: Math.round(total * 100) / 100, custoPorEtapa: custo, semEtapa: geral };
}

// ── Motor principal ──
// config: { dataInicio (ISO), modo: "simplificado"|"produtividade",
//           prazoAlvoMeses (0 = tabela), equipe {oficio: n}, eficiencia (0–1) }
function gerarCronogramaObra(projeto, orcamento, data, config) {
  const cfg = config || {};
  const { cp, medicoes, telhado } = medicoesCronograma(projeto, data);
  const cond = condicoesObra(cp);
  const rede = resolverRedeCronograma(etapasCronogramaAtivas(data), cond);
  const servicos = servicosCronogramaAtivos(data);
  const avisos = [];

  const prazoTabela = prazoParametricoMeses(cp.areaConstruida, cp.tipologia, data);
  const prazoAlvo = numOrZero(cfg.prazoAlvoMeses) > 0 ? numOrZero(cfg.prazoAlvoMeses) : prazoTabela;
  const alvoDias = prazoAlvo * DIAS_UTEIS_MES;
  if (!(prazoAlvo > 0)) avisos.push({ tipo: "sem_prazo", mensagem: "Sem área construída não há prazo pela tabela — informe um prazo-alvo." });

  // Horas-homem por etapa e por ofício
  const hh = {}, hhOficio = {}, medicoesDetalhe = [];
  for (const m of medicoes) {
    const s = servicos[m.servico];
    if (!s || !rede.some((e) => e.id === m.etapa)) continue;
    const linha = { ...m, nome: s.nome, unidade: s.unidade, fonte: s.fonte, horas: {} };
    for (const of of Object.keys(s.horas || {})) {
      const h = numOrZero(s.horas[of]) * m.qtd;
      if (!(h > 0)) continue;
      if (!hh[m.etapa]) hh[m.etapa] = {};
      hh[m.etapa][of] = (hh[m.etapa][of] || 0) + h;
      hhOficio[of] = (hhOficio[of] || 0) + h;
      linha.horas[of] = Math.round(h * 10) / 10;
    }
    medicoesDetalhe.push(linha);
  }
  const hhTotal = Object.values(hhOficio).reduce((a, v) => a + v, 0);
  const regimeHora = cfg.regimeHora || cronogramaCfg(data).regimeHora || "desonerado";
  const precoHora = precosHoraAtivos(data, regimeHora);

  // Simplificado: duração-base × fator, fator calibrado para o prazo-alvo
  const durBase = {};
  for (const e of rede) durBase[e.id] = numOrZero(e.duracaoBase) * DIAS_UTEIS_MES;
  const escala = (k) => { const d = {}; for (const id of Object.keys(durBase)) d[id] = durBase[id] * k; return d; };
  const fator = alvoDias > 0 ? bissecao((k) => cpmCronograma(rede, escala(k)).fim, alvoDias, 0.02, 30) : 1;
  const simplificado = cpmCronograma(rede, escala(fator));
  simplificado.fator = fator;
  if (simplificado.ciclo) avisos.push({ tipo: "ciclo", mensagem: "A rede de etapas tem um ciclo de predecessoras — revise em Insumos → Composições → Cronograma." });

  // Produtividade: HH ÷ (equipe × 8 h × eficiência); sem serviço → paramétrica
  const equipe = { ...equipePadrao(), ...(cfg.equipe || {}) };
  const eficiencia = numOrZero(cfg.eficiencia) > 0 ? Math.min(1.5, numOrZero(cfg.eficiencia)) : 0.75;
  const gargalos = {};
  const durProd = (k) => {
    const d = {};
    for (const e of rede) {
      const h = hh[e.id];
      if (!h) { d[e.id] = durBase[e.id] * fator; continue; }
      let dias = 0, gargalo = null;
      for (const of of Object.keys(h)) {
        const n = Math.max(0, numOrZero(equipe[of])) * k;
        const dd = n > 0 ? h[of] / (n * HORAS_DIA * eficiencia) : Infinity;
        if (dd > dias) { dias = dd; gargalo = of; }
      }
      if (!Number.isFinite(dias)) { dias = durBase[e.id] * fator; if (k === 1) avisos.push({ tipo: "sem_oficio", mensagem: `${e.nome}: a equipe não tem ${gargalo} — usada a duração paramétrica.` }); }
      d[e.id] = Math.max(dias, 1);
      if (k === 1) gargalos[e.id] = gargalo;
    }
    return d;
  };
  const produtividade = cpmCronograma(rede, durProd(1));
  const gargalosProd = { ...gargalos };

  // Equipe necessária para o prazo-alvo (multiplicador único sobre a equipe)
  let equipeNecessaria = null, prazoComEquipeNecessaria = null, kEquipe = null;
  if (alvoDias > 0 && hhTotal > 0) {
    kEquipe = bissecao((k) => -cpmCronograma(rede, durProd(k)).fim, -alvoDias, 0.05, 20);
    equipeNecessaria = {};
    for (const of of Object.keys(equipe)) equipeNecessaria[of] = hhOficio[of] > 0 ? Math.max(1, Math.ceil(equipe[of] * kEquipe - 1e-9)) : equipe[of];
    const equipeAtual = { ...equipe };
    const avisosAntes = avisos.length;
    Object.assign(equipe, equipeNecessaria);
    prazoComEquipeNecessaria = cpmCronograma(rede, durProd(1)).fim;
    Object.assign(equipe, equipeAtual);
    avisos.length = avisosAntes;
    if (kEquipe >= 19.99) avisos.push({ tipo: "prazo_inalcancavel", mensagem: "Mesmo com a equipe 20× maior o prazo-alvo não fecha: as etapas paramétricas (sem serviço medido) já ocupam esse prazo." });
  }

  const modo = cfg.modo === "produtividade" ? "produtividade" : "simplificado";
  const ativo = modo === "produtividade" ? produtividade : simplificado;

  // Calendário
  const inicio = dataUTC(cfg.dataInicio) || dataUTC(new Date().toISOString());
  const comDatas = (res) => res.etapas.map((e) => ({
    ...e,
    dataInicio: isoData(dataDoDiaUtil(inicio, e.inicio)),
    dataFim: isoData(dataDoDiaUtil(inicio, Math.max(e.inicio, e.fim - 1))),
    hh: hh[e.id] || null,
    hhTotal: hh[e.id] ? Object.values(hh[e.id]).reduce((a, v) => a + v, 0) : 0,
    gargalo: gargalosProd[e.id] || null,
  }));
  const resumo = (res) => ({
    fimDias: res.fim,
    meses: Math.round(res.fim / DIAS_UTEIS_MES * 10) / 10,
    dataFim: isoData(dataDoDiaUtil(inicio, Math.max(0, res.fim - 1))),
    criticas: res.etapas.filter((e) => e.critico).map((e) => e.id),
  });

  const financeiro = orcamento && Array.isArray(orcamento.itens) ? fisicoFinanceiro(ativo, rede, orcamento.itens, inicio) : null;
  const maoDeObra = maoDeObraReferencia(medicoesDetalhe, precoHora, eficiencia, orcamento, cp.areaConstruida);
  maoDeObra.precoHora = precoHora;

  return {
    modo, dataInicio: isoData(inicio), prazoTabela, prazoAlvo, eficiencia, equipe, cond, maoDeObra,
    simplificado: { ...resumo(simplificado), fator, etapas: comDatas(simplificado) },
    produtividade: { ...resumo(produtividade), etapas: comDatas(produtividade), hhPorOficio: hhOficio, hhTotal, equipeNecessaria, kEquipe, prazoComEquipeNecessariaMeses: prazoComEquipeNecessaria != null ? Math.round(prazoComEquipeNecessaria / DIAS_UTEIS_MES * 10) / 10 : null },
    ativo: { ...resumo(ativo), etapas: comDatas(ativo) },
    medicoes: medicoesDetalhe, telhado, financeiro, avisos, rede,
  };
}

// ═══════════════════════════════════════════════════════════════
// UI — bloco "Cronograma" no resultado do orçamento da obra
// ═══════════════════════════════════════════════════════════════
function fmtDataCrono(iso) {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}
function fmtMesCrono(chave) {
  const [a, m] = chave.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[+m - 1]}/${a.slice(2)}`;
}
function fmtHorasCrono(h) { return `${Math.round(numOrZero(h)).toLocaleString("pt-BR")} h`; }
const CRONO_COR_GRUPO = { Bruto: "#3b82f6", Acabamento: "#10b981", Externa: "#a855f7" };

function CronogramaObraBloco({ obra, obras, data, save, onObraAtualizada, isMobile, podeEditar, abaInicial, semCabecalho }) {
  const oficios = typeof OFICIOS !== "undefined" ? OFICIOS : [];
  const salvo = obra.cronograma || {};
  const [cfg, setCfg] = useState(() => ({
    dataInicio: salvo.dataInicio || (obra.dataInicio ? String(obra.dataInicio).slice(0, 10) : new Date().toISOString().slice(0, 10)),
    modo: salvo.modo || "simplificado",
    prazoAlvoMeses: salvo.prazoAlvoMeses || 0,
    equipe: { ...equipePadrao(), ...(salvo.equipe || {}) },
    eficiencia: salvo.eficiencia || 0.75,
    regimeHora: salvo.regimeHora || cronogramaCfg(data).regimeHora || "desonerado",
  }));
  const [aba, setAba] = useState(abaInicial || "gantt");
  const [aberto, setAberto] = useState(true);
  const mostrar = semCabecalho || aberto;

  const res = useMemo(() => {
    try { return gerarCronogramaObra(obra.projeto || {}, obra.orcamento, data, cfg); }
    catch (e) { return { erro: e && e.message ? e.message : String(e) }; }
  }, [obra.projeto, obra.orcamento, data.escritorio, cfg]);

  function setCampo(k, v) { setCfg((c) => ({ ...c, [k]: v })); }
  function setEquipe(of, v) { setCfg((c) => ({ ...c, equipe: { ...c.equipe, [of]: Math.max(0, Math.round(numOrZero(v))) } })); }
  function salvar() {
    const cronograma = { ...cfg, prazoMeses: res.ativo ? res.ativo.meses : null, dataFim: res.ativo ? res.ativo.dataFim : null, geradoEm: new Date().toISOString() };
    const obraAtualizada = { ...obra, cronograma };
    save({ ...data, obras: obras.map((o) => (o.id === obra.id ? obraAtualizada : o)) });
    if (onObraAtualizada) onObraAtualizada(obraAtualizada);
  }
  function usarEquipeNecessaria() {
    if (res.produtividade && res.produtividade.equipeNecessaria) setCfg((c) => ({ ...c, equipe: { ...c.equipe, ...res.produtividade.equipeNecessaria } }));
  }

  const card = { background: "#fafafa", border: "1px solid #f3f4f6", borderRadius: 12, padding: "12px 14px" };
  const rotulo = { fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 };
  const input = { width: "100%", padding: "7px 9px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12.5, fontFamily: "inherit", background: "#fff", boxSizing: "border-box" };

  if (res.erro) {
    return <div style={{ ...card, color: "#b91c1c", fontSize: 12 }}>Não foi possível montar o cronograma: {res.erro}</div>;
  }
  const at = res.ativo;
  const prod = res.produtividade;
  const ehProd = res.modo === "produtividade";
  const totalDias = Math.max(1, at.fimDias);
  // Réguas do Gantt: um marcador por mês de calendário
  const marcadores = [];
  if (at.fimDias > 0) {
    const ini = dataUTC(res.dataInicio);
    let mesAtual = null;
    for (let d = 0; d < Math.ceil(at.fimDias); d++) {
      const k = chaveMes(dataDoDiaUtil(ini, d));
      if (k !== mesAtual) { marcadores.push({ mes: k, dia: d }); mesAtual = k; }
    }
  }

  return (
    <div style={{ marginBottom: 16, border: semCabecalho ? "none" : "1px solid rgba(38,36,33,0.1)", borderRadius: 10, overflow: "hidden" }}>
      {!semCabecalho && <button type="button" onClick={() => setAberto((a) => !a)}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#f9fafb", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#262421" }}>Cronograma da obra
          <span style={{ fontWeight: 400, color: "#6b7280", marginLeft: 8 }}>{at.meses} meses · término {fmtDataCrono(at.dataFim)} · {ehProd ? "por produtividade" : "simplificado"}</span>
        </span>
        <span style={{ fontSize: 12, color: "#6b7280" }}>{aberto ? "▲" : "▼"}</span>
      </button>}
      {mostrar && (
        <div style={{ padding: semCabecalho ? 0 : 14 }}>
          {/* Configuração */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
            <div><div style={rotulo}>Início da obra</div><input type="date" style={input} value={cfg.dataInicio} disabled={!podeEditar} onChange={(e) => setCampo("dataInicio", e.target.value)} /></div>
            <div><div style={rotulo}>Como calcular o prazo</div>
              <select style={input} value={cfg.modo} disabled={!podeEditar} onChange={(e) => setCampo("modo", e.target.value)}>
                <option value="simplificado">Simplificado (tabela por m²)</option>
                <option value="produtividade">Por produtividade (HH SINAPI × equipe)</option>
              </select></div>
            <div><div style={rotulo}>Prazo-alvo (meses)</div>
              <input type="number" min="0" step="0.5" style={input} disabled={!podeEditar} value={cfg.prazoAlvoMeses || ""} placeholder={`tabela: ${res.prazoTabela}`} onChange={(e) => setCampo("prazoAlvoMeses", numOrZero(e.target.value))} /></div>
            <div><div style={rotulo}>Eficiência da equipe</div>
              <select style={input} value={String(cfg.eficiencia)} disabled={!podeEditar} onChange={(e) => setCampo("eficiencia", Number(e.target.value))}>
                <option value="1">100% — produtividade SINAPI</option>
                <option value="0.85">85%</option>
                <option value="0.75">75% — obra residencial típica</option>
                <option value="0.65">65%</option>
                <option value="0.5">50%</option>
              </select></div>
          </div>

          {/* Resumo */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 10, marginBottom: 12 }}>
            <div style={card}><div style={rotulo}>Prazo</div><div style={{ fontSize: 14, fontWeight: 700 }}>{at.meses} meses</div><div style={{ fontSize: 11, color: "#6b7280" }}>{Math.ceil(at.fimDias)} dias úteis</div></div>
            <div style={card}><div style={rotulo}>Término previsto</div><div style={{ fontSize: 14, fontWeight: 700 }}>{fmtDataCrono(at.dataFim)}</div><div style={{ fontSize: 11, color: "#6b7280" }}>início {fmtDataCrono(res.dataInicio)}</div></div>
            <div style={card}><div style={rotulo}>Prazo pela tabela</div><div style={{ fontSize: 14, fontWeight: 700 }}>{res.prazoTabela || "—"} meses</div><div style={{ fontSize: 11, color: "#6b7280" }}>{res.cond.sobrado ? "sobrado" : "térrea"} · {Math.round(numOrZero(obra.projeto && obra.projeto.arquitetura && obra.projeto.arquitetura.areaConstruida))} m²</div></div>
            <div style={card}><div style={rotulo}>Por produtividade</div><div style={{ fontSize: 14, fontWeight: 700 }}>{prod.meses} meses</div><div style={{ fontSize: 11, color: "#6b7280" }}>{fmtHorasCrono(prod.hhTotal)} com a equipe atual</div></div>
            <div style={card}><div style={rotulo}>Caminho crítico</div><div style={{ fontSize: 14, fontWeight: 700 }}>{at.criticas.length} etapas</div><div style={{ fontSize: 11, color: "#6b7280" }}>atraso nelas = atraso da obra</div></div>
          </div>

          {res.avisos.length > 0 && (
            <div style={{ fontSize: 12, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "8px 14px", marginBottom: 12 }}>
              {res.avisos.map((a, i) => <div key={i}>{a.mensagem}</div>)}
            </div>
          )}

          {/* Equipe */}
          <details open={ehProd} style={{ marginBottom: 12, fontSize: 12 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, color: "#262421" }}>
              Equipe {prod.equipeNecessaria ? `— para fechar em ${res.prazoAlvo} meses: ${oficios.filter((o) => prod.hhPorOficio[o.id] > 0).map((o) => `${prod.equipeNecessaria[o.id]} ${o.nome.toLowerCase()}`).join(", ")}` : ""}
            </summary>
            <div style={{ overflowX: "auto", marginTop: 8 }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 520 }}>
                <thead><tr style={{ textAlign: "left", color: "#9ca3af", fontSize: 10, textTransform: "uppercase" }}>
                  <th style={{ padding: "4px 8px" }}>Ofício</th><th style={{ padding: "4px 8px", textAlign: "right" }}>HH na obra</th>
                  <th style={{ padding: "4px 8px", textAlign: "right" }}>Equipe atual</th><th style={{ padding: "4px 8px", textAlign: "right" }}>Para {res.prazoAlvo} meses</th>
                </tr></thead>
                <tbody>
                  {oficios.map((o) => (
                    <tr key={o.id} style={{ borderTop: "1px solid #f3f4f6", color: prod.hhPorOficio[o.id] > 0 ? "#262421" : "#9ca3af" }}>
                      <td style={{ padding: "4px 8px" }}>{o.nome}</td>
                      <td style={{ padding: "4px 8px", textAlign: "right" }}>{fmtHorasCrono(prod.hhPorOficio[o.id])}</td>
                      <td style={{ padding: "4px 8px", textAlign: "right" }}>
                        <input type="number" min="0" step="1" style={{ ...input, width: 64, textAlign: "right", padding: "4px 6px" }} disabled={!podeEditar} value={cfg.equipe[o.id]} onChange={(e) => setEquipe(o.id, e.target.value)} />
                      </td>
                      <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>{prod.equipeNecessaria && prod.hhPorOficio[o.id] > 0 ? prod.equipeNecessaria[o.id] : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {prod.equipeNecessaria && podeEditar && (
                <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button style={C.btnSec} onClick={usarEquipeNecessaria}>Usar essa equipe</button>
                  <span style={{ color: "#6b7280" }}>com ela, por produtividade, a obra fecha em {prod.prazoComEquipeNecessariaMeses} meses (equipe arredondada para cima).</span>
                </div>
              )}
              <div style={{ marginTop: 6, color: "#6b7280" }}>Horas-homem das composições SINAPI (SP) × quantidades desta obra, ajustadas pela eficiência. Cada etapa dura o tempo do ofício mais carregado; etapas sem serviço medido (pré-obra, impermeabilizações, acabamentos finais) usam a duração paramétrica.</div>
            </div>
          </details>

          {/* Abas */}
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {[["gantt", "Etapas e Gantt"], ["financeiro", "Físico-financeiro"], ["maoDeObra", "Mão de obra (SINAPI)"], ["medicoes", "Serviços medidos"], ["comparar", "Simplificado × produtividade"]].map(([k, l]) => (
              <button key={k} style={aba === k ? C.btn : C.btnSec} onClick={() => setAba(k)}>{l}</button>
            ))}
          </div>

          {aba === "gantt" && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 760 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#9ca3af", fontSize: 10, textTransform: "uppercase" }}>
                    <th style={{ padding: "6px 8px" }}>Etapa</th>
                    <th style={{ padding: "6px 8px" }}>Início</th>
                    <th style={{ padding: "6px 8px" }}>Fim</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Dias</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Folga</th>
                    <th style={{ padding: "6px 8px", width: "45%" }}>
                      <div style={{ position: "relative", height: 14 }}>
                        {marcadores.map((mk) => (
                          <span key={mk.mes} style={{ position: "absolute", left: `${mk.dia / totalDias * 100}%`, fontSize: 9, color: "#9ca3af", borderLeft: "1px solid #e5e7eb", paddingLeft: 2, whiteSpace: "nowrap" }}>{fmtMesCrono(mk.mes)}</span>
                        ))}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {at.etapas.map((e) => (
                    <tr key={e.id} style={{ borderTop: "1px solid #f3f4f6" }} title={e.hh ? Object.keys(e.hh).map((of) => `${of}: ${Math.round(e.hh[of])} h`).join(" · ") : "duração paramétrica"}>
                      <td style={{ padding: "6px 8px", color: "#262421", fontWeight: e.critico ? 600 : 400, whiteSpace: "nowrap" }}>
                        {e.critico && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 4, background: "#dc2626", marginRight: 6 }} />}
                        {e.nome}
                        {ehProd && e.gargalo && <span style={{ color: "#9ca3af", marginLeft: 6, fontSize: 10 }}>({e.gargalo})</span>}
                      </td>
                      <td style={{ padding: "6px 8px", color: "#374151", whiteSpace: "nowrap" }}>{fmtDataCrono(e.dataInicio)}</td>
                      <td style={{ padding: "6px 8px", color: "#374151", whiteSpace: "nowrap" }}>{fmtDataCrono(e.dataFim)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#374151" }}>{Math.round(e.duracao)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: e.critico ? "#dc2626" : "#6b7280" }}>{e.critico ? "crítica" : `${Math.round(e.folga)} d`}</td>
                      <td style={{ padding: "6px 8px" }}>
                        <div style={{ position: "relative", height: 12, background: "#f3f4f6", borderRadius: 4 }}>
                          <div style={{ position: "absolute", left: `${e.inicio / totalDias * 100}%`, width: `${Math.max(0.5, e.duracao / totalDias * 100)}%`, top: 0, bottom: 0, borderRadius: 4, background: e.critico ? "#dc2626" : (CRONO_COR_GRUPO[e.grupo] || "#6b7280"), opacity: e.critico ? 0.85 : 0.7 }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>Dias úteis (sem fins de semana e feriados nacionais). Vermelho = caminho crítico. {ehProd ? "Entre parênteses, o ofício que dita a duração da etapa." : `Durações-base escaladas por ${res.simplificado.fator.toFixed(2)} para fechar em ${res.prazoAlvo} meses.`}</div>
            </div>
          )}

          {aba === "financeiro" && (
            res.financeiro ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 560, width: "100%" }}>
                  <thead><tr style={{ textAlign: "left", color: "#9ca3af", fontSize: 10, textTransform: "uppercase" }}>
                    <th style={{ padding: "6px 8px" }}>Mês</th><th style={{ padding: "6px 8px", textAlign: "right" }}>Desembolso</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Acumulado</th><th style={{ padding: "6px 8px", textAlign: "right" }}>%</th><th style={{ padding: "6px 8px", width: "35%" }}>Curva S</th>
                  </tr></thead>
                  <tbody>
                    {res.financeiro.meses.map((m) => (
                      <tr key={m.mes} style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "6px 8px", color: "#262421" }}>{fmtMesCrono(m.mes)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatoBRL(m.valor)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: "#6b7280" }}>{formatoBRL(m.acumulado)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: "#6b7280" }}>{Math.round(m.pct * 100)}%</td>
                        <td style={{ padding: "6px 8px" }}><div style={{ height: 10, background: "#f3f4f6", borderRadius: 4 }}><div style={{ width: `${m.pct * 100}%`, height: "100%", background: "#3b82f6", borderRadius: 4, opacity: 0.7 }} /></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
                  Custo de cada etapa do orçamento distribuído pelos dias da etapa no cronograma; prestadores e itens sem etapa ({formatoBRL(res.financeiro.semEtapa)}) diluídos ao longo da obra. Total {formatoBRL(res.financeiro.total)}.
                </div>
              </div>
            ) : <div style={{ fontSize: 12, color: "#6b7280" }}>Gere o orçamento para ver o desembolso por mês.</div>
          )}

          {aba === "maoDeObra" && (() => {
            const mo = res.maoDeObra;
            const dif = (p) => (p.orcado != null && p.orcado > 0 ? (p.custoRef - p.orcado) / p.orcado : null);
            const area = numOrZero(obra.projeto && obra.projeto.arquitetura && obra.projeto.arquitetura.areaConstruida);
            return (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
                  <div><div style={rotulo}>Preço da hora</div>
                    <select style={input} value={cfg.regimeHora} disabled={!podeEditar} onChange={(e) => setCampo("regimeHora", e.target.value)}>
                      <option value="desonerado">SINAPI desonerado</option>
                      <option value="onerado">SINAPI onerado</option>
                    </select></div>
                  <div style={card}><div style={rotulo}>Mão de obra SINAPI</div><div style={{ fontSize: 14, fontWeight: 700 }}>{formatoBRL(mo.totalRef)}</div><div style={{ fontSize: 11, color: "#6b7280" }}>{mo.porM2Ref != null ? `${formatoBRL(mo.porM2Ref)}/m²` : ""} · produtividade de referência</div></div>
                  <div style={card}><div style={rotulo}>Com eficiência {Math.round(mo.eficiencia * 100)}%</div><div style={{ fontSize: 14, fontWeight: 700 }}>{formatoBRL(mo.totalEficiencia)}</div><div style={{ fontSize: 11, color: "#6b7280" }}>{mo.porM2Eficiencia != null ? `${formatoBRL(mo.porM2Eficiencia)}/m²` : ""} · horas reais da equipe</div></div>
                  <div style={card}><div style={rotulo}>Prestadores no orçamento</div><div style={{ fontSize: 14, fontWeight: 700 }}>{formatoBRL(mo.totalOrcadoComparavel)}</div><div style={{ fontSize: 11, color: "#6b7280" }}>só os comparáveis · SINAPI {formatoBRL(mo.totalRefComparavel)}</div></div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 720, width: "100%" }}>
                    <thead><tr style={{ textAlign: "left", color: "#9ca3af", fontSize: 10, textTransform: "uppercase" }}>
                      <th style={{ padding: "6px 8px" }}>Prestador</th><th style={{ padding: "6px 8px", textAlign: "right" }}>HH</th>
                      <th style={{ padding: "6px 8px", textAlign: "right" }}>SINAPI</th><th style={{ padding: "6px 8px", textAlign: "right" }}>Com eficiência</th>
                      <th style={{ padding: "6px 8px", textAlign: "right" }}>No orçamento</th><th style={{ padding: "6px 8px", textAlign: "right" }}>SINAPI × orçado</th>
                    </tr></thead>
                    <tbody>
                      {mo.porPrestador.map((p) => {
                        const d = dif(p);
                        return (
                          <tr key={p.chave} style={{ borderTop: "1px solid #f3f4f6" }} title={p.servicos.join(", ")}>
                            <td style={{ padding: "6px 8px", color: p.temPrestador ? "#262421" : "#9ca3af" }}>{p.rotulo}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right", color: "#6b7280" }}>{p.hh.toLocaleString("pt-BR")} h</td>
                            <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatoBRL(p.custoRef)}{area > 0 && p.chave === "equipePedreiros" ? <span style={{ color: "#9ca3af" }}> ({formatoBRL(p.custoRef / area)}/m²)</span> : null}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right", color: "#6b7280" }}>{formatoBRL(p.custoEficiencia)}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>{p.orcado != null ? formatoBRL(p.orcado) : <span style={{ color: "#9ca3af", fontWeight: 400 }}>—</span>}</td>
                            <td style={{ padding: "6px 8px", textAlign: "right", color: d == null ? "#9ca3af" : Math.abs(d) > 0.3 ? "#b45309" : "#16a34a" }}>{d == null ? "" : `${d > 0 ? "+" : ""}${Math.round(d * 100)}%`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <details style={{ marginTop: 8, fontSize: 12 }}>
                  <summary style={{ cursor: "pointer", color: "#374151" }}>Preço da hora por ofício ({typeof PRECO_HORA_REFERENCIA !== "undefined" ? PRECO_HORA_REFERENCIA : "SINAPI"})</summary>
                  <div style={{ marginTop: 6, color: "#374151" }}>
                    {oficios.map((o) => { const ph = mo.precoHora[o.id]; const po = mo.porOficio[o.id]; return ph ? <span key={o.id} style={{ display: "inline-block", marginRight: 14, marginBottom: 4 }}>{o.nome.split(" /")[0]} <b>{formatoBRL(ph.preco)}/h</b>{po ? <span style={{ color: "#9ca3af" }}> · {po.hh.toLocaleString("pt-BR")} h · {formatoBRL(po.custoRef)}</span> : null}{ph.fonte === "escritório" ? <span style={{ color: "#b45309" }}> (escritório)</span> : null}</span> : null; })}
                  </div>
                </details>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>
                  Referência, não orçamento: HH das composições SINAPI × preço da hora "com encargos complementares" (salário, encargos, EPI, alimentação, transporte). O contratado por empreitada embute lucro, ferramentas maiores e o risco do prestador — diferença de até ±30% é normal; acima disso vale revisar a taxa por m² em Insumos. Elétrica e hidráulica só medem os pontos por ambiente (sem quadro, prumadas, ligação e ramal externo) — o contratado cobre mais. "Com eficiência" converte para as horas que a sua equipe gasta de fato. Ajuste o preço da hora em Insumos → Composições → Produtividade.
                </div>
              </div>
            );
          })()}

          {aba === "medicoes" && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 640, width: "100%" }}>
                <thead><tr style={{ textAlign: "left", color: "#9ca3af", fontSize: 10, textTransform: "uppercase" }}>
                  <th style={{ padding: "6px 8px" }}>Etapa</th><th style={{ padding: "6px 8px" }}>Serviço</th><th style={{ padding: "6px 8px", textAlign: "right" }}>Quantidade</th><th style={{ padding: "6px 8px" }}>Horas por ofício</th><th style={{ padding: "6px 8px", textAlign: "right" }}>Mão de obra SINAPI</th><th style={{ padding: "6px 8px" }}>Fonte</th>
                </tr></thead>
                <tbody>
                  {res.medicoes.map((m, i) => {
                    const et = res.rede.find((e) => e.id === m.etapa);
                    return (
                      <tr key={i} style={{ borderTop: "1px solid #f3f4f6" }} title={m.nota || ""}>
                        <td style={{ padding: "6px 8px", color: "#6b7280", whiteSpace: "nowrap" }}>{et ? et.nome : m.etapa}</td>
                        <td style={{ padding: "6px 8px", color: "#262421" }}>{m.nome}{m.nota ? <span style={{ color: "#9ca3af" }}> · {m.nota}</span> : null}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", whiteSpace: "nowrap" }}>{m.qtd.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {m.unidade}</td>
                        <td style={{ padding: "6px 8px", color: "#374151" }}>{Object.keys(m.horas).map((of) => `${of} ${Math.round(m.horas[of])} h`).join(" · ")}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", whiteSpace: "nowrap" }}>{formatoBRL(m.custoRef || 0)}</td>
                        <td style={{ padding: "6px 8px", color: "#9ca3af", whiteSpace: "nowrap" }}>{m.fonte}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>Quantidades derivadas dos mesmos dados do orçamento (áreas de parede, laje, telhado, volumes de concreto, aço, ambientes). Horas por unidade editáveis em Insumos → Composições → Produtividade.</div>
            </div>
          )}

          {aba === "comparar" && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 560, width: "100%" }}>
                <thead><tr style={{ textAlign: "left", color: "#9ca3af", fontSize: 10, textTransform: "uppercase" }}>
                  <th style={{ padding: "6px 8px" }}>Etapa</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Simplificado (dias)</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Produtividade (dias)</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>HH</th>
                  <th style={{ padding: "6px 8px" }}>Diferença</th>
                </tr></thead>
                <tbody>
                  {res.simplificado.etapas.map((e) => {
                    const p = res.produtividade.etapas.find((x) => x.id === e.id);
                    const dif = p && e.duracao > 0 ? (p.duracao - e.duracao) / e.duracao : 0;
                    return (
                      <tr key={e.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "6px 8px", color: "#262421" }}>{e.nome}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{Math.round(e.duracao)}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>{p ? Math.round(p.duracao) : "—"}{p && !p.hh ? <span style={{ color: "#9ca3af" }}> *</span> : null}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", color: "#6b7280" }}>{p && p.hh ? fmtHorasCrono(p.hhTotal) : "—"}</td>
                        <td style={{ padding: "6px 8px", color: Math.abs(dif) > 0.5 ? "#b45309" : "#6b7280" }}>{p && p.hh ? `${dif > 0 ? "+" : ""}${Math.round(dif * 100)}%` : ""}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ borderTop: "2px solid #e5e7eb", fontWeight: 700 }}>
                    <td style={{ padding: "6px 8px" }}>Prazo total</td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>{res.simplificado.meses} meses</td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>{res.produtividade.meses} meses</td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtHorasCrono(prod.hhTotal)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>* etapa sem serviço medido: usa a duração paramétrica nos dois modos. Diferença grande numa etapa com HH indica equipe irreal para ela ou tabela desatualizada — o realizado das obras calibra a eficiência.</div>
            </div>
          )}

          {podeEditar && (
            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button style={C.btn} onClick={salvar}>Salvar cronograma</button>
              {salvo.geradoEm && <span style={{ fontSize: 11, color: "#9ca3af" }}>salvo em {new Date(salvo.geradoEm).toLocaleString("pt-BR")} · {salvo.prazoMeses} meses</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Tela "Cronograma" da obra (GestaoObraPanel → botão Cronograma), no mesmo
// molde de OrcamentoObraView. Lê obra.projeto e obra.orcamento; sem projeto,
// manda preencher o orçamento primeiro.
function CronogramaObraView({ obra, obras, data, save, onObraAtualizada, isMobile, onVoltar, onIrParaOrcamento }) {
  const perm = getPermissoes();
  const temProjeto = !!(obra.projeto && obra.projeto.arquitetura && numOrZero(obra.projeto.arquitetura.areaConstruida) > 0);
  const wrap = { border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: 16, marginBottom: 20 };
  return (
    <div style={wrap}>
      <button onClick={onVoltar} style={{ ...C.btnGhost, marginBottom: 16, fontSize: 12 }}>← Voltar</button>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#262421" }}>Cronograma — {obra.nome}</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>prazo pela tabela do escritório ou por produtividade (HH SINAPI × equipe), caminho crítico, desembolso por mês e mão de obra de referência</div>
      </div>
      {!temProjeto ? (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "14px 16px", fontSize: 12.5, color: "#92400e" }}>
          O cronograma usa as áreas, volumes e ambientes do orçamento da obra. Preencha os dados do projeto e gere o orçamento primeiro.
          {onIrParaOrcamento && <div style={{ marginTop: 10 }}><button style={C.btn} onClick={onIrParaOrcamento}>Ir para o orçamento</button></div>}
        </div>
      ) : (
        <div>
          {!obra.orcamento && (
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 14px", fontSize: 12, color: "#374151", marginBottom: 12 }}>
              Orçamento ainda não gerado: prazo e equipe já saem do projeto; o físico-financeiro e a comparação de mão de obra aparecem depois de calcular o orçamento.
            </div>
          )}
          <CronogramaObraBloco obra={obra} obras={obras} data={data} save={save} onObraAtualizada={onObraAtualizada} isMobile={isMobile} podeEditar={!!perm.podeEditar} semCabecalho />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Editores do escritório (Insumos → Composições → abas Cronograma / Produtividade)
// ═══════════════════════════════════════════════════════════════
function gravarCronogramaCfg(data, save, novaCfg) {
  save({ ...data, escritorio: { ...(data.escritorio || {}), cronograma: novaCfg } });
}

function CronogramaEditor({ data, save, podeEditar }) {
  const cfg = cronogramaCfg(data);
  const etapas = etapasCronogramaAtivas(data);
  const tabela = prazoTabelaAtiva(data);
  const seedTab = typeof PRAZO_TABELA_SEED !== "undefined" ? PRAZO_TABELA_SEED : [];
  const nomeDe = (id) => { const e = etapas.find((x) => x.id === id); return e ? e.nome : id; };
  const input = { width: 70, padding: "4px 6px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, fontFamily: "inherit", textAlign: "right" };

  function setDuracao(id, v) {
    const et = { ...(cfg.etapas || {}) };
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) et[id] = { duracaoBase: n }; else delete et[id];
    gravarCronogramaCfg(data, save, { ...cfg, etapas: et });
  }
  function restaurarEtapas() { const c = { ...cfg }; delete c.etapas; gravarCronogramaCfg(data, save, c); }
  function setTabela(i, campo, v) {
    const t = tabela.map((l) => ({ ...l }));
    t[i][campo] = Number(v) || 0;
    gravarCronogramaCfg(data, save, { ...cfg, prazoTabela: t });
  }
  function restaurarTabela() { const c = { ...cfg }; delete c.prazoTabela; delete c.sobradoExtra; gravarCronogramaCfg(data, save, c); }
  const editouTabela = Array.isArray(cfg.prazoTabela) || cfg.sobradoExtra != null;

  return (
    <div>
      <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 10 }}>
        Prazo total por área construída (modo simplificado) e rede de etapas com a duração-base de cada uma. A duração-base é um peso: o VICKE escala todas até o caminho crítico fechar no prazo da tabela (ou no prazo-alvo digitado na obra).
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 340px) 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 6 }}>Prazo por área (meses, térrea)</div>
          <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase" }}><th style={{ padding: "4px 8px", textAlign: "right" }}>m²</th><th style={{ padding: "4px 8px", textAlign: "right" }}>meses</th></tr></thead>
            <tbody>
              {tabela.map((l, i) => (
                <tr key={i}>
                  <td style={{ padding: "3px 8px", textAlign: "right" }}><input type="number" style={input} disabled={!podeEditar} value={l.area} onChange={(e) => setTabela(i, "area", e.target.value)} /></td>
                  <td style={{ padding: "3px 8px", textAlign: "right" }}><input type="number" step="0.1" style={input} disabled={!podeEditar} value={l.terrea} onChange={(e) => setTabela(i, "terrea", e.target.value)} /></td>
                </tr>
              ))}
              <tr><td style={{ padding: "6px 8px", textAlign: "right", color: "#6b7280" }}>Sobrado: +</td>
                <td style={{ padding: "3px 8px", textAlign: "right" }}><input type="number" step="0.5" style={input} disabled={!podeEditar} value={extraSobradoMeses(data)} onChange={(e) => gravarCronogramaCfg(data, save, { ...cfg, sobradoExtra: Number(e.target.value) || 0 })} /></td></tr>
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>Interpolado entre as linhas; acima da última, segue a inclinação do último trecho. Tabela do modelo antigo do escritório.</div>
          {editouTabela && podeEditar && <button style={{ ...INS_S.btnGhost, marginTop: 6 }} onClick={restaurarTabela}>Restaurar tabela padrão</button>}
          {!editouTabela && seedTab.length > 0 && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>Valores padrão.</div>}
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, overflowX: "auto" }}>
          <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 6 }}>Rede de etapas</div>
          <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", minWidth: 640 }}>
            <thead><tr style={{ textAlign: "left", color: "#9ca3af", fontSize: 10, textTransform: "uppercase" }}>
              <th style={{ padding: "4px 8px" }}>Etapa</th><th style={{ padding: "4px 8px" }}>Grupo</th><th style={{ padding: "4px 8px", textAlign: "right" }}>Duração-base (meses)</th><th style={{ padding: "4px 8px" }}>Começa quando</th><th style={{ padding: "4px 8px" }}>Só se</th>
            </tr></thead>
            <tbody>
              {etapas.map((e) => (
                <tr key={e.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "4px 8px", color: "#262421", whiteSpace: "nowrap" }}>{e.nome}{e.editado && <span style={{ color: "#b45309", fontSize: 10, marginLeft: 6 }}>editado</span>}</td>
                  <td style={{ padding: "4px 8px", color: "#6b7280" }}>{e.grupo}</td>
                  <td style={{ padding: "4px 8px", textAlign: "right" }}><input type="number" step="0.5" min="0" style={input} disabled={!podeEditar} value={e.duracaoBase} onChange={(ev) => setDuracao(e.id, ev.target.value)} /></td>
                  <td style={{ padding: "4px 8px", color: "#6b7280", fontSize: 11.5 }}>
                    {(e.predecessoras || []).length === 0 ? "início da obra" : (e.predecessoras || []).map((l) => l.tipo === "SS" ? `${nomeDe(l.id)} a ${Math.round((l.avanco || 0) * 100)}%` : `${nomeDe(l.id)} termina${l.lag ? ` (${l.lag > 0 ? "+" : ""}${l.lag} d)` : ""}`).join(" · ")}
                  </td>
                  <td style={{ padding: "4px 8px", color: "#9ca3af" }}>{e.condicao || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {cfg.etapas && Object.keys(cfg.etapas).length > 0 && podeEditar && <button style={{ ...INS_S.btnGhost, marginTop: 6 }} onClick={restaurarEtapas}>Restaurar durações padrão</button>}
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>Predecessoras e condições vêm da rede padrão (várias por etapa; "a 50%" = começa quando a anterior está na metade). Etapa que não existe na obra (sem arrimo, térrea…) sai da rede e suas dependências passam adiante.</div>
        </div>
      </div>
    </div>
  );
}

function ProdutividadeEditor({ data, save, podeEditar }) {
  const cfg = cronogramaCfg(data);
  const servicos = servicosCronogramaAtivos(data);
  const oficios = typeof OFICIOS !== "undefined" ? OFICIOS : [];
  const seed = typeof PRODUTIVIDADE_SEED !== "undefined" ? PRODUTIVIDADE_SEED : {};
  const input = { width: 58, padding: "3px 5px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 11.5, fontFamily: "inherit", textAlign: "right" };
  const usados = oficios.filter((o) => Object.keys(servicos).some((id) => servicos[id].horas && servicos[id].horas[o.id] != null) || Object.keys(cfg.servicos || {}).some((id) => cfg.servicos[id].horas && cfg.servicos[id].horas[o.id] != null));

  function setHoras(id, of, v) {
    const sv = { ...(cfg.servicos || {}) };
    const horas = { ...((sv[id] && sv[id].horas) || {}) };
    const n = Number(String(v).replace(",", "."));
    if (v === "" || !Number.isFinite(n)) delete horas[of]; else horas[of] = n;
    if (Object.keys(horas).length) sv[id] = { horas }; else delete sv[id];
    gravarCronogramaCfg(data, save, { ...cfg, servicos: sv });
  }
  function restaurar(id) {
    const sv = { ...(cfg.servicos || {}) };
    delete sv[id];
    gravarCronogramaCfg(data, save, { ...cfg, servicos: sv });
  }
  const precoSeed = typeof PRECO_HORA_SEED !== "undefined" ? PRECO_HORA_SEED : {};
  const regime = cfg.regimeHora === "onerado" ? "onerado" : "desonerado";
  const precoAtivo = precosHoraAtivos(data, regime);
  function setPrecoHora(of, v) {
    const ph = { ...(cfg.precoHora || {}) };
    const n = Number(String(v).replace(",", "."));
    if (v === "" || !Number.isFinite(n) || n <= 0) delete ph[of]; else ph[of] = n;
    gravarCronogramaCfg(data, save, { ...cfg, precoHora: ph });
  }

  return (
    <div>
      <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 10 }}>
        Horas por unidade de serviço, por ofício — composições analíticas do SINAPI (base SP). É a produtividade de referência; a eficiência da equipe (na obra) ajusta para a realidade do canteiro. Zere as horas de um serviço que sua obra não tem (ex.: forro de gesso) ou troque pelo seu número.
      </div>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, marginBottom: 12, overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          <div style={{ fontWeight: 600, fontSize: 12.5 }}>Preço da hora por ofício ({typeof PRECO_HORA_REFERENCIA !== "undefined" ? PRECO_HORA_REFERENCIA : "SINAPI"})</div>
          <label style={{ fontSize: 12, color: "#374151" }}>Regime padrão:{" "}
            <select value={regime} disabled={!podeEditar} onChange={(e) => gravarCronogramaCfg(data, save, { ...cfg, regimeHora: e.target.value })} style={{ padding: "3px 6px", border: "1px solid #e5e7eb", borderRadius: 6, fontFamily: "inherit", fontSize: 12 }}>
              <option value="desonerado">desonerado</option><option value="onerado">onerado</option>
            </select>
          </label>
        </div>
        <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 640 }}>
          <thead><tr style={{ textAlign: "left", color: "#9ca3af", fontSize: 10, textTransform: "uppercase" }}>
            <th style={{ padding: "4px 8px" }}>Ofício</th><th style={{ padding: "4px 8px" }}>SINAPI</th><th style={{ padding: "4px 8px", textAlign: "right" }}>Desonerado</th><th style={{ padding: "4px 8px", textAlign: "right" }}>Onerado</th><th style={{ padding: "4px 8px", textAlign: "right" }}>Do escritório (R$/h)</th><th style={{ padding: "4px 8px", textAlign: "right" }}>Em uso</th>
          </tr></thead>
          <tbody>
            {oficios.map((o) => {
              const s = precoSeed[o.id]; const ov = cfg.precoHora && cfg.precoHora[o.id]; const at = precoAtivo[o.id];
              return (
                <tr key={o.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "4px 8px", color: "#262421" }}>{o.nome}</td>
                  <td style={{ padding: "4px 8px", color: "#9ca3af" }}>{s ? s.codigo : "—"}</td>
                  <td style={{ padding: "4px 8px", textAlign: "right", color: "#6b7280" }}>{s ? formatoBRL(s.desonerado) : "—"}</td>
                  <td style={{ padding: "4px 8px", textAlign: "right", color: "#6b7280" }}>{s ? formatoBRL(s.onerado) : "—"}</td>
                  <td style={{ padding: "3px 8px", textAlign: "right" }}><input type="number" step="0.01" min="0" style={input} disabled={!podeEditar} value={ov != null ? ov : ""} placeholder="—" onChange={(e) => setPrecoHora(o.id, e.target.value)} /></td>
                  <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>{at ? formatoBRL(at.preco) : "—"}{at && at.fonte === "escritório" ? <span style={{ color: "#b45309", fontWeight: 400, fontSize: 10, marginLeft: 4 }}>escritório</span> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>Hora "com encargos complementares" (salário + encargos + EPI, ferramentas, alimentação, transporte, exames, seguro). Multiplica as HH da obra para dar a referência de mão de obra por prestador, no bloco Cronograma → Mão de obra.</div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", minWidth: 900 }}>
          <thead><tr style={{ textAlign: "left", color: "#9ca3af", fontSize: 10, textTransform: "uppercase" }}>
            <th style={{ padding: "4px 8px" }}>Serviço</th><th style={{ padding: "4px 8px" }}>Un.</th>
            {usados.map((o) => <th key={o.id} style={{ padding: "4px 6px", textAlign: "right" }}>{o.nome.split(" /")[0]}</th>)}
            <th style={{ padding: "4px 8px" }}>Fonte</th><th />
          </tr></thead>
          <tbody>
            {Object.keys(servicos).map((id) => {
              const s = servicos[id];
              return (
                <tr key={id} style={{ borderTop: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "4px 8px", color: "#262421" }}>{s.nome}{s.editado && <span style={{ color: "#b45309", fontSize: 10, marginLeft: 6 }}>editado</span>}</td>
                  <td style={{ padding: "4px 8px", color: "#6b7280" }}>{s.unidade}</td>
                  {usados.map((o) => (
                    <td key={o.id} style={{ padding: "3px 6px", textAlign: "right" }}>
                      <input type="number" step="0.001" min="0" style={{ ...input, color: (seed[id] && seed[id].horas[o.id] != null) || (s.horas[o.id] != null) ? "#262421" : "#d1d5db" }} disabled={!podeEditar}
                        value={s.horas[o.id] != null ? s.horas[o.id] : ""} onChange={(e) => setHoras(id, o.id, e.target.value)} />
                    </td>
                  ))}
                  <td style={{ padding: "4px 8px", color: "#9ca3af", whiteSpace: "nowrap", fontSize: 11 }}>{s.fonte}</td>
                  <td style={{ padding: "4px 8px" }}>{s.editado && podeEditar && <button style={INS_S.btnGhost} onClick={() => restaurar(id)}>Restaurar</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
