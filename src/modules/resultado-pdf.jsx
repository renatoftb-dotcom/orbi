// ═══════════════════════════════════════════════════════════════
// BOTÃO GERAR PDF
// ═══════════════════════════════════════════════════════════════
async function buildPdf(orc, logo=null, modeloPdf=null, corTema=null, bgLogo="#ffffff", incluiArq=true, incluiEng=true) {
  const { jsPDF } = window.jspdf;

  // ── Dados base ─────────────────────────────────────────────
  const r       = orc.resultado || {};
  const area    = r.areaTotal || 0;
  const nUnid   = r.nUnidades || 1;

  // Imposto
  const temImp  = !!(orc.temImposto ?? r.impostoAplicado);
  const aliqImp = orc.aliqImp ?? r.aliquotaImposto ?? 0;
  const semFat  = temImp ? (1 - aliqImp/100) : 1;

  // ESPELHO do preview: quando orc._preview existe, usa valores exatos pré-calculados
  const P = orc._preview || null;

  // Arq e Eng SEM imposto — usa valores editados passados pelo handlePdf
  const arqCI   = P ? P.arqSI : Math.round((r.precoArq||r.precoTotal||r.precoFinal||0)*100)/100;
  const engRaw  = Math.round((r.engTotal ?? calcularEngenharia(area).totalEng)*100)/100;
  let engRepet  = 0;
  if (nUnid > 1) {
    let ac = area;
    for (let i = 2; i <= nUnid; i++) {
      const pct = getTipoConfig(orc.tipo).repeticaoPcts(ac);
      engRepet += engRaw * pct; ac += area;
    }
  }
  const engBase = Math.round((engRaw + engRepet)*100)/100;
  const engCI   = P ? P.engSI : Math.round((r.precoEng||engBase)*100)/100;
  const totSI   = P ? P.totalSI : Math.round((arqCI + (incluiEng?engCI:0))*100)/100;
  const totCI   = P ? P.totalCI : (temImp ? Math.round(totSI/(1-aliqImp/100)*100)/100 : totSI);
  const impostoV= P ? P.impostoV : (temImp ? Math.round((totCI - totSI)*100)/100 : 0);
  // Engenharia com imposto (usado na linha da tabela)
  const engCIcom = P ? P.engCI : (temImp && engCI>0 ? Math.round(engCI/(1-aliqImp/100)*100)/100 : engCI);
  // Arquitetura com imposto (usado em formas de pagamento "Apenas Arquitetura")
  const arqCIcom = P ? P.arqCI : (temImp && arqCI>0 ? Math.round(arqCI/(1-aliqImp/100)*100)/100 : arqCI);
  // Etapas isoladas
  const idsIsoladosPdf = new Set(orc.etapasIsoladas || []);
  const temIsoladasPdf = idsIsoladosPdf.size > 0;
  // pctTotalIsoladoPdf: soma dos pcts das etapas selecionadas (usado para proporção entre etapas)
  const pctTotalIsoladoPdf = (orc.etapasPct||[]).filter(e=>e.id!==5).reduce((s,e)=>s+Number(e.pct),0);
  // Quando isolado, arqCI já é o valor correto — totCI já reflete o total do orçamento isolado
  const totCIBasePdf = totCI;

  // Escopo (igual preview)
  const escopoDefault = [
    { titulo:"1. Estudo de Viabilidade", objetivo:"Analisar o potencial construtivo do terreno e verificar a viabilidade de implantação do empreendimento, considerando as condicionantes físicas, urbanísticas, legais e funcionais aplicáveis ao lote.", itens:["Levantamento inicial e consolidação das informações técnicas do terreno","Análise documental e física do lote, incluindo matrícula, dimensões, topografia e características existentes","Consulta e interpretação dos parâmetros urbanísticos e restrições legais aplicáveis","Verificação da viabilidade construtiva, considerando taxa de ocupação, coeficiente de aproveitamento, recuos obrigatórios, gabarito de altura e demais condicionantes normativas","Estimativa preliminar da área edificável e do potencial de aproveitamento do terreno","Avaliação da melhor ocupação do lote, alinhada ao programa de necessidades do cliente","Definição preliminar da implantação, organização dos acessos, fluxos, circulação, áreas livres e áreas construídas","Estudo de volumetria, análise de inserção no entorno e definição de pontos focais que contribuam para a valorização do empreendimento","Dimensionamento preliminar de estacionamentos, fluxos operacionais e viabilidade de circulação para veículos leves e pesados"], entregaveis:["Estudo técnico de ocupação do terreno, com planta de implantação e setorização preliminar","Esquema conceitual de implantação, incluindo diagramas de organização espacial, acessos e condicionantes do entorno","Representações gráficas, estudo volumétrico em 3D e imagens conceituais","Relatório sintético de viabilidade construtiva, contemplando memorial descritivo, quadro de áreas e síntese dos parâmetros urbanísticos aplicáveis"], obs:"Esta etapa tem como objetivo reduzir riscos e antecipar decisões estratégicas antes do desenvolvimento do projeto, permitindo validar a compatibilidade da proposta com o terreno, com a legislação municipal e com os objetivos do empreendimento." },
    { titulo:"2. Estudo Preliminar", objetivo:"Desenvolver o conceito arquitetônico inicial, organizando os ambientes, a implantação e a linguagem estética do projeto.", itens:["Reunião de briefing e entendimento das necessidades do cliente","Definição do programa de necessidades","Estudo de implantação da edificação no terreno","Desenvolvimento da concepção arquitetônica inicial","Definição preliminar de: layout, fluxos, volumetria, setorização e linguagem estética","Compatibilização entre funcionalidade, conforto, estética e viabilidade construtiva","Ajustes conforme alinhamento com o cliente"], entregaveis:["Planta baixa preliminar","Estudo volumétrico / fachada conceitual","Implantação inicial","Imagens, croquis ou perspectivas conceituais","Apresentação para validação do conceito arquitetônico"], obs:"É nesta etapa que o projeto ganha forma. O estudo preliminar define a essência da proposta e orienta todas as fases seguintes." },
    { titulo:"3. Aprovação na Prefeitura", objetivo:"Adequar e preparar o projeto arquitetônico para protocolo e aprovação junto aos órgãos públicos competentes.", itens:["Adequação do projeto às exigências legais e urbanísticas do município","Elaboração dos desenhos técnicos exigidos para aprovação","Montagem da documentação técnica necessária ao processo","Inserção de informações obrigatórias conforme normas municipais","Preparação de pranchas, quadros de áreas e demais peças gráficas","Apoio técnico durante o processo de aprovação","Atendimento a eventuais comunique-se ou exigências técnicas da prefeitura"], entregaveis:["Projeto legal para aprovação","Plantas, cortes, fachadas e implantação conforme exigência municipal","Quadros de áreas","Arquivos e documentação técnica para protocolo"], obs:"Não inclusos nesta etapa: taxas municipais, emolumentos, ART/RRT, levantamentos complementares, certidões e exigências extraordinárias de órgãos externos, salvo se expressamente previsto." },
    { titulo:"4. Projeto Executivo", objetivo:"Desenvolver o projeto arquitetônico em nível detalhado para execução da obra, fornecendo todas as informações necessárias para construção com precisão.", itens:["Desenvolvimento técnico completo do projeto aprovado","Detalhamento arquitetônico para obra","Definição precisa de: dimensões, níveis, cotas, eixos, paginações, esquadrias, acabamentos e elementos construtivos","Elaboração de desenhos técnicos executivos","Compatibilização arquitetônica com premissas de obra","Apoio técnico para leitura e entendimento do projeto pela equipe executora"], entregaveis:["Planta baixa executiva","Planta de locação e implantação","Planta de cobertura","Cortes e fachadas executivos","Planta de layout e pontos arquitetônicos","Planta de esquadrias e pisos","Detalhamentos construtivos","Quadro de esquadrias e quadro de áreas final"], obs:"É a etapa que transforma a ideia em construção real. Um bom projeto executivo reduz improvisos, retrabalhos e falhas de execução na obra." },
    { titulo:"5. Projetos Complementares de Engenharia", objetivo:"", itens:["Estrutural: lançamento, dimensionamento de vigas, pilares, lajes e fundações","Elétrico: dimensionamento de cargas, circuitos, quadros e pontos","Hidrossanitário: distribuição de pontos de água fria/quente, esgoto e dimensionamento","Compatibilização entre projetos arquitetônico e de engenharia para verificar possíveis interferências"], entregaveis:[], obs:"Obs.: Este item poderá ser contratado diretamente pelo cliente junto a engenheiros terceiros, ficando a compatibilização sob responsabilidade dos profissionais contratados." },
  ];

  const naoInclDefault = [
    // Etapas não selecionadas no isolamento (do preview) entram primeiro
    ...(P && P.etapasNaoIncluidas ? P.etapasNaoIncluidas : []),
    // "Projetos de Engenharia" — só quando não está em etapasNaoIncluidas
    ...(!incluiEng && !(P && P.etapasNaoIncluidas && P.etapasNaoIncluidas.some(n => n.includes("Engenharia"))) ? ["Projetos de Engenharia (Estrutural/Elétrico/Hidrossanitário)"] : []),
    // Grupo: Projetos (todos agrupados em sequência)
    "Projetos de climatização",
    "Projeto de prevenção de incêndio",
    "Projeto de automação",
    "Projeto de paisagismo",
    "Projeto de interiores",
    "Projeto de Marcenaria (Móveis internos)",
    "Projeto estrutural de estruturas metálicas",
    "Projeto estrutural de muros de contenção (>1m)",
    // Grupo: Serviços
    "Sondagem e Planialtimétrico do terreno",
    "Acompanhamento semanal de obra",
    "Gestão e execução de obra",
    "Vistoria para Caixa Econômica Federal",
    "RRT de Execução de obra",
    // Outros
    "Taxas municipais e emolumentos (CAU/Prefeitura)",
    ...(!temImp ? ["Impostos"] : []),
  ];

  const isPadrao = (orc.tipoPagamento || "padrao") !== "etapas";
  // engAtiva: considera toggle + isolamento (quando há isolamento, eng só se ela estiver isolada)
  const mostrarPrazoEng = P ? P.engAtiva : (incluiEng && (!temIsoladasPdf || idsIsoladosPdf.has(5)));
  const prazoDefault = isPadrao
    ? [...(incluiArq ? ["Prazo estimado para entrega do Projeto Arquitetônico: 30 dias úteis após aprovação do estudo preliminar."] : []),
       ...(mostrarPrazoEng ? ["Prazo estimado para entrega dos Projetos de Engenharia: 30 dias úteis após aprovação na prefeitura."] : [])]
    : [...(incluiArq || mostrarPrazoEng ? ["Prazo de 30 dias úteis por etapa, contados após conclusão e aprovação de cada etapa pelo cliente."] : []),
       ...(incluiArq || mostrarPrazoEng ? ["Concluída e aprovada cada etapa, inicia-se automaticamente o prazo da etapa seguinte."] : []),
       ...(mostrarPrazoEng ? ["Projetos de Engenharia: 30 dias úteis após aprovação do projeto na Prefeitura."] : [])];

  const etapasPdf = orc.etapasPct || [];

  // IDs das etapas ativas (1-4 = arq, 5 = eng)
  const etapasAtivas = new Set(etapasPdf.map(e => e.id));
  // Mapa etapaId -> nome personalizado (para etapas customizadas)
  const etapaNomeMap = Object.fromEntries(etapasPdf.map(e => [e.id, e.nome]));

  // Engenharia ativa? (preview manda via _preview.engAtiva; senão calcula)
  const engAtivaEscopo = P ? P.engAtiva : (incluiEng && (!temIsoladasPdf || idsIsoladosPdf.has(5)));
  // Filtra e renumera escopo — usa editado da preview se disponível
  const escopoBase = (orc.escopoEditado && orc.escopoEditado.length > 0) ? orc.escopoEditado : escopoDefault;
  const escopoFiltradoPdf = (() => {
    const blocos = escopoBase.filter((bloco, i) => {
      const etId = bloco.etapaId || (i + 1);
      const isEng = bloco.isEng || (i === 4 && !orc.escopoEditado);
      // Eng só aparece se ativa (incluiEng && [sem isolamento OU eng isolada])
      if (isEng) return engAtivaEscopo;
      if (!incluiArq) return false;
      if (temIsoladasPdf && !idsIsoladosPdf.has(etId) && !bloco.custom) return false;
      if (!etapasAtivas.has(etId) && !bloco.custom) return false;
      if (etId === 1 && isPadrao) return false;
      return true;
    });
    // Blocos customizados já vêm no escopoBase quando usa escopoEditado
    if (!orc.escopoEditado) {
      etapasPdf.forEach(et => {
        if (et.id > 5) {
          blocos.splice(blocos.length - (engAtivaEscopo ? 1 : 0), 0, {
            titulo: et.nome, objetivo:"", itens:[], entregaveis:[], obs:""
          });
        }
      });
    }
    // Renumera
    let n = 0;
    return blocos.map(b => {
      const isEng = b.isEng || (b.titulo && b.titulo.includes("Engenharia") && !b.titulo.includes("Viabilidade"));
      const tituloBase = (b.titulo||"").replace(/^\d+\.\s*/,"");
      if (!isEng) { n++; return { ...b, titulo: `${n}. ${tituloBase}` }; }
      return { ...b, titulo: `${n+1}. ${tituloBase}` };
    });
  })();

  // ── jsPDF setup ────────────────────────────────────────────
  const doc = new jsPDF({ unit:"mm", format:"a4" });
  const W=210, H=297, M=20, TW=W-2*M;
  let y = 12;

  // Helpers
  const sf  = (s,z) => { doc.setFont("helvetica",s); doc.setFontSize(z); };
  const stc = (rgb) => doc.setTextColor(...rgb);
  const sc  = (rgb,t="fill") => t==="fill" ? doc.setFillColor(...rgb) : doc.setDrawColor(...rgb);
  const tx  = (t,x,yy,o={}) => doc.text(String(t),x,yy,o);
  const hr  = (yy,x0=M,x1=W-M,w=0.3,col=[229,231,235]) => { sc(col,"draw"); doc.setLineWidth(w); doc.line(x0,yy,x1,yy); };
  const fmtB = v => "R$ "+v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtN = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});

  const INK   = [17,24,39];
  const INK_MD= [107,114,128];
  const INK_LT= [156,163,175];
  const LINE  = [229,231,235];
  const BG    = [249,250,251];

  const esc = { nome:"Padovan Arquitetos", tel:"(14) 99767-4200", email:"leopadovan.arq@gmail.com", social:"@padovan_arquitetos" };
  const hoje = new Date(orc.criadoEm || Date.now());
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const dataStr  = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
  const validade = new Date(hoje.getTime()+15*86400000).toLocaleDateString("pt-BR");

  // Nova página
  const novaPg = () => {
    doc.addPage(); y = 12;
    sc(INK); doc.rect(M,6,TW,0.5,"F");
    sf("bold",8); stc(INK); tx(esc.nome,M,12);
    sf("normal",7.5); stc(INK_LT); tx(`Proposta Comercial  ·  ${orc.cliente||""}`,W-M,12,{align:"right"});
    hr(16); y=22;
  };
  const nv = (h) => { if (y+h > H-18) novaPg(); };

  // Título de seção (label uppercase + linha horizontal — igual preview)
  // minContent: altura mínima do conteúdo que DEVE acompanhar o título (se não couber, quebra antes)
  const secTitle = (txt, mt=8, minContent=20) => {
    const yAntes = y;
    nv(10 + mt + minContent);
    // Se nv quebrou a página, y foi resetado pra 22 (topo).
    // Nesse caso, reduzir o margin-top pra evitar espaço vazio excessivo no topo.
    const quebrou = y < yAntes;
    y += quebrou ? 2 : mt;
    sf("bold",7); stc(INK_LT);
    // Calcular largura SEM charSpace primeiro, depois aplicar charSpace ao desenhar
    const tw = doc.getTextWidth(txt.toUpperCase()) + txt.length * 0.6 + 4;
    doc.setCharSpace(0.6);
    tx(txt.toUpperCase(),M,y);
    doc.setCharSpace(0);
    sc(LINE,"draw"); doc.setLineWidth(0.25); doc.line(M+tw,y-1.5,W-M,y-1.5);
    y += 6;
  };

  // Bullet item
  const bullet = (txt, x=M+3, maxW=TW-7) => {
    sf("normal",8.5); stc(INK_MD);
    const ls = doc.splitTextToSize(txt, maxW-5);
    nv(ls.length*5+2);
    sf("normal",8.5); stc(INK_MD);
    tx("•", x, y);
    ls.forEach((ln,i) => tx(ln, x+4, y+i*5));
    y += ls.length*5+1;
  };

  // ── LINHA DECORATIVA TOPO ───────────────────────────────────
  sc(INK); doc.rect(M,6,TW,0.5,"F");

  // ── LOGO ───────────────────────────────────────────────────
  let logoData = logo || null;
  if (!logoData) {
    try { const lr = await window.storage.get("escritorio-logo"); if (lr?.value) logoData = lr.value; } catch {}
  }
  {
    const qX=M, qY=8, qR=3;
    if (logoData) {
      await new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          const maxH=22, maxW=60;
          const ratio = Math.min(maxW/img.naturalWidth, maxH/img.naturalHeight);
          const qW=img.naturalWidth*ratio, qH=img.naturalHeight*ratio;
          sc(INK); doc.roundedRect(qX,qY,qW,qH,qR,qR,"F");
          doc.addImage(logoData, logoData.startsWith("data:image/png")?"PNG":"JPEG", qX,qY,qW,qH,undefined,"FAST");
          y = qY+qH+3; resolve();
        };
        img.onerror = () => resolve();
        img.src = logoData;
      });
    } else {
      y = qY + 3; // sem logo — só avança o y minimamente
    }
  }

  // Data + validade direita
  sf("normal",7.5); stc(INK_LT);
  tx(`${orc.cidade||"Ourinhos"}, ${dataStr}  ·  Válido até ${orc.validadeStr||validade}`, W-M, y, {align:"right"});
  hr(y+3);

  // Nome cliente + Arq à direita (label inline + valor)
  y += 10;
  sf("bold",18); stc(INK); tx(orc.cliente||"—", M, y);
  // Valor "Apenas Arquitetura" no canto superior direito só aparece quando eng está ATIVA
  // (senão é redundante — o valor arq já aparece logo abaixo em "ARQUITETURA")
  const engAtivaHeaderCalc = P ? P.engAtiva : (incluiEng && (!temIsoladasPdf || idsIsoladosPdf.has(5)));
  if (incluiArq && engAtivaHeaderCalc) {
    sf("bold",12); stc(INK); tx(fmtB(arqCI), W-M, y+1, {align:"right"});
    const wArqVal = doc.getTextWidth(fmtB(arqCI));
    const labelApenas = P && P.labelApenas ? P.labelApenas : "Apenas Arquitetura";
    sf("normal",6.5); stc(INK_LT); tx(labelApenas, W-M-wArqVal-3, y+1, {align:"right"});
  }

  // "Proposta Comercial..." abaixo do nome
  y += 7;
  sf("normal",7); stc(INK_LT);
  // Subtítulo: vem do preview ou calcula dinamicamente baseado em incluiArq/engAtiva
  // (engAtivaHeaderCalc já calculado acima respeita toggle + isolamento)
  const subTit = (P && P.subTitulo)
    ? P.subTitulo
    : (incluiArq && engAtivaHeaderCalc)
      ? "Proposta Comercial de Projetos de Arquitetura e Engenharia"
      : (incluiArq && !engAtivaHeaderCalc)
        ? "Proposta Comercial de Projetos de Arquitetura"
        : (!incluiArq && engAtivaHeaderCalc)
          ? "Proposta Comercial de Projetos de Engenharia"
          : "Proposta Comercial";
  tx(subTit, M, y);

  // Linha dupla separadora
  y += 6;
  sc(INK); doc.rect(M,y,TW,0.5,"F");
  y += 5;

  // Aviso de isolamento parcial — só quando tem arq isolada e nem todas estão (ANTES do resumo)
  if (P && P.avisoIsolado) {
    sf("bold",8.5); stc(INK);
    const ls = doc.splitTextToSize(P.avisoIsolado, TW);
    ls.forEach(ln => { nv(5); tx(ln,M,y); y+=4.5; }); y+=3;
  }
  // Resumo descritivo (gerado pelo defaultModelo)
  const resumoPdf = modeloPdf?.cliente?.resumo || "";
  if (resumoPdf) {
    sf("normal",8.5); stc(INK_LT);
    const ls = doc.splitTextToSize(resumoPdf, TW);
    ls.forEach(ln => { nv(5); tx(ln,M,y); y+=4.5; }); y+=2;
  }

  // ── VALORES DOS PROJETOS ───────────────────────────────────
  secTitle("Valores dos projetos", 4);

  const midX = M + TW/2;
  // Altura dinâmica: com eng precisa de mais espaço (subtítulo "Estrutural · Elétrico · Hidrossanitário")
  // Sem eng, compacta pra não deixar gap vazio acima do "Total sem impostos"
  // engAtiva: considera toggle + isolamento
  const engAtivaPdfVal = P ? P.engAtiva : (incluiEng && (!temIsoladasPdf || idsIsoladosPdf.has(5)));
  const colH = engAtivaPdfVal ? 22 : 14;
  nv(colH+4);

  // Coluna ARQ — sempre mostra valor total de arquitetura
  sf("bold",6.5); stc(INK_LT); tx("ARQUITETURA", M, y);
  sf("bold",12); stc(INK); tx(fmtB(arqCI), M, y+8);

  // Divisor vertical e coluna Engenharia — só quando engenharia está ATIVA (toggle + isolamento)
  if (engAtivaPdfVal) {
    sc(LINE,"draw"); doc.setLineWidth(0.3); doc.line(midX, y-1, midX, y+colH);
    sf("bold",6.5); stc(INK_LT); tx("ENGENHARIA", midX+4, y);
    const wEng = doc.getTextWidth("ENGENHARIA");
    sf("normal",6); stc(INK_LT); tx("(Opcional)", midX+4+wEng+2, y);
    sf("bold",12); stc(INK); tx(fmtB(engCI), midX+4, y+8);
    sf("normal",6.5); stc(INK_LT);
    tx("Estrutural · Elétrico · Hidrossanitário", midX+4, y+14);
  }

  y += colH+2;

  // Quadro cinza — sempre visível
  nv(12);
  sc(BG); doc.roundedRect(M,y,TW,8,2,2,"F");
  sf("normal",7); stc(INK_LT);
  const totCIExib = totCI;
  const impostoVExib = impostoV;
  if (temImp) {
    const itxt = `+ Impostos — ${fmtB(impostoVExib)}   ·   Total com impostos — `;
    tx(itxt, M+4, y+5.5);
    const itw = doc.getTextWidth(itxt);
    sf("bold",7.5); stc(INK); tx(fmtB(totCIExib), M+4+itw, y+5.5);
  } else {
    tx("Total sem impostos — ", M+4, y+5.5);
    const itw2 = doc.getTextWidth("Total sem impostos — ");
    sf("bold",7.5); stc(INK); tx(fmtB(totCIExib), M+4+itw2, y+5.5);
  }
  y += 12;

  // ── CONTRATAÇÃO / FORMAS DE PAGAMENTO ─────────────────────
  // Determina se vai mostrar a tabela de etapas (para decidir o título)
  const _mostrarTabela = P ? P.mostrarTabelaEtapas !== false : (orc.mostrarTabelaEtapas !== false);
  // Se padrão, sempre "Formas de pagamento"
  // Se etapas + tabela ligada: "Contratação por etapa" (depois outro "Forma de Pagamento" abaixo)
  // Se etapas + tabela desligada: "Forma de Pagamento" direto (sem título de "Contratação por etapa")
  if (isPadrao) {
    secTitle("Formas de pagamento", 8, 40);
  } else if (_mostrarTabela) {
    secTitle("Contratação por etapa", 8, 40);
  }
  // Se !isPadrao && !_mostrarTabela, o título "Forma de Pagamento" virá abaixo (em outro secTitle)

  if (!isPadrao && etapasPdf.length > 0) {
    // Engenharia ativa? (preview manda via _preview.engAtiva; senão recalcula com isolamento)
    const engAtiva = P ? P.engAtiva : (incluiEng && (!temIsoladasPdf || idsIsoladosPdf.has(5)));
    const mostrarTabela = _mostrarTabela;

    if (mostrarTabela) {
      // Tabela de etapas
      nv(14);
      const cE=M, cP=W-M-45, cV=W-M, rH=8;
      sf("bold",7.5); stc(INK);
      tx("ETAPA",cE,y); tx("%",cP,y,{align:"right"}); tx("VALOR",cV,y,{align:"right"});
      y+=2; sc(INK); doc.rect(M,y,TW,0.5,"F"); y+=rH-1;

      etapasPdf
        .filter(e => e.id !== 5)
        .filter(e => !temIsoladasPdf || idsIsoladosPdf.has(e.id))
        .forEach(et => {
          nv(rH+3);
          sf("normal",8.5); stc(INK_MD); tx(et.nome||"",cE,y);
          const arqCIBase = temImp && arqCI>0 ? Math.round(arqCI/(1-aliqImp/100)*100)/100 : arqCI;
          // Valor: se preview mandou pré-calculado, usa; senão calcula
          const valEtapa = (et.valorCalculado !== undefined)
            ? et.valorCalculado
            : Math.round(arqCIBase*(et.pct/100)*100)/100;
          sf("normal",8.5); stc(INK_LT); tx(`${et.pct}%`,cP,y,{align:"right"});
          sf("normal",8.5); stc(INK); tx(fmtB(valEtapa),cV,y,{align:"right"});
          y+=1.5; sc(LINE); doc.rect(M,y,TW,0.3,"F"); y+=rH-1;
        });

      // Linha Engenharia — só quando eng ativa (engAtiva = incluiEng && [sem isolamento OU eng isolada])
      if (engAtiva) {
        nv(rH+2);
        sf("normal",8.5); stc(INK_MD); tx("Projetos de Engenharia",cE,y);
        const wEngTxt = doc.getTextWidth("Projetos de Engenharia");
        sf("normal",6.5); stc(INK_LT); tx("— Estrutural · Elétrico · Hidrossanitário", cE+wEngTxt+2, y);
        sf("normal",8.5); stc(INK_LT); tx("—",cP,y,{align:"right"});
        sf("normal",8.5); stc(INK); tx(fmtB(engCIcom),cV,y,{align:"right"});
        y+=1.5; sc(LINE); doc.rect(M,y,TW,0.3,"F"); y+=rH-1;
      }

      // Total — ESPELHO do preview
      nv(10);
      y+=1; sc(INK); doc.rect(M,y-1,TW,0.5,"F"); y+=3;
      sf("bold",8.5); stc(INK);
      tx("Total",cE,y);
      const etapasAtivasPdf = etapasPdf.filter(e => e.id !== 5 && (!temIsoladasPdf || idsIsoladosPdf.has(e.id)));
      const pctArqAtivo = etapasAtivasPdf.reduce((s,e) => s + Number(e.pct), 0);
      // Total: preview já calcula tudo - usa totalCI direto
      let totalPdfBase;
      if (P) {
        totalPdfBase = P.totalCI;
      } else if (etapasAtivasPdf.length > 0 && etapasAtivasPdf[0].valorCalculado !== undefined) {
        const somaEtapas = etapasAtivasPdf.reduce((s,e) => s + Number(e.valorCalculado || 0), 0);
        totalPdfBase = Math.round((somaEtapas + (engAtiva ? engCIcom : 0)) * 100) / 100;
      } else {
        const arqCIBasePdf2 = temImp && arqCI>0 ? Math.round(arqCI/(1-aliqImp/100)*100)/100 : arqCI;
        totalPdfBase = Math.round((arqCIBasePdf2*(pctArqAtivo/100) + (engAtiva?engCIcom:0))*100)/100;
      }
      tx(`${pctArqAtivo}%`, cP, y, {align:"right"});
      tx(fmtB(totalPdfBase),cV,y,{align:"right"});
      y+=6;
    }

    // Condições etapa a etapa
    const dEt = orc.descontoEtapaCtrt??5, pEt = orc.parcelasEtapaCtrt??2;
    y+=2;
    // Calcula altura TOTAL da seção (Etapa a Etapa/Apenas Arq + Pacote Completo) para manter tudo junto
    const etArqAtivasPre = (orc.etapasPct || []).filter(e => e.id !== 5 && (!temIsoladasPdf || idsIsoladosPdf.has(e.id)));
    const engAtivaPre = P ? P.engAtiva : (incluiEng && (!temIsoladasPdf || idsIsoladosPdf.has(5)));
    const mostrarTabelaPdf = P ? P.mostrarTabelaEtapas !== false : (orc.mostrarTabelaEtapas !== false);
    // Pacote: toggle ligado → (multi OU arq+eng); toggle desligado → só arq+eng
    const multiPre = etArqAtivasPre.length > 1;
    const arqEngPre = incluiArq && engAtivaPre && etArqAtivasPre.length > 0;
    const mostraPacotePre = mostrarTabelaPdf ? (multiPre || arqEngPre) : arqEngPre;
    // Etapa a Etapa: título(7) + op1(5+4) + op2(5) + hr(11) = 29 (COMPACTO com respiro antes do Pacote)
    // Apenas Arq (toggle off): título(8) + op1 arejado(5+6+4) + op2(5+5) + hr(8) = 36 (AREJADO)
    const alturaPrimeiro = mostrarTabelaPdf ? 29 : 36;
    // Pacote Completo: compacto(28) quando tem tabela, arejado(36) quando não
    const alturaPacote = mostraPacotePre ? (mostrarTabelaPdf ? 28 : 36) : 0;
    const alturaTotalFormaPgto = alturaPrimeiro + alturaPacote + 6;
    secTitle("Forma de Pagamento", 8, alturaTotalFormaPgto);

    if (mostrarTabelaPdf) {
      // Bloco "Etapa a Etapa" (toggle LIGADO)
      sf("bold",8.5); stc(INK); tx("Etapa a Etapa",M,y);
      sf("normal",6.5); stc(INK_LT); tx("Obs.: Nesta opção valores de etapas futuras podem ser reajustados.",W-M,y,{align:"right"});
      y+=7;
      // Opção 1 — Antecipado por etapa (uma linha)
      const op1LabelEt = `Opção 1: `;
      sf("bold",8.5); stc(INK_MD); tx(op1LabelEt, M+2, y);
      const wOp1Et = doc.getTextWidth(op1LabelEt);
      sf("normal",8.5); stc(INK_MD); tx(`Cada etapa paga antecipadamente com ${dEt}% de desconto.`, M+2+wOp1Et, y);
      y+=5; sc(LINE); doc.rect(M+2, y-2, TW-4, 0.3, "F"); y+=4;
      // Opção 2 — Parcelado por etapa (uma linha)
      const op2LabelEt = `Opção 2: `;
      sf("bold",8.5); stc(INK_MD); tx(op2LabelEt, M+2, y);
      const wOp2Et = doc.getTextWidth(op2LabelEt);
      sf("normal",8.5); stc(INK_MD);
      if (pEt > 1) {
        const fraseOp2 = `Cada etapa parcelada em ${pEt}× (entrada + ${pEt-1}× ao longo da etapa).`;
        tx(fraseOp2, M+2+wOp2Et, y);
        const wFraseOp2 = doc.getTextWidth(fraseOp2);
        sf("normal",6.5); stc(INK_LT); tx("sem desconto", M+2+wOp2Et+wFraseOp2+3, y);
      } else {
        tx(`Cada etapa paga à vista no início.`, M+2+wOp2Et, y);
      }
      hr(y+3); y+=11;
    } else {
      // Toggle DESLIGADO: renderiza "Apenas Arquitetura" igual Pagamento Padrão
      // Valor: subTotalArqEtapas (só arq selecionada, sem eng)
      const valorApenasArq = P && P.subTotalArqEtapas !== undefined ? P.subTotalArqEtapas : arqCIcom;
      const dArq = orc.descontoEtapa??5, pArq = orc.parcelasEtapa??3;
      const tDescArq = Math.round(valorApenasArq*(1-dArq/100)*100)/100;
      const labelApenasPgto = P && P.labelApenas ? P.labelApenas : "Apenas Arquitetura";
      sf("bold",8.5); stc(INK); tx(labelApenasPgto,M,y); y+=8;
      // Opção 1 — subtítulo cinza pequeno + valor destacado embaixo
      sf("bold",8); stc(INK_MD); tx("Opção 1", M+2, y);
      const wOp1LabApA = doc.getTextWidth("Opção 1");
      sf("normal",7); stc(INK_LT); tx(` · Pagamento antecipado com ${dArq}% de desconto`, M+2+wOp1LabApA, y); y+=5;
      const yOp1ApA = y;
      const labelOp1ApA = `De ${fmtB(valorApenasArq)} por apenas:`;
      sf("normal",8.5); stc(INK_MD); tx(labelOp1ApA, M+2, yOp1ApA);
      const wLabelOp1ApA = doc.getTextWidth(labelOp1ApA);
      sf("bold",10); stc(INK); tx(fmtB(tDescArq), M+2+wLabelOp1ApA+4, yOp1ApA);
      y = yOp1ApA + 6;
      sc(LINE); doc.rect(M+2, y-2, TW-4, 0.3, "F"); y+=4;
      // Opção 2
      sf("bold",8); stc(INK_MD); tx("Opção 2", M+2, y);
      const wOp2LabApA = doc.getTextWidth("Opção 2");
      sf("normal",7); stc(INK_LT);
      if (pArq > 1) {
        tx(` · Parcelado em ${pArq}× sem desconto`, M+2+wOp2LabApA, y);
      } else {
        tx(` · À vista`, M+2+wOp2LabApA, y);
      }
      y+=5;
      sf("normal",8.5); stc(INK_MD);
      if (pArq > 1) {
        const parcValArq = Math.round(valorApenasArq/pArq*100)/100;
        tx(`Entrada de ${fmtB(parcValArq)} + ${pArq-1}× de ${fmtB(parcValArq)}`, M+2, y);
      } else {
        tx(`${fmtB(valorApenasArq)}`, M+2, y);
      }
      hr(y+3); y+=8;
    }

    // Pacote completo etapas — mesma lógica do preview:
    // Toggle LIGADO: pacote aparece se (multiEtapas OU arq+eng)
    // Toggle DESLIGADO: pacote aparece SÓ se arq+eng (senão fica só o bloco "Apenas Arq")
    const etArqAtivas = (orc.etapasPct || []).filter(e => e.id !== 5 && (!temIsoladasPdf || idsIsoladosPdf.has(e.id)));
    const engAtivaPdf = P ? P.engAtiva : (incluiEng && (!temIsoladasPdf || idsIsoladosPdf.has(5)));
    const multiEtapasPdf = etArqAtivas.length > 1;
    const temArqEEngPdf = incluiArq && engAtivaPdf && etArqAtivas.length > 0;
    const mostraPacote = mostrarTabelaPdf
      ? (multiEtapasPdf || temArqEEngPdf)
      : temArqEEngPdf;
    if (mostraPacote) {
      // Valor do pacote vem do preview (espelho) ou recalcula
      const totalPacote = P && P.totalPacoteEtapas !== undefined ? P.totalPacoteEtapas : totCI;
      const dPac=orc.descontoPacoteCtrt??15, pPac=orc.parcelasPacoteCtrt??8;
      const tDescP=Math.round(totalPacote*(1-dPac/100)*100)/100;
      // Label dinâmico igual preview
      const labelPacotePdf = (incluiArq && engAtivaPdf)
        ? "Pacote Completo (Arq. + Eng.)"
        : "Pacote Completo";

      if (mostrarTabelaPdf) {
        // COMPACTO: quando há tabela acima, poupa espaço na página
        sf("bold",8.5); stc(INK); tx(labelPacotePdf,M,y); y+=7;
        // Opção 1 em uma linha
        const op1LabelPac = `Opção 1: `;
        sf("bold",8.5); stc(INK_MD); tx(op1LabelPac, M+2, y);
        const wOp1LabPac = doc.getTextWidth(op1LabelPac);
        const fraseOp1Pac = `Pagamento antecipado com ${dPac}% de desconto — de ${fmtB(totalPacote)} por `;
        sf("normal",8.5); stc(INK_MD); tx(fraseOp1Pac, M+2+wOp1LabPac, y);
        const wFraseOp1Pac = doc.getTextWidth(fraseOp1Pac);
        sf("bold",9.5); stc(INK); tx(fmtB(tDescP), M+2+wOp1LabPac+wFraseOp1Pac, y);
        y+=5; sc(LINE); doc.rect(M+2, y-2, TW-4, 0.3, "F"); y+=4;
        // Opção 2 em uma linha
        const op2LabelPac = `Opção 2: `;
        sf("bold",8.5); stc(INK_MD); tx(op2LabelPac, M+2, y);
        const wOp2LabPac = doc.getTextWidth(op2LabelPac);
        sf("normal",8.5); stc(INK_MD);
        if (pPac > 1) {
          const parcValPac = Math.round(totalPacote/pPac*100)/100;
          const fraseOp2Pac = `Parcelado em ${pPac}× — entrada de ${fmtB(parcValPac)} + ${pPac-1}× de ${fmtB(parcValPac)}.`;
          tx(fraseOp2Pac, M+2+wOp2LabPac, y);
          const wFraseOp2Pac = doc.getTextWidth(fraseOp2Pac);
          sf("normal",6.5); stc(INK_LT); tx("sem desconto", M+2+wOp2LabPac+wFraseOp2Pac+3, y);
        } else {
          tx(`À vista — ${fmtB(totalPacote)}`, M+2+wOp2LabPac, y);
        }
        hr(y+3); y+=7;
      } else {
        // AREJADO: sem tabela acima, pode ser mais espaçoso e destacar o valor
        sf("bold",8.5); stc(INK); tx(labelPacotePdf,M,y); y+=8;
        // Opção 1 — subtítulo + valor destacado
        sf("bold",8); stc(INK_MD); tx("Opção 1", M+2, y);
        const wOp1LabPac = doc.getTextWidth("Opção 1");
        sf("normal",7); stc(INK_LT); tx(` · Pagamento antecipado com ${dPac}% de desconto`, M+2+wOp1LabPac, y); y+=5;
        const yOp1Pac = y;
        const labelOp1Pac = `De ${fmtB(totalPacote)} por apenas:`;
        sf("normal",8.5); stc(INK_MD); tx(labelOp1Pac, M+2, yOp1Pac);
        const wLabelOp1Pac = doc.getTextWidth(labelOp1Pac);
        sf("bold",10); stc(INK); tx(fmtB(tDescP), M+2+wLabelOp1Pac+4, yOp1Pac);
        y = yOp1Pac + 6;
        sc(LINE); doc.rect(M+2, y-2, TW-4, 0.3, "F"); y+=4;
        // Opção 2
        sf("bold",8); stc(INK_MD); tx("Opção 2", M+2, y);
        const wOp2LabPac = doc.getTextWidth("Opção 2");
        sf("normal",7); stc(INK_LT);
        if (pPac > 1) {
          tx(` · Parcelado em ${pPac}× sem desconto`, M+2+wOp2LabPac, y);
        } else {
          tx(` · À vista`, M+2+wOp2LabPac, y);
        }
        y+=5;
        sf("normal",8.5); stc(INK_MD);
        if (pPac > 1) {
          const parcValPac = Math.round(totalPacote/pPac*100)/100;
          tx(`Entrada de ${fmtB(parcValPac)} + ${pPac-1}× de ${fmtB(parcValPac)}`, M+2, y);
        } else {
          tx(`${fmtB(totalPacote)}`, M+2, y);
        }
        hr(y+3); y+=8;
      }
    }

  } else {
    const dA=orc.descontoEtapa??5, pA=orc.parcelasEtapa??3;
    const tDescA=Math.round(arqCIcom*(1-dA/100)*100)/100;
    nv(25);
    const labelApenasPgto = P && P.labelApenas ? P.labelApenas : "Apenas Arquitetura";
    sf("bold",8.5); stc(INK); tx(labelApenasPgto,M,y); y+=8;

    // Opção 1 — antecipado com desconto
    sf("bold",8); stc(INK_MD); tx("Opção 1", M+2, y);
    const wOp1LabPad = doc.getTextWidth("Opção 1");
    sf("normal",7); stc(INK_LT); tx(` · Pagamento antecipado com ${dA}% de desconto`, M+2+wOp1LabPad, y); y+=5;
    const yOp1A = y;
    const labelOp1A = `De ${fmtB(arqCIcom)} por apenas:`;
    sf("normal",8.5); stc(INK_MD); tx(labelOp1A, M+2, yOp1A);
    const wLabelOp1A = doc.getTextWidth(labelOp1A);
    sf("bold",10); stc(INK); tx(fmtB(tDescA), M+2+wLabelOp1A+4, yOp1A);
    y = yOp1A + 6;

    // Divisória fina
    sc(LINE); doc.rect(M+2, y-2, TW-4, 0.3, "F");
    y += 4;

    // Opção 2
    sf("bold",8); stc(INK_MD); tx("Opção 2", M+2, y);
    const wOp2LabPad = doc.getTextWidth("Opção 2");
    sf("normal",7); stc(INK_LT);
    if (pA > 1) {
      tx(` · Parcelado em ${pA}× sem desconto`, M+2+wOp2LabPad, y);
    } else {
      tx(` · À vista`, M+2+wOp2LabPad, y);
    }
    y+=5;
    sf("normal",8.5); stc(INK_MD);
    if (pA > 1) {
      const parcValA = Math.round(arqCIcom/pA*100)/100;
      tx(`Entrada de ${fmtB(parcValA)} + ${pA-1}× de ${fmtB(parcValA)}`, M+2, y);
    } else {
      tx(`${fmtB(arqCIcom)}`, M+2, y);
    }
    hr(y+3); y+=8;

    if (incluiArq && incluiEng) {
      const dP=orc.descontoPacote??10, pP=orc.parcelasPacote??4;
      const tDescPad=Math.round(totCI*(1-dP/100)*100)/100;
      sf("bold",8.5); stc(INK); tx("Pacote Completo (Arq. + Eng.)",M,y); y+=8;

      // Opção 1
      sf("bold",8); stc(INK_MD); tx("Opção 1", M+2, y);
      const wOp1LabPP = doc.getTextWidth("Opção 1");
      sf("normal",7); stc(INK_LT); tx(` · Pagamento antecipado com ${dP}% de desconto`, M+2+wOp1LabPP, y); y+=5;
      const yOp1P = y;
      const labelOp1P = `De ${fmtB(totCI)} por apenas:`;
      sf("normal",8.5); stc(INK_MD); tx(labelOp1P, M+2, yOp1P);
      const wLabelOp1P = doc.getTextWidth(labelOp1P);
      sf("bold",10); stc(INK); tx(fmtB(tDescPad), M+2+wLabelOp1P+4, yOp1P);
      y = yOp1P + 6;

      // Divisória fina
      sc(LINE); doc.rect(M+2, y-2, TW-4, 0.3, "F");
      y += 4;

      // Opção 2
      sf("bold",8); stc(INK_MD); tx("Opção 2", M+2, y);
      const wOp2LabPP = doc.getTextWidth("Opção 2");
      sf("normal",7); stc(INK_LT);
      if (pP > 1) {
        tx(` · Parcelado em ${pP}× sem desconto`, M+2+wOp2LabPP, y);
      } else {
        tx(` · À vista`, M+2+wOp2LabPP, y);
      }
      y+=5;
      sf("normal",8.5); stc(INK_MD);
      if (pP > 1) {
        const parcValP = Math.round(totCI/pP*100)/100;
        tx(`Entrada de ${fmtB(parcValP)} + ${pP-1}× de ${fmtB(parcValP)}`, M+2, y);
      } else {
        tx(`${fmtB(totCI)}`, M+2, y);
      }
      hr(y+3); y+=8;
    }
  }

  // PIX
  sf("normal",8); stc(INK_LT);
  tx(orc.pixTexto || "PIX  ·  Chave CNPJ: 36.122.417/0001-74 — Leo Padovan Projetos e Construções  ·  Banco Sicoob",M,y);
  y+=8;

  // ── ESCOPO DOS SERVIÇOS ───────────────────────────────────
  secTitle("Escopo dos serviços", 8, 30);

  escopoFiltradoPdf.forEach((bloco,bi) => {
    nv(16);
    sf("bold",9.5); stc(INK); tx(bloco.titulo,M,y); y+=6;

    const tagPdf = (txt) => {
      doc.setCharSpace(0.5);
      sf("bold",7); stc(INK_LT); tx(txt.toUpperCase(),M,y);
      doc.setCharSpace(0);
      y+=5;
    };

    if (bloco.objetivo) {
      tagPdf("Objetivo");
      sf("normal",8.5); stc(INK_MD);
      const ls = doc.splitTextToSize(bloco.objetivo, TW);
      ls.forEach(ln => { nv(5); tx(ln,M,y); y+=4.5; }); y+=2;
    }

    if (bloco.itens && bloco.itens.length) {
      tagPdf("Serviços inclusos");
      bloco.itens.forEach(it => bullet(it));
      y+=2;
    }

    if (bloco.entregaveis && bloco.entregaveis.length) {
      tagPdf("Entregáveis");
      bloco.entregaveis.forEach(it => bullet(it));
      y+=2;
    }

    if (bloco.obs) {
      sf("normal",7.5); stc(INK_LT);
      const ls = doc.splitTextToSize(bloco.obs, TW);
      ls.forEach(ln => { nv(5); tx(ln,M,y); y+=4; }); y+=2;
    }

    if (bi < escopoFiltradoPdf.length-1) { nv(4); sc(LINE,"draw"); doc.setLineWidth(0.2); doc.line(M,y,W-M,y); y+=5; }
  });

  // ── SERVIÇOS NÃO INCLUSOS — 2 colunas independentes ──────
  const halfW = TW/2-8;
  // Se preview mandou custom, usa ele (converte {label,sub} → string); senão usa default do PDF
  const naoInclFinal = (P && P.naoInclCustom && P.naoInclCustom.length > 0)
    ? P.naoInclCustom.map(it => it.sub ? `${it.label} ${it.sub}` : it.label)
    : naoInclDefault;
  const col1 = naoInclFinal.filter((_,i) => i%2===0);
  const col2 = naoInclFinal.filter((_,i) => i%2===1);
  // IMPORTANTE: setar fonte normal ANTES do splitTextToSize pra cálculo de altura bater com renderização
  // Fonte reduzida (7.5) pra caber itens longos em 1 linha
  sf("normal",7.5);
  const heights1 = col1.map(t => doc.splitTextToSize(t, halfW-6).length * 4 + 2);
  const heights2 = col2.map(t => doc.splitTextToSize(t, halfW-6).length * 4 + 2);
  // Altura TOTAL de toda a lista — passa ao secTitle pra garantir que título + lista completa
  // fiquem na MESMA PÁGINA. Se não couber, quebra página ANTES do título.
  const alturaListaTotal = Math.max(
    heights1.reduce((s,h)=>s+h,0),
    heights2.reduce((s,h)=>s+h,0)
  );
  // +10 pra margem/obs final
  secTitle("Serviços não inclusos", 8, alturaListaTotal + 10);
  // Re-aplica fonte normal (secTitle usou bold)
  sf("normal",7.5);
  const totalH = alturaListaTotal;
  nv(totalH);
  const yStart = y;
  let y1 = yStart, y2 = yStart;
  stc(INK_MD);
  col1.forEach((txt, i) => {
    sf("normal",7.5); // garante normal antes de splitar e desenhar
    const ls = doc.splitTextToSize(txt, halfW-6);
    nv(heights1[i]);
    sf("normal",7.5); // re-seta após possível nova página
    tx("•", M+1, y1);
    ls.forEach((ln, li) => tx(ln, M+5, y1+li*4));
    y1 += heights1[i];
  });
  col2.forEach((txt, i) => {
    sf("normal",7.5); // garante normal
    const ls = doc.splitTextToSize(txt, halfW-6);
    tx("•", midX+1, y2);
    ls.forEach((ln, li) => tx(ln, midX+5, y2+li*4));
    y2 += heights2[i];
  });
  y = Math.max(y1, y2);
  nv(6);
  sf("normal",7.5); stc(INK_LT);
  tx("Obs: Todos os serviços não inclusos podem ser contratados como serviços adicionais.",M,y); y+=8;

  // ── PRAZO DE EXECUÇÃO ─────────────────────────────────────
  secTitle("Prazo de execução", 8, 20);
  const prazoFinal = ((P && P.prazoCustom && P.prazoCustom.length > 0) ? P.prazoCustom : prazoDefault)
    .filter(p => {
      // Remove linhas que mencionam engenharia quando engenharia não está ativa
      if (p.toLowerCase().includes("engenharia") && !mostrarPrazoEng) return false;
      return true;
    });
  prazoFinal.forEach(p => bullet(p));
  y+=4;

  // ── ACEITE DA PROPOSTA ────────────────────────────────────
  nv(55);
  secTitle("Aceite da proposta", 8, 40);

  const halfAc = TW/2-10;
  // Cliente
  sf("bold",7); stc(INK_LT); tx("CLIENTE",M,y); y+=5;
  sf("bold",10); stc(INK); tx(orc.cliente||"—",M,y); y+=16;
  hr(y,M,M+halfAc); sf("normal",7); stc(INK_LT);
  tx("Assinatura",M,y+4);
  tx("Data: _____ / _____ / _______",M+halfAc,y+4,{align:"right"});

  // Responsável
  const rx = midX+4;
  y -= 21;
  sf("bold",7); stc(INK_LT); tx("RESPONSÁVEL TÉCNICO",rx,y); y+=5;
  sf("bold",10); stc(INK); tx("Arq. Leonardo Padovan",rx,y); y+=5;
  sf("normal",7.5); stc(INK_LT); tx("CAU A30278-3  ·  Ourinhos",rx,y); y+=11;
  hr(y,rx,W-M); sf("normal",7); stc(INK_LT);
  tx("Assinatura",rx,y+4);
  tx(dataStr,W-M,y+4,{align:"right"});
  y+=14;

  // ── RODAPÉ (todas as páginas) ─────────────────────────────
  const totalPgs = doc.getNumberOfPages();
  const rodTxt = `Padovan Arquitetos  ·  leopadovan.arq@gmail.com  ·  (14) 99767-4200  ·  @padovan_arquitetos`;
  for (let pg=1; pg<=totalPgs; pg++) {
    doc.setPage(pg);
    sc(LINE,"draw"); doc.setLineWidth(0.3); doc.line(M,H-14,W-M,H-14);
    sf("normal",6.5); stc(INK_LT);
    tx(rodTxt,M,H-10);
    tx(`${pg} / ${totalPgs}`,W-M-12,H-10,{align:"right"});
    // QR na última página
    if (pg===totalPgs) {
      const qx=W-M-9, qy=H-13, qs=8;
      sc([255,255,255]); doc.rect(qx-0.5,qy-0.5,qs+1,qs+1,"F");
      sc(INK);
      // 3 quadrados de canto
      doc.rect(qx,qy,3,3,"F"); doc.rect(qx+qs-3,qy,3,3,"F"); doc.rect(qx,qy+qs-3,3,3,"F");
      // interiores
      doc.rect(qx+1,qy+1,1,1,"F"); doc.rect(qx+qs-2,qy+1,1,1,"F"); doc.rect(qx+1,qy+qs-2,1,1,"F");
      // pixels centrais
      doc.rect(qx+4,qy+1,1,1,"F"); doc.rect(qx+6,qy+1,1,1,"F");
      doc.rect(qx+4,qy+3,1,1,"F"); doc.rect(qx+6,qy+4,1,1,"F");
      doc.rect(qx+4,qy+5,1,1,"F"); doc.rect(qx+6,qy+6,1,1,"F");
      doc.rect(qx+qs-2,qy+4,1,1,"F"); doc.rect(qx+qs-2,qy+6,1,1,"F");
    }
  }

  // Download
  const blob = doc.output("blob");
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `proposta-${(orc.cliente||"projeto").replace(/\s+/g,"-").toLowerCase()}.pdf`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function defaultModelo(orc, arqTotal, engTotal, grandTotal, fmt, fmtM2, nUnid, engUnit, r) {
  const dataEmissao = new Date(orc.criadoEm).toLocaleDateString("pt-BR",{day:"numeric",month:"long",year:"numeric"});
  const validade    = new Date(new Date(orc.criadoEm).getTime()+15*86400000).toLocaleDateString("pt-BR");
  const comodosAtivos = (orc.comodos||[]).filter(c=>c.qtd>0);
  const totalComodos  = comodosAtivos.reduce((s,c)=>s+c.qtd,0);
  return {
    escritorio:   { nome:"Padovan Arquitetos", cidade:"Ourinhos — SP", tel:"(14) 99767-4200", email:"leopadovan.arq@gmail.com", social:"@padovan_arquitetos" },
    titulo:       "Projeto de Arquitetura e Engenharia",
    subtitulo:    "Proposta Comercial",
    dataEmissao,
    validade,
    cliente:      { nome: orc.cliente||"—", tipoObra:`${orc.tipo} — ${orc.subtipo}`, resumo: (() => {
        const subtipo = orc.subtipo || "Construção nova";
        const tipologia = (orc.tipologia||"térrea").toLowerCase();
        const fmtArea = (m2) => m2 > 0 ? m2.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+"m²" : null;

        if (orc.tipo === "Comercial") {
          const partes = [];
          if ((r.nLojas||0) > 0)
            partes.push(`${r.nLojas} loja${r.nLojas!==1?"s":""} (${fmtArea(r.m2Loja1 * r.nLojas)})`);
          if ((r.nAncoras||0) > 0)
            partes.push(`${r.nAncoras} ${r.nAncoras===1?"Espaço Âncora":"Espaços Âncoras"} (${fmtArea(r.m2Anc1 * r.nAncoras)})`);
          if ((r.nApartamentos||0) > 0)
            partes.push(`${r.nApartamentos} apartamento${r.nApartamentos!==1?"s":""} (${fmtArea(r.m2Apto1 * r.nApartamentos)})`);
          if ((r.nGalpoes||0) > 0)
            partes.push(`${r.nGalpoes} ${r.nGalpoes!==1?"galpões":"galpão"} (${fmtArea(r.m2Galpao1 * r.nGalpoes)})`);
          if ((r.atComum||0) > 0)
            partes.push(`Área Comum (${fmtArea(r.atComum)})`);
          const lista = partes.length > 1
            ? partes.slice(0,-1).join(", ") + " e " + partes[partes.length-1]
            : partes[0] || "";
          return `Conjunto comercial, contendo ${lista}, totalizando ${fmtArea(r.areaTotal)}.`;
        }

        if (orc.tipo === "Galpao") {
          const comAtivos = (orc.comodos||[]).filter(c=>c.qtd>0).map(c=>c.nome).join(", ");
          const areaUni = r.areaTotal || 0;
          const nUn = r.nUnidades || 1;
          const areaTotal = Math.round(areaUni * nUn * 100)/100;
          const fmtN = (n) => n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
          if (nUn > 1) {
            return `${nUn} galpões idênticos, com ${fmtN(areaUni)}m² de área por unidade, totalizando ${fmtN(areaTotal)}m². Cada unidade contendo: ${comAtivos}.`;
          }
          return `Galpão — ${subtipo}, com ${fmtArea(r.areaBruta)} de área útil (${fmtArea(r.areaTotal)} com circulação), contendo: ${comAtivos}.`;
        }

        // Residencial / Clínica — descrição humanizada
        const nUnidades = r.nUnidades || 1;
        const comodos = (orc.comodos||[]).filter(c=>c.qtd>0);
        const totalAmb = comodos.reduce((s,c)=>s+c.qtd,0);
        const areaUni = r.areaTotal || 0;
        const areaTot = Math.round(areaUni * nUnidades * 100)/100;
        const fmtN = (n) => n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});

        // Converte número em palavra para concordância
        const numPorExtenso = (n, genero="m") => {
          const masc = ["","um","dois","três","quatro","cinco","seis","sete","oito","nove","dez"];
          const fem  = ["","uma","duas","três","quatro","cinco","seis","sete","oito","nove","dez"];
          if (n >= 1 && n <= 10) return genero === "f" ? fem[n] : masc[n];
          return String(n);
        };

        // Formata lista de ambientes de forma humanizada
        const pluraisIrreg = {
          "garagem":"garagens","suíte":"suítes","lavabo":"lavabos","closet":"closets",
          "wc":"WCs","hall de entrada":"halls de entrada","sala tv":"salas de TV",
          "sala de tv":"salas de TV","living":"livings","cozinha":"cozinhas",
          "lavanderia":"lavanderias","depósito":"depósitos","escritório":"escritórios",
          "sala de jantar":"salas de jantar","área de lazer":"áreas de lazer",
          "piscina":"piscinas","sauna":"saunas","academia":"academias",
          "brinquedoteca":"brinquedotecas","closet suíte":"closets suíte",
          "suíte master":"suítes master","escada":"escadas","varanda":"varandas",
          "quarto":"quartos","banheiro":"banheiros","corredor":"corredores",
          "sala":"salas","estúdio":"estúdios","terraço":"terraços",
        };
        const pluralAmb = (nome, qtd) => {
          const key = nome.toLowerCase();
          if (qtd === 1) return key;
          return pluraisIrreg[key] || `${key}s`;
        };
        // Gênero dos ambientes para concordância
        const generoAmb = {
          "garagem":"f","suíte":"f","lavanderia":"f","academia":"f","brinquedoteca":"f",
          "sauna":"f","escada":"f","varanda":"f","sala tv":"f","sala de tv":"f",
          "sala de jantar":"f","área de lazer":"f","piscina":"f","cozinha":"f",
          "wc":"m","closet":"m","hall de entrada":"m","living":"m","depósito":"m",
          "escritório":"m","lavabo":"m","banheiro":"m","quarto":"m","terraço":"m",
          "closet suíte":"m","estúdio":"m","corredor":"m",
        };
        const listaAmb = comodos.map(c => {
          const key = c.nome.toLowerCase();
          if (c.qtd === 1) return key;
          // Garagem: caso especial
          if (key === "garagem") return `garagem com ${c.qtd === 1 ? "uma vaga" : `${numPorExtenso(c.qtd, "f")} vagas`}`;
          const gen = generoAmb[key] || "m";
          return `${numPorExtenso(c.qtd, gen)} ${pluralAmb(c.nome, c.qtd)}`;
        });
        const listaStr = listaAmb.length > 1
          ? listaAmb.slice(0,-1).join(", ") + " e " + listaAmb[listaAmb.length-1]
          : listaAmb[0] || "";

        const padrao  = (orc.padrao||"médio").toLowerCase();
        const isClinica = orc.tipo === "Clínica";

        // Tipologia humanizada
        const tipMap = {
          "térrea":"térrea","térreo":"térrea",
          "sobrado":"com dois pavimentos",
          "apartamento":"em apartamento","cobertura":"em cobertura",
        };
        const tipDesc = tipMap[tipologia] || tipologia;

        // Número por extenso feminino para unidades
        const numFem = ["","uma","duas","três","quatro","cinco","seis","sete","oito","nove","dez"];
        const nExt = nUnidades >= 1 && nUnidades <= 10 ? numFem[nUnidades] : String(nUnidades);

        if (nUnidades > 1) {
          const tipoPlural = isClinica ? "clínicas" : "residências";
          return `${nExt.charAt(0).toUpperCase()+nExt.slice(1)} ${tipoPlural} ${tipDesc} idênticas, com ${fmtN(areaUni)}m² por unidade, totalizando ${fmtN(areaTot)}m² de área construída. Cada unidade composta por ${totalAmb} ambientes: ${listaStr}.`;
        }
        const tipoSing = isClinica ? "clínica" : "residência";
        return `Uma ${tipoSing} ${tipDesc}, com ${fmtN(areaUni)}m² de área construída, composta por ${totalAmb} ambientes: ${listaStr}.`;
      })(), responsavel:"Arq. Leonardo Padovan · CAU A30278-3" },
    servicos: [
      { id:1, descricao:`Projeto Arquitetônico${nUnid>1?" ("+nUnid+" unidades)":""}`, sub: nUnid>1?`1ª unidade: ${fmt(r.precoFinal)}`:"", valor: arqTotal },
      { id:2, descricao:`Projetos de Engenharia${nUnid>1?" ("+nUnid+" unidades)":""}`, sub:`Estrutural · Elétrico · Hidrossanitário${nUnid>1?" — 1ª unidade: "+fmt(engUnit):""}`, valor: engTotal },
    ],
    pagamento: {
      pix: "Chave CNPJ: 36.122.417/0001-74 — Leo Padovan Projetos e Construções",
      banco: "Banco Sicoob",
      tipoPagamento: orc.tipoPagamento || "padrao",
      descontoEtapa:      orc.descontoEtapa      ?? 5,
      descontoPacote:     orc.descontoPacote     ?? 10,
      parcelasEtapa:      orc.parcelasEtapa      ?? 3,
      parcelasPacote:     orc.parcelasPacote     ?? 4,
      descontoEtapaCtrt:  orc.descontoEtapaCtrt  ?? 5,
      parcelasEtapaCtrt:  orc.parcelasEtapaCtrt  ?? 2,
      descontoPacoteCtrt: orc.descontoPacoteCtrt ?? 15,
      parcelasPacoteCtrt: orc.parcelasPacoteCtrt ?? 8,
      etapasPct: orc.etapasPct || [
        { id:1, nome:"Estudo de Viabilidade", pct:10 },
        { id:2, nome:"Estudo Preliminar",     pct:40 },
        { id:3, nome:"Aprovação Prefeitura",  pct:12 },
        { id:4, nome:"Projeto Executivo",     pct:38 },
      ],
      opcoes: [
        { id:1, titulo:"Apenas Arquitetura", base: arqTotal, descAntec: orc.descontoEtapa??5, nParcelas: orc.parcelasEtapa??3 },
        { id:2, titulo:"Pacote Completo (Arq. + Eng.)", base: grandTotal, descAntec: orc.descontoPacote??10, nParcelas: orc.parcelasPacote??4 },
      ]
    },
    escopo: [
      { id:1, titulo:"1. Estudo Preliminar",
        objetivo:"Desenvolver o conceito arquitetônico inicial, organizando os ambientes, a implantação e a linguagem estética do projeto.",
        itens:["Reunião de briefing e entendimento das necessidades do cliente","Definição do programa de necessidades","Estudo de implantação da edificação no terreno","Desenvolvimento da concepção arquitetônica inicial","Definição preliminar de: layout, fluxos, volumetria, setorização e linguagem estética","Compatibilização entre funcionalidade, conforto, estética e viabilidade construtiva","Ajustes conforme alinhamento com o cliente"],
        entregaveis:["Planta baixa preliminar","Estudo volumétrico / fachada conceitual","Implantação inicial","Imagens, croquis ou perspectivas conceituais","Apresentação para validação do conceito arquitetônico"],
        obs:"É nesta etapa que o projeto ganha forma. O estudo preliminar define a essência da proposta e orienta todas as fases seguintes." },
      { id:2, titulo:"2. Aprovação na Prefeitura",
        objetivo:"Adequar e preparar o projeto arquitetônico para protocolo e aprovação junto aos órgãos públicos competentes.",
        itens:["Adequação do projeto às exigências legais e urbanísticas do município","Elaboração dos desenhos técnicos exigidos para aprovação","Montagem da documentação técnica necessária ao processo","Inserção de informações obrigatórias conforme normas municipais","Preparação de pranchas, quadros de áreas e demais peças gráficas","Apoio técnico durante o processo de aprovação","Atendimento a eventuais comunique-se ou exigências técnicas da prefeitura"],
        entregaveis:["Projeto legal para aprovação","Plantas, cortes, fachadas e implantação conforme exigência municipal","Quadros de áreas","Arquivos e documentação técnica para protocolo"],
        obs:"Não inclusos nesta etapa: taxas municipais, emolumentos, ART/RRT, levantamentos complementares, certidões e exigências extraordinárias de órgãos externos, salvo se expressamente previsto." },
      { id:3, titulo:"3. Projeto Executivo",
        objetivo:"Desenvolver o projeto arquitetônico em nível detalhado para execução da obra, fornecendo todas as informações necessárias para construção com precisão.",
        itens:["Desenvolvimento técnico completo do projeto aprovado","Detalhamento arquitetônico para obra","Definição precisa de: dimensões, níveis, cotas, eixos, paginações, esquadrias, acabamentos e elementos construtivos","Elaboração de desenhos técnicos executivos","Compatibilização arquitetônica com premissas de obra","Apoio técnico para leitura e entendimento do projeto pela equipe executora"],
        entregaveis:["Planta baixa executiva","Planta de locação e implantação","Planta de cobertura","Cortes e fachadas executivos","Planta de layout e pontos arquitetônicos","Planta de esquadrias e pisos","Detalhamentos construtivos","Quadro de esquadrias e quadro de áreas final"],
        obs:"É a etapa que transforma a ideia em construção real. Um bom projeto executivo reduz improvisos, retrabalhos e falhas de execução na obra." },
    ],
    escopoEtapas: [
      { id:1, titulo:"1. Estudo de Viabilidade",
        objetivo:"Analisar o potencial construtivo do terreno e verificar a viabilidade de implantação do empreendimento, considerando as condicionantes físicas, urbanísticas, legais e funcionais aplicáveis ao lote.",
        itens:["Levantamento inicial e consolidação das informações técnicas do terreno", "Análise documental e física do lote, incluindo matrícula, dimensões, topografia e características existentes", "Consulta e interpretação dos parâmetros urbanísticos e restrições legais aplicáveis", "Verificação da viabilidade construtiva, considerando taxa de ocupação, coeficiente de aproveitamento, recuos obrigatórios, gabarito de altura e demais condicionantes normativas", "Estimativa preliminar da área edificável e do potencial de aproveitamento do terreno", "Avaliação da melhor ocupação do lote, alinhada ao programa de necessidades do cliente", "Definição preliminar da implantação, organização dos acessos, fluxos, circulação, áreas livres e áreas construídas", "Estudo de volumetria, análise de inserção no entorno e definição de pontos focais que contribuam para a valorização do empreendimento", "Dimensionamento preliminar de estacionamentos, fluxos operacionais e viabilidade de circulação para veículos leves e pesados", "Análise inicial de conforto ambiental e estratégias passivas de sustentabilidade, considerando desempenho térmico, lumínico e acústico, além de ventilação natural e proteção solar", "Estimativa preliminar de investimento, com base na área projetada e em custos referenciais de mercado"],
        entregaveis:["Estudo técnico de ocupação do terreno, com planta de implantação e setorização preliminar", "Esquema conceitual de implantação, incluindo diagramas de organização espacial, acessos e condicionantes do entorno", "Representações gráficas, estudo volumétrico em 3D e imagens conceituais", "Relatório sintético de viabilidade construtiva, contemplando memorial descritivo, quadro de áreas e síntese dos parâmetros urbanísticos aplicáveis"],
        obs:"Esta etapa tem como objetivo reduzir riscos e antecipar decisões estratégicas antes do desenvolvimento do projeto, permitindo validar a compatibilidade da proposta com o terreno, com a legislação municipal e com os objetivos do empreendimento." },
      { id:2, titulo:"2. Estudo Preliminar",
        objetivo:"Desenvolver o conceito arquitetônico inicial, organizando os ambientes, a implantação e a linguagem estética do projeto.",
        itens:["Reunião de briefing e entendimento das necessidades do cliente","Definição do programa de necessidades","Estudo de implantação da edificação no terreno","Desenvolvimento da concepção arquitetônica inicial","Definição preliminar de: layout, fluxos, volumetria, setorização e linguagem estética","Compatibilização entre funcionalidade, conforto, estética e viabilidade construtiva","Ajustes conforme alinhamento com o cliente"],
        entregaveis:["Planta baixa preliminar","Estudo volumétrico / fachada conceitual","Implantação inicial","Imagens, croquis ou perspectivas conceituais","Apresentação para validação do conceito arquitetônico"],
        obs:"É nesta etapa que o projeto ganha forma. O estudo preliminar define a essência da proposta e orienta todas as fases seguintes." },
      { id:3, titulo:"3. Aprovação na Prefeitura",
        objetivo:"Adequar e preparar o projeto arquitetônico para protocolo e aprovação junto aos órgãos públicos competentes.",
        itens:["Adequação do projeto às exigências legais e urbanísticas do município","Elaboração dos desenhos técnicos exigidos para aprovação","Montagem da documentação técnica necessária ao processo","Inserção de informações obrigatórias conforme normas municipais","Preparação de pranchas, quadros de áreas e demais peças gráficas","Apoio técnico durante o processo de aprovação","Atendimento a eventuais comunique-se ou exigências técnicas da prefeitura"],
        entregaveis:["Projeto legal para aprovação","Plantas, cortes, fachadas e implantação conforme exigência municipal","Quadros de áreas","Arquivos e documentação técnica para protocolo"],
        obs:"Não inclusos nesta etapa: taxas municipais, emolumentos, ART/RRT, levantamentos complementares, certidões e exigências extraordinárias de órgãos externos, salvo se expressamente previsto." },
      { id:4, titulo:"4. Projeto Executivo",
        objetivo:"Desenvolver o projeto arquitetônico em nível detalhado para execução da obra, fornecendo todas as informações necessárias para construção com precisão.",
        itens:["Desenvolvimento técnico completo do projeto aprovado","Detalhamento arquitetônico para obra","Definição precisa de: dimensões, níveis, cotas, eixos, paginações, esquadrias, acabamentos e elementos construtivos","Elaboração de desenhos técnicos executivos","Compatibilização arquitetônica com premissas de obra","Apoio técnico para leitura e entendimento do projeto pela equipe executora"],
        entregaveis:["Planta baixa executiva","Planta de locação e implantação","Planta de cobertura","Cortes e fachadas executivos","Planta de layout e pontos arquitetônicos","Planta de esquadrias e pisos","Detalhamentos construtivos","Quadro de esquadrias e quadro de áreas final"],
        obs:"É a etapa que transforma a ideia em construção real. Um bom projeto executivo reduz improvisos, retrabalhos e falhas de execução na obra." },
    ],
    escopoEng: ["Estrutural: lançamento, dimensionamento de vigas, pilares, lajes e fundações","Elétrico: dimensionamento de cargas, circuitos, quadros e pontos","Hidrossanitário: distribuição de pontos de água fria/quente, esgoto e dimensionamento","Compatibilização entre projetos arquitetônico e de engenharia para verificar possíveis interferências"],
    naoInclusos: ["Taxas municipais, emolumentos e registros (CAU/Prefeitura)","Impostos","Projetos de climatização","Projeto de prevenção de incêndio","Projeto de automação","Projeto de paisagismo","Projeto de interiores","Projeto de Marcenaria (Móveis internos)","Projeto estrutural de estruturas metálicas","Projeto estrutural para muros de contenção (arrimo) acima de 1 m de altura","Sondagem e Planialtimétrico do terreno","Acompanhamento semanal de obra","Gestão e execução de obra","Vistoria para Caixa Econômica Federal","RRT de Execução de obra"],
    prazo: ["Prazo estimado para entrega do Projeto Arquitetônico: 30 dias úteis após aprovação do estudo preliminar.", "Prazo estimado para entrega dos Projetos de Engenharia: 30 dias úteis após aprovação na prefeitura."],
    aceite: { responsavel:"Arq. Leonardo Padovan", registro:"CAU A30278-3", cidade:"Ourinhos" },
    logoPos: { x:0, y:0 },
  };
}
