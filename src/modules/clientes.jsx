// ═══════════════════════════════════════════════════════════════
// CLIENTES — Kanban + visual minimalista
// ═══════════════════════════════════════════════════════════════

const C = {
  input:    { border:"1px solid #e5e7eb", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#111", outline:"none", background:"#fff", fontFamily:"inherit", width:"100%", boxSizing:"border-box" },
  label:    { fontSize:12, color:"#6b7280", fontWeight:500, display:"block", marginBottom:5 },
  btn:      { background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"9px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
  btnSec:   { background:"#fff", color:"#374151", border:"1px solid #e5e7eb", borderRadius:8, padding:"9px 16px", fontSize:13, cursor:"pointer", fontFamily:"inherit" },
  btnGhost: { background:"none", border:"none", color:"#9ca3af", cursor:"pointer", fontFamily:"inherit", fontSize:13 },
  tag:      (cor) => ({ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:6, background:cor+"18", color:cor }),
  grid2:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 },
  grid3:    { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 },
  secTit:   { fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:14 },
  divider:  { border:"none", borderTop:"1px solid #f3f4f6", margin:"20px 0" },
  row:      { display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #f9fafb" },
};

const COLUNAS = [
  { key:"",             label:"Leads",         cor:"#9ca3af" },
  { key:"orcamento",    label:"Em orçamento",  cor:"#f59e0b" },
  { key:"estudo",       label:"Em estudo",     cor:"#3b82f6" },
  { key:"andamento",    label:"Em andamento",  cor:"#10b981" },
];

function ClienteExpandivel({ cliente, data, waLink }) {
  const [abertos, setAbertos] = useState({ cadastro:false, financeiro:false });
  const toggle = k => setAbertos(p => ({...p, [k]:!p[k]}));
  const cpfCliente = cliente.cpfCnpj || cliente.id;
  const lancsCli = (data.receitasFinanceiro||[]).filter(r => r.clienteId === cpfCliente || r.clienteId === cliente.id);
  const totalContabil = lancsCli.filter(r=>r.contabil1==="Receita Total"&&r.tipoConta!=="Conta Redutora").reduce((s,r)=>s+(r.valor||0),0);
  const totalRecebido = lancsCli.filter(r=>r.recebimento==="Recebido").reduce((s,r)=>s+(r.valor||0),0);
  const totalReceber  = lancsCli.filter(r=>r.recebimento==="A Receber").reduce((s,r)=>s+(r.valor||0),0);
  const fmtV = v => "R$ " + v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
  const secBtn = () => ({ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", background:"none", border:"none", borderBottom:"1px solid #f3f4f6", padding:"12px 0", cursor:"pointer", fontFamily:"inherit", color:"#374151", fontSize:13, fontWeight:600 });

  return (
    <>
      <div style={{ marginBottom:4 }}>
        <button style={secBtn()} onClick={()=>toggle("cadastro")}>
          <span>Endereço e contatos</span>
          <span style={{ fontSize:11, color:"#9ca3af" }}>{abertos.cadastro?"▲":"▼"}</span>
        </button>
        {abertos.cadastro && (
          <div style={{ padding:"16px 0", display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, borderBottom:"1px solid #f3f4f6" }}>
            <div>
              <div style={C.secTit}>Endereço</div>
              {[["CEP",cliente.cep],["Logradouro",`${cliente.logradouro||""}${cliente.numero?", "+cliente.numero:""}${cliente.complemento?" - "+cliente.complemento:""}`],["Bairro",cliente.bairro],["Cidade",`${cliente.cidade||""} — ${cliente.estado||""}`]].map(([l,v])=>(
                <div key={l} style={C.row}><span style={{fontSize:12,color:"#9ca3af"}}>{l}</span><span style={{fontSize:13,color:"#374151"}}>{v||"—"}</span></div>
              ))}
            </div>
            <div>
              <div style={C.secTit}>Contatos</div>
              {cliente.contatos?.map(ct=>(
                <div key={ct.id} style={{...C.row,alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:"#111"}}>{ct.nome} <span style={{fontWeight:400,color:"#9ca3af"}}>({ct.cargo})</span></div>
                    <div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{ct.telefone}</div>
                  </div>
                  {ct.whatsapp&&ct.telefone&&<a href={waLink(ct.telefone)} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:"#16a34a",textDecoration:"none",border:"1px solid #e5e7eb",borderRadius:6,padding:"4px 10px"}}>WhatsApp</a>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div>
        <button style={secBtn()} onClick={()=>toggle("financeiro")}>
          <span>Financeiro</span>
          <span style={{fontSize:11,color:"#9ca3af"}}>{abertos.financeiro?"▲":"▼"}</span>
        </button>
        {abertos.financeiro&&(
          <div style={{padding:"16px 0",borderBottom:"1px solid #f3f4f6"}}>
            {lancsCli.length===0?<p style={{color:"#9ca3af",fontSize:13,margin:0}}>Nenhum lançamento.</p>:(
              <div style={C.grid3}>
                {[["Receita total",totalContabil,"#2563eb"],["Recebido",totalRecebido,"#16a34a"],["A receber",totalReceber,"#d97706"]].map(([l,v,cor])=>(
                  <div key={l} style={{border:"1px solid #e5e7eb",borderRadius:10,padding:"14px"}}>
                    <div style={{fontSize:11,color:"#9ca3af",fontWeight:600,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>{l}</div>
                    <div style={{fontSize:16,fontWeight:700,color:cor}}>{fmtV(v)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function Clientes({ data, save }) {
  const [view, setView]               = useState("kanban");
  const [sel, setSel]                 = useState(null);
  const [busca, setBusca]             = useState("");
  const [dragId, setDragId]           = useState(null);
  const [dragOver, setDragOver]       = useState(null);

  const emptyCliente = {
    tipo:"PF", nome:"", cpfCnpj:"", email:"", cep:"", logradouro:"", numero:"",
    complemento:"", bairro:"", cidade:"", estado:"SP",
    contatos:[{ id:uid(), nome:"", telefone:"", cargo:"", whatsapp:false }],
    observacoes:"", ativo:true, desde: new Date().toISOString().slice(0,10),
    status:"",
    servicos:{ projeto:false, acompanhamentoObra:false, gestaoObra:false, empreendimento:false }
  };
  const [form, setForm] = useState(emptyCliente);

  function openNew()     { setForm(emptyCliente); setView("form"); }
  function openEdit(c)   { setForm(c); setView("form"); }
  function openDetail(c) { setSel(c); setView("detail"); }

  function saveCliente() {
    if (!form.nome?.trim()) { alert("Informe o nome do cliente."); return; }
    const novos = form.id
      ? data.clientes.map(c => c.id === form.id ? form : c)
      : [...data.clientes, { ...form, id: uid() }];
    save({ ...data, clientes: novos });
    setView("kanban");
  }

  function removeCliente(id) {
    if (!confirm("Remover cliente?")) return;
    save({ ...data, clientes: data.clientes.filter(c => c.id !== id) });
    setView("kanban");
  }

  function moverCliente(id, novoStatus) {
    const novos = data.clientes.map(c => c.id === id ? {...c, status: novoStatus} : c);
    save({ ...data, clientes: novos });
  }

  function waLink(telefone, msg = "") {
    const num = telefone.replace(/\D/g, "");
    const numero = num.startsWith("55") ? num : `55${num}`;
    return `https://wa.me/${numero}${msg ? "?text="+encodeURIComponent(msg) : ""}`;
  }

  async function buscarCEP(cep) {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const d = await r.json();
      if (!d.erro) setForm(f => ({ ...f, logradouro: d.logradouro, bairro: d.bairro, cidade: d.localidade, estado: d.uf }));
    } catch {}
  }

  // ── KANBAN ───────────────────────────────────────────────────
  if (view === "kanban") {
    const filtrados = data.clientes.filter(c => {
      if (!busca) return true;
      const b = busca.toLowerCase();
      return c.nome.toLowerCase().includes(b) || (c.cpfCnpj||"").includes(b) || (c.cidade||"").toLowerCase().includes(b);
    });

    return (
      <div style={{ padding:"24px 28px", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", height:"calc(100vh - 53px)", display:"flex", flexDirection:"column" }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:"#111" }}>Clientes</div>
            <div style={{ fontSize:13, color:"#9ca3af", marginTop:2 }}>{data.clientes.length} cadastrado{data.clientes.length!==1?"s":""}</div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input style={{ ...C.input, width:220 }} placeholder="Buscar..." value={busca} onChange={e=>setBusca(e.target.value)} />
            <button style={C.btnSec} onClick={() => setView("list")}>Lista</button>
            <button style={C.btn} onClick={openNew}>+ Novo cliente</button>
          </div>
        </div>

        {/* Kanban */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:12, flex:1, overflowY:"hidden" }}>
          {COLUNAS.map(col => {
            const cards = filtrados.filter(c => (c.status||"") === col.key);
            const isOver = dragOver === col.key;
            return (
              <div key={col.key}
                style={{ background: isOver ? col.cor+"08" : "#fafafa", border:`1px solid ${isOver ? col.cor : "#f3f4f6"}`, borderRadius:12, display:"flex", flexDirection:"column", transition:"border-color 0.15s, background 0.15s" }}
                onDragOver={e => { e.preventDefault(); setDragOver(col.key); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => { e.preventDefault(); if (dragId) moverCliente(dragId, col.key); setDragId(null); setDragOver(null); }}>
                {/* Header coluna */}
                <div style={{ padding:"14px 16px", borderBottom:"1px solid #f3f4f6", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:col.cor }} />
                    <span style={{ fontSize:13, fontWeight:600, color:"#374151" }}>{col.label}</span>
                  </div>
                  <span style={{ fontSize:12, color:"#9ca3af", background:"#f3f4f6", borderRadius:10, padding:"1px 8px" }}>{cards.length}</span>
                </div>
                {/* Cards */}
                <div style={{ flex:1, overflowY:"auto", padding:"10px 10px" }}>
                  {cards.map(c => {
                    const iniciais = c.nome.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase();
                    const corAv = c.tipo==="PJ" ? "#7c3aed" : "#2563eb";
                    const tel = c.contatos?.find(ct=>ct.whatsapp)?.telefone || c.contatos?.[0]?.telefone || "";
                    return (
                      <div key={c.id}
                        draggable
                        onDragStart={() => setDragId(c.id)}
                        onDragEnd={() => { setDragId(null); setDragOver(null); }}
                        onClick={() => openDetail(c)}
                        style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, padding:"12px", marginBottom:8, cursor:"grab", transition:"box-shadow 0.15s, opacity 0.15s", opacity: dragId===c.id ? 0.4 : 1, boxShadow: dragId===c.id ? "0 4px 12px rgba(0,0,0,0.1)" : "none" }}
                        onMouseEnter={e=>e.currentTarget.style.borderColor="#111"}
                        onMouseLeave={e=>e.currentTarget.style.borderColor="#e5e7eb"}>
                        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                          <div style={{ width:32, height:32, borderRadius:8, background:corAv+"15", color:corAv, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, flexShrink:0 }}>
                            {iniciais}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:600, color:"#111", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.nome}</div>
                            <div style={{ fontSize:11, color:"#9ca3af", marginTop:1 }}>{c.cidade||c.cpfCnpj||""}</div>
                          </div>
                        </div>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={C.tag(corAv)}>{c.tipo}</span>
                          <div style={{ display:"flex", gap:4 }} onClick={e=>e.stopPropagation()}>
                            {tel && <a href={waLink(tel)} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:"#16a34a", textDecoration:"none", border:"1px solid #e5e7eb", borderRadius:5, padding:"2px 7px" }}>WA</a>}
                            <button onClick={()=>openEdit(c)} style={{ fontSize:11, color:"#6b7280", background:"none", border:"1px solid #e5e7eb", borderRadius:5, padding:"2px 7px", cursor:"pointer", fontFamily:"inherit" }}>Editar</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {cards.length === 0 && (
                    <div style={{ textAlign:"center", padding:"24px 0", color:"#d1d5db", fontSize:12 }}>
                      Arraste um cliente aqui
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── LISTA ───────────────────────────────────────────────────
  if (view === "list") {
    const filtrados = data.clientes.filter(c => {
      const b = busca.toLowerCase();
      return !b || c.nome.toLowerCase().includes(b) || (c.cpfCnpj||"").includes(b) || (c.cidade||"").toLowerCase().includes(b);
    });
    return (
      <div style={{ padding:"28px 32px", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:"#111" }}>Clientes</div>
          <div style={{ display:"flex", gap:8 }}>
            <input style={{ ...C.input, width:220 }} placeholder="Buscar..." value={busca} onChange={e=>setBusca(e.target.value)} />
            <button style={C.btnSec} onClick={()=>setView("kanban")}>Kanban</button>
            <button style={C.btn} onClick={openNew}>+ Novo cliente</button>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtrados.map(c => {
            const iniciais = c.nome.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase();
            const corAv = c.tipo==="PJ"?"#7c3aed":"#2563eb";
            const col = COLUNAS.find(x=>x.key===(c.status||"")) || COLUNAS[0];
            const tel = c.contatos?.find(ct=>ct.whatsapp)?.telefone||c.contatos?.[0]?.telefone||"";
            return (
              <div key={c.id} style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"14px 16px", display:"flex", alignItems:"center", gap:14, cursor:"pointer" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#111"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="#e5e7eb"}
                onClick={()=>openDetail(c)}>
                <div style={{ width:40, height:40, borderRadius:10, background:corAv+"15", color:corAv, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, flexShrink:0 }}>{iniciais}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"#111" }}>{c.nome}</div>
                  <div style={{ fontSize:12, color:"#9ca3af" }}>{c.cpfCnpj}{c.cidade?` · ${c.cidade}`:""}</div>
                </div>
                <div style={{ display:"flex", gap:6, alignItems:"center" }} onClick={e=>e.stopPropagation()}>
                  <span style={C.tag(col.cor)}>{col.label||"Sem status"}</span>
                  {tel && <a href={waLink(tel)} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:"#16a34a", textDecoration:"none", border:"1px solid #e5e7eb", borderRadius:6, padding:"4px 10px" }}>WA</a>}
                  <button onClick={()=>openEdit(c)} style={{ fontSize:12, color:"#6b7280", background:"none", border:"1px solid #e5e7eb", borderRadius:6, padding:"4px 10px", cursor:"pointer", fontFamily:"inherit" }}>Editar</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── DETALHE ─────────────────────────────────────────────────
  if (view === "detail" && sel) {
    const cliente = data.clientes.find(c => c.id === sel.id) || sel;
    const iniciais = cliente.nome.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase();
    const corAv = cliente.tipo==="PJ"?"#7c3aed":"#2563eb";
    const col = COLUNAS.find(x=>x.key===(cliente.status||""))||COLUNAS[0];
    return (
      <div style={{ padding:"28px 32px", maxWidth:780, fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28 }}>
          <button style={C.btnGhost} onClick={()=>setView("kanban")}>← Voltar</button>
          <div style={{ flex:1 }} />
          {/* Mover de status */}
          <select value={cliente.status||""} onChange={e=>moverCliente(cliente.id, e.target.value)}
            style={{ ...C.input, width:"auto", fontSize:12, padding:"6px 10px", cursor:"pointer" }}>
            {COLUNAS.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
          <button style={C.btnSec} onClick={()=>openEdit(cliente)}>Editar</button>
          <button style={{...C.btnGhost,color:"#dc2626"}} onClick={()=>removeCliente(cliente.id)}>Remover</button>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:28 }}>
          <div style={{ width:56, height:56, borderRadius:14, background:corAv+"15", color:corAv, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:700, flexShrink:0 }}>{iniciais}</div>
          <div>
            <div style={{ fontSize:20, fontWeight:700, color:"#111" }}>{cliente.nome}</div>
            <div style={{ fontSize:13, color:"#9ca3af", marginTop:3, display:"flex", alignItems:"center", gap:6 }}>
              {cliente.cpfCnpj}
              <span style={C.tag(corAv)}>{cliente.tipo}</span>
              <span style={C.tag(col.cor)}>{col.label||"Sem status"}</span>
            </div>
          </div>
        </div>
        <ClienteExpandivel cliente={cliente} data={data} waLink={waLink} />
        <hr style={C.divider} />
        <ServicosPanel cliente={cliente} data={data} save={save} />
      </div>
    );
  }

  // ── FORMULÁRIO ───────────────────────────────────────────────
  return (
    <div style={{ padding:"28px 32px", maxWidth:680, fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28 }}>
        <button style={C.btnGhost} onClick={()=>setView("kanban")}>← Voltar</button>
        <div style={{ fontSize:18, fontWeight:700, color:"#111" }}>{form.id?"Editar cliente":"Novo cliente"}</div>
      </div>
      <div style={{ marginBottom:20 }}>
        <div style={C.secTit}>Tipo de pessoa</div>
        <div style={{ display:"flex", gap:8 }}>
          {[["PF","Pessoa física"],["PJ","Pessoa jurídica"]].map(([v,l])=>(
            <button key={v} onClick={()=>setForm({...form,tipo:v})}
              style={{ border:"1px solid #e5e7eb", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:form.tipo===v?600:400, background:form.tipo===v?"#111":"#fff", color:form.tipo===v?"#fff":"#6b7280", cursor:"pointer", fontFamily:"inherit" }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom:20 }}>
        <div style={C.secTit}>Status</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {COLUNAS.map(col=>(
            <button key={col.key} onClick={()=>setForm({...form,status:col.key})}
              style={{ border:`1px solid ${form.status===col.key?col.cor:"#e5e7eb"}`, borderRadius:8, padding:"7px 16px", fontSize:12, fontWeight:form.status===col.key?600:400, background:form.status===col.key?col.cor+"15":"#fff", color:form.status===col.key?col.cor:"#6b7280", cursor:"pointer", fontFamily:"inherit" }}>
              {col.label||"Sem status"}
            </button>
          ))}
        </div>
      </div>
      <hr style={C.divider} />
      <div style={{ marginBottom:20 }}>
        <div style={C.secTit}>Dados principais</div>
        <div style={{...C.grid2,marginBottom:14}}>
          <div><label style={C.label}>{form.tipo==="PJ"?"Razão social":"Nome completo"} *</label><input style={C.input} value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} /></div>
          <div><label style={C.label}>{form.tipo==="PJ"?"CNPJ":"CPF"}</label><input style={C.input} value={form.cpfCnpj} onChange={e=>setForm({...form,cpfCnpj:e.target.value})} /></div>
        </div>
        <div style={{...C.grid2,marginBottom:14}}>
          <div><label style={C.label}>E-mail</label><input style={C.input} type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
          <div><label style={C.label}>Cliente desde</label><input style={C.input} type="date" value={form.desde} onChange={e=>setForm({...form,desde:e.target.value})} /></div>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:"#374151"}}>
          <input type="checkbox" checked={form.ativo} onChange={e=>setForm({...form,ativo:e.target.checked})} /> Cliente ativo
        </label>
      </div>
      <hr style={C.divider} />
      <div style={{ marginBottom:20 }}>
        <div style={C.secTit}>Endereço</div>
        <div style={{...C.grid3,marginBottom:14}}>
          <div><label style={C.label}>CEP</label><input style={C.input} value={form.cep} onChange={e=>{setForm({...form,cep:e.target.value});buscarCEP(e.target.value);}} placeholder="00000-000" /></div>
          <div><label style={C.label}>Logradouro</label><input style={C.input} value={form.logradouro} onChange={e=>setForm({...form,logradouro:e.target.value})} /></div>
          <div><label style={C.label}>Número</label><input style={C.input} value={form.numero} onChange={e=>setForm({...form,numero:e.target.value})} /></div>
        </div>
        <div style={{...C.grid3,marginBottom:14}}>
          <div><label style={C.label}>Complemento</label><input style={C.input} value={form.complemento} onChange={e=>setForm({...form,complemento:e.target.value})} /></div>
          <div><label style={C.label}>Bairro</label><input style={C.input} value={form.bairro} onChange={e=>setForm({...form,bairro:e.target.value})} /></div>
          <div><label style={C.label}>Cidade</label><input style={C.input} value={form.cidade} onChange={e=>setForm({...form,cidade:e.target.value})} /></div>
        </div>
        <div style={{maxWidth:120}}><label style={C.label}>Estado</label><select style={{...C.input,cursor:"pointer"}} value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>{ESTADOS_BR.map(e=><option key={e}>{e}</option>)}</select></div>
      </div>
      <hr style={C.divider} />
      <div style={{ marginBottom:20 }}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={C.secTit}>Contatos</div>
          <button style={C.btnSec} onClick={()=>setForm({...form,contatos:[...form.contatos,{id:uid(),nome:"",telefone:"",cargo:"",whatsapp:false}]})}>+ Adicionar</button>
        </div>
        {form.contatos?.map((ct,i)=>(
          <div key={ct.id} style={{border:"1px solid #f3f4f6",borderRadius:10,padding:"14px",marginBottom:10}}>
            <div style={{...C.grid3,marginBottom:10}}>
              <div><label style={C.label}>Nome</label><input style={C.input} value={ct.nome} onChange={e=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,nome:e.target.value}:x)})} /></div>
              <div><label style={C.label}>Telefone</label><input style={C.input} value={ct.telefone} onChange={e=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,telefone:e.target.value}:x)})} /></div>
              <div><label style={C.label}>Cargo</label><input style={C.input} value={ct.cargo} onChange={e=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,cargo:e.target.value}:x)})} /></div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:"#374151"}}>
                <input type="checkbox" checked={ct.whatsapp} onChange={e=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,whatsapp:e.target.checked}:x)})} />
                <span style={{color:"#16a34a"}}>WhatsApp</span>
              </label>
              {form.contatos.length>1&&<button style={{...C.btnGhost,color:"#dc2626",fontSize:12}} onClick={()=>setForm({...form,contatos:form.contatos.filter((_,j)=>j!==i)})}>Remover</button>}
            </div>
          </div>
        ))}
      </div>
      <hr style={C.divider} />
      <div style={{marginBottom:28}}>
        <div style={C.secTit}>Observações internas</div>
        <textarea style={{...C.input,resize:"vertical"}} value={form.observacoes} onChange={e=>setForm({...form,observacoes:e.target.value})} rows={3} />
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button style={C.btnSec} onClick={()=>setView("kanban")}>Cancelar</button>
        <button style={C.btn} onClick={saveCliente}>{form.id?"Salvar alterações":"Cadastrar cliente"}</button>
      </div>
    </div>
  );
}
function ModalConfirmarGanho({ orc, arqTotal, engTotal, grandTotal, data, save, onClose }) {
  function addDias(dateStr, dias) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  }

  const [inclArq, setInclArq]     = useState(true);
  const [inclEng, setInclEng]     = useState(engTotal > 0);
  const [vArq, setVArq]           = useState(Math.round(arqTotal * 100) / 100);
  const [vEng, setVEng]           = useState(Math.round(engTotal * 100) / 100);
  const [forma, setForma]         = useState("PIX");
  const nParcInicial = engTotal > 0 ? 4 : 3;
  const [nParc, setNParc]         = useState(nParcInicial);
  const [vEntrada, setVEntrada]   = useState(Math.round(grandTotal / nParcInicial * 100) / 100);
  const [dtEntrada, setDtEntrada] = useState("");
  const [parcelas, setParcelas]   = useState([]);
  const [aviso, setAviso]               = useState("");
  const [confirmarFuturo, setConfirmarFuturo] = useState(false);
  const dtEntradaRef = useRef(null);

  // Desconto antecipado: só arq = 5% / 3x, pacote completo = 10% / 4x
  const descAntec  = inclArq && inclEng ? 10 : 5;
  const nParcPadrao = inclArq && inclEng ? 4 : 3;

  const totalBase  = (inclArq ? vArq : 0) + (inclEng ? vEng : 0);
  const total      = totalBase;
  const nRest      = Math.max(nParc - 1, 1);
  const vParc      = Math.round((total - vEntrada) / nRest * 100) / 100;

  function gerarParcelas(dtEnt, n, vEnt, tot) {
    const qtd = Math.max(n - 1, 1);
    const vp  = Math.round((tot - vEnt) / qtd * 100) / 100;
    return Array.from({ length: qtd }, (_, i) => ({
      label: (i + 1) + "ª Parcela",
      valor: vp,
      data:  dtEnt ? addDias(dtEnt, (i + 1) * 30) : "",
    }));
  }

  useEffect(() => {
    // Quando muda inclArq/inclEng, ajusta nParc automaticamente
    const novoNParc = inclArq && inclEng ? 4 : 3;
    setNParc(novoNParc);
  }, [inclArq, inclEng]);

  useEffect(() => {
    const descAtual = inclArq && inclEng ? 10 : 5;
    if (forma === "Antecipado") {
      const novaEntrada = Math.round(total * (1 - descAtual/100) * 100) / 100;
      setVEntrada(novaEntrada);
      setParcelas([]);
    } else {
      const novaEntrada = Math.round(total / Math.max(nParc, 1) * 100) / 100;
      setVEntrada(novaEntrada);
      setParcelas(gerarParcelas(dtEntrada, nParc, novaEntrada, total));
    }
  }, [nParc, dtEntrada, vArq, vEng, inclArq, inclEng, forma]);

  function atualizarParcela(idx, campo, valor) {
    setParcelas(p => p.map((x, i) => i === idx ? { ...x, [campo]: valor } : x));
  }

  function confirmar(forcarFuturo) {
    const hoje = new Date().toISOString().slice(0, 10);
    setAviso("");

    // Validacao: datas obrigatorias
    if (!dtEntrada) {
      setAviso(forma === "Antecipado"
        ? "Defina a data do pagamento antes de confirmar."
        : "Defina a data da entrada antes de confirmar.");
      setTimeout(() => { if (dtEntradaRef.current) dtEntradaRef.current.focus(); }, 50);
      return;
    }
    if (forma !== "Antecipado") {
      const semData = parcelas.filter(p => p.valor > 0 && !p.data);
      if (semData.length > 0) {
        setAviso("Defina as datas de vencimento de todas as parcelas.");
        return;
      }
    }

    // Aviso: data futura — pede confirmacao inline
    const entradaFutura = dtEntrada > hoje;
    if (entradaFutura && !forcarFuturo) {
      setConfirmarFuturo(true);
      return;
    }
    setConfirmarFuturo(false);

    // ── Helper: define competencia e recebimento pela data ───────
    function tipoRecebimento(data) {
      if (!data) return { competencia:"Caixa a prazo", recebimento:"A Receber" };
      return data <= hoje
        ? { competencia:"Caixa a vista", recebimento:"Recebido" }
        : { competencia:"Caixa a prazo", recebimento:"A Receber" };
    }

    const vArqFinal  = inclArq ? vArq : 0;
    const vEngFinal  = inclEng ? vEng : 0;
    const totalFinal = Math.round((vArqFinal + vEngFinal) * 100) / 100;
    const descAtual  = inclArq && inclEng ? 10 : 5;
    const pgto       = { forma, nParcelas:nParc, entrada:vEntrada, dtEntrada, parcelas, valorArq:vArqFinal, valorEng:vEngFinal, total:totalFinal };
    const clienteCad  = (data.clientes||[]).find(c => c.id === orc.clienteId);
    const clienteCpf  = clienteCad?.cpfCnpj || orc.clienteId;
    const nomeEsc     = data.escritorio?.nome || "Padovan Arquitetos";
    const existentes = data.receitasFinanceiro || [];
    let seq = existentes.length + 1;
    const nextCod  = () => "LNC-" + String(seq++).padStart(4, "0");
    const compBase = "CMP-" + Math.floor(1000 + Math.random() * 9000);
    const lancs    = [];

    // ── Helpers ──────────────────────────────────────────────────
    // subConta1 = "Receita de Projetos" | "Caixa"
    // subConta2 = "Arquitetura" | "Engenharia"
    // competencia = "Contábil" | "Caixa a vista" | "Caixa a prazo"
    // recebimento = "Conta contábil" | "Recebido" | "A Receber"
    // periodoCaixa = data efetiva do recebimento (ou null)
    function mkLanc(sub2, valor, descricao, contabil1, subConta1, competencia, recebimento, periodoContabil, periodoCaixa) {
      return {
        id:              Math.random().toString(36).slice(2, 9),
        codigo:          nextCod(),
        nComprovante:    compBase,
        nNota:           compBase,
        orcId:           orc.id,
        clienteId:       clienteCpf,
        cliente:         orc.cliente,
        categoria:       "Projeto",
        produto:         orc.tipo || "",
        fornecedor:      nomeEsc,
        descricao,
        tipoConta:       subConta1 === "Desconto" ? "Conta Redutora" : "Conta Acrescimo",
        contabil1,
        subContabil1:    subConta1,      // "Receita de Projetos" | "Desconto"
        subContabil2:    sub2,           // "Arquitetura" | "Engenharia" | ""
        subContabil3:    "",
        subContabil4:    "",
        subContabil5:    "",
        competencia,
        recebimento,
        valor:           Math.round(valor * 100) / 100,
        dataLancamento:  hoje,
        periodoContabil: contabil1 === "Caixa" ? "" : (periodoContabil || hoje),
        periodoCaixa:    periodoCaixa || "",
        forma,
      };
    }

    // ── Lançamentos contábeis (Receita Total) — 1 por serviço ───
    // Registra o valor TOTAL do serviço na competência contábil
    if (inclArq) lancs.push(mkLanc("Arquitetura", vArqFinal,
      "Receita de Projetos", "Receita Total", "Receita de Projetos",
      "Contábil", "Conta contábil", hoje, null));

    if (inclEng) lancs.push(mkLanc("Engenharia", vEngFinal,
      "Receita de Projetos", "Receita Total", "Receita de Projetos",
      "Contábil", "Conta contábil", hoje, null));

    // ── Lançamentos de Caixa — 1 por parcela por serviço ────────
    const todasParcelas = [];

    if (forma === "Antecipado") {
      // Pagamento antecipado — 4 linhas conforme Excel:
      // 1. Receita Total > Receita de Projetos > Arquitetura (valor bruto)
      // 2. Receita Total > Receita de Projetos > Engenharia (valor bruto)
      // 3. Receita Total > Desconto (conta redutora, valor do desconto)
      // 4. Caixa > Receita de Projetos (valor liquido = bruto - desconto)
      const dataReceb    = dtEntrada || hoje;
      const descAtualPct = inclArq && inclEng ? 10 : 5;
      const valorBruto   = Math.round((vArqFinal + vEngFinal) * 100) / 100;
      const valorDesc    = Math.round(valorBruto * descAtualPct / 100 * 100) / 100;
      const valorLiquido = Math.round((valorBruto - valorDesc) * 100) / 100;

      // Linha 3: conta redutora de desconto
      lancs.push(mkLanc("", valorDesc,
        "Receita de Projetos", "Receita Total", "Desconto",
        "Contabil", "Conta contabil", hoje, null));

      // Linha 4: caixa a vista com valor liquido (sem sub conta 2)
      const trAntec = tipoRecebimento(dataReceb);
      lancs.push(mkLanc("", valorLiquido,
        "Fluxo de caixa projetos", "Caixa", "Receita de Projetos",
        trAntec.competencia, trAntec.recebimento, hoje, dataReceb));

    } else {
      // Parcelado — entrada + parcelas (valor total sem desmembrar)
      if (vEntrada > 0 && dtEntrada) {
        const trEnt = tipoRecebimento(dtEntrada);
        lancs.push(mkLanc("Arquitetura", vEntrada,
          "Fluxo de caixa projetos", "Caixa", "Receita de Projetos",
          trEnt.competencia, trEnt.recebimento, hoje, dtEntrada));
      }
      parcelas.forEach(p => {
        if (p.valor > 0 && p.data) {
          const trParc = tipoRecebimento(p.data);
          lancs.push(mkLanc("", p.valor,
            "Fluxo de caixa projetos", "Caixa", "Receita de Projetos",
            trParc.competencia, trParc.recebimento, hoje, p.data));
        }
      });
    }

    const novosOrc  = (data.orcamentosProjeto || []).map(o => o.id===orc.id ? {...o, status:"ganho", pagamento:pgto} : o);
    const novosLanc = [...existentes, ...lancs];
    onClose();
    save({ ...data, orcamentosProjeto:novosOrc, receitasFinanceiro:novosLanc }).catch(console.error);
  }

  const inp = { background:"#0a1122", border:"1px solid #1e293b", borderRadius:6, color:"#f1f5f9", padding:"7px 10px", fontSize:13, outline:"none", fontFamily:"inherit", width:"100%", boxSizing:"border-box" };
  const lbl = { color:"#64748b", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5 };
  const sec = { color:"#94a3b8", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:10 };
  const fmtV = v => "R$ " + (v||0).toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#0f172a", border:"1px solid #334155", borderRadius:14, padding:"28px 32px", width:"100%", maxWidth:580, boxShadow:"0 24px 48px rgba(0,0,0,0.7)", maxHeight:"90vh", overflowY:"auto" }}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <div style={{ color:"#10b981", fontWeight:700, fontSize:16 }}>Confirmar Ganho</div>
            <div style={{ color:"#64748b", fontSize:12, marginTop:3 }}>{orc.cliente} — {orc.tipo}</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#64748b", fontSize:20, cursor:"pointer" }}>X</button>
        </div>

        <div style={sec}>Valores do Contrato</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
          {/* Arquitetura */}
          <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:12, alignItems:"center",
            background: inclArq ? "#0a1526" : "#080e1a", border:"1px solid " + (inclArq ? "#1e293b" : "#0f172a"),
            borderRadius:8, padding:"10px 14px", opacity: inclArq ? 1 : 0.5 }}>
            <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", userSelect:"none" }}>
              <input type="checkbox" checked={inclArq} onChange={e => setInclArq(e.target.checked)}
                style={{ width:16, height:16, accentColor:"#3b82f6", cursor:"pointer" }} />
              <span style={{ ...lbl, margin:0 }}>Arquitetura (R$)</span>
            </label>
            <input
              defaultValue={vArq.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 })}
              disabled={!inclArq}
              onBlur={e => {
                const v = parseFloat(e.target.value.replace(/\./g,"").replace(",",".")) || arqTotal;
                setVArq(v);
                e.target.value = v.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
              }}
              style={{ ...inp, opacity: inclArq ? 1 : 0.4 }} />
          </div>
          {/* Engenharia */}
          {engTotal > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:12, alignItems:"center",
              background: inclEng ? "#0a1526" : "#080e1a", border:"1px solid " + (inclEng ? "#1e293b" : "#0f172a"),
              borderRadius:8, padding:"10px 14px", opacity: inclEng ? 1 : 0.5 }}>
              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", userSelect:"none" }}>
                <input type="checkbox" checked={inclEng} onChange={e => setInclEng(e.target.checked)}
                  style={{ width:16, height:16, accentColor:"#a78bfa", cursor:"pointer" }} />
                <span style={{ ...lbl, margin:0 }}>Engenharia (R$)</span>
              </label>
              <input
                defaultValue={vEng.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 })}
                disabled={!inclEng}
                onBlur={e => {
                  const v = parseFloat(e.target.value.replace(/\./g,"").replace(",",".")) || engTotal;
                  setVEng(v);
                  e.target.value = v.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
                }}
                style={{ ...inp, opacity: inclEng ? 1 : 0.4 }} />
            </div>
          )}
          {/* Total */}
          <div style={{ background:"#0d1526", border:"1px solid #10b981", borderRadius:8, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ color:"#64748b", fontSize:13 }}>Total contratado</span>
            <span style={{ color:"#10b981", fontWeight:800, fontSize:16 }}>{fmtV(total)}</span>
          </div>
        </div>

        <div style={sec}>Forma de Pagamento</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            <label style={lbl}>Forma de Pagamento</label>
            <select value={forma} onChange={e => {
              const f = e.target.value;
              setForma(f);
              if (f === "Antecipado") {
                const descAtual = inclArq && inclEng ? 10 : 5;
                setVEntrada(Math.round(total * (1 - descAtual/100) * 100) / 100);
                setNParc(1);
                setParcelas([]);
              } else {
                const novoNParc = inclArq && inclEng ? 4 : 3;
                setVEntrada(Math.round(total / novoNParc * 100) / 100);
                setNParc(novoNParc);
              }
            }} style={{ ...inp, cursor:"pointer" }}>
              <option>Antecipado</option>
              <option>PIX</option><option>Transferencia</option><option>Boleto</option><option>Cheque</option><option>Dinheiro</option>
            </select>
            {forma === "Antecipado" && (
              <div style={{ color:"#10b981", fontSize:11, marginTop:3 }}>
                {inclArq && inclEng ? 10 : 5}% de desconto — {inclArq && inclEng ? "Pacote Completo" : inclArq ? "Apenas Arquitetura" : "Apenas Engenharia"} · {fmtV(Math.round(total*(1-(inclArq && inclEng ? 0.10 : 0.05))*100)/100)} à vista
              </div>
            )}
          </div>
          {forma !== "Antecipado" && (
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              <label style={lbl}>Parcelas (inclui entrada)</label>
              <input type="number" min="1" max="60" value={nParc}
                onChange={e => setNParc(parseInt(e.target.value) || 1)}
                style={inp} />
              <div style={{ color:"#64748b", fontSize:11, marginTop:3 }}>
                Sugerido: {nParcPadrao}x ({inclArq && inclEng ? "Pacote" : "Apenas Arq."})
              </div>
            </div>
          )}
        </div>

        <div style={{ background:"#0a1526", border:"1px solid #1e293b", borderRadius:8, padding:14, marginBottom:12 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:8 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              <label style={lbl}>{forma === "Antecipado" ? "Valor Total com Desconto (R$)" : "Valor da Entrada (R$)"}</label>
              <input
                key={vEntrada}
                defaultValue={vEntrada.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 })}
                onBlur={e => {
                  const v = parseFloat(e.target.value.replace(/\./g,"").replace(",",".")) || 0;
                  setVEntrada(v);
                  e.target.value = v.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
                }}
                style={inp} />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              <label style={lbl}>Data da Entrada</label>
              <input ref={dtEntradaRef} type="date" value={dtEntrada}
                onChange={e=>{ setDtEntrada(e.target.value); setAviso(""); setConfirmarFuturo(false); }}
                style={{ ...inp, colorScheme:"dark", cursor:"pointer", borderColor: aviso&&!dtEntrada?"#f87171":"" }} />
            </div>
          </div>
          {forma !== "Antecipado" && nRest > 0 && (
            <div style={{ color:"#64748b", fontSize:11 }}>
              Restante: <span style={{ color:"#f1f5f9", fontWeight:600 }}>{fmtV(total - vEntrada)}</span> em {nRest} {nRest === 1 ? "parcela" : "parcelas"} de <span style={{ color:"#f1f5f9", fontWeight:600 }}>{fmtV(vParc)}</span>
            </div>
          )}
        </div>

        {forma !== "Antecipado" && parcelas.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
            {parcelas.map((p, i) => (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"80px 1fr 1fr", gap:12, alignItems:"center", background:"#0a1122", borderRadius:7, padding:"10px 12px", border:"1px solid #1e293b" }}>
                <div style={{ color:"#94a3b8", fontSize:12, fontWeight:600 }}>{p.label}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={{ ...lbl, fontSize:10 }}>Valor (R$)</label>
                  <input
                    key={p.valor + "-" + i}
                    defaultValue={p.valor.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 })}
                    onBlur={e => {
                      const v = parseFloat(e.target.value.replace(/\./g,"").replace(",",".")) || 0;
                      atualizarParcela(i, "valor", v);
                      e.target.value = v.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
                    }}
                    style={inp} />
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={{ ...lbl, fontSize:10 }}>Vencimento</label>
                  <input type="date" value={p.data}
                    onChange={e => {
                      if (!dtEntrada) {
                        setAviso("Defina primeiro a data da entrada antes de definir as parcelas.");
                        setTimeout(() => { if (dtEntradaRef.current) dtEntradaRef.current.focus(); }, 50);
                        return;
                      }
                      atualizarParcela(i, "data", e.target.value);
                    }}
                    style={{ ...inp, colorScheme:"dark", cursor:"pointer" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ background:"#0d1526", border:"1px solid #1e293b", borderRadius:8, padding:"12px 14px", marginBottom:20 }}>
          <div style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>Receitas que serão lançadas</div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
            <span style={{ color: inclArq ? "#94a3b8" : "#334155" }}>Arquitetura</span>
            <span style={{ color: inclArq ? "#3b82f6" : "#334155", fontWeight:600 }}>{inclArq ? fmtV(vArq) : "—"}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
            <span style={{ color: inclEng ? "#94a3b8" : "#334155" }}>Engenharia</span>
            <span style={{ color: inclEng ? "#a78bfa" : "#334155", fontWeight:600 }}>{inclEng ? fmtV(vEng) : "—"}</span>
          </div>
          {forma === "Antecipado" && (() => {
            const descPct  = inclArq && inclEng ? 10 : 5;
            const vArqR    = Math.round((inclArq ? vArq : 0) * 100) / 100;
            const vEngR    = Math.round((inclEng ? vEng : 0) * 100) / 100;
            const totalR   = Math.round((vArqR + vEngR) * 100) / 100;
            const liquidoR = Math.round(totalR * (1 - descPct/100) * 100) / 100;
            const descR    = Math.round((totalR - liquidoR) * 100) / 100;
            return (
              <>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginTop:6, color:"#f87171" }}>
                  <span>(-) Desconto Concedido ({descPct}%)</span>
                  <span style={{ fontWeight:600 }}>− {fmtV(descR)}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginTop:8, paddingTop:8, borderTop:"1px solid #1e293b" }}>
                  <span style={{ color:"#64748b", fontWeight:700 }}>Líquido recebido</span>
                  <span style={{ color:"#10b981", fontWeight:800 }}>{fmtV(liquidoR)}</span>
                </div>
              </>
            );
          })()}
          {forma !== "Antecipado" && (
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginTop:8, paddingTop:8, borderTop:"1px solid #1e293b" }}>
              <span style={{ color:"#64748b", fontWeight:700 }}>Total contratado</span>
              <span style={{ color:"#10b981", fontWeight:800 }}>{fmtV(Math.round(total * 100) / 100)}</span>
            </div>
          )}
        </div>

        {aviso && (
          <div style={{ background:"rgba(248,113,113,0.12)", border:"1px solid #f87171", borderRadius:7,
            padding:"10px 14px", marginBottom:12, color:"#f87171", fontSize:12, fontWeight:600 }}>
            {aviso}
          </div>
        )}

        {confirmarFuturo && (
          <div style={{ background:"rgba(245,158,11,0.12)", border:"1px solid #f59e0b", borderRadius:7,
            padding:"12px 14px", marginBottom:12 }}>
            <div style={{ color:"#fbbf24", fontSize:12, fontWeight:600, marginBottom:10 }}>
              A data {forma === "Antecipado" ? "do pagamento" : "da entrada"} ({new Date(dtEntrada+"T00:00:00").toLocaleDateString("pt-BR")}) e futura. O lancamento sera contabilizado como A Receber. Confirmar assim mesmo?
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setConfirmarFuturo(false)}
                style={{ background:"#1e293b", color:"#94a3b8", border:"1px solid #334155", borderRadius:6, padding:"6px 16px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
                Nao, corrigir data
              </button>
              <button onClick={()=>confirmar(true)}
                style={{ background:"#f59e0b", color:"#000", border:"none", borderRadius:6, padding:"6px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                Sim, confirmar assim
              </button>
            </div>
          </div>
        )}

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ background:"#1e293b", color:"#94a3b8", border:"1px solid #334155", borderRadius:7, padding:"9px 20px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
          {!confirmarFuturo && (
            <button onClick={()=>confirmar(false)} style={{ background:"#10b981", color:"#fff", border:"none", borderRadius:7, padding:"9px 20px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Confirmar Ganho</button>
          )}
        </div>

      </div>
    </div>
  );
}

function ServicosPanel({ cliente: clienteProp, data, save }) {
  const [modalServico, setModalServico] = useState(null);
  const [subView, setSubView] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [modalGanho, setModalGanho] = useState(null); // { orc, arqTotal, engTotal, grandTotal }
  const [orcBase, setOrcBase] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!openMenu) return;
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenu]);
  // Always use fresh data from store
  const cliente = data.clientes.find(c => c.id === clienteProp.id) || clienteProp;

  const SERVICOS_DEF = [
    { key:"projeto",            icon:"📐", label:"Projeto",              cor:"#3b82f6", subacoes:[{ key:"orcamento", label:"Orçar Projeto", icon:"🧮" }] },
    { key:"acompanhamentoObra", icon:"🏗", label:"Acompanhamento de Obra",cor:"#f59e0b", subacoes:[] },
    { key:"gestaoObra",         icon:"⚙️", label:"Gestão de Obra",        cor:"#10b981", subacoes:[] },
    { key:"empreendimento",     icon:"🏢", label:"Empreendimento",         cor:"#8b5cf6", subacoes:[] },
  ];

  const [orcamentos, setOrcamentos] = useState((data.orcamentosProjeto||[]).filter(o=>o.clienteId===cliente.id));
  useEffect(() => {
    fetch(`${API_URL}/api/orcamentos?clienteId=${cliente.id}`)
      .then(r=>r.json())
      .then(d=>{ if(d.ok) setOrcamentos(d.data||[]); })
      .catch(()=>setOrcamentos((data.orcamentosProjeto||[]).filter(o=>o.clienteId===cliente.id)));
  }, [cliente.id, data.orcamentosProjeto?.length]);

  async function salvarOrcamento(orc) {
    const todos = data.orcamentosProjeto || [];
    const todosOrc = data.orcamentosProjeto || [];
    const nextOrcCod = () => {
      const maxSeq = todosOrc.reduce((mx, o) => {
        const m = (o.id||"").match(/^ORC-(\d+)$/);
        return m ? Math.max(mx, parseInt(m[1])) : mx;
      }, 0);
      return "ORC-" + String(maxSeq + 1).padStart(4, "0");
    };
    const novo = { ...orc, clienteId: cliente.id, cliente: cliente.nome,
      whatsapp: cliente.contatos?.find(c=>c.whatsapp)?.telefone || "",
      id: orc.id || nextOrcCod(), criadoEm: orc.criadoEm || new Date().toISOString() };
    const novos = orc.id ? todos.map(o=>o.id===orc.id?novo:o) : [...todos, novo];
    setOrcBase(novo);
    setSubView("resultado");
    save({ ...data, orcamentosProjeto: novos }).catch(console.error);
  }

  // Se está em subview de orçamento, renderiza o módulo completo
  if (subView === "orcamento-projeto" || subView === "resultado") {
    return (
      <div style={S.detailCard}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
          <button style={S.backBtn} onClick={() => { setSubView(null); setOrcBase(null); }}>← Voltar</button>
          <div>
            <div style={{ color:"#f1f5f9", fontWeight:700, fontSize:15 }}>Orçamento de Projeto</div>
            <div style={{ color:"#64748b", fontSize:12 }}>Cliente: {cliente.nome}</div>
          </div>
        </div>
        {subView === "orcamento-projeto"
          ? <FormOrcamentoProjeto clienteNome={cliente.nome} clienteWA={cliente.contatos?.find(c=>c.whatsapp)?.telefone||""} onSalvar={salvarOrcamento} orcBase={orcBase} onVoltar={()=>{setSubView(null);setOrcBase(null);}} />
          : <ResultadoOrcamentoProjeto orc={orcBase} onEditar={() => setSubView("orcamento-projeto")} onVerProposta={(o) => { setOrcBase(o); setSubView("resultado"); }} fmt={fmt} fmtM2={fmtM2} />
        }
      </div>
    );
  }

  if (subView === "orcamento-teste") {
    return (
      <div style={S.detailCard}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
          <button style={S.backBtn} onClick={() => { setSubView(null); setOrcBase(null); }}>← Voltar</button>
          <div>
            <div style={{ color:"#f59e0b", fontWeight:700, fontSize:15 }}>🧪 Orçamento de Projeto — Teste</div>
            <div style={{ color:"#64748b", fontSize:12 }}>Cliente: {cliente.nome}</div>
          </div>
        </div>
        <FormOrcamentoProjetoTeste clienteNome={cliente.nome} clienteWA={cliente.contatos?.find(c=>c.whatsapp)?.telefone||""} onSalvar={salvarOrcamento} orcBase={orcBase} onVoltar={()=>{setSubView(null);setOrcBase(null);}} />
      </div>
    );
  }

  return (
    <div style={S.detailCard}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={S.detailCardTitle}>🎯 Serviços</div>
        <button style={S.btnPrimary} onClick={() => setModalServico("menu")}>+ Cadastrar Serviço</button>
      </div>

      {/* Serviços ativos com ações */}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {SERVICOS_DEF.filter(s => cliente.servicos?.[s.key]).map(s => (
          <div key={s.key} style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:10, padding:"14px 16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:20 }}>{s.icon}</span>
                <span style={{ color:"#e2e8f0", fontWeight:700, fontSize:14 }}>{s.label}</span>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                {s.subacoes.map(sa => (
                  <button key={sa.key}
                    style={{ background:"#1e3a5f", color: s.cor, border:`1px solid ${s.cor}`, borderRadius:8, padding:"7px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}
                    onClick={() => { setOrcBase(null); setSubView(s.key === "projeto" && sa.key === "orcamento" ? "orcamento-projeto" : null); }}>
                    {sa.icon} {sa.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Histórico de orçamentos deste serviço */}
            {s.key === "projeto" && orcamentos.length > 0 && (()=>{
              const STATUS_ORC = {
                ganho:    { label:"Ganho",    cor:"#10b981", bg:"rgba(16,185,129,0.15)", icon:"✅" },
                perdido:  { label:"Perdido",  cor:"#f87171", bg:"rgba(248,113,113,0.15)", icon:"❌" },
                descarte: { label:"Descarte", cor:"#64748b", bg:"rgba(100,116,139,0.15)", icon:"🗑" },
              };
              const setStatusOrc = async (orcId, novoStatus) => {
                const todos = data.orcamentosProjeto || [];
                const orc = todos.find(o => o.id === orcId);
                // Estorno: se estava ganho e vai para perdido, remove lancamentos do financeiro
                let novosLanc = data.receitasFinanceiro || [];
                if (orc && orc.status === "ganho" && novoStatus === "perdido") {
                  novosLanc = novosLanc.filter(r => r.orcId !== orcId);
                }
                const novosOrc = todos.map(o => o.id===orcId ? {...o, status:novoStatus} : o);
                await save({ ...data, orcamentosProjeto: novosOrc, receitasFinanceiro: novosLanc });
              };
              return (
              <div style={{ marginTop:12, borderTop:"1px solid #1e293b", paddingTop:10 }}>
                <div style={{ color:"#64748b", fontSize:11, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Orçamentos realizados</div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {orcamentos.map(o => {
                    const r = o.resultado || {};
                    const nUnid = r.nUnidades || 1;
                    const arqTotal = Math.round((r.precoArq || r.precoTotal || r.precoFinal || 0) * 100) / 100;
                    const engUnit = Math.round((r.engTotal ?? calcularEngenharia(r.areaTotal||0).totalEng) * 100) / 100;
                    const engTotalRepet = Math.round((engUnit * (nUnid > 1
                      ? (1 + (r.repeticaoFaixas||[]).reduce((s,f) => s + f.pct, 0))
                      : 1)) * 100) / 100;
                    const grandTotal = Math.round((arqTotal + engTotalRepet) * 100) / 100;
                    const st = o.status ? STATUS_ORC[o.status] : null;
                    return (
                      <div key={o.id} style={{ background:"#0d1526", borderRadius:8, padding:"10px 12px",
                        borderLeft: st ? `3px solid ${st.cor}` : "3px solid transparent" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                              <span style={{ color:"#e2e8f0", fontSize:13, fontWeight:600 }}>{o.tipo} — {o.subtipo}</span>
                              {st && (
                                <span style={{ background:st.bg, color:st.cor, fontSize:11, fontWeight:700,
                                  borderRadius:4, padding:"1px 8px", border:`1px solid ${st.cor}` }}>
                                  {st.icon} {st.label}
                                </span>
                              )}
                              <span style={{ color:"#334155", fontSize:10, fontFamily:"monospace" }}>{o.id}</span>
                            </div>
                            <span style={{ color:"#64748b", fontSize:12 }}>{o.padrao} · {o.tamanho} · {fmtA(r.areaTotal,0)}m²</span>
                            {nUnid > 1 && (
                              <span style={{ display:"inline-block", marginLeft:8, background:"#1e3a5f", color:"#60a5fa", fontSize:11, fontWeight:700, borderRadius:4, padding:"1px 7px" }}>
                                🔁 {nUnid} unidades
                              </span>
                            )}
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                            <button style={S.btnXsSm} onClick={() => { setOrcBase(o); setSubView("resultado"); }}>Ver</button>
                            <button style={S.btnXsSm} onClick={() => { setOrcBase(o); setSubView("orcamento-projeto"); }}>Editar</button>
                            <div style={{ position:"relative" }}>
                              <button onClick={() => setOpenMenu(openMenu===o.id ? null : o.id)}
                                style={{ ...S.btnXsSm, padding:"3px 8px", background:"#1e293b",
                                  border:"1px solid #334155", borderRadius:5, color:"#94a3b8",
                                  fontSize:14, cursor:"pointer", lineHeight:1 }}>
                                ⋯
                              </button>
                              {openMenu === o.id && (
                                <div ref={menuRef} style={{ position:"absolute", right:0, top:"calc(100% + 4px)", zIndex:999,
                                  background:"#0f172a", border:"1px solid #334155", borderRadius:8,
                                  boxShadow:"0 8px 24px rgba(0,0,0,0.5)", minWidth:140, overflow:"hidden" }}>
                                  <button
                                    disabled={o.status === "ganho"}
                                    onClick={() => {
                                      if (o.status !== "ganho") {
                                        setModalGanho({ orc:o, arqTotal, engTotal:engTotalRepet, grandTotal });
                                        setOpenMenu(null);
                                      }
                                    }}
                                    style={{ display:"block", width:"100%", textAlign:"left",
                                      background: o.status==="ganho" ? "rgba(16,185,129,0.12)" : "transparent",
                                      border:"none", borderBottom:"1px solid #1e293b",
                                      color: o.status==="ganho" ? "#10b981" : "#cbd5e1",
                                      padding:"9px 14px", fontSize:13, cursor: o.status==="ganho" ? "not-allowed" : "pointer",
                                      fontFamily:"inherit", fontWeight: o.status==="ganho" ? 700 : 400,
                                      opacity: o.status==="ganho" ? 0.7 : 1 }}>
                                    {o.status==="ganho" ? "Ganho ✓" : "Ganho"}
                                  </button>
                                  <button onClick={() => {
                                      setStatusOrc(o.id, o.status==="perdido" ? null : "perdido");
                                      setOpenMenu(null);
                                    }}
                                    style={{ display:"block", width:"100%", textAlign:"left",
                                      background: o.status==="perdido" ? "rgba(248,113,113,0.12)" : "transparent",
                                      border:"none", borderBottom:"1px solid #1e293b",
                                      color: o.status==="perdido" ? "#f87171" : "#cbd5e1",
                                      padding:"9px 14px", fontSize:13, cursor:"pointer", fontFamily:"inherit",
                                      fontWeight: o.status==="perdido" ? 700 : 400 }}>
                                    {o.status==="perdido" ? "Perdido ✓" : o.status==="ganho" ? "Perdido (estorna)" : "Perdido"}
                                  </button>
                                  <button
                                    onClick={() => { setConfirmDelete(o.id); setOpenMenu(null); }}
                                    style={{ display:"block", width:"100%", textAlign:"left",
                                      background:"transparent", border:"none",
                                      color:"#f87171", padding:"9px 14px", fontSize:13,
                                      cursor:"pointer", fontFamily:"inherit" }}>
                                    🗑 Descartar
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:16, marginTop:6 }}>
                          <span style={{ color:"#94a3b8", fontSize:11 }}>Arq.: <span style={{ color:"#10b981", fontWeight:600 }}>{fmt(arqTotal)}</span></span>
                          <span style={{ color:"#94a3b8", fontSize:11 }}>Eng.: <span style={{ color:"#a78bfa", fontWeight:600 }}>{fmt(engTotalRepet)}</span></span>
                          <span style={{ color:"#94a3b8", fontSize:11, marginLeft:"auto" }}>Total: <span style={{ color:"#f59e0b", fontWeight:800, fontSize:14 }}>{fmt(grandTotal)}</span></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })()}
          </div>
        ))}

      {modalGanho && <ModalConfirmarGanho
        orc={modalGanho.orc}
        arqTotal={modalGanho.arqTotal}
        engTotal={modalGanho.engTotal}
        grandTotal={modalGanho.grandTotal}
        data={data} save={save}
        onClose={() => setModalGanho(null)}
      />}

        {/* MODAL CONFIRMA EXCLUSÃO */}
      {modalGanho && <ModalConfirmarGanho
        orc={modalGanho.orc}
        arqTotal={modalGanho.arqTotal}
        engTotal={modalGanho.engTotal}
        grandTotal={modalGanho.grandTotal}
        data={data} save={save}
        onClose={() => setModalGanho(null)}
      />}

      {confirmDelete && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:9999,
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#0f172a", border:"1px solid #334155", borderRadius:12,
            padding:"28px 32px", maxWidth:380, width:"90%", boxShadow:"0 24px 48px rgba(0,0,0,0.6)" }}>
            <div style={{ color:"#f1f5f9", fontWeight:700, fontSize:16, marginBottom:10 }}>Excluir orçamento?</div>
            <div style={{ color:"#94a3b8", fontSize:13, marginBottom:24, lineHeight:1.6 }}>
              Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={() => setConfirmDelete(null)}
                style={{ background:"#1e293b", color:"#94a3b8", border:"1px solid #334155",
                  borderRadius:7, padding:"8px 18px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                Cancelar
              </button>
              <button onClick={async () => {
                  const idParaExcluir = confirmDelete;
                  setConfirmDelete(null);
                  const novos = (data.orcamentosProjeto||[]).filter(x => x.id !== idParaExcluir);
                  save({ ...data, orcamentosProjeto: novos }).catch(console.error);
                }}
                style={{ background:"#dc2626", color:"#fff", border:"none",
                  borderRadius:7, padding:"8px 18px", fontSize:13, fontWeight:700,
                  cursor:"pointer", fontFamily:"inherit" }}>
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}


      {!SERVICOS_DEF.some(s => cliente.servicos?.[s.key]) && (
          <div style={{ color:"#475569", fontSize:13, textAlign:"center", padding:"20px 0" }}>
            Nenhum serviço cadastrado. Clique em "+ Cadastrar Serviço" para adicionar.
          </div>
        )}
      </div>

      {/* MODAL — menu de serviços */}
      {modalServico === "menu" && (
        <div style={S.overlay}>
          <div style={{ ...S.modalBox, maxWidth:480 }}>
            <div style={S.modalHead}>
              <h2 style={{ color:"#f1f5f9", fontWeight:800, fontSize:18, margin:0 }}>Cadastrar Serviço</h2>
              <button style={S.closeBtn} onClick={() => setModalServico(null)}>✕</button>
            </div>
            <p style={{ color:"#64748b", fontSize:13, margin:"0 0 20px" }}>Selecione o serviço para {cliente.nome}:</p>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {SERVICOS_DEF.map(s => {
                const ativo = cliente.servicos?.[s.key];
                return (
                  <button key={s.key} style={{ ...S.servicoMenuItem, borderColor: ativo ? s.cor : "#1e293b", background: ativo ? "#0d1f3c" : "#0f172a" }}
                    onClick={() => {
                      const novosServicos = { ...cliente.servicos, [s.key]: true };
                      const novosClientes = data.clientes.map(c => c.id===cliente.id ? { ...c, servicos:novosServicos } : c);
                      save({ ...data, clientes: novosClientes });
                      if (s.key === "projeto") { setModalServico("projeto"); }
                      else { setModalServico(null); }
                    }}>
                    <span style={{ fontSize:22 }}>{s.icon}</span>
                    <div style={{ flex:1, textAlign:"left" }}>
                      <div style={{ color: ativo ? s.cor : "#e2e8f0", fontWeight:700, fontSize:14 }}>
                        {s.label} {ativo && <span style={{ fontSize:11, color:"#4ade80" }}>● Ativo</span>}
                      </div>
                      <div style={{ color:"#475569", fontSize:12, marginTop:2 }}>
                        {s.key==="projeto" && "Elaboração de projetos arquitetônicos com orçamento"}
                        {s.key==="acompanhamentoObra" && "Visitas técnicas e relatórios periódicos"}
                        {s.key==="gestaoObra" && "Gestão completa de custos, equipe e cronograma"}
                        {s.key==="empreendimento" && "Incorporação ou desenvolvimento imobiliário"}
                      </div>
                    </div>
                    <span style={{ color: ativo ? s.cor : "#334155", fontSize:18 }}>›</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL — submenu projeto */}
      {modalServico === "projeto" && (
        <div style={S.overlay}>
          <div style={{ ...S.modalBox, maxWidth:420 }}>
            <div style={S.modalHead}>
              <h2 style={{ color:"#f1f5f9", fontWeight:800, fontSize:18, margin:0 }}>📐 Projeto</h2>
              <button style={S.closeBtn} onClick={() => setModalServico(null)}>✕</button>
            </div>
            <p style={{ color:"#64748b", fontSize:13, margin:"0 0 20px" }}>O que deseja fazer para {cliente.nome.split(" ")[0]}?</p>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <button style={{ ...S.btnSubacao2, display:"flex", alignItems:"center", gap:14, background:"#0f172a", border:"2px solid #1e293b", borderRadius:12, padding:"14px 16px", cursor:"pointer", fontFamily:"inherit", width:"100%", color:"#f1f5f9" }} onClick={() => { setModalServico(null); setOrcBase(null); setSubView("orcamento-projeto"); }}>
                <span style={{ fontSize:24 }}>🧮</span>
                <div style={{ textAlign:"left" }}>
                  <div style={{ color:"#f1f5f9", fontWeight:700, fontSize:14 }}>Orçar Projeto</div>
                  <div style={{ color:"#64748b", fontSize:12 }}>Calcular valor do projeto com base nos cômodos e padrão</div>
                </div>
                <span style={{ color:"#3b82f6", fontSize:20 }}>›</span>
              </button>
            </div>
            <button style={{ ...S.btnSecondary, marginTop:12, width:"100%" }} onClick={() => setModalServico("menu")}>← Voltar</button>
          </div>
        </div>
      )}
    </div>
  );
}

