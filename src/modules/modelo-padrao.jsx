// ═══════════════════════════════════════════════════════════════
// MODELO PADRÃO — proposta visual baseada na PropostaPreview legado
// ═══════════════════════════════════════════════════════════════
// Extraído de orcamento-teste.jsx (Fase 1 do refactor de orçamento).
// Funções dependentes (TextoEditavel, BlocoFormaPagamentoView, helpers de
// formatação, etc.) continuam em orcamento-teste.jsx — ficam disponíveis
// via escopo global do bundle concatenado pelo combine.js.
//
// Símbolos exportados (escopo global pós-combine):
//   - TEMPLATES_PROPOSTA          catálogo dos templates disponíveis
//   - TemplateBarProposta         barra de seleção no topo do preview
//   - PropostaPreview             wrapper que escolhe template via templateId
//   - PropostaPreviewEditorial    implementação do template "Padrão"
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// SISTEMA DE TEMPLATES DE PROPOSTA
//
// Catálogo de modelos disponíveis na barra do topo da PropostaPreview.
// Cada modelo é um layout visual diferente da MESMA proposta — todas as
// informações (valores, descontos, escopo, etapas, aceite) aparecem em
// todos os modelos. Só muda apresentação.
//
// Implementação atual: o JSX de cada modelo está dentro do componente
// PropostaPreviewEditorial, em funções renderEditorial()/renderDireto()
// que usam o mesmo conjunto de estados/handlers. Trocar de modelo NÃO
// perde edições inline (mesmo componente, mesma instância).
//
// `templateId` é persistido no snapshot da proposta (ver
// buildPropostaSnapshot). Propostas antigas sem templateId caem no
// default "01-editorial".
//
// Para adicionar um modelo novo:
//   1. Adicionar entrada aqui em TEMPLATES_PROPOSTA
//   2. Implementar função renderXxx() dentro do PropostaPreviewEditorial
//   3. Adicionar case no switch do return final desse componente
// ═══════════════════════════════════════════════════════════════
const TEMPLATES_PROPOSTA = [
  {
    id: "01-editorial",
    label: "Padrão",
    desc: "Sóbrio, preto e branco",
    accent: "#111827",
  },
  {
    id: "02-direto",
    label: "Direto",
    desc: "Header colorido, prático",
    accent: "#fbbf24",
  },
  // Roadmap (descomentar quando implementado, junto com renderXxx no componente):
  // { id:"03-corporativo", label:"Corporativo", desc:"Tabelas formais, serifa", accent:"#1f2937" },
  // { id:"04-magazine",    label:"Magazine",    desc:"Editorial, numeração lateral", accent:"#374151" },
  // { id:"05-timeline",    label:"Timeline",    desc:"Etapas como jornada", accent:"#0f172a" },
  // { id:"06-report",      label:"Report",      desc:"Dashboard executivo, 2 colunas", accent:"#475569" },
  // { id:"07-cards",       label:"Cards",       desc:"Cartões modulares", accent:"#0f172a" },
  // { id:"08-editorial-visual", label:"Editorial Visual", desc:"Capa SVG + paletas", accent:"#b7896a" },
  // { id:"09-wabi-sabi",   label:"Wabi-Sabi",   desc:"Minimalismo japonês", accent:"#c9a460" },
];

// Barra de seleção de modelos — sticky no topo do preview.
// Esconde quando lockEdicao (proposta finalizada/visualização readonly).
// Quando só há 1 modelo ativo a barra ainda é mostrada — feedback visual
// de qual modelo está ativo, mesmo sem opção de troca.
//
// Cada botão tem:
//   - Thumbnail visual (40×52) com mini-representação do layout
//   - Nome curto do modelo (Padrão, Direto, etc.)
// Indicação visual de modelo ativo: borda preta 2px + fundo cinza claro.
function TemplateBarProposta({ templateId, onChange, lockEdicao }) {
  if (lockEdicao) return null;
  return (
    <div style={{
      position:"sticky", top:0, zIndex:20, background:"#fff",
      borderBottom:"1px solid #e5e7eb", padding:"10px 16px",
      display:"flex", alignItems:"center", gap:10, overflowX:"auto",
      fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",
    }}>
      <span style={{
        fontSize:10, fontWeight:700, color:"#9ca3af",
        textTransform:"uppercase", letterSpacing:"0.1em",
        flexShrink:0, marginRight:4,
      }}>
        Modelo:
      </span>
      {TEMPLATES_PROPOSTA.map(t => {
        const ativo = templateId === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              flexShrink:0,
              padding: ativo ? "5px 9px 4px" : "6px 10px 5px",
              border: ativo ? "2px solid #111" : "1px solid #e5e7eb",
              background: ativo ? "#fafbfc" : "#fff",
              borderRadius:8, cursor:"pointer", fontFamily:"inherit",
              display:"flex", flexDirection:"column", alignItems:"center", gap:3,
              minWidth:78, transition:"all 0.15s",
            }}>
            {/* Thumbnail visual de cada modelo. SVG mini-mockup. */}
            <span aria-hidden="true" style={{ display:"inline-block", width:40, height:52 }}>
              {t.id === "01-editorial" && (
                <svg viewBox="0 0 40 52" width="40" height="52" style={{ borderRadius:3, border:"0.5px solid #e5e7eb", background:"#fff" }}>
                  <rect x="3" y="3" width="11" height="6" fill="#111" rx="1"/>
                  <line x1="3" y1="14" x2="37" y2="14" stroke="#111" strokeWidth="1"/>
                  <line x1="3" y1="20" x2="32" y2="20" stroke="#9ca3af" strokeWidth="0.5"/>
                  <line x1="3" y1="24" x2="34" y2="24" stroke="#9ca3af" strokeWidth="0.5"/>
                  <line x1="3" y1="32" x2="20" y2="32" stroke="#9ca3af" strokeWidth="0.7"/>
                  <line x1="3" y1="38" x2="30" y2="38" stroke="#9ca3af" strokeWidth="0.5"/>
                  <line x1="3" y1="42" x2="28" y2="42" stroke="#9ca3af" strokeWidth="0.5"/>
                  <line x1="3" y1="46" x2="32" y2="46" stroke="#9ca3af" strokeWidth="0.5"/>
                </svg>
              )}
              {t.id === "02-direto" && (
                <svg viewBox="0 0 40 52" width="40" height="52" style={{ borderRadius:3, border:"0.5px solid #e5e7eb", background:"#fff" }}>
                  <rect x="0" y="0" width="40" height="18" fill="#fbbf24"/>
                  <text x="3" y="13" fontSize="6" fontWeight="800" fill="#111">PROPOSTA</text>
                  <line x1="3" y1="24" x2="34" y2="24" stroke="#fbbf24" strokeWidth="1"/>
                  <line x1="3" y1="29" x2="28" y2="29" stroke="#374151" strokeWidth="0.5"/>
                  <line x1="3" y1="33" x2="32" y2="33" stroke="#9ca3af" strokeWidth="0.5"/>
                  <line x1="3" y1="40" x2="30" y2="40" stroke="#fbbf24" strokeWidth="1"/>
                  <line x1="3" y1="45" x2="34" y2="45" stroke="#9ca3af" strokeWidth="0.5"/>
                </svg>
              )}
            </span>
            <span style={{ fontSize:11, fontWeight: ativo ? 600 : 500, color: ativo ? "#111" : "#374151" }}>
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Wrapper PropostaPreview — decide qual template renderizar com base
// em `templateId` (vindo do snapshot, do data ou default "01-editorial").
// Hoje só Editorial existe; quando novos viewers forem criados, switch
// aqui abaixo cresce. Editorial é sempre o fallback seguro.
function PropostaPreview(props) {
  const safeData = props.data || {};
  const initialTpl = props.propostaSnapshot?.templateId || safeData.templateId || "01-editorial";
  const [templateId, setTemplateId] = useState(initialTpl);

  // Seleção de viewer. Por enquanto só Editorial. Quando implementar
  // novos templates, adicionar aqui:
  //   templateId === "02-arquitetonico" ? PropostaTemplateArquitetonico :
  //   templateId === "03-premium"       ? PropostaTemplatePremium :
  //   ...
  //   PropostaPreviewEditorial; // fallback
  const renderEditorial = (
    <PropostaPreviewEditorial {...props} templateId={templateId} />
  );

  return (
    <div>
      <TemplateBarProposta
        templateId={templateId}
        onChange={setTemplateId}
        lockEdicao={props.lockEdicao}
      />
      {renderEditorial}
    </div>
  );
}

function PropostaPreviewEditorial({ data, onVoltar, onSalvarProposta, propostaReadOnly, propostaSnapshot, lockEdicao, templateId }) {
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

  // Imposto: NÃO é mais state local desde o Deploy 1 da refatoração de pagamento.
  // Decidido no Passo 1 do Form (toggle + input de alíquota perto do "Repetição")
  // e chega via data.temImposto / data.aliqImp (live sync via liveData no Form).
  // Snapshots antigos têm os valores capturados no snap — usamos como fallback
  // pra que propostas salvas antes mudarem o imposto continuem renderizando
  // exatamente como foram geradas (snapshot é histórico/imutável).
  const temImposto = snap?.temImposto ?? data.temImposto ?? false;
  const aliqImp    = snap?.aliqImp    ?? data.aliqImp    ?? 16;
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
  // CRITICAL: arqEdit/engEdit devem refletir o cálculo ATUAL em modo de edição.
  // Antes o código usava snap.arqEdit sem ressalva, o que causava:
  //   - Usuário editava orçamento (ex: adicionava cômodos) → valor no form subia
  //   - Clicava "Gerar Orçamento" → preview da proposta mostrava valor antigo
  //     (da v1 salva) porque snap.arqEdit era priorizado
  //   - Salvava v2 com valor da v1 → card mostrava v2 mas com valor velho
  // Agora: só usa snap quando a proposta está travada (modoVer / lockEdicao),
  // onde não faz sentido recalcular. Em edição normal, calculo atual ganha.
  // Trade-off: edição manual inline do valor não é preservada entre sessões
  // de edição — mas esse caso é raro e evitar o bug principal é prioridade.
  const [arqEdit, setArqEdit]               = useState(() => {
    if (lockEdicao && snap?.arqEdit != null) return snap.arqEdit;
    return incluiArq ? (calculo.precoArq || 0) : 0;
  });
  const [engEdit, setEngEdit]               = useState(() => {
    if (lockEdicao && snap?.engEdit != null) return snap.engEdit;
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
  // Dados do escritório — propagados pelo FormOrcamentoProjetoTeste em `data.escritorio`.
  // Se o escritório não estiver cadastrado (primeiro uso, rascunho antigo),
  // os campos ficam vazios e o usuário pode preencher manualmente no preview.
  const escritorio = safeData.escritorio || {};
  // Primeiro responsável técnico: usado como responsável padrão da proposta
  // (nome + CAU). Outros responsáveis podem ser selecionados via edição inline
  // dos campos "responsavelEdit" / "cauEdit" no próprio preview.
  const _respEsc = (escritorio.responsaveis && escritorio.responsaveis.length > 0)
    ? escritorio.responsaveis[0]
    : null;
  // Nome formal do responsável: assume "Arq." como prefixo padrão.
  // Se o escritório futuramente quiser outros títulos (Eng., etc.), adicionar
  // campo tituloProfissional em responsaveis[i] e usar aqui.
  const _respNome = _respEsc?.nome ? `Arq. ${_respEsc.nome}` : "";
  // CAU + cidade (padrão da proposta): "CAU A12345-6 · Ourinhos"
  const _cauCidade = [_respEsc?.cau, escritorio.cidade].filter(Boolean).join(" · ");
  // PIX: prefixo "PIX · " + chave + opcionalmente banco.
  // Formato típico: "PIX · Chave CNPJ: 12.345.678/0001-00 · Banco Sicoob"
  const _pixLabel = (() => {
    if (!escritorio.pixChave) return "";
    const tipo = escritorio.pixTipo || "Chave";
    const banco = escritorio.banco ? ` · Banco ${escritorio.banco}` : "";
    return `PIX · Chave ${tipo}: ${escritorio.pixChave}${banco}`;
  })();

  const [responsavelEdit, setResponsavelEdit] = useState(snap?.responsavelEdit ?? _respNome);
  const [cauEdit, setCauEdit]               = useState(snap?.cauEdit ?? _cauCidade);
  const [emailEdit, setEmailEdit]           = useState(snap?.emailEdit ?? (escritorio.email || ""));
  const [telefoneEdit, setTelefoneEdit]     = useState(snap?.telefoneEdit ?? (escritorio.telefone || ""));
  const [instagramEdit, setInstagramEdit]   = useState(snap?.instagramEdit ?? (escritorio.instagram || ""));
  const [cidadeEdit, setCidadeEdit]         = useState(snap?.cidadeEdit ?? (escritorio.cidade || ""));
  const [pixEdit, setPixEdit]               = useState(snap?.pixEdit ?? _pixLabel);
  const [labelApenasEdit, setLabelApenasEdit] = useState(snap?.labelApenasEdit ?? null);

  // Logo do escritório — vem de data.escritorio.logo (salvo no banco via
  // PUT /api/escritorio) ou do snapshot da proposta (se salva antes).
  // Snapshot tem prioridade pra preservar proposta histórica mesmo se o
  // escritório trocar o logo depois.
  const [logoPreview, setLogoPreview]       = useState(snap?.logoPreview ?? (escritorio.logo || null));

  // Patch: logo agora vem APENAS do cadastro do escritório (data.escritorio.logo).
  // Removido upload/remoção inline no Preview — sem confusão sobre onde editar.
  // Pra mudar o logo, o usuário vai na aba Escritório → Dados Gerais.

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
  // Texto vindo do Template de Edição (Fase 4+). Prioridade: template > edit
  // inline (resumoEdit) > dinâmico computado. Se o usuário pulou o template
  // ou abriu uma proposta antiga sem template, txTpl fica vazio e o fallback
  // mantém o comportamento legado.
  const txTpl = data?.template?.textos || {};
  const resumoFinal = (txTpl.descricaoProjeto && txTpl.descricaoProjeto.trim())
    ? txTpl.descricaoProjeto
    : (resumoEdit !== null ? resumoEdit : resumoDinamico);

  // Manipuladores de etapas (isolar, adicionar, remover, editar %)
  function toggleIsolarEtapa(id) {
    setEtapasIsoladasLocal(prev => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }
  function removerEtapa(id) {
    if (id === 5) { dialogo.alertar({ titulo: "Etapa de Engenharia", mensagem: "A etapa de Engenharia não pode ser removida por aqui. Use o toggle de Engenharia na Tela 1 para excluir.", tipo: "aviso" }); return; }
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

  // Overrides do Template de Edição (Fase 5+). Quando o usuário editou os
  // textos no template, eles têm prioridade sobre os defaults dinâmicos.
  // Parsing: o template guarda como texto livre; aqui convertemos linhas
  // com bullets ("• item") em arrays estruturados pro modelo renderizar.
  const naoInclTpl = (txTpl.naoInclusos && txTpl.naoInclusos.trim())
    ? txtParseListaDeTexto(txTpl.naoInclusos).map(l => ({ label: l, sub: null }))
    : null;
  const prazoTpl = (txTpl.prazo && txTpl.prazo.trim())
    ? txtParseListaDeTexto(txTpl.prazo)
    : null;
  const aceiteTpl = (txTpl.aceite && txTpl.aceite.trim()) ? txTpl.aceite : null;
  const apresentacaoTpl = (txTpl.apresentacao && txTpl.apresentacao.trim()) ? txTpl.apresentacao : null;
  const observacoesTpl = (txTpl.observacoes && txTpl.observacoes.trim()) ? txTpl.observacoes : null;
  const escopoTextoTpl = (txTpl.escopo && txTpl.escopo.trim()) ? txTpl.escopo : null;

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

  // Sec (Editorial): wrapper de seção com regras automáticas de spacing e
  // page-break.
  //   - mt: margem superior do título da seção (default 28)
  //   - mb: margem inferior do bloco inteiro (default 24) — garante respiro
  //         consistente entre seções, independente do que vem antes/depois
  //   - breakInside avoid: pra PDF/impressão, impede que a seção quebre no
  //     meio entre páginas. Lista grande pode quebrar (limite do navegador),
  //     mas seções pequenas e cards ficam íntegros.
  const Sec = ({title, mt, mb=24, children, action}) => (
    <div className="proposta-section" style={{
      marginBottom: mb,
      breakInside: "avoid",
      pageBreakInside: "avoid",
    }}>
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
      // Template visual escolhido (Editorial, Arquitetônico, etc.).
      // Persistido pra que ao reabrir a proposta abra no mesmo layout.
      // Default "01-editorial" mantém compat com propostas antigas.
      templateId: templateId || "01-editorial",
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
      // ── VALORES EXIBIDOS (fonte única da verdade pro que o cliente viu) ──
      // No modo "padrao": arqCIEdit + engCIEdit (100% de cada)
      // No modo "etapas": totalPacoteEtapas (soma das etapas ativas + eng se ativa)
      valorArqExibido: incluiArq ? (isPadrao ? arqCIEdit : subTotalArqEtapas) : 0,
      valorEngExibido: engAtiva ? engCIEdit : 0,
      valorTotalExibido: isPadrao
        ? (totCIEdit)
        : totalPacoteEtapas,
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
          imagens = await rasterizarPdfParaImagens(blob, { maxWidth: 1000, quality: 0.6 });
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
      dialogo.alertar({ titulo: "Erro ao salvar proposta", mensagem: e.message, tipo: "erro" });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // GERAÇÃO DE PDF — DOIS CAMINHOS
  //
  // 1. handlePdfPuppeteer (NOVO): chama backend que usa puppeteer
  //    pra gerar PDF a partir da própria PropostaPreview renderizada.
  //    Resultado: PDF é espelho exato do que aparece na tela. Funciona
  //    para qualquer modelo (Padrão, Direto, futuros). Backend gerencia
  //    Chrome headless, JWT one-time-use, cache de payload.
  //
  // 2. handlePdfLegacy (ANTIGO): jsPDF client-side, código atual em
  //    resultado-pdf.jsx. Gera PDF do Modelo Padrão usando layout
  //    hard-coded em código. Mantido como fallback enquanto
  //    Puppeteer ainda não está totalmente confiável em produção.
  //
  // 3. handlePdf (DISPATCHER): decide qual caminho usar:
  //    - Em modelo Padrão (01-editorial), pode usar legacy (rápido,
  //      sem cold-start) ou puppeteer (espelho perfeito). Default: legacy
  //      pra preservar comportamento atual.
  //    - Em modelo Direto (02-direto) e demais novos: usa puppeteer.
  //    - Se puppeteer falhar (timeout, 5xx), fallback automático
  //      pro legacy quando aplicável.
  //
  // Toggle de feature:
  //   window.__VICKE_USE_PUPPETEER = true → força puppeteer pra todos
  //   window.__VICKE_USE_PUPPETEER = false → força legacy pra todos
  //   undefined (default) → puppeteer só pra modelos não-Padrão
  // ═══════════════════════════════════════════════════════════════

  // Helper: chama backend e baixa PDF.
  // Retorna blob se opts.returnBlob = true; senão dispara download.
  const handlePdfPuppeteer = async (opts = {}) => {
    try {
      // Monta payload mínimo necessário pro backend reproduzir a tela
      const snapshot = buildPropostaSnapshot();
      const payload = {
        snapshot,
        orcamento: data || {},
        escritorio: escritorio || {},
        templateId: templateId,
        clienteNome: clienteNome || "",
      };

      // URL base da API (mesmo padrão usado em app.jsx, escritorio.jsx, etc).
      // Em produção: vicke.com.br chama orbi-production-5f5c.up.railway.app
      // Em dev: VITE_API_URL pode apontar pra localhost:3000
      const _API_URL = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL)
        || "https://orbi-production-5f5c.up.railway.app";

      const tok = (typeof window !== "undefined" && window.localStorage)
        ? window.localStorage.getItem("vicke-token") : null;
      const resp = await fetch(`${_API_URL}/api/proposta/gerar-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tok ? { "Authorization": "Bearer " + tok } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        // Tenta extrair mensagem de erro
        let msg = "Falha na geração do PDF";
        try {
          const j = await resp.json();
          msg = j.error || msg;
        } catch (_) {}
        throw new Error(`${msg} (HTTP ${resp.status})`);
      }

      const blob = await resp.blob();

      if (opts.returnBlob) return blob;

      // Dispara download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proposta-${(clienteNome || "cliente").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("[puppeteer-pdf] erro:", e);
      throw e; // propaga pra dispatcher decidir fallback
    }
  };

  // Versão jsPDF antiga — preservada como fallback
  const handlePdfLegacy = async (opts = {}) => {
    if (!window.jspdf) { dialogo.alertar({ titulo: "Aguarde alguns segundos", mensagem: "A biblioteca de PDF ainda está carregando.", tipo: "aviso" }); return; }
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

      // Patch (Refator de Pagamento): reconstrói o objeto canônico formaPagamento
      // pro PDF usar a mesma lógica do Preview. Aplica os overrides locais de
      // valores editados (descArqLocal, parcArqLocal, etc.) sobre o snapshot
      // que veio da Etapa 5 (data.formaPagamento).
      const fpBase = data.formaPagamento || {};
      const formaPagamentoPdf = {
        ...fpBase,
        antecipado: { descArq: descArqLocal, descPac: descPacoteLocal },
        parcelas:   { parcArq: parcArqLocal, parcPac: parcPacoteLocal },
        // final / contratacoes / formas / etapa vêm do snapshot da Etapa 5
        etapa: {
          ...(fpBase.etapa || {}),
          // Overrides do Preview pras modalidades de etapa
          modalidadeEtapa: { desconto: descEtCtrtLocal, parcelas: parcEtCtrtLocal },
          modalidade2:     { desconto: descPacCtrtLocal, parcelas: parcPacCtrtLocal },
          // etapas/isoladas vêm do snapshot pra refletir o que o user marcou na Etapa 5
        },
      };

      const orc = { id:"teste-"+Date.now(), cliente:data.clienteNome||"Cliente", tipo:data.tipoProjeto, subtipo:data.tipoObra, padrao:data.padrao, tipologia:data.tipologia, tamanho:data.tamanho, comodos:data.comodos||[], tipoPagamento:tipoPgto, descontoEtapa:descArqLocal, parcelasEtapa:parcArqLocal, descontoPacote:descPacoteLocal, parcelasPacote:parcPacoteLocal, descontoEtapaCtrt:descEtCtrtLocal, parcelasEtapaCtrt:parcEtCtrtLocal, descontoPacoteCtrt:descPacCtrtLocal, parcelasPacoteCtrt:parcPacCtrtLocal, etapasPct:etapasPdfFinal, incluiImposto:temImposto, aliquotaImposto:aliqImp, etapasIsoladas:Array.from(idsIsolados), totSI:0, criadoEm:new Date().toISOString(), resultado:r,
        // Patch (Refator de Pagamento): objeto canônico pro PDF novo
        formaPagamento: formaPagamentoPdf,
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
      const modelo = defaultModelo(orc, arqTotal, engTotal, grandTotal, fmt, fmtM2, nUnid, engUnit, r, escritorio);
      if (resumoFinal && modelo.cliente) modelo.cliente.resumo = resumoFinal;
      // Sobrescreve subtítulo no modelo (modo estilo C do PDF usa modelo.subtitulo)
      if (modelo && subTituloFinal) modelo.subtitulo = subTituloFinal;
      const blob = await buildPdf(orc, logoPreview, modelo, null, "#ffffff", incluiArq, incluiEng, { returnBlob: opts.returnBlob, escritorio });
      if (opts.returnBlob) return blob;
    } catch(e) { console.error(e); dialogo.alertar({ titulo: "Erro ao gerar PDF", mensagem: e.message, tipo: "erro" }); }
  };

  // Dispatcher: decide entre Puppeteer (novo, espelho da preview) e
  // Legacy (jsPDF, hard-coded). Ver bloco de comentários acima das
  // duas funções pra detalhes da estratégia.
  const handlePdf = async (opts = {}) => {
    // Override manual via window (debug/testing)
    let forcaPuppeteer = null;
    if (typeof window !== "undefined" && typeof window.__VICKE_USE_PUPPETEER === "boolean") {
      forcaPuppeteer = window.__VICKE_USE_PUPPETEER;
    }

    // Patch (Refator de Pagamento): Puppeteer como default pra TODOS os
    // templates, inclusive 01-editorial. Garante que o PDF é espelho exato
    // do Preview (incluindo o novo BlocoFormaPagamentoView). O legacy fica
    // só como fallback se Puppeteer falhar.
    // Antes: puppeteer só pra não-Padrão (templateId !== "01-editorial")
    const usarPuppeteer = forcaPuppeteer !== null ? forcaPuppeteer : true;

    if (!usarPuppeteer) {
      return await handlePdfLegacy(opts);
    }

    // Tenta puppeteer; se falhar, fallback pro legacy.
    try {
      return await handlePdfPuppeteer(opts);
    } catch (e) {
      console.warn("[handlePdf] puppeteer falhou:", e.message);

      // Fallback: avisa o usuário que o PDF de fallback pode não estar
      // 100% fiel ao visual atual (legacy ainda usa formato Padrão antigo).
      const ok = await new Promise(resolve => {
        if (typeof dialogo === "undefined" || !dialogo.confirmar) {
          resolve(true); return;
        }
        dialogo.confirmar({
          titulo: "Geração de PDF temporariamente indisponível",
          mensagem: `Não foi possível gerar o PDF agora. Quer baixar uma versão alternativa? Pode haver pequenas diferenças visuais. (${e.message})`,
          tipo: "aviso",
          onSim: () => resolve(true),
          onNao: () => resolve(false),
        });
      });
      if (ok) {
        return await handlePdfLegacy(opts);
      }
      throw e;
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // MODELO DIRETO — render alternativo
  //
  // Layout estilo "proposta amarela" — header colorido grande no topo +
  // corpo corrido com listas/bullets. Visual prático, sem capa separada,
  // sem fundo decorativo. Reusa TODOS os estados/handlers do componente
  // (arqEdit, etapasPct, escopoState, descontos, etc.) — só muda como
  // organiza visualmente.
  //
  // Conteúdo: igual ao Editorial (objetivo + serviços inclusos +
  // entregáveis em linha + frase de fechamento por etapa, lista
  // completa de não inclusos, forma de pagamento estruturada com PIX,
  // aceite formal e footer).
  //
  // Diferença visual em relação ao Editorial:
  //  - Header amarelo grande (não capa fotográfica)
  //  - Sem cards estruturados — corpo corrido com seções
  //  - Bullets ○ em vez de •
  //  - Cor accent amarela em títulos de seção
  // ═══════════════════════════════════════════════════════════════
  const renderDireto = () => {
    // Cor accent do Direto. Hard-coded por enquanto. No futuro vira
    // sub-paleta do modelo (Solar/Terracota/Navy/Sage/Preto).
    const ACCENT = "#fbbf24";
    const ACCENT_FG = "#111";  // Texto sobre o accent (preto sobre amarelo)

    // Estilos locais do modelo Direto
    //
    // Cor accent (#fbbf24, amber 400) é usada como background do header,
    // dos destaques de valor e como label colorida nos títulos.
    // Cor secundária (#412402, amber 900) é usada pra texto sobre o accent
    // e pra labels de seção sobre fundo branco — bom contraste em ambos.
    const D = {
      wrap: { fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", background:"#fff", minHeight:"100vh", color:"#111" },
      page: { maxWidth:860, margin:"0 auto", padding:0, background:"#fff" },
      // Header: 3 colunas IGUAIS (33.33% cada) com bordas externas arredondadas.
      // Esquerda (amarela) → "PROPOSTA DE PROJETO"
      // Meio (preta) → Logo do escritório ocupando TODO o bloco
      // Direita (amarela) → cidade · validade em negrito
      // overflow:hidden + borderRadius dão o efeito de "as 3 colunas dentro
      // de um container retangular arredondado", igual ao mockup.
      header: {
        display:"flex",
        alignItems:"stretch",
        background:ACCENT,
        borderRadius:8,
        overflow:"hidden",
        minHeight:160,
      },
      // Coluna esquerda (amarela) — 1/3
      colEsq: {
        flex:"1 1 0",
        background:ACCENT,
        padding:"32px 28px",
        display:"flex",
        alignItems:"center",
      },
      // Coluna meio (preta) — 1/3, sem padding pra logo ocupar tudo.
      // Background #000 (preto puro) pra coincidir com fundo do PNG do
      // logo da Padovan e evitar contraste visível entre os 2 pretos.
      colMeio: {
        flex:"1 1 0",
        background:"#000",
        padding:0,
        display:"flex",
        alignItems:"center",
        justifyContent:"center",
        position:"relative",
        overflow:"hidden",
      },
      // Coluna direita (amarela) — 1/3
      // justifyContent stretch + filhos com width:100% pra que o
      // text-align:justify do <div> de OURINHOS funcione (esticar
      // letras pra ocupar a largura toda).
      colDir: {
        flex:"1 1 0",
        background:ACCENT,
        padding:"24px 24px",
        display:"flex",
        alignItems:"center",
      },
      headerTitulo: {
        fontSize:32,
        fontWeight:800,
        color:ACCENT_FG,
        lineHeight:1.05,
        letterSpacing:"-0.02em",
      },
      // Cidade · validade em negrito (decisão do usuário)
      // width:100% pra ocupar toda a coluna direita (necessário pro
      // justify funcionar na linha OURINHOS).
      headerEyebrow: {
        fontSize:12,
        fontWeight:700,
        color:"#111",
        letterSpacing:"0.04em",
        lineHeight:1.4,
        width:"100%",
      },
      // Corpo — padding lateral 40px e padding inferior 80px,
      // padronizados com Padrão (page: padding "32px 40px 80px").
      // Padding superior 32px deixa o conteúdo respirar do header amarelo.
      conteudo: { padding:"32px 40px 80px" },
      saudacao: { fontSize:13, color:"#374151", lineHeight:1.65, marginBottom:14 },
      saudacaoB: { color:"#111", fontWeight:600 },
      descricaoProjeto: { fontSize:13, color:"#374151", lineHeight:1.65, marginBottom:18, whiteSpace:"normal", wordBreak:"break-word" },
      // Títulos de seção: estilo mockup — pequeno, amber 900, letterspacing,
      // com linha sutil embaixo
      secTit: {
        fontSize:11, fontWeight:600, color:"#412402",
        textTransform:"uppercase", letterSpacing:"0.08em",
        margin:"22px 0 10px", paddingBottom:6,
        borderBottom:"0.5px solid #e5e7eb",
      },
      secTexto: { fontSize:13, color:"#374151", lineHeight:1.65, marginBottom:8, whiteSpace:"normal", wordBreak:"break-word" },
      // Estrutura de etapa
      etapaTitulo: { fontSize:14, color:"#111", fontWeight:700, margin:"16px 0 6px" },
      etapaObjetivo: { fontSize:12.5, color:"#6b7280", fontStyle:"italic", marginBottom:8, lineHeight:1.55 },
      etapaSubsec: { fontSize:11, color:"#92400e", textTransform:"uppercase", letterSpacing:"0.06em", margin:"8px 0 4px", fontWeight:600 },
      itemBullet: { fontSize:12.5, color:"#374151", paddingLeft:18, position:"relative", lineHeight:1.6, marginBottom:3 },
      bulletDot: { position:"absolute", left:2, color:"#9ca3af", fontSize:11, top:1 },
      entregaveisInline: { fontSize:12, color:"#6b7280", marginTop:6, lineHeight:1.55, paddingLeft:0 },
      entregaveisLabel: { color:"#92400e", fontWeight:600 },
      etapaFraseFim: { fontSize:11.5, color:"#9ca3af", fontStyle:"italic", marginTop:6, lineHeight:1.5 },
      grupoCols: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, margin:"6px 0" },
      // Cards de valor: bordas mais arredondadas (8px) igual ao mockup
      destaqueVlr: { background:ACCENT, padding:"18px 22px", borderRadius:8, margin:"6px 0", display:"flex", justifyContent:"space-between", alignItems:"baseline", breakInside:"avoid", pageBreakInside:"avoid" },
      destaqueVlrLight: { background:"#FAEEDA", padding:"18px 22px", borderRadius:8, margin:"6px 0", display:"flex", justifyContent:"space-between", alignItems:"baseline", breakInside:"avoid", pageBreakInside:"avoid" },
      destaqueLbl: { fontSize:14, fontWeight:700, color:"#412402", textTransform:"uppercase", letterSpacing:"0.06em" },
      destaqueNum: { fontSize:30, fontWeight:800, color:"#412402" },
      // Card "Total sem impostos" sutil em cinza claro (igual mockup)
      totalSubtle: { background:"#f9fafb", padding:"10px 22px", borderRadius:8, margin:"4px 0 14px", fontSize:12, color:"#6b7280" },
      totalSubtleB: { color:"#111", fontWeight:600 },
      // Forma de pagamento estruturada
      pgtoBloco: { marginTop:14, marginBottom:8, breakInside:"avoid", pageBreakInside:"avoid" },
      pgtoBlocoTit: { fontSize:13, fontWeight:700, color:"#111", margin:"6px 0 6px" },
      pgtoOpcao: { fontSize:12.5, color:"#374151", lineHeight:1.6, padding:"6px 0", borderBottom:"0.5px solid #f3f4f6" },
      pgtoOpcaoLbl: { fontSize:11, color:"#92400e", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em" },
      pgtoLinhaB: { color:"#111", fontWeight:700 },
      pixLinha: { fontSize:11.5, color:"#6b7280", marginTop:10, lineHeight:1.5 },
    };

    // Etapas com valores calculados (mesma fonte usada no Editorial)
    // Usa os valores COM imposto se ligado (arqCIEdit/engCIEdit/totCIEdit)
    // pra ficar consistente com o que o Editorial mostra.
    const arqVal = isPadrao ? arqCIEdit : subTotalArqEtapas;
    const engVal = engAtiva ? engCIEdit : 0;
    const totVal = isPadrao ? totCIEdit : totalPacoteEtapas;

    // Pra cada etapa Arq, calcula valor pelo pct (não exibido nesse modelo,
    // mas calculado pra preservar compat se quiser usar depois)
    const etapasArqValor = etapasPct.filter(e => e.id !== 5).map(e => ({
      ...e, valor: (arqVal * e.pct) / 100,
    }));
    const engPct = etapasPct.find(e => e.id === 5)?.pct || 0;

    // ── FONTES DE DADOS ────────────────────────────────────────────
    // O Modelo Direto NÃO inventa dados nem tem defaults próprios.
    // Lê EXATAMENTE das mesmas fontes que o Modelo Padrão usa, no
    // escopo deste componente (PropostaPreviewEditorial):
    //
    //   - naoInclDefault: array [{ label, sub }] calculado dinamicamente
    //     considerando incluiMarcenaria, temImposto, temIsoladas,
    //     idsIsolados, engAtiva, incluiArq.
    //   - naoInclEdit: array editado pelo usuário (sobrescreve o default).
    //   - prazoDefault: array de strings calculado em função de isPadrao,
    //     incluiArq, engAtiva.
    //   - prazoEdit: array editado pelo usuário (sobrescreve o default).
    //
    // CRÍTICO: naoInclEdit e prazoEdit são ARRAYS (não strings). O
    // Modelo Padrão salva como array, então o Direto também tem que
    // ler como array. Compatibilidade total entre os 2 modelos.

    // Filtra prazos: prioriza template > editEdit inline > default. Esconde
    // linha de Engenharia se eng não está ativa.
    const prazosLista = (prazoTpl || prazoEdit || prazoDefault).filter(p => {
      if (typeof p !== "string") return true;
      if (p.toLowerCase().includes("engenharia")) {
        if (!engAtiva) return false;
      }
      return true;
    });

    // naoInclEdit pode estar em formato antigo (array de strings) ou
    // novo (array de { label, sub }). Normaliza pra { label, sub }.
    // Prioridade: template > naoInclEdit > naoInclDefault.
    const naoInclususLista = (() => {
      const fonte = naoInclTpl || naoInclEdit || naoInclDefault;
      if (!Array.isArray(fonte)) return [];
      return fonte.map(item => {
        if (typeof item === "string") return { label: item, sub: null };
        return item;
      });
    })();

    return (
      <div style={D.wrap} className="vk-prev-direto">
        {/* Estilos: lock de edição (UI) + supressão de elementos UI no PDF
            + media queries mobile (responsividade) */}
        <style>{`
          /* Page-break + spacing dinâmicos — mesmo CSS que o Editorial usa.
             Cada bloco com classe "proposta-section" evita quebrar entre
             páginas no PDF e respeita spacing consistente entre seções. */
          .vk-prev-direto .proposta-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          @media print {
            .vk-prev-direto .proposta-section {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            .vk-prev-direto h1, .vk-prev-direto h2, .vk-prev-direto h3 {
              break-after: avoid;
              page-break-after: avoid;
            }
          }

          /* Default desktop: esconde versão mobile da tabela bfp */
          .vk-prev-direto .vk-bfp-mobile-only { display: none; }
          @media (max-width: 640px) {
            /* Container principal: padding reduzido */
            .vk-prev-direto > div[style*="padding"] {
              padding: 16px 14px 60px !important;
            }
            .vk-prev-direto, .vk-prev-direto > div { overflow-x: hidden; max-width: 100%; }
            /* BlocoFormaPagamentoView: alterna desktop/mobile */
            .vk-prev-direto .vk-bfp-desktop-only { display: none !important; }
            .vk-prev-direto .vk-bfp-mobile-only { display: block !important; }
            .vk-prev-direto .vk-bfp-etapas-grid {
              grid-template-columns: 1fr 50px 90px !important;
              gap: 6px !important;
              padding: 8px 10px !important;
              font-size: 11.5px !important;
            }
            .vk-prev-direto .vk-bfp-mods {
              grid-template-columns: 1fr !important;
            }
            .vk-prev-direto [data-mobile-stack="1"] {
              grid-template-columns: 1fr !important;
            }
            .vk-prev-direto img { max-width: 100%; height: auto; }
          }
          ${lockEdicao ? `
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
          ` : ""}
          /* Esconder elementos de UI quando renderizando no contexto de PDF
             (puppeteer abre /render-pdf/* que tem .render-pdf-context no body).
             Isso mata o banner verde "Visualização da proposta enviada", botões de
             edição, e qualquer outro elemento marcado com .no-print.
             Também escondemos quando lockEdicao=true (modo visualização da
             proposta enviada) — banner é redundante. */
          .render-pdf-context .no-print,
          .render-pdf-context [data-no-print="true"],
          .lockEdicao-active .no-print {
            display: none !important;
          }
          /* Garantir cores de fundo no PDF (Chrome desliga por padrão pra
             economizar tinta — print-color-adjust:exact força impressão fiel). */
          .render-pdf-context * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Quebras de página: cada etapa do escopo deve evitar quebrar no meio.
             Aplicado a elementos críticos pra o PDF não cortar feio. */
          .etapa-bloco,
          .secao-bloco,
          .aceite-footer-bloco {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          /* Margens das páginas no PDF: 12mm uniforme em cima e embaixo
             em TODAS as páginas (Puppeteer config no backend). Mesma
             estratégia do Modelo Padrão. Trade-off conhecido: pág 1
             tem 12mm de margem branca acima do header amarelo, em troca
             de pág 2+ ganharem respiro natural ao virar página. */
        `}</style>

        {/* Banner verde de proposta salva — só em modo edição quando há propostaInfo.
            Aparece como notificação pequena, não interfere no header amarelo. */}
        {!lockEdicao && propostaInfo && (
          <div className="no-print" style={{ maxWidth:860, margin:"16px auto 0", padding:"10px 14px", background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8, fontSize:12.5, color:"#166534" }}>
            ✓ Proposta {propostaInfo.versao || ""} salva
            {propostaInfo.enviadaEm && ` · ${new Date(propostaInfo.enviadaEm).toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" })}`}
          </div>
        )}

        {/* Toolbar superior: Voltar (esquerda) + Gerar/Salvar PDF (direita).
            Mesma estrutura, posição e estilo do Modelo Padrão. Lógica idêntica:
            - Em lockEdicao OU já salva → "Gerar PDF" (chama handlePdf direto)
            - Em edição com onSalvarProposta → "Salvar e Gerar PDF" (abre modal)
            - Em edição sem onSalvarProposta → "Gerar PDF" (chama handlePdf direto)
            Largura limitada a maxWidth:860 e centralizado (mesmo eixo do header). */}
        <div className="no-print" style={{ maxWidth:860, margin:"16px auto 12px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
          <button onClick={onVoltar} style={{ background:"none", border:"1px solid #e5e7eb", borderRadius:8, padding:"7px 14px", fontSize:13, cursor:"pointer", fontFamily:"inherit", color:"#6b7280" }}>
            ← Voltar
          </button>
          {(propostaInfo || lockEdicao) ? (
            <button onClick={handlePdf} style={{ background:"#111", border:"none", borderRadius:8, padding:"8px 22px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", color:"#fff" }}>
              Gerar PDF
            </button>
          ) : (
            <button onClick={() => onSalvarProposta ? setConfirmSalvar(true) : handlePdf()}
              style={{ background:"#111", border:"none", borderRadius:8, padding:"8px 22px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", color:"#fff" }}>
              {onSalvarProposta ? "Salvar e Gerar PDF" : "Gerar PDF"}
            </button>
          )}
        </div>

        <div style={D.page} className={`${lockEdicao ? "proposta-locked lockEdicao-active" : ""}`}>
          {/* Header em 3 colunas com bordas externas arredondadas:
                ┌──────────────────────────────────────────────────┐
                │           │              │                       │
                │ PROPOSTA  │    [LOGO]    │  OURINHOS · VÁLIDO    │
                │ DE PROJETO│  (fundo:#111)│  ATÉ 18/05/2026       │
                │           │              │                       │
                │ (amarelo) │   (preto)    │      (amarelo)        │
                └──────────────────────────────────────────────────┘
              - Coluna esquerda (~38%): Título "PROPOSTA DE PROJETO" no amarelo
              - Coluna meio (~28%): Logo do escritório com fundo preto fixo
                (cor de fundo do logo será configurável no escritorio.jsx
                em sprint futura — por enquanto preto resolve a Padovan)
              - Coluna direita (~34%): cidade · validade em negrito
              No PDF, o header amarelo deve colar no topo da primeira página.
              Páginas seguintes ganham margem via headerTemplate vazio do
              Puppeteer (configurado no backend).
          */}
          <div style={D.header}>
            {/* Coluna esquerda (amarelo): título */}
            <div style={D.colEsq}>
              <div style={D.headerTitulo}>PROPOSTA<br/>DE PROJETO</div>
            </div>

            {/* Coluna meio (preto): logo ocupa todo o bloco mantendo
                proporção (width/height 100% + objectFit contain). */}
            <div style={D.colMeio}>
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt={escritorio.nome || "Escritório"}
                  style={{ width:"100%", height:"100%", objectFit:"contain", display:"block", padding:"6px 8px", boxSizing:"border-box" }}
                />
              ) : (
                <div style={{ fontSize:13, fontWeight:700, color:"#fff", letterSpacing:"0.05em", textAlign:"center", lineHeight:1.2, padding:"12px 16px" }}>
                  {escritorio.nome || "ESCRITÓRIO"}
                </div>
              )}
            </div>

            {/* Coluna direita (amarelo): cidade · validade em negrito.
                Quebra em 2 linhas pra não cortar quando a coluna é estreita
                (1/3 da largura): cidade em cima, validade embaixo. */}
            <div style={D.colDir}>
              <div style={D.headerEyebrow}>
                {/* Cidade alinhada à direita */}
                <div style={{ textAlign:"right" }}>
                  <TextoEditavel valor={(typeof cidadeEdit==="string" ? cidadeEdit : "OURINHOS").toUpperCase()} onChange={(v) => setCidadeEdit(v)} style={{ fontSize:12, fontWeight:700, color:"#111" }} />
                </div>
                {/* Validade alinhada à direita */}
                <div style={{ marginTop:2, textAlign:"right" }}>
                  <span>VÁLIDO ATÉ </span>
                  <TextoEditavel valor={validadeEdit} onChange={setValidadeEdit} style={{ fontSize:12, fontWeight:700, color:"#111" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Corpo */}
          <div style={D.conteudo}>
            <div style={D.saudacao}>
              Prezado(a) <span style={D.saudacaoB}>{clienteNome || "Cliente"}</span>,
            </div>
            <div style={D.saudacao}>
              {lockEdicao ? (
                <span>{subTituloFinal}</span>
              ) : (
                <TextoEditavel
                  valor={subTituloFinal}
                  onChange={setSubTituloEdit}
                  style={{ fontSize:13, color:"#374151" }}
                />
              )}
            </div>

            {/* Resumo do projeto (auto-gerado) — em modo lock, renderiza
                como texto puro pra não cortar com overflow do input. */}
            <div style={D.descricaoProjeto}>
              {(lockEdicao || txTpl.descricaoProjeto) ? (
                <span>{resumoFinal}</span>
              ) : (
                <InputControlado
                  valor={resumoFinal}
                  onCommit={(v) => setResumoEdit(v)}
                  placeholder="Descrição do projeto"
                  style={{ width:"100%", fontSize:13, color:"#374151", lineHeight:1.65 }}
                  multiline
                />
              )}
            </div>

            {/* APRESENTAÇÃO — texto livre opcional do Template de Edição.
                Aparece logo abaixo do resumo, antes dos honorários. */}
            {apresentacaoTpl && (
              <div className="proposta-section" style={{
                marginBottom: 24,
                breakInside: "avoid",
                pageBreakInside: "avoid",
              }}>
                <div style={D.secTit}>Apresentação</div>
                <div style={{
                  fontSize: 13, color: "#374151", lineHeight: 1.65,
                  whiteSpace: "pre-wrap",
                }}>
                  {apresentacaoTpl}
                </div>
              </div>
            )}

            {/* HONORÁRIOS:
                  - Cards de serviços (Arquitetura, Engenharia) com valores SEM imposto
                  - Linha sutil embaixo:
                    · Sem imposto: "Total sem impostos — R$ X"
                    · Com imposto: "+ Impostos — R$ Y · Total com impostos — R$ X"
                Forma de pagamento abaixo usa o total COM imposto (totCIEdit).
            */}
            <div style={D.secTit}>Honorários</div>
            {incluiArq && (
              <div style={D.destaqueVlr}>
                <div style={D.destaqueLbl}>Arquitetura</div>
                <div style={D.destaqueNum}>{fmtV(arqCI)}</div>
              </div>
            )}
            {incluiEng && (
              <div style={D.destaqueVlrLight}>
                <div style={D.destaqueLbl}>
                  Engenharia
                  <span style={{ fontSize:11, fontWeight:600, marginLeft:6, textTransform:"none" }}>(opcional)</span>
                </div>
                <div style={D.destaqueNum}>{fmtV(engCI)}</div>
              </div>
            )}
            {/* Linha sutil de total — formato muda conforme tem imposto ou não */}
            {temImposto ? (
              <div style={D.totalSubtle}>
                + Impostos ({aliqImp}%) — <span style={D.totalSubtleB}>{fmtV(impostoEdit)}</span>
                {" · "}
                Total com impostos — <span style={D.totalSubtleB}>{fmtV(totCIEdit)}</span>
              </div>
            ) : (
              (incluiArq && incluiEng) && (
                <div style={D.totalSubtle}>
                  Total sem impostos — <span style={D.totalSubtleB}>{fmtV(totSIEdit)}</span>
                </div>
              )
            )}

            {/* FORMA DE PAGAMENTO — Fase 1 do refator. Exibição vem do
                objeto canônico data.formaPagamento (preenchido na Etapa 5).
                Componente compartilhado entre Editorial e Direto. */}
            <div style={D.secTit}>Forma de pagamento</div>
            <BlocoFormaPagamentoView
              formaPagamento={data.formaPagamento}
              valorArq={arqCIEdit}
              valorEng={engCIEdit}
              incluiArq={incluiArq}
              incluiEng={incluiEng}
              accent="#fbbf24"
              pixTexto={null}
            />

            {/* PIX */}
            <div style={D.pixLinha}>
              {lockEdicao ? (
                <span>{pixEdit || ""}</span>
              ) : (
                <TextoEditavel valor={pixEdit} onChange={setPixEdit} style={{ fontSize:11.5, color:"#6b7280" }} />
              )}
            </div>

            {/* ESCOPO DOS SERVIÇOS — estrutura rica (Versão B do mockup) */}
            <div style={D.secTit}>Escopo dos serviços</div>
            <div style={D.secTexto}>
              O projeto compreenderá {incluiArq ? "o projeto arquitetônico" : ""}{incluiArq && incluiEng ? " e " : ""}{incluiEng ? "engenharia complementar (estrutural, elétrico e hidrossanitário)" : ""}, conforme detalhado abaixo:
            </div>

            {/* ESCOPO — Quando o usuário editou o escopo no Template de Edição
                (escopoTextoTpl), divide o texto pelos separadores "────────"
                e renderiza cada bloco com título destacado em badge cinza
                arredondado + corpo preformatado. Senão, usa o escopoDefault
                estruturado com cards por etapa. */}
            {escopoTextoTpl ? (
              escopoTextoTpl.split(/\n+─{4,}\n+/g).map((bloco, idx) => {
                const linhas = bloco.trim().split("\n");
                const titulo = linhas[0] || "";
                const corpo = linhas.slice(1).join("\n").trim();
                return (
                  <div key={idx} className="proposta-section" style={{
                    marginBottom: 24,
                    breakInside: "avoid",
                    pageBreakInside: "avoid",
                  }}>
                    <div style={{
                      display: "inline-block",
                      padding: "5px 14px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      background: "#fafbfc",
                      fontSize: 13, fontWeight: 600,
                      color: "#111", marginBottom: 10,
                    }}>
                      {titulo}
                    </div>
                    {corpo && (
                      <div style={{
                        whiteSpace: "pre-wrap",
                        fontSize: 13,
                        lineHeight: 1.65,
                        color: "#374151",
                      }}>
                        {corpo}
                      </div>
                    )}
                  </div>
                );
              })
            ) : escopoDefault.map((bloco, idx) => {
              const titulo = bloco.tituloNum || bloco.titulo || `Etapa ${idx + 1}`;
              const objetivo = bloco.objetivo || "";
              const itens = bloco.itens || [];
              const entregaveis = bloco.entregaveis || [];
              const obs = bloco.obs || "";
              return (
                <div key={bloco.etapaId || idx} className="etapa-bloco">
                  <div style={D.etapaTitulo}>{titulo}</div>

                  {objetivo && (
                    <div style={D.etapaObjetivo}>{objetivo}</div>
                  )}

                  {itens.length > 0 && (
                    <>
                      <div style={D.etapaSubsec}>Serviços inclusos</div>
                      {itens.map((it, ii) => (
                        <div key={ii} style={D.itemBullet}>
                          <span style={D.bulletDot}>○</span>
                          {it}
                        </div>
                      ))}
                    </>
                  )}

                  {entregaveis.length > 0 && (
                    <div style={D.entregaveisInline}>
                      <span style={D.entregaveisLabel}>Entregáveis:</span>
                      {" "}{entregaveis.join(", ")}
                    </div>
                  )}

                  {obs && (
                    <div style={D.etapaFraseFim}>{obs}</div>
                  )}
                </div>
              );
            })}

            {/* Engenharia: já incluída em escopoDefault acima quando engAtiva.
                Não duplicamos aqui. */}

            {/* PRAZOS — usa prazoDefault (mesma fonte do Padrão).
                Já filtrado pra esconder Engenharia quando !engAtiva.
                Em modo edição, mantém InputControlado em string pra compat
                (mas o ideal é o usuário editar pelo Modelo Padrão). */}
            <div style={D.secTit}>Prazo de execução</div>
            <div>
              {prazosLista.map((linha, i) => (
                <div key={i} style={{ ...D.itemBullet, breakInside:"avoid" }}>
                  <span style={D.bulletDot}>○</span>
                  {linha}
                </div>
              ))}
            </div>

            {/* SERVIÇOS NÃO INCLUSOS — usa naoInclDefault (mesma fonte do Padrão).
                Cada item é { label, sub }. Se naoInclEdit estiver definido,
                usa ele (formato do Padrão); senão usa o default calculado.
                Em modo locked, renderiza em 2 colunas (igual mockup/Padrão).
                Em modo edição, mostra um InputControlado em string (compat com
                editor antigo) — não é o modo recomendado mas mantém retrocompat. */}
            <div style={D.secTit}>Serviços não inclusos</div>
            {lockEdicao ? (
              <>
                <div style={{ columns:"2", columnGap:32, marginBottom:8 }}>
                  {naoInclususLista.map((item, i) => (
                    <div key={i} style={{ ...D.itemBullet, breakInside:"avoid", display:"flex", alignItems:"flex-start", marginBottom:4 }}>
                      <span style={D.bulletDot}>○</span>
                      <span style={{ flex:1 }}>
                        {item.label}
                        {item.sub && <span style={{ fontSize:11, color:"#9ca3af", marginLeft:4 }}>{item.sub}</span>}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ ...D.etapaFraseFim, marginTop:10 }}>
                  Todos os serviços não inclusos podem ser contratados como serviços adicionais.
                </div>
              </>
            ) : (
              <>
                <div style={{ columns:"2", columnGap:32, marginBottom:8 }}>
                  {naoInclususLista.map((item, i) => (
                    <div key={i} style={{ ...D.itemBullet, breakInside:"avoid", display:"flex", alignItems:"flex-start", marginBottom:4 }}>
                      <span style={D.bulletDot}>○</span>
                      <span style={{ flex:1 }}>
                        {item.label}
                        {item.sub && <span style={{ fontSize:11, color:"#9ca3af", marginLeft:4 }}>{item.sub}</span>}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ ...D.etapaFraseFim, marginTop:10 }}>
                  Todos os serviços não inclusos podem ser contratados como serviços adicionais.
                </div>
              </>
            )}

            {/* OBSERVAÇÕES — texto livre opcional do Template de Edição.
                Aparece antes do aceite, depois dos não-inclusos/prazos. */}
            {observacoesTpl && (
              <div className="proposta-section" style={{
                fontSize: 13, color: "#374151", lineHeight: 1.65,
                whiteSpace: "pre-wrap",
                marginTop: 24, marginBottom: 24,
                breakInside: "avoid", pageBreakInside: "avoid",
              }}>
                {observacoesTpl}
              </div>
            )}

            {/* ACEITE — Patch: envolto pra não quebrar entre páginas no PDF.
                Texto vem do Template de Edição quando preenchido, senão usa
                o texto padrão hardcoded. */}
            <div className="aceite-footer-bloco">
              <div style={D.secTit}>Aceite da proposta</div>
              <div style={{ ...D.secTexto, whiteSpace: "pre-wrap" }}>
                {aceiteTpl || "Aceitando esta proposta, o cliente concorda com os termos, valores, escopo e prazos descritos. A formalização se dá pela assinatura abaixo, ou pelo aceite digital encaminhado por e-mail."}
              </div>
              <div data-mobile-stack="1" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:32, marginTop:36 }}>
                <div style={{ fontSize:11, color:"#9ca3af" }}>
                  <div style={{ borderTop:"1px solid #111", paddingTop:6, marginTop:36, fontWeight:600, color:"#111", fontSize:11 }}>
                    {clienteNome || "—"}
                  </div>
                  <div style={{ marginTop:3 }}>Cliente</div>
                </div>
                <div style={{ fontSize:11, color:"#9ca3af" }}>
                  <div style={{ borderTop:"1px solid #111", paddingTop:6, marginTop:36, fontWeight:600, color:"#111", fontSize:11 }}>
                    {lockEdicao ? (
                      <span>{(responsavelEdit || "")}{cauEdit ? ` · ${cauEdit}` : ""}</span>
                    ) : (
                      <>
                        <TextoEditavel valor={responsavelEdit} onChange={setResponsavelEdit} style={{ fontSize:11, fontWeight:600 }} />
                        {" · "}
                        <TextoEditavel valor={cauEdit} onChange={setCauEdit} style={{ fontSize:11, fontWeight:600 }} />
                      </>
                    )}
                  </div>
                  <div style={{ marginTop:3 }}>Responsável Técnico</div>
                </div>
              </div>

              {/* Rodapé com contatos */}
              <div style={{ marginTop:32, paddingTop:14, borderTop:"0.5px solid #e5e7eb", fontSize:10, color:"#9ca3af", textAlign:"center", lineHeight:1.6 }}>
                <span>{escritorio.nome || "Escritório"}</span>
                {" · "}
                {lockEdicao ? <span>{emailEdit || ""}</span> : <TextoEditavel valor={emailEdit} onChange={setEmailEdit} style={{ fontSize:10 }} />}
                {" · "}
                {lockEdicao ? <span>{telefoneEdit || ""}</span> : <TextoEditavel valor={telefoneEdit} onChange={setTelefoneEdit} style={{ fontSize:10 }} />}
                {" · "}
                {lockEdicao ? <span>{instagramEdit || ""}</span> : <TextoEditavel valor={instagramEdit} onChange={setInstagramEdit} style={{ fontSize:10 }} />}
              </div>
            </div>

          </div>
        </div>

        {/* Modal de confirmação salvar — não muda */}
        {confirmSalvar && (
          <div className="no-print" style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
            <div style={{ background:"#fff", padding:"28px 32px", borderRadius:12, maxWidth:480, width:"90%", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
              <div style={{ fontSize:18, fontWeight:700, color:"#111", marginBottom:8 }}>Salvar e gerar proposta?</div>
              <div style={{ fontSize:13, color:"#6b7280", lineHeight:1.55, marginBottom:20 }}>
                A proposta será arquivada e o PDF baixado. Após salvar, esta versão fica imutável.
                {" "}<strong style={{ color:"#1e40af" }}>O PDF será gerado no servidor</strong> — primeira chamada pode levar até 15 segundos.
              </div>
              <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
                <button onClick={() => setConfirmSalvar(false)}
                  style={{ background:"#fff", color:"#374151", border:"1px solid #d1d5db", borderRadius:8, padding:"9px 16px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                  Cancelar
                </button>
                <button
                  onClick={async () => { setConfirmSalvar(false); await handleSalvarProposta(); }}
                  style={{ background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"9px 16px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                  Salvar e gerar PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── ESCOLHA DO MODELO ──────────────────────────────────────
  // Decide qual JSX renderizar baseado no templateId do estado.
  // Direto tem render próprio (renderDireto acima).
  // Editorial (default) usa o JSX abaixo no return principal.
  if (templateId === "02-direto") {
    return renderDireto();
  }

  return (
    <div style={wrap} className="vk-prev-editorial">
      {/* Estilos mobile-responsivos pro Preview Editorial.
          Aplicado via media query CSS — sem useState/listener.
          Breakpoint: 640px. Cobre:
            - Padding do container reduzido
            - Bloco de pagamento (BlocoFormaPagamentoView): tabela vira vertical
            - Tabela de etapas: cards empilhados em vez de grid horizontal
            - Cards Arq+Eng do passo 2: empilhados
            - Geral: travar overflow horizontal em qualquer container */}
      <style>{`
        /* Default (desktop): mostra desktop (grid preservado), esconde mobile.
           A media query mobile inverte: esconde desktop, mostra mobile (block). */
        .vk-bfp-mobile-only { display: none; }

        /* ═══════════════════════════════════════════════════════
           PAGE-BREAK + SPACING DINÂMICOS
           ═══════════════════════════════════════════════════════
           Aplicado a TODA seção da proposta. Garante:
            - Cada bloco evita quebrar entre páginas no PDF
            - Spacing consistente entre seções (24px) independente do que
              o usuário editar (com ou sem Apresentação, Observações, etc.)
            - Títulos não ficam órfãos na base da página */
        .proposta-section {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        @media print {
          .proposta-section {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          h1, h2, h3, .secao-titulo {
            break-after: avoid;
            page-break-after: avoid;
          }
        }

        /* Patch CRÍTICO: regra de no-print precisa estar aqui (no <style> global
           do Editorial) porque o style do Direto só carrega quando template ===
           "02-direto". Antes, ao gerar PDF do Editorial via Puppeteer, a regra
           não existia e os botões de edição vazavam pro PDF.
           Cobertura ampla: render-pdf-context (Puppeteer), lockEdicao-active
           (Direto), proposta-locked (Editorial em modo visualização). */
        .render-pdf-context .no-print,
        .render-pdf-context [data-no-print="true"],
        .lockEdicao-active .no-print,
        .proposta-locked .no-print {
          display: none !important;
        }
        .render-pdf-context * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        /* Patch: bloco Aceite + footer não pode quebrar entre páginas no PDF */
        .vk-prev-editorial .aceite-footer-bloco,
        .vk-prev-editorial .etapa-bloco,
        .vk-prev-editorial .secao-bloco {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        @media (max-width: 640px) {
          /* 1. Container principal: padding reduzido */
          .vk-prev-editorial > div[class*="proposta-locked"],
          .vk-prev-editorial > div:not(.proposta-locked) {
            padding: 16px 14px 60px !important;
          }
          /* Trava overflow horizontal em todo o Preview */
          .vk-prev-editorial,
          .vk-prev-editorial > div {
            overflow-x: hidden;
            max-width: 100%;
          }
          /* 2. BlocoFormaPagamentoView — alterna entre desktop e mobile.
             Em desktop: mostra .vk-bfp-desktop-only (tabela grid 3 colunas)
             Em mobile: mostra .vk-bfp-mobile-only (grupos por contratação) */
          .vk-bfp-desktop-only { display: none !important; }
          .vk-bfp-mobile-only { display: block !important; }
          /* 3. Tabela de etapas dentro do BlocoFormaPagamentoView */
          .vk-bfp-etapas-grid {
            grid-template-columns: 1fr 50px 90px !important;
            gap: 6px !important;
            padding: 8px 10px !important;
            font-size: 11.5px !important;
          }
          /* 4. Cards de modalidade Por etapa: 1 coluna em vez de 2 */
          .vk-bfp-mods {
            grid-template-columns: 1fr !important;
          }
          /* 5. Geral — qualquer grid 2 colunas dentro do Preview vira 1 coluna */
          .vk-prev-editorial [data-mobile-stack="1"] {
            grid-template-columns: 1fr !important;
          }
          /* Bloco "Valores dos projetos" — Arq + Eng lado a lado em mobile.
             Reduz só o padding direito da coluna pra evitar estouro horizontal. */
          .vk-prev-valores-grid > div { padding-right: 8px !important; }
          /* 6. Imagens e logos: nunca estouram */
          .vk-prev-editorial img { max-width: 100%; height: auto; }
        }
      `}</style>
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
          <div className="no-print" style={{
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

        <div className="no-print" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:36 }}>
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
            {/* Patch: logo vem do cadastro do escritório (escritorio.logo).
                Sem upload/remoção inline. Quando ausente, mostra placeholder
                discreto (só em modo edição) lembrando o usuário de cadastrar. */}
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" style={{ height:80, maxWidth:220, objectFit:"contain", borderRadius:4 }} />
            ) : (
              !lockEdicao && (
                <div className="no-print" style={{
                  height:80, padding:"0 16px", border:"1.5px dashed #d1d5db", borderRadius:6,
                  background:"#fafbfc", fontSize:12, color:"#9ca3af", fontFamily:"inherit",
                  display:"flex", alignItems:"center", whiteSpace:"nowrap"
                }}>
                  Cadastre o logo do escritório
                </div>
              )
            )}
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
                  <div className="no-print" style={{ fontSize:11, color:LT }}>R$ {fmtN(Math.round((temIsoladas ? arqIsoladaSI : arqCI)/areaTot*100)/100)}/m²</div>
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
            {(editandoResumo && !txTpl.descricaoProjeto) ? (
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
                onClick={() => { if (!txTpl.descricaoProjeto) setEditandoResumo(true); }}
                title={txTpl.descricaoProjeto ? "Editado pelo Template" : "Clique para editar"}
                style={{ fontSize:13, color:MD, lineHeight:1.7, cursor: txTpl.descricaoProjeto ? "default" : "pointer" }}>
                {resumoFinal}
              </div>
            )}
          </div>
        )}

        {/* APRESENTAÇÃO — texto livre opcional do Template de Edição. */}
        {apresentacaoTpl && (
          <Sec title="Apresentação" mt={20}>
            <div style={{
              fontSize: 13, color: MD, lineHeight: 1.7,
              whiteSpace: "pre-wrap",
            }}>
              {apresentacaoTpl}
            </div>
          </Sec>
        )}

        <div style={{ display:"flex", alignItems:"center", gap:10, margin:"28px 0 14px" }}>
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

          <div className="vk-prev-valores-grid" style={{ display:"grid", gridTemplateColumns: incluiArq && engAtiva ? "1fr 0.5px 1fr" : "1fr", gap:0, marginBottom:12 }}>
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
                <div className="no-print" style={{ fontSize:11, color:LT }}>R$ {fmtN(Math.round((temIsoladas ? arqIsoladaSI : arqCI)/areaTot*100)/100)}/m²</div>
              )}
            </div>}
            {incluiArq && engAtiva && <div style={{ background:LN }} />}
            {engAtiva && <div style={{ paddingLeft: incluiArq ? 20 : 0 }}>
              <div style={tag}>Engenharia{incluiArq && <span style={{ fontSize:10, color:LT, textTransform:"none", letterSpacing:0 }}> (Opcional)</span>}</div>
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
                <div className="no-print" style={{ fontSize:11, color:LT }}>R$ {fmtN(Math.round(engCI/areaTot*100)/100)}/m²</div>
              )}
            </div>}
          </div>
          {/* Resumo informativo de impostos. Desde o Deploy 1 da refatoração
              de pagamento, o toggle e o input de alíquota vivem APENAS no
              Passo 1 do Form (perto de "Repetição") — não são mais editáveis
              aqui. Snapshots antigos preservam o valor que tinham quando
              foram gerados (snap?.temImposto/aliqImp como fallback). */}
          <div style={{ border:`0.5px solid ${LN}`, borderRadius:8, padding:"10px 14px", fontSize:12, color:LT, marginBottom:4,
              display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
            {temImposto ? (<>
              <span>Imposto ({aliqImp}%)</span>
              <span style={{ color:LN }}>·</span>
              + Impostos — <span style={{ color:MD, fontWeight:500 }}>{fmtV(temIsoladas ? Math.round((totCIBase - totSIBase)*100)/100 : impostoEdit)}</span>
              &nbsp;·&nbsp; Total com impostos — <span style={{ fontSize:13, fontWeight:600, color:C }}>{fmtV(totCIBase)}</span>
            </>) : (<>
              Total sem impostos — <span style={{ fontSize:13, fontWeight:600, color:C }}>{fmtV(totCIBase)}</span>
            </>)}
          </div>
        </div>

        <Sec title="Forma de pagamento">
          {/* Fase 1 do refator — exibição vem do objeto canônico
              data.formaPagamento (preenchido na Etapa 5). Edição não
              acontece mais aqui — usuário volta pra Etapa 5 se quiser
              alterar formas/percentuais/parcelas. */}
          <BlocoFormaPagamentoView
            formaPagamento={data.formaPagamento}
            valorArq={arqCIEdit}
            valorEng={engCIEdit}
            incluiArq={incluiArq}
            incluiEng={incluiEng}
            accent="#111"
            pixTexto={pixEdit}
          />
        </Sec>

        <Sec title="Escopo dos serviços" action={
          escopoTextoTpl ? null : (
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
              border:`1px solid ${LN}`, background:"#f3f4f6", whiteSpace:"nowrap", userSelect:"none" }}
            className="no-print">+ bloco</span>
          )
        }>
          {escopoTextoTpl ? (
            escopoTextoTpl.split(/\n+─{4,}\n+/g).map((bloco, idx) => {
              const linhas = bloco.trim().split("\n");
              const titulo = linhas[0] || "";
              const corpo = linhas.slice(1).join("\n").trim();
              return (
                <div key={idx} className="proposta-section" style={{
                  marginBottom: 22,
                  breakInside: "avoid",
                  pageBreakInside: "avoid",
                }}>
                  <div style={{
                    display: "inline-block",
                    padding: "5px 14px",
                    border: `1px solid ${LN}`,
                    borderRadius: 8,
                    background: "#fafbfc",
                    fontSize: 13, fontWeight: 600,
                    color: C, marginBottom: 10,
                  }}>
                    {titulo}
                  </div>
                  {corpo && (
                    <div style={{
                      whiteSpace: "pre-wrap",
                      fontSize: 13,
                      lineHeight: 1.65,
                      color: MD,
                    }}>
                      {corpo}
                    </div>
                  )}
                </div>
              );
            })
          ) : escopoDefault.map((bloco, i) => {
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
                  className="no-print"
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
                        className="no-print"
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
                          className="no-print"
                          style={{ fontSize:10, color:"#d1d5db", cursor:"pointer", marginLeft:4, flexShrink:0, paddingTop:2 }}>✕</span>
                      </div>
                    ))}
                  </>}
                  {bloco.entregaveis !== undefined && <>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:2, marginTop:6 }}>
                      <div style={tag}>Entregáveis</div>
                      <span onClick={() => setEscopoBloco(bloco.etapaId, "entregaveis", [...(bloco.entregaveis||[]), "Novo entregável"])}
                        title="Adicionar entregável"
                        className="no-print"
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
                          className="no-print"
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
          {/* Prioridade: naoInclTpl (do Template Edição) > naoInclEdit
              (legado inline) > naoInclDefault (dinâmico). Quando vem do
              template, edição inline é desabilitada (cliques não fazem
              nada porque a fonte canônica é o template). */}
          <div style={{ columns:"2", columnGap:32, marginBottom:8 }}>
            {(naoInclTpl || naoInclEdit || naoInclDefault).map((item, i) => (
              <div key={i} style={{ ...bl, breakInside:"avoid", marginBottom:4, alignItems:"flex-start" }}>
                <span style={dot}>•</span>
                {naoInclTpl ? (
                  <span style={{ fontSize:13, color:MD, flex:1 }}>{item.label}</span>
                ) : (
                  <TextoEditavel valor={item.label} onChange={v => {
                    const arr = [...(naoInclEdit || naoInclDefault)];
                    arr[i] = { ...arr[i], label: v };
                    setNaoInclEdit(arr);
                  }} style={{ fontSize:13, color:MD, flex:1 }} />
                )}
                {item.sub && <span style={{ fontSize:11, color:LT, marginLeft:4 }}>{item.sub}</span>}
                {!naoInclTpl && (
                  <span onClick={() => setNaoInclEdit((naoInclEdit || naoInclDefault).filter((_,k)=>k!==i))}
                    className="no-print"
                    style={{ fontSize:10, color:"#d1d5db", cursor:"pointer", marginLeft:4, flexShrink:0, paddingTop:2 }}>✕</span>
                )}
              </div>
            ))}
          </div>
          {!naoInclTpl && (
            <div style={{ marginBottom:8 }}>
              <span onClick={() => setNaoInclEdit([...(naoInclEdit||naoInclDefault), { label:"Novo item", sub:null }])}
                className="no-print"
                style={{ fontSize:11, color:LT, cursor:"pointer", padding:"2px 8px", borderRadius:4,
                  background:"#f3f4f6", border:"1px solid #c8cdd6" }}>+ item</span>
            </div>
          )}
          <div style={{ fontSize:12, color:LT, fontStyle:"italic" }}>Todos os serviços não inclusos podem ser contratados como serviços adicionais.</div>
        </Sec>

        <Sec title="Prazo de execução">
          {/* Prioridade: prazoTpl (Template Edição) > prazoEdit (legado) >
              prazoDefault. Edição inline desabilitada quando vem do template. */}
          {(prazoTpl || prazoEdit || prazoDefault).filter(p => {
              if (p.toLowerCase().includes("engenharia")) {
                if (!engAtiva) return false; // toggle desligado OU eng não isolada
              }
              return true;
            }).map((p, i) => (
            <div key={i} style={{ ...bl, marginBottom:6 }}>
              <span style={dot}>•</span>
              {prazoTpl ? (
                <span style={{ fontSize:13, color:MD, lineHeight:1.6 }}>{p}</span>
              ) : (
                <TextoEditavel valor={p} onChange={v => {
                  const arr = [...(prazoEdit || prazoDefault)];
                  arr[i] = v;
                  setPrazoEdit(arr);
                }} style={{ fontSize:13, color:MD, lineHeight:1.6 }} multiline={true} />
              )}
            </div>
          ))}
        </Sec>

        {/* OBSERVAÇÕES — texto livre opcional do Template de Edição. */}
        {observacoesTpl && (
          <Sec title="Observações finais">
            <div style={{
              fontSize: 13, color: MD, lineHeight: 1.65,
              whiteSpace: "pre-wrap",
            }}>
              {observacoesTpl}
            </div>
          </Sec>
        )}

        {/* Patch: bloco "Aceite + footer" envolto pra não quebrar entre páginas
            no PDF. Se não couber inteiro, vai todo pra próxima página. */}
        <div className="aceite-footer-bloco">
          <Sec title="Aceite da proposta">
            {/* Texto do aceite — vem do Template de Edição quando preenchido. */}
            {aceiteTpl && (
              <div style={{
                fontSize: 13, color: MD, lineHeight: 1.65,
                whiteSpace: "pre-wrap", marginBottom: 18,
              }}>
                {aceiteTpl}
              </div>
            )}
            <div data-mobile-stack="1" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:32, marginTop:8 }}>
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
              <span>{escritorio.nome || "Escritório"}</span><span>·</span>
              <TextoEditavel valor={emailEdit} onChange={setEmailEdit} style={{ fontSize:11 }} /><span>·</span>
              <TextoEditavel valor={telefoneEdit} onChange={setTelefoneEdit} style={{ fontSize:11 }} /><span>·</span>
              <TextoEditavel valor={instagramEdit} onChange={setInstagramEdit} style={{ fontSize:11 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
