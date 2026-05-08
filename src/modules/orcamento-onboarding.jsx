// ════════════════════════════════════════════════════════════════
// orcamento-onboarding.jsx — Novo fluxo guiado de criação de orçamento
// ════════════════════════════════════════════════════════════════
// Versão Beta acessada via botão "Novo (Beta)" na lista de orçamentos.
// Visível apenas em empresas com dev_mode=true (ex: Vicke Dev). Padovan
// e demais empresas continuam vendo só o fluxo atual.
//
// Filosofia: uma pergunta por tela, fluxo enxuto, sem opções avançadas.
// Quando o user finaliza, gera um orçamento salvo no banco igual ao
// fluxo principal — só a captura é diferente.
//
// Estado das telas usa um índice simples (`telaIdx`). Cada tela tem
// helpers próprios e atualiza o `respostas` ao avançar.

function OrcamentoOnboarding({ data, save, onVoltar, onConcluido }) {
  const [telaIdx, setTelaIdx] = useState(0);
  const [respostas, setRespostas] = useState({
    clienteId: null,
    tipoObra: null,        // "residencial" | "comercial" | "reforma"
    areaM2: null,
    valorTotal: null,
  });

  function atualizar(campo, valor) {
    setRespostas(prev => ({ ...prev, [campo]: valor }));
  }
  function avancar()  { setTelaIdx(i => i + 1); }
  function voltar()   { setTelaIdx(i => Math.max(0, i - 1)); }

  // Quando finalizado, monta payload mínimo e salva. O orçamento abre
  // depois no form atual pra completar detalhes (área final, etapas,
  // forma de pagamento, etc.) — onboarding cobre só a captura inicial.
  async function finalizar() {
    const cliente = (data.clientes || []).find(c => c.id === respostas.clienteId);
    if (!cliente) {
      alert("Cliente não encontrado. Volta uma tela e seleciona de novo.");
      return;
    }
    const orcId = "orc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    const orcNovo = {
      id: orcId,
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      status: "rascunho",
      origemBeta: true,                   // marca pra debug — orçamento veio do onboarding
      tipoProjeto: respostas.tipoObra === "comercial" ? "Comercial" : "Residencial",
      tipoObra: respostas.tipoObra === "reforma" ? "Reforma" : "Construção",
      area: respostas.areaM2 || 0,
      valorTotal: respostas.valorTotal || 0,
      // demais campos ficam undefined; o form atual preenche defaults ao abrir
    };
    const novos = [...(data.orcamentosProjeto || []), orcNovo];
    try {
      await save({ ...data, orcamentosProjeto: novos });
      onConcluido && onConcluido(orcNovo);
    } catch (e) {
      alert("Erro ao salvar: " + (e?.message || "tente novamente"));
    }
  }

  // Estilos compartilhados
  const wrap = {
    background: "#fff", minHeight: "100vh",
    padding: "60px 24px",
    fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif",
    display: "flex", justifyContent: "center",
  };
  const card = {
    maxWidth: 560, width: "100%",
    display: "flex", flexDirection: "column", gap: 24,
  };
  const titulo = { fontSize: 24, fontWeight: 600, color: "#111", letterSpacing: -0.4, margin: 0 };
  const subtitulo = { fontSize: 14, color: "#6b7280", lineHeight: 1.6 };
  const opcao = (sel) => ({
    border: sel ? "1.5px solid #111" : "1px solid #e5e7eb",
    background: sel ? "#fafbfc" : "#fff",
    borderRadius: 10, padding: "16px 18px",
    cursor: "pointer", transition: "all 0.12s",
    display: "flex", alignItems: "center", gap: 12,
  });
  const radio = (sel) => ({
    width: 18, height: 18, borderRadius: "50%",
    border: "1.5px solid " + (sel ? "#111" : "#d1d5db"),
    background: sel ? "#111" : "#fff",
    flexShrink: 0,
  });
  const btnPrimary = (disabled) => ({
    background: "#111", color: "#fff",
    border: "1px solid #111", borderRadius: 8,
    padding: "10px 18px", fontSize: 14, fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit", opacity: disabled ? 0.4 : 1,
  });
  const btnGhost = {
    background: "transparent", color: "#6b7280",
    border: "1px solid #e5e7eb", borderRadius: 8,
    padding: "10px 18px", fontSize: 13, fontWeight: 500,
    cursor: "pointer", fontFamily: "inherit",
  };
  const inputStyle = {
    width: "100%", padding: "10px 12px",
    border: "1px solid #d1d5db", borderRadius: 8,
    fontSize: 14, fontFamily: "inherit", outline: "none",
    boxSizing: "border-box",
  };

  // ── Telas ────────────────────────────────────────────────────
  const TOTAL_TELAS = 5; // welcome + 4 perguntas

  function TelaWelcome() {
    return (
      <>
        <h1 style={titulo}>Vamos criar seu primeiro orçamento</h1>
        <p style={subtitulo}>
          Em 4 passos rápidos, você cria um orçamento. Depois você refina os detalhes
          (etapas, forma de pagamento, escopo) no formulário completo.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button style={btnGhost} onClick={onVoltar}>Cancelar</button>
          <button style={btnPrimary(false)} onClick={avancar}>Começar →</button>
        </div>
      </>
    );
  }

  function TelaCliente() {
    const clientes = data.clientes || [];
    const podeAvancar = !!respostas.clienteId;
    return (
      <>
        <h1 style={titulo}>Para qual cliente?</h1>
        <p style={subtitulo}>Selecione um cliente já cadastrado.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto" }}>
          {clientes.length === 0 && (
            <div style={{ ...subtitulo, fontStyle: "italic" }}>
              Nenhum cliente cadastrado. Cadastra primeiro na aba Clientes e volta.
            </div>
          )}
          {clientes.map(c => {
            const sel = respostas.clienteId === c.id;
            return (
              <div key={c.id} style={opcao(sel)} onClick={() => atualizar("clienteId", c.id)}>
                <span style={radio(sel)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>{c.nome}</div>
                  {c.tipo && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{c.tipo}</div>}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button style={btnGhost} onClick={voltar}>← Voltar</button>
          <button style={btnPrimary(!podeAvancar)} disabled={!podeAvancar} onClick={avancar}>Continuar →</button>
        </div>
      </>
    );
  }

  function TelaTipoObra() {
    const opcoes = [
      { id: "residencial", label: "Residencial",         desc: "Casa, apartamento, sobrado" },
      { id: "comercial",   label: "Comercial",           desc: "Loja, escritório, galpão" },
      { id: "reforma",     label: "Reforma / Adequação", desc: "Imóvel existente sendo modificado" },
    ];
    const podeAvancar = !!respostas.tipoObra;
    return (
      <>
        <h1 style={titulo}>Que tipo de obra?</h1>
        <p style={subtitulo}>Isso ajuda a calcular valores e selecionar o template adequado.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {opcoes.map(o => {
            const sel = respostas.tipoObra === o.id;
            return (
              <div key={o.id} style={opcao(sel)} onClick={() => atualizar("tipoObra", o.id)}>
                <span style={radio(sel)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>{o.label}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{o.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button style={btnGhost} onClick={voltar}>← Voltar</button>
          <button style={btnPrimary(!podeAvancar)} disabled={!podeAvancar} onClick={avancar}>Continuar →</button>
        </div>
      </>
    );
  }

  function TelaArea() {
    const podeAvancar = respostas.areaM2 > 0;
    return (
      <>
        <h1 style={titulo}>Qual a área aproximada?</h1>
        <p style={subtitulo}>Pode ser estimado — você pode ajustar depois no orçamento detalhado.</p>
        <div style={{ position: "relative" }}>
          <input type="number" min={0} step={1}
            value={respostas.areaM2 || ""}
            onChange={e => atualizar("areaM2", parseInt(e.target.value) || 0)}
            placeholder="0"
            autoFocus
            style={{ ...inputStyle, fontSize: 28, padding: "16px 60px 16px 16px", textAlign: "right" }}
          />
          <span style={{
            position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
            color: "#9ca3af", fontSize: 16, pointerEvents: "none",
          }}>m²</span>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button style={btnGhost} onClick={voltar}>← Voltar</button>
          <button style={btnPrimary(!podeAvancar)} disabled={!podeAvancar} onClick={avancar}>Continuar →</button>
        </div>
      </>
    );
  }

  function TelaValor() {
    const podeAvancar = respostas.valorTotal > 0;
    const fmtBRL = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return (
      <>
        <h1 style={titulo}>Qual o valor do projeto?</h1>
        <p style={subtitulo}>
          Valor total que você quer cobrar. O orçamento detalhado calcula automaticamente parcelas e descontos.
        </p>
        <div style={{ position: "relative" }}>
          <span style={{
            position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
            color: "#9ca3af", fontSize: 16, pointerEvents: "none",
          }}>R$</span>
          <input type="number" min={0} step={100}
            value={respostas.valorTotal || ""}
            onChange={e => atualizar("valorTotal", parseFloat(e.target.value) || 0)}
            placeholder="0"
            autoFocus
            style={{ ...inputStyle, fontSize: 28, padding: "16px 16px 16px 56px", textAlign: "right" }}
          />
        </div>
        {respostas.areaM2 > 0 && respostas.valorTotal > 0 && (
          <div style={{ ...subtitulo, padding: "10px 14px", background: "#f9fafb", borderRadius: 8 }}>
            ≈ {fmtBRL(respostas.valorTotal / respostas.areaM2)}/m²
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button style={btnGhost} onClick={voltar}>← Voltar</button>
          <button style={btnPrimary(!podeAvancar)} disabled={!podeAvancar} onClick={finalizar}>
            Criar orçamento ✓
          </button>
        </div>
      </>
    );
  }

  // ── Render ───────────────────────────────────────────────────
  let tela;
  if      (telaIdx === 0) tela = <TelaWelcome />;
  else if (telaIdx === 1) tela = <TelaCliente />;
  else if (telaIdx === 2) tela = <TelaTipoObra />;
  else if (telaIdx === 3) tela = <TelaArea />;
  else if (telaIdx === 4) tela = <TelaValor />;

  return (
    <div style={wrap}>
      <div style={card}>
        {/* Indicador de progresso */}
        {telaIdx > 0 && (
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {Array.from({ length: TOTAL_TELAS - 1 }, (_, i) => (
              <div key={i} style={{
                flex: 1, height: 3, borderRadius: 2,
                background: i < telaIdx ? "#111" : "#e5e7eb",
                transition: "background 0.2s",
              }} />
            ))}
          </div>
        )}
        {tela}
      </div>
    </div>
  );
}
