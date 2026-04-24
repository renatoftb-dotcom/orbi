// ═══════════════════════════════════════════════════════════════
// CLIENTES — Kanban + visual minimalista
// ═══════════════════════════════════════════════════════════════
// Helpers de permissão (getUsuarioAtual, getNivelUsuario, getPermissoes)
// agora vivem em shared.jsx — centralizados e sem duplicação.

// Diagnóstico em dev: `__vickeDebugAuth()` no console mostra o que o app acha do seu usuário.
// Mantido no clientes.jsx por ser o módulo mais usado durante debug.
// Em produção (build), o Vite remove o bloco via DCE quando import.meta.env.DEV é false.
if (typeof window !== "undefined" && typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV) {
  window.__vickeDebugAuth = () => {
    const u = getUsuarioAtual();
    const n = getNivelUsuario();
    const p = getPermissoes();
    console.log("=== Vicke Auth Debug ===");
    console.log("Token JWT decodado:", u);
    console.log("Nível efetivo:", n);
    console.log("Permissões:", p);
    return { usuario: u, nivel: n, permissoes: p };
  };
}

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

// Colunas do Kanban: 2 estados baseados no campo `ativo` do cliente.
// - ativos: cliente com trabalhos em aberto ou potencial
// - inativos: cliente sem serviço em aberto há 3 meses (automático via backend)
//             ou manualmente desativado
// O campo `key` é a string comparada a `(cliente.ativo !== false) ? "ativos" : "inativos"`.
const COLUNAS = [
  { key:"ativos",   label:"Ativos",   cor:"#10b981" },
  { key:"inativos", label:"Inativos", cor:"#9ca3af" },
];

// Helper: retorna a key da coluna a partir do cliente
function colunaDoCliente(c) {
  return (c?.ativo === false) ? "inativos" : "ativos";
}

// ═══════════════════════════════════════════════════════════════
// Helper: statusCliente(cliente, data) → retorna chips + status
// ═══════════════════════════════════════════════════════════════
// Retorna:
//   {
//     chips: [{ tipo, estado, info, alerta }...],  // serviços ativos
//     inativaEm: N ou null,                         // dias até inativar (se sem serviço)
//     temAtividade: boolean,                        // false = nada aberto
//   }
// Prioridade de chips: orçamento > projeto > obra
// "Serviço ativo" = mantém cliente ativo (não conta prazo de inativação)
function statusCliente(cliente, data) {
  // Proteção: se data é null/undefined ou cliente é inválido, retorna vazio
  if (!cliente || !data) {
    return { chips: [], inativaEm: null, temAtividade: false };
  }
  const chips = [];
  const orcamentos = (data.orcamentosProjeto || []).filter(o => o.clienteId === cliente.id);
  const projetos   = (data.projetos || []).filter(p => p.clienteId === cliente.id);
  const obras      = (data.obras || []).filter(o => o.clienteId === cliente.id);

  // ── ORÇAMENTOS ATIVOS (rascunho ou aberto) ────────────────
  const orcsRascunho = orcamentos.filter(o => o.status === "rascunho");
  const orcsAbertos  = orcamentos.filter(o => o.status === "aberto");

  // Classifica os abertos: enviados (com proposta em dia) x abertos-sem-proposta
  const enviados = [];
  const abertosSemProposta = [];
  for (const orc of orcsAbertos) {
    const propostas = orc.propostas || [];
    if (propostas.length > 0) {
      const ultima = propostas[propostas.length - 1];
      if (ultima.enviadaEm) {
        const msEnv = new Date(ultima.enviadaEm).getTime();
        const diasPassados = Math.floor((Date.now() - msEnv) / (1000 * 60 * 60 * 24));
        const diasExp = 30 - diasPassados;
        if (diasExp > 0) {
          enviados.push({ orc, diasExp });
          continue;
        }
      }
    }
    abertosSemProposta.push(orc);
  }

  // Agrupa enviados: 1 chip só com contagem e menor prazo
  if (enviados.length > 0) {
    const minDias = Math.min(...enviados.map(e => e.diasExp));
    chips.push({
      tipo: enviados.length > 1 ? `${enviados.length} Orçamentos` : "1 Orçamento",
      estado: "Enviado",
      info: `Exp. ${minDias}d`,
      alerta: minDias <= 7 ? "vermelho" : (minDias <= 15 ? "amarelo" : null),
    });
  }

  // Abertos sem proposta enviada
  if (abertosSemProposta.length > 0) {
    chips.push({
      tipo: abertosSemProposta.length > 1 ? `${abertosSemProposta.length} Orçamentos` : "1 Orçamento",
      estado: "Aberto",
    });
  }

  // Rascunhos
  if (orcsRascunho.length > 0) {
    chips.push({
      tipo: orcsRascunho.length > 1 ? `${orcsRascunho.length} Orçamentos` : "1 Orçamento",
      estado: "Rascunho",
    });
  }

  // ── PROJETOS EM ANDAMENTO ─────────────────────────────────
  // Agrupa por etapa
  const ETAPAS_LABEL = {
    briefing: "Briefing",
    preliminar: "Preliminar",
    prefeitura: "Prefeitura",
    executivo: "Executivo",
    engenharia: "Engenharia",
  };
  const projsPorEtapa = {};
  for (const p of projetos) {
    const et = p.colunaEtapa || "briefing";
    projsPorEtapa[et] = (projsPorEtapa[et] || 0) + 1;
  }
  for (const et of Object.keys(projsPorEtapa)) {
    const n = projsPorEtapa[et];
    chips.push({
      tipo: n > 1 ? `${n} Projetos` : "1 Projeto",
      estado: ETAPAS_LABEL[et] || et,
    });
  }

  // ── OBRAS EM ANDAMENTO ────────────────────────────────────
  const obrasAndamento = obras.filter(o => o.status !== "concluida");
  const obrasConcluidas = obras.filter(o => o.status === "concluida");
  if (obrasAndamento.length > 0) {
    chips.push({
      tipo: obrasAndamento.length > 1 ? `${obrasAndamento.length} Obras` : "1 Obra",
      estado: "Em andamento",
    });
  }
  if (obrasConcluidas.length > 0 && chips.length === 0) {
    // Só mostra obras concluídas se não tem nada ativo
    chips.push({
      tipo: obrasConcluidas.length > 1 ? `${obrasConcluidas.length} Obras` : "1 Obra",
      estado: "Concluída",
    });
  }

  const temAtividade = chips.length > 0 && !chips.every(c => c.estado === "Concluída");

  // ── SEM ATIVIDADE ─────────────────────────────────────────
  // Calcula data do último serviço concluído (orçamento perdido/ganho, obra concluída, etc)
  let inativaEm = null;
  if (!temAtividade) {
    // Data mais recente de conclusão
    let ultimaConclusao = null;
    for (const o of orcamentos) {
      const d = o.concluidoEm || o.expirouEm;
      if (d && (!ultimaConclusao || d > ultimaConclusao)) ultimaConclusao = d;
    }
    for (const o of obras) {
      const d = o.concluidaEm;
      if (d && (!ultimaConclusao || d > ultimaConclusao)) ultimaConclusao = d;
    }
    // Fallback: criação do cliente
    if (!ultimaConclusao) ultimaConclusao = cliente.criadoEm || cliente.desde || new Date().toISOString();

    const diasPassados = Math.floor((Date.now() - new Date(ultimaConclusao).getTime()) / (1000 * 60 * 60 * 24));
    inativaEm = 90 - diasPassados;
  }

  return { chips, inativaEm, temAtividade };
}

function ClienteExpandivel({ cliente, data, waLink, isMobile }) {
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
          <div style={{ padding:"16px 0", display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 16 : 20, borderBottom:"1px solid #f3f4f6" }}>
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
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap:10 }}>
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

function Clientes({ data, save, onAbrirOrcamento, abrirClienteDetail, onClienteDetailAberto, abrirCadastroNovo, onCadastroNovoAberto }) {
  // IMPORTANTE: Todos os hooks devem ser declarados ANTES de qualquer return condicional.
  // Ordem dos hooks deve ser constante entre renders (regra do React).
  const perm = getPermissoes();
  const [abrindoOrcamento, setAbrindoOrcamento] = useState(false);
  const [view, setView]               = useState("kanban");
  const [sel, setSel]                 = useState(null);
  const [busca, setBusca]             = useState("");
  const [dragId, setDragId]           = useState(null);
  const [dragOver, setDragOver]       = useState(null);
  const [isMobile, setIsMobile]       = useState(typeof window !== "undefined" && window.innerWidth < 768);
  const [abaKanban, setAbaKanban]     = useState("ativos");

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Ao retornar do orçamento, re-abre o detail do cliente que estava aberto
  useEffect(() => {
    if (abrirClienteDetail && data?.clientes) {
      // Pega a versão mais recente do cliente (em data) para não usar objeto stale
      const atualizado = data.clientes.find(c => c.id === abrirClienteDetail.id) || abrirClienteDetail;
      setSel(atualizado);
      setView("detail");
      if (onClienteDetailAberto) onClienteDetailAberto();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirClienteDetail]);

  // Ao receber sinal do módulo Orçamentos, abre direto o formulário de novo cliente
  useEffect(() => {
    if (abrirCadastroNovo) {
      // Inline (emptyCliente é declarado mais abaixo, não dá pra referenciar aqui)
      setForm({
        tipo:"PF", nome:"", cpfCnpj:"", email:"", cep:"", logradouro:"", numero:"",
        complemento:"", bairro:"", cidade:"", estado:"SP",
        contatos:[{ id:uid(), nome:"", telefone:"", cargo:"", whatsapp:false }],
        observacoes:"", ativo:true, desde: new Date().toISOString().slice(0,10),
        status:"",
        servicos:{ projeto:false, acompanhamentoObra:false, gestaoObra:false, empreendimento:false }
      });
      setView("form");
      if (onCadastroNovoAberto) onCadastroNovoAberto();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirCadastroNovo]);

  const emptyCliente = {
    tipo:"PF", nome:"", cpfCnpj:"", email:"", cep:"", logradouro:"", numero:"",
    complemento:"", bairro:"", cidade:"", estado:"SP",
    contatos:[{ id:uid(), nome:"", telefone:"", cargo:"", whatsapp:false }],
    observacoes:"", ativo:true, desde: new Date().toISOString().slice(0,10),
    status:"",
    servicos:{ projeto:false, acompanhamentoObra:false, gestaoObra:false, empreendimento:false }
  };
  const [form, setForm] = useState(emptyCliente);

  // Early return: só DEPOIS de todos os hooks serem declarados (regra do React)
  if (abrindoOrcamento) return null;

  // Proteção: se data ainda não carregou, renderiza loading
  if (!data || !Array.isArray(data.clientes)) {
    return (
      <div style={{ padding:"24px 28px", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
        <h2 style={{ color:"#111", fontWeight:700, fontSize:22, margin:0, letterSpacing:-0.5 }}>Clientes</h2>
        <div style={{ color:"#9ca3af", fontSize:13, marginTop:4 }}>Carregando…</div>
      </div>
    );
  }

  function openNew()     { setForm(emptyCliente); setView("form"); }
  function openEdit(c)   { setForm(c); setView("form"); }
  function openDetail(c) { setSel(c); setView("detail"); }

  function saveCliente() {
    if (!form.nome?.trim()) { dialogo.alertar({ titulo: "Informe o nome do cliente", tipo: "aviso" }); return; }
    const novos = form.id
      ? data.clientes.map(c => c.id === form.id ? form : c)
      : [...data.clientes, { ...form, id: uid() }];
    save({ ...data, clientes: novos });
    setView("kanban");
  }

  async function removeCliente(id) {
    const c = data.clientes.find(x => x.id === id);
    const nome = c?.nome || "este cliente";
    const ok = await dialogo.confirmar({
      titulo: "Remover cliente?",
      mensagem: `${nome} será removido. Esta ação não pode ser desfeita.`,
      confirmar: "Remover",
      destrutivo: true,
    });
    if (!ok) return;
    save({ ...data, clientes: data.clientes.filter(c => c.id !== id) });
    setView("kanban");
  }

  function moverCliente(id, novaColuna) {
    const agora = new Date().toISOString();
    const novos = data.clientes.map(c => {
      if (c.id !== id) return c;
      if (novaColuna === "inativos") {
        // Inativa manualmente
        const obs = c.observacoes || "";
        const dataFmt = new Date().toLocaleDateString("pt-BR");
        const marcador = `[${dataFmt}] Cliente inativado manualmente.`;
        return {
          ...c,
          ativo: false,
          inativadoEm: agora,
          inativadoAutomaticamente: false,
          observacoes: obs.includes(marcador) ? obs : (obs ? `${obs}\n\n${marcador}` : marcador),
        };
      } else {
        // Reativa (ativos)
        return {
          ...c,
          ativo: true,
          inativadoEm: null,
          inativadoAutomaticamente: false,
        };
      }
    });
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

  // ── Card de cliente — reutilizado em mobile e desktop ────────
  function ClienteCard({ c, mobile }) {
    const status = statusCliente(c, data);
    const isInativo = colunaDoCliente(c) === "inativos";

    // Texto secundário (linha 2 do card)
    const renderStatusLinha = () => {
      // Cliente inativo: mostra quando foi inativado
      if (isInativo) {
        if (c.inativadoAutomaticamente && c.inativadoEm) {
          const meses = Math.floor((Date.now() - new Date(c.inativadoEm).getTime()) / (1000 * 60 * 60 * 24 * 30));
          return <span style={{ color:"#9ca3af" }}>Inativo há {meses} {meses === 1 ? "mês" : "meses"} · automático</span>;
        }
        if (c.inativadoEm) {
          return <span style={{ color:"#9ca3af" }}>Inativado em {new Date(c.inativadoEm).toLocaleDateString("pt-BR", { day:"2-digit", month:"short" }).replace(".", "")}</span>;
        }
        return <span style={{ color:"#9ca3af" }}>Inativo</span>;
      }

      // Sem atividade: mostra "cliente inativa em X dias"
      if (!status.temAtividade) {
        if (status.inativaEm != null) {
          if (status.inativaEm <= 0) {
            return <span style={{ color:"#b91c1c" }}>Será inativado em breve</span>;
          }
          if (status.inativaEm <= 15) {
            return <span style={{ color:"#b91c1c", fontWeight:500 }}>⚠ Inativa em {status.inativaEm} dias</span>;
          }
          if (status.inativaEm <= 30) {
            return <span style={{ color:"#b45309" }}>Inativa em {status.inativaEm} dias</span>;
          }
          return <span style={{ color:"#9ca3af" }}>Sem serviço ativo</span>;
        }
        return <span style={{ color:"#9ca3af" }}>Novo cliente</span>;
      }

      // Cliente com serviços ativos: renderiza chips
      return status.chips.map((chip, i) => {
        const corAlerta = chip.alerta === "vermelho" ? "#b91c1c" : chip.alerta === "amarelo" ? "#b45309" : null;
        return (
          <span key={i} style={{ color:"#374151" }}>
            {i > 0 && <span style={{ color:"#d1d5db", margin:"0 6px" }}>·</span>}
            <span>{chip.tipo}</span>
            <span style={{ color:"#9ca3af" }}> ({chip.estado})</span>
            {chip.info && (
              <span style={{ color:corAlerta || "#9ca3af", marginLeft:4 }}>
                {corAlerta === "#b91c1c" ? "⚠ " : ""}{chip.info}
              </span>
            )}
          </span>
        );
      });
    };

    return (
      <div
        onClick={() => openDetail(c)}
        style={{
          background:"#fff", border:"1px solid #e5e7eb", borderRadius:8,
          padding:"10px 14px", marginBottom:6, cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"space-between", gap:10,
          transition:"border-color 0.15s",
        }}
        onMouseEnter={e=>e.currentTarget.style.borderColor="#d1d5db"}
        onMouseLeave={e=>e.currentTarget.style.borderColor="#e5e7eb"}>
        <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:2 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"#111", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {c.nome}
          </div>
          <div style={{ fontSize:11.5, lineHeight:1.4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {renderStatusLinha()}
          </div>
        </div>
        <div style={{ display:"flex", gap:4, alignItems:"center", flexShrink:0 }} onClick={e=>e.stopPropagation()}>
          {mobile ? (
            <select
              value={colunaDoCliente(c)}
              onChange={e => { e.stopPropagation(); moverCliente(c.id, e.target.value); }}
              onClick={e => e.stopPropagation()}
              style={{ fontSize:11, color:"#6b7280", background:"#fff", border:"1px solid #e5e7eb", borderRadius:5, padding:"4px 6px", cursor:"pointer", fontFamily:"inherit" }}>
              {COLUNAS.map(col => <option key={col.key} value={col.key}>{col.label}</option>)}
            </select>
          ) : (
            <button onClick={e=>{e.stopPropagation();openEdit(c);}}
              style={{ fontSize:11, color:"#9ca3af", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", padding:"4px 6px" }}
              title="Editar">⋯</button>
          )}
        </div>
      </div>
    );
  }

  // ── KANBAN ───────────────────────────────────────────────────
  if (view === "kanban") {
    const filtrados = data.clientes.filter(c => {
      if (!busca) return true;
      const b = busca.toLowerCase();
      return c.nome.toLowerCase().includes(b) || (c.cpfCnpj||"").includes(b) || (c.cidade||"").toLowerCase().includes(b);
    });

    // ── MOBILE: abas por coluna ──────────────────────────────
    if (isMobile) {
      const colAtual = COLUNAS.find(x => x.key === abaKanban) || COLUNAS[0];
      const cardsAba = filtrados.filter(c => colunaDoCliente(c) === abaKanban);
      return (
        <div style={{ fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", minHeight:"calc(100vh - 53px)", display:"flex", flexDirection:"column" }}>
          {/* Header mobile */}
          <div style={{ padding:"16px 16px 0", display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:17, fontWeight:700, color:"#111" }}>Clientes</div>
                <div style={{ fontSize:12, color:"#9ca3af" }}>{data.clientes.length} cadastrado{data.clientes.length!==1?"s":""}</div>
              </div>
              {perm.podeEditar && <button style={C.btn} onClick={openNew}>+ Novo</button>}
            </div>
            <input style={{ ...C.input }} placeholder="Buscar cliente..." value={busca} onChange={e=>setBusca(e.target.value)} />
          </div>

          {/* Abas */}
          <div style={{ display:"flex", overflowX:"auto", padding:"12px 16px 0", gap:0, borderBottom:"1px solid #f3f4f6" }}>
            {COLUNAS.map(col => {
              const count = filtrados.filter(c => colunaDoCliente(c) === col.key).length;
              const ativa = abaKanban === col.key;
              return (
                <button key={col.key} onClick={() => setAbaKanban(col.key)}
                  style={{ flexShrink:0, padding:"10px 16px", fontSize:13, fontWeight: ativa ? 700 : 400,
                    color: ativa ? col.cor : "#6b7280",
                    background:"transparent", border:"none", borderBottom: ativa ? `2px solid ${col.cor}` : "2px solid transparent",
                    cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ width:7, height:7, borderRadius:"50%", background: ativa ? col.cor : "#d1d5db", display:"inline-block", flexShrink:0 }} />
                  {col.label}
                  <span style={{ fontSize:11, background: ativa ? col.cor+"18" : "#f3f4f6", color: ativa ? col.cor : "#9ca3af", borderRadius:10, padding:"1px 7px", fontWeight:600 }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Cards da aba ativa */}
          <div style={{ flex:1, overflowY:"auto", padding:"12px 16px" }}>
            {cardsAba.length === 0 ? (
              <div style={{ textAlign:"center", padding:"48px 0", color:"#d1d5db", fontSize:13 }}>
                <div style={{ fontSize:28, marginBottom:8 }}>—</div>
                Nenhum cliente em {colAtual.label}
              </div>
            ) : (
              cardsAba.map(c => <ClienteCard key={c.id} c={c} mobile={true} />)
            )}
          </div>
        </div>
      );
    }

    // ── DESKTOP: kanban 4 colunas ────────────────────────────
    return (
      <div style={{ padding:"24px 28px", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", minHeight:"calc(100vh - 53px)", display:"flex", flexDirection:"column" }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:"#111" }}>Clientes</div>
            <div style={{ fontSize:13, color:"#9ca3af", marginTop:2 }}>{data.clientes.length} cadastrado{data.clientes.length!==1?"s":""}</div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input style={{ ...C.input, width:220 }} placeholder="Buscar..." value={busca} onChange={e=>setBusca(e.target.value)} />
            <button style={C.btnSec} onClick={() => setView("list")}>Lista</button>
            {perm.podeEditar && <button style={C.btn} onClick={openNew}>+ Novo cliente</button>}
          </div>
        </div>

        {/* Kanban 4 colunas */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:12, flex:1, overflowY:"auto", maxWidth:960 }}>
          {COLUNAS.map(col => {
            const cards = filtrados.filter(c => colunaDoCliente(c) === col.key);
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
                  {cards.map(c => (
                    <div key={c.id}
                      draggable
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => { setDragId(null); setDragOver(null); }}
                      style={{ opacity: dragId===c.id ? 0.4 : 1, transition:"opacity 0.15s", cursor:"grab", minWidth:0, overflow:"hidden" }}>
                      <ClienteCard c={c} mobile={false} />
                    </div>
                  ))}
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
      <div style={{ padding: isMobile ? "16px" : "28px 32px", fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
          <div style={{ fontSize:18, fontWeight:700, color:"#111" }}>Clientes</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <input style={{ ...C.input, width: isMobile ? "100%" : 220 }} placeholder="Buscar..." value={busca} onChange={e=>setBusca(e.target.value)} />
            {!isMobile && <button style={C.btnSec} onClick={()=>setView("kanban")}>Kanban</button>}
            {perm.podeEditar && <button style={C.btn} onClick={openNew}>+ Novo</button>}
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtrados.map(c => {
            const iniciais = c.nome.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase();
            const corAv = c.tipo==="PJ"?"#7c3aed":"#2563eb";
            const col = COLUNAS.find(x=>x.key===colunaDoCliente(c)) || COLUNAS[0];
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
                  <span style={C.tag(col.cor)}>{col.label}</span>
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
    const col = COLUNAS.find(x=>x.key===colunaDoCliente(cliente))||COLUNAS[0];
    return (
      <div style={{ padding: isMobile ? "16px" : "28px 32px", maxWidth:780, fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20, flexWrap:"wrap" }}>
          <button style={C.btnGhost} onClick={()=>setView("kanban")}>← Voltar</button>
          <div style={{ flex:1 }} />
          <select value={colunaDoCliente(cliente)} onChange={e=>moverCliente(cliente.id, e.target.value)}
            style={{ ...C.input, width:"auto", fontSize:12, padding:"6px 10px", cursor:"pointer" }}>
            {COLUNAS.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
          <button style={C.btnSec} onClick={()=>openEdit(cliente)}>Editar</button>
          {!isMobile && <button style={{...C.btnGhost,color:"#dc2626"}} onClick={()=>removeCliente(cliente.id)}>Remover</button>}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:24 }}>
          <div style={{ width: isMobile ? 44 : 56, height: isMobile ? 44 : 56, borderRadius:14, background:corAv+"15", color:corAv, display:"flex", alignItems:"center", justifyContent:"center", fontSize: isMobile ? 15 : 18, fontWeight:700, flexShrink:0 }}>{iniciais}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize: isMobile ? 16 : 20, fontWeight:700, color:"#111", overflow:"hidden", textOverflow:"ellipsis" }}>{cliente.nome}</div>
            <div style={{ fontSize:12, color:"#9ca3af", marginTop:3, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
              {!isMobile && cliente.cpfCnpj}
              <span style={C.tag(corAv)}>{cliente.tipo}</span>
              <span style={C.tag(col.cor)}>{col.label||"Sem status"}</span>
            </div>
          </div>
          {isMobile && <button style={{...C.btnGhost,color:"#dc2626",fontSize:12}} onClick={()=>removeCliente(cliente.id)}>Remover</button>}
        </div>
        <ClienteExpandivel cliente={cliente} data={data} waLink={waLink} isMobile={isMobile} />
        <hr style={C.divider} />
        <ServicosPanel cliente={cliente} data={data} save={save} onAbrirOrcamento={(c, orc, modo) => { setAbrindoOrcamento(true); onAbrirOrcamento(c, orc, modo); }} />
      </div>
    );
  }

  // ── FORMULÁRIO ───────────────────────────────────────────────
  return (
    <div style={{ padding: isMobile ? "16px" : "28px 32px", maxWidth:680, fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
        <button style={C.btnGhost} onClick={()=>setView("kanban")}>← Voltar</button>
        <div style={{ fontSize:17, fontWeight:700, color:"#111" }}>{form.id?"Editar cliente":"Novo cliente"}</div>
      </div>
      <div style={{ marginBottom:16 }}>
        <div style={C.secTit}>Tipo de pessoa</div>
        <div style={{ display:"flex", gap:8 }}>
          {[["PF","Pessoa física"],["PJ","Pessoa jurídica"]].map(([v,l])=>(
            <button key={v} onClick={()=>setForm({...form,tipo:v})}
              style={{ border:"1px solid #e5e7eb", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:form.tipo===v?600:400, background:form.tipo===v?"#111":"#fff", color:form.tipo===v?"#fff":"#6b7280", cursor:"pointer", fontFamily:"inherit" }}>{l}</button>
          ))}
        </div>
      </div>
      <hr style={C.divider} />
      <div style={{ marginBottom:16 }}>
        <div style={C.secTit}>Dados principais</div>
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:12, marginBottom:12 }}>
          <div><label style={C.label}>{form.tipo==="PJ"?"Razão social":"Nome completo"} *</label><input style={C.input} value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} /></div>
          <div><label style={C.label}>{form.tipo==="PJ"?"CNPJ":"CPF"}</label><input style={C.input} value={form.cpfCnpj} onChange={e=>setForm({...form,cpfCnpj:e.target.value})} /></div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:12, marginBottom:12 }}>
          <div><label style={C.label}>E-mail</label><input style={C.input} type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
          <div><label style={C.label}>Cliente desde</label><input style={C.input} type="date" value={form.desde} onChange={e=>setForm({...form,desde:e.target.value})} /></div>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:"#374151"}}>
          <input type="checkbox" checked={form.ativo} onChange={e=>setForm({...form,ativo:e.target.checked})} /> Cliente ativo
        </label>
      </div>
      <hr style={C.divider} />
      <div style={{ marginBottom:16 }}>
        <div style={C.secTit}>Endereço</div>
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap:10, marginBottom:10 }}>
          <div><label style={C.label}>CEP</label><input style={C.input} value={form.cep} onChange={e=>{setForm({...form,cep:e.target.value});buscarCEP(e.target.value);}} placeholder="00000-000" /></div>
          <div><label style={C.label}>Número</label><input style={C.input} value={form.numero} onChange={e=>setForm({...form,numero:e.target.value})} /></div>
          {!isMobile && <div><label style={C.label}>Complemento</label><input style={C.input} value={form.complemento} onChange={e=>setForm({...form,complemento:e.target.value})} /></div>}
        </div>
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap:10, marginBottom:10 }}>
          <div><label style={C.label}>Logradouro</label><input style={C.input} value={form.logradouro} onChange={e=>setForm({...form,logradouro:e.target.value})} /></div>
          {isMobile && <div><label style={C.label}>Complemento</label><input style={C.input} value={form.complemento} onChange={e=>setForm({...form,complemento:e.target.value})} /></div>}
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
            <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap:10, marginBottom:10 }}>
              <div style={isMobile ? { gridColumn:"1 / -1" } : {}}><label style={C.label}>Nome</label><input style={C.input} value={ct.nome} onChange={e=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,nome:e.target.value}:x)})} /></div>
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

function ServicosPanel({ cliente: clienteProp, data, save, onAbrirOrcamento }) {
  const perm = getPermissoes();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const [openMenu, setOpenMenu] = useState(null);
  const [propostaVisualizada, setPropostaVisualizada] = useState(null);
  const [orcGanho, setOrcGanho] = useState(null);
  // Visualização (persistida em localStorage, compartilhada com a página Orçamentos)
  const [viz, setViz] = useVisualizacaoOrcamentos();
  // Ordenação (reseta a cada abertura) e filtros por coluna
  const [sort, setSort] = useState({ col: "cliente", dir: "asc" });
  const [filtrosCol, setFiltrosCol] = useState({ clientes: new Set(), tipos: new Set(), status: new Set() });
  // Seleção em massa (tabela) + modal de confirmação + modo ativável
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState(new Set());
  const [confirmExcluirMassa, setConfirmExcluirMassa] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!openMenu) return;
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenu]);

  const cliente = data.clientes.find(c => c.id === clienteProp.id) || clienteProp;

  // Fonte única de verdade: data.orcamentosProjeto. Sem state local ou fetch paralelo —
  // qualquer save() na aplicação re-renderiza este componente com os dados atualizados,
  // mantendo sincronia com o módulo de Orçamentos do menu.
  const orcamentos = (data.orcamentosProjeto || []).filter(o => o.clienteId === cliente.id);



  // ── Subview: módulo orçamento-teste ─────────────────────────
  // ── Card principal ───────────────────────────────────────────
  const temProjeto = cliente.servicos?.projeto;
  const fmt = v => "R$ " + (v||0).toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });

  const STATUS_ORC = {
    rascunho:{ label:"Rascunho",cor:"#6b7280", bg:"#f9fafb" },
    ganho:   { label:"Ganho",   cor:"#16a34a", bg:"#f0fdf4" },
    perdido: { label:"Perdido", cor:"#dc2626", bg:"#fef2f2" },
  };

  async function setStatusOrc(orcId, novoStatus) {
    const todos = data.orcamentosProjeto || [];
    const orc = todos.find(o => o.id === orcId);
    let novosLanc = data.receitasFinanceiro || [];
    let novosProjetos = data.projetos || [];
    const agora = new Date().toISOString();

    // Se reverte ganho → perdido, remove lançamentos e projeto associado
    if (orc?.status === "ganho" && novoStatus === "perdido") {
      novosLanc = novosLanc.filter(r => r.orcId !== orcId);
      novosProjetos = novosProjetos.filter(p => p.orcId !== orcId);
    }

    const novosOrc = todos.map(o => {
      if (o.id !== orcId) return o;
      const atualizado = { ...o, status: novoStatus };
      // Registra data de conclusão quando sai de aberto/rascunho
      if (novoStatus === "perdido" || novoStatus === "ganho") {
        atualizado.concluidoEm = o.concluidoEm || agora;
        if (novoStatus === "ganho") atualizado.ganhoEm = o.ganhoEm || agora;
      }
      // Reabrindo: limpa concluidoEm
      if (novoStatus === "rascunho" || novoStatus === "aberto") {
        delete atualizado.concluidoEm;
      }
      return atualizado;
    });

    await save({ ...data, orcamentosProjeto: novosOrc, receitasFinanceiro: novosLanc, projetos: novosProjetos });
  }

  // Confirma ganho do orçamento com os dados do ModalConfirmarGanho (escopo, valores, condição)
  async function confirmarGanho(ganhoData) {
    const orc = orcGanho;
    if (!orc) return;
    const todos = data.orcamentosProjeto || [];
    const agora = new Date().toISOString();

    // Cria projeto automaticamente (se ainda não existir)
    const projetosAtuais = data.projetos || [];
    const jaExiste = projetosAtuais.some(p => p.orcId === orc.id);
    const novosProjetos = jaExiste ? projetosAtuais : [
      ...projetosAtuais,
      {
        id: "PRJ-" + Date.now(),
        orcId: orc.id,
        clienteId: orc.clienteId,
        tipo: orc.tipo,
        subtipo: orc.subtipo,
        padrao: orc.padrao,
        tamanho: orc.tamanho,
        referencia: orc.referencia || "",
        areaTotal: orc.resultado?.areaTotal || 0,
        colunaEtapa: "briefing",
        criadoEm: agora,
      },
    ];

    // Atualiza o orçamento: status ganho + fechamento
    const novosOrc = todos.map(o =>
      o.id === orc.id
        ? {
            ...o,
            status: "ganho",
            concluidoEm: o.concluidoEm || agora,
            ganhoEm: o.ganhoEm || agora,
            fechamento: {
              ...ganhoData,
              fechadoEm: agora,
            },
          }
        : o
    );

    await save({ ...data, orcamentosProjeto: novosOrc, projetos: novosProjetos }).catch(console.error);
    setOrcGanho(null);
  }

  async function excluirOrcamento(orcId) {
    const orc = (data.orcamentosProjeto||[]).find(x => x.id === orcId);
    const ref = orc?.id || "orçamento";
    const ok = await dialogo.confirmar({
      titulo: `Excluir ${ref}?`,
      mensagem: "Esta ação não pode ser desfeita.",
      confirmar: "Excluir",
      destrutivo: true,
    });
    if (!ok) return;
    const novos = (data.orcamentosProjeto||[]).filter(x => x.id !== orcId);
    save({ ...data, orcamentosProjeto: novos }).catch(console.error);
  }

  async function excluirOrcamentosEmMassa() {
    const ids = selecionados;
    const novos = (data.orcamentosProjeto||[]).filter(x => !ids.has(x.id));
    setConfirmExcluirMassa(false);
    try {
      await save({ ...data, orcamentosProjeto: novos });
      setSelecionados(new Set());
    } catch (e) {
      console.error("Erro ao excluir em massa:", e);
    }
  }

  function ativarProjeto() {
    const novosServicos = { ...cliente.servicos, projeto: true };
    const novosClientes = data.clientes.map(c => c.id===cliente.id ? { ...c, servicos:novosServicos } : c);
    save({ ...data, clientes: novosClientes });
  }

  return (
    <div style={{ fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif" }}>

      {/* ── Header serviços ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1 }}>Serviços</div>
        {!temProjeto && (
          <button
            onClick={ativarProjeto}
            style={{ background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"8px 16px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            + Adicionar Serviço
          </button>
        )}
      </div>

      {/* ── Sem serviço ── */}
      {!temProjeto && (
        <div style={{ border:"1px dashed #e5e7eb", borderRadius:12, padding:"32px", textAlign:"center", color:"#9ca3af", fontSize:13 }}>
          Nenhum serviço cadastrado. Clique em "+ Adicionar Serviço" para começar.
        </div>
      )}

      {/* ── Serviço Projeto ── */}
      {temProjeto && (
        <div style={{ border:"1px solid #e5e7eb", borderRadius:12, padding:"16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: orcamentos.length > 0 ? 14 : 0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#3b82f6" }} />
              <span style={{ fontSize:14, fontWeight:600, color:"#111" }}>Projeto</span>
            </div>
            {perm.podeEditar && (
              <button
                onClick={() => onAbrirOrcamento(cliente, null)}
                style={{ background:"#fff", color:"#111", border:"1px solid #e5e7eb", borderRadius:8, padding:"7px 16px", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
                Orçar projeto
              </button>
            )}
          </div>

          {/* Lista de orçamentos — tabela ou cards (mesma preferência da página Orçamentos) */}
          {orcamentos.length > 0 && (() => {
            // Helper comum: prepara fetchOrc e onAction pra ambos os modos
            const mkFetchOrc = (o) => async (modo) => {
              // Usa api.orcamentos.get() em vez de fetch direto — assim o handler
              // global de 401 do api.js é acionado se o token expirar.
              let orcCompleto = o;
              try {
                const completo = await api.orcamentos.get(o.id);
                if (completo) orcCompleto = completo;
              } catch {
                // Em caso de erro, continua com o orçamento original (o da lista)
              }
              // Se clicou em "ver" e tem proposta enviada, abre o snapshot em vez do form.
              if (modo === "ver" && orcCompleto.propostas && orcCompleto.propostas.length > 0) {
                modo = "verProposta";
              }
              if (modo === "verProposta") {
                const ultima = orcCompleto.propostas && orcCompleto.propostas.length > 0
                  ? orcCompleto.propostas[orcCompleto.propostas.length - 1]
                  : null;
                if (ultima) {
                  setPropostaVisualizada({
                    ...ultima,
                    clienteNome: cliente.nome || "Cliente",
                    _orcOrigem: orcCompleto,
                  });
                  return;
                }
                modo = "ver";
              }
              onAbrirOrcamento(cliente, orcCompleto, modo);
            };
            const mkOnAction = async (acao, orc) => {
              if (perm.isVisualizador) { dialogo.alertar({ titulo: "Sem permissão", mensagem: "Você não tem permissão para esta ação.", tipo: "aviso" }); return; }
              if (acao === "ganho") {
                if (orc.status === "ganho") return;
                // Busca a versão completa pelo api.js (com handler de 401)
                let orcCompleto = orc;
                try {
                  const completo = await api.orcamentos.get(orc.id);
                  if (completo) orcCompleto = completo;
                } catch {
                  // Continua com o que tem
                }
                setOrcGanho(orcCompleto);
              }
              if (acao === "perdido") setStatusOrc(orc.id, orc.status === "perdido" ? "rascunho" : "perdido");
              if (acao === "excluir") {
                if (!perm.podeExcluir) { dialogo.alertar({ titulo: "Acesso restrito", mensagem: "Apenas administradores podem excluir.", tipo: "aviso" }); return; }
                excluirOrcamento(orc.id);
              }
            };

            // Handler de mudança de probabilidade (usado pelo ProbRing nos cards/tabela)
            const mkChangeProb = async (orc, novaProb) => {
              if (!perm.podeEditar) return;
              if (![25, 50, 75].includes(novaProb)) return;
              const todos = data.orcamentosProjeto || [];
              const novos = todos.map(o => o.id === orc.id ? { ...o, probabilidade: novaProb } : o);
              try {
                await save({ ...data, orcamentosProjeto: novos });
              } catch (e) {
                console.error("Erro ao atualizar probabilidade:", e);
              }
            };

            // Helpers pra ordenação
            const valorTotal = (o) => {
              const ult = o.propostas && o.propostas.length > 0 ? o.propostas[o.propostas.length - 1] : null;
              if (ult) {
                if (ult.valorTotalExibido != null) return ult.valorTotalExibido;
                const arq = ult.arqEdit != null ? ult.arqEdit : (ult.calculo?.precoArq || 0);
                const eng = ult.engEdit != null ? ult.engEdit : (ult.calculo?.precoEng || 0);
                return arq + eng;
              }
              return (o.resultado?.precoArq || 0) + (o.resultado?.precoEng || 0);
            };
            const diasParaVencer = (o) => {
              if ((o.status || "rascunho") !== "aberto") return null;
              const ult = o.propostas && o.propostas.length > 0 ? o.propostas[o.propostas.length - 1] : null;
              const v = ult?.validadeEdit || ult?.validadeStr;
              if (!v) return null;
              const m = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
              if (!m) return null;
              const validade = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
              const hoje = new Date(); hoje.setHours(0,0,0,0); validade.setHours(0,0,0,0);
              return Math.round((validade - hoje) / 86400000);
            };

            // Aplica filtros de coluna (clientes não se aplica aqui — só 1 cliente)
            const orcsFiltrados = orcamentos.filter(o => {
              if (filtrosCol.tipos.size > 0 && !filtrosCol.tipos.has(o.tipo || "—")) return false;
              if (filtrosCol.status.size > 0 && !filtrosCol.status.has(o.status || "rascunho")) return false;
              return true;
            });

            // Ordena
            const orcsOrdenados = [...orcsFiltrados].sort((a, b) => {
              const dir = sort.dir === "asc" ? 1 : -1;
              if (sort.col === "id") {
                const num = (id) => { const m = String(id || "").match(/(\d+)/); return m ? parseInt(m[1]) : 0; };
                return (num(a.id) - num(b.id)) * dir;
              }
              if (sort.col === "cliente") {
                return (a.referencia || "").localeCompare(b.referencia || "", "pt-BR") * dir;
              }
              if (sort.col === "tipo") {
                const aT = (a.tipo || "").toLowerCase(); const bT = (b.tipo || "").toLowerCase();
                if (aT !== bT) return aT.localeCompare(bT, "pt-BR") * dir;
                return ((a.resultado?.areaTotal || 0) - (b.resultado?.areaTotal || 0)) * dir;
              }
              if (sort.col === "criado") {
                const aD = a.criadoEm ? new Date(a.criadoEm).getTime() : 0;
                const bD = b.criadoEm ? new Date(b.criadoEm).getTime() : 0;
                return (aD - bD) * dir;
              }
              if (sort.col === "venc") {
                const aV = diasParaVencer(a); const bV = diasParaVencer(b);
                if (aV == null && bV == null) return 0;
                if (aV == null) return 1;
                if (bV == null) return -1;
                return (aV - bV) * dir;
              }
              if (sort.col === "status") {
                const ordem = { aberto: 0, rascunho: 1, ganho: 2, perdido: 3 };
                return ((ordem[a.status || "rascunho"] ?? 99) - (ordem[b.status || "rascunho"] ?? 99)) * dir;
              }
              if (sort.col === "total") return (valorTotal(a) - valorTotal(b)) * dir;
              return 0;
            });

            return (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, gap:8, flexWrap:"wrap" }}>
                  <div style={{ fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.5 }}>Orçamentos</div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    {viz === "cards" && <SortDropdown sort={sort} setSort={setSort} />}
                    <ToggleVisualizacao viz={viz} setViz={setViz} />
                  </div>
                </div>

                {/* Chips de filtros ativos */}
                {(filtrosCol.tipos.size > 0 || filtrosCol.status.size > 0) && (
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:8 }}>
                    {[...filtrosCol.tipos].map(v => (
                      <FiltroChip key={"t-"+v} label={`Tipo: ${v}`} onRemove={() => {
                        const n = new Set(filtrosCol.tipos); n.delete(v);
                        setFiltrosCol({ ...filtrosCol, tipos: n });
                      }} />
                    ))}
                    {[...filtrosCol.status].map(v => (
                      <FiltroChip key={"s-"+v} label={`Status: ${({rascunho:"Rascunho",aberto:"Em aberto",ganho:"Ganho",perdido:"Perdido"}[v] || v)}`} onRemove={() => {
                        const n = new Set(filtrosCol.status); n.delete(v);
                        setFiltrosCol({ ...filtrosCol, status: n });
                      }} />
                    ))}
                    <button
                      onClick={() => setFiltrosCol({ clientes: new Set(), tipos: new Set(), status: new Set() })}
                      style={{
                        fontSize:11.5, color:"#6b7280", background:"transparent",
                        border:"none", cursor:"pointer", padding:"3px 6px",
                        textDecoration:"underline", fontFamily:"inherit",
                      }}>
                      Limpar filtros
                    </button>
                  </div>
                )}

                {/* Barra de ações em massa (aparece enquanto o modo seleção está ligado) */}
                {viz === "tabela" && modoSelecao && (
                  <BarraSelecao
                    selecionados={selecionados}
                    totalVisivel={orcsOrdenados.length}
                    onSelecionarTodos={() => setSelecionados(new Set(orcsOrdenados.map(o => o.id)))}
                    onLimpar={() => setSelecionados(new Set())}
                    onExcluir={() => setConfirmExcluirMassa(true)}
                    onSair={() => { setSelecionados(new Set()); setModoSelecao(false); }}
                  />
                )}

                {orcsOrdenados.length === 0 ? (
                  <div style={{
                    padding:"24px", textAlign:"center", border:"1px dashed #e5e7eb",
                    borderRadius:9, color:"#9ca3af", fontSize:12.5, background:"#fafafa",
                  }}>
                    Nenhum orçamento corresponde aos filtros.
                  </div>
                ) : viz === "tabela" ? (
                  <div style={{ border:"1px solid #e5e7eb", borderRadius:9, background:"#fff", overflow:"visible" }}>
                    <OrcRowHeader
                      showCliente={false}
                      sort={sort} setSort={setSort}
                      filtrosCol={filtrosCol} setFiltrosCol={setFiltrosCol}
                      orcamentos={orcamentos} clientes={[cliente]}
                      modoSelecao={modoSelecao}
                      onToggleModoSelecao={perm.podeExcluir ? (() => setModoSelecao(true)) : null}
                      selecionados={selecionados}
                      totalVisivel={orcsOrdenados.length}
                      onToggleTodos={() => {
                        if (selecionados.size >= orcsOrdenados.length) setSelecionados(new Set());
                        else setSelecionados(new Set(orcsOrdenados.map(o => o.id)));
                      }}
                    />
                    {orcsOrdenados.map(o => (
                      <OrcRow
                        key={o.id} orc={o} clientes={[cliente]}
                        onAbrir={mkFetchOrc(o)}
                        onAction={mkOnAction}
                        showCliente={false}
                        modoSelecao={modoSelecao}
                        selecionado={selecionados.has(o.id)}
                        onToggleSelecao={(id) => {
                          const n = new Set(selecionados);
                          if (n.has(id)) n.delete(id); else n.add(id);
                          setSelecionados(n);
                        }}
                        onChangeProb={mkChangeProb}
                        perm={perm}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {orcsOrdenados.map(o => (
                      <OrcCard
                        key={o.id} orc={o} clientes={[cliente]}
                        onAbrir={mkFetchOrc(o)}
                        onAction={(acao, orc) => mkOnAction(acao, orc)}
                        onChangeProb={mkChangeProb}
                        perm={perm}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Modal confirmar exclusão em massa */}
      {confirmExcluirMassa && (
        <ModalConfirmarExclusaoMassa
          orcs={(data.orcamentosProjeto||[]).filter(o => selecionados.has(o.id))}
          clientes={[cliente]}
          onConfirmar={async () => { await excluirOrcamentosEmMassa(); setModoSelecao(false); }}
          onCancelar={() => setConfirmExcluirMassa(false)}
        />
      )}

      {/* Visualizador de proposta enviada (snapshot de imagens do PDF) */}
      {propostaVisualizada && (
        <PropostaVisualizer
          proposta={propostaVisualizada}
          onFechar={() => setPropostaVisualizada(null)}
          onEditar={() => {
            const orc = propostaVisualizada._orcOrigem;
            if (!orc) return;
            setPropostaVisualizada(null);
            onAbrirOrcamento(cliente, orc, "editar");
          }}
        />
      )}

      {/* Modal de confirmação de ganho */}
      {orcGanho && (
        <ModalConfirmarGanho
          orc={orcGanho}
          onClose={() => setOrcGanho(null)}
          onConfirmar={confirmarGanho}
        />
      )}
    </div>
  );
}



