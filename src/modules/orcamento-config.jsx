// ═══════════════════════════════════════════════════════════════
// ORÇAMENTO — Configurações
// ═══════════════════════════════════════════════════════════════
// Aba "Orçamento" da seção Configuração na sidebar. Tem 2 sub-abas:
//
// 1. Configurar Preço — calibragem (profissão, padrão, estado, pct)
//    e botão "Resetar e refazer calibragem" que dispara
//    POST /admin/empresas/:id/reset-onboarding e refetcha /auth/me.
//
// 2. Configurar Modelo de Orçamento — identidade visual da proposta
//    (cor primária, tipografia, modelo de capa). Os dados moram em
//    escritorio.dados (mesmo lugar de antes — pra evitar migração
//    de schema). Save dispara via prop `save` igual outros módulos.
//
// Permissões:
// - master e admin podem editar (backend valida também).
// - Outros perfis (editor/visualizador) veem mensagem amigável.
// ═══════════════════════════════════════════════════════════════

function OrcamentoConfig({ usuario, data, save, setUsuario }) {
  // Sub-aba ativa: 'preco' (default) | 'modelo'
  const [subAba, setSubAba] = useState("preco");

  // ── Estado da aba "Configurar Preço" ──────────────────────────
  const [executando, setExecutando] = useState(false);

  // URL base da API. Mesma lógica que escritorio.jsx e shared.jsx —
  // env var Vite com fallback pro Railway prod ativo.
  const _API_URL = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL)
    || "https://orbi-production-5f5c.up.railway.app";

  // Dados frescos do servidor. Não confiamos no localStorage `vicke-user`
  // porque ele pode estar desatualizado (ex: após onboarding que não
  // refetchou). Sempre vai buscar /auth/me ao montar a aba.
  const [me, setMe]               = useState(null);
  const [meLoading, setMeLoading] = useState(true);
  const [meErro, setMeErro]       = useState(null);

  // CUB do estado da empresa (R-1 Normal — referência usada no pricing).
  // Carregado em paralelo com /auth/me. Necessário pra calcular o preço
  // base por m² que aparece em "Preço base aplicado".
  const [cub, setCub] = useState(null);

  async function carregarMe() {
    setMeLoading(true);
    setMeErro(null);
    try {
      const token = localStorage.getItem("vicke-token");
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");
      const res = await fetch(`${_API_URL}/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Falha ao carregar dados");
      setMe(json.data);
      // Carrega CUB do estado retornado pelo backend. Se a empresa ainda não
      // tem estado definido (onboarding incompleto), pula — o card de preço
      // base vai mostrar "—" e tudo bem.
      if (json.data?.estado) {
        try {
          const cubRes = await fetch(
            `${_API_URL}/api/cub/atual?estado=${encodeURIComponent(json.data.estado)}&categoria=R-1&padrao=Normal`,
            { headers: { "Authorization": `Bearer ${token}` } }
          );
          const cubJson = await cubRes.json();
          if (cubJson.ok) setCub(cubJson.data);
          // Se CUB falhar, não interrompe — só não mostra o preço base.
          // Outros campos (profissão, padrão, etc.) continuam visíveis.
        } catch { /* silencioso */ }
      }
    } catch (e) {
      setMeErro(e.message);
    } finally {
      setMeLoading(false);
    }
  }

  useEffect(() => { carregarMe(); /* eslint-disable-next-line */ }, []);

  // Permissão pra disparar o reset: master OU admin (backend valida também,
  // mas escondemos o botão dos outros perfis pra não confundir).
  // Usa `usuario` (props) que já está disponível imediatamente — sem esperar
  // o /auth/me — pra decidir se mostra o botão ou o aviso amigável.
  const podeResetar = usuario?.perfil === "master" || usuario?.nivel === "admin";

  // ID da empresa-alvo. Por enquanto o reset só age sobre a própria empresa
  // do usuário (claim empresa_id do JWT). Master que precisar resetar outra
  // empresa continua usando o drill-in do Admin ou o console.
  const empresaId = me?.empresa_id ?? usuario?.empresa_id;

  // Dados de calibragem atuais. Prioriza `me` (fresco do /auth/me); cai pra
  // `usuario` enquanto carrega. Após o fetch, sempre exibe valores atuais.
  const fonte             = me || usuario || {};
  const pctCalibrado      = fonte.pct_calibrado;
  const pctMatriz         = fonte.pct_matriz_calculado;
  // pct_efetivo: o que de fato vale pro pricing. Se calibrou, usa calibrado;
  // se não, usa o calculado pela matriz.
  const pctEfetivo        = pctCalibrado ?? pctMatriz ?? null;
  const profissao         = fonte.profissao;
  const padraoProjetos    = fonte.padrao_projetos;
  const estado            = fonte.estado;

  // Preço base R$/m² = pct_efetivo × CUB R-1 Normal do estado.
  // É o número que entra na fórmula do orçamento (depois multiplicado pelos
  // índices de cômodos e padrão pra chegar no honorário final).
  const cubValor    = cub?.valor_m2 ?? null;
  const precoBaseM2 = (pctEfetivo != null && cubValor != null) ? pctEfetivo * cubValor : null;

  // Labels amigáveis pros valores brutos do banco
  const labelProfissao = { arquiteto: "Arquiteto(a)", engenheiro: "Engenheiro(a)" };
  const labelPadrao    = { simples: "Simples", medio: "Médio", alto: "Alto", luxo: "Luxo" };

  // Helpers de formatação BR (vírgula em vez de ponto)
  const fmtPct  = (v, casas = 2) => v == null ? null : `${(v * 100).toFixed(casas).replace(".", ",")}%`;
  const fmtBRL  = (v) => v == null ? null : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  async function executarReset() {
    if (!empresaId) {
      dialogo.alertar({
        titulo: "Empresa não identificada",
        mensagem: "Não foi possível identificar sua empresa. Faça login novamente.",
        tipo: "erro",
      });
      return;
    }

    const confirmou = await dialogo.confirmar({
      titulo: "Resetar e refazer calibragem?",
      mensagem:
        "Isso vai apagar as respostas do onboarding (profissão, porte, padrão, estado, capital) e o pct_calibrado da empresa. " +
        "Você cairá direto na tela de onboarding pra refazer a calibragem — sem precisar fazer login de novo.\n\n" +
        "Os clientes, projetos, orçamentos e dados do escritório NÃO são afetados — apenas a calibragem de pricing.",
      confirmar: "Resetar calibragem",
      destrutivo: true,
    });
    if (!confirmou) return;

    setExecutando(true);
    try {
      const token = localStorage.getItem("vicke-token");
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");

      const res = await fetch(`${_API_URL}/admin/empresas/${empresaId}/reset-onboarding`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Falha ao resetar onboarding");

      // Sucesso: refetch /auth/me pra trazer estado atualizado (precisa_fazer_onboarding=true,
      // campos zerados). Atualizar setUsuario faz o app.jsx detectar a flag e
      // renderizar <Onboarding /> automaticamente — sem logout, sem reload.
      const meRes = await fetch(`${_API_URL}/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const meJson = await meRes.json();
      if (!meJson.ok) throw new Error(meJson.error || "Falha ao recarregar dados do usuário");

      // Atualiza state global + localStorage. React vai rerenderizar e o
      // app.jsx vai detectar precisa_fazer_onboarding=true automaticamente.
      if (typeof setUsuario === "function") {
        setUsuario(meJson.data);
      }
      try { localStorage.setItem("vicke-user", JSON.stringify(meJson.data)); } catch {}
    } catch (e) {
      dialogo.alertar({
        titulo: "Erro ao resetar calibragem",
        mensagem: e.message,
        tipo: "erro",
      });
    } finally {
      setExecutando(false);
    }
  }

  // ── Estado da aba "Configurar Modelo de Orçamento" ────────────
  // Identidade visual da proposta. Mora em data.escritorio.identXxx (mesmo
  // lugar do banco — sem migração nova). O admin edita aqui e clica
  // "Salvar identidade visual" pra disparar `save()` que persiste tudo.
  const cfgEscr = (data && data.escritorio) || {};
  const perm    = getPermissoes();
  const podeEditarIdent = perm.podeAlterarConfig; // mesma regra do escritorio (admin)

  const [formIdent, setFormIdent] = useState({
    identCorPrim:      cfgEscr.identCorPrim      || "#111827",
    identFonteTit:     cfgEscr.identFonteTit     || "helvetica",
    identFonteCorpo:   cfgEscr.identFonteCorpo   || "helvetica",
    identModeloCapa:   cfgEscr.identModeloCapa   || "minimalista",
    identCapaUrl:      cfgEscr.identCapaUrl      || "",
    identCapaPublicId: cfgEscr.identCapaPublicId || "",
  });
  const [savedIdent, setSavedIdent] = useState(false);

  // Quando o `data` (escritorio) mudar externamente (ex: outra aba salvou),
  // resincroniza formIdent. Evita ficar com state stale após F5 ou save vindo
  // de outra fonte. Comparação simples por JSON pra evitar loop.
  useEffect(() => {
    setFormIdent({
      identCorPrim:      cfgEscr.identCorPrim      || "#111827",
      identFonteTit:     cfgEscr.identFonteTit     || "helvetica",
      identFonteCorpo:   cfgEscr.identFonteCorpo   || "helvetica",
      identModeloCapa:   cfgEscr.identModeloCapa   || "minimalista",
      identCapaUrl:      cfgEscr.identCapaUrl      || "",
      identCapaPublicId: cfgEscr.identCapaPublicId || "",
    });
    /* eslint-disable-next-line */
  }, [JSON.stringify({
    a: cfgEscr.identCorPrim, b: cfgEscr.identFonteTit, c: cfgEscr.identFonteCorpo,
    d: cfgEscr.identModeloCapa, e: cfgEscr.identCapaUrl, f: cfgEscr.identCapaPublicId,
  })]);

  function setFI(key, val) {
    setFormIdent(f => ({ ...f, [key]: val }));
  }

  // Contraste WCAG: dado um hex, devolve "#fff" ou "#111" baseado na
  // luminância relativa. Usado pra escolher cor do texto sobre cor primária
  // no preview (e depois no PDF/PropostaPreview na Fase B.3).
  function contrasteSobre(hex) {
    const m = (hex || "").replace("#","").match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
    if (!m) return "#fff";
    let h = m[1];
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    const r = parseInt(h.slice(0,2), 16) / 255;
    const g = parseInt(h.slice(2,4), 16) / 255;
    const b = parseInt(h.slice(4,6), 16) / 255;
    const sRGB = (c) => c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
    const L = 0.2126*sRGB(r) + 0.7152*sRGB(g) + 0.0722*sRGB(b);
    return L > 0.5 ? "#111" : "#fff";
  }

  // Upload da capa via Cloudinary (POST /api/uploads multipart).
  async function _uploadImagemCapa(arquivo) {
    const token = localStorage.getItem("vicke-token");
    if (!token) throw new Error("Sessão expirada. Faça login novamente.");
    const fd = new FormData();
    fd.append("arquivo", arquivo);
    fd.append("categoria", "capa_escritorio");
    const res = await fetch(`${_API_URL}/api/uploads`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
      body: fd,
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Falha no upload");
    return json.data;
  }

  // Cleanup: remove imagem antiga do Cloudinary quando troca a capa.
  // Best-effort: falha não bloqueia o usuário (capa órfã pode ficar mas
  // job de manutenção limpa no futuro).
  async function _removerImagemCloudinary(public_id) {
    if (!public_id) return;
    const token = localStorage.getItem("vicke-token");
    if (!token) return;
    try {
      await fetch(`${_API_URL}/api/uploads`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ public_id }),
      });
    } catch (e) {
      console.warn("[capa] falha ao remover do Cloudinary:", e.message);
    }
  }

  async function handleUploadCapa(evento) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!arquivo) return;

    const tiposOk = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!tiposOk.includes(arquivo.type)) {
      dialogo.alertar({
        titulo: "Formato não suportado",
        mensagem: "Use PNG, JPG ou WebP. (SVG não é aceito em capas fotográficas.)",
        tipo: "aviso",
      });
      return;
    }
    if (arquivo.size > 2 * 1024 * 1024) {
      dialogo.alertar({
        titulo: "Arquivo grande demais",
        mensagem: `A imagem tem ${(arquivo.size/1024/1024).toFixed(1)}MB. Limite: 2MB. Use uma versão menor ou comprima a imagem.`,
        tipo: "aviso",
      });
      return;
    }

    try {
      // Cleanup: se já tinha uma capa, remove antiga antes de subir nova.
      const publicIdAntigo = formIdent.identCapaPublicId;
      if (publicIdAntigo) {
        await _removerImagemCloudinary(publicIdAntigo);
      }
      const resp = await _uploadImagemCapa(arquivo);
      setFormIdent(f => ({
        ...f,
        identCapaUrl: resp.url,
        identCapaPublicId: resp.public_id,
      }));
    } catch (e) {
      dialogo.alertar({
        titulo: "Falha no upload",
        mensagem: e.message || "Tente novamente em alguns segundos.",
        tipo: "erro",
      });
    }
  }

  async function removerCapa() {
    const publicId = formIdent.identCapaPublicId;
    if (publicId) {
      await _removerImagemCloudinary(publicId);
    }
    setFormIdent(f => ({ ...f, identCapaUrl: "", identCapaPublicId: "" }));
  }

  // Salva a identidade visual na empresa. Faz merge com data.escritorio
  // pra preservar todos os outros campos (nome, telefone, equipe, logo etc.)
  // que são gerenciados em "Escritório → Dados gerais".
  function salvarIdentidade() {
    if (!save) {
      dialogo.alertar({
        titulo: "Erro",
        mensagem: "Função de salvar não disponível. Recarregue a página.",
        tipo: "erro",
      });
      return;
    }
    const escritorioAtual = (data && data.escritorio) || {};
    save({
      ...data,
      escritorio: {
        ...escritorioAtual,
        identCorPrim:      formIdent.identCorPrim,
        identFonteTit:     formIdent.identFonteTit,
        identFonteCorpo:   formIdent.identFonteCorpo,
        identModeloCapa:   formIdent.identModeloCapa,
        identCapaUrl:      formIdent.identCapaUrl,
        identCapaPublicId: formIdent.identCapaPublicId,
      },
    });
    setSavedIdent(true);
    setTimeout(() => setSavedIdent(false), 2000);
  }

  // ── Estilos compartilhados ─────────────────────────────────────
  const S = {
    wrap:     { fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", background:"#fff", minHeight:"100vh", color:"#111", maxWidth:1200, margin:"0 auto" },
    header:   { borderBottom:"1px solid #e5e7eb", padding:"24px 32px" },
    titulo:   { fontSize:18, fontWeight:700, color:"#111", margin:0 },
    sub:      { fontSize:13, color:"#9ca3af", marginTop:3 },
    abas:     { display:"flex", gap:0, borderBottom:"1px solid #e5e7eb", padding:"0 32px" },
    aba: (ativa) => ({ background:"none", border:"none", borderBottom: ativa ? "2px solid #111" : "2px solid transparent", color: ativa ? "#111" : "#9ca3af", padding:"12px 16px", fontSize:13, fontWeight: ativa ? 600 : 400, cursor:"pointer", fontFamily:"inherit", marginBottom:-1 }),
    body:     { padding:"32px", maxWidth:760 },
    secao:    { marginBottom:32 },
    secTitulo:{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:16 },
    label:    { fontSize:11, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.5, marginBottom:4 },
    valor:    { fontSize:14, color:"#111" },
    vazio:    { fontSize:14, color:"#d1d5db", fontStyle:"italic" },
    grid2:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:18 },
    btn:      { background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"10px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
    btnSalvo: { background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"10px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", opacity:0.7 },
    btnDanger:{ background:"#fff", color:"#dc2626", border:"1px solid #fecaca", borderRadius:8, padding:"10px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
    aviso:    { fontSize:13, color:"#6b7280", lineHeight:1.6, background:"#fafbfc", border:"1px solid #f3f4f6", borderRadius:8, padding:"14px 16px", marginBottom:16 },
    avisoSemPerm: { fontSize:13, color:"#92400e", lineHeight:1.6, background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, padding:"14px 16px" },
    boxPrecoBase: { background:"#fafbfc", border:"1px solid #e5e7eb", borderRadius:10, padding:"18px 20px", marginTop:4 },
    boxLabel:     { fontSize:11, color:"#6b7280", textTransform:"uppercase", letterSpacing:0.6, fontWeight:600, marginBottom:6 },
    boxValor:     { fontSize:28, fontWeight:700, color:"#111", lineHeight:1, display:"flex", alignItems:"baseline", gap:6 },
    boxUnidade:   { fontSize:14, fontWeight:500, color:"#9ca3af" },
    boxFormula:   { fontSize:12, color:"#9ca3af", marginTop:8 },
    // Identidade visual
    inputHex: { border:"1px solid #d1d5db", borderRadius:8, padding:"10px 12px", fontSize:13, color:"#111", outline:"none", background:"#fff", fontFamily:"monospace", width:110, boxSizing:"border-box", textTransform:"uppercase" },
    select:   { border:"1px solid #d1d5db", borderRadius:8, padding:"10px 12px", fontSize:13, color:"#111", outline:"none", background:"#fff", fontFamily:"inherit", width:"100%", boxSizing:"border-box", cursor:"pointer" },
    campoLbl: { fontSize:12, color:"#6b7280", fontWeight:500 },
  };

  // Helper de exibição: se o valor for nulo/vazio, mostra "—" cinza itálico
  const Campo = ({ label, valor }) => (
    <div>
      <div style={S.label}>{label}</div>
      {valor != null && valor !== "" ? <div style={S.valor}>{valor}</div> : <div style={S.vazio}>—</div>}
    </div>
  );

  // ── Render: aba "Configurar Preço" ─────────────────────────────
  const renderPreco = () => (
    <div style={S.body}>
      <div style={S.secao}>
        <div style={S.secTitulo}>Calibragem atual</div>

        {meErro && (
          <div style={{ ...S.avisoSemPerm, marginBottom: 12 }}>
            Não foi possível carregar os dados frescos: {meErro}.
            {" "}<a href="#" onClick={(e) => { e.preventDefault(); carregarMe(); }} style={{ color:"#92400e", fontWeight:600 }}>Tentar novamente</a>
          </div>
        )}

        <div style={S.grid2}>
          <Campo label="Profissão"           valor={labelProfissao[profissao] || profissao} />
          <Campo label="Padrão dos projetos" valor={labelPadrao[padraoProjetos] || padraoProjetos} />
          <Campo label="Estado"              valor={estado} />
          <Campo
            label="Percentual aplicado"
            valor={
              pctEfetivo != null
                ? `${fmtPct(pctEfetivo)}${pctCalibrado != null ? " (calibrado)" : " (matriz)"}`
                : null
            }
          />
        </div>

        {/* Box de destaque do preço base R$/m² — número que entra na fórmula
            do orçamento (depois multiplicado pelos índices e tamanho da casa
            pra chegar no honorário final). É o que importa no dia a dia. */}
        <div style={S.boxPrecoBase}>
          <div style={S.boxLabel}>Preço base do m²</div>
          <div style={S.boxValor}>
            {precoBaseM2 != null ? fmtBRL(precoBaseM2) : <span style={S.vazio}>—</span>}
            {precoBaseM2 != null && <span style={S.boxUnidade}>/m²</span>}
          </div>
          {pctEfetivo != null && cubValor != null && (
            <div style={S.boxFormula}>
              {fmtPct(pctEfetivo)} × {fmtBRL(cubValor)} (CUB R-1 Normal {estado})
            </div>
          )}
        </div>

        {meLoading && (
          <div style={{ fontSize:12, color:"#9ca3af", marginTop:12 }}>Atualizando…</div>
        )}
      </div>

      <div style={S.secao}>
        <div style={S.secTitulo}>Refazer calibragem</div>

        {!podeResetar ? (
          <div style={S.avisoSemPerm}>
            Apenas <strong>master</strong> ou <strong>administradores</strong> da empresa podem resetar a calibragem.
            Peça pro responsável da sua empresa fazer o reset.
          </div>
        ) : (
          <>
            <div style={S.aviso}>
              Apaga as respostas do onboarding e os percentuais (<code style={{ background:"#fff", padding:"1px 5px", borderRadius:3, border:"1px solid #e5e7eb", fontSize:12 }}>pct_matriz_calculado</code> e <code style={{ background:"#fff", padding:"1px 5px", borderRadius:3, border:"1px solid #e5e7eb", fontSize:12 }}>pct_calibrado</code>) da empresa.
              Você cai direto na tela de onboarding pra refazer a calibragem — sem precisar fazer login novamente.
              Clientes, projetos e orçamentos <strong>não</strong> são afetados.
            </div>
            <button
              onClick={executarReset}
              disabled={executando}
              style={{
                ...S.btnDanger,
                opacity: executando ? 0.5 : 1,
                cursor: executando ? "not-allowed" : "pointer",
              }}>
              {executando ? "Resetando..." : "Resetar e refazer calibragem"}
            </button>
          </>
        )}
      </div>
    </div>
  );

  // ── Render: aba "Configurar Modelo de Orçamento" ───────────────
  const renderModelo = () => (
    <div style={S.body}>
      <div style={S.secao}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8 }}>
          <div>
            <div style={S.secTitulo}>Identidade Visual da Proposta</div>
            <div style={{ fontSize:12, color:"#9ca3af", marginTop:-8 }}>
              Customização aplicada nas propostas em PDF e na visualização.
            </div>
          </div>
        </div>

        {!podeEditarIdent && (
          <div style={{ ...S.avisoSemPerm, marginBottom:16 }}>
            Somente administradores podem alterar a identidade visual.
          </div>
        )}

        {/* Cor primária + preview de contraste */}
        <div style={{ marginTop:16, marginBottom:24 }}>
          <div style={{ ...S.campoLbl, marginBottom:8 }}>Cor primária</div>
          <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
            <input
              type="color"
              value={formIdent.identCorPrim}
              onChange={(e) => setFI("identCorPrim", e.target.value)}
              disabled={!podeEditarIdent}
              style={{
                width:48, height:36, border:"1px solid #d1d5db", borderRadius:8,
                padding:2, cursor: podeEditarIdent ? "pointer" : "not-allowed",
                background:"#fff",
              }}
            />
            <input
              type="text"
              value={formIdent.identCorPrim}
              onChange={(e) => {
                let v = e.target.value.trim();
                if (v && !v.startsWith("#")) v = "#" + v;
                setFI("identCorPrim", v);
              }}
              disabled={!podeEditarIdent}
              maxLength={7}
              style={S.inputHex}
            />
            <div style={{
              padding:"8px 16px", borderRadius:8,
              background: formIdent.identCorPrim,
              color: contrasteSobre(formIdent.identCorPrim),
              fontSize:12, fontWeight:600, letterSpacing:0.3,
            }}>
              Pré-visualização
            </div>
            {formIdent.identCorPrim !== "#111827" && podeEditarIdent && (
              <button
                onClick={() => setFI("identCorPrim", "#111827")}
                style={{
                  background:"none", border:"none", color:"#6b7280",
                  fontSize:12, cursor:"pointer", textDecoration:"underline",
                  fontFamily:"inherit",
                }}>
                Restaurar padrão
              </button>
            )}
          </div>
          <div style={{ fontSize:11, color:"#9ca3af", marginTop:8, lineHeight:1.4 }}>
            Aplicada em: linha do cabeçalho, caixa de Total Geral, numeração de seções,
            QR de fundo do rodapé. Não afeta toggles, botões ou cores semânticas.
          </div>
        </div>

        {/* Tipografia: títulos + corpo */}
        <div style={{ ...S.grid2, marginBottom:24 }}>
          <div>
            <label style={S.campoLbl}>Fonte dos títulos</label>
            <select
              value={formIdent.identFonteTit}
              onChange={(e) => setFI("identFonteTit", e.target.value)}
              disabled={!podeEditarIdent}
              style={{ ...S.select, marginTop:5 }}>
              <option value="helvetica">Helvetica (sem serifa, padrão)</option>
              <option value="times">Times (serifa, clássica)</option>
              <option value="courier">Courier (monoespaçada, técnica)</option>
            </select>
          </div>
          <div>
            <label style={S.campoLbl}>Fonte do corpo</label>
            <select
              value={formIdent.identFonteCorpo}
              onChange={(e) => setFI("identFonteCorpo", e.target.value)}
              disabled={!podeEditarIdent}
              style={{ ...S.select, marginTop:5 }}>
              <option value="helvetica">Helvetica (sem serifa, padrão)</option>
              <option value="times">Times (serifa, clássica)</option>
              <option value="courier">Courier (monoespaçada, técnica)</option>
            </select>
          </div>
        </div>

        {/* Modelo de capa: 3 opções como cards radio */}
        <div style={{ marginBottom:16 }}>
          <div style={{ ...S.campoLbl, marginBottom:10 }}>Modelo de capa</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:10 }}>
            {[
              { id:"minimalista", titulo:"Minimalista", desc:"Layout atual, fundo branco com logo no topo" },
              { id:"cor_solida",  titulo:"Cor sólida",  desc:"Bloco superior na cor primária" },
              { id:"fotografica", titulo:"Fotográfica", desc:"Imagem de fundo + overlay escuro" },
            ].map(opt => {
              const ativo = formIdent.identModeloCapa === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => podeEditarIdent && setFI("identModeloCapa", opt.id)}
                  disabled={!podeEditarIdent}
                  style={{
                    textAlign:"left", padding:"12px 14px",
                    border: ativo ? "2px solid #111" : "1px solid #e5e7eb",
                    background: ativo ? "#fafbfc" : "#fff",
                    borderRadius:8,
                    cursor: podeEditarIdent ? "pointer" : "not-allowed",
                    fontFamily:"inherit",
                    opacity: podeEditarIdent ? 1 : 0.6,
                    transition:"all 0.15s",
                  }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#111", marginBottom:4 }}>
                    {opt.titulo}
                  </div>
                  <div style={{ fontSize:11, color:"#6b7280", lineHeight:1.4 }}>
                    {opt.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Upload de imagem da capa — só visível se modeloCapa = fotografica */}
        {formIdent.identModeloCapa === "fotografica" && (
          <div style={{
            marginTop:8, padding:"16px", background:"#fafbfc",
            border:"1px solid #e5e7eb", borderRadius:8,
          }}>
            <div style={{ fontSize:12, color:"#6b7280", marginBottom:12, lineHeight:1.5 }}>
              Imagem que aparece como fundo na primeira página da proposta.
              Recomendado: 1920×1080 ou maior · PNG, JPG ou WebP · Máximo 2MB.
            </div>
            <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
              {/* Preview */}
              <div style={{
                width:200, height:120,
                border: formIdent.identCapaUrl ? "1px solid #e5e7eb" : "1.5px dashed #d1d5db",
                borderRadius:8,
                background: formIdent.identCapaUrl ? `url(${formIdent.identCapaUrl}) center/cover` : "#fff",
                display:"flex", alignItems:"center", justifyContent:"center",
                flexShrink:0,
              }}>
                {!formIdent.identCapaUrl && (
                  <span style={{ fontSize:11, color:"#9ca3af" }}>Sem imagem</span>
                )}
              </div>
              {/* Ações */}
              <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <label style={{
                    ...S.btn,
                    cursor: podeEditarIdent ? "pointer" : "not-allowed",
                    opacity: podeEditarIdent ? 1 : 0.5,
                    display:"inline-flex", alignItems:"center",
                    fontSize:12.5, fontWeight:600, padding:"7px 14px",
                  }}>
                    {formIdent.identCapaUrl ? "Trocar imagem" : "Enviar imagem"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      style={{ display:"none" }}
                      onChange={handleUploadCapa}
                      disabled={!podeEditarIdent}
                    />
                  </label>
                  {formIdent.identCapaUrl && podeEditarIdent && (
                    <button
                      onClick={removerCapa}
                      style={{
                        background:"#fff", color:"#dc2626", border:"1px solid #fecaca",
                        borderRadius:7, padding:"7px 14px", fontSize:12.5, fontWeight:600,
                        cursor:"pointer", fontFamily:"inherit",
                      }}>
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Botão Salvar — só pra quem pode editar */}
        {podeEditarIdent && (
          <div style={{ marginTop:24, display:"flex", justifyContent:"flex-end" }}>
            <button
              onClick={salvarIdentidade}
              style={savedIdent ? S.btnSalvo : S.btn}>
              {savedIdent ? "Salvo!" : "Salvar identidade visual"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // ── Render principal ───────────────────────────────────────────
  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.titulo}>Orçamento</div>
        <div style={S.sub}>Configurações de pricing e modelo da proposta</div>
      </div>

      {/* Sub-abas: Configurar Preço / Configurar Modelo */}
      <div style={S.abas}>
        <button style={S.aba(subAba === "preco")} onClick={() => setSubAba("preco")}>
          Configurar Preço
        </button>
        <button style={S.aba(subAba === "modelo")} onClick={() => setSubAba("modelo")}>
          Configurar Modelo de Orçamento
        </button>
      </div>

      {/* Conteúdo da aba ativa */}
      {subAba === "preco"  && renderPreco()}
      {subAba === "modelo" && renderModelo()}
    </div>
  );
}
