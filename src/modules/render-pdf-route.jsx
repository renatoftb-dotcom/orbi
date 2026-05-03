// ═══════════════════════════════════════════════════════════════
// ROTA /render-pdf/:uuid — SPA MÍNIMA pra Puppeteer capturar PDF
//
// Esta rota é acessada por:
//   - URL: https://vicke.com.br/render-pdf/{uuid}?token={jwt}
//   - Quem acessa: Chrome headless do Puppeteer (rodando no backend)
//
// Fluxo:
//   1. main.jsx detecta path /render-pdf/* e renderiza <RenderPdfRoute/>
//      em vez do App normal
//   2. RenderPdfRoute extrai uuid e token da URL
//   3. Faz GET /api/proposta/render-data?token=xxx
//   4. Backend valida token, busca payload no cache, retorna
//      { snapshot, orcamento, escritorio, templateId, clienteNome }
//   5. RenderPdfRoute renderiza <PropostaPreview/> com os dados
//      e lockEdicao=true (sem botões de edição/salvar)
//   6. Quando carregar 100%, monta <div data-render-ready="true"/>
//   7. Puppeteer detecta esse selector via waitForSelector e captura PDF
//
// Limitações intencionais:
//   - Sem sidebar, header, login — só conteúdo da proposta
//   - lockEdicao=true: bloqueia inputs, esconde botões
//   - Sem chamadas extras ao backend (já recebeu tudo no payload)
//   - Sem useEffect de auto-save, ping, etc.
//
// Por que renderizar via React (não server-side)?
//   - PropostaPreview é complexa (1500+ linhas) com estados internos
//     calculados (descontos, etapas, escopo). Reescrever em backend
//     seria duplicação maciça.
//   - Puppeteer + React vê EXATAMENTE o que o usuário vê na tela.
//     Espelho perfeito é o objetivo.
// ═══════════════════════════════════════════════════════════════

function RenderPdfRoute() {
  const [estado, setEstado] = useState("loading"); // loading | ok | erro
  const [erro, setErro] = useState(null);
  const [dados, setDados] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        // Extrai token da query string
        const sp = new URLSearchParams(window.location.search);
        const token = sp.get("token");
        if (!token) {
          setEstado("erro");
          setErro("Token ausente na URL");
          return;
        }

        // URL base da API (mesmo padrão usado em app.jsx, escritorio.jsx, etc).
        const _API_URL = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL)
          || "https://orbi-production-5f5c.up.railway.app";
        const resp = await fetch(`${_API_URL}/api/proposta/render-data?token=${encodeURIComponent(token)}`);
        if (!resp.ok) {
          setEstado("erro");
          setErro(`Falha ao buscar dados: ${resp.status} ${resp.statusText}`);
          return;
        }
        const json = await resp.json();
        if (!json.ok) {
          setEstado("erro");
          setErro(json.error || "Erro desconhecido");
          return;
        }
        setDados(json.data);
        setEstado("ok");
      } catch (e) {
        setEstado("erro");
        setErro(e.message || String(e));
      }
    })();
  }, []);

  // Quando os dados carregarem e PropostaPreview pintar, sinaliza
  // pra Puppeteer com data-render-ready="true". Atrasa um pouco
  // (300ms) pra garantir que toda renderização concluiu — fonts,
  // imagens, etc.
  useEffect(() => {
    if (estado !== "ok") return;
    const t = setTimeout(() => {
      const marker = document.createElement("div");
      marker.setAttribute("data-render-ready", "true");
      marker.style.position = "absolute";
      marker.style.top = "0";
      marker.style.left = "0";
      marker.style.width = "1px";
      marker.style.height = "1px";
      marker.style.opacity = "0";
      marker.style.pointerEvents = "none";
      document.body.appendChild(marker);
    }, 500);
    return () => clearTimeout(t);
  }, [estado]);

  if (estado === "loading") {
    return (
      <div style={{ padding: 40, fontFamily: "sans-serif", color: "#6b7280", fontSize: 14 }}>
        Carregando proposta...
      </div>
    );
  }

  if (estado === "erro") {
    return (
      <div style={{ padding: 40, fontFamily: "sans-serif", color: "#b91c1c", fontSize: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Erro ao gerar PDF</div>
        <div>{erro}</div>
      </div>
    );
  }

  // Monta o `data` esperado pela PropostaPreview a partir do payload do backend
  const { snapshot, orcamento, escritorio, templateId, clienteNome } = dados || {};

  // Os parâmetros de PropostaPreview seguem o contrato do componente
  // já existente em orcamento-teste.jsx. Veja função `function PropostaPreview(props)`.
  const propostaProps = {
    data: {
      ...(orcamento || {}),
      escritorio: escritorio || {},
      clienteNome: clienteNome || (orcamento && orcamento.clienteNome) || "",
      templateId: templateId,
    },
    propostaSnapshot: snapshot,
    lockEdicao: true,         // CRÍTICO: bloqueia edição (visual de "proposta enviada")
    propostaReadOnly: { versao: snapshot?.versao || "v1" },
    onVoltar: () => {},        // no-op (não tem onde voltar)
    onSalvarProposta: null,    // sem ação de salvar
  };

  // PropostaPreview é um componente global (concatenado pelo combine.js).
  // Acessamos via window pra evitar problemas de escopo.
  const Preview = (typeof window !== "undefined" && window.PropostaPreview)
    ? window.PropostaPreview
    : (typeof PropostaPreview !== "undefined" ? PropostaPreview : null);

  if (!Preview) {
    return (
      <div style={{ padding: 40, fontFamily: "sans-serif", color: "#b91c1c", fontSize: 14 }}>
        Erro: componente PropostaPreview não encontrado no bundle.
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <Preview {...propostaProps} />
    </div>
  );
}

// Expõe globalmente pra main.jsx poder usar via window.RenderPdfRoute
if (typeof window !== "undefined") {
  window.RenderPdfRoute = RenderPdfRoute;
}
