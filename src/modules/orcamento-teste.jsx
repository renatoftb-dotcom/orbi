// ═══════════════════════════════════════════════════════════════
// MÓDULO ORÇAMENTO VICKE
// ═══════════════════════════════════════════════════════════════
// Fluxo de componentes:
//   TesteOrcamento           (aba de testes do app)
//   └─ FormOrcamentoProjetoTeste   (form principal: define params, etapas, pagamento)
//      └─ PropostaPreview          (preview interativo da proposta)
//         └─ buildPdf() [resultado-pdf.jsx]  (gera PDF com _preview como espelho)
//
// Convenções importantes:
//  - engAtiva = incluiEng && (!temIsoladas || idsIsolados.has(5))
//    ↳ reflete toggle de engenharia + isolamento de etapas
//  - _preview: objeto passado do preview pro PDF com valores já calculados
//    ↳ PDF sempre prioriza P.xxx antes de recalcular (evita divergências)
//  - Cascata circular de %: ao editar uma etapa isolada, ajusta a PRÓXIMA
//    na ordem circular; se é a última, ajusta a primeira.
//  - Inputs numéricos usam o helper NumInput (estado local, commit no blur)
//    para evitar perda de foco durante redistribuição de percentuais.
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// Helpers top-level de pluralização de cômodos (usados em múltiplos lugares)
// Constantes fora dos componentes: não recriam a cada render
// ═══════════════════════════════════════════════════════════════
const PLURAIS_IRREG = {
  "Sala TV": "salas TV",
  "Sala de jantar": "salas de jantar",
  "Hall de entrada": "halls de entrada",
  "Área de lazer": "áreas de lazer",
  "Lavabo Lazer": "lavabos lazer",
  "Closet Suíte": "closets suíte",
  "Suíte Master": "suítes master",
  "Suíte": "suítes",
  "WC": "WCs",
  "Dormitório": "dormitórios",
  "Escritório": "escritórios",
  "Depósito": "depósitos",
  "Lavabo": "lavabos",
  "Garagem": "garagens",
  "Cozinha": "cozinhas",
  "Lavanderia": "lavanderias",
  "Piscina": "piscinas",
  "Sauna": "saunas",
  "Academia": "academias",
  "Brinquedoteca": "brinquedotecas",
  "Louceiro": "louceiros",
  "Living": "livings",
  "Closet": "closets",
  "Escada": "escadas",
};
const GENERO_AMB = {
  "Garagem":"f","Hall de entrada":"m","Sala TV":"f","Sala de jantar":"f","Living":"m",
  "Cozinha":"f","Lavanderia":"f","Depósito":"m","Lavabo":"m","Escritório":"m",
  "Área de lazer":"f","Piscina":"f","Lavabo Lazer":"m","Sauna":"f","Academia":"f",
  "Brinquedoteca":"f","Louceiro":"m","Dormitório":"m","Closet":"m","WC":"m",
  "Suíte":"f","Closet Suíte":"m","Suíte Master":"f","Escada":"f",
};
const NUM_EXT_MASC = ["","um","dois","três","quatro","cinco","seis","sete","oito","nove","dez"];
const NUM_EXT_FEM  = ["","uma","duas","três","quatro","cinco","seis","sete","oito","nove","dez"];

// Formata "N nome" — número por extenso até 10, algarismo acima; pluraliza nome
// Casos especiais: "Garagem" vira "vaga de garagem" / "vagas de garagem"
function formatComodo(nome, qtd) {
  const plural = qtd > 1;
  if (nome === "Garagem") {
    const ext = qtd <= 10 ? NUM_EXT_FEM[qtd] : String(qtd);
    return `${ext} ${plural ? "vagas de garagem" : "vaga de garagem"}`;
  }
  const nomeStr = plural ? (PLURAIS_IRREG[nome] || (nome.toLowerCase() + "s")) : nome.toLowerCase();
  const genero = GENERO_AMB[nome] || "m";
  const ext = genero === "f" ? NUM_EXT_FEM : NUM_EXT_MASC;
  const qtdStr = qtd <= 10 ? ext[qtd] : String(qtd);
  return `${qtdStr} ${nomeStr}`;
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO ORÇAMENTOS (lista centralizada de todos os orçamentos)
// ═══════════════════════════════════════════════════════════════
// Tela inicial: lista com filtros (Ativos/Todos/Rascunho/Em aberto/Ganhos/Perdidos)
// + Novo Orçamento (abre modal pra escolher cliente antes de abrir formulário)
// Status de orçamento: "rascunho" | "aberto" | "ganho" | "perdido"
//
// Quando clica em Ver/Editar ou Novo (após escolher cliente), abre o FormOrcamentoProjetoTeste
// já existente passando os dados do cliente selecionado.
// ═══════════════════════════════════════════════════════════════
function TesteOrcamento({ data, save }) {
  const [orcBase, setOrcBase] = useState(null);
  const [clienteAtivo, setClienteAtivo] = useState(null); // cliente do orçamento aberto
  const [filtro, setFiltro] = useState("ativos");
  const [busca, setBusca] = useState("");
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState("");
  // Proposta sendo visualizada (modal visualizer de snapshot)
  const [propostaVisualizada, setPropostaVisualizada] = useState(null);

  const orcamentos = data?.orcamentosProjeto || [];
  const clientes = data?.clientes || [];

  async function salvarOrcamento(orc) {
    const todos = data.orcamentosProjeto || [];
    const nextId = () => {
      const max = todos.reduce((mx, o) => {
        const m = (o.id || "").match(/^ORC-(\d+)$/);
        return m ? Math.max(mx, parseInt(m[1])) : mx;
      }, 0);
      return "ORC-" + String(max + 1).padStart(4, "0");
    };
    const novo = {
      ...orc,
      id: orc.id || nextId(),
      criadoEm: orc.criadoEm || new Date().toISOString(),
      clienteId: orc.clienteId || clienteAtivo?.id || null,
      status: orc.status || "rascunho",
    };
    setOrcBase(novo);
    const novos = orc.id ? todos.map(o => o.id === orc.id ? novo : o) : [...todos, novo];
    save({ ...data, orcamentosProjeto: novos }).catch(console.error);
  }

  function abrirNovoOrcamento(cliente) {
    setClienteAtivo(cliente);
    setOrcBase(null);
    setModalNovoAberto(false);
    setBuscaCliente("");
  }

  const [modoAbertura, setModoAbertura] = useState(null); // "ver" | "editar" | null

  function abrirOrcamentoExistente(orc, modo = "ver") {
    // Modo "verProposta": abre o visualizador de snapshot (modal com imagens)
    if (modo === "verProposta") {
      const ultima = orc.propostas && orc.propostas.length > 0
        ? orc.propostas[orc.propostas.length - 1]
        : null;
      if (ultima) {
        const cli = clientes.find(c => c.id === orc.clienteId);
        setPropostaVisualizada({ ...ultima, clienteNome: cli?.nome || orc.cliente || "Cliente" });
        return;
      }
      // Se não tem proposta, cai no fluxo normal de "ver"
      modo = "ver";
    }
    const cli = clientes.find(c => c.id === orc.clienteId) || { nome: orc.cliente || "Cliente" };
    setClienteAtivo(cli);
    setOrcBase(orc);
    setModoAbertura(modo);
  }

  function voltarParaLista() {
    setOrcBase(null);
    setClienteAtivo(null);
    setModoAbertura(null);
  }

  // Se um orçamento está aberto (novo ou editando), mostra o formulário
  if (clienteAtivo) {
    return (
      <FormOrcamentoProjetoTeste
        clienteNome={clienteAtivo.nome || "Cliente"}
        clienteWA={clienteAtivo.whatsapp || clienteAtivo.telefone || ""}
        orcBase={orcBase}
        onSalvar={salvarOrcamento}
        onVoltar={voltarParaLista}
        modoAbertura={modoAbertura}
      />
    );
  }

  // ─── Lista principal ───
  const totalContadores = {
    rascunho: orcamentos.filter(o => (o.status || "rascunho") === "rascunho").length,
    aberto:   orcamentos.filter(o => o.status === "aberto").length,
    ganho:    orcamentos.filter(o => o.status === "ganho").length,
    perdido:  orcamentos.filter(o => o.status === "perdido").length,
  };
  const totalTodos = orcamentos.length;
  const totalAtivos = totalTodos - totalContadores.perdido;

  const orcFiltrados = orcamentos.filter(o => {
    const st = o.status || "rascunho";
    if (filtro === "ativos"   && st === "perdido") return false;
    if (filtro === "rascunho" && st !== "rascunho") return false;
    if (filtro === "aberto"   && st !== "aberto") return false;
    if (filtro === "ganho"    && st !== "ganho") return false;
    if (filtro === "perdido"  && st !== "perdido") return false;
    if (busca) {
      const cli = clientes.find(c => c.id === o.clienteId);
      const nomeCli = (cli?.nome || o.cliente || "").toLowerCase();
      const ref = (o.referencia || "").toLowerCase();
      const q = busca.toLowerCase();
      if (!nomeCli.includes(q) && !ref.includes(q)) return false;
    }
    return true;
  });

  // Clientes filtrados no modal de novo
  const clientesFiltrados = buscaCliente.trim()
    ? clientes.filter(c => {
        const q = buscaCliente.toLowerCase();
        return (c.nome || "").toLowerCase().includes(q) ||
               (c.telefone || "").includes(q) ||
               (c.whatsapp || "").includes(q);
      })
    : clientes.slice(0, 20);

  return (
    <PageContainer>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, marginBottom:20 }}>
        <div>
          <h2 style={{ color:"#111", fontWeight:700, fontSize:22, margin:0, letterSpacing:-0.5 }}>Orçamentos</h2>
          <div style={{ color:"#9ca3af", fontSize:13, marginTop:4 }}>Lista de todos os orçamentos do escritório</div>
        </div>
        <button
          onClick={() => setModalNovoAberto(true)}
          style={{
            background:"#111", color:"#fff", border:"1px solid #111",
            borderRadius:7, padding:"8px 14px", fontSize:13, fontWeight:500,
            cursor:"pointer", fontFamily:"inherit",
          }}>
          + Novo Orçamento
        </button>
      </div>

      {/* Toolbar: filtros + busca */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        <OrcFilterPill label="Ativos"    count={totalAtivos}              active={filtro==="ativos"}   onClick={()=>setFiltro("ativos")} />
        <OrcFilterPill label="Todos"     count={totalTodos}               active={filtro==="todos"}    onClick={()=>setFiltro("todos")} countColor="#9ca3af" />
        <OrcFilterPill label="Rascunho"  count={totalContadores.rascunho} active={filtro==="rascunho"} onClick={()=>setFiltro("rascunho")} countColor="#6b7280" />
        <OrcFilterPill label="Em aberto" count={totalContadores.aberto}   active={filtro==="aberto"}   onClick={()=>setFiltro("aberto")}   countColor="#2563eb" />
        <OrcFilterPill label="Ganhos"    count={totalContadores.ganho}    active={filtro==="ganho"}    onClick={()=>setFiltro("ganho")}    countColor="#16a34a" />
        <OrcFilterPill label="Perdidos"  count={totalContadores.perdido}  active={filtro==="perdido"}  onClick={()=>setFiltro("perdido")}  countColor="#b91c1c" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar cliente ou referência…"
          style={{
            flex:1, maxWidth:280, padding:"6px 12px",
            border:"1px solid #e5e7eb", borderRadius:6,
            fontSize:12.5, color:"#111", background:"#fff",
            fontFamily:"inherit", outline:"none",
          }}
        />
      </div>

      {/* Lista */}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {orcFiltrados.length === 0 ? (
          <div style={{
            padding:"48px 24px", textAlign:"center",
            border:"1px dashed #e5e7eb", borderRadius:9, background:"#fafafa",
            color:"#9ca3af", fontSize:13,
          }}>
            {orcamentos.length === 0
              ? "Nenhum orçamento cadastrado ainda. Clique em + Novo Orçamento para começar."
              : "Nenhum orçamento corresponde aos filtros."}
          </div>
        ) : orcFiltrados.map(orc => (
          <OrcCard key={orc.id} orc={orc} clientes={clientes} onAbrir={(modo) => abrirOrcamentoExistente(orc, modo)} />
        ))}
      </div>

      {/* Modal Novo Orçamento */}
      {modalNovoAberto && (
        <ModalNovoOrcamento
          clientes={clientesFiltrados}
          busca={buscaCliente}
          setBusca={setBuscaCliente}
          onSelecionar={abrirNovoOrcamento}
          onFechar={() => { setModalNovoAberto(false); setBuscaCliente(""); }}
          onCadastrarNovo={() => {
            // TODO: abrir tela de cadastro de cliente (ainda não integrado)
            alert("Cadastre o cliente no módulo Clientes e volte aqui.");
          }}
        />
      )}

      {/* Visualizador de proposta enviada (snapshot de imagens) */}
      {propostaVisualizada && (
        <PropostaVisualizer
          proposta={propostaVisualizada}
          onFechar={() => setPropostaVisualizada(null)}
        />
      )}
    </PageContainer>
  );
}

// ─── Pill de filtro ──────────────────────────────
function OrcFilterPill({ label, count, active, onClick, countColor }) {
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
      {count > 0 && (
        <strong style={{ marginLeft:4, color: countColor || "#111", fontWeight:600 }}>{count}</strong>
      )}
    </button>
  );
}

// ─── Card de orçamento na lista ──────────────────
function OrcCard({ orc, clientes, onAbrir }) {
  const cliente = clientes.find(c => c.id === orc.clienteId);
  const nomeCliente = cliente?.nome || orc.cliente || "—";
  const status = orc.status || "rascunho";
  const area = orc.resultado?.areaTotal || 0;

  // Se tem proposta salva, usa os valores dela (edições manuais do usuário)
  // Senão, usa o cálculo original do orçamento base.
  const ultimaProposta = orc.propostas && orc.propostas.length > 0
    ? orc.propostas[orc.propostas.length - 1]
    : null;
  let precoArq, precoEng;
  if (ultimaProposta) {
    // Valores editados pelo usuário na proposta
    precoArq = ultimaProposta.arqEdit != null ? ultimaProposta.arqEdit : (ultimaProposta.calculo?.precoArq || 0);
    precoEng = ultimaProposta.engEdit != null ? ultimaProposta.engEdit : (ultimaProposta.calculo?.precoEng || 0);
  } else {
    precoArq = orc.resultado?.precoArq || 0;
    precoEng = orc.resultado?.precoEng || 0;
  }
  const valorTotal = precoArq + precoEng;

  const tipo = orc.tipo || "—";
  const ref = orc.referencia || "(sem referência)";
  const dataCriado = orc.criadoEm ? new Date(orc.criadoEm) : null;
  const dataFmt = dataCriado ? dataCriado.toLocaleDateString("pt-BR", { day:"2-digit", month:"short" }).replace(".", "") : "";

  const STATUS_TAGS = {
    rascunho: { label:"Rascunho",  bg:"#f3f4f6", color:"#6b7280" },
    aberto:   { label:"Em aberto", bg:"#eff6ff", color:"#2563eb" },
    ganho:    { label:"Ganho",     bg:"#f0fdf4", color:"#16a34a" },
    perdido:  { label:"Perdido",   bg:"#fef2f2", color:"#b91c1c" },
  };
  const tag = STATUS_TAGS[status] || STATUS_TAGS.rascunho;

  return (
    <div
      onClick={() => onAbrir("ver")}
      style={{
        background:"#fff", border:"1px solid #e5e7eb", borderRadius:9,
        padding:"14px 16px",
        display:"grid", gridTemplateColumns:"1fr auto", gap:16, alignItems:"center",
        transition:"all 0.12s", cursor:"pointer",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
    >
      <div style={{ minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
          <div style={{ fontSize:14, fontWeight:600, color:"#111" }}>{nomeCliente}</div>
          <span style={{
            fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5,
            padding:"2px 7px", borderRadius:4,
            background: tag.bg, color: tag.color,
          }}>{tag.label}</span>
        </div>
        <div style={{ fontSize:12, color:"#6b7280", lineHeight:1.5 }}>
          <span style={{ color:"#374151" }}>{ref}</span>
          <span style={{ color:"#9ca3af" }}> · {tipo}{area > 0 ? ` · ${area.toLocaleString("pt-BR")}m²` : ""} · {orc.id}{dataFmt ? ` · ${dataFmt}` : ""}</span>
        </div>
        {orc.propostas && orc.propostas.length > 0 && (
          <div
            onClick={(e) => { e.stopPropagation(); onAbrir("verProposta"); }}
            style={{
              fontSize:11.5, color:"#16a34a", marginTop:4, fontWeight:500,
              cursor:"pointer", display:"inline-block",
            }}
            onMouseEnter={e => { e.currentTarget.style.textDecoration = "underline"; }}
            onMouseLeave={e => { e.currentTarget.style.textDecoration = "none"; }}
            title="Ver a última proposta enviada (somente leitura)"
          >
            📄 {orc.propostas.length} proposta{orc.propostas.length > 1 ? "s" : ""} enviada{orc.propostas.length > 1 ? "s" : ""}
            {orc.ultimaPropostaEm && (
              <span style={{ color:"#6b7280", fontWeight:400 }}>
                {" "}· última em {new Date(orc.ultimaPropostaEm).toLocaleDateString("pt-BR", { day:"2-digit", month:"short" }).replace(".", "")}
              </span>
            )}
          </div>
        )}
      </div>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
        {valorTotal > 0 && (
          <div style={{ fontSize:14, fontWeight:600, color:"#111", whiteSpace:"nowrap" }}>
            R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits:0, maximumFractionDigits:0 })}
          </div>
        )}
        <div style={{ display:"flex", gap:4 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onAbrir("ver")} style={btnIconStyle}>Ver</button>
          <button onClick={() => onAbrir("editar")} style={btnIconStyle}>Editar</button>
          <button onClick={() => alert("Ações em breve: Marcar Ganho / Perdido / Excluir")} style={btnIconStyle}>Ações</button>
        </div>
      </div>
    </div>
  );
}

const btnIconStyle = {
  fontSize:11.5, color:"#6b7280",
  border:"1px solid #e5e7eb", borderRadius:5,
  padding:"3px 9px", background:"#fff",
  cursor:"pointer", fontFamily:"inherit",
};

// ─── Modal de Novo Orçamento (escolha de cliente) ──
function ModalNovoOrcamento({ clientes, busca, setBusca, onSelecionar, onFechar, onCadastrarNovo }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onFechar(); }}
      style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,0.4)",
        display:"flex", alignItems:"center", justifyContent:"center",
        zIndex:100, padding:20,
      }}>
      <div style={{
        background:"#fff", borderRadius:12, width:"100%", maxWidth:480, maxHeight:"90vh",
        display:"flex", flexDirection:"column", boxShadow:"0 20px 40px rgba(0,0,0,0.15)", overflow:"hidden",
      }}>
        <div style={{ padding:"20px 24px 12px", borderBottom:"1px solid #f3f4f6", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:17, fontWeight:700, color:"#111", letterSpacing:-0.3 }}>Novo Orçamento</div>
          <button onClick={onFechar} style={{ background:"none", border:"none", color:"#9ca3af", fontSize:18, cursor:"pointer", fontFamily:"inherit", padding:"2px 6px", lineHeight:1 }}>✕</button>
        </div>
        <div style={{ padding:"16px 24px 20px", overflowY:"auto" }}>
          <div style={{ fontSize:11, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.6, marginBottom:8, fontWeight:600 }}>
            Para qual cliente?
          </div>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar cliente por nome ou telefone…"
            autoFocus
            style={{
              width:"100%", padding:"9px 12px",
              border:"1px solid #e5e7eb", borderRadius:7,
              fontSize:13, color:"#111", fontFamily:"inherit",
              outline:"none", background:"#fff",
            }}
          />
          <div style={{
            marginTop:12, maxHeight:280, overflowY:"auto",
            border:"1px solid #f3f4f6", borderRadius:7,
          }}>
            {clientes.length === 0 ? (
              <div style={{ padding:"24px 16px", textAlign:"center", color:"#9ca3af", fontSize:12.5 }}>
                {busca ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado."}
              </div>
            ) : clientes.map((c, i) => (
              <div
                key={c.id || i}
                onClick={() => onSelecionar(c)}
                style={{
                  padding:"10px 14px",
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  cursor:"pointer", borderBottom: i < clientes.length - 1 ? "1px solid #f9fafb" : "none",
                  transition:"background 0.1s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ fontSize:13, color:"#111", fontWeight:500 }}>{c.nome || "(sem nome)"}</div>
                <div style={{ fontSize:11.5, color:"#9ca3af" }}>{c.telefone || c.whatsapp || ""}</div>
              </div>
            ))}
          </div>
          <div style={{
            display:"flex", alignItems:"center", gap:12, margin:"16px 0",
            color:"#d1d5db", fontSize:11, textTransform:"uppercase", letterSpacing:0.8,
          }}>
            <div style={{ flex:1, height:1, background:"#f3f4f6" }} />
            ou
            <div style={{ flex:1, height:1, background:"#f3f4f6" }} />
          </div>
          <button
            onClick={onCadastrarNovo}
            style={{
              width:"100%", padding:"10px 14px",
              border:"1px dashed #d1d5db", borderRadius:7, background:"#fff",
              fontSize:13, color:"#374151", fontWeight:500,
              fontFamily:"inherit", cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:6,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor="#111"; e.currentTarget.style.color="#111"; e.currentTarget.style.background="#fafafa"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor="#d1d5db"; e.currentTarget.style.color="#374151"; e.currentTarget.style.background="#fff"; }}
          >
            + Cadastrar novo cliente
          </button>
        </div>
      </div>
    </div>
  );
}

function AreaDetalhe({ calculo, fmtNum }) {
  const [aberto, setAberto] = useState(false);
  const [engAberto, setEngAberto] = useState(false);
  const fmt2  = (v) => fmtNum(v);
  const brl  = (v) => v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const m2s  = (v, a) => a > 0 ? ` · R$ ${fmt2(Math.round(v/a*100)/100)}/m²` : "";
  const pct  = (v) => (v * 100).toLocaleString("pt-BR",{minimumFractionDigits:0,maximumFractionDigits:0}) + "%";
  const row  = (lbl, val, opts={}) => (
    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:3, ...opts.style }}>
      <span style={{ color: opts.lblColor||"#6b7280" }}>{lbl}</span>
      <span style={{ color: opts.valColor||"#374151", fontWeight: opts.bold?600:400 }}>{val}</span>
    </div>
  );
  return (
    <div style={{ background:"#f4f5f7", border:"1px solid #dde0e5", borderRadius:8, padding:"10px 14px", marginBottom:10, fontSize:13, color:"#374151" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ fontSize:12, color:"#828a98" }}>Área útil</span>
        <span style={{ fontSize:13, color:"#374151" }}>{fmt2(calculo.areaBruta)} m²</span>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:12, color:"#828a98" }}>Área total (+circ.)</span>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:13, fontWeight:600, color:"#111" }}>{fmt2(calculo.areaTotal)} m²</span>
          <span onClick={() => setAberto(v => !v)}
            style={{ cursor:"pointer", fontSize:11, color:"#828a98", userSelect:"none", lineHeight:1 }}>
            {aberto ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {aberto && (
        <div style={{ marginTop:12, paddingTop:10, borderTop:"1px solid #c8cdd6", display:"flex", flexDirection:"column", gap:5 }}>
          {calculo.isComercial ? (<>
            {row("Área útil", fmt2(calculo.areaBruta)+" m²")}
            {row(`+ ${pct(calculo.acrescimoCirk)} Circulação`, `+${fmt2(Math.round(calculo.areaBruta*calculo.acrescimoCirk*100)/100)} m²`)}
            {(calculo.blocosCom||[]).map((b,i) => (
              <div key={i} style={{ borderTop:"1px solid #c8cdd6", marginTop:6, paddingTop:6 }}>
                {b.label === "Área Comum" ? (<>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontWeight:700, color:"#374151", marginBottom:3 }}>
                    <span>Área Comum · {fmt2(b.area1)} m²</span>
                    <span>{brl(b.precoTot)}{m2s(b.precoTot, b.area1)}</span>
                  </div>
                </>) : (<>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontWeight:700, color:"#374151", marginBottom:3 }}>
                    <span>{b.n > 1 ? `${b.n} ${b.label}s` : b.label} · {fmt2(b.area1)} m² cada · total {fmt2(Math.round(b.area1*b.n*100)/100)} m²</span>
                  </div>
                  {row(`${b.label} (1ª unid.)`, `${brl(b.precoUni)}${m2s(b.precoUni, b.area1)}`, { bold: false })}
                  {b.n > 1 && row(`Total ${b.label}s`, `${brl(b.precoTot)}${m2s(b.precoTot, b.area1*b.n)}`, { bold: true, valColor:"#111" })}
                </>)}
              </div>
            ))}
            {calculo.precoFachada > 0 && (
              <div style={{ borderTop:"1px solid #c8cdd6", marginTop:6, paddingTop:6 }}>
                {row("+15% Fachada", brl(calculo.precoFachada), { bold:false })}
              </div>
            )}
            <div style={{ borderTop:"1px solid #c8cdd6", marginTop:6, paddingTop:6 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <div style={{ fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1 }}>Engenharia <span style={{ fontSize:8, fontWeight:400, letterSpacing:0, textTransform:"none" }}>(Faixas de desconto)</span></div>
                <span onClick={() => setEngAberto(v => !v)} style={{ cursor:"pointer", fontSize:11, color:"#828a98", userSelect:"none" }}>{engAberto ? "▲" : "▼"}</span>
              </div>
              {engAberto && calculo.faixasEng.map((f, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:3 }}>
                  <span style={{ color:"#6b7280" }}>
                    {f.desconto > 0 ? `−${f.desconto.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}% · ` : ""}{fmt2(f.area)} m² × R$ {fmt2(Math.round(f.fator*50*100)/100)}/m²
                  </span>
                  <span style={{ color:"#374151", fontWeight:500 }}>R$ {fmt2(Math.round(f.preco*100)/100)}</span>
                </div>
              ))}
            </div>
          </>) : (<>
            {calculo.nRep > 1 && row(`Área Total (${calculo.nRep}x)`, `${fmt2(calculo.areaTotal)} m² → Total ${fmt2(calculo.areaTot)} m²`)}
            {row("Total de ambientes", calculo.totalAmbientes)}
            {row("Área útil", fmt2(calculo.areaBruta)+" m²")}
            {calculo.areaPiscina > 0 && row("Piscina (Excluído)", fmt2(calculo.areaPiscina)+" m²")}
            {(() => {
              const base = (calculo.areaBruta||0) + (calculo.areaPiscina||0);
              const cirkReal = base > 0 ? Math.round((calculo.areaTotal/base - 1)*100) : 0;
              const vCirk = Math.round(base*(cirkReal/100)*100)/100;
              return row(`+ ${cirkReal}% Circulação e paredes`, `+${fmt2(vCirk)} m²`);
            })()}
            <div style={{ borderTop:"1px solid #c8cdd6", marginTop:4, paddingTop:6 }}>
              <div style={{ fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Índice multiplicador</div>
              {row("Qtd de cômodos", calculo.indiceComodos.toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3}))}
              {row("Padrão", calculo.indicePadrao.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1}))}
              {row("Fator multiplicar", `x${calculo.fatorMult.toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3})}`, { bold:true, valColor:"#111" })}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, borderTop:"1px solid #c8cdd6", paddingTop:6, marginTop:2 }}>
              <span style={{ color:"#6b7280" }}>Preço base</span>
              <span style={{ color:"#374151" }}>{fmt2(calculo.precoBaseVal)} × {calculo.fatorMult.toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3})} = {fmt2(Math.round(calculo.precoBaseVal*calculo.fatorMult*100)/100)} R$/m²</span>
            </div>
            <div style={{ borderTop:"1px solid #c8cdd6", marginTop:4, paddingTop:6 }}>
              <div style={{ fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Faixa de Desconto — Arquitetura (1ª Unidade)</div>
              {calculo.faixasArqDet.map((f, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:3 }}>
                  <span style={{ color:"#6b7280" }}>{f.desconto > 0 ? `−${pct(f.desconto)} · ` : ""}{fmt2(f.area)} m² × R$ {fmt2(Math.round(f.precoM2*100)/100)}/m²</span>
                  <span style={{ color:"#374151", fontWeight:500 }}>R$ {fmt2(f.preco)}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop:"1px solid #c8cdd6", marginTop:4, paddingTop:6 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <div style={{ fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1 }}>Engenharia <span style={{ fontSize:8, fontWeight:400, letterSpacing:0 }}>(Faixas de desconto)</span></div>
                <span onClick={() => setEngAberto(v => !v)} style={{ cursor:"pointer", fontSize:11, color:"#828a98", userSelect:"none" }}>{engAberto ? "▲" : "▼"}</span>
              </div>
              {engAberto && calculo.faixasEng.map((f, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:3 }}>
                  <span style={{ color:"#6b7280" }}>{f.desconto > 0 ? `−${f.desconto.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}% · ` : ""}{fmt2(f.area)} m² × R$ {fmt2(Math.round(f.fator*50*100)/100)}/m²</span>
                  <span style={{ color:"#374151", fontWeight:500 }}>R$ {fmt2(Math.round(f.preco*100)/100)}</span>
                </div>
              ))}
            </div>
          </>)}
        </div>
      )}
    </div>
  );
}

function ResumoDetalhes({ calculo, fmtNum, C }) {
  const [repAberto, setRepAberto] = useState(false);
  const fmt2   = (v) => v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const m2str  = (v, area) => area > 0 ? ` (R$ ${fmtNum(Math.round(v / area * 100) / 100)}/m²)` : "";
  const hasRep = calculo.nRep > 1;
  return (
    <>
      <div style={{ ...C.resumoSec, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span>Arquitetura</span>
        {hasRep && (
          <span onClick={() => setRepAberto(v => !v)} style={{ cursor:"pointer", fontSize:13, color:"#828a98", userSelect:"none" }}>
            {repAberto ? "▲" : "▼"}
          </span>
        )}
      </div>
      <div style={{ display:"flex", alignItems:"baseline", gap:8, marginTop:4 }}>
        <span style={C.resumoVal}>{fmt2(calculo.precoArq)}</span>
        <span style={C.resumoM2}>R$ {fmtNum(calculo.precoM2Arq)}/m²</span>
      </div>
      {hasRep && repAberto && (
        <div style={{ marginTop:4, borderLeft:"2px solid #f3f4f6", paddingLeft:8 }}>
          {calculo.unidades.map(u => (
            <div key={u.und} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#6b7280", marginTop:3 }}>
              <span>Und {u.und}{u.und > 1 ? ` (${Math.round(calculo.pctRep * 100)}%)` : ""}</span>
              <span>{fmt2(u.arq)}{m2str(u.arq, calculo.areaTotal)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ ...C.resumoSec, marginTop:16, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span>Engenharia</span>
      </div>
      <div style={{ display:"flex", alignItems:"baseline", gap:8, marginTop:4 }}>
        <span style={C.resumoVal}>{fmt2(calculo.precoEng)}</span>
        <span style={C.resumoM2}>R$ {fmtNum(calculo.precoM2Eng)}/m²</span>
      </div>
      {hasRep && repAberto && (
        <div style={{ marginTop:4, borderLeft:"2px solid #f3f4f6", paddingLeft:8 }}>
          {calculo.unidades.map(u => (
            <div key={u.und} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#6b7280", marginTop:3 }}>
              <span>Und {u.und}{u.und > 1 ? ` (${Math.round(calculo.pctRep * 100)}%)` : ""}</span>
              <span>{fmt2(u.eng)}{m2str(u.eng, calculo.areaTotal)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop:20, paddingTop:14, borderTop:"1px solid #dde0e5" }}>
        <div style={{ fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Total Geral</div>
        <div style={{ display:"flex", alignItems:"baseline", gap:8, marginTop:4 }}>
          <span style={{ fontSize:20, fontWeight:800, color:"#111" }}>{fmt2(calculo.precoArq + calculo.precoEng)}</span>
          <span style={C.resumoM2}>R$ {fmtNum(calculo.areaTot > 0 ? Math.round((calculo.precoArq + calculo.precoEng) / calculo.areaTot * 100) / 100 : 0)}/m²</span>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers de edição inline — top-level para preservar identidade
// entre re-renders e manter o foco ao clicar
// ─────────────────────────────────────────────────────────────
function TextoEditavel({ valor, onChange, style={}, multiline=false, placeholder="" }) {
  const [editando, setEditando] = useState(false);
  const [tmp, setTmp] = useState(valor);
  if (editando) {
    const baseStyle = { fontSize:"inherit", fontWeight:"inherit", color:"inherit", fontFamily:"inherit",
      lineHeight:"inherit", letterSpacing:"inherit", background:"#fffde7",
      border:"1px solid #b0b7c3", borderRadius:4, padding:"2px 6px", outline:"none",
      width:"100%", resize: multiline ? "vertical" : "none", boxSizing:"border-box" };
    return multiline
      ? <textarea autoFocus value={tmp} onChange={e=>setTmp(e.target.value)}
          onBlur={()=>{ onChange(tmp); setEditando(false); }}
          style={{ ...baseStyle, minHeight:60, display:"block" }} />
      : <input autoFocus value={tmp} onChange={e=>setTmp(e.target.value)}
          onBlur={()=>{ onChange(tmp); setEditando(false); }}
          onKeyDown={e=>{ if(e.key==="Enter") e.target.blur(); if(e.key==="Escape") setEditando(false); }}
          style={baseStyle} />;
  }
  return (
    <span onClick={()=>{ setTmp(valor); setEditando(true); }}
      title="Clique para editar"
      style={{ cursor:"pointer", ...style }}>
      {valor || placeholder}
    </span>
  );
}

// Textarea sempre visível com state local — commit apenas no blur.
// Só sincroniza com valor externo quando ele MUDA de fora
// (não quando recebe de volta o próprio valor commitado).
function TextareaControlado({ valor, onCommit, placeholder="", style={}, minHeight=60 }) {
  const [local, setLocal] = useState(valor || "");
  const [focado, setFocado] = useState(false);
  const ultimoExterno = useRef(valor || "");
  useEffect(() => {
    const externo = valor || "";
    if (externo !== ultimoExterno.current) {
      ultimoExterno.current = externo;
      setLocal(externo);
    }
  }, [valor]);
  return (
    <textarea
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={() => setFocado(true)}
      onBlur={() => {
        setFocado(false);
        if (local !== (valor || "")) {
          ultimoExterno.current = local;
          onCommit(local);
        }
      }}
      placeholder={focado ? "" : placeholder}
      style={{ width:"100%", fontSize:13, color:"#6b7280", fontFamily:"inherit", lineHeight:1.7,
        border:"1px solid #c8cdd6", borderRadius:6, padding:"6px 10px", outline:"none",
        resize:"vertical", minHeight, boxSizing:"border-box", background:"#f5f6f8", ...style }}
    />
  );
}

// Input single-line com mesmo visual/comportamento do TextareaControlado
function InputControlado({ valor, onCommit, placeholder="", style={} }) {
  const [local, setLocal] = useState(valor || "");
  const [focado, setFocado] = useState(false);
  const ultimoExterno = useRef(valor || "");
  useEffect(() => {
    const externo = valor || "";
    if (externo !== ultimoExterno.current) {
      ultimoExterno.current = externo;
      setLocal(externo);
    }
  }, [valor]);
  return (
    <input
      type="text"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={() => setFocado(true)}
      onBlur={() => {
        setFocado(false);
        if (local !== (valor || "")) {
          ultimoExterno.current = local;
          onCommit(local);
        }
      }}
      onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
      placeholder={focado ? "" : placeholder}
      style={{ fontSize:13, color:"#111", fontFamily:"inherit", fontWeight:600,
        border:"1px solid #c8cdd6", borderRadius:6, padding:"4px 10px", outline:"none",
        boxSizing:"border-box", background:"#f5f6f8", ...style }}
    />
  );
}

// Input de valor monetário com commit no blur
function EtapaValorInput({ valorAtual, fmtN, onCommit, borderColor, color }) {
  const [local, setLocal] = useState(fmtN(valorAtual));
  const [focado, setFocado] = useState(false);
  const ultimoExterno = useRef(valorAtual);
  useEffect(() => {
    if (!focado && valorAtual !== ultimoExterno.current) {
      ultimoExterno.current = valorAtual;
      setLocal(fmtN(valorAtual));
    }
  }, [valorAtual, focado, fmtN]);
  return (
    <input type="text"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={e => { setFocado(true); e.target.select(); }}
      onBlur={() => {
        setFocado(false);
        const raw = local.replace(/\./g, "").replace(",", ".");
        const num = parseFloat(raw);
        if (!isNaN(num) && num >= 0) {
          ultimoExterno.current = num;
          onCommit(num);
        } else {
          setLocal(fmtN(valorAtual));
        }
      }}
      onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { setLocal(fmtN(valorAtual)); e.target.blur(); } }}
      style={{ width:"100%", fontSize:12, padding:"3px 6px", border:`1px solid ${borderColor}`, borderRadius:4, textAlign:"right", fontFamily:"inherit", outline:"none", fontWeight:500, color, background:"transparent" }} />
  );
}

// Input numérico genérico (inteiro ou decimal) com commit no blur.
// Mantém estado LOCAL durante a digitação pra evitar perda de foco quando
// o estado externo desencadeia re-renders (ex: redistribuição de percentuais).
function NumInput({ valor, onCommit, decimais = 2, min = 0, max = 100, width = 50, style = {} }) {
  const [local, setLocal] = useState(String(valor).replace(".",","));
  const [focado, setFocado] = useState(false);
  const ultimoExterno = useRef(valor);
  useEffect(() => {
    if (!focado && valor !== ultimoExterno.current) {
      ultimoExterno.current = valor;
      setLocal(String(valor).replace(".",","));
    }
  }, [valor, focado]);
  return (
    <input type="text"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={e => { setFocado(true); e.target.select(); }}
      onBlur={() => {
        setFocado(false);
        const raw = local.replace(",", ".");
        let num = parseFloat(raw);
        if (isNaN(num)) { setLocal(String(valor).replace(".",",")); return; }
        num = Math.max(min, Math.min(max, num));
        if (decimais === 0) num = Math.round(num);
        ultimoExterno.current = num;
        onCommit(num);
      }}
      onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { setLocal(String(valor).replace(".",",")); e.target.blur(); } }}
      style={{ width, fontSize:12, padding:"3px 6px", border:"1px solid #e5e7eb", borderRadius:4, textAlign:"center", fontFamily:"inherit", outline:"none", ...style }} />
  );
}

// Helper: bloco de opções de pagamento (espelha o PDF)
// tipo: "pacote" (mostra valores) ou "etapaAEtapa" (só descreve)
// Para "pacote": valor, desc%, parcelas
// Para "etapaAEtapa": só desc% e parcelas
function OpcoesPagamento({ tipo, valor, desc, parcelas, fmtV }) {
  const MD = "#6b7280";
  const INK = "#111827";
  const styleContainer = { fontSize:12, color:MD, marginTop:8, lineHeight:1.6 };
  const styleLabel = { fontWeight:600, color:INK };
  const styleValor = { color:INK, fontWeight:600 };
  if (tipo === "etapaAEtapa") {
    return (
      <div style={styleContainer}>
        <div style={{ marginBottom:3 }}>
          <span style={styleLabel}>Opção 1: </span>
          Cada etapa paga antecipadamente com {desc}% de desconto.
        </div>
        <div>
          <span style={styleLabel}>Opção 2: </span>
          {parcelas > 1
            ? <>Cada etapa parcelada em {parcelas}× (entrada + {parcelas-1}× ao longo da etapa). <span style={{ fontSize:10, color:"#9ca3af" }}>sem desconto</span></>
            : <>Cada etapa paga à vista no início.</>}
        </div>
      </div>
    );
  }
  // pacote — mantém layout com valores literais
  const valorComDesc = Math.round(valor * (1 - desc/100) * 100) / 100;
  const parcVal = Math.round(valor / parcelas * 100) / 100;
  return (
    <div style={styleContainer}>
      <div style={{ marginBottom:3 }}>
        <span style={styleLabel}>Opção 1 — Pagamento antecipado ({desc}% de desconto):</span>{" "}
        De {fmtV(valor)} por <span style={styleValor}>{fmtV(valorComDesc)}</span>
      </div>
      <div>
        <span style={styleLabel}>
          Opção 2 — {parcelas > 1 ? `Parcelado em ${parcelas}× sem desconto` : "À vista"}:
        </span>{" "}
        {parcelas > 1
          ? <>Entrada de <span style={styleValor}>{fmtV(parcVal)}</span> + {parcelas-1}× de <span style={styleValor}>{fmtV(parcVal)}</span></>
          : <span style={styleValor}>{fmtV(valor)}</span>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VISUALIZADOR DE PROPOSTA (snapshot de imagens do PDF)
// ═══════════════════════════════════════════════════════════════
// Modal overlay que mostra as páginas da proposta como imagens.
// É um registro imutável — literalmente as imagens renderizadas
// do PDF no momento em que a proposta foi enviada ao cliente.
function PropostaVisualizer({ proposta, onFechar }) {
  // Fecha com ESC
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  if (!proposta) return null;
  const imagens = proposta.imagensPdf || [];
  const temImagens = imagens.length > 0;
  const dataFmt = proposta.enviadaEm
    ? new Date(proposta.enviadaEm).toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" })
    : "";

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}
      style={{
        position:"fixed", inset:0, background:"rgba(17,24,39,0.85)",
        zIndex:300, display:"flex", flexDirection:"column",
        backdropFilter:"blur(4px)",
      }}
    >
      {/* Header fixo */}
      <div style={{
        background:"rgba(255,255,255,0.05)", borderBottom:"1px solid rgba(255,255,255,0.1)",
        padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between",
        color:"#fff", flexShrink:0,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ fontSize:14, fontWeight:600 }}>📄 Proposta {proposta.versao}</div>
          {dataFmt && <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)" }}>enviada em {dataFmt}</div>}
          {proposta.clienteNome && (
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)" }}>· {proposta.clienteNome}</div>
          )}
        </div>
        <button
          onClick={onFechar}
          style={{
            background:"transparent", border:"1px solid rgba(255,255,255,0.2)",
            color:"#fff", borderRadius:6, padding:"6px 12px",
            cursor:"pointer", fontSize:13, fontFamily:"inherit",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >
          ✕ Fechar
        </button>
      </div>

      {/* Área de scroll com páginas */}
      <div style={{
        flex:1, overflowY:"auto", padding:"24px 20px",
        display:"flex", flexDirection:"column", alignItems:"center", gap:16,
      }}>
        {temImagens ? (
          imagens.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`Página ${i+1}`}
              style={{
                maxWidth:"min(900px, 100%)", width:"100%",
                boxShadow:"0 8px 32px rgba(0,0,0,0.4)",
                borderRadius:4, background:"#fff",
                display:"block",
              }}
            />
          ))
        ) : (
          <div style={{
            background:"#fff", borderRadius:8, padding:"48px 32px",
            maxWidth:480, textAlign:"center",
          }}>
            <div style={{ fontSize:15, fontWeight:600, color:"#111", marginBottom:8 }}>
              Snapshot de imagens não disponível
            </div>
            <div style={{ fontSize:13, color:"#6b7280", lineHeight:1.5 }}>
              Esta proposta foi salva antes da funcionalidade de snapshot visual. Os dados estão preservados — você pode reimprimir o PDF a partir da edição do orçamento.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PropostaPreview({ data, onVoltar, onSalvarProposta, propostaReadOnly, propostaSnapshot, lockEdicao }) {
  // NOTA: NÃO fazer `if (!data) return null` aqui — os hooks abaixo precisam ser
  // chamados em todo render (regra do React). Em vez disso, usamos optional chaining
  // e defaults em cada acesso a `data.xxx` e retornamos null só DEPOIS dos hooks.
  const safeData = data || {};
  const { tipoProjeto, tipoObra, padrao, tipologia, tamanho, clienteNome,
          calculo,
          totSI, totCI, impostoV,
          incluiArq = true, incluiEng = true, incluiMarcenaria = false } = safeData;

  // Se tem snapshot de proposta salva, usamos valores dela como initial state.
  // Senão, valores calculados do orçamento base.
  const snap = propostaSnapshot || null;

  // Estado do modal de confirmação de salvar + aviso de proposta salva
  const [confirmSalvar, setConfirmSalvar] = useState(false);
  const [propostaInfo, setPropostaInfo] = useState(propostaReadOnly || null);

  // Estados locais (antes eram props read-only) — editáveis inline
  const [tipoPgto, setTipoPgtoLocal]     = useState(snap?.tipoPgto || data.tipoPgto || "padrao");
  const [temImposto, setTemImpostoLocal] = useState(snap?.temImposto ?? data.temImposto ?? false);
  const [aliqImp, setAliqImpLocal]       = useState(snap?.aliqImp ?? data.aliqImp ?? 16);
  const [etapasPct, setEtapasPctLocal]   = useState(() => {
    const base = snap?.etapasPct || data.etapasPct || [
      { id:1, nome:"Estudo de Viabilidade",  pct:10 },
      { id:2, nome:"Estudo Preliminar",      pct:40 },
      { id:3, nome:"Aprovação na Prefeitura",pct:12 },
      { id:4, nome:"Projeto Executivo",      pct:38 },
    ];
    // Garante que a etapa 5 (Engenharia) sempre exista
    if (!base.some(e => e.id === 5)) {
      return [...base, { id:5, nome:"Engenharia", pct:0 }];
    }
    return base;
  });
  const [etapasIsoladasLocal, setEtapasIsoladasLocal] = useState(new Set(snap?.etapasIsoladas || data.etapasIsoladas || []));
  const etapasIsoladas = Array.from(etapasIsoladasLocal);
  const [mostrarTabelaEtapas, setMostrarTabelaEtapas] = useState(snap?.mostrarTabelaEtapas ?? data.mostrarTabelaEtapas ?? true);
  // Descontos/parcelas — locais também
  const [descArqLocal,     setDescArqLocal]     = useState(snap?.descArq     ?? data.descArq     ?? 5);
  const [parcArqLocal,     setParcArqLocal]     = useState(snap?.parcArq     ?? data.parcArq     ?? 3);
  const [descPacoteLocal,  setDescPacoteLocal]  = useState(snap?.descPacote  ?? data.descPacote  ?? 10);
  const [parcPacoteLocal,  setParcPacoteLocal]  = useState(snap?.parcPacote  ?? data.parcPacote  ?? 4);
  const [descEtCtrtLocal,  setDescEtCtrtLocal]  = useState(snap?.descEtCtrt  ?? data.descEtCtrt  ?? 5);
  const [parcEtCtrtLocal,  setParcEtCtrtLocal]  = useState(snap?.parcEtCtrt  ?? data.parcEtCtrt  ?? 2);
  const [descPacCtrtLocal, setDescPacCtrtLocal] = useState(snap?.descPacCtrt ?? data.descPacCtrt ?? 15);
  const [parcPacCtrtLocal, setParcPacCtrtLocal] = useState(snap?.parcPacCtrt ?? data.parcPacCtrt ?? 8);

  const fmtV = v => v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const fmtN = v => v.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
  const isPadrao = tipoPgto === "padrao";
  const hoje = new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const dataStr = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
  const validade = new Date(hoje.getTime()+15*86400000).toLocaleDateString("pt-BR");

  const areaTot = calculo.areaTot || calculo.areaTotal || 0;

  // ── Estados editáveis ──────────────────────────────────────
  const [arqEdit, setArqEdit]               = useState(() => {
    if (snap?.arqEdit != null) return snap.arqEdit;
    return incluiArq ? (calculo.precoArq || 0) : 0;
  });
  const [engEdit, setEngEdit]               = useState(() => {
    if (snap?.engEdit != null) return snap.engEdit;
    return incluiEng ? (calculo.precoEng || 0) : 0;
  });
  const [resumoEdit, setResumoEdit]         = useState(snap?.resumoEdit ?? null);
  const [editandoArq, setEditandoArq]       = useState(false);
  const [editandoEng, setEditandoEng]       = useState(false);
  const [editandoResumo, setEditandoResumo] = useState(false);
  // Textos editáveis da proposta
  const [subTituloEdit, setSubTituloEdit]   = useState(snap?.subTituloEdit ?? null);
  const [validadeEdit, setValidadeEdit]     = useState(snap?.validadeEdit || new Date(hoje.getTime()+15*86400000).toLocaleDateString("pt-BR"));
  const [naoInclEdit, setNaoInclEdit]       = useState(snap?.naoInclEdit ?? null);
  const [prazoEdit, setPrazoEdit]           = useState(snap?.prazoEdit ?? null);
  const [responsavelEdit, setResponsavelEdit] = useState(snap?.responsavelEdit || "Arq. Leonardo Padovan");
  const [cauEdit, setCauEdit]               = useState(snap?.cauEdit || "CAU A30278-3 · Ourinhos");
  const [emailEdit, setEmailEdit]           = useState(snap?.emailEdit || "leopadovan.arq@gmail.com");
  const [telefoneEdit, setTelefoneEdit]     = useState(snap?.telefoneEdit || "(14) 99767-4200");
  const [instagramEdit, setInstagramEdit]   = useState(snap?.instagramEdit || "@padovan_arquitetos");
  const [cidadeEdit, setCidadeEdit]         = useState(snap?.cidadeEdit || "Ourinhos");
  const [pixEdit, setPixEdit]               = useState(snap?.pixEdit || "PIX · Chave CNPJ: 36.122.417/0001-74 — Leo Padovan Projetos e Construções · Banco Sicoob");
  const [labelApenasEdit, setLabelApenasEdit] = useState(snap?.labelApenasEdit ?? null);

  const [logoPreview, setLogoPreview]       = useState(snap?.logoPreview || null);

  // Carrega logo do storage ao abrir a proposta (só se não veio do snapshot)
  useEffect(() => {
    if (snap?.logoPreview) return; // já tem do snapshot
    try {
      window.storage.get("escritorio-logo").then(lr => {
        if (lr?.value) setLogoPreview(lr.value);
      }).catch(()=>{});
    } catch {}
  }, []);

  const inputLogoRef = useRef(null);

  function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const data64 = ev.target.result;
      setLogoPreview(data64);
      try { window.storage.set("escritorio-logo", data64).catch(()=>{}); } catch {}
    };
    reader.readAsDataURL(file);
  }

  function handleLogoRemove() {
    setLogoPreview(null);
    try { window.storage.delete("escritorio-logo").catch(()=>{}); } catch {}
  }

  const arqOriginal  = incluiArq ? (calculo.precoArq || 0) : 0;
  const engOriginal  = incluiEng ? (calculo.precoEng || 0) : 0;
  const valorEditado = arqEdit !== arqOriginal || engEdit !== engOriginal;

  const arqCI = incluiArq ? arqEdit : 0;
  const engCI = incluiEng ? engEdit : 0;

  // Helper: converte valor SEM imposto -> COM imposto (inside calculation)
  // valor_bruto = liquido / (1 - aliq/100). Se temImposto=false, retorna o valor direto.
  const comImposto = (v) => (temImposto && v > 0)
    ? Math.round(v / (1 - aliqImp/100) * 100) / 100
    : v;
  // Inverso: converte valor COM imposto -> SEM imposto.
  const semImposto = (v) => (temImposto && v > 0)
    ? Math.round(v * (1 - aliqImp/100) * 100) / 100
    : v;

  // Recalcula totais com valores editados
  const totSIEdit   = arqCI + engCI;
  const totCIEdit   = comImposto(totSIEdit);
  const impostoEdit = temImposto ? Math.round((totCIEdit - totSIEdit) * 100) / 100 : 0;
  // Base das etapas = só arquitetura com imposto
  const arqCIEdit   = comImposto(arqCI);
  // Engenharia com imposto (para linha separada na tabela de etapas)
  const engCIEdit   = comImposto(engCI);

  // Etapa isolada — valor proporcional do total
  // Etapas isoladas — múltipla seleção (state local, manipulável inline)
  const idsIsolados     = etapasIsoladasLocal;
  const temIsoladas     = idsIsolados.size > 0;
  const etapasIsoladasObjs = temIsoladas ? etapasPct.filter(e => idsIsolados.has(e.id)) : [];
  // Compatibilidade com código que usa etapaIsoladaObj (single)
  const etapaIsoladaObj = temIsoladas ? etapasIsoladasObjs[0] : null;
  const etapasVisiveis  = (temIsoladas ? etapasPct.filter(e => idsIsolados.has(e.id)) : etapasPct).filter(e => incluiEng || e.id !== 5);
  // totSIBase = % da arq das etapas isoladas + 100% da eng (se ativa)
  const pctTotalIsolado = etapasIsoladasObjs.reduce((s,e) => s + (e.id !== 5 ? e.pct : 0), 0);
  const engIsolada      = idsIsolados.has(5);
  // Engenharia ATIVA: incluiEng ligado E (sem isolamento OU eng isolada)
  const engAtiva        = incluiEng && (!temIsoladas || engIsolada);
  const arqIsoladaSI    = temIsoladas ? Math.round(arqCI * (pctTotalIsolado / 100) * 100) / 100 : 0;
  // Com isolamento: eng entra apenas se eng estiver isolada
  const engSI           = engAtiva ? engCI : 0;
  const totSIBase       = temIsoladas
    ? Math.round((arqIsoladaSI + engSI) * 100) / 100
    : totSIEdit;

  // Total do pacote em modo etapas — usado tanto no preview quanto no pagamento
  // Valor com imposto das etapas arq selecionadas + eng (se ativa)
  const totalPacoteEtapas = (() => {
    // Soma dos valores das etapas arq selecionadas (ou todas se sem isolamento)
    const etapasArqAtivas = etapasPct.filter(e => e.id !== 5 && (!temIsoladas || idsIsolados.has(e.id)));
    const pctAtivo = etapasArqAtivas.reduce((s,e)=>s+Number(e.pct),0);
    // arqCIEdit = arq TOTAL com imposto (base dos cálculos por etapa no preview)
    return Math.round((arqCIEdit * pctAtivo / 100 + (engAtiva ? engCIEdit : 0)) * 100) / 100;
  })();
  // Subtotal apenas das etapas de arquitetura (sem eng) — para oferecer opção "Apenas Arquitetura"
  const subTotalArqEtapas = (() => {
    const etapasArqAtivas = etapasPct.filter(e => e.id !== 5 && (!temIsoladas || idsIsolados.has(e.id)));
    const pctAtivo = etapasArqAtivas.reduce((s,e)=>s+Number(e.pct),0);
    return Math.round(arqCIEdit * pctAtivo / 100 * 100) / 100;
  })();

  // Subtítulo dinâmico — usa engAtiva (não só o toggle, mas também considera isolamento)
  const subTituloDefault = (incluiArq && engAtiva)
    ? "Proposta Comercial de Projetos de Arquitetura e Engenharia"
    : (incluiArq && !engAtiva)
      ? "Proposta Comercial de Projetos de Arquitetura"
      : (!incluiArq && engAtiva)
        ? "Proposta Comercial de Projetos de Engenharia"
        : "Proposta Comercial";
  // Valor final (edição manual ou default)
  const subTituloFinal = subTituloEdit !== null ? subTituloEdit : subTituloDefault;

  // Resumo descritivo dinâmico (prefixo "Construção nova de" / "Reforma de")
  // Recalcula sempre que tipoObra mudar, a partir dos dados originais do projeto
  const resumoDinamico = (() => {
    const fmtN2 = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
    const fmtArea = v => v > 0 ? fmtN2(v)+"m²" : null;
    const tipoObraLower = (data.tipoObra || "").toLowerCase();
    const prefixo = tipoObraLower.includes("reforma") ? "Reforma de " : "Construção nova de ";
    const calc = data.calculo || {};
    // Caso comercial (conjunto comercial com grupoQtds)
    if (data.grupoQtds && calc.blocosCom) {
      const partes = [];
      const nL = data.grupoQtds["Por Loja"]||0, nA = data.grupoQtds["Espaço Âncora"]||0;
      const nAp = data.grupoQtds["Por Apartamento"]||0, nG = data.grupoQtds["Galpao"]||0;
      if (nL>0) { const b=calc.blocosCom.find(x=>x.label==="Loja"); if(b) partes.push(`${nL} loja${nL!==1?"s":""} (${fmtArea(b.area1*nL)})`); }
      if (nA>0) { const b=calc.blocosCom.find(x=>x.label==="Âncora"); if(b) partes.push(`${nA} ${nA===1?"Espaço Âncora":"Espaços Âncoras"} (${fmtArea(b.area1*nA)})`); }
      if (nAp>0) { const b=calc.blocosCom.find(x=>x.label==="Apartamento"); if(b) partes.push(`${nAp} apartamento${nAp!==1?"s":""} (${fmtArea(b.area1*nAp)})`); }
      if (nG>0) { const b=calc.blocosCom.find(x=>x.label==="Galpão"); if(b) partes.push(`${nG} ${nG!==1?"galpões":"galpão"} (${fmtArea(b.area1*nG)})`); }
      const bc = calc.blocosCom.find(x=>x.label==="Área Comum"); if(bc) partes.push(`Área Comum (${fmtArea(bc.area1)})`);
      const lista = partes.length>1 ? partes.slice(0,-1).join(", ")+" e "+partes[partes.length-1] : partes[0]||"";
      return `${prefixo}conjunto comercial, contendo ${lista}, totalizando ${fmtArea(calc.areaTot||calc.areaTotal)}.`;
    }
    // Caso residencial
    const nUnid = calc.nRep || 1;
    const areaUni = calc.areaTotal || calc.areaTot || 0;
    const areaTotR = Math.round(areaUni * nUnid * 100)/100;
    const comodos = data.comodos || [];
    const totalAmb = comodos.reduce((s,c)=>s+(c.qtd||0),0);

    // Lista composta (ex: "duas garagens, três dormitórios e uma suíte")
    // Usa formatComodo top-level (helpers PLURAIS_IRREG, GENERO_AMB, NUM_EXT_*)
    const itensFmt = comodos.filter(c=>(c.qtd||0)>0).map(c => formatComodo(c.nome, c.qtd));
    const listaStr = itensFmt.length>1
      ? itensFmt.slice(0,-1).join(", ")+" e "+itensFmt[itensFmt.length-1]
      : itensFmt[0]||"";
    const tipDesc = (data.tipologia||"").toLowerCase().includes("sobrado") ? "com dois pavimentos" : "térrea";
    const numFem = ["","uma","duas","três","quatro","cinco","seis","sete","oito","nove","dez"];
    if (nUnid>1) {
      const nExt = nUnid>=1&&nUnid<=10 ? numFem[nUnid] : String(nUnid);
      return `${prefixo}${nExt} residências ${tipDesc} idênticas, com ${fmtN2(areaUni)}m² por unidade, totalizando ${fmtN2(areaTotR)}m² de área construída. Cada unidade composta por ${totalAmb} ambientes: ${listaStr}.`;
    }
    return `${prefixo}uma residência ${tipDesc}, com ${fmtN2(areaUni)}m² de área construída, composta por ${totalAmb} ambientes: ${listaStr}.`;
  })();
  // Valor final (edição manual preserva, senão usa dinâmico)
  const resumoFinal = resumoEdit !== null ? resumoEdit : resumoDinamico;

  // Manipuladores de etapas (isolar, adicionar, remover, editar %)
  function toggleIsolarEtapa(id) {
    setEtapasIsoladasLocal(prev => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }
  function removerEtapa(id) {
    if (id === 5) { alert("A etapa de Engenharia não pode ser removida. Use o toggle de Engenharia na Tela 1 para excluir."); return; }
    setEtapasPctLocal(prev => prev.filter(e => e.id !== id));
    setEtapasIsoladasLocal(prev => { const n = new Set(prev); n.delete(id); return n; });
  }
  function adicionarEtapa() {
    // Garante ID >= 10 para não colidir com ID=5 (Engenharia) nem com IDs padrão (1-4)
    const maxId = Math.max(9, ...etapasPct.map(e => e.id));
    const nextId = maxId + 1;
    setEtapasPctLocal(prev => {
      const engIdx = prev.findIndex(e => e.id === 5);
      const nova = { id: nextId, nome: "Nova etapa", pct: 0 };
      if (engIdx >= 0) {
        // Insere antes da engenharia
        const semEng = prev.filter(e => e.id !== 5);
        return [...semEng, nova, prev[engIdx]];
      }
      return [...prev, nova];
    });
  }
  function atualizarEtapaPct(id, novoPct) {
    // Arredonda pra inteiro (sem casas decimais)
    const clampedInt = Math.round(Math.max(0, Math.min(100, novoPct)));
    setEtapasPctLocal(prev => {
      // Sem isolamento: só atualiza
      if (!temIsoladas) {
        return prev.map(e => e.id === id ? { ...e, pct: clampedInt } : e);
      }
      const etapaAtual = prev.find(e => e.id === id);
      if (!etapaAtual) return prev;
      // Eng ou etapa não isolada: atualização simples
      if (id === 5 || !idsIsolados.has(id)) {
        return prev.map(e => e.id === id ? { ...e, pct: clampedInt } : e);
      }
      // CASCATA CIRCULAR: ajusta só a PRÓXIMA etapa na ordem.
      // Se a editada é a última da lista de isoladas, volta pra primeira.
      // Assim o total das isoladas se mantém sempre constante.
      const arqIsoladasOrdem = prev.filter(e => e.id !== 5 && idsIsolados.has(e.id));
      const idxEditada = arqIsoladasOrdem.findIndex(e => e.id === id);
      const alvo = arqIsoladasOrdem[(idxEditada + 1) % arqIsoladasOrdem.length];
      const pctAntigoEditada = Math.round(Number(etapaAtual.pct));
      const pctAntigoAlvo = Math.round(Number(alvo.pct));
      // O total a manter é: pctAntigoEditada + pctAntigoAlvo
      const totalPar = pctAntigoEditada + pctAntigoAlvo;
      // Limita o valor editado ao máximo possível (não pode passar do totalPar, senão alvo ficaria negativo)
      const pctFinalEditada = Math.min(clampedInt, totalPar);
      const pctFinalAlvo = totalPar - pctFinalEditada;
      // Só tem a editada (1 única etapa isolada): ajusta só ela
      if (arqIsoladasOrdem.length === 1) {
        return prev.map(e => e.id === id ? { ...e, pct: clampedInt } : e);
      }
      return prev.map(e => {
        if (e.id === id)    return { ...e, pct: pctFinalEditada };
        if (e.id === alvo.id) return { ...e, pct: pctFinalAlvo };
        return e;
      });
    });
  }
  function atualizarEtapaValor(id, novoValor) {
    // Converte valor R$ → % da arq base
    // (arqCIEdit é a arq total com imposto; se não tiver imposto, é arqCI mesmo)
    const base = arqCIEdit;
    if (!base || base <= 0) return;
    const novoPct = Math.round((novoValor / base) * 100 * 100) / 100; // 2 decimais
    setEtapasPctLocal(prev => prev.map(e => e.id === id ? { ...e, pct: Math.max(0, Math.min(100, novoPct)) } : e));
  }
  function atualizarEtapaNome(id, novoNome) {
    setEtapasPctLocal(prev => prev.map(e => e.id === id ? { ...e, nome: novoNome } : e));
  }

  // totCIBase = com imposto
  const totCIBase       = temIsoladas
    ? comImposto(totSIBase)
    : totCIEdit;

  function parseValorBR(str) {
    if (!str) return 0;
    const s = String(str).trim();
    // Detecta formato: se tem vírgula após ponto -> pt-BR (1.234,56)
    // Se só tem vírgula -> pode ser 1234,56 ou 1.234,56
    // Remove tudo que não é dígito nem vírgula/ponto
    const temPontoEVirgula = s.includes(".") && s.includes(",");
    if (temPontoEVirgula) {
      // pt-BR: ponto=milhar, vírgula=decimal
      return parseFloat(s.replace(/\./g,"").replace(",",".")) || 0;
    } else if (s.includes(",")) {
      // só vírgula = decimal
      return parseFloat(s.replace(",",".")) || 0;
    } else {
      // só ponto ou número puro
      return parseFloat(s) || 0;
    }
  }

  // ── Escopo como estado (sincronizado com etapasPct) ────────
  const ESCOPO_BASE = [
    { etapaId:1, titulo:"Estudo de Viabilidade", objetivo:"Analisar o potencial construtivo do terreno e verificar a viabilidade de implantação do empreendimento, considerando as condicionantes físicas, urbanísticas, legais e funcionais aplicáveis ao lote.", itens:["Levantamento inicial e consolidação das informações técnicas do terreno","Análise documental e física do lote, incluindo matrícula, dimensões, topografia e características existentes","Consulta e interpretação dos parâmetros urbanísticos e restrições legais aplicáveis","Verificação da viabilidade construtiva, considerando taxa de ocupação, coeficiente de aproveitamento, recuos obrigatórios, gabarito de altura e demais condicionantes normativas","Estimativa preliminar da área edificável e do potencial de aproveitamento do terreno","Avaliação da melhor ocupação do lote, alinhada ao programa de necessidades do cliente","Definição preliminar da implantação, organização dos acessos, fluxos, circulação, áreas livres e áreas construídas","Estudo de volumetria, análise de inserção no entorno e definição de pontos focais que contribuam para a valorização do empreendimento","Dimensionamento preliminar de estacionamentos, fluxos operacionais e viabilidade de circulação para veículos leves e pesados"], entregaveis:["Estudo técnico de ocupação do terreno, com planta de implantação e setorização preliminar","Esquema conceitual de implantação, incluindo diagramas de organização espacial, acessos e condicionantes do entorno","Representações gráficas, estudo volumétrico em 3D e imagens conceituais","Relatório sintético de viabilidade construtiva, contemplando memorial descritivo, quadro de áreas e síntese dos parâmetros urbanísticos aplicáveis"], obs:"Esta etapa tem como objetivo reduzir riscos e antecipar decisões estratégicas antes do desenvolvimento do projeto, permitindo validar a compatibilidade da proposta com o terreno, com a legislação municipal e com os objetivos do empreendimento.", isEng:false },
    { etapaId:2, titulo:"Estudo Preliminar", objetivo:"Desenvolver o conceito arquitetônico inicial, organizando os ambientes, a implantação e a linguagem estética do projeto.", itens:["Reunião de briefing e entendimento das necessidades do cliente","Definição do programa de necessidades","Estudo de implantação da edificação no terreno","Desenvolvimento da concepção arquitetônica inicial","Definição preliminar de: layout, fluxos, volumetria, setorização e linguagem estética","Compatibilização entre funcionalidade, conforto, estética e viabilidade construtiva","Ajustes conforme alinhamento com o cliente"], entregaveis:["Planta baixa preliminar","Estudo volumétrico / fachada conceitual","Implantação inicial","Imagens, croquis ou perspectivas conceituais","Apresentação para validação do conceito arquitetônico"], obs:"É nesta etapa que o projeto ganha forma. O estudo preliminar define a essência da proposta e orienta todas as fases seguintes.", isEng:false },
    { etapaId:3, titulo:"Aprovação na Prefeitura", objetivo:"Adequar e preparar o projeto arquitetônico para protocolo e aprovação junto aos órgãos públicos competentes.", itens:["Adequação do projeto às exigências legais e urbanísticas do município","Elaboração dos desenhos técnicos exigidos para aprovação","Montagem da documentação técnica necessária ao processo","Inserção de informações obrigatórias conforme normas municipais","Preparação de pranchas, quadros de áreas e demais peças gráficas","Apoio técnico durante o processo de aprovação","Atendimento a eventuais comunique-se ou exigências técnicas da prefeitura"], entregaveis:["Projeto legal para aprovação","Plantas, cortes, fachadas e implantação conforme exigência municipal","Quadros de áreas","Arquivos e documentação técnica para protocolo"], obs:"Não inclusos nesta etapa: taxas municipais, emolumentos, ART/RRT, levantamentos complementares, certidões e exigências extraordinárias de órgãos externos, salvo se expressamente previsto.", isEng:false },
    { etapaId:4, titulo:"Projeto Executivo", objetivo:"Desenvolver o projeto arquitetônico em nível detalhado para execução da obra, fornecendo todas as informações necessárias para construção com precisão.", itens:["Desenvolvimento técnico completo do projeto aprovado","Detalhamento arquitetônico para obra","Definição precisa de: dimensões, níveis, cotas, eixos, paginações, esquadrias, acabamentos e elementos construtivos","Elaboração de desenhos técnicos executivos","Compatibilização arquitetônica com premissas de obra","Apoio técnico para leitura e entendimento do projeto pela equipe executora"], entregaveis:["Planta baixa executiva","Planta de locação e implantação","Planta de cobertura","Cortes e fachadas executivos","Planta de layout e pontos arquitetônicos","Planta de esquadrias e pisos","Detalhamentos construtivos","Quadro de esquadrias e quadro de áreas final"], obs:"É a etapa que transforma a ideia em construção real. Um bom projeto executivo reduz improvisos, retrabalhos e falhas de execução na obra.", isEng:false },
    { etapaId:5, titulo:"Projetos Complementares de Engenharia", objetivo:"", itens:["Estrutural: lançamento, dimensionamento de vigas, pilares, lajes e fundações","Elétrico: dimensionamento de cargas, circuitos, quadros e pontos","Hidrossanitário: distribuição de pontos de água fria/quente, esgoto e dimensionamento","Compatibilização entre projetos arquitetônico e de engenharia para verificar possíveis interferências"], entregaveis:[], obs:"", isEng:true },
  ];

  // Estado do escopo — sincronizado com etapasPct
  const [escopoState, setEscopoState] = useState(() => {
    // Se tem snapshot com escopo salvo, usa ele
    if (snap?.escopoState && snap.escopoState.length > 0) {
      return snap.escopoState;
    }
    // Senão, constrói do zero com base nas etapas ativas
    const idsAtivos = new Set(etapasPct.map(e => e.id));
    return ESCOPO_BASE.filter(b => b.isEng || idsAtivos.has(b.etapaId));
  });

  // Sincroniza escopo quando etapasPct muda (adiciona/remove etapas)
  useEffect(() => {
    setEscopoState(prev => {
      const idsAtivos = new Set(etapasPct.map(e => e.id));
      // Remove blocos de etapas que foram excluídas (não-eng)
      const filtrado = prev.filter(b => b.isEng || idsAtivos.has(b.etapaId));
      // Adiciona blocos de etapas novas (id > 5 = customizadas)
      etapasPct.forEach(et => {
        if (et.id > 5 && !filtrado.find(b => b.etapaId === et.id)) {
          filtrado.splice(filtrado.findIndex(b=>b.isEng), 0, {
            etapaId: et.id, titulo: et.nome, objetivo:"", itens:[], entregaveis:[], obs:"", isEng:false, custom:true,
          });
        }
      });
      return filtrado;
    });
  }, [etapasPct]);

  // Guard defensivo: se data não veio, retorna null (APÓS todos os hooks)
  if (!data) return null;


  // Escopo filtrado e renumerado
  const escopoDefault = (() => {
    const blocos = escopoState.filter(b => {
      if (b.isEng) return engAtiva;
      if (!incluiArq) return false;
      if (b.etapaId === 1 && isPadrao) return false;
      if (temIsoladas && !b.isEng && !idsIsolados.has(b.etapaId) && !b.custom) return false;
      return true;
    });
    let n = 0;
    return blocos.map(b => {
      if (!b.isEng) {
        n++;
        const semNum = b.titulo.replace(/^\d+\.\s*/, "");
        return { ...b, tituloNum: `${n}. ${semNum}` };
      }
      const semNum = b.titulo.replace(/^\d+\.\s*/, "");
      return { ...b, tituloNum: `${n+1}. ${semNum}` };
    });
  })();

  // Helpers para editar escopo
  function setEscopoBloco(etapaId, campo, valor) {
    setEscopoState(prev => prev.map(b => b.etapaId === etapaId ? { ...b, [campo]: valor } : b));
  }

    // Itens fixos — simples string ou { label, sub } para texto menor
  const naoInclFixos = [
    // Grupo: Projetos (agrupados em sequência)
    "Projetos de climatização",
    "Projeto de prevenção de incêndio",
    "Projeto de automação",
    "Projeto de paisagismo",
    "Projeto de interiores",
    ...(!incluiMarcenaria ? ["Projeto de Marcenaria (Móveis internos)"] : []),
    "Projeto estrutural de estruturas metálicas",
    "Projeto estrutural de muros de contenção (>1m)",
    // Grupo: Serviços
    "Sondagem e Planialtimétrico do terreno",
    "Acompanhamento semanal de obra",
    "Gestão e execução de obra",
    "Vistoria para Caixa Econômica Federal",
    "RRT de Execução de obra",
    // Outros
    "Taxas municipais e emolumentos (CAU/Prefeitura)",
    ...(!temImposto ? ["Impostos"] : []),
  ];
  // Itens dinâmicos baseados nos toggles + isolamento — com sublabel menor
  // Etapas não isoladas (quando em modo isolamento) aparecem primeiro
  const etapasNaoSelecionadas = temIsoladas
    ? etapasPct.filter(e => e.id !== 5 && !idsIsolados.has(e.id)).map(e => ({ label: e.nome, sub: null }))
    : [];
  const naoInclDinamicos = [
    ...etapasNaoSelecionadas,
    // Eng aparece em "não inclusos" quando não ativa (sem eng no toggle OU com isolamento e eng não isolada)
    ...(!engAtiva ? [{ label:"Projetos de Engenharia", sub:"(Estrutural/Elétrico/Hidrossanitário)" }] : []),
    ...(!incluiArq ? [{ label:"Projetos de Arquitetura", sub:null }] : []),
  ];
  // Normaliza tudo para { label, sub }
  const naoInclDefault = [
    ...naoInclDinamicos,
    ...naoInclFixos.map(s => ({ label: s, sub: null })),
  ];

  const prazoDefault = isPadrao
    ? [
       ...(incluiArq ? ["Prazo estimado para entrega do Projeto Arquitetônico: 30 dias úteis após contratação."] : []),
       ...(engAtiva ? ["Prazo estimado para entrega dos Projetos de Engenharia: 30 dias úteis após aprovação na prefeitura."] : []),
      ]
    : [
       ...(incluiArq || engAtiva ? ["Prazo de 30 dias úteis por etapa, contados após conclusão e aprovação de cada etapa pelo cliente."] : []),
       ...(incluiArq || engAtiva ? ["Concluída e aprovada cada etapa, inicia-se automaticamente o prazo da etapa seguinte."] : []),
       ...(engAtiva ? ["Projetos de Engenharia: 30 dias úteis após aprovação do projeto na Prefeitura."] : []),
      ];

  const C = "#111827";
  const LT = "#828a98";
  const MD = "#6b7280";
  const LN = "#e5e7eb";
  const wrap  = { fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", background:"#fff", minHeight:"100vh", color:C, fontSize:13 };
  const page  = { maxWidth:860, margin:"0 auto", padding:"32px 40px 80px" };
  const secH  = (mt=28) => ({ display:"flex", alignItems:"center", gap:12, margin:`${mt}px 0 14px` });
  const secL  = { fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", color:LT, fontWeight:600, whiteSpace:"nowrap" };
  const secLn = { flex:1, height:1, background:LN };
  const tag   = { fontSize:10, fontWeight:600, color:LT, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5, marginTop:10 };
  const bl    = { display:"flex", gap:8, marginBottom:4 };
  const dot   = { color:LT, flexShrink:0 };

  const Sec = ({title, mt, children, action}) => (
    <div>
      <div style={secH(mt)}>
        <span style={secL}>{title}</span>
        <div style={secLn} />
        {action && action}
      </div>
      {children}
    </div>
  );

  // Constrói snapshot completo de todos os dados editáveis da proposta
  function buildPropostaSnapshot() {
    return {
      versao: null, // definido pelo caller
      enviadaEm: new Date().toISOString(),
      // Dados base do cálculo (para recriar preview idêntico)
      tipoProjeto, tipoObra, padrao, tipologia, tamanho,
      clienteNome, referencia: data.referencia || "",
      comodos: data.comodos || [],
      calculo: data.calculo,
      grupoQtds: data.grupoQtds || null,
      incluiArq, incluiEng, incluiMarcenaria,
      // Estados locais editáveis do preview
      tipoPgto, temImposto, aliqImp, etapasPct: [...etapasPct],
      etapasIsoladas: Array.from(idsIsolados),
      mostrarTabelaEtapas,
      descArq: descArqLocal, parcArq: parcArqLocal,
      descPacote: descPacoteLocal, parcPacote: parcPacoteLocal,
      descEtCtrt: descEtCtrtLocal, parcEtCtrt: parcEtCtrtLocal,
      descPacCtrt: descPacCtrtLocal, parcPacCtrt: parcPacCtrtLocal,
      // Edições manuais
      arqEdit, engEdit, resumoEdit,
      subTituloEdit, validadeEdit, naoInclEdit, prazoEdit,
      responsavelEdit, cauEdit, emailEdit, telefoneEdit,
      instagramEdit, cidadeEdit, pixEdit, labelApenasEdit,
      logoPreview,
      escopoState: escopoState ? JSON.parse(JSON.stringify(escopoState)) : [],
    };
  }

  async function handleSalvarProposta() {
    if (!onSalvarProposta) {
      // Fallback: se não tiver callback, só gera PDF como antes
      await handlePdf();
      return;
    }
    try {
      // 1. Monta snapshot base (sem imagens ainda)
      const snapshot = buildPropostaSnapshot();

      // 2. Gera o PDF como blob (sem baixar)
      const blob = await handlePdf({ returnBlob: true });

      // 3. Rasteriza as páginas em imagens JPEG base64 (1200px, 70% qualidade)
      //    Rasterizar ANTES de baixar pra garantir fidelidade ao que vai ser salvo
      let imagens = [];
      try {
        if (blob && typeof rasterizarPdfParaImagens === "function") {
          imagens = await rasterizarPdfParaImagens(blob, { maxWidth: 1200, quality: 0.7 });
        }
      } catch (errImg) {
        console.warn("Não foi possível gerar snapshot de imagens do PDF:", errImg);
        // Continua mesmo sem imagens — proposta salva sem snapshot visual
      }

      // 4. Adiciona imagens ao snapshot
      snapshot.imagensPdf = imagens;

      // 5. Persiste no orçamento
      const propostaSalva = await onSalvarProposta(snapshot);

      // 6. Baixa o PDF pro usuário enviar ao cliente
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `proposta-${(clienteNome || "projeto").replace(/\s+/g, "-").toLowerCase()}.pdf`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      // 7. Marca como salva e bloqueia edições
      setPropostaInfo({
        versao: propostaSalva?.versao || snapshot.versao || "v1",
        enviadaEm: snapshot.enviadaEm,
      });
      setConfirmSalvar(false);
    } catch(e) {
      console.error(e);
      alert("Erro ao salvar proposta: " + e.message);
    }
  }

  const handlePdf = async (opts = {}) => {
    if (!window.jspdf) { alert("Aguarde 2s e tente novamente."); return; }
    try {
      const c = data.calculo;
      const nUnid = c.nRep || 1;
      // ESPELHO do preview: calcular aqui os valores exatos exibidos e passar prontos ao PDF
      // engAtiva: com isolamento, só conta se eng estiver isolada
      const engAtiva = incluiEng && (!temIsoladas || idsIsolados.has(5));
      // arq/eng exibidos no header (sem imposto)
      const arqExibidoSI = temIsoladas ? arqIsoladaSI : arqCI;
      const engExibidoSI = engAtiva ? engCI : 0;
      // com imposto (usa helper comImposto definido no escopo do componente)
      const arqExibidoCI = comImposto(arqExibidoSI);
      const engExibidoCI = comImposto(engExibidoSI);
      // total com imposto (exatamente como o preview mostra)
      const totalExibidoSI = Math.round((arqExibidoSI + engExibidoSI) * 100) / 100;
      const totalExibidoCI = comImposto(totalExibidoSI);
      // etapas que aparecem no preview (só isoladas quando tem isolamento; sem eng - eng vai separado)
      const etapasExibidas = (temIsoladas
        ? etapasPct.filter(e => e.id !== 5 && idsIsolados.has(e.id))
        : etapasPct.filter(e => e.id !== 5)
      ).map(e => ({
        ...e,
        // Valor calculado exatamente como o preview mostra
        valorCalculado: Math.round(arqCIEdit * (e.pct/100) * 100) / 100,
      }));
      // Etapas NÃO selecionadas (pra entrar em "serviços não inclusos")
      const etapasNaoIncluidas = temIsoladas
        ? etapasPct.filter(e => e.id !== 5 && !idsIsolados.has(e.id)).map(e => e.nome)
        : [];
      // Engenharia também desconsiderada quando não isolada em modo isolamento
      if (incluiEng && temIsoladas && !idsIsolados.has(5)) {
        etapasNaoIncluidas.push("Projetos de Engenharia (Estrutural/Elétrico/Hidrossanitário)");
      }

      // Frase descritiva — só aparece quando tem etapa arq ISOLADA E nem todas estão isoladas
      // (se todas as arq estão isoladas, já está óbvio no escopo — não redundar)
      let avisoIsolado = null;
      if (temIsoladas) {
        const etapasArqTotal = etapasPct.filter(e => e.id !== 5).length;
        const etapasArqIsoladas = etapasPct.filter(e => e.id !== 5 && idsIsolados.has(e.id));
        if (etapasArqIsoladas.length > 0 && etapasArqIsoladas.length < etapasArqTotal) {
          // Lista das etapas isoladas com "e" antes da última
          const nomes = etapasArqIsoladas.map(e => e.nome);
          let lista;
          if (nomes.length === 1) lista = nomes[0];
          else if (nomes.length === 2) lista = `${nomes[0]} e ${nomes[1]}`;
          else lista = `${nomes.slice(0,-1).join(", ")} e ${nomes[nomes.length-1]}`;
          const verboEtapa = nomes.length === 1 ? "à etapa de" : "às etapas de";
          avisoIsolado = `Referente ${verboEtapa} ${lista}:`;
        }
      }

      // Legado (mantido por compat do defaultModelo)
      const arqTotal = arqExibidoSI;
      const engTotal = engExibidoSI;
      const grandTotal = totalExibidoCI;
      const engUnit = engTotal;

      const r = {
        areaTotal: areaTot, areaBruta: c.areaBruta||0, nUnidades: nUnid,
        precoArq: arqTotal, precoFinal: arqTotal, precoTotal: arqTotal,
        precoEng: engTotal, engTotal,
        impostoAplicado: temImposto, aliquotaImposto: aliqImp,
      };
      const fmt   = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
      const fmtM2 = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+" m²";
      // etapasPct no PDF: passa só as que aparecem no preview
      const etapasPdfFinal = etapasExibidas;
      const orc = { id:"teste-"+Date.now(), cliente:data.clienteNome||"Cliente", tipo:data.tipoProjeto, subtipo:data.tipoObra, padrao:data.padrao, tipologia:data.tipologia, tamanho:data.tamanho, comodos:data.comodos||[], tipoPagamento:tipoPgto, descontoEtapa:descArqLocal, parcelasEtapa:parcArqLocal, descontoPacote:descPacoteLocal, parcelasPacote:parcPacoteLocal, descontoEtapaCtrt:descEtCtrtLocal, parcelasEtapaCtrt:parcEtCtrtLocal, descontoPacoteCtrt:descPacCtrtLocal, parcelasPacoteCtrt:parcPacCtrtLocal, etapasPct:etapasPdfFinal, incluiImposto:temImposto, aliquotaImposto:aliqImp, etapasIsoladas:Array.from(idsIsolados), totSI:0, criadoEm:new Date().toISOString(), resultado:r,
        // Controle de exibição
        mostrarTabelaEtapas: mostrarTabelaEtapas,
        // ESPELHO do preview: valores exatos pré-calculados (PDF usa esses em vez de recalcular)
        _preview: {
          arqSI: arqExibidoSI, arqCI: arqExibidoCI,
          engSI: engExibidoSI, engCI: engExibidoCI,
          totalSI: totalExibidoSI, totalCI: totalExibidoCI,
          impostoV: Math.round((totalExibidoCI - totalExibidoSI) * 100) / 100,
          engAtiva, mostrarTabelaEtapas,
          etapasNaoIncluidas,
          // Valores do pacote em modo etapas (igual ao que o preview mostra)
          totalPacoteEtapas,
          subTotalArqEtapas,
          // Textos editáveis da preview
          subTitulo: subTituloFinal,
          labelApenas: labelApenasEdit || (incluiArq && incluiEng ? "Apenas Arquitetura" : incluiEng && !incluiArq ? "Apenas Engenharia" : "Apenas Arquitetura"),
          avisoIsolado: avisoIsolado, // frase "Referente às etapas..." quando isolamento parcial
          prazoCustom: prazoEdit, // pode ser null (usa default do PDF)
          naoInclCustom: naoInclEdit, // pode ser null
        },
        // Textos editáveis
        cidade: cidadeEdit, validadeStr: validadeEdit, pixTexto: pixEdit,
        // Escopo editado na preview
        escopoEditado: escopoState,
      };
      const modelo = defaultModelo(orc, arqTotal, engTotal, grandTotal, fmt, fmtM2, nUnid, engUnit, r);
      if (resumoFinal && modelo.cliente) modelo.cliente.resumo = resumoFinal;
      // Sobrescreve subtítulo no modelo (modo estilo C do PDF usa modelo.subtitulo)
      if (modelo && subTituloFinal) modelo.subtitulo = subTituloFinal;
      const blob = await buildPdf(orc, logoPreview, modelo, null, "#ffffff", incluiArq, incluiEng, { returnBlob: opts.returnBlob });
      if (opts.returnBlob) return blob;
    } catch(e) { console.error(e); alert("Erro ao gerar PDF: "+e.message); }
  };

  return (
    <div style={wrap}>
      {/* Quando em modo somente-leitura (visualização de proposta enviada),
          desabilita todos os inputs e impede interações de edição. */}
      {lockEdicao && (
        <style>{`
          .proposta-locked input,
          .proposta-locked textarea,
          .proposta-locked select,
          .proposta-locked [contenteditable] {
            pointer-events: none !important;
            user-select: text !important;
            background: transparent !important;
          }
          .proposta-locked [data-editable-click] {
            pointer-events: none !important;
            cursor: default !important;
          }
          .proposta-locked button[data-edicao] {
            display: none !important;
          }
        `}</style>
      )}
      <div style={page} className={lockEdicao ? "proposta-locked" : ""}>
        {/* Badge de "Visualização de proposta enviada" */}
        {lockEdicao && (
          <div style={{
            background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8,
            padding:"10px 14px", marginBottom:16,
            display:"flex", alignItems:"center", justifyContent:"space-between", gap:12,
            fontSize:12.5,
          }}>
            <div>
              <strong style={{ color:"#166534" }}>📄 Visualização da proposta enviada</strong>
              {propostaReadOnly?.versao && (
                <span style={{ color:"#15803d", marginLeft:6 }}>
                  {propostaReadOnly.versao}
                  {propostaReadOnly.enviadaEm && ` · ${new Date(propostaReadOnly.enviadaEm).toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" })}`}
                </span>
              )}
              <div style={{ color:"#166534", marginTop:2, fontSize:11.5 }}>
                Este documento é um registro imutável do que foi enviado ao cliente.
              </div>
            </div>
          </div>
        )}

        {/* Aviso de proposta salva (após salvar) — não mostrar se já tem lockEdicao */}
        {!lockEdicao && propostaInfo && (
          <div style={{
            background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8,
            padding:"10px 14px", marginBottom:16,
            display:"flex", alignItems:"center", justifyContent:"space-between", gap:12,
            fontSize:12.5,
          }}>
            <div>
              <strong style={{ color:"#166534" }}>✓ Proposta {propostaInfo.versao} salva</strong>
              <span style={{ color:"#15803d", marginLeft:6 }}>
                em {new Date(propostaInfo.enviadaEm).toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" })}
              </span>
              <div style={{ color:"#166534", marginTop:2, fontSize:11.5 }}>
                Esta versão está congelada. Para alterar, crie uma nova proposta a partir do orçamento.
              </div>
            </div>
          </div>
        )}

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:36 }}>
          <button onClick={onVoltar} style={{ background:"none", border:`1px solid ${LN}`, borderRadius:8, padding:"7px 14px", fontSize:13, cursor:"pointer", fontFamily:"inherit", color:MD }}>
            ← Voltar
          </button>
          {(propostaInfo || lockEdicao) ? (
            <button onClick={handlePdf} style={{ background:C, border:"none", borderRadius:8, padding:"8px 22px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", color:"#fff" }}>
              Gerar PDF
            </button>
          ) : (
            <button onClick={() => onSalvarProposta ? setConfirmSalvar(true) : handlePdf()}
              style={{ background:C, border:"none", borderRadius:8, padding:"8px 22px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", color:"#fff" }}>
              {onSalvarProposta ? "Salvar e Gerar PDF" : "Gerar PDF"}
            </button>
          )}
        </div>

        {/* Modal de confirmação */}
        {confirmSalvar && (
          <div
            onClick={e => { if (e.target === e.currentTarget) setConfirmSalvar(false); }}
            style={{
              position:"fixed", inset:0, background:"rgba(0,0,0,0.4)",
              display:"flex", alignItems:"center", justifyContent:"center",
              zIndex:200, padding:20,
            }}>
            <div style={{
              background:"#fff", borderRadius:12, width:"100%", maxWidth:440,
              boxShadow:"0 20px 40px rgba(0,0,0,0.15)", overflow:"hidden",
            }}>
              <div style={{ padding:"20px 24px 12px", borderBottom:"1px solid #f3f4f6" }}>
                <div style={{ fontSize:17, fontWeight:700, color:"#111" }}>Salvar proposta e gerar PDF</div>
              </div>
              <div style={{ padding:"16px 24px 20px" }}>
                <p style={{ fontSize:13, color:"#374151", lineHeight:1.5, margin:0 }}>
                  Esta proposta será <strong>congelada</strong> com os valores e textos atuais. Ela ficará salva no histórico do orçamento e não poderá mais ser editada.
                </p>
                <p style={{ fontSize:13, color:"#6b7280", lineHeight:1.5, marginTop:10 }}>
                  Para alterar depois, você pode criar uma nova proposta (v2, v3…) a partir do orçamento.
                </p>
                <div style={{ display:"flex", gap:8, marginTop:20, justifyContent:"flex-end" }}>
                  <button onClick={() => setConfirmSalvar(false)}
                    style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:7, padding:"8px 16px", fontSize:13, cursor:"pointer", fontFamily:"inherit", color:"#374151" }}>
                    Cancelar
                  </button>
                  <button onClick={handleSalvarProposta}
                    style={{ background:"#111", border:"1px solid #111", borderRadius:7, padding:"8px 16px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", color:"#fff" }}>
                    Salvar e gerar PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {logoPreview ? (
              <div style={{ position:"relative", display:"inline-flex", alignItems:"center" }}>
                <img src={logoPreview} alt="Logo" style={{ height:44, maxWidth:120, objectFit:"contain", borderRadius:4 }} />
                <button onClick={handleLogoRemove} title="Remover logo"
                  style={{ position:"absolute", top:-6, right:-6, width:16, height:16, borderRadius:"50%",
                    background:"#ef4444", border:"none", cursor:"pointer", display:"flex", alignItems:"center",
                    justifyContent:"center", fontSize:9, color:"#fff", fontWeight:700, lineHeight:1 }}>
                  ✕
                </button>
              </div>
            ) : (
              <button onClick={() => inputLogoRef.current?.click()}
                style={{ height:44, padding:"0 12px", border:"1.5px dashed #d1d5db", borderRadius:6,
                  background:"#f5f6f8", cursor:"pointer", fontSize:11, color:"#828a98", fontFamily:"inherit",
                  display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap" }}>
                + Logo
              </button>
            )}
            <input ref={inputLogoRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleLogoUpload} />
          </div>
          <div style={{ fontSize:11, color:LT }}><TextoEditavel valor={cidadeEdit} onChange={setCidadeEdit} style={{}} />, {dataStr} · Válido até <TextoEditavel valor={validadeEdit} onChange={setValidadeEdit} style={{}} /></div>
        </div>

        <div style={{ borderTop:`1.5px solid ${C}`, borderBottom:`0.5px solid ${LN}`, padding:"12px 0", marginBottom:20, display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
          <div>
            <div style={{ fontSize:24, fontWeight:600, color:C }}>{clienteNome || "Cliente"}</div>
            <div style={{ fontSize:10, color:LT, marginTop:3, letterSpacing:"0.04em" }}><TextoEditavel valor={subTituloFinal} onChange={setSubTituloEdit} style={{ fontSize:10 }} /></div>
          </div>
          <div style={{ textAlign:"right" }}>
            {incluiArq && engAtiva && (
              <>
                <div style={{ display:"flex", alignItems:"baseline", justifyContent:"flex-end", gap:6 }}>
                  <span style={{ fontSize:10, color:LT }}>Apenas Arquitetura</span>
                  <span style={{ fontSize:22, fontWeight:600, color:C }}>{fmtV(temIsoladas ? arqIsoladaSI : arqEdit)}</span>
                </div>
                {areaTot > 0 && (
                  <div style={{ fontSize:11, color:LT }}>R$ {fmtN(Math.round((temIsoladas ? arqIsoladaSI : arqCI)/areaTot*100)/100)}/m²</div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Aviso de isolamento parcial (só quando tem arq isolada E nem todas estão) */}
        {(() => {
          const etArqTotal = etapasPct.filter(e => e.id !== 5).length;
          const etArqIsoladas = etapasIsoladasObjs.filter(e => e.id !== 5);
          if (!temIsoladas || etArqIsoladas.length === 0 || etArqIsoladas.length >= etArqTotal) return null;
          const nomes = etArqIsoladas.map(e => e.nome);
          let lista;
          if (nomes.length === 1) lista = nomes[0];
          else if (nomes.length === 2) lista = `${nomes[0]} e ${nomes[1]}`;
          else lista = `${nomes.slice(0,-1).join(", ")} e ${nomes[nomes.length-1]}`;
          const verboEtapa = nomes.length === 1 ? "à etapa de" : "às etapas de";
          return (
            <div style={{ marginBottom:12, fontSize:13, color:C, fontWeight:600, lineHeight:1.5 }}>
              Referente {verboEtapa} {lista}:
            </div>
          );
        })()}
        {resumoFinal && (
          <div style={{ marginBottom:20, position:"relative" }}>
            {editandoResumo ? (
              <textarea
                autoFocus
                value={resumoFinal}
                onChange={e => setResumoEdit(e.target.value)}
                onBlur={() => setEditandoResumo(false)}
                style={{ width:"100%", fontSize:13, color:MD, lineHeight:1.7, fontFamily:"inherit",
                  background:"#fffde7", border:"2px solid #f59e0b", borderRadius:4,
                  padding:"6px 8px", outline:"none", resize:"vertical", minHeight:60, boxSizing:"border-box" }}
              />
            ) : (
              <div
                onClick={() => setEditandoResumo(true)}
                title="Clique para editar"
                style={{ fontSize:13, color:MD, lineHeight:1.7, cursor:"pointer" }}>
                {resumoFinal}
              </div>
            )}
          </div>
        )}

        <div style={{ display:"flex", alignItems:"center", gap:10, margin:"0 0 14px" }}>
          <span style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", color:"#828a98", fontWeight:600, whiteSpace:"nowrap" }}>Valores dos projetos</span>
          <div style={{ flex:1, height:1, background:"#e5e7eb" }} />
          {valorEditado && (
            <button className="no-print" onClick={() => { setArqEdit(arqOriginal); setEngEdit(engOriginal); }}
              style={{ fontSize:11, color:"#dc2626", background:"#fef2f2", border:"1px solid #fca5a5",
                borderRadius:6, padding:"3px 10px", cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap", fontWeight:600 }}>
              ↺ Restaurar valores
            </button>
          )}
        </div>
        <div>

          <div style={{ display:"grid", gridTemplateColumns: incluiArq && engAtiva ? "1fr 0.5px 1fr" : "1fr", gap:0, marginBottom:12 }}>
            {incluiArq && <div style={{ paddingRight:20 }}>
              <div style={tag}>Arquitetura</div>
              <div style={{ fontSize:20, fontWeight:600, color:C }}>
                {editandoArq ? (
                  <input autoFocus type="text"
                    key={arqCI}
                    defaultValue={(temIsoladas ? arqIsoladaSI : arqCI).toFixed(2).replace(".",",")}
                    onBlur={e => { const v = parseValorBR(e.target.value); if(v>0){ if(temIsoladas && pctTotalIsolado>0){ setArqEdit(Math.round(v/(pctTotalIsolado/100)*100)/100); } else { setArqEdit(Math.round(v*100)/100); } } setEditandoArq(false); }}
                    onKeyDown={e => { if(e.key==="Enter") e.target.blur(); if(e.key==="Escape") setEditandoArq(false); }}
                    style={{ fontSize:20, fontWeight:600, color:C, fontFamily:"inherit", background:"#fffde7",
                      border:"1px solid #b0b7c3", borderRadius:4, padding:"2px 6px", outline:"none", width:"100%" }} />
                ) : (
                  <span onClick={() => setEditandoArq(true)} title="Clique para editar" style={{ cursor:"pointer" }}>
                    {fmtV(temIsoladas ? arqIsoladaSI : arqCI)}
                  </span>
                )}
              </div>
              {areaTot > 0 && (
                <div style={{ fontSize:11, color:LT }}>R$ {fmtN(Math.round((temIsoladas ? arqIsoladaSI : arqCI)/areaTot*100)/100)}/m²</div>
              )}
            </div>}
            {incluiArq && engAtiva && <div style={{ background:LN }} />}
            {engAtiva && <div style={{ paddingLeft: incluiArq ? 20 : 0 }}>
              <div style={tag}>Engenharia <span style={{ fontSize:10, color:LT, textTransform:"none", letterSpacing:0 }}>(Opcional)</span></div>
              <div style={{ fontSize:20, fontWeight:600, color:C }}>
                {editandoEng ? (
                  <input autoFocus type="text"
                    key={engCI}
                    defaultValue={engCI.toFixed(2).replace(".",",")}
                    onBlur={e => { const v = parseValorBR(e.target.value); setEngEdit(v>0 ? Math.round(v*100)/100 : engCI); setEditandoEng(false); }}
                    onKeyDown={e => { if(e.key==="Enter") e.target.blur(); if(e.key==="Escape") setEditandoEng(false); }}
                    style={{ fontSize:20, fontWeight:600, color:C, fontFamily:"inherit", background:"#fffde7",
                      border:"1px solid #b0b7c3", borderRadius:4, padding:"2px 6px", outline:"none", width:"100%" }} />
                ) : (
                  <span onClick={() => setEditandoEng(true)} title="Clique para editar" style={{ cursor:"pointer" }}>
                    {fmtV(engCI)}
                  </span>
                )}
              </div>
              {areaTot > 0 && (
                <div style={{ fontSize:11, color:LT }}>R$ {fmtN(Math.round(engCI/areaTot*100)/100)}/m²</div>
              )}
            </div>}
          </div>
          <div style={{ border:`0.5px solid ${LN}`, borderRadius:8, padding:"10px 14px", fontSize:12, color:LT, marginBottom:4,
              display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
            <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
              <span style={{
                position:"relative", display:"inline-block", width:26, height:14,
                background: temImposto ? "#0369a1" : "#d1d5db",
                borderRadius:7, transition:"background 0.15s",
              }}>
                <span style={{
                  position:"absolute", top:2, left: temImposto ? 14 : 2,
                  width:10, height:10, background:"#fff", borderRadius:"50%",
                  transition:"left 0.15s", boxShadow:"0 1px 2px rgba(0,0,0,0.2)",
                }} />
              </span>
              <input type="checkbox" checked={temImposto} onChange={e => setTemImpostoLocal(e.target.checked)} style={{ display:"none" }} />
              <span>Incluir impostos</span>
            </label>
            {temImposto && (
              <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                <NumInput valor={aliqImp} onCommit={n => setAliqImpLocal(n)}
                  decimais={2} min={0} max={99} width={42}
                  style={{ textAlign:"right" }} />
                <span style={{ color:LT }}>%</span>
              </span>
            )}
            <span style={{ color:LN }}>·</span>
            {temImposto ? (<>
              + Impostos — <span style={{ color:MD, fontWeight:500 }}>{fmtV(temIsoladas ? Math.round((totCIBase - totSIBase)*100)/100 : impostoEdit)}</span>
              &nbsp;·&nbsp; Total com impostos — <span style={{ fontSize:13, fontWeight:600, color:C }}>{fmtV(totCIBase)}</span>
            </>) : (<>
              Total sem impostos — <span style={{ fontSize:13, fontWeight:600, color:C }}>{fmtV(totCIBase)}</span>
            </>)}
          </div>
          <div style={{ display:"flex", gap:6, marginTop:6, marginBottom:4 }}>
            <button
              onClick={() => {
                setTipoPgtoLocal("padrao");
                // Limpa etapas isoladas ao trocar pra Pagamento padrão
                // (pagamento padrão = orça tudo; isolamento é exclusivo do modo "Por etapas")
                setEtapasIsoladasLocal(new Set());
              }}
              style={{ flex:1, padding:"8px 10px", fontSize:12, fontWeight:isPadrao?600:400,
                border: isPadrao ? `1px solid ${C}` : `0.5px solid ${LN}`,
                background:"transparent", borderRadius:6, cursor:"pointer", color:C, fontFamily:"inherit" }}>
              Pagamento padrão
            </button>
            <button
              onClick={() => setTipoPgtoLocal("etapas")}
              style={{ flex:1, padding:"8px 10px", fontSize:12, fontWeight:!isPadrao?600:400,
                border: !isPadrao ? `1px solid ${C}` : `0.5px solid ${LN}`,
                background:"transparent", borderRadius:6, cursor:"pointer", color:C, fontFamily:"inherit" }}>
              Por etapas
            </button>
          </div>
        </div>

        <Sec title={isPadrao ? "Formas de pagamento" : "Contratação por etapa"}>
          {isPadrao ? (<>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:8 }}>
                <TextoEditavel
                  valor={labelApenasEdit || (incluiArq && incluiEng ? "Apenas Arquitetura" : incluiEng ? "Apenas Engenharia" : "Apenas Arquitetura")}
                  onChange={setLabelApenasEdit}
                  style={{ fontSize:12, fontWeight:600 }} />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:6 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Antecipado — desconto</span>
                  <NumInput valor={descArqLocal} onCommit={n => setDescArqLocal(n)} decimais={2} min={0} max={100} width={42} />
                  <span style={{ fontSize:11, color:LT }}>%</span>
                </div>
                <span style={{ color:LN }}>·</span>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Parcelado</span>
                  <NumInput valor={parcArqLocal} onCommit={n => setParcArqLocal(Math.max(1, n))} decimais={0} min={1} max={99} width={42} />
                  <span style={{ fontSize:11, color:LT }}>×</span>
                </div>
              </div>
              <OpcoesPagamento tipo="pacote" valor={arqCIEdit} desc={descArqLocal} parcelas={parcArqLocal} fmtV={fmtV} />
            </div>
            {incluiArq && incluiEng && (
            <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:12, marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:8 }}>Pacote Completo (Arq. + Eng.)</div>
              <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:6 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Antecipado — desconto</span>
                  <NumInput valor={descPacoteLocal} onCommit={n => setDescPacoteLocal(n)} decimais={2} min={0} max={100} width={42} />
                  <span style={{ fontSize:11, color:LT }}>%</span>
                </div>
                <span style={{ color:LN }}>·</span>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Parcelado</span>
                  <NumInput valor={parcPacoteLocal} onCommit={n => setParcPacoteLocal(Math.max(1, n))} decimais={0} min={1} max={99} width={42} />
                  <span style={{ fontSize:11, color:LT }}>×</span>
                </div>
              </div>
              <OpcoesPagamento tipo="pacote" valor={totCIEdit} desc={descPacoteLocal} parcelas={parcPacoteLocal} fmtV={fmtV} />
            </div>
            )}
          </>) : (<>
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"grid", gridTemplateColumns:"24px 1fr 60px 60px 110px 22px", gap:6, alignItems:"center", paddingBottom:6, borderBottom:`1.5px solid ${C}` }}>
                <span></span>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:10, fontWeight:600, color:C, textTransform:"uppercase", letterSpacing:"0.06em" }}>Etapa</span>
                  <label style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", fontSize:10, color:LT, textTransform:"none", letterSpacing:0, fontWeight:400 }}>
                    <span style={{
                      position:"relative", display:"inline-block", width:26, height:14,
                      background: mostrarTabelaEtapas ? "#0369a1" : "#d1d5db",
                      borderRadius:7, transition:"background 0.15s",
                    }}>
                      <span style={{
                        position:"absolute", top:2, left: mostrarTabelaEtapas ? 14 : 2,
                        width:10, height:10, background:"#fff", borderRadius:"50%",
                        transition:"left 0.15s", boxShadow:"0 1px 2px rgba(0,0,0,0.2)",
                      }} />
                    </span>
                    <input type="checkbox"
                      checked={mostrarTabelaEtapas}
                      onChange={e => setMostrarTabelaEtapas(e.target.checked)}
                      style={{ display:"none" }} />
                    <span>Mostrar no PDF</span>
                  </label>
                </div>
                <span></span>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                  <span style={{ fontSize:10, fontWeight:600, color:C, textTransform:"uppercase", letterSpacing:"0.06em" }}>%</span>
                  <span
                    title="Para alterar valores das etapas de arquitetura, edite o total de arquitetura no topo ou ajuste os percentuais"
                    style={{ fontSize:11, color:LT, cursor:"help", userSelect:"none", lineHeight:1 }}>ⓘ</span>
                </div>
                <span style={{ fontSize:10, fontWeight:600, color:C, textTransform:"uppercase", letterSpacing:"0.06em", textAlign:"right" }}>Valor</span>
                <span></span>
              </div>
              {etapasPct.filter(e => incluiEng || e.id !== 5).map((et, i) => {
                const isIsolada = idsIsolados.has(et.id);
                const isEng = et.id === 5;
                // visivel: sem isolamento, tudo visível. Com isolamento, só isoladas
                const visivel = !temIsoladas || isIsolada;
                const bgRow = isIsolada ? "#e0f2fe" : "transparent";
                const corRow = isIsolada ? "#0369a1" : C;
                const fontWt = isIsolada ? 600 : 400;
                // Valor da etapa: arq × pct/100 (com imp). Engenharia: integral (com imp)
                const valorEtapa = isEng
                  ? engCIEdit
                  : Math.round(arqCIEdit*(et.pct/100)*100)/100;
                return (
                <div key={et.id} style={{ display:"grid", gridTemplateColumns:"24px 1fr 60px 60px 110px 22px", gap:6, padding:"7px 4px", borderBottom:`0.5px solid ${LN}`, alignItems:"center", background: bgRow, opacity: visivel ? 1 : 0.35 }}>
                  <span
                    onClick={() => toggleIsolarEtapa(et.id)}
                    title={isIsolada ? "Desmarcar isolamento" : "Orçar apenas esta etapa"}
                    style={{ cursor:"pointer", textAlign:"center", fontSize:14, color: isIsolada ? "#0369a1" : LT, fontWeight:500, userSelect:"none" }}>
                    {isIsolada ? "◉" : "◎"}
                  </span>
                  <span style={{ color:corRow, fontWeight:fontWt }}>
                    {isEng ? (<>
                      <div>Projetos de Engenharia</div>
                      <div style={{ fontSize:11, color:LT, fontWeight:400 }}>Estrutural · Elétrico · Hidrossanitário</div>
                    </>) : (
                      <TextoEditavel valor={et.nome} onChange={v => atualizarEtapaNome(et.id, v)} style={{ fontSize:13, color:corRow, fontWeight:fontWt }} />
                    )}
                  </span>
                  <span></span>
                  {!isEng ? (
                    <NumInput valor={et.pct} onCommit={n => atualizarEtapaPct(et.id, n)}
                      decimais={0} min={0} max={100} width={50} />
                  ) : (
                    <span style={{ color:LT, textAlign:"center" }}>—</span>
                  )}
                  {!isEng ? (
                    <span style={{ fontSize:12, color:corRow, fontWeight:isIsolada?600:500, textAlign:"right", padding:"3px 6px" }}>
                      {fmtN(valorEtapa)}
                    </span>
                  ) : (
                    <EtapaValorInput
                      valorAtual={valorEtapa}
                      fmtN={fmtN}
                      onCommit={novo => {
                        // Converte valor com imposto de volta para sem imposto antes de setar engEdit
                        const semImp = semImposto(novo);
                        setEngEdit(semImp);
                      }}
                      borderColor={LN}
                      color={corRow}
                    />
                  )}
                  {!isEng ? (
                    <span onClick={() => removerEtapa(et.id)} title="Remover etapa"
                      style={{ cursor:"pointer", textAlign:"center", color:"#d1d5db", userSelect:"none", fontSize:14 }}>×</span>
                  ) : <span></span>}
                </div>
                );
              })}
              <div style={{ padding:"8px 0" }}>
                <button
                  onClick={adicionarEtapa}
                  style={{ width:"100%", fontSize:11, color:LT, background:"transparent",
                    border:`1px dashed ${LN}`, borderRadius:6, padding:"6px", cursor:"pointer", fontFamily:"inherit" }}>
                  + Adicionar etapa
                </button>
              </div>
              {(() => {
                // Total = apenas linhas ativas
                // - Etapas arq: ativas se (sem isolamento) OU (isolada)
                // - Engenharia: ativa se incluiEng && ((sem isolamento) OU (eng isolada))
                const etapasAtivas = etapasPct.filter(e => {
                  if (e.id === 5) return false; // eng vai separado
                  if (!temIsoladas) return true;
                  return idsIsolados.has(e.id);
                });
                const pctAtivo = etapasAtivas.reduce((s,e)=>s+Number(e.pct),0);
                const engAtiva = incluiEng && (!temIsoladas || idsIsolados.has(5));
                const valorAtivo = Math.round((arqCIEdit * pctAtivo / 100 + (engAtiva ? engCIEdit : 0)) * 100) / 100;
                return (
                  <div style={{ display:"grid", gridTemplateColumns:"24px 1fr 60px 60px 110px 22px", gap:6, padding:"8px 4px", borderTop:`1.5px solid ${C}`, marginTop:2, alignItems:"center" }}>
                    <span></span>
                    <span style={{ fontWeight:600, color:C }}>Total</span>
                    <span></span>
                    <span style={{ fontWeight:600, color:C, textAlign:"center" }}>{pctAtivo}%</span>
                    <span style={{ fontSize:15, fontWeight:700, color:C, textAlign:"right" }}>{fmtV(valorAtivo)}</span>
                    <span></span>
                  </div>
                );
              })()}
            </div>
            {mostrarTabelaEtapas ? (
            <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:10, marginBottom:10 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:8 }}>Etapa a Etapa</div>
              <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Antecipado por etapa — desconto</span>
                  <NumInput valor={descEtCtrtLocal} onCommit={n => setDescEtCtrtLocal(n)} decimais={2} min={0} max={100} width={42} />
                  <span style={{ fontSize:11, color:LT }}>%</span>
                </div>
                <span style={{ color:LN }}>·</span>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Parcelado por etapa</span>
                  <NumInput valor={parcEtCtrtLocal} onCommit={n => setParcEtCtrtLocal(Math.max(1, n))} decimais={0} min={1} max={99} width={42} />
                  <span style={{ fontSize:11, color:LT }}>×</span>
                </div>
              </div>
              <OpcoesPagamento tipo="etapaAEtapa" desc={descEtCtrtLocal} parcelas={parcEtCtrtLocal} fmtV={fmtV} />
            </div>
            ) : (
            /* Toggle "Mostrar no PDF" DESLIGADO: espelha pagamento padrão —
               "Apenas Arquitetura" (valor arq selecionada) + "Pacote Completo" se eng ativa */
            <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:10, marginBottom:10 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:8 }}>
                Apenas Arquitetura
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:6 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Antecipado — desconto</span>
                  <NumInput valor={descArqLocal} onCommit={n => setDescArqLocal(n)} decimais={2} min={0} max={100} width={42} />
                  <span style={{ fontSize:11, color:LT }}>%</span>
                </div>
                <span style={{ color:LN }}>·</span>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Parcelado</span>
                  <NumInput valor={parcArqLocal} onCommit={n => setParcArqLocal(Math.max(1, n))} decimais={0} min={1} max={99} width={42} />
                  <span style={{ fontSize:11, color:LT }}>×</span>
                </div>
              </div>
              <OpcoesPagamento tipo="pacote" valor={subTotalArqEtapas} desc={descArqLocal} parcelas={parcArqLocal} fmtV={fmtV} />
            </div>
            )}
            {/* Pacote Completo — sempre aparece quando tem mais de 1 etapa selecionada
                 OU quando eng + arq estão selecionadas (oferece contratação total)
                 Não aparece se só 1 etapa sem eng (pacote = etapa única, não faz sentido) */}
            {(() => {
              const etArqAtivas = etapasPct.filter(e => e.id !== 5 && (!temIsoladas || idsIsolados.has(e.id)));
              const multiEtapas = etArqAtivas.length > 1;
              const temArqEEng = incluiArq && engAtiva && etArqAtivas.length > 0;
              // Pacote Completo só aparece em 2 cenários:
              // 1) Toggle LIGADO + (várias etapas OU arq+eng) — permite contratação total vs etapa a etapa
              // 2) Toggle DESLIGADO + arq+eng ambos ativos — oferece "Apenas Arq" + "Pacote Completo"
              // Quando toggle desligado E sem eng, fica só o bloco único "Apenas Arq" (sem pacote)
              const mostraPacote = mostrarTabelaEtapas
                ? (multiEtapas || temArqEEng)
                : temArqEEng; // toggle off: só mostra pacote se tem arq+eng
              if (!mostraPacote) return null;
              // Label dinâmico
              const labelPacote = (incluiArq && engAtiva)
                ? "Pacote Completo (Arq. + Eng.)"
                : "Pacote Completo";
              return (
                <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:10, marginBottom:10 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:8 }}>{labelPacote}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:6 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:12, color:MD }}>Antecipado — desconto</span>
                      <NumInput valor={descPacCtrtLocal} onCommit={n => setDescPacCtrtLocal(n)} decimais={2} min={0} max={100} width={42} />
                      <span style={{ fontSize:11, color:LT }}>%</span>
                    </div>
                    <span style={{ color:LN }}>·</span>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:12, color:MD }}>Parcelado</span>
                      <NumInput valor={parcPacCtrtLocal} onCommit={n => setParcPacCtrtLocal(Math.max(1, n))} decimais={0} min={1} max={99} width={42} />
                      <span style={{ fontSize:11, color:LT }}>×</span>
                    </div>
                  </div>
                  <OpcoesPagamento tipo="pacote" valor={totalPacoteEtapas} desc={descPacCtrtLocal} parcelas={parcPacCtrtLocal} fmtV={fmtV} />
                </div>
              );
            })()}
          </>)}
          <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:10, fontSize:11, color:LT }}>
            <TextoEditavel valor={pixEdit} onChange={setPixEdit} style={{ fontSize:11, color:LT }} />
          </div>
        </Sec>

        <Sec title="Escopo dos serviços" action={
          <span
            onClick={() => {
              const newId = Date.now();
              setEscopoState(prev => {
                const semEng = prev.filter(b => !b.isEng);
                const eng = prev.filter(b => b.isEng);
                return [...semEng, { etapaId:newId, titulo:"", objetivo:"", itens:[], entregaveis:[], obs:"", isEng:false, custom:true }, ...eng];
              });
            }}
            style={{ fontSize:10, color:LT, cursor:"pointer", padding:"2px 8px", borderRadius:4,
              border:`1px solid ${LN}`, background:"#f3f4f6", whiteSpace:"nowrap", userSelect:"none" }}>+ bloco</span>
        }>
          {escopoDefault.map((bloco, i) => {
            // Separa número (fixo) do texto (editável)
            const numMatch = bloco.tituloNum.match(/^(\d+\.\s*)(.*)$/);
            const numPrefix = numMatch ? numMatch[1] : "";
            const tituloTexto = numMatch ? numMatch[2] : bloco.tituloNum;
            return (
            <div key={bloco.etapaId} style={{ marginBottom:18 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6, gap:8 }}>
                <div style={{ display:"flex", alignItems:"baseline", gap:4, flex:1, minWidth:0 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:C, whiteSpace:"nowrap" }}>{numPrefix}</span>
                  <InputControlado
                    valor={tituloTexto}
                    onCommit={v => setEscopoBloco(bloco.etapaId, "titulo", v)}
                    placeholder="Inserir novo escopo"
                    style={{ flex:1, minWidth:0 }}
                  />
                </div>
                <span
                  onClick={() => setEscopoState(prev => prev.filter(b => b.etapaId !== bloco.etapaId))}
                  title="Remover bloco"
                  style={{ fontSize:11, color:"#d1d5db", cursor:"pointer", padding:"2px 6px", borderRadius:4,
                    border:"1px solid #e5e7eb", background:"#fafafa", lineHeight:1.4,
                    userSelect:"none" }}>✕ remover</span>
              </div>
              {bloco.custom ? (
                // Bloco customizado — totalmente editável
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <div>
                    <div style={tag}>Objetivo</div>
                    <TextareaControlado
                      valor={bloco.objetivo}
                      onCommit={v => setEscopoBloco(bloco.etapaId, "objetivo", v)}
                      placeholder="Descreva o objetivo desta etapa..."
                      minHeight={60}
                    />
                  </div>
                  <div>
                    <div style={tag}>Descrição / Serviços inclusos</div>
                    <TextareaControlado
                      valor={(bloco.itens||[]).join("\n")}
                      onCommit={v => setEscopoBloco(bloco.etapaId, "itens", v.split("\n").filter(s=>s.trim()))}
                      placeholder="Um item por linha..."
                      minHeight={80}
                    />
                    <div style={{ fontSize:11, color:LT, marginTop:3 }}>Um item por linha</div>
                  </div>
                  <div>
                    <div style={tag}>Entregáveis</div>
                    <TextareaControlado
                      valor={(bloco.entregaveis||[]).join("\n")}
                      onCommit={v => setEscopoBloco(bloco.etapaId, "entregaveis", v.split("\n").filter(s=>s.trim()))}
                      placeholder="Um entregável por linha..."
                      minHeight={60}
                    />
                    <div style={{ fontSize:11, color:LT, marginTop:3 }}>Um entregável por linha</div>
                  </div>
                  <div>
                    <div style={tag}>Observação</div>
                    <TextareaControlado
                      valor={bloco.obs}
                      onCommit={v => setEscopoBloco(bloco.etapaId, "obs", v)}
                      placeholder="Observação opcional..."
                      minHeight={40}
                    />
                  </div>
                </div>
              ) : (
                // Bloco fixo — editável inline
                <>
                  {bloco.objetivo !== undefined && <>
                    <div style={tag}>Objetivo</div>
                    <TextoEditavel valor={bloco.objetivo} onChange={v => setEscopoBloco(bloco.etapaId, "objetivo", v)}
                      style={{ fontSize:13, color:MD, lineHeight:1.7, display:"block" }} multiline={true} />
                  </>}
                  {bloco.itens !== undefined && <>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:2 }}>
                      <div style={tag}>Serviços inclusos</div>
                      <span onClick={() => setEscopoBloco(bloco.etapaId, "itens", [...(bloco.itens||[]), "Novo item"])}
                        title="Adicionar item"
                        style={{ fontSize:10, color:LT, cursor:"pointer", padding:"0 4px", borderRadius:3,
                          background:"#f3f4f6", border:"1px solid #c8cdd6", lineHeight:"16px" }}>+ item</span>
                    </div>
                    {(bloco.itens||[]).map((it,j) => (
                      <div key={j} style={{ ...bl, alignItems:"flex-start" }}>
                        <span style={dot}>•</span>
                        <TextoEditavel valor={it} onChange={v => {
                          const arr = [...bloco.itens]; arr[j] = v;
                          setEscopoBloco(bloco.etapaId, "itens", arr);
                        }} style={{ fontSize:13, color:MD, lineHeight:1.6, flex:1 }} />
                        <span onClick={() => setEscopoBloco(bloco.etapaId, "itens", bloco.itens.filter((_,k)=>k!==j))}
                          style={{ fontSize:10, color:"#d1d5db", cursor:"pointer", marginLeft:4, flexShrink:0, paddingTop:2 }}>✕</span>
                      </div>
                    ))}
                  </>}
                  {bloco.entregaveis !== undefined && <>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:2, marginTop:6 }}>
                      <div style={tag}>Entregáveis</div>
                      <span onClick={() => setEscopoBloco(bloco.etapaId, "entregaveis", [...(bloco.entregaveis||[]), "Novo entregável"])}
                        title="Adicionar entregável"
                        style={{ fontSize:10, color:LT, cursor:"pointer", padding:"0 4px", borderRadius:3,
                          background:"#f3f4f6", border:"1px solid #c8cdd6", lineHeight:"16px" }}>+ item</span>
                    </div>
                    {(bloco.entregaveis||[]).map((it,j) => (
                      <div key={j} style={{ ...bl, alignItems:"flex-start" }}>
                        <span style={dot}>•</span>
                        <TextoEditavel valor={it} onChange={v => {
                          const arr = [...bloco.entregaveis]; arr[j] = v;
                          setEscopoBloco(bloco.etapaId, "entregaveis", arr);
                        }} style={{ fontSize:13, color:MD, lineHeight:1.6, flex:1 }} />
                        <span onClick={() => setEscopoBloco(bloco.etapaId, "entregaveis", bloco.entregaveis.filter((_,k)=>k!==j))}
                          style={{ fontSize:10, color:"#d1d5db", cursor:"pointer", marginLeft:4, flexShrink:0, paddingTop:2 }}>✕</span>
                      </div>
                    ))}
                  </>}
                  {bloco.obs !== undefined && <div style={{ fontSize:12, color:LT, marginTop:8, lineHeight:1.6, fontStyle:"italic" }}>
                    <TextoEditavel valor={bloco.obs} onChange={v => setEscopoBloco(bloco.etapaId, "obs", v)}
                      style={{ fontSize:12, color:LT, fontStyle:"italic" }} multiline={true} />
                  </div>}
                </>
              )}
              {i < escopoDefault.length-1 && <div style={{ borderBottom:`0.5px solid ${LN}`, marginTop:14 }} />}
            </div>
            );
          })}

        </Sec>

        <Sec title="Serviços não inclusos">
          <div style={{ columns:"2", columnGap:32, marginBottom:8 }}>
            {(naoInclEdit || naoInclDefault).map((item, i) => (
              <div key={i} style={{ ...bl, breakInside:"avoid", marginBottom:4, alignItems:"flex-start" }}>
                <span style={dot}>•</span>
                <TextoEditavel valor={item.label} onChange={v => {
                  const arr = [...(naoInclEdit || naoInclDefault)];
                  arr[i] = { ...arr[i], label: v };
                  setNaoInclEdit(arr);
                }} style={{ fontSize:13, color:MD, flex:1 }} />
                {item.sub && <span style={{ fontSize:11, color:LT, marginLeft:4 }}>{item.sub}</span>}
                <span onClick={() => setNaoInclEdit((naoInclEdit || naoInclDefault).filter((_,k)=>k!==i))}
                  style={{ fontSize:10, color:"#d1d5db", cursor:"pointer", marginLeft:4, flexShrink:0, paddingTop:2 }}>✕</span>
              </div>
            ))}
          </div>
          <div style={{ marginBottom:8 }}>
            <span onClick={() => setNaoInclEdit([...(naoInclEdit||naoInclDefault), { label:"Novo item", sub:null }])}
              style={{ fontSize:11, color:LT, cursor:"pointer", padding:"2px 8px", borderRadius:4,
                background:"#f3f4f6", border:"1px solid #c8cdd6" }}>+ item</span>
          </div>
          <div style={{ fontSize:12, color:LT, fontStyle:"italic" }}>Todos os serviços não inclusos podem ser contratados como serviços adicionais.</div>
        </Sec>

        <Sec title="Prazo de execução">
          {(prazoEdit || prazoDefault).filter(p => {
              if (p.toLowerCase().includes("engenharia")) {
                if (!engAtiva) return false; // toggle desligado OU eng não isolada
              }
              return true;
            }).map((p, i) => (
            <div key={i} style={{ ...bl, marginBottom:6 }}>
              <span style={dot}>•</span>
              <TextoEditavel valor={p} onChange={v => {
                const arr = [...(prazoEdit || prazoDefault)];
                arr[i] = v;
                setPrazoEdit(arr);
              }} style={{ fontSize:13, color:MD, lineHeight:1.6 }} multiline={true} />
            </div>
          ))}
        </Sec>

        <Sec title="Aceite da proposta">
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:32, marginTop:8 }}>
            <div>
              <div style={{ fontSize:10, fontWeight:600, color:LT, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Cliente</div>
              <div style={{ fontSize:14, fontWeight:600, color:C, marginBottom:32 }}>{clienteNome || "—"}</div>
              <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:6, display:"flex", justifyContent:"space-between", fontSize:11, color:LT }}>
                <span>Assinatura</span><span>Data: _____ / _____ / _______</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:600, color:LT, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Responsável técnico</div>
              <div style={{ fontSize:14, fontWeight:600, color:C, marginBottom:4 }}><TextoEditavel valor={responsavelEdit} onChange={setResponsavelEdit} style={{ fontSize:14, fontWeight:600 }} /></div>
              <div style={{ fontSize:12, color:LT, marginBottom:20 }}><TextoEditavel valor={cauEdit} onChange={setCauEdit} style={{ fontSize:12 }} /></div>
              <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:6, display:"flex", justifyContent:"space-between", fontSize:11, color:LT }}>
                <span>Assinatura</span><span>{dataStr}</span>
              </div>
            </div>
          </div>
        </Sec>

        <div style={{ borderTop:`0.5px solid ${LN}`, marginTop:48, paddingTop:14, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:11, color:LT }}>
            <span>Padovan Arquitetos</span><span>·</span>
            <TextoEditavel valor={emailEdit} onChange={setEmailEdit} style={{ fontSize:11 }} /><span>·</span>
            <TextoEditavel valor={telefoneEdit} onChange={setTelefoneEdit} style={{ fontSize:11 }} /><span>·</span>
            <TextoEditavel valor={instagramEdit} onChange={setInstagramEdit} style={{ fontSize:11 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function FormOrcamentoProjetoTeste({ onSalvar, orcBase, clienteNome, clienteWA, onVoltar, modoVer, modoAbertura }) {
  const [referencia,   setReferencia]   = useState(orcBase?.referencia  || "");
  const [tipoObra,     setTipoObra]     = useState(orcBase?.subtipo     || null);
  const [tipoProjeto,  setTipoProjeto]  = useState(orcBase?.tipo        || null);
  const [padrao,       setPadrao]       = useState(orcBase?.padrao      || null);
  const [tipologia,    setTipologia]    = useState(orcBase?.tipologia   || null);
  const [tamanho,      setTamanho]      = useState(orcBase?.tamanho     || null);
  const [aberto,       setAberto]       = useState(null);
  const [hoverDrop,    setHoverDrop]    = useState(null);
  const [panelPos,     setPanelPos]     = useState({ top:0, left:0 });
  // Abre preview automaticamente quando:
  // - modoVer é true (legado)
  // - modoAbertura === "ver" ou "verProposta" (novo fluxo) E tem orçamento existente
  const temPropostaSalva = orcBase?.propostas && orcBase.propostas.length > 0;
  const abrirDiretoNoPreview = (modoVer || modoAbertura === "ver" || modoAbertura === "verProposta") && orcBase;
  const propostaReadOnlyForce = modoAbertura === "verProposta";
  const [propostaData,  setPropostaData]  = useState(abrirDiretoNoPreview ? {
    tipoProjeto: orcBase.tipo, tipoObra: orcBase.subtipo, padrao: orcBase.padrao,
    tipologia: orcBase.tipologia, tamanho: orcBase.tamanho,
    clienteNome, referencia: orcBase.referencia || "",
    comodos: orcBase.comodos || [],
    calculo: orcBase.resultado || {},
    tipoPgto: orcBase.tipoPgto || "padrao",
    temImposto: orcBase.temImposto || false,
    aliqImp: orcBase.aliqImp || 16,
    descArq: orcBase.descArq || 5, parcArq: orcBase.parcArq || 3,
    descPacote: orcBase.descPacote || 10, parcPacote: orcBase.parcPacote || 4,
    descEtCtrt: orcBase.descEtCtrt || 5, parcEtCtrt: orcBase.parcEtCtrt || 2,
    descPacCtrt: orcBase.descPacCtrt || 15, parcPacCtrt: orcBase.parcPacCtrt || 8,
    etapasPct: orcBase.etapasPct || [],
    totSI: orcBase.totSI || 0, totCI: orcBase.totCI || 0, impostoV: orcBase.impostoV || 0,
    incluiArq: orcBase.incluiArq !== false,
    incluiEng: orcBase.incluiEng !== false,
    incluiMarcenaria: orcBase.incluiMarcenaria || false,
    grupoQtds: orcBase.grupoQtds || null,
    resumoDescritivo: orcBase.resumoDescritivo || "",
  } : null);
  const [tipoPgto,      setTipoPgto]      = useState(orcBase?.tipoPgto    || "padrao");
  const [temImposto,    setTemImposto]    = useState(orcBase?.temImposto  || false);
  const [aliqImp,       setAliqImp]       = useState(orcBase?.aliqImp     || 16);
  const [descArq,       setDescArq]       = useState(orcBase?.descArq     || 5);
  const [parcArq,       setParcArq]       = useState(orcBase?.parcArq     || 3);
  const [descPacote,    setDescPacote]    = useState(orcBase?.descPacote  || 10);
  const [parcPacote,    setParcPacote]    = useState(orcBase?.parcPacote  || 4);
  const [descEtCtrt,    setDescEtCtrt]    = useState(orcBase?.descEtCtrt  || 5);
  const [parcEtCtrt,    setParcEtCtrt]    = useState(orcBase?.parcEtCtrt  || 2);
  const [descPacCtrt,   setDescPacCtrt]   = useState(orcBase?.descPacCtrt || 15);
  const [parcPacCtrt,   setParcPacCtrt]   = useState(orcBase?.parcPacCtrt || 8);
  const [etapasPct, setEtapasPct] = useState(orcBase?.etapasPct || [
    { id:1, nome:"Estudo de Viabilidade",  pct:10 },
    { id:2, nome:"Estudo Preliminar",      pct:40 },
    { id:3, nome:"Aprovação na Prefeitura",pct:12 },
    { id:4, nome:"Projeto Executivo",      pct:38 },
  ]);
  const [qtdRep, setQtdRep] = useState(orcBase?.repeticao ? (orcBase?.nUnidades || 2) : 0);
  const [editandoRep, setEditandoRep] = useState(false);
  const [editandoGrupoQtd, setEditandoGrupoQtd] = useState(null); // guarda o nome do grupo que está com input aberto
  const [etapasIsoladas, setEtapasIsoladas] = useState(new Set(orcBase?.etapasIsoladas || []));
  const [incluiArq,        setIncluiArq]        = useState(orcBase?.incluiArq        !== false);
  const [incluiEng,        setIncluiEng]        = useState(orcBase?.incluiEng        !== false);
  const [incluiMarcenaria, setIncluiMarcenaria] = useState(orcBase?.incluiMarcenaria || false);

  useEffect(() => {
    if (!orcBase) return;
    // Ativa flag para evitar que useEffect de grupoParams sobrescreva durante sincronização
    sincronizandoOrcBase.current = true;
    if (orcBase.referencia  !== undefined) setReferencia(orcBase.referencia || "");
    if (orcBase.subtipo     !== undefined) setTipoObra(orcBase.subtipo);
    if (orcBase.tipo        !== undefined) setTipoProjeto(orcBase.tipo);
    if (orcBase.padrao      !== undefined) setPadrao(orcBase.padrao);
    if (orcBase.tipologia   !== undefined) setTipologia(orcBase.tipologia);
    if (orcBase.tamanho     !== undefined) setTamanho(orcBase.tamanho);
    if (orcBase.comodos)     setQtds(Object.fromEntries(orcBase.comodos.map(c => [c.nome, c.qtd])));
    if (orcBase.repeticao   !== undefined) setQtdRep(orcBase.repeticao ? (orcBase.nUnidades || 2) : 0);
    if (orcBase.tipoPgto    !== undefined) setTipoPgto(orcBase.tipoPgto);
    if (orcBase.temImposto  !== undefined) setTemImposto(orcBase.temImposto);
    if (orcBase.aliqImp     !== undefined) setAliqImp(orcBase.aliqImp);
    if (orcBase.etapasPct   !== undefined) setEtapasPct((orcBase.etapasPct || []).filter(e => e.id !== 5));
    if (orcBase.descArq     !== undefined) setDescArq(orcBase.descArq);
    if (orcBase.parcArq     !== undefined) setParcArq(orcBase.parcArq);
    if (orcBase.descPacote  !== undefined) setDescPacote(orcBase.descPacote);
    if (orcBase.parcPacote  !== undefined) setParcPacote(orcBase.parcPacote);
    if (orcBase.descEtCtrt  !== undefined) setDescEtCtrt(orcBase.descEtCtrt);
    if (orcBase.parcEtCtrt  !== undefined) setParcEtCtrt(orcBase.parcEtCtrt);
    if (orcBase.descPacCtrt !== undefined) setDescPacCtrt(orcBase.descPacCtrt);
    if (orcBase.parcPacCtrt !== undefined) setParcPacCtrt(orcBase.parcPacCtrt);
    if (orcBase.grupoQtds   !== undefined) setGrupoQtds(orcBase.grupoQtds || { "Por Loja":0, "Espaço Âncora":0, "Áreas Comuns":0, "Por Apartamento":0, "Galpao":0 });
    if (orcBase.etapasIsoladas !== undefined) setEtapasIsoladas(new Set(orcBase.etapasIsoladas || []));
    if (orcBase.grupoParams  !== undefined && orcBase.grupoParams) setGrupoParams(orcBase.grupoParams);
    // Desativa flag no próximo tick, após todos os estados terem sido setados
    setTimeout(() => { sincronizandoOrcBase.current = false; }, 0);
  }, [orcBase?.id]);

  const GRUPOS_COMERCIAIS = ["Por Loja","Espaço Âncora","Áreas Comuns","Por Apartamento","Galpao"];
  const [grupoParams, setGrupoParams] = useState(() => {
    const init = {};
    const p  = orcBase?.padrao    || "Médio";
    const ti = orcBase?.tipologia || "Térreo";
    const ta = orcBase?.tamanho   || "Médio";
    GRUPOS_COMERCIAIS.forEach(g => { init[g] = { padrao:p, tipologia:ti, tamanho:ta }; });
    return init;
  });
  const [abertoGrupo, setAbertoGrupo] = useState(null);

  // Ref para evitar que a sincronização do orcBase dispare o useEffect de grupoParams
  const sincronizandoOrcBase = useRef(false);
  // Ref para controlar timeout de fechamento do dropdown por hover
  const hoverCloseRef = useRef(null);

  useEffect(() => {
    if (!padrao && !tipologia && !tamanho) return;
    if (sincronizandoOrcBase.current) return; // não sobrescreve durante carregamento do orcBase
    setGrupoParams(prev => {
      const next = {};
      GRUPOS_COMERCIAIS.forEach(g => {
        next[g] = {
          padrao:   padrao   || prev[g]?.padrao   || "Médio",
          tipologia: tipologia || prev[g]?.tipologia || "Térreo",
          tamanho:  tamanho  || prev[g]?.tamanho  || "Médio",
        };
      });
      return next;
    });
  }, [padrao, tipologia, tamanho]);

  function setGrupoParam(grupo, key, val) {
    setGrupoParams(prev => ({ ...prev, [grupo]: { ...prev[grupo], [key]: val } }));
    setAbertoGrupo(null);
  }
  const isComercial = tipoProjeto === "Conj. Comercial" || tipoProjeto === "Galpão";
  const [grupoQtds, setGrupoQtds] = useState(orcBase?.grupoQtds || {
    "Por Loja": 0, "Espaço Âncora": 0, "Áreas Comuns": 0, "Por Apartamento": 0, "Galpao": 0,
  });

  function setGrupoQtd(grupo, delta) {
    setGrupoQtds(prev => ({ ...prev, [grupo]: Math.max(0, (prev[grupo] || 0) + delta) }));
  }

  function tipoParaConfig(tp) {
    if (tp === "Clínica")          return "Clínica";
    if (tp === "Conj. Comercial")  return "Comercial";
    if (tp === "Galpão")           return "Galpao";
    return tp || "Residencial";
  }

  const configAtual = useMemo(() => {
    if (!tipoProjeto) return null;
    return getComodosConfig(tipoParaConfig(tipoProjeto));
  }, [tipoProjeto]);

  const [qtds, setQtds] = useState(() => {
    if (!orcBase?.comodos) return {};
    return Object.fromEntries(orcBase.comodos.map(c => [c.nome, c.qtd]));
  });

  const isEdicao = useRef(!!orcBase?.comodos?.length);
  useEffect(() => {
    if (isEdicao.current) { isEdicao.current = false; return; }
    setQtds({});
  }, [tipoProjeto]);

  // ── Salvar como rascunho ao voltar ─────────────────────────
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  function temDadosPreenchidos() {
    // Qualquer coisa além do estado inicial conta como "iniciado"
    if (referencia?.trim()) return true;
    if (tipoObra || tipoProjeto || padrao || tipologia || tamanho) return true;
    if (Object.values(qtds).some(q => q > 0)) return true;
    return false;
  }
  function handleVoltar() {
    // Em modo "ver", nunca pergunta — só volta
    if (modoVer) { onVoltar(); return; }
    // Se já existe orcBase (edição), deixa voltar direto sem perguntar
    if (orcBase?.id) { onVoltar(); return; }
    // Novo orçamento: pergunta se tem algo preenchido
    if (temDadosPreenchidos()) {
      setShowSaveDialog(true);
    } else {
      onVoltar();
    }
  }
  async function salvarRascunhoEVoltar() {
    const orcRascunho = {
      ...(orcBase || {}),
      referencia,
      tipo: tipoProjeto, subtipo: tipoObra,
      padrao, tipologia, tamanho,
      comodos: Object.entries(qtds).filter(([,q]) => q > 0).map(([nome, qtd]) => ({ nome, qtd })),
      incluiArq, incluiEng,
      tipoPgto, temImposto, aliqImp,
      descArq, parcArq, descPacote, parcPacote,
      descEtCtrt, parcEtCtrt, descPacCtrt, parcPacCtrt,
      etapasPct,
      rascunho: true,
      status: "rascunho",
    };
    setShowSaveDialog(false);
    if (onSalvar) {
      try { await onSalvar(orcRascunho); } catch(e) { console.error("Erro ao salvar rascunho:", e); }
    }
    onVoltar();
  }

  const wrapRef = useRef(null);
  useEffect(() => {
    if (!aberto && !abertoGrupo) return;
    const h = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setAberto(null);
        setAbertoGrupo(null);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [aberto, abertoGrupo]);

  // Reposiciona o painel dropdown ao fazer scroll/resize (para grudar no botão)
  useEffect(() => {
    if (!aberto) return;
    const reposicionar = () => {
      const btn = document.querySelector(`[data-drop-btn="${aberto}"]`);
      if (btn) {
        const r = btn.getBoundingClientRect();
        setPanelPos({ top: r.bottom + 6, left: r.left });
      }
    };
    // capture: true captura scroll de qualquer elemento descendente
    // (inclui containers internos com overflow:auto)
    document.addEventListener("scroll", reposicionar, true);
    window.addEventListener("resize", reposicionar);
    return () => {
      document.removeEventListener("scroll", reposicionar, true);
      window.removeEventListener("resize", reposicionar);
    };
  }, [aberto]);

  const OPCOES = {
    tipoObra:    ["Construção nova", "Reforma"],
    tipoProjeto: ["Residencial", "Clínica", "Conj. Comercial", "Galpão", "Empreendimento"],
    padrao:      ["Alto", "Médio", "Baixo"],
    tipologia:   ["Térreo", "Sobrado"],
    tamanho:     ["Grande", "Médio", "Pequeno", "Compacta"],
  };

  // Mapa de display: valor interno → label exibido APENAS após seleção (no fluxo horizontal).
  // Na lista de opções do dropdown, o valor interno é mantido ("Alto", "Médio", "Baixo").
  // Preserva compatibilidade com orçamentos salvos no DB que usam valores internos.
  const DISPLAY_OPCAO = {
    padrao: { "Alto":"Alto Padrão", "Médio":"Médio Padrão", "Baixo":"Baixo Padrão" },
  };
  const displayOpcao = (key, val) => (DISPLAY_OPCAO[key] && DISPLAY_OPCAO[key][val]) || val;

  const VALS   = { tipoObra, tipoProjeto, padrao, tipologia, tamanho };
  const LABELS = { tipoObra:"Tipo Obra", tipoProjeto:"Tipo Projeto", padrao:"Padrão", tipologia:"Tipologia", tamanho:"Tamanho" };
  const SETS   = { tipoObra:setTipoObra, tipoProjeto:setTipoProjeto, padrao:setPadrao, tipologia:setTipologia, tamanho:setTamanho };

  function selecionar(key, val) { SETS[key](val); setAberto(null); setHoverDrop(null); }

  const grupoDeComodo = useMemo(() => {
    const map = {};
    if (configAtual?.grupos) {
      Object.entries(configAtual.grupos).forEach(([grupo, nomes]) => {
        nomes.forEach(nome => { map[nome] = grupo; });
      });
    }
    return map;
  }, [configAtual]);

  const calculo = useMemo(() => {
    if (!configAtual) return null;
    if (!isComercial && (!tamanho || !padrao)) return null;
    const { comodos: COMODOS_USE } = configAtual;
    const tcfg = getTipoConfig(tipoParaConfig(tipoProjeto));
    const pb = tcfg.precoBase;

    if (isComercial) {
      const nomesLoja   = Object.keys(COMODOS_GALERIA_LOJA);
      const nomesAncora = Object.keys(COMODOS_GALERIA_ANCORA);
      const nomesComum  = Object.keys(COMODOS_GALERIA_COMUM);
      const nomesApto   = Object.keys(COMODOS_GALERIA_APTO);
      const nomesGalpao = Object.keys(COMODOS_GALPAO);

      const nLojas   = grupoQtds["Por Loja"]        || 0;
      const nAncoras = grupoQtds["Espaço Âncora"]   || 0;
      const nComum   = grupoQtds["Áreas Comuns"]    || 0;
      const nAptos   = grupoQtds["Por Apartamento"] || 0;
      const nGalpoes = grupoQtds["Galpao"]           || 0;

      const gpLoja   = grupoParams["Por Loja"]        || {};
      const gpAnc    = grupoParams["Espaço Âncora"]   || {};
      const gpComum  = grupoParams["Áreas Comuns"]    || {};
      const gpApto   = grupoParams["Por Apartamento"] || {};
      const gpGalpao = grupoParams["Galpao"]           || {};

      const tamLoja   = gpLoja.tamanho   || tamanho;
      const tamAnc    = gpAnc.tamanho    || tamanho;
      const tamComum  = gpComum.tamanho  || tamanho;
      const tamApto   = gpApto.tamanho   || tamanho;
      const tamGalpao = gpGalpao.tamanho || tamanho;

      const ipLoja   = INDICE_PADRAO[gpLoja.padrao   || padrao] || 0;
      const ipAnc    = INDICE_PADRAO[gpAnc.padrao    || padrao] || 0;
      const ipComum  = INDICE_PADRAO[gpComum.padrao  || padrao] || 0;
      const ipApto   = INDICE_PADRAO[gpApto.padrao   || padrao] || 0;
      const ipGalpao = INDICE_PADRAO[gpGalpao.padrao || padrao] || 0;

      const calcBloco = (nomes, tam, ip) => {
        let ab = 0, ic = 0;
        nomes.forEach(nome => {
          const cfg2 = COMODOS_USE[nome]; if (!cfg2) return;
          const qtd2 = qtds[nome] || 0;
          if (qtd2 <= 0) return;
          const [L, W_] = cfg2.medidas[tam] || [0,0];
          ab += L * W_ * qtd2;
          ic += (cfg2.indice || 0) * qtd2;
        });
        return { ab, ic, fator: ic + ip + 1 };
      };

      const bLoja   = calcBloco(nomesLoja,   tamLoja,   ipLoja);
      const bAnc    = calcBloco(nomesAncora,  tamAnc,    ipAnc);
      const bComum  = calcBloco(nomesComum,   tamComum,  ipComum);
      const bApto   = calcBloco(nomesApto,    tamApto,   ipApto);
      const bGalpao = calcBloco(nomesGalpao,  tamGalpao, ipGalpao);

      const atLoja1   = bLoja.ab   * (1 + ACRESCIMO_AREA);
      const atAnc1    = bAnc.ab    * (1 + ACRESCIMO_AREA);
      const atComum   = bComum.ab  * (1 + ACRESCIMO_AREA);
      const atApto1   = bApto.ab   * (1 + ACRESCIMO_AREA);
      const atGalpao1 = bGalpao.ab * (1 + 0.10);

      const calcFaixas = (area, fator, isAnc=false) => {
        const faixasDef = isAnc
          ? [{ate:300,d:0},{ate:500,d:.30},{ate:700,d:.35},{ate:1000,d:.40},{ate:Infinity,d:.45}]
          : [{ate:200,d:0},{ate:300,d:.30},{ate:400,d:.35},{ate:500,d:.40},{ate:600,d:.45},{ate:Infinity,d:.50}];
        let total=0, rest=area, acum=0;
        for (const f of faixasDef) {
          if (rest<=0) break;
          const chunk = Math.min(rest, f.ate-acum);
          total += pb * chunk * fator * (1-f.d);
          rest -= chunk; acum = f.ate;
        }
        return Math.round(total*100)/100;
      };

      const calcRep = (precoUni, area1, n) => {
        let total=precoUni, acum=area1;
        for (let i=2; i<=n; i++) {
          acum += area1;
          const pct2 = acum<1000?0.25:acum<2000?0.20:0.15;
          total += precoUni*pct2;
        }
        return Math.round(total*100)/100;
      };

      const p1Loja   = atLoja1  >0 ? calcFaixas(atLoja1,  bLoja.fator)       : 0;
      const p1Anc    = atAnc1   >0 ? calcFaixas(atAnc1,   bAnc.fator,  true) : 0;
      const p1Comum  =               calcFaixas(atComum,  bComum.fator);
      const p1Apto   = atApto1  >0 ? calcFaixas(atApto1,  bApto.fator)       : 0;
      const p1Galpao = atGalpao1>0 ? calcFaixas(atGalpao1,bGalpao.fator)     : 0;

      const pLojas   = nLojas  >0&&atLoja1  >0 ? calcRep(p1Loja,   atLoja1,   nLojas)   : 0;
      const pAncoras = nAncoras>0&&atAnc1   >0 ? calcRep(p1Anc,    atAnc1,    nAncoras) : 0;
      const pAptos   = nAptos  >0&&atApto1  >0 ? calcRep(p1Apto,   atApto1,   nAptos)   : 0;
      const pGalpoes = nGalpoes>0&&atGalpao1>0 ? calcRep(p1Galpao, atGalpao1, nGalpoes) : 0;

      const precoSemFach = pLojas+pAncoras+p1Comum+pAptos+pGalpoes;
      const precoArq1 = Math.round((precoSemFach*(1+INDICE_FACHADA_GALERIA))*100)/100;
      const areaTot   = atLoja1*nLojas + atAnc1*nAncoras + atComum + atApto1*nAptos + atGalpao1*nGalpoes;
      const engCalc   = calcularEngenharia(areaTot);
      const precoEng1 = Math.round(engCalc.totalEng*100)/100;
      const nRep=1, pctRep=0.25;
      const unidades=[{und:1,arq:precoArq1,eng:precoEng1}];
      const precoFachada = Math.round((pLojas+pAncoras+p1Comum+pAptos+pGalpoes)*INDICE_FACHADA_GALERIA*100)/100;
      const blocosCom = [
        nLojas   >0&&atLoja1  >0 ? {label:"Loja",         n:nLojas,   area1:atLoja1,   precoUni:p1Loja,   precoTot:pLojas}   : null,
        nAncoras >0&&atAnc1   >0 ? {label:"Âncora",       n:nAncoras, area1:atAnc1,    precoUni:p1Anc,    precoTot:pAncoras} : null,
        atComum  >0              ? {label:"Área Comum",    n:1,        area1:atComum,   precoUni:p1Comum,  precoTot:p1Comum}  : null,
        nAptos   >0&&atApto1  >0 ? {label:"Apartamento",  n:nAptos,   area1:atApto1,   precoUni:p1Apto,   precoTot:pAptos}   : null,
        nGalpoes >0&&atGalpao1>0 ? {label:"Galpão",       n:nGalpoes, area1:atGalpao1, precoUni:p1Galpao, precoTot:pGalpoes} : null,
      ].filter(Boolean);
      return {
        isComercial: true,
        areaBruta: bLoja.ab*nLojas+bAnc.ab*nAncoras+bComum.ab+bApto.ab*nAptos+bGalpao.ab*nGalpoes,
        areaPiscina:0, areaTotal:areaTot, areaTot,
        precoArq1, precoArq:precoArq1, precoEng1, precoEng:precoEng1,
        precoM2Arq: areaTot>0?Math.round(precoArq1/areaTot*100)/100:0,
        precoM2Eng: areaTot>0?Math.round(precoEng1/areaTot*100)/100:0,
        nRep, pctRep, unidades,
        indiceComodos:0, indicePadrao:0, fatorMult:1, precoBaseVal:pb, precoM2Ef:pb,
        faixasArqDet:[], faixasEng:engCalc.faixas, totalAmbientes:0, acrescimoCirk:ACRESCIMO_AREA,
        blocosCom, precoFachada,
      };
    }

    let areaBruta = 0, areaPiscina = 0;
    Object.entries(qtds).forEach(([nome, qtd]) => {
      if (!qtd || qtd <= 0) return;
      const cfg = COMODOS_USE[nome];
      if (!cfg) return;
      const [L, W_] = cfg.medidas[tamanho] || [0, 0];
      const area = L * W_ * qtd;
      if (nome === "Piscina") areaPiscina += area;
      else areaBruta += area;
    });

    const areaTotal = Math.round((areaBruta + areaPiscina) * (1 + tcfg.acrescimoCirk) * 100) / 100;
    if (areaTotal === 0) return null;

    const indiceComodos = (() => {
      let idx = 0;
      Object.entries(qtds).forEach(([nome, qtd]) => {
        if (!qtd || qtd <= 0) return;
        const cfg = COMODOS_USE[nome];
        if (cfg) idx += (cfg.indice || 0) * qtd;
      });
      return Math.round(idx * 1000) / 1000;
    })();
    const indicePadrao = INDICE_PADRAO[padrao] || 0;
    const fatorMult    = Math.round((1 + indiceComodos + indicePadrao) * 1000) / 1000;
    const precoBaseVal = pb;
    const precoM2Ef    = pb * fatorMult;

    function calcArqFaixas(area) {
      let acum = 0, total = 0, rest = area;
      for (const f of tcfg.faixasDesconto) {
        const chunk = Math.min(rest, f.ate - acum);
        if (chunk <= 0) break;
        total += chunk * precoM2Ef * (1 - f.desconto);
        rest -= chunk; acum += chunk;
        if (rest <= 0) break;
      }
      return Math.round(total * 100) / 100;
    }
    const faixasArqDet = (() => {
      let acum = 0, rest = areaTotal;
      const det = [];
      for (const f of tcfg.faixasDesconto) {
        const chunk = Math.min(rest, f.ate - acum);
        if (chunk <= 0) break;
        const pm2 = precoM2Ef * (1 - f.desconto);
        det.push({ de: acum, ate: acum + chunk, area: chunk, desconto: f.desconto, precoM2: pm2, preco: Math.round(chunk * pm2 * 100) / 100 });
        rest -= chunk; acum += chunk;
        if (rest <= 0) break;
      }
      return det;
    })();
    const totalAmbientes = Object.entries(qtds).filter(([,q])=>q>0).reduce((s,[,q])=>s+q,0);

    const precoArq1 = calcArqFaixas(areaTotal);
    const engCalc   = calcularEngenharia(areaTotal);
    const precoEng1 = Math.round(engCalc.totalEng * 100) / 100;

    const nRep   = qtdRep > 1 ? qtdRep : 1;
    const pctRep = 0.25;
    const unidades = [{ und: 1, arq: precoArq1, eng: precoEng1 }];
    for (let i = 2; i <= nRep; i++) {
      unidades.push({
        und: i,
        arq: Math.round(precoArq1 * pctRep * 100) / 100,
        eng: Math.round(precoEng1 * pctRep * 100) / 100,
      });
    }
    const precoArq = Math.round(unidades.reduce((s, u) => s + u.arq, 0) * 100) / 100;
    const precoEng = Math.round(unidades.reduce((s, u) => s + u.eng, 0) * 100) / 100;
    const areaTot  = areaTotal * nRep;

    return {
      areaBruta: Math.round(areaBruta * 100) / 100,
      areaPiscina: Math.round(areaPiscina * 100) / 100,
      areaTotal, areaTot,
      precoArq1, precoArq,
      precoEng1, precoEng,
      precoM2Arq: areaTot > 0 ? Math.round(precoArq / areaTot * 100) / 100 : 0,
      precoM2Eng: areaTot > 0 ? Math.round(precoEng / areaTot * 100) / 100 : 0,
      nRep, pctRep, unidades,
      indiceComodos, indicePadrao, fatorMult,
      precoBaseVal, precoM2Ef,
      faixasArqDet, faixasEng: engCalc.faixas,
      totalAmbientes,
      acrescimoCirk: tcfg.acrescimoCirk,
      labelCirk: tcfg.labelCirk || String(Math.round(tcfg.acrescimoCirk*100)),
    };
  }, [qtds, tamanho, padrao, tipoProjeto, configAtual, qtdRep, grupoQtds, isComercial, grupoParams, grupoDeComodo]);

  const temComodos = isComercial
    ? Object.entries(grupoQtds).some(([g, gq]) => gq > 0 && Object.keys(qtds).some(nome => grupoDeComodo[nome] === g && (qtds[nome]||0) > 0))
    : Object.values(qtds).some(q => q > 0);

  useEffect(() => {
    if (document.getElementById("slide-up-style")) return;
    const s = document.createElement("style");
    s.id = "slide-up-style";
    s.textContent = `
      @keyframes slideUp { from { opacity:0; transform:translateY(32px); } to { opacity:1; transform:translateY(0); } }
      @keyframes surgeHoriz { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:translateX(0); } }
      input.no-spin::-webkit-outer-spin-button,
      input.no-spin::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      input.no-spin { -moz-appearance: textfield; }
      .comodo-escolhido:hover { color: #dc2626 !important; text-decoration: line-through; text-decoration-color: #dc2626; }
      .comodo-escolhido:hover .comodo-m2 { color: #dc2626 !important; }
      .comodo-escolhido:hover strong { color: #dc2626 !important; }
    `;
    document.head.appendChild(s);
  }, []);

  const C = {
    wrap:       { fontFamily:"inherit", color:"#111", background:"#fff", padding:"24px 28px", position:"relative", maxWidth:1200, margin:"0 auto" },
    fieldBox:   { background:"#f5f5f5", border:"1px solid #333", borderRadius:10, padding:"12px 16px", fontSize:14, color:"#6b7280" },
    fieldLabel: { fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1, marginBottom:6, display:"block" },
    input:      { width:"100%", border:"1px solid #333", borderRadius:10, padding:"12px 16px", fontSize:14, color:"#111", outline:"none", background:"#fff", boxSizing:"border-box", fontFamily:"inherit" },
    dropWrap:   { position:"relative", display:"flex", flexDirection:"column", alignItems:"center", gap:6 },
    dropLbl:    { fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1.2, textAlign:"center" },
    dropBtn:    (open, hasVal) => ({ display:"flex", alignItems:"center", gap:6, background: hasVal&&!open?"#fff":"#fff", border:`1px solid ${open?"#111": hasVal?"#c0c5cf":"#333"}`, borderRadius:10, padding:"9px 14px", fontSize:11, color: null, cursor:"pointer", fontFamily:"inherit", minWidth:110, userSelect:"none", WebkitUserSelect:"none" }),
    dropBtnTxt: (val) => ({ flex:1, textAlign:"center", color: val ? "#111" : "#828a98" }),
    chevron:    (open) => ({ transition:"transform 0.15s", transform: open ? "rotate(180deg)" : "none", display:"flex", alignItems:"center" }),
    dropPanel:  { position:"fixed", zIndex:9999, background:"#fff", border:"1px solid #333", borderRadius:10, boxShadow:"0 4px 16px rgba(0,0,0,0.12)", minWidth:160, overflow:"hidden" },
    dropItem:   (sel) => ({ padding:"10px 16px", fontSize:14, cursor:"pointer", color:"#374151", background: sel ? "#eceef2" : "#fff", fontWeight: sel ? 600 : 400 }),
    groupHdr:   { fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1.2, textAlign:"center", marginBottom:12 },
    sep:        { width:1, background:"#c8cdd6", alignSelf:"stretch", marginTop:22 },
    btnDefinir: { width:"100%", maxWidth:380, background:"#111", border:"1px solid #111", borderRadius:10, padding:"13px 0", fontSize:14, fontWeight:700, color:"#fff", cursor:"pointer", fontFamily:"inherit", textAlign:"center", display:"block", margin:"0 auto" },
    aviso:      { fontSize:12, color:"#ef4444", textAlign:"center", marginTop:8 },
    comodoGrupoHdr: { fontSize:10, color:"#555e6b", textTransform:"uppercase", letterSpacing:1, marginBottom:8, marginTop:20, background:"#f0f1f4", border:"1px solid #b8bec8", borderRadius:6, padding:"6px 10px", display:"inline-block" },
    comodoRow:  (ativo) => ({ display:"flex", alignItems:"center", gap:4, padding:"3px 0", borderBottom:"1px solid #c8cdd6", opacity: ativo ? 1 : 0.55 }),
    comodoNome: { flex:1, fontSize:14, color:"#374151" },
    comodoM2:   { fontSize:12, color:"#828a98", width:70, textAlign:"right", whiteSpace:"nowrap" },
    qtdWrap:    { display:"flex", alignItems:"center", gap:8 },
    qtdBtn:     { width:26, height:26, borderRadius:6, border:"1px solid #888", background:"#fff", color:"#374151", fontSize:16, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 },
    qtdNum:     (q) => ({ width:24, textAlign:"center", fontSize:14, fontWeight: q > 0 ? 700 : 400, color: q > 0 ? "#111" : "#828a98" }),
    qtdM2Tot:   { fontSize:12, color:"#6b7280", width:72, textAlign:"right", whiteSpace:"nowrap" },
    resumoBox:  { background:"#fff", border:"1px solid #333", borderRadius:12, padding:"20px 20px" },
    resumoHdr:  { fontSize:10, color:"#555e6b", textTransform:"uppercase", letterSpacing:1.2, textAlign:"center", marginBottom:16, paddingBottom:12, borderBottom:"1px solid #b8bec8" },
    resumoSec:  { fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:1, marginBottom:6, marginTop:14 },
    resumoVal:  { fontSize:18, fontWeight:700, color:"#111" },
    resumoM2:   { fontSize:12, color:"#828a98", marginTop:2 },
    resumoLinha:{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginTop:4 },
    resumoArea: { background:"#f0f1f4", border:"1px solid #c0c5cf", borderRadius:8, padding:"10px 14px", marginBottom:10, fontSize:13, color:"#374151" },
  };

  function renderStep(id) {
    const open = aberto === id;
    const val  = VALS[id];
    const lbl  = LABELS[id];
    const btnRef = { current: null };
    const hovered = hoverDrop === id;
    const ativo = open || hovered;
    return (
      <div style={{ position:"relative" }} key={id}>
        <button
          ref={el => { btnRef.current = el; }}
          data-drop-btn={id}
          onMouseEnter={(e) => {
            // Cancela qualquer fechamento pendente
            if (hoverCloseRef.current) { clearTimeout(hoverCloseRef.current); hoverCloseRef.current = null; }
            setHoverDrop(id);
            // Abre o dropdown automaticamente no hover
            if (!open) {
              const r = e.currentTarget.getBoundingClientRect();
              setPanelPos({ top: r.bottom + 6, left: r.left });
              setAberto(id);
            }
          }}
          onMouseLeave={() => {
            // Fecha com pequeno delay pra permitir mover o mouse pro painel
            if (hoverCloseRef.current) clearTimeout(hoverCloseRef.current);
            hoverCloseRef.current = setTimeout(() => {
              setHoverDrop(null);
              setAberto(null);
            }, 120);
          }}
          style={{
            ...C.dropBtn(open, !!val),
            background: ativo ? "#eceef2" : (val ? "#f4f5f7" : "#fff"),
          }}
          onClick={(e) => {
            // Tira o focus pra evitar highlight azul ao clicar
            e.currentTarget.blur();
            if (open) { setAberto(null); return; }
            const r = e.currentTarget.getBoundingClientRect();
            setPanelPos({ top: r.bottom + 6, left: r.left });
            setAberto(id);
          }}>
          <span style={C.dropBtnTxt(val)}>
            {val
              ? <><span style={{ color:"#828a98", fontWeight:400 }}>{lbl}: </span><span style={{ fontWeight:600, color:"#111" }}>{val}</span></>
              : <span style={{ color:"#828a98" }}>{lbl}</span>
            }
          </span>
          <span style={C.chevron(open)}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" stroke="#828a98" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </button>
      </div>
    );
  }

  // Renderiza um valor já escolhido como texto editável — hover reabre dropdown
  function renderValor(id) {
    const open = aberto === id;
    const val  = VALS[id];
    if (!val) return null;
    const hovered = hoverDrop === id;
    const ativo = open || hovered;
    return (
      <div style={{ position:"relative" }} key={id+"-valor"}>
        <span
          data-drop-btn={id}
          onMouseEnter={(e) => {
            if (hoverCloseRef.current) { clearTimeout(hoverCloseRef.current); hoverCloseRef.current = null; }
            setHoverDrop(id);
            if (!open) {
              const r = e.currentTarget.getBoundingClientRect();
              setPanelPos({ top: r.bottom + 6, left: r.left });
              setAberto(id);
            }
          }}
          onMouseLeave={() => {
            if (hoverCloseRef.current) clearTimeout(hoverCloseRef.current);
            hoverCloseRef.current = setTimeout(() => {
              setHoverDrop(null);
              setAberto(null);
            }, 120);
          }}
          onClick={(e) => {
            if (open) { setAberto(null); return; }
            const r = e.currentTarget.getBoundingClientRect();
            setPanelPos({ top: r.bottom + 6, left: r.left });
            setAberto(id);
          }}
          style={{
            display:"inline-block",
            fontSize:14, color:"#111", fontWeight:500,
            cursor:"pointer", userSelect:"none", WebkitUserSelect:"none",
            padding:"4px 10px", borderRadius:6,
            background: ativo ? "#eceef2" : "transparent",
            borderBottom: ativo ? "1px solid #c8cdd6" : "1px solid transparent",
            transition: "background 0.2s ease, border-color 0.2s ease",
            animation: "surgeHoriz 0.35s ease both",
          }}>
          {displayOpcao(id, val)}
        </span>
      </div>
    );
  }

  const GRUPO_DISPLAY = {
    "Por Loja":        "Loja",
    "Espaço Âncora":   "Espaço Âncora",
    "Áreas Comuns":    "Área Comum",
    "Por Apartamento": "Apartamento",
    "Galpao":          "Galpão",
  };

  const [gruposAbertos, setGruposAbertos] = useState({});
  // Cômodo com popup visível (via hover OU via click no input)
  const [comodoAberto, setComodoAberto] = useState(null);
  // Quando true, o popup está "travado" pelo clique no input:
  // - mouseLeave não fecha
  // - hover em outros cômodos é ignorado
  const [travado, setTravado] = useState(false);
  const comodoCloseRef = useRef(null);
  // Rastreia última posição do mouse para reabrir popup após a lista reorganizar
  const mousePosRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const tracker = (e) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; };
    document.addEventListener("mousemove", tracker, { passive: true });
    return () => document.removeEventListener("mousemove", tracker);
  }, []);

  // Hover: passou em cima
  function abrirComodo(nome) {
    if (travado) return; // travado → ignora hover
    if (comodoCloseRef.current) { clearTimeout(comodoCloseRef.current); comodoCloseRef.current = null; }
    setComodoAberto(nome);
  }
  // Hover: saiu
  function agendarFecharComodo() {
    if (travado) return; // travado → não fecha
    if (comodoCloseRef.current) clearTimeout(comodoCloseRef.current);
    comodoCloseRef.current = setTimeout(() => setComodoAberto(null), 80);
  }

  // Após qtds mudar (cômodo selecionado → lista reorganiza), o browser não dispara
  // mouseenter/leave porque o cursor não se moveu. Detecta qual cômodo está sob o
  // cursor via elementFromPoint e abre ele. Usa requestAnimationFrame pra rodar
  // após o React commitar o DOM reorganizado.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (travado) return;
      const { x, y } = mousePosRef.current;
      if (x === 0 && y === 0) return;
      const el = document.elementFromPoint(x, y);
      if (!el) return;
      const wrap = el.closest && el.closest("[data-comodo-wrap]");
      const nome = wrap ? wrap.getAttribute("data-comodo-nome") : null;
      if (nome) {
        if (comodoCloseRef.current) { clearTimeout(comodoCloseRef.current); comodoCloseRef.current = null; }
        setComodoAberto(nome);
      } else {
        setComodoAberto(null);
      }
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qtds]);

  // Listener global: mousedown em qualquer lugar enquanto travado
  useEffect(() => {
    if (!travado) return;
    const handler = (e) => {
      // Clique dentro do próprio cômodo travado (input, números, ✕) → deixa o onClick deles decidir
      const wrap = e.target.closest && e.target.closest("[data-comodo-wrap]");
      const nomeClicado = wrap ? wrap.getAttribute("data-comodo-nome") : null;
      if (nomeClicado && nomeClicado === comodoAberto) return;

      // Clicou fora do cômodo travado → aplica valor digitado (se houver) e destrava
      const inputAtivo = document.activeElement;
      if (inputAtivo && inputAtivo.tagName === "INPUT" && comodoAberto) {
        const v = parseInt(inputAtivo.value) || 0;
        const qAtual = qtds[comodoAberto] || 0;
        if (v > 0 && v !== qAtual) setQtdAbs(comodoAberto, v);
      }

      setTravado(false);
      if (nomeClicado) {
        // Se caiu em outro cômodo, abre ele imediatamente
        setComodoAberto(nomeClicado);
      } else {
        setComodoAberto(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [travado, comodoAberto, qtds]);

  function toggleGrupo(grupo) {
    setGruposAbertos(prev => ({ ...prev, [grupo]: prev[grupo] === false ? true : false }));
  }
  function isGrupoAberto(grupo) { return gruposAbertos[grupo] !== false; }

  function setQtd(nome, delta) {
    setQtds(prev => ({ ...prev, [nome]: Math.max(0, (prev[nome] || 0) + delta) }));
  }

  // Define quantidade absoluta (não delta) — usado no hover com atalhos 1-6 e input livre
  function setQtdAbs(nome, val) {
    const v = Math.max(0, parseInt(val) || 0);
    setQtds(prev => {
      const next = { ...prev };
      if (v === 0) delete next[nome]; else next[nome] = v;
      return next;
    });
  }

  function getArea(nome) {
    if (!configAtual) return 0;
    const cfg = configAtual.comodos[nome];
    if (!cfg) return 0;
    const grupo = grupoDeComodo[nome];
    const tam = isComercial && grupo && grupoParams[grupo] ? grupoParams[grupo].tamanho : tamanho;
    if (!tam) return 0;
    const [L, W] = cfg.medidas[tam] || [0, 0];
    return L * W;
  }

  const fmtNum = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });

  const modalTotSI   = calculo ? Math.round(((incluiArq?calculo.precoArq:0) + (incluiEng?calculo.precoEng:0))*100)/100 : 0;
  const modalTotCI   = temImposto && modalTotSI > 0 ? Math.round(modalTotSI/(1-aliqImp/100)*100)/100 : modalTotSI;
  const modalImposto = temImposto ? Math.round((modalTotCI - modalTotSI)*100)/100 : 0;

  // Geração da proposta (antes estava no onClick do modal, agora extraída)
  function gerarProposta() {
    if (!calculo) return;
    const resumoDescritivo = (() => {
      const fmtN2 = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
      const fmtArea = v => v > 0 ? fmtN2(v)+"m²" : null;
      // Prefixo "Construção nova de" ou "Reforma de"
      const tipoObraLower = (tipoObra || "").toLowerCase();
      const prefixo = tipoObraLower.includes("reforma") ? "Reforma de " : "Construção nova de ";
      // Helper: minúscula na primeira letra (para encaixar após "de ")
      const toLowerFirst = s => s.length > 0 ? s.charAt(0).toLowerCase() + s.slice(1) : s;
      if (isComercial && calculo?.isComercial) {
        const c = calculo;
        const partes = [];
        const nL = grupoQtds["Por Loja"]||0, nA = grupoQtds["Espaço Âncora"]||0;
        const nAp = grupoQtds["Por Apartamento"]||0, nG = grupoQtds["Galpao"]||0;
        if (nL>0 && c.blocosCom) { const b=c.blocosCom.find(x=>x.label==="Loja"); if(b) partes.push(`${nL} loja${nL!==1?"s":""} (${fmtArea(b.area1*nL)})`); }
        if (nA>0 && c.blocosCom) { const b=c.blocosCom.find(x=>x.label==="Âncora"); if(b) partes.push(`${nA} ${nA===1?"Espaço Âncora":"Espaços Âncoras"} (${fmtArea(b.area1*nA)})`); }
        if (nAp>0 && c.blocosCom) { const b=c.blocosCom.find(x=>x.label==="Apartamento"); if(b) partes.push(`${nAp} apartamento${nAp!==1?"s":""} (${fmtArea(b.area1*nAp)})`); }
        if (nG>0 && c.blocosCom) { const b=c.blocosCom.find(x=>x.label==="Galpão"); if(b) partes.push(`${nG} ${nG!==1?"galpões":"galpão"} (${fmtArea(b.area1*nG)})`); }
        if (c.blocosCom) { const bc=c.blocosCom.find(x=>x.label==="Área Comum"); if(bc) partes.push(`Área Comum (${fmtArea(bc.area1)})`); }
        const lista = partes.length>1 ? partes.slice(0,-1).join(", ")+" e "+partes[partes.length-1] : partes[0]||"";
        return `${prefixo}conjunto comercial, contendo ${lista}, totalizando ${fmtArea(c.areaTot||c.areaTotal)}.`;
      }
      const nUnid = calculo?.nRep || 1;
      const areaUni = calculo?.areaTotal || calculo?.areaTot || 0;
      const areaTotR = Math.round(areaUni * nUnid * 100)/100;
      const totalAmb = Object.entries(qtds).filter(([,q])=>q>0).reduce((s,[,q])=>s+q,0);
      // Usa formatComodo top-level (helpers PLURAIS_IRREG, GENERO_AMB, NUM_EXT_*)
      const itensFmt = Object.entries(qtds).filter(([,q])=>q>0).map(([nome,q]) => formatComodo(nome, q));
      const listaStr = itensFmt.length>1 ? itensFmt.slice(0,-1).join(", ")+" e "+itensFmt[itensFmt.length-1] : itensFmt[0]||"";
      const tipDesc = (tipologia||"").toLowerCase().includes("sobrado") ? "com dois pavimentos" : "térrea";
      if (nUnid>1) {
        const nExt = nUnid>=1&&nUnid<=10 ? NUM_EXT_FEM[nUnid] : String(nUnid);
        return `${prefixo}${nExt} residências ${tipDesc} idênticas, com ${fmtN2(areaUni)}m² por unidade, totalizando ${fmtN2(areaTotR)}m² de área construída. Cada unidade composta por ${totalAmb} ambientes: ${listaStr}.`;
      }
      return `${prefixo}uma residência ${tipDesc}, com ${fmtN2(areaUni)}m² de área construída, composta por ${totalAmb} ambientes: ${listaStr}.`;
    })();
    setPropostaData({
      tipoProjeto, tipoObra, padrao, tipologia, tamanho,
      clienteNome, referencia,
      comodos: Object.entries(qtds).filter(([,q])=>q>0).map(([nome,qtd])=>({nome,qtd})),
      resumoDescritivo,
      grupoQtds: isComercial ? grupoQtds : null,
      calculo,
      incluiArq, incluiEng, incluiMarcenaria,
      etapasIsoladas: Array.from(etapasIsoladas),
      tipoPgto, temImposto, aliqImp,
      descArq, parcArq, descPacote, parcPacote,
      descEtCtrt, parcEtCtrt, descPacCtrt, parcPacCtrt,
      etapasPct,
      totSI: modalTotSI, totCI: modalTotCI, impostoV: modalImposto,
    });
    const orcParaSalvar = {
      ...(orcBase || {}),
      tipo: tipoProjeto, subtipo: tipoObra, tipologia, tamanho, padrao,
      cliente: clienteNome, referencia,
      comodos: Object.entries(qtds).filter(([,q])=>q>0).map(([nome,qtd])=>({nome,qtd})),
      repeticao: qtdRep > 0, nUnidades: qtdRep > 0 ? qtdRep : 1,
      grupoQtds: isComercial ? grupoQtds : null,
      grupoParams: isComercial ? grupoParams : null,
      incluiArq, incluiEng, incluiMarcenaria,
      etapasIsoladas: Array.from(etapasIsoladas),
      resultado: { ...calculo, precoArq: calculo?.precoArq || 0, precoEng: calculo?.precoEng || 0, areaTotal: calculo?.areaTotal || 0 },
      tipoPgto, temImposto, aliqImp,
      descArq, parcArq, descPacote, parcPacote,
      descEtCtrt, parcEtCtrt, descPacCtrt, parcPacCtrt,
      etapasPct,
      totSI: modalTotSI, totCI: modalTotCI, impostoV: modalImposto,
    };
    if (onSalvar) onSalvar(orcParaSalvar);
  }

  if (propostaData) {
    const liveData = {
      ...propostaData,
      tipoPgto, temImposto, aliqImp,
      resumoDescritivo: propostaData.resumoDescritivo || "",
      descArq, parcArq, descPacote, parcPacote,
      descEtCtrt, parcEtCtrt, descPacCtrt, parcPacCtrt,
      etapasPct,
      totSI: modalTotSI, totCI: modalTotCI, impostoV: modalImposto,
    };
    // Callback: salva snapshot da proposta no orçamento (cria v1, v2, ...)
    async function handleSalvarPropostaSnapshot(snapshot) {
      if (!onSalvar) throw new Error("Função de salvar não disponível");
      // Orçamento base pode ser null se é um novo orçamento — usa propostaData como fallback
      const base = orcBase || propostaData;
      const propostasAtuais = base.propostas || [];
      const nextVersao = "v" + (propostasAtuais.length + 1);
      const novaProposta = { ...snapshot, versao: nextVersao };
      // Se ainda é rascunho, promove automaticamente pra "aberto" ao enviar primeira proposta
      const novoStatus = (!base.status || base.status === "rascunho") ? "aberto" : base.status;
      // Salva no orçamento (inclui todos os campos atuais do form + nova proposta)
      const orcAtualizado = {
        ...base,
        propostas: [...propostasAtuais, novaProposta],
        ultimaPropostaEm: snapshot.enviadaEm,
        status: novoStatus,
      };
      await onSalvar(orcAtualizado);
      return novaProposta;
    }
    // Se já existe proposta salva no orçamento, passa a última pra pre-popular estados
    const ultimaProposta = (orcBase?.propostas && orcBase.propostas.length > 0)
      ? orcBase.propostas[orcBase.propostas.length - 1]
      : null;
    // Se já existe proposta salva da versão aberta, passa info pra read-only
    const propostaAbertaReadOnly = propostaData.propostaReadOnly || (ultimaProposta && modoVer ? {
      versao: ultimaProposta.versao,
      enviadaEm: ultimaProposta.enviadaEm,
    } : null);
    return <PropostaPreview
      data={liveData}
      onVoltar={() => { setPropostaData(null); }}
      onSalvarProposta={handleSalvarPropostaSnapshot}
      propostaReadOnly={propostaAbertaReadOnly}
      propostaSnapshot={ultimaProposta}
      lockEdicao={propostaReadOnlyForce}
    />;
  }

  return (
    <div style={C.wrap} ref={wrapRef}>

      {/* ── Botão Voltar ── */}
      <div style={{ marginBottom:16 }}>
        <button onClick={handleVoltar} style={{ background:"none", border:"none", padding:"0", fontSize:13, color:"#828a98", cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="#828a98" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Voltar
        </button>
      </div>

      {/* ── Identificação ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:32 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:"#111", padding:"4px 0" }}>{clienteNome || "—"}</div>
        </div>
        <div>
          <span style={C.fieldLabel}>Referência</span>
          <input style={C.input} placeholder="Nome do projeto, endereço ou bairro"
            value={referencia} onChange={e => setReferencia(e.target.value)} />
        </div>
      </div>

      {/* ── Fluxo sequencial de parâmetros (horizontal: botão ativo à esquerda + valores editáveis à direita) ── */}
      {(() => {
        // Determina qual é a próxima etapa pendente (ordem: tipoObra → tipoProjeto → padrao → tipologia → tamanho)
        // Pula etapas condicionais (padrao/tipologia/tamanho só se !isComercial)
        const ordem = ["tipoObra", "tipoProjeto"];
        if (!isComercial) ordem.push("padrao", "tipologia", "tamanho");
        const proxima = ordem.find(k => !VALS[k]);
        const concluido = !proxima;
        return (
          <div style={{ display:"flex", alignItems:"center", gap:18, flexWrap:"wrap", minHeight:42 }}>
            {/* Botão ativo à esquerda (ou "Concluído" quando tudo preenchido) */}
            {proxima ? renderStep(proxima) : (
              <div style={{
                display:"inline-flex", alignItems:"center",
                padding:"9px 18px", border:"1px solid #c0c5cf", borderRadius:10,
                fontSize:11, background:"#f4f5f7", color:"#828a98",
                minWidth:110, justifyContent:"center", userSelect:"none",
              }}>
                Concluído ✓
              </div>
            )}
            {/* Valores escolhidos em ordem — cada um editável via hover */}
            {ordem.map(k => VALS[k] ? renderValor(k) : null)}
          </div>
        );
      })()}

      {/* ── Cômodos + Resumo ── */}
      {!!(tamanho || isComercial) && !!configAtual && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 400px", gap:32, alignItems:"start",
          animation:"slideUp 0.5s ease forwards",
          marginTop:32,
        }}>

          <div>
            {/* Toggles de serviços */}
            <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:12, alignItems:"center" }}>
              {[
                { key:"incluiArq",        val:incluiArq,        set:setIncluiArq,        label:"Arquitetura"  },
                { key:"incluiEng",        val:incluiEng,        set:setIncluiEng,        label:"Engenharia"   },
                { key:"incluiMarcenaria", val:incluiMarcenaria, set:setIncluiMarcenaria, label:"Marcenaria"   },
              ].map(({ key, val, set, label }) => (
                <label key={key} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", userSelect:"none" }}>
                  <span onClick={() => set(v => !v)} style={{
                    position:"relative", display:"inline-block",
                    width:36, height:20, borderRadius:10, flexShrink:0,
                    background: val ? "#111" : "#d1d5db",
                    transition:"background 0.2s",
                    cursor:"pointer",
                  }}>
                    <span style={{
                      position:"absolute", top:3, left: val ? 19 : 3,
                      width:14, height:14, borderRadius:"50%",
                      background:"#fff",
                      transition:"left 0.2s",
                      boxShadow:"0 1px 3px rgba(0,0,0,0.2)",
                    }} />
                  </span>
                  <span style={{ fontSize:13, color: val ? "#111" : "#828a98", fontWeight: val ? 600 : 400, transition:"color 0.2s" }}>
                    {label}
                  </span>
                </label>
              ))}
              {tipoProjeto !== "Conj. Comercial" && (
                <div style={{ display:"flex", alignItems:"center", gap:6, paddingLeft:8, borderLeft:"1px solid #e5e7eb" }}>
                  <span style={{ fontSize:13, color:"#828a98" }}>Repetição</span>
                  <button style={{ width:22, height:22, borderRadius:5, border:"1px solid #d0d4db", background:"#fff", fontSize:14, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1, color:"#374151" }}
                    onClick={() => setQtdRep(n => Math.max(0, n - 1))}>−</button>
                  {editandoRep ? (
                    <input
                      autoFocus
                      type="number" min="0"
                      defaultValue={qtdRep}
                      onBlur={e => { const v = parseInt(e.target.value)||0; setQtdRep(Math.max(0,v)); setEditandoRep(false); }}
                      onKeyDown={e => { if(e.key==="Enter"||e.key==="Escape"){ const v=parseInt(e.target.value)||0; setQtdRep(Math.max(0,v)); setEditandoRep(false); } }}
                      className="no-spin"
                      style={{ width:36, textAlign:"center", fontSize:13, fontWeight:600, border:"1px solid #333", borderRadius:5, padding:"1px 4px", outline:"none", fontFamily:"inherit", MozAppearance:"textfield" }}
                    />
                  ) : (
                    <span
                      onClick={() => setEditandoRep(true)}
                      title="Clique para digitar"
                      style={{ fontSize:13, fontWeight: qtdRep > 0 ? 700 : 400, minWidth:16, textAlign:"center", color: qtdRep > 0 ? "#111" : "#9ca3af", cursor:"text" }}>
                      {qtdRep}
                    </span>
                  )}
                  <button style={{ width:22, height:22, borderRadius:5, border:"1px solid #d0d4db", background:"#fff", fontSize:14, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1, color:"#374151" }}
                    onClick={() => setQtdRep(n => n + 1)}>+</button>
                </div>
              )}
            </div>



            {/* Container 1 coluna */}
            <div>
            {Object.entries(configAtual.grupos).filter(([grupo]) => {
                const isTerrea = tipologia === "Térreo" || tipologia === "Térrea";
                if (isTerrea && grupo === "Outros") return false;
                return true;
              }).map(([grupo, nomes]) => {
              // Split: escolhidos vs disponíveis
              const escolhidos  = nomes.filter(n => (qtds[n] || 0) > 0);
              const disponiveis = nomes.filter(n => (qtds[n] || 0) === 0);
              const m2Grupo  = escolhidos.reduce((s,n) => s + getArea(n) * (qtds[n]||0), 0);
              const qtdGrupo = escolhidos.reduce((s,n) => s + (qtds[n]||0), 0);

              // Renderiza controles: input + 1-6 + ✕ (se escolhido)
              // Função plana (não componente) pra evitar unmount/remount a cada re-render
              const renderControles = (nome, sempreVisivel) => {
                const q = qtds[nome] || 0;
                const isOpen = comodoAberto === nome;
                const visivel = sempreVisivel || isOpen;
                // Só renderiza quando visível — quando fechado, não ocupa espaço no layout
                if (!visivel) return null;
                return (
                  <span key={nome+"-ctrls"}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 1,
                      transition: "opacity 0.15s ease",
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                      background: "transparent",
                      padding: 0,
                      borderRadius: 4,
                      border: "none",
                      zIndex: 100,
                      position: "relative",
                    }}>
                    {/* Input em primeiro lugar */}
                    <input
                      type="number" min="0"
                      defaultValue={q > 6 ? q : ""}
                      className="no-spin"
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => e.stopPropagation()}
                      onFocus={e => {
                        setComodoAberto(nome);
                        setTravado(true);
                        if (comodoCloseRef.current) { clearTimeout(comodoCloseRef.current); comodoCloseRef.current = null; }
                      }}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          const v = parseInt(e.currentTarget.value) || 0;
                          if (v > 0) setQtdAbs(nome, v);
                          setTravado(false);
                          setComodoAberto(null);
                          e.currentTarget.blur();
                        } else if (e.key === "Escape") {
                          setTravado(false);
                          setComodoAberto(null);
                          e.currentTarget.blur();
                        }
                      }}
                      style={{
                        width:28, height:22, border:"1px solid #d1d5db", borderRadius:4,
                        background:"#fff", fontSize:11, fontWeight:500, color:"#111",
                        padding:"0 2px", textAlign:"center", outline:"none", fontFamily:"inherit",
                        flexShrink:0, marginRight:2,
                        MozAppearance:"textfield",
                      }}
                    />
                    {[1,2,3,4,5,6].map(n => (
                      <button key={n}
                        onClick={e => { e.stopPropagation(); setQtdAbs(nome, n); setTravado(false); setComodoAberto(null); }}
                        style={{
                          width:22, height:22, border:"1px solid transparent", borderRadius:4,
                          background: q===n ? "#111" : "transparent",
                          color: q===n ? "#fff" : "#6b7280",
                          fontSize:11, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
                          display:"inline-flex", alignItems:"center", justifyContent:"center",
                          flexShrink:0, padding:0,
                          transition:"all 0.1s",
                        }}
                        onMouseEnter={e => { if (q !== n) { e.currentTarget.style.background = "#111"; e.currentTarget.style.color = "#fff"; } }}
                        onMouseLeave={e => { if (q !== n) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6b7280"; } }}>
                        {n}
                      </button>
                    ))}
                    {q > 0 && (
                      <>
                        <span style={{ width:1, height:14, background:"#d1d5db", margin:"0 3px", alignSelf:"center" }} />
                        <button
                          onClick={e => { e.stopPropagation(); setQtdAbs(nome, 0); setTravado(false); setComodoAberto(null); }}
                          title="Remover"
                          style={{
                            width:22, height:22, border:"1px solid transparent", borderRadius:4,
                            background:"transparent", color:"#dc2626", fontSize:12,
                            display:"inline-flex", alignItems:"center", justifyContent:"center",
                            cursor:"pointer", fontFamily:"inherit", flexShrink:0, padding:0,
                          }}>
                          ✕
                        </button>
                      </>
                    )}
                  </span>
                );
              };

              const recolhido = !isGrupoAberto(grupo);

              return (
                <div key={grupo} style={{ marginBottom:14 }}>
                  {/* Header: retângulo cinza com bordas arredondadas */}
                  <div style={{
                    display:"flex", alignItems:"center", gap:10,
                    background:"#f4f5f7", border:"1px solid #e5e7eb", borderRadius:6,
                    padding:"5px 10px",
                    marginBottom: (recolhido && escolhidos.length === 0) ? 0 : 8,
                  }}>
                    <span style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:1, fontWeight:600, userSelect:"none", flexShrink:0 }}>
                      {isComercial ? (GRUPO_DISPLAY[grupo] || grupo) : grupo}
                    </span>
                    {/* Resetar — só aparece no primeiro grupo, reseta TODOS os cômodos */}
                    {grupo === "Áreas Sociais" && Object.keys(qtds).some(n => qtds[n] > 0) && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setQtds({});
                          setGruposAbertos({});
                        }}
                        style={{
                          background:"transparent", border:"1px solid #d0d4db",
                          color:"#6b7280", fontSize:10, fontFamily:"inherit",
                          cursor:"pointer", padding:"1px 8px", borderRadius:4,
                          transition:"all 0.15s", fontWeight:500, lineHeight:1.4,
                          flexShrink:0,
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = "#dc2626";
                          e.currentTarget.style.color = "#dc2626";
                          e.currentTarget.style.background = "#fef2f2";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = "#d0d4db";
                          e.currentTarget.style.color = "#6b7280";
                          e.currentTarget.style.background = "transparent";
                        }}>
                        Resetar
                      </button>
                    )}
                    <span style={{ flex:1 }} />

                    {/* Controles específicos de grupos comerciais: Padrão/Tipologia/Tamanho + Quantidade de unidades */}
                    {isComercial && (
                      <>
                        {["padrao","tipologia","tamanho"].map(key => {
                          const labels = { padrao:"Padrão", tipologia:"Tipologia", tamanho:"Tamanho" };
                          const opcoes = { padrao:["Alto","Médio","Baixo"], tipologia:["Térreo","Sobrado"], tamanho:["Grande","Médio","Pequeno","Compacta"] };
                          const gp = grupoParams[grupo] || {};
                          const val = gp[key] || "";
                          const aKey = `${grupo}__${key}`;
                          const open = abertoGrupo?.key === aKey;
                          return (
                            <div key={key} style={{ position:"relative", flexShrink:0 }}
                              onMouseEnter={() => {
                                if (hoverCloseRef.current) { clearTimeout(hoverCloseRef.current); hoverCloseRef.current = null; }
                                setAbertoGrupo({ key: aKey, grupo, param: key });
                              }}
                              onMouseLeave={() => {
                                if (hoverCloseRef.current) clearTimeout(hoverCloseRef.current);
                                hoverCloseRef.current = setTimeout(() => setAbertoGrupo(null), 120);
                              }}>
                              <button
                                onClick={e => { e.stopPropagation(); setAbertoGrupo(open ? null : { key: aKey, grupo, param: key }); }}
                                style={{
                                  display:"flex", alignItems:"center", gap:4,
                                  background: open ? "#eceef2" : (val ? "#fff" : "transparent"),
                                  border: `1px solid ${open ? "#828a98" : (val ? "#d0d4db" : "#d0d4db")}`,
                                  borderRadius:4, padding:"2px 8px",
                                  fontSize:10, fontFamily:"inherit", cursor:"pointer",
                                  color:"#111", lineHeight:1.4, transition:"all 0.15s",
                                }}>
                                {val
                                  ? <><span style={{ color:"#828a98", fontWeight:400 }}>{labels[key]}:</span><span style={{ fontWeight:600, color:"#111" }}>{val}</span></>
                                  : <span style={{ color:"#6b7280" }}>{labels[key]}</span>}
                                <svg width="8" height="8" viewBox="0 0 12 12" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition:"transform 0.15s" }}>
                                  <path d="M2 4l4 4 4-4" stroke="#828a98" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                              {open && (
                                <div style={{ position:"absolute", top:"100%", left:0, zIndex:9999,
                                  background:"#fff", border:"1px solid #b0b7c3", borderRadius:8,
                                  boxShadow:"0 4px 20px rgba(0,0,0,0.12)", minWidth:110, overflow:"hidden", marginTop:4 }}>
                                  {opcoes[key].map(op => {
                                    const selecionado = val === op;
                                    return (
                                      <div key={op}
                                        onClick={e => { e.stopPropagation(); setGrupoParam(grupo, key, op); }}
                                        onMouseEnter={e => { if (!selecionado) e.currentTarget.style.background = "#f4f5f7"; }}
                                        onMouseLeave={e => { if (!selecionado) e.currentTarget.style.background = "#fff"; }}
                                        style={{
                                          padding:"6px 12px", fontSize:12, cursor:"pointer",
                                          background: selecionado ? "#eceef2" : "#fff",
                                          color:"#374151", fontWeight: selecionado ? 600 : 400,
                                        }}>
                                        {op}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Controle de quantidade de unidades do grupo (− N +) */}
                        <div style={{ display:"flex", alignItems:"center", gap:3, flexShrink:0, paddingLeft:6, borderLeft:"1px solid #d0d4db" }}>
                          <button
                            onClick={() => setGrupoQtd(grupo, -1)}
                            style={{ width:18, height:18, borderRadius:4, border:"1px solid #d0d4db", background:"#fff", fontSize:11, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1, color:"#374151", padding:0 }}>
                            −
                          </button>
                          {editandoGrupoQtd === grupo ? (
                            <input
                              autoFocus
                              type="number" min="0"
                              defaultValue={grupoQtds[grupo]||0}
                              onBlur={e => {
                                const v = Math.max(0, parseInt(e.target.value)||0);
                                setGrupoQtds(prev => ({ ...prev, [grupo]: v }));
                                setEditandoGrupoQtd(null);
                              }}
                              onKeyDown={e => {
                                if (e.key === "Enter" || e.key === "Escape") {
                                  const v = Math.max(0, parseInt(e.target.value)||0);
                                  setGrupoQtds(prev => ({ ...prev, [grupo]: v }));
                                  setEditandoGrupoQtd(null);
                                }
                              }}
                              className="no-spin"
                              style={{ width:36, textAlign:"center", fontSize:11, fontWeight:600, border:"1px solid #333", borderRadius:4, padding:"1px 4px", outline:"none", fontFamily:"inherit", MozAppearance:"textfield" }}
                            />
                          ) : (
                            <span
                              onClick={() => setEditandoGrupoQtd(grupo)}
                              title="Clique para digitar"
                              style={{ fontSize:11, fontWeight: (grupoQtds[grupo]||0) > 0 ? 700 : 400, minWidth:18, textAlign:"center", color: (grupoQtds[grupo]||0) > 0 ? "#111" : "#9ca3af", cursor:"text" }}>
                              {grupoQtds[grupo]||0}
                            </span>
                          )}
                          <button
                            onClick={() => setGrupoQtd(grupo, +1)}
                            style={{ width:18, height:18, borderRadius:4, border:"1px solid #d0d4db", background:"#fff", fontSize:11, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1, color:"#374151", padding:0 }}>
                            +
                          </button>
                        </div>
                      </>
                    )}

                    {qtdGrupo > 0 && (
                      <span style={{ fontSize:10, color:"#9ca3af" }}>
                        <strong style={{ color:"#111", fontWeight:600 }}>{qtdGrupo * (isComercial ? (grupoQtds[grupo]||1) : 1)}</strong> amb · <strong style={{ color:"#111", fontWeight:600 }}>{fmtNum(m2Grupo * (isComercial ? (grupoQtds[grupo]||1) : 1))}</strong> m²
                      </span>
                    )}
                    <button
                      onClick={() => toggleGrupo(grupo)}
                      title={recolhido ? "Expandir" : "Recolher"}
                      style={{
                        width:18, height:18, border:"none", background:"transparent",
                        cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                        padding:0, fontFamily:"inherit", flexShrink:0,
                      }}>
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ transform: recolhido ? "rotate(180deg)" : "rotate(0)", transition:"transform 0.2s" }}>
                        <path d="M2 8l4-4 4 4" stroke="#828a98" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>

                  {!recolhido && disponiveis.length > 0 && (
                    <>
                      {/* Disponíveis — layout em 2 colunas padronizado: nome (fixo) + quantidades (fundo cinza) */}
                      <div style={{ position:"relative", marginTop:4, maxWidth:380 }}>
                        {/* Faixa de fundo da coluna de quantidades + título */}
                        <div style={{
                          position:"absolute", top:0, right:0, bottom:0,
                          width:180,
                          background:"#f4f5f7",
                          borderRadius:6,
                          zIndex:0,
                        }}>
                          <div style={{
                            fontSize:9, color:"#6b7280",
                            textTransform:"uppercase", letterSpacing:1, fontWeight:600,
                            padding:"4px 10px", textAlign:"center",
                            borderBottom:"1px solid #e5e7eb",
                          }}>
                            Quantidades
                          </div>
                        </div>
                        {/* Lista */}
                        <div style={{ display:"flex", flexDirection:"column", gap:2, position:"relative", zIndex:1, paddingTop:22 }}>
                          {disponiveis.map(nome => {
                            const isOpen = comodoAberto === nome;
                            return (
                              <div key={nome}
                                data-comodo-wrap
                                data-comodo-nome={nome}
                                onMouseEnter={() => abrirComodo(nome)}
                                onMouseLeave={agendarFecharComodo}
                                style={{
                                  position:"relative",
                                  display:"flex", alignItems:"center",
                                  padding:"4px 8px", fontSize:13,
                                  color: isOpen ? "#111" : "#6b7280",
                                  background: isOpen ? "#e5e7eb" : "transparent",
                                  borderRadius:6,
                                  userSelect:"none",
                                  transition:"color 0.15s, background 0.15s",
                                  minHeight:28,
                                }}>
                                <span style={{ flex:1, fontWeight: isOpen ? 500 : 400, minWidth:0, whiteSpace:"nowrap" }}>
                                  {nome}
                                  {(nome === "Suíte" || nome === "Dormitório") && (
                                    <span style={{ fontSize:10, color:"#9ca3af", marginLeft:5, fontWeight:400 }}>(Sem Closet)</span>
                                  )}
                                </span>
                                <span style={{ width:180, flexShrink:0, display:"flex", justifyContent:"center", alignItems:"center" }}>
                                  {renderControles(nome, false)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Escolhidos — SEMPRE visíveis, mesmo com grupo recolhido */}
                  {escolhidos.length > 0 && (
                    <div style={{
                      display:"flex", flexDirection:"row", flexWrap:"wrap", alignItems:"center",
                      gap:"6px 14px",
                      paddingTop: (!recolhido && disponiveis.length > 0) ? 10 : 0,
                      marginTop:  (!recolhido && disponiveis.length > 0) ? 10 : 4,
                      borderTop:  (!recolhido && disponiveis.length > 0) ? "1px dashed #e5e7eb" : "none",
                      width:"100%",
                    }}>
                      {escolhidos.map(nome => {
                        const q = qtds[nome] || 0;
                        const m2Total = getArea(nome) * q;
                        return (
                          <span key={nome}
                            onClick={() => setQtdAbs(nome, 0)}
                            title="Clique para remover"
                            className="comodo-escolhido"
                            style={{
                              display:"inline-flex", alignItems:"center", gap:4,
                              fontSize:13, color:"#111",
                              userSelect:"none",
                              whiteSpace:"nowrap",
                              flex:"0 0 auto",
                              cursor:"pointer",
                              transition:"color 0.15s",
                            }}>
                            <span>
                              {nome}
                              {(nome === "Suíte" || nome === "Dormitório") && (
                                <span style={{ fontSize:10, color:"#9ca3af", marginLeft:4, fontWeight:400 }}>(Sem Closet)</span>
                              )}
                              {" "}<strong style={{ fontWeight:600 }}>{q}</strong>
                              <span className="comodo-m2" style={{ fontSize:11, color:"#9ca3af", marginLeft:6, transition:"color 0.15s" }}>{fmtNum(m2Total)} m²</span>
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
              })}
              {/* Folga no final — compensa a altura que as linhas selecionadas deixam
                  de ocupar na lista de disponíveis. Mantém altura total constante pra
                  que o scroll não seja reajustado ao selecionar (o próximo cômodo
                  sobe exatamente pra posição do cursor). */}
              {(() => {
                const gruposVisiveis = Object.entries(configAtual.grupos).filter(([g]) => {
                  const isTerrea = tipologia === "Térreo" || tipologia === "Térrea";
                  if (isTerrea && g === "Outros") return false;
                  return isGrupoAberto(g);
                });
                // Conta cômodos selecionados dentro dos grupos visíveis/expandidos
                const selecionadosVisiveis = gruposVisiveis.reduce((acc, [, nomes]) =>
                  acc + nomes.filter(n => (qtds[n]||0) > 0).length, 0);
                // 30px = minHeight 28 + gap 2 (uma linha da lista de disponíveis)
                const folga = selecionadosVisiveis * 30;
                return folga > 0 ? <div style={{ height: folga, flexShrink: 0 }} aria-hidden="true" /> : null;
              })()}
            </div>
          </div>

          {/* Resumo Cálculo */}
          <div style={{ position:"sticky", top:24 }}>
            {temComodos && calculo ? (
              <div>
                <div style={C.resumoBox}>
                  <div style={C.resumoHdr}>Resumo Cálculo</div>
                  <AreaDetalhe calculo={calculo} fmtNum={fmtNum} />
                  <ResumoDetalhes calculo={{
                    ...calculo,
                    precoArq:   incluiArq ? calculo.precoArq : 0,
                    precoEng:   incluiEng ? calculo.precoEng : 0,
                    precoM2Arq: incluiArq ? calculo.precoM2Arq : 0,
                    precoM2Eng: incluiEng ? calculo.precoM2Eng : 0,
                  }} fmtNum={fmtNum} C={C} />
                </div>
                <button
                  style={{ width:"100%", marginTop:12, background:"#f3f4f6", color:"#111", border:"1px solid #c8cdd6", borderRadius:10, padding:"13px 0", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", letterSpacing:0.2, transition:"background 0.15s, border-color 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background="#e5e7eb"; e.currentTarget.style.borderColor="#d1d5db"; }}
                  onMouseLeave={e => { e.currentTarget.style.background="#f3f4f6"; e.currentTarget.style.borderColor="#e5e7eb"; }}
                  onClick={gerarProposta}>
                  Gerar Orçamento
                </button>
              </div>
            ) : (
              <div style={{ ...C.resumoBox, textAlign:"center", padding:"32px 20px" }}>
                <div style={{ fontSize:12, color:"#d1d5db" }}>Resumo Cálculo</div>
                <div style={{ fontSize:11, color:"#e5e7eb", marginTop:8 }}>Preencha os ambientes</div>
              </div>
            )}
          </div>

        </div>
      )}

      {(() => {
        if (calculo) {
          const _arqV = calculo.precoArq;
          const _engV = calculo.precoEng;
          const _totSI = _arqV + _engV;
          const _totCI = temImposto ? Math.round(_totSI/(1-aliqImp/100)*100)/100 : _totSI;
          const _impostoV = temImposto ? Math.round((_totCI-_totSI)*100)/100 : 0;
          window.__obraModalVals = { totSI: _totSI, totCI: _totCI, impostoV: _impostoV };
        }
        return null;
      })()}


      {aberto && (
        <div
          onMouseEnter={() => {
            // Mantém aberto quando mouse entra no painel
            if (hoverCloseRef.current) { clearTimeout(hoverCloseRef.current); hoverCloseRef.current = null; }
          }}
          onMouseLeave={() => {
            // Fecha ao sair do painel (sem delay pois já saiu do botão também)
            if (hoverCloseRef.current) clearTimeout(hoverCloseRef.current);
            hoverCloseRef.current = setTimeout(() => {
              setHoverDrop(null);
              setAberto(null);
            }, 80);
          }}
          style={{
          position:"fixed",
          top: panelPos.top, left: panelPos.left,
          zIndex:9999,
          background:"#fff", border:"1px solid #b0b7c3", borderRadius:10,
          boxShadow:"0 4px 20px rgba(0,0,0,0.12)", minWidth:160, overflow:"hidden",
        }}>
          {(OPCOES[aberto] || []).map(op => {
            const val = VALS[aberto];
            return (
              <div key={op}
                style={C.dropItem(val === op)}
                onMouseEnter={e => { if (val !== op) e.currentTarget.style.background = "#f4f5f7"; }}
                onMouseLeave={e => { if (val !== op) e.currentTarget.style.background = val === op ? "#efefef" : "#fff"; }}
                onClick={() => selecionar(aberto, op)}>
                {op}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal "Deseja salvar?" ao voltar com dados preenchidos */}
      {showSaveDialog && (
        <div
          onClick={() => setShowSaveDialog(false)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:"#fff", borderRadius:12, padding:"28px 28px 20px", maxWidth:380, width:"90%", boxShadow:"0 8px 32px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize:16, fontWeight:700, color:"#111", marginBottom:8 }}>Salvar este orçamento?</div>
            <div style={{ fontSize:13, color:"#6b7280", marginBottom:22, lineHeight:1.5 }}>
              Você iniciou um orçamento mas ainda não finalizou. Deseja salvá-lo como rascunho para continuar depois?
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button
                onClick={() => { setShowSaveDialog(false); onVoltar(); }}
                style={{ background:"#fff", color:"#6b7280", border:"1px solid #d1d5db", borderRadius:8, padding:"9px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                Não
              </button>
              <button
                onClick={salvarRascunhoEVoltar}
                style={{ background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"9px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                Sim, salvar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

