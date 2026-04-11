// ═══════════════════════════════════════════════════════════════
// LOGIN — Vicke
// ═══════════════════════════════════════════════════════════════

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

function TelaLogin({ onLogin }) {
  const [email, setEmail]       = React.useState("");
  const [senha, setSenha]       = React.useState("");
  const [erro, setErro]         = React.useState("");
  const [loading, setLoading]   = React.useState(false);

  async function handleLogin() {
    if (!email || !senha) { setErro("Preencha e-mail e senha."); return; }
    setErro("");
    setLoading(true);
    try {
      const res  = await apiPost("/auth/login", { email, senha });
      if (res.ok) {
        saveAuth(res.data.token, res.data.usuario);
        onLogin(res.data.usuario, res.data.token);
      } else {
        setErro(res.error || "E-mail ou senha inválidos.");
      }
    } catch {
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
            <input
              style={S.input}
              type="password"
              placeholder="••••••••"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              onKeyDown={handleKey}
            />
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
