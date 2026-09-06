// ═══════════════════════════════════════════════════════════════
// COMPOSIÇÕES — KITS POR AMBIENTE (estimativa preliminar de instalações)
// ═══════════════════════════════════════════════════════════════
// Estimativa por "conjuntos de pontos por ambiente", a prática do SINAPI
// (composições paramétricas AF_05/2023 e AF_11/2022) traduzida para os nomes
// do cadastro de materiais do escritório. Cada kit é uma lista de insumos ×
// quantidade por ambiente (ou por ponto elétrico, ou por obra).
//
// Origem das quantidades:
//   água fria    SINAPI 104660 (banheiro), 104661 (cozinha), 104662 (área de
//                serviço) — o ramal de distribuição de 40 mm do prédio foi
//                trocado por 25/32 mm de residência
//   água quente  SINAPI 104673 (banheiro, CPVC 15/22 → 22/28 do cadastro)
//   esgoto       SINAPI 104676 (banheiro), 104678 (cozinha), 104679 (área de
//                serviço) + ramal até a caixa de inspeção
//   elétrica     SINAPI 104475 (tomada geral), 104476 (tomada específica),
//                104481 (chuveiro), 104473 (iluminação simples), 104478
//                (iluminação paralela); pontos por cômodo pela NBR 5410 e
//                prática de residência de padrão médio/alto
//   louças/metais matriz ambiente × item do modelo antigo do escritório
//                (padrão Médio/Alto)
//   portas       1 por cômodo fechado; folha + 3 dobradiças + fechadura
//
// As quantidades do SINAPI já incluem perdas. Não aplicar PERDA em cima.
// O escritório edita tudo isso na tela Composições (Insumos); o que for
// editado fica em data.escritorio.composicoes e vence esta semente.
// ═══════════════════════════════════════════════════════════════

var COMPOSICOES_VERSAO = 1;

// Disciplinas (mesmos ids das etapas de projeto em orcamento-obra.jsx)
var COMPOSICOES_DISCIPLINAS = [
  { id: "HIDRAULICA",  nome: "Hidráulica (água fria e quente)" },
  { id: "ESGOTO",      nome: "Esgoto e pluvial" },
  { id: "ELETRICA",    nome: "Elétrica e iluminação" },
  { id: "LOUCAS",      nome: "Louças e metais" },
  { id: "AQUECIMENTO", nome: "Aquecimento e pressurização" },
  { id: "PORTAS",      nome: "Portas internas" },
];

// Tipos de ambiente que a obra conta. `kits` por disciplina (o sufixo
// _ALTO é escolhido automaticamente quando o padrão é Alto e o kit existe);
// `pontos` elétricos por unidade; `portas` por unidade.
// Mesmos cômodos (e nomes) do orçamento de projetos (COMODOS em shared.jsx),
// agrupados como lá; `grupo` ordena a lista. WC = banheiro (conte aqui os
// banheiros das suítes também); Suíte e Suíte Master são o quarto. Jardim
// não tem medidas no projeto — só puxa a torneira externa. Piscina fica no
// bloco próprio do orçamento.
var AMBIENTES_TIPOS = [
  { id: "garagem", nome: "Garagem", grupo: "Áreas Sociais", molhado: false,
    kits: {},
    pontos: { tomadaGeral: 2, tomadaEspecifica: 0, chuveiro: 0, iluminacao: 2, iluminacaoParalela: 0 } },
  { id: "hallEntrada", nome: "Hall de entrada", grupo: "Áreas Sociais", molhado: false,
    kits: {},
    pontos: { tomadaGeral: 1, tomadaEspecifica: 0, chuveiro: 0, iluminacao: 1, iluminacaoParalela: 1 } },
  { id: "salaTV", nome: "Sala TV", grupo: "Áreas Sociais", molhado: false,
    kits: {},
    pontos: { tomadaGeral: 4, tomadaEspecifica: 1, chuveiro: 0, iluminacao: 2, iluminacaoParalela: 1 } },
  { id: "living", nome: "Living", grupo: "Áreas Sociais", molhado: false,
    kits: {},
    pontos: { tomadaGeral: 5, tomadaEspecifica: 1, chuveiro: 0, iluminacao: 3, iluminacaoParalela: 1 } },
  { id: "salaJantar", nome: "Sala de jantar", grupo: "Áreas Sociais", molhado: false,
    kits: {},
    pontos: { tomadaGeral: 3, tomadaEspecifica: 0, chuveiro: 0, iluminacao: 1, iluminacaoParalela: 0 } },
  { id: "escritorio", nome: "Escritório", grupo: "Áreas Sociais", molhado: false,
    kits: { PORTAS: ["PORTA_INTERNA"] },
    pontos: { tomadaGeral: 4, tomadaEspecifica: 1, chuveiro: 0, iluminacao: 1, iluminacaoParalela: 0 } },
  { id: "lavabo", nome: "Lavabo", grupo: "Áreas Sociais", molhado: true,
    kits: { HIDRAULICA: ["AGUA_FRIA_LAVABO"], ESGOTO: ["ESGOTO_LAVABO"], LOUCAS: ["LOUCAS_LAVABO"], PORTAS: ["PORTA_BANHEIRO"] },
    pontos: { tomadaGeral: 1, tomadaEspecifica: 0, chuveiro: 0, iluminacao: 1, iluminacaoParalela: 0 } },
  { id: "cozinha", nome: "Cozinha", grupo: "Serviço", molhado: true,
    kits: { HIDRAULICA: ["AGUA_FRIA_COZINHA", "AGUA_QUENTE_COZINHA"], ESGOTO: ["ESGOTO_COZINHA"], LOUCAS: ["LOUCAS_COZINHA"], PORTAS: [] },
    pontos: { tomadaGeral: 4, tomadaEspecifica: 3, chuveiro: 0, iluminacao: 2, iluminacaoParalela: 0 } },
  { id: "lavanderia", nome: "Lavanderia", grupo: "Serviço", molhado: true,
    kits: { HIDRAULICA: ["AGUA_FRIA_LAVANDERIA", "AGUA_QUENTE_LAVANDERIA"], ESGOTO: ["ESGOTO_LAVANDERIA"], LOUCAS: ["LOUCAS_LAVANDERIA"], PORTAS: ["PORTA_INTERNA"] },
    pontos: { tomadaGeral: 2, tomadaEspecifica: 2, chuveiro: 0, iluminacao: 1, iluminacaoParalela: 0 } },
  { id: "deposito", nome: "Depósito", grupo: "Serviço", molhado: false,
    kits: { PORTAS: ["PORTA_INTERNA"] },
    pontos: { tomadaGeral: 1, tomadaEspecifica: 0, chuveiro: 0, iluminacao: 1, iluminacaoParalela: 0 } },
  { id: "areaLazer", nome: "Área de lazer", grupo: "Lazer", molhado: true,
    kits: { HIDRAULICA: ["AGUA_FRIA_COZINHA"], ESGOTO: ["ESGOTO_COZINHA"], LOUCAS: ["LOUCAS_COZINHA"], PORTAS: [] },
    pontos: { tomadaGeral: 4, tomadaEspecifica: 2, chuveiro: 0, iluminacao: 3, iluminacaoParalela: 0 } },
  { id: "lavaboLazer", nome: "Lavabo Lazer", grupo: "Lazer", molhado: true,
    kits: { HIDRAULICA: ["AGUA_FRIA_LAVABO"], ESGOTO: ["ESGOTO_LAVABO"], LOUCAS: ["LOUCAS_LAVABO"], PORTAS: ["PORTA_BANHEIRO"] },
    pontos: { tomadaGeral: 1, tomadaEspecifica: 0, chuveiro: 0, iluminacao: 1, iluminacaoParalela: 0 } },
  { id: "sauna", nome: "Sauna", grupo: "Lazer", molhado: false,
    kits: { PORTAS: ["PORTA_INTERNA"] },
    pontos: { tomadaGeral: 0, tomadaEspecifica: 1, chuveiro: 0, iluminacao: 1, iluminacaoParalela: 0 } },
  { id: "academia", nome: "Academia", grupo: "Lazer", molhado: false,
    kits: { PORTAS: ["PORTA_INTERNA"] },
    pontos: { tomadaGeral: 4, tomadaEspecifica: 1, chuveiro: 0, iluminacao: 2, iluminacaoParalela: 0 } },
  { id: "brinquedoteca", nome: "Brinquedoteca", grupo: "Lazer", molhado: false,
    kits: { PORTAS: ["PORTA_INTERNA"] },
    pontos: { tomadaGeral: 3, tomadaEspecifica: 0, chuveiro: 0, iluminacao: 2, iluminacaoParalela: 0 } },
  { id: "louceiro", nome: "Louceiro", grupo: "Lazer", molhado: false,
    kits: { PORTAS: ["PORTA_INTERNA"] },
    pontos: { tomadaGeral: 2, tomadaEspecifica: 0, chuveiro: 0, iluminacao: 1, iluminacaoParalela: 0 } },
  { id: "jardim", nome: "Jardim", grupo: "Lazer", molhado: true,
    kits: { HIDRAULICA: ["AGUA_FRIA_TORNEIRA_EXTERNA"], ESGOTO: [], LOUCAS: ["LOUCAS_TORNEIRA_EXTERNA"], PORTAS: [] },
    pontos: { tomadaGeral: 1, tomadaEspecifica: 0, chuveiro: 0, iluminacao: 2, iluminacaoParalela: 0 } },
  { id: "dormitorio", nome: "Dormitório", grupo: "Dormitórios", molhado: false,
    kits: { PORTAS: ["PORTA_INTERNA"] },
    pontos: { tomadaGeral: 4, tomadaEspecifica: 1, chuveiro: 0, iluminacao: 0, iluminacaoParalela: 1 } },
  { id: "closet", nome: "Closet", grupo: "Dormitórios", molhado: false,
    kits: { PORTAS: ["PORTA_INTERNA"] },
    pontos: { tomadaGeral: 1, tomadaEspecifica: 0, chuveiro: 0, iluminacao: 1, iluminacaoParalela: 0 } },
  { id: "wc", nome: "WC", grupo: "Dormitórios", molhado: true,
    kits: { HIDRAULICA: ["AGUA_FRIA_BANHEIRO", "AGUA_QUENTE_BANHEIRO"], ESGOTO: ["ESGOTO_BANHEIRO"], LOUCAS: ["LOUCAS_BANHEIRO"], PORTAS: ["PORTA_BANHEIRO"] },
    pontos: { tomadaGeral: 2, tomadaEspecifica: 0, chuveiro: 1, iluminacao: 2, iluminacaoParalela: 0 } },
  { id: "suite", nome: "Suíte", grupo: "Dormitórios", molhado: false,
    kits: { PORTAS: ["PORTA_INTERNA"] },
    pontos: { tomadaGeral: 4, tomadaEspecifica: 1, chuveiro: 0, iluminacao: 0, iluminacaoParalela: 1 } },
  { id: "closetSuite", nome: "Closet Suíte", grupo: "Dormitórios", molhado: false,
    kits: { PORTAS: ["PORTA_INTERNA"] },
    pontos: { tomadaGeral: 1, tomadaEspecifica: 0, chuveiro: 0, iluminacao: 1, iluminacaoParalela: 0 } },
  { id: "suiteMaster", nome: "Suíte Master", grupo: "Dormitórios", molhado: false,
    kits: { PORTAS: ["PORTA_INTERNA"] },
    pontos: { tomadaGeral: 6, tomadaEspecifica: 1, chuveiro: 0, iluminacao: 0, iluminacaoParalela: 1 } },
  { id: "escada", nome: "Escada", grupo: "Outros", molhado: false,
    kits: {},
    pontos: { tomadaGeral: 0, tomadaEspecifica: 0, chuveiro: 0, iluminacao: 1, iluminacaoParalela: 1 } },
];

// Kits por ponto elétrico (um ponto = eletroduto + cabo + caixa + dispositivo)
var AMBIENTES_GRUPOS = ["Áreas Sociais", "Serviço", "Lazer", "Dormitórios", "Outros"];
// ids antigos (antes de set/2026) → ids atuais, para projetos já gravados
var AMBIENTES_MIGRACAO = { banheiroSuite: "wc", banheiroSocial: "wc", salaEstar: "salaTV", circulacao: "hallEntrada", areaGourmet: "areaLazer", varanda: "areaLazer", torneiraExterna: "jardim" };

var PONTOS_ELETRICOS = [
  { id: "tomadaGeral",        nome: "Tomada de uso geral 10A",        kit: "PONTO_TOMADA_GERAL" },
  { id: "tomadaEspecifica",   nome: "Tomada de uso específico 20A",   kit: "PONTO_TOMADA_ESPECIFICA" },
  { id: "chuveiro",           nome: "Ponto de chuveiro",              kit: "PONTO_CHUVEIRO" },
  { id: "iluminacao",         nome: "Ponto de luz (interruptor simples)", kit: "PONTO_ILUMINACAO" },
  { id: "iluminacaoParalela", nome: "Ponto de luz (interruptor paralelo)", kit: "PONTO_ILUMINACAO_PARALELA" },
];

// Sistemas por obra
var SISTEMAS_AQUECIMENTO = [
  { id: "nenhum",   nome: "Sem aquecimento central", kit: null },
  { id: "eletrico", nome: "Elétrico (chuveiro/torneira)", kit: null },
  { id: "gas",      nome: "Gás de passagem",          kit: "AQUECIMENTO_GAS" },
  { id: "solar",    nome: "Solar com boiler",         kit: "AQUECIMENTO_SOLAR" },
];

// ── Kits ────────────────────────────────────────────────────────
// { nome, disciplina, base: "ambiente" | "ponto" | "obra", fonte, itens: [{ nome, qtd, unidade }] }
var COMPOSICOES_SEED = {
  // ═══ Água fria ═══
  AGUA_FRIA_BANHEIRO: { nome: "Água fria — banheiro (lavatório, vaso, chuveiro)", disciplina: "HIDRAULICA", base: "ambiente", fonte: "SINAPI 104660 adaptada", itens: [
    { nome: "PVC -  Alimentação - Marrom - Tubo 20mm", qtd: 3, unidade: "Mts" },
    { nome: "PVC -  Alimentação - Marrom - Tubo 25mm", qtd: 6, unidade: "Mts" },
    { nome: "PVC -  Alimentação - Marrom - Tubo 32mm", qtd: 3, unidade: "Mts" },
    { nome: "PVC - Alimentação Água Fria - Joelho 90° 20mm", qtd: 5, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Joelho 90° 25mm", qtd: 4, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Joelho 90° 25mm C/ Bucha latão", qtd: 3, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Tê 25mm", qtd: 2, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Tê 25x20mm C/ Bucha latão", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Luva 25mm", qtd: 2, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Adaptador 25mm Bol/Rosca", qtd: 2, unidade: "Unidades" },
  ] },
  AGUA_FRIA_LAVABO: { nome: "Água fria — lavabo (lavatório e vaso)", disciplina: "HIDRAULICA", base: "ambiente", fonte: "SINAPI 104660 sem chuveiro", itens: [
    { nome: "PVC -  Alimentação - Marrom - Tubo 20mm", qtd: 2, unidade: "Mts" },
    { nome: "PVC -  Alimentação - Marrom - Tubo 25mm", qtd: 4, unidade: "Mts" },
    { nome: "PVC -  Alimentação - Marrom - Tubo 32mm", qtd: 2, unidade: "Mts" },
    { nome: "PVC - Alimentação Água Fria - Joelho 90° 20mm", qtd: 3, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Joelho 90° 25mm", qtd: 3, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Joelho 90° 25mm C/ Bucha latão", qtd: 2, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Tê 25mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Tê 25x20mm C/ Bucha latão", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Luva 25mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Adaptador 25mm Bol/Rosca", qtd: 2, unidade: "Unidades" },
  ] },
  AGUA_FRIA_COZINHA: { nome: "Água fria — cozinha / área gourmet", disciplina: "HIDRAULICA", base: "ambiente", fonte: "SINAPI 104661 adaptada", itens: [
    { nome: "PVC -  Alimentação - Marrom - Tubo 20mm", qtd: 1, unidade: "Mts" },
    { nome: "PVC -  Alimentação - Marrom - Tubo 25mm", qtd: 6, unidade: "Mts" },
    { nome: "PVC -  Alimentação - Marrom - Tubo 32mm", qtd: 3, unidade: "Mts" },
    { nome: "PVC - Alimentação Água Fria - Joelho 90° 20mm", qtd: 2, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Joelho 90° 25mm", qtd: 3, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Joelho 90° 25mm C/ Bucha latão", qtd: 2, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Tê 25mm", qtd: 3, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Luva 25mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Adaptador 25mm Bol/Rosca", qtd: 1, unidade: "Unidades" },
  ] },
  AGUA_FRIA_LAVANDERIA: { nome: "Água fria — lavanderia (tanque e máquina)", disciplina: "HIDRAULICA", base: "ambiente", fonte: "SINAPI 104662 adaptada", itens: [
    { nome: "PVC -  Alimentação - Marrom - Tubo 25mm", qtd: 3, unidade: "Mts" },
    { nome: "PVC -  Alimentação - Marrom - Tubo 32mm", qtd: 3, unidade: "Mts" },
    { nome: "PVC - Alimentação Água Fria - Joelho 90° 25mm", qtd: 2, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Joelho 90° 25mm C/ Bucha latão", qtd: 2, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Tê 25mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Luva 25mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Adaptador 25mm Bol/Rosca", qtd: 1, unidade: "Unidades" },
  ] },
  AGUA_FRIA_TORNEIRA_EXTERNA: { nome: "Água fria — torneira externa / jardim", disciplina: "HIDRAULICA", base: "ambiente", fonte: "prática do escritório", itens: [
    { nome: "PVC -  Alimentação - Marrom - Tubo 25mm", qtd: 6, unidade: "Mts" },
    { nome: "PVC - Alimentação Água Fria - Joelho 90° 25mm", qtd: 2, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Joelho 90° 25mm C/ Bucha latão", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Tê 25mm", qtd: 1, unidade: "Unidades" },
  ] },

  // ═══ Água quente (CPVC 22/28) — só quando há aquecimento ═══
  AGUA_QUENTE_BANHEIRO: { nome: "Água quente — banheiro", disciplina: "HIDRAULICA", base: "ambiente", fonte: "SINAPI 104673 adaptada", requer: "aquecimento", itens: [
    { nome: "PVC - Hidráulica - CPVC -Tubo 22mm ou 3/4", qtd: 9.5, unidade: "Mts" },
    { nome: "PVC - Hidráulica - CPVC -Tubo 28mm", qtd: 3, unidade: "Mts" },
    { nome: "PVC - Água Quente - Joelho Normal 90° 22mm", qtd: 8, unidade: "Unidades" },
    { nome: "PVC - Água Quente - Joelho Transição 90° 22mm", qtd: 2, unidade: "Unidades" },
    { nome: "PVC - Água Quente - Conector 22mm", qtd: 2, unidade: "Unidades" },
    { nome: "PVC - Água Quente - Luva 22mm", qtd: 2, unidade: "Unidades" },
    { nome: "PVC - Água Quente - Luva Transição 22mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Água Quente - Tê 22mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Água Quente - Tê 28mm", qtd: 1, unidade: "Unidades" },
  ] },
  AGUA_QUENTE_COZINHA: { nome: "Água quente — cozinha", disciplina: "HIDRAULICA", base: "ambiente", fonte: "SINAPI 104673 reduzida", requer: "aquecimento", itens: [
    { nome: "PVC - Hidráulica - CPVC -Tubo 22mm ou 3/4", qtd: 5, unidade: "Mts" },
    { nome: "PVC - Hidráulica - CPVC -Tubo 28mm", qtd: 2, unidade: "Mts" },
    { nome: "PVC - Água Quente - Joelho Normal 90° 22mm", qtd: 4, unidade: "Unidades" },
    { nome: "PVC - Água Quente - Joelho Transição 90° 22mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Água Quente - Tê 22mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Água Quente - Luva 22mm", qtd: 1, unidade: "Unidades" },
  ] },
  AGUA_QUENTE_LAVANDERIA: { nome: "Água quente — lavanderia", disciplina: "HIDRAULICA", base: "ambiente", fonte: "SINAPI 104673 reduzida", requer: "aquecimento", itens: [
    { nome: "PVC - Hidráulica - CPVC -Tubo 22mm ou 3/4", qtd: 4, unidade: "Mts" },
    { nome: "PVC - Água Quente - Joelho Normal 90° 22mm", qtd: 3, unidade: "Unidades" },
    { nome: "PVC - Água Quente - Joelho Transição 90° 22mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Água Quente - Tê 22mm", qtd: 1, unidade: "Unidades" },
  ] },

  // ═══ Esgoto ═══
  ESGOTO_BANHEIRO: { nome: "Esgoto — banheiro (lavatório, vaso, ralo, chuveiro)", disciplina: "ESGOTO", base: "ambiente", fonte: "SINAPI 104676 + ramal até caixa de inspeção", itens: [
    { nome: "PVC -  Esgoto – Tubo 40mm", qtd: 3, unidade: "Mts" },
    { nome: "PVC -  Esgoto - Tubo 50mm", qtd: 1, unidade: "Mts" },
    { nome: "PVC -  Esgoto – Tubo 100mm", qtd: 3, unidade: "Mts" },
    { nome: "PVC - Esgoto - Joelho 90° 40mm", qtd: 2, unidade: "Unidades" },
    { nome: "PVC - Esgoto - Joelho 45° 40mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Esgoto - Joelho 90° 50mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Esgoto - Curva 90° Curta 100mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Esgoto - Junção 40mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Esgoto - Junção 100x50mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Esgoto - Caixas Sifonada 150x150x50mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC -  Esgoto - Ralo Click Inox 10cm", qtd: 1, unidade: "Unidades" },
  ] },
  ESGOTO_LAVABO: { nome: "Esgoto — lavabo", disciplina: "ESGOTO", base: "ambiente", fonte: "SINAPI 104676 sem chuveiro", itens: [
    { nome: "PVC -  Esgoto – Tubo 40mm", qtd: 2, unidade: "Mts" },
    { nome: "PVC -  Esgoto – Tubo 100mm", qtd: 2.5, unidade: "Mts" },
    { nome: "PVC - Esgoto - Joelho 90° 40mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Esgoto - Joelho 45° 40mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Esgoto - Curva 90° Curta 100mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Esgoto - Junção 100x50mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Esgoto - Caixas Sifonada 100x100x50mm", qtd: 1, unidade: "Unidades" },
  ] },
  ESGOTO_COZINHA: { nome: "Esgoto — cozinha / área gourmet (pia)", disciplina: "ESGOTO", base: "ambiente", fonte: "SINAPI 104678 + ramal até caixa de gordura", itens: [
    { nome: "PVC -  Esgoto - Tubo 50mm", qtd: 2.5, unidade: "Mts" },
    { nome: "PVC -  Esgoto – Tubo 100mm", qtd: 2, unidade: "Mts" },
    { nome: "PVC - Esgoto - Joelho 90° 50mm", qtd: 2, unidade: "Unidades" },
    { nome: "PVC - Esgoto - Junção 50mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Esgoto - Junção 100x50mm", qtd: 1, unidade: "Unidades" },
  ] },
  ESGOTO_LAVANDERIA: { nome: "Esgoto — lavanderia (tanque, máquina, ralo)", disciplina: "ESGOTO", base: "ambiente", fonte: "SINAPI 104679", itens: [
    { nome: "PVC -  Esgoto – Tubo 40mm", qtd: 1, unidade: "Mts" },
    { nome: "PVC -  Esgoto - Tubo 50mm", qtd: 2, unidade: "Mts" },
    { nome: "PVC - Esgoto - Joelho 90° 50mm", qtd: 2, unidade: "Unidades" },
    { nome: "PVC - Esgoto - Joelho 45° 50mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Esgoto - Bucha Redução 50x40mm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC -  Esgoto - Ralo Click Inox 10cm", qtd: 1, unidade: "Unidades" },
  ] },
  ESGOTO_POR_OBRA: { nome: "Esgoto — rede da casa até a rua (por obra)", disciplina: "ESGOTO", base: "obra", fonte: "prática do escritório", itens: [
    { nome: "PVC - Esgoto - Caixas Gordura 30cm", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Esgoto - Caixas Inspeção 60x60cm", qtd: 3, unidade: "Unidades" },
    { nome: "PVC -  Esgoto – Tubo 100mm", qtd: 15, unidade: "Mts" },
    { nome: "PVC -  Esgoto – Tubo 150mm", qtd: 6, unidade: "Mts" },
    { nome: "PVC - Esgoto - Curva 45° Longa 100mm", qtd: 4, unidade: "Unidades" },
    { nome: "PVC - Esgoto - Junção 100mm", qtd: 3, unidade: "Unidades" },
    { nome: "PVC - Esgoto - Luva 100mm", qtd: 4, unidade: "Unidades" },
    { nome: "PVC - Esgoto - Tê 100mm", qtd: 2, unidade: "Unidades" },
  ] },

  // ═══ Louças e metais (matriz do modelo antigo) ═══
  LOUCAS_BANHEIRO: { nome: "Louças e metais — banheiro (padrão Médio)", disciplina: "LOUCAS", base: "ambiente", fonte: "modelo antigo do escritório", itens: [
    { nome: "Metal - Hidráulica - Base Registro Gaveta 3/4", qtd: 2, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Acabamento registro", qtd: 2, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Base Válvula Descarga", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Acabamento Válvula Descarga", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Base Misturador Chuveiro 3/4", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Acabamento Misturador Chuveiro 3/4", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Chuveiro", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Ducha Higiênica", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Torneira WC", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Sifão Flexível", qtd: 1, unidade: "Unidades" },
    { nome: "Louças - Sanitário", qtd: 1, unidade: "Unidades" },
    { nome: "Louças - Cuba", qtd: 1, unidade: "Unidades" },
    { nome: "Box - Banho", qtd: 1, unidade: "Unidades" },
  ] },
  LOUCAS_BANHEIRO_ALTO: { nome: "Louças e metais — banheiro (padrão Alto)", disciplina: "LOUCAS", base: "ambiente", fonte: "modelo antigo do escritório", itens: [
    { nome: "Metal - Hidráulica - Base Registro Gaveta 3/4", qtd: 2, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Acabamento registro", qtd: 2, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Base Válvula Descarga", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Acabamento Válvula Descarga", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Base Registro Monocomando Chuveiro 3/4", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Acabamento Monocomando Chuveiro 3/4", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Chuveiro", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Ducha Higiênica", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Torneira WC", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Sifão Metálico", qtd: 1, unidade: "Unidades" },
    { nome: "PVC -  Esgoto - Ralo Oculto Quadrado 6''", qtd: 1, unidade: "Unidades" },
    { nome: "Louças - Sanitário", qtd: 1, unidade: "Unidades" },
    { nome: "Louças - Cuba", qtd: 1, unidade: "Unidades" },
    { nome: "Box - Banho", qtd: 1, unidade: "Unidades" },
  ] },
  LOUCAS_LAVABO: { nome: "Louças e metais — lavabo (padrão Médio)", disciplina: "LOUCAS", base: "ambiente", fonte: "modelo antigo do escritório", itens: [
    { nome: "Metal - Hidráulica - Base Registro Gaveta 3/4", qtd: 2, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Acabamento registro", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Base Válvula Descarga", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Acabamento Válvula Descarga", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Ducha Higiênica", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Torneira WC", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Sifão Flexível", qtd: 1, unidade: "Unidades" },
    { nome: "Louças - Sanitário", qtd: 1, unidade: "Unidades" },
    { nome: "Louças - Cuba", qtd: 1, unidade: "Unidades" },
  ] },
  LOUCAS_LAVABO_ALTO: { nome: "Louças e metais — lavabo (padrão Alto)", disciplina: "LOUCAS", base: "ambiente", fonte: "modelo antigo do escritório", itens: [
    { nome: "Metal - Hidráulica - Base Registro Gaveta 3/4", qtd: 2, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Acabamento registro", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Base Válvula Descarga", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Acabamento Válvula Descarga", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Ducha Higiênica", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Torneira WC", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Sifão Metálico", qtd: 1, unidade: "Unidades" },
    { nome: "Louças - Sanitário", qtd: 1, unidade: "Unidades" },
    { nome: "Louças - Cuba", qtd: 1, unidade: "Unidades" },
  ] },
  LOUCAS_COZINHA: { nome: "Louças e metais — cozinha / gourmet (padrão Médio)", disciplina: "LOUCAS", base: "ambiente", fonte: "modelo antigo do escritório", itens: [
    { nome: "Metal - Hidráulica - Base Registro Gaveta 3/4", qtd: 2, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Acabamento registro", qtd: 2, unidade: "Unidades" },
    { nome: "Metal - Torneira Cozinha e Lazer", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Cuba Metálica 56x34", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Sifão Flexível", qtd: 1, unidade: "Unidades" },
  ] },
  LOUCAS_COZINHA_ALTO: { nome: "Louças e metais — cozinha / gourmet (padrão Alto)", disciplina: "LOUCAS", base: "ambiente", fonte: "modelo antigo do escritório", itens: [
    { nome: "Metal - Hidráulica - Base Registro Gaveta 3/4", qtd: 2, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Acabamento registro", qtd: 2, unidade: "Unidades" },
    { nome: "Metal - Torneira Cozinha e Lazer", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Cuba Metálica 56x34", qtd: 2, unidade: "Unidades" },
    { nome: "Metal - Sifão Metálico", qtd: 1, unidade: "Unidades" },
  ] },
  LOUCAS_LAVANDERIA: { nome: "Louças e metais — lavanderia (padrão Médio)", disciplina: "LOUCAS", base: "ambiente", fonte: "modelo antigo do escritório", itens: [
    { nome: "Metal - Hidráulica - Base Registro Gaveta 3/4", qtd: 2, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Acabamento registro", qtd: 2, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Torneira Jardim", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Torneira Máquina de Lavar", qtd: 1, unidade: "Unidades" },
    { nome: "Louças - Tanque", qtd: 1, unidade: "Unidades" },
  ] },
  LOUCAS_LAVANDERIA_ALTO: { nome: "Louças e metais — lavanderia (padrão Alto)", disciplina: "LOUCAS", base: "ambiente", fonte: "modelo antigo do escritório", itens: [
    { nome: "Metal - Hidráulica - Base Registro Gaveta 3/4", qtd: 2, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Acabamento registro", qtd: 2, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Torneira Jardim", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Torneira Máquina de Lavar", qtd: 1, unidade: "Unidades" },
    { nome: "Louças - Tanque", qtd: 2, unidade: "Unidades" },
  ] },
  LOUCAS_TORNEIRA_EXTERNA: { nome: "Metais — torneira externa / jardim", disciplina: "LOUCAS", base: "ambiente", fonte: "modelo antigo do escritório", itens: [
    { nome: "Metal - Hidráulica - Torneira Jardim", qtd: 1, unidade: "Unidades" },
  ] },

  // ═══ Elétrica — por ponto ═══
  PONTO_TOMADA_GERAL: { nome: "Ponto de tomada de uso geral 2P+T 10A", disciplina: "ELETRICA", base: "ponto", fonte: "SINAPI 104475", itens: [
    { nome: "PVC – Elétrica - Corrugado amarelo ¾”", qtd: 2.5, unidade: "Mts" },
    { nome: "Elétrica - Cabo Flex Cobre 2.5mm", qtd: 10.5, unidade: "Mts" },
    { nome: "PVC – Elétrica - Caixa 4x2” pvc embutir", qtd: 1, unidade: "Unidades" },
    { nome: "Elétrica - Interruptores e placas - Tomada hexagonal (NBR 14136) 2P+T 10A", qtd: 1, unidade: "Unidades" },
    { nome: "Elétrica - Interruptores e placas - Placa p/ 1 função", qtd: 1, unidade: "Unidades" },
  ] },
  PONTO_TOMADA_ESPECIFICA: { nome: "Ponto de tomada de uso específico 2P+T 20A (circuito próprio)", disciplina: "ELETRICA", base: "ponto", fonte: "SINAPI 104476", itens: [
    { nome: "PVC – Elétrica - Corrugado amarelo ¾”", qtd: 3.3, unidade: "Mts" },
    { nome: "Elétrica - Cabo Flex Cobre 2.5mm", qtd: 10.6, unidade: "Mts" },
    { nome: "PVC – Elétrica - Caixa 4x2” pvc embutir", qtd: 1, unidade: "Unidades" },
    { nome: "Elétrica - Interruptores e placas - Tomada hexagonal (NBR 14136) 2P+T 20A", qtd: 1, unidade: "Unidades" },
    { nome: "Elétrica - Interruptores e placas - Placa p/ 1 função", qtd: 1, unidade: "Unidades" },
    { nome: "Elétrica - Disjuntor Unipolar 20A - 10kA", qtd: 1, unidade: "Unidades" },
  ] },
  PONTO_CHUVEIRO: { nome: "Ponto de chuveiro (circuito próprio 4 mm²)", disciplina: "ELETRICA", base: "ponto", fonte: "SINAPI 104481", itens: [
    { nome: "PVC – Elétrica - Corrugado amarelo ¾”", qtd: 7.7, unidade: "Mts" },
    { nome: "Elétrica - Cabo Flex Cobre 4mm", qtd: 23.2, unidade: "Mts" },
    { nome: "PVC – Elétrica - Caixa 4x2” pvc embutir", qtd: 1, unidade: "Unidades" },
    { nome: "Elétrica - Disjuntor Bipolar 32A - 10kA", qtd: 1, unidade: "Unidades" },
  ] },
  PONTO_ILUMINACAO: { nome: "Ponto de luz com interruptor simples (com luminária)", disciplina: "ELETRICA", base: "ponto", fonte: "SINAPI 104473", itens: [
    { nome: "PVC – Elétrica - Corrugado amarelo ¾”", qtd: 3.5, unidade: "Mts" },
    { nome: "Elétrica - Cabo Flex Cobre 1.5mm", qtd: 10.7, unidade: "Mts" },
    { nome: "Elétrica - Cabo Flex Cobre 2.5mm", qtd: 1.5, unidade: "Mts" },
    { nome: "PVC – Elétrica - Caixa Octogonal 4x4” pvc embutir", qtd: 1, unidade: "Unidades" },
    { nome: "PVC – Elétrica - Caixa 4x2” pvc embutir", qtd: 1, unidade: "Unidades" },
    { nome: "Elétrica - Interruptores e placas - Interruptor simples 1 tecla", qtd: 1, unidade: "Unidades" },
    { nome: "Elétrica - Interruptores e placas - Placa p/ 1 função", qtd: 1, unidade: "Unidades" },
    { nome: "Elétrica - Luminárias", qtd: 1, unidade: "Unidades" },
  ] },
  PONTO_ILUMINACAO_PARALELA: { nome: "Ponto de luz com dois interruptores paralelos (com luminária)", disciplina: "ELETRICA", base: "ponto", fonte: "SINAPI 104478 adaptada", itens: [
    { nome: "PVC – Elétrica - Corrugado amarelo ¾”", qtd: 5, unidade: "Mts" },
    { nome: "Elétrica - Cabo Flex Cobre 1.5mm", qtd: 16, unidade: "Mts" },
    { nome: "Elétrica - Cabo Flex Cobre 2.5mm", qtd: 1.5, unidade: "Mts" },
    { nome: "PVC – Elétrica - Caixa Octogonal 4x4” pvc embutir", qtd: 1, unidade: "Unidades" },
    { nome: "PVC – Elétrica - Caixa 4x2” pvc embutir", qtd: 2, unidade: "Unidades" },
    { nome: "Elétrica - Interruptores e placas - Interruptor paralela - 1 tecla", qtd: 2, unidade: "Unidades" },
    { nome: "Elétrica - Interruptores e placas - Placa p/ 1 função", qtd: 2, unidade: "Unidades" },
    { nome: "Elétrica - Luminárias", qtd: 1, unidade: "Unidades" },
  ] },
  ELETRICA_POR_OBRA: { nome: "Elétrica — entrada e quadro (por obra)", disciplina: "ELETRICA", base: "obra", fonte: "prática do escritório", itens: [
    { nome: "Quadro 100A Embutir 32 Disjuntores sem Barramento", qtd: 1, unidade: "Unidades" },
    { nome: "Elétrica - Disjuntor Tripolar 63A - 10kA", qtd: 1, unidade: "Unidades" },
    { nome: "Elétrica - Disjuntor Dispositivo de proteção 175V - 8kA", qtd: 3, unidade: "Unidades" },
    { nome: "Elétrica - Cabo Flex Cobre 16mm", qtd: 60, unidade: "Mts" },
    { nome: "PVC – Elétrica - Corrugado Kanaflex 1.1/2''", qtd: 15, unidade: "Mts" },
    { nome: "Quadro de Dados 20x20 Embutir", qtd: 1, unidade: "Unidades" },
  ] },
  // Circuitos calculados pelo motor (não são kit fixo):
  //   disjuntor 10A unipolar = ceil(pontos de luz / 8)
  //   disjuntor 20A unipolar = ceil(tomadas gerais / 6)

  // ═══ Aquecimento e pressurização ═══
  AQUECIMENTO_SOLAR: { nome: "Aquecimento solar com boiler (por obra)", disciplina: "AQUECIMENTO", base: "obra", fonte: "prática do escritório", itens: [
    { nome: "Aquecedor - Coletor Solares Casa", qtd: 3, unidade: "Unidades" },
    { nome: "Equipamentos e Sistemas - Boiler Baixa Pressão 500 L", qtd: 1, unidade: "Unidades" },
    { nome: "Equipamentos e Sistemas - Bomba Circulação Boiler", qtd: 1, unidade: "Unidades" },
    { nome: "Equipamentos e Sistemas - Controlador Temperatura Boiler", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Hidráulica - CPVC -Tubo 28mm", qtd: 20, unidade: "Mts" },
    { nome: "PVC - Água Quente - Joelho Normal 90° 28mm", qtd: 8, unidade: "Unidades" },
    { nome: "PVC - Água Quente - União 28mm", qtd: 4, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Registro Esfera 25mm", qtd: 4, unidade: "Unidades" },
  ] },
  AQUECIMENTO_SOLAR_ALTO: { nome: "Aquecimento solar com boiler pressurizado (padrão Alto, por obra)", disciplina: "AQUECIMENTO", base: "obra", fonte: "prática do escritório", itens: [
    { nome: "Aquecedor - Coletor Solares Casa", qtd: 4, unidade: "Unidades" },
    { nome: "Equipamentos e Sistemas - Boiler Pressurizado 500 L", qtd: 1, unidade: "Unidades" },
    { nome: "Equipamentos e Sistemas - Bomba Circulação Boiler", qtd: 1, unidade: "Unidades" },
    { nome: "Equipamentos e Sistemas - Controlador Temperatura Boiler", qtd: 1, unidade: "Unidades" },
    { nome: "PVC - Hidráulica - CPVC -Tubo 28mm", qtd: 24, unidade: "Mts" },
    { nome: "PVC - Água Quente - Joelho Normal 90° 28mm", qtd: 10, unidade: "Unidades" },
    { nome: "PVC - Água Quente - União 28mm", qtd: 4, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Registro Esfera 25mm", qtd: 4, unidade: "Unidades" },
  ] },
  AQUECIMENTO_GAS: { nome: "Aquecedor a gás de passagem (por obra)", disciplina: "AQUECIMENTO", base: "obra", fonte: "prática do escritório", itens: [
    { nome: "Aquecedor - Gás de Passagem", qtd: 1, unidade: "Unidades" },
    { nome: "Aquecedor - Kit instalação gás (tubulação, registro, chaminé)", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Registro Esfera 25mm", qtd: 2, unidade: "Unidades" },
  ] },
  PRESSURIZADOR: { nome: "Pressurizador da casa (por obra)", disciplina: "AQUECIMENTO", base: "obra", fonte: "prática do escritório", itens: [
    { nome: "Equipamentos e Sistemas - Pressurizador Casa", qtd: 1, unidade: "Unidades" },
    { nome: "Metal - Hidráulica - Registro Esfera 32mm", qtd: 2, unidade: "Unidades" },
    { nome: "PVC - Alimentação Água Fria - Registro c/ União 50mm", qtd: 1, unidade: "Unidades" },
  ] },

  // ═══ Portas internas ═══
  PORTA_INTERNA: { nome: "Porta interna de giro — dormitório/escritório/closet (padrão Médio)", disciplina: "PORTAS", base: "ambiente", fonte: "modelo antigo do escritório", itens: [
    { nome: "Portas Internas Comum", qtd: 1, unidade: "Unidades" },
    { nome: "Fechaduras - Dobradiças- STAM", qtd: 3, unidade: "Unidades" },
    { nome: "Fechaduras - Classic 3400 (40mm) Ros. Quadrada INT - STAM", qtd: 1, unidade: "Unidades" },
  ] },
  PORTA_INTERNA_ALTO: { nome: "Porta interna de giro — dormitório/escritório/closet (padrão Alto)", disciplina: "PORTAS", base: "ambiente", fonte: "modelo antigo do escritório", itens: [
    { nome: "Portas Internas Sincol Sólida", qtd: 1, unidade: "Unidades" },
    { nome: "Fechaduras - Dobradiças- STAM", qtd: 3, unidade: "Unidades" },
    { nome: "Fechaduras - Inox Home iX60 (55mm) Interna Black - STAM", qtd: 1, unidade: "Unidades" },
  ] },
  PORTA_BANHEIRO: { nome: "Porta interna de giro — banheiro/lavabo (padrão Médio)", disciplina: "PORTAS", base: "ambiente", fonte: "modelo antigo do escritório", itens: [
    { nome: "Portas Internas Comum", qtd: 1, unidade: "Unidades" },
    { nome: "Fechaduras - Dobradiças- STAM", qtd: 3, unidade: "Unidades" },
    { nome: "Fechaduras - Classic 3400 (40mm) Ros. Quadrada WC - STAM", qtd: 1, unidade: "Unidades" },
  ] },
  PORTA_BANHEIRO_ALTO: { nome: "Porta interna de giro — banheiro/lavabo (padrão Alto)", disciplina: "PORTAS", base: "ambiente", fonte: "modelo antigo do escritório", itens: [
    { nome: "Portas Internas Sincol Sólida", qtd: 1, unidade: "Unidades" },
    { nome: "Fechaduras - Dobradiças- STAM", qtd: 3, unidade: "Unidades" },
    { nome: "Fechaduras - Inox Home iX60 (55mm) WC Black - STAM", qtd: 1, unidade: "Unidades" },
  ] },
};
