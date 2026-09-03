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

// Paleta oficial do Vicke (grafite + cobre) — ver memória "vicke_paleta_cores".
const C = {
  input:    { border:"1.5px solid rgba(38,36,33,0.16)", borderRadius: 12, padding:"9px 12px", fontSize:13, color:"#262421", outline:"none", background:"#fff", fontFamily:"inherit", width:"100%", boxSizing:"border-box" },
  label:    { fontSize:12, color:"#6b7280", fontWeight:500, display:"block", marginBottom:5 },
  btn:      { background:"#262421", color:"#fff", border:"none", borderRadius: 12, padding:"9px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
  btnSec:   { background:"#fff", color:"#374151", border:"1.5px solid rgba(38,36,33,0.16)", borderRadius: 12, padding:"9px 16px", fontSize:13, cursor:"pointer", fontFamily:"inherit" },
  btnGhost: { background:"none", border:"none", color:"#9ca3af", cursor:"pointer", fontFamily:"inherit", fontSize:13 },
  tag:      (cor) => ({ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:6, background:cor+"18", color:cor }),
  grid2:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 },
  grid3:    { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 },
  secTit:   { fontSize:11, fontWeight:700, color:"#b5652f", textTransform:"uppercase", letterSpacing:1, marginBottom:14 },
  divider:  { border:"none", borderTop:"1px solid rgba(38,36,33,0.08)", margin:"20px 0" },
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

function CadastroPanel({ cliente, data, waLink, isMobile, colunaAtual, onEditar, onRemover, onMoverColuna }) {
  const [abertos, setAbertos] = useState({ financeiro:false });
  const toggle = k => setAbertos(p => ({...p, [k]:!p[k]}));
  const cpfCliente = cliente.cpfCnpj || cliente.id;
  const lancsCli = (data.receitasFinanceiro||[]).filter(r => r.clienteId === cpfCliente || r.clienteId === cliente.id);
  const totalContabil = lancsCli.filter(r=>r.contabil1==="Receita Total"&&r.tipoConta!=="Conta Redutora").reduce((s,r)=>s+(r.valor||0),0);
  const totalRecebido = lancsCli.filter(r=>r.recebimento==="Recebido").reduce((s,r)=>s+(r.valor||0),0);
  const totalReceber  = lancsCli.filter(r=>r.recebimento==="A Receber").reduce((s,r)=>s+(r.valor||0),0);
  const fmtV = v => "R$ " + v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
  // Paleta oficial do Vicke (grafite + cobre) — ver memória "vicke_paleta_cores".
  const VK = { grafite:"#262421", cobre:"#b5652f", inkSoft:"#78716c" };
  const secTit = { fontSize:11, fontWeight:600, color:VK.cobre, textTransform:"uppercase", letterSpacing:"0.18em", marginBottom:14 };
  const secBtn = () => ({ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", background:"none", border:"none", borderBottom:"1px solid rgba(38,36,33,0.08)", padding:"12px 0", cursor:"pointer", fontFamily:"inherit", color:VK.grafite, fontSize:13, fontWeight:600 });
  const card = { border:"1.5px solid rgba(38,36,33,0.14)", borderRadius:16, padding: isMobile ? "16px" : "18px 20px", marginBottom:16, background:"#fff", boxShadow:"0 4px 16px -10px rgba(38,36,33,0.25)" };
  const btn = { background:VK.grafite, color:"#fff", border:"none", borderRadius:9, padding:"9px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" };
  const btnSec = { background:"transparent", color:VK.grafite, boxShadow:`inset 0 0 0 1.5px ${VK.cobre}`, border:"none", borderRadius:9, padding:"9px 16px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" };
  const inputSel = { border:"1.5px solid rgba(38,36,33,0.16)", borderRadius:9, padding:"7px 12px", fontSize:12, color:VK.grafite, background:"#fff", fontFamily:"inherit", cursor:"pointer", outline:"none" };

  return (
    <div>
      {/* Ações */}
      <div style={{ ...card, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        <select value={colunaAtual} onChange={e=>onMoverColuna(e.target.value)} style={inputSel}>
          {COLUNAS.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}
        </select>
        <button style={btnSec} onClick={onEditar}>Editar</button>
        <div style={{ flex:1 }} />
        <button style={{ background:"none", border:"none", color:"#a32e12", cursor:"pointer", fontFamily:"inherit", fontSize:13 }} onClick={onRemover}>Remover cliente</button>
      </div>

      {/* Dados principais */}
      <div style={card}>
        <div style={secTit}>Dados principais</div>
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap:16 }}>
          <div>
            <div style={{fontSize:11,color:VK.inkSoft,marginBottom:3}}>Tipo</div>
            <div style={{fontSize:13,color:VK.grafite,fontWeight:600}}>{cliente.tipo==="PJ"?"Pessoa jurídica":"Pessoa física"}</div>
          </div>
          <div>
            <div style={{fontSize:11,color:VK.inkSoft,marginBottom:3}}>{cliente.tipo==="PJ"?"CNPJ":"CPF"}</div>
            <div style={{fontSize:13,color:VK.grafite,fontWeight:600}}>{cliente.cpfCnpj||"—"}</div>
          </div>
          <div>
            <div style={{fontSize:11,color:VK.inkSoft,marginBottom:3}}>E-mail</div>
            <div style={{fontSize:13,color:VK.grafite,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis"}}>{cliente.email||"—"}</div>
          </div>
          <div>
            <div style={{fontSize:11,color:VK.inkSoft,marginBottom:3}}>Cliente desde</div>
            <div style={{fontSize:13,color:VK.grafite,fontWeight:600}}>{cliente.desde ? new Date(cliente.desde).toLocaleDateString("pt-BR") : "—"}</div>
          </div>
        </div>
      </div>

      {/* Endereço e contatos */}
      <div style={card}>
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 20 : 28 }}>
          <div>
            <div style={secTit}>Endereço</div>
            {[["CEP",cliente.cep],["Logradouro",`${cliente.logradouro||""}${cliente.numero?", "+cliente.numero:""}${cliente.complemento?" - "+cliente.complemento:""}`],["Bairro",cliente.bairro],["Cidade",`${cliente.cidade||""} — ${cliente.estado||""}`]].map(([l,v])=>(
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid rgba(38,36,33,0.06)" }}><span style={{fontSize:12,color:VK.inkSoft}}>{l}</span><span style={{fontSize:13,color:VK.grafite}}>{v||"—"}</span></div>
            ))}
          </div>
          <div>
            <div style={secTit}>Contatos</div>
            {cliente.contatos?.map(ct=>(
              <div key={ct.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid rgba(38,36,33,0.06)" }}>
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{fontSize:13,fontWeight:600,color:VK.grafite}}>{ct.nome} <span style={{fontWeight:400,color:VK.inkSoft}}>({ct.cargo})</span></div>
                  <div style={{fontSize:12,color:VK.inkSoft,marginTop:2}}>{ct.telefone}</div>
                </div>
                {ct.whatsapp && ct.telefone && (
                  <a href={waLink(ct.telefone)} target="_blank" rel="noopener noreferrer"
                    style={{fontSize:12,color:"#fff",textDecoration:"none",background:"#16a34a",border:"1px solid #16a34a",borderRadius:6,padding:"4px 10px",flexShrink:0,fontWeight:600}}>WhatsApp</a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Financeiro */}
      <div style={card}>
        <button style={secBtn()} onClick={()=>toggle("financeiro")}>
          <span>Financeiro</span>
          <span style={{fontSize:11,color:VK.inkSoft}}>{abertos.financeiro?"▲":"▼"}</span>
        </button>
        {abertos.financeiro&&(
          <div style={{paddingTop:16}}>
            {lancsCli.length===0?<p style={{color:VK.inkSoft,fontSize:13,margin:0}}>Nenhum lançamento.</p>:(
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap:10 }}>
                {[["Receita total",totalContabil,VK.cobre],["Recebido",totalRecebido,"#16a34a"],["A receber",totalReceber,"#d97706"]].map(([l,v,cor])=>(
                  <div key={l} style={{border:"1.5px solid rgba(38,36,33,0.14)",borderRadius:14,padding:"14px"}}>
                    <div style={{fontSize:11,color:VK.inkSoft,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>{l}</div>
                    <div style={{fontSize:16,fontWeight:700,color:cor}}>{fmtV(v)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Clientes({ data, save, onAbrirOrcamento, abrirClienteDetail, onClienteDetailAberto, abrirCadastroNovo, onCadastroNovoAberto, onClienteSalvoVoltarOrcamento }) {
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

  // Flag interna: quando o cadastro vem do fluxo de Novo Orçamento, ao salvar
  // não voltamos pra kanban — abrimos o orçamento pra esse cliente direto.
  const [veioDeNovoOrcamento, setVeioDeNovoOrcamento] = useState(false);

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
      setVeioDeNovoOrcamento(true);
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
  const [abaCliente, setAbaCliente] = useState("cadastro");

  // Early return: só DEPOIS de todos os hooks serem declarados (regra do React)
  if (abrindoOrcamento) return null;

  // Proteção: se data ainda não carregou, renderiza loading
  if (!data || !Array.isArray(data.clientes)) {
    return (
      <div style={{ padding:"24px 28px", fontFamily:"'Inter', system-ui, -apple-system, sans-serif" }}>
        <h2 style={{ color:"#262421", fontWeight:700, fontSize:22, margin:0, letterSpacing:-0.5 }}>Clientes</h2>
        <div style={{ color:"#9ca3af", fontSize:13, marginTop:4 }}>Carregando…</div>
      </div>
    );
  }

  function openNew()     { setForm(emptyCliente); setView("form"); }
  function openEdit(c)   { setForm(c); setView("form"); }
  function openDetail(c) { setSel(c); setView("detail"); }

  function saveCliente() {
    if (!form.nome?.trim()) { dialogo.alertar({ titulo: "Informe o nome do cliente", tipo: "aviso" }); return; }
    const ehNovo = !form.id;
    const clienteFinal = ehNovo ? { ...form, id: uid() } : form;
    const novos = ehNovo
      ? [...data.clientes, clienteFinal]
      : data.clientes.map(c => c.id === form.id ? clienteFinal : c);
    save({ ...data, clientes: novos });
    // Fluxo "Novo Orçamento → Cadastrar Cliente": após salvar, vai direto
    // pra tela de orçamento desse cliente em vez de voltar pra kanban.
    if (ehNovo && veioDeNovoOrcamento && onClienteSalvoVoltarOrcamento) {
      setVeioDeNovoOrcamento(false);
      onClienteSalvoVoltarOrcamento(clienteFinal);
      return;
    }
    setView("kanban");
  }

  async function removeCliente(id) {
    const c = data.clientes.find(x => x.id === id);
    const nome = c?.nome || "este cliente";

    // Conta orçamentos vinculados a este cliente
    const orcsDoCliente = (data.orcamentosProjeto || []).filter(o => o.clienteId === id);
    const qtdOrcs = orcsDoCliente.length;

    let mensagem = `${nome} será removido. Esta ação não pode ser desfeita.`;
    if (qtdOrcs > 0) {
      mensagem = `${nome} será removido com TODOS os ${qtdOrcs} orçamento${qtdOrcs !== 1 ? "s" : ""} vinculado${qtdOrcs !== 1 ? "s" : ""}.\n\n⚠️  Esta ação não pode ser desfeita.`;
    }

    const ok = await dialogo.confirmar({
      titulo: "Remover cliente?",
      mensagem,
      confirmar: qtdOrcs > 0 ? "Remover cliente e orçamentos" : "Remover",
      destrutivo: true,
    });
    if (!ok) return;

    // Se houver orçamentos, remove-os também
    const novosOrcs = qtdOrcs > 0
      ? (data.orcamentosProjeto || []).filter(o => o.clienteId !== id)
      : data.orcamentosProjeto;

    save({
      ...data,
      clientes: data.clientes.filter(c => c.id !== id),
      orcamentosProjeto: novosOrcs,
    });
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
            {i > 0 && <span style={{ color:"#9ca3af", margin:"0 6px" }}>·</span>}
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
          background:"#fff", border:"1.5px solid rgba(38,36,33,0.16)", borderRadius: 12,
          padding:"10px 14px", marginBottom:6, cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"space-between", gap:10,
          transition:"border-color 0.15s",
        }}
        onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(38,36,33,0.16)"}
        onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(38,36,33,0.16)"}>
        <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:2 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"#262421", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
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
              style={{ fontSize:11, color:"#6b7280", background:"#fff", border:"1.5px solid rgba(38,36,33,0.16)", borderRadius:5, padding:"4px 6px", cursor:"pointer", fontFamily:"inherit" }}>
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
        <div style={{ fontFamily:"'Inter', system-ui, -apple-system, sans-serif", minHeight:"calc(100vh - 53px)", display:"flex", flexDirection:"column" }}>
          {/* Header mobile */}
          <div style={{ padding:"16px 16px 0", display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:17, fontWeight:700, color:"#262421" }}>Clientes</div>
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
                  <span style={{ fontSize:11, background: ativa ? col.cor+"18" : "#f3f4f6", color: ativa ? col.cor : "#9ca3af", borderRadius: 14, padding:"1px 7px", fontWeight:600 }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Cards da aba ativa */}
          <div style={{ flex:1, overflowY:"auto", padding:"12px 16px" }}>
            {cardsAba.length === 0 ? (
              <div style={{ textAlign:"center", padding:"48px 0", color:"#9ca3af", fontSize:13 }}>
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
      <div style={{ padding:"24px 28px", fontFamily:"'Inter', system-ui, -apple-system, sans-serif", minHeight:"calc(100vh - 53px)", display:"flex", flexDirection:"column" }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:"#262421" }}>Clientes</div>
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
                style={{ background: isOver ? col.cor+"08" : "#fafafa", border:`1px solid ${isOver ? col.cor : "#f3f4f6"}`, borderRadius: 16, display:"flex", flexDirection:"column", transition:"border-color 0.15s, background 0.15s" }}
                onDragOver={e => { e.preventDefault(); setDragOver(col.key); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => { e.preventDefault(); if (dragId) moverCliente(dragId, col.key); setDragId(null); setDragOver(null); }}>
                {/* Header coluna */}
                <div style={{ padding:"14px 16px", borderBottom:"1px solid #f3f4f6", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:col.cor }} />
                    <span style={{ fontSize:13, fontWeight:600, color:"#374151" }}>{col.label}</span>
                  </div>
                  <span style={{ fontSize:12, color:"#9ca3af", background:"#f3f4f6", borderRadius: 14, padding:"1px 8px" }}>{cards.length}</span>
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
                    <div style={{ textAlign:"center", padding:"24px 0", color:"#9ca3af", fontSize:12 }}>
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
      <div style={{ padding: isMobile ? "16px" : "28px 32px", fontFamily:"'Inter', system-ui, -apple-system, sans-serif" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
          <div style={{ fontSize:18, fontWeight:700, color:"#262421" }}>Clientes</div>
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
              <div key={c.id} style={{ background:"#fff", border:"1.5px solid rgba(38,36,33,0.16)", borderRadius: 16, padding:"14px 16px", display:"flex", alignItems:"center", gap:14, cursor:"pointer" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#b5652f"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(38,36,33,0.16)"}
                onClick={()=>openDetail(c)}>
                <div style={{ width:40, height:40, borderRadius: 14, background:corAv+"15", color:corAv, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, flexShrink:0 }}>{iniciais}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"#262421" }}>{c.nome}</div>
                  <div style={{ fontSize:12, color:"#9ca3af" }}>{c.cpfCnpj}{c.cidade?` · ${c.cidade}`:""}</div>
                </div>
                <div style={{ display:"flex", gap:6, alignItems:"center" }} onClick={e=>e.stopPropagation()}>
                  <span style={C.tag(col.cor)}>{col.label}</span>
                  {tel && <a href={waLink(tel)} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:"#16a34a", textDecoration:"none", border:"1.5px solid rgba(38,36,33,0.16)", borderRadius:6, padding:"4px 10px" }}>WA</a>}
                  <button onClick={()=>openEdit(c)} style={{ fontSize:12, color:"#6b7280", background:"none", border:"1.5px solid rgba(38,36,33,0.16)", borderRadius:6, padding:"4px 10px", cursor:"pointer", fontFamily:"inherit" }}>Editar</button>
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

    const VKD = { fundo:"#f5f3f0", grafite:"#262421", cobre:"#b5652f", cobreClaro:"#fdf6f0", inkSoft:"#78716c" };
    return (
      <div style={{ padding: isMobile ? "16px" : "28px 32px", background:VKD.fundo, minHeight:"100%", fontFamily:"'Inter', system-ui, -apple-system, sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`}</style>
        <div style={{ maxWidth:900, margin:"0 auto" }}>
          {/* Header */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:24, flexWrap:"wrap" }}>
            <button style={{ background:"none", border:"none", color:VKD.inkSoft, cursor:"pointer", fontFamily:"inherit", fontSize:13 }} onClick={()=>{ setView("kanban"); setAbaCliente("cadastro"); }}>← Voltar</button>
          </div>

          {/* Cliente Info — só o nome */}
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:28 }}>
            <div style={{ width: isMobile ? 48 : 56, height: isMobile ? 48 : 56, borderRadius:14, background:VKD.cobreClaro, color:VKD.cobre, display:"flex", alignItems:"center", justifyContent:"center", fontSize: isMobile ? 16 : 20, fontWeight:700, flexShrink:0 }}>{iniciais}</div>
            <div style={{ fontFamily:"'Inter', system-ui, sans-serif", fontSize: isMobile ? 19 : 23, fontWeight:800, color:VKD.grafite, overflow:"hidden", textOverflow:"ellipsis" }}>{cliente.nome}</div>
          </div>

          {/* Navegação de abas com cards */}
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: isMobile ? 12 : 16, marginBottom:28 }}>
            {[
              { id:"cadastro", titulo:"Cadastro" },
              { id:"projetos", titulo:"Projetos" },
              { id:"obras", titulo:"Obras" },
            ].map(aba => (
              <button
                key={aba.id}
                onClick={() => setAbaCliente(aba.id)}
                style={{
                  border: abaCliente === aba.id ? `1.5px solid ${VKD.cobre}` : "1.5px solid rgba(38,36,33,0.16)",
                  borderRadius: 16,
                  padding: "20px",
                  background: abaCliente === aba.id ? VKD.cobreClaro : "#fff",
                  boxShadow: abaCliente === aba.id ? "0 0 0 3px rgba(181,101,47,0.16)" : "none",
                  cursor: "pointer",
                  fontFamily: "'Inter', system-ui, sans-serif",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={e => {
                  if (abaCliente !== aba.id) {
                    e.currentTarget.style.borderColor = "rgba(38,36,33,0.35)";
                    e.currentTarget.style.boxShadow = "0 1px 3px rgba(38,36,33,0.08)";
                  }
                }}
                onMouseLeave={e => {
                  if (abaCliente !== aba.id) {
                    e.currentTarget.style.borderColor = "rgba(38,36,33,0.16)";
                    e.currentTarget.style.boxShadow = "none";
                  }
                }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: abaCliente === aba.id ? VKD.cobre : VKD.grafite }}>{aba.titulo}</div>
              </button>
            ))}
          </div>

        {/* Conteúdo da aba selecionada */}
        {abaCliente === "cadastro" && (
          <CadastroPanel
            cliente={cliente}
            data={data}
            waLink={waLink}
            isMobile={isMobile}
            colunaAtual={colunaDoCliente(cliente)}
            onEditar={()=>openEdit(cliente)}
            onRemover={()=>removeCliente(cliente.id)}
            onMoverColuna={v=>moverCliente(cliente.id, v)}
          />
        )}

        {abaCliente === "projetos" && (
          <ProjetosPanel cliente={cliente} data={data} onAbrirOrcamento={(c, orc, modo) => { setAbrindoOrcamento(true); onAbrirOrcamento(c, orc, modo); }} />
        )}

        {abaCliente === "obras" && (
          <GestaoObraPanel cliente={cliente} data={data} save={save} isMobile={isMobile} />
        )}
        </div>
      </div>
    );
  }

  // ── FORMULÁRIO ───────────────────────────────────────────────
  // Paleta oficial do Vicke (grafite + cobre) — ver memória de projeto
  // "vicke_paleta_cores". Técnica visual herdada do teste com o Morada do
  // Sol (fundo levemente colorido, borda neutra translúcida, foco com glow,
  // seções em uppercase com cor de destaque), mas cores próprias do Vicke.
  const VK = {
    fundo:      "#f5f3f0",
    grafite:    "#262421",
    cobre:      "#b5652f",
    cobreClaro: "#fdf6f0",
    ink:        "#262421",
    inkSoft:    "#78716c",
  };
  const FC = {
    input:  { border:"1.5px solid rgba(38,36,33,0.16)", borderRadius:9, height:46, padding:"0 14px", fontSize:15, color:VK.ink, outline:"none", background:"#fff", fontFamily:"'Inter', system-ui, sans-serif", width:"100%", boxSizing:"border-box" },
    label:  { fontSize:10, color:VK.cobre, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.14em", display:"block", marginBottom:6 },
    secTit: { fontSize:11, fontWeight:600, color:VK.cobre, textTransform:"uppercase", letterSpacing:"0.22em", marginBottom:16 },
    btn:    { background:VK.grafite, color:"#fff", border:"none", borderRadius:9, height:48, padding:"0 24px", fontSize:15, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', system-ui, sans-serif" },
    btnSec: { background:"transparent", color:VK.grafite, boxShadow:`inset 0 0 0 1.5px ${VK.cobre}`, border:"none", borderRadius:9, height:42, padding:"0 20px", fontSize:13.5, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', system-ui, sans-serif" },
    btnGhost: { background:"none", border:"none", color:VK.inkSoft, cursor:"pointer", fontFamily:"'Inter', system-ui, sans-serif", fontSize:13 },
    divider: { border:"none", borderTop:"1px solid rgba(38,36,33,0.1)", margin:"22px 0" },
  };
  return (
    <div style={{ padding: isMobile ? "24px 16px 60px" : "40px 32px", background:VK.fundo, minHeight:"100%", fontFamily:"'Inter', system-ui, -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .vk-fc-input:focus { border-color:${VK.cobre} !important; box-shadow:0 0 0 3px rgba(181,101,47,0.14); }
        .vk-fc-tipo.ativo { border-color:${VK.cobre} !important; background:${VK.cobreClaro} !important; box-shadow:0 0 0 3px rgba(181,101,47,0.16); }
        .vk-fc-check { accent-color:${VK.cobre}; }
      `}</style>
      <div style={{ maxWidth:640, margin:"0 auto", background:"#fff", borderRadius:16, padding: isMobile ? "22px 18px 26px" : "28px 26px 32px", boxShadow:"0 18px 50px -28px rgba(38,36,33,0.35)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
          <button style={FC.btnGhost} onClick={()=>setView("kanban")}>← Voltar</button>
        </div>
        <div style={{ fontFamily:"'Inter', system-ui, sans-serif", fontSize:24, fontWeight:800, letterSpacing:"-0.02em", color:VK.grafite, margin:"0 0 8px" }}>{form.id?"Editar cliente":"Novo cliente"}</div>
        <div style={{ marginBottom:16, marginTop:20 }}>
          <div style={FC.secTit}>Tipo de pessoa</div>
          <div style={{ display:"flex", gap:8 }}>
            {[["PF","Pessoa física"],["PJ","Pessoa jurídica"]].map(([v,l])=>(
              <button key={v} className={"vk-fc-tipo" + (form.tipo===v ? " ativo" : "")} onClick={()=>setForm({...form,tipo:v})}
                style={{ border:"1.5px solid rgba(38,36,33,0.14)", borderRadius:10, height:42, padding:"0 18px", fontSize:13.5, fontWeight:600, background:"#fff", color:VK.grafite, cursor:"pointer", fontFamily:"'Inter', system-ui, sans-serif" }}>{l}</button>
            ))}
          </div>
        </div>
        <hr style={FC.divider} />
        <div style={{ marginBottom:16 }}>
          <div style={FC.secTit}>Dados principais</div>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:12, marginBottom:12 }}>
            <div><label style={FC.label}>{form.tipo==="PJ"?"Razão social":"Nome completo"}</label><input className="vk-fc-input" data-tutorial-id="cliente-nome" style={FC.input} value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} /></div>
            <div><label style={FC.label}>{form.tipo==="PJ"?"CNPJ":"CPF"}</label><input className="vk-fc-input" style={FC.input} value={form.cpfCnpj} onChange={e=>setForm({...form,cpfCnpj:e.target.value})} /></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:12, marginBottom:12 }}>
            <div><label style={FC.label}>E-mail</label><input className="vk-fc-input" style={FC.input} type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
            <div><label style={FC.label}>Cliente desde</label><input className="vk-fc-input" style={FC.input} type="date" value={form.desde} onChange={e=>setForm({...form,desde:e.target.value})} /></div>
          </div>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:VK.inkSoft}}>
            <input className="vk-fc-check" type="checkbox" checked={form.ativo} onChange={e=>setForm({...form,ativo:e.target.checked})} /> Cliente ativo
          </label>
        </div>
        <hr style={FC.divider} />
        <div style={{ marginBottom:16 }}>
          <div style={FC.secTit}>Endereço</div>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap:10, marginBottom:10 }}>
            <div><label style={FC.label}>CEP</label><input className="vk-fc-input" style={FC.input} value={form.cep} onChange={e=>{setForm({...form,cep:e.target.value});buscarCEP(e.target.value);}} placeholder="00000-000" /></div>
            <div><label style={FC.label}>Número</label><input className="vk-fc-input" style={FC.input} value={form.numero} onChange={e=>setForm({...form,numero:e.target.value})} /></div>
            {!isMobile && <div><label style={FC.label}>Complemento</label><input className="vk-fc-input" style={FC.input} value={form.complemento} onChange={e=>setForm({...form,complemento:e.target.value})} /></div>}
          </div>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap:10, marginBottom:10 }}>
            <div><label style={FC.label}>Logradouro</label><input className="vk-fc-input" style={FC.input} value={form.logradouro} onChange={e=>setForm({...form,logradouro:e.target.value})} /></div>
            {isMobile && <div><label style={FC.label}>Complemento</label><input className="vk-fc-input" style={FC.input} value={form.complemento} onChange={e=>setForm({...form,complemento:e.target.value})} /></div>}
            <div><label style={FC.label}>Bairro</label><input className="vk-fc-input" style={FC.input} value={form.bairro} onChange={e=>setForm({...form,bairro:e.target.value})} /></div>
            <div><label style={FC.label}>Cidade</label><input className="vk-fc-input" style={FC.input} value={form.cidade} onChange={e=>setForm({...form,cidade:e.target.value})} /></div>
          </div>
          <div style={{maxWidth:120}}><label style={FC.label}>Estado</label><select className="vk-fc-input" style={{...FC.input,cursor:"pointer"}} value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>{ESTADOS_BR.map(e=><option key={e}>{e}</option>)}</select></div>
        </div>
        <hr style={FC.divider} />
        <div style={{ marginBottom:20 }}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={FC.secTit}>Contatos</div>
            <button style={FC.btnSec} onClick={()=>setForm({...form,contatos:[...form.contatos,{id:uid(),nome:"",telefone:"",cargo:"",whatsapp:false}]})}>+ Adicionar</button>
          </div>
          {form.contatos?.map((ct,i)=>(
            <div key={ct.id} style={{border:"1px dashed rgba(38,36,33,0.18)",borderRadius:10,padding:"14px",marginBottom:10}}>
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap:10, marginBottom:10 }}>
                <div style={isMobile ? { gridColumn:"1 / -1" } : {}}><label style={FC.label}>Nome</label><input className="vk-fc-input" style={FC.input} value={ct.nome} onChange={e=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,nome:e.target.value}:x)})} /></div>
                <div><label style={FC.label}>Telefone</label><input className="vk-fc-input" style={FC.input} value={ct.telefone} onChange={e=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,telefone:e.target.value}:x)})} /></div>
                <div><label style={FC.label}>Cargo</label><input className="vk-fc-input" style={FC.input} value={ct.cargo} onChange={e=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,cargo:e.target.value}:x)})} /></div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:VK.inkSoft}}>
                  <input className="vk-fc-check" type="checkbox" checked={ct.whatsapp} onChange={e=>setForm({...form,contatos:form.contatos.map((x,j)=>j===i?{...x,whatsapp:e.target.checked}:x)})} />
                  <span style={{color:"#2d7a4f"}}>WhatsApp</span>
                </label>
                {form.contatos.length>1&&<button style={{...FC.btnGhost,color:"#a32e12",fontSize:12}} onClick={()=>setForm({...form,contatos:form.contatos.filter((_,j)=>j!==i)})}>Remover</button>}
              </div>
            </div>
          ))}
        </div>
        <hr style={FC.divider} />
        <div style={{marginBottom:28}}>
          <div style={FC.secTit}>Observações internas</div>
          <textarea className="vk-fc-input" style={{...FC.input, height:"auto", padding:"12px 14px", resize:"vertical"}} value={form.observacoes} onChange={e=>setForm({...form,observacoes:e.target.value})} rows={3} />
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button style={FC.btnSec} onClick={()=>setView("kanban")}>Cancelar</button>
          <button data-tutorial-id="cliente-salvar" style={FC.btn} onClick={saveCliente}>{form.id?"Salvar alterações":"Cadastrar cliente"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Painel "Projetos" — lista orçamentos/projetos do cliente ─────
function ProjetosPanel({ cliente, data, onAbrirOrcamento }) {
  const orcamentos = (data.orcamentosProjeto || []).filter(o => o.clienteId === cliente.id);
  const statusOrc = {
    rascunho: { label: "Rascunho", cor: "#9ca3af" },
    aberto:   { label: "Aberto",   cor: "#2563eb" },
    ganho:    { label: "Ganho",    cor: "#10b981" },
    perdido:  { label: "Perdido",  cor: "#dc2626" },
  };

  return (
    <div style={{ border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 16, padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#262421" }}>Projetos</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>{orcamentos.length} projeto{orcamentos.length !== 1 ? "s" : ""}</div>
        </div>
        <button style={C.btn} onClick={() => onAbrirOrcamento(cliente, null, "novo")}>+ Novo projeto</button>
      </div>

      {orcamentos.length === 0 ? (
        <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: 12.5, border: "1px dashed rgba(38,36,33,0.18)", borderRadius: 9, background: "#fafafa" }}>
          Nenhum projeto cadastrado.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {orcamentos.map(orc => {
            const sts = statusOrc[orc.status] || statusOrc.rascunho;
            return (
              <div
                key={orc.id}
                onClick={() => onAbrirOrcamento(cliente, orc, "editar")}
                style={{ border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 12, padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, cursor: "pointer", transition: "border-color 0.15s", backgroundColor: "#fff" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(38,36,33,0.16)"}
                onMouseLeave={e => e.currentTarget.style.borderColor="rgba(38,36,33,0.16)"}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#262421" }}>{orc.tipo || "Projeto"}{orc.subtipo ? ` — ${orc.subtipo}` : ""}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={C.tag(sts.cor)}>{sts.label}</span>
                    {orc.padrao && <span>Padrão: {orc.padrao}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GestaoObraPanel({ cliente, data, save, isMobile }) {
  const perm = getPermissoes();
  const [view, setView] = useState("lista");
  const [formObra, setFormObra] = useState(null);
  const [formContrato, setFormContrato] = useState(null);
  const [obraSelecionada, setObraSelecionada] = useState(null);

  const obras = (data.obras || []).filter(o => o.clienteId === cliente.id);
  const contratos = (data.contratos || []).filter(c => c.clienteId === cliente.id);
  const statusObra = { planejamento: { label: "Planejamento", cor: "#f59e0b" }, execucao: { label: "Em execução", cor: "#3b82f6" }, concluida: { label: "Concluída", cor: "#10b981" } };
  const statusContrato = { ativo: { label: "Ativo", cor: "#10b981" }, pendente: { label: "Pendente", cor: "#f59e0b" }, encerrado: { label: "Encerrado", cor: "#9ca3af" } };

  function novaObra() {
    setFormObra({ id: uid(), clienteId: cliente.id, nome: "", status: "planejamento", dataInicio: "", dataFim: "", responsavel: "", descricao: "", ativo: true });
    setView("form");
  }

  function editarObra(obra) {
    setFormObra({ ...obra });
    setView("form");
  }

  function salvarObra() {
    if (!formObra.nome?.trim()) { dialogo.alertar({ titulo: "Informe o nome da obra", tipo: "aviso" }); return; }
    const ehNova = !obras.find(o => o.id === formObra.id);
    const novasObras = ehNova ? [...obras, formObra] : obras.map(o => o.id === formObra.id ? formObra : o);
    save({ ...data, obras: novasObras });
    setView("lista");
  }

  async function deletarObra(obraId) {
    const ok = await dialogo.confirmar({ titulo: "Remover obra?", mensagem: "Esta ação não pode ser desfeita.", confirmar: "Remover", destrutivo: true });
    if (!ok) return;
    save({ ...data, obras: obras.filter(o => o.id !== obraId) });
  }

  if (view === "formContrato" && formContrato && obraSelecionada) {
    return (
      <div style={{ border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
        <button onClick={() => setView("contratosDaObra")} style={{ ...C.btnGhost, marginBottom: 16, fontSize: 12 }}>← Voltar</button>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div><label style={C.label}>Contratado *</label><input style={C.input} value={formContrato.nomeContratado} onChange={e => setFormContrato({ ...formContrato, nomeContratado: e.target.value })} placeholder="Nome da empresa/pessoa" /></div>
          <div><label style={C.label}>Status</label><select style={{ ...C.input, cursor: "pointer" }} value={formContrato.status} onChange={e => setFormContrato({ ...formContrato, status: e.target.value })}>{Object.entries(statusContrato).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          <div><label style={C.label}>Valor (R$)</label><input style={C.input} type="number" value={formContrato.valor} onChange={e => setFormContrato({ ...formContrato, valor: e.target.value })} step="0.01" /></div>
          <div><label style={C.label}>Data de assinatura</label><input style={C.input} type="date" value={formContrato.dataAssinatura} onChange={e => setFormContrato({ ...formContrato, dataAssinatura: e.target.value })} /></div>
          <div><label style={C.label}>Data de vencimento</label><input style={C.input} type="date" value={formContrato.dataVencimento} onChange={e => setFormContrato({ ...formContrato, dataVencimento: e.target.value })} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={C.label}>Descrição do serviço</label><textarea style={{ ...C.input, resize: "vertical" }} value={formContrato.descricaoServico} onChange={e => setFormContrato({ ...formContrato, descricaoServico: e.target.value })} rows={2} /></div>
        </div>
        <div style={{ marginBottom: 12 }}><label style={C.label}>Observações</label><textarea style={{ ...C.input, resize: "vertical" }} value={formContrato.observacoes} onChange={e => setFormContrato({ ...formContrato, observacoes: e.target.value })} rows={2} /></div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button style={C.btnSec} onClick={() => setView("contratosDaObra")}>Cancelar</button>
          <button style={C.btn} onClick={() => {
            if (!formContrato.nomeContratado?.trim()) { dialogo.alertar({ titulo: "Informe o nome do contratado", tipo: "aviso" }); return; }
            const ehNovo = !contratos.find(c => c.id === formContrato.id);
            const novosContratos = ehNovo ? [...contratos, formContrato] : contratos.map(c => c.id === formContrato.id ? formContrato : c);
            save({ ...data, contratos: novosContratos });
            setView("contratosDaObra");
          }}>Salvar contrato</button>
        </div>
      </div>
    );
  }

  if (view === "form" && formObra) {
    return (
      <div style={{ border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
        <button onClick={() => setView("lista")} style={{ ...C.btnGhost, marginBottom: 16, fontSize: 12 }}>← Voltar</button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "#262421" }}>Gestão de Obra</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div><label style={C.label}>Nome da obra *</label><input style={C.input} value={formObra.nome} onChange={e => setFormObra({ ...formObra, nome: e.target.value })} /></div>
          <div><label style={C.label}>Status</label><select style={{ ...C.input, cursor: "pointer" }} value={formObra.status} onChange={e => setFormObra({ ...formObra, status: e.target.value })}>{Object.entries(statusObra).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          <div><label style={C.label}>Data de início</label><input style={C.input} type="date" value={formObra.dataInicio} onChange={e => setFormObra({ ...formObra, dataInicio: e.target.value })} /></div>
          <div><label style={C.label}>Data de conclusão</label><input style={C.input} type="date" value={formObra.dataFim} onChange={e => setFormObra({ ...formObra, dataFim: e.target.value })} /></div>
          <div style={isMobile ? { gridColumn: "1 / -1" } : {}}><label style={C.label}>Responsável</label><input style={C.input} value={formObra.responsavel} onChange={e => setFormObra({ ...formObra, responsavel: e.target.value })} placeholder="Nome do responsável" /></div>
        </div>
        <div style={{ marginBottom: 12 }}><label style={C.label}>Descrição</label><textarea style={{ ...C.input, resize: "vertical" }} value={formObra.descricao} onChange={e => setFormObra({ ...formObra, descricao: e.target.value })} rows={3} /></div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button style={C.btnSec} onClick={() => setView("lista")}>Cancelar</button>
          <button style={C.btn} onClick={salvarObra}>Salvar obra</button>
        </div>
      </div>
    );
  }

  if (view === "contratosDaObra" && obraSelecionada) {
    const contratosDaObra = contratos.filter(c => c.obraId === obraSelecionada.id);
    return (
      <div style={{ border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
        <button onClick={() => setView("detalheObra")} style={{ ...C.btnGhost, marginBottom: 16, fontSize: 12 }}>← Voltar</button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, background: "#2563eb15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📋</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#262421" }}>Contratos</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{obraSelecionada.nome}</div>
          </div>
        </div>

        {contratosDaObra.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: 12.5, border: "1px dashed rgba(38,36,33,0.18)", borderRadius: 9, background: "#fafafa" }}>
            Nenhum contrato nesta obra. {perm.podeEditar && <button onClick={() => { setFormContrato({ id: uid(), clienteId: cliente.id, obraId: obraSelecionada.id, nomeContratado: "", descricaoServico: "", valor: "", dataAssinatura: "", dataVencimento: "", status: "ativo", observacoes: "" }); setView("formContrato"); }} style={{ background: "transparent", border: "none", color: "#2563eb", cursor: "pointer", padding: 0, fontSize: 12.5, fontFamily: "inherit", textDecoration: "underline" }}>Cadastrar primeiro contrato</button>}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {contratosDaObra.map(contrato => {
              const sts = statusContrato[contrato.status] || statusContrato.ativo;
              return (
                <div key={contrato.id} style={{ border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 12, padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#262421" }}>{contrato.nomeContratado}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ ...C.tag(sts.cor) }}>{sts.label}</span>
                      {contrato.valor && <span>R$ {parseFloat(contrato.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                      {contrato.dataVencimento && <span>Vence: {new Date(contrato.dataVencimento).toLocaleDateString("pt-BR")}</span>}
                    </div>
                    {contrato.descricaoServico && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>{contrato.descricaoServico}</div>}
                  </div>
                  {perm.podeEditar && (
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => setFormContrato(contrato)} style={{ ...C.btnSec, fontSize: 12, padding: "6px 12px" }}>Editar</button>
                      <button onClick={() => { dialogo.confirmar({ titulo: "Remover contrato?", mensagem: "Esta ação não pode ser desfeita.", confirmar: "Remover", destrutivo: true }).then(ok => { if (ok) save({ ...data, contratos: contratos.filter(c => c.id !== contrato.id) }); }); }} style={{ ...C.btnGhost, color: "#dc2626", fontSize: 12 }}>Remover</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {perm.podeEditar && (
          <button style={{ ...C.btn, width: "100%", marginTop: 12 }} onClick={() => { setFormContrato({ id: uid(), clienteId: cliente.id, obraId: obraSelecionada.id, nomeContratado: "", descricaoServico: "", valor: "", dataAssinatura: "", dataVencimento: "", status: "ativo", observacoes: "" }); setView("formContrato"); }}>+ Adicionar contrato</button>
        )}
      </div>
    );
  }

  if (view === "detalheObra" && obraSelecionada) {
    return (
      <div style={{ border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
        <button onClick={() => { setView("lista"); setObraSelecionada(null); }} style={{ ...C.btnGhost, marginBottom: 16, fontSize: 12 }}>← Voltar</button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#262421" }}>{obraSelecionada.nome}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{obraSelecionada.responsavel || "Sem responsável"}</div>
          </div>
          {perm.podeEditar && (
            <button onClick={() => editarObra(obraSelecionada)} style={{ ...C.btnSec, fontSize: 12, padding: "6px 12px" }}>Editar</button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
          <button onClick={() => setView("contratosDaObra")}
            style={{ border: "1.5px solid #2563eb", borderRadius: 16, padding: "20px", background: "#eff6ff", boxShadow: "0 0 0 3px rgba(37, 99, 235, 0.15)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transition: "all 0.2s ease", fontFamily: "inherit" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#2563eb", textAlign: "center" }}>Contratos</div>
            <div style={{ fontSize: 11, color: "#6b7280", textAlign: "center" }}>Gerenciar contratos</div>
          </button>
          <button onClick={() => { dialogo.alertar({ titulo: "Em breve", mensagem: "Cronograma será implementado em breve.", tipo: "aviso" }); }}
            style={{ border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 16, padding: "20px", background: "#f9fafb", cursor: "not-allowed", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#9ca3af", textAlign: "center" }}>Cronograma</div>
            <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "center" }}>Em breve</div>
          </button>
          <button onClick={() => { dialogo.alertar({ titulo: "Em breve", mensagem: "Documentos será implementado em breve.", tipo: "aviso" }); }}
            style={{ border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 16, padding: "20px", background: "#f9fafb", cursor: "not-allowed", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#9ca3af", textAlign: "center" }}>Documentos</div>
            <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "center" }}>Em breve</div>
          </button>
        </div>

        {/* Info da obra */}
        {(obraSelecionada.status || obraSelecionada.dataInicio || obraSelecionada.descricao) && (
          <div style={{ background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 14 }}>
              {obraSelecionada.status && (
                <div>
                  <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Status</div>
                  <span style={C.tag(statusObra[obraSelecionada.status]?.cor || "#9ca3af")}>{statusObra[obraSelecionada.status]?.label || obraSelecionada.status}</span>
                </div>
              )}
              {obraSelecionada.dataInicio && (
                <div>
                  <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Data de início</div>
                  <div style={{ fontSize: 13, color: "#374151" }}>{new Date(obraSelecionada.dataInicio).toLocaleDateString("pt-BR")}</div>
                </div>
              )}
              {obraSelecionada.dataFim && (
                <div>
                  <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Data de conclusão</div>
                  <div style={{ fontSize: 13, color: "#374151" }}>{new Date(obraSelecionada.dataFim).toLocaleDateString("pt-BR")}</div>
                </div>
              )}
            </div>
            {obraSelecionada.descricao && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1.5px solid rgba(38,36,33,0.16)" }}>
                <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Descrição</div>
                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{obraSelecionada.descricao}</div>
              </div>
            )}
          </div>
        )}

        {perm.podeEditar && (
          <button style={{ ...C.btnGhost, color: "#dc2626", fontSize: 12, width: "100%" }} onClick={() => { dialogo.confirmar({ titulo: "Remover obra?", mensagem: "Esta ação não pode ser desfeita.", confirmar: "Remover", destrutivo: true }).then(ok => { if (ok) deletarObra(obraSelecionada.id); }); }}>Remover esta obra</button>
        )}
      </div>
    );
  }

  // Lista de obras — view padrão
  return (
    <div style={{ border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#262421" }}>Gestão de Obra</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>{obras.length} obra{obras.length !== 1 ? "s" : ""}</div>
      </div>

      {obras.length === 0 ? (
        <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: 12.5, border: "1px dashed rgba(38,36,33,0.18)", borderRadius: 9, background: "#fafafa" }}>
          Nenhuma obra cadastrada. {perm.podeEditar && <button onClick={novaObra} style={{ background: "transparent", border: "none", color: "#f59e0b", cursor: "pointer", padding: 0, fontSize: 12.5, fontFamily: "inherit", textDecoration: "underline" }}>Cadastrar primeira obra</button>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {obras.map(obra => (
            <div
              key={obra.id}
              onClick={() => { setObraSelecionada(obra); setView("detalheObra"); }}
              style={{ border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, cursor: "pointer", transition: "border-color 0.15s", backgroundColor: "#fff" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#9ca3af"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(38,36,33,0.16)"}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#262421" }}>{obra.nome}</div>
              {perm.podeEditar && (
                <div onClick={e => e.stopPropagation()}>
                  <button onClick={() => editarObra(obra)} style={{ ...C.btnSec, fontSize: 12, padding: "6px 12px" }}>Editar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {perm.podeEditar && (
        <button style={{ ...C.btn, width: "100%", marginTop: 12 }} onClick={novaObra}>+ Adicionar obra</button>
      )}
    </div>
  );
}

