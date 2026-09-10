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
// Azul de interação: borda do campo/cartão em foco, hover e seleção.
const AZUL_VK = "#0474f4";

const C = {
  input:    { border:"1.5px solid rgba(38,36,33,0.16)", borderRadius: 12, padding:"9px 12px", fontSize:13.5, color:"#111827", outline:"none", background:"#fff", fontFamily:"inherit", width:"100%", boxSizing:"border-box" },
  label:    { fontSize:12, color:"#4b5563", fontWeight:600, display:"block", marginBottom:5 },
  btn:      { background:"#111827", color:"#fff", border:"none", borderRadius: 12, padding:"9px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
  btnSec:   { background:"#fff", color:"#111827", border:"1.5px solid rgba(38,36,33,0.16)", borderRadius: 12, padding:"9px 16px", fontSize:13, cursor:"pointer", fontFamily:"inherit" },
  btnGhost: { background:"none", border:"none", color:"#4b5563", cursor:"pointer", fontFamily:"inherit", fontSize:13 },
  tag:      (cor) => ({ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:6, background:cor+"18", color:cor }),
  grid2:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 },
  grid3:    { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 },
  secTit:   { fontSize:12.5, fontWeight:700, color:"#111827", marginBottom:14 },
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

// ── Acesso do cliente à obra dele ────────────────────────────────
// O escritório cria um login (perfil "cliente") amarrado a este cadastro.
// Com ele, o cliente entra no mesmo site e só enxerga as obras dele: pode
// dar baixa em conta, lançar despesa, registrar aporte e dar aceite — o
// cadastro da obra e os contratos continuam sendo do escritório.
function AcessoDoCliente({ cliente, card, secTit, btn, btnSec, isMobile }) {
  const perm = getPermissoes();
  const [acesso, setAcesso] = useState(undefined); // undefined = carregando
  // O e-mail já vem do cadastro do cliente; o escritório só ajusta se quiser outro.
  const [email, setEmail] = useState(cliente.email || "");
  const [senhaNova, setSenhaNova] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    setEmail(cliente.email || "");
    if (!perm.isAdmin) { setAcesso(null); return; }
    api.clientes.acesso.get(cliente.id)
      .then(a => { if (vivo) setAcesso(a || null); })
      .catch(() => { if (vivo) setAcesso(null); });
    return () => { vivo = false; };
  }, [cliente.id]);

  if (!perm.isAdmin) return null;

  const rodar = (fn) => {
    setErro(""); setOcupado(true);
    fn().catch(e => setErro(e.message || "Não foi possível concluir")).finally(() => setOcupado(false));
  };
  const criar = () => rodar(() => api.clientes.acesso.criar(cliente.id, email.trim())
    .then(a => { setAcesso({ ...a, ativo: true }); setSenhaNova(a.senha_temporaria); setEmail(""); }));
  const resetar = () => rodar(() => api.clientes.acesso.resetar(cliente.id)
    .then(a => setSenhaNova(a.senha_temporaria)));
  const alternar = () => rodar(() => api.clientes.acesso.ativar(cliente.id, !acesso.ativo)
    .then(a => setAcesso({ ...acesso, ativo: a.ativo })));

  return (
    <div style={card}>
      <div style={secTit}>Acesso do cliente</div>
      {acesso === undefined ? (
        <div style={{ fontSize: 12.5, color: "#4b5563" }}>Carregando…</div>
      ) : acesso === null ? (
        <>
          <div style={{ fontSize: 12.5, color: "#4b5563", marginBottom: 10 }}>
            Crie um login para {cliente.nome} acompanhar as obras dele: contas a pagar, extrato mensal, contratos e cronograma.
            Ele registra pagamentos, lança despesas e dá aceites; o cadastro da obra e os contratos continuam com você.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 10, alignItems: "center" }}>
            <input style={C.input} type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="e-mail do cliente" />
            <button style={btn} disabled={ocupado || !email.trim()} onClick={criar}>Criar acesso</button>
          </div>
          <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 6 }}>
            {cliente.email
              ? "E-mail do cadastro do cliente — dá para trocar aqui se o acesso for de outra pessoa."
              : "O cadastro deste cliente ainda não tem e-mail. Informe um aqui (ele também não será salvo no cadastro)."}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 3 }}>E-mail de acesso</div>
              <div style={{ fontSize: 13, color: "#111827", fontWeight: 600 }}>{acesso.email}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 3 }}>Situação</div>
              <div style={{ fontSize: 13, color: "#111827", fontWeight: 600 }}>{acesso.ativo ? "Ativo" : "Desativado"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 3 }}>Último acesso</div>
              <div style={{ fontSize: 13, color: "#111827", fontWeight: 600 }}>
                {acesso.ultimo_login ? new Date(acesso.ultimo_login).toLocaleString("pt-BR") : "nunca entrou"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={btnSec} disabled={ocupado} onClick={resetar}>Gerar nova senha</button>
            <button style={btnSec} disabled={ocupado} onClick={alternar}>{acesso.ativo ? "Desativar acesso" : "Reativar acesso"}</button>
          </div>
        </>
      )}
      {senhaNova && (
        <div style={{ marginTop: 12, border: `1.5px solid ${AZUL_VK}`, borderRadius: 12, padding: "10px 12px", background: "#fff" }}>
          <div style={{ fontSize: 11.5, color: "#4b5563" }}>Senha inicial — anote e passe ao cliente; ela não aparece de novo. Ele troca no primeiro acesso.</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", letterSpacing: 1, marginTop: 4 }}>{senhaNova}</div>
        </div>
      )}
      {erro && <div style={{ marginTop: 10, fontSize: 12, color: "#dc2626" }}>{erro}</div>}
    </div>
  );
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
  const VK = { grafite:"#111827", cobre:AZUL_VK, inkSoft:"#4b5563" };
  const secTit = { fontSize:12.5, fontWeight:700, color:VK.grafite, marginBottom:14 };
  const secBtn = () => ({ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", background:"none", border:"none", borderBottom:"1px solid rgba(38,36,33,0.08)", padding:"12px 0", cursor:"pointer", fontFamily:"inherit", color:VK.grafite, fontSize:13, fontWeight:600 });
  const card = { border:"1px solid rgba(38,36,33,0.12)", borderRadius:16, padding: isMobile ? "16px" : "18px 20px", marginBottom:16, background:"#fff", boxShadow:"0 4px 16px -10px rgba(38,36,33,0.25)" };
  const btn = { background:VK.grafite, color:"#fff", border:"none", borderRadius:9, padding:"9px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" };
  const btnSec = { background:"#fff", color:VK.grafite, border:"1.5px solid rgba(38,36,33,0.16)", borderRadius:9, padding:"9px 16px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" };
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
        <button style={{ background:"none", border:"none", color:"#dc2626", cursor:"pointer", fontFamily:"inherit", fontSize:13 }} onClick={onRemover}>Remover cliente</button>
      </div>

      <AcessoDoCliente cliente={cliente} card={card} secTit={secTit} btn={btn} btnSec={btnSec} isMobile={isMobile} />

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
            {[["CEP",cliente.cep],["Logradouro",`${cliente.logradouro||""}${cliente.numero?", "+cliente.numero:""}${cliente.complemento?" - "+cliente.complemento:""}`],["Bairro",cliente.bairro],["Cidade",`${cliente.cidade||""} — ${cliente.estado||""}`],
              ...(cliente.representanteNome ? [["Representante", `${cliente.representanteNome}${cliente.representanteCpf?` · CPF ${cliente.representanteCpf}`:""}`]] : [])].map(([l,v])=>(
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
                    style={{fontSize:12,color:"#111827",textDecoration:"none",background:"#fff",border:"1.5px solid rgba(38,36,33,0.16)",borderRadius:6,padding:"4px 10px",flexShrink:0,fontWeight:600}}>WhatsApp</a>
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
                {[["Receita total",totalContabil,"#111827"],["Recebido",totalRecebido,"#111827"],["A receber",totalReceber,"#111827"]].map(([l,v,cor])=>(
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
        representanteNome:"", representanteCpf:"",
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


  // Interação em azul: borda do campo, do botão e do cartão em hover e foco.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.querySelector("style[data-vk-ui-css]")) return;
    const tag = document.createElement("style");
    tag.setAttribute("data-vk-ui-css", "1");
    tag.textContent = `
      [data-vk-ui="1"] input:hover,
      [data-vk-ui="1"] select:hover,
      [data-vk-ui="1"] textarea:hover,
      [data-vk-ui="1"] button:hover { border-color:${AZUL_VK} !important; }
      [data-vk-ui="1"] input:focus,
      [data-vk-ui="1"] select:focus,
      [data-vk-ui="1"] textarea:focus {
        border-color:${AZUL_VK} !important; box-shadow:0 0 0 3px rgba(4,116,244,0.18); outline:none;
      }`;
    document.head.appendChild(tag);
  }, []);
  const emptyCliente = {
    tipo:"PF", nome:"", cpfCnpj:"", email:"", cep:"", logradouro:"", numero:"",
    complemento:"", bairro:"", cidade:"", estado:"SP",
    representanteNome:"", representanteCpf:"",
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
      <div data-vk-ui="1" style={{ padding:"24px 28px", fontFamily:"'Inter', system-ui, -apple-system, sans-serif" }}>
        <h2 style={{ color:"#111827", fontWeight:700, fontSize:22, margin:0, letterSpacing:-0.5 }}>Clientes</h2>
        <div style={{ color:"#4b5563", fontSize:13, marginTop:4 }}>Carregando…</div>
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
          return <span style={{ color:"#4b5563" }}>Inativo há {meses} {meses === 1 ? "mês" : "meses"} · automático</span>;
        }
        if (c.inativadoEm) {
          return <span style={{ color:"#4b5563" }}>Inativado em {new Date(c.inativadoEm).toLocaleDateString("pt-BR", { day:"2-digit", month:"short" }).replace(".", "")}</span>;
        }
        return <span style={{ color:"#4b5563" }}>Inativo</span>;
      }

      // Sem atividade: mostra "cliente inativa em X dias"
      if (!status.temAtividade) {
        if (status.inativaEm != null) {
          if (status.inativaEm <= 0) {
            return <span style={{ color:"#111827", fontWeight:600 }}>Será inativado em breve</span>;
          }
          if (status.inativaEm <= 15) {
            return <span style={{ color:"#111827", fontWeight:600 }}>Inativa em {status.inativaEm} dias</span>;
          }
          if (status.inativaEm <= 30) {
            return <span style={{ color:"#4b5563" }}>Inativa em {status.inativaEm} dias</span>;
          }
          return <span style={{ color:"#4b5563" }}>Sem serviço ativo</span>;
        }
        return <span style={{ color:"#4b5563" }}>Novo cliente</span>;
      }

      // Cliente com serviços ativos: renderiza chips
      return status.chips.map((chip, i) => {
        const corAlerta = chip.alerta === "vermelho" ? "#111827" : null;
        return (
          <span key={i} style={{ color:"#111827" }}>
            {i > 0 && <span style={{ color:"#4b5563", margin:"0 6px" }}>·</span>}
            <span>{chip.tipo}</span>
            <span style={{ color:"#4b5563" }}> ({chip.estado})</span>
            {chip.info && (
              <span style={{ color:corAlerta || "#4b5563", marginLeft:4, fontWeight: corAlerta ? 600 : 400 }}>
                {chip.info}
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
          background:"#fff", border:"1px solid rgba(38,36,33,0.14)", borderRadius: 12,
          padding:"10px 14px", marginBottom:6, cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"space-between", gap:10,
          transition:"border-color 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={e=>{ e.currentTarget.style.borderColor=AZUL_VK; e.currentTarget.style.boxShadow="0 0 0 3px rgba(4,116,244,0.12)"; }}
        onMouseLeave={e=>{ e.currentTarget.style.borderColor="rgba(38,36,33,0.14)"; e.currentTarget.style.boxShadow="none"; }}>
        <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:2 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"#111827", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
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
              style={{ fontSize:11, color:"#4b5563", background:"#fff", border:"1.5px solid rgba(38,36,33,0.16)", borderRadius:5, padding:"4px 6px", cursor:"pointer", fontFamily:"inherit" }}>
              {COLUNAS.map(col => <option key={col.key} value={col.key}>{col.label}</option>)}
            </select>
          ) : (
            <button onClick={e=>{e.stopPropagation();openEdit(c);}}
              style={{ fontSize:11, color:"#4b5563", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", padding:"4px 6px" }}
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
    }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    // ── MOBILE: abas por coluna ──────────────────────────────
    if (isMobile) {
      const colAtual = COLUNAS.find(x => x.key === abaKanban) || COLUNAS[0];
      const cardsAba = filtrados.filter(c => colunaDoCliente(c) === abaKanban);
      return (
        <div data-vk-ui="1" style={{ fontFamily:"'Inter', system-ui, -apple-system, sans-serif", minHeight:"calc(100vh - 53px)", display:"flex", flexDirection:"column" }}>
          {/* Header mobile */}
          <div style={{ padding:"16px 16px 0", display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:17, fontWeight:700, color:"#111827" }}>Clientes</div>
                <div style={{ fontSize:12, color:"#4b5563" }}>{data.clientes.length} cadastrado{data.clientes.length!==1?"s":""}</div>
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
                    color: ativa ? "#111827" : "#4b5563",
                    background:"transparent", border:"none", borderBottom: ativa ? `2px solid ${AZUL_VK}` : "2px solid transparent",
                    cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 }}>
                  
                  {col.label}
                  <span style={{ fontSize:11, background:"#f3f4f6", color: ativa ? "#111827" : "#4b5563", borderRadius: 14, padding:"1px 7px", fontWeight:600 }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Cards da aba ativa */}
          <div style={{ flex:1, overflowY:"auto", padding:"12px 16px" }}>
            {cardsAba.length === 0 ? (
              <div style={{ textAlign:"center", padding:"48px 0", color:"#4b5563", fontSize:13 }}>
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
      <div data-vk-ui="1" style={{ padding:"24px 28px", fontFamily:"'Inter', system-ui, -apple-system, sans-serif", minHeight:"calc(100vh - 53px)", display:"flex", flexDirection:"column" }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:"#111827" }}>Clientes</div>
            <div style={{ fontSize:13, color:"#4b5563", marginTop:2 }}>{data.clientes.length} cadastrado{data.clientes.length!==1?"s":""}</div>
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
                style={{ background:"#fafafa", border:`1px solid ${isOver ? AZUL_VK : "#f3f4f6"}`, borderRadius: 16, display:"flex", flexDirection:"column", transition:"border-color 0.15s, background 0.15s" }}
                onDragOver={e => { e.preventDefault(); setDragOver(col.key); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => { e.preventDefault(); if (dragId) moverCliente(dragId, col.key); setDragId(null); setDragOver(null); }}>
                {/* Header coluna */}
                <div style={{ padding:"14px 16px", borderBottom:"1px solid #f3f4f6", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    
                    <span style={{ fontSize:13, fontWeight:600, color:"#111827" }}>{col.label}</span>
                  </div>
                  <span style={{ fontSize:12, color:"#4b5563", background:"#f3f4f6", borderRadius: 14, padding:"1px 8px" }}>{cards.length}</span>
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
                    <div style={{ textAlign:"center", padding:"24px 0", color:"#4b5563", fontSize:12 }}>
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
    }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return (
      <div data-vk-ui="1" style={{ padding: isMobile ? "16px" : "28px 32px", fontFamily:"'Inter', system-ui, -apple-system, sans-serif" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
          <div style={{ fontSize:18, fontWeight:700, color:"#111827" }}>Clientes</div>
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
              <div key={c.id} style={{ background:"#fff", border:"1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding:"14px 16px", display:"flex", alignItems:"center", gap:14, cursor:"pointer", transition:"border-color 0.15s, box-shadow 0.15s" }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor=AZUL_VK; e.currentTarget.style.boxShadow="0 0 0 3px rgba(4,116,244,0.12)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor="rgba(38,36,33,0.14)"; e.currentTarget.style.boxShadow="none"; }}
                onClick={()=>openDetail(c)}>
                <div style={{ width:40, height:40, borderRadius: 14, background:corAv+"15", color:corAv, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, flexShrink:0 }}>{iniciais}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"#111827" }}>{c.nome}</div>
                  <div style={{ fontSize:12, color:"#4b5563" }}>{c.cpfCnpj}{c.cidade?` · ${c.cidade}`:""}</div>
                </div>
                <div style={{ display:"flex", gap:6, alignItems:"center" }} onClick={e=>e.stopPropagation()}>
                  <span style={{ fontSize:12, color:"#111827", fontWeight:600 }}>{col.label}</span>
                  {tel && <a href={waLink(tel)} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:"#111827", textDecoration:"none", border:"1.5px solid rgba(38,36,33,0.16)", borderRadius:6, padding:"4px 10px" }}>WA</a>}
                  <button onClick={()=>openEdit(c)} style={{ fontSize:12, color:"#4b5563", background:"none", border:"1.5px solid rgba(38,36,33,0.16)", borderRadius:6, padding:"4px 10px", cursor:"pointer", fontFamily:"inherit" }}>Editar</button>
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

    const VKD = { fundo:"#fafafb", grafite:"#111827", cobre:AZUL_VK, cobreClaro:"#eef5ff", inkSoft:"#4b5563" };
    const SYS_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    return (
      <div className="vk-client-detail" data-vk-ui="1" style={{ padding: isMobile ? "16px" : "28px 32px", background:VKD.fundo, minHeight:"100%", fontFamily:SYS_FONT }}>
        <style>{`
          .vk-client-detail input:hover, .vk-client-detail select:hover, .vk-client-detail textarea:hover {
            border-color:${AZUL_VK} !important;
          }
          .vk-client-detail input:focus, .vk-client-detail select:focus, .vk-client-detail textarea:focus,
          .vk-client-detail button:focus-visible {
            border-color:${AZUL_VK} !important;
            box-shadow:0 0 0 3px rgba(4,116,244,0.18);
            outline:none;
          }
        `}</style>
        <div style={{ maxWidth:900, margin:"0 auto" }}>
          {/* Header */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:24, flexWrap:"wrap" }}>
            <button style={{ background:"none", border:"none", color:VKD.inkSoft, cursor:"pointer", fontFamily:"inherit", fontSize:13 }} onClick={()=>{ setView("kanban"); setAbaCliente("cadastro"); }}>← Voltar</button>
          </div>

          {/* Cliente Info — só o nome */}
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:28 }}>
            <div style={{ width: isMobile ? 48 : 56, height: isMobile ? 48 : 56, borderRadius:14, background:VKD.cobreClaro, color:VKD.cobre, display:"flex", alignItems:"center", justifyContent:"center", fontSize: isMobile ? 16 : 20, fontWeight:600, flexShrink:0, fontFamily:SYS_FONT }}>{iniciais}</div>
            <div style={{ fontFamily:SYS_FONT, fontSize: isMobile ? 19 : 23, fontWeight:700, color:VKD.grafite, overflow:"hidden", textOverflow:"ellipsis", letterSpacing:"-0.01em" }}>{cliente.nome}</div>
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
                  background: "#fff",
                  boxShadow: abaCliente === aba.id ? "0 0 0 3px rgba(4,116,244,0.16)" : "none",
                  cursor: "pointer",
                  fontFamily: SYS_FONT,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={e => {
                  if (abaCliente !== aba.id) {
                    e.currentTarget.style.borderColor = AZUL_VK;
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
    fundo:      "#fafafb",
    grafite:    "#111827",
    cobre:      AZUL_VK,
    cobreClaro: "#eef5ff",
    ink:        "#111827",
    inkSoft:    "#4b5563",
  };
  const FC = {
    input:  { border:"1.5px solid rgba(38,36,33,0.16)", borderRadius:9, height:46, padding:"0 14px", fontSize:15, color:"#111827", outline:"none", background:"#fff", fontFamily:"'Inter', system-ui, sans-serif", width:"100%", boxSizing:"border-box" },
    label:  { fontSize:12, color:"#4b5563", fontWeight:600, display:"block", marginBottom:6 },
    secTit: { fontSize:12.5, fontWeight:700, color:"#111827", marginBottom:16 },
    btn:    { background:VK.grafite, color:"#fff", border:"none", borderRadius:9, height:48, padding:"0 24px", fontSize:15, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', system-ui, sans-serif" },
    btnSec: { background:"#fff", color:"#111827", boxShadow:"inset 0 0 0 1.5px rgba(38,36,33,0.16)", border:"none", borderRadius:9, height:42, padding:"0 20px", fontSize:13.5, fontWeight:600, cursor:"pointer", fontFamily:"'Inter', system-ui, sans-serif" },
    btnGhost: { background:"none", border:"none", color:VK.inkSoft, cursor:"pointer", fontFamily:"'Inter', system-ui, sans-serif", fontSize:13 },
    divider: { border:"none", borderTop:"1px solid rgba(38,36,33,0.1)", margin:"22px 0" },
  };
  return (
    <div data-vk-ui="1" style={{ padding: isMobile ? "24px 16px 60px" : "40px 32px", background:VK.fundo, minHeight:"100%", fontFamily:"'Inter', system-ui, -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .vk-fc-input:hover, .vk-fc-tipo:hover { border-color:#0474f4 !important; }
        .vk-fc-input:focus { border-color:#0474f4 !important; box-shadow:0 0 0 3px rgba(4,116,244,0.18); outline:none; }
        .vk-fc-tipo.ativo { border-color:#0474f4 !important; background:#fff !important; box-shadow:0 0 0 2px rgba(4,116,244,0.16); }
        .vk-fc-check { accent-color:#111827; }
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
          {/* Quem assina pelo cliente — é o que sai no preâmbulo dos contratos. */}
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap:12, marginBottom:12 }}>
            <div>
              <label style={FC.label}>Representante legal</label>
              <input className="vk-fc-input" style={FC.input} value={form.representanteNome || ""} onChange={e=>setForm({...form,representanteNome:e.target.value})} placeholder={form.tipo==="PJ" ? "quem assina pela empresa" : "deixe em branco se assina o próprio"} />
            </div>
            <div>
              <label style={FC.label}>CPF do representante</label>
              <input className="vk-fc-input" style={FC.input} value={form.representanteCpf || ""} onChange={e=>setForm({...form,representanteCpf:e.target.value})} placeholder="000.000.000-00" />
            </div>
          </div>
          <div style={{ fontSize:11.5, color:"#4b5563", marginBottom:12 }}>Usado no preâmbulo e na assinatura dos contratos gerados.</div>
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
                  <span style={{color:"#111827"}}>WhatsApp</span>
                </label>
                {form.contatos.length>1&&<button style={{...FC.btnGhost,color:"#dc2626",fontSize:12}} onClick={()=>setForm({...form,contatos:form.contatos.filter((_,j)=>j!==i)})}>Remover</button>}
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
    <div style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color:"#111827" }}>Projetos</div>
          <div style={{ fontSize: 12, color:"#4b5563" }}>{orcamentos.length} projeto{orcamentos.length !== 1 ? "s" : ""}</div>
        </div>
        <button style={C.btn} onClick={() => onAbrirOrcamento(cliente, null, "novo")}>+ Novo projeto</button>
      </div>

      {orcamentos.length === 0 ? (
        <div style={{ padding: "20px", textAlign: "center", color:"#4b5563", fontSize: 12.5, border: "1px dashed rgba(38,36,33,0.18)", borderRadius: 9, background: "#fafafa" }}>
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
                style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 12, padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s", backgroundColor: "#fff" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = AZUL_VK; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(4,116,244,0.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(38,36,33,0.14)"; e.currentTarget.style.boxShadow="none"; }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color:"#111827" }}>{orc.tipo || "Projeto"}{orc.subtipo ? ` — ${orc.subtipo}` : ""}</div>
                  <div style={{ fontSize: 11, color:"#4b5563", marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize:12, color:"#111827", fontWeight:600 }}>{sts.label}</span>
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

// `obraInicial` + `onSairDaObra`: abre direto no detalhe de uma obra (menu
// lateral Obras) e o "Voltar" do detalhe devolve para quem chamou.
// ── Anel de progresso do custo ──────────────────────────────────
// É um MEDIDOR — uma razão contra um limite —, não uma pizza de duas fatias:
// a trilha é o custo estimado inteiro e o arco é o quanto dele já saiu. Por
// isso trilha e arco são o mesmo tom em intensidades diferentes.
//
// A cor sozinha não diz nada: o número no meio e as duas linhas ao lado
// carregam o dado. A cor só reforça a gravidade — azul enquanto sobra folga,
// âmbar chegando no limite, vermelho quando passou.
function AnelCusto({ progresso, tamanho }) {
  const p = progresso || { medivel: false, arco: 0, pct: 0, acima: false };
  const d = tamanho || 104;
  const grossura = Math.round(d * 0.13);
  const raio = (d - grossura) / 2;
  const volta = 2 * Math.PI * raio;
  // SPEC-VISUAL: a única cor fora do azul é o vermelho de ação destrutiva e
  // os fundos de alerta — sem fundo cobre, âmbar ou verde. Então são dois
  // estados, não três: azul enquanto está dentro do estimado, vermelho
  // quando passou. A faixa âmbar de "chegando no limite" saiu; quem avisa
  // que está apertado é o "Falta" ao lado, que é número, não cor.
  const tom = !p.medivel ? { arco: "rgba(38,36,33,0.16)", trilha: "rgba(38,36,33,0.10)" }
    : p.acima ? { arco: "#dc2626", trilha: "#fee2e2" }
    :           { arco: "#0474f4", trilha: "#eef5ff" };
  // arranca do topo e cresce no sentido do relógio
  const preenchido = volta * (p.arco / 100);
  return (
    <svg width={d} height={d} viewBox={`0 0 ${d} ${d}`} role="img"
      aria-label={p.medivel ? `${p.pct}% do custo estimado já foi gasto` : "sem estimativa para comparar"}>
      <circle cx={d / 2} cy={d / 2} r={raio} fill="none" stroke={tom.trilha} strokeWidth={grossura} />
      {p.medivel && p.arco > 0 && (
        <circle cx={d / 2} cy={d / 2} r={raio} fill="none" stroke={tom.arco} strokeWidth={grossura}
          strokeLinecap="round" strokeDasharray={`${preenchido} ${volta - preenchido}`}
          transform={`rotate(-90 ${d / 2} ${d / 2})`}
          style={{ transition: "stroke-dasharray .6s ease" }} />
      )}
      <text x={d / 2} y={d / 2} textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: Math.round(d * 0.23), fontWeight: 700, fill: p.medivel ? "#111827" : "#6b7280", fontFamily: "inherit" }}>
        {p.medivel ? `${p.pct}%` : "—"}
      </text>
    </svg>
  );
}

// ── Folha de comprovantes ───────────────────────────────────────
// Um fornecedor, todos os comprovantes, uma folha só — para imprimir ou
// salvar em PDF de uma vez, em vez de abrir pagamento por pagamento.
//
// A técnica de impressão é a mesma do contrato: na hora de imprimir a folha
// sobe para o body, porque dentro dos painéis do app ela herdava larguras e
// recortes que cortavam o conteúdo nas laterais da página.
const CP_COMPROV_PRINT_CSS = `
@media print {
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; overflow: visible !important; }
  body[data-vk-imprimindo-comprov="1"] > *:not([data-vk-comprovantes="1"]) { display: none !important; }
  body[data-vk-imprimindo-comprov="1"] [data-vk-comprovantes="1"] {
    position: static !important; inset: auto !important; width: auto !important; max-width: none !important;
    max-height: none !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; background: #fff !important;
  }
  [data-vk-comprovantes="1"] [data-vk-so-tela="1"] { display: none !important; }
  [data-vk-comprovantes="1"] [data-vk-pagamento="1"] { break-inside: avoid; page-break-inside: avoid; }
  [data-vk-comprovantes="1"] img { max-height: 200mm !important; }
  @page { size: A4; margin: 14mm 12mm; }
}
`;

function FolhaComprovantes({ folha, obraNome, escritorioNome, fmtBRL, aoFechar }) {
  const alvo = useRef(null);
  useEffect(() => {
    const tag = document.createElement("style");
    tag.setAttribute("data-vk-comprov-print", "1");
    tag.textContent = CP_COMPROV_PRINT_CSS;
    document.head.appendChild(tag);
    return () => { try { document.head.removeChild(tag); } catch (e) { /* já removido */ } };
  }, []);
  useEffect(() => {
    // O ref é quem entrega a folha; se algum dia ele se perder, o seletor
    // acha a mesma folha pelo atributo — sem ela, a impressão sai com o app
    // inteiro por baixo e só o primeiro comprovante cabe na página.
    const el = alvo.current || (typeof document !== "undefined" && document.querySelector('[data-vk-comprovantes="1"]'));
    if (!el || typeof window === "undefined" || !window.addEventListener) return;
    const pai = el.parentNode, proximo = el.nextSibling;
    let movido = false;
    const antes = () => { if (movido) return;
      try { document.body.appendChild(el); document.body.setAttribute("data-vk-imprimindo-comprov", "1"); movido = true; } catch (e) {} };
    const depois = () => { if (!movido) return;
      try { if (pai) pai.insertBefore(el, proximo); } catch (e) {}
      try { document.body.removeAttribute("data-vk-imprimindo-comprov"); } catch (e) {}
      movido = false; };
    window.addEventListener("beforeprint", antes);
    window.addEventListener("afterprint", depois);
    const esc = (e) => { if (e.key === "Escape") aoFechar(); };
    document.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("beforeprint", antes);
      window.removeEventListener("afterprint", depois);
      document.removeEventListener("keydown", esc);
      depois();
    };
  }, [aoFechar]);

  const dataBR = (iso) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR") : "—");
  const rotulo = { fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 };

  return (
    <div data-vk-comprovantes="1" ref={alvo}
      style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 9100, overflowY: "auto", padding: "20px 22px" }}>
      <div data-vk-so-tela="1" style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginBottom: 14, position: "sticky", top: 0, background: "#fff", paddingBottom: 8 }}>
        <button type="button" style={C.btnSec} onClick={aoFechar}>Fechar</button>
        <button type="button" style={C.btn} onClick={() => { try { window.print(); } catch (e) {} }}>Imprimir / salvar PDF</button>
      </div>

      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div style={{ borderBottom: "1.5px solid rgba(38,36,33,0.16)", paddingBottom: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#6b7280" }}>{escritorioNome || "Comprovantes de pagamento"}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#111827", marginTop: 2 }}>{folha.titulo}</div>
          <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>{obraNome}</div>
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginTop: 10 }}>
            <div><div style={rotulo}>Pagamentos</div><div style={{ fontSize: 13, fontWeight: 600 }}>{folha.linhas.length}</div></div>
            <div><div style={rotulo}>Total pago</div><div style={{ fontSize: 13, fontWeight: 600 }}>{fmtBRL(folha.total)}</div></div>
            <div><div style={rotulo}>Período</div><div style={{ fontSize: 13, fontWeight: 600 }}>{dataBR(folha.periodo.de)} a {dataBR(folha.periodo.ate)}</div></div>
            <div><div style={rotulo}>Comprovantes</div><div style={{ fontSize: 13, fontWeight: 600 }}>
              {folha.comImagem} na folha{folha.emPdf ? ` · ${folha.emPdf} em PDF` : ""}{folha.semComprovante ? ` · ${folha.semComprovante} sem` : ""}
            </div></div>
          </div>
        </div>

        {folha.linhas.map((l, i) => (
          <div key={l.id} data-vk-pagamento="1" style={{ marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid rgba(38,36,33,0.10)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>{i + 1}. {l.titulo}</div>
                {l.apoio && <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 1 }}>{l.apoio}</div>}
              </div>
              <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{fmtBRL(l.valor)}</div>
                <div style={{ fontSize: 11.5, color: "#4b5563" }}>pago em {dataBR(l.pagoEm)}</div>
              </div>
            </div>
            {l.temImagem ? (
              <img src={l.comprovante.url} alt={`Comprovante ${i + 1}`}
                style={{ display: "block", maxWidth: "100%", border: "1px solid rgba(38,36,33,0.12)", borderRadius: 6 }} />
            ) : l.ehPdf ? (
              <div style={{ fontSize: 11.5, color: "#4b5563", background: "#fafafa", border: "1px solid rgba(38,36,33,0.12)", borderRadius: 8, padding: "8px 10px" }}>
                Comprovante em PDF ({l.comprovante.nome || "arquivo"}) — vai como anexo à parte, o navegador não o imprime junto das fotos.
              </div>
            ) : (
              <div style={{ fontSize: 11.5, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px" }}>
                Sem comprovante anexado.
              </div>
            )}
          </div>
        ))}
        <div style={{ fontSize: 10.5, color: "#6b7280", marginTop: 8 }}>
          Emitido em {new Date().toLocaleDateString("pt-BR")}. Os valores são os efetivamente pagos, na data de contabilização de cada baixa.
        </div>
      </div>
    </div>
  );
}

// ── Anéis por grupo, no lugar da barra ──────────────────────────
// Agrupando por fornecedor ou por contrato, a pergunta deixa de ser "quando
// vou pagar" e passa a ser "quanto do que devo a cada um já saiu". O mesmo
// anel do Planejamento, repetido — e por contrato ele diz mais ainda: o
// total é o valor contratado, então o preenchimento É o quanto do contrato
// já foi pago.
function AneisPorGrupo({ grupos, visao, isMobile, fmtBRL }) {
  const r = aneisDosGrupos(grupos);
  if (r.vazio) return null;
  const num = (v) => (Math.abs(v) < 0.005 ? "—" : fmtBRL(v));
  const porContrato = visao === "contrato";
  const geral = progressoCusto({ estimado: r.total.total, realizado: r.total.pago });

  return (
    <div style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 14, padding: "14px 16px", marginBottom: 16, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>
          {porContrato ? "Pago por contrato" : "Pago por fornecedor"}
        </div>
        <div style={{ fontSize: 11.5, color: "#4b5563" }}>
          {r.linhas.length === 1 ? "1 " : `${r.linhas.length} `}
          {porContrato ? (r.linhas.length === 1 ? "contrato" : "contratos") : (r.linhas.length === 1 ? "fornecedor" : "fornecedores")}
          {" · "}pago <strong style={{ color: "#111827" }}>{num(r.total.pago)}</strong> de{" "}
          <strong style={{ color: "#111827" }}>{num(r.total.total)}</strong>
          {geral.medivel ? ` (${geral.pct}%)` : ""}
        </div>
      </div>
      <div style={{ display: "grid", gap: 12,
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(232px, 1fr))" }}>
        {r.linhas.map(l => (
          <div key={l.chave} style={{ border: "1px solid rgba(38,36,33,0.12)", borderRadius: 12,
            padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#111827", marginBottom: 6 }}>{l.titulo}</div>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 10px", alignItems: "baseline" }}>
                <span style={{ fontSize: 11, color: "#6b7280" }}>{porContrato && !l.avulso ? "Contratado" : "Total"}</span>
                <span style={{ fontSize: 12.5, color: "#111827", fontVariantNumeric: "tabular-nums" }}>{num(l.total)}</span>
                <span style={{ fontSize: 11, color: "#6b7280" }}>Pago</span>
                <span style={{ fontSize: 12.5, color: "#111827", fontVariantNumeric: "tabular-nums" }}>{num(l.pago)}</span>
                <span style={{ fontSize: 11, color: "#6b7280" }}>A pagar</span>
                <span style={{ fontSize: 12.5, color: "#111827", fontVariantNumeric: "tabular-nums" }}>{num(l.aberto)}</span>
                {l.vencido > 0.005 && (
                  <>
                    <span style={{ fontSize: 11, color: "#dc2626" }}>Vencido</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "#dc2626", fontVariantNumeric: "tabular-nums" }}>{num(l.vencido)}</span>
                  </>
                )}
              </div>
            </div>
            <AnelCusto progresso={l.progresso} tamanho={74} />
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 10 }}>
        Cada anel é o quanto já foi pago {porContrato ? "do contrato" : "do que se deve ao fornecedor"} —
        fecha em 100% quando não sobra nada. Os anéis somam a obra inteira; os quadros do topo e o mês
        escolhido filtram só a lista abaixo. Volte a agrupar por mês ou ano para ver o fluxo no tempo.
      </div>
    </div>
  );
}

// ── Prestadores: um anel por ofício ─────────────────────────────
// Pequenos múltiplos do MESMO medidor do cartão de custo: o olho compara
// preenchimento entre cartões sem precisar ler número nenhum, e quem
// estourou salta em vermelho no meio dos azuis. Cada anel mede o ofício
// contra o SEU estimado — não a fatia dele no total da obra, que é outra
// pergunta e não é a que se faz aqui.
function PrestadoresPLView({ itens, contasPagar, isMobile, fmtBRL }) {
  const r = prestadoresDoPL(itens, contasPagar, GRUPOS_PL, PLANO_CONTAS);
  const num = (v) => (Math.abs(v) < 0.005 ? "—" : fmtBRL(v));

  if (r.vazio) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#4b5563", fontSize: 12.5,
        border: "1px dashed rgba(38,36,33,0.18)", borderRadius: 9, background: "#fafafa", marginBottom: 16 }}>
        Nenhum prestador com estimativa ou pagamento ainda. Preencha os ofícios na aba Preencher;
        o que for pago em contas a pagar aparece aqui do lado.
      </div>
    );
  }

  const totalProg = progressoCusto(r.total);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ fontSize: 12.5, color: "#4b5563" }}>
          {r.linhas.length === 1 ? "1 prestador" : `${r.linhas.length} prestadores`} · estimado{" "}
          <strong style={{ color: "#111827" }}>{num(r.total.estimado)}</strong> · gasto{" "}
          <strong style={{ color: "#111827" }}>{num(r.total.realizado)}</strong>
          {totalProg.medivel ? ` (${totalProg.pct}%)` : ""}
        </span>
      </div>
      <div style={{ display: "grid", gap: 12,
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(232px, 1fr))" }}>
        {r.linhas.map(l => (
          <div key={l.conta.id} style={{ border: "1px solid rgba(38,36,33,0.12)", borderRadius: 12,
            padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#111827", marginBottom: 6 }}>{l.conta.nome}</div>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 10px", alignItems: "baseline" }}>
                <span style={{ fontSize: 11, color: "#6b7280" }}>Estimado</span>
                <span style={{ fontSize: 12.5, color: "#111827", fontVariantNumeric: "tabular-nums" }}>{num(l.estimado)}</span>
                <span style={{ fontSize: 11, color: "#6b7280" }}>Gasto</span>
                <span style={{ fontSize: 12.5, color: "#111827", fontVariantNumeric: "tabular-nums" }}>{num(l.realizado)}</span>
                {l.progresso.medivel && (
                  <>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>{l.progresso.acima ? "Passou em" : "Falta"}</span>
                    <span style={{ fontSize: 12.5, color: l.progresso.acima ? "#dc2626" : "#111827", fontVariantNumeric: "tabular-nums" }}>
                      {num(Math.abs(l.saldo))}
                    </span>
                  </>
                )}
              </div>
            </div>
            <AnelCusto progresso={l.progresso} tamanho={74} />
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 10 }}>
        Cada anel é o ofício contra o próprio estimado. Entram a mão de obra inteira e o gerenciamento de obra —
        material, imposto e tarifa não são prestador. “Gasto” é o que já foi <strong style={{ color: "#4b5563" }}>pago</strong>;
        conta em aberto não entra.
      </div>
    </div>
  );
}

// ── P&L da obra: a tela de abertura do Planejamento ─────────────
// A pergunta de todo dia é "quanto eu disse que ia custar e quanto já saiu".
// Por isso o Planejamento abre aqui, e não no formulário de preencher.
function PLDaObraView({ itens, contasPagar, clientePaga, isMobile, fmtBRL }) {
  const pl = plDaObra(itens, contasPagar, GRUPOS_PL, PLANO_CONTAS);
  const prog = progressoCusto(pl.custo);
  const num = (v) => (Math.abs(v) < 0.005 ? "—" : fmtBRL(v));
  const grade = {
    display: "grid",
    gridTemplateColumns: isMobile ? "minmax(0,1fr) 96px 96px" : "minmax(180px, 1fr) 150px 150px 150px",
    gap: 8, alignItems: "center",
  };
  const celula = { fontSize: 12.5, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  const cab = { fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 };

  return (
    <div style={{ marginBottom: 16 }}>
      {/* ── o cartão do topo ── */}
      <div style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 14, padding: isMobile ? 14 : "16px 18px",
        marginBottom: 18, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 190 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Custo total realizado</div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 14px", alignItems: "baseline" }}>
            <span style={{ fontSize: 12, color: "#4b5563" }}>Estimado</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111827", fontVariantNumeric: "tabular-nums" }}>{num(pl.custo.estimado)}</span>
            <span style={{ fontSize: 12, color: "#4b5563" }}>Gasto</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111827", fontVariantNumeric: "tabular-nums" }}>{num(pl.custo.realizado)}</span>
            {prog.medivel && (
              <>
                <span style={{ fontSize: 12, color: "#4b5563" }}>{prog.acima ? "Passou em" : "Falta"}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: prog.acima ? "#dc2626" : "#111827", fontVariantNumeric: "tabular-nums" }}>
                  {num(Math.abs(prog.resta))}
                </span>
              </>
            )}
          </div>
          {!prog.medivel && (
            <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 8 }}>
              Sem estimativa não há contra o que comparar — preencha na aba Preencher.
            </div>
          )}
        </div>
        <AnelCusto progresso={prog} tamanho={isMobile ? 92 : 112} />
      </div>

      {/* ── o P&L conta a conta ── */}
      {pl.vazio ? (
        <div style={{ padding: 24, textAlign: "center", color: "#4b5563", fontSize: 12.5,
          border: "1px dashed rgba(38,36,33,0.18)", borderRadius: 9, background: "#fafafa" }}>
          Nada estimado nem pago ainda. Preencha a estimativa na aba Preencher; o que for pago em contas a pagar aparece aqui do lado.
        </div>
      ) : (
        <div style={{ border: "1px solid rgba(38,36,33,0.12)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ ...grade, padding: "8px 12px", borderBottom: "1px solid rgba(38,36,33,0.10)" }}>
            <span style={cab}>Conta</span>
            <span style={{ ...cab, textAlign: "right" }}>Estimado</span>
            <span style={{ ...cab, textAlign: "right" }}>Realizado</span>
            {!isMobile && <span style={{ ...cab, textAlign: "right" }}>Saldo</span>}
          </div>
          {pl.blocos.map(b => (
            <div key={b.grupo.id}>
              <div style={{ ...grade, padding: "7px 12px", background: "#fafafa", borderTop: "1px solid rgba(38,36,33,0.10)" }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#111827" }}>{b.grupo.titulo}</span>
                <span style={{ ...celula, fontWeight: 700 }}>{num(b.estimado)}</span>
                <span style={{ ...celula, fontWeight: 700 }}>{num(b.realizado)}</span>
                {!isMobile && <span style={{ ...celula, fontWeight: 700, color: "#4b5563" }}>{num(b.estimado - b.realizado)}</span>}
              </div>
              {b.linhas.map(l => (
                <div key={l.conta.id} style={{ ...grade, padding: "6px 12px", borderTop: "1px solid rgba(38,36,33,0.06)" }}>
                  <span style={{ fontSize: 12.5, color: "#4b5563", minWidth: 0 }}>{l.conta.nome}</span>
                  <span style={{ ...celula, color: "#6b7280" }}>{num(l.estimado)}</span>
                  <span style={{ ...celula, color: "#111827" }}>{num(l.realizado)}</span>
                  {!isMobile && <span style={{ ...celula, color: l.saldo < -0.005 ? "#dc2626" : "#6b7280" }}>{num(l.saldo)}</span>}
                </div>
              ))}
            </div>
          ))}
          <div style={{ ...grade, padding: "9px 12px", borderTop: "1.5px solid rgba(38,36,33,0.14)", background: "#fafafa" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>
              {clientePaga ? "CUSTO TOTAL" : "RESULTADO"}
            </span>
            <span style={{ ...celula, fontWeight: 700 }}>{num(clientePaga ? pl.custo.estimado : pl.resultado.estimado)}</span>
            <span style={{ ...celula, fontWeight: 700 }}>{num(clientePaga ? pl.custo.realizado : pl.resultado.realizado)}</span>
            {!isMobile && <span />}
          </div>
        </div>
      )}
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>
        “Realizado” é o que já foi <strong style={{ color: "#4b5563" }}>pago</strong> em contas a pagar, acumulado até hoje —
        conta em aberto não entra. “Estimado” vem da aba Preencher.
        {clientePaga && " O cliente paga os fornecedores direto, então a obra fecha no custo."}
      </div>
    </div>
  );
}

// ── Quadro de preenchimento da estimativa ─────────────────────
// Uma linha por conta do plano, o valor digitado direto. É o caminho para
// dar o primeiro número em quarenta contas sem quarenta idas ao formulário;
// o detalhe item a item continua existindo em "Por conta".
function QuadroEstimativaPL({ itens, podeEditar, isMobile, aoDefinir, fmtBRL, clientePaga }) {
  const linhas = linhasEstimativaPL(itens, GRUPOS_PL, PLANO_CONTAS);
  const totais = totaisEstimativaPL(itens, GRUPOS_PL, PLANO_CONTAS);
  const fecho = fechoEstimativaPL(itens, GRUPOS_PL, PLANO_CONTAS, clientePaga);
  const cel = { border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 9, padding: "6px 9px", fontSize: 12.5,
    color: "#111827", outline: "none", background: "#fff", fontFamily: "inherit", width: "100%",
    boxSizing: "border-box", textAlign: "right" };
  const grade = { display: "grid", gridTemplateColumns: isMobile ? "1fr 130px" : "minmax(190px, 1fr) 150px 150px", gap: 10, alignItems: "center" };
  const porGrupo = {};
  for (const l of linhas) (porGrupo[l.grupoId] || (porGrupo[l.grupoId] = [])).push(l);
  // Grupo sem nada estimado mostra travessão, não "R$ 0,00" — zero aqui é
  // ausência de estimativa, e a linha da conta já usa a mesma convenção.
  const dinheiroOuTraco = (v) => (Math.abs(v) < 0.005 ? "—" : fmtBRL(v));
  // O menos vai na frente do símbolo: "− R$ 1.030.000,00", não "R$ -1.030.000,00".
  const comSinal = (v) => (v < -0.005 ? "− " + fmtBRL(Math.abs(v)) : fmtBRL(v));

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 14 }}>
        Um campo por conta do P&amp;L. Campo em branco é conta sem estimativa — não é conta estimada em zero.
        Contas que já têm itens detalhados em “Por conta” mostram a soma deles e não são editadas aqui.
      </div>
      {GRUPOS_PL.map(g => {
        const ls = porGrupo[g.id] || [];
        if (!ls.length) return null;
        return (
          <div key={g.id} style={{ marginBottom: 18 }}>
            <div style={{ ...grade, borderBottom: "1.5px solid rgba(38,36,33,0.14)", paddingBottom: 6, marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#111827", textTransform: "uppercase", letterSpacing: 0.5 }}>{g.titulo}</div>
              {!isMobile && <div />}
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827", textAlign: "right" }}>{dinheiroOuTraco(totais.porGrupo[g.id] || 0)}</div>
            </div>
            {ls.map(l => (
              <div key={l.contaId} style={{ ...grade, marginBottom: 7 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: "#111827" }}>{l.nome}</div>
                  {!l.editavel && (
                    <div style={{ fontSize: 10.5, color: "#6b7280" }}>
                      {l.detalhados === 1 ? "1 item detalhado" : `${l.detalhados} itens detalhados`} — edite em “Por conta”
                    </div>
                  )}
                </div>
                {!isMobile && (
                  l.editavel && podeEditar ? (
                    <CampoNumeroBR estilo={cel} casas={2} valor={l.valorQuadro} placeholder="—"
                      aoMudar={(v) => aoDefinir(l.contaId, v)} />
                  ) : <div />
                )}
                <div style={{ fontSize: 12.5, fontWeight: l.total > 0 ? 600 : 400, color: l.total > 0 ? "#111827" : "#9ca3af", textAlign: "right", whiteSpace: "nowrap" }}>
                  {l.total > 0 ? fmtBRL(l.total) : "—"}
                </div>
                {isMobile && l.editavel && podeEditar && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <CampoNumeroBR estilo={cel} casas={2} valor={l.valorQuadro} placeholder="—"
                      aoMudar={(v) => aoDefinir(l.contaId, v)} />
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
      <div style={{ ...grade, borderTop: "1.5px solid rgba(38,36,33,0.14)", paddingTop: 10 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>{fecho.rotulo}</div>
        {!isMobile && <div />}
        <div style={{ fontSize: 13.5, fontWeight: 700, color: fecho.valor < 0 ? "#dc2626" : "#15803d", textAlign: "right", whiteSpace: "nowrap" }}>
          {comSinal(fecho.valor)}
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
        {fecho.nota}
        {!clientePaga && (totais.porGrupo.receitas || 0) < 0.005 && " Sem entrada estimada ainda, o resultado é o custo inteiro."}
      </div>
    </div>
  );
}

function GestaoObraPanel({ cliente, data, save, isMobile, obraInicial, onSairDaObra }) {
  const perm = getPermissoes();
  const [view, setView] = useState(obraInicial ? "detalheObra" : "lista");
  const [formObra, setFormObra] = useState(null);
  const [formContrato, setFormContrato] = useState(null);
  // Gerador de contratos: `contratoGerando` é o rascunho em edição e
  // `contratoAberto` é o contrato salvo que está sendo lido/impresso.
  const [contratoGerando, setContratoGerando] = useState(null);
  const [contratoAberto, setContratoAberto] = useState(null);
  // Cadastro rápido de prestador, aberto de dentro do gerador.
  const [novoPrestador, setNovoPrestador] = useState(null);
  // Cláusulas cujo campo livre "Especificar" está aberto no gerador.
  const [especificando, setEspecificando] = useState({});
  // Aviso de "salvo" no gerador e pedido de impressão vindo do botão Gerar PDF.
  const [contratoSalvoEm, setContratoSalvoEm] = useState(0);
  // Contas a pagar: formulário da conta avulsa em edição.
  const [formConta, setFormConta] = useState(null);
  // Contas a pagar: como agrupar, o que mostrar e quais grupos estão fechados.
  const [visaoContas, setVisaoContas] = useState("mes");
  // Abre em "A pagar": é o que a tela é. O gráfico segue o mesmo filtro —
  // barra azul do que falta pagar — e os quadros do topo trocam os dois.
  const [filtroContas, setFiltroContas] = useState(FILTRO_CONTAS_PADRAO);
  const [gruposFechados, setGruposFechados] = useState({});
  // Mês escolhido no gráfico: filtra a lista até clicarem fora do gráfico.
  const [mesSelecionado, setMesSelecionado] = useState("");
  const refGrafico = useRef(null);
  useEffect(() => {
    if (!mesSelecionado || typeof document === "undefined") return;
    const fora = (ev) => {
      const alvo = ev.target;
      if (refGrafico.current && refGrafico.current.contains(alvo)) return;
      // botões da própria lista (pagar, editar) não desfazem a escolha
      if (alvo && alvo.closest && alvo.closest("[data-vk-mantem-mes]")) return;
      setMesSelecionado("");
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [mesSelecionado]);
  const [imprimirAoAbrir, setImprimirAoAbrir] = useState(false);
  const [obraSelecionada, setObraSelecionada] = useState(obraInicial || null);
  // Planejamento (P&L estimado) — protótipo iterativo, ver conversa.
  const [formItemPL, setFormItemPL] = useState(null);
  // O Planejamento abre no P&L: a pergunta de todo dia é quanto foi estimado
  // e quanto já saiu, não o formulário de preencher.
  const [visaoPL, setVisaoPL] = useState("pl"); // "pl" | "quadro" | "conta" | "prestador" | "extrato"
  // Cadastro do escritório editado de dentro do gerador de contratos: sem ele
  // o contrato do escritório sai sem CNPJ, endereço e responsável técnico.
  const [formEscritorio, setFormEscritorio] = useState(null);
  // Baixa de conta: telinha com a data de contabilização e o valor pago.
  const [formPagamento, setFormPagamento] = useState(null);
  const [folhaComprov, setFolhaComprov] = useState(null); // { titulo, contas } quando aberta
  // Extrato mensal (P&L realizado): mês escolhido e formulário de entrada.
  const [mesExtrato, setMesExtrato] = useState("");
  const [formEntrada, setFormEntrada] = useState(null);
  // Recalibragem das datas de um contrato já registrado.
  const [formRecalibrar, setFormRecalibrar] = useState(null);
  // Contas com os detalhes abertos na lista (a linha fechada tem 2 linhas).
  const [contasAbertas, setContasAbertas] = useState({});

  const obras = (data.obras || []).filter(o => o.clienteId === cliente.id);
  const prestadores = data.fornecedores || [];
  // Os contratos moram DENTRO da obra (obra.contratos). A coleção
  // data.contratos nunca foi gravada pelo backend — o contrato ficava só na
  // memória da aba e sumia no reload. A obra é gravada como documento JSON,
  // então é nela que o contrato fica, junto da estimativa.
  const contratosLegado = (data.contratos || []).filter(c => c.clienteId === cliente.id);
  const contratos = [
    ...contratosDasObras(obras, cliente.id),
    // contratos que ficaram em memória antes desta mudança
    ...contratosLegado.filter(c => !obras.some(o => (o.contratos || []).some(x => x.id === c.id))),
  ];
  // data.obras guarda as obras de TODOS os clientes; `obras` acima é só a
  // fatia deste. Gravar a fatia por cima da coleção apagava as obras dos
  // outros clientes — por isso toda escrita passa por aqui.
  const gravarObras = (fatia) => save({ ...data, obras: mesclarPorCliente(data.obras, cliente.id, fatia) });
  // ── Cadastro do escritório (contratado dos contratos de gestão) ──
  const abrirFormEscritorio = () => {
    const e = data.escritorio || {};
    const r = (e.responsaveis && e.responsaveis[0]) || {};
    setFormEscritorio({
      nome: e.nome || "", cnpj: e.cnpj || e.cnpjCpf || e.documento || "",
      endereco: e.endereco || e.logradouro || "", cidade: e.cidade || "",
      estado: e.estado || "", cep: e.cep || "",
      respNome: r.nome || e.responsavel || "", respCpf: r.cpf || e.cpfResponsavel || "",
      respCau: r.cau || e.cau || "",
    });
  };
  const salvarFormEscritorio = () => {
    const f = formEscritorio; if (!f) return;
    const e = data.escritorio || {};
    const antigos = e.responsaveis || [];
    const primeiro = { ...(antigos[0] || { id: "r1" }), nome: f.respNome, cpf: f.respCpf, cau: f.respCau };
    save({ ...data, escritorio: {
      ...e, nome: f.nome, cnpj: f.cnpj, endereco: f.endereco,
      cidade: f.cidade, estado: f.estado, cep: f.cep,
      responsaveis: [primeiro, ...antigos.slice(1)],
    } });
    setFormEscritorio(null);
  };
  // ── Contas a pagar ──────────────────────────────────────────
  // Também moram dentro da obra (obra.contasPagar). As de contrato são
  // geradas ao salvar o contrato; as avulsas, à mão.
  const hojeIso = new Date().toISOString().slice(0, 10);
  // `obraSelecionada` é uma CÓPIA guardada no estado quando a obra foi aberta:
  // ela envelhece assim que um contrato, uma conta ou um item do P&L é salvo.
  // Para ler qualquer coisa da obra (contas, cronograma, estimativa) use
  // `obraAtual`, o registro fresco da coleção; a cópia do estado é só reserva.
  const obraAtual = obraSelecionada ? (obras.find(o => o.id === obraSelecionada.id) || obraSelecionada) : null;
  const contasDaObra = (obraAtual && obraAtual.contasPagar) || [];
  const gravarContas = (novasContas, obraId) => {
    const alvo = obraId || (obraSelecionada && obraSelecionada.id);
    if (!alvo) return;
    gravarObras(obras.map(o => o.id === alvo ? { ...o, contasPagar: novasContas } : o));
  };
  // Contas geradas por uma versão antiga das regras de vencimento (ex.: as
  // mensais que andavam de 30 em 30 dias, escorregando o dia do mês) se
  // corrigem sozinhas ao abrir a tela — sem precisar salvar o contrato de
  // novo. O que já foi pago é preservado; só se grava quando algo muda.
  //
  // Aqui também sai a faxina das órfãs: parcela de contrato que não existe
  // mais. A obra sem contrato nenhum também passa por isso — era o caso que
  // escapava, porque o efeito desistia antes quando a lista vinha vazia.
  useEffect(() => {
    if (view !== "contasPagar" || !obraAtual) return;
    const contratosDaObra = obraAtual.contratos || [];
    // `contratos` é a lista completa do cliente (obras + coleção antiga) —
    // com uma lista parcial a faxina apagaria parcela boa
    const semOrfas = removerOrfasDeContrato(contasDaObra, contratos);
    const novas = contratosDaObra.length ? sincronizarContasDaObra(semOrfas, contratosDaObra) : semOrfas;
    if (assinaturaContas(novas) === assinaturaContas(contasDaObra)) return;
    gravarContas(novas, obraAtual.id);
  }, [view, obraAtual && obraAtual.id, assinaturaContas(contasDaObra),
      JSON.stringify((obraAtual && obraAtual.contratos) || []), contratos.map(c => c.id).join("|")]);

  const salvarContaAvulsa = () => {
    const f = formConta;
    if (!f.descricao?.trim()) { dialogo.alertar({ titulo: "Informe a descrição da conta", tipo: "aviso" }); return; }
    if (!(Number(f.valor) > 0)) { dialogo.alertar({ titulo: "Informe um valor maior que zero", tipo: "aviso" }); return; }
    const existe = contasDaObra.some(c => c.id === f.id);
    gravarContas(existe ? contasDaObra.map(c => c.id === f.id ? f : c) : [...contasDaObra, f]);
    setFormConta(null);
  };
  // Pagar registra o realizado na própria conta — é ela que alimenta o
  // realizado por conta do plano de contas e por prestador.
  // Desfazer é imediato; pagar abre a telinha da data de contabilização.
  const alternarPagamento = (conta) => {
    if (conta.pago) {
      const atualizada = { ...conta, pago: false, pagoEm: "", valorPago: "", contabilizadoEm: "" };
      gravarContas(contasDaObra.map(c => c.id === conta.id ? atualizada : c), conta.obraId);
      return;
    }
    setFormPagamento({ conta, dataContab: conta.vencimento && conta.vencimento <= hojeIso ? conta.vencimento : hojeIso,
      valorPago: Number(conta.valor) || 0, comprovante: conta.comprovante || null, erroAnexo: "" });
  };
  // Confirma a baixa: a despesa entra no mês da data de contabilização
  // escolhida (`pagoEm`); `contabilizadoEm` guarda o dia em que se registrou.
  const confirmarPagamento = () => {
    const f = formPagamento; if (!f) return;
    const valor = numeroDeCampo(f.valorPago) || Number(f.conta.valor) || 0;
    if (!f.dataContab) { dialogo.alertar({ titulo: "Informe a data de contabilização", tipo: "aviso" }); return; }
    const atualizada = { ...f.conta, pago: true, pagoEm: f.dataContab, valorPago: valor, contabilizadoEm: hojeIso,
      comprovante: f.comprovante || null };
    gravarContas(contasDaObra.map(c => c.id === f.conta.id ? atualizada : c), f.conta.obraId);
    setFormPagamento(null);
  };
  // Recalibrar: muda a data do primeiro pagamento do contrato e reescreve as
  // parcelas em aberto; as pagas ficam como estão.
  const confirmarRecalibragem = () => {
    const f = formRecalibrar; if (!f) return;
    const alvo = (obraAtual.contratos || []).find(c => c.id === f.contratoId);
    if (!alvo) { setFormRecalibrar(null); return; }
    const porItem = contratoPorItem(alvo);
    if (!porItem && !f.novaData) { dialogo.alertar({ titulo: "Informe a nova data do primeiro pagamento", tipo: "aviso" }); return; }
    const recalibrado = porItem
      ? { ...recalibrarItens(alvo, f.itens || []), previsaoConclusao: f.previsaoConclusao || "" }
      : recalibrarContrato(alvo, f.novaData);
    const contratosNovos = (obraAtual.contratos || []).map(c => c.id === alvo.id ? recalibrado : c);
    const contasNovas = sincronizarContasDaObra(contasDaObra, contratosNovos);
    gravarObras(obras.map(o => o.id === obraAtual.id ? { ...o, contratos: contratosNovos, contasPagar: contasNovas } : o));
    setFormRecalibrar(null);
  };

  // ── Entradas da obra (aportes) — o outro lado do extrato ──────
  const entradasDaObra = (obraAtual && obraAtual.entradas) || [];
  const gravarEntradas = (novas, obraId) => {
    const alvo = obraId || (obraAtual && obraAtual.id);
    if (!alvo) return;
    gravarObras(obras.map(o => o.id === alvo ? { ...o, entradas: novas } : o));
  };
  // ── Aceite do cliente ────────────────────────────────────────
  // O cliente marca "de acordo" no contrato; fica gravado quem deu e quando,
  // e o escritório vê o selo na lista de contratos.
  const registrarAceite = async (contrato) => {
    const u = perm.usuario || {};
    const ok = await dialogo.confirmar({
      titulo: "Dar aceite neste contrato?",
      mensagem: "Fica registrado o seu nome e a data.",
      confirmar: "Dar aceite",
    });
    if (!ok) return;
    const alvo = obras.find(o => (o.contratos || []).some(c => c.id === contrato.id)) || obraAtual;
    if (!alvo || (alvo.aceites || []).some(a => a.contratoId === contrato.id)) return;
    const aceite = { contratoId: contrato.id, por: textoUtf8Recuperado(u.nome || u.email || "") || "Cliente", em: new Date().toISOString() };
    gravarObras(obras.map(o => o.id === alvo.id ? { ...o, aceites: [...(o.aceites || []), aceite] } : o));
  };
  const aceiteDoContrato = (contratoId) => {
    for (const o of obras) {
      const a = (o.aceites || []).find(x => x.contratoId === contratoId);
      if (a) return a;
    }
    return null;
  };

  const salvarEntrada = () => {
    const f = formEntrada; if (!f) return;
    const valor = numeroDeCampo(f.valor);
    if (!(valor > 0)) { dialogo.alertar({ titulo: "Informe um valor maior que zero", tipo: "aviso" }); return; }
    if (!f.data) { dialogo.alertar({ titulo: "Informe a data da entrada", tipo: "aviso" }); return; }
    const nova = { ...f, valor };
    const existe = entradasDaObra.some(e => e.id === nova.id);
    gravarEntradas(existe ? entradasDaObra.map(e => e.id === nova.id ? nova : e) : [...entradasDaObra, nova]);
    setFormEntrada(null);
  };

  const gravarContratos = (fatia) => save({
    ...data,
    obras: mesclarPorCliente(data.obras, cliente.id,
      contratosNasObras(obras, fatia, cliente.id, obraSelecionada && obraSelecionada.id)),
    // o que estava solto neste cliente já foi para dentro das obras
    contratos: (data.contratos || []).filter(c => c.clienteId !== cliente.id),
  });
  const statusObra = { planejamento: { label: "Planejamento", cor: "#f59e0b" }, execucao: { label: "Em execução", cor: "#3b82f6" }, concluida: { label: "Concluída", cor: "#10b981" } };
  const statusContrato = { ativo: { label: "Ativo", cor: "#10b981" }, pendente: { label: "Pendente", cor: "#f59e0b" }, encerrado: { label: "Encerrado", cor: "#9ca3af" } };

  // ── Planejamento (P&L estimado) ──────────────────────────────
  // Item: { id, contaId, prestadorId (opcional), valor (number), observacao }
  // Guardado em obra.estimativaPL — array simples, sem regime/mês (isso é
  // o P&L REALIZADO, spec separada). Aqui é só "quanto eu acho que vai custar".
  function novoItemPL() {
    setFormItemPL({ id: uid(), contaId: PLANO_CONTAS[0].id, prestadorId: "", valor: "", observacao: "" });
  }

  function editarItemPL(item) {
    setFormItemPL({ ...item, valor: String(item.valor) });
  }

  function salvarItemPL() {
    if (!formItemPL.contaId) { dialogo.alertar({ titulo: "Selecione a conta", tipo: "aviso" }); return; }
    const valorNum = parseFloat(String(formItemPL.valor).replace(",", "."));
    if (!valorNum || valorNum <= 0) { dialogo.alertar({ titulo: "Informe um valor maior que zero", tipo: "aviso" }); return; }
    const itemFinal = { ...formItemPL, valor: valorNum };
    const itensAtuais = obraAtual.estimativaPL || [];
    const ehNovo = !itensAtuais.find(i => i.id === itemFinal.id);
    const novosItens = ehNovo ? [...itensAtuais, itemFinal] : itensAtuais.map(i => i.id === itemFinal.id ? itemFinal : i);
    // parte do registro fresco da obra: obraSelecionada pode ter uma cópia
    // antiga de `contratos` e apagaria o que foi salvo desde então
    const obraAtualizada = { ...obraAtual, estimativaPL: novosItens };
    gravarObras(obras.map(o => o.id === obraAtualizada.id ? obraAtualizada : o));
    setObraSelecionada(obraAtualizada);
    setFormItemPL(null);
  }

  // O quadro grava direto, sem formulário: uma conta, um valor. Parte do
  // registro fresco da obra pelo mesmo motivo de salvarItemPL.
  function definirEstimativa(contaId, valor) {
    const novosItens = definirEstimativaDaConta(obraAtual.estimativaPL || [], contaId, valor, uid());
    const obraAtualizada = { ...obraAtual, estimativaPL: novosItens };
    gravarObras(obras.map(o => o.id === obraAtualizada.id ? obraAtualizada : o));
    setObraSelecionada(obraAtualizada);
  }

  async function removerItemPL(itemId) {
    const ok = await dialogo.confirmar({ titulo: "Remover item da estimativa?", mensagem: "Esta ação não pode ser desfeita.", confirmar: "Remover", destrutivo: true });
    if (!ok) return;
    const novosItens = (obraAtual.estimativaPL || []).filter(i => i.id !== itemId);
    const obraAtualizada = { ...obraAtual, estimativaPL: novosItens };
    gravarObras(obras.map(o => o.id === obraAtualizada.id ? obraAtualizada : o));
    setObraSelecionada(obraAtualizada);
  }

  // Carga única da estimativa da Reforma Loja Cobop — TEMPORÁRIO. Sai junto
  // com CARGA_ESTIMATIVA_UNICA quando o fluxo de dados que monta a
  // estimativa dentro da obra existir. As travas estão em
  // estimativaCargaUnica(): obra certa, uma vez só, e nunca por cima de
  // estimativa já digitada.
  const carregouEstimativa = useRef(false);
  useEffect(() => {
    if (carregouEstimativa.current) return;
    const alvo = obras.map(o => estimativaCargaUnica(o, CARGA_ESTIMATIVA_UNICA, () => uid())).find(Boolean);
    if (!alvo) return;
    carregouEstimativa.current = true;
    gravarObras(obras.map(o => (o.id === alvo.id ? alvo : o)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obras.length]);

  // Migração: o que sobrou em data.contratos entra na obra correspondente na
  // primeira renderização em que der — depois disso a obra é a fonte única.
  const migrouContratos = useRef(false);
  useEffect(() => {
    if (migrouContratos.current) return;
    const soltos = contratosLegado.filter(c => c.obraId && obras.some(o => o.id === c.obraId)
      && !obras.some(o => (o.contratos || []).some(x => x.id === c.id)));
    if (!soltos.length) return;
    migrouContratos.current = true;
    gravarContratos(contratos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contratosLegado.length, obras.length]);

  // "Gerar PDF" salva, abre o contrato e manda imprimir — só depois que a
  // tela do documento está montada, senão o navegador imprime a tela anterior.
  useEffect(() => {
    if (!imprimirAoAbrir || view !== "verContrato" || !contratoAberto) return;
    // O reset vai dentro do timeout: mexer no estado aqui fora dispararia a
    // limpeza do efeito e cancelaria a impressão antes de ela acontecer.
    const t = setTimeout(() => {
      setImprimirAoAbrir(false);
      try { window.print(); } catch (e) { /* sem impressora/ambiente */ }
    }, 350);
    return () => clearTimeout(t);
  }, [imprimirAoAbrir, view, contratoAberto]);

  function novaObra() {
    setFormObra({ id: uid(), clienteId: cliente.id, nome: "", status: "planejamento", dataInicio: "", dataFim: "", responsavel: "", descricao: "", ativo: true, clientePagaDireto: false,
      enderecoProprio: false, cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "" });
    setView("form");
  }

  function editarObra(obra) {
    setFormObra({ ...obra });
    setView("form");
  }

  async function buscarCepPrestador(cepBruto) {
    const clean = String(cepBruto || "").replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const d = await r.json();
      if (!d.erro) setNovoPrestador(f => f && ({ ...f, logradouro: d.logradouro || f.logradouro, bairro: d.bairro || f.bairro, cidade: d.localidade || f.cidade, estado: d.uf || f.estado }));
    } catch {}
  }

  // ViaCEP, igual ao cadastro do cliente — preenche o endereço próprio da obra.
  async function buscarCepObra(cepBruto) {
    const clean = String(cepBruto || "").replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const d = await r.json();
      if (!d.erro) setFormObra(f => ({ ...f, logradouro: d.logradouro || f.logradouro, bairro: d.bairro || f.bairro, cidade: d.localidade || f.cidade, estado: d.uf || f.estado }));
    } catch {}
  }

  function salvarObra() {
    if (!formObra.nome?.trim()) { dialogo.alertar({ titulo: "Informe o nome da obra", tipo: "aviso" }); return; }
    const ehNova = !obras.find(o => o.id === formObra.id);
    // ao editar a obra, preserva o que vive dentro dela e não está no formulário
    gravarObras(ehNova ? [...obras, formObra]
      : obras.map(o => o.id === formObra.id
          ? { ...formObra, contratos: o.contratos || [], estimativaPL: o.estimativaPL || [],
              // o formulário não conhece a marca da carga única; sem isto,
              // editar a obra a apagaria e a carga rodaria de novo
              estimativaCarregadaEm: o.estimativaCarregadaEm }
          : o));
    setView("lista");
  }

  async function deletarObra(obraId) {
    const ok = await dialogo.confirmar({ titulo: "Remover obra?", mensagem: "Esta ação não pode ser desfeita.", confirmar: "Remover", destrutivo: true });
    if (!ok) return;
    gravarObras(obras.filter(o => o.id !== obraId));
  }

  if (view === "formContrato" && formContrato && obraSelecionada) {
    return (
      <div data-vk-ui="1" style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
        <button onClick={() => setView("contratosDaObra")} style={{ ...C.btnGhost, marginBottom: 16, fontSize: 12 }}>← Voltar</button>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div><label style={C.label}>Contratado *</label><input style={C.input} value={formContrato.nomeContratado} onChange={e => setFormContrato({ ...formContrato, nomeContratado: e.target.value })} placeholder="Nome da empresa/pessoa" /></div>
          <div><label style={C.label}>Status</label><select style={{ ...C.input, cursor: "pointer" }} value={formContrato.status} onChange={e => setFormContrato({ ...formContrato, status: e.target.value })}>{Object.entries(statusContrato).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          <div><label style={C.label}>Valor (R$)</label><CampoCtrNum tipo="moeda" valor={formContrato.valor} onChange={v => setFormContrato({ ...formContrato, valor: v })} style={C.input} placeholder="0,00" /></div>
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
            gravarContratos(ehNovo ? [...contratos, formContrato] : contratos.map(c => c.id === formContrato.id ? formContrato : c));
            setView("contratosDaObra");
          }}>Salvar contrato</button>
        </div>
      </div>
    );
  }

  if (view === "form" && formObra) {
    return (
      <div data-vk-ui="1" style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
        <button onClick={() => setView("lista")} style={{ ...C.btnGhost, marginBottom: 16, fontSize: 12 }}>← Voltar</button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Gestão de Obra</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div><label style={C.label}>Nome da obra *</label><input style={C.input} value={formObra.nome} onChange={e => setFormObra({ ...formObra, nome: e.target.value })} /></div>
          <div><label style={C.label}>Status</label><select style={{ ...C.input, cursor: "pointer" }} value={formObra.status} onChange={e => setFormObra({ ...formObra, status: e.target.value })}>{Object.entries(statusObra).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          <div><label style={C.label}>Data de início</label><input style={C.input} type="date" value={formObra.dataInicio} onChange={e => setFormObra({ ...formObra, dataInicio: e.target.value })} /></div>
          <div><label style={C.label}>Data de conclusão</label><input style={C.input} type="date" value={formObra.dataFim} onChange={e => setFormObra({ ...formObra, dataFim: e.target.value })} /></div>
          <div style={isMobile ? { gridColumn: "1 / -1" } : {}}><label style={C.label}>Responsável</label><input style={C.input} value={formObra.responsavel} onChange={e => setFormObra({ ...formObra, responsavel: e.target.value })} placeholder="Nome do responsável" /></div>
        </div>
        <div style={{ marginBottom: 12 }}><label style={C.label}>Descrição</label><textarea style={{ ...C.input, resize: "vertical" }} value={formObra.descricao} onChange={e => setFormObra({ ...formObra, descricao: e.target.value })} rows={3} /></div>

        {/* Quem paga os fornecedores. Com o cliente pagando direto, o
            escritório não movimenta dinheiro da obra: não há entrada para
            lançar, e o P&L fecha no custo em vez de num saldo negativo. */}
        <div style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
            <input type="checkbox" style={{ marginTop: 2, cursor: "pointer" }}
              checked={!!formObra.clientePagaDireto}
              onChange={e => setFormObra({ ...formObra, clientePagaDireto: e.target.checked })} />
            <span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#111827" }}>O cliente realiza os pagamentos</span>
              <span style={{ display: "block", fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>
                Os fornecedores são pagos direto pelo cliente e o dinheiro não passa pelo escritório.
                No P&L a obra fecha no custo total, em vez de num saldo negativo que não teve receita para comparar.
              </span>
            </span>
          </label>
        </div>

        {/* Endereço da obra — é o que vai para os contratos. Por padrão a obra
            fica no endereço do cliente; "Endereço diferente" abre os campos. */}
        <div style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 8 }}>Endereço da obra</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: formObra.enderecoProprio ? 12 : 0 }}>
            {[{ v: false, label: "Endereço do cliente" }, { v: true, label: "Endereço diferente" }].map(op => (
              <label key={String(op.v)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#111827", cursor: "pointer" }}>
                <input type="radio" name="enderecoObra" checked={!!formObra.enderecoProprio === op.v} onChange={() => setFormObra({ ...formObra, enderecoProprio: op.v })} style={{ cursor: "pointer" }} />
                {op.label}
              </label>
            ))}
          </div>
          {!formObra.enderecoProprio ? (
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 8 }}>
              {[cliente.logradouro, cliente.numero && `nº ${cliente.numero}`, cliente.bairro, [cliente.cidade, cliente.estado].filter(Boolean).join("/"), cliente.cep && `CEP ${cliente.cep}`].filter(Boolean).join(", ")
                || "O cadastro do cliente ainda não tem endereço — preencha lá ou marque \"Endereço diferente\"."}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr 1fr", gap: 12 }}>
              <div><label style={C.label}>CEP</label><input style={C.input} value={formObra.cep || ""} onChange={e => { setFormObra({ ...formObra, cep: e.target.value }); buscarCepObra(e.target.value); }} placeholder="00000-000" /></div>
              <div><label style={C.label}>Logradouro</label><input style={C.input} value={formObra.logradouro || ""} onChange={e => setFormObra({ ...formObra, logradouro: e.target.value })} /></div>
              <div><label style={C.label}>Número</label><input style={C.input} value={formObra.numero || ""} onChange={e => setFormObra({ ...formObra, numero: e.target.value })} /></div>
              <div><label style={C.label}>Complemento</label><input style={C.input} value={formObra.complemento || ""} onChange={e => setFormObra({ ...formObra, complemento: e.target.value })} placeholder="quadra, lote, bloco" /></div>
              <div><label style={C.label}>Bairro</label><input style={C.input} value={formObra.bairro || ""} onChange={e => setFormObra({ ...formObra, bairro: e.target.value })} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                <div><label style={C.label}>Cidade</label><input style={C.input} value={formObra.cidade || ""} onChange={e => setFormObra({ ...formObra, cidade: e.target.value })} /></div>
                <div><label style={C.label}>UF</label><input style={C.input} value={formObra.estado || ""} onChange={e => setFormObra({ ...formObra, estado: e.target.value.toUpperCase().slice(0, 2) })} maxLength={2} /></div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button style={C.btnSec} onClick={() => setView("lista")}>Cancelar</button>
          <button style={C.btn} onClick={salvarObra}>Salvar obra</button>
        </div>
      </div>
    );
  }

  if (view === "planejamento" && obraSelecionada) {
    const itensPL = obraAtual.estimativaPL || [];
    // Somar TODOS os itens misturava entrada com custo: uma obra de 900 mil
    // de entrada e 700 mil de custo mostrava "estimado 1,6 milhão". O topo
    // agora separa os dois lados, como o P&L faz.
    const totaisPL = totaisEstimativaPL(itensPL, GRUPOS_PL, PLANO_CONTAS);
    const entradasPL = totaisPL.porGrupo.receitas || 0;
    const totalPL = GRUPOS_PL
      .filter(g => g.sinal < 0 && g.entra_no_resultado !== false)
      .reduce((soma, g) => soma + (totaisPL.porGrupo[g.id] || 0), 0);
    const fmtBRL = v => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // ── Formulário de item (novo/editar) ──────────────────────
    if (formItemPL) {
      return (
        <div data-vk-ui="1" style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
          <button onClick={() => setFormItemPL(null)} style={{ ...C.btnGhost, marginBottom: 16, fontSize: 12 }}>← Voltar</button>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 16 }}>{itensPL.find(i => i.id === formItemPL.id) ? "Editar item" : "Novo item da estimativa"}</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={C.label}>Conta *</label>
              <select style={{ ...C.input, cursor: "pointer" }} value={formItemPL.contaId} onChange={e => setFormItemPL({ ...formItemPL, contaId: e.target.value })}>
                {GRUPOS_PL.filter(g => g.id !== "excluidas").map(g => (
                  <optgroup key={g.id} label={g.titulo}>
                    {contasDoGrupo(g.id).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label style={C.label}>Prestador de serviço (opcional)</label>
              <select style={{ ...C.input, cursor: "pointer" }} value={formItemPL.prestadorId || ""} onChange={e => setFormItemPL({ ...formItemPL, prestadorId: e.target.value })}>
                <option value="">— Nenhum —</option>
                {prestadores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={C.label}>Valor estimado (R$) *</label>
              <input style={C.input} type="number" step="0.01" value={formItemPL.valor} onChange={e => setFormItemPL({ ...formItemPL, valor: e.target.value })} placeholder="0,00" />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={C.label}>Observações</label>
            <textarea style={{ ...C.input, resize: "vertical" }} value={formItemPL.observacao || ""} onChange={e => setFormItemPL({ ...formItemPL, observacao: e.target.value })} rows={2} />
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button style={C.btnSec} onClick={() => setFormItemPL(null)}>Cancelar</button>
            <button style={C.btn} onClick={salvarItemPL}>Salvar item</button>
          </div>
        </div>
      );
    }

    // ── Agrupamento "por conta" ────────────────────────────────
    const gruposComItens = GRUPOS_PL.map(g => {
      const contasComItens = contasDoGrupo(g.id).map(conta => {
        const itensDaConta = itensPL.filter(i => i.contaId === conta.id);
        const totalConta = itensDaConta.reduce((s, i) => s + (Number(i.valor) || 0), 0);
        return { conta, itens: itensDaConta, total: totalConta };
      }).filter(c => c.itens.length > 0);
      const totalGrupo = contasComItens.reduce((s, c) => s + c.total, 0);
      return { grupo: g, contas: contasComItens, total: totalGrupo };
    }).filter(g => g.contas.length > 0);

    // A aba de prestadores agrupava por `prestadorId` do cadastro, e como o
    // quadro não pede prestador quase tudo caía em "Sem prestador definido".
    // Agora ela é a grade de anéis por ofício (PrestadoresPLView), que é onde
    // o dado realmente está — o agrupamento antigo saiu junto.

    // Realizado: o que já foi pago nas Contas a pagar, pela mesma conta do
    // plano de contas — é o outro lado da estimativa.
    const realConta = realizadoPorConta(contasDaObra);
    const totalRealizado = Object.values(realConta).reduce((a, v) => a + v, 0);
    const comparativo = (estimado, realizado) => {
      if (!realizado) return null;
      const dif = realizado - estimado;
      const cor = dif > 0.005 ? "#dc2626" : "#4b5563";
      const sinal = dif > 0 ? "+" : "−";
      return <span style={{ fontSize: 11, color: cor, marginLeft: 8 }}>pago {fmtBRL(realizado)}{estimado > 0 ? ` (${sinal}${fmtBRL(Math.abs(dif))})` : ""}</span>;
    };

    return (
      <div data-vk-ui="1" style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
        <button onClick={() => setView("detalheObra")} style={{ ...C.btnGhost, marginBottom: 16, fontSize: 12 }}>← Voltar</button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Planejamento</div>
            <div style={{ fontSize: 12, color: "#4b5563" }}>{visaoPL === "pl" ? "Estimado e realizado" : "P&L estimado"} · {obraSelecionada.nome}</div>
          </div>
          {/* Na aba P&L o cartão do anel já traz estimado e gasto; repetir os
              mesmos números no topo é ruído. */}
          <div style={{ display: visaoPL === "pl" ? "none" : "flex", gap: 20, textAlign: "right" }}>
            {entradasPL > 0 && (
              <div>
                <div style={{ fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5 }}>Entradas estimadas</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{fmtBRL(entradasPL)}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5 }}>Custo estimado</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{fmtBRL(totalPL)}</div>
            </div>
            {totalRealizado > 0 && (
              <div>
                <div style={{ fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5 }}>Já pago</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{fmtBRL(totalRealizado)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Toggle de visão */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[["pl", "P&L"], ["quadro", "Preencher"], ["conta", "Por conta"], ["prestador", "Por prestador"], ["extrato", "Extrato mensal"]].map(([v, l]) => (
            <button key={v} onClick={() => setVisaoPL(v)}
              style={{ border: visaoPL === v ? `1.5px solid ${AZUL_VK}` : "1px solid rgba(38,36,33,0.16)", background: "#fff", color: visaoPL === v ? "#111827" : "#4b5563", borderRadius: 20, padding: "6px 16px", fontSize: 12.5, fontWeight: visaoPL === v ? 700 : 500, cursor: "pointer", fontFamily: "inherit" }}>
              {l}
            </button>
          ))}
        </div>

        {visaoPL === "pl" ? (
          <PLDaObraView itens={itensPL} contasPagar={contasDaObra} clientePaga={!!obraAtual.clientePagaDireto}
            isMobile={isMobile} fmtBRL={fmtBRL} />
        ) : visaoPL === "quadro" ? (
          <QuadroEstimativaPL itens={itensPL} podeEditar={perm.podeGerenciarObra} isMobile={isMobile}
            fmtBRL={fmtBRL} aoDefinir={definirEstimativa} clientePaga={!!obraAtual.clientePagaDireto} />
        ) : visaoPL === "extrato" ? (() => {
          // no menu, o mês corrente também aparece (para registrar entrada nele);
          // nas colunas, só os meses que têm movimento
          const meses = mesesDoExtrato(contasDaObra, entradasDaObra, hojeIso);
          const comMovimento = mesesDoExtrato(contasDaObra, entradasDaObra, "");
          const rotulo = (chave) => {
            const [a, m] = String(chave).split("-");
            return `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(m) - 1]}-${a.slice(2)}`;
          };
          const anos = [...new Set(meses.map(m => m.slice(0, 4)))].sort();
          // O menu decide quais MESES viram coluna. Entrando, só o total e a
          // estimativa; daí se abre o ano, ou um mês só.
          const escolha = mesExtrato || "total";
          const colunas = escolha === "total" ? []
            : escolha === "todos" ? comMovimento
            : /^\d{4}$/.test(escolha) ? comMovimento.filter(m => m.startsWith(escolha))
            : meses.includes(escolha) ? [escolha] : [];
          const estimativa = estimativaPorConta(itensPL);
          const ex = extratoMatriz(contasDaObra, entradasDaObra, colunas, estimativa);
          const temEstimativa = Object.keys(estimativa).length > 0;
          const grade = `minmax(190px, 1fr) ${colunas.map(() => "110px").join(" ")} 120px${temEstimativa ? " 120px" : ""}`;
          // largura mínima do quadro: sem isso as colunas se espremem e a
          // última fica cortada em vez de rolar
          const larguraMin = 210 + colunas.length * 118 + 128 + (temEstimativa ? 128 : 0);
          const num = (v) => (Math.abs(v) < 0.005 ? "–" : fmtBRL(v));
          const celula = { fontSize: 12, color: "#111827", textAlign: "right" };
          return (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
                <span style={{ fontSize: 11.5, color: "#6b7280" }}>Ver</span>
                <select style={{ ...C.input, cursor: "pointer", width: 220 }} value={escolha} onChange={e => setMesExtrato(e.target.value)}>
                  <option value="total">Só o total da obra</option>
                  <option value="todos">Todos os meses</option>
                  {anos.map(a => <option key={a} value={a}>Meses de {a}</option>)}
                  {meses.map(m => <option key={m} value={m}>{rotuloMes(m)}</option>)}
                </select>
                {perm.podeEditar && (
                  <button type="button" style={C.btnSec}
                    onClick={() => setFormEntrada({ ...entradaObraVazia(obraAtual.id), data: `${(colunas[colunas.length - 1] || meses[meses.length - 1] || hojeIso.slice(0, 7))}-01` })}>＋ Registrar entrada</button>
                )}
              </div>

              {formEntrada && (
                <div style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 12, padding: 12, marginBottom: 14, background: "#fafafa" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 10 }}>{entradasDaObra.some(e => e.id === formEntrada.id) ? "Editar entrada" : "Nova entrada"}</div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={C.label}>Conta</label>
                      <select style={{ ...C.input, cursor: "pointer" }} value={formEntrada.contaId} onChange={e => setFormEntrada({ ...formEntrada, contaId: e.target.value })}>
                        {contasDoGrupo("receitas").map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </div>
                    <div><label style={C.label}>Descrição</label><input style={C.input} value={formEntrada.descricao} onChange={e => setFormEntrada({ ...formEntrada, descricao: e.target.value })} placeholder="opcional" /></div>
                    <div><label style={C.label}>Valor (R$)</label><CampoCtrNum tipo="moeda" valor={formEntrada.valor} onChange={v => setFormEntrada({ ...formEntrada, valor: v })} style={C.input} placeholder="0,00" /></div>
                    <div><label style={C.label}>Data</label><input style={C.input} type="date" value={formEntrada.data} onChange={e => setFormEntrada({ ...formEntrada, data: e.target.value })} /></div>
                  </div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
                    <button type="button" style={C.btnSec} onClick={() => setFormEntrada(null)}>Cancelar</button>
                    <button type="button" style={C.btn} onClick={salvarEntrada}>Salvar entrada</button>
                  </div>
                </div>
              )}

              <div style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 12, overflowX: "auto" }}>
                <div style={{ minWidth: larguraMin }}>
                  <div style={{ background: "#111827", color: "#fff", padding: "9px 12px", fontSize: 12.5, fontWeight: 700, textAlign: "center", letterSpacing: 0.3 }}>
                    EXTRATO OBRA — {obraSelecionada.nome}
                  </div>
                  {/* cabeçalho das colunas */}
                  <div style={{ display: "grid", gridTemplateColumns: grade, gap: 8, padding: "7px 12px", background: "#f3f4f6", borderTop: "1px solid rgba(38,36,33,0.10)" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.4 }}>Conta</span>
                    {colunas.map(m => <span key={m} style={{ ...celula, fontSize: 11.5, fontWeight: 700, color: "#4b5563" }}>{rotulo(m)}</span>)}
                    <span style={{ ...celula, fontSize: 11.5, fontWeight: 700, color: "#111827" }}>Contabilizado</span>
                    {temEstimativa && <span style={{ ...celula, fontSize: 11.5, fontWeight: 700, color: "#4b5563" }}>Estimado</span>}
                  </div>
                  {ex.grupos.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", color: "#4b5563", fontSize: 12.5 }}>
                      Nada contabilizado ainda. As contas pagas entram aqui pelo mês da data de contabilização.
                    </div>
                  ) : ex.grupos.map(g => (
                    <div key={g.grupo.id}>
                      <div style={{ display: "grid", gridTemplateColumns: grade, gap: 8, padding: "7px 12px", background: "#fafafa", borderTop: "1px solid rgba(38,36,33,0.10)" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{g.grupo.titulo}</span>
                        {g.valores.map((v, i) => <span key={i} style={{ ...celula, fontWeight: 700 }}>{num(v)}</span>)}
                        <span style={{ ...celula, fontWeight: 700 }}>{num(g.total)}</span>
                        {temEstimativa && <span style={{ ...celula, fontWeight: 700, color: "#4b5563" }}>{num(g.estimado)}</span>}
                      </div>
                      {g.linhas.map(l => (
                        <div key={l.conta.id} style={{ display: "grid", gridTemplateColumns: grade, gap: 8, padding: "6px 12px", borderTop: "1px solid rgba(38,36,33,0.06)" }}>
                          <span style={{ fontSize: 12.5, color: "#4b5563" }}>{l.conta.nome}</span>
                          {l.valores.map((v, i) => <span key={i} style={celula}>{num(v)}</span>)}
                          <span style={celula}>{num(l.total)}</span>
                          {temEstimativa && <span style={{ ...celula, color: "#6b7280" }}>{num(l.estimado)}</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                  {(() => {
                    const fim = linhaFinalExtrato(ex, !!obraAtual.clientePagaDireto);
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: grade, gap: 8, padding: "9px 12px", borderTop: "1.5px solid rgba(38,36,33,0.14)", background: "#fafafa" }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>{fim.rotulo}</span>
                        {fim.valores.map((v, i) => <span key={i} style={{ ...celula, fontWeight: 700 }}>{num(v)}</span>)}
                        <span style={{ ...celula, fontWeight: 700 }}>{num(fim.total)}</span>
                        {temEstimativa && <span style={{ ...celula, fontWeight: 700, color: "#4b5563" }}>{num(fim.estimado)}</span>}
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 6 }}>
                {obraAtual.clientePagaDireto
                  ? "O cliente paga os fornecedores direto, então a obra fecha no custo, não num saldo."
                  : "Entradas menos custos, pelo mês da data de contabilização."} "Contabilizado" é o acumulado da obra inteira{temEstimativa ? "; “Estimado” vem dos itens do Planejamento" : ""}.
              </div>

              {entradasDaObra.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11.5, color: "#6b7280", marginBottom: 6 }}>Entradas registradas</div>
                  {[...entradasDaObra].sort((a, b) => String(a.data).localeCompare(String(b.data))).map(e => (
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: 8 }}>
                      <span style={{ fontSize: 12, color: "#4b5563" }}>
                        {e.data ? new Date(e.data + "T12:00:00").toLocaleDateString("pt-BR") : "sem data"} · {(contaPorId(e.contaId) || {}).nome || "Entrada"}{e.descricao ? ` · ${e.descricao}` : ""}
                      </span>
                      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "#111827" }}>{fmtBRL(Number(e.valor) || 0)}</span>
                        {perm.podeEditar && <button onClick={() => setFormEntrada({ ...e, valor: Number(e.valor) || 0 })} style={{ ...C.btnGhost, fontSize: 11 }}>Editar</button>}
                        {perm.podeEditar && <button onClick={() => gravarEntradas(entradasDaObra.filter(x => x.id !== e.id))} style={{ ...C.btnGhost, color: "#dc2626", fontSize: 11 }}>Remover</button>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })() : itensPL.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "#4b5563", fontSize: 12.5, border: "1px dashed rgba(38,36,33,0.18)", borderRadius: 9, background: "#fafafa", marginBottom: 16 }}>
            Nenhum item na estimativa ainda. {perm.podeGerenciarObra && <button onClick={novoItemPL} style={{ background: "transparent", border: "none", color: AZUL_VK, cursor: "pointer", padding: 0, fontSize: 12.5, fontFamily: "inherit", textDecoration: "underline" }}>Adicionar o primeiro</button>}
          </div>
        ) : visaoPL === "conta" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
            {gruposComItens.map(({ grupo, contas: contasG, total }) => (
              <div key={grupo.id}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1.5px solid rgba(38,36,33,0.14)", marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#111827", textTransform: "uppercase", letterSpacing: 0.5 }}>{grupo.titulo}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{fmtBRL(total)}</div>
                </div>
                {contasG.map(({ conta, itens: itensDaConta, total: totalConta }) => (
                  <div key={conta.id} style={{ marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                      <div style={{ fontSize: 13, color: "#111827" }}>{conta.nome}{comparativo(totalConta, realConta[conta.id] || 0)}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{fmtBRL(totalConta)}</div>
                    </div>
                    {itensDaConta.map(item => (
                      <div key={item.id} onClick={() => perm.podeGerenciarObra && editarItemPL(item)}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", marginLeft: 8, borderRadius: 8, cursor: perm.podeGerenciarObra ? "pointer" : "default", transition: "background 0.15s" }}
                        onMouseEnter={e => { if (perm.podeGerenciarObra) e.currentTarget.style.backgroundColor = "#fafafa"; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                        <div style={{ fontSize: 12, color: "#4b5563" }}>
                          {item.prestadorId ? (prestadores.find(p => p.id === item.prestadorId)?.nome || "Prestador removido") : "—"}
                          {item.observacao ? ` · ${item.observacao}` : ""}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <div style={{ fontSize: 12, color: "#4b5563" }}>{fmtBRL(Number(item.valor) || 0)}</div>
                          {perm.podeGerenciarObra && (
                            <button onClick={e => { e.stopPropagation(); removerItemPL(item.id); }} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>Remover</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <PrestadoresPLView itens={itensPL} contasPagar={contasDaObra} isMobile={isMobile} fmtBRL={fmtBRL} />
        )}

        {perm.podeGerenciarObra && itensPL.length > 0 && visaoPL === "conta" && (
          <button style={{ ...C.btn, width: "100%" }} onClick={novoItemPL}>+ Adicionar item</button>
        )}
      </div>
    );
  }

  // ── Documento pronto: leitura e impressão ────────────────────
  if (view === "verContrato" && contratoAberto) {
    const prest = (contratoAberto.prestadorId === ID_PRESTADOR_ESCRITORIO
      ? prestadorDoEscritorio(data.escritorio)
      : prestadores.find(p => p.id === contratoAberto.prestadorId)) || null;
    const obraDoContrato = obras.find(o => o.id === contratoAberto.obraId) || obraSelecionada;
    return (
      <div data-vk-ui="1" style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
        <div data-vk-noprint="1" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <button onClick={() => { setContratoAberto(null); setView("contratosDaObra"); }} style={{ ...C.btnGhost, fontSize: 12 }}>← Voltar</button>
          <div style={{ flex: 1 }} />
          {perm.podeGerenciarObra && (
            <button style={C.btnSec} onClick={() => { setContratoSalvoEm(0); setContratoGerando(contratoAberto); setContratoAberto(null); setView("gerarContrato"); }}>Editar dados</button>
          )}
          {(() => {
            const ac = aceiteDoContrato(contratoAberto.id);
            if (ac) return (
              <span style={{ fontSize: 12, color: "#111827", border: `1.5px solid ${AZUL_VK}`, borderRadius: 20, padding: "6px 12px" }}>
                Aceite de {textoUtf8Recuperado(ac.por)} em {new Date(ac.em).toLocaleDateString("pt-BR")}
              </span>
            );
            return perm.isCliente ? (
              <button style={C.btnSec} onClick={() => registrarAceite(contratoAberto)}>Dar aceite</button>
            ) : null;
          })()}
          <button style={C.btn} onClick={() => window.print()}>Gerar PDF</button>
        </div>
        <ContratoDocumento contrato={contratoAberto} cliente={cliente} obra={obraDoContrato} prestador={prest} />
      </div>
    );
  }

  // ── Gerador ──────────────────────────────────────────────────
  if (view === "gerarContrato" && contratoGerando && obraSelecionada) {
    const g = contratoGerando;
    const modelo = contratoModelo(g.modelo);
    const doEscritorio = prestadorDoEscritorio(data.escritorio);
    const prest = (g.prestadorId === ID_PRESTADOR_ESCRITORIO ? doEscritorio : prestadores.find(p => p.id === g.prestadorId)) || null;
    const tipoP = tipoProfissional(g.tipoProfissional);
    const prestadoresDisponiveis = prestadoresDoTipo(prestadores, g.tipoProfissional, data.escritorio);
    const faltaEscritorio = prest && prest.escritorio ? faltaNoEscritorio(data.escritorio) : [];
    const total = valorContrato(g);
    const modo = modalidadeContrato(g);
    const pz = prazoContrato(g);
    const escopo = escopoContrato(g);
    const gerenciamento = g.modelo === "gerenciamentoObra";
    // saldo pago item a item: muda o bloco de valor (coluna de previsão) e as
    // datas estimadas que vão para contas a pagar
    const porItem = modalidadeContrato(g) === "entradaFinal" && (g.entradaEscopo || "contrato") === "item";
    // O objeto só é reescrito automaticamente enquanto estiver no texto padrão.
    const objetoEditado = String(g.objeto || "").trim() !== objetoPadrao(g.tipoProfissional, escopo);
    const setG = (campo, valor) => setContratoGerando({ ...g, [campo]: valor });
    const setLista = (campo, idx, chave, valor) => setContratoGerando({ ...g, [campo]: (g[campo] || []).map((x, i) => i === idx ? { ...x, [chave]: valor } : x) });
    const addLinha = (campo, vazio) => setContratoGerando({ ...g, [campo]: [...(g[campo] || []), vazio] });
    const delLinha = (campo, idx) => setContratoGerando({ ...g, [campo]: (g[campo] || []).filter((_, i) => i !== idx) });
    const setOpcao = (id, ligada) => setContratoGerando({ ...g, opcoes: { ...(g.opcoes || opcoesPadrao(g.modelo)), [id]: ligada } });
    const ligada = (id) => opcaoAtiva(g, id);
    // Salvar grava e continua na tela; o contrato fica registrado na obra e
    // pode ser reaberto depois. Devolve o contrato salvo, ou null se faltou dado.
    const salvar = () => {
      if (!g.tipoProfissional) { dialogo.alertar({ titulo: "Escolha o tipo de profissional", mensagem: "O contrato começa pelo tipo de profissional — é ele que define o regime e o objeto.", tipo: "aviso" }); return null; }
      if (!g.prestadorId && !g.nomeContratado?.trim()) { dialogo.alertar({ titulo: "Escolha o prestador", mensagem: "Selecione um prestador cadastrado, cadastre um novo ou digite o nome do contratado.", tipo: "aviso" }); return null; }
      const novo = { ...g, nomeContratado: prest ? prest.nome : g.nomeContratado, valor: total,
        // número sequencial atribuído na primeira gravação e mantido depois
        numeroContrato: g.numeroContrato || proximoNumeroContrato(data.obras || []),
        geradoEm: g.geradoEm || new Date().toISOString(), atualizadoEm: new Date().toISOString() };
      const existe = contratos.some(c => c.id === novo.id);
      const listaContratos = existe ? contratos.map(c => c.id === novo.id ? novo : c) : [...contratos, novo];
      // salvar o contrato alimenta as contas a pagar da obra na mesma gravação
      const contasAtualizadas = sincronizarContasDoContrato(contasDaObra, { ...novo, obraId: obraSelecionada.id });
      save({
        ...data,
        obras: mesclarPorCliente(data.obras, cliente.id,
          contratosNasObras(obras, listaContratos, cliente.id, obraSelecionada.id)
            .map(o => o.id === obraSelecionada.id ? { ...o, contasPagar: contasAtualizadas } : o)),
        contratos: (data.contratos || []).filter(c => c.clienteId !== cliente.id),
      });
      setContratoGerando(novo);
      setContratoSalvoEm(Date.now());
      setTimeout(() => setContratoSalvoEm(0), 4000);
      return novo;
    };
    const gerarPDF = () => {
      const novo = salvar();
      if (!novo) return;
      setContratoAberto(novo); setImprimirAoAbrir(true); setView("verContrato");
    };
    const jaSalvo = contratos.some(c => c.id === g.id);
    // Cadastro rápido de prestador, sem sair do gerador — os campos são os
    // que o preâmbulo do contrato usa.
    const salvarNovoPrestador = () => {
      const np = novoPrestador;
      if (!np.nome?.trim()) { dialogo.alertar({ titulo: "Informe o nome do prestador", tipo: "aviso" }); return; }
      const registro = { ...np, id: uid(), ativo: true, criadoEm: new Date().toISOString() };
      save({ ...data, fornecedores: [...prestadores, registro] });
      setContratoGerando({ ...g, prestadorId: registro.id, nomeContratado: registro.nome });
      setNovoPrestador(null);
    };
    const bloco = { border: "1px solid rgba(38,36,33,0.14)", borderRadius: 12, padding: 12, marginBottom: 12 };
    const tituloBloco = { fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 8 };
    const grade = (cols) => ({ display: "grid", gridTemplateColumns: isMobile ? "1fr" : cols, gap: 12 });

    return (
      <div data-vk-ui="1" style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
        <button onClick={() => { setContratoGerando(null); setNovoPrestador(null); setView("contratosDaObra"); }} style={{ ...C.btnGhost, marginBottom: 16, fontSize: 12 }}>← Voltar</button>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 2 }}>Gerar contrato</div>
        <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 16 }}>{obraSelecionada.nome} · contratante: {cliente.nome}</div>

        {/* 1 — quem é o profissional. O formulário abaixo é o mesmo para todos. */}
        <div style={{ marginBottom: 12 }}>
          <label style={C.label}>1. Tipo de profissional</label>
          <select style={{ ...C.input, cursor: "pointer" }} value={g.tipoProfissional || ""} onChange={e => {
            const t = tipoProfissional(e.target.value);
            if (!t) { setG("tipoProfissional", ""); return; }
            // Trocar o tipo reescreve o objeto padrão e o regime, mas preserva
            // o que já foi digitado à mão.
            const novoEscopo = escopoContrato(g) && tipoProfissional(g.tipoProfissional) ? escopoContrato(g) : escopoDoTipo(t.id);
            const base = contratoVazio(null, cliente.id, obraSelecionada.id, t.id, novoEscopo);
            const compat = prestadoresDoTipo(prestadores, t.id, data.escritorio).some(p => p.id === g.prestadorId);
            setContratoGerando({ ...base, id: g.id, objeto: objetoEditado ? g.objeto : base.objeto,
              enderecoObra: g.enderecoObra, status: g.status,
              itens: g.itens, escopo: g.escopo, valor: g.valor, exclusoes: g.exclusoes,
              prazoQtd: g.prazoQtd, prazoUnidade: g.prazoUnidade, dataInicio: g.dataInicio, dataAssinatura: g.dataAssinatura,
              prestadorId: compat ? g.prestadorId : "", nomeContratado: compat ? g.nomeContratado : "" });
          }}>
            <option value="">— escolher o tipo de profissional —</option>
            {TIPOS_PROFISSIONAL.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
          <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 5 }}>São os mesmos prestadores de serviço do catálogo de insumos. O tipo já sugere o regime do contrato e o objeto.</div>
        </div>

        <div style={{ ...grade("1fr 1fr"), marginBottom: 12 }}>
          <div>
            <label style={C.label}>2. Prestador (contratado)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <select style={{ ...C.input, cursor: "pointer", flex: 1 }} value={g.prestadorId} disabled={!tipoP} onChange={e => setG("prestadorId", e.target.value)}>
                <option value="">{!tipoP ? "— escolha o tipo primeiro —" : prestadoresDisponiveis.length ? "— escolher um prestador cadastrado —" : `— nenhum ${tipoP.nome.toLowerCase()} cadastrado —`}</option>
                {prestadoresDisponiveis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <button type="button" disabled={!tipoP} style={{ ...C.btnSec, whiteSpace: "nowrap", opacity: tipoP ? 1 : 0.5 }}
                onClick={() => setNovoPrestador({ nome: "", tipo: "PJ", categoria: (tipoP && tipoP.categorias[0]) || "Outro", cnpjCpf: "", cep: "", logradouro: "", numero: "", bairro: "", cidade: "", estado: "SP", representanteNome: "", representanteCpf: "", telefone: "", email: "" })}>
                ＋ Novo
              </button>
            </div>
            {tipoP && tipoP.categorias.length > 0 && prestadoresDisponiveis.length === 0 && (
              <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 5 }}>Nenhum prestador cadastrado como {tipoP.categorias[0]}. Use ＋ Novo para cadastrar.</div>
            )}
          </div>
          <div style={{ display: gerenciamento ? "none" : undefined }}>
            <label style={C.label}>3. O que o contrato inclui</label>
            <select style={{ ...C.input, cursor: "pointer" }} value={escopo} onChange={e => {
              const base = contratoVazio(null, cliente.id, obraSelecionada.id, g.tipoProfissional, e.target.value);
              setContratoGerando({ ...base, id: g.id, prestadorId: g.prestadorId, nomeContratado: g.nomeContratado,
                objeto: objetoEditado ? g.objeto : base.objeto,
                enderecoObra: g.enderecoObra, status: g.status, itens: g.itens, escopo: g.escopo,
                valor: g.valor, exclusoes: g.exclusoes, prazoQtd: g.prazoQtd, prazoUnidade: g.prazoUnidade,
                dataInicio: g.dataInicio, dataAssinatura: g.dataAssinatura });
            }}>
              {ESCOPOS_FORNECIMENTO.map(e2 => <option key={e2.id} value={e2.id}>{e2.nome}</option>)}
            </select>
            <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 5 }}>{modelo.resumo}</div>
          </div>
        </div>

        {novoPrestador && (
          <div style={{ ...bloco, background: "#fafafa" }}>
            <div style={tituloBloco}>Novo prestador de serviço</div>
            <div style={{ ...grade("2fr 1fr 1.2fr"), marginBottom: 12 }}>
              <div><label style={C.label}>Nome / razão social *</label><input style={C.input} value={novoPrestador.nome} onChange={e => setNovoPrestador({ ...novoPrestador, nome: e.target.value })} /></div>
              <div>
                <label style={C.label}>Pessoa</label>
                <select style={{ ...C.input, cursor: "pointer" }} value={novoPrestador.tipo} onChange={e => setNovoPrestador({ ...novoPrestador, tipo: e.target.value })}>
                  <option value="PJ">Jurídica</option><option value="PF">Física</option>
                </select>
              </div>
              <div><label style={C.label}>{novoPrestador.tipo === "PF" ? "CPF" : "CNPJ"}</label><input style={C.input} value={novoPrestador.cnpjCpf} onChange={e => setNovoPrestador({ ...novoPrestador, cnpjCpf: e.target.value })} /></div>
              <div>
                <label style={C.label}>Categoria</label>
                <select style={{ ...C.input, cursor: "pointer" }} value={novoPrestador.categoria} onChange={e => setNovoPrestador({ ...novoPrestador, categoria: e.target.value })}>
                  {CATEGORIAS_PRESTADOR.map(c2 => <option key={c2} value={c2}>{c2}</option>)}
                </select>
              </div>
              <div><label style={C.label}>Telefone</label><input style={C.input} value={novoPrestador.telefone} onChange={e => setNovoPrestador({ ...novoPrestador, telefone: e.target.value })} /></div>
              <div><label style={C.label}>E-mail</label><input style={C.input} value={novoPrestador.email} onChange={e => setNovoPrestador({ ...novoPrestador, email: e.target.value })} /></div>
            </div>
            <div style={{ ...grade("1fr 2fr 0.8fr"), marginBottom: 12 }}>
              <div><label style={C.label}>CEP</label><input style={C.input} value={novoPrestador.cep} onChange={e => { setNovoPrestador({ ...novoPrestador, cep: e.target.value }); buscarCepPrestador(e.target.value); }} placeholder="00000-000" /></div>
              <div><label style={C.label}>Logradouro</label><input style={C.input} value={novoPrestador.logradouro} onChange={e => setNovoPrestador({ ...novoPrestador, logradouro: e.target.value })} /></div>
              <div><label style={C.label}>Número</label><input style={C.input} value={novoPrestador.numero} onChange={e => setNovoPrestador({ ...novoPrestador, numero: e.target.value })} /></div>
              <div><label style={C.label}>Bairro</label><input style={C.input} value={novoPrestador.bairro} onChange={e => setNovoPrestador({ ...novoPrestador, bairro: e.target.value })} /></div>
              <div><label style={C.label}>Cidade</label><input style={C.input} value={novoPrestador.cidade} onChange={e => setNovoPrestador({ ...novoPrestador, cidade: e.target.value })} /></div>
              <div><label style={C.label}>UF</label><input style={C.input} maxLength={2} value={novoPrestador.estado} onChange={e => setNovoPrestador({ ...novoPrestador, estado: e.target.value.toUpperCase().slice(0, 2) })} /></div>
            </div>
            {novoPrestador.tipo === "PJ" && (
              <div style={{ ...grade("2fr 1fr"), marginBottom: 12 }}>
                <div><label style={C.label}>Representante legal</label><input style={C.input} value={novoPrestador.representanteNome} onChange={e => setNovoPrestador({ ...novoPrestador, representanteNome: e.target.value })} placeholder="quem assina pela empresa" /></div>
                <div><label style={C.label}>CPF do representante</label><input style={C.input} value={novoPrestador.representanteCpf} onChange={e => setNovoPrestador({ ...novoPrestador, representanteCpf: e.target.value })} /></div>
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" style={C.btnSec} onClick={() => setNovoPrestador(null)}>Cancelar</button>
              <button type="button" style={C.btn} onClick={salvarNovoPrestador}>Salvar prestador</button>
            </div>
          </div>
        )}

        {prest && prest.escritorio && (
          <div style={{ fontSize: 12.5, color: "#4b5563", background: "#fafafa", border: "1px solid rgba(38,36,33,0.14)", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
            {faltaEscritorio.length > 0 ? (
              <span>Os dados do contratado vêm do cadastro do escritório. Falta preencher: <strong style={{ color: "#111827" }}>{faltaEscritorio.join(" · ")}</strong>.</span>
            ) : (
              <span>Os dados do contratado vêm do cadastro do escritório.</span>
            )}
            {!formEscritorio && (
              <button type="button" onClick={abrirFormEscritorio}
                style={{ marginLeft: 8, background: "none", border: "none", padding: 0, color: AZUL_VK, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                {faltaEscritorio.length > 0 ? "Completar aqui" : "Editar aqui"}
              </button>
            )}
            {formEscritorio && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 10 }}>
                  <div><label style={C.label}>Razão social</label>
                    <input style={C.input} value={formEscritorio.nome} onChange={e => setFormEscritorio({ ...formEscritorio, nome: e.target.value })} /></div>
                  <div><label style={C.label}>CNPJ</label>
                    <input style={C.input} value={formEscritorio.cnpj} onChange={e => setFormEscritorio({ ...formEscritorio, cnpj: e.target.value })} placeholder="00.000.000/0000-00" /></div>
                </div>
                <div style={{ marginTop: 8 }}><label style={C.label}>Endereço (com número)</label>
                  <input style={C.input} value={formEscritorio.endereco} onChange={e => setFormEscritorio({ ...formEscritorio, endereco: e.target.value })} placeholder="Rua, nº, bairro" /></div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr", gap: 10, marginTop: 8 }}>
                  <div><label style={C.label}>Cidade</label>
                    <input style={C.input} value={formEscritorio.cidade} onChange={e => setFormEscritorio({ ...formEscritorio, cidade: e.target.value })} /></div>
                  <div><label style={C.label}>UF</label>
                    <input style={C.input} value={formEscritorio.estado} onChange={e => setFormEscritorio({ ...formEscritorio, estado: e.target.value.toUpperCase().slice(0, 2) })} /></div>
                  <div><label style={C.label}>CEP</label>
                    <input style={C.input} value={formEscritorio.cep} onChange={e => setFormEscritorio({ ...formEscritorio, cep: e.target.value })} /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr", gap: 10, marginTop: 8 }}>
                  <div><label style={C.label}>Responsável técnico</label>
                    <input style={C.input} value={formEscritorio.respNome} onChange={e => setFormEscritorio({ ...formEscritorio, respNome: e.target.value })} /></div>
                  <div><label style={C.label}>CPF</label>
                    <input style={C.input} value={formEscritorio.respCpf} onChange={e => setFormEscritorio({ ...formEscritorio, respCpf: e.target.value })} /></div>
                  <div><label style={C.label}>CAU</label>
                    <input style={C.input} value={formEscritorio.respCau} onChange={e => setFormEscritorio({ ...formEscritorio, respCau: e.target.value })} /></div>
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 10 }}>
                  <button type="button" style={C.btnSec} onClick={() => setFormEscritorio(null)}>Cancelar</button>
                  <button type="button" style={C.btn} onClick={salvarFormEscritorio}>Salvar no cadastro</button>
                </div>
              </div>
            )}
          </div>
        )}
        {tipoP && !prest && !novoPrestador && (
          <div style={{ fontSize: 12.5, color: "#4b5563", background: "#fafafa", border: "1px solid rgba(38,36,33,0.14)", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
            Sem prestador escolhido o contrato sai sem CNPJ, endereço e representante do contratado.
            <div style={{ marginTop: 6 }}>
              <label style={C.label}>Nome do contratado (provisório)</label>
              <input style={C.input} value={g.nomeContratado || ""} onChange={e => setG("nomeContratado", e.target.value)} placeholder="Nome da empresa ou pessoa" />
            </div>
          </div>
        )}

        {/* Objeto, local e prazo */}
        <div style={{ ...grade("1fr 1fr"), marginBottom: 12 }}>
          <div style={{ gridColumn: isMobile ? "auto" : "1 / -1" }}>
            <label style={C.label}>Objeto do contrato</label>
            <input style={C.input} value={g.objeto || ""} onChange={e => setG("objeto", e.target.value)} placeholder={objetoPadrao(g.tipoProfissional, escopo) || modelo.subtitulo} />
            <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 5 }}>
              {objetoEditado
                ? <>Texto editado à mão — não é mais reescrito quando você troca o tipo. <button type="button" onClick={() => setG("objeto", objetoPadrao(g.tipoProfissional, escopo))} style={{ background: "none", border: "none", padding: 0, color: AZUL_VK, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5 }}>Voltar ao padrão</button></>
                : "Escrito a partir do tipo de profissional e do que o contrato inclui. Pode ser editado."}
            </div>
          </div>
          <div style={{ gridColumn: isMobile ? "auto" : "1 / -1" }}>
            <label style={C.label}>Endereço da obra</label>
            <input style={C.input} value={g.enderecoObra || ""} onChange={e => setG("enderecoObra", e.target.value)} placeholder={enderecoDaObra(obraSelecionada, cliente) || "em branco, usa o endereço do cadastro"} />
            <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 5 }}>Em branco, o contrato usa o endereço do cadastro da obra — ou o do cliente, quando a obra está marcada como "Endereço do cliente".</div>
          </div>
          <div>
            <label style={C.label}>Prazo de execução</label>
            <div style={{ display: "flex", gap: 8 }}>
              <CampoCtrNum tipo="inteiro" valor={pz.qtd} onChange={v => setContratoGerando({ ...g, prazoQtd: v, prazoDias: "", prazoMeses: "" })} style={{ ...C.input, flex: 1 }} placeholder="quantidade" />
              <select style={{ ...C.input, cursor: "pointer", flex: 1 }} value={pz.unidade} onChange={e => setContratoGerando({ ...g, prazoUnidade: e.target.value, prazoDias: "", prazoMeses: "" })}>
                <option value="">— dias ou meses —</option>
                <option value="dias">Dias corridos</option>
                <option value="meses">Meses</option>
              </select>
            </div>
          </div>
          <div><label style={C.label}>Início previsto</label><input style={C.input} type="date" value={g.dataInicio || ""} onChange={e => setG("dataInicio", e.target.value)} /></div>
          <div>
            <label style={C.label}>Data de assinatura</label>
            <input style={C.input} type="date" value={g.dataAssinatura || ""} onChange={e => setG("dataAssinatura", e.target.value)} />
            <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 5 }}>Vem com a data de hoje; é a data que fecha o contrato, acima das assinaturas.</div>
          </div>
          <div><label style={C.label}>Status</label><select style={{ ...C.input, cursor: "pointer" }} value={g.status} onChange={e => setG("status", e.target.value)}>{Object.entries(statusContrato).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
        </div>

        {gerenciamento && (
          <div style={bloco}>
            <div style={tituloBloco}>Gerenciamento de obra</div>
            <div style={{ fontSize: 11.5, color: "#6b7280", marginBottom: 10 }}>
              O texto do contrato é o modelo do escritório. Aqui você preenche só o que muda.
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={C.label}>Referência da obra</label>
              <textarea style={{ ...C.input, resize: "vertical" }} rows={2} value={g.referenciaObra || ""} onChange={e => setG("referenciaObra", e.target.value)}
                placeholder="ex.: Reforma comercial com aproximadamente 435,86 metros quadrados entre áreas de ampliação e existente" />
              <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 5 }}>Entra na cláusula 2, seguida do endereço da obra.</div>
            </div>
            <div style={{ ...grade("1fr 1fr"), marginBottom: 12 }}>
              <div>
                <label style={C.label}>Locadora de equipamentos preferida</label>
                <input style={C.input} value={g.locadoraEquipamentos || ""} onChange={e => setG("locadoraEquipamentos", e.target.value)} placeholder="em branco, a cláusula não cita nenhuma" />
              </div>
              <div><label style={C.label}>Interrupção que rescinde (dias)</label><CampoCtrNum tipo="inteiro" valor={g.diasInterrupcao} onChange={v => setG("diasInterrupcao", v)} style={C.input} placeholder="90" /></div>
            </div>
            <div style={grade("1fr 1fr 1fr")}>
              <div><label style={C.label}>Multa por inadimplência (%)</label><CampoCtrNum tipo="pct" valor={g.multaInadimplenciaPct} onChange={v => setG("multaInadimplenciaPct", v)} style={C.input} placeholder="0,00%" /></div>
              <div><label style={C.label}>Juros ao mês (%)</label><CampoCtrNum tipo="pct" valor={g.jurosMesPct} onChange={v => setG("jurosMesPct", v)} style={C.input} placeholder="0,00%" /></div>
              <div><label style={C.label}>Honorários advocatícios (%)</label><CampoCtrNum tipo="pct" valor={g.honorariosPct} onChange={v => setG("honorariosPct", v)} style={C.input} placeholder="0,00%" /></div>
            </div>
          </div>
        )}

        {/* Valor: itens discriminados ou valor único — vale o que for preenchido.
            No gerenciamento o valor é um só: os itens não aparecem. */}
        <div style={bloco}>
          <div style={tituloBloco}>Valor do contrato</div>
          <div style={{ ...grade("240px 1fr"), marginBottom: 10 }}>
            <div>
              <label style={C.label}>Valor total (R$)</label>
              <CampoCtrNum tipo="moeda" valor={g.valor} onChange={v => setG("valor", v)} style={C.input} placeholder="0,00" disabled={(g.itens || []).some(i => Number(i.valor) > 0)} />
              <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 5 }}>Discrimine itens abaixo se quiser; havendo itens, o total é a soma deles.</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: isMobile ? "flex-start" : "flex-end", fontSize: 14, fontWeight: 700, color: "#111827" }}>
              Total: {fmtMoedaCtr(total)}
            </div>
          </div>
          {!gerenciamento && porItem && (g.itens || []).some(i => Number(i.valor) > 0) && (
            <div style={{ fontSize: 11.5, color: "#4b5563", marginBottom: 6 }}>
              Por item, duas datas: o <strong style={{ color: "#111827" }}>início</strong> (quando o item é liberado para produção, quando vence a entrada dele) e a
              <strong style={{ color: "#111827" }}> previsão</strong> de conclusão (quando vence o saldo). Ambas entram em contas a pagar marcadas como estimadas.
            </div>
          )}
          {!gerenciamento && porItem && !isMobile && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 140px 140px auto", gap: 8, marginBottom: 4 }}>
              <span style={C.label}>Item</span><span style={C.label}>Valor</span>
              <span style={C.label}>Início</span><span style={C.label}>Previsão de conclusão</span><span />
            </div>
          )}
          {!gerenciamento && (g.itens || []).map((it, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : (porItem ? "1fr 160px 140px 140px auto" : "1fr 160px auto"), gap: 8, alignItems: "start", marginBottom: 8 }}>
              <textarea style={{ ...C.input, resize: "vertical" }} rows={2} value={it.descricao} onChange={e => setLista("itens", idx, "descricao", e.target.value)} placeholder="Descrição do item (opcional)" />
              <CampoCtrNum tipo="moeda" valor={it.valor} onChange={v => setLista("itens", idx, "valor", v)} style={C.input} placeholder="0,00" />
              {porItem && (
                <input style={C.input} type="date" title="Início do item — vence a entrada dele" value={it.inicio || ""} onChange={e => setLista("itens", idx, "inicio", e.target.value)} />
              )}
              {porItem && (
                <input style={C.input} type="date" title="Previsão de conclusão do item — vence o saldo" value={it.previsao || ""} onChange={e => setLista("itens", idx, "previsao", e.target.value)} />
              )}
              <button type="button" onClick={() => delLinha("itens", idx)} style={{ ...C.btnGhost, color: "#dc2626", height: 36 }}>×</button>
            </div>
          ))}
          {!gerenciamento && <button type="button" style={C.btnSec} onClick={() => addLinha("itens", { descricao: "", valor: "", inicio: "", previsao: "" })}>＋ Adicionar item</button>}
        </div>

        {/* Modalidade de pagamento — igual para todo contrato de prestação de
            serviço, gestão de obra inclusive */}
        <div style={bloco}>
          <div style={tituloBloco}>Modalidade de pagamento</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 10 }}>
            {MODALIDADES_PAGAMENTO.map(mp => (
              <label key={mp.id} style={{ display: "flex", gap: 8, alignItems: "start", border: `1.5px solid ${modo === mp.id ? AZUL_VK : "rgba(38,36,33,0.14)"}`, borderRadius: 10, padding: "9px 11px", cursor: "pointer", background: "#fff" }}>
                <input type="radio" name="ctr-modalidade" checked={modo === mp.id} onChange={() => setG("modalidade", mp.id)} style={{ marginTop: 2, cursor: "pointer" }} />
                <span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{mp.nome}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: "#4b5563", marginTop: 2 }}>{mp.resumo}</span>
                </span>
              </label>
            ))}
          </div>
          <div style={grade("1fr 1fr 1fr")}>
            {(modo === "entradaParcelas" || modo === "entradaFinal") && (
              <div><label style={C.label}>Entrada (%)</label><CampoCtrNum tipo="pct" valor={g.entradaPct} onChange={v => setG("entradaPct", v)} style={C.input} placeholder="0,00%" /></div>
            )}
            {modo === "entradaFinal" && (
              <div>
                <label style={C.label}>Saldo pago</label>
                <select style={{ ...C.input, cursor: "pointer" }} value={g.entradaEscopo || "contrato"} onChange={e => setG("entradaEscopo", e.target.value)}>
                  <option value="contrato">Na conclusão do contrato todo</option>
                  <option value="item">Na conclusão de cada item</option>
                </select>
              </div>
            )}
            {(modo === "parcelado" || modo === "entradaParcelas") && (
              <>
                <div><label style={C.label}>Nº de parcelas</label><CampoCtrNum tipo="inteiro" valor={g.parcelas} onChange={v => setG("parcelas", v)} style={C.input} placeholder="0" /></div>
                <div>
                  <label style={C.label}>Periodicidade</label>
                  <select style={{ ...C.input, cursor: "pointer" }} value={g.periodicidade || "quinzenais"} onChange={e => setG("periodicidade", e.target.value)}>
                    {PERIODICIDADES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                {pagaEmDiaDaSemana(g.periodicidade || "quinzenais") && (
                  <div>
                    <label style={C.label}>Dia do pagamento</label>
                    <select style={{ ...C.input, cursor: "pointer" }} value={diaSemanaPgto(g)} onChange={e => setG("diaSemana", Number(e.target.value))}>
                      {DIAS_SEMANA_PGTO.map(([v, nome]) => <option key={v} value={v}>{nome}</option>)}
                    </select>
                    <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 5 }}>
                      {(g.periodicidade || "quinzenais") === "quinzenais"
                        ? `${diaSemanaPlural(g).replace(/^./, c => c.toUpperCase())} alternadas — uma sim, outra não.`
                        : `Toda ${diaSemanaPlural(g).replace(/s-feiras$/, "-feira")}.`}
                    </div>
                  </div>
                )}
              </>
            )}
            <div>
              <label style={C.label}>Condição de pagamento</label>
              <select style={{ ...C.input, cursor: "pointer" }} value={g.meioPagamento || "pixOuTransferencia"} onChange={e => setG("meioPagamento", e.target.value)}>
                {MEIOS_PAGAMENTO.map(mp => <option key={mp.id} value={mp.id}>{mp.nome}</option>)}
              </select>
            </div>
            {modo === "medicao" && (
              <>
                <div>
                  <label style={C.label}>Medição</label>
                  <select style={{ ...C.input, cursor: "pointer" }} value={g.medicaoPeriodicidade || "mensal"} onChange={e => setG("medicaoPeriodicidade", e.target.value)}>
                    <option value="semanal">Semanal</option><option value="quinzenal">Quinzenal</option><option value="mensal">Mensal</option>
                  </select>
                </div>
                <div><label style={C.label}>Pagar em até (dias)</label><CampoCtrNum tipo="inteiro" valor={g.medicaoPrazoDias} onChange={v => setG("medicaoPrazoDias", v)} style={C.input} placeholder="0" /></div>
              </>
            )}
          </div>
          {(modo === "parcelado" || modo === "entradaParcelas") && pagaEmDiaDaSemana(g.periodicidade || "quinzenais") && (
            <label style={{ display: "flex", gap: 8, alignItems: "start", marginTop: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={(g.ajusteFeriado || "anteciparDiaUtil") !== "nenhum"} style={{ marginTop: 3, cursor: "pointer" }}
                onChange={e => setG("ajusteFeriado", e.target.checked ? "anteciparDiaUtil" : "nenhum")} />
              <span>
                <span style={{ fontSize: 12.5, color: "#111827", fontWeight: 600 }}>Antecipar quando cair em feriado</span>
                <span style={{ display: "block", fontSize: 11.5, color: "#4b5563", marginTop: 2 }}>
                  Sexta-feira de feriado paga na quinta. Vale para os feriados nacionais; a cadência das demais parcelas não muda.
                </span>
              </span>
            </label>
          )}
          {(modo === "parcelado" || modo === "entradaParcelas") && (
            <div style={{ ...grade("1fr 1fr"), marginTop: 12 }}>
              <div>
                <label style={C.label}>Primeiro vencimento</label>
                <input style={C.input} type="date" value={g.primeiroVencimento || ""} onChange={e => setG("primeiroVencimento", e.target.value)} />
                <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 5 }}>
                  Em branco, a 1ª parcela conta do início/assinatura{g.periodicidade === "mensais" && Number(g.diaVencimento) > 0 ? `, no dia ${String(Math.floor(Number(g.diaVencimento))).padStart(2, "0")}` : ""}. Preencha para registrar contrato que já começou a ser pago — as parcelas anteriores entram em contas a pagar e você marca as pagas por lá.
                </div>
              </div>
              {gerenciamento && (
                <div>
                  <label style={C.label}>Vencimento todo dia</label>
                  <CampoCtrNum tipo="inteiro" valor={g.diaVencimento} onChange={v => setG("diaVencimento", v)} style={C.input} placeholder="05" />
                  <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 5 }}>Usado quando não há primeiro vencimento informado.</div>
                </div>
              )}
            </div>
          )}
          {modo === "entradaFinal" && (
            <div style={{ ...grade("1fr 1fr"), marginTop: 12 }}>
              <div>
                <label style={C.label}>{porItem ? "Previsão de conclusão (padrão dos itens)" : "Previsão de conclusão"}</label>
                <input style={C.input} type="date" value={g.previsaoConclusao || ""} onChange={e => setG("previsaoConclusao", e.target.value)} />
                <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 5 }}>
                  Data estimada do saldo{porItem ? ", usada nos itens sem previsão própria" : ""}. Em branco, vale o fim do prazo de execução. Em contas a pagar a parcela aparece marcada como <strong style={{ color: "#111827" }}>estimada</strong>.
                </div>
              </div>
            </div>
          )}
          {modo === "entradaFinal" && (g.entradaEscopo || "contrato") === "item" && !(g.itens || []).some(i => Number(i.valor) > 0) && (
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 8 }}>Pagamento item a item precisa de itens com valor — sem eles, o contrato sai como entrada + saldo no final.</div>
          )}
        </div>

        {/* Cláusulas opcionais */}
        {!gerenciamento && <div style={bloco}>
          <div style={tituloBloco}>Cláusulas do contrato</div>
          <div style={{ fontSize: 11.5, color: "#4b5563", marginBottom: 10 }}>Marque o que entra neste contrato. O texto e a numeração se ajustam sozinhos.</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
            {CONTRATO_OPCOES.map(op => (
              <div key={op.id} style={{ border: "1px solid rgba(38,36,33,0.10)", borderRadius: 10, padding: "9px 11px", background: ligada(op.id) ? "#fff" : "#fafafa" }}>
                <label style={{ display: "flex", gap: 8, alignItems: "start", cursor: "pointer" }}>
                  <input type="checkbox" checked={ligada(op.id)} onChange={e => setOpcao(op.id, e.target.checked)} style={{ marginTop: 3, cursor: "pointer" }} />
                  <span>
                    <span style={{ fontSize: 12.5, color: "#111827", fontWeight: 600 }}>{op.label}</span>
                    {op.ajuda && <span style={{ display: "block", fontSize: 11, color: "#4b5563", marginTop: 2 }}>{op.ajuda}</span>}
                  </span>
                </label>
                {ligada(op.id) && op.especifica && (
                  (especificando[op.id] || String(g[op.especifica.k] || "").trim())
                    ? (
                      <textarea
                        style={{ ...C.input, resize: "vertical", marginTop: 8, fontSize: 12.5 }}
                        rows={2}
                        value={g[op.especifica.k] || ""}
                        onChange={e => setG(op.especifica.k, e.target.value)}
                        placeholder={op.especifica.placeholder}
                        autoFocus={!!especificando[op.id]}
                      />
                    ) : (
                      <button type="button" onClick={() => setEspecificando({ ...especificando, [op.id]: true })}
                        style={{ background: "none", border: "none", padding: "6px 0 0 24px", margin: 0, color: AZUL_VK, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5 }}>
                        Especificar
                      </button>
                    )
                )}
                {ligada(op.id) && op.campos && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    {op.campos.map(cp => (
                      <div key={cp.k} style={{ flex: "1 1 120px" }}>
                        <label style={C.label}>{cp.l}</label>
                        {cp.tipo === "select" ? (
                          <select style={{ ...C.input, cursor: "pointer" }} value={g[cp.k] || cp.opcoes[0][0]} onChange={e => setG(cp.k, e.target.value)}>
                            {cp.opcoes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        ) : (
                          <CampoCtrNum tipo={cp.tipo} valor={g[cp.k]} onChange={v => setG(cp.k, v)} style={C.input} placeholder={cp.tipo === "pct" ? "0,00%" : "0"} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>}

        <div style={{ marginBottom: 12, display: gerenciamento ? "none" : undefined }}>
          <label style={C.label}>Exclusões do objeto (o que não entra)</label>
          <textarea style={{ ...C.input, resize: "vertical" }} rows={2} value={g.exclusoes || ""} onChange={e => setG("exclusoes", e.target.value)} placeholder="ex.: o lixamento do concreto e a montagem hidráulica da piscina" />
          <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 5 }}>Comece em minúscula para o contrato abrir com "Não integram o objeto deste contrato:". Começando em maiúscula, o seu texto entra como está.</div>
        </div>

        {!gerenciamento && <div style={bloco}>
          <div style={tituloBloco}>ANEXO I — descritivo dos serviços (opcional)</div>
          {(g.escopo || []).map((e2, idx) => (
            <div key={idx} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, marginBottom: 8, background: "#fafafa" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "end", marginBottom: 6 }}>
                <div style={{ flex: 1 }}><label style={C.label}>Título do bloco</label><input style={C.input} value={e2.titulo} onChange={ev => setLista("escopo", idx, "titulo", ev.target.value)} placeholder="ex.: Preparação do contrapiso" /></div>
                <button type="button" onClick={() => delLinha("escopo", idx)} style={{ ...C.btnGhost, color: "#dc2626", height: 36 }}>×</button>
              </div>
              <textarea style={{ ...C.input, resize: "vertical" }} rows={4} value={e2.texto} onChange={ev => setLista("escopo", idx, "texto", ev.target.value)} placeholder="Descrição do que será executado. Cada linha vira um parágrafo." />
            </div>
          ))}
          <button type="button" style={C.btnSec} onClick={() => addLinha("escopo", { titulo: "", texto: "" })}>＋ Adicionar bloco do descritivo</button>
        </div>}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
          <button style={C.btn} onClick={salvar}>Salvar</button>
          <button style={C.btnSec} onClick={gerarPDF}>Gerar PDF</button>
          {jaSalvo && <button style={C.btnSec} onClick={() => { const n = salvar(); if (n) { setContratoAberto(n); setView("verContrato"); } }}>Ver contrato</button>}
          <button style={C.btnGhost} onClick={() => { setContratoGerando(null); setNovoPrestador(null); setView("contratosDaObra"); }}>Voltar</button>
          {contratoSalvoEm > 0 && <span style={{ fontSize: 12.5, color: "#111827", fontWeight: 600 }}>✓ Salvo</span>}
        </div>

        <details style={{ marginTop: 18 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, color: "#4b5563" }}>Prévia do contrato</summary>
          <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 10, padding: 12, maxHeight: 420, overflowY: "auto" }}>
            <ContratoDocumento contrato={g} cliente={cliente} obra={obraSelecionada} prestador={prest} />
          </div>
        </details>
      </div>
    );
  }

  // ── Contas a pagar da obra ───────────────────────────────────
  if (view === "contasPagar" && obraSelecionada) {
    const nomePrestador = (id) => (prestadores.find(p => p.id === id) || {}).nome || "";
    const nomeConta = (id) => (PLANO_CONTAS.find(c => c.id === id) || {}).nome || "—";
    const nomeContrato = (id) => {
      const ct = contratos.find(c => c.id === id);
      if (!ct) return "Contrato removido";
      return `${ct.numeroContrato ? `Contrato ${ct.numeroContrato} · ` : ""}${servicoDoContrato(ct)} · ${ct.nomeContratado || "Contratado"}`;
    };
    const t = totaisContas(contasDaObra, hojeIso);
    // o mês escolhido no gráfico entra antes dos demais filtros
    const doMes = mesSelecionado
      ? contasDaObra.filter(c => String(c.vencimento || "").slice(0, 7) === mesSelecionado)
      : contasDaObra;
    const lista = filtrarContas(doMes, filtroContas, hojeIso);
    const grupos = agruparContas(lista, visaoContas, { hoje: hojeIso, nomePrestador, nomeContrato });
    // Os anéis somam a obra INTEIRA, não a lista filtrada: "pago de total"
    // precisa dos dois lados, e o filtro padrão esconde justamente as pagas —
    // todo anel sairia em 0%. Os quadros do topo e o mês do gráfico mandam na
    // lista de baixo; o anel é o retrato do contrato/fornecedor por inteiro.
    const gruposCheios = visaoUsaAnel(visaoContas)
      ? agruparContas(contasDaObra, visaoContas, { hoje: hojeIso, nomePrestador, nomeContrato })
      : grupos;
    const mesAtual = hojeIso.slice(0, 7);
    const abertoPadrao = (g) => (visaoContas === "mes" ? g.chave >= mesAtual : true);
    const fechado = (g) => (gruposFechados[`${visaoContas}:${g.chave}`] ?? !abertoPadrao(g));
    const alternarGrupo = (g) => setGruposFechados({ ...gruposFechados, [`${visaoContas}:${g.chave}`]: !fechado(g) });

    // Os quadros do topo são o filtro da lista: clicar em "A pagar" mostra só
    // o que está em aberto; clicar de novo volta para todas.
    const tile = (rot, valor, sub, filtro) => {
      const ativo = filtroContas === filtro;
      return (
        <button type="button" onClick={() => setFiltroContas(ativo && filtro !== "todas" ? "todas" : filtro)}
          style={{ border: `1.5px solid ${ativo ? AZUL_VK : "rgba(38,36,33,0.14)"}`, borderRadius: 14, padding: "12px 14px",
            background: "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%" }}>
          <div style={{ fontSize: 11.5, color: ativo ? AZUL_VK : "#4b5563", marginBottom: 4, fontWeight: ativo ? 700 : 400 }}>{rot}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: ativo ? AZUL_VK : "#111827" }}>{fmtMoedaCtr(valor)}</div>
          {sub ? <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 3 }}>{sub}</div> : null}
        </button>
      );
    };
    const chip = (ativo, texto, onClick) => (
      <button key={texto} type="button" onClick={onClick}
        style={{ border: `1.5px solid ${ativo ? AZUL_VK : "rgba(38,36,33,0.16)"}`, background: "#fff",
          color: ativo ? AZUL_VK : "#4b5563", borderRadius: 20, padding: "6px 14px", fontSize: 12.5,
          fontWeight: ativo ? 700 : 500, cursor: "pointer", fontFamily: "inherit" }}>
        {texto}
      </button>
    );
    // grade das colunas — a mesma no cabeçalho e nas linhas
    const COLS = isMobile ? "1fr" : "1fr 104px 96px 116px 150px";

    // ── Gráfico do fluxo mensal (desenho em contas-pagar.jsx) ──
    const fluxo = fluxoMensal(contasDaObra, hojeIso);
    // O gráfico desenha as faixas do filtro escolhido nos quadros do topo.
    const seriesGrafico = seriesDoFiltro(filtroContas);
    // Clicar na barra filtra a lista por aquele mês; clicar de novo desfaz.
    const irParaMes = (chave) => {
      setMesSelecionado(mesSelecionado === chave ? "" : chave);
      setGruposFechados({ ...gruposFechados, [`mes:${chave}`]: false });
    };

    return (
      <div data-vk-ui="1" style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
        <button onClick={() => { setFormConta(null); setView("detalheObra"); }} style={{ ...C.btnGhost, marginBottom: 16, fontSize: 12 }}>← Voltar</button>

        {/* Baixa da conta: a data de contabilização é o que define em que mês
            a despesa entra no extrato da obra. */}
        {folhaComprov && (
          <FolhaComprovantes
            folha={folhaDeComprovantes(folhaComprov.contas, folhaComprov.titulo)}
            obraNome={obraSelecionada.nome}
            escritorioNome={(data.escritorio || {}).nome || ""}
            fmtBRL={fmtMoedaCtr}
            aoFechar={() => setFolhaComprov(null)} />
        )}

        {formPagamento && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}
            onClick={() => setFormPagamento(null)}>
            <div data-vk-ui="1" onClick={e => e.stopPropagation()}
              style={{ background: "#fff", border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: 18, width: "100%", maxWidth: 460, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 20px 60px -20px rgba(17,24,39,0.45)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Registrar pagamento</div>
              <div style={{ fontSize: 12.5, color: "#4b5563", marginTop: 4, marginBottom: 14 }}>{tituloConta(formPagamento.conta)}</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={C.label}>Data de contabilização</label>
                  <input style={C.input} type="date" value={formPagamento.dataContab}
                    onChange={e => setFormPagamento({ ...formPagamento, dataContab: e.target.value })} />
                </div>
                <div>
                  <label style={C.label}>Valor pago (R$)</label>
                  <CampoCtrNum tipo="moeda" valor={formPagamento.valorPago} onChange={v => setFormPagamento({ ...formPagamento, valorPago: v })} style={C.input} placeholder="0,00" />
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 8 }}>
                A despesa entra no extrato da obra no mês desta data. O dia de hoje ({new Date(hojeIso + "T12:00:00").toLocaleDateString("pt-BR")}) fica registrado como a data em que foi contabilizada.
              </div>
              {/* O comprovante fica junto da baixa, e não numa pasta à parte:
                  é aqui que ele existe, e é daqui que sai a folha por
                  fornecedor. */}
              <div style={{ marginTop: 14 }}>
                <label style={C.label}>Comprovante (opcional)</label>
                <CampoAnexoProposta
                  anexo={formPagamento.comprovante}
                  categoria="comprovante_pagamento"
                  chamada="Arraste o comprovante aqui"
                  apoio="cole o print com Ctrl+V, arraste o arquivo ou clique para escolher"
                  onTrocar={a => setFormPagamento(f => f && ({ ...f, comprovante: a }))}
                  onErro={m => setFormPagamento(f => f && ({ ...f, erroAnexo: m }))} />
                {formPagamento.erroAnexo && (
                  <div style={{ fontSize: 11.5, color: "#dc2626", marginTop: 6 }}>{formPagamento.erroAnexo}</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
                <button type="button" style={C.btnSec} onClick={() => setFormPagamento(null)}>Cancelar</button>
                <button type="button" style={C.btn} onClick={confirmarPagamento}>Registrar pagamento</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Contas a pagar</div>
          <div style={{ fontSize: 12.5, color: "#4b5563", marginTop: 2 }}>{obraSelecionada.nome}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
          {tile("A pagar", t.aberto, `${t.qtdAberto} ${t.qtdAberto === 1 ? "conta" : "contas"}`, "aPagar")}
          {tile("Vencido", t.vencido, `${t.qtdVencido} em atraso`, "vencidas")}
          {tile("Pago", t.pago, "realizado da obra", "pagas")}
          {tile("Total", t.total, "contratado + avulsas", "todas")}
        </div>

        {/* Fluxo mensal — ou os anéis, quando o agrupamento é por entidade */}
        {visaoUsaAnel(visaoContas) ? (
          <AneisPorGrupo grupos={gruposCheios} visao={visaoContas} isMobile={isMobile} fmtBRL={fmtMoedaCtr} />
        ) : fluxo.meses.length > 0 && (
          <div ref={refGrafico} style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 14, padding: "14px 16px", marginBottom: 16, background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>Fluxo por mês</div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {[...CP_FAIXAS].filter(([k]) => seriesGrafico.indexOf(k) >= 0).reverse().map(([k, cor, rot]) => (
                  <span key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#4b5563" }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: cor, display: "inline-block" }} />{rot}
                  </span>
                ))}
              </div>
            </div>
            <GraficoFluxoMensal fluxo={fluxo} hojeIso={hojeIso} uid={obraSelecionada.id} onEscolherMes={irParaMes} mesSelecionado={mesSelecionado} series={seriesGrafico} />
            <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 6 }}>
              Mostrando {(FILTROS_CONTAS.find(f => f.id === filtroContas) || {}).nome.toLowerCase()} — os quadros acima trocam o que o gráfico desenha. Valores em milhares quando passam de mil. Clique num mês para ver só as contas dele; clique fora do gráfico para voltar a todas.
              {fluxo.semData > 0 ? ` ${fluxo.semData} ${fluxo.semData === 1 ? "conta" : "contas"} sem vencimento (${fmtMoedaCtr(fluxo.semDataValor)}) fora do gráfico.` : ""}
            </div>
          </div>
        )}

        {/* Visões e filtros */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11.5, color: "#6b7280", marginRight: 2 }}>Agrupar por</span>
          {VISOES_CONTAS.map(v => chip(visaoContas === v.id, v.nome, () => setVisaoContas(v.id)))}
        </div>

        {(filtroContas !== FILTRO_CONTAS_PADRAO || mesSelecionado) && (
          <div data-vk-mantem-mes="1" style={{ fontSize: 11.5, color: "#4b5563", marginBottom: 16 }}>
            {`Mostrando ${mesSelecionado ? rotuloMes(mesSelecionado).toLowerCase() : ""}${mesSelecionado && filtroContas !== "todas" ? " · " : ""}${filtroContas === "todas" ? (mesSelecionado ? "" : "todas as contas") : `só ${(FILTROS_CONTAS.find(f => f.id === filtroContas) || {}).nome.toLowerCase()}`} · `}
            <button type="button" onClick={() => { setFiltroContas(FILTRO_CONTAS_PADRAO); setMesSelecionado(""); }} style={{ background: "none", border: "none", padding: 0, color: AZUL_VK, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5 }}>voltar ao padrão</button>
          </div>
        )}

        {/* Nova conta avulsa */}
        {perm.podeEditar && (formConta ? (
          <div style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 12, padding: 12, marginBottom: 16, background: "#fafafa" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 10 }}>{contasDaObra.some(c => c.id === formConta.id) ? "Editar conta" : "Nova conta"}</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label style={C.label}>Descrição *</label><input style={C.input} value={formConta.descricao} onChange={e => setFormConta({ ...formConta, descricao: e.target.value })} placeholder="ex.: caçamba de entulho" /></div>
              <div><label style={C.label}>Valor (R$)</label><CampoCtrNum tipo="moeda" valor={formConta.valor} onChange={v => setFormConta({ ...formConta, valor: v })} style={C.input} placeholder="0,00" /></div>
              <div><label style={C.label}>Vencimento</label><input style={C.input} type="date" value={formConta.vencimento || ""} onChange={e => setFormConta({ ...formConta, vencimento: e.target.value })} /></div>
              <div>
                <label style={C.label}>Conta</label>
                <select style={{ ...C.input, cursor: "pointer" }} value={formConta.contaId} onChange={e => setFormConta({ ...formConta, contaId: e.target.value })}>
                  {GRUPOS_PL.filter(g => g.id !== "receitas").map(g => (
                    <optgroup key={g.id} label={g.titulo}>
                      {PLANO_CONTAS.filter(c => c.grupo === g.id).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label style={C.label}>Favorecido</label>
                <select style={{ ...C.input, cursor: "pointer" }} value={formConta.prestadorId || ""} onChange={e => setFormConta({ ...formConta, prestadorId: e.target.value, favorecido: (prestadores.find(p => p.id === e.target.value) || {}).nome || "" })}>
                  <option value="">— sem prestador —</option>
                  {prestadores.filter(p => p.ativo !== false).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div><label style={C.label}>Observação</label><input style={C.input} value={formConta.observacao || ""} onChange={e => setFormConta({ ...formConta, observacao: e.target.value })} /></div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={C.btnSec} onClick={() => setFormConta(null)}>Cancelar</button>
              <button style={C.btn} onClick={salvarContaAvulsa}>Salvar conta</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <button style={C.btnSec} onClick={() => setFormConta(contaAvulsaVazia(obraSelecionada.id))}>＋ Nova conta</button>
            {perm.podeGerenciarObra && (obraAtual.contratos || []).length > 0 && (
              <button style={C.btnSec} onClick={() => {
                const primeiro = (obraAtual.contratos || [])[0];
                setFormRecalibrar({ contratoId: primeiro.id, novaData: primeiroVencimentoContrato(primeiro) || hojeIso,
                  itens: datasDosItens(primeiro), previsaoConclusao: primeiro.previsaoConclusao || "" });
              }}>Recalibrar datas</button>
            )}
          </div>
        ))}

        {/* Recalibragem: a obra não começou na data registrada no contrato —
            muda-se a data do primeiro pagamento e as parcelas em aberto andam
            junto. As pagas ficam onde estão. */}
        {formRecalibrar && (() => {
          const alvo = (obraAtual.contratos || []).find(c => c.id === formRecalibrar.contratoId) || (obraAtual.contratos || [])[0];
          const porItem = alvo ? contratoPorItem(alvo) : false;
          const alvoNovo = !alvo ? null : porItem
            ? { ...recalibrarItens(alvo, formRecalibrar.itens || []), previsaoConclusao: formRecalibrar.previsaoConclusao || "" }
            : recalibrarContrato(alvo, formRecalibrar.novaData);
          const previa = alvo ? previaEntreContratos(alvo, alvoNovo, contasDaObra, porItem ? 6 : 4) : { linhas: [], pagas: 0, total: 0 };
          const itensDoAlvo = ((alvo || {}).itens || []);
          const dia = (iso) => iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR") : "—";
          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}
              onClick={() => setFormRecalibrar(null)}>
              <div data-vk-ui="1" onClick={e => e.stopPropagation()}
                style={{ background: "#fff", border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: 18, width: "100%", maxWidth: 520, maxHeight: "86vh", overflowY: "auto", boxShadow: "0 20px 60px -20px rgba(17,24,39,0.45)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Recalibrar datas do contrato</div>
                <div style={{ fontSize: 12.5, color: "#4b5563", marginTop: 4, marginBottom: 14 }}>
                  {porItem
                    ? "A obra não começou na data registrada? Ajuste abaixo o começo e a conclusão de cada item — as parcelas em aberto acompanham."
                    : "A obra não começou na data registrada? Informe quando vence o primeiro pagamento; as parcelas em aberto andam junto, na mesma periodicidade."}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 170px", gap: 12 }}>
                  <div>
                    <label style={C.label}>Contrato</label>
                    <select style={{ ...C.input, cursor: "pointer" }} value={formRecalibrar.contratoId}
                      onChange={e => {
                        const ct = (obraAtual.contratos || []).find(x => x.id === e.target.value);
                        setFormRecalibrar({ contratoId: e.target.value, novaData: (ct && primeiroVencimentoContrato(ct)) || hojeIso,
                          itens: datasDosItens(ct), previsaoConclusao: (ct && ct.previsaoConclusao) || "" });
                      }}>
                      {(obraAtual.contratos || []).map(ct => (
                        <option key={ct.id} value={ct.id}>
                          {`${ct.numeroContrato ? `Contrato ${ct.numeroContrato} · ` : ""}${servicoDoContrato(ct)} · ${ct.nomeContratado || "Contratado"}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!porItem && (
                    <div>
                      <label style={C.label}>1º pagamento vence em</label>
                      <input style={C.input} type="date" value={formRecalibrar.novaData}
                        onChange={e => setFormRecalibrar({ ...formRecalibrar, novaData: e.target.value })} />
                    </div>
                  )}
                  {porItem && (
                    <div>
                      <label style={C.label}>Previsão de conclusão (padrão)</label>
                      <input style={C.input} type="date" value={formRecalibrar.previsaoConclusao || ""}
                        onChange={e => setFormRecalibrar({ ...formRecalibrar, previsaoConclusao: e.target.value })} />
                    </div>
                  )}
                </div>

                {/* Pagamento item a item: cada item tem o seu próprio começo e
                    a sua própria conclusão — é item a item que se recalibra. */}
                {porItem && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 11.5, color: "#4b5563", marginBottom: 8 }}>
                      Este contrato paga entrada na liberação de cada item e o saldo na conclusão dele, então a recalibragem é item a item.
                    </div>
                    {!isMobile && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 150px 150px", gap: 8, marginBottom: 4 }}>
                        <span style={C.label}>Item</span><span style={C.label}>Início</span><span style={C.label}>Conclusão</span>
                      </div>
                    )}
                    {itensDoAlvo.map((it, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 150px 150px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 12.5, color: "#111827" }}>
                          {it.descricao || `Item ${i + 1}`}
                          <span style={{ color: "#6b7280" }}>{Number(it.valor) ? ` · ${fmtMoedaCtr(Number(it.valor))}` : ""}</span>
                        </span>
                        <input style={C.input} type="date" value={(formRecalibrar.itens && formRecalibrar.itens[i] && formRecalibrar.itens[i].inicio) || ""}
                          onChange={e => {
                            const novos = (formRecalibrar.itens || []).map((x, j) => j === i ? { ...x, inicio: e.target.value } : x);
                            setFormRecalibrar({ ...formRecalibrar, itens: novos });
                          }} />
                        <input style={C.input} type="date" value={(formRecalibrar.itens && formRecalibrar.itens[i] && formRecalibrar.itens[i].previsao) || ""}
                          onChange={e => {
                            const novos = (formRecalibrar.itens || []).map((x, j) => j === i ? { ...x, previsao: e.target.value } : x);
                            setFormRecalibrar({ ...formRecalibrar, itens: novos });
                          }} />
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 14, border: "1px solid rgba(38,36,33,0.12)", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ background: "#fafafa", padding: "7px 11px", fontSize: 11.5, fontWeight: 700, color: "#111827" }}>Como ficam as parcelas em aberto</div>
                  {previa.linhas.length === 0 ? (
                    <div style={{ padding: "10px 11px", fontSize: 12, color: "#4b5563" }}>Nenhuma parcela em aberto neste contrato.</div>
                  ) : previa.linhas.map(l => (
                    <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 11px", borderTop: "1px solid rgba(38,36,33,0.06)" }}>
                      <span style={{ fontSize: 12, color: "#4b5563" }}>{l.descricao}</span>
                      <span style={{ fontSize: 12, color: "#111827" }}>{dia(l.de)} → <strong>{dia(l.para)}</strong></span>
                    </div>
                  ))}
                  {previa.linhas.length > 0 && previa.total - previa.pagas > previa.linhas.length && (
                    <div style={{ padding: "7px 11px", fontSize: 11.5, color: "#6b7280", borderTop: "1px solid rgba(38,36,33,0.06)" }}>
                      e mais {previa.total - previa.pagas - previa.linhas.length} parcela{previa.total - previa.pagas - previa.linhas.length === 1 ? "" : "s"}, na mesma medida.
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 8 }}>
                  {previa.pagas > 0 ? `${previa.pagas} parcela${previa.pagas === 1 ? "" : "s"} já paga${previa.pagas === 1 ? "" : "s"} fica${previa.pagas === 1 ? "" : "m"} como está${previa.pagas === 1 ? "" : "ão"}. ` : ""}
                  {porItem
                    ? "Cada item passa a ter o seu próprio começo e a sua própria conclusão; item sem conclusão própria usa a previsão padrão acima."
                    : "O contrato passa a dizer que a primeira parcela vence nesta data."}
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
                  <button type="button" style={C.btnSec} onClick={() => setFormRecalibrar(null)}>Cancelar</button>
                  <button type="button" style={C.btn} onClick={confirmarRecalibragem}>Recalibrar</button>
                </div>
              </div>
            </div>
          );
        })()}

        {contasDaObra.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "#6b7280", fontSize: 12.5, border: "1px dashed rgba(38,36,33,0.18)", borderRadius: 9, background: "#fafafa" }}>
            Nenhuma conta nesta obra. Salvando um contrato, as parcelas dele entram aqui automaticamente.
          </div>
        ) : grupos.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "#6b7280", fontSize: 12.5, border: "1px dashed rgba(38,36,33,0.18)", borderRadius: 9, background: "#fafafa" }}>
            Nenhuma conta nesta visão.
          </div>
        ) : (
          <>
            {/* Cabeçalho das colunas */}
            {!isMobile && (
              <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "0 11px 6px", borderBottom: "1.5px solid rgba(38,36,33,0.14)", fontSize: 11.5, color: "#4b5563", fontWeight: 600 }}>
                <div>Documento</div>
                <div>Vencimento</div>
                <div>Status</div>
                <div style={{ textAlign: "right" }}>Valor</div>
                <div />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              {grupos.map(g => {
                const oculto = fechado(g);
                return (
                  <div key={g.chave} style={{ border: "1px solid rgba(38,36,33,0.12)", borderRadius: 12, overflow: "hidden" }}>
                    <button type="button" onClick={() => alternarGrupo(g)}
                      style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap",
                        background: "#fafafa", border: "none", borderBottom: oculto ? "none" : "1px solid rgba(38,36,33,0.10)",
                        padding: "10px 12px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                        <span style={{ display: "inline-block", width: 12, color: "#6b7280", fontSize: 10 }}>{oculto ? "▶" : "▼"}</span>
                        {g.titulo}
                      </span>
                      <span style={{ fontSize: 12, color: "#4b5563", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span>
                          {g.itens.length} {g.itens.length === 1 ? "conta" : "contas"}
                          {g.totais.aberto > 0 ? ` · ${fmtMoedaCtr(g.totais.aberto)} em aberto` : " · tudo pago"}
                          {g.totais.vencido > 0 ? ` · ${fmtMoedaCtr(g.totais.vencido)} vencido` : ""}
                        </span>
                        {/* Só onde a folha faz sentido: por fornecedor ou por
                            contrato. Agrupado por mês, "os comprovantes de
                            março" não é um documento que se entregue a
                            alguém. */}
                        {visaoUsaAnel(visaoContas) && g.itens.some(c => c.pago) && (
                          <span role="button" tabIndex={0}
                            onClick={e => { e.stopPropagation(); setFolhaComprov({ titulo: g.titulo, contas: g.itens }); }}
                            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setFolhaComprov({ titulo: g.titulo, contas: g.itens }); } }}
                            style={{ border: "1px solid rgba(38,36,33,0.16)", borderRadius: 20, padding: "3px 10px",
                              fontSize: 11.5, color: "#111827", background: "#fff", cursor: "pointer" }}>
                            Comprovantes (PDF)
                          </span>
                        )}
                      </span>
                    </button>
                    {!oculto && (
                      <div>
                        {g.itens.map(c => {
                          const st = SITUACAO_CONTA[situacaoConta(c, hojeIso)] || SITUACAO_CONTA.aberto;
                          const detalhe = detalheConta(c);
                          const aberta = !!contasAbertas[c.id];
                          const umaLinha = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
                          const apoio = [apoioCurtoConta(c), nomeConta(c.contaId)].filter(Boolean).join(" · ");
                          const dataBR = (iso) => iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR") : "";
                          return (
                            <div key={c.id} style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, alignItems: "center",
                              padding: "9px 11px", borderTop: "1px solid rgba(38,36,33,0.06)", background: "#fff" }}>
                              <div data-vk-mantem-mes="1" style={{ minWidth: 0, cursor: "pointer" }}
                                title={aberta ? "Fechar detalhes" : "Ver detalhes"}
                                onClick={() => setContasAbertas({ ...contasAbertas, [c.id]: !aberta })}>
                                <div style={{ fontSize: 13, color: "#111827", fontWeight: 600, ...umaLinha }}>
                                  <span style={{ color: "#6b7280", fontWeight: 400, marginRight: 4 }}>{aberta ? "▾" : "▸"}</span>
                                  {tituloCurtoConta(c)}
                                  {c.estimada ? <span style={{ fontWeight: 400, color: "#6b7280" }}> · estimada</span> : null}
                                </div>
                                <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 2, ...umaLinha }}>
                                  {apoio || detalhe || "—"}
                                </div>
                                {aberta && (
                                  <div style={{ marginTop: 8, marginBottom: 2, paddingLeft: 12, borderLeft: "2px solid rgba(38,36,33,0.10)", display: "flex", flexDirection: "column", gap: 4 }}>
                                    {detalhe && <div style={{ fontSize: 12, color: "#4b5563", whiteSpace: "pre-wrap" }}>{detalhe}</div>}
                                    {[["Conta", nomeConta(c.contaId)],
                                      ["Favorecido", c.favorecido || (c.prestadorId ? nomePrestador(c.prestadorId) : "")],
                                      ["Serviço", c.servico],
                                      ["Origem", c.origem === "contrato" ? "Parcela de contrato" : "Conta avulsa"],
                                      ["Vencimento", c.vencimento ? `${dataBR(c.vencimento)}${c.estimada ? " (prevista)" : ""}` : "a definir"],
                                      ["Contabilizado em", c.pago ? dataBR(c.pagoEm) : ""],
                                      ["Registrado em", c.pago ? dataBR(c.contabilizadoEm) : ""],
                                      ["Valor pago", c.pago ? fmtMoedaCtr(Number(c.valorPago) || Number(c.valor) || 0) : ""],
                                      ["Observação", c.observacao]].filter(([, v]) => v).map(([rot, v]) => (
                                        <div key={rot} style={{ fontSize: 11.5, color: "#4b5563" }}>
                                          <span style={{ color: "#6b7280" }}>{rot}: </span><span style={{ color: "#111827" }}>{v}</span>
                                        </div>
                                      ))}
                                  </div>
                                )}
                              </div>
                              <div style={{ fontSize: 12.5, color: "#111827" }}>
                                {c.vencimento ? new Date(c.vencimento + "T12:00:00").toLocaleDateString("pt-BR") : "a definir"}
                                {c.estimada && c.vencimento ? <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>prevista</div> : null}
                              </div>
                              <div style={{ fontSize: 12, color: st.forte ? "#111827" : "#4b5563", fontWeight: st.forte ? 700 : 500 }}>{st.label}</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", textAlign: isMobile ? "left" : "right" }}>{fmtMoedaCtr(c.pago ? (Number(c.valorPago) || c.valor) : c.valor)}</div>
                              {perm.podeEditar ? (
                                <div data-vk-mantem-mes="1" onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 6, justifyContent: isMobile ? "flex-start" : "flex-end" }}>
                                  <button onClick={() => alternarPagamento(c)} style={{ ...C.btnSec, fontSize: 12, padding: "6px 12px" }}>{c.pago ? "Desfazer" : "Pagar"}</button>
                                  {c.origem === "avulsa" && <button onClick={() => setFormConta(c)} style={{ ...C.btnSec, fontSize: 12, padding: "6px 12px" }}>Editar</button>}
                                  {c.origem === "avulsa" && (
                                    <button onClick={() => { dialogo.confirmar({ titulo: "Remover conta?", mensagem: "Esta ação não pode ser desfeita.", confirmar: "Remover", destrutivo: true }).then(ok => { if (ok) gravarContas(contasDaObra.filter(x => x.id !== c.id)); }); }}
                                      style={{ ...C.btnGhost, color: "#dc2626", fontSize: 12 }}>Remover</button>
                                  )}
                                </div>
                              ) : <div />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
        <div style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 12, padding: "12px 14px", marginTop: 16, background: "#fafafa", fontSize: 12.5, color: "#4b5563", lineHeight: 1.55 }}>
          As parcelas vêm dos contratos salvos e se atualizam quando o contrato muda — o que já foi pago fica como está. O que é pago entra no realizado da obra, ao lado da estimativa do Planejamento.
        </div>
      </div>
    );
  }

  // A cotação escolhida abre o gerador de contrato já preenchido: ofício
  // vindo da conta do P&L, contratado e valor da proposta vencedora, e o que
  // foi cotado no escopo. Prazo, parcelas e cláusulas seguem sendo do
  // formulário do contrato. Mora aqui porque dois lugares chamam: o cartão
  // da cotação e a lista de cotações aprovadas dentro de Contratos.
  function abrirContratoDaCotacao(dados) {
    if (!dados || !obraAtual) return;
    const novo = {
      ...contratoVazio("empreitadaMaoDeObra", cliente.id, obraAtual.id, dados.tipoId),
      cotacaoId: dados.cotacaoId,
      prestadorId: dados.prestadorId,
      nomeContratado: dados.nomeContratado,
      valor: dados.valor,
    };
    if (dados.escopo || dados.titulo) {
      novo.escopo = [{ titulo: dados.titulo || "Escopo cotado", texto: dados.escopo || "" }];
    }
    setContratoSalvoEm(0);
    setContratoGerando(novo);
    setView("gerarContrato");
  }

  if (view === "contratosDaObra" && obraSelecionada) {
    const contratosDaObra = contratos.filter(c => c.obraId === obraSelecionada.id);
    // O contrato nasce da cotação aprovada, e é aqui que se geram contratos —
    // então a fila de aprovadas fica à vista, sem ter que voltar em Cotações.
    const prontas = perm.podeGerenciarObra
      ? cotacoesProntasParaContrato(obraAtual.cotacoes || [], obraAtual.aprovacoesCotacao || [], contratos)
      : [];
    return (
      <div data-vk-ui="1" style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
        <button onClick={() => setView("detalheObra")} style={{ ...C.btnGhost, marginBottom: 16, fontSize: 12 }}>← Voltar</button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Contratos</div>
            <div style={{ fontSize: 12.5, color: "#4b5563", marginTop: 2 }}>{obraSelecionada.nome}</div>
          </div>
        </div>

        {prontas.length > 0 && (
          <div style={{ border: "1px solid rgba(4,116,244,0.22)", background: "#eef5ff", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827", marginBottom: 2 }}>
              {prontas.length === 1 ? "1 cotação aprovada, pronta para virar contrato" : `${prontas.length} cotações aprovadas, prontas para virar contrato`}
            </div>
            <div style={{ fontSize: 11.5, color: "#4b5563", marginBottom: 10 }}>
              O contrato já abre preenchido com o fornecedor e o valor da proposta escolhida.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {prontas.map(cot => {
                const dados = dadosDoContratoDaCotacao(cot);
                if (!dados) return null;
                return (
                  <div key={cot.id} style={{ background: "#fff", border: "1px solid rgba(38,36,33,0.12)", borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#111827" }}>{cot.titulo || "Cotação sem nome"}</div>
                      <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 1 }}>
                        {dados.nomeContratado || "Sem fornecedor"} · {fmtMoedaCtr(dados.valor)}
                      </div>
                    </div>
                    <button onClick={() => abrirContratoDaCotacao(dados)} style={{ ...C.btn, fontSize: 12, padding: "7px 14px" }}>Gerar contrato</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {contratosDaObra.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "#4b5563", fontSize: 12.5, border: "1px dashed rgba(38,36,33,0.18)", borderRadius: 9, background: "#fafafa" }}>
            Nenhum contrato nesta obra. {perm.podeGerenciarObra && <button onClick={() => { setContratoGerando(contratoVazio("empreitadaMaoDeObra", cliente.id, obraSelecionada.id)); setView("gerarContrato"); }} style={{ background: "transparent", border: "none", color: AZUL_VK, cursor: "pointer", padding: 0, fontSize: 12.5, fontFamily: "inherit", textDecoration: "underline" }}>Gerar o primeiro contrato</button>}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {contratosDaObra.map(contrato => {
              const sts = statusContrato[contrato.status] || statusContrato.ativo;
              return (
                <div key={contrato.id} style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 12, padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                      {contrato.numeroContrato ? <span style={{ color: "#4b5563", fontWeight: 500 }}>{`Contrato ${contrato.numeroContrato} · `}</span> : null}
                      {contrato.nomeContratado}
                    </div>
                    <div style={{ fontSize: 11, color: "#4b5563", marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "#111827", fontWeight: 600 }}>{sts.label}</span>
                      {tipoProfissional(contrato.tipoProfissional) && <span>{tipoProfissional(contrato.tipoProfissional).nome}</span>}
                      {contrato.valor && <span>R$ {parseFloat(contrato.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                      {contrato.dataVencimento && <span>Vence: {new Date(contrato.dataVencimento).toLocaleDateString("pt-BR")}</span>}
                    </div>
                    {contrato.descricaoServico && <div style={{ fontSize: 11, color: "#4b5563", marginTop: 6 }}>{contrato.descricaoServico}</div>}
                    {aceiteDoContrato(contrato.id) && (
                      <div style={{ fontSize: 11.5, color: AZUL_VK, marginTop: 6, fontWeight: 600 }}>
                        Aceite de {textoUtf8Recuperado(aceiteDoContrato(contrato.id).por)} em {new Date(aceiteDoContrato(contrato.id).em).toLocaleDateString("pt-BR")}
                      </div>
                    )}
                  </div>
                  {(perm.podeGerenciarObra || contrato.gerado) && (
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {contrato.gerado && <button onClick={() => { setContratoAberto(contrato); setView("verContrato"); }} style={{ ...C.btnSec, fontSize: 12, padding: "6px 12px" }}>Abrir</button>}
                      {perm.podeGerenciarObra && <button onClick={() => { if (contrato.gerado) { setContratoSalvoEm(0); setContratoGerando(contrato); setView("gerarContrato"); } else setFormContrato(contrato); }} style={{ ...C.btnSec, fontSize: 12, padding: "6px 12px" }}>Editar</button>}
                      {perm.podeGerenciarObra && <button onClick={() => { dialogo.confirmar({ titulo: "Remover contrato?", mensagem: "Esta ação não pode ser desfeita.", confirmar: "Remover", destrutivo: true }).then(ok => { if (ok) {
                        const restantes = contratos.filter(c => c.id !== contrato.id);
                        save({ ...data,
                          obras: mesclarPorCliente(data.obras, cliente.id,
                            contratosNasObras(obras, restantes, cliente.id, obraSelecionada.id)
                              .map(o => o.id === obraSelecionada.id ? { ...o, contasPagar: removerContasDoContrato(contasDaObra, contrato.id) } : o)),
                          contratos: (data.contratos || []).filter(c => c.clienteId !== cliente.id) });
                      } }); }} style={{ ...C.btnGhost, color: "#dc2626", fontSize: 12 }}>Remover</button>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {perm.podeGerenciarObra && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <button style={{ ...C.btn, flex: 1, minWidth: 200 }} onClick={() => { setContratoSalvoEm(0); setContratoGerando(contratoVazio("empreitadaMaoDeObra", cliente.id, obraSelecionada.id, "")); setView("gerarContrato"); }}>📄 Gerar contrato</button>
            <button style={{ ...C.btnSec, flex: 1, minWidth: 160 }} onClick={() => { setFormContrato({ id: uid(), clienteId: cliente.id, obraId: obraSelecionada.id, nomeContratado: "", descricaoServico: "", valor: "", dataAssinatura: "", dataVencimento: "", status: "ativo", observacoes: "" }); setView("formContrato"); }}>+ Só registrar contrato</button>
          </div>
        )}
      </div>
    );
  }

  if (view === "orcamentoObra" && obraSelecionada) {
    return (
      <OrcamentoObraView
        obra={obraSelecionada}
        obras={obras}
        data={data}
        save={save}
        onObraAtualizada={setObraSelecionada}
        isMobile={isMobile}
        onVoltar={() => setView("detalheObra")}
      />
    );
  }

  if (view === "cotacoesObra" && obraSelecionada) {
    return (
      <CotacoesObraView
        obra={obraAtual}
        obras={obras}
        data={data}
        save={save}
        onObraAtualizada={setObraSelecionada}
        isMobile={isMobile}
        usuario={perm.usuario}
        onVoltar={() => setView("detalheObra")}
        onGerarContrato={abrirContratoDaCotacao}
      />
    );
  }

  if (view === "cronogramaObra" && obraSelecionada) {
    return (
      <CronogramaObraView
        obra={obraSelecionada}
        obras={obras}
        data={data}
        save={save}
        onObraAtualizada={setObraSelecionada}
        isMobile={isMobile}
        onVoltar={() => setView("detalheObra")}
        onIrParaOrcamento={() => setView("orcamentoObra")}
      />
    );
  }

  if (view === "detalheObra" && obraSelecionada) {
    return (
      <div data-vk-ui="1" style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
        <button onClick={() => { if (onSairDaObra) { onSairDaObra(); return; } setView("lista"); setObraSelecionada(null); }} style={{ ...C.btnGhost, marginBottom: 16, fontSize: 12 }}>← Voltar</button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{obraSelecionada.nome}</div>
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>{obraSelecionada.responsavel || "Sem responsável"}</div>
          </div>
          {perm.podeGerenciarObra && (
            <button onClick={() => editarObra(obraSelecionada)} style={{ ...C.btnSec, fontSize: 12, padding: "6px 12px" }}>Editar</button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
          <button onClick={() => setView("orcamentoObra")}
            style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "20px", background: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transition: "all 0.2s ease", fontFamily: "inherit" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", textAlign: "center" }}>Orçamento</div>
            <div style={{ fontSize: 11, color: "#4b5563", textAlign: "center" }}>Quantitativos da obra</div>
          </button>
          <button onClick={() => setView("planejamento")}
            style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "20px", background: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transition: "all 0.2s ease", fontFamily: "inherit" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", textAlign: "center" }}>Planejamento</div>
            <div style={{ fontSize: 11, color: "#4b5563", textAlign: "center" }}>P&L estimado da obra</div>
          </button>
          <button onClick={() => setView("contratosDaObra")}
            style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "20px", background: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transition: "all 0.2s ease", fontFamily: "inherit" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", textAlign: "center" }}>Contratos</div>
            <div style={{ fontSize: 11, color: "#4b5563", textAlign: "center" }}>Gerenciar contratos</div>
          </button>
          <button onClick={() => setView("cronogramaObra")}
            style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "20px", background: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transition: "all 0.2s ease", fontFamily: "inherit" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", textAlign: "center" }}>Cronograma</div>
            <div style={{ fontSize: 11, color: "#4b5563", textAlign: "center" }}>{obraAtual.cronograma?.prazoMeses ? `${obraAtual.cronograma.prazoMeses} meses` : "Prazo, etapas e equipe"}</div>
          </button>
          <button onClick={() => setView("contasPagar")}
            style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "20px", background: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transition: "all 0.2s ease", fontFamily: "inherit" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", textAlign: "center" }}>Contas a pagar</div>
            <div style={{ fontSize: 11, color: "#4b5563", textAlign: "center" }}>
              {(() => { const t = totaisContas((obraAtual.contasPagar || []), hojeIso);
                return t.aberto > 0 ? `${fmtMoedaCtr(t.aberto)} em aberto` : "Parcelas dos contratos"; })()}
            </div>
          </button>
          <button onClick={() => setView("cotacoesObra")}
            style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "20px", background: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transition: "all 0.2s ease", fontFamily: "inherit" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", textAlign: "center" }}>Cotações</div>
            <div style={{ fontSize: 11, color: "#4b5563", textAlign: "center" }}>
              {(() => {
                const r = resumoCotacoes(obraAtual.cotacoes || [], obraAtual.aprovacoesCotacao || []);
                if (!r.total) return "Comparar preços de fornecedores";
                // a frase é sempre a próxima ação de quem está olhando
                if (perm.podeGerenciarObra && r.aEnviar) return r.aEnviar === 1 ? "1 escolha para enviar ao cliente" : `${r.aEnviar} escolhas para enviar ao cliente`;
                if (perm.podeGerenciarObra && r.aprovadas) return r.aprovadas === 1 ? "1 pronta para virar contrato" : `${r.aprovadas} prontas para virar contrato`;
                if (r.aguardandoCliente) return `${r.aguardandoCliente} aguardando ${perm.podeGerenciarObra ? "o cliente" : "você"}`;
                if (r.abertas) return r.abertas === 1 ? "1 em andamento" : `${r.abertas} em andamento`;
                return r.total === 1 ? "1 cotação" : `${r.total} cotações`;
              })()}
            </div>
          </button>
          <button onClick={() => { dialogo.alertar({ titulo: "Em breve", mensagem: "Documentos será implementado em breve.", tipo: "aviso" }); }}
            style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "20px", background: "#fafafa", cursor: "not-allowed", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#4b5563", textAlign: "center" }}>Documentos</div>
            <div style={{ fontSize: 11, color: "#4b5563", textAlign: "center" }}>Em breve</div>
          </button>
        </div>

        {/* Info da obra */}
        {(obraSelecionada.status || obraSelecionada.dataInicio || obraSelecionada.descricao) && (
          <div style={{ background: "#fafafa", border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 14 }}>
              {obraSelecionada.status && (
                <div>
                  <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Status</div>
                  <span style={{ fontSize: 13, color: "#111827", fontWeight: 600 }}>{statusObra[obraSelecionada.status]?.label || obraSelecionada.status}</span>
                </div>
              )}
              {obraSelecionada.dataInicio && (
                <div>
                  <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Data de início</div>
                  <div style={{ fontSize: 13, color: "#111827" }}>{new Date(obraSelecionada.dataInicio).toLocaleDateString("pt-BR")}</div>
                </div>
              )}
              {obraSelecionada.dataFim && (
                <div>
                  <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Data de conclusão</div>
                  <div style={{ fontSize: 13, color: "#111827" }}>{new Date(obraSelecionada.dataFim).toLocaleDateString("pt-BR")}</div>
                </div>
              )}
            </div>
            {obraSelecionada.descricao && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1.5px solid rgba(38,36,33,0.16)" }}>
                <div style={{ fontSize: 11, color: "#4b5563", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Descrição</div>
                <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.5 }}>{obraSelecionada.descricao}</div>
              </div>
            )}
          </div>
        )}

        {perm.podeGerenciarObra && (
          <button style={{ ...C.btnGhost, color: "#dc2626", fontSize: 12, width: "100%" }} onClick={() => { dialogo.confirmar({ titulo: "Remover obra?", mensagem: "Esta ação não pode ser desfeita.", confirmar: "Remover", destrutivo: true }).then(ok => { if (ok) deletarObra(obraSelecionada.id); }); }}>Remover esta obra</button>
        )}
      </div>
    );
  }

  // Lista de obras — view padrão. Mesmo formato da lista de clientes:
  // cartão branco com iniciais, nome, uma linha de apoio e as ações à
  // direita; cabeçalho e botão como os do painel de Projetos.
  const iniciaisObra = (nome) => String(nome || "?").split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase();
  const apoioObra = (obra) => {
    const o = obras.find(x => x.id === obra.id) || obra;
    const cidade = o.enderecoProprio ? [o.cidade, o.estado].filter(Boolean).join("/") : "";
    const qtdCtr = (o.contratos || []).length;
    return [cidade, o.responsavel, qtdCtr ? `${qtdCtr} contrato${qtdCtr !== 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ") || "Sem contratos";
  };
  return (
    <div data-vk-ui="1" style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Obras</div>
          <div style={{ fontSize: 12, color: "#4b5563" }}>{obras.length} obra{obras.length !== 1 ? "s" : ""}</div>
        </div>
        {perm.podeGerenciarObra && <button style={C.btn} onClick={novaObra}>+ Nova obra</button>}
      </div>

      {obras.length === 0 ? (
        <div style={{ padding: "20px", textAlign: "center", color: "#4b5563", fontSize: 12.5, border: "1px dashed rgba(38,36,33,0.18)", borderRadius: 9, background: "#fafafa" }}>
          Nenhuma obra cadastrada.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {obras.map(obra => {
            const sts = statusObra[obra.status] || statusObra.planejamento;
            return (
              <div key={obra.id}
                onClick={() => { setObraSelecionada(obra); setView("detalheObra"); }}
                style={{ background: "#fff", border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = AZUL_VK; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(4,116,244,0.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(38,36,33,0.14)"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ width: 40, height: 40, borderRadius: 14, background: "#f3f4f6", color: "#111827", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{iniciaisObra(obra.nome)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{obra.nome}</div>
                  <div style={{ fontSize: 12, color: "#4b5563" }}>{apoioObra(obra)}</div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }} onClick={e => e.stopPropagation()}>
                  <span style={{ fontSize: 12, color: "#111827", fontWeight: 600 }}>{sts.label}</span>
                  {perm.podeGerenciarObra && (
                    <button onClick={() => editarObra(obra)}
                      style={{ fontSize: 12, color: "#4b5563", background: "none", border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>Editar</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Área do cliente ──────────────────────────────────────────────
// O que o cliente final vê ao entrar: as obras dele, com o mesmo painel de
// gestão que o escritório usa — contas a pagar, extrato, contratos e
// cronograma. As ações de escritório ficam escondidas (perm.podeGerenciarObra
// é falso para ele), e o backend recusa qualquer coisa fora da obra dele.
function AreaCliente({ data, save, usuario, onLogout, isMobile }) {
  const perm = getPermissoes();
  const cliente = (data.clientes || []).find(c => c.id === perm.clienteId) || (data.clientes || [])[0] || null;
  const obras = (data.obras || []).filter(o => cliente && o.clienteId === cliente.id);
  const escritorio = data.escritorio || {};

  if (!cliente) {
    return (
      <div style={{ minHeight: "100vh", background: "#fafafb", fontFamily: "'Inter', system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Acesso sem obra vinculada</div>
          <div style={{ fontSize: 13, color: "#4b5563" }}>Fale com {escritorio.nome || "o escritório"} para liberar o acompanhamento da sua obra.</div>
          <button onClick={onLogout} style={{ ...C.btnSec, marginTop: 16 }}>Sair</button>
        </div>
      </div>
    );
  }

  return (
    <div data-vk-ui="1" style={{ minHeight: "100vh", background: "#fafafb", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid rgba(38,36,33,0.10)", padding: isMobile ? "12px 16px" : "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{cliente.nome}</div>
          <div style={{ fontSize: 12, color: "#4b5563" }}>
            Acompanhamento da obra{obras.length === 1 ? "" : "s"}{escritorio.nome ? ` · ${escritorio.nome}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "#4b5563" }}>{usuario?.nome || usuario?.email || ""}</span>
          <button onClick={onLogout} style={{ ...C.btnSec, fontSize: 12, padding: "6px 14px" }}>Sair</button>
        </div>
      </div>
      <div style={{ padding: isMobile ? "16px" : "24px 28px", maxWidth: 1100, margin: "0 auto" }}>
        <GestaoObraPanel cliente={cliente} data={data} save={save} isMobile={isMobile} />
      </div>
      <div style={{ padding: isMobile ? "0 16px 24px" : "0 28px 32px", maxWidth: 1100, margin: "0 auto", fontSize: 11.5, color: "#6b7280" }}>
        Dúvida sobre um lançamento? Fale com {escritorio.nome || "o escritório"}.
      </div>
    </div>
  );
}
