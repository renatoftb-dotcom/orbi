// ═══════════════════════════════════════════════════════════════
// LOGIN + CADASTRO SELF-SERVICE — Vicke
// ═══════════════════════════════════════════════════════════════
// 3 telas alternantes (controladas por estado local):
//   1. "login"           — entrada normal por email/senha
//   2. "cadastro-form"   — usuário novo: nome empresa, CNPJ, email, senha
//   3. "cadastro-codigo" — digite código de 6 dígitos enviado por email
//
// Após validar código, recebe JWT e usuário direto via auto-login
// (chama onLogin do pai) — sem precisar fazer login manual depois.

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

// POST sem Authorization (auth não tem token ainda)
async function apiPost(path, body) {
  const _url = (typeof API_URL !== "undefined" && API_URL)
    || "https://orbi-production-5f5c.up.railway.app";
  const res = await fetch(_url + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ───────────────────────────────────────────────────────────────
// Estilos compartilhados pelas 3 telas
// ───────────────────────────────────────────────────────────────
function getEstilos(loading) {
  return {
    wrap: {
      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#fff",
      padding: "20px",
    },
    box: { width: "100%", maxWidth: 360 },
    header: { textAlign: "center", marginBottom: 32 },
    titulo: { fontSize: 22, fontWeight: 700, color: "#111", letterSpacing: -0.5, margin: 0 },
    sub: { fontSize: 13, color: "#9ca3af", marginTop: 6 },
    card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "28px 24px" },
    label: { fontSize: 13, color: "#6b7280", display: "block", marginBottom: 6 },
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
    btnSec: {
      width: "100%",
      background: "#fff",
      color: "#374151",
      border: "1px solid #d1d5db",
      borderRadius: 10,
      padding: "12px 0",
      fontSize: 14,
      fontWeight: 500,
      cursor: "pointer",
      fontFamily: "inherit",
      marginTop: 8,
    },
    erro: { fontSize: 13, color: "#dc2626", textAlign: "center", marginTop: 12, minHeight: 20 },
    info: { fontSize: 13, color: "#059669", textAlign: "center", marginTop: 12, minHeight: 20 },
    rodape: { textAlign: "center", marginTop: 24, fontSize: 12, color: "#d1d5db" },
    // Link "Criar conta" / "Voltar pro login"
    linkSec: {
      textAlign: "center",
      marginTop: 16,
      fontSize: 13,
      color: "#6b7280",
    },
    linkBtn: {
      background: "none",
      border: "none",
      color: "#111",
      fontWeight: 600,
      cursor: "pointer",
      padding: 0,
      fontSize: 13,
      fontFamily: "inherit",
      textDecoration: "underline",
      textUnderlineOffset: 3,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// TelaAuth — wrapper que decide entre login / cadastro / código
// ═══════════════════════════════════════════════════════════════
function TelaLogin({ onLogin }) {
  // Estado da tela ativa: "login" | "cadastro-form" | "cadastro-codigo"
  const [tela, setTela] = useState("login");
  // Email persistido entre telas: usuário digitou no cadastro,
  // precisamos lembrar dele ao mostrar a tela do código.
  const [emailCadastro, setEmailCadastro] = useState("");

  if (tela === "cadastro-form") {
    return (
      <TelaCadastro
        onVoltar={() => setTela("login")}
        onCodigoEnviado={email => {
          setEmailCadastro(email);
          setTela("cadastro-codigo");
        }}
      />
    );
  }

  if (tela === "cadastro-codigo") {
    return (
      <TelaCadastroCodigo
        email={emailCadastro}
        onVoltar={() => setTela("cadastro-form")}
        onValidado={(usuario, token) => {
          saveAuth(token, usuario);
          onLogin(usuario, token);
        }}
      />
    );
  }

  return <TelaLoginEntrada onLogin={onLogin} onCriarConta={() => setTela("cadastro-form")} />;
}

// ═══════════════════════════════════════════════════════════════
// 1. Tela de Login (email + senha)
// ═══════════════════════════════════════════════════════════════
function TelaLoginEntrada({ onLogin, onCriarConta }) {
  const [email, setEmail]               = useState("");
  const [senha, setSenha]               = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro]                 = useState("");
  const [loading, setLoading]           = useState(false);
  const S = getEstilos(loading);

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
                  position:"absolute", right: 8, top:"50%", transform:"translateY(-50%)",
                  background:"none", border:"none", padding: 6, cursor:"pointer",
                  color:"#9ca3af", display:"flex", alignItems:"center", justifyContent:"center",
                  borderRadius: 6,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "#374151"; e.currentTarget.style.background = "#f3f4f6"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#9ca3af"; e.currentTarget.style.background = "none"; }}
              >
                {mostrarSenha ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                    <line x1="2" y1="2" x2="22" y2="22"/>
                  </svg>
                ) : (
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
        {/* Link de cadastro — caminho de baixa fricção pra novos usuários */}
        <div style={S.linkSec}>
          Não tem conta?{" "}
          <button style={S.linkBtn} onClick={onCriarConta}>Criar conta</button>
        </div>
        <div style={S.rodape}>Vicke — Conectando elos</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 2. Tela de Cadastro (form com dados da empresa + admin)
// ═══════════════════════════════════════════════════════════════
function TelaCadastro({ onVoltar, onCodigoEnviado }) {
  const [nomeEmpresa, setNomeEmpresa]   = useState("");
  const [cnpjCpf, setCnpjCpf]           = useState("");
  const [nomeResp, setNomeResp]         = useState("");
  const [email, setEmail]               = useState("");
  const [senha, setSenha]               = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro]                 = useState("");
  const [loading, setLoading]           = useState(false);
  const S = getEstilos(loading);

  async function handleCadastrar() {
    setErro("");
    if (!nomeEmpresa.trim()) return setErro("Informe o nome do escritório.");
    if (!nomeResp.trim())    return setErro("Informe seu nome.");
    if (!email.trim())       return setErro("Informe seu e-mail.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErro("E-mail inválido.");
    if (senha.length < 6)    return setErro("Senha deve ter no mínimo 6 caracteres.");

    setLoading(true);
    try {
      const res = await apiPost("/auth/signup-iniciar", {
        nome_empresa: nomeEmpresa,
        cnpj_cpf: cnpjCpf || null,
        nome_responsavel: nomeResp,
        email,
        senha,
      });
      if (res.ok) {
        // Sobe pra próxima tela com email memorizado
        onCodigoEnviado(email.trim().toLowerCase());
      } else {
        setErro(res.error || "Não foi possível criar a conta.");
      }
    } catch (e) {
      console.error("Erro signup:", e);
      setErro("Não foi possível conectar ao servidor.");
    }
    setLoading(false);
  }

  return (
    <div style={S.wrap}>
      <div style={S.box}>
        <div style={S.header}>
          <div style={S.titulo}>Criar conta</div>
          <div style={S.sub}>Preencha os dados pra começar</div>
        </div>
        <div style={S.card}>
          <div style={S.grupo}>
            <label style={S.label}>Nome do escritório *</label>
            <input
              style={S.input}
              placeholder="Ex: Vicke Associados"
              value={nomeEmpresa}
              onChange={e => setNomeEmpresa(e.target.value)}
              autoFocus
            />
          </div>
          <div style={S.grupo}>
            <label style={S.label}>CNPJ / CPF <span style={{ color:"#9ca3af", fontWeight:400 }}>(opcional)</span></label>
            <input
              style={S.input}
              placeholder="00.000.000/0001-00"
              value={cnpjCpf}
              onChange={e => setCnpjCpf(e.target.value)}
            />
          </div>
          <div style={S.grupo}>
            <label style={S.label}>Seu nome *</label>
            <input
              style={S.input}
              placeholder="Como você quer ser chamado"
              value={nomeResp}
              onChange={e => setNomeResp(e.target.value)}
            />
          </div>
          <div style={S.grupo}>
            <label style={S.label}>E-mail *</label>
            <input
              style={S.input}
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div style={S.grupo}>
            <label style={S.label}>Senha * <span style={{ color:"#9ca3af", fontWeight:400 }}>(mínimo 6 caracteres)</span></label>
            <div style={{ position:"relative" }}>
              <input
                style={{ ...S.input, paddingRight: 40 }}
                type={mostrarSenha ? "text" : "password"}
                placeholder="••••••••"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCadastrar(); }}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(v => !v)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                style={{
                  position:"absolute", right: 8, top:"50%", transform:"translateY(-50%)",
                  background:"none", border:"none", padding: 6, cursor:"pointer",
                  color:"#9ca3af", display:"flex", alignItems:"center", justifyContent:"center",
                  borderRadius: 6,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "#374151"; e.currentTarget.style.background = "#f3f4f6"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "#9ca3af"; e.currentTarget.style.background = "none"; }}
              >
                {mostrarSenha ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                    <line x1="2" y1="2" x2="22" y2="22"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button style={S.btn} onClick={handleCadastrar} disabled={loading}>
            {loading ? "Enviando código..." : "Continuar"}
          </button>
          {erro && <div style={S.erro}>{erro}</div>}
        </div>
        <div style={S.linkSec}>
          Já tem conta?{" "}
          <button style={S.linkBtn} onClick={onVoltar}>Entrar</button>
        </div>
        <div style={S.rodape}>Vicke — Conectando elos</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 3. Tela do código (6 dígitos enviados por email)
// ═══════════════════════════════════════════════════════════════
function TelaCadastroCodigo({ email, onVoltar, onValidado }) {
  // 6 dígitos individuais — UX padrão de OTP (Stripe, Vercel, Linear)
  // Refs pra mover foco automaticamente entre inputs
  const [digitos, setDigitos] = useState(["", "", "", "", "", ""]);
  const [erro, setErro]       = useState("");
  const [info, setInfo]       = useState("");
  const [loading, setLoading] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  // Cooldown do botão "Reenviar" (60s) — evita spam
  const [cooldown, setCooldown] = useState(0);
  const refsInputs = useRef([]);
  const S = getEstilos(loading);

  // Auto-foca primeiro input ao montar
  useEffect(() => {
    if (refsInputs.current[0]) refsInputs.current[0].focus();
  }, []);

  // Decrementa cooldown a cada segundo
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function handleChangeDigito(idx, valor) {
    // Aceita só dígitos. Se colaram número longo, distribui pelos campos.
    const limpo = valor.replace(/\D/g, "");
    if (!limpo) {
      setDigitos(d => { const n = [...d]; n[idx] = ""; return n; });
      return;
    }
    if (limpo.length === 1) {
      setDigitos(d => { const n = [...d]; n[idx] = limpo; return n; });
      // Auto-avança próximo input
      if (idx < 5 && refsInputs.current[idx + 1]) refsInputs.current[idx + 1].focus();
    } else {
      // Colaram >1 dígito: distribui a partir do idx atual
      setDigitos(d => {
        const n = [...d];
        for (let i = 0; i < limpo.length && idx + i < 6; i++) {
          n[idx + i] = limpo[i];
        }
        return n;
      });
      // Foca no próximo após o último preenchido (ou último input)
      const proxIdx = Math.min(idx + limpo.length, 5);
      if (refsInputs.current[proxIdx]) refsInputs.current[proxIdx].focus();
    }
  }

  function handleKeyDown(idx, e) {
    if (e.key === "Backspace" && !digitos[idx] && idx > 0) {
      // Backspace em campo vazio: volta pro anterior
      refsInputs.current[idx - 1].focus();
    }
    if (e.key === "Enter") {
      handleValidar();
    }
  }

  // Auto-valida quando todos 6 dígitos preenchem
  useEffect(() => {
    if (digitos.every(d => d !== "")) {
      handleValidar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digitos]);

  async function handleValidar() {
    const codigo = digitos.join("");
    if (codigo.length !== 6) return setErro("Digite os 6 dígitos.");
    setErro("");
    setInfo("");
    setLoading(true);
    try {
      const res = await apiPost("/auth/signup-validar", { email, codigo });
      if (res.ok) {
        // JWT + usuário retornados — auto-login
        onValidado(res.data.usuario, res.data.token);
      } else {
        setErro(res.error || "Código inválido.");
        // Limpa os dígitos pra usuário tentar de novo
        setDigitos(["", "", "", "", "", ""]);
        if (refsInputs.current[0]) refsInputs.current[0].focus();
      }
    } catch (e) {
      console.error("Erro validar código:", e);
      setErro("Não foi possível conectar ao servidor.");
    }
    setLoading(false);
  }

  async function handleReenviar() {
    if (cooldown > 0) return;
    setReenviando(true);
    setErro("");
    setInfo("");
    try {
      const res = await apiPost("/auth/signup-reenviar", { email });
      if (res.ok) {
        setInfo("Novo código enviado para seu e-mail.");
        setCooldown(60);
        setDigitos(["", "", "", "", "", ""]);
        if (refsInputs.current[0]) refsInputs.current[0].focus();
      } else {
        setErro(res.error || "Não foi possível reenviar o código.");
      }
    } catch (e) {
      console.error("Erro reenviar:", e);
      setErro("Não foi possível conectar ao servidor.");
    }
    setReenviando(false);
  }

  // Estilo dos 6 inputs do código — quadradinhos grandes
  const inputCodigo = {
    width: 44,
    height: 52,
    border: "1.5px solid #d1d5db",
    borderRadius: 8,
    fontSize: 22,
    fontWeight: 600,
    color: "#111",
    textAlign: "center",
    outline: "none",
    background: "#fff",
    fontFamily: "'SF Mono', Menlo, Consolas, monospace",
    padding: 0,
    transition: "border-color 0.15s, box-shadow 0.15s",
  };

  return (
    <div style={S.wrap}>
      <div style={S.box}>
        <div style={S.header}>
          <div style={S.titulo}>Digite o código</div>
          <div style={S.sub}>
            Enviamos um código de 6 dígitos para<br/>
            <span style={{ color:"#374151", fontWeight:500 }}>{email}</span>
          </div>
        </div>
        <div style={S.card}>
          {/* 6 quadradinhos pra dígito */}
          <div style={{ display:"flex", justifyContent:"space-between", gap:6, marginBottom:20 }}>
            {digitos.map((d, idx) => (
              <input
                key={idx}
                ref={el => { refsInputs.current[idx] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={d}
                onChange={e => handleChangeDigito(idx, e.target.value)}
                onKeyDown={e => handleKeyDown(idx, e)}
                onFocus={e => { e.currentTarget.style.borderColor = "#111"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                style={inputCodigo}
                disabled={loading}
              />
            ))}
          </div>
          <button style={S.btn} onClick={handleValidar} disabled={loading}>
            {loading ? "Validando..." : "Confirmar"}
          </button>
          {erro && <div style={S.erro}>{erro}</div>}
          {info && <div style={S.info}>{info}</div>}
          <div style={{ textAlign:"center", marginTop:16 }}>
            <button
              style={{
                background:"none", border:"none", color: cooldown > 0 ? "#d1d5db" : "#6b7280",
                fontSize: 13, cursor: cooldown > 0 ? "default" : "pointer", fontFamily:"inherit",
                padding: 4,
              }}
              onClick={handleReenviar}
              disabled={cooldown > 0 || reenviando}
            >
              {reenviando ? "Reenviando..." : cooldown > 0 ? `Reenviar código em ${cooldown}s` : "Não recebeu? Reenviar código"}
            </button>
          </div>
        </div>
        <div style={S.linkSec}>
          <button style={S.linkBtn} onClick={onVoltar}>← Voltar</button>
        </div>
        <div style={S.rodape}>Vicke — Conectando elos</div>
      </div>
    </div>
  );
}
