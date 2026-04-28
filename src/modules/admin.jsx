// ═══════════════════════════════════════════════════════════════
// ADMIN — Módulo de Administração do Sistema (VICKE SaaS)
// ═══════════════════════════════════════════════════════════════
// Acesso restrito: apenas usuários com perfil "master".
// Gerencia empresas cliente (tenants), usuários master e manutenção.
//
// Sprint 2 — Bloco F:
// - Aba Empresas: listagem com contagens, criar empresa + admin em 1 passo,
//   desativar/reativar (bloqueia login sem apagar dados). Exclusão definitiva
//   fica fora da UI (muito destrutivo — fazer via banco se necessário).
// - Aba Usuários Master: CRUD completo. Máximo 3 masters por segurança.
//   Backend já bloqueia excluir último master e auto-exclusão.
// ═══════════════════════════════════════════════════════════════

function Admin({ usuario, data, save, initialTab }) {
  // Se initialTab vier, abre direto na aba escolhida (usado pelo Master quando
  // clica em "Empresas", "Usuários Master" ou "Manutenção" no menu principal —
  // Sprint 3 Bloco E. Senão fica em manutencao por padrão.
  const [aba, setAba] = useState(initialTab || "manutencao");
  const [manutResult, setManutResult] = useState(null);
  const [manutLoading, setManutLoading] = useState(false);
  const [manutErro, setManutErro]       = useState(null);
  const [confirmManut, setConfirmManut] = useState(false);

  // Estados CUB
  const [cubStatus, setCubStatus]       = useState(null);   // array de estados
  const [cubValores, setCubValores]     = useState(null);   // array de valores
  const [cubLogs, setCubLogs]           = useState(null);   // array de logs
  const [cubLoading, setCubLoading]     = useState(false);
  const [cubErro, setCubErro]           = useState(null);
  const [cubAtualizando, setCubAtualizando] = useState(false);
  const [cubMsg, setCubMsg]             = useState(null);
  const [cubFiltroEstado, setCubFiltroEstado] = useState(""); // filtro UI

  async function carregarCub() {
    setCubLoading(true);
    setCubErro(null);
    try {
      const [status, valores, logs] = await Promise.all([
        api.admin.cub.status(),
        api.admin.cub.list(),
        api.admin.cub.log(50),
      ]);
      setCubStatus(status);
      setCubValores(valores);
      setCubLogs(logs);
    } catch (e) {
      setCubErro(e.message || "Falha ao carregar dados CUB");
    } finally {
      setCubLoading(false);
    }
  }

  async function executarColetaCub(estados) {
    setCubAtualizando(true);
    setCubMsg(null);
    setCubErro(null);
    try {
      const resp = await api.admin.cub.atualizar(estados);
      setCubMsg(resp?.mensagem || "Coleta iniciada em background");
      // Recarrega depois de 3s pra dar tempo do background processar
      setTimeout(carregarCub, 3000);
    } catch (e) {
      setCubErro(e.message || "Falha ao iniciar coleta");
    } finally {
      setCubAtualizando(false);
    }
  }

  // Carregar dados CUB ao entrar na aba
  useEffect(() => {
    if (aba === "cub" && !cubStatus && !cubLoading) {
      carregarCub();
    }
  }, [aba]);

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
    body:    { padding:"32px" },
    bodyNarrow: { padding:"32px", maxWidth:760 },
    secao:   { marginBottom:32 },
    secTit:  { fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:16 },
    btn:     { background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
    btnSec:  { background:"#fff", color:"#374151", border:"1px solid #e5e7eb", borderRadius:8, padding:"8px 16px", fontSize:13, cursor:"pointer", fontFamily:"inherit" },
    btnDestrutivo: { background:"#dc2626", color:"#fff", border:"none", borderRadius:8, padding:"8px 16px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
    tag:     { display:"inline-block", fontSize:10, fontWeight:700, color:"#7c3aed", background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:4, padding:"2px 8px", textTransform:"uppercase", letterSpacing:1, marginLeft:10 },
    overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 },
    modal:   { background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"28px 32px", maxWidth:480, width:"100%", boxShadow:"0 8px 32px rgba(0,0,0,0.12)", maxHeight:"90vh", overflowY:"auto" },
    modalLg: { background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"28px 32px", maxWidth:560, width:"100%", boxShadow:"0 8px 32px rgba(0,0,0,0.12)", maxHeight:"90vh", overflowY:"auto" },
    label:   { display:"block", fontSize:11, fontWeight:600, color:"#6b7280", textTransform:"uppercase", letterSpacing:0.5, marginBottom:5 },
    input:   { width:"100%", border:"1px solid #e5e7eb", borderRadius:8, padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" },
    tabela:  { width:"100%", borderCollapse:"collapse", fontSize:13 },
    th:      { textAlign:"left", fontSize:11, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:0.5, padding:"10px 12px", borderBottom:"1px solid #e5e7eb", background:"#fafbfc" },
    td:      { padding:"12px", borderBottom:"1px solid #f3f4f6", verticalAlign:"middle" },
    badgeAtiva: { display:"inline-block", fontSize:11, fontWeight:600, color:"#15803d", background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:4, padding:"2px 8px" },
    badgeInativa: { display:"inline-block", fontSize:11, fontWeight:600, color:"#b91c1c", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:4, padding:"2px 8px" },
    vazio:   { fontSize:13, color:"#9ca3af", textAlign:"center", padding:"40px 0" },
  };

  // ── ABA MANUTENÇÃO ────────────────────────────────────────────
  const renderManutencao = () => (
    <div style={S.bodyNarrow}>
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
        <div style={S.overlay} onClick={() => setConfirmManut(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
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

  // ── ABA CUB ─────────────────────────────────────────────────
  // Helpers de formatação locais
  function fmtMoney(v) {
    if (v === null || v === undefined) return "—";
    const n = parseFloat(v);
    if (!isFinite(n)) return "—";
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtDate(d) {
    if (!d) return "—";
    try { return new Date(d).toLocaleString("pt-BR"); } catch { return "—"; }
  }
  function fmtMes(d) {
    if (!d) return "—";
    try {
      const dt = new Date(d);
      const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
      return `${meses[dt.getMonth()]}/${dt.getFullYear()}`;
    } catch { return "—"; }
  }

  const renderCUB = () => (
    <div style={S.body}>

      {/* Cabeçalho com descrição */}
      <div style={{ marginBottom:24, fontSize:13, color:"#6b7280", lineHeight:1.6 }}>
        O Custo Unitário Básico (CUB) é divulgado mensalmente pelos sindicatos da construção.
        O sistema atualiza automaticamente todo dia 10 às 4h. Estados ativos: <b>SP, RJ, MG, SC</b>.
        Use o botão para forçar atualização agora.
      </div>

      {/* Mensagens de status */}
      {cubMsg && (
        <div style={{ fontSize:12.5, color:"#15803d", background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8, padding:"10px 14px", marginBottom:16 }}>
          ✓ {cubMsg}
        </div>
      )}
      {cubErro && (
        <div style={{ fontSize:12.5, color:"#991b1b", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 14px", marginBottom:16 }}>
          ⚠ {cubErro}
        </div>
      )}

      {/* Botão de ação */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:32 }}>
        <button
          onClick={() => executarColetaCub()}
          disabled={cubAtualizando}
          style={{ ...S.btn, opacity: cubAtualizando ? 0.5 : 1, cursor: cubAtualizando ? "not-allowed" : "pointer" }}>
          {cubAtualizando ? "Iniciando..." : "Atualizar CUB agora (todos os estados)"}
        </button>
        <button onClick={carregarCub} style={S.btnSec} disabled={cubLoading}>
          {cubLoading ? "Carregando..." : "Recarregar dados"}
        </button>
      </div>

      {/* Status por estado */}
      <div style={S.secao}>
        <div style={S.secTit}>Status por estado</div>
        {cubLoading && !cubStatus ? (
          <div style={S.vazio}>Carregando...</div>
        ) : !cubStatus || cubStatus.length === 0 ? (
          <div style={S.vazio}>Nenhum estado configurado</div>
        ) : (
          <table style={S.tabela}>
            <thead>
              <tr>
                <th style={S.th}>Estado</th>
                <th style={S.th}>Valores ativos</th>
                <th style={S.th}>Mês de referência</th>
                <th style={S.th}>Última atualização</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {cubStatus.map(s => {
                const statusBadge = s.ultimo_status === "sucesso"
                  ? { ...S.badgeAtiva, background:"#f0fdf4", color:"#15803d", border:"1px solid #bbf7d0" }
                  : s.ultimo_status === "falha"
                  ? S.badgeInativa
                  : { display:"inline-block", fontSize:11, fontWeight:600, color:"#9ca3af", background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:4, padding:"2px 8px" };
                const statusLabel = s.ultimo_status === "sucesso" ? "OK"
                                  : s.ultimo_status === "falha" ? "Falha"
                                  : "Nunca coletado";
                return (
                  <tr key={s.estado}>
                    <td style={{ ...S.td, fontWeight:700 }}>{s.estado}</td>
                    <td style={S.td}>{s.qtd_valores}</td>
                    <td style={S.td}>{fmtMes(s.mes_mais_recente)}</td>
                    <td style={{ ...S.td, fontSize:12, color:"#6b7280" }}>{fmtDate(s.ultima_atualizacao)}</td>
                    <td style={S.td}>
                      <span style={statusBadge}>{statusLabel}</span>
                      {s.ultimo_erro && (
                        <div style={{ fontSize:10.5, color:"#991b1b", marginTop:4, fontStyle:"italic", maxWidth:240, lineHeight:1.4 }}>
                          {s.ultimo_erro.length > 60 ? s.ultimo_erro.slice(0, 60) + "…" : s.ultimo_erro}
                        </div>
                      )}
                    </td>
                    <td style={S.td}>
                      <button
                        onClick={() => executarColetaCub([s.estado])}
                        disabled={cubAtualizando}
                        style={{ ...S.btnSec, fontSize:12, padding:"5px 12px" }}>
                        Atualizar só {s.estado}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Tabela de valores */}
      <div style={S.secao}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:12 }}>
          <div style={{ ...S.secTit, marginBottom:0 }}>Valores atuais</div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <span style={{ fontSize:12, color:"#6b7280" }}>Filtrar:</span>
            <select
              value={cubFiltroEstado}
              onChange={e => setCubFiltroEstado(e.target.value)}
              style={{ ...S.input, width:"auto", padding:"6px 10px", fontSize:12 }}>
              <option value="">Todos os estados</option>
              {(cubStatus || []).map(s => <option key={s.estado} value={s.estado}>{s.estado}</option>)}
            </select>
          </div>
        </div>
        {!cubValores || cubValores.length === 0 ? (
          <div style={S.vazio}>
            Nenhum valor coletado ainda. Clique em "Atualizar CUB agora" pra disparar a primeira coleta.
          </div>
        ) : (
          <table style={S.tabela}>
            <thead>
              <tr>
                <th style={S.th}>Estado</th>
                <th style={S.th}>Categoria</th>
                <th style={S.th}>Padrão</th>
                <th style={S.th}>Desoneração</th>
                <th style={{ ...S.th, textAlign:"right" }}>Valor R$/m²</th>
                <th style={S.th}>Mês</th>
                <th style={S.th}>Fonte</th>
              </tr>
            </thead>
            <tbody>
              {cubValores
                .filter(v => !cubFiltroEstado || v.estado === cubFiltroEstado)
                .map((v, idx) => (
                <tr key={`${v.estado}-${v.categoria}-${v.padrao}-${v.com_desonera}-${idx}`}>
                  <td style={{ ...S.td, fontWeight:600 }}>{v.estado}</td>
                  <td style={S.td}>{v.categoria}</td>
                  <td style={S.td}>{v.padrao}</td>
                  <td style={S.td}>{v.com_desonera ? "Sim" : "Não"}</td>
                  <td style={{ ...S.td, textAlign:"right", fontVariantNumeric:"tabular-nums", fontWeight:600 }}>
                    R$ {fmtMoney(v.valor_m2)}
                  </td>
                  <td style={{ ...S.td, fontSize:12, color:"#6b7280" }}>{fmtMes(v.mes_referencia)}</td>
                  <td style={{ ...S.td, fontSize:12, color:"#6b7280" }}>{v.fonte}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Histórico de coletas */}
      <div style={S.secao}>
        <div style={S.secTit}>Histórico de coletas (últimas 50)</div>
        {!cubLogs || cubLogs.length === 0 ? (
          <div style={S.vazio}>Nenhuma coleta executada ainda.</div>
        ) : (
          <table style={S.tabela}>
            <thead>
              <tr>
                <th style={S.th}>Quando</th>
                <th style={S.th}>Estado</th>
                <th style={S.th}>Fonte</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Valores</th>
                <th style={S.th}>Duração</th>
                <th style={S.th}>Erro</th>
              </tr>
            </thead>
            <tbody>
              {cubLogs.map(log => (
                <tr key={log.id}>
                  <td style={{ ...S.td, fontSize:12, color:"#6b7280", whiteSpace:"nowrap" }}>{fmtDate(log.executado_em)}</td>
                  <td style={{ ...S.td, fontWeight:600 }}>{log.estado}</td>
                  <td style={{ ...S.td, fontSize:12 }}>{log.fonte}</td>
                  <td style={S.td}>
                    <span style={
                      log.status === "sucesso" ? { ...S.badgeAtiva, background:"#f0fdf4", color:"#15803d", border:"1px solid #bbf7d0" }
                      : log.status === "falha" ? S.badgeInativa
                      : { display:"inline-block", fontSize:11, fontWeight:600, color:"#a16207", background:"#fefce8", border:"1px solid #fde68a", borderRadius:4, padding:"2px 8px" }
                    }>
                      {log.status}
                    </span>
                  </td>
                  <td style={S.td}>{log.valores_qtd ?? "—"}</td>
                  <td style={{ ...S.td, fontSize:12, color:"#6b7280" }}>{log.duracao_ms ? `${log.duracao_ms}ms` : "—"}</td>
                  <td style={{ ...S.td, fontSize:11, color:"#991b1b", maxWidth:340 }}>
                    {log.erro_msg || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );

  // ── ABA EMPRESAS ─────────────────────────────────────────────
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
        {[["manutencao","Manutenção"],["cub","CUB"],["empresas","Empresas"],["usuarios","Usuários Master"]].map(([key,lbl]) => (
          <button key={key} style={S.aba(aba===key)} onClick={() => setAba(key)}>{lbl}</button>
        ))}
      </div>

      {aba === "manutencao" && renderManutencao()}
      {aba === "cub"        && renderCUB()}
      {aba === "empresas"   && <PainelEmpresas S={S} />}
      {aba === "usuarios"   && <PainelUsuariosMaster S={S} usuarioLogado={usuario} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ErroAcesso — exibição inteligente de erro de carregamento
// ═══════════════════════════════════════════════════════════════
// Distingue 3 cenários e mostra UX apropriada:
// 1. 403 Forbidden + perfil em uso ≠ master → mensagem clara explicando
//    que o usuário atual não tem permissão, com botão pra fazer logout.
// 2. 403 mas o JWT diz "master" → backend rejeitou mesmo com perfil ok.
//    Pode ser bug de servidor; mostra erro genérico mas com detalhes.
// 3. Outros erros (rede, banco, etc.) → mensagem padrão sem complicar.
//
// O objetivo é transformar "Acesso negado" enigmático em ação clara:
// "você está logado como X, esta tela exige Y, [Sair e entrar como outra]".
// ═══════════════════════════════════════════════════════════════

function ErroAcesso({ erro, S }) {
  // erro pode ser string (legacy) ou objeto {message, code, status}
  const eh403 = (typeof erro === "object") && (erro?.status === 403 || erro?.code === "FORBIDDEN");
  const msg = (typeof erro === "string") ? erro : (erro?.message || "Erro desconhecido");

  // Lê perfil real do JWT em uso pra explicar ao usuário o que está errado
  let usuarioAtual = null;
  try {
    if (typeof localStorage !== "undefined") {
      const u = localStorage.getItem("vicke-user");
      if (u) usuarioAtual = JSON.parse(u);
    }
  } catch { /* JSON corrompido */ }

  function fazerLogout() {
    try {
      localStorage.removeItem("vicke-token");
      localStorage.removeItem("vicke-user");
    } catch {}
    // Reload pra fresh start (não pode chamar handleLogout do App daqui)
    window.location.href = "/";
  }

  if (eh403) {
    return (
      <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:10, padding:"18px 20px", marginBottom:16 }}>
        <div style={{ fontSize:14, fontWeight:700, color:"#92400e", marginBottom:8 }}>
          Acesso restrito a usuários master
        </div>
        <div style={{ fontSize:13, color:"#78350f", lineHeight:1.55, marginBottom:14 }}>
          {usuarioAtual ? (
            <>
              Você está logado como <strong>{usuarioAtual.nome}</strong> ({usuarioAtual.perfil})
              com email <strong>{usuarioAtual.email}</strong>.<br/>
              Esta tela só pode ser acessada por usuários com perfil <strong>master</strong>.
            </>
          ) : (
            <>Esta tela só pode ser acessada por usuários com perfil <strong>master</strong>.</>
          )}
        </div>
        <button
          onClick={fazerLogout}
          style={{ background:"#92400e", color:"#fff", border:"none", borderRadius:7, padding:"8px 18px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}
        >
          Sair e fazer login com outra conta
        </button>
      </div>
    );
  }

  // Outros erros — mensagem padrão
  return (
    <div style={{ fontSize:13, color:"#991b1b", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 14px", marginBottom:16 }}>
      {msg}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAINEL EMPRESAS — listagem + criar + editar/inativar
// ═══════════════════════════════════════════════════════════════

function PainelEmpresas({ S }) {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [erro, setErro]         = useState(null);
  // Modais — null = fechado. Objeto = aberto com dados daquela empresa.
  const [modalNova, setModalNova]   = useState(false);
  // Drill-in: empresa selecionada (objeto da listagem). Quando setada,
  // renderiza EmpresaDetalhe em tela cheia. Passamos o objeto inteiro pra
  // EmpresaDetalhe usar como dado pré-carregado e pintar a tela imediato.
  const [empresaSelecionada, setEmpresaSelecionada] = useState(null);

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const lista = await api.admin.empresas.list();
      setEmpresas(lista || []);
    } catch (e) {
      // Guarda erro completo pra distinguir 403 (sem permissão) de outros
      setErro({ message: e.message || "Falha ao carregar empresas", code: e.code, status: e.status });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  function formatarData(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return "—"; }
  }

  function formatarDataHora(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("pt-BR"); } catch { return "—"; }
  }

  // Drill-in aberto → renderiza EmpresaDetalhe em vez da lista
  if (empresaSelecionada) {
    return (
      <EmpresaDetalhe
        S={S}
        empresaId={empresaSelecionada.id}
        empresaPreCarregada={empresaSelecionada}
        onVoltar={() => { setEmpresaSelecionada(null); carregar(); }}
        onExcluida={() => { setEmpresaSelecionada(null); carregar(); }}
      />
    );
  }

  return (
    <div style={S.body}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:600, color:"#111" }}>Empresas cadastradas</div>
          <div style={{ fontSize:12, color:"#9ca3af", marginTop:2 }}>
            {loading ? "Carregando..." : `${empresas.length} empresa(s) · ${empresas.filter(e => e.ativo).length} ativa(s)`}
          </div>
        </div>
        <button style={S.btn} onClick={() => setModalNova(true)}>+ Nova empresa</button>
      </div>

      {erro && <ErroAcesso erro={erro} S={S} />}


      {!loading && empresas.length === 0 && !erro && (
        <div style={S.vazio}>Nenhuma empresa cadastrada. Crie a primeira pra começar.</div>
      )}

      {!loading && empresas.length > 0 && (
        <div style={{ border:"1px solid #e5e7eb", borderRadius:10, overflow:"hidden" }}>
          <table style={S.tabela}>
            <thead>
              <tr>
                <th style={S.th}>Nome</th>
                <th style={S.th}>CNPJ / CPF</th>
                <th style={{ ...S.th, textAlign:"center" }}>Usuários</th>
                <th style={{ ...S.th, textAlign:"center" }}>Orçamentos</th>
                <th style={S.th}>Último login</th>
                <th style={S.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map(e => (
                <tr key={e.id} style={{ cursor:"pointer" }} onClick={() => setEmpresaSelecionada(e)}>
                  <td style={S.td}>
                    <div style={{ fontWeight:600, color:"#111" }}>{e.nome}</div>
                    <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{e.plano || "gratuito"}</div>
                  </td>
                  <td style={{ ...S.td, color:"#6b7280" }}>{e.cnpj_cpf || "—"}</td>
                  <td style={{ ...S.td, textAlign:"center", color:"#6b7280" }}>
                    {e.usuarios_ativos || 0}
                    {e.usuarios_total > e.usuarios_ativos && (
                      <span style={{ color:"#d1d5db", marginLeft:4 }}>/ {e.usuarios_total}</span>
                    )}
                  </td>
                  <td style={{ ...S.td, textAlign:"center", color:"#6b7280" }}>{e.orcamentos_total || 0}</td>
                  <td style={{ ...S.td, color:"#6b7280", fontSize:12 }}>{formatarDataHora(e.ultimo_login_empresa)}</td>
                  <td style={S.td}>
                    <span style={e.ativo ? S.badgeAtiva : S.badgeInativa}>
                      {e.ativo ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalNova && <ModalNovaEmpresa S={S} onFechar={() => setModalNova(false)} onSucesso={() => { setModalNova(false); carregar(); }} />}
    </div>
  );
}

// ── Tela: Detalhe da empresa (drill-in master) ──────────────────
// Tela cheia com 4 seções: Dados, Usuários, Métricas, Ações.
// Carrega via GET /admin/empresas/:id (empresa + usuários + counts).
//
// Props:
//   S:         estilos compartilhados do Admin
//   empresaId: id da empresa a carregar
//   onVoltar:  callback ao clicar Voltar (volta pra lista)
//   onExcluida: callback após exclusão (volta pra lista e recarrega)
function EmpresaDetalhe({ S, empresaId, empresaPreCarregada, onVoltar, onExcluida }) {
  // Renderiza dados básicos da listagem imediatamente (nome, plano, status,
  // counts agregados) enquanto carrega o detalhe completo (usuários + métricas
  // de negócio) em background. Sensação instantânea pro usuário.
  const [data, setData]       = useState(empresaPreCarregada || null);
  const [carregando, setCarregando] = useState(true); // true até GET /:id retornar
  const [erro, setErro]       = useState(null);
  const [modalEdit, setModalEdit]   = useState(false);
  const [modalDel, setModalDel]     = useState(false);
  // Modal de reset: 2 estágios.
  // 1) usuarioParaResetar: usuário em confirmação (mostra "deseja resetar?")
  // 2) senhaGerada: { usuario, senha } após sucesso (mostra senha pra copiar)
  const [usuarioParaResetar, setUsuarioParaResetar] = useState(null);
  const [senhaGerada, setSenhaGerada]               = useState(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const d = await api.admin.empresas.get(empresaId);
      // Mescla com pré-carregado pra preservar campos que a listagem tem
      // mas o detalhe não retorna (ex: usuarios_total agregado da listagem).
      setData(prev => ({ ...(prev || {}), ...d }));
    } catch (e) {
      setErro(e.message || "Falha ao carregar empresa");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, [empresaId]);

  function fmtData(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return "—"; }
  }
  function fmtDataHora(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("pt-BR"); } catch { return "—"; }
  }

  // Sem pré-carregado E ainda carregando: mostra skeleton mínimo.
  // Caso normal (vindo da listagem): pré-carregado preenche enquanto fetch corre.
  if (!data && carregando) {
    return (
      <div style={S.body}>
        <button onClick={onVoltar} style={{ background:"none", border:"none", padding:0, fontSize:13, color:"#828a98", cursor:"pointer", fontFamily:"inherit", marginBottom:24 }}>← Voltar</button>
        <div style={{ display:"flex", alignItems:"center", gap:10, color:"#9ca3af", fontSize:13 }}>
          <div style={{
            width:14, height:14, borderRadius:"50%",
            border:"2px solid #e5e7eb", borderTopColor:"#9ca3af",
            animation:"vickeSpin 0.8s linear infinite",
          }} />
          Carregando empresa…
        </div>
        <style>{`@keyframes vickeSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (erro && !data) {
    return (
      <div style={S.body}>
        <button onClick={onVoltar} style={{ background:"none", border:"none", padding:0, fontSize:13, color:"#828a98", cursor:"pointer", fontFamily:"inherit", marginBottom:24 }}>← Voltar</button>
        <div style={{ background:"#fef2f2", border:"1px solid #fecaca", color:"#991b1b", borderRadius:9, padding:"12px 16px", fontSize:13 }}>
          {erro}
        </div>
      </div>
    );
  }

  // Empresa master (emp_master) tem proteções extras: não pode ser inativada
  // nem excluída. UI esconde os botões correspondentes.
  const isMasterEmp = data.id === "emp_master";
  const c = data.counts || {};

  return (
    <div style={S.body}>
      {/* ── Voltar ── */}
      <button onClick={onVoltar} style={{ background:"none", border:"none", padding:0, fontSize:13, color:"#828a98", cursor:"pointer", fontFamily:"inherit", marginBottom:24 }}>← Voltar</button>

      {/* ── Header com nome + status + ações principais ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:28, gap:16, flexWrap:"wrap" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <div style={{ fontSize:22, fontWeight:600, color:"#111", letterSpacing:-0.3 }}>{data.nome}</div>
            <span style={data.ativo ? S.badgeAtiva : S.badgeInativa}>
              {data.ativo ? "Ativa" : "Inativa"}
            </span>
            {isMasterEmp && <span style={S.tag}>MASTER</span>}
          </div>
          <div style={{ fontSize:12, color:"#9ca3af", marginTop:4 }}>ID: {data.id}</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => setModalEdit(true)} style={S.btnSec}>Editar</button>
        </div>
      </div>

      {/* ── Seção: Dados ── */}
      <div style={{ ...S.secao, marginBottom:32 }}>
        <div style={S.secTit}>Dados</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:14, padding:"16px", background:"#fafbfc", border:"1px solid #f3f4f6", borderRadius:10 }}>
          <DetalheCampo label="CNPJ / CPF" valor={data.cnpj_cpf || "—"} />
          <DetalheCampo label="Plano"       valor={data.plano || "gratuito"} />
          <DetalheCampo label="Criada em"   valor={fmtData(data.criado_em)} />
          <DetalheCampo label="Último login" valor={fmtDataHora(data.ultimo_login_empresa)} />
        </div>
      </div>

      {/* ── Seção: Métricas ── */}
      <div style={{ ...S.secao, marginBottom:32 }}>
        <div style={S.secTit}>
          Métricas
          {carregando && data.usuarios === undefined && <span style={{ fontSize:10, color:"#9ca3af", marginLeft:8, textTransform:"none", letterSpacing:0 }}>(carregando…)</span>}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:10 }}>
          {/* Usuarios: prioriza array carregado; cai pra agregado da listagem (usuarios_total) */}
          <MetricaCard label="Usuários"   valor={data.usuarios?.length ?? data.usuarios_total} carregando={carregando && data.usuarios === undefined} />
          <MetricaCard label="Clientes"   valor={c.clientes_total}   carregando={carregando && data.counts === undefined} />
          <MetricaCard label="Orçamentos" valor={c.orcamentos_total ?? data.orcamentos_total} carregando={carregando && data.counts === undefined} />
          <MetricaCard label="Obras"      valor={c.obras_total}      carregando={carregando && data.counts === undefined} />
        </div>
      </div>

      {/* ── Seção: Usuários ── */}
      <div style={{ ...S.secao, marginBottom:32 }}>
        <div style={S.secTit}>
          Usuários {data.usuarios !== undefined ? `(${data.usuarios.length})` : ""}
          {carregando && data.usuarios === undefined && <span style={{ fontSize:10, color:"#9ca3af", marginLeft:8, textTransform:"none", letterSpacing:0 }}>(carregando…)</span>}
        </div>
        {/* Estado: ainda carregando E sem usuários no estado */}
        {carregando && data.usuarios === undefined ? (
          <div style={{ display:"flex", alignItems:"center", gap:10, color:"#9ca3af", fontSize:13, padding:"20px 0" }}>
            <div style={{
              width:14, height:14, borderRadius:"50%",
              border:"2px solid #e5e7eb", borderTopColor:"#9ca3af",
              animation:"vickeSpin 0.8s linear infinite",
            }} />
            Carregando lista de usuários…
          </div>
        ) : (!data.usuarios || data.usuarios.length === 0) ? (
          <div style={S.vazio}>Nenhum usuário cadastrado.</div>
        ) : (
          <div style={{ border:"1px solid #e5e7eb", borderRadius:10, overflow:"hidden" }}>
            <table style={S.tabela}>
              <thead>
                <tr>
                  <th style={S.th}>Nome</th>
                  <th style={S.th}>Email</th>
                  <th style={S.th}>Nível</th>
                  <th style={S.th}>Último login</th>
                  <th style={S.th}>Status</th>
                  <th style={S.th}></th>
                </tr>
              </thead>
              <tbody>
                {data.usuarios.map(u => (
                  <tr key={u.id}>
                    <td style={S.td}>
                      <div style={{ fontWeight:500, color:"#111" }}>{u.nome}</div>
                      {u.perfil === "master" && <span style={{ ...S.tag, marginLeft:0, marginTop:2, display:"inline-block" }}>MASTER</span>}
                      {u.precisa_trocar_senha && (
                        <div style={{ fontSize:10, color:"#b45309", marginTop:3, fontWeight:600 }}>
                          ⚠ Precisa trocar senha
                        </div>
                      )}
                    </td>
                    <td style={{ ...S.td, color:"#6b7280" }}>{u.email}</td>
                    <td style={{ ...S.td, color:"#6b7280", textTransform:"capitalize" }}>{u.nivel || "—"}</td>
                    <td style={{ ...S.td, color:"#6b7280", fontSize:12 }}>{fmtDataHora(u.ultimo_login)}</td>
                    <td style={S.td}>
                      <span style={u.ativo ? S.badgeAtiva : S.badgeInativa}>
                        {u.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td style={{ ...S.td, textAlign:"right" }}>
                      {u.ativo && (
                        <button
                          onClick={() => setUsuarioParaResetar(u)}
                          style={{ ...S.btnSec, padding:"5px 10px", fontSize:11.5 }}>
                          Resetar senha
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ fontSize:11.5, color:"#9ca3af", marginTop:8, fontStyle:"italic" }}>
          Edição de usuário (nível, status) virá na próxima entrega.
        </div>
      </div>

      {/* ── Seção: Ações administrativas (perigosas) ── */}
      {!isMasterEmp && (
        <div style={{ ...S.secao, marginBottom:32 }}>
          <div style={S.secTit}>Ações administrativas</div>
          <div style={{ border:"1px solid #fecaca", background:"#fffbfb", borderRadius:10, padding:"16px" }}>
            <div style={{ fontSize:13, color:"#6b7280", lineHeight:1.5, marginBottom:12 }}>
              Excluir definitivamente apaga a empresa, todos os usuários e dados de negócio (clientes, orçamentos, obras). <strong style={{ color:"#991b1b" }}>Não tem como reverter.</strong>
              <br/>
              Pra cortar acesso temporariamente, use "Editar → Inativar" — preserva dados.
            </div>
            <button
              onClick={() => setModalDel(true)}
              style={S.btnDestrutivo}>
              Excluir empresa
            </button>
          </div>
        </div>
      )}

      {modalEdit && (
        <ModalEditarEmpresa
          S={S}
          empresa={data}
          onFechar={() => setModalEdit(false)}
          onSucesso={() => { setModalEdit(false); carregar(); }}
        />
      )}
      {modalDel && (
        <ModalConfirmarExclusaoEmpresa
          S={S}
          empresa={data}
          onFechar={() => setModalDel(false)}
          onConfirmado={onExcluida}
        />
      )}
      {usuarioParaResetar && (
        <ModalConfirmarResetSenha
          S={S}
          usuario={usuarioParaResetar}
          escopo="admin"
          onFechar={() => setUsuarioParaResetar(null)}
          onSucesso={(senha) => {
            setSenhaGerada({ usuario: usuarioParaResetar, senha });
            setUsuarioParaResetar(null);
            carregar(); // refresh pra pegar precisa_trocar_senha=true
          }}
        />
      )}
      {senhaGerada && (
        <ModalExibirNovaSenha
          S={S}
          usuario={senhaGerada.usuario}
          senha={senhaGerada.senha}
          onFechar={() => setSenhaGerada(null)}
        />
      )}
    </div>
  );
}

// Item visual padrão das seções de dados (label em cima, valor em baixo)
function DetalheCampo({ label, valor }) {
  return (
    <div>
      <div style={{ fontSize:10, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.6, marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:13, color:"#111", lineHeight:1.4 }}>{valor}</div>
    </div>
  );
}

// Card pequeno de métrica numérica (Usuários / Clientes / Orçamentos / Obras).
// `carregando` mostra "…" cinza no lugar do valor (evita flash de "0").
function MetricaCard({ label, valor, carregando }) {
  return (
    <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, padding:"14px 16px" }}>
      <div style={{ fontSize:10, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.6, marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:600, color: carregando ? "#d1d5db" : "#111", lineHeight:1, fontVariantNumeric:"tabular-nums" }}>
        {carregando ? "…" : (valor ?? 0)}
      </div>
    </div>
  );
}

// Modal de confirmação de exclusão de empresa.
// Usa padrão GitHub/Stripe: usuário precisa digitar o nome exato da empresa
// pro botão "Excluir definitivamente" ficar habilitado. Evita cliques acidentais.
function ModalConfirmarExclusaoEmpresa({ S, empresa, onFechar, onConfirmado }) {
  const [confirmacao, setConfirmacao] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  // Botão só habilita quando o nome digitado bate exatamente (sem trim — força exatidão)
  const podeExcluir = confirmacao === empresa.nome;
  // Dica visual: usuário começou a digitar mas o texto não bate.
  // Não mostra se input vazio (estado inicial) — só depois que tentou algo.
  const erroVisivel = confirmacao.length > 0 && !podeExcluir;

  async function excluir() {
    if (!podeExcluir) return;
    setExcluindo(true);
    try {
      await api.admin.empresas.delete(empresa.id);
      toast.sucesso("Empresa excluída");
      onConfirmado();
    } catch (e) {
      dialogo.alertar({ titulo: "Erro ao excluir", mensagem: e.message, tipo: "erro" });
      setExcluindo(false);
    }
  }

  // Atenção: não passamos onClick no overlay externo. Modais destrutivos
  // não devem fechar ao clicar fora — risco de cancelar a ação por engano
  // ou perder o que foi digitado. Usuário fecha via botão Cancelar ou ESC.
  return (
    <div style={S.overlay}>
      <div style={S.modalLg} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:16, fontWeight:700, color:"#111", marginBottom:6 }}>
          Excluir empresa definitivamente?
        </div>
        <div style={{ fontSize:13, color:"#6b7280", marginBottom:16, lineHeight:1.5 }}>
          Esta ação <strong style={{ color:"#991b1b" }}>NÃO pode ser desfeita</strong>. Vai apagar permanentemente:
          <ul style={{ margin:"10px 0 0 0", padding:"0 0 0 20px" }}>
            <li>A empresa <strong>{empresa.nome}</strong></li>
            <li>Todos os usuários dela</li>
            <li>Todos os clientes, orçamentos, obras e demais dados</li>
          </ul>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={S.label}>
            Para confirmar, digite o nome da empresa abaixo:
          </label>
          {/* Nome em destaque, FORA do label uppercase (S.label tem textTransform).
              Renderiza com fonte mono pra deixar capitalização inequívoca. */}
          <div style={{
            background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:6,
            padding:"6px 10px", marginBottom:8,
            fontFamily:"'SF Mono',Menlo,Consolas,monospace",
            fontSize:13, color:"#111", fontWeight:600,
            userSelect:"all", // facilita selecionar e copiar
          }}>
            {empresa.nome}
          </div>
          <input
            value={confirmacao}
            onChange={e => setConfirmacao(e.target.value)}
            style={{
              ...S.input,
              fontFamily:"'SF Mono',Menlo,Consolas,monospace",
              borderColor: erroVisivel ? "#fca5a5" : (podeExcluir ? "#86efac" : "#e5e7eb"),
            }}
            autoFocus
            placeholder="Digite o nome exato"
          />
          {erroVisivel && (
            <div style={{ fontSize:11.5, color:"#b91c1c", marginTop:6 }}>
              O texto não corresponde. Atenção a maiúsculas, minúsculas e espaços.
            </div>
          )}
          {podeExcluir && (
            <div style={{ fontSize:11.5, color:"#15803d", marginTop:6 }}>
              ✓ Confere. Pode excluir.
            </div>
          )}
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onFechar} style={S.btnSec} disabled={excluindo}>Cancelar</button>
          <button
            onClick={excluir}
            disabled={!podeExcluir || excluindo}
            style={{
              ...S.btnDestrutivo,
              opacity: (!podeExcluir || excluindo) ? 0.45 : 1,
              cursor: (!podeExcluir || excluindo) ? "not-allowed" : "pointer",
            }}>
            {excluindo ? "Excluindo..." : "Excluir definitivamente"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Confirmar reset de senha ─────────────────────────────
// Pede confirmação antes de gerar nova senha. Não deixa fechar clicando
// fora (proteção contra clique acidental quando estiver com a confirmação
// aberta sobre uma listagem).
//
// Props:
//   usuario:   { id, nome, email, ... }
//   escopo:    "admin" (master) ou "empresa" (admin de empresa)
//   onSucesso: callback(senhaGerada) — recebe a senha em texto puro pra exibir
function ModalConfirmarResetSenha({ S, usuario, escopo = "admin", onFechar, onSucesso }) {
  const [resetando, setResetando] = useState(false);

  async function confirmar() {
    setResetando(true);
    try {
      const r = (escopo === "empresa")
        ? await api.empresa.usuarios.resetSenha(usuario.id)
        : await api.admin.usuarios.resetSenha(usuario.id);
      onSucesso(r.senha_temporaria);
    } catch (e) {
      dialogo.alertar({ titulo: "Erro ao resetar senha", mensagem: e.message, tipo: "erro" });
      setResetando(false);
    }
  }

  return (
    <div style={S.overlay}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:16, fontWeight:700, color:"#111", marginBottom:6 }}>
          Resetar senha?
        </div>
        <div style={{ fontSize:13, color:"#6b7280", marginBottom:16, lineHeight:1.5 }}>
          Será gerada uma nova senha temporária para <strong style={{ color:"#111" }}>{usuario.nome}</strong> ({usuario.email}).
          <br/><br/>
          A senha atual deixará de funcionar imediatamente. <strong>O usuário será obrigado a trocar a senha no próximo login.</strong>
          <br/><br/>
          Você verá a senha gerada apenas uma vez — anote ou copie antes de fechar.
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onFechar} style={S.btnSec} disabled={resetando}>Cancelar</button>
          <button onClick={confirmar} style={S.btn} disabled={resetando}>
            {resetando ? "Gerando..." : "Resetar senha"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Exibir nova senha gerada ─────────────────────────────
// Mostrado depois do reset com sucesso. A senha aparece UMA vez —
// depois de fechar este modal, não tem mais como recuperar.
// Botão "copiar" usa Clipboard API; se falhar (browser antigo / contexto
// sem permissão), o input é selecionável manualmente.
function ModalExibirNovaSenha({ S, usuario, senha, onFechar }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(senha);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      dialogo.alertar({
        titulo: "Não consegui copiar automaticamente",
        mensagem: "Selecione a senha manualmente e copie (Ctrl+C).",
        tipo: "aviso",
      });
    }
  }

  // Atenção: NÃO fecha clicando fora — quase ninguém digita senhas de 12
  // caracteres confiavelmente. Forçar Cancelar/Concluir evita perder a senha
  // por engano antes de copiar.
  return (
    <div style={S.overlay}>
      <div style={S.modalLg} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:16, fontWeight:700, color:"#111", marginBottom:6 }}>
          Nova senha gerada
        </div>
        <div style={{ fontSize:13, color:"#6b7280", marginBottom:18, lineHeight:1.5 }}>
          Senha temporária para <strong style={{ color:"#111" }}>{usuario.nome}</strong> ({usuario.email}).
          Copie agora — depois de fechar este aviso, ela não aparece mais.
        </div>
        <div style={{ marginBottom:18 }}>
          <label style={S.label}>Senha temporária</label>
          <div style={{ display:"flex", gap:8, alignItems:"stretch" }}>
            <input
              readOnly
              value={senha}
              onClick={e => e.target.select()}
              style={{
                ...S.input,
                fontFamily:"'SF Mono',Menlo,Consolas,monospace",
                fontSize:15, fontWeight:600, color:"#111",
                background:"#fafbfc", flex:1, userSelect:"all",
              }}
            />
            <button onClick={copiar}
              style={{
                ...S.btnSec,
                padding:"0 14px", whiteSpace:"nowrap",
                background: copiado ? "#f0fdf4" : "#fff",
                borderColor: copiado ? "#86efac" : "#e5e7eb",
                color: copiado ? "#15803d" : "#374151",
              }}>
              {copiado ? "✓ Copiado" : "Copiar"}
            </button>
          </div>
        </div>
        <div style={{ background:"#fffbeb", border:"1px solid #fde68a", color:"#92400e", borderRadius:8, padding:"10px 12px", fontSize:12.5, marginBottom:16, lineHeight:1.5 }}>
          ⚠ Envie esta senha ao usuário por canal seguro (mensagem direta, não email comum). Ele será obrigado a trocá-la no próximo login.
        </div>
        <div style={{ display:"flex", justifyContent:"flex-end" }}>
          <button onClick={onFechar} style={S.btn}>Concluir</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Nova empresa (dados + admin inicial em 1 passo) ──────
function ModalNovaEmpresa({ S, onFechar, onSucesso }) {
  // Um formulário único em vez de wizard de 2 passos — mais rápido pra
  // quem cria e fácil de validar ambos os lados juntos.
  const [form, setForm] = useState({
    nome: "",
    cnpj_cpf: "",
    plano: "gratuito",
    adminNome: "",
    adminEmail: "",
    adminSenha: "",
  });
  const [salvando, setSalvando] = useState(false);

  function atualizar(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  async function salvar() {
    // Validação client-side básica — backend valida também (defesa em profundidade),
    // mas verificar aqui dá feedback imediato sem round-trip.
    if (!form.nome.trim()) { dialogo.alertar({ titulo: "Informe o nome da empresa", tipo: "aviso" }); return; }
    if (!form.adminNome.trim()) { dialogo.alertar({ titulo: "Informe o nome do administrador", tipo: "aviso" }); return; }
    if (!form.adminEmail.trim()) { dialogo.alertar({ titulo: "Informe o email do administrador", tipo: "aviso" }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail.trim())) {
      dialogo.alertar({ titulo: "Email inválido", tipo: "aviso" }); return;
    }
    if (!form.adminSenha || form.adminSenha.length < 6) {
      dialogo.alertar({ titulo: "Senha muito curta", mensagem: "A senha do administrador deve ter no mínimo 6 caracteres.", tipo: "aviso" }); return;
    }

    setSalvando(true);
    try {
      await api.admin.empresas.save({
        nome: form.nome.trim(),
        cnpj_cpf: form.cnpj_cpf.trim() || null,
        plano: form.plano,
        admin: {
          nome: form.adminNome.trim(),
          email: form.adminEmail.trim().toLowerCase(),
          senha: form.adminSenha,
        },
      });
      toast.sucesso("Empresa criada");
      onSucesso();
    } catch (e) {
      dialogo.alertar({ titulo: "Erro ao criar empresa", mensagem: e.message, tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={S.overlay}>
      <div style={S.modalLg} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:16, fontWeight:700, color:"#111", marginBottom:4 }}>Nova empresa</div>
        <div style={{ fontSize:12, color:"#9ca3af", marginBottom:20 }}>
          Cria a empresa e o primeiro administrador que poderá logar.
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={S.secTit}>Empresa</div>

          <div>
            <label style={S.label}>Nome da empresa</label>
            <input
              style={S.input}
              value={form.nome}
              onChange={e => atualizar("nome", e.target.value)}
              placeholder="Ex: Vicke Associados"
              autoFocus
            />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:12 }}>
            <div>
              <label style={S.label}>CNPJ / CPF</label>
              <input
                style={S.input}
                value={form.cnpj_cpf}
                onChange={e => atualizar("cnpj_cpf", e.target.value)}
                placeholder="00.000.000/0001-00 ou 000.000.000-00"
              />
            </div>
            <div>
              <label style={S.label}>Plano</label>
              <select
                style={{ ...S.input, cursor:"pointer" }}
                value={form.plano}
                onChange={e => atualizar("plano", e.target.value)}
              >
                <option value="gratuito">Gratuito</option>
                <option value="basico">Básico</option>
                <option value="profissional">Profissional</option>
              </select>
            </div>
          </div>

          <div style={{ borderTop:"1px solid #f3f4f6", marginTop:6, paddingTop:14 }}>
            <div style={S.secTit}>Administrador inicial</div>
            <div style={{ fontSize:12, color:"#9ca3af", marginBottom:10, marginTop:-10 }}>
              Esta pessoa vai receber acesso admin e poderá gerenciar usuários da empresa.
            </div>
          </div>

          <div>
            <label style={S.label}>Nome completo</label>
            <input
              style={S.input}
              value={form.adminNome}
              onChange={e => atualizar("adminNome", e.target.value)}
              placeholder="Nome do administrador"
            />
          </div>

          <div>
            <label style={S.label}>Email (login)</label>
            <input
              style={S.input}
              type="email"
              value={form.adminEmail}
              onChange={e => atualizar("adminEmail", e.target.value)}
              placeholder="admin@empresa.com.br"
            />
          </div>

          <div>
            <label style={S.label}>Senha (mínimo 6 caracteres)</label>
            <input
              style={S.input}
              type="password"
              value={form.adminSenha}
              onChange={e => atualizar("adminSenha", e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24 }}>
          <button onClick={onFechar} disabled={salvando} style={S.btnSec}>Cancelar</button>
          <button
            onClick={salvar}
            disabled={salvando}
            style={{ ...S.btn, opacity: salvando ? 0.6 : 1, cursor: salvando ? "not-allowed" : "pointer" }}
          >
            {salvando ? "Criando..." : "Criar empresa"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Editar empresa (só dados básicos + ativar/desativar) ─
// Edição de usuários da empresa fica na aba própria do escritório — aqui
// o master só mexe em metadados (nome, doc, plano) e status.
function ModalEditarEmpresa({ S, empresa, onFechar, onSucesso }) {
  const [form, setForm] = useState({
    nome: empresa.nome || "",
    cnpj_cpf: empresa.cnpj_cpf || "",
    plano: empresa.plano || "gratuito",
    ativo: empresa.ativo !== false,
  });
  const [salvando, setSalvando] = useState(false);

  const isMasterEmp = empresa.id === "emp_master";

  function atualizar(campo, valor) { setForm(f => ({ ...f, [campo]: valor })); }

  async function salvar() {
    if (!form.nome.trim()) { dialogo.alertar({ titulo: "Informe o nome", tipo: "aviso" }); return; }
    setSalvando(true);
    try {
      await api.admin.empresas.update(empresa.id, {
        nome: form.nome.trim(),
        cnpj_cpf: form.cnpj_cpf.trim() || null,
        plano: form.plano,
        ativo: form.ativo,
      });
      toast.sucesso("Empresa atualizada");
      onSucesso();
    } catch (e) {
      dialogo.alertar({ titulo: "Erro ao salvar", mensagem: e.message, tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  }

  async function alternarStatus() {
    // Confirmação extra pra inativar — bloqueia todos usuários da empresa,
    // efeito grande. Reativar é reversível e não precisa confirmar.
    if (form.ativo) {
      const ok = await dialogo.confirmar({
        titulo: "Inativar esta empresa?",
        mensagem: "Todos os usuários dela vão perder acesso imediatamente (próximo request faz logout). Os dados ficam preservados — basta reativar para voltar ao normal.",
        confirmar: "Inativar",
        destrutivo: true,
      });
      if (!ok) return;
    }
    const novoStatus = !form.ativo;
    setForm(f => ({ ...f, ativo: novoStatus }));
    // Salva imediatamente pra o status refletir no banco
    setSalvando(true);
    try {
      await api.admin.empresas.update(empresa.id, {
        nome: form.nome.trim() || empresa.nome,
        cnpj_cpf: (form.cnpj_cpf.trim() || empresa.cnpj_cpf) || null,
        plano: form.plano,
        ativo: novoStatus,
      });
      toast.sucesso(novoStatus ? "Empresa reativada" : "Empresa inativada");
      onSucesso();
    } catch (e) {
      // Reverte visualmente se der erro
      setForm(f => ({ ...f, ativo: !novoStatus }));
      dialogo.alertar({ titulo: "Erro ao alterar status", mensagem: e.message, tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={S.overlay}>
      <div style={S.modalLg} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:"#111" }}>Editar empresa</div>
            <div style={{ fontSize:12, color:"#9ca3af", marginTop:2 }}>ID: {empresa.id}</div>
          </div>
          <span style={form.ativo ? S.badgeAtiva : S.badgeInativa}>
            {form.ativo ? "Ativa" : "Inativa"}
          </span>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={S.label}>Nome da empresa</label>
            <input
              style={S.input}
              value={form.nome}
              onChange={e => atualizar("nome", e.target.value)}
            />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:12 }}>
            <div>
              <label style={S.label}>CNPJ / CPF</label>
              <input
                style={S.input}
                value={form.cnpj_cpf}
                onChange={e => atualizar("cnpj_cpf", e.target.value)}
              />
            </div>
            <div>
              <label style={S.label}>Plano</label>
              <select
                style={{ ...S.input, cursor:"pointer" }}
                value={form.plano}
                onChange={e => atualizar("plano", e.target.value)}
              >
                <option value="gratuito">Gratuito</option>
                <option value="basico">Básico</option>
                <option value="profissional">Profissional</option>
              </select>
            </div>
          </div>

          {/* Stats (readonly) — mostra histórico */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:12, padding:"14px", background:"#fafbfc", border:"1px solid #f3f4f6", borderRadius:8, marginTop:4 }}>
            <div>
              <div style={{ fontSize:11, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.5 }}>Usuários</div>
              <div style={{ fontSize:18, fontWeight:700, color:"#111", marginTop:2 }}>
                {empresa.usuarios_ativos || 0}
                {empresa.usuarios_total > empresa.usuarios_ativos && (
                  <span style={{ fontSize:12, color:"#9ca3af", fontWeight:400, marginLeft:4 }}>/ {empresa.usuarios_total}</span>
                )}
              </div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.5 }}>Orçamentos</div>
              <div style={{ fontSize:18, fontWeight:700, color:"#111", marginTop:2 }}>{empresa.orcamentos_total || 0}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.5 }}>Criada em</div>
              <div style={{ fontSize:13, fontWeight:600, color:"#111", marginTop:4 }}>
                {empresa.criado_em ? new Date(empresa.criado_em).toLocaleDateString("pt-BR") : "—"}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display:"flex", gap:10, justifyContent:"space-between", marginTop:24, flexWrap:"wrap" }}>
          <button
            onClick={alternarStatus}
            disabled={salvando || isMasterEmp}
            title={isMasterEmp ? "Empresa master não pode ser inativada" : ""}
            style={{
              ...(form.ativo ? S.btnDestrutivo : S.btn),
              opacity: (salvando || isMasterEmp) ? 0.5 : 1,
              cursor: (salvando || isMasterEmp) ? "not-allowed" : "pointer",
              background: form.ativo ? "#dc2626" : "#16a34a",
            }}
          >
            {form.ativo ? "Inativar empresa" : "Reativar empresa"}
          </button>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onFechar} disabled={salvando} style={S.btnSec}>Fechar</button>
            <button
              onClick={salvar}
              disabled={salvando}
              style={{ ...S.btn, opacity: salvando ? 0.6 : 1, cursor: salvando ? "not-allowed" : "pointer" }}
            >
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAINEL USUÁRIOS MASTER — listagem + criar + excluir
// ═══════════════════════════════════════════════════════════════
// Limite de 3 masters no sistema (regra de segurança, validada no backend).
// Edição de dados fica por enquanto fora do escopo — pra trocar senha/nome
// de um master, exclua e recrie. Mantém simples.

function PainelUsuariosMaster({ S, usuarioLogado }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [erro, setErro]         = useState(null);
  const [modalNovo, setModalNovo] = useState(false);

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const todos = await api.admin.usuarios.list();
      // Filtra só masters (endpoint devolve todos)
      const masters = (todos || []).filter(u => u.perfil === "master");
      setUsuarios(masters);
    } catch (e) {
      setErro({ message: e.message || "Falha ao carregar usuários", code: e.code, status: e.status });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function excluirUsuario(u) {
    if (u.id === usuarioLogado?.id) {
      dialogo.alertar({ titulo: "Ação não permitida", mensagem: "Você não pode excluir a si mesmo.", tipo: "aviso" });
      return;
    }
    const ok = await dialogo.confirmar({
      titulo: `Excluir master "${u.nome}"?`,
      mensagem: "Esta ação não pode ser desfeita. O usuário perderá acesso imediatamente.",
      confirmar: "Excluir",
      destrutivo: true,
    });
    if (!ok) return;
    try {
      await api.admin.usuarios.delete(u.id);
      toast.sucesso("Usuário master excluído");
      carregar();
    } catch (e) {
      dialogo.alertar({ titulo: "Erro ao excluir", mensagem: e.message, tipo: "erro" });
    }
  }

  const masterAtivos = usuarios.filter(u => u.ativo).length;
  const limite = 3;
  const noLimite = masterAtivos >= limite;

  return (
    <div style={S.body}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:600, color:"#111" }}>Usuários master</div>
          <div style={{ fontSize:12, color:"#9ca3af", marginTop:2 }}>
            {loading ? "Carregando..." : `${masterAtivos} de ${limite} masters ativos · acesso total ao SaaS`}
          </div>
        </div>
        <button
          style={{ ...S.btn, opacity: noLimite ? 0.5 : 1, cursor: noLimite ? "not-allowed" : "pointer" }}
          onClick={() => !noLimite && setModalNovo(true)}
          disabled={noLimite}
          title={noLimite ? "Limite de 3 masters atingido" : ""}
        >
          + Novo master
        </button>
      </div>

      {erro && <ErroAcesso erro={erro} S={S} />}


      {noLimite && (
        <div style={{ fontSize:12.5, color:"#b45309", background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, padding:"10px 14px", marginBottom:16 }}>
          Limite de {limite} usuários master atingido. Exclua um existente para criar outro.
        </div>
      )}

      {!loading && usuarios.length === 0 && !erro && (
        <div style={S.vazio}>Nenhum usuário master além de você. Use + Novo master para adicionar sócios.</div>
      )}

      {!loading && usuarios.length > 0 && (
        <div style={{ border:"1px solid #e5e7eb", borderRadius:10, overflow:"hidden" }}>
          <table style={S.tabela}>
            <thead>
              <tr>
                <th style={S.th}>Nome</th>
                <th style={S.th}>Email</th>
                <th style={S.th}>Criado em</th>
                <th style={S.th}>Status</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => {
                const ehVoce = u.id === usuarioLogado?.id;
                return (
                  <tr key={u.id}>
                    <td style={S.td}>
                      <div style={{ fontWeight:600, color:"#111" }}>
                        {u.nome}
                        {ehVoce && (
                          <span style={{ fontSize:10, fontWeight:600, color:"#6b7280", background:"#f3f4f6", borderRadius:3, padding:"2px 6px", marginLeft:8, letterSpacing:0.3 }}>VOCÊ</span>
                        )}
                      </div>
                    </td>
                    <td style={{ ...S.td, color:"#6b7280" }}>{u.email}</td>
                    <td style={{ ...S.td, color:"#6b7280" }}>
                      {u.criado_em ? new Date(u.criado_em).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td style={S.td}>
                      <span style={u.ativo ? S.badgeAtiva : S.badgeInativa}>
                        {u.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td style={{ ...S.td, textAlign:"right" }}>
                      {!ehVoce && (
                        <button
                          style={{ ...S.btnSec, color:"#dc2626", borderColor:"#fecaca", padding:"5px 12px", fontSize:12 }}
                          onClick={() => excluirUsuario(u)}
                        >
                          Excluir
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalNovo && (
        <ModalNovoMaster
          S={S}
          onFechar={() => setModalNovo(false)}
          onSucesso={() => { setModalNovo(false); carregar(); }}
        />
      )}
    </div>
  );
}

// ── Modal: Novo usuário master ──────────────────────────────────
function ModalNovoMaster({ S, onFechar, onSucesso }) {
  const [form, setForm] = useState({ nome: "", email: "", senha: "" });
  const [salvando, setSalvando] = useState(false);

  function atualizar(campo, valor) { setForm(f => ({ ...f, [campo]: valor })); }

  async function salvar() {
    if (!form.nome.trim()) { dialogo.alertar({ titulo: "Informe o nome", tipo: "aviso" }); return; }
    if (!form.email.trim()) { dialogo.alertar({ titulo: "Informe o email", tipo: "aviso" }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      dialogo.alertar({ titulo: "Email inválido", tipo: "aviso" }); return;
    }
    if (!form.senha || form.senha.length < 6) {
      dialogo.alertar({ titulo: "Senha muito curta", mensagem: "Mínimo 6 caracteres.", tipo: "aviso" }); return;
    }

    setSalvando(true);
    try {
      // Master pertence à empresa master (emp_master) — é onde ficam contas que
      // não são clientes do SaaS, apenas administradores globais.
      await api.admin.usuarios.save({
        empresa_id: "emp_master",
        nome: form.nome.trim(),
        email: form.email.trim().toLowerCase(),
        senha: form.senha,
        perfil: "master",
        nivel: "admin",
      });
      toast.sucesso("Usuário master criado");
      onSucesso();
    } catch (e) {
      dialogo.alertar({ titulo: "Erro ao criar master", mensagem: e.message, tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={S.overlay}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:16, fontWeight:700, color:"#111", marginBottom:4 }}>Novo usuário master</div>
        <div style={{ fontSize:12, color:"#9ca3af", marginBottom:20 }}>
          Masters têm acesso total ao SaaS, incluindo todas as empresas cliente.
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={S.label}>Nome completo</label>
            <input
              style={S.input}
              value={form.nome}
              onChange={e => atualizar("nome", e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label style={S.label}>Email (login)</label>
            <input
              style={S.input}
              type="email"
              value={form.email}
              onChange={e => atualizar("email", e.target.value)}
            />
          </div>
          <div>
            <label style={S.label}>Senha (mínimo 6 caracteres)</label>
            <input
              style={S.input}
              type="password"
              value={form.senha}
              onChange={e => atualizar("senha", e.target.value)}
            />
          </div>
        </div>

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24 }}>
          <button onClick={onFechar} disabled={salvando} style={S.btnSec}>Cancelar</button>
          <button
            onClick={salvar}
            disabled={salvando}
            style={{ ...S.btn, opacity: salvando ? 0.6 : 1, cursor: salvando ? "not-allowed" : "pointer" }}
          >
            {salvando ? "Criando..." : "Criar master"}
          </button>
        </div>
      </div>
    </div>
  );
}
