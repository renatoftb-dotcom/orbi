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
};

// Editor em tela cheia. Elementos: paredes (segmentos) e áreas (contrapiso e
// laje, polígonos). Seleção compartilhada entre planta e 3D: chaves "p3"
// (parede 3) e "a1" (área 1). Ferramentas: Selecionar, Parede, Contrapiso,
// Laje, Mover. Propriedades do que estiver selecionado no menu lateral.
function TpEditor({ projeto, nomeCliente, onAlterar, onVoltar }) {
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
    onAlterar({ ...projeto, paredes, areas, atualizadoEm: new Date().toISOString() });
  }, [paredes, areas]);

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
    if (novasAreas) setAreas(novasAreas);
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
  const moverSelecao = (dx, dy) => {
    if (!sel.length) return;
    const fp = new Set(selP), fa = new Set(selA), mv = (q) => ({ x: r3(q.x + dx), y: r3(q.y + dy) });
    mudar(paredes.map((w, i) => (fp.has(i) ? { ...w, a: mv(w.a), b: mv(w.b) } : w)), areas.map((a, i) => (fa.has(i) ? { ...a, pts: a.pts.map(mv) } : a)), true);
  };
  const trocarFerramenta = (f) => { setFerramenta(f); setInicio(null); setPoli([]); setDigitado(""); if (f !== "selecionar" && f !== "mover") { setSel([]); ultimaFerramenta.current = f; } };
  const finalizarPoli = () => {
    if (poli.length >= 3 && (ferramenta === "contrapiso" || ferramenta === "laje")) {
      const t = TP_AREA_TIPOS[ferramenta];
      mudar(null, [...areas, { tipo: ferramenta, pts: poli, esp: t.esp, cota: ferramenta === "laje" ? altM : 0 }]);
    }
    setPoli([]);
  };
  const finalizar = () => { if (poli.length) finalizarPoli(); setInicio(null); };
  // Botão direito (ou toque longo no celular): seleciona o que está embaixo,
  // se ainda não estiver selecionado, e abre o menu de ações no cursor.
  const abrirMenuCtx = (clientX, clientY, chave) => {
    if (chave && !sel.includes(chave)) { setSel([chave]); if (ferramenta !== "selecionar" && ferramenta !== "mover") trocarFerramenta("selecionar"); }
    const W = window.innerWidth, H = window.innerHeight;
    setMenuCtx({ x: Math.max(8, Math.min(clientX, W - 236)), y: Math.max(8, Math.min(clientY, H - 340)) });
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
  const baseTraco = () => (ferramenta === "parede" ? inicio : (poli.length ? poli[poli.length - 1] : null));
  const pontoDoCursor = (e) => {
    const v = vista.current, d = devPx(e), livre = paraMundoLivre(d), tol = 10 * (window.devicePixelRatio || 1) / v.s;
    let ima = null, menor = Infinity;
    for (const q of [...paredes.flatMap((w) => [w.a, w.b]), ...areas.flatMap((a) => a.pts || []), ...poli]) {
      const dd = Math.hypot(q.x - livre.x, q.y - livre.y); if (dd < tol && dd < menor) { menor = dd; ima = q; }
    }
    let p = ima ? { x: ima.x, y: ima.y } : { x: snap(livre.x), y: snap(livre.y) };
    const base = baseTraco();
    if (base && e.shiftKey) p = Math.abs(p.x - base.x) >= Math.abs(p.y - base.y) ? { x: p.x, y: base.y } : { x: base.x, y: p.y };
    return p;
  };
  // comprimento digitado + Enter: cria o trecho na direção do cursor
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

    // áreas: contrapiso (hachura) por baixo, laje (tracejado) por cima
    const ordem = areas.map((a, i) => i).sort((i, j) => (areas[i].tipo === "laje") - (areas[j].tipo === "laje"));
    for (const i of ordem) {
      const a = areas[i], marc = marcadas.has("a" + i);
      if (!a.pts || a.pts.length < 3) continue;
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
      ctx.fillText(`${TP_AREA_TIPOS[a.tipo].nome} ${tpFmt(tpAreaPoli(a.pts))} m²`, cx, cy + (a.tipo === "laje" ? 14 * dpr : 0));
    }

    // polígono em desenho
    if (poli.length) {
      const pts = hover ? [...poli, hover] : poli;
      ctx.beginPath(); pts.forEach((p, k) => { const [x, y] = T(p); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.strokeStyle = TP_AZUL; ctx.lineWidth = 2 * dpr; ctx.setLineDash([6 * dpr, 4 * dpr]); ctx.stroke(); ctx.setLineDash([]);
      if (pts.length >= 3) { caminho(pts); ctx.fillStyle = "rgba(4,116,244,0.08)"; ctx.fill(); }
      const [fx, fy] = T(poli[0]); ctx.strokeStyle = TP_AZUL; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.arc(fx, fy, 7 * dpr, 0, 7); ctx.stroke();
    }

    // paredes
    const todas = inicio && hover && (hover.x !== inicio.x || hover.y !== inicio.y)
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
      ctx.fillText(tpFmt(tpLen(w)) + " m", 0, -(w.t * v.s / 2 + 6 * dpr)); ctx.restore();
    });
    const ponto = (p, r) => { const [x, y] = T(p); ctx.fillStyle = TP_AZUL; ctx.beginPath(); ctx.arc(x, y, r * dpr, 0, 7); ctx.fill(); };
    if (hover && ferramenta !== "selecionar" && ferramenta !== "mover") ponto(hover, 3);
    if (inicio) ponto(inicio, 5);
    const quadradinho = (p) => { const [x, y] = T(p); ctx.fillStyle = "#fff"; ctx.strokeStyle = TP_AZUL; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.rect(x - 4 * dpr, y - 4 * dpr, 8 * dpr, 8 * dpr); ctx.fill(); ctx.stroke(); };
    for (const i of selP) { quadradinho(paredes[i].a); quadradinho(paredes[i].b); }
    for (const i of selA) areas[i].pts.forEach(quadradinho);

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
    const contorno = (g, mesh, cor) => { const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: cor })); e.position.copy(mesh.position); e.rotation.copy(mesh.rotation); T.group.add(e); };
    areas.forEach((a, i) => {
      if (!a.pts || a.pts.length < 3) return;
      const shape = new THREE.Shape(a.pts.map((p) => new THREE.Vector2(p.x - cx, -(p.y - cz))));
      const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, a.esp || 0.05), bevelEnabled: false });
      const marc = marcadas.has("a" + i);
      const mat = new THREE.MeshLambertMaterial({ color: marc ? 0x8dbbff : TP_AREA_TIPOS[a.tipo].cor3d, transparent: a.tipo === "laje" && !marc, opacity: a.tipo === "laje" && !marc ? 0.85 : 1 });
      const mesh = new THREE.Mesh(g, mat);
      mesh.rotation.x = -Math.PI / 2; mesh.position.y = a.cota || 0;
      mesh.userData.chave = "a" + i; T.group.add(mesh);
      contorno(g, mesh, marc ? 0x0474f4 : 0x6b7280);
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

  useEffect(() => { desenharPlanta(); }, [paredes, areas, inicio, poli, hover, espM, sel, caixa, ferramenta]);
  useEffect(() => { desenhar3d(); }, [paredes, areas, sel]);

  useEffect(() => {
    const k = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const ctrl = e.ctrlKey || e.metaKey, tecla = e.key;
      const desenhando = (ferramenta === "parede" && inicio) || ((ferramenta === "contrapiso" || ferramenta === "laje") && poli.length);
      // números durante o traço = comprimento do próximo trecho
      if (desenhando && !ctrl && /^[0-9.,]$/.test(tecla)) { e.preventDefault(); setDigitado((d) => (d + tecla).slice(0, 10)); return; }
      if (digitado && tecla === "Backspace") { e.preventDefault(); setDigitado((d) => d.slice(0, -1)); return; }
      if (tecla === "Escape") {
        // Esc em camadas, como no Revit: menu → número digitado → traço → seleção
        if (verAtalhos) { setVerAtalhos(false); return; }
        if (menuCtx) { setMenuCtx(null); return; }
        if (digitado) { setDigitado(""); return; }
        if (inicio || poli.length) { setInicio(null); setPoli([]); return; }
        setSel([]); setCaixa(null);
        if (ferramenta !== "selecionar") trocarFerramenta("selecionar");
        return;
      }
      if (tecla === "Enter") {
        if (digitado) aplicarDigitado();
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
        const f = { v: "selecionar", p: "parede", c: "contrapiso", l: "laje", h: "mover" }[t];
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
  const planDown = (e) => {
    const d = devPx(e);
    if (e.button === 1) { const agora = Date.now(); if (agora - meioClique.current < 350) { ajustar(); meioClique.current = 0; return; } meioClique.current = agora; }
    const g = { x: d.x, y: d.y, x0: d.x, y0: d.y, moveu: false, panear: e.button === 1 || e.button === 2 || ferramenta === "mover", direito: e.button === 2, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, menu: false };
    // toque longo (celular) = botão direito
    if (e.pointerType === "touch") {
      const cx = e.clientX, cy = e.clientY;
      g.timer = setTimeout(() => { if (gesto.current === g && !g.moveu) { g.menu = true; abrirMenuCtx(cx, cy, elementoNoPonto(d)); } }, 550);
    }
    gesto.current = g;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const planMove = (e) => {
    const g = gesto.current, d = devPx(e);
    if (g) {
      if (!g.moveu && Math.hypot(d.x - g.x0, d.y - g.y0) > 6 * (window.devicePixelRatio || 1)) { g.moveu = true; clearTimeout(g.timer); }
      if (g.menu) return;
      if (g.moveu) {
        if (g.panear || ferramenta !== "selecionar") {
          const v = vista.current; vista.current = { ...v, ox: v.ox + d.x - g.x, oy: v.oy + d.y - g.y }; g.x = d.x; g.y = d.y; desenharPlanta(); return;
        }
        setCaixa({ x0: g.x0, y0: g.y0, x1: d.x, y1: d.y }); return;
      }
    }
    if (ferramenta === "parede" || ferramenta === "contrapiso" || ferramenta === "laje") setHover(pontoDoCursor(e));
  };
  const planUp = (e) => {
    const g = gesto.current; gesto.current = null;
    if (!g) return;
    clearTimeout(g.timer);
    if (g.menu) return;
    if (g.direito && !g.moveu) { abrirMenuCtx(e.clientX, e.clientY, elementoNoPonto(devPx(e))); return; }
    if (g.moveu) {
      if (!g.panear && ferramenta === "selecionar" && caixa) {
        const a = paraMundoLivre({ x: caixa.x0, y: caixa.y0 }), b = paraMundoLivre({ x: caixa.x1, y: caixa.y1 });
        const r = { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
        const cruzando = caixa.x1 < caixa.x0;
        const dentro = (p) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;
        const achadas = [];
        paredes.forEach((w, i) => { if (cruzando ? segCruzaRet(w.a, w.b, r) : (dentro(w.a) && dentro(w.b))) achadas.push("p" + i); });
        areas.forEach((ar, i) => {
          const pts = ar.pts || []; if (pts.length < 3) return;
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
    const p = pontoDoCursor(e); setHover(p); setDigitado("");
    if (ferramenta === "parede") {
      if (!inicio) { setInicio(p); return; }
      if (p.x === inicio.x && p.y === inicio.y) return;
      mudar([...paredes, { a: inicio, b: p, t: espM, h: altM }]);
      setInicio(p);
      return;
    }
    if (ferramenta === "contrapiso" || ferramenta === "laje") {
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
    T.phi = Math.min(1.5, Math.max(0.15, T.phi - (e.clientY - g.y) * 0.01));
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
    { id: "mover", rotulo: "Mover", dica: "Mover a vista (H)" },
  ];
  const MODOS = [{ id: "planta", rotulo: "Planta" }, { id: "ambos", rotulo: "Planta + 3D" }, { id: "3d", rotulo: "3D" }];
  const mostraPlanta = modo !== "3d", mostra3d = modo !== "planta";

  const status = digitado ? `Comprimento: ${digitado} m — Enter confirma, Esc apaga.`
    : ferramenta === "selecionar"
    ? (sel.length ? `${sel.length} selecionado${sel.length === 1 ? "" : "s"}. Ctrl soma, Shift tira, setas movem, Delete exclui, Esc limpa.` : "Clique ou arraste uma área (esq.→dir.: inteiro dentro; dir.→esq.: o que tocar). Ctrl soma, Shift tira. Tecla ? mostra os atalhos.")
    : ferramenta === "mover" ? "Arraste para mover a vista."
    : ferramenta === "parede" ? (inicio ? "Clique para fechar o trecho ou digite o comprimento e Enter. Shift trava em 90°. Enter encerra." : "Clique para iniciar uma parede. Arraste para mover a vista.")
    : (poli.length ? `${poli.length} ponto${poli.length === 1 ? "" : "s"}. Clique no primeiro ponto (ou Enter) para fechar; Esc cancela.` : `Clique nos cantos do ${ferramenta === "laje" ? "laje" : "contrapiso"} e feche no primeiro ponto.`).replace("do laje", "da laje");

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
        {selA.length > 0 && !selP.length && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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

      <button style={{ ...btn, marginTop: 8, fontSize: 12.5 }} onClick={() => setVerAtalhos(true)}>Atalhos de teclado e mouse <span style={{ color: "#9ca3af" }}>(?)</span></button>

      <div style={secao}>Quantitativo</div>
      <div>
        <div style={linhaQ}><span>Paredes</span><span style={numQ}>{paredes.length} · {tpFmt(L)} m</span></div>
        <div style={linhaQ}><span>Área de parede</span><span style={numQ}>{tpFmt(A)} m²</span></div>
        <div style={linhaQ}><span>Reboco 2 faces</span><span style={numQ}>{tpFmt(A * 2)} m²</span></div>
        <div style={linhaQ}><span>Contrapiso</span><span style={numQ}>{tpFmt(areaCp)} m² · {tpFmt(volCp)} m³</span></div>
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
      {poli.length >= 3 && (
        <button onClick={finalizarPoli} style={{ ...btn, minHeight: 32, padding: "4px 10px", fontSize: 12.5, background: TP_AZUL, borderColor: TP_AZUL, color: "#fff", pointerEvents: "auto" }}>Fechar {ferramenta === "laje" ? "laje" : "contrapiso"}</button>
      )}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", background: "#e5e7eb", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
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
              onPointerDown={planDown} onPointerMove={planMove} onPointerUp={planUp} onPointerLeave={() => { if (!inicio && !poli.length && !gesto.current) setHover(null); }} />
            {barraFerramentas}
            {digitado && (
              <div style={{ position: "absolute", left: "50%", top: 74, transform: "translateX(-50%)", zIndex: 1, background: "#111827", color: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
                {digitado} m <span style={{ fontWeight: 400, opacity: 0.7, fontSize: 12, marginLeft: 6 }}>Enter</span>
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
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, width: "100%", border: "none", background: "transparent", padding: "8px 12px", borderRadius: 6, fontSize: 13.5, fontFamily: "inherit", textAlign: "left",
              cursor: opts.desativado ? "default" : "pointer", color: opts.desativado ? "#9ca3af" : (opts.perigo ? "#b91c1c" : "#111827"), fontWeight: opts.perigo ? 600 : 500 }}
            onMouseEnter={(e) => { if (!opts.desativado) e.currentTarget.style.background = opts.perigo ? "#fef2f2" : "#f3f4f6"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
            <span>{rotulo}</span>{atalho && <span style={{ fontSize: 11.5, color: "#9ca3af" }}>{atalho}</span>}
          </button>
        );
        const linha = (k) => <div key={k} style={{ height: 1, background: "#eef0f3", margin: "4px 6px" }} />;
        return (
          <>
            <div onPointerDown={() => setMenuCtx(null)} onContextMenu={(e) => { e.preventDefault(); setMenuCtx(null); }} style={{ position: "fixed", inset: 0, zIndex: 9 }} />
            <div role="menu" style={{ position: "fixed", left: menuCtx.x, top: menuCtx.y, zIndex: 10, width: 228, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.18)", padding: 4 }}>
              {desenhando && item("Finalizar traço", "Enter", finalizar)}
              {desenhando && linha("l0")}
              {sel.length > 0 && item(`Excluir${sel.length > 1 ? ` (${sel.length})` : ""}`, "Delete", excluirSelecao, { perigo: true })}
              {sel.length > 0 && item("Editar propriedades", null, editarPropriedades, { desativado: selP.length > 0 && selA.length > 0 })}
              {sel.length > 0 && item("Limpar seleção", "Esc", () => setSel([]))}
              {sel.length > 0 && linha("l1")}
              {item("Desfazer", "Ctrl+Z", desfazer, { desativado: !historico.current.length })}
              {item("Refazer", "Ctrl+Y", refazer, { desativado: !futuro.current.length })}
              {item("Selecionar tudo", "Ctrl+A", () => { trocarFerramenta("selecionar"); setSel([...paredes.map((_, i) => "p" + i), ...areas.map((_, i) => "a" + i)]); }, { desativado: !paredes.length && !areas.length })}
              {linha("l2")}
              {item("Desenhar parede", "P", () => trocarFerramenta("parede"))}
              {item("Inserir contrapiso", "C", () => trocarFerramenta("contrapiso"))}
              {item("Inserir laje", "L", () => trocarFerramenta("laje"))}
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
function tpChave(empresaId) { return "vicke-teste-projetos-" + (empresaId || "x"); }
function tpLer(empresaId) {
  try { const v = JSON.parse(localStorage.getItem(tpChave(empresaId)) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function tpGravar(empresaId, lista) {
  try { localStorage.setItem(tpChave(empresaId), JSON.stringify(lista)); } catch {}
}

function TesteProjeto({ data, usuario }) {
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
      <TpEditor key={aberto.id} projeto={aberto} nomeCliente={nomeCliente(aberto.clienteId)}
        onAlterar={(p) => salvarLista(tpLer(empresaId).map((x) => (x.id === p.id ? p : x)))}
        onVoltar={() => { setProjetos(tpLer(empresaId)); setAbertoId(null); }} />
    );
  }

  const criar = () => {
    const nome = String(novo.nome || "").trim();
    if (!nome || !novo.clienteId) return;
    const agora = new Date().toISOString();
    const p = { id: "tp_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), nome, clienteId: novo.clienteId, paredes: [], criadoEm: agora, atualizadoEm: agora };
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
          <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>Teste Projeto</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>Projetos desenhados no VICKE. Fase de teste.</div>
        </div>
        <button style={btnAzul} onClick={() => setNovo({ nome: "", clienteId: "" })}>+ Novo projeto</button>
      </div>

      {projetos.length > 0 && (
        <input style={inp} placeholder="Buscar por projeto ou cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
      )}

      {projetos.length === 0 ? (
        <div style={{ background: "#fff", border: "1px dashed #d1d5db", borderRadius: 12, padding: "36px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>Nenhum projeto ainda</div>
          <div style={{ fontSize: 13, color: "#6b7280", margin: "6px 0 14px" }}>Crie um projeto, escolha o cliente e comece a traçar as paredes.</div>
          <button style={btnAzul} onClick={() => setNovo({ nome: "", clienteId: "" })}>+ Novo projeto</button>
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
// da tela Teste Projeto (localStorage por empresa) — um projeto criado
// lá aparece aqui e vice-versa. Só aparece para a empresa piloto.
// ───────────────────────────────────────────────────────────────
const TP_EMPRESA_PILOTO = "emp_padovan-arquitetos_moebj62t";
function tpEmpresaAtual() {
  try { return (JSON.parse(localStorage.getItem("vicke-user") || "{}") || {}).empresa_id || ""; } catch { return ""; }
}

function TpProjetosDoCliente({ cliente }) {
  const empresaId = tpEmpresaAtual();
  const [todos, setTodos] = useState(() => tpLer(empresaId));
  const [abertoId, setAbertoId] = useState(null);
  const [novoNome, setNovoNome] = useState(null);  // string enquanto a janela está aberta
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
      <TpEditor key={aberto.id} projeto={aberto} nomeCliente={cliente.nome}
        onAlterar={(p) => salvarLista(tpLer(empresaId).map((x) => (x.id === p.id ? p : x)))}
        onVoltar={() => { setTodos(tpLer(empresaId)); setAbertoId(null); }} />
    );
  }

  const criar = () => {
    const nome = String(novoNome || "").trim(); if (!nome) return;
    const agora = new Date().toISOString();
    const p = { id: "tp_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), nome, clienteId: cliente.id, paredes: [], criadoEm: agora, atualizadoEm: agora };
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
