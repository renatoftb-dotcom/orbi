// ═══════════════════════════════════════════════════════════════
// ESCRITÓRIO — Módulo reformulado
// Visual minimalista, fundo branco, estilo Claude.ai
// ═══════════════════════════════════════════════════════════════

function Escritorio({ data, save }) {
  const cfg = data.escritorio || {};
  const [aba, setAba] = useState("dados");
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
    wrap: { fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", background:"#fff", minHeight:"100vh", color:"#111" },
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

      {/* Salvar */}
      <div style={{ display:"flex", justifyContent:"flex-end", gap:10, paddingTop:8 }}>
        <button style={saved ? E.btnSalvo : E.btn} onClick={handleSave}>
          {saved ? "Salvo!" : "Salvar alterações"}
        </button>
      </div>
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
  const renderUsuarios = () => (
    <div style={E.body}>
      <div style={{ fontSize:13, color:"#9ca3af", padding:"40px 0", textAlign:"center" }}>
        Gestão de usuários em breve — invite por e-mail, perfis e permissões.
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

      {/* Abas */}
      <div style={E.abas}>
        {[["dados","Dados gerais"],["equipe","Equipe"],["usuarios","Usuários"]].map(([key,lbl]) => (
          <button key={key} style={E.aba(aba===key)} onClick={() => setAba(key)}>{lbl}</button>
        ))}
      </div>

      {/* Conteúdo */}
      {aba === "dados"    && renderDados()}
      {aba === "equipe"   && renderEquipe()}
      {aba === "usuarios" && renderUsuarios()}
    </div>
  );
}
