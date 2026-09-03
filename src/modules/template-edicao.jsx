// ═══════════════════════════════════════════════════════════════
// TEMPLATE DE EDIÇÃO — tela de ajustes finais antes do preview
// ═══════════════════════════════════════════════════════════════
// Tipo "Word com texto livre" — campos estruturados (read-only) com os
// dados do orçamento já configurados nas etapas anteriores + textareas
// livres pra todos os blocos de texto que aparecem na proposta:
// apresentação, escopo dos serviços (com 3 etapas pré-formatadas),
// serviços não inclusos, prazos, termo de aceite e observações finais.
//
// Os textos editados aqui são guardados em propostaData.template.textos no
// FormOrcamentoProjetoTeste e ficam disponíveis pros modelos visuais
// (ModeloPadrao + futuros) consumirem ao renderizar a proposta final
// (Fase 5+).
//
// Pode ser pulado via botão "Pular esta etapa" — nesse caso os textos
// ficam vazios e cada modelo usa seus próprios defaults internos.
//
// Layout: minimalista, mood Claude AI (cards rounded 14px, sem zebra,
// borders #e5e7eb, espaçamento generoso, tipografia consistente com o
// fluxograma do onboarding).
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Defaults e helpers vêm de shared-textos.jsx — fonte única pra todos os
// textos padrão da proposta (também usados por modelo-padrao.jsx).
//   - TXT_DEFAULT_ESCOPO_ETAPAS / TXT_DEFAULT_NAO_INCLUSOS / TXT_DEFAULT_PRAZO
//     / TXT_DEFAULT_ACEITE
//   - txtFormatarEscopoComoTexto / txtFormatarListaComoTexto
//   - txtComputarDescricaoProjeto
// Apresentação e Observações continuam vazias por padrão (texto livre).
// ─────────────────────────────────────────────────────────────

const TPL_DEFAULT_APRESENTACAO = "";   // livre por padrão
const TPL_DEFAULT_OBSERVACOES = "";    // livre por padrão

// ─────────────────────────────────────────────────────────────
// Auto-bullet on Enter — quando o usuário aperta Enter numa linha que
// começa com "•" (ou "-"/"*"), insere um bullet automaticamente na
// nova linha. Se a linha atual está VAZIA (só o bullet sem conteúdo),
// remove o bullet — exit list mode (comportamento típico de editores).
// ─────────────────────────────────────────────────────────────
function tplHandleEnterBullet(e, valor, setValor) {
  if (e.key !== "Enter") return;
  const ta = e.target;
  if (!ta || typeof ta.selectionStart !== "number") return;

  const cursorPos = ta.selectionStart;
  const beforeCursor = valor.substring(0, cursorPos);
  const lineStart = beforeCursor.lastIndexOf("\n") + 1;
  const currentLine = beforeCursor.substring(lineStart);

  const bulletMatch = currentLine.match(/^([•\-*])(\s+)/);
  if (!bulletMatch) return;

  const bulletPrefix = bulletMatch[0]; // "• " ou "- " etc.
  const restOfLine = currentLine.substring(bulletPrefix.length);

  // Se a linha do bullet está vazia (só o bullet), remove ele — sai da lista.
  if (restOfLine.trim() === "") {
    e.preventDefault();
    const newValue = valor.substring(0, lineStart) + valor.substring(cursorPos);
    setValor(newValue);
    requestAnimationFrame(() => {
      try { ta.setSelectionRange(lineStart, lineStart); } catch {}
    });
    return;
  }

  // Linha tem conteúdo — continua o bullet na linha seguinte.
  e.preventDefault();
  const insertion = "\n" + bulletPrefix;
  const newValue = beforeCursor + insertion + valor.substring(cursorPos);
  setValor(newValue);
  const newPos = cursorPos + insertion.length;
  requestAnimationFrame(() => {
    try { ta.setSelectionRange(newPos, newPos); } catch {}
  });
}

// ─────────────────────────────────────────────────────────────
// InputMoeda — input de valor BRL com formatação automática e recálculo
// inline. O parent recebe o número parseado a cada keystroke (pra propagar
// recálculo de totais/parcelas em tempo real). On blur reformata pra
// padrão BR (1.234,56) pra ficar bonito quando o usuário sai do campo.
// ─────────────────────────────────────────────────────────────
function TplInputMoeda({ valor, onChange, style, ...rest }) {
  const formatar = v => {
    const n = Number(v) || 0;
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const [raw, setRaw] = useState(formatar(valor));
  const ultimoValorPropRef = useRef(valor);

  // Sincroniza display quando o valor externo muda (ex: orcamento recalculou
  // e enviou novo default), mas NÃO durante a digitação do próprio input.
  useEffect(() => {
    if (ultimoValorPropRef.current !== valor) {
      ultimoValorPropRef.current = valor;
      setRaw(formatar(valor));
    }
  }, [valor]);

  function handleChange(e) {
    const txt = e.target.value;
    setRaw(txt);
    // Aceita "1.234,56" ou "1234.56" — limpa pontos de milhar e troca
    // vírgula decimal por ponto antes do parseFloat.
    const limpo = txt.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(limpo);
    const novo = isNaN(n) ? 0 : n;
    ultimoValorPropRef.current = novo;
    onChange(novo);
  }

  function handleBlur() {
    // Reformata pro display final BR
    setRaw(formatar(valor));
  }

  return (
    <div style={{ position: "relative", ...style }}>
      <span style={{
        position: "absolute", left: 12, top: "50%",
        transform: "translateY(-50%)",
        color: "#9ca3af", fontSize: 13,
        pointerEvents: "none",
        fontVariantNumeric: "tabular-nums",
      }}>R$</span>
      <input
        type="text"
        inputMode="decimal"
        value={raw}
        onChange={handleChange}
        onBlur={handleBlur}
        style={{
          width: "100%",
          border: "1.5px solid rgba(38,36,33,0.16)",
          borderRadius: 14,
          padding: "11px 12px 11px 36px",
          fontSize: 14,
          fontFamily: "inherit",
          outline: "none",
          fontVariantNumeric: "tabular-nums",
          boxSizing: "border-box",
          transition: "border-color 0.12s",
        }}
        onFocus={e => { e.currentTarget.style.borderColor = "#b5652f"; }}
        onBlurCapture={e => { e.currentTarget.style.borderColor = "rgba(38,36,33,0.16)"; }}
        {...rest}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────

function TemplateEdicao({ data, escritorio, onVoltar, onProsseguir, onPular }) {
  const safeData = data || {};
  const esc = escritorio || {};

  // Inicialização preserva edições anteriores. Se não houver template salvo
  // (primeiro acesso), aplica os defaults formatados.
  const tx = safeData.template?.textos || {};
  // Descrição do projeto — gerada dinamicamente da data (cômodos, áreas, etc.)
  // ou usa o valor salvo se já editado antes.
  const [descricaoProjeto, setDescricaoProjeto] = useState(
    tx.descricaoProjeto !== undefined ? tx.descricaoProjeto : txtComputarDescricaoProjeto(safeData)
  );
  const [apresentacao, setApresentacao] = useState(
    tx.apresentacao !== undefined ? tx.apresentacao : TPL_DEFAULT_APRESENTACAO
  );
  const [escopo, setEscopo] = useState(
    tx.escopo !== undefined ? tx.escopo : txtFormatarEscopoComoTexto(TXT_DEFAULT_ESCOPO_ETAPAS)
  );
  const [naoInclusos, setNaoInclusos] = useState(
    tx.naoInclusos !== undefined ? tx.naoInclusos : txtFormatarListaComoTexto(TXT_DEFAULT_NAO_INCLUSOS)
  );
  const [prazo, setPrazo] = useState(
    tx.prazo !== undefined ? tx.prazo : txtFormatarListaComoTexto(TXT_DEFAULT_PRAZO)
  );
  const [aceite, setAceite] = useState(
    tx.aceite !== undefined ? tx.aceite : TXT_DEFAULT_ACEITE
  );
  const [observacoes, setObservacoes] = useState(
    tx.observacoes !== undefined ? tx.observacoes : TPL_DEFAULT_OBSERVACOES
  );

  // Valores (Fase 6b) — R$ Arquitetura e Engenharia. Defaults vêm do
  // cálculo do orçamento; se o usuário já editou no template antes,
  // preserva o valor salvo. Recálculo inline cascata em 6c.
  const tv = safeData.template?.valores || {};
  const calcRef = safeData.calculo || {};
  const [valorArq, setValorArq] = useState(
    tv.valorArq != null ? Number(tv.valorArq) : (Number(calcRef.precoArq) || 0)
  );
  const [valorEng, setValorEng] = useState(
    tv.valorEng != null ? Number(tv.valorEng) : (Number(calcRef.precoEng) || 0)
  );

  // Pagamento (Fase 6c) — descontos do antecipado e quantidade de parcelas
  // pro modo "padrão" (Antecipado/Parcelas). Por etapa fica pra 6d.
  // Defaults vêm de safeData (vem do form/Etapa 5) ou hardcoded.
  const [descArq, setDescArq] = useState(
    tv.descArq != null ? Number(tv.descArq) : (Number(safeData.descArq) || 5)
  );
  const [descPacote, setDescPacote] = useState(
    tv.descPacote != null ? Number(tv.descPacote) : (Number(safeData.descPacote) || 10)
  );
  const [parcArq, setParcArq] = useState(
    tv.parcArq != null ? Number(tv.parcArq) : (Number(safeData.parcArq) || 3)
  );
  const [parcPacote, setParcPacote] = useState(
    tv.parcPacote != null ? Number(tv.parcPacote) : (Number(safeData.parcPacote) || 4)
  );

  // Por etapa (Fase 6d) — modalidades de etapa a etapa e etapas completas.
  // Aparecem apenas quando "etapa" está nas formas selecionadas.
  //   descEtCtrt/parcEtCtrt = "Contratação etapa a etapa" (cliente contrata 1 de cada vez)
  //   descPacCtrt/parcPacCtrt = "Etapas completas" (cliente contrata todas juntas)
  const [descEtCtrt, setDescEtCtrt] = useState(
    tv.descEtCtrt != null ? Number(tv.descEtCtrt) : (Number(safeData.descEtCtrt) || 5)
  );
  const [parcEtCtrt, setParcEtCtrt] = useState(
    tv.parcEtCtrt != null ? Number(tv.parcEtCtrt) : (Number(safeData.parcEtCtrt) || 2)
  );
  const [descPacCtrt, setDescPacCtrt] = useState(
    tv.descPacCtrt != null ? Number(tv.descPacCtrt) : (Number(safeData.descPacCtrt) || 15)
  );
  const [parcPacCtrt, setParcPacCtrt] = useState(
    tv.parcPacCtrt != null ? Number(tv.parcPacCtrt) : (Number(safeData.parcPacCtrt) || 8)
  );

  // Entrada + final (forma "final" da Etapa 5) — % de entrada por contratação.
  // Pré-vem de safeData.formaPagamento.final ou template.valores; fallback 50%.
  const _fpFin = safeData.formaPagamento?.final || {};
  const [entArq, setEntArq] = useState(
    tv.entArq != null ? Number(tv.entArq) : (Number(_fpFin.entArq) || 50)
  );
  const [entPacote, setEntPacote] = useState(
    tv.entPacote != null ? Number(tv.entPacote) : (Number(_fpFin.entPac) || 50)
  );

  // Estrutura da forma de pagamento (Fase 6d.1) — agora editável no Template.
  // Mesmo padrão da Etapa 5: 4 formas com mesma nomenclatura, antecipado é
  // modificador (combina com qualquer), demais são exclusivas entre si.
  // Pré-seleção vem de safeData.formaPagamento.formas (que veio da Etapa 5).
  // Quando o user reabre o Template depois de editar, vence template.formaPagamento.
  const fpFromTemplate = safeData.template?.formaPagamento || null;
  const fpFromEtapa    = safeData.formaPagamento || {};
  const FORMAS_TPL = [
    { id: "antecipado", tipo: "antecipado", label: "Pagamento antecipado com desconto" },
    { id: "parcelas",   tipo: "exclusiva",  label: "Entrada + parcelas a cada 30 dias" },
    { id: "final",      tipo: "exclusiva",  label: "Entrada + pagamento final na entrega" },
    { id: "etapa",      tipo: "exclusiva",  label: "Pagamento por etapa" },
  ];
  const [formasTpl, setFormasTpl] = useState(() => {
    const ini = fpFromTemplate?.formas ?? fpFromEtapa.formas ?? ["antecipado", "parcelas"];
    return Array.isArray(ini) ? [...ini] : ["antecipado", "parcelas"];
  });
  // tipoPgto derivado: "etapa" presente → "etapas", senão "padrao".
  const ehPorEtapa = formasTpl.includes("etapa");
  const tipoPgtoTpl = ehPorEtapa ? "etapas" : "padrao";

  // Contratações (Apenas Arq / Pacote) — apareceram em modo padrão.
  const [contratacoesTpl, setContratacoesTpl] = useState(() => {
    const ini = fpFromTemplate?.contratacoes ?? fpFromEtapa.contratacoes ?? ["arq", "pac"];
    return Array.isArray(ini) ? [...ini] : ["arq", "pac"];
  });

  // Etapas (modo etapa) — array {id, nome, pct, eng?}. Pré-seleção:
  // 1) template.formaPagamento.etapas (edição anterior)
  // 2) safeData.formaPagamento.etapa.etapas (vindo da Etapa 5)
  // 3) safeData.etapasPct (snapshot legado)
  // 4) defaults (Viabilidade 10%, Preliminar 30%, Aprovação 12%, Executivo 38% + Eng)
  const _defaultEtapas = [
    { id: 1, nome: "Estudo de Viabilidade",   pct: 10 },
    { id: 2, nome: "Estudo Preliminar",       pct: 30 },
    { id: 3, nome: "Aprovação na Prefeitura", pct: 12 },
    { id: 4, nome: "Projeto Executivo",       pct: 38 },
    { id: 5, nome: "Engenharia",              pct: 10, eng: true },
  ];
  const [etapasPctTpl, setEtapasPctTpl] = useState(() => {
    const ini = fpFromTemplate?.etapas
              ?? fpFromEtapa.etapa?.etapas
              ?? safeData.etapasPct
              ?? _defaultEtapas;
    if (!Array.isArray(ini)) return _defaultEtapas;
    const out = ini.map(e => ({ ...e }));
    if (!out.some(e => e.id === 5)) out.push({ id: 5, nome: "Engenharia", pct: 10, eng: true });
    return out;
  });
  const [isoladasTpl, setIsoladasTpl] = useState(() => {
    const ini = fpFromTemplate?.isoladas
              ?? fpFromEtapa.etapa?.isoladas
              ?? safeData.etapasIsoladas
              ?? [];
    return new Set(Array.isArray(ini) ? ini : []);
  });

  // Helpers de etapa
  function toggleContratacaoTpl(tipo) {
    if (contratacoesTpl.includes(tipo)) {
      if (contratacoesTpl.length <= 1) return; // mantém pelo menos 1
      setContratacoesTpl(contratacoesTpl.filter(x => x !== tipo));
    } else {
      setContratacoesTpl([...contratacoesTpl, tipo]);
    }
  }
  function toggleIsoladaTpl(id) {
    setIsoladasTpl(prev => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }
  function atualizarEtapaPctTpl(id, novo) {
    const v = Math.max(0, Math.min(100, Math.round(Number(novo) || 0)));
    setEtapasPctTpl(prev => prev.map(e => e.id === id ? { ...e, pct: v } : e));
  }
  function atualizarEtapaNomeTpl(id, nome) {
    setEtapasPctTpl(prev => prev.map(e => e.id === id ? { ...e, nome } : e));
  }
  function adicionarEtapaTpl() {
    const maxId = Math.max(9, ...etapasPctTpl.map(e => e.id));
    setEtapasPctTpl(prev => [...prev, { id: maxId + 1, nome: "Nova etapa", pct: 0 }]);
  }
  function removerEtapaTpl(id) {
    if (id === 5) return;
    setEtapasPctTpl(prev => prev.filter(e => e.id !== id));
    setIsoladasTpl(prev => { const n = new Set(prev); n.delete(id); return n; });
  }

  // Toggle de forma — replica a lógica da Etapa 5 (toggleForma em
  // orcamento-teste.jsx:4848). Antecipado coexiste com qualquer; demais
  // são exclusivas entre si.
  function toggleFormaTpl(formaId) {
    const forma = FORMAS_TPL.find(f => f.id === formaId);
    if (!forma) return;
    const idx = formasTpl.indexOf(formaId);
    if (idx !== -1) {
      // já marcada → desmarca, mas mantém pelo menos uma forma
      if (formasTpl.length <= 1) return;
      setFormasTpl(formasTpl.filter(x => x !== formaId));
    } else if (forma.tipo === "antecipado") {
      // antecipado é modificador: pode coexistir
      setFormasTpl([...formasTpl, formaId]);
    } else {
      // exclusiva: substitui qualquer outra exclusiva, mantém antecipado
      setFormasTpl([...formasTpl.filter(x => x === "antecipado"), formaId]);
    }
  }

  function handleProsseguir() {
    onProsseguir({
      textos: {
        descricaoProjeto: descricaoProjeto.trim(),
        apresentacao: apresentacao.trim(),
        escopo: escopo.trim(),
        naoInclusos: naoInclusos.trim(),
        prazo: prazo.trim(),
        aceite: aceite.trim(),
        observacoes: observacoes.trim(),
      },
      valores: {
        valorArq:   Number(valorArq)   || 0,
        valorEng:   Number(valorEng)   || 0,
        descArq:    Number(descArq)    || 0,
        descPacote: Number(descPacote) || 0,
        parcArq:    Math.max(1, Math.round(Number(parcArq) || 1)),
        parcPacote: Math.max(1, Math.round(Number(parcPacote) || 1)),
        descEtCtrt:  Number(descEtCtrt)  || 0,
        parcEtCtrt:  Math.max(1, Math.round(Number(parcEtCtrt)  || 1)),
        descPacCtrt: Number(descPacCtrt) || 0,
        parcPacCtrt: Math.max(1, Math.round(Number(parcPacCtrt) || 1)),
        entArq:     Number(entArq)     || 0,
        entPacote:  Number(entPacote)  || 0,
      },
      formaPagamento: {
        tipoPgto: tipoPgtoTpl,
        formas: [...formasTpl],
        contratacoes: [...contratacoesTpl],
        etapas: etapasPctTpl.map(e => ({ ...e })),
        isoladas: Array.from(isoladasTpl),
      },
    });
  }

  // Helpers de display do resumo
  const padraoMap = { baixo: "Baixo", medio: "Médio", alto: "Alto" };
  const padraoTxt = padraoMap[safeData.padrao] || safeData.padrao || "—";
  const tipoTxt = [safeData.tipoProjeto, safeData.tipoObra].filter(Boolean).join(" — ") || "—";
  const fmtBRL = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const respPrim = (esc.responsaveis && esc.responsaveis.length > 0) ? esc.responsaveis[0] : null;
  const respLabel = respPrim?.nome ? `Arq. ${respPrim.nome}` : "—";

  // Estilos compartilhados
  const wrap = {
    maxWidth: 760, margin: "0 auto",
    padding: "32px 24px 60px",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  };
  const card = {
    background: "#fff",
    border: "1.5px solid rgba(38,36,33,0.16)",
    borderRadius: 14,
    padding: "22px 24px",
    marginBottom: 16,
  };
  const cardTitle = {
    fontSize: 11, fontWeight: 600, color: "#9ca3af",
    textTransform: "uppercase", letterSpacing: 0.5,
    marginBottom: 14,
  };
  const resumoRow = {
    display: "flex", justifyContent: "space-between", alignItems: "baseline",
    padding: "5px 0", fontSize: 13,
  };
  const labelTextarea = {
    fontSize: 12.5, color: "#374151", fontWeight: 500,
    marginBottom: 6, display: "block",
  };
  const labelOptional = { color: "#9ca3af", fontWeight: 400 };
  const textareaBase = {
    width: "100%",
    border: "1.5px solid rgba(38,36,33,0.16)",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 13.5, color: "#262421",
    fontFamily: "inherit",
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
    lineHeight: 1.5,
    transition: "border-color 0.12s",
  };
  const btnPrimary = {
    background: "#262421", color: "#fff",
    border: "none", borderRadius: 14,
    padding: "12px 22px",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.15s",
  };
  const btnSecondary = {
    background: "#fff", color: "#374151",
    border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 14,
    padding: "12px 18px",
    fontSize: 13, cursor: "pointer", fontFamily: "inherit",
    transition: "border-color 0.12s",
  };
  const btnGhost = {
    background: "transparent", color: "#9ca3af",
    border: "none", padding: "8px 4px",
    fontSize: 12, cursor: "pointer",
    fontFamily: "inherit",
  };
  const spacer = (h = 18) => <div style={{ height: h }} />;

  // Definição das seções pra sidebar de navegação. Cada seção tem:
  //   - id: âncora pro scroll (matches id no card abaixo)
  //   - label: nome exibido no menu
  //   - placeholder (opcional): true = seção ainda não implementada,
  //     mostra estilo cinza disabled na sidebar.
  const SECOES_SIDEBAR = [
    { id: "secao-resumo",      label: "Resumo" },
    { id: "secao-apresentacao",label: "Apresentação" },
    { id: "secao-escopo",      label: "Escopo & termos" },
    { id: "secao-valores",     label: "Valores" },
    { id: "secao-pagamento",   label: "Pagamento" },
  ];

  // Seção ativa controla highlight da sidebar quando o usuário scrolla.
  // Default é a primeira seção. Atualiza no click ou no scroll do conteúdo.
  const [secaoAtiva, setSecaoAtiva] = useState(SECOES_SIDEBAR[0].id);

  function scrollPraSecao(id) {
    setSecaoAtiva(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Wrap maior pra caber sidebar + conteúdo. mantém centralização.
  const wrapNovo = {
    maxWidth: 1080, margin: "0 auto",
    padding: "32px 24px 60px",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  };

  return (
    <div style={wrapNovo}>
      <style>{`
        .vk-tpl-textarea:focus { border-color: #b5652f !important; }
        .vk-tpl-btn-primary:hover { background: #000 !important; }
        .vk-tpl-btn-secondary:hover { border-color: #9ca3af !important; }
        .vk-tpl-btn-ghost:hover { color: #6b7280 !important; }
        .vk-tpl-sidebar-item {
          display: block;
          width: 100%;
          text-align: left;
          padding: 8px 12px;
          margin-bottom: 4px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 8px;
          color: #6b7280;
          font-size: 12.5px;
          font-family: inherit;
          cursor: pointer;
          transition: background 0.12s, color 0.12s, border-color 0.12s;
        }
        .vk-tpl-sidebar-item:hover {
          background: #fafbfc;
          color: #262421;
        }
        .vk-tpl-sidebar-item.is-active {
          background: #f3f4f6;
          color: #262421;
          font-weight: 600;
        }
        .vk-tpl-sidebar-item.is-placeholder {
          color: #9ca3af;
          cursor: not-allowed;
          font-style: italic;
        }
        .vk-tpl-sidebar-item.is-placeholder:hover {
          background: transparent;
          color: #9ca3af;
        }
        @media (max-width: 720px) {
          .vk-tpl-grid { grid-template-columns: 1fr !important; gap: 0 !important; }
          .vk-tpl-sidebar {
            position: static !important;
            top: auto !important;
            margin-bottom: 16px;
            border: 1.5px solid rgba(38,36,33,0.16);
            border-radius: 12px;
            padding: 10px;
          }
          .vk-tpl-sidebar-list {
            display: flex !important;
            flex-direction: row !important;
            overflow-x: auto;
            gap: 4px;
          }
          .vk-tpl-sidebar-item {
            white-space: nowrap;
            flex-shrink: 0;
            margin-bottom: 0 !important;
          }
        }
      `}</style>

      {/* Header com Voltar + título */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={onVoltar}
          style={{
            background: "none", border: "none", padding: 0,
            fontSize: 13, color: "#6b7280", cursor: "pointer",
            fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 6,
            marginBottom: 16,
          }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Voltar
        </button>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
          VICKE · Template de edição
        </div>
        <div style={{ fontSize: 22, fontWeight: 300, color: "#262421", letterSpacing: -0.4, lineHeight: 1.2 }}>
          Ajustes finais antes de gerar o orçamento
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55, marginTop: 10, maxWidth: 600 }}>
          Os dados do projeto já estão preenchidos. Edite livremente os textos abaixo — escopo, prazos, não inclusos e termo de aceite vêm pré-preenchidos com o conteúdo padrão da proposta. Você pode pular esta etapa pra usar os textos padrão sem alterações.
        </div>
      </div>

      {/* Grid: sidebar + conteúdo. Em mobile (<720px), sidebar vira tabs
          horizontais no topo via CSS media query. */}
      <div className="vk-tpl-grid" style={{
        display: "grid",
        gridTemplateColumns: "200px 1fr",
        gap: 24,
        alignItems: "start",
      }}>

        {/* SIDEBAR de navegação — sticky no desktop, scroll horizontal em mobile */}
        <nav className="vk-tpl-sidebar" style={{
          position: "sticky",
          top: 24,
          alignSelf: "start",
        }}>
          <div style={{
            fontSize: 10.5, fontWeight: 700, color: "#9ca3af",
            textTransform: "uppercase", letterSpacing: 1,
            marginBottom: 10, paddingLeft: 4,
          }}>
            Seções
          </div>
          <div className="vk-tpl-sidebar-list">
            {SECOES_SIDEBAR.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => !s.placeholder && scrollPraSecao(s.id)}
                className={
                  "vk-tpl-sidebar-item" +
                  (secaoAtiva === s.id && !s.placeholder ? " is-active" : "") +
                  (s.placeholder ? " is-placeholder" : "")
                }
                title={s.placeholder ? "Em breve" : undefined}>
                {s.label}
                {s.placeholder && (
                  <span style={{ fontSize: 9, marginLeft: 6, opacity: 0.7 }}>· em breve</span>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* CONTEÚDO: cards das seções, scroll vertical natural */}
        <div>

      {/* Card 1 — Resumo dos dados estruturados (read-only) */}
      <div id="secao-resumo" style={card}>
        <div style={cardTitle}>Resumo do orçamento</div>
        <div style={resumoRow}>
          <span style={{ color: "#6b7280" }}>Cliente</span>
          <span style={{ color: "#262421", fontWeight: 500 }}>{safeData.clienteNome || "—"}</span>
        </div>
        <div style={resumoRow}>
          <span style={{ color: "#6b7280" }}>Projeto</span>
          <span style={{ color: "#262421", fontWeight: 500 }}>{tipoTxt}</span>
        </div>
        <div style={resumoRow}>
          <span style={{ color: "#6b7280" }}>Padrão</span>
          <span style={{ color: "#262421", fontWeight: 500 }}>{padraoTxt}</span>
        </div>
        {safeData.calculo?.areaTotal ? (
          <div style={resumoRow}>
            <span style={{ color: "#6b7280" }}>Área total</span>
            <span style={{ color: "#262421", fontWeight: 500 }}>
              {Number(safeData.calculo.areaTotal).toLocaleString("pt-BR")} m²
            </span>
          </div>
        ) : null}
        <div style={resumoRow}>
          <span style={{ color: "#6b7280" }}>Responsável técnico</span>
          <span style={{ color: "#262421", fontWeight: 500 }}>{respLabel}</span>
        </div>
        {safeData.totCI ? (
          <div style={{
            ...resumoRow,
            marginTop: 10, paddingTop: 12,
            borderTop: "1px solid #f3f4f6",
            fontSize: 14,
          }}>
            <span style={{ color: "#262421", fontWeight: 600 }}>Honorário total</span>
            <span style={{ color: "#262421", fontWeight: 700 }}>{fmtBRL(safeData.totCI)}</span>
          </div>
        ) : null}
      </div>

      {/* Card 2 — Textos introdutórios */}
      <div id="secao-apresentacao" style={card}>
        <div style={cardTitle}>Descrição, apresentação e observações</div>

        <label style={labelTextarea}>
          Descrição do projeto
        </label>
        <textarea
          className="vk-tpl-textarea"
          value={descricaoProjeto}
          onChange={e => setDescricaoProjeto(e.target.value)}
          onKeyDown={e => tplHandleEnterBullet(e, descricaoProjeto, setDescricaoProjeto)}
          placeholder="Construção nova de uma residência..."
          style={{ ...textareaBase, minHeight: 90 }}
          rows={3}
        />
        <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 6, lineHeight: 1.4 }}>
          Pré-preenchida com base nos dados do projeto. Aparece logo abaixo do nome do cliente na proposta.
        </div>

        {spacer()}

        <label style={labelTextarea}>
          Apresentação ao cliente <span style={labelOptional}>· opcional</span>
        </label>
        <textarea
          className="vk-tpl-textarea"
          value={apresentacao}
          onChange={e => setApresentacao(e.target.value)}
          onKeyDown={e => tplHandleEnterBullet(e, apresentacao, setApresentacao)}
          placeholder="Olá, [nome]! Apresentamos esta proposta para..."
          style={{ ...textareaBase, minHeight: 100 }}
          rows={4}
        />

        {spacer()}

        <label style={labelTextarea}>
          Observações finais <span style={labelOptional}>· opcional</span>
        </label>
        <textarea
          className="vk-tpl-textarea"
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
          onKeyDown={e => tplHandleEnterBullet(e, observacoes, setObservacoes)}
          placeholder="Considerações finais, prazos especiais, condições particulares..."
          style={{ ...textareaBase, minHeight: 100 }}
          rows={4}
        />
      </div>

      {/* Card 3 — Escopo e detalhes técnicos (pré-preenchidos com defaults) */}
      <div id="secao-escopo" style={card}>
        <div style={cardTitle}>Escopo e detalhes técnicos</div>

        <label style={labelTextarea}>
          Escopo dos serviços
        </label>
        <textarea
          className="vk-tpl-textarea"
          value={escopo}
          onChange={e => setEscopo(e.target.value)}
          onKeyDown={e => tplHandleEnterBullet(e, escopo, setEscopo)}
          style={{ ...textareaBase, minHeight: 360 }}
          rows={18}
        />

        {spacer()}

        <label style={labelTextarea}>
          Serviços não inclusos
        </label>
        <textarea
          className="vk-tpl-textarea"
          value={naoInclusos}
          onChange={e => setNaoInclusos(e.target.value)}
          onKeyDown={e => tplHandleEnterBullet(e, naoInclusos, setNaoInclusos)}
          style={{ ...textareaBase, minHeight: 200 }}
          rows={10}
        />

        {spacer()}

        <label style={labelTextarea}>
          Prazo de execução
        </label>
        <textarea
          className="vk-tpl-textarea"
          value={prazo}
          onChange={e => setPrazo(e.target.value)}
          onKeyDown={e => tplHandleEnterBullet(e, prazo, setPrazo)}
          style={{ ...textareaBase, minHeight: 80 }}
          rows={3}
        />

        {spacer()}

        <label style={labelTextarea}>
          Termo de aceite
        </label>
        <textarea
          className="vk-tpl-textarea"
          value={aceite}
          onChange={e => setAceite(e.target.value)}
          onKeyDown={e => tplHandleEnterBullet(e, aceite, setAceite)}
          style={{ ...textareaBase, minHeight: 100 }}
          rows={4}
        />
      </div>

      {/* Card 4 — Valores (Fase 6b) */}
      <div id="secao-valores" style={card}>
        <div style={cardTitle}>Valores</div>
        <div style={{ fontSize: 12.5, color: "#9ca3af", lineHeight: 1.5, marginBottom: 14 }}>
          Edite manualmente os valores de Arquitetura e Engenharia. O total e os recálculos de pagamento atualizam em tempo real.
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: (safeData.incluiArq !== false && safeData.incluiEng) ? "1fr 1fr" : "1fr",
          gap: 16,
        }}>
          {(safeData.incluiArq !== false) && (
            <div>
              <label style={labelTextarea}>Arquitetura</label>
              <TplInputMoeda valor={valorArq} onChange={setValorArq} />
            </div>
          )}
          {safeData.incluiEng && (
            <div>
              <label style={labelTextarea}>Engenharia</label>
              <TplInputMoeda valor={valorEng} onChange={setValorEng} />
            </div>
          )}
        </div>

        {/* Total dinâmico — atualiza inline conforme o usuário edita */}
        <div style={{
          marginTop: 18, paddingTop: 14,
          borderTop: "1px solid #f3f4f6",
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
        }}>
          <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Total</span>
          <span style={{ fontSize: 18, color: "#262421", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {fmtBRL((Number(valorArq) || 0) + (Number(valorEng) || 0))}
          </span>
        </div>
      </div>

      {/* Card 5 — Pagamento (Fase 6c/6d/6d.1) */}
      <div id="secao-pagamento" style={card}>
        <div style={cardTitle}>Forma de pagamento</div>
        <div style={{ fontSize: 12.5, color: "#9ca3af", lineHeight: 1.5, marginBottom: 16 }}>
          Escolha o modo, as formas de pagamento e ajuste os valores. Tudo atualiza em tempo real.
        </div>

        {/* Formas de pagamento — checkboxes quadrados em linha horizontal,
            mesma nomenclatura e lógica da Etapa 5 (Tela 1). */}
        <style>{`
          .vk-tpl-fp-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
          .vk-tpl-fp-opt {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 10px 12px; background: #fff;
            border: 1.5px solid rgba(38,36,33,0.16); border-radius: 8px;
            cursor: pointer; text-align: left; flex: 1 1 0; min-width: 0;
            font-family: inherit; font-size: 12.5px; color: #262421;
            transition: all 0.12s; user-select: none;
          }
          .vk-tpl-fp-opt:hover .vk-tpl-fp-check { border-color: #9ca3af; }
          .vk-tpl-fp-opt.selected {
            background: #fdf6f0; border-color: #b5652f;
            box-shadow: 0 0 0 3px rgba(181,101,47,0.14);
            border-width: 1.5px; padding: 9px 11px; font-weight: 500;
          }
          .vk-tpl-fp-opt.selected .vk-tpl-fp-check { background: #b5652f; border-color: #b5652f; }
          .vk-tpl-fp-opt.selected .vk-tpl-fp-check-mark { display: block; }
          .vk-tpl-fp-check {
            flex-shrink: 0; width: 16px; height: 16px;
            border-radius: 4px; border: 1.5px solid rgba(38,36,33,0.16);
            background: #fff; display: flex; align-items: center; justify-content: center;
          }
          .vk-tpl-fp-check-mark { display: none; color: #fff; font-size: 10px; font-weight: 700; line-height: 1; }
          .vk-tpl-fp-label { flex: 1; line-height: 1.25; }
          @media (max-width: 720px) {
            .vk-tpl-fp-row { flex-direction: column; }
            .vk-tpl-fp-opt { flex: 0 0 auto; }
          }
        `}</style>
        <div className="vk-tpl-fp-row">
          {FORMAS_TPL.map(f => {
            const sel = formasTpl.includes(f.id);
            return (
              <div
                key={f.id}
                className={"vk-tpl-fp-opt" + (sel ? " selected" : "")}
                onClick={() => toggleFormaTpl(f.id)}>
                <span className="vk-tpl-fp-check">
                  <span className="vk-tpl-fp-check-mark">✓</span>
                </span>
                <span className="vk-tpl-fp-label">{f.label}</span>
              </div>
            );
          })}
        </div>

        {/* CSS auxiliar pros cards/etapas/modalidades — replicado da Etapa 5
            mas com prefixo .vk-tpl-fp2-* pra não conflitar. */}
        <style>{`
          .vk-tpl-fp2-card {
            display: flex; gap: 0; padding: 0;
            background: #fff; border: 1.5px solid rgba(38,36,33,0.16);
            border-radius: 10px; margin-bottom: 12px; overflow: hidden;
            transition: all 0.12s;
          }
          .vk-tpl-fp2-card.selected {
            border-color: #b5652f !important; border-width: 1.5px !important;
            background: #fdf6f0 !important;
            box-shadow: 0 0 0 3px rgba(181,101,47,0.14);
          }
          .vk-tpl-fp2-card.selected .vk-tpl-fp2-radio { border: 6px solid #b5652f !important; }
          .vk-tpl-fp2-radio:hover { border-color: #9ca3af; }
          .vk-tpl-fp2-radio {
            flex-shrink: 0; width: 22px; height: 22px;
            border-radius: 50%; border: 1.5px solid rgba(38,36,33,0.16);
            background: #fff; cursor: pointer; padding: 0;
            transition: all 0.12s; margin-top: 2px;
          }
          .vk-tpl-fp2-linha {
            display: grid; grid-template-columns: 130px 1fr;
            gap: 10px; align-items: center; padding: 6px 0;
          }
          .vk-tpl-fp2-linha + .vk-tpl-fp2-linha {
            border-top: 0.5px solid #f3f4f6; padding-top: 10px; margin-top: 4px;
          }
          .vk-tpl-fp2-linha-label { font-size: 12.5px; color: #6b7280; }
          .vk-tpl-fp2-linha-input { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
          .vk-tpl-fp2-resumo-bloco + .vk-tpl-fp2-resumo-bloco {
            padding-top: 10px; margin-top: 10px; border-top: 0.5px solid #e5e7eb;
          }
          .vk-tpl-fp2-resumo-label {
            font-size: 11px; font-weight: 600; color: #6b7280;
            text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;
          }
          .vk-tpl-fp2-resumo-principal { font-size: 14px; font-weight: 600; color: #262421; line-height: 1.3; }
          .vk-tpl-fp2-resumo-eco { font-size: 11px; color: #047857; }
          .vk-tpl-fp2-resumo-sub-label { font-size: 11.5px; color: #6b7280; margin-bottom: 2px; }
          .vk-tpl-fp2-resumo-sub-valor { font-size: 13px; font-weight: 500; color: #262421; line-height: 1.3; margin-bottom: 4px; }
          .vk-tpl-fp2-etapa-row {
            display: grid; grid-template-columns: 28px 1fr 100px 110px 22px;
            gap: 8px; padding: 8px 14px;
            border-bottom: 0.5px solid #f3f4f6; align-items: center;
          }
          .vk-tpl-fp2-etapa-row.eng { background: #fafbfc; }
          .vk-tpl-fp2-etapa-row:not(.incluida) { opacity: 0.45; }
          .vk-tpl-fp2-etapa-row:not(.incluida) .vk-tpl-fp2-etapa-nome,
          .vk-tpl-fp2-etapa-row:not(.incluida) .vk-tpl-fp2-etapa-valor {
            text-decoration: line-through; color: #9ca3af;
          }
          .vk-tpl-fp2-checkbox {
            cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
            width: 18px; height: 18px;
            border-radius: 4px; border: 1.5px solid rgba(38,36,33,0.16);
            background: #fff; transition: all 0.12s; user-select: none; margin: 0 auto;
          }
          .vk-tpl-fp2-etapa-row.incluida .vk-tpl-fp2-checkbox {
            background: #262421; border-color: #262421;
          }
          .vk-tpl-fp2-checkbox-inner { color: #fff; font-size: 11px; font-weight: 700; line-height: 1; }
          .vk-tpl-fp2-checkbox:hover { border-color: #6b7280; }
          .vk-tpl-fp2-etapa-row.incluida .vk-tpl-fp2-checkbox:hover {
            background: #1f2937; border-color: #1f2937;
          }
          .vk-tpl-fp2-etapa-nome {
            background: transparent; border: 0; font-size: 13px;
            font-family: inherit; color: #262421; padding: 2px 4px;
            border-radius: 3px; width: 100%;
          }
          .vk-tpl-fp2-etapa-nome:hover { background: #f9fafb; }
          .vk-tpl-fp2-etapa-nome:focus { background: #fff; outline: 1px solid #b5652f; }
          .vk-tpl-fp2-etapa-valor { font-size: 12.5px; text-align: right; color: #374151; }
          .vk-tpl-fp2-etapa-rm {
            cursor: pointer; text-align: center;
            color: #9ca3af; user-select: none; font-size: 14px;
          }
          .vk-tpl-fp2-etapa-rm:hover { color: #6b7280; }
          .vk-tpl-fp2-etapa-header {
            display: grid; grid-template-columns: 28px 1fr 100px 110px 22px;
            gap: 8px; padding: 10px 14px;
            border-bottom: 1.5px solid #262421; align-items: center;
          }
          .vk-tpl-fp2-etapa-total {
            display: grid; grid-template-columns: 28px 1fr 100px 110px 22px;
            gap: 8px; padding: 10px 14px;
            border-top: 1.5px solid #262421; align-items: center;
            background: #fafbfc;
          }
          @media (max-width: 720px) {
            .vk-tpl-fp2-card { flex-direction: column; }
            .vk-tpl-fp2-card > div:last-child {
              width: 100% !important; border-left: none !important;
              border-top: 0.5px solid #e5e7eb !important;
            }
            .vk-tpl-fp2-linha { grid-template-columns: 110px 1fr; }
          }
        `}</style>

        {/* UI dinâmica — replica TODA Etapa 5 Tela 2: cards Apenas Arq/Pacote
            quando há formas !== etapa, tabela de etapas + 2 modalidades quando
            etapa selecionada. Cascade reativo às escolhas. */}
        {(() => {
          const fmtBRLfp = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          const fmtCurto = v => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const incluiArqV = safeData.incluiArq !== false;
          const incluiEngV = !!safeData.incluiEng;
          const valorArqN  = Number(valorArq) || 0;
          const valorEngN  = Number(valorEng) || 0;
          const valorPacN  = (incluiArqV ? valorArqN : 0) + (incluiEngV ? valorEngN : 0);

          // Ordem fixa das formas, igual Etapa 5
          const ordemFormas = ["antecipado", "parcelas", "final", "etapa"];
          const ativas = ordemFormas.filter(f => formasTpl.includes(f));
          const formasParaCards = ehPorEtapa ? [] : ativas.filter(f => f !== "etapa");
          const temAntecipadoMod = formasTpl.includes("antecipado");

          // Helpers de cálculo
          const calcAnt = (base, pct) => {
            const valor = base * (1 - (Number(pct) || 0) / 100);
            return { valor, eco: base - valor };
          };
          const calcParc = (base, n) => base / Math.max(1, Number(n) || 1);
          const calcEntFin = (base, pct) => {
            const p = Number(pct) || 0;
            return { ent: base * (p / 100), fin: base * (1 - p / 100) };
          };

          // Render de uma linha de form dentro de um card de contratação
          const renderLinhaForma = (tipo, formaId) => {
            if (formaId === "antecipado") {
              const v = tipo === "arq" ? descArq : descPacote;
              const setter = tipo === "arq" ? setDescArq : setDescPacote;
              return (
                <div className="vk-tpl-fp2-linha" key="antecipado">
                  <span className="vk-tpl-fp2-linha-label">Antecipado · desc.</span>
                  <div className="vk-tpl-fp2-linha-input">
                    <NumStepper valor={v} onChange={setter} min={0} max={100} step={1} width={28} />
                    <span style={{ fontSize: 12.5, color: "#6b7280" }}>%</span>
                  </div>
                </div>
              );
            }
            if (formaId === "parcelas") {
              const v = tipo === "arq" ? parcArq : parcPacote;
              const setter = tipo === "arq" ? setParcArq : setParcPacote;
              return (
                <div className="vk-tpl-fp2-linha" key="parcelas">
                  <span className="vk-tpl-fp2-linha-label">Entrada + parcelas</span>
                  <div className="vk-tpl-fp2-linha-input">
                    <NumStepper valor={v} onChange={n => setter(Math.max(1, Math.round(n)))} min={1} max={24} step={1} width={28} />
                    <span style={{ fontSize: 12.5, color: "#6b7280" }}>×</span>
                  </div>
                </div>
              );
            }
            if (formaId === "final") {
              const v = tipo === "arq" ? entArq : entPacote;
              const setter = tipo === "arq" ? setEntArq : setEntPacote;
              return (
                <div className="vk-tpl-fp2-linha" key="final">
                  <span className="vk-tpl-fp2-linha-label">Entrada + final</span>
                  <div className="vk-tpl-fp2-linha-input">
                    <NumStepper valor={v} onChange={setter} min={0} max={100} step={1} width={28} />
                    <span style={{ fontSize: 12.5, color: "#6b7280" }}>%</span>
                    <span style={{ color: "#9ca3af", fontSize: 11, margin: "0 4px" }}>+</span>
                    <span style={{ fontSize: 12.5, color: "#6b7280" }}>final</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#6b7280", padding: "4px 8px", background: "#f3f4f6", borderRadius: 5 }}>
                      {100 - v}%
                    </span>
                  </div>
                </div>
              );
            }
            return null;
          };

          // Render do resumo lateral do card
          const renderResumo = (tipo) => {
            const base = tipo === "arq" ? valorArqN : valorPacN;
            const blocos = [];
            if (formasParaCards.includes("antecipado")) {
              const desc = tipo === "arq" ? descArq : descPacote;
              const { valor, eco } = calcAnt(base, desc);
              blocos.push(
                <div className="vk-tpl-fp2-resumo-bloco" key="antecipado">
                  <div className="vk-tpl-fp2-resumo-label">Antecipado</div>
                  <div className="vk-tpl-fp2-resumo-principal">{fmtBRLfp(Math.round(valor * 100) / 100)}</div>
                  {desc > 0 && <div className="vk-tpl-fp2-resumo-eco">economia {fmtCurto(eco)}</div>}
                </div>
              );
            }
            if (formasParaCards.includes("parcelas")) {
              const parc = tipo === "arq" ? parcArq : parcPacote;
              const v = calcParc(base, parc);
              const valorParc = Math.round(v * 100) / 100;
              blocos.push(
                <div className="vk-tpl-fp2-resumo-bloco" key="parcelas">
                  <div className="vk-tpl-fp2-resumo-label">Entrada + parcelas</div>
                  {parc === 1 ? (
                    <div className="vk-tpl-fp2-resumo-principal" style={{ fontSize: 13.5 }}>{fmtBRLfp(valorParc)} à vista</div>
                  ) : (
                    <>
                      <div className="vk-tpl-fp2-resumo-sub-label">Entrada</div>
                      <div className="vk-tpl-fp2-resumo-sub-valor">{fmtBRLfp(valorParc)}</div>
                      <div className="vk-tpl-fp2-resumo-sub-label">+ {parc - 1}× de</div>
                      <div className="vk-tpl-fp2-resumo-sub-valor">{fmtBRLfp(valorParc)}</div>
                    </>
                  )}
                </div>
              );
            }
            if (formasParaCards.includes("final")) {
              const ent = tipo === "arq" ? entArq : entPacote;
              const { ent: vEnt, fin: vFin } = calcEntFin(base, ent);
              blocos.push(
                <div className="vk-tpl-fp2-resumo-bloco" key="final">
                  <div className="vk-tpl-fp2-resumo-label">Entrada + final</div>
                  <div className="vk-tpl-fp2-resumo-sub-label">Entrada</div>
                  <div className="vk-tpl-fp2-resumo-sub-valor">{fmtBRLfp(Math.round(vEnt * 100) / 100)}</div>
                  <div className="vk-tpl-fp2-resumo-sub-label">Pgto final</div>
                  <div className="vk-tpl-fp2-resumo-sub-valor">{fmtBRLfp(Math.round(vFin * 100) / 100)}</div>
                </div>
              );
            }
            return (
              <div style={{ width: 200, padding: "18px 20px", background: "#fafbfc", borderLeft: "0.5px solid #e5e7eb", fontSize: 12, color: "#374151" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Resumo</div>
                <div>{blocos}</div>
              </div>
            );
          };

          // Render de um card de contratação (Apenas Arq / Pacote)
          const renderCard = (tipo, titulo) => {
            const sel = contratacoesTpl.includes(tipo);
            return (
              <div key={tipo} className={"vk-tpl-fp2-card" + (sel ? " selected" : "")}>
                <div style={{ flex: 1, padding: "18px 20px", display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <button type="button" className="vk-tpl-fp2-radio" onClick={() => toggleContratacaoTpl(tipo)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 500, color: "#262421", marginBottom: 14 }}>{titulo}</div>
                    {formasParaCards.map(f => renderLinhaForma(tipo, f))}
                  </div>
                </div>
                {renderResumo(tipo)}
              </div>
            );
          };

          // Cálculo de etapas — só usado no modo etapa
          const etapasFiltradas = etapasPctTpl.filter(e => {
            if (e.eng && !incluiEngV) return false;
            if (!e.eng && !incluiArqV) return false;
            return true;
          });
          const temIso = isoladasTpl.size > 0;
          let pctTotal = 0, valorTotal = 0, qtdEtapasMostradas = 0;
          if (temIso) {
            etapasFiltradas.forEach(e => {
              if (e.eng && isoladasTpl.has(5)) {
                valorTotal += valorEngN; qtdEtapasMostradas++;
              } else if (!e.eng && isoladasTpl.has(e.id)) {
                pctTotal += e.pct; valorTotal += valorArqN * (e.pct / 100); qtdEtapasMostradas++;
              }
            });
          } else {
            etapasFiltradas.forEach(e => {
              if (!e.eng) pctTotal += e.pct;
              qtdEtapasMostradas++;
            });
            valorTotal = (incluiArqV ? valorArqN : 0) + (incluiEngV ? valorEngN : 0);
          }
          const mostraEtUnica = qtdEtapasMostradas >= 1;
          const mostraCompletas = qtdEtapasMostradas >= 2;
          const mostraResumoUnica = qtdEtapasMostradas === 1;
          const baseUnica = valorTotal;
          const baseCompleto = valorTotal;
          const unicaAnt = baseUnica * (1 - (Number(descEtCtrt) || 0) / 100);
          const unicaEco = baseUnica - unicaAnt;
          const unicaParcVal = baseUnica / Math.max(1, parcEtCtrt);
          const completoAnt = baseCompleto * (1 - (Number(descPacCtrt) || 0) / 100);
          const completoEco = baseCompleto - completoAnt;
          const completoParcVal = baseCompleto / Math.max(1, parcPacCtrt);

          const mostraPacote = incluiArqV && incluiEngV;
          const tituloApenas = (incluiArqV && !incluiEngV) ? "Apenas Arquitetura"
                            : (!incluiArqV && incluiEngV) ? "Apenas Engenharia"
                            : "Apenas Arquitetura";

          return (
            <>
              {/* Cards de contratação — modo padrão */}
              {formasParaCards.length > 0 && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#262421", marginBottom: 6 }}>
                    Como o cliente vai poder contratar?
                  </div>
                  {mostraPacote && (
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10, lineHeight: 1.4 }}>
                      Marque <strong style={{ color: "#262421" }}>os dois</strong> pra cliente escolher entre Arq sozinha ou pacote completo. Marque <strong style={{ color: "#262421" }}>só Pacote</strong> pra forçar contratação conjunta.
                    </div>
                  )}
                  {renderCard("arq", tituloApenas)}
                  {mostraPacote && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, margin: "8px 0", fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>
                        <span style={{ flex: 1, height: 0, borderTop: "0.5px solid #e5e7eb" }}></span>
                        <span>ou</span>
                        <span style={{ flex: 1, height: 0, borderTop: "0.5px solid #e5e7eb" }}></span>
                      </div>
                      {renderCard("pac", "Pacote Arq + Eng")}
                    </>
                  )}
                </>
              )}

              {/* Tabela de etapas + 2 modalidades — modo etapa */}
              {ehPorEtapa && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#262421", marginBottom: 6, marginTop: formasParaCards.length > 0 ? 24 : 0 }}>
                    Pagamento por etapa
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12, lineHeight: 1.4 }}>
                    Defina o percentual de cada etapa. <strong style={{ color: "#262421" }}>Todas aparecem por padrão.</strong> Desmarque pra excluir alguma da proposta.
                  </div>

                  <div style={{ border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 14, padding: "4px 0", background: "#fff", marginBottom: 16 }}>
                    <div className="vk-tpl-fp2-etapa-header">
                      <span></span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#262421", textTransform: "uppercase", letterSpacing: "0.06em" }}>Etapa</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#262421", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center" }}>%</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#262421", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right" }}>Valor</span>
                      <span></span>
                    </div>
                    {etapasFiltradas.map(et => {
                      const incluida = isoladasTpl.size === 0 || isoladasTpl.has(et.id);
                      const valor = et.eng ? valorEngN : valorArqN * (et.pct / 100);
                      const rowCls = "vk-tpl-fp2-etapa-row" + (incluida ? " incluida" : "") + (et.eng ? " eng" : "");
                      return (
                        <div key={et.id} className={rowCls}>
                          <span className="vk-tpl-fp2-checkbox" onClick={() => toggleIsoladaTpl(et.id)}>
                            <span className="vk-tpl-fp2-checkbox-inner">{incluida ? "✓" : ""}</span>
                          </span>
                          <span>
                            <input type="text" className="vk-tpl-fp2-etapa-nome"
                              value={et.nome}
                              onChange={e => atualizarEtapaNomeTpl(et.id, e.target.value)}
                              readOnly={!!et.eng} />
                            {et.eng && <div style={{ fontSize: 10.5, color: "#9ca3af", paddingLeft: 4 }}>Estrutural · Elétrico · Hidrossanitário</div>}
                          </span>
                          {et.eng ? (
                            <span style={{ textAlign: "center", color: "#9ca3af" }}>—</span>
                          ) : (
                            <span style={{ textAlign: "center", display: "flex", justifyContent: "center" }}>
                              <NumStepper valor={et.pct} onChange={n => atualizarEtapaPctTpl(et.id, n)} min={0} max={100} step={1} width={28} />
                            </span>
                          )}
                          <span className="vk-tpl-fp2-etapa-valor">{fmtBRLfp(Math.round(valor * 100) / 100)}</span>
                          {(!et.eng && et.id > 4) ? (
                            <span className="vk-tpl-fp2-etapa-rm" onClick={() => removerEtapaTpl(et.id)} title="Remover etapa">×</span>
                          ) : <span></span>}
                        </div>
                      );
                    })}
                    {incluiArqV && (
                      <div style={{ padding: "8px 14px" }}>
                        <button type="button" onClick={adicionarEtapaTpl}
                          style={{ width: "100%", fontSize: 11.5, color: "#6b7280", background: "transparent", border: "1px dashed rgba(38,36,33,0.2)", borderRadius: 6, padding: 8, cursor: "pointer", fontFamily: "inherit" }}>
                          + Adicionar etapa
                        </button>
                      </div>
                    )}
                    <div className="vk-tpl-fp2-etapa-total">
                      <span></span>
                      <span style={{ fontWeight: 600, color: "#262421", fontSize: 13 }}>Total</span>
                      <span style={{ fontWeight: 600, color: "#262421", fontSize: 13, textAlign: "center" }}>{pctTotal}%</span>
                      <span style={{ fontWeight: 700, color: "#262421", fontSize: 14, textAlign: "right" }}>{fmtBRLfp(Math.round(valorTotal * 100) / 100)}</span>
                      <span></span>
                    </div>
                  </div>

                  <div style={{ marginTop: 16, marginBottom: 8, fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                    Como o cliente pode contratar? <span style={{ color: "#9ca3af" }}>Configure as modalidades. Mostradas conforme a quantidade de etapas selecionadas.</span>
                  </div>

                  {/* Modalidade 1: Contratação etapa a etapa */}
                  {mostraEtUnica && (
                    <div className="vk-tpl-fp2-card" style={{ display: "flex", marginBottom: 12 }}>
                      <div style={{ flex: 1, padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#262421" }}>Contratação etapa a etapa</span>
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>(quando há 1 etapa)</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: temAntecipadoMod ? "1fr 1fr" : "1fr", gap: 16 }}>
                          {temAntecipadoMod && (
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ fontSize: 12.5, color: "#6b7280", minWidth: 100 }}>Antecipado · desc.</span>
                              <NumStepper valor={descEtCtrt} onChange={setDescEtCtrt} min={0} max={100} step={1} width={28} />
                              <span style={{ fontSize: 12, color: "#6b7280" }}>%</span>
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 12.5, color: "#6b7280", minWidth: 80 }}>Parcelado</span>
                            <NumStepper valor={parcEtCtrt} onChange={n => setParcEtCtrt(Math.max(1, Math.round(n)))} min={1} max={24} step={1} width={28} />
                            <span style={{ fontSize: 12, color: "#6b7280" }}>×</span>
                          </div>
                        </div>
                      </div>
                      {mostraResumoUnica && (
                        <div style={{ width: 200, padding: "14px 16px", background: "#fafbfc", borderLeft: "0.5px solid #e5e7eb" }}>
                          <div className="vk-tpl-fp2-resumo-label">Resumo</div>
                          {temAntecipadoMod && (
                            <div className="vk-tpl-fp2-resumo-bloco">
                              <div className="vk-tpl-fp2-resumo-label">Antecipado</div>
                              <div className="vk-tpl-fp2-resumo-principal">{fmtBRLfp(Math.round(unicaAnt * 100) / 100)}</div>
                              {descEtCtrt > 0 && <div className="vk-tpl-fp2-resumo-eco">economia {fmtCurto(unicaEco)}</div>}
                            </div>
                          )}
                          <div className="vk-tpl-fp2-resumo-bloco">
                            <div className="vk-tpl-fp2-resumo-label">Parcelado</div>
                            <div className="vk-tpl-fp2-resumo-sub-valor">{parcEtCtrt}× {fmtBRLfp(Math.round(unicaParcVal * 100) / 100)}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Modalidade 2: Etapas completas */}
                  {mostraCompletas && (
                    <div className="vk-tpl-fp2-card" style={{ display: "flex" }}>
                      <div style={{ flex: 1, padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#262421" }}>Etapas completas</span>
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>(quando há 2+ etapas)</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: temAntecipadoMod ? "1fr 1fr" : "1fr", gap: 16 }}>
                          {temAntecipadoMod && (
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ fontSize: 12.5, color: "#6b7280", minWidth: 100 }}>Antecipado · desc.</span>
                              <NumStepper valor={descPacCtrt} onChange={setDescPacCtrt} min={0} max={100} step={1} width={28} />
                              <span style={{ fontSize: 12, color: "#6b7280" }}>%</span>
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 12.5, color: "#6b7280", minWidth: 80 }}>Parcelado</span>
                            <NumStepper valor={parcPacCtrt} onChange={n => setParcPacCtrt(Math.max(1, Math.round(n)))} min={1} max={24} step={1} width={28} />
                            <span style={{ fontSize: 12, color: "#6b7280" }}>×</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ width: 200, padding: "14px 16px", background: "#fafbfc", borderLeft: "0.5px solid #e5e7eb" }}>
                        <div className="vk-tpl-fp2-resumo-label">Resumo</div>
                        {temAntecipadoMod && (
                          <div className="vk-tpl-fp2-resumo-bloco">
                            <div className="vk-tpl-fp2-resumo-label">Antecipado</div>
                            <div className="vk-tpl-fp2-resumo-principal">{fmtBRLfp(Math.round(completoAnt * 100) / 100)}</div>
                            {descPacCtrt > 0 && <div className="vk-tpl-fp2-resumo-eco">economia {fmtCurto(completoEco)}</div>}
                          </div>
                        )}
                        <div className="vk-tpl-fp2-resumo-bloco">
                          <div className="vk-tpl-fp2-resumo-label">Parcelado</div>
                          <div className="vk-tpl-fp2-resumo-sub-valor">{parcPacCtrt}× {fmtBRLfp(Math.round(completoParcVal * 100) / 100)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          );
        })()}
      </div>

        </div>{/* fim do conteúdo (lado direito do grid) */}
      </div>{/* fim do grid sidebar+conteúdo */}

      {/* Botões de ação */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginTop: 24, gap: 16, flexWrap: "wrap",
      }}>
        <button
          className="vk-tpl-btn-ghost"
          onClick={onPular}
          style={btnGhost}>
          Pular esta etapa
        </button>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="vk-tpl-btn-secondary"
            onClick={onVoltar}
            style={btnSecondary}>
            Voltar
          </button>
          <button
            className="vk-tpl-btn-primary"
            onClick={handleProsseguir}
            style={btnPrimary}>
            Gerar orçamento
          </button>
        </div>
      </div>
    </div>
  );
}
