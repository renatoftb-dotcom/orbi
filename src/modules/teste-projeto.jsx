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

function TpEditor({ projeto, nomeCliente, onAlterar, onVoltar }) {
  const planRef = useRef(null), v3dRef = useRef(null);
  const [paredes, setParedes] = useState(() => (Array.isArray(projeto.paredes) ? projeto.paredes : []));
  const primeiraVez = useRef(true);
  useEffect(() => {
    if (primeiraVez.current) { primeiraVez.current = false; return; }
    onAlterar({ ...projeto, paredes, atualizadoEm: new Date().toISOString() });
  }, [paredes]);
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
        <button style={{ ...btn, border: "none", background: "transparent", padding: "4px 0", minHeight: 0, color: TP_AZUL }} onClick={onVoltar}>← Projetos</button>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginTop: 4 }}>{projeto.nome}</div>
        <div style={{ fontSize: 13, color: "#374151", marginTop: 2 }}>Cliente: {nomeCliente || "—"}</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>
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
      <div style={{ fontSize: 12, color: "#9ca3af" }}>Teste: o desenho fica salvo só neste navegador, ainda não vai para o servidor. Blocos a 12,5 un/m² + 5% de perda, sem descontar portas e janelas.</div>
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
      <div style={{ marginTop: 20, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
        <TpEditor key={aberto.id} projeto={aberto} nomeCliente={cliente.nome}
          onAlterar={(p) => salvarLista(tpLer(empresaId).map((x) => (x.id === p.id ? p : x)))}
          onVoltar={() => { setTodos(tpLer(empresaId)); setAbertoId(null); }} />
      </div>
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
