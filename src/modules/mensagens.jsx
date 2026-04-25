// ═══════════════════════════════════════════════════════════════
// MENSAGENS — Caixa de email do Time VICKE (Sprint 3 Bloco E)
// ═══════════════════════════════════════════════════════════════
// Master vê todas as mensagens recebidas em qualquer endereço
// @vicke.com.br (time@, contato@, suporte@, etc).
// Webhook do Resend salva tudo na tabela mensagem_recebida; aqui
// listamos, lemos detalhe e marcamos como lida/excluímos.
//
// Layout 2 colunas estilo email client:
//   - Esquerda: lista de threads (remetente, assunto, preview, data)
//   - Direita: detalhe da mensagem selecionada (HTML renderizado)
//
// Backend endpoints:
//   GET    /admin/mensagens               — lista paginada
//   GET    /admin/mensagens/:id           — detalhe completo
//   PUT    /admin/mensagens/:id/lida      — marca como lida
//   PUT    /admin/mensagens/:id/nao-lida  — marca como não lida
//   DELETE /admin/mensagens/:id           — apaga

function Mensagens({ usuario }) {
  const [mensagens, setMensagens] = useState([]);
  const [naoLidas, setNaoLidas]   = useState(0);
  const [loading, setLoading]     = useState(true);
  const [erro, setErro]           = useState(null);
  const [filtro, setFiltro]       = useState("todas"); // "todas" | "nao-lidas"
  // Mensagem selecionada (objeto com body completo carregado sob demanda)
  const [selecionada, setSelecionada] = useState(null);
  const [carregandoDet, setCarregandoDet] = useState(false);

  // Carrega lista quando filtro muda ou ao montar
  useEffect(() => {
    carregarLista();
    // Polling a cada 30s pra detectar novas mensagens.
    // Não é tempo real (precisaria SSE/WebSocket), mas pra volume baixo
    // de email do Master é suficiente e simples.
    const t = setInterval(carregarLista, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function carregarLista() {
    try {
      const params = filtro === "nao-lidas" ? "?filtro=nao-lidas" : "";
      const res = await api.get(`/admin/mensagens${params}`);
      if (res.ok) {
        setMensagens(res.data.mensagens || []);
        setNaoLidas(res.data.nao_lidas || 0);
      } else {
        setErro(res.error || "Erro ao carregar");
      }
    } catch (e) {
      setErro(e.message);
    }
    setLoading(false);
  }

  async function abrirMensagem(msg) {
    // Otimista: já mostra os dados que temos (preview, etc)
    setSelecionada(msg);
    setCarregandoDet(true);
    try {
      const res = await api.get(`/admin/mensagens/${msg.id}`);
      if (res.ok) {
        setSelecionada(res.data);
        // Se ainda não lida, marca como lida automaticamente ao abrir
        if (!res.data.lida) {
          await api.put(`/admin/mensagens/${msg.id}/lida`, {});
          // Atualiza lista local sem refetch
          setMensagens(ms => ms.map(m => m.id === msg.id ? { ...m, lida: true } : m));
          setNaoLidas(n => Math.max(0, n - 1));
        }
      }
    } catch (e) {
      console.error("Erro ao abrir mensagem:", e);
    }
    setCarregandoDet(false);
  }

  async function marcarNaoLida(msg) {
    try {
      await api.put(`/admin/mensagens/${msg.id}/nao-lida`, {});
      setMensagens(ms => ms.map(m => m.id === msg.id ? { ...m, lida: false } : m));
      setNaoLidas(n => n + 1);
      if (selecionada?.id === msg.id) {
        setSelecionada({ ...selecionada, lida: false });
      }
    } catch (e) {
      toast.erro("Erro ao marcar como não lida");
    }
  }

  async function excluirMensagem(msg) {
    const ok = await dialogo.confirmar({
      titulo: "Excluir mensagem?",
      mensagem: `Esta ação não pode ser desfeita. A mensagem de "${msg.de}" será apagada permanentemente.`,
      confirmar: "Excluir",
      destrutivo: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/mensagens/${msg.id}`);
      setMensagens(ms => ms.filter(m => m.id !== msg.id));
      if (selecionada?.id === msg.id) setSelecionada(null);
      if (!msg.lida) setNaoLidas(n => Math.max(0, n - 1));
      toast.sucesso("Mensagem excluída");
    } catch (e) {
      toast.erro("Erro ao excluir");
    }
  }

  // Helper: parser do "from" do Resend — vem como "Nome <email@dominio>"
  // Extrai nome (se houver) e email separados pra exibição.
  function parsearRemetente(de) {
    if (!de) return { nome: "", email: "" };
    const match = de.match(/^(.+?)\s*<(.+?)>$/);
    if (match) return { nome: match[1].trim().replace(/^"|"$/g, ""), email: match[2].trim() };
    return { nome: "", email: de.trim() };
  }

  function formatarData(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const agora = new Date();
    const ms = agora - d;
    const min = Math.floor(ms / 60000);
    const hr = Math.floor(ms / 3600000);
    const dias = Math.floor(ms / 86400000);
    if (min < 1) return "agora";
    if (min < 60) return `${min}m`;
    if (hr < 24) return `${hr}h`;
    if (dias < 7) return `${dias}d`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }

  const S = {
    wrap: { fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", height:"100vh", display:"flex", flexDirection:"column", background:"#fff" },
    header: { borderBottom:"1px solid #e5e7eb", padding:"20px 32px", display:"flex", justifyContent:"space-between", alignItems:"center" },
    titulo: { fontSize:18, fontWeight:700, color:"#111", margin:0 },
    sub: { fontSize:13, color:"#9ca3af", marginTop:3 },
    filtros: { display:"flex", gap:4, padding:"12px 32px", borderBottom:"1px solid #f3f4f6" },
    btnFiltro: (ativo) => ({
      background: ativo ? "#f3f4f6" : "transparent",
      color: ativo ? "#111" : "#6b7280",
      border: "none",
      borderRadius: 6,
      padding: "6px 12px",
      fontSize: 12.5,
      fontWeight: ativo ? 600 : 400,
      cursor: "pointer",
      fontFamily: "inherit",
    }),
    body: { flex:1, display:"flex", overflow:"hidden" },
    listaCol: { width:380, minWidth:380, borderRight:"1px solid #e5e7eb", overflowY:"auto", background:"#fff" },
    detalheCol: { flex:1, overflowY:"auto", background:"#fafbfc" },
    item: (selecionada, lida) => ({
      padding:"14px 18px",
      borderBottom:"1px solid #f3f4f6",
      cursor:"pointer",
      background: selecionada ? "#f9fafb" : "#fff",
      borderLeft: selecionada ? "3px solid #111" : "3px solid transparent",
      transition: "background 0.1s",
      paddingLeft: selecionada ? 15 : 18,
    }),
    nome: (lida) => ({ fontSize:13, fontWeight: lida ? 400 : 700, color:"#111", marginBottom:2, display:"flex", justifyContent:"space-between", alignItems:"center" }),
    assunto: (lida) => ({ fontSize:13, fontWeight: lida ? 400 : 600, color: lida ? "#374151" : "#111", marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }),
    preview: { fontSize:12, color:"#9ca3af", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
    data: { fontSize:11, color:"#9ca3af", fontWeight:400 },
    pontoNaoLida: { display:"inline-block", width:8, height:8, background:"#3b82f6", borderRadius:"50%", marginRight:8, flexShrink:0 },
    vazio: { fontSize:13, color:"#9ca3af", textAlign:"center", padding:"60px 20px" },

    detHeader: { padding:"24px 32px", borderBottom:"1px solid #e5e7eb", background:"#fff" },
    detAssunto: { fontSize:18, fontWeight:700, color:"#111", marginBottom:12 },
    detLinha: { fontSize:13, color:"#6b7280", marginBottom:4 },
    detLinhaForte: { fontSize:14, color:"#111", fontWeight:500 },
    detAcoes: { display:"flex", gap:8, marginTop:16 },
    detBody: { padding:"32px", background:"#fff", margin:"24px 32px", borderRadius:8, border:"1px solid #f3f4f6" },
    detHtml: { fontSize:14, color:"#111", lineHeight:1.6 },
    btnAcao: { background:"#fff", color:"#374151", border:"1px solid #e5e7eb", borderRadius:7, padding:"6px 12px", fontSize:12.5, cursor:"pointer", fontFamily:"inherit", display:"inline-flex", alignItems:"center", gap:6 },
    btnAcaoDestrutiva: { background:"#fff", color:"#dc2626", border:"1px solid #fecaca", borderRadius:7, padding:"6px 12px", fontSize:12.5, cursor:"pointer", fontFamily:"inherit", display:"inline-flex", alignItems:"center", gap:6 },
    badge: { display:"inline-block", fontSize:11, fontWeight:600, color:"#7c3aed", background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:10, padding:"2px 8px", marginLeft:8 },
  };

  if (loading) {
    return (
      <div style={S.wrap}>
        <div style={{ ...S.vazio, paddingTop:120 }}>Carregando mensagens…</div>
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <div>
          <div style={{ display:"flex", alignItems:"center" }}>
            <h1 style={S.titulo}>Mensagens</h1>
            {naoLidas > 0 && <span style={S.badge}>{naoLidas} não {naoLidas === 1 ? "lida" : "lidas"}</span>}
          </div>
          <div style={S.sub}>Caixa de entrada do time VICKE — emails recebidos em @vicke.com.br</div>
        </div>
        <button onClick={carregarLista} style={S.btnAcao}>↻ Atualizar</button>
      </div>

      <div style={S.filtros}>
        <button style={S.btnFiltro(filtro === "todas")} onClick={() => setFiltro("todas")}>
          Todas
        </button>
        <button style={S.btnFiltro(filtro === "nao-lidas")} onClick={() => setFiltro("nao-lidas")}>
          Não lidas{naoLidas > 0 && ` (${naoLidas})`}
        </button>
      </div>

      <div style={S.body}>
        <div style={S.listaCol}>
          {mensagens.length === 0 ? (
            <div style={S.vazio}>
              {filtro === "nao-lidas"
                ? "Nenhuma mensagem não lida."
                : "Nenhuma mensagem ainda. Os emails enviados para qualquer endereço @vicke.com.br aparecerão aqui."}
            </div>
          ) : (
            mensagens.map(m => {
              const { nome, email } = parsearRemetente(m.de);
              const ehSelecionada = selecionada?.id === m.id;
              return (
                <div
                  key={m.id}
                  style={S.item(ehSelecionada, m.lida)}
                  onClick={() => abrirMensagem(m)}
                  onMouseEnter={e => { if (!ehSelecionada) e.currentTarget.style.background = "#fafbfc"; }}
                  onMouseLeave={e => { if (!ehSelecionada) e.currentTarget.style.background = "#fff"; }}
                >
                  <div style={S.nome(m.lida)}>
                    <span style={{ display:"flex", alignItems:"center", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {!m.lida && <span style={S.pontoNaoLida}></span>}
                      {nome || email}
                    </span>
                    <span style={S.data}>{formatarData(m.recebido_em)}</span>
                  </div>
                  <div style={S.assunto(m.lida)}>{m.assunto || "(sem assunto)"}</div>
                  {m.preview && <div style={S.preview}>{m.preview}</div>}
                </div>
              );
            })
          )}
        </div>

        <div style={S.detalheCol}>
          {!selecionada ? (
            <div style={{ ...S.vazio, paddingTop:120 }}>
              Selecione uma mensagem para visualizar
            </div>
          ) : carregandoDet && !selecionada.body_html && !selecionada.body_text ? (
            <div style={{ ...S.vazio, paddingTop:120 }}>Carregando…</div>
          ) : (
            <>
              <div style={S.detHeader}>
                <div style={S.detAssunto}>{selecionada.assunto || "(sem assunto)"}</div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={S.detLinhaForte}>{selecionada.de}</div>
                    <div style={S.detLinha}>
                      Para: {Array.isArray(selecionada.para) ? selecionada.para.join(", ") : (selecionada.para || "")}
                    </div>
                    <div style={S.detLinha}>
                      {new Date(selecionada.recebido_em).toLocaleString("pt-BR", {
                        day:"2-digit", month:"long", year:"numeric",
                        hour:"2-digit", minute:"2-digit",
                      })}
                    </div>
                  </div>
                </div>
                <div style={S.detAcoes}>
                  {selecionada.lida ? (
                    <button style={S.btnAcao} onClick={() => marcarNaoLida(selecionada)}>
                      ↩ Marcar como não lida
                    </button>
                  ) : null}
                  <button style={S.btnAcaoDestrutiva} onClick={() => excluirMensagem(selecionada)}>
                    🗑 Excluir
                  </button>
                </div>
              </div>
              <div style={S.detBody}>
                {selecionada.body_html ? (
                  // HTML renderizado direto. ATENÇÃO: aqui há risco teórico de XSS
                  // se o atacante enviar email com script inline. No futuro vale
                  // adicionar sanitização (DOMPurify ou similar). Pra MVP do
                  // Master só, com poucos remetentes confiáveis, aceitável.
                  <div
                    style={S.detHtml}
                    dangerouslySetInnerHTML={{ __html: selecionada.body_html }}
                  />
                ) : selecionada.body_text ? (
                  <pre style={{ ...S.detHtml, whiteSpace:"pre-wrap", fontFamily:"inherit", margin:0 }}>
                    {selecionada.body_text}
                  </pre>
                ) : (
                  <div style={{ color:"#9ca3af", fontStyle:"italic", fontSize:13 }}>
                    Conteúdo ainda sendo processado pelo servidor… Recarregue em alguns segundos.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
