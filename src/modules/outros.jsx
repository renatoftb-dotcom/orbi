// ═══════════════════════════════════════════════════════════════
// MÓDULO ETAPAS (Kanban de Projetos)
// ═══════════════════════════════════════════════════════════════
// Kanban com 6 colunas fixas:
//   Briefing → Estudo Preliminar → Aprovação Cliente → Prefeitura → Executivo → Engenharia
//
// Colunas de ESPERA (dependem de terceiros): Briefing, Aprovação Cliente, Prefeitura
//   → visual com borda pontilhada + fundo levemente bege
// Colunas de TRABALHO (escritório): Estudo Preliminar, Executivo, Engenharia
//   → visual padrão
//
// Card: cliente · referência · tipo · área · valor · executor · revisor · prazo
// Projeto nasce automaticamente quando orçamento é marcado como "Ganho"
// ═══════════════════════════════════════════════════════════════

const ETAPAS_COLS = [
  { key:"briefing",     label:"Briefing",           wait:true  },
  { key:"preliminar",   label:"Estudo Preliminar",  wait:false },
  { key:"aprov_cliente",label:"Aprovação Cliente",  wait:true  },
  { key:"prefeitura",   label:"Prefeitura",         wait:true  },
  { key:"executivo",    label:"Executivo",          wait:false },
  { key:"engenharia",   label:"Engenharia",         wait:false },
];

const TIPO_TAGS = {
  "Residencial":     { label:"Residencial",     bg:"#eff6ff", color:"#2563eb" },
  "Clínica":         { label:"Clínica",         bg:"#f0fdf4", color:"#16a34a" },
  "Conj. Comercial": { label:"Conj. Comercial", bg:"#fef3c7", color:"#b45309" },
  "Galpão":          { label:"Galpão",          bg:"#f3e8ff", color:"#7c3aed" },
  "Empreendimento":  { label:"Empreendimento",  bg:"#fef3c7", color:"#b45309" },
};

// Funções utilitárias
function fmtDataBR(d) {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day:"2-digit", month:"short" }).replace(".", "");
}
function diasRestantes(dtAlvo) {
  if (!dtAlvo) return null;
  const alvo = new Date(dtAlvo);
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const diff = Math.ceil((alvo - hoje) / (1000*60*60*24));
  return diff;
}
function brlCurto(v) {
  if (v == null || v === 0) return "—";
  if (v >= 1000000) return (v/1000000).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1}) + "M";
  if (v >= 1000) return Math.round(v/1000) + "k";
  return Math.round(v).toString();
}

function Etapas({ data, save }) {
  // IMPORTANTE: hooks DEVEM ser chamados antes de qualquer return condicional
  // (regra do React: ordem dos hooks deve ser constante entre renders)
  const [filtro, setFiltro] = useState("todos"); // "todos" | "meus" | "atrasados"
  const [busca, setBusca] = useState("");

  // Defensive: guard pra quando data ainda não carregou
  if (!data) {
    return (
      <div style={{ padding:"24px 28px" }}>
        <h2 style={{ color:"#111", fontWeight:700, fontSize:22, margin:0, letterSpacing:-0.5 }}>Etapas</h2>
        <div style={{ color:"#9ca3af", fontSize:13, marginTop:4 }}>Carregando…</div>
      </div>
    );
  }

  const projetos = data.projetos || [];
  const clientes = data.clientes || [];

  // Filtra projetos conforme filtro + busca
  const projetosFiltrados = projetos.filter(p => {
    if (filtro === "atrasados") {
      const dias = diasRestantes(p.prazoEtapa);
      if (dias == null || dias >= 0) return false;
    }
    if (busca) {
      const cli = clientes.find(c => c.id === p.clienteId);
      const nomeCli = cli?.nome || "";
      const ref = p.referencia || "";
      const q = busca.toLowerCase();
      if (!nomeCli.toLowerCase().includes(q) && !ref.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const qtdAtrasados = projetos.filter(p => {
    const d = diasRestantes(p.prazoEtapa);
    return d != null && d < 0;
  }).length;

  function projetosDaColuna(colKey) {
    return projetosFiltrados.filter(p => (p.colunaEtapa || "briefing") === colKey);
  }

  return (
    <div style={{ padding:"24px 28px", display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom:16 }}>
        <h2 style={{ color:"#111", fontWeight:700, fontSize:22, margin:0, letterSpacing:-0.5 }}>Etapas</h2>
        <div style={{ color:"#9ca3af", fontSize:13, marginTop:4 }}>Acompanhamento dos projetos em andamento</div>
      </div>

      {/* Toolbar: filtros + busca */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16, flexWrap:"wrap" }}>
        <FilterPill label="Todos" count={projetos.length} active={filtro==="todos"} onClick={()=>setFiltro("todos")} />
        <FilterPill label="Atrasados" count={qtdAtrasados} active={filtro==="atrasados"} onClick={()=>setFiltro("atrasados")} countColor="#dc2626" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar cliente ou referência…"
          style={{
            flex:1, maxWidth:240, padding:"6px 12px",
            border:"1px solid #e5e7eb", borderRadius:6,
            fontSize:12.5, color:"#111", background:"#fff",
            fontFamily:"inherit", outline:"none",
          }}
        />
      </div>

      {/* Kanban */}
      <div style={{ flex:1, display:"flex", gap:12, overflowX:"auto", overflowY:"hidden", paddingBottom:8 }}>
        {ETAPAS_COLS.map(col => {
          const cards = projetosDaColuna(col.key);
          return (
            <KanbanColumn key={col.key} col={col} cards={cards} clientes={clientes} />
          );
        })}
      </div>

      {/* Estado vazio global */}
      {projetos.length === 0 && (
        <div style={{
          position:"absolute", top:"50%", left:"50%", transform:"translate(-50%, -50%)",
          textAlign:"center", color:"#9ca3af", fontSize:13, pointerEvents:"none",
        }}>
          <div style={{ fontSize:14, color:"#6b7280", marginBottom:4 }}>Nenhum projeto em andamento</div>
          <div>Projetos são criados automaticamente quando um orçamento é marcado como <strong>Ganho</strong>.</div>
        </div>
      )}
    </div>
  );
}

// ─── Filter pill (botão de filtro) ──────────────────────────
function FilterPill({ label, count, active, onClick, countColor }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize:12, color: active ? "#111" : "#6b7280",
        border:"1px solid " + (active ? "#111" : "#e5e7eb"),
        borderRadius:20, padding:"5px 12px",
        background: active ? "#f9fafb" : "#fff",
        cursor:"pointer", fontFamily:"inherit",
        display:"flex", alignItems:"center", gap:5,
      }}>
      {label}
      {count != null && count > 0 && (
        <strong style={{ marginLeft:4, color: countColor || "#111" }}>{count}</strong>
      )}
    </button>
  );
}

// ─── Coluna do Kanban ──────────────────────────────────────
function KanbanColumn({ col, cards, clientes }) {
  const wait = col.wait;
  return (
    <div style={{
      flex:"0 0 280px", display:"flex", flexDirection:"column",
      background: wait ? "#fbfaf6" : "#fafafa",
      border: wait ? "1px dashed #e5e7eb" : "1px solid #f0f0f0",
      borderRadius:10, maxHeight:"100%",
    }}>
      <div style={{
        padding:"14px 14px 10px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        borderBottom: wait ? "1px dashed #e5e7eb" : "1px solid #f3f4f6",
      }}>
        <span style={{
          fontSize:11, fontWeight:600, color:"#374151",
          textTransform:"uppercase", letterSpacing:0.8,
        }}>{col.label}</span>
        <span style={{
          background: wait ? "#f3efe0" : "#f3f4f6",
          color: wait ? "#a88a3f" : "#9ca3af",
          fontSize:10, fontWeight:600, padding:"2px 7px", borderRadius:10,
          minWidth:20, textAlign:"center",
        }}>{cards.length}</span>
      </div>
      <div style={{ flex:1, padding:10, display:"flex", flexDirection:"column", gap:8, overflowY:"auto" }}>
        {cards.length === 0 ? (
          <div style={{ fontSize:11, color:"#d1d5db", textAlign:"center", padding:"20px 0", fontStyle:"italic" }}>
            Nenhum projeto
          </div>
        ) : cards.map(card => (
          <ProjetoCard key={card.id} projeto={card} clientes={clientes} col={col} />
        ))}
      </div>
    </div>
  );
}

// ─── Card de projeto ───────────────────────────────────────
function ProjetoCard({ projeto, clientes, col }) {
  const cliente = clientes.find(c => c.id === projeto.clienteId);
  const nomeCli = cliente?.nome || projeto.clienteNome || "—";
  const ref = projeto.referencia || "";
  const tipo = projeto.tipo || "Residencial";
  const tag = TIPO_TAGS[tipo] || TIPO_TAGS["Residencial"];
  const area = projeto.area || 0;
  const valor = projeto.valor || 0;

  const dias = diasRestantes(projeto.prazoEtapa);
  const atrasado = dias != null && dias < 0;

  return (
    <div style={{
      background:"#fff",
      border: atrasado ? "1px solid #fecaca" : "1px solid #e5e7eb",
      borderRadius:8, padding:12,
      cursor:"pointer", transition:"all 0.15s",
      display:"flex", flexDirection:"column", gap:8,
      ...(atrasado ? { background:"#fffbfb" } : {}),
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = atrasado ? "#fca5a5" : "#d1d5db"; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = atrasado ? "#fecaca" : "#e5e7eb"; }}>
      {/* Tag de tipo */}
      <span style={{
        display:"inline-flex", alignItems:"center",
        fontSize:9.5, fontWeight:600, textTransform:"uppercase", letterSpacing:0.6,
        padding:"2px 7px", borderRadius:4,
        width:"fit-content",
        background: tag.bg, color: tag.color,
      }}>{tag.label}</span>

      {/* Nome cliente */}
      <div style={{ fontSize:13.5, fontWeight:600, color:"#111", lineHeight:1.3 }}>{nomeCli}</div>
      {ref && (
        <div style={{ fontSize:11.5, color:"#9ca3af", lineHeight:1.3 }}>{ref}</div>
      )}

      {/* Meta: área + valor */}
      {(area > 0 || valor > 0) && (
        <div style={{ display:"flex", gap:10, fontSize:11, color:"#6b7280", marginTop:2 }}>
          {area > 0 && <span><strong style={{ color:"#111", fontWeight:600 }}>{area}</strong> m²</span>}
          {valor > 0 && <span>R$ <strong style={{ color:"#111", fontWeight:600 }}>{brlCurto(valor)}</strong></span>}
        </div>
      )}

      {/* Footer: responsável(is) + prazo */}
      <CardFooter projeto={projeto} col={col} dias={dias} atrasado={atrasado} />
    </div>
  );
}

// ─── Footer do card (responsável + prazo) ──────────────────
function CardFooter({ projeto, col, dias, atrasado }) {
  if (col.wait) {
    // Colunas de espera: motivo do bloqueio + responsável do escritório
    const motivo = projeto.motivoBloqueio || motivoPadrao(col.key);
    return (
      <div style={{ paddingTop:8, borderTop:"1px solid #f3f4f6", marginTop:2, display:"flex", flexDirection:"column", gap:4 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
          <div style={{
            fontSize:11.5, fontWeight:600, lineHeight:1.3,
            color: atrasado ? "#991b1b" : "#92400e",
          }}>{motivo}</div>
          <span style={{
            fontSize:11, whiteSpace:"nowrap",
            color: atrasado ? "#dc2626" : (dias != null && dias <= 3 ? "#d97706" : "#6b7280"),
            fontWeight: (atrasado || (dias != null && dias <= 3)) ? 600 : 400,
          }}>
            {dias == null ? "" : atrasado ? `atrasado ${Math.abs(dias)} dias` : dias === 0 ? "vence hoje" : `faltam ${dias} dias`}
          </span>
        </div>
        {projeto.responsavelAcompanha && (
          <div style={{ fontSize:11.5, color:"#374151", lineHeight:1.3 }}>
            <strong style={{ fontWeight:600, color:"#111" }}>{projeto.responsavelAcompanha}</strong>
            <span style={{ color:"#9ca3af", fontWeight:400 }}> — Acompanhamento</span>
          </div>
        )}
      </div>
    );
  }

  // Colunas de trabalho: executor + revisor
  const executor = projeto.executor || "—";
  const revisor = projeto.revisor || "—";
  const mesmapessoa = executor === revisor;
  const estado = projeto.estadoTrabalho || "execucao"; // "execucao" | "revisao" | "ajustes"

  return (
    <div style={{ paddingTop:8, borderTop:"1px solid #f3f4f6", marginTop:2 }}>
      {mesmapessoa ? (
        // Executor = Revisor → linha única
        <PessoaRow
          icon={estado === "revisao" ? "🔍" : "✏️"}
          nome={executor}
          funcao={estado === "revisao" ? "Revisão" : "Execução"}
          prazo={projeto.prazoEtapa}
          ativa
          dias={dias}
          atrasado={atrasado}
        />
      ) : (<>
        {/* Executor */}
        <PessoaRow
          icon={estado === "execucao" ? "✏️" : estado === "ajustes" ? "⚠️" : "✓"}
          nome={executor}
          funcao={estado === "ajustes" ? "Ajustes" : "Execução"}
          prazo={projeto.prazoExecutor}
          ativa={estado === "execucao" || estado === "ajustes"}
          concluida={estado === "revisao"}
          rejeitada={estado === "ajustes"}
          dias={diasRestantes(projeto.prazoExecutor)}
        />
        {/* Revisor */}
        <PessoaRow
          icon={estado === "revisao" ? "🔍" : "·"}
          nome={revisor}
          funcao={estado === "ajustes" ? "Aguardando correção" : "Revisão"}
          prazo={estado !== "ajustes" ? projeto.prazoRevisor : null}
          ativa={estado === "revisao"}
          inativa={estado !== "revisao"}
          topBorder
          dias={diasRestantes(projeto.prazoRevisor)}
        />
      </>)}
    </div>
  );
}

// ─── Linha de pessoa (executor ou revisor) ─────────────────
function PessoaRow({ icon, nome, funcao, prazo, ativa, concluida, inativa, rejeitada, topBorder, dias }) {
  let corNome = "#111", corFuncao = "#6b7280", corPrazo = "#6b7280", fontWeightPrazo = 400;
  if (concluida || inativa) { corNome = "#6b7280"; corFuncao = "#9ca3af"; corPrazo = "#9ca3af"; }
  if (rejeitada) { corNome = "#92400e"; corFuncao = "#b45309"; corPrazo = "#b45309"; fontWeightPrazo = 600; }
  if (ativa && dias != null) {
    if (dias < 0) { corPrazo = "#dc2626"; fontWeightPrazo = 600; }
    else if (dias <= 3) { corPrazo = "#d97706"; fontWeightPrazo = 600; }
  }

  const prazoTxt = (() => {
    if (!prazo) return "";
    if (dias == null) return "prazo " + fmtDataBR(prazo);
    if (dias < 0) return `atrasado ${Math.abs(dias)} dias`;
    if (dias === 0) return "vence hoje";
    if (dias <= 5) return `faltam ${dias} dias`;
    return "prazo " + fmtDataBR(prazo);
  })();

  return (
    <div style={{
      display:"flex", flexDirection:"column", gap:1,
      ...(topBorder ? { marginTop:6, paddingTop:6, borderTop:"1px dashed #f3f4f6" } : {}),
    }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
        <span style={{ fontSize:11.5, lineHeight:1.3, color: corNome }}>
          <span style={{ display:"inline-block", width:14, fontSize:10, textAlign:"center", marginRight:4 }}>{icon}</span>
          <strong style={{ fontWeight:600 }}>{nome}</strong>
          <span style={{ color: corFuncao, fontWeight:400 }}> — {funcao}</span>
        </span>
        {prazoTxt && (
          <span style={{ fontSize:10.5, whiteSpace:"nowrap", color: corPrazo, fontWeight: fontWeightPrazo }}>
            {prazoTxt}
          </span>
        )}
      </div>
    </div>
  );
}

function motivoPadrao(colKey) {
  switch (colKey) {
    case "briefing":      return "Aguardando cliente preencher";
    case "aprov_cliente": return "Aguardando aprovação do cliente";
    case "prefeitura":    return "Aguardando análise da prefeitura";
    default: return "Aguardando";
  }
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO OBRAS (stub — será desenvolvido em fase posterior)
// ═══════════════════════════════════════════════════════════════
function Obras({ data, save }) {
  return (
    <div style={{ padding:"24px 28px" }}>
      <h2 style={{ color:"#111", fontWeight:700, fontSize:22, margin:0, letterSpacing:-0.5 }}>Obras</h2>
      <div style={{ color:"#9ca3af", fontSize:13, marginTop:4 }}>Gestão de obras em execução</div>
      <div style={{
        marginTop:32, padding:"48px 24px", textAlign:"center",
        border:"1px dashed #e5e7eb", borderRadius:10, background:"#fafafa",
      }}>
        <div style={{ color:"#6b7280", fontSize:14, marginBottom:6, fontWeight:600 }}>Módulo em desenvolvimento</div>
        <div style={{ color:"#9ca3af", fontSize:12.5, maxWidth:420, margin:"0 auto" }}>
          Este módulo será ativado em breve. Projetos que concluírem a etapa <strong style={{ color:"#374151" }}>Engenharia</strong> aparecerão aqui automaticamente.
        </div>
      </div>
    </div>
  );
}



// ═══════════════════════════════════════════════════════════════
// MÓDULO FINANCEIRO
// ═══════════════════════════════════════════════════════════════
function Financeiro({ data, save }) {
  const receitas = data.receitasFinanceiro || [];
  const [busca, setBusca]           = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todas");
  const [editDesc, setEditDesc]     = useState(null);
  const [selecionados, setSelecionados] = useState(new Set());
  const [filtroCol, setFiltroCol]   = useState(null);
  const [filtroVals, setFiltroVals] = useState({});

  function exportarCSV() {
    const cols = [
      "Codigo","Cod. Cliente","Nome Cliente","Categoria","Produto","Fornecedor",
      "Descricao","Tipo Conta","Conta Contabil 1","Sub Conta 1","Sub Conta 2",
      "Sub Conta 3","Sub Conta 4","Sub Conta 5",
      "Comprovante","Competencia","Recebimento","Valor",
      "Data Lancamento","Periodo Contabil","Periodo Caixa"
    ];
    const rows = receitas.map(r => [
      r.codigo||"", r.clienteId||"", r.cliente||"", r.categoria||"", r.produto||"", r.fornecedor||"",
      r.descricao||"", r.tipoConta||"", r.contabil1||"", r.subContabil1||"", r.subContabil2||"",
      r.subContabil3||"", r.subContabil4||"", r.subContabil5||"",
      r.nComprovante||"", r.competencia||"", r.recebimento||"", r.valor||0,
      r.dataLancamento||"", r.periodoContabil||"", r.periodoCaixa||""
    ]);
    const esc = v => { const s = String(v).replace(/"/g,'""'); return s.includes(";")||s.includes("\n")||s.includes('"') ? '"'+s+'"' : s; };
    const csv = [cols,...rows].map(row => row.map(esc).join(";")).join("\n");
    const url = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csv);
    const a = document.createElement("a"); a.href=url; a.download="financeiro.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function excluirSelecionados() {
    const novos = receitas.filter((_r, i) => !selecionados.has(i));
    save({...data, receitasFinanceiro: novos});
    setSelecionados(new Set());
  }

  function salvarDesc(idx, novaDesc) {
    const novos = receitas.map((r,i) => i===idx ? {...r, descricao:novaDesc} : r);
    save({...data, receitasFinanceiro: novos});
    setEditDesc(null);
  }

  function valoresUnicos(campo) {
    return [...new Set(receitas.map(r => r[campo]||"").filter(Boolean))].sort();
  }

  function toggleFiltroVal(campo, val) {
    setFiltroVals(prev => {
      const set = new Set(prev[campo] || []);
      if (set.has(val)) set.delete(val); else set.add(val);
      return { ...prev, [campo]: set };
    });
  }

  const fmtV = v => (v||0).toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
  const fmtD = iso => iso ? new Date(iso+"T00:00:00").toLocaleDateString("pt-BR") : "--";

  const totalContabil = receitas.filter(r=>r.contabil1==="Receita Total").reduce((s,r)=>s+(r.valor||0),0);
  const totalCaixa    = receitas.filter(r=>r.contabil1==="Caixa" && r.recebimento==="Recebido").reduce((s,r)=>s+(r.valor||0),0);
  const totalReceber  = receitas.filter(r=>r.contabil1==="Caixa" && r.recebimento==="A Receber").reduce((s,r)=>s+(r.valor||0),0);
  const temFiltroAtivo = Object.values(filtroVals).some(s => s && s.size > 0);

  const lancs = receitas.filter(r => {
    if (filtroTipo==="contabil" && r.contabil1!=="Receita Total") return false;
    if (filtroTipo==="caixa"    && r.contabil1!=="Caixa") return false;
    for (const [campo, set] of Object.entries(filtroVals)) {
      if (set && set.size > 0 && !set.has(r[campo]||"")) return false;
    }
    if (busca) {
      const b = busca.toLowerCase();
      return (r.cliente||"").toLowerCase().includes(b) ||
             (r.descricao||"").toLowerCase().includes(b) ||
             (r.codigo||"").toLowerCase().includes(b);
    }
    return true;
  });

  const thS = { padding:"6px 8px", fontSize:10, fontWeight:600, textTransform:"uppercase",
    letterSpacing:0.4, whiteSpace:"nowrap", color:"#64748b",
    background:"#0a1122", borderBottom:"1px solid #1e293b", textAlign:"left" };
  const tdS = { padding:"6px 8px", fontSize:11, whiteSpace:"nowrap",
    borderBottom:"1px solid #0f172a", color:"#94a3b8" };

  // Colunas filtaveis: [label, campo]
  const COLS_FILTER = [
    ["Categoria","categoria"],["Produto","produto"],["Fornecedor","fornecedor"],
    ["Tipo Conta","tipoConta"],["Conta Contabil 1","contabil1"],
    ["Sub Conta 1","subContabil1"],["Sub Conta 2","subContabil2"],
    ["Competencia","competencia"],["Recebimento","recebimento"],
  ];

  return (
    <div style={{ padding:"24px 20px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div>
          <h2 style={{ color:"#f1f5f9", fontWeight:900, fontSize:22, margin:0 }}>Financeiro</h2>
          <p style={{ color:"#64748b", fontSize:13, marginTop:4 }}>Livro de lancamentos</p>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:20 }}>
        {[
          { label:"Receita Contabil",  v:totalContabil, c:"#3b82f6", sub: receitas.filter(r=>r.contabil1==="Receita Total").length + " lancamentos" },
          { label:"Caixa Recebido",    v:totalCaixa,    c:"#10b981", sub: receitas.filter(r=>r.recebimento==="Recebido").length + " lancamentos" },
          { label:"A Receber",         v:totalReceber,  c:"#f59e0b", sub: receitas.filter(r=>r.recebimento==="A Receber").length + " lancamentos" },
        ].map(c => (
          <div key={c.label} style={{ background:"#0d1526", border:"1px solid #1e293b", borderRadius:10, padding:"16px 20px" }}>
            <div style={{ color:"#64748b", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 }}>{c.label}</div>
            <div style={{ color:c.c, fontWeight:800, fontSize:20 }}>R$ {fmtV(c.v)}</div>
            <div style={{ color:"#334155", fontSize:11, marginTop:4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display:"flex", gap:10, marginBottom:12, alignItems:"center", flexWrap:"wrap" }}>
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar cliente, codigo, descricao..."
          style={{ background:"#0a1122", border:"1px solid #1e293b", borderRadius:6, color:"#f1f5f9",
            padding:"6px 12px", fontSize:12, outline:"none", fontFamily:"inherit", width:260 }} />
        {[["todas","Todos"],["contabil","Contabil"],["caixa","Caixa"]].map(([v,l]) => (
          <button key={v} onClick={()=>setFiltroTipo(v)}
            style={{ background:filtroTipo===v?"#1e3a5f":"transparent",
              color:filtroTipo===v?"#60a5fa":"#64748b",
              border:"1px solid "+(filtroTipo===v?"#2563eb":"#1e293b"),
              borderRadius:6, padding:"5px 14px", fontSize:11, fontWeight:600,
              cursor:"pointer", fontFamily:"inherit" }}>{l}</button>
        ))}
        <span style={{ color:"#334155", fontSize:11, marginLeft:"auto" }}>{lancs.length} registro{lancs.length!==1?"s":""}</span>
        <button onClick={exportarCSV} disabled={receitas.length===0}
          style={{ background:"#164e2a", border:"1px solid #16a34a", borderRadius:6,
            color:"#4ade80", padding:"5px 14px", fontSize:11, fontWeight:600,
            cursor:receitas.length===0?"not-allowed":"pointer", fontFamily:"inherit", opacity:receitas.length===0?0.4:1 }}>
          Exportar CSV
        </button>
        {selecionados.size > 0 && (
          <button onClick={excluirSelecionados}
            style={{ background:"rgba(248,113,113,0.15)", border:"1px solid #f87171", borderRadius:6,
              color:"#f87171", padding:"5px 14px", fontSize:11, fontWeight:600,
              cursor:"pointer", fontFamily:"inherit" }}>
            Excluir {selecionados.size} selecionado{selecionados.size!==1?"s":""}
          </button>
        )}
        {temFiltroAtivo && (
          <button onClick={()=>setFiltroVals({})}
            style={{ background:"rgba(99,102,241,0.12)", border:"1px solid #6366f1",
              borderRadius:6, color:"#818cf8", padding:"5px 14px", fontSize:11,
              fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            Limpar filtros
          </button>
        )}
      </div>

      {/* Dropdown filtro por coluna */}
      {filtroCol && (
        <div style={{ background:"#0f172a", border:"1px solid #334155", borderRadius:10,
          padding:"14px 16px", maxWidth:280, marginBottom:10, boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ color:"#e2e8f0", fontSize:12, fontWeight:700 }}>Filtrar: {filtroCol.label}</span>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setFiltroVals(prev=>{const n={...prev};delete n[filtroCol.campo];return n;})}
                style={{ background:"transparent", border:"none", color:"#64748b", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                Limpar
              </button>
              <button onClick={()=>setFiltroCol(null)}
                style={{ background:"transparent", border:"none", color:"#64748b", fontSize:16, cursor:"pointer", lineHeight:1 }}>
                x
              </button>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:180, overflowY:"auto" }}>
            {valoresUnicos(filtroCol.campo).map(val => {
              const ativo = filtroVals[filtroCol.campo]?.has(val);
              return (
                <label key={val} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer",
                  padding:"4px 6px", borderRadius:5, background:ativo?"rgba(59,130,246,0.12)":"transparent" }}>
                  <input type="checkbox" checked={!!ativo}
                    onChange={()=>toggleFiltroVal(filtroCol.campo, val)}
                    style={{ accentColor:"#3b82f6", cursor:"pointer" }} />
                  <span style={{ color:ativo?"#60a5fa":"#94a3b8", fontSize:12 }}>{val}</span>
                </label>
              );
            })}
            {valoresUnicos(filtroCol.campo).length===0 && (
              <span style={{ color:"#334155", fontSize:11 }}>Sem valores</span>
            )}
          </div>
        </div>
      )}

      {/* Tabela */}
      {lancs.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 0", color:"#334155" }}>
          <div style={{ fontSize:13 }}>Nenhum lancamento. Confirme orcamentos como Ganho para gerar receitas.</div>
        </div>
      ) : (
        <div style={{ overflowX:"auto", borderRadius:10, border:"1px solid #1e293b" }}>
          <table style={{ borderCollapse:"collapse", width:"100%", minWidth:2000 }}>
            <thead>
              <tr>
                {[
                  ["",1,"#0a1122","#475569"],
                  ["Identificacao",3,"#0a1122","#475569"],
                  ["Partes",4,"#0a1122","#475569"],
                  ["Descricao",1,"#0a1122","#475569"],
                  ["Plano de Contas",8,"#0d1a2e","#60a5fa"],
                  ["Comprovante",2,"#0a1122","#475569"],
                  ["Financeiro",5,"#0a1122","#475569"],
                ].map(([lbl,span,bg,cor])=>(
                  <th key={lbl||"chk"} colSpan={span}
                    style={{...thS,background:bg,color:cor,textAlign:"center",borderRight:"1px solid #1e293b"}}>
                    {lbl}
                  </th>
                ))}
              </tr>
              <tr>
                {/* Checkbox todos */}
                <th style={{...thS, width:36, textAlign:"center"}}>
                  <input type="checkbox"
                    checked={lancs.length>0 && lancs.every(r=>selecionados.has(receitas.indexOf(r)))}
                    onChange={e=>setSelecionados(e.target.checked?new Set(lancs.map(r=>receitas.indexOf(r))):new Set())}
                    style={{ cursor:"pointer", accentColor:"#3b82f6" }} />
                </th>
                {/* Identificacao */}
                {["Cod. Lanc.","Cod. Cliente","Data Lanc."].map(h=>(
                  <th key={h} style={thS}>{h}</th>
                ))}
                {/* Partes -- com filtro */}
                {[["Nome do Cliente","cliente"],["Categoria","categoria"],["Produto","produto"],["Fornecedor","fornecedor"]].map(([h,campo])=>{
                  const ativo = filtroVals[campo]?.size > 0;
                  return (
                    <th key={h} onClick={()=>setFiltroCol(filtroCol?.campo===campo?null:{campo,label:h})}
                      style={{...thS,borderLeft:"1px solid #1e293b",cursor:"pointer",userSelect:"none",
                        color:ativo?"#60a5fa":"#64748b",background:ativo?"#0d1a2e":undefined}}>
                      {h}{ativo?" [F]":""}
                    </th>
                  );
                })}
                {/* Descricao */}
                <th style={{...thS,borderLeft:"1px solid #1e293b"}}>Descricao do Lancamento</th>
                {/* Plano de contas -- com filtro */}
                {[["Tipo Conta","tipoConta"],["Conta Contabil 1","contabil1"],["Sub Conta 1","subContabil1"],
                  ["Sub Conta 2","subContabil2"],["Sub Conta 3",""],["Sub Conta 4",""],["Sub Conta 5",""],
                  ["Competencia","competencia"]].map(([h,campo])=>{
                  const ativo = campo && filtroVals[campo]?.size > 0;
                  return (
                    <th key={h} onClick={campo?()=>setFiltroCol(filtroCol?.campo===campo?null:{campo,label:h}):undefined}
                      style={{...thS,borderLeft:"1px solid #1e293b",background:ativo?"#131f3a":"#0d1a2e",
                        color:ativo?"#60a5fa":"#475569",cursor:campo?"pointer":"default",userSelect:"none"}}>
                      {h}{ativo?" [F]":""}
                    </th>
                  );
                })}
                {/* Comprovante */}
                {["No Comprovante","No Nota"].map(h=>(
                  <th key={h} style={{...thS,borderLeft:"1px solid #1e293b"}}>{h}</th>
                ))}
                {/* Financeiro -- com filtro em Recebimento */}
                {[["Recebimento","recebimento"],["Valor (R$)",""],["Data Lancamento",""],["Periodo Contabil",""],["Periodo Caixa",""]].map(([h,campo])=>{
                  const ativo = campo && filtroVals[campo]?.size > 0;
                  return (
                    <th key={h} onClick={campo?()=>setFiltroCol(filtroCol?.campo===campo?null:{campo,label:h}):undefined}
                      style={{...thS,borderLeft:"1px solid #1e293b",
                        color:ativo?"#60a5fa":"#64748b",cursor:campo?"pointer":"default",userSelect:"none"}}>
                      {h}{ativo?" [F]":""}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {lancs.map((r, idx) => {
                const realIdx = receitas.indexOf(r);
                const isEdit  = editDesc?.idx === realIdx;
                const isCaixa = r.contabil1 === "Caixa";
                const isReceb = r.recebimento === "Recebido";
                const isAReceber = r.recebimento === "A Receber";
                const rowBg = selecionados.has(realIdx) ? "rgba(59,130,246,0.1)"
                  : isCaixa ? (idx%2===0?"#060d1a":"#080e1a")
                  : (idx%2===0?"#0a1122":"#0c1420");
                return (
                  <tr key={r.id||idx} style={{ background:rowBg }}>
                    <td style={{...tdS,width:36,textAlign:"center"}}>
                      <input type="checkbox" checked={selecionados.has(realIdx)}
                        onChange={e=>setSelecionados(prev=>{const n=new Set(prev);if(e.target.checked)n.add(realIdx);else n.delete(realIdx);return n;})}
                        style={{ cursor:"pointer", accentColor:"#3b82f6" }} />
                    </td>
                    <td style={{...tdS,fontFamily:"monospace",fontSize:10,color:"#475569"}}>{r.codigo||"--"}</td>
                    <td style={{...tdS,fontFamily:"monospace",fontSize:10,color:"#475569"}}>{r.clienteId||"--"}</td>
                    <td style={{...tdS}}>{fmtD(r.dataLancamento)}</td>
                    {/* Partes */}
                    <td style={{...tdS,borderLeft:"1px solid #1e293b",color:"#e2e8f0",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis"}}>{r.cliente||"--"}</td>
                    <td style={{...tdS}}>{r.categoria||"--"}</td>
                    <td style={{...tdS}}>{r.produto||"--"}</td>
                    <td style={{...tdS,maxWidth:130,overflow:"hidden",textOverflow:"ellipsis"}}>{r.fornecedor||"--"}</td>
                    {/* Descricao */}
                    <td style={{...tdS,borderLeft:"1px solid #1e293b",maxWidth:200}}>
                      {isEdit ? (
                        <input autoFocus defaultValue={r.descricao}
                          onBlur={e=>salvarDesc(realIdx,e.target.value)}
                          onKeyDown={e=>{if(e.key==="Enter")salvarDesc(realIdx,e.target.value);if(e.key==="Escape")setEditDesc(null);}}
                          style={{background:"#0a1122",border:"1px solid #2563eb",borderRadius:4,color:"#f1f5f9",
                            padding:"3px 6px",fontSize:11,outline:"none",fontFamily:"inherit",width:"100%"}} />
                      ):(
                        <span onClick={()=>setEditDesc({idx:realIdx})}
                          style={{color:"#94a3b8",cursor:"pointer",display:"block",maxWidth:200,
                            overflow:"hidden",textOverflow:"ellipsis",borderBottom:"1px dashed #1e293b"}}>
                          {r.descricao||"--"}
                        </span>
                      )}
                    </td>
                    {/* Plano de Contas */}
                    <td style={{...tdS,borderLeft:"1px solid #1e293b",background:"#0d1a2e",
                      color:r.tipoConta==="Conta Redutora"?"#f87171":"#10b981",fontWeight:600,fontSize:10}}>
                      {r.tipoConta||"--"}
                    </td>
                    <td style={{...tdS,background:"#0d1a2e",color:isCaixa?"#f59e0b":"#3b82f6",fontWeight:600}}>{r.contabil1||"--"}</td>
                    <td style={{...tdS,background:"#0d1a2e",color:"#64748b"}}>{r.subContabil1||"--"}</td>
                    <td style={{...tdS,background:"#0d1a2e",color:"#64748b"}}>{r.subContabil2||"--"}</td>
                    <td style={{...tdS,background:"#0d1a2e",color:"#334155"}}>{r.subContabil3||"--"}</td>
                    <td style={{...tdS,background:"#0d1a2e",color:"#334155"}}>{r.subContabil4||"--"}</td>
                    <td style={{...tdS,background:"#0d1a2e",color:"#334155"}}>{r.subContabil5||"--"}</td>
                    <td style={{...tdS,background:"#0d1a2e",
                      color:r.competencia==="Contabil"?"#a78bfa":isReceb?"#10b981":"#f59e0b"}}>
                      {r.competencia||"--"}
                    </td>
                    {/* Comprovante */}
                    <td style={{...tdS,borderLeft:"1px solid #1e293b",fontFamily:"monospace",fontSize:10}}>{r.nComprovante||"--"}</td>
                    <td style={{...tdS,fontFamily:"monospace",fontSize:10}}>{r.nNota||"--"}</td>
                    {/* Financeiro */}
                    <td style={{...tdS,borderLeft:"1px solid #1e293b",
                      color:isReceb?"#10b981":isAReceber?"#f59e0b":r.recebimento==="Conta contabil"?"#a78bfa":"#94a3b8"}}>
                      {r.recebimento||"--"}
                    </td>
                    <td style={{...tdS,fontWeight:700,textAlign:"right",color:"#10b981"}}>
                      R$ {fmtV(r.valor||0)}
                    </td>
                    <td style={{...tdS}}>{fmtD(r.dataLancamento)}</td>
                    <td style={{...tdS,color:r.periodoContabil?"#e2e8f0":"#334155"}}>{fmtD(r.periodoContabil)}</td>
                    <td style={{...tdS,color:r.periodoCaixa?"#10b981":"#334155"}}>{r.periodoCaixa?fmtD(r.periodoCaixa):"--"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Fornecedores({ data, save }) {
  const [view, setView] = useState("list");
  const [sel, setSel] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtroRating, setFiltroRating] = useState(0);

  const emptyForn = {
    nome:"", cnpj:"", email:"", telefone:"", categorias:[],
    prazoEntrega:"", condicoesPagamento:"", rating:3,
    contatos:[{id:uid(), nome:"", telefone:"", cargo:"", whatsapp:false}],
    observacoes:"", ativo:true, historicoPrecosIds:[]
  };
  const [form, setForm] = useState(emptyForn);

  const filtrados = data.fornecedores.filter(f => {
    const matchBusca = f.nome.toLowerCase().includes(busca.toLowerCase());
    const matchRating = filtroRating === 0 || f.rating >= filtroRating;
    return matchBusca && matchRating;
  });

  function openNew() { setForm(emptyForn); setView("form"); }
  function openEdit(f) { setForm(f); setView("form"); }
  function openDetail(f) { setSel(f); setView("detail"); }

  function saveForn(e) {
    e.preventDefault();
    const novos = form.id
      ? data.fornecedores.map(f => f.id === form.id ? form : f)
      : [...data.fornecedores, { ...form, id: uid() }];
    save({ ...data, fornecedores: novos });
    setView("list");
  }

  function toggleCat(cat) {
    const cats = form.categorias || [];
    setForm({ ...form, categorias: cats.includes(cat) ? cats.filter(c=>c!==cat) : [...cats, cat] });
  }

  // LISTA
  if (view === "list") return (
    <div style={S.moduleWrap}>
      <div style={S.toolbar}>
        <div style={S.toolbarLeft}>
          <div style={S.searchWrap}>
            <span style={S.searchIcon}>🔍</span>
            <input style={S.searchInput} placeholder="Buscar fornecedor..." value={busca} onChange={e=>setBusca(e.target.value)} />
          </div>
          <div style={S.filterGroup}>
            <span style={{ color:"#64748b", fontSize:12 }}>Rating mín:</span>
            {[0,3,4,5].map(r => (
              <button key={r} className="filter-btn" style={{ ...S.filterBtn, ...(filtroRating===r?S.filterBtnActive:{}) }} onClick={()=>setFiltroRating(r)}>
                {r===0?"Todos":"★".repeat(r)}
              </button>
            ))}
          </div>
        </div>
        <button style={S.btnPrimary} onClick={openNew}>+ Novo Fornecedor</button>
      </div>

      <div style={S.statsRow}>
        {[
          ["Total", data.fornecedores.length, "#3b82f6"],
          ["Ativos", data.fornecedores.filter(f=>f.ativo).length, "#10b981"],
          ["5 estrelas", data.fornecedores.filter(f=>f.rating===5).length, "#f59e0b"],
          ["Categorias", [...new Set(data.fornecedores.flatMap(f=>f.categorias||[]))].length, "#8b5cf6"],
        ].map(([l,v,c]) => (
          <div key={l} style={{ ...S.statCard, borderLeft:`3px solid ${c}` }}>
            <span style={{ color:"#64748b", fontSize:11, textTransform:"uppercase", letterSpacing:1 }}>{l}</span>
            <span style={{ color:c, fontWeight:800, fontSize:22 }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={S.cardGrid}>
        {filtrados.map(f => {
          const compras = data.lancamentos.filter(l => l.fornecedorId === f.id);
          const totalComprado = compras.reduce((s,l)=>s+l.total,0);
          return (
            <div key={f.id} className="client-card" style={S.clientCard} onClick={() => openDetail(f)}>
              <div style={S.clientCardHeader}>
                <div style={{ ...S.avatar, background:"linear-gradient(135deg,#f59e0b,#d97706)" }}>
                  {f.nome.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase()}
                </div>
                <div style={{ flex:1 }}>
                  <div style={S.clientName}>{f.nome}</div>
                  <div style={S.clientCpf}>{f.cnpj}</div>
                </div>
                <div style={{ display:"flex", gap:2 }}>
                  {[1,2,3,4,5].map(s => <span key={s} style={{ fontSize:12, color: s<=f.rating?"#f59e0b":"#1e293b" }}>★</span>)}
                </div>
              </div>

              <div style={{ display:"flex", flexWrap:"wrap", gap:4, margin:"10px 0" }}>
                {(f.categorias||[]).map(c => <span key={c} style={S.catTag}>{c}</span>)}
              </div>

              <div style={S.clientInfo}>
                {f.prazoEntrega && <div style={S.infoRow}><span style={S.infoIcon}>🚚</span><span>Prazo: {f.prazoEntrega} dias</span></div>}
                {f.condicoesPagamento && <div style={S.infoRow}><span style={S.infoIcon}>💳</span><span>{f.condicoesPagamento}</span></div>}
                {totalComprado > 0 && <div style={S.infoRow}><span style={S.infoIcon}>📊</span><span>{compras.length} compras · {totalComprado.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span></div>}
              </div>

              <div style={S.clientFooter}>
                <span style={{ ...S.statusDot, color: f.ativo?"#4ade80":"#f87171" }}>● {f.ativo?"Ativo":"Inativo"}</span>
              </div>
              <div style={S.clientActions} onClick={e=>e.stopPropagation()}>
                <button className="action-btn" style={S.actionBtn} onClick={()=>openEdit(f)}>✏ Editar</button>
              </div>
            </div>
          );
        })}
        {filtrados.length === 0 && (
          <div style={S.empty}>
            <div style={S.emptyIcon}>🏭</div>
            <div style={S.emptyText}>Nenhum fornecedor encontrado</div>
            <button style={S.btnPrimary} onClick={openNew}>Cadastrar primeiro fornecedor</button>
          </div>
        )}
      </div>
    </div>
  );

  // DETALHE FORNECEDOR
  if (view === "detail" && sel) {
    const forn = data.fornecedores.find(f=>f.id===sel.id) || sel;
    const compras = data.lancamentos.filter(l=>l.fornecedorId===forn.id);
    const totalComprado = compras.reduce((s,l)=>s+l.total,0);

    // Histórico de preços por material
    const historicoPrecos = {};
    compras.forEach(l => {
      const mat = data.materiais.find(m=>m.id===l.materialId);
      if (!mat) return;
      if (!historicoPrecos[mat.nome]) historicoPrecos[mat.nome] = [];
      historicoPrecos[mat.nome].push({ data:l.data, preco:l.valorUnit, total:l.total, qtd:l.quantidade, unidade:mat.unidade });
    });

    return (
      <div style={S.moduleWrap}>
        <div style={S.detailHeader}>
          <button style={S.backBtn} onClick={()=>setView("list")}>← Voltar</button>
          <button style={S.btnPrimary} onClick={()=>openEdit(forn)}>✏ Editar</button>
        </div>
        <div style={S.detailWrap}>
          <div style={S.detailCard}>
            <div style={S.detailProfile}>
              <div style={{ ...S.avatarLg, background:"linear-gradient(135deg,#f59e0b,#d97706)" }}>
                {forn.nome.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <h2 style={{ color:"#f1f5f9", fontWeight:800, fontSize:20, margin:0 }}>{forn.nome}</h2>
                <p style={{ color:"#64748b", fontSize:13, margin:"4px 0 8px" }}>{forn.cnpj}</p>
                <div style={{ display:"flex", gap:4 }}>
                  {[1,2,3,4,5].map(s=><span key={s} style={{ fontSize:18, color:s<=forn.rating?"#f59e0b":"#1e293b" }}>★</span>)}
                  <span style={{ color:"#64748b", fontSize:13, marginLeft:6 }}>{forn.rating}/5</span>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ color:"#64748b", fontSize:11 }}>Total comprado</div>
                <div style={{ color:"#f59e0b", fontWeight:800, fontSize:20 }}>{totalComprado.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</div>
                <div style={{ color:"#64748b", fontSize:12 }}>{compras.length} compras</div>
              </div>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:16 }}>
              {(forn.categorias||[]).map(c=><span key={c} style={S.catTag}>{c}</span>)}
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <div style={S.detailCard}>
              <div style={S.detailCardTitle}>📋 Informações Comerciais</div>
              <div style={S.detailFields}>
                <DetailRow label="E-mail" value={forn.email} />
                <DetailRow label="Telefone" value={forn.telefone} />
                <DetailRow label="Prazo de Entrega" value={forn.prazoEntrega ? `${forn.prazoEntrega} dias úteis` : "—"} />
                <DetailRow label="Condições de Pagamento" value={forn.condicoesPagamento || "—"} />
              </div>
            </div>
            <div style={S.detailCard}>
              <div style={S.detailCardTitle}>📞 Contatos</div>
              {forn.contatos?.map(ct=>(
                <div key={ct.id} style={S.contatoRow}>
                  <div style={{ fontWeight:600, color:"#e2e8f0", fontSize:13 }}>{ct.nome} <span style={{ color:"#64748b", fontWeight:400 }}>({ct.cargo})</span></div>
                  <div style={{ color:"#94a3b8", fontSize:12, marginTop:2 }}>
                    {ct.telefone} {ct.whatsapp && <span style={S.waBadge}>WhatsApp</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Histórico de preços */}
          {Object.keys(historicoPrecos).length > 0 && (
            <div style={S.detailCard}>
              <div style={S.detailCardTitle}>📈 Histórico de Preços por Material</div>
              {Object.entries(historicoPrecos).map(([matNome, hist]) => (
                <div key={matNome} style={{ marginBottom:20 }}>
                  <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:13, marginBottom:8 }}>{matNome}</div>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr>{["Data","Qtd","Preço Unit.","Total"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {hist.sort((a,b)=>new Date(b.data)-new Date(a.data)).map((h,i)=>(
                        <tr key={i} style={{ borderBottom:"1px solid #0f172a" }}>
                          <td style={S.td}>{new Date(h.data).toLocaleDateString("pt-BR")}</td>
                          <td style={S.td}>{h.qtd} {h.unidade}</td>
                          <td style={{ ...S.td, color:"#10b981", fontWeight:600 }}>{h.preco.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td>
                          <td style={{ ...S.td, color:"#f59e0b" }}>{h.total.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {forn.observacoes && (
            <div style={S.detailCard}>
              <div style={S.detailCardTitle}>📝 Observações</div>
              <p style={{ color:"#94a3b8", fontSize:13, lineHeight:1.6 }}>{forn.observacoes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // FORMULÁRIO FORNECEDOR
  return (
    <div style={S.moduleWrap}>
      <div style={S.formHeader}>
        <button style={S.backBtn} onClick={()=>setView("list")}>← Voltar</button>
        <h2 style={S.formTitle}>{form.id?"Editar Fornecedor":"Novo Fornecedor"}</h2>
      </div>
      <form onSubmit={saveForn} style={S.formWrap}>
        <div style={S.formSection}>
          <div style={S.sectionTitle}>Dados da Empresa</div>
          <div style={S.formGrid2}>
            <FormField label="Razão Social / Nome" value={form.nome} onChange={v=>setForm({...form,nome:v})} required />
            <FormField label="CNPJ" value={form.cnpj} onChange={v=>setForm({...form,cnpj:v})} placeholder="00.000.000/0001-00" />
          </div>
          <div style={S.formGrid2}>
            <FormField label="E-mail" type="email" value={form.email} onChange={v=>setForm({...form,email:v})} />
            <FormField label="Telefone principal" value={form.telefone} onChange={v=>setForm({...form,telefone:v})} />
          </div>
        </div>

        <div style={S.formSection}>
          <div style={S.sectionTitle}>Categorias de Produtos</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:8 }}>
            {CATS_FORNECEDOR.map(cat=>(
              <button type="button" key={cat} onClick={()=>toggleCat(cat)}
                style={{ ...S.catToggle, ...(form.categorias?.includes(cat)?S.catToggleActive:{}) }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div style={S.formSection}>
          <div style={S.sectionTitle}>Condições Comerciais</div>
          <div style={S.formGrid2}>
            <FormField label="Prazo médio de entrega (dias)" type="number" value={form.prazoEntrega} onChange={v=>setForm({...form,prazoEntrega:v})} />
            <FormField label="Condições de pagamento" value={form.condicoesPagamento} onChange={v=>setForm({...form,condicoesPagamento:v})} placeholder="Ex: 30/60/90 dias, À vista -5%..." />
          </div>
          <div style={{ marginTop:12 }}>
            <label style={S.fieldLabel}>Avaliação geral</label>
            <div style={{ display:"flex", gap:8, marginTop:6 }}>
              {[1,2,3,4,5].map(s=>(
                <button type="button" key={s} onClick={()=>setForm({...form,rating:s})}
                  style={{ fontSize:24, background:"none", border:"none", cursor:"pointer", color:s<=form.rating?"#f59e0b":"#1e293b", transition:"color 0.15s" }}>
                  ★
                </button>
              ))}
              <span style={{ color:"#64748b", fontSize:13, alignSelf:"center" }}>{form.rating}/5</span>
            </div>
          </div>
        </div>

        <div style={S.formSection}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={S.sectionTitle}>Contatos</div>
            <button type="button" style={S.btnSecondary} onClick={()=>setForm({...form,contatos:[...form.contatos,{id:uid(),nome:"",telefone:"",cargo:"",whatsapp:false}]})}>
              + Adicionar contato
            </button>
          </div>
          {form.contatos?.map((ct,i)=>(
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

        <div style={S.formSection}>
          <div style={S.sectionTitle}>Observações Internas</div>
          <textarea style={S.textarea} value={form.observacoes} onChange={e=>setForm({...form,observacoes:e.target.value})} placeholder="Condições especiais, notas de negociação, alertas..." rows={3} />
        </div>

        <div style={S.formActions}>
          <button type="button" style={S.btnCancel} onClick={()=>setView("list")}>Cancelar</button>
          <button type="submit" style={S.btnPrimary}>{form.id?"Salvar alterações":"Cadastrar fornecedor"}</button>
        </div>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// IMPORTAR NOTA FISCAL (PDF → IA → Extração)
// ═══════════════════════════════════════════════════════════════
function ImportarNF({ data, save }) {
  const [stage, setStage] = useState("upload"); // upload | processing | review | done
  const [pdfBase64, setPdfBase64] = useState(null);
  const [pdfName, setPdfName] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [editResult, setEditResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const dropRef = useRef();

  function handleFile(file) {
    if (!file || file.type !== "application/pdf") { setError("Por favor envie um arquivo PDF."); return; }
    setError(null);
    setPdfName(file.name);
    const reader = new FileReader();
    reader.onload = e => { setPdfBase64(e.target.result.split(",")[1]); setStage("ready"); };
    reader.readAsDataURL(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  }

  async function processarNF() {
    setStage("processing");
    setError(null);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: pdfBase64 }
              },
              {
                type: "text",
                text: `Você é um extrator de dados de Notas Fiscais brasileiras. Analise esta NF-e e extraia TODOS os dados em formato JSON puro, sem texto extra, sem markdown.

Retorne EXATAMENTE este formato:
{
  "numero": "número da NF",
  "serie": "série",
  "dataEmissao": "YYYY-MM-DD",
  "chaveAcesso": "chave de acesso 44 dígitos se disponível",
  "emitente": {
    "razaoSocial": "nome",
    "cnpj": "CNPJ formatado",
    "endereco": "endereço completo",
    "cidade": "cidade",
    "estado": "UF"
  },
  "destinatario": {
    "razaoSocial": "nome",
    "cpfCnpj": "CPF ou CNPJ",
    "endereco": "endereço"
  },
  "itens": [
    {
      "descricao": "descrição do produto",
      "ncm": "código NCM se disponível",
      "unidade": "unidade (sc, un, m, kg, m², etc.)",
      "quantidade": 0.00,
      "valorUnitario": 0.00,
      "valorTotal": 0.00
    }
  ],
  "totais": {
    "produtos": 0.00,
    "frete": 0.00,
    "desconto": 0.00,
    "impostos": 0.00,
    "totalNF": 0.00
  },
  "transportadora": "nome se disponível",
  "formaPagamento": "forma de pagamento",
  "observacoes": "observações da NF"
}`
              }
            ]
          }]
        })
      });

      const resData = await response.json();
      if (resData.error) throw new Error(resData.error.message);

      const texto = resData.content.map(b => b.text || "").join("");
      const cleanJson = texto.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      setResult(parsed);
      setEditResult(parsed);
      setStage("review");
    } catch (e) {
      setError(`Erro ao processar NF: ${e.message}`);
      setStage("ready");
    }
  }

  async function confirmarImportacao() {
    setSaving(true);
    const r = editResult;

    // Tenta encontrar ou criar fornecedor
    let fornecedorId = data.fornecedores.find(f =>
      f.cnpj?.replace(/\D/g,"") === r.emitente?.cnpj?.replace(/\D/g,"")
    )?.id;

    let novosFornecedores = [...data.fornecedores];
    if (!fornecedorId && r.emitente?.razaoSocial) {
      fornecedorId = uid();
      novosFornecedores.push({
        id: fornecedorId,
        nome: r.emitente.razaoSocial,
        cnpj: r.emitente.cnpj || "",
        email: "", telefone: "", categorias: [],
        prazoEntrega: "", condicoesPagamento: "", rating: 3,
        contatos: [], observacoes: "Criado automaticamente via importação de NF.", ativo: true,
        historicoPrecosIds: []
      });
    }

    // Cria lançamentos para cada item
    const novosLancamentos = [...data.lancamentos];
    const novosMateriais = [...data.materiais];

    for (const item of (r.itens || [])) {
      // Busca material existente
      let matId = data.materiais.find(m =>
        m.nome.toLowerCase().includes(item.descricao?.toLowerCase().slice(0,10))
      )?.id;

      if (!matId) {
        matId = uid();
        novosMateriais.push({
          id: matId,
          nome: item.descricao,
          unidade: item.unidade || "un",
          categoria: "Outros",
          ultimoPreco: item.valorUnitario,
          fornecedorId: fornecedorId || ""
        });
      } else {
        // Atualiza último preço
        const idx = novosMateriais.findIndex(m=>m.id===matId);
        if (idx>=0) novosMateriais[idx] = { ...novosMateriais[idx], ultimoPreco: item.valorUnitario };
      }

      novosLancamentos.push({
        id: uid(),
        obraId: "",
        materialId: matId,
        fornecedorId: fornecedorId || "",
        quantidade: item.quantidade,
        valorUnit: item.valorUnitario,
        total: item.valorTotal,
        data: r.dataEmissao || new Date().toISOString().slice(0,10),
        etapa: "",
        nf: `NF-${r.numero || "000"}`,
        pago: false,
        pendente_vincular_obra: true
      });
    }

    save({ ...data, fornecedores: novosFornecedores, lancamentos: novosLancamentos, materiais: novosMateriais });
    setSaving(false);
    setStage("done");
  }

  if (stage === "done") return (
    <div style={S.moduleWrap}>
      <div style={S.successBox}>
        <div style={S.successIcon}>✅</div>
        <h2 style={{ color:"#f1f5f9", fontWeight:800, fontSize:22 }}>NF importada com sucesso!</h2>
        <p style={{ color:"#64748b", fontSize:14, maxWidth:400, textAlign:"center", lineHeight:1.6 }}>
          Os materiais e lançamentos foram cadastrados. Vá em <strong style={{ color:"#f59e0b" }}>Lançamentos</strong> para vincular cada item a uma obra.
        </p>
        <button style={S.btnPrimary} onClick={()=>{ setStage("upload"); setPdfBase64(null); setResult(null); }}>
          Importar outra NF
        </button>
      </div>
    </div>
  );

  return (
    <div style={S.moduleWrap}>
      <div style={S.nfHeader}>
        <h2 style={{ color:"#f1f5f9", fontWeight:800, fontSize:18, margin:0 }}>Importar Nota Fiscal (PDF)</h2>
        <p style={{ color:"#64748b", fontSize:13, margin:"6px 0 0" }}>
          Faça upload de uma NF-e em PDF. A IA vai extrair automaticamente todos os dados: emitente, itens, preços, quantidades e totais.
        </p>
      </div>

      {/* UPLOAD */}
      {(stage === "upload" || stage === "ready") && (
        <div
          ref={dropRef}
          style={{ ...S.dropZone, ...(pdfBase64 ? S.dropZoneDone : {}) }}
          onDragOver={e=>e.preventDefault()}
          onDrop={handleDrop}
          onClick={()=>{ if(!pdfBase64) document.getElementById("nf-file-input").click(); }}
        >
          <input id="nf-file-input" type="file" accept=".pdf" style={{ display:"none" }} onChange={e=>handleFile(e.target.files[0])} />
          {pdfBase64 ? (
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:40, marginBottom:8 }}>📄</div>
              <div style={{ color:"#f1f5f9", fontWeight:700 }}>{pdfName}</div>
              <div style={{ color:"#4ade80", fontSize:13, marginTop:4 }}>PDF carregado ✓</div>
              <button style={{ ...S.btnSecondary, marginTop:12 }} onClick={e=>{ e.stopPropagation(); setPdfBase64(null); setPdfName(""); setStage("upload"); }}>
                Trocar arquivo
              </button>
            </div>
          ) : (
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📁</div>
              <div style={{ color:"#94a3b8", fontSize:15, fontWeight:600 }}>Arraste o PDF aqui</div>
              <div style={{ color:"#475569", fontSize:13, marginTop:6 }}>ou clique para selecionar</div>
              <div style={{ color:"#334155", fontSize:12, marginTop:10 }}>Aceita NF-e em formato PDF</div>
            </div>
          )}
        </div>
      )}

      {error && <div style={S.errorBox}>{error}</div>}

      {stage === "ready" && pdfBase64 && (
        <div style={{ textAlign:"center", marginTop:8 }}>
          <button style={{ ...S.btnPrimary, fontSize:15, padding:"12px 32px" }} onClick={processarNF}>
            🤖 Processar com IA
          </button>
        </div>
      )}

      {/* PROCESSING */}
      {stage === "processing" && (
        <div style={S.processingBox}>
          <div style={S.processingAnim}>
            <Spinner size={40} />
          </div>
          <h3 style={{ color:"#f1f5f9", fontWeight:700, margin:"16px 0 8px" }}>Analisando Nota Fiscal...</h3>
          <p style={{ color:"#64748b", fontSize:13 }}>A IA está lendo o PDF e extraindo todos os dados. Isso leva alguns segundos.</p>
          <div style={S.processingSteps}>
            {["Lendo o PDF", "Identificando emitente e destinatário", "Extraindo itens e preços", "Calculando totais"].map((s,i)=>(
              <div key={i} style={S.processingStep}>
                <span style={{ color:"#3b82f6", fontSize:14 }}>◎</span>
                <span style={{ color:"#94a3b8", fontSize:13 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REVISÃO */}
      {stage === "review" && editResult && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={S.reviewHeader}>
            <div style={S.reviewBadge}>✓ NF extraída com sucesso</div>
            <p style={{ color:"#94a3b8", fontSize:13, margin:"8px 0 0" }}>Revise os dados abaixo antes de importar. Você pode editar qualquer campo.</p>
          </div>

          {/* Emitente */}
          <div style={S.detailCard}>
            <div style={S.detailCardTitle}>🏭 Emitente (Fornecedor)</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12 }}>
              <div>
                <label style={S.fieldLabel}>Razão Social</label>
                <input style={S.inputSm} value={editResult.emitente?.razaoSocial||""} onChange={e=>setEditResult({...editResult,emitente:{...editResult.emitente,razaoSocial:e.target.value}})} />
              </div>
              <div>
                <label style={S.fieldLabel}>CNPJ</label>
                <input style={S.inputSm} value={editResult.emitente?.cnpj||""} onChange={e=>setEditResult({...editResult,emitente:{...editResult.emitente,cnpj:e.target.value}})} />
              </div>
            </div>
            {data.fornecedores.find(f=>f.cnpj?.replace(/\D/g,"")===editResult.emitente?.cnpj?.replace(/\D/g,"")) ? (
              <div style={S.matchFound}>✓ Fornecedor já cadastrado — será vinculado automaticamente</div>
            ) : (
              <div style={S.matchNew}>+ Novo fornecedor será criado automaticamente</div>
            )}
          </div>

          {/* NF Info */}
          <div style={S.detailCard}>
            <div style={S.detailCardTitle}>📋 Dados da NF</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginTop:12 }}>
              <div><label style={S.fieldLabel}>Número</label><input style={S.inputSm} value={editResult.numero||""} onChange={e=>setEditResult({...editResult,numero:e.target.value})} /></div>
              <div><label style={S.fieldLabel}>Data Emissão</label><input style={S.inputSm} type="date" value={editResult.dataEmissao||""} onChange={e=>setEditResult({...editResult,dataEmissao:e.target.value})} /></div>
              <div><label style={S.fieldLabel}>Forma Pagamento</label><input style={S.inputSm} value={editResult.formaPagamento||""} onChange={e=>setEditResult({...editResult,formaPagamento:e.target.value})} /></div>
            </div>
          </div>

          {/* Itens */}
          <div style={S.detailCard}>
            <div style={S.detailCardTitle}>📦 Itens da Nota ({editResult.itens?.length || 0})</div>
            <table style={{ width:"100%", borderCollapse:"collapse", marginTop:12 }}>
              <thead>
                <tr>{["Descrição","Unidade","Quantidade","Valor Unit.","Total"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {(editResult.itens||[]).map((item,i) => (
                  <tr key={i} style={{ borderBottom:"1px solid #0f172a" }}>
                    <td style={S.td}>
                      <input style={{ ...S.inputSm, width:"100%" }} value={item.descricao||""} onChange={e=>setEditResult({...editResult,itens:editResult.itens.map((x,j)=>j===i?{...x,descricao:e.target.value}:x)})} />
                    </td>
                    <td style={S.td}>
                      <input style={{ ...S.inputSm, width:60 }} value={item.unidade||""} onChange={e=>setEditResult({...editResult,itens:editResult.itens.map((x,j)=>j===i?{...x,unidade:e.target.value}:x)})} />
                    </td>
                    <td style={S.td}>
                      <input style={{ ...S.inputSm, width:80 }} type="number" value={item.quantidade||""} onChange={e=>setEditResult({...editResult,itens:editResult.itens.map((x,j)=>j===i?{...x,quantidade:parseFloat(e.target.value),valorTotal:parseFloat(e.target.value)*x.valorUnitario}:x)})} />
                    </td>
                    <td style={S.td}>
                      <input style={{ ...S.inputSm, width:100 }} type="number" step="0.01" value={item.valorUnitario||""} onChange={e=>setEditResult({...editResult,itens:editResult.itens.map((x,j)=>j===i?{...x,valorUnitario:parseFloat(e.target.value),valorTotal:parseFloat(e.target.value)*x.quantidade}:x)})} />
                    </td>
                    <td style={{ ...S.td, color:"#f59e0b", fontWeight:700 }}>
                      {(item.valorTotal||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totais */}
          <div style={S.detailCard}>
            <div style={S.detailCardTitle}>💰 Totais</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginTop:12 }}>
              {[["Produtos","produtos"],["Frete","frete"],["Desconto","desconto"],["Total NF","totalNF"]].map(([l,k])=>(
                <div key={k}>
                  <label style={S.fieldLabel}>{l}</label>
                  <input style={{ ...S.inputSm, color: k==="totalNF"?"#f59e0b":"#f1f5f9", fontWeight:k==="totalNF"?700:400 }}
                    type="number" step="0.01" value={editResult.totais?.[k]||""}
                    onChange={e=>setEditResult({...editResult,totais:{...editResult.totais,[k]:parseFloat(e.target.value)}})} />
                </div>
              ))}
            </div>
          </div>

          <div style={S.formActions}>
            <button style={S.btnCancel} onClick={()=>{ setStage("ready"); setResult(null); }}>← Voltar</button>
            <button style={S.btnPrimary} onClick={confirmarImportacao} disabled={saving}>
              {saving ? "Importando..." : "✓ Confirmar e Importar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTES AUXILIARES
// ═══════════════════════════════════════════════════════════════
function FormField({ label, value, onChange, type="text", placeholder="", required=false, step }) {
  return (
    <div>
      <label style={S.fieldLabel}>{label}{required && <span style={{ color:"#ef4444" }}> *</span>}</label>
      <input style={S.input} type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} required={required} step={step} />
    </div>
  );
}
function DetailRow({ label, value }) {
  return (
    <div style={{ display:"flex", gap:8, padding:"6px 0", borderBottom:"1px solid #0f172a" }}>
      <span style={{ color:"#64748b", fontSize:12, minWidth:140 }}>{label}</span>
      <span style={{ color:"#e2e8f0", fontSize:13 }}>{value || "—"}</span>
    </div>
  );
}
function Spinner({ size=24 }) {
  return <div style={{ width:size, height:size, border:`${size/8}px solid #1e293b`, borderTop:`${size/8}px solid #3b82f6`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />;
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
var CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; background:#07101f; overflow-x:hidden; scroll-behavior:auto !important; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  .tab-btn:hover { background:#1e293b !important; color:#e2e8f0 !important; }
  .client-card:hover { border-color:#3b82f6 !important; transform:translateY(-2px); box-shadow:0 8px 32px rgba(59,130,246,0.12); }
  .client-card { transition: all 0.2s ease; }
  .filter-btn:hover { background:#1e293b !important; }
  .action-btn:hover { background:#1e3a5f !important; color:#60a5fa !important; }
`;

var S = {
  app: { fontFamily:"'Sora',system-ui,sans-serif", background:"#07101f", minHeight:"100vh", color:"#f1f5f9", display:"flex", flexDirection:"column" },
  center: { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", background:"#07101f" },
  topbar: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 28px", background:"#0d1526", borderBottom:"1px solid #1e293b" },
  topbarLeft: { display:"flex", alignItems:"center", gap:10 },
  logoMark: { fontSize:20 },
  logoText: { color:"#f1f5f9", fontWeight:800, fontSize:16 },
  logoDivider: { color:"#334155", fontSize:16 },
  logoSub: { color:"#64748b", fontSize:14 },
  topbarRight: { display:"flex", alignItems:"center", gap:6 },
  onlineDot: { color:"#4ade80", fontSize:10 },
  tabBar: { display:"flex", gap:0, background:"#0d1526", borderBottom:"1px solid #1e293b", padding:"0 20px" },
  tabBtn: { background:"transparent", border:"none", color:"#64748b", padding:"14px 20px", fontSize:13, fontWeight:600, cursor:"pointer", borderBottom:"2px solid transparent", display:"flex", alignItems:"center", gap:8, transition:"all 0.15s" },
  tabBtnActive: { color:"#60a5fa", borderBottom:"2px solid #3b82f6" },
  tabCount: { background:"#1e293b", color:"#94a3b8", borderRadius:12, padding:"2px 8px", fontSize:11 },
  content: { padding:"24px 28px", animation:"fadeIn 0.3s ease", flex:1 },
  moduleWrap: { display:"flex", flexDirection:"column", gap:20 },
  toolbar: { display:"flex", justifyContent:"space-between", alignItems:"center", gap:16, flexWrap:"wrap" },
  toolbarLeft: { display:"flex", alignItems:"center", gap:12, flex:1 },
  searchWrap: { position:"relative", display:"flex", alignItems:"center" },
  searchIcon: { position:"absolute", left:12, fontSize:13, pointerEvents:"none" },
  searchInput: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:8, color:"#f1f5f9", padding:"9px 12px 9px 34px", fontSize:13, outline:"none", width:280, fontFamily:"inherit" },
  filterGroup: { display:"flex", alignItems:"center", gap:6 },
  filterBtn: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:6, color:"#64748b", padding:"6px 12px", fontSize:12, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s" },
  filterBtnActive: { background:"#1e3a5f", color:"#60a5fa", borderColor:"#3b82f6" },
  statsRow: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 },
  statCard: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:10, padding:"14px 16px", display:"flex", flexDirection:"column", gap:6 },
  cardGrid: { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:16 },
  clientCard: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:12, padding:18, cursor:"pointer", position:"relative" },
  clientCardHeader: { display:"flex", alignItems:"center", gap:12, marginBottom:12 },
  avatar: { width:44, height:44, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:15, flexShrink:0, fontFamily:"'Sora',sans-serif" },
  avatarLg: { width:60, height:60, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:20, flexShrink:0 },
  clientName: { color:"#f1f5f9", fontWeight:700, fontSize:14 },
  clientCpf: { color:"#475569", fontSize:12, marginTop:2, fontFamily:"'JetBrains Mono',monospace" },
  tipoBadge: { fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:6, letterSpacing:0.5 },
  clientInfo: { display:"flex", flexDirection:"column", gap:5, marginBottom:12 },
  infoRow: { display:"flex", alignItems:"center", gap:6, color:"#64748b", fontSize:12 },
  infoIcon: { fontSize:11, width:16 },
  waBadge: { background:"#052e16", color:"#25d366", fontSize:10, padding:"1px 6px", borderRadius:4, fontWeight:700, marginLeft:4 },
  waBtnSm: { background:"#052e16", color:"#25d366", border:"1px solid #14532d", borderRadius:6, padding:"4px 10px", fontSize:11, cursor:"pointer", fontFamily:"inherit", fontWeight:600, whiteSpace:"nowrap" },
  // Orçamento styles
    emptyState: { display:"flex", flexDirection:"column", alignItems:"center", padding:"80px 20px", textAlign:"center" },
    kpi: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:10, padding:"16px 18px" },
    orcCard: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:12, padding:18, cursor:"pointer" },
    orcStat: { background:"#0f172a", borderRadius:8, padding:"8px 10px" },
    badge: { fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:12, alignSelf:"flex-start" },
    steps: { display:"flex", alignItems:"center", gap:12 },
    stepDot: { width:28, height:28, borderRadius:"50%", background:"#1e293b", color:"#64748b", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700 },
    stepDotActive: { background:"linear-gradient(135deg,#3b82f6,#2563eb)", color:"#fff" },
    stepLine: { width:40, height:2, background:"#1e293b" },
    radioGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 },
    radioCard: { display:"flex", alignItems:"center", gap:10, background:"#0f172a", border:"1px solid #1e293b", borderRadius:10, padding:"10px 14px", cursor:"pointer", userSelect:"none", transition:"all 0.15s" },
    radioCardActive: { background:"#1e3a5f", borderColor:"#3b82f6" },
    comodoRow: { display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid #0a1222" },
    qtdControl: { display:"flex", alignItems:"center", gap:6 },
    qtdBtn: { width:28, height:28, background:"#1e293b", border:"none", borderRadius:6, color:"#94a3b8", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit" },
    qtdNum: { width:28, textAlign:"center", fontWeight:700, fontSize:15, fontFamily:"'JetBrains Mono',monospace" },
    previewCol: { width:360, flexShrink:0, position:"sticky", top:20, alignSelf:"flex-start" },
    previewCard: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:14, padding:20 },
    previewTitle: { color:"#94a3b8", fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:14 },
    previewSection: { borderBottom:"1px solid #0f172a", paddingBottom:12, marginBottom:12 },
    previewLabel: { color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 },
    previewRow: { display:"flex", justifyContent:"space-between", fontSize:12, color:"#64748b", marginBottom:5 },
    formula: { background:"#0f172a", borderRadius:8, padding:"8px 12px", color:"#94a3b8", fontSize:11, fontFamily:"'JetBrains Mono',monospace", lineHeight:1.6 },
    previewTotal: { background:"linear-gradient(135deg,#1c1500,#0d1526)", border:"1px solid #f59e0b40", borderRadius:10, padding:16, textAlign:"center" },
    resultHeader: { background:"linear-gradient(135deg,#0d1f3c,#0d1526)", border:"1px solid #1e3a5f", borderRadius:14, padding:24 },
    btnXs: { background:"#1e293b", color:"#94a3b8", border:"none", borderRadius:6, padding:"4px 10px", fontSize:12, cursor:"pointer", fontFamily:"inherit" },
    btnWA: { background:"#052e16", color:"#25d366", border:"1px solid #14532d", borderRadius:8, padding:"9px 16px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" },
  servicoMenuItem: { display:"flex", alignItems:"center", gap:12, background:"#0f172a", border:"2px solid #1e293b", borderRadius:10, padding:"14px 16px", cursor:"pointer", fontFamily:"inherit", width:"100%", transition:"all 0.15s" },
  btnSubacao2: { background:"#1e3a5f", color:"#60a5fa", border:"1px solid #1d4ed8", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" },
  btnSubacaoGreen: { background:"#052e16", color:"#4ade80", border:"1px solid #14532d", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" },
  btnServico: { background:"#1e3a5f", color:"#60a5fa", border:"none", borderRadius:8, padding:"7px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" },
  btnSubacao: { display:"flex", alignItems:"center", gap:14, background:"#0f172a", border:"2px solid #1e293b", borderRadius:12, padding:"14px 16px", cursor:"pointer", fontFamily:"inherit", width:"100%", transition:"border-color 0.15s" },
  btnXsSm: { background:"#1e293b", color:"#94a3b8", border:"none", borderRadius:6, padding:"4px 10px", fontSize:11, cursor:"pointer", fontFamily:"inherit" },
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 },
  modalBox: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:16, padding:28, width:"100%", maxHeight:"90vh", overflowY:"auto" },
  modalHead: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 },
  closeBtn: { background:"#1e293b", border:"none", color:"#94a3b8", cursor:"pointer", borderRadius:6, width:28, height:28, fontSize:14, fontFamily:"inherit" },
  btnServSm: { background:"#1e293b", color:"#94a3b8", border:"none", borderRadius:6, padding:"5px 12px", fontSize:12, cursor:"pointer", fontFamily:"inherit" },
  section: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:12, padding:20 },
  label: { display:"block", color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 },
  servicoCard: { background:"#0f172a", border:"2px solid #1e293b", borderRadius:10, padding:"14px 16px", cursor:"pointer", userSelect:"none", transition:"all 0.15s" },
  servicoCardActive: { background:"#0d1f3c", border:"2px solid #3b82f6" },
  clientFooter: { display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:10, borderTop:"1px solid #0f172a", marginBottom:10 },
  obrasCount: { color:"#64748b", fontSize:12 },
  statusDot: { fontSize:12, fontWeight:600 },
  clientActions: { display:"flex", gap:8 },
  actionBtn: { background:"#1e293b", border:"none", color:"#94a3b8", borderRadius:6, padding:"5px 10px", fontSize:12, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s" },
  catTag: { background:"#1e293b", color:"#94a3b8", fontSize:11, padding:"3px 8px", borderRadius:4 },
  empty: { gridColumn:"1/-1", display:"flex", flexDirection:"column", alignItems:"center", gap:12, padding:"60px 0", color:"#475569" },
  emptyIcon: { fontSize:48 },
  emptyText: { fontSize:15, fontWeight:600, color:"#475569" },
  // Detalhe
  detailHeader: { display:"flex", justifyContent:"space-between", alignItems:"center" },
  backBtn: { background:"#1e293b", border:"none", color:"#94a3b8", borderRadius:8, padding:"8px 16px", fontSize:13, cursor:"pointer", fontFamily:"inherit" },
  detailWrap: { display:"flex", flexDirection:"column", gap:16 },
  detailCard: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:12, padding:20, animation:"fadeIn 0.3s ease" },
  detailCardTitle: { color:"#64748b", fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:4 },
  detailProfile: { display:"flex", alignItems:"center", gap:16 },
  detailFields: { marginTop:8 },
  contatoRow: { padding:"10px 0", borderBottom:"1px solid #0f172a" },
  obraRow: { display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #0f172a" },
  // Formulário
  formHeader: { display:"flex", alignItems:"center", gap:16 },
  formTitle: { color:"#f1f5f9", fontWeight:800, fontSize:20, margin:0 },
  formWrap: { display:"flex", flexDirection:"column", gap:4 },
  formSection: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:12, padding:20, display:"flex", flexDirection:"column", gap:12 },
  sectionTitle: { color:"#94a3b8", fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:1 },
  formGrid2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 },
  formGrid3: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 },
  fieldLabel: { display:"block", color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5, marginBottom:5 },
  input: { width:"100%", background:"#0f172a", border:"1px solid #1e293b", borderRadius:8, color:"#f1f5f9", padding:"9px 12px", fontSize:13, outline:"none", fontFamily:"inherit" },
  inputSm: { width:"100%", background:"#0f172a", border:"1px solid #1e293b", borderRadius:6, color:"#f1f5f9", padding:"7px 10px", fontSize:12, outline:"none", fontFamily:"inherit" },
  select: { width:"100%", background:"#0f172a", border:"1px solid #1e293b", borderRadius:8, color:"#f1f5f9", padding:"9px 12px", fontSize:13, outline:"none", fontFamily:"inherit" },
  textarea: { width:"100%", background:"#0f172a", border:"1px solid #1e293b", borderRadius:8, color:"#f1f5f9", padding:"9px 12px", fontSize:13, outline:"none", fontFamily:"inherit", resize:"vertical" },
  radioGroup: { display:"flex", gap:10 },
  radioLabel: { background:"#0f172a", border:"1px solid #1e293b", borderRadius:8, padding:"8px 20px", cursor:"pointer", color:"#64748b", fontSize:13, fontWeight:600, userSelect:"none" },
  radioActive: { background:"#1e3a5f", borderColor:"#3b82f6", color:"#60a5fa" },
  contatoFormRow: { background:"#0f172a", borderRadius:8, padding:12, border:"1px solid #1e293b" },
  catToggle: { background:"#0f172a", border:"1px solid #1e293b", borderRadius:6, color:"#64748b", padding:"6px 12px", fontSize:12, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s" },
  catToggleActive: { background:"#1e3a5f", borderColor:"#3b82f6", color:"#60a5fa" },
  formActions: { display:"flex", gap:10, justifyContent:"flex-end", paddingTop:8 },
  // Botões
  btnPrimary: { background:"linear-gradient(135deg,#3b82f6,#2563eb)", color:"#fff", border:"none", borderRadius:8, padding:"10px 20px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" },
  btnSecondary: { background:"#1e293b", color:"#94a3b8", border:"none", borderRadius:8, padding:"8px 14px", fontSize:13, cursor:"pointer", fontFamily:"inherit" },
  btnCancel: { background:"#1e293b", color:"#94a3b8", border:"none", borderRadius:8, padding:"10px 20px", fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"inherit" },
  // NF
  nfHeader: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:12, padding:20 },
  dropZone: { border:"2px dashed #1e293b", borderRadius:16, padding:"60px 40px", cursor:"pointer", textAlign:"center", transition:"all 0.2s", background:"#0d1526" },
  dropZoneDone: { border:"2px dashed #3b82f6", background:"#0d1b33" },
  errorBox: { background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:8, padding:"12px 16px", color:"#f87171", fontSize:13 },
  processingBox: { background:"#0d1526", border:"1px solid #1e293b", borderRadius:16, padding:40, textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center" },
  processingAnim: { marginBottom:8 },
  processingSteps: { display:"flex", flexDirection:"column", gap:8, marginTop:20, textAlign:"left" },
  processingStep: { display:"flex", alignItems:"center", gap:10 },
  reviewHeader: { background:"#0d2618", border:"1px solid #14532d", borderRadius:10, padding:"14px 18px" },
  reviewBadge: { color:"#4ade80", fontWeight:700, fontSize:14 },
  matchFound: { marginTop:10, color:"#4ade80", fontSize:12, background:"#052e16", padding:"6px 12px", borderRadius:6, display:"inline-block" },
  matchNew: { marginTop:10, color:"#f59e0b", fontSize:12, background:"#1c1500", padding:"6px 12px", borderRadius:6, display:"inline-block" },
  successBox: { display:"flex", flexDirection:"column", alignItems:"center", gap:16, padding:"80px 40px", textAlign:"center" },
  successIcon: { fontSize:56 },
  th: { color:"#475569", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5, padding:"10px 12px", textAlign:"left", borderBottom:"1px solid #1e293b" },
  td: { color:"#94a3b8", fontSize:13, padding:"10px 12px", verticalAlign:"middle" },
};
