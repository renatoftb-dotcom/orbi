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
// Defaults — escopo, não inclusos, prazo, aceite
// Replicam os defaults usados pelo ModeloPadrao/PDF, formatados como texto
// livre pra o usuário ler/editar como num documento Word.
// ─────────────────────────────────────────────────────────────

const TPL_DEFAULT_ESCOPO_ETAPAS = [
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

const TPL_DEFAULT_NAO_INCLUSOS = [
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

const TPL_DEFAULT_PRAZO = [
  "Prazo estimado para entrega do Projeto Arquitetônico: 30 dias úteis após contratação.",
  "Prazo estimado para entrega dos Projetos de Engenharia: 30 dias úteis após aprovação na prefeitura.",
];

const TPL_DEFAULT_ACEITE =
  "Aceitando esta proposta, o cliente concorda com os termos, valores, escopo e prazos descritos. A formalização se dá pela assinatura abaixo, ou pelo aceite digital encaminhado por e-mail.";

const TPL_DEFAULT_APRESENTACAO = "";   // livre por padrão
const TPL_DEFAULT_OBSERVACOES = "";    // livre por padrão

// ─────────────────────────────────────────────────────────────
// Formatadores — convertem dados estruturados em texto editável
// ─────────────────────────────────────────────────────────────

function formatarEscopoComoTexto(etapas) {
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

function formatarListaComoTexto(lista) {
  return lista.map(item => "• " + item).join("\n");
}

// Gera descrição dinâmica do projeto (ex: "Construção nova de uma residência
// térrea, com 224m² de área construída, composta por 9 ambientes: ...").
// Lógica REPLICADA do modelo-padrao.jsx (resumoDinamico). TODO Fase 5: extrair
// pra um shared-textos.jsx único e remover a duplicação. Depende de
// formatComodo (declarado em orcamento-teste.jsx, disponível via escopo
// global após combine).
function computarDescricaoProjeto(data) {
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
  // formatComodo vem do escopo global (declarado em orcamento-teste.jsx)
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
    tx.descricaoProjeto !== undefined ? tx.descricaoProjeto : computarDescricaoProjeto(safeData)
  );
  const [apresentacao, setApresentacao] = useState(
    tx.apresentacao !== undefined ? tx.apresentacao : TPL_DEFAULT_APRESENTACAO
  );
  const [escopo, setEscopo] = useState(
    tx.escopo !== undefined ? tx.escopo : formatarEscopoComoTexto(TPL_DEFAULT_ESCOPO_ETAPAS)
  );
  const [naoInclusos, setNaoInclusos] = useState(
    tx.naoInclusos !== undefined ? tx.naoInclusos : formatarListaComoTexto(TPL_DEFAULT_NAO_INCLUSOS)
  );
  const [prazo, setPrazo] = useState(
    tx.prazo !== undefined ? tx.prazo : formatarListaComoTexto(TPL_DEFAULT_PRAZO)
  );
  const [aceite, setAceite] = useState(
    tx.aceite !== undefined ? tx.aceite : TPL_DEFAULT_ACEITE
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
