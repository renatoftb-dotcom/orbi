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

// Editor em tela cheia: o menu lateral vira o menu do projeto (voltar ao
// menu principal, visualização, parede, quantitativo). A planta tem zoom
// (roda do mouse ou botões) e arraste para mover; clique sem arrastar
// marca ponto. Visualização: só planta, planta + 3D lado a lado, só 3D.
function TpEditor({ projeto, nomeCliente, onAlterar, onVoltar }) {
  const planRef = useRef(null), v3dRef = useRef(null);
  const planBox = useRef(null), v3dBox = useRef(null);
  const [paredes, setParedes] = useState(() => (Array.isArray(projeto.paredes) ? projeto.paredes : []));
  const [inicio, setInicio] = useState(null);
  const [hover, setHover] = useState(null);
  const [esp, setEsp] = useState("14");
  const [alt, setAlt] = useState("2,80");
  const [modo, setModo] = useState("ambos"); // planta | ambos | 3d
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  const [menuAberto, setMenuAberto] = useState(false);
  const [confirmarLimpar, setConfirmarLimpar] = useState(false);
  const [ferramenta, setFerramenta] = useState(() => (Array.isArray(projeto.paredes) && projeto.paredes.length ? "selecionar" : "parede")); // selecionar | parede | mover
  const [sel, setSel] = useState([]);      // índices das paredes selecionadas
  const [caixa, setCaixa] = useState(null); // retângulo de seleção em px do canvas { x0, y0, x1, y1 }
  const historico = useRef([]);            // estados anteriores, para Desfazer
  const [erro3d, setErro3d] = useState("");
  const [, forcar] = useState(0);
  const three = useRef(null);
  const vista = useRef(null); // { s: px por metro (device px), ox, oy }
  const primeiraVez = useRef(true);

  const espM = Math.max(0.05, (parseFloat(String(esp).replace(",", ".")) || 14) / 100);
  const altM = Math.max(1, parseFloat(String(alt).replace(",", ".")) || 2.8);

  // Toda alteração feita pelo usuário passa por aqui: guarda o estado anterior
  // para o Desfazer e limpa a seleção (os índices mudam).
  const mudar = (novas) => {
    historico.current.push(paredes);
    if (historico.current.length > 200) historico.current.shift();
    setParedes(novas); setSel([]);
  };
  const excluirSelecao = () => {
    if (!sel.length) return;
    const fora = new Set(sel);
    mudar(paredes.filter((_, i) => !fora.has(i)));
  };

  useEffect(() => {
    if (primeiraVez.current) { primeiraVez.current = false; return; }
    onAlterar({ ...projeto, paredes, atualizadoEm: new Date().toISOString() });
  }, [paredes]);

  // trava a rolagem da página enquanto o editor ocupa a tela
  useEffect(() => {
    const antes = document.body.style.overflow; document.body.style.overflow = "hidden";
    const r = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", r);
    return () => { document.body.style.overflow = antes; window.removeEventListener("resize", r); };
  }, []);

  // ---------- vista da planta ----------
  const limites = (ws) => {
    if (!ws.length) return { x0: 0, y0: 0, x1: 12, y1: 9 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const w of ws) for (const p of [w.a, w.b]) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    return { x0, y0, x1: Math.max(x1, x0 + 1), y1: Math.max(y1, y0 + 1) };
  };
  const ajustar = () => {
    const c = planRef.current; if (!c || !c.width) return;
    const b = limites(paredes), m = 1.5;
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

  const desenharPlanta = () => {
    const c = planRef.current, v = vista.current; if (!c || !v || !c.width) return;
    const ctx = c.getContext("2d"), W = c.width, H = c.height, dpr = window.devicePixelRatio || 1;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    const passo = v.s * TP_GRADE < 8 * dpr ? 1 : TP_GRADE;
    const xA = Math.floor(-v.ox / v.s), xB = Math.ceil((W - v.ox) / v.s), yA = Math.floor(-v.oy / v.s), yB = Math.ceil((H - v.oy) / v.s);
    ctx.lineWidth = 1;
    for (let x = xA; x <= xB; x += passo) { const sx = Math.round(x * v.s + v.ox) + 0.5; ctx.strokeStyle = Math.abs(x % 5) < 1e-6 ? "#cfd5dc" : (Math.abs(x % 1) < 1e-6 ? "#e3e7ec" : "#f1f3f6"); ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke(); }
    for (let y = yA; y <= yB; y += passo) { const sy = Math.round(y * v.s + v.oy) + 0.5; ctx.strokeStyle = Math.abs(y % 5) < 1e-6 ? "#cfd5dc" : (Math.abs(y % 1) < 1e-6 ? "#e3e7ec" : "#f1f3f6"); ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke(); }
    const T = (p) => [p.x * v.s + v.ox, p.y * v.s + v.oy];
    const todas = inicio && hover && (hover.x !== inicio.x || hover.y !== inicio.y)
      ? [...paredes, { a: inicio, b: hover, t: espM, fantasma: true }] : paredes;
    ctx.lineCap = "square";
    const marcadas = new Set(sel);
    todas.forEach((w, i) => {
      if (!marcadas.has(i)) return;
      const [ax, ay] = T(w.a), [bx, by] = T(w.b);
      ctx.strokeStyle = "rgba(4,116,244,0.25)"; ctx.lineWidth = Math.max(2, w.t * v.s) + 10 * dpr;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    });
    for (const [i, w] of todas.entries()) {
      const [ax, ay] = T(w.a), [bx, by] = T(w.b);
      ctx.strokeStyle = w.fantasma || marcadas.has(i) ? TP_AZUL : "#374151"; ctx.globalAlpha = w.fantasma ? 0.6 : 1;
      ctx.lineWidth = Math.max(2, w.t * v.s);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.globalAlpha = 1;
      let ang = Math.atan2(by - ay, bx - ax); if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
      ctx.save(); ctx.translate((ax + bx) / 2, (ay + by) / 2); ctx.rotate(ang);
      ctx.font = `600 ${12 * dpr}px system-ui, sans-serif`; ctx.textAlign = "center";
      ctx.fillStyle = w.fantasma ? TP_AZUL : "#6b7280";
      ctx.fillText(tpFmt(tpLen(w)) + " m", 0, -(w.t * v.s / 2 + 6 * dpr)); ctx.restore();
    }
    const ponto = (p, r) => { const [x, y] = T(p); ctx.fillStyle = TP_AZUL; ctx.beginPath(); ctx.arc(x, y, r * dpr, 0, 7); ctx.fill(); };
    if (hover && ferramenta === "parede") ponto(hover, 3);
    if (inicio) ponto(inicio, 5);
    // extremidades das selecionadas
    for (const i of sel) { const w = paredes[i]; if (!w) continue; for (const p of [w.a, w.b]) { const [x, y] = T(p); ctx.fillStyle = "#fff"; ctx.strokeStyle = TP_AZUL; ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.rect(x - 4 * dpr, y - 4 * dpr, 8 * dpr, 8 * dpr); ctx.fill(); ctx.stroke(); } }
    // retângulo de seleção: da esquerda para a direita pega só o que está
    // inteiro dentro (azul, contínuo); da direita para a esquerda pega tudo
    // que a área toca (verde, tracejado) — mesma convenção do AutoCAD/Revit.
    if (caixa) {
      const cruzando = caixa.x1 < caixa.x0;
      const x = Math.min(caixa.x0, caixa.x1), y = Math.min(caixa.y0, caixa.y1), w = Math.abs(caixa.x1 - caixa.x0), h = Math.abs(caixa.y1 - caixa.y0);
      ctx.fillStyle = cruzando ? "rgba(22,163,74,0.08)" : "rgba(4,116,244,0.08)"; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = cruzando ? "#16a34a" : TP_AZUL; ctx.lineWidth = 1.5 * dpr; ctx.setLineDash(cruzando ? [6 * dpr, 4 * dpr] : []);
      ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
    }
    // escala gráfica
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
    const b = limites(paredes), cx = (b.x0 + b.x1) / 2, cz = (b.y0 + b.y1) / 2;
    const tam = Math.max(12, Math.ceil(Math.max(b.x1 - b.x0, b.y1 - b.y0) + 6));
    T.group.add(new THREE.GridHelper(tam, tam, 0xd1d5db, 0xeef0f3));
    for (const w of paredes) {
      const L = tpLen(w); if (!L) continue;
      const g = new THREE.BoxGeometry(L + w.t, w.h, w.t);
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xe5e1d8 }));
      m.position.set((w.a.x + w.b.x) / 2 - cx, w.h / 2, (w.a.y + w.b.y) / 2 - cz);
      m.rotation.y = -Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x);
      T.group.add(m);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0x4b5563 }));
      e.position.copy(m.position); e.rotation.copy(m.rotation); T.group.add(e);
    }
    T.camera.aspect = c.width / c.height; T.camera.updateProjectionMatrix();
    T.camera.position.set(T.dist * Math.sin(T.phi) * Math.cos(T.theta), T.dist * Math.cos(T.phi), T.dist * Math.sin(T.phi) * Math.sin(T.theta));
    T.camera.lookAt(0, 1, 0);
    T.renderer.render(T.scene, T.camera);
  };

  // dimensiona cada canvas pelo seu quadro (muda com a visualização e a janela).
  // O observador vive o tempo todo, então chama sempre as funções do render atual.
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
      const b = limites(paredes);
      three.current = { renderer, scene, camera, group, theta: -0.7, phi: 0.9, dist: Math.max(14, Math.max(b.x1 - b.x0, b.y1 - b.y0) * 1.6) };
      desenhar3d();
    }).catch((e) => vivo && setErro3d(e.message));
    return () => { vivo = false; if (three.current) { three.current.renderer.dispose(); three.current = null; } };
  }, []);

  useEffect(() => { desenharPlanta(); }, [paredes, inicio, hover, espM, sel, caixa, ferramenta]);
  useEffect(() => { desenhar3d(); }, [paredes]);
  useEffect(() => {
    const k = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape") { setInicio(null); setSel([]); setCaixa(null); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) { e.preventDefault(); desfazer(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) { e.preventDefault(); setFerramenta("selecionar"); setInicio(null); setSel(paredes.map((_, i) => i)); }
      else if (e.key === "Delete" || e.key === "Backspace") { if (sel.length) { e.preventDefault(); excluirSelecao(); } }
      else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const t = e.key.toLowerCase();
        if (t === "v") { setFerramenta("selecionar"); setInicio(null); }
        else if (t === "p") { setFerramenta("parede"); setSel([]); }
        else if (t === "h") { setFerramenta("mover"); setInicio(null); }
      }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  // roda do mouse: zoom na planta (no cursor) e no 3D
  useEffect(() => {
    const p = planRef.current, t = v3dRef.current;
    const wp = (e) => { e.preventDefault(); const d = devPx(e); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, d.x, d.y); };
    const wt = (e) => { const T = three.current; if (!T) return; e.preventDefault(); T.dist = Math.min(150, Math.max(4, T.dist * (e.deltaY < 0 ? 0.9 : 1.1))); desenhar3d(); };
    p && p.addEventListener("wheel", wp, { passive: false }); t && t.addEventListener("wheel", wt, { passive: false });
    return () => { p && p.removeEventListener("wheel", wp); t && t.removeEventListener("wheel", wt); };
  });

  // planta — depende da ferramenta:
  //  Parede:     clique marca ponto; arrastar move a vista.
  //  Selecionar: clique numa parede seleciona (Shift soma); arrastar desenha
  //              o retângulo de seleção; clique no vazio limpa.
  //  Mover:      arrastar move a vista (útil no celular).
  //  Botão do meio ou direito do mouse sempre move a vista.
  const gesto = useRef(null);
  const paraMundoLivre = (d) => { const v = vista.current; return { x: (d.x - v.ox) / v.s, y: (d.y - v.oy) / v.s }; };
  const distSeg = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  };
  const paredeNoPonto = (d) => {
    const v = vista.current, p = paraMundoLivre(d), tol = 7 * (window.devicePixelRatio || 1) / v.s;
    let melhor = -1, menor = Infinity;
    paredes.forEach((w, i) => { const dd = distSeg(p, w.a, w.b); if (dd <= Math.max(w.t / 2, tol) && dd < menor) { menor = dd; melhor = i; } });
    return melhor;
  };
  const segCruzaRet = (a, b, r) => {
    const dentro = (p) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;
    if (dentro(a) || dentro(b)) return true;
    const cr = (p1, p2, p3, p4) => {
      const d = (p, q, s2) => (q.x - p.x) * (s2.y - p.y) - (q.y - p.y) * (s2.x - p.x);
      const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
      return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
    };
    const c = [{ x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x1, y: r.y1 }, { x: r.x0, y: r.y1 }];
    for (let k = 0; k < 4; k++) if (cr(a, b, c[k], c[(k + 1) % 4])) return true;
    return false;
  };
  const planDown = (e) => {
    const d = devPx(e);
    const panear = e.button === 1 || e.button === 2 || ferramenta === "mover";
    gesto.current = { x: d.x, y: d.y, x0: d.x, y0: d.y, moveu: false, panear, shift: e.shiftKey };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const planMove = (e) => {
    const g = gesto.current, d = devPx(e);
    if (g) {
      const dpr = window.devicePixelRatio || 1;
      if (!g.moveu && Math.hypot(d.x - g.x0, d.y - g.y0) > 6 * dpr) g.moveu = true;
      if (g.moveu) {
        if (g.panear || ferramenta === "parede") {
          const v = vista.current; vista.current = { ...v, ox: v.ox + d.x - g.x, oy: v.oy + d.y - g.y }; g.x = d.x; g.y = d.y; desenharPlanta(); return;
        }
        setCaixa({ x0: g.x0, y0: g.y0, x1: d.x, y1: d.y }); return;
      }
    }
    if (ferramenta === "parede") setHover(paraMundo(e));
  };
  const planUp = (e) => {
    const g = gesto.current; gesto.current = null;
    if (!g) return;
    if (g.moveu) {
      if (!g.panear && ferramenta === "selecionar" && caixa) {
        const a = paraMundoLivre({ x: caixa.x0, y: caixa.y0 }), b = paraMundoLivre({ x: caixa.x1, y: caixa.y1 });
        const r = { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
        const cruzando = caixa.x1 < caixa.x0;
        const dentro = (p) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;
        const achadas = [];
        paredes.forEach((w, i) => { if (cruzando ? segCruzaRet(w.a, w.b, r) : (dentro(w.a) && dentro(w.b))) achadas.push(i); });
        setSel(g.shift ? Array.from(new Set([...sel, ...achadas])) : achadas);
      }
      setCaixa(null); return;
    }
    if (g.panear) return;
    if (ferramenta === "selecionar") {
      const i = paredeNoPonto(devPx(e));
      if (i < 0) { if (!g.shift) setSel([]); return; }
      if (g.shift) setSel(sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i]);
      else setSel([i]);
      return;
    }
    if (ferramenta !== "parede") return;
    const p = paraMundo(e); setHover(p);
    if (!inicio) { setInicio(p); return; }
    if (p.x === inicio.x && p.y === inicio.y) return;
    mudar([...paredes, { a: inicio, b: p, t: espM, h: altM }]);
    setInicio(p);
  };

  // 3D: arrastar gira
  const drag = useRef(null);
  const v3dDown = (e) => { drag.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); };
  const v3dMove = (e) => {
    const T = three.current; if (!drag.current || !T) return;
    T.theta -= (e.clientX - drag.current.x) * 0.01;
    T.phi = Math.min(1.5, Math.max(0.15, T.phi - (e.clientY - drag.current.y) * 0.01));
    drag.current = { x: e.clientX, y: e.clientY }; desenhar3d();
  };

  function desfazer() {
    const anterior = historico.current.pop();
    if (!anterior) return;
    // desfazendo o último trecho de um traço em andamento, o traço continua
    // do início desse trecho
    const removida = paredes.length === anterior.length + 1 ? paredes[paredes.length - 1] : null;
    if (inicio && removida && removida.b.x === inicio.x && removida.b.y === inicio.y) setInicio(removida.a);
    else setInicio(null);
    setParedes(anterior); setSel([]);
  }

  const L = paredes.reduce((s, w) => s + tpLen(w), 0);
  const A = paredes.reduce((s, w) => s + tpLen(w) * w.h, 0);
  const blocos = Math.ceil(A * 12.5 * 1.05);

  // ---------- estilos ----------
  const btn = { padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#111827", fontSize: 13.5, fontWeight: 500, cursor: "pointer", minHeight: 36, fontFamily: "inherit" };
  const secao = { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af", margin: "18px 0 8px" };
  const lbl = { fontSize: 12, color: "#4b5563", marginBottom: 4 };
  const inp = { width: "100%", boxSizing: "border-box", padding: "7px 8px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, fontVariantNumeric: "tabular-nums", fontFamily: "inherit" };
  const linhaQ = { display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid #f0f2f5", fontSize: 13 };
  const numQ = { fontWeight: 600, color: "#111827", fontVariantNumeric: "tabular-nums" };
  const pane = { position: "relative", background: "#fff", minWidth: 0, minHeight: 0, overflow: "hidden" };
  const tag = { position: "absolute", top: 10, left: 12, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9ca3af", pointerEvents: "none", zIndex: 1 };
  const ctrl = { width: 34, height: 34, borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 16, fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" };

  const mostraPlanta = modo !== "3d", mostra3d = modo !== "planta";
  const FERRAMENTAS = [
    { id: "selecionar", rotulo: "Selecionar", dica: "Selecionar (V) — clique ou arraste uma área" },
    { id: "parede", rotulo: "Parede", dica: "Parede (P) — clique ponto a ponto" },
    { id: "mover", rotulo: "Mover", dica: "Mover a vista (H)" },
  ];
  const MODOS = [{ id: "planta", rotulo: "Planta" }, { id: "ambos", rotulo: "Planta + 3D" }, { id: "3d", rotulo: "3D" }];

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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {FERRAMENTAS.map((f) => (
          <button key={f.id} title={f.dica} onClick={() => { setFerramenta(f.id); if (f.id !== "parede") setInicio(null); if (f.id === "parede") setSel([]); if (isMobile) setMenuAberto(false); }}
            style={{ ...btn, padding: "8px 4px", fontSize: 12.5, borderColor: ferramenta === f.id ? TP_AZUL : "#e5e7eb", background: ferramenta === f.id ? "#eef5ff" : "#fff", color: ferramenta === f.id ? TP_AZUL : "#111827", fontWeight: ferramenta === f.id ? 600 : 500 }}>
            {f.rotulo}
          </button>
        ))}
      </div>
      {sel.length > 0 && (
        <div style={{ marginTop: 10, background: "#eef5ff", border: "1px solid #cfe2ff", borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 12.5, color: "#1e3a8a", fontWeight: 600 }}>{sel.length} parede{sel.length === 1 ? "" : "s"} selecionada{sel.length === 1 ? "" : "s"}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button style={{ ...btn, flex: 1, minHeight: 32, padding: "4px 8px", fontSize: 12.5, background: "#b91c1c", borderColor: "#b91c1c", color: "#fff" }} onClick={excluirSelecao}>Excluir</button>
            <button style={{ ...btn, flex: 1, minHeight: 32, padding: "4px 8px", fontSize: 12.5 }} onClick={() => setSel([])}>Limpar seleção</button>
          </div>
        </div>
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

      <div style={secao}>Parede</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div><div style={lbl}>Espessura (cm)</div><input id="tp-esp" style={inp} inputMode="decimal" value={esp} onChange={(e) => setEsp(e.target.value)} /></div>
        <div><div style={lbl}>Altura (m)</div><input id="tp-alt" style={inp} inputMode="decimal" value={alt} onChange={(e) => setAlt(e.target.value)} /></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
        <button style={{ ...btn, background: TP_AZUL, borderColor: TP_AZUL, color: "#fff" }} onClick={() => setInicio(null)}>Finalizar traço</button>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <button style={btn} onClick={desfazer}>Desfazer</button>
          <button style={btn} onClick={() => setConfirmarLimpar(true)}>Limpar</button>
        </div>
        {confirmarLimpar && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10, fontSize: 12.5, color: "#7f1d1d" }}>
            Apagar todas as paredes deste projeto?
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button style={{ ...btn, minHeight: 30, padding: "4px 10px", fontSize: 12.5 }} onClick={() => setConfirmarLimpar(false)}>Cancelar</button>
              <button style={{ ...btn, minHeight: 30, padding: "4px 10px", fontSize: 12.5, background: "#b91c1c", borderColor: "#b91c1c", color: "#fff" }} onClick={() => { mudar([]); setInicio(null); setConfirmarLimpar(false); }}>Apagar</button>
            </div>
          </div>
        )}
      </div>

      <div style={secao}>Quantitativo</div>
      <div>
        <div style={linhaQ}><span>Paredes</span><span style={numQ}>{paredes.length}</span></div>
        <div style={linhaQ}><span>Comprimento</span><span style={numQ}>{tpFmt(L)} m</span></div>
        <div style={linhaQ}><span>Área de parede</span><span style={numQ}>{tpFmt(A)} m²</span></div>
        <div style={linhaQ}><span>Blocos 14×19×39</span><span style={numQ}>{blocos.toLocaleString("pt-BR")} un</span></div>
        <div style={linhaQ}><span>Reboco 2 faces</span><span style={numQ}>{tpFmt(A * 2)} m²</span></div>
      </div>
      <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 10, lineHeight: 1.4 }}>Teste: salvo só neste navegador. Blocos a 12,5 un/m² + 5%, sem descontar aberturas.</div>
    </aside>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", background: "#e5e7eb", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      {menu}
      {isMobile && menuAberto && <div onClick={() => setMenuAberto(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 2 }} />}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderBottom: "1px solid #e5e7eb",
          paddingTop: isMobile ? "max(8px, env(safe-area-inset-top, 0px))" : 8, paddingBottom: 8, paddingLeft: isMobile ? "max(12px, env(safe-area-inset-left, 0px))" : 14, paddingRight: "max(12px, env(safe-area-inset-right, 0px))" }}>
          {isMobile && <button aria-label="Abrir menu do projeto" onClick={() => setMenuAberto(true)} style={{ ...ctrl, fontSize: 18 }}>☰</button>}
          <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isMobile ? "nowrap" : "normal" }}>
            {isMobile && <strong style={{ color: "#111827", marginRight: 6 }}>{projeto.nome}</strong>}
            {ferramenta === "selecionar"
              ? (sel.length ? `${sel.length} selecionada${sel.length === 1 ? "" : "s"}. Delete exclui, Esc limpa.` : "Clique numa parede ou arraste uma área: da esquerda para a direita pega o que está inteiro dentro; da direita para a esquerda, o que a área tocar.")
              : ferramenta === "mover" ? "Arraste para mover a vista."
              : inicio ? "Clique para fechar o trecho. Esc ou “Finalizar traço” encerra." : "Clique na planta para iniciar uma parede. Arraste para mover a vista."}
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
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={planDown} onPointerMove={planMove} onPointerUp={planUp} onPointerLeave={() => { if (!inicio && !gesto.current) setHover(null); }} />
            <div style={{ position: "absolute", left: 12, top: 34, display: "flex", gap: 4, zIndex: 1, background: "rgba(255,255,255,0.92)", borderRadius: 10, padding: 3, border: "1px solid #e5e7eb" }}>
              {FERRAMENTAS.map((f) => (
                <button key={f.id} title={f.dica} onClick={() => { setFerramenta(f.id); if (f.id !== "parede") setInicio(null); if (f.id === "parede") setSel([]); }}
                  style={{ border: "none", borderRadius: 7, padding: "6px 10px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", background: ferramenta === f.id ? TP_AZUL : "transparent", color: ferramenta === f.id ? "#fff" : "#374151", fontWeight: 600 }}>
                  {f.rotulo}
                </button>
              ))}
            </div>
            {sel.length > 0 && (
              <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 14, display: "flex", gap: 6, zIndex: 1, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 6, boxShadow: "0 4px 14px rgba(0,0,0,0.12)", alignItems: "center", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 12.5, color: "#374151", padding: "0 6px", fontWeight: 600 }}>{sel.length} selecionada{sel.length === 1 ? "" : "s"}</span>
                <button onClick={excluirSelecao} style={{ ...btn, minHeight: 30, padding: "4px 10px", fontSize: 12.5, background: "#b91c1c", borderColor: "#b91c1c", color: "#fff" }}>Excluir</button>
                <button onClick={() => setSel([])} aria-label="Limpar seleção" style={{ ...btn, minHeight: 30, padding: "4px 10px", fontSize: 12.5 }}>✕</button>
              </div>
            )}
            <div style={{ position: "absolute", right: 12, bottom: 12, display: "flex", flexDirection: "column", gap: 6, zIndex: 1 }}>
              <button aria-label="Aproximar" style={ctrl} onClick={() => zoom(1.25)}>+</button>
              <button aria-label="Afastar" style={ctrl} onClick={() => zoom(1 / 1.25)}>−</button>
              <button aria-label="Ajustar à tela" title="Ajustar à tela" style={{ ...ctrl, fontSize: 13 }} onClick={ajustar}>⤢</button>
            </div>
          </div>
          <div ref={v3dBox} style={{ ...pane, display: mostra3d ? "block" : "none" }}>
            <span style={tag}>3D · arraste para girar</span>
            <canvas ref={v3dRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none" }}
              onPointerDown={v3dDown} onPointerMove={v3dMove} onPointerUp={() => (drag.current = null)} />
            {erro3d && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", fontSize: 13, padding: 16, textAlign: "center" }}>{erro3d} Verifique a conexão e abra o projeto de novo.</div>}
          </div>
        </div>
      </main>
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
