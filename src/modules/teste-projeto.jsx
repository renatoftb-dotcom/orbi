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

function TesteProjeto() {
  const planRef = useRef(null), v3dRef = useRef(null);
  const [paredes, setParedes] = useState([
    { a: { x: 2, y: 2 }, b: { x: 8, y: 2 }, t: 0.14, h: 2.8 },
    { a: { x: 8, y: 2 }, b: { x: 8, y: 6.5 }, t: 0.14, h: 2.8 },
    { a: { x: 8, y: 6.5 }, b: { x: 2, y: 6.5 }, t: 0.14, h: 2.8 },
  ]);
  const [inicio, setInicio] = useState(null);
  const [hover, setHover] = useState(null);
  const [esp, setEsp] = useState("14");
  const [alt, setAlt] = useState("2,80");
  const [erro3d, setErro3d] = useState("");
  const three = useRef(null); // { renderer, scene, camera, group, theta, phi, dist }

  const espM = Math.max(0.05, (parseFloat(String(esp).replace(",", ".")) || 14) / 100);
  const altM = Math.max(1, parseFloat(String(alt).replace(",", ".")) || 2.8);

  // ---------- planta ----------
  const escala = () => planRef.current.width / TP_MUNDO;
  const snap = (v) => Math.round(v / TP_GRADE) * TP_GRADE;
  const paraMundo = (e) => {
    const c = planRef.current, r = c.getBoundingClientRect(), s = escala(), k = c.width / r.width;
    return { x: snap((e.clientX - r.left) * k / s), y: snap((e.clientY - r.top) * k / s) };
  };

  const desenharPlanta = () => {
    const c = planRef.current; if (!c) return;
    const ctx = c.getContext("2d"), s = escala(), W = c.width, H = c.height, dpr = window.devicePixelRatio || 1;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    for (let x = 0; x <= TP_MUNDO + 1e-6; x += TP_GRADE) { ctx.strokeStyle = x % 1 === 0 ? "#dfe3e8" : "#f0f2f5"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x * s, 0); ctx.lineTo(x * s, H); ctx.stroke(); }
    for (let y = 0; y <= H / s + 1e-6; y += TP_GRADE) { ctx.strokeStyle = y % 1 === 0 ? "#dfe3e8" : "#f0f2f5"; ctx.beginPath(); ctx.moveTo(0, y * s); ctx.lineTo(W, y * s); ctx.stroke(); }
    const todas = inicio && hover && (hover.x !== inicio.x || hover.y !== inicio.y)
      ? [...paredes, { a: inicio, b: hover, t: espM, fantasma: true }] : paredes;
    ctx.lineCap = "square";
    for (const w of todas) {
      ctx.strokeStyle = w.fantasma ? TP_AZUL : "#374151";
      ctx.globalAlpha = w.fantasma ? 0.6 : 1;
      ctx.lineWidth = Math.max(2, w.t * s);
      ctx.beginPath(); ctx.moveTo(w.a.x * s, w.a.y * s); ctx.lineTo(w.b.x * s, w.b.y * s); ctx.stroke();
      ctx.globalAlpha = 1;
      const mx = (w.a.x + w.b.x) / 2 * s, my = (w.a.y + w.b.y) / 2 * s;
      let ang = Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x); if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
      ctx.save(); ctx.translate(mx, my); ctx.rotate(ang);
      ctx.font = `600 ${12 * dpr}px system-ui, sans-serif`; ctx.textAlign = "center";
      ctx.fillStyle = w.fantasma ? TP_AZUL : "#6b7280";
      ctx.fillText(tpFmt(tpLen(w)) + " m", 0, -(w.t * s / 2 + 6 * dpr)); ctx.restore();
    }
    const ponto = (p, r) => { ctx.fillStyle = TP_AZUL; ctx.beginPath(); ctx.arc(p.x * s, p.y * s, r * dpr, 0, 7); ctx.fill(); };
    if (hover) ponto(hover, 3);
    if (inicio) ponto(inicio, 5);
  };

  // ---------- 3D ----------
  const desenhar3d = () => {
    const T = three.current; if (!T || !window.THREE) return;
    const THREE = window.THREE;
    while (T.group.children.length) { const m = T.group.children.pop(); m.geometry.dispose(); m.material.dispose(); }
    T.group.add(new THREE.GridHelper(TP_MUNDO, TP_MUNDO, 0xd1d5db, 0xeef0f3));
    for (const w of paredes) {
      const L = tpLen(w); if (!L) continue;
      const g = new THREE.BoxGeometry(L + w.t, w.h, w.t); // +t fecha os cantos
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xe5e1d8 }));
      m.position.set((w.a.x + w.b.x) / 2 - TP_MUNDO / 2, w.h / 2, (w.a.y + w.b.y) / 2 - TP_MUNDO * 0.375);
      m.rotation.y = -Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x);
      T.group.add(m);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0x4b5563 }));
      e.position.copy(m.position); e.rotation.copy(m.rotation); T.group.add(e);
    }
    T.camera.position.set(T.dist * Math.sin(T.phi) * Math.cos(T.theta), T.dist * Math.cos(T.phi), T.dist * Math.sin(T.phi) * Math.sin(T.theta));
    T.camera.lookAt(0, 1, 0);
    T.renderer.render(T.scene, T.camera);
  };

  const redimensionar = () => {
    for (const c of [planRef.current, v3dRef.current]) {
      if (!c) continue;
      const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr));
    }
    const T = three.current;
    if (T) { T.renderer.setSize(v3dRef.current.width, v3dRef.current.height, false); T.camera.aspect = v3dRef.current.width / v3dRef.current.height; T.camera.updateProjectionMatrix(); }
    desenharPlanta(); desenhar3d();
  };

  useEffect(() => {
    let vivo = true;
    tpCarregarThree().then((THREE) => {
      if (!vivo || !v3dRef.current) return;
      const renderer = new THREE.WebGLRenderer({ canvas: v3dRef.current, antialias: true });
      const scene = new THREE.Scene(); scene.background = new THREE.Color(0xffffff);
      const camera = new THREE.PerspectiveCamera(40, 4 / 3, 0.1, 200);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x888877, 0.9));
      const sol = new THREE.DirectionalLight(0xffffff, 0.6); sol.position.set(6, 12, 4); scene.add(sol);
      const group = new THREE.Group(); scene.add(group);
      three.current = { renderer, scene, camera, group, theta: -0.7, phi: 0.9, dist: 16 };
      redimensionar();
    }).catch((e) => vivo && setErro3d(e.message));
    window.addEventListener("resize", redimensionar);
    return () => {
      vivo = false; window.removeEventListener("resize", redimensionar);
      if (three.current) { three.current.renderer.dispose(); three.current = null; }
    };
  }, []);

  useEffect(() => { desenharPlanta(); }, [paredes, inicio, hover, espM]);
  useEffect(() => { desenhar3d(); }, [paredes]);
  useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape") setInicio(null);
      if ((e.ctrlKey || e.metaKey) && e.key === "z") desfazer();
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  // rotação do 3D por arraste / zoom pela roda
  const drag = useRef(null);
  const v3dDown = (e) => { drag.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); };
  const v3dMove = (e) => {
    const T = three.current; if (!drag.current || !T) return;
    T.theta -= (e.clientX - drag.current.x) * 0.01;
    T.phi = Math.min(1.5, Math.max(0.15, T.phi - (e.clientY - drag.current.y) * 0.01));
    drag.current = { x: e.clientX, y: e.clientY }; desenhar3d();
  };
  useEffect(() => {
    const c = v3dRef.current; if (!c) return;
    const w = (e) => { const T = three.current; if (!T) return; e.preventDefault(); T.dist = Math.min(40, Math.max(5, T.dist + e.deltaY * 0.01)); desenhar3d(); };
    c.addEventListener("wheel", w, { passive: false }); return () => c.removeEventListener("wheel", w);
  });

  const planDown = (e) => {
    const p = paraMundo(e); setHover(p);
    if (!inicio) { setInicio(p); return; }
    if (p.x === inicio.x && p.y === inicio.y) return;
    setParedes((ps) => [...ps, { a: inicio, b: p, t: espM, h: altM }]);
    setInicio(p);
  };
  function desfazer() {
    setParedes((ps) => {
      if (!ps.length) return ps;
      const ult = ps[ps.length - 1];
      setInicio((i) => (i ? ult.a : null));
      return ps.slice(0, -1);
    });
  }

  const L = paredes.reduce((s, w) => s + tpLen(w), 0);
  const A = paredes.reduce((s, w) => s + tpLen(w) * w.h, 0);
  const blocos = Math.ceil(A * 12.5 * 1.05);

  const btn = { padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#111827", fontSize: 14, fontWeight: 500, cursor: "pointer", minHeight: 38 };
  const lbl = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6b7280", marginBottom: 4 };
  const inp = { width: 84, padding: "7px 8px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, fontVariantNumeric: "tabular-nums" };
  const pane = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", position: "relative", minWidth: 0 };
  const tag = { position: "absolute", top: 8, left: 10, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9ca3af", pointerEvents: "none" };
  const card = { padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10 };
  const val = { fontSize: 20, fontWeight: 600, fontVariantNumeric: "tabular-nums", marginTop: 4, color: "#111827" };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
      <style>{`
        [data-vk-tp-views]{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        [data-vk-tp-quant]{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
        @media (max-width: 767px){
          [data-vk-tp-views]{grid-template-columns:1fr}
          [data-vk-tp-quant]{grid-template-columns:1fr 1fr}
        }
      `}</style>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>Teste Projeto</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
          {inicio
            ? "Clique para fechar este trecho. A próxima parede começa no mesmo ponto. \"Finalizar traço\" ou Esc encerra."
            : "Clique na planta para marcar o início da parede."}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        <div><div style={lbl}>Espessura (cm)</div><input id="tp-esp" style={inp} inputMode="decimal" value={esp} onChange={(e) => setEsp(e.target.value)} /></div>
        <div><div style={lbl}>Altura (m)</div><input id="tp-alt" style={inp} inputMode="decimal" value={alt} onChange={(e) => setAlt(e.target.value)} /></div>
        <button style={{ ...btn, background: TP_AZUL, borderColor: TP_AZUL, color: "#fff" }} onClick={() => setInicio(null)}>Finalizar traço</button>
        <button style={btn} onClick={desfazer}>Desfazer</button>
        <button style={btn} onClick={() => { setParedes([]); setInicio(null); }}>Limpar</button>
      </div>

      <div data-vk-tp-views>
        <div style={pane}>
          <span style={tag}>Planta · grade 0,50 m</span>
          <canvas ref={planRef} style={{ display: "block", width: "100%", aspectRatio: "4 / 3", touchAction: "none", cursor: "crosshair" }}
            onPointerDown={planDown} onPointerMove={(e) => setHover(paraMundo(e))} onPointerLeave={() => !inicio && setHover(null)} />
        </div>
        <div style={pane}>
          <span style={tag}>3D · arraste para girar</span>
          <canvas ref={v3dRef} style={{ display: "block", width: "100%", aspectRatio: "4 / 3", touchAction: "none" }}
            onPointerDown={v3dDown} onPointerMove={v3dMove} onPointerUp={() => (drag.current = null)} />
          {erro3d && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", fontSize: 13, padding: 16, textAlign: "center" }}>{erro3d} Verifique a conexão e abra a tela de novo.</div>}
        </div>
      </div>

      <div data-vk-tp-quant>
        <div style={card}><div style={lbl}>Paredes</div><div style={val}>{paredes.length}</div></div>
        <div style={card}><div style={lbl}>Comprimento</div><div style={val}>{tpFmt(L)} m</div></div>
        <div style={card}><div style={lbl}>Área de parede</div><div style={val}>{tpFmt(A)} m²</div></div>
        <div style={card}><div style={lbl}>Blocos 14×19×39</div><div style={val}>{blocos.toLocaleString("pt-BR")} un</div></div>
        <div style={card}><div style={lbl}>Reboco 2 faces</div><div style={val}>{tpFmt(A * 2)} m²</div></div>
      </div>
      <div style={{ fontSize: 12, color: "#9ca3af" }}>Teste isolado: nada é salvo. Blocos a 12,5 un/m² + 5% de perda, sem descontar portas e janelas.</div>
    </div>
  );
}
