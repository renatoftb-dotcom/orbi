// ═══════════════════════════════════════════════════════════════
// RESULTADO DO ORÇAMENTO
// ═══════════════════════════════════════════════════════════════
function ResultadoOrcamentoProjeto({ orc, onEditar, onVerProposta, fmt, fmtM2 }) {
  const r = orc.resultado || {};
  const comodosAtivos = orc.comodos?.filter(c => c.qtd > 0) || [];
  // Controla quais cards têm detalhes expandidos (lojas, ancora, apto, memoria, tabela)
  const [expandido, setExpandido] = useState({ lojas:false, ancora:false, apto:false, galpao:false, memoria:false, tabela:false, eng:false, arq:false });
  const [incluiArq, setIncluiArq] = useState(true);
  const [incluiEng, setIncluiEng] = useState(true);
  const _arqBase = r.precoArq || r.precoTotal || r.precoFinal || 0;
  const _engRaw  = Math.round((r.engTotal ?? calcularEngenharia(r.areaTotal||0).totalEng) * 100) / 100;
  const _engRepFator = (r.nUnidades||1) > 1
    ? (r.repeticaoFaixas||[]).length > 0
      ? (1 + (r.repeticaoFaixas||[]).reduce((s,f) => s + f.pct, 0))
      : (() => {
          let f = 1, acu = r.areaTotal||0;
          for (let i = 2; i <= (r.nUnidades||1); i++) {
            f += getTipoConfig(orc.tipo||r.tipo).repeticaoPcts(acu);
            acu += r.areaTotal||0;
          }
          return f;
        })()
    : 1;
  const _engRep = Math.round(_engRaw * _engRepFator * 100) / 100;
  const toggleExp = key => setExpandido(p => ({ ...p, [key]: !p[key] }));
  const BtnExp = ({ k }) => (
    <button onClick={()=>toggleExp(k)}
      style={{ background:"none", border:"1px solid #334155", borderRadius:4, color:"#64748b",
               fontSize:11, padding:"1px 7px", cursor:"pointer", fontFamily:"inherit", lineHeight:1.6 }}>
      {expandido[k] ? "▲ retrair" : "▼ expandir"}
    </button>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* HEADER RESULTADO */}
      <div style={S.resultHeader}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ color:"#64748b", fontSize:12, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Orçamento de Projeto</div>
            <h2 style={{ color:"#f1f5f9", fontWeight:900, fontSize:22, margin:0 }}>{orc.cliente || "Sem identificação"}</h2>
            {orc.tipo === "Comercial" ? (
              <div style={{ marginTop:6, display:"flex", flexDirection:"column", gap:4 }}>
                <span style={{ color:"#64748b", fontSize:12 }}>{orc.tipo} · {orc.subtipo} · Tipologia {orc.tipologia}</span>
                <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                  {(r.nLojas||0) > 0 && (
                    <div style={{ background:"#0f172a", border:"1px solid #1e3a5f", borderRadius:8, padding:"5px 12px", fontSize:11 }}>
                      <span style={{ color:"#3b82f6", fontWeight:700 }}>🏪 {r.nLojas}x Loja</span>
                      <span style={{ color:"#475569", margin:"0 4px" }}>·</span>
                      <span style={{ color:"#64748b" }}>Padrão <b style={{color:"#94a3b8"}}>{r.padraoLoja||orc.padrao}</b></span>
                      <span style={{ color:"#475569", margin:"0 4px" }}>·</span>
                      <span style={{ color:"#64748b" }}>Cômodos <b style={{color:"#94a3b8"}}>{r.tamanhoLoja||orc.tamanho}</b></span>
                    </div>
                  )}
                  {(r.nAncoras||0) > 0 && (
                    <div style={{ background:"#0f172a", border:"1px solid #2e1065", borderRadius:8, padding:"5px 12px", fontSize:11 }}>
                      <span style={{ color:"#6366f1", fontWeight:700 }}>🏬 {r.nAncoras}x Âncora</span>
                      <span style={{ color:"#475569", margin:"0 4px" }}>·</span>
                      <span style={{ color:"#64748b" }}>Padrão <b style={{color:"#94a3b8"}}>{r.padraoAncora||orc.padrao}</b></span>
                      <span style={{ color:"#475569", margin:"0 4px" }}>·</span>
                      <span style={{ color:"#64748b" }}>Cômodos <b style={{color:"#94a3b8"}}>{r.tamanhoAncora||orc.tamanho}</b></span>
                    </div>
                  )}
                  {(r.nApartamentos||0) > 0 && (
                    <div style={{ background:"#0f172a", border:"1px solid #451a03", borderRadius:8, padding:"5px 12px", fontSize:11 }}>
                      <span style={{ color:"#f59e0b", fontWeight:700 }}>🏠 {r.nApartamentos}x Apto</span>
                      <span style={{ color:"#475569", margin:"0 4px" }}>·</span>
                      <span style={{ color:"#64748b" }}>Padrão <b style={{color:"#94a3b8"}}>{r.padraoApto||orc.padrao}</b></span>
                      <span style={{ color:"#475569", margin:"0 4px" }}>·</span>
                      <span style={{ color:"#64748b" }}>Cômodos <b style={{color:"#94a3b8"}}>{r.tamanhoApto||orc.tamanho}</b></span>
                    </div>
                  )}
                  {(r.nGalpoes||0) > 0 && (
                    <div style={{ background:"#0f172a", border:"1px solid #334155", borderRadius:8, padding:"5px 12px", fontSize:11 }}>
                      <span style={{ color:"#94a3b8", fontWeight:700 }}>{r.nGalpoes===1?"🏭 1x Galpão":"🏭 "+r.nGalpoes+"x Galpões"}</span>
                      <span style={{ color:"#475569", margin:"0 4px" }}>·</span>
                      <span style={{ color:"#64748b" }}>Padrão <b style={{color:"#94a3b8"}}>{r.padraoGalpao||orc.padrao}</b></span>
                      <span style={{ color:"#475569", margin:"0 4px" }}>·</span>
                      <span style={{ color:"#64748b" }}>Cômodos <b style={{color:"#94a3b8"}}>{r.tamanhoGalpao||orc.tamanho}</b></span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ color:"#64748b", fontSize:13, margin:"6px 0 0" }}>
                {orc.tipo} · {orc.subtipo} · Tipologia {orc.tipologia} · Padrão {orc.padrao} · Tamanho {orc.tamanho}
              </p>
            )}
          </div>
          <div style={{ textAlign:"right", display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
            <div style={{ color:"#64748b", fontSize:11 }}>Emitido em</div>
            <div style={{ color:"#94a3b8", fontSize:13 }}>{new Date(orc.criadoEm).toLocaleDateString("pt-BR")}</div>
            <div style={{ display:"flex", gap:8, marginTop:4, flexWrap:"wrap" }}>
              <button style={{ ...S.btnSecondary }} onClick={onEditar}>✏ Editar</button>
              <button style={{ background:"linear-gradient(135deg,#7c3aed,#5b21b6)", color:"#fff", border:"none", borderRadius:8, padding:"9px 16px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}
                onClick={() => document.getElementById("proposta-comercial-print")?.scrollIntoView({ behavior:"smooth" })}>
                📄 Ver Proposta
              </button>

              {orc.whatsapp && (
                <button style={S.btnWA}
                  onClick={() => {
                    const engTotal = orc.resultado?.engTotal ?? calcularEngenharia(orc.resultado?.areaTotal||0).totalEng;
                    const grandTotal = Math.round(((orc.resultado?.precoFinal||0) + engTotal) * 100) / 100;
                    const msg = `Olá ${orc.cliente?.split(" ")[0] || ""}! 👋\n\nSegue o orçamento do seu projeto:\n\n` +
                      `📐 *${orc.tipo} — ${orc.subtipo}*\n` +
                      `🏠 Tipologia: ${orc.tipologia} | Padrão: ${orc.padrao} | Tamanho: ${orc.tamanho}\n` +
                      `📏 Área total: ${fmtA(orc.resultado?.areaTotal,2)} m²\n\n` +
                      `💰 Projeto Arquitetônico: ${(orc.resultado?.precoFinal||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}\n` +
                      `🔩 Engenharia (Estrutural + Elétrico + Hidrossanitário): ${engTotal.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}\n\n` +
                      `💵 *Total Geral: ${grandTotal.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}*\n\n` +
                      `Qualquer dúvida estou à disposição!`;
                    const num = orc.whatsapp.replace(/\D/g,"");
                    const numero = num.startsWith("55") ? num : "55"+num;
                    const a = document.createElement("a");
                    a.href = "https://wa.me/"+numero+"?text="+encodeURIComponent(msg);
                    a.target = "_blank";
                    a.rel = "noopener noreferrer";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}>
                  💬 Enviar pelo WhatsApp
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TOGGLES ARQ / ENG */}
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", background:"#0a1222", border:"1px solid #1e293b", borderRadius:10, padding:"10px 16px", marginBottom:6 }}>
          <span style={{ color:"#475569", fontSize:12, fontWeight:600 }}>Incluir:</span>
          <div onClick={()=>setIncluiArq(v=>!v)} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", background:incluiArq?"#0f172a":"#080e1a", border:`1px solid ${incluiArq?"#10b981":"#1e293b"}`, borderRadius:8, padding:"5px 12px", userSelect:"none" }}>
            <div style={{ width:14, height:14, borderRadius:3, border:`2px solid ${incluiArq?"#10b981":"#334155"}`, background:incluiArq?"#10b981":"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
              {incluiArq && <span style={{ color:"#fff", fontSize:10, fontWeight:900 }}>✓</span>}
            </div>
            <span style={{ color:incluiArq?"#10b981":"#475569", fontWeight:700, fontSize:13 }}>Arquitetura</span>
          </div>
          <div onClick={()=>setIncluiEng(v=>!v)} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", background:incluiEng?"#0f172a":"#080e1a", border:`1px solid ${incluiEng?"#a78bfa":"#1e293b"}`, borderRadius:8, padding:"5px 12px", userSelect:"none" }}>
            <div style={{ width:14, height:14, borderRadius:3, border:`2px solid ${incluiEng?"#a78bfa":"#334155"}`, background:incluiEng?"#a78bfa":"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
              {incluiEng && <span style={{ color:"#fff", fontSize:10, fontWeight:900 }}>✓</span>}
            </div>
            <span style={{ color:incluiEng?"#a78bfa":"#475569", fontWeight:700, fontSize:13 }}>Engenharia</span>
          </div>
          <span style={{ marginLeft:"auto", color:"#f59e0b", fontWeight:800 }}>{fmt((incluiArq?(_arqBase):0)+(incluiEng?(_engRep):0))}</span>
        </div>

        {/* KPIs principais */}
        {(() => {
          const engTotal = _engRaw;
          const nUnid = r.nUnidades || 1;
          const arqTotal = _arqBase;
          const engTotalRepet = _engRep;
          const grandTotal = Math.round((arqTotal + engTotalRepet) * 100) / 100;
          const temRepet = nUnid > 1;
          const isComercial = r.tipo === "Comercial";
          const at1 = r.areaTotal || 1;
          const atTotal = at1 * nUnid;
          const tcfgR = getTipoConfig(r.tipo);
          // Imposto
          const temImposto = !!(orc.temImposto ?? r.impostoAplicado);
          const aliqImp = orc.aliqImp ?? r.aliquotaImposto ?? 0;
          // Valor sem imposto = valor_bruto * (1 - aliq/100) pois foi calculado por dentro
          const totalComImposto = (incluiArq?arqTotal:0)+(incluiEng?engTotalRepet:0);
          const totalSemImposto = temImposto ? Math.round(totalComImposto * (1 - aliqImp/100) * 100) / 100 : totalComImposto;
          const valorImposto    = temImposto ? Math.round((totalComImposto - totalSemImposto) * 100) / 100 : 0;
          return (
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:20 }}>
              {/* Cards KPI — sempre no topo */}
              {(() => {
                const cards = [
                  { l:"Área Útil",         v:fmtM2(r.areaBruta),  c:"#3b82f6", m2:null },
                  { l:`Área Total (+${tcfgR.labelCirk}%)${temRepet ? ` · ${nUnid} unid.` : ""}`,
                    v: temRepet ? fmtM2(atTotal) : fmtM2(at1), c:"#6366f1",
                    m2: temRepet ? `1 unid.: ${fmtM2(at1)}` : null },
                  ...(incluiArq ? [{ l: isComercial ? "Projeto Arq." : temRepet ? `Arq. (${nUnid} unid.)` : "Projeto Arq.",
                    v: fmt(arqTotal), c:"#10b981",
                    m2: atTotal > 0 ? `R$ ${fmtA(arqTotal/atTotal)}/m²` : null,
                    sub: temRepet && !isComercial ? `1ª unid: ${fmt(r.precoFinal)} · R$ ${fmtA(r.precoFinal/at1)}/m²` : null }] : []),
                  ...(incluiEng ? [{ l: isComercial ? "Eng. (3 proj.)" : temRepet ? `Eng. (${nUnid} unid.)` : "Eng. (3 proj.)",
                    v: fmt(engTotalRepet), c:"#a78bfa",
                    m2: atTotal > 0 ? `R$ ${fmtA(engTotalRepet/atTotal)}/m²` : null,
                    sub: temRepet && !isComercial ? `1ª unid: ${fmt(engTotal)} · R$ ${fmtA(engTotal/at1)}/m²` : null }] : []),
                ];
                return (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    <div style={{ display:"grid", gridTemplateColumns:`repeat(${cards.length},1fr)`, gap:12, marginBottom:0 }}>
                      {cards.map(({l,v,c,m2,sub}) => (
                        <div key={l} style={{ background:"rgba(0,0,0,0.3)", borderRadius:10, padding:"14px 16px", borderTop:`3px solid ${c}` }}>
                          <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:0.5 }}>{l}</div>
                          <div style={{ color:c, fontWeight:800, fontSize:17, marginTop:4 }}>{v}</div>
                          {m2 && <div style={{ color:"#475569", fontSize:10, marginTop:3 }}>{m2}</div>}
                          {sub && <div style={{ color:"#475569", fontSize:10, marginTop:2 }}>{sub}</div>}
                        </div>
                      ))}
                    </div>

                    {/* TOTAL GERAL — card separado destacado */}
                    <div style={{ background:"rgba(0,0,0,0.4)", borderRadius:10, padding:"14px 20px", borderTop:"3px solid #f59e0b", display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:8 }}>
                      <div>
                        <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:0.5, marginBottom:4 }}>
                          {temRepet ? `TOTAL GERAL · ${nUnid} unid.` : "TOTAL GERAL"}
                        </div>
                        {temImposto ? (
                          <>
                            <div style={{ color:"#94a3b8", fontSize:12, marginBottom:2 }}>
                              Sem imposto: {fmt(totalSemImposto)}
                            </div>
                            <div style={{ color:"#f59e0b", fontWeight:900, fontSize:22 }}>
                              {fmt(totalComImposto)}
                            </div>
                          </>
                        ) : (
                          <div style={{ color:"#f59e0b", fontWeight:900, fontSize:22 }}>
                            {fmt(totalComImposto)}
                          </div>
                        )}
                        {atTotal > 0 && <div style={{ color:"#475569", fontSize:10, marginTop:3 }}>R$ {fmtA(totalComImposto/atTotal)}/m²</div>}
                      </div>
                      {temImposto && (
                        <div style={{ textAlign:"right" }}>
                          <div style={{ background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:8, padding:"8px 14px" }}>
                            <div style={{ color:"#94a3b8", fontSize:10, textTransform:"uppercase", letterSpacing:0.5 }}>
                              Imposto ({aliqImp}% por dentro)
                            </div>
                            <div style={{ color:"#f87171", fontWeight:700, fontSize:15, marginTop:2 }}>
                              + {fmt(valorImposto)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
              {/* KPIs Comercial */}
              {isComercial && incluiArq && (
                <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:8 }}>

                  {/* Bloco Lojas */}
                  {(r.nLojas||0) > 0 && (r.precoLojas||0) > 0 && (
                  <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:10, padding:"14px 16px", borderTop:"3px solid #3b82f6" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                      <span style={{ color:"#3b82f6", fontWeight:700, fontSize:12, textTransform:"uppercase", letterSpacing:0.5 }}>
                        🏪 Lojas — {r.nLojas}x
                      </span>
                      <BtnExp k="lojas" />
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                      {[
                        ["Área por loja", fmtM2(r.m2Loja1)],
                        ["Área total lojas", fmtM2((r.m2Loja1||0)*r.nLojas)],
                        ["Valor por loja", fmt(r.precoLoja1)],
                        ["R$/m² (loja)", `R$ ${fmtA(r.precoM2Loja)}/m²`],
                      ].map(([l,v]) => (
                        <div key={l}>
                          <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:0.5 }}>{l}</div>
                          <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:14, marginTop:3 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {/* Faixas 1ª loja + repetição — retrátil */}
                    {expandido.lojas && <div style={{ marginTop:10, borderTop:"1px solid #1e293b", paddingTop:8 }}>
                      <div style={{ color:"#475569", fontSize:10, marginBottom:6, textTransform:"uppercase", letterSpacing:0.5 }}>Faixas — 1ª loja (preço cheio)</div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                        {(r.detalheFaixasLoja1||[]).map((f,i) => (
                          <div key={i} style={{ background:"#0f172a", borderRadius:6, padding:"4px 10px", fontSize:11 }}>
                            <span style={{ color:"#64748b" }}>{fmtA(f.de,0)}–{fmtA(f.ate,0)}m²</span>
                            {f.desconto > 0
                              ? <span style={{ color:"#f87171", marginLeft:4 }}>−{(f.desconto*100).toFixed(0)}%</span>
                              : <span style={{ color:"#4ade80", marginLeft:4 }}>cheio</span>}
                            <span style={{ color:"#94a3b8", marginLeft:6 }}>{fmt(f.preco)}</span>
                          </div>
                        ))}
                      </div>
                      {(r.repeticaoLojas||[]).length > 1 && (
                        <>
                          <div style={{ color:"#475569", fontSize:10, margin:"8px 0 6px", textTransform:"uppercase", letterSpacing:0.5 }}>Repetição de lojas</div>
                          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                            {(r.repeticaoLojas||[]).map((f,i) => (
                              <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                                <span style={{ color: f.unidade===1?"#4ade80":"#475569" }}>
                                  Loja {f.unidade} {f.unidade===1?"(cheio)":`(${(f.pct*100).toFixed(0)}% — ${fmtA(f.areaAcum,0)}m² acum.)`}
                                </span>
                                <span style={{ color: f.unidade===1?"#10b981":"#a78bfa", fontWeight:600 }}>{fmt(f.precoUni)}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>}
                    {/* Total lojas — sempre visível */}
                    {(r.repeticaoLojas||[]).length > 0 && (
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginTop:8, paddingTop:8, borderTop:"1px solid #1e293b" }}>
                        <span style={{ color:"#e2e8f0", fontWeight:700, fontSize:12 }}>Total lojas</span>
                        <span style={{ textAlign:"right" }}>
                          <span style={{ color:"#3b82f6", fontWeight:800, fontSize:14 }}>{fmt(r.precoLojas)}</span>
                          <span style={{ color:"#475569", fontSize:10, marginLeft:6 }}>
                            ({`R$ ${fmtA(r.precoLojas / ((r.m2Loja1||1) * r.nLojas))}/m²`})
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                  )}

                  {/* Bloco Âncoras */}
                  {(r.nAncoras||0) > 0 && (r.precoAncoras||0) > 0 && (
                    <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:10, padding:"14px 16px", borderTop:"3px solid #6366f1" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                        <span style={{ color:"#6366f1", fontWeight:700, fontSize:12, textTransform:"uppercase", letterSpacing:0.5 }}>
                          🏬 Espaços Âncoras — {r.nAncoras}x
                        </span>
                        <BtnExp k="ancora" />
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                        {[
                          ["Área por âncora", fmtM2(r.m2Anc1)],
                          ["Área total âncoras", fmtM2((r.m2Anc1||0)*r.nAncoras)],
                          ["Valor por âncora", fmt(r.precoAnc1)],
                          ["R$/m² (âncora)", `R$ ${fmtA(r.precoM2Ancora)}/m²`],
                        ].map(([l,v]) => (
                          <div key={l}>
                            <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:0.5 }}>{l}</div>
                            <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:14, marginTop:3 }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      {/* Faixas 1ª âncora + repetição */}
                      {expandido.ancora && <div style={{ marginTop:10, borderTop:"1px solid #1e293b", paddingTop:8 }}>
                        <div style={{ color:"#475569", fontSize:10, marginBottom:6, textTransform:"uppercase", letterSpacing:0.5 }}>Faixas — 1ª âncora (preço cheio)</div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                          {(r.detalheFaixasAnc1||[]).map((f,i) => (
                            <div key={i} style={{ background:"#0f172a", borderRadius:6, padding:"4px 10px", fontSize:11 }}>
                              <span style={{ color:"#64748b" }}>{fmtA(f.de,0)}–{fmtA(f.ate,0)}m²</span>
                              {f.desconto > 0
                                ? <span style={{ color:"#f87171", marginLeft:4 }}>−{(f.desconto*100).toFixed(0)}%</span>
                                : <span style={{ color:"#4ade80", marginLeft:4 }}>cheio</span>}
                              <span style={{ color:"#94a3b8", marginLeft:6 }}>{fmt(f.preco)}</span>
                            </div>
                          ))}
                        </div>
                        {(r.repeticaoAncoras||[]).length > 1 && (
                          <>
                            <div style={{ color:"#475569", fontSize:10, margin:"8px 0 6px", textTransform:"uppercase", letterSpacing:0.5 }}>Repetição de âncoras</div>
                            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                              {(r.repeticaoAncoras||[]).map((f,i) => (
                                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                                  <span style={{ color: f.unidade===1?"#4ade80":"#475569" }}>
                                    Âncora {f.unidade} {f.unidade===1?"(cheio)":`(${(f.pct*100).toFixed(0)}% — ${fmtA(f.areaAcum,0)}m² acum.)`}
                                  </span>
                                  <span style={{ color: f.unidade===1?"#10b981":"#a78bfa", fontWeight:600 }}>{fmt(f.precoUni)}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>}
                      {/* Total âncoras — sempre visível */}
                      {(r.repeticaoAncoras||[]).length > 0 && (
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginTop:8, paddingTop:8, borderTop:"1px solid #1e293b" }}>
                          <span style={{ color:"#e2e8f0", fontWeight:700, fontSize:12 }}>Total âncoras</span>
                          <span style={{ textAlign:"right" }}>
                            <span style={{ color:"#6366f1", fontWeight:800, fontSize:14 }}>{fmt(r.precoAncoras)}</span>
                            <span style={{ color:"#475569", fontSize:10, marginLeft:6 }}>
                              ({`R$ ${fmtA(r.precoAncoras / ((r.m2Anc1||1) * r.nAncoras))}/m²`})
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Apartamentos */}
                  {(r.nApartamentos||0) > 0 && (r.precoAptos||0) > 0 && (
                    <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:10, padding:"14px 16px", borderTop:"3px solid #f59e0b" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                        <span style={{ color:"#f59e0b", fontWeight:700, fontSize:12, textTransform:"uppercase", letterSpacing:0.5 }}>
                          🏠 Apartamentos — {r.nApartamentos}x
                        </span>
                        <BtnExp k="apto" />
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                        {[
                          ["Área por apto",      fmtM2(r.m2Apto1)],
                          ["Área total aptos",   fmtM2((r.m2Apto1||0)*r.nApartamentos)],
                          ["Valor por apto",     fmt(r.precoApto1)],
                          ["R$/m² (apto)",       `R$ ${fmtA(r.precoM2Apto)}/m²`],
                        ].map(([l,v]) => (
                          <div key={l}>
                            <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:0.5 }}>{l}</div>
                            <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:14, marginTop:3 }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      {expandido.apto && <div style={{ marginTop:10, borderTop:"1px solid #1e293b", paddingTop:8 }}>
                        <div style={{ color:"#475569", fontSize:10, marginBottom:6, textTransform:"uppercase", letterSpacing:0.5 }}>Faixas — 1º apto (preço cheio)</div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                          {(r.detalheFaixasApto1||[]).map((f,i) => (
                            <div key={i} style={{ background:"#0f172a", borderRadius:6, padding:"4px 10px", fontSize:11 }}>
                              <span style={{ color:"#64748b" }}>{fmtA(f.de,0)}–{fmtA(f.ate,0)}m²</span>
                              {f.desconto > 0
                                ? <span style={{ color:"#f87171", marginLeft:4 }}>−{(f.desconto*100).toFixed(0)}%</span>
                                : <span style={{ color:"#4ade80", marginLeft:4 }}>cheio</span>}
                              <span style={{ color:"#94a3b8", marginLeft:6 }}>{fmt(f.preco)}</span>
                            </div>
                          ))}
                        </div>
                        {(r.repeticaoAptos||[]).length > 1 && (
                          <>
                            <div style={{ color:"#475569", fontSize:10, margin:"8px 0 6px", textTransform:"uppercase", letterSpacing:0.5 }}>Repetição de apartamentos</div>
                            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                              {(r.repeticaoAptos||[]).map((f,i) => (
                                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                                  <span style={{ color: f.unidade===1?"#4ade80":"#475569" }}>
                                    Apto {f.unidade} {f.unidade===1?"(cheio)":`(${(f.pct*100).toFixed(0)}% — ${fmtA(f.areaAcum,0)}m² acum.)`}
                                  </span>
                                  <span style={{ color: f.unidade===1?"#10b981":"#fbbf24", fontWeight:600 }}>{fmt(f.precoUni)}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>}
                      {/* Total aptos — sempre visível */}
                      {(r.repeticaoAptos||[]).length > 0 && (
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginTop:8, paddingTop:8, borderTop:"1px solid #1e293b" }}>
                          <span style={{ color:"#e2e8f0", fontWeight:700, fontSize:12 }}>Total apartamentos</span>
                          <span style={{ textAlign:"right" }}>
                            <span style={{ color:"#f59e0b", fontWeight:800, fontSize:14 }}>{fmt(r.precoAptos)}</span>
                            <span style={{ color:"#475569", fontSize:10, marginLeft:6 }}>
                              ({`R$ ${fmtA(r.precoAptos / ((r.m2Apto1||1) * r.nApartamentos))}/m²`})
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Galpoes */}
                  {(r.nGalpoes||0) > 0 && (r.precoGalpoes||0) > 0 && (
                    <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:10, padding:"14px 16px", borderTop:"3px solid #64748b" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                        <span style={{ color:"#94a3b8", fontWeight:700, fontSize:12, textTransform:"uppercase", letterSpacing:0.5 }}>
                          🏭 {r.nGalpoes===1?"Galpão":"Galpões"} — {r.nGalpoes}x
                        </span>
                        <BtnExp k="galpao" />
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                        {[
                          ["Área por galpão",    fmtM2(r.m2Galpao1)],
                          ["Área total galpões", fmtM2((r.m2Galpao1||0)*r.nGalpoes)],
                          ["Valor por galpão",   fmt(r.precoGalpao1)],
                          ["R$/m² (galpão)",     `R$ ${fmtA(r.precoM2Galpao)}/m²`],
                        ].map(([l,v]) => (
                          <div key={l}>
                            <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:0.5 }}>{l}</div>
                            <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:14, marginTop:3 }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      {expandido.galpao && <div style={{ marginTop:10, borderTop:"1px solid #1e293b", paddingTop:8 }}>
                        <div style={{ color:"#475569", fontSize:10, marginBottom:6, textTransform:"uppercase", letterSpacing:0.5 }}>Faixas — 1º galpão (preço cheio)</div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                          {(r.detalheFaixasGalpao1||[]).map((f,i) => (
                            <div key={i} style={{ background:"#0f172a", borderRadius:6, padding:"4px 10px", fontSize:11 }}>
                              <span style={{ color:"#64748b" }}>{fmtA(f.de,0)}–{fmtA(f.ate,0)}m²</span>
                              {f.desconto > 0
                                ? <span style={{ color:"#f87171", marginLeft:4 }}>−{(f.desconto*100).toFixed(0)}%</span>
                                : <span style={{ color:"#4ade80", marginLeft:4 }}>cheio</span>}
                              <span style={{ color:"#94a3b8", marginLeft:6 }}>{fmt(f.preco)}</span>
                            </div>
                          ))}
                        </div>
                        {(r.repeticaoGalpoes||[]).length > 1 && (
                          <>
                            <div style={{ color:"#475569", fontSize:10, margin:"8px 0 6px", textTransform:"uppercase", letterSpacing:0.5 }}>Repetição de galpões</div>
                            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                              {(r.repeticaoGalpoes||[]).map((f,i) => (
                                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                                  <span style={{ color: f.unidade===1?"#4ade80":"#475569" }}>
                                    Galpão {f.unidade} {f.unidade===1?"(cheio)":`(${(f.pct*100).toFixed(0)}% — ${fmtA(f.areaAcum,0)}m² acum.)`}
                                  </span>
                                  <span style={{ color: f.unidade===1?"#10b981":"#94a3b8", fontWeight:600 }}>{fmt(f.precoUni)}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>}
                      {(r.repeticaoGalpoes||[]).length > 0 && (
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginTop:8, paddingTop:8, borderTop:"1px solid #1e293b" }}>
                          <span style={{ color:"#e2e8f0", fontWeight:700, fontSize:12 }}>Total galpões</span>
                          <span style={{ textAlign:"right" }}>
                            <span style={{ color:"#94a3b8", fontWeight:800, fontSize:14 }}>{fmt(r.precoGalpoes)}</span>
                            <span style={{ color:"#475569", fontSize:10, marginLeft:6 }}>
                              ({`R$ ${fmtA(r.precoGalpoes / ((r.m2Galpao1||1) * r.nGalpoes))}/m²`})
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Fachada + Áreas Comuns */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:10, padding:"12px 16px", borderTop:"3px solid #475569" }}>
                      <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:0.5 }}>Áreas Comuns</div>
                      <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:14, marginTop:3 }}>{fmt(r.precoComum)}</div>
                    </div>
                    <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:10, padding:"12px 16px", borderTop:"3px solid #f59e0b" }}>
                      <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:0.5 }}>🏗 Fachada (+{((r.indiceFachada||0)*100).toFixed(0)}%)</div>
                      <div style={{ color:"#f59e0b", fontWeight:700, fontSize:14, marginTop:3 }}>{fmt(r.precoFachada)}</div>
                    </div>
                  </div>

                </div>
              )}

              {temRepet && incluiArq && (
                <div style={{ background:"rgba(245,158,11,0.08)", border:"1px solid #f59e0b40", borderRadius:8, padding:"8px 14px", display:"flex", gap:24, alignItems:"center" }}>
                  <span style={{ color:"#f59e0b", fontSize:11, fontWeight:700 }}>🔁 {nUnid} unidades</span>
                  <span style={{ color:"#64748b", fontSize:11 }}>1ª unidade: {fmt((r.precoFinal||0) + engTotal)}</span>
                  <span style={{ color:"#64748b", fontSize:11 }}>Demais unidades: {fmt(arqTotal - (r.precoFinal||0) + engTotalRepet - engTotal)}</span>
                  <span style={{ color:"#f59e0b", fontWeight:800, fontSize:13, marginLeft:"auto" }}>Total: {fmt(grandTotal)}</span>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16, alignItems:"stretch" }}>
        {/* LISTA DE CÔMODOS */}
        <div style={{ ...S.section, paddingBottom: expandido.tabela ? undefined : 0 }}>
          <div style={{ ...S.sectionTitle, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span>Composição dos Ambientes</span>
            <BtnExp k="tabela" />
          </div>
          {expandido.tabela && <table style={{ width:"100%", borderCollapse:"collapse", marginTop:12 }}>
            <thead>
              <tr>{["Cômodo","Qtd","Dimensões","Área Unit.","Área Útil","Índice"].map(h=>(
                <th key={h} style={S.th}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {(() => {
                const isGal = orc.tipo === "Comercial";
                const nomesLoja   = isGal ? new Set(Object.keys(COMODOS_GALERIA_LOJA))   : new Set();
                const nomesAncora = isGal ? new Set(Object.keys(COMODOS_GALERIA_ANCORA)) : new Set();
                const nomesComum  = isGal ? new Set(Object.keys(COMODOS_GALERIA_COMUM))  : new Set();
                const nomesAptoG  = isGal ? new Set(Object.keys(COMODOS_GALERIA_APTO))   : new Set();

                const getGrupo = nome => {
                  if (nomesLoja.has(nome))   return "loja";
                  if (nomesAncora.has(nome)) return "ancora";
                  if (nomesComum.has(nome))  return "comum";
                  if (nomesAptoG.has(nome))  return "apto";
                  return "outro";
                };

                // Cabeçalho de separação por grupo
                const SepRow = ({ cor, icone, label }) => (
                  <tr>
                    <td colSpan={6} style={{ padding:"10px 8px 4px", borderBottom:"none" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:cor, flexShrink:0 }} />
                        <span style={{ color:cor, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8 }}>
                          {icone} {label}
                        </span>
                      </div>
                    </td>
                  </tr>
                );

                let lastGrupo = null;
                const rows = [];

                comodosAtivos.forEach(c => {
                  const dados = (getComodosConfig(orc.tipo||"Residencial").comodos)[c.nome];
                  const [comp, larg] = dados?.medidas[orc.tamanho] || [0,0];
                  const areaUnit = comp * larg;
                  const areaTotal = areaUnit * c.qtd;
                  const grupo = getGrupo(c.nome);

                  if (isGal && grupo !== lastGrupo) {
                    lastGrupo = grupo;
                    if (grupo === "loja")   rows.push(<SepRow key="sep-loja"   cor="#3b82f6" icone="🏪" label="Ambientes Lojas" />);
                    if (grupo === "ancora") rows.push(<SepRow key="sep-ancora" cor="#6366f1" icone="🏬" label="Ambientes Espaços Âncoras" />);
                    if (grupo === "comum")  rows.push(<SepRow key="sep-comum"  cor="#10b981" icone="" label="Áreas Comuns" />);
                    if (grupo === "apto")   rows.push(<SepRow key="sep-apto"   cor="#f59e0b" icone="🏠" label="Ambientes Apartamentos" />);
                  }

                  rows.push(
                    <tr key={c.nome} style={{ borderBottom:"1px solid #0f172a" }}>
                      <td style={{ ...S.td, fontWeight:600, color:"#e2e8f0", paddingLeft: isGal ? 18 : undefined }}>{c.nome}</td>
                      <td style={{ ...S.td, textAlign:"center" }}>{c.qtd}</td>
                      <td style={S.td}>{comp}m × {larg}m</td>
                      <td style={S.td}>{fmtA(areaUnit)} m²</td>
                      <td style={{ ...S.td, color:"#60a5fa", fontWeight:600 }}>{fmtA(areaTotal)} m²</td>
                      <td style={{ ...S.td, color:"#f59e0b" }}>{fmtA(dados?.indice, 2)}</td>
                    </tr>
                  );
                });

                return rows;
              })()}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:"2px solid #1e293b" }}>
                <td colSpan={4} style={{ ...S.td, fontWeight:700, color:"#94a3b8" }}>Subtotal</td>
                <td style={{ ...S.td, color:"#3b82f6", fontWeight:800 }}>{fmtA(r.areaBruta)} m²</td>
                <td style={{ ...S.td, color:"#f59e0b", fontWeight:700 }}>{fmtA(r.indiceComodos||0, 3)}</td>
              </tr>
              <tr>
                <td colSpan={4} style={{ ...S.td, color:"#64748b", fontSize:12 }}>+ {getTipoConfig(orc.tipo).labelCirk}% (circulação/estrutura)</td>
                <td style={{ ...S.td, color:"#6366f1", fontWeight:800 }}>{fmtA(r.areaTotal)} m²</td>
                <td style={S.td}/>
              </tr>
            </tfoot>
          </table>}
        </div>

        {/* MEMÓRIA DE CÁLCULO */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={S.section}>
            <div style={{ ...S.sectionTitle, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span>Memória de Cálculo</span>
              <BtnExp k="memoria" />
            </div>
            <div style={{ display: expandido.memoria ? "flex" : "none", flexDirection:"column", gap:8, marginTop:12 }}>
              {[
                ["Preço Base", `R$ ${orc.precoBase}/m²${r.padrao === "Baixo" ? " (−20% padrão Baixo → R$ " + fmtA(parseFloat(orc.precoBase)*0.8) + ")" : ""}`, "#94a3b8"],
                ["Área Útil", fmtM2(r.areaBruta), "#3b82f6"],
                ["Área Total (+25%)", fmtM2(r.areaTotal), "#60a5fa"],
                ...(r.tipo !== "Galeria" ? [
                  ["Índice Cômodos", fmtA(r.indiceComodos ?? 0, 3), "#f59e0b"],
                  ["Índice Padrão",  fmtA(r.indicePadrao  ?? 0, 2), "#f59e0b"],
                  ["Fator Total",    `× ${fmtA(r.fator||1, 3)}`,    "#fbbf24"],
                ] : [
                  ["Fator Lojas",   `× ${fmtA(r.fatorLoja||1, 3)}`,  "#f59e0b"],
                  ["Fator Âncoras", (r.nAncoras > 0 && (r.precoAncoras||0) > 0) ? `× ${fmtA(r.fatorAnc||1, 3)}` : "—", "#f59e0b"],
                  ["Fator Aptos",   (r.nApartamentos > 0 && (r.precoAptos||0) > 0) ? `× ${fmtA(r.fatorApto||1, 3)}` : "—", "#f59e0b"],
                ]),
              ].map(([l,v,c]) => v !== undefined && (
                <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid #0f172a" }}>
                  <span style={{ color:"#64748b", fontSize:12 }}>{l}</span>
                  <span style={{ color:c, fontWeight:600, fontSize:13 }}>{v}</span>
                </div>
              ))}

              {/* Faixas Arquitetura — expansivel */}
              <div style={{ marginTop:8, border:"1px solid #1e293b", borderRadius:8, overflow:"hidden" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"8px 12px", background:"#0a1122", cursor:"pointer" }}
                  onClick={() => toggleExp("arq")}>
                  <span style={{ color:"#475569", fontSize:10, textTransform:"uppercase", letterSpacing:1 }}>Desconto progressivo — Arquitetura</span>
                  <BtnExp k="arq" />
                </div>
                {expandido.arq && (
                  <div style={{ padding:"8px 12px" }}>
                    {(r.detalheFaixas||[]).map((f,i) => (
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, padding:"4px 0", borderBottom:"1px solid #0f172a" }}>
                        <span style={{ color:"#475569" }}>
                          {fmtA(f.de,0)}–{fmtA(f.ate,0)} m²
                          {f.desconto > 0
                            ? <span style={{ color:"#f87171" }}> (–{(f.desconto*100).toFixed(0)}%)</span>
                            : <span style={{ color:"#4ade80" }}> (cheio)</span>}
                        </span>
                        <span style={{ color:"#10b981", fontWeight:600 }}>{fmt(f.preco)}</span>
                      </div>
                    ))}
                    {/* Repetição dentro do expansivel Arq */}
                    {r.nUnidades > 1 && (r.repeticaoFaixas||[]).length > 0 && (
                      <div style={{ marginTop:8, paddingTop:8, borderTop:"1px solid #1e293b" }}>
                        <div style={{ color:"#475569", fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Repeticao — {r.nUnidades} unidades</div>
                        {(r.repeticaoFaixas||[]).map((f,i) => (
                          <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, padding:"4px 0", borderBottom:"1px solid #0f172a" }}>
                            <span style={{ color:"#475569" }}>Unid. {f.unidade} ({(f.pct*100).toFixed(0)}% — {fmtA(f.areaAcum,0)}m² acum.)</span>
                            <span style={{ color:"#a78bfa", fontWeight:600 }}>{fmt(f.precoUni)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Valor unidade 1 */}
              <div style={{ background:"#0f172a", borderRadius:8, padding:12, marginTop:8, textAlign:"center" }}>
                <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:1 }}>{r.nUnidades > 1 ? "1a Unidade — Arquitetura" : "Valor do Projeto"}</div>
                <div style={{ color:"#f59e0b", fontWeight:900, fontSize:20, marginTop:4 }}>
                  {fmt(r.precoFinal)}
                </div>
                <div style={{ color:"#64748b", fontSize:11, marginTop:4 }}>
                  {r.areaTotal > 0 ? `R$ ${fmtA(r.precoFinal / r.areaTotal)}/m² · ${fmtM2(r.areaTotal)}` : ""}
                </div>
              </div>

              {/* Total com repeticao */}
              {r.nUnidades > 1 && (
                <div style={{ background:"#0f172a", borderRadius:8, padding:12, marginTop:8, textAlign:"center" }}>
                  <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:1 }}>Total {r.nUnidades} unidades — Arquitetura</div>
                  <div style={{ color:"#a78bfa", fontWeight:900, fontSize:20, marginTop:4 }}>
                    {fmt(r.precoTotal)}
                  </div>
                  <div style={{ color:"#64748b", fontSize:11, marginTop:4 }}>
                    {r.areaTotal > 0 ? `R$ ${fmtA((r.precoTotal||0) / (r.areaTotal * r.nUnidades))} /m² (media) · ${fmtM2(r.areaTotal * r.nUnidades)} total` : ""}
                  </div>
                </div>
              )}
            </div>
          </div>


        </div>
      </div>

      <div style={{ display: incluiEng ? undefined : "none" }}>
      {/* PROJETOS DE ENGENHARIA */}
      {(() => {
        const areaTotal = r.areaTotal || 0;
        const precoEng = 50;
        const nUnid = r.nUnidades || 1;
        // Usa engTotal salvo — mesma fonte dos KPIs
        const { faixas: engFaixas, precoM2Efetivo: engPrecoM2Ef } = calcularEngenharia(areaTotal, precoEng);
        const totalEng = _engRaw;
        // Repeticao: usa faixas salvas se existir
        let engRepet = 0;
        const engRepetFaixas = [];
        if (nUnid > 1) {
          if ((r.repeticaoFaixas||[]).length > 0) {
            let areaAcum = areaTotal;
            for (let i = 2; i <= nUnid; i++) {
              const pct = getTipoConfig(r.tipo).repeticaoPcts(areaAcum);
              const val = totalEng * pct;
              engRepetFaixas.push({ unidade: i, areaAcum, pct, val });
              engRepet += val;
              areaAcum += areaTotal;
            }
          } else {
            let areaAcum = areaTotal;
            for (let i = 2; i <= nUnid; i++) {
              const pct = getTipoConfig(r.tipo).repeticaoPcts(areaAcum);
              const val = totalEng * pct;
              engRepetFaixas.push({ unidade: i, areaAcum, pct, val });
              engRepet += val;
              areaAcum += areaTotal;
            }
          }
        }
        const engTotalRepet = _engRep;
        const arqTotal = _arqBase;
        const grandTotal = Math.round((arqTotal + engTotalRepet) * 100) / 100;
        const projetos = [
          { key:"estrutural", icon:"🏗", label:"Projeto Estrutural",     descricao:"Dimensionamento de fundações, vigas, pilares e lajes",     pct:0.50 },
          { key:"eletrico",   icon:"⚡", label:"Projeto Elétrico",        descricao:"Instalações elétricas, quadros, pontos de iluminação",      pct:0.25 },
          { key:"hidro",      icon:"🔧", label:"Projeto Hidrossanitário", descricao:"Instalações hidráulicas, esgoto, água fria e quente",       pct:0.25 },
        ];
        return (
          <div style={{ ...S.section, marginTop:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div>
                <div style={S.sectionTitle}>🔩 Projetos de Engenharia</div>
                <div style={{ color:"#475569", fontSize:12, marginTop:2 }}>
                  R$ {precoEng}/m² base com desconto progressivo — inclui Estrutural, Elétrico e Hidrossanitário
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ color:"#64748b", fontSize:11 }}>{nUnid > 1 ? `Total Eng. (${nUnid} unid.)` : "Total Engenharia"}</div>
                <div style={{ color:"#a78bfa", fontWeight:900, fontSize:22 }}>{fmt(engTotalRepet)}</div>
                {nUnid > 1 && <div style={{ color:"#64748b", fontSize:11, marginTop:2 }}>1ª unid.: {fmt(totalEng)}</div>}
              </div>
            </div>

            {/* Cards 50/25/25 */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
              {projetos.map(p => (
                <div key={p.key} style={{ background:"#0f172a", border:"1px solid #2d1b69", borderRadius:10, padding:"16px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                    <span style={{ fontSize:22 }}>{p.icon}</span>
                    <span style={{ color:"#e2e8f0", fontWeight:700, fontSize:13 }}>{p.label}</span>
                  </div>
                  <div style={{ color:"#475569", fontSize:11, lineHeight:1.5 }}>{p.descricao}</div>
                  <div style={{ color:"#a78bfa", fontWeight:700, fontSize:13, marginTop:8 }}>{fmt(engTotalRepet * p.pct)}</div>
                  {nUnid > 1 && <div style={{ color:"#64748b", fontSize:11, marginTop:2 }}>1ª unid.: {fmt(totalEng * p.pct)}</div>}
                  <div style={{ color:"#475569", fontSize:10, marginTop:4 }}>{fmtA(p.pct*100,0)}% do total</div>
                </div>
              ))}
            </div>

            {/* Faixas da 1ª unidade + Repetição Eng — expansivel */}
            <div style={{ background:"#0a1222", border:"1px solid #1e293b", borderRadius:10, padding:"14px 18px", marginTop:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <span style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>
                  Desconto progressivo — Engenharia{nUnid > 1 ? ` (${nUnid} unidades)` : " (1a unidade)"}
                </span>
                <BtnExp k="eng" />
              </div>
              {expandido.eng && <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                <div style={{ color:"#475569", fontSize:10, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>1a Unidade</div>
                {engFaixas.map((f,i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"5px 0", borderBottom:"1px solid #0f172a" }}>
                    <span style={{ color:"#475569" }}>
                      {fmtA(f.de,0)}–{fmtA(f.ate,0)} m²
                      {f.desconto > 0
                        ? <span style={{ color:"#f87171", marginLeft:8 }}>–{fmtA(f.desconto,1)}% acum.</span>
                        : <span style={{ color:"#4ade80", marginLeft:8 }}>preco cheio</span>}
                    </span>
                    <span style={{ display:"flex", gap:16 }}>
                      <span style={{ color:"#475569" }}>{fmtA(f.area,1)} m² × R$ {fmtA(precoEng * f.fator)}/m²</span>
                      <span style={{ color:"#a78bfa", fontWeight:600 }}>{fmt(f.preco)}</span>
                    </span>
                  </div>
                ))}
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:10, paddingTop:8, borderTop:"1px solid #1e293b" }}>
                  <span style={{ color:"#94a3b8", fontSize:12 }}>Preco medio efetivo (1a unid.)</span>
                  <span style={{ color:"#a78bfa", fontWeight:700 }}>R$ {fmtA(engPrecoM2Ef)}/m²</span>
                </div>
                {/* Repetição Eng dentro do expansivel */}
                {nUnid > 1 && (
                  <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #4c1d95" }}>
                    <div style={{ color:"#a78bfa", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>
                      Repeticao — {nUnid} unidades
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"5px 0", borderBottom:"1px solid #0f172a" }}>
                      <span style={{ color:"#4ade80" }}>Unidade 1 (cheio)</span>
                      <span style={{ color:"#a78bfa", fontWeight:600 }}>{fmt(totalEng)}</span>
                    </div>
                    {engRepetFaixas.map((f,i) => (
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"5px 0", borderBottom:"1px solid #0f172a" }}>
                        <span style={{ color:"#475569" }}>Unid. {f.unidade} ({(f.pct*100).toFixed(0)}% — {fmtA(f.areaAcum,0)}m² acum.)</span>
                        <span style={{ color:"#a78bfa", fontWeight:600 }}>{fmt(f.val)}</span>
                      </div>
                    ))}
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:10, paddingTop:8, borderTop:"1px solid #4c1d95", fontWeight:700 }}>
                      <span style={{ color:"#e2e8f0" }}>Total Engenharia ({nUnid} unid.)</span>
                      <span style={{ color:"#a78bfa", fontSize:16 }}>{fmt(engTotalRepet)}</span>
                    </div>
                  </div>
                )}
              </div>}
            </div>

            <div style={{ background:"linear-gradient(135deg,#1a0b3c,#0d1526)", border:"1px solid #4c1d95", borderRadius:10, padding:"16px 20px", marginTop:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ color:"#a78bfa", fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>Total Pacote Completo</div>
                <div style={{ color:"#64748b", fontSize:12, marginTop:2 }}>
                  Arquitetura + Engenharia{nUnid > 1 ? ` · ${nUnid} unidades` : " · pacote 3 projetos"}
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ color:"#475569", fontSize:12 }}>{fmt(arqTotal)} + {fmt(engTotalRepet)}</div>
                <div style={{ color:"#f59e0b", fontWeight:900, fontSize:26, letterSpacing:-1 }}>
                  {fmt(grandTotal)}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      </div>
      {/* PROPOSTA COMERCIAL */}
      <PropostaComercial orc={orc} fmt={fmt} fmtM2={fmtM2} incluiArq={incluiArq} incluiEng={incluiEng} />
    </div>
  );
}


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

  // Arq e Eng SEM imposto — usa valores editados passados pelo handlePdf
  const arqCI   = Math.round((r.precoArq||r.precoTotal||r.precoFinal||0)*100)/100;
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
  const engCI   = Math.round((r.precoEng||engBase)*100)/100;
  const totSI   = Math.round((arqCI + (incluiEng?engCI:0))*100)/100;
  const totCI   = temImp ? Math.round(totSI/(1-aliqImp/100)*100)/100 : totSI;
  const impostoV= temImp ? Math.round((totCI - totSI)*100)/100 : 0;
  // Engenharia com imposto para linha separada na tabela
  const engCIcom = temImp && engCI>0 ? Math.round(engCI/(1-aliqImp/100)*100)/100 : engCI;
  // Etapas isoladas
  const idsIsoladosPdf = new Set(orc.etapasIsoladas || []);
  const temIsoladasPdf = idsIsoladosPdf.size > 0;
  // Valor total proporcional das etapas isoladas (com imposto)
  const pctTotalIsoladoPdf = (orc.etapasPct||[]).filter(e=>e.id!==5).reduce((s,e)=>s+Number(e.pct),0);
  const totSIBasePdf = Math.round(arqCI * (pctTotalIsoladoPdf/100) * 100) / 100;
  const totCIBasePdf = temImp ? Math.round(totSIBasePdf/(1-aliqImp/100)*100)/100 : totSIBasePdf;

  // Escopo (igual preview)
  const escopoDefault = [
    { titulo:"1. Estudo de Viabilidade", objetivo:"Analisar o potencial construtivo do terreno e verificar a viabilidade de implantação do empreendimento, considerando as condicionantes físicas, urbanísticas, legais e funcionais aplicáveis ao lote.", itens:["Levantamento inicial e consolidação das informações técnicas do terreno","Análise documental e física do lote, incluindo matrícula, dimensões, topografia e características existentes","Consulta e interpretação dos parâmetros urbanísticos e restrições legais aplicáveis","Verificação da viabilidade construtiva, considerando taxa de ocupação, coeficiente de aproveitamento, recuos obrigatórios, gabarito de altura e demais condicionantes normativas","Estimativa preliminar da área edificável e do potencial de aproveitamento do terreno","Avaliação da melhor ocupação do lote, alinhada ao programa de necessidades do cliente","Definição preliminar da implantação, organização dos acessos, fluxos, circulação, áreas livres e áreas construídas","Estudo de volumetria, análise de inserção no entorno e definição de pontos focais que contribuam para a valorização do empreendimento","Dimensionamento preliminar de estacionamentos, fluxos operacionais e viabilidade de circulação para veículos leves e pesados"], entregaveis:["Estudo técnico de ocupação do terreno, com planta de implantação e setorização preliminar","Esquema conceitual de implantação, incluindo diagramas de organização espacial, acessos e condicionantes do entorno","Representações gráficas, estudo volumétrico em 3D e imagens conceituais","Relatório sintético de viabilidade construtiva, contemplando memorial descritivo, quadro de áreas e síntese dos parâmetros urbanísticos aplicáveis"], obs:"Esta etapa tem como objetivo reduzir riscos e antecipar decisões estratégicas antes do desenvolvimento do projeto, permitindo validar a compatibilidade da proposta com o terreno, com a legislação municipal e com os objetivos do empreendimento." },
    { titulo:"2. Estudo Preliminar", objetivo:"Desenvolver o conceito arquitetônico inicial, organizando os ambientes, a implantação e a linguagem estética do projeto.", itens:["Reunião de briefing e entendimento das necessidades do cliente","Definição do programa de necessidades","Estudo de implantação da edificação no terreno","Desenvolvimento da concepção arquitetônica inicial","Definição preliminar de: layout, fluxos, volumetria, setorização e linguagem estética","Compatibilização entre funcionalidade, conforto, estética e viabilidade construtiva","Ajustes conforme alinhamento com o cliente"], entregaveis:["Planta baixa preliminar","Estudo volumétrico / fachada conceitual","Implantação inicial","Imagens, croquis ou perspectivas conceituais","Apresentação para validação do conceito arquitetônico"], obs:"É nesta etapa que o projeto ganha forma. O estudo preliminar define a essência da proposta e orienta todas as fases seguintes." },
    { titulo:"3. Aprovação na Prefeitura", objetivo:"Adequar e preparar o projeto arquitetônico para protocolo e aprovação junto aos órgãos públicos competentes.", itens:["Adequação do projeto às exigências legais e urbanísticas do município","Elaboração dos desenhos técnicos exigidos para aprovação","Montagem da documentação técnica necessária ao processo","Inserção de informações obrigatórias conforme normas municipais","Preparação de pranchas, quadros de áreas e demais peças gráficas","Apoio técnico durante o processo de aprovação","Atendimento a eventuais comunique-se ou exigências técnicas da prefeitura"], entregaveis:["Projeto legal para aprovação","Plantas, cortes, fachadas e implantação conforme exigência municipal","Quadros de áreas","Arquivos e documentação técnica para protocolo"], obs:"Não inclusos nesta etapa: taxas municipais, emolumentos, ART/RRT, levantamentos complementares, certidões e exigências extraordinárias de órgãos externos, salvo se expressamente previsto." },
    { titulo:"4. Projeto Executivo", objetivo:"Desenvolver o projeto arquitetônico em nível detalhado para execução da obra, fornecendo todas as informações necessárias para construção com precisão.", itens:["Desenvolvimento técnico completo do projeto aprovado","Detalhamento arquitetônico para obra","Definição precisa de: dimensões, níveis, cotas, eixos, paginações, esquadrias, acabamentos e elementos construtivos","Elaboração de desenhos técnicos executivos","Compatibilização arquitetônica com premissas de obra","Apoio técnico para leitura e entendimento do projeto pela equipe executora"], entregaveis:["Planta baixa executiva","Planta de locação e implantação","Planta de cobertura","Cortes e fachadas executivos","Planta de layout e pontos arquitetônicos","Planta de esquadrias e pisos","Detalhamentos construtivos","Quadro de esquadrias e quadro de áreas final"], obs:"É a etapa que transforma a ideia em construção real. Um bom projeto executivo reduz improvisos, retrabalhos e falhas de execução na obra." },
    { titulo:"5. Projetos Complementares de Engenharia", objetivo:"", itens:["Estrutural: lançamento, dimensionamento de vigas, pilares, lajes e fundações","Elétrico: dimensionamento de cargas, circuitos, quadros e pontos","Hidrossanitário: distribuição de pontos de água fria/quente, esgoto e dimensionamento","Compatibilização entre projetos arquitetônico e de engenharia para verificar possíveis interferências"], entregaveis:[], obs:"Obs.: Este item poderá ser contratado diretamente pelo cliente junto a engenheiros terceiros, ficando a compatibilização sob responsabilidade dos profissionais contratados." },
  ];

  const naoInclDefault = [
    ...(!incluiEng || (temIsoladasPdf && !idsIsoladosPdf.has(5)) ? ["Projetos de Engenharia (Estrutural · Elétrico · Hidrossanitário)"] : []),
    "Taxas municipais, emolumentos e registros (CAU/Prefeitura)",
    "Projetos de climatização","Projeto de prevenção de incêndio","Projeto de automação",
    "Projeto de paisagismo","Projeto de interiores","Projeto de Marcenaria (Móveis internos)",
    "Projeto estrutural de estruturas metálicas",
    "Projeto estrutural para muros de contenção (arrimo) acima de 1 m de altura",
    "Sondagem e Planialtimétrico do terreno","Acompanhamento semanal de obra",
    "Gestão e execução de obra","Vistoria para Caixa Econômica Federal","RRT de Execução de obra",
    ...(!temImp ? ["Impostos"] : []),
  ];

  const isPadrao = (orc.tipoPagamento || "padrao") !== "etapas";
  const mostrarPrazoEng = incluiEng && (!temIsoladasPdf || idsIsoladosPdf.has(5));
  const prazoDefault = isPadrao
    ? ["Prazo estimado para entrega do Projeto Arquitetônico: 30 dias úteis após aprovação do estudo preliminar.",
       ...(mostrarPrazoEng ? ["Prazo estimado para entrega dos Projetos de Engenharia: 30 dias úteis após aprovação na prefeitura."] : [])]
    : ["Prazo de 30 dias úteis por etapa, contados após conclusão e aprovação de cada etapa pelo cliente.",
       "Concluída e aprovada cada etapa, inicia-se automaticamente o prazo da etapa seguinte.",
       ...(mostrarPrazoEng ? ["Projetos de Engenharia: 30 dias úteis após aprovação do projeto na Prefeitura."] : [])];

  const etapasPdf = orc.etapasPct || [];

  // IDs das etapas ativas (1-4 = arq, 5 = eng)
  const etapasAtivas = new Set(etapasPdf.map(e => e.id));
  // Mapa etapaId -> nome personalizado (para etapas customizadas)
  const etapaNomeMap = Object.fromEntries(etapasPdf.map(e => [e.id, e.nome]));

  // Filtra e renumera escopoDefault conforme etapas ativas e toggles
  const escopoFiltradoPdf = (() => {
    const ESCOPO_IDS = [1,2,3,4]; // ids fixos de arq
    const blocos = escopoDefault.filter((bloco, i) => {
      const etId = i + 1; // índice 0 = etapaId 1, etc (bloco 5 = eng)
      if (i === 4) return incluiEng; // eng
      if (!incluiArq) return false;
      if (!etapasAtivas.has(etId)) return false; // etapa excluída
      if (etId === 1 && isPadrao) return false; // viabilidade só no por etapas
      return true;
    });
    // Adiciona blocos customizados (etapas com id > 5)
    etapasPdf.forEach(et => {
      if (et.id > 5) {
        blocos.splice(blocos.length - (incluiEng ? 1 : 0), 0, {
          titulo: et.nome, objetivo:"", itens:[], entregaveis:[], obs:""
        });
      }
    });
    // Renumera
    let n = 0;
    return blocos.map(b => {
      const isEng = b.titulo.includes("Engenharia") && !b.titulo.includes("Viabilidade");
      if (!isEng) { n++; return { ...b, titulo: `${n}. ${b.titulo.replace(/^\d+\.\s*/,"")}` }; }
      return { ...b, titulo: `${n+1}. ${b.titulo.replace(/^\d+\.\s*/,"")}` };
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
  const secTitle = (txt, mt=10) => {
    nv(12);
    y += mt;
    sf("bold",7.5); stc(INK_LT); tx(txt.toUpperCase(),M,y);
    const tw = doc.getTextWidth(txt.toUpperCase());
    sc(LINE,"draw"); doc.setLineWidth(0.3); doc.line(M+tw+4,y-1,W-M,y-1);
    y += 7;
  };

  // Bullet item
  const bullet = (txt, x=M+3, maxW=TW-6) => {
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
  sf("bold",16); stc(INK); tx(orc.cliente||"—", M, y);
  // Valor e label "Apenas Arquitetura" só aparecem quando ambos (arq+eng) incluídos
  if (incluiArq && incluiEng && !temIsoladasPdf) {
    sf("bold",12); stc(INK); tx(fmtB(arqCI), W-M, y+1, {align:"right"});
    const wArqVal = doc.getTextWidth(fmtB(arqCI));
    sf("normal",6.5); stc(INK_LT); tx("Apenas Arquitetura", W-M-wArqVal-3, y+1, {align:"right"});
    if (area>0) { sf("normal",6.5); stc(INK_LT); tx(`R$ ${fmtN(Math.round(arqCI/area*100)/100)}/m²`, W-M, y+6, {align:"right"}); }
  }

  // "Proposta Comercial..." abaixo do nome
  y += 7;
  sf("normal",7); stc(INK_LT);
  tx("Proposta Comercial de Projetos de Arquitetura e Engenharia", M, y);

  // Linha dupla separadora
  y += 6;
  sc(INK); doc.rect(M,y,TW,0.5,"F");
  y += 5;

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
  const colH = 22;
  nv(colH+4);

  // Coluna ARQ — quando isolada usa valor proporcional
  const arqCIExib = temIsoladasPdf ? totSIBasePdf : arqCI;
  sf("bold",7); stc(INK_LT); tx("ARQUITETURA", M, y);
  sf("bold",11); stc(INK); tx(fmtB(arqCIExib), M, y+7);
  if(area>0){ sf("normal",6.5); stc(INK_LT); tx(`R$ ${fmtN(Math.round(arqCIExib/area*100)/100)}/m²`, M, y+12); }

  // Divisor vertical e coluna Engenharia — só quando incluiEng
  if (incluiEng) {
    sc(LINE,"draw"); doc.setLineWidth(0.3); doc.line(midX, y-1, midX, y+colH);
    sf("bold",7); stc(INK_LT); tx("ENGENHARIA", midX+4, y);
    const wEng = doc.getTextWidth("ENGENHARIA");
    sf("normal",6); stc(INK_LT); tx("(Opcional)", midX+4+wEng+2, y);
    sf("bold",11); stc(INK); tx(fmtB(engCI), midX+4, y+7);
    sf("normal",6.5); stc(INK_LT);
    tx("Estrutural · Elétrico · Hidrossanitário", midX+4, y+12);
    if(area>0) tx(`R$ ${fmtN(Math.round(engCI/area*100)/100)}/m²`, midX+4, y+16);
  }

  y += colH+2;

  // Quadro cinza — sempre visível
  nv(12);
  sc(BG); doc.roundedRect(M,y,TW,8,2,2,"F");
  sf("normal",7); stc(INK_LT);
  const totCIExib = temIsoladasPdf ? totCIBasePdf : totCI;
  const impostoVExib = temIsoladasPdf ? Math.round((totCIBasePdf - totSIBasePdf)*100)/100 : impostoV;
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
  secTitle(isPadrao ? "Formas de pagamento" : "Contratação por etapa");

  if (!isPadrao && etapasPdf.length > 0) {
    // Tabela de etapas
    nv(14);
    const cE=M, cP=W-M-45, cV=W-M, rH=8;
    sf("bold",7.5); stc(INK);
    tx("ETAPA",cE,y); tx("%",cP,y,{align:"right"}); tx("VALOR",cV,y,{align:"right"});
    y+=2; sc(INK); doc.rect(M,y,TW,0.5,"F"); y+=rH-1;

    etapasPdf.forEach(et => {
      nv(rH+3);
      sf("normal",8.5); stc(INK_MD); tx(et.nome||"",cE,y);
      const arqCIBase = temImp && arqCI>0 ? Math.round(arqCI/(1-aliqImp/100)*100)/100 : arqCI;
      const valEtapa = et.id===5 ? engCIcom
        : temIsoladasPdf && pctTotalIsoladoPdf>0
          ? Math.round(totCIBasePdf * (et.pct / pctTotalIsoladoPdf) * 100) / 100
          : Math.round(arqCIBase*(et.pct/100)*100)/100;
      sf("normal",8.5); stc(INK_LT); tx(et.id===5?"—":`${et.pct}%`,cP,y,{align:"right"});
      sf("normal",8.5); stc(INK); tx(fmtB(valEtapa),cV,y,{align:"right"});
      y+=1.5; sc(LINE); doc.rect(M,y,TW,0.3,"F"); y+=rH-1;
    });

    // Linha Engenharia — só quando incluiEng
    if (incluiEng) {
      nv(rH+5);
      sf("normal",8.5); stc(INK_MD); tx("Projetos de Engenharia",cE,y);
      sf("normal",6.5); stc(INK_LT); tx("Estrutural  ·  Elétrico  ·  Hidrossanitário",cE,y+4);
      sf("normal",8.5); stc(INK_LT); tx("—",cP,y+2,{align:"right"});
      sf("normal",8.5); stc(INK); tx(fmtB(engCI),cV,y+2,{align:"right"});
      y+=6; sc(LINE); doc.rect(M,y,TW,0.3,"F"); y+=rH-1;
    }

    // Total
    const engCIpdf = incluiEng ? engCI : 0;
    const totCIpdf = incluiEng ? totCI : (temImp ? Math.round(arqCI/(1-aliqImp/100)*100)/100 : arqCI);
    const arqCIpdf = temImp && arqCI > 0 ? Math.round(arqCI/(1-aliqImp/100)*100)/100 : arqCI;
    nv(10);
    y+=1; sc(INK); doc.rect(M,y-1,TW,0.5,"F"); y+=3;
    sf("bold",8.5); stc(INK);
    tx("Total",cE,y);
    const pctArqTotal = etapasPdf.filter(e=>e.id!==5).reduce((s,e)=>s+Number(e.pct),0);
    const arqCIBasePdf2 = temImp && arqCI>0 ? Math.round(arqCI/(1-aliqImp/100)*100)/100 : arqCI;
    const totalPdfBase = temIsoladasPdf
      ? totCIBasePdf
      : Math.round((arqCIBasePdf2*(pctArqTotal/100) + (incluiEng?engCIcom:0))*100)/100;
    tx(`${pctArqTotal}%`,cP,y,{align:"right"});
    tx(fmtB(totalPdfBase),cV,y,{align:"right"});
    y+=10;

    // Condições etapa a etapa — reservar espaço para todo o bloco
    const dEt = orc.descontoEtapaCtrt??5, pEt = orc.parcelasEtapaCtrt??2;
    y+=4;
    nv(75);
    secTitle("Forma de Pagamento");
    sf("bold",8.5); stc(INK); tx("Etapa a Etapa",M,y);
    sf("normal",6.5); stc(INK_LT); tx("Obs.: Nesta opção valores de etapas futuras podem ser reajustados.",W-M,y,{align:"right"});
    sf("normal",8.5); stc(INK_MD); y+=6;
    sf("normal",8.5); stc(INK_MD);
    tx(`Opção 1: Antecipado por etapa (${dEt}% de desconto)`,M+2,y); y+=7;
    tx(`Opção 2: Parcelado ${pEt}× por etapa`,M+2,y); hr(y+3); y+=10;

    // Pacote completo etapas — só quando incluiArq && incluiEng && sem isoladas
    if (incluiArq && incluiEng && !temIsoladasPdf) {
      const dPac=orc.descontoPacoteCtrt??15, pPac=orc.parcelasPacoteCtrt??8;
      const tDescP=Math.round(totCI*(1-dPac/100)*100)/100;
      nv(30);
      sf("bold",8.5); stc(INK); tx("Pacote Completo (Arq. + Eng.)",M,y); y+=6;
      sf("normal",8.5); stc(INK_MD);
      tx(`De ${fmtB(totCI)} por apenas:`,M+2,y);
      sf("bold",9); stc(INK); tx(fmtB(tDescP),W-M,y,{align:"right"}); y+=5;
      sf("normal",7.5); stc(INK_LT);
      tx(`Desconto de ${fmtB(Math.round(totCI*dPac/100*100)/100)} (${dPac}%)  ·  Parcelado ${pPac}× de ${fmtB(Math.round(tDescP/pPac*100)/100)} c/ desconto`,M+2,y);
      hr(y+3); y+=9;
    }

  } else {
    // Pagamento padrão — reservar espaço para todo o bloco
    const dA=orc.descontoEtapa??5, pA=orc.parcelasEtapa??3;
    nv(70);
    sf("bold",8.5); stc(INK); tx("Apenas Arquitetura",M,y); y+=6;
    sf("normal",8.5); stc(INK_MD);
    tx(`Antecipado (${dA}% de desconto) — ${fmtB(Math.round(arqCI*(1-dA/100)*100)/100)}`,M+2,y); hr(y+3); y+=8;
    tx(`Parcelado ${pA}× — ${fmtB(Math.round(arqCI/pA*100)/100)}/mês`,M+2,y); hr(y+3); y+=10;

    if (incluiArq && incluiEng) {
      const dP=orc.descontoPacote??10, pP=orc.parcelasPacote??4;
      const tDescPad=Math.round(totCI*(1-dP/100)*100)/100;
      sf("bold",8.5); stc(INK); tx("Pacote Completo (Arq. + Eng.)",M,y); y+=6;
      sf("normal",8.5); stc(INK_MD);
      tx(`De ${fmtB(totCI)} por apenas:`,M+2,y);
      sf("bold",9); stc(INK); tx(fmtB(tDescPad),W-M,y,{align:"right"}); y+=5;
      sf("normal",7.5); stc(INK_LT);
      tx(`Desconto de ${fmtB(Math.round(totCI*dP/100*100)/100)} (${dP}%)  ·  Parcelado ${pP}× de ${fmtB(Math.round(tDescPad/pP*100)/100)} c/ desconto`,M+2,y);
      hr(y+3); y+=9;
    }
  }

  // PIX
  sf("normal",8); stc(INK_LT);
  tx(orc.pixTexto || "PIX  ·  Chave CNPJ: 36.122.417/0001-74 — Leo Padovan Projetos e Construções  ·  Banco Sicoob",M,y);
  y+=8;

  // ── ESCOPO DOS SERVIÇOS ───────────────────────────────────
  secTitle("Escopo dos serviços");

  escopoFiltradoPdf.forEach((bloco,bi) => {
    nv(20);
    sf("bold",9); stc(INK); tx(bloco.titulo,M,y); y+=6;

    if (bloco.objetivo) {
      sf("bold",7.5); stc(INK_LT); tx("OBJETIVO",M,y); y+=5;
      sf("normal",8.5); stc(INK_MD);
      const ls = doc.splitTextToSize(bloco.objetivo, TW);
      ls.forEach(ln => { nv(5); tx(ln,M,y); y+=4.5; }); y+=2;
    }

    if (bloco.itens.length) {
      sf("bold",7.5); stc(INK_LT); tx("SERVIÇOS INCLUSOS",M,y); y+=5;
      bloco.itens.forEach(it => bullet(it));
      y+=2;
    }

    if (bloco.entregaveis.length) {
      sf("bold",7.5); stc(INK_LT); tx("ENTREGÁVEIS",M,y); y+=5;
      bloco.entregaveis.forEach(it => bullet(it));
      y+=2;
    }

    if (bloco.obs) {
      sf("normal",7.5);
      const ls = doc.splitTextToSize(bloco.obs, TW);
      stc(INK_LT);
      ls.forEach(ln => { nv(5); tx(ln,M,y); y+=4; }); y+=2;
    }

    if (bi < escopoFiltradoPdf.length-1) { nv(5); hr(y); y+=5; }
  });

  // ── SERVIÇOS NÃO INCLUSOS — 2 colunas independentes ──────
  secTitle("Serviços não inclusos");
  const halfW = TW/2-8;
  const col1 = naoInclDefault.filter((_,i) => i%2===0);
  const col2 = naoInclDefault.filter((_,i) => i%2===1);
  sf("normal",8.5);
  // Calcula alturas de cada item individualmente
  const heights1 = col1.map(t => doc.splitTextToSize(t, halfW-6).length * 4.5 + 2);
  const heights2 = col2.map(t => doc.splitTextToSize(t, halfW-6).length * 4.5 + 2);
  const totalH = Math.max(
    heights1.reduce((s,h)=>s+h,0),
    heights2.reduce((s,h)=>s+h,0)
  );
  nv(totalH);
  const yStart = y;
  let y1 = yStart, y2 = yStart;
  stc(INK_MD);
  col1.forEach((txt, i) => {
    const ls = doc.splitTextToSize(txt, halfW-6);
    nv(heights1[i]);
    tx("•", M+1, y1);
    ls.forEach((ln, li) => tx(ln, M+5, y1+li*4.5));
    y1 += heights1[i];
  });
  col2.forEach((txt, i) => {
    const ls = doc.splitTextToSize(txt, halfW-6);
    tx("•", midX+1, y2);
    ls.forEach((ln, li) => tx(ln, midX+5, y2+li*4.5));
    y2 += heights2[i];
  });
  y = Math.max(y1, y2);
  nv(6);
  sf("normal",7.5); stc(INK_LT);
  tx("Obs: Todos os serviços não inclusos podem ser contratados como serviços adicionais.",M,y); y+=8;

  // ── PRAZO DE EXECUÇÃO ─────────────────────────────────────
  secTitle("Prazo de execução");
  prazoDefault.forEach(p => bullet(p));
  y+=4;

  // ── ACEITE DA PROPOSTA ────────────────────────────────────
  secTitle("Aceite da proposta");
  nv(40);

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
    escopoEng: ["Estrutural: lançamento, dimensionamento de vigas, pilares, lajes e fundações","Elétrico: dimensionamento de cargas, circuitos, quadros e pontos","Hidrossanitário: distribuição de pontos de água fria/quente, esgoto e dimensionamento","Compatibilização entre projetos arquitetônico e de engenharia para verificar possíveis interferências"],
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

var TEMAS_COR = [
  { nome:"Preto Clássico",   ink:[17,24,39],    accent:[17,24,39],    bg:[220,225,232], hex:"#111827" },
  { nome:"Azul Profundo",    ink:[15,40,80],     accent:[30,80,160],   bg:[210,225,245], hex:"#1e50a0" },
  { nome:"Verde Escritório", ink:[20,60,40],     accent:[30,100,60],   bg:[210,235,220], hex:"#1e643c" },
  { nome:"Bordô Elegante",   ink:[80,10,30],     accent:[140,20,50],   bg:[240,215,220], hex:"#8c1432" },
  { nome:"Cinza Moderno",    ink:[50,50,55],     accent:[80,80,90],    bg:[225,225,228], hex:"#505058" },
  { nome:"Azul Petróleo",    ink:[10,50,60],     accent:[15,90,110],   bg:[205,230,235], hex:"#0f5a6e" },
  { nome:"Dourado Luxo",     ink:[80,55,10],     accent:[140,100,15],  bg:[245,238,210], hex:"#8c640f" },
  { nome:"Roxo Corporativo", ink:[55,20,90],     accent:[100,40,160],  bg:[230,215,245], hex:"#6428a0" },
];

var PROPOSTA_PADRAO_KEY = "obramanager-proposta-padrao-v1";
var orcPropostaKey = (orcId) => `obramanager-proposta-${orcId}`;

function PropostaComercial({ orc, fmt, fmtM2, incluiArq=true, incluiEng=true }) {
  const [logo, setLogo]           = useState(null);
  const [logoCarregando, setLogoCarregando] = useState(true);
  const [savedMsg, setSavedMsg]   = useState("");
  const [modelo, setModelo]       = useState(null);
  const [logoPos, setLogoPos]     = useState({ x:0, y:0 });
  const [dragging, setDragging]         = useState(false);
  const dragOffset                      = useRef({ x:0, y:0 });
  const [quadroPos, setQuadroPos]       = useState({ x:0, y:0 });
  const [draggingQuadro, setDraggingQuadro] = useState(false);
  const dragOffsetQuadro                = useRef({ x:0, y:0 });
  const [showCorModal, setShowCorModal] = useState(false);
  const [bgLogo, setBgLogoSt]   = useState("#ffffff");
  const [corTema, setCorTemaSt] = useState(TEMAS_COR[0]);

  // Carrega preferências do storage persistente
  useEffect(() => {
    (async () => {
      try { const r = await window.storage.get("obramanager-bg-logo");    if (r?.value) setBgLogoSt(r.value); } catch {}
      try { const r = await window.storage.get("obramanager-cor-tema");   if (r?.value) setCorTemaSt(JSON.parse(r.value)); } catch {}
    })();
  }, []);

  const setBgLogo = async v => { setBgLogoSt(v); try { await window.storage.set("obramanager-bg-logo", v); } catch {} };
  const setCorTema = async t => { setCorTemaSt(t); try { await window.storage.set("obramanager-cor-tema", JSON.stringify(t)); } catch {} };

  const r        = orc.resultado || {};
  const nUnid    = r.nUnidades || 1;
  // Usa sempre os valores já calculados e salvos no banco
  const arqTotal = r.precoArq || r.precoTotal || r.precoFinal || 0;
  const engTotal = r.precoEng || (r.engTotal ?? calcularEngenharia(r.areaTotal||0).totalEng);
  const engUnit  = engTotal;
  // Usa sempre totSI do orc como fonte da verdade para valores sem imposto
  const totSIOrc   = orc.totSI || 0;
  const temImpOrc  = !!(orc.temImposto ?? r.impostoAplicado);
  const aliqImpOrc2 = orc.aliqImp ?? r.aliquotaImposto ?? 0;
  const grandTotalRaw = Math.round((arqTotal + engTotal) * 100) / 100;
  // Se totSI está disponível, deriva arq e eng proporcionalmente a partir dele
  const arqTotalFix = totSIOrc > 0 && grandTotalRaw > 0
    ? Math.round(totSIOrc * (arqTotal / grandTotalRaw) * 100) / 100
    : arqTotal;
  const engTotalFix = totSIOrc > 0 && grandTotalRaw > 0
    ? Math.round(totSIOrc * (engTotal / grandTotalRaw) * 100) / 100
    : engTotal;
  const grandTotal = Math.round((arqTotalFix + engTotalFix) * 100) / 100;

  // Load logo + modelo
  // Prioridade: 1) modelo salvo para este orçamento específico
  //             2) modelo padrão (estrutura base) mesclado com dados do orçamento atual
  useEffect(() => {
    (async () => {
      try { const lr = await window.storage.get("escritorio-logo"); if (lr?.value) setLogo(lr.value); } catch {}
      try {
        // Tenta carregar modelo salvo para este orçamento
        const orcKey = orcPropostaKey(orc.id);
        const orcR = await window.storage.get(orcKey);
        if (orcR?.value) {
          const saved = JSON.parse(orcR.value);
          setModelo(saved);
          setLogoPos(saved.logoPos||{x:0,y:0});
        } else {
          // Nenhum modelo salvo para este orçamento — tenta modelo padrão para herdar escopo/escritório
          const padR = await window.storage.get(PROPOSTA_PADRAO_KEY);
          if (padR?.value) {
            const padrao = JSON.parse(padR.value);
            // Mescla: mantém escopo/escritório/prazo/naoInclusos/aceite do padrão
            // mas usa dados do orçamento atual para cliente/serviços/valores/datas
            const fresh = defaultModelo(orc, arqTotalFix, engTotalFix, grandTotal, fmt, fmtM2, nUnid, engUnit, r);
            const merged = {
              ...fresh,
              escritorio:  padrao.escritorio  || fresh.escritorio,
              escopo:      padrao.escopo       || fresh.escopo,
              naoInclusos: padrao.naoInclusos  || fresh.naoInclusos,
              prazo:       padrao.prazo        || fresh.prazo,
              prazoEtapas: padrao.prazoEtapas  || fresh.prazoEtapas,
              aceite:      padrao.aceite       || fresh.aceite,
              titulo:      padrao.titulo       || fresh.titulo,
              subtitulo:   padrao.subtitulo    || fresh.subtitulo,
            };
            setModelo(merged);
          }
          // Se não há padrão, o modelo fica null e defaultModelo será usado ao renderizar
        }
      } catch {}
      setLogoCarregando(false);
    })();
  }, [orc.id]);

  // Build fresh model when orc changes and no saved model
  const mRaw = modelo || defaultModelo(orc, arqTotalFix, engTotalFix, grandTotal, fmt, fmtM2, nUnid, engUnit, r);

  // Sincroniza escopoEtapas com etapasPct — adiciona blocos para etapas novas
  const etapasPctAtual = orc.etapasPct || [];
  const escopoEtapasSinc = (() => {
    const existentes = mRaw.escopoEtapas || [];
    const result = [...existentes];
    etapasPctAtual.forEach((etapa) => {
      const jaExiste = existentes.some(b =>
        b.titulo?.replace(/^\d+\.\s*/,"").trim() === etapa.nome?.trim() || b.id === etapa.id
      );
      if (!jaExiste) {
        result.push({
          id: etapa.id || Date.now(),
          titulo: `${result.length+1}. ${etapa.nome}`,
          objetivo: "",
          itens: ["A definir"],
          entregaveis: ["A definir"],
          obs: "",
        });
      }
    });
    // Renumera todos — preserva texto após ". "
    return result.map((b, i) => ({
      ...b,
      titulo: `${i+1}. ${b.titulo?.replace(/^\d+\.\s*/,"") || b.titulo}`,
    }));
  })();
  const engItemNaoIncl = "Projetos de Engenharia (Estrutural · Elétrico · Hidrossanitário)";
  const temImposto = !!(orc.temImposto ?? r.impostoAplicado);
  const aliqImpostoOrc = orc.aliqImp ?? r.aliquotaImposto ?? 0;
  const naoInclusosComEng = [
    ...(mRaw.naoInclusos||[]).filter(i =>
      !i.includes("Projetos de Engenharia") &&
      !i.toLowerCase().startsWith("imposto")
    ),
    ...(temImposto ? [] : ["Impostos"]),
    ...(!incluiEng ? [engItemNaoIncl] : []),
  ];
  const m = { ...mRaw,
    escopoEtapas: escopoEtapasSinc,
    naoInclusos: naoInclusosComEng,
    titulo: !incluiArq ? "Projetos de Engenharia" : !incluiEng ? "Projeto Arquitetônico" : mRaw.titulo,
    servicos: (mRaw.servicos||[]).filter(sv => {
      const d = (sv.descricao||"").toLowerCase();
      if (!incluiArq && d.includes("arquitet")) return false;
      if (!incluiEng && d.includes("engenhar")) return false;
      return true;
    }),
    escopo: (mRaw.escopo||[]).filter(g => {
      const t = (g.titulo||"").toLowerCase();
      if (!incluiArq && (t.includes("arquitet")||t.includes("assessoria"))) return false;
      if (!incluiEng && (t.includes("engenhar")||t.includes("complement"))) return false;
      return true;
    }),
    pagamento: { ...mRaw.pagamento, opcoes: (mRaw.pagamento?.opcoes||[]).filter(op => {
      const t = (op.titulo||"").toLowerCase();
      // Remove "Apenas Arq." se sem arq
      if (!incluiArq && t.includes("arquitet") && !t.includes("eng") && !t.includes("pacote")) return false;
      // Remove "Apenas Eng." se sem eng
      if (!incluiEng && t.includes("engenhar") && !t.includes("pacote")) return false;
      // Remove "Pacote Completo" se faltar qualquer um dos dois
      if (t.includes("pacote") && (!incluiArq || !incluiEng)) return false;
      return true;
    })},
    prazo: (mRaw.prazo||[]).filter(p => {
      if (!incluiEng && p.includes("Engenharia")) return false;
      return true;
    }),
  };

  const set = (path, val) => {
    const parts = path.split(".");
    setModelo(prev => {
      const base = prev || defaultModelo(orc, arqTotalFix, engTotalFix, grandTotal, fmt, fmtM2, nUnid, engUnit, r);
      const clone = JSON.parse(JSON.stringify(base));
      let cur = clone;
      for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
      cur[parts[parts.length-1]] = val;
      return clone;
    });
  };

  async function salvarModelo() {
    const toSave = { ...(modelo || defaultModelo(orc, arqTotalFix, engTotalFix, grandTotal, fmt, fmtM2, nUnid, engUnit, r)), logoPos };
    // Salva modelo específico deste orçamento
    await window.storage.set(orcPropostaKey(orc.id), JSON.stringify(toSave));
    // Salva também como padrão — mas apenas a estrutura reutilizável (sem dados de cliente/valores)
    const padrao = {
      escritorio:  toSave.escritorio,
      escopo:      toSave.escopo,
      naoInclusos: toSave.naoInclusos,
      prazo:       toSave.prazo,
      prazoEtapas: toSave.prazoEtapas,
      aceite:      toSave.aceite,
      titulo:      toSave.titulo,
      subtitulo:   toSave.subtitulo,
    };
    await window.storage.set(PROPOSTA_PADRAO_KEY, JSON.stringify(padrao));
    setSavedMsg("✓ Modelo salvo!");
    setTimeout(() => setSavedMsg(""), 3000);
  }

  async function handleGeraPDF() {
    if (!window.jspdf) { setSavedMsg("Aguarde 2s e tente novamente."); return; }
    try {
      let logoData = null;
      try { const lr = await window.storage.get("escritorio-logo"); if (lr?.value) logoData = lr.value; } catch {}
      await buildPdf(orc, logoData, modelo || defaultModelo(orc, arqTotalFix, engTotalFix, grandTotal, fmt, fmtM2, nUnid, engUnit, r), corTema, bgLogo, incluiArq, incluiEng);
    } catch(err) { setSavedMsg("Erro: "+err.message); }
  }

  function handleLogo(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setLogo(ev.target.result); try { window.storage.set("escritorio-logo", ev.target.result); } catch {} };
    reader.readAsDataURL(file);
  }

  // Drag logo
  function onLogoDragStart(e) {
    setDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  }
  function onMouseMove(e) {
    const container = document.getElementById("proposta-logo-container");
    if (!container) return;
    const cr = container.getBoundingClientRect();
    if (dragging) setLogoPos({ x: e.clientX - cr.left - dragOffset.current.x, y: e.clientY - cr.top - dragOffset.current.y });
    if (draggingQuadro) {
      const nx = e.clientX - cr.left - dragOffsetQuadro.current.x;
      const ny = e.clientY - cr.top - dragOffsetQuadro.current.y;
      setQuadroPos({ x:nx, y:ny });
    }
  }
  function onMouseUp() { setDragging(false); setDraggingQuadro(false); }
  function onQuadroDragStart(e) {
    setDraggingQuadro(true);
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffsetQuadro.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  }

  // Editable text
  const E = ({ val, onSave, style={}, multiline=false, bold=false }) => {
    const [editing, setEditing] = useState(false);
    const [tmp, setTmp] = useState(val);
    if (editing) {
      const s = { fontFamily:"inherit", fontSize:"inherit", color:"inherit", fontWeight:"inherit", background:"#fffde7", border:"2px solid #f59e0b", borderRadius:4, padding:"2px 6px", width:"100%", outline:"none", resize:"vertical", ...style };
      if (multiline) return <textarea autoFocus rows={3} style={s} value={tmp} onChange={e=>setTmp(e.target.value)} onBlur={()=>{onSave(tmp);setEditing(false);}} />;
      return <input autoFocus type="text" style={s} value={tmp} onChange={e=>setTmp(e.target.value)} onBlur={()=>{onSave(tmp);setEditing(false);}} onKeyDown={e=>{if(e.key==="Enter"){onSave(tmp);setEditing(false);}}} />;
    }
    return <span style={{ cursor:"pointer", borderBottom:"1px dashed #cbd5e1", fontWeight:bold?"700":"inherit", ...style }} title="Clique para editar" onClick={()=>{setTmp(val);setEditing(true);}}>{val}</span>;
  };

  // Editable number
  const EN = ({ val, onSave, style={} }) => {
    const [editing, setEditing] = useState(false);
    const [tmp, setTmp] = useState(val);
    if (editing) return <input autoFocus type="number" style={{ fontFamily:"inherit", fontSize:"inherit", fontWeight:"inherit", background:"#fffde7", border:"2px solid #f59e0b", borderRadius:4, padding:"2px 6px", width:120, outline:"none", textAlign:"right", ...style }} value={tmp} onChange={e=>setTmp(e.target.value)} onBlur={()=>{onSave(parseFloat(tmp)||0);setEditing(false);}} onKeyDown={e=>{if(e.key==="Enter"){onSave(parseFloat(tmp)||0);setEditing(false);}}} />;
    return <span style={{ cursor:"pointer", borderBottom:"1px dashed #cbd5e1", ...style }} title="Clique para editar o valor" onClick={()=>{setTmp(val);setEditing(true);}}>{fmt(val)}</span>;
  };

  const totalServicos = (m.servicos||[]).reduce((s,sv)=>s+(sv.valor||0),0);
  // Imposto no editor HTML
  const temImpHTML   = !!(orc.temImposto ?? r.impostoAplicado);
  const aliqImpHTML  = orc.aliqImp ?? r.aliquotaImposto ?? 0;
  const semImpHTML   = temImpHTML ? (1 - aliqImpHTML/100) : 1;
  // servicos já têm valor COM imposto; extraímos SEM imposto para exibir nos itens
  const totalSemImpHTML  = Math.round(totalServicos * semImpHTML * 100)/100;
  const valorImpHTML     = Math.round((totalServicos - totalSemImpHTML) * 100)/100;
  const totalComImpHTML  = totalServicos;

  const secStyle = { marginBottom:24 };
  const secHead  = { borderBottom:`2px solid ${corTema.hex}`, paddingBottom:6, marginBottom:14, display:"flex", justifyContent:"space-between", alignItems:"center" };
  const secTitle = { color:corTema.hex, fontWeight:800, fontSize:14 };
  const addBtn   = { background:"#e0f2fe", border:"1px solid #7dd3fc", borderRadius:4, padding:"2px 8px", fontSize:11, cursor:"pointer", color:"#0369a1", fontFamily:"inherit" };
  const delBtn   = { background:"#fee2e2", border:"1px solid #fca5a5", borderRadius:4, padding:"1px 6px", fontSize:10, cursor:"pointer", color:"#dc2626", fontFamily:"inherit", marginLeft:6 };

  return (
    <div style={{ fontFamily:"Arial,sans-serif", background:"#fff", color:corTema.hex, borderRadius:12, border:"1px solid #e2e8f0" }}>

      {/* BARRA DE CONTROLES */}
      <div style={{ background:"#f8fafc", borderBottom:"1px solid #e2e8f0", padding:"10px 24px", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <span style={{ color:"#64748b", fontSize:12, fontWeight:700 }}>✏️ Editor de Proposta</span>
        <span style={{ color:"#94a3b8", fontSize:11 }}>Clique em qualquer texto para editar</span>
        <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center" }}>
          {savedMsg && <span style={{ color:"#4ade80", fontSize:12, fontWeight:700 }}>{savedMsg}</span>}
          <label style={{ background:"#1e293b", border:"1px solid #334155", borderRadius:6, padding:"6px 12px", fontSize:12, cursor:"pointer", color:"#94a3b8" }}>
            {logo ? "🔄 Trocar Logo" : "📎 Carregar Logo"}
            <input type="file" accept="image/*" onChange={handleLogo} style={{ display:"none" }} />
          </label>
          {logo && <button onClick={()=>{setLogo(null);try{window.storage.delete("escritorio-logo");}catch{}}} style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:6, padding:"6px 10px", fontSize:12, cursor:"pointer", color:"#f87171", fontFamily:"inherit" }}>✕ Logo</button>}
          <button onClick={()=>setShowCorModal(true)} style={{ background:"#1e293b", border:`2px solid ${corTema.hex}`, borderRadius:6, padding:"6px 12px", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit", color:"#f1f5f9", display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ width:12, height:12, borderRadius:"50%", background:corTema.hex, display:"inline-block" }} />
            Cores PDF
          </button>
          <button onClick={salvarModelo} style={{ background:"linear-gradient(135deg,#059669,#047857)", color:"#fff", border:"none", borderRadius:6, padding:"6px 16px", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>💾 Salvar Modelo</button>
          <button onClick={handleGeraPDF} style={{ background:"linear-gradient(135deg,#7c3aed,#5b21b6)", color:"#fff", border:"none", borderRadius:6, padding:"6px 16px", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>⬇ Gerar PDF</button>
        </div>
      </div>

      {/* MODAL CORES */}
      {showCorModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={()=>setShowCorModal(false)}>
          <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:14, padding:28, minWidth:380, maxWidth:480 }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ fontWeight:800, fontSize:15, color:"#f1f5f9", marginBottom:6 }}>🎨 Escolher Cores do PDF</div>
            <div style={{ color:"#64748b", fontSize:11, marginBottom:20 }}>A cor escolhida será usada nos títulos, linhas, fundo dos itens e caixa de total.</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {TEMAS_COR.map(t => (
                <div key={t.nome} onClick={()=>{ setCorTema(t); setShowCorModal(false); }}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:8, cursor:"pointer",
                    border: corTema.nome===t.nome ? `2px solid ${t.hex}` : "2px solid #1e293b",
                    background: corTema.nome===t.nome ? "rgba(255,255,255,0.05)" : "transparent" }}>
                  <div style={{ width:28, height:28, borderRadius:6, background:t.hex, flexShrink:0, border:"1px solid rgba(255,255,255,0.1)" }} />
                  <div>
                    <div style={{ color:"#e2e8f0", fontSize:12, fontWeight:600 }}>{t.nome}</div>
                    <div style={{ color:"#475569", fontSize:10 }}>{t.hex}</div>
                  </div>
                  {corTema.nome===t.nome && <span style={{ marginLeft:"auto", color:t.hex, fontSize:14 }}>✓</span>}
                </div>
              ))}
            </div>
            <div style={{ marginTop:20, borderTop:"1px solid #1e293b", paddingTop:16 }}>
              <div style={{ color:"#94a3b8", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, marginBottom:10 }}>Fundo do Logotipo</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {[
                  { nome:"Transparente", val:"transparent", preview:"repeating-conic-gradient(#555 0% 25%,#333 0% 50%) 0 0/10px 10px" },
                  { nome:"Branco",       val:"#ffffff",     preview:"#ffffff" },
                  { nome:"Preto",        val:"#111827",     preview:"#111827" },
                  { nome:"Cinza Claro",  val:"#f1f5f9",     preview:"#f1f5f9" },
                  { nome:"Cor do Tema",  val:"__tema__",    preview: corTema.hex },
                ].map(opt => (
                  <div key={opt.val} onClick={()=>setBgLogo(opt.val)}
                    style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, cursor:"pointer", opacity: bgLogo===opt.val ? 1 : 0.6 }}>
                    <div style={{ width:36, height:36, borderRadius:6, background:opt.preview, border: bgLogo===opt.val ? `2px solid ${corTema.hex}` : "2px solid #334155" }} />
                    <span style={{ color:"#94a3b8", fontSize:9 }}>{opt.nome}</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={()=>setShowCorModal(false)} style={{ marginTop:16, width:"100%", background:"#1e293b", border:"none", borderRadius:8, padding:"8px 0", color:"#94a3b8", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Fechar</button>
          </div>
        </div>
      )}

      {/* PROPOSTA */}
      <div id="proposta-comercial-print" style={{ padding:"40px 48px", maxWidth:820, margin:"0 auto" }}
        onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>

        {/* CABEÇALHO */}
        <div id="proposta-logo-container" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:32, paddingBottom:24, borderBottom:`3px solid ${corTema.hex}`, position:"relative", minHeight:90 }}>
          <div style={{ position:"relative", minWidth:180, minHeight:80 }}>
            {/* Quadro colorido arrastável — exatamente o tamanho do logo */}
            <div
              onMouseDown={onQuadroDragStart}
              style={{ position:"absolute", left:quadroPos.x, top:quadroPos.y,
                background:corTema.hex, borderRadius:6,
                cursor:"grab", userSelect:"none",
                display:"inline-block", lineHeight:0 }}>
              {logo
                ? <img src={logo} alt="Logo"
                    style={{ maxWidth:200, height:64, width:"auto", objectFit:"contain", display:"block", borderRadius:6 }}
                    draggable={false} />
                : <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center",
                    width:72, height:72, color:"#fff", fontWeight:800, fontSize:11,
                    letterSpacing:1, textAlign:"center", padding:8, boxSizing:"border-box" }}>
                    {m.escritorio.nome}
                  </span>
              }
            </div>
          </div>
          <div style={{ textAlign:"right", fontSize:12, color:"#475569", lineHeight:2 }}>
            <div style={{ fontWeight:700, color:corTema.hex }}><E val={m.escritorio.nome} onSave={v=>set("escritorio.nome",v)} bold /></div>
            <div><E val={m.escritorio.cidade} onSave={v=>set("escritorio.cidade",v)} /></div>
            <div><E val={m.escritorio.tel} onSave={v=>set("escritorio.tel",v)} /></div>
            <div><E val={m.escritorio.email} onSave={v=>set("escritorio.email",v)} /></div>
            <div><E val={m.escritorio.social} onSave={v=>set("escritorio.social",v)} /></div>
          </div>
        </div>

        {/* TÍTULO */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ background:`linear-gradient(135deg,${corTema.hex}cc,${corTema.hex})`, color:"#fff", borderRadius:10, padding:"18px 32px", display:"inline-block" }}>
            <div style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", opacity:0.8, marginBottom:6 }}>
              <E val={m.subtitulo} onSave={v=>set("subtitulo",v)} style={{ color:"#fff", opacity:0.8 }} />
            </div>
            <div style={{ fontSize:18, fontWeight:800 }}>
              <E val={m.titulo} onSave={v=>set("titulo",v)} style={{ color:"#fff" }} />
            </div>
          </div>
          <div style={{ marginTop:12, color:"#64748b", fontSize:12 }}>
            Emitido em <E val={m.dataEmissao} onSave={v=>set("dataEmissao",v)} /> · Válido até <E val={m.validade} onSave={v=>set("validade",v)} />
          </div>
        </div>

        {/* 1. DADOS DO CLIENTE */}
        <div style={secStyle}>
          <div style={secHead}><span style={secTitle}>1. DADOS DO CLIENTE E DO PROJETO</span></div>
          <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"16px 20px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            {[["Cliente","cliente.nome"],["Tipo de Obra","cliente.tipoObra"],["Responsável","cliente.responsavel"]].map(([lbl,path])=>(
              <div key={path}>
                <div style={{ fontSize:10, color:"#64748b", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{lbl}</div>
                <div style={{ fontWeight:600, color:corTema.hex }}><E val={m.cliente[path.split(".")[1]]} onSave={v=>set(path,v)} /></div>
              </div>
            ))}
            <div style={{ gridColumn:"1 / -1" }}>
              <div style={{ fontSize:10, color:"#64748b", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Resumo do Projeto</div>
              <div style={{ fontWeight:600, color:corTema.hex, whiteSpace:"pre-wrap", wordBreak:"break-word", lineHeight:1.5 }}>
                <E val={m.cliente["resumo"]} onSave={v=>set("cliente.resumo",v)} />
              </div>
            </div>
          </div>
        </div>

        {/* 2. VALORES */}
        <div style={secStyle}>
          <div style={secHead}>
            <span style={secTitle}>2. VALORES DOS PROJETOS</span>
            <button style={addBtn} onClick={()=>{
              const newId = Date.now();
              set("servicos", [...(m.servicos||[]), { id:newId, descricao:"Novo Serviço", sub:"", valor:0 }]);
            }}>+ Adicionar serviço</button>
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:corTema.hex, color:"#fff" }}>
                <th style={{ padding:"10px 14px", textAlign:"left", fontWeight:700, fontSize:12 }}>Serviço</th>
                <th style={{ padding:"10px 14px", textAlign:"right", fontWeight:700, fontSize:12 }}>
                  {temImpHTML ? "Valor (sem imposto)" : "Valor"}
                </th>
                <th style={{ padding:"4px", width:30 }}></th>
              </tr>
            </thead>
            <tbody>
              {(m.servicos||[]).map((sv,i)=>(
                <tr key={sv.id} style={{ background: i%2===0?"#fff":"#f8fafc", borderBottom:"1px solid #e2e8f0" }}>
                  <td style={{ padding:"10px 14px" }}>
                    <div style={{ fontWeight:600 }}>
                      <E val={sv.descricao} onSave={v=>{ const s=[...(m.servicos||[])]; s[i]={...s[i],descricao:v}; set("servicos",s); }} />
                    </div>
                    {(sv.sub||"").length>0 && (
                      <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>
                        <E val={sv.sub} onSave={v=>{ const s=[...(m.servicos||[])]; s[i]={...s[i],sub:v}; set("servicos",s); }} />
                      </div>
                    )}
                  </td>
                  <td style={{ padding:"10px 14px", textAlign:"right", fontWeight:700 }}>
                    {temImpHTML
                      ? fmt(Math.round(sv.valor * semImpHTML * 100)/100)
                      : <EN val={sv.valor} onSave={v=>{ const s=[...(m.servicos||[])]; s[i]={...s[i],valor:v}; set("servicos",s); }} />
                    }
                  </td>
                  <td style={{ padding:"4px", textAlign:"center" }}>
                    <button style={delBtn} onClick={()=>{ const s=(m.servicos||[]).filter((_,j)=>j!==i); set("servicos",s); }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {temImpHTML ? (
                <>
                  <tr style={{ background:"#f8fafc", borderBottom:"1px solid #e2e8f0" }}>
                    <td style={{ padding:"10px 14px", color:"#64748b", fontSize:13 }}>Total sem impostos</td>
                    <td style={{ padding:"10px 14px", textAlign:"right", color:"#64748b", fontWeight:700 }}>{fmt(totalSemImpHTML)}</td>
                    <td></td>
                  </tr>
                  <tr style={{ background:"#fff3f3", borderBottom:"1px solid #fecaca" }}>
                    <td style={{ padding:"8px 14px", fontSize:12, color:"#dc2626" }}>+ {aliqImpHTML}% de impostos (ISS/tributos)</td>
                    <td style={{ padding:"8px 14px", textAlign:"right", color:"#dc2626", fontWeight:700 }}>{fmt(valorImpHTML)}</td>
                    <td></td>
                  </tr>
                  <tr style={{ background:corTema.hex, color:"#fff" }}>
                    <td style={{ padding:"12px 14px", fontWeight:800, fontSize:14 }} colSpan={2}>
                      TOTAL GERAL (com impostos) &nbsp;&nbsp; {fmt(totalComImpHTML)}
                    </td>
                    <td></td>
                  </tr>
                </>
              ) : (
                <tr style={{ background:corTema.hex, color:"#fff" }}>
                  <td style={{ padding:"12px 14px", fontWeight:800, fontSize:14 }} colSpan={2}>
                    TOTAL GERAL &nbsp;&nbsp; {fmt(totalServicos)}
                  </td>
                  <td></td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        {/* 3. FORMAS DE PAGAMENTO */}
        <div style={secStyle}>
          <div style={secHead}>
            <span style={secTitle}>
              {m.pagamento.tipoPagamento === "etapas"
                ? "3. FORMAS DE PAGAMENTO E CONTRATAÇÃO POR ETAPA"
                : "3. FORMAS DE PAGAMENTO"}
            </span>
          </div>

          {/* Tabela de etapas */}
          {m.pagamento.tipoPagamento === "etapas" && (() => {
            const arqValCI = (m.servicos||[])[0]?.valor || totalServicos; // com imposto
            const engValCI = incluiEng ? (m.servicos||[]).slice(1).reduce((s,sv)=>s+(sv.valor||0),0) : 0;
            const arqValSI = temImpHTML ? Math.round(arqValCI * semImpHTML * 100)/100 : arqValCI;
            const engValSI = temImpHTML ? Math.round(engValCI * semImpHTML * 100)/100 : engValCI;
            const etapas = m.pagamento.etapasPct || [];
            const totalPct = etapas.reduce((s,e)=>s+Number(e.pct),0);
            const totalGeralCI = arqValCI + engValCI;
            const totalGeralSI = arqValSI + engValSI;
            const fmtBrl2 = v => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
            return (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, color:"#64748b", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Cronograma de Pagamento — Por Etapas</div>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead>
                    <tr style={{ background:corTema.hex, color:"#fff" }}>
                      <th style={{ padding:"8px 12px", textAlign:"left", fontWeight:700, fontSize:12 }}>Etapa</th>
                      <th style={{ padding:"8px 12px", textAlign:"center", fontWeight:700, fontSize:12, width:60 }}>%</th>
                      <th style={{ padding:"8px 12px", textAlign:"right", fontWeight:700, fontSize:12 }}>{temImpHTML ? "Valor (c/ impostos)" : "Valor"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {etapas.map((etapa,i) => (
                      <tr key={etapa.id} style={{ background: i%2===0?"#f8fafc":"#fff", borderBottom:"1px solid #e2e8f0" }}>
                        <td style={{ padding:"9px 12px", color:"#1e293b", fontWeight:600 }}>{etapa.nome}</td>
                        <td style={{ padding:"9px 12px", textAlign:"center", color:corTema.hex, fontWeight:700 }}>{etapa.pct}%</td>
                        <td style={{ padding:"9px 12px", textAlign:"right", color:"#1e293b", fontWeight:700 }}>{fmtBrl2(arqValCI * etapa.pct / 100)}</td>
                      </tr>
                    ))}
                    {incluiEng && engValCI > 0 && (
                      <tr style={{ background: etapas.length%2===0?"#f8fafc":"#fff", borderBottom:"1px solid #e2e8f0" }}>
                        <td style={{ padding:"9px 12px" }}>
                          <div style={{ color:"#1e293b", fontWeight:600 }}>Projetos de Engenharia</div>
                          <div style={{ color:"#64748b", fontSize:11, marginTop:2 }}>Estrutural · Elétrico · Hidrossanitário</div>
                        </td>
                        <td style={{ padding:"9px 12px", textAlign:"center", color:"#64748b" }}>—</td>
                        <td style={{ padding:"9px 12px", textAlign:"right", color:"#1e293b", fontWeight:700 }}>{fmtBrl2(engValCI)}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:corTema.hex, color:"#fff" }}>
                      <td style={{ padding:"9px 12px", fontWeight:800 }}>Total</td>
                      <td style={{ padding:"9px 12px", textAlign:"center", fontWeight:800 }}>{totalPct.toFixed(0)}%</td>
                      <td style={{ padding:"9px 12px", textAlign:"right", fontWeight:800 }}>{fmtBrl2(totalGeralCI)}</td>
                    </tr>
                  </tfoot>
                </table>

                {/* Contratação Etapa a Etapa */}
                <div style={{ marginTop:16, border:`1px solid ${corTema.hex}44`, borderRadius:10, overflow:"hidden" }}>
                  <div style={{ background:corTema.hex, color:"#fff", padding:"10px 14px", fontWeight:700, fontSize:13 }}>
                    Contratação — Etapa a Etapa
                  </div>
                  <div style={{ padding:"12px 14px", background:`${corTema.hex}08` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid #e2e8f0" }}>
                      <span style={{ fontSize:12, color:"#475569" }}>Pagamento antecipado por etapa ({m.pagamento?.descontoEtapaCtrt??orc.descontoEtapaCtrt??5}% de desconto antecipado)</span>
                      <span style={{ fontSize:12, color:"#64748b", fontWeight:600 }}>—</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0" }}>
                      <span style={{ fontSize:12, color:"#475569" }}>Parcelado: entrada + {(m.pagamento?.parcelasEtapaCtrt??orc.parcelasEtapaCtrt??2)-1} parcela{(m.pagamento?.parcelasEtapaCtrt??orc.parcelasEtapaCtrt??2)>2?"s":""} em 30 dias</span>
                      <span style={{ fontSize:12, color:"#475569", fontWeight:700 }}>{m.pagamento?.parcelasEtapaCtrt??orc.parcelasEtapaCtrt??2}× por etapa</span>
                    </div>
                  </div>
                </div>

                {/* Contratação Pacote Completo */}
                {(() => {
                  const pctDescP = m.pagamento?.descontoPacoteCtrt??orc.descontoPacoteCtrt??15;
                  const labelPacote = incluiArq && incluiEng
                    ? "Contratação — Etapas Completas (Arq. + Eng.)"
                    : incluiArq ? "Contratação — Etapas Completas Arquitetônico"
                    : "Contratação — Etapas Completas Engenharia";
                  // Desconto sobre SEM imposto → reaplica imposto por dentro
                  const totalSIDisc  = Math.round(totalGeralSI * (1 - pctDescP/100) * 100)/100;
                  const totalCIDisc  = temImpHTML ? Math.round(totalSIDisc / semImpHTML * 100)/100 : totalSIDisc;
                  const economia     = Math.round((totalGeralCI - totalCIDisc) * 100)/100;
                  const parcela8x    = Math.round(totalCIDisc / (m.pagamento?.parcelasPacoteCtrt??orc.parcelasPacoteCtrt??8) * 100)/100;
                  return (
                    <div style={{ marginTop:12, border:`2px solid ${corTema.hex}`, borderRadius:10, overflow:"hidden" }}>
                      <div style={{ background:corTema.hex, color:"#fff", padding:"10px 14px", fontWeight:700, fontSize:13 }}>
                        {labelPacote}
                      </div>
                      <div style={{ padding:"14px 16px", background:`${corTema.hex}0d` }}>
                        <div style={{ fontSize:11, color:"#94a3b8", textDecoration:"line-through", marginBottom:2 }}>De {fmtBrl2(totalGeralCI)} (sem desconto)</div>
                        {temImpHTML && <div style={{ fontSize:11, color:"#64748b", marginBottom:4 }}>Desconto calculado sobre valor sem impostos: {fmtBrl2(totalGeralSI)}</div>}
                        <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:4 }}>
                          <span style={{ fontWeight:900, fontSize:20, color:"#1e293b" }}>{fmtBrl2(totalCIDisc)}</span>
                          <span style={{ background:`${corTema.hex}22`, color:corTema.hex, fontWeight:700, fontSize:11, borderRadius:4, padding:"2px 7px" }}>{pctDescP}% OFF</span>
                        </div>
                        <div style={{ fontSize:11, color:"#10b981", fontWeight:600, marginBottom:10 }}>
                          Desconto de {fmtBrl2(economia)} ({pctDescP}%){temImpHTML ? ` · Total c/ impostos: ${fmtBrl2(totalCIDisc)}` : ""}
                        </div>
                        <div style={{ background:"#fff", border:`1px solid ${corTema.hex}44`, borderRadius:8, padding:"10px 12px" }}>
                          <div style={{ fontSize:11, color:corTema.hex, fontWeight:700, marginBottom:4 }}>📅 Parcelado em {m.pagamento?.parcelasPacoteCtrt??orc.parcelasPacoteCtrt??8}× — {pctDescP}% de desconto já incluso</div>
                          <div style={{ fontWeight:800, fontSize:16, color:"#1e293b" }}>{fmtBrl2(parcela8x)} × {m.pagamento?.parcelasPacoteCtrt??orc.parcelasPacoteCtrt??8}×</div>
                          <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>Entrada + {(m.pagamento?.parcelasPacoteCtrt??orc.parcelasPacoteCtrt??8)-1} parcelas iguais com desconto incluso</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* Pagamento padrão — cards */}
          {m.pagamento.tipoPagamento !== "etapas" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              {(m.pagamento.opcoes||[]).map((op,i)=>{
                const baseCI   = i===0 ? ((m.servicos||[])[0]?.valor || totalServicos) : totalServicos;
                const baseSI   = temImpHTML ? Math.round(baseCI * semImpHTML * 100)/100 : baseCI;
                const desc     = op.descAntec || 0;
                const nParc    = op.nParcelas || 4;
                // Desconto sobre SEM imposto → reaplica imposto
                const baseSIDisc = Math.round(baseSI*(1-desc/100)*100)/100;
                const economia   = Math.round(baseSI*desc/100*100)/100;
                const comDescCI  = temImpHTML ? Math.round(baseSIDisc/semImpHTML*100)/100 : baseSIDisc;
                const parcela    = Math.round(comDescCI/nParc*100)/100;
                return (
                  <div key={op.id} style={{ border:`2px solid ${corTema.hex}`, borderRadius:10, overflow:"hidden" }}>
                    <div style={{ background: corTema.hex, color:"#fff", padding:"12px 16px", fontWeight:700, fontSize:13 }}>
                      <E val={op.titulo} onSave={v=>{ const ops=[...(m.pagamento.opcoes||[])]; ops[i]={...ops[i],titulo:v}; set("pagamento.opcoes",ops); }} style={{ color:"#fff" }} />
                    </div>
                    <div style={{ padding:"14px 16px", background:`${corTema.hex}0d` }}>
                      <div style={{ fontSize:11, color:"#94a3b8", textDecoration:"line-through", marginBottom:2 }}>De {fmt(baseCI)}</div>
                      {temImpHTML && <div style={{ fontSize:11, color:"#64748b", marginBottom:4 }}>Desc. s/ val. sem impostos: {fmt(baseSI)}</div>}
                      <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:4 }}>
                        <span style={{ fontWeight:900, fontSize:20, color:"#1e293b" }}>{fmt(comDescCI)}</span>
                        <span style={{ background:`${corTema.hex}22`, color:corTema.hex, fontWeight:700, fontSize:11, borderRadius:4, padding:"2px 7px" }}>{desc}% OFF</span>
                      </div>
                      <div style={{ fontSize:11, color:"#10b981", fontWeight:600, marginBottom:10 }}>Economia de {fmt(economia)}</div>
                      <div style={{ background:"#fff", border:`1px solid ${corTema.hex}44`, borderRadius:8, padding:"10px 12px" }}>
                        <div style={{ fontSize:11, color:corTema.hex, fontWeight:700, marginBottom:4 }}>📅 Parcelado em {nParc}× — {desc}% de desconto incluso</div>
                        <div style={{ fontWeight:800, fontSize:16, color:"#1e293b" }}>{fmt(parcela)} × {nParc}×</div>
                        <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>Entrada + {nParc-1} parcelas iguais com desconto incluso</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop:16, background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8, padding:"14px 18px" }}>
            <div style={{ fontWeight:700, color:"#15803d", fontSize:13, marginBottom:4 }}>Pagamento via PIX</div>
            <div style={{ color:"#475569", fontSize:12 }}><E val={m.pagamento.pix} onSave={v=>set("pagamento.pix",v)} /></div>
            <div style={{ color:"#64748b", fontSize:11, marginTop:4 }}><E val={m.pagamento.banco} onSave={v=>set("pagamento.banco",v)} /></div>
          </div>
        </div>

        {/* 4. ESCOPO */}
        <div style={secStyle}>
          <div style={secHead}>
            <span style={secTitle}>4. ESCOPO DOS SERVIÇOS</span>
            {m.pagamento.tipoPagamento !== "etapas" && (
              <button style={addBtn} onClick={()=>{ const newId=Date.now(); set("escopo",[...(m.escopo||[]),{id:newId,titulo:"Novo Grupo",itens:[""]}]); }}>+ Grupo</button>
            )}
          </div>

          {/* Escopo por etapas — blocos editáveis */}
          {m.pagamento.tipoPagamento === "etapas" ? (() => {
            const blocos = m.escopoEtapas || [];
            const engItens = m.escopoEng || [];
            // Renumera títulos após inserção/exclusão — preserva texto após ". "
            const renumerar = (arr) => arr.map((b, i) => {
              const semNum = b.titulo?.replace(/^\d+\.\s*/, "") || b.titulo || "";
              return { ...b, titulo: `${i+1}. ${semNum}` };
            });
            const updBloco = (gi, field, val) => {
              const e = JSON.parse(JSON.stringify(blocos));
              e[gi][field] = val;
              set("escopoEtapas", e);
            };
            const updBlocoItem = (gi, field, ii, val) => {
              const e = JSON.parse(JSON.stringify(blocos));
              e[gi][field][ii] = val;
              set("escopoEtapas", e);
            };
            const delBlocoItem = (gi, field, ii) => {
              const e = JSON.parse(JSON.stringify(blocos));
              e[gi][field].splice(ii,1);
              set("escopoEtapas", e);
            };
            const addBlocoItem = (gi, field) => {
              const e = JSON.parse(JSON.stringify(blocos));
              e[gi][field].push("Novo item");
              set("escopoEtapas", e);
            };
            return (
              <div>
                {blocos.map((bloco,gi) => (
                  <div key={bloco.id} style={{ marginBottom:20, border:"1px solid #e2e8f0", borderRadius:10, overflow:"hidden" }}>
                    {/* Título do bloco */}
                    <div style={{ background:corTema.hex, color:"#fff", padding:"10px 16px", display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ flex:1, fontWeight:700, fontSize:13 }}>
                        <E val={bloco.titulo} onSave={v=>updBloco(gi,"titulo",v)} style={{ color:"#fff" }} />
                      </div>
                      {gi >= 4 && <button style={delBtn} onClick={()=>set("escopoEtapas", renumerar(blocos.filter((_,j)=>j!==gi)))}>✕</button>}
                    </div>
                    <div style={{ padding:"14px 16px" }}>
                      {/* Objetivo */}
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 }}>Objetivo</div>
                        <div style={{ fontSize:14, color:"#374151", lineHeight:1.6 }}>
                          <E val={bloco.objetivo} onSave={v=>updBloco(gi,"objetivo",v)} multiline />
                        </div>
                      </div>
                      {/* Serviços Inclusos */}
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6, display:"flex", justifyContent:"space-between" }}>
                          <span>Serviços Inclusos</span>
                          <button style={addBtn} onClick={()=>addBlocoItem(gi,"itens")}>+ item</button>
                        </div>
                        {(bloco.itens||[]).map((it,ii)=>(
                          <div key={ii} style={{ display:"flex", gap:8, fontSize:14, color:"#374151", marginBottom:4, alignItems:"flex-start" }}>
                            <span style={{ color:corTema.hex, flexShrink:0, marginTop:2 }}>•</span>
                            <div style={{ flex:1 }}><E val={it} onSave={v=>updBlocoItem(gi,"itens",ii,v)} multiline /></div>
                            <button style={delBtn} onClick={()=>delBlocoItem(gi,"itens",ii)}>✕</button>
                          </div>
                        ))}
                      </div>
                      {/* Entregáveis */}
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6, display:"flex", justifyContent:"space-between" }}>
                          <span>Entregáveis</span>
                          <button style={addBtn} onClick={()=>addBlocoItem(gi,"entregaveis")}>+ item</button>
                        </div>
                        {(bloco.entregaveis||[]).map((it,ii)=>(
                          <div key={ii} style={{ display:"flex", gap:8, fontSize:14, color:"#374151", marginBottom:4, alignItems:"flex-start" }}>
                            <span style={{ color:corTema.hex, flexShrink:0, marginTop:2 }}>–</span>
                            <div style={{ flex:1 }}><E val={it} onSave={v=>updBlocoItem(gi,"entregaveis",ii,v)} multiline /></div>
                            <button style={delBtn} onClick={()=>delBlocoItem(gi,"entregaveis",ii)}>✕</button>
                          </div>
                        ))}
                      </div>
                      {/* Observação */}
                      <div style={{ background:"#f8fafc", borderRadius:6, padding:"10px 12px", fontSize:13, color:"#64748b", lineHeight:1.5, borderLeft:`3px solid ${corTema.hex}` }}>
                        <E val={bloco.obs} onSave={v=>updBloco(gi,"obs",v)} multiline />
                      </div>
                    </div>
                  </div>
                ))}
                <button style={{ ...addBtn, marginBottom:16 }} onClick={()=>{ const n=blocos.length+1; set("escopoEtapas", renumerar([...blocos,{id:Date.now(),titulo:`${n}. Nova Etapa`,objetivo:"",itens:[""],entregaveis:[""],obs:""}])); }}>+ Etapa</button>

                {/* Engenharia — editável */}
                {incluiEng && (
                  <div style={{ border:"1px solid #e2e8f0", borderRadius:10, overflow:"hidden" }}>
                    <div style={{ background:corTema.hex, color:"#fff", padding:"10px 16px", fontWeight:700, fontSize:13, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span>{blocos.length+1}. Projetos Complementares de Engenharia</span>
                      <button style={addBtn} onClick={()=>set("escopoEng",[...engItens,"Novo item"])}>+ item</button>
                    </div>
                    <div style={{ padding:"14px 16px" }}>
                      {engItens.map((it,ii)=>(
                        <div key={ii} style={{ display:"flex", gap:8, fontSize:14, color:"#374151", marginBottom:4, alignItems:"flex-start" }}>
                          <span style={{ color:corTema.hex, flexShrink:0, marginTop:2 }}>•</span>
                          <div style={{ flex:1 }}><E val={it} onSave={v=>{ const e=[...engItens]; e[ii]=v; set("escopoEng",e); }} multiline /></div>
                          <button style={delBtn} onClick={()=>set("escopoEng",engItens.filter((_,j)=>j!==ii))}>✕</button>
                        </div>
                      ))}
                      <div style={{ marginTop:10, fontSize:13, color:"#94a3b8", fontStyle:"italic", lineHeight:1.5 }}>
                        Obs.: Este item poderá ser contratado diretamente pelo cliente junto a engenheiros terceiros, ficando a compatibilização sob responsabilidade dos profissionais contratados.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })() : (() => {
            /* Escopo padrão — blocos detalhados editáveis (mesmo padrão do escopoEtapas) */
            const blocos = m.escopo || [];
            const engItensP = m.escopoEng || [];
            const updBloco = (gi, field, val) => {
              const e = JSON.parse(JSON.stringify(blocos));
              e[gi][field] = val;
              set("escopo", e);
            };
            const updBlocoItem = (gi, field, ii, val) => {
              const e = JSON.parse(JSON.stringify(blocos));
              e[gi][field][ii] = val;
              set("escopo", e);
            };
            const delBlocoItem = (gi, field, ii) => {
              const e = JSON.parse(JSON.stringify(blocos));
              e[gi][field].splice(ii,1);
              set("escopo", e);
            };
            const addBlocoItem = (gi, field) => {
              const e = JSON.parse(JSON.stringify(blocos));
              e[gi][field] = [...(e[gi][field]||[]), "Novo item"];
              set("escopo", e);
            };
            return (
              <div>
                {blocos.map((bloco,gi) => (
                  <div key={bloco.id||gi} style={{ marginBottom:20, border:"1px solid #e2e8f0", borderRadius:10, overflow:"hidden" }}>
                    <div style={{ background:corTema.hex, color:"#fff", padding:"10px 16px", display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ flex:1, fontWeight:700, fontSize:13 }}>
                        <E val={bloco.titulo} onSave={v=>updBloco(gi,"titulo",v)} style={{ color:"#fff" }} />
                      </div>
                      {gi >= 3 && <button style={delBtn} onClick={()=>{ const renP=(arr)=>arr.map((b,i)=>({...b,titulo:`${i+1}. ${b.titulo?.replace(/^\d+\.\s*/,"")}`})); set("escopo",renP(blocos.filter((_,j)=>j!==gi))); }}>✕</button>}
                    </div>
                    <div style={{ padding:"14px 16px" }}>
                      {bloco.objetivo !== undefined && (
                        <div style={{ marginBottom:12 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 }}>Objetivo</div>
                          <div style={{ fontSize:14, color:"#374151", lineHeight:1.6 }}>
                            <E val={bloco.objetivo||""} onSave={v=>updBloco(gi,"objetivo",v)} multiline />
                          </div>
                        </div>
                      )}
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6, display:"flex", justifyContent:"space-between" }}>
                          <span>Serviços Inclusos</span>
                          <button style={addBtn} onClick={()=>addBlocoItem(gi,"itens")}>+ item</button>
                        </div>
                        {(bloco.itens||[]).map((it,ii)=>(
                          <div key={ii} style={{ display:"flex", gap:8, fontSize:14, color:"#374151", marginBottom:4, alignItems:"flex-start" }}>
                            <span style={{ color:corTema.hex, flexShrink:0, marginTop:2 }}>•</span>
                            <div style={{ flex:1 }}><E val={it} onSave={v=>updBlocoItem(gi,"itens",ii,v)} multiline /></div>
                            <button style={delBtn} onClick={()=>delBlocoItem(gi,"itens",ii)}>✕</button>
                          </div>
                        ))}
                      </div>
                      {bloco.entregaveis !== undefined && (
                        <div style={{ marginBottom:12 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:0.5, marginBottom:6, display:"flex", justifyContent:"space-between" }}>
                            <span>Entregáveis</span>
                            <button style={addBtn} onClick={()=>addBlocoItem(gi,"entregaveis")}>+ item</button>
                          </div>
                          {(bloco.entregaveis||[]).map((it,ii)=>(
                            <div key={ii} style={{ display:"flex", gap:8, fontSize:14, color:"#374151", marginBottom:4, alignItems:"flex-start" }}>
                              <span style={{ color:corTema.hex, flexShrink:0, marginTop:2 }}>–</span>
                              <div style={{ flex:1 }}><E val={it} onSave={v=>updBlocoItem(gi,"entregaveis",ii,v)} multiline /></div>
                              <button style={delBtn} onClick={()=>delBlocoItem(gi,"entregaveis",ii)}>✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                      {bloco.obs !== undefined && (
                        <div style={{ background:"#f8fafc", borderRadius:6, padding:"10px 12px", fontSize:13, color:"#64748b", lineHeight:1.5, borderLeft:`3px solid ${corTema.hex}` }}>
                          <E val={bloco.obs||""} onSave={v=>updBloco(gi,"obs",v)} multiline />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <button style={{ ...addBtn, marginBottom:16 }} onClick={()=>set("escopo",[...blocos,{id:Date.now(),titulo:`${blocos.length+1}. Novo Bloco`,objetivo:"",itens:[""],entregaveis:[""],obs:""}])}>+ Bloco</button>
                {incluiEng && (
                  <div style={{ border:"1px solid #e2e8f0", borderRadius:10, overflow:"hidden" }}>
                    <div style={{ background:corTema.hex, color:"#fff", padding:"10px 16px", fontWeight:700, fontSize:13, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span>{blocos.length+1}. Projetos Complementares de Engenharia</span>
                      <button style={addBtn} onClick={()=>set("escopoEng",[...engItensP,"Novo item"])}>+ item</button>
                    </div>
                    <div style={{ padding:"14px 16px" }}>
                      {engItensP.map((it,ii)=>(
                        <div key={ii} style={{ display:"flex", gap:8, fontSize:14, color:"#374151", marginBottom:4, alignItems:"flex-start" }}>
                          <span style={{ color:corTema.hex, flexShrink:0, marginTop:2 }}>•</span>
                          <div style={{ flex:1 }}><E val={it} onSave={v=>{ const e=[...engItensP]; e[ii]=v; set("escopoEng",e); }} multiline /></div>
                          <button style={delBtn} onClick={()=>set("escopoEng",engItensP.filter((_,j)=>j!==ii))}>✕</button>
                        </div>
                      ))}
                      <div style={{ marginTop:10, fontSize:13, color:"#94a3b8", fontStyle:"italic", lineHeight:1.5 }}>
                        Obs.: Este item poderá ser contratado diretamente pelo cliente junto a engenheiros terceiros, ficando a compatibilização sob responsabilidade dos profissionais contratados.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* 5. NÃO INCLUSOS */}
        <div style={secStyle}>
          <div style={secHead}>
            <span style={secTitle}>5. SERVIÇOS NÃO INCLUSOS</span>
            <button style={addBtn} onClick={()=>set("naoInclusos",[...(m.naoInclusos||[]),"Novo item"])}>+ item</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
            {(m.naoInclusos||[]).map((item,i)=>(
              <div key={i} style={{ display:"flex", gap:8, fontSize:12, color:"#6b7280", alignItems:"flex-start" }}>
                <span style={{ color:"#ef4444", flexShrink:0, marginTop:2 }}>✕</span>
                <div style={{ flex:1 }}><E val={item} onSave={v=>{ const n=[...(m.naoInclusos||[])]; n[i]=v; set("naoInclusos",n); }} /></div>
                <button style={delBtn} onClick={()=>set("naoInclusos",(m.naoInclusos||[]).filter((_,j)=>j!==i))}>✕</button>
              </div>
            ))}
          </div>
          <div style={{ marginTop:8, fontSize:11, color:"#94a3b8", fontStyle:"italic" }}>
            Obs: Todos os serviços não inclusos podem ser contratados como serviços adicionais.
          </div>
        </div>
        <div style={secStyle}>
          <div style={secHead}>
            <span style={secTitle}>6. PRAZO DE EXECUÇÃO</span>
          </div>
          {(() => {
            const prazoEtapasDefault = [
                "Prazo de 30 dias úteis por etapa, contados após conclusão e aprovação de cada etapa pelo cliente.",
                "Concluída e aprovada cada etapa, inicia-se automaticamente o prazo da etapa seguinte.",
                ...(incluiEng ? ["Projetos de Engenharia: 30 dias úteis após aprovação do projeto na Prefeitura."] : []),
            ];
            const prazoItems = m.pagamento.tipoPagamento === "etapas"
              ? (m.prazoEtapas && m.prazoEtapas.length > 0 ? m.prazoEtapas : prazoEtapasDefault)
              : (m.prazo && m.prazo.length > 0 ? m.prazo : []);
            const prazoKey = m.pagamento.tipoPagamento === "etapas" ? "prazoEtapas" : "prazo";
            return (<>
              {prazoItems.map((item,i)=>(
                <div key={i} style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, padding:"12px 16px", fontSize:13, color:"#92400e", marginBottom:8, display:"flex", gap:8, alignItems:"flex-start" }}>
                  <span style={{ flexShrink:0 }}>⏱</span>
                  <div style={{ flex:1 }}><E val={item} onSave={v=>{ const p=[...prazoItems]; p[i]=v; set(prazoKey,p); }} multiline /></div>
                  {prazoItems.length > 1 && <button style={delBtn} onClick={()=>set(prazoKey,prazoItems.filter((_,j)=>j!==i))}>✕</button>}
                </div>
              ))}
              <button style={addBtn} onClick={()=>set(prazoKey,[...prazoItems,"Novo prazo"])}>+ item</button>
            </>);
          })()}
        </div>

        {/* 7. ACEITE */}
        <div style={secStyle}>
          <div style={secHead}><span style={secTitle}>7. ACEITE DA PROPOSTA</span></div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
            <div>
              <div style={{ borderTop:`1px solid ${corTema.hex}`, paddingTop:8, marginTop:32, fontSize:12, color:"#475569" }}>
                <div>Cliente: {orc.cliente||"___________________________"}</div>
                <div style={{ marginTop:8 }}>Data: _____ / _____ / _________</div>
              </div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:12, color:"#475569", marginBottom:8 }}>Responsável Técnico</div>
              <div style={{ borderTop:`1px solid ${corTema.hex}`, paddingTop:8, marginTop:20 }}>
                <div style={{ fontWeight:700 }}><E val={m.aceite.responsavel} onSave={v=>set("aceite.responsavel",v)} bold /></div>
                <div><E val={m.aceite.registro} onSave={v=>set("aceite.registro",v)} /></div>
                <div style={{ color:"#64748b" }}><E val={m.aceite.cidade} onSave={v=>set("aceite.cidade",v)} />, {m.dataEmissao}</div>
              </div>
            </div>
          </div>
        </div>

        {/* RODAPÉ */}
        <div style={{ borderTop:"1px solid #e2e8f0", marginTop:24, paddingTop:12, textAlign:"center", fontSize:11, color:"#94a3b8" }}>
          <E val={`${m.escritorio.nome}  ·  ${m.escritorio.email}  ·  ${m.escritorio.tel}  ·  ${m.escritorio.social}`}
            onSave={v=>{ /* rodapé composto, não editável diretamente — edite os campos acima */ }} />
        </div>

      </div>
    </div>
  );
}

