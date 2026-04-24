// ═══════════════════════════════════════════════════════════════
// ADMIN — Módulo de Administração do Sistema (VICKE SaaS)
// ═══════════════════════════════════════════════════════════════
// Acesso restrito: apenas usuários com perfil "master".
// Gerencia empresas cliente (tenants), usuários master e manutenção.
//
// Sprint 2 — Bloco C:
// - Usa api.js em vez de fetch direto (ganha handler 401 automático)
// - Recebe data/save do app.jsx (integração padrão com o resto)
// - Abas Empresas e Usuários Master ainda placeholders (Bloco F implementa)
// ═══════════════════════════════════════════════════════════════

function Admin({ usuario, data, save }) {
  const [aba, setAba] = useState("manutencao");
  const [manutResult, setManutResult] = useState(null);
  const [manutLoading, setManutLoading] = useState(false);
  const [manutErro, setManutErro]       = useState(null);
  const [confirmManut, setConfirmManut] = useState(false);

  async function executarManutencao() {
    setConfirmManut(false);
    setManutLoading(true);
    setManutResult(null);
    setManutErro(null);
    try {
      // api.admin.manutencao() já adiciona Authorization header automaticamente
      // e dispara auto-logout em caso de 401.
      const resumo = await api.admin.manutencao();
      setManutResult(resumo);
    } catch (e) {
      setManutErro(e.message || "Falha ao executar manutenção");
    } finally {
      setManutLoading(false);
    }
  }

  const S = {
    wrap:    { fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", background:"#fff", minHeight:"100vh", color:"#111", maxWidth:1200, margin:"0 auto" },
    header:  { borderBottom:"1px solid #e5e7eb", padding:"24px 32px" },
    titulo:  { fontSize:18, fontWeight:700, color:"#111", margin:0 },
    sub:     { fontSize:13, color:"#9ca3af", marginTop:3 },
    abas:    { display:"flex", gap:0, borderBottom:"1px solid #e5e7eb", padding:"0 32px" },
    aba:     (ativa) => ({ background:"none", border:"none", borderBottom: ativa ? "2px solid #111" : "2px solid transparent", color: ativa ? "#111" : "#9ca3af", padding:"12px 16px", fontSize:13, fontWeight: ativa ? 600 : 400, cursor:"pointer", fontFamily:"inherit", marginBottom:-1 }),
    body:    { padding:"32px", maxWidth:760 },
    secao:   { marginBottom:32 },
    secTit:  { fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:16 },
    btn:     { background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
    btnSec:  { background:"#fff", color:"#374151", border:"1px solid #e5e7eb", borderRadius:8, padding:"8px 16px", fontSize:13, cursor:"pointer", fontFamily:"inherit" },
    tag:     { display:"inline-block", fontSize:10, fontWeight:700, color:"#7c3aed", background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:4, padding:"2px 8px", textTransform:"uppercase", letterSpacing:1, marginLeft:10 },
    overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" },
    modal:   { background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"28px 32px", maxWidth:420, width:"90%", boxShadow:"0 8px 32px rgba(0,0,0,0.12)" },
  };

  // ── ABA MANUTENÇÃO ────────────────────────────────────────────
  const renderManutencao = () => (
    <div style={S.body}>
      <div style={S.secao}>
        <div style={S.secTit}>Manutenção automática</div>
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
        <div style={{ display:"flex", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
          <button
            onClick={() => setConfirmManut(true)}
            disabled={manutLoading}
            style={{ ...S.btn, opacity: manutLoading ? 0.5 : 1, cursor: manutLoading ? "not-allowed" : "pointer" }}>
            {manutLoading ? "Executando..." : "Executar manutenção agora"}
          </button>
          {manutErro && (
            <div style={{ fontSize:12.5, color:"#991b1b", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"8px 14px" }}>
              ⚠ {manutErro}
            </div>
          )}
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

      {/* Modal de confirmação — substitui o confirm() nativo */}
      {confirmManut && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{ fontSize:16, fontWeight:700, color:"#111", marginBottom:10 }}>Executar manutenção agora?</div>
            <div style={{ fontSize:13, color:"#6b7280", marginBottom:20, lineHeight:1.6 }}>
              Esta ação vai:<br/>
              · Expirar propostas com mais de 30 dias (marca como Perdido e apaga imagens)<br/>
              · Inativar clientes sem serviço em aberto há 3 meses
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={() => setConfirmManut(false)} style={S.btnSec}>Cancelar</button>
              <button onClick={executarManutencao} style={S.btn}>Executar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── PLACEHOLDERS — BLOCO F IMPLEMENTA ────────────────────────
  const renderEmpresas = () => (
    <div style={S.body}>
      <div style={{ fontSize:13, color:"#9ca3af", padding:"40px 0", textAlign:"center" }}>
        Gestão de empresas cliente — implementação no próximo sprint.
        <br/>
        <span style={{ fontSize:12, color:"#d1d5db" }}>Por enquanto, crie empresas direto pelo banco (tabela `empresas`).</span>
      </div>
    </div>
  );

  const renderUsuariosMaster = () => (
    <div style={S.body}>
      <div style={{ fontSize:13, color:"#9ca3af", padding:"40px 0", textAlign:"center" }}>
        Gestão de usuários master — implementação no próximo sprint.
      </div>
    </div>
  );

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <div style={{ display:"flex", alignItems:"center" }}>
          <h2 style={S.titulo}>Administração do Sistema</h2>
          <span style={S.tag}>Master</span>
        </div>
        <div style={S.sub}>Acesso restrito · Usuário: {usuario?.nome || "—"}</div>
      </div>

      <div style={S.abas}>
        {[["manutencao","Manutenção"],["empresas","Empresas"],["usuarios","Usuários Master"]].map(([key,lbl]) => (
          <button key={key} style={S.aba(aba===key)} onClick={() => setAba(key)}>{lbl}</button>
        ))}
      </div>

      {aba === "manutencao" && renderManutencao()}
      {aba === "empresas"   && renderEmpresas()}
      {aba === "usuarios"   && renderUsuariosMaster()}
    </div>
  );
}
