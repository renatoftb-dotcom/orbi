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
    grid2:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:18 },
    btn:      { background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"10px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
    btnDanger:{ background:"#fff", color:"#dc2626", border:"1px solid #fecaca", borderRadius:8, padding:"10px 20px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
    aviso:    { fontSize:13, color:"#6b7280", lineHeight:1.6, background:"#fafbfc", border:"1px solid #f3f4f6", borderRadius:8, padding:"14px 16px", marginBottom:16 },
    avisoSemPerm: { fontSize:13, color:"#92400e", lineHeight:1.6, background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, padding:"14px 16px" },
    // Box de destaque do preço base R$/m². Visualmente diferente das células
    // do grid pra dar peso ao número que importa no dia a dia.
    boxPrecoBase: { background:"#fafbfc", border:"1px solid #e5e7eb", borderRadius:10, padding:"18px 20px", marginTop:4 },
    boxLabel:     { fontSize:11, color:"#6b7280", textTransform:"uppercase", letterSpacing:0.6, fontWeight:600, marginBottom:6 },
    boxValor:     { fontSize:28, fontWeight:700, color:"#111", lineHeight:1, display:"flex", alignItems:"baseline", gap:6 },
    boxUnidade:   { fontSize:14, fontWeight:500, color:"#9ca3af" },
    boxFormula:   { fontSize:12, color:"#9ca3af", marginTop:8 },
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
