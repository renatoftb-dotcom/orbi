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
  // O terreno tem grupo próprio porque não é material nem serviço: é o bem
  // que se compra para construir em cima. Separado, a venda menos o terreno
  // dá o lucro bruto do empreendimento — que é como o escritório lê o
  // negócio de construir para vender. Em obra de cliente fica zerado.
  { id: "terreno",   titulo: "TERRENO",                   sinal: -1, entra_no_resultado: true  },
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
  // Venda da unidade pronta — receita de empreendimento do escritório.
  { id: "venda_imovel",       nome: "Venda de imóvel",            grupo: "receitas" },

  // ── terreno ───────────────────────────────────────────────
  { id: "terreno_aquisicao",  nome: "Aquisição de terreno",       grupo: "terreno" },

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
  // Fecho do grupo: o que não tem conta própria e o arredondamento da
  // estimativa. Na planilha do escritório chama só "Adicionais"; aqui leva
  // o sufixo porque mão de obra tem um homônimo e os dois aparecem juntos
  // em lista plana (extrato, contas a pagar).
  { id: "adicionais_material", nome: "Adicionais de material",            grupo: "materiais" },

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
  { id: "lixador_concreto",   nome: "Lixador de concreto",      grupo: "maoDeObra" },
  { id: "adicionais_mo",      nome: "Adicionais de mão de obra", grupo: "maoDeObra" },

  // ── serviços & taxas ──────────────────────────────────────
  { id: "impostos",           nome: "Impostos",                          grupo: "servicos" },
  { id: "impressao_plantas",  nome: "Impressão de plantas",              grupo: "servicos" },
  { id: "outras_taxas",       nome: "Outras taxas e serviços",           grupo: "servicos" },
  { id: "tarifas_bancarias",  nome: "Tarifas bancárias",                 grupo: "servicos" },
  { id: "projetos_docs",      nome: "Projetos e documentação",           grupo: "servicos" },
  // rótulo trocado de "Taxa de administração da obra" para "Gerenciamento de
  // obra"; o id continua o mesmo, porque é chave gravada nos lançamentos
  { id: "taxa_admin_obra",    nome: "Gerenciamento de obra",             grupo: "servicos" },
  { id: "contabilidade",      nome: "Escritório de contabilidade",       grupo: "servicos" },
  // Tributos do empreendimento. O IR incide sobre a receita da venda, não
  // sobre o custo; INSS e ISS seguem a mão de obra e os serviços.
  { id: "ir_receita",         nome: "IR sobre a receita",                grupo: "servicos" },
  { id: "inss",               nome: "INSS",                              grupo: "servicos" },
  { id: "iss",                nome: "ISS",                               grupo: "servicos" },

  // ── excluídas (fora do resultado) ─────────────────────────
  { id: "reembolsos",         nome: "Reembolsos",               grupo: "excluidas" },
];

// ── Carga única da estimativa da Reforma Loja Cobop ─────────────
// TEMPORÁRIO, e de propósito. Os números vieram da planilha ESTIMATIVA PL
// OBRA e entram UMA VEZ nesta obra, para o escritório não redigitar onze
// contas à mão. Não é semente de obra nova nem botão: é um empurrão de
// partida enquanto o fluxo de dados que monta a estimativa dentro da obra
// (quantitativo, contratos, cotações) não existe.
//
// Quando esse fluxo chegar, este bloco inteiro sai — junto com
// `estimativaCargaUnica` em contas-pagar.jsx e a chamada em clientes.jsx.
//
// Sobre "Adicionais": é o fecho de cada grupo, não um serviço. O de mão de
// obra é exatamente 15% dos ofícios nomeados; o de material fecha o total
// em R$ 1.030.000,00 redondos. A planilha traz 4 casas e o quadro guarda 2 —
// o centavo do arredondamento saiu do adicional de material, que é
// justamente a linha de fechamento.
const CARGA_ESTIMATIVA_UNICA = {
  obra: "Reforma Loja Cobop",
  fonte: "planilha ESTIMATIVA PL OBRA",
  total: 1030000,
  valores: {
    // material & insumos — R$ 367.529,57
    material:            310539.19,
    aluguel_equip:        12000.00,
    adicionais_material:  44990.38,
    // mão de obra & prestadores — R$ 528.470,43
    empreiteiro:         174800.00,
    eletricista:          34960.00,
    pintor:               43700.00,
    gesseiro:             85440.00,
    serralheiro:         117362.00,
    lixador_concreto:      3277.50,
    adicionais_mo:        68930.93,
    // serviços & taxas — R$ 134.000,00
    taxa_admin_obra:     134000.00,
  },
};

// ── Etapas de execução da obra — ordem construtiva, preservar. Cada etapa
// pertence a uma macroetapa usada nos agrupamentos/rankings. ──
const ETAPAS_OBRA = [
  { id:"pre_obra",            nome:"Instalações pré-obra e projetos",  macro:"Pré-obra" },
  { id:"poste_padrao",        nome:"Poste padrão",                     macro:"Pré-obra" },
  { id:"terraplanagem",       nome:"Terraplanagem",                    macro:"Terraplanagem e demolições" },
  { id:"demolicoes",          nome:"Demolições e entulhos",            macro:"Terraplanagem e demolições" },
  { id:"arrimos",             nome:"Arrimos",                          macro:"Arrimos" },
  { id:"imp_arrimo",          nome:"Impermeabilização de arrimo",      macro:"Impermeabilizações" },
  // O gabarito — o cavalete de tábuas que guarda os eixos das paredes até a
  // fundação sair do chão. É madeira e prego, e acontece antes de concretar.
  { id:"marcacao_obra",       nome:"Marcação obra",                     macro:"Fundação" },
  { id:"fundacao",            nome:"Fundação",                         macro:"Fundação" },
  { id:"imp_baldrame",        nome:"Impermeabilização de baldrame",    macro:"Impermeabilizações" },
  // Impermeabilização sem destino declarado — a planilha da obra tem essa
  // linha genérica, e sem ela o gasto caía em "Outros".
  { id:"impermeabilizacao",   nome:"Impermeabilização",                macro:"Impermeabilizações" },
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
  { id:"massa_contrapiso_int",nome:"Massiamento de contrapisos internos",    macro:"Contrapisos" },
  { id:"massa_contrapiso_ext",nome:"Massiamento de contrapisos externos",    macro:"Contrapisos" },
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
  // Ferramenta comprada para a obra tem etapa própria na planilha do
  // escritório; sem ela o gasto caía em "Outros".
  { id:"ferramentas",         nome:"Ferramentas",                      macro:"Locação de equipamentos" },
  { id:"prestadores",         nome:"Prestadores de serviços",          macro:"Prestadores de serviços" },
  { id:"outros",              nome:"Outros",                           macro:"Outros" },
];

// ══════════════════════════════════════════════════════════════
// GRUPO DE MATERIAL — UM VOCABULÁRIO SÓ
// ══════════════════════════════════════════════════════════════
// O grupo não é digitado: ele vem do INSUMO. Quem manda é o catálogo, e é
// por isso que a lista canônica abaixo é a do catálogo — assim o grupo da
// linha do orçamento, o da cotação, o do item do pedido e o da conta a
// pagar são sempre a mesma palavra, porque todos saem do mesmo lugar.
//
// O que sobra são os nomes que ficaram gravados antes disso, ou digitados
// à mão. "Louças" e "Metais" viravam duas linhas no quadro onde o catálogo
// diz "Louças e metais"; "Tubulação PVC" era uma terceira "Hidráulica".
// `grupoCanonico` traduz na leitura — nada é reescrito no banco.
const GRUPOS_MATERIAL = [
  "Aço", "Areia e pedra", "Argamassas", "Calhas e rufos", "Cimento", "Concreto",
  "Elétrica e iluminação", "Entulhos", "Equipamentos e sistemas", "Esquadrias",
  "Ferramentas", "Fixação", "Forros e gesso", "Hidráulica", "Impermeabilizantes",
  "Lajes", "Locação de equipamentos", "Louças e metais", "Madeira de caixaria",
  "Madeira de estrutura", "Marcenaria", "Pisos e revestimentos",
  "Portas e fechaduras", "Prestadores de serviços", "Telhas",
  "Tijolos e canaletas", "Tintas", "Outros",
];

// nome antigo (normalizado) → nome do catálogo
const GRUPO_APELIDOS = {
  "equipamentos": "Equipamentos e sistemas",
  "forros": "Forros e gesso",
  "locacao de ferramentas": "Locação de equipamentos",
  "loucas": "Louças e metais",
  "metais": "Louças e metais",
  "tubulacao pvc": "Hidráulica",
  "granito": "Pisos e revestimentos",
  "entulho": "Entulhos",
};

function grupoCanonico(nome) {
  const n = normalizarNomeEtapa(nome);   // mesma normalização: sem acento, sem caixa
  if (!n) return "";
  const apelido = GRUPO_APELIDOS[n];
  if (apelido) return apelido;
  const certo = GRUPOS_MATERIAL.find((g) => normalizarNomeEtapa(g) === n);
  return certo || String(nome).trim();   // nome novo passa; não se joga fora informação
}

// O grupo de um item, na ordem em que a informação é confiável: o catálogo
// manda, porque é ele que define o vocabulário; o que está gravado na linha
// serve de reserva para o item que não casou com o catálogo.
function grupoDoItem(insumo, grupoGravado) {
  return grupoCanonico((insumo && insumo.grupo) || grupoGravado || "");
}



// ══════════════════════════════════════════════════════════════
// DE QUE ETAPA É ESTA LINHA DO ORÇAMENTO
// ══════════════════════════════════════════════════════════════
// O motor de orçamento nasceu antes de ETAPAS_OBRA e nomeia etapa por
// extenso, com a grafia da planilha: "Supra estrutura e paredes", "Muro
// Arrimo", "Instalações pré obra e projetos". A obra, do outro lado,
// trabalha com ids. Enquanto os dois não se encontram, o estimado e o
// realizado nunca somam na mesma linha — é o mesmo gasto contado em dois
// idiomas.
//
// A tradução tem três passos, nesta ordem:
//   1. o nome, normalizado (sem acento, sem hífen, sem caixa) — pega
//      "Chapisco e Reboco" → chapisco_reboco sem precisar de apelido;
//   2. a tabela de apelidos, para o que a planilha escreve diferente;
//   3. a subetapa, quando o nome sozinho não decide — "Piscina" é sete
//      etapas na obra, e quem diz qual é a subetapa.
//
// O que não traduzir volta "", e `etapasDoOrcamentoSemMapa` lista o que
// ficou de fora: um gasto sem etapa tem que aparecer como sem etapa, não
// ser enfiado em "Outros" para a tela ficar bonita.
function normalizarNomeEtapa(s) {
  return String(s == null ? "" : s)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// CONVENÇÃO DE PAVIMENTO — a planilha chama o térreo de "Térreo" e o
// primeiro andar de "Pav 1"; ETAPAS_OBRA chama o térreo de "pav. 1" e o
// andar de cima de "pav. 2". Os dois aparecem lado a lado nas subetapas
// ("Laje Térreo" e "Laje Pav 1"), e é isso que fixa a leitura.
function pavimentoDaSubEtapa(subEtapa) {
  const s = normalizarNomeEtapa(subEtapa);
  if (/\bterreo\b/.test(s)) return 1;
  if (/\bpav\s*2\b/.test(s)) return 3;      // não existe hoje, mas não se inventa
  if (/\bpav\s*1\b/.test(s)) return 2;
  return 1;                                  // sem dizer, é o térreo
}

// nome do orçamento (normalizado) → id de ETAPAS_OBRA
const ETAPA_APELIDOS_ORCAMENTO = {
  "cobertura": "coberturas",
  "demolicoes e remocoes": "demolicoes",
  "entulho": "demolicoes",
  "locacao equipamentos": "locacao_equip",
  "muro arrimo": "arrimos",
  "muro divisa": "muros",
  "contrapiso interno": "contrapiso_int_1",
  "contrapiso interno pav 1": "contrapiso_int_1",
  "massiamento contrapisos internos": "massa_contrapiso_int",
  "contrapisos externos massiamento": "massa_contrapiso_ext",
};

// etapa "Piscina": quem decide é a subetapa
const ETAPA_PISCINA_POR_SUB = {
  "brocas": "piscina_fundacao",
  "supra estrutura": "piscina_supra",
  "paredes": "piscina_supra",
  "impermeabilizacao": "piscina_imp",
  "chapisco e reboco": "piscina_chapisco",
  "revestimento": "piscina_revest",
  "hidraulica": "piscina_hidraulica",
  "contrapiso": "piscina_deck",
  "deck": "piscina_deck",
  "diversas": "piscina_equip",
};

function etapaDoOrcamento(etapa, subEtapa) {
  const n = normalizarNomeEtapa(etapa);
  if (!n) return "";

  // Piscina e as etapas por pavimento não se resolvem pelo nome
  if (n === "piscina") return ETAPA_PISCINA_POR_SUB[normalizarNomeEtapa(subEtapa)] || "";
  if (n === "supra estrutura e paredes") {
    return pavimentoDaSubEtapa(subEtapa) >= 2 ? "supra_paredes_2" : "supra_paredes_1";
  }
  if (n === "viga respaldo e laje") {
    return pavimentoDaSubEtapa(subEtapa) >= 2 ? "laje_2" : "laje_1";
  }

  const apelido = ETAPA_APELIDOS_ORCAMENTO[n];
  if (apelido) return apelido;

  const porNome = (typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : [])
    .find((e) => e && normalizarNomeEtapa(e.nome) === n);
  if (porNome) return porNome.id;

  // o id cru também serve, caso a linha já venha traduzida
  const porId = (typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : [])
    .find((e) => e && e.id === String(etapa || "").trim());
  return porId ? porId.id : "";
}

// O que o motor emite e a obra não sabe receber. Serve para a tela dizer o
// que está caindo em "Sem etapa" em vez de deixar a pessoa descobrir pela
// soma que não fecha.
function etapasDoOrcamentoSemMapa(linhas) {
  const fora = [], vistos = {};
  for (const l of linhas || []) {
    if (!l || !l.etapa) continue;
    if (etapaDoOrcamento(l.etapa, l.subEtapa)) continue;
    const k = String(l.etapa) + "|" + String(l.subEtapa || "");
    if (vistos[k]) { vistos[k].linhas++; continue; }
    vistos[k] = { etapa: l.etapa, subEtapa: l.subEtapa || "", linhas: 1 };
    fora.push(vistos[k]);
  }
  return fora;
}

// ══════════════════════════════════════════════════════════════
// A REGRA DA TRANSAÇÃO — o que todo lançamento precisa carregar
// ══════════════════════════════════════════════════════════════
// Cada porta de entrada nasceu numa época e pedia uma coisa: o pedido da
// loja exigia item e etapa; a despesa da Entrada não pedia nada além do
// valor. O resultado era a corrente arrebentada em silêncio — o gasto
// somava no total e sumia do custo por etapa, do orçado × consumido e da
// prestação de contas.
//
// Esta é a regra única. Toda porta pergunta a ela o que falta antes de
// gravar, e a conferência da obra usa a mesma régua para apontar o que já
// entrou torto. As exceções estão escritas aqui, com o motivo, e não
// espalhadas pelas telas.
//
//   SEMPRE: obra, conta contábil, valor, data.
//   CUSTO DA OBRA: fornecedor ("Outros" vale) e etapa.
//   MATERIAL: item do catálogo e quantidade — é o que confronta com o
//     orçado. Frete, água, aluguel de equipamento e afins são custo de
//     material sem item: não há o que contar em m³.
//   PAGO: forma de pagamento — à vista ou cartão, porque é ela que diz se
//     o dinheiro atravessa para o escritório agora ou na fatura.
//
// Não pedem etapa: receita (dinheiro que entra), terreno (é anterior à
// obra), tributo sobre a receita (não é de etapa nenhuma) e parcela de
// contrato que não diz a etapa (o contrato de obra civil atravessa a obra
// inteira — inventar uma etapa seria pior que deixar em branco).
//
// Não pede item nem quantidade a PARCELA de uma compra parcelada no boleto:
// o consumo aconteceu uma vez, e dividi-lo pelas parcelas inventaria 11 m³
// de concreto em cada mês. O item mora na compra; a parcela é só dinheiro.
const TRANSACAO_CONTAS_COM_ITEM = ["material", "adicionais_material"];
const TRANSACAO_CONTAS_SEM_ETAPA = ["impostos", "ir_receita", "inss", "iss",
  "tarifas_bancarias", "contabilidade", "taxa_admin_obra"];

function exigenciasDaTransacao(t) {
  const c = t || {};
  const conta = (typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : []).find((x) => x && x.id === c.contaId) || null;
  const grupo = conta ? conta.grupo : "";
  const receita = grupo === "receitas";
  const terreno = grupo === "terreno";
  const excluida = grupo === "excluidas";
  const custo = !!conta && !receita && !terreno && !excluida;
  const contratoSemEtapa = c.origem === "contrato" && !c.etapa;
  const parcelaDeCompra = Number(c.parcelasTotal) > 1;
  return {
    obra: true,
    conta: true,
    valor: true,
    data: true,
    fornecedor: custo || terreno,
    etapa: custo && TRANSACAO_CONTAS_SEM_ETAPA.indexOf(c.contaId) < 0 && !contratoSemEtapa,
    item: TRANSACAO_CONTAS_COM_ITEM.indexOf(c.contaId) >= 0 && !parcelaDeCompra,
    quantidade: TRANSACAO_CONTAS_COM_ITEM.indexOf(c.contaId) >= 0 && !parcelaDeCompra,
    formaPagamento: !!c.pago && !receita,
  };
}

// O que falta, em português, na ordem em que a pessoa preenche. Lista
// vazia = transação fechada.
function faltasDaTransacao(t) {
  const c = t || {};
  const e = exigenciasDaTransacao(c);
  const n = (v) => (typeof numeroDeCampo === "function" ? numeroDeCampo(v) : Number(v) || 0);
  const tem = (v) => String(v == null ? "" : v).trim() !== "";
  const faltas = [];
  if (e.obra && !tem(c.obraId)) faltas.push("a obra");
  if (e.conta && !tem(c.contaId)) faltas.push("a conta contábil");
  if (e.valor && !(n(c.valorPago || c.valor) > 0)) faltas.push("o valor");
  if (e.data && !tem(c.pagoEm || c.vencimento)) faltas.push("a data");
  if (e.fornecedor && !tem(c.prestadorId) && !tem(c.favorecido)) faltas.push("o fornecedor");
  if (e.item && !tem(c.insumoCodigo)) faltas.push("o item do catálogo");
  if (e.quantidade && !(n(c.quantidade) > 0)) faltas.push("a quantidade");
  if (e.etapa && !tem(c.etapa || c.etapaId)) faltas.push("a etapa");
  if (e.formaPagamento && !tem(c.formaPagamento)) faltas.push("a forma de pagamento");
  return faltas;
}

// "Falta a etapa e o item do catálogo." — a frase que a tela mostra.
function frasesDasFaltas(faltas) {
  const f = faltas || [];
  if (!f.length) return "";
  if (f.length === 1) return "Falta " + f[0] + ".";
  return "Falta " + f.slice(0, -1).join(", ") + " e " + f[f.length - 1] + ".";
}

// ── Conta → etapa/grupo padrão. Mão de obra (empreiteiro, pedreiro,
// eletricista...) entra sempre na etapa "Prestadores de serviços" e no
// grupo "Prestadores de serviços". Vale para TODA porta de entrada da
// contabilidade (contrato, pedido, conta avulsa, entrada, extrato do
// escritório): a conta escolhida já traz a etapa e o grupo, e a pessoa
// só mexe se quiser outra coisa. ──
const PADRAO_MAO_DE_OBRA = { etapa: "prestadores", grupoMaterial: "Prestadores de serviços" };

function padraoDaContaObra(contaId) {
  const c = (typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : []).find((x) => x && x.id === contaId);
  return c && c.grupo === "maoDeObra" ? { ...PADRAO_MAO_DE_OBRA } : { etapa: "", grupoMaterial: "" };
}

// Preenche o que está em branco. Nunca troca o que a pessoa escolheu.
// O grupo só entra quando a etapa é a do padrão (etapa "Fundação" com
// grupo "Prestadores" não faz sentido sozinho).
function comPadraoDaConta(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const p = padraoDaContaObra(obj.contaId);
  if (!p.etapa) return obj;
  const vazio = (v) => String(v == null ? "" : v).trim() === "";
  const etapaVazia = vazio(obj.etapa) && vazio(obj.etapaId);
  const etapa = etapaVazia ? p.etapa : obj.etapa;
  const pedeGrupo = vazio(obj.grupoMaterial) && etapa === p.etapa;
  if (!etapaVazia && !pedeGrupo) return obj;
  const r = { ...obj };
  if (etapaVazia) r.etapa = p.etapa;
  if (pedeGrupo) r.grupoMaterial = p.grupoMaterial;
  return r;
}

// Troca de conta numa tela: o que era o padrão da conta antiga (ou estava
// vazio) passa a ser o padrão da nova; o que a pessoa escolheu à mão fica.
function trocarContaComPadrao(obj, novaConta) {
  const o = obj || {};
  const antes = padraoDaContaObra(o.contaId);
  const r = { ...o, contaId: novaConta };
  if (antes.etapa && r.etapa === antes.etapa) r.etapa = "";
  if (antes.grupoMaterial && r.grupoMaterial === antes.grupoMaterial) r.grupoMaterial = "";
  return comPadraoDaConta(r);
}

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
