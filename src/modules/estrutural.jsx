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
  // auto: a menor seção que a NBR 6118 (13.2.3) aceita e que cabe na parede —
  // largura = espessura da parede (mín. 14 cm, com γn abaixo de 19 cm) e
  // comprimento até 360 cm², em múltiplos de 5 cm (14 → 14 × 30; 19 → 19 × 19).
  // A carga (etapas 3 e 4) aumenta a seção onde for preciso.
  pilar: { auto: true, b: 0.14, h: 0.30 },
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
// No Projetar uma parede pode terminar no eixo da outra ou encostada na face
// dela (meia espessura antes): as duas contam como o mesmo encontro, e o nó vai
// para o cruzamento dos eixos — é ali que fica o pilar.
function esNos(paredes, tol = 0.06) {
  const nos = [];
  const ws = paredes.map((w, i) => ({ ...w, i })).filter((w) => esLen(w) > 1e-6);
  // até uma espessura de parede de folga: ponta que parou um pouco antes da
  // outra parede (desenho impreciso) também é encontro
  const tolW = (w) => Math.max(tol, (w.t || 0) + 0.01);
  for (const w of ws) for (const f of ["a", "b"]) {
    const p = w[f], o = f === "a" ? w.b : w.a, L = esLen(w);
    let n = nos.find((m) => esDist(m, p) <= tolW(w));
    if (!n) { n = { x: p.x, y: p.y, dirs: [], paredes: [], pts: [] }; nos.push(n); }
    n.dirs.push({ x: (o.x - p.x) / L, y: (o.y - p.y) / L, i: w.i, curva: w.curva || null, p });
    n.paredes.push(w.i); n.pts.push(p);
  }
  // pontas juntadas: o nó vai para o cruzamento dos eixos das duas primeiras
  // paredes não paralelas
  for (const n of nos) {
    const ds = n.dirs; let feito = false;
    for (let a = 0; a < ds.length && !feito; a++) for (let b = a + 1; b < ds.length && !feito; b++) {
      const d1 = ds[a], d2 = ds[b], cr = d1.x * d2.y - d1.y * d2.x; if (Math.abs(cr) < 0.17) continue; // quase paralelas
      const p1 = d1.p, p2 = d2.p, t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / cr;
      const q = { x: p1.x + d1.x * t, y: p1.y + d1.y * t };
      if (esDist(q, n) <= 0.2) { n.x = q.x; n.y = q.y; feito = true; }
    }
  }
  // encontros em T: ponta de uma parede no eixo de outra ou encostada na face
  // dela; o nó vai para o eixo da parede que passa
  for (const n of nos) for (const w of ws) {
    if (n.paredes.includes(w.i)) continue;
    const L = esLen(w), ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L;
    const s = (n.x - w.a.x) * ux + (n.y - w.a.y) * uy, d = Math.abs((n.x - w.a.x) * -uy + (n.y - w.a.y) * ux);
    if (s > tol && s < L - tol && d <= tolW(w)) {
      n.dirs.push({ x: ux, y: uy, i: w.i, passa: true }, { x: -ux, y: -uy, i: w.i, passa: true });
      n.paredes.push(w.i); n.emT = true;
      n.x = w.a.x + ux * s; n.y = w.a.y + uy * s;
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

// menor seção de pilar que a NBR 6118 13.2.3 aceita numa parede de t cm:
// menor dimensão ≥ 14 cm (entre 14 e 19 com γn), área ≥ 360 cm²; o lado
// maior em múltiplos de 5 cm
function esSecaoMinimaPilar(tcm) {
  const b = Math.max(ES_NBR.pilarDimAbsoluta, Math.min(ES_NBR.pilarDimMin, Math.round(tcm || 0)));
  const h = b * b >= ES_NBR.pilarAreaMin ? b : Math.max(b, Math.ceil(ES_NBR.pilarAreaMin / b / 5) * 5);
  return { b: b / 100, h: h / 100 };
}

// meia extensão do pilar (retângulo b × h girado em ang) na direção v
function esMeiaExt(p, v) {
  const c = Math.cos(p.ang || 0), s = Math.sin(p.ang || 0);
  return Math.abs(v.x * c + v.y * s) * p.h / 2 + Math.abs(-v.x * s + v.y * c) * p.b / 2;
}

// porta, janela ou vão que a seção do pilar invade (em qualquer parede que
// ele toca), ou null
function esPilarNoVao(p, paredes) {
  const cs = esCantosPilar(p);
  for (const w of paredes || []) {
    const L = esLen(w); if (!L || !(w.ab || []).length) continue;
    const ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L;
    const ss = cs.map((q) => (q.x - w.a.x) * ux + (q.y - w.a.y) * uy), dd = cs.map((q) => (q.x - w.a.x) * -uy + (q.y - w.a.y) * ux);
    const t2 = (w.t || 0) / 2;
    if (Math.min(...dd) > t2 - 0.005 || Math.max(...dd) < -t2 + 0.005) continue; // não toca a parede
    const s0 = Math.min(...ss), s1 = Math.max(...ss);
    for (const o of w.ab) if (s1 > o.x - o.larg / 2 + 0.005 && s0 < o.x + o.larg / 2 - 0.005) return o;
  }
  return null;
}

// lado de dentro da casa de cada parede: +1 (lado da normal), -1, ou 0
// (parede interna ou não dá para saber). Dentro = dentro de um ambiente ou
// cercado de paredes por todos os lados.
function esLadoInternoFn(ws, areas) {
  const ambs = (areas || []).filter((a) => a.tipo === "ambiente" && a.pts && a.pts.length >= 3 && !a.aberto).map((a) => a.pts);
  const dentroPoli = (q, pts) => { let d = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a.y > q.y) !== (b.y > q.y) && q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x) d = !d; } return d; };
  // ponto fechado pelas paredes: um raio em cada uma de 8 direções bate numa parede
  const fechado = (q) => {
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4, rx = Math.cos(a), ry = Math.sin(a);
      const bate = ws.some((w) => {
        const ex = w.b.x - w.a.x, ey = w.b.y - w.a.y, den = rx * ey - ry * ex; if (Math.abs(den) < 1e-9) return false;
        const t = ((w.a.x - q.x) * ey - (w.a.y - q.y) * ex) / den, u = ((w.a.x - q.x) * ry - (w.a.y - q.y) * rx) / den;
        return t > 0 && u >= -0.02 && u <= 1.02;
      });
      if (!bate) return false;
    }
    return true;
  };
  const emAmb = (q) => ambs.some((pts) => dentroPoli(q, pts)) || fechado(q);
  const cache = new Map();
  return (i) => {
    if (cache.has(i)) return cache.get(i);
    const w = ws[i], L = esLen(w), nx = -(w.b.y - w.a.y) / L, ny = (w.b.x - w.a.x) / L, m = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
    let r = 0;
    {
      const dist = (w.t || 0) / 2 + 0.2, mais = emAmb({ x: m.x + nx * dist, y: m.y + ny * dist }), menos = emAmb({ x: m.x - nx * dist, y: m.y - ny * dist });
      r = mais && !menos ? 1 : menos && !mais ? -1 : 0;
    }
    cache.set(i, r); return r;
  };
}

// Encaixe do pilar no encontro (concepção, não norma):
// - não passa da face de uma parede para o lado em que não há outra parede
//   (canto: alinhado com as duas faces de fora; T: alinhado com a face oposta
//   à parede que chega);
// - parede sem nada dos dois lados (trecho corrido, ponta): na fachada,
//   alinhado com a face de fora (a sobra vai para dentro); interna, centrado;
// - ponta solta: o pilar fica todo sobre a parede;
// - depois, se ainda invadir porta ou janela, desliza ao longo da parede até
//   sair do vão (o ponto de apoio das vigas vai junto).
function esEncaixarPilar(p, ws, interno) {
  const dirs = p._dirs || [];
  const unicas = [];
  for (const d of dirs) if (!unicas.some((u) => u.i === d.i)) unicas.push(d);
  let dx = 0, dy = 0;
  const feitas = [];
  for (const d of unicas) {
    const w = ws[d.i]; if (!w) continue;
    const L = esLen(w), ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L, n = { x: -uy, y: ux };
    if (feitas.some((m) => Math.abs(m.x * n.x + m.y * n.y) > 0.98)) continue; // paralela a uma já tratada
    feitas.push(n);
    const lado = (sg) => dirs.some((o) => o.i !== d.i && (o.x * n.x + o.y * n.y) * sg > 0.3);
    const temMais = lado(1), temMenos = lado(-1), sobra = Math.max(0, esMeiaExt(p, n) - (w.t || 0) / 2);
    let k = 0;
    if (temMais && !temMenos) k = sobra; else if (temMenos && !temMais) k = -sobra;
    else if (!temMais && !temMenos) k = interno(d.i) * sobra;
    dx += n.x * k; dy += n.y * k;
  }
  // ponta solta: uma parede só, saindo do nó num sentido
  if (dirs.length === 1) { const d = dirs[0], e = esMeiaExt(p, d); dx += d.x * e; dy += d.y * e; }
  p.x = esR3(p.no.x + dx); p.y = esR3(p.no.y + dy);
  // fora de porta e janela
  if (!esPilarNoVao(p, ws)) return;
  const base = { x: p.x, y: p.y }, no0 = { ...p.no };
  for (let passo = 0.025; passo <= 1.2 + 1e-9; passo += 0.025) {
    for (const d of unicas) for (const sg of [1, -1]) {
      const w = ws[d.i], L = esLen(w), ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L;
      const nx = base.x + ux * passo * sg, ny = base.y + uy * passo * sg;
      const sAx = (no0.x + ux * passo * sg - w.a.x) * ux + (no0.y + uy * passo * sg - w.a.y) * uy;
      if (sAx < -0.01 || sAx > L + 0.01) continue; // continua sobre a parede
      p.x = esR3(nx); p.y = esR3(ny);
      if (!esPilarNoVao(p, ws)) { p.no = { x: esR3(no0.x + ux * passo * sg), y: esR3(no0.y + uy * passo * sg) }; p.deslocado = esR3(passo); return; }
    }
  }
  p.x = base.x; p.y = base.y; // não achou: fica e a verificação aponta
}

// ---------- lançamento ----------
// paredes/areas: do pavimento; params: ES_PADRAO com o que o usuário mudou;
// opts.baldrames: gera vigas baldrame (pavimento mais baixo).
// Devolve { pilares, vigas, lajes } com ids estáveis por pavimento.
function esLancar(paredes, areas, params, opts = {}) {
  const P = { ...ES_PADRAO, ...(params || {}) };
  const pil = P.pilar, vg = P.viga;
  // seção do pilar: fixa (parâmetro) ou automática pela parede em que ele está
  const secao = (dirs) => {
    if (!pil.auto) return { b: pil.b, h: pil.h };
    const t = Math.round(Math.max(0, ...(dirs || []).map((d) => (ws[d.i] && ws[d.i].t) || 0)) * 100);
    return esSecaoMinimaPilar(t);
  };
  const ws = (paredes || []).filter((w) => esLen(w) > 0.05);
  const nos = esNos(ws);
  const pilares = [];
  // no = ponto da rede de paredes onde o pilar está (é por ele que as vigas
  // se apoiam); x,y = centro da seção, acertado depois (esEncaixarPilar)
  // origem: "encontro" (canto, T, ponta), "continuidade" (veio de outro
  // pavimento) ou "vao" (intermediário por vão máximo)
  const juntar = (no, ang, dirs, origem) => {
    if (opts.pisoAbaixo && origem !== "continuidade" && !esPilarSemTransicao(no, dirs, ws, opts.pisoAbaixo)) return false;
    const sc = secao(dirs);
    if (pilares.some((q) => esDist(q.no, no) < Math.max(q.h, sc.h, 0.3))) return true; // já tem pilar aqui
    pilares.push({ x: esR3(no.x), y: esR3(no.y), b: sc.b, h: sc.h, ang: esR3(ang), no: { x: esR3(no.x), y: esR3(no.y) }, origem, _dirs: dirs });
    return true;
  };
  // 1) cantos, encontros e pontas
  for (const n of nos) {
    if (!esNoPedePilar(n)) continue;
    // lado maior ao longo de uma parede que atravessa o nó (encontro em T ou
    // cruz); não havendo, ao longo da parede mais comprida que chega nele
    const passa = (d) => n.dirs.some((o) => o !== d && o.x * d.x + o.y * d.y < -0.985);
    let melhor = null, Lm = -1;
    for (const d of n.dirs) { const L = esLen(ws[d.i]) + (passa(d) ? 1e6 : 0); if (L > Lm) { Lm = L; melhor = d; } }
    juntar(n, Math.atan2(melhor.y, melhor.x), n.dirs.map((d) => ({ x: d.x, y: d.y, i: d.i })), "encontro");
  }
  // 1b) continuidade: pilar do pavimento de baixo que cai sobre uma parede
  // deste (fora de porta e janela) sobe junto, mesmo sem canto ou encontro
  // ali; e pilar de encontro do pavimento de cima que cai sobre uma parede
  // deste desce junto (até a fundação). Evita transição (pilar nascendo em
  // viga) e já divide os vãos.
  for (const pb of [...(opts.pilaresAbaixo || []), ...(opts.pilaresAcima || [])]) {
    const q = pb.no || pb;
    for (const w of ws) {
      const L = esLen(w), ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L;
      const sv = (q.x - w.a.x) * ux + (q.y - w.a.y) * uy, d = Math.abs((q.x - w.a.x) * -uy + (q.y - w.a.y) * ux);
      if (d > Math.max(0.1, (w.t || 0) / 2 + 0.02) || sv < -0.1 || sv > L + 0.1) continue;
      if (esVaoEm(w, sv, secao([{ i: ws.indexOf(w) }]).h / 2)) continue; // em cima de porta/janela não sobe
      const iw = ws.indexOf(w);
      juntar({ x: w.a.x + ux * Math.min(L, Math.max(0, sv)), y: w.a.y + uy * Math.min(L, Math.max(0, sv)) }, Math.atan2(uy, ux), [{ x: ux, y: uy, i: iw }, { x: -ux, y: -uy, i: iw }], "continuidade");
      break;
    }
  }
  // 2) pilares intermediários onde o trecho entre pilares passa do vão máximo
  const naParede = (w) => {
    const L = esLen(w), ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L;
    return pilares.map((p) => { const q = p.no || p; return { p, s: (q.x - w.a.x) * ux + (q.y - w.a.y) * uy, d: Math.abs((q.x - w.a.x) * -uy + (q.y - w.a.y) * ux) }; })
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
        const s = s0 + passo * j;
        // fora de porta/janela: vai para uma das ombreiras (a mais perto
        // primeiro; se ela der transição evitável, tenta a outra)
        const meio = secao([{ i: ws.indexOf(w) }]).h / 2, o = esVaoEm(w, s, meio);
        let cands = [s];
        if (o) {
          const e = o.x - o.larg / 2 - meio - 0.02, d = o.x + o.larg / 2 + meio + 0.02;
          cands = [e, d].filter((c) => c > s0 + 0.3 && c < s1 - 0.3).sort((a, b) => Math.abs(a - s) - Math.abs(b - s));
          if (!cands.length) cands = [Math.abs(e - s) <= Math.abs(d - s) ? e : d];
        }
        const iw = ws.indexOf(w);
        for (const c of cands) if (juntar({ x: w.a.x + ux * c, y: w.a.y + uy * c }, ang, [{ x: ux, y: uy, i: iw }, { x: -ux, y: -uy, i: iw }], "vao")) break;
      }
    }
  }
  // 3) encaixe de cada pilar na parede e fora de portas e janelas
  const interno = esLadoInternoFn(ws, areas);
  for (const p of pilares) { esEncaixarPilar(p, ws, interno); delete p._dirs; }
  pilares.forEach((p, k) => { p.id = "P" + (k + 1); });
  // altura do pilar neste pavimento: do piso (ou do fundo do baldrame, no
  // primeiro) até o topo da estrutura (piso de cima) — o pilar é contínuo
  const topoPil = opts.topo != null ? opts.topo : Math.max(0, ...ws.map((w) => w.h || 0)) || 2.8;
  const basePil = opts.baldrames && P.baldrames ? -P.baldrame.h : 0;
  for (const p of pilares) { p.base = esR3(basePil); p.topo = esR3(topoPil); }
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
      // topo da viga = topo da laje de cima (piso do pavimento de cima): a
      // laje apoia em cima da viga, e o pilar vai até esse nível
      vigas.push({ ...trecho, b_: vg.b, h: vg.h, topo: opts.topo != null ? opts.topo : (w.h || 2.8) });
      if (opts.baldrames && P.baldrames) baldrames.push({ ...trecho, b_: P.baldrame.b, h: P.baldrame.h, topo: 0, baldrame: true });
    }
  }
  [...vigas, ...baldrames].forEach((v, k) => { v.id = (v.baldrame ? "VB" : "V") + (v.baldrame ? k - vigas.length + 1 : k + 1); });
  // 4) lajes: as que o arquiteto desenhou neste pavimento
  const lajes = (areas || []).map((a, i) => ({ a, i })).filter(({ a }) => a.tipo === "laje" && a.pts && a.pts.length >= 3)
    .map(({ a, i }, k) => { const c = esCargaLaje(a, opts.usoPadrao); return { id: "L" + (k + 1), area: i, pts: a.pts, esp: c.pre ? c.pre.hTotal : (a.esp || P.lajeEsp), uso: c.piso ? "piso" : "cobertura", tipo: c.tipo, concretoM2: c.concreto, capa: c.pre ? c.pre.capa : null }; });
  return { pilares, vigas: [...vigas, ...baldrames], lajes };
}

// Lança todos os pavimentos (lista de { paredes, areas, usoPadrao }, de baixo
// para cima) com continuidade de pilares: 1ª passada sobe os pilares de
// baixo; 2ª passada também desce os pilares de encontro de cima (os que a
// arquitetura de cima exige) quando há parede embaixo.
// topo da estrutura de cada pavimento (em relação ao piso dele): o nível do
// pavimento de cima; no último, o topo da laje de cobertura/forro, se houver,
// senão o topo das paredes.
function esTopoPavimento(pavs, k) {
  const p = pavs[k], cima = pavs[k + 1];
  if (cima && cima.nivel != null && p.nivel != null) return esR3(cima.nivel - p.nivel);
  const lajes = (p.areas || []).filter((a) => a.tipo === "laje" && a.pts && a.pts.length >= 3).map((a) => (a.cota || 0) + (a.esp || 0.1));
  const hp = Math.max(0, ...(p.paredes || []).map((w) => w.h || 0));
  return esR3(lajes.length ? Math.max(...lajes) : (hp || 2.8));
}
function esLancarPavimentos(pavs, params) {
  const passada = (acimaDe) => {
    const r = [];
    pavs.forEach((p, k) => r.push(esLancar(p.paredes || [], p.areas || [], params, { baldrames: k === 0, usoPadrao: p.usoPadrao, topo: esTopoPavimento(pavs, k),
      pilaresAbaixo: k > 0 ? r[k - 1].pilares : null,
      pisoAbaixo: k > 0 ? { paredes: pavs[k - 1].paredes || [], pilares: r[k - 1].pilares } : null,
      pilaresAcima: acimaDe && acimaDe[k + 1] ? acimaDe[k + 1].pilares.filter((q) => q.origem !== "continuidade") : null })));
    return r;
  };
  const r = passada(passada(null));
  // vigas de piso: sob cada trecho de parede de cima que não tem parede
  // embaixo, no nível do piso dela (topo da estrutura do pavimento de baixo)
  const P = { ...ES_PADRAO, ...(params || {}) };
  for (let k = 1; k < pavs.length; k++) {
    const baixo = r[k - 1], topo = esTopoPavimento(pavs, k - 1);
    let n = 0;
    for (const w of pavs[k].paredes || []) {
      for (const [s0, s1] of esTrechosSemApoio(w, pavs[k - 1].paredes || [])) {
        const L = esLen(w), ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L;
        const a = { x: esR3(w.a.x + ux * s0), y: esR3(w.a.y + uy * s0) }, b = { x: esR3(w.a.x + ux * s1), y: esR3(w.a.y + uy * s1) };
        const apoio = (q) => { const pl = baixo.pilares.find((pp) => esDist(pp.no, q) <= 0.3); return pl ? pl.id : null; };
        baixo.vigas.push({ id: "VP" + (++n), a, b, apoioA: apoio(a), apoioB: apoio(b), parede: null, s0: 0, s1: esR3(s1 - s0), b_: P.viga.b, h: P.viga.h, topo, vigaPiso: true, sobPavimento: pavs[k].nome || null });
      }
    }
  }
  return r;
}

// trechos (s0, s1 ao longo da parede w) sem parede embaixo: tira da parede os
// trechos cobertos por paredes alinhadas do pavimento de baixo
function esTrechosSemApoio(w, paredesBaixo) {
  const L = esLen(w); if (L < 0.05) return [];
  const ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L, cob = [];
  for (const o of paredesBaixo || []) {
    const Lo = esLen(o); if (Lo < 0.05) continue;
    const vx = (o.b.x - o.a.x) / Lo, vy = (o.b.y - o.a.y) / Lo;
    if (Math.abs(ux * vx + uy * vy) < 0.996) continue; // não alinhada (> ~5°)
    const d = Math.abs((o.a.x - w.a.x) * -uy + (o.a.y - w.a.y) * ux);
    if (d > ((w.t || 0) + (o.t || 0)) / 2) continue;
    const sa = (o.a.x - w.a.x) * ux + (o.a.y - w.a.y) * uy, sb = (o.b.x - w.a.x) * ux + (o.b.y - w.a.y) * uy;
    cob.push([Math.min(sa, sb) - (o.t || 0) / 2, Math.max(sa, sb) + (o.t || 0) / 2]);
  }
  cob.sort((a, b) => a[0] - b[0]);
  const livres = []; let s = 0;
  for (const [c0, c1] of cob) { if (c0 > s + 1e-6) livres.push([s, Math.min(c0, L)]); s = Math.max(s, c1); if (s >= L) break; }
  if (s < L) livres.push([s, L]);
  return livres.map(([a, b]) => [Math.max(0, a), Math.min(L, b)]).filter(([a, b]) => b - a >= 0.3);
}

// Pilar do pavimento de cima que não tem pilar embaixo (transição) só entra
// quando não há saída melhor:
// - em cima de vão livre (sem parede embaixo): não entra — a parede de cima
//   apoia numa viga de piso e o encontro vira apoio de viga em viga;
// - a menos de 1,0 m de um pilar contínuo (que tem pilar embaixo) na mesma
//   parede: não entra — fica o contínuo, e o encontro vira apoio de viga em
//   viga perto dele (critério de concepção, não de norma).
function esPilarSemTransicao(no, dirs, ws, baixo) {
  const temPilar = (baixo.pilares || []).some((q) => esDist(q.no || q, no) < 0.15);
  if (temPilar) return true;
  const sobreParede = (baixo.paredes || []).some((w) => {
    const L = esLen(w); if (!L) return false; const ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L;
    const sv = (no.x - w.a.x) * ux + (no.y - w.a.y) * uy, d = Math.abs((no.x - w.a.x) * -uy + (no.y - w.a.y) * ux);
    return sv > -0.1 && sv < L + 0.1 && d <= (w.t || 0) / 2 + 0.05;
  });
  if (!sobreParede) return false;
  // em cima de parede sem porta/janela embaixo: o pilar desce (2ª passada) — entra
  const sobreVao = (baixo.paredes || []).some((w) => {
    const L = esLen(w); if (!L) return false; const ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L;
    const sv = (no.x - w.a.x) * ux + (no.y - w.a.y) * uy, d = Math.abs((no.x - w.a.x) * -uy + (no.y - w.a.y) * ux);
    return sv > -0.1 && sv < L + 0.1 && d <= (w.t || 0) / 2 + 0.05 && !!esVaoEm(w, sv, 0.1);
  });
  // ... a não ser que fique colado (até 1,0 m) a um pilar fixo de baixo (de
  // encontro ou contínuo) na mesma parede: aí não entra, e o vizinho é que serve
  if (!sobreVao) return !(baixo.pilares || []).some((q) => q.origem !== "vao" && esDist(q.no || q, no) <= 1.0);
  for (const d of dirs || []) {
    const w = ws[d.i]; if (!w) continue;
    const L = esLen(w), ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L;
    const perto = (baixo.pilares || []).some((q) => { const c = q.no || q, sv = (c.x - w.a.x) * ux + (c.y - w.a.y) * uy, dd = Math.abs((c.x - w.a.x) * -uy + (c.y - w.a.y) * ux); return dd <= (w.t || 0) / 2 + 0.05 && sv > -0.1 && sv < L + 0.1 && esDist(c, no) <= 1.0; });
    if (perto) return false;
  }
  return true;
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
  const comGamaN = new Map(), grossos = new Map();
  for (const p of est.pilares || []) {
    const b = Math.round(Math.min(p.b, p.h) * 100), area = Math.round(p.b * 100) * Math.round(p.h * 100);
    if (b < ES_NBR.pilarDimAbsoluta) add("nbr", p.id, `${p.id}: menor dimensão ${b} cm, abaixo de ${ES_NBR.pilarDimAbsoluta} cm.`, p, "NBR 6118, 13.2.3");
    else if (b < ES_NBR.pilarDimMin) { if (!comGamaN.has(b)) comGamaN.set(b, []); comGamaN.get(b).push(p); }
    if (area < ES_NBR.pilarAreaMin) add("nbr", p.id, `${p.id}: seção de ${area} cm², abaixo de ${ES_NBR.pilarAreaMin} cm².`, p, "NBR 6118, 13.2.3");
    // pilar invadindo porta/janela (pela seção inteira)
    const o = esPilarNoVao(p, paredes);
    if (o) add("compat", p.id, `${p.id} invade ${(o.tipo || "").startsWith("porta") ? "uma porta" : (o.tipo === "vao" ? "um vão" : "uma janela")}.`, p);
    // mais grosso que a parede em que está: fica aparente (aviso único, abaixo)
    const tParede = Math.min(...(paredes || []).filter((w) => { const L = esLen(w); if (!L) return false; const ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L, q = p.no || p; const s = (q.x - w.a.x) * ux + (q.y - w.a.y) * uy; return s > -0.1 && s < L + 0.1 && Math.abs((q.x - w.a.x) * -uy + (q.y - w.a.y) * ux) < 0.1; }).map((w) => w.t || 0), Infinity);
    if (isFinite(tParede) && Math.min(p.b, p.h) > tParede + 0.005) { const k = `${Math.round(Math.min(p.b, p.h) * 100)}|${Math.round(tParede * 100)}`; if (!grossos.has(k)) grossos.set(k, []); grossos.get(k).push(p); }
    // continuidade: pilar sem pilar embaixo nasce numa viga (transição)
    if (ctx.pilaresAbaixo && !ctx.pilaresAbaixo.some((q) => esDist(q.no || q, p.no || p) < 0.15)) add("atencao", p.id, `${p.id} não tem pilar embaixo: vai nascer numa viga (transição).`, p);
  }
  for (const [b, ps] of comGamaN) {
    const nomes = ps.length > 4 ? `${ps.slice(0, 3).map((p) => p.id).join(", ")} e mais ${ps.length - 3}` : ps.map((p) => p.id).join(", ");
    add("atencao", ps.map((p) => p.id).join(","), `${nomes}: ${b} cm é menor que ${ES_NBR.pilarDimMin} cm — permitido com γn = ${String(ES_NBR.gamaN(b)).replace(".", ",")} nos esforços.`, ps.length === 1 ? ps[0] : null, "NBR 6118, 13.2.3 e Tabela 13.1");
  }
  for (const [k, ps] of grossos) {
    const [bp, tp] = k.split("|");
    add("atencao", ps.map((p) => p.id).join(","), `${ps.length} pilar${ps.length === 1 ? "" : "es"} de ${bp} cm em parede de ${tp} cm: ficam aparentes. Na fachada a face de fora fica alinhada e a sobra vai para dentro.`, ps.length === 1 ? ps[0] : null);
  }
  // vigas
  for (const v of est.vigas || []) {
    const bw = Math.round(v.b_ * 100), L = esDist(v.a, v.b), meio = { x: (v.a.x + v.b.x) / 2, y: (v.a.y + v.b.y) / 2 };
    if (bw < ES_NBR.vigaLarguraExcepcional) add("nbr", v.id, `${v.id}: largura ${bw} cm, abaixo de ${ES_NBR.vigaLarguraExcepcional} cm.`, meio, "NBR 6118, 13.2.2");
    else if (bw < ES_NBR.vigaLarguraMin) add("atencao", v.id, `${v.id}: largura ${bw} cm (menor que ${ES_NBR.vigaLarguraMin} cm) só nos casos excepcionais do item.`, meio, "NBR 6118, 13.2.2");
    if (!v.baldrame && (!v.apoioA || !v.apoioB)) add("atencao", v.id, `${v.id}: ${!v.apoioA && !v.apoioB ? "sem pilar nas pontas" : "uma ponta sem pilar"} — apoia em outra viga.`, meio);
    if (v.vigaPiso) add("atencao", v.id, `${v.id}: viga de piso sob parede${v.sobPavimento ? ` do ${v.sobPavimento}` : " de cima"} que não tem parede embaixo — fica aparente no teto.`, meio);
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
    if (l.tipo && l.tipo !== "macica") continue; // pré-fabricada: NBR 14859 (verificação própria, etapa seguinte)
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
    const H = p.topo != null ? p.topo - (p.base || 0) : (alturaPav || 2.8); q.pilares.n++; q.pilares.concreto += p.b * p.h * H; q.pilares.forma += 2 * (p.b + p.h) * H;
  }
  for (const v of est.vigas || []) {
    const L = esDist(v.a, v.b), g = v.baldrame ? q.baldrames : q.vigas;
    g.n++; g.comprimento += L; g.concreto += v.b_ * v.h * L; g.forma += (v.baldrame ? 2 * v.h : v.b_ + 2 * v.h) * L;
  }
  // laje pré-fabricada: concreto da capa e das nervuras; não leva fôrma (só escoramento)
  for (const l of est.lajes || []) { const A = esAreaPoli(l.pts), pre = l.tipo === "trelicada" || l.tipo === "protendida"; q.lajes.n++; q.lajes.area += A; q.lajes.concreto += A * (l.concretoM2 != null ? l.concretoM2 : l.esp); q.lajes.forma += pre ? 0 : A; }
  for (const g of Object.values(q)) { concreto += g.concreto; forma += g.forma; }
  return { ...q, concreto, forma };
}

// ═══════════════════════════════════════════════════════════════
// CARGAS (etapa 2) — NBR 6120:2019
// ═══════════════════════════════════════════════════════════════
// Valores transcritos de fontes que reproduzem a NBR 6120:2019 e do projeto de
// revisão da norma (ABNT/CB-002, 2017), enquanto o texto oficial não é
// conferido. Cada grupo diz de onde veio (fonte) e se já foi conferido.
const ES_CARGAS = {
  // Alvenarias: peso por m² de parede (kN/m²), por espessura nominal do bloco
  // (cm), sem revestimento / com 1 cm / com 2 cm de revestimento em cada face
  alvenarias: {
    fonte: "NBR 6120:2019, tabela de alvenarias (via calculistadeaco.com.br)", conferido: false,
    sistemas: [
      { id: "ceramico_vedacao", rotulo: "Bloco cerâmico vazado — vedação (furo horizontal)", esp: { 9: [0.7, 1.1, 1.6], 11.5: [0.9, 1.3, 1.7], 14: [1.1, 1.5, 1.9], 19: [1.4, 1.8, 2.3] } },
      { id: "concreto_vedacao", rotulo: "Bloco de concreto vazado — vedação (classe C)", esp: { 6.5: [1.0, 1.4, 1.8], 9: [1.1, 1.5, 1.9], 11.5: [1.3, 1.7, 2.1], 14: [1.4, 1.8, 2.2], 19: [1.8, 1.9, 2.6] } },
      { id: "ceramico_estrutural", rotulo: "Bloco cerâmico estrutural (furo vertical, paredes vazadas)", esp: { 9: [1.1, 1.5, 1.9], 11.5: [1.4, 1.8, 2.2], 14: [1.7, 2.1, 2.5], 19: [3.4, 3.8, 4.2] } },
      { id: "ceramico_estrutural_macico", rotulo: "Bloco cerâmico estrutural (furo vertical, paredes maciças)", esp: { 14: [2.0, 2.3, 2.7] } },
      { id: "concreto_estrutural", rotulo: "Bloco de concreto estrutural (classes A e B)", esp: { 14: [2.0, 2.3, 2.7], 19: [2.7, 3.0, 3.4] } },
      { id: "tijolo_macico", rotulo: "Tijolo cerâmico maciço", esp: { 9: [1.6, 2.0, 2.4], 11.5: [2.1, 2.5, 2.9], 14: [2.5, 2.9, 3.3], 19: [3.4, 3.8, 4.2] } },
      { id: "concreto_celular", rotulo: "Concreto celular autoclavado (C25)", esp: { 7.5: [0.5, 0.9, 1.3], 10: [0.6, 1.0, 1.4], 12.5: [0.8, 1.2, 1.6], 15: [0.9, 1.3, 1.7], 17.5: [1.1, 1.5, 1.9], 20: [1.2, 1.6, 2.0] } },
    ],
  },
  // Pesos específicos (kN/m³) e revestimento de piso
  pesos: { fonte: "NBR 6120 (projeto de revisão 2017, Tabelas 5.1 e 5.4)", conferido: false, concretoArmado: 25, argamassa: 19, revestimentoPiso: 20 },
  // Forros (kN/m², com a estrutura de suporte)
  forros: {
    fonte: "NBR 6120 (projeto de revisão 2017, Tabela 5.8); reboco = 1,5 cm de argamassa a 19 kN/m³", conferido: false,
    tipos: [
      { id: "nenhum", rotulo: "Sem forro / sem reboco", g: 0 },
      { id: "reboco", rotulo: "Reboco na laje (1,5 cm)", g: 0.285 },
      { id: "gesso_placas", rotulo: "Forro de gesso em placas", g: 0.15 },
      { id: "gesso_acartonado", rotulo: "Forro de gesso acartonado", g: 0.25 },
      { id: "pvc", rotulo: "Forro de PVC", g: 0.10 },
      { id: "fibra_mineral", rotulo: "Forro de fibra mineral", g: 0.10 },
    ],
  },
  // Cargas variáveis de uso (kN/m²) — edifícios residenciais
  usos: {
    fonte: "NBR 6120 (projeto de revisão 2017, Tabela 6.1)", conferido: false,
    tipos: [
      { id: "residencial", rotulo: "Piso residencial (dormitório, sala, cozinha, banheiro)", q: 1.5, piso: true },
      { id: "servico", rotulo: "Área de serviço, lavanderia, despensa", q: 2.0, piso: true },
      { id: "varanda", rotulo: "Varanda, sacada, terraço", q: 2.5, piso: true },
      { id: "cobertura", rotulo: "Cobertura com acesso só para manutenção", q: 1.0, piso: false },
      { id: "forro", rotulo: "Forro sem acesso e sem estoque", q: 0, piso: false },
    ],
  },
  // Telhas (kN/m² de telhado inclinado) e telhados prontos (kN/m² em planta,
  // com a estrutura). Chaves = ids das telhas do Projetar (TP_TELHAS).
  telhas: {
    fonte: "NBR 6120 (projeto de revisão 2017, Tabelas 5.5 e 5.6)", conferido: false,
    porTelha: {
      "Telha Barro Portuguesa": { g: 0.45, grupo: "ceramica" }, "Telha Barro Americana": { g: 0.45, grupo: "ceramica" },
      "Telha Fibrocimento 6mm": { g: 0.18, grupo: "fibro6" }, "Telha Fibrocimento 8mm": { g: 0.24, grupo: "fibro8" },
      "Telha Metálica Simples": { g: 0.06, grupo: "aco" },
      // telha de concreto e telha termoacústica não estão na tabela: peso do fabricante
    },
    // telhado pronto (telha + estrutura) por m² em planta
    prontos: [
      { grupo: "ceramica", estrutura: "madeira", pctMax: 40, g: 0.7 },
      { grupo: "fibro5", estrutura: "madeira", g: 0.4, obs: "fibrocimento ondulada até 5 mm (nenhuma telha do Projetar hoje)" },
    ],
  },
};

const esAlvSistema = (id) => ES_CARGAS.alvenarias.sistemas.find((s) => s.id === id) || ES_CARGAS.alvenarias.sistemas[0];
// alvenaria de uma parede: a escolhida, ou a deduzida da espessura (bloco de
// vedação cerâmico mais largo que deixa ao menos 1 cm de revestimento por face)
function esAlvenariaDe(w) {
  const t = Math.round((w.t || 0.14) * 1000) / 10; // cm
  if (w.alv && w.alv.sist) {
    const s = esAlvSistema(w.alv.sist), blocos = Object.keys(s.esp).map(Number);
    const bloco = blocos.includes(+w.alv.bloco) ? +w.alv.bloco : blocos[0];
    return { sist: s.id, bloco, rev: [0, 1, 2].includes(+w.alv.rev) ? +w.alv.rev : 1, auto: false };
  }
  const s = esAlvSistema("ceramico_vedacao"), blocos = Object.keys(s.esp).map(Number).sort((a, b) => a - b);
  let bloco = blocos[0]; for (const b of blocos) if ((t - b) / 2 >= 0.99) bloco = b;
  const sobra = Math.max(0, (t - bloco) / 2), rev = sobra < 0.5 ? 0 : sobra < 1.5 ? 1 : 2;
  return { sist: s.id, bloco, rev, auto: true };
}
// peso da parede: g em kN/m² e a carga linear (kN/m) na altura que fica
// embaixo da viga (altura da parede − altura da viga)
function esCargaParede(w, hViga) {
  const a = esAlvenariaDe(w), s = esAlvSistema(a.sist), g = s.esp[a.bloco][a.rev];
  const hLivre = Math.max(0, (w.h || 0) - (hViga || 0));
  return { ...a, g, hLivre, linha: g * hLivre, L: esLen(w) };
}

const esUso = (id) => ES_CARGAS.usos.tipos.find((u) => u.id === id) || null;
const esForro = (id) => ES_CARGAS.forros.tipos.find((f) => f.id === id) || ES_CARGAS.forros.tipos[0];
// laje: permanente (peso próprio + revestimento do piso + forro) e variável
// (uso). usoPadrao: "residencial" se há pavimento em cima, "forro" se não.
// Lajes pré-fabricadas (NBR 14859): vigotas + enchimento + capa. O peso
// próprio sai da geometria da seção (por intereixo): concreto da capa e das
// nervuras a 25 kN/m³ e o enchimento pelo peso aparente. Padrão do escritório:
// forro = treliçada com EPS (8 + 4), piso = protendida com EPS (12 + 4).
const ES_LAJES_PRE = {
  enchimentos: {
    fonte: "pesos aparentes do enchimento: manual de lajes treliçadas (Belgo) — confirmar com o fornecedor", conferido: false,
    eps: { rotulo: "EPS (isopor)", gama: 0.2 },        // 12 a 25 kgf/m³
    ceramica: { rotulo: "Lajota cerâmica", gama: 6.0 }, // 600 kgf/m³
  },
  padrao: {
    trelicada: { ench: "eps", he: 0.08, capa: 0.04, intereixo: 0.42, bw: 0.12 },
    protendida: { ench: "eps", he: 0.12, capa: 0.04, intereixo: 0.42, bw: 0.12 },
  },
};
const ES_TIPOS_LAJE = {
  trelicada: "Treliçada (vigota treliçada + enchimento)",
  protendida: "Protendida (vigota protendida + enchimento)",
  macica: "Maciça de concreto armado",
  informada: "Outra: informar o peso próprio",
};
// geometria de laje pré-fabricada: peso próprio (kN/m²) e concreto (m³/m²)
// esp = espessura desenhada: sem enchimento informado, ele é o que sobra da capa
function esLajePre(tipo, c, esp) {
  const d = ES_LAJES_PRE.padrao[tipo] || ES_LAJES_PRE.padrao.trelicada;
  const ench = ES_LAJES_PRE.enchimentos[c.ench] ? c.ench : d.ench;
  const capa = c.capa != null ? +c.capa : d.capa;
  const he = c.he != null ? +c.he : (esp ? Math.max(0.05, Math.round((esp - capa) * 1000) / 1000) : d.he);
  const i = c.intereixo != null ? +c.intereixo : d.intereixo, bw = Math.min(i, c.bw != null ? +c.bw : d.bw);
  const concreto = capa + bw * he / i, vazio = (i - bw) * he / i;
  const pp = ES_CARGAS.pesos.concretoArmado * concreto + ES_LAJES_PRE.enchimentos[ench].gama * vazio;
  return { ench, he, capa, intereixo: i, bw, concreto, pp, hTotal: he + capa };
}
function esCargaLaje(a, usoPadrao) {
  const c = a.carga || {};
  const uso = esUso(c.uso) || esUso(usoPadrao) || esUso("residencial");
  // sem escolha: piso = protendida, forro/cobertura = treliçada
  const tipo = ES_TIPOS_LAJE[c.tipo] ? c.tipo : (uso.piso ? "protendida" : "trelicada");
  const esp = a.esp || 0.10;
  let pp, concreto, pre = null;
  if (tipo === "trelicada" || tipo === "protendida") { pre = esLajePre(tipo, c, a.esp); pp = pre.pp; concreto = pre.concreto; }
  else if (tipo === "informada") { pp = +c.pp || 0; concreto = esp; }
  else { pp = ES_CARGAS.pesos.concretoArmado * esp; concreto = esp; }
  const revPiso = uso.piso ? (c.revPiso != null ? +c.revPiso : 0.05) : 0;
  const rev = revPiso * ES_CARGAS.pesos.revestimentoPiso;
  const forro = esForro(c.forro || "reboco").g;
  const g = pp + rev + forro;
  return { tipo, tipoRotulo: ES_TIPOS_LAJE[tipo], pre, concreto, uso: uso.id, usoRotulo: uso.rotulo, piso: uso.piso, pp, revPiso, rev, forro: c.forro || "reboco", gForro: forro, g, q: uso.q, auto: !c.uso, tipoAuto: !ES_TIPOS_LAJE[c.tipo] };
}
// telhado: carga permanente por m² em planta. Telhado pronto da tabela quando
// a combinação existe; senão, telha (convertida para planta) + estrutura
// informada. pctMedio = inclinação média em %.
function esCargaTelhado(a, pctMedio) {
  const T = ES_CARGAS.telhas, tel = T.porTelha[a.telha] || null, estrutura = a.estrutura || "madeira";
  const pct = pctMedio || 0, cos = 1 / Math.sqrt(1 + (pct / 100) ** 2);
  if (tel) {
    const pronto = T.prontos.find((p) => p.grupo === tel.grupo && p.estrutura === estrutura && (p.pctMax == null || pct <= p.pctMax + 1e-9));
    if (pronto) return { g: pronto.g, modo: "pronto", estrutura, telhaG: tel.g, falta: null };
  }
  const telhaPlanta = tel ? tel.g / cos : (a.pesoTelha != null ? +a.pesoTelha / cos : null);
  const estr = a.pesoEstrutura != null && a.pesoEstrutura !== "" ? +a.pesoEstrutura : null;
  const falta = telhaPlanta == null ? "telha" : estr == null ? "estrutura" : null;
  return { g: (telhaPlanta || 0) + (estr || 0), modo: "somado", estrutura, telhaG: tel ? tel.g : (a.pesoTelha != null ? +a.pesoTelha : null), telhaPlanta, estr, falta };
}

// ═══════════════════════════════════════════════════════════════
// DESCIDA DE CARGAS (etapa 3a) — das lajes, paredes e telhado até a fundação
// ═══════════════════════════════════════════════════════════════
// Valores característicos, permanente (g) e variável (q) separados. Método de
// pré-dimensionamento (áreas de influência), como o engenheiro faz antes da
// análise em pórtico:
// - laje e telhado: cada pedaço da área vai para a viga mais próxima (no
//   retângulo, dá as charneiras a 45° entre apoios iguais); a carga fica
//   uniforme ao longo da viga;
// - parede: peso por m² × altura livre (até o fundo da viga de cima), em cima
//   da viga do pavimento de baixo (ou do baldrame) onde estiver; vãos de porta
//   e janela não são descontados (a favor da segurança);
// - viga: peso próprio 25 × b × h; trechos alinhados sem pilar entre eles são
//   um tramo só; reações de tramo bi-apoiado; ponta sem pilar vai para a viga
//   em que se apoia (carga concentrada);
// - pilar: reações das vigas + peso próprio + o pilar de cima; pilar sem pilar
//   embaixo (transição) entra como carga concentrada na viga de baixo.
// Telhado: só a carga permanente; a variável de cobertura (NBR 6120 item 6.4)
// ainda não entra (a conferir no texto oficial).
function esPontoNoSeg(q, a, b) {
  const L = esDist(a, b); if (!L) return { d: esDist(q, a), t: 0 };
  const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L, t = Math.max(0, Math.min(L, (q.x - a.x) * ux + (q.y - a.y) * uy));
  return { d: esDist(q, { x: a.x + ux * t, y: a.y + uy * t }), t };
}
function esDentroPoli(q, pts) { let d = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a.y > q.y) !== (b.y > q.y) && q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x) d = !d; } return d; }
// área de cada viga dentro do polígono (amostragem em malha de passo m)
function esAreasDeInfluencia(pts, vigas, passo = 0.1) {
  const r = new Array(vigas.length).fill(0); if (!vigas.length) return r;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  for (let x = x0 + passo / 2; x < x1; x += passo) for (let y = y0 + passo / 2; y < y1; y += passo) {
    const q = { x, y }; if (!esDentroPoli(q, pts)) continue;
    // empate (na charneira): divide igualmente
    let dm = Infinity, ms = []; vigas.forEach((v, i) => { const d = esPontoNoSeg(q, v.a, v.b).d; if (d < dm - 1e-9) { dm = d; ms = [i]; } else if (Math.abs(d - dm) <= 1e-9) ms.push(i); });
    for (const m of ms) r[m] += passo * passo / ms.length;
  }
  return r;
}
// tramos: trechos de viga alinhados e encadeados sem pilar entre eles
function esTramos(vigas, pilares) {
  const temPilar = (q) => pilares.find((p) => esDist(p.no || p, q) <= 0.3) || null;
  const ts = vigas.map((v) => ({ ids: [v.id], a: v.a, b: v.b, pecas: [v] }));
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (let i = 0; i < ts.length && !mudou; i++) for (let j = i + 1; j < ts.length && !mudou; j++) {
      const A = ts[i], B = ts[j];
      const LA = esDist(A.a, A.b), LB = esDist(B.a, B.b); if (!LA || !LB) continue;
      const ua = { x: (A.b.x - A.a.x) / LA, y: (A.b.y - A.a.y) / LA }, ub = { x: (B.b.x - B.a.x) / LB, y: (B.b.y - B.a.y) / LB };
      if (Math.abs(ua.x * ub.x + ua.y * ub.y) < 0.996) continue;
      for (const [pa, pb, na, nb] of [[A.b, B.a, A.a, B.b], [A.b, B.b, A.a, B.a], [A.a, B.a, A.b, B.b], [A.a, B.b, A.b, B.a]]) {
        if (esDist(pa, pb) > 0.05 || temPilar(pa)) continue;
        ts[i] = { ids: [...A.ids, ...B.ids], a: na, b: nb, pecas: [...A.pecas, ...B.pecas] }; ts.splice(j, 1); mudou = true; break;
      }
    }
  }
  return ts.map((t) => { const pA = temPilar(t.a), pB = temPilar(t.b); return { ...t, L: esDist(t.a, t.b), apoioA: pA ? pA.id : null, apoioB: pB ? pB.id : null }; });
}
// pavs: [{ paredes, areas, nivel, usoPadrao, nome }] de baixo para cima;
// lanc: resultado de esLancarPavimentos; params: os da estrutura.
// Devolve por pavimento: vigas { id: { g, q (kN/m), L, RA, RB } }, pilares
// { id: { Ng, Nq } (no pé do pilar, kN) }, e a lista da fundação.
function esDescidaCargas(pavs, lanc, params) {
  const P = { ...ES_PADRAO, ...(params || {}) }, gc = ES_CARGAS.pesos.concretoArmado;
  const res = pavs.map(() => ({ vigas: {}, tramos: [], pilares: {}, avisos: [] }));
  const nPav = pavs.length;
  for (let k = nPav - 1; k >= 0; k--) {
    const est = lanc[k], topo = esTopoPavimento(pavs, k);
    const vigas = (est.vigas || []).filter((v) => !v.baldrame), bald = (est.vigas || []).filter((v) => v.baldrame);
    const carga = new Map(); // id -> { g, q } total (kN) distribuído na peça
    const add = (id, g, q) => { const c = carga.get(id) || { g: 0, q: 0 }; c.g += g; c.q += q; carga.set(id, c); };
    // peso próprio das vigas e baldrames
    for (const v of [...vigas, ...bald]) add(v.id, gc * v.b_ * v.h * esDist(v.a, v.b), 0);
    // lajes deste pavimento (teto) nas vigas deste pavimento
    for (const a of pavs[k].areas || []) {
      if (!a.pts || a.pts.length < 3) continue;
      if (a.tipo === "laje") {
        const c = esCargaLaje(a, pavs[k].usoPadrao), inf = esAreasDeInfluencia(a.pts, vigas);
        inf.forEach((A, i) => { if (A) add(vigas[i].id, c.g * A, c.q * A); });
      } else if (a.tipo === "telhado") {
        const ls = (a.lados || []).filter((l) => l && l.inclina !== false && l.pct != null), pct = ls.length ? ls.reduce((t, l) => t + (+l.pct || 0), 0) / ls.length : 30;
        const c = esCargaTelhado(a, pct), inf = esAreasDeInfluencia(a.pts, vigas);
        if (c.falta) res[k].avisos.push(`Telhado sem ${c.falta === "telha" ? "peso da telha" : "peso da estrutura"}: a carga dele não entrou.`);
        inf.forEach((A, i) => { if (A) add(vigas[i].id, c.g * A, 0); });
      }
    }
    // paredes do pavimento de cima sobre as vigas deste; paredes deste sobre os baldrames (no 1º)
    const sobre = (paredesAcima, alvo, hLivre) => {
      for (const w of paredesAcima || []) {
        const L = esLen(w); if (L < 0.05) continue;
        const ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L, g = esCargaParede(w, 0).g;
        for (const v of alvo) {
          const Lv = esDist(v.a, v.b); if (!Lv) continue;
          const vx = (v.b.x - v.a.x) / Lv, vy = (v.b.y - v.a.y) / Lv;
          if (Math.abs(ux * vx + uy * vy) < 0.996) continue;
          if (Math.abs((v.a.x - w.a.x) * -uy + (v.a.y - w.a.y) * ux) > ((w.t || 0) + v.b_) / 2 + 0.02) continue;
          const sa = (v.a.x - w.a.x) * ux + (v.a.y - w.a.y) * uy, sb = (v.b.x - w.a.x) * ux + (v.b.y - w.a.y) * uy;
          const ov = Math.min(L, Math.max(sa, sb)) - Math.max(0, Math.min(sa, sb));
          if (ov > 0.01) add(v.id, g * hLivre * ov, 0);
        }
      }
    };
    if (k + 1 < nPav) sobre(pavs[k + 1].paredes, vigas, Math.max(0, esTopoPavimento(pavs, k + 1) - P.viga.h));
    if (k === 0) sobre(pavs[0].paredes, bald, Math.max(0, topo - P.viga.h));
    // tramos e reações
    for (const grupo of [vigas, bald]) {
      const ts = esTramos(grupo, est.pilares || []);
      const pontos = ts.map(() => []); // cargas concentradas { t, g, q }
      // pilar de cima sem pilar embaixo (transição) cai na viga deste pavimento
      if (grupo === vigas && k + 1 < nPav) for (const pc of lanc[k + 1].pilares || []) {
        if ((est.pilares || []).some((p) => esDist(p.no, pc.no) < 0.15)) continue;
        const N = res[k + 1].pilares[pc.id]; if (!N) continue;
        let melhor = -1, dm = 0.3; ts.forEach((t, i) => { const r = esPontoNoSeg(pc.no, t.a, t.b); if (r.d < dm) { dm = r.d; melhor = i; } });
        if (melhor >= 0) pontos[melhor].push({ t: esPontoNoSeg(pc.no, ts[melhor].a, ts[melhor].b).t, g: N.Ng, q: N.Nq, de: pc.id });
        else res[k].avisos.push(`${pc.id} (de cima) não encontrou viga embaixo para apoiar.`);
      }
      // iterações: ponta sem pilar descarrega na viga em que se apoia
      let R = ts.map(() => ({ A: { g: 0, q: 0 }, B: { g: 0, q: 0 } }));
      for (let it = 0; it < 8; it++) {
        const extra = ts.map(() => []);
        ts.forEach((t, i) => {
          for (const lado of ["A", "B"]) {
            if (t["apoio" + lado]) continue;
            const q = lado === "A" ? t.a : t.b;
            let melhor = -1, dm = 0.2; ts.forEach((o, j) => { if (j === i) return; const r = esPontoNoSeg(q, o.a, o.b); if (r.d < dm) { dm = r.d; melhor = j; } });
            if (melhor >= 0) extra[melhor].push({ t: esPontoNoSeg(q, ts[melhor].a, ts[melhor].b).t, g: R[i][lado].g, q: R[i][lado].q });
          }
        });
        R = ts.map((t, i) => {
          const w = t.pecas.reduce((s, v) => { const c = carga.get(v.id) || { g: 0, q: 0 }; return { g: s.g + c.g, q: s.q + c.q }; }, { g: 0, q: 0 });
          const L = t.L || 1, rA = { g: w.g / 2, q: w.q / 2 }, rB = { g: w.g / 2, q: w.q / 2 };
          for (const pnt of [...pontos[i], ...extra[i]]) { const f = Math.min(1, Math.max(0, pnt.t / L)); rA.g += pnt.g * (1 - f); rA.q += pnt.q * (1 - f); rB.g += pnt.g * f; rB.q += pnt.q * f; }
          return { A: rA, B: rB };
        });
      }
      ts.forEach((t, i) => {
        const w = t.pecas.reduce((s, v) => { const c = carga.get(v.id) || { g: 0, q: 0 }; return { g: s.g + c.g, q: s.q + c.q }; }, { g: 0, q: 0 });
        res[k].tramos.push({ ids: t.ids, L: t.L, apoioA: t.apoioA, apoioB: t.apoioB, g: w.g / (t.L || 1), q: w.q / (t.L || 1), RA: R[i].A, RB: R[i].B, pontos: pontos[i], baldrame: grupo === bald });
        for (const id of t.ids) res[k].vigas[id] = { tramo: t.ids.join("+"), L: t.L, g: w.g / (t.L || 1), q: w.q / (t.L || 1), RA: R[i].A, RB: R[i].B, apoioA: t.apoioA, apoioB: t.apoioB };
        if (!t.apoioA && !ts.some((o, j) => j !== i && esPontoNoSeg(t.a, o.a, o.b).d < 0.2)) res[k].avisos.push(`${t.ids.join("+")}: ponta sem apoio (nem pilar nem viga).`);
        if (!t.apoioB && !ts.some((o, j) => j !== i && esPontoNoSeg(t.b, o.a, o.b).d < 0.2)) res[k].avisos.push(`${t.ids.join("+")}: ponta sem apoio (nem pilar nem viga).`);
      });
    }
    // pilares: reações + peso próprio + pilar de cima
    for (const p of est.pilares || []) {
      let Ng = gc * p.b * p.h * ((p.topo != null ? p.topo : topo) - (p.base || 0)), Nq = 0;
      for (const t of res[k].tramos) { if (t.apoioA === p.id) { Ng += t.RA.g; Nq += t.RA.q; } if (t.apoioB === p.id) { Ng += t.RB.g; Nq += t.RB.q; } }
      if (k + 1 < nPav) { const pc = (lanc[k + 1].pilares || []).find((q) => esDist(q.no, p.no) < 0.15); if (pc && res[k + 1].pilares[pc.id]) { Ng += res[k + 1].pilares[pc.id].Ng; Nq += res[k + 1].pilares[pc.id].Nq; } }
      res[k].pilares[p.id] = { Ng, Nq };
    }
  }
  const fundacao = Object.entries(res[0] ? res[0].pilares : {}).map(([id, n]) => ({ id, Ng: n.Ng, Nq: n.Nq, Nk: n.Ng + n.Nq }));
  return { pavimentos: res, fundacao };
}
