// ═══════════════════════════════════════════════════════════════
// CRONOGRAMA-SEED — Rede de etapas, prazo paramétrico e produtividade
// ═══════════════════════════════════════════════════════════════
// Dados de partida do cronograma de obra (docs/SPEC-CRONOGRAMA.md). O motor
// está em cronograma-obra.jsx; aqui só ficam as tabelas que o escritório
// pode editar em Insumos → Composições (abas Cronograma e Produtividade).
// Overrides ficam em data.escritorio.cronograma = { etapas, servicos, prazoTabela }.
//
// Duas formas de dar prazo a cada etapa:
//   • Simplificado — o prazo total sai da tabela por área/tipologia (herdada
//     do modelo antigo, interpolada em vez de arredondada por faixa) e é
//     distribuído pela rede de etapas conforme a duração-base de cada uma.
//   • Produtividade — cada etapa soma as horas-homem dos serviços que a
//     compõem (quantidade da obra × horas por unidade das composições
//     SINAPI) e a duração vem da equipe disponível; ou, dado um prazo,
//     dimensiona a equipe.
// ═══════════════════════════════════════════════════════════════

var CRONOGRAMA_VERSAO = 1;
var DIAS_UTEIS_MES = 21;
var HORAS_DIA = 8;

// Prazo total em meses por área construída (m²) e tipologia — tabela do
// modelo antigo (aba CRONOGRAMA ESTIMADO). Sobrado = térrea + 1,5 mês.
var PRAZO_TABELA_SEED = [
  { area: 60,  terrea: 6.6 },
  { area: 100, terrea: 13.2 },
  { area: 150, terrea: 14.3 },
  { area: 200, terrea: 16.5 },
  { area: 250, terrea: 17.6 },
  { area: 300, terrea: 18.7 },
  { area: 350, terrea: 20.9 },
  { area: 400, terrea: 22.0 },
];
var PRAZO_SOBRADO_EXTRA_MESES = 1.5;

// Ofícios da equipe (chaves de projeto.cronograma.equipe). Os ajudantes de
// todas as composições (servente, auxiliar, ajudante, operador de betoneira)
// caem em "servente" — na obra pequena o servente é compartilhado.
var OFICIOS = [
  { id: "pedreiro",         nome: "Pedreiro",         padrao: 3 },
  { id: "servente",         nome: "Servente / ajudante", padrao: 3 },
  { id: "carpinteiro",      nome: "Carpinteiro",      padrao: 1 },
  { id: "armador",          nome: "Armador",          padrao: 1 },
  { id: "eletricista",      nome: "Eletricista",      padrao: 1 },
  { id: "encanador",        nome: "Encanador",        padrao: 1 },
  { id: "azulejista",       nome: "Azulejista",       padrao: 1 },
  { id: "gesseiro",         nome: "Gesseiro",         padrao: 2 },
  { id: "pintor",           nome: "Pintor",           padrao: 2 },
  { id: "telhadista",       nome: "Telhadista",       padrao: 1 },
  { id: "impermeabilizador", nome: "Impermeabilizador", padrao: 1 },
];

// Serviços com produtividade (horas por unidade, por ofício). Fonte: SINAPI
// composições analíticas, base SP jul/2026 (buscadorsinapi.com.br/sp);
// as paramétricas de instalação (104473/104475/104660/104676) foram somadas
// a partir das sub-composições. A quantidade de cada serviço é medida pelo
// motor (medicoesCronograma) a partir dos mesmos inputs do orçamento.
var PRODUTIVIDADE_SEED = {
  ESCAVACAO:      { nome: "Escavação manual de valas",                 unidade: "m³", fonte: "SINAPI 93358",  horas: { servente: 3.956 } },
  BROCA:          { nome: "Estaca broca Ø20 cm (escavação manual)",     unidade: "m",  fonte: "SINAPI 101173", horas: { pedreiro: 0.486, servente: 0.665 } },
  CONCRETO:       { nome: "Concreto em betoneira, lançamento e adensamento", unidade: "m³", fonte: "SINAPI 94965 + 103670", horas: { pedreiro: 2.459, servente: 11.152, carpinteiro: 2.459 } },
  ARMACAO:        { nome: "Armação CA-50 (corte, dobra e montagem)",     unidade: "kg", fonte: "SINAPI 92761 + 92802", horas: { armador: 0.072, servente: 0.012 } },
  FORMA:          { nome: "Fôrma de madeira (fabricação, montagem, desmontagem)", unidade: "m²", fonte: "SINAPI 92415 + 92263", horas: { carpinteiro: 1.745, servente: 0.337 } },
  ALVENARIA:      { nome: "Alvenaria de vedação em tijolo cerâmico",     unidade: "m²", fonte: "SINAPI 103328", horas: { pedreiro: 1.61, servente: 0.805 } },
  VERGAS:         { nome: "Vergas e contravergas pré-moldadas",          unidade: "m",  fonte: "SINAPI 93184/93194", horas: { pedreiro: 0.054, servente: 0.141, carpinteiro: 0.032 } },
  LAJE:           { nome: "Laje pré-moldada treliçada (montagem, armação da capa, concretagem)", unidade: "m²", fonte: "SINAPI 101951", horas: { carpinteiro: 0.53, servente: 0.418, pedreiro: 0.057, armador: 0.128 } },
  CHAPISCO_INT:   { nome: "Chapisco interno",                            unidade: "m²", fonte: "SINAPI 87879",  horas: { pedreiro: 0.068, servente: 0.026 } },
  CHAPISCO_EXT:   { nome: "Chapisco de fachada",                         unidade: "m²", fonte: "SINAPI 87905",  horas: { pedreiro: 0.172, servente: 0.058 } },
  REBOCO_INT:     { nome: "Reboco / massa única interna",                unidade: "m²", fonte: "SINAPI 87529",  horas: { pedreiro: 0.472, servente: 0.236 } },
  REBOCO_EXT:     { nome: "Reboco / massa única de fachada",             unidade: "m²", fonte: "SINAPI 87775",  horas: { pedreiro: 0.679, servente: 0.679 } },
  CONTRAPISO:     { nome: "Contrapiso em argamassa",                     unidade: "m²", fonte: "SINAPI 87620",  horas: { pedreiro: 0.214, servente: 0.107 } },
  CALCADA:        { nome: "Piso de concreto / calçada externa",          unidade: "m²", fonte: "SINAPI 94992 + 94964", horas: { pedreiro: 0.148, servente: 0.552, carpinteiro: 0.098 } },
  IMPERM_BALDRAME: { nome: "Impermeabilização de baldrame (emulsão asfáltica, 2 demãos)", unidade: "m²", fonte: "SINAPI 98557", horas: { impermeabilizador: 0.43, servente: 0.097 } },
  IMPERM_MANTA:   { nome: "Impermeabilização com manta asfáltica",       unidade: "m²", fonte: "SINAPI 98546",  horas: { impermeabilizador: 0.932, servente: 0.21 } },
  MADEIRAMENTO:   { nome: "Estrutura de madeira do telhado",             unidade: "m²", fonte: "SINAPI 92539",  horas: { carpinteiro: 0.527, servente: 0.546 } },
  TELHA_CERAMICA: { nome: "Telhamento com telha cerâmica ou de concreto", unidade: "m²", fonte: "SINAPI 94201", horas: { telhadista: 0.168, servente: 0.53 } },
  TELHA_FIBRO:    { nome: "Telhamento com telha de fibrocimento",        unidade: "m²", fonte: "SINAPI 94210",  horas: { telhadista: 0.134, servente: 0.163 } },
  TELHA_METALICA: { nome: "Telhamento com telha metálica",               unidade: "m²", fonte: "SINAPI 94213",  horas: { telhadista: 0.09, servente: 0.097 } },
  PONTO_LUZ:      { nome: "Ponto de luz (eletroduto, cabo, rasgo, caixa, interruptor)", unidade: "un", fonte: "SINAPI 104473", horas: { eletricista: 1.934, servente: 1.612, pedreiro: 0.557 } },
  PONTO_TOMADA:   { nome: "Ponto de tomada (eletroduto, cabo, rasgo, caixa, tomada)", unidade: "un", fonte: "SINAPI 104475", horas: { eletricista: 1.563, servente: 1.302, pedreiro: 0.397 } },
  HIDRO_BANHEIRO: { nome: "Conjunto de pontos de água fria — banheiro",  unidade: "un", fonte: "SINAPI 104660", horas: { encanador: 20.232, servente: 11.693 } },
  ESGOTO_BANHEIRO: { nome: "Conjunto de pontos de esgoto — banheiro",    unidade: "un", fonte: "SINAPI 104676", horas: { encanador: 5.457, servente: 3.351 } },
  PISO_CERAMICO:  { nome: "Piso cerâmico / porcelanato",                 unidade: "m²", fonte: "SINAPI 87251",  horas: { azulejista: 0.254, servente: 0.131 } },
  AZULEJO:        { nome: "Revestimento cerâmico de parede",             unidade: "m²", fonte: "SINAPI 87275",  horas: { azulejista: 0.888, servente: 0.367 } },
  FORRO_GESSO:    { nome: "Forro de gesso acartonado",                   unidade: "m²", fonte: "SINAPI 96110",  horas: { gesseiro: 0.546, servente: 0.546 } },
  PINTURA_INT:    { nome: "Pintura interna (selador, massa 2 demãos, tinta 2 demãos)", unidade: "m²", fonte: "SINAPI 88485 + 88497 + 88489", horas: { pintor: 0.591, servente: 0.197 } },
  PINTURA_EXT:    { nome: "Pintura externa (selador, tinta 2 demãos)",   unidade: "m²", fonte: "SINAPI 88485 + 88489", horas: { pintor: 0.23, servente: 0.077 } },
  ESQUADRIA:      { nome: "Instalação de esquadria de alumínio",         unidade: "m²", fonte: "SINAPI 94570",  horas: { pedreiro: 0.313, servente: 0.157 } },
  PORTA:          { nome: "Porta interna completa (batente, folha, fechadura, alizar)", unidade: "un", fonte: "SINAPI 90843", horas: { carpinteiro: 9.015, pedreiro: 1.673, servente: 3.02 } },
};

// Rede de etapas. `duracaoBase` em meses de uma obra-base (pesos relativos
// no modo simplificado; no modo produtividade valem só para etapas sem
// serviço medido). `predecessoras`: FS = começa quando a anterior termina
// (lag em dias úteis, pode ser negativo); SS = começa quando a anterior
// atingiu `avanco` (fração) da sua duração. Etapa cuja `condicao` não vale
// na obra sai da rede e suas predecessoras passam às sucessoras.
// `custoOrdens` / `custoEtapas`: linhas do orçamento cujo custo cai nesta
// etapa (para o físico-financeiro).
var ETAPAS_CRONOGRAMA_SEED = [
  { id: "PRE_OBRA",          nome: "Instalações pré-obra e projetos",         grupo: "Bruto", duracaoBase: 1,   predecessoras: [], custoEtapas: ["Instalações pré obra e projetos"] },
  { id: "TERRAPLANAGEM",     nome: "Terraplanagem e marcação",                grupo: "Bruto", duracaoBase: 0.5, predecessoras: [{ id: "PRE_OBRA", tipo: "SS", avanco: 0.5 }] },
  { id: "ARRIMO",            nome: "Muro de arrimo",                          grupo: "Bruto", duracaoBase: 2,   condicao: "arrimo", predecessoras: [{ id: "TERRAPLANAGEM", tipo: "FS" }], custoOrdens: [15] },
  { id: "FUNDACAO",          nome: "Fundação (brocas, sapatas, baldrames)",   grupo: "Bruto", duracaoBase: 2,   predecessoras: [{ id: "ARRIMO", tipo: "FS" }, { id: "TERRAPLANAGEM", tipo: "FS" }], custoOrdens: [2], custoEtapas: ["Fundação"] },
  { id: "IMPERM_BALDRAME",   nome: "Impermeabilização de baldrames",          grupo: "Bruto", duracaoBase: 0.5, predecessoras: [{ id: "FUNDACAO", tipo: "FS" }] },
  { id: "CONTRAPISO_TERREO", nome: "Contrapiso interno — térreo",             grupo: "Bruto", duracaoBase: 1,   predecessoras: [{ id: "IMPERM_BALDRAME", tipo: "FS" }], custoOrdens: [4], custoEtapas: ["Contrapiso Interno"] },
  { id: "PAREDES_TERREO",    nome: "Alvenaria e pilares — térreo",            grupo: "Bruto", duracaoBase: 2,   predecessoras: [{ id: "CONTRAPISO_TERREO", tipo: "SS", avanco: 0.5 }], custoOrdens: [5] },
  { id: "LAJE_TERREO",       nome: "Vigas de respaldo e laje — térreo",       grupo: "Bruto", duracaoBase: 1,   predecessoras: [{ id: "PAREDES_TERREO", tipo: "FS" }], custoOrdens: [6] },
  { id: "PAREDES_PAV1",      nome: "Alvenaria e pilares — pav. 1",            grupo: "Bruto", duracaoBase: 2,   condicao: "sobrado", predecessoras: [{ id: "LAJE_TERREO", tipo: "FS" }], custoOrdens: [7] },
  { id: "LAJE_PAV1",         nome: "Vigas de respaldo e laje — pav. 1",       grupo: "Bruto", duracaoBase: 1,   condicao: "sobrado", predecessoras: [{ id: "PAREDES_PAV1", tipo: "FS" }], custoOrdens: [8] },
  { id: "COBERTURA",         nome: "Estrutura de cobertura e telhado",        grupo: "Bruto", duracaoBase: 2,   predecessoras: [{ id: "LAJE_PAV1", tipo: "FS" }, { id: "LAJE_TERREO", tipo: "FS" }], custoOrdens: [9, 10] },
  { id: "INSTALACOES",       nome: "Instalações embutidas (elétrica, hidráulica, esgoto)", grupo: "Bruto", duracaoBase: 2, predecessoras: [{ id: "PAREDES_TERREO", tipo: "SS", avanco: 0.5 }, { id: "LAJE_PAV1", tipo: "FS", lag: -10 }, { id: "LAJE_TERREO", tipo: "FS", lag: -10 }], custoOrdens: [18, 19, 20] },
  { id: "REBOCO",            nome: "Chapisco e reboco",                       grupo: "Bruto", duracaoBase: 3,   predecessoras: [{ id: "COBERTURA", tipo: "SS", avanco: 0.5 }, { id: "INSTALACOES", tipo: "SS", avanco: 0.5 }], custoOrdens: [11] },
  { id: "IMPERM_MOLHADAS",   nome: "Impermeabilização de áreas molhadas",     grupo: "Bruto", duracaoBase: 0.5, predecessoras: [{ id: "REBOCO", tipo: "FS" }] },
  { id: "CONTRAPISO_PAV1",   nome: "Contrapiso interno — pav. 1",             grupo: "Bruto", duracaoBase: 1,   condicao: "sobrado", predecessoras: [{ id: "REBOCO", tipo: "SS", avanco: 0.6 }], custoEtapas: ["Contrapiso Interno Pav 1"] },
  { id: "CONTRAPISO_EXTERNO", nome: "Contrapisos externos e calçadas",        grupo: "Externa", duracaoBase: 2, condicao: "pavimentacao", predecessoras: [{ id: "REBOCO", tipo: "FS" }], custoOrdens: [13] },
  { id: "MURO_DIVISA",       nome: "Muro de divisa",                          grupo: "Externa", duracaoBase: 2, condicao: "muro", predecessoras: [{ id: "FUNDACAO", tipo: "FS" }], custoOrdens: [14] },
  { id: "PISCINA",           nome: "Piscina",                                 grupo: "Externa", duracaoBase: 3, condicao: "piscina", predecessoras: [{ id: "TERRAPLANAGEM", tipo: "FS" }], custoOrdens: [16] },
  { id: "REVESTIMENTOS",     nome: "Revestimentos cerâmicos (azulejos e pisos)", grupo: "Acabamento", duracaoBase: 2, predecessoras: [{ id: "IMPERM_MOLHADAS", tipo: "FS" }, { id: "CONTRAPISO_PAV1", tipo: "FS" }] },
  { id: "FORROS",            nome: "Forros",                                  grupo: "Acabamento", duracaoBase: 1, predecessoras: [{ id: "REVESTIMENTOS", tipo: "SS", avanco: 0.5 }] },
  { id: "ESQUADRIAS",        nome: "Esquadrias, vidros, soleiras e peitoris", grupo: "Acabamento", duracaoBase: 1.5, predecessoras: [{ id: "REBOCO", tipo: "FS" }], custoOrdens: [17] },
  { id: "PINTURA",           nome: "Pintura",                                 grupo: "Acabamento", duracaoBase: 3, predecessoras: [{ id: "FORROS", tipo: "FS" }, { id: "ESQUADRIAS", tipo: "SS", avanco: 0.5 }], custoOrdens: [12] },
  { id: "PORTAS",            nome: "Portas internas e marcenaria",            grupo: "Acabamento", duracaoBase: 1, predecessoras: [{ id: "PINTURA", tipo: "SS", avanco: 0.6 }], custoOrdens: [24] },
  { id: "ACABAMENTO_INST",   nome: "Acabamentos elétricos, louças, metais e equipamentos", grupo: "Acabamento", duracaoBase: 1, predecessoras: [{ id: "PINTURA", tipo: "SS", avanco: 0.7 }], custoOrdens: [21, 22, 23] },
  { id: "LIMPEZA",           nome: "Limpeza final e entrega",                 grupo: "Acabamento", duracaoBase: 0.5, predecessoras: [
      { id: "PINTURA", tipo: "FS" }, { id: "PORTAS", tipo: "FS" }, { id: "ACABAMENTO_INST", tipo: "FS" },
      { id: "CONTRAPISO_EXTERNO", tipo: "FS" }, { id: "MURO_DIVISA", tipo: "FS" }, { id: "PISCINA", tipo: "FS" }] },
];

// Preço da hora por ofício — composições SINAPI "<OFÍCIO> COM ENCARGOS
// COMPLEMENTARES" (salário + encargos sociais + EPI, ferramentas,
// alimentação, transporte, exames, seguro), base SP jul/2026, R$/h.
// Desonerado = folha com CPRB; onerado = folha com INSS patronal. Serve como
// referência para o custo de mão de obra de cada prestador do orçamento:
// HH medidas × R$/h. Gesseiro usa o montador de forro (88278), que é o
// ofício da composição de forro de gesso acartonado.
var PRECO_HORA_REFERENCIA = "SINAPI SP jul/2026";
var PRECO_HORA_SEED = {
  pedreiro:          { codigo: "88309", desonerado: 35.18, onerado: 37.26 },
  servente:          { codigo: "88316", desonerado: 30.48, onerado: 32.18 },
  carpinteiro:       { codigo: "88262", desonerado: 34.48, onerado: 36.53 },
  armador:           { codigo: "88245", desonerado: 34.94, onerado: 36.99 },
  eletricista:       { codigo: "88264", desonerado: 42.52, onerado: 45.18 },
  encanador:         { codigo: "88267", desonerado: 38.54, onerado: 40.92 },
  azulejista:        { codigo: "88256", desonerado: 35.02, onerado: 37.08 },
  gesseiro:          { codigo: "88278", desonerado: 33.58, onerado: 35.62 },
  pintor:            { codigo: "88310", desonerado: 36.77, onerado: 38.83 },
  telhadista:        { codigo: "88323", desonerado: 34.48, onerado: 36.53 },
  impermeabilizador: { codigo: "88270", desonerado: 35.18, onerado: 37.26 },
};

// Qual prestador do orçamento (chave de TAXAS_PRESTADORES / INSUMO_PRESTADOR)
// cada serviço medido representa — para comparar o custo SINAPI da mão de
// obra com o valor contratado. A etapa vence o serviço (o muro tem seu
// próprio pedreiro); "gesseiro" não tem prestador no orçamento.
var PRESTADOR_POR_ETAPA = { MURO_DIVISA: "muroDivisa", ARRIMO: "muroArrimo", PISCINA: "pedreirosPiscina", CONTRAPISO_EXTERNO: "pavimentacaoExterna" };
var PRESTADOR_POR_SERVICO = {
  ESCAVACAO: "equipePedreiros", BROCA: "equipePedreiros", CONCRETO: "equipePedreiros", ARMACAO: "equipePedreiros", FORMA: "equipePedreiros",
  ALVENARIA: "equipePedreiros", VERGAS: "equipePedreiros", LAJE: "equipePedreiros", CHAPISCO_INT: "equipePedreiros", CHAPISCO_EXT: "equipePedreiros",
  REBOCO_INT: "equipePedreiros", REBOCO_EXT: "equipePedreiros", CONTRAPISO: "equipePedreiros", CALCADA: "equipePedreiros",
  PISO_CERAMICO: "equipePedreiros", AZULEJO: "equipePedreiros", ESQUADRIA: "equipePedreiros",
  MADEIRAMENTO: "carpinteiro", TELHA_CERAMICA: "carpinteiro", TELHA_FIBRO: "carpinteiro", TELHA_METALICA: "carpinteiro",
  PONTO_LUZ: "eletricista", PONTO_TOMADA: "eletricista", HIDRO_BANHEIRO: "encanador", ESGOTO_BANHEIRO: "encanador",
  IMPERM_BALDRAME: "impermeabilizador", IMPERM_MANTA: "impermeabilizador",
  PINTURA_INT: "pintor", PINTURA_EXT: "pintor", FORRO_GESSO: "gesseiro", PORTA: "marceneiroPortas",
};
var PRESTADORES_ROTULO = {
  equipePedreiros: "Pedreiros Casa", pintor: "Pintor", eletricista: "Eletricista", encanador: "Encanador", carpinteiro: "Carpinteiro (telhado)",
  muroDivisa: "Pedreiros Muro Divisa", muroArrimo: "Pedreiros Muro Arrimo", pedreirosPiscina: "Pedreiros Piscina", pavimentacaoExterna: "Pedreiros Pavim. Externa",
  impermeabilizador: "Impermeabilizador", marceneiroPortas: "Marceneiro Portas Internas", gesseiro: "Gesseiro (forro) — sem prestador no orçamento",
};
