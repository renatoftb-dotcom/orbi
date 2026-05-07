// ═══════════════════════════════════════════════════════════════
// MODELOS DE ORÇAMENTO — Registry central
// ═══════════════════════════════════════════════════════════════
// Lista de todos os modelos visuais disponíveis pra renderização da
// proposta. Cada empresa escolhe um modelo default (escritorio.modelo_default,
// salvo no JSONB do escritório no backend — sem schema change necessário).
// O usuário pode trocar o modelo a qualquer momento via barra superior do
// orçamento. Quando não há escolha, cai no primeiro item desta lista.
//
// Cada modelo é um componente que recebe os mesmos props (data, onVoltar,
// onSalvarProposta, propostaReadOnly, propostaSnapshot, lockEdicao) e
// renderiza a proposta com layout/estilo distintos.
//
// Para adicionar um novo modelo:
//   1. Criar arquivo modelo-{id}.jsx (ex: modelo-minimalista.jsx)
//   2. Adicionar ao combine.js ORDER (antes deste arquivo)
//   3. Adicionar entrada aqui em MODELOS_ORCAMENTO
// ═══════════════════════════════════════════════════════════════

const MODELOS_ORCAMENTO = [
  {
    id: "padrao",
    label: "Padrão",
    desc: "Sóbrio, preto e branco — o modelo original",
    componente: typeof PropostaPreview !== "undefined" ? PropostaPreview : null,
  },
  // Próximos modelos virão aqui (ex: minimalista, técnico, etc).
];

// Retorna o componente do modelo escolhido. Fallback pro primeiro item da
// lista quando o id não existir, for null/undefined ou o componente estiver
// indisponível (ex: ainda não importado pelo combine).
function getModeloOrcamento(id) {
  const escolhido = MODELOS_ORCAMENTO.find(m => m.id === id);
  return (escolhido && escolhido.componente) || MODELOS_ORCAMENTO[0].componente;
}

// Retorna a entry completa do modelo (id, label, desc, componente) — usado
// pela UI da galeria/seletor de modelos (Fase 6).
function getModeloEntry(id) {
  return MODELOS_ORCAMENTO.find(m => m.id === id) || MODELOS_ORCAMENTO[0];
}
