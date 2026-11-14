// ═══════════════════════════════════════════════════════════════
// ESTRUTURAL — concepção e verificações de estrutura de concreto armado
// ═══════════════════════════════════════════════════════════════
// Motor puro (sem React), usado pelo Projetar (teste-projeto.jsx). Roteiro e
// referências em docs/SPEC-ESTRUTURAL.md.
//
// Etapa 1 (este arquivo): lançamento automático de pilares, vigas e lajes a
// partir da arquitetura, verificações de dimensões mínimas, durabilidade e
// compatibilização com a arquitetura, e quantitativos de concreto e fôrma.
// Cálculo de esforços e dimensionamento de armaduras são as etapas 3 e 4.
//
// Regra da casa: todo valor que vem de norma fica em ES_NBR, com o item da
// norma ao lado. O que é escolha de concepção (vão máximo entre pilares,
// seções padrão) fica em ES_PADRAO e é marcado como tal na tela — nunca é
// apresentado como exigência normativa.
//
// Unidades: metros nas coordenadas e seções; cm só onde a norma fala em cm
// (dimensões mínimas, cobrimento em mm).

// ---------- valores das normas ----------
const ES_NBR = {
  // NBR 6118:2023, item 6.4.2, Tabela 6.1 — classes de agressividade ambiental
  caa: {
    1: { rotulo: "I — fraca", ambiente: "Rural ou submersa" },
    2: { rotulo: "II — moderada", ambiente: "Urbana" },
    3: { rotulo: "III — forte", ambiente: "Marinha ou industrial" },
    4: { rotulo: "IV — muito forte", ambiente: "Industrial química ou respingos de maré" },
  },
  // NBR 6118:2023, item 7.4.2, Tabela 7.1 — concreto armado: classe mínima e
  // relação água/cimento máxima por classe de agressividade
  classeMinima: { 1: 20, 2: 25, 3: 30, 4: 40 },
  acMaxima: { 1: 0.65, 2: 0.60, 3: 0.55, 4: 0.45 },
  // NBR 6118:2023, item 7.4.7.2, Tabela 7.2 — cobrimento nominal (mm),
  // concreto armado, com Δc = 10 mm
  cobrimento: {
    laje: { 1: 20, 2: 25, 3: 35, 4: 45 },
    vigaPilar: { 1: 25, 2: 30, 3: 40, 4: 50 },
    contatoSolo: { 1: 30, 2: 30, 3: 40, 4: 50 },
  },
  // NBR 6118:2023, item 13.2.2 — vigas: largura mínima 12 cm (10 cm só em
  // casos excepcionais, com as condições do item)
  vigaLarguraMin: 12,
  vigaLarguraExcepcional: 10,
  // NBR 6118:2023, item 13.2.3 — pilares: menor dimensão 19 cm; entre 14 e
  // 19 cm com o coeficiente adicional γn da Tabela 13.1; área mínima 360 cm²
  pilarDimMin: 19,
  pilarDimAbsoluta: 14,
  pilarAreaMin: 360,
  gamaN: (b) => Math.round((1.95 - 0.05 * b) * 100) / 100, // Tabela 13.1, b em cm (14 ≤ b < 19)
  // NBR 6118:2023, item 13.2.4.1 — lajes maciças: espessura mínima (cm)
  lajeEspMin: {
    cobertura: 7,       // cobertura não em balanço
    piso: 8,            // piso não em balanço
    balanco: 10,        // lajes em balanço
    veiculo30: 10,      // pisos para veículos de peso total ≤ 30 kN
    veiculoMaior: 12,   // pisos para veículos de peso total > 30 kN
  },
};

// ---------- escolhas de concepção (não são norma) ----------
const ES_PADRAO = {
  caa: 2,                   // área urbana
  fck: 25,                  // MPa
  pilar: { b: 0.14, h: 0.30 }, // embutido na parede de 14 (exige γn — NBR 6118 13.2.3)
  viga: { b: 0.14, h: 0.40 },
  baldrame: { b: 0.14, h: 0.30 },
  lajeEsp: 0.10,            // m
  vaoMax: 5.0,              // m entre pilares ao longo de uma parede
  baldrames: true,          // vigas baldrame no pavimento mais baixo
};

const esR3 = (x) => Math.round(x * 1000) / 1000;
const esDist = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);
const esLen = (w) => esDist(w.a, w.b);

// fck aceitos e a classe mínima por agressividade
function esFckOk(params) {
  const min = ES_NBR.classeMinima[params.caa] || 25;
  return { ok: params.fck >= min, min };
}

// ---------- nós da rede de paredes ----------
// Agrupa pontas próximas e acha encontros em T (ponta de uma parede no meio
// de outra). Cada nó guarda as direções das paredes que chegam nele.
function esNos(paredes, tol = 0.06) {
  const nos = [];
  const achar = (p) => nos.find((n) => esDist(n, p) <= tol);
  const ws = paredes.map((w, i) => ({ ...w, i })).filter((w) => esLen(w) > 1e-6);
  for (const w of ws) for (const f of ["a", "b"]) {
    const p = w[f], o = f === "a" ? w.b : w.a, L = esLen(w);
    let n = achar(p); if (!n) { n = { x: p.x, y: p.y, dirs: [], paredes: [] }; nos.push(n); }
    n.dirs.push({ x: (o.x - p.x) / L, y: (o.y - p.y) / L, i: w.i, curva: w.curva || null });
    n.paredes.push(w.i);
  }
  // encontros em T: ponta de uma parede sobre o eixo de outra
  for (const n of nos) for (const w of ws) {
    if (n.paredes.includes(w.i)) continue;
    const L = esLen(w), ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L;
    const s = (n.x - w.a.x) * ux + (n.y - w.a.y) * uy, d = Math.abs((n.x - w.a.x) * -uy + (n.y - w.a.y) * ux);
    if (s > tol && s < L - tol && d <= Math.max(tol, (w.t || 0) / 2)) {
      n.dirs.push({ x: ux, y: uy, i: w.i, passa: true }, { x: -ux, y: -uy, i: w.i, passa: true });
      n.paredes.push(w.i); n.emT = true;
    }
  }
  return nos;
}

// precisa de pilar no nó? Canto, encontro de 3+ paredes, ponta solta.
// Duas paredes alinhadas (ou trechos da mesma curva) não pedem pilar.
function esNoPedePilar(n) {
  const ds = n.dirs;
  if (ds.length === 1) return true;
  if (ds.length === 2) {
    if (ds[0].curva && ds[0].curva === ds[1].curva) return false;
    const cos = ds[0].x * ds[1].x + ds[0].y * ds[1].y;
    return cos > -Math.cos(10 * Math.PI / 180); // não alinhadas (desvio > 10°)
  }
  return true;
}

// posição ao longo da parede (s, a partir de w.a) está dentro de um vão?
function esVaoEm(w, s, folga) {
  for (const o of w.ab || []) {
    const l = o.larg || 0;
    if (s > o.x - l / 2 - folga && s < o.x + l / 2 + folga) return o;
  }
  return null;
}

// ---------- lançamento ----------
// paredes/areas: do pavimento; params: ES_PADRAO com o que o usuário mudou;
// opts.baldrames: gera vigas baldrame (pavimento mais baixo).
// Devolve { pilares, vigas, lajes } com ids estáveis por pavimento.
function esLancar(paredes, areas, params, opts = {}) {
  const P = { ...ES_PADRAO, ...(params || {}) };
  const pil = P.pilar, vg = P.viga;
  const ws = (paredes || []).filter((w) => esLen(w) > 0.05);
  const nos = esNos(ws);
  const pilares = [];
  const juntar = (p, ang) => {
    if (pilares.some((q) => esDist(q, p) < Math.max(pil.h, 0.3))) return;
    pilares.push({ x: esR3(p.x), y: esR3(p.y), b: pil.b, h: pil.h, ang: esR3(ang) });
  };
  // 1) cantos, encontros e pontas
  for (const n of nos) {
    if (!esNoPedePilar(n)) continue;
    // lado maior na direção da parede mais comprida que chega no nó
    let melhor = n.dirs[0], Lm = -1;
    for (const d of n.dirs) { const L = esLen(ws[d.i]); if (L > Lm) { Lm = L; melhor = d; } }
    juntar(n, Math.atan2(melhor.y, melhor.x));
  }
  // 2) pilares intermediários onde o trecho entre pilares passa do vão máximo
  const naParede = (w) => {
    const L = esLen(w), ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L;
    return pilares.map((p) => ({ p, s: (p.x - w.a.x) * ux + (p.y - w.a.y) * uy, d: Math.abs((p.x - w.a.x) * -uy + (p.y - w.a.y) * ux) }))
      .filter((q) => q.d <= Math.max(0.1, (w.t || 0) / 2 + 0.02) && q.s > -0.1 && q.s < L + 0.1).sort((a, b) => a.s - b.s);
  };
  for (const w of ws) {
    const L = esLen(w), ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L, ang = Math.atan2(uy, ux);
    const marcos = [0, ...naParede(w).map((q) => q.s).filter((s) => s > 0.05 && s < L - 0.05), L];
    for (let k = 0; k < marcos.length - 1; k++) {
      const s0 = marcos[k], s1 = marcos[k + 1], vao = s1 - s0;
      if (vao <= P.vaoMax + 1e-9) continue;
      const n = Math.ceil(vao / P.vaoMax), passo = vao / n;
      for (let j = 1; j < n; j++) {
        let s = s0 + passo * j;
        // fora de porta/janela: empurra para a ombreira mais próxima
        const o = esVaoEm(w, s, pil.h / 2);
        if (o) {
          const e = o.x - o.larg / 2 - pil.h / 2 - 0.02, d = o.x + o.larg / 2 + pil.h / 2 + 0.02;
          s = Math.abs(e - s) <= Math.abs(d - s) && e > s0 + 0.3 ? e : d;
        }
        juntar({ x: w.a.x + ux * s, y: w.a.y + uy * s }, ang);
      }
    }
  }
  pilares.forEach((p, k) => { p.id = "P" + (k + 1); });
  // 3) vigas: cada parede dividida nos pilares que estão sobre ela
  const vigas = [], baldrames = [];
  for (const w of ws) {
    const L = esLen(w), ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L;
    const sobre = naParede(w);
    const marcos = [{ s: 0, p: null }, ...sobre.filter((q) => q.s > 0.05 && q.s < L - 0.05), { s: L, p: null }];
    // pontas da parede que caem num pilar contam como apoio
    const pIni = sobre.find((q) => Math.abs(q.s) <= 0.1), pFim = sobre.find((q) => Math.abs(q.s - L) <= 0.1);
    if (pIni) marcos[0].p = pIni.p; if (pFim) marcos[marcos.length - 1].p = pFim.p;
    for (let k = 0; k < marcos.length - 1; k++) {
      const s0 = marcos[k].s, s1 = marcos[k + 1].s; if (s1 - s0 < 0.05) continue;
      const trecho = {
        a: { x: esR3(w.a.x + ux * s0), y: esR3(w.a.y + uy * s0) }, b: { x: esR3(w.a.x + ux * s1), y: esR3(w.a.y + uy * s1) },
        apoioA: marcos[k].p ? marcos[k].p.id : null, apoioB: marcos[k + 1].p ? marcos[k + 1].p.id : null,
        parede: paredes.indexOf(w), s0: esR3(s0), s1: esR3(s1),
      };
      vigas.push({ ...trecho, b_: vg.b, h: vg.h, topo: w.h || 2.8 });
      if (opts.baldrames && P.baldrames) baldrames.push({ ...trecho, b_: P.baldrame.b, h: P.baldrame.h, topo: 0, baldrame: true });
    }
  }
  [...vigas, ...baldrames].forEach((v, k) => { v.id = (v.baldrame ? "VB" : "V") + (v.baldrame ? k - vigas.length + 1 : k + 1); });
  // 4) lajes: as que o arquiteto desenhou neste pavimento
  const lajes = (areas || []).map((a, i) => ({ a, i })).filter(({ a }) => a.tipo === "laje" && a.pts && a.pts.length >= 3)
    .map(({ a, i }, k) => ({ id: "L" + (k + 1), area: i, pts: a.pts, esp: a.esp || P.lajeEsp, uso: a.uso || "piso" }));
  return { pilares, vigas: [...vigas, ...baldrames], lajes };
}

// cantos do pilar (retângulo b × h girado em ang, centrado em x,y)
function esCantosPilar(p) {
  const c = Math.cos(p.ang || 0), s = Math.sin(p.ang || 0), hx = p.h / 2, hy = p.b / 2;
  return [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].map(([u, v]) => ({ x: p.x + u * c - v * s, y: p.y + u * s + v * c }));
}

function esAreaPoli(pts) { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.y - b.x * a.y; } return Math.abs(s) / 2; }
function esPerimPoli(pts) { let s = 0; for (let i = 0; i < pts.length; i++) s += esDist(pts[i], pts[(i + 1) % pts.length]); return s; }

// menor vão de uma laje (aprox.: menor lado do retângulo envolvente girado
// na direção do lado mais longo do polígono)
function esMenorVao(pts) {
  let lm = 0, ang = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], l = esDist(a, b); if (l > lm) { lm = l; ang = Math.atan2(b.y - a.y, b.x - a.x); } }
  const c = Math.cos(ang), s = Math.sin(ang); let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of pts) { const u = p.x * c + p.y * s, v = -p.x * s + p.y * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  return Math.min(u1 - u0, v1 - v0);
}

// ---------- verificações ----------
// tipo: "nbr" (não atende norma), "compat" (conflito com a arquitetura),
// "atencao" (escolha de concepção a revisar). Cada aviso tem um ponto para a
// tela mostrar onde é.
function esVerificar(est, paredes, params, ctx = {}) {
  const P = { ...ES_PADRAO, ...(params || {}) };
  const av = [];
  const add = (tipo, ref, texto, ponto, norma) => av.push({ tipo, ref, texto, ponto, norma: norma || null });
  // durabilidade
  const fk = esFckOk(P);
  if (!fk.ok) add("nbr", "geral", `Concreto C${P.fck} abaixo do mínimo C${fk.min} para a classe de agressividade ${ES_NBR.caa[P.caa].rotulo}.`, null, "NBR 6118, Tabela 7.1");
  // pilares (o γn, que vale para muitos de uma vez, sai num aviso só por espessura)
  const comGamaN = new Map();
  for (const p of est.pilares || []) {
    const b = Math.round(Math.min(p.b, p.h) * 100), area = Math.round(p.b * 100) * Math.round(p.h * 100);
    if (b < ES_NBR.pilarDimAbsoluta) add("nbr", p.id, `${p.id}: menor dimensão ${b} cm, abaixo de ${ES_NBR.pilarDimAbsoluta} cm.`, p, "NBR 6118, 13.2.3");
    else if (b < ES_NBR.pilarDimMin) { if (!comGamaN.has(b)) comGamaN.set(b, []); comGamaN.get(b).push(p); }
    if (area < ES_NBR.pilarAreaMin) add("nbr", p.id, `${p.id}: seção de ${area} cm², abaixo de ${ES_NBR.pilarAreaMin} cm².`, p, "NBR 6118, 13.2.3");
    // pilar dentro de porta/janela
    for (const w of paredes || []) {
      const L = esLen(w); if (!L) continue;
      const ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L;
      const s = (p.x - w.a.x) * ux + (p.y - w.a.y) * uy, d = Math.abs((p.x - w.a.x) * -uy + (p.y - w.a.y) * ux);
      if (d > (w.t || 0) / 2 + Math.min(p.b, p.h) / 2) continue;
      const meio = Math.max(p.b, p.h) / 2;
      const o = esVaoEm(w, s, meio - 0.005);
      if (o) add("compat", p.id, `${p.id} cai dentro de ${(o.tipo || "").startsWith("porta") ? "uma porta" : (o.tipo === "vao" ? "um vão" : "uma janela")}.`, p);
      if (Math.min(p.b, p.h) > (w.t || 0) + 0.005 && d < 0.02) add("atencao", p.id, `${p.id} (${Math.round(Math.min(p.b, p.h) * 100)} cm) é mais grosso que a parede de ${Math.round((w.t || 0) * 100)} cm e vai aparecer.`, p);
    }
    // continuidade: pilar sem pilar embaixo nasce numa viga (transição)
    if (ctx.pilaresAbaixo && !ctx.pilaresAbaixo.some((q) => esDist(q, p) < 0.15)) add("atencao", p.id, `${p.id} não tem pilar embaixo: vai nascer numa viga (transição).`, p);
  }
  for (const [b, ps] of comGamaN) {
    const nomes = ps.length > 4 ? `${ps.slice(0, 3).map((p) => p.id).join(", ")} e mais ${ps.length - 3}` : ps.map((p) => p.id).join(", ");
    add("atencao", ps.map((p) => p.id).join(","), `${nomes}: ${b} cm é menor que ${ES_NBR.pilarDimMin} cm — permitido com γn = ${String(ES_NBR.gamaN(b)).replace(".", ",")} nos esforços.`, ps.length === 1 ? ps[0] : null, "NBR 6118, 13.2.3 e Tabela 13.1");
  }
  // vigas
  for (const v of est.vigas || []) {
    const bw = Math.round(v.b_ * 100), L = esDist(v.a, v.b), meio = { x: (v.a.x + v.b.x) / 2, y: (v.a.y + v.b.y) / 2 };
    if (bw < ES_NBR.vigaLarguraExcepcional) add("nbr", v.id, `${v.id}: largura ${bw} cm, abaixo de ${ES_NBR.vigaLarguraExcepcional} cm.`, meio, "NBR 6118, 13.2.2");
    else if (bw < ES_NBR.vigaLarguraMin) add("atencao", v.id, `${v.id}: largura ${bw} cm (menor que ${ES_NBR.vigaLarguraMin} cm) só nos casos excepcionais do item.`, meio, "NBR 6118, 13.2.2");
    if (!v.baldrame && (!v.apoioA || !v.apoioB)) add("atencao", v.id, `${v.id}: ${!v.apoioA && !v.apoioB ? "sem pilar nas pontas" : "uma ponta sem pilar"} — apoia em outra viga.`, meio);
    if (!v.baldrame && L > P.vaoMax + 0.01) add("atencao", v.id, `${v.id}: vão de ${String(L.toFixed(2)).replace(".", ",")} m, maior que o vão adotado de ${String(P.vaoMax.toFixed(2)).replace(".", ",")} m.`, meio);
    // fundo da viga dentro da altura de porta/janela que fica embaixo dela
    if (!v.baldrame && v.parede != null && paredes[v.parede]) {
      const w = paredes[v.parede], fundo = (v.topo || w.h || 0) - v.h;
      for (const o of w.ab || []) {
        if (o.x + o.larg / 2 < v.s0 || o.x - o.larg / 2 > v.s1) continue;
        const topoVao = (o.peit || 0) + (o.alt || 0);
        if (topoVao > fundo + 0.005) add("compat", v.id, `${v.id} (${Math.round(v.h * 100)} cm) invade o vão de ${(o.tipo || "").startsWith("porta") ? "porta" : "janela"} em ${Math.round((topoVao - fundo) * 100)} cm: fundo da viga a ${String(fundo.toFixed(2)).replace(".", ",")} m, topo do vão a ${String(topoVao.toFixed(2)).replace(".", ",")} m.`, meio);
      }
    }
  }
  // lajes
  for (const l of est.lajes || []) {
    const esp = Math.round(l.esp * 100), min = ES_NBR.lajeEspMin[l.uso] || ES_NBR.lajeEspMin.piso;
    const c = { x: l.pts.reduce((t, q) => t + q.x, 0) / l.pts.length, y: l.pts.reduce((t, q) => t + q.y, 0) / l.pts.length };
    if (esp < min) add("nbr", l.id, `${l.id}: ${esp} cm, abaixo do mínimo de ${min} cm para laje de ${l.uso === "cobertura" ? "cobertura" : l.uso === "balanco" ? "balanço" : "piso"}.`, c, "NBR 6118, 13.2.4.1");
  }
  return av;
}

// ---------- quantitativos (concreto e fôrma) ----------
// alturaPav: pé-direito do pavimento (topo das paredes) para os pilares.
function esQuantitativos(est, alturaPav) {
  let concreto = 0, forma = 0;
  const q = { pilares: { n: 0, concreto: 0, forma: 0 }, vigas: { n: 0, comprimento: 0, concreto: 0, forma: 0 }, baldrames: { n: 0, comprimento: 0, concreto: 0, forma: 0 }, lajes: { n: 0, area: 0, concreto: 0, forma: 0 } };
  for (const p of est.pilares || []) {
    const H = alturaPav || 2.8; q.pilares.n++; q.pilares.concreto += p.b * p.h * H; q.pilares.forma += 2 * (p.b + p.h) * H;
  }
  for (const v of est.vigas || []) {
    const L = esDist(v.a, v.b), g = v.baldrame ? q.baldrames : q.vigas;
    g.n++; g.comprimento += L; g.concreto += v.b_ * v.h * L; g.forma += (v.baldrame ? 2 * v.h : v.b_ + 2 * v.h) * L;
  }
  for (const l of est.lajes || []) { const A = esAreaPoli(l.pts); q.lajes.n++; q.lajes.area += A; q.lajes.concreto += A * l.esp; q.lajes.forma += A; }
  for (const g of Object.values(q)) { concreto += g.concreto; forma += g.forma; }
  return { ...q, concreto, forma };
}
