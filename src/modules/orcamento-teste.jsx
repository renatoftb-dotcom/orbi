function TesteOrcamento({ data, save }) {
  const [orcBase, setOrcBase] = useState(null);

  async function salvarOrcamento(orc) {
    const todos = data.orcamentosProjeto || [];
    const nextId = () => {
      const max = todos.reduce((mx, o) => {
        const m = (o.id || "").match(/^ORC-(\d+)$/);
        return m ? Math.max(mx, parseInt(m[1])) : mx;
      }, 0);
      return "ORC-" + String(max + 1).padStart(4, "0");
    };
    const novo = { ...orc, id: orc.id || nextId(), criadoEm: orc.criadoEm || new Date().toISOString() };
    setOrcBase(novo);
    const novos = orc.id ? todos.map(o => o.id === orc.id ? novo : o) : [...todos, novo];
    save({ ...data, orcamentosProjeto: novos }).catch(console.error);
  }

  return (
    <div style={{ margin:"-24px -28px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
        <div style={{ background:"#78350f", border:"1px solid #92400e", borderRadius:8, padding:"6px 14px" }}>
          <span style={{ color:"#fcd34d", fontWeight:800, fontSize:13 }}>🧪 Modo Teste</span>
        </div>
        <div style={{ color:"#475569", fontSize:13 }}>Alterações aqui não afetam o formulário de produção</div>
      </div>
      <FormOrcamentoProjetoTeste
        clienteNome="Teste"
        clienteWA=""
        orcBase={orcBase}
        onSalvar={salvarOrcamento}
        onVoltar={() => setOrcBase(null)}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FORM ORCAMENTO PROJETO — VERSAO TESTE
// ═══════════════════════════════════════════════════════════════
function AreaDetalhe({ calculo, fmtNum }) {
  const [aberto, setAberto] = useState(false);
  const [engAberto, setEngAberto] = useState(false);
  const fmt  = (v) => fmtNum(v);
  const brl  = (v) => v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const m2s  = (v, a) => a > 0 ? ` · R$ ${fmt(Math.round(v/a*100)/100)}/m²` : "";
  const pct  = (v) => (v * 100).toLocaleString("pt-BR",{minimumFractionDigits:0,maximumFractionDigits:0}) + "%";
  const row  = (lbl, val, opts={}) => (
    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:3, ...opts.style }}>
      <span style={{ color: opts.lblColor||"#6b7280" }}>{lbl}</span>
      <span style={{ color: opts.valColor||"#374151", fontWeight: opts.bold?600:400 }}>{val}</span>
    </div>
  );
  return (
    <div style={{ background:"#f9fafb", border:"1px solid #f3f4f6", borderRadius:8, padding:"10px 14px", marginBottom:10, fontSize:13, color:"#374151" }}>
      {/* Linha Área útil */}
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ fontSize:12, color:"#9ca3af" }}>Área útil</span>
        <span style={{ fontSize:13, color:"#374151" }}>{fmt(calculo.areaBruta)} m²</span>
      </div>
      {/* Linha Área total com seta */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:12, color:"#9ca3af" }}>Área total (+circ.)</span>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:13, fontWeight:600, color:"#111" }}>{fmt(calculo.areaTotal)} m²</span>
          <span onClick={() => setAberto(v => !v)}
            style={{ cursor:"pointer", fontSize:11, color:"#9ca3af", userSelect:"none", lineHeight:1 }}>
            {aberto ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {/* Detalhe expandido */}
      {aberto && (
        <div style={{ marginTop:12, paddingTop:10, borderTop:"1px solid #e5e7eb", display:"flex", flexDirection:"column", gap:5 }}>

          {calculo.isComercial ? (<>
            {/* ── COMERCIAL ── */}
            {row("Área útil", fmt(calculo.areaBruta)+" m²")}
            {row(`+ ${pct(calculo.acrescimoCirk)} Circulação`, `+${fmt(Math.round(calculo.areaBruta*calculo.acrescimoCirk*100)/100)} m²`)}

            {(calculo.blocosCom||[]).map((b,i) => (
              <div key={i} style={{ borderTop:"1px solid #e5e7eb", marginTop:6, paddingTop:6 }}>
                {b.label === "Área Comum" ? (<>
                  {/* Área Comum — só total e R$/m² */}
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontWeight:700, color:"#374151", marginBottom:3 }}>
                    <span>Área Comum · {fmt(b.area1)} m²</span>
                    <span>{brl(b.precoTot)}{m2s(b.precoTot, b.area1)}</span>
                  </div>
                </>) : (<>
                  {/* Cabeçalho do bloco */}
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontWeight:700, color:"#374151", marginBottom:3 }}>
                    <span>{b.n > 1 ? `${b.n} ${b.label}s` : b.label} · {fmt(b.area1)} m² cada · total {fmt(Math.round(b.area1*b.n*100)/100)} m²</span>
                  </div>
                  {/* Preço unitário */}
                  {row(
                    `${b.label} (1ª unid.)`,
                    `${brl(b.precoUni)}${m2s(b.precoUni, b.area1)}`,
                    { bold: false }
                  )}
                  {/* Total */}
                  {b.n > 1 && row(
                    `Total ${b.label}s`,
                    `${brl(b.precoTot)}${m2s(b.precoTot, b.area1*b.n)}`,
                    { bold: true, valColor:"#111" }
                  )}
                </>)}
              </div>
            ))}

            {/* Fachada */}
            {calculo.precoFachada > 0 && (
              <div style={{ borderTop:"1px solid #e5e7eb", marginTop:6, paddingTop:6 }}>
                {row("+15% Fachada", brl(calculo.precoFachada), { bold:false })}
              </div>
            )}

            {/* Engenharia faixas */}
            <div style={{ borderTop:"1px solid #e5e7eb", marginTop:6, paddingTop:6 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <div style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1 }}>Engenharia <span style={{ fontSize:8, fontWeight:400, letterSpacing:0, textTransform:"none" }}>(Faixas de desconto)</span></div>
                <span onClick={() => setEngAberto(v => !v)} style={{ cursor:"pointer", fontSize:11, color:"#9ca3af", userSelect:"none" }}>{engAberto ? "▲" : "▼"}</span>
              </div>
              {engAberto && calculo.faixasEng.map((f, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:3 }}>
                  <span style={{ color:"#6b7280" }}>
                    {f.desconto > 0 ? `−${f.desconto.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}% · ` : ""}{fmt(f.area)} m² × R$ {fmt(Math.round(f.fator*50*100)/100)}/m²
                  </span>
                  <span style={{ color:"#374151", fontWeight:500 }}>R$ {fmt(Math.round(f.preco*100)/100)}</span>
                </div>
              ))}
            </div>
          </>) : (<>
            {/* ── NÃO COMERCIAL ── */}
            {calculo.nRep > 1 && row(`Área Total (${calculo.nRep}x)`, `${fmt(calculo.areaTotal)} m² → Total ${fmt(calculo.areaTot)} m²`)}
            {row("Total de ambientes", calculo.totalAmbientes)}
            {row("Área útil", fmt(calculo.areaBruta)+" m²")}
            {calculo.areaPiscina > 0 && row("Piscina (Excluído)", fmt(calculo.areaPiscina)+" m²")}
            {(() => {
              const base = (calculo.areaBruta||0) + (calculo.areaPiscina||0);
              const cirkReal = base > 0 ? Math.round((calculo.areaTotal/base - 1)*100) : 0;
              const vCirk = Math.round(base*(cirkReal/100)*100)/100;
              return row(`+ ${cirkReal}% Circulação e paredes`, `+${fmt(vCirk)} m²`);
            })()}

            <div style={{ borderTop:"1px solid #e5e7eb", marginTop:4, paddingTop:6 }}>
              <div style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Índice multiplicador</div>
              {row("Qtd de cômodos", calculo.indiceComodos.toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3}))}
              {row("Padrão", calculo.indicePadrao.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1}))}
              {row("Fator multiplicar", `x${calculo.fatorMult.toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3})}`, { bold:true, valColor:"#111" })}
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, borderTop:"1px solid #e5e7eb", paddingTop:6, marginTop:2 }}>
              <span style={{ color:"#6b7280" }}>Preço base</span>
              <span style={{ color:"#374151" }}>{fmt(calculo.precoBaseVal)} × {calculo.fatorMult.toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3})} = {fmt(Math.round(calculo.precoBaseVal*calculo.fatorMult*100)/100)} R$/m²</span>
            </div>

            <div style={{ borderTop:"1px solid #e5e7eb", marginTop:4, paddingTop:6 }}>
              <div style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Faixa de Desconto — Arquitetura (1ª Unidade)</div>
              {calculo.faixasArqDet.map((f, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:3 }}>
                  <span style={{ color:"#6b7280" }}>{f.desconto > 0 ? `−${pct(f.desconto)} · ` : ""}{fmt(f.area)} m² × R$ {fmt(Math.round(f.precoM2*100)/100)}/m²</span>
                  <span style={{ color:"#374151", fontWeight:500 }}>R$ {fmt(f.preco)}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop:"1px solid #e5e7eb", marginTop:4, paddingTop:6 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <div style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1 }}>Engenharia <span style={{ fontSize:8, fontWeight:400, letterSpacing:0 }}>(Faixas de desconto)</span></div>
                <span onClick={() => setEngAberto(v => !v)} style={{ cursor:"pointer", fontSize:11, color:"#9ca3af", userSelect:"none" }}>{engAberto ? "▲" : "▼"}</span>
              </div>
              {engAberto && calculo.faixasEng.map((f, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:3 }}>
                  <span style={{ color:"#6b7280" }}>{f.desconto > 0 ? `−${f.desconto.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}% · ` : ""}{fmt(f.area)} m² × R$ {fmt(Math.round(f.fator*50*100)/100)}/m²</span>
                  <span style={{ color:"#374151", fontWeight:500 }}>R$ {fmt(Math.round(f.preco*100)/100)}</span>
                </div>
              ))}
            </div>
          </>)}

        </div>
      )}
    </div>
  );
}

function ResumoDetalhes({ calculo, fmtNum, C }) {
  const [repAberto, setRepAberto] = useState(false);
  const fmt2   = (v) => v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const m2str  = (v, area) => area > 0 ? ` (R$ ${fmtNum(Math.round(v / area * 100) / 100)}/m²)` : "";
  const hasRep = calculo.nRep > 1;
  return (
    <>
      {/* Arquitetura */}
      <div style={{ ...C.resumoSec, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span>Arquitetura</span>
        {hasRep && (
          <span onClick={() => setRepAberto(v => !v)} style={{ cursor:"pointer", fontSize:13, color:"#9ca3af", userSelect:"none" }}>
            {repAberto ? "▲" : "▼"}
          </span>
        )}
      </div>
      <div style={{ display:"flex", alignItems:"baseline", gap:8, marginTop:4 }}>
        <span style={C.resumoVal}>{fmt2(calculo.precoArq)}</span>
        <span style={C.resumoM2}>R$ {fmtNum(calculo.precoM2Arq)}/m²</span>
      </div>
      {hasRep && repAberto && (
        <div style={{ marginTop:4, borderLeft:"2px solid #f3f4f6", paddingLeft:8 }}>
          {calculo.unidades.map(u => (
            <div key={u.und} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#6b7280", marginTop:3 }}>
              <span>Und {u.und}{u.und > 1 ? ` (${Math.round(calculo.pctRep * 100)}%)` : ""}</span>
              <span>{fmt2(u.arq)}{m2str(u.arq, calculo.areaTotal)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Engenharia */}
      <div style={{ ...C.resumoSec, marginTop:16, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span>Engenharia</span>
      </div>
      <div style={{ display:"flex", alignItems:"baseline", gap:8, marginTop:4 }}>
        <span style={C.resumoVal}>{fmt2(calculo.precoEng)}</span>
        <span style={C.resumoM2}>R$ {fmtNum(calculo.precoM2Eng)}/m²</span>
      </div>
      {hasRep && repAberto && (
        <div style={{ marginTop:4, borderLeft:"2px solid #f3f4f6", paddingLeft:8 }}>
          {calculo.unidades.map(u => (
            <div key={u.und} style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#6b7280", marginTop:3 }}>
              <span>Und {u.und}{u.und > 1 ? ` (${Math.round(calculo.pctRep * 100)}%)` : ""}</span>
              <span>{fmt2(u.eng)}{m2str(u.eng, calculo.areaTotal)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Total Geral */}
      <div style={{ marginTop:20, paddingTop:14, borderTop:"1px solid #f3f4f6" }}>
        <div style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Total Geral</div>
        <div style={{ display:"flex", alignItems:"baseline", gap:8, marginTop:4 }}>
          <span style={{ fontSize:20, fontWeight:800, color:"#111" }}>{fmt2(calculo.precoArq + calculo.precoEng)}</span>
          <span style={C.resumoM2}>R$ {fmtNum(calculo.areaTot > 0 ? Math.round((calculo.precoArq + calculo.precoEng) / calculo.areaTot * 100) / 100 : 0)}/m²</span>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// PROPOSTA PREVIEW — espelho fiel do PDF em HTML
// ═══════════════════════════════════════════════════════════════
function PropostaPreview({ data, onVoltar }) {
  if (!data) return null;
  const { tipoProjeto, tipoObra, padrao, tipologia, tamanho, clienteNome,
          calculo, tipoPgto, temImposto, aliqImp,
          descArq, parcArq, descPacote, parcPacote,
          descEtCtrt, parcEtCtrt, descPacCtrt, parcPacCtrt,
          etapasPct, totSI, totCI, impostoV } = data;

  const fmtV = v => v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const fmtN = v => v.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
  const isPadrao = tipoPgto === "padrao";
  const hoje = new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const dataStr = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
  const validade = new Date(hoje.getTime()+15*86400000).toLocaleDateString("pt-BR");

  // Usa valores sem imposto diretamente — o imposto é calculado apenas no total
  const arqCI = calculo.precoArq || 0;
  const engCI = calculo.precoEng || 0;
  const areaTot = calculo.areaTot || calculo.areaTotal || 0;

  const escopoDefault = [
    { titulo:"1. Estudo de Viabilidade", objetivo:"Analisar o potencial construtivo do terreno e verificar a viabilidade de implantação do empreendimento, considerando as condicionantes físicas, urbanísticas, legais e funcionais aplicáveis ao lote.", itens:["Levantamento inicial e consolidação das informações técnicas do terreno","Análise documental e física do lote, incluindo matrícula, dimensões, topografia e características existentes","Consulta e interpretação dos parâmetros urbanísticos e restrições legais aplicáveis","Verificação da viabilidade construtiva, considerando taxa de ocupação, coeficiente de aproveitamento, recuos obrigatórios, gabarito de altura e demais condicionantes normativas","Estimativa preliminar da área edificável e do potencial de aproveitamento do terreno","Avaliação da melhor ocupação do lote, alinhada ao programa de necessidades do cliente","Definição preliminar da implantação, organização dos acessos, fluxos, circulação, áreas livres e áreas construídas","Estudo de volumetria, análise de inserção no entorno e definição de pontos focais que contribuam para a valorização do empreendimento","Dimensionamento preliminar de estacionamentos, fluxos operacionais e viabilidade de circulação para veículos leves e pesados"], entregaveis:["Estudo técnico de ocupação do terreno, com planta de implantação e setorização preliminar","Esquema conceitual de implantação, incluindo diagramas de organização espacial, acessos e condicionantes do entorno","Representações gráficas, estudo volumétrico em 3D e imagens conceituais","Relatório sintético de viabilidade construtiva, contemplando memorial descritivo, quadro de áreas e síntese dos parâmetros urbanísticos aplicáveis"], obs:"Esta etapa tem como objetivo reduzir riscos e antecipar decisões estratégicas antes do desenvolvimento do projeto, permitindo validar a compatibilidade da proposta com o terreno, com a legislação municipal e com os objetivos do empreendimento." },
    { titulo:"2. Estudo Preliminar", objetivo:"Desenvolver o conceito arquitetônico inicial, organizando os ambientes, a implantação e a linguagem estética do projeto.", itens:["Reunião de briefing e entendimento das necessidades do cliente","Definição do programa de necessidades","Estudo de implantação da edificação no terreno","Desenvolvimento da concepção arquitetônica inicial","Definição preliminar de: layout, fluxos, volumetria, setorização e linguagem estética","Compatibilização entre funcionalidade, conforto, estética e viabilidade construtiva","Ajustes conforme alinhamento com o cliente"], entregaveis:["Planta baixa preliminar","Estudo volumétrico / fachada conceitual","Implantação inicial","Imagens, croquis ou perspectivas conceituais","Apresentação para validação do conceito arquitetônico"], obs:"É nesta etapa que o projeto ganha forma. O estudo preliminar define a essência da proposta e orienta todas as fases seguintes." },
    { titulo:"3. Aprovação na Prefeitura", objetivo:"Adequar e preparar o projeto arquitetônico para protocolo e aprovação junto aos órgãos públicos competentes.", itens:["Adequação do projeto às exigências legais e urbanísticas do município","Elaboração dos desenhos técnicos exigidos para aprovação","Montagem da documentação técnica necessária ao processo","Inserção de informações obrigatórias conforme normas municipais","Preparação de pranchas, quadros de áreas e demais peças gráficas","Apoio técnico durante o processo de aprovação","Atendimento a eventuais comunique-se ou exigências técnicas da prefeitura"], entregaveis:["Projeto legal para aprovação","Plantas, cortes, fachadas e implantação conforme exigência municipal","Quadros de áreas","Arquivos e documentação técnica para protocolo"], obs:"Não inclusos nesta etapa: taxas municipais, emolumentos, ART/RRT, levantamentos complementares, certidões e exigências extraordinárias de órgãos externos, salvo se expressamente previsto." },
    { titulo:"4. Projeto Executivo", objetivo:"Desenvolver o projeto arquitetônico em nível detalhado para execução da obra, fornecendo todas as informações necessárias para construção com precisão.", itens:["Desenvolvimento técnico completo do projeto aprovado","Detalhamento arquitetônico para obra","Definição precisa de: dimensões, níveis, cotas, eixos, paginações, esquadrias, acabamentos e elementos construtivos","Elaboração de desenhos técnicos executivos","Compatibilização arquitetônica com premissas de obra","Apoio técnico para leitura e entendimento do projeto pela equipe executora"], entregaveis:["Planta baixa executiva","Planta de locação e implantação","Planta de cobertura","Cortes e fachadas executivos","Planta de layout e pontos arquitetônicos","Planta de esquadrias e pisos","Detalhamentos construtivos","Quadro de esquadrias e quadro de áreas final"], obs:"É a etapa que transforma a ideia em construção real. Um bom projeto executivo reduz improvisos, retrabalhos e falhas de execução na obra." },
    { titulo:"5. Projetos Complementares de Engenharia", objetivo:"", itens:["Estrutural: lançamento, dimensionamento de vigas, pilares, lajes e fundações","Elétrico: dimensionamento de cargas, circuitos, quadros e pontos","Hidrossanitário: distribuição de pontos de água fria/quente, esgoto e dimensionamento","Compatibilização entre projetos arquitetônico e de engenharia para verificar possíveis interferências"], entregaveis:[], obs:"Obs.: Este item poderá ser contratado diretamente pelo cliente junto a engenheiros terceiros, ficando a compatibilização sob responsabilidade dos profissionais contratados." },
  ];

  const naoInclDefault = [
    "Taxas municipais, emolumentos e registros (CAU/Prefeitura)",
    "Projetos de climatização","Projeto de prevenção de incêndio","Projeto de automação",
    "Projeto de paisagismo","Projeto de interiores","Projeto de Marcenaria (Móveis internos)",
    "Projeto estrutural de estruturas metálicas",
    "Projeto estrutural para muros de contenção (arrimo) acima de 1 m de altura",
    "Sondagem e Planialtimétrico do terreno","Acompanhamento semanal de obra",
    "Gestão e execução de obra","Vistoria para Caixa Econômica Federal","RRT de Execução de obra",
    ...(!temImposto ? ["Impostos"] : []),
  ];

  const prazoDefault = isPadrao
    ? ["Prazo estimado para entrega do Projeto Arquitetônico: 30 dias úteis após aprovação do estudo preliminar.",
       "Prazo estimado para entrega dos Projetos de Engenharia: 30 dias úteis após aprovação na prefeitura."]
    : ["Prazo de 30 dias úteis por etapa, contados após conclusão e aprovação de cada etapa pelo cliente.",
       "Concluída e aprovada cada etapa, inicia-se automaticamente o prazo da etapa seguinte.",
       "Projetos de Engenharia: 30 dias úteis após aprovação do projeto na Prefeitura."];

  const C = "#111827";
  const LT = "#9ca3af";
  const MD = "#6b7280";
  const LN = "#e5e7eb";
  const wrap  = { fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", background:"#fff", minHeight:"100vh", color:C, fontSize:13 };
  const page  = { maxWidth:860, margin:"0 auto", padding:"32px 40px 80px" };
  const secH  = (mt=28) => ({ display:"flex", alignItems:"center", gap:12, margin:`${mt}px 0 14px` });
  const secL  = { fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", color:LT, fontWeight:600, whiteSpace:"nowrap" };
  const secLn = { flex:1, height:1, background:LN };
  const tag   = { fontSize:10, fontWeight:600, color:LT, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5, marginTop:10 };
  const bl    = { display:"flex", gap:8, marginBottom:4 };
  const dot   = { color:LT, flexShrink:0 };

  const Sec = ({title, mt, children}) => (
    <div>
      <div style={secH(mt)}>
        <span style={secL}>{title}</span>
        <div style={secLn} />
      </div>
      {children}
    </div>
  );

  const Row = ({label, value, sub}) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
      <span style={{ fontSize:13, color:MD }}>{label}</span>
      <div style={{ textAlign:"right" }}>
        <span style={{ fontSize:13, fontWeight:500, color:C }}>{value}</span>
        {sub && <div style={{ fontSize:11, color:LT }}>{sub}</div>}
      </div>
    </div>
  );

  // QR SVG simples
  const QR = () => (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="16" height="16" rx="1.5" stroke={C} strokeWidth="1.5" fill="none"/>
      <rect x="5.5" y="5.5" width="9" height="9" rx="0.5" fill={C}/>
      <rect x="26" y="2" width="16" height="16" rx="1.5" stroke={C} strokeWidth="1.5" fill="none"/>
      <rect x="29.5" y="5.5" width="9" height="9" rx="0.5" fill={C}/>
      <rect x="2" y="26" width="16" height="16" rx="1.5" stroke={C} strokeWidth="1.5" fill="none"/>
      <rect x="5.5" y="29.5" width="9" height="9" rx="0.5" fill={C}/>
      <rect x="26" y="26" width="5" height="5" fill={C}/>
      <rect x="33" y="26" width="5" height="5" fill={C}/>
      <rect x="26" y="33" width="5" height="5" fill={C}/>
      <rect x="33" y="33" width="5" height="5" fill={C}/>
      <rect x="40" y="26" width="2" height="2" fill={C}/>
      <rect x="40" y="33" width="2" height="2" fill={C}/>
      <rect x="26" y="40" width="5" height="2" fill={C}/>
      <rect x="40" y="40" width="2" height="2" fill={C}/>
    </svg>
  );

  const handlePdf = async () => {
    if (!window.jspdf) { alert("Aguarde 2s e tente novamente."); return; }
    try {
      const c = data.calculo;
      const nUnid = c.nRep || 1;
      const arqTotal = calculo.precoArq || 0;
      const engTotal = calculo.precoEng || 0;
      const grandTotal = totCI;
      const engUnit = engTotal;
      const r = { areaTotal: areaTot, areaBruta: c.areaBruta||0, nUnidades: nUnid, precoArq: arqTotal, precoFinal: arqTotal, precoTotal: arqTotal, precoEng: engTotal, engTotal, impostoAplicado: temImposto, aliquotaImposto: aliqImp };
      const fmt   = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
      const fmtM2 = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+" m²";
      const orc = { id:"teste-"+Date.now(), cliente:data.clienteNome||"Cliente", tipo:data.tipoProjeto, subtipo:data.tipoObra, padrao:data.padrao, tipologia:data.tipologia, tamanho:data.tamanho, comodos:data.comodos||[], tipoPagamento:data.tipoPgto, descontoEtapa:data.descArq, parcelasEtapa:data.parcArq, descontoPacote:data.descPacote, parcelasPacote:data.parcPacote, descontoEtapaCtrt:data.descEtCtrt, parcelasEtapaCtrt:data.parcEtCtrt, descontoPacoteCtrt:data.descPacCtrt, parcelasPacoteCtrt:data.parcPacCtrt, etapasPct:data.etapasPct, incluiImposto:data.temImposto, aliquotaImposto:data.aliqImp, criadoEm:new Date().toISOString(), resultado:r };
      const modelo = defaultModelo(orc, arqTotal, engTotal, grandTotal, fmt, fmtM2, nUnid, engUnit, r);
      // Usar resumo gerado no preview (mais preciso para comercial)
      if (data.resumoDescritivo && modelo.cliente) modelo.cliente.resumo = data.resumoDescritivo;
      let logoData = null;
      try { const lr = await window.storage.get("escritorio-logo"); if (lr?.value) logoData = lr.value; } catch {}
      await buildPdf(orc, logoData, modelo, null, "#ffffff", true, true);
    } catch(e) { console.error(e); alert("Erro ao gerar PDF: "+e.message); }
  };

  return (
    <div style={wrap}>
      <div style={page}>

        {/* Toolbar */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:36 }}>
          <button onClick={onVoltar} style={{ background:"none", border:`1px solid ${LN}`, borderRadius:8, padding:"7px 14px", fontSize:13, cursor:"pointer", fontFamily:"inherit", color:MD }}>
            ← Voltar
          </button>
          <button onClick={handlePdf} style={{ background:C, border:"none", borderRadius:8, padding:"8px 22px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", color:"#fff" }}>
            Gerar PDF
          </button>
        </div>

        {/* Cabeçalho */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ background:C, borderRadius:6, width:80, height:44, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ color:"#fff", fontSize:9, fontWeight:700, textAlign:"center", lineHeight:1.5, letterSpacing:"0.05em" }}>PADOVAN<br/><span style={{ letterSpacing:"0.15em" }}>ARQ</span>UITETOS</div>
          </div>
          <div style={{ fontSize:11, color:LT }}>Ourinhos, {dataStr} · Válido até {validade}</div>
        </div>

        {/* Nome + Total */}
        <div style={{ borderTop:`1.5px solid ${C}`, borderBottom:`0.5px solid ${LN}`, padding:"12px 0", marginBottom:20, display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
          <div>
            <div style={{ fontSize:24, fontWeight:600, color:C }}>{clienteNome || "Cliente"}</div>
            <div style={{ fontSize:10, color:LT, marginTop:3, letterSpacing:"0.04em" }}>Proposta Comercial de Projetos de Arquitetura e Engenharia</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ display:"flex", alignItems:"baseline", justifyContent:"flex-end", gap:6 }}>
              <span style={{ fontSize:10, color:LT }}>Apenas Arquitetura</span>
              <span style={{ fontSize:22, fontWeight:600, color:C }}>{fmtV(arqCI)}</span>
            </div>
            <div style={{ fontSize:11, color:LT }}>{areaTot > 0 ? `R$ ${fmtN(Math.round(arqCI/areaTot*100)/100)}/m²` : ""}</div>
          </div>
        </div>

        {/* Resumo descritivo */}
        {data.resumoDescritivo && (
          <div style={{ fontSize:13, color:MD, lineHeight:1.7, marginBottom:20 }}>{data.resumoDescritivo}</div>
        )}

        {/* Valores */}
        <Sec title="Valores dos projetos" mt={0}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 0.5px 1fr", gap:0, marginBottom:12 }}>
            <div style={{ paddingRight:20 }}>
              <div style={tag}>Arquitetura</div>
              <div style={{ fontSize:20, fontWeight:600, color:C }}>{fmtV(arqCI)}</div>
              <div style={{ fontSize:11, color:LT }}>{areaTot > 0 ? `R$ ${fmtN(Math.round(arqCI/areaTot*100)/100)}/m²` : ""}</div>
            </div>
            <div style={{ background:LN }} />
            <div style={{ paddingLeft:20 }}>
              <div style={tag}>Engenharia <span style={{ fontSize:10, color:LT, textTransform:"none", letterSpacing:0 }}>(Opcional)</span></div>
              <div style={{ fontSize:20, fontWeight:600, color:C }}>{fmtV(engCI)}</div>
              <div style={{ fontSize:11, color:LT }}>{areaTot > 0 ? `R$ ${fmtN(Math.round(engCI/areaTot*100)/100)}/m²` : ""}</div>
            </div>
          </div>
          <div style={{ border:`0.5px solid ${LN}`, borderRadius:8, padding:"8px 14px", fontSize:12, color:LT, marginBottom:4 }}>
            {temImposto ? (<>
              + Impostos — <span style={{ color:MD, fontWeight:500 }}>{fmtV(impostoV)}</span>
              &nbsp;·&nbsp; Total com impostos — <span style={{ fontSize:13, fontWeight:600, color:C }}>{fmtV(totCI)}</span>
            </>) : (<>
              Total sem impostos — <span style={{ fontSize:13, fontWeight:600, color:C }}>{fmtV(totCI)}</span>
            </>)}
          </div>
        </Sec>

        {/* Pagamento */}
        <Sec title={isPadrao ? "Formas de pagamento" : "Contratação por etapa"}>
          {isPadrao ? (<>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:6 }}>Apenas Arquitetura</div>
              <div style={{ fontSize:13, color:MD, marginBottom:3 }}>Antecipado ({descArq}% de desconto) — {fmtV(Math.round(arqCI*(1-descArq/100)*100)/100)}</div>
              <div style={{ fontSize:13, color:MD }}>Parcelado {parcArq}× — {fmtV(Math.round(arqCI/parcArq*100)/100)}/mês</div>
            </div>
            <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:12, marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:6 }}>Pacote Completo (Arq. + Eng.)</div>
              <div style={{ fontSize:13, color:MD, marginBottom:3 }}>De {fmtV(totCI)} por apenas: <strong style={{ color:C }}>{fmtV(Math.round(totCI*(1-descPacote/100)*100)/100)}</strong></div>
              <div style={{ fontSize:11, color:LT }}>Desconto de {fmtV(Math.round(totCI*descPacote/100*100)/100)} ({descPacote}%) · Parcelado {parcPacote}× de {fmtV(Math.round(totCI*(1-descPacote/100)/parcPacote*100)/100)} c/ desconto</div>
            </div>
          </>) : (<>
            {/* Tabela etapas */}
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 70px 140px", paddingBottom:6, borderBottom:`1.5px solid ${C}` }}>
                <span style={{ fontSize:10, fontWeight:600, color:C, textTransform:"uppercase", letterSpacing:"0.06em" }}>Etapa</span>
                <span style={{ fontSize:10, fontWeight:600, color:C, textTransform:"uppercase", letterSpacing:"0.06em", textAlign:"center" }}>%</span>
                <span style={{ fontSize:10, fontWeight:600, color:C, textTransform:"uppercase", letterSpacing:"0.06em", textAlign:"right" }}>Valor</span>
              </div>
              {etapasPct.map((et,i) => (
                <div key={et.id} style={{ display:"grid", gridTemplateColumns:"1fr 70px 140px", padding:"7px 0", borderBottom:`0.5px solid ${LN}` }}>
                  <span style={{ color:C }}>{et.nome}</span>
                  <span style={{ color:LT, textAlign:"center" }}>{et.pct}%</span>
                  <span style={{ fontWeight:500, textAlign:"right" }}>{fmtV(Math.round(totCI*et.pct/100*100)/100)}</span>
                </div>
              ))}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 70px 140px", padding:"7px 0", borderBottom:`0.5px solid ${LN}` }}>
                <div>
                  <div style={{ color:C }}>Projetos de Engenharia</div>
                  <div style={{ fontSize:11, color:LT }}>Estrutural · Elétrico · Hidrossanitário</div>
                </div>
                <span style={{ color:LT, textAlign:"center" }}>—</span>
                <span style={{ fontWeight:500, textAlign:"right" }}>{fmtV(engCI)}</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 70px 140px", padding:"8px 0", borderTop:`1.5px solid ${C}`, marginTop:2 }}>
                <span style={{ fontWeight:600, color:C }}>Total</span>
                <span style={{ fontWeight:600, color:C, textAlign:"center" }}>{etapasPct.reduce((s,e)=>s+e.pct,0)}%</span>
                <span style={{ fontSize:15, fontWeight:700, color:C, textAlign:"right" }}>{fmtV(totCI)}</span>
              </div>
            </div>
            <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:10, marginBottom:10 }}>
              <div style={secH(0)}>
                <span style={secL}>Forma de Pagamento</span>
                <div style={secLn} />
              </div>
              <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between" }}>
                <div style={{ fontSize:12, fontWeight:600, color:C }}>Etapa a Etapa</div>
                <span style={{ fontSize:10, color:LT }}>{"Obs.: Nesta opção valores de etapas futuras podem ser reajustados."}</span>
              </div>
              <div style={{ fontSize:13, color:MD, marginBottom:5 }}>Opção 1: Antecipado por etapa ({descEtCtrt}% de desconto)</div>
              <div style={{ fontSize:13, color:MD }}>Opção 2: Parcelado {parcEtCtrt}× por etapa</div>
            </div>
            <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:10, marginBottom:10 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:5 }}>Pacote Completo (Arq. + Eng.)</div>
              <div style={{ fontSize:13, color:MD, marginBottom:3 }}>De {fmtV(totCI)} por apenas: <strong style={{ color:C }}>{fmtV(Math.round(totCI*(1-descPacCtrt/100)*100)/100)}</strong></div>
              <div style={{ fontSize:11, color:LT }}>Desconto de {fmtV(Math.round(totCI*descPacCtrt/100*100)/100)} ({descPacCtrt}%) · Parcelado {parcPacCtrt}× de {fmtV(Math.round(totCI*(1-descPacCtrt/100)/parcPacCtrt*100)/100)}</div>
            </div>
          </>)}
          <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:10, fontSize:11, color:LT }}>
            PIX · Chave CNPJ: 36.122.417/0001-74 — Leo Padovan Projetos e Construções · Banco Sicoob
          </div>
        </Sec>

        {/* Escopo */}
        <Sec title="Escopo dos serviços">
          {escopoDefault.map((bloco, i) => (
            <div key={i} style={{ marginBottom:18 }}>
              <div style={{ fontSize:13, fontWeight:600, color:C, marginBottom:6 }}>{bloco.titulo}</div>
              {bloco.objetivo && <>
                <div style={tag}>Objetivo</div>
                <p style={{ fontSize:13, color:MD, lineHeight:1.7, margin:"0 0 8px" }}>{bloco.objetivo}</p>
              </>}
              {bloco.itens.length > 0 && <>
                <div style={tag}>Serviços inclusos</div>
                {bloco.itens.map((it,j) => (
                  <div key={j} style={bl}><span style={dot}>•</span><span style={{ fontSize:13, color:MD, lineHeight:1.6 }}>{it}</span></div>
                ))}
              </>}
              {bloco.entregaveis.length > 0 && <>
                <div style={tag}>Entregáveis</div>
                {bloco.entregaveis.map((it,j) => (
                  <div key={j} style={bl}><span style={dot}>•</span><span style={{ fontSize:13, color:MD, lineHeight:1.6 }}>{it}</span></div>
                ))}
              </>}
              {bloco.obs && <div style={{ fontSize:12, color:LT, marginTop:8, lineHeight:1.6, fontStyle:"italic" }}>{bloco.obs}</div>}
              {i < escopoDefault.length-1 && <div style={{ borderBottom:`0.5px solid ${LN}`, marginTop:14 }} />}
            </div>
          ))}
        </Sec>

        {/* Não Inclusos */}
        <Sec title="Serviços não inclusos">
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"3px 32px", marginBottom:8 }}>
            {naoInclDefault.map((item, i) => (
              <div key={i} style={bl}><span style={dot}>•</span><span style={{ fontSize:13, color:MD }}>{item}</span></div>
            ))}
          </div>
          <div style={{ fontSize:12, color:LT, fontStyle:"italic" }}>Todos os serviços não inclusos podem ser contratados como serviços adicionais.</div>
        </Sec>

        {/* Prazo */}
        <Sec title="Prazo de execução">
          {prazoDefault.map((p, i) => (
            <div key={i} style={{ ...bl, marginBottom:6 }}><span style={dot}>•</span><span style={{ fontSize:13, color:MD, lineHeight:1.6 }}>{p}</span></div>
          ))}
        </Sec>

        {/* Aceite */}
        <Sec title="Aceite da proposta">
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:32, marginTop:8 }}>
            <div>
              <div style={{ fontSize:10, fontWeight:600, color:LT, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Cliente</div>
              <div style={{ fontSize:14, fontWeight:600, color:C, marginBottom:32 }}>{clienteNome || "—"}</div>
              <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:6, display:"flex", justifyContent:"space-between", fontSize:11, color:LT }}>
                <span>Assinatura</span><span>Data: _____ / _____ / _______</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:600, color:LT, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Responsável técnico</div>
              <div style={{ fontSize:14, fontWeight:600, color:C, marginBottom:4 }}>Arq. Leonardo Padovan</div>
              <div style={{ fontSize:12, color:LT, marginBottom:20 }}>CAU A30278-3 · Ourinhos</div>
              <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:6, display:"flex", justifyContent:"space-between", fontSize:11, color:LT }}>
                <span>Assinatura</span><span>{dataStr}</span>
              </div>
            </div>
          </div>
        </Sec>

        {/* Rodapé com QR */}
        <div style={{ borderTop:`0.5px solid ${LN}`, marginTop:48, paddingTop:14, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:11, color:LT }}>
            <span>Padovan Arquitetos</span><span>·</span>
            <span>leopadovan.arq@gmail.com</span><span>·</span>
            <span>(14) 99767-4200</span><span>·</span>
            <span>@padovan_arquitetos</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
            <div style={{ width:46, height:46, border:`0.5px solid ${LN}`, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", padding:3 }}>
              <svg width="36" height="36" viewBox="0 0 44 44" fill="none">
                <rect x="2" y="2" width="16" height="16" rx="1.5" stroke={C} strokeWidth="1.5" fill="none"/>
                <rect x="5.5" y="5.5" width="9" height="9" rx="0.5" fill={C}/>
                <rect x="26" y="2" width="16" height="16" rx="1.5" stroke={C} strokeWidth="1.5" fill="none"/>
                <rect x="29.5" y="5.5" width="9" height="9" rx="0.5" fill={C}/>
                <rect x="2" y="26" width="16" height="16" rx="1.5" stroke={C} strokeWidth="1.5" fill="none"/>
                <rect x="5.5" y="29.5" width="9" height="9" rx="0.5" fill={C}/>
                <rect x="26" y="26" width="5" height="5" fill={C}/>
                <rect x="33" y="26" width="5" height="5" fill={C}/>
                <rect x="26" y="33" width="5" height="5" fill={C}/>
                <rect x="33" y="33" width="5" height="5" fill={C}/>
                <rect x="40" y="26" width="2" height="2" fill={C}/>
                <rect x="40" y="33" width="2" height="2" fill={C}/>
                <rect x="26" y="40" width="5" height="2" fill={C}/>
                <rect x="40" y="40" width="2" height="2" fill={C}/>
              </svg>
            </div>
            <div style={{ fontSize:10, color:LT, lineHeight:1.5 }}>Instagram<br/>@padovan_arquitetos</div>
          </div>
        </div>

      </div>
    </div>
  );
}

function FormOrcamentoProjetoTeste({ onSalvar, orcBase, clienteNome, clienteWA, onVoltar, modoVer }) {
  const [referencia,   setReferencia]   = useState(orcBase?.referencia  || "");
  const [tipoObra,     setTipoObra]     = useState(orcBase?.subtipo     || null);
  const [tipoProjeto,  setTipoProjeto]  = useState(orcBase?.tipo        || null);
  const [padrao,       setPadrao]       = useState(orcBase?.padrao      || null);
  const [tipologia,    setTipologia]    = useState(orcBase?.tipologia   || null);
  const [tamanho,      setTamanho]      = useState(orcBase?.tamanho     || null);
  const [aberto,       setAberto]       = useState(null);
  const [panelPos,     setPanelPos]     = useState({ top:0, left:0 });
  const [showModal,     setShowModal]     = useState(false);
  const [propostaData,  setPropostaData]  = useState(modoVer && orcBase ? {
    tipoProjeto: orcBase.tipo, tipoObra: orcBase.subtipo, padrao: orcBase.padrao,
    tipologia: orcBase.tipologia, tamanho: orcBase.tamanho,
    clienteNome, referencia: orcBase.referencia || "",
    comodos: orcBase.comodos || [],
    calculo: orcBase.resultado || {},
    tipoPgto: orcBase.tipoPgto || "padrao",
    temImposto: orcBase.temImposto || false,
    aliqImp: orcBase.aliqImp || 16,
    descArq: orcBase.descArq || 5, parcArq: orcBase.parcArq || 3,
    descPacote: orcBase.descPacote || 10, parcPacote: orcBase.parcPacote || 4,
    descEtCtrt: orcBase.descEtCtrt || 5, parcEtCtrt: orcBase.parcEtCtrt || 2,
    descPacCtrt: orcBase.descPacCtrt || 15, parcPacCtrt: orcBase.parcPacCtrt || 8,
    etapasPct: orcBase.etapasPct || [],
    totSI: orcBase.totSI || 0, totCI: orcBase.totCI || 0, impostoV: orcBase.impostoV || 0,
    resumoDescritivo: "",
  } : null); // quando definido, abre o preview
  const [orcPendente,   setOrcPendente]   = useState(null); // orçamento a salvar após PDF
  const [tipoPgto,      setTipoPgto]      = useState(orcBase?.tipoPgto    || "padrao");
  const [temImposto,    setTemImposto]    = useState(orcBase?.temImposto  || false);
  const [aliqImp,       setAliqImp]       = useState(orcBase?.aliqImp     || 16);
  const [descArq,       setDescArq]       = useState(orcBase?.descArq     || 5);
  const [parcArq,       setParcArq]       = useState(orcBase?.parcArq     || 3);
  const [descPacote,    setDescPacote]    = useState(orcBase?.descPacote  || 10);
  const [parcPacote,    setParcPacote]    = useState(orcBase?.parcPacote  || 4);
  const [descEtCtrt,    setDescEtCtrt]    = useState(orcBase?.descEtCtrt  || 5);
  const [parcEtCtrt,    setParcEtCtrt]    = useState(orcBase?.parcEtCtrt  || 2);
  const [descPacCtrt,   setDescPacCtrt]   = useState(orcBase?.descPacCtrt || 15);
  const [parcPacCtrt,   setParcPacCtrt]   = useState(orcBase?.parcPacCtrt || 8);
  const [etapasPct, setEtapasPct] = useState(orcBase?.etapasPct || [
    { id:1, nome:"Estudo de Viabilidade",  pct:10 },
    { id:2, nome:"Estudo Preliminar",      pct:30 },
    { id:3, nome:"Aprovação na Prefeitura",pct:12 },
    { id:4, nome:"Projeto Executivo",      pct:38 },
    { id:5, nome:"Engenharia",             pct:10 },
  ]);
  const [qtdRep, setQtdRep] = useState(orcBase?.repeticao ? (orcBase?.nUnidades || 2) : 0);

  // Sincroniza estados quando orcBase é carregado depois da montagem (Editar)
  useEffect(() => {
    if (!orcBase) return;
    if (orcBase.referencia  !== undefined) setReferencia(orcBase.referencia || "");
    if (orcBase.subtipo     !== undefined) setTipoObra(orcBase.subtipo);
    if (orcBase.tipo        !== undefined) setTipoProjeto(orcBase.tipo);
    if (orcBase.padrao      !== undefined) setPadrao(orcBase.padrao);
    if (orcBase.tipologia   !== undefined) setTipologia(orcBase.tipologia);
    if (orcBase.tamanho     !== undefined) setTamanho(orcBase.tamanho);
    if (orcBase.comodos)     setQtds(Object.fromEntries(orcBase.comodos.map(c => [c.nome, c.qtd])));
    if (orcBase.repeticao   !== undefined) setQtdRep(orcBase.repeticao ? (orcBase.nUnidades || 2) : 0);
    if (orcBase.tipoPgto    !== undefined) setTipoPgto(orcBase.tipoPgto);
    if (orcBase.temImposto  !== undefined) setTemImposto(orcBase.temImposto);
    if (orcBase.aliqImp     !== undefined) setAliqImp(orcBase.aliqImp);
    if (orcBase.etapasPct   !== undefined) setEtapasPct(orcBase.etapasPct);
    if (orcBase.descArq     !== undefined) setDescArq(orcBase.descArq);
    if (orcBase.parcArq     !== undefined) setParcArq(orcBase.parcArq);
    if (orcBase.descPacote  !== undefined) setDescPacote(orcBase.descPacote);
    if (orcBase.parcPacote  !== undefined) setParcPacote(orcBase.parcPacote);
    if (orcBase.descEtCtrt  !== undefined) setDescEtCtrt(orcBase.descEtCtrt);
    if (orcBase.parcEtCtrt  !== undefined) setParcEtCtrt(orcBase.parcEtCtrt);
    if (orcBase.descPacCtrt !== undefined) setDescPacCtrt(orcBase.descPacCtrt);
    if (orcBase.parcPacCtrt !== undefined) setParcPacCtrt(orcBase.parcPacCtrt);
    if (orcBase.grupoQtds   !== undefined) setGrupoQtds(orcBase.grupoQtds || { "Por Loja":0, "Espaço Âncora":0, "Áreas Comuns":0, "Por Apartamento":0, "Galpao":0 });
    if (orcBase.grupoParams  !== undefined && orcBase.grupoParams) setGrupoParams(orcBase.grupoParams);
  }, [orcBase?.id]);

  // Parâmetros independentes por grupo comercial
  const GRUPOS_COMERCIAIS = ["Por Loja","Espaço Âncora","Áreas Comuns","Por Apartamento","Galpao"];
  const [grupoParams, setGrupoParams] = useState(() => {
    const init = {};
    const p  = orcBase?.padrao    || "Médio";
    const ti = orcBase?.tipologia || "Térreo";
    const ta = orcBase?.tamanho   || "Médio";
    GRUPOS_COMERCIAIS.forEach(g => { init[g] = { padrao:p, tipologia:ti, tamanho:ta }; });
    return init;
  });
  const [abertoGrupo, setAbertoGrupo] = useState(null); // { grupo, param, top, left }

  // Sincroniza grupoParams quando parâmetros globais mudam
  useEffect(() => {
    if (!padrao && !tipologia && !tamanho) return;
    setGrupoParams(prev => {
      const next = {};
      GRUPOS_COMERCIAIS.forEach(g => {
        next[g] = {
          padrao:   padrao   || prev[g]?.padrao   || "Médio",
          tipologia: tipologia || prev[g]?.tipologia || "Térreo",
          tamanho:  tamanho  || prev[g]?.tamanho  || "Médio",
        };
      });
      return next;
    });
  }, [padrao, tipologia, tamanho]);

  function setGrupoParam(grupo, key, val) {
    setGrupoParams(prev => ({ ...prev, [grupo]: { ...prev[grupo], [key]: val } }));
    setAbertoGrupo(null);
  }
  const isComercial = tipoProjeto === "Conj. Comercial";
  // Qtd de repetições por grupo (nLojas, nAncoras, etc.)
  const [grupoQtds, setGrupoQtds] = useState(orcBase?.grupoQtds || {
    "Por Loja": 0, "Espaço Âncora": 0, "Áreas Comuns": 0, "Por Apartamento": 0, "Galpao": 0,
  });

  function setGrupoQtd(grupo, delta) {
    setGrupoQtds(prev => ({ ...prev, [grupo]: Math.max(0, (prev[grupo] || 0) + delta) }));
  }

  // Mapeia tipoProjeto → chave getComodosConfig
  function tipoParaConfig(tp) {
    if (tp === "Clínica")          return "Clínica";
    if (tp === "Conj. Comercial")  return "Comercial";
    if (tp === "Galpão")           return "Galpao";
    return tp || "Residencial";
  }

  const configAtual = useMemo(() => {
    if (!tipoProjeto) return null;
    return getComodosConfig(tipoParaConfig(tipoProjeto));
  }, [tipoProjeto]);

  // qtds: { nomeCômodo: número }
  const [qtds, setQtds] = useState(() => {
    if (!orcBase?.comodos) return {};
    return Object.fromEntries(orcBase.comodos.map(c => [c.nome, c.qtd]));
  });

  // Reset qtds ao mudar tipo de projeto — só zera se não veio de edição
  const isEdicao = useRef(!!orcBase?.comodos?.length);
  useEffect(() => {
    if (isEdicao.current) { isEdicao.current = false; return; }
    setQtds({});
  }, [tipoProjeto]);

  // Fechar dropdown ao clicar fora
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!aberto && !abertoGrupo) return;
    const h = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setAberto(null);
        setAbertoGrupo(null);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [aberto, abertoGrupo]);

  const OPCOES = {
    tipoObra:    ["Construção nova", "Reforma"],
    tipoProjeto: ["Residencial", "Clínica", "Conj. Comercial", "Galpão", "Empreendimento"],
    padrao:      ["Alto", "Médio", "Baixo"],
    tipologia:   ["Térreo", "Sobrado"],
    tamanho:     ["Grande", "Médio", "Pequeno", "Compacta"],
  };

  const VALS   = { tipoObra, tipoProjeto, padrao, tipologia, tamanho };
  const LABELS = { tipoObra:"Tipo Obra", tipoProjeto:"Tipo Projeto", padrao:"Padrão", tipologia:"Tipologia", tamanho:"Tamanho" };
  const SETS   = { tipoObra:setTipoObra, tipoProjeto:setTipoProjeto, padrao:setPadrao, tipologia:setTipologia, tamanho:setTamanho };

  function selecionar(key, val) { SETS[key](val); setAberto(null); }

  // Mapa cômodo → grupo (recalculado quando configAtual muda)
  const grupoDeComodo = useMemo(() => {
    const map = {};
    if (configAtual?.grupos) {
      Object.entries(configAtual.grupos).forEach(([grupo, nomes]) => {
        nomes.forEach(nome => { map[nome] = grupo; });
      });
    }
    return map;
  }, [configAtual]);

  // ── Cálculo live ────────────────────────────────────────────
  const calculo = useMemo(() => {
    if (!configAtual || !tamanho || !padrao) return null;
    const { comodos: COMODOS_USE } = configAtual;
    const tcfg = getTipoConfig(tipoParaConfig(tipoProjeto));
    const pb = tcfg.precoBase;

    // ── COMERCIAL — lógica fiel ao FormOrcamentoProjeto ──────────
    if (isComercial) {
      const nomesLoja   = Object.keys(COMODOS_GALERIA_LOJA);
      const nomesAncora = Object.keys(COMODOS_GALERIA_ANCORA);
      const nomesComum  = Object.keys(COMODOS_GALERIA_COMUM);
      const nomesApto   = Object.keys(COMODOS_GALERIA_APTO);
      const nomesGalpao = Object.keys(COMODOS_GALPAO);

      const nLojas   = grupoQtds["Por Loja"]        || 0;
      const nAncoras = grupoQtds["Espaço Âncora"]   || 0;
      const nComum   = grupoQtds["Áreas Comuns"]    || 0;
      const nAptos   = grupoQtds["Por Apartamento"] || 0;
      const nGalpoes = grupoQtds["Galpao"]           || 0;

      const gpLoja   = grupoParams["Por Loja"]        || {};
      const gpAnc    = grupoParams["Espaço Âncora"]   || {};
      const gpComum  = grupoParams["Áreas Comuns"]    || {};
      const gpApto   = grupoParams["Por Apartamento"] || {};
      const gpGalpao = grupoParams["Galpao"]           || {};

      const tamLoja   = gpLoja.tamanho   || tamanho;
      const tamAnc    = gpAnc.tamanho    || tamanho;
      const tamComum  = gpComum.tamanho  || tamanho;
      const tamApto   = gpApto.tamanho   || tamanho;
      const tamGalpao = gpGalpao.tamanho || tamanho;

      const ipLoja   = INDICE_PADRAO[gpLoja.padrao   || padrao] || 0;
      const ipAnc    = INDICE_PADRAO[gpAnc.padrao    || padrao] || 0;
      const ipComum  = INDICE_PADRAO[gpComum.padrao  || padrao] || 0;
      const ipApto   = INDICE_PADRAO[gpApto.padrao   || padrao] || 0;
      const ipGalpao = INDICE_PADRAO[gpGalpao.padrao || padrao] || 0;

      // Área e índice de 1 unidade de cada tipo
      const calcBloco = (nomes, tam, ip) => {
        let ab = 0, ic = 0;
        nomes.forEach(nome => {
          const cfg2 = COMODOS_USE[nome]; if (!cfg2) return;
          const qtd2 = qtds[nome] || 0;
          if (qtd2 <= 0) return;
          const [L, W_] = cfg2.medidas[tam] || [0,0];
          ab += L * W_ * qtd2;
          ic += (cfg2.indice || 0) * qtd2;
        });
        return { ab, ic, fator: ic + ip + 1 };
      };

      const bLoja   = calcBloco(nomesLoja,   tamLoja,   ipLoja);
      const bAnc    = calcBloco(nomesAncora,  tamAnc,    ipAnc);
      const bComum  = calcBloco(nomesComum,   tamComum,  ipComum);
      const bApto   = calcBloco(nomesApto,    tamApto,   ipApto);
      const bGalpao = calcBloco(nomesGalpao,  tamGalpao, ipGalpao);

      const atLoja1   = bLoja.ab   * (1 + ACRESCIMO_AREA);
      const atAnc1    = bAnc.ab    * (1 + ACRESCIMO_AREA);
      const atComum   = bComum.ab  * (1 + ACRESCIMO_AREA);
      const atApto1   = bApto.ab   * (1 + ACRESCIMO_AREA);
      const atGalpao1 = bGalpao.ab * (1 + 0.10);

      const calcFaixas = (area, fator, isAnc=false) => {
        const faixasDef = isAnc
          ? [{ate:300,d:0},{ate:500,d:.30},{ate:700,d:.35},{ate:1000,d:.40},{ate:Infinity,d:.45}]
          : [{ate:200,d:0},{ate:300,d:.30},{ate:400,d:.35},{ate:500,d:.40},{ate:600,d:.45},{ate:Infinity,d:.50}];
        let total=0, rest=area, acum=0;
        for (const f of faixasDef) {
          if (rest<=0) break;
          const chunk = Math.min(rest, f.ate-acum);
          total += pb * chunk * fator * (1-f.d);
          rest -= chunk; acum = f.ate;
        }
        return Math.round(total*100)/100;
      };

      const calcRep = (precoUni, area1, n) => {
        let total=precoUni, acum=area1;
        for (let i=2; i<=n; i++) {
          acum += area1;
          const pct = acum<1000?0.25:acum<2000?0.20:0.15;
          total += precoUni*pct;
        }
        return Math.round(total*100)/100;
      };

      const p1Loja   = atLoja1  >0 ? calcFaixas(atLoja1,  bLoja.fator)       : 0;
      const p1Anc    = atAnc1   >0 ? calcFaixas(atAnc1,   bAnc.fator,  true) : 0;
      const p1Comum  =               calcFaixas(atComum,  bComum.fator);
      const p1Apto   = atApto1  >0 ? calcFaixas(atApto1,  bApto.fator)       : 0;
      const p1Galpao = atGalpao1>0 ? calcFaixas(atGalpao1,bGalpao.fator)     : 0;

      const pLojas   = nLojas  >0&&atLoja1  >0 ? calcRep(p1Loja,   atLoja1,   nLojas)   : 0;
      const pAncoras = nAncoras>0&&atAnc1   >0 ? calcRep(p1Anc,    atAnc1,    nAncoras) : 0;
      const pAptos   = nAptos  >0&&atApto1  >0 ? calcRep(p1Apto,   atApto1,   nAptos)   : 0;
      const pGalpoes = nGalpoes>0&&atGalpao1>0 ? calcRep(p1Galpao, atGalpao1, nGalpoes) : 0;

      const precoSemFach = pLojas+pAncoras+p1Comum+pAptos+pGalpoes;
      const precoArq1 = Math.round((precoSemFach*(1+INDICE_FACHADA_GALERIA))*100)/100;
      const areaTot   = atLoja1*nLojas + atAnc1*nAncoras + atComum + atApto1*nAptos + atGalpao1*nGalpoes;
      const engCalc   = calcularEngenharia(areaTot);
      const precoEng1 = Math.round(engCalc.totalEng*100)/100;
      const nRep=1, pctRep=0.25;
      const unidades=[{und:1,arq:precoArq1,eng:precoEng1}];
      const precoFachada = Math.round((pLojas+pAncoras+p1Comum+pAptos+pGalpoes)*INDICE_FACHADA_GALERIA*100)/100;
      const blocosCom = [
        nLojas   >0&&atLoja1  >0 ? {label:"Loja",         n:nLojas,   area1:atLoja1,   precoUni:p1Loja,   precoTot:pLojas}   : null,
        nAncoras >0&&atAnc1   >0 ? {label:"Âncora",       n:nAncoras, area1:atAnc1,    precoUni:p1Anc,    precoTot:pAncoras} : null,
        atComum  >0              ? {label:"Área Comum",    n:1,        area1:atComum,   precoUni:p1Comum,  precoTot:p1Comum}  : null,
        nAptos   >0&&atApto1  >0 ? {label:"Apartamento",  n:nAptos,   area1:atApto1,   precoUni:p1Apto,   precoTot:pAptos}   : null,
        nGalpoes >0&&atGalpao1>0 ? {label:"Galpão",  n:nGalpoes, area1:atGalpao1, precoUni:p1Galpao, precoTot:pGalpoes} : null,
      ].filter(Boolean);
      return {
        isComercial: true,
        areaBruta: bLoja.ab*nLojas+bAnc.ab*nAncoras+bComum.ab+bApto.ab*nAptos+bGalpao.ab*nGalpoes,
        areaPiscina:0, areaTotal:areaTot, areaTot,
        precoArq1, precoArq:precoArq1, precoEng1, precoEng:precoEng1,
        precoM2Arq: areaTot>0?Math.round(precoArq1/areaTot*100)/100:0,
        precoM2Eng: areaTot>0?Math.round(precoEng1/areaTot*100)/100:0,
        nRep, pctRep, unidades,
        indiceComodos:0, indicePadrao:0, fatorMult:1, precoBaseVal:pb, precoM2Ef:pb,
        faixasArqDet:[], faixasEng:engCalc.faixas, totalAmbientes:0, acrescimoCirk:ACRESCIMO_AREA,
        blocosCom, precoFachada,
      };
    }

    // ── NÃO COMERCIAL ─────────────────────────────────────────
    let areaBruta = 0, areaPiscina = 0;
    Object.entries(qtds).forEach(([nome, qtd]) => {
      if (!qtd || qtd <= 0) return;
      const cfg = COMODOS_USE[nome];
      if (!cfg) return;
      const [L, W_] = cfg.medidas[tamanho] || [0, 0];
      const area = L * W_ * qtd;
      if (nome === "Piscina") areaPiscina += area;
      else areaBruta += area;
    });

    const areaTotal = Math.round((areaBruta + areaPiscina) * (1 + tcfg.acrescimoCirk) * 100) / 100;
    if (areaTotal === 0) return null;

    // Memória de cálculo — índices
    const indiceComodos = (() => {
      let idx = 0;
      Object.entries(qtds).forEach(([nome, qtd]) => {
        if (!qtd || qtd <= 0) return;
        const cfg = COMODOS_USE[nome];
        if (cfg) idx += (cfg.indice || 0) * qtd;
      });
      return Math.round(idx * 1000) / 1000;
    })();
    const indicePadrao = INDICE_PADRAO[padrao] || 0;
    const fatorMult    = Math.round((1 + indiceComodos + indicePadrao) * 1000) / 1000;
    const precoBaseVal = pb;
    const precoM2Ef    = pb * fatorMult;

    function calcArqFaixas(area) {
      let acum = 0, total = 0, rest = area;
      for (const f of tcfg.faixasDesconto) {
        const chunk = Math.min(rest, f.ate - acum);
        if (chunk <= 0) break;
        total += chunk * precoM2Ef * (1 - f.desconto);
        rest -= chunk; acum += chunk;
        if (rest <= 0) break;
      }
      return Math.round(total * 100) / 100;
    }
    // Faixas de desconto Arq detalhadas
    const faixasArqDet = (() => {
      let acum = 0, rest = areaTotal;
      const det = [];
      for (const f of tcfg.faixasDesconto) {
        const chunk = Math.min(rest, f.ate - acum);
        if (chunk <= 0) break;
        const pm2 = precoM2Ef * (1 - f.desconto);
        det.push({ de: acum, ate: acum + chunk, area: chunk, desconto: f.desconto, precoM2: pm2, preco: Math.round(chunk * pm2 * 100) / 100 });
        rest -= chunk; acum += chunk;
        if (rest <= 0) break;
      }
      return det;
    })();
    const totalAmbientes = Object.entries(qtds).filter(([,q])=>q>0).reduce((s,[,q])=>s+q,0);

    const precoArq1 = calcArqFaixas(areaTotal);
    const engCalc   = calcularEngenharia(areaTotal);
    const precoEng1 = Math.round(engCalc.totalEng * 100) / 100;

    // Repetição: unidades 2+ = 25% da 1ª (fixo por ora)
    const nRep   = qtdRep > 1 ? qtdRep : 1;
    const pctRep = 0.25;
    // array de unidades: [{und, precoArq, precoEng}]
    const unidades = [{ und: 1, arq: precoArq1, eng: precoEng1 }];
    for (let i = 2; i <= nRep; i++) {
      unidades.push({
        und: i,
        arq: Math.round(precoArq1 * pctRep * 100) / 100,
        eng: Math.round(precoEng1 * pctRep * 100) / 100,
      });
    }
    const precoArq = Math.round(unidades.reduce((s, u) => s + u.arq, 0) * 100) / 100;
    const precoEng = Math.round(unidades.reduce((s, u) => s + u.eng, 0) * 100) / 100;
    const areaTot  = areaTotal * nRep;

    return {
      areaBruta: Math.round(areaBruta * 100) / 100,
      areaPiscina: Math.round(areaPiscina * 100) / 100,
      areaTotal,
      areaTot,
      precoArq1, precoArq,
      precoEng1, precoEng,
      precoM2Arq: areaTot > 0 ? Math.round(precoArq / areaTot * 100) / 100 : 0,
      precoM2Eng: areaTot > 0 ? Math.round(precoEng / areaTot * 100) / 100 : 0,
      nRep, pctRep, unidades,
      // memória de cálculo
      indiceComodos, indicePadrao, fatorMult,
      precoBaseVal, precoM2Ef,
      faixasArqDet, faixasEng: engCalc.faixas,
      totalAmbientes,
      // acrescimoCirk e labelCirk direto da config — derivado também da razão real
      acrescimoCirk: tcfg.acrescimoCirk,
      labelCirk: tcfg.labelCirk || String(Math.round(tcfg.acrescimoCirk*100)),
    };
  }, [qtds, tamanho, padrao, tipoProjeto, configAtual, qtdRep, grupoQtds, isComercial, grupoParams, grupoDeComodo]);

  const temComodos = isComercial
    ? Object.entries(grupoQtds).some(([g, gq]) => gq > 0 && Object.keys(qtds).some(nome => grupoDeComodo[nome] === g && (qtds[nome]||0) > 0))
    : Object.values(qtds).some(q => q > 0);

  // ── Estilos ─────────────────────────────────────────────────
  // Injeta keyframe slideUp uma vez
  useEffect(() => {
    if (document.getElementById("slide-up-style")) return;
    const s = document.createElement("style");
    s.id = "slide-up-style";
    s.textContent = `@keyframes slideUp { from { opacity:0; transform:translateY(32px); } to { opacity:1; transform:translateY(0); } }`;
    document.head.appendChild(s);
  }, []);

  const C = {
    wrap:       { fontFamily:"inherit", color:"#111", background:"#fff", minHeight:"100vh", padding:"24px 20px", position:"relative" },
    fieldBox:   { background:"#f5f5f5", border:"1px solid #d1d5db", borderRadius:10, padding:"12px 16px", fontSize:14, color:"#6b7280" },
    fieldLabel: { fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:6, display:"block" },
    input:      { width:"100%", border:"1px solid #d1d5db", borderRadius:10, padding:"12px 16px", fontSize:14, color:"#111", outline:"none", background:"#fff", boxSizing:"border-box", fontFamily:"inherit" },
    dropWrap:   { position:"relative", display:"flex", flexDirection:"column", alignItems:"center", gap:6 },
    dropLbl:    { fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1.2, textAlign:"center" },
    dropBtn:    (open) => ({ display:"flex", alignItems:"center", gap:6, background:"#fff", border:`1px solid ${open?"#111":"#d1d5db"}`, borderRadius:10, padding:"9px 14px", fontSize:11, color: null, cursor:"pointer", fontFamily:"inherit", minWidth:110, }),
    dropBtnTxt: (val) => ({ flex:1, textAlign:"center", color: val ? "#111" : "#9ca3af" }),
    chevron:    (open) => ({ transition:"transform 0.15s", transform: open ? "rotate(180deg)" : "none", display:"flex", alignItems:"center" }),
    dropPanel:  { position:"fixed", zIndex:9999, background:"#fff", border:"1px solid #d1d5db", borderRadius:10, boxShadow:"0 4px 16px rgba(0,0,0,0.12)", minWidth:160, overflow:"hidden" },
    dropItem:   (sel) => ({ padding:"10px 16px", fontSize:14, cursor:"pointer", color:"#374151", background: sel ? "#f5f5f5" : "#fff", fontWeight: sel ? 600 : 400, borderBottom:"1px solid #f3f4f6" }),
    groupHdr:   { fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1.2, textAlign:"center", marginBottom:12 },
    sep:        { width:1, background:"#e5e7eb", alignSelf:"stretch", marginTop:22 },
    btnDefinir: { width:"100%", maxWidth:380, background:"#fff", border:"1px solid #d1d5db", borderRadius:10, padding:"13px 0", fontSize:14, color:"#374151", cursor:"pointer", fontFamily:"inherit", textAlign:"center", display:"block", margin:"0 auto" },
    aviso:      { fontSize:12, color:"#ef4444", textAlign:"center", marginTop:8 },
    // Cômodos
    comodoGrupoHdr: { fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:8, marginTop:20, background:"#f9fafb", border:"1px solid #f3f4f6", borderRadius:6, padding:"6px 10px", display:"inline-block" },
    comodoRow:  (ativo) => ({ display:"flex", alignItems:"center", gap:4, padding:"3px 0", borderBottom:"1px solid #f3f4f6", opacity: ativo ? 1 : 0.55 }),
    comodoNome: { flex:1, fontSize:14, color:"#374151" },
    comodoM2:   { fontSize:12, color:"#9ca3af", width:70, textAlign:"right", whiteSpace:"nowrap" },
    qtdWrap:    { display:"flex", alignItems:"center", gap:8 },
    qtdBtn:     { width:26, height:26, borderRadius:6, border:"1px solid #d1d5db", background:"#fff", color:"#374151", fontSize:16, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 },
    qtdNum:     (q) => ({ width:24, textAlign:"center", fontSize:14, fontWeight: q > 0 ? 700 : 400, color: q > 0 ? "#111" : "#9ca3af" }),
    qtdM2Tot:   { fontSize:12, color:"#6b7280", width:72, textAlign:"right", whiteSpace:"nowrap" },
    // Resumo
    resumoBox:  { background:"#fff", border:"1px solid #d1d5db", borderRadius:12, padding:"20px 20px" },
    resumoHdr:  { fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1.2, textAlign:"center", marginBottom:16, paddingBottom:12, borderBottom:"1px solid #f3f4f6" },
    resumoSec:  { fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:1, marginBottom:6, marginTop:14 },
    resumoVal:  { fontSize:18, fontWeight:700, color:"#111" },
    resumoM2:   { fontSize:12, color:"#9ca3af", marginTop:2 },
    resumoLinha:{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginTop:4 },
    resumoArea: { background:"#f9fafb", border:"1px solid #f3f4f6", borderRadius:8, padding:"10px 14px", marginBottom:10, fontSize:13, color:"#374151" },
  };

  // renderiza um step do fluxo inline
  function renderStep(id) {
    const open = aberto === id;
    const val  = VALS[id];
    const lbl  = LABELS[id];
    const btnRef = { current: null };
    return (
      <div style={{ position:"relative" }} key={id}>
        <button
          ref={el => { btnRef.current = el; }}
          style={{ ...C.dropBtn(open), background: val ? "#f9fafb" : "#fff" }}
          onClick={(e) => {
            if (open) { setAberto(null); return; }
            const r = e.currentTarget.getBoundingClientRect();
            setPanelPos({ top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX });
            setAberto(id);
          }}>
          <span style={C.dropBtnTxt(val)}>
            {val
              ? <><span style={{ color:"#9ca3af", fontWeight:400 }}>{lbl}: </span><span style={{ fontWeight:600, color:"#111" }}>{val}</span></>
              : <span style={{ color:"#9ca3af" }}>{lbl}</span>
            }
          </span>
          <span style={C.chevron(open)}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </button>
      </div>
    );
  }

  // Nomes de exibição dos grupos de Conj. Comercial
  const GRUPO_DISPLAY = {
    "Por Loja":        "Loja",
    "Espaço Âncora":   "Espaço Âncora",
    "Áreas Comuns":    "Área Comum",
    "Por Apartamento": "Apartamento",
    "Galpao":          "Galpão",
  };


  const [gruposAbertos, setGruposAbertos] = useState({});
  function toggleGrupo(grupo) {
    setGruposAbertos(prev => ({ ...prev, [grupo]: prev[grupo] === false ? true : false }));
  }
  function isGrupoAberto(grupo) { return gruposAbertos[grupo] !== false; }


  function setQtd(nome, delta) {
    setQtds(prev => ({ ...prev, [nome]: Math.max(0, (prev[nome] || 0) + delta) }));
  }

  function getArea(nome) {
    if (!configAtual) return 0;
    const cfg = configAtual.comodos[nome];
    if (!cfg) return 0;
    const grupo = grupoDeComodo[nome];
    const tam = isComercial && grupo && grupoParams[grupo] ? grupoParams[grupo].tamanho : tamanho;
    if (!tam) return 0;
    const [L, W] = cfg.medidas[tam] || [0, 0];
    return L * W;
  }

  const fmtNum = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });

  // Valores derivados do modal — sempre sincronizados com os estados
  const modalTotSI   = calculo ? Math.round((calculo.precoArq + calculo.precoEng)*100)/100 : 0;
  const modalTotCI   = temImposto && modalTotSI > 0 ? Math.round(modalTotSI/(1-aliqImp/100)*100)/100 : modalTotSI;
  const modalImposto = temImposto ? Math.round((modalTotCI - modalTotSI)*100)/100 : 0;

  if (propostaData) {
    // Mescla propostaData com estados atuais de pagamento — sempre sincronizado
    const liveData = {
      ...propostaData,
      tipoPgto, temImposto, aliqImp,
      resumoDescritivo: propostaData.resumoDescritivo || "",
      descArq, parcArq, descPacote, parcPacote,
      descEtCtrt, parcEtCtrt, descPacCtrt, parcPacCtrt,
      etapasPct,
      totSI: modalTotSI, totCI: modalTotCI, impostoV: modalImposto,
    };
    return <PropostaPreview data={liveData} onVoltar={() => {
      setPropostaData(null);
    }} />;
  }

  return (
    <div style={C.wrap} ref={wrapRef}>

      {/* ── Identificação ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:32 }}>
        <div>
          <span style={C.fieldLabel}>Cliente</span>
          <div style={C.fieldBox}>{clienteNome || "—"}</div>
        </div>
        <div>
          <span style={C.fieldLabel}>Referência</span>
          <input style={C.input} placeholder="Nome do projeto, endereço ou bairro"
            value={referencia} onChange={e => setReferencia(e.target.value)} />
        </div>
      </div>

      {/* ── Fluxo sequencial de parâmetros ── */}
      {!tamanho ? (
        /* Modo vertical — ainda definindo */
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start" }}>

          {/* Passo 1 — Tipo Obra */}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {renderStep("tipoObra")}
            {tipoObra && <span onClick={() => { setAberto(null); setTipoObra(null); setTipoProjeto(null); setPadrao(null); setTipologia(null); setTamanho(null); }} style={{ fontSize:11, color:"#d1d5db", cursor:"pointer", padding:"0 4px" }}>✕</span>}
          </div>

          {/* Passo 2 — Tipo Projeto */}
          {tipoObra && <>
            <div style={{ width:1, background:"#d1d5db", height:24, marginLeft:20, transition:"height 0.45s ease" }} />
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              {renderStep("tipoProjeto")}
              {tipoProjeto && <span onClick={() => { setAberto(null); setTipoProjeto(null); setPadrao(null); setTipologia(null); setTamanho(null); }} style={{ fontSize:11, color:"#d1d5db", cursor:"pointer", padding:"0 4px" }}>✕</span>}
            </div>
          </>}

          {/* Passo 3 — Padrão */}
          {tipoProjeto && <>
            <div style={{ width:1, background:"#d1d5db", height:24, marginLeft:20, transition:"height 0.45s ease" }} />
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              {renderStep("padrao")}
              {padrao && <span onClick={() => { setAberto(null); setPadrao(null); setTipologia(null); setTamanho(null); }} style={{ fontSize:11, color:"#d1d5db", cursor:"pointer", padding:"0 4px" }}>✕</span>}
            </div>
          </>}

          {/* Passo 4 — Tipologia */}
          {padrao && <>
            <div style={{ width:1, background:"#d1d5db", height:24, marginLeft:20, transition:"height 0.45s ease" }} />
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              {renderStep("tipologia")}
              {tipologia && <span onClick={() => { setAberto(null); setTipologia(null); setTamanho(null); }} style={{ fontSize:11, color:"#d1d5db", cursor:"pointer", padding:"0 4px" }}>✕</span>}
            </div>
          </>}

          {/* Passo 5 — Tamanho */}
          {tipologia && <>
            <div style={{ width:1, background:"#d1d5db", height:24, marginLeft:20, transition:"height 0.45s ease" }} />
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              {renderStep("tamanho")}
              {tamanho && <span onClick={() => { setAberto(null); setTamanho(null); }} style={{ fontSize:11, color:"#d1d5db", cursor:"pointer", padding:"0 4px" }}>✕</span>}
            </div>
          </>}

        </div>
      ) : (
        /* Modo horizontal — todos definidos, na mesma linha, clique só abre dropdown */
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center", animation:"slideUp 0.4s ease forwards" }}>
          {renderStep("tipoObra")}
          {renderStep("tipoProjeto")}
          {renderStep("padrao")}
          {renderStep("tipologia")}
          {renderStep("tamanho")}
        </div>
      )}



      {/* ── Cômodos + Resumo ── */}
      {!!tamanho && !!configAtual && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 400px", gap:32, alignItems:"start",
          animation:"slideUp 0.5s ease forwards",
          marginTop:32,
        }}>

          {/* Cômodos */}
          <div>
            {/* Repetição de unidades — oculto só para Conj. Comercial */}
            {tipoProjeto !== "Conj. Comercial" && (
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:"#f9fafb", border:"1px solid #d1d5db", borderRadius:8, marginBottom:12 }}>
                <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", flex:1 }}>
                  <input type="checkbox" checked={!!qtdRep} onChange={e => setQtdRep(e.target.checked ? 2 : 0)} />
                  <span style={{ fontSize:13, color:"#374151", fontWeight:600 }}>Repetição de unidades</span>
                  {!!qtdRep && <span style={{ fontSize:12, color:"#7c3aed", marginLeft:4 }}>{qtdRep}×</span>}
                </label>
                {!!qtdRep && (
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <button style={{ width:28, height:28, borderRadius:6, border:"1px solid #d1d5db", background:"#fff", color:"#374151", fontSize:18, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 }}
                      onClick={() => setQtdRep(n => Math.max(2, n - 1))}>−</button>
                    <span style={{ minWidth:28, textAlign:"center", fontSize:14, fontWeight:700, color:"#111" }}>{qtdRep}</span>
                    <button style={{ width:28, height:28, borderRadius:6, border:"1px solid #d1d5db", background:"#fff", color:"#374151", fontSize:18, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 }}
                      onClick={() => setQtdRep(n => n + 1)}>+</button>
                  </div>
                )}
              </div>
            )}

            {Object.entries(configAtual.grupos).filter(([grupo]) => {
                const isTerrea = tipologia === "Térreo" || tipologia === "Térrea";
                if (isTerrea && grupo === "Outros") return false;
                return true;
              }).map(([grupo, nomes]) => (
              <div key={grupo}>
                {/* Cabeçalho do grupo — mesma estrutura de colunas que a linha de cômodo */}
                <div style={{
                  display:"flex", alignItems:"center", gap:12,
                  background: "#f9fafb",
                  border: "1px solid #f3f4f6",
                  borderRadius: 8,
                  padding: "8px 12px",
                  marginTop: 20, marginBottom: 10,
                }}>
                  {/* Nome — flex:1, igual ao comodoNome */}
                  <span onClick={() => toggleGrupo(grupo)} style={{ flex:1, fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:1, fontWeight:600, cursor:"pointer" }}>
                    {isComercial ? (GRUPO_DISPLAY[grupo] || grupo) : grupo}
                  </span>
                  <span onClick={() => toggleGrupo(grupo)} style={{ fontSize:10, color:"#9ca3af", cursor:"pointer", userSelect:"none" }}>
                    {isGrupoAberto(grupo) ? "▲" : "▼"}
                  </span>
                  {isComercial ? (
                    <>
                      {/* Botões de parâmetro por grupo */}
                      {["padrao","tipologia","tamanho"].map(key => {
                        const labels = { padrao:"Padrão", tipologia:"Tipologia", tamanho:"Tamanho" };
                        const opcoes = {
                          padrao:    ["Alto","Médio","Baixo"],
                          tipologia: ["Térreo","Sobrado"],
                          tamanho:   ["Grande","Médio","Pequeno","Compacta"],
                        };
                        const gp = grupoParams[grupo] || {};
                        const val = gp[key] || "";
                        const aKey = `${grupo}__${key}`;
                        const open = abertoGrupo?.key === aKey;
                        return (
                          <div key={key} style={{ position:"relative" }}>
                            <button
                              style={{ ...C.dropBtn(open), minWidth:80, background: val ? "#f9fafb" : "#fff", padding:"5px 10px" }}
                              onClick={e => {
                                e.stopPropagation();
                                if (open) { setAbertoGrupo(null); return; }
                                const r = e.currentTarget.getBoundingClientRect();
                                setAbertoGrupo({ key: aKey, grupo, param: key, top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX });
                              }}>
                              <span style={{ ...C.dropBtnTxt(val), fontSize:10 }}>
                                {val
                                  ? <><span style={{ color:"#9ca3af", fontWeight:400 }}>{labels[key]}: </span><span style={{ fontWeight:600, color:"#111" }}>{val}</span></>
                                  : <span style={{ color:"#9ca3af" }}>{labels[key]}</span>}
                              </span>
                              <span style={C.chevron(open)}>
                                <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </span>
                            </button>
                          </div>
                        );
                      })}
                      {/* Qtd do grupo */}
                      <div style={C.qtdWrap}>
                        <button style={C.qtdBtn} onClick={() => setGrupoQtd(grupo, -1)}>−</button>
                        <span style={C.qtdNum(grupoQtds[grupo]||0)}>{grupoQtds[grupo]||0}</span>
                        <button style={C.qtdBtn} onClick={() => setGrupoQtd(grupo, +1)}>+</button>
                      </div>
                      <span style={{ width:52 }} />
                    </>
                  ) : null}
                </div>
                {isGrupoAberto(grupo) && nomes.map(nome => {
                  const q    = qtds[nome] || 0;
                  const area = getArea(nome);
                  const tot  = area * q;
                  return (
                    <div key={nome} style={C.comodoRow(q > 0)}>
                      <span style={C.comodoNome}>{nome}</span>
                      <span style={C.comodoM2}>{area > 0 ? fmtNum(area)+" m²" : "—"}</span>
                      <div style={C.qtdWrap}>
                        <button style={C.qtdBtn} onClick={() => setQtd(nome, -1)}>−</button>
                        <span style={C.qtdNum(q)}>{q}</span>
                        <button style={C.qtdBtn} onClick={() => setQtd(nome, +1)}>+</button>
                      </div>
                      <span style={C.qtdM2Tot}>{tot > 0 ? fmtNum(tot)+" m²" : ""}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Resumo Cálculo — aparece ao preencher primeiro cômodo */}
          <div style={{ position:"sticky", top:24 }}>
            {temComodos && calculo ? (
              <div>
                <div style={C.resumoBox}>
                  <div style={C.resumoHdr}>Resumo Cálculo</div>

                  {/* Áreas — expansível */}
                  <AreaDetalhe calculo={calculo} fmtNum={fmtNum} />

                  <ResumoDetalhes calculo={calculo} fmtNum={fmtNum} C={C} />
                </div>
                <button
                  style={{ width:"100%", marginTop:12, background:"#f3f4f6", color:"#111", border:"1px solid #e5e7eb", borderRadius:10, padding:"13px 0", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", letterSpacing:0.2, transition:"background 0.15s, border-color 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background="#e5e7eb"; e.currentTarget.style.borderColor="#d1d5db"; }}
                  onMouseLeave={e => { e.currentTarget.style.background="#f3f4f6"; e.currentTarget.style.borderColor="#e5e7eb"; }}
                  onClick={() => setShowModal(true)}>
                  Gerar Orçamento
                </button>
              </div>
            ) : (
              <div style={{ ...C.resumoBox, textAlign:"center", padding:"32px 20px" }}>
                <div style={{ fontSize:12, color:"#d1d5db" }}>Resumo Cálculo</div>
                <div style={{ fontSize:11, color:"#e5e7eb", marginTop:8 }}>Preencha os ambientes</div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Valores derivados para o modal e propostaData — sempre atualizados */}
      {(() => {
        if (calculo) {
          const _arqV = calculo.precoArq;
          const _engV = calculo.precoEng;
          const _totSI = _arqV + _engV;
          const _totCI = temImposto ? Math.round(_totSI/(1-aliqImp/100)*100)/100 : _totSI;
          const _impostoV = temImposto ? Math.round((_totCI-_totSI)*100)/100 : 0;
          // Injeta no escopo externo via ref para uso no setPropostaData
          window.__obraModalVals = { totSI: _totSI, totCI: _totCI, impostoV: _impostoV };
        }
        return null;
      })()}

      {/* Modal Gerar Orçamento */}
      {showModal && calculo && (() => {
        const fmtV = (v) => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
        const arqV  = calculo.precoArq;
        const engV  = calculo.precoEng;
        const totSI = arqV + engV;
        const semImpFator = 1 - aliqImp/100;
        const totCI = temImposto ? Math.round(totSI/semImpFator*100)/100 : totSI;
        const impostoV = temImposto ? Math.round((totCI-totSI)*100)/100 : 0;
        const isPadrao = tipoPgto === "padrao";
        const arqComDesc  = Math.round(arqV*(1-descArq/100)*100)/100;
        const totComDesc  = Math.round(totCI*(1-descPacote/100)*100)/100;
        const inpS = { width:44, textAlign:"center", border:"1px solid #e5e7eb", borderRadius:6, padding:"3px 4px", fontSize:12, fontWeight:600, outline:"none", fontFamily:"inherit", background:"#fff", color:"#111" };
        const cardSty = (sel) => ({ border:`1.5px solid ${sel?"#111":"#e5e7eb"}`, borderRadius:12, padding:"14px 16px", marginBottom:10, cursor:"pointer", background:"#fff", transition:"border-color 0.15s" });
        const radioCircle = (sel) => ({ width:18, height:18, borderRadius:9, border:`1.5px solid ${sel?"#111":"#d1d5db"}`, background:sel?"#111":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 });
        return (
          <>
            <style>{`
              @keyframes fadeInOvr { from{opacity:0} to{opacity:1} }
              @keyframes slideUpSht { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
            `}</style>
            <div onClick={() => setShowModal(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:9000, animation:"fadeInOvr 0.25s ease" }}>
              <div onClick={e=>e.stopPropagation()} style={{
                position:"fixed", bottom:0, left:0, right:0, maxHeight:"90vh", overflowY:"auto",
                background:"#fff", borderRadius:"20px 20px 0 0", padding:"24px 20px 36px",
                animation:"slideUpSht 0.35s cubic-bezier(0.32,0.72,0,1)", zIndex:9001,
              }}>
                <div style={{ width:36, height:4, background:"#e5e7eb", borderRadius:2, margin:"0 auto 18px" }} />
                <div style={{ fontSize:17, fontWeight:700, color:"#111", marginBottom:4 }}>Gerar Orçamento</div>
                <div style={{ fontSize:12, color:"#9ca3af", marginBottom:20 }}>
                  {tipoProjeto} · {tipoObra} · Padrão {padrao} · {tipologia} · Ambientes {tamanho}s
                </div>

                {/* Resumo valores */}
                <div style={{ background:"#f9fafb", borderRadius:12, padding:"14px 16px", marginBottom:20 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontSize:12, color:"#6b7280" }}>Arquitetura</span>
                    <span style={{ fontSize:13, fontWeight:600, color:"#111" }}>{fmtV(arqV)}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontSize:12, color:"#6b7280" }}>Engenharia</span>
                    <span style={{ fontSize:13, fontWeight:600, color:"#111" }}>{fmtV(engV)}</span>
                  </div>
                  {temImposto && <>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                      <span style={{ fontSize:12, color:"#6b7280" }}>Subtotal sem impostos</span>
                      <span style={{ fontSize:12, color:"#6b7280" }}>{fmtV(totSI)}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                      <span style={{ fontSize:12, color:"#ef4444" }}>+ Impostos ({aliqImp}%)</span>
                      <span style={{ fontSize:12, color:"#ef4444" }}>+{fmtV(impostoV)}</span>
                    </div>
                  </>}
                  <div style={{ display:"flex", justifyContent:"space-between", paddingTop:10, borderTop:"1px solid #e5e7eb" }}>
                    <span style={{ fontSize:14, fontWeight:700, color:"#111" }}>Total Geral</span>
                    <span style={{ fontSize:16, fontWeight:800, color:"#111" }}>{fmtV(totCI)}</span>
                  </div>
                </div>

                {/* Imposto */}
                <div style={{ background:"#fafafa", border:"1px solid #f0f0f0", borderRadius:12, padding:"12px 14px", marginBottom:16, display:"flex", alignItems:"center", gap:10 }}>
                  <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", flex:1 }}>
                    <input type="checkbox" checked={temImposto} onChange={e=>setTemImposto(e.target.checked)} />
                    <span style={{ fontSize:13, color:"#374151", fontWeight:500 }}>Incluir Impostos</span>
                  </label>
                  {temImposto && (
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <input type="number" min="0" max="50" step="0.5" style={inpS} value={aliqImp} onChange={e=>setAliqImp(parseFloat(e.target.value)||0)} />
                      <span style={{ fontSize:12, color:"#9ca3af" }}>%</span>
                    </div>
                  )}
                </div>

                {/* Forma de Pagamento */}
                <div style={{ fontSize:11, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:10, fontWeight:600 }}>Forma de pagamento</div>

                {/* Dois cards lado a lado */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, alignItems:"start" }}>

                  {/* Card Padrão */}
                  <div style={cardSty(isPadrao)} onClick={()=>setTipoPgto("padrao")}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: isPadrao ? 12 : 0 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:"#111" }}>Pagamento Padrão</div>
                        <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>Antecipado ou parcelado</div>
                      </div>
                      <div style={radioCircle(isPadrao)}>{isPadrao && <span style={{ color:"#fff", fontSize:10, fontWeight:900 }}>✓</span>}</div>
                    </div>
                    {isPadrao && (
                      <div style={{ paddingTop:12, borderTop:"1px solid #f0f0f0" }} onClick={e=>e.stopPropagation()}>
                        <div style={{ background:"#fafafa", borderRadius:8, padding:"8px 10px", marginBottom:8 }}>
                          <div style={{ fontSize:11, color:"#374151", fontWeight:700, marginBottom:6 }}>Apenas Arquitetura</div>
                          <div style={{ marginBottom:5, paddingBottom:5, borderBottom:"1px solid #f0f0f0" }}>
                            <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Antecipado</div>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <input type="number" min="0" max="50" style={inpS} value={descArq} onChange={e=>setDescArq(parseFloat(e.target.value)||0)} />
                              <span style={{ fontSize:10, color:"#8e8e93" }}>% OFF → {fmtV(arqComDesc)}</span>
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Parcelado</div>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <input type="number" min="1" max="24" style={inpS} value={parcArq} onChange={e=>setParcArq(parseInt(e.target.value)||3)} />
                              <span style={{ fontSize:10, color:"#8e8e93" }}>× → {fmtV(arqV/(parcArq||3))}/mês</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ background:"#fafafa", borderRadius:8, padding:"8px 10px" }}>
                          <div style={{ fontSize:11, color:"#374151", fontWeight:700, marginBottom:6 }}>Pacote (Arq. + Eng.)</div>
                          <div style={{ marginBottom:5, paddingBottom:5, borderBottom:"1px solid #f0f0f0" }}>
                            <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Antecipado</div>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <input type="number" min="0" max="50" style={inpS} value={descPacote} onChange={e=>setDescPacote(parseFloat(e.target.value)||0)} />
                              <span style={{ fontSize:10, color:"#8e8e93" }}>% OFF → {fmtV(totComDesc)}</span>
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Parcelado</div>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <input type="number" min="1" max="24" style={inpS} value={parcPacote} onChange={e=>setParcPacote(parseInt(e.target.value)||4)} />
                              <span style={{ fontSize:10, color:"#8e8e93" }}>× → {fmtV(totCI/(parcPacote||4))}/mês</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Por Etapas */}
                  <div style={cardSty(!isPadrao)} onClick={()=>setTipoPgto("etapas")}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: !isPadrao ? 12 : 0 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:"#111" }}>Pagamento por Etapas</div>
                        <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>Desconto por etapa</div>
                      </div>
                      <div style={radioCircle(!isPadrao)}>{!isPadrao && <span style={{ color:"#fff", fontSize:10, fontWeight:900 }}>✓</span>}</div>
                    </div>
                    {!isPadrao && (
                      <div style={{ paddingTop:12, borderTop:"1px solid #f0f0f0", display:"grid", gridTemplateColumns:"1fr 1.5fr", gap:8 }} onClick={e=>e.stopPropagation()}>

                        {/* Esquerda — condições */}
                        <div>
                          <div style={{ background:"#fafafa", borderRadius:8, padding:"8px 10px", marginBottom:8 }}>
                            <div style={{ fontSize:11, color:"#374151", fontWeight:700, marginBottom:6 }}>Etapa a Etapa</div>
                            <div style={{ marginBottom:5, paddingBottom:5, borderBottom:"1px solid #f0f0f0" }}>
                              <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Antecipado</div>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <input type="number" min="0" max="50" style={inpS} value={descEtCtrt} onChange={e=>setDescEtCtrt(parseFloat(e.target.value)||0)} />
                                <span style={{ fontSize:10, color:"#8e8e93" }}>% OFF/etapa</span>
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Parcelado</div>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <input type="number" min="1" max="12" style={inpS} value={parcEtCtrt} onChange={e=>setParcEtCtrt(parseInt(e.target.value)||2)} />
                                <span style={{ fontSize:10, color:"#8e8e93" }}>×/etapa</span>
                              </div>
                            </div>
                          </div>
                          <div style={{ background:"#fafafa", borderRadius:8, padding:"8px 10px" }}>
                            <div style={{ fontSize:11, color:"#374151", fontWeight:700, marginBottom:6 }}>Pacote Completo</div>
                            <div style={{ marginBottom:5, paddingBottom:5, borderBottom:"1px solid #f0f0f0" }}>
                              <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Antecipado</div>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <input type="number" min="0" max="50" style={inpS} value={descPacCtrt} onChange={e=>setDescPacCtrt(parseFloat(e.target.value)||0)} />
                                <span style={{ fontSize:10, color:"#8e8e93" }}>% OFF → {fmtV(Math.round(totCI*(1-descPacCtrt/100)*100)/100)}</span>
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize:10, color:"#8e8e93", marginBottom:3, fontWeight:600 }}>Parcelado</div>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <input type="number" min="1" max="24" style={inpS} value={parcPacCtrt} onChange={e=>setParcPacCtrt(parseInt(e.target.value)||8)} />
                                <span style={{ fontSize:10, color:"#8e8e93" }}>× → {fmtV(Math.round(totCI*(1-descPacCtrt/100)/parcPacCtrt*100)/100)}/mês</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Direita — etapas */}
                        <div style={{ background:"#fafafa", borderRadius:8, padding:"8px 10px" }}>
                          <div style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:8, fontWeight:600 }}>Etapas</div>
                          {(() => {
                            const totalPct = etapasPct.reduce((s,e)=>s+e.pct,0);
                            return (<>
                              {etapasPct.map((et, i) => {
                                const val = Math.round(totCI * et.pct/100 * 100)/100;
                                return (
                                  <div key={et.id} style={{ display:"flex", alignItems:"center", gap:5, marginBottom:5 }}>
                                    <input
                                      style={{ flex:1, border:"none", borderBottom:"1px solid #e5e7eb", background:"transparent", fontSize:11, color:"#374151", outline:"none", fontFamily:"inherit", padding:"1px 0", minWidth:0 }}
                                      value={et.nome}
                                      onChange={e=>setEtapasPct(prev=>prev.map((p,j)=>j===i?{...p,nome:e.target.value}:p))}
                                    />
                                    <div style={{ display:"flex", alignItems:"center", gap:2, flexShrink:0 }}>
                                      <input type="number" min="0" max="100"
                                        style={{ width:40, textAlign:"center", border:"1px solid #e5e7eb", borderRadius:5, padding:"1px 4px", fontSize:11, fontWeight:600, outline:"none", fontFamily:"inherit", background:"#fff" }}
                                        value={et.pct}
                                        onChange={e=>setEtapasPct(prev=>prev.map((p,j)=>j===i?{...p,pct:parseFloat(e.target.value)||0}:p))}
                                      />
                                      <span style={{ color:"#9ca3af", fontSize:10 }}>%</span>
                                    </div>
                                    <span style={{ color:"#374151", fontWeight:600, fontSize:10, whiteSpace:"nowrap", minWidth:72, textAlign:"right" }}>{fmtV(val)}</span>
                                    {etapasPct.length > 1 && (
                                      <span onClick={()=>setEtapasPct(prev=>prev.filter((_,j)=>j!==i))} style={{ color:"#d1d5db", cursor:"pointer", fontSize:11, flexShrink:0 }}>✕</span>
                                    )}
                                  </div>
                                );
                              })}
                              <div style={{ display:"flex", justifyContent:"space-between", paddingTop:5, borderTop:"1px solid #e5e7eb", marginTop:2 }}>
                                <span style={{ fontSize:10, color: totalPct===100?"#9ca3af":"#ef4444", fontWeight:600 }}>{totalPct}%</span>
                                <span style={{ fontSize:10, fontWeight:700, color:"#111" }}>{fmtV(Math.round(totCI*totalPct/100*100)/100)}</span>
                              </div>
                              <button onClick={()=>setEtapasPct(prev=>[...prev,{id:Date.now(),nome:`Etapa ${prev.length+1}`,pct:0}])}
                                style={{ marginTop:5, fontSize:10, color:"#374151", background:"#fff", border:"1px solid #e5e7eb", borderRadius:5, padding:"2px 6px", cursor:"pointer", fontFamily:"inherit", width:"100%" }}>
                                + Etapa
                              </button>
                            </>);
                          })()}
                        </div>

                      </div>
                    )}
                  </div>

                </div>

                {/* Confirmar */}
                <button
                  style={{ width:"100%", marginTop:8, background:"#111", color:"#fff", border:"none", borderRadius:12, padding:"15px 0", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}
                  onClick={() => {
                    setPropostaData({
                      tipoProjeto, tipoObra, padrao, tipologia, tamanho,
                      clienteNome, referencia,
                      comodos: Object.entries(qtds).filter(([,q])=>q>0).map(([nome,qtd])=>({nome,qtd})),
                      resumoDescritivo: (() => {
                        const fmtN2 = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
                        const fmtArea = v => v > 0 ? fmtN2(v)+"m²" : null;
                        // Conj. Comercial
                        if (isComercial && calculo?.isComercial) {
                          const c = calculo;
                          const partes = [];
                          const nL = grupoQtds["Por Loja"]||0, nA = grupoQtds["Espaço Âncora"]||0;
                          const nAp = grupoQtds["Por Apartamento"]||0, nG = grupoQtds["Galpao"]||0;
                          if (nL>0 && c.blocosCom) { const b=c.blocosCom.find(x=>x.label==="Loja"); if(b) partes.push(`${nL} loja${nL!==1?"s":""} (${fmtArea(b.area1*nL)})`); }
                          if (nA>0 && c.blocosCom) { const b=c.blocosCom.find(x=>x.label==="Âncora"); if(b) partes.push(`${nA} ${nA===1?"Espaço Âncora":"Espaços Âncoras"} (${fmtArea(b.area1*nA)})`); }
                          if (nAp>0 && c.blocosCom) { const b=c.blocosCom.find(x=>x.label==="Apartamento"); if(b) partes.push(`${nAp} apartamento${nAp!==1?"s":""} (${fmtArea(b.area1*nAp)})`); }
                          if (nG>0 && c.blocosCom) { const b=c.blocosCom.find(x=>x.label==="Galpão"); if(b) partes.push(`${nG} ${nG!==1?"galpões":"galpão"} (${fmtArea(b.area1*nG)})`); }
                          if (c.blocosCom) { const bc=c.blocosCom.find(x=>x.label==="Área Comum"); if(bc) partes.push(`Área Comum (${fmtArea(bc.area1)})`); }
                          const lista = partes.length>1 ? partes.slice(0,-1).join(", ")+" e "+partes[partes.length-1] : partes[0]||"";
                          return `Conjunto comercial, contendo ${lista}, totalizando ${fmtArea(c.areaTot||c.areaTotal)}.`;
                        }
                        // Residencial
                        const nUnid = calculo?.nRep || 1;
                        const areaUni = calculo?.areaTotal || calculo?.areaTot || 0;
                        const areaTotR = Math.round(areaUni * nUnid * 100)/100;
                        const comAtivos = Object.entries(qtds).filter(([,q])=>q>0).map(([n])=>n.toLowerCase());
                        const totalAmb = Object.entries(qtds).filter(([,q])=>q>0).reduce((s,[,q])=>s+q,0);
                        const listaStr = comAtivos.length>1 ? comAtivos.slice(0,-1).join(", ")+" e "+comAtivos[comAtivos.length-1] : comAtivos[0]||"";
                        const tipDesc = (tipologia||"").toLowerCase().includes("sobrado") ? "com dois pavimentos" : "térrea";
                        const numFem = ["","uma","duas","três","quatro","cinco","seis","sete","oito","nove","dez"];
                        if (nUnid>1) {
                          const nExt = nUnid>=1&&nUnid<=10 ? numFem[nUnid] : String(nUnid);
                          return `${nExt.charAt(0).toUpperCase()+nExt.slice(1)} residências ${tipDesc} idênticas, com ${fmtN2(areaUni)}m² por unidade, totalizando ${fmtN2(areaTotR)}m² de área construída. Cada unidade composta por ${totalAmb} ambientes: ${listaStr}.`;
                        }
                        return `Uma residência ${tipDesc}, com ${fmtN2(areaUni)}m² de área construída, composta por ${totalAmb} ambientes: ${listaStr}.`;
                      })(),
                      grupoQtds: isComercial ? grupoQtds : null,
                      calculo,
                      // pagamento
                      tipoPgto, temImposto, aliqImp,
                      descArq, parcArq, descPacote, parcPacote,
                      descEtCtrt, parcEtCtrt, descPacCtrt, parcPacCtrt,
                      etapasPct,
                      // valores finais
                      totSI: modalTotSI, totCI: modalTotCI, impostoV: modalImposto,
                    });
                    // Salvar imediatamente no banco
                    const orcParaSalvar = {
                      ...(orcBase || {}),
                      tipo: tipoProjeto, subtipo: tipoObra, tipologia, tamanho, padrao,
                      cliente: clienteNome, referencia,
                      comodos: Object.entries(qtds).filter(([,q])=>q>0).map(([nome,qtd])=>({nome,qtd})),
                      repeticao: qtdRep > 0, nUnidades: qtdRep > 0 ? qtdRep : 1,
                      grupoQtds: isComercial ? grupoQtds : null,
                      grupoParams: isComercial ? grupoParams : null,
                      resultado: { ...calculo, precoArq: calculo?.precoArq || 0, precoEng: calculo?.precoEng || 0, areaTotal: calculo?.areaTotal || 0 },
                      tipoPgto, temImposto, aliqImp,
                      descArq, parcArq, descPacote, parcPacote,
                      descEtCtrt, parcEtCtrt, descPacCtrt, parcPacCtrt,
                      etapasPct,
                      totSI: modalTotSI, totCI: modalTotCI, impostoV: modalImposto,
                    };
                    if (onSalvar) onSalvar(orcParaSalvar);
                    setOrcPendente(null);
                    setShowModal(false);
                  }}>
                  Confirmar e Gerar Orçamento
                </button>
                <button
                  style={{ width:"100%", marginTop:8, background:"transparent", color:"#9ca3af", border:"none", padding:"12px 0", fontSize:14, cursor:"pointer", fontFamily:"inherit" }}
                  onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {aberto && (
        <div style={{
          position:"fixed",
          top: panelPos.top, left: panelPos.left,
          zIndex:9999,
          background:"#fff", border:"1px solid #d1d5db", borderRadius:10,
          boxShadow:"0 4px 20px rgba(0,0,0,0.12)", minWidth:160, overflow:"hidden",
        }}>
          {(OPCOES[aberto] || []).map(op => {
            const val = VALS[aberto];
            return (
              <div key={op}
                style={C.dropItem(val === op)}
                onMouseEnter={e => { if (val !== op) e.currentTarget.style.background = "#f9fafb"; }}
                onMouseLeave={e => { if (val !== op) e.currentTarget.style.background = val === op ? "#f5f5f5" : "#fff"; }}
                onClick={() => selecionar(aberto, op)}>
                {op}
              </div>
            );
          })}
        </div>
      )}

      {/* Painel dropdown — parâmetros por grupo comercial */}
      {abertoGrupo && (
        <div style={{
          position:"fixed",
          top: abertoGrupo.top, left: abertoGrupo.left,
          zIndex:9999,
          background:"#fff", border:"1px solid #d1d5db", borderRadius:10,
          boxShadow:"0 4px 20px rgba(0,0,0,0.12)", minWidth:130, overflow:"hidden",
        }}>
          {({ padrao:["Alto","Médio","Baixo"], tipologia:["Térreo","Sobrado"], tamanho:["Grande","Médio","Pequeno","Compacta"] }[abertoGrupo.param] || []).map(op => {
            const cur = (grupoParams[abertoGrupo.grupo] || {})[abertoGrupo.param];
            return (
              <div key={op}
                style={C.dropItem(cur === op)}
                onMouseEnter={e => { if (cur !== op) e.currentTarget.style.background = "#f9fafb"; }}
                onMouseLeave={e => { if (cur !== op) e.currentTarget.style.background = cur === op ? "#f5f5f5" : "#fff"; }}
                onClick={() => setGrupoParam(abertoGrupo.grupo, abertoGrupo.param, op)}>
                {op}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}


