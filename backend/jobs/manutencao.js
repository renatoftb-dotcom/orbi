// ═══════════════════════════════════════════════════════════════
// VICKE — Jobs de Manutenção
// ═══════════════════════════════════════════════════════════════
// Jobs rodam automaticamente (via node-cron) todo dia às 3 AM,
// ou manualmente via endpoint POST /api/admin/manutencao
// ═══════════════════════════════════════════════════════════════


/**
 * Inativa clientes sem serviço em aberto há mais de 3 meses.
 * "Serviço em aberto" = ao menos um dos seguintes:
 *   - Orçamento com status "rascunho" ou "aberto"
 *   - Projeto no Kanban de Etapas (futuro: data.projetos)
 *   - Obra não finalizada (futuro: data.obras com status != "finalizada")
 * Data de referência pra os 3 meses: `atualizado_em` do orçamento mais recente.
 * Se nunca teve orçamento, usa data de criação do cliente.
 */
async function inativarClientes(query) {
  const LIMITE_MESES = 3;
  const limiteMs = Date.now() - LIMITE_MESES * 30 * 24 * 60 * 60 * 1000;
  const limiteDate = new Date(limiteMs);

  // Busca todos os clientes ativos
  const { rows: clientes } = await query(`
    SELECT id, dados, criado_em FROM clientes
    WHERE COALESCE((dados->>'ativo')::boolean, TRUE) = TRUE
  `);

  const agora = new Date();
  const agoraISO = agora.toISOString();
  let inativados = 0;

  for (const row of clientes) {
    const cliente = row.dados;

    // Busca orçamentos do cliente
    const { rows: orcs } = await query(
      `SELECT dados, atualizado_em FROM orcamentos_projeto WHERE cliente_id=$1`,
      [row.id]
    );

    // Tem algum orçamento em aberto?
    const temAberto = orcs.some(o => {
      const st = o.dados?.status;
      return st === "rascunho" || st === "aberto" || !st;
    });
    if (temAberto) continue; // cliente ativo por ter serviço aberto

    // Data de referência: atualização mais recente entre orçamentos, ou criação do cliente
    let ultimaAtividade = row.criado_em;
    for (const o of orcs) {
      if (o.atualizado_em > ultimaAtividade) ultimaAtividade = o.atualizado_em;
    }
    const ultimaDate = new Date(ultimaAtividade);
    if (ultimaDate > limiteDate) continue; // ainda dentro dos 3 meses

    // Inativa
    const dataFmt = agora.toLocaleDateString("pt-BR");
    const observacaoAuto = `[${dataFmt}] Cliente ficou inativo automaticamente, sem serviços em aberto há ${LIMITE_MESES} meses.`;
    const observacoesExistentes = cliente.observacoes || "";
    const novasObservacoes = observacoesExistentes
      ? `${observacoesExistentes}\n\n${observacaoAuto}`
      : observacaoAuto;

    const clienteAtualizado = {
      ...cliente,
      ativo: false,
      inativadoEm: agoraISO,
      inativadoAutomaticamente: true,
      observacoes: novasObservacoes,
    };

    await query(
      `UPDATE clientes SET dados=$1, atualizado_em=NOW() WHERE id=$2`,
      [clienteAtualizado, row.id]
    );
    inativados++;
  }

  return { clientesInativados: inativados };
}

/**
 * Executa todas as tarefas de manutenção em sequência.
 */
async function rodarManutencao(query) {
  console.log("[manutenção] Iniciando...");
  const clientes  = await inativarClientes(query);
  const resumo = {
    executadoEm: new Date().toISOString(),
    ...clientes,
  };
  console.log("[manutenção] Concluída:", resumo);
  return resumo;
}

module.exports = { expirarPropostas, inativarClientes, rodarManutencao };
