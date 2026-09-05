// ═══════════════════════════════════════════════════════════════
// OBRA-FINANCEIRO — Taxonomia do P&L de Obra
// ═══════════════════════════════════════════════════════════════
// Este módulo nasce da especificação em docs/SPEC-PL-OBRA.md, derivada de
// uma planilha de gestão de obra em produção (obra Residencial Villa
// Toscana, mai/25–mar/26, 151 notas, R$ 303.911,73 de custo).
//
// Nesta primeira entrega (§9, passo 1 da spec) o módulo contém SOMENTE a
// taxonomia — nenhum cálculo, nenhuma UI, nenhum formulário. Os `id` de
// contas e etapas são chave persistida no lançamento: nunca renomear,
// abreviar ou reordenar depois que houver dado gravado (ver §10 da spec).
//
// Registrado em combine.js entre "outros.jsx" e "clientes.jsx", porque
// clientes.jsx (GestaoObraPanel) é quem vai consumir esta taxonomia.
// ═══════════════════════════════════════════════════════════════

// ── Grupos do P&L — cada grupo tem sinal (+1 entrada, -1 custo, 0 fora do
// resultado) e a flag entra_no_resultado usada pelo cálculo (§4 da spec). ──
const GRUPOS_PL = [
  { id: "receitas",  titulo: "ENTRADAS TOTAIS",           sinal: +1, entra_no_resultado: true  },
  { id: "materiais", titulo: "MATERIAL & INSUMOS",        sinal: -1, entra_no_resultado: true  },
  { id: "maoDeObra", titulo: "MÃO DE OBRA & PRESTADORES", sinal: -1, entra_no_resultado: true  },
  { id: "servicos",  titulo: "SERVIÇOS & TAXAS",          sinal: -1, entra_no_resultado: true  },
  { id: "excluidas", titulo: "EXCLUÍDAS",                 sinal:  0, entra_no_resultado: false },
];

// ── Plano de contas — cada conta pertence a um grupo de GRUPOS_PL. ──
const PLANO_CONTAS = [
  // ── receitas ──────────────────────────────────────────────
  { id: "deposito_proprio",   nome: "Depósito Recurso Próprio",  grupo: "receitas" },
  { id: "liberacao_financ",   nome: "Liberação de financiamento", grupo: "receitas" },
  { id: "cartao_credito",     nome: "Cartão de crédito",          grupo: "receitas" },

  // ── material & insumos ────────────────────────────────────
  { id: "material",           nome: "Material",                          grupo: "materiais" },
  { id: "frete",              nome: "Frete",                             grupo: "materiais" },
  { id: "aluguel_equip",      nome: "Aluguel de ferramentas e equipamentos", grupo: "materiais" },
  { id: "combustivel",        nome: "Combustível",                       grupo: "materiais" },
  { id: "compra_ferramentas", nome: "Compra de ferramentas",             grupo: "materiais" },
  { id: "agua",               nome: "Conta de água",                     grupo: "materiais" },
  { id: "energia",            nome: "Energia elétrica",                  grupo: "materiais" },
  { id: "instalacoes_obra",   nome: "Instalações da obra",               grupo: "materiais" },
  { id: "manutencao_equip",   nome: "Manutenção de equipamentos",        grupo: "materiais" },
  { id: "terraplanagem",      nome: "Terraplanagem",                     grupo: "materiais" },

  // ── mão de obra & prestadores ─────────────────────────────
  { id: "ajudantes",          nome: "Ajudantes",                grupo: "maoDeObra" },
  { id: "carpinteiro",        nome: "Carpinteiro",              grupo: "maoDeObra" },
  { id: "eletricista",        nome: "Eletricista",              grupo: "maoDeObra" },
  { id: "empreiteiro",        nome: "Empreiteiro",              grupo: "maoDeObra" },
  { id: "encarregados",       nome: "Encarregados",             grupo: "maoDeObra" },
  { id: "mo_diversos",        nome: "Mão de obra — diversos",   grupo: "maoDeObra" },
  { id: "marceneiro",         nome: "Marceneiro",               grupo: "maoDeObra" },
  { id: "pedreiros",          nome: "Pedreiros",                grupo: "maoDeObra" },
  { id: "pintor",             nome: "Pintor",                   grupo: "maoDeObra" },
  { id: "serralheiro",        nome: "Serralheiro",              grupo: "maoDeObra" },
  { id: "impermeabilizacao",  nome: "Impermeabilização",        grupo: "maoDeObra" },
  { id: "encanador",          nome: "Encanador",                grupo: "maoDeObra" },
  { id: "gesseiro",           nome: "Gesseiro",                 grupo: "maoDeObra" },
  { id: "instalador_ar",      nome: "Instalador de ar condicionado", grupo: "maoDeObra" },
  { id: "assentador_pisos",   nome: "Assentador de pisos e revestimentos", grupo: "maoDeObra" },
  { id: "vale_refeicao",      nome: "Vale refeição",            grupo: "maoDeObra" },
  { id: "fgts",               nome: "FGTS",                     grupo: "maoDeObra" },
  { id: "darf",               nome: "DARF",                     grupo: "maoDeObra" },

  // ── serviços & taxas ──────────────────────────────────────
  { id: "impostos",           nome: "Impostos",                          grupo: "servicos" },
  { id: "impressao_plantas",  nome: "Impressão de plantas",              grupo: "servicos" },
  { id: "outras_taxas",       nome: "Outras taxas e serviços",           grupo: "servicos" },
  { id: "tarifas_bancarias",  nome: "Tarifas bancárias",                 grupo: "servicos" },
  { id: "projetos_docs",      nome: "Projetos e documentação",           grupo: "servicos" },
  { id: "taxa_admin_obra",    nome: "Taxa de administração da obra",     grupo: "servicos" },
  { id: "contabilidade",      nome: "Escritório de contabilidade",       grupo: "servicos" },

  // ── excluídas (fora do resultado) ─────────────────────────
  { id: "reembolsos",         nome: "Reembolsos",               grupo: "excluidas" },
];

// ── Etapas de execução da obra — ordem construtiva, preservar. Cada etapa
// pertence a uma macroetapa usada nos agrupamentos/rankings. ──
const ETAPAS_OBRA = [
  { id:"pre_obra",            nome:"Instalações pré-obra e projetos",  macro:"Pré-obra" },
  { id:"poste_padrao",        nome:"Poste padrão",                     macro:"Pré-obra" },
  { id:"terraplanagem",       nome:"Terraplanagem",                    macro:"Terraplanagem e demolições" },
  { id:"demolicoes",          nome:"Demolições e entulhos",            macro:"Terraplanagem e demolições" },
  { id:"arrimos",             nome:"Arrimos",                          macro:"Arrimos" },
  { id:"imp_arrimo",          nome:"Impermeabilização de arrimo",      macro:"Impermeabilizações" },
  { id:"fundacao",            nome:"Fundação",                         macro:"Fundação" },
  { id:"imp_baldrame",        nome:"Impermeabilização de baldrame",    macro:"Impermeabilizações" },
  { id:"contrapiso_int_1",    nome:"Contrapiso interno pav. 1",        macro:"Contrapisos" },
  { id:"supra_paredes_1",     nome:"Supraestrutura e paredes pav. 1",  macro:"Supraestrutura e paredes" },
  { id:"laje_1",              nome:"Laje pav. 1",                      macro:"Lajes" },
  { id:"supra_paredes_2",     nome:"Supraestrutura e paredes pav. 2",  macro:"Supraestrutura e paredes" },
  { id:"laje_2",              nome:"Laje pav. 2",                      macro:"Lajes" },
  { id:"coberturas",          nome:"Coberturas",                       macro:"Coberturas" },
  { id:"imp_perimetro",       nome:"Impermeabilização perímetro de paredes", macro:"Impermeabilizações" },
  { id:"imp_areas_molhadas",  nome:"Impermeabilização de áreas molhadas",    macro:"Impermeabilizações" },
  { id:"chapisco_reboco",     nome:"Chapisco e reboco",                macro:"Chapisco e reboco" },
  { id:"eletrica",            nome:"Elétrica",                         macro:"Elétrica" },
  { id:"hidraulica",          nome:"Hidráulica",                       macro:"Hidráulica" },
  { id:"esgoto_pluvial",      nome:"Esgoto e pluvial",                 macro:"Hidráulica" },
  { id:"contrapiso_ext",      nome:"Contrapisos externos",             macro:"Contrapisos" },
  { id:"massa_contrapiso_int",nome:"Massa de contrapisos internos",    macro:"Contrapisos" },
  { id:"massa_contrapiso_ext",nome:"Massa de contrapisos externos",    macro:"Contrapisos" },
  { id:"muros",               nome:"Muros",                            macro:"Muros" },
  { id:"portoes",             nome:"Portões",                          macro:"Portões" },
  { id:"pisos_revest",        nome:"Pisos e revestimentos",            macro:"Pisos e revestimentos" },
  { id:"forros",              nome:"Forros",                           macro:"Forros" },
  { id:"pintura",             nome:"Pintura",                          macro:"Pintura" },
  { id:"soleiras_peitoris",   nome:"Soleiras e peitoris",              macro:"Granito" },
  { id:"bancadas",            nome:"Bancadas",                         macro:"Granito" },
  { id:"portas_internas",     nome:"Portas internas",                  macro:"Portas e esquadrias" },
  { id:"esquadrias",          nome:"Esquadrias",                       macro:"Portas e esquadrias" },
  { id:"vidros_plasticos",    nome:"Vidros e plásticos",               macro:"Vidros e plásticos" },
  { id:"acab_eletrico",       nome:"Acabamento elétrico e luminárias", macro:"Elétrica" },
  { id:"loucas_metais",       nome:"Louças, metais e cubas",           macro:"Louças, metais e cubas" },
  { id:"marcenaria",          nome:"Marcenaria",                       macro:"Marcenaria" },
  { id:"calcadas",            nome:"Calçadas",                         macro:"Calçadas" },
  { id:"aquecimento",         nome:"Aquecimento e pressurização",      macro:"Aquecimento e pressurização" },
  { id:"piscina_equip",       nome:"Piscina — filtro, hidro e aquecimento", macro:"Piscina" },
  { id:"piscina_fundacao",    nome:"Piscina — fundação",               macro:"Piscina" },
  { id:"piscina_supra",       nome:"Piscina — supraestrutura e paredes", macro:"Piscina" },
  { id:"piscina_imp",         nome:"Piscina — impermeabilizações",     macro:"Piscina" },
  { id:"piscina_chapisco",    nome:"Piscina — chapisco e reboco",      macro:"Piscina" },
  { id:"piscina_revest",      nome:"Piscina — revestimento",           macro:"Piscina" },
  { id:"piscina_hidraulica",  nome:"Piscina — hidráulica",             macro:"Piscina" },
  { id:"piscina_deck",        nome:"Piscina — deck",                   macro:"Piscina" },
  { id:"limpeza_final",       nome:"Limpeza final",                    macro:"Limpeza final" },
  { id:"locacao_equip",       nome:"Locação de equipamentos",          macro:"Locação de equipamentos" },
  { id:"prestadores",         nome:"Prestadores de serviços",          macro:"Prestadores de serviços" },
  { id:"outros",              nome:"Outros",                           macro:"Outros" },
];

// ── Grupos de material — dimensão de suprimentos, usada no lançamento e
// nos rankings. Lista simples de strings (sem id próprio na spec). ──
const GRUPOS_MATERIAL = [
  "Aço", "Areia e pedra", "Argamassas", "Cimento", "Elétrica e iluminação",
  "Entulhos", "Equipamentos", "Esquadrias", "Ferramentas", "Forros", "Granito",
  "Impermeabilizantes", "Locação de ferramentas", "Louças", "Madeira de caixaria",
  "Marcenaria", "Metais", "Pisos e revestimentos", "Prestadores de serviços",
  "Telhas", "Tijolos e canaletas", "Tintas", "Tubulação PVC", "Outros",
];

// ── Helpers puros sobre a taxonomia — o resto do módulo (cálculo, UI,
// formulário) vai depender destes dois. ──

// contaPorId(id) → objeto da conta em PLANO_CONTAS, ou undefined se não existir.
function contaPorId(id) {
  return PLANO_CONTAS.find(c => c.id === id);
}

// contasDoGrupo(grupoId) → array de contas daquele grupo, na ordem em que
// aparecem em PLANO_CONTAS.
function contasDoGrupo(grupoId) {
  return PLANO_CONTAS.filter(c => c.grupo === grupoId);
}
