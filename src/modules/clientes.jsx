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
  // Botao de acao de uma linha da lista: pequeno, para nao competir com o
  // que a linha diz. O que nao e de todo dia mora no menu "···" ao lado.
  btnLinha: { background:"#fff", color:"#111827", border:"1.5px solid rgba(38,36,33,0.16)", borderRadius:10, padding:"6px 12px", fontSize:12, height:30, cursor:"pointer", fontFamily:"inherit", flexShrink:0 },
  btnLinhaToque: { background:"#fff", color:"#111827", border:"1.5px solid rgba(38,36,33,0.16)", borderRadius:10, padding:"0 16px", fontSize:13.5, height:44, cursor:"pointer", fontFamily:"inherit", flexShrink:0 },
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

// ── Visita: entrar como o cliente, e voltar ─────────────────────
// O token de visita vem assinado pelo servidor (2 h, só para admin do
// escritório dono do cliente). Enquanto ela dura, o login do escritório fica
// guardado à parte para a volta ser um clique — e o recarregamento é de
// propósito: o app inteiro relê o perfil do zero, sem sobra do estado antigo.
const VISITA_TOKEN = "vicke-visita-token";
const VISITA_USER  = "vicke-visita-user";

function guardarLoginDoEscritorio() {
  try {
    const t = localStorage.getItem("vicke-token"), u = localStorage.getItem("vicke-user");
    if (t) localStorage.setItem(VISITA_TOKEN, t);
    if (u) localStorage.setItem(VISITA_USER, u);
  } catch (e) { /* navegador sem storage: a volta será pelo login */ }
}

function entrarComoCliente(resposta) {
  guardarLoginDoEscritorio();
  localStorage.setItem("vicke-token", resposta.token);
  localStorage.setItem("vicke-user", JSON.stringify(resposta.usuario));
  window.location.href = "/";
}

function temVoltaDaVisita() {
  try { return !!localStorage.getItem(VISITA_TOKEN); } catch (e) { return false; }
}

function voltarDaVisita() {
  try {
    const t = localStorage.getItem(VISITA_TOKEN), u = localStorage.getItem(VISITA_USER);
    localStorage.removeItem(VISITA_TOKEN); localStorage.removeItem(VISITA_USER);
    if (t) localStorage.setItem("vicke-token", t); else localStorage.removeItem("vicke-token");
    if (u) localStorage.setItem("vicke-user", u); else localStorage.removeItem("vicke-user");
  } catch (e) { /* sem storage, cai no login */ }
  window.location.href = "/";
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
  const entrar = () => rodar(() => api.clientes.acesso.entrar(cliente.id).then(entrarComoCliente));

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
            <button style={btn} disabled={ocupado || !acesso.ativo} onClick={entrar}
              title={acesso.ativo ? "Abre o ambiente do cliente com os dados dele, sem senha" : "Reative o acesso para poder entrar"}>
              Entrar como o cliente
            </button>
            <button style={btnSec} disabled={ocupado} onClick={resetar}>Gerar nova senha</button>
            <button style={btnSec} disabled={ocupado} onClick={alternar}>{acesso.ativo ? "Desativar acesso" : "Reativar acesso"}</button>
          </div>
          <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 8 }}>
            Entrar como o cliente abre o ambiente dele exatamente como ele vê, sem precisar da senha — e continua funcionando depois que ele trocar a senha.
            A visita dura 2 horas, fica registrada no histórico e não conta como acesso dele.
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
        <Selecao value={colunaAtual} onChange={e=>onMoverColuna(e.target.value)} style={inputSel}>
          {COLUNAS.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}
        </Selecao>
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
      // Quem volta do orçamento veio da aba Projetos — é lá que o projeto
      // recém-gerado aparece, com a proposta. Cair no Cadastro obrigava a
      // procurar o caminho de novo.
      setAbaCliente("projetos");
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
    servicos:{ projeto:false, acompanhamentoObra:false, gestaoObra:false, empreendimento:false },
    // Só preenchido quando o cadastro é de empreendimento — é o imóvel.
    empreendimento:{ tipo:"Residencial", implantacao:"Horizontal", unidades:"", area:"", padrao:"Médio", matricula:"" }
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
    const souEmp = !!(form.servicos || {}).empreendimento;
    if (!form.nome?.trim()) {
      dialogo.alertar({ titulo: souEmp ? "Informe o nome do empreendimento" : "Informe o nome do cliente", tipo: "aviso" });
      return;
    }
    const ehNovo = !form.id;
    const clienteFinal = ehNovo ? { ...form, id: uid() } : form;
    const novos = ehNovo
      ? [...data.clientes, clienteFinal]
      : data.clientes.map(c => c.id === form.id ? clienteFinal : c);

    // Empreendimento já nasce com a obra. Não existe empreendimento sem obra:
    // é o escritório construindo para vender, e é na obra que o custo mora.
    // Só cria se ainda não houver nenhuma — editar o cadastro não duplica.
    const jaTemObra = (data.obras || []).some(o => o && o.clienteId === clienteFinal.id);
    const obras = (souEmp && !jaTemObra)
      ? [...(data.obras || []), {
          id: uid(), clienteId: clienteFinal.id, nome: clienteFinal.nome,
          status: "planejamento", dataInicio: clienteFinal.desde || "", dataFim: "",
          responsavel: "", descricao: "Obra do empreendimento, criada junto com o cadastro.",
          ativo: true, clientePagaDireto: false, enderecoProprio: false,
          cep: clienteFinal.cep || "", logradouro: clienteFinal.logradouro || "",
          numero: clienteFinal.numero || "", complemento: clienteFinal.complemento || "",
          bairro: clienteFinal.bairro || "", cidade: clienteFinal.cidade || "",
          estado: clienteFinal.estado || "",
        }]
      : (data.obras || []);

    save({ ...data, clientes: novos, obras });
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
            <Selecao
              value={colunaDoCliente(c)}
              onChange={e => { e.stopPropagation(); moverCliente(c.id, e.target.value); }}
              onClick={e => e.stopPropagation()}
              style={{ fontSize:11, color:"#4b5563", background:"#fff", border:"1.5px solid rgba(38,36,33,0.16)", borderRadius:5, padding:"4px 6px", cursor:"pointer", fontFamily:"inherit" }}>
              {COLUNAS.map(col => <option key={col.key} value={col.key}>{col.label}</option>)}
            </Selecao>
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
          <ProjetosPanel cliente={cliente} data={data} save={save} onAbrirOrcamento={(c, orc, modo) => { setAbrindoOrcamento(true); onAbrirOrcamento(c, orc, modo); }} />
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
  // Cliente final ou empreendimento: o mesmo cadastro, perguntas diferentes.
  const ehEmp = !!(form.servicos || {}).empreendimento;
  const emp = { tipo:"Residencial", implantacao:"Horizontal", unidades:"", area:"", padrao:"Médio", matricula:"", ...(form.empreendimento || {}) };
  const setEmp = (k, v) => setForm({ ...form, empreendimento: { ...emp, [k]: v } });
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
        <div style={{ fontFamily:"'Inter', system-ui, sans-serif", fontSize:24, fontWeight:800, letterSpacing:"-0.02em", color:VK.grafite, margin:"0 0 8px" }}>{form.id ? (ehEmp ? "Editar empreendimento" : "Editar cliente") : (ehEmp ? "Novo empreendimento" : "Novo cliente")}</div>
        {/* Cliente final ou empreendimento do escritório. Não é um detalhe do
            cadastro: muda o que se pergunta. Cliente tem CPF, representante e
            contatos; empreendimento é um imóvel — tipo, unidades, metragem,
            padrão e matrícula. O financeiro lê este mesmo tique para saber que
            o dinheiro dele é investimento, não resultado do mês. */}
        <div style={{ marginBottom:16, marginTop:20 }}>
          <div style={FC.secTit}>O que é este cadastro</div>
          <div style={{ display:"flex", gap:8 }}>
            {[[false,"Cliente final"],[true,"Empreendimento"]].map(([v,l])=>(
              <button key={String(v)} className={"vk-fc-tipo" + (ehEmp===v ? " ativo" : "")}
                onClick={()=>setForm({...form, servicos:{...(form.servicos||{}), empreendimento:v}})}
                style={{ border:"1.5px solid rgba(38,36,33,0.14)", borderRadius:10, height:42, padding:"0 18px", fontSize:13.5, fontWeight:600, background:"#fff", color:VK.grafite, cursor:"pointer", fontFamily:"'Inter', system-ui, sans-serif" }}>{l}</button>
            ))}
          </div>
          {ehEmp && (
            <div style={{ fontSize:11.5, color:"#4b5563", marginTop:8 }}>
              Construção para venda. O investimento não entra no resultado do mês; o lucro aparece quando vende.
            </div>
          )}
        </div>
        {/* ── Empreendimento: o cadastro é do imóvel ─────────────── */}
        {ehEmp && (
          <>
            <hr style={FC.divider} />
            <div style={{ marginBottom:16 }}>
              <div style={FC.secTit}>Dados principais</div>
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap:12, marginBottom:12 }}>
                <div><label style={FC.label}>Nome do empreendimento</label><input className="vk-fc-input" style={FC.input} value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} placeholder="ex.: Residencial Jardim Europa" /></div>
                <div><label style={FC.label}>Matrícula</label><input className="vk-fc-input" style={FC.input} value={emp.matricula} onChange={e=>setEmp("matricula",e.target.value)} placeholder="nº da matrícula" /></div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap:12, marginBottom:12 }}>
                <div>
                  <label style={FC.label}>Tipo</label>
                  <Selecao className="vk-fc-input" style={{...FC.input,cursor:"pointer"}} value={emp.tipo} onChange={e=>setEmp("tipo",e.target.value)}>
                    {["Residencial","Comercial","Misto"].map(v=><option key={v}>{v}</option>)}
                  </Selecao>
                </div>
                <div>
                  <label style={FC.label}>Implantação</label>
                  <Selecao className="vk-fc-input" style={{...FC.input,cursor:"pointer"}} value={emp.implantacao} onChange={e=>setEmp("implantacao",e.target.value)}>
                    {["Horizontal","Vertical"].map(v=><option key={v}>{v}</option>)}
                  </Selecao>
                </div>
                <div><label style={FC.label}>Unidades</label><input className="vk-fc-input" style={FC.input} inputMode="numeric" value={emp.unidades} onChange={e=>setEmp("unidades",e.target.value)} placeholder="quantas" /></div>
                <div><label style={FC.label}>Metragem (m²)</label><input className="vk-fc-input" style={FC.input} inputMode="decimal" value={emp.area} onChange={e=>setEmp("area",e.target.value)} placeholder="área construída" /></div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:12, marginBottom:12 }}>
                <div>
                  <label style={FC.label}>Padrão</label>
                  <Selecao className="vk-fc-input" style={{...FC.input,cursor:"pointer"}} value={emp.padrao} onChange={e=>setEmp("padrao",e.target.value)}>
                    {["MCMV","Médio","Alto"].map(v=><option key={v}>{v}</option>)}
                  </Selecao>
                </div>
                <div><label style={FC.label}>Início</label><input className="vk-fc-input" style={FC.input} type="date" value={form.desde} onChange={e=>setForm({...form,desde:e.target.value})} /></div>
              </div>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:VK.inkSoft}}>
                <input className="vk-fc-check" type="checkbox" checked={form.ativo} onChange={e=>setForm({...form,ativo:e.target.checked})} /> Em andamento
              </label>
            </div>
          </>
        )}
        {!ehEmp && (
        <div style={{ marginBottom:16 }}>
          <div style={FC.secTit}>Tipo de pessoa</div>
          <div style={{ display:"flex", gap:8 }}>
            {[["PF","Pessoa física"],["PJ","Pessoa jurídica"]].map(([v,l])=>(
              <button key={v} className={"vk-fc-tipo" + (form.tipo===v ? " ativo" : "")} onClick={()=>setForm({...form,tipo:v})}
                style={{ border:"1.5px solid rgba(38,36,33,0.14)", borderRadius:10, height:42, padding:"0 18px", fontSize:13.5, fontWeight:600, background:"#fff", color:VK.grafite, cursor:"pointer", fontFamily:"'Inter', system-ui, sans-serif" }}>{l}</button>
            ))}
          </div>
        </div>
        )}
        {!ehEmp && <hr style={FC.divider} />}
        {!ehEmp && (
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
        )}
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
          <div style={{maxWidth:120}}><label style={FC.label}>Estado</label><Selecao className="vk-fc-input" style={{...FC.input,cursor:"pointer"}} value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>{ESTADOS_BR.map(e=><option key={e}>{e}</option>)}</Selecao></div>
        </div>
        {!ehEmp && <hr style={FC.divider} />}
        {!ehEmp && (
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
        )}
        <hr style={FC.divider} />
        <div style={{marginBottom:28}}>
          <div style={FC.secTit}>Observações internas</div>
          <textarea className="vk-fc-input" style={{...FC.input, height:"auto", padding:"12px 14px", resize:"vertical"}} value={form.observacoes} onChange={e=>setForm({...form,observacoes:e.target.value})} rows={3} />
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button style={FC.btnSec} onClick={()=>setView("kanban")}>Cancelar</button>
          <button data-tutorial-id="cliente-salvar" style={FC.btn} onClick={saveCliente}>{form.id ? "Salvar alterações" : (ehEmp ? "Cadastrar empreendimento" : "Cadastrar cliente")}</button>
        </div>
      </div>
    </div>
  );
}

// ── Painel "Projetos" — lista orçamentos/projetos do cliente ─────
// Um projeto com proposta enviada abre a PROPOSTA, não o formulário: quem
// entra aqui quer rever o que foi mandado ao cliente, e reabrir no editor
// dava a impressão de que a proposta tinha sumido. Editar continua a um
// clique, no botão ao lado — e dentro do visualizador.
function ProjetosPanel({ cliente, data, save, onAbrirOrcamento }) {
  const orcamentos = (data.orcamentosProjeto || []).filter(o => o.clienteId === cliente.id);
  const [vendo, setVendo] = useState(null);
  const [ganhando, setGanhando] = useState(null);
  const [ganhoVersao, setGanhoVersao] = useState(null);
  const perm = typeof getPermissoes === "function" ? getPermissoes() : { podeEditar: true, podeExcluir: true };
  const statusOrc = {
    rascunho: { label: "Rascunho", cor: "#9ca3af" },
    aberto:   { label: "Aberto",   cor: "#2563eb" },
    ganho:    { label: "Ganho",    cor: "#10b981" },
    perdido:  { label: "Perdido",  cor: "#dc2626" },
  };
  const fmtBRL = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const acao = (cor) => ({ background: "none", border: "none", padding: 0, cursor: "pointer",
    fontFamily: "inherit", fontSize: 11.5, color: cor || "#6b7280" });
  const ultimaProposta = (o) => (o.propostas && o.propostas.length > 0 ? o.propostas[o.propostas.length - 1] : null);
  // Mesmo valor que a lista de Orçamentos mostra: o da proposta enviada
  // quando existe, senão o do cálculo.
  const valorDoProjeto = (o) => {
    const ult = ultimaProposta(o);
    if (ult) {
      if (ult.valorTotalExibido != null) return Number(ult.valorTotalExibido) || 0;
      const arq = ult.arqEdit != null ? ult.arqEdit : (ult.calculo?.precoArq || 0);
      const eng = ult.engEdit != null ? ult.engEdit : (ult.calculo?.precoEng || 0);
      return (Number(arq) || 0) + (Number(eng) || 0);
    }
    return (o.resultado?.precoArq || 0) + (o.resultado?.precoEng || 0);
  };
  const dataCurta = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
  };

  // Ganho, perdido e excluir: as mesmas ações da lista de Orçamentos, aqui
  // na linha do projeto. Quem acompanha um cliente decide o desfecho olhando
  // para ele, e ter que ir até o outro módulo para isso é caminho a mais.
  const iVerSeguro = (lista, i) => (i >= 0 && i < lista.length ? i : lista.length - 1);
  const gravar = (novos, extra) => save({ ...data, orcamentosProjeto: novos, ...(extra || {}) }).catch(console.error);

  async function marcarPerdido(orc) {
    const todos = data.orcamentosProjeto || [];
    const agora = new Date().toISOString();
    if (orc.status === "perdido") {
      const ok = await dialogo.confirmar({ titulo: "Reabrir este projeto?", confirmar: "Reabrir" });
      if (!ok) return;
      return gravar(todos.map(o => o.id === orc.id ? { ...o, status: "rascunho", concluidoEm: null } : o));
    }
    const ok = await dialogo.confirmar({ titulo: `Marcar ${orc.id} como Perdido?`, confirmar: "Marcar como perdido" });
    if (!ok) return;
    gravar(todos.map(o => o.id === orc.id ? { ...o, status: "perdido", concluidoEm: o.concluidoEm || agora } : o));
  }

  async function excluirProjeto(orc) {
    if (!perm.podeExcluir) {
      dialogo.alertar({ titulo: "Acesso restrito", mensagem: "Apenas administradores podem excluir orçamentos.", tipo: "aviso" });
      return;
    }
    const ok = await dialogo.confirmar({
      titulo: `Excluir orçamento ${orc.id}?`,
      mensagem: "Esta ação não pode ser desfeita.",
      confirmar: "Excluir", destrutivo: true,
    });
    if (!ok) return;
    gravar((data.orcamentosProjeto || []).filter(o => o.id !== orc.id));
  }

  // Ganhar abre o mesmo modal de fechamento da lista de Orçamentos — escopo,
  // valores e condição de pagamento — e, como lá, nasce um projeto na etapa
  // de briefing.
  function confirmarGanho(fechamento) {
    const orc = ganhando;
    if (!orc) return;
    const agora = new Date().toISOString();
    // Fica só a versão que o cliente aceitou; o PDF das outras sai do storage.
    const props = orc.propostas || [];
    const iVer = typeof ganhoVersao === "number" && props[iVerSeguro(props, ganhoVersao)] ? iVerSeguro(props, ganhoVersao) : props.length - 1;
    const fechada = props[iVer] || null;
    if (typeof esquecerArquivoDaProposta === "function") {
      props.forEach((p, i) => { if (i !== iVer) esquecerArquivoDaProposta(p); });
    }
    const projetos = data.projetos || [];
    const novosProjetos = projetos.some(p => p.orcId === orc.id) ? projetos : [...projetos, {
      id: "PRJ-" + Date.now(), orcId: orc.id, clienteId: orc.clienteId,
      tipo: orc.tipo, subtipo: orc.subtipo, padrao: orc.padrao, tamanho: orc.tamanho,
      referencia: orc.referencia || "", areaTotal: orc.resultado?.areaTotal || 0,
      colunaEtapa: "briefing", criadoEm: agora,
    }];
    const novos = (data.orcamentosProjeto || []).map(o => o.id === orc.id ? {
      ...o, status: "ganho", concluidoEm: o.concluidoEm || agora, ganhoEm: o.ganhoEm || agora,
      ...(fechada ? { propostas: [fechada], ultimaPropostaEm: fechada.enviadaEm || o.ultimaPropostaEm } : {}),
      fechamento: { ...fechamento,
        versaoFechada: fechada ? (typeof rotuloDaVersao === "function" ? rotuloDaVersao(props, iVer) : fechada.versao) : "",
        fechadoEm: agora },
    } : o);
    setGanhando(null);
    if (typeof toast !== "undefined" && toast.sucesso) toast.sucesso("Orçamento marcado como ganho");
    gravar(novos, { projetos: novosProjetos });
  }

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
            const prop = ultimaProposta(orc);
            const valor = valorDoProjeto(orc);
            const abrir = (indice) => {
              if (prop) {
                const lista = orc.propostas || [];
                const i = typeof indice === "number" && lista[indice] ? indice : lista.length - 1;
                setVendo({ ...lista[i], clienteNome: cliente.nome || "Cliente", _orcOrigem: orc });
                return;
              }
              onAbrirOrcamento(cliente, orc, "editar");
            };
            const detalhes = [
              orc.referencia && orc.referencia !== "(sem referência)" ? orc.referencia : "",
              orc.padrao ? `Padrão: ${orc.padrao}` : "",
              prop ? `Proposta ${typeof rotuloDaVersao === "function" ? rotuloDaVersao(orc.propostas || [], (orc.propostas || []).length - 1) : (prop.versao || "v1")}${dataCurta(orc.ultimaPropostaEm || prop.enviadaEm) ? " de " + dataCurta(orc.ultimaPropostaEm || prop.enviadaEm) : ""}` : "Sem proposta enviada",
            ].filter(Boolean);
            return (
              <div
                key={orc.id}
                onClick={() => abrir()}
                title={prop ? "Ver a proposta enviada" : "Abrir o orçamento"}
                style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 12, padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s", backgroundColor: "#fff" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = AZUL_VK; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(4,116,244,0.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(38,36,33,0.14)"; e.currentTarget.style.boxShadow="none"; }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color:"#111827", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span>{orc.tipo || "Projeto"}{orc.subtipo ? ` — ${orc.subtipo}` : ""}</span>
                    {prop && (
                      <span style={{ fontSize: 11, color: AZUL_VK, fontWeight: 600 }}>
                        📄 {orc.propostas.length > 1 ? `${orc.propostas.length} versões` : "proposta"}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color:"#4b5563", marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize:12, color: sts.cor, fontWeight:600 }}>{sts.label}</span>
                    {detalhes.map((t, k) => <span key={k}>{t}</span>)}
                  </div>
                </div>
                {/* O valor é o que a pessoa vem buscar: fica na linha, à
                    direita, do mesmo jeito que na lista de Orçamentos. */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", whiteSpace: "nowrap" }}>
                    {valor > 0 ? fmtBRL(valor) : "—"}
                  </div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 5 }}>
                    {perm.podeEditar && orc.status !== "ganho" && (
                      <button onClick={(e) => { e.stopPropagation(); setGanhoVersao((orc.propostas || []).length - 1); setGanhando(orc); }} style={acao()}>Ganho</button>
                    )}
                    {perm.podeEditar && (
                      <button onClick={(e) => { e.stopPropagation(); marcarPerdido(orc); }} style={acao()}>
                        {orc.status === "perdido" ? "Reabrir" : "Perdido"}
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); onAbrirOrcamento(cliente, orc, "editar"); }} style={acao()}>
                      Editar
                    </button>
                    {perm.podeExcluir && (
                      <button onClick={(e) => { e.stopPropagation(); excluirProjeto(orc); }} style={acao("#dc2626")}>Excluir</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* O mesmo visualizador da lista de Orçamentos: as páginas como foram
          enviadas, com o botão de baixar o PDF. */}
      {ganhando && typeof ModalConfirmarGanho === "function" && (
        <ModalConfirmarGanho
          key={`ganho-${ganhando.id}-${ganhoVersao}`}
          orc={ganhando}
          indiceVersao={ganhoVersao}
          aoTrocarVersao={setGanhoVersao}
          onClose={() => setGanhando(null)}
          onConfirmar={confirmarGanho} />
      )}

      {vendo && typeof PropostaVisualizer === "function" && (
        <PropostaVisualizer
          proposta={vendo}
          versoes={(vendo._orcOrigem || {}).propostas || []}
          aoTrocarVersao={(i) => setVendo((p) => {
            const lista = (p._orcOrigem || {}).propostas || [];
            return lista[i] ? { ...lista[i], clienteNome: p.clienteNome, _orcOrigem: p._orcOrigem } : p;
          })}
          aoExcluirVersao={perm.podeExcluir ? () => {
            const orc = vendo._orcOrigem || {};
            const lista = orc.propostas || [];
            const i = lista.findIndex(p => p.versao === vendo.versao && p.enviadaEm === vendo.enviadaEm);
            if (i < 0) return;
            if (typeof esquecerArquivoDaProposta === "function") esquecerArquivoDaProposta(lista[i]);
            const novo = orcSemVersao(orc, i);
            save({ ...data, orcamentosProjeto: (data.orcamentosProjeto || []).map(o => o.id === orc.id ? novo : o) })
              .catch(console.error);
            const resta = novo.propostas[novo.propostas.length - 1];
            setVendo(resta ? { ...resta, clienteNome: vendo.clienteNome, _orcOrigem: novo } : null);
          } : null}
          onFechar={() => setVendo(null)}
          onEditar={() => { const orc = vendo._orcOrigem; setVendo(null); if (orc) onAbrirOrcamento(cliente, orc, "editar"); }}
        />
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
// ── Copiar a chave PIX ───────────────────────────────
// O caminho real de pagar é copiar a chave aqui e colar no aplicativo do
// banco. Um clique, e a confirmação some sozinha — se ficasse, o próximo
// pagamento começaria dizendo "copiado" sem ninguém ter copiado nada.
function BotaoCopiarPix({ pix, compacto }) {
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState("");
  if (!pix || !pix.tem) return null;
  const copiar = () => {
    setErro("");
    const fim = () => { setCopiado(true); setTimeout(() => setCopiado(false), 2200); };
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(pix.valor).then(fim, () => setErro("O navegador não deixou copiar."));
      return;
    }
    setErro("O navegador não deixou copiar.");
  };
  const icone = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
  const titulo = [pix.rotulo, pix.beneficiario, pix.valor].filter(Boolean).join(" · ");

  if (compacto) {
    return (
      <button type="button" onClick={copiar} title={titulo}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none",
          border: "1px solid rgba(38,36,33,0.16)", borderRadius: 8, padding: "5px 9px",
          cursor: "pointer", fontFamily: "inherit", fontSize: 11.5,
          color: copiado ? "#15803d" : "#4b5563" }}>
        {icone}{copiado ? "copiado" : "PIX"}
      </button>
    );
  }
  return (
    <div style={{ marginTop: 12, padding: "9px 11px", border: "1px solid rgba(38,36,33,0.12)",
      borderRadius: 10, background: "#fafafa" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 10.5, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
            {pix.rotulo}
          </div>
          <div style={{ fontSize: 12.5, color: "#111827", marginTop: 2, wordBreak: "break-all" }}>
            {pixResumido(pix.valor, 44)}
          </div>
          {pix.beneficiario && (
            <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 1 }}>{pix.beneficiario}</div>
          )}
        </div>
        <button type="button" onClick={copiar}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff",
            border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 10, padding: "7px 12px",
            cursor: "pointer", fontFamily: "inherit", fontSize: 12.5,
            color: copiado ? "#15803d" : "#111827", fontWeight: 600 }}>
          {icone}{copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
      {erro && <div style={{ fontSize: 11.5, color: "#dc2626", marginTop: 6 }}>{erro}</div>}
    </div>
  );
}

// ── A corrente, e onde ela arrebenta ────────────────────────────
// O número que importa não é quanto a obra gastou — é quanto do que ela
// gastou dá para rastrear até o item que foi orçado. O resto some do
// confronto e volta como surpresa no fechamento.
function ConferenciaDaObraView({ obra, insumos, isMobile, fmtBRL }) {
  const c = conferenciaDaLigacao(obra, insumos);
  const porInsumo = plPorInsumo(obra && obra.orcamento, (obra && obra.contasPagar) || [], insumos);
  const qtd = (n) => (!n ? "—" : String(Math.round(n * 1000) / 1000).replace(".", ","));
  const num = (v) => (Math.abs(v) < 0.005 ? "—" : fmtBRL(v));
  const cab = { fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 };
  const celula = { fontSize: 12.5, textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  const grade = {
    display: "grid",
    gridTemplateColumns: isMobile ? "minmax(0,1fr) 78px 78px" : "minmax(180px,1fr) 110px 110px 110px 110px 110px",
    gap: 8, alignItems: "center",
  };
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 14,
        padding: isMobile ? 14 : "16px 18px", marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
          {c.pctLigado}% do que foi pago chega até o item orçado
        </div>
        <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4 }}>
          {fmtBRL(c.ligado)} de {fmtBRL(c.totalPago)} têm item do catálogo e etapa — é o que dá para
          confrontar com o orçamento linha a linha. O resto soma no total e some do confronto.
        </div>
        <div style={{ height: 8, borderRadius: 999, background: "rgba(38,36,33,0.08)", marginTop: 12, overflow: "hidden" }}>
          <div style={{ width: Math.max(0, Math.min(100, c.pctLigado)) + "%", height: "100%", background: AZUL_VK }} />
        </div>
      </div>

      {c.ok ? (
        <div style={{ fontSize: 12.5, color: "#4b5563", padding: "4px 2px 18px" }}>
          Nada fora do lugar: todo pagamento tem item e etapa, todo item do orçamento casou com o
          catálogo, e toda transação tem número de referência.
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          {c.furos.map((f, i) => (
            <div key={i} style={{ border: "1px solid rgba(38,36,33,0.12)", borderRadius: 12,
              padding: "11px 14px", marginBottom: 8, display: "flex", gap: 12,
              flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "#111827" }}>{f.titulo}</div>
                <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>{f.oQue}</div>
              </div>
              <div style={{ textAlign: isMobile ? "left" : "right", flexShrink: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>
                  {f.quantos} {f.quantos === 1 ? "linha" : "linhas"}
                </div>
                {f.valor > 0 && <div style={{ fontSize: 11.5, color: "#6b7280" }}>{fmtBRL(f.valor)}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {porInsumo.length > 0 && (
        <div style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px 2px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Orçado × consumido, item a item</div>
            <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 3, marginBottom: 8 }}>
              O confronto em quantidade, que o quadro por conta e o por etapa não dão — os dois somam
              reais e perdem o m³.
            </div>
          </div>
          <div style={{ ...grade, padding: "8px 14px", borderBottom: "1px solid rgba(38,36,33,0.10)" }}>
            <span style={cab}>Item</span>
            <span style={{ ...cab, textAlign: "right" }}>Orçado</span>
            {!isMobile && <span style={{ ...cab, textAlign: "right" }}>R$ orçado</span>}
            <span style={{ ...cab, textAlign: "right" }}>Consumido</span>
            {!isMobile && <span style={{ ...cab, textAlign: "right" }}>R$ pago</span>}
            {!isMobile && <span style={{ ...cab, textAlign: "right" }}>Saldo</span>}
          </div>
          {porInsumo.map((r) => (
            <div key={r.insumoCodigo} style={{ ...grade, padding: "7px 14px", borderTop: "1px solid rgba(38,36,33,0.06)" }}>
              <span style={{ fontSize: 12.5, color: "#111827", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.nome || r.insumoCodigo}
                <span style={{ fontSize: 10.5, color: "#9ca3af" }}> · {r.insumoCodigo}</span>
              </span>
              <span style={{ ...celula, color: "#6b7280" }}>{qtd(r.qtdOrcada)} {r.unidade}</span>
              {!isMobile && <span style={{ ...celula, color: "#6b7280" }}>{num(r.orcado)}</span>}
              <span style={{ ...celula, color: "#111827" }}>{qtd(r.qtdRealizada)} {r.unidade}</span>
              {!isMobile && <span style={{ ...celula, color: "#111827" }}>{num(r.realizado)}</span>}
              {!isMobile && <span style={{ ...celula, color: r.saldo < -0.005 ? "#dc2626" : "#6b7280" }}>{num(r.saldo)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PLDaObraView({ itens, contasPagar, clientePaga, isMobile, fmtBRL, orcamento }) {
  // Acompanhar custo e apurar resultado são duas perguntas. Com a venda, o
  // terreno e os tributos na conta, o número do canteiro fica escondido; o
  // botão esconde os três e sobra o que custa construir.
  const [soCusto, setSoCusto] = useState(false);
  const pl = plDaObra(itens, contasPagar, GRUPOS_PL, PLANO_CONTAS, { soCusto });
  // Conta aberta em etapas: clicar no nome mostra onde o dinheiro foi, e não
  // só que a conta estourou. Só abre quando há etapa marcada dos dois lados.
  const [contaAberta, setContaAberta] = useState(null);
  // Duas leituras da mesma base: por conta (o que comprei) e por etapa
  // (onde a obra está). Quem está tocando a obra pensa por etapa.
  const [visao, setVisao] = useState("conta");
  const porEtapa = plPorEtapa(itens, contasPagar, { soCusto, orcamento });
  // A estimativa do P&L fala por conta do plano e não sabe de etapa; quem
  // fala por etapa é o orçamento da obra. Com orçamento gerado, a coluna
  // dele entra ao lado — duas contas do mesmo gasto, e é assim que se vê
  // qual etapa estourou. A grade do quadro por etapa muda só aí.
  const comOrcado = visao === "etapa" && porEtapa.temOrcamento;
  const gradeEtapa = comOrcado ? {
    display: "grid",
    gridTemplateColumns: isMobile ? "minmax(0,1fr) 88px 88px" : "minmax(180px, 1fr) 140px 140px 140px 140px",
    gap: 8, alignItems: "center",
  } : null;
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
          <div style={{ display: "flex", gap: 6, padding: "10px 12px 0", flexWrap: "wrap", alignItems: "center" }}>
            {[["conta", "Por conta"], ["etapa", "Por etapa"]].map(([v, r]) => (
              <button key={v} onClick={() => setVisao(v)}
                style={{ fontFamily: "inherit", fontSize: 12, padding: "5px 12px", borderRadius: 8, cursor: "pointer",
                  border: `1px solid ${visao === v ? "#0474f4" : "rgba(38,36,33,0.16)"}`,
                  background: visao === v ? "#eef5ff" : "#fff",
                  color: visao === v ? "#0474f4" : "#4b5563", fontWeight: visao === v ? 600 : 500 }}>{r}</button>
            ))}
            <button onClick={() => setSoCusto(!soCusto)}
              title="Esconde preço de venda, terreno e tributos — sobra o que custa construir"
              style={{ fontFamily: "inherit", fontSize: 12, padding: "5px 12px", borderRadius: 8, cursor: "pointer",
                marginLeft: "auto",
                border: `1px solid ${soCusto ? "#0474f4" : "rgba(38,36,33,0.16)"}`,
                background: soCusto ? "#eef5ff" : "#fff",
                color: soCusto ? "#0474f4" : "#4b5563", fontWeight: soCusto ? 600 : 500 }}>
              Só custo de obra
            </button>
          </div>
          <div style={{ ...(gradeEtapa || grade), padding: "8px 12px", borderBottom: "1px solid rgba(38,36,33,0.10)" }}>
            <span style={cab}>{visao === "etapa" ? "Etapa" : "Conta"}</span>
            {comOrcado && !isMobile && <span style={{ ...cab, textAlign: "right" }} title="Do orçamento da obra, item a item">Orçado</span>}
            {!(comOrcado && isMobile) && <span style={{ ...cab, textAlign: "right" }}>Estimado</span>}
            {comOrcado && isMobile && <span style={{ ...cab, textAlign: "right" }}>Orçado</span>}
            <span style={{ ...cab, textAlign: "right" }}>Realizado</span>
            {!isMobile && <span style={{ ...cab, textAlign: "right" }}>Saldo</span>}
          </div>
          {visao === "etapa" ? (
            <>
              {porEtapa.linhas.map(e => (
                <div key={e.etapaId || "sem"} style={{ ...(gradeEtapa || grade), padding: "6px 12px", borderTop: "1px solid rgba(38,36,33,0.06)" }}>
                  <span style={{ fontSize: 12.5, color: "#111827", minWidth: 0 }}>
                    {e.nome}
                    {e.notas ? <span style={{ fontSize: 10.5, color: "#9ca3af" }}> · {e.notas} {e.notas === 1 ? "nota" : "notas"}</span> : null}
                  </span>
                  {comOrcado && !isMobile && <span style={{ ...celula, color: "#6b7280" }}>{num(e.orcado)}</span>}
                  {!(comOrcado && isMobile) && <span style={{ ...celula, color: "#6b7280" }}>{num(e.estimado)}</span>}
                  {comOrcado && isMobile && <span style={{ ...celula, color: "#6b7280" }}>{num(e.orcado)}</span>}
                  <span style={{ ...celula, color: "#111827" }}>{num(e.realizado)}</span>
                  {!isMobile && <span style={{ ...celula, color: (comOrcado ? e.saldoOrcado : e.saldo) < -0.005 ? "#dc2626" : "#6b7280" }}>
                    {num(comOrcado ? e.saldoOrcado : e.saldo)}</span>}
                </div>
              ))}
              <div style={{ ...(gradeEtapa || grade), padding: "8px 12px", background: "#fafafa", borderTop: "1px solid rgba(38,36,33,0.10)" }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#111827" }}>TOTAL DA OBRA</span>
                {comOrcado && !isMobile && <span style={{ ...celula, fontWeight: 700 }}>{num(porEtapa.orcado)}</span>}
                {!(comOrcado && isMobile) && <span style={{ ...celula, fontWeight: 700 }}>{num(porEtapa.estimado)}</span>}
                {comOrcado && isMobile && <span style={{ ...celula, fontWeight: 700 }}>{num(porEtapa.orcado)}</span>}
                <span style={{ ...celula, fontWeight: 700 }}>{num(porEtapa.realizado)}</span>
                {!isMobile && <span style={{ ...celula, fontWeight: 700, color: (comOrcado ? porEtapa.saldoOrcado : porEtapa.saldo) < -0.005 ? "#dc2626" : "#4b5563" }}>
                  {num(comOrcado ? porEtapa.saldoOrcado : porEtapa.saldo)}</span>}
              </div>
              {comOrcado && (
                <div style={{ fontSize: 11, color: "#6b7280", padding: "8px 12px", lineHeight: 1.5 }}>
                  <b style={{ color: "#4b5563" }}>Orçado</b> vem do orçamento da obra, item a item, e é o que fala por etapa.
                  {" "}<b style={{ color: "#4b5563" }}>Estimado</b> vem do quadro do P&amp;L, que fala por conta contábil — o que
                  não tem etapa marcada cai em "Sem etapa". Os dois são contas do mesmo gasto, por caminhos diferentes:
                  não se somam.
                </div>
              )}
            </>
          ) : pl.blocos.map(b => (
            <div key={b.grupo.id}>
              <div style={{ ...grade, padding: "7px 12px", background: "#fafafa", borderTop: "1px solid rgba(38,36,33,0.10)" }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#111827" }}>{b.grupo.titulo}</span>
                <span style={{ ...celula, fontWeight: 700 }}>{num(b.estimado)}</span>
                <span style={{ ...celula, fontWeight: 700 }}>{num(b.realizado)}</span>
                {!isMobile && <span style={{ ...celula, fontWeight: 700, color: "#4b5563" }}>{num(b.estimado - b.realizado)}</span>}
              </div>
              {b.linhas.map(l => {
                const etapas = subcontasDaConta(itens, contasPagar, l.conta.id);
                const abrivel = etapas.length > 1;
                const aberta = contaAberta === l.conta.id;
                return (
                <div key={l.conta.id}>
                <div style={{ ...grade, padding: "6px 12px", borderTop: "1px solid rgba(38,36,33,0.06)",
                    cursor: abrivel ? "pointer" : "default" }}
                  onClick={() => abrivel && setContaAberta(aberta ? null : l.conta.id)}>
                  <span style={{ fontSize: 12.5, color: "#4b5563", minWidth: 0 }}>
                    {abrivel && (
                      <span style={{ display: "inline-block", width: 12, color: "#9ca3af", fontSize: 9,
                        transform: aberta ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▶</span>
                    )}
                    {l.conta.nome}
                    {abrivel && <span style={{ fontSize: 10.5, color: "#9ca3af" }}> · {etapas.length} grupos</span>}
                  </span>
                  <span style={{ ...celula, color: "#6b7280" }}>{num(l.estimado)}</span>
                  <span style={{ ...celula, color: "#111827" }}>{num(l.realizado)}</span>
                  {!isMobile && <span style={{ ...celula, color: l.saldo < -0.005 ? "#dc2626" : "#6b7280" }}>{num(l.saldo)}</span>}
                </div>
                {aberta && etapas.map(e => (
                  <div key={e.chave || "sem"} style={{ ...grade, padding: "5px 12px 5px 30px",
                    borderTop: "1px solid rgba(38,36,33,0.04)", background: "#fcfcfd" }}>
                    <span style={{ fontSize: 12, color: "#6b7280", minWidth: 0 }}>{e.nome}</span>
                    <span style={{ ...celula, fontSize: 12, color: "#9ca3af" }}>{num(e.estimado)}</span>
                    <span style={{ ...celula, fontSize: 12, color: "#4b5563" }}>{num(e.realizado)}</span>
                    {!isMobile && <span style={{ ...celula, fontSize: 12, color: e.saldo < -0.005 ? "#dc2626" : "#9ca3af" }}>{num(e.saldo)}</span>}
                  </div>
                ))}
                </div>
                );
              })}
            </div>
          ))}
          <div style={{ ...grade, padding: "9px 12px", borderTop: "1.5px solid rgba(38,36,33,0.14)", background: "#fafafa" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>
              {soCusto ? "CUSTO DE CONSTRUÇÃO" : clientePaga ? "CUSTO TOTAL" : "RESULTADO"}
            </span>
            <span style={{ ...celula, fontWeight: 700 }}>{num(soCusto || clientePaga ? pl.custo.estimado : pl.resultado.estimado)}</span>
            <span style={{ ...celula, fontWeight: 700 }}>{num(soCusto || clientePaga ? pl.custo.realizado : pl.resultado.realizado)}</span>
            {!isMobile && <span />}
          </div>
        </div>
      )}
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>
        “Realizado” é o que já foi <strong style={{ color: "#4b5563" }}>pago</strong> em contas a pagar, acumulado até hoje —
        conta em aberto não entra. “Estimado” vem da aba Preencher.
        {soCusto && " Preço de venda, terreno e tributos ficam fora deste quadro — só o que custa construir."}
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


// ── O que a obra pagou e o escritório ainda não viu ─────────────
// Painel de leitura, de propósito. A travessia acontece na baixa; este
// quadro só mostra o que ficou para trás, para ser conciliado contra o
// banco. Ver <- isto é um relatório, não uma ação.
// A regra de quem vai para onde mora em escritorio-financeiro.jsx. Aqui é
// só a vitrine: mostrar o que vai acontecer ANTES de gravar, porque escrever
// no extrato sem a pessoa ver é mexer em saldo sem avisar. Nada sai daqui
// sem um clique e uma confirmação.
// O aviso de que a baixa atravessou. Vive fora das telas porque há dois
// lugares onde se paga — contas a pagar e o pedido que nasce pago, lá nas
// cotações — e o recado tem que aparecer onde a mão está.
function AvisoDoExtrato({ aviso, aoFechar, fmtBRL }) {
  if (!aviso) return null;
  const ap = aviso.lancamentos || [], bl = aviso.bloqueados || [], ct = aviso.noCartao || [];
  const porConta = [];
  const indice = {};
  for (const l of ap) {
    if (!indice[l.contaId]) { indice[l.contaId] = { contaId: l.contaId, valor: 0 }; porConta.push(indice[l.contaId]); }
    indice[l.contaId].valor = Math.round((indice[l.contaId].valor + (Number(l.valor) || 0)) * 100) / 100;
  }
  const nomeDaConta = (id) => {
    const c = typeof contaEscritorio === "function" ? contaEscritorio(id) : null;
    return c ? c.nome : id;
  };
  const ondeVer = aviso.modo === "empreendimento"
    ? "Escritório → Financeiro, no quadro Empreendimentos"
    : "Escritório → Financeiro, no bloco Gestão de obras";
  return (
    <div style={{ border: "1px solid rgba(4,116,244,0.30)", background: "rgba(4,116,244,0.05)",
      borderRadius: 14, padding: "12px 14px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: AZUL_VK }}>
          {ap.length === 0 && ct.length ? "Pago no cartão"
            : ap.length === 1 ? "Entrou no extrato do escritório" : `${ap.length} lançamentos entraram no extrato do escritório`}
        </div>
        <button type="button" onClick={aoFechar}
          style={{ border: "none", background: "transparent", color: AZUL_VK, cursor: "pointer",
            fontFamily: "inherit", fontSize: 12.5, padding: 0 }}>Fechar</button>
      </div>
      {porConta.length > 0 && (
        <div style={{ fontSize: 12.5, color: "#374151", marginTop: 6 }}>
          {porConta.map(c => `${nomeDaConta(c.contaId)} ${fmtBRL(c.valor)}`).join(" · ")}
          <span style={{ color: "#6b7280" }}> — veja em {ondeVer}.</span>
        </div>
      )}
      {aviso.modo === "empreendimento" && ap.length > 0 && (
        <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 4 }}>
          Não entra no resultado do mês: soma no valor do imóvel e vira lucro no dia da venda.
        </div>
      )}
      {ct.length > 0 && (
        <div style={{ fontSize: 12.5, color: "#374151", marginTop: ap.length ? 8 : 6,
          paddingTop: ap.length ? 8 : 0, borderTop: ap.length ? "1px solid rgba(38,36,33,0.08)" : "none" }}>
          {fmtBRL(ct.reduce((s, x) => s + x.valor, 0))} no cartão — o custo da obra já está lançado;
          o extrato do escritório recebe quando você fechar a fatura
          {(() => { const f = [...new Set(ct.flatMap(x => x.faturas))].sort();
            const m = f.map((typeof mesAnoPorExtenso === "function" ? mesAnoPorExtenso : (x) => x));
            return m.length ? " de " + m.join(", ") : ""; })()}
          , em Escritório → Cartões.
        </div>
      )}
      {bl.length > 0 && (
        <div style={{ fontSize: 12.5, color: "#b45309", marginTop: 8, paddingTop: 8,
          borderTop: "1px solid rgba(38,36,33,0.08)" }}>
          {bl.length === 1 ? "1 lançamento não entrou" : `${bl.length} lançamentos não entraram`}: {bl[0].motivo}
          {" "}O mês está fechado e não muda. Se o pagamento é de um mês aberto, desfaça a baixa e pague de novo
          com a data certa — ela atravessa na hora.
        </div>
      )}
    </div>
  );
}

function PonteEscritorioView({ obra, cliente, contasPagar, entradas, data, isMobile, fmtBRL }) {
  const fechamentos = typeof fechamentosDoEscritorio === "function" ? fechamentosDoEscritorio(data) : {};
  const jaNoEscritorio = typeof lancamentosDoEscritorio === "function" ? lancamentosDoEscritorio(data) : [];

  const r = useMemo(function () {
    if (typeof lancamentosDaObraParaEscritorio !== "function") return null;
    return lancamentosDaObraParaEscritorio(obra, cliente, {
      contasPagar: contasPagar, entradas: entradas,
      fechamentos: fechamentos, lancamentos: jaNoEscritorio,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obra, cliente, contasPagar, entradas, data]);

  if (!r) return null;

  const explicacao = r.modo === "empreendimento"
    ? "O empreendimento é do escritório, então tudo passa pela conta dele: terreno, construção, taxas e a venda. Nada disso forma resultado no mês — soma no valor do imóvel e vira lucro no dia da venda."
    : r.modo === "clientePaga"
      ? "Esta obra está marcada como “o cliente realiza os pagamentos”: o dinheiro dos fornecedores não passa pela conta do escritório. Só o gerenciamento atravessa, porque honorário é do escritório de qualquer jeito."
      : "O dinheiro do cliente passa pela conta do escritório: entra como consignação e sai como pagamento. Nenhum dos dois é receita — é dinheiro em trânsito. O gerenciamento, sim, é receita.";

  // Agrupa por conta do escritório: o que interessa antes de gravar é
  // "quanto vai para cada conta", não a lista de cinquenta linhas.
  const porConta = [];
  const indice = {};
  for (const l of r.lancamentos) {
    if (!indice[l.contaId]) { indice[l.contaId] = { contaId: l.contaId, quantos: 0, valor: 0 }; porConta.push(indice[l.contaId]); }
    indice[l.contaId].quantos++;
    indice[l.contaId].valor = Math.round((indice[l.contaId].valor + (Number(l.valor) || 0)) * 100) / 100;
  }
  porConta.sort((a, b) => b.valor - a.valor);
  const nomeDaConta = (id) => {
    const c = typeof contaEscritorio === "function" ? contaEscritorio(id) : null;
    return c ? c.nome : id;
  };

  // Ignorados iguais viram uma linha só: "3 compras no cartão de crédito".
  const porMotivo = [];
  const iMotivo = {};
  for (const x of r.ignorados) {
    if (!iMotivo[x.motivo]) { iMotivo[x.motivo] = { motivo: x.motivo, quantos: 0, valor: 0 }; porMotivo.push(iMotivo[x.motivo]); }
    iMotivo[x.motivo].quantos++;
    iMotivo[x.motivo].valor = Math.round((iMotivo[x.motivo].valor + (Number(x.valor) || 0)) * 100) / 100;
  }
  porMotivo.sort((a, b) => b.valor - a.valor);

  // Em partes, e não no atalho "border": quem herda esta caixa troca só a cor,
  // e misturar atalho com propriedade solta faz o React reclamar — com razão,
  // porque a ordem entre os dois não é garantida.
  const caixa = { borderWidth: 1, borderStyle: "solid", borderColor: "rgba(38,36,33,0.14)",
    borderRadius: 12, padding: 14, marginBottom: 12, background: "#fff" };
  const titulo = { fontSize: 12.5, fontWeight: 700, color: "#111827", marginBottom: 8 };

  return (
    <div>
      <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 12, lineHeight: 1.5 }}>{explicacao}</div>

      {r.lancamentos.length > 0 ? (
        <div style={{ ...caixa, borderColor: "rgba(4,116,244,0.35)", background: "#f7fbff" }}>
          <div style={titulo}>
            {r.lancamentos.length === 1 ? "1 lançamento a mandar" : `${r.lancamentos.length} lançamentos a mandar`}
            <span style={{ fontWeight: 400, color: "#4b5563" }}> · {fmtBRL(r.total)}</span>
          </div>
          {porConta.map((c) => (
            <div key={c.contaId} style={{ display: "flex", justifyContent: "space-between", gap: 10,
              fontSize: 12.5, padding: "4px 0", borderTop: "1px solid rgba(38,36,33,0.06)" }}>
              <span style={{ color: "#111827" }}>
                {nomeDaConta(c.contaId)}
                <span style={{ color: "#6b7280" }}> · {c.quantos === 1 ? "1 lançamento" : c.quantos + " lançamentos"}</span>
              </span>
              <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{fmtBRL(c.valor)}</span>
            </div>
          ))}
          {/* Sem botão de propósito. Mandar em lote era a segunda rota para o
              mesmo dinheiro, e duas rotas é como o mesmo gasto entra duas
              vezes — uma pela mão, outra pelo lote. O que atravessa agora
              atravessa na baixa, na hora em que o dinheiro sai. O que está
              nesta lista é o que foi pago ANTES disso existir: é trabalho de
              conciliação contra o extrato do banco, não de um clique. */}
          <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 10, lineHeight: 1.5 }}>
            Isto é o que foi pago nesta obra e nunca atravessou — pagamentos anteriores à travessia
            automática, ou trazidos por importação. Não há botão para mandar em lote: boa parte disto
            costuma já estar no escritório lançada à mão, e mandar de novo contaria o gasto duas vezes.
            Confira contra o extrato do banco, mês a mês. Daqui para frente, a baixa já atravessa sozinha.
          </div>
        </div>
      ) : (
        <div style={{ ...caixa, textAlign: "center", color: "#6b7280", fontSize: 12.5 }}>
          {r.existentes.length
            ? "Tudo que esta obra pagou já está no extrato do escritório."
            : "Nada a mandar por enquanto — só o que já foi pago atravessa."}
        </div>
      )}

      {r.existentes.length > 0 && (
        <div style={{ fontSize: 11.5, color: "#6b7280", marginBottom: 12 }}>
          {r.existentes.length === 1 ? "1 lançamento já foi mandado antes" : `${r.existentes.length} lançamentos já foram mandados antes`} — não entram de novo.
        </div>
      )}

      {r.bloqueados.length > 0 && (
        <div style={{ ...caixa, borderColor: "#f59e0b", background: "#fffbeb" }}>
          <div style={titulo}>
            {r.bloqueados.length === 1 ? "1 pagamento em mês fechado" : `${r.bloqueados.length} pagamentos em mês fechado`}
            <span style={{ fontWeight: 400, color: "#4b5563" }}> · {fmtBRL(r.totalBloqueado)}</span>
          </div>
          <div style={{ fontSize: 11.5, color: "#4b5563" }}>
            Mês fechado é passado conferido contra o banco: nada entra nele. Reabra o mês no Financeiro do
            escritório se precisar, ou deixe como está.
          </div>
        </div>
      )}

      {porMotivo.length > 0 && (
        <div style={caixa}>
          <div style={titulo}>O que não atravessa</div>
          {porMotivo.map((m) => (
            <div key={m.motivo} style={{ display: "flex", justifyContent: "space-between", gap: 10,
              fontSize: 12, padding: "4px 0", borderTop: "1px solid rgba(38,36,33,0.06)", color: "#4b5563" }}>
              <span>{m.quantos === 1 ? "1 lançamento" : m.quantos + " lançamentos"} — {m.motivo}</span>
              <span style={{ whiteSpace: "nowrap" }}>{fmtBRL(m.valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GestaoObraPanel({ cliente, data, save, isMobile, obraInicial, onSairDaObra, entradaInicial }) {
  const perm = getPermissoes();
  // Chegando com uma Entrada já lida (veio da lista de Obras), a tela abre
  // direto em Cotações: é lá que as três portas de saída moram.
  const [view, setView] = useState(entradaInicial ? "cotacoesObra" : obraInicial ? "detalheObra" : "lista");
  // Pedido de abrir a caixa da Entrada vindo do card do painel da obra.
  const [abrirEntrada, setAbrirEntrada] = useState(false);
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
  const [loteDePapeis, setLoteDePapeis] = useState(false);
  const [buscaContas, setBuscaContas] = useState("");
  const [papelContas, setPapelContas] = useState("todos");
  const [contaFiltro, setContaFiltro] = useState("");
  const [etapaFiltro, setEtapaFiltro] = useState("");
  const [papelOcupado, setPapelOcupado] = useState("");
  const [erroPapel, setErroPapel] = useState("");
  const obraAtualRef = useRef(null);
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
  // O que a baixa fez no preço do catálogo: { aplicados, pendencias, semCodigo }.
  // Dar baixa muda o preço de referência do insumo, e isso não pode acontecer
  // calado — principalmente o que PAROU, que é o que precisa da mão dele.
  const [avisoPreco, setAvisoPreco] = useState(null);
  // O que a baixa mandou sozinha para o extrato do escritório.
  const [avisoExtrato, setAvisoExtrato] = useState(null);
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
  // `extras` entra no MESMO save. Dois saves seguidos leem o mesmo retrato
  // antigo de `data`, e o segundo apaga o que o primeiro escreveu — foi assim
  // que uma conta de loja criada pela Entrada sumiu. Quando a baixa precisa
  // mexer no catálogo também, as duas coisas vão juntas ou nenhuma vai.
  // Toda gravada de obra deste cliente passa por aqui, e por isso é aqui que
  // se pergunta se as contas a pagar mudaram. Era o que faltava: cada botão
  // que pagava lembrava de avisar o preço e o extrato, mas o de APAGAR o
  // pedido não — e o lançamento ficava órfão no escritório. Agora não há o
  // que lembrar; quem grava a obra já está avisando.
  //
  // `extras` continua aceito para quem precisa gravar outra coisa no mesmo
  // save (o que vier daqui entra junto).
  const gravarObras = (fatia, extras) => {
    const efeito = efeitosDaFatia(fatia);
    save({ ...data, obras: mesclarPorCliente(data.obras, cliente.id, fatia),
      ...(efeito || {}), ...(extras || {}) });
  };
  // Escritório e cliente usam esta mesma tela e mexem nas mesmas contas.
  // Tudo que é gravado daqui leva o nome de quem gravou — é o que permite
  // abrir uma baixa meses depois e saber de quem foi a mão.
  const quemSou = () => nomeDeQuem(perm.usuario);
  const dataDoDia = (iso) => (iso ? new Date(String(iso).slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR") : "");
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
  obraAtualRef.current = obraAtual;
  const contasDaObra = (obraAtual && obraAtual.contasPagar) || [];
  // Tudo que uma baixa provoca FORA das contas: o preço do catálogo aprende,
  // e o extrato do escritório recebe o lançamento. Mora numa função só
  // porque há DOIS caminhos que pagam nesta tela — dar baixa numa conta, e
  // lançar um pedido que já nasce pago — e o segundo não passava por aqui:
  // o papel ia para contas a pagar baixado, e nem o preço nem o extrato
  // ficavam sabendo. Quem paga por um caminho novo só precisa chamar isto.
  //
  // Devolve `extras` para entrar no MESMO save das contas: duas gravadas
  // seguidas partem do mesmo retrato antigo de `data`, e a segunda apaga a
  // primeira.
  //
  // O catálogo de insumos é do ESCRITÓRIO. O cliente final usa esta mesma
  // tela e pode dar baixa na obra dele; o preço de referência não se mexe
  // por isso.
  const efeitosDaBaixa = (contasAntes, contasDepois, obraDepois) => {
    const nada = { extras: null };
    if (!perm.podeGerenciarObra) return nada;

    // Primeiro o estorno. Conta que ERA paga e deixou de ser — desfeita,
    // apagada, ou com o id trocado por um relançamento — leva embora o
    // lançamento que mandou para o escritório. Sai do próprio diff: assim
    // vale para os três casos e para o botão que alguém criar amanhã.
    const lancsAgora = typeof lancamentosDoEscritorio === "function" ? lancamentosDoEscritorio(data) : [];
    const desfeitas = typeof contasQueDeixaramDeSerPagas === "function"
      ? contasQueDeixaramDeSerPagas(contasAntes, contasDepois) : [];
    const limpo = (typeof semLancamentosDasContas === "function" && obraDepois)
      ? semLancamentosDasContas(lancsAgora, obraDepois.id, desfeitas, contasDepois)
      : { lancamentos: lancsAgora, removidos: 0, reenviar: [] };

    const pagas = contasRecemPagas(contasAntes, contasDepois);
    // Saiu parte de uma nota: a linha dela no extrato saiu inteira, e o que
    // sobrou pago da nota volta pela ponte com o valor novo.
    const paraPonte = pagas.concat((limpo.reenviar || []).filter(c => !pagas.some(p => p && p.id === c.id)));
    if (!paraPonte.length) {
      return { extras: limpo.removidos ? { lancamentos: limpo.lancamentos } : null };
    }

    const r = aplicarComprasNoCatalogo(data.materiais, pagas);
    const ponte = (typeof lancamentosDaBaixa === "function" && obraDepois)
      ? lancamentosDaBaixa(obraDepois, cliente, paraPonte, {
          fechamentos: typeof fechamentosDoEscritorio === "function" ? fechamentosDoEscritorio(data) : {},
          lancamentos: limpo.lancamentos,
        })
      : { lancamentos: [], bloqueados: [], modo: "" };

    const extras = {};
    if (r.materiais !== data.materiais) extras.materiais = r.materiais;
    if (ponte.lancamentos.length || limpo.removidos) {
      extras.lancamentos = limpo.lancamentos.concat(ponte.lancamentos);
    }

    setAvisoPreco(r.relato.aplicados.length || r.relato.pendencias.length ? r.relato : null);
    // Pago no cartão não atravessa agora — e quem pagou precisa ver isso,
    // senão procura no extrato uma linha que só vai existir na fatura.
    const noCartao = pagas.filter(c => c && (c.formaPagamento === "cartao" || c.cartaoId))
      .map(c => ({ valor: Number(c.valorPago) || Number(c.valor) || 0,
        faturas: [...new Set((c.parcelasCartao || []).map(p => p.competencia))] }));
    setAvisoExtrato((ponte.lancamentos.length || ponte.bloqueados.length || noCartao.length)
      ? { modo: ponte.modo, lancamentos: ponte.lancamentos, bloqueados: ponte.bloqueados, noCartao } : null);

    return { extras: Object.keys(extras).length ? extras : null };
  };

  // Qual obra da fatia teve as contas trocadas. Uma ação mexe numa obra só,
  // então para na primeira que rendeu efeito: `efeitosDaBaixa` lê o extrato
  // do `data` de agora, e somar duas rodadas perderia a primeira.
  const efeitosDaFatia = (fatia) => {
    for (const o of fatia || []) {
      if (!o || !o.id) continue;
      const velha = (obras || []).find(x => x && x.id === o.id);
      if (!velha || velha.contasPagar === o.contasPagar) continue;
      const ef = efeitosDaBaixa(velha.contasPagar || [], o.contasPagar || [], o);
      if (ef.extras) return ef.extras;
    }
    return null;
  };

  // Toda escrita de contas da obra passa aqui — baixa de pedido, baixa em
  // lote, baixa avulsa e o que vier depois caíram todos nesta porta.
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
  //
  // A numeração dos pedidos antigos entra NO MESMO efeito de propósito: dois
  // efeitos gravando a obra no mesmo commit partem do mesmo retrato antigo, e
  // o segundo apagaria o que o primeiro escreveu.
  const pedidosSemNumero = ((obraAtual && obraAtual.cotacoes) || [])
    .filter(c => c && c.contaGeradaId && !c.numeroPedido).length;
  useEffect(() => {
    if (view !== "contasPagar" || !obraAtual) return;
    const contratosDaObra = obraAtual.contratos || [];
    const numerada = numerarPedidosAntigos(obraAtual, data.obras || []);
    const alvo = numerada || obraAtual;
    // `contratos` é a lista completa do cliente (obras + coleção antiga) —
    // com uma lista parcial a faxina apagaria parcela boa
    const semOrfas = removerOrfasDeContrato(alvo.contasPagar || [], contratos);
    const sincronizadas = contratosDaObra.length ? sincronizarContasDaObra(semOrfas, contratosDaObra) : semOrfas;
    // Toda transação tem que ter um número de referência — é por ele que a
    // nota e o comprovante se amarram a ela. A parcela de contrato nasce da
    // regra, não de um lançamento, então é aqui que ela entra na fila; uma
    // vez numerada, a ressincronização preserva o número.
    const faltavaNumero = sincronizadas.some(c => c && !c.numeroDoc);
    const novas = faltavaNumero
      ? numerarContas(sincronizadas, obras, lancamentosDoEscritorio(data))
      : sincronizadas;
    // a assinatura não olha o número do pedido nem o de documento, então a
    // numeração precisa dizer por si mesma que houve mudança
    if (!numerada && !faltavaNumero && assinaturaContas(novas) === assinaturaContas(contasDaObra)) return;
    gravarObras(obras.map(o => o.id === obraAtual.id ? { ...alvo, contasPagar: novas } : o));
  }, [view, obraAtual && obraAtual.id, assinaturaContas(contasDaObra), pedidosSemNumero,
      JSON.stringify((obraAtual && obraAtual.contratos) || []), contratos.map(c => c.id).join("|")]);

  // Abrir para editar e a hora de completar o que a conta nao herdou da
  // cotacao que a gerou — item, quantidade, unidade e etapa. Fica aqui, e
  // nao numa migracao, porque assim vale tambem para o que ja estava
  // lancado antes de a conta passar a nascer por item.
  const abrirEdicaoDaConta = (conta, soCalcular) => {
    const completa = typeof completarItemDaConta === "function"
      ? completarItemDaConta(conta, obraAtual, data.materiais || [], contasDaObra)
      : conta;
    if (soCalcular) return completa;
    setFormConta(completa);
  };
  const salvarContaAvulsa = () => {
    const f = formConta;
    if (!f.descricao?.trim()) { dialogo.alertar({ titulo: "Informe a descrição da conta", tipo: "aviso" }); return; }
    if (!(Number(f.valor) > 0)) { dialogo.alertar({ titulo: "Informe um valor maior que zero", tipo: "aviso" }); return; }
    // A mesma régua de todas as portas: conta que entra torta aqui
    // arrebenta o custo por etapa e o orçado × consumido lá na frente.
    const faltas = faltasDaTransacao({ ...f, obraId: f.obraId || (obraAtual && obraAtual.id) });
    if (faltas.length) { dialogo.alertar({ titulo: frasesDasFaltas(faltas), tipo: "aviso" }); return; }
    // O antes e o que o formulario mostrou, nao o que estava gravado: o que
    // veio da cotacao ao abrir nao foi decisao de ninguem, e registrar
    // "quantidade 0 -> 7" esconderia que o ajuste foi de 11 para 7.
    const guardada = contasDaObra.find(c => c.id === f.id) || null;
    const antiga = guardada ? abrirEdicaoDaConta(guardada, true) : null;
    const carimbada = antiga
      ? registrarAto(f, "editada", quemSou(), undefined, detalheDaEdicaoDaConta(antiga, f))
      : numerarContas([registrarAto(f, "criada", quemSou())], obras, lancamentosDoEscritorio(data))[0];
    const existe = !!antiga;
    gravarContas(existe ? contasDaObra.map(c => c.id === f.id ? carimbada : c) : [...contasDaObra, carimbada]);
    setFormConta(null);
  };
  // Pagar registra o realizado na própria conta — é ela que alimenta o
  // realizado por conta do plano de contas e por prestador.
  // Desfazer é imediato; pagar abre a telinha da data de contabilização.
  // Desfazer pede confirmação: a conta volta a ficar A PAGAR — e, com o
  // vencimento no passado, aparece vencida. Quem quer tirar um lançamento
  // errado procura o Excluir, e a pergunta diz isso.
  // Compra no cartão com parcela em fatura FECHADA não sai nem muda daqui:
  // a fatura já é uma linha no extrato, conferida com o banco. Mexer na
  // compra deixaria a fatura dizendo um total e as compras outro.
  const travouNaFatura = (lista, acao) => {
    const doEscritorio = (data && data.lancamentos) || [];
    const travadas = typeof fechadasDaCompra === "function"
      ? [...new Set((lista || []).flatMap(c => fechadasDaCompra(c, doEscritorio)))].sort() : [];
    if (!travadas.length) return false;
    dialogo.alertar({ titulo: "Está numa fatura fechada",
      mensagem: "Esta compra foi no cartão e tem parcela na fatura de "
        + travadas.map(x => typeof mesAnoPorExtenso === "function" ? mesAnoPorExtenso(x) : x).join(", ")
        + ", que já está fechada. Reabra a fatura em Escritório → Cartões (⋯ ao lado do mês) antes de " + acao + ".",
      tipo: "aviso" });
    return true;
  };
  // A conta e o lançamento do escritório são a mesma transação: se o mês
  // dela já foi conferido com o banco no escritório, ela não sai nem muda
  // daqui — sairia de lá também, e o saldo fechado mudaria.
  const travouNoMesFechado = (lista, acao) => {
    if (typeof lancamentosLigadosAsContas !== "function") return false;
    const porObra = {};
    for (const c of lista || []) { const id = (c && c.obraId) || (obraAtual && obraAtual.id); if (id) (porObra[id] = porObra[id] || []).push(c); }
    const fech = typeof fechamentosDoEscritorio === "function" ? fechamentosDoEscritorio(data) : {};
    const lancs = typeof lancamentosDoEscritorio === "function" ? lancamentosDoEscritorio(data) : [];
    const meses = [...new Set(Object.entries(porObra).flatMap(([obraId, cs]) => lancamentosLigadosAsContas(lancs, obraId, cs))
      .map(l => l.competencia).filter(m => m && bloqueioPorMesFechado(m, fech)))].sort();
    if (!meses.length) return false;
    dialogo.alertar({ titulo: "Mês fechado no escritório", tipo: "aviso",
      mensagem: "Esta transação está no extrato do escritório em "
        + meses.map(x => typeof mesAnoPorExtenso === "function" ? mesAnoPorExtenso(x) : x).join(", ")
        + ", mês já conferido com o banco. Reabra o mês no Fechamento do escritório antes de " + acao + "." });
    return true;
  };
  const vaiJuntoNoEscritorio = (lista) => {
    if (typeof lancamentosLigadosAsContas !== "function") return "";
    const lancs = typeof lancamentosDoEscritorio === "function" ? lancamentosDoEscritorio(data) : [];
    const obraId = ((lista || [])[0] || {}).obraId || (obraAtual && obraAtual.id);
    const ligados = lancamentosLigadosAsContas(lancs, obraId, lista);
    if (!ligados.length) return "";
    const total = ligados.reduce((t, l) => t + (Number(l.valor) || 0), 0);
    return ` O lançamento no extrato do escritório (${fmtMoedaCtr(total)}) sai junto.`;
  };
  const confirmarDesfazer = async (lista) => {
    if (travouNaFatura(lista, "desfazer o pagamento")) return false;
    if (travouNoMesFechado(lista, "desfazer o pagamento")) return false;
    return dialogo.confirmar({
      titulo: "Desfazer o pagamento?",
      mensagem: "A conta volta a ficar a pagar (em aberto), com o vencimento que ela tem — se já passou, aparece vencida. "
        + (lista.some(c => c && c.cartaoId)
          ? "Como foi no cartão, a compra sai das faturas abertas do cartão. "
          : "O lançamento que foi para o extrato do escritório sai junto. ")
        + "Se o lançamento estava errado e você quer tirá-lo, use ⋯ → Excluir.",
      confirmar: "Desfazer pagamento",
    });
  };
  const alternarPagamento = async (conta) => {
    if (conta.pago) {
      if (!(await confirmarDesfazer([conta]))) return;
      const atualizada = contaEmAberto(conta, quemSou());
      gravarContas(contasDaObra.map(c => c.id === conta.id ? atualizada : c), conta.obraId);
      return;
    }
    setFormPagamento({ conta, dataContab: conta.vencimento && conta.vencimento <= hojeIso ? conta.vencimento : hojeIso,
      valorPago: Number(conta.valor) || 0, comprovante: conta.comprovante || null, erroAnexo: "" });
  };
  // A loja cobra o pedido, não o saco de cimento: a baixa é de uma vez só,
  // todos os itens na mesma data, e o boleto vale como comprovante de todos.
  const alternarPagamentoPedido = async (linha) => {
    if (linha.pago) {
      if (!(await confirmarDesfazer(linha.contas))) return;
      const alvo = new Set(linha.contas.map(c => c.id));
      gravarContas(contasDaObra.map(c => (alvo.has(c.id) ? contaEmAberto(c, quemSou()) : c)), linha.obraId);
      return;
    }
    setFormPagamento({ pedido: linha, conta: null,
      dataContab: linha.vencimento && linha.vencimento <= hojeIso ? linha.vencimento : hojeIso,
      valorPago: linha.aberto, comprovante: null, erroAnexo: "" });
  };
  // Apagar um pedido a partir do contas a pagar. É a saída para o que nunca
  // devia ter entrado: lançamento de teste, papel em duplicidade, loja
  // errada. Some o pedido e somem as contas dele — inclusive as já baixadas,
  // e aí o realizado da obra cai junto. Por isso a confirmação diz em
  // números o que vai acontecer, em vez de perguntar "tem certeza?".
  //
  // Serve também para o pedido que ficou sem cotação dona: até aqui ele não
  // aparecia em tela nenhuma que soubesse apagá-lo.
  const apagarPedidoDeContas = async (linha) => {
    const obra = (obras || []).find(o => o && o.id === linha.obraId);
    if (!obra) return;
    const ids = linha.pedidoIds || [linha.pedidoId];
    if (travouNaFatura((obra.contasPagar || []).filter(c => c && ids.indexOf(c.pedidoId) >= 0), "apagar o pedido")) return;
    if (travouNoMesFechado((obra.contasPagar || []).filter(c => c && ids.indexOf(c.pedidoId) >= 0), "apagar o pedido")) return;
    const sai = ids.reduce((a, id) => {
      const r = resumoDoQueSai(obra.contasPagar || [], id);
      return { quantas: a.quantas + r.quantas, valor: a.valor + r.valor,
        pagas: a.pagas + r.pagas, valorPago: a.valorPago + r.valorPago };
    }, { quantas: 0, valor: 0, pagas: 0, valorPago: 0 });
    if (!sai.quantas) return;
    const nome = linha.numeroLoja || linha.numeroPedido || "";
    const ok = await dialogo.confirmar({
      titulo: `Apagar ${(typeof rotuloDoPedido === "function" ? rotuloDoPedido(linha) : "Pedido " + nome).trim().replace(/^Nota/, "a nota").replace(/^Pedido/, "o pedido")}?`,
      mensagem: [
        sai.quantas === 1 ? "Sai 1 conta a pagar" : `Saem ${sai.quantas} contas a pagar`,
        `, no total de ${fmtMoedaCtr(sai.valor)}.`,
        sai.pagas ? ` ${sai.pagas === 1 ? "Uma delas j\u00e1 estava baixada" : `${sai.pagas} delas j\u00e1 estavam baixadas`}`
          + `, ent\u00e3o o realizado da obra cai ${fmtMoedaCtr(sai.valorPago)}.` : "",
        vaiJuntoNoEscritorio((obra.contasPagar || []).filter(c => c && c.pago && ids.indexOf(c.pedidoId) >= 0)),
        " Isto n\u00e3o tem volta.",
      ].join(""),
      confirmar: "Apagar pedido",
      destrutivo: true,
    });
    if (!ok) return;
    let contas = obra.contasPagar || [];
    for (const id of ids) contas = apagarPedidoInteiro(contas, id);
    const cotacoes = (obra.cotacoes || []).map(c => !c ? c : ({
      ...c, pedidos: (c.pedidos || []).filter(x => x && ids.indexOf(x.id) < 0),
    }));
    const atualizada = { ...obra, contasPagar: contas, cotacoes };
    gravarObras(obras.map(o => o.id === obra.id ? atualizada : o));
    if (obraAtual && obraAtual.id === obra.id) setObraSelecionada(atualizada);
  };

  // Confirma a baixa: a despesa entra no mês da data de contabilização
  // escolhida (`pagoEm`); `contabilizadoEm` guarda o dia em que se registrou.
  const confirmarPagamento = () => {
    const f = formPagamento; if (!f) return;
    if (!f.dataContab) { dialogo.alertar({ titulo: "Informe a data de contabilização", tipo: "aviso" }); return; }
    // O pedido baixa inteiro, item a item, pelo valor de cada um: é a soma
    // deles que tem que bater com a linha do extrato.
    // O cartão não muda a data nem o valor da baixa — muda só POR ONDE o
    // dinheiro sai. O plano de parcelas fica gravado na conta, e é por ele
    // que a fatura encontra esta compra depois.
    const cartao = f.forma === "cartao" ? cartaoPorId(cartoesDoEscritorio(data), f.cartaoId) : null;
    const noCartao = (conta, valor) => {
      if (!cartao) return { ...conta, formaPagamento: "avista" };
      const p = pagamentoNoCartao(conta, cartao, { pagoEm: f.dataContab, valorPago: valor, parcelas: f.parcelas });
      return p ? { ...conta, ...p } : conta;
    };
    if (f.pedido) {
      const r = baixarPedidos(contasDaObra, f.pedido.pedidoIds || [f.pedido.pedidoId],
        { pagoEm: f.dataContab, comprovante: f.comprovante || null }, quemSou());
      const alvo = new Set((f.pedido.contas || []).map(c => c.id));
      gravarContas(r.contas.map(c => (alvo.has(c.id) ? noCartao(c, Number(c.valorPago) || Number(c.valor) || 0) : c)),
        f.pedido.obraId);
      setFormPagamento(null);
      return;
    }
    const valor = numeroDeCampo(f.valorPago) || Number(f.conta.valor) || 0;
    const atualizada = noCartao(
      contaPaga(f.conta, { pagoEm: f.dataContab, valorPago: valor, comprovante: f.comprovante || null }, quemSou()),
      valor);
    gravarContas(contasDaObra.map(c => c.id === f.conta.id ? atualizada : c), f.conta.obraId);
    setFormPagamento(null);
  };
  // Recalibrar: muda a data do primeiro pagamento do contrato e reescreve as
  // parcelas em aberto; as pagas ficam como estão.
  const confirmarRecalibragem = () => {
    const f = formRecalibrar; if (!f) return;
    // Pedido: as contas andam, não há regra a regravar.
    const pedido = (obraAtual.cotacoes || []).find(c => c.id === f.contratoId && c.contaGeradaId);
    if (pedido) {
      if (f.modo !== "uma" && !f.novaData) { dialogo.alertar({ titulo: "Informe a nova data do primeiro pagamento", tipo: "aviso" }); return; }
      const agora = new Date().toISOString();
      const cotacoes = (obraAtual.cotacoes || []).map(c => c.id !== pedido.id ? c
        : ({ ...c, recalibradoPor: quemSou(), recalibradoEm: agora }));
      const contasNovas = f.modo === "uma"
        ? recalibrarContasDoPedido(contasDaObra, f.pagamentos || [], quemSou(), agora)
        : recalibrarPedido(contasDaObra, pedido.id, f.novaData, quemSou(), agora);
      gravarObras(obras.map(o => o.id !== obraAtual.id ? o : ({ ...o, cotacoes, contasPagar: contasNovas })));
      setFormRecalibrar(null);
      return;
    }
    const alvo = (obraAtual.contratos || []).find(c => c.id === f.contratoId);
    if (!alvo) { setFormRecalibrar(null); return; }
    const porItem = contratoPorItem(alvo);
    const umaSo = f.modo === "uma";
    if (!umaSo && !porItem && !f.novaData) { dialogo.alertar({ titulo: "Informe a nova data do primeiro pagamento", tipo: "aviso" }); return; }
    const agoraCt = new Date().toISOString();
    // A parcela em aberto do contrato é reescrita pela regra toda vez que a
    // tela abre, então nem a recalibragem nem o ajuste de uma parcela cabem
    // nela: os dois moram no contrato. Recalibrar tudo REESCREVE o calendário,
    // e por isso apaga as exceções anotadas antes — elas eram exceções àquele
    // calendário, não a este.
    const recalibrado = { ...(umaSo
      // Data e valor andam juntos: quem corrige a parcela quase sempre mexe
      // nos dois, e separar em dois botões seria pedir duas confirmações
      // para um ajuste só.
      ? ajustarValores(ajustarVencimentos(alvo, f.pagamentos || []), f.pagamentos || [])
      : (porItem
          ? { ...recalibrarItens(limparAjustes(alvo), f.itens || []), previsaoConclusao: f.previsaoConclusao || "" }
          : recalibrarContrato(limparAjustes(alvo), f.novaData))),
      recalibradoPor: quemSou(), recalibradoEm: agoraCt };
    const contratosNovos = (obraAtual.contratos || []).map(c => c.id === alvo.id ? recalibrado : c);
    // O que de fato andou também conta a própria história — a conta regerada
    // preserva os registros da anterior, então o carimbo sobrevive.
    const antesPorId = {};
    for (const c of contasDaObra) antesPorId[c.id] = c.vencimento;
    const contasNovas = sincronizarContasDaObra(contasDaObra, contratosNovos).map(c => {
      if (!c || c.pago || !antesPorId[c.id] || antesPorId[c.id] === c.vencimento) return c;
      return registrarAto(c, "recalibrada", quemSou(), agoraCt,
        `${dataDoDia(antesPorId[c.id])} → ${dataDoDia(c.vencimento)}`);
    });
    gravarObras(obras.map(o => o.id === obraAtual.id ? { ...o, contratos: contratosNovos, contasPagar: contasNovas } : o));
    setFormRecalibrar(null);
  };

  // ── O que dá para recalibrar: contratos e pedidos lançados ────
  // Os dois geram parcelas com data, então os dois podem escorregar quando a
  // obra ou a entrega atrasa. O rótulo traz o número do documento, que é o
  // mesmo da conta lá embaixo — é por ele que se reconhece o grupo.
  const alvosRecalibraveis = (() => {
    const lista = [];
    for (const ct of (obraAtual && obraAtual.contratos) || []) {
      lista.push({ id: ct.id, tipo: "contrato",
        rotulo: `${ct.numeroContrato ? `Contrato ${ct.numeroContrato} · ` : ""}${servicoDoContrato(ct)} · ${ct.nomeContratado || "Contratado"}` });
    }
    for (const cot of (obraAtual && obraAtual.cotacoes) || []) {
      if (!cot.contaGeradaId) continue;
      const contas = contasDeCotacao(contasDaObra, cot.id);
      if (!contas.length) continue;
      lista.push({ id: cot.id, tipo: "pedido",
        rotulo: `${cot.numeroPedido ? `Pedido ${cot.numeroPedido} · ` : ""}${cot.titulo || "Compra"} · ${(contas[0] || {}).favorecido || "Fornecedor"}` });
    }
    return lista;
  })();

  const abrirRecalibragem = (id) => {
    const pedido = (obraAtual.cotacoes || []).find(c => c.id === id && c.contaGeradaId);
    if (pedido) {
      const pagamentos = pagamentosEmAberto(contasDaObra, pedido.id, "pedido");
      setFormRecalibrar({ contratoId: id, novaData: (pagamentos[0] || {}).vencimento || hojeIso,
        itens: [], pagamentos, previsaoConclusao: "", modo: "junto" });
      return;
    }
    const ct = (obraAtual.contratos || []).find(x => x.id === id);
    setFormRecalibrar({ contratoId: id, novaData: (ct && primeiroVencimentoContrato(ct)) || hojeIso,
      itens: datasDosItens(ct), pagamentos: pagamentosEmAberto(contasDaObra, id, "contrato"),
      previsaoConclusao: (ct && ct.previsaoConclusao) || "", modo: "junto" });
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
  // Gravada que parte do dado MAIS FRESCO, não do retrato com que a tela
  // renderizou. É o que as migrações de montagem precisam: elas disparam no
  // mesmo commit em que outra ação pode estar gravando, e partindo do
  // retrato antigo apagam o que a outra acabou de escrever — foi assim que
  // a primeira despesa lançada pela Entrada sumiu das contas a pagar.
  const gravarObrasFrescas = (mudar) => save((atual) => {
    const minhas = (atual.obras || []).filter(o => o && o.clienteId === cliente.id);
    const fatia = mudar(minhas);
    if (!fatia) return null;
    return { ...atual, obras: mesclarPorCliente(atual.obras, cliente.id, fatia) };
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
    if (!obras.map(o => estimativaCargaUnica(o, CARGA_ESTIMATIVA_UNICA, () => uid())).find(Boolean)) return;
    carregouEstimativa.current = true;
    // Recalcula sobre o dado fresco: entre o teste acima e esta gravada pode
    // ter entrado uma conta a pagar, e regravar o retrato antigo a apagaria.
    gravarObrasFrescas((atuais) => {
      const alvo = atuais.map(o => estimativaCargaUnica(o, CARGA_ESTIMATIVA_UNICA, () => uid())).find(Boolean);
      return alvo ? atuais.map(o => (o.id === alvo.id ? alvo : o)) : null;
    });
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
    // Mesma razão da carga da estimativa: parte do dado fresco, senão
    // apaga o que outra ação gravou no mesmo commit.
    save((atual) => {
      const minhas = (atual.obras || []).filter(o => o && o.clienteId === cliente.id);
      const todos = contratosDasObras(minhas, cliente.id)
        .concat((atual.contratos || []).filter(c => c.clienteId === cliente.id));
      return { ...atual,
        obras: mesclarPorCliente(atual.obras, cliente.id,
          contratosNasObras(minhas, todos, cliente.id, obraSelecionada && obraSelecionada.id)),
        contratos: (atual.contratos || []).filter(c => c.clienteId !== cliente.id) };
    });
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
          <div><label style={C.label}>Status</label><Selecao style={{ ...C.input, cursor: "pointer" }} value={formContrato.status} onChange={e => setFormContrato({ ...formContrato, status: e.target.value })}>{Object.entries(statusContrato).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Selecao></div>
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
          <div><label style={C.label}>Status</label><Selecao style={{ ...C.input, cursor: "pointer" }} value={formObra.status} onChange={e => setFormObra({ ...formObra, status: e.target.value })}>{Object.entries(statusObra).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Selecao></div>
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
              <Selecao style={{ ...C.input, cursor: "pointer" }} value={formItemPL.contaId} onChange={e => setFormItemPL({ ...formItemPL, contaId: e.target.value })}>
                {GRUPOS_PL.filter(g => g.id !== "excluidas").map(g => (
                  <optgroup key={g.id} label={g.titulo}>
                    {contasDoGrupo(g.id).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </optgroup>
                ))}
              </Selecao>
            </div>
            <div>
              <label style={C.label}>Prestador de serviço (opcional)</label>
              <Selecao style={{ ...C.input, cursor: "pointer" }} value={formItemPL.prestadorId || ""} onChange={e => setFormItemPL({ ...formItemPL, prestadorId: e.target.value })}>
                <option value="">— Nenhum —</option>
                {prestadores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Selecao>
            </div>
            <div>
              <label style={C.label}>Valor estimado (R$) *</label>
              <CampoCtrNum tipo="moeda" style={C.input} valor={formItemPL.valor}
                onChange={v => setFormItemPL({ ...formItemPL, valor: v })} placeholder="0,00" />
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

        {/* Toggle de visão — quebra linha no celular: sem isto a última aba
            fica fora da tela, inalcançável, e ninguém descobre que existe */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[["pl", "P&L"], ["quadro", "Preencher"], ["conta", "Por conta"], ["prestador", "Por prestador"], ["extrato", "Extrato mensal"], ["ligacao", "Confer\u00eancia"], ["escritorio", "Para o escrit\u00f3rio"]].map(([v, l]) => (
            <button key={v} onClick={() => setVisaoPL(v)}
              style={{ border: visaoPL === v ? `1.5px solid ${AZUL_VK}` : "1px solid rgba(38,36,33,0.16)", background: "#fff", color: visaoPL === v ? "#111827" : "#4b5563", borderRadius: 20, padding: "6px 16px", fontSize: 12.5, fontWeight: visaoPL === v ? 700 : 500, cursor: "pointer", fontFamily: "inherit" }}>
              {l}
            </button>
          ))}
        </div>

        {visaoPL === "ligacao" ? (
          <ConferenciaDaObraView obra={{ ...obraAtual, contasPagar: contasDaObra }}
            insumos={data.materiais || []} isMobile={isMobile} fmtBRL={fmtBRL} />
        ) : visaoPL === "escritorio" ? (
          <PonteEscritorioView obra={obraAtual} cliente={cliente} contasPagar={contasDaObra}
            entradas={entradasDaObra} data={data} isMobile={isMobile} fmtBRL={fmtBRL} />
        ) : visaoPL === "pl" ? (
          <PLDaObraView itens={itensPL} contasPagar={contasDaObra} clientePaga={!!obraAtual.clientePagaDireto}
            isMobile={isMobile} fmtBRL={fmtBRL} orcamento={obraAtual.orcamento} />
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
                <Selecao style={{ ...C.input, cursor: "pointer", width: 220 }} value={escolha} onChange={e => setMesExtrato(e.target.value)}>
                  <option value="total">Só o total da obra</option>
                  <option value="todos">Todos os meses</option>
                  {anos.map(a => <option key={a} value={a}>Meses de {a}</option>)}
                  {meses.map(m => <option key={m} value={m}>{rotuloMes(m)}</option>)}
                </Selecao>
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
                      <Selecao style={{ ...C.input, cursor: "pointer" }} value={formEntrada.contaId} onChange={e => setFormEntrada({ ...formEntrada, contaId: e.target.value })}>
                        {contasDoGrupo("receitas").map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </Selecao>
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
    // Máquina não tem "valor do item": tem preço por hora, por viagem ou por
    // metro, vezes a quantidade. O quadro abaixo troca de colunas por isso.
    const porUnidade = g.modelo === "servicoEquipamento";
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
      const novo0 = { ...g, nomeContratado: prest ? prest.nome : g.nomeContratado, valor: total,
        // número sequencial atribuído na primeira gravação e mantido depois
        numeroContrato: g.numeroContrato || proximoNumeroContrato(data.obras || []),
        geradoEm: g.geradoEm || new Date().toISOString(), atualizadoEm: new Date().toISOString() };
      const existe = contratos.some(c => c.id === novo0.id);
      // Contrato antigo não tem "criado por" — não dá para inventar quem
      // gerou antes disso existir. O que dá é registrar a partir daqui: na
      // primeira vez que ele for salvo de novo, ganha o carimbo de quem
      // salvou, e a criação continua em branco, que é a verdade.
      const agoraCtr = new Date().toISOString();
      const novo = { ...novo0, salvoPor: quemSou(), salvoEm: agoraCtr,
        ...(existe ? {} : { criadoPor: novo0.criadoPor || quemSou(), criadoEm: novo0.criadoEm || agoraCtr }) };
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
          <Selecao style={{ ...C.input, cursor: "pointer" }} value={g.tipoProfissional || ""} onChange={e => {
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
          </Selecao>
          <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 5 }}>São os mesmos prestadores de serviço do catálogo de insumos. O tipo já sugere o regime do contrato e o objeto.</div>
        </div>

        {/* A etapa do contrato vai para cada parcela — é o que põe o serviço
            no custo por etapa. Contrato de obra civil atravessa a obra
            inteira, e aí o certo é deixar em branco: inventar uma etapa
            seria pior que não ter. */}
        <div style={{ marginBottom: 12 }}>
          <label style={C.label}>Etapa da obra (opcional)</label>
          <SelectBusca style={C.input} value={g.etapa || ""}
            onChange={(v) => setG("etapa", v)}
            placeholder="Procurar etapa…"
            opcoes={[{ valor: "", rotulo: "— várias etapas (obra civil, empreitada geral) —" }].concat(
              (typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : []).map(e => ({ valor: e.id, rotulo: e.nome })))} />
          <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 5 }}>
            Contrato de uma etapa só — o portão, a pintura, a impermeabilização — leva a etapa para as parcelas.
          </div>
        </div>

        <div style={{ ...grade("1fr 1fr"), marginBottom: 12 }}>
          <div>
            <label style={C.label}>2. Prestador (contratado)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <Selecao style={{ ...C.input, cursor: "pointer", flex: 1 }} value={g.prestadorId} disabled={!tipoP} onChange={e => setG("prestadorId", e.target.value)}>
                <option value="">{!tipoP ? "— escolha o tipo primeiro —" : prestadoresDisponiveis.length ? "— escolher um prestador cadastrado —" : `— nenhum ${tipoP.nome.toLowerCase()} cadastrado —`}</option>
                {prestadoresDisponiveis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Selecao>
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
            <Selecao style={{ ...C.input, cursor: "pointer" }} value={escopo} onChange={e => {
              const base = contratoVazio(null, cliente.id, obraSelecionada.id, g.tipoProfissional, e.target.value);
              setContratoGerando({ ...base, id: g.id, prestadorId: g.prestadorId, nomeContratado: g.nomeContratado,
                objeto: objetoEditado ? g.objeto : base.objeto,
                enderecoObra: g.enderecoObra, status: g.status, itens: g.itens, escopo: g.escopo,
                valor: g.valor, exclusoes: g.exclusoes, prazoQtd: g.prazoQtd, prazoUnidade: g.prazoUnidade,
                dataInicio: g.dataInicio, dataAssinatura: g.dataAssinatura });
            }}>
              {ESCOPOS_FORNECIMENTO.map(e2 => <option key={e2.id} value={e2.id}>{e2.nome}</option>)}
            </Selecao>
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
                <Selecao style={{ ...C.input, cursor: "pointer" }} value={novoPrestador.tipo} onChange={e => setNovoPrestador({ ...novoPrestador, tipo: e.target.value })}>
                  <option value="PJ">Jurídica</option><option value="PF">Física</option>
                </Selecao>
              </div>
              <div><label style={C.label}>{novoPrestador.tipo === "PF" ? "CPF" : "CNPJ"}</label><input style={C.input} value={novoPrestador.cnpjCpf} onChange={e => setNovoPrestador({ ...novoPrestador, cnpjCpf: e.target.value })} /></div>
              <div>
                <label style={C.label}>Categoria</label>
                <Selecao style={{ ...C.input, cursor: "pointer" }} value={novoPrestador.categoria} onChange={e => setNovoPrestador({ ...novoPrestador, categoria: e.target.value })}>
                  {CATEGORIAS_PRESTADOR.map(c2 => <option key={c2} value={c2}>{c2}</option>)}
                </Selecao>
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
              <Selecao style={{ ...C.input, cursor: "pointer", flex: 1 }} value={pz.unidade} onChange={e => setContratoGerando({ ...g, prazoUnidade: e.target.value, prazoDias: "", prazoMeses: "" })}>
                <option value="">— dias ou meses —</option>
                <option value="dias">Dias corridos</option>
                <option value="meses">Meses</option>
              </Selecao>
            </div>
          </div>
          <div><label style={C.label}>Início previsto</label><input style={C.input} type="date" value={g.dataInicio || ""} onChange={e => setG("dataInicio", e.target.value)} /></div>
          <div>
            <label style={C.label}>Data de assinatura</label>
            <input style={C.input} type="date" value={g.dataAssinatura || ""} onChange={e => setG("dataAssinatura", e.target.value)} />
            <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 5 }}>Vem com a data de hoje; é a data que fecha o contrato, acima das assinaturas.</div>
          </div>
          <div><label style={C.label}>Status</label><Selecao style={{ ...C.input, cursor: "pointer" }} value={g.status} onChange={e => setG("status", e.target.value)}>{Object.entries(statusContrato).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Selecao></div>
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

        {/* Serviço com equipamento: o que o contrato precisa saber antes de
            escrever a medição — quem assina o boletim e como se conta a hora. */}
        {porUnidade && (
          <div style={bloco}>
            <div style={tituloBloco}>Serviço com equipamento e operador</div>
            <div style={{ fontSize: 11.5, color: "#4b5563", marginBottom: 10 }}>
              A medição é o que sustenta este contrato: sem alguém na obra para assinar o boletim do dia, não há como conferir hora, viagem nem metro.
            </div>
            <div style={{ ...grade("1fr 150px 150px"), marginBottom: 10 }}>
              <div>
                <label style={C.label}>Responsável pela obra (assina os boletins)</label>
                <input style={C.input} value={g.responsavelObra || ""} onChange={e => setG("responsavelObra", e.target.value)} placeholder="Nome de quem acompanha e confere as horas" />
              </div>
              <div>
                <label style={C.label}>Hora parada (%)</label>
                <CampoCtrNum tipo="pct" valor={g.horaParadaPct} onChange={v => setG("horaParadaPct", v)} style={C.input} placeholder="50%" />
              </div>
              <div>
                <label style={C.label}>Troca em caso de quebra (horas)</label>
                <CampoCtrNum tipo="inteiro" valor={g.substituicaoHoras} onChange={v => setG("substituicaoHoras", v)} style={C.input} placeholder="24" />
              </div>
            </div>
            <div style={{ ...grade("150px 150px 1fr"), marginBottom: 10 }}>
              <div>
                <label style={C.label}>Jornada — início</label>
                <input style={C.input} type="time" value={g.jornadaInicio || ""} onChange={e => setG("jornadaInicio", e.target.value)} />
              </div>
              <div>
                <label style={C.label}>Jornada — fim</label>
                <input style={C.input} type="time" value={g.jornadaFim || ""} onChange={e => setG("jornadaFim", e.target.value)} />
              </div>
              <div>
                <label style={C.label}>Mobilização (prancha)</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, color: "#111827", whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={g.mobilizacaoInclusa !== false} onChange={e => setG("mobilizacaoInclusa", e.target.checked)} />
                    inclusa no preço
                  </label>
                  {g.mobilizacaoInclusa === false && (
                    <CampoCtrNum tipo="moeda" valor={g.mobilizacaoValor} onChange={v => setG("mobilizacaoValor", v)} style={C.input} placeholder="0,00 por viagem" />
                  )}
                </div>
              </div>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: "#111827" }}>
              <input type="checkbox" checked={!!g.chuvaPaga} onChange={e => setG("chuvaPaga", e.target.checked)} />
              Parada por chuva é paga como hora parada
            </label>
          </div>
        )}

        {/* Valor: itens discriminados ou valor único — vale o que for preenchido.
            No gerenciamento o valor é um só: os itens não aparecem. */}
        <div style={bloco}>
          <div style={tituloBloco}>{porUnidade ? "Equipamentos, unidades e preços" : "Valor do contrato"}</div>
          <div style={{ ...grade("240px 1fr"), marginBottom: 10 }}>
            {porUnidade ? (
              <div style={{ fontSize: 11.5, color: "#4b5563" }}>
                Preencha o preço unitário e a quantidade estimada de cada equipamento. O total é a soma das linhas e vai para o contrato
                como <strong style={{ color: "#111827" }}>valor estimado</strong> — o que se paga é o que for medido.
              </div>
            ) : (
              <div>
                <label style={C.label}>Valor total (R$)</label>
                <CampoCtrNum tipo="moeda" valor={g.valor} onChange={v => setG("valor", v)} style={C.input} placeholder="0,00" disabled={(g.itens || []).some(i => Number(i.valor) > 0)} />
                <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 5 }}>Discrimine itens abaixo se quiser; havendo itens, o total é a soma deles.</div>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: isMobile ? "flex-start" : "flex-end", fontSize: 14, fontWeight: 700, color: "#111827" }}>
              {porUnidade ? "Total estimado: " : "Total: "}{fmtMoedaCtr(total)}
            </div>
          </div>
          {!porUnidade && !gerenciamento && porItem && (g.itens || []).some(i => Number(i.valor) > 0) && (
            <div style={{ fontSize: 11.5, color: "#4b5563", marginBottom: 6 }}>
              Por item, duas datas: o <strong style={{ color: "#111827" }}>início</strong> (quando o item é liberado para produção, quando vence a entrada dele) e a
              <strong style={{ color: "#111827" }}> previsão</strong> de conclusão (quando vence o saldo). Ambas entram em contas a pagar marcadas como estimadas.
            </div>
          )}
          {porUnidade && (g.itens || []).map((it, idx) => {
            const uni = unidadeEquip(it.unidade);
            return (
              <div key={idx} style={{ border: "1px solid rgba(38,36,33,0.12)", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ ...grade("1fr 170px 150px auto"), marginBottom: 8 }}>
                  <div>
                    <label style={C.label}>Equipamento / serviço</label>
                    <input style={C.input} value={it.descricao || ""} onChange={e => setLista("itens", idx, "descricao", e.target.value)}
                      placeholder={uni.ehBroca ? "Perfuração de broca" : "Mini escavadeira, pá carregadeira, caminhão…"} />
                  </div>
                  <div>
                    <label style={C.label}>Unidade</label>
                    <Selecao style={C.input} value={it.unidade || "hora"} onChange={e => setLista("itens", idx, "unidade", e.target.value)}>
                      {UNIDADES_EQUIP.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
                    </Selecao>
                  </div>
                  <div>
                    <label style={C.label}>Valor por {uni.abrev} (R$)</label>
                    <CampoCtrNum tipo="moeda" valor={it.valorUnitario} onChange={v => setLista("itens", idx, "valorUnitario", v)} style={C.input} placeholder="0,00" />
                  </div>
                  <button type="button" onClick={() => delLinha("itens", idx)} style={{ ...C.btnGhost, color: "#dc2626", height: 36, alignSelf: "end" }}>×</button>
                </div>
                <div style={grade(uni.ehBroca ? "150px 150px 150px 1fr" : "170px 170px 1fr")}>
                  {uni.ehBroca && (
                    <div>
                      <label style={C.label}>Diâmetro</label>
                      <input style={C.input} value={it.diametro || ""} onChange={e => setLista("itens", idx, "diametro", e.target.value)} placeholder="25 cm" />
                    </div>
                  )}
                  <div>
                    <label style={C.label}>{uni.ehBroca ? "Metros (total)" : `Quantidade estimada (${uni.abrev})`}</label>
                    <CampoCtrNum tipo="inteiro" valor={it.quantidade} onChange={v => setLista("itens", idx, "quantidade", v)} style={C.input} placeholder="0" />
                  </div>
                  {uni.ehBroca && (
                    <div>
                      <label style={C.label}>Quantidade de furos</label>
                      <CampoCtrNum tipo="inteiro" valor={it.furos} onChange={v => setLista("itens", idx, "furos", v)} style={C.input} placeholder="0" />
                    </div>
                  )}
                  {uni.temMinimo && (
                    <div>
                      <label style={C.label}>Mínimo por acionamento (horas)</label>
                      <CampoCtrNum tipo="inteiro" valor={it.minimo} onChange={v => setLista("itens", idx, "minimo", v)} style={C.input} placeholder="6" />
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "end", justifyContent: isMobile ? "flex-start" : "flex-end", fontSize: 13, fontWeight: 700, color: "#111827", paddingBottom: 8 }}>
                    {fmtMoedaCtr(valorItemEquip(it))}
                  </div>
                </div>
              </div>
            );
          })}
          {porUnidade && (
            <button type="button" style={C.btnSec} onClick={() => addLinha("itens", itemEquipVazio("hora"))}>＋ Adicionar equipamento</button>
          )}

          {!porUnidade && !gerenciamento && porItem && !isMobile && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 140px 140px auto", gap: 8, marginBottom: 4 }}>
              <span style={C.label}>Item</span><span style={C.label}>Valor</span>
              <span style={C.label}>Início</span><span style={C.label}>Previsão de conclusão</span><span />
            </div>
          )}
          {!porUnidade && !gerenciamento && (g.itens || []).map((it, idx) => (
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
          {!porUnidade && !gerenciamento && <button type="button" style={C.btnSec} onClick={() => addLinha("itens", { descricao: "", valor: "", inicio: "", previsao: "" })}>＋ Adicionar item</button>}
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
                <Selecao style={{ ...C.input, cursor: "pointer" }} value={g.entradaEscopo || "contrato"} onChange={e => setG("entradaEscopo", e.target.value)}>
                  <option value="contrato">Na conclusão do contrato todo</option>
                  <option value="item">Na conclusão de cada item</option>
                </Selecao>
              </div>
            )}
            {(modo === "parcelado" || modo === "entradaParcelas") && (
              <>
                <div><label style={C.label}>Nº de parcelas</label><CampoCtrNum tipo="inteiro" valor={g.parcelas} onChange={v => setG("parcelas", v)} style={C.input} placeholder="0" /></div>
                <div>
                  <label style={C.label}>Periodicidade</label>
                  <Selecao style={{ ...C.input, cursor: "pointer" }} value={g.periodicidade || "quinzenais"} onChange={e => setG("periodicidade", e.target.value)}>
                    {PERIODICIDADES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Selecao>
                </div>
                {pagaEmDiaDaSemana(g.periodicidade || "quinzenais") && (
                  <div>
                    <label style={C.label}>Dia do pagamento</label>
                    <Selecao style={{ ...C.input, cursor: "pointer" }} value={diaSemanaPgto(g)} onChange={e => setG("diaSemana", Number(e.target.value))}>
                      {DIAS_SEMANA_PGTO.map(([v, nome]) => <option key={v} value={v}>{nome}</option>)}
                    </Selecao>
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
              <Selecao style={{ ...C.input, cursor: "pointer" }} value={g.meioPagamento || "pixOuTransferencia"} onChange={e => setG("meioPagamento", e.target.value)}>
                {MEIOS_PAGAMENTO.map(mp => <option key={mp.id} value={mp.id}>{mp.nome}</option>)}
              </Selecao>
            </div>
            {modo === "medicao" && (
              <>
                <div>
                  <label style={C.label}>Medição</label>
                  <Selecao style={{ ...C.input, cursor: "pointer" }} value={g.medicaoPeriodicidade || "mensal"} onChange={e => setG("medicaoPeriodicidade", e.target.value)}>
                    <option value="semanal">Semanal</option><option value="quinzenal">Quinzenal</option><option value="mensal">Mensal</option>
                  </Selecao>
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
                          <Selecao style={{ ...C.input, cursor: "pointer" }} value={g[cp.k] || cp.opcoes[0][0]} onChange={e => setG(cp.k, e.target.value)}>
                            {cp.opcoes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </Selecao>
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
    const nomeEtapa = (id) => (((typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : []).find(x => x.id === id) || {}).nome || "");
    const lista = buscarContas(filtrarContas(doMes, filtroContas, hojeIso),
      { texto: buscaContas, papel: papelContas, contaId: contaFiltro, etapa: etapaFiltro },
      { nomePrestador, nomeConta, nomeEtapa });
    const procurando = !!(buscaContas.trim() || papelContas !== "todos" || contaFiltro || etapaFiltro);
    const contasUsadas = [...new Set(contasDaObra.map(c => c.contaId).filter(Boolean))]
      .map(id => ({ valor: id, rotulo: nomeConta(id) })).sort((a, b) => a.rotulo.localeCompare(b.rotulo));
    const etapasUsadas = [...new Set(contasDaObra.map(c => c.etapa).filter(Boolean))]
      .map(id => ({ valor: id, rotulo: nomeEtapa(id) || id })).sort((a, b) => a.rotulo.localeCompare(b.rotulo));
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
    // Procurando, os grupos abrem: achar e não mostrar seria achar à toa.
    const fechado = (g) => (procurando ? false : (gruposFechados[`${visaoContas}:${g.chave}`] ?? !abertoPadrao(g)));
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
    const umaLinha = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
    // A linha de um pedido de loja: o total na frente, os itens dentro. Serve
    // solta (visao por fornecedor, onde o cabeçalho já é a loja) e recuada,
    // debaixo do nome da loja.
    const linhaDoPedido = (L, recuado, semNomeDaLoja) => {

                            const abertaP = !!contasAbertas[L.chave];
                            const stP = rotuloSituacaoConta({ vencimento: L.vencimento, pago: L.pago }, hojeIso);
                            const nomeEtapa = (id) => {
                              const e = (typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : []).find(x => x.id === id);
                              return e ? e.nome : "";
                            };
                            return (
                              <div key={L.chave} style={{ borderTop: "1px solid rgba(38,36,33,0.06)", background: "#fff" }}>
                                <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, alignItems: "center", padding: "9px 11px" }}>
                                  <div data-vk-mantem-mes="1" style={{ minWidth: 0, cursor: "pointer", paddingLeft: recuado ? 18 : 0 }}
                                    title={abertaP ? "Fechar itens" : "Ver os itens"}
                                    onClick={() => setContasAbertas({ ...contasAbertas, [L.chave]: !abertaP })}>
                                    <div style={{ fontSize: 13, color: "#111827", fontWeight: 600, ...umaLinha }}>
                                      <span style={{ color: "#6b7280", fontWeight: 400, marginRight: 4 }}>{abertaP ? "▾" : "▸"}</span>
                                      {rotuloDoPedido(L).trim()}
                                    </div>
                                    <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 2, ...umaLinha }}>
                                      {[(recuado || semNomeDaLoja) ? "" : L.favorecido, L.contas.length === 1 ? "1 item" : `${L.contas.length} itens`,
                                        (() => {
                                          // A conta contábil vale para o pedido inteiro: dita uma vez aqui,
                                          // sai de todas as linhas de item lá embaixo.
                                          const cs = contasDoPedidoDeConta(L.contas);
                                          if (!cs.length) return "";
                                          if (cs.length === 1) return "conta " + nomeConta(cs[0]);
                                          return "contas " + cs.map(nomeConta).filter(Boolean).join(" e ");
                                        })(),
                                        L.numeroNota && !pedidoEhNotaPaga(L) ? "NF " + L.numeroNota : "",
                                        L.parcial ? "parcialmente pago" : ""].filter(Boolean).join(" · ")}
                                    </div>
                                  </div>
                                  <div style={{ fontSize: 12.5, color: "#111827" }}>
                                    {L.vencimento ? new Date(L.vencimento + "T12:00:00").toLocaleDateString("pt-BR") : "a definir"}
                                  </div>
                                  <div style={{ fontSize: 12, color: stP.forte ? "#111827" : "#4b5563", fontWeight: stP.forte ? 700 : 500 }}>{stP.label}</div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", textAlign: isMobile ? "left" : "right" }}>
                                    {fmtMoedaCtr(L.pago ? L.valorPago : L.valor)}
                                  </div>
                                  {perm.podeEditar ? (
                                    <div data-vk-mantem-mes="1" onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 6, justifyContent: isMobile ? "flex-start" : "flex-end" }}>
                                      <button onClick={() => alternarPagamentoPedido(L)} style={isMobile ? C.btnLinhaToque : C.btnLinha}>
                                        {L.pago ? "Desfazer" : "Pagar"}
                                      </button>
                                      <MenuDeAcoes compacto toque={isMobile} title="Mais ações do pedido" itens={[
                                        { rotulo: "Excluir", destrutivo: true, onClick: () => apagarPedidoDeContas(L) },
                                      ]} />
                                    </div>
                                  ) : <div />}
                                </div>
                                {abertaP && (
                                  <div style={{ padding: recuado ? "0 11px 10px 50px" : "0 11px 10px 32px", background: "#fcfcfd" }}>
                                    {/* O que muda de item para item: quanto, de que unidade, a que
                                        preço e quanto deu. Sem cabeçalho, uma coluna de números soltos
                                        é adivinhação — então o cabeçalho vem junto. A etapa fica
                                        embaixo do nome, que é onde ela não disputa espaço com o
                                        número. */}
                                    {(() => {
                                      // A última coluna é a ação: é no item que se corrige
                                      // quantidade e preço quando a obra consumiu menos
                                      // do que o pedido dizia.
                                      const podeMexer = perm.podeEditar;
                                      const GRADE = isMobile
                                        ? "minmax(0,1fr) 96px"
                                        : (podeMexer ? "minmax(0,1fr) 58px 92px 88px 104px 64px" : "minmax(0,1fr) 58px 92px 88px 104px");
                                      // Item pago nao se edita: o dinheiro ja saiu, e reescreve-lo
                                      // seria reescrever o extrato.
                                      const botaoEditar = (ic, naLinha) => (!podeMexer || ic.pago) ? null : (
                                        <button type="button" onClick={() => abrirEdicaoDaConta(ic)}
                                          title="Corrigir quantidade, pre\u00e7o ou valor deste item"
                                          style={{ background: "none", border: "none", cursor: "pointer",
                                            color: AZUL_VK, fontFamily: "inherit",
                                            fontSize: naLinha ? 11.5 : 12.5, textAlign: naLinha ? "right" : "left",
                                            /* no celular o dedo precisa de alvo: o link ganha uma faixa de 44px */
                                            padding: naLinha ? 0 : "12px 10px 12px 0", minHeight: naLinha ? "auto" : 44 }}>
                                          editar
                                        </button>
                                      );
                                      const numero = { textAlign: "right", fontVariantNumeric: "tabular-nums" };
                                      const cabeca = { fontSize: 10.5, color: "#9ca3af", fontWeight: 600,
                                        textTransform: "uppercase", letterSpacing: 0.3 };
                                      return (
                                        <>
                                          {!isMobile && (
                                            <div style={{ display: "grid", gridTemplateColumns: GRADE, gap: 10, padding: "4px 0 2px" }}>
                                              <span style={cabeca}>Item</span>
                                              <span style={{ ...cabeca, ...numero }}>Qtd</span>
                                              <span style={cabeca}>Unidade</span>
                                              <span style={{ ...cabeca, ...numero }}>Unitário</span>
                                              <span style={{ ...cabeca, ...numero }}>Total</span>
                                              {podeMexer && <span style={cabeca} />}
                                            </div>
                                          )}
                                          {L.contas.map(ic => {
                                            const total = ic.pago ? (Number(ic.valorPago) || ic.valor) : ic.valor;
                                            const un = unitarioDaConta(ic);
                                            const qtd = Number(ic.quantidade) || 0;
                                            return (
                                              <div key={ic.id} style={{ display: "grid", gridTemplateColumns: GRADE,
                                                gap: 10, padding: "6px 0", borderTop: "1px solid rgba(38,36,33,0.05)", alignItems: "baseline" }}>
                                                <div style={{ minWidth: 0 }}>
                                                  <div style={{ fontSize: 12, color: "#111827", ...umaLinha }}>{ic.descricao}</div>
                                                  {(nomeEtapa(ic.etapa) || (isMobile && qtd > 0)) && (
                                                    <div style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 1, ...umaLinha }}>
                                                      {[nomeEtapa(ic.etapa),
                                                        isMobile && qtd > 0
                                                          ? `${qtdBR(qtd)} ${ic.unidade || ""}`.trim() + (un != null ? ` × ${valorBR(un)}` : "")
                                                          : ""].filter(Boolean).join(" · ")}
                                                    </div>
                                                  )}
                                                  {isMobile && botaoEditar(ic, false)}
                                                </div>
                                                {!isMobile && <span style={{ fontSize: 12, color: "#4b5563", ...numero }}>
                                                  {qtd > 0 ? qtdBR(qtd) : "—"}</span>}
                                                {!isMobile && <span style={{ fontSize: 12, color: "#4b5563", ...umaLinha }}>
                                                  {ic.unidade || ""}</span>}
                                                {!isMobile && <span style={{ fontSize: 12, color: "#4b5563", ...numero }}>
                                                  {un != null ? valorBR(un) : "—"}</span>}
                                                <span style={{ fontSize: 12, color: "#111827", fontWeight: 600, ...numero }}>
                                                  {fmtMoedaCtr(total)}
                                                </span>
                                                {!isMobile && podeMexer && (botaoEditar(ic, true) || <span />)}
                                              </div>
                                            );
                                          })}
                                        </>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            );
    };


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

        <AvisoDoExtrato aviso={avisoExtrato} aoFechar={() => setAvisoExtrato(null)} fmtBRL={fmtMoedaCtr} />

        {avisoPreco && (() => {
          const ap = avisoPreco.aplicados || [], pd = avisoPreco.pendencias || [];
          const alerta = pd.length > 0;
          const cor = alerta ? "#b45309" : AZUL_VK;
          const fundo = alerta ? "rgba(180,83,9,0.06)" : "rgba(4,116,244,0.05)";
          return (
            <div style={{ border: `1px solid ${cor}`, background: fundo, borderRadius: 14,
              padding: "12px 14px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: cor }}>
                  {alerta ? "Confira a unidade antes de aceitar o preço" : "Preço do catálogo atualizado"}
                </div>
                <button type="button" onClick={() => setAvisoPreco(null)}
                  style={{ border: "none", background: "transparent", color: cor, cursor: "pointer",
                    fontFamily: "inherit", fontSize: 12.5, padding: 0 }}>Fechar</button>
              </div>
              {ap.length > 0 && (
                <div style={{ fontSize: 12.5, color: "#374151", marginTop: 6 }}>
                  {ap.length === 1 ? "1 insumo passou" : `${ap.length} insumos passaram`} a valer o preço desta compra:
                  {" "}{ap.slice(0, 4).map(a => `${a.nome} ${fmtMoedaCtr(a.precoDepois)}${a.unidade ? "/" + a.unidade : ""}`).join(" · ")}
                  {ap.length > 4 ? ` · e outros ${ap.length - 4}` : ""}.
                </div>
              )}
              {pd.map((x, k) => (
                <div key={k} style={{ fontSize: 12.5, color: "#374151", marginTop: 8, paddingTop: 8,
                  borderTop: k === 0 && ap.length === 0 ? "none" : "1px solid rgba(38,36,33,0.08)" }}>
                  <b>{x.nome}</b>{" "}
                  {x.motivo === "unidade" ? (
                    <>— a loja cobrou <b>{fmtMoedaCtr(x.precoDaCompra)}</b> por <b>{x.unidadeCompra || "?"}</b>,
                      {" "}mas o catálogo guarda o preço por <b>{x.unidadePreco || "?"}</b>.
                      {" "}Unidade diferente não é comparável — o preço <b>não foi alterado</b>.</>
                  ) : (
                    <>— a compra deu <b>{fmtMoedaCtr(x.precoDaCompra)}</b> contra{" "}
                      <b>{x.precoAntes != null ? fmtMoedaCtr(x.precoAntes) : "—"}</b> do catálogo,
                      {" "}mais de três vezes de diferença. O preço <b>não foi alterado</b>.</>
                  )}
                </div>
              ))}
              {pd.length > 0 && (
                <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 8 }}>
                  Em Insumos, a ficha do item mostra a compra e deixa você aceitar ou descartar o preço.
                </div>
              )}
            </div>
          );
        })()}

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
              <div style={{ fontSize: 12.5, color: "#4b5563", marginTop: 4, marginBottom: 14 }}>
                {formPagamento.pedido
                  ? `Pedido ${formPagamento.pedido.numeroLoja || formPagamento.pedido.numeroPedido} · ${formPagamento.pedido.favorecido || "Fornecedor"} · ${formPagamento.pedido.contas.length} itens`
                  : tituloConta(formPagamento.conta)}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={C.label}>Data de contabilização</label>
                  <input style={C.input} type="date" value={formPagamento.dataContab}
                    onChange={e => setFormPagamento({ ...formPagamento, dataContab: e.target.value })} />
                </div>
                <div>
                  <label style={C.label}>Valor pago (R$)</label>
                  {formPagamento.pedido ? (
                    <div style={{ ...C.input, background: "#fafafa", color: "#111827", fontWeight: 600 }}>
                      {fmtMoedaCtr(formPagamento.pedido.aberto)}
                    </div>
                  ) : (
                    <CampoCtrNum tipo="moeda" valor={formPagamento.valorPago} onChange={v => setFormPagamento({ ...formPagamento, valorPago: v })} style={C.input} placeholder="0,00" />
                  )}
                </div>
              </div>
              {formPagamento.pedido && (
                <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 8 }}>
                  Os {formPagamento.pedido.contas.length} itens do pedido recebem a baixa juntos, cada um pelo seu valor —
                  a soma é o que sai do caixa. Para pagar um valor diferente, corrija o pedido na cotação.
                </div>
              )}
              {/* ── Como esse dinheiro saiu ──
                  No cartão, o banco não debita esta compra: debita a fatura,
                  lá na frente. Por isso a compra não atravessa sozinha para o
                  escritório — quem atravessa é a fatura, fechada por você. O
                  custo da obra, esse sim, é integral na data de hoje: o
                  material entrou na obra agora, parcelar é decisão de caixa. */}
              {cartoesDoEscritorio(data).length > 0 && (
                <div style={{ marginTop: 14, borderTop: "1px solid rgba(38,36,33,0.1)", paddingTop: 12 }}>
                  <label style={C.label}>Como foi pago</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    {[["avista", "À vista / transferência"], ["cartao", "Cartão de crédito"]].map(([k, r]) => (
                      <button key={k} type="button"
                        onClick={() => setFormPagamento({ ...formPagamento, forma: k,
                          cartaoId: k === "cartao" ? (formPagamento.cartaoId || (cartoesDoEscritorio(data)[0] || {}).id || "") : "",
                          parcelas: formPagamento.parcelas || 1 })}
                        style={{ ...C.btnSec, fontSize: 12.5,
                          borderColor: (formPagamento.forma || "avista") === k ? AZUL_VK : "rgba(38,36,33,0.16)",
                          color: (formPagamento.forma || "avista") === k ? "#111827" : "#4b5563",
                          fontWeight: (formPagamento.forma || "avista") === k ? 700 : 500 }}>
                        {r}
                      </button>
                    ))}
                  </div>
                  {formPagamento.forma === "cartao" && (() => {
                    const cartao = cartaoPorId(cartoesDoEscritorio(data), formPagamento.cartaoId) || cartoesDoEscritorio(data)[0];
                    const total = formPagamento.pedido
                      ? Number(formPagamento.pedido.aberto) || 0
                      : (numeroDeCampo(formPagamento.valorPago) || Number((formPagamento.conta || {}).valor) || 0);
                    const parcelas = parcelasDoCartao(cartao, formPagamento.dataContab, total, formPagamento.parcelas);
                    return (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 12 }}>
                          <div>
                            <label style={C.label}>Cartão</label>
                            <SelectBusca style={C.input} value={formPagamento.cartaoId || (cartao || {}).id || ""}
                              onChange={(v) => setFormPagamento({ ...formPagamento, cartaoId: v })}
                              opcoes={cartoesDoEscritorio(data).map(c => ({ valor: c.id, rotulo: c.nome }))} />
                          </div>
                          <div>
                            <label style={C.label}>Parcelas</label>
                            <input style={C.input} inputMode="numeric" value={formPagamento.parcelas || 1}
                              onChange={e => setFormPagamento({ ...formPagamento, parcelas: e.target.value })} />
                          </div>
                        </div>
                        {parcelas.length > 0 && (
                          <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 8, lineHeight: 1.6 }}>
                            Vai cair {parcelas.length === 1 ? "na fatura de " : "nas faturas de "}
                            <b style={{ color: "#111827" }}>
                              {parcelas.map(p => (typeof mesAnoPorExtenso === "function" ? mesAnoPorExtenso : (x) => x)(p.competencia) + " (" + fmtMoedaCtr(p.valor) + ")").join(" · ")}
                            </b>
                            . O custo da obra é integral hoje; o extrato do escritório só recebe a fatura, quando
                            você fechar.
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              <BotaoCopiarPix pix={pixDoPagamento(
                formPagamento.pedido || formPagamento.conta,
                prestadores.find(x => x.id === ((formPagamento.pedido || formPagamento.conta) || {}).prestadorId))} />
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
                  chamadaToque="Toque para anexar o comprovante"
                  apoioToque="tire a foto do comprovante, escolha da galeria ou pegue o PDF do banco"
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

        {/* Procurar e filtrar: uma caixa para ref, fornecedor, descrição,
            valor, nº da nota ou nome do papel; e os filtros de lado. */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,2fr) auto minmax(0,1fr) minmax(0,1fr)", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <input style={{ ...C.input, margin: 0 }} value={buscaContas} onChange={e => setBuscaContas(e.target.value)}
            placeholder="Procurar: ref, fornecedor, descrição, valor, nº da nota, papel…" aria-label="Procurar nas contas" />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FILTROS_PAPEL.map(f => chip(papelContas === f.id, f.nome, () => setPapelContas(f.id)))}
          </div>
          <SelectBusca style={C.input} value={contaFiltro} onChange={v => setContaFiltro(v || "")} vazio="Todas as contas contábeis"
            placeholder="Procurar conta…" opcoes={[{ valor: "", rotulo: "Todas as contas contábeis" }, ...contasUsadas]} />
          <SelectBusca style={C.input} value={etapaFiltro} onChange={v => setEtapaFiltro(v || "")} vazio="Todas as etapas"
            placeholder="Procurar etapa…" opcoes={[{ valor: "", rotulo: "Todas as etapas" }, ...etapasUsadas]} />
        </div>
        {procurando && (
          <div style={{ fontSize: 11.5, color: "#4b5563", marginBottom: 12 }}>
            {lista.length} conta(s) encontrada(s){" · "}
            <button type="button" onClick={() => { setBuscaContas(""); setPapelContas("todos"); setContaFiltro(""); setEtapaFiltro(""); }}
              style={{ background: "none", border: "none", padding: 0, color: AZUL_VK, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5 }}>limpar a busca</button>
          </div>
        )}

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
              {/* O valor é o que o fornecedor cobrou; mexer nele refaz o
                  unitário, para os três números continuarem dizendo a
                  mesma coisa. */}
              <div><label style={C.label}>Valor (R$)</label><CampoCtrNum tipo="moeda" valor={formConta.valor}
                onChange={v => setFormConta(conciliarValorDaConta(formConta, "valor", v))} style={C.input} placeholder="0,00" /></div>
              <div><label style={C.label}>Vencimento</label><input style={C.input} type="date" value={formConta.vencimento || ""} onChange={e => setFormConta({ ...formConta, vencimento: e.target.value })} /></div>
              <div>
                <label style={C.label}>Conta</label>
                <Selecao style={{ ...C.input, cursor: "pointer" }} value={formConta.contaId} onChange={e => setFormConta({ ...formConta, contaId: e.target.value })}>
                  {GRUPOS_PL.filter(g => g.id !== "receitas").map(g => (
                    <optgroup key={g.id} label={g.titulo}>
                      {PLANO_CONTAS.filter(c => c.grupo === g.id).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </optgroup>
                  ))}
                </Selecao>
              </div>
              <div>
                <label style={C.label}>Favorecido</label>
                <Selecao style={{ ...C.input, cursor: "pointer" }} value={formConta.prestadorId || ""} onChange={e => setFormConta({ ...formConta, prestadorId: e.target.value, favorecido: (prestadores.find(p => p.id === e.target.value) || {}).nome || "" })}>
                  <option value="">— sem prestador —</option>
                  {prestadores.filter(p => p.ativo !== false).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </Selecao>
              </div>
              <div><label style={C.label}>Observação</label><input style={C.input} value={formConta.observacao || ""} onChange={e => setFormConta({ ...formConta, observacao: e.target.value })} /></div>
            </div>

            {/* ── O que foi comprado ──
                Quantidade e preço são o que o custo por etapa e o preço do
                catálogo leem. Consumiu menos do que o cotado? Muda a
                quantidade aqui: o valor se refaz, e a conta a pagar passa a
                dizer o que você vai pagar de verdade. */}
            <div style={{ borderTop: "1px solid rgba(38,36,33,0.1)", paddingTop: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 10 }}>O que foi comprado</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr 1fr 1.4fr", gap: 12, alignItems: "end" }}>
                <div style={{ minWidth: 0 }}>
                  <label style={C.label}>Item do catálogo</label>
                  {/* Não achou o item? O mesmo campo cadastra no catálogo, no padrão
                      dele, e já usa — sem sair da conta. */}
                  {typeof CampoItemDoCatalogo === "function" ? (
                    <CampoItemDoCatalogo codigo={formConta.insumoCodigo || ""} descricao={formConta.descricao || ""}
                      unidade={formConta.unidade || ""} insumos={data.materiais || []}
                      aoCadastrar={(campos) => typeof cadastrarInsumoNoCatalogo === "function"
                        ? cadastrarInsumoNoCatalogo(data, save, campos) : null}
                      aoLimpar={() => setFormConta(f => ({ ...f, insumoCodigo: "" }))}
                      aoEscolher={(ins) => setFormConta(f => ({ ...f, insumoCodigo: ins.codigo || ins.id || "",
                        descricao: f.descricao || ins.nome || "",
                        grupoMaterial: ins.grupo || f.grupoMaterial || "",
                        unidade: f.unidade || ins.unidade || "",
                        etapa: f.etapa || ins.etapaPadrao || "" }))} />
                  ) : (
                  <SelectBusca style={C.input} value={formConta.insumoCodigo || ""}
                    onChange={(v) => {
                      const ins = (data.materiais || []).find(x => x && (x.codigo === v || x.id === v)) || null;
                      setFormConta(f => ({ ...f, insumoCodigo: v,
                        descricao: f.descricao || (ins && ins.nome) || "",
                        grupoMaterial: (ins && ins.grupo) || f.grupoMaterial || "",
                        unidade: f.unidade || (ins && ins.unidade) || "",
                        etapa: f.etapa || (ins && ins.etapaPadrao) || "" }));
                    }}
                    placeholder="Procurar no catálogo…"
                    opcoes={[{ valor: "", rotulo: "— sem item do catálogo —" }].concat(
                      (data.materiais || []).filter(i => i && i.ativo !== false)
                        .map(i => ({ valor: i.codigo || i.id, rotulo: i.nome, grupo: i.grupo || "",
                          extra: (i.aliases || []).join(" ") })))} />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <label style={C.label}>Quantidade</label>
                  <input style={C.input} inputMode="decimal" value={formConta.quantidade == null ? "" : formConta.quantidade}
                    onChange={e => setFormConta(conciliarValorDaConta(formConta, "quantidade", e.target.value))} placeholder="0" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <label style={C.label}>Unidade</label>
                  <input style={C.input} value={formConta.unidade || ""}
                    onChange={e => setFormConta({ ...formConta, unidade: e.target.value })} placeholder="un" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <label style={C.label}>Preço unitário</label>
                  <CampoCtrNum tipo="moeda" style={C.input} valor={formConta.unitario}
                    onChange={v => setFormConta(conciliarValorDaConta(formConta, "unitario", v))} placeholder="0,00" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <label style={C.label}>Etapa</label>
                  <SelectBusca style={C.input} value={formConta.etapa || ""}
                    onChange={(v) => setFormConta(f => ({ ...f, etapa: v }))}
                    placeholder="Procurar etapa…"
                    opcoes={[{ valor: "", rotulo: "— sem etapa —" }].concat(
                      (typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : []).map(e => ({ valor: e.id, rotulo: e.nome || e.id })))} />
                </div>
              </div>
              {numeroDeCampo(formConta.quantidade) > 0 && numeroDeCampo(formConta.unitario) > 0 && (
                <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 8 }}>
                  {qtdBR(numeroDeCampo(formConta.quantidade))} {formConta.unidade || "un"} × {fmtMoedaCtr(numeroDeCampo(formConta.unitario))}
                  {" = "}<b style={{ color: "#111827" }}>{fmtMoedaCtr(numeroDeCampo(formConta.valor))}</b>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={C.btnSec} onClick={() => setFormConta(null)}>Cancelar</button>
              <button style={C.btn} onClick={salvarContaAvulsa}>Salvar conta</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <button style={C.btnSec} onClick={() => setFormConta(contaAvulsaVazia(obraSelecionada.id))}>＋ Nova conta</button>
            {perm.podeGerenciarObra && (
              <button style={C.btnSec} onClick={() => setLoteDePapeis(true)}>Papéis em lote</button>
            )}
            {alvosRecalibraveis.length > 0 && (
              <button style={C.btnSec} onClick={() => abrirRecalibragem(alvosRecalibraveis[0].id)}>Recalibrar</button>
            )}
          </div>
        ))}

        {loteDePapeis && obraAtual && (
          <PapeisEmLote obra={obraAtual} prestadores={prestadores} isMobile={isMobile}
            aoAnexar={anexarPapeisEmLote} aoFechar={() => setLoteDePapeis(false)} />
        )}

        {/* Recalibragem: a obra não começou na data registrada no contrato —
            muda-se a data do primeiro pagamento e as parcelas em aberto andam
            junto. As pagas ficam onde estão. */}
        {formRecalibrar && (() => {
          const escolhido = alvosRecalibraveis.find(a => a.id === formRecalibrar.contratoId) || alvosRecalibraveis[0];
          const ehPedido = !!escolhido && escolhido.tipo === "pedido";
          const alvo = ehPedido ? null : (obraAtual.contratos || []).find(c => c.id === formRecalibrar.contratoId) || (obraAtual.contratos || [])[0];
          const porItem = alvo ? contratoPorItem(alvo) : false;
          const alvoNovo = !alvo ? null : porItem
            ? { ...recalibrarItens(alvo, formRecalibrar.itens || []), previsaoConclusao: formRecalibrar.previsaoConclusao || "" }
            : recalibrarContrato(alvo, formRecalibrar.novaData);
          const umaAUma = formRecalibrar.modo === "uma";
          const previa = ehPedido
            ? (umaAUma
                ? previaDatasDoPedido(contasDaObra, escolhido.id, formRecalibrar.pagamentos || [], 8)
                : previaDoPedido(contasDaObra, escolhido.id, formRecalibrar.novaData, 6))
            : (!alvo ? { linhas: [], pagas: 0, total: 0 }
                : umaAUma
                  ? previaAjusteContrato(alvo, contasDaObra, formRecalibrar.pagamentos || [], 8)
                  : previaEntreContratos(alvo, alvoNovo, contasDaObra, porItem ? 6 : 4));
          const itensDoAlvo = ((alvo || {}).itens || []);
          const dia = (iso) => iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR") : "—";
          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}
              onClick={() => setFormRecalibrar(null)}>
              <div data-vk-ui="1" onClick={e => e.stopPropagation()}
                style={{ background: "#fff", border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: 18, width: "100%", maxWidth: 520, maxHeight: "86vh", overflowY: "auto", boxShadow: "0 20px 60px -20px rgba(17,24,39,0.45)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                  {ehPedido ? "Recalibrar o pedido" : "Recalibrar o contrato"}
                </div>
                <div style={{ fontSize: 12.5, color: "#4b5563", marginTop: 4, marginBottom: 14 }}>
                  {umaAUma
                    ? "Um pagamento saiu da data e os outros não? Ajuste abaixo o vencimento de cada um — só os que você mexer mudam."
                    : ehPedido
                    ? "A entrega toda atrasou? Informe quando vence o primeiro pagamento em aberto; os demais andam o mesmo tanto de dias, mantendo o intervalo combinado com o fornecedor."
                    : porItem
                    ? "A obra não começou na data registrada? Ajuste abaixo o começo e a conclusão de cada item — as parcelas em aberto acompanham."
                    : "A obra não começou na data registrada? Informe quando vence o primeiro pagamento; as parcelas em aberto andam junto, na mesma periodicidade."}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 170px", gap: 12 }}>
                  {/* minWidth 0: célula de grade não encolhe abaixo do conteúdo
                      sem isto, e "Pedido 0007 · Aço Vergalhões · OURIFER"
                      empurrava o campo para fora do painel no celular. */}
                  <div style={{ minWidth: 0 }}>
                    <label style={C.label}>Contrato ou pedido</label>
                    <Selecao style={{ ...C.input, cursor: "pointer" }} value={formRecalibrar.contratoId}
                      onChange={e => abrirRecalibragem(e.target.value)}>
                      {alvosRecalibraveis.map(a => <option key={a.id} value={a.id}>{a.rotulo}</option>)}
                    </Selecao>
                    {(
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        {[["junto", "Todos os pagamentos"], ["uma", "Um pagamento só"]].map(([id, nome]) => (
                          <button key={id} type="button"
                            onClick={() => setFormRecalibrar({ ...formRecalibrar, modo: id,
                              pagamentos: pagamentosEmAberto(contasDaObra, escolhido.id, escolhido.tipo)
                                .map(x => ({ ...x, valorOriginal: x.valor })) })}
                            style={{ border: `1.5px solid ${formRecalibrar.modo === id ? AZUL_VK : "rgba(38,36,33,0.16)"}`,
                              background: "#fff", color: formRecalibrar.modo === id ? AZUL_VK : "#4b5563",
                              borderRadius: 20, padding: "6px 14px", fontSize: 12,
                              fontWeight: formRecalibrar.modo === id ? 700 : 500, cursor: "pointer", fontFamily: "inherit" }}>
                            {nome}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {!umaAUma && (ehPedido || !porItem) && (
                    <div>
                      <label style={C.label}>1º pagamento vence em</label>
                      <input style={C.input} type="date" value={formRecalibrar.novaData}
                        onChange={e => setFormRecalibrar({ ...formRecalibrar, novaData: e.target.value })} />
                    </div>
                  )}
                  {!umaAUma && !ehPedido && porItem && (
                    <div>
                      <label style={C.label}>Previsão de conclusão (padrão)</label>
                      <input style={C.input} type="date" value={formRecalibrar.previsaoConclusao || ""}
                        onChange={e => setFormRecalibrar({ ...formRecalibrar, previsaoConclusao: e.target.value })} />
                    </div>
                  )}
                </div>

                {/* O total, sempre. Recalibrar sem ver a soma é mudar parcela
                    por parcela sem saber onde o total foi parar. */}
                {(() => {
                  const tot = totalDaRecalibragem(formRecalibrar.pagamentos || []);
                  if (!(tot.antes > 0 || tot.depois > 0)) return null;
                  return (
                    <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10,
                      border: `1px solid ${tot.mudou ? "rgba(4,116,244,0.35)" : "rgba(38,36,33,0.12)"}`,
                      background: tot.mudou ? "#eef5ff" : "#fafafa", fontSize: 12.5, color: "#111827" }}>
                      Em aberto hoje <b>{fmtMoedaCtr(tot.antes)}</b>
                      {tot.mudou ? (
                        <>
                          {" → depois do ajuste "}<b>{fmtMoedaCtr(tot.depois)}</b>
                          <span style={{ color: AZUL_VK }}>
                            {" ("}{tot.diferenca < 0 ? "−" : "+"}{fmtMoedaCtr(Math.abs(tot.diferenca))}{")"}
                          </span>
                        </>
                      ) : <span style={{ color: "#6b7280" }}>{" — o total não muda, só as datas."}</span>}
                    </div>
                  );
                })()}

                {umaAUma && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 11.5, color: "#4b5563", marginBottom: 8 }}>
                      Pagamentos em aberto {ehPedido ? "deste pedido" : "deste contrato"}. O que já foi pago não aparece — a data dele é fato consumado.
                    </div>
                    {(formRecalibrar.pagamentos || []).length === 0 ? (
                      <div style={{ fontSize: 12, color: "#4b5563" }}>Nenhum pagamento em aberto {ehPedido ? "neste pedido" : "neste contrato"}.</div>
                    ) : (formRecalibrar.pagamentos || []).map((it, i) => {
                      const mexer = (muda) => setFormRecalibrar({ ...formRecalibrar,
                        pagamentos: (formRecalibrar.pagamentos || []).map((x, j) => j === i ? { ...x, ...muda } : x) });
                      const mudouValor = Math.abs(numeroDeCampo(it.valor) - (Number(it.valorOriginal) || 0)) >= 0.005;
                      return (
                        <div key={it.id} style={{ display: "grid", gap: 8, marginBottom: 10,
                          gridTemplateColumns: isMobile ? "1fr" : "1fr 150px 150px", alignItems: "end" }}>
                          <span style={{ fontSize: 12.5, color: "#111827", alignSelf: "center" }}>{it.descricao || `Pagamento ${i + 1}`}</span>
                          <div>
                            {isMobile && <label style={C.label}>Vence em</label>}
                            <input style={C.input} type="date" value={it.vencimento || ""}
                              onChange={e => mexer({ vencimento: e.target.value })} />
                          </div>
                          {/* O valor ao lado da data: a realidade corrige a previsão —
                              mediu menos, entregou menos, o fornecedor deu desconto. */}
                          <div>
                            {isMobile && <label style={C.label}>Valor</label>}
                            <CampoCtrNum tipo="moeda" style={{ ...C.input, borderColor: mudouValor ? AZUL_VK : undefined }}
                              valor={it.valor} onChange={(v) => mexer({ valor: v })} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagamento item a item: cada item tem o seu próprio começo e
                    a sua própria conclusão — é item a item que se recalibra. */}
                {!umaAUma && !ehPedido && porItem && (
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
                    <div style={{ padding: "10px 11px", fontSize: 12, color: "#4b5563" }}>Nenhuma parcela em aberto neste {ehPedido ? "pedido" : "contrato"}.</div>
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
                {(() => {
                  const doc = ehPedido
                    ? (obraAtual.cotacoes || []).find(c => c.id === (escolhido || {}).id)
                    : alvo;
                  return doc && doc.recalibradoPor ? (
                    <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 8 }}>
                      Recalibrado por último por {nomeGravado(doc.recalibradoPor)}{dataCurta(doc.recalibradoEm) ? ` em ${dataCurta(doc.recalibradoEm)}` : ""}.
                    </div>
                  ) : null;
                })()}
                <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 8 }}>
                  {previa.pagas > 0 ? `${previa.pagas} parcela${previa.pagas === 1 ? "" : "s"} já paga${previa.pagas === 1 ? "" : "s"} fica${previa.pagas === 1 ? "" : "m"} como está${previa.pagas === 1 ? "" : "ão"}. ` : ""}
                  {umaAUma
                    ? (ehPedido
                        ? "Só os pagamentos cuja data você mudou se movem; os demais ficam onde estão."
                        : "Só os pagamentos cuja data você mudou se movem. Eles passam a ser exceções à regra do contrato — recalibrar todos, depois, refaz o calendário e desfaz as exceções.")
                    : ehPedido
                    ? "As contas em aberto deste pedido andam junto; o que já foi pago fica onde está."
                    : porItem
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
                        {linhasDeLoja(g.itens, { semNivelDeLoja: visaoContas === "fornecedor" }).map(L => {
                          if (L.tipo === "pedido") return linhaDoPedido(L, false, visaoContas === "fornecedor");
                          // A loja: o nome, o total do que se deve a ela e os
                          // pedidos por dentro — abertos por padrão, porque é
                          // a lista deles que se confere com a cobrança.
                          if (L.tipo === "loja") {
                            const abertaL = contasAbertas[L.chave] === undefined ? true : !!contasAbertas[L.chave];
                            const stL = rotuloSituacaoConta({ vencimento: L.vencimento, pago: L.pago }, hojeIso);
                            return (
                              <div key={L.chave} style={{ borderTop: "1px solid rgba(38,36,33,0.06)", background: "#fff" }}>
                                <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, alignItems: "center",
                                  padding: "9px 11px", background: "#f6f8fc" }}>
                                  <div data-vk-mantem-mes="1" style={{ minWidth: 0, cursor: "pointer" }}
                                    title={abertaL ? "Fechar os pedidos" : "Ver os pedidos"}
                                    onClick={() => setContasAbertas({ ...contasAbertas, [L.chave]: !abertaL })}>
                                    <div style={{ fontSize: 13, color: "#111827", fontWeight: 700, ...umaLinha }}>
                                      <span style={{ color: "#6b7280", fontWeight: 400, marginRight: 4 }}>{abertaL ? "\u25be" : "\u25b8"}</span>
                                      {L.favorecido || "Loja"}
                                    </div>
                                    <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 2, ...umaLinha }}>
                                      {[L.pedidos.length === 1 ? "1 pedido" : `${L.pedidos.length} pedidos`,
                                        L.contas.length === 1 ? "1 item" : `${L.contas.length} itens`,
                                        L.parcial ? "parcialmente pago" : ""].filter(Boolean).join(" \u00b7 ")}
                                    </div>
                                  </div>
                                  <div style={{ fontSize: 12.5, color: "#111827" }}>
                                    {L.vencimento ? new Date(L.vencimento + "T12:00:00").toLocaleDateString("pt-BR") : "a definir"}
                                  </div>
                                  <div style={{ fontSize: 12, color: stL.forte ? "#111827" : "#4b5563", fontWeight: stL.forte ? 700 : 500 }}>{stL.label}</div>
                                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#111827", textAlign: isMobile ? "left" : "right" }}>
                                    {fmtMoedaCtr(L.pago ? L.valorPago : L.valor)}
                                  </div>
                                  {perm.podeEditar && L.pedidosEmAberto > 1 ? (
                                    <div data-vk-mantem-mes="1" onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 6, justifyContent: isMobile ? "flex-start" : "flex-end" }}>
                                      <button onClick={() => alternarPagamentoPedido(L)} style={{ ...C.btn, fontSize: 12, padding: "6px 12px" }}>
                                        Pagar os {L.pedidosEmAberto} pedidos
                                      </button>
                                    </div>
                                  ) : <div />}
                                </div>
                                {abertaL && <div>{L.pedidos.map(pd => linhaDoPedido(pd, true))}</div>}
                              </div>
                            );
                          }
                          const c = L.conta;
                          const st = rotuloSituacaoConta(c, hojeIso);
                          const detalhe = detalheConta(c);
                          const aberta = !!contasAbertas[c.id];
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
                                    {[["Ref.", c.numeroDoc],
                                      ["Conta", nomeConta(c.contaId)],
                                      ["Favorecido", c.favorecido || (c.prestadorId ? nomePrestador(c.prestadorId) : "")],
                                      ["Serviço", c.servico],
                                      ["Item", c.insumoCodigo
                                        ? (((data.materiais || []).find(m => m && m.codigo === c.insumoCodigo) || {}).nome || c.insumoCodigo)
                                          + (Number(c.quantidade) > 0 ? ` · ${qtdBR(Number(c.quantidade))} ${c.unidade || ""}`.trimEnd() : "")
                                        : ""],
                                      ["Etapa", c.etapa ? (((typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : [])
                                        .find(x => x.id === c.etapa) || {}).nome || c.etapa) : ""],
                                      ["Nota fiscal", c.numeroNota ? "nº " + c.numeroNota : ""],
                                      ["Origem", c.origem === "contrato" ? "Parcela de contrato" : "Conta avulsa"],
                                      ["Vencimento", c.vencimento ? `${dataBR(c.vencimento)}${c.estimada ? " (prevista)" : ""}` : "a definir"],
                                      ["Contabilizado em", c.pago ? dataBR(c.pagoEm) : ""],
                                      ["Registrado em", c.pago ? dataBR(c.contabilizadoEm) : ""],
                                      ["Valor pago", c.pago ? fmtMoedaCtr(Number(c.valorPago) || Number(c.valor) || 0) : ""],
                                      ["Pago", c.pago ? (c.formaPagamento === "cartao"
                                        ? "no cartão" + (c.parcelasCartao && c.parcelasCartao.length > 1 ? `, em ${c.parcelasCartao.length}x` : "")
                                          + " — faturas " + [...new Set((c.parcelasCartao || []).map(p => p.competencia))].map((typeof mesAnoPorExtenso === "function" ? mesAnoPorExtenso : (x) => x)).join(", ")
                                        : (c.formaPagamento === "avista" ? "à vista / transferência" : "")) : ""],
                                      ["Baixa dada por", c.pago ? nomeGravado((ultimoAto(c, "paga") || {}).por) : ""],
                                      ["Observação", c.observacao]].filter(([, v]) => v).map(([rot, v]) => (
                                        <div key={rot} style={{ fontSize: 11.5, color: "#4b5563" }}>
                                          <span style={{ color: "#6b7280" }}>{rot}: </span><span style={{ color: "#111827" }}>{v}</span>
                                        </div>
                                      ))}
                                    {/* O papel anexado na contabilização mora aqui, na conta:
                                        abre direto, sem ir procurar em pasta. */}
                                    {(anexosDaTransacao(c).length > 0 || perm.podeGerenciarObra) && (
                                      <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 2 }}>
                                        <span style={{ color: "#6b7280" }}>Papéis: </span>
                                        <LinksDeAnexo transacao={c} ocupado={papelOcupado === c.id}
                                          aoTrocar={perm.podeGerenciarObra ? (a, f) => mexerNoPapel(c, "trocar", a, f) : undefined}
                                          aoTirar={perm.podeGerenciarObra ? (a) => mexerNoPapel(c, "tirar", a, null) : undefined} />
                                        {perm.podeGerenciarObra && (
                                          <label onClick={e => e.stopPropagation()} style={{ marginLeft: 10, fontSize: 11, color: AZUL_VK, cursor: papelOcupado ? "default" : "pointer" }}>
                                            {papelOcupado === c.id ? "enviando…" : "＋ papel"}
                                            <input type="file" accept="application/pdf,image/*" style={{ display: "none" }} disabled={!!papelOcupado}
                                              onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) mexerNoPapel(c, "anexar", null, f); }} />
                                          </label>
                                        )}
                                        {erroPapel && papelOcupado === "" && erroPapel.indexOf(c.id + ":") === 0 && (
                                          <div style={{ color: "#b91c1c", fontSize: 11 }}>{erroPapel.slice(c.id.length + 1)}</div>
                                        )}
                                      </div>
                                    )}
                                    {/* O histórico é a resposta para "quem mexeu nisso?" — a
                                        mesma conta é do escritório e do cliente. Conta de antes
                                        deste registro não tem histórico, e é isso que ela diz. */}
                                    {registrosDaConta(c).length > 0 && (
                                      <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(38,36,33,0.08)" }}>
                                        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 3 }}>Histórico</div>
                                        {registrosDaConta(c).slice().reverse().map((r, i) => (
                                          <div key={i} style={{ fontSize: 11.5, color: "#4b5563" }}>{textoDoAto(r)}</div>
                                        ))}
                                      </div>
                                    )}
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
                                  <button onClick={() => alternarPagamento(c)} style={isMobile ? C.btnLinhaToque : C.btnLinha}>{c.pago ? "Desfazer" : "Pagar"}</button>
                                  {/* Parcela de contrato é regerada pela regra a cada
                                      abertura da tela — editá-la aqui não duraria um
                                      render; ela se corrige pelo Recalibrar. O resto
                                      é linha concreta e se edita. */}
                                  <MenuDeAcoes compacto toque={isMobile} title="Mais ações da conta" itens={[
                                    (c.origem !== "contrato" && !c.pago)
                                      ? { rotulo: "Editar", onClick: () => abrirEdicaoDaConta(c) } : null,
                                    (c.origem === "avulsa")
                                      ? { rotulo: "Excluir", destrutivo: true, onClick: () => {
                                          if (travouNaFatura([c], "excluir")) return;
                                          if (travouNoMesFechado([c], "excluir")) return;
                                          dialogo.confirmar({ titulo: "Excluir conta?", mensagem: "Esta ação não pode ser desfeita." + vaiJuntoNoEscritorio([c]), confirmar: "Excluir", destrutivo: true })
                                            .then(ok => { if (ok) gravarContas(contasDaObra.filter(x => x.id !== c.id)); }); } } : null,
                                  ]} />
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

  // Gerar e editar contrato passou a valer também para o cliente; REMOVER
  // continua só do escritório, porque apagar contrato leva as parcelas junto.
  const podeContratar = !!perm.podeGerenciarObra || !!perm.isCliente;

  // Cotação de fornecedor que não assina contrato: as parcelas nascem aqui,
  // direto em contas a pagar, e ficam marcadas com a cotação de origem para o
  // lançamento poder ser desfeito inteiro.
  // As contas E o carimbo na cotação saem na MESMA gravação. Em duas, a
  // segunda parte de uma cópia da obra sem as contas da primeira e as apaga.
  function lancarCotacaoEmContas(dados) {
    if (!obraAtual) return { erro: "Obra não encontrada." };
    // O pedido entra na mesma fila de números do contrato — quem relança um
    // pedido desfeito reaproveita o número que já era dele.
    // A conta de loja que a Entrada acabou de abrir vem junto com o pedido e
    // entra aqui, na mesma gravação. Gravar as duas em separado não funciona:
    // a segunda parte de `obraAtual`, que ainda é o estado de antes da
    // primeira — ela não enxerga a conta recém-criada, não acha a cotação
    // para pendurar o pedido, e grava a obra por cima SEM a conta. O gasto
    // ficava em contas a pagar e o pedido não existia em lugar nenhum: nem
    // para conferir, nem para apagar.
    const baseCotacoes = (dados.contaNova && !(obraAtual.cotacoes || []).some(c => c && c.id === dados.contaNova.id))
      ? [...(obraAtual.cotacoes || []), dados.contaNova]
      : (obraAtual.cotacoes || []);
    const anterior = baseCotacoes.find(c => c.id === dados.cotacaoId) || {};
    // Conta de loja é outra história: cada pedido ganha o SEU número e se soma
    // aos anteriores; a cotação comum tem um pedido só e reaproveita o dele.
    const ehLoja = dados.modo === "contaLoja";
    const numeroPedido = ehLoja
      ? proximoNumeroPedido(data.obras || [])
      : (anterior.numeroPedido || proximoNumeroPedido(data.obras || []));
    if (ehLoja) {
      // Editar um pedido é relançá-lo: ele guarda o próprio id e o próprio
      // número, as contas antigas saem e as novas entram no lugar.
      const jaExiste = (anterior.pedidos || []).find(x => x && x.id === (dados.pedido || {}).id);
      if (jaExiste) {
        const trava = podeMexerNoPedido(obraAtual.contasPagar || [], jaExiste.id);
        if (!trava.pode) return { erro: trava.motivo };
      }
      const pedido = { ...(dados.pedido || {}), numero: (jaExiste && jaExiste.numero) || numeroPedido,
        lancadoEm: dados.lancadoEm || new Date().toISOString(), lancadoPor: dados.lancadoPor || "" };
      const contas = numerarContas(contasDaCotacao({ ...dados, numeroPedido: pedido.numero, pedido }, uid),
        obras, lancamentosDoEscritorio(data));
      if (!contas.length) return { erro: "O pedido está sem itens com valor." };
      const lista = baseCotacoes.map(c => c.id !== dados.cotacaoId ? c : ({
        ...c,
        pedidos: jaExiste
          ? (c.pedidos || []).map(x => (x && x.id === pedido.id ? pedido : x))
          : [...(c.pedidos || []), pedido],
        contaGeradaId: c.contaGeradaId || contas[0].id,
        lancadoEm: pedido.lancadoEm, lancadoPor: pedido.lancadoPor,
        pagamento: { ...(c.pagamento || {}), modo: "contaLoja" },
      }));
      const restantes = jaExiste
        ? removerContasDoPedido(obraAtual.contasPagar || [], pedido.id)
        : (obraAtual.contasPagar || []);
      // A cotação que virou este pedido fecha apontando para ele — na mesma
      // gravação, senão a segunda parte partiria de uma cópia sem a primeira.
      const origemId = pedido.cotacaoOrigemId || "";
      const comOrigem = !origemId ? lista : lista.map(x => x.id !== origemId ? x : ({
        ...x,
        pedidoNaLoja: { contaLojaId: dados.cotacaoId, pedidoId: pedido.id, numero: pedido.numero,
          numeroLoja: pedido.numeroLoja || "", em: pedido.lancadoEm, por: pedido.lancadoPor },
      }));
      // Papel que já foi pago nasce baixado: numa gravação só, senão ficaria
      // um instante em "a pagar" e o P&L do mês piscaria com um custo em aberto
      // que nunca existiu.
      const todas = [...restantes, ...contas];
      const finais = pedido.jaPago && pedido.pagoEm
        ? baixarPedidos(todas, [pedido.id], { pagoEm: pedido.pagoEm }, quemSou()).contas
        : todas;
      const comLoja = { ...obraAtual, contasPagar: finais, cotacoes: comOrigem };
      // Papel que nasce pago é uma baixa como outra qualquer: o preço do
      // catálogo aprende e o extrato do escritório recebe — na mesma gravada
      // da obra, senão uma sobrescreve a outra.
      gravarObras(obras.map(o => o.id === obraAtual.id ? comLoja : o));
      setObraSelecionada(comLoja);
      return { primeiraContaId: contas[0].id, quantas: contas.length, gravado: true };
    }
    const novas = numerarContas(contasDaCotacao({ ...dados, numeroPedido }, uid),
      obras, lancamentosDoEscritorio(data));
    if (!novas.length) return { erro: "A proposta escolhida está sem valor." };
    const cotacoes = (obraAtual.cotacoes || []).map(c => c.id !== dados.cotacaoId ? c : ({
      ...c,
      numeroPedido,
      contaGeradaId: novas[0].id,
      lancadoEm: dados.lancadoEm || new Date().toISOString(),
      lancadoPor: dados.lancadoPor || "",
      // o acerto fica na cotação; as contas são a execução dele
      pagamento: planoDoLancamento({ ...dados, numeroPedido }),
    }));
    const atualizada = { ...obraAtual, contasPagar: [...(obraAtual.contasPagar || []), ...novas], cotacoes };
    // Quase sempre nascem em aberto; quando alguma já vem paga, atravessa.
    gravarObras(obras.map(o => o.id === obraAtual.id ? atualizada : o));
    setObraSelecionada(atualizada);
    return { primeiraContaId: novas[0].id, quantas: novas.length, gravado: true };
  }

  // Apagar um pedido da conta de loja: some o pedido e somem as contas dele.
  // Item já pago trava a operação inteira — o gasto não pode sumir da obra.
  function excluirPedidoDaLoja(cotacaoId, pedidoId) {
    if (!obraAtual) return { erro: "Obra não encontrada." };
    const trava = podeMexerNoPedido(obraAtual.contasPagar || [], pedidoId);
    if (!trava.pode) return { erro: trava.motivo };
    const cotacoes = (obraAtual.cotacoes || []).map(c => c.id !== cotacaoId ? c : ({
      ...c, pedidos: (c.pedidos || []).filter(x => x && x.id !== pedidoId),
    }));
    const atualizada = { ...obraAtual,
      contasPagar: removerContasDoPedido(obraAtual.contasPagar || [], pedidoId), cotacoes };
    gravarObras(obras.map(o => o.id === obraAtual.id ? atualizada : o));
    setObraSelecionada(atualizada);
    return { gravado: true };
  }

  // Despesa paga lida pela Entrada: empreiteiro, mão de obra, taxa, aluguel.
  // Dois desfechos, uma gravada só. Se a pessoa apontou a parcela de
  // contrato, é ela que recebe a baixa — o contrato anda e o gasto não se
  // conta duas vezes. Se não, abre-se uma conta avulsa que já nasce baixada,
  // porque o dinheiro saiu antes de a conta existir.
  //
  // Nos dois casos a escrita passa por `gravarContas`, e por isso o preço do
  // catálogo e o extrato do escritório ficam sabendo sem ninguém avisar.
  // A tela única da Entrada: itens com catálogo, etapa e conta, a pagar
  // (um boleto ou várias parcelas) ou pago (à vista ou no cartão). Vira
  // contas na obra numa gravação só, pelo `gravarContas` — e por isso a
  // ponte para o escritório, o preço do catálogo e o aviso da baixa vêm
  // junto, sem ninguém chamar.
  function lancarEntradaDaObra(l, anexo) {
    if (!obraAtual) return { erro: "Obra não encontrada." };
    if (!perm.podeGerenciarObra) return { erro: "Sem permissão para lançar nesta obra." };
    const contas = obraAtual.contasPagar || [];
    const nota = String((l || {}).numeroNota || "").trim();
    if (nota && (l || {}).prestadorId && contas.some(c => c && c.numeroNota === nota && c.prestadorId === l.prestadorId)) {
      return { erro: `A nota nº ${nota} desse fornecedor já está lançada nesta obra.` };
    }
    const ja = typeof papelJaLancado === "function" ? papelJaLancado(data.obras || [], l) : null;
    if (ja) {
      const ondeJa = ja.obraId === obraAtual.id ? "nesta obra" : `em ${ja.obraNome || "outra obra"}`;
      return { erro: `${ja.por === "chave" ? "Essa nota (mesma chave)" : "Esse Pix (mesmo ID)"} já está lançado ${ondeJa}${ja.ref ? ` — ref ${ja.ref}` : ""}.` };
    }
    const pg = (l || {}).pagamento || {};
    const cartao = l.situacao === "pago" && pg.forma === "cartao"
      ? cartaoPorId(cartoesDoEscritorio(data), pg.cartaoId) : null;
    if (l.situacao === "pago" && pg.forma === "cartao" && !cartao) return { erro: "Escolha o cartão." };
    const numeroDoc = typeof proximaReferencia === "function" ? proximaReferencia(obras, lancamentosDoEscritorio(data)) : "";
    const novas = contasDaEntrada(l, { obraId: obraAtual.id, numeroDoc, quem: quemSou(), novoId: uid,
      anexo, cartao, planoDoCartao: pagamentoNoCartao });
    if (!novas.length) return { erro: "Nenhum item com valor." };
    gravarContas([...contas, ...novas], obraAtual.id);
    return { gravado: true, quantas: novas.length };
  }

  // Trocar, tirar ou pôr um papel numa conta já lançada. O papel é da
  // compra, não do item: vale para todas as contas que já o têm (trocar,
  // tirar) ou para todas da mesma referência (pôr).
  async function mexerNoPapel(conta, acao, antigo, arquivo) {
    if (!perm.podeGerenciarObra || !conta) return;
    setErroPapel(""); setPapelOcupado(conta.id);
    try {
      let novo = null;
      if (arquivo) {
        const up = await enviarAnexo(arquivo, "comprovante_pagamento");
        novo = { ...up, tipo: (antigo && antigo.tipo) || "comprovante" };
      }
      const obra = obraAtualRef.current;
      if (!obra) return;
      const mesmo = (a) => !!antigo && !!a && (antigo.public_id ? a.public_id === antigo.public_id : a.url === antigo.url);
      const alvo = (c) => (acao === "anexar"
        ? (conta.numeroDoc ? c.numeroDoc === conta.numeroDoc : c.id === conta.id)
        : anexosDaTransacao(c).some(mesmo));
      const quem = quemSou();
      const novas = (obra.contasPagar || []).map((c) => {
        if (!c || !alvo(c)) return c;
        let lista = anexosDaTransacao(c);
        if (acao === "tirar") lista = lista.filter((a) => !mesmo(a));
        else if (acao === "trocar") lista = lista.map((a) => (mesmo(a) ? novo : a));
        else lista = lista.concat([novo]);
        const ato = acao === "tirar" ? "comprovanteRemovido" : (novo && novo.tipo === "nota" ? "nota" : "comprovante");
        return registrarAto(comAnexos(c, lista), ato, quem, undefined, ((acao === "tirar" ? antigo : novo) || {}).nome || "");
      });
      gravarContas(novas, obra.id);
    } catch (e) {
      setErroPapel(conta.id + ":O papel não subiu: " + ((e && e.message) || "erro"));
    } finally {
      setPapelOcupado("");
    }
  }

  // Papéis em lote: cada papel já subiu; aqui ele entra na lista de anexos
  // das contas da referência escolhida. A chave da nota e o ID do Pix vão
  // junto — é o que impede o mesmo papel de entrar duas vezes depois.
  function anexarPapeisEmLote(pacote) {
    if (!obraAtual) return { erro: "Obra não encontrada." };
    if (!perm.podeGerenciarObra) return { erro: "Sem permissão para anexar nesta obra." };
    const quem = quemSou();
    const porConta = new Map();
    for (const p of pacote || []) for (const id of p.contaIds || []) {
      if (!porConta.has(id)) porConta.set(id, []);
      porConta.get(id).push(p);
    }
    if (!porConta.size) return { erro: "Nenhuma conta escolhida." };
    const contas = obraAtual.contasPagar || [];
    const novas = contas.map((c) => {
      const ps = c && porConta.get(c.id);
      if (!ps) return c;
      let lista = anexosDaTransacao(c);
      let n = c;
      for (const p of ps) {
        if (!p.anexo || lista.some((a) => a && a.public_id && a.public_id === p.anexo.public_id)) continue;
        lista = lista.concat([p.anexo]);
        n = registrarAto(n, p.anexo.tipo === "nota" ? "nota" : "comprovante", quem, undefined, p.anexo.nome || "");
        if (p.chaveNota && !n.chaveNota) n = { ...n, chaveNota: p.chaveNota };
        if (p.idTransacao && !n.idTransacao) n = { ...n, idTransacao: p.idTransacao };
      }
      return comAnexos(n, lista);
    });
    gravarContas(novas, obraAtual.id);
    return { gravado: true };
  }

  function lancarDespesaDaEntrada(d) {
    if (!obraAtual) return { erro: "Obra não encontrada." };
    if (!perm.podeGerenciarObra) return { erro: "Sem permissão para lançar nesta obra." };
    const valor = numeroDeCampo(d.valor) || 0;
    if (!(valor > 0)) return { erro: "Informe o valor pago." };
    if (!d.pagoEm) return { erro: "Informe a data do pagamento." };
    const quem = quemSou();
    const baixa = { pagoEm: d.pagoEm, valorPago: valor, comprovante: d.comprovante || null };
    const contas = obraAtual.contasPagar || [];

    if (d.parcelaId) {
      const alvo = contas.find(c => c && c.id === d.parcelaId);
      if (!alvo) return { erro: "Não achei essa parcela — ela pode ter sido baixada por outro caminho." };
      if (alvo.pago) return { erro: "Essa parcela já está baixada." };
      const cartaoP = d.forma === "cartao" ? cartaoPorId(cartoesDoEscritorio(data), d.cartaoId) : null;
      let pagaP = { ...contaPaga(alvo, baixa, quem), formaPagamento: cartaoP ? "cartao" : "avista" };
      if (cartaoP) {
        const plano = pagamentoNoCartao(pagaP, cartaoP, { pagoEm: d.pagoEm, valorPago: valor, parcelas: d.parcelas });
        if (plano) pagaP = { ...pagaP, ...plano };
      }
      gravarContas(contas.map(c => c.id === alvo.id ? pagaP : c), obraAtual.id);
      return { gravado: true, parcela: true, favorecido: alvo.favorecido || d.favorecido || "" };
    }

    const q = numeroDeCampo(d.quantidade) || 0;
    const nova = numerarContas([registrarAto({ ...contaAvulsaVazia(obraAtual.id),
      contaId: d.contaId || "material",
      prestadorId: d.prestadorId || d.favorecidoId || "",
      favorecido: d.favorecido || "",
      descricao: String(d.descricao || "").trim() || "Pagamento a " + (d.favorecido || "prestador"),
      // a corrente: o que foi comprado, quanto, em que etapa — é o que liga
      // esta despesa ao orçado e ao custo por etapa
      insumoCodigo: d.insumoCodigo || "",
      quantidade: q || "",
      unidade: d.unidade || "",
      unitario: q > 0 ? Math.round((valor / q) * 100) / 100 : "",
      etapa: d.etapa || "",
      grupoMaterial: d.grupoMaterial || "",
      numeroNota: d.documento || "",
      valor, vencimento: d.pagoEm }, "criada", quem)],
      obras, lancamentosDoEscritorio(data))[0];
    // Como o dinheiro saiu. No cartão o custo da obra fica nesta data, mas o
    // plano de parcelas vai junto — é por ele que a fatura acha a compra, e
    // é ele que impede a ponte de mandar a compra para o escritório agora.
    const cartao = d.forma === "cartao" ? cartaoPorId(cartoesDoEscritorio(data), d.cartaoId) : null;
    let paga = { ...contaPaga(nova, baixa, quem), formaPagamento: cartao ? "cartao" : "avista" };
    if (cartao) {
      const plano = pagamentoNoCartao(paga, cartao, { pagoEm: d.pagoEm, valorPago: valor, parcelas: d.parcelas });
      if (plano) paga = { ...paga, ...plano };
    }
    gravarContas(contas.concat([paga]), obraAtual.id);
    return { gravado: true, contaId: nova.id, favorecido: d.favorecido || "", cartao: !!cartao };
  }

  // Recalibrar as entregas de um pedido sem sair da cotação: é lá que se
  // olha o combinado com o fornecedor, e é lá que se descobre que a entrega
  // mudou de data. As contas a pagar são as mesmas — só quem as move muda.
  function recalibrarPedidoDaCotacao(cotacaoId, datas) {
    if (!obraAtual) return { erro: "Obra não encontrada." };
    const agora = new Date().toISOString();
    const contasNovas = recalibrarContasDoPedido(obraAtual.contasPagar || [], datas, quemSou(), agora);
    if (assinaturaContas(contasNovas) === assinaturaContas(obraAtual.contasPagar || [])) {
      return { erro: "Nenhuma data mudou." };
    }
    const cotacoes = (obraAtual.cotacoes || []).map(c => c.id !== cotacaoId ? c
      : ({ ...c, recalibradoPor: quemSou(), recalibradoEm: agora }));
    const atualizada = { ...obraAtual, contasPagar: contasNovas, cotacoes };
    gravarObras(obras.map(o => o.id === obraAtual.id ? atualizada : o));
    setObraSelecionada(atualizada);
    return { gravado: true };
  }

  function desfazerLancamentoDaCotacao(cotacaoId) {
    if (!obraAtual) return { erro: "Obra não encontrada." };
    const restantes = removerContasDaCotacao(obraAtual.contasPagar || [], cotacaoId);
    const cotacoes = (obraAtual.cotacoes || []).map(c => c.id !== cotacaoId ? c
      : ({ ...c, contaGeradaId: "", lancadoEm: "", lancadoPor: "" }));
    const atualizada = { ...obraAtual, contasPagar: restantes, cotacoes };
    gravarObras(obras.map(o => o.id === obraAtual.id ? atualizada : o));
    setObraSelecionada(atualizada);
    return { gravado: true };
  }

  if (view === "contratosDaObra" && obraSelecionada) {
    const contratosDaObra = contratos.filter(c => c.obraId === obraSelecionada.id);
    // O contrato nasce da cotação aprovada, e é aqui que se geram contratos —
    // então a fila de aprovadas fica à vista, sem ter que voltar em Cotações.
    const prontas = podeContratar
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
            Nenhum contrato nesta obra. {podeContratar && <button onClick={() => { setContratoGerando(contratoVazio("empreitadaMaoDeObra", cliente.id, obraSelecionada.id)); setView("gerarContrato"); }} style={{ background: "transparent", border: "none", color: AZUL_VK, cursor: "pointer", padding: 0, fontSize: 12.5, fontFamily: "inherit", textDecoration: "underline" }}>Gerar o primeiro contrato</button>}
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
                    {/* Quem gerou, quem salvou por último, quem escorregou as
                        datas. Contrato gerado antes disto existir aparece sem
                        a linha — carimbo retroativo seria invenção. */}
                    {(textoAutoria(contrato) || contrato.recalibradoPor) && (
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
                        {textoAutoria(contrato)}
                        {contrato.recalibradoPor ? `${textoAutoria(contrato) ? " · " : ""}datas recalibradas por ${nomeGravado(contrato.recalibradoPor)}${dataCurta(contrato.recalibradoEm) ? ` em ${dataCurta(contrato.recalibradoEm)}` : ""}` : ""}
                      </div>
                    )}
                  </div>
                  {(podeContratar || contrato.gerado) && (
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {contrato.gerado && <button onClick={() => { setContratoAberto(contrato); setView("verContrato"); }} style={{ ...C.btnSec, fontSize: 12, padding: "6px 12px" }}>Abrir</button>}
                      {podeContratar && <button onClick={() => { if (contrato.gerado) { setContratoSalvoEm(0); setContratoGerando(contrato); setView("gerarContrato"); } else setFormContrato(contrato); }} style={{ ...C.btnSec, fontSize: 12, padding: "6px 12px" }}>Editar</button>}
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

        {podeContratar && (
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
      <>
      <AvisoDoExtrato aviso={avisoExtrato} aoFechar={() => setAvisoExtrato(null)} fmtBRL={fmtMoedaCtr} />
      <CotacoesObraView
        obra={obraAtual}
        obras={obras}
        data={data}
        save={save}
        onObraAtualizada={setObraSelecionada}
        isMobile={isMobile}
        usuario={perm.usuario}
        onVoltar={() => { setAbrirEntrada(false); setView("detalheObra"); }}
        abrirEntrada={abrirEntrada} entradaInicial={entradaInicial}
        onGerarContrato={abrirContratoDaCotacao}
        onLancarContas={lancarCotacaoEmContas}
        onLancarDespesa={lancarDespesaDaEntrada}
        onLancarEntrada={lancarEntradaDaObra}
        onDesfazerLancamento={desfazerLancamentoDaCotacao}
        onRecalibrarPedido={recalibrarPedidoDaCotacao} onExcluirPedido={excluirPedidoDaLoja}
      />
      </>
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
          {perm.podeGerenciarObra && (
            <button onClick={() => { setAbrirEntrada(true); setView("cotacoesObra"); }}
              style={{ border: "1.5px solid #0474f4", borderRadius: 16, padding: "20px", background: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transition: "all 0.2s ease", fontFamily: "inherit" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0474f4", textAlign: "center" }}>Entrada</div>
              <div style={{ fontSize: 11, color: "#4b5563", textAlign: "center" }}>Nota, pedido ou lista — entra tudo por aqui</div>
            </button>
          )}
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

  // Enquanto a visita dura, a tarja fica no topo o tempo todo: sem ela é fácil
  // esquecer que se está vendo com os olhos do cliente e estranhar o que falta.
  const visitando = !!(usuario && usuario.visita);

  return (
    <div data-vk-ui="1" style={{ minHeight: "100vh", background: "#fafafb", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {visitando && (
        <div style={{ background: "#eef5ff", borderBottom: `1.5px solid ${AZUL_VK}`, padding: isMobile ? "10px 16px" : "10px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12.5, color: "#111827" }}>
            Você está vendo como <strong>{cliente.nome}</strong>
            {usuario.visita_por_nome ? ` — visita de ${usuario.visita_por_nome}` : ""}. O que você fizer aqui é gravado como se fosse o cliente.
          </div>
          {temVoltaDaVisita()
            ? <button onClick={voltarDaVisita} style={{ ...C.btn, fontSize: 12, padding: "6px 14px" }}>Voltar ao escritório</button>
            : <button onClick={onLogout} style={{ ...C.btnSec, fontSize: 12, padding: "6px 14px" }}>Encerrar visita</button>}
        </div>
      )}
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
