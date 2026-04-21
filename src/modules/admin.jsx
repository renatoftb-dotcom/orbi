// ═══════════════════════════════════════════════════════════════
// ADMIN — Módulo de Administração do Sistema (VICKE SaaS)
// ═══════════════════════════════════════════════════════════════
// Acesso restrito: apenas usuários com perfil "master" (Renato / Anthropic).
// Escritórios cliente (tenants) NÃO veem este módulo.
//
// Funcionalidades:
// - Manutenção: executa rotina de expiração de propostas + inativação
//   de clientes fora do horário agendado (cron 3h da manhã).
//
// Futuramente:
// - Gestão de empresas (tenants)
// - Gestão de usuários master
// - Métricas do sistema
// - Logs de auditoria
// ═══════════════════════════════════════════════════════════════

function Admin({ usuario }) {
  const [aba, setAba] = useState("manutencao");
  const [manutResult, setManutResult] = useState(null);
  const [manutLoading, setManutLoading] = useState(false);

  async function executarManutencao() {
    if (!confirm("Executar rotina de manutenção agora?\n\n• Expira propostas com mais de 30 dias (remove imagens, marca como perdido)\n• Inativa clientes sem serviço em aberto há 3 meses\n\nNormalmente roda sozinha todo dia às 3h da manhã.")) return;
    setManutLoading(true);
    setManutResult(null);
    try {
      const token = localStorage.getItem("vicke-token");
      if (!token) {
        alert("Sessão expirada. Faça login novamente.");
        setManutLoading(false);
        return;
      }
      const res = await fetch("https://orbi-production-5f5c.up.railway.app/admin/manutencao", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.ok) {
        setManutResult(json.data);
      } else {
        alert("Erro: " + (json.error || "Falha ao executar manutenção"));
      }
    } catch (e) {
      alert("Erro de rede: " + e.message);
    } finally {
      setManutLoading(false);
    }
  }

  const S = {
    wrap: { fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", background:"#fff", minHeight:"100vh", color:"#111", maxWidth:1200, margin:"0 auto" },
    header: { borderBottom:"1px solid #e5e7eb", padding:"24px 32px" },
    titulo: { fontSize:18, fontWeight:700, color:"#111", margin:0 },
    sub: { fontSize:13, color:"#9ca3af", marginTop:3 },
    abas: { display:"flex", gap:0, borderBottom:"1px solid #e5e7eb", padding:"0 32px" },
    aba: (ativa) => ({ background:"none", border:"none", borderBottom: ativa ? "2px solid #111" : "2px solid transparent", color: ativa ? "#111" : "#9ca3af", padding:"12px 16px", fontSize:13, fontWeight: ativa ? 600 : 400, cursor:"pointer", fontFamily:"inherit", marginBottom:-1 }),
    body: { padding:"32px", maxWidth:760 },
    secao: { marginBottom:32 },
    secTitulo: { fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:16 },
    btn: { background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
    tag: { display:"inline-block", fontSize:10, fontWeight:700, color:"#7c3aed", background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:4, padding:"2px 8px", textTransform:"uppercase", letterSpacing:1, marginLeft:10 },
  };

  // ── ABA MANUTENÇÃO ────────────────────────────────────────────
  const renderManutencao = () => (
    <div style={S.body}>
      <div style={S.secao}>
        <div style={S.secTitulo}>Manutenção automática</div>
        <div style={{ fontSize:13, color:"#6b7280", lineHeight:1.6, marginBottom:16 }}>
          O backend executa automaticamente, todo dia às 3h da manhã (UTC):
          <ul style={{ margin:"10px 0 0 0", padding:"0 0 0 20px" }}>
            <li>Expira propostas com mais de 30 dias (marca como "Perdido" e remove imagens salvas pra liberar storage)</li>
            <li>Inativa clientes sem serviço em aberto há 3 meses (com observação automática)</li>
          </ul>
        </div>
        <div style={{ fontSize:13, color:"#6b7280", marginBottom:20 }}>
          Use o botão abaixo para forçar uma execução agora, sem esperar o horário agendado.
        </div>
        <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
          <button
            onClick={executarManutencao}
            disabled={manutLoading}
            style={{ ...S.btn, opacity: manutLoading ? 0.5 : 1, cursor: manutLoading ? "not-allowed" : "pointer" }}>
            {manutLoading ? "Executando..." : "Executar manutenção agora"}
          </button>
          {manutResult && (
            <div style={{ fontSize:12.5, color:"#16a34a", background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8, padding:"8px 14px" }}>
              ✓ Executado em {new Date(manutResult.executadoEm).toLocaleString("pt-BR")}
              <br/>
              <span style={{ color:"#374151" }}>
                {manutResult.orcamentosExpirados} orçamento(s) expirado(s) · {manutResult.clientesInativados} cliente(s) inativado(s)
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── PLACEHOLDERS FUTUROS ──────────────────────────────────────
  const renderEmpresas = () => (
    <div style={S.body}>
      <div style={{ fontSize:13, color:"#9ca3af", padding:"40px 0", textAlign:"center" }}>
        Gestão de empresas cliente (tenants) — em breve.
      </div>
    </div>
  );

  const renderUsuariosMaster = () => (
    <div style={S.body}>
      <div style={{ fontSize:13, color:"#9ca3af", padding:"40px 0", textAlign:"center" }}>
        Usuários com perfil master — em breve.
      </div>
    </div>
  );

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display:"flex", alignItems:"center" }}>
          <h2 style={S.titulo}>Administração do Sistema</h2>
          <span style={S.tag}>Master</span>
        </div>
        <div style={S.sub}>Acesso restrito · Usuário: {usuario?.nome || "—"}</div>
      </div>

      {/* Abas */}
      <div style={S.abas}>
        {[["manutencao","Manutenção"],["empresas","Empresas"],["usuarios","Usuários Master"]].map(([key,lbl]) => (
          <button key={key} style={S.aba(aba===key)} onClick={() => setAba(key)}>{lbl}</button>
        ))}
      </div>

      {/* Conteúdo */}
      {aba === "manutencao" && renderManutencao()}
      {aba === "empresas"   && renderEmpresas()}
      {aba === "usuarios"   && renderUsuariosMaster()}
    </div>
  );
}
