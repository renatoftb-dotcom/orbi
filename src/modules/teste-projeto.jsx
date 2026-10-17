// ═══════════════════════════════════════════════════════════════
// TESTE PROJETO — protótipo de traço de parede (planta + 3D + quantitativo)
// ═══════════════════════════════════════════════════════════════
// Módulo isolado de teste: não lê nem grava nada no backend. O usuário
// clica na planta para marcar pontos; cada trecho vira uma parede com
// espessura e altura. O 3D é desenhado com Three.js, carregado sob demanda
// do cdnjs (só quando a tela abre — não entra no bundle). Quantitativo
// simples: comprimento, área, blocos 14x19x39 (12,5/m² + 5%) e reboco 2 faces.

const TP_AZUL = "#0474f4";
const TP_MUNDO = 12;   // largura da planta em metros
const TP_GRADE = 0.5;  // snap
const tpFmt = (v, d = 2) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const tpLen = (w) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);

let _tpThreePromise = null;
function tpCarregarThree() {
  if (typeof window !== "undefined" && window.THREE) return Promise.resolve(window.THREE);
  if (_tpThreePromise) return _tpThreePromise;
  _tpThreePromise = new Promise((ok, erro) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    s.onload = () => ok(window.THREE);
    s.onerror = () => { _tpThreePromise = null; erro(new Error("Não foi possível carregar o 3D.")); };
    document.head.appendChild(s);
  });
  return _tpThreePromise;
}

// Campo numérico que só confirma ao sair do campo ou apertar Enter — assim
// cada edição vira um passo só no Desfazer. valor null = vários valores.
function TpCampo({ id, rotulo, valor, casas = 2, onConfirmar, min = 0, somenteLeitura }) {
  const fmt = (v) => (v == null || !isFinite(v) ? "" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }));
  const [txt, setTxt] = useState(fmt(valor));
  const foco = useRef(false);
  useEffect(() => { if (!foco.current) setTxt(fmt(valor)); }, [valor, casas]);
  const confirmar = () => {
    const t = String(txt).trim();
    const n = parseFloat(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
    if (isFinite(n) && n > min && (valor == null || Math.abs(n - valor) > 1e-9)) { onConfirmar(n); setTxt(fmt(n)); }
    else setTxt(fmt(valor));
  };
  return (
    <div style={{ minWidth: 0 }}>
      <label htmlFor={id} style={{ display: "block", fontSize: 12, color: "#4b5563", marginBottom: 4 }}>{rotulo}</label>
      <input id={id} inputMode="decimal" value={txt} placeholder={valor == null ? "vários" : ""} readOnly={somenteLeitura}
        onChange={(e) => setTxt(e.target.value)}
        onFocus={() => { foco.current = true; }}
        onBlur={() => { foco.current = false; if (!somenteLeitura) confirmar(); }}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setTxt(fmt(valor)); e.currentTarget.blur(); } }}
        style={{ width: "100%", boxSizing: "border-box", padding: "7px 8px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, fontVariantNumeric: "tabular-nums", fontFamily: "inherit", background: somenteLeitura ? "#f3f4f6" : "#fff", color: somenteLeitura ? "#4b5563" : "#111827" }} />
    </div>
  );
}

// Geometria de polígonos (contrapiso e laje)
const tpAreaPoli = (pts) => { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.y - b.x * a.y; } return Math.abs(s) / 2; };
const tpPerimPoli = (pts) => { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += Math.hypot(b.x - a.x, b.y - a.y); } return s; };
const tpCentro = (pts) => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });
function tpDentroPoli(p, pts) {
  let dentro = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if (((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) dentro = !dentro;
  }
  return dentro;
}
const TP_AREA_TIPOS = {
  contrapiso: { nome: "Contrapiso", esp: 0.05, cor3d: 0xcfc6b4 },
  laje: { nome: "Laje", esp: 0.10, cor3d: 0xbfc5cc },
  telhado: { nome: "Telhado", esp: 0, cor3d: 0xb5562f },
  terreno: { nome: "Terreno", esp: 0, cor3d: 0xcfe8c4 },
  ambiente: { nome: "Ambiente", esp: 0, cor3d: 0xffffff },
  separador: { nome: "Separador de ambiente", esp: 0, cor3d: 0xffffff },
};
const tpEhPoli = (f) => f === "contrapiso" || f === "laje" || f === "telhado" || f === "terreno";
// Área exata da união de polígonos (contorno simples): fatias verticais entre
// todos os x de vértices e cruzamentos de arestas; dentro de cada fatia o
// comprimento coberto varia linearmente, então largura × comprimento no meio.
function tpCruzaSeg(a, b, c, d) {
  const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y }, den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den, u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  return t > 0 && t < 1 && u > 0 && u < 1 ? { x: a.x + r.x * t, y: a.y + r.y * t } : null;
}
function tpUniaoArea(polys) {
  polys = (polys || []).filter((p) => p && p.length >= 3);
  if (!polys.length) return 0;
  const arestas = [];
  polys.forEach((P) => P.forEach((a, i) => arestas.push([a, P[(i + 1) % P.length]])));
  const xs = new Set();
  polys.forEach((P) => P.forEach((p) => xs.add(p.x)));
  for (let i = 0; i < arestas.length; i++) for (let j = i + 1; j < arestas.length; j++) { const q = tpCruzaSeg(arestas[i][0], arestas[i][1], arestas[j][0], arestas[j][1]); if (q) xs.add(q.x); }
  const X = [...xs].sort((a, b) => a - b);
  let area = 0;
  for (let k = 0; k + 1 < X.length; k++) {
    const x0 = X[k], x1 = X[k + 1]; if (x1 - x0 < 1e-9) continue;
    const xm = (x0 + x1) / 2, ints = [];
    for (const P of polys) {
      const ys = [];
      for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; if ((a.x <= xm && b.x > xm) || (b.x <= xm && a.x > xm)) ys.push(a.y + (xm - a.x) * (b.y - a.y) / (b.x - a.x)); }
      ys.sort((m, n) => m - n);
      for (let i = 0; i + 1 < ys.length; i += 2) ints.push([ys[i], ys[i + 1]]);
    }
    ints.sort((m, n) => m[0] - n[0]);
    let len = 0, cs = null, ce = null;
    for (const [s0, e0] of ints) { if (cs === null) { cs = s0; ce = e0; } else if (s0 <= ce) ce = Math.max(ce, e0); else { len += ce - cs; cs = s0; ce = e0; } }
    if (cs !== null) len += ce - cs;
    area += len * (x1 - x0);
  }
  return area;
}
// área de A dentro da união U: A + U − (A ∪ U)
const tpAreaDentro = (A, U) => (U.length ? Math.max(0, tpUniaoArea([A]) + tpUniaoArea(U) - tpUniaoArea([A, ...U])) : 0);

// Ambiente (como o "Ambiente" do Revit): clica dentro de um cômodo e o
// sistema acha o espaço fechado pelas paredes. Faz isso numa grade de 2 cm:
// marca as paredes como bloqueio, inunda a partir do clique e, se a mancha
// não escapar para fora, contorna as células e acerta os cantos nas faces
// das paredes. Devolve null (clicou em parede) ou { aberto: true }.
function tpDetectarAmbiente(paredes, p, separadores) {
  const ws = [...(paredes || []), ...(separadores || []).map((sp) => ({ ...sp, separador: true }))].filter((w) => tpLen(w) > 0);
  if (!ws.length) return { aberto: true };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const w of ws) for (const q of [w.a, w.b]) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
  const m = 0.6; x0 -= m; y0 -= m; x1 += m; y1 += m;
  if (p.x <= x0 || p.x >= x1 || p.y <= y0 || p.y >= y1) return { aberto: true };
  let passo = 0.02;
  while (((x1 - x0) / passo) * ((y1 - y0) / passo) > 3e6) passo *= 1.5;
  const W = Math.ceil((x1 - x0) / passo), H = Math.ceil((y1 - y0) / passo);
  const cel = new Uint8Array(W * H); // 1 = parede, 2 = ambiente
  const xs = [], ys = [];
  for (const w of ws) {
    // separador (linha sem parede, ex.: cozinha integrada) = barreira de 1,5 célula
    // As pontas do separador avançam 15 cm além do desenhado: a linha costuma
    // terminar na face de uma parede (ímã), e se ali houver outra linha no eixo
    // (vão fechado por separador) sobrava uma fresta de alguns cm e o cômodo
    // vazava para o vizinho só em certas posições.
    const L = tpLen(w), ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L, nx = -uy, ny = ux, h = w.separador ? passo * 0.75 : (w.t || 0) / 2, hl = L / 2 + (w.separador ? 0.15 : h);
    const cx = (w.a.x + w.b.x) / 2, cy = (w.a.y + w.b.y) / 2;
    const cantos = [[hl, h], [hl, -h], [-hl, h], [-hl, -h]].map(([a, b]) => ({ x: cx + ux * a + nx * b, y: cy + uy * a + ny * b }));
    const i0 = Math.max(0, Math.floor((Math.min(...cantos.map((q) => q.x)) - x0) / passo)), i1 = Math.min(W - 1, Math.ceil((Math.max(...cantos.map((q) => q.x)) - x0) / passo));
    const j0 = Math.max(0, Math.floor((Math.min(...cantos.map((q) => q.y)) - y0) / passo)), j1 = Math.min(H - 1, Math.ceil((Math.max(...cantos.map((q) => q.y)) - y0) / passo));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const qx = x0 + (i + 0.5) * passo - cx, qy = y0 + (j + 0.5) * passo - cy;
      if (Math.abs(qx * ux + qy * uy) <= hl && Math.abs(qx * nx + qy * ny) <= h) cel[j * W + i] = 1;
    }
    // faces das paredes alinhadas aos eixos, para acertar os cantos
    if (w.separador) { if (Math.abs(uy) < 1e-6) ys.push(cy); else if (Math.abs(ux) < 1e-6) xs.push(cx); continue; }
    if (Math.abs(uy) < 1e-6) { ys.push(cy + h, cy - h); xs.push(cx + hl, cx - hl); }
    else if (Math.abs(ux) < 1e-6) { xs.push(cx + h, cx - h); ys.push(cy + hl, cy - hl); }
  }
  const si = Math.floor((p.x - x0) / passo), sj = Math.floor((p.y - y0) / passo);
  if (cel[sj * W + si] === 1) return null;
  const pilha = [sj * W + si]; cel[sj * W + si] = 2;
  while (pilha.length) {
    const k = pilha.pop(), i = k % W, j = (k - i) / W;
    if (i === 0 || j === 0 || i === W - 1 || j === H - 1) return { aberto: true };
    for (const n of [k - 1, k + 1, k - W, k + W]) if (cel[n] === 0) { cel[n] = 2; pilha.push(n); }
  }
  // arestas da borda da mancha (sentido fixo), encadeadas em laços
  const prox = new Map(), chave = (i, j) => j * (W + 1) + i;
  const add = (a, b) => { const l = prox.get(a); if (l) l.push(b); else prox.set(a, [b]); };
  const dentro = (i, j) => i >= 0 && j >= 0 && i < W && j < H && cel[j * W + i] === 2;
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
    if (cel[j * W + i] !== 2) continue;
    if (!dentro(i, j - 1)) add(chave(i, j), chave(i + 1, j));
    if (!dentro(i + 1, j)) add(chave(i + 1, j), chave(i + 1, j + 1));
    if (!dentro(i, j + 1)) add(chave(i + 1, j + 1), chave(i, j + 1));
    if (!dentro(i - 1, j)) add(chave(i, j + 1), chave(i, j));
  }
  let melhor = null, maior = -1;
  while (prox.size) {
    const ini = prox.keys().next().value, laco = [];
    let at = ini, guarda = 0;
    do {
      laco.push(at);
      const l = prox.get(at); if (!l) break;
      const nx = l.pop(); if (!l.length) prox.delete(at);
      at = nx;
    } while (at !== ini && ++guarda < 1e6);
    const pts = laco.map((k) => ({ x: x0 + (k % (W + 1)) * passo, y: y0 + Math.floor(k / (W + 1)) * passo }));
    const ar = tpAreaPoli(pts);
    if (ar > maior) { maior = ar; melhor = pts; }
  }
  if (!melhor || melhor.length < 3) return { aberto: true };
  // tira os pontos alinhados (fica só a quina) e acerta nas faces das paredes
  const limpa = [];
  for (let k = 0; k < melhor.length; k++) {
    const a = melhor[(k - 1 + melhor.length) % melhor.length], b = melhor[k], c = melhor[(k + 1) % melhor.length];
    if (Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) > 1e-12) limpa.push(b);
  }
  const perto = (v, lista) => { let best = v, d = passo * 1.6; for (const c of lista) { const dd = Math.abs(c - v); if (dd < d) { d = dd; best = c; } } return best; };
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const pts = limpa.map((q) => ({ x: r3(perto(q.x, xs)), y: r3(perto(q.y, ys)) }));
  return { pts, area: tpAreaPoli(pts) };
}
// Numeração automática: dois ou mais ambientes com o mesmo nome viram
// "Suíte 01", "Suíte 02"... na ordem em que foram criados; sobrando um só,
// volta ao nome simples. Vale para qualquer nome (Quarto, WC, Varanda...).
function tpBaseNomeAmbiente(nome) { return String(nome || "Ambiente").replace(/\s+\d{1,3}$/, "").trim() || "Ambiente"; }
function tpNumerarAmbientes(areas) {
  const grupos = new Map();
  areas.forEach((a, i) => { if (a.tipo !== "ambiente") return; const b = tpBaseNomeAmbiente(a.nome), k = b.toLocaleLowerCase("pt-BR"); if (!grupos.has(k)) grupos.set(k, { base: b, idx: [] }); grupos.get(k).idx.push(i); });
  let mudou = false;
  const out = areas.slice();
  for (const { base, idx } of grupos.values()) idx.forEach((i, n) => {
    const nome = idx.length > 1 ? `${base} ${String(n + 1).padStart(2, "0")}` : base;
    if (out[i].nome !== nome) { out[i] = { ...out[i], nome }; mudou = true; }
  });
  return mudou ? out : areas;
}
const TP_NOMES_AMBIENTE = ["Sala", "Cozinha", "Suíte", "Quarto", "WC", "Banheiro", "Lavanderia", "Varanda", "Garagem", "Circulação", "Closet", "Escritório", "Área gourmet", "Despensa"];

// Interno × externo: área coberta = laje + telhado (contorno desenhado, sem o
// beiral). É a área construída. Contrapiso dentro dela é piso interno; fora,
// piso externo (calçada, área de serviço descoberta).
function tpAnaliseAreas(areas) {
  const ok = (a) => a.pts && a.pts.length >= 3;
  const cob = areas.filter((a) => ok(a) && (a.tipo === "laje" || a.tipo === "telhado")).map((a) => a.pts);
  const cps = areas.filter((a) => ok(a) && a.tipo === "contrapiso").map((a) => a.pts);
  const ter = areas.filter((a) => ok(a) && a.tipo === "terreno").map((a) => a.pts);
  const coberta = tpUniaoArea(cob);
  const pisoTotal = tpUniaoArea(cps);
  const pisoInterno = cob.length && cps.length ? Math.max(0, pisoTotal + coberta - tpUniaoArea([...cps, ...cob])) : 0;
  const terreno = tpUniaoArea(ter);
  const ocupada = tpUniaoArea([...cob, ...cps]);
  return { coberta, pisoInterno, pisoExterno: Math.max(0, pisoTotal - pisoInterno), terreno,
    taxaOcupacao: terreno ? coberta / terreno : 0, permeavel: terreno ? Math.max(0, terreno - ocupada) : 0, temCobertura: cob.length > 0 };
}

// ───────────── Telhado (como no Revit: contorno + inclinação por lado) ─────────────
// Cada lado do contorno define ou não inclinação (%). Lado inclinado = água;
// lado sem inclinação = oitão (empena). A superfície é o mínimo dos planos
// das águas: z(p) = nível + inclinação × distância até a linha do lado
// (positiva para dentro). Isso dá certo para contornos convexos — retângulo
// de 1, 2, 3 ou 4 águas, em L divide-se em dois telhados, como no Revit.
// O nível vale na linha do contorno desenhado; o beiral estende para fora
// e desce pela própria inclinação.
const TP_TELHAS = [
  { id: "Telha Barro Portuguesa", rotulo: "Cerâmica portuguesa", pct: 30, cor: 0xb5562f },
  { id: "Telha Barro Americana", rotulo: "Cerâmica americana", pct: 30, cor: 0xb5562f },
  { id: "Telha Americana Concreto", rotulo: "Concreto americana", pct: 30, cor: 0x8a8f96 },
  { id: "Telha Plana Concreto", rotulo: "Concreto plana", pct: 30, cor: 0x8a8f96 },
  { id: "Telha Fibrocimento 6mm", rotulo: "Fibrocimento 6 mm", pct: 15, cor: 0xb9bcb8 },
  { id: "Telha Fibrocimento 8mm", rotulo: "Fibrocimento 8 mm", pct: 15, cor: 0xb9bcb8 },
  { id: "Telha Metálica Termoacústica", rotulo: "Metálica termoacústica", pct: 10, cor: 0x9aa3ad },
  { id: "Telha Metálica Simples", rotulo: "Metálica simples", pct: 10, cor: 0x9aa3ad },
];
const tpTelha = (id) => TP_TELHAS.find((t) => t.id === id) || TP_TELHAS[0];
function tpConvexo(pts) {
  let sinal = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], c = pts[(i + 2) % pts.length];
    const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cr) < 1e-9) continue;
    const s = cr > 0 ? 1 : -1;
    if (!sinal) sinal = s; else if (s !== sinal) return false;
  }
  return true;
}
// recorta um polígono convexo pelo semiplano f(p) <= 0 (f linear)
function tpRecortar(pts, f) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], fa = f(a), fb = f(b);
    if (fa <= 1e-9) out.push(a);
    if ((fa < -1e-9 && fb > 1e-9) || (fa > 1e-9 && fb < -1e-9)) { const t = fa / (fa - fb); out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); }
  }
  return out;
}
function tpTelhadoGeo(t) {
  const pts = t.pts || [], n = pts.length, cota = t.cota || 0, beiral = Math.max(0, t.beiral || 0);
  const cen = tpCentro(pts);
  const lados = pts.map((a, k) => {
    const b = pts[(k + 1) % n], l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    let nx = -(b.y - a.y) / l, ny = (b.x - a.x) / l;
    if ((cen.x - a.x) * nx + (cen.y - a.y) * ny < 0) { nx = -nx; ny = -ny; } // normal para dentro
    const cfg = (t.lados || [])[k] || {};
    const inclina = cfg.inclina !== false;
    return { a, b, l, nx, ny, inclina, s: inclina ? Math.max(0, Number(cfg.pct != null ? cfg.pct : tpTelha(t.telha).pct)) / 100 : 0 };
  });
  const convexo = n >= 3 && tpConvexo(pts);
  // contorno com beiral: cada lado sai "beiral" para fora; vértices = cruzamento dos lados vizinhos
  let contorno = pts;
  if (convexo && beiral > 0) {
    contorno = lados.map((L, k) => {
      const P = lados[(k - 1 + n) % n];
      const p1 = { x: P.a.x - P.nx * beiral, y: P.a.y - P.ny * beiral }, d1 = { x: P.b.x - P.a.x, y: P.b.y - P.a.y };
      const p2 = { x: L.a.x - L.nx * beiral, y: L.a.y - L.ny * beiral }, d2 = { x: L.b.x - L.a.x, y: L.b.y - L.a.y };
      const den = d1.x * d2.y - d1.y * d2.x;
      if (Math.abs(den) < 1e-12) return p2;
      const u = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / den;
      return { x: p1.x + d1.x * u, y: p1.y + d1.y * u };
    });
  }
  const aguas = lados.map((L, k) => ({ ...L, k })).filter((L) => L.inclina && L.s > 0);
  const zDo = (L, p) => cota + L.s * ((p.x - L.a.x) * L.nx + (p.y - L.a.y) * L.ny);
  const z = (p) => (convexo && aguas.length ? Math.min(...aguas.map((L) => zDo(L, p))) : cota);
  let facetas = [];
  if (!convexo || !aguas.length) facetas = [{ pts: contorno, s: 0, k: -1 }];
  else for (const L of aguas) {
    let pol = contorno;
    for (const M of aguas) { if (M === L || pol.length < 3) continue; pol = tpRecortar(pol, (p) => zDo(L, p) - zDo(M, p)); }
    if (pol.length >= 3 && tpAreaPoli(pol) > 1e-6) facetas.push({ pts: pol, s: L.s, k: L.k });
  }
  const areaProjecao = tpAreaPoli(contorno);
  const areaReal = facetas.reduce((s, f) => s + tpAreaPoli(f.pts) * Math.sqrt(1 + f.s * f.s), 0);
  const cumeeira = Math.max(cota, ...facetas.flatMap((f) => f.pts.map(z)));
  return { lados, contorno, facetas, z, convexo, areaProjecao, areaReal, cumeeira, cota };
}

// ───────────── Desenho → dados do orçamento de obra ─────────────
// Traduz o que foi desenhado nos campos que o motor (orcamento-obra.jsx,
// normalizarProjeto) já lê. Só obra térrea por enquanto.
//  - parede externa: a que tem um dos lados fora da casa (fora de qualquer
//    contrapiso/laje; sem eles, fora do contorno convexo das paredes)
//  - m² de parede = comprimento do eixo × altura (bruto, sem descontar vãos)
//  - espessura: até 16,5 cm conta como 15; até 22,5 como 20; acima, 25
//  - perímetro de paredes = soma dos comprimentos (térreo)
//  - área construída = contrapiso (ou laje, se não houver contrapiso)
//  - telhado: comprimento × largura do retângulo que envolve o contorno com
//    beiral, nº de águas = lados inclinados, inclinação média em fração
function tpEnvoltoria(pts) {
  const P = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  if (P.length < 3) return P;
  const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo = [], hi = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of [...P].reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
function tpDesenhoParaObra(paredes, areas) {
  const r2 = (x) => Math.round(x * 100) / 100;
  // casa = área coberta (laje/telhado); sem cobertura, contrapiso; sem nada, envoltória das paredes
  const cobertos = areas.filter((a) => (a.tipo === "laje" || a.tipo === "telhado") && a.pts && a.pts.length >= 3);
  const pisos = cobertos.length ? cobertos : areas.filter((a) => a.tipo === "contrapiso" && a.pts && a.pts.length >= 3);
  const casco = tpEnvoltoria(paredes.flatMap((w) => [w.a, w.b]));
  const fora = (p) => (pisos.length ? !pisos.some((a) => tpDentroPoli(p, a.pts)) : !(casco.length >= 3 && tpDentroPoli(p, casco)));
  let m2Int = 0, m2Ext = 0, m15 = 0, m20 = 0, m25 = 0, perim = 0, nExt = 0;
  for (const w of paredes) {
    const L = tpLen(w); if (!L) continue;
    const m2 = L * (w.h || 0), nx = -(w.b.y - w.a.y) / L, ny = (w.b.x - w.a.x) / L, d = (w.t || 0) / 2 + 0.15;
    const mx = (w.a.x + w.b.x) / 2, my = (w.a.y + w.b.y) / 2;
    const externa = fora({ x: mx + nx * d, y: my + ny * d }) || fora({ x: mx - nx * d, y: my - ny * d });
    if (externa) { m2Ext += m2; nExt++; } else m2Int += m2;
    const cm = (w.t || 0) * 100;
    if (cm <= 16.5) m15 += m2; else if (cm <= 22.5) m20 += m2; else m25 += m2;
    perim += L;
  }
  const soma = (tipo, f) => areas.filter((a) => a.tipo === tipo && a.pts && a.pts.length >= 3).reduce((s, a) => s + f(a), 0);
  const areaCp = soma("contrapiso", (a) => tpAreaPoli(a.pts)), areaLj = soma("laje", (a) => tpAreaPoli(a.pts)), perLj = soma("laje", (a) => tpPerimPoli(a.pts));
  const an = tpAnaliseAreas(areas);
  const areaConstruida = an.temCobertura ? an.coberta : areaCp;
  const cobertura = areas.filter((a) => a.tipo === "telhado" && a.pts && a.pts.length >= 3).map((a) => {
    const g = tpTelhadoGeo(a), aguas = g.lados.filter((L) => L.inclina && L.s > 0);
    const maior = g.lados.reduce((m, L) => (L.l > m.l ? L : m), g.lados[0]);
    const ux = (maior.b.x - maior.a.x) / maior.l, uy = (maior.b.y - maior.a.y) / maior.l;
    const pu = g.contorno.map((q) => q.x * ux + q.y * uy), pn = g.contorno.map((q) => -q.x * uy + q.y * ux);
    return {
      tipo: tpTelha(a.telha).id,
      comprimento: r2(Math.max(...pu) - Math.min(...pu)),
      largura: r2(Math.max(...pn) - Math.min(...pn)),
      aguas: Math.min(4, aguas.length),
      inclinacao: aguas.length ? Math.round(aguas.reduce((s, L) => s + L.s, 0) / aguas.length * 100) / 100 : 0,
    };
  });
  const projeto = {
    tipologia: "Térrea",
    arquitetura: { areaConstruida: r2(areaConstruida), m2ParedesInternas: r2(m2Int), m2ParedesExternas: r2(m2Ext), m2ParedesTotal: r2(m2Int + m2Ext) },
    ...(an.pisoExterno > 0 ? { externa: { pavimentacao: r2(an.pisoExterno) } } : {}),
    terreo: { area: r2(areaConstruida), m2Parede15: r2(m15), m2Parede20: r2(m20), m2Parede25: r2(m25), perimetroParedes: r2(perim),
      ...(areaLj ? { areaLoje: r2(areaLj), perimetroLoje: r2(perLj), tipoLoje: "Treliça" } : {}) },
    ...(cobertura.length ? { cobertura } : {}),
  };
  const linhas = [
    ["Tipologia", "Térrea"],
    ["Área construída", tpFmt(areaConstruida) + " m²" + (an.temCobertura ? " (área coberta)" : areaCp ? " (contrapiso)" : "")],
    ...(an.pisoExterno > 0 ? [["Pavimentação externa", tpFmt(an.pisoExterno) + " m² (contrapiso fora da cobertura)"]] : []),
    ["Parede interna", tpFmt(m2Int) + " m²"],
    ["Parede externa", `${tpFmt(m2Ext)} m² (${nExt} parede${nExt === 1 ? "" : "s"})`],
    ["Por espessura", `15 cm: ${tpFmt(m15)} · 20 cm: ${tpFmt(m20)} · 25 cm: ${tpFmt(m25)} m²`],
    ["Perímetro de paredes", tpFmt(perim) + " m"],
    ...(areaLj ? [["Laje (treliçada)", `${tpFmt(areaLj)} m² · perímetro ${tpFmt(perLj)} m`]] : []),
    ...cobertura.map((c, k) => [`Telhado ${cobertura.length > 1 ? k + 1 : ""}`.trim(), `${tpTelha(c.tipo).rotulo}, ${tpFmt(c.comprimento)} × ${tpFmt(c.largura)} m, ${c.aguas} água${c.aguas === 1 ? "" : "s"}, ${tpFmt(c.inclinacao * 100, 0)}%`]),
  ];
  return { projeto, linhas };
}

// Junta no projeto da obra só os campos que vêm do desenho. Padrão, cômodos,
// esquadrias, fundação, prestadores etc. ficam como estavam.
function tpMesclarProjetoObra(ant, conv, projetoId) {
  ant = ant || {};
  return { ...ant, tipologia: conv.projeto.tipologia,
    arquitetura: { ...(ant.arquitetura || {}), ...conv.projeto.arquitetura },
    terreo: { ...(ant.terreo || {}), ...conv.projeto.terreo },
    ...(conv.projeto.cobertura ? { cobertura: conv.projeto.cobertura } : {}),
    ...(conv.projeto.externa ? { externa: { ...(ant.externa || {}), ...conv.projeto.externa } } : {}),
    origemDesenho: { projetoId } };
}
// "assinatura" dos campos do desenho, para só gravar quando algo mudou
function tpAssinaturaDesenho(pr) {
  pr = pr || {};
  const a = pr.arquitetura || {}, t = pr.terreo || {};
  return JSON.stringify([pr.tipologia, a.areaConstruida, a.m2ParedesInternas, a.m2ParedesExternas, a.m2ParedesTotal,
    t.area, t.m2Parede15, t.m2Parede20, t.m2Parede25, t.perimetroParedes, t.areaLoje, t.perimetroLoje, t.tipoLoje, pr.cobertura || null, (pr.externa || {}).pavimentacao || 0]);
}

// Arco por 3 pontos (início, fim e um ponto da curva), devolvido como
// trechos retos curtos (~40 cm) — é assim que parede curva e contorno curvo
// entram no quantitativo. Pontos alinhados = reta.
function tpArco3(p0, p2, pm) {
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const ax = p0.x, ay = p0.y, bx = pm.x, by = pm.y, cx = p2.x, cy = p2.y;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-9) return { pts: [{ x: p2.x, y: p2.y }], r: 0, L: Math.hypot(cx - ax, cy - ay) };
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  const r = Math.hypot(ax - ux, ay - uy), ang = (q) => Math.atan2(q.y - uy, q.x - ux);
  const norm = (a) => { while (a < 0) a += 2 * Math.PI; while (a >= 2 * Math.PI) a -= 2 * Math.PI; return a; };
  const a0 = ang(p0), s1 = norm(ang(p2) - a0), sm = norm(ang(pm) - a0);
  const sweep = sm < s1 ? s1 : s1 - 2 * Math.PI;
  const L = Math.abs(sweep) * r, n = Math.max(6, Math.ceil(L / 0.4));
  const pts = [];
  for (let k = 1; k <= n; k++) { const a = a0 + sweep * k / n; pts.push({ x: r3(ux + r * Math.cos(a)), y: r3(uy + r * Math.sin(a)) }); }
  pts[pts.length - 1] = { x: p2.x, y: p2.y };
  return { pts, r, L };
}
const TP_MODOS_TRACO = [
  { id: "linha", rotulo: "Linha", dica: "Linha: ponto a ponto" },
  { id: "retangulo", rotulo: "Retângulo", dica: "Retângulo: dois cantos opostos" },
  { id: "arco", rotulo: "Arco", dica: "Arco: início, fim e um ponto da curva" },
];

// Editor em tela cheia. Elementos: paredes (segmentos) e áreas (contrapiso e
// laje, polígonos). Seleção compartilhada entre planta e 3D: chaves "p3"
// (parede 3) e "a1" (área 1). Ferramentas: Selecionar, Parede, Contrapiso,
// Laje, Mover. Propriedades do que estiver selecionado no menu lateral.
function TpEditor({ projeto, nomeCliente, onAlterar, onVoltar, data, save }) {
  const planRef = useRef(null), v3dRef = useRef(null);
  const planBox = useRef(null), v3dBox = useRef(null);
  const [paredes, setParedes] = useState(() => (Array.isArray(projeto.paredes) ? projeto.paredes : []));
  const [areas, setAreas] = useState(() => (Array.isArray(projeto.areas) ? projeto.areas : []));
  const [inicio, setInicio] = useState(null);
  const [poli, setPoli] = useState([]);      // pontos do contrapiso/laje em desenho
  const [hover, setHover] = useState(null);
  const [esp, setEsp] = useState("14");
  const [alt, setAlt] = useState("2,80");
  const [modo, setModo] = useState("ambos"); // planta | ambos | 3d
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  const [menuAberto, setMenuAberto] = useState(false);
  const [confirmarLimpar, setConfirmarLimpar] = useState(false);
  const [ferramenta, setFerramenta] = useState(() => ((projeto.paredes || []).length || (projeto.areas || []).length ? "selecionar" : "parede"));
  const [sel, setSel] = useState([]);
  const [caixa, setCaixa] = useState(null);
  const [erro3d, setErro3d] = useState("");
  const [menuCtx, setMenuCtx] = useState(null); // menu do botão direito { x, y }
  const [digitado, setDigitado] = useState("");  // comprimento digitado durante o traço
  const [verAtalhos, setVerAtalhos] = useState(false);
  const [aviso, setAviso] = useState("");
  const [novoAmbiente, setNovoAmbiente] = useState(null); // { pts, ponto, nome }
  const [dividir, setDividir] = useState(null);           // { ai } enquanto divide um ambiente já criado
  const [modoTraco, setModoTraco] = useState("linha"); // linha | retangulo | arco
  const [ancora, setAncora] = useState(null);          // { ret: p } ou { arcoIni: p, arcoFim: p }
  const [obraId, setObraId] = useState(projeto.obraId || null);
  const [sincronizar, setSincronizar] = useState(projeto.sincronizar !== false);
  const [ultimaSinc, setUltimaSinc] = useState(null);
  const [painelObra, setPainelObra] = useState(null); // null, confirmar ou feito
  const historico = useRef([]);
  const futuro = useRef([]);                     // para Refazer
  const ultimaFerramenta = useRef("parede");     // Enter sem nada ativo repete
  const meioClique = useRef(0);                  // duplo clique da rodinha = ajustar
  const three = useRef(null);
  const vista = useRef(null);
  const primeiraVez = useRef(true);

  const espM = Math.max(0.05, (parseFloat(String(esp).replace(",", ".")) || 14) / 100);
  const altM = Math.max(1, parseFloat(String(alt).replace(",", ".")) || 2.8);
  const r3 = (x) => Math.round(x * 1000) / 1000;

  useEffect(() => {
    if (primeiraVez.current) { primeiraVez.current = false; return; }
    onAlterar({ ...projeto, obraId, sincronizar, paredes, areas, atualizadoEm: new Date().toISOString() });
  }, [paredes, areas, obraId, sincronizar]);

  useEffect(() => {
    const antes = document.body.style.overflow; document.body.style.overflow = "hidden";
    const r = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", r);
    return () => { document.body.style.overflow = antes; window.removeEventListener("resize", r); };
  }, []);

  // ---------- alterações (com histórico) ----------
  const mudar = (novasParedes, novasAreas, manterSel) => {
    historico.current.push({ paredes, areas });
    if (historico.current.length > 200) historico.current.shift();
    futuro.current = [];
    if (novasParedes) setParedes(novasParedes);
    if (novasAreas) setAreas(tpNumerarAmbientes(novasAreas));
    if (!manterSel) setSel([]);
  };
  const selP = sel.filter((k) => k[0] === "p").map((k) => +k.slice(1)).filter((i) => paredes[i]);
  const selA = sel.filter((k) => k[0] === "a").map((k) => +k.slice(1)).filter((i) => areas[i]);
  const excluirSelecao = () => {
    if (!sel.length) return;
    const fp = new Set(selP), fa = new Set(selA);
    mudar(paredes.filter((_, i) => !fp.has(i)), areas.filter((_, i) => !fa.has(i)));
  };
  const editarParedes = (idx, fn) => { const s = new Set(idx); mudar(paredes.map((w, i) => (s.has(i) ? fn(w) : w)), null, true); };
  const editarAreas = (idx, fn) => { const s = new Set(idx); mudar(null, areas.map((a, i) => (s.has(i) ? fn(a) : a)), true); };
  const mudarComprimento = (i, L) => editarParedes([i], (w) => {
    const l0 = tpLen(w) || 1, ux = (w.b.x - w.a.x) / l0, uy = (w.b.y - w.a.y) / l0;
    return { ...w, b: { x: r3(w.a.x + ux * L), y: r3(w.a.y + uy * L) } };
  });
  function desfazer() {
    const anterior = historico.current.pop();
    if (!anterior) return;
    futuro.current.push({ paredes, areas });
    const removida = paredes.length === anterior.paredes.length + 1 ? paredes[paredes.length - 1] : null;
    if (inicio && removida && removida.b.x === inicio.x && removida.b.y === inicio.y) setInicio(removida.a);
    else setInicio(null);
    setParedes(anterior.paredes); setAreas(anterior.areas); setSel([]);
  }
  function refazer() {
    const prox = futuro.current.pop();
    if (!prox) return;
    historico.current.push({ paredes, areas });
    setParedes(prox.paredes); setAreas(prox.areas); setSel([]); setInicio(null);
  }
  // seleção: Ctrl soma, Shift tira, sem tecla substitui (convenção Revit)
  const aplicarSelecao = (chaves, g) => {
    if (g.ctrl) setSel(Array.from(new Set([...sel, ...chaves])));
    else if (g.shift) { const fora = new Set(chaves); setSel(sel.filter((k) => !fora.has(k))); }
    else setSel(chaves);
  };
  // setas movem a seleção (0,10 m; com Shift, 1,00 m)
  const deslocar = (base, chaves, dx, dy) => {
    const fp = new Set(chaves.filter((k) => k[0] === "p").map((k) => +k.slice(1))), fa = new Set(chaves.filter((k) => k[0] === "a").map((k) => +k.slice(1)));
    const mv = (q) => ({ x: r3(q.x + dx), y: r3(q.y + dy) });
    return {
      paredes: base.paredes.map((w, i) => (fp.has(i) ? { ...w, a: mv(w.a), b: mv(w.b) } : w)),
      areas: base.areas.map((a, i) => (fa.has(i) ? { ...a, pts: (a.pts || []).map(mv), ...(a.ponto ? { ponto: mv(a.ponto) } : {}) } : a)),
    };
  };
  const moverSelecao = (dx, dy) => {
    if (!sel.length) return;
    const r = deslocar({ paredes, areas }, sel, dx, dy);
    mudar(r.paredes, r.areas, true);
  };
  const trocarFerramenta = (f) => { setDividir(null); setFerramenta(f); setInicio(null); setPoli([]); setDigitado(""); setAncora(null); if (f !== "selecionar" && f !== "mover") { setSel([]); ultimaFerramenta.current = f; } };
  // Nível do apoio do telhado: automático = topo do que está embaixo dele
  // (laje: nível + espessura; parede: altura). Só vale o digitado depois que o
  // usuário muda o campo (cotaManual), como o "deslocamento da base" do Revit.
  const apoioTelhado = (a) => {
    if (a.cotaManual) return a.cota || 0;
    const pts = a.pts || []; let topo = 0, achou = false;
    for (const l of areas) {
      if (l.tipo !== "laje" || !l.pts || l.pts.length < 3) continue;
      if (tpDentroPoli(tpCentro(l.pts), pts)) { topo = Math.max(topo, (l.cota || 0) + (l.esp || 0)); achou = true; }
    }
    for (const w of paredes) {
      if (tpDentroPoli({ x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 }, pts)) { topo = Math.max(topo, w.h || 0); achou = true; }
    }
    return achou ? r3(topo) : (a.cota != null ? a.cota : altM);
  };
  const geoTelhado = (a) => tpTelhadoGeo({ ...a, cota: apoioTelhado(a) });
  // Obra ligada a este projeto (criada pelo botão "Orçamento de obra")
  const obraLigada = obraId && data && Array.isArray(data.obras) ? data.obras.find((o) => o.id === obraId) : null;
  const podeOrcar = !!(data && save && projeto.clienteId && typeof gerarOrcamentoObra === "function");
  // Sincronização: com a obra ligada, os campos do orçamento de obra que o
  // desenho gera (paredes, área, laje, telhado) são gravados sozinhos, 1,5 s
  // depois da última alteração e ao sair do editor. O orçamento em si só é
  // recalculado no botão (fica marcado como desatualizado na obra).
  const sincronizarAgora = useRef(null);
  sincronizarAgora.current = () => {
    if (!sincronizar || !obraLigada || !data || !save) return;
    const conv = tpDesenhoParaObra(paredes, areas);
    if (tpAssinaturaDesenho(conv.projeto) === tpAssinaturaDesenho(obraLigada.projeto)) return;
    const atualizada = { ...obraLigada, projeto: tpMesclarProjetoObra(obraLigada.projeto, conv, projeto.id) };
    save({ ...data, obras: (data.obras || []).map((o) => (o.id === atualizada.id ? atualizada : o)) });
    setUltimaSinc(new Date());
  };
  const sincPendente = useRef(false);
  useEffect(() => {
    if (!sincronizar || !obraLigada) return;
    sincPendente.current = true;
    const t = setTimeout(() => { sincPendente.current = false; sincronizarAgora.current(); }, 1500);
    return () => clearTimeout(t);
  }, [paredes, areas, obraId, sincronizar, !!obraLigada]);
  useEffect(() => () => { if (sincPendente.current) sincronizarAgora.current(); }, []);
  const gerarObra = () => {
    const conv = tpDesenhoParaObra(paredes, areas);
    const base = obraLigada || {
      id: "obra_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), clienteId: projeto.clienteId, nome: projeto.nome,
      status: "planejamento", dataInicio: "", dataFim: "", responsavel: "", descricao: "Criada a partir do Projetar.", ativo: true, clientePagaDireto: false,
      enderecoProprio: false, cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
    };
    const projetoObra = tpMesclarProjetoObra(base.projeto, conv, projeto.id);
    const r = gerarOrcamentoObra(projetoObra, data);
    const orcamento = { geradoEm: new Date().toISOString(), versao: ((base.orcamento && base.orcamento.versao) || 0) + 1,
      itens: r.itens.map(({ memoria, ...i }) => i), totais: r.totais, qualidade: r.qualidade, avisos: r.avisos };
    const obraNova = { ...base, projeto: projetoObra, orcamento, projetoDesenhoId: projeto.id };
    const obras = Array.isArray(data.obras) ? data.obras : [];
    save({ ...data, obras: obraLigada ? obras.map((o) => (o.id === obraNova.id ? obraNova : o)) : [...obras, obraNova] });
    setObraId(obraNova.id);
    setPainelObra("feito");
  };
  const criarArea = (pts) => {
    if (pts.length >= 3 && ferramenta === "telhado") {
      const tel = TP_TELHAS[0];
      mudar(null, [...areas, { tipo: "telhado", pts, cota: null, cotaManual: false, beiral: 0.6, telha: tel.id, lados: pts.map(() => ({ inclina: true, pct: tel.pct })) }]);
    } else if (pts.length >= 3 && tpEhPoli(ferramenta)) {
      const t = TP_AREA_TIPOS[ferramenta];
      mudar(null, [...areas, { tipo: ferramenta, pts, esp: t.esp, cota: ferramenta === "laje" ? altM : 0 }]);
    }
  };
  const finalizarPoli = () => { criarArea(poli); setPoli([]); setAncora(null); };
  const finalizar = () => { if (poli.length) finalizarPoli(); setInicio(null); setAncora(null); };
  // Botão direito (ou toque longo no celular): seleciona o que está embaixo,
  // se ainda não estiver selecionado, e abre o menu de ações no cursor.
  const abrirMenuCtx = (clientX, clientY, chave, mundo) => {
    if (chave && !sel.includes(chave)) { setSel([chave]); if (ferramenta !== "selecionar" && ferramenta !== "mover") trocarFerramenta("selecionar"); }
    const W = window.innerWidth, H = window.innerHeight;
    setMenuCtx({ x: Math.max(8, Math.min(clientX, W - 268)), y: clientY, cy: clientY, t: Date.now(), mundo: mundo || null });
  };
  const menuRef = useRef(null);
  useEffect(() => { // menu fica invisível até ser medido, então não pisca
    const el = menuRef.current; if (!menuCtx || !el || menuCtx.medido) return;
    const H = window.innerHeight, h = el.offsetHeight, folga = 8, cy = menuCtx.cy;
    let y = cy;
    if (cy + h > H - folga) y = cy - h >= folga ? cy - h : Math.max(folga, H - folga - h);
    setMenuCtx({ ...menuCtx, y, maxH: H - 2 * folga, medido: true });
  }, [menuCtx]);
  const separadoresAtuais = () => areas.filter((a) => a.tipo === "separador" && a.pts && a.pts.length === 2).map((a) => ({ a: a.pts[0], b: a.pts[1] }));
  const avisar = (txt) => { setAviso(txt); clearTimeout(avisar.t); avisar.t = setTimeout(() => setAviso(""), 3500); };
  // Clique dentro de um cômodo: acha o espaço fechado pelas paredes e pede o nome
  const inserirAmbienteEm = (pt) => {
    const ja = areas.findIndex((a) => a.tipo === "ambiente" && a.pts && tpDentroPoli(pt, a.pts));
    if (ja >= 0) {
      // Já tem ambiente aqui: o clique vira "dividir". Desenha-se a linha de
      // separação de uma parede até a outra; ao fechar, a outra parte pede nome.
      setFerramenta("separador"); setInicio(null); setPoli([]); setAncora(null); setSel(["a" + ja]);
      setDividir({ ai: ja });
      avisar(`Dividir "${areas[ja].nome || "ambiente"}": desenhe a linha de uma parede até a outra. A parte nova pede nome.`);
      return;
    }
    const det = tpDetectarAmbiente(paredes, pt, separadoresAtuais());
    if (!det) { avisar("Clique dentro do cômodo, não em cima da parede."); return; }
    if (det.aberto) { avisar("Esse espaço não está fechado por paredes. Feche o cômodo (ou desenhe a parede que falta) e clique de novo."); return; }
    setNovoAmbiente({ pts: det.pts, ponto: { x: r3(pt.x), y: r3(pt.y) }, nome: "" });
  };
  const confirmarAmbiente = (nome) => {
    const n = String(nome || "").trim() || "Ambiente";
    const idx = areas.length;
    mudar(null, [...areas, { tipo: "ambiente", nome: n, ponto: novoAmbiente.ponto, pts: novoAmbiente.pts }]);
    setNovoAmbiente(null);
    setTimeout(() => setSel(["a" + idx]), 0);
  };
  const editarPropriedades = () => {
    if (isMobile) { setMenuAberto(true); return; }
    setTimeout(() => { const el = document.getElementById("tp-p-comp") || document.getElementById("tp-p-alt") || document.getElementById("tp-a-esp"); if (el) { el.focus(); el.select && el.select(); } }, 50);
  };

  // ---------- vista da planta ----------
  const limites = () => {
    const pts = [...paredes.flatMap((w) => [w.a, w.b]), ...areas.flatMap((a) => a.pts)];
    if (!pts.length) return { x0: 0, y0: 0, x1: 12, y1: 9 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    return { x0, y0, x1: Math.max(x1, x0 + 1), y1: Math.max(y1, y0 + 1) };
  };
  const ajustar = () => {
    const c = planRef.current; if (!c || !c.width) return;
    const b = limites(), m = 1.5;
    const s = Math.min(c.width / (b.x1 - b.x0 + 2 * m), c.height / (b.y1 - b.y0 + 2 * m));
    vista.current = { s, ox: c.width / 2 - ((b.x0 + b.x1) / 2) * s, oy: c.height / 2 - ((b.y0 + b.y1) / 2) * s };
    desenharPlanta();
  };
  const zoom = (fator, cx, cy) => {
    const c = planRef.current, v = vista.current; if (!c || !v) return;
    const px = cx == null ? c.width / 2 : cx, py = cy == null ? c.height / 2 : cy;
    const s2 = Math.min(400 * (window.devicePixelRatio || 1), Math.max(4, v.s * fator));
    const wx = (px - v.ox) / v.s, wy = (py - v.oy) / v.s;
    vista.current = { s: s2, ox: px - wx * s2, oy: py - wy * s2 };
    desenharPlanta();
  };
  const devPx = (e) => { const c = planRef.current, r = c.getBoundingClientRect(), k = c.width / r.width; return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k }; };
  const snap = (v) => Math.round(v / TP_GRADE) * TP_GRADE;
  const paraMundo = (e) => { const v = vista.current, d = devPx(e); return { x: snap((d.x - v.ox) / v.s), y: snap((d.y - v.oy) / v.s) }; };
  const paraMundoLivre = (d) => { const v = vista.current; return { x: (d.x - v.ox) / v.s, y: (d.y - v.oy) / v.s }; };
  // Ponto do traço: ímã nas pontas de paredes e áreas (vence a grade, para
  // fechar cantos com medidas digitadas) e, com Shift, trava na horizontal
  // ou vertical a partir do ponto anterior (ortogonal).
  const baseTraco = () => (ancora && ancora.ret ? ancora.ret : ancora && ancora.arcoFim ? null : (ferramenta === "parede" || ferramenta === "separador") ? inicio : (poli.length ? poli[poli.length - 1] : null));
  // Pontos de ímã. Além do eixo (pontas), cada parede oferece os cantos das
  // suas faces: nas pontas soltas, os 4 cantos do retângulo; onde duas paredes
  // se encontram, o cruzamento das faces — que dá a quina de fora e a de
  // dentro. É isso que deixa a laje ir até a face externa da parede.
  const pontosIma = (ign = {}) => {
    const out = [];
    const faces = paredes.map((w, i) => {
      const l = tpLen(w); if (!l) return null;
      const ux = (w.b.x - w.a.x) / l, uy = (w.b.y - w.a.y) / l, nx = -uy, ny = ux, h = (w.t || 0) / 2;
      return { i, w, ux, uy, nx, ny, h };
    }).filter(Boolean);
    const mesmo = (p, q) => Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.y - q.y) < 1e-6;
    for (const f of faces) {
      if (f.i === ign.parede) continue;
      const { w, ux, uy, nx, ny, h } = f;
      out.push(w.a, w.b);
      for (const [pt, sgn] of [[w.a, -1], [w.b, 1]]) {
        const solta = !faces.some((g) => g.i !== f.i && g.i !== ign.parede && (mesmo(g.w.a, pt) || mesmo(g.w.b, pt)));
        if (solta) for (const lado of [1, -1]) out.push({ x: pt.x + sgn * ux * h + lado * nx * h, y: pt.y + sgn * uy * h + lado * ny * h });
      }
    }
    const cruzar = (p1, d1, p2, d2) => { const den = d1.x * d2.y - d1.y * d2.x; if (Math.abs(den) < 1e-9) return null; const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / den; return { x: p1.x + d1.x * t, y: p1.y + d1.y * t }; };
    for (let a = 0; a < faces.length; a++) for (let b = a + 1; b < faces.length; b++) {
      const f = faces[a], g = faces[b];
      if (f.i === ign.parede || g.i === ign.parede) continue;
      if (![f.w.a, f.w.b].some((p) => mesmo(p, g.w.a) || mesmo(p, g.w.b))) continue;
      for (const lf of [1, -1]) for (const lg of [1, -1]) {
        const q = cruzar({ x: f.w.a.x + lf * f.nx * f.h, y: f.w.a.y + lf * f.ny * f.h }, { x: f.ux, y: f.uy }, { x: g.w.a.x + lg * g.nx * g.h, y: g.w.a.y + lg * g.ny * g.h }, { x: g.ux, y: g.uy });
        if (q) out.push(q);
      }
    }
    areas.forEach((a, ai) => (a.pts || []).forEach((q, k) => { if (!(ign.area === ai && (ign.vertices || []).includes(k))) out.push(q); }));
    out.push(...poli);
    return out;
  };
  const pontoDoCursor = (e, opts = {}) => {
    const v = vista.current, d = devPx(e), livre = paraMundoLivre(d), tol = 10 * (window.devicePixelRatio || 1) / v.s;
    let ima = null, menor = Infinity;
    for (const q of pontosIma(opts.ignorar)) {
      const dd = Math.hypot(q.x - livre.x, q.y - livre.y); if (dd < tol && dd < menor) { menor = dd; ima = q; }
    }
    let p = ima ? { x: r3(ima.x), y: r3(ima.y), ima: true } : { x: snap(livre.x), y: snap(livre.y) };
    const base = opts.base !== undefined ? opts.base : baseTraco();
    if (base && e.shiftKey) p = Math.abs(p.x - base.x) >= Math.abs(p.y - base.y) ? { x: p.x, y: base.y } : { x: base.x, y: p.y };
    else if (!ima) {
      // linhas de alinhamento (como no Revit): se o cursor passa na mesma
      // vertical ou horizontal de um ponto já desenhado, gruda nela e mostra
      // um tracejado até esse ponto
      const tolA = 8 * (window.devicePixelRatio || 1) / v.s;
      const refs = [...pontosIma(opts.ignorar), ...(inicio ? [inicio] : []), ...(ancora && ancora.ret ? [ancora.ret] : []), ...(ancora && ancora.arcoIni ? [ancora.arcoIni, ancora.arcoFim] : [])];
      let gx = null, gy = null, dx = tolA, dy = tolA;
      for (const q of refs) {
        const ex = Math.abs(q.x - livre.x), ey = Math.abs(q.y - livre.y);
        if (ex < dx && Math.abs(q.y - livre.y) > 1e-6) { dx = ex; gx = q; }
        if (ey < dy && Math.abs(q.x - livre.x) > 1e-6) { dy = ey; gy = q; }
      }
      if (gx || gy) {
        p = { x: gx ? r3(gx.x) : p.x, y: gy ? r3(gy.y) : p.y, guias: [...(gx ? [gx] : []), ...(gy ? [gy] : [])] };
      }
    }
    return p;
  };
  const limpo = (p) => ({ x: p.x, y: p.y });
  // comprimento digitado + Enter: cria o trecho na direção do cursor
  // Retângulo com medidas digitadas: a 1ª medida vai no sentido em que o
  // cursor está indo (de lado = largura, para cima/baixo = comprimento), a 2ª
  // no outro eixo, para o lado onde o cursor estiver. Ex.: 10 Enter 20 Enter.
  const numDigitado = (t) => { t = String(t || "").trim(); const n = parseFloat(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t); return n > 0 ? n : null; };
  const cantoRet = (txt) => {
    const a = ancora.ret, h = hover || a, dx = h.x - a.x, dy = h.y - a.y;
    const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1, val = numDigitado(txt);
    let cx = h.x, cy = h.y;
    const eixo1 = ancora.d1 ? ancora.d1.eixo : (Math.abs(dx) >= Math.abs(dy) ? "x" : "y");
    if (ancora.d1) {
      if (eixo1 === "x") { cx = a.x + ancora.d1.v; if (val) cy = a.y + sy * val; } else { cy = a.y + ancora.d1.v; if (val) cx = a.x + sx * val; }
    } else if (val) { if (eixo1 === "x") cx = a.x + sx * val; else cy = a.y + sy * val; }
    return { x: r3(cx), y: r3(cy), eixo1 };
  };
  const concluirRet = (p) => {
    const a = ancora.ret;
    if (Math.abs(p.x - a.x) < 1e-6 || Math.abs(p.y - a.y) < 1e-6) return false;
    const cantos = [a, { x: p.x, y: a.y }, { x: p.x, y: p.y }, { x: a.x, y: p.y }];
    if (ferramenta === "parede") mudar([...paredes, ...cantos.map((q, k) => ({ a: q, b: cantos[(k + 1) % 4], t: espM, h: altM }))]);
    else criarArea(cantos);
    setAncora(null); setInicio(null); setPoli([]); setDigitado("");
    return true;
  };
  const aplicarDigitadoRet = () => {
    const val = numDigitado(digitado); setDigitado("");
    if (!val || !ancora || !ancora.ret) return;
    if (!ancora.d1) {
      const a = ancora.ret, h = hover || a, dx = h.x - a.x, dy = h.y - a.y, eixo = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      setAncora({ ...ancora, d1: { eixo, v: (eixo === "x" ? (dx < 0 ? -1 : 1) : (dy < 0 ? -1 : 1)) * val } });
      return;
    }
    concluirRet(cantoRet(String(val)));
  };
  const aplicarDigitado = () => {
    const t = digitado.trim(); setDigitado("");
    const Ld = parseFloat(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
    const base = baseTraco();
    if (!(Ld > 0) || !base) return;
    let ux = 1, uy = 0;
    if (hover && (hover.x !== base.x || hover.y !== base.y)) { const l = Math.hypot(hover.x - base.x, hover.y - base.y); ux = (hover.x - base.x) / l; uy = (hover.y - base.y) / l; }
    const p = { x: r3(base.x + ux * Ld), y: r3(base.y + uy * Ld) };
    if (ferramenta === "parede") { mudar([...paredes, { a: base, b: p, t: espM, h: altM }]); setInicio(p); }
    else setPoli([...poli, p]);
    setHover({ x: r3(p.x + ux * 0.5), y: r3(p.y + uy * 0.5) }); // mantém a direção para o próximo
  };

  const desenharPlanta = () => {
    const c = planRef.current, v = vista.current; if (!c || !v || !c.width) return;
    const ctx = c.getContext("2d"), W = c.width, H = c.height, dpr = window.devicePixelRatio || 1;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    const passo = v.s * TP_GRADE < 8 * dpr ? 1 : TP_GRADE;
    const xA = Math.floor(-v.ox / v.s), xB = Math.ceil((W - v.ox) / v.s), yA = Math.floor(-v.oy / v.s), yB = Math.ceil((H - v.oy) / v.s);
    ctx.lineWidth = 1;
    const corGrade = (k) => (Math.abs(k % 5) < 1e-6 ? "#cfd5dc" : (Math.abs(k % 1) < 1e-6 ? "#e3e7ec" : "#f1f3f6"));
    for (let x = xA; x <= xB; x += passo) { const sx = Math.round(x * v.s + v.ox) + 0.5; ctx.strokeStyle = corGrade(x); ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke(); }
    for (let y = yA; y <= yB; y += passo) { const sy = Math.round(y * v.s + v.oy) + 0.5; ctx.strokeStyle = corGrade(y); ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke(); }
    const T = (p) => [p.x * v.s + v.ox, p.y * v.s + v.oy];
    const marcadas = new Set(sel);
    const caminho = (pts) => { ctx.beginPath(); pts.forEach((p, k) => { const [x, y] = T(p); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); };
    // etiqueta de medida (fundo branco, texto azul) no meio de um segmento
    const etiqueta = (a, b, texto, cor) => {
      const [ax, ay] = T(a), [bx, by] = T(b);
      if (Math.hypot(bx - ax, by - ay) < 18 * dpr) return;
      let ang = Math.atan2(by - ay, bx - ax); if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
      ctx.save(); ctx.translate((ax + bx) / 2, (ay + by) / 2); ctx.rotate(ang);
      ctx.font = `600 ${12 * dpr}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const w = ctx.measureText(texto).width + 10 * dpr;
      ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.fillRect(-w / 2, -22 * dpr, w, 16 * dpr);
      ctx.fillStyle = cor || TP_AZUL; ctx.fillText(texto, 0, -14 * dpr); ctx.restore(); ctx.textBaseline = "alphabetic";
    };
    const angulo = (a, b) => { const g = Math.round(((Math.atan2(-(b.y - a.y), b.x - a.x) * 180 / Math.PI) + 360) % 360); return g % 90 === 0 ? "" : ` · ${g}°`; };

    // terreno: verde claro, por baixo de tudo
    areas.forEach((a, i) => {
      if (a.tipo !== "terreno" || !a.pts || a.pts.length < 3) return;
      const marc = marcadas.has("a" + i);
      caminho(a.pts); ctx.fillStyle = marc ? "rgba(4,116,244,0.10)" : "#e3f3dc"; ctx.fill();
      ctx.strokeStyle = marc ? TP_AZUL : "#6aa84f"; ctx.lineWidth = (marc ? 2.5 : 1.5) * dpr; ctx.setLineDash([12 * dpr, 4 * dpr]); ctx.stroke(); ctx.setLineDash([]);
      const b0 = a.pts.reduce((m, q) => (q.y < m.y ? q : m), a.pts[0]); const [tx, ty] = T(b0);
      ctx.font = `600 ${11 * dpr}px system-ui, sans-serif`; ctx.textAlign = "left"; ctx.fillStyle = marc ? TP_AZUL : "#4d7c3a";
      ctx.fillText(`Terreno ${tpFmt(tpAreaPoli(a.pts))} m²`, tx + 6 * dpr, ty + 16 * dpr);
    });
    const cobPts = areas.filter((a) => (a.tipo === "laje" || a.tipo === "telhado") && a.pts && a.pts.length >= 3).map((a) => a.pts);
    // áreas: contrapiso (hachura) por baixo, laje (tracejado) por cima
    const ordem = areas.map((a, i) => i).sort((i, j) => (areas[i].tipo === "laje") - (areas[j].tipo === "laje"));
    for (const i of ordem) {
      const a = areas[i], marc = marcadas.has("a" + i);
      if (!a.pts || a.pts.length < 3 || a.tipo === "telhado" || a.tipo === "terreno" || a.tipo === "ambiente") continue;
      caminho(a.pts);
      if (a.tipo === "laje") {
        ctx.fillStyle = marc ? "rgba(4,116,244,0.14)" : "rgba(107,143,199,0.07)"; ctx.fill();
        ctx.setLineDash([8 * dpr, 5 * dpr]); ctx.strokeStyle = marc ? TP_AZUL : "#6b8fc7"; ctx.lineWidth = (marc ? 2.5 : 1.5) * dpr; ctx.stroke(); ctx.setLineDash([]);
      } else {
        ctx.fillStyle = marc ? "rgba(4,116,244,0.12)" : "#f4efe4"; ctx.fill();
        ctx.save(); caminho(a.pts); ctx.clip();
        ctx.strokeStyle = marc ? "rgba(4,116,244,0.35)" : "#dccfb3"; ctx.lineWidth = 1 * dpr;
        const pas = 9 * dpr;
        for (let k = -H; k < W + H; k += pas) { ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + H, H); ctx.stroke(); }
        ctx.restore();
        caminho(a.pts); ctx.strokeStyle = marc ? TP_AZUL : "#b8a98a"; ctx.lineWidth = (marc ? 2.5 : 1) * dpr; ctx.stroke();
      }
      const [cx, cy] = T(tpCentro(a.pts));
      ctx.font = `600 ${11 * dpr}px system-ui, sans-serif`; ctx.textAlign = "center";
      ctx.fillStyle = marc ? TP_AZUL : (a.tipo === "laje" ? "#4b6aa0" : "#8a7a58");
      let nomeA = TP_AREA_TIPOS[a.tipo].nome;
      if (a.tipo === "contrapiso" && cobPts.length) nomeA = tpAreaDentro(a.pts, cobPts) >= tpAreaPoli(a.pts) / 2 ? "Piso interno" : "Piso externo";
      ctx.fillText(`${nomeA} ${tpFmt(tpAreaPoli(a.pts))} m²`, cx, cy + (a.tipo === "laje" ? 14 * dpr : 0));
    }

    // telhados: contorno com beiral (tracejado), linhas de cumeeira e espigão,
    // seta de caimento com a porcentagem em cada água
    areas.forEach((a, i) => {
      if (a.tipo !== "telhado" || !a.pts || a.pts.length < 3) return;
      const marc = marcadas.has("a" + i), g = geoTelhado(a), cor = marc ? TP_AZUL : "#9a4a26";
      caminho(g.contorno); ctx.fillStyle = marc ? "rgba(4,116,244,0.08)" : "rgba(181,86,47,0.06)"; ctx.fill();
      ctx.setLineDash([10 * dpr, 4 * dpr, 2 * dpr, 4 * dpr]); ctx.strokeStyle = cor; ctx.lineWidth = (marc ? 2.5 : 1.5) * dpr; ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = cor; ctx.lineWidth = 1 * dpr;
      for (const f of g.facetas) { caminho(f.pts); ctx.stroke(); }
      if (g.contorno !== a.pts) { caminho(a.pts); ctx.strokeStyle = marc ? "rgba(4,116,244,0.5)" : "rgba(154,74,38,0.35)"; ctx.setLineDash([3 * dpr, 3 * dpr]); ctx.stroke(); ctx.setLineDash([]); }
      ctx.font = `600 ${11 * dpr}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      g.lados.forEach((L, k) => {
        const m = { x: (L.a.x + L.b.x) / 2, y: (L.a.y + L.b.y) / 2 };
        if (marc) { const [nx, ny] = T({ x: m.x - L.nx * 0.35, y: m.y - L.ny * 0.35 }); ctx.fillStyle = TP_AZUL; ctx.beginPath(); ctx.arc(nx, ny, 8 * dpr, 0, 7); ctx.fill(); ctx.fillStyle = "#fff"; ctx.fillText(String(k + 1), nx, ny); }
        if (!L.inclina || !L.s) return;
        // seta apontando para baixo (para o lado), do meio da água até perto da borda
        const p0 = { x: m.x + L.nx * 1.1, y: m.y + L.ny * 1.1 }, p1 = { x: m.x + L.nx * 0.35, y: m.y + L.ny * 0.35 };
        const [x0, y0] = T(p0), [x1, y1] = T(p1), ang = Math.atan2(y1 - y0, x1 - x0);
        ctx.strokeStyle = cor; ctx.fillStyle = cor; ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 7 * dpr * Math.cos(ang - 0.45), y1 - 7 * dpr * Math.sin(ang - 0.45)); ctx.lineTo(x1 - 7 * dpr * Math.cos(ang + 0.45), y1 - 7 * dpr * Math.sin(ang + 0.45)); ctx.closePath(); ctx.fill();
        const [tx, ty] = T({ x: m.x + L.nx * 1.45, y: m.y + L.ny * 1.45 });
        ctx.fillText(`${tpFmt(L.s * 100, 0)}%`, tx, ty);
      });
      ctx.textBaseline = "alphabetic";
      const [cx, cy] = T(tpCentro(a.pts));
      ctx.fillStyle = cor; ctx.fillText(`Telhado ${tpFmt(g.areaProjecao)} m²`, cx, cy + 22 * dpr);
      if (!g.convexo) { ctx.fillStyle = "#b45309"; ctx.fillText("contorno com canto para dentro: divida em dois telhados", cx, cy + 38 * dpr); }
    });

    // separadores de ambiente: linha fina tracejada (não é parede)
    areas.forEach((a, i) => {
      if (a.tipo !== "separador" || !a.pts || a.pts.length !== 2) return;
      const marc = marcadas.has("a" + i), [ax, ay] = T(a.pts[0]), [bx, by] = T(a.pts[1]);
      if (marc) { ctx.strokeStyle = "rgba(4,116,244,0.25)"; ctx.lineWidth = 9 * dpr; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
      ctx.strokeStyle = marc ? TP_AZUL : "#4b5563"; ctx.lineWidth = 1.5 * dpr; ctx.setLineDash([8 * dpr, 4 * dpr, 2 * dpr, 4 * dpr]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
    });
    if (ferramenta === "separador" && inicio && hover && (hover.x !== inicio.x || hover.y !== inicio.y)) {
      const [ax, ay] = T(inicio), [bx, by] = T(hover);
      ctx.strokeStyle = TP_AZUL; ctx.lineWidth = 1.5 * dpr; ctx.setLineDash([8 * dpr, 4 * dpr, 2 * dpr, 4 * dpr]); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
      etiqueta(inicio, hover, `${tpFmt(Math.hypot(hover.x - inicio.x, hover.y - inicio.y))} m${angulo(inicio, hover)}`);
    }
    // ambientes: contorno pontilhado discreto, nome e área no ponto clicado
    areas.forEach((a, i) => {
      if (a.tipo !== "ambiente" || !a.pts || a.pts.length < 3) return;
      const marc = marcadas.has("a" + i);
      caminho(a.pts);
      if (marc) { ctx.fillStyle = "rgba(4,116,244,0.10)"; ctx.fill(); }
      ctx.strokeStyle = marc ? TP_AZUL : "rgba(17,24,39,0.25)"; ctx.lineWidth = (marc ? 2 : 1) * dpr; ctx.setLineDash([2 * dpr, 3 * dpr]); ctx.stroke(); ctx.setLineDash([]);
      const [lx, ly] = T(a.ponto || tpCentro(a.pts));
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `700 ${13 * dpr}px system-ui, sans-serif`; ctx.fillStyle = marc ? TP_AZUL : "#111827";
      ctx.fillText(a.nome || "Ambiente", lx, ly - 8 * dpr);
      ctx.font = `500 ${11.5 * dpr}px system-ui, sans-serif`; ctx.fillStyle = a.aberto ? "#b45309" : (marc ? TP_AZUL : "#4b5563");
      ctx.fillText(a.aberto ? "não fechado" : `${tpFmt(tpAreaPoli(a.pts))} m²`, lx, ly + 8 * dpr);
      ctx.textBaseline = "alphabetic";
    });

    // polígono em desenho
    if (poli.length) {
      const pts = hover && modoTraco === "linha" ? [...poli, hover] : poli;
      ctx.beginPath(); pts.forEach((p, k) => { const [x, y] = T(p); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.strokeStyle = TP_AZUL; ctx.lineWidth = 2 * dpr; ctx.setLineDash([6 * dpr, 4 * dpr]); ctx.stroke(); ctx.setLineDash([]);
      if (pts.length >= 3) { caminho(pts); ctx.fillStyle = "rgba(4,116,244,0.08)"; ctx.fill(); }
      const [fx, fy] = T(poli[0]); ctx.strokeStyle = TP_AZUL; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.arc(fx, fy, 7 * dpr, 0, 7); ctx.stroke();
    }

    // paredes
    const todas = modoTraco === "linha" && inicio && hover && (hover.x !== inicio.x || hover.y !== inicio.y)
      ? [...paredes, { a: inicio, b: hover, t: espM, fantasma: true }] : paredes;
    ctx.lineCap = "square";
    todas.forEach((w, i) => {
      if (!marcadas.has("p" + i)) return;
      const [ax, ay] = T(w.a), [bx, by] = T(w.b);
      ctx.strokeStyle = "rgba(4,116,244,0.25)"; ctx.lineWidth = Math.max(2, w.t * v.s) + 10 * dpr;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    });
    todas.forEach((w, i) => {
      const [ax, ay] = T(w.a), [bx, by] = T(w.b), marc = marcadas.has("p" + i);
      ctx.strokeStyle = w.fantasma || marc ? TP_AZUL : "#374151"; ctx.globalAlpha = w.fantasma ? 0.6 : 1;
      ctx.lineWidth = Math.max(2, w.t * v.s);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.globalAlpha = 1;
      let ang = Math.atan2(by - ay, bx - ax); if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
      ctx.save(); ctx.translate((ax + bx) / 2, (ay + by) / 2); ctx.rotate(ang);
      ctx.font = `600 ${12 * dpr}px system-ui, sans-serif`; ctx.textAlign = "center";
      ctx.fillStyle = w.fantasma || marc ? TP_AZUL : "#6b7280";
      if (!w.fantasma) ctx.fillText(tpFmt(tpLen(w)) + " m", 0, -(w.t * v.s / 2 + 6 * dpr)); ctx.restore();
      if (w.fantasma) etiqueta(w.a, w.b, `${tpFmt(tpLen(w))} m${angulo(w.a, w.b)}`);
    });
    const ponto = (p, r) => { const [x, y] = T(p); ctx.fillStyle = TP_AZUL; ctx.beginPath(); ctx.arc(x, y, r * dpr, 0, 7); ctx.fill(); };
    // linhas de alinhamento
    if (hover && hover.guias) {
      ctx.save(); ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 1 * dpr; ctx.setLineDash([5 * dpr, 4 * dpr]);
      const [hx, hy] = T(hover);
      for (const q of hover.guias) { const [qx, qy] = T(q); ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(hx, hy); ctx.stroke(); ctx.setLineDash([]); ctx.strokeRect(qx - 3 * dpr, qy - 3 * dpr, 6 * dpr, 6 * dpr); ctx.setLineDash([5 * dpr, 4 * dpr]); }
      ctx.restore();
      ctx.strokeStyle = "#0ea5e9"; ctx.lineWidth = 1.5 * dpr; ctx.beginPath(); ctx.moveTo(hx - 5 * dpr, hy - 5 * dpr); ctx.lineTo(hx + 5 * dpr, hy + 5 * dpr); ctx.moveTo(hx + 5 * dpr, hy - 5 * dpr); ctx.lineTo(hx - 5 * dpr, hy + 5 * dpr); ctx.stroke();
    }
    // prévia do retângulo, com as duas medidas
    if (ancora && ancora.ret && hover) {
      const a = ancora.ret, h = cantoRet(digitado), c = [a, { x: h.x, y: a.y }, h, { x: a.x, y: h.y }];
      caminho(c); ctx.fillStyle = "rgba(4,116,244,0.06)"; ctx.fill(); ctx.strokeStyle = TP_AZUL; ctx.lineWidth = Math.max(1.5 * dpr, ferramenta === "parede" ? espM * v.s : 0); ctx.globalAlpha = ferramenta === "parede" ? 0.5 : 1; ctx.setLineDash(ferramenta === "parede" ? [] : [6 * dpr, 4 * dpr]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      const fixoX = ancora.d1 && ancora.d1.eixo === "x", fixoY = ancora.d1 && ancora.d1.eixo === "y";
      etiqueta(c[0], c[1], tpFmt(Math.abs(h.x - a.x)) + " m" + (fixoX ? " ✓" : ""), fixoX ? "#16a34a" : undefined);
      etiqueta(c[1], c[2], tpFmt(Math.abs(h.y - a.y)) + " m" + (fixoY ? " ✓" : ""), fixoY ? "#16a34a" : undefined);
      const [ax, ay] = T(a); ctx.fillStyle = TP_AZUL; ctx.beginPath(); ctx.arc(ax, ay, 5 * dpr, 0, 7); ctx.fill();
    }
    // prévia do arco: corda até o 2º clique, depois a curva passando pelo cursor
    if (modoTraco === "arco" && hover && (ferramenta === "parede" || tpEhPoli(ferramenta))) {
      if (ancora && ancora.arcoFim) {
        const arc = tpArco3(ancora.arcoIni, ancora.arcoFim, hover), pts = [ancora.arcoIni, ...arc.pts];
        ctx.beginPath(); pts.forEach((q, k) => { const [x, y] = T(q); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.strokeStyle = TP_AZUL; ctx.globalAlpha = 0.6; ctx.lineWidth = Math.max(2 * dpr, ferramenta === "parede" ? espM * v.s : 0); ctx.stroke(); ctx.globalAlpha = 1;
        etiqueta(ancora.arcoIni, ancora.arcoFim, arc.r ? `R ${tpFmt(arc.r)} m · arco ${tpFmt(arc.L)} m` : `${tpFmt(arc.L)} m`);
      } else {
        const ini = ferramenta === "parede" ? inicio : poli[poli.length - 1];
        if (ini) etiqueta(ini, hover, `${tpFmt(Math.hypot(hover.x - ini.x, hover.y - ini.y))} m${angulo(ini, hover)} — clique o fim`);
      }
    }
    // medida dinâmica do trecho em desenho (polígonos no modo linha)
    if (modoTraco === "linha" && poli.length && hover) {
      const u = poli[poli.length - 1];
      etiqueta(u, hover, `${tpFmt(Math.hypot(hover.x - u.x, hover.y - u.y))} m${angulo(u, hover)}`);
      if (poli.length >= 2) etiqueta(hover, poli[0], tpFmt(Math.hypot(poli[0].x - hover.x, poli[0].y - hover.y)) + " m", "#6b7280");
    }
    // arrastando alça de uma área: medida de todos os lados
    if (gesto.current && gesto.current.grip && gesto.current.moveu && gesto.current.grip.ai != null) {
      const ar = areas[gesto.current.grip.ai];
      if (ar && ar.pts) ar.pts.forEach((q, k) => { const r = ar.pts[(k + 1) % ar.pts.length]; etiqueta(q, r, tpFmt(Math.hypot(r.x - q.x, r.y - q.y)) + " m"); });
    }
    if (hover && (ferramenta !== "selecionar" || (gesto.current && gesto.current.grip)) && ferramenta !== "mover") {
      if (hover.ima) { const [x, y] = T(hover); ctx.strokeStyle = "#16a34a"; ctx.lineWidth = 2 * dpr; ctx.strokeRect(x - 6 * dpr, y - 6 * dpr, 12 * dpr, 12 * dpr); }
      else ponto(hover, 3);
    }
    if (inicio) ponto(inicio, 5);
    const quadradinho = (p) => { const [x, y] = T(p); ctx.fillStyle = "#fff"; ctx.strokeStyle = TP_AZUL; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.rect(x - 4 * dpr, y - 4 * dpr, 8 * dpr, 8 * dpr); ctx.fill(); ctx.stroke(); };
    for (const i of selP) { quadradinho(paredes[i].a); quadradinho(paredes[i].b); }
    for (const i of selA) if (areas[i].tipo !== "ambiente") areas[i].pts.forEach(quadradinho);
    // editar contorno: com uma área só selecionada, bolinhas no meio de cada lado
    if (selA.length === 1 && !selP.length && areas[selA[0]].tipo !== "ambiente") {
      const pts = areas[selA[0]].pts;
      pts.forEach((q, k) => { const r = pts[(k + 1) % pts.length]; const [x, y] = T({ x: (q.x + r.x) / 2, y: (q.y + r.y) / 2 }); ctx.fillStyle = TP_AZUL; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.arc(x, y, 6 * dpr, 0, 7); ctx.fill(); ctx.stroke(); });
    }

    // retângulo de seleção (esq→dir: inteiro dentro; dir→esq: o que tocar)
    if (caixa) {
      const cruzando = caixa.x1 < caixa.x0;
      const x = Math.min(caixa.x0, caixa.x1), y = Math.min(caixa.y0, caixa.y1), w = Math.abs(caixa.x1 - caixa.x0), h = Math.abs(caixa.y1 - caixa.y0);
      ctx.fillStyle = cruzando ? "rgba(22,163,74,0.08)" : "rgba(4,116,244,0.08)"; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = cruzando ? "#16a34a" : TP_AZUL; ctx.lineWidth = 1.5 * dpr; ctx.setLineDash(cruzando ? [6 * dpr, 4 * dpr] : []);
      ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
    }
    const m = v.s >= 60 * dpr ? 1 : (v.s >= 25 * dpr ? 2 : 5);
    ctx.fillStyle = "#374151"; ctx.fillRect(16 * dpr, H - 20 * dpr, m * v.s, 3 * dpr);
    ctx.font = `500 ${11 * dpr}px system-ui, sans-serif`; ctx.textAlign = "left";
    ctx.fillText(m + " m", 16 * dpr, H - 26 * dpr);
  };

  // ---------- 3D ----------
  const desenhar3d = () => {
    const T = three.current, c = v3dRef.current; if (!T || !window.THREE || !c || !c.width) return;
    const THREE = window.THREE;
    while (T.group.children.length) { const m = T.group.children.pop(); m.geometry.dispose(); m.material.dispose(); }
    const b = limites(), cx = (b.x0 + b.x1) / 2, cz = (b.y0 + b.y1) / 2;
    T.centro = { cx, cz };
    const tam = Math.max(12, Math.ceil(Math.max(b.x1 - b.x0, b.y1 - b.y0) + 6));
    const grade = new THREE.GridHelper(tam, tam, 0xd1d5db, 0xeef0f3); grade.position.y = -0.001; T.group.add(grade);
    const marcadas = new Set(sel);
    const contorno = (g, mesh, cor) => { const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: cor })); e.position.copy(mesh.position); e.rotation.copy(mesh.rotation); e.scale.copy(mesh.scale); T.group.add(e); };
    areas.forEach((a, i) => {
      if (!a.pts || a.pts.length < 3 || a.tipo === "telhado" || a.tipo === "ambiente") return;
      const shape = new THREE.Shape(a.pts.map((p) => new THREE.Vector2(p.x - cx, -(p.y - cz))));
      const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, a.esp || 0.05), bevelEnabled: false });
      const marc = marcadas.has("a" + i);
      const mat = new THREE.MeshLambertMaterial({ color: marc ? 0x8dbbff : TP_AREA_TIPOS[a.tipo].cor3d, transparent: a.tipo === "laje" && !marc, opacity: a.tipo === "laje" && !marc ? 0.85 : 1 });
      const mesh = new THREE.Mesh(g, mat);
      mesh.rotation.x = -Math.PI / 2; mesh.position.y = a.tipo === "terreno" ? -0.03 : (a.cota || 0);
      if (a.tipo === "terreno") { mesh.scale.z = 0.02 / Math.max(0.01, a.esp || 0.05); mesh.material.color.set(marc ? 0x8dbbff : 0xcfe8c4); }
      mesh.userData.chave = "a" + i; T.group.add(mesh);
      contorno(g, mesh, marc ? 0x0474f4 : 0x6b7280);
    });
    // telhados: cada água é um polígono plano levantado por z(p); oitões
    // (lados sem inclinação) fecham a empena na linha do contorno
    areas.forEach((a, i) => {
      if (a.tipo !== "telhado" || !a.pts || a.pts.length < 3) return;
      const g = geoTelhado(a), marc = marcadas.has("a" + i);
      const pos = [];
      const V = (p, zz) => [p.x - cx, zz, p.y - cz];
      for (const f of g.facetas) for (let k = 1; k + 1 < f.pts.length; k++) pos.push(...V(f.pts[0], g.z(f.pts[0])), ...V(f.pts[k], g.z(f.pts[k])), ...V(f.pts[k + 1], g.z(f.pts[k + 1])));
      if (pos.length) {
        const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: marc ? 0x8dbbff : tpTelha(a.telha).cor, side: THREE.DoubleSide }));
        mesh.userData.chave = "a" + i; T.group.add(mesh);
        const lin = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), new THREE.LineBasicMaterial({ color: marc ? 0x0474f4 : 0x5b2a14 })); T.group.add(lin);
      }
      const emp = [];
      for (const L of g.lados) {
        if (L.inclina && L.s > 0) continue;
        const N = 24, cotaBase = g.cota;
        for (let k = 0; k < N; k++) {
          const p0 = { x: L.a.x + (L.b.x - L.a.x) * k / N, y: L.a.y + (L.b.y - L.a.y) * k / N }, p1 = { x: L.a.x + (L.b.x - L.a.x) * (k + 1) / N, y: L.a.y + (L.b.y - L.a.y) * (k + 1) / N };
          const z0 = g.z(p0), z1 = g.z(p1);
          if (z0 <= cotaBase + 1e-4 && z1 <= cotaBase + 1e-4) continue;
          emp.push(...V(p0, cotaBase), ...V(p1, cotaBase), ...V(p1, z1), ...V(p0, cotaBase), ...V(p1, z1), ...V(p0, z0));
        }
      }
      if (emp.length) {
        const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(emp, 3)); geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: marc ? 0x8dbbff : 0xe5e1d8, side: THREE.DoubleSide }));
        mesh.userData.chave = "a" + i; T.group.add(mesh);
      }
    });
    paredes.forEach((w, i) => {
      const L = tpLen(w); if (!L) return;
      const g = new THREE.BoxGeometry(L + w.t, w.h, w.t);
      const marc = marcadas.has("p" + i);
      const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: marc ? 0x8dbbff : 0xe5e1d8 }));
      mesh.position.set((w.a.x + w.b.x) / 2 - cx, w.h / 2, (w.a.y + w.b.y) / 2 - cz);
      mesh.rotation.y = -Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x);
      mesh.userData.chave = "p" + i; T.group.add(mesh);
      contorno(g, mesh, marc ? 0x0474f4 : 0x4b5563);
    });
    T.camera.aspect = c.width / c.height; T.camera.updateProjectionMatrix();
    const alvo = T.alvo || { x: 0, y: 1, z: 0 };
    T.camera.position.set(alvo.x + T.dist * Math.sin(T.phi) * Math.cos(T.theta), alvo.y + T.dist * Math.cos(T.phi), alvo.z + T.dist * Math.sin(T.phi) * Math.sin(T.theta));
    T.camera.lookAt(alvo.x, alvo.y, alvo.z);
    T.renderer.render(T.scene, T.camera);
  };
  const pegar3d = (e) => {
    const T = three.current, c = v3dRef.current; if (!T || !c) return null;
    const r = c.getBoundingClientRect();
    const ndc = new window.THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new window.THREE.Raycaster(); ray.setFromCamera(ndc, T.camera);
    const hits = ray.intersectObjects(T.group.children.filter((o) => o.userData && o.userData.chave), false);
    return hits.length ? hits[0].object.userData.chave : null;
  };

  // canvases acompanham o tamanho do quadro
  const atual = useRef({});
  atual.current = { ajustar, desenharPlanta, desenhar3d };
  useEffect(() => {
    const ajustarCanvas = (canvas) => {
      if (!canvas) return false;
      const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (!w || !h || (canvas.width === w && canvas.height === h)) return false;
      canvas.width = w; canvas.height = h; return true;
    };
    const ro = new ResizeObserver(() => {
      const c = planRef.current, antes = c ? { w: c.width, h: c.height } : null;
      if (ajustarCanvas(planRef.current)) {
        if (!vista.current || !antes || !antes.w) atual.current.ajustar();
        else { const v = vista.current; vista.current = { ...v, ox: v.ox + (c.width - antes.w) / 2, oy: v.oy + (c.height - antes.h) / 2 }; atual.current.desenharPlanta(); }
      }
      if (ajustarCanvas(v3dRef.current) && three.current) { three.current.renderer.setSize(v3dRef.current.width, v3dRef.current.height, false); atual.current.desenhar3d(); }
    });
    if (planBox.current) ro.observe(planBox.current);
    if (v3dBox.current) ro.observe(v3dBox.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let vivo = true;
    tpCarregarThree().then((THREE) => {
      if (!vivo || !v3dRef.current) return;
      const renderer = new THREE.WebGLRenderer({ canvas: v3dRef.current, antialias: true });
      if (v3dRef.current.width) renderer.setSize(v3dRef.current.width, v3dRef.current.height, false);
      const scene = new THREE.Scene(); scene.background = new THREE.Color(0xffffff);
      const camera = new THREE.PerspectiveCamera(40, 4 / 3, 0.1, 400);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x888877, 0.9));
      const sol = new THREE.DirectionalLight(0xffffff, 0.6); sol.position.set(6, 12, 4); scene.add(sol);
      const group = new THREE.Group(); scene.add(group);
      const b = limites();
      three.current = { renderer, scene, camera, group, theta: -0.7, phi: 0.9, dist: Math.max(14, Math.max(b.x1 - b.x0, b.y1 - b.y0) * 1.6) };
      atual.current.desenhar3d();
    }).catch((e) => vivo && setErro3d(e.message));
    return () => { vivo = false; if (three.current) { three.current.renderer.dispose(); three.current = null; } };
  }, []);

  useEffect(() => { desenharPlanta(); }, [paredes, areas, inicio, poli, hover, espM, sel, caixa, ferramenta, ancora, modoTraco]);
  // ambiente acompanha as paredes: mexeu numa parede, o contorno e a área se refazem
  useEffect(() => {
    if (!areas.some((a) => a.tipo === "ambiente" && a.ponto)) return;
    const seps = separadoresAtuais();
    let mudou = false;
    const novas = areas.map((a) => {
      if (a.tipo !== "ambiente" || !a.ponto) return a;
      const det = tpDetectarAmbiente(paredes, a.ponto, seps);
      const pts = det && !det.aberto ? det.pts : a.pts;
      const aberto = !det || !!det.aberto;
      if (JSON.stringify(pts) === JSON.stringify(a.pts) && !!a.aberto === aberto) return a;
      mudou = true; return { ...a, pts, aberto };
    });
    if (mudou) setAreas(novas);
    // Depende também do contorno atual dos ambientes: durante um arraste cada
    // quadro reaplica o estado de origem (com o contorno antigo); se o último
    // quadro repetir a posição, só as linhas não mudariam e o contorno velho
    // ficaria. Com esta chave, qualquer contorno desatualizado é refeito.
  }, [paredes, JSON.stringify(areas.filter((a) => a.tipo === "separador").map((a) => a.pts)), JSON.stringify(areas.filter((a) => a.tipo === "ambiente").map((a) => [a.ponto, a.pts]))]);
  useEffect(() => { desenhar3d(); }, [paredes, areas, sel]);

  useEffect(() => {
    const k = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const ctrl = e.ctrlKey || e.metaKey, tecla = e.key;
      const desenhando = (modoTraco === "linha" && ((ferramenta === "parede" && inicio) || (tpEhPoli(ferramenta) && poli.length)))
        || (modoTraco === "retangulo" && ancora && ancora.ret && (ferramenta === "parede" || tpEhPoli(ferramenta)));
      // números durante o traço = comprimento do próximo trecho
      if (desenhando && !ctrl && /^[0-9.,]$/.test(tecla)) { e.preventDefault(); setDigitado((d) => (d + tecla).slice(0, 10)); return; }
      if (digitado && tecla === "Backspace") { e.preventDefault(); setDigitado((d) => d.slice(0, -1)); return; }
      if (tecla === "Escape") {
        // Esc em camadas, como no Revit: menu → número digitado → traço → seleção
        if (verAtalhos) { setVerAtalhos(false); return; }
        if (menuCtx) { setMenuCtx(null); return; }
        if (digitado) { setDigitado(""); return; }
        if (dividir && !inicio) { setDividir(null); setFerramenta("selecionar"); return; }
        if (ancora) { setAncora(null); return; }
        if (inicio || poli.length) { setInicio(null); setPoli([]); return; }
        setSel([]); setCaixa(null);
        if (ferramenta !== "selecionar") trocarFerramenta("selecionar");
        return;
      }
      if (tecla === "Enter") {
        if (digitado && modoTraco === "retangulo" && ancora && ancora.ret) aplicarDigitadoRet();
        else if (digitado) aplicarDigitado();
        else if (desenhando) finalizar();
        else if (ferramenta === "selecionar" || ferramenta === "mover") trocarFerramenta(ultimaFerramenta.current); // repete o último comando
        return;
      }
      if (ctrl && (tecla === "z" || tecla === "Z")) { e.preventDefault(); if (e.shiftKey) refazer(); else desfazer(); return; }
      if (ctrl && (tecla === "y" || tecla === "Y")) { e.preventDefault(); refazer(); return; }
      if (ctrl && (tecla === "a" || tecla === "A")) { e.preventDefault(); trocarFerramenta("selecionar"); setSel([...paredes.map((_, i) => "p" + i), ...areas.map((_, i) => "a" + i)]); return; }
      if (tecla === "Delete" || tecla === "Backspace") { if (sel.length) { e.preventDefault(); excluirSelecao(); } return; }
      if (sel.length && tecla.startsWith("Arrow")) {
        e.preventDefault();
        const passo = e.shiftKey ? 1 : 0.1;
        moverSelecao(tecla === "ArrowLeft" ? -passo : tecla === "ArrowRight" ? passo : 0, tecla === "ArrowUp" ? -passo : tecla === "ArrowDown" ? passo : 0);
        return;
      }
      if (tecla === "?") { setVerAtalhos(true); return; }
      if (!ctrl && !e.altKey) {
        const t = tecla.toLowerCase();
        if (t === "z" || t === "f") { ajustar(); return; } // ZF no Revit / F no SketchUp
        const f = { v: "selecionar", p: "parede", c: "contrapiso", l: "laje", t: "telhado", r: "terreno", a: "ambiente", s: "separador", h: "mover" }[t];
        if (f) trocarFerramenta(f);
      }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  useEffect(() => {
    const p = planRef.current, t = v3dRef.current;
    const wp = (e) => { e.preventDefault(); const d = devPx(e); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, d.x, d.y); };
    const wt = (e) => { const T = three.current; if (!T) return; e.preventDefault(); T.dist = Math.min(150, Math.max(4, T.dist * (e.deltaY < 0 ? 0.9 : 1.1))); desenhar3d(); };
    p && p.addEventListener("wheel", wp, { passive: false }); t && t.addEventListener("wheel", wt, { passive: false });
    return () => { p && p.removeEventListener("wheel", wp); t && t.removeEventListener("wheel", wt); };
  });

  // ---------- gestos da planta ----------
  // Selecionar: clique escolhe (Shift soma), arrastar faz a área de seleção.
  // Parede / Contrapiso / Laje: clique marca ponto, arrastar move a vista.
  // Mover, botão do meio ou direito: arrastar move a vista.
  const gesto = useRef(null);
  const distSeg = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  };
  const elementoNoPonto = (d) => {
    const v = vista.current, p = paraMundoLivre(d), tol = 7 * (window.devicePixelRatio || 1) / v.s;
    let melhor = null, menor = Infinity;
    paredes.forEach((w, i) => { const dd = distSeg(p, w.a, w.b); if (dd <= Math.max(w.t / 2, tol) && dd < menor) { menor = dd; melhor = "p" + i; } });
    if (melhor) return melhor;
    areas.forEach((a, i) => { if (a.tipo === "separador" && a.pts && a.pts.length === 2) { const dd = distSeg(p, a.pts[0], a.pts[1]); if (dd <= tol && dd < menor) { menor = dd; melhor = "a" + i; } } });
    if (melhor) return melhor;
    // área: a menor que contém o ponto (laje e contrapiso iguais: a laje, que está por cima)
    let menorArea = Infinity;
    areas.forEach((a, i) => { if (a.pts && a.pts.length >= 3 && tpDentroPoli(p, a.pts)) { const ar = tpAreaPoli(a.pts) - (a.tipo === "laje" ? 1e-6 : 0); if (ar < menorArea) { menorArea = ar; melhor = "a" + i; } } });
    return melhor;
  };
  const segCruzaRet = (a, b, r) => {
    const dentro = (p) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;
    if (dentro(a) || dentro(b)) return true;
    const cr = (p1, p2, p3, p4) => {
      const d = (p, q, s2) => (q.x - p.x) * (s2.y - p.y) - (q.y - p.y) * (s2.x - p.x);
      return ((d(p3, p4, p1) > 0) !== (d(p3, p4, p2) > 0)) && ((d(p1, p2, p3) > 0) !== (d(p1, p2, p4) > 0));
    };
    const c = [{ x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x1, y: r.y1 }, { x: r.x0, y: r.y1 }];
    for (let k = 0; k < 4; k++) if (cr(a, b, c[k], c[(k + 1) % 4])) return true;
    return false;
  };
  // Alças: cantos (quadrados) e lados (bolinhas) da área selecionada; pontas da
  // parede selecionada. Arrastar edita o contorno.
  const alcaNoPonto = (d) => {
    const v = vista.current; if (!v) return null;
    const tol = 10 * (window.devicePixelRatio || 1);
    const perto = (q) => Math.hypot(q.x * v.s + v.ox - d.x, q.y * v.s + v.oy - d.y) <= tol;
    if (selA.length === 1 && !selP.length && areas[selA[0]].tipo !== "ambiente") {
      const ai = selA[0], pts = areas[ai].pts;
      for (let k = 0; k < pts.length; k++) if (perto(pts[k])) return { tipo: "vertice", ai, k };
      for (let k = 0; k < pts.length; k++) { const r = pts[(k + 1) % pts.length]; if (perto({ x: (pts[k].x + r.x) / 2, y: (pts[k].y + r.y) / 2 })) return { tipo: "lado", ai, k }; }
    }
    if (selP.length === 1 && !selA.length) {
      const pi = selP[0], w = paredes[pi];
      if (perto(w.a)) return { tipo: "ponta", pi, fim: "a" };
      if (perto(w.b)) return { tipo: "ponta", pi, fim: "b" };
    }
    return null;
  };
  // diferença, em coordenadas de tela, entre um ponto do desenho e o cursor
  const desvioCliente = (pt, e) => {
    const c = planRef.current, v = vista.current; if (!c || !v) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect(), k = c.width / r.width;
    return { x: (pt.x * v.s + v.ox) / k + r.left - e.clientX, y: (pt.y * v.s + v.oy) / k + r.top - e.clientY };
  };
  // Recalcula os ambientes para um par (paredes, áreas) — usado no próprio
  // quadro do arraste, para nunca aparecer o contorno antigo nem por um instante.
  const comAmbientes = (ps, ars) => {
    if (!ars.some((a) => a.tipo === "ambiente" && a.ponto)) return ars;
    const seps = ars.filter((a) => a.tipo === "separador" && a.pts && a.pts.length === 2).map((a) => ({ a: a.pts[0], b: a.pts[1] }));
    return ars.map((a) => {
      if (a.tipo !== "ambiente" || !a.ponto) return a;
      const det = tpDetectarAmbiente(ps, a.ponto, seps);
      return det && !det.aberto ? { ...a, pts: det.pts, aberto: false } : { ...a, aberto: true };
    });
  };
  const arrastarAlca = (e, g) => {
    const al = g.grip, orig = g.orig;
    if (al.tipo === "mover") {
      if (!sel.includes(al.chave)) setSel(al.chaves);
      const off = al.off || { x: 0, y: 0 };
      const pc = pontoDoCursor({ clientX: e.clientX + off.x, clientY: e.clientY + off.y, shiftKey: e.shiftKey }, { base: al.ancora }); setHover(pc);
      let dx = pc.x - al.ancora.x, dy = pc.y - al.ancora.y;
      // Linha de separação sozinha anda só na perpendicular a ela mesma: as
      // pontas continuam encostadas nas mesmas paredes (o ímã/alinhamento podia
      // empurrá-la uns centímetros de lado e abrir uma fresta, e aí o cômodo
      // "vazava" para o vizinho em certas posições).
      const so = al.chaves.length === 1 && al.chaves[0][0] === "a" ? orig.areas[+al.chaves[0].slice(1)] : null;
      let areasBase = orig.areas;
      if (so && so.tipo === "separador" && so.pts && so.pts.length === 2) {
        const [a0, b0] = so.pts, l = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1, nx = -(b0.y - a0.y) / l, ny = (b0.x - a0.x) / l;
        const dn = dx * nx + dy * ny; dx = nx * dn; dy = ny * dn;
        // ambiente cujo ponto de referência ficaria do outro lado (ou em cima) da
        // linha leva o ponto junto, para continuar do lado em que estava
        const lado = (q, desl) => (q.x - (a0.x + desl * nx)) * nx + (q.y - (a0.y + desl * ny)) * ny;
        areasBase = orig.areas.map((a) => {
          if (a.tipo !== "ambiente" || !a.ponto) return a;
          const antes = lado(a.ponto, 0); if (Math.abs(antes) < 1e-9) return a;
          const depois = lado(a.ponto, dn), sinal = antes > 0 ? 1 : -1;
          if (depois * sinal >= 0.2) return a;
          const empurra = sinal * 0.2 - depois;
          return { ...a, ponto: { x: r3(a.ponto.x + nx * empurra), y: r3(a.ponto.y + ny * empurra) } };
        });
      }
      const r = deslocar({ paredes: orig.paredes, areas: areasBase }, al.chaves, dx, dy);
      setParedes(r.paredes); setAreas(comAmbientes(r.paredes, r.areas));
      return;
    }
    if (al.tipo === "vertice") {
      const pts0 = orig.areas[al.ai].pts;
      const pc = pontoDoCursor(e, { ignorar: { area: al.ai, vertices: [al.k] }, base: pts0[(al.k - 1 + pts0.length) % pts0.length] });
      setHover(pc);
      setAreas(comAmbientes(orig.paredes, orig.areas.map((a, i) => (i === al.ai ? { ...a, pts: a.pts.map((q, k) => (k === al.k ? limpo(pc) : q)) } : a))));
    } else if (al.tipo === "lado") {
      const pts0 = orig.areas[al.ai].pts, k2 = (al.k + 1) % pts0.length, a = pts0[al.k], b = pts0[k2];
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / l, ny = (b.x - a.x) / l;
      const pc = pontoDoCursor(e, { ignorar: { area: al.ai, vertices: [al.k, k2] }, base: null });
      setHover(pc);
      const off = (pc.x - a.x) * nx + (pc.y - a.y) * ny; // o lado anda só na perpendicular a ele mesmo
      const novo = (q) => ({ x: r3(q.x + nx * off), y: r3(q.y + ny * off) });
      setAreas(comAmbientes(orig.paredes, orig.areas.map((ar, i) => (i === al.ai ? { ...ar, pts: ar.pts.map((q, k) => (k === al.k || k === k2 ? novo(pts0[k]) : q)) } : ar))));
    } else if (al.tipo === "ponta") {
      const w0 = orig.paredes[al.pi], outra = al.fim === "a" ? w0.b : w0.a;
      const pc = pontoDoCursor(e, { ignorar: { parede: al.pi }, base: outra });
      setHover(pc);
      const novasP = orig.paredes.map((w, i) => (i === al.pi ? { ...w, [al.fim]: limpo(pc) } : w));
      setParedes(novasP); setAreas(comAmbientes(novasP, orig.areas));
    }
  };
  const planDown = (e) => {
    const d = devPx(e);
    if (e.button === 0 && ferramenta === "selecionar") {
      const al = alcaNoPonto(d);
      if (al) { gesto.current = { x: d.x, y: d.y, x0: d.x, y0: d.y, moveu: false, grip: al, orig: { paredes, areas } }; e.currentTarget.setPointerCapture(e.pointerId); return; }
      // Arrastar uma parede ou linha de separação (ou uma área já selecionada)
      // move o elemento — e o que estiver selecionado junto. Os ambientes em
      // volta refazem a área sozinhos. Ctrl/Shift continuam sendo seleção.
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const k = elementoNoPonto(d);
        const linha = k && (k[0] === "p" || (areas[+k.slice(1)] && areas[+k.slice(1)].tipo === "separador"));
        if (k && (linha || sel.includes(k))) {
          const chaves = sel.includes(k) ? sel : [k];
          const pm = paraMundoLivre(d), idx = +k.slice(1);
          const cands = k[0] === "p" ? [paredes[idx].a, paredes[idx].b] : (areas[idx].pts || []);
          const ancoraPt = cands.reduce((m, q) => (Math.hypot(q.x - pm.x, q.y - pm.y) < Math.hypot(m.x - pm.x, m.y - pm.y) ? q : m), cands[0]);
          gesto.current = { x: d.x, y: d.y, x0: d.x, y0: d.y, moveu: false, grip: { tipo: "mover", chave: k, chaves, ancora: ancoraPt, off: desvioCliente(ancoraPt, e) }, orig: { paredes, areas } };
          e.currentTarget.setPointerCapture(e.pointerId); return;
        }
      }
    }
    if (e.button === 1) { const agora = Date.now(); if (agora - meioClique.current < 350) { ajustar(); meioClique.current = 0; return; } meioClique.current = agora; }
    const g = { x: d.x, y: d.y, x0: d.x, y0: d.y, moveu: false, panear: e.button === 1 || e.button === 2 || ferramenta === "mover", direito: e.button === 2, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, menu: false };
    // Com uma ferramenta de desenho ativa e nenhum traço em andamento, apertar
    // em cima de uma parede ou linha de separação e ARRASTAR move o elemento
    // (sem precisar trocar para Selecionar). Só clicar continua desenhando.
    if (e.button === 0 && ferramenta !== "selecionar" && ferramenta !== "mover" && ferramenta !== "ambiente" && !poli.length && !ancora) {
      const k = elementoNoPonto(d);
      const idx = k ? +k.slice(1) : -1;
      if (k && (k[0] === "p" || (areas[idx] && areas[idx].tipo === "separador"))) {
        const pm = paraMundoLivre(d), cands = k[0] === "p" ? [paredes[idx].a, paredes[idx].b] : areas[idx].pts;
        const anc = cands.reduce((m, q) => (Math.hypot(q.x - pm.x, q.y - pm.y) < Math.hypot(m.x - pm.x, m.y - pm.y) ? q : m), cands[0]);
        g.candMover = { tipo: "mover", chave: k, chaves: [k], ancora: anc, off: desvioCliente(anc, e) };
      }
    }
    // toque longo (celular) = botão direito
    if (e.pointerType === "touch") {
      const cx = e.clientX, cy = e.clientY;
      g.timer = setTimeout(() => { if (gesto.current === g && !g.moveu) { g.menu = true; abrirMenuCtx(cx, cy, elementoNoPonto(d), paraMundoLivre(d)); } }, 550);
    }
    gesto.current = g;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const planMove = (e) => {
    const g = gesto.current, d = devPx(e);
    if (g) {
      const lim = (g.grip ? 3 : 6) * (window.devicePixelRatio || 1);
      if (!g.moveu && Math.hypot(d.x - g.x0, d.y - g.y0) > lim) { g.moveu = true; clearTimeout(g.timer); }
      if (!g.grip && g.candMover && g.moveu && !g.panear) { g.grip = g.candMover; g.orig = { paredes, areas }; setSel([g.candMover.chave]); setInicio(null); }
      if (g.grip) { if (g.moveu) arrastarAlca(e, g); return; }
      if (g.menu) return;
      if (g.moveu) {
        if (g.panear || ferramenta !== "selecionar") {
          const v = vista.current; vista.current = { ...v, ox: v.ox + d.x - g.x, oy: v.oy + d.y - g.y }; g.x = d.x; g.y = d.y; desenharPlanta(); return;
        }
        setCaixa({ x0: g.x0, y0: g.y0, x1: d.x, y1: d.y }); return;
      }
    }
    if (ferramenta === "parede" || ferramenta === "separador" || tpEhPoli(ferramenta)) setHover(pontoDoCursor(e));
  };
  const planUp = (e) => {
    const g = gesto.current; gesto.current = null;
    if (!g) return;
    clearTimeout(g.timer);
    if (g.grip) {
      if (g.moveu) { historico.current.push(g.orig); if (historico.current.length > 200) historico.current.shift(); futuro.current = []; }
      else if (g.grip.tipo === "mover") aplicarSelecao([g.grip.chave], g); // só clicou: seleciona
      setHover(null); return;
    }
    if (g.menu) return;
    if (g.direito && !g.moveu) { abrirMenuCtx(e.clientX, e.clientY, elementoNoPonto(devPx(e)), paraMundoLivre(devPx(e))); return; }
    if (g.moveu) {
      if (!g.panear && ferramenta === "selecionar" && caixa) {
        const a = paraMundoLivre({ x: caixa.x0, y: caixa.y0 }), b = paraMundoLivre({ x: caixa.x1, y: caixa.y1 });
        const r = { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
        const cruzando = caixa.x1 < caixa.x0;
        const dentro = (p) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;
        const achadas = [];
        paredes.forEach((w, i) => { if (cruzando ? segCruzaRet(w.a, w.b, r) : (dentro(w.a) && dentro(w.b))) achadas.push("p" + i); });
        areas.forEach((ar, i) => {
          const pts = ar.pts || [];
          if (ar.tipo === "separador" && pts.length === 2) { if (cruzando ? segCruzaRet(pts[0], pts[1], r) : (dentro(pts[0]) && dentro(pts[1]))) achadas.push("a" + i); return; }
          if (pts.length < 3) return;
          const ok = cruzando
            ? pts.some((p, k) => segCruzaRet(p, pts[(k + 1) % pts.length], r)) || tpDentroPoli({ x: r.x0, y: r.y0 }, pts)
            : pts.every(dentro);
          if (ok) achadas.push("a" + i);
        });
        aplicarSelecao(achadas, g);
      }
      setCaixa(null); return;
    }
    if (g.panear) return;
    if (ferramenta === "selecionar") {
      const k = elementoNoPonto(devPx(e));
      if (!k) { if (!g.shift && !g.ctrl) setSel([]); return; }
      aplicarSelecao([k], g);
      return;
    }
    if (ferramenta === "ambiente") { inserirAmbienteEm(paraMundoLivre(devPx(e))); return; }
    if (ferramenta === "separador") {
      const p2 = limpo(pontoDoCursor(e)); setHover(pontoDoCursor(e));
      if (!inicio) { setInicio(p2); return; }
      if (p2.x === inicio.x && p2.y === inicio.y) return;
      const novaLinha = { tipo: "separador", pts: [inicio, p2] };
      mudar(null, [...areas, novaLinha]);
      // Linha de separação é um trecho só, de parede a parede. Não continua
      // encadeada: antes o traço seguia "vivo" a partir da ponta, e o próximo
      // clique (por exemplo, ao tentar arrastar a linha) criava outra linha.
      setInicio(null);
      if (dividir && areas[dividir.ai] && areas[dividir.ai].tipo === "ambiente") {
        const amb = areas[dividir.ai], seps = [...separadoresAtuais(), { a: inicio, b: p2 }];
        const detA = tpDetectarAmbiente(paredes, amb.ponto, seps);
        if (detA && !detA.aberto && tpAreaPoli(detA.pts) < tpAreaPoli(amb.pts) - 0.05) {
          // acha um ponto da parte que sobrou e detecta o novo ambiente
          let achou = null, tentativas = 0;
          const xs = amb.pts.map((q) => q.x), ys = amb.pts.map((q) => q.y);
          for (let y = Math.min(...ys) + 0.15; y < Math.max(...ys) && !achou && tentativas < 25; y += 0.25)
            for (let x = Math.min(...xs) + 0.15; x < Math.max(...xs) && !achou && tentativas < 25; x += 0.25) {
              const q = { x, y };
              if (!tpDentroPoli(q, amb.pts) || tpDentroPoli(q, detA.pts)) continue;
              tentativas++;
              const detB = tpDetectarAmbiente(paredes, q, seps);
              if (detB && !detB.aberto) achou = { det: detB, q };
            }
          setDividir(null); setInicio(null); setFerramenta("selecionar");
          if (achou) setNovoAmbiente({ pts: achou.det.pts, ponto: { x: r3(achou.q.x), y: r3(achou.q.y) }, nome: "" });
        }
      }
      return;
    }
    const pc = pontoDoCursor(e); setHover(pc); setDigitado("");
    const p = limpo(pc);
    const ehAreaTool = tpEhPoli(ferramenta);
    if ((ferramenta === "parede" || ehAreaTool) && modoTraco === "retangulo") {
      if (!ancora || !ancora.ret) { setAncora({ ret: p }); return; }
      concluirRet(ancora.d1 ? cantoRet("") : p);
      return;
    }
    if ((ferramenta === "parede" || ehAreaTool) && modoTraco === "arco") {
      const ini = ferramenta === "parede" ? inicio : poli[poli.length - 1];
      if (!ini) { if (ferramenta === "parede") setInicio(p); else setPoli([p]); return; }
      if (!ancora || !ancora.arcoFim) { if (p.x === ini.x && p.y === ini.y) return; setAncora({ arcoIni: ini, arcoFim: p }); return; }
      const arc = tpArco3(ancora.arcoIni, ancora.arcoFim, p);
      if (ferramenta === "parede") {
        let ant = ancora.arcoIni; const novas = [];
        for (const q of arc.pts) { novas.push({ a: ant, b: q, t: espM, h: altM }); ant = q; }
        mudar([...paredes, ...novas]); setInicio(ancora.arcoFim);
      } else setPoli([...poli, ...arc.pts]);
      setAncora(null);
      return;
    }
    if (ferramenta === "parede") {
      if (!inicio) { setInicio(p); return; }
      if (p.x === inicio.x && p.y === inicio.y) return;
      mudar([...paredes, { a: inicio, b: p, t: espM, h: altM }]);
      setInicio(p);
      return;
    }
    if (tpEhPoli(ferramenta)) {
      if (poli.length >= 3 && p.x === poli[0].x && p.y === poli[0].y) { finalizarPoli(); return; }
      const ult = poli[poli.length - 1];
      if (ult && ult.x === p.x && ult.y === p.y) return;
      setPoli([...poli, p]);
    }
  };

  // ---------- gestos do 3D: arrastar gira, clique seleciona ----------
  const drag = useRef(null);
  const v3dDown = (e) => {
    if (e.button === 1) { const agora = Date.now(); if (agora - meioClique.current < 350 && three.current) { const b = limites(); three.current.alvo = { x: 0, y: 1, z: 0 }; three.current.dist = Math.max(14, Math.max(b.x1 - b.x0, b.y1 - b.y0) * 1.6); desenhar3d(); meioClique.current = 0; return; } meioClique.current = agora; }
    const g = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moveu: false, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, direito: e.button === 2, panear: e.button === 1 || e.button === 2, menu: false };
    if (e.pointerType === "touch") { const cx = e.clientX, cy = e.clientY, ev = { clientX: cx, clientY: cy }; g.timer = setTimeout(() => { if (drag.current === g && !g.moveu) { g.menu = true; abrirMenuCtx(cx, cy, pegar3d(ev)); } }, 550); }
    drag.current = g; e.currentTarget.setPointerCapture(e.pointerId);
  };
  const v3dMove = (e) => {
    const T = three.current, g = drag.current; if (!g || !T) return;
    if (!g.moveu && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 5) { g.moveu = true; clearTimeout(g.timer); }
    if (!g.moveu || g.menu) return;
    if (g.panear) {
      // rodinha ou botão direito arrastando: move a câmera de lado (pan)
      const THREE = window.THREE, dir = new THREE.Vector3(); T.camera.getWorldDirection(dir);
      const dirX = new THREE.Vector3().crossVectors(dir, T.camera.up).normalize(), dirY = new THREE.Vector3().crossVectors(dirX, dir).normalize();
      const k = T.dist * 0.0016, a = T.alvo || { x: 0, y: 1, z: 0 };
      const mx = -(e.clientX - g.x) * k, my = (e.clientY - g.y) * k;
      T.alvo = { x: a.x + dirX.x * mx + dirY.x * my, y: a.y + dirX.y * mx + dirY.y * my, z: a.z + dirX.z * mx + dirY.z * my };
      g.x = e.clientX; g.y = e.clientY; desenhar3d(); return;
    }
    T.theta -= (e.clientX - g.x) * 0.01;
    T.phi = Math.min(Math.PI - 0.05, Math.max(0.05, T.phi - (e.clientY - g.y) * 0.01)); // deixa passar do horizonte: dá para olhar de baixo
    g.x = e.clientX; g.y = e.clientY; desenhar3d();
  };
  const v3dUp = (e) => {
    const g = drag.current; drag.current = null;
    if (!g) return;
    clearTimeout(g.timer);
    if (g.moveu || g.menu) return;
    if (g.direito) { abrirMenuCtx(e.clientX, e.clientY, pegar3d(e)); return; }
    const k = pegar3d(e);
    if (ferramenta !== "selecionar" && ferramenta !== "mover") trocarFerramenta("selecionar");
    if (!k) { if (!g.shift && !g.ctrl) setSel([]); return; }
    aplicarSelecao([k], g);
  };

  // ---------- números ----------
  const L = paredes.reduce((s, w) => s + tpLen(w), 0);
  const A = paredes.reduce((s, w) => s + tpLen(w) * w.h, 0);
  const somaArea = (tipo, f) => areas.filter((a) => a.tipo === tipo).reduce((s, a) => s + f(a), 0);
  const areaCp = somaArea("contrapiso", (a) => tpAreaPoli(a.pts)), volCp = somaArea("contrapiso", (a) => tpAreaPoli(a.pts) * (a.esp || 0));
  const areaLj = somaArea("laje", (a) => tpAreaPoli(a.pts)), volLj = somaArea("laje", (a) => tpAreaPoli(a.pts) * (a.esp || 0));
  const analise = useMemo(() => tpAnaliseAreas(areas), [areas]);
  const telProj = somaArea("telhado", (a) => geoTelhado(a).areaProjecao), telReal = somaArea("telhado", (a) => geoTelhado(a).areaReal);
  const comum = (lista, f) => { if (!lista.length) return null; const v0 = f(lista[0]); return lista.every((x) => Math.abs(f(x) - v0) < 1e-9) ? v0 : null; };

  // ---------- estilos ----------
  const btn = { padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#111827", fontSize: 13.5, fontWeight: 500, cursor: "pointer", minHeight: 36, fontFamily: "inherit" };
  const btnPerigo = { ...btn, background: "#b91c1c", borderColor: "#b91c1c", color: "#fff" };
  const secao = { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af", margin: "18px 0 8px" };
  const lbl = { fontSize: 12, color: "#4b5563", marginBottom: 4 };
  const inp = { width: "100%", boxSizing: "border-box", padding: "7px 8px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, fontVariantNumeric: "tabular-nums", fontFamily: "inherit" };
  const linhaQ = { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, padding: "6px 0", borderBottom: "1px solid #f0f2f5", fontSize: 13 };
  const numQ = { fontWeight: 600, color: "#111827", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const pane = { position: "relative", background: "#fff", minWidth: 0, minHeight: 0, overflow: "hidden" };
  const tag = { position: "absolute", top: 10, left: 12, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9ca3af", pointerEvents: "none", zIndex: 1 };
  const ctrl = { width: 34, height: 34, borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 16, fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" };

  const FERRAMENTAS = [
    { id: "selecionar", rotulo: "Selecionar", dica: "Selecionar (V): clique ou arraste; Ctrl soma, Shift tira" },
    { id: "parede", rotulo: "Parede", dica: "Parede (P): clique ponto a ponto" },
    { id: "contrapiso", rotulo: "Contrapiso", dica: "Contrapiso (C): clique os cantos e feche no primeiro ponto" },
    { id: "laje", rotulo: "Laje", dica: "Laje (L): clique os cantos e feche no primeiro ponto" },
    { id: "telhado", rotulo: "Telhado", dica: "Telhado (T): contorno; inclinação definida em cada lado" },
    { id: "terreno", rotulo: "Terreno", dica: "Terreno (R): clique os vértices do lote e feche no primeiro ponto" },
    { id: "ambiente", rotulo: "Ambiente", dica: "Ambiente (A): clique dentro de um cômodo fechado por paredes" },
    { id: "separador", rotulo: "Separador", dica: "Separador de ambiente (S): linha que divide ambientes sem parede, como cozinha integrada" },
    { id: "mover", rotulo: "Mover", dica: "Mover a vista (H)" },
  ];
  const MODOS = [{ id: "planta", rotulo: "Planta" }, { id: "ambos", rotulo: "Planta + 3D" }, { id: "3d", rotulo: "3D" }];
  const mostraPlanta = modo !== "3d", mostra3d = modo !== "planta";

  const desenhoAtivo = ferramenta === "parede" || tpEhPoli(ferramenta);
  const status = (ferramenta === "separador" && dividir) ? `Dividindo "${(areas[dividir.ai] || {}).nome || "ambiente"}": clique de uma parede até a outra (pode quebrar a linha). Esc cancela.`
    : ferramenta === "separador" ? (inicio ? "Clique o fim da linha. Esc cancela." : "Separador: linha que divide ambientes sem parede. Clique de uma parede até a outra.")
    : ferramenta === "ambiente" ? "Clique dentro de um cômodo fechado por paredes para criar o ambiente (nome e área)."
    : digitado ? `Comprimento: ${digitado} m — Enter confirma, Esc apaga.`
    : (desenhoAtivo && modoTraco === "retangulo") ? (ancora && ancora.ret
        ? (ancora.d1 ? `1ª medida ${tpFmt(Math.abs(ancora.d1.v))} m fixada. Digite a 2ª e Enter, ou clique para escolher o lado.` : "Aponte o cursor para o lado e digite a 1ª medida + Enter (ou clique o canto oposto). Esc cancela.")
        : "Retângulo: clique o primeiro canto.")
    : (desenhoAtivo && modoTraco === "arco") ? (ancora && ancora.arcoFim ? "Mova para curvar e clique um ponto da curva. Esc cancela." : ((ferramenta === "parede" ? inicio : poli.length) ? "Arco: clique o ponto final." : "Arco: clique o ponto inicial."))
    : (selA.length === 1 && !selP.length && ferramenta === "selecionar") ? "Editar contorno: arraste os quadrados (cantos) ou as bolinhas (lados). O cursor gruda nas quinas das paredes (quadrado verde)."
    : (selP.length === 1 && !selA.length && ferramenta === "selecionar") ? "Arraste os quadrados das pontas para esticar ou girar a parede. Delete exclui."
    : ferramenta === "selecionar"
    ? (sel.length ? `${sel.length} selecionado${sel.length === 1 ? "" : "s"}. Ctrl soma, Shift tira, setas movem, Delete exclui, Esc limpa.` : "Clique ou arraste uma área (esq.→dir.: inteiro dentro; dir.→esq.: o que tocar). Ctrl soma, Shift tira. Tecla ? mostra os atalhos.")
    : ferramenta === "mover" ? "Arraste para mover a vista."
    : ferramenta === "parede" ? (inicio ? "Clique para fechar o trecho ou digite o comprimento e Enter. Shift trava em 90°. Enter encerra." : "Clique para iniciar uma parede. Arraste para mover a vista.")
    : (poli.length ? `${poli.length} ponto${poli.length === 1 ? "" : "s"}. Clique no primeiro ponto (ou Enter) para fechar; Esc cancela.` : (ferramenta === "terreno" ? "Clique nos vértices do lote (divisas) e feche no primeiro ponto." : ferramenta === "telhado" ? "Clique nos cantos do telhado (contorno na linha das paredes; o beiral é somado depois) e feche no primeiro ponto." : `Clique nos cantos ${ferramenta === "laje" ? "da laje" : "do contrapiso"} e feche no primeiro ponto.`));

  // ---------- propriedades ----------
  const propriedades = sel.length > 0 && (
    <>
      <div style={secao}>Propriedades</div>
      <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 8 }}>
          {selP.length && !selA.length ? (selP.length === 1 ? "Parede" : `${selP.length} paredes`)
            : selA.length && !selP.length ? (selA.length === 1 ? TP_AREA_TIPOS[areas[selA[0]].tipo].nome : `${selA.length} áreas`)
            : `${sel.length} elementos`}
        </div>
        {selP.length > 0 && !selA.length && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {selP.length === 1 && <div style={{ gridColumn: "1 / -1" }}><TpCampo id="tp-p-comp" rotulo="Comprimento (m)" valor={tpLen(paredes[selP[0]])} onConfirmar={(v) => mudarComprimento(selP[0], v)} /></div>}
            <TpCampo id="tp-p-alt" rotulo="Altura (m)" valor={comum(selP, (i) => paredes[i].h)} onConfirmar={(v) => editarParedes(selP, (w) => ({ ...w, h: v }))} />
            <TpCampo id="tp-p-esp" rotulo="Espessura (cm)" casas={0} valor={comum(selP, (i) => Math.round(paredes[i].t * 100))} onConfirmar={(v) => editarParedes(selP, (w) => ({ ...w, t: v / 100 }))} />
          </div>
        )}
        {selA.length === 1 && !selP.length && areas[selA[0]].tipo === "separador" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
            <TpCampo id="tp-sep-comp" rotulo="Comprimento (m)" valor={tpLen({ a: areas[selA[0]].pts[0], b: areas[selA[0]].pts[1] })}
              onConfirmar={(Lnovo) => editarAreas([selA[0]], (x) => { const a = x.pts[0], b = x.pts[1], l0 = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { ...x, pts: [a, { x: r3(a.x + (b.x - a.x) / l0 * Lnovo), y: r3(a.y + (b.y - a.y) / l0 * Lnovo) }] }; })} />
            <div style={{ fontSize: 11.5, color: "#4b5563", lineHeight: 1.4 }}>Divide ambientes sem parede (ex.: cozinha integrada à sala). Não entra no quantitativo. Arraste as pontas para ajustar.</div>
          </div>
        )}
        {selA.length === 1 && !selP.length && areas[selA[0]].tipo === "ambiente" && (() => {
          const ai = selA[0], a = areas[ai];
          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="tp-amb-nome" style={{ display: "block", fontSize: 12, color: "#4b5563", marginBottom: 4 }}>Nome</label>
                <input id="tp-amb-nome" key={"amb" + ai + (a.nome || "")} defaultValue={a.nome || ""}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== a.nome) editarAreas([ai], (x) => ({ ...x, nome: v })); }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  style={{ width: "100%", boxSizing: "border-box", padding: "7px 8px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, fontFamily: "inherit" }} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                  {TP_NOMES_AMBIENTE.slice(0, 9).map((n) => (
                    <button key={n} onClick={() => editarAreas([ai], (x) => ({ ...x, nome: n }))} style={{ border: "1px solid #e5e7eb", background: a.nome === n ? "#eef5ff" : "#fff", color: a.nome === n ? TP_AZUL : "#374151", borderRadius: 999, padding: "3px 9px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{n}</button>
                  ))}
                </div>
              </div>
              <TpCampo id="tp-amb-area" rotulo="Área (m²)" valor={tpAreaPoli(a.pts)} somenteLeitura onConfirmar={() => {}} />
              <TpCampo id="tp-amb-per" rotulo="Perímetro (m)" valor={tpPerimPoli(a.pts)} somenteLeitura onConfirmar={() => {}} />
              <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: a.aberto ? "#92400e" : "#4b5563", lineHeight: 1.4 }}>
                {a.aberto ? "As paredes em volta não fecham mais este cômodo; a área mostrada é a última válida." : "Área pela face interna das paredes. Mexeu nas paredes, ela se refaz sozinha."}
              </div>
            </div>
          );
        })()}
        {selA.length === 1 && !selP.length && areas[selA[0]].tipo === "telhado" && (() => {
          const ai = selA[0], a = areas[ai], g = geoTelhado(a);
          const mudarLado = (k, patch) => editarAreas([ai], (x) => ({ ...x, lados: x.pts.map((_, j) => ({ inclina: true, pct: tpTelha(x.telha).pct, ...((x.lados || [])[j] || {}), ...(j === k ? patch : {}) })) }));
          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="tp-t-telha" style={{ display: "block", fontSize: 12, color: "#4b5563", marginBottom: 4 }}>Telha</label>
                <select id="tp-t-telha" value={tpTelha(a.telha).id} onChange={(e) => editarAreas([ai], (x) => ({ ...x, telha: e.target.value }))}
                  style={{ width: "100%", padding: "7px 8px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", background: "#fff" }}>
                  {TP_TELHAS.map((t) => <option key={t.id} value={t.id}>{t.rotulo} · {t.pct}%</option>)}
                </select>
                <button style={{ ...btn, minHeight: 28, padding: "3px 8px", fontSize: 12, marginTop: 6, width: "100%" }}
                  onClick={() => editarAreas([ai], (x) => ({ ...x, lados: x.pts.map((_, j) => ({ ...((x.lados || [])[j] || { inclina: true }), pct: tpTelha(x.telha).pct })) }))}>
                  Usar {tpTelha(a.telha).pct}% nos lados inclinados
                </button>
              </div>
              <TpCampo id="tp-t-beiral" rotulo="Beiral (cm)" casas={0} min={-0.0001} valor={Math.round((a.beiral || 0) * 100)} onConfirmar={(v) => editarAreas([ai], (x) => ({ ...x, beiral: v / 100 }))} />
              <div style={{ minWidth: 0 }}>
                <TpCampo id="tp-a-cota" rotulo="Nível do apoio (m)" min={-0.0001} valor={g.cota} onConfirmar={(v) => editarAreas([ai], (x) => ({ ...x, cota: v, cotaManual: true }))} />
                {a.cotaManual
                  ? <button style={{ border: "none", background: "none", color: TP_AZUL, fontSize: 11.5, padding: "3px 0 0", cursor: "pointer", fontFamily: "inherit" }} onClick={() => editarAreas([ai], (x) => ({ ...x, cotaManual: false }))}>Voltar ao automático</button>
                  : <div style={{ fontSize: 11, color: "#6b7280", paddingTop: 3 }}>automático: topo da laje/paredes</div>}
              </div>
              <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#4b5563", marginTop: 2 }}>Lados (o número aparece na planta)</div>
              <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
                {g.lados.map((L, k) => (
                  <div key={k} style={{ display: "grid", gridTemplateColumns: "22px 1fr 76px", gap: 6, alignItems: "center" }}>
                    <span style={{ width: 20, height: 20, borderRadius: 10, background: TP_AZUL, color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{k + 1}</span>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#111827", cursor: "pointer", minWidth: 0 }}>
                      <input type="checkbox" id={"tp-t-l" + k} checked={L.inclina} onChange={(e) => mudarLado(k, { inclina: e.target.checked })} />
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tpFmt(L.l)} m · {L.inclina ? "água" : "oitão"}</span>
                    </label>
                    {L.inclina
                      ? <TpCampo id={"tp-t-p" + k} rotulo="" casas={0} valor={L.s * 100} onConfirmar={(v) => mudarLado(k, { pct: v })} />
                      : <span style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" }}>—</span>}
                  </div>
                ))}
              </div>
              <TpCampo id="tp-t-proj" rotulo="Projeção (m²)" valor={g.areaProjecao} somenteLeitura onConfirmar={() => {}} />
              <TpCampo id="tp-t-real" rotulo="Telhado real (m²)" valor={g.areaReal} somenteLeitura onConfirmar={() => {}} />
              <TpCampo id="tp-t-cume" rotulo="Altura da cumeeira (m)" valor={g.cumeeira} somenteLeitura onConfirmar={() => {}} />
              {!g.convexo && <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "6px 8px" }}>O contorno tem canto para dentro (em L, em U). Divida em dois telhados retangulares, como no Revit; por enquanto ele aparece plano.</div>}
              <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: "#4b5563", lineHeight: 1.4 }}>Marque os lados que têm água. Todos marcados = 4 águas; dois opostos = 2 águas com oitões; um só = 1 água. O contorno muda arrastando os cantos e lados na planta.</div>
            </div>
          );
        })()}
        {selA.length > 0 && !selP.length && !(selA.length === 1 && ["telhado", "ambiente", "separador"].includes(areas[selA[0]].tipo)) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {selA.length === 1 && <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: "#4b5563", lineHeight: 1.4, background: "#eef5ff", borderRadius: 6, padding: "6px 8px" }}>Para mudar o contorno, arraste na planta os quadrados (cantos) ou as bolinhas (lados).</div>}
            {selA.length === 1 && <TpCampo id="tp-a-area" rotulo="Área (m²)" valor={tpAreaPoli(areas[selA[0]].pts)} somenteLeitura onConfirmar={() => {}} />}
            {selA.length === 1 && <TpCampo id="tp-a-per" rotulo="Perímetro (m)" valor={tpPerimPoli(areas[selA[0]].pts)} somenteLeitura onConfirmar={() => {}} />}
            <TpCampo id="tp-a-esp" rotulo="Espessura (cm)" casas={0} valor={comum(selA, (i) => Math.round((areas[i].esp || 0) * 100))} onConfirmar={(v) => editarAreas(selA, (a) => ({ ...a, esp: v / 100 }))} />
            <TpCampo id="tp-a-cota" rotulo="Nível (m)" min={-0.0001} valor={comum(selA, (i) => areas[i].cota || 0)} onConfirmar={(v) => editarAreas(selA, (a) => ({ ...a, cota: v }))} />
          </div>
        )}
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button style={{ ...btnPerigo, flex: 1, minHeight: 32, padding: "4px 8px", fontSize: 12.5 }} onClick={excluirSelecao}>Excluir</button>
          <button style={{ ...btn, flex: 1, minHeight: 32, padding: "4px 8px", fontSize: 12.5 }} onClick={() => setSel([])}>Limpar seleção</button>
        </div>
      </div>
    </>
  );

  const menu = (
    <aside style={{ width: isMobile ? "min(86vw, 300px)" : 268, flexShrink: 0, background: "#fff", borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box",
      paddingTop: "max(14px, env(safe-area-inset-top, 0px))", paddingBottom: "max(14px, env(safe-area-inset-bottom, 0px))", paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: 16, overflowY: "auto",
      ...(isMobile ? { position: "absolute", top: 0, left: 0, bottom: 0, zIndex: 3, boxShadow: "4px 0 20px rgba(0,0,0,0.15)", transform: menuAberto ? "none" : "translateX(-105%)", transition: "transform .2s ease" } : {}) }}>
      <button onClick={onVoltar} style={{ ...btn, border: "none", background: "#f3f4f6", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>
        <span aria-hidden="true">←</span> Menu principal
      </button>
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", lineHeight: 1.25, wordBreak: "break-word" }}>{projeto.nome}</div>
        <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 3 }}>{nomeCliente || "Sem cliente"}</div>
      </div>

      <div style={secao}>Ferramenta</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {FERRAMENTAS.map((f) => (
          <button key={f.id} title={f.dica} onClick={() => { trocarFerramenta(f.id); if (isMobile) setMenuAberto(false); }}
            style={{ ...btn, padding: "8px 6px", fontSize: 12.5, borderColor: ferramenta === f.id ? TP_AZUL : "#e5e7eb", background: ferramenta === f.id ? "#eef5ff" : "#fff", color: ferramenta === f.id ? TP_AZUL : "#111827", fontWeight: ferramenta === f.id ? 600 : 500 }}>
            {f.rotulo}
          </button>
        ))}
      </div>

      {propriedades}

      <div style={secao}>Visualização</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
        {MODOS.map((m) => (
          <button key={m.id} onClick={() => { setModo(m.id); if (isMobile) setMenuAberto(false); }}
            style={{ ...btn, textAlign: "left", borderColor: modo === m.id ? TP_AZUL : "#e5e7eb", background: modo === m.id ? "#eef5ff" : "#fff", color: modo === m.id ? TP_AZUL : "#111827", fontWeight: modo === m.id ? 600 : 500 }}>
            {m.rotulo}
          </button>
        ))}
      </div>

      <div style={secao}>Nova parede</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div><div style={lbl}>Espessura (cm)</div><input id="tp-esp" style={inp} inputMode="decimal" value={esp} onChange={(e) => setEsp(e.target.value)} /></div>
        <div><div style={lbl}>Altura (m)</div><input id="tp-alt" style={inp} inputMode="decimal" value={alt} onChange={(e) => setAlt(e.target.value)} /></div>
      </div>
      <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 6, lineHeight: 1.4 }}>A laje nova entra no nível dessa altura, com 10 cm; o contrapiso, no nível 0 com 5 cm. Dá para mudar depois em Propriedades.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
        <button style={{ ...btn, background: TP_AZUL, borderColor: TP_AZUL, color: "#fff" }} onClick={finalizar}>Finalizar traço</button>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <button style={btn} onClick={desfazer}>Desfazer</button>
          <button style={btn} onClick={() => setConfirmarLimpar(true)}>Limpar</button>
        </div>
        {confirmarLimpar && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10, fontSize: 12.5, color: "#7f1d1d" }}>
            Apagar todas as paredes, contrapisos e lajes deste projeto?
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button style={{ ...btn, minHeight: 30, padding: "4px 10px", fontSize: 12.5 }} onClick={() => setConfirmarLimpar(false)}>Cancelar</button>
              <button style={{ ...btnPerigo, minHeight: 30, padding: "4px 10px", fontSize: 12.5 }} onClick={() => { mudar([], []); setInicio(null); setPoli([]); setConfirmarLimpar(false); }}>Apagar</button>
            </div>
          </div>
        )}
      </div>

      {podeOrcar && (
        <>
          <div style={secao}>Orçamento de obra</div>
          <button style={{ ...btn, background: "#111827", borderColor: "#111827", color: "#fff" }} onClick={() => setPainelObra("confirmar")}>
            {obraLigada ? "Atualizar orçamento da obra" : "Gerar orçamento de obra"}
          </button>
          <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 6, lineHeight: 1.4 }}>
            {obraLigada ? `Ligado à obra "${obraLigada.nome}". O botão recalcula o orçamento com o desenho atual.` : `Cria a obra "${projeto.nome}" em ${nomeCliente || "o cliente"} com o orçamento calculado pelo desenho.`}
          </div>
          {obraLigada && (
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "#374151", marginTop: 8, cursor: "pointer", lineHeight: 1.4 }}>
              <input type="checkbox" id="tp-sinc" checked={sincronizar} onChange={(e) => setSincronizar(e.target.checked)} style={{ marginTop: 2 }} />
              <span>Preencher sozinho os campos da obra com o desenho
                <span style={{ display: "block", fontSize: 11.5, color: "#6b7280" }}>
                  {sincronizar ? (ultimaSinc ? `Atualizado às ${ultimaSinc.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Paredes, área construída, laje e telhado") : "Desligado: só pelo botão"}
                </span>
              </span>
            </label>
          )}
        </>
      )}
      <button style={{ ...btn, marginTop: 8, fontSize: 12.5 }} title="Copia o desenho deste projeto (paredes, áreas, ambientes) para colar na conversa de suporte e reproduzir um problema"
        onClick={() => {
          const txt = JSON.stringify({ v: 1, nome: projeto.nome, paredes, areas });
          const ok = () => avisar("Dados do projeto copiados. Cole na conversa de suporte.");
          try { navigator.clipboard.writeText(txt).then(ok, () => { window.prompt("Copie o texto abaixo:", txt); }); } catch (err) { window.prompt("Copie o texto abaixo:", txt); }
        }}>Copiar dados do projeto (suporte)</button>
      <button style={{ ...btn, marginTop: 8, fontSize: 12.5 }} onClick={() => setVerAtalhos(true)}>Atalhos de teclado e mouse <span style={{ color: "#9ca3af" }}>(?)</span></button>

      {areas.some((a) => a.tipo === "ambiente") && (
        <>
          <div style={secao}>Ambientes</div>
          <div>
            {areas.map((a, i) => (a.tipo === "ambiente" ? (
              <button key={i} onClick={() => { trocarFerramenta("selecionar"); setSel(["a" + i]); }} style={{ ...linhaQ, width: "100%", background: "none", border: "none", borderBottom: "1px solid #f0f2f5", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <span>{a.nome || "Ambiente"}</span><span style={numQ}>{a.aberto ? "não fechado" : `${tpFmt(tpAreaPoli(a.pts))} m²`}</span>
              </button>
            ) : null))}
            <div style={{ ...linhaQ, fontWeight: 600 }}><span>Área útil</span><span style={numQ}>{tpFmt(areas.filter((a) => a.tipo === "ambiente" && !a.aberto).reduce((t, a) => t + tpAreaPoli(a.pts), 0))} m²</span></div>
          </div>
        </>
      )}

      <div style={secao}>Quantitativo</div>
      <div>
        <div style={linhaQ}><span>Paredes</span><span style={numQ}>{paredes.length} · {tpFmt(L)} m</span></div>
        <div style={linhaQ}><span>Área de parede</span><span style={numQ}>{tpFmt(A)} m²</span></div>
        <div style={linhaQ}><span>Reboco 2 faces</span><span style={numQ}>{tpFmt(A * 2)} m²</span></div>
        <div style={linhaQ}><span>Área construída (coberta)</span><span style={numQ}>{tpFmt(analise.coberta)} m²</span></div>
        <div style={linhaQ}><span>Contrapiso</span><span style={numQ}>{tpFmt(areaCp)} m² · {tpFmt(volCp)} m³</span></div>
        {analise.temCobertura && areaCp > 0 && <div style={linhaQ}><span style={{ paddingLeft: 10 }}>interno · externo</span><span style={numQ}>{tpFmt(analise.pisoInterno)} · {tpFmt(analise.pisoExterno)} m²</span></div>}
        {analise.terreno > 0 && <div style={linhaQ}><span>Terreno</span><span style={numQ}>{tpFmt(analise.terreno)} m²</span></div>}
        {analise.terreno > 0 && <div style={linhaQ}><span style={{ paddingLeft: 10 }}>Taxa de ocupação</span><span style={numQ}>{tpFmt(analise.taxaOcupacao * 100, 1)}%</span></div>}
        {analise.terreno > 0 && <div style={linhaQ}><span style={{ paddingLeft: 10 }}>Área livre (sem piso nem cobertura)</span><span style={numQ}>{tpFmt(analise.permeavel)} m²</span></div>}
        <div style={linhaQ}><span>Telhado (projeção · real)</span><span style={numQ}>{tpFmt(telProj)} · {tpFmt(telReal)} m²</span></div>
        <div style={linhaQ}><span>Laje</span><span style={numQ}>{tpFmt(areaLj)} m² · {tpFmt(volLj)} m³</span></div>
      </div>
      <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 10, lineHeight: 1.4 }}>Teste: salvo só neste navegador. Medidas brutas, sem descontar aberturas; os materiais virão do motor do orçamento de obra.</div>
    </aside>
  );

  const barraFerramentas = (
    <div style={{ position: "absolute", left: 12, top: 32, right: 56, display: "flex", flexWrap: "wrap", gap: 4, zIndex: 1, pointerEvents: "none" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 2, background: "rgba(255,255,255,0.94)", borderRadius: 10, padding: 3, border: "1px solid #e5e7eb", pointerEvents: "auto" }}>
        {FERRAMENTAS.map((f) => (
          <button key={f.id} title={f.dica} onClick={() => trocarFerramenta(f.id)}
            style={{ border: "none", borderRadius: 7, padding: isMobile ? "6px 7px" : "6px 10px", fontSize: isMobile ? 12 : 12.5, cursor: "pointer", fontFamily: "inherit", background: ferramenta === f.id ? TP_AZUL : "transparent", color: ferramenta === f.id ? "#fff" : "#374151", fontWeight: 600 }}>
            {f.rotulo}
          </button>
        ))}
      </div>
      {(ferramenta === "parede" || tpEhPoli(ferramenta)) && (
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.94)", borderRadius: 10, padding: 3, border: "1px solid #e5e7eb", pointerEvents: "auto" }}>
          {TP_MODOS_TRACO.map((m) => (
            <button key={m.id} title={m.dica} onClick={() => { setModoTraco(m.id); setAncora(null); setDigitado(""); if (m.id === "retangulo") { setInicio(null); } }}
              style={{ border: "none", borderRadius: 7, padding: isMobile ? "6px 7px" : "6px 10px", fontSize: isMobile ? 12 : 12.5, cursor: "pointer", fontFamily: "inherit", background: modoTraco === m.id ? "#111827" : "transparent", color: modoTraco === m.id ? "#fff" : "#374151", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                {m.id === "linha" && <path d="M2 12 L6 4 L12 7" />}
                {m.id === "retangulo" && <rect x="2" y="3" width="10" height="8" />}
                {m.id === "arco" && <path d="M2 11 Q7 1 12 11" />}
              </svg>
              {m.rotulo}
            </button>
          ))}
        </div>
      )}
      {poli.length >= 3 && (
        <button onClick={finalizarPoli} style={{ ...btn, minHeight: 32, padding: "4px 10px", fontSize: 12.5, background: TP_AZUL, borderColor: TP_AZUL, color: "#fff", pointerEvents: "auto" }}>Fechar {ferramenta === "laje" ? "laje" : ferramenta === "telhado" ? "telhado" : ferramenta === "terreno" ? "terreno" : "contrapiso"}</button>
      )}
    </div>
  );

  return (
    <div onContextMenu={(e) => { const tg = (e.target && e.target.tagName) || ""; if (tg !== "INPUT" && tg !== "TEXTAREA") e.preventDefault(); }}
      style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", background: "#e5e7eb", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      {menu}
      {isMobile && menuAberto && <div onClick={() => setMenuAberto(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 2 }} />}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderBottom: "1px solid #e5e7eb",
          paddingTop: isMobile ? "max(8px, env(safe-area-inset-top, 0px))" : 8, paddingBottom: 8, paddingLeft: isMobile ? "max(12px, env(safe-area-inset-left, 0px))" : 14, paddingRight: "max(12px, env(safe-area-inset-right, 0px))" }}>
          {isMobile && <button aria-label="Abrir menu do projeto" onClick={() => setMenuAberto(true)} style={{ ...ctrl, fontSize: 18 }}>☰</button>}
          <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isMobile ? "nowrap" : "normal" }}>
            {isMobile && <strong style={{ color: "#111827", marginRight: 6 }}>{projeto.nome}</strong>}
            {status}
          </div>
          {isMobile && (
            <div style={{ display: "flex", gap: 4 }}>
              {MODOS.map((m) => <button key={m.id} onClick={() => setModo(m.id)} style={{ ...btn, minHeight: 30, padding: "4px 8px", fontSize: 12, borderColor: modo === m.id ? TP_AZUL : "#e5e7eb", color: modo === m.id ? TP_AZUL : "#374151", background: modo === m.id ? "#eef5ff" : "#fff" }}>{m.id === "ambos" ? "2" : m.rotulo}</button>)}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "grid", gap: 1, background: "#e5e7eb",
          gridTemplateColumns: modo === "ambos" && !isMobile ? "1fr 1fr" : "1fr", gridTemplateRows: modo === "ambos" && isMobile ? "1fr 1fr" : "1fr",
          paddingBottom: "env(safe-area-inset-bottom, 0px)", paddingRight: "env(safe-area-inset-right, 0px)" }}>
          <div ref={planBox} style={{ ...pane, display: mostraPlanta ? "block" : "none" }}>
            <span style={tag}>Planta baixa · grade 0,50 m</span>
            <canvas ref={planRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor: ferramenta === "mover" ? "grab" : ferramenta === "selecionar" ? "default" : "crosshair" }}
              onContextMenu={(e) => e.preventDefault()} onDoubleClick={() => { if (poli.length >= 3) finalizarPoli(); }}
              onPointerDown={planDown} onPointerMove={(e) => { planMove(e); if (!gesto.current && ferramenta === "selecionar") e.currentTarget.style.cursor = alcaNoPonto(devPx(e)) ? "move" : "default"; }} onPointerUp={planUp} onPointerLeave={() => { if (!inicio && !poli.length && !gesto.current) setHover(null); }} />
            {barraFerramentas}
            {aviso && (
              <div role="status" style={{ position: "absolute", left: "50%", bottom: 64, transform: "translateX(-50%)", zIndex: 2, maxWidth: "min(460px, 90%)", background: "#111827", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 13, lineHeight: 1.4, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>{aviso}</div>
            )}
            {digitado && (
              <div style={{ position: "absolute", left: "50%", top: 74, transform: "translateX(-50%)", zIndex: 1, background: "#111827", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
                {modoTraco === "retangulo" && ancora && ancora.ret ? (ancora.d1 ? "2ª medida: " : "1ª medida: ") : ""}{digitado} m <span style={{ fontWeight: 400, opacity: 0.7, fontSize: 12, marginLeft: 6 }}>Enter</span>
              </div>
            )}
            <div style={{ position: "absolute", right: 12, bottom: 12, display: "flex", flexDirection: "column", gap: 6, zIndex: 1 }}>
              <button aria-label="Aproximar" style={ctrl} onClick={() => zoom(1.25)}>+</button>
              <button aria-label="Afastar" style={ctrl} onClick={() => zoom(1 / 1.25)}>−</button>
              <button aria-label="Ajustar à tela" title="Ajustar à tela" style={{ ...ctrl, fontSize: 13 }} onClick={ajustar}>⤢</button>
            </div>
          </div>
          <div ref={v3dBox} style={{ ...pane, display: mostra3d ? "block" : "none" }}>
            <span style={tag}>3D · arraste para girar, clique para selecionar</span>
            <canvas ref={v3dRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none" }}
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={v3dDown} onPointerMove={v3dMove} onPointerUp={v3dUp} />
            {erro3d && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", fontSize: 13, padding: 16, textAlign: "center" }}>{erro3d} Verifique a conexão e abra o projeto de novo.</div>}
          </div>
        </div>
        {sel.length > 0 && (
          <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: "calc(14px + env(safe-area-inset-bottom, 0px))", display: "flex", gap: 6, zIndex: 2, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 6, boxShadow: "0 4px 14px rgba(0,0,0,0.12)", alignItems: "center", whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 12.5, color: "#374151", padding: "0 6px", fontWeight: 600 }}>{sel.length} selecionado{sel.length === 1 ? "" : "s"}</span>
            {isMobile && <button onClick={() => setMenuAberto(true)} style={{ ...btn, minHeight: 30, padding: "4px 10px", fontSize: 12.5 }}>Editar</button>}
            <button onClick={excluirSelecao} style={{ ...btnPerigo, minHeight: 30, padding: "4px 10px", fontSize: 12.5 }}>Excluir</button>
            <button onClick={() => setSel([])} aria-label="Limpar seleção" style={{ ...btn, minHeight: 30, padding: "4px 10px", fontSize: 12.5 }}>✕</button>
          </div>
        )}
      </main>

      {painelObra && (() => {
        const conv = tpDesenhoParaObra(paredes, areas);
        const vazio = !paredes.length && !areas.length;
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 20, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div role="dialog" aria-modal="true" style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", padding: 20, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
              {painelObra === "feito" ? (
                <>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>Orçamento gerado</div>
                  <div style={{ fontSize: 14, color: "#374151", margin: "8px 0 16px", lineHeight: 1.5 }}>
                    A obra <strong>{(obraLigada && obraLigada.nome) || projeto.nome}</strong> está em Clientes → {nomeCliente} → Obras, já com o orçamento calculado.
                    Complete lá o que o desenho ainda não tem (padrão, cômodos, esquadrias, fundação, prestadores) e clique em Recalcular.
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}><button style={btn} onClick={() => setPainelObra(null)}>Fechar</button></div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>{obraLigada ? "Atualizar orçamento da obra" : "Gerar orçamento de obra"}</div>
                  <div style={{ fontSize: 13.5, color: "#374151", margin: "6px 0 12px", lineHeight: 1.5 }}>
                    {obraLigada
                      ? <>Vai atualizar a obra <strong>{obraLigada.nome}</strong> com estes valores e recalcular o orçamento. O resto dos dados da obra fica como está.</>
                      : <>Vai criar a obra <strong>{projeto.nome}</strong> em <strong>{nomeCliente}</strong>, com estes valores, e calcular o orçamento:</>}
                  </div>
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                    {conv.linhas.map(([k, v], i) => (
                      <div key={k + i} style={{ display: "flex", gap: 12, padding: "7px 10px", fontSize: 13, borderTop: i ? "1px solid #f0f2f5" : "none" }}>
                        <span style={{ flex: "0 0 42%", color: "#4b5563" }}>{k}</span><span style={{ color: "#111827", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 10, lineHeight: 1.45 }}>
                    Medidas brutas (sem descontar portas e janelas), parede externa identificada pelo contorno da casa. Por enquanto só obra térrea.
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                    <button style={btn} onClick={() => setPainelObra(null)}>Cancelar</button>
                    <button style={{ ...btn, background: TP_AZUL, borderColor: TP_AZUL, color: "#fff", opacity: vazio ? 0.5 : 1 }} disabled={vazio} onClick={gerarObra}>
                      {obraLigada ? "Atualizar e recalcular" : "Criar obra e orçamento"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {novoAmbiente && (
        <div style={{ position: "fixed", inset: 0, zIndex: 20, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div role="dialog" aria-modal="true" style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 420, padding: 20, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>Novo ambiente</div>
            <div style={{ fontSize: 13, color: "#4b5563", margin: "4px 0 12px" }}>Área: <strong>{tpFmt(tpAreaPoli(novoAmbiente.pts))} m²</strong> · perímetro {tpFmt(tpPerimPoli(novoAmbiente.pts))} m</div>
            <label htmlFor="tp-amb-novo" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Nome</label>
            <input id="tp-amb-novo" autoFocus value={novoAmbiente.nome} placeholder="Ex.: Suíte" onChange={(e) => setNovoAmbiente({ ...novoAmbiente, nome: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") confirmarAmbiente(novoAmbiente.nome); if (e.key === "Escape") setNovoAmbiente(null); }}
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, fontFamily: "inherit" }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {TP_NOMES_AMBIENTE.map((n) => (
                <button key={n} onClick={() => confirmarAmbiente(n)} style={{ border: "1px solid #e5e7eb", background: "#fff", color: "#374151", borderRadius: 999, padding: "5px 11px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{n}</button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button style={btn} onClick={() => setNovoAmbiente(null)}>Cancelar</button>
              <button style={{ ...btn, background: TP_AZUL, borderColor: TP_AZUL, color: "#fff" }} onClick={() => confirmarAmbiente(novoAmbiente.nome)}>Criar ambiente</button>
            </div>
          </div>
        </div>
      )}

      {verAtalhos && (
        <div style={{ position: "fixed", inset: 0, zIndex: 20, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div role="dialog" aria-modal="true" style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto", padding: 20, boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>Atalhos</div>
              <button style={btn} onClick={() => setVerAtalhos(false)}>Fechar</button>
            </div>
            {[
              ["Seleção", [["Clique", "seleciona (substitui)"], ["Ctrl + clique / área", "soma à seleção"], ["Shift + clique / área", "tira da seleção"], ["Arrastar esq. → dir.", "pega o que está inteiro dentro"], ["Arrastar dir. → esq.", "pega o que a área tocar"], ["Ctrl + A", "seleciona tudo"], ["Setas", "movem a seleção 0,10 m (Shift: 1,00 m)"], ["Delete", "exclui a seleção"], ["Botão direito", "menu de ações (no celular: toque longo)"]]],
              ["Desenho", [["P / C / L", "parede / contrapiso / laje"], ["V", "selecionar"], ["Digitar número + Enter", "trecho com esse comprimento, na direção do cursor"], ["Shift (desenhando)", "trava em 0° / 90°"], ["Pontas existentes", "o cursor gruda nelas (ímã)"], ["Enter", "encerra o traço; sem traço, repete o último comando"], ["Esc", "cancela em camadas: número → traço → seleção"]]],
              ["Vista", [["Rodinha", "zoom no cursor"], ["Arrastar com rodinha ou botão direito", "move a vista (planta e 3D)"], ["Duplo clique na rodinha / Z / F", "ajustar à tela"], ["Arrastar no 3D", "gira"], ["H", "ferramenta mover"]]],
              ["Histórico", [["Ctrl + Z", "desfazer"], ["Ctrl + Y / Ctrl + Shift + Z", "refazer"]]],
            ].map(([titulo, linhas]) => (
              <div key={titulo} style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af", marginBottom: 4 }}>{titulo}</div>
                {linhas.map(([k, d]) => (
                  <div key={k} style={{ display: "flex", gap: 12, padding: "5px 0", borderBottom: "1px solid #f0f2f5", fontSize: 13 }}>
                    <span style={{ flex: "0 0 44%", fontWeight: 600, color: "#111827" }}>{k}</span>
                    <span style={{ color: "#4b5563" }}>{d}</span>
                  </div>
                ))}
              </div>
            ))}
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 12 }}>Seguem a convenção do Revit; onde ele não tem atalho, AutoCAD e SketchUp.</div>
          </div>
        </div>
      )}

      {menuCtx && (() => {
        const desenhando = !!inicio || poli.length > 0;
        const item = (rotulo, atalho, acao, opts = {}) => (
          <button key={rotulo} role="menuitem" disabled={opts.desativado}
            onClick={() => { setMenuCtx(null); acao(); }}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, width: "100%", border: "none", background: "transparent", padding: "0 20px", height: 34, borderRadius: 0, fontSize: 14, fontFamily: "inherit", textAlign: "left",
              cursor: opts.desativado ? "default" : "pointer", color: opts.desativado ? "#9aa0a6" : (opts.perigo ? "#c5221f" : "#202124"), fontWeight: 400 }}
            onMouseEnter={(e) => { if (!opts.desativado) e.currentTarget.style.background = "#f1f3f4"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
            <span>{rotulo}</span>{atalho && <span style={{ fontSize: 13, color: "#5f6368" }}>{atalho}</span>}
          </button>
        );
        const linha = (k) => <div key={k} style={{ height: 1, background: "#dadce0", margin: "6px 0" }} />;
        return (
          <>
            {/* No Windows o evento "contextmenu" chega DEPOIS de soltar o botão direito —
                ou seja, depois de o menu abrir, já em cima desta camada. Ignorar os
                primeiros 400 ms evita que o próprio clique que abriu o feche. */}
            <div onPointerDown={() => { if (Date.now() - menuCtx.t > 150) setMenuCtx(null); }} onContextMenu={(e) => { e.preventDefault(); if (Date.now() - menuCtx.t > 400) setMenuCtx(null); }} style={{ position: "fixed", inset: 0, zIndex: 9 }} />
            <div role="menu" ref={menuRef} onContextMenu={(e) => e.preventDefault()} style={{ position: "fixed", left: menuCtx.x, top: menuCtx.y, zIndex: 10, width: 260, maxHeight: menuCtx.maxH || "calc(100vh - 16px)", overflowY: "auto", visibility: menuCtx.medido ? "visible" : "hidden", background: "#fff", border: "none", borderRadius: 12, boxShadow: "0 2px 6px rgba(60,64,67,0.15), 0 8px 24px rgba(60,64,67,0.2)", padding: "8px 0" }}>
              {desenhando && item("Finalizar traço", "Enter", finalizar)}
              {desenhando && linha("l0")}
              {sel.length > 0 && item(`Excluir${sel.length > 1 ? ` (${sel.length})` : ""}`, "Delete", excluirSelecao, { perigo: true })}
              {sel.length > 0 && item("Editar propriedades", null, editarPropriedades, { desativado: selP.length > 0 && selA.length > 0 })}
              {selA.length === 1 && !selP.length && item("Editar contorno", null, () => { setFerramenta("selecionar"); if (modo === "3d") setModo("ambos"); })}
              {sel.length > 0 && item("Limpar seleção", "Esc", () => setSel([]))}
              {sel.length > 0 && linha("l1")}
              {item("Desfazer", "Ctrl+Z", desfazer, { desativado: !historico.current.length })}
              {item("Refazer", "Ctrl+Y", refazer, { desativado: !futuro.current.length })}
              {item("Selecionar tudo", "Ctrl+A", () => { trocarFerramenta("selecionar"); setSel([...paredes.map((_, i) => "p" + i), ...areas.map((_, i) => "a" + i)]); }, { desativado: !paredes.length && !areas.length })}
              {linha("l2")}
              {item("Desenhar parede", "P", () => trocarFerramenta("parede"))}
              {item("Inserir contrapiso", "C", () => trocarFerramenta("contrapiso"))}
              {item("Inserir laje", "L", () => trocarFerramenta("laje"))}
              {item("Inserir telhado", "T", () => trocarFerramenta("telhado"))}
              {item("Desenhar terreno", "R", () => trocarFerramenta("terreno"))}
              {menuCtx.mundo && item("Inserir ambiente aqui", "A", () => inserirAmbienteEm(menuCtx.mundo))}
              {selA.length === 1 && !selP.length && areas[selA[0]].tipo === "ambiente" && item("Dividir ambiente", null, () => { const ai = selA[0]; setFerramenta("separador"); setInicio(null); setDividir({ ai }); avisar(`Dividir "${areas[ai].nome || "ambiente"}": desenhe a linha de uma parede até a outra.`); })}
              {item("Separador de ambiente", "S", () => trocarFerramenta("separador"))}
              {linha("l3")}
              {item("Ajustar à tela", null, ajustar, { desativado: modo === "3d" })}
            </div>
          </>
        );
      })()}
    </div>
  );
}


// ───────────────────────────────────────────────────────────────
// Lista de projetos + novo projeto (nome + cliente). Fase de teste:
// guardado no localStorage deste navegador, separado por empresa — nada
// é gravado no servidor nem no cadastro do cliente.
// ───────────────────────────────────────────────────────────────
// Obra criada junto com o projeto: mesmo nome, mesmo cliente, ainda sem
// orçamento — o botão "Atualizar orçamento da obra" do editor preenche.
function tpObraDoProjeto(p) {
  return {
    id: "obra_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), clienteId: p.clienteId, nome: p.nome,
    status: "planejamento", dataInicio: "", dataFim: "", responsavel: "", descricao: "Criada a partir do Projetar.", ativo: true, clientePagaDireto: false,
    enderecoProprio: false, cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
    projetoDesenhoId: p.id,
  };
}
function tpChave(empresaId) { return "vicke-teste-projetos-" + (empresaId || "x"); }
function tpLer(empresaId) {
  try { const v = JSON.parse(localStorage.getItem(tpChave(empresaId)) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function tpGravar(empresaId, lista) {
  try { localStorage.setItem(tpChave(empresaId), JSON.stringify(lista)); } catch {}
}

function TesteProjeto({ data, usuario, save }) {
  const empresaId = usuario?.empresa_id;
  const [projetos, setProjetos] = useState(() => tpLer(empresaId));
  const [abertoId, setAbertoId] = useState(null);
  const [novo, setNovo] = useState(null);       // { nome, clienteId } enquanto o formulário está aberto
  const [excluir, setExcluir] = useState(null); // projeto aguardando confirmação
  const [busca, setBusca] = useState("");

  const clientes = (data?.clientes || []).slice().sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
  const nomeCliente = (id) => (clientes.find((c) => c.id === id) || {}).nome || "";
  const salvarLista = (lista) => { setProjetos(lista); tpGravar(empresaId, lista); };

  const aberto = projetos.find((p) => p.id === abertoId);
  if (aberto) {
    return (
      <TpEditor key={aberto.id} projeto={aberto} nomeCliente={nomeCliente(aberto.clienteId)} data={data} save={save}
        onAlterar={(p) => salvarLista(tpLer(empresaId).map((x) => (x.id === p.id ? p : x)))}
        onVoltar={() => { setProjetos(tpLer(empresaId)); setAbertoId(null); }} />
    );
  }

  const criar = () => {
    const nome = String(novo.nome || "").trim();
    if (!nome || !novo.clienteId) return;
    const agora = new Date().toISOString();
    const p = { id: "tp_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), nome, clienteId: novo.clienteId, paredes: [], criadoEm: agora, atualizadoEm: agora };
    if (novo.criarObra !== false && data && save) {
      const obra = tpObraDoProjeto(p); p.obraId = obra.id;
      save({ ...data, obras: [...(data.obras || []), obra] });
    }
    salvarLista([p, ...projetos]);
    setNovo(null); setAbertoId(p.id);
  };

  const filtrados = projetos.filter((p) => {
    const q = busca.trim().toLowerCase();
    return !q || p.nome.toLowerCase().includes(q) || nomeCliente(p.clienteId).toLowerCase().includes(q);
  });
  const dataBR = (iso) => { try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return ""; } };

  const btn = { padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#111827", fontSize: 14, fontWeight: 500, cursor: "pointer", minHeight: 38 };
  const btnAzul = { ...btn, background: TP_AZUL, borderColor: TP_AZUL, color: "#fff" };
  const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };
  const inp = { width: "100%", boxSizing: "border-box", padding: "9px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, background: "#fff" };
  const fundo = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
  const caixa = { background: "#fff", borderRadius: 12, padding: 20, width: "100%", maxWidth: 440, boxShadow: "0 10px 30px rgba(0,0,0,0.2)" };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>Projetar</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>Projetos desenhados no VICKE. Fase de teste.</div>
        </div>
        <button style={btnAzul} onClick={() => setNovo({ nome: "", clienteId: "", criarObra: true })}>+ Novo projeto</button>
      </div>

      {projetos.length > 0 && (
        <input style={inp} placeholder="Buscar por projeto ou cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
      )}

      {projetos.length === 0 ? (
        <div style={{ background: "#fff", border: "1px dashed #d1d5db", borderRadius: 12, padding: "36px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>Nenhum projeto ainda</div>
          <div style={{ fontSize: 13, color: "#6b7280", margin: "6px 0 14px" }}>Crie um projeto, escolha o cliente e comece a traçar as paredes.</div>
          <button style={btnAzul} onClick={() => setNovo({ nome: "", clienteId: "", criarObra: true })}>+ Novo projeto</button>
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          {filtrados.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderTop: i ? "1px solid #f0f2f5" : "none" }}>
              <button onClick={() => setAbertoId(p.id)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                  {nomeCliente(p.clienteId) || "Cliente não encontrado"} · {(p.paredes || []).length} parede{(p.paredes || []).length === 1 ? "" : "s"} · {dataBR(p.atualizadoEm)}
                </div>
              </button>
              <button style={{ ...btn, padding: "6px 10px", minHeight: 32, fontSize: 13 }} onClick={() => setAbertoId(p.id)}>Abrir</button>
              <button style={{ ...btn, padding: "6px 10px", minHeight: 32, fontSize: 13, color: "#b91c1c" }} onClick={() => setExcluir(p)}>Excluir</button>
            </div>
          ))}
          {filtrados.length === 0 && <div style={{ padding: 16, fontSize: 13, color: "#6b7280" }}>Nenhum projeto com esse nome ou cliente.</div>}
        </div>
      )}

      {novo && (
        <div style={fundo}>
          <div style={caixa} role="dialog" aria-modal="true">
            <div style={{ fontSize: 17, fontWeight: 700, color: "#111827", marginBottom: 14 }}>Novo projeto</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={lbl} htmlFor="tp-novo-nome">Nome do projeto</label>
                <input id="tp-novo-nome" style={inp} autoFocus placeholder="Ex.: Residência Silva" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
              </div>
              <div>
                <label style={lbl} htmlFor="tp-novo-cliente">Cliente</label>
                <select id="tp-novo-cliente" style={inp} value={novo.clienteId} onChange={(e) => setNovo({ ...novo, clienteId: e.target.value })}>
                  <option value="">Escolha o cliente</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                {clientes.length === 0 && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Nenhum cliente cadastrado. Cadastre em Clientes primeiro.</div>}
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "#374151", cursor: "pointer", lineHeight: 1.4 }}>
                <input type="checkbox" id="tp-novo-obra" checked={novo.criarObra !== false} onChange={(e) => setNovo({ ...novo, criarObra: e.target.checked })} style={{ marginTop: 2 }} />
                <span>Criar também a obra <strong>{String(novo.nome || "").trim() || "com o nome do projeto"}</strong> nas Obras do cliente, para o orçamento de obra</span>
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button style={btn} onClick={() => setNovo(null)}>Cancelar</button>
              <button style={{ ...btnAzul, opacity: String(novo.nome || "").trim() && novo.clienteId ? 1 : 0.5 }} disabled={!String(novo.nome || "").trim() || !novo.clienteId} onClick={criar}>Criar e projetar</button>
            </div>
          </div>
        </div>
      )}

      {excluir && (
        <div style={fundo}>
          <div style={caixa} role="dialog" aria-modal="true">
            <div style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>Excluir projeto?</div>
            <div style={{ fontSize: 14, color: "#374151", margin: "8px 0 18px" }}>"{excluir.nome}" e todo o desenho serão apagados deste navegador.</div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button style={btn} onClick={() => setExcluir(null)}>Cancelar</button>
              <button style={{ ...btn, background: "#b91c1c", borderColor: "#b91c1c", color: "#fff" }} onClick={() => { salvarLista(projetos.filter((p) => p.id !== excluir.id)); setExcluir(null); }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Dentro do cliente (aba Projetos): os desenhos daquele cliente, com
// abrir, excluir e novo desenho já vinculado a ele. Mesmo armazenamento
// da tela Projetar (localStorage por empresa) — um projeto criado
// lá aparece aqui e vice-versa. Só aparece para a empresa piloto.
// ───────────────────────────────────────────────────────────────
const TP_EMPRESA_PILOTO = "emp_padovan-arquitetos_moebj62t";
function tpEmpresaAtual() {
  try { return (JSON.parse(localStorage.getItem("vicke-user") || "{}") || {}).empresa_id || ""; } catch { return ""; }
}

function TpProjetosDoCliente({ cliente, data, save }) {
  const empresaId = tpEmpresaAtual();
  const [todos, setTodos] = useState(() => tpLer(empresaId));
  const [abertoId, setAbertoId] = useState(null);
  const [novoNome, setNovoNome] = useState(null);  // string enquanto a janela está aberta
  const [criarObra, setCriarObra] = useState(true);
  const [excluir, setExcluir] = useState(null);
  if (empresaId !== TP_EMPRESA_PILOTO || !cliente) return null;

  const salvarLista = (lista) => { setTodos(lista); tpGravar(empresaId, lista); };
  const meus = todos.filter((p) => p.clienteId === cliente.id);
  const aberto = meus.find((p) => p.id === abertoId);

  const btn = { padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#111827", fontSize: 14, fontWeight: 500, cursor: "pointer", minHeight: 38, fontFamily: "inherit" };
  const btnAzul = { ...btn, background: TP_AZUL, borderColor: TP_AZUL, color: "#fff" };
  const fundo = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
  const caixa = { background: "#fff", borderRadius: 12, padding: 20, width: "100%", maxWidth: 440, boxShadow: "0 10px 30px rgba(0,0,0,0.2)" };
  const dataBR = (iso) => { try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return ""; } };

  if (aberto) {
    return (
      <TpEditor key={aberto.id} projeto={aberto} nomeCliente={cliente.nome} data={data} save={save}
        onAlterar={(p) => salvarLista(tpLer(empresaId).map((x) => (x.id === p.id ? p : x)))}
        onVoltar={() => { setTodos(tpLer(empresaId)); setAbertoId(null); }} />
    );
  }

  const criar = () => {
    const nome = String(novoNome || "").trim(); if (!nome) return;
    const agora = new Date().toISOString();
    const p = { id: "tp_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), nome, clienteId: cliente.id, paredes: [], criadoEm: agora, atualizadoEm: agora };
    if (criarObra && data && save) {
      const obra = tpObraDoProjeto(p); p.obraId = obra.id;
      save({ ...data, obras: [...(data.obras || []), obra] });
    }
    salvarLista([p, ...tpLer(empresaId)]);
    setNovoNome(null); setAbertoId(p.id);
  };

  return (
    <div style={{ marginTop: 20, background: "#fff", border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between", marginBottom: meus.length ? 10 : 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Projetos desenhados <span style={{ fontSize: 11, fontWeight: 600, color: TP_AZUL, background: "#eef5ff", borderRadius: 999, padding: "2px 8px", marginLeft: 6 }}>teste</span></div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{meus.length ? `${meus.length} projeto${meus.length === 1 ? "" : "s"}` : "Nenhum desenho para este cliente ainda."}</div>
        </div>
        <button style={btnAzul} onClick={() => setNovoNome("")}>+ Novo projeto</button>
      </div>
      {meus.map((p, i) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid #f0f2f5" }}>
          <button onClick={() => setAbertoId(p.id)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{(p.paredes || []).length} parede{(p.paredes || []).length === 1 ? "" : "s"} · {dataBR(p.atualizadoEm)}</div>
          </button>
          <button style={{ ...btn, padding: "6px 10px", minHeight: 32, fontSize: 13 }} onClick={() => setAbertoId(p.id)}>Abrir</button>
          <button style={{ ...btn, padding: "6px 10px", minHeight: 32, fontSize: 13, color: "#b91c1c" }} onClick={() => setExcluir(p)}>Excluir</button>
        </div>
      ))}

      {novoNome !== null && (
        <div style={fundo}>
          <div style={caixa} role="dialog" aria-modal="true">
            <div style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>Novo projeto</div>
            <div style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 14px" }}>Cliente: {cliente.nome}</div>
            <label htmlFor="tp-cli-nome" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Nome do projeto</label>
            <input id="tp-cli-nome" autoFocus value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex.: Residência Silva"
              onKeyDown={(e) => { if (e.key === "Enter") criar(); }}
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14 }} />
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "#374151", cursor: "pointer", lineHeight: 1.4, marginTop: 12 }}>
              <input type="checkbox" id="tp-cli-obra" checked={criarObra} onChange={(e) => setCriarObra(e.target.checked)} style={{ marginTop: 2 }} />
              <span>Criar também a obra <strong>{String(novoNome || "").trim() || "com o nome do projeto"}</strong> nas Obras deste cliente, para o orçamento de obra</span>
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <button style={btn} onClick={() => setNovoNome(null)}>Cancelar</button>
              <button style={{ ...btnAzul, opacity: String(novoNome).trim() ? 1 : 0.5 }} disabled={!String(novoNome).trim()} onClick={criar}>Criar e projetar</button>
            </div>
          </div>
        </div>
      )}

      {excluir && (
        <div style={fundo}>
          <div style={caixa} role="dialog" aria-modal="true">
            <div style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>Excluir projeto?</div>
            <div style={{ fontSize: 14, color: "#374151", margin: "8px 0 18px" }}>"{excluir.nome}" e todo o desenho serão apagados deste navegador.</div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button style={btn} onClick={() => setExcluir(null)}>Cancelar</button>
              <button style={{ ...btn, background: "#b91c1c", borderColor: "#b91c1c", color: "#fff" }} onClick={() => { salvarLista(tpLer(empresaId).filter((p) => p.id !== excluir.id)); setExcluir(null); }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
