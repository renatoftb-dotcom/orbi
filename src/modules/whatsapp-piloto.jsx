// ═══════════════════════════════════════════════════════════════
// WHATSAPP PILOTO — teste grátis da Cloud API (só Padovan)
// ═══════════════════════════════════════════════════════════════
// Tela de teste da integração com o número de teste da Meta. Conversa com
// as rotas /api/whatsapp-teste/* do vicke-backend (whatsapp-teste.js), que
// só respondem para a empresa piloto — para as outras o menu nem aparece
// (waPilotoStatus devolve liberado:false).
//
// Duas colunas como a caixa de Mensagens: à esquerda as obras (filtro), à
// direita o status da configuração, a conversa e o campo de envio. No
// celular vira uma coluna só: escolhe a obra e a conversa abre por cima.
// Atualiza sozinha a cada 5s enquanto a aba está visível.

async function waReq(method, path, body) {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("vicke-token") : null;
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${_API_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!json.ok) throw new Error(json.error || `Erro ${res.status}`);
  return json.data;
}

// Usada pelo app.jsx para decidir se o item de menu aparece.
async function waPilotoStatus() {
  try { return await waReq("GET", "/api/whatsapp-teste/status"); }
  catch { return { liberado: false }; }
}

const WA_AZUL = "#0474f4";
const WA_BORDA = "1.5px solid rgba(38,36,33,0.16)";

function waHora(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function waTelefone(n) {
  const d = String(n || "").replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return n || "";
}

const WA_STATUS = {
  enviado: "✓ enviado", sent: "✓ enviado", delivered: "✓✓ entregue", read: "✓✓ lido",
  failed: "não entregue", falhou: "não enviado", simulado: "simulação",
};

function WhatsappPiloto({ data, usuario }) {
  const [isMobile, setIsMobile] = useState(() => { try { return window.innerWidth < 768; } catch { return false; } });
  useEffect(() => {
    const f = () => { try { setIsMobile(window.innerWidth < 768); } catch {} };
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);

  const [status, setStatus] = useState(null);
  const [filtroObra, setFiltroObra] = useState("");     // "" = todas, "__sem_obra__", ou id
  const [busca, setBusca] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [para, setPara] = useState("");
  const [paraEditado, setParaEditado] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [abertoMobile, setAbertoMobile] = useState(false);
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const fimRef = useRef(null);

  const podeEscrever = usuario?.nivel === "admin" || usuario?.nivel === "editor" || usuario?.perfil === "master";
  const obras = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (data?.obras || [])
      .filter(o => o && o.id && (!q || String(o.nome || "").toLowerCase().includes(q)))
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
  }, [data?.obras, busca]);
  const nomeFiltro = filtroObra === "" ? "Todas as mensagens"
    : filtroObra === "__sem_obra__" ? "Sem obra vinculada"
    : ((data?.obras || []).find(o => o.id === filtroObra)?.nome || "Obra");

  const carregar = useCallback(async () => {
    try {
      const qs = filtroObra ? `?obra_id=${encodeURIComponent(filtroObra)}` : "";
      const [st, lista] = await Promise.all([
        waReq("GET", "/api/whatsapp-teste/status"),
        waReq("GET", `/api/whatsapp-teste/mensagens${qs}`),
      ]);
      setStatus(st);
      setMsgs(lista || []);
      setErro("");
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [filtroObra]);

  useEffect(() => {
    setCarregando(true);
    carregar();
    const t = setInterval(() => { if (document.visibilityState === "visible") carregar(); }, 5000);
    return () => clearInterval(t);
  }, [carregar]);

  // O destino padrão é quem mandou a última mensagem de verdade: responder
  // para o wa_id que a Meta entregou evita o problema do 9 dos celulares.
  useEffect(() => {
    if (paraEditado) return;
    const ultima = [...msgs].reverse().find(m => m.direcao === "entrada" && m.wa_id && m.wa_id !== "simulado");
    if (ultima) setPara(ultima.wa_id);
  }, [msgs, paraEditado]);

  useEffect(() => { fimRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  async function enviar() {
    if (!texto.trim() || !para.trim() || enviando) return;
    setEnviando(true); setErro("");
    try {
      const obraId = filtroObra && filtroObra !== "__sem_obra__" ? filtroObra : null;
      await waReq("POST", "/api/whatsapp-teste/enviar", { para, texto, obra_id: obraId });
      setTexto("");
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
      carregar();
    }
  }

  async function simular() {
    setErro("");
    try {
      const obraId = filtroObra && filtroObra !== "__sem_obra__" ? filtroObra : null;
      await waReq("POST", "/api/whatsapp-teste/simular", { obra_id: obraId });
      carregar();
    } catch (e) { setErro(e.message); }
  }

  const urlWebhook = `${_API_URL}${status?.webhookPath || "/webhook/whatsapp-teste"}`;
  function copiarUrl() {
    try { navigator.clipboard.writeText(urlWebhook); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch {}
  }

  const configOk = status?.tokenConfigurado && status?.phoneIdConfigurado;

  const S = {
    raiz: { display: "flex", height: "100%", minHeight: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: "#fff", color: "#111827" },
    lista: { width: isMobile ? "100%" : 300, minWidth: isMobile ? 0 : 300, borderRight: isMobile ? "none" : WA_BORDA, overflowY: "auto", display: isMobile && abertoMobile ? "none" : "flex", flexDirection: "column" },
    conversa: { flex: 1, minWidth: 0, display: isMobile && !abertoMobile ? "none" : "flex", flexDirection: "column" },
    item: (ativo) => ({ display: "block", width: "100%", textAlign: "left", background: "#fff", border: "none", borderLeft: `3px solid ${ativo ? WA_AZUL : "transparent"}`, padding: isMobile ? "14px 16px" : "10px 14px", fontSize: 13, fontWeight: ativo ? 600 : 400, color: ativo ? WA_AZUL : "#111827", cursor: "pointer", fontFamily: "inherit" }),
    btn: { background: "#fff", color: "#111827", border: WA_BORDA, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" },
    btnAzul: { background: WA_AZUL, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
    input: { border: WA_BORDA, borderRadius: 8, padding: "9px 11px", fontSize: isMobile ? 16 : 13, fontFamily: "inherit", color: "#111827", outline: "none", background: "#fff", minWidth: 0 },
  };

  if (status && status.liberado === false) {
    return <div style={{ padding: 32, fontFamily: "'Inter', system-ui, sans-serif", color: "#4b5563", fontSize: 14 }}>O teste de WhatsApp está liberado só para o escritório piloto.</div>;
  }

  return (
    <div style={S.raiz} data-vk-wa-piloto>
      {/* ── Coluna das obras ── */}
      <div style={S.lista}>
        <div style={{ padding: isMobile ? "16px 16px 10px" : "20px 14px 10px" }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>WhatsApp <span style={{ fontSize: 12, fontWeight: 500, color: "#4b5563" }}>· teste</span></div>
          <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>Número de teste da Meta, sem custo</div>
          <input style={{ ...S.input, width: "100%", boxSizing: "border-box", marginTop: 12 }} placeholder="Filtrar obras" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <button style={S.item(filtroObra === "")} onClick={() => { setFiltroObra(""); setAbertoMobile(true); }}>Todas as mensagens</button>
        <button style={S.item(filtroObra === "__sem_obra__")} onClick={() => { setFiltroObra("__sem_obra__"); setAbertoMobile(true); }}>Sem obra vinculada</button>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", letterSpacing: 0.4, textTransform: "uppercase", padding: "14px 14px 6px" }}>Obras</div>
        {obras.length === 0 && <div style={{ fontSize: 13, color: "#6b7280", padding: "4px 14px" }}>Nenhuma obra encontrada</div>}
        {obras.map(o => (
          <button key={o.id} style={S.item(filtroObra === o.id)} onClick={() => { setFiltroObra(o.id); setAbertoMobile(true); }}>{o.nome || "(sem nome)"}</button>
        ))}
      </div>

      {/* ── Conversa ── */}
      <div style={S.conversa}>
        <div style={{ padding: isMobile ? "12px 16px" : "16px 20px", borderBottom: WA_BORDA, display: "flex", alignItems: "center", gap: 10 }}>
          {isMobile && <button style={{ ...S.btn, padding: "6px 10px" }} onClick={() => setAbertoMobile(false)}>‹ Obras</button>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nomeFiltro}</div>
          </div>
          <button style={{ ...S.btn, borderColor: configOk ? "rgba(38,36,33,0.16)" : WA_AZUL, color: configOk ? "#111827" : WA_AZUL }} onClick={() => setMostrarConfig(v => !v)}>
            {status ? (configOk ? "✓ Configurado" : "Configurar") : "…"}
          </button>
        </div>

        {/* Card de status */}
        {(mostrarConfig || (status && !configOk)) && status && (
          <div style={{ margin: isMobile ? "12px 12px 0" : "14px 20px 0", border: WA_BORDA, borderRadius: 10, padding: 14, fontSize: 13 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Status do teste</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "6px 16px", color: "#4b5563" }}>
              <div>{status.tokenConfigurado ? "✓" : "✗"} WHATSAPP_TEST_TOKEN</div>
              <div>{status.phoneIdConfigurado ? "✓" : "✗"} WHATSAPP_TEST_PHONE_ID</div>
              <div>{status.assinaturaLigada ? "✓ assinatura da Meta conferida" : "– assinatura não conferida (opcional)"}</div>
              <div>Última mensagem recebida: <span style={{ color: "#111827" }}>{status.ultimaEntrada ? waHora(status.ultimaEntrada) : "nenhuma ainda"}</span></div>
            </div>
            <div style={{ marginTop: 10, color: "#4b5563" }}>URL do webhook (colar no painel da Meta):</div>
            <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
              <code style={{ fontSize: 12, background: "#f3f4f6", borderRadius: 6, padding: "6px 8px", wordBreak: "break-all", flex: 1, minWidth: 0, color: "#111827" }}>{urlWebhook}</code>
              <button style={S.btn} onClick={copiarUrl}>{copiado ? "Copiado ✓" : "Copiar"}</button>
            </div>
            <div style={{ marginTop: 6, color: "#4b5563" }}>Verify token: <code style={{ color: "#111827" }}>{status.verifyTokenPadrao ? "vicke_teste_padovan" : "o valor de WHATSAPP_VERIFY_TOKEN"}</code></div>
          </div>
        )}

        {/* Histórico */}
        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "12px" : "16px 20px", display: "flex", flexDirection: "column", gap: 8, background: "#fafafa" }}>
          {carregando && msgs.length === 0 && <div style={{ color: "#6b7280", fontSize: 13 }}>Carregando…</div>}
          {!carregando && msgs.length === 0 && (
            <div style={{ color: "#4b5563", fontSize: 13, textAlign: "center", marginTop: 40, lineHeight: 1.6 }}>
              Nenhuma mensagem aqui ainda.<br />Mande um "oi" do seu celular para o número de teste,<br />ou use "Simular mensagem de pedreiro".
            </div>
          )}
          {msgs.map(m => {
            const saida = m.direcao === "saida";
            const falhou = m.status === "failed" || m.status === "falhou";
            return (
              <div key={m.id} style={{ alignSelf: saida ? "flex-end" : "flex-start", maxWidth: isMobile ? "88%" : "70%" }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2, textAlign: saida ? "right" : "left" }}>
                  {saida ? `VICKE → ${waTelefone(m.wa_id)}` : (m.nome_contato || waTelefone(m.wa_id))}
                  {m.obra_nome && filtroObra === "" ? ` · ${m.obra_nome}` : ""}
                </div>
                <div style={{
                  background: saida ? WA_AZUL : "#f3f4f6", color: saida ? "#fff" : "#111827",
                  border: falhou ? "1.5px solid #b91c1c" : "none",
                  borderRadius: 12, padding: "8px 12px", fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {m.tipo !== "texto" && <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.85, marginBottom: m.conteudo_texto ? 4 : 0 }}>[{m.tipo}{m.media_id ? " · mídia guardada" : ""}]</div>}
                  {m.conteudo_texto}
                </div>
                <div style={{ fontSize: 11, color: falhou ? "#b91c1c" : "#6b7280", marginTop: 2, textAlign: saida ? "right" : "left" }}>
                  {waHora(m.created_at)}{saida && m.status ? ` · ${WA_STATUS[m.status] || m.status}` : ""}{!saida && m.status === "simulado" ? " · simulação" : ""}
                </div>
                {falhou && m.erro && <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 2, textAlign: "right" }}>{m.erro}</div>}
              </div>
            );
          })}
          <div ref={fimRef} />
        </div>

        {/* Envio */}
        <div style={{ borderTop: WA_BORDA, padding: isMobile ? "10px 12px 14px" : "12px 20px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {erro && <div style={{ fontSize: 13, color: "#b91c1c" }}>{erro}</div>}
          {podeEscrever ? (<>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#4b5563" }}>Para</span>
              <input style={{ ...S.input, flex: isMobile ? "1 1 0" : "0 0 220px" }} inputMode="tel" placeholder="55 14 99999-9999"
                value={para} onChange={e => { setPara(e.target.value); setParaEditado(true); }} />
              <button style={{ ...S.btn, width: isMobile ? "100%" : "auto" }} onClick={simular}>Simular mensagem de pedreiro</button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <textarea style={{ ...S.input, flex: 1, resize: "none", height: 42 }} placeholder="Escreva a resposta"
                value={texto} onChange={e => setTexto(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !isMobile) { e.preventDefault(); enviar(); } }} />
              <button style={{ ...S.btnAzul, opacity: (!texto.trim() || !para.trim() || enviando) ? 0.5 : 1 }} disabled={!texto.trim() || !para.trim() || enviando} onClick={enviar}>
                {enviando ? "Enviando…" : "Enviar"}
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>Texto livre só chega a quem mandou mensagem nas últimas 24h e está na lista de números do painel da Meta.</div>
          </>) : (
            <div style={{ fontSize: 13, color: "#4b5563" }}>Seu nível de acesso só permite ver as mensagens.</div>
          )}
        </div>
      </div>
    </div>
  );
}
