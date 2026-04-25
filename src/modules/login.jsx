// ═══════════════════════════════════════════════════════════════
// LOGIN — Vicke
// ═══════════════════════════════════════════════════════════════
// Auth local: salva/lê token e usuário no localStorage.
// URL do backend vem de API_URL (shared.jsx / VITE_API_URL).

const TOKEN_KEY = "vicke-token";
const USER_KEY  = "vicke-user";

function getToken()   { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } }
function getUser()    { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } }
function saveAuth(token, usuario) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(usuario));
}
function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// POST sem Authorization (login não tem token ainda).
// Não usa api.js pra manter o fluxo isolado e legível.
async function apiPost(path, body) {
  // API_URL é global (declarada em shared.jsx)
  const _url = (typeof API_URL !== "undefined" && API_URL)
    || "https://orbi-production-5f5c.up.railway.app";
  const res = await fetch(_url + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

function TelaLogin({ onLogin }) {
  const [email, setEmail]       = useState("");
  const [senha, setSenha]       = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro]         = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleLogin() {
    if (!email || !senha) { setErro("Preencha e-mail e senha."); return; }
    setErro("");
    setLoading(true);
    try {
      const res = await apiPost("/auth/login", { email, senha });
      if (res.ok) {
        saveAuth(res.data.token, res.data.usuario);
        onLogin(res.data.usuario, res.data.token);
      } else {
        setErro(res.error || "E-mail ou senha inválidos.");
      }
    } catch (e) {
      console.error("Erro de login:", e);
      setErro("Não foi possível conectar ao servidor.");
    }
    setLoading(false);
  }

  function handleKey(e) { if (e.key === "Enter") handleLogin(); }

  const S = {
    wrap: {
      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#fff",
      padding: "20px",
    },
    box: {
      width: "100%",
      maxWidth: 360,
    },
    header: {
      textAlign: "center",
      marginBottom: 32,
    },
    titulo: {
      fontSize: 22,
      fontWeight: 700,
      color: "#111",
      letterSpacing: -0.5,
      margin: 0,
    },
    sub: {
      fontSize: 13,
      color: "#9ca3af",
      marginTop: 6,
    },
    card: {
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: "28px 24px",
    },
    label: {
      fontSize: 13,
      color: "#6b7280",
      display: "block",
      marginBottom: 6,
    },
    input: {
      width: "100%",
      border: "1px solid #d1d5db",
      borderRadius: 10,
      padding: "11px 14px",
      fontSize: 14,
      color: "#111",
      outline: "none",
      background: "#fff",
      boxSizing: "border-box",
      fontFamily: "inherit",
      transition: "border-color 0.15s",
    },
    grupo: { marginBottom: 16 },
    btn: {
      width: "100%",
      background: "#111",
      color: "#fff",
      border: "none",
      borderRadius: 10,
      padding: "12px 0",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "inherit",
      marginTop: 8,
      opacity: loading ? 0.6 : 1,
    },
    erro: {
      fontSize: 13,
      color: "#dc2626",
      textAlign: "center",
      marginTop: 12,
      minHeight: 20,
    },
    rodape: {
      textAlign: "center",
      marginTop: 24,
      fontSize: 12,
      color: "#d1d5db",
    },
  };

  return (
    <div style={S.wrap}>
      <div style={S.box}>
        <div style={S.header}>
          <div style={S.titulo}>Vicke</div>
          <div style={S.sub}>Entre na sua conta</div>
        </div>
        <div style={S.card}>
          <div style={S.grupo}>
            <label style={S.label}>E-mail</label>
            <input
              style={S.input}
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKey}
              autoFocus
            />
          </div>
          <div style={S.grupo}>
            <label style={S.label}>Senha</label>
            {/* Wrapper position:relative pra ancorar o botão "olho" sobre o input.
                Padding direito reservado pro botão (40px) evitar texto sobrepor o ícone. */}
            <div style={{ position:"relative" }}>
              <input
                style={{ ...S.input, paddingRight: 40 }}
                type={mostrarSenha ? "text" : "password"}
                placeholder="••••••••"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                onKeyDown={handleKey}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(v => !v)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                style={{
                  position:"absolute",
                  right: 8,
                  top:"50%",
                  transform:"translateY(-50%)",
                  background:"none",
                  border:"none",
                  padding: 6,
                  cursor:"pointer",
                  color:"#9ca3af",
                  display:"flex",
                  alignItems:"center",
                  justifyContent:"center",
                  borderRadius: 6,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "#374151"; e.currentTarget.style.background = "#f3f4f6"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#9ca3af"; e.currentTarget.style.background = "none"; }}
              >
                {mostrarSenha ? (
                  // Ícone de "olho cortado" — senha visível, clique pra ocultar.
                  // SVG inline pra não depender de lib externa (login é o caminho crítico).
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                    <line x1="2" y1="2" x2="22" y2="22"/>
                  </svg>
                ) : (
                  // Olho aberto — senha oculta, clique pra mostrar
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button style={S.btn} onClick={handleLogin} disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
          {erro && <div style={S.erro}>{erro}</div>}
        </div>
        <div style={S.rodape}>Vicke — Conectando elos</div>
      </div>
    </div>
  );
}
