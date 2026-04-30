// ═══════════════════════════════════════════════════════════════
// DASHBOARD MASTER
// ═══════════════════════════════════════════════════════════════
// Home do usuário master. Faz uma chamada a /admin/dashboard que devolve:
//   - counts: empresas (ativas/total), mensagens não-lidas, signups 7d, logins 24h, logins_falha_24h
//   - feed: últimas 15 entradas do audit_log com nome da empresa
//
// Renderiza:
//   - 4 cards de números no topo
//   - Feed de atividade recente
//   - 4 cards de navegação (mantidos da versão antiga do HomeMenu)
//
// Refresh: a cada 60s automaticamente quando aba está visível, via setInterval.

// ═══════════════════════════════════════════════════════════════
// ÍCONES OUTLINE (estilo Lucide) — usados no Master Dashboard,
// drill-in de empresas, modais de senha. Paleta neutra preto/cinza.
// Tamanho e cor configuráveis. Não importa biblioteca externa pra evitar
// peso de bundle desnecessário.
// ═══════════════════════════════════════════════════════════════
function IconeMaster({ nome, tamanho = 18, cor = "currentColor" }) {
  const props = {
    width: tamanho, height: tamanho,
    viewBox: "0 0 24 24", fill: "none",
    stroke: cor, strokeWidth: "1.8",
    strokeLinecap: "round", strokeLinejoin: "round",
  };
  switch (nome) {
    case "mensagens":
      // Caixa de email (estilo Lucide "inbox")
      return (<svg {...props}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>);
    case "feedback":
      // Balão de chat outline
      return (<svg {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>);
    case "empresas":
      // Building outline
      return (<svg {...props}><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="22" x2="9" y2="18"/><line x1="15" y1="22" x2="15" y2="18"/><line x1="9" y1="6" x2="15" y2="6"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="15" y2="14"/></svg>);
    case "usuarios":
      // Users outline (3 pessoas)
      return (<svg {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>);
    case "manutencao":
      // Settings/wrench outline
      return (<svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>);
    case "cub":
      // Trending up — indica índice de custos
      return (<svg {...props}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>);
    case "editar":
      return (<svg {...props}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>);
    case "trash":
      return (<svg {...props}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>);
    case "key":
      // Chave outline (resetar senha)
      return (<svg {...props}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>);
    case "back":
      return (<svg {...props}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>);
    case "plus":
      return (<svg {...props}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>);
    case "check":
      return (<svg {...props}><polyline points="20 6 9 17 4 12"/></svg>);
    case "copy":
      return (<svg {...props}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>);
    // ── Ícones da sidebar do escritório (perfil cliente) ───────────
    case "home":
      // Casa outline
      return (<svg {...props}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>);
    case "painel":
      // Grid 2x2 (dashboard)
      return (<svg {...props}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>);
    case "clientes":
      // 2 pessoas (mais sutil que users de 3)
      return (<svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>);
    case "projetos":
      // Pasta (folder)
      return (<svg {...props}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>);
    case "projetos-orcamentos":
      // Documento com $
      return (<svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6M9 15h6"/></svg>);
    case "projetos-andamento":
      // Clipboard com check (em andamento)
      return (<svg {...props}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>);
    case "obras":
      // Casa com martelo / construção
      return (<svg {...props}><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01"/></svg>);
    case "escritorio":
      // Engrenagem / settings outline (mesmo ícone que manutenção mas menor uso)
      return (<svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>);
    case "orcamento":
      // Calculadora outline — usado na aba "Orçamento" da seção Configuração
      return (<svg {...props}><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="8" y2="18"/><line x1="12" y1="18" x2="12" y2="18"/><line x1="16" y1="18" x2="16" y2="18"/></svg>);
    default:
      return null;
  }
}

function DashboardMaster({ data, setAba, tentarTrocar }) {
  const [dash, setDash]     = useState(null);
  const [loading, setLoad]  = useState(true);
  const [erro, setErro]     = useState(null);

  // Detecta mobile pra ajustes de layout (padding, grids).
  const [isMobile, setIsMobile] = useState(() => {
    try { return window.innerWidth < 768; } catch { return false; }
  });
  useEffect(() => {
    function onResize() { try { setIsMobile(window.innerWidth < 768); } catch {} }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Carrega dashboard. Função separada pra reutilizar no refresh manual.
  async function carregar() {
    try {
      const d = await api.admin.dashboard();
      setDash(d);
      setErro(null);
    } catch(e) {
      setErro(e.message || "Falha ao carregar dashboard");
    } finally {
      setLoad(false);
    }
  }

  useEffect(() => {
    carregar();
    // Auto-refresh a cada 60s. Pausado quando aba não está visível
    // pra economizar bateria/banda.
    const id = setInterval(() => {
      if (document.visibilityState === "visible") carregar();
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Cards de navegação (mesmos do HomeMenu antigo). Mantidos pra preservar
  // o atalho de 1-clique pras subabas mais usadas.
  // Cada item tem um identificador de ícone — renderizado por IconeMaster
  // (definido logo abaixo) com SVG outline estilo Lucide, cor neutra.
  const modulos = [
    { k:"mensagens",              icon:"mensagens",  label:"Mensagens",       desc:"Caixa do time VICKE" },
    { k:"admin:feedback",         icon:"feedback",   label:"Feedback",        desc:"Sugestões e bugs dos clientes" },
    { k:"admin:empresas",         icon:"empresas",   label:"Empresas",        desc:"Gerenciar empresas cadastradas" },
    { k:"admin:usuarios-master",  icon:"usuarios",   label:"Usuários Master", desc:"Acessos da equipe Vicke" },
    { k:"admin:manutencao",       icon:"manutencao", label:"Manutenção",      desc:"Jobs e operações do sistema" },
    { k:"admin:cub",              icon:"cub",        label:"CUB",             desc:"Custo Unitário Básico — atualização mensal" },
  ];

  return (
    <div style={{ padding: isMobile ? "16px 14px 60px" : "32px 32px 60px", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", maxWidth:1100, margin:"0 auto" }}>
      <div style={{ marginBottom: isMobile ? 18 : 28 }}>
        <div style={{ fontSize: isMobile ? 20 : 24, fontWeight:600, color:"#111", letterSpacing:-0.3 }}>Dashboard</div>
        <div style={{ fontSize:13, color:"#9ca3af", marginTop:4 }}>Visão geral da plataforma VICKE</div>
      </div>

      {erro && (
        <div style={{ background:"#fef2f2", border:"1px solid #fecaca", color:"#991b1b", borderRadius:9, padding:"10px 14px", fontSize:13, marginBottom:20 }}>
          Erro ao carregar dashboard: {erro}
        </div>
      )}

      {/* ── 4 Cards de números ── */}
      <DashboardCards counts={dash?.counts} loading={loading} setAba={setAba} tentarTrocar={tentarTrocar} isMobile={isMobile} />

      {/* ── Navegação (acesso rápido sempre acima da dobra) ──
          Movido pra cima do feed: convenção SaaS (Linear/Vercel/Stripe) é
          navegação primária no topo, atividade/feed embaixo. Com volume de
          empresas crescendo, feed pode esticar muito — não pode empurrar
          os cards de navegação pra fora da tela. */}
      <div style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:12, marginTop:8 }}>Acesso rápido</div>
      {/* Mobile: 2 colunas fixas (cabe 2 cards de ~150px em 375px de viewport).
          Desktop: auto-fill com mínimo 200px (3-6 colunas conforme largura). */}
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(200px, 1fr))", gap: isMobile ? 8 : 12, marginBottom:32 }}>
        {modulos.map(m => (
          <button key={m.k} onClick={() => { const go = () => setAba(m.k); if (tentarTrocar) tentarTrocar(go); else go(); }}
            style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding: isMobile ? "12px 10px" : "16px", textAlign:"left", cursor:"pointer", fontFamily:"inherit" }}
            onMouseEnter={e => { if (!isMobile) e.currentTarget.style.borderColor="#111"; }}
            onMouseLeave={e => { if (!isMobile) e.currentTarget.style.borderColor="#e5e7eb"; }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
              <IconeMaster nome={m.icon} tamanho={isMobile ? 16 : 18} cor="#374151" />
              <div style={{ fontSize: isMobile ? 12 : 13, fontWeight:600, color:"#111" }}>{m.label}</div>
            </div>
            {!isMobile && (
              <div style={{ fontSize:11.5, color:"#9ca3af", marginLeft:28 }}>{m.desc}</div>
            )}
          </button>
        ))}
      </div>

      {/* ── Feed de atividade recente ── */}
      <DashboardFeed feed={dash?.feed} loading={loading} isMobile={isMobile} />
    </div>
  );
}

// 4 Cards de números. Cada card é clicável quando faz sentido (ex: mensagens
// não-lidas leva pra caixa; signups leva pra empresas). Card de logins não tem
// destino útil no momento, fica não-clicável.
function DashboardCards({ counts, loading, setAba, tentarTrocar, isMobile }) {
  const c = counts || {};
  const goto = (aba) => { const fn = () => setAba(aba); if (tentarTrocar) tentarTrocar(fn); else fn(); };

  const items = [
    {
      label: "Empresas ativas",
      value: loading ? "…" : `${c.empresas_ativas || 0}`,
      sub:   loading ? "" : `de ${c.empresas_total || 0} totais`,
      onClick: () => goto("admin:empresas"),
    },
    {
      label: "Mensagens não-lidas",
      value: loading ? "…" : `${c.mensagens_nao_lidas || 0}`,
      sub:   "caixa do time VICKE",
      onClick: () => goto("mensagens"),
      destaque: !loading && (c.mensagens_nao_lidas || 0) > 0,
    },
    {
      label: "Feedback abertos",
      value: loading ? "…" : `${c.feedback_abertos || 0}`,
      sub:   "sugestões/bugs por revisar",
      onClick: () => goto("admin:feedback"),
      destaque: !loading && (c.feedback_abertos || 0) > 0,
    },
    {
      label: "Signups (7 dias)",
      value: loading ? "…" : `${c.signups_7d || 0}`,
      sub:   "novas empresas",
    },
    {
      label: "Logins (24h)",
      value: loading ? "…" : `${c.logins_24h || 0}`,
      sub:   loading ? "" : (c.logins_falha_24h > 0 ? `${c.logins_falha_24h} tentativa(s) falha(s)` : "atividade nas últimas 24h"),
      destaque: !loading && (c.logins_falha_24h || 0) >= 5,
    },
  ];

  return (
    // Mobile: 2 colunas fixas (5 cards => 2-2-1, pode ser feio mas é menos pior
    // que tentar empilhar tudo em 1 coluna gigante).
    // Desktop: auto-fit com mínimo 200px (5 cards lado a lado em telas largas).
    <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(200px, 1fr))", gap: isMobile ? 8 : 12, marginBottom: isMobile ? 20 : 28 }}>
      {items.map((it, i) => (
        <div
          key={i}
          onClick={it.onClick}
          style={{
            background:"#fff",
            border: it.destaque ? "1px solid #f59e0b" : "1px solid #e5e7eb",
            borderRadius:12, padding: isMobile ? "12px 12px" : "16px 18px",
            cursor: it.onClick ? "pointer" : "default",
            transition:"border-color 0.12s",
          }}
          onMouseEnter={e => { if (it.onClick && !isMobile) e.currentTarget.style.borderColor = "#111"; }}
          onMouseLeave={e => { if (!isMobile) e.currentTarget.style.borderColor = it.destaque ? "#f59e0b" : "#e5e7eb"; }}>
          <div style={{ fontSize: isMobile ? 10 : 11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.6, marginBottom: isMobile ? 6 : 8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {it.label}
          </div>
          <div style={{ fontSize: isMobile ? 22 : 28, fontWeight:600, color:"#111", lineHeight:1.1, fontVariantNumeric:"tabular-nums" }}>
            {it.value}
          </div>
          {it.sub && (
            <div style={{ fontSize: isMobile ? 10.5 : 11.5, color:"#9ca3af", marginTop:4, lineHeight:1.3 }}>{it.sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// Feed de atividade recente — lista simples, focada em legibilidade.
// Cada linha: ícone (cor por tipo) + descrição + tempo relativo.
//
// maxHeight + overflowY:auto: feed pode crescer indefinidamente conforme
// audit_log acumula. Scroll interno evita empurrar o resto da página.
// 480px caem ~9-10 linhas de feed comodamente, suficiente pra ver atividade
// recente sem sobrecarregar.
function DashboardFeed({ feed, loading, isMobile }) {
  return (
    <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding: isMobile ? "12px 14px" : "16px 18px" }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.6, marginBottom:14 }}>
        Atividade recente
      </div>
      {loading && <div style={{ fontSize:13, color:"#9ca3af" }}>Carregando…</div>}
      {!loading && (!feed || feed.length === 0) && (
        <div style={{ fontSize:13, color:"#9ca3af", padding:"12px 0" }}>
          Nenhuma atividade ainda.
        </div>
      )}
      {!loading && feed && feed.length > 0 && (
        <div style={{
          display:"flex", flexDirection:"column",
          // Mobile: maxHeight menor (320px ~ 6 linhas) pra não engolir tela toda.
          // Desktop: 480px ~ 9 linhas — espaço suficiente sem sobrecarregar.
          maxHeight: isMobile ? 320 : 480, overflowY:"auto",
          // Compensação visual pra scroll: padding direito pra scrollbar
          // não colar na borda do conteúdo.
          paddingRight:6, marginRight:-6,
        }}>
          {feed.map((ev, i) => (
            <FeedItem key={ev.id} ev={ev} primeiro={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

// Linha do feed. Decora o evento com ícone/cor baseado em `acao`.
function FeedItem({ ev, primeiro }) {
  const meta = decorarEvento(ev);
  return (
    <div style={{
      display:"flex", alignItems:"flex-start", gap:12,
      padding:"10px 0",
      borderTop: primeiro ? "none" : "1px solid #f3f4f6",
    }}>
      <div style={{
        flexShrink:0, width:8, height:8, borderRadius:"50%",
        background: meta.cor, marginTop:6,
      }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, color:"#111", lineHeight:1.4 }}>
          {meta.descricao}
        </div>
        <div style={{ fontSize:11.5, color:"#9ca3af", marginTop:2 }}>
          {ev.empresa_nome && ev.empresa_nome !== "—" ? `${ev.empresa_nome} · ` : ""}
          {ev.usuario_email || "anônimo"} · {tempoRelativo(ev.criado_em)}
        </div>
      </div>
    </div>
  );
}

// Mapa de cor + texto humano por ação. Centralizar aqui evita switch espalhado.
function decorarEvento(ev) {
  const acao = ev.acao || "";
  const dados = ev.dados || {};

  // Mapas — fáceis de estender quando criarmos eventos novos.
  // Tons sóbrios (não saturados) pra combinar com a paleta minimalista
  // do sistema. Cor é informação semântica essencial em log de eventos
  // (sucesso/falha/atenção visível de relance), mas não precisa berrar.
  const COR_VERDE   = "#0f766e"; // teal-700, mais discreto que green-600
  const COR_VERMELHO= "#991b1b"; // red-800, vinho em vez de vermelho-aviso
  const COR_AZUL    = "#1e3a8a"; // blue-900, marinho
  const COR_LARANJA = "#92400e"; // amber-800, mostarda em vez de laranja
  const COR_CINZA   = "#9ca3af";

  if (acao === "usuario.login_sucesso") return { cor: COR_VERDE,    descricao: "Login bem-sucedido" };
  if (acao === "usuario.login_falha")   return { cor: COR_VERMELHO, descricao: `Login falhou${dados.motivo ? " — " + dados.motivo.replace(/_/g, " ") : ""}` };
  if (acao === "usuario.signup")        return { cor: COR_AZUL,     descricao: `Nova empresa cadastrada: ${dados.empresa_nome || ev.recurso_id}` };
  if (acao === "usuario.senha_alterada") return { cor: COR_LARANJA, descricao: "Senha alterada" };
  if (acao === "usuario.senha_resetada") return { cor: COR_LARANJA, descricao: `Senha resetada por ${dados.alterado_por === "admin_master" ? "master" : "admin de empresa"} (alvo: ${dados.alvo_email || ev.recurso_id})` };
  if (acao === "usuario.troca_senha_falha") return { cor: COR_VERMELHO, descricao: `Tentativa de troca de senha falhou${dados.motivo ? " — " + dados.motivo.replace(/_/g, " ") : ""}` };
  // Recuperação self-service ("Esqueci senha"): solicitação dispara email,
  // redefinição efetiva acontece quando usuário clica no link e cria senha nova.
  if (acao === "usuario.recuperacao_solicitada") return { cor: COR_LARANJA, descricao: `Recuperação de senha solicitada${dados.email_enviado === false ? " (falha no envio)" : ""}` };
  if (acao === "usuario.recuperacao_rate_limit") return { cor: COR_VERMELHO, descricao: "Recuperação bloqueada por rate limit" };
  if (acao === "usuario.senha_redefinida") return { cor: COR_VERDE, descricao: "Senha redefinida via recuperação" };
  if (acao === "usuario.email_alterado") return { cor: COR_LARANJA, descricao: "Email alterado" };
  if (acao === "usuario.nivel_alterado") return { cor: COR_LARANJA, descricao: `Nível alterado: ${dados.antes?.nivel} → ${dados.depois?.nivel}` };
  if (acao === "usuario.criado")        return { cor: COR_VERDE,    descricao: `Usuário criado: ${dados.email || ev.recurso_id}` };
  if (acao === "usuario.editado")       return { cor: COR_CINZA,    descricao: "Usuário editado" };
  if (acao === "usuario.desativado")    return { cor: COR_LARANJA, descricao: "Usuário desativado" };
  if (acao === "usuario.reativado")     return { cor: COR_VERDE,    descricao: "Usuário reativado" };
  if (acao === "usuario.excluido")      return { cor: COR_VERMELHO, descricao: `Usuário excluído: ${dados.snapshot?.email || ev.recurso_id}` };
  if (acao === "empresa.criada")        return { cor: COR_VERDE,    descricao: `Empresa criada: ${dados.nome || ev.recurso_id}` };
  if (acao === "empresa.editada")       return { cor: COR_CINZA,    descricao: "Empresa editada" };
  if (acao === "empresa.desativada")    return { cor: COR_LARANJA, descricao: "Empresa desativada" };
  if (acao === "empresa.reativada")     return { cor: COR_VERDE,    descricao: "Empresa reativada" };
  if (acao === "empresa.excluida")      return { cor: COR_VERMELHO, descricao: `Empresa excluída: ${dados.snapshot?.nome || ev.recurso_id}` };
  if (acao === "cliente.excluido")      return { cor: COR_VERMELHO, descricao: `Cliente excluído: ${dados.snapshot?.nome || ev.recurso_id}` };
  if (acao === "orcamento.excluido")    return { cor: COR_VERMELHO, descricao: `Orçamento excluído: ${ev.recurso_id}` };
  if (acao === "obra.excluida")         return { cor: COR_VERMELHO, descricao: `Obra excluída: ${ev.recurso_id}` };
  if (acao === "fornecedor.excluido")   return { cor: COR_VERMELHO, descricao: `Fornecedor excluído: ${ev.recurso_id}` };
  if (acao === "lancamento.excluido")   return { cor: COR_VERMELHO, descricao: `Lançamento excluído: ${ev.recurso_id}` };

  // Feedback in-app
  if (acao === "feedback.enviado")        return { cor: COR_AZUL, descricao: `Feedback (${dados.categoria || "outro"}): "${(dados.texto_preview || "").slice(0, 60)}${(dados.texto_preview || "").length > 60 ? "…" : ""}"` };
  if (acao === "feedback.status_alterado") return { cor: COR_CINZA, descricao: `Feedback ${ev.recurso_id}: ${dados.de} → ${dados.para}` };
  if (acao === "feedback.excluido")        return { cor: COR_VERMELHO, descricao: `Feedback excluído: ${ev.recurso_id}` };

  // Default: ação desconhecida — mostra o nome bruto
  return { cor: COR_CINZA, descricao: acao };
}

// "há 3min", "há 2h", "há 4d" — formato compacto pro feed
function tempoRelativo(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "agora há pouco";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  // Caiu muito atrás — mostra data formatada (timezone do browser do usuário,
  // que via configuração de SO normalmente já é America/Sao_Paulo).
  return new Date(iso).toLocaleDateString("pt-BR");
}

// ═══════════════════════════════════════════════════════════════
// HOME MENU
// ═══════════════════════════════════════════════════════════════

function HomeMenu({ data, setAba, tentarTrocar, isMaster }) {
  const nomeEscritorio = data?.escritorio?.nome || "";
  const [texto, setTexto] = useState("Bem-vindo");
  const [fase, setFase] = useState("bemvindo");

  // Detecta viewport mobile (<768px) pra ajustar grid e padding.
  // Em mobile, 2 cols em vez de 3 — evita o card direito sair da tela.
  const [isMobile, setIsMobile] = useState(() => {
    try { return window.innerWidth < 768; } catch { return false; }
  });
  useEffect(() => {
    function onResize() { try { setIsMobile(window.innerWidth < 768); } catch {} }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!nomeEscritorio) return;
    const t1 = setTimeout(() => setFase("saindo"), 1600);
    const t2 = setTimeout(() => { setTexto(nomeEscritorio); setFase("entrando"); }, 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [nomeEscritorio]);

  const opacity = fase === "saindo" ? 0 : 1;
  const transform = fase === "saindo" ? "translateY(-8px)" : "translateY(0)";

  // Cards da home dependem do perfil. Master tem Dashboard com métricas +
  // links pra Mensagens/Empresas/etc. Escritório vê os módulos dele.
  const modulos = isMaster ? [
    { k:"mensagens",              label:"Mensagens",      desc:"Caixa do time VICKE" },
    { k:"admin:empresas",         label:"Empresas",       desc:"Gerenciar empresas cadastradas" },
    { k:"admin:usuarios-master",  label:"Usuários Master", desc:"Acessos da equipe Vicke" },
    { k:"admin:manutencao",       label:"Manutenção",     desc:"Jobs e operações do sistema" },
    { k:"admin:cub",              label:"CUB",            desc:"Custo Unitário Básico — atualização mensal" },
  ] : [
    { k:"clientes",         label:"Clientes",     desc:"Cadastro e orçamentos",     count: data?.clientes?.length },
    { k:"projetos:etapas",  label:"Projetos",     desc:"Etapas e prazos" },
    { k:"obras",            label:"Obras",        desc:"Acompanhamento e execução" },
    { k:"escritorio",       label:"Escritório",   desc:"Dados e equipe" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"calc(100vh - 53px)", padding: isMobile ? "32px 16px" : "40px 32px", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
      <div style={{ textAlign:"center", marginBottom: isMobile ? 36 : 56 }}>
        <div style={{ fontSize: isMobile ? 24 : 28, fontWeight:300, color:"#111", letterSpacing:-0.5, transition:"opacity 0.4s ease, transform 0.4s ease", opacity, transform }}>
          {texto}
        </div>
        <div style={{ fontSize:13, color:"#d1d5db", marginTop:8 }}>Selecione um módulo para começar</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: isMobile ? 10 : 12, width:"100%", maxWidth:680 }}>
        {modulos.map(m => (
          <button key={m.k} onClick={() => { const go = () => setAba(m.k); if (tentarTrocar) tentarTrocar(go); else go(); }}
            style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding: isMobile ? "16px 14px" : "20px", textAlign:"left", cursor:"pointer", fontFamily:"inherit", position:"relative" }}
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
// TELA: TROCAR SENHA OBRIGATÓRIA
// ═══════════════════════════════════════════════════════════════
// Renderizada quando o usuário tem `precisa_trocar_senha = true` no JWT/me.
// Bloqueia toda navegação até trocar a senha temporária (gerada por admin
// no reset). É a única coisa visível na tela — sem sidebar, sem dados.
//
// Saídas possíveis:
//   - Trocar senha com sucesso → onTrocada() → app libera
//   - Logout → cliente sai sem trocar (caso esteja em máquina errada)

// Input de senha com botão "olho" pra revelar conteúdo. Usado pelos 3
// campos da tela de troca obrigatória. type alterna entre password (oculto,
// default) e text (revelado). Visibilidade é controlada pelo pai.
function CampoSenha({ valor, onChange, visivel, setVisivel, disabled, autoFocus }) {
  return (
    <div style={{ position:"relative" }}>
      <input
        type={visivel ? "text" : "password"}
        value={valor}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        autoFocus={autoFocus}
        style={{
          width:"100%", border:"1px solid #e5e7eb", borderRadius:8,
          padding:"10px 40px 10px 12px", // padding direito maior pro botão
          fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box",
        }}
      />
      <button
        type="button"
        onClick={() => setVisivel(v => !v)}
        disabled={disabled}
        title={visivel ? "Ocultar senha" : "Mostrar senha"}
        aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        style={{
          position:"absolute", right:6, top:"50%", transform:"translateY(-50%)",
          background:"none", border:"none", cursor: disabled ? "not-allowed" : "pointer",
          padding:"6px 8px", lineHeight:0,
          color:"#9ca3af", fontFamily:"inherit",
          display:"flex", alignItems:"center", justifyContent:"center",
        }}
        onMouseEnter={e => { if (!disabled) e.currentTarget.style.color = "#374151"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "#9ca3af"; }}>
        {visivel ? (
          // eye-off
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        ) : (
          // eye
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>
    </div>
  );
}

function TelaTrocarSenhaObrigatoria({ usuario, onTrocada, onLogout }) {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova]   = useState("");
  const [confirmar, setConfirmar]   = useState("");
  const [loading, setLoading]       = useState(false);
  const [erro, setErro]             = useState(null);
  // Visibilidade independente de cada campo. Default: oculto (boa prática
  // de não vazar senha em ombro alheio enquanto digita). Botão "olho"
  // permite revelar pra conferir o que digitou.
  const [verAtual, setVerAtual]     = useState(false);
  const [verNova, setVerNova]       = useState(false);
  const [verConfirmar, setVerConfirmar] = useState(false);

  function validar() {
    if (!senhaAtual) return "Informe a senha atual (a temporária recebida)";
    if (!senhaNova || senhaNova.length < 6) return "A nova senha deve ter no mínimo 6 caracteres";
    if (senhaNova === senhaAtual) return "A nova senha precisa ser diferente da atual";
    if (senhaNova !== confirmar) return "Confirmação de senha não confere";
    return null;
  }

  async function trocar() {
    const v = validar();
    if (v) { setErro(v); return; }
    setLoading(true);
    setErro(null);
    try {
      await api.auth.trocarSenha(senhaAtual, senhaNova);
      onTrocada();
    } catch (e) {
      setErro(e.message || "Falha ao trocar senha");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    trocar();
  }

  return (
    <div style={{
      position:"fixed", inset:0,
      background:"#fafafa",
      display:"flex", alignItems:"center", justifyContent:"center",
      padding:20, fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",
    }}>
      <form onSubmit={handleSubmit}
        style={{
          background:"#fff", border:"1px solid #e5e7eb", borderRadius:12,
          padding:"32px 32px 24px", maxWidth:420, width:"100%",
          boxShadow:"0 8px 32px rgba(0,0,0,0.06)",
        }}>
        <div style={{ fontSize:18, fontWeight:700, color:"#111", marginBottom:6, letterSpacing:-0.3 }}>
          Trocar senha
        </div>
        <div style={{ fontSize:13, color:"#6b7280", marginBottom:20, lineHeight:1.5 }}>
          Sua senha foi resetada por um administrador. Para continuar, escolha uma senha nova que só você saiba.
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#6b7280", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 }}>
            Senha temporária recebida
          </label>
          <CampoSenha
            valor={senhaAtual}
            onChange={setSenhaAtual}
            visivel={verAtual}
            setVisivel={setVerAtual}
            disabled={loading}
            autoFocus
          />
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#6b7280", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 }}>
            Nova senha (mínimo 6 caracteres)
          </label>
          <CampoSenha
            valor={senhaNova}
            onChange={setSenhaNova}
            visivel={verNova}
            setVisivel={setVerNova}
            disabled={loading}
          />
        </div>

        <div style={{ marginBottom:18 }}>
          <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#6b7280", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 }}>
            Confirme a nova senha
          </label>
          <CampoSenha
            valor={confirmar}
            onChange={setConfirmar}
            visivel={verConfirmar}
            setVisivel={setVerConfirmar}
            disabled={loading}
          />
        </div>

        {erro && (
          <div style={{ fontSize:12.5, color:"#991b1b", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"8px 12px", marginBottom:14 }}>
            {erro}
          </div>
        )}

        <button type="submit" disabled={loading}
          style={{
            background:"#111", color:"#fff", border:"none", borderRadius:8,
            padding:"11px 16px", fontSize:13.5, fontWeight:600, cursor: loading ? "not-allowed" : "pointer",
            fontFamily:"inherit", width:"100%", marginBottom:10,
            opacity: loading ? 0.6 : 1,
          }}>
          {loading ? "Salvando..." : "Trocar senha e continuar"}
        </button>

        <button type="button" onClick={onLogout} disabled={loading}
          style={{
            background:"transparent", color:"#6b7280", border:"none",
            padding:"8px", fontSize:12, cursor:"pointer", fontFamily:"inherit", width:"100%",
          }}>
          Sair sem trocar
        </button>

        <div style={{ fontSize:11, color:"#9ca3af", marginTop:12, textAlign:"center" }}>
          Logado como {usuario?.email || ""}
        </div>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FEEDBACK IN-APP — botão flutuante + modal
// ═══════════════════════════════════════════════════════════════
// Botão fixo no canto inferior direito (z-index alto pra ficar sobre tudo
// que não seja modal/dialog do sistema). Visível em qualquer aba, exceto
// na tela de troca de senha obrigatória (que bloqueia tudo).
//
// Categorias seguem CHECK constraint do backend (feedback_app.categoria):
// sugestao | bug | pergunta | cobranca | elogio | outro

const FEEDBACK_CATEGORIAS = [
  { id: "sugestao",  label: "Sugestão" },
  { id: "bug",       label: "Bug" },
  { id: "pergunta",  label: "Pergunta" },
  { id: "cobranca",  label: "Cobrança" },
  { id: "elogio",    label: "Elogio" },
  { id: "outro",     label: "Outro" },
];

function BotaoFeedbackFlutuante({ usuario }) {
  const [modalAberto, setModalAberto] = useState(false);
  // Detecta mobile pra ajustar offsets do botão.
  const [isMobile, setIsMobile] = useState(() => {
    try { return window.innerWidth < 768; } catch { return false; }
  });
  useEffect(() => {
    function onResize() { try { setIsMobile(window.innerWidth < 768); } catch {} }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Master não envia feedback pra si mesmo — caixa é pra clientes.
  if (usuario?.perfil === "master") return null;

  return (
    <>
      <button
        onClick={() => setModalAberto(true)}
        title="Enviar feedback"
        style={{
          position:"fixed",
          right: isMobile ? 16 : 24,
          bottom: isMobile ? 16 : 24,
          zIndex: 800,
          background:"#111", color:"#fff", border:"none",
          borderRadius:"50%",
          width: isMobile ? 44 : 48,
          height: isMobile ? 44 : 48,
          cursor:"pointer", fontFamily:"inherit",
          boxShadow:"0 4px 12px rgba(0,0,0,0.15)",
          display:"flex", alignItems:"center", justifyContent:"center",
          transition:"transform 0.12s ease",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}>
        {/* Ícone mensagem outline (estilo Lucide) — alinhado com identidade
            visual minimalista preto/branco do sistema */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
      {modalAberto && (
        <ModalEnviarFeedback
          usuario={usuario}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </>
  );
}

function ModalEnviarFeedback({ usuario, onFechar }) {
  const [categoria, setCategoria] = useState("sugestao");
  const [texto, setTexto]         = useState("");
  const [enviando, setEnviando]   = useState(false);
  const [erro, setErro]           = useState(null);
  const [enviado, setEnviado]     = useState(false);
  const MAX_CHARS = 2000;

  async function enviar() {
    const txt = texto.trim();
    if (!txt) { setErro("Escreva alguma coisa antes de enviar"); return; }
    if (txt.length > MAX_CHARS) { setErro(`Texto muito longo (máximo ${MAX_CHARS} caracteres)`); return; }
    setEnviando(true);
    setErro(null);
    try {
      await api.feedback.enviar(categoria, txt);
      setEnviado(true);
      setTimeout(onFechar, 1800); // fecha sozinho após mostrar "enviado"
    } catch (e) {
      setErro(e.message || "Falha ao enviar");
      setEnviando(false);
    }
  }

  // Estado de sucesso: mostra confirmação por ~1.8s antes de fechar.
  // Feedback positivo curto evita que o cliente fique com dúvida se foi.
  if (enviado) {
    return (
      <div onClick={onFechar} style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,0.4)",
        display:"flex", alignItems:"center", justifyContent:"center",
        zIndex:900, padding:20,
        fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",
      }}>
        <div style={{
          background:"#fff", borderRadius:12, padding:"32px 28px",
          maxWidth:380, textAlign:"center", boxShadow:"0 8px 32px rgba(0,0,0,0.15)",
        }}>
          <div style={{ marginBottom:14, display:"flex", justifyContent:"center" }}>
            <div style={{
              width:48, height:48, borderRadius:"50%",
              background:"#111", color:"#fff",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <IconeMaster nome="check" tamanho={22} cor="#fff" />
            </div>
          </div>
          <div style={{ fontSize:16, fontWeight:600, color:"#111", marginBottom:6 }}>Recebido</div>
          <div style={{ fontSize:13, color:"#6b7280", lineHeight:1.5 }}>
            Obrigado pelo feedback.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div onClick={onFechar} style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.4)",
      display:"flex", alignItems:"center", justifyContent:"center",
      zIndex:900, padding:20,
      fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"#fff", borderRadius:12, padding:"24px 24px 20px",
        maxWidth:480, width:"100%", maxHeight:"90vh", overflowY:"auto",
        boxShadow:"0 8px 32px rgba(0,0,0,0.15)",
      }}>
        <div style={{ fontSize:16, fontWeight:700, color:"#111", marginBottom:6 }}>
          Enviar feedback
        </div>
        <div style={{ fontSize:13, color:"#6b7280", marginBottom:18, lineHeight:1.5 }}>
          Sua mensagem chega direto pro time da Vicke. Pode mandar bugs, ideias, perguntas — tudo serve.
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#6b7280", textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>
            Tipo
          </label>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:6 }}>
            {FEEDBACK_CATEGORIAS.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoria(c.id)}
                disabled={enviando}
                style={{
                  padding:"10px 12px", borderRadius:8, fontSize:13,
                  fontFamily:"inherit", textAlign:"center",
                  cursor: enviando ? "not-allowed" : "pointer",
                  border: categoria === c.id ? "1.5px solid #111" : "1px solid #e5e7eb",
                  background: categoria === c.id ? "#fafbfc" : "#fff",
                  color:"#111",
                  fontWeight: categoria === c.id ? 600 : 400,
                }}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#6b7280", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 }}>
            Mensagem
          </label>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            disabled={enviando}
            placeholder="Escreva o que quiser compartilhar..."
            rows={5}
            style={{
              width:"100%", border:"1px solid #e5e7eb", borderRadius:8,
              padding:"10px 12px", fontSize:13, fontFamily:"inherit",
              outline:"none", boxSizing:"border-box", resize:"vertical",
              minHeight:100,
            }}
          />
          <div style={{ fontSize:11, color: texto.length > MAX_CHARS ? "#b91c1c" : "#9ca3af", marginTop:4, textAlign:"right" }}>
            {texto.length} / {MAX_CHARS}
          </div>
        </div>

        {erro && (
          <div style={{ fontSize:12.5, color:"#991b1b", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"8px 12px", marginBottom:14 }}>
            {erro}
          </div>
        )}

        <div style={{ fontSize:11, color:"#9ca3af", marginBottom:14, lineHeight:1.5 }}>
          Enviado por: <strong style={{ color:"#6b7280" }}>{usuario?.nome}</strong> · {usuario?.email}
        </div>

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onFechar} disabled={enviando}
            style={{
              background:"#fff", border:"1px solid #e5e7eb", borderRadius:8,
              padding:"9px 14px", fontSize:13, color:"#6b7280", cursor: enviando ? "not-allowed" : "pointer",
              fontFamily:"inherit",
            }}>
            Cancelar
          </button>
          <button onClick={enviar} disabled={enviando || !texto.trim()}
            style={{
              background:"#111", color:"#fff", border:"none", borderRadius:8,
              padding:"9px 16px", fontSize:13, fontWeight:600,
              cursor: (enviando || !texto.trim()) ? "not-allowed" : "pointer",
              fontFamily:"inherit", opacity: (enviando || !texto.trim()) ? 0.5 : 1,
            }}>
            {enviando ? "Enviando..." : "Enviar"}
          </button>
        </div>
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
  // Sidebar colapsada: estado persistido em localStorage. False = full
  // (ícones + texto). True = estreita (só ícones, popover nos submenus).
  // Padrão dos SaaS modernos (Linear/Notion/VSCode) — usuário escolhe uma
  // vez e a preferência persiste entre sessões.
  const [sidebarColapsada, setSidebarColapsada] = useState(() => {
    try {
      return localStorage.getItem("vicke-sidebar-colapsada") === "true";
    } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("vicke-sidebar-colapsada", String(sidebarColapsada)); } catch {}
  }, [sidebarColapsada]);

  // Mobile: detecta tamanho de tela pra alternar comportamento da sidebar.
  // <768px: sidebar vira overlay/drawer (fechada por default, abre por toque).
  // >=768px: sidebar normal lado a lado com conteúdo (igual desktop).
  // Listener no resize pra reagir a rotação do dispositivo / redimensionamento.
  const [isMobile, setIsMobile] = useState(() => {
    try { return window.innerWidth < 768; } catch { return false; }
  });
  useEffect(() => {
    function onResize() {
      try { setIsMobile(window.innerWidth < 768); } catch {}
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Força meta viewport restrito em mobile + bloqueia scroll horizontal global.
  // Roda uma vez no boot. Garante que mesmo se o index.html tiver viewport
  // permissivo, a UI não dê zoom horizontal nem permita scroll lateral.
  useEffect(() => {
    try {
      // 1. Atualiza/insere <meta name="viewport"> com escala fixa
      let meta = document.querySelector('meta[name="viewport"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "viewport";
        document.head.appendChild(meta);
      }
      meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";

      // 2. Injeta CSS global pra bloquear overflow horizontal em html/body.
      // Se algum elemento estourar a largura, fica oculto em vez de criar
      // scroll lateral. ID único pra não duplicar se App remontar.
      if (!document.getElementById("vicke-global-mobile-fix")) {
        const style = document.createElement("style");
        style.id = "vicke-global-mobile-fix";
        style.textContent = `
          html, body, #root { max-width: 100vw; overflow-x: hidden; }
          /* Previne tap delay e zoom em double tap em mobile */
          * { touch-action: manipulation; }
        `;
        document.head.appendChild(style);
      }
    } catch {}
  }, []);

  // Sidebar drawer em mobile: estado controla se está aberta (overlay visível).
  // Sempre começa fechada em mobile — usuário toca hamburguer pra abrir.
  // Em desktop esse state é ignorado (sidebar sempre visível).
  const [sidebarMobileAberta, setSidebarMobileAberta] = useState(false);

  const [orcamentoTelaCheia, setOrcamentoTelaCheia] = useState(null);
  const [clienteRetorno, setClienteRetorno] = useState(null);
  const [cadastroNovoCliente, setCadastroNovoCliente] = useState(false);
  const [backendOffline, setBackendOffline]   = useState(false);

  // Ref pro data atual — usada dentro de callbacks que não devem capturar closure.
  // Sem isso, callbacks criados numa render leem data antigo mesmo após saves.
  // Bug histórico: durante edição de orçamento, ao salvar nova proposta o
  // handler onSalvar misturava data velho + orcamentosProjeto novo, perdendo
  // propostas intermediárias (card mostrava valor antigo mesmo após gerar
  // proposta nova com valor diferente).
  const dataRef = useRef(null);
  useEffect(() => { dataRef.current = data; }, [data]);

  // Flag interna: true quando há salvamento em andamento.
  // Usada pelo beforeunload pra bloquear fechamento durante saves.
  const savingRef = useRef(false);

  // Flag: orçamento em tela cheia está aberto.
  // Usada pelo beforeunload — se o usuário entrou num form de orçamento,
  // já pode estar preenchendo e o F5 não deve deixar sair silenciosamente.
  // Mesmo que o form ainda não tenha registrado __vickeOrcHasDirty,
  // esta flag captura a situação defensivamente.
  const orcamentoAbertoRef = useRef(false);
  useEffect(() => { orcamentoAbertoRef.current = !!orcamentoTelaCheia; }, [orcamentoTelaCheia]);

  // isMaster: dupla checagem — state em memória + JWT real do localStorage.
  // Defesa contra inconsistência: se o state diz "master" mas o JWT em uso
  // diz "escritorio" (cenário de autopreenchimento + login rápido), retorna
  // false e a sidebar esconde itens master automaticamente. Backend já bloqueia,
  // mas isso evita o usuário ver opções que vão dar 403.
  const isMaster = (() => {
    if (usuario?.perfil !== "master") return false;
    if (typeof localStorage === "undefined") return true; // SSR safety
    try {
      const tok = localStorage.getItem("vicke-token");
      if (!tok) return false;
      const payload = decodeJWT(tok);
      // JWT é a fonte da verdade do que o backend vai aceitar
      return payload?.perfil === "master";
    } catch { return false; }
  })();

  // tentarTrocar: quando há orçamento em tela cheia com dados não salvos,
  // consulta o handler registrado pelo FormOrcamento (window.__vickeOrcDirtyPrompt).
  // Em mobile, fecha o drawer da sidebar após troca bem-sucedida (UX padrão
  // de drawers — usuário escolhe item, drawer some pra mostrar conteúdo).
  function tentarTrocar(fn) {
    const fnComFechamento = () => {
      fn();
      // Fecha drawer mobile (no-op em desktop)
      try { setSidebarMobileAberta(false); } catch {}
    };
    if (typeof window !== "undefined" && typeof window.__vickeOrcDirtyPrompt === "function") {
      const absorveu = window.__vickeOrcDirtyPrompt(fnComFechamento);
      if (absorveu) return;
    }
    fnComFechamento();
  }

  // Accordion: Projetos fica aberto quando qualquer aba "projetos:*" está ativa
  const [projetosAberto, setProjetosAberto] = useState(() => (typeof aba === "string" && aba.indexOf("projetos") === 0));
  // Popover do submenu Projetos quando sidebar está colapsada. null = fechado,
  // ou {x, y} pra posicionar absolutamente perto do botão pai.
  const [popoverProjetos, setPopoverProjetos] = useState(null);
  // Fecha popover ao clicar fora (delegação no document — captura
  // clicks em qualquer lugar da página quando popover está aberto).
  useEffect(() => {
    if (!popoverProjetos) return;
    function onClickFora(e) {
      // Se clicou dentro do popover ou no botão que abriu, ignora
      const popover = document.getElementById("popover-projetos");
      const trigger = document.getElementById("trigger-projetos");
      if (popover && popover.contains(e.target)) return;
      if (trigger && trigger.contains(e.target)) return;
      setPopoverProjetos(null);
    }
    document.addEventListener("mousedown", onClickFora);
    return () => document.removeEventListener("mousedown", onClickFora);
  }, [popoverProjetos]);
  useEffect(() => {
    if (typeof aba === "string" && aba.indexOf("projetos") === 0) setProjetosAberto(true);
  }, [aba]);

  // Modal "Sessão alterada em outra aba" — única ação possível: recarregar.
  // Declarado cedo porque é usado por hooks de bootstrap/visibilidade.
  const [conflitoSessao, setConflitoSessao] = useState(null);
  // null = sem conflito | "outro_usuario" | "logout"

  // Bootstrap: restaura sessão salva no localStorage se ainda válida.
  useEffect(() => {
    try {
      const tok = localStorage.getItem("vicke-token");
      const usr = localStorage.getItem("vicke-user");
      if (tok && usr) {
        const payload = decodeJWT(tok);
        if (!payload) {
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
      try {
        localStorage.removeItem("vicke-token");
        localStorage.removeItem("vicke-user");
      } catch {}
    }
  }, []);

  // Verificação de consistência: quando a aba volta ao foco OU quando window
  // ganha foco, comparar state em memória com localStorage. Se divergirem,
  // significa que outra aba mexeu no storage enquanto esta estava em background
  // — aba precisa recarregar pra refletir o estado correto.
  //
  // Cenário coberto: aba A logada como master, outra aba B faz logout/login
  // como Padovan, usuário volta na aba A → state em memória ainda diz master
  // mas localStorage agora tem Padovan. Reload corrige.
  //
  // Defesa em profundidade — o BroadcastChannel/storage event já cobrem isso
  // em tempo real, mas se algum evento for perdido (browser bug, foco em outra
  // janela com aba em sleep), esse hook captura na volta.
  useEffect(() => {
    function verificarConsistencia() {
      // Sem usuário em memória? Não estamos logados, nada pra verificar
      if (!usuario?.id) return;
      try {
        const usrLS = localStorage.getItem("vicke-user");
        const tokLS = localStorage.getItem("vicke-token");
        // localStorage vazio mas state diz logado: alguém deslogou em outra aba
        if (!usrLS || !tokLS) {
          setConflitoSessao("logout");
          return;
        }
        const userLS = JSON.parse(usrLS);
        // Usuário diferente do que está em memória
        if (userLS?.id && userLS.id !== usuario.id) {
          setConflitoSessao("outro_usuario");
        }
        // Mesmo usuário mas token diferente: silenciosamente atualiza memória
        else if (userLS?.id === usuario.id && tokLS !== token) {
          setToken(tokLS);
        }
      } catch { /* JSON corrompido, deixa próximo request com 401 lidar */ }
    }
    function onVisibility() {
      if (document.visibilityState === "visible") verificarConsistencia();
    }
    window.addEventListener("focus", verificarConsistencia);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", verificarConsistencia);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [usuario?.id, token]);

  // loadData roda quando autenticado vira true OU quando o estado da empresa
  // muda (ex: usuário acaba de concluir onboarding e o usuario.estado passou
  // de null pra "SP" — precisa recarregar dados pra trazer o CUB do estado).
  useEffect(() => { if (autenticado) { setLoading(true); loadData(); } }, [autenticado, usuario?.estado]);

  useEffect(() => {
    if (aba === "projetos") setAba("projetos:etapas");
    else if (aba === "teste") setAba("projetos:orcamentos");
  }, [aba]);

  // beforeunload: dispara se há trabalho que o usuário pode perder.
  // Condições que ativam:
  //   (a) save em andamento
  //   (b) orçamento em tela cheia aberto (usuário pode estar preenchendo)
  //   (c) form registrou __vickeOrcHasDirty e retorna true
  // A condição (b) é defensiva: cobre o caso em que o usuário começa a
  // preencher cômodos antes do form fazer setup do handler próprio.
  useEffect(() => {
    const handler = (e) => {
      const savingAgora = savingRef.current;
      const orcamentoAberto = orcamentoAbertoRef.current;
      let orcSujo = false;
      try {
        if (typeof window !== "undefined" && typeof window.__vickeOrcHasDirty === "function") {
          orcSujo = !!window.__vickeOrcHasDirty();
        }
      } catch {}
      if (!savingAgora && !orcamentoAberto && !orcSujo) return;
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  function handleLogin(usr, tok) {
    setUsuario(usr); setToken(tok); setAutenticado(true); setAba("home");
    // Notifica outras abas que pode haver troca de usuário.
    // Inclui userId pra outras abas decidirem: mesma sessão (atualizar token)
    // ou usuário diferente (forçar reload).
    anunciarSessao("login", { userId: usr.id });
  }
  function handleLogout() {
    anunciarSessao("logout", { userId: usuario?.id });
    clearAuth();
    // Reload pra estado limpo: descarta TODO state em memória (data, aba ativa,
    // forms abertos, etc.) e força bootstrap fresh com localStorage vazio.
    // Sem reload, restos do app antigo podem se misturar com o login novo
    // (ex: sidebar mostrando "Admin" mesmo após login com perfil escritorio).
    // Pequeno delay pra anunciarSessao chegar em outras abas antes do reload.
    setTimeout(() => { window.location.href = "/"; }, 50);
  }

  // Reage a mudanças de sessão em outras abas
  useSessionCoordinator({
    usuarioAtual: usuario,
    onMesmoUsuario: () => {
      // Mesmo usuário relogou em outra aba → token novo no localStorage.
      // Atualiza state local sem reload pra continuar trabalhando.
      try {
        const novoToken = localStorage.getItem("vicke-token");
        if (novoToken && novoToken !== token) setToken(novoToken);
      } catch { /* se falhar, próximo request com 401 dá fallback */ }
    },
    onOutroUsuario: () => {
      // Outro usuário logou nesta máquina → continuar usaria credenciais
      // erradas. Modal pede reload, sem opção de "ignorar" (é inconsistência).
      setConflitoSessao("outro_usuario");
    },
    onLogout: () => {
      // Outra aba fez logout → token saiu do localStorage. Mostrar modal
      // pra usuário entender o que aconteceu antes do reload.
      setConflitoSessao("logout");
    },
  });

  async function loadData() {
    try {
      // Passa estado da empresa pra loadAllData buscar o CUB em paralelo
      // (Sprint 3). Lê do localStorage como fonte primária — usuario state
      // pode estar null/stale no primeiro loadData() pós-login (closure
      // capturou null antes do setUsuario propagar pro React).
      // Localstorage é setado SINCRONO no handleLogin/bootstrap antes do
      // setAutenticado disparar este effect. Fallback pro state cobre o caso
      // de loadData ser chamado de novo depois (botão "Tentar novamente").
      let estadoEmpresa = null;
      try {
        const usrStored = JSON.parse(localStorage.getItem("vicke-user") || "null");
        estadoEmpresa = usrStored?.estado || usuario?.estado || null;
      } catch {
        estadoEmpresa = usuario?.estado || null;
      }
      const saved = await loadAllData(estadoEmpresa);
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

  // save(): otimista — aplica localmente, envia pro backend, e fim.
  // Se backend falhar, marca offline mas não reverte (usuário continua
  // trabalhando; quando reconectar, próximo save sincroniza).
  //
  // IMPORTANTE: callers em callbacks capturados (ex: onSalvar do FormOrcamento)
  // devem usar dataRef.current em vez de data, senão leem data congelado e
  // sobrescrevem atualizações intermediárias.
  async function save(newData, opts = {}) {
    const oldData = dataRef.current || data;
    setData(newData);
    dataRef.current = newData; // mantém ref em sync imediato pra callbacks subsequentes
    savingRef.current = true;
    try {
      await saveAllData(newData, oldData);
      setBackendOffline(false);
    }
    catch(e) {
      console.error("Erro ao salvar:", e);
      setBackendOffline(true);
    }
    finally {
      savingRef.current = false;
    }
  }

  // Backup (exportar/importar): disponível APENAS pro master.
  // Editor/admin de escritório não precisam exportar todo o banco.
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
      console.error("Falha no download direto, abrindo modal:", e);
      setBackupJson(json);
      setShowBackup(true);
    }
  }

  function importarDados(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try { const parsed = JSON.parse(ev.target.result); await save(parsed); toast.sucesso("Dados importados"); }
      catch { dialogo.alertar({ titulo: "Arquivo inválido", mensagem: "Não foi possível ler este arquivo JSON.", tipo: "erro" }); }
    };
    reader.readAsText(file); e.target.value = "";
  }

  // Renderiza modal de conflito de sessão (compartilhado entre todos os returns)
  const conflitoModal = conflitoSessao && (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:100050, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"28px 32px", maxWidth:440, width:"100%", boxShadow:"0 8px 32px rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize:16, fontWeight:700, color:"#111", marginBottom:8 }}>
          {conflitoSessao === "logout" ? "Sessão encerrada" : "Sessão alterada em outra aba"}
        </div>
        <div style={{ fontSize:13, color:"#6b7280", marginBottom:20, lineHeight:1.55 }}>
          {conflitoSessao === "logout"
            ? "Você foi desconectado em outra aba. Esta página será atualizada para voltar à tela de login."
            : "Outra aba acabou de logar com um usuário diferente. Por segurança, esta página será atualizada para refletir a nova sessão."}
        </div>
        <div style={{ display:"flex", justifyContent:"flex-end" }}>
          <button
            onClick={() => { setConflitoSessao(null); window.location.reload(); }}
            style={{ background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"9px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}
          >
            Atualizar agora
          </button>
        </div>
      </div>
    </div>
  );

  if (!autenticado) return <><TelaLogin onLogin={handleLogin} /><DialogosHost /><VersionWatcher />{conflitoModal}</>;

  // Senha resetada por admin/master → forçar troca antes de qualquer navegação.
  // Bloqueia tudo (sidebar, abas, dados) até o usuário escolher senha nova.
  // Logout disponível pra escape sem trocar senha (usuário pode estar na máquina errada).
  if (usuario?.precisa_trocar_senha) {
    return (
      <>
      <TelaTrocarSenhaObrigatoria
        usuario={usuario}
        onTrocada={() => {
          // Atualiza o state local pra liberar o app. Backend já zerou a flag.
          const usrAtualizado = { ...usuario, precisa_trocar_senha: false };
          setUsuario(usrAtualizado);
          try { localStorage.setItem("vicke-user", JSON.stringify(usrAtualizado)); } catch {}
        }}
        onLogout={handleLogout}
      />
      <DialogosHost />
      <VersionWatcher />
      {conflitoModal}
      </>
    );
  }

  // Onboarding obrigatório (Sprint 3) → empresa nova precisa configurar perfil
  // antes de usar o app. Bloqueia tudo até concluir. Aparece DEPOIS da troca
  // de senha (admin pode ter resetado pra um usuário de empresa nova — primeiro
  // troca senha, depois onboarding). Empresas existentes têm o flag = false e
  // pulam direto pro app.
  // Master nunca cai aqui (perfil "master" não tem onboarding de pricing).
  if (usuario?.precisa_fazer_onboarding && usuario?.perfil !== "master") {
    return (
      <>
      <TelaOnboarding
        usuario={usuario}
        onConcluido={async (estadoOnboarding) => {
          // Backend zerou precisa_fazer_onboarding e gravou as respostas
          // (profissao, padrao_projetos, pct_matriz_calculado, etc).
          // Refaz /auth/me pra trazer TODOS os campos atualizados — fazer
          // merge manual aqui esquece de copiar campos novos e deixa o
          // localStorage desatualizado (componentes que leem de lá vêem
          // null em profissao/padrao/pct_calibrado).
          try {
            const _API_URL = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL)
              || "https://orbi-production-5f5c.up.railway.app";
            const token = localStorage.getItem("vicke-token");
            const res = await fetch(`${_API_URL}/auth/me`, {
              headers: { "Authorization": `Bearer ${token}` },
            });
            const json = await res.json();
            if (json?.ok && json?.data) {
              setUsuario(json.data);
              try { localStorage.setItem("vicke-user", JSON.stringify(json.data)); } catch {}
            } else {
              throw new Error(json?.error || "Falha ao recarregar dados do usuário");
            }
          } catch (e) {
            // Fallback: se /auth/me falhar (rede ruim), aplica merge mínimo
            // pra pelo menos sair da tela de onboarding. Próximo refresh corrige.
            console.error("Falha ao refetch /auth/me após onboarding:", e);
            const usrFallback = {
              ...usuario,
              precisa_fazer_onboarding: false,
              estado: estadoOnboarding || usuario.estado || null,
            };
            setUsuario(usrFallback);
            try { localStorage.setItem("vicke-user", JSON.stringify(usrFallback)); } catch {}
          }

          // Pré-preenche o estado no escritório se ainda estiver vazio.
          // Estrutura do data.escritorio é FLAT (cfg.estado, cfg.cidade, cfg.endereco
          // são todos campos de primeiro nível) — não aninhado em endereco.estado.
          // Evita que o usuário tenha que digitar de novo a mesma info que acabou
          // de informar no onboarding.
          if (estadoOnboarding && data?.escritorio && !data.escritorio.estado) {
            const escritorioAtualizado = {
              ...data.escritorio,
              estado: estadoOnboarding,
            };
            save({ ...data, escritorio: escritorioAtualizado }).catch(e => {
              console.error("Falha ao pré-preencher estado:", e);
            });
          }

          // Redireciona pra aba Escritório pra completar cadastro completo
          // (logo, endereço, contatos, equipe). Mensagem explicando o porquê
          // fica na tela de transição do onboarding.
          setAba("escritorio");
          setEscritorioKey(n => n + 1);
        }}
        onLogout={handleLogout}
      />
      <DialogosHost />
      <VersionWatcher />
      {conflitoModal}
      </>
    );
  }

  if (loading) return (
    <>
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#fff", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:20, height:20, border:"2px solid #e5e7eb", borderTop:"2px solid #111", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 12px" }} />
        <p style={{ color:"#9ca3af", fontSize:13, margin:0 }}>Carregando...</p>
      </div>
    </div>
    <DialogosHost />
    <VersionWatcher />
    {conflitoModal}
    </>
  );

  if (!data) {
    return (
      <>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#fff", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", padding:20 }}>
        <div style={{ textAlign:"center", maxWidth:400 }}>
          <div style={{ fontSize:15, color:"#111", marginBottom:8, fontWeight:600 }}>Servidor indisponível</div>
          <div style={{ fontSize:13, color:"#6b7280", marginBottom:16 }}>Não foi possível carregar os dados. Tente novamente em alguns segundos.</div>
          <button onClick={() => { setLoading(true); loadData(); }} style={{ background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"10px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Tentar novamente</button>
          <button onClick={handleLogout} style={{ marginLeft:10, background:"transparent", color:"#6b7280", border:"1px solid #e5e7eb", borderRadius:8, padding:"10px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Sair</button>
        </div>
      </div>
      <DialogosHost />
      <VersionWatcher />
      {conflitoModal}
      </>
    );
  }

  const nomeEscritorio = data?.escritorio?.nome || "Vicke";

  // MENU dinâmico baseado no perfil:
  // - Master (Renato/Vicke): foca em gestão da plataforma — Painel, Mensagens,
  //   Empresas, Usuários Master, Manutenção. Não vê Clientes/Projetos/Obras
  //   (irrelevantes pra quem opera o SaaS).
  // - Escritório (Padovan, futuras empresas): menu original — gestão do dia a dia.
  const MENU = isMaster ? [
    { k:"home",                   icon:"painel",     label:"Painel" },
    { k:"mensagens",               icon:"mensagens",  label:"Mensagens" },
    { k:"admin:empresas",          icon:"empresas",   label:"Empresas" },
    { k:"admin:usuarios-master",   icon:"usuarios",   label:"Usuários Master" },
    { k:"admin:manutencao",        icon:"manutencao", label:"Manutenção" },
    { k:"admin:cub",               icon:"cub",        label:"CUB" },
  ] : [
    { k:"home",        icon:"home",       label:"Início" },
    { k:"clientes",    icon:"clientes",   label:"Clientes",     count: data?.clientes?.length },
    { k:"projetos",    icon:"projetos",   label:"Projetos", sub: [
      { k:"projetos:orcamentos", icon:"projetos-orcamentos", label:"Orçamentos" },
      { k:"projetos:etapas",     icon:"projetos-andamento",  label:"Em Andamento" },
    ]},
    { k:"obras",       icon:"obras",      label:"Obras" },
    // Módulos Financeiro, Fornecedores e Notas Fiscais foram removidos do menu
    // (decisão Sprint 3): serão refeitos do zero. Mantenho os componentes/rotas
    // por enquanto pra não quebrar dados antigos, só ocultos do menu.
  ];

  // colapsadaEf: "colapsada efetiva" — em mobile, sidebar nunca está colapsada
  // (o conceito não faz sentido em overlay). Sempre mostra com texto+ícone.
  // Em desktop, usa a preferência salva do usuário.
  const colapsadaEf = isMobile ? false : sidebarColapsada;

  const itemStyle = (ativo) => ({
    display:"flex", alignItems:"center",
    justifyContent: colapsadaEf ? "center" : "space-between",
    padding: colapsadaEf ? "10px 8px" : (isMobile ? "12px 14px" : "8px 12px"), // touch target maior em mobile
    borderRadius:7, cursor:"pointer", fontSize:13,
    fontWeight: ativo ? 600 : 400, color: ativo ? "#111" : "#6b7280",
    background: ativo ? "#f3f4f6" : "transparent",
    border:"none", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",
    width:"100%", textAlign:"left",
  });

  return (
    <>
    <div style={{ display:"flex", height:"100vh", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", background:"#fff", overflow:"hidden" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Backdrop mobile: fundo escurecido por trás do drawer.
          Aparece SÓ em mobile quando sidebar está aberta. Toque fecha. */}
      {isMobile && sidebarMobileAberta && (
        <div
          onClick={() => setSidebarMobileAberta(false)}
          style={{
            position:"fixed", inset:0, background:"rgba(0,0,0,0.4)",
            zIndex:990,
            transition:"opacity 0.2s",
          }}
        />
      )}

      {/* ── Sidebar: comportamento muda em mobile ──
          Desktop (>= 768px): fluxo lateral normal, ocupa espaço da grid.
          Mobile (< 768px): overlay flutuante (position:fixed), só aparece
          quando sidebarMobileAberta=true, sempre expandida (220px),
          ignora colapsadaEf. */}
      <div style={
        isMobile ? {
          // Drawer mobile
          position:"fixed", top:0, left:0, bottom:0,
          width: 260, // um pouco mais largo que o desktop expandido (260) pro toque ser confortável
          background:"#fff", borderRight:"1px solid #f3f4f6",
          display:"flex", flexDirection:"column",
          zIndex:991,
          transform: sidebarMobileAberta ? "translateX(0)" : "translateX(-100%)",
          transition:"transform 0.22s ease",
          boxShadow: sidebarMobileAberta ? "2px 0 16px rgba(0,0,0,0.12)" : "none",
        } : {
          // Sidebar desktop normal
          width: colapsadaEf ? 56 : 220,
          minWidth: colapsadaEf ? 56 : 220,
          transition:"width 0.18s ease, min-width 0.18s ease",
          background:"#fff", borderRight:"1px solid #f3f4f6",
          display:"flex", flexDirection:"column",
        }
      }>
        {/* ── Header da sidebar: nome do escritório + botão toggle ──
            Quando colapsada: apenas o botão toggle centralizado (sem título).
            Quando aberta: título à esquerda + toggle à direita. */}
        <div style={{
          padding: (!isMobile && colapsadaEf) ? "16px 8px" : "20px 16px 16px",
          borderBottom:"1px solid #f3f4f6",
          display:"flex", alignItems:"center",
          justifyContent: (!isMobile && colapsadaEf) ? "center" : "space-between",
          gap: 8,
        }}>
          {(isMobile || !colapsadaEf) && (
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:15, fontWeight:700, color:"#111", letterSpacing:-0.3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{nomeEscritorio}</div>
              <div style={{ fontSize:11, color:"#d1d5db", marginTop:2 }}>Vicke</div>
            </div>
          )}
          {/* Botão de toggle: muda comportamento conforme dispositivo.
              - Desktop: alterna entre sidebar colapsada/expandida (preferência localStorage)
              - Mobile: fecha o drawer (X), pois colapsada não faz sentido em overlay */}
          <button
            onClick={() => {
              if (isMobile) setSidebarMobileAberta(false);
              else setSidebarColapsada(c => !c);
            }}
            title={isMobile ? "Fechar menu" : (colapsadaEf ? "Expandir menu" : "Recolher menu")}
            aria-label={isMobile ? "Fechar menu" : (colapsadaEf ? "Expandir menu" : "Recolher menu")}
            style={{
              background:"none", border:"none", cursor:"pointer",
              padding: isMobile ? 10 : 6, // touch target maior em mobile
              color:"#9ca3af", lineHeight:0,
              display:"flex", alignItems:"center", justifyContent:"center",
              borderRadius:6, fontFamily:"inherit",
            }}
            onMouseEnter={e => { if (!isMobile) { e.currentTarget.style.background="#f3f4f6"; e.currentTarget.style.color="#374151"; } }}
            onMouseLeave={e => { if (!isMobile) { e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#9ca3af"; } }}>
            {isMobile ? (
              // X de fechar em mobile
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              // Toggle panel-left em desktop
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
              </svg>
            )}
          </button>
        </div>
          <nav style={{ flex:1, padding:"12px 8px", display:"flex", flexDirection:"column", gap:2, overflowY:"auto" }}>
            {MENU.map(item => {
              const {k, label, count, sub, icon} = item;
              if (sub && sub.length) {
                const ativoNeleMesmoOuSubitem = aba === k || (typeof aba === "string" && aba.indexOf(k + ":") === 0);
                return (
                  <div key={k} style={{ display:"flex", flexDirection:"column", position:"relative" }}>
                    <button
                      id={k === "projetos" ? "trigger-projetos" : undefined}
                      title={colapsadaEf ? label : undefined}
                      style={{
                        ...itemStyle(ativoNeleMesmoOuSubitem),
                        justifyContent: colapsadaEf ? "center" : "flex-start",
                        gap: 6,
                        background: aba === k ? "#f3f4f6" : "transparent",
                        fontWeight: ativoNeleMesmoOuSubitem ? 600 : 400,
                        color: ativoNeleMesmoOuSubitem ? "#111" : "#6b7280",
                      }}
                      onMouseEnter={e => { if (aba !== k) e.currentTarget.style.background="#f9fafb"; }}
                      onMouseLeave={e => { if (aba !== k) e.currentTarget.style.background="transparent"; }}
                      onClick={(ev) => {
                        if (colapsadaEf) {
                          // Sidebar colapsada: abre popover lateral com os subitens.
                          // Posiciona absoluto à direita do botão.
                          const rect = ev.currentTarget.getBoundingClientRect();
                          setPopoverProjetos({ top: rect.top, left: rect.right + 4 });
                        } else {
                          // Sidebar aberta: comportamento accordion (expandir/recolher)
                          setProjetosAberto(o => !o);
                        }
                      }}
                    >
                      <span style={{ display:"flex", alignItems:"center", gap:10, flex:1, justifyContent: colapsadaEf ? "center" : "flex-start" }}>
                        {icon && <IconeMaster nome={icon} tamanho={16} cor={ativoNeleMesmoOuSubitem ? "#111" : "#6b7280"} />}
                        {!colapsadaEf && label}
                      </span>
                      {!colapsadaEf && (
                        <span style={{
                          color:"#9ca3af", fontSize:9,
                          transition:"transform 0.2s",
                          transform: projetosAberto ? "rotate(90deg)" : "rotate(0deg)",
                          display:"inline-block",
                          lineHeight: 1,
                        }}>▶</span>
                      )}
                    </button>
                    {/* Submenus inline (accordion) — só quando expandida */}
                    {!colapsadaEf && projetosAberto && (
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
                              <span style={{ display:"flex", alignItems:"center", gap:10 }}>
                                {s.icon && <IconeMaster nome={s.icon} tamanho={14} cor={ativoSub ? "#111" : "#9ca3af"} />}
                                {s.label}
                              </span>
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
                  title={colapsadaEf ? label : undefined}
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
                  <span style={{ display:"flex", alignItems:"center", gap:10 }}>
                    {icon && <IconeMaster nome={icon} tamanho={16} cor={aba===k ? "#111" : "#6b7280"} />}
                    {!colapsadaEf && label}
                  </span>
                  {!colapsadaEf && count > 0 && <span style={{ background:"#f3f4f6", color:"#9ca3af", fontSize:11, padding:"1px 7px", borderRadius:8 }}>{count}</span>}
                </button>
              );
            })}
          </nav>
          <div style={{ padding:"8px 8px 12px", borderTop:"1px solid #f3f4f6", display:"flex", flexDirection:"column", gap:2 }}>
            {/* Header da seção — esconde quando sidebar colapsada (não cabe). */}
            {!isMaster && !colapsadaEf && (
              <div style={{ fontSize:10, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.6, padding:"6px 12px 2px" }}>
                Configuração
              </div>
            )}
            {/* Botão Escritório só pra perfil escritório (Master vê tudo no menu principal) */}
            {!isMaster && (
              <button style={itemStyle(aba==="escritorio")}
                title={colapsadaEf ? "Escritório" : undefined}
                onMouseEnter={e => { if(aba!=="escritorio") e.currentTarget.style.background="#f9fafb"; }}
                onMouseLeave={e => { if(aba!=="escritorio") e.currentTarget.style.background="transparent"; }}
                onClick={() => { tentarTrocar(() => { setAba("escritorio"); setOrcamentoTelaCheia(null); setEscritorioKey(n=>n+1); }); }}>
                <span style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <IconeMaster nome="escritorio" tamanho={16} cor={aba==="escritorio" ? "#111" : "#6b7280"} />
                  {!colapsadaEf && "Escritório"}
                </span>
              </button>
            )}
            {/* Aba "Orçamento" — configurações de pricing/calibragem.
                Visível pra todos os perfis (botão interno é que valida permissão).
                Master também vê — útil pra Vicke caso queira testar o fluxo. */}
            <button style={itemStyle(aba==="orcamento")}
              title={colapsadaEf ? "Orçamento" : undefined}
              onMouseEnter={e => { if(aba!=="orcamento") e.currentTarget.style.background="#f9fafb"; }}
              onMouseLeave={e => { if(aba!=="orcamento") e.currentTarget.style.background="transparent"; }}
              onClick={() => { tentarTrocar(() => { setAba("orcamento"); setOrcamentoTelaCheia(null); }); }}>
              <span style={{ display:"flex", alignItems:"center", gap:10 }}>
                <IconeMaster nome="orcamento" tamanho={16} cor={aba==="orcamento" ? "#111" : "#6b7280"} />
                {!colapsadaEf && "Orçamento"}
              </span>
            </button>
            {/* Botão Escritório do Master (gerenciar dados da Vicke). Mantido aqui
                discretamente — uso raro mas existe. */}
            {isMaster && (
              <button style={itemStyle(aba==="escritorio")}
                title={colapsadaEf ? "Escritório (Master)" : undefined}
                onMouseEnter={e => { if(aba!=="escritorio") e.currentTarget.style.background="#f9fafb"; }}
                onMouseLeave={e => { if(aba!=="escritorio") e.currentTarget.style.background="transparent"; }}
                onClick={() => { tentarTrocar(() => { setAba("escritorio"); setOrcamentoTelaCheia(null); setEscritorioKey(n=>n+1); }); }}>
                <span style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <IconeMaster nome="escritorio" tamanho={16} cor={aba==="escritorio" ? "#111" : "#6b7280"} />
                  {!colapsadaEf && (
                    <>
                      Escritório
                      <span style={{ fontSize:9, fontWeight:700, color:"#1e3a8a", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:3, padding:"1px 5px", textTransform:"uppercase", letterSpacing:0.5 }}>Master</span>
                    </>
                  )}
                </span>
              </button>
            )}
            <div style={{ padding:"8px 12px", marginTop:4, display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
              {!colapsadaEf && (
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"#374151", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{usuario?.nome || "—"}</div>
                  <div style={{ fontSize:11, color:"#d1d5db" }}>{usuario?.perfil || ""}</div>
                </div>
              )}
              <button
                onClick={handleLogout}
                title="Sair"
                style={{
                  background:"none", border:"none", color:"#9ca3af",
                  fontSize:12, cursor:"pointer", fontFamily:"inherit",
                  padding: colapsadaEf ? "6px" : "4px 8px",
                  borderRadius:6, lineHeight:0,
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}
                onMouseEnter={e => { e.currentTarget.style.background="#f3f4f6"; e.currentTarget.style.color="#374151"; }}
                onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#9ca3af"; }}>
                {colapsadaEf ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                ) : "Sair"}
              </button>
            </div>
            {/* Importar/Exportar — só master. Discreto, no rodapé. */}
            {isMaster && !colapsadaEf && (
              <div style={{ padding:"4px 12px 8px", display:"flex", gap:6, fontSize:11 }}>
                <label style={{ flex:1, textAlign:"center", color:"#9ca3af", cursor:"pointer", border:"1px solid #f3f4f6", borderRadius:6, padding:"5px 8px" }}
                  onMouseEnter={e => { e.currentTarget.style.background="#f9fafb"; e.currentTarget.style.color="#374151"; }}
                  onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#9ca3af"; }}>
                  Importar
                  <input type="file" accept=".json" style={{ display:"none" }} onChange={importarDados} />
                </label>
                <button onClick={exportarDados}
                  style={{ flex:1, color:"#9ca3af", cursor:"pointer", border:"1px solid #f3f4f6", borderRadius:6, padding:"5px 8px", background:"transparent", fontFamily:"inherit", fontSize:11 }}
                  onMouseEnter={e => { e.currentTarget.style.background="#f9fafb"; e.currentTarget.style.color="#374151"; }}
                  onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#9ca3af"; }}>
                  Exportar
                </button>
              </div>
            )}
          </div>
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* ── Header mobile: aparece só em <768px. Tem hamburguer pra abrir
            o drawer da sidebar + nome do escritório (compacto). ── */}
        {isMobile && (
          <div style={{
            display:"flex", alignItems:"center", gap:10,
            padding:"10px 14px",
            borderBottom:"1px solid #f3f4f6",
            background:"#fff",
            zIndex: 10,
          }}>
            <button
              onClick={() => setSidebarMobileAberta(true)}
              aria-label="Abrir menu"
              style={{
                background:"none", border:"none",
                padding:8, lineHeight:0,
                cursor:"pointer", color:"#374151",
                borderRadius:6,
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
              {/* Ícone hamburguer Lucide */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div style={{
              fontSize:14, fontWeight:600, color:"#111",
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1,
            }}>
              {nomeEscritorio}
            </div>
          </div>
        )}
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
              escritorio={data.escritorio || {}}
              usuario={usuario}
              cub={data?.cub}
              modoVer={orcamentoTelaCheia.modo === "ver"}
              modoAbertura={orcamentoTelaCheia.modo}
              onSalvar={async (orc) => {
                // CRITICAL FIX — Cenário 1: usar dataRef.current em vez de data.
                // Este callback é criado na renderização em que orcamentoTelaCheia
                // mudou. Chamadas subsequentes (salvar orçamento + gerar proposta
                // + salvar snapshot) disparam este mesmo callback repetidas vezes,
                // e `data` capturado no closure fica congelado. Resultado: a 2ª
                // chamada sobrescreve orcamentosProjeto inteiro com o estado
                // antigo + mudança atual, perdendo atualizações intermediárias
                // (como propostas recém-salvas).
                // Solução: ler sempre de dataRef.current, que é atualizado em
                // tempo real pelo save() e pelo useEffect que segue `data`.
                const dataAtual = dataRef.current || data;
                const todos = dataAtual.orcamentosProjeto || [];
                const maxSeq = todos.reduce((mx2, o2) => {
                  const mm = (o2.id||"").match(/^ORC-(\d+)$/);
                  return mm ? Math.max(mx2, parseInt(mm[1])) : mx2;
                }, 0);
                const nextId = "ORC-" + String(maxSeq + 1).padStart(4, "0");
                const novo2 = {
                  ...orc,
                  clienteId: orcamentoTelaCheia.clienteOrc.id,
                  cliente: orcamentoTelaCheia.clienteOrc.nome,
                  whatsapp: orcamentoTelaCheia.clienteOrc.contatos?.find(c=>c.whatsapp)?.telefone || "",
                  id: orc.id || nextId,
                  criadoEm: orc.criadoEm || new Date().toISOString(),
                };
                const novos2 = orc.id
                  ? todos.map(o2=>o2.id===orc.id?novo2:o2)
                  : [...todos, novo2];
                await save({ ...dataAtual, orcamentosProjeto: novos2 });
                // Propaga o orc atualizado pro state de tela cheia, assim a
                // próxima edição/geração de proposta vai trabalhar em cima dele.
                setOrcamentoTelaCheia(prev => ({ ...prev, orcBase: novo2 }));
              }}
              onVoltar={() => {
                setClienteRetorno(orcamentoTelaCheia.clienteOrc);
                setOrcamentoTelaCheia(null);
                setAba("clientes");
                setClientesKey(n=>n+1);
                // Sem loadData — save() já atualizou data otimisticamente.
              }}
            />
          ) : (<>
          {aba === "home" && isMaster && <DashboardMaster setAba={setAba} data={data} tentarTrocar={tentarTrocar} />}
          {aba === "home" && !isMaster && <HomeMenu setAba={setAba} data={data} tentarTrocar={tentarTrocar} isMaster={isMaster} />}
          {aba === "clientes"               && <Clientes key={clientesKey} data={data} save={save} onReload={()=>setClientesKey(n=>n+1)} onAbrirOrcamento={(c, orc, modo) => setOrcamentoTelaCheia({ clienteOrc: c, orcBase: orc, modo: modo || "editar" })} orcamentoAberto={!!orcamentoTelaCheia} abrirClienteDetail={clienteRetorno} onClienteDetailAberto={() => setClienteRetorno(null)} abrirCadastroNovo={cadastroNovoCliente} onCadastroNovoAberto={() => setCadastroNovoCliente(false)} />}
          {aba === "projetos:etapas"        && <Etapas key={projetosKey} data={data} save={save} />}
          {aba === "projetos:orcamentos"    && <TesteOrcamento key={orcamentosKey} data={{ ...data, _usuario: usuario }} save={save} onCadastrarCliente={() => { setAba("clientes"); setClientesKey(n=>n+1); setCadastroNovoCliente(true); }} />}
          {aba === "obras"                  && <Obras key={obrasKey} data={data} save={save} />}
          {aba === "financeiro"             && <Financeiro key={financeiroKey} data={data} save={save} />}
          {aba === "fornecedores"           && <Fornecedores key={fornecedoresKey} data={data} save={save} />}
          {aba === "nf"                     && <ImportarNF data={data} save={save} />}
          {aba === "escritorio"             && <Escritorio key={escritorioKey} data={data} save={save} />}
          {aba === "orcamento"              && <OrcamentoConfig usuario={usuario} data={data} />}
          {/* Sub-abas do menu Master — Admin recebe initialTab pra abrir direto na aba certa */}
          {aba === "admin" && isMaster && <Admin usuario={usuario} data={data} save={save} />}
          {aba === "admin:empresas" && isMaster && <Admin usuario={usuario} data={data} save={save} initialTab="empresas" />}
          {aba === "admin:usuarios-master" && isMaster && <Admin usuario={usuario} data={data} save={save} initialTab="usuarios-master" />}
          {aba === "admin:manutencao" && isMaster && <Admin usuario={usuario} data={data} save={save} initialTab="manutencao" />}
          {aba === "admin:feedback" && isMaster && <Admin usuario={usuario} data={data} save={save} initialTab="feedback" />}
          {aba === "admin:cub" && isMaster && <Admin usuario={usuario} data={data} save={save} initialTab="cub" />}
          {/* Caixa de Mensagens — só Master */}
          {aba === "mensagens" && isMaster && <Mensagens usuario={usuario} />}
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
    {/* ── Popover dos subitens de Projetos (sidebar colapsada) ──
        Posicionado fixed na coordenada do trigger. Click fora fecha (handler
        em useEffect mais acima). Aparece à direita do botão na sidebar. */}
    {popoverProjetos && colapsadaEf && (() => {
      const projetosItem = MENU.find(m => m.k === "projetos");
      if (!projetosItem) return null;
      return (
        <div
          id="popover-projetos"
          style={{
            position:"fixed",
            top: popoverProjetos.top,
            left: popoverProjetos.left,
            background:"#fff",
            border:"1px solid #e5e7eb",
            borderRadius:8,
            boxShadow:"0 4px 16px rgba(0,0,0,0.08)",
            padding:"6px",
            minWidth:180,
            zIndex:1000,
            fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",
            display:"flex", flexDirection:"column", gap:1,
          }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.6, padding:"6px 10px 4px" }}>
            {projetosItem.label}
          </div>
          {projetosItem.sub.map(s => {
            const ativoSub = aba === s.k;
            return (
              <button
                key={s.k}
                onClick={() => {
                  tentarTrocar(() => {
                    setAba(s.k);
                    setOrcamentoTelaCheia(null);
                    if (s.k === "projetos:etapas") setProjetosKey(n => n+1);
                    if (s.k === "projetos:orcamentos") setOrcamentosKey(n => n+1);
                  });
                  setPopoverProjetos(null);
                }}
                style={{
                  display:"flex", alignItems:"center", gap:10,
                  padding:"7px 10px", borderRadius:6, fontSize:12.5,
                  border:"none", background: ativoSub ? "#f3f4f6" : "transparent",
                  color: ativoSub ? "#111" : "#374151",
                  fontWeight: ativoSub ? 600 : 400,
                  fontFamily:"inherit", cursor:"pointer", textAlign:"left",
                }}
                onMouseEnter={e => { if (!ativoSub) e.currentTarget.style.background="#f9fafb"; }}
                onMouseLeave={e => { if (!ativoSub) e.currentTarget.style.background="transparent"; }}>
                {s.icon && <IconeMaster nome={s.icon} tamanho={14} cor={ativoSub ? "#111" : "#9ca3af"} />}
                {s.label}
              </button>
            );
          })}
        </div>
      );
    })()}
    <DialogosHost />
    <VersionWatcher />
    <BotaoFeedbackFlutuante usuario={usuario} />
    {conflitoModal}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// CLIENTES
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// HOME — MENU PRINCIPAL
// ═══════════════════════════════════════════════════════════════
