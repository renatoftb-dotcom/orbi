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

function DashboardMaster({ data, setAba, tentarTrocar }) {
  const [dash, setDash]     = useState(null);
  const [loading, setLoad]  = useState(true);
  const [erro, setErro]     = useState(null);

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
  const modulos = [
    { k:"mensagens",              label:"Mensagens",       desc:"Caixa do time VICKE" },
    { k:"admin:empresas",         label:"Empresas",        desc:"Gerenciar empresas cadastradas" },
    { k:"admin:usuarios-master",  label:"Usuários Master", desc:"Acessos da equipe Vicke" },
    { k:"admin:manutencao",       label:"Manutenção",      desc:"Jobs e operações do sistema" },
  ];

  return (
    <div style={{ padding:"32px 32px 60px", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", maxWidth:1100, margin:"0 auto" }}>
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:24, fontWeight:600, color:"#111", letterSpacing:-0.3 }}>Dashboard</div>
        <div style={{ fontSize:13, color:"#9ca3af", marginTop:4 }}>Visão geral da plataforma VICKE</div>
      </div>

      {erro && (
        <div style={{ background:"#fef2f2", border:"1px solid #fecaca", color:"#991b1b", borderRadius:9, padding:"10px 14px", fontSize:13, marginBottom:20 }}>
          Erro ao carregar dashboard: {erro}
        </div>
      )}

      {/* ── 4 Cards de números ── */}
      <DashboardCards counts={dash?.counts} loading={loading} setAba={setAba} tentarTrocar={tentarTrocar} />

      {/* ── Navegação (acesso rápido sempre acima da dobra) ──
          Movido pra cima do feed: convenção SaaS (Linear/Vercel/Stripe) é
          navegação primária no topo, atividade/feed embaixo. Com volume de
          empresas crescendo, feed pode esticar muito — não pode empurrar
          os cards de navegação pra fora da tela. */}
      <div style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:12, marginTop:8 }}>Acesso rápido</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:12, marginBottom:32 }}>
        {modulos.map(m => (
          <button key={m.k} onClick={() => { const go = () => setAba(m.k); if (tentarTrocar) tentarTrocar(go); else go(); }}
            style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"16px", textAlign:"left", cursor:"pointer", fontFamily:"inherit" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor="#111"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor="#e5e7eb"; }}>
            <div style={{ fontSize:13, fontWeight:600, color:"#111", marginBottom:4 }}>{m.label}</div>
            <div style={{ fontSize:11.5, color:"#9ca3af" }}>{m.desc}</div>
          </button>
        ))}
      </div>

      {/* ── Feed de atividade recente ── */}
      <DashboardFeed feed={dash?.feed} loading={loading} />
    </div>
  );
}

// 4 Cards de números. Cada card é clicável quando faz sentido (ex: mensagens
// não-lidas leva pra caixa; signups leva pra empresas). Card de logins não tem
// destino útil no momento, fica não-clicável.
function DashboardCards({ counts, loading, setAba, tentarTrocar }) {
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
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:12, marginBottom:28 }}>
      {items.map((it, i) => (
        <div
          key={i}
          onClick={it.onClick}
          style={{
            background:"#fff",
            border: it.destaque ? "1px solid #f59e0b" : "1px solid #e5e7eb",
            borderRadius:12, padding:"16px 18px",
            cursor: it.onClick ? "pointer" : "default",
            transition:"border-color 0.12s",
          }}
          onMouseEnter={e => { if (it.onClick) e.currentTarget.style.borderColor = "#111"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = it.destaque ? "#f59e0b" : "#e5e7eb"; }}>
          <div style={{ fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.6, marginBottom:8 }}>
            {it.label}
          </div>
          <div style={{ fontSize:28, fontWeight:600, color:"#111", lineHeight:1.1, fontVariantNumeric:"tabular-nums" }}>
            {it.value}
          </div>
          {it.sub && (
            <div style={{ fontSize:11.5, color:"#9ca3af", marginTop:4 }}>{it.sub}</div>
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
function DashboardFeed({ feed, loading }) {
  return (
    <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"16px 18px" }}>
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
          maxHeight:480, overflowY:"auto",
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

  // Mapas — fáceis de estender quando criarmos eventos novos
  const COR_VERDE   = "#16a34a";
  const COR_VERMELHO= "#dc2626";
  const COR_AZUL    = "#3b82f6";
  const COR_LARANJA = "#f59e0b";
  const COR_CINZA   = "#9ca3af";

  if (acao === "usuario.login_sucesso") return { cor: COR_VERDE,    descricao: "Login bem-sucedido" };
  if (acao === "usuario.login_falha")   return { cor: COR_VERMELHO, descricao: `Login falhou${dados.motivo ? " — " + dados.motivo.replace(/_/g, " ") : ""}` };
  if (acao === "usuario.signup")        return { cor: COR_AZUL,     descricao: `Nova empresa cadastrada: ${dados.empresa_nome || ev.recurso_id}` };
  if (acao === "usuario.senha_alterada") return { cor: COR_LARANJA, descricao: "Senha alterada" };
  if (acao === "usuario.senha_resetada") return { cor: COR_LARANJA, descricao: `Senha resetada por ${dados.alterado_por === "admin_master" ? "master" : "admin de empresa"} (alvo: ${dados.alvo_email || ev.recurso_id})` };
  if (acao === "usuario.troca_senha_falha") return { cor: COR_VERMELHO, descricao: `Tentativa de troca de senha falhou${dados.motivo ? " — " + dados.motivo.replace(/_/g, " ") : ""}` };
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
  ] : [
    { k:"clientes",         label:"Clientes",     desc:"Cadastro e orçamentos",     count: data?.clientes?.length },
    { k:"projetos:etapas",  label:"Projetos",     desc:"Etapas e prazos" },
    { k:"obras",            label:"Obras",        desc:"Acompanhamento e execução" },
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
          padding:"6px 8px", fontSize:14, lineHeight:1,
          color:"#9ca3af", fontFamily:"inherit",
        }}>
        {visivel ? "🙈" : "👁"}
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

  useEffect(() => { if (autenticado) { setLoading(true); loadData(); } }, [autenticado]);

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
    { k:"home",                   label:"Painel" },
    { k:"mensagens",              label:"Mensagens" },
    { k:"admin:empresas",         label:"Empresas" },
    { k:"admin:usuarios-master",  label:"Usuários Master" },
    { k:"admin:manutencao",       label:"Manutenção" },
  ] : [
    { k:"home",        label:"Início" },
    { k:"clientes",    label:"Clientes",     count: data?.clientes?.length },
    { k:"projetos", label:"Projetos", sub: [
      { k:"projetos:orcamentos", label:"Orçamentos" },
      { k:"projetos:etapas",     label:"Em Andamento" },
    ]},
    { k:"obras",       label:"Obras" },
    // Módulos Financeiro, Fornecedores e Notas Fiscais foram removidos do menu
    // (decisão Sprint 3): serão refeitos do zero. Mantenho os componentes/rotas
    // por enquanto pra não quebrar dados antigos, só ocultos do menu.
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
    <>
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
                        // CORREÇÃO: o botão "Projetos" só deve ter fundo cinza quando
                        // a aba ativa é "projetos:*" (subitem). Se aba é "projetos"
                        // exato OU outra coisa (ex: "home"), não destaca o pai —
                        // só os subitens fazem destaque visual.
                        // Antes: ativoNeleMesmoOuSubitem incluía aba==="projetos:*"
                        // o que pintava o pai junto. Agora pai sempre transparente
                        // (a menos que aba===k exato, raro).
                        background: aba === k ? "#f3f4f6" : "transparent",
                        fontWeight: ativoNeleMesmoOuSubitem ? 600 : 400,
                        color: ativoNeleMesmoOuSubitem ? "#111" : "#6b7280",
                      }}
                      onMouseEnter={e => { if (aba !== k) e.currentTarget.style.background="#f9fafb"; }}
                      onMouseLeave={e => { if (aba !== k) e.currentTarget.style.background="transparent"; }}
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
            {/* Botão Escritório só pra perfil escritório (Master vê tudo no menu principal) */}
            {!isMaster && (
              <button style={itemStyle(aba==="escritorio")}
                onMouseEnter={e => { if(aba!=="escritorio") e.currentTarget.style.background="#f9fafb"; }}
                onMouseLeave={e => { if(aba!=="escritorio") e.currentTarget.style.background="transparent"; }}
                onClick={() => { tentarTrocar(() => { setAba("escritorio"); setOrcamentoTelaCheia(null); setEscritorioKey(n=>n+1); }); }}>
                Escritório
              </button>
            )}
            {/* Botão Escritório do Master (gerenciar dados da Vicke). Mantido aqui
                discretamente — uso raro mas existe. */}
            {isMaster && (
              <button style={itemStyle(aba==="escritorio")}
                onMouseEnter={e => { if(aba!=="escritorio") e.currentTarget.style.background="#f9fafb"; }}
                onMouseLeave={e => { if(aba!=="escritorio") e.currentTarget.style.background="transparent"; }}
                onClick={() => { tentarTrocar(() => { setAba("escritorio"); setOrcamentoTelaCheia(null); setEscritorioKey(n=>n+1); }); }}>
                <span style={{ display:"flex", alignItems:"center", gap:6 }}>
                  Escritório
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
          {/* Import/Export: só master. Editor/admin de escritório não precisam
              exportar/importar banco inteiro — isso é tarefa do dono do SaaS. */}
          {isMaster ? (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, color:"#9ca3af", cursor:"pointer", border:"1px solid #e5e7eb", borderRadius:6, padding:"5px 10px" }}>
                Importar
                <input type="file" accept=".json" style={{ display:"none" }} onChange={importarDados} />
              </label>
              <button onClick={exportarDados} style={{ fontSize:12, color:"#6b7280", cursor:"pointer", border:"1px solid #e5e7eb", borderRadius:6, padding:"5px 10px", background:"#fff", fontFamily:"inherit" }}>
                Exportar backup
              </button>
            </div>
          ) : <div />}
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
              escritorio={data.escritorio || {}}
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
          {aba === "projetos:orcamentos"    && <TesteOrcamento key={orcamentosKey} data={data} save={save} onCadastrarCliente={() => { setAba("clientes"); setClientesKey(n=>n+1); setCadastroNovoCliente(true); }} />}
          {aba === "obras"                  && <Obras key={obrasKey} data={data} save={save} />}
          {aba === "financeiro"             && <Financeiro key={financeiroKey} data={data} save={save} />}
          {aba === "fornecedores"           && <Fornecedores key={fornecedoresKey} data={data} save={save} />}
          {aba === "nf"                     && <ImportarNF data={data} save={save} />}
          {aba === "escritorio"             && <Escritorio key={escritorioKey} data={data} save={save} />}
          {/* Sub-abas do menu Master — Admin recebe initialTab pra abrir direto na aba certa */}
          {aba === "admin" && isMaster && <Admin usuario={usuario} data={data} save={save} />}
          {aba === "admin:empresas" && isMaster && <Admin usuario={usuario} data={data} save={save} initialTab="empresas" />}
          {aba === "admin:usuarios-master" && isMaster && <Admin usuario={usuario} data={data} save={save} initialTab="usuarios-master" />}
          {aba === "admin:manutencao" && isMaster && <Admin usuario={usuario} data={data} save={save} initialTab="manutencao" />}
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
    <DialogosHost />
    <VersionWatcher />
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
