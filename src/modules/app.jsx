// ═══════════════════════════════════════════════════════════════
// HOME MENU
// ═══════════════════════════════════════════════════════════════

function HomeMenu({ data, setAba, tentarTrocar }) {
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
    { k:"clientes",         label:"Clientes",     desc:"Cadastro e orçamentos",     count: data?.clientes?.length },
    { k:"projetos:etapas",  label:"Projetos",     desc:"Etapas e prazos" },
    { k:"obras",            label:"Obras",        desc:"Acompanhamento e execução" },
    { k:"financeiro",       label:"Financeiro",   desc:"Receitas e lançamentos" },
    { k:"fornecedores",     label:"Fornecedores", desc:"Cadastro e histórico",      count: data?.fornecedores?.length },
    { k:"escritorio",       label:"Escritório",   desc:"Dados e equipe" },
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
          <button key={m.k} onClick={() => { const go = () => setAba(m.k); if (tentarTrocar) tentarTrocar(go); else go(); }}
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
  const [loading, setLoading]         = useState(false);
  const [aba, setAba]                 = useState("home");
  const [showBackup, setShowBackup]   = useState(false);
  const [backupJson, setBackupJson]   = useState("");
  const [clientesKey, setClientesKey]         = useState(0);
  const [fornecedoresKey, setFornecedoresKey] = useState(0);
  const [projetosKey, setProjetosKey]         = useState(0);
  const [orcamentosKey, setOrcamentosKey]     = useState(0);
  const [obrasKey, setObrasKey]               = useState(0);
  const [financeiroKey, setFinanceiroKey]     = useState(0);
  const [escritorioKey, setEscritorioKey]     = useState(0);
  const [sidebarAberta, setSidebarAberta]     = useState(true);
  const [orcamentoTelaCheia, setOrcamentoTelaCheia] = useState(null);
  const [clienteRetorno, setClienteRetorno] = useState(null);
  const [cadastroNovoCliente, setCadastroNovoCliente] = useState(false);
  const [backendOffline, setBackendOffline]   = useState(false);

  // Flag interna: true quando há salvamento em andamento.
  // Usada pelo beforeunload pra bloquear fechamento durante saves.
  const savingRef = useRef(false);

  // tentarTrocar: quando há orçamento em tela cheia com dados não salvos,
  // consulta o handler registrado pelo FormOrcamento (window.__vickeOrcDirtyPrompt).
  function tentarTrocar(fn) {
    if (typeof window !== "undefined" && typeof window.__vickeOrcDirtyPrompt === "function") {
      const absorveu = window.__vickeOrcDirtyPrompt(fn);
      if (absorveu) return;
    }
    fn();
  }

  // Accordion: Projetos fica aberto quando qualquer aba "projetos:*" está ativa
  const [projetosAberto, setProjetosAberto] = useState(() => (typeof aba === "string" && aba.indexOf("projetos") === 0));
  useEffect(() => {
    if (typeof aba === "string" && aba.indexOf("projetos") === 0) setProjetosAberto(true);
  }, [aba]);

  // Bootstrap: se já tiver token+user no localStorage, restaura sessão.
  // Valida expiração usando decodeJWT centralizado de shared.jsx.
  useEffect(() => {
    try {
      const tok = localStorage.getItem("vicke-token");
      const usr = localStorage.getItem("vicke-user");
      if (tok && usr) {
        const payload = decodeJWT(tok);
        if (!payload) {
          // Token malformado — limpa e deixa cair na tela de login
          localStorage.removeItem("vicke-token");
          localStorage.removeItem("vicke-user");
          return;
        }
        if (isTokenExpirado(payload)) {
          localStorage.removeItem("vicke-token");
          localStorage.removeItem("vicke-user");
          return;
        }
        setUsuario(JSON.parse(usr));
        setToken(tok);
        setAutenticado(true);
      }
    } catch {
      // Erro de parse — limpa pra não travar o app
      try {
        localStorage.removeItem("vicke-token");
        localStorage.removeItem("vicke-user");
      } catch {}
    }
  }, []);

  // Quando autentica (login novo ou bootstrap), carrega os dados
  useEffect(() => { if (autenticado) { setLoading(true); loadData(); } }, [autenticado]);

  // Migração de abas antigas para nova nomenclatura
  useEffect(() => {
    if (aba === "projetos") setAba("projetos:etapas");
    else if (aba === "teste") setAba("projetos:orcamentos");
  }, [aba]);

  // beforeunload: ANTES disparava sempre "Deseja sair?" mesmo sem alterações.
  // AGORA: só ativa quando (a) um save está em andamento, ou (b) o módulo
  // de orçamento em tela cheia tem dados sujos (consulta __vickeOrcDirtyPrompt).
  // Em todos os outros casos, usuário pode fechar/recarregar sem fricção.
  useEffect(() => {
    const handler = (e) => {
      const savingAgora = savingRef.current;
      let orcSujo = false;
      try {
        if (typeof window !== "undefined" && typeof window.__vickeOrcHasDirty === "function") {
          orcSujo = !!window.__vickeOrcHasDirty();
        }
      } catch {}
      if (!savingAgora && !orcSujo) return; // Deixa sair sem avisar
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  function handleLogin(usr, tok) { setUsuario(usr); setToken(tok); setAutenticado(true); setAba("home"); }
  function handleLogout() { clearAuth(); setUsuario(null); setToken(null); setAutenticado(false); setData(null); setAba("home"); }

  async function loadData() {
    try {
      const saved = await loadAllData();
      setData(saved);
      setBackendOffline(false);
    }
    catch(e) {
      console.error("Erro ao carregar dados do servidor:", e);
      setData(SEED);
      setBackendOffline(true);
    }
    setLoading(false);
  }

  // save(): ANTES recarregava tudo do servidor após cada chamada (loadAllData).
  // AGORA: otimista — aplica localmente, envia pro backend, e fim.
  // Ganho: latência perceptível em cada ação some (antes eram 8 requests
  // paralelos depois de cada clique em "salvar ganho", "mover kanban", etc).
  // Trade-off: se o backend modificar o dado no save (ex: timestamp auto),
  // o frontend só vê na próxima navegação — aceitável pro caso geral.
  // A opção { skipReload } continua aceita pra compat com código existente.
  async function save(newData, opts = {}) {
    const oldData = data;
    setData(newData); // otimista
    savingRef.current = true;
    try {
      await saveAllData(newData, oldData);
      setBackendOffline(false);
    }
    catch(e) {
      console.error("Erro ao salvar:", e);
      setBackendOffline(true);
      // Não reverte o state — usuário continua vendo seus dados localmente,
      // backendOffline dispara banner vermelho no topo pra alertar.
    }
    finally {
      savingRef.current = false;
    }
  }

  // Exporta backup: baixa o arquivo .json direto sem mostrar modal duplicado.
  // Antes: baixava E abria modal com textarea do JSON — confuso, parecia bug.
  function exportarDados() {
    const json = JSON.stringify(data, null, 2);
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
    } catch (e) {
      // Fallback: se o browser bloqueou o download, mostra o JSON em modal
      // pro usuário copiar manualmente.
      console.error("Falha no download direto, abrindo modal:", e);
      setBackupJson(json);
      setShowBackup(true);
    }
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

  if (!data) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#fff", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", padding:20 }}>
        <div style={{ textAlign:"center", maxWidth:400 }}>
          <div style={{ fontSize:15, color:"#111", marginBottom:8, fontWeight:600 }}>Servidor indisponível</div>
          <div style={{ fontSize:13, color:"#6b7280", marginBottom:16 }}>Não foi possível carregar os dados. Tente novamente em alguns segundos.</div>
          <button onClick={() => { setLoading(true); loadData(); }} style={{ background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"10px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Tentar novamente</button>
          <button onClick={handleLogout} style={{ marginLeft:10, background:"transparent", color:"#6b7280", border:"1px solid #e5e7eb", borderRadius:8, padding:"10px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Sair</button>
        </div>
      </div>
    );
  }

  const nomeEscritorio = data?.escritorio?.nome || "Vicke";

  const MENU = [
    { k:"home",        label:"Início" },
    { k:"clientes",    label:"Clientes",     count: data?.clientes?.length },
    { k:"projetos", label:"Projetos", sub: [
      { k:"projetos:orcamentos", label:"Orçamentos" },
      { k:"projetos:etapas",     label:"Em Andamento" },
    ]},
    { k:"obras",       label:"Obras" },
    { k:"financeiro",  label:"Financeiro" },
    { k:"fornecedores",label:"Fornecedores", count: data?.fornecedores?.length },
    { k:"nf",          label:"Notas Fiscais" },
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
            {MENU.map(item => {
              const {k, label, count, sub} = item;
              if (sub && sub.length) {
                const ativoNeleMesmoOuSubitem = aba === k || (typeof aba === "string" && aba.indexOf(k + ":") === 0);
                return (
                  <div key={k} style={{ display:"flex", flexDirection:"column" }}>
                    <button
                      style={{
                        ...itemStyle(ativoNeleMesmoOuSubitem),
                        justifyContent: "flex-start",
                        gap: 6,
                        background: ativoNeleMesmoOuSubitem && aba !== k ? "transparent" : undefined,
                        fontWeight: ativoNeleMesmoOuSubitem ? 600 : 400,
                        color: ativoNeleMesmoOuSubitem ? "#111" : "#6b7280",
                      }}
                      onMouseEnter={e => { if (!ativoNeleMesmoOuSubitem) e.currentTarget.style.background="#f9fafb"; }}
                      onMouseLeave={e => { if (!ativoNeleMesmoOuSubitem) e.currentTarget.style.background="transparent"; }}
                      onClick={() => setProjetosAberto(o => !o)}
                    >
                      <span>{label}</span>
                      <span style={{
                        color:"#9ca3af", fontSize:9,
                        transition:"transform 0.2s",
                        transform: projetosAberto ? "rotate(90deg)" : "rotate(0deg)",
                        display:"inline-block",
                        lineHeight: 1,
                      }}>▶</span>
                    </button>
                    {projetosAberto && (
                      <div style={{ display:"flex", flexDirection:"column", gap:1, marginLeft:14, paddingLeft:8, borderLeft:"1px solid #f3f4f6", marginTop:2 }}>
                        {sub.map(s => {
                          const ativoSub = aba === s.k;
                          return (
                            <button
                              key={s.k}
                              style={{
                                padding:"6px 10px", borderRadius:6,
                                fontSize:12.5,
                                color: ativoSub ? "#111" : "#9ca3af",
                                fontWeight: ativoSub ? 600 : 400,
                                background: ativoSub ? "#f3f4f6" : "transparent",
                                cursor:"pointer", border:"none",
                                fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",
                                textAlign:"left", transition:"all 0.12s",
                              }}
                              onMouseEnter={e => { if (!ativoSub) { e.currentTarget.style.background="#f9fafb"; e.currentTarget.style.color="#6b7280"; } }}
                              onMouseLeave={e => { if (!ativoSub) { e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#9ca3af"; } }}
                              onClick={() => {
                                tentarTrocar(() => {
                                  setAba(s.k);
                                  setOrcamentoTelaCheia(null);
                                  if (s.k === "projetos:etapas") setProjetosKey(n=>n+1);
                                  if (s.k === "projetos:orcamentos") setOrcamentosKey(n=>n+1);
                                });
                              }}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <button key={k} style={itemStyle(aba===k)}
                  onMouseEnter={e => { if(aba!==k) e.currentTarget.style.background="#f9fafb"; }}
                  onMouseLeave={e => { if(aba!==k) e.currentTarget.style.background="transparent"; }}
                  onClick={() => {
                    tentarTrocar(() => {
                      setAba(k);
                      setOrcamentoTelaCheia(null);
                      if(k==="clientes")    setClientesKey(n=>n+1);
                      if(k==="obras")       setObrasKey(n=>n+1);
                      if(k==="financeiro")  setFinanceiroKey(n=>n+1);
                      if(k==="fornecedores")setFornecedoresKey(n=>n+1);
                      if(k==="projetos:orcamentos") setOrcamentosKey(n=>n+1);
                    });
                  }}>
                  <span>{label}</span>
                  {count > 0 && <span style={{ background:"#f3f4f6", color:"#9ca3af", fontSize:11, padding:"1px 7px", borderRadius:8 }}>{count}</span>}
                </button>
              );
            })}
          </nav>
          <div style={{ padding:"8px 8px 12px", borderTop:"1px solid #f3f4f6", display:"flex", flexDirection:"column", gap:2 }}>
            <button style={itemStyle(aba==="escritorio")}
              onMouseEnter={e => { if(aba!=="escritorio") e.currentTarget.style.background="#f9fafb"; }}
              onMouseLeave={e => { if(aba!=="escritorio") e.currentTarget.style.background="transparent"; }}
              onClick={() => { tentarTrocar(() => { setAba("escritorio"); setOrcamentoTelaCheia(null); setEscritorioKey(n=>n+1); }); }}>
              Escritório
            </button>
            {usuario?.perfil === "master" && (
              <button style={itemStyle(aba==="admin")}
                onMouseEnter={e => { if(aba!=="admin") e.currentTarget.style.background="#f9fafb"; }}
                onMouseLeave={e => { if(aba!=="admin") e.currentTarget.style.background="transparent"; }}
                onClick={() => { tentarTrocar(() => { setAba("admin"); setOrcamentoTelaCheia(null); }); }}>
                <span style={{ display:"flex", alignItems:"center", gap:6 }}>
                  Admin
                  <span style={{ fontSize:9, fontWeight:700, color:"#7c3aed", background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:3, padding:"1px 5px", textTransform:"uppercase", letterSpacing:0.5 }}>Master</span>
                </span>
              </button>
            )}
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
        {backendOffline && (
          <div style={{ background:"#fef2f2", borderBottom:"1px solid #fecaca", padding:"8px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
            <div style={{ fontSize:12, color:"#991b1b" }}>
              <span style={{ fontWeight:600 }}>⚠ Servidor indisponível</span>
              <span style={{ marginLeft:8, color:"#b91c1c" }}>— trabalhando no modo offline. Alterações não serão salvas até o servidor voltar.</span>
            </div>
            <button onClick={loadData} style={{ background:"#fff", color:"#991b1b", border:"1px solid #fca5a5", borderRadius:6, padding:"4px 12px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
              Tentar reconectar
            </button>
          </div>
        )}
        <div style={{ flex:1, overflowY:"auto" }}>
          <>
          {orcamentoTelaCheia ? (
            <FormOrcamentoProjetoTeste
              clienteNome={orcamentoTelaCheia.clienteOrc.nome}
              clienteWA={orcamentoTelaCheia.clienteOrc.contatos?.find(c=>c.whatsapp)?.telefone||""}
              orcBase={orcamentoTelaCheia.orcBase || null}
              modoVer={orcamentoTelaCheia.modo === "ver"}
              modoAbertura={orcamentoTelaCheia.modo}
              onSalvar={async (orc) => {
                const todos = data.orcamentosProjeto || [];
                const maxSeq = todos.reduce((mx2, o2) => {
                  const mm = (o2.id||"").match(/^ORC-(\d+)$/);
                  return mm ? Math.max(mx2, parseInt(mm[1])) : mx2;
                }, 0);
                const nextId = "ORC-" + String(maxSeq + 1).padStart(4, "0");
                const novo2 = { ...orc, clienteId: orcamentoTelaCheia.clienteOrc.id, cliente: orcamentoTelaCheia.clienteOrc.nome, whatsapp: orcamentoTelaCheia.clienteOrc.contatos?.find(c=>c.whatsapp)?.telefone || "", id: orc.id || nextId, criadoEm: orc.criadoEm || new Date().toISOString() };
                const novos2 = orc.id ? todos.map(o2=>o2.id===orc.id?novo2:o2) : [...todos, novo2];
                await save({ ...data, orcamentosProjeto: novos2 });
                setOrcamentoTelaCheia(prev => ({ ...prev, orcBase: novo2 }));
              }}
              onVoltar={() => {
                setClienteRetorno(orcamentoTelaCheia.clienteOrc);
                setOrcamentoTelaCheia(null);
                setAba("clientes");
                setClientesKey(n=>n+1);
                // Sem loadData aqui — save() otimista já atualizou data localmente.
              }}
            />
          ) : (<>
          {aba === "home"                   && <HomeMenu setAba={setAba} data={data} tentarTrocar={tentarTrocar} />}
          {aba === "clientes"               && <Clientes key={clientesKey} data={data} save={save} onReload={()=>setClientesKey(n=>n+1)} onAbrirOrcamento={(c, orc, modo) => setOrcamentoTelaCheia({ clienteOrc: c, orcBase: orc, modo: modo || "editar" })} orcamentoAberto={!!orcamentoTelaCheia} abrirClienteDetail={clienteRetorno} onClienteDetailAberto={() => setClienteRetorno(null)} abrirCadastroNovo={cadastroNovoCliente} onCadastroNovoAberto={() => setCadastroNovoCliente(false)} />}
          {aba === "projetos:etapas"        && <Etapas key={projetosKey} data={data} save={save} />}
          {aba === "projetos:orcamentos"    && <TesteOrcamento key={orcamentosKey} data={data} save={save} onCadastrarCliente={() => { setAba("clientes"); setClientesKey(n=>n+1); setCadastroNovoCliente(true); }} />}
          {aba === "obras"                  && <Obras key={obrasKey} data={data} save={save} />}
          {aba === "financeiro"             && <Financeiro key={financeiroKey} data={data} save={save} />}
          {aba === "fornecedores"           && <Fornecedores key={fornecedoresKey} data={data} save={save} />}
          {aba === "nf"                     && <ImportarNF data={data} save={save} />}
          {aba === "escritorio"             && <Escritorio key={escritorioKey} data={data} save={save} />}
          {aba === "admin" && usuario?.perfil === "master" && <Admin usuario={usuario} data={data} save={save} />}
          </>)}
          </>
        </div>
      </div>
      {showBackup && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:99999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:14, padding:24, width:"100%", maxWidth:600, maxHeight:"85vh", display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontWeight:700, fontSize:15, color:"#111" }}>Backup dos dados</div>
              <button onClick={() => setShowBackup(false)} style={{ background:"transparent", border:"none", color:"#9ca3af", fontSize:20, cursor:"pointer" }}>×</button>
            </div>
            <div style={{ color:"#6b7280", fontSize:13 }}>Download automático não disponível. Selecione tudo (<b>Ctrl+A</b>), copie (<b>Ctrl+C</b>) e salve num arquivo <b>.json</b>.</div>
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
