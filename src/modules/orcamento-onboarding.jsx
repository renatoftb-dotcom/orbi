// ════════════════════════════════════════════════════════════════
// orcamento-onboarding.jsx — Novo fluxo guiado de criação de orçamento
// ════════════════════════════════════════════════════════════════
// Versão Beta acessada via botão "Novo (Beta)" na lista de orçamentos.
// Visível apenas em empresas com dev_mode=true (ex: Vicke Dev).
//
// CONTEÚDO EM CONSTRUÇÃO — placeholder até definirmos o fluxo novo.
// Props mantidas estáveis pra integração com TesteOrcamento não quebrar:
//   data        — objeto global { clientes, orcamentosProjeto, escritorio, ... }
//   save        — função pra persistir alterações no data
//   onVoltar    — fecha o onboarding sem salvar
//   onConcluido — fecha o onboarding após salvar (próximo passo: orçamento criado)

function OrcamentoOnboarding({ data, save, onVoltar, onConcluido }) {
  return (
    <div style={{
      background: "#fff", minHeight: "100vh",
      padding: "60px 24px",
      fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif",
      display: "flex", justifyContent: "center", alignItems: "flex-start",
    }}>
      <div style={{ maxWidth: 560, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🧪</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "#111", margin: "0 0 8px" }}>
          Onboarding de Orçamento
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, margin: "0 0 32px" }}>
          Em construção. Aguardando definição do fluxo.
        </p>
        <button onClick={onVoltar} style={{
          background: "transparent", color: "#6b7280",
          border: "1px solid #e5e7eb", borderRadius: 8,
          padding: "10px 20px", fontSize: 13, fontWeight: 500,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          ← Voltar
        </button>
      </div>
    </div>
  );
}
