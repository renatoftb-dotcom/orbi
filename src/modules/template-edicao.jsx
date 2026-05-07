// ═══════════════════════════════════════════════════════════════
// TEMPLATE DE EDIÇÃO — tela de ajustes finais antes do preview
// ═══════════════════════════════════════════════════════════════
// Tipo "Word com texto livre" — campos estruturados (read-only) com os
// dados do orçamento já configurados nas etapas anteriores + textareas
// livres pra apresentação, escopo e observações.
//
// Os textos editados aqui são guardados em propostaData.template.textos no
// FormOrcamentoProjetoTeste e ficam disponíveis pros modelos visuais
// (ModeloPadrao + futuros) consumirem ao renderizar a proposta final.
//
// Pode ser pulado via botão "Pular esta etapa" — nesse caso os textos
// ficam vazios e cada modelo usa seus próprios defaults internos.
//
// Layout: minimalista, mood Claude AI (cards rounded 14px, sem zebra,
// borders #e5e7eb, espaçamento generoso, tipografia consistente com o
// fluxograma do onboarding).
// ═══════════════════════════════════════════════════════════════

// Defaults pros textos das textareas — pré-preenchem na primeira abertura
// do template (quando ainda não há textos salvos no orçamento).
const TPL_DEFAULT_APRESENTACAO =
  "Olá! Apresentamos esta proposta para o desenvolvimento do projeto. Estamos à disposição para esclarecer qualquer dúvida.";
const TPL_DEFAULT_ESCOPO =
  "Projeto arquitetônico completo, contemplando estudo preliminar, anteprojeto, projeto executivo, detalhamentos, plantas, cortes e fachadas.";
const TPL_DEFAULT_OBSERVACOES =
  "Os serviços não inclusos podem ser contratados separadamente como serviços adicionais. A proposta tem validade de 15 dias a partir da data de emissão.";

function TemplateEdicao({ data, escritorio, onVoltar, onProsseguir, onPular }) {
  const safeData = data || {};
  const esc = escritorio || {};

  // Inicialização preserva edições anteriores. Se não houver template salvo
  // (primeiro acesso), aplica os defaults acima.
  const tx = safeData.template?.textos || {};
  const [apresentacao, setApresentacao] = useState(
    tx.apresentacao !== undefined ? tx.apresentacao : TPL_DEFAULT_APRESENTACAO
  );
  const [escopo, setEscopo] = useState(
    tx.escopo !== undefined ? tx.escopo : TPL_DEFAULT_ESCOPO
  );
  const [observacoes, setObservacoes] = useState(
    tx.observacoes !== undefined ? tx.observacoes : TPL_DEFAULT_OBSERVACOES
  );

  function handleProsseguir() {
    onProsseguir({
      apresentacao: apresentacao.trim(),
      escopo: escopo.trim(),
      observacoes: observacoes.trim(),
    });
  }

  // Helpers de display
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
  const textareaStyle = {
    width: "100%",
    minHeight: 100,
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

  return (
    <div style={wrap}>
      <style>{`
        .vk-tpl-textarea:focus { border-color: #111 !important; }
        .vk-tpl-btn-primary:hover { background: #000 !important; }
        .vk-tpl-btn-secondary:hover { border-color: #9ca3af !important; }
        .vk-tpl-btn-ghost:hover { color: #6b7280 !important; }
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
          Os dados do projeto já estão preenchidos. Aqui você pode personalizar os textos que vão aparecer na proposta — ou pular essa etapa para usar os textos padrão do modelo.
        </div>
      </div>

      {/* Card 1 — Resumo dos dados estruturados (read-only) */}
      <div style={card}>
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

      {/* Card 2 — Textos livres */}
      <div style={card}>
        <div style={cardTitle}>Textos da proposta</div>

        <label style={labelTextarea}>
          Apresentação ao cliente <span style={{ color: "#d1d5db", fontWeight: 400 }}>· opcional</span>
        </label>
        <textarea
          className="vk-tpl-textarea"
          value={apresentacao}
          onChange={e => setApresentacao(e.target.value)}
          placeholder="Olá, [nome]! Apresentamos esta proposta para..."
          style={textareaStyle}
          rows={4}
        />

        <div style={{ height: 18 }} />

        <label style={labelTextarea}>
          Escopo do projeto <span style={{ color: "#d1d5db", fontWeight: 400 }}>· opcional</span>
        </label>
        <textarea
          className="vk-tpl-textarea"
          value={escopo}
          onChange={e => setEscopo(e.target.value)}
          placeholder="Descreva o escopo: o que está incluído, etapas, entregas..."
          style={{ ...textareaStyle, minHeight: 130 }}
          rows={6}
        />

        <div style={{ height: 18 }} />

        <label style={labelTextarea}>
          Observações finais <span style={{ color: "#d1d5db", fontWeight: 400 }}>· opcional</span>
        </label>
        <textarea
          className="vk-tpl-textarea"
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
          placeholder="Considerações finais, prazos especiais, condições particulares..."
          style={textareaStyle}
          rows={4}
        />
      </div>

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
