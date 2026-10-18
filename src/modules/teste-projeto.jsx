// ═══════════════════════════════════════════════════════════════
// TESTE PROJETO — protótipo de traço de parede (planta + 3D + quantitativo)
// ═══════════════════════════════════════════════════════════════
// Módulo isolado de teste: não lê nem grava nada no backend. O usuário
// clica na planta para marcar pontos; cada trecho vira uma parede com
// espessura e altura. O 3D é desenhado com Three.js, carregado sob demanda
// do cdnjs (só quando a tela abre — não entra no bundle). Quantitativo
// simples: comprimento, área, blocos 14x19x39 (12,5/m² + 5%) e reboco 2 faces.
// arraste sem atraso: a planta é redesenhada no mesmo quadro do movimento
import { useLayoutEffect as tpUseLayoutEffect } from "react";
import { flushSync as tpFlushSync } from "react-dom";

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
    if (isFinite(n) && n > min && (valor == null || Math.abs(n - valor) > 1e-9)) { const r = onConfirmar(n); setTxt(fmt(r === false ? valor : n)); }
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
// Ponto do rótulo de um cômodo: o meio dele, mesmo num cômodo em L (onde a
// média dos vértices pode cair fora ou colada numa parede) — o ponto interno
// mais afastado das bordas, preferindo o centro quando ele serve.
function tpPontoRotulo(pts) {
  if (!pts || pts.length < 3) return pts && pts[0] ? pts[0] : { x: 0, y: 0 };
  const dBorda = (q) => { let m = Infinity; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy || 1e-12; const t = Math.max(0, Math.min(1, ((q.x - a.x) * vx + (q.y - a.y) * vy) / L2)); m = Math.min(m, Math.hypot(q.x - a.x - t * vx, q.y - a.y - t * vy)); } return m; };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of pts) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
  let melhor = null, dm = -1; const N = 24;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const q = { x: x0 + (x1 - x0) * i / N, y: y0 + (y1 - y0) * j / N };
    if (!tpDentroPoli(q, pts)) continue; const d = dBorda(q); if (d > dm) { dm = d; melhor = q; }
  }
  const c = tpCentro(pts);
  if (tpDentroPoli(c, pts) && (!melhor || dBorda(c) >= 0.7 * dm)) return c;
  return melhor || c;
}
// Onde o nome do ambiente aparece: onde o usuário arrastou (se ainda estiver
// dentro do cômodo) ou no meio dele
const tpRotuloAmb = (a) => (a.rotulo && a.pts && a.pts.length >= 3 && tpDentroPoli(a.rotulo, a.pts) ? a.rotulo : tpPontoRotulo(a.pts));
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

// Pegada construída: o espaço ocupado pela casa (paredes + tudo o que elas
// fecham), visto de fora. Grade de 2 cm: as paredes bloqueiam, inunda a partir
// da borda; o que a água não alcança é a casa. Devolve os contornos externos
// (acertados nas faces de fora das paredes). Só entra contorno que fecha
// cômodo de verdade (paredes soltas não viram "casa").
function tpPegadaConstruida(paredes) {
  const ws = (paredes || []).filter((w) => tpLen(w) > 0);
  if (ws.length < 3) return [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const w of ws) for (const q of [w.a, w.b]) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
  const m = 0.6; x0 -= m; y0 -= m; x1 += m; y1 += m;
  let passo = 0.03; // os cantos são acertados nas faces depois, então a grade pode ser mais grossa
  while (((x1 - x0) / passo) * ((y1 - y0) / passo) > 1.5e6) passo *= 1.5;
  const W = Math.ceil((x1 - x0) / passo), H = Math.ceil((y1 - y0) / passo);
  const cel = new Uint8Array(W * H); // 1 = parede, 2 = fora
  const xs = [], ys = [];
  for (const w of ws) {
    const L = tpLen(w), ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L, nx = -uy, ny = ux, h = (w.t || 0) / 2, hl = L / 2 + h;
    const cx = (w.a.x + w.b.x) / 2, cy = (w.a.y + w.b.y) / 2;
    const cantos = [[hl, h], [hl, -h], [-hl, h], [-hl, -h]].map(([a, b]) => ({ x: cx + ux * a + nx * b, y: cy + uy * a + ny * b }));
    const i0 = Math.max(0, Math.floor((Math.min(...cantos.map((q) => q.x)) - x0) / passo)), i1 = Math.min(W - 1, Math.ceil((Math.max(...cantos.map((q) => q.x)) - x0) / passo));
    const j0 = Math.max(0, Math.floor((Math.min(...cantos.map((q) => q.y)) - y0) / passo)), j1 = Math.min(H - 1, Math.ceil((Math.max(...cantos.map((q) => q.y)) - y0) / passo));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const qx = x0 + (i + 0.5) * passo - cx, qy = y0 + (j + 0.5) * passo - cy;
      if (Math.abs(qx * ux + qy * uy) <= hl && Math.abs(qx * nx + qy * ny) <= h + passo * 0.5) cel[j * W + i] = 1;
    }
    if (Math.abs(uy) < 1e-6) { ys.push(cy + h, cy - h); xs.push(cx + hl, cx - hl); }
    else if (Math.abs(ux) < 1e-6) { xs.push(cx + h, cx - h); ys.push(cy + hl, cy - hl); }
  }
  const pilha = [];
  for (let i = 0; i < W; i++) for (const j of [0, H - 1]) if (!cel[j * W + i]) { cel[j * W + i] = 2; pilha.push(j * W + i); }
  for (let j = 0; j < H; j++) for (const i of [0, W - 1]) if (!cel[j * W + i]) { cel[j * W + i] = 2; pilha.push(j * W + i); }
  while (pilha.length) {
    const k = pilha.pop(), i = k % W;
    for (const n of [i > 0 ? k - 1 : -1, i < W - 1 ? k + 1 : -1, k - W, k + W]) if (n >= 0 && n < W * H && cel[n] === 0) { cel[n] = 2; pilha.push(n); }
  }
  const casa = (i, j) => i >= 0 && j >= 0 && i < W && j < H && cel[j * W + i] !== 2;
  const prox = new Map(), chave = (i, j) => j * (W + 1) + i;
  const add = (a, b) => { const l = prox.get(a); if (l) l.push(b); else prox.set(a, [b]); };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!casa(i, j)) continue;
    if (!casa(i, j - 1)) add(chave(i, j), chave(i + 1, j));
    if (!casa(i + 1, j)) add(chave(i + 1, j), chave(i + 1, j + 1));
    if (!casa(i, j + 1)) add(chave(i + 1, j + 1), chave(i, j + 1));
    if (!casa(i - 1, j)) add(chave(i, j + 1), chave(i, j));
  }
  const perto = (v, lista) => { let best = v, d = passo * 1.6; for (const c of lista) { const dd = Math.abs(c - v); if (dd < d) { d = dd; best = c; } } return best; };
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const laços = [];
  while (prox.size) {
    const ini = prox.keys().next().value, laco = [];
    let at = ini, guarda = 0;
    do { laco.push(at); const l = prox.get(at); if (!l) break; const nx = l.pop(); if (!l.length) prox.delete(at); at = nx; } while (at !== ini && ++guarda < 2e6);
    const pts = laco.map((k) => ({ x: x0 + (k % (W + 1)) * passo, y: y0 + Math.floor(k / (W + 1)) * passo }));
    const limpa = [];
    for (let k = 0; k < pts.length; k++) {
      const a = pts[(k - 1 + pts.length) % pts.length], b = pts[k], c = pts[(k + 1) % pts.length];
      if (Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) > 1e-12) limpa.push(b);
    }
    if (limpa.length < 3) continue;
    // acerta nas faces e tira os pontos que ficaram repetidos ou alinhados
    let pol = limpa.map((q) => ({ x: r3(perto(q.x, xs)), y: r3(perto(q.y, ys)) }));
    for (let mudou = true; mudou && pol.length >= 3;) {
      mudou = false;
      for (let k = 0; k < pol.length && pol.length >= 3; k++) {
        const a = pol[(k - 1 + pol.length) % pol.length], b = pol[k], c = pol[(k + 1) % pol.length];
        const igual = Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
        if (igual || Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) < 1e-9) { pol.splice(k, 1); mudou = true; k--; }
      }
    }
    if (pol.length < 3) continue;
    const A = tpAreaPoli(pol);
    // só conta se fecha cômodo: área bem maior que a das paredes dentro dele
    const tiras = ws.filter((w) => tpDentroPoli({ x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 }, pol)).reduce((s, w) => s + tpLen(w) * (w.t || 0), 0);
    if (A >= 2 && A > tiras * 1.5) laços.push(pol);
  }
  return laços;
}
// Contrapiso: interno (dentro da casa), externo, ou externo "furado" — o que
// envolve a casa (calçada em volta, quintal): vira uma peça só, com a casa
// recortada pela face de fora das paredes. Sem casa fechada, decide pela
// cobertura (laje/telhado); sem nada, é interno.
function tpTipoContrapiso(pts, pegada, cob) {
  const A = tpAreaPoli(pts);
  if (pegada && pegada.length) {
    const d = tpAreaDentro(pts, pegada), fora = A - d;
    if (fora < 0.5 || fora < A * 0.1) return "interno"; // dentro da casa (pode passar um pouco da face)
    return d > 0.3 ? "furado" : "externo";
  }
  if (cob && cob.length) return tpAreaDentro(pts, cob) >= A / 2 ? "interno" : "externo";
  return "interno";
}
// Interno × externo: área coberta = laje + telhado (contorno desenhado, sem o
// beiral). É a área construída. Contrapiso dentro da casa é piso interno;
// fora, piso externo (calçada, área de serviço descoberta). O contrapiso que
// envolve a casa conta só a parte de fora dela.
function tpAnaliseAreas(areas, paredes) {
  const ok = (a) => a.pts && a.pts.length >= 3;
  const cob = areas.filter((a) => ok(a) && (a.tipo === "laje" || a.tipo === "telhado")).map((a) => a.pts);
  const cpsAll = areas.filter((a) => ok(a) && a.tipo === "contrapiso").map((a) => a.pts);
  const ter = areas.filter((a) => ok(a) && a.tipo === "terreno").map((a) => a.pts);
  const pegada = paredes && (cpsAll.length || ter.length) ? tpPegadaConstruida(tpParedesDesenho(paredes)) : []; // contorno como desenhado (pontas pela face levadas ao eixo)
  const coberta = tpUniaoArea(cob);
  const tipos = cpsAll.map((p) => tpTipoContrapiso(p, pegada, cob));
  const internos = cpsAll.filter((_, k) => tipos[k] === "interno"), externos = cpsAll.filter((_, k) => tipos[k] === "externo");
  const furados = cpsAll.filter((_, k) => tipos[k] === "furado");
  const pisoInterno = tpUniaoArea(internos);
  const pisoExterno = tpUniaoArea(externos) + furados.reduce((s, p) => s + Math.max(0, tpAreaPoli(p) - tpAreaDentro(p, pegada)), 0);
  const terreno = tpUniaoArea(ter);
  const ocupada = tpUniaoArea([...cob, ...cpsAll, ...pegada]);
  return { coberta, pisoInterno, pisoExterno, terreno, pegada,
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
//  - m² de parede = comprimento do eixo × altura menos portas e janelas (líquido)
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
// Nome do ambiente desenhado → tipo de cômodo do orçamento de obra
// (AMBIENTES_TIPOS em composicoes-seed.jsx). Sem acento, minúsculo, sem o número.
const TP_AMBIENTE_PARA_COMODO = [
  [/^suite master|^suite principal/, "suiteMaster"], [/^suite/, "suite"],
  [/^(wc|banheiro) (da )?suite master/, "wcSuiteMaster"], [/^(wc|banheiro) (da )?suite/, "wcSuite"],
  [/^(wc|banheiro|bwc)/, "wc"], [/^lavabo (do )?lazer/, "lavaboLazer"], [/^lavabo/, "lavabo"],
  [/^(quarto|dormitorio)/, "dormitorio"], [/^cozinha/, "cozinha"],
  [/^(lavanderia|area de servico|servico)/, "lavanderia"],
  [/^(sala de jantar|jantar)/, "salaJantar"], [/^(sala tv|sala de tv|tv|sala intima)/, "salaTV"], [/^(sala|living|estar)/, "living"],
  [/^(varanda|area gourmet|espaco gourmet|gourmet|area de lazer|lazer|churrasqueira)/, "areaLazer"],
  [/^garagem/, "garagem"], [/^(circulacao|corredor|hall)/, "hallEntrada"],
  [/^closet (da )?suite/, "closetSuite"], [/^closet/, "closet"], [/^(escritorio|home office)/, "escritorio"],
  [/^(despensa|deposito|dispensa)/, "deposito"], [/^jardim/, "jardim"], [/^academia/, "academia"],
  [/^brinquedoteca/, "brinquedoteca"], [/^sauna/, "sauna"], [/^escada/, "escada"], [/^louceiro/, "louceiro"],
];
function tpComodoDoNome(nome) {
  const n = tpBaseNomeAmbiente(nome).toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  for (const [re, id] of TP_AMBIENTE_PARA_COMODO) if (re.test(n)) return id;
  return null;
}
// Ambientes desenhados → cômodos da obra: quantidade por tipo e as medidas
// (retângulo de mesma área e perímetro, média dos do mesmo tipo)
function tpComodosDoDesenho(paredes, areas) {
  const amb = areas.filter((a) => a.tipo === "ambiente" && a.pts && a.pts.length >= 3);
  const grupos = new Map(), soltos = [];
  for (const a of amb) {
    const id = tpComodoDoNome(a.nome);
    if (!id) { soltos.push(a.nome || "Ambiente"); continue; }
    const g = grupos.get(id) || { n: 0, A: 0, P: 0, nomes: [] };
    g.n++; g.A += tpAreaPoli(a.pts); g.P += tpPerimPoli(a.pts); g.nomes.push(a.nome);
    grupos.set(id, g);
  }
  const alts = paredes.map((w) => w.h || 0).filter((h) => h > 0);
  const peDireito = alts.length ? Math.round(alts.reduce((s, h) => s + h, 0) / alts.length * 100) / 100 : 2.8;
  const ambientes = {}, comodosCfg = {}, r2 = (x) => Math.round(x * 100) / 100;
  for (const [id, g] of grupos) {
    const A = g.A / g.n, s = g.P / g.n / 2, disc = Math.max(0, s * s - 4 * A);
    let L = (s + Math.sqrt(disc)) / 2, W = (s - Math.sqrt(disc)) / 2;
    if (!(W > 0.3)) { L = Math.sqrt(A); W = L; } // forma estranha: quadrado de mesma área
    ambientes[id] = g.n;
    comodosCfg[id] = { L: r2(L), W: r2(W), peDireito };
  }
  return { ambientes, comodosCfg, grupos, soltos, temAmbientes: amb.length > 0 };
}
function tpDesenhoParaObra(paredes, areas) {
  const r2 = (x) => Math.round(x * 100) / 100;
  // casa = área coberta (laje/telhado); sem cobertura, contrapiso; sem nada, envoltória das paredes
  const cobertos = areas.filter((a) => (a.tipo === "laje" || a.tipo === "telhado") && a.pts && a.pts.length >= 3);
  const pisos = cobertos.length ? cobertos : areas.filter((a) => a.tipo === "contrapiso" && a.pts && a.pts.length >= 3);
  const casco = tpEnvoltoria(paredes.flatMap((w) => [w.a, w.b]));
  // com a casa fechada, a pegada (face de fora das paredes) decide o que é fora
  const pegadaCasa = tpPegadaConstruida(tpParedesDesenho(paredes));
  const fora = (p) => (pegadaCasa.length ? !pegadaCasa.some((P) => tpDentroPoli(p, P))
    : pisos.length ? !pisos.some((a) => tpDentroPoli(p, a.pts)) : !(casco.length >= 3 && tpDentroPoli(p, casco)));
  let m2Int = 0, m2Ext = 0, m15 = 0, m20 = 0, m25 = 0, perim = 0, nExt = 0;
  // portas de madeira desenhadas: internas (kit de porta) e de banheiro (a
  // que dá para WC/lavabo); as de parede externa ficam de fora do kit
  const portas = { interna: 0, banheiro: 0, externa: 0 };
  const BANHO = new Set(["wc", "wcSuite", "wcSuiteMaster", "lavabo", "lavaboLazer"]);
  const ambs = areas.filter((a) => a.tipo === "ambiente" && a.pts && a.pts.length >= 3);
  for (const w of paredes) {
    const L = tpLen(w); if (!L) continue;
    // m² LÍQUIDO: comprimento no eixo × altura menos os vãos de portas/janelas
    const vaos = tpAbsVisiveis(w).reduce((t, o) => t + o.larg * Math.max(0, Math.min(o.alt, (w.h || 0) - (o.peit || 0))), 0);
    const m2 = Math.max(0, L * (w.h || 0) - vaos), nx = -(w.b.y - w.a.y) / L, ny = (w.b.x - w.a.x) / L, d = (w.t || 0) / 2 + 0.15;
    const mx = (w.a.x + w.b.x) / 2, my = (w.a.y + w.b.y) / 2;
    const externa = fora({ x: mx + nx * d, y: my + ny * d }) || fora({ x: mx - nx * d, y: my - ny * d });
    if (externa) { m2Ext += m2; nExt++; } else m2Int += m2;
    for (const o of tpAbsVisiveis(w)) {
      const te = tpEsq(o.tipo);
      if (!tpGiro(te.id) || (o.mat || te.mat) !== "madeira") continue;
      if (externa) { portas.externa++; continue; }
      const c = { x: w.a.x + (w.b.x - w.a.x) / L * o.x, y: w.a.y + (w.b.y - w.a.y) / L * o.x }, dd = (w.t || 0) / 2 + 0.3;
      const banho = [1, -1].some((sg) => { const q = { x: c.x + nx * dd * sg, y: c.y + ny * dd * sg }; const a = ambs.find((am) => tpDentroPoli(q, am.pts)); return a && BANHO.has(tpComodoDoNome(a.nome)); });
      if (banho) portas.banheiro++; else portas.interna++;
    }
    const cm = (w.t || 0) * 100;
    if (cm <= 16.5) m15 += m2; else if (cm <= 22.5) m20 += m2; else m25 += m2;
    perim += L;
  }
  const soma = (tipo, f) => areas.filter((a) => a.tipo === tipo && a.pts && a.pts.length >= 3).reduce((s, a) => s + f(a), 0);
  const areaCp = soma("contrapiso", (a) => tpAreaPoli(a.pts)), areaLj = soma("laje", (a) => tpAreaPoli(a.pts)), perLj = soma("laje", (a) => tpPerimPoli(a.pts));
  const an = tpAnaliseAreas(areas, paredes);
  // sem cobertura: a pegada das paredes (casa fechada); sem ela, o contrapiso interno
  const areaPegada = tpUniaoArea((an.pegada && an.pegada.length) ? an.pegada : pegadaCasa);
  const areaConstruida = an.temCobertura ? an.coberta : (areaPegada > 0 ? areaPegada : an.pisoInterno);
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
  // Esquadrias: de alumínio vão para a lista do orçamento (agrupadas pelo
  // quadro: família, folhas, medidas, quantidade). Porta de madeira é contada
  // pelos Cômodos da obra (kit de porta) e não entra aqui; vão livre também não.
  const quadro = tpQuadroEsquadrias(paredes);
  const temAberturas = paredes.some((w) => (w.ab || []).length);
  const esquadrias = quadro.grupos.filter((g) => g.familia && g.mat !== "madeira")
    .map((g) => ({ familia: g.familia, linha: "GOLD", folhas: g.folhas, qtd: g.qtd, largura: r2(g.larg), altura: r2(g.alt) }));
  const areaAb = tpAreaAberturas(paredes);
  const com = tpComodosDoDesenho(paredes, areas);
  const projeto = {
    tipologia: "Térrea",
    ...(temAberturas ? { esquadrias } : {}),
    ...(com.temAmbientes ? { ambientes: com.ambientes, comodosCfg: com.comodosCfg } : {}),
    ...(temAberturas ? { portasDesenho: { interna: portas.interna, banheiro: portas.banheiro } } : {}),
    arquitetura: { areaConstruida: r2(areaConstruida), m2ParedesInternas: r2(m2Int), m2ParedesExternas: r2(m2Ext), m2ParedesTotal: r2(m2Int + m2Ext) },
    ...(an.pisoExterno > 0 ? { externa: { pavimentacao: r2(an.pisoExterno) } } : {}),
    terreo: { area: r2(areaConstruida), m2Parede15: r2(m15), m2Parede20: r2(m20), m2Parede25: r2(m25), perimetroParedes: r2(perim),
      ...(areaLj ? { areaLoje: r2(areaLj), perimetroLoje: r2(perLj), tipoLoje: "Treliça" } : {}) },
    ...(cobertura.length ? { cobertura } : {}),
  };
  const linhas = [
    ["Tipologia", "Térrea"],
    ["Área construída", tpFmt(areaConstruida) + " m²" + (an.temCobertura ? " (área coberta)" : areaPegada > 0 ? " (pela face externa das paredes)" : an.pisoInterno ? " (contrapiso)" : "")],
    ...(an.pisoExterno > 0 ? [["Pavimentação externa", tpFmt(an.pisoExterno) + " m² (contrapiso fora da casa)"]] : []),
    ["Parede interna", tpFmt(m2Int) + " m²"],
    ["Parede externa", `${tpFmt(m2Ext)} m² (${nExt} parede${nExt === 1 ? "" : "s"})`],
    ["Por espessura", `15 cm: ${tpFmt(m15)} · 20 cm: ${tpFmt(m20)} · 25 cm: ${tpFmt(m25)} m²`],
    ["Perímetro de paredes", tpFmt(perim) + " m"],
    ...(areaLj ? [["Laje (treliçada)", `${tpFmt(areaLj)} m² · perímetro ${tpFmt(perLj)} m`]] : []),
    ...cobertura.map((c, k) => [`Telhado ${cobertura.length > 1 ? k + 1 : ""}`.trim(), `${tpTelha(c.tipo).rotulo}, ${tpFmt(c.comprimento)} × ${tpFmt(c.largura)} m, ${c.aguas} água${c.aguas === 1 ? "" : "s"}, ${tpFmt(c.inclinacao * 100, 0)}%`]),
    ...(com.temAmbientes ? [
      ["Cômodos", [...com.grupos.entries()].map(([id, g]) => `${g.n}× ${(typeof NOME_AMBIENTE === "function" ? NOME_AMBIENTE(id) : id)} (${tpFmt(com.comodosCfg[id].L)} × ${tpFmt(com.comodosCfg[id].W)} m)`).join(" · ") || "nenhum reconhecido"],
      ...(com.soltos.length ? [["Sem tipo de cômodo", `${com.soltos.join(", ")} (não entram; renomeie para um tipo conhecido)`]] : []),
    ] : []),
    ...(temAberturas ? [
      ["Esquadrias de alumínio", esquadrias.length ? quadro.grupos.filter((g) => g.familia && g.mat !== "madeira").map((g) => `${g.codigo}: ${g.qtd}× ${g.rot} ${tpFmt(g.larg)} × ${tpFmt(g.alt)}`).join(" · ") : "nenhuma"],
      ["Portas internas (madeira)", `${portas.interna + portas.banheiro} — ${portas.interna} interna${portas.interna === 1 ? "" : "s"} + ${portas.banheiro} de banheiro (kit de porta por porta desenhada)`],
      ...(portas.externa ? [["Porta de madeira em parede externa", `${portas.externa} (não entra no kit de porta interna; lance na obra)`]] : []),
      ["Aberturas nas paredes", `${tpFmt(areaAb)} m² (já descontadas do m² de parede)`],
    ] : []),
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
    // esquadrias: o desenho passa a mandar na lista quando tem portas/janelas;
    // se depois apagar todas, limpa só o que ele mesmo tinha escrito
    ...(conv.projeto.esquadrias ? { esquadrias: conv.projeto.esquadrias } : ((ant.origemDesenho || {}).esquadrias ? { esquadrias: [] } : {})),
    // cômodos: com ambientes desenhados, o desenho manda na quantidade e nas
    // medidas (comprimento, largura, pé-direito); o resto do que foi editado
    // no cômodo (revestimento, bancada) fica
    ...(conv.projeto.ambientes ? {
      ambientes: conv.projeto.ambientes,
      comodosCfg: Object.entries(conv.projeto.comodosCfg).reduce((acc, [id, c]) => ({ ...acc, [id]: { ...((ant.comodosCfg || {})[id] || {}), ...c } }), { ...(ant.comodosCfg || {}) }),
    } : ((ant.origemDesenho || {}).ambientes ? { ambientes: {} } : {})),
    ...(conv.projeto.portasDesenho ? { portasDesenho: conv.projeto.portasDesenho } : ((ant.origemDesenho || {}).portas ? { portasDesenho: null } : {})),
    origemDesenho: { projetoId, esquadrias: !!conv.projeto.esquadrias, ambientes: !!conv.projeto.ambientes, portas: !!conv.projeto.portasDesenho } };
}
// "assinatura" dos campos do desenho, para só gravar quando algo mudou
function tpAssinaturaDesenho(pr) {
  pr = pr || {};
  const a = pr.arquitetura || {}, t = pr.terreo || {};
  return JSON.stringify([pr.tipologia, a.areaConstruida, a.m2ParedesInternas, a.m2ParedesExternas, a.m2ParedesTotal,
    t.area, t.m2Parede15, t.m2Parede20, t.m2Parede25, t.perimetroParedes, t.areaLoje, t.perimetroLoje, t.tipoLoje, pr.cobertura || null, (pr.externa || {}).pavimentacao || 0, pr.esquadrias || null, pr.ambientes || null, pr.portasDesenho || null,
    pr.ambientes ? Object.keys(pr.ambientes).sort().map((id) => { const c = (pr.comodosCfg || {})[id] || {}; return [id, c.L, c.W, c.peDireito]; }) : null]);
}

// Arco por 3 pontos (início, fim e um ponto da curva), devolvido como
// trechos retos curtos (~40 cm) — é assim que parede curva e contorno curvo
// entram no quantitativo. Pontos alinhados = reta.
// Pontas em canto (exatamente duas paredes terminando no mesmo ponto): o
// canto é desenhado em meia-esquadria, para que triângulos, ângulos e curvas
// pareçam uma parede só (antes cada trecho terminava em quadrado e o canto
// fazia "dente" ou ponta). Devolve, por parede, o vizinho de cada ponta.
function tpCantosMitra(paredes) {
  const mapa = new Map(), chave = (q) => Math.round(q.x * 200) + "|" + Math.round(q.y * 200);
  paredes.forEach((w, i) => { if (!tpLen(w)) return; for (const f of ["a", "b"]) { const k = chave(w[f]); if (!mapa.has(k)) mapa.set(k, []); mapa.get(k).push({ i, f }); } });
  const out = paredes.map(() => ({ a: null, b: null }));
  for (const lista of mapa.values()) {
    if (lista.length !== 2 || lista[0].i === lista[1].i) continue;
    const [p, q] = lista;
    // outra parede passando pelo meio desse ponto (T) desfaz a meia-esquadria
    const pt = paredes[p.i][p.f];
    if (paredes.some((w, j) => j !== p.i && j !== q.i && tpLen(w) && tpDistSeg(pt, w.a, w.b) < (w.t || 0) / 2)) continue;
    out[p.i][p.f] = { j: q.i, f: q.f }; out[q.i][q.f] = { j: p.i, f: p.f };
  }
  return out;
}
// Na ponta fim da parede w (vizinha o, ponta fo), onde as faces n = −h e n = +h
// de w cortam as faces correspondentes de o: devolve [s(−h), s(+h)] ao longo de w.
// Para DESENHAR (planta e 3D): ponta de parede encostada em outra pela face,
// ou perto do eixo dela, é levada até o cruzamento dos eixos. Assim o canto
// vira canto de verdade (meia-esquadria) e o T fecha sem a linha preta da
// face atravessando. Não muda o projeto; só o desenho.
function tpParedesDesenho(paredes) {
  const r3 = (x) => Math.round(x * 1000) / 1000;
  return paredes.map((w, i) => {
    const L = tpLen(w); if (!L) return w;
    const u = { x: (w.b.x - w.a.x) / L, y: (w.b.y - w.a.y) / L };
    let nw = w;
    for (const fim of ["a", "b"]) {
      const P = w[fim]; let melhor = null;
      paredes.forEach((o, j) => {
        if (j === i) return; const Lo = tpLen(o); if (!Lo) return;
        const uo = { x: (o.b.x - o.a.x) / Lo, y: (o.b.y - o.a.y) / Lo }, cr = u.x * uo.y - u.y * uo.x;
        if (Math.abs(cr) < 0.2) return;
        // cruzamento dos eixos
        const s = ((o.a.x - w.a.x) * uo.y - (o.a.y - w.a.y) * uo.x) / cr, r = ((o.a.x - w.a.x) * u.y - (o.a.y - w.a.y) * u.x) / cr;
        const X = { x: w.a.x + u.x * s, y: w.a.y + u.y * s }, d = Math.hypot(X.x - P.x, X.y - P.y);
        const tol = (o.t || 0) / 2 + (w.t || 0) / 2 + 0.02;
        if (d < 1e-4 || d > tol) return;                       // já no eixo, ou longe
        if (r < -tol || r > Lo + tol) return;                  // a outra não chega lá
        // a ponta não pode atravessar a parede: só ajusta se o cruzamento fica além do miolo desta
        const sEnd = fim === "a" ? 0 : L; if (Math.abs(s - sEnd) > tol) return;
        if (!melhor || d < melhor.d) melhor = { d, X };
      });
      if (melhor) nw = tpComPonta(nw, fim, { x: r3(melhor.X.x), y: r3(melhor.X.y) });
    }
    return nw;
  });
}
const TP_NUCLEO = "#6e6e6e"; // miolo cinza da parede cortada na planta
function tpPontaMitra(w, fim, o, fo, h, ho) {
  const L = tpLen(w), u = { x: (w.b.x - w.a.x) / L, y: (w.b.y - w.a.y) / L }, nv = { x: -u.y, y: u.x };
  const P = w[fim], sP = fim === "a" ? 0 : L, d = fim === "a" ? u : { x: -u.x, y: -u.y };
  const Lo = tpLen(o), q = fo === "a" ? o.b : o.a, e = { x: (q.x - P.x) / Lo, y: (q.y - P.y) / Lo }, m = { x: -e.y, y: e.x };
  const cr = u.x * e.y - u.y * e.x;
  const ladoIn = Math.sign(e.x * nv.x + e.y * nv.y) || 1, kIn = Math.sign(d.x * m.x + d.y * m.y) || 1;
  const res = [-h, h].map((n0) => {
    if (Math.abs(cr) < 0.03) return sP; // praticamente em linha: corte reto no ponto
    const k = (Math.sign(n0) === ladoIn ? kIn : -kIn) * ho;
    const D = { x: P.x + m.x * k - w.a.x - nv.x * n0, y: P.y + m.y * k - w.a.y - nv.y * n0 };
    let sx = (D.x * e.y - D.y * e.x) / cr;
    const lim = 4 * Math.max(h, ho); // ângulo muito fechado: não deixa a ponta disparar
    if (sx < sP - lim) sx = sP - lim; if (sx > sP + lim) sx = sP + lim;
    return sx;
  });
  return res;
}
// Trechos curtos encadeados quase em linha (curva feita pelo Arco, ou
// paredes com w.curva igual): uma "curva" só, com uma medida só.
function tpGruposCurva(paredes) {
  const cm = tpCantosMitra(paredes), grupo = paredes.map(() => -1);
  const parece = (i, j) => {
    const a = paredes[i], b = paredes[j];
    if (a.curva != null && a.curva === b.curva) return true;
    const La = tpLen(a), Lb = tpLen(b); if (!La || !Lb || La > 1.2 || Lb > 1.2 || Math.abs(La - Lb) > 0.02) return false;
    const c = Math.abs(((a.b.x - a.a.x) * (b.b.y - b.a.y) - (a.b.y - a.a.y) * (b.b.x - b.a.x)) / La / Lb);
    return c > 0.01 && c < 0.6; // dobra pequena (até ~37°), mas não reta
  };
  let g = 0;
  paredes.forEach((_, i) => {
    if (grupo[i] >= 0) return;
    const fila = [i], membros = [i]; grupo[i] = g;
    while (fila.length) { const k = fila.pop(); for (const f of ["a", "b"]) { const v = cm[k][f]; if (v && grupo[v.j] < 0 && parece(k, v.j)) { grupo[v.j] = g; fila.push(v.j); membros.push(v.j); } } }
    if (membros.length < 3 && !membros.some((m) => paredes[m].curva != null)) membros.forEach((m) => { grupo[m] = -1; });
    else g++;
  });
  return grupo;
}
// Curvas desenhadas lisas (como no Revit): os trechos de uma curva viram
// uma faixa só, seguindo o círculo que passa pelos pontos. Cada curva traz a
// função banda(hIn, recuoPonta) → polígono (pontos do desenho) da parede com
// meia espessura hIn; nas pontas, meia-esquadria com a parede vizinha.
function tpCurvasLisas(paredes, cantos = tpCantosMitra(paredes), grupos = tpGruposCurva(paredes)) {
  const por = new Map();
  grupos.forEach((g, i) => { if (g < 0) return; if (!por.has(g)) por.set(g, []); por.get(g).push(i); });
  const out = [];
  for (const ms of por.values()) {
    if (ms.some((i) => (paredes[i].ab || []).length)) continue; // com porta/janela: fica em trechos
    const set = new Set(ms);
    const solta = (i) => ["a", "b"].find((f) => !cantos[i][f] || !set.has(cantos[i][f].j));
    const i0 = ms.find((i) => solta(i)); if (i0 == null) continue; // círculo fechado: fica em trechos
    // corrente ordenada: [{ i, ini }] — o trecho i vai de w[ini] até a outra ponta
    const ord = []; let cur = i0, ini = solta(i0); const vis = new Set();
    while (cur != null && !vis.has(cur)) {
      vis.add(cur); ord.push({ i: cur, ini });
      const fimOp = ini === "a" ? "b" : "a", c = cantos[cur][fimOp];
      if (c && set.has(c.j) && !vis.has(c.j)) { cur = c.j; ini = c.f; } else cur = null;
    }
    if (ord.length !== ms.length) continue;
    const pts = [paredes[ord[0].i][ord[0].ini], ...ord.map((o) => paredes[o.i][o.ini === "a" ? "b" : "a"])];
    const P0 = pts[0], Pn = pts[pts.length - 1], Pm = pts[Math.floor(pts.length / 2)];
    const ax = P0.x, ay = P0.y, bx = Pm.x, by = Pm.y, cx = Pn.x, cy = Pn.y;
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by)); if (Math.abs(d) < 1e-9) continue;
    const ox = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    const oy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
    const r = Math.hypot(ax - ox, ay - oy);
    if (pts.some((q) => Math.abs(Math.hypot(q.x - ox, q.y - oy) - r) > Math.max(0.02, r * 0.03))) continue; // não é um arco
    const ang = (q) => Math.atan2(q.y - oy, q.x - ox);
    let sw = 0; for (let k = 1; k < pts.length; k++) { let da = ang(pts[k]) - ang(pts[k - 1]); while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; sw += da; }
    const a0 = ang(P0), t = paredes[ord[0].i].t || 0;
    // pontas: a meia-esquadria do trecho da ponta com a parede vizinha (fora da curva)
    const ponta = (o, fim, hIn, recuo) => {
      const w = paredes[o.i], L = tpLen(w), u = { x: (w.b.x - w.a.x) / L, y: (w.b.y - w.a.y) / L }, nv = { x: -u.y, y: u.x };
      const c = cantos[o.i][fim], P = w[fim];
      let sm, sp;
      if (c && !set.has(c.j)) { const viz = paredes[c.j]; [sm, sp] = tpPontaMitra(w, fim, viz, c.f, hIn, (viz.t || 0) / 2 - recuo); }
      else { const s0 = fim === "a" ? recuo : L - recuo; sm = s0; sp = s0; }
      const pM = { x: w.a.x + u.x * sm - nv.x * hIn, y: w.a.y + u.y * sm - nv.y * hIn }, pP = { x: w.a.x + u.x * sp + nv.x * hIn, y: w.a.y + u.y * sp + nv.y * hIn };
      const dm = Math.hypot(pM.x - ox, pM.y - oy), dp = Math.hypot(pP.x - ox, pP.y - oy);
      return dm > dp ? { fora: pM, dentro: pP } : { fora: pP, dentro: pM };
    };
    const banda = (hIn, recuo = 0) => {
      const ini = ponta(ord[0], ord[0].ini, hIn, recuo), last = ord[ord.length - 1], fim = ponta(last, last.ini === "a" ? "b" : "a", hIn, recuo);
      const n = Math.max(12, Math.ceil(Math.abs(sw) / (Math.PI / 90)));
      const arco = (rr) => { const q = []; for (let k = 1; k < n; k++) { const a = a0 + sw * k / n; q.push({ x: ox + rr * Math.cos(a), y: oy + rr * Math.sin(a) }); } return q; };
      return [ini.fora, ...arco(r + hIn), fim.fora, fim.dentro, ...arco(r - hIn).reverse(), ini.dentro];
    };
    out.push({ membros: ms, set, t, r, banda, ord });
  }
  return out;
}
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
  const L = Math.abs(sweep) * r, n = Math.max(8, Math.ceil(L / 0.25));
  const pts = [];
  for (let k = 1; k <= n; k++) { const a = a0 + sweep * k / n; pts.push({ x: r3(ux + r * Math.cos(a)), y: r3(uy + r * Math.sin(a)) }); }
  pts[pts.length - 1] = { x: p2.x, y: p2.y };
  return { pts, r, L };
}
// ───────────── Portas, janelas e vãos (elementos hospedados na parede) ─────────────
// Como no Revit/ArchiCAD: a esquadria mora dentro da parede (w.ab), guardada
// pela posição do centro ao longo do eixo (x, metros a partir da ponta "a").
// Mover a parede leva a esquadria junto; excluir a parede exclui as dela.
// lado = para que lado da parede a porta abre (+1/−1 na normal); mao = em
// que ombreira fica a dobradiça. Família/folhas casam com o catálogo de
// esquadrias do orçamento de obra (orcamento-obra.jsx).
const TP_ESQ = [
  { id: "porta_giro", rotulo: "Porta de giro", curto: "Porta", cat: "P", familia: "PORTA_GIRO", folhas: 1, larg: 0.80, alt: 2.10, peit: 0, mat: "madeira" },
  { id: "porta_giro2", rotulo: "Porta de giro 2 folhas", curto: "Porta 2 folhas", cat: "P", familia: "PORTA_GIRO", folhas: 2, larg: 1.40, alt: 2.10, peit: 0, mat: "madeira" },
  { id: "porta_correr", rotulo: "Porta de correr", curto: "Porta de correr", cat: "P", familia: "PORTA_CORRER", folhas: 2, larg: 2.00, alt: 2.10, peit: 0, mat: "aluminio" },
  { id: "janela_correr", rotulo: "Janela de correr", curto: "Janela", cat: "J", familia: "JANELA_CORRER", folhas: 2, larg: 1.20, alt: 1.20, peit: 1.00, mat: "aluminio" },
  { id: "maxim_ar", rotulo: "Janela maxim-ar", curto: "Maxim-ar", cat: "J", familia: "MAXIM_AR", folhas: 1, larg: 0.60, alt: 0.60, peit: 1.50, mat: "aluminio" },
  { id: "fixo", rotulo: "Vidro fixo", curto: "Fixo", cat: "J", familia: "QUADRO_FIXO", folhas: 1, larg: 1.00, alt: 1.00, peit: 1.00, mat: "aluminio" },
  { id: "vao", rotulo: "Vão livre", curto: "Vão", cat: "V", familia: null, folhas: 0, larg: 0.90, alt: 2.10, peit: 0, mat: null },
];
const tpEsq = (id) => TP_ESQ.find((t) => t.id === id) || TP_ESQ[0];
const tpGiro = (tipo) => tipo === "porta_giro" || tipo === "porta_giro2";
function tpDistSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
// Onde termina o "vão útil" da parede em cada ponta: se outra parede chega
// ali (canto ou T), a face dela; ponta solta, o próprio eixo.
function tpFacesPonta(paredes, i) {
  const w = paredes[i]; let fa = 0, fb = 0;
  paredes.forEach((v, j) => {
    if (j === i || !tpLen(v)) return;
    if (tpDistSeg(w.a, v.a, v.b) < 1e-3) fa = Math.max(fa, (v.t || 0) / 2);
    if (tpDistSeg(w.b, v.a, v.b) < 1e-3) fb = Math.max(fb, (v.t || 0) / 2);
  });
  return { fa, fb };
}
// Faixas da parede ocupadas por outras paredes que encostam nela ou a cruzam
// (cantos, "T" e cruzamentos), em metros ao longo do eixo a partir da ponta
// "a". A faixa é a espessura da outra parede medida no sentido desta.
function tpFaixasParede(paredes, i) {
  const w = paredes[i], L = tpLen(w); if (!L) return [];
  const ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L, hw = (w.t || 0) / 2, out = [];
  paredes.forEach((v, j) => {
    const Lv = tpLen(v); if (j === i || !Lv) return;
    const vx = (v.b.x - v.a.x) / Lv, vy = (v.b.y - v.a.y) / Lv, den = ux * vy - uy * vx, sen = Math.abs(den);
    if (sen < 0.2) return; // paralela: não corta esta parede
    const t = ((v.a.x - w.a.x) * vy - (v.a.y - w.a.y) * vx) / den;  // onde o eixo dela cruza o desta
    const tv = ((v.a.x - w.a.x) * uy - (v.a.y - w.a.y) * ux) / den; // e em que ponto dela
    const folgaV = hw / sen + 0.02, meia = (v.t || 0) / 2 / sen;
    if (tv < -folgaV || tv > Lv + folgaV || t < -meia - 0.02 || t > L + meia + 0.02) return;
    out.push([t - meia, t + meia]);
  });
  return out.sort((p, q) => p[0] - q[0]);
}
// Paredes mais próximas de um trecho [s0, s1] da parede: a face da parede
// vizinha antes e depois (sem vizinha, a ponta da própria parede)
function tpVizinhos(paredes, i, s0, s1) {
  const L = tpLen(paredes[i]); let antes = 0, depois = L;
  for (const [f0, f1] of tpFaixasParede(paredes, i)) {
    if (f1 <= s0 + 1e-6 && f1 > antes) antes = f1;
    if (f0 >= s1 - 1e-6 && f0 < depois) depois = f0;
  }
  return { antes, depois };
}
// Esquadrias que cabem na parede (se a parede encolheu, a que sobrou fica de fora do desenho)
const tpAbsVisiveis = (w) => { const L = tpLen(w); return (w.ab || []).filter((o) => o.x - o.larg / 2 >= -1e-6 && o.x + o.larg / 2 <= L + 1e-6); };
// Trechos cheios da parede ao longo do eixo (de −t/2 a L+t/2, como o canto quadrado), sem os vãos
function tpTrechosParede(w) {
  const L = tpLen(w), h = (w.t || 0) / 2;
  const vs = tpAbsVisiveis(w).map((o) => [o.x - o.larg / 2, o.x + o.larg / 2]).sort((p, q) => p[0] - q[0]);
  const out = []; let s = -h;
  for (const [e0, e1] of vs) { if (e0 > s + 1e-6) out.push([s, e0]); s = Math.max(s, e1); }
  if (L + h > s + 1e-6) out.push([s, L + h]);
  return out;
}
// Motivo de não caber (ou null): passa da ponta, encosta em outra, mais alta que a parede
function tpValidarAbertura(paredes, i, ab, ignorarId) {
  const w = paredes[i]; if (!w) return "Parede não encontrada";
  const L = tpLen(w), { fa, fb } = tpFacesPonta(paredes, i);
  if (ab.larg > L - fa - fb + 1e-6) return "A parede é curta para essa largura";
  if (ab.x - ab.larg / 2 < fa - 1e-6 || ab.x + ab.larg / 2 > L - fb + 1e-6) return "Passa da ponta da parede";
  for (const [f0, f1] of tpFaixasParede(paredes, i)) if (f1 > ab.x - ab.larg / 2 + 1e-6 && f0 < ab.x + ab.larg / 2 - 1e-6) return "Fica em cima de outra parede";
  for (const o of (w.ab || [])) if (o.id !== ignorarId && Math.abs(o.x - ab.x) < (o.larg + ab.larg) / 2 - 1e-6) return "Encosta em outra abertura";
  if ((ab.peit || 0) + ab.alt > (w.h || 0) + 1e-6) return "Mais alta que a parede";
  return null;
}
function tpAcharAbertura(paredes, id) {
  for (let i = 0; i < paredes.length; i++) { const ab = paredes[i].ab || []; for (let k = 0; k < ab.length; k++) if (ab[k].id === id) return { i, k, o: ab[k], w: paredes[i] }; }
  return null;
}
// Muda a ponta de uma parede mantendo portas/janelas no mesmo lugar da
// planta (a posição delas é medida a partir da ponta "a")
function tpComPonta(w, fim, p) {
  const nw = { ...w, [fim]: { x: p.x, y: p.y } };
  if (fim !== "a" || !(w.ab || []).length) return nw;
  const L0 = tpLen(w) || 1, L1 = tpLen(nw) || 1, u0 = { x: (w.b.x - w.a.x) / L0, y: (w.b.y - w.a.y) / L0 }, u1 = { x: (nw.b.x - nw.a.x) / L1, y: (nw.b.y - nw.a.y) / L1 };
  return { ...nw, ab: w.ab.map((o) => { const c = { x: w.a.x + u0.x * o.x, y: w.a.y + u0.y * o.x }; return { ...o, x: Math.round(((c.x - nw.a.x) * u1.x + (c.y - nw.a.y) * u1.y) * 1000) / 1000 }; }) };
}
// Paredes ligadas (como no Revit): quando paredes se movem, a ponta de outra
// parede que encostava nelas (canto ou T) vai junto, e essa outra parede
// estica ou encurta sozinha. origPs = antes; movidas = índices que andaram
// (dx, dy). Devolve o novo vetor de paredes e os índices que seguiram.
function tpSeguirLigadas(origPs, novasPs, movidas, dx, dy) {
  if (!movidas.size || (!dx && !dy)) return { ps: novasPs, seguiram: [] };
  const r3 = (x) => Math.round(x * 1000) / 1000, seguiram = [];
  const ps = novasPs.map((w, j) => {
    if (movidas.has(j)) return w;
    let nw = w;
    for (const fim of ["a", "b"]) {
      const q = origPs[j][fim];
      // encostada no eixo ou dentro da espessura da parede que andou (canto pela face)
      for (const i of movidas) { const m = origPs[i]; if (tpLen(m) && tpDistSeg(q, m.a, m.b) < Math.max(2e-3, (m.t || 0) / 2 + 0.01)) { nw = tpComPonta(nw, fim, { x: r3(q.x + dx), y: r3(q.y + dy) }); break; } }
    }
    if (nw !== w) seguiram.push(j);
    return nw;
  });
  return { ps, seguiram };
}
// Cotas temporárias de uma parede selecionada (como no Revit). Tudo no
// sistema da parede: s ao longo do eixo (0 = ponta a, L = ponta b) e n na
// normal (esquerda do sentido a→b).
//  - comp: comprimento da parede;
//  - vao: de uma ponta solta até a face da próxima parede que cruza o eixo;
//  - perp: vão livre (face a face) até a parede paralela mais próxima de cada lado.
// presa.a / presa.b = a ponta encosta (canto ou T) em outra parede.
function tpCotasParede(paredes, i) {
  const w = paredes[i]; if (!w) return null;
  const L = tpLen(w); if (L < 1e-6) return null;
  const u = { x: (w.b.x - w.a.x) / L, y: (w.b.y - w.a.y) / L }, nr = { x: -u.y, y: u.x }, t = w.t || 0;
  const S = (q) => (q.x - w.a.x) * u.x + (q.y - w.a.y) * u.y, N = (q) => (q.x - w.a.x) * nr.x + (q.y - w.a.y) * nr.y;
  const presa = { a: false, b: false }, vaos = { a: null, b: null }, perp = { "1": null, "-1": null };
  paredes.forEach((o, j) => {
    if (j === i) return;
    const Lj = tpLen(o); if (Lj < 1e-6) return;
    const uj = { x: (o.b.x - o.a.x) / Lj, y: (o.b.y - o.a.y) / Lj }, tj = o.t || 0;
    const cr = u.x * uj.y - u.y * uj.x;
    if (Math.abs(cr) < 0.02) {
      // paralela: vão livre se as duas se enxergam (trechos sobrepostos no eixo)
      const sa = S(o.a), sb = S(o.b), lo = Math.max(0, Math.min(sa, sb)), hi = Math.min(L, Math.max(sa, sb));
      const dn = (N(o.a) + N(o.b)) / 2;
      if (Math.abs(dn) < (t + tj) / 2 - 0.001) {
        // na mesma linha (parede que continua depois de um vão): vão até a ponta dela
        for (const [fim, e] of [["b", Math.min(sa, sb) - L], ["a", -Math.max(sa, sb)]]) {
          if (Math.abs(e) <= 0.005) presa[fim] = true;
          else if (e > 0 && (!vaos[fim] || e < vaos[fim].d)) vaos[fim] = { tipo: "vao", fim, j, d: e, eixo: e };
        }
        return;
      }
      if (hi - lo < 0.05) return;
      const gap = Math.abs(dn) - t / 2 - tj / 2;
      if (gap < 0.005) return;
      const lado = dn > 0 ? "1" : "-1";
      if (!perp[lado] || gap < perp[lado].d) perp[lado] = { tipo: "perp", lado: +lado, j, d: gap, s: (lo + hi) / 2, n0: +lado * t / 2, n1: dn - +lado * tj / 2 };
      return;
    }
    // cruza o eixo: onde o eixo desta parede encontra o eixo da outra
    const sEnc = ((o.a.x - w.a.x) * uj.y - (o.a.y - w.a.y) * uj.x) / cr;
    const r = ((o.a.x - w.a.x) * u.y - (o.a.y - w.a.y) * u.x) / cr;
    const folga = tj / 2 + t / 2 / Math.abs(cr) + 0.01; // a outra precisa chegar até a faixa desta parede
    if (r < -folga || r > Lj + folga) return;
    const meia = tj / 2 / Math.abs(cr);
    for (const [fim, e] of [["b", sEnc - L], ["a", -sEnc]]) {
      if (Math.abs(e) <= meia + 0.005) { presa[fim] = true; continue; }
      if (e > 0 && (!vaos[fim] || e - meia < vaos[fim].d)) vaos[fim] = { tipo: "vao", fim, j, d: e - meia, eixo: e };
    }
  });
  const out = [{ tipo: "comp", d: L }];
  for (const fim of ["a", "b"]) if (!presa[fim] && vaos[fim]) out.push(vaos[fim]);
  for (const k of ["1", "-1"]) if (perp[k]) out.push(perp[k]);
  return { L, u, nr, t, presa, cotas: out };
}
// Quadro de esquadrias: mesmo tipo + material + medidas = mesmo código (P1,
// J1, V1...), na ordem em que aparecem. É o que vai para a etiqueta da planta.
function tpQuadroEsquadrias(paredes) {
  const r2 = (x) => Math.round((x || 0) * 100) / 100;
  const grupos = [], mapa = new Map(), codigoDe = new Map(), cont = { P: 0, J: 0, V: 0 };
  paredes.forEach((w) => [...tpAbsVisiveis(w)].sort((a, b) => a.x - b.x).forEach((o) => {
    const t = tpEsq(o.tipo), mat = t.mat ? (o.mat || t.mat) : null;
    const k = [t.id, mat, r2(o.larg), r2(o.alt), r2(o.peit)].join("|");
    let g = mapa.get(k);
    if (!g) { cont[t.cat]++; g = { codigo: t.cat + cont[t.cat], tipo: t.id, rot: t.rotulo, mat, larg: o.larg, alt: o.alt, peit: o.peit || 0, qtd: 0, ids: [], familia: t.familia, folhas: t.folhas }; mapa.set(k, g); grupos.push(g); }
    g.qtd++; g.ids.push(o.id); codigoDe.set(o.id, g.codigo);
  }));
  return { grupos, codigoDe };
}
const tpAreaAberturas = (paredes) => paredes.reduce((s, w) => s + tpAbsVisiveis(w).reduce((t, o) => t + o.larg * Math.max(0, Math.min(o.alt, (w.h || 0) - (o.peit || 0))), 0), 0);

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
  const [tipoEsq, setTipoEsq] = useState("porta_giro");  // tipo da próxima porta/janela
  const [dimsEsq, setDimsEsq] = useState(() => Object.fromEntries(TP_ESQ.map((t) => [t.id, { larg: t.larg, alt: t.alt, peit: t.peit, mat: t.mat }])));
  const [maoEsq, setMaoEsq] = useState(1);               // Espaço troca a ombreira da dobradiça
  const [previaEsq, setPreviaEsq] = useState(null);      // esquadria fantasma sob o cursor
  const historico = useRef([]);
  const futuro = useRef([]);                     // para Refazer
  const ultimaFerramenta = useRef("parede");     // Enter sem nada ativo repete
  const meioClique = useRef(0);                  // duplo clique da rodinha = ajustar
  const three = useRef(null);
  const vista = useRef(null);
  const iconeEq = useRef(null);
  const ambientesFeitos = useRef(null);          // último par (paredes → ambientes) já calculado no arraste
  const rotulosClic = useRef([]);                // nomes dos ambientes na planta (px do canvas): clicar e arrastar move, clicar de novo edita
  const [editNome, setEditNome] = useState(null);  // { ai, x, y, txt, t } nome de ambiente sendo digitado na planta
  const cotasClic = useRef([]);                  // cotas clicáveis da esquadria selecionada (px do canvas)
  const [editCota, setEditCota] = useState(null); // { x, y, lado, id, txt } cota sendo digitada                  // ícone "EQ" (centralizar) da esquadria selecionada, em px do canvas
  const primeiraVez = useRef(true);

  const espM = Math.max(0.05, (parseFloat(String(esp).replace(",", ".")) || 14) / 100);
  const altM = Math.max(1, parseFloat(String(alt).replace(",", ".")) || 2.8);
  const r3 = (x) => Math.round(x * 1000) / 1000;

  // Gravar o projeto custa (lê e regrava a lista inteira no navegador); num
  // arraste isso acontecia a cada movimento do mouse e travava o desenho.
  // Agora grava 400 ms depois da última mudança, e na saída do editor.
  const gravarPendente = useRef(null);
  useEffect(() => {
    if (primeiraVez.current) { primeiraVez.current = false; return; }
    const dados = { ...projeto, obraId, sincronizar, paredes, areas, atualizadoEm: new Date().toISOString() };
    gravarPendente.current = () => { gravarPendente.current = null; onAlterar(dados); };
    const t = setTimeout(() => gravarPendente.current && gravarPendente.current(), 400);
    return () => clearTimeout(t);
  }, [paredes, areas, obraId, sincronizar]);
  useEffect(() => {
    const sair = () => gravarPendente.current && gravarPendente.current();
    window.addEventListener("beforeunload", sair);
    return () => { window.removeEventListener("beforeunload", sair); sair(); };
  }, []);

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
  const selO = sel.filter((k) => k[0] === "o").map((k) => tpAcharAbertura(paredes, k.slice(1))).filter(Boolean);
  const todasChaves = () => [...paredes.map((_, i) => "p" + i), ...areas.map((_, i) => "a" + i), ...paredes.flatMap((w) => (w.ab || []).map((o) => "o" + o.id))];
  const excluirSelecao = () => {
    if (!sel.length) return;
    const fp = new Set(selP), fa = new Set(selA), fo = new Set(selO.map((x) => x.o.id));
    mudar(paredes.filter((_, i) => !fp.has(i)).map((w) => ((w.ab || []).some((o) => fo.has(o.id)) ? { ...w, ab: w.ab.filter((o) => !fo.has(o.id)) } : w)), areas.filter((_, i) => !fa.has(i)));
  };
  // Edita esquadrias por id; se alguma não couber mais, não muda nada e avisa
  const editarAberturas = (ids, fn) => {
    const s = new Set(ids); let erro = null;
    const novas = paredes.map((w, i) => {
      if (!(w.ab || []).some((o) => s.has(o.id))) return w;
      const ab = w.ab.map((o) => (s.has(o.id) ? fn(o, w) : o));
      const tmp = paredes.slice(); tmp[i] = { ...w, ab };
      for (const o of ab) if (s.has(o.id)) { const m = tpValidarAbertura(tmp, i, o, o.id); if (m) erro = m; }
      return { ...w, ab };
    });
    if (erro) { avisar(erro + ". Nada foi alterado."); return false; }
    mudar(novas, null, true); return true;
  };
  // cota clicada + medida digitada: põe a esquadria a essa distância da parede daquele lado
  // edição do nome do ambiente direto na planta (só o nome; a área é calculada)
  const abrirEditNome = (ai, e) => {
    const q = rotulosClic.current.find((r) => r.ai === ai), c = planRef.current; if (!q || !c || !areas[ai]) return;
    const rc = c.getBoundingClientRect(), k = c.width / rc.width;
    if (e && e.preventDefault) e.preventDefault();
    setEditNome({ ai, x: Math.max(70, Math.min(rc.width - 70, (q.x0 + q.x1) / 2 / k)), y: Math.max(18, Math.min(rc.height - 18, q.yNome / k)), txt: areas[ai].nome || "", t: Date.now() });
  };
  const aplicarNome = (en) => {
    if (en.feito) return; en.feito = true; // Enter e o blur que vem depois
    const v = String(en.txt || "").trim();
    setEditNome(null);
    if (v && areas[en.ai] && v !== areas[en.ai].nome) editarAreas([en.ai], (x) => ({ ...x, nome: v }));
  };
  const aplicarCota = (ec) => {
    setEditCota(null);
    const v = numDigitado(ec.txt) ?? (String(ec.txt).trim().match(/^0+([.,]0*)?$/) ? 0 : null);
    if (v == null) return;
    if (ec.parede) { aplicarCotaParede(ec.parede, v); return; }
    const loc = tpAcharAbertura(paredes, ec.id); if (!loc) return;
    const viz = tpVizinhos(paredes, loc.i, loc.o.x - loc.o.larg / 2, loc.o.x + loc.o.larg / 2);
    editarAberturas([ec.id], (o) => ({ ...o, x: r3(ec.lado === "antes" ? viz.antes + v + o.larg / 2 : viz.depois - v - o.larg / 2) }));
  };
  // cota de parede digitada: só a parede selecionada anda ou estica (as
  // paredes ligadas nela acompanham, como no arraste)
  const aplicarCotaParede = (info, v) => {
    const i = info.i, w = paredes[i], cp = tpCotasParede(paredes, i); if (!w || !cp) return;
    const { u, nr } = cp;
    const esticar = (fim, novo) => {
      const p0 = w[fim], q = { x: r3(novo.x), y: r3(novo.y) };
      const outro = fim === "a" ? w.b : w.a; if (Math.hypot(q.x - outro.x, q.y - outro.y) < 0.05) { avisar("A parede ficaria curta demais."); return; }
      const ps = paredes.map((x, j) => {
        if (j === i) return tpComPonta(x, fim, q);
        let nx = x; for (const f of ["a", "b"]) if (Math.hypot(x[f].x - p0.x, x[f].y - p0.y) < 2e-3) nx = tpComPonta(nx, f, q);
        return nx;
      });
      mudar(ps, null, true);
    };
    if (info.tipo === "comp") {
      const fim = !cp.presa.b ? "b" : !cp.presa.a ? "a" : "b";
      esticar(fim, fim === "b" ? { x: w.a.x + u.x * v, y: w.a.y + u.y * v } : { x: w.b.x - u.x * v, y: w.b.y - u.y * v });
      return;
    }
    if (info.tipo === "vao") {
      const c = cp.cotas.find((x) => x.tipo === "vao" && x.fim === info.fim); if (!c) return;
      const ext = v < 0.005 ? c.eixo : c.d - v; // 0 = encosta e liga na outra parede
      esticar(info.fim, info.fim === "b" ? { x: w.b.x + u.x * ext, y: w.b.y + u.y * ext } : { x: w.a.x - u.x * ext, y: w.a.y - u.y * ext });
      return;
    }
    if (info.tipo === "lig") {
      // comprimento de uma parede ligada: a selecionada anda na direção dela
      const o = paredes[info.j]; if (!o) return;
      const Lj = tpLen(o), f = info.fim, outro = f === "a" ? "b" : "a"; if (!Lj) return;
      const delta = v - Lj, dxl = r3((o[f].x - o[outro].x) / Lj * delta), dyl = r3((o[f].y - o[outro].y) / Lj * delta);
      if (!dxl && !dyl) return;
      const mv = paredes.map((x, j) => (j === i ? { ...x, a: { x: r3(x.a.x + dxl), y: r3(x.a.y + dyl) }, b: { x: r3(x.b.x + dxl), y: r3(x.b.y + dyl) } } : x));
      const ps = tpSeguirLigadas(paredes, mv, new Set([i]), dxl, dyl).ps;
      // a ponta dela pode estar na face (não exatamente no eixo): garante que acompanha
      if (ps[info.j][f].x === o[f].x && ps[info.j][f].y === o[f].y) ps[info.j] = tpComPonta(ps[info.j], f, { x: r3(o[f].x + dxl), y: r3(o[f].y + dyl) });
      mudar(ps, null, true);
      return;
    }
    const c = cp.cotas.find((x) => x.tipo === "perp" && x.lado === info.lado); if (!c) return;
    const m = info.lado * (c.d - v), dx = r3(nr.x * m), dy = r3(nr.y * m);
    if (!dx && !dy) return;
    const movida = paredes.map((x, j) => (j === i ? { ...x, a: { x: r3(x.a.x + dx), y: r3(x.a.y + dy) }, b: { x: r3(x.b.x + dx), y: r3(x.b.y + dy) } } : x));
    mudar(tpSeguirLigadas(paredes, movida, new Set([i]), dx, dy).ps, null, true);
  };
  const inverterAberturas = (campo) => { if (selO.length) editarAberturas(selO.map((x) => x.o.id), (o) => ({ ...o, [campo]: -(o[campo] || 1) })); };
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
  const aplicarSelecao = (chaves0, g) => {
    // um trecho de curva seleciona a curva inteira
    const gc = chaves0.some((k) => k[0] === "p") ? tpGruposCurva(paredes) : null;
    const chaves = gc ? Array.from(new Set(chaves0.flatMap((k) => { if (k[0] !== "p") return [k]; const gi = gc[+k.slice(1)]; return gi >= 0 ? gc.map((x, j) => (x === gi ? "p" + j : null)).filter(Boolean) : [k]; }))) : chaves0;
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
      areas: base.areas.map((a, i) => (fa.has(i) ? { ...a, pts: (a.pts || []).map(mv), ...(a.ponto ? { ponto: mv(a.ponto) } : {}), ...(a.rotulo ? { rotulo: mv(a.rotulo) } : {}) } : a)),
    };
  };
  const moverSelecao = (dx, dy) => {
    if (!sel.length) return;
    const r0 = deslocar({ paredes, areas }, sel, dx, dy);
    const lig = tpSeguirLigadas(paredes, r0.paredes, new Set(selP), dx, dy);
    const r = { ...r0, paredes: lig.ps };
    // porta/janela selecionada anda ao longo da própria parede (a seta
    // perpendicular à parede não faz nada); se a parede também está
    // selecionada, ela já foi junto
    const ids = new Set(selO.map((x) => x.o.id)), fp = new Set(selP);
    let ps = r.paredes;
    if (ids.size) ps = ps.map((w, i) => {
      if (fp.has(i) || !(w.ab || []).some((o) => ids.has(o.id))) return w;
      const L = tpLen(w) || 1, d = dx * (w.b.x - w.a.x) / L + dy * (w.b.y - w.a.y) / L;
      if (Math.abs(d) < 1e-9) return w;
      const ab = w.ab.map((o) => (ids.has(o.id) ? { ...o, x: r3(o.x + d) } : o));
      const tmp = ps.slice(); tmp[i] = { ...w, ab };
      return ab.some((o) => ids.has(o.id) && tpValidarAbertura(tmp, i, o, o.id)) ? w : { ...w, ab };
    });
    mudar(ps, r.areas, true);
  };
  useEffect(() => { setHover(null); }, [ferramenta]);
  const trocarFerramenta = (f) => { setDividir(null); setFerramenta(f); setPreviaEsq(null); setInicio(null); setPoli([]); setDigitado(""); setAncora(null); if (f !== "selecionar" && f !== "mover") { setSel([]); ultimaFerramenta.current = f; } };
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
    const mesclado = tpMesclarProjetoObra(obraLigada.projeto, conv, projeto.id);
    if (tpAssinaturaDesenho(mesclado) === tpAssinaturaDesenho(obraLigada.projeto)) return;
    const atualizada = { ...obraLigada, projeto: mesclado };
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
    setTimeout(() => { const el = document.getElementById("tp-o-larg") || document.getElementById("tp-p-comp") || document.getElementById("tp-p-alt") || document.getElementById("tp-a-esp"); if (el) { el.focus(); el.select && el.select(); } }, 50);
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
    // zoom máximo: ~30 px por centímetro (dá para ver o detalhe da borda e da esquadria)
    const s2 = Math.min(3000 * (window.devicePixelRatio || 1), Math.max(4, v.s * fator));
    const wx = (px - v.ox) / v.s, wy = (py - v.oy) / v.s;
    vista.current = { s: s2, ox: px - wx * s2, oy: py - wy * s2 };
    desenharPlanta();
  };
  const devPx = (e) => { const c = planRef.current, r = c.getBoundingClientRect(), k = c.width / r.width; return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k }; };
  // grade de encaixe acompanha o zoom (mais perto = passo menor), no máximo 0,50 m
  const snap = (v) => { const p = vista.current ? Math.min(TP_GRADE, passoZoom()) : TP_GRADE; return Math.round(Math.round(v / p) * p * 1000) / 1000; };
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
    const fora = (i) => i === ign.parede || (ign.paredes && ign.paredes.includes(i)); // paredes que estão se mexendo não servem de ímã
    const faces = paredes.map((w, i) => {
      const l = tpLen(w); if (!l) return null;
      const ux = (w.b.x - w.a.x) / l, uy = (w.b.y - w.a.y) / l, nx = -uy, ny = ux, h = (w.t || 0) / 2;
      return { i, w, ux, uy, nx, ny, h };
    }).filter(Boolean);
    const mesmo = (p, q) => Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.y - q.y) < 1e-6;
    for (const f of faces) {
      if (fora(f.i)) continue;
      const { w, ux, uy, nx, ny, h } = f;
      out.push(w.a, w.b);
      for (const [pt, sgn] of [[w.a, -1], [w.b, 1]]) {
        const solta = !faces.some((g) => g.i !== f.i && !fora(g.i) && (mesmo(g.w.a, pt) || mesmo(g.w.b, pt)));
        if (solta) for (const lado of [1, -1]) out.push({ x: pt.x + sgn * ux * h + lado * nx * h, y: pt.y + sgn * uy * h + lado * ny * h });
      }
    }
    const cruzar = (p1, d1, p2, d2) => { const den = d1.x * d2.y - d1.y * d2.x; if (Math.abs(den) < 1e-9) return null; const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / den; return { x: p1.x + d1.x * t, y: p1.y + d1.y * t }; };
    for (let a = 0; a < faces.length; a++) for (let b = a + 1; b < faces.length; b++) {
      const f = faces[a], g = faces[b];
      if (fora(f.i) || fora(g.i)) continue;
      if (![f.w.a, f.w.b].some((p) => mesmo(p, g.w.a) || mesmo(p, g.w.b))) continue;
      for (const lf of [1, -1]) for (const lg of [1, -1]) {
        const q = cruzar({ x: f.w.a.x + lf * f.nx * f.h, y: f.w.a.y + lf * f.ny * f.h }, { x: f.ux, y: f.uy }, { x: g.w.a.x + lg * g.nx * g.h, y: g.w.a.y + lg * g.ny * g.h }, { x: g.ux, y: g.uy });
        if (q) out.push(q);
      }
    }
    // ambiente não serve de ímã: o contorno dele é calculado das paredes e
    // anda junto com elas num arraste (puxava a ponta para a posição anterior)
    areas.forEach((a, ai) => { if (a.tipo !== "ambiente" && !(ign.areas && ign.areas.includes(ai))) (a.pts || []).forEach((q, k) => { if (!(ign.area === ai && (ign.vertices || []).includes(k))) out.push(q); }); });
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
      // emendas internas de curva não servem de alinhamento (só poluíam a tela)
      const gcR = tpGruposCurva(paredes), cmR = tpCantosMitra(paredes), emendas = new Set();
      paredes.forEach((w, i) => { if (gcR[i] >= 0) for (const f of ["a", "b"]) if (cmR[i][f] && gcR[cmR[i][f].j] === gcR[i]) emendas.add(r3(w[f].x) + "|" + r3(w[f].y)); });
      const refs = [...pontosIma(opts.ignorar).filter((q) => !emendas.has(r3(q.x) + "|" + r3(q.y))), ...(inicio ? [inicio] : []), ...(ancora && ancora.ret ? [ancora.ret] : []), ...(ancora && ancora.arcoIni ? [ancora.arcoIni, ancora.arcoFim] : [])];
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
  // ---------- portas e janelas ----------
  // Parede embaixo do cursor e posição do centro da esquadria ao longo dela:
  // grade de 5 cm, ímã no meio da parede e a 10 cm da face da parede vizinha
  // (a "boneca" de sempre), e nunca passa das faces. A porta abre para o lado
  // em que o cursor está, como no Revit.
  const hospedar = (pt, larg, ps = paredes) => {
    const v = vista.current; if (!v) return null;
    const px = (window.devicePixelRatio || 1) / v.s, tol = 12 * px;
    let best = -1, dmin = Infinity;
    ps.forEach((w, i) => { if (!tpLen(w)) return; const d = tpDistSeg(pt, w.a, w.b); if (d <= Math.max((w.t || 0) / 2 + 0.05, tol) && d < dmin) { dmin = d; best = i; } });
    if (best < 0) return null;
    const w = ps[best], L = tpLen(w), ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L;
    const proj = (pt.x - w.a.x) * ux + (pt.y - w.a.y) * uy, lado = ((pt.x - w.a.x) * -uy + (pt.y - w.a.y) * ux) >= 0 ? 1 : -1;
    const { fa, fb } = tpFacesPonta(ps, best);
    let x = Math.round(proj / 0.05) * 0.05;
    const viz = tpVizinhos(ps, best, proj, proj);
    const imas = [L / 2, (viz.antes + viz.depois) / 2, viz.antes + larg / 2 + 0.10, viz.depois - larg / 2 - 0.10];
    for (const m of imas) if (Math.abs(proj - m) < 10 * px) { x = m; break; }
    x = Math.max(fa + larg / 2, Math.min(L - fb - larg / 2, x));
    return { i: best, x: r3(x), lado, proj, L, fa, fb };
  };
  const previaEsqEm = (pt, mao = maoEsq) => {
    const dm = dimsEsq[tipoEsq] || tpEsq(tipoEsq);
    const h = hospedar(pt, dm.larg); if (!h) return null;
    const ab = { x: h.x, larg: dm.larg, alt: dm.alt, peit: dm.peit || 0 };
    return { ...h, tipo: tipoEsq, ...ab, mao, mat: dm.mat, motivo: tpValidarAbertura(paredes, h.i, ab, null) };
  };
  const colocarEsquadria = (p) => {
    if (!p) { avisar("Clique em cima de uma parede."); return; }
    if (p.motivo) { avisar(p.motivo + "."); return; }
    const t = tpEsq(p.tipo), id = "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const o = { id, tipo: t.id, x: p.x, larg: p.larg, alt: p.alt, peit: p.peit, lado: p.lado, mao: p.mao, ...(t.mat ? { mat: p.mat || t.mat } : {}) };
    mudar(paredes.map((w, i) => (i === p.i ? { ...w, ab: [...(w.ab || []), o] } : w)), null, true);
    setSel(["o" + id]); setPreviaEsq(null);
  };
  // número digitado + Enter: distância da esquadria até a face da parede do
  // lado em que o cursor está
  const aplicarDigitadoEsq = () => {
    const d = numDigitado(digitado); setDigitado("");
    const p = previaEsq; if (d == null || !p) return;
    const viz = tpVizinhos(paredes, p.i, p.proj, p.proj);
    const x = p.proj - viz.antes < viz.depois - p.proj ? viz.antes + d + p.larg / 2 : viz.depois - d - p.larg / 2;
    const ab = { x: r3(x), larg: p.larg, alt: p.alt, peit: p.peit };
    colocarEsquadria({ ...p, x: ab.x, motivo: tpValidarAbertura(paredes, p.i, ab, null) });
  };
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

  // imagem de uma peça de porcelanato com o granilite, por zoom (cache)
  const granCache = useRef(null);
  const padraoGranilite = (ctx, P0, s, dpr) => {
    const c0 = granCache.current, chave = P0 + "|" + s.toFixed(2) + "|" + dpr;
    if (c0 && c0.chave === chave) return c0.r;
    let r = null;
    try {
      // de muito perto a peça passaria de 2048 px: o padrão repete numa fração
      // da peça (sem aumentar/borrar o grão)
      const m = Math.max(1, Math.ceil(P0 * s / 2048)), Pp = P0 / m, lado = Pp * s, n = Math.ceil(lado);
      if (n >= 8 && typeof document !== "undefined") {
        const cv = document.createElement("canvas"); cv.width = n; cv.height = n;
        const g = cv.getContext("2d");
        if (g) {
          const esc = n / Pp; // px da imagem por metro
          g.strokeStyle = "rgba(255,255,255,0.75)"; g.lineWidth = Math.max(0.7 * dpr, Math.min(0.006 * esc, 2.5 * dpr)); g.lineCap = "round"; g.beginPath();
          const qtd = Math.round(110 * Pp * Pp);
          for (let k = 0; k < qtd; k++) {
            const hsh = (m) => { const t = Math.sin(k * 74.7 + m * 19.3 + 3.1) * 43758.5453; return t - Math.floor(t); };
            const cx = hsh(1) * n, cy = hsh(2) * n, an = hsh(3) * Math.PI, l = (hsh(4) < 0.45 ? 0.002 : 0.01 + 0.014 * hsh(5)) * esc;
            g.moveTo(cx, cy); g.lineTo(cx + Math.cos(an) * l, cy + Math.sin(an) * l);
          }
          g.stroke();
          const pat = ctx.createPattern(cv, "repeat");
          if (pat && pat.setTransform) r = { pat, k: lado / n };
        }
      }
    } catch (err) { r = null; }
    granCache.current = { chave, r };
    return r;
  };
  const desenharPlanta = () => {
    const c = planRef.current, v = vista.current; if (!c || !v || !c.width) return;
    const ctx = c.getContext("2d"), W = c.width, H = c.height, dpr = window.devicePixelRatio || 1;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    iconeEq.current = null; cotasClic.current = []; rotulosClic.current = [];
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

    // ---- texturas (padrão da prancha), todas presas ao desenho ----
    const hsh = (i, j, k, n) => { const t = Math.sin(i * 127.1 + j * 311.7 + k * 74.7 + n * 19.3) * 43758.5453; return t - Math.floor(t); };
    const caixaDe = (pts) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of pts) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); } return { x0, y0, x1, y1 }; };
    // pontinhos brancos miúdos (grama, terra)
    const granulado = (pts, cel, n, cor) => {
      const b = caixaDe(pts), i0 = Math.floor(b.x0 / cel), i1 = Math.ceil(b.x1 / cel), j0 = Math.floor(b.y0 / cel), j1 = Math.ceil(b.y1 / cel);
      if (v.s * 0.03 < 1.5 * dpr || (i1 - i0) * (j1 - j0) > 6000) return;
      ctx.strokeStyle = cor; ctx.lineWidth = Math.max(0.8 * dpr, Math.min(0.006 * v.s, 2.5 * dpr)); ctx.beginPath(); // traço fino mesmo de muito perto
      for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) for (let k = 0; k < n; k++) {
        const cx = (i + hsh(i, j, k, 1)) * cel, cy = (j + hsh(i, j, k, 2)) * cel, an = hsh(i, j, k, 3) * Math.PI, l = 0.012 + 0.012 * hsh(i, j, k, 4);
        const [ax, ay] = T({ x: cx, y: cy }), [bx, by] = T({ x: cx + Math.cos(an) * l, y: cy + Math.sin(an) * l });
        ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
      }
      ctx.stroke();
    };
    // pedra irregular (cacos): células de Voronoi com sementes sorteadas,
    // cantos arredondados e contorno cinza claro sobre fundo branco
    const pedras = (pts, marc) => {
      ctx.save(); caminho(pts); ctx.clip();
      ctx.fillStyle = marc ? "rgba(4,116,244,0.10)" : "#ffffff"; ctx.fill();
      const C = 0.28, b = caixaDe(pts), i0 = Math.floor(b.x0 / C) - 1, i1 = Math.ceil(b.x1 / C) + 1, j0 = Math.floor(b.y0 / C) - 1, j1 = Math.ceil(b.y1 / C) + 1;
      if (C * v.s >= 7 * dpr && (i1 - i0) * (j1 - j0) < 6000) {
        const semente = (i, j) => ({ x: (i + 0.15 + 0.7 * hsh(i, j, 0, 5)) * C, y: (j + 0.15 + 0.7 * hsh(i, j, 0, 6)) * C });
        ctx.strokeStyle = marc ? "rgba(4,116,244,0.35)" : "#d6d6d6"; ctx.lineWidth = Math.max(1 * dpr, 0.02 * v.s); ctx.lineJoin = "round";
        for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) {
          const p = semente(i, j); let pol = [{ x: p.x - 1.6 * C, y: p.y - 1.6 * C }, { x: p.x + 1.6 * C, y: p.y - 1.6 * C }, { x: p.x + 1.6 * C, y: p.y + 1.6 * C }, { x: p.x - 1.6 * C, y: p.y + 1.6 * C }];
          for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
            if (!di && !dj) continue;
            const q = semente(i + di, j + dj), m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
            pol = tpRecortar(pol, (z) => (z.x - m.x) * (q.x - p.x) + (z.y - m.y) * (q.y - p.y));
          }
          if (pol.length < 3) continue;
          pol = pol.map((z) => ({ x: p.x + (z.x - p.x) * 0.9, y: p.y + (z.y - p.y) * 0.9 }));
          const mid = (a, c) => T({ x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 });
          ctx.beginPath(); const m0 = mid(pol[0], pol[1]); ctx.moveTo(m0[0], m0[1]);
          for (let k = 1; k <= pol.length; k++) { const vtx = T(pol[k % pol.length]), mm = mid(pol[k % pol.length], pol[(k + 1) % pol.length]); ctx.quadraticCurveTo(vtx[0], vtx[1], mm[0], mm[1]); }
          ctx.closePath(); ctx.stroke();
        }
        ctx.lineJoin = "miter";
      }
      ctx.restore();
    };
    // deck de madeira: ripas de 10 cm no sentido escolhido
    const deck = (pts, ang, marc) => {
      ctx.save(); caminho(pts); ctx.clip();
      ctx.fillStyle = marc ? "rgba(4,116,244,0.15)" : "#c98b4f"; ctx.fill();
      const b = caixaDe(pts), c = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }, R = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2 + 0.2;
      const dx = Math.cos(ang || 0), dy = Math.sin(ang || 0), nx = -dy, ny = dx;
      if (0.1 * v.s >= 3 * dpr) {
        ctx.strokeStyle = marc ? "rgba(4,116,244,0.5)" : "#8f5a2a"; ctx.lineWidth = Math.max(0.8 * dpr, 0.006 * v.s); ctx.beginPath();
        for (let t = -Math.ceil(R / 0.1) * 0.1; t <= R; t += 0.1) {
          const ox = c.x + nx * t, oy = c.y + ny * t, [ax, ay] = T({ x: ox - dx * R, y: oy - dy * R }), [bx, by] = T({ x: ox + dx * R, y: oy + dy * R });
          ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
        }
        ctx.stroke();
      }
      ctx.restore();
    };
    // contorno da casa (pegada) com as quinas levemente arredondadas, igual às
    // paredes: o que fica por fora (grama, piso externo) chega até a curvinha
    const tMed = (() => { const ts = paredes.map((w) => w.t || 0).filter((x) => x > 0).sort((a, b) => a - b); return ts.length ? ts[Math.floor(ts.length / 2)] : 0.14; })();
    const rPeg = 0.9 * Math.max(1.6 * dpr, 0.2 * tMed * v.s);
    const pegadaArred = (lista) => {
      for (const Pg of lista) {
        const q = Pg.map(T), n = q.length; if (n < 3) continue;
        let ar = 0; for (let k = 0; k < n; k++) { const A = q[k], B = q[(k + 1) % n]; ar += A[0] * B[1] - B[0] * A[1]; }
        const m0 = [(q[n - 1][0] + q[0][0]) / 2, (q[n - 1][1] + q[0][1]) / 2]; ctx.moveTo(m0[0], m0[1]);
        for (let k = 0; k < n; k++) {
          const A = q[(k + n - 1) % n], B = q[k], C = q[(k + 1) % n];
          // só a quina de fora (convexa) arredonda; a de dentro fica viva
          const cr = (B[0] - A[0]) * (C[1] - B[1]) - (B[1] - A[1]) * (C[0] - B[0]), convexa = cr * ar > 0;
          const r = !convexa ? 0 : Math.min(rPeg, Math.hypot(B[0] - A[0], B[1] - A[1]) / 2, Math.hypot(C[0] - B[0], C[1] - B[1]) / 2);
          ctx.arcTo(B[0], B[1], C[0], C[1], Math.max(0, r));
        }
        ctx.closePath();
      }
    };
    // terreno: grama (verde-sálvia com pontinhos brancos)
    areas.forEach((a, i) => {
      if (a.tipo !== "terreno" || !a.pts || a.pts.length < 3) return;
      const marc = marcadas.has("a" + i);
      ctx.save(); caminho(a.pts); ctx.clip();
      // a grama não entra na casa (pegada: face de fora das paredes)
      const peg = analise.pegada || [];
      if (peg.length) { ctx.beginPath(); ctx.rect(0, 0, W, H); pegadaArred(peg); ctx.clip("evenodd"); }
      caminho(a.pts); ctx.fillStyle = marc ? "#bcd3e8" : "#c7d3c0"; ctx.fill();
      granulado(a.pts, 0.5, 22, "rgba(255,255,255,0.9)");
      ctx.restore();
      // sem linha de borda nem símbolo nos cantos; o contorno só aparece selecionado (para editar)
      if (marc) { caminho(a.pts); ctx.strokeStyle = TP_AZUL; ctx.lineWidth = 2.5 * dpr; ctx.stroke(); }
      const b0 = a.pts.reduce((m, q) => (q.y < m.y ? q : m), a.pts[0]); const [tx, ty] = T(b0);
      ctx.font = `600 ${11 * dpr}px system-ui, sans-serif`; ctx.textAlign = "left"; ctx.fillStyle = marc ? TP_AZUL : "#b65b3d";
      ctx.fillText(`Terreno ${tpFmt(tpAreaPoli(a.pts))} m²`, tx + 12 * dpr, ty + 18 * dpr);
    });
    const cobPts = areas.filter((a) => (a.tipo === "laje" || a.tipo === "telhado") && a.pts && a.pts.length >= 3).map((a) => a.pts);
    // Piso interno (padrão da prancha): porcelanato cinza bem claro, peça
    // grande (1,20 m) com rejunte branco fino e bastante pontinho branco de
    // granilite — tudo sutil. Ancorado no desenho (não "escorrega" ao mover a
    // vista). Vai nos ambientes fechados e no contrapiso debaixo da cobertura.
    const pisoInterno = (pts, marc, base = "#ebe8e5", P0 = 1.2) => {
      ctx.save(); caminho(pts); ctx.clip();
      ctx.fillStyle = marc ? "rgba(4,116,244,0.10)" : base; ctx.fill();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const q of pts) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
      const i0 = Math.floor(x0 / P0), i1 = Math.ceil(x1 / P0), j0 = Math.floor(y0 / P0), j1 = Math.ceil(y1 / P0);
      // granilite: uma peça desenhada uma vez numa imagem (refeita só quando o
      // zoom muda) e repetida como padrão preso ao desenho — barato no arraste
      const gp = v.s >= 40 * dpr ? padraoGranilite(ctx, P0, v.s, dpr) : null;
      if (gp) {
        try { gp.pat.setTransform(new DOMMatrix([gp.k, 0, 0, gp.k, v.ox, v.oy])); ctx.fillStyle = gp.pat; const [px0, py0] = T({ x: x0, y: y0 }), [px1, py1] = T({ x: x1, y: y1 }); ctx.fillRect(px0, py0, px1 - px0, py1 - py0); } catch (err) { /* sem padrão neste navegador */ }
      }
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = Math.max(0.6 * dpr, 0.004 * v.s); ctx.beginPath();
      for (let i = i0; i <= i1; i++) { const [ax, ay] = T({ x: i * P0, y: y0 }), [bx, by] = T({ x: i * P0, y: y1 }); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); }
      for (let j = j0; j <= j1; j++) { const [ax, ay] = T({ x: x0, y: j * P0 }), [bx, by] = T({ x: x1, y: j * P0 }); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); }
      ctx.stroke(); ctx.restore();
    };
    const pegada = analise.pegada || [];
    const tipoCp = (a) => tpTipoContrapiso(a.pts, pegada, cobPts);
    const cpInterno = (a) => tipoCp(a) === "interno";
    // recorte da casa (face de fora das paredes) sobre o piso externo que a envolve
    const semCasa = (fn) => {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H);
      pegadaArred(pegada);
      ctx.clip("evenodd"); fn(); ctx.restore();
    };
    // ponto mais livre de um polígono, fora dos furos (para o rótulo)
    const pontoLivre = (pts, furos) => {
      const b = caixaDe(pts), passo = Math.max(0.2, Math.sqrt(tpAreaPoli(pts)) / 40); let melhor = null, folga = -1;
      for (let x = b.x0 + passo / 2; x < b.x1; x += passo) for (let y = b.y0 + passo / 2; y < b.y1; y += passo) {
        const q = { x, y }; if (!tpDentroPoli(q, pts) || furos.some((f) => tpDentroPoli(q, f))) continue;
        let d = Infinity; for (const P of [pts, ...furos]) for (let k = 0; k < P.length; k++) d = Math.min(d, tpDistSeg(q, P[k], P[(k + 1) % P.length]));
        if (d > folga) { folga = d; melhor = q; }
      }
      return melhor;
    };
    areas.forEach((a, i) => { if (a.pts && a.pts.length >= 3 && ((a.tipo === "contrapiso" && cpInterno(a)) || (a.tipo === "ambiente" && !a.aberto))) pisoInterno(a.pts, marcadas.has("a" + i)); });
    // contorno de área sem os lados que correm junto da face de uma parede
    // (essas linhas apareciam nas quinas arredondadas)
    const contornoLivre = (pts) => {
      ctx.beginPath();
      for (let k = 0; k < pts.length; k++) {
        const a = pts[k], b = pts[(k + 1) % pts.length], L = Math.hypot(b.x - a.x, b.y - a.y); if (!L) continue;
        const naParede = [0.25, 0.5, 0.75].every((f) => { const q = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }; return paredes.some((w) => tpLen(w) && tpDistSeg(q, w.a, w.b) <= (w.t || 0) / 2 + 0.03); });
        if (naParede) continue;
        const [ax, ay] = T(a), [bx, by] = T(b); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
      }
    };
    // áreas: contrapiso externo (hachura) por baixo, laje (tracejado) por cima
    const ordem = areas.map((a, i) => i).sort((i, j) => (areas[i].tipo === "laje") - (areas[j].tipo === "laje"));
    for (const i of ordem) {
      const a = areas[i], marc = marcadas.has("a" + i);
      if (!a.pts || a.pts.length < 3 || a.tipo === "telhado" || a.tipo === "terreno" || a.tipo === "ambiente") continue;
      caminho(a.pts);
      if (a.tipo === "laje") {
        // sem véu azul por cima do piso (deixava o porcelanato acinzentado); só selecionada
        if (marc) { ctx.fillStyle = "rgba(4,116,244,0.14)"; ctx.fill(); }
        if (!marc) contornoLivre(a.pts);
        ctx.setLineDash([8 * dpr, 5 * dpr]); ctx.strokeStyle = marc ? TP_AZUL : "#6b8fc7"; ctx.lineWidth = (marc ? 2.5 : 1.5) * dpr; ctx.stroke(); ctx.setLineDash([]);
      } else if (cpInterno(a)) {
        if (marc) caminho(a.pts); else contornoLivre(a.pts); ctx.strokeStyle = marc ? TP_AZUL : "#b8a98a"; ctx.lineWidth = (marc ? 2.5 : 1) * dpr; ctx.stroke();
      } else {
        // piso externo: acabamento escolhido (pedra irregular é o padrão); o
        // que envolve a casa fica recortado na face de fora das paredes
        const textura = () => { if (a.acab === "deck") deck(a.pts, a.angRipa || 0, marc); else if (a.acab === "porcelanato") pisoInterno(a.pts, marc, "#dcd8d2", 0.6); else pedras(a.pts, marc); };
        if (tipoCp(a) === "furado") semCasa(textura); else textura();
        if (marc) caminho(a.pts); else contornoLivre(a.pts); ctx.strokeStyle = marc ? TP_AZUL : "#8a8a8a"; ctx.lineWidth = (marc ? 2.5 : 1) * dpr; ctx.stroke();
      }
      const furadoCp = a.tipo === "contrapiso" && tipoCp(a) === "furado";
      const [cx, cy] = T(furadoCp ? (pontoLivre(a.pts, pegada) || tpCentro(a.pts)) : tpCentro(a.pts));
      ctx.font = `600 ${11 * dpr}px system-ui, sans-serif`; ctx.textAlign = "center";
      ctx.fillStyle = marc ? TP_AZUL : (a.tipo === "laje" ? "#4b6aa0" : "#b65b3d");
      let nomeA = TP_AREA_TIPOS[a.tipo].nome;
      if (a.tipo === "contrapiso") nomeA = cpInterno(a) ? "Piso interno" : "Piso externo";
      const areaRot = furadoCp ? Math.max(0, tpAreaPoli(a.pts) - tpAreaDentro(a.pts, pegada)) : tpAreaPoli(a.pts);
      // sem anotação de laje e piso interno (como na prancha); só aparece selecionado.
      // O piso externo continua com o nome e a área (no que envolve a casa, sem a casa).
      if (marc || nomeA === "Piso externo") ctx.fillText(`${nomeA} ${tpFmt(areaRot)} m²`, cx, cy + (a.tipo === "laje" ? 14 * dpr : 0));
    }

    // "ÁREA EXTERNA x m²" (terreno sem piso nem cobertura) no ponto mais livre
    // do gramado: amostra uma grade e fica com o ponto mais longe das bordas
    const terrenos = areas.filter((a) => a.tipo === "terreno" && a.pts && a.pts.length >= 3);
    if (terrenos.length) {
      const an = analise;
      if (an.permeavel > 0.5) {
        const ocup = areas.filter((a) => ["laje", "telhado", "contrapiso"].includes(a.tipo) && a.pts && a.pts.length >= 3).map((a) => a.pts);
        const bordas = [...terrenos.map((t) => t.pts), ...ocup];
        let melhor = null, folga = -1;
        for (const t of terrenos) {
          const b = caixaDe(t.pts), passo = Math.max(0.25, Math.sqrt(tpAreaPoli(t.pts)) / 45);
          for (let x = b.x0 + passo / 2; x < b.x1; x += passo) for (let y = b.y0 + passo / 2; y < b.y1; y += passo) {
            const q = { x, y };
            if (!tpDentroPoli(q, t.pts) || ocup.some((o) => tpDentroPoli(q, o))) continue;
            let d = Infinity;
            for (const P of bordas) for (let k = 0; k < P.length; k++) d = Math.min(d, tpDistSeg(q, P[k], P[(k + 1) % P.length]));
            for (const w of paredes) d = Math.min(d, tpDistSeg(q, w.a, w.b));
            if (d > folga) { folga = d; melhor = q; }
          }
        }
        if (melhor && folga * v.s > 30 * dpr) {
          const [lx, ly] = T(melhor);
          ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#b65b3d";
          ctx.font = `500 ${12 * dpr}px system-ui, sans-serif`; ctx.fillText("ÁREA EXTERNA", lx, ly - 7 * dpr);
          ctx.font = `400 ${11 * dpr}px system-ui, sans-serif`; ctx.fillText(`${tpFmt(an.permeavel)} m²`, lx, ly + 8 * dpr);
          ctx.textBaseline = "alphabetic";
        }
      }
    }
    // telhados: contorno com beiral (tracejado), linhas de cumeeira e espigão,
    // seta de caimento com a porcentagem em cada água
    areas.forEach((a, i) => {
      // planta baixa: o telhado fica escondido (contorno, águas, setas e
      // anotação); aparece só quando selecionado ou sendo editado
      if (a.tipo !== "telhado" || !a.pts || a.pts.length < 3 || !marcadas.has("a" + i)) return;
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
      // sem seleção o piso já mostra o cômodo; o contorno só aparece selecionado (ou se não fechou)
      if (marc || a.aberto) { ctx.strokeStyle = marc ? TP_AZUL : "rgba(17,24,39,0.25)"; ctx.lineWidth = (marc ? 2 : 1) * dpr; ctx.setLineDash([2 * dpr, 3 * dpr]); ctx.stroke(); ctx.setLineDash([]); }
      let [lx, ly] = T(tpRotuloAmb(a));
      const txtNome = a.nome || "Ambiente", txtArea = a.aberto ? "não fechado" : `${tpFmt(tpAreaPoli(a.pts))} m²`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `600 ${13 * dpr}px system-ui, sans-serif`; const wN = ctx.measureText(txtNome).width;
      ctx.font = `500 ${11.5 * dpr}px system-ui, sans-serif`; const wA = ctx.measureText(txtArea).width;
      const meia = Math.max(wN, wA) / 2 + 6 * dpr;
      // dois ambientes no mesmo espaço (ex.: apagou a parede entre eles): um nome não cobre o outro
      for (let k = 0; k < 6 && rotulosClic.current.some((q) => lx - meia < q.x1 && lx + meia > q.x0 && ly - 18 * dpr < q.y1 && ly + 17 * dpr > q.y0); k++) ly += 36 * dpr;
      rotulosClic.current.push({ ai: i, x0: lx - meia, x1: lx + meia, y0: ly - 18 * dpr, y1: ly + 17 * dpr, yNome: ly - 8 * dpr });
      // selecionado: moldura discreta mostrando que o nome pode ser arrastado e editado
      if (marc && !(editNome && editNome.ai === i)) { ctx.strokeStyle = "rgba(4,116,244,0.55)"; ctx.lineWidth = 1 * dpr; ctx.setLineDash([3 * dpr, 2 * dpr]); ctx.strokeRect(lx - meia, ly - 18 * dpr, 2 * meia, 35 * dpr); ctx.setLineDash([]); }
      ctx.font = `600 ${13 * dpr}px system-ui, sans-serif`; ctx.fillStyle = marc ? TP_AZUL : "#b65b3d";
      if (!(editNome && editNome.ai === i)) ctx.fillText(txtNome, lx, ly - 8 * dpr);
      ctx.font = `500 ${11.5 * dpr}px system-ui, sans-serif`; ctx.fillStyle = a.aberto ? "#b45309" : (marc ? TP_AZUL : "#b65b3d");
      ctx.fillText(txtArea, lx, ly + 8 * dpr);
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
    // Paredes no padrão de corte (como a prancha do escritório, Revit):
    // preenchimento cinza #555 e contorno preto grosso nas faces, fechando as
    // pontas também nos vãos de porta e janela. A "união" nos cantos e T sai de
    // duas passadas: primeiro todos os trechos em preto (espessura cheia),
    // depois o cinza de cada trecho recuado da espessura da pena — o cinza de
    // uma parede cobre o preto da outra no encontro, e só sobra o contorno de fora.
    // borda preta: ~20% da espessura em cada face (proporcional ao zoom, como na prancha), nunca menos que 1,6 px
    // (de longe, no máximo 30% de cada lado, para o miolo cinza continuar aparecendo)
    const penaDe = (w) => { const ts = (w.t || 0) * v.s; return Math.min(Math.max(1.1 * dpr, 0.2 * ts), Math.max(0.3 * ts, 0.9 * dpr)); };
    const pena = 2 * dpr;
    // geometria só do desenho: pontas encostadas pela face vão até o eixo da
    // outra parede (canto e T fecham certinho, com meia-esquadria e arredondado)
    const pD = tpParedesDesenho(paredes);
    const cantos = tpCantosMitra(pD);
    const quadros = (w, recuo = 0, wi = pD.indexOf(w)) => {
      const L = tpLen(w); if (!L) return [];
      const ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L, nx = -uy, ny = ux, h = (w.t || 0) / 2 - recuo;
      if (h <= 0) return [];
      const hw = (w.t || 0) / 2;
      // ponta em canto: meia-esquadria (sem recuo ao longo do eixo, para o
      // cinza das duas pD se encontrar sem linha preta no meio)
      const mitra = (fim) => {
        const c = wi >= 0 && cantos[wi] ? cantos[wi][fim] : null; if (!c) return null;
        const o = pD[c.j], ro = recuo ? recuo + (penaDe(o) - penaDe(w)) / v.s : 0;
        return tpPontaMitra(w, fim, o, c.f, h, (o.t || 0) / 2 - ro);
      };
      let mA = mitra("a"), mB = mitra("b");
      // passa um pouquinho da meia-esquadria para dentro da vizinha (sem costura no canto)
      { const ex = 0.8 * dpr / v.s; if (mA) mA = mA.map((x) => x - ex); if (mB) mB = mB.map((x) => x + ex); }
      return tpTrechosParede(w).map(([s0, s1]) => {
        const iniA = Math.abs(s0 + hw) < 1e-6, fimB = Math.abs(s1 - L - hw) < 1e-6;
        const a0 = iniA && mA ? mA : [s0 + recuo, s0 + recuo], b0 = fimB && mB ? mB : [s1 - recuo, s1 - recuo];
        if (b0[0] <= a0[0] && b0[1] <= a0[1]) return null;
        return [[a0[0], -h], [b0[0], -h], [b0[1], h], [a0[1], h]].map(([sa, sn]) => T({ x: w.a.x + ux * sa + nx * sn, y: w.a.y + uy * sa + ny * sn }));
      }).filter(Boolean);
    };
    const quadro = (q) => { ctx.beginPath(); q.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
    // seleção: halo azul por baixo
    ctx.lineJoin = "round";
    // curvas lisas: desenhadas como uma faixa só (os trechos delas saem do laço)
    const lisas = tpCurvasLisas(pD, cantos), naCurva = new Set(lisas.flatMap((c) => c.membros));
    const bandaPx = (c, recuo) => c.banda(c.t / 2 - recuo, recuo).map(T);
    const curvaMarc = (c) => c.membros.some((i) => marcadas.has("p" + i));
    pD.forEach((w, i) => { if (!marcadas.has("p" + i) || naCurva.has(i)) return; ctx.strokeStyle = "rgba(4,116,244,0.28)"; ctx.lineWidth = 12 * dpr; quadros(w).forEach((q) => { quadro(q); ctx.stroke(); }); });
    lisas.forEach((c) => { if (!curvaMarc(c)) return; ctx.strokeStyle = "rgba(4,116,244,0.28)"; ctx.lineWidth = 12 * dpr; quadro(bandaPx(c, 0)); ctx.stroke(); });
    ctx.lineJoin = "miter";
    // quininas levemente arredondadas, raio ≈ a borda: sempre no lado de FORA
    // da virada (quina convexa), seja parede externa ou interna; o lado de
    // dentro da virada fica em canto vivo. Curvas suaves ficam de fora.
    const temP2 = typeof Path2D !== "undefined"; // (sem Path2D — ambiente de teste — fica sem arredondar)
    const cortes = temP2 ? new Path2D() : null; let temCanto = false;
    const miolos = []; // { path, cor }: cantinho de dentro do miolo (a borda preta de dentro arredonda do lado do miolo)
    const quina = (alvo, O, d1, d2, rpx) => {
      if (!alvo) return;
      const c = d1.x * d2.x + d1.y * d2.y, th = Math.acos(Math.max(-1, Math.min(1, c)));
      if (th > 2.9 || th < 0.2 || rpx < 0.8) return;
      const [ox, oy] = T(O), tt = rpx / Math.tan(th / 2);
      // a figura passa 2 px para fora das faces: sem fio de borda (antialias) nas retas
      const fx = 2 * dpr;
      alvo.moveTo(ox + d1.x * tt - d2.x * fx, oy + d1.y * tt - d2.y * fx); alvo.lineTo(ox + d1.x * tt, oy + d1.y * tt);
      alvo.arcTo(ox, oy, ox + d2.x * tt, oy + d2.y * tt, rpx);
      alvo.lineTo(ox + d2.x * tt - d1.x * fx, oy + d2.y * tt - d1.y * fx); alvo.lineTo(ox - (d1.x + d2.x) * fx, oy - (d1.y + d2.y) * fx); alvo.closePath(); temCanto = true;
    };
    pD.forEach((w, i) => {
      const L = tpLen(w); if (!L) return;
      const u = { x: (w.b.x - w.a.x) / L, y: (w.b.y - w.a.y) / L }, nv = { x: -u.y, y: u.x }, h = (w.t || 0) / 2;
      const rpx = Math.min(penaDe(w) * 0.9, h * v.s * 0.8);
      const ptS = (sx, n) => ({ x: w.a.x + u.x * sx + nv.x * n, y: w.a.y + u.y * sx + nv.y * n });
      for (const fim of ["a", "b"]) {
        const dIn = fim === "a" ? u : { x: -u.x, y: -u.y }, P = w[fim], c = cantos[i] && cantos[i][fim];
        if (c) {
          if (c.j < i) continue; // cada canto uma vez
          const o = pD[c.j], Lo = tpLen(o), q = c.f === "a" ? o.b : o.a, e = { x: (q.x - P.x) / Lo, y: (q.y - P.y) / Lo };
          const [sm, sp] = tpPontaMitra(w, fim, o, c.f, h, (o.t || 0) / 2), pm = ptS(sm, -h), pp = ptS(sp, h);
          // a vizinha fica do lado de dentro do canto: a face do outro lado é a de fora
          const ladoViz = e.x * nv.x + e.y * nv.y, fora = ladoViz > 0 ? pm : pp;
          quina(cortes, fora, dIn, e, rpx);
          // borda preta do lado de dentro: arredonda o lado dela que encosta no
          // miolo (o cinza ganha a curvinha); o lado do piso fica vivo
          const rw = penaDe(w) / v.s, ro = penaDe(o) / v.s, hi = h - rw, hoi = (o.t || 0) / 2 - ro;
          if (hi * v.s > 2 * dpr && hoi * v.s > 2 * dpr) { // miolo visível (de longe a parede é só preto)
            const [sm2, sp2] = tpPontaMitra(w, fim, o, c.f, hi, hoi), di = ladoViz > 0 ? ptS(sp2, hi) : ptS(sm2, -hi);
            const pth = temP2 ? new Path2D() : null, antes = temCanto; quina(pth, di, dIn, e, rpx); temCanto = antes || temCanto;
            if (pth) miolos.push({ pth, cor: (marcadas.has("p" + i) || marcadas.has("p" + c.j)) ? "#5b8fd6" : TP_NUCLEO });
          }
          continue;
        }
        // ponta encostada no meio de outra parede (T): os cantos ali são do lado
        // de dentro da virada — ficam vivos
        const tq = pD.findIndex((x, j) => j !== i && tpLen(x) && tpDistSeg(P, x.a, x.b) < (x.t || 0) / 2 + 0.01);
        if (tq >= 0) {
          // no T a borda preta vira da face da parede que passa para a face desta:
          // o lado de fora dessa virada é o miolo → o cinza ganha a curvinha
          const x = pD[tq], Lx = tpLen(x), ux = { x: (x.b.x - x.a.x) / Lx, y: (x.b.y - x.a.y) / Lx }, nx = { x: -ux.y, y: ux.x };
          const cr = u.x * ux.y - u.y * ux.x, rw = penaDe(w) / v.s, rx = penaDe(x) / v.s, hi = h - rw, hx = (x.t || 0) / 2 - rx;
          if (temP2 && Math.abs(cr) > 0.2 && hi * v.s > 2 * dpr && hx * v.s > 2 * dpr) {
            const outra = w[fim === "a" ? "b" : "a"], lado = Math.sign((outra.x - x.a.x) * nx.x + (outra.y - x.a.y) * nx.y) || 1;
            const F = { x: x.a.x + nx.x * lado * hx, y: x.a.y + nx.y * lado * hx };
            for (const n0 of [-hi, hi]) {
              const D = { x: F.x - w.a.x - nv.x * n0, y: F.y - w.a.y - nv.y * n0 }, sx = (D.x * ux.y - D.y * ux.x) / cr;
              const G = ptS(sx, n0), sg = Math.sign(ux.x * nv.x + ux.y * nv.y) * (n0 > 0 ? 1 : -1) || 1;
              const pth = new Path2D(), antes = temCanto; quina(pth, G, dIn, { x: ux.x * sg, y: ux.y * sg }, rpx); temCanto = antes || temCanto;
              miolos.push({ pth, cor: (marcadas.has("p" + i) || marcadas.has("p" + tq)) ? "#5b8fd6" : TP_NUCLEO });
            }
          }
          continue;
        }
        // ponta solta: as duas quinas do topo
        const s0 = fim === "a" ? -h : L + h;
        for (const sg of [-1, 1]) quina(cortes, ptS(s0, sg * h), dIn, { x: -nv.x * sg, y: -nv.y * sg }, rpx);
      }
      // ombreiras de portas e janelas (pontas dos trechos no meio da parede)
      if (naCurva.has(i)) return;
      for (const [s0, s1] of tpTrechosParede(w)) {
        if (s0 > -h + 1e-6) for (const sg of [-1, 1]) quina(cortes, ptS(s0, sg * h), u, { x: -nv.x * sg, y: -nv.y * sg }, rpx);
        if (s1 < L + h - 1e-6) for (const sg of [-1, 1]) quina(cortes, ptS(s1, sg * h), { x: -u.x, y: -u.y }, { x: -nv.x * sg, y: -nv.y * sg }, rpx);
      }
    });
    ctx.save();
    if (temCanto) { const m = new Path2D(); m.rect(0, 0, W, H); m.addPath(cortes); ctx.clip(m, "evenodd"); }
    ctx.fillStyle = "#000";
    pD.forEach((w, i) => { if (!naCurva.has(i)) quadros(w).forEach((q) => { quadro(q); ctx.fill(); }); });
    lisas.forEach((c) => { quadro(bandaPx(c, 0)); ctx.fill(); });
    // miolo: preenche e passa um traço fino da mesma cor (1 px) para não
    // aparecer a costura clara entre os trechos na meia-esquadria
    ctx.lineJoin = "round";
    pD.forEach((w, i) => { if (naCurva.has(i)) return; ctx.fillStyle = ctx.strokeStyle = marcadas.has("p" + i) ? "#5b8fd6" : TP_NUCLEO; ctx.lineWidth = 1 * dpr; quadros(w, penaDe(w) / v.s + 0.5 * dpr / v.s).forEach((q) => { quadro(q); ctx.fill(); ctx.stroke(); }); });
    ctx.lineJoin = "miter";
    lisas.forEach((c) => { const w0 = pD[c.membros[0]]; ctx.fillStyle = curvaMarc(c) ? "#5b8fd6" : TP_NUCLEO; quadro(bandaPx(c, penaDe(w0) / v.s)); ctx.fill(); });
    for (const m of miolos) { ctx.fillStyle = m.cor; ctx.fill(m.pth); }
    ctx.restore();
    // parede em desenho (fantasma): azul translúcido, sem união
    todas.forEach((w) => { if (!w.fantasma) return; ctx.globalAlpha = 0.55; ctx.fillStyle = TP_AZUL; quadros(w).forEach((q) => { quadro(q); ctx.fill(); }); ctx.globalAlpha = 1; });
    // curvas: uma medida só (comprimento total), no trecho do meio
    const gruposCurva = tpGruposCurva(paredes), rotuloCurva = new Map();
    { const por = new Map(); gruposCurva.forEach((g, i) => { if (g < 0) return; if (!por.has(g)) por.set(g, []); por.get(g).push(i); });
      for (const ms of por.values()) {
        // ordena pela corrente (de uma ponta solta até a outra)
        const set = new Set(ms); let ini = ms.find((i) => ["a", "b"].some((f) => !cantos[i][f] || !set.has(cantos[i][f].j))) ?? ms[0];
        const ord = [], vis = new Set(); let cur = ini;
        while (cur != null && !vis.has(cur)) { vis.add(cur); ord.push(cur); const nx = ["a", "b"].map((f) => cantos[cur][f]).find((c) => c && set.has(c.j) && !vis.has(c.j)); cur = nx ? nx.j : null; }
        rotuloCurva.set(ord[Math.floor(ord.length / 2)] ?? ms[0], ms.reduce((t, i) => t + tpLen(paredes[i]), 0));
      } }
    // paredes com uma ponta encostada na parede selecionada (sozinha)
    const ligadasSel = new Map();
    if (sel.length === 1 && sel[0][0] === "p" && (ferramenta === "selecionar" || ferramenta === "mover")) {
      const si = +sel[0].slice(1), ws = paredes[si];
      if (ws && tpLen(ws)) paredes.forEach((x, j) => {
        if (j === si || !tpLen(x)) return;
        const cr = Math.abs(((ws.b.x - ws.a.x) * (x.b.y - x.a.y) - (ws.b.y - ws.a.y) * (x.b.x - x.a.x)) / tpLen(ws) / tpLen(x));
        if (cr < 0.02) return; // paralela (na mesma linha) não serve
        // ponta encostada: no eixo da selecionada ou dentro da espessura dela
        // (canto desenhado pela face, com uma pequena diferença do eixo)
        const tol = Math.max(2e-3, (ws.t || 0) / 2 + 0.01);
        let melhor = null;
        for (const f of ["a", "b"]) { const d = tpDistSeg(x[f], ws.a, ws.b); if (d <= tol && (!melhor || d < melhor.d)) melhor = { f, d }; }
        if (melhor) ligadasSel.set(j, { i: si, fim: melhor.f });
      });
    }
    todas.forEach((w, i) => {
      const [ax, ay] = T(w.a), [bx, by] = T(w.b), marc = marcadas.has("p" + i);
      let ang = Math.atan2(by - ay, bx - ax); if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
      ctx.save(); ctx.translate((ax + bx) / 2, (ay + by) / 2); ctx.rotate(ang);
      ctx.font = `600 ${12 * dpr}px system-ui, sans-serif`; ctx.textAlign = "center";
      ctx.fillStyle = w.fantasma || marc ? TP_AZUL : "#6b7280";
      // a selecionada sozinha mostra o comprimento na cota temporária (clicável)
      const soCota = (marc && sel.length === 1 && (ferramenta === "selecionar" || ferramenta === "mover")) || (gruposCurva[i] >= 0 && !rotuloCurva.has(i));
      // parede ligada na selecionada: a medida dela fica azul e clicável —
      // digitar o novo comprimento desloca a parede selecionada
      const lig = !w.fantasma && ligadasSel.get(i);
      if (lig) ctx.fillStyle = "#0284c7";
      if (!w.fantasma && !soCota) ctx.fillText(rotuloCurva.has(i) ? `curva ${tpFmt(rotuloCurva.get(i))} m` : tpFmt(tpLen(w)) + " m", 0, -(w.t * v.s / 2 + pena + 6 * dpr)); ctx.restore();
      if (lig) { const yy = w.t * v.s / 2 + pena + 10 * dpr; cotasClic.current.push({ x: (ax + bx) / 2 + yy * Math.sin(ang), y: (ay + by) / 2 - yy * Math.cos(ang), r: 26 * dpr, parede: { tipo: "lig", i: lig.i, j: i, fim: lig.fim }, d: tpLen(w) }); }
      if (w.fantasma) etiqueta(w.a, w.b, `${tpFmt(tpLen(w))} m${angulo(w.a, w.b)}`);
    });
    // portas, janelas e vãos: símbolo de planta (NBR 6492 / convenção usual)
    // porta de giro: folha a 90° + arco; correr: folhas sobrepostas; janela:
    // linhas das faces + vidro; maxim-ar: projeção da folha tracejada; vão:
    // verga tracejada. Código do quadro (P1, J1...) do outro lado da abertura.
    const desenharEsq = (w, o, cor, opts = {}) => {
      const L = tpLen(w); if (!L) return;
      const ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L, nx = -uy, ny = ux, h = (w.t || 0) / 2, ld = o.lado || 1, md = o.mao || 1;
      const P = (s, n) => ({ x: w.a.x + ux * s + nx * n, y: w.a.y + uy * s + ny * n });
      const e0 = o.x - o.larg / 2, e1 = o.x + o.larg / 2;
      const seg = (p, q, lw, dash) => { const [x0, y0] = T(p), [x1, y1] = T(q); ctx.lineWidth = lw * dpr; ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]); };
      const vaoPoli = [P(e0, -h), P(e1, -h), P(e1, h), P(e0, h)];
      if (opts.limpar) { const pp = dpr / v.s; ctx.fillStyle = "#fff"; caminho([P(e0, -h - pp), P(e1, -h - pp), P(e1, h + pp), P(e0, h + pp)]); ctx.fill(); }
      if (opts.marc) { ctx.fillStyle = "rgba(4,116,244,0.18)"; caminho(vaoPoli); ctx.fill(); }
      ctx.strokeStyle = cor; ctx.lineCap = "butt";
      // padrão da prancha: folha de porta fechada (retângulo cinza claro) com
      // giro tracejado; janela com vidro cinza claro dentro da parede e
      // peitoril do lado de fora (lado oposto ao que a esquadria "abre")
      const normal = cor === "#111827", traco = normal ? "#000" : cor, claro = normal ? "#d9d9d9" : "rgba(4,116,244,0.18)", fraco = normal ? "#9a9a9a" : cor;
      const ret = (sa, sb, na, nb, fill, lw) => { caminho([P(sa, na), P(sb, na), P(sb, nb), P(sa, nb)]); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (lw) { ctx.strokeStyle = traco; ctx.lineWidth = lw * dpr; ctx.stroke(); } };
      const fora = -ld, ef = Math.min(0.025, h * 0.4);
      ctx.strokeStyle = traco;
      if (tpGiro(o.tipo)) {
        // padrão de detalhamento: piso passa pelo vão, batente com rebaixo
        // (perfil em degrau, branco com contorno preto) nas duas ombreiras,
        // folha aberta a 90° como retângulo branco de contorno preto e giro
        // tracejado preto da ponta da folha até o batente do outro lado
        if (normal) ret(e0, e1, -h, h, "#ebe8e5", 0);
        const bt = Math.min(0.05, o.larg * 0.07), dois = o.tipo === "porta_giro2", H2 = h + 0.01;
        const batente = (s0, dir) => { // s0 = face da ombreira; dir = para dentro do vão
          const deg = -ld * H2 * 0.15; // o rebaixo fica do lado em que a porta abre
          const pts = [[0, -ld * H2], [bt, -ld * H2], [bt, deg], [bt * 0.45, deg], [bt * 0.45, ld * H2], [0, ld * H2]]
            .map(([a, n]) => P(s0 + dir * a, n));
          caminho(pts); ctx.fillStyle = normal ? "#fff" : claro; ctx.fill(); ctx.strokeStyle = traco; ctx.lineWidth = 1 * dpr; ctx.stroke();
        };
        batente(e0, 1); batente(e1, -1);
        const luz = o.larg - 2 * bt * 0.45, r = dois ? luz / 2 : luz, fl = Math.min(0.035, r * 0.05);
        const folhas = dois ? [[e0 + bt * 0.45, 1], [e1 - bt * 0.45, -1]] : [[md > 0 ? e0 + bt * 0.45 : e1 - bt * 0.45, md > 0 ? 1 : -1]];
        for (const [sh, dir] of folhas) {
          caminho([P(sh, ld * h * 0.15), P(sh + dir * fl, ld * h * 0.15), P(sh + dir * fl, ld * (h * 0.15 + r)), P(sh, ld * (h * 0.15 + r))]);
          ctx.fillStyle = normal ? "#fff" : claro; ctx.fill(); ctx.strokeStyle = traco; ctx.lineWidth = 1 * dpr; ctx.stroke();
          ctx.strokeStyle = normal ? "#1f1f1f" : cor; ctx.lineWidth = 1 * dpr; ctx.setLineDash([5 * dpr, 4 * dpr]); ctx.beginPath();
          for (let k = 0; k <= 32; k++) { const an = (k / 32) * Math.PI / 2; const [x, y] = T(P(sh + dir * r * Math.sin(an), ld * (h * 0.15 + r * Math.cos(an)))); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          ctx.stroke(); ctx.setLineDash([]);
        }
      } else if (o.tipo === "porta_correr") {
        // caixilho branco com as linhas finas das faces, duas folhas escuras
        // sobrepostas no meio e as peças pretas (puxador/roldana) nas pontas
        ret(e0, e1, -h * 0.7, h * 0.7, normal ? "#fff" : claro, 0);
        ctx.strokeStyle = normal ? "#8a8a8a" : cor;
        seg(P(e0, -h * 0.7), P(e1, -h * 0.7), 0.8); seg(P(e0, h * 0.7), P(e1, h * 0.7), 0.8);
        seg(P(e0, -h * 0.45), P(e1, -h * 0.45), 0.6); seg(P(e0, h * 0.45), P(e1, h * 0.45), 0.6);
        const sb = 0.06, fol = Math.min(0.035, h * 0.35), q = Math.min(0.05, h * 0.5);
        const a1 = md > 0 ? [e0 + 0.03, o.x + sb] : [o.x - sb, e1 - 0.03], a2 = md > 0 ? [o.x - sb, e1 - 0.03] : [e0 + 0.03, o.x + sb];
        const escuro = normal ? "#2f2f2f" : cor, pecaCor = normal ? "#000" : cor;
        for (const [[sa, sbb], nn] of [[a1, h * 0.12], [a2, -h * 0.12]]) {
          caminho([P(sa, nn - fol / 2), P(sbb, nn - fol / 2), P(sbb, nn + fol / 2), P(sa, nn + fol / 2)]); ctx.fillStyle = escuro; ctx.fill();
          for (const pp of [sa, sbb]) { caminho([P(pp - q / 2, nn - q / 2), P(pp + q / 2, nn - q / 2), P(pp + q / 2, nn + q / 2), P(pp - q / 2, nn + q / 2)]); ctx.fillStyle = pecaCor; ctx.fill(); }
        }
      } else if (o.tipo === "janela_correr" || o.tipo === "maxim_ar" || o.tipo === "fixo") {
        ret(e0, e1, -h * 0.45, h * 0.45, claro, 0);                 // vidro / caixilho
        seg(P(e0, -h), P(e1, -h), 0.8); seg(P(e0, h), P(e1, h), 0.8); // faces
        if (o.tipo === "janela_correr") { const sb = 0.05; seg(P(e0, h * 0.15), P(o.x + sb, h * 0.15), 1.4); seg(P(o.x - sb, -h * 0.15), P(e1, -h * 0.15), 1.4); }
        else seg(P(e0, 0), P(e1, 0), 1.4);
        ret(e0 - 0.03, e1 + 0.03, fora * h, fora * (h + 0.035), normal ? "#7a7a76" : claro, 0.8); // peitoril
        if (o.tipo === "maxim_ar") { const q = Math.min(0.3, o.larg * 0.4); ctx.strokeStyle = fraco; seg(P(e0, -fora * h), P(o.x, -fora * (h + q)), 1, [4 * dpr, 3 * dpr]); seg(P(o.x, -fora * (h + q)), P(e1, -fora * h), 1, [4 * dpr, 3 * dpr]); }
      } else { ctx.strokeStyle = fraco; seg(P(e0, -h), P(e1, -h), 1, [5 * dpr, 4 * dpr]); seg(P(e0, h), P(e1, h), 1, [5 * dpr, 4 * dpr]); }
      if (opts.codigo) {
        // lado da etiqueta: porta do lado oposto ao giro; janela/vão do lado
        // oposto à medida da parede. Se cair do lado da medida perto do meio da
        // parede, vai mais para fora para não encavalar com ela.
        const [sax, say] = T(w.a), [sbx, sby] = T(w.b);
        let ang = Math.atan2(sby - say, sbx - sax); if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
        const ladoMedida = nx * Math.sin(ang) - ny * Math.cos(ang) > 0 ? 1 : -1;
        const sg = tpGiro(o.tipo) ? -ld : -ladoMedida;
        const longe = sg === ladoMedida && Math.abs(o.x - L / 2) < o.larg / 2 + 0.8;
        const offPx = h * v.s + (longe ? 34 : 13) * dpr;
        const [cx0, cy0] = T(P(o.x, 0)), tx = cx0 + nx * sg * offPx, ty = cy0 + ny * sg * offPx;
        ctx.font = `700 ${10.5 * dpr}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const wd = ctx.measureText(opts.codigo).width + 8 * dpr;
        ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.fillRect(tx - wd / 2, ty - 8 * dpr, wd, 16 * dpr);
        ctx.fillStyle = cor; ctx.fillText(opts.codigo, tx, ty); ctx.textBaseline = "alphabetic";
      }
      // cotas temporárias até as faces das paredes vizinhas (como no Revit)
      if (opts.cotas) {
        const viz = opts.i != null ? tpVizinhos(paredes, opts.i, e0, e1) : { antes: 0, depois: L };
        const off = -ld * (h + 0.5), dA = e0 - viz.antes, dB = viz.depois - e1;
        ctx.strokeStyle = "#0ea5e9";
        for (const [s0, s1, d] of [[viz.antes, e0, dA], [e1, viz.depois, dB]]) {
          if (d < 0.005) continue;
          seg(P(s0, off), P(s1, off), 1); seg(P(s0, off - 0.08), P(s0, off + 0.08), 1); seg(P(s1, off - 0.08), P(s1, off + 0.08), 1);
          etiqueta(P(s0, off), P(s1, off), tpFmt(d) + " m", "#0284c7");
          if (opts.eq && Math.hypot(T(P(s1, off))[0] - T(P(s0, off))[0], T(P(s1, off))[1] - T(P(s0, off))[1]) >= 18 * dpr) { // posição do rótulo (o mesmo cálculo da etiqueta) para clicar e digitar
            const [ax, ay] = T(P(s0, off)), [bx, by] = T(P(s1, off));
            let an = Math.atan2(by - ay, bx - ax); if (an > Math.PI / 2 || an < -Math.PI / 2) an += Math.PI;
            cotasClic.current.push({ x: (ax + bx) / 2 + 14 * dpr * Math.sin(an), y: (ay + by) / 2 - 14 * dpr * Math.cos(an), r: 22 * dpr, lado: s0 === viz.antes ? "antes" : "depois", id: o.id, d });
          }
        }
        // ícone "EQ" (como no Revit): no vão da linha de cota, no meio da
        // esquadria; clicar centraliza entre as duas paredes mais próximas
        if (opts.eq) {
          const [ix, iy] = T(P(o.x, off)), r = 11 * dpr, centrada = Math.abs(dA - dB) < 0.005;
          ctx.fillStyle = centrada ? "#e0f2fe" : "#fff"; ctx.strokeStyle = "#0284c7"; ctx.lineWidth = 1.5 * dpr;
          ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(ix - r, iy - r * 0.8, 2 * r, 1.6 * r, 4 * dpr); else ctx.rect(ix - r, iy - r * 0.8, 2 * r, 1.6 * r);
          ctx.fill(); ctx.stroke();
          ctx.font = `700 ${10 * dpr}px system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#0284c7";
          ctx.fillText("EQ", ix, iy + 0.5 * dpr); ctx.textBaseline = "alphabetic";
          iconeEq.current = { x: ix, y: iy, r: r + 3 * dpr, id: o.id, x0: r3((viz.antes + viz.depois) / 2), centrada };
        }
        ctx.strokeStyle = cor;
      }
    };
    const quadroPl = tpQuadroEsquadrias(paredes);
    paredes.forEach((w, i) => {
      const vis = tpAbsVisiveis(w); if (!vis.length) return;
      vis.forEach((o) => {
        const marc = marcadas.has("o" + o.id) || marcadas.has("p" + i);
        desenharEsq(w, o, marc ? TP_AZUL : "#111827", { marc: marcadas.has("o" + o.id), codigo: quadroPl.codigoDe.get(o.id), cotas: marcadas.has("o" + o.id) && sel.length === 1, eq: marcadas.has("o" + o.id) && sel.length === 1, i });
      });
    });
    // parede selecionada sozinha: cotas temporárias (comprimento, vão até a
    // próxima parede na ponta solta e vão livre até as paralelas). Clicar no
    // número e digitar move ou estica a parede selecionada.
    if (sel.length === 1 && sel[0][0] === "p" && paredes[+sel[0].slice(1)] && (ferramenta === "selecionar" || ferramenta === "mover")) {
      const pi = +sel[0].slice(1), w = paredes[pi], cp = tpCotasParede(paredes, pi);
      if (cp) {
        const { u, nr, t } = cp, km = dpr / v.s; // metros por px de tela
        const P = (sx, sn) => ({ x: w.a.x + u.x * sx + nr.x * sn, y: w.a.y + u.y * sx + nr.y * sn });
        const pp = cp.cotas.filter((c) => c.tipo === "perp"), tem = (l) => pp.find((c) => c.lado === l);
        const lc = !tem(1) ? 1 : !tem(-1) ? -1 : (tem(1).d >= tem(-1).d ? 1 : -1);
        const nOff = lc * (t / 2 + 26 * km);
        const azul = "#0284c7";
        const linha = (p, q, larg = 1) => { const [ax, ay] = T(p), [bx, by] = T(q); ctx.lineWidth = larg * dpr; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); };
        const traco = (p, dir) => { const [x, y] = T(p), k = 4 * dpr; const dx = (dir.x - dir.y) * k / Math.SQRT2, dy = (dir.y + dir.x) * k / Math.SQRT2; ctx.lineWidth = 1.4 * dpr; ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke(); };
        const cota = (p, q, d, info) => {
          ctx.strokeStyle = "#0ea5e9"; linha(p, q); const L2 = Math.hypot(q.x - p.x, q.y - p.y) || 1, dir = { x: (q.x - p.x) / L2, y: (q.y - p.y) / L2 };
          ctx.strokeStyle = azul; traco(p, dir); traco(q, dir);
          etiqueta(p, q, tpFmt(d) + " m", azul);
          const [ax, ay] = T(p), [bx, by] = T(q);
          if (Math.hypot(bx - ax, by - ay) < 18 * dpr) return;
          let an = Math.atan2(by - ay, bx - ax); if (an > Math.PI / 2 || an < -Math.PI / 2) an += Math.PI;
          cotasClic.current.push({ x: (ax + bx) / 2 + 14 * dpr * Math.sin(an), y: (ay + by) / 2 - 14 * dpr * Math.cos(an), r: 22 * dpr, parede: { i: pi, ...info }, d });
        };
        const chamada = (sx, n0, n1) => { ctx.strokeStyle = "rgba(14,165,233,0.7)"; linha(P(sx, n0), P(sx, n1), 0.8); };
        for (const c of cp.cotas) {
          if (c.tipo === "comp") {
            chamada(0, lc * (t / 2 + 4 * km), nOff + lc * 6 * km); chamada(cp.L, lc * (t / 2 + 4 * km), nOff + lc * 6 * km);
            cota(P(0, nOff), P(cp.L, nOff), cp.L, { tipo: "comp" });
          } else if (c.tipo === "vao") {
            const s0 = c.fim === "b" ? cp.L : -c.d, s1 = c.fim === "b" ? cp.L + c.d : 0;
            chamada(c.fim === "b" ? s1 : s0, nOff * 0.4, nOff + lc * 6 * km);
            cota(P(s0, nOff), P(s1, nOff), c.d, { tipo: "vao", fim: c.fim });
          } else {
            cota(P(c.s, c.n0), P(c.s, c.n1), c.d, { tipo: "perp", lado: c.lado });
          }
        }
      }
    }
    if (ferramenta === "esquadria" && previaEsq && paredes[previaEsq.i]) {
      ctx.globalAlpha = 0.9;
      desenharEsq(paredes[previaEsq.i], previaEsq, previaEsq.motivo ? "#dc2626" : TP_AZUL, { limpar: true, cotas: true, i: previaEsq.i });
      ctx.globalAlpha = 1;
    }
    const ponto = (p, r) => { const [x, y] = T(p); ctx.fillStyle = TP_AZUL; ctx.beginPath(); ctx.arc(x, y, r * dpr, 0, 7); ctx.fill(); };
    // linhas de alinhamento: só enquanto desenha ou arrasta (antes a última
    // ficava na tela depois de trocar de ferramenta ou sair da planta)
    const guiasAtivas = ferramenta === "parede" || ferramenta === "separador" || tpEhPoli(ferramenta) || !!(gesto.current && gesto.current.grip);
    if (hover && hover.guias && guiasAtivas) {
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
    { // emendas internas de uma curva não ganham quadradinho (só as pontas dela)
      const gcS = tpGruposCurva(paredes), cmS = tpCantosMitra(paredes);
      for (const i of selP) for (const f of ["a", "b"]) { if (gcS[i] >= 0 && cmS[i][f] && gcS[cmS[i][f].j] === gcS[i]) continue; quadradinho(paredes[i][f]); }
    }
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
      // piso externo que envolve a casa: furo na pegada (face de fora das paredes)
      if (a.tipo === "contrapiso") {
        const peg = analise.pegada || [], cob = areas.filter((x) => (x.tipo === "laje" || x.tipo === "telhado") && x.pts && x.pts.length >= 3).map((x) => x.pts);
        if (tpTipoContrapiso(a.pts, peg, cob) === "furado") for (const P of peg) if (P.every((q) => tpDentroPoli(q, a.pts))) shape.holes.push(new THREE.Path(P.map((q) => new THREE.Vector2(q.x - cx, -(q.y - cz)))));
      }
      const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, a.esp || 0.05), bevelEnabled: false });
      const marc = marcadas.has("a" + i);
      const mat = new THREE.MeshLambertMaterial({ color: marc ? 0x8dbbff : TP_AREA_TIPOS[a.tipo].cor3d, transparent: a.tipo === "laje" && !marc, opacity: a.tipo === "laje" && !marc ? 0.85 : 1 });
      const mesh = new THREE.Mesh(g, mat);
      mesh.rotation.x = -Math.PI / 2; mesh.position.y = a.tipo === "terreno" ? -0.03 : (a.cota || 0);
      if (a.tipo === "terreno") { mesh.scale.z = 0.02 / Math.max(0.01, a.esp || 0.05); mesh.material.color.set(marc ? 0x8dbbff : 0xc7d3c0); }
      if (a.tipo === "contrapiso" && a.acab && !marc) mesh.material.color.set({ pedra: 0xf0f0ee, deck: 0x9c6b43, porcelanato: 0xdcd8d2 }[a.acab] || TP_AREA_TIPOS.contrapiso.cor3d);
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
    // Parede = vista de frente (contorno com os recortes das portas, furos das
    // janelas) extrudada na espessura. Porta e vão recortam a base; janela é furo.
    const pD3 = tpParedesDesenho(paredes); // pontas pela face levadas ao eixo (igual à planta)
    const cantos3 = tpCantosMitra(pD3);
    // curva lisa: uma peça só, a faixa da planta levantada na altura da parede
    const lisas3 = tpCurvasLisas(pD3, cantos3), naCurva3 = new Set(lisas3.flatMap((c) => c.membros));
    lisas3.forEach((c) => {
      const w0 = pD3[c.membros[0]], marc = c.membros.some((i) => marcadas.has("p" + i));
      const pts = c.banda(c.t / 2, 0).map((q) => new THREE.Vector2(q.x - cx, -(q.y - cz)));
      const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: w0.h || 2.8, bevelEnabled: false, curveSegments: 1 });
      const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: marc ? 0x8dbbff : 0xe5e1d8 }));
      mesh.rotation.x = -Math.PI / 2; mesh.userData.chave = "p" + c.membros[0]; T.group.add(mesh);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), new THREE.LineBasicMaterial({ color: marc ? 0x0474f4 : 0x4b5563 }));
      e.rotation.copy(mesh.rotation); T.group.add(e);
    });
    pD3.forEach((w, i) => {
      const L = tpLen(w); if (!L || naCurva3.has(i)) return;
      const marc = marcadas.has("p" + i), h = w.t / 2, H = w.h, rot = -Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x);
      const ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L;
      const vis = [...tpAbsVisiveis(w)].sort((p, q) => p.x - q.x);
      const topoDe = (o) => Math.min(H - 0.02, (o.peit || 0) + o.alt);
      const contornoV = [new THREE.Vector2(-h, 0)];
      const furos = [];
      for (const o of vis) {
        const e0 = o.x - o.larg / 2, e1 = o.x + o.larg / 2, z0 = o.peit || 0, z1 = topoDe(o);
        if (z1 <= z0 + 1e-3) continue;
        if (z0 < 0.005) contornoV.push(new THREE.Vector2(e0, 0), new THREE.Vector2(e0, z1), new THREE.Vector2(e1, z1), new THREE.Vector2(e1, 0));
        else furos.push(new THREE.Path([new THREE.Vector2(e0, z0), new THREE.Vector2(e1, z0), new THREE.Vector2(e1, z1), new THREE.Vector2(e0, z1)]));
      }
      contornoV.push(new THREE.Vector2(L + h, 0), new THREE.Vector2(L + h, H), new THREE.Vector2(-h, H));
      const shape = new THREE.Shape(contornoV); shape.holes.push(...furos);
      const g = new THREE.ExtrudeGeometry(shape, { depth: w.t, bevelEnabled: false }); g.translate(0, 0, -h);
      // canto com outra parede: corta a ponta em meia-esquadria (igual à planta);
      // em curva / quase em linha, some a aresta da emenda (parece uma peça só)
      const pontas = [];
      for (const [fim, x0] of [["a", -h], ["b", L + h]]) {
        const c = cantos3[i] && cantos3[i][fim]; if (!c) continue;
        const o = pD3[c.j], [sm, sp] = tpPontaMitra(w, fim, o, c.f, h, (o.t || 0) / 2);
        const Lo = tpLen(o), uo = { x: (o.b.x - o.a.x) / Lo, y: (o.b.y - o.a.y) / Lo };
        const suave = Math.abs(ux * uo.y - uy * uo.x) < 0.5; // dobra pequena
        pontas.push({ x0, sx: (z) => sm + (z + h) / (2 * h || 1) * (sp - sm), suave });
      }
      if (pontas.length) {
        const pos = g.attributes.position;
        for (let k = 0; k < pos.count; k++) { const x = pos.getX(k), z = pos.getZ(k); for (const pn of pontas) if (Math.abs(x - pn.x0) < 1e-5) pos.setX(k, pn.sx(z)); }
        pos.needsUpdate = true; g.computeVertexNormals();
      }
      const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: marc ? 0x8dbbff : 0xe5e1d8 }));
      mesh.position.set(w.a.x - cx, 0, w.a.y - cz); mesh.rotation.y = rot;
      mesh.userData.chave = "p" + i; T.group.add(mesh);
      const suaves = pontas.filter((pn) => pn.suave);
      if (!suaves.length) contorno(g, mesh, marc ? 0x0474f4 : 0x4b5563);
      else {
        // contorno sem as arestas da emenda (as que ficam inteiras na face cortada)
        const eg = new THREE.EdgesGeometry(g), ep = eg.attributes.position, nas = (x, z) => suaves.some((pn) => Math.abs(x - pn.sx(z)) < 1e-4);
        const fica = [];
        for (let k = 0; k < ep.count; k += 2) { if (nas(ep.getX(k), ep.getZ(k)) && nas(ep.getX(k + 1), ep.getZ(k + 1))) continue; fica.push(ep.getX(k), ep.getY(k), ep.getZ(k), ep.getX(k + 1), ep.getY(k + 1), ep.getZ(k + 1)); }
        const fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.Float32BufferAttribute(fica, 3));
        const e = new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: marc ? 0x0474f4 : 0x4b5563 })); e.position.copy(mesh.position); e.rotation.copy(mesh.rotation); T.group.add(e);
      }
      // folha / vidro dentro do vão (fechado), clicável
      for (const o of vis) {
        const t = tpEsq(o.tipo); if (t.cat === "V") continue;
        const z0 = o.peit || 0, z1 = topoDe(o); if (z1 <= z0 + 1e-3) continue;
        const mo = marcadas.has("o" + o.id), madeira = (o.mat || t.mat) === "madeira";
        const gg = new THREE.BoxGeometry(o.larg, z1 - z0, madeira ? 0.04 : 0.02);
        const mt = new THREE.MeshLambertMaterial({ color: mo ? 0x8dbbff : (madeira ? 0xa47148 : 0x9cc9f0), transparent: !madeira && !mo, opacity: !madeira && !mo ? 0.5 : 1 });
        const m2 = new THREE.Mesh(gg, mt);
        m2.position.set(w.a.x + ux * o.x - cx, (z0 + z1) / 2, w.a.y + uy * o.x - cz); m2.rotation.y = rot;
        m2.userData.chave = "o" + o.id; T.group.add(m2);
        contorno(gg, m2, mo ? 0x0474f4 : (madeira ? 0x5b3a1e : 0x4b5563));
      }
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

  // desenha antes da tela pintar (no mesmo quadro da mudança), não depois
  tpUseLayoutEffect(() => { desenharPlanta(); }, [paredes, areas, inicio, poli, hover, espM, sel, caixa, ferramenta, ancora, modoTraco, previaEsq, editNome]);
  // ambiente acompanha as paredes: mexeu numa parede, o contorno e a área se refazem
  useEffect(() => {
    if (!areas.some((a) => a.tipo === "ambiente" && a.ponto)) return;
    // o arraste já refez os ambientes para estas mesmas paredes neste quadro
    if (ambientesFeitos.current && ambientesFeitos.current.ps === paredes && ambientesFeitos.current.out === areas) return;
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
  // 3D: refazer a cena inteira é o passo mais caro; durante um arraste ele
  // acompanha a ~7 quadros/s (e sempre fecha na posição final), a planta segue em tempo real
  const tempo3d = useRef(null);
  useEffect(() => {
    if (gesto.current && gesto.current.moveu) {
      if (!tempo3d.current) tempo3d.current = setTimeout(() => { tempo3d.current = null; atual.current.desenhar3d(); }, 250);
      return;
    }
    clearTimeout(tempo3d.current); tempo3d.current = null; desenhar3d();
  }, [paredes, areas, sel]);

  useEffect(() => {
    const k = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const ctrl = e.ctrlKey || e.metaKey, tecla = e.key;
      const desenhando = (modoTraco === "linha" && ((ferramenta === "parede" && inicio) || (tpEhPoli(ferramenta) && poli.length)))
        || (modoTraco === "retangulo" && ancora && ancora.ret && (ferramenta === "parede" || tpEhPoli(ferramenta)))
        || (ferramenta === "esquadria" && !!previaEsq);
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
        if (digitado && ferramenta === "esquadria") aplicarDigitadoEsq();
        else if (desenhando && ferramenta === "esquadria") colocarEsquadria(previaEsq);
        else if (digitado && modoTraco === "retangulo" && ancora && ancora.ret) aplicarDigitadoRet();
        else if (digitado) aplicarDigitado();
        else if (desenhando) finalizar();
        else if (ferramenta === "selecionar" || ferramenta === "mover") trocarFerramenta(ultimaFerramenta.current); // repete o último comando
        return;
      }
      if (ctrl && (tecla === "z" || tecla === "Z")) { e.preventDefault(); if (e.shiftKey) refazer(); else desfazer(); return; }
      if (ctrl && (tecla === "y" || tecla === "Y")) { e.preventDefault(); refazer(); return; }
      if (ctrl && (tecla === "a" || tecla === "A")) { e.preventDefault(); trocarFerramenta("selecionar"); setSel(todasChaves()); return; }
      // Espaço: inverte a mão da porta (na colocação ou as selecionadas); Shift+Espaço, o lado
      if (tecla === " " && !ctrl) {
        if (ferramenta === "esquadria") { e.preventDefault(); const m = -maoEsq; setMaoEsq(m); setPreviaEsq((p) => (p ? { ...p, mao: m } : p)); return; }
        if (selO.length) { e.preventDefault(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); inverterAberturas(e.shiftKey ? "lado" : "mao"); return; }
      }
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
        if (t === "d" || t === "j") { trocarFerramenta("esquadria"); setTipoEsq(t === "d" ? "porta_giro" : "janela_correr"); return; } // DR / WN no Revit
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
    // porta/janela primeiro (está dentro da parede); a porta de giro pega
    // também o quarto de círculo da folha
    for (const w of paredes) {
      const L = tpLen(w); if (!L || !(w.ab || []).length) continue;
      const ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L, pr = (p.x - w.a.x) * ux + (p.y - w.a.y) * uy, pn = -(p.x - w.a.x) * uy + (p.y - w.a.y) * ux;
      for (const o of tpAbsVisiveis(w)) {
        if (Math.abs(pr - o.x) > o.larg / 2) continue;
        const prof = tpGiro(o.tipo) ? (o.tipo === "porta_giro2" ? o.larg / 2 : o.larg) : 0, s = pn * (o.lado || 1);
        if (Math.abs(pn) <= Math.max(w.t / 2, tol) || (prof && s >= 0 && s <= w.t / 2 + prof)) return "o" + o.id;
      }
    }
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
      // quadradinho branco da parede selecionada: mexe SÓ esta parede (desliga
      // do canto); apertar na ponta sem selecionar leva as paredes ligadas junto
      if (perto(w.a)) return { tipo: "ponta", pi, fim: "a", solta: true };
      if (perto(w.b)) return { tipo: "ponta", pi, fim: "b", solta: true };
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
  // perto = trechos que mudaram: só os ambientes encostados neles são
  // refeitos (detectar um cômodo é caro; num arraste isso roda a cada quadro)
  const comAmbientes = (ps, ars, perto) => {
    if (!ars.some((a) => a.tipo === "ambiente" && a.ponto)) return ars;
    // No arraste, achar o contorno dos cômodos é o passo mais caro: refaz no
    // máximo a cada ~120 ms (e sempre ao soltar). Entre um e outro, os
    // ambientes ficam com o último contorno calculado.
    const g = gesto.current, agora = performance.now();
    if (g && g.moveu && !g.forcarAmb && g.ambUlt && agora - g.tAmb < 120) {
      const out = ars.map((a, i) => { const u = g.ambUlt[i]; return a.tipo === "ambiente" && u && u.tipo === "ambiente" ? { ...a, pts: u.pts, aberto: u.aberto } : a; });
      ambientesFeitos.current = { ps, out };
      return out;
    }
    const out0 = comAmbientesJa(ps, ars, perto);
    if (g && g.moveu) { g.ambUlt = out0; g.tAmb = agora; }
    return out0;
  };
  const comAmbientesJa = (ps, ars, perto) => {
    const seps = ars.filter((a) => a.tipo === "separador" && a.pts && a.pts.length === 2).map((a) => ({ a: a.pts[0], b: a.pts[1] }));
    let caixa = null;
    if (perto && perto.length) {
      caixa = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      for (const w of perto) for (const q of [w.a, w.b]) { caixa.x0 = Math.min(caixa.x0, q.x - (w.t || 0) - 0.3); caixa.y0 = Math.min(caixa.y0, q.y - (w.t || 0) - 0.3); caixa.x1 = Math.max(caixa.x1, q.x + (w.t || 0) + 0.3); caixa.y1 = Math.max(caixa.y1, q.y + (w.t || 0) + 0.3); }
    }
    const longe = (a) => {
      if (!caixa || a.aberto || !a.pts || a.pts.length < 3) return false;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const q of a.pts) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
      return x1 < caixa.x0 || x0 > caixa.x1 || y1 < caixa.y0 || y0 > caixa.y1;
    };
    const out = ars.map((a) => {
      if (a.tipo !== "ambiente" || !a.ponto || longe(a)) return a;
      const det = tpDetectarAmbiente(ps, a.ponto, seps);
      return det && !det.aberto ? { ...a, pts: det.pts, aberto: false } : { ...a, aberto: true };
    });
    ambientesFeitos.current = { ps, out };
    return out;
  };
  // Ponta de parede embaixo do cursor (até 10 px), mesmo sem a parede estar
  // selecionada: apertar ali e arrastar estica a parede (antes movia a parede
  // inteira, que ia "de um lado para o outro" com a grade). Num canto, fica a
  // parede em cujo corpo o cursor está.
  const pontaPerto = (d) => {
    const v = vista.current; if (!v) return null;
    const tol = 10 * (window.devicePixelRatio || 1), p = paraMundoLivre(d);
    let melhor = null, menor = Infinity;
    // emenda entre dois trechos da mesma curva não é ponta (puxar ali quebraria a curva)
    const gc = tpGruposCurva(paredes), cm = tpCantosMitra(paredes);
    paredes.forEach((w, i) => {
      for (const fim of ["a", "b"]) {
        if (gc[i] >= 0 && cm[i][fim] && gc[cm[i][fim].j] === gc[i]) continue;
        const q = w[fim]; if (Math.hypot(q.x * v.s + v.ox - d.x, q.y * v.s + v.oy - d.y) > tol) continue;
        const dd = distSeg(p, w.a, w.b) + (sel.includes("p" + i) ? -1 : 0);
        if (dd < menor) { menor = dd; melhor = { tipo: "ponta", pi: i, fim, chave: "p" + i }; }
      }
    });
    return melhor;
  };
  // Valor ao longo de um eixo com ímã ESTÁVEL: gruda num ponto/alinhamento
  // e só solta quando o cursor se afasta mais de 12 px dele (antes o ímã
  // ligava e desligava a cada pixel e a ponta pulava para lá e para cá).
  // Passo da grade de arraste conforme o zoom: o menor valor "redondo" que
  // ainda fica com uns 6 px na tela (afastado anda de 25/50 cm; bem perto, de 1 cm)
  const passoZoom = () => {
    const px = vista.current.s / (window.devicePixelRatio || 1);
    for (const p of [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1]) if (p * px >= 6) return p;
    return 1;
  };
  // Ímãs vindos do cursor (ponta grudada ou pontos de alinhamento), medidos
  // ao longo da direção d a partir de ref. Do alinhamento vale só o ponto-guia
  // (a outra coordenada do cursor é da grade, não é ímã).
  const imasDoCursor = (pc, ref, d) => [
    ...(pc.ima ? [(pc.x - ref.x) * d.x + (pc.y - ref.y) * d.y] : []),
    // só a guia que está alinhada com o cursor NESTA direção
    ...((pc.guias || []).filter((q) => Math.abs((q.x - pc.x) * d.x + (q.y - pc.y) * d.y) < 1e-6).map((q) => (q.x - ref.x) * d.x + (q.y - ref.y) * d.y)),
  ];
  // tIma: um valor ou uma lista de valores-ímã (faces e eixos de paredes, pontas...)
  // base: posição absoluta do zero do eixo (para a grade cair em valores
  // redondos da planta, ex.: y = 6,00, e não "1 m a partir de onde estava")
  const eixoEstavel = (g, chave, tCursor, tIma, base = 0) => {
    const px = vista.current.s / (window.devicePixelRatio || 1);
    const atual = g[chave];
    if (atual != null && Math.abs(tCursor - atual) * px < 12) return atual;
    const lista = Array.isArray(tIma) ? tIma : tIma != null ? [tIma] : [];
    let melhor = null, dmin = 8 / px;
    for (const t of lista) { const d = Math.abs(tCursor - t); if (d < dmin) { dmin = d; melhor = t; } }
    if (melhor != null) { g[chave] = melhor; return melhor; }
    g[chave] = null;
    const p = passoZoom();
    return Math.round(((Math.round((tCursor + base) / p) * p) - base) * 1000) / 1000;
  };
  // Linhas de paredes PARALELAS a uma direção (eixo e as duas faces), como
  // distâncias ao longo da normal n a partir de "ref": é onde uma linha que
  // anda de lado deve poder parar (alinhada com a face ou o eixo da parede)
  const linhasParalelas = (n, ref, ps, ignorar = []) => {
    const out = [];
    ps.forEach((w, i) => {
      const L = tpLen(w); if (!L || ignorar.includes(i)) return;
      const ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L;
      if (Math.abs(ux * n.x + uy * n.y) > 0.02) return; // não é paralela
      const d = (w.a.x - ref.x) * n.x + (w.a.y - ref.y) * n.y, h = (w.t || 0) / 2;
      out.push(d, d - h, d + h);
    });
    return out;
  };
  // Onde as paredes que CRUZAM uma linha (origem + u·t) a cortam — eixo e as
  // duas faces —, para a ponta que estica parar na face/eixo de outra parede
  const cortesNoEixo = (o, u, ps, ignorar = []) => {
    const out = [];
    ps.forEach((w, i) => {
      const L = tpLen(w); if (!L || ignorar.includes(i)) return;
      const vx = (w.b.x - w.a.x) / L, vy = (w.b.y - w.a.y) / L, den = u.x * vy - u.y * vx;
      if (Math.abs(den) < 0.2) return;
      const nx = -vy, ny = vx, h = (w.t || 0) / 2;
      for (const off of [0, -h, h]) {
        const ax = w.a.x + nx * off, ay = w.a.y + ny * off;
        const t = ((ax - o.x) * vy - (ay - o.y) * vx) / den, tv = ((ax - o.x) * u.y - (ay - o.y) * u.x) / den;
        if (tv > -0.3 && tv < L + 0.3) out.push(t);
      }
    });
    return out;
  };
  const arrastarAlca = (e, g) => {
    const al = g.grip, orig = g.orig;
    if (al.tipo === "rotulo") {
      // move só o nome, sem ímã nem grade; não sai de dentro do cômodo
      const a = orig.areas[al.ai]; if (!a || !a.pts || a.pts.length < 3) return;
      const q = paraMundoLivre(devPx({ clientX: e.clientX + al.off.x, clientY: e.clientY + al.off.y }));
      if (!tpDentroPoli(q, a.pts)) return;
      setAreas(orig.areas.map((x, i) => (i === al.ai ? { ...x, rotulo: { x: r3(q.x), y: r3(q.y) } } : x)));
      return;
    }
    if (al.tipo === "abertura") {
      // arrasta ao longo da parede; passando para outra parede, muda de parede
      // (como no Revit). Posição que não cabe: fica onde estava no quadro anterior.
      if (!sel.includes(al.chave)) setSel([al.chave]);
      const off = al.off || { x: 0, y: 0 };
      const pt = paraMundoLivre(devPx({ clientX: e.clientX + off.x, clientY: e.clientY + off.y }));
      const loc = tpAcharAbertura(orig.paredes, al.id); if (!loc) return;
      const h = hospedar(pt, loc.o.larg, orig.paredes); if (!h) return;
      let ps = orig.paredes.map((w, i) => (i === loc.i ? { ...w, ab: w.ab.filter((q) => q.id !== al.id) } : w));
      const novo = { ...loc.o, x: h.x, lado: h.i === loc.i ? loc.o.lado : h.lado };
      if (tpValidarAbertura(ps, h.i, novo, al.id)) return;
      ps = ps.map((w, i) => (i === h.i ? { ...w, ab: [...(w.ab || []), novo] } : w));
      setParedes(ps);
      return;
    }
    if (al.tipo === "mover") {
      if (!sel.includes(al.chave)) setSel(al.chaves);
      const off = al.off || { x: 0, y: 0 };
      if (!g.ligMover) {
        const mv = al.chaves.filter((k) => k[0] === "p").map((k) => +k.slice(1));
        g.ligMover = [...mv, ...orig.paredes.map((w, j) => (!mv.includes(j) && ["a", "b"].some((f) => mv.some((i) => tpDistSeg(w[f], orig.paredes[i].a, orig.paredes[i].b) < 2e-3)) ? j : -1)).filter((j) => j >= 0)];
      }
      const pc = pontoDoCursor({ clientX: e.clientX + off.x, clientY: e.clientY + off.y, shiftKey: e.shiftKey }, { base: al.ancora, ignorar: { paredes: g.ligMover, areas: al.chaves.filter((k) => k[0] === "a").map((k) => +k.slice(1)) } }); setHover(pc);
      let dx = pc.x - al.ancora.x, dy = pc.y - al.ancora.y;
      // Linha de separação sozinha anda só na perpendicular a ela mesma: as
      // pontas continuam encostadas nas mesmas paredes (o ímã/alinhamento podia
      // empurrá-la uns centímetros de lado e abrir uma fresta, e aí o cômodo
      // "vazava" para o vizinho em certas posições).
      const so = al.chaves.length === 1 && al.chaves[0][0] === "a" ? orig.areas[+al.chaves[0].slice(1)] : null;
      // Parede sozinha: anda só de lado (perpendicular a ela), sem pular pela
      // grade; gruda de forma estável em alinhamentos. Shift = livre em 90°.
      const pw = al.chaves.length === 1 && al.chaves[0][0] === "p" ? orig.paredes[+al.chaves[0].slice(1)] : null;
      if (pw && !e.shiftKey && tpLen(pw)) {
        const l = tpLen(pw), nx = -(pw.b.y - pw.a.y) / l, ny = (pw.b.x - pw.a.x) / l;
        const livre = paraMundoLivre(devPx({ clientX: e.clientX + off.x, clientY: e.clientY + off.y }));
        const nCur = (livre.x - al.ancora.x) * nx + (livre.y - al.ancora.y) * ny;
        const nIma = [...imasDoCursor(pc, al.ancora, { x: nx, y: ny }), ...linhasParalelas({ x: nx, y: ny }, al.ancora, orig.paredes, g.ligMover)];
        const dn = eixoEstavel(g, "snapN", nCur, nIma, al.ancora.x * nx + al.ancora.y * ny);
        dx = nx * dn; dy = ny * dn;
        setHover({ x: r3(al.ancora.x + dx), y: r3(al.ancora.y + dy) });
      }
      let areasBase = orig.areas;
      if (so && so.tipo === "separador" && so.pts && so.pts.length === 2) {
        const [a0, b0] = so.pts, l = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1, nx = -(b0.y - a0.y) / l, ny = (b0.x - a0.x) / l;
        // anda pela grade do zoom (perto = passos pequenos) e gruda nas faces e
        // eixos das paredes paralelas e nas outras linhas de separação
        const livreS = paraMundoLivre(devPx({ clientX: e.clientX + off.x, clientY: e.clientY + off.y }));
        const nCurS = (livreS.x - al.ancora.x) * nx + (livreS.y - al.ancora.y) * ny;
        const outrasSep = orig.areas.filter((x) => x !== so && x.tipo === "separador" && x.pts && x.pts.length === 2).map((x) => ({ a: x.pts[0], b: x.pts[1], t: 0 }));
        const imas = [...imasDoCursor(pc, al.ancora, { x: nx, y: ny }), ...linhasParalelas({ x: nx, y: ny }, al.ancora, [...orig.paredes, ...outrasSep])];
        const dn = e.shiftKey ? dx * nx + dy * ny : eixoEstavel(g, "snapS", nCurS, imas, al.ancora.x * nx + al.ancora.y * ny);
        dx = nx * dn; dy = ny * dn;
        setHover({ x: r3(al.ancora.x + dx), y: r3(al.ancora.y + dy), ...(g.snapS != null ? { ima: true } : {}) });
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
      // paredes ligadas nas pontas seguem (Alt solta a ligação durante o arraste)
      const movidas = new Set(al.chaves.filter((k) => k[0] === "p").map((k) => +k.slice(1)));
      const lig = e.altKey ? { ps: r.paredes, seguiram: [] } : tpSeguirLigadas(orig.paredes, r.paredes, movidas, dx, dy);
      const perto = [...movidas, ...lig.seguiram].flatMap((i) => [orig.paredes[i], lig.ps[i]]);
      setParedes(lig.ps); setAreas(comAmbientes(lig.ps, r.areas, movidas.size ? perto : null));
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
      if (!g.ligPonta) g.ligPonta = al.solta ? [] : orig.paredes.map((w, i) => (i !== al.pi && ["a", "b"].some((f) => Math.hypot(w[f].x - w0[al.fim].x, w[f].y - w0[al.fim].y) < 2e-3) ? i : -1)).filter((i) => i >= 0);
      let pc = pontoDoCursor(e, { ignorar: { parede: al.pi, paredes: g.ligPonta }, base: outra });
      // Esticar/encolher: a ponta anda na direção da própria parede (sem a
      // grade de 0,50 m puxar para o lado — era isso que fazia a parede
      // "tremer" com o mouse balançando). Afastando o cursor mais de ~25 px
      // da linha da parede, solta para girar livremente; Shift trava em 90°.
      const L0 = tpLen(w0) || 1, ux = (w0[al.fim].x - outra.x) / L0, uy = (w0[al.fim].y - outra.y) / L0;
      const livre = paraMundoLivre(devPx(e)), perpPx = Math.abs((livre.x - outra.x) * -uy + (livre.y - outra.y) * ux) * vista.current.s / (window.devicePixelRatio || 1);
      if (g.giroLivre ? perpPx < 8 : false) g.giroLivre = false;
      else if (!g.giroLivre && perpPx > 25) g.giroLivre = true;
      if (!g.giroLivre && !e.shiftKey) {
        const tCur = (livre.x - outra.x) * ux + (livre.y - outra.y) * uy;
        const tIma = [...imasDoCursor(pc, outra, { x: ux, y: uy }), ...cortesNoEixo(outra, { x: ux, y: uy }, orig.paredes, [al.pi, ...(g.ligPonta || [])])];
        const t = Math.max(0.05, eixoEstavel(g, "snapT", tCur, tIma, outra.x * ux + outra.y * uy));
        pc = { x: r3(outra.x + ux * t), y: r3(outra.y + uy * t), ...(pc.ima ? { ima: true } : {}) };
      }
      setHover(pc);
      // portas/janelas ficam no mesmo lugar da planta quando se mexe a ponta "a"
      // (a posição delas é medida a partir dessa ponta)
      // a ponta leva junto as outras paredes ligadas nela (Alt solta)
      const p0 = w0[al.fim], ligadas = [];
      const novasP = orig.paredes.map((w, i) => {
        if (i === al.pi) return tpComPonta(w, al.fim, limpo(pc));
        if (e.altKey || al.solta) return w;
        let nw = w;
        for (const fim of ["a", "b"]) if (Math.hypot(w[fim].x - p0.x, w[fim].y - p0.y) < 2e-3) nw = tpComPonta(nw, fim, limpo(pc));
        if (nw !== w) ligadas.push(i);
        return nw;
      });
      setParedes(novasP); setAreas(comAmbientes(novasP, orig.areas, [w0, novasP[al.pi], ...ligadas.flatMap((i) => [orig.paredes[i], novasP[i]])]));
    }
  };
  const planDown = (e) => {
    const d = devPx(e);
    if (e.button === 0 && ferramenta === "selecionar") {
      const eq = iconeEq.current;
      if (eq && Math.abs(d.x - eq.x) <= eq.r && Math.abs(d.y - eq.y) <= eq.r) {
        if (eq.centrada) avisar("Já está centralizada entre as paredes.");
        else if (editarAberturas([eq.id], (o) => ({ ...o, x: eq.x0 }))) avisar("Centralizada entre as paredes mais próximas.");
        return;
      }
      const cq = cotasClic.current.find((q) => Math.abs(d.x - q.x) <= q.r && Math.abs(d.y - q.y) <= q.r * 0.6);
      if (cq) {
        const rc = planRef.current.getBoundingClientRect(), k = planRef.current.width / rc.width;
        // sem o preventDefault, o mousedown que vem depois tira o foco do campo e ele fecha;
        // o campo fica sempre dentro da planta (senão o quadro rola para mostrá-lo)
        e.preventDefault();
        setEditCota({ x: Math.max(44, Math.min(rc.width - 44, cq.x / k)), y: Math.max(18, Math.min(rc.height - 18, cq.y / k)), lado: cq.lado, id: cq.id, parede: cq.parede, txt: tpFmt(cq.d), t: Date.now() });
        return;
      }
      // nome do ambiente: apertar e arrastar move o nome; clicar de novo nele
      // (já selecionado) abre a edição do nome. A área não se edita: é calculada.
      const rq = !e.ctrlKey && !e.metaKey && !e.shiftKey && [...rotulosClic.current].reverse().find((q) => d.x >= q.x0 && d.x <= q.x1 && d.y >= q.y0 && d.y <= q.y1);
      if (rq && areas[rq.ai]) {
        const ja = sel.length === 1 && sel[0] === "a" + rq.ai;
        if (!ja) setSel(["a" + rq.ai]);
        gesto.current = { x: d.x, y: d.y, x0: d.x, y0: d.y, moveu: false, grip: { tipo: "rotulo", chave: "a" + rq.ai, ai: rq.ai, ja, off: desvioCliente(tpRotuloAmb(areas[rq.ai]), e) }, orig: { paredes, areas } };
        e.currentTarget.setPointerCapture(e.pointerId); return;
      }
      const al = alcaNoPonto(d) || (!e.ctrlKey && !e.metaKey && !e.shiftKey ? pontaPerto(d) : null);
      if (al) {
        if (al.chave && !sel.includes(al.chave)) setSel([al.chave]);
        gesto.current = { x: d.x, y: d.y, x0: d.x, y0: d.y, moveu: false, grip: al, orig: { paredes, areas } }; e.currentTarget.setPointerCapture(e.pointerId); return;
      }
      // Arrastar uma parede ou linha de separação (ou uma área já selecionada)
      // move o elemento — e o que estiver selecionado junto. Os ambientes em
      // volta refazem a área sozinhos. Ctrl/Shift continuam sendo seleção.
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const k = elementoNoPonto(d);
        if (k && k[0] === "o") {
          const loc = tpAcharAbertura(paredes, k.slice(1));
          if (loc) {
            const L = tpLen(loc.w) || 1, c = { x: loc.w.a.x + (loc.w.b.x - loc.w.a.x) / L * loc.o.x, y: loc.w.a.y + (loc.w.b.y - loc.w.a.y) / L * loc.o.x };
            gesto.current = { x: d.x, y: d.y, x0: d.x, y0: d.y, moveu: false, grip: { tipo: "abertura", chave: k, id: loc.o.id, off: desvioCliente(c, e) }, orig: { paredes, areas } };
            e.currentTarget.setPointerCapture(e.pointerId); return;
          }
        }
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
    if (e.button === 0 && ferramenta !== "selecionar" && ferramenta !== "mover" && ferramenta !== "ambiente" && ferramenta !== "esquadria" && !poli.length && !ancora) {
      const k = elementoNoPonto(d);
      const idx = k ? +k.slice(1) : -1;
      if (k && (k[0] === "p" || (areas[idx] && areas[idx].tipo === "separador"))) {
        const pm = paraMundoLivre(d), cands = k[0] === "p" ? [paredes[idx].a, paredes[idx].b] : areas[idx].pts;
        const anc = cands.reduce((m, q) => (Math.hypot(q.x - pm.x, q.y - pm.y) < Math.hypot(m.x - pm.x, m.y - pm.y) ? q : m), cands[0]);
        g.candMover = { tipo: "mover", chave: k, chaves: [k], ancora: anc, off: desvioCliente(anc, e) };
      }
      const pp = pontaPerto(d); // apertar na ponta e arrastar estica (só clicar continua desenhando dali)
      if (pp) g.candMover = pp;
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
      if (g.grip) {
        // junta os movimentos num quadro de tela só (o mouse manda mais
        // eventos do que a tela consegue desenhar)
        if (g.moveu) {
          g.ultimo = { clientX: e.clientX, clientY: e.clientY, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey };
          // processa no quadro seguinte e renderiza na hora (flushSync): o
          // elemento é desenhado no mesmo quadro em que a tela vai pintar,
          // sem esperar o React agendar (antes ficava 1–2 quadros atrás do cursor)
          if (!g.raf) g.raf = requestAnimationFrame(() => { g.raf = 0; if (gesto.current === g && g.ultimo) { const ev = g.ultimo; try { tpFlushSync(() => arrastarAlca(ev, g)); } catch (err) { arrastarAlca(ev, g); } } });
        }
        return;
      }
      if (g.menu) return;
      if (g.moveu) {
        if (g.panear || ferramenta !== "selecionar") {
          const v = vista.current; vista.current = { ...v, ox: v.ox + d.x - g.x, oy: v.oy + d.y - g.y }; g.x = d.x; g.y = d.y; desenharPlanta(); return;
        }
        setCaixa({ x0: g.x0, y0: g.y0, x1: d.x, y1: d.y }); return;
      }
    }
    if (ferramenta === "parede" || ferramenta === "separador" || tpEhPoli(ferramenta)) setHover(pontoDoCursor(e));
    if (ferramenta === "esquadria") setPreviaEsq(previaEsqEm(paraMundoLivre(d)));
  };
  const planUp = (e) => {
    const g = gesto.current; gesto.current = null;
    if (!g) return;
    clearTimeout(g.timer);
    if (g.grip) {
      // movimento que ainda esperava o próximo quadro: aplica já, para a
      // posição final ser exatamente onde o botão foi solto
      if (g.raf) { cancelAnimationFrame(g.raf); g.raf = 0; }
      // posição final com tudo recalculado (ambientes e análise)
      if (g.moveu && g.ultimo) { g.forcarAmb = true; arrastarAlca(g.ultimo, g); }
      if (g.moveu) { historico.current.push(g.orig); if (historico.current.length > 200) historico.current.shift(); futuro.current = []; }
      else if (g.grip.tipo === "mover" || g.grip.tipo === "abertura") aplicarSelecao([g.grip.chave], g); // só clicou: seleciona
      else if (g.grip.tipo === "rotulo" && g.grip.ja) abrirEditNome(g.grip.ai, e); // clicou no nome já selecionado: edita
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
        paredes.forEach((w) => { const L = tpLen(w); if (L) for (const o of tpAbsVisiveis(w)) if (dentro({ x: w.a.x + (w.b.x - w.a.x) / L * o.x, y: w.a.y + (w.b.y - w.a.y) / L * o.x })) achadas.push("o" + o.id); });
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
    if (ferramenta === "esquadria") { setDigitado(""); colocarEsquadria(previaEsqEm(paraMundoLivre(devPx(e)))); return; }
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
        const idCurva = Date.now().toString(36);
        for (const q of arc.pts) { novas.push({ a: ant, b: q, t: espM, h: altM, ...(arc.pts.length > 1 ? { curva: idCurva } : {}) }); ant = q; }
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
  const quadro = useMemo(() => tpQuadroEsquadrias(paredes), [paredes]);
  const areaAberturas = useMemo(() => tpAreaAberturas(paredes), [paredes]);
  const somaArea = (tipo, f) => areas.filter((a) => a.tipo === tipo).reduce((s, a) => s + f(a), 0);
  // análise das áreas (pegada da casa etc.): no arraste refeita no máximo a
  // cada ~150 ms; parado, sempre na hora
  const analiseCache = useRef(null);
  const analise = (() => {
    const c0 = analiseCache.current, agora = performance.now();
    if (c0 && c0.ar === areas && c0.ps === paredes) return c0.r;
    if (c0 && gesto.current && gesto.current.moveu && agora - c0.t < 150) return c0.r;
    const r = tpAnaliseAreas(areas, paredes); analiseCache.current = { ar: areas, ps: paredes, r, t: agora }; return r;
  })();
  // área real da peça: no contrapiso que envolve a casa, sem a casa (pegada)
  const cobPtsC = areas.filter((a) => (a.tipo === "laje" || a.tipo === "telhado") && a.pts && a.pts.length >= 3).map((a) => a.pts);
  const furadoArea = (a) => a.tipo === "contrapiso" && a.pts && a.pts.length >= 3 && tpTipoContrapiso(a.pts, analise.pegada, cobPtsC) === "furado";
  const areaLiquida = (a) => (furadoArea(a) ? Math.max(0, tpAreaPoli(a.pts) - tpAreaDentro(a.pts, analise.pegada)) : tpAreaPoli(a.pts || []));
  const areaCp = somaArea("contrapiso", areaLiquida), volCp = somaArea("contrapiso", (a) => areaLiquida(a) * (a.esp || 0));
  const areaLj = somaArea("laje", (a) => tpAreaPoli(a.pts)), volLj = somaArea("laje", (a) => tpAreaPoli(a.pts) * (a.esp || 0));
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
    { id: "esquadria", rotulo: "Porta/Janela", dica: "Porta (D), janela (J) e vão: passe o cursor na parede e clique. Espaço inverte a mão" },
    { id: "mover", rotulo: "Mover", dica: "Mover a vista (H)" },
  ];
  const MODOS = [{ id: "planta", rotulo: "Planta" }, { id: "ambos", rotulo: "Planta + 3D" }, { id: "3d", rotulo: "3D" }];
  const mostraPlanta = modo !== "3d", mostra3d = modo !== "planta";

  const desenhoAtivo = ferramenta === "parede" || tpEhPoli(ferramenta);
  const status = (ferramenta === "separador" && dividir) ? `Dividindo "${(areas[dividir.ai] || {}).nome || "ambiente"}": clique de uma parede até a outra (pode quebrar a linha). Esc cancela.`
    : ferramenta === "separador" ? (inicio ? "Clique o fim da linha. Esc cancela." : "Separador: linha que divide ambientes sem parede. Clique de uma parede até a outra.")
    : ferramenta === "ambiente" ? "Clique dentro de um cômodo fechado por paredes para criar o ambiente (nome e área)."
    : ferramenta === "esquadria" ? (() => {
        const t = tpEsq(tipoEsq), dm = dimsEsq[tipoEsq] || t, nome = `${t.rotulo} ${tpFmt(dm.larg)} × ${tpFmt(dm.alt)}`;
        if (digitado) return `Distância até a face da parede: ${digitado} m — Enter coloca, Esc apaga.`;
        if (!previaEsq) return `${nome}: passe o cursor sobre uma parede.`;
        if (previaEsq.motivo) return `${previaEsq.motivo}. Mova para outro ponto da parede.`;
        return `${nome}: clique para colocar${tpGiro(tipoEsq) ? " (abre para o lado do cursor; Espaço troca a mão)" : ""}. Ou digite a distância até a parede e Enter.`;
      })()
    : digitado ? `Comprimento: ${digitado} m — Enter confirma, Esc apaga.`
    : (desenhoAtivo && modoTraco === "retangulo") ? (ancora && ancora.ret
        ? (ancora.d1 ? `1ª medida ${tpFmt(Math.abs(ancora.d1.v))} m fixada. Digite a 2ª e Enter, ou clique para escolher o lado.` : "Aponte o cursor para o lado e digite a 1ª medida + Enter (ou clique o canto oposto). Esc cancela.")
        : "Retângulo: clique o primeiro canto.")
    : (desenhoAtivo && modoTraco === "arco") ? (ancora && ancora.arcoFim ? "Mova para curvar e clique um ponto da curva. Esc cancela." : ((ferramenta === "parede" ? inicio : poli.length) ? "Arco: clique o ponto final." : "Arco: clique o ponto inicial."))
    : (selA.length === 1 && !selP.length && ferramenta === "selecionar" && areas[selA[0]].tipo === "ambiente") ? "Ambiente: arraste o nome para mudar de lugar; clique no nome para editar. A área é calculada pelas paredes."
    : (selA.length === 1 && !selP.length && ferramenta === "selecionar") ? "Editar contorno: arraste os quadrados (cantos) ou as bolinhas (lados). O cursor gruda nas quinas das paredes (quadrado verde)."
    : (selO.length === 1 && sel.length === 1 && ferramenta === "selecionar") ? "Arraste para mover (até para outra parede). Clique na cota para digitar a medida; EQ centraliza. Espaço inverte a mão."
    : (selP.length === 1 && !selA.length && ferramenta === "selecionar") ? "Quadradinho branco: estica só esta parede (solta do canto). Sem selecionar, arrastar a ponta leva as paredes ligadas. Delete exclui."
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
          {selO.length && sel.length === selO.length ? (selO.length === 1 ? `${tpEsq(selO[0].o.tipo).rotulo} · ${quadro.codigoDe.get(selO[0].o.id) || ""}` : `${selO.length} esquadrias`)
            : selP.length && !selA.length && sel.length === selP.length ? (selP.length === 1 ? "Parede" : `${selP.length} paredes`)
            : selA.length && !selP.length ? (selA.length === 1 ? TP_AREA_TIPOS[areas[selA[0]].tipo].nome : `${selA.length} áreas`)
            : `${sel.length} elementos`}
        </div>
        {selO.length > 0 && sel.length === selO.length && (() => {
          const ids = selO.map((x) => x.o.id), um = selO.length === 1 ? selO[0] : null;
          const tipoComum = comum(selO, (x) => TP_ESQ.indexOf(tpEsq(x.o.tipo)));
          const t = tipoComum != null ? TP_ESQ[tipoComum] : null;
          const viz = um ? tpVizinhos(paredes, um.i, um.o.x - um.o.larg / 2, um.o.x + um.o.larg / 2) : null;
          const dA = um ? um.o.x - um.o.larg / 2 - viz.antes : 0, dB = um ? viz.depois - (um.o.x + um.o.larg / 2) : 0;
          const madeiraSel = comum(selO, (x) => ((x.o.mat || tpEsq(x.o.tipo).mat) === "madeira" ? 1 : 0)) === 1;
          const selStyle = { width: "100%", padding: "7px 8px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", background: "#fff" };
          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="tp-o-tipo" style={{ display: "block", fontSize: 12, color: "#4b5563", marginBottom: 4 }}>Tipo</label>
                <select id="tp-o-tipo" value={t ? t.id : ""} style={selStyle}
                  onChange={(e) => { const n = tpEsq(e.target.value); editarAberturas(ids, (o) => ({ ...o, tipo: n.id, larg: n.larg, alt: n.alt, peit: n.peit, ...(n.mat ? { mat: n.mat } : { mat: undefined }) })); }}>
                  {!t && <option value="">vários</option>}
                  {TP_ESQ.map((x) => <option key={x.id} value={x.id}>{x.rotulo}</option>)}
                </select>
              </div>
              <TpCampo id="tp-o-larg" rotulo="Largura (m)" valor={comum(selO, (x) => x.o.larg)} onConfirmar={(v) => editarAberturas(ids, (o) => ({ ...o, larg: v }))} />
              <TpCampo id="tp-o-alt" rotulo="Altura (m)" valor={comum(selO, (x) => x.o.alt)} onConfirmar={(v) => editarAberturas(ids, (o) => ({ ...o, alt: v }))} />
              <TpCampo id="tp-o-peit" rotulo="Peitoril (m)" min={-0.0001} valor={comum(selO, (x) => x.o.peit || 0)} somenteLeitura={!!t && t.cat !== "J"} onConfirmar={(v) => editarAberturas(ids, (o) => ({ ...o, peit: v }))} />
              {t && t.mat && tpGiro(t.id) ? (
                <div style={{ minWidth: 0 }}>
                  <label htmlFor="tp-o-mat" style={{ display: "block", fontSize: 12, color: "#4b5563", marginBottom: 4 }}>Material</label>
                  <select id="tp-o-mat" value={madeiraSel ? "madeira" : "aluminio"} style={selStyle} onChange={(e) => editarAberturas(ids, (o) => ({ ...o, mat: e.target.value }))}>
                    <option value="madeira">Madeira</option><option value="aluminio">Alumínio</option>
                  </select>
                </div>
              ) : <TpCampo id="tp-o-area" rotulo="Área do vão (m²)" valor={comum(selO, (x) => x.o.larg * x.o.alt)} somenteLeitura onConfirmar={() => {}} />}
              {um && <TpCampo id="tp-o-da" rotulo="Até a parede (lado A)" min={-0.0001} valor={Math.max(0, dA)} onConfirmar={(v) => editarAberturas(ids, (o) => ({ ...o, x: r3(viz.antes + v + o.larg / 2) }))} />}
              {um && <TpCampo id="tp-o-db" rotulo="Até a parede (lado B)" min={-0.0001} valor={Math.max(0, dB)} onConfirmar={(v) => editarAberturas(ids, (o) => ({ ...o, x: r3(viz.depois - v - o.larg / 2) }))} />}
              {um && (
                <button style={{ ...btn, gridColumn: "1 / -1", minHeight: 30, padding: "4px 8px", fontSize: 12.5 }} disabled={Math.abs(dA - dB) < 0.005}
                  onClick={() => editarAberturas(ids, (o) => ({ ...o, x: r3((viz.antes + viz.depois) / 2) }))}>
                  {Math.abs(dA - dB) < 0.005 ? "Centralizada entre as paredes" : "Centralizar entre as paredes (EQ)"}
                </button>
              )}
              {t && t.cat !== "V" && t.id !== "fixo" && (
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 6 }}>
                  <button style={{ ...btn, flex: 1, minHeight: 30, padding: "4px 8px", fontSize: 12.5 }} title="Espaço" onClick={() => inverterAberturas("mao")}>Inverter mão</button>
                  <button style={{ ...btn, flex: 1, minHeight: 30, padding: "4px 8px", fontSize: 12.5 }} title="Shift + Espaço" onClick={() => inverterAberturas("lado")}>Inverter lado</button>
                </div>
              )}
              <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: "#4b5563", lineHeight: 1.4 }}>
                {madeiraSel
                  ? "Porta de madeira: no orçamento entra pelos Cômodos da obra (kit de porta)."
                  : t && t.cat === "V" ? "Vão livre: abre a parede, sem esquadria. Entra no desconto de aberturas."
                  : "Alumínio: vai para as esquadrias do orçamento de obra (linha Gold), agrupada pelo código do quadro."}
                {" "}Arraste na planta para mudar de posição ou de parede.
              </div>
            </div>
          );
        })()}
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
            {selA.length === 1 && <TpCampo id="tp-a-area" rotulo={furadoArea(areas[selA[0]]) ? "Área sem a casa (m²)" : "Área (m²)"} valor={areaLiquida(areas[selA[0]])} somenteLeitura onConfirmar={() => {}} />}
            {selA.length === 1 && <TpCampo id="tp-a-per" rotulo={furadoArea(areas[selA[0]]) ? "Perímetro externo (m)" : "Perímetro (m)"} valor={tpPerimPoli(areas[selA[0]].pts)} somenteLeitura onConfirmar={() => {}} />}
            {selA.length === 1 && furadoArea(areas[selA[0]]) && (
              <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: "#4b5563", lineHeight: 1.4 }}>
                Contorno desenhado {tpFmt(tpAreaPoli(areas[selA[0]].pts))} m² − casa {tpFmt(tpAreaDentro(areas[selA[0]].pts, analise.pegada))} m² (pela face de fora das paredes).
              </div>
            )}
            <TpCampo id="tp-a-esp" rotulo="Espessura (cm)" casas={0} valor={comum(selA, (i) => Math.round((areas[i].esp || 0) * 100))} onConfirmar={(v) => editarAreas(selA, (a) => ({ ...a, esp: v / 100 }))} />
            <TpCampo id="tp-a-cota" rotulo="Nível (m)" min={-0.0001} valor={comum(selA, (i) => areas[i].cota || 0)} onConfirmar={(v) => editarAreas(selA, (a) => ({ ...a, cota: v }))} />
            {selA.every((i) => areas[i].tipo === "contrapiso") && (() => {
              const ac = comum(selA, (i) => ["pedra", "deck", "porcelanato"].indexOf(areas[i].acab || "pedra"));
              const atual = ac == null ? "" : ["pedra", "deck", "porcelanato"][ac];
              return (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="tp-a-acab" style={{ display: "block", fontSize: 12, color: "#4b5563", marginBottom: 4 }}>Acabamento (piso externo)</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select id="tp-a-acab" value={atual} onChange={(e) => editarAreas(selA, (a) => ({ ...a, acab: e.target.value }))}
                      style={{ flex: 1, minWidth: 0, padding: "7px 8px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", background: "#fff" }}>
                      {ac == null && <option value="">vários</option>}
                      <option value="pedra">Pedra irregular</option><option value="deck">Deck de madeira</option><option value="porcelanato">Porcelanato externo</option>
                    </select>
                    {atual === "deck" && <button style={{ ...btn, minHeight: 34, padding: "4px 10px", fontSize: 12.5 }} title="Girar o sentido das ripas em 90°" onClick={() => editarAreas(selA, (a) => ({ ...a, angRipa: (a.angRipa || 0) ? 0 : Math.PI / 2 }))}>Girar ripas</button>}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, lineHeight: 1.4 }}>Vale para o piso fora da casa. O contrapiso que envolve a casa conta só a parte de fora (a casa fica recortada).</div>
                </div>
              );
            })()}
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

      {ferramenta === "esquadria" && (() => {
        const t = tpEsq(tipoEsq), dm = dimsEsq[tipoEsq] || t;
        const setDm = (patch) => setDimsEsq((d) => ({ ...d, [tipoEsq]: { ...(d[tipoEsq] || t), ...patch } }));
        return (
          <>
            <div style={secao}>Nova esquadria</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {TP_ESQ.map((x) => (
                <button key={x.id} onClick={() => setTipoEsq(x.id)}
                  style={{ ...btn, padding: "6px 6px", fontSize: 12, minHeight: 32, borderColor: tipoEsq === x.id ? TP_AZUL : "#e5e7eb", background: tipoEsq === x.id ? "#eef5ff" : "#fff", color: tipoEsq === x.id ? TP_AZUL : "#111827", fontWeight: tipoEsq === x.id ? 600 : 500 }}>{x.curto}</button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <TpCampo id="tp-ne-larg" rotulo="Largura (m)" valor={dm.larg} onConfirmar={(v) => setDm({ larg: v })} />
              <TpCampo id="tp-ne-alt" rotulo="Altura (m)" valor={dm.alt} onConfirmar={(v) => setDm({ alt: v })} />
              {t.cat === "J" && <TpCampo id="tp-ne-peit" rotulo="Peitoril (m)" min={-0.0001} valor={dm.peit} onConfirmar={(v) => setDm({ peit: v })} />}
              {tpGiro(t.id) && (
                <div style={{ minWidth: 0 }}>
                  <label htmlFor="tp-ne-mat" style={{ display: "block", fontSize: 12, color: "#4b5563", marginBottom: 4 }}>Material</label>
                  <select id="tp-ne-mat" value={dm.mat || "madeira"} onChange={(e) => setDm({ mat: e.target.value })} style={{ width: "100%", padding: "7px 8px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", background: "#fff" }}>
                    <option value="madeira">Madeira</option><option value="aluminio">Alumínio</option>
                  </select>
                </div>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 6, lineHeight: 1.4 }}>Passe na parede e clique. Gruda no meio da parede e a 10 cm do canto; digite a distância até a parede + Enter para medida exata.</div>
          </>
        );
      })()}

      {propriedades}

      {quadro.grupos.length > 0 && (
        <>
          <div style={secao}>Quadro de esquadrias</div>
          <div>
            {quadro.grupos.map((g) => (
              <button key={g.codigo} onClick={() => { trocarFerramenta("selecionar"); setSel(g.ids.map((id) => "o" + id)); }}
                style={{ ...linhaQ, width: "100%", background: "none", border: "none", borderBottom: "1px solid #f0f2f5", cursor: "pointer", fontFamily: "inherit", textAlign: "left", alignItems: "flex-start" }}>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ color: "#111827" }}>{g.codigo}</strong> {g.rot}{g.mat === "madeira" ? " (madeira)" : ""}
                  <span style={{ display: "block", fontSize: 11.5, color: "#6b7280" }}>{tpFmt(g.larg)} × {tpFmt(g.alt)} m{g.peit ? ` · peitoril ${tpFmt(g.peit)}` : ""}</span>
                </span>
                <span style={numQ}>{g.qtd} un</span>
              </button>
            ))}
          </div>
        </>
      )}

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
                  {sincronizar ? (ultimaSinc ? `Atualizado às ${ultimaSinc.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Paredes, área, laje, telhado, cômodos, portas e esquadrias") : "Desligado: só pelo botão"}
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
        <div style={linhaQ}><span>Área de parede{areaAberturas > 0 ? " (bruta)" : ""}</span><span style={numQ}>{tpFmt(A)} m²</span></div>
        {areaAberturas > 0 && <div style={linhaQ}><span style={{ paddingLeft: 10 }}>aberturas · líquida</span><span style={numQ}>{tpFmt(areaAberturas)} · {tpFmt(A - areaAberturas)} m²</span></div>}
        <div style={linhaQ}><span>Reboco 2 faces</span><span style={numQ}>{tpFmt((A - areaAberturas) * 2)} m²</span></div>
        <div style={linhaQ}><span>Área construída (coberta)</span><span style={numQ}>{tpFmt(analise.coberta)} m²</span></div>
        <div style={linhaQ}><span>Contrapiso</span><span style={numQ}>{tpFmt(areaCp)} m² · {tpFmt(volCp)} m³</span></div>
        {(analise.temCobertura || (analise.pegada || []).length > 0) && areaCp > 0 && <div style={linhaQ}><span style={{ paddingLeft: 10 }}>interno · externo</span><span style={numQ}>{tpFmt(analise.pisoInterno)} · {tpFmt(analise.pisoExterno)} m²</span></div>}
        {analise.terreno > 0 && <div style={linhaQ}><span>Terreno</span><span style={numQ}>{tpFmt(analise.terreno)} m²</span></div>}
        {analise.terreno > 0 && <div style={linhaQ}><span style={{ paddingLeft: 10 }}>Taxa de ocupação</span><span style={numQ}>{tpFmt(analise.taxaOcupacao * 100, 1)}%</span></div>}
        {analise.terreno > 0 && <div style={linhaQ}><span style={{ paddingLeft: 10 }}>Área livre (sem piso nem cobertura)</span><span style={numQ}>{tpFmt(analise.permeavel)} m²</span></div>}
        <div style={linhaQ}><span>Telhado (projeção · real)</span><span style={numQ}>{tpFmt(telProj)} · {tpFmt(telReal)} m²</span></div>
        <div style={linhaQ}><span>Laje</span><span style={numQ}>{tpFmt(areaLj)} m² · {tpFmt(volLj)} m³</span></div>
      </div>
      <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 10, lineHeight: 1.4 }}>Teste: salvo só neste navegador. Para o orçamento de obra vai o m² de parede líquido (descontando portas e janelas).</div>
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
      {ferramenta === "esquadria" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 2, background: "rgba(255,255,255,0.94)", borderRadius: 10, padding: 3, border: "1px solid #e5e7eb", pointerEvents: "auto" }}>
          {TP_ESQ.map((x) => (
            <button key={x.id} title={x.rotulo} onClick={() => setTipoEsq(x.id)}
              style={{ border: "none", borderRadius: 7, padding: isMobile ? "6px 7px" : "6px 10px", fontSize: isMobile ? 12 : 12.5, cursor: "pointer", fontFamily: "inherit", background: tipoEsq === x.id ? "#111827" : "transparent", color: tipoEsq === x.id ? "#fff" : "#374151", fontWeight: 600 }}>
              {x.curto}
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
              onPointerDown={planDown} onPointerMove={(e) => { planMove(e); if (!gesto.current && ferramenta === "selecionar") { const dd = devPx(e), eq = iconeEq.current; e.currentTarget.style.cursor = (eq && Math.abs(dd.x - eq.x) <= eq.r && Math.abs(dd.y - eq.y) <= eq.r) || cotasClic.current.some((q) => Math.abs(dd.x - q.x) <= q.r && Math.abs(dd.y - q.y) <= q.r * 0.6) ? "pointer" : (alcaNoPonto(dd) || rotulosClic.current.some((q) => dd.x >= q.x0 && dd.x <= q.x1 && dd.y >= q.y0 && dd.y <= q.y1)) ? "move" : "default"; } }} onPointerUp={planUp} onPointerLeave={() => { if (!inicio && !poli.length && !gesto.current) setHover(null); else if (!gesto.current && hover && hover.guias) setHover({ x: hover.x, y: hover.y }); if (!gesto.current) setPreviaEsq(null); }} />
            {barraFerramentas}
            {editNome && (
              <input ref={(el) => { if (el && document.activeElement !== el) { el.focus({ preventScroll: true }); el.select(); } }} aria-label="Nome do ambiente" value={editNome.txt}
                onChange={(e) => setEditNome({ ...editNome, txt: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") aplicarNome(editNome); if (e.key === "Escape") setEditNome(null); e.stopPropagation(); }}
                onBlur={(e) => { if (Date.now() - editNome.t < 300) { const el = e.currentTarget; setTimeout(() => el.focus({ preventScroll: true }), 0); return; } aplicarNome(editNome); }}
                style={{ position: "absolute", left: editNome.x, top: editNome.y, transform: "translate(-50%, -50%)", zIndex: 3, width: 130, padding: "3px 6px", border: "2px solid " + TP_AZUL, outline: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, textAlign: "center", color: TP_AZUL, fontFamily: "inherit", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }} />
            )}
            {editCota && (
              <input ref={(el) => { if (el && document.activeElement !== el) { el.focus({ preventScroll: true }); el.select(); } }} inputMode="decimal" aria-label={editCota.parede ? (editCota.parede.tipo === "comp" || editCota.parede.tipo === "lig" ? "Comprimento da parede (m)" : "Distância até a parede (m)") : "Distância até a parede (m)"} value={editCota.txt}
                onChange={(e) => setEditCota({ ...editCota, txt: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") aplicarCota(editCota); if (e.key === "Escape") setEditCota(null); e.stopPropagation(); }}
                onBlur={(e) => { if (Date.now() - editCota.t < 300) { const el = e.currentTarget; setTimeout(() => el.focus({ preventScroll: true }), 0); return; } setEditCota(null); }}
                style={{ position: "absolute", left: editCota.x, top: editCota.y, transform: "translate(-50%, -50%)", zIndex: 3, width: 72, padding: "3px 6px", border: "2px solid #0284c7", outline: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, textAlign: "center", color: "#0284c7", fontVariantNumeric: "tabular-nums", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }} />
            )}
            {aviso && (
              <div role="status" style={{ position: "absolute", left: "50%", bottom: 64, transform: "translateX(-50%)", zIndex: 2, maxWidth: "min(460px, 90%)", background: "#111827", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 13, lineHeight: 1.4, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>{aviso}</div>
            )}
            {digitado && (
              <div style={{ position: "absolute", left: "50%", top: 74, transform: "translateX(-50%)", zIndex: 1, background: "#111827", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
                {ferramenta === "esquadria" ? "Até a parede: " : modoTraco === "retangulo" && ancora && ancora.ret ? (ancora.d1 ? "2ª medida: " : "1ª medida: ") : ""}{digitado} m <span style={{ fontWeight: 400, opacity: 0.7, fontSize: 12, marginLeft: 6 }}>Enter</span>
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
                    Parede em m² líquido (descontando portas e janelas), parede externa identificada pelo contorno da casa. Cômodos pelos ambientes desenhados e portas internas pelas portas desenhadas. Por enquanto só obra térrea.
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
              ["Desenho", [["P / C / L", "parede / contrapiso / laje"], ["V", "selecionar"], ["Digitar número + Enter", "trecho com esse comprimento, na direção do cursor"], ["Shift (desenhando)", "trava em 0° / 90°"], ["Pontas existentes", "o cursor gruda nelas (ímã)"], ["D / J", "porta / janela: passe na parede e clique"], ["Espaço", "inverte a mão da porta (Shift+Espaço: o lado)"], ["Enter", "encerra o traço; sem traço, repete o último comando"], ["Esc", "cancela em camadas: número → traço → seleção"]]],
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
              {selO.length > 0 && item("Inverter mão", "Espaço", () => inverterAberturas("mao"))}
              {selO.length > 0 && item("Inverter lado de abertura", "Shift+Espaço", () => inverterAberturas("lado"))}
              {sel.length > 0 && item("Limpar seleção", "Esc", () => setSel([]))}
              {sel.length > 0 && linha("l1")}
              {item("Desfazer", "Ctrl+Z", desfazer, { desativado: !historico.current.length })}
              {item("Refazer", "Ctrl+Y", refazer, { desativado: !futuro.current.length })}
              {item("Selecionar tudo", "Ctrl+A", () => { trocarFerramenta("selecionar"); setSel(todasChaves()); }, { desativado: !paredes.length && !areas.length })}
              {linha("l2")}
              {item("Desenhar parede", "P", () => trocarFerramenta("parede"))}
              {item("Inserir contrapiso", "C", () => trocarFerramenta("contrapiso"))}
              {item("Inserir laje", "L", () => trocarFerramenta("laje"))}
              {item("Inserir telhado", "T", () => trocarFerramenta("telhado"))}
              {item("Desenhar terreno", "R", () => trocarFerramenta("terreno"))}
              {item("Inserir porta", "D", () => { trocarFerramenta("esquadria"); setTipoEsq("porta_giro"); })}
              {item("Inserir janela", "J", () => { trocarFerramenta("esquadria"); setTipoEsq("janela_correr"); })}
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
