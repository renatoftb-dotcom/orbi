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

  function handleProsseguir() {
    onProsseguir({
      descricaoProjeto: descricaoProjeto.trim(),
      apresentacao: apresentacao.trim(),
      escopo: escopo.trim(),
      naoInclusos: naoInclusos.trim(),
      prazo: prazo.trim(),
      aceite: aceite.trim(),
      observacoes: observacoes.trim(),
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
          Os dados do projeto já estão preenchidos. Edite livremente os textos abaixo — escopo, prazos, não inclusos e termo de aceite vêm pré-preenchidos com o conteúdo padrão da proposta. Você pode pular esta etapa pra usar os textos padrão sem alterações.
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

      {/* Card 2 — Textos introdutórios */}
      <div style={card}>
        <div style={cardTitle}>Descrição, apresentação e observações</div>

        <label style={labelTextarea}>
          Descrição do projeto
        </label>
        <textarea
          className="vk-tpl-textarea"
          value={descricaoProjeto}
          onChange={e => setDescricaoProjeto(e.target.value)}
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
          placeholder="Considerações finais, prazos especiais, condições particulares..."
          style={{ ...textareaBase, minHeight: 100 }}
          rows={4}
        />
      </div>

      {/* Card 3 — Escopo e detalhes técnicos (pré-preenchidos com defaults) */}
      <div style={card}>
        <div style={cardTitle}>Escopo e detalhes técnicos</div>

        <label style={labelTextarea}>
          Escopo dos serviços
        </label>
        <textarea
          className="vk-tpl-textarea"
          value={escopo}
          onChange={e => setEscopo(e.target.value)}
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
          style={{ ...textareaBase, minHeight: 100 }}
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
