// ═══════════════════════════════════════════════════════════════
// HOME MENU
// ═══════════════════════════════════════════════════════════════

function HomeMenu({ data, setAba }) {
  const nomeEscritorio = data?.escritorio?.nome || "";
  const [texto, setTexto] = useState("Bem-vindo");
  const [fase, setFase] = useState("bemvindo");

  useEffect(() => {
    if (!nomeEscritorio) return;
    const t1 = setTimeout(() => setFase("saindo"), 1600);
    const t2 = setTimeout(() => { setTexto(nomeEscritorio); setFase("entrando"); }, 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [nomeEscritorio]);

  const opacity = fase === "saindo" ? 0 : 1;
  const transform = fase === "saindo" ? "translateY(-8px)" : "translateY(0)";

  const modulos = [
    { k:"clientes",    label:"Clientes",     desc:"Cadastro e orçamentos",     count: data?.clientes?.length },
    { k:"projetos",    label:"Projetos",     desc:"Etapas e prazos" },
    { k:"obras",       label:"Obras",        desc:"Acompanhamento e execução" },
    { k:"financeiro",  label:"Financeiro",   desc:"Receitas e lançamentos" },
    { k:"fornecedores",label:"Fornecedores", desc:"Cadastro e histórico",      count: data?.fornecedores?.length },
    { k:"escritorio",  label:"Escritório",   desc:"Dados e equipe" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"calc(100vh - 53px)", padding:"40px 32px", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
      <div style={{ textAlign:"center", marginBottom:56 }}>
        <div style={{ fontSize:28, fontWeight:300, color:"#111", letterSpacing:-0.5, transition:"opacity 0.4s ease, transform 0.4s ease", opacity, transform }}>
          {texto}
        </div>
        <div style={{ fontSize:13, color:"#d1d5db", marginTop:8 }}>Selecione um módulo para começar</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:12, width:"100%", maxWidth:680 }}>
        {modulos.map(m => (
          <button key={m.k} onClick={() => setAba(m.k)}
            style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"20px", textAlign:"left", cursor:"pointer", fontFamily:"inherit", position:"relative" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor="#111"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor="#e5e7eb"; }}>
            <div style={{ fontSize:13, fontWeight:600, color:"#111", marginBottom:4 }}>{m.label}</div>
            <div style={{ fontSize:12, color:"#9ca3af" }}>{m.desc}</div>
            {m.count > 0 && <div style={{ position:"absolute", top:12, right:12, background:"#f3f4f6", color:"#6b7280", fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:10 }}>{m.count}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
export default function ModuloClientesFornecedores() {
  const [usuario, setUsuario]         = useState(null);
  const [token, setToken]             = useState(null);
  const [autenticado, setAutenticado] = useState(false);
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [aba, setAba]                 = useState("home");
  const [showBackup, setShowBackup]   = useState(false);
  const [backupJson, setBackupJson]   = useState("");
  const [clientesKey, setClientesKey]         = useState(0);
  const [fornecedoresKey, setFornecedoresKey] = useState(0);
  const [projetosKey, setProjetosKey]         = useState(0);
  const [obrasKey, setObrasKey]               = useState(0);
  const [financeiroKey, setFinanceiroKey]     = useState(0);
  const [escritorioKey, setEscritorioKey]     = useState(0);
  const [sidebarAberta, setSidebarAberta]     = useState(true);
  const [orcamentoTelaCheia, setOrcamentoTelaCheia] = useState(null); // { clienteOrc, orcBase }

  useEffect(() => { if (autenticado) loadData(); }, [autenticado]);

  useEffect(() => {
    const handler = e => { e.preventDefault(); e.returnValue = "Deseja sair?"; return e.returnValue; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  function handleLogin(usr, tok) { setUsuario(usr); setToken(tok); setAutenticado(true); }
  function handleLogout() { clearAuth(); setUsuario(null); setToken(null); setAutenticado(false); setData(null); }

  async function loadData() {
    try { const saved = await loadAllData(); setData(saved); }
    catch(e) { console.error("Erro:", e); setData(SEED); }
    setLoading(false);
  }

  async function save(newData) {
    const oldData = data;
    setData(newData);
    try {
      await saveAllData(newData, oldData);
      const fresh = await loadAllData();
      setData(fresh);
    }
    catch(e) { console.error("Erro ao salvar:", e); }
  }

  function exportarDados() {
    const json = JSON.stringify(data, null, 2);
    try {
      const blob = new Blob([json], { type:"application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `vicke-backup-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch {}
    setBackupJson(json); setShowBackup(true);
  }

  function importarDados(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try { const parsed = JSON.parse(ev.target.result); await save(parsed); alert("Dados importados!"); }
      catch { alert("Arquivo inválido."); }
    };
    reader.readAsText(file); e.target.value = "";
  }

  if (!autenticado) return <TelaLogin onLogin={handleLogin} />;

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#fff", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:20, height:20, border:"2px solid #e5e7eb", borderTop:"2px solid #111", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 12px" }} />
        <p style={{ color:"#9ca3af", fontSize:13, margin:0 }}>Carregando...</p>
      </div>
    </div>
  );

  const nomeEscritorio = data?.escritorio?.nome || "Vicke";

  const MENU = [
    { k:"home",        label:"Início" },
    { k:"clientes",    label:"Clientes",     count: data?.clientes?.length },
    { k:"projetos",    label:"Projetos" },
    { k:"obras",       label:"Obras" },
    { k:"financeiro",  label:"Financeiro" },
    { k:"fornecedores",label:"Fornecedores", count: data?.fornecedores?.length },
    { k:"nf",          label:"Notas Fiscais" },
    { k:"teste",       label:"Orçamento" },
  ];

  const itemStyle = (ativo) => ({
    display:"flex", alignItems:"center", justifyContent:"space-between",
    padding:"8px 12px", borderRadius:7, cursor:"pointer", fontSize:13,
    fontWeight: ativo ? 600 : 400, color: ativo ? "#111" : "#6b7280",
    background: ativo ? "#f3f4f6" : "transparent",
    border:"none", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",
    width:"100%", textAlign:"left",
  });

  return (
    <div style={{ display:"flex", height:"100vh", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", background:"#fff", overflow:"hidden" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {sidebarAberta && (
        <div style={{ width:220, minWidth:220, background:"#fff", borderRight:"1px solid #f3f4f6", display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"20px 16px 16px", borderBottom:"1px solid #f3f4f6" }}>
            <div style={{ fontSize:15, fontWeight:700, color:"#111", letterSpacing:-0.3 }}>{nomeEscritorio}</div>
            <div style={{ fontSize:11, color:"#d1d5db", marginTop:2 }}>Vicke</div>
          </div>
          <nav style={{ flex:1, padding:"12px 8px", display:"flex", flexDirection:"column", gap:2, overflowY:"auto" }}>
            {MENU.map(({k, label, count}) => (
              <button key={k} style={itemStyle(aba===k)}
                onMouseEnter={e => { if(aba!==k) e.currentTarget.style.background="#f9fafb"; }}
                onMouseLeave={e => { if(aba!==k) e.currentTarget.style.background="transparent"; }}
                onClick={() => {
                  setAba(k);
                  if(k==="clientes")    setClientesKey(n=>n+1);
                  if(k==="projetos")    setProjetosKey(n=>n+1);
                  if(k==="obras")       setObrasKey(n=>n+1);
                  if(k==="financeiro")  setFinanceiroKey(n=>n+1);
                  if(k==="fornecedores")setFornecedoresKey(n=>n+1);
                }}>
                <span>{label}</span>
                {count > 0 && <span style={{ background:"#f3f4f6", color:"#9ca3af", fontSize:11, padding:"1px 7px", borderRadius:8 }}>{count}</span>}
              </button>
            ))}
          </nav>
          <div style={{ padding:"8px 8px 12px", borderTop:"1px solid #f3f4f6", display:"flex", flexDirection:"column", gap:2 }}>
            <button style={itemStyle(aba==="escritorio")}
              onMouseEnter={e => { if(aba!=="escritorio") e.currentTarget.style.background="#f9fafb"; }}
              onMouseLeave={e => { if(aba!=="escritorio") e.currentTarget.style.background="transparent"; }}
              onClick={() => { setAba("escritorio"); setEscritorioKey(n=>n+1); }}>
              Escritório
            </button>
            <div style={{ padding:"8px 12px", marginTop:4, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:"#374151" }}>{usuario?.nome || "—"}</div>
                <div style={{ fontSize:11, color:"#d1d5db" }}>{usuario?.perfil || ""}</div>
              </div>
              <button onClick={handleLogout} style={{ background:"none", border:"none", color:"#d1d5db", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Sair</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ borderBottom:"1px solid #f3f4f6", padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"#fff" }}>
          <button onClick={() => setSidebarAberta(s => !s)}
            style={{ background:"none", border:"none", color:"#9ca3af", cursor:"pointer", padding:"4px 8px", fontSize:16, fontFamily:"inherit" }}>☰</button>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, color:"#9ca3af", cursor:"pointer", border:"1px solid #e5e7eb", borderRadius:6, padding:"5px 10px" }}>
              Importar
              <input type="file" accept=".json" style={{ display:"none" }} onChange={importarDados} />
            </label>
            <button onClick={exportarDados} style={{ fontSize:12, color:"#6b7280", cursor:"pointer", border:"1px solid #e5e7eb", borderRadius:6, padding:"5px 10px", background:"#fff", fontFamily:"inherit" }}>
              Exportar backup
            </button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto" }}>
          {aba === "home"         && <HomeMenu setAba={setAba} data={data} />}
          {aba === "clientes"     && <Clientes key={clientesKey} data={data} save={save} onReload={()=>setClientesKey(n=>n+1)} onAbrirOrcamento={(c, orc) => setOrcamentoTelaCheia({ clienteOrc: c, orcBase: orc })} />}
          {aba === "projetos"     && <Projetos key={projetosKey} data={data} save={save} />}
          {aba === "obras"        && <Obras key={obrasKey} data={data} save={save} />}
          {aba === "financeiro"   && <Financeiro key={financeiroKey} data={data} save={save} />}
          {aba === "fornecedores" && <Fornecedores key={fornecedoresKey} data={data} save={save} />}
          {aba === "nf"           && <ImportarNF data={data} save={save} />}
          {aba === "escritorio"   && <Escritorio key={escritorioKey} data={data} save={save} />}
          {aba === "teste"        && <TesteOrcamento data={data} save={save} />}
        </div>
      </div>

      {/* Orçamento em tela cheia */}
      {orcamentoTelaCheia && (
        <div style={{ position:"fixed", inset:0, zIndex:9999, background:"#fff", overflow:"auto" }}>
          <FormOrcamentoProjetoTeste
            clienteNome={orcamentoTelaCheia.clienteOrc.nome}
            clienteWA={orcamentoTelaCheia.clienteOrc.contatos?.find(c=>c.whatsapp)?.telefone||""}
            orcBase={orcamentoTelaCheia.orcBase || null}
            onSalvar={async (orc) => {
              const todos = data.orcamentosProjeto || [];
              const maxSeq = todos.reduce((mx, o) => {
                const m = (o.id||"").match(/^ORC-(\d+)$/);
                return m ? Math.max(mx, parseInt(m[1])) : mx;
              }, 0);
              const nextId = "ORC-" + String(maxSeq + 1).padStart(4, "0");
              const novo = {
                ...orc,
                clienteId: orcamentoTelaCheia.clienteOrc.id,
                cliente: orcamentoTelaCheia.clienteOrc.nome,
                whatsapp: orcamentoTelaCheia.clienteOrc.contatos?.find(c=>c.whatsapp)?.telefone || "",
                id: orc.id || nextId,
                criadoEm: orc.criadoEm || new Date().toISOString()
              };
              const novos = orc.id ? todos.map(o=>o.id===orc.id?novo:o) : [...todos, novo];
              await save({ ...data, orcamentosProjeto: novos });
              setOrcamentoTelaCheia(null);
              setClientesKey(n=>n+1);
            }}
            onVoltar={() => { setOrcamentoTelaCheia(null); }}
          />
        </div>
      )}

      {showBackup && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:99999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:14, padding:24, width:"100%", maxWidth:600, maxHeight:"85vh", display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontWeight:700, fontSize:15, color:"#111" }}>Backup dos dados</div>
              <button onClick={() => setShowBackup(false)} style={{ background:"transparent", border:"none", color:"#9ca3af", fontSize:20, cursor:"pointer" }}>×</button>
            </div>
            <div style={{ color:"#6b7280", fontSize:13 }}>Selecione tudo (<b>Ctrl+A</b>), copie (<b>Ctrl+C</b>) e salve num arquivo <b>.json</b>.</div>
            <textarea readOnly value={backupJson} onClick={e => e.target.select()}
              style={{ flex:1, minHeight:320, background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:8, color:"#374151", fontSize:11, fontFamily:"monospace", padding:14, resize:"none", outline:"none" }} />
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={() => navigator.clipboard?.writeText(backupJson).catch(()=>{})}
                style={{ background:"#111", color:"#fff", border:"none", borderRadius:7, padding:"8px 18px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Copiar tudo</button>
              <button onClick={() => setShowBackup(false)}
                style={{ background:"#fff", color:"#6b7280", border:"1px solid #e5e7eb", borderRadius:7, padding:"8px 18px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CLIENTES
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// HOME — MENU PRINCIPAL
// ═══════════════════════════════════════════════════════════════
