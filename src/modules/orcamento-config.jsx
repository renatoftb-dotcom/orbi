// ═══════════════════════════════════════════════════════════════
// ORÇAMENTO — Configurações de pricing
// ═══════════════════════════════════════════════════════════════
// Aba "Orçamento" da seção Configuração na sidebar. Por enquanto contém
// apenas o botão de "Resetar e refazer calibragem" — dispara o endpoint
// POST /admin/empresas/:id/reset-onboarding e força logout pra que o
// próximo login caia no fluxo de onboarding limpo.
//
// Permissões:
// - master e admin podem executar (backend já valida).
// - Outros perfis (editor/visualizador) veem mensagem explicando que
//   precisam de admin/master.

function OrcamentoConfig({ usuario, data }) {
  const [executando, setExecutando] = useState(false);

  // URL base da API. Mesma lógica que escritorio.jsx e shared.jsx —
  // env var Vite com fallback pro Railway prod ativo.
  const _API_URL = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL)
    || "https://orbi-production-5f5c.up.railway.app";

  // Permissão pra disparar o reset: master OU admin (backend valida também,
  // mas escondemos o botão dos outros perfis pra não confundir).
  const podeResetar = usuario?.perfil === "master" || usuario?.nivel === "admin";

  // ID da empresa-alvo. Por enquanto o reset só age sobre a própria empresa
  // do usuário (claim empresa_id do JWT). Master que precisar resetar outra
  // empresa continua usando o drill-in do Admin ou o console.
  const empresaId = usuario?.empresa_id;

  // Dados de calibragem atuais (vindo do data.escritorio ou direto do JWT).
  // Mostra de forma compacta pra usuário ter contexto antes de apertar reset.
  const cfg = data?.escritorio || {};
  const pctCalibrado     = cfg.pct_calibrado ?? usuario?.pct_calibrado ?? null;
  const profissao        = cfg.profissao    ?? usuario?.profissao    ?? null;
  const padraoProjetos   = cfg.padrao_projetos ?? usuario?.padrao_projetos ?? null;
  const estado           = cfg.estado       ?? usuario?.estado       ?? null;

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
        "Você será deslogado e, no próximo login, cairá na tela de onboarding pra refazer a calibragem do zero.\n\n" +
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

      // Sucesso: tira o usuário da sessão pra forçar onboarding limpo no
      // próximo login. Mensagem rápida antes de redirecionar pra login.
      await dialogo.alertar({
        titulo: "Calibragem resetada",
        mensagem: "Faça login novamente pra refazer o onboarding.",
        tipo: "sucesso",
      });
      localStorage.removeItem("vicke-token");
      localStorage.removeItem("vicke-user");
      window.location.reload();
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

  // Estilos — mesma paleta minimalista do escritorio.jsx pra manter
  // consistência visual entre as abas de Configuração.
  const S = {
    wrap:     { fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", background:"#fff", minHeight:"100vh", color:"#111", maxWidth:1200, margin:"0 auto" },
    header:   { borderBottom:"1px solid #e5e7eb", padding:"24px 32px" },
    titulo:   { fontSize:18, fontWeight:700, color:"#111", margin:0 },
    sub:      { fontSize:13, color:"#9ca3af", marginTop:3 },
    body:     { padding:"32px", maxWidth:760 },
    secao:    { marginBottom:32 },
    secTitulo:{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:16 },
    label:    { fontSize:11, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.5, marginBottom:4 },
    valor:    { fontSize:14, color:"#111" },
    vazio:    { fontSize:14, color:"#d1d5db", fontStyle:"italic" },
    grid2:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 },
    btn:      { background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"10px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
    btnDanger:{ background:"#fff", color:"#dc2626", border:"1px solid #fecaca", borderRadius:8, padding:"10px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
    aviso:    { fontSize:13, color:"#6b7280", lineHeight:1.6, background:"#fafbfc", border:"1px solid #f3f4f6", borderRadius:8, padding:"14px 16px", marginBottom:16 },
    avisoSemPerm: { fontSize:13, color:"#92400e", lineHeight:1.6, background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, padding:"14px 16px" },
  };

  // Helper de exibição: se o valor for nulo/vazio, mostra "—" cinza itálico
  const Campo = ({ label, valor }) => (
    <div>
      <div style={S.label}>{label}</div>
      {valor != null && valor !== "" ? <div style={S.valor}>{valor}</div> : <div style={S.vazio}>—</div>}
    </div>
  );

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.titulo}>Orçamento</div>
        <div style={S.sub}>Configurações de pricing e calibragem</div>
      </div>

      {/* Conteúdo */}
      <div style={S.body}>
        <div style={S.secao}>
          <div style={S.secTitulo}>Calibragem atual</div>
          <div style={S.grid2}>
            <Campo label="Profissão"        valor={profissao} />
            <Campo label="Padrão dos projetos" valor={padraoProjetos} />
            <Campo label="Estado"           valor={estado} />
            <Campo label="Pct calibrado"    valor={pctCalibrado != null ? `${(pctCalibrado * 100).toFixed(3)}%` : null} />
          </div>
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
                Apaga as respostas do onboarding e o <code style={{ background:"#fff", padding:"1px 5px", borderRadius:3, border:"1px solid #e5e7eb", fontSize:12 }}>pct_calibrado</code> da empresa.
                Você será deslogado e, no próximo login, refará o onboarding do zero.
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
    </div>
  );
}
