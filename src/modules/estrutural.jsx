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
  vaoGrande: 2.5,           // m: porta/janela a partir disso leva pilar nas duas ombreiras
  cinta: 0.20,              // m: altura da cinta onde não há laje nem parede em cima
  // fundação: estacas escavadas (brocas) com bloco, ou sapatas. padm (kN por
  // estaca) e sigma (kPa) vêm da sondagem (NBR 6122); vazios = estimativa
  fundacao: { tipo: "estaca", diam: 0.25, prof: 4, padm: null, sigma: null },
  // vento (NBR 6123): V0 do mapa de isopletas do município, terreno plano
  // (S1 = 1), categoria de rugosidade (IV: subúrbio com casas), residência
  // (S3 = 1) e coeficiente de arrasto Ca (Fig. 4, edificação baixa)
  vento: { V0: 45, S1: 1.0, categoria: 4, S3: 1.0, Ca: 1.2 },
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
  // 2a) vão grande de porta/janela (≥ ES_PADRAO.vaoGrande): pilar nas duas
  // ombreiras — a viga vence o vão livre entre eles (critério 13)
  for (const w of ws) {
    const L = esLen(w), ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L, iw = ws.indexOf(w), meio = secao([{ i: iw }]).h / 2;
    for (const o of w.ab || []) {
      if (!(+o.larg >= P.vaoGrande - 1e-9)) continue;
      for (const c of [o.x - o.larg / 2 - meio - 0.02, o.x + o.larg / 2 + meio + 0.02]) {
        if (c < 0.15 || c > L - 0.15) continue; // ombreira na ponta: o pilar do canto já serve
        const q = { x: w.a.x + ux * c, y: w.a.y + uy * c };
        if (pilares.some((pp) => esDist(pp.no, q) < 0.5)) continue;
        juntar(q, Math.atan2(uy, ux), [{ x: ux, y: uy, i: iw }, { x: -ux, y: -uy, i: iw }], "vao");
      }
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
  // 2b) alterações à mão (lançadas pelo usuário, reaplicadas por posição).
  // Os nomes saem do lançamento automático ANTES das alterações: apagar ou
  // inserir um pilar não renumera os outros (pilar novo: próximo número;
  // viga dividida por pilar novo: V3a, V3b — como nos programas de cálculo)
  pilares.forEach((p, k) => { p.id = "P" + (k + 1); });
  const autoNos = pilares.map((p) => ({ x: p.no.x, y: p.no.y }));
  const orfas = esAplicarEdicoesPilares(pilares, ws, opts.edicoes || [], secao);
  { let n = autoNos.length; for (const p of pilares) if (!p.id) p.id = "P" + (++n); }
  // 3) encaixe de cada pilar na parede e fora de portas e janelas
  const interno = esLadoInternoFn(ws, areas);
  for (const p of pilares) { if (!p.manual) esEncaixarPilar(p, ws, interno); delete p._dirs; }
  // altura do pilar neste pavimento: do piso (ou do fundo do baldrame, no
  // primeiro) até o topo da estrutura (piso de cima) — o pilar é contínuo
  const topoPil = opts.topo != null ? opts.topo : Math.max(0, ...ws.map((w) => w.h || 0)) || 2.8;
  const basePil = opts.baldrames && P.baldrames ? -P.baldrame.h : 0;
  for (const p of pilares) { p.base = esR3(basePil); p.topo = esR3(topoPil); }
  // 3) vigas: cada parede dividida nos pilares que estão sobre ela
  const vigas = [], baldrames = [];
  let nViga = 0;
  for (const w of ws) {
    const L = esLen(w), ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L;
    const sobre = naParede(w);
    // trechos do lançamento automático (numeração estável)
    const sA = autoNos.map((q) => ({ s: (q.x - w.a.x) * ux + (q.y - w.a.y) * uy, d: Math.abs((q.x - w.a.x) * -uy + (q.y - w.a.y) * ux) })).filter((q) => q.d <= Math.max(0.1, (w.t || 0) / 2 + 0.02) && q.s > 0.05 && q.s < L - 0.05).map((q) => q.s).sort((a, b) => a - b);
    const mA = [0, ...sA, L], segA = []; for (let k = 0; k < mA.length - 1; k++) if (mA[k + 1] - mA[k] >= 0.05) segA.push({ s0: mA[k], s1: mA[k + 1], n: ++nViga });
    const numDe = (sm) => (segA.find((g) => sm >= g.s0 - 1e-6 && sm <= g.s1 + 1e-6) || segA[segA.length - 1] || { n: ++nViga }).n;
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
      const num = numDe((s0 + s1) / 2);
      vigas.push({ ...trecho, b_: vg.b, h: vg.h, topo: opts.topo != null ? opts.topo : (w.h || 2.8), _num: num });
      if (opts.baldrames && P.baldrames) baldrames.push({ ...trecho, b_: P.baldrame.b, h: P.baldrame.h, topo: 0, baldrame: true, _num: num });
    }
  }
  for (const [lista, pre] of [[vigas, "V"], [baldrames, "VB"]]) {
    const cont = new Map(); for (const v of lista) cont.set(v._num, (cont.get(v._num) || 0) + 1);
    const usado = new Map(); for (const v of lista) { const c = cont.get(v._num), i = usado.get(v._num) || 0; usado.set(v._num, i + 1); v.id = pre + v._num + (c > 1 ? "abcdefghij"[i] || String(i + 1) : ""); delete v._num; }
  }
  // 4) lajes: as que o arquiteto desenhou neste pavimento
  const lajes = (areas || []).map((a, i) => ({ a, i })).filter(({ a }) => a.tipo === "laje" && a.pts && a.pts.length >= 3)
    .map(({ a, i }, k) => { const c = esCargaLaje(a, opts.usoPadrao); return { id: "L" + (k + 1), area: i, pts: a.pts, esp: c.pre ? c.pre.hTotal : (a.esp || P.lajeEsp), uso: c.piso ? "piso" : "cobertura", tipo: c.tipo, concretoM2: c.concreto, capa: c.pre ? c.pre.capa : null }; });
  return { pilares, vigas: [...vigas, ...baldrames], lajes, edicoesOrfas: orfas };
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
// ═══════════════════════════════════════════════════════════════
// ALTERAÇÕES À MÃO (como nos programas de cálculo): o lançamento automático
// roda sempre e as alterações do usuário são reaplicadas por POSIÇÃO — se a
// arquitetura mudar, continuam valendo onde o elemento ainda existe; a que
// não acha mais o elemento vira aviso. Por pavimento, em ordem:
//   { tipo: "pilar+", x, y, b, h, ang }        pilar novo (na parede: no eixo dela)
//   { tipo: "pilar-", x, y }                   apaga o pilar nesse ponto (o nó)
//   { tipo: "pilar~", x, y, nx, ny }           move
//   { tipo: "pilarSec", x, y, b, h, ang }      seção / giro
//   { tipo: "viga+", a, b, b_, h }             viga nova
//   { tipo: "viga-", m, ang }                  apaga a viga que passa em m
//   { tipo: "vigaSec", m, ang, b_, h }         seção fixa (o cálculo não muda)
// ═══════════════════════════════════════════════════════════════
const ES_TOL_EDICAO = { pilar: 0.4, viga: 0.12 };
function esNoNaParede(q, ws) {
  let melhor = null;
  for (const w of ws) {
    const L = esLen(w); if (!L) continue; const ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L;
    const s = (q.x - w.a.x) * ux + (q.y - w.a.y) * uy, d = Math.abs((q.x - w.a.x) * -uy + (q.y - w.a.y) * ux);
    if (s < -0.05 || s > L + 0.05 || d > (w.t || 0.14) / 2 + 0.06) continue;
    if (!melhor || d < melhor.d) melhor = { d, q: { x: esR3(w.a.x + ux * Math.min(L, Math.max(0, s))), y: esR3(w.a.y + uy * Math.min(L, Math.max(0, s))) }, ang: Math.atan2(uy, ux), t: w.t };
  }
  return melhor;
}
function esAplicarEdicoesPilares(pilares, ws, eds, secao) {
  const orfas = [];
  const achar = (q) => { let m = null, dm = ES_TOL_EDICAO.pilar; for (const p of pilares) { const d = Math.min(esDist(p.no, q), esDist(p, q)); if (d < dm) { dm = d; m = p; } } return m; };
  // na parede: no eixo dela e alinhado com ela (mover para outra parede gira junto)
  const colocar = (p, q) => { const nw = esNoNaParede(q, ws); p.no = nw ? nw.q : { x: esR3(q.x), y: esR3(q.y) }; p.x = p.no.x; p.y = p.no.y; if (nw) p.ang = esR3(nw.ang); };
  eds.forEach((e, i) => {
    if (e.tipo === "pilar+") {
      const sc = secao([]), p = { b: e.b || sc.b, h: e.h || sc.h, ang: null, origem: "manual", manual: "novo", edicao: i };
      colocar(p, e); if (e.ang != null) p.ang = e.ang; if (p.ang == null) p.ang = 0; pilares.push(p);
    } else if (e.tipo === "pilar-" || e.tipo === "pilar~" || e.tipo === "pilarSec") {
      const p = achar(e); if (!p) { orfas.push({ ...e, i }); return; }
      if (e.tipo === "pilar-") { pilares.splice(pilares.indexOf(p), 1); return; }
      if (e.tipo === "pilar~") { colocar(p, { x: e.nx, y: e.ny }); p.manual = p.manual || "movido"; p.edicao = i; return; }
      if (e.b) p.b = e.b; if (e.h) p.h = e.h; if (e.ang != null) p.ang = e.ang; p.secManual = true; p.edicaoSec = i;
    }
  });
  return orfas;
}
// vigas: antes das vigas automáticas de escada/balanço (fase 1: o que já
// existe e as novas) e depois delas (fase 2: o que sobrou, p. ex. VE)
function esAplicarEdicoesVigas(est, eds, P, topo, fase, feitas) {
  const acharViga = (e) => {
    let m = null, dm = ES_TOL_EDICAO.viga;
    for (const v of est.vigas) {
      if (!!v.baldrame !== !!e.baldrame) continue; const L = esDist(v.a, v.b); if (!L) continue;
      if (e.ang != null && Math.abs(Math.cos(Math.atan2(v.b.y - v.a.y, v.b.x - v.a.x) - e.ang)) < 0.985) continue;
      const d = esPontoNoSeg(e.m, v.a, v.b).d; if (d < dm) { dm = d; m = v; }
    }
    return m;
  };
  eds.forEach((e, i) => {
    if (feitas.has(i)) return;
    if (e.tipo === "viga+") {
      if (fase !== 1) return;
      const pil = (q) => { const p = est.pilares.find((pp) => esDist(pp.no, q) <= 0.3); return p ? p.id : null; };
      const n = est.vigas.filter((v) => /^V\d/.test(v.id)).reduce((mx, v) => Math.max(mx, parseInt(v.id.slice(1), 10) || 0), 0) + 1, L = esDist(e.a, e.b); if (L < 0.2) return;
      est.vigas.push({ id: "V" + n, a: { x: esR3(e.a.x), y: esR3(e.a.y) }, b: { x: esR3(e.b.x), y: esR3(e.b.y) }, apoioA: pil(e.a), apoioB: pil(e.b), parede: null, s0: 0, s1: esR3(L), b_: e.b_ || P.viga.b, h: e.h || P.viga.h, topo, manual: "novo", hFixo: !!e.h, edicao: i });
      feitas.add(i);
    } else if (e.tipo === "viga-" || e.tipo === "vigaSec") {
      const v = acharViga(e); if (!v) return;
      if (e.tipo === "viga-") est.vigas.splice(est.vigas.indexOf(v), 1);
      else { if (e.b_) v.b_ = e.b_; if (e.h) { v.h = e.h; v.hFixo = true; } v.secManual = true; v.edicaoSec = i; }
      feitas.add(i);
    }
  });
}
function esLancarPavimentos(pavs, params) {
  const passada = (acimaDe) => {
    const r = [];
    pavs.forEach((p, k) => r.push(esLancar(p.paredes || [], p.areas || [], params, { edicoes: p.edicoes || [], baldrames: k === 0, usoPadrao: p.usoPadrao, topo: esTopoPavimento(pavs, k),
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
  // vigas de borda do furo da escada (critério 11): cada lado do furo que não
  // cai sobre viga vira viga, esticada até as vigas que encontrar
  const feitas = pavs.map(() => new Set());
  pavs.forEach((p, k) => esAplicarEdicoesVigas(r[k], p.edicoes || [], P, esTopoPavimento(pavs, k), 1, feitas[k]));
  pavs.forEach((p, k) => esVigasDeEscada(p, r[k], P, esTopoPavimento(pavs, k), k));
  pavs.forEach((p, k) => esBalancosSoltos(p, r[k], P, k));
  pavs.forEach((p, k) => {
    esAplicarEdicoesVigas(r[k], p.edicoes || [], P, esTopoPavimento(pavs, k), 2, feitas[k]);
    // alteração que não achou mais o elemento (a arquitetura mudou)
    const orf = [...(r[k].edicoesOrfas || []), ...(p.edicoes || []).map((e, i) => ({ ...e, i })).filter((e) => /^viga[-S]/.test(e.tipo) && !feitas[k].has(e.i))];
    r[k].edicoesOrfas = orf;
    for (const e of orf) (r[k].resolvidos = r[k].resolvidos || []).push({ k, id: null, tipo: "pendente", edicao: e.i, texto: `Alteração à mão sem o elemento (${{ "pilar-": "pilar apagado", "pilar~": "pilar movido", pilarSec: "seção de pilar", "viga-": "viga apagada", vigaSec: "seção de viga" }[e.tipo] || e.tipo}): a arquitetura mudou ali — confira ou desfaça a alteração.` });
  });
  return r;
}
// furo da escada: o contorno (caracol: o quadrado que o envolve)
function esFuroEscada(e) {
  if (e.forma !== "caracol") return e.contorno;
  const xs = e.contorno.map((q) => q.x), ys = e.contorno.map((q) => q.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
}
function esVigasDeEscada(p, est, P, topo, k) {
  const lajes = (p.areas || []).filter((a) => a.tipo === "laje" && a.pts && a.pts.length >= 3);
  let n = est.vigas.filter((v) => v.vigaEscada).length;
  for (const e of p.escadas || []) {
    const furo = esFuroEscada(e); if (!furo || furo.length < 3) continue;
    const c = { x: furo.reduce((t, q) => t + q.x, 0) / furo.length, y: furo.reduce((t, q) => t + q.y, 0) / furo.length };
    if (!lajes.some((a) => esDentroPoli(c, a.pts))) continue; // sem laje em cima: não há furo
    const off = P.viga.b / 2 + 0.005, dentro = (q) => esDentroPoli(q, furo);
    // primeiro ponto em que o raio (de q, na direção d) entra no furo
    const entraFuro = (q, d, ate) => {
      let best = null;
      for (let i = 0; i < furo.length; i++) {
        const A = furo[i], B = furo[(i + 1) % furo.length], ex = B.x - A.x, ey = B.y - A.y, den = d.x * ey - d.y * ex; if (Math.abs(den) < 1e-9) continue;
        const wx = A.x - q.x, wy = A.y - q.y, t = (wx * ey - wy * ex) / den, sg = (wx * d.y - wy * d.x) / den;
        if (t > 1e-4 && t < ate && sg >= -1e-6 && sg <= 1 + 1e-6 && dentro({ x: q.x + d.x * (t + 0.02), y: q.y + d.y * (t + 0.02) }) && (best == null || t < best)) best = t;
      }
      return best;
    };
    // lados curtos primeiro (cabeceiras, esticadas até as vigas); os compridos
    // apoiam nas cabeceiras — como o engenheiro arma o furo
    const lados = furo.map((A, i) => [A, furo[(i + 1) % furo.length]]).filter(([A, B]) => esDist(A, B) >= 0.3).sort((x, y) => esDist(x[0], x[1]) - esDist(y[0], y[1]));
    const novas = [];
    for (const [A0, B0] of lados) {
      // a viga fica do lado de FORA do furo, com a face no limite da escada —
      // centrada na borda, metade dela ficaria em cima dos degraus (altura livre)
      const L = esDist(A0, B0), u = { x: (B0.x - A0.x) / L, y: (B0.y - A0.y) / L }, m0 = { x: (A0.x + B0.x) / 2, y: (A0.y + B0.y) / 2 };
      let nn = { x: -u.y, y: u.x }; if (dentro({ x: m0.x + nn.x * 0.05, y: m0.y + nn.y * 0.05 })) nn = { x: -nn.x, y: -nn.y };
      const A = { x: A0.x + nn.x * off, y: A0.y + nn.y * off }, B = { x: B0.x + nn.x * off, y: B0.y + nn.y * off };
      const vigas = est.vigas.filter((v) => !v.baldrame), m = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
      if (vigas.some((v) => esPontoNoSeg(m, v.a, v.b).d < 0.15 || esPontoNoSeg(m0, v.a, v.b).d < 0.15)) continue; // já tem viga (ou parede) ali
      const emViga = (q) => vigas.some((v) => esPontoNoSeg(q, v.a, v.b).d < 0.05);
      // estica até a viga mais perto, mas nunca por cima da escada: parando
      // na borda do furo (canto interno de escada em L/U), a ponta fica no
      // alinhamento da outra viga de borda
      const esticar = (Q, d) => {
        if (emViga(Q)) return { q: Q, apoiada: true };
        const r = esRaioViga(Q, d, vigas), ate = r && r.d < 6 ? r.d : 6, tf = dentro({ x: Q.x + d.x * 0.02, y: Q.y + d.y * 0.02 }) ? 0 : entraFuro(Q, d, ate);
        if (tf != null) return { q: { x: Q.x + d.x * (tf - off), y: Q.y + d.y * (tf - off) }, apoiada: false, canto: true };
        return r && r.d < 6 ? { q: { x: Q.x + d.x * r.d, y: Q.y + d.y * r.d }, apoiada: true } : { q: Q, apoiada: false };
      };
      const ea = esticar(A, { x: -u.x, y: -u.y }), eb = esticar(B, u);
      const apoio = (q) => { const pl = est.pilares.find((pp) => esDist(pp.no, q) <= 0.3); return pl ? pl.id : null; };
      const v = { id: "VE" + (++n), a: { x: esR3(ea.q.x), y: esR3(ea.q.y) }, b: { x: esR3(eb.q.x), y: esR3(eb.q.y) }, apoioA: apoio(ea.q), apoioB: apoio(eb.q), parede: null, s0: 0, s1: esR3(esDist(ea.q, eb.q)), b_: P.viga.b, h: P.viga.h, topo, vigaEscada: true, _soltaA: !ea.apoiada, _soltaB: !eb.apoiada, _nn: nn };
      est.vigas.push(v); novas.push(v);
    }
    // ponta sem apoio de verdade (canto interno do furo, ou viga de borda que
    // só encontra a ponta de outra viga de borda): pilar no canto, fora da
    // escada — o "pilar do patamar", como o engenheiro resolve escada em L/U
    for (const v of novas) for (const lado of ["a", "b"]) {
      const q = v[lado], Ap = "apoio" + (lado === "a" ? "A" : "B");
      if (v[Ap] || v.balanco === lado || (v._pontaNaViga || {})[lado]) continue;
      const outras = est.vigas.filter((o) => o !== v && !o.baldrame && esPontoNoSeg(q, o.a, o.b).d < 0.06);
      const soPonta = outras.length > 0 && outras.every((o) => o.vigaEscada && (esDist(o.a, q) < 0.12 || esDist(o.b, q) < 0.12));
      if (outras.length && !soPonta) continue; // apoia no meio de outra viga: ok
      const pb = 0.19, lado2 = outras.find((o) => o.vigaEscada && o._nn) || null;
      // centro do pilar: fora do furo nas duas direções (face no limite da escada)
      let cx = q.x + v._nn.x * (pb / 2 + 0.005 - off), cy = q.y + v._nn.y * (pb / 2 + 0.005 - off);
      if (lado2) { cx += lado2._nn.x * (pb / 2 + 0.005 - off); cy += lado2._nn.y * (pb / 2 + 0.005 - off); }
      let pl = est.pilares.find((pp) => esDist(pp.no, { x: cx, y: cy }) <= 0.3);
      // escada sem parede nas laterais: o pilar ficaria solto no meio do
      // ambiente. A regra é a viga em balanço (uma das vigas de borda passa
      // do apoio e segura o canto); pilar só se nenhuma der
      if (!pl && !esPontoEmParede({ x: cx, y: cy }, p.paredes)) {
        const grupo = [{ v, lado }, ...outras.filter((o) => esDist(o.a, q) < 0.12 || esDist(o.b, q) < 0.12).map((o) => ({ v: o, lado: esDist(o.a, q) < 0.12 ? "a" : "b" }))];
        if (esTentarBalanco(grupo, est, P, k, [furo], "o canto da escada")) continue;
        (est.resolvidos = est.resolvidos || []).push({ k, id: v.id, tipo: "pendente", texto: `Canto da escada sem parede e sem viga que possa ir em balanço: ficou um pilar aparente no canto — confira com o engenheiro.` });
      }
      if (!pl) {
        const base = k === 0 && P.baldrames ? -P.baldrame.h : 0;
        pl = { x: esR3(cx), y: esR3(cy), b: pb, h: pb, ang: esR3(Math.atan2(v.b.y - v.a.y, v.b.x - v.a.x)), no: { x: esR3(cx), y: esR3(cy) }, origem: "escada", id: "P" + (est.pilares.length + 1), base: esR3(base), topo: esR3(topo), escada: true };
        est.pilares.push(pl);
      }
      v[Ap] = pl.id; // a ponta fica no alinhamento da viga (dentro do pilar)
      for (const o of outras) for (const lo of ["a", "b"]) if (esDist(o[lo], q) < 0.15) o["apoio" + (lo === "a" ? "A" : "B")] = pl.id;
    }
    for (const v of novas) { v.semApoio = !v.apoioA && !est.vigas.some((o) => o !== v && !o.baldrame && esPontoNoSeg(v.a, o.a, o.b).d < 0.06) || !v.apoioB && !est.vigas.some((o) => o !== v && !o.baldrame && esPontoNoSeg(v.b, o.a, o.b).d < 0.06); if (v.balanco) v.semApoio = false; delete v._soltaA; delete v._soltaB; delete v._nn; delete v._pontaNaViga; }
  }
}

// ponto dentro de alguma parede (o pilar fica escondido nela)
function esPontoEmParede(q, paredes) {
  return (paredes || []).some((w) => { const r = esPontoNoSeg(q, w.a, w.b); return r.d <= (w.t || 0.14) / 2 + 0.03 && r.t >= -0.05 && r.t <= esLen(w) + 0.05; });
}
// VIGA EM BALANÇO (regra para ponta de viga sem apoio onde um pilar ficaria
// fora das paredes): uma das vigas do grupo (as que terminam juntas no ponto
// solto) passa a ser balanço — a ponta fica livre e a outra ponta tem de ser
// apoio com continuidade: a viga segue além dele (tramo de equilíbrio) até a
// próxima viga, contrabalançando o momento. As outras do grupo apoiam na ponta
// do balanço. Escolhe a de menor balanço com tramo de equilíbrio ≥ balanço
// (sem arrancamento na outra ponta). grupo: [{ v, lado }]; furos: onde a
// viga não pode passar. Devolve true se resolveu.
const ES_BALANCO_VIGA = { max: 3.0, maxTramo: 6.0 };
function esTentarBalanco(grupo, est, P, k, furos, onde) {
  const vigas = est.vigas.filter((v) => !v.baldrame), pilarEm = (q) => est.pilares.find((pp) => esDist(pp.no, q) <= 0.3) || null;
  const dentroFuro = (q) => (furos || []).some((f) => f && esDentroPoli(q, f));
  let melhor = null;
  for (const { v: X, lado } of grupo) {
    const Q = X[lado], oL = lado === "a" ? "b" : "a", S = X[oL], Lc = esDist(Q, S); if (Lc < 0.2 || Lc > ES_BALANCO_VIGA.max) continue;
    const d = { x: (S.x - Q.x) / Lc, y: (S.y - Q.y) / Lc };
    // apoio na raiz: pilar, ou o meio de outra viga (não só a ponta dela)
    const pl = pilarEm(S), Bs = pl ? null : vigas.find((o) => o !== X && esPontoNoSeg(S, o.a, o.b).d < 0.06 && esDist(o.a, S) > 0.12 && esDist(o.b, S) > 0.12);
    if (!pl && !Bs) continue;
    // tramo de equilíbrio: viga já existente na mesma linha, ou nova até a próxima viga
    const ja = vigas.find((o) => o !== X && (esDist(o.a, S) < 0.05 || esDist(o.b, S) < 0.05) && (() => { const far = esDist(o.a, S) < 0.05 ? o.b : o.a, Lo = esDist(far, S); return Lo > 0.2 && ((far.x - S.x) * d.x + (far.y - S.y) * d.y) / Lo > 0.996; })());
    let Lb, F = null;
    if (ja) Lb = esDist(ja.a, ja.b);
    else {
      const r = esRaioViga({ x: S.x + d.x * 0.03, y: S.y + d.y * 0.03 }, d, vigas.filter((o) => o !== X && o !== Bs)); if (!r || r.d + 0.03 > ES_BALANCO_VIGA.maxTramo) continue;
      Lb = r.d + 0.03; F = { x: S.x + d.x * Lb, y: S.y + d.y * Lb };
      let cruza = false; for (let i = 1; i < 20; i++) if (dentroFuro({ x: S.x + d.x * Lb * i / 20, y: S.y + d.y * Lb * i / 20 })) cruza = true;
      if (cruza) continue;
    }
    if (Lb < 0.3) continue;
    // custo: balanço (pesa o dobro) + viga nova; arrancamento se o tramo de equilíbrio é curto
    const custo = 2 * Lc + (ja ? 0 : 0.5 * Lb) + (Lb < Lc ? 3 : 0) + (pl ? -0.2 : 0);
    if (!melhor || custo < melhor.custo) melhor = { X, lado, oL, S, Lc, Lb, F, ja, pl, Bs, custo };
  }
  if (!melhor) return false;
  const { X, lado, oL, S, Lc, Lb, F, ja, pl, Bs } = melhor, OL = oL === "a" ? "A" : "B";
  X.balanco = lado; X["apoio" + (lado === "a" ? "A" : "B")] = null;
  if (!pl) X["no" + OL] = Bs.id; else X["apoio" + OL] = pl.id;
  let nova = null;
  if (ja) { const lj = esDist(ja.a, S) < 0.05 ? "A" : "B"; if (!pl) ja["no" + lj] = Bs.id; ja.equilibrio = X.id; }
  else {
    // é a mesma viga contínua (balanço + tramo de equilíbrio): mesmo nome, tramo 2
    const pF = pilarEm(F);
    nova = { id: X.id + "-2", a: { x: esR3(S.x), y: esR3(S.y) }, b: { x: esR3(F.x), y: esR3(F.y) }, apoioA: pl ? pl.id : null, apoioB: pF ? pF.id : null, noA: pl ? null : Bs.id, parede: null, s0: 0, s1: esR3(Lb), b_: X.b_, h: X.h, topo: X.topo, vigaEscada: !!X.vigaEscada, equilibrio: X.id };
    est.vigas.push(nova);
  }
  for (const g of grupo) if (g.v !== X) { g.v["apoio" + (g.lado === "a" ? "A" : "B")] = null; (g.v._pontaNaViga = g.v._pontaNaViga || {})[g.lado] = true; g.v.naPontaDe = X.id; g.v.naPontaLado = g.lado; }
  const f2 = (x) => String(Math.round(x * 100) / 100).replace(".", ",");
  (est.resolvidos = est.resolvidos || []).push({ k, id: X.id, tipo: "balanco", texto: `${X.id} em balanço de ${f2(Lc)} m segura ${onde} sem pilar (o pilar ficaria fora das paredes)${grupo.length > 1 ? `; ${grupo.filter((g) => g.v !== X).map((g) => g.v.id).join(", ")} apoia na ponta dele` : ""}. ${ja ? `Continua na ${ja.id}` : `Continua ${f2(Lb)} m além do apoio (tramo ${nova.id}, mesma viga contínua)`} para equilibrar.` });
  return true;
}
// mesma regra para qualquer viga com ponta solta (sem pilar e sem viga
// embaixo), fora da escada — sacada, canto de varanda, viga que chega no vazio
function esBalancosSoltos(p, est, P, k) {
  const vigas = est.vigas.filter((v) => !v.baldrame), furos = (p.escadas || []).map(esFuroEscada);
  const solta = (v, q) => !est.pilares.some((pp) => esDist(pp.no, q) <= 0.3) && !vigas.some((o) => o !== v && esPontoNoSeg(q, o.a, o.b).d < 0.06 && esDist(o.a, q) > 0.12 && esDist(o.b, q) > 0.12) && !vigas.some((o) => o !== v && o.balanco && esDist(o[o.balanco], q) < 0.12);
  const feitos = new Set();
  for (const v of vigas) for (const lado of ["a", "b"]) {
    if (v.balanco || feitos.has(v.id + lado) || (v._pontaNaViga || {})[lado] || v.naPontaLado === lado) continue;
    const q = v[lado]; if (!solta(v, q)) continue;
    const grupo = [{ v, lado }, ...vigas.filter((o) => o !== v && !o.balanco && (esDist(o.a, q) < 0.12 || esDist(o.b, q) < 0.12)).map((o) => ({ v: o, lado: esDist(o.a, q) < 0.12 ? "a" : "b" }))];
    for (const g of grupo) feitos.add(g.v.id + g.lado);
    if (grupo.some((g) => !solta(g.v, g.v[g.lado]))) continue;
    esTentarBalanco(grupo, est, P, k, furos, "a ponta");
  }
  for (const v of est.vigas) delete v._pontaNaViga;
}

// ALTURA LIVRE SOBRE A ESCADA: nenhuma viga pode passar em cima dos degraus
// com menos que o mínimo de altura livre (2,10 m, valor usual de código de
// obras e da NBR 9077 — a conferir na legislação do município).
// escadas: [{ degraus: [{ pts, z }] }] do pavimento; est: o lançamento dele.
const ES_ALTURA_LIVRE_ESCADA = 2.10;
function esSegCruza(p1, p2, q1, q2) {
  const d = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return d(p1, p2, q1) * d(p1, p2, q2) < 0 && d(q1, q2, p1) * d(q1, q2, p2) < 0;
}
function esPoligonosTocam(A, B) {
  if (A.some((q) => esDentroPoli(q, B)) || B.some((q) => esDentroPoli(q, A))) return true;
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) if (esSegCruza(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length])) return true;
  return false;
}
function esAlturaLivreEscada(est, escadas, minimo = ES_ALTURA_LIVRE_ESCADA) {
  const r = [];
  // viga em cima de parede fica dentro da parede: ninguém passa embaixo dela
  for (const e of escadas || []) for (const v of (est.vigas || []).filter((x) => !x.baldrame && x.parede == null)) {
    const L = esDist(v.a, v.b); if (L < 0.05) continue;
    const nx = -(v.b.y - v.a.y) / L * v.b_ / 2, ny = (v.b.x - v.a.x) / L * v.b_ / 2;
    const ret = [{ x: v.a.x + nx, y: v.a.y + ny }, { x: v.b.x + nx, y: v.b.y + ny }, { x: v.b.x - nx, y: v.b.y - ny }, { x: v.a.x - nx, y: v.a.y - ny }];
    const fundo = (v.topo || 2.8) - v.h;
    let pior = null;
    for (const d of e.degraus || []) {
      if (!d.pts || d.pts.length < 3) continue;
      const cc = d.pts.reduce((t, q) => ({ x: t.x + q.x / d.pts.length, y: t.y + q.y / d.pts.length }), { x: 0, y: 0 });
      const enc = d.pts.map((q) => { const dd = esDist(q, cc) || 1, f = Math.max(0, dd - 0.02) / dd; return { x: cc.x + (q.x - cc.x) * f, y: cc.y + (q.y - cc.y) * f }; }); // encostar não conta
      if (!esPoligonosTocam(ret, enc)) continue; const livre = fundo - d.z; if (!pior || livre < pior.livre) pior = { livre, d }; }
    if (pior && pior.livre < minimo - 1e-6) {
      const c = pior.d.pts.reduce((t, q) => ({ x: t.x + q.x / pior.d.pts.length, y: t.y + q.y / pior.d.pts.length }), { x: 0, y: 0 });
      r.push({ viga: v.id, livre: pior.livre, ponto: c });
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
    if (v.vigaPiso && !v.invertida) add("atencao", v.id, `${v.id}: viga de piso sob parede${v.sobPavimento ? ` do ${v.sobPavimento}` : " de cima"} que não tem parede embaixo — fica aparente no teto.`, meio);
    if (v.invertida) add("atencao", v.id, `${v.id}: viga invertida (sobe dentro da parede de cima) — a laje fica pendurada nela: armadura de suspensão no detalhamento.`, meio);
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
  // nó de viga em balanço apoiado no meio de outra viga: separa os tramos
  const temNo = (q) => vigas.some((v) => (v.noA && esDist(v.a, q) < 0.05) || (v.noB && esDist(v.b, q) < 0.05));
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
        if (esDist(pa, pb) > 0.05 || temPilar(pa) || temNo(pa)) continue;
        ts[i] = { ids: [...A.ids, ...B.ids], a: na, b: nb, pecas: [...A.pecas, ...B.pecas] }; ts.splice(j, 1); mudou = true; break;
      }
    }
  }
  const fim = (t, q) => { for (const v of t.pecas) { if (esDist(v.a, q) < 0.05) return { no: v.noA || null, livre: v.balanco === "a" }; if (esDist(v.b, q) < 0.05) return { no: v.noB || null, livre: v.balanco === "b" }; } return { no: null, livre: false }; };
  return ts.map((t) => { const pA = temPilar(t.a), pB = temPilar(t.b), fA = fim(t, t.a), fB = fim(t, t.b); return { ...t, L: esDist(t.a, t.b), apoioA: pA && !fA.livre ? pA.id : null, apoioB: pB && !fB.livre ? pB.id : null, noA: fA.no, noB: fB.no, livreA: fA.livre, livreB: fB.livre }; });
}
// ESCADA (critério 11): laje inclinada maciça de 12 cm + degraus + revestimento
// + reboco embaixo; uso de escada sem acesso público 2,5 kN/m² (NBR 6120:2019,
// Tabela 10 — a conferir). e: { contorno, chegada [A, B], esp (espelho),
// piso, comp (vão em planta), forma }. Caracol: estrutura pronta (fora).
const ES_ESCADA = { h: 0.12, q: 2.5, revest: 1.0, reboco: 0.25 };
function esCargaEscada(e) {
  if (!e || e.forma === "caracol" || !e.contorno || e.contorno.length < 3) return null;
  const esp = e.esp || 0.175, piso = e.piso || 0.28, cos = piso / Math.hypot(piso, esp);
  const g = ES_CARGAS.pesos.concretoArmado * (ES_ESCADA.h / cos + esp / 2) + ES_ESCADA.revest + ES_ESCADA.reboco, A = esAreaPoli(e.contorno);
  return { g, q: ES_ESCADA.q, A, G: g * A, Q: ES_ESCADA.q * A, l: e.comp || Math.sqrt(A), cos };
}
// VIGA CONTÍNUA (NBR 6118, 14.6.7.1): tramos alinhados que se encontram num
// pilar formam uma linha contínua, apoiada (sem engaste) em todos os pilares e
// nas vigas em que se apoia. Método dos deslocamentos (giro em cada apoio).
// Sem alternância da carga de uso (14.6.7.3: uso ≤ 20% do total em edifícios).
// Momentos fletores "internos": positivo traciona embaixo; Ma/Mb nas pontas.
function esFEM(L, w, pts) { // momentos de engaste perfeito (horário +)
  let l = -w * L * L / 12, r = w * L * L / 12;
  for (const p of pts) { const a = Math.min(L, Math.max(0, p.t)), b = L - a; l -= p.P * a * b * b / (L * L); r += p.P * a * a * b / (L * L); }
  return { l, r };
}
// spans: [{ L, I, w, pts: [{ t, P }] }] em sequência → [{ Ma, Mb, RA, RB }]
// balanço (livre "A" ou "B", só na ponta da linha): rigidez zero e o momento
// na raiz é isostático — entra no nó como carga
function esFEMBalanco(s) {
  const L = s.L || 1;
  if (s.livre === "B") return { l: -(s.w * L * L / 2 + s.pts.reduce((t, p) => t + p.P * Math.min(L, Math.max(0, p.t)), 0)), r: 0 };
  return { l: 0, r: s.w * L * L / 2 + s.pts.reduce((t, p) => t + p.P * (L - Math.min(L, Math.max(0, p.t))), 0) };
}
function esLinhaContinua(spans) {
  const n = spans.length, k = spans.map((s) => s.livre ? 0 : 2 * (s.I || 1) / (s.L || 1)), F = spans.map((s) => s.livre ? esFEMBalanco(s) : esFEM(s.L, s.w, s.pts));
  // nó j: k(j-1)(θj-1 + 2θj) + k(j)(2θj + θj+1) = -FEMr(j-1) - FEMl(j)
  const a = new Array(n + 1).fill(0), b = new Array(n + 1).fill(0), c = new Array(n + 1).fill(0), d = new Array(n + 1).fill(0);
  for (let j = 0; j <= n; j++) {
    if (j > 0) { a[j] = k[j - 1]; b[j] += 2 * k[j - 1]; d[j] -= F[j - 1].r; }
    if (j < n) { c[j] = k[j]; b[j] += 2 * k[j]; d[j] -= F[j].l; }
  }
  for (let j = 0; j <= n; j++) if (Math.abs(b[j]) < 1e-12) { a[j] = 0; c[j] = 0; b[j] = 1; d[j] = 0; } // ponta livre do balanço
  for (let j = 1; j <= n; j++) { const m = a[j] / b[j - 1]; b[j] -= m * c[j - 1]; d[j] -= m * d[j - 1]; }
  const th = new Array(n + 1).fill(0); th[n] = d[n] / b[n]; for (let j = n - 1; j >= 0; j--) th[j] = (d[j] - c[j] * th[j + 1]) / b[j];
  return spans.map((s, i) => {
    const Ml = F[i].l + k[i] * (2 * th[i] + th[i + 1]), Mr = F[i].r + k[i] * (2 * th[i + 1] + th[i]);
    const L = s.L || 1, R0B = (s.w * L * L / 2 + s.pts.reduce((t, p) => t + p.P * p.t, 0)) / L, R0A = s.w * L + s.pts.reduce((t, p) => t + p.P, 0) - R0B;
    return { Ma: Ml, Mb: -Mr, RA: R0A - (Ml + Mr) / L, RB: R0B + (Ml + Mr) / L };
  });
}
// liga os tramos em linhas: alinhados e com a ponta comum num pilar
function esLinhasDeTramos(ts) {
  const dir = (t) => { const L = esDist(t.a, t.b) || 1; return { x: (t.b.x - t.a.x) / L, y: (t.b.y - t.a.y) / L }; };
  const viz = ts.map(() => ({ A: null, B: null }));
  ts.forEach((t, i) => ts.forEach((o, j) => {
    if (j <= i) return; const u = dir(t), v = dir(o); if (Math.abs(u.x * v.x + u.y * v.y) < 0.996) return;
    for (const [lt, lo] of [["A", "A"], ["A", "B"], ["B", "A"], ["B", "B"]]) {
      const pt = lt === "A" ? t.a : t.b, po = lo === "A" ? o.a : o.b, ap = t["apoio" + lt] || (t["no" + lt] ? "V:" + t["no" + lt] : null), apo = o["apoio" + lo] || (o["no" + lo] ? "V:" + o["no" + lo] : null);
      if (!ap || ap !== apo || esDist(pt, po) > 0.3 || viz[i][lt] || viz[j][lo]) continue;
      viz[i][lt] = { j, lado: lo }; viz[j][lo] = { j: i, lado: lt };
    }
  }));
  const usado = new Set(), linhas = [];
  ts.forEach((t, i) => {
    if (usado.has(i)) return;
    // vai até uma ponta da linha
    let cur = i, entra = "A", guard = 0;
    while (viz[cur][entra] && guard++ < ts.length) { const nx = viz[cur][entra]; cur = nx.j; entra = nx.lado === "A" ? "B" : "A"; }
    // percorre: cada item { i, inv } (inv: percorrido de B para A)
    const lin = []; let sai = entra === "A" ? "B" : "A"; guard = 0;
    while (cur != null && !usado.has(cur) && guard++ <= ts.length) { usado.add(cur); lin.push({ i: cur, inv: sai === "A" }); const nx = viz[cur][sai]; if (!nx) break; cur = nx.j; sai = nx.lado === "A" ? "B" : "A"; }
    linhas.push(lin);
  });
  return linhas;
}
// reações e momentos de todos os tramos (g e q separados)
function esResolverContinuas(ts, carga, pontos, extra) {
  const R = ts.map(() => null);
  for (const lin of esLinhasDeTramos(ts)) {
    const sol = {};
    for (const comp of ["g", "q"]) {
      const spans = lin.map(({ i, inv }) => {
        const t = ts[i], L = t.L || 1, w = t.pecas.reduce((s, v) => s + ((carga.get(v.id) || {})[comp] || 0), 0) / L, h = t.pecas[0].h || 0.4, bb = t.pecas[0].b_ || 0.14;
        return { L, I: bb * h ** 3 / 12, w, livre: t.livreA ? (inv ? "B" : "A") : t.livreB ? (inv ? "A" : "B") : null, pts: [...pontos[i], ...extra[i]].map((p) => ({ t: inv ? L - p.t : p.t, P: p[comp] })) };
      });
      sol[comp] = esLinhaContinua(spans);
    }
    lin.forEach(({ i, inv }, m) => {
      const g = sol.g[m], q = sol.q[m];
      const A = inv ? { R: [g.RB, q.RB], M: [g.Mb, q.Mb] } : { R: [g.RA, q.RA], M: [g.Ma, q.Ma] }, B = inv ? { R: [g.RA, q.RA], M: [g.Ma, q.Ma] } : { R: [g.RB, q.RB], M: [g.Mb, q.Mb] };
      const viz = ts[(lin[m - 1] || lin[m + 1] || {}).i];
      R[i] = { A: { g: A.R[0], q: A.R[1] }, B: { g: B.R[0], q: B.R[1] }, Ma: { g: A.M[0], q: A.M[1] }, Mb: { g: B.M[0], q: B.M[1] }, continua: lin.length > 1, lBack: (ts[i].livreA || ts[i].livreB) && viz ? viz.L : null };
    });
  }
  return R;
}
// pavs: [{ paredes, areas, nivel, usoPadrao, nome }] de baixo para cima;
// lanc: resultado de esLancarPavimentos; params: os da estrutura.
// Devolve por pavimento: vigas { id: { g, q (kN/m), L, RA, RB } }, pilares
// { id: { Ng, Nq } (no pé do pilar, kN) }, e a lista da fundação.
function esDescidaCargas(pavs, lanc, params) {
  const P = { ...ES_PADRAO, ...(params || {}) }, gc = ES_CARGAS.pesos.concretoArmado;
  const res = pavs.map(() => ({ vigas: {}, tramos: [], pilares: {}, paineis: [], escadas: [], avisos: [] }));
  const nPav = pavs.length;
  for (let k = nPav - 1; k >= 0; k--) {
    const est = lanc[k], topo = esTopoPavimento(pavs, k);
    const vigas = (est.vigas || []).filter((v) => !v.baldrame), bald = (est.vigas || []).filter((v) => v.baldrame);
    const carga = new Map(), comParede = new Set(), comLaje = new Set(); // id -> { g, q } total (kN) distribuído na peça
    const add = (id, g, q) => { const c = carga.get(id) || { g: 0, q: 0 }; c.g += g; c.q += q; carga.set(id, c); };
    // peso próprio das vigas e baldrames
    for (const v of [...vigas, ...bald]) add(v.id, gc * v.b_ * v.h * esDist(v.a, v.b), 0);
    // lajes deste pavimento (teto) nas vigas deste pavimento
    (pavs[k].areas || []).forEach((a, lajeIdx) => {
      if (!a.pts || a.pts.length < 3) return;
      if (a.tipo === "laje") {
        // pré-fabricada trabalha numa direção (vigotas); maciça com ly/lx ≤ 2 nas duas
        const c = esCargaLaje(a, pavs[k].usoPadrao), duas = c.tipo === "macica" || c.tipo === "informada";
        const pl = esPaineisLaje(a.pts, vigas, (a.carga || {}).vigotas || "auto", duas, 0.1, (pavs[k].escadas || []).map(esFuroEscada));
        pl.porViga.forEach((A, i) => { if (A) { add(vigas[i].id, c.g * A, c.q * A); comLaje.add(vigas[i].id); } });
        for (const pn of pl.paineis) {
          res[k].paineis.push({ ...pn, laje: lajeIdx, tipo: c.tipo, g: c.g, q: c.q, pre: c.pre, esp: c.pre ? c.pre.hTotal : (a.esp || 0.1), piso: c.piso, vigaIds: pn.porVigaIdx.map(([i, A]) => [vigas[i].id, A]) });
          if (pn.forcado && pn.outro < pn.vao - 0.05) res[k].avisos.push(`Laje com vigotas no maior vão (${String(Math.round(pn.vao * 100) / 100).replace(".", ",")} m em vez de ${String(Math.round(pn.outro * 100) / 100).replace(".", ",")} m): confira com o fabricante.`);
        }
      } else if (a.tipo === "telhado") {
        const ls = (a.lados || []).filter((l) => l && l.inclina !== false && l.pct != null), pct = ls.length ? ls.reduce((t, l) => t + (+l.pct || 0), 0) / ls.length : 30;
        const c = esCargaTelhado(a, pct), inf = esAreasDeInfluencia(a.pts, vigas);
        if (c.falta) res[k].avisos.push(`Telhado sem ${c.falta === "telha" ? "peso da telha" : "peso da estrutura"}: a carga dele não entrou.`);
        inf.forEach((A, i) => { if (A) add(vigas[i].id, c.g * A, 0); });
      }
    });
    // escada (critério 11): metade da carga na viga onde ela chega (em cima),
    // metade no apoio de baixo (no térreo, direto no solo/contrapiso)
    for (const e of pavs[k].escadas || []) {
      const r = esCargaEscada(e); if (!r || !e.chegada) continue;
      const m = { x: (e.chegada[0].x + e.chegada[1].x) / 2, y: (e.chegada[0].y + e.chegada[1].y) / 2 };
      let melhor = null, dm = 0.4; for (const v of vigas) { const d = esPontoNoSeg(m, v.a, v.b).d; if (d < dm) { dm = d; melhor = v; } }
      if (melhor) { add(melhor.id, r.G / 2, r.Q / 2); res[k].escadas.push({ ...r, viga: melhor.id }); }
      else { res[k].escadas.push({ ...r, viga: null }); res[k].avisos.push("Escada sem viga onde ela chega em cima: confira o furo da laje."); }
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
          if (ov > 0.01) { add(v.id, g * hLivre * ov, 0); comParede.add(v.id); }
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
      let R = ts.map(() => ({ A: { g: 0, q: 0 }, B: { g: 0, q: 0 } })), extra = ts.map(() => []);
      for (let it = 0; it < 8; it++) {
        extra = ts.map(() => []);
        ts.forEach((t, i) => {
          for (const lado of ["A", "B"]) {
            if (t["apoio" + lado] || t["livre" + lado]) continue;
            const q = lado === "A" ? t.a : t.b, no = t["no" + lado];
            if (no) { const j = ts.findIndex((o) => o.ids.includes(no)); if (j >= 0) { extra[j].push({ t: esPontoNoSeg(q, ts[j].a, ts[j].b).t, g: R[i][lado].g, q: R[i][lado].q }); continue; } }
            let melhor = -1, dm = 0.2; ts.forEach((o, j) => { if (j === i) return; const r = esPontoNoSeg(q, o.a, o.b); if (r.d < dm) { dm = r.d; melhor = j; } });
            if (melhor >= 0) extra[melhor].push({ t: esPontoNoSeg(q, ts[melhor].a, ts[melhor].b).t, g: R[i][lado].g, q: R[i][lado].q });
          }
        });
        R = esResolverContinuas(ts, carga, pontos, extra);
      }
      ts.forEach((t, i) => {
        const w = t.pecas.reduce((s, v) => { const c = carga.get(v.id) || { g: 0, q: 0 }; return { g: s.g + c.g, q: s.q + c.q }; }, { g: 0, q: 0 });
        res[k].tramos.push({ ids: t.ids, L: t.L, apoioA: t.apoioA, apoioB: t.apoioB, g: w.g / (t.L || 1), q: w.q / (t.L || 1), RA: R[i].A, RB: R[i].B, Ma: R[i].Ma, Mb: R[i].Mb, continua: R[i].continua, pontos: pontos[i], pontosTodos: [...pontos[i], ...extra[i]], livre: t.livreA ? "A" : t.livreB ? "B" : null, lBack: R[i].lBack, b_: t.pecas[0].b_, h: t.pecas[0].h, baldrame: grupo === bald, comParede: false });
        res[k].tramos[res[k].tramos.length - 1].comParede = t.ids.some((id) => comParede.has(id));
        res[k].tramos[res[k].tramos.length - 1].comLaje = t.ids.some((id) => comLaje.has(id));
        res[k].tramos[res[k].tramos.length - 1].apoiaOutra = extra[i].length > 0 || pontos[i].length > 0;
        res[k].tramos[res[k].tramos.length - 1].especial = t.pecas.some((v) => v.vigaPiso || v.vigaEscada);
        res[k].tramos[res[k].tramos.length - 1].equilibrio = t.pecas.some((v) => v.equilibrio);
        for (const id of t.ids) res[k].vigas[id] = { tramo: t.ids.join("+"), L: t.L, g: w.g / (t.L || 1), q: w.q / (t.L || 1), RA: R[i].A, RB: R[i].B, apoioA: t.apoioA, apoioB: t.apoioB };
        // tramo de equilíbrio de balanço curto: a outra ponta é puxada para cima
        const eq = t.pecas.find((v) => v.equilibrio);
        if (eq) for (const [lado, Rr] of [["A", R[i].A], ["B", R[i].B]]) if (Rr.g < -0.5 && !t["no" + lado]) {
          const q = lado === "A" ? t.a : t.b, raiz = t.pecas.some((v) => (v.noA && esDist(v.a, q) < 0.05) || (v.noB && esDist(v.b, q) < 0.05)); if (raiz) continue;
          res[k].avisos.push(`${t.ids.join("+")}: a ponta é puxada para cima (${String(Math.round(-Rr.g * 10) / 10).replace(".", ",")} kN) pelo balanço da ${eq.equilibrio} — amarrar na viga/pilar de apoio com armadura de suspensão.`);
        }
        if (!t.apoioA && !t.livreA && !t.noA && !ts.some((o, j) => j !== i && esPontoNoSeg(t.a, o.a, o.b).d < 0.2)) res[k].avisos.push(`${t.ids.join("+")}: ponta sem apoio (nem pilar nem viga).`);
        if (!t.apoioB && !t.livreB && !t.noB && !ts.some((o, j) => j !== i && esPontoNoSeg(t.b, o.a, o.b).d < 0.2)) res[k].avisos.push(`${t.ids.join("+")}: ponta sem apoio (nem pilar nem viga).`);
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

// ═══════════════════════════════════════════════════════════════
// SENTIDO DAS LAJES (critério 10)
// ═══════════════════════════════════════════════════════════════
// A laje desenhada pelo arquiteto é dividida pelas vigas em painéis. Em cada
// painel:
// - pré-fabricada (treliçada, protendida): trabalha numa direção só; as
//   vigotas vencem o MENOR vão (vão teórico entre eixos de viga) e a carga vai
//   só para as duas vigas onde as vigotas apoiam (regra da alavanca: cada
//   ponto reparte entre as duas pontas da vigota); a borda paralela às vigotas
//   não recebe carga da laje. sentido "u"/"v" força a direção;
// - maciça: λ = ly/lx ≤ 2 trabalha nas duas direções (cada ponto para a viga
//   mais próxima, como as charneiras); λ > 2 trabalha como pré-fabricada no
//   menor vão (NBR 6118, 14.7.6.1 — a conferir no texto oficial).
// Ponta de vigota sem viga (balanço): a carga vai toda para a viga do outro lado.
function esAnguloBase(vigas) {
  let sx = 0, sy = 0;
  for (const v of vigas) { const L = esDist(v.a, v.b); if (!L) continue; const t = Math.atan2(v.b.y - v.a.y, v.b.x - v.a.x); sx += L * Math.cos(4 * t); sy += L * Math.sin(4 * t); }
  return sx || sy ? Math.atan2(sy, sx) / 4 : 0;
}
// primeira viga que o raio q + s·d encontra
function esRaioViga(q, d, vigas) {
  const S = vigas._seg || esSegs(vigas); let best = -1, dm = Infinity;
  for (let i = 0; i < S.n; i++) {
    const ex = S.ex[i], ey = S.ey[i], den = d.x * ey - d.y * ex, Le = S.L[i]; if (Math.abs(den) < 1e-9 || !Le) continue;
    const wx = S.ax[i] - q.x, wy = S.ay[i] - q.y, s = (wx * ey - wy * ex) / den, t = (wx * d.y - wy * d.x) / den, tol = 0.1 / Le;
    if (s > 1e-6 && t >= -tol && t <= 1 + tol && s < dm) { dm = s; best = i; }
  }
  return best < 0 ? null : { i: best, d: dm };
}
// vigas em arrays (laços rápidos na malha da laje)
function esSegs(vigas) {
  const n = vigas.length, S = { n, ax: new Float64Array(n), ay: new Float64Array(n), ex: new Float64Array(n), ey: new Float64Array(n), L: new Float64Array(n) };
  vigas.forEach((v, i) => { S.ax[i] = v.a.x; S.ay[i] = v.a.y; S.ex[i] = v.b.x - v.a.x; S.ey[i] = v.b.y - v.a.y; S.L[i] = Math.hypot(S.ex[i], S.ey[i]); });
  return S;
}
function esDistSegs(S, x, y, out) { // distância do ponto a cada viga (em out)
  for (let i = 0; i < S.n; i++) {
    const L2 = S.L[i] * S.L[i]; let t = L2 ? ((x - S.ax[i]) * S.ex[i] + (y - S.ay[i]) * S.ey[i]) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    out[i] = Math.hypot(x - S.ax[i] - t * S.ex[i], y - S.ay[i] - t * S.ey[i]);
  }
  return out;
}
// mesma laje e mesmas vigas → mesmos painéis (a altura da viga não muda o painel)
const ES_CACHE_PAINEIS = new Map();
function esMediana(xs) { if (!xs.length) return null; const o = [...xs].sort((a, b) => a - b); return o[Math.floor(o.length / 2)]; }
function esPaineisLaje(pts, vigas, sentido = "auto", duasDir = false, passo = 0.1, furos = []) {
  const chave = JSON.stringify([pts.map((p) => [+p.x.toFixed(4), +p.y.toFixed(4)]), vigas.map((v) => [+v.a.x.toFixed(4), +v.a.y.toFixed(4), +v.b.x.toFixed(4), +v.b.y.toFixed(4)]), sentido, duasDir, passo, (furos || []).map((f) => f.map((q) => [+q.x.toFixed(4), +q.y.toFixed(4)]))]);
  const em = ES_CACHE_PAINEIS.get(chave); if (em) return { porViga: [...em.porViga], paineis: em.paineis };
  const r = esPaineisLajeCalc(pts, vigas, sentido, duasDir, passo, furos || []);
  ES_CACHE_PAINEIS.set(chave, r); if (ES_CACHE_PAINEIS.size > 60) ES_CACHE_PAINEIS.delete(ES_CACHE_PAINEIS.keys().next().value);
  return { porViga: [...r.porViga], paineis: r.paineis };
}
function esPaineisLajeCalc(pts, vigas, sentido, duasDir, passo, furos) {
  const porViga = new Array(vigas.length).fill(0), paineis = [];
  if (!vigas.length || !pts || pts.length < 3) return { porViga, paineis };
  vigas = [...vigas]; vigas._seg = esSegs(vigas); const S = vigas._seg, dist = new Float64Array(S.n);
  const ang = esAnguloBase(vigas), U = { x: Math.cos(ang), y: Math.sin(ang) }, V = { x: -U.y, y: U.x }, A = passo * passo;
  const loc = pts.map((p) => ({ s: p.x * U.x + p.y * U.y, r: p.x * V.x + p.y * V.y }));
  const s0 = Math.min(...loc.map((p) => p.s)), s1 = Math.max(...loc.map((p) => p.s)), r0 = Math.min(...loc.map((p) => p.r)), r1 = Math.max(...loc.map((p) => p.r));
  const ni = Math.max(1, Math.ceil((s1 - s0) / passo)), nj = Math.max(1, Math.ceil((r1 - r0) / passo));
  const W = (i, j) => { const s = s0 + (i + 0.5) * passo, r = r0 + (j + 0.5) * passo; return { x: U.x * s + V.x * r, y: U.y * s + V.y * r }; };
  const perto = (q) => { esDistSegs(S, q.x, q.y, dist); let dm = Infinity, m = -1; for (let i = 0; i < S.n; i++) if (dist[i] < dm) { dm = dist[i]; m = i; } return { i: m, d: dm }; };
  const empate = (dm) => { const ms = []; for (let i = 0; i < S.n; i++) if (dist[i] <= dm + 1e-9) ms.push(i); return ms; }; // depois de perto()
  const est = new Int32Array(ni * nj).fill(-2); // -2 fora, -1 sobre viga, 0 livre, >0 painel
  for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) {
    const q = W(i, j); if (!esDentroPoli(q, pts) || furos.some((f) => esDentroPoli(q, f))) continue; // furo da escada: sem laje
    const pv = perto(q);
    if (pv.d < 0.08) { est[i * nj + j] = -1; const ms = empate(pv.d); for (const m of ms) porViga[m] += A / ms.length; }
    else est[i * nj + j] = 0;
  }
  let np = 0;
  for (let i0 = 0; i0 < ni; i0++) for (let j0 = 0; j0 < nj; j0++) {
    if (est[i0 * nj + j0] !== 0) continue;
    np++; const cel = [], fila = [[i0, j0]]; est[i0 * nj + j0] = np;
    while (fila.length) {
      const [i, j] = fila.pop(); cel.push([i, j]);
      for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) if (a >= 0 && b >= 0 && a < ni && b < nj && est[a * nj + b] === 0) { est[a * nj + b] = np; fila.push([a, b]); }
    }
    // raios nos dois sentidos de cada direção
    const info = cel.map(([i, j]) => { const q = W(i, j); return { q, up: esRaioViga(q, U, vigas), un: esRaioViga(q, { x: -U.x, y: -U.y }, vigas), vp: esRaioViga(q, V, vigas), vn: esRaioViga(q, { x: -V.x, y: -V.y }, vigas) }; });
    const lU = esMediana(info.filter((c) => c.up && c.un).map((c) => c.up.d + c.un.d)) || Infinity;
    const lV = esMediana(info.filter((c) => c.vp && c.vn).map((c) => c.vp.d + c.vn.d)) || Infinity;
    const lx = Math.min(lU, lV), ly = Math.max(lU, lV), duas = duasDir && isFinite(ly) && ly / lx <= 2;
    const forcado = sentido === "u" || sentido === "v";
    const naU = sentido === "u" ? true : sentido === "v" ? false : lU <= lV;
    // livre: sem viga dos dois lados em nenhuma direção (beiral, sacada)
    let livres = 0; const dPerto = [], minha = new Map(), dar = (i, a) => { porViga[i] += a; minha.set(i, (minha.get(i) || 0) + a); };
    for (const c of info) {
      if (!(c.up && c.un) && !(c.vp && c.vn)) livres++;
      const pv0 = perto(c.q); dPerto.push(pv0.d);
      if (duas) { const ms = empate(pv0.d); for (const m of ms) dar(m, A / ms.length); continue; }
      const h1 = naU ? c.un : c.vn, h2 = naU ? c.up : c.vp;
      if (h1 && h2) { dar(h1.i, A * h2.d / (h1.d + h2.d)); dar(h2.i, A * h1.d / (h1.d + h2.d)); }
      else if (h1 || h2) dar((h1 || h2).i, A);
      else dar(pv0.i, A);
    }
    const balanco = livres > info.length / 2;
    dPerto.sort((a, b) => a - b);
    const area = cel.length * A; if (area < 0.25) continue;
    const cx = info.reduce((t, c) => t + c.q.x, 0) / info.length, cy = info.reduce((t, c) => t + c.q.y, 0) / info.length;
    const vao = naU ? lU : lV, outro = naU ? lV : lU;
    // ponto dentro do painel mais perto do centro (painel em L ou anel de balanço)
    let pc = info[0].q, dpc = Infinity; for (const c of info) { const dd = (c.q.x - cx) ** 2 + (c.q.y - cy) ** 2; if (dd < dpc) { dpc = dd; pc = c.q; } }
    const malha = { passo, U, V, s0, r0, cel };
    paineis.push({ malha, centro: pc, dir: naU ? U : V, vao: balanco ? null : isFinite(vao) ? vao : null, outro: isFinite(outro) ? outro : null, duas, area, forcado, balanco,
      // balanço: comprimento = distância da borda à viga de apoio (95% dos pontos)
      lBalanco: balanco ? esR3(dPerto[Math.floor(dPerto.length * 0.95)] + passo / 2) : null,
      U, V, lU: isFinite(lU) ? lU : null, lV: isFinite(lV) ? lV : null, porVigaIdx: [...minha.entries()] });
  }
  return { porViga, paineis };
}

// ═══════════════════════════════════════════════════════════════
// DIMENSIONAMENTO (etapa 4) — NBR 6118:2023, CA-50, a conferir no texto oficial
// ═══════════════════════════════════════════════════════════════
// Combinação última normal: γf = 1,4 em permanente e variável (11.7, Tabela
// 11.1). Serviço (flecha): quase permanente, ψ2 = 0,3 (residencial, Tabela
// 11.2). γc = 1,4; γs = 1,15 (12.4.1, Tabela 12.1).
const ES_DIM = {
  gamaF: 1.4, gamaC: 1.4, gamaS: 1.15, psi2: 0.3,
  fyk: 500, fywd: 435, Es: 210000,           // MPa (8.3.5; fywd ≤ 435 no estribo, 17.4.2.2)
  // taxa mínima de flexão ρmin (%) por fck — Tabela 17.3
  rhoMin: { 20: 0.150, 25: 0.150, 30: 0.150, 35: 0.164, 40: 0.179, 45: 0.194, 50: 0.208 },
  xdMax: 0.45,                                // 14.6.4.3, fck ≤ 50
  agregado: 0.019,                            // brita 1 (m) — espaçamento 1,2 × dmáx
  // barras (NBR 7480): diâmetro (mm) e massa nominal (kg/m)
  barras: [{ d: 5, kg: 0.154, aco: "CA-60" }, { d: 6.3, kg: 0.245 }, { d: 8, kg: 0.395 }, { d: 10, kg: 0.617 }, { d: 12.5, kg: 0.963 }, { d: 16, kg: 1.578 }, { d: 20, kg: 2.466 }, { d: 25, kg: 3.853 }],
  flechaTotal: 250,                           // l/250 (Tabela 13.3, aceitabilidade)
  flechaParede: 500, flechaParedeMax: 0.010,  // l/500 e 10 mm depois da parede
  alfaF: 1.32,                                // fluência, carga aos 30 dias (17.3.2.1.2)
};
const esAreaBarra = (dmm) => Math.PI * (dmm / 1000) ** 2 / 4; // m²
const esKgBarra = (dmm) => (ES_DIM.barras.find((b) => b.d === dmm) || { kg: 0.00617 * dmm * dmm / 1 }).kg;
const esFmtBit = (d) => `${String(d).replace(".", ",")}`;
function esConcreto(fck) {
  const fcd = fck / ES_DIM.gamaC, fctm = 0.3 * Math.pow(fck, 2 / 3), fctd = 0.7 * fctm / ES_DIM.gamaC;
  const Eci = 5600 * Math.sqrt(fck), Ecs = Math.min(1, 0.8 + 0.2 * fck / 80) * Eci;
  return { fck, fcd, fctm, fctd, Eci, Ecs, fyd: ES_DIM.fyk / ES_DIM.gamaS }; // MPa
}
// esforços de um tramo: w (kN/m) uniforme + cargas P (kN) em t (m) e os
// momentos nas pontas Ma, Mb (negativo = tração em cima; 0 = bi-apoiada)
function esEsforcos(L, w, pontos, Ma = 0, Mb = 0, livre = null, lBack = 0) {
  const RB0 = (w * L * L / 2 + pontos.reduce((t, p) => t + p.P * p.t, 0)) / L, RA0 = w * L + pontos.reduce((t, p) => t + p.P, 0) - RB0;
  const RA = RA0 + (Mb - Ma) / L, RB = RB0 - (Mb - Ma) / L;
  const M = (x) => RA0 * x - w * x * x / 2 - pontos.reduce((t, p) => t + (x > p.t ? p.P * (x - p.t) : 0), 0) + Ma * (1 - x / L) + Mb * x / L;
  const xs = []; for (let i = 0; i <= 60; i++) xs.push(L * i / 60); for (const p of pontos) xs.push(Math.min(L, Math.max(0, p.t)));
  let Mmax = 0; for (const x of xs) Mmax = Math.max(Mmax, M(x));
  // onde o momento negativo da ponta acaba (para o comprimento da negativa)
  let x0A = 0, x0B = 0; for (let i = 0; i <= 200; i++) { const x = L * i / 200; if (M(x) < -1e-9) x0A = x; else break; }
  for (let i = 200; i >= 0; i--) { const x = L * i / 200; if (M(x) < -1e-9) x0B = L - x; else break; }
  // flecha no meio por trabalho virtual (EI = 1): ∫ M·m dx, m da carga unitária no meio
  const n = 200, h = L / n; let I = 0;
  for (let i = 0; i <= n; i++) { const x = i * h, m = livre === "B" ? -(L - x) : livre === "A" ? -x : x <= L / 2 ? x / 2 : (L - x) / 2, f = i === 0 || i === n ? 1 : i % 2 ? 4 : 2; I += f * M(x) * m; }
  // balanço: flecha na ponta = engastado + giro da raiz (tramo de equilíbrio
  // bi-apoiado com o momento da raiz, sem o alívio da carga dele)
  if (livre) I += Math.abs(livre === "B" ? Ma : Mb) * (lBack || 0) / 3 * L * 3 / h;
  return { RA, RB, Vmax: Math.max(Math.abs(RA), Math.abs(RB)), Mmax, Mneg: Math.max(0, -Ma, -Mb), MnegA: Math.max(0, -Ma), MnegB: Math.max(0, -Mb), flechaEI: I * h / 3, x0A, x0B };
}
// armadura longitudinal de viga: barras de mesma bitola, até 2 camadas
function esBarrasViga(As, b, c) {
  let melhor = null;
  for (const { d } of ES_DIM.barras) {
    if (d < 8) continue; const f = d / 1000, ah = Math.max(0.02, f, 1.2 * ES_DIM.agregado), livre = b - 2 * c - 2 * 0.005;
    const porCamada = Math.max(0, Math.floor((livre + ah) / (f + ah))); if (porCamada < 2) continue;
    const n = Math.max(2, Math.ceil(As / esAreaBarra(d) - 1e-9)); if (n > 2 * porCamada) continue;
    const area = n * esAreaBarra(d);
    // custo: área de aço, com preferência por poucas barras e uma camada (montagem e concretagem)
    const camadas = n > porCamada ? 2 : 1, custo = area * (1 + 0.05 * (n - 2) + 0.15 * (camadas - 1));
    if (!melhor || custo < melhor.custo - 1e-12) melhor = { n, d, area, camadas, custo };
  }
  return melhor;
}
function esEstribo(AswS, smax) {
  for (const d of [5, 6.3, 8, 10]) {
    const A2 = 2 * esAreaBarra(d); let s = AswS > 0 ? A2 / AswS : smax; s = Math.floor(Math.min(s, smax) * 100) / 100;
    if (s >= 0.07) return { d, s };
  }
  return null;
}
// t: tramo da descida (L, g, q em kN/m, pontosTodos, b_, h, comParede, baldrame)
// hTeste: altura a verificar (padrão: a do lançamento). Devolve o resultado e,
// em hMin, a menor altura (múltiplo de 5 cm, a partir de 25) que atende tudo.
function esDimViga(t, params, hTeste) {
  const P = { ...ES_PADRAO, ...(params || {}) }, C = esConcreto(P.fck), b = t.b_ || P.viga.b;
  const c = (t.baldrame ? ES_NBR.cobrimento.contatoSolo : ES_NBR.cobrimento.vigaPilar)[P.caa] / 1000;
  const L = t.L, pts = t.pontosTodos || t.pontos || [];
  const kPa = 1000, fcd = C.fcd * kPa, fyd = C.fyd * kPa, fctd = C.fctd * kPa, fctm = C.fctm * kPa, Ecs = C.Ecs * kPa;
  // ELU com os momentos de apoio da viga contínua; positivo nunca menor que o
  // de engaste perfeito nos apoios (14.6.7.1)
  const Mx = (o, fg, fq) => o ? fg * (o.g || 0) + fq * (o.q || 0) : 0, gf = ES_DIM.gamaF;
  const ptsD = pts.map((p) => ({ t: p.t, P: gf * (p.g + p.q) })), wD = gf * (t.g + t.q);
  const ed = esEsforcos(L, wD, ptsD, Mx(t.Ma, gf, gf), Mx(t.Mb, gf, gf), t.livre, t.lBack);
  if (t.continua && !t.livre) { const fe = esFEM(L, wD, ptsD), ff = esEsforcos(L, wD, ptsD, fe.l, -fe.r); ed.Mmax = Math.max(ed.Mmax, ff.Mmax); }
  const es = esEsforcos(L, t.g + ES_DIM.psi2 * t.q, pts.map((p) => ({ t: p.t, P: p.g + ES_DIM.psi2 * p.q })), Mx(t.Ma, 1, ES_DIM.psi2), Mx(t.Mb, 1, ES_DIM.psi2), t.livre, t.lBack);
  // balanço: vão de referência da flecha é o dobro do comprimento (Tabela 13.3)
  const Lf = t.livre ? 2 * L : L, rotL = t.livre ? "2L/250, balanço" : "L/250";
  const verificar = (h) => {
    const d = h - c - 0.005 - 0.00625, r = { h, d, Md: ed.Mmax, Vd: ed.Vmax, ok: true, motivos: [] };
    const k = ed.Mmax / (0.425 * b * d * d * fcd);
    if (k >= 1) { r.ok = false; r.motivos.push("flexão: a seção não resiste"); return r; }
    const x = 1.25 * d * (1 - Math.sqrt(1 - k)); r.xd = x / d;
    if (r.xd > ES_DIM.xdMax) { r.ok = false; r.motivos.push(`flexão: x/d = ${r.xd.toFixed(2).replace(".", ",")} > 0,45 (ductilidade, 14.6.4.3)`); }
    const AsMin = (ES_DIM.rhoMin[P.fck] || 0.15) / 100 * b * h;
    r.AsCalc = ed.Mmax / (fyd * (d - 0.4 * x)); r.AsMin = AsMin; r.As = Math.max(r.AsCalc, AsMin);
    r.barras = esBarrasViga(r.As, b, c);
    if (!r.barras) { r.ok = false; r.motivos.push("flexão: a armadura não cabe na largura"); }
    // negativa nos apoios da viga contínua (mesma conta, tração em cima)
    r.Mneg = ed.Mneg;
    if (ed.Mneg > 0.5) {
      const kn = ed.Mneg / (0.425 * b * d * d * fcd);
      if (kn >= 1) { r.ok = false; r.motivos.push("flexão no apoio: a seção não resiste"); }
      else {
        const xn = 1.25 * d * (1 - Math.sqrt(1 - kn)); r.xdNeg = xn / d;
        if (r.xdNeg > ES_DIM.xdMax) { r.ok = false; r.motivos.push(`flexão no apoio: x/d = ${r.xdNeg.toFixed(2).replace(".", ",")} > 0,45`); }
        r.AsNeg = Math.max(ed.Mneg / (fyd * (d - 0.4 * xn)), AsMin); r.barrasNeg = esBarrasViga(r.AsNeg, b, c);
        if (!r.barrasNeg) { r.ok = false; r.motivos.push("flexão no apoio: a armadura não cabe"); }
      }
    }
    if (Math.max(r.As, r.AsNeg || 0) > 0.04 * b * h) { r.ok = false; r.motivos.push("flexão: armadura acima de 4% (17.3.5.2.4)"); }
    // cisalhamento, modelo I (17.4.2.2)
    const VRd2 = 0.27 * (1 - P.fck / 250) * fcd * b * d, Vc = 0.6 * fctd * b * d; r.VRd2 = VRd2;
    if (ed.Vmax > VRd2) { r.ok = false; r.motivos.push("cisalhamento: a biela de concreto não resiste (VSd > VRd2)"); }
    const AswMin = 0.2 * fctm / (ES_DIM.fyk * kPa) * b, AswS = Math.max((ed.Vmax - Vc) / (0.9 * d * ES_DIM.fywd * kPa), AswMin);
    const smax = ed.Vmax <= 0.67 * VRd2 ? Math.min(0.6 * d, 0.30) : Math.min(0.3 * d, 0.20);
    r.estribo = esEstribo(AswS, smax); r.AswS = AswS;
    if (!r.estribo) { r.ok = false; r.motivos.push("cisalhamento: estribo não cabe"); }
    // flecha (17.3.2.1): Branson com a armadura adotada; diferida αf = 1,32
    const Asef = t.livre ? (r.barrasNeg ? r.barrasNeg.area : r.AsNeg || r.As) : r.barras ? r.barras.area : r.As, Ic = b * h ** 3 / 12, Mr = 1.5 * fctm * Ic / (h / 2), ae = ES_DIM.Es / C.Ecs;
    const xII = (-ae * Asef + Math.sqrt((ae * Asef) ** 2 + 2 * b * ae * Asef * d)) / b, III = b * xII ** 3 / 3 + ae * Asef * (d - xII) ** 2;
    const Ma = t.livre ? Math.max(es.Mmax, es.Mneg) : es.Mmax, Ie = Ma <= Mr ? Ic : Math.min(Ic, (Mr / Ma) ** 3 * Ic + (1 - (Mr / Ma) ** 3) * III);
    const fi = es.flechaEI / (Ecs * Ie);
    r.flecha = { imediata: fi, total: fi * (1 + ES_DIM.alfaF), lim: Lf / ES_DIM.flechaTotal, aposParede: fi * ES_DIM.alfaF, limParede: Math.min(Lf / ES_DIM.flechaParede, ES_DIM.flechaParedeMax) };
    if (r.flecha.total > r.flecha.lim) { r.ok = false; r.motivos.push(`flecha ${(Math.ceil(r.flecha.total * 1000) / 10).toFixed(1).replace(".", ",")} cm > ${(Math.floor(r.flecha.lim * 1000) / 10).toFixed(1).replace(".", ",")} cm (${rotL})`); }
    if ((t.comParede || t.baldrame) && r.flecha.aposParede > r.flecha.limParede) { r.ok = false; r.motivos.push(`flecha depois da parede ${(Math.ceil(r.flecha.aposParede * 10000) / 10).toFixed(1).replace(".", ",")} mm > ${(Math.floor(r.flecha.limParede * 10000) / 10).toFixed(1).replace(".", ",")} mm (L/500 e até 10 mm; fissura na alvenaria)`); }
    return r;
  };
  const r = verificar(hTeste || t.h || P.viga.h);
  let hMin = null; for (let h = 0.25; h <= 0.801; h += 0.05) { const v = verificar(Math.round(h * 100) / 100); if (v.ok) { hMin = v.h; break; } }
  r.hMin = hMin; r.b = b; r.L = L;
  // aço (kg, estimativa): positivas com 10φ de gancho em cada ponta e 8 cm
  // dentro do apoio; 2φ6,3 porta-estribos; estribos fechados com ganchos
  if (r.barras) {
    const comp = L + 2 * (0.08 + 10 * r.barras.d / 1000), nE = r.estribo ? Math.ceil(L / r.estribo.s) + 1 : 0;
    const compE = 2 * (b - 2 * c) + 2 * (r.h - 2 * c) + 0.10;
    r.aco = { [r.barras.d]: r.barras.n * comp * esKgBarra(r.barras.d) };
    r.aco[6.3] = (r.aco[6.3] || 0) + 2 * (L + 0.2) * esKgBarra(6.3);
    // negativa: em cada apoio com momento, 0,25 L para dentro do tramo + ancoragem
    // balanço: a negativa corre o balanço inteiro (a ancoragem no tramo de equilíbrio entra nele)
    // tramo de equilíbrio: até onde o negativo acaba + ancoragem (lb ≈ 38φ,
    // CA-50 nervurada, boa aderência, C25 — 9.4.2.4), nunca menos que 0,25 L
    if (r.barrasNeg) for (const [Mn, x0] of [[ed.MnegA, ed.x0A], [ed.MnegB, ed.x0B]]) if (Mn > 0.5) r.aco[r.barrasNeg.d] = (r.aco[r.barrasNeg.d] || 0) + r.barrasNeg.n * ((t.livre ? L : t.equilibrio ? Math.min(L, Math.max(0.25 * L, x0 + 38 * r.barrasNeg.d / 1000)) : 0.25 * L) + 10 * r.barrasNeg.d / 1000) * esKgBarra(r.barrasNeg.d);
    if (r.estribo) r.aco[r.estribo.d] = (r.aco[r.estribo.d] || 0) + nE * compE * esKgBarra(r.estribo.d);
  }
  return r;
}
// flexo-compressão reta, armadura simétrica em duas faces (As total, As/2 em
// cada face, a dl da borda). Devolve o MRd para Nd (kN) ou null se esmaga.
function esMRd(b, h, dl, As, Nd, C) {
  const fcd = C.fcd * 1000, fyd = C.fyd * 1000, Es = ES_DIM.Es * 1000;
  const sig = (e) => Math.max(-fyd, Math.min(fyd, Es * e));
  const calc = (x) => {
    const eps = x <= h ? (y) => 0.0035 * (x - y) / x : (y) => 0.002 * (x - y) / (x - 3 * h / 7);
    const a = Math.min(0.8 * x, h), Fc = 0.85 * fcd * b * a, s1 = sig(eps(dl)), s2 = sig(eps(h - dl));
    return { N: Fc + As / 2 * (s1 + s2), M: Fc * (h / 2 - a / 2) + As / 2 * (s1 - s2) * (h / 2 - dl) };
  };
  let lo = 1e-5, hi = 60 * h; if (calc(hi).N < Nd) return null;
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (calc(m).N < Nd) lo = m; else hi = m; }
  return calc(hi).M;
}
function esBarrasPilar(As, b) {
  let melhor = null;
  for (const d of [10, 12.5, 16, 20]) {
    if (d / 1000 > b / 8 + 1e-9) continue; // φl ≤ b/8 (18.4.2.1)
    for (const n of [4, 6, 8, 10, 12]) { const area = n * esAreaBarra(d); if (area + 1e-12 < As) continue; if (!melhor || area < melhor.area - 1e-12) melhor = { n, d, area }; break; }
  }
  return melhor;
}
// p: pilar do lançamento; N: { Ng, Nq } no pé do lance; l: comprimento do lance (m)
function esDimPilar(p, N, l, params, vento) {
  const P = { ...ES_PADRAO, ...(params || {}) }, C = esConcreto(P.fck), c = ES_NBR.cobrimento.vigaPilar[P.caa] / 1000;
  const b = Math.min(p.b, p.h), hL = Math.max(p.b, p.h), Ac = b * hL, bcm = Math.round(b * 100);
  const gn = bcm < ES_NBR.pilarDimMin ? ES_NBR.gamaN(bcm) : 1, Nd = ES_DIM.gamaF * gn * (N.Ng + N.Nq), fcd = C.fcd * 1000, fyd = C.fyd * 1000;
  const r = { b, h: hL, Nd, gn, ok: true, motivos: [], direcoes: [] }, dl = c + 0.005 + 0.008;
  // vento: Mu (força ao longo do eixo do pilar, seção trabalhando com p.h) e Mv
  const Mw = (hd) => { if (!vento) return 0; const comH = Math.abs(hd - p.h) < 1e-9 && p.h !== p.b ? true : Math.abs(hd - p.b) < 1e-9 && p.h !== p.b ? false : null; return comH === null ? Math.max(vento.Mu, vento.Mv) : comH ? vento.Mu : vento.Mv; };
  // combinações (11.7): uso principal com vento ψ0 = 0,6; vento principal com uso ψ0 = 0,5
  const combos = (hd) => { const w = Mw(hd); return w > 1e-6 ? [{ Nd, Mw: ES_DIM.gamaF * gn * 0.6 * w, nome: "uso + 0,6 vento" }, { Nd: ES_DIM.gamaF * gn * (N.Ng + 0.5 * N.Nq), Mw: ES_DIM.gamaF * gn * w, nome: "vento + 0,5 uso" }] : [{ Nd, Mw: 0, nome: "vertical" }]; };
  r.vento = vento ? { Mu: vento.Mu, Mv: vento.Mv } : null;
  const AsMin = Math.max(0.15 * Nd / fyd, 0.004 * Ac), AsMax = 0.04 * Ac; let As = AsMin;
  for (const [hd, bd] of [[b, hL], [hL, b]]) {
    // 15.6 e 15.8: le = comprimento do lance; λ1 = 35 (αb = 1, momento mínimo)
    const le = l, lam = 3.46 * le / hd;
    if (lam > 140) { r.ok = false; r.motivos.push(`esbeltez λ = ${Math.round(lam)} > 140`); }
    else if (lam > 90) { r.ok = false; r.motivos.push(`esbeltez λ = ${Math.round(lam)} > 90 (pede análise mais precisa, 15.8.3.3)`); }
    let pior = null;
    for (const cb of combos(hd)) {
      const Ndc = cb.Nd, M1min = Ndc * (0.015 + 0.03 * hd), nu = Ndc / (Ac * fcd), M1 = Math.max(M1min, cb.Mw);
      let Md = M1, M2 = 0;
      if (lam > 35) { const k = Math.min(0.005 / (hd * (nu + 0.5)), 0.005 / hd); M2 = Ndc * le * le / 10 * k; Md = M1 + M2; }
      // armadura para (Nd, Md) com As/2 em cada face perpendicular a esta direção
      const resiste = (A) => { const m = esMRd(bd, hd, dl, A, Ndc, C); return m != null && m >= Md; };
      let need;
      if (!resiste(AsMax)) { r.ok = false; r.motivos.push(`flexo-compressão (${Math.round(hd * 100)} cm${cb.Mw ? `, ${cb.nome}` : ""}): a seção não resiste nem com 4% de aço`); need = AsMax; }
      else if (resiste(0)) need = 0;
      else { let lo = 0, hi = AsMax; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (resiste(m)) hi = m; else lo = m; } need = hi; }
      As = Math.max(As, need);
      if (!pior || need > pior.need || (need === pior.need && Md > pior.Md)) pior = { need, h: hd, le, lam, M1min, M2, Md, nu, Mw: cb.Mw, combo: cb.nome, Nd: Ndc };
    }
    r.direcoes.push(pior);
  }
  r.AsMin = AsMin; r.As = As; r.barras = esBarrasPilar(As, b);
  if (!r.barras) { r.ok = false; r.motivos.push("armadura não cabe com Ø ≤ b/8"); }
  if (r.barras) {
    // estribo: φt ≥ 5 e φl/4; s ≤ 20 cm, menor dimensão e 12φl (CA-50) — 18.4.3
    const dt = Math.max(5, r.barras.d / 4) <= 5 ? 5 : 6.3, s = Math.floor(Math.min(0.20, b, 12 * r.barras.d / 1000) * 100) / 100;
    r.estribo = { d: dt, s };
    const comp = l + 0.5, nE = Math.ceil(l / s) + 1, compE = 2 * (b - 2 * c) + 2 * (hL - 2 * c) + 0.10;
    r.aco = { [r.barras.d]: r.barras.n * comp * esKgBarra(r.barras.d), [dt]: nE * compE * esKgBarra(dt) };
  }
  // seção que atende: cresce no comprimento (dentro da parede), de 5 em 5 cm
  if (!r.ok && !r.hSugerida) { for (let h2 = hL + 0.05; h2 <= 0.801; h2 += 0.05) { const t = esDimPilar({ ...p, b, h: Math.round(h2 * 100) / 100, _sem: true }, N, l, params, vento); if (t.ok) { r.hSugerida = t.h; break; } if (p._sem) break; } }
  return r;
}
// ═══════════════════════════════════════════════════════════════
// FUNDAÇÃO (etapa 6) — NBR 6122:2019 e NBR 6118 (blocos e sapatas, 22.6/22.7)
// ═══════════════════════════════════════════════════════════════
// Projeto de fundação exige investigação do solo (sondagem SPT, NBR 6122 e
// NBR 8036). Sem a carga admissível informada, o sistema estima para
// orçamento: estaca escavada só pelo atrito lateral médio de 30 kPa, fator de
// segurança 2 — a ponta da broca manual fica mal limpa e não se conta (dá
// ~1 t por metro em Ø20–25, a regra de obra); sapata com σadm de 150 kPa.
// Valores típicos de solo de média resistência — a conferir com a sondagem.
// Blocos sobre estacas pelo método das bielas (Blévot): biela entre 45° e
// 55°, tirante Rs = (Nd/n)·(r − c)/d na direção de cada estaca (c = 0,25ap
// para 2 estacas, 0,30ap para 3, 0,354ap para 4), majorado 1,15; 1 estaca:
// fretagem 0,25·Nd·(1 − ap/B)/fyd. Espaçamento 3D (escavadas), 15 cm da
// estaca à face. Estaca: armadura de ligação 4 φ10 × 2,5 m + estribo φ5 c/20.
// Sapata rígida (h ≥ (A − ap)/3), tirante Nd(A − ap)/(8d) em cada direção.
const ES_FUND = { fsLateral: 30, qPonta: 0, FS: 2, sigmaPadrao: 150, espacamento: 3, folga: 0.15, pesoBloco: 1.05,
  estaca: { n: 4, d: 10, comp: 2.5, estribo: 5, s: 0.20 }, cobrimento: 0.05 };
function esPadmEstaca(D, L) { return (Math.PI * D * L * ES_FUND.fsLateral + Math.PI * D * D / 4 * ES_FUND.qPonta) / ES_FUND.FS; }
function esBarrasTirante(As) {
  let m = null;
  for (const d of [8, 10, 12.5, 16, 20]) { const n = Math.max(2, Math.ceil(As / esAreaBarra(d) - 1e-9)); const area = n * esAreaBarra(d), custo = area * (1 + 0.05 * (n - 2)); if (n <= 8 && (!m || custo < m.custo)) m = { n, d, area, custo }; }
  return m;
}
// estacas: o diâmetro informado é o mínimo; sem carga admissível informada, o
// engenheiro escolhe UM diâmetro para a obra toda (um trado só) — o que dá o
// menor volume (estacas + blocos) com até 4 estacas em todos os pilares. Com
// padm informada (da sondagem), fica o diâmetro dela.
const ES_DIAMETROS = [0.20, 0.25, 0.30, 0.35, 0.40, 0.50, 0.60];
function esFundacaoObra(itens, params) { // itens: [{ pl, N, dimPilar }]
  const P = { ...ES_PADRAO, ...(params || {}) }, F = { ...ES_PADRAO.fundacao, ...(P.fundacao || {}) };
  const com = (D) => itens.map(({ pl, N, dimPilar }) => esDimFundacao(pl, N, dimPilar, { ...P, fundacao: { ...F, diam: D } }));
  if (F.tipo === "sapata" || +F.padm > 0) return esSepararBlocos(com(+F.diam || 0.25), itens, P);
  let melhor = null;
  for (const D of ES_DIAMETROS.filter((x) => x >= (+F.diam || 0.25) - 1e-9)) {
    const rs = com(D), ok = rs.every((r) => r.ok), vol = rs.reduce((t, r) => t + r.concreto.estacas + r.concreto.blocos, 0);
    if (ok && (!melhor || vol < melhor.vol - 1e-9)) melhor = { rs, vol };
  }
  return esSepararBlocos(melhor ? melhor.rs : com(ES_DIAMETROS[ES_DIAMETROS.length - 1]), itens, P);
}
// blocos que se encostam: primeiro gira o bloco de 2 estacas (90°); se ainda
// encosta, um bloco só para os dois pilares (bloco conjunto, carga somada)
function esCantosBloco(f, pl) {
  const bl = f.bloco || f.sapata; if (!bl) return null;
  const c = f.centro || pl, a = f.ang != null ? f.ang : (pl.ang || 0), co = Math.cos(a), sn = Math.sin(a);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => ({ x: c.x + i * bl.L / 2 * co - j * bl.B / 2 * sn, y: c.y + i * bl.L / 2 * sn + j * bl.B / 2 * co }));
}
function esSepararBlocos(rs, itens, P) {
  const acoes = [], ids = itens.map((x) => x.id || x.pl.id);
  const toca = (i, j) => { const A = esCantosBloco(rs[i], itens[i].pl), B = esCantosBloco(rs[j], itens[j].pl); return A && B && esPoligonosTocam(A, B); };
  for (let pass = 0; pass < 3; pass++) {
    let mexeu = false;
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      if (rs[i].semBloco || rs[j].semBloco || !toca(i, j)) continue;
      // girar o de 2 estacas (o mais comprido) resolve na maioria
      let resolvido = false;
      for (const x of [i, j]) {
        if (rs[x].n !== 2 || rs[x].girado) continue;
        rs[x].ang = (itens[x].pl.ang || 0) + Math.PI / 2; rs[x].girado = true;
        if (!toca(i, j)) { acoes.push({ k: 0, id: ids[x], tipo: "fundacao", texto: `Bloco de ${ids[x]} girado 90° para não encostar no de ${ids[x === i ? j : i]}.` }); resolvido = true; break; }
        rs[x].ang = undefined; rs[x].girado = false;
      }
      if (resolvido) { mexeu = true; continue; }
      // bloco conjunto: um bloco para os dois, no meio, com a carga somada
      const pi = itens[i].pl, pj = itens[j].pl, d = esDist(pi, pj), ang = Math.atan2(pj.y - pi.y, pj.x - pi.x);
      const pseudo = { b: Math.max(Math.min(pi.b, pi.h), Math.min(pj.b, pj.h)), h: d + Math.max(pi.b, pi.h, pj.b, pj.h), ang, x: (pi.x + pj.x) / 2, y: (pi.y + pj.y) / 2 };
      const N = { Ng: itens[i].N.Ng + itens[j].N.Ng, Nq: itens[i].N.Nq + itens[j].N.Nq };
      const r = esDimFundacaoCom(pseudo, N, itens[i].dimPilar, { ...P, fundacao: { ...ES_PADRAO.fundacao, ...(P.fundacao || {}), diam: rs[i].D || (P.fundacao || {}).diam } });
      r.centro = { x: pseudo.x, y: pseudo.y }; r.ang = ang; r.conjunto = [ids[i], ids[j]]; r.Nk = N.Ng + N.Nq;
      // arranque do segundo pilar dentro do mesmo bloco
      const b2 = itens[j].dimPilar && itens[j].dimPilar.barras, hb = (r.bloco || r.sapata).h;
      const f2 = { tipo: r.tipo, id: ids[j], Nk: itens[j].N.Ng + itens[j].N.Nq, ok: r.ok, motivos: [], aco: {}, concreto: { estacas: 0, blocos: 0, sapatas: 0 }, conjunto: [ids[i], ids[j]], semBloco: true, n: 0, hBloco: hb, D: r.D, L: r.L, estimado: r.estimado, padm: r.padm };
      if (b2) { f2.arranque = b2; f2.aco[b2.d] = b2.n * (hb - ES_FUND.cobrimento + 0.20 + 40 * b2.d / 1000) * esKgBarra(b2.d); }
      rs[i] = r; rs[j] = f2; mexeu = true;
      acoes.push({ k: 0, id: ids[i], tipo: "fundacao", texto: `${ids[i]} e ${ids[j]} muito perto: um bloco só para os dois (${r.n} estaca${r.n === 1 ? "" : "s"}${r.D ? ` Ø${Math.round(r.D * 100)}` : ""}), a detalhar como bloco de duas colunas.` });
    }
    if (!mexeu) break;
  }
  rs.acoes = acoes;
  return rs;
}
function esDimFundacao(pl, N, dimPilar, params) {
  const P = { ...ES_PADRAO, ...(params || {}) };
  return esDimFundacaoCom(pl, N, dimPilar, { ...P, fundacao: { ...ES_PADRAO.fundacao, ...(P.fundacao || {}) } });
}
function esDimFundacaoCom(pl, N, dimPilar, P) {
  const F = P.fundacao, C = esConcreto(P.fck), fyd = C.fyd * 1000;
  const Nk = N.Ng + N.Nq, Nd = ES_DIM.gamaF * Nk, ap = Math.max(pl.b, pl.h), bp = Math.min(pl.b, pl.h);
  const r = { tipo: F.tipo, Nk, ok: true, motivos: [], aco: {}, concreto: { estacas: 0, blocos: 0, sapatas: 0 }, ang: pl.ang || 0 };
  const somaAco = (d, kg) => { r.aco[d] = (r.aco[d] || 0) + kg; };
  // arranque: as barras do pilar entram no bloco/sapata e passam 40φ para a emenda
  const arranque = (hb) => { const b = dimPilar && dimPilar.barras; if (!b) return; somaAco(b.d, b.n * (hb - ES_FUND.cobrimento + 0.20 + 40 * b.d / 1000) * esKgBarra(b.d)); r.arranque = b; };
  if (F.tipo === "sapata") {
    const sig = +F.sigma > 0 ? +F.sigma : ES_FUND.sigmaPadrao; r.sigma = sig; r.estimado = !(+F.sigma > 0);
    const Areq = ES_FUND.pesoBloco * Nk / sig, dd = ap - bp; // mesmas abas nas duas direções
    const B = Math.max(0.6, Math.ceil(((-dd + Math.sqrt(dd * dd + 4 * Areq)) / 2) * 20) / 20), L = Math.max(B, Math.ceil((B + dd) * 20) / 20);
    const h = Math.max(0.30, Math.ceil(((L - ap) / 3 + 0.05) * 20) / 20), d = h - ES_FUND.cobrimento;
    r.sapata = { L, B, h }; r.concreto.sapatas = L * B * h;
    for (const [Lx, ax, Ly] of [[L, ap, B], [B, bp, L]]) {
      const As = Math.max(1.15 * Nd * (Lx - ax) / (8 * d) / fyd, 0.0015 * Ly * h), arm = esArmaduraLaje(As / Ly, h);
      const a = arm || { d: 10, s: 0.10 }; somaAco(a.d, (Ly / a.s + 1) * (Lx - 0.10 + 0.30) * esKgBarra(a.d));
      (r.malha = r.malha || []).push(a);
    }
    arranque(h);
    return r;
  }
  const D = +F.diam || 0.25, Lp = +F.prof || 4, padm = +F.padm > 0 ? +F.padm : esPadmEstaca(D, Lp);
  r.D = D; r.L = Lp; r.padm = padm; r.estimado = !(+F.padm > 0);
  const n = Math.max(1, Math.ceil(ES_FUND.pesoBloco * Nk / padm - 1e-9)); r.n = n;
  if (n > 4) { r.ok = false; r.motivos.push(`${n} estacas de Ø${Math.round(D * 100)} cm: use diâmetro ou profundidade maiores (bloco de até 4)`); }
  const e = ES_FUND.espacamento * D, f = ES_FUND.folga;
  let bl, raio = 0, c = 0;
  if (n === 1) bl = { L: Math.max(D + 2 * f, ap + 0.10), B: Math.max(D + 2 * f, bp + 0.10) };
  else if (n === 2) { bl = { L: e + D + 2 * f, B: D + 2 * f }; raio = e / 2; c = 0.25 * ap; }
  else if (n === 3) { bl = { L: e + D + 2 * f, B: e * Math.sqrt(3) / 2 + D + 2 * f }; raio = e / Math.sqrt(3); c = 0.30 * ap; }
  else { bl = { L: e + D + 2 * f, B: e + D + 2 * f }; raio = e / Math.SQRT2; c = 0.354 * ap; }
  // altura: biela a 45°–55° (d entre r − c e 1,43(r − c)); 1 estaca: h ≥ 1,2D
  const d = n === 1 ? Math.max(0.30, 1.2 * D) : Math.max(0.30, raio - c);
  const h = Math.ceil((d + 0.10) * 20) / 20; // 10 cm: cabeça da estaca dentro do bloco + cobrimento
  bl.h = h; bl.L = Math.ceil(bl.L * 20) / 20; bl.B = Math.ceil(bl.B * 20) / 20; r.bloco = bl;
  r.concreto.blocos = bl.L * bl.B * h * (n === 3 ? 0.8 : 1);
  r.concreto.estacas = n * Math.PI * D * D / 4 * Lp;
  // posição das estacas (no eixo do pilar: x ao longo do lado maior)
  r.estacas = n === 1 ? [{ x: 0, y: 0 }] : n === 2 ? [{ x: -e / 2, y: 0 }, { x: e / 2, y: 0 }]
    : n === 3 ? [{ x: -e / 2, y: -e * Math.sqrt(3) / 6 }, { x: e / 2, y: -e * Math.sqrt(3) / 6 }, { x: 0, y: e * Math.sqrt(3) / 3 }]
    : [{ x: -e / 2, y: -e / 2 }, { x: e / 2, y: -e / 2 }, { x: e / 2, y: e / 2 }, { x: -e / 2, y: e / 2 }].concat(n > 4 ? [] : []);
  if (n === 1) {
    const As = Math.max(0.25 * Nd * (1 - ap / bl.L) / fyd, 2 * esAreaBarra(8)), t = esBarrasTirante(As);
    r.tirante = t; somaAco(t.d, 2 * t.n * (2 * (bl.L + bl.B) - 0.2) * esKgBarra(t.d) / 2); // estribos horizontais nas duas direções
  } else {
    const H = (Nd / n) * (raio - c) / d, T = n === 2 ? H : n === 3 ? H / Math.sqrt(3) : H / Math.SQRT2; // força em cada tirante
    const t = esBarrasTirante(1.15 * T / fyd); r.tirante = t; r.Rs = T;
    const lados = n === 2 ? 1 : n === 3 ? 3 : 4, comp = (n === 2 ? bl.L : e) + 2 * (D / 2 + f) + 2 * 0.25;
    somaAco(t.d, lados * t.n * comp * esKgBarra(t.d));
  }
  // armadura de pele/estribos construtivos do bloco: φ6,3 c/15 no contorno
  somaAco(6.3, Math.ceil(h / 0.15) * (2 * (bl.L + bl.B)) * esKgBarra(6.3));
  // estacas: armadura de ligação
  const A = ES_FUND.estaca; somaAco(A.d, n * A.n * (A.comp + 0.3) * esKgBarra(A.d));
  somaAco(A.estribo, n * (A.comp / A.s + 1) * (Math.PI * (D - 0.10) + 0.10) * esKgBarra(A.estribo));
  r.estacaArm = A;
  arranque(h);
  return r;
}
// dimensiona tudo: descida = esDescidaCargas(...), lanc = esLancarPavimentos(...)
// ═══════════════════════════════════════════════════════════════
// VENTO (NBR 6123) E ESTABILIDADE GLOBAL (NBR 6118, 15.5.3) — etapa 2
// ═══════════════════════════════════════════════════════════════
// Vk = V0·S1·S2·S3; S2 = b·Fr·(z/10)^p (Tabela 2, classe A até 20 m e B até
// 50 m); q = 0,613·Vk² (N/m²); força em cada nível = Ca·q·(faixa de fachada
// entre meias alturas), nas duas direções (X e Y da planta), mais a empena do
// telhado no último nível. A alvenaria não entra na rigidez (a favor da
// segurança). Pórtico de pilares e vigas pelo método de Muto (D): cada pilar
// rígido 12·(0,8·Ec·Ic)/h³ vezes a = k̄/(2 + k̄), k̄ = Σ(0,4·Ec·Ib/L das vigas
// nas pontas)/(2·0,8·Ec·Ic/h) — não linearidade física aproximada de 15.7.3;
// base sem baldrame: rotulada, a = 0,5k̄/(1 + 2k̄). Deslocamento por andar =
// cortante/ΣD. γz = 1/(1 − ΔMtot,d/M1,tot,d) com 1,4·(G + 0,5Q) e 1,4·W
// (vento principal; ψ0 = 0,5 para uso residencial, Tabela 11.2): até 1,1 nós
// fixos; até 1,3 os esforços do vento ×0,95γz (15.7.2); acima, não atende.
// Deslocamentos em serviço (Tabela 13.3, vento frequente ψ1 = 0,3, rigidez
// bruta): topo H/1700 e entre andares hi/850. Momento do vento em cada pilar:
// cortante dele × h, dividido entre as pontas pela rigidez das vigas em cada uma.
const ES_VENTO_S2 = { A: { 1: [1.10, 0.06], 2: [1.00, 0.085], 3: [0.94, 0.10], 4: [0.86, 0.12], 5: [0.74, 0.15] }, B: { 1: [1.11, 0.065], 2: [1.00, 0.09], 3: [0.94, 0.105], 4: [0.85, 0.125], 5: [0.73, 0.16] } };
function esS2(z, cat, classe) { const [b, p] = ES_VENTO_S2[classe][cat] || ES_VENTO_S2[classe][4], Fr = classe === "A" ? 1.0 : 0.98; return b * Fr * Math.pow(Math.max(z, 1) / 10, p); }
function esVento(pavs, lanc, descida, params) {
  const P = { ...ES_PADRAO, ...(params || {}) }, W = { ...ES_PADRAO.vento, ...(P.vento || {}) }, C = esConcreto(P.fck), E = C.Ecs * 1000; // kPa
  const nPav = pavs.length, avisos = [];
  // níveis (topo de cada pavimento, absoluto) e caixas da planta
  const caixa = (k) => { const ps = (pavs[k].paredes || []).flatMap((w) => [w.a, w.b]); if (!ps.length) return null; const xs = ps.map((q) => q.x), ys = ps.map((q) => q.y); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; };
  const andares = []; for (let k = 0; k < nPav; k++) { const cx = caixa(k); if (!cx || !(lanc[k].pilares || []).length) continue; andares.push({ k, cx, nivel: (pavs[k].nivel || 0), topo: (pavs[k].nivel || 0) + esTopoPavimento(pavs, k) }); }
  if (!andares.length) return null;
  const H = andares[andares.length - 1].topo, maior = Math.max(...andares.map((a) => Math.max(a.cx.x1 - a.cx.x0, a.cx.y1 - a.cx.y0)), H), classe = maior <= 20 ? "A" : "B";
  // telhado em cima do último andar: empena (meia largura × inclinação média)
  const ult = andares[andares.length - 1], telh = (pavs[ult.k + 1] ? (pavs[ult.k + 1].areas || []) : []).concat(pavs[ult.k].areas || []).filter((a) => a.tipo === "telhado" && a.pts && a.pts.length >= 3);
  const pct = telh.length ? (() => { const ls = (telh[0].lados || []).filter((l) => l && l.inclina !== false && l.pct != null); return ls.length ? ls.reduce((t, l) => t + (+l.pct || 0), 0) / ls.length : 30; })() : 0;
  const q = (z) => 0.613 * (W.V0 * W.S1 * esS2(z, W.categoria, classe) * W.S3) ** 2 / 1000; // kN/m²
  // carga vertical aplicada em cada nível (diferença das normais nos pés)
  const somaN = (k, c) => Object.values((descida.pavimentos[k] || {}).pilares || {}).reduce((t, n) => t + n[c], 0);
  const vert = andares.map((a, i) => { const prox = andares[i + 1]; return { G: somaN(a.k, "Ng") - (prox ? somaN(prox.k, "Ng") : 0), Q: somaN(a.k, "Nq") - (prox ? somaN(prox.k, "Nq") : 0) }; });
  const pilaresV = andares.map(() => ({})), dirs = {};
  for (const [dn, ux, uy] of [["x", 1, 0], ["y", 0, 1]]) {
    // força em cada nível (kN)
    const F = andares.map((a, i) => {
      const larg = dn === "x" ? a.cx.y1 - a.cx.y0 : a.cx.x1 - a.cx.x0, zb = i ? andares[i - 1].topo : 0, zt = andares[i + 1] ? andares[i + 1].topo : null;
      const faixa = (a.topo - zb) / 2 + (zt != null ? (zt - a.topo) / 2 : 0);
      let Fk = W.Ca * q(a.topo) * larg * faixa;
      if (i === andares.length - 1 && pct) { const outra = dn === "x" ? a.cx.x1 - a.cx.x0 : a.cx.y1 - a.cx.y0, Hr = Math.min(larg, outra) / 2 * pct / 100; Fk += W.Ca * q(a.topo + Hr) * 0.5 * larg * Hr; }
      return Fk;
    });
    // rigidez de cada andar (Muto)
    const rig = andares.map((a, i) => {
      const k = a.k, est = lanc[k], h0 = a.topo - (i ? andares[i - 1].topo : 0);
      const vigasEm = (vs, no) => vs.filter((v) => esDist(v.a, no) <= 0.3 || esDist(v.b, no) <= 0.3);
      const kb = (vs, no, fat) => vigasEm(vs, no).reduce((t, v) => { const L = esDist(v.a, v.b); if (L < 0.2) return t; const c = ((v.b.x - v.a.x) * ux + (v.b.y - v.a.y) * uy) / L; return t + fat * E * v.b_ * v.h ** 3 / 12 / L * c * c; }, 0);
      const cima = (est.vigas || []).filter((v) => !v.baldrame), baixoV = i ? (lanc[andares[i - 1].k].vigas || []).filter((v) => !v.baldrame) : (est.vigas || []).filter((v) => v.baldrame);
      const itens = (est.pilares || []).map((p) => {
        const h = Math.max(0.5, (p.topo != null ? p.topo : h0) - (p.base || 0)); // no térreo, desde o fundo do baldrame
        const c = Math.cos(p.ang || 0), sn = Math.sin(p.ang || 0), Iu = p.b * p.h ** 3 / 12, Iv = p.h * p.b ** 3 / 12, cu = c * ux + sn * uy, I = Iu * cu * cu + Iv * (1 - cu * cu);
        const kc = 0.8 * E * I / h, kt = kb(cima, p.no, 0.4), kbt = kb(baixoV, p.no, 0.4);
        let a_; if (i === 0 && kbt === 0) { const kk = kt / kc; a_ = 0.5 * kk / (1 + 2 * kk); } else { const kk = (kt + kbt) / (2 * kc); a_ = kk / (2 + kk); }
        const D = a_ * 12 * 0.8 * E * I / h ** 3;
        // ELS: rigidez bruta (sem as reduções 0,8 e 0,4)
        const kcS = E * I / h, ktS = kt / 0.4, kbS = kbt / 0.4; let aS; if (i === 0 && kbS === 0) { const kk = ktS / kcS; aS = 0.5 * kk / (1 + 2 * kk); } else { const kk = (ktS + kbS) / (2 * kcS); aS = kk / (2 + kk); }
        return { p, h, D, DS: aS * 12 * E * I / h ** 3, rt: kt, rb: i === 0 && kbt === 0 ? 0 : kbt };
      });
      return { itens, SD: itens.reduce((t, x) => t + x.D, 0), SDS: itens.reduce((t, x) => t + x.DS, 0), h: h0 };
    });
    // cortantes, deslocamentos e γz
    const V = F.map((_, i) => F.slice(i).reduce((t, x) => t + x, 0));
    if (rig.some((r) => r.SD <= 1e-9)) { avisos.push({ tipo: "nbr", texto: `Vento em ${dn.toUpperCase()}: um andar não tem rigidez lateral (pilares sem vigas que os travem nessa direção) — o vento não tem por onde descer.` }); dirs[dn] = { F, V, gz: null, ok: false }; continue; }
    const drift = rig.map((r, i) => 1.4 * V[i] / r.SD), u = drift.map((_, i) => drift.slice(0, i + 1).reduce((t, x) => t + x, 0));
    const M1 = andares.reduce((t, a, i) => t + 1.4 * F[i] * a.topo, 0), dM = andares.reduce((t, a, i) => t + 1.4 * (vert[i].G + 0.5 * vert[i].Q) * u[i], 0);
    const gz = dM < M1 ? 1 / (1 - dM / M1) : Infinity, amp = gz > 1.1 ? 0.95 * gz : 1;
    // serviço: vento frequente (ψ1 = 0,3), rigidez bruta
    const driftS = rig.map((r, i) => 0.3 * V[i] / r.SDS), uS = driftS.map((_, i) => driftS.slice(0, i + 1).reduce((t, x) => t + x, 0));
    const limTopo = H / 1700, okTopo = uS[uS.length - 1] <= limTopo + 1e-9, okAndar = driftS.every((d, i) => d <= rig[i].h / 850 + 1e-9);
    const rot = dn.toUpperCase(), f3 = (x) => String(Math.round(x * 100) / 100).replace(".", ",");
    if (gz > 1.3) avisos.push({ tipo: "nbr", texto: `Estabilidade global em ${rot}: γz = ${isFinite(gz) ? f3(gz) : "∞"} > 1,3 (NBR 6118, 15.5.3) — a estrutura é deslocável demais; aumente pilares ou vigas nessa direção.` });
    else if (gz > 1.1) avisos.push({ tipo: "atencao", texto: `Estabilidade global em ${rot}: γz = ${f3(gz)} (nós móveis) — esforços do vento ampliados ×${f3(amp)} (15.7.2).` });
    if (!okTopo) avisos.push({ tipo: "nbr", texto: `Deslocamento do topo com vento em ${rot}: ${f3(uS[uS.length - 1] * 1000)} mm > H/1700 = ${f3(limTopo * 1000)} mm (Tabela 13.3).` });
    if (!okAndar) avisos.push({ tipo: "nbr", texto: `Deslocamento entre andares com vento em ${rot} acima de hi/850 (Tabela 13.3).` });
    // momento do vento em cada pilar (característico, já ampliado por γz)
    rig.forEach((r, i) => r.itens.forEach((x) => {
      const Vi = x.D / r.SD * V[i] * amp, rt = x.rt, rb = x.rb, fT = rt + rb > 0 ? rt / (rt + rb) : 0.5;
      const Mt = Vi * x.h * fT, Mb = Vi * x.h * (1 - fT), c = Math.cos(x.p.ang || 0), sn = Math.sin(x.p.ang || 0), cu = Math.abs(c * ux + sn * uy);
      const o = pilaresV[i][x.p.id] = pilaresV[i][x.p.id] || { Mu: 0, Mv: 0, V: 0 };
      // Mu: flexão pela força ao longo de u (a seção trabalha com a dimensão h)
      o.Mu = Math.max(o.Mu, Math.max(Mt, Mb) * cu); o.Mv = Math.max(o.Mv, Math.max(Mt, Mb) * Math.sqrt(Math.max(0, 1 - cu * cu))); o.V = Math.max(o.V, Vi);
      o.Mbase = i === 0 ? Math.max(o.Mbase || 0, Mb) : o.Mbase;
    }));
    dirs[dn] = { F, V, gz, amp, u, uS, limTopo, okTopo, okAndar, q: andares.map((a) => q(a.topo)), H };
  }
  // por pavimento (índice k do lançamento)
  const porPav = pavs.map(() => ({})); andares.forEach((a, i) => { porPav[a.k] = pilaresV[i]; });
  return { dirs, porPav, avisos, classe, andares: andares.map((a) => ({ k: a.k, topo: a.topo })), params: W };
}
function esDimensionar(pavs, lanc, descida, params) {
  const out = descida.pavimentos.map(() => ({ vigas: {}, pilares: {}, lajes: [] })), aco = {};
  let vento = null; try { vento = esVento(pavs, lanc, descida, params); } catch (e) { vento = null; }
  const soma = (o) => { for (const [d, kg] of Object.entries(o || {})) aco[d] = (aco[d] || 0) + kg; };
  descida.pavimentos.forEach((pv, k) => {
    for (const t of pv.tramos) { if (!t.L) continue; const r = esDimViga(t, params); r.tramo = t.ids.join("+"); for (const id of t.ids) out[k].vigas[id] = r; soma(r.aco); }
    for (const p of lanc[k].pilares || []) {
      const N = pv.pilares[p.id]; if (!N) continue;
      const l = (p.topo != null ? p.topo : esTopoPavimento(pavs, k)) - (p.base || 0);
      const r = p._sem ? null : esDimPilar(p, N, l, params, vento ? (vento.porPav[k] || {})[p.id] : null); if (!r) continue; out[k].pilares[p.id] = r; soma(r.aco);
    }
  });
  // lajes (painéis)
  descida.pavimentos.forEach((pv, k) => {
    out[k].lajes = (pv.paineis || []).map((pn) => { const r = esDimLaje(pn, params); if (r && r.aco) soma(r.aco); return r; });
    out[k].negativas = esNegativasLaje(pv.paineis || [], lanc[k].vigas || [], params); for (const n of out[k].negativas) soma(n.aco);
    out[k].escadas = (pv.escadas || []).map((e) => { const r = esDimEscada(e, params); soma(r.aco); return r; });
  });
  // fundação: um bloco (ou sapata) por pilar do pavimento mais baixo
  const itens = (descida.fundacao || []).map((f) => ({ id: f.id, pl: (lanc[0].pilares || []).find((p) => p.id === f.id), N: f, dimPilar: out[0].pilares[f.id] })).filter((x) => x.pl);
  const fund = esFundacaoObra(itens, params), compatFundacao = fund.acoes || [];
  fund.forEach((r, i) => { r.id = itens[i].id; soma(r.aco); });
  out.fundacao = fund;
  const kg = (filtro) => Object.entries(aco).filter(([d]) => filtro(+d)).reduce((t, [, v]) => t + v, 0);
  return { pavimentos: out, fundacao: fund, compatFundacao, aco, ca50: kg((d) => d > 5), ca60: kg((d) => d <= 5), vento };
}

// ═══════════════════════════════════════════════════════════════
// LAJES (etapa 4, lajes) — por painel (região entre vigas)
// ═══════════════════════════════════════════════════════════════
// Treliçada: nervura em T (mesa = intereixo × capa), bi-apoiada no vão das
// vigotas (NBR 6118, 14.7.7 lajes nervuradas; NBR 14859): flexão, cortante
// sem estribo (19.4.1, VRd1) e flecha com fissuração (α = 1,2 em T) e
// fluência. Banzo inferior da treliça admitido 2 φ4,2 CA-60; o que faltar vira
// barra adicional CA-50 por nervura. Contraflecha até ℓ/350 (Tabela 13.3).
// Protendida: o aço vem pronto da fábrica — o resultado é o que vai para a
// tabela do fabricante (vão e carga) e o momento por vigota.
// Maciça: placa apoiada nas bordas, resolvida por diferenças finitas na
// própria malha do painel (Marcus: ∇²M = −p, ∇²u = −M; ν = 0,2), flexão nas
// duas direções por metro, As,mín 0,67 ρmín nas duas direções (Tabela 19.1),
// s ≤ 2h e 20 cm, flecha com Branson. Balanço: pendente (critério 9).
const ES_LAJE = { banzoTrelica: 2 * Math.PI * 0.0042 ** 2 / 4, fyCA60: 600, contraflecha: 350, alfaT: 1.2, nu: 0.2 };
function esLinhaNeutraII(bf, hf, bw, As, d, ae) {
  // estádio II: momento estático da parte comprimida = ae·As·(d − x)
  const f = (x) => (x <= hf ? bf * x * x / 2 : bw * x * x / 2 + (bf - bw) * hf * (x - hf / 2)) - ae * As * (d - x);
  let lo = 0, hi = d; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; }
  const x = (lo + hi) / 2;
  const I = x <= hf ? bf * x ** 3 / 3 : bw * x ** 3 / 3 + (bf - bw) * hf ** 3 / 12 + (bf - bw) * hf * (x - hf / 2) ** 2;
  return { x, I: I + ae * As * (d - x) ** 2 };
}
function esFlexaoT(Md, bf, hf, bw, d, fcd, fyd) {
  const k = Md / (0.425 * bf * d * d * fcd); if (k >= 1) return null;
  let x = 1.25 * d * (1 - Math.sqrt(1 - k));
  if (0.8 * x <= hf) return { x, As: Md / (fyd * (d - 0.4 * x)) };
  const Mf = 0.85 * fcd * (bf - bw) * hf * (d - hf / 2), Mw = Md - Mf, kw = Mw / (0.425 * bw * d * d * fcd); if (kw >= 1) return null;
  x = 1.25 * d * (1 - Math.sqrt(1 - kw));
  return { x, As: Mf / (fyd * (d - hf / 2)) + Mw / (fyd * (d - 0.4 * x)) };
}
function esDimLajePre(pn, params, heTeste) {
  const P = { ...ES_PADRAO, ...(params || {}) }, C = esConcreto(P.fck), kPa = 1000;
  const pre0 = pn.pre, he = heTeste || pre0.he, pre = { ...pre0, he, hTotal: he + pre0.capa };
  const ppNovo = ES_CARGAS.pesos.concretoArmado * (pre.capa + pre.bw * he / pre.intereixo) + ES_LAJES_PRE.enchimentos[pre.ench].gama * (pre.intereixo - pre.bw) * he / pre.intereixo;
  const g = pn.g - pre0.pp + ppNovo, q = pn.q, i = pre.intereixo, bw = pre.bw, hf = pre.capa, h = pre.hTotal, l = pn.vao;
  const r = { tipo: pn.tipo, l, g, q, h, he, i, ok: true, motivos: [] };
  const w = (g + q) * i; r.Mk = w * l * l / 8; r.Md = ES_DIM.gamaF * r.Mk; r.Vd = ES_DIM.gamaF * w * l / 2;
  if (pn.tipo === "protendida") { r.consultar = true; r.cargaAlem = g - pre0.pp + q; return r; }
  const c = Math.max(0.015, ES_NBR.cobrimento.laje[P.caa] / 1000 - 0.005), d = h - c - 0.005, fcd = C.fcd * kPa, fyd = C.fyd * kPa;
  const fl = esFlexaoT(r.Md, i, hf, bw, d, fcd, fyd);
  if (!fl) { r.ok = false; r.motivos.push("flexão: a nervura não resiste"); return r; }
  const Ac = bw * h + (i - bw) * hf, AsMin = (ES_DIM.rhoMin[P.fck] || 0.15) / 100 * Ac;
  r.As = Math.max(fl.As, AsMin); r.xd = fl.x / d;
  if (r.xd > ES_DIM.xdMax) { r.ok = false; r.motivos.push(`flexão: x/d = ${r.xd.toFixed(2).replace(".", ",")} > 0,45`); }
  const banzo = ES_LAJE.banzoTrelica * ES_LAJE.fyCA60 / ES_DIM.fyk; // em área equivalente CA-50
  const falta = r.As - banzo; r.adicional = null;
  if (falta > 1e-7) {
    for (const dd of [6.3, 8, 10, 12.5]) { for (const n of [1, 2]) { const A = n * esAreaBarra(dd); if (A >= falta && (!r.adicional || A < r.adicional.area)) r.adicional = { n, d: dd, area: A }; } }
    if (!r.adicional) { r.ok = false; r.motivos.push("flexão: aço adicional não cabe na nervura"); }
  }
  const Asef = banzo + (r.adicional ? r.adicional.area : 0);
  // cortante sem estribo (19.4.1)
  const tauRd = 0.25 * C.fctd * kPa, kk = Math.max(1, 1.6 - d), rho = Math.min(0.02, Asef / (bw * d));
  r.VRd1 = tauRd * kk * (1.2 + 40 * rho) * bw * d;
  if (r.Vd > r.VRd1) { r.ok = false; r.motivos.push("cortante na nervura acima de VRd1 (pede faixa maciça no apoio ou nervura mais larga)"); }
  // flecha
  const ycg = ((i - bw) * hf * hf / 2 + bw * h * h / 2) / Ac;
  const Ic = (i - bw) * hf ** 3 / 12 + (i - bw) * hf * (ycg - hf / 2) ** 2 + bw * h ** 3 / 12 + bw * h * (h / 2 - ycg) ** 2;
  const Mr = ES_LAJE.alfaT * C.fctm * kPa * Ic / (h - ycg), ws = (g + ES_DIM.psi2 * q) * i, Ma = ws * l * l / 8;
  const II = esLinhaNeutraII(i, hf, bw, Asef, d, ES_DIM.Es / C.Ecs);
  const Ie = Ma <= Mr ? Ic : Math.min(Ic, (Mr / Ma) ** 3 * Ic + (1 - (Mr / Ma) ** 3) * II.I);
  const fi = 5 * ws * l ** 4 / (384 * C.Ecs * kPa * Ie);
  r.flecha = { total: fi * (1 + ES_DIM.alfaF), lim: l / ES_DIM.flechaTotal, contraflecha: 0 };
  if (r.flecha.total > r.flecha.lim) {
    const cf = Math.min(l / ES_LAJE.contraflecha, r.flecha.total - r.flecha.lim);
    if (r.flecha.total - cf <= r.flecha.lim + 1e-12) r.flecha.contraflecha = Math.ceil(cf * 1000) / 1000;
    else { r.ok = false; r.motivos.push(`flecha ${(Math.ceil(r.flecha.total * 1000) / 10).toFixed(1).replace(".", ",")} cm > ${(Math.floor(r.flecha.lim * 1000) / 10).toFixed(1).replace(".", ",")} cm mesmo com contraflecha de ℓ/350`); }
  }
  return r;
}
// placa apoiada: resolve na malha do painel e devolve mx, my máximos (por kN/m²)
// e u máximo (flecha × D, por kN/m²)
const ES_CACHE_PLACA = new WeakMap();
function esPlacaApoiada(malha) {
  if (ES_CACHE_PLACA.has(malha)) return ES_CACHE_PLACA.get(malha);
  const r = esPlacaApoiadaCalc(malha); ES_CACHE_PLACA.set(malha, r); return r;
}
function esPlacaApoiadaCalc(malha) {
  const { passo: h, cel } = malha, idx = new Map(cel.map(([i, j], n) => [i + "," + j, n])), N = cel.length;
  const viz = cel.map(([i, j]) => [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].map(([a, b]) => idx.has(a + "," + b) ? idx.get(a + "," + b) : -1));
  const sor = (rhs) => {
    const x = new Float64Array(N), om = 1.9, V = new Int32Array(4 * N); viz.forEach((v, n) => v.forEach((m, k) => { V[4 * n + k] = m; }));
    for (let it = 0; it < 3000; it++) {
      let dmax = 0, xmax = 1e-30;
      for (let n = 0; n < N; n++) { let s = rhs[n] * h * h; for (let k = 0; k < 4; k++) { const m = V[4 * n + k]; if (m >= 0) s += x[m]; } const dx = s / 4 - x[n]; x[n] += om * dx; if (Math.abs(dx) > dmax) dmax = Math.abs(dx); if (x[n] > xmax) xmax = x[n]; }
      if (dmax < 1e-7 * xmax) break;
    }
    return x;
  };
  const M = sor(new Float64Array(N).fill(1)), u = sor(M);
  let mx = 0, my = 0, um = 0;
  for (let n = 0; n < N; n++) {
    const v = viz[n], g = (m) => (m >= 0 ? u[m] : 0), uxx = (g(v[0]) + g(v[1]) - 2 * u[n]) / (h * h), uyy = (g(v[2]) + g(v[3]) - 2 * u[n]) / (h * h);
    mx = Math.max(mx, -(uxx + ES_LAJE.nu * uyy)); my = Math.max(my, -(uyy + ES_LAJE.nu * uxx)); um = Math.max(um, u[n]);
  }
  return { mx, my, u: um };
}
function esArmaduraLaje(As, h) {
  let melhor = null; const smax = Math.min(2 * h, 0.20);
  for (const d of [5, 6.3, 8, 10, 12.5]) {
    if (d / 1000 > h / 8) continue; // φ ≤ h/8 (20.1)
    let s = Math.floor(esAreaBarra(d) / As * 100) / 100; s = Math.min(s, smax); if (s < 0.07) continue;
    const kg = esAreaBarra(d) / s; if (!melhor || kg < melhor.areaM - 1e-12) melhor = { d, s, areaM: esAreaBarra(d) / s };
  }
  return melhor;
}
function esDimLajeMacica(pn, params) {
  const P = { ...ES_PADRAO, ...(params || {}) }, C = esConcreto(P.fck), kPa = 1000, h = pn.esp, c = ES_NBR.cobrimento.laje[P.caa] / 1000;
  const r = { tipo: "macica", l: pn.vao, h, ok: true, motivos: [] };
  if (pn.balanco) return esDimLajeBalanco(pn, params);
  // a malha apoia no centro da primeira célula sobre a viga (~5 cm do eixo de
  // cada lado): corrige para o vão teórico (eixo a eixo) — M ∝ ℓ², flecha ∝ ℓ⁴
  const pl0 = esPlacaApoiada(pn.malha), fv = pn.vao ? pn.vao / Math.max(0.5, pn.vao - 0.1) : 1;
  const pl = { mx: pl0.mx * fv * fv, my: pl0.my * fv * fv, u: pl0.u * fv ** 4 }, pd = ES_DIM.gamaF * (pn.g + pn.q), ps = pn.g + ES_DIM.psi2 * pn.q;
  const fcd = C.fcd * kPa, fyd = C.fyd * kPa, AsMin = 0.67 * (ES_DIM.rhoMin[P.fck] || 0.15) / 100 * h;
  r.dir = [];
  [[pl.mx, 0], [pl.my, 1]].forEach(([m, k]) => {
    const Md = pd * m, d = h - c - 0.005 - k * 0.008, kk = Md / (0.425 * 1 * d * d * fcd);
    if (kk >= 1) { r.ok = false; r.motivos.push("flexão: a laje não resiste (aumente a espessura)"); r.dir.push({ Md }); return; }
    const x = 1.25 * d * (1 - Math.sqrt(1 - kk)), As = Math.max(Md / (fyd * (d - 0.4 * x)), AsMin), arm = esArmaduraLaje(As, h);
    if (x / d > ES_DIM.xdMax) { r.ok = false; r.motivos.push("flexão: x/d > 0,45"); }
    if (!arm) { r.ok = false; r.motivos.push("armadura não cabe"); }
    r.dir.push({ Md, d, As, arm });
  });
  // flecha: Branson na faixa de 1 m da direção principal
  const d0 = r.dir[0].d || h - c - 0.005, As0 = r.dir[0].arm ? r.dir[0].arm.areaM : AsMin, Ic = h ** 3 / 12, Mr = 1.5 * C.fctm * kPa * Ic / (h / 2), Ma = ps * Math.max(pl.mx, pl.my);
  const II = esLinhaNeutraII(1, h, 1, As0, d0, ES_DIM.Es / C.Ecs), Ie = Ma <= Mr ? Ic : Math.min(Ic, (Mr / Ma) ** 3 * Ic + (1 - (Mr / Ma) ** 3) * II.I);
  const D = C.Ecs * kPa * Ie / (1 - ES_LAJE.nu ** 2), fi = ps * pl.u / D;
  r.flecha = { total: fi * (1 + ES_DIM.alfaF), lim: (pn.vao || 1) / ES_DIM.flechaTotal };
  if (r.flecha.total > r.flecha.lim) { r.ok = false; r.motivos.push(`flecha ${(Math.ceil(r.flecha.total * 1000) / 10).toFixed(1).replace(".", ",")} cm > ${(Math.floor(r.flecha.lim * 1000) / 10).toFixed(1).replace(".", ",")} cm`); }
  r.aco = {}; for (const dd of r.dir) if (dd.arm) r.aco[dd.arm.d] = (r.aco[dd.arm.d] || 0) + pn.area / dd.arm.s * 1.1 * esKgBarra(dd.arm.d);
  return r;
}
// faixa de 1 m de laje maciça (h, d) para o momento Md (kN·m/m): As e barras
function esFaixaLaje(Md, h, d, C, AsMin) {
  const fcd = C.fcd * 1000, fyd = C.fyd * 1000, k = Md / (0.425 * d * d * fcd);
  if (k >= 1) return null;
  const x = 1.25 * d * (1 - Math.sqrt(1 - k)), As = Math.max(Md / (fyd * (d - 0.4 * x)), AsMin);
  return { x, xd: x / d, As, arm: esArmaduraLaje(As, h) };
}
// LAJE EM BALANÇO (critério 9; NBR 6118, 13.2.4.1): espessura ≥ 10 cm e
// γn = 1,95 − 0,05h (h < 19 cm, Tabela 13.2) nos esforços; trabalha engastada
// na laje vizinha. Pré-fabricada em balanço: o engenheiro maciça a faixa do
// beiral (mesma altura total), com a negativa ancorada na laje de dentro.
// Flecha: ℓ/250 com o vão equivalente 2ℓ (Tabela 13.3, nota).
const ES_BALANCO = { hMin: 0.10, borda: 0 }; // carga na ponta (kN/m): platibanda/guarda-corpo, se houver
function esDimLajeBalanco(pn, params) {
  const P = { ...ES_PADRAO, ...(params || {}) }, C = esConcreto(P.fck), kPa = 1000, h = pn.esp, l = pn.lBalanco || 0.5;
  const r = { tipo: pn.tipo, balanco: true, l, h, ok: true, motivos: [], macicar: pn.tipo !== "macica" };
  const g = pn.pre ? pn.g - pn.pre.pp + ES_CARGAS.pesos.concretoArmado * h : pn.g, q = pn.q;
  const hcm = Math.round(h * 100), gn = hcm < 19 ? Math.round((1.95 - 0.05 * hcm) * 100) / 100 : 1; r.gn = gn;
  if (h < ES_BALANCO.hMin - 1e-9) { r.ok = false; r.motivos.push(`balanço com ${hcm} cm: a norma pede no mínimo 10 cm (13.2.4.1)`); }
  const c = ES_NBR.cobrimento.laje[P.caa] / 1000, d = h - c - 0.005;
  r.Md = gn * ES_DIM.gamaF * ((g + q) * l * l / 2 + ES_BALANCO.borda * l);
  const f = esFaixaLaje(r.Md, h, d, C, (ES_DIM.rhoMin[P.fck] || 0.15) / 100 * h);
  if (!f || !f.arm) { r.ok = false; r.motivos.push("flexão do balanço: a laje não resiste (aumente a espessura)"); return r; }
  if (f.xd > ES_DIM.xdMax) { r.ok = false; r.motivos.push("flexão do balanço: x/d > 0,45"); }
  r.As = f.As; r.arm = f.arm;
  // a negativa entra na laje de dentro pelo menos o comprimento do balanço e a ancoragem
  r.ancoragem = Math.max(l, 0.5, 40 * f.arm.d / 1000);
  const Ic = h ** 3 / 12, Mr = 1.5 * C.fctm * kPa * Ic / (h / 2), ps = g + ES_DIM.psi2 * q, Ma = ps * l * l / 2;
  const II = esLinhaNeutraII(1, h, 1, f.arm.areaM, d, ES_DIM.Es / C.Ecs), Ie = Ma <= Mr ? Ic : Math.min(Ic, (Mr / Ma) ** 3 * Ic + (1 - (Mr / Ma) ** 3) * II.I);
  const fi = ps * l ** 4 / (8 * C.Ecs * kPa * Ie);
  r.flecha = { total: fi * (1 + ES_DIM.alfaF), lim: 2 * l / ES_DIM.flechaTotal };
  if (r.flecha.total > r.flecha.lim) { r.ok = false; r.motivos.push(`flecha do balanço ${(Math.ceil(r.flecha.total * 1000) / 10).toFixed(1).replace(".", ",")} cm > ${(Math.floor(r.flecha.lim * 1000) / 10).toFixed(1).replace(".", ",")} cm`); }
  // aço: barras ao longo do balanço (borda ≈ área / ℓ) + distribuição φ5 c/20
  const borda = pn.area / Math.max(0.2, l), comp = l + r.ancoragem + 0.10;
  r.aco = { [f.arm.d]: borda / f.arm.s * comp * esKgBarra(f.arm.d) };
  r.aco[5] = (r.aco[5] || 0) + (l / 0.20 + 1) * borda * esKgBarra(5);
  return r;
}
// ESCADA: laje inclinada bi-apoiada (vão em planta), faixa de 1 m
// espessura: a menor (de 1 em 1 cm, a partir de 12) que passa — a carga
// própria acompanha a espessura
function esDimEscada(e, params) {
  let ult = null;
  for (let hcm = Math.round(ES_ESCADA.h * 100); hcm <= 22; hcm++) {
    const h = hcm / 100, dg = ES_CARGAS.pesos.concretoArmado * (h - ES_ESCADA.h) / (e.cos || 1);
    ult = esDimEscadaH({ ...e, g: e.g + dg }, params, h); if (ult.ok) return ult;
  }
  return ult;
}
function esDimEscadaH(e, params, h) {
  // (e.esp: espelho; e.A: área em planta)
  const P = { ...ES_PADRAO, ...(params || {}) }, C = esConcreto(P.fck), kPa = 1000, c = ES_NBR.cobrimento.laje[P.caa] / 1000, d = h - c - 0.005, l = e.l;
  const r = { l, h, ok: true, motivos: [], g: e.g, q: e.q, viga: e.viga };
  r.Md = ES_DIM.gamaF * (e.g + e.q) * l * l / 8;
  const f = esFaixaLaje(r.Md, h, d, C, (ES_DIM.rhoMin[P.fck] || 0.15) / 100 * h);
  if (!f || !f.arm) { r.ok = false; r.motivos.push(`escada: a laje de ${Math.round(h * 100)} cm não resiste (ponha viga no patamar)`); return r; }
  r.arm = f.arm;
  const Ic = h ** 3 / 12, Mr = 1.5 * C.fctm * kPa * Ic / (h / 2), ps = e.g + ES_DIM.psi2 * e.q, Ma = ps * l * l / 8;
  const II = esLinhaNeutraII(1, h, 1, f.arm.areaM, d, ES_DIM.Es / C.Ecs), Ie = Ma <= Mr ? Ic : Math.min(Ic, (Mr / Ma) ** 3 * Ic + (1 - (Mr / Ma) ** 3) * II.I);
  const fi = 5 * ps * l ** 4 / (384 * C.Ecs * kPa * Ie);
  r.flecha = { total: fi * (1 + ES_DIM.alfaF), lim: l / ES_DIM.flechaTotal };
  if (r.flecha.total > r.flecha.lim) { r.ok = false; r.motivos.push(`escada: flecha acima de ℓ/250 mesmo com ${Math.round(h * 100)} cm (ponha viga no patamar)`); }
  const larg = e.A / Math.max(0.5, l);
  r.concreto = e.A * (h / (e.cos || 1) + (e.esp || 0.175) / 2); // laje inclinada + degraus
  r.aco = { [f.arm.d]: larg / f.arm.s * (l / (e.cos || 1) + 0.4) * esKgBarra(f.arm.d), 5: (l / (e.cos || 1) / 0.20 + 1) * larg * esKgBarra(5) };
  return r;
}
// NEGATIVA ENTRE PAINÉIS DE LAJE MACIÇA (14.7.6.2): cada painel engastado na
// viga comum dá M = k·p·ℓ²/12 (k = parte da carga na direção perpendicular à
// viga: ℓy⁴/(ℓx⁴+ℓy⁴) em duas direções); o momento do apoio é o maior entre
// 0,8 do maior e a média dos dois. Positivo segue o de placa apoiada (a favor).
function esNegativasLaje(paineis, vigasPav, params) {
  const P = { ...ES_PADRAO, ...(params || {}) }, C = esConcreto(P.fck), r = [];
  const porViga = new Map();
  paineis.forEach((pn) => { if (pn.tipo !== "macica" || pn.balanco || !pn.lU || !pn.lV) return; for (const [id, A] of pn.vigaIds || []) if (A > 0.05) { if (!porViga.has(id)) porViga.set(id, []); porViga.get(id).push(pn); } });
  for (const [id, ps] of porViga) {
    if (ps.length < 2) continue;
    const v = vigasPav.find((x) => x.id === id); if (!v) continue;
    const L = esDist(v.a, v.b), u = { x: (v.b.x - v.a.x) / L, y: (v.b.y - v.a.y) / L };
    const Ms = ps.slice(0, 2).map((pn) => {
      const paraleloV = Math.abs(u.x * pn.V.x + u.y * pn.V.y) > 0.7, lp = paraleloV ? pn.lU : pn.lV, lo = paraleloV ? pn.lV : pn.lU;
      const k = pn.duas ? lo ** 4 / (lp ** 4 + lo ** 4) : (lp <= lo ? 1 : 0);
      return { M: k * ES_DIM.gamaF * (pn.g + pn.q) * lp * lp / 12, lp, h: pn.esp };
    });
    const Mmax = Math.max(Ms[0].M, Ms[1].M), Md = Math.max(0.8 * Mmax, (Ms[0].M + Ms[1].M) / 2), h = Math.min(Ms[0].h, Ms[1].h);
    const c = ES_NBR.cobrimento.laje[P.caa] / 1000, f = esFaixaLaje(Md, h, h - c - 0.005, C, (ES_DIM.rhoMin[P.fck] || 0.15) / 100 * h);
    const ext = 0.25 * Math.max(Ms[0].lp, Ms[1].lp);
    const item = { viga: id, L, Md, ok: !!(f && f.arm), arm: f ? f.arm : null, extensao: ext };
    if (item.arm) item.aco = { [item.arm.d]: L / item.arm.s * (2 * ext + 0.2) * esKgBarra(item.arm.d) };
    r.push(item);
  }
  return r;
}
function esDimLaje(pn, params) {
  if (pn.area < 1 || (!pn.vao && !pn.balanco)) return null; // sobra pequena de laje além da viga
  if (pn.tipo === "trelicada" || pn.tipo === "protendida") {
    if (pn.balanco) return esDimLajeBalanco(pn, params);
    const r = esDimLajePre(pn, params);
    if (pn.tipo === "trelicada") {
      if (!r.ok) for (const he of [0.08, 0.12, 0.16, 0.20, 0.25]) { if (he <= pn.pre.he + 1e-9) continue; const t = esDimLajePre(pn, params, he); if (t.ok) { r.heSugerido = he; break; } }
      if (r.adicional) { const nNerv = pn.area / (r.i * r.l); r.aco = { [r.adicional.d]: nNerv * r.adicional.n * (r.l + 0.2) * esKgBarra(r.adicional.d) }; }
    }
    return r;
  }
  if (pn.tipo === "macica") return esDimLajeMacica(pn, params);
  return null;
}

// ═══════════════════════════════════════════════════════════════
// CÁLCULO COMPLETO: lança, desce cargas, dimensiona e ajusta as vigas
// ═══════════════════════════════════════════════════════════════
// Viga que não passa vai para a menor altura que passa (como o engenheiro
// faria antes de mudar a concepção) e o cálculo é refeito com o novo peso
// próprio e a nova rigidez. A altura nova passa pela verificação de
// compatibilização (fundo da viga × porta/janela embaixo).
// ═══════════════════════════════════════════════════════════════
// COMPATIBILIZAÇÃO AUTOMÁTICA — o que o engenheiro resolve antes de entregar
// ═══════════════════════════════════════════════════════════════
// Para cada viga, olha o que está embaixo e em volta e resolve na ordem do
// que menos mexe na arquitetura:
// 1) porta/janela embaixo e a viga invade o vão: baixa a viga até caber
//    (se o cálculo ainda passa); senão, inverte a viga (ela sobe dentro da
//    parede de cima, se houver parede sem porta ali);
// 2) viga sobre os degraus da escada com altura livre menor que a mínima:
//    inverte (mesma condição);
// 3) viga de piso (sob parede de cima sem parede embaixo): invertida sempre
//    que der — some do teto de baixo.
// Viga invertida: o fundo fica no fundo da laje e o topo sobe h − e.
// APOIO INDIRETO (viga apoiada em viga, sem pilar no encontro): a armadura de
// baixo da viga apoiada tem de passar por cima da armadura de baixo da que
// recebe, e a carga sobe pela armadura de suspensão (NBR 6118, 18.3.6). Por
// isso a viga que recebe nunca pode ter o fundo mais alto que a apoiada (o
// "dente" para baixo no encontro) e não pode ser invertida se a apoiada não
// for: a apoiada ficaria pendurada abaixo dela, presa só pela espessura da laje.
function esApoiosIndiretos(est) {
  const vs = (est.vigas || []).filter((v) => !v.baldrame), r = [];
  for (const v of vs) for (const q of [v.a, v.b]) {
    if ((est.pilares || []).some((p) => esDist(p.no, q) <= 0.3)) continue;
    for (const o of vs) if (o !== v && esPontoNoSeg(q, o.a, o.b).d < 0.06 && !(esDist(o.a, q) < 0.05 && esDist(o.b, v.a) + esDist(o.b, v.b) > 0 && esColinear(o, v))) r.push({ apoiada: v, apoio: o, q });
  }
  return r;
}
function esColinear(o, v) {
  const L1 = esDist(o.a, o.b), L2 = esDist(v.a, v.b); if (!L1 || !L2) return false;
  return Math.abs(((o.b.x - o.a.x) * (v.b.x - v.a.x) + (o.b.y - o.a.y) * (v.b.y - v.a.y)) / (L1 * L2)) > 0.996;
}
const esFundo = (v) => (v.topo != null ? v.topo : 2.8) - v.h;
function esCompatibilizar(pavs, lanc, desc, params) {
  const P = { ...ES_PADRAO, ...(params || {}) }, acoes = [];
  const espLaje = (k, q) => {
    for (const a of pavs[k].areas || []) if (a.tipo === "laje" && a.pts && a.pts.length >= 3 && esDentroPoli(q, a.pts)) { const c = esCargaLaje(a, pavs[k].usoPadrao); return c.pre ? c.pre.hTotal : (a.esp || P.lajeEsp); }
    return P.lajeEsp;
  };
  // paredes do pavimento de cima em cima da viga e o que elas têm de vão
  const paredesAcima = (k, v) => {
    if (k + 1 >= pavs.length) return null;
    const L = esDist(v.a, v.b); if (L < 0.05) return null;
    const ux = (v.b.x - v.a.x) / L, uy = (v.b.y - v.a.y) / L; let coberto = 0; const vaos = [];
    for (const w of pavs[k + 1].paredes || []) {
      const Lw = esLen(w); if (Lw < 0.05) continue;
      const wx = (w.b.x - w.a.x) / Lw, wy = (w.b.y - w.a.y) / Lw; if (Math.abs(ux * wx + uy * wy) < 0.996) continue;
      if (Math.abs((w.a.x - v.a.x) * -uy + (w.a.y - v.a.y) * ux) > ((w.t || 0) + v.b_) / 2 + 0.02) continue;
      const sa = (w.a.x - v.a.x) * ux + (w.a.y - v.a.y) * uy, sb = (w.b.x - v.a.x) * ux + (w.b.y - v.a.y) * uy;
      const ov = Math.min(L, Math.max(sa, sb)) - Math.max(0, Math.min(sa, sb)); if (ov <= 0.01) continue;
      coberto += ov;
      for (const o of w.ab || []) { const c0 = sa + (sb >= sa ? 1 : -1) * o.x, a0 = c0 - o.larg / 2, b0 = c0 + o.larg / 2; if (b0 > 0 && a0 < L) vaos.push(o); }
    }
    return { cobre: coberto / L, vaos };
  };
  const recebeNormal = (k, v, invertendo) => esApoiosIndiretos(lanc[k]).some((x) => x.apoio === v && !x.apoiada.invertida && !(invertendo && invertendo.has(x.apoiada)));
  const podeInverter = (k, v, invertendo) => {
    if (recebeNormal(k, v, invertendo)) return false; // a apoiada ficaria pendurada embaixo dela
    const pa = paredesAcima(k, v); if (!pa || pa.cobre < 0.95) return false;
    const sobe = v.h - espLaje(k, { x: (v.a.x + v.b.x) / 2, y: (v.a.y + v.b.y) / 2 });
    return !pa.vaos.some((o) => (o.peit || 0) < sobe + 0.02); // porta ou janela baixa em cima: não dá
  };
  const inverter = (k, v, motivo) => {
    if (v.invertida) return;
    const e = espLaje(k, { x: (v.a.x + v.b.x) / 2, y: (v.a.y + v.b.y) / 2 });
    v.topo = esR3((v.topo || 2.8) - e + v.h); v.invertida = true;
    acoes.push({ k, id: v.id, tipo: "invertida", texto: `${v.id} invertida (${motivo}): sobe ${Math.round((v.h - e) * 100)} cm dentro da parede de cima.` });
  };
  lanc.forEach((est, k) => {
    const tramoDe = (id) => (desc.pavimentos[k].tramos || []).find((t) => t.ids.includes(id));
    for (const v of est.vigas) {
      if (v.baldrame || v.cinta) continue;
      // 1) porta/janela embaixo
      if (v.parede != null && (pavs[k].paredes || [])[v.parede]) {
        const w = pavs[k].paredes[v.parede]; let topoVao = 0, qual = null;
        for (const o of w.ab || []) { if (o.x + o.larg / 2 < v.s0 || o.x - o.larg / 2 > v.s1) continue; const tv = (o.peit || 0) + (o.alt || 0); if (tv > topoVao) { topoVao = tv; qual = o; } }
        const fundo = (v.topo || 2.8) - v.h;
        if (qual && topoVao > fundo + 0.005) {
          const disp = Math.floor(((v.topo || 2.8) - topoVao) * 20 + 1e-9) / 20, t = tramoDe(v.id), nome = (qual.tipo || "").startsWith("porta") ? "porta" : "janela";
          // não pode ficar com o fundo acima do fundo das vigas que apoiam nela
          const hApoiadas = esApoiosIndiretos(est).filter((x) => x.apoio === v && !x.apoiada.invertida).reduce((m, x) => Math.max(m, (v.topo || 2.8) - esFundo(x.apoiada)), 0);
          const r = t && !v.hFixo && disp >= 0.25 && disp >= hApoiadas - 1e-6 ? esDimViga(t, params, disp) : null;
          if (r && r.ok) { acoes.push({ k, id: v.id, tipo: "altura", texto: `${v.id} baixada de ${Math.round(v.h * 100)} para ${Math.round(disp * 100)} cm para não invadir a ${nome} (o cálculo passa).` }); v.h = disp; }
          else if (podeInverter(k, v)) inverter(k, v, `não cabe acima da ${nome}`);
          else acoes.push({ k, id: v.id, tipo: "pendente", texto: `${v.id} não cabe acima da ${nome} e não dá para inverter: suba o vão da ${nome} até ${String((fundo).toFixed(2)).replace(".", ",")} m ou mude a viga.` });
        }
      }
    }
    // 3) vigas de piso: invertidas quando a parede de cima permite e nenhuma
    // viga normal se apoia nelas (decide o conjunto junto: VP sobre VP pode)
    let cand = new Set(est.vigas.filter((v) => v.vigaPiso && !v.invertida && !v.baldrame && !v.cinta && podeInverter(k, v, new Set(est.vigas.filter((x) => x.vigaPiso)))));
    for (let it = 0; it < 10; it++) { const n = new Set([...cand].filter((v) => podeInverter(k, v, cand))); if (n.size === cand.size) break; cand = n; }
    for (const v of est.vigas.filter((x) => x.vigaPiso && !x.invertida && !x.baldrame && !x.cinta)) {
      if (cand.has(v)) inverter(k, v, "some do teto de baixo");
      else if (podeInverter(k, v, new Set(est.vigas.filter((x) => x.vigaPiso))) || (paredesAcima(k, v) || {}).cobre >= 0.95 && recebeNormal(k, v)) {
        const quem = esApoiosIndiretos(est).filter((x) => x.apoio === v && !x.apoiada.invertida && !cand.has(x.apoiada)).map((x) => x.apoiada.id);
        if (quem.length) acoes.push({ k, id: v.id, tipo: "mantida", texto: `${v.id} não foi invertida: recebe a ${[...new Set(quem)].join(", ")}, que ficaria pendurada embaixo dela (apoio indireto, NBR 6118 18.3.6).` });
      }
    }
    // 2) altura livre sobre a escada
    for (const x of esAlturaLivreEscada(est, pavs[k].escadas || [])) {
      const v = est.vigas.find((y) => y.id === x.viga); if (!v || v.invertida) continue;
      if (podeInverter(k, v)) inverter(k, v, "altura livre da escada");
      else acoes.push({ k, id: v.id, tipo: "pendente", texto: `${v.id} passa a ${String(x.livre.toFixed(2)).replace(".", ",")} m do degrau e não dá para inverter: mude a viga ou aumente o furo da escada.` });
    }
  });
  return acoes;
}
function esCalcularEstrutura(pavs, params) {
  const P = { ...ES_PADRAO, ...(params || {}) }, lanc = esLancarPavimentos(pavs, params), ajustes = [], igualadas = [];
  let desc = null, dim = null;
  // critério 12: trecho sem laje, sem parede em cima e sem viga apoiada nele
  // (muro, jardineira, parede de varanda sem cobertura) vira cinta de amarração
  desc = esDescidaCargas(pavs, lanc, params);
  desc.pavimentos.forEach((pv, k) => {
    for (const t of pv.tramos) {
      if (t.baldrame || t.comLaje || t.comParede || t.apoiaOutra || t.especial) continue;
      for (const v of lanc[k].vigas) if (t.ids.includes(v.id) && !v.hFixo) { v.h = P.cinta; v.cinta = true; }
    }
  });
  for (let it = 0; it < 4; it++) {
    desc = esDescidaCargas(pavs, lanc, params); dim = esDimensionar(pavs, lanc, desc, params);
    let mudou = false;
    dim.pavimentos.forEach((p, k) => {
      for (const v of lanc[k].vigas) {
        const r = p.vigas[v.id]; if (!r || r.ok || !r.hMin || r.hMin <= v.h + 1e-9 || v.hFixo) continue;
        if (!ajustes.some((a) => a.k === k && a.id === v.id)) ajustes.push({ k, id: v.id, de: v.h, para: r.hMin, cinta: !!v.cinta });
        else ajustes.find((a) => a.k === k && a.id === v.id).para = r.hMin;
        v.h = r.hMin; v.hPeloCalculo = true; mudou = true;
      }
      // apoio indireto: a viga que recebe desce até o fundo da apoiada (sem dente)
      for (const { apoiada, apoio } of esApoiosIndiretos(lanc[k])) {
        if (apoiada.invertida || apoio.invertida || apoio.hFixo || esFundo(apoiada) >= esFundo(apoio) - 0.005) continue;
        const h = Math.ceil(((apoio.topo != null ? apoio.topo : 2.8) - esFundo(apoiada)) * 20 - 1e-6) / 20;
        if (h <= apoio.h + 1e-9) continue;
        const aj = ajustes.find((a) => a.k === k && a.id === apoio.id);
        if (!aj) ajustes.push({ k, id: apoio.id, de: apoio.h, para: h, igualada: apoiada.id }); else { aj.para = h; aj.igualada = apoiada.id; }
        if (!igualadas.some((x) => x.k === k && x.id === apoio.id)) igualadas.push({ k, id: apoio.id, tipo: "igualada", de: apoio.h, apoiada: apoiada.id });
        const g = igualadas.find((x) => x.k === k && x.id === apoio.id); g.para = h; g.apoiada = apoiada.id;
        apoio.h = h; mudou = true;
      }
    });
    if (!mudou) break;
  }
  // compatibilização com a arquitetura (baixar, inverter) e cálculo de novo
  const compat = esCompatibilizar(pavs, lanc, desc, params);
  if (compat.some((a) => a.tipo !== "pendente")) { desc = esDescidaCargas(pavs, lanc, params); dim = esDimensionar(pavs, lanc, desc, params); }
  const doLanc = lanc.flatMap((e) => e.resolvidos || []);
  const txtIg = igualadas.map((g) => ({ k: g.k, id: g.id, tipo: "igualada", texto: `${g.id} passou de ${Math.round(g.de * 100)} para ${Math.round(g.para * 100)} cm para receber a ${g.apoiada} sem dente embaixo (a armadura da ${g.apoiada} passa por cima da dela).` }));
  return { lanc, desc, dim, ajustes, compat: [...doLanc, ...txtIg, ...compat, ...(dim.compatFundacao || [])] };
}

// ═══════════════════════════════════════════════════════════════
// PARA O ORÇAMENTO DE OBRA (orcamento-obra.jsx): metros de barra por bitola
// e m³ de concreto por grupo, nos campos que o orçamento já lê
// ═══════════════════════════════════════════════════════════════
const ES_BITOLA_ORC = { 5: "CA60_5MM", 6.3: "CA50_6MM", 8: "CA50_8MM", 10: "CA50_10MM", 12.5: "CA50_12MM", 16: "CA50_16MM", 20: "CA50_20MM", 25: "CA50_25MM" };
function esParaOrcamento(pavs, calc) {
  const { lanc, dim } = calc, vazio = () => ({}), grupos = { colunasTerreo: vazio(), colunasPav1: vazio(), vigasTerreo: vazio(), vigasPav1: vazio(), baldrames: vazio() };
  const conc = { colunasTerreo: 0, colunasPav1: 0, vigasTerreo: 0, vigasPav1: 0, baldrames: 0 }, cont = { terreo: { 15: 0, 20: 0, 30: 0, forma: 0 }, pav1: { 15: 0, 20: 0, 30: 0, forma: 0 } };
  const foraCatalogo = new Set();
  const somaM = (g, aco) => { for (const [d, kg] of Object.entries(aco || {})) { const k = ES_BITOLA_ORC[+d]; if (!k) { foraCatalogo.add(+d); continue; } g[k] = (g[k] || 0) + kg / esKgBarra(+d); } };
  dim.pavimentos.forEach((p, k) => {
    const gc = k === 0 ? "colunasTerreo" : "colunasPav1", gv = k === 0 ? "vigasTerreo" : "vigasPav1", ct = k === 0 ? cont.terreo : cont.pav1;
    const vistos = new Set();
    for (const v of lanc[k].vigas) {
      const r = p.vigas[v.id], L = esDist(v.a, v.b);
      if (v.baldrame) conc.baldrames += v.b_ * v.h * L; else conc[gv] += v.b_ * v.h * L;
      if (r && !vistos.has(r.tramo)) { vistos.add(r.tramo); somaM(grupos[v.baldrame ? "baldrames" : gv], r.aco); }
    }
    for (const pl of lanc[k].pilares) {
      const H = (pl.topo != null ? pl.topo : 2.8) - (pl.base || 0), b = Math.min(pl.b, pl.h), hh = Math.max(pl.b, pl.h);
      conc[gc] += pl.b * pl.h * H; ct[b <= 0.165 ? 15 : b <= 0.225 ? 20 : 30]++;
      if (hh > 0.25) ct.forma += 2 * (pl.b + pl.h) * H;
      somaM(grupos[gc], (p.pilares[pl.id] || {}).aco);
    }
  });
  const r2 = (x) => Math.round(x * 100) / 100, arred = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, r2(v)]));
  return {
    colunasTerreo: { 15: cont.terreo[15], 20: cont.terreo[20], 30: cont.terreo[30], areaFormaMaior25cm: r2(cont.terreo.forma), concreto: r2(conc.colunasTerreo), ferro: arred(grupos.colunasTerreo) },
    colunasPav1: pavs.length > 1 ? { 15: cont.pav1[15], 20: cont.pav1[20], 30: cont.pav1[30], areaFormaMaior25cm: r2(cont.pav1.forma), concreto: r2(conc.colunasPav1), ferro: arred(grupos.colunasPav1) } : null,
    vigaRespaldoTerreo: { concreto: r2(conc.vigasTerreo), ferro: arred(grupos.vigasTerreo) },
    vigaRespaldoPav1: pavs.length > 1 ? { concreto: r2(conc.vigasPav1), ferro: arred(grupos.vigasPav1) } : null,
    baldrames: { concreto: r2(conc.baldrames), ferro: arred(grupos.baldrames) },
    fundacao: (() => {
      const fs = dim.fundacao || [], est = fs.filter((f) => f.tipo !== "sapata"), g = { estacas: {}, blocos: {} };
      // aço de cada fundação separado: estaca (ligação + estribo), bloco/sapata (o resto), arranque
      const arr = {};
      for (const f of fs) {
        const a = { ...f.aco };
        if (f.estacaArm) { const A = f.estacaArm, n = f.n; const kgL = n * A.n * (A.comp + 0.3) * esKgBarra(A.d), kgE = n * (A.comp / A.s + 1) * (Math.PI * (f.D - 0.10) + 0.10) * esKgBarra(A.estribo);
          somaM(g.estacas, { [A.d]: kgL, [A.estribo]: kgE }); a[A.d] -= kgL; a[A.estribo] -= kgE; }
        if (f.arranque) { const b = f.arranque, hb = (f.bloco || f.sapata || { h: f.hBloco || 0.4 }).h, kg = b.n * (hb - ES_FUND.cobrimento + 0.20 + 40 * b.d / 1000) * esKgBarra(b.d); somaM(arr, { [b.d]: kg }); a[b.d] -= kg; }
        somaM(g.blocos, Object.fromEntries(Object.entries(a).filter(([, kg]) => kg > 1e-6)));
      }
      return { tipo: fs[0] ? fs[0].tipo : null, qtdEstacas: est.reduce((t, f) => t + (f.n || 0), 0), profEstacas: est[0] ? est[0].L : 0, diametro: est[0] ? est[0].D : 0,
        estimado: fs.some((f) => f.estimado),
        concreto: { estacas: r2(fs.reduce((t, f) => t + f.concreto.estacas, 0)), sapatas: r2(fs.reduce((t, f) => t + f.concreto.blocos + f.concreto.sapatas, 0)) },
        ferro: { estacas: arred(g.estacas), sapatas: arred(g.blocos), arranques: arred(arr) } };
    })(),
    foraCatalogo: [...foraCatalogo],
  };
}

// ═══════════════════════════════════════════════════════════════
// RESUMO DE MATERIAIS: barras por bitola e concreto, por elemento
// ═══════════════════════════════════════════════════════════════
// Barras de 12 m com 10% de perda, arredondadas para cima — a mesma conta do
// orçamento de obra (orcamento-obra.jsx: teto(m ÷ 12 × 1,10)).
const ES_BARRA = { m: 12, perda: 1.10 };
function esResumoMateriais(pavs, calc) {
  const { lanc, dim } = calc, grupos = [];
  const g = (nome) => { let x = grupos.find((y) => y.nome === nome); if (!x) { x = { nome, m: {}, concreto: 0 }; grupos.push(x); } return x; };
  const somaKg = (x, aco) => { for (const [d, kg] of Object.entries(aco || {})) if (kg > 1e-9) x.m[+d] = (x.m[+d] || 0) + kg / esKgBarra(+d); };
  // fundação: estacas, blocos/sapatas e arranques separados
  for (const f of dim.fundacao || []) {
    const a = { ...f.aco };
    if (f.estacaArm) { const A = f.estacaArm, kgL = f.n * A.n * (A.comp + 0.3) * esKgBarra(A.d), kgE = f.n * (A.comp / A.s + 1) * (Math.PI * (f.D - 0.10) + 0.10) * esKgBarra(A.estribo);
      somaKg(g("Estacas"), { [A.d]: kgL, [A.estribo]: kgE }); a[A.d] -= kgL; a[A.estribo] -= kgE; }
    if (f.arranque) { const b = f.arranque, hb = (f.bloco || f.sapata || { h: f.hBloco || 0.4 }).h, kg = b.n * (hb - ES_FUND.cobrimento + 0.20 + 40 * b.d / 1000) * esKgBarra(b.d); somaKg(g("Arranques"), { [b.d]: kg }); a[b.d] -= kg; }
    const gb = g(f.sapata ? "Sapatas" : "Blocos"); somaKg(gb, a); gb.concreto += f.concreto.blocos + f.concreto.sapatas;
    g("Estacas").concreto += f.concreto.estacas;
  }
  dim.pavimentos.forEach((p, k) => {
    const nome = (x) => pavs.length > 1 ? `${x} — ${pavs[k].nome || (k ? "Pavimento " + k : "Térreo")}` : x;
    const vistos = new Set();
    for (const v of lanc[k].vigas) {
      const L = esDist(v.a, v.b), gv = g(v.baldrame ? "Baldrames" : nome("Vigas"));
      gv.concreto += v.b_ * v.h * L;
      const r = p.vigas[v.id]; if (r && !vistos.has(r.tramo)) { vistos.add(r.tramo); somaKg(gv, r.aco); }
    }
    for (const pl of lanc[k].pilares) { const gp = g(nome("Pilares")); gp.concreto += pl.b * pl.h * ((pl.topo != null ? pl.topo : 2.8) - (pl.base || 0)); somaKg(gp, (p.pilares[pl.id] || {}).aco); }
    const gl = g(nome("Lajes"));
    for (const l of lanc[k].lajes || []) gl.concreto += esAreaPoli(l.pts) * (l.concretoM2 != null ? l.concretoM2 : l.esp);
    for (const r of p.lajes || []) if (r) somaKg(gl, r.aco);
    for (const n of p.negativas || []) somaKg(gl, n.aco);
    for (const e of p.escadas || []) { const ge = g(nome("Escada")); somaKg(ge, e.aco); ge.concreto += e.concreto || 0; }
  });
  const bitolas = [...new Set(grupos.flatMap((x) => Object.keys(x.m).map(Number)))].sort((a, b) => a - b);
  const barras = (m) => Math.ceil(m / ES_BARRA.m * ES_BARRA.perda - 1e-9);
  const total = {}; for (const x of grupos) for (const [d, m] of Object.entries(x.m)) total[d] = (total[d] || 0) + m;
  return {
    grupos: grupos.filter((x) => x.concreto > 1e-6 || Object.keys(x.m).length).map((x) => ({ ...x, barras: Object.fromEntries(Object.entries(x.m).map(([d, m]) => [d, barras(m)])) })),
    bitolas,
    aco: bitolas.map((d) => ({ d, aco: d <= 5 ? "CA-60" : "CA-50", m: total[d], barras: barras(total[d]), kg: barras(total[d]) * ES_BARRA.m * esKgBarra(d) })),
    concreto: grupos.reduce((t, x) => t + x.concreto, 0),
  };
}
