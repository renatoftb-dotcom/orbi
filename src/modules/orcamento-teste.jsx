function TesteOrcamento({ data, save }) {
  const [orcBase, setOrcBase] = useState(null);

  async function salvarOrcamento(orc) {
    const todos = data.orcamentosProjeto || [];
    const nextId = () => {
      const max = todos.reduce((mx, o) => {
        const m = (o.id || "").match(/^ORC-(\d+)$/);
        return m ? Math.max(mx, parseInt(m[1])) : mx;
      }, 0);
      return "ORC-" + String(max + 1).padStart(4, "0");
    };
    const novo = { ...orc, id: orc.id || nextId(), criadoEm: orc.criadoEm || new Date().toISOString() };
    setOrcBase(novo);
    const novos = orc.id ? todos.map(o => o.id === orc.id ? novo : o) : [...todos, novo];
    save({ ...data, orcamentosProjeto: novos }).catch(console.error);
  }

  return (
    <div style={{ margin:"-24px -28px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
        <div style={{ background:"#78350f", border:"1px solid #92400e", borderRadius:8, padding:"6px 14px" }}>
          <span style={{ color:"#fcd34d", fontWeight:800, fontSize:13 }}>🧪 Modo Teste</span>
        </div>
        <div style={{ color:"#475569", fontSize:13 }}>Alterações aqui não afetam o formulário de produção</div>
      </div>
      <FormOrcamentoProjetoTeste
        clienteNome="Teste"
        clienteWA=""
        orcBase={orcBase}
        onSalvar={salvarOrcamento}
        onVoltar={() => setOrcBase(null)}
      />
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

function PropostaPreview({ data, onVoltar }) {
  if (!data) return null;
  const { tipoProjeto, tipoObra, padrao, tipologia, tamanho, clienteNome,
          calculo,
          totSI, totCI, impostoV,
          incluiArq = true, incluiEng = true, incluiMarcenaria = false } = data;

  // Estados locais (antes eram props read-only) — editáveis inline
  const [tipoPgto, setTipoPgtoLocal]     = useState(data.tipoPgto || "padrao");
  const [temImposto, setTemImpostoLocal] = useState(data.temImposto || false);
  const [aliqImp, setAliqImpLocal]       = useState(data.aliqImp || 16);
  const [etapasPct, setEtapasPctLocal]   = useState(data.etapasPct || [
    { id:1, nome:"Estudo de Viabilidade",  pct:10 },
    { id:2, nome:"Estudo Preliminar",      pct:40 },
    { id:3, nome:"Aprovação na Prefeitura",pct:12 },
    { id:4, nome:"Projeto Executivo",      pct:38 },
    { id:5, nome:"Engenharia",             pct:0  },
  ]);
  const [etapasIsoladasLocal, setEtapasIsoladasLocal] = useState(new Set(data.etapasIsoladas || []));
  const etapasIsoladas = Array.from(etapasIsoladasLocal);
  // Descontos/parcelas — locais também
  const [descArqLocal,     setDescArqLocal]     = useState(data.descArq     ?? 5);
  const [parcArqLocal,     setParcArqLocal]     = useState(data.parcArq     ?? 3);
  const [descPacoteLocal,  setDescPacoteLocal]  = useState(data.descPacote  ?? 10);
  const [parcPacoteLocal,  setParcPacoteLocal]  = useState(data.parcPacote  ?? 4);
  const [descEtCtrtLocal,  setDescEtCtrtLocal]  = useState(data.descEtCtrt  ?? 5);
  const [parcEtCtrtLocal,  setParcEtCtrtLocal]  = useState(data.parcEtCtrt  ?? 2);
  const [descPacCtrtLocal, setDescPacCtrtLocal] = useState(data.descPacCtrt ?? 15);
  const [parcPacCtrtLocal, setParcPacCtrtLocal] = useState(data.parcPacCtrt ?? 8);

  const fmtV = v => v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const fmtN = v => v.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
  const isPadrao = tipoPgto === "padrao";
  const hoje = new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const dataStr = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
  const validade = new Date(hoje.getTime()+15*86400000).toLocaleDateString("pt-BR");

  const areaTot = calculo.areaTot || calculo.areaTotal || 0;

  // ── Estados editáveis ──────────────────────────────────────
  const [arqEdit, setArqEdit]               = useState(incluiArq ? (calculo.precoArq || 0) : 0);
  const [engEdit, setEngEdit]               = useState(incluiEng ? (calculo.precoEng || 0) : 0);
  const [resumoEdit, setResumoEdit]         = useState(data.resumoDescritivo || "");
  const [editandoArq, setEditandoArq]       = useState(false);
  const [editandoEng, setEditandoEng]       = useState(false);
  const [editandoResumo, setEditandoResumo] = useState(false);
  const [tmpArq, setTmpArq]                 = useState("");
  const tmpArqRef = useRef("");
  const tmpEngRef = useRef("");
  const [tmpEng, setTmpEng]                 = useState("");
  // Textos editáveis da proposta
  const [subTituloEdit, setSubTituloEdit]   = useState("Proposta Comercial de Projetos de Arquitetura e Engenharia");
  const [validadeEdit, setValidadeEdit]     = useState(new Date(hoje.getTime()+15*86400000).toLocaleDateString("pt-BR"));
  const [naoInclEdit, setNaoInclEdit]       = useState(null); // null = usar default
  const [prazoEdit, setPrazoEdit]           = useState(null); // null = usar default
  const [responsavelEdit, setResponsavelEdit] = useState("Arq. Leonardo Padovan");
  const [cauEdit, setCauEdit]               = useState("CAU A30278-3 · Ourinhos");
  const [emailEdit, setEmailEdit]           = useState("leopadovan.arq@gmail.com");
  const [telefoneEdit, setTelefoneEdit]     = useState("(14) 99767-4200");
  const [instagramEdit, setInstagramEdit]   = useState("@padovan_arquitetos");
  const [cidadeEdit, setCidadeEdit]         = useState("Ourinhos");
  const [pixEdit, setPixEdit]               = useState("PIX · Chave CNPJ: 36.122.417/0001-74 — Leo Padovan Projetos e Construções · Banco Sicoob");
  const [labelApenasEdit, setLabelApenasEdit] = useState(null); // null = usar dinâmico

  const [logoPreview, setLogoPreview]       = useState(null);

  // Carrega logo do storage ao abrir a proposta
  useEffect(() => {
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

  // Recalcula totais com valores editados
  const totSIEdit   = arqCI + engCI;
  const totCIEdit   = temImposto && totSIEdit > 0 ? Math.round(totSIEdit / (1 - aliqImp/100) * 100) / 100 : totSIEdit;
  const impostoEdit = temImposto ? Math.round((totCIEdit - totSIEdit) * 100) / 100 : 0;
  // Base das etapas = só arquitetura com imposto
  const arqCIEdit   = temImposto && arqCI > 0 ? Math.round(arqCI / (1 - aliqImp/100) * 100) / 100 : arqCI;
  // Engenharia com imposto (para linha separada na tabela de etapas)
  const engCIEdit   = temImposto && engCI > 0 ? Math.round(engCI / (1 - aliqImp/100) * 100) / 100 : engCI;

  // Etapa isolada — valor proporcional do total
  // Etapas isoladas — múltipla seleção (state local, manipulável inline)
  const idsIsolados     = etapasIsoladasLocal;
  const temIsoladas     = idsIsolados.size > 0;
  const etapasIsoladasObjs = temIsoladas ? etapasPct.filter(e => idsIsolados.has(e.id)) : [];
  // Compatibilidade com código que usa etapaIsoladaObj (single)
  const etapaIsoladaObj = temIsoladas ? etapasIsoladasObjs[0] : null;
  const etapasVisiveis  = (temIsoladas ? etapasPct.filter(e => idsIsolados.has(e.id)) : etapasPct).filter(e => incluiEng || e.id !== 5);
  // totSIBase = % da arq das etapas isoladas + 100% da eng (se incluiEng)
  const pctTotalIsolado = etapasIsoladasObjs.reduce((s,e) => s + (e.id !== 5 ? e.pct : 0), 0);
  const arqIsoladaSI    = temIsoladas ? Math.round(arqCI * (pctTotalIsolado / 100) * 100) / 100 : 0;
  const engSI           = incluiEng ? engCI : 0;
  const totSIBase       = temIsoladas
    ? Math.round((arqIsoladaSI + engSI) * 100) / 100
    : totSIEdit;

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
    setEtapasPctLocal(prev => prev.map(e => e.id === id ? { ...e, pct: Math.max(0, Math.min(100, novoPct)) } : e));
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
    ? (temImposto ? Math.round(totSIBase / (1 - aliqImp/100) * 100) / 100 : totSIBase)
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
    // IDs das etapas ativas (excluindo Engenharia que é controlada pelo toggle)
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

  // Escopo filtrado e renumerado
  const escopoDefault = (() => {
    const blocos = escopoState.filter(b => {
      if (b.isEng) return incluiEng;
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
    "Taxas municipais, emolumentos e registros (CAU/Prefeitura)",
    "Projetos de climatização",
    "Projeto de prevenção de incêndio",
    "Projeto de automação",
    "Projeto de paisagismo",
    "Projeto de interiores",
    ...(!incluiMarcenaria ? ["Projeto de Marcenaria (Móveis internos)"] : []),
    "Projeto estrutural de estruturas metálicas",
    "Projeto estrutural para muros de contenção (arrimo) acima de 1 m de altura",
    "Sondagem e Planialtimétrico do terreno",
    "Acompanhamento semanal de obra",
    "Gestão e execução de obra",
    "Vistoria para Caixa Econômica Federal",
    "RRT de Execução de obra",
    ...(!temImposto ? ["Impostos"] : []),
  ];
  // Itens dinâmicos baseados nos toggles — com sublabel menor
  const naoInclDinamicos = [
    ...(!incluiEng ? [{ label:"Projetos de Engenharia", sub:"(Estrutural, Elétrico e Hidrossanitário)" }] : []),
    ...(!incluiArq ? [{ label:"Projetos de Arquitetura", sub:null }] : []),
  ];
  // Normaliza tudo para { label, sub }
  const naoInclDefault = [
    ...naoInclDinamicos,
    ...naoInclFixos.map(s => ({ label: s, sub: null })),
  ];

  const prazoDefault = isPadrao
    ? [
       ...(incluiArq ? ["Prazo estimado para entrega do Projeto Arquitetônico: 30 dias úteis após aprovação do estudo preliminar."] : []),
       ...(incluiEng ? ["Prazo estimado para entrega dos Projetos de Engenharia: 30 dias úteis após aprovação na prefeitura."] : []),
      ]
    : [
       ...(incluiArq || incluiEng ? ["Prazo de 30 dias úteis por etapa, contados após conclusão e aprovação de cada etapa pelo cliente."] : []),
       ...(incluiArq || incluiEng ? ["Concluída e aprovada cada etapa, inicia-se automaticamente o prazo da etapa seguinte."] : []),
       ...(incluiEng ? ["Projetos de Engenharia: 30 dias úteis após aprovação do projeto na Prefeitura."] : []),
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

  const handlePdf = async () => {
    if (!window.jspdf) { alert("Aguarde 2s e tente novamente."); return; }
    try {
      const c = data.calculo;
      const nUnid = c.nRep || 1;
      // Quando etapa isolada, arq é proporcional, eng entra integral se incluiEng
      const arqTotal = temIsoladas ? arqIsoladaSI : arqEdit;
      const engTotal = incluiEng ? engEdit : 0;
      const grandTotal = temIsoladas ? totCIBase : totCIEdit;
      const engUnit = engTotal;
      const r = { areaTotal: areaTot, areaBruta: c.areaBruta||0, nUnidades: nUnid, precoArq: arqTotal, precoFinal: arqTotal, precoTotal: arqTotal, precoEng: engTotal, engTotal, impostoAplicado: temImposto, aliquotaImposto: aliqImp };
      const fmt   = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
      const fmtM2 = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+" m²";
      // etapasPct no PDF: quando isolada, só a etapa selecionada com 100%
      const etapasPdfFinal = temIsoladas
        ? etapasIsoladasObjs.map(e => ({ ...e }))
        : etapasPct;
      const orc = { id:"teste-"+Date.now(), cliente:data.clienteNome||"Cliente", tipo:data.tipoProjeto, subtipo:data.tipoObra, padrao:data.padrao, tipologia:data.tipologia, tamanho:data.tamanho, comodos:data.comodos||[], tipoPagamento:tipoPgto, descontoEtapa:descArqLocal, parcelasEtapa:parcArqLocal, descontoPacote:descPacoteLocal, parcelasPacote:parcPacoteLocal, descontoEtapaCtrt:descEtCtrtLocal, parcelasEtapaCtrt:parcEtCtrtLocal, descontoPacoteCtrt:descPacCtrtLocal, parcelasPacoteCtrt:parcPacCtrtLocal, etapasPct:etapasPdfFinal, incluiImposto:temImposto, aliquotaImposto:aliqImp, etapasIsoladas:Array.from(idsIsolados), totSI:0, criadoEm:new Date().toISOString(), resultado:r,
        // Textos editáveis
        cidade: cidadeEdit, validadeStr: validadeEdit, pixTexto: pixEdit,
        // Escopo editado na preview
        escopoEditado: escopoState,
      };
      const modelo = defaultModelo(orc, arqTotal, engTotal, grandTotal, fmt, fmtM2, nUnid, engUnit, r);
      if (resumoEdit && modelo.cliente) modelo.cliente.resumo = resumoEdit;
      await buildPdf(orc, logoPreview, modelo, null, "#ffffff", incluiArq, incluiEng);
    } catch(e) { console.error(e); alert("Erro ao gerar PDF: "+e.message); }
  };

  return (
    <div style={wrap}>
      <div style={page}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:36 }}>
          <button onClick={onVoltar} style={{ background:"none", border:`1px solid ${LN}`, borderRadius:8, padding:"7px 14px", fontSize:13, cursor:"pointer", fontFamily:"inherit", color:MD }}>
            ← Voltar
          </button>
          <button onClick={handlePdf} style={{ background:C, border:"none", borderRadius:8, padding:"8px 22px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", color:"#fff" }}>
            Gerar PDF
          </button>
        </div>

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
            <div style={{ fontSize:10, color:LT, marginTop:3, letterSpacing:"0.04em" }}><TextoEditavel valor={subTituloEdit} onChange={setSubTituloEdit} style={{ fontSize:10 }} /></div>
          </div>
          <div style={{ textAlign:"right" }}>
            {incluiArq && incluiEng && (
              <>
                <div style={{ display:"flex", alignItems:"baseline", justifyContent:"flex-end", gap:6 }}>
                  <span style={{ fontSize:10, color:LT }}>Apenas Arquitetura</span>
                  <span style={{ fontSize:22, fontWeight:600, color:C }}>{fmtV(temIsoladas ? arqIsoladaSI : arqEdit)}</span>
                </div>
                <div style={{ fontSize:11, color:LT }}>{areaTot > 0 ? `R$ ${fmtN(Math.round((temIsoladas ? arqIsoladaSI : arqCI)/areaTot*100)/100)}/m²` : ""}</div>
              </>
            )}
          </div>
        </div>

        {/* Texto descritivo editável */}
        {temIsoladas && (
          <div className="no-print" style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12,
            background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:6, padding:"6px 12px" }}>
            <span style={{ fontSize:12, color:"#0369a1", fontWeight:600 }}>◎ Orçamento isolado: {etapasIsoladasObjs.map(e=>e.nome).join(", ")}</span>
          </div>
        )}
        {(resumoEdit || data.resumoDescritivo) && (
          <div style={{ marginBottom:20, position:"relative" }}>
            {editandoResumo ? (
              <textarea
                autoFocus
                value={resumoEdit}
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
                {resumoEdit || data.resumoDescritivo}
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

          <div style={{ display:"grid", gridTemplateColumns: incluiArq && incluiEng ? "1fr 0.5px 1fr" : "1fr", gap:0, marginBottom:12 }}>
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
              <div style={{ fontSize:11, color:LT }}>{areaTot > 0 ? `R$ ${fmtN(Math.round((temIsoladas ? arqIsoladaSI : arqCI)/areaTot*100)/100)}/m²` : ""}</div>
            </div>}
            {incluiArq && incluiEng && <div style={{ background:LN }} />}
            {incluiEng && <div style={{ paddingLeft: incluiArq ? 20 : 0 }}>
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
              <div style={{ fontSize:11, color:LT }}>{areaTot > 0 ? `R$ ${fmtN(Math.round(engCI/areaTot*100)/100)}/m²` : ""}</div>
            </div>}
          </div>
          <div style={{ border:`0.5px solid ${LN}`, borderRadius:8, padding:"10px 14px", fontSize:12, color:LT, marginBottom:4,
              display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
            <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
              <input type="checkbox" checked={temImposto} onChange={e => setTemImpostoLocal(e.target.checked)} style={{ cursor:"pointer" }} />
              <span>Incluir impostos</span>
            </label>
            {temImposto && (
              <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                <input type="text" value={aliqImp}
                  onChange={e => { const n = parseFloat(e.target.value.replace(",",".")) || 0; setAliqImpLocal(n); }}
                  style={{ width:42, fontSize:12, padding:"3px 6px", border:`1px solid ${LN}`, borderRadius:4, textAlign:"right", fontFamily:"inherit", outline:"none" }} />
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
              onClick={() => setTipoPgtoLocal("padrao")}
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
                  <input type="text" value={descArqLocal}
                    onChange={e => { const n = parseFloat(e.target.value.replace(",",".")) || 0; setDescArqLocal(Math.max(0, Math.min(100, n))); }}
                    style={{ width:42, fontSize:12, padding:"3px 6px", border:`1px solid ${LN}`, borderRadius:4, textAlign:"center", fontFamily:"inherit", outline:"none" }} />
                  <span style={{ fontSize:11, color:LT }}>%</span>
                </div>
                <span style={{ color:LN }}>·</span>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Parcelado</span>
                  <input type="text" value={parcArqLocal}
                    onChange={e => { const n = parseInt(e.target.value) || 0; setParcArqLocal(Math.max(1, n)); }}
                    style={{ width:42, fontSize:12, padding:"3px 6px", border:`1px solid ${LN}`, borderRadius:4, textAlign:"center", fontFamily:"inherit", outline:"none" }} />
                  <span style={{ fontSize:11, color:LT }}>×</span>
                </div>
              </div>
              <div style={{ fontSize:11, color:LT, marginTop:6, lineHeight:1.5 }}>
                De {fmtV(arqCIEdit)} por {fmtV(Math.round(arqCIEdit*(1-descArqLocal/100)*100)/100)} à vista &nbsp;·&nbsp;
                ou entrada de {fmtV(Math.round(arqCIEdit/parcArqLocal*100)/100)}
                {parcArqLocal > 1 && <> + {parcArqLocal-1}× de {fmtV(Math.round(arqCIEdit/parcArqLocal*100)/100)}</>}
              </div>
            </div>
            {incluiArq && incluiEng && (
            <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:12, marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:8 }}>Pacote Completo (Arq. + Eng.)</div>
              <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:6 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Antecipado — desconto</span>
                  <input type="text" value={descPacoteLocal}
                    onChange={e => { const n = parseFloat(e.target.value.replace(",",".")) || 0; setDescPacoteLocal(Math.max(0, Math.min(100, n))); }}
                    style={{ width:42, fontSize:12, padding:"3px 6px", border:`1px solid ${LN}`, borderRadius:4, textAlign:"center", fontFamily:"inherit", outline:"none" }} />
                  <span style={{ fontSize:11, color:LT }}>%</span>
                </div>
                <span style={{ color:LN }}>·</span>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Parcelado</span>
                  <input type="text" value={parcPacoteLocal}
                    onChange={e => { const n = parseInt(e.target.value) || 0; setParcPacoteLocal(Math.max(1, n)); }}
                    style={{ width:42, fontSize:12, padding:"3px 6px", border:`1px solid ${LN}`, borderRadius:4, textAlign:"center", fontFamily:"inherit", outline:"none" }} />
                  <span style={{ fontSize:11, color:LT }}>×</span>
                </div>
              </div>
              <div style={{ fontSize:11, color:LT, marginTop:6, lineHeight:1.5 }}>
                De {fmtV(totCIEdit)} por {fmtV(Math.round(totCIEdit*(1-descPacoteLocal/100)*100)/100)} à vista &nbsp;·&nbsp;
                ou entrada de {fmtV(Math.round(totCIEdit/parcPacoteLocal*100)/100)}
                {parcPacoteLocal > 1 && <> + {parcPacoteLocal-1}× de {fmtV(Math.round(totCIEdit/parcPacoteLocal*100)/100)}</>}
              </div>
            </div>
            )}
          </>) : (<>
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"grid", gridTemplateColumns:"24px 1fr 60px 60px 110px 22px", gap:6, alignItems:"center", paddingBottom:6, borderBottom:`1.5px solid ${C}` }}>
                <span></span>
                <span style={{ fontSize:10, fontWeight:600, color:C, textTransform:"uppercase", letterSpacing:"0.06em" }}>Etapa</span>
                <span></span>
                <span style={{ fontSize:10, fontWeight:600, color:C, textTransform:"uppercase", letterSpacing:"0.06em", textAlign:"center" }}>%</span>
                <span style={{ fontSize:10, fontWeight:600, color:C, textTransform:"uppercase", letterSpacing:"0.06em", textAlign:"right" }}>Valor</span>
                <span></span>
              </div>
              {etapasPct.filter(e => incluiEng || e.id !== 5).map((et, i) => {
                const isIsolada = idsIsolados.has(et.id);
                const visivel = !temIsoladas || isIsolada || et.id === 5;
                const isEng = et.id === 5;
                const bgRow = isIsolada ? "#e0f2fe" : "transparent";
                const corRow = isIsolada ? "#0369a1" : C;
                const fontWt = isIsolada ? 600 : 400;
                const valorEtapa = isEng ? engCIEdit
                  : temIsoladas
                    ? Math.round(totCIBase * (et.pct / pctTotalIsolado) * 100) / 100
                    : Math.round(arqCIEdit*(et.pct/100)*100)/100;
                return (
                <div key={et.id} style={{ display:"grid", gridTemplateColumns:"24px 1fr 60px 60px 110px 22px", gap:6, padding:"7px 4px", borderBottom:`0.5px solid ${LN}`, alignItems:"center", background: bgRow, opacity: visivel ? 1 : 0.3 }}>
                  {!isEng ? (
                    <span
                      onClick={() => toggleIsolarEtapa(et.id)}
                      title={isIsolada ? "Desmarcar isolamento" : "Orçar apenas esta etapa"}
                      style={{ cursor:"pointer", textAlign:"center", fontSize:14, color: isIsolada ? "#0369a1" : LT, fontWeight:500, userSelect:"none" }}>
                      {isIsolada ? "◉" : "◎"}
                    </span>
                  ) : <span></span>}
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
                    <input type="text" value={et.pct}
                      onChange={e => { const n = parseFloat(e.target.value.replace(",",".")) || 0; atualizarEtapaPct(et.id, n); }}
                      style={{ width:50, fontSize:12, padding:"3px 6px", border:`1px solid ${LN}`, borderRadius:4, textAlign:"center", fontFamily:"inherit", outline:"none" }} />
                  ) : (
                    <span style={{ color:LT, textAlign:"center" }}>—</span>
                  )}
                  {!isEng ? (
                    <EtapaValorInput
                      valorAtual={valorEtapa}
                      fmtN={fmtN}
                      onCommit={novo => atualizarEtapaValor(et.id, novo)}
                      borderColor={LN}
                      color={corRow}
                    />
                  ) : (
                    <span style={{ fontWeight:500, textAlign:"right", color: corRow }}>{fmtV(valorEtapa)}</span>
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
              <div style={{ display:"grid", gridTemplateColumns:"24px 1fr 60px 60px 110px 22px", gap:6, padding:"8px 4px", borderTop:`1.5px solid ${C}`, marginTop:2, alignItems:"center" }}>
                <span></span>
                <span style={{ fontWeight:600, color:C }}>Total</span>
                <span></span>
                <span style={{ fontWeight:600, color:C, textAlign:"center" }}>{etapasPct.filter(e=>e.id!==5 && (!temIsoladas || idsIsolados.has(e.id))).reduce((s,e)=>s+e.pct,0)}%</span>
                <span style={{ fontSize:15, fontWeight:700, color:C, textAlign:"right" }}>{fmtV(temIsoladas ? totCIBase : Math.round((arqCIEdit*(etapasPct.reduce((s,e)=>s+e.pct,0)/100) + (incluiEng?engCIEdit:0))*100)/100)}</span>
                <span></span>
              </div>
            </div>
            <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:10, marginBottom:10 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:8 }}>Etapa a Etapa</div>
              <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Antecipado por etapa — desconto</span>
                  <input type="text" value={descEtCtrtLocal}
                    onChange={e => { const n = parseFloat(e.target.value.replace(",",".")) || 0; setDescEtCtrtLocal(Math.max(0, Math.min(100, n))); }}
                    style={{ width:42, fontSize:12, padding:"3px 6px", border:`1px solid ${LN}`, borderRadius:4, textAlign:"center", fontFamily:"inherit", outline:"none" }} />
                  <span style={{ fontSize:11, color:LT }}>%</span>
                </div>
                <span style={{ color:LN }}>·</span>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Parcelado por etapa</span>
                  <input type="text" value={parcEtCtrtLocal}
                    onChange={e => { const n = parseInt(e.target.value) || 0; setParcEtCtrtLocal(Math.max(1, n)); }}
                    style={{ width:42, fontSize:12, padding:"3px 6px", border:`1px solid ${LN}`, borderRadius:4, textAlign:"center", fontFamily:"inherit", outline:"none" }} />
                  <span style={{ fontSize:11, color:LT }}>×</span>
                </div>
              </div>
            </div>
            {incluiArq && incluiEng && !temIsoladas && (
            <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:10, marginBottom:10 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:8 }}>Pacote Completo (Arq. + Eng.)</div>
              <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:6 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Antecipado — desconto</span>
                  <input type="text" value={descPacCtrtLocal}
                    onChange={e => { const n = parseFloat(e.target.value.replace(",",".")) || 0; setDescPacCtrtLocal(Math.max(0, Math.min(100, n))); }}
                    style={{ width:42, fontSize:12, padding:"3px 6px", border:`1px solid ${LN}`, borderRadius:4, textAlign:"center", fontFamily:"inherit", outline:"none" }} />
                  <span style={{ fontSize:11, color:LT }}>%</span>
                </div>
                <span style={{ color:LN }}>·</span>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Parcelado</span>
                  <input type="text" value={parcPacCtrtLocal}
                    onChange={e => { const n = parseInt(e.target.value) || 0; setParcPacCtrtLocal(Math.max(1, n)); }}
                    style={{ width:42, fontSize:12, padding:"3px 6px", border:`1px solid ${LN}`, borderRadius:4, textAlign:"center", fontFamily:"inherit", outline:"none" }} />
                  <span style={{ fontSize:11, color:LT }}>×</span>
                </div>
              </div>
              <div style={{ fontSize:11, color:LT, marginTop:6, lineHeight:1.5 }}>
                De {fmtV(totCIEdit)} por {fmtV(Math.round(totCIEdit*(1-descPacCtrtLocal/100)*100)/100)} à vista &nbsp;·&nbsp;
                ou entrada de {fmtV(Math.round(totCIEdit/parcPacCtrtLocal*100)/100)}
                {parcPacCtrtLocal > 1 && <> + {parcPacCtrtLocal-1}× de {fmtV(Math.round(totCIEdit/parcPacCtrtLocal*100)/100)}</>}
              </div>
            </div>
            )}
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
                if (!incluiEng) return false; // toggle desligado
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

function FormOrcamentoProjetoTeste({ onSalvar, orcBase, clienteNome, clienteWA, onVoltar, modoVer }) {
  const [referencia,   setReferencia]   = useState(orcBase?.referencia  || "");
  const [tipoObra,     setTipoObra]     = useState(orcBase?.subtipo     || null);
  const [tipoProjeto,  setTipoProjeto]  = useState(orcBase?.tipo        || null);
  const [padrao,       setPadrao]       = useState(orcBase?.padrao      || null);
  const [tipologia,    setTipologia]    = useState(orcBase?.tipologia   || null);
  const [tamanho,      setTamanho]      = useState(orcBase?.tamanho     || null);
  const [aberto,       setAberto]       = useState(null);
  const [panelPos,     setPanelPos]     = useState({ top:0, left:0 });
  const [showModal,     setShowModal]     = useState(false);
  const [propostaData,  setPropostaData]  = useState(modoVer && orcBase ? {
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
  const [orcPendente,   setOrcPendente]   = useState(null);
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

  const VALS   = { tipoObra, tipoProjeto, padrao, tipologia, tamanho };
  const LABELS = { tipoObra:"Tipo Obra", tipoProjeto:"Tipo Projeto", padrao:"Padrão", tipologia:"Tipologia", tamanho:"Tamanho" };
  const SETS   = { tipoObra:setTipoObra, tipoProjeto:setTipoProjeto, padrao:setPadrao, tipologia:setTipologia, tamanho:setTamanho };

  function selecionar(key, val) { SETS[key](val); setAberto(null); }

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
    s.textContent = `@keyframes slideUp { from { opacity:0; transform:translateY(32px); } to { opacity:1; transform:translateY(0); } }`;
    document.head.appendChild(s);
  }, []);

  const C = {
    wrap:       { fontFamily:"inherit", color:"#111", background:"#fff", minHeight:"100vh", padding:"24px 20px", position:"relative" },
    fieldBox:   { background:"#f5f5f5", border:"1px solid #333", borderRadius:10, padding:"12px 16px", fontSize:14, color:"#6b7280" },
    fieldLabel: { fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1, marginBottom:6, display:"block" },
    input:      { width:"100%", border:"1px solid #333", borderRadius:10, padding:"12px 16px", fontSize:14, color:"#111", outline:"none", background:"#fff", boxSizing:"border-box", fontFamily:"inherit" },
    dropWrap:   { position:"relative", display:"flex", flexDirection:"column", alignItems:"center", gap:6 },
    dropLbl:    { fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1.2, textAlign:"center" },
    dropBtn:    (open, hasVal) => ({ display:"flex", alignItems:"center", gap:6, background: hasVal&&!open?"#fff":"#fff", border:`1px solid ${open?"#111": hasVal?"#c0c5cf":"#333"}`, borderRadius:10, padding:"9px 14px", fontSize:11, color: null, cursor:"pointer", fontFamily:"inherit", minWidth:110, }),
    dropBtnTxt: (val) => ({ flex:1, textAlign:"center", color: val ? "#111" : "#828a98" }),
    chevron:    (open) => ({ transition:"transform 0.15s", transform: open ? "rotate(180deg)" : "none", display:"flex", alignItems:"center" }),
    dropPanel:  { position:"fixed", zIndex:9999, background:"#fff", border:"1px solid #333", borderRadius:10, boxShadow:"0 4px 16px rgba(0,0,0,0.12)", minWidth:160, overflow:"hidden" },
    dropItem:   (sel) => ({ padding:"10px 16px", fontSize:14, cursor:"pointer", color:"#374151", background: sel ? "#eceef2" : "#fff", fontWeight: sel ? 600 : 400, borderBottom:"1px solid #c8cdd6" }),
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
    return (
      <div style={{ position:"relative" }} key={id}>
        <button
          ref={el => { btnRef.current = el; }}
          data-drop-btn={id}
          style={{ ...C.dropBtn(open, !!val), background: val ? "#f4f5f7" : "#fff" }}
          onClick={(e) => {
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

  const GRUPO_DISPLAY = {
    "Por Loja":        "Loja",
    "Espaço Âncora":   "Espaço Âncora",
    "Áreas Comuns":    "Área Comum",
    "Por Apartamento": "Apartamento",
    "Galpao":          "Galpão",
  };

  const [gruposAbertos, setGruposAbertos] = useState({});
  function toggleGrupo(grupo) {
    setGruposAbertos(prev => ({ ...prev, [grupo]: prev[grupo] === false ? true : false }));
  }
  function isGrupoAberto(grupo) { return gruposAbertos[grupo] !== false; }

  function setQtd(nome, delta) {
    setQtds(prev => ({ ...prev, [nome]: Math.max(0, (prev[nome] || 0) + delta) }));
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
        return `Conjunto comercial, contendo ${lista}, totalizando ${fmtArea(c.areaTot||c.areaTotal)}.`;
      }
      const nUnid = calculo?.nRep || 1;
      const areaUni = calculo?.areaTotal || calculo?.areaTot || 0;
      const areaTotR = Math.round(areaUni * nUnid * 100)/100;
      const comAtivos = Object.entries(qtds).filter(([,q])=>q>0).map(([n])=>n.toLowerCase());
      const totalAmb = Object.entries(qtds).filter(([,q])=>q>0).reduce((s,[,q])=>s+q,0);
      const listaStr = comAtivos.length>1 ? comAtivos.slice(0,-1).join(", ")+" e "+comAtivos[comAtivos.length-1] : comAtivos[0]||"";
      const tipDesc = (tipologia||"").toLowerCase().includes("sobrado") ? "com dois pavimentos" : "térrea";
      const numFem = ["","uma","duas","três","quatro","cinco","seis","sete","oito","nove","dez"];
      if (nUnid>1) {
        const nExt = nUnid>=1&&nUnid<=10 ? numFem[nUnid] : String(nUnid);
        return `${nExt.charAt(0).toUpperCase()+nExt.slice(1)} residências ${tipDesc} idênticas, com ${fmtN2(areaUni)}m² por unidade, totalizando ${fmtN2(areaTotR)}m² de área construída. Cada unidade composta por ${totalAmb} ambientes: ${listaStr}.`;
      }
      return `Uma residência ${tipDesc}, com ${fmtN2(areaUni)}m² de área construída, composta por ${totalAmb} ambientes: ${listaStr}.`;
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
    setOrcPendente(null);
    setShowModal(false);
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
    return <PropostaPreview data={liveData} onVoltar={() => { setPropostaData(null); }} />;
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

      {/* ── Fluxo sequencial de parâmetros ── */}
      {!(tamanho || isComercial) ? (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start" }}>

          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {renderStep("tipoObra")}
            {tipoObra && <span onClick={() => { setAberto(null); setTipoObra(null); setTipoProjeto(null); setPadrao(null); setTipologia(null); setTamanho(null); }} style={{ fontSize:11, color:"#d1d5db", cursor:"pointer", padding:"0 4px" }}>✕</span>}
          </div>

          {tipoObra && <>
            <div style={{ width:1, background:"#d1d5db", height:24, marginLeft:20, transition:"height 0.45s ease" }} />
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              {renderStep("tipoProjeto")}
              {tipoProjeto && !isComercial && <span onClick={() => { setAberto(null); setTipoProjeto(null); setPadrao(null); setTipologia(null); setTamanho(null); }} style={{ fontSize:11, color:"#d1d5db", cursor:"pointer", padding:"0 4px" }}>✕</span>}
            </div>
          </>}

          {tipoProjeto && !isComercial && <>
            <div style={{ width:1, background:"#d1d5db", height:24, marginLeft:20, transition:"height 0.45s ease" }} />
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              {renderStep("padrao")}
              {padrao && <span onClick={() => { setAberto(null); setPadrao(null); setTipologia(null); setTamanho(null); }} style={{ fontSize:11, color:"#d1d5db", cursor:"pointer", padding:"0 4px" }}>✕</span>}
            </div>
          </>}

          {padrao && <>
            <div style={{ width:1, background:"#d1d5db", height:24, marginLeft:20, transition:"height 0.45s ease" }} />
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              {renderStep("tipologia")}
              {tipologia && <span onClick={() => { setAberto(null); setTipologia(null); setTamanho(null); }} style={{ fontSize:11, color:"#d1d5db", cursor:"pointer", padding:"0 4px" }}>✕</span>}
            </div>
          </>}

          {tipologia && <>
            <div style={{ width:1, background:"#d1d5db", height:24, marginLeft:20, transition:"height 0.45s ease" }} />
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              {renderStep("tamanho")}
              {tamanho && <span onClick={() => { setAberto(null); setTamanho(null); }} style={{ fontSize:11, color:"#d1d5db", cursor:"pointer", padding:"0 4px" }}>✕</span>}
            </div>
          </>}

        </div>
      ) : (
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center", animation:"slideUp 0.4s ease forwards" }}>
          {renderStep("tipoObra")}
          {renderStep("tipoProjeto")}
          {!isComercial && renderStep("padrao")}
          {!isComercial && renderStep("tipologia")}
          {!isComercial && renderStep("tamanho")}
        </div>
      )}

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
                      style={{ width:36, textAlign:"center", fontSize:13, fontWeight:600, border:"1px solid #333", borderRadius:5, padding:"1px 4px", outline:"none", fontFamily:"inherit" }}
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



            {Object.entries(configAtual.grupos).filter(([grupo]) => {
                const isTerrea = tipologia === "Térreo" || tipologia === "Térrea";
                if (isTerrea && grupo === "Outros") return false;
                return true;
              }).map(([grupo, nomes]) => (
              <div key={grupo}>
                <div style={{
                  display:"flex", alignItems:"center", gap:12,
                  background: "#f4f5f7",
                  border: "1px solid #dde0e5",
                  borderRadius: 8,
                  padding: "8px 12px",
                  marginTop: 20, marginBottom: 10,
                }}>
                  <span onClick={() => toggleGrupo(grupo)} style={{ flex:1, fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:1, fontWeight:600, cursor:"pointer" }}>
                    {isComercial ? (GRUPO_DISPLAY[grupo] || grupo) : grupo}
                  </span>
                  <span onClick={() => toggleGrupo(grupo)} style={{ fontSize:10, color:"#828a98", cursor:"pointer", userSelect:"none" }}>
                    {isGrupoAberto(grupo) ? "▲" : "▼"}
                  </span>
                  {isComercial ? (
                    <>
                      {["padrao","tipologia","tamanho"].map(key => {
                        const labels = { padrao:"Padrão", tipologia:"Tipologia", tamanho:"Tamanho" };
                        const gp = grupoParams[grupo] || {};
                        const val = gp[key] || "";
                        const aKey = `${grupo}__${key}`;
                        const open = abertoGrupo?.key === aKey;
                        return (
                          <div key={key} style={{ position:"relative" }}>
                            <button
                              style={{ ...C.dropBtn(open, !!val), minWidth:80, background: val ? "#f4f5f7" : "#fff", padding:"5px 10px" }}
                              onClick={e => {
                                e.stopPropagation();
                                setAbertoGrupo(open ? null : { key: aKey, grupo, param: key });
                              }}>
                              <span style={{ ...C.dropBtnTxt(val), fontSize:10 }}>
                                {val
                                  ? <><span style={{ color:"#828a98", fontWeight:400 }}>{labels[key]}: </span><span style={{ fontWeight:600, color:"#111" }}>{val}</span></>
                                  : <span style={{ color:"#828a98" }}>{labels[key]}</span>}
                              </span>
                              <span style={C.chevron(open)}>
                                <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="#828a98" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </span>
                            </button>
                            {open && (
                              <div style={{ position:"absolute", top:"100%", left:0, zIndex:9999,
                                background:"#fff", border:"1px solid #b0b7c3", borderRadius:10,
                                boxShadow:"0 4px 20px rgba(0,0,0,0.12)", minWidth:130, overflow:"hidden", marginTop:4 }}>
                                {(["padrao","tipologia","tamanho"].includes(key) ? { padrao:["Alto","Médio","Baixo"], tipologia:["Térreo","Sobrado"], tamanho:["Grande","Médio","Pequeno","Compacta"] }[key] : []).map(op => {
                                  const cur = (grupoParams[grupo] || {})[key];
                                  return (
                                    <div key={op}
                                      style={C.dropItem(cur === op)}
                                      onMouseEnter={e => { if (cur !== op) e.currentTarget.style.background = "#f4f5f7"; }}
                                      onMouseLeave={e => { if (cur !== op) e.currentTarget.style.background = cur === op ? "#efefef" : "#fff"; }}
                                      onClick={e => { e.stopPropagation(); setGrupoParam(grupo, key, op); }}>
                                      {op}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div style={C.qtdWrap}>
                        <button style={C.qtdBtn} onClick={() => setGrupoQtd(grupo, -1)}>−</button>
                        <span style={C.qtdNum(grupoQtds[grupo]||0)}>{grupoQtds[grupo]||0}</span>
                        <button style={C.qtdBtn} onClick={() => setGrupoQtd(grupo, +1)}>+</button>
                      </div>
                      <span style={{ width:52 }} />
                    </>
                  ) : null}
                </div>
                {isGrupoAberto(grupo) && (
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
                    {nomes.map(nome => {
                      const q    = qtds[nome] || 0;
                      const area = getArea(nome);
                      return (
                        <div key={nome} style={{ ...C.comodoRow(q > 0), gap:6 }}>
                          <span style={{ ...C.comodoNome, fontSize:13 }}>{nome}</span>
                          <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
                            <button style={{ ...C.qtdBtn, width:22, height:22, fontSize:14 }} onClick={() => setQtd(nome, -1)}>−</button>
                            <span style={{ ...C.qtdNum(q), width:18, fontSize:13 }}>{q}</span>
                            <button style={{ ...C.qtdBtn, width:22, height:22, fontSize:14 }} onClick={() => setQtd(nome, +1)}>+</button>
                          </div>
                          <span style={{ ...C.comodoM2, width:56, fontSize:11 }}>{q > 0 ? fmtNum(area*q)+" m²" : area > 0 ? fmtNum(area)+" m²" : "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
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

      {/* Modal Gerar Orçamento */}
      {showModal && calculo && (() => {
        const fmtV = (v) => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
        const arqV  = incluiArq ? calculo.precoArq : 0;
        const engV  = incluiEng ? calculo.precoEng : 0;
        const totSI = arqV + engV;
        const semImpFator = 1 - aliqImp/100;
        const totCI = temImposto ? Math.round(totSI/semImpFator*100)/100 : totSI;
        const impostoV = temImposto ? Math.round((totCI-totSI)*100)/100 : 0;
        const isPadrao = tipoPgto === "padrao";
        const arqComDesc  = Math.round(arqV*(1-descArq/100)*100)/100;
        const totComDesc  = Math.round(totCI*(1-descPacote/100)*100)/100;
        const inpS = { width:44, textAlign:"center", border:"1px solid #c8cdd6", borderRadius:6, padding:"3px 4px", fontSize:12, fontWeight:600, outline:"none", fontFamily:"inherit", background:"#fff", color:"#111" };
        const cardSty = (sel) => ({ border:`1.5px solid ${sel?"#111":"#e5e7eb"}`, borderRadius:12, padding:"14px 16px", marginBottom:10, cursor:"pointer", background:"#fff", transition:"border-color 0.15s" });
        const radioCircle = (sel) => ({ width:18, height:18, borderRadius:9, border:`1.5px solid ${sel?"#111":"#9aa0ab"}`, background:sel?"#111":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 });
        return (
          <>
            <style>{`
              @keyframes fadeInOvr { from{opacity:0} to{opacity:1} }
              @keyframes slideUpSht { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
            `}</style>
            <div onClick={() => setShowModal(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:9000, animation:"fadeInOvr 0.25s ease" }}>
              <div onClick={e=>e.stopPropagation()} style={{
                position:"fixed", bottom:0, left:0, right:0, maxHeight:"90vh", overflowY:"auto",
                background:"#fff", borderRadius:"20px 20px 0 0", padding:"24px 20px 36px",
                animation:"slideUpSht 0.35s cubic-bezier(0.32,0.72,0,1)", zIndex:9001,
              }}>
                <div style={{ width:36, height:4, background:"#e5e7eb", borderRadius:2, margin:"0 auto 18px" }} />
                <div style={{ fontSize:17, fontWeight:700, color:"#111", marginBottom:4 }}>Gerar Orçamento</div>
                <div style={{ fontSize:12, color:"#828a98", marginBottom:20 }}>
                  {tipoProjeto} · {tipoObra} · Padrão {padrao} · {tipologia} · Ambientes {tamanho}s
                </div>

                <div style={{ background:"#f4f5f7", borderRadius:12, padding:"14px 16px", marginBottom:20 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontSize:12, color:"#6b7280" }}>Arquitetura</span>
                    <span style={{ fontSize:13, fontWeight:600, color:"#111" }}>{fmtV(arqV)}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontSize:12, color:"#6b7280" }}>Engenharia</span>
                    <span style={{ fontSize:13, fontWeight:600, color:"#111" }}>{fmtV(engV)}</span>
                  </div>
                  {temImposto && <>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                      <span style={{ fontSize:12, color:"#6b7280" }}>Subtotal sem impostos</span>
                      <span style={{ fontSize:12, color:"#6b7280" }}>{fmtV(totSI)}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                      <span style={{ fontSize:12, color:"#ef4444" }}>+ Impostos ({aliqImp}%)</span>
                      <span style={{ fontSize:12, color:"#ef4444" }}>+{fmtV(impostoV)}</span>
                    </div>
                  </>}
                  <div style={{ display:"flex", justifyContent:"space-between", paddingTop:10, borderTop:"1px solid #c8cdd6" }}>
                    <span style={{ fontSize:14, fontWeight:700, color:"#111" }}>Total Geral</span>
                    <span style={{ fontSize:16, fontWeight:800, color:"#111" }}>{fmtV(totCI)}</span>
                  </div>
                </div>

                <div style={{ background:"#f5f6f8", border:"1px solid #f0f0f0", borderRadius:12, padding:"12px 14px", marginBottom:16, display:"flex", alignItems:"center", gap:10 }}>
                  <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", flex:1 }}>
                    <input type="checkbox" checked={temImposto} onChange={e=>setTemImposto(e.target.checked)} />
                    <span style={{ fontSize:13, color:"#374151", fontWeight:500 }}>Incluir Impostos</span>
                  </label>
                  {temImposto && (
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <input type="number" min="0" max="50" step="0.5" style={inpS} value={aliqImp} onChange={e=>setAliqImp(parseFloat(e.target.value)||0)} />
                      <span style={{ fontSize:12, color:"#828a98" }}>%</span>
                    </div>
                  )}
                </div>

                <div style={{ fontSize:11, color:"#828a98", textTransform:"uppercase", letterSpacing:1, marginBottom:10, fontWeight:600 }}>Forma de pagamento</div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, alignItems:"start" }}>

                  <div style={cardSty(isPadrao)} onClick={()=>setTipoPgto("padrao")}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: isPadrao ? 12 : 0 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:"#111" }}>Pagamento Padrão</div>
                        <div style={{ fontSize:11, color:"#828a98", marginTop:2 }}>Antecipado ou parcelado</div>
                      </div>
                      <div style={radioCircle(isPadrao)}>{isPadrao && <span style={{ color:"#fff", fontSize:10, fontWeight:900 }}>✓</span>}</div>
                    </div>
                    {isPadrao && (
                      <div style={{ paddingTop:12, borderTop:"1px solid #f0f0f0" }} onClick={e=>e.stopPropagation()}>
                        <div style={{ background:"#f5f6f8", borderRadius:8, padding:"8px 10px", marginBottom:8 }}>
                          <div style={{ fontSize:11, color:"#374151", fontWeight:700, marginBottom:6 }}>Apenas Arquitetura</div>
                          <div style={{ marginBottom:5, paddingBottom:5, borderBottom:"1px solid #f0f0f0" }}>
                            <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Antecipado</div>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <input type="number" min="0" max="50" style={inpS} value={descArq} onChange={e=>setDescArq(parseFloat(e.target.value)||0)} />
                              <span style={{ fontSize:10, color:"#8e8e93" }}>% OFF → {fmtV(arqComDesc)}</span>
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Parcelado</div>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <input type="number" min="1" max="24" style={inpS} value={parcArq} onChange={e=>setParcArq(parseInt(e.target.value)||3)} />
                              <span style={{ fontSize:10, color:"#8e8e93" }}>× → {fmtV(arqV/(parcArq||3))}/mês</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ background:"#f5f6f8", borderRadius:8, padding:"8px 10px" }}>
                          <div style={{ fontSize:11, color:"#374151", fontWeight:700, marginBottom:6 }}>Pacote (Arq. + Eng.)</div>
                          <div style={{ marginBottom:5, paddingBottom:5, borderBottom:"1px solid #f0f0f0" }}>
                            <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Antecipado</div>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <input type="number" min="0" max="50" style={inpS} value={descPacote} onChange={e=>setDescPacote(parseFloat(e.target.value)||0)} />
                              <span style={{ fontSize:10, color:"#8e8e93" }}>% OFF → {fmtV(totComDesc)}</span>
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Parcelado</div>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <input type="number" min="1" max="24" style={inpS} value={parcPacote} onChange={e=>setParcPacote(parseInt(e.target.value)||4)} />
                              <span style={{ fontSize:10, color:"#8e8e93" }}>× → {fmtV(totCI/(parcPacote||4))}/mês</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={cardSty(!isPadrao)} onClick={()=>setTipoPgto("etapas")}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: !isPadrao ? 12 : 0 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:"#111" }}>Pagamento por Etapas</div>
                        <div style={{ fontSize:11, color:"#828a98", marginTop:2 }}>Desconto por etapa</div>
                      </div>
                      <div style={radioCircle(!isPadrao)}>{!isPadrao && <span style={{ color:"#fff", fontSize:10, fontWeight:900 }}>✓</span>}</div>
                    </div>
                    {!isPadrao && (
                      <div style={{ paddingTop:12, borderTop:"1px solid #f0f0f0", display:"grid", gridTemplateColumns:"1fr 1.5fr", gap:8 }} onClick={e=>e.stopPropagation()}>
                        <div>
                          <div style={{ background:"#f5f6f8", borderRadius:8, padding:"8px 10px", marginBottom:8 }}>
                            <div style={{ fontSize:11, color:"#374151", fontWeight:700, marginBottom:6 }}>Etapa a Etapa</div>
                            <div style={{ marginBottom:5, paddingBottom:5, borderBottom:"1px solid #f0f0f0" }}>
                              <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Antecipado</div>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <input type="number" min="0" max="50" style={inpS} value={descEtCtrt} onChange={e=>setDescEtCtrt(parseFloat(e.target.value)||0)} />
                                <span style={{ fontSize:10, color:"#8e8e93" }}>% OFF/etapa</span>
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Parcelado</div>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <input type="number" min="1" max="12" style={inpS} value={parcEtCtrt} onChange={e=>setParcEtCtrt(parseInt(e.target.value)||2)} />
                                <span style={{ fontSize:10, color:"#8e8e93" }}>×/etapa</span>
                              </div>
                            </div>
                          </div>
                          <div style={{ background:"#f5f6f8", borderRadius:8, padding:"8px 10px" }}>
                            <div style={{ fontSize:11, color:"#374151", fontWeight:700, marginBottom:6 }}>Pacote Completo</div>
                            <div style={{ marginBottom:5, paddingBottom:5, borderBottom:"1px solid #f0f0f0" }}>
                              <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Antecipado</div>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <input type="number" min="0" max="50" style={inpS} value={descPacCtrt} onChange={e=>setDescPacCtrt(parseFloat(e.target.value)||0)} />
                                <span style={{ fontSize:10, color:"#8e8e93" }}>% OFF → {fmtV(Math.round(totCI*(1-descPacCtrt/100)*100)/100)}</span>
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Parcelado</div>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <input type="number" min="1" max="24" style={inpS} value={parcPacCtrt} onChange={e=>setParcPacCtrt(parseInt(e.target.value)||8)} />
                                <span style={{ fontSize:10, color:"#8e8e93" }}>× → {fmtV(Math.round(totCI*(1-descPacCtrt/100)/parcPacCtrt*100)/100)}/mês</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{ background:"#f5f6f8", borderRadius:8, padding:"8px 10px" }}>
                          <div style={{ fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1, marginBottom:8, fontWeight:600 }}>Etapas</div>
                          {(() => {
                            const totalPct = etapasPct.reduce((s,e)=>s+e.pct,0);
                            return (<>
                              {etapasPct.filter(et => et.id !== 5).map((et, i) => {
                                const arqCIModal = temImposto && arqV > 0 ? Math.round(arqV / (1 - aliqImp/100) * 100) / 100 : arqV;
                                const val = Math.round(arqCIModal * et.pct/100 * 100)/100;
                                return (
                                  <div key={et.id} style={{ display:"flex", alignItems:"center", gap:5, marginBottom:5 }}>
                                    <input
                                      style={{ flex:1, border:"none", borderBottom:"1px solid #c8cdd6", background:"transparent", fontSize:11, color:"#374151", outline:"none", fontFamily:"inherit", padding:"1px 0", minWidth:0 }}
                                      value={et.nome}
                                      onChange={e=>setEtapasPct(prev=>prev.map((p,j)=>j===i?{...p,nome:e.target.value}:p))}
                                    />
                                    <div style={{ display:"flex", alignItems:"center", gap:2, flexShrink:0 }}>
                                      <input type="number" min="0" max="100"
                                        style={{ width:40, textAlign:"center", border:"1px solid #c8cdd6", borderRadius:5, padding:"1px 4px", fontSize:11, fontWeight:600, outline:"none", fontFamily:"inherit", background:"#fff" }}
                                        value={et.pct}
                                        onChange={e=>setEtapasPct(prev=>prev.map((p,j)=>j===i?{...p,pct:parseFloat(e.target.value)||0}:p))}
                                      />
                                      <span style={{ color:"#828a98", fontSize:10 }}>%</span>
                                    </div>
                                    <span style={{ color:"#374151", fontWeight:600, fontSize:10, whiteSpace:"nowrap", minWidth:72, textAlign:"right" }}>{fmtV(val)}</span>
                                    <span
                                      onClick={()=>setEtapasIsoladas(prev => { const s=new Set(prev); s.has(et.id)?s.delete(et.id):s.add(et.id); return s; })}
                                      title={etapasIsoladas.has(et.id) ? "Cancelar orçamento isolado" : "Incluir neste orçamento isolado"}
                                      style={{ cursor:"pointer", fontSize:10, flexShrink:0, width:16, height:16, borderRadius:"50%",
                                        border:`1.5px solid ${etapasIsoladas.has(et.id)?"#111":"#9aa0ab"}`,
                                        background: etapasIsoladas.has(et.id)?"#111":"transparent",
                                        display:"flex", alignItems:"center", justifyContent:"center",
                                        color: etapasIsoladas.has(et.id)?"#fff":"#d1d5db", lineHeight:1 }}>
                                      ◎
                                    </span>
                                    {etapasPct.length > 1 && (
                                      <span onClick={()=>{ setEtapasPct(prev=>prev.filter((_,j)=>j!==i)); setEtapasIsoladas(prev=>{const s=new Set(prev);s.delete(et.id);return s;}); }} style={{ color:"#d1d5db", cursor:"pointer", fontSize:11, flexShrink:0 }}>✕</span>
                                    )}
                                  </div>
                                );
                              })}
                              <div style={{ display:"flex", justifyContent:"space-between", paddingTop:5, borderTop:"1px solid #c8cdd6", marginTop:2 }}>
                                <span style={{ fontSize:10, color: totalPct===100?"#828a98":"#ef4444", fontWeight:600 }}>{totalPct}%</span>
                                <span style={{ fontSize:10, fontWeight:700, color:"#111" }}>{fmtV(Math.round((temImposto&&arqV>0?Math.round(arqV/(1-aliqImp/100)*100)/100:arqV)*totalPct/100*100)/100)}</span>
                              </div>
                              {etapasIsoladas.size > 0 && (
                                <div style={{ marginTop:5, padding:"4px 8px", background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:5, fontSize:10, color:"#0369a1" }}>
                                  ◎ Orçamento isolado: {etapasPct.filter(e=>etapasIsoladas.has(e.id)).map(e=>e.nome).join(", ")}
                                </div>
                              )}
                              <button onClick={()=>setEtapasPct(prev=>[...prev,{id:Date.now(),nome:`Etapa ${prev.length+1}`,pct:0}])}
                                style={{ marginTop:5, fontSize:10, color:"#374151", background:"#fff", border:"1px solid #c8cdd6", borderRadius:5, padding:"2px 6px", cursor:"pointer", fontFamily:"inherit", width:"100%" }}>
                                + Etapa
                              </button>
                            </>);
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                </div>

                <button
                  style={{ width:"100%", marginTop:8, background:"#111", color:"#fff", border:"none", borderRadius:12, padding:"15px 0", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}
                  onClick={() => {
                    setPropostaData({
                      tipoProjeto, tipoObra, padrao, tipologia, tamanho,
                      clienteNome, referencia,
                      comodos: Object.entries(qtds).filter(([,q])=>q>0).map(([nome,qtd])=>({nome,qtd})),
                      resumoDescritivo: (() => {
                        const fmtN2 = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
                        const fmtArea = v => v > 0 ? fmtN2(v)+"m²" : null;
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
                          return `Conjunto comercial, contendo ${lista}, totalizando ${fmtArea(c.areaTot||c.areaTotal)}.`;
                        }
                        const nUnid = calculo?.nRep || 1;
                        const areaUni = calculo?.areaTotal || calculo?.areaTot || 0;
                        const areaTotR = Math.round(areaUni * nUnid * 100)/100;
                        const comAtivos = Object.entries(qtds).filter(([,q])=>q>0).map(([n])=>n.toLowerCase());
                        const totalAmb = Object.entries(qtds).filter(([,q])=>q>0).reduce((s,[,q])=>s+q,0);
                        const listaStr = comAtivos.length>1 ? comAtivos.slice(0,-1).join(", ")+" e "+comAtivos[comAtivos.length-1] : comAtivos[0]||"";
                        const tipDesc = (tipologia||"").toLowerCase().includes("sobrado") ? "com dois pavimentos" : "térrea";
                        const numFem = ["","uma","duas","três","quatro","cinco","seis","sete","oito","nove","dez"];
                        if (nUnid>1) {
                          const nExt = nUnid>=1&&nUnid<=10 ? numFem[nUnid] : String(nUnid);
                          return `${nExt.charAt(0).toUpperCase()+nExt.slice(1)} residências ${tipDesc} idênticas, com ${fmtN2(areaUni)}m² por unidade, totalizando ${fmtN2(areaTotR)}m² de área construída. Cada unidade composta por ${totalAmb} ambientes: ${listaStr}.`;
                        }
                        return `Uma residência ${tipDesc}, com ${fmtN2(areaUni)}m² de área construída, composta por ${totalAmb} ambientes: ${listaStr}.`;
                      })(),
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
                    setOrcPendente(null);
                    setShowModal(false);
                  }}>
                  Confirmar e Gerar Orçamento
                </button>
                <button
                  style={{ width:"100%", marginTop:8, background:"transparent", color:"#828a98", border:"none", padding:"12px 0", fontSize:14, cursor:"pointer", fontFamily:"inherit" }}
                  onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {aberto && (
        <div style={{
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

