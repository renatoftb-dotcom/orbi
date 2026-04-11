function HomeMenu({ setAba, data }) {
  const modulos = [
    {
      key:"clientes",
      icon:"👥",
      label:"Clientes",
      desc:"Cadastro, orçamentos e histórico",
      cor:"#10b981",
      badge: data.clientes?.length || 0,
    },
    {
      key:"projetos",
      icon:"📐",
      label:"Projetos",
      desc:"Etapas, prazos e colaboradores",
      cor:"#3b82f6",
      badge: null,
    },
    {
      key:"obras",
      icon:"🏗",
      label:"Obras",
      desc:"Gestão, acompanhamento e execução",
      cor:"#f59e0b",
      badge: null,
    },
    {
      key:"financeiro",
      icon:"💰",
      label:"Financeiro",
      desc:"Receitas, despesas e fluxo de caixa",
      cor:"#7c3aed",
      badge: null,
    },
    {
      key:"fornecedores",
      icon:"🏭",
      label:"Fornecedores",
      desc:"Cadastro e gestão de fornecedores",
      cor:"#64748b",
      badge: data.fornecedores?.length || 0,
    },
    {
      key:"escritorio",
      icon:"🏢",
      label:"Escritório",
      desc:"Configurações, equipe e dados do escritório",
      cor:"#0ea5e9",
      badge: null,
    },
  ];

  return (
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", minHeight:"calc(100vh - 120px)",
      padding:"40px 28px",
    }}>
      {/* Saudação */}
      <div style={{ textAlign:"center", marginBottom:48 }}>
        <div style={{ color:"#f1f5f9", fontWeight:900, fontSize:26, marginBottom:6 }}>
          Vicke
        </div>
        <div style={{ color:"#64748b", fontSize:14 }}>
          Selecione um módulo para começar
        </div>
      </div>

      {/* Grid 3×2 */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(3, 1fr)",
        gap:20,
        width:"100%",
        maxWidth:780,
      }}>
        {modulos.map(m => (
          <button
            key={m.key}
            onClick={() => setAba(m.key)}
            style={{
              background:"#0d1526",
              border:`1.5px solid ${m.cor === "#64748b" ? "#1e293b" : m.cor+"44"}`,
              borderRadius:16,
              padding:"32px 24px",
              cursor:"pointer",
              textAlign:"left",
              fontFamily:"inherit",
              transition:"all 0.15s",
              position:"relative",
              display:"flex",
              flexDirection:"column",
              gap:10,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "#0f172a";
              e.currentTarget.style.borderColor = m.cor;
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "#0d1526";
              e.currentTarget.style.borderColor = m.cor === "#64748b" ? "#1e293b" : m.cor+"44";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {/* Badge contador */}
            {m.badge != null && m.badge > 0 && (
              <div style={{
                position:"absolute", top:14, right:14,
                background:m.cor, color:"#fff",
                fontSize:11, fontWeight:700,
                borderRadius:10, padding:"1px 8px",
                minWidth:22, textAlign:"center",
              }}>
                {m.badge}
              </div>
            )}

            {/* Ícone */}
            <div style={{
              width:48, height:48, borderRadius:12,
              background:m.cor+"22",
              border:`1px solid ${m.cor+"44"}`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:22,
            }}>
              {m.icon}
            </div>

            {/* Texto */}
            <div style={{ color:"#f1f5f9", fontWeight:700, fontSize:16, marginTop:4 }}>
              {m.label}
            </div>
            <div style={{ color:"#475569", fontSize:12, lineHeight:1.5 }}>
              {m.desc}
            </div>

            {/* Indicador cor */}
            <div style={{
              position:"absolute", bottom:0, left:0, right:0, height:3,
              background:m.cor, borderRadius:"0 0 14px 14px",
              opacity: m.cor === "#64748b" ? 0.3 : 0.7,
            }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function ClienteExpandivel({ cliente, data, waLink, S, DetailRow }) {
  const [abertos, setAbertos] = React.useState({ cadastro:false, financeiro:false });
  const toggle = k => setAbertos(p => ({...p, [k]:!p[k]}));

  const cpfCliente = cliente.cpfCnpj || cliente.id;
  const lancsCli = (data.receitasFinanceiro||[]).filter(r =>
    r.clienteId === cpfCliente || r.clienteId === cliente.id
  );
  const totalContabil = lancsCli.filter(r=>r.contabil1==="Receita Total" && r.tipoConta!=="Conta Redutora").reduce((s,r)=>s+(r.valor||0),0);
  const totalRecebido = lancsCli.filter(r=>r.recebimento==="Recebido").reduce((s,r)=>s+(r.valor||0),0);
  const totalReceber  = lancsCli.filter(r=>r.recebimento==="A Receber").reduce((s,r)=>s+(r.valor||0),0);
  const fmtV = v => "R$ " + v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});

  const btnStyle = aberto => ({
    width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center",
    background: aberto ? "#0d1a2e" : "#0d1526",
    border:"1px solid " + (aberto ? "#2563eb" : "#1e293b"),
    borderRadius: aberto ? "8px 8px 0 0" : 8,
    padding:"12px 16px", cursor:"pointer", fontFamily:"inherit",
    color: aberto ? "#60a5fa" : "#94a3b8", fontSize:13, fontWeight:600,
  });

  return (
    <>
      {/* Cadastro expansivel */}
      <div style={{ marginBottom:12 }}>
        <button style={btnStyle(abertos.cadastro)} onClick={()=>toggle("cadastro")}>
          <span>Cadastro</span>
          <span style={{ fontSize:11 }}>{abertos.cadastro ? "▲" : "▼"}</span>
        </button>
        {abertos.cadastro && (
          <div style={{ border:"1px solid #2563eb", borderTop:"none", borderRadius:"0 0 8px 8px",
            background:"#080e1a", padding:"16px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <div>
                <div style={S.detailCardTitle}>Endereco</div>
                <div style={S.detailFields}>
                  <DetailRow label="CEP" value={cliente.cep} />
                  <DetailRow label="Logradouro" value={`${cliente.logradouro}, ${cliente.numero}${cliente.complemento ? " - "+cliente.complemento : ""}`} />
                  <DetailRow label="Bairro" value={cliente.bairro} />
                  <DetailRow label="Cidade/Estado" value={`${cliente.cidade} - ${cliente.estado}`} />
                </div>
              </div>
              <div>
                <div style={S.detailCardTitle}>Contatos</div>
                {cliente.contatos?.map(ct => (
                  <div key={ct.id} style={{ ...S.contatoRow, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontWeight:600, color:"#e2e8f0", fontSize:13 }}>{ct.nome} <span style={{ color:"#64748b", fontWeight:400 }}>({ct.cargo})</span></div>
                      <div style={{ color:"#94a3b8", fontSize:12, marginTop:2 }}>
                        {ct.telefone} {ct.whatsapp && <span style={S.waBadge}>WhatsApp</span>}
                      </div>
                    </div>
                    {ct.whatsapp && ct.telefone && (
                      <a href={waLink(ct.telefone, `Ola ${ct.nome.split(" ")[0]}, tudo bem?`)} target="_blank" rel="noopener noreferrer" style={{ ...S.waBtnSm, textDecoration:"none" }}>Mensagem</a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Financeiro expansivel */}
      <div style={{ marginBottom:12 }}>
        <button style={btnStyle(abertos.financeiro)} onClick={()=>toggle("financeiro")}>
          <span>Financeiro</span>
          <span style={{ fontSize:11 }}>{abertos.financeiro ? "▲" : "▼"}</span>
        </button>
        {abertos.financeiro && (
          <div style={{ border:"1px solid #2563eb", borderTop:"none", borderRadius:"0 0 8px 8px",
            background:"#080e1a", padding:"16px" }}>
            {lancsCli.length === 0 ? (
              <p style={{ color:"#475569", fontSize:13, margin:0 }}>Nenhum lancamento para este cliente.</p>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
                {[
                  { label:"Receita Total", v:totalContabil, c:"#3b82f6" },
                  { label:"Recebido",      v:totalRecebido, c:"#10b981" },
                  { label:"A Receber",     v:totalReceber,  c:"#f59e0b" },
                ].map(item => (
                  <div key={item.label} style={{ background:"#0d1526", border:"1px solid #1e293b",
                    borderRadius:8, padding:"12px 14px" }}>
                    <div style={{ color:"#64748b", fontSize:10, fontWeight:600,
                      textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 }}>{item.label}</div>
                    <div style={{ color:item.c, fontWeight:800, fontSize:16 }}>{fmtV(item.v)}</div>
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
  const [view, setView] = useState("list"); // list | form | detail
  const [sel, setSel] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [viewMode, setViewMode] = useState("card"); // card | lista

  const emptyCliente = {
    tipo:"PF", nome:"", cpfCnpj:"", email:"", cep:"", logradouro:"", numero:"",
    complemento:"", bairro:"", cidade:"", estado:"SP",
    contatos:[{ id:uid(), nome:"", telefone:"", cargo:"", whatsapp:false }],
    observacoes:"", ativo:true, desde: new Date().toISOString().slice(0,10),
    servicos:{ projeto:false, acompanhamentoObra:false, gestaoObra:false, empreendimento:false }
  };
  const [form, setForm] = useState(emptyCliente);

  // filtrados calculado dentro do render para garantir reatividade

  function openNew() { setForm(emptyCliente); setView("form"); }
  function openEdit(c) { setForm(c); setView("form"); }
  function openDetail(c) { setSel(c); setView("detail"); }

  function saveCliente(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!form.nome || form.nome.trim() === "") { alert("Informe o nome do cliente."); return; }
    const novos = form.id
      ? data.clientes.map(c => c.id === form.id ? form : c)
      : [...data.clientes, { ...form, id: uid() }];
    save({ ...data, clientes: novos });
    setView("list");
  }

  function removeCliente(id) {
    if (!confirm("Remover cliente? Esta ação não pode ser desfeita.")) return;
    save({ ...data, clientes: data.clientes.filter(c => c.id !== id) });
    setView("list");
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

  // LISTA
  if (view === "list") {
  const filtrados = data.clientes.filter(c => {
    const b = busca.toLowerCase();
    const matchBusca = !b
      || c.nome.toLowerCase().includes(b)
      || (c.cpfCnpj||"").includes(b)
      || (c.logradouro||"").toLowerCase().includes(b)
      || (c.cidade||"").toLowerCase().includes(b)
      || (c.contatos||[]).some(ct => (ct.telefone||"").replace(/\D/g,"").includes(b.replace(/\D/g,"")));
    const matchTipo = filtroTipo === "todos" || c.tipo === filtroTipo;
    return matchBusca && matchTipo;
  });
  return (
    <div style={S.moduleWrap}>
      {/* Toolbar */}
      <div style={S.toolbar}>
        <div style={S.toolbarLeft}>
          <div style={{ ...S.searchWrap, position:"relative" }}>
            <span style={S.searchIcon}>🔍</span>
            <input
              style={{ ...S.searchInput, width:320 }}
              placeholder="Buscar por nome, CPF, endereço ou telefone..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              onBlur={() => setTimeout(() => setBusca(""), 180)}
              autoComplete="off"
            />
            {busca.trim().length >= 1 && (() => {
              const sugestoes = data.clientes.filter(c => {
                const b = busca.toLowerCase();
                return c.nome.toLowerCase().includes(b)
                  || (c.cpfCnpj||"").includes(b)
                  || (c.cidade||"").toLowerCase().includes(b)
                  || (c.contatos||[]).some(ct => (ct.telefone||"").includes(b));
              }).slice(0, 8);
              if (sugestoes.length === 0) return null;
              return (
                <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0,
                  background:"#0f172a", border:"1px solid #334155", borderRadius:10,
                  boxShadow:"0 8px 32px rgba(0,0,0,0.6)", zIndex:999, overflow:"hidden" }}>
                  {sugestoes.map(c => (
                    <div key={c.id}
                      onMouseDown={() => { openDetail(c); setBusca(""); }}
                      style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
                        cursor:"pointer", borderBottom:"1px solid #1e293b" }}
                      onMouseEnter={e => e.currentTarget.style.background="#1e293b"}
                      onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                      <div style={{ width:32, height:32, borderRadius:8, flexShrink:0,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:11, fontWeight:800, color:"#fff",
                        background: c.tipo==="PJ"
                          ? "linear-gradient(135deg,#8b5cf6,#6d28d9)"
                          : "linear-gradient(135deg,#3b82f6,#2563eb)" }}>
                        {c.nome.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase()}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:"#f1f5f9", fontWeight:600, fontSize:13,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {c.nome}
                        </div>
                        <div style={{ color:"#64748b", fontSize:11 }}>
                          {c.cpfCnpj && <span style={{ marginRight:8 }}>{c.cpfCnpj}</span>}
                          {c.cidade && <span>{c.cidade} — {c.estado}</span>}
                        </div>
                      </div>
                      <span style={{ fontSize:10, padding:"2px 7px", borderRadius:4, fontWeight:600,
                        background: c.tipo==="PJ"?"#2e1065":"#1e1b4b",
                        color: c.tipo==="PJ"?"#c4b5fd":"#a5b4fc" }}>{c.tipo}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          <div style={S.filterGroup}>
            {[["todos","Todos"],["PF","Pessoa Física"],["PJ","Pessoa Jurídica"]].map(([k,l]) => (
              <button key={k} className="filter-btn" style={{ ...S.filterBtn, ...(filtroTipo===k?S.filterBtnActive:{}) }} onClick={() => setFiltroTipo(k)}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {/* Toggle card / lista */}
          <div style={{ display:"flex", background:"#0f172a", border:"1px solid #1e293b", borderRadius:7, overflow:"hidden" }}>
            {[["card","⊞ Cards"],["lista","≡ Lista"]].map(([k,l]) => (
              <button key={k} onClick={() => setViewMode(k)}
                style={{ padding:"6px 14px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit", border:"none",
                  background: viewMode===k ? "#1e3a5f" : "transparent",
                  color: viewMode===k ? "#60a5fa" : "#64748b",
                  transition:"all 0.15s" }}>
                {l}
              </button>
            ))}
          </div>
          <button style={S.btnPrimary} onClick={openNew}>+ Novo Cliente</button>
        </div>
      </div>

      {/* Stats rápidas */}
      <div style={S.statsRow}>
        {[
          ["Total", data.clientes.length, "#3b82f6"],
          ["Ativos", data.clientes.filter(c=>c.ativo).length, "#10b981"],
          ["PF", data.clientes.filter(c=>c.tipo==="PF").length, "#f59e0b"],
          ["PJ", data.clientes.filter(c=>c.tipo==="PJ").length, "#8b5cf6"],
        ].map(([l,v,c]) => (
          <div key={l} style={{ ...S.statCard, borderLeft:`3px solid ${c}` }}>
            <span style={{ color:"#64748b", fontSize:11, textTransform:"uppercase", letterSpacing:1 }}>{l}</span>
            <span style={{ color:c, fontWeight:800, fontSize:22 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Cards ou Lista */}
      {viewMode === "card" ? (
        <div style={S.cardGrid}>
          {filtrados.map(c => {
            const obras = data.obras.filter(o => o.clienteId === c.id);
            return (
              <div key={c.id} className="client-card" style={S.clientCard} onClick={() => openDetail(c)}>
                <div style={S.clientCardHeader}>
                  <div style={{ ...S.avatar, background: c.tipo==="PJ" ? "linear-gradient(135deg,#8b5cf6,#6d28d9)" : "linear-gradient(135deg,#3b82f6,#2563eb)" }}>
                    {c.nome.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase()}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={S.clientName}>{c.nome}</div>
                    <div style={S.clientCpf}>{c.cpfCnpj}</div>
                  </div>
                  <span style={{ ...S.tipoBadge, background: c.tipo==="PJ"?"#2e1065":"#1e1b4b", color: c.tipo==="PJ"?"#c4b5fd":"#a5b4fc" }}>{c.tipo}</span>
                </div>
                <div style={S.clientInfo}>
                  {c.email && <div style={S.infoRow}><span style={S.infoIcon}>✉</span><span>{c.email}</span></div>}
                  {c.contatos?.[0]?.telefone && <div style={S.infoRow}><span style={S.infoIcon}>📞</span><span>{c.contatos[0].telefone}</span>{c.contatos[0].whatsapp && <span style={S.waBadge}>WA</span>}</div>}
                  {c.cidade && <div style={S.infoRow}><span style={S.infoIcon}>📍</span><span>{c.cidade} — {c.estado}</span></div>}
                </div>
                {c.servicos && Object.values(c.servicos).some(Boolean) && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>
                    {[["projeto","📐"],["acompanhamentoObra","🏗"],["gestaoObra","⚙️"],["empreendimento","🏢"]]
                      .filter(([k]) => c.servicos[k])
                      .map(([k,icon]) => <span key={k} style={{ background:"#0d1f3c", color:"#60a5fa", fontSize:10, padding:"2px 7px", borderRadius:4, border:"1px solid #1e3a5f" }}>{icon}</span>)}
                  </div>
                )}
                <div style={S.clientFooter}>
                  <span style={S.obrasCount}>🏗 {obras.length} obra{obras.length!==1?"s":""}</span>
                  <span style={{ ...S.statusDot, color: c.ativo?"#4ade80":"#f87171" }}>● {c.ativo?"Ativo":"Inativo"}</span>
                </div>
                <div style={S.clientActions} onClick={e => e.stopPropagation()}>
                  <button className="action-btn" style={S.actionBtn} onClick={() => openEdit(c)}>✏ Editar</button>
                  {c.contatos?.find(ct => ct.whatsapp) && (
                    <a className="action-btn"
                      href={waLink(c.contatos.find(ct=>ct.whatsapp).telefone, `Olá ${c.nome.split(" ")[0]}, tudo bem?`)}
                      target="_blank" rel="noopener noreferrer"
                      style={{ ...S.actionBtn, color:"#25d366", textDecoration:"none" }}>
                      💬 WhatsApp
                    </a>
                  )}
                  <button className="action-btn" style={{ ...S.actionBtn, color:"#f87171" }} onClick={() => removeCliente(c.id)}>✕ Remover</button>
                </div>
              </div>
            );
          })}
        {filtrados.length === 0 && (
          <div style={S.empty}>
            <div style={S.emptyIcon}>👤</div>
            <div style={S.emptyText}>Nenhum cliente encontrado</div>
            <button style={S.btnPrimary} onClick={openNew}>Cadastrar primeiro cliente</button>
          </div>
        )}
        </div>
      ) : (
        /* MODO LISTA */
        <div style={{ display:"flex", flexDirection:"column", gap:0, border:"1px solid #1e293b", borderRadius:10, overflow:"hidden" }}>
          {/* Cabeçalho da tabela */}
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1.2fr 1.2fr 1fr 0.7fr 120px", gap:0,
            background:"#0a1222", borderBottom:"1px solid #1e293b", padding:"8px 16px" }}>
            {["Cliente","CPF/CNPJ","Contato","Cidade","Status","Ações"].map(h => (
              <div key={h} style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5 }}>{h}</div>
            ))}
          </div>
          {/* Linhas */}
          {filtrados.map((c, idx) => {
            const tel = c.contatos?.find(ct => ct.whatsapp)?.telefone || c.contatos?.[0]?.telefone || "";
            return (
              <div key={c.id}
                onClick={() => openDetail(c)}
                style={{ display:"grid", gridTemplateColumns:"2fr 1.2fr 1.2fr 1fr 0.7fr 120px", gap:0,
                  padding:"11px 16px", cursor:"pointer", alignItems:"center",
                  background: idx%2===0 ? "#0d1526" : "#0a1122",
                  borderBottom:"1px solid #0f172a",
                  transition:"background 0.1s" }}
                onMouseEnter={e=>e.currentTarget.style.background="#1e293b"}
                onMouseLeave={e=>e.currentTarget.style.background=idx%2===0?"#0d1526":"#0a1122"}
              >
                {/* Nome + tipo */}
                <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                  <div style={{ width:32, height:32, borderRadius:8, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:12, fontWeight:800, color:"#fff",
                    background: c.tipo==="PJ" ? "linear-gradient(135deg,#8b5cf6,#6d28d9)" : "linear-gradient(135deg,#3b82f6,#2563eb)" }}>
                    {c.nome.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase()}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ color:"#f1f5f9", fontWeight:600, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.nome}</div>
                    <span style={{ fontSize:10, background: c.tipo==="PJ"?"#2e1065":"#1e1b4b", color: c.tipo==="PJ"?"#c4b5fd":"#a5b4fc", padding:"1px 6px", borderRadius:3 }}>{c.tipo}</span>
                  </div>
                </div>
                {/* CPF/CNPJ */}
                <div style={{ color:"#64748b", fontSize:12 }}>{c.cpfCnpj||"—"}</div>
                {/* Contato */}
                <div style={{ fontSize:12 }}>
                  {tel ? (
                    <span style={{ color:"#94a3b8" }}>
                      {tel}
                      {c.contatos?.find(ct=>ct.whatsapp) && <span style={{ color:"#25d366", marginLeft:5, fontSize:10 }}>● WA</span>}
                    </span>
                  ) : <span style={{ color:"#334155" }}>—</span>}
                </div>
                {/* Cidade */}
                <div style={{ color:"#64748b", fontSize:12 }}>{c.cidade ? `${c.cidade} — ${c.estado}` : "—"}</div>
                {/* Status */}
                <div>
                  <span style={{ fontSize:11, fontWeight:600, color: c.ativo?"#4ade80":"#f87171" }}>● {c.ativo?"Ativo":"Inativo"}</span>
                </div>
                {/* Ações */}
                <div style={{ display:"flex", gap:6 }} onClick={e=>e.stopPropagation()}>
                  <button style={{ ...S.btnXsSm, fontSize:11 }} onClick={()=>openEdit(c)}>✏ Editar</button>
                  <button style={{ ...S.btnXsSm, fontSize:11, color:"#f87171" }} onClick={()=>removeCliente(c.id)}>✕</button>
                </div>
              </div>
            );
          })}
          {filtrados.length === 0 && (
            <div style={{ padding:"40px", textAlign:"center", color:"#475569" }}>Nenhum cliente encontrado</div>
          )}
        </div>
      )}
    </div>
  );

  } // fim if view === list

  // DETALHE
  if (view === "detail" && sel) {
    const cliente = data.clientes.find(c => c.id === sel.id) || sel;
    // keep sel in sync
    if (cliente !== sel) setSel(cliente);
    const obras = data.obras.filter(o => o.clienteId === cliente.id);
    return (
      <div style={S.moduleWrap}>
        <div style={S.detailHeader}>
          <button style={S.backBtn} onClick={() => setView("list")}>← Voltar</button>
          <button style={S.btnPrimary} onClick={() => openEdit(cliente)}>✏ Editar</button>
        </div>
        <div style={S.detailWrap}>
          {/* Perfil */}
          <div style={S.detailCard}>
            <div style={S.detailProfile}>
              <div style={{ ...S.avatarLg, background: cliente.tipo==="PJ"?"linear-gradient(135deg,#8b5cf6,#6d28d9)":"linear-gradient(135deg,#3b82f6,#2563eb)" }}>
                {cliente.nome.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase()}
              </div>
              <div>
                <h2 style={{ color:"#f1f5f9", fontWeight:800, fontSize:20, margin:0 }}>{cliente.nome}</h2>
                <p style={{ color:"#64748b", fontSize:13, margin:"4px 0 0" }}>{cliente.cpfCnpj}</p>
                <div style={{ display:"flex", gap:8, marginTop:8 }}>
                  <span style={{ ...S.tipoBadge, background: cliente.tipo==="PJ"?"#2e1065":"#1e1b4b", color: cliente.tipo==="PJ"?"#c4b5fd":"#a5b4fc" }}>{cliente.tipo}</span>
                  <span style={{ ...S.tipoBadge, background: cliente.ativo?"#052e16":"#450a0a", color: cliente.ativo?"#4ade80":"#f87171" }}>● {cliente.ativo?"Ativo":"Inativo"}</span>
                </div>
              </div>
            </div>
          </div>

          <ClienteExpandivel cliente={cliente} data={data} waLink={waLink} S={S} DetailRow={DetailRow} />

          {/* Serviços */}
          <ServicosPanel cliente={cliente} data={data} save={save} />

          {/* Observações */}
          {cliente.observacoes && (
            <div style={S.detailCard}>
              <div style={S.detailCardTitle}>📝 Observações internas</div>
              <p style={{ color:"#94a3b8", fontSize:13, lineHeight:1.6 }}>{cliente.observacoes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // FORMULÁRIO
  return (
    <div style={S.moduleWrap}>
      <div style={S.formHeader}>
        <button style={S.backBtn} onClick={() => setView("list")}>← Voltar</button>
        <h2 style={S.formTitle}>{form.id ? "Editar Cliente" : "Novo Cliente"}</h2>
      </div>
      <div style={S.formWrap}>

        {/* Tipo */}
        <div style={S.formSection}>
          <div style={S.sectionTitle}>Tipo de Pessoa</div>
          <div style={S.radioGroup}>
            {[["PF","Pessoa Física"],["PJ","Pessoa Jurídica"]].map(([v,l]) => (
              <label key={v} style={{ ...S.radioLabel, ...(form.tipo===v?S.radioActive:{}) }}>
                <input type="radio" name="tipo-cliente" value={v} checked={form.tipo===v} onChange={()=>setForm({...form,tipo:v})} style={{ display:"none" }} />
                {l}
              </label>
            ))}
          </div>
        </div>

        {/* Dados principais */}
        <div style={S.formSection}>
          <div style={S.sectionTitle}>Dados Principais</div>
          <div style={S.formGrid2}>
            <FormField label={form.tipo==="PJ"?"Razão Social":"Nome Completo"} value={form.nome} onChange={v=>setForm({...form,nome:v})} required />
            <FormField label={form.tipo==="PJ"?"CNPJ":"CPF"} value={form.cpfCnpj} onChange={v=>setForm({...form,cpfCnpj:v})} required placeholder={form.tipo==="PJ"?"00.000.000/0001-00":"000.000.000-00"} />
          </div>
          <div style={S.formGrid2}>
            <FormField label="E-mail" type="email" value={form.email} onChange={v=>setForm({...form,email:v})} />
            <FormField label="Cliente desde" type="date" value={form.desde} onChange={v=>setForm({...form,desde:v})} />
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:8 }}>
            <label style={{ ...S.radioLabel, ...(form.ativo?S.radioActive:{}) }}>
              <input type="checkbox" checked={form.ativo} onChange={e=>setForm({...form,ativo:e.target.checked})} style={{ display:"none" }} />
              ● Ativo
            </label>
          </div>
        </div>

        {/* Endereço */}
        <div style={S.formSection}>
          <div style={S.sectionTitle}>Endereço</div>
          <div style={S.formGrid3}>
            <div>
              <FormField label="CEP" value={form.cep} onChange={v=>{ setForm({...form,cep:v}); buscarCEP(v); }} placeholder="00000-000" />
              <span style={{ color:"#3b82f6", fontSize:11, cursor:"pointer" }} onClick={()=>buscarCEP(form.cep)}>Buscar CEP →</span>
            </div>
            <FormField label="Logradouro" value={form.logradouro} onChange={v=>setForm({...form,logradouro:v})} />
            <FormField label="Número" value={form.numero} onChange={v=>setForm({...form,numero:v})} />
          </div>
          <div style={S.formGrid3}>
            <FormField label="Complemento" value={form.complemento} onChange={v=>setForm({...form,complemento:v})} />
            <FormField label="Bairro" value={form.bairro} onChange={v=>setForm({...form,bairro:v})} />
            <FormField label="Cidade" value={form.cidade} onChange={v=>setForm({...form,cidade:v})} />
          </div>
          <div style={{ maxWidth:120 }}>
            <label style={S.fieldLabel}>Estado</label>
            <select style={S.select} value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>
              {ESTADOS_BR.map(e=><option key={e}>{e}</option>)}
            </select>
          </div>
        </div>

        {/* Contatos */}
        <div style={S.formSection}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={S.sectionTitle}>Contatos / Telefones</div>
            <button type="button" style={S.btnSecondary} onClick={()=>setForm({...form, contatos:[...form.contatos,{id:uid(),nome:"",telefone:"",cargo:"",whatsapp:false}]})}>
              + Adicionar contato
            </button>
          </div>
          {form.contatos?.map((ct,i) => (
            <div key={ct.id} style={S.contatoFormRow}>
              <div style={S.formGrid3}>
                <FormField label="Nome" value={ct.nome} onChange={v=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,nome:v}:x)})} />
                <FormField label="Telefone" value={ct.telefone} onChange={v=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,telefone:v}:x)})} />
                <FormField label="Cargo" value={ct.cargo} onChange={v=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,cargo:v}:x)})} />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:8 }}>
                <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", color:"#64748b", fontSize:13 }}>
                  <input type="checkbox" checked={ct.whatsapp} onChange={e=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,whatsapp:e.target.checked}:x)})} />
                  <span style={{ color:"#25d366" }}>WhatsApp</span>
                </label>
                {form.contatos.length > 1 && (
                  <button type="button" style={{ ...S.btnSecondary, color:"#f87171", fontSize:12 }} onClick={()=>setForm({...form,contatos:form.contatos.filter((_,j)=>j!==i)})}>
                    Remover
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Observações */}
        <div style={S.formSection}>
          <div style={S.sectionTitle}>Observações Internas</div>
          <textarea style={S.textarea} value={form.observacoes} onChange={e=>setForm({...form,observacoes:e.target.value})} placeholder="Notas internas sobre este cliente (não visíveis para ele)..." rows={3} />
        </div>

        <div style={S.formActions}>
          <button type="button" style={S.btnCancel} onClick={()=>setView("list")}>Cancelar</button>
          <button type="button" style={S.btnPrimary} onClick={saveCliente}>{form.id ? "Salvar alterações" : "✓ Cadastrar cliente"}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SERVIÇOS PANEL — dentro do detalhe do cliente
// ═══════════════════════════════════════════════════════════════
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

  const orcamentos = (data.orcamentosProjeto || []).filter(o => o.clienteId === cliente.id);

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
                    const arqTotal = Math.round((r.precoTotal || r.precoFinal || 0) * 100) / 100;
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

