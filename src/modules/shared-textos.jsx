// ═══════════════════════════════════════════════════════════════
// SHARED-TEXTOS — defaults e helpers compartilhados de texto da proposta
// ═══════════════════════════════════════════════════════════════
// Lugar único pros textos padrão que aparecem na proposta (escopo das
// etapas, serviços não inclusos, prazos, termo de aceite) + helpers que
// formatam/parseiam esses textos.
//
// Antes da Fase 5 essas constantes/funções estavam duplicadas em 3
// lugares (modelo-padrao.jsx, resultado-pdf.jsx, template-edicao.jsx).
// Agora o template lê daqui, o modelo-padrao lê daqui (no fallback) e
// cada novo modelo de orçamento lê daqui.
//
// Posicionamento no combine.js: ANTES de modelo-padrao.jsx e
// template-edicao.jsx (consts precisam estar definidas em ordem).
//
// Observação sobre PDF: resultado-pdf.jsx ainda mantém suas próprias
// cópias por enquanto — o backend renderiza PDF via SSR/Puppeteer e
// alterações ali precisam ir junto. Migração desse arquivo fica pra
// uma próxima fase.
// ═══════════════════════════════════════════════════════════════

// ─── Defaults estruturados ───────────────────────────────────

const TXT_DEFAULT_ESCOPO_ETAPAS = [
  {
    titulo: "1. Estudo Preliminar",
    objetivo: "Desenvolver o conceito arquitetônico inicial, organizando os ambientes, a implantação e a linguagem estética do projeto.",
    itens: [
      "Reunião de briefing e entendimento das necessidades do cliente",
      "Definição do programa de necessidades",
      "Estudo de implantação da edificação no terreno",
      "Desenvolvimento da concepção arquitetônica inicial",
      "Definição preliminar de: layout, fluxos, volumetria, setorização e linguagem estética",
      "Compatibilização entre funcionalidade, conforto, estética e viabilidade construtiva",
      "Ajustes conforme alinhamento com o cliente",
    ],
    entregaveis: [
      "Planta baixa preliminar",
      "Estudo volumétrico / fachada conceitual",
      "Implantação inicial",
      "Imagens, croquis ou perspectivas conceituais",
      "Apresentação para validação do conceito arquitetônico",
    ],
    obs: "É nesta etapa que o projeto ganha forma. O estudo preliminar define a essência da proposta e orienta todas as fases seguintes.",
  },
  {
    titulo: "2. Aprovação na Prefeitura",
    objetivo: "Adequar e preparar o projeto arquitetônico para protocolo e aprovação junto aos órgãos públicos competentes.",
    itens: [
      "Adequação do projeto às exigências legais e urbanísticas do município",
      "Elaboração dos desenhos técnicos exigidos para aprovação",
      "Montagem da documentação técnica necessária ao processo",
      "Inserção de informações obrigatórias conforme normas municipais",
      "Preparação de pranchas, quadros de áreas e demais peças gráficas",
      "Apoio técnico durante o processo de aprovação",
      "Atendimento a eventuais comunique-se ou exigências técnicas da prefeitura",
    ],
    entregaveis: [
      "Projeto legal para aprovação",
      "Plantas, cortes, fachadas e implantação conforme exigência municipal",
      "Quadros de áreas",
      "Arquivos e documentação técnica para protocolo",
    ],
    obs: "Não inclusos nesta etapa: taxas municipais, emolumentos, ART/RRT, levantamentos complementares, certidões e exigências extraordinárias de órgãos externos, salvo se expressamente previsto.",
  },
  {
    titulo: "3. Projeto Executivo",
    objetivo: "Desenvolver o projeto arquitetônico em nível detalhado para execução da obra, fornecendo todas as informações necessárias para construção com precisão.",
    itens: [
      "Desenvolvimento técnico completo do projeto aprovado",
      "Detalhamento arquitetônico para obra",
      "Definição precisa de: dimensões, níveis, cotas, eixos, paginações, esquadrias, acabamentos e elementos construtivos",
      "Elaboração de desenhos técnicos executivos",
      "Compatibilização arquitetônica com premissas de obra",
      "Apoio técnico para leitura e entendimento do projeto pela equipe executora",
    ],
    entregaveis: [
      "Planta baixa executiva",
      "Planta de locação e implantação",
      "Planta de cobertura",
      "Cortes e fachadas executivos",
      "Planta de layout e pontos arquitetônicos",
      "Planta de esquadrias e pisos",
      "Detalhamentos construtivos",
      "Quadro de esquadrias e quadro de áreas final",
    ],
    obs: "É a etapa que transforma a ideia em construção real. Um bom projeto executivo reduz improvisos, retrabalhos e falhas de execução na obra.",
  },
];

const TXT_DEFAULT_NAO_INCLUSOS = [
  "Taxas municipais, emolumentos e registros (CAU/Prefeitura)",
  "Impostos",
  "Projetos de climatização",
  "Projeto de prevenção de incêndio",
  "Projeto de automação",
  "Projeto de paisagismo",
  "Projeto de interiores",
  "Projeto de Marcenaria (Móveis internos)",
  "Projeto estrutural de estruturas metálicas",
  "Projeto estrutural para muros de contenção (arrimo) acima de 1 m de altura",
  "Sondagem e Planialtimétrico do terreno",
  "Acompanhamento semanal de obra",
  "Gestão e execução de obra",
  "Vistoria para Caixa Econômica Federal",
  "RRT de Execução de obra",
];

const TXT_DEFAULT_PRAZO = [
  "Prazo estimado para entrega do Projeto Arquitetônico: 30 dias úteis após contratação.",
  "Prazo estimado para entrega dos Projetos de Engenharia: 30 dias úteis após aprovação na prefeitura.",
];

const TXT_DEFAULT_ACEITE =
  "Aceitando esta proposta, o cliente concorda com os termos, valores, escopo e prazos descritos. A formalização se dá pela assinatura abaixo, ou pelo aceite digital encaminhado por e-mail.";

// ─── Formatadores: estrutura → texto editável ────────────────

// Formata o array de etapas como bloco de texto contínuo, com cada etapa
// separada por uma linha de divisão. Usado pra pré-popular a textarea
// "Escopo dos serviços" do template.
function txtFormatarEscopoComoTexto(etapas) {
  return etapas.map(et => {
    const linhas = [];
    linhas.push(et.titulo);
    linhas.push("");
    linhas.push("Objetivo: " + et.objetivo);
    linhas.push("");
    linhas.push("Inclui:");
    et.itens.forEach(i => linhas.push("• " + i));
    linhas.push("");
    linhas.push("Entregáveis:");
    et.entregaveis.forEach(e => linhas.push("• " + e));
    if (et.obs) {
      linhas.push("");
      linhas.push(et.obs);
    }
    return linhas.join("\n");
  }).join("\n\n────────\n\n");
}

// Formata array de strings como lista com bullet por linha.
function txtFormatarListaComoTexto(lista) {
  return lista.map(item => "• " + item).join("\n");
}

// ─── Parser: texto → array (caminho reverso) ─────────────────

// Pega texto livre digitado pelo usuário no template e quebra em itens
// (uma linha = um item). Strip leading bullets ("• ", "- ", "* ") e
// linhas vazias. Usado quando o modelo precisa reusar a lista
// estruturada (ex: renderizar não inclusos como bullets visuais).
function txtParseListaDeTexto(texto) {
  if (!texto || typeof texto !== "string") return [];
  return texto.split("\n")
    .map(l => l.trim().replace(/^[•\-*]\s*/, "").trim())
    .filter(l => l.length > 0);
}

// ─── Helper de descrição dinâmica do projeto ─────────────────

// Gera uma frase descritiva dinâmica do projeto (ex: "Construção nova de
// uma residência térrea, com 224m² de área construída, composta por 9
// ambientes: ..."). Usada como pré-preenchimento da textarea
// "Descrição do projeto" no template e como fallback no modelo quando
// o usuário não personaliza esse campo.
//
// Depende de `formatComodo` (declarada em orcamento-teste.jsx) — usa
// fallback simples se ainda não estiver disponível no escopo global.
function txtComputarDescricaoProjeto(data) {
  if (!data) return "";
  const fmtN2 = v => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtArea = v => v > 0 ? fmtN2(v) + "m²" : null;
  const tipoObraLower = (data.tipoObra || "").toLowerCase();
  const prefixo = tipoObraLower.includes("reforma") ? "Reforma de " : "Construção nova de ";
  const calc = data.calculo || {};

  // Caso comercial (conjunto comercial com grupoQtds)
  if (data.grupoQtds && calc.blocosCom) {
    const partes = [];
    const nL = data.grupoQtds["Por Loja"] || 0;
    const nA = data.grupoQtds["Espaço Âncora"] || 0;
    const nAp = data.grupoQtds["Por Apartamento"] || 0;
    const nG = data.grupoQtds["Galpao"] || 0;
    if (nL > 0) { const b = calc.blocosCom.find(x => x.label === "Loja"); if (b) partes.push(`${nL} loja${nL !== 1 ? "s" : ""} (${fmtArea(b.area1 * nL)})`); }
    if (nA > 0) { const b = calc.blocosCom.find(x => x.label === "Âncora"); if (b) partes.push(`${nA} ${nA === 1 ? "Espaço Âncora" : "Espaços Âncoras"} (${fmtArea(b.area1 * nA)})`); }
    if (nAp > 0) { const b = calc.blocosCom.find(x => x.label === "Apartamento"); if (b) partes.push(`${nAp} apartamento${nAp !== 1 ? "s" : ""} (${fmtArea(b.area1 * nAp)})`); }
    if (nG > 0) { const b = calc.blocosCom.find(x => x.label === "Galpão"); if (b) partes.push(`${nG} ${nG !== 1 ? "galpões" : "galpão"} (${fmtArea(b.area1 * nG)})`); }
    const bc = calc.blocosCom.find(x => x.label === "Área Comum"); if (bc) partes.push(`Área Comum (${fmtArea(bc.area1)})`);
    const lista = partes.length > 1 ? partes.slice(0, -1).join(", ") + " e " + partes[partes.length - 1] : partes[0] || "";
    return `${prefixo}conjunto comercial, contendo ${lista}, totalizando ${fmtArea(calc.areaTot || calc.areaTotal)}.`;
  }

  // Caso residencial
  const nUnid = calc.nRep || 1;
  const areaUni = calc.areaTotal || calc.areaTot || 0;
  const areaTotR = Math.round(areaUni * nUnid * 100) / 100;
  const comodos = data.comodos || [];
  const totalAmb = comodos.reduce((s, c) => s + (c.qtd || 0), 0);
  const fc = (typeof formatComodo === "function") ? formatComodo : (n, q) => `${q} ${n}`;
  const itensFmt = comodos.filter(c => (c.qtd || 0) > 0).map(c => fc(c.nome, c.qtd));
  const listaStr = itensFmt.length > 1
    ? itensFmt.slice(0, -1).join(", ") + " e " + itensFmt[itensFmt.length - 1]
    : itensFmt[0] || "";
  const tipDesc = (data.tipologia || "").toLowerCase().includes("sobrado") ? "com dois pavimentos" : "térrea";
  const numFem = ["", "uma", "duas", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"];
  if (nUnid > 1) {
    const nExt = nUnid >= 1 && nUnid <= 10 ? numFem[nUnid] : String(nUnid);
    return `${prefixo}${nExt} residências ${tipDesc} idênticas, com ${fmtN2(areaUni)}m² por unidade, totalizando ${fmtN2(areaTotR)}m² de área construída. Cada unidade composta por ${totalAmb} ambientes: ${listaStr}.`;
  }
  return `${prefixo}uma residência ${tipDesc}, com ${fmtN2(areaUni)}m² de área construída, composta por ${totalAmb} ambientes: ${listaStr}.`;
}
