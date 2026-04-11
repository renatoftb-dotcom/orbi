
// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
export default function ModuloClientesFornecedores() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState("home");
  const [showBackup, setShowBackup] = useState(false);
  const [backupJson, setBackupJson] = useState("");
  const [clientesKey, setClientesKey] = useState(0);
  const [fornecedoresKey, setFornecedoresKey] = useState(0);
  const [projetosKey,   setProjetosKey]   = useState(0);
  const [obrasKey,      setObrasKey]       = useState(0);
  const [financeiroKey, setFinanceiroKey]  = useState(0);
  const [escritorioKey, setEscritorioKey]  = useState(0);

  useEffect(() => { loadData(); }, []);

  // Aviso ao fechar aba sem exportar
  useEffect(() => {
    const handler = e => {
      e.preventDefault();
      e.returnValue = "Seus dados não foram exportados. Deseja sair mesmo assim?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Aviso ao fechar aba sem exportar
  useEffect(() => {
    const handler = e => {
      e.preventDefault();
      e.returnValue = "Seus dados não foram exportados. Deseja sair mesmo assim?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  async function loadData() {
    try {
      const saved = await loadAllData();
      setData(saved);
    } catch(e) {
      console.error("Erro ao carregar dados:", e);
      setData(SEED);
    }
    setLoading(false);
  }

  async function save(newData) {
    const oldData = data;
    setData(newData);
    try {
      await saveAllData(newData, oldData);
    } catch(e) {
      console.error("Erro ao salvar:", e);
    }
  }

  function exportarDados() {
    const json = JSON.stringify(data, null, 2);
    // Tenta download
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vicke-backup-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
    // Sempre mostra o JSON na tela para copiar
    setBackupJson(json);
    setShowBackup(true);
  }

  function importarDados(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        await save(parsed);
        alert("Dados importados com sucesso!");
      } catch {
        alert("Arquivo inválido. Use um backup gerado pelo Vicke.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  if (loading) return (
    <div style={S.center}>
      <Spinner />
      <p style={{ color:"#64748b", marginTop:16, fontSize:13 }}>Carregando...</p>
    </div>
  );

  return (
    <div style={S.app}>
      <style>{CSS}</style>
      {/* HEADER */}
      <div style={S.topbar}>
        <div style={S.topbarLeft}>
          <span style={S.logoMark}>⚒</span>
          <span style={S.logoText}>Vicke</span>
          <span style={S.logoDivider}>/</span>
          <span style={S.logoSub}>{["clientes","fornecedores","nf"].includes(aba) ? "Clientes" : aba === "projetos" ? "Projetos" : aba === "obras" ? "Obras" : aba === "financeiro" ? "Financeiro" : aba === "escritorio" ? "Escritório" : "Em breve"}</span>
        </div>
        <div style={S.topbarRight}>
          {/* Importar */}
          <label style={{ display:"flex", alignItems:"center", gap:6, background:"#1e293b",
            border:"1px solid #334155", borderRadius:7, padding:"5px 12px",
            fontSize:12, color:"#94a3b8", cursor:"pointer", fontFamily:"inherit" }}
            title="Importar backup JSON">
            ⬆ Importar
            <input type="file" accept=".json" style={{ display:"none" }} onChange={importarDados} />
          </label>
          {/* Exportar */}
          <button onClick={exportarDados}
            style={{ display:"flex", alignItems:"center", gap:6, background:"#164e2a",
              border:"1px solid #16a34a", borderRadius:7, padding:"5px 12px",
              fontSize:12, color:"#4ade80", cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}
            title="Exportar backup JSON — faça isso regularmente!">
            ⬇ Exportar Backup
          </button>
          <div style={{ width:1, background:"#1e293b", height:16 }} />
          <span style={S.onlineDot}>●</span>
          <span style={{ color:"#475569", fontSize:12 }}>Dados salvos automaticamente</span>
        </div>
      </div>

      {/* MENU PRINCIPAL */}
      <div style={S.tabBar}>
        {/* Botão Home */}
        <button className="tab-btn"
          style={{ ...S.tabBtn, ...(aba==="home" ? S.tabBtnActive : {}), minWidth:0, padding:"0 14px", fontSize:16 }}
          onClick={() => setAba("home")} title="Menu Principal">
          ⌂
        </button>
        <div style={{ width:1, background:"#1e293b", margin:"8px 4px" }} />
        {/* Módulos principais */}
        {[
          { k:"clientes",    l:"👥  Clientes",    count: data.clientes?.length },
          { k:"projetos",    l:"📐  Projetos",    count: null },
          { k:"obras",       l:"🏗  Obras",        count: null },
          { k:"financeiro",  l:"💰  Financeiro",  count: null },
        ].map(({k,l,count}) => (
          <button key={k} className="tab-btn"
            style={{ ...S.tabBtn, ...(aba===k ? S.tabBtnActive : {}) }}
            onClick={() => {
              setAba(k);
              if(k==="clientes")   setClientesKey(n=>n+1);
              if(k==="projetos")   setProjetosKey(n=>n+1);
              if(k==="obras")      setObrasKey(n=>n+1);
              if(k==="financeiro") setFinanceiroKey(n=>n+1);
            }}>
            {l}
            {count != null && <span style={S.tabCount}>{count}</span>}
          </button>
        ))}
        {/* Separador */}
        <div style={{ flex:1 }} />
        {/* Sub-módulos — deslocados para direita */}
        {[
          { k:"fornecedores", l:"🏭  Fornecedores", count: data.fornecedores?.length },
          { k:"nf",           l:"📄  Notas Fiscais", count: null },
          { k:"escritorio",   l:"🏢  Escritório",    count: null },
          { k:"teste",        l:"🧪  Teste",          count: null },
        ].map(({k,l,count}) => (
          <button key={k} className="tab-btn"
            style={{ ...S.tabBtn, ...(aba===k ? S.tabBtnActive : {}), fontSize:12, opacity:0.85 }}
            onClick={() => {
              setAba(k);
              if(k==="fornecedores") setFornecedoresKey(n=>n+1);
              if(k==="escritorio")  setEscritorioKey(n=>n+1);
            }}>
            {l}
            {count != null && <span style={S.tabCount}>{count}</span>}
          </button>
        ))}
      </div>

      {/* MODAL BACKUP */}
      {showBackup && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:99999,
          display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#0f172a", border:"1px solid #334155", borderRadius:14,
            padding:"24px", width:"100%", maxWidth:700, maxHeight:"85vh",
            display:"flex", flexDirection:"column", gap:16,
            boxShadow:"0 24px 48px rgba(0,0,0,0.7)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ color:"#4ade80", fontWeight:700, fontSize:16 }}>💾 Backup dos Dados</div>
              <button onClick={() => setShowBackup(false)}
                style={{ background:"transparent", border:"none", color:"#64748b", fontSize:20, cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ color:"#94a3b8", fontSize:13 }}>
              Selecione tudo (<b style={{color:"#f1f5f9"}}>Ctrl+A</b>), copie (<b style={{color:"#f1f5f9"}}>Ctrl+C</b>) e cole num arquivo <b style={{color:"#f1f5f9"}}>.txt</b> ou <b style={{color:"#f1f5f9"}}>.json</b> no seu computador.
            </div>
            <textarea
              readOnly
              value={backupJson}
              onClick={e => e.target.select()}
              style={{ flex:1, minHeight:380, background:"#020817", border:"1px solid #1e293b",
                borderRadius:8, color:"#4ade80", fontSize:11, fontFamily:"monospace",
                padding:14, resize:"none", outline:"none" }}
            />
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={() => { navigator.clipboard?.writeText(backupJson).then(() => alert("Copiado!")).catch(() => {}); }}
                style={{ background:"#166534", color:"#4ade80", border:"1px solid #16a34a",
                  borderRadius:7, padding:"8px 18px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                📋 Copiar tudo
              </button>
              <button onClick={() => setShowBackup(false)}
                style={{ background:"#1e293b", color:"#94a3b8", border:"1px solid #334155",
                  borderRadius:7, padding:"8px 18px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BACKUP */}
      <div style={S.content}>
        {aba === "home"        && <HomeMenu setAba={setAba} data={data} />}
        {aba === "clientes"    && <Clientes key={clientesKey} data={data} save={save} />}
        {aba === "projetos"    && <Projetos key={projetosKey} data={data} save={save} />}
        {aba === "obras"       && <Obras key={obrasKey} data={data} save={save} />}
        {aba === "financeiro"  && <Financeiro key={financeiroKey} data={data} save={save} />}
        {aba === "fornecedores"&& <Fornecedores key={fornecedoresKey} data={data} save={save} />}
        {aba === "nf"          && <ImportarNF data={data} save={save} />}
        {aba === "escritorio"  && <Escritorio key={escritorioKey} data={data} save={save} />}
        {aba === "teste"       && <TesteOrcamento data={data} save={save} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CLIENTES
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// HOME — MENU PRINCIPAL
// ═══════════════════════════════════════════════════════════════
