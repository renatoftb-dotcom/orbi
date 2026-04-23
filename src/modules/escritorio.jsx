// ═══════════════════════════════════════════════════════════════
// ESCRITÓRIO — Módulo reformulado
// Visual minimalista, fundo branco, estilo Claude.ai
// ═══════════════════════════════════════════════════════════════

function Escritorio({ data, save }) {
  const cfg = data.escritorio || {};
  const [aba, setAba] = useState("dados");
  const perm = getPermissoes();
  const [form, setForm] = useState({
    nome:        cfg.nome        || "",
    cnpj:        cfg.cnpj        || "",
    email:       cfg.email       || "",
    telefone:    cfg.telefone    || "",
    endereco:    cfg.endereco    || "",
    cidade:      cfg.cidade      || "",
    estado:      cfg.estado      || "SP",
    site:        cfg.site        || "",
    instagram:   cfg.instagram   || "",
    banco:       cfg.banco       || "",
    agencia:     cfg.agencia     || "",
    conta:       cfg.conta       || "",
    tipoConta:   cfg.tipoConta   || "Corrente",
    pixTipo:     cfg.pixTipo     || "CNPJ",
    pixChave:    cfg.pixChave    || "",
  });
  const [responsaveis, setResponsaveis] = useState(
    cfg.responsaveis?.length ? cfg.responsaveis
    : cfg.responsavel ? [{ id:"r1", nome:cfg.responsavel, cau:cfg.cau||"", cpf:cfg.cpfResponsavel||"" }]
    : []
  );
  const [equipe, setEquipe] = useState(cfg.equipe || []);
  const [saved, setSaved] = useState(false);
  const [novoMembro, setNovoMembro] = useState(null);

  // ── Estado da aba Usuários ──────────────────────────────────
  const [usuarios, setUsuarios] = useState([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [erroUsuarios, setErroUsuarios] = useState(null);
  const [novoUsuario, setNovoUsuario] = useState(null); // objeto quando modal aberto
  const [confirmSenha, setConfirmSenha] = useState("");
  const [salvandoUsuario, setSalvandoUsuario] = useState(false);
  // JWT (fonte: localStorage), pra identificar o usuário logado e não desativar/excluir a si mesmo
  const tokenAtual = (typeof localStorage !== "undefined") ? localStorage.getItem("vicke-token") : null;
  const usuarioLogadoId = (() => {
    if (!tokenAtual) return null;
    try {
      // JWT usa base64url; precisa converter pra base64 padrão antes do atob
      const part = tokenAtual.split(".")[1];
      const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
      const padded = b64 + "=".repeat((4 - b64.length % 4) % 4);
      const payload = JSON.parse(atob(padded));
      return payload?.id || null;
    } catch { return null; }
  })();

  const emptyUsuario = {
    id: "",
    nome: "",
    email: "",
    senha: "",
    nivel: "visualizador",
    membro_id: "",
    ativo: true,
  };

  async function carregarUsuarios() {
    setLoadingUsuarios(true);
    setErroUsuarios(null);
    try {
      const token = localStorage.getItem("vicke-token");
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");
      const res = await fetch("https://orbi-production-5f5c.up.railway.app/empresa/usuarios", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Erro ao listar usuários");
      setUsuarios(json.data || []);
    } catch (e) {
      setErroUsuarios(e.message);
    } finally {
      setLoadingUsuarios(false);
    }
  }

  async function salvarUsuario() {
    if (!novoUsuario) return;
    // Validação básica
    if (!novoUsuario.nome?.trim()) { alert("Informe o nome"); return; }
    if (!novoUsuario.email?.trim()) { alert("Informe o e-mail"); return; }
    const editando = !!novoUsuario._editando; // flag interna
    if (!editando) {
      if (!novoUsuario.senha || novoUsuario.senha.length < 6) {
        alert("A senha deve ter no mínimo 6 caracteres");
        return;
      }
      if (novoUsuario.senha !== confirmSenha) {
        alert("As senhas não conferem");
        return;
      }
    } else if (novoUsuario.senha) {
      // Editando e mudando senha: valida também
      if (novoUsuario.senha.length < 6) {
        alert("A nova senha deve ter no mínimo 6 caracteres");
        return;
      }
      if (novoUsuario.senha !== confirmSenha) {
        alert("As senhas não conferem");
        return;
      }
    }

    setSalvandoUsuario(true);
    try {
      const token = localStorage.getItem("vicke-token");
      if (!token) {
        alert("Sessão expirada. Faça login novamente.");
        setSalvandoUsuario(false);
        return;
      }
      const body = {
        nome: novoUsuario.nome.trim(),
        email: novoUsuario.email.trim().toLowerCase(),
        nivel: novoUsuario.nivel || "visualizador",
        membro_id: novoUsuario.membro_id || null,
        ativo: novoUsuario.ativo !== false,
      };
      // Só manda a senha se foi preenchida (ao editar ela é opcional)
      if (novoUsuario.senha) body.senha = novoUsuario.senha;

      const url = editando
        ? `https://orbi-production-5f5c.up.railway.app/empresa/usuarios/${novoUsuario.id}`
        : `https://orbi-production-5f5c.up.railway.app/empresa/usuarios`;
      const method = editando ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Erro ao salvar usuário");
      setNovoUsuario(null);
      setConfirmSenha("");
      await carregarUsuarios();
    } catch (e) {
      alert("Erro: " + e.message);
    } finally {
      setSalvandoUsuario(false);
    }
  }

  async function excluirUsuario(u) {
    if (u.id === usuarioLogadoId) {
      alert("Você não pode excluir a si mesmo.");
      return;
    }
    const token = localStorage.getItem("vicke-token");
    if (!token) {
      alert("Sessão expirada. Faça login novamente.");
      return;
    }
    if (!confirm(`Excluir o usuário "${u.nome}"?\n\nEsta ação não pode ser desfeita.`)) return;
    try {
      const res = await fetch(`https://orbi-production-5f5c.up.railway.app/empresa/usuarios/${u.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Erro ao excluir");
      await carregarUsuarios();
    } catch (e) {
      alert("Erro: " + e.message);
    }
  }

  // Carrega a lista quando a aba Usuários é aberta pela primeira vez
  useEffect(() => {
    if (aba === "usuarios" && usuarios.length === 0 && !loadingUsuarios && !erroUsuarios) {
      carregarUsuarios();
    }
    // eslint-disable-next-line
  }, [aba]);

  const emptyMembro = { id:"", nome:"", cargo:"", email:"", telefone:"", cau:"", cpf:"" };

  function handleSave() {
    save({ ...data, escritorio: { ...form, equipe, responsaveis } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function setF(key, val) {
    setForm(f => {
      const novo = { ...f, [key]: val };
      if (key === "cnpj" && (f.pixTipo === "CNPJ" || f.pixTipo === "CPF")) novo.pixChave = val;
      if (key === "email" && f.pixTipo === "E-mail") novo.pixChave = val;
      if (key === "telefone" && f.pixTipo === "Telefone") novo.pixChave = val;
      return novo;
    });
  }

  const E = {
    wrap: { fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", background:"#fff", minHeight:"100vh", color:"#111", maxWidth:1200, margin:"0 auto" },
    header: { borderBottom:"1px solid #e5e7eb", padding:"24px 32px", display:"flex", justifyContent:"space-between", alignItems:"center" },
    titulo: { fontSize:18, fontWeight:700, color:"#111", margin:0 },
    sub: { fontSize:13, color:"#9ca3af", marginTop:3 },
    abas: { display:"flex", gap:0, borderBottom:"1px solid #e5e7eb", padding:"0 32px" },
    aba: (ativa) => ({ background:"none", border:"none", borderBottom: ativa ? "2px solid #111" : "2px solid transparent", color: ativa ? "#111" : "#9ca3af", padding:"12px 16px", fontSize:13, fontWeight: ativa ? 600 : 400, cursor:"pointer", fontFamily:"inherit", marginBottom:-1 }),
    body: { padding:"32px", maxWidth:760 },
    secao: { marginBottom:32 },
    secTitulo: { fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:16 },
    grid2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 },
    grid3: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 },
    campo: { display:"flex", flexDirection:"column", gap:5 },
    label: { fontSize:12, color:"#6b7280", fontWeight:500 },
    input: { border:"1px solid #d1d5db", borderRadius:8, padding:"10px 12px", fontSize:13, color:"#111", outline:"none", background:"#fff", fontFamily:"inherit", width:"100%", boxSizing:"border-box" },
    select: { border:"1px solid #d1d5db", borderRadius:8, padding:"10px 12px", fontSize:13, color:"#111", outline:"none", background:"#fff", fontFamily:"inherit", width:"100%", boxSizing:"border-box", cursor:"pointer" },
    divisor: { border:"none", borderTop:"1px solid #f3f4f6", margin:"24px 0" },
    btn: { background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
    btnSec: { background:"#fff", color:"#374151", border:"1px solid #d1d5db", borderRadius:8, padding:"10px 18px", fontSize:13, cursor:"pointer", fontFamily:"inherit" },
    btnAdd: { background:"#fff", color:"#374151", border:"1px solid #d1d5db", borderRadius:7, padding:"7px 14px", fontSize:12, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 },
    btnSalvo: { background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", opacity:0.7 },
    // Equipe
    membroCard: { border:"1px solid #e5e7eb", borderRadius:10, padding:"16px", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"flex-start" },
    membroNome: { fontSize:14, fontWeight:600, color:"#111", marginBottom:2 },
    membroCargo: { fontSize:12, color:"#9ca3af" },
    membroInfo: { fontSize:12, color:"#6b7280", marginTop:6, display:"flex", gap:16 },
    // Modal
    overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.3)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 },
    modal: { background:"#fff", borderRadius:14, padding:"28px", width:"100%", maxWidth:520, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 20px 40px rgba(0,0,0,0.15)" },
    modalTitulo: { fontSize:16, fontWeight:700, color:"#111", marginBottom:20 },
    // View
    viewVal: { fontSize:14, color:"#111", marginBottom:2 },
    viewLabel: { fontSize:11, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.5, marginBottom:4 },
    viewBloco: { display:"flex", flexDirection:"column", gap:3 },
  };

  // Tag de nível de usuário (reusável)
  const tagBase = {
    fontSize: 9.5,
    padding: "2px 6px",
    borderRadius: 4,
    fontWeight: 600,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };

  // ── ABA DADOS ───────────────────────────────────────────────
  const renderDados = () => (
    <div style={E.body}>
      {/* Identificação */}
      <div style={E.secao}>
        <div style={E.secTitulo}>Identificação</div>
        <div style={{ ...E.grid2, marginBottom:16 }}>
          <div style={E.campo}>
            <label style={E.label}>Nome do escritório</label>
            <input style={E.input} value={form.nome} onChange={e => setF("nome", e.target.value)} placeholder="Ex: Padovan Arquitetos" />
          </div>
          <div style={E.campo}>
            <label style={E.label}>CNPJ / CPF</label>
            <input style={E.input} value={form.cnpj} onChange={e => setF("cnpj", e.target.value)} placeholder="00.000.000/0001-00" />
          </div>
        </div>

        {/* Responsáveis técnicos */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <span style={{ fontSize:12, color:"#6b7280", fontWeight:500 }}>Responsáveis técnicos</span>
          <button style={E.btnAdd} onClick={() => setResponsaveis(r => [...r, { id:uid(), nome:"", cau:"", cpf:"" }])}>
            + Adicionar
          </button>
        </div>
        {responsaveis.length === 0 && (
          <div style={{ fontSize:13, color:"#d1d5db", fontStyle:"italic", marginBottom:8 }}>Nenhum responsável cadastrado.</div>
        )}
        {responsaveis.map((r, idx) => (
          <div key={r.id} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr auto", gap:10, marginBottom:10, alignItems:"end" }}>
            {[["Nome","nome","Nome do responsável"],["CAU / CREA","cau","A000000-0"],["CPF","cpf","000.000.000-00"]].map(([lbl,fld,ph]) => (
              <div key={fld} style={E.campo}>
                <label style={E.label}>{lbl}</label>
                <input style={E.input} value={r[fld]||""} placeholder={ph}
                  onChange={e => setResponsaveis(rs => rs.map((x,i) => i===idx ? {...x,[fld]:e.target.value} : x))} />
              </div>
            ))}
            <button onClick={() => setResponsaveis(rs => rs.filter((_,i) => i!==idx))}
              style={{ background:"none", border:"none", color:"#d1d5db", fontSize:18, cursor:"pointer", padding:"8px", alignSelf:"flex-end" }}>×</button>
          </div>
        ))}
      </div>

      <hr style={E.divisor} />

      {/* Contato */}
      <div style={E.secao}>
        <div style={E.secTitulo}>Contato</div>
        <div style={{ ...E.grid2, marginBottom:12 }}>
          {[["E-mail","email","contato@escritorio.com"],["Telefone / WhatsApp","telefone","(14) 99999-0000"]].map(([lbl,key,ph]) => (
            <div key={key} style={E.campo}>
              <label style={E.label}>{lbl}</label>
              <input style={E.input} value={form[key]} onChange={e => setF(key, e.target.value)} placeholder={ph} />
            </div>
          ))}
        </div>
        <div style={E.grid2}>
          {[["Site","site","www.escritorio.com.br"],["Instagram","instagram","@escritorio"]].map(([lbl,key,ph]) => (
            <div key={key} style={E.campo}>
              <label style={E.label}>{lbl}</label>
              <input style={E.input} value={form[key]} onChange={e => setF(key, e.target.value)} placeholder={ph} />
            </div>
          ))}
        </div>
      </div>

      <hr style={E.divisor} />

      {/* Endereço */}
      <div style={E.secao}>
        <div style={E.secTitulo}>Endereço</div>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 0.5fr", gap:16 }}>
          {[["Endereço","endereco","Rua, número, bairro"],["Cidade","cidade","Ourinhos"],["Estado","estado","SP"]].map(([lbl,key,ph]) => (
            <div key={key} style={E.campo}>
              <label style={E.label}>{lbl}</label>
              <input style={E.input} value={form[key]} onChange={e => setF(key, e.target.value)} placeholder={ph} />
            </div>
          ))}
        </div>
      </div>

      <hr style={E.divisor} />

      {/* Dados bancários */}
      <div style={E.secao}>
        <div style={E.secTitulo}>Dados bancários</div>
        <div style={{ ...E.grid3, marginBottom:16 }}>
          {[["Banco","banco","Ex: Sicoob"],["Agência","agencia","0000"],["Conta","conta","00000-0"]].map(([lbl,key,ph]) => (
            <div key={key} style={E.campo}>
              <label style={E.label}>{lbl}</label>
              <input style={E.input} value={form[key]} onChange={e => setF(key, e.target.value)} placeholder={ph} />
            </div>
          ))}
        </div>
        <div style={E.grid3}>
          <div style={E.campo}>
            <label style={E.label}>Tipo de conta</label>
            <select style={E.select} value={form.tipoConta} onChange={e => setF("tipoConta", e.target.value)}>
              <option>Corrente</option><option>Poupança</option><option>Pagamento</option>
            </select>
          </div>
          <div style={E.campo}>
            <label style={E.label}>Tipo de chave PIX</label>
            <select style={E.select} value={form.pixTipo} onChange={e => {
              const tipo = e.target.value;
              let chave = form.pixChave;
              if (tipo==="CNPJ"||tipo==="CPF") chave = form.cnpj||chave;
              if (tipo==="E-mail") chave = form.email||chave;
              if (tipo==="Telefone") chave = form.telefone||chave;
              setForm(f => ({...f, pixTipo:tipo, pixChave:chave}));
            }}>
              <option>CNPJ</option><option>CPF</option><option>E-mail</option><option>Telefone</option><option>Chave Aleatória</option>
            </select>
          </div>
          <div style={E.campo}>
            <label style={E.label}>Chave PIX</label>
            <input style={E.input} value={form.pixChave} onChange={e => setF("pixChave", e.target.value)} placeholder="Chave PIX" />
          </div>
        </div>
      </div>

      {/* Salvar — só admin pode alterar config do escritório */}
      {perm.podeAlterarConfig && (
        <div style={{ display:"flex", justifyContent:"flex-end", gap:10, paddingTop:8 }}>
          <button style={saved ? E.btnSalvo : E.btn} onClick={handleSave}>
            {saved ? "Salvo!" : "Salvar alterações"}
          </button>
        </div>
      )}
      {!perm.podeAlterarConfig && (
        <div style={{
          padding:"12px 14px", background:"#f9fafb", border:"1px solid #f3f4f6",
          borderRadius:8, color:"#6b7280", fontSize:12.5, textAlign:"center",
        }}>
          Somente administradores podem alterar estes dados.
        </div>
      )}
    </div>
  );

  // ── ABA EQUIPE ──────────────────────────────────────────────
  const renderEquipe = () => (
    <div style={E.body}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <div style={{ fontSize:14, color:"#111", fontWeight:600 }}>{equipe.length} membro{equipe.length !== 1 ? "s" : ""}</div>
          <div style={{ fontSize:12, color:"#9ca3af", marginTop:2 }}>Gerencie os membros da equipe</div>
        </div>
        <button style={E.btn} onClick={() => setNovoMembro({...emptyMembro, id:uid()})}>+ Adicionar membro</button>
      </div>

      {equipe.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 0", color:"#d1d5db", fontSize:14 }}>
          Nenhum membro cadastrado ainda.
        </div>
      ) : (
        equipe.map(m => (
          <div key={m.id} style={E.membroCard}>
            <div>
              <div style={E.membroNome}>{m.nome}</div>
              <div style={E.membroCargo}>{m.cargo || "—"}</div>
              <div style={E.membroInfo}>
                {m.email && <span>{m.email}</span>}
                {m.telefone && <span>{m.telefone}</span>}
                {m.cau && <span>{m.cau}</span>}
              </div>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={() => setNovoMembro(m)}
                style={{ background:"none", border:"1px solid #e5e7eb", borderRadius:6, color:"#6b7280", padding:"5px 10px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
                Editar
              </button>
              <button onClick={() => { setEquipe(eq => eq.filter(x => x.id !== m.id)); save({ ...data, escritorio: { ...form, equipe: equipe.filter(x => x.id !== m.id), responsaveis } }); }}
                style={{ background:"none", border:"none", color:"#d1d5db", fontSize:18, cursor:"pointer", padding:"5px 8px" }}>×</button>
            </div>
          </div>
        ))
      )}

      {/* Modal membro */}
      {novoMembro && (
        <div style={E.overlay}>
          <div style={E.modal}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={E.modalTitulo}>{novoMembro.nome ? "Editar membro" : "Novo membro"}</div>
              <button onClick={() => setNovoMembro(null)} style={{ background:"none", border:"none", color:"#9ca3af", fontSize:20, cursor:"pointer" }}>×</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
              {[["Nome completo","nome"],["Cargo","cargo"],["E-mail","email"],["Telefone","telefone"],["CAU / CREA","cau"],["CPF","cpf"]].map(([lbl,key]) => (
                <div key={key} style={E.campo}>
                  <label style={E.label}>{lbl}</label>
                  <input style={E.input} value={novoMembro[key]||""} onChange={e => setNovoMembro(m => ({...m,[key]:e.target.value}))} />
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button style={E.btnSec} onClick={() => setNovoMembro(null)}>Cancelar</button>
              <button style={E.btn} onClick={() => {
                if (!novoMembro.nome?.trim()) return;
                const existe = equipe.find(m => m.id === novoMembro.id);
                const novaEquipe = existe
                  ? equipe.map(m => m.id === novoMembro.id ? novoMembro : m)
                  : [...equipe, novoMembro];
                setEquipe(novaEquipe);
                save({ ...data, escritorio: { ...form, equipe: novaEquipe, responsaveis } });
                setNovoMembro(null);
              }}>
                {equipe.find(m => m.id === novoMembro.id) ? "Salvar" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── ABA USUÁRIOS ────────────────────────────────────────────
  const renderUsuarios = () => {
    const labelNivel = { admin:"Admin", editor:"Editor", visualizador:"Visualizador" };
    const corNivel = {
      admin:        { bg:"#334155", color:"#fff" },
      editor:       { bg:"#dbeafe", color:"#1e40af" },
      visualizador: { bg:"#f1f5f9", color:"#64748b" },
    };

    return (
      <div style={E.body}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div>
            <div style={{ fontSize:14, color:"#111", fontWeight:600 }}>
              {usuarios.length} {usuarios.length === 1 ? "usuário" : "usuários"}
            </div>
            <div style={{ fontSize:12, color:"#9ca3af", marginTop:2 }}>
              Controle quem acessa o sistema e em qual nível de permissão
            </div>
          </div>
          <button
            style={E.btn}
            onClick={() => { setNovoUsuario({ ...emptyUsuario, id: `usr_${Date.now()}_${Math.random().toString(36).slice(2,7)}` }); setConfirmSenha(""); }}>
            + Adicionar usuário
          </button>
        </div>

        {/* Legenda dos níveis */}
        <div style={{
          background:"#f9fafb", border:"1px solid #f3f4f6", borderRadius:10,
          padding:"12px 14px", marginBottom:20, fontSize:12, lineHeight:1.7, color:"#6b7280",
        }}>
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
            <span style={{ ...tagBase, background: corNivel.admin.bg, color: corNivel.admin.color }}>Admin</span>
            Acesso total: criar/editar/excluir dados + gerenciar usuários
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
            <span style={{ ...tagBase, background: corNivel.editor.bg, color: corNivel.editor.color }}>Editor</span>
            Cria e edita orçamentos, clientes e obras. Não exclui nem mexe em config
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <span style={{ ...tagBase, background: corNivel.visualizador.bg, color: corNivel.visualizador.color }}>Visualizador</span>
            Somente leitura: vê tudo mas não altera nada
          </div>
        </div>

        {loadingUsuarios && (
          <div style={{ textAlign:"center", padding:"40px 0", color:"#9ca3af", fontSize:13 }}>
            Carregando usuários…
          </div>
        )}

        {erroUsuarios && !loadingUsuarios && (
          <div style={{
            background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10,
            padding:"14px 16px", color:"#b91c1c", fontSize:13,
            display:"flex", justifyContent:"space-between", alignItems:"center",
          }}>
            <span>⚠ Erro ao carregar: {erroUsuarios}</span>
            <button style={E.btnSec} onClick={carregarUsuarios}>Tentar novamente</button>
          </div>
        )}

        {!loadingUsuarios && !erroUsuarios && usuarios.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 0", color:"#d1d5db", fontSize:14 }}>
            Nenhum usuário cadastrado ainda.
          </div>
        )}

        {!loadingUsuarios && !erroUsuarios && usuarios.map(u => {
          const cor = corNivel[u.nivel] || corNivel.visualizador;
          const ehVoce = u.id === usuarioLogadoId;
          const membroVinculado = u.membro_id ? equipe.find(m => m.id === u.membro_id) : null;
          return (
            <div key={u.id} style={{
              ...E.membroCard,
              opacity: u.ativo === false ? 0.55 : 1,
              borderStyle: u.ativo === false ? "dashed" : "solid",
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                  <div style={E.membroNome}>{u.nome}</div>
                  <span style={{ ...tagBase, background: cor.bg, color: cor.color }}>
                    {labelNivel[u.nivel] || u.nivel}
                  </span>
                  {ehVoce && (
                    <span style={{
                      fontSize:10, padding:"2px 6px", borderRadius:4,
                      background:"#eff6ff", color:"#2563eb", fontWeight:600,
                      textTransform:"uppercase", letterSpacing:0.5,
                    }}>Você</span>
                  )}
                  {u.ativo === false && (
                    <span style={{
                      fontSize:10, padding:"2px 6px", borderRadius:4,
                      background:"#f3f4f6", color:"#6b7280", fontWeight:600,
                      textTransform:"uppercase", letterSpacing:0.5,
                    }}>Inativo</span>
                  )}
                </div>
                <div style={E.membroCargo}>{u.email}</div>
                {membroVinculado && (
                  <div style={{ fontSize:11.5, color:"#6b7280", marginTop:4 }}>
                    🔗 Vinculado a: <strong style={{ color:"#374151" }}>{membroVinculado.nome}</strong>
                    {membroVinculado.cargo && <span style={{ color:"#9ca3af" }}> · {membroVinculado.cargo}</span>}
                  </div>
                )}
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button
                  onClick={() => {
                    setNovoUsuario({
                      id: u.id, nome: u.nome, email: u.email,
                      senha: "", // senha em branco ao editar (só preenche se quiser trocar)
                      nivel: u.nivel || "visualizador",
                      membro_id: u.membro_id || "",
                      ativo: u.ativo !== false,
                      _editando: true,
                    });
                    setConfirmSenha("");
                  }}
                  style={{ background:"none", border:"1px solid #e5e7eb", borderRadius:6, color:"#6b7280", padding:"5px 10px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
                  Editar
                </button>
                {!ehVoce && (
                  <button
                    onClick={() => excluirUsuario(u)}
                    title="Excluir usuário"
                    style={{ background:"none", border:"none", color:"#d1d5db", fontSize:18, cursor:"pointer", padding:"5px 8px" }}>×</button>
                )}
              </div>
            </div>
          );
        })}

        {/* Modal de criação/edição */}
        {novoUsuario && (
          <div style={E.overlay}>
            <div style={E.modal}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                <div style={E.modalTitulo}>
                  {novoUsuario._editando ? "Editar usuário" : "Novo usuário"}
                </div>
                <button
                  onClick={() => { setNovoUsuario(null); setConfirmSenha(""); }}
                  style={{ background:"none", border:"none", color:"#9ca3af", fontSize:20, cursor:"pointer" }}>×</button>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
                <div style={E.campo}>
                  <label style={E.label}>Nome completo *</label>
                  <input style={E.input} value={novoUsuario.nome}
                    onChange={e => setNovoUsuario(u => ({ ...u, nome: e.target.value }))} />
                </div>
                <div style={E.campo}>
                  <label style={E.label}>E-mail *</label>
                  <input type="email" style={E.input} value={novoUsuario.email}
                    autoComplete="off"
                    onChange={e => setNovoUsuario(u => ({ ...u, email: e.target.value }))} />
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
                <div style={E.campo}>
                  <label style={E.label}>
                    {novoUsuario._editando ? "Nova senha (deixe em branco pra manter)" : "Senha * (mín. 6 caracteres)"}
                  </label>
                  <input type="password" style={E.input} value={novoUsuario.senha}
                    autoComplete="new-password"
                    onChange={e => setNovoUsuario(u => ({ ...u, senha: e.target.value }))} />
                </div>
                <div style={E.campo}>
                  <label style={E.label}>Confirmar senha</label>
                  <input type="password" style={E.input} value={confirmSenha}
                    autoComplete="new-password"
                    onChange={e => setConfirmSenha(e.target.value)} />
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
                <div style={E.campo}>
                  <label style={E.label}>Nível de acesso *</label>
                  <select style={E.select} value={novoUsuario.nivel}
                    onChange={e => setNovoUsuario(u => ({ ...u, nivel: e.target.value }))}>
                    <option value="admin">Admin — acesso total</option>
                    <option value="editor">Editor — cria e edita</option>
                    <option value="visualizador">Visualizador — só leitura</option>
                  </select>
                </div>
                <div style={E.campo}>
                  <label style={E.label}>Vincular a membro da equipe</label>
                  <select style={E.select} value={novoUsuario.membro_id}
                    onChange={e => setNovoUsuario(u => ({ ...u, membro_id: e.target.value }))}>
                    <option value="">— Nenhum —</option>
                    {equipe.map(m => (
                      <option key={m.id} value={m.id}>{m.nome}{m.cargo ? ` (${m.cargo})` : ""}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom:20 }}>
                <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"#374151", cursor:"pointer" }}>
                  <input
                    type="checkbox"
                    checked={novoUsuario.ativo !== false}
                    disabled={novoUsuario._editando && novoUsuario.id === usuarioLogadoId}
                    onChange={e => setNovoUsuario(u => ({ ...u, ativo: e.target.checked }))}
                    style={{ width:14, height:14, cursor: novoUsuario._editando && novoUsuario.id === usuarioLogadoId ? "not-allowed" : "pointer" }}
                  />
                  Usuário ativo
                  {novoUsuario._editando && novoUsuario.id === usuarioLogadoId && (
                    <span style={{ fontSize:11, color:"#9ca3af" }}>· não é possível desativar a si mesmo</span>
                  )}
                </label>
              </div>

              <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                <button
                  style={E.btnSec}
                  disabled={salvandoUsuario}
                  onClick={() => { setNovoUsuario(null); setConfirmSenha(""); }}>
                  Cancelar
                </button>
                <button
                  style={{ ...E.btn, opacity: salvandoUsuario ? 0.6 : 1, cursor: salvandoUsuario ? "not-allowed" : "pointer" }}
                  disabled={salvandoUsuario}
                  onClick={salvarUsuario}>
                  {salvandoUsuario ? "Salvando…" : (novoUsuario._editando ? "Salvar alterações" : "Criar usuário")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── ABA SISTEMA ──────────────────────────────────────────────
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

  const renderSistema = () => (
    <div style={E.body}>
      <div style={E.secao}>
        <div style={E.secTitulo}>Manutenção automática</div>
        <div style={{ fontSize:13, color:"#6b7280", lineHeight:1.6, marginBottom:16 }}>
          O sistema executa automaticamente, todo dia às 3h da manhã:
          <ul style={{ margin:"10px 0 0 0", padding:"0 0 0 20px" }}>
            <li>Expira propostas com mais de 30 dias (marca como "Perdido" e remove imagens salvas)</li>
            <li>Inativa clientes sem serviço em aberto há 3 meses (com observação automática)</li>
          </ul>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:20 }}>
          <button
            onClick={executarManutencao}
            disabled={manutLoading}
            style={{ ...E.btn, opacity: manutLoading ? 0.5 : 1, cursor: manutLoading ? "not-allowed" : "pointer" }}>
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

  return (
    <div style={E.wrap}>
      {/* Header */}
      <div style={E.header}>
        <div>
          <div style={E.titulo}>{form.nome || "Escritório"}</div>
          <div style={E.sub}>{form.cidade}{form.estado ? ` — ${form.estado}` : ""}</div>
        </div>
      </div>

      {/* Abas — aba Usuários só visível pra admin (podeGerenciarUsuarios) */}
      <div style={E.abas}>
        {(() => {
          const abasDisponiveis = [
            ["dados",    "Dados gerais"],
            ["equipe",   "Equipe"],
          ];
          if (perm.podeGerenciarUsuarios) abasDisponiveis.push(["usuarios", "Usuários"]);
          abasDisponiveis.push(["sistema", "Sistema"]);
          return abasDisponiveis.map(([key, lbl]) => (
            <button key={key} style={E.aba(aba === key)} onClick={() => setAba(key)}>{lbl}</button>
          ));
        })()}
      </div>

      {/* Conteúdo */}
      {aba === "dados"    && renderDados()}
      {aba === "equipe"   && renderEquipe()}
      {aba === "usuarios" && perm.podeGerenciarUsuarios && renderUsuarios()}
      {aba === "sistema"  && renderSistema()}
    </div>
  );
}
