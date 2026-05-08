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
          border: "1px solid #d1d5db",
          borderRadius: 10,
          padding: "11px 12px 11px 36px",
          fontSize: 14,
          fontFamily: "inherit",
          outline: "none",
          fontVariantNumeric: "tabular-nums",
          boxSizing: "border-box",
          transition: "border-color 0.12s",
        }}
        onFocus={e => { e.currentTarget.style.borderColor = "#111"; }}
        onBlurCapture={e => { e.currentTarget.style.borderColor = "#d1d5db"; }}
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
  // preserva o valor salvo. Recálculo inline (parcelas/totais) virá nas
  // sub-fases 6c+; aqui já capturamos os valores e exibimos o total.
  const tv = safeData.template?.valores || {};
  const calcRef = safeData.calculo || {};
  const [valorArq, setValorArq] = useState(
    tv.valorArq != null ? Number(tv.valorArq) : (Number(calcRef.precoArq) || 0)
  );
  const [valorEng, setValorEng] = useState(
    tv.valorEng != null ? Number(tv.valorEng) : (Number(calcRef.precoEng) || 0)
  );

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
        valorArq: Number(valorArq) || 0,
        valorEng: Number(valorEng) || 0,
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
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  };
  const card = {
    background: "#fff",
    border: "1px solid #e5e7eb",
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
  const labelOptional = { color: "#d1d5db", fontWeight: 400 };
  const textareaBase = {
    width: "100%",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 13.5, color: "#111",
    fontFamily: "inherit",
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
    lineHeight: 1.5,
    transition: "border-color 0.12s",
  };
  const btnPrimary = {
    background: "#111", color: "#fff",
    border: "none", borderRadius: 10,
    padding: "12px 22px",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.15s",
  };
  const btnSecondary = {
    background: "#fff", color: "#374151",
    border: "1px solid #d1d5db", borderRadius: 10,
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
    { id: "secao-pagamento",   label: "Pagamento",      placeholder: true },
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
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  };

  return (
    <div style={wrapNovo}>
      <style>{`
        .vk-tpl-textarea:focus { border-color: #111 !important; }
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
          color: #111;
        }
        .vk-tpl-sidebar-item.is-active {
          background: #f3f4f6;
          color: #111;
          font-weight: 600;
        }
        .vk-tpl-sidebar-item.is-placeholder {
          color: #d1d5db;
          cursor: not-allowed;
          font-style: italic;
        }
        .vk-tpl-sidebar-item.is-placeholder:hover {
          background: transparent;
          color: #d1d5db;
        }
        @media (max-width: 720px) {
          .vk-tpl-grid { grid-template-columns: 1fr !important; gap: 0 !important; }
          .vk-tpl-sidebar {
            position: static !important;
            top: auto !important;
            margin-bottom: 16px;
            border: 1px solid #e5e7eb;
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
        <div style={{ fontSize: 22, fontWeight: 300, color: "#111", letterSpacing: -0.4, lineHeight: 1.2 }}>
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
          <span style={{ color: "#111", fontWeight: 500 }}>{safeData.clienteNome || "—"}</span>
        </div>
        <div style={resumoRow}>
          <span style={{ color: "#6b7280" }}>Projeto</span>
          <span style={{ color: "#111", fontWeight: 500 }}>{tipoTxt}</span>
        </div>
        <div style={resumoRow}>
          <span style={{ color: "#6b7280" }}>Padrão</span>
          <span style={{ color: "#111", fontWeight: 500 }}>{padraoTxt}</span>
        </div>
        {safeData.calculo?.areaTotal ? (
          <div style={resumoRow}>
            <span style={{ color: "#6b7280" }}>Área total</span>
            <span style={{ color: "#111", fontWeight: 500 }}>
              {Number(safeData.calculo.areaTotal).toLocaleString("pt-BR")} m²
            </span>
          </div>
        ) : null}
        <div style={resumoRow}>
          <span style={{ color: "#6b7280" }}>Responsável técnico</span>
          <span style={{ color: "#111", fontWeight: 500 }}>{respLabel}</span>
        </div>
        {safeData.totCI ? (
          <div style={{
            ...resumoRow,
            marginTop: 10, paddingTop: 12,
            borderTop: "1px solid #f3f4f6",
            fontSize: 14,
          }}>
            <span style={{ color: "#111", fontWeight: 600 }}>Honorário total</span>
            <span style={{ color: "#111", fontWeight: 700 }}>{fmtBRL(safeData.totCI)}</span>
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
          <span style={{ fontSize: 18, color: "#111", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {fmtBRL((Number(valorArq) || 0) + (Number(valorEng) || 0))}
          </span>
        </div>
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
