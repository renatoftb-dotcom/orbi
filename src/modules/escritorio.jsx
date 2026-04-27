// ═══════════════════════════════════════════════════════════════
// ESCRITÓRIO — Módulo reformulado
// Visual minimalista, fundo branco, estilo Claude.ai
// ═══════════════════════════════════════════════════════════════

function Escritorio({ data, save }) {
  const cfg = (data && data.escritorio) || {};
  const [aba, setAba] = useState("dados");
  const perm = getPermissoes();
  const [form, setForm] = useState({
    nome:        cfg.nome        || "",
    cnpj:        cfg.cnpj        || "",
    email:       cfg.email       || "",
    telefone:    cfg.telefone    || "",
    cep:         cfg.cep         || "",
    endereco:    cfg.endereco    || "",
    cidade:      cfg.cidade      || "",
    estado:      cfg.estado      || "SP",
    site:        cfg.site        || "",
    instagram:   cfg.instagram   || "",
    banco:       cfg.banco       || "",
    agencia:     cfg.agencia     || "",
    conta:       cfg.conta       || "",
    tipoConta:   cfg.tipoConta   || "Corrente",
    pixTipo:     cfg.pixTipo     || "CNPJ",
    pixChave:    cfg.pixChave    || "",
    logo:        cfg.logo        || null,  // base64 data URL (ex: "data:image/png;base64,...")
  });
  const [responsaveis, setResponsaveis] = useState(
    cfg.responsaveis?.length ? cfg.responsaveis
    : cfg.responsavel ? [{ id:"r1", nome:cfg.responsavel, cau:cfg.cau||"", cpf:cfg.cpfResponsavel||"" }]
    : []
  );
  const [equipe, setEquipe] = useState(cfg.equipe || []);
  const [saved, setSaved] = useState(false);
  const [novoMembro, setNovoMembro] = useState(null);
  // Modo de edição da aba "Dados gerais": false = visualização (texto + botão Editar),
  // true = edição (inputs + Salvar/Cancelar). Padrão moderno SaaS (GitHub Settings,
  // Stripe Dashboard) — usuário entende que precisa apertar "Editar" pra alterar.
  // Ao Salvar volta automático pra visualização. Cancelar restaura valores originais.
  const [editandoDados, setEditandoDados] = useState(false);
  // Snapshot dos valores originais ao entrar em edição. Permite Cancelar restaurar.
  const formOriginalRef = useRef(null);
  const responsaveisOriginalRef = useRef(null);
  // Estado do CEP (item 6) — controla loading da consulta ao ViaCEP
  const [cepLoading, setCepLoading] = useState(false);

  // ── Estado da aba Usuários ──────────────────────────────────
  const [usuarios, setUsuarios] = useState([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [erroUsuarios, setErroUsuarios] = useState(null);
  const [novoUsuario, setNovoUsuario] = useState(null); // objeto quando modal aberto
  const [confirmSenha, setConfirmSenha] = useState("");
  const [salvandoUsuario, setSalvandoUsuario] = useState(false);
  const [confirmarExcluir, setConfirmarExcluir] = useState(null); // { id, nome } quando modal aberto
  // Reset de senha: estágio 1 (confirmar) + estágio 2 (exibir senha gerada)
  const [usuarioParaResetar, setUsuarioParaResetar] = useState(null);
  const [senhaGerada, setSenhaGerada]               = useState(null);
  // JWT (fonte: localStorage), pra identificar o usuário logado e não desativar/excluir a si mesmo
  const tokenAtual = (typeof localStorage !== "undefined") ? localStorage.getItem("vicke-token") : null;
  const usuarioLogadoId = (() => {
    if (!tokenAtual) return null;
    try {
      // JWT usa base64url; precisa converter pra base64 padrão antes do atob
      const part = tokenAtual.split(".")[1];
      const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
      const padded = b64 + "=".repeat((4 - b64.length % 4) % 4);
      const payload = JSON.parse(atob(padded));
      return payload?.id || null;
    } catch { return null; }
  })();

  const emptyUsuario = {
    id: "",
    nome: "",
    email: "",
    senha: "",
    nivel: "visualizador",
    membro_id: "",
    ativo: true,
  };

  // ── Helpers da aba Usuários ─────────────────────────────────
  // URL base da API. Usa env var (Vercel injeta VITE_API_URL) com fallback
  // pro Railway prod ativo — mesma lógica de shared.jsx e api.js.
  const _API_URL = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL)
    || "https://orbi-production-5f5c.up.railway.app";
  const API_USUARIOS = `${_API_URL}/empresa/usuarios`;

  // Chama a API de usuários. Retorna { ok, data, error } já parseado.
  // Garante que o token existe antes de chamar (caso contrário lança "Sessão expirada").
  async function fetchUsuariosAPI(url, method = "GET", body = null) {
    const token = localStorage.getItem("vicke-token");
    if (!token) throw new Error("Sessão expirada. Faça login novamente.");
    const opts = {
      method,
      headers: { "Authorization": `Bearer ${token}` },
    };
    if (body) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Erro na requisição");
    return json;
  }

  // Carrega usuários com loading (pra usar no mount inicial e no "Tentar novamente")
  async function carregarUsuarios() {
    setLoadingUsuarios(true);
    setErroUsuarios(null);
    try {
      const json = await fetchUsuariosAPI(API_USUARIOS);
      setUsuarios(json.data || []);
    } catch (e) {
      setErroUsuarios(e.message);
    } finally {
      setLoadingUsuarios(false);
    }
  }

  async function salvarUsuario() {
    if (!novoUsuario) return;
    // Validação
    if (!novoUsuario.nome?.trim()) { dialogo.alertar({ titulo: "Informe o nome", tipo: "aviso" }); return; }
    if (!novoUsuario.email?.trim()) { dialogo.alertar({ titulo: "Informe o e-mail", tipo: "aviso" }); return; }
    const editando = !!novoUsuario._editando;
    const senhaPreenchida = !!novoUsuario.senha;
    // Ao criar: senha obrigatória. Ao editar: senha opcional (se preencher, valida).
    if (!editando || senhaPreenchida) {
      if (!novoUsuario.senha || novoUsuario.senha.length < 6) {
        dialogo.alertar({
          titulo: "Senha muito curta",
          mensagem: editando ? "A nova senha deve ter no mínimo 6 caracteres." : "A senha deve ter no mínimo 6 caracteres.",
          tipo: "aviso",
        });
        return;
      }
      if (novoUsuario.senha !== confirmSenha) {
        dialogo.alertar({ titulo: "As senhas não conferem", tipo: "aviso" });
        return;
      }
    }

    setSalvandoUsuario(true);
    try {
      const body = {
        nome: novoUsuario.nome.trim(),
        email: novoUsuario.email.trim().toLowerCase(),
        nivel: novoUsuario.nivel || "visualizador",
        membro_id: novoUsuario.membro_id || null,
        ativo: novoUsuario.ativo !== false,
      };
      if (senhaPreenchida) body.senha = novoUsuario.senha;

      const url = editando ? `${API_USUARIOS}/${novoUsuario.id}` : API_USUARIOS;
      const json = await fetchUsuariosAPI(url, editando ? "PUT" : "POST", body);

      setNovoUsuario(null);
      setConfirmSenha("");

      // Optimistic update: insere/atualiza o usuário retornado pelo backend na lista
      // local, sem refetchar a lista inteira (evita o "piscar").
      if (json.data) {
        setUsuarios(prev => {
          const idx = prev.findIndex(x => x.id === json.data.id);
          if (idx >= 0) {
            const novo = [...prev];
            novo[idx] = json.data;
            return novo;
          }
          return [...prev, json.data];
        });
      } else {
        // Fallback: backend não devolveu o objeto — recarrega silenciosamente
        try {
          const r = await fetchUsuariosAPI(API_USUARIOS);
          setUsuarios(r.data || []);
        } catch {}
      }
    } catch (e) {
      dialogo.alertar({ titulo: "Erro ao salvar usuário", mensagem: e.message, tipo: "erro" });
    } finally {
      setSalvandoUsuario(false);
    }
  }

  // Abre o modal de confirmação de exclusão
  function pedirConfirmacaoExcluir(u) {
    if (u.id === usuarioLogadoId) {
      dialogo.alertar({ titulo: "Ação não permitida", mensagem: "Você não pode excluir a si mesmo.", tipo: "aviso" });
      return;
    }
    if (!localStorage.getItem("vicke-token")) {
      dialogo.alertar({ titulo: "Sessão expirada", mensagem: "Faça login novamente.", tipo: "erro" });
      return;
    }
    setConfirmarExcluir({ id: u.id, nome: u.nome });
  }

  // Executa a exclusão após o usuário confirmar no modal
  async function executarExclusao() {
    if (!confirmarExcluir) return;
    const { id } = confirmarExcluir;
    // Fecha o modal imediatamente
    setConfirmarExcluir(null);
    // Remove da lista imediatamente (optimistic update — evita o "piscar")
    const usuariosAntes = usuarios;
    setUsuarios(prev => prev.filter(x => x.id !== id));
    try {
      await fetchUsuariosAPI(`${API_USUARIOS}/${id}`, "DELETE");
      // Sucesso: card já foi removido via optimistic update
    } catch (e) {
      // Reverte o optimistic update em caso de erro
      setUsuarios(usuariosAntes);
      dialogo.alertar({ titulo: "Erro ao excluir", mensagem: e.message, tipo: "erro" });
    }
  }

  // Pré-carrega a lista de usuários assim que o módulo Escritório é aberto.
  // Só tenta carregar se for admin/master (editor/visualizador recebe 403).
  useEffect(() => {
    if (perm.podeGerenciarUsuarios && usuarios.length === 0 && !loadingUsuarios && !erroUsuarios) {
      carregarUsuarios();
    }
    // eslint-disable-next-line
  }, []);

  const emptyMembro = { id:"", nome:"", cargo:"", email:"", telefone:"", cau:"", cpf:"" };

  function handleSave() {
    save({ ...data, escritorio: { ...form, equipe, responsaveis } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    // Volta pro modo visualização — UX padrão de "salvou, fecha edição"
    setEditandoDados(false);
  }

  function iniciarEdicaoDados() {
    // Snapshot pra Cancelar restaurar. JSON.parse(JSON.stringify()) é deep clone
    // suficiente pra esses dados (sem Date/Map/funções).
    formOriginalRef.current = JSON.parse(JSON.stringify(form));
    responsaveisOriginalRef.current = JSON.parse(JSON.stringify(responsaveis));
    setEditandoDados(true);
  }

  function cancelarEdicaoDados() {
    // Restaura valores originais e fecha edição
    if (formOriginalRef.current) setForm(formOriginalRef.current);
    if (responsaveisOriginalRef.current) setResponsaveis(responsaveisOriginalRef.current);
    setEditandoDados(false);
  }

  // Limpar todos os campos do escritório de uma vez (NÃO inclui logo — esse tem
  // fluxo próprio "Remover" porque é caro refazer o upload). Não fecha edição:
  // mantém o usuário em modo edição pra ele poder digitar o novo cadastro
  // ou clicar Cancelar caso tenha mudado de ideia. Salvar ainda é manual.
  // Pede confirmação porque a operação afeta muitos campos de uma vez —
  // proteção contra clique acidental (especialmente em mobile).
  async function limparDadosEscritorio() {
    const confirmou = await dialogo.confirmar({
      titulo: "Limpar todos os dados do escritório?",
      mensagem: "Vai apagar nome, CNPJ, contato, endereço, dados bancários, PIX e responsáveis técnicos. O logo NÃO é apagado (use \"Remover\" ao lado dele). Você ainda precisa clicar em \"Salvar alterações\" para confirmar — clique \"Cancelar\" se quiser desfazer.",
      confirmar: "Limpar campos",
      destrutivo: true,
    });
    if (!confirmou) return;
    setForm(f => ({
      ...f,
      nome: "", cnpj: "",
      email: "", telefone: "", site: "", instagram: "",
      cep: "", endereco: "", cidade: "", estado: "",
      banco: "", agencia: "", conta: "",
      tipoConta: "Corrente",
      pixTipo: "CNPJ", pixChave: "",
      // Logo NÃO mexe — preservar
    }));
    setResponsaveis([]);
  }

  // ── Item 6: Consulta automática de CEP via ViaCEP ───────────────
  // ViaCEP é API pública gratuita (https://viacep.com.br) — confiável, sem rate
  // limit problemático pra uso normal. Retorna { logradouro, bairro, localidade,
  // uf, ... }. Falha silenciosa: se CEP inválido ou rede ruim, deixa campos como
  // estão pro usuário preencher manual.
  async function buscarCep(cepBruto) {
    const cep = (cepBruto || "").replace(/\D/g, "");
    if (cep.length !== 8) return; // só consulta com CEP completo (8 dígitos)
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const j = await res.json();
      if (j && !j.erro) {
        // Monta endereço como "logradouro, bairro" (sem número — usuário completa)
        const endereco = [j.logradouro, j.bairro].filter(Boolean).join(", ");
        setForm(f => ({
          ...f,
          endereco: endereco || f.endereco,
          cidade: j.localidade || f.cidade,
          estado: j.uf || f.estado,
        }));
      }
    } catch {
      // Sem rede ou ViaCEP fora do ar — não interrompe fluxo, usuário pode digitar manual
    } finally {
      setCepLoading(false);
    }
  }

  // Upload do logo: lê o arquivo como base64, valida tamanho e formato.
  // O logo é salvo dentro do objeto escritorio.logo e enviado no PUT /api/escritorio
  // junto com os outros dados (server v2.1.0 separa logo pra coluna dedicada).
  //
  // Limite: 500KB depois da conversão base64 — isso equivale a ~375KB do arquivo
  // original. PNG/JPG/SVG aceitos. Qualquer coisa acima disso é rejeitada pra
  // evitar PDFs lentos e payloads gigantes no backend.
  async function handleUploadLogo(evento) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = ""; // permite re-selecionar o mesmo arquivo depois
    if (!arquivo) return;

    const tiposOk = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
    if (!tiposOk.includes(arquivo.type)) {
      dialogo.alertar({
        titulo: "Formato não suportado",
        mensagem: "Use PNG, JPG ou SVG.",
        tipo: "aviso",
      });
      return;
    }

    // Limite original de 1MB pro arquivo (antes do base64)
    if (arquivo.size > 1024 * 1024) {
      dialogo.alertar({
        titulo: "Arquivo grande demais",
        mensagem: `O logo tem ${(arquivo.size/1024).toFixed(0)}KB. Limite: 1MB.`,
        tipo: "aviso",
      });
      return;
    }

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
        reader.readAsDataURL(arquivo);
      });
      setF("logo", base64);
    } catch (e) {
      dialogo.alertar({ titulo: "Erro ao ler arquivo", mensagem: e.message, tipo: "erro" });
    }
  }

  function removerLogo() {
    setF("logo", null);
  }

  function setF(key, val) {
    setForm(f => {
      const novo = { ...f, [key]: val };
      if (key === "cnpj" && (f.pixTipo === "CNPJ" || f.pixTipo === "CPF")) novo.pixChave = val;
      if (key === "email" && f.pixTipo === "E-mail") novo.pixChave = val;
      if (key === "telefone" && f.pixTipo === "Telefone") novo.pixChave = val;
      return novo;
    });
  }

  const E = {
    wrap: { fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif", background:"#fff", minHeight:"100vh", color:"#111", maxWidth:1200, margin:"0 auto" },
    header: { borderBottom:"1px solid #e5e7eb", padding:"24px 32px", display:"flex", justifyContent:"space-between", alignItems:"center" },
    titulo: { fontSize:18, fontWeight:700, color:"#111", margin:0 },
    sub: { fontSize:13, color:"#9ca3af", marginTop:3 },
    abas: { display:"flex", gap:0, borderBottom:"1px solid #e5e7eb", padding:"0 32px" },
    aba: (ativa) => ({ background:"none", border:"none", borderBottom: ativa ? "2px solid #111" : "2px solid transparent", color: ativa ? "#111" : "#9ca3af", padding:"12px 16px", fontSize:13, fontWeight: ativa ? 600 : 400, cursor:"pointer", fontFamily:"inherit", marginBottom:-1 }),
    body: { padding:"32px", maxWidth:760 },
    secao: { marginBottom:32 },
    secTitulo: { fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:16 },
    grid2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 },
    grid3: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 },
    campo: { display:"flex", flexDirection:"column", gap:5 },
    label: { fontSize:12, color:"#6b7280", fontWeight:500 },
    input: { border:"1px solid #d1d5db", borderRadius:8, padding:"10px 12px", fontSize:13, color:"#111", outline:"none", background:"#fff", fontFamily:"inherit", width:"100%", boxSizing:"border-box" },
    select: { border:"1px solid #d1d5db", borderRadius:8, padding:"10px 12px", fontSize:13, color:"#111", outline:"none", background:"#fff", fontFamily:"inherit", width:"100%", boxSizing:"border-box", cursor:"pointer" },
    divisor: { border:"none", borderTop:"1px solid #f3f4f6", margin:"24px 0" },
    btn: { background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" },
    btnSec: { background:"#fff", color:"#374151", border:"1px solid #d1d5db", borderRadius:8, padding:"10px 18px", fontSize:13, cursor:"pointer", fontFamily:"inherit" },
    btnAdd: { background:"#fff", color:"#374151", border:"1px solid #d1d5db", borderRadius:7, padding:"7px 14px", fontSize:12, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 },
    btnSalvo: { background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", opacity:0.7 },
    // Equipe
    membroCard: { border:"1px solid #e5e7eb", borderRadius:10, padding:"16px", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"flex-start" },
    membroNome: { fontSize:14, fontWeight:600, color:"#111", marginBottom:2 },
    membroCargo: { fontSize:12, color:"#9ca3af" },
    membroInfo: { fontSize:12, color:"#6b7280", marginTop:6, display:"flex", gap:16 },
    // Modal
    overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.3)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:20 },
    modal: { background:"#fff", borderRadius:14, padding:"28px", width:"100%", maxWidth:520, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 20px 40px rgba(0,0,0,0.15)" },
    modalTitulo: { fontSize:16, fontWeight:700, color:"#111", marginBottom:20 },
    // View
    viewVal: { fontSize:14, color:"#111", marginBottom:2 },
    viewLabel: { fontSize:11, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.5, marginBottom:4 },
    viewBloco: { display:"flex", flexDirection:"column", gap:3 },
    // Modo visualização vs edição (item 4)
    secaoHeader: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 },
    btnEditar: { background:"#fff", color:"#374151", border:"1px solid #d1d5db", borderRadius:7, padding:"6px 14px", fontSize:12.5, fontWeight:500, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 },
    // Valor "vazio" — aparece quando campo não preenchido em modo visualização
    viewVazio: { fontSize:14, color:"#d1d5db", fontStyle:"italic", marginBottom:2 },
  };

  // Tag de nível de usuário (reusável)
  const tagBase = {
    fontSize: 9.5,
    padding: "2px 6px",
    borderRadius: 4,
    fontWeight: 600,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };

  // ── ABA DADOS ───────────────────────────────────────────────
  // Helper pra renderizar campo em modo visualização. Mostra label cinza pequeno
  // + valor preto (ou "—" cinza itálico se vazio). Reusa o estilo viewLabel/viewVal.
  const Campo = ({ label, valor }) => (
    <div style={E.viewBloco}>
      <div style={E.viewLabel}>{label}</div>
      {valor ? <div style={E.viewVal}>{valor}</div> : <div style={E.viewVazio}>—</div>}
    </div>
  );

  const renderDados = () => (
    <div style={E.body}>
      {/* Logo do escritório — sempre editável (não usa modo visualização porque
          ações são únicas: Trocar logo / Remover. Não faz sentido ter "Editar logo") */}
      <div style={E.secao}>
        <div style={E.secTitulo}>Logo do escritório</div>
        <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
          {/* Preview */}
          <div style={{
            width: 160,
            height: 100,
            border: form.logo ? "1px solid #e5e7eb" : "1.5px dashed #d1d5db",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fafbfc",
            overflow: "hidden",
            flexShrink: 0,
          }}>
            {form.logo ? (
              <img src={form.logo} alt="Logo"
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            ) : (
              <span style={{ fontSize: 12, color: "#9ca3af" }}>Sem logo</span>
            )}
          </div>

          {/* Ações */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10, lineHeight: 1.5 }}>
              Aparece no cabeçalho das propostas em PDF.<br/>
              Formatos: PNG, JPG ou SVG · Máximo 1MB.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label style={{
                ...E.btn,
                cursor: perm.podeAlterarConfig ? "pointer" : "not-allowed",
                opacity: perm.podeAlterarConfig ? 1 : 0.5,
                display: "inline-flex",
                alignItems: "center",
                fontSize: 12.5,
                fontWeight: 600,
                padding: "7px 14px",
              }}>
                {form.logo ? "Trocar logo" : "Enviar logo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                  style={{ display: "none" }}
                  onChange={handleUploadLogo}
                  disabled={!perm.podeAlterarConfig}
                />
              </label>
              {form.logo && perm.podeAlterarConfig && (
                <button
                  onClick={removerLogo}
                  style={{
                    background: "#fff",
                    color: "#dc2626",
                    border: "1px solid #fecaca",
                    borderRadius: 7,
                    padding: "7px 14px",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}>
                  Remover
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <hr style={E.divisor} />

      {/* Header de seção: aparece no topo de Dados Gerais com botão Editar
          ou Limpar/Cancelar/Salvar dependendo do modo. Padrão SaaS moderno —
          usuário entende imediato que campos são readonly até clicar Editar. */}
      {perm.podeAlterarConfig && (
        <div style={{
          display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, marginBottom:20,
          paddingBottom:16, borderBottom: editandoDados ? "1px dashed #e5e7eb" : "none",
        }}>
          {/* Esquerda: ação destrutiva (limpar) — só visível em modo edição */}
          <div>
            {editandoDados && (
              <button
                onClick={limparDadosEscritorio}
                style={{
                  background:"#fff", color:"#dc2626", border:"1px solid #fecaca",
                  borderRadius:7, padding:"6px 14px", fontSize:12.5, fontWeight:500,
                  cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#fef2f2"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}
              >
                <span style={{ fontSize:13 }}>🗑</span>
                <span>Limpar dados</span>
              </button>
            )}
          </div>
          {/* Direita: ações primárias */}
          <div style={{ display:"flex", gap:8 }}>
            {!editandoDados ? (
              <button onClick={iniciarEdicaoDados} style={E.btnEditar}>
                <span style={{ fontSize:13 }}>✎</span>
                <span>Editar dados</span>
              </button>
            ) : (
              <>
                <button onClick={cancelarEdicaoDados} style={E.btnSec}>Cancelar</button>
                <button onClick={handleSave} style={saved ? E.btnSalvo : E.btn}>
                  {saved ? "Salvo!" : "Salvar alterações"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Identificação */}
      <div style={E.secao}>
        <div style={E.secTitulo}>Identificação</div>

        {!editandoDados ? (
          <>
            <div style={{ ...E.grid2, marginBottom:20 }}>
              <Campo label="Nome do escritório" valor={form.nome} />
              <Campo label="CNPJ / CPF"         valor={form.cnpj} />
            </div>
            <div style={{ fontSize:12, color:"#6b7280", fontWeight:500, marginBottom:10 }}>Responsáveis técnicos</div>
            {responsaveis.length === 0 ? (
              <div style={E.viewVazio}>Nenhum responsável cadastrado</div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {responsaveis.map(r => (
                  <div key={r.id} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:16 }}>
                    <Campo label="Nome"      valor={r.nome} />
                    <Campo label="CAU/CREA"  valor={r.cau} />
                    <Campo label="CPF"       valor={r.cpf} />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ ...E.grid2, marginBottom:16 }}>
              <div style={E.campo}>
                <label style={E.label}>Nome do escritório</label>
                <input style={E.input} value={form.nome} onChange={e => setF("nome", e.target.value)} placeholder="Ex: Vicke Associados" />
              </div>
              <div style={E.campo}>
                <label style={E.label}>CNPJ / CPF</label>
                <input style={E.input} value={form.cnpj} onChange={e => setF("cnpj", e.target.value)} placeholder="00.000.000/0001-00" />
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <span style={{ fontSize:12, color:"#6b7280", fontWeight:500 }}>Responsáveis técnicos</span>
              <button style={E.btnAdd} onClick={() => setResponsaveis(r => [...r, { id:uid(), nome:"", cau:"", cpf:"" }])}>
                + Adicionar
              </button>
            </div>
            {responsaveis.length === 0 && (
              <div style={{ fontSize:13, color:"#d1d5db", fontStyle:"italic", marginBottom:8 }}>Nenhum responsável cadastrado.</div>
            )}
            {responsaveis.map((r, idx) => (
              <div key={r.id} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr auto", gap:10, marginBottom:10, alignItems:"end" }}>
                {[["Nome","nome","Nome do responsável"],["CAU / CREA","cau","A000000-0"],["CPF","cpf","000.000.000-00"]].map(([lbl,fld,ph]) => (
                  <div key={fld} style={E.campo}>
                    <label style={E.label}>{lbl}</label>
                    <input style={E.input} value={r[fld]||""} placeholder={ph}
                      onChange={e => setResponsaveis(rs => rs.map((x,i) => i===idx ? {...x,[fld]:e.target.value} : x))} />
                  </div>
                ))}
                <button onClick={() => setResponsaveis(rs => rs.filter((_,i) => i!==idx))}
                  style={{ background:"none", border:"none", color:"#d1d5db", fontSize:18, cursor:"pointer", padding:"8px", alignSelf:"flex-end" }}>×</button>
              </div>
            ))}
          </>
        )}
      </div>

      <hr style={E.divisor} />

      {/* Contato */}
      <div style={E.secao}>
        <div style={E.secTitulo}>Contato</div>
        {!editandoDados ? (
          <div style={{ ...E.grid2, rowGap:16 }}>
            <Campo label="E-mail"            valor={form.email} />
            <Campo label="Telefone / WhatsApp" valor={form.telefone} />
            <Campo label="Site"               valor={form.site} />
            <Campo label="Instagram"          valor={form.instagram} />
          </div>
        ) : (
          <>
            <div style={{ ...E.grid2, marginBottom:12 }}>
              {[["E-mail","email","contato@escritorio.com"],["Telefone / WhatsApp","telefone","(14) 99999-0000"]].map(([lbl,key,ph]) => (
                <div key={key} style={E.campo}>
                  <label style={E.label}>{lbl}</label>
                  <input style={E.input} value={form[key]} onChange={e => setF(key, e.target.value)} placeholder={ph} />
                </div>
              ))}
            </div>
            <div style={E.grid2}>
              {[["Site","site","www.escritorio.com.br"],["Instagram","instagram","@escritorio"]].map(([lbl,key,ph]) => (
                <div key={key} style={E.campo}>
                  <label style={E.label}>{lbl}</label>
                  <input style={E.input} value={form[key]} onChange={e => setF(key, e.target.value)} placeholder={ph} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <hr style={E.divisor} />

      {/* Endereço — agora com CEP (item 6: preenche cidade/estado/endereço auto) */}
      <div style={E.secao}>
        <div style={E.secTitulo}>Endereço</div>
        {!editandoDados ? (
          <div style={{ ...E.grid2, rowGap:16 }}>
            <Campo label="CEP"      valor={form.cep} />
            <Campo label="Endereço" valor={form.endereco} />
            <Campo label="Cidade"   valor={form.cidade} />
            <Campo label="Estado"   valor={form.estado} />
          </div>
        ) : (
          <>
            {/* Linha 1: CEP (consulta automática) */}
            <div style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:16, marginBottom:16 }}>
              <div style={E.campo}>
                <label style={E.label}>CEP</label>
                <input
                  style={E.input}
                  value={form.cep}
                  onChange={e => {
                    const v = e.target.value;
                    setF("cep", v);
                    // Dispara busca quando atinge 8 dígitos (com ou sem máscara)
                    const digits = v.replace(/\D/g, "");
                    if (digits.length === 8) buscarCep(digits);
                  }}
                  placeholder="00000-000"
                  maxLength={9}
                />
                {cepLoading && (
                  <div style={{ fontSize:11, color:"#9ca3af", marginTop:4 }}>Buscando endereço…</div>
                )}
              </div>
              <div style={E.campo}>
                <label style={E.label}>Endereço</label>
                <input style={E.input} value={form.endereco} onChange={e => setF("endereco", e.target.value)} placeholder="Rua, número, bairro" />
              </div>
            </div>
            {/* Linha 2: Cidade e Estado */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 120px", gap:16 }}>
              <div style={E.campo}>
                <label style={E.label}>Cidade</label>
                <input style={E.input} value={form.cidade} onChange={e => setF("cidade", e.target.value)} placeholder="Ourinhos" />
              </div>
              <div style={E.campo}>
                <label style={E.label}>Estado</label>
                <input style={E.input} value={form.estado} onChange={e => setF("estado", e.target.value)} placeholder="SP" maxLength={2} />
              </div>
            </div>
          </>
        )}
      </div>

      <hr style={E.divisor} />

      {/* Dados bancários */}
      <div style={E.secao}>
        <div style={E.secTitulo}>Dados bancários</div>
        {!editandoDados ? (
          <>
            <div style={{ ...E.grid3, marginBottom:16 }}>
              <Campo label="Banco"   valor={form.banco} />
              <Campo label="Agência" valor={form.agencia} />
              <Campo label="Conta"   valor={form.conta} />
            </div>
            <div style={E.grid3}>
              <Campo label="Tipo de conta"      valor={form.tipoConta} />
              <Campo label="Tipo de chave PIX"  valor={form.pixTipo} />
              <Campo label="Chave PIX"          valor={form.pixChave} />
            </div>
          </>
        ) : (
          <>
            <div style={{ ...E.grid3, marginBottom:16 }}>
              {[["Banco","banco","Ex: Sicoob"],["Agência","agencia","0000"],["Conta","conta","00000-0"]].map(([lbl,key,ph]) => (
                <div key={key} style={E.campo}>
                  <label style={E.label}>{lbl}</label>
                  <input style={E.input} value={form[key]} onChange={e => setF(key, e.target.value)} placeholder={ph} />
                </div>
              ))}
            </div>
            <div style={E.grid3}>
              <div style={E.campo}>
                <label style={E.label}>Tipo de conta</label>
                <select style={E.select} value={form.tipoConta} onChange={e => setF("tipoConta", e.target.value)}>
                  <option>Corrente</option><option>Poupança</option><option>Pagamento</option>
                </select>
              </div>
              <div style={E.campo}>
                <label style={E.label}>Tipo de chave PIX</label>
                <select style={E.select} value={form.pixTipo} onChange={e => {
                  const tipo = e.target.value;
                  let chave = form.pixChave;
                  if (tipo==="CNPJ"||tipo==="CPF") chave = form.cnpj||chave;
                  if (tipo==="E-mail") chave = form.email||chave;
                  if (tipo==="Telefone") chave = form.telefone||chave;
                  setForm(f => ({...f, pixTipo:tipo, pixChave:chave}));
                }}>
                  <option>CNPJ</option><option>CPF</option><option>E-mail</option><option>Telefone</option><option>Chave Aleatória</option>
                </select>
              </div>
              <div style={E.campo}>
                <label style={E.label}>Chave PIX</label>
                <input style={E.input} value={form.pixChave} onChange={e => setF("pixChave", e.target.value)} placeholder="Chave PIX" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Aviso pra quem não tem permissão de alterar — sempre visível pra esses */}
      {!perm.podeAlterarConfig && (
        <div style={{
          padding:"12px 14px", background:"#f9fafb", border:"1px solid #f3f4f6",
          borderRadius:8, color:"#6b7280", fontSize:12.5, textAlign:"center", marginTop:24,
        }}>
          Somente administradores podem alterar estes dados.
        </div>
      )}
    </div>
  );

  // ── ABA EQUIPE ──────────────────────────────────────────────
  const renderEquipe = () => (
    <div style={E.body}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <div style={{ fontSize:14, color:"#111", fontWeight:600 }}>{equipe.length} membro{equipe.length !== 1 ? "s" : ""}</div>
          <div style={{ fontSize:12, color:"#9ca3af", marginTop:2 }}>Gerencie os membros da equipe</div>
        </div>
        <button style={E.btn} onClick={() => setNovoMembro({...emptyMembro, id:uid()})}>+ Adicionar membro</button>
      </div>

      {equipe.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 0", color:"#d1d5db", fontSize:14 }}>
          Nenhum membro cadastrado ainda.
        </div>
      ) : (
        equipe.map(m => (
          <div key={m.id} style={E.membroCard}>
            <div>
              <div style={E.membroNome}>{m.nome}</div>
              <div style={E.membroCargo}>{m.cargo || "—"}</div>
              <div style={E.membroInfo}>
                {m.email && <span>{m.email}</span>}
                {m.telefone && <span>{m.telefone}</span>}
                {m.cau && <span>{m.cau}</span>}
              </div>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <button onClick={() => setNovoMembro(m)}
                style={{ background:"none", border:"1px solid #e5e7eb", borderRadius:6, color:"#6b7280", padding:"5px 10px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
                Editar
              </button>
              <button onClick={() => { setEquipe(eq => eq.filter(x => x.id !== m.id)); save({ ...data, escritorio: { ...form, equipe: equipe.filter(x => x.id !== m.id), responsaveis } }); }}
                style={{ background:"none", border:"none", color:"#d1d5db", fontSize:18, cursor:"pointer", padding:"5px 8px" }}>×</button>
            </div>
          </div>
        ))
      )}

      {/* Modal membro — zIndex elevado pra ficar acima do modal de usuário
          quando ambos estão abertos (item 7: cria membro de dentro do modal usuário) */}
      {novoMembro && (
        <div style={{ ...E.overlay, zIndex: 10001 }}>
          <div style={E.modal}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={E.modalTitulo}>{novoMembro.nome ? "Editar membro" : "Novo membro"}</div>
              <button onClick={() => setNovoMembro(null)} style={{ background:"none", border:"none", color:"#9ca3af", fontSize:20, cursor:"pointer" }}>×</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
              {[["Nome completo","nome"],["Cargo","cargo"],["E-mail","email"],["Telefone","telefone"],["CAU / CREA","cau"],["CPF","cpf"]].map(([lbl,key]) => (
                <div key={key} style={E.campo}>
                  <label style={E.label}>{lbl}</label>
                  <input style={E.input} value={novoMembro[key]||""} onChange={e => setNovoMembro(m => ({...m,[key]:e.target.value}))} />
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button style={E.btnSec} onClick={() => setNovoMembro(null)}>Cancelar</button>
              <button style={E.btn} onClick={() => {
                if (!novoMembro.nome?.trim()) return;
                const existe = equipe.find(m => m.id === novoMembro.id);
                const novaEquipe = existe
                  ? equipe.map(m => m.id === novoMembro.id ? novoMembro : m)
                  : [...equipe, novoMembro];
                setEquipe(novaEquipe);
                save({ ...data, escritorio: { ...form, equipe: novaEquipe, responsaveis } });
                // Item 7: se há um modal de usuário aberto e este é membro NOVO
                // (não edição), auto-seleciona o membro recém-criado no dropdown.
                // Fluxo: usuário clica "+ novo membro" → preenche → Adicionar →
                // membro fica selecionado direto, sem precisar voltar e escolher.
                if (novoUsuario && !existe) {
                  setNovoUsuario(u => ({ ...u, membro_id: novoMembro.id }));
                }
                setNovoMembro(null);
              }}>
                {equipe.find(m => m.id === novoMembro.id) ? "Salvar" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── ABA USUÁRIOS ────────────────────────────────────────────
  const renderUsuarios = () => {
    const labelNivel = { admin:"Admin", editor:"Editor", visualizador:"Visualizador" };
    const corNivel = {
      admin:        { bg:"#334155", color:"#fff" },
      editor:       { bg:"#dbeafe", color:"#1e40af" },
      visualizador: { bg:"#f1f5f9", color:"#64748b" },
    };

    return (
      <div style={E.body}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div>
            <div style={{ fontSize:14, color:"#111", fontWeight:600 }}>
              {usuarios.length} {usuarios.length === 1 ? "usuário" : "usuários"}
            </div>
            <div style={{ fontSize:12, color:"#9ca3af", marginTop:2 }}>
              Controle quem acessa o sistema e em qual nível de permissão
            </div>
          </div>
          <button
            style={E.btn}
            onClick={() => { setNovoUsuario({ ...emptyUsuario, id: `usr_${Date.now()}_${Math.random().toString(36).slice(2,7)}` }); setConfirmSenha(""); }}>
            + Adicionar usuário
          </button>
        </div>

        {/* Legenda dos níveis */}
        <div style={{
          background:"#f9fafb", border:"1px solid #f3f4f6", borderRadius:10,
          padding:"12px 14px", marginBottom:20, fontSize:12, lineHeight:1.7, color:"#6b7280",
        }}>
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
            <span style={{ ...tagBase, background: corNivel.admin.bg, color: corNivel.admin.color }}>Admin</span>
            Acesso total: criar/editar/excluir dados + gerenciar usuários
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
            <span style={{ ...tagBase, background: corNivel.editor.bg, color: corNivel.editor.color }}>Editor</span>
            Cria e edita orçamentos, clientes e obras. Não exclui nem mexe em config
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <span style={{ ...tagBase, background: corNivel.visualizador.bg, color: corNivel.visualizador.color }}>Visualizador</span>
            Somente leitura: vê tudo mas não altera nada
          </div>
        </div>

        {loadingUsuarios && (
          <div style={{ textAlign:"center", padding:"40px 0", color:"#9ca3af", fontSize:13 }}>
            Carregando usuários…
          </div>
        )}

        {erroUsuarios && !loadingUsuarios && (
          <div style={{
            background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10,
            padding:"14px 16px", color:"#b91c1c", fontSize:13,
            display:"flex", justifyContent:"space-between", alignItems:"center",
          }}>
            <span>⚠ Erro ao carregar: {erroUsuarios}</span>
            <button style={E.btnSec} onClick={carregarUsuarios}>Tentar novamente</button>
          </div>
        )}

        {!loadingUsuarios && !erroUsuarios && usuarios.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 0", color:"#d1d5db", fontSize:14 }}>
            Nenhum usuário cadastrado ainda.
          </div>
        )}

        {!loadingUsuarios && !erroUsuarios && usuarios.map(u => {
          const cor = corNivel[u.nivel] || corNivel.visualizador;
          const ehVoce = u.id === usuarioLogadoId;
          const membroVinculado = u.membro_id ? equipe.find(m => m.id === u.membro_id) : null;
          return (
            <div key={u.id} style={{
              ...E.membroCard,
              opacity: u.ativo === false ? 0.55 : 1,
              borderStyle: u.ativo === false ? "dashed" : "solid",
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                  <div style={E.membroNome}>{u.nome}</div>
                  <span style={{ ...tagBase, background: cor.bg, color: cor.color }}>
                    {labelNivel[u.nivel] || u.nivel}
                  </span>
                  {ehVoce && (
                    <span style={{
                      fontSize:10, padding:"2px 6px", borderRadius:4,
                      background:"#eff6ff", color:"#2563eb", fontWeight:600,
                      textTransform:"uppercase", letterSpacing:0.5,
                    }}>Você</span>
                  )}
                  {u.ativo === false && (
                    <span style={{
                      fontSize:10, padding:"2px 6px", borderRadius:4,
                      background:"#f3f4f6", color:"#6b7280", fontWeight:600,
                      textTransform:"uppercase", letterSpacing:0.5,
                    }}>Inativo</span>
                  )}
                  {u.precisa_trocar_senha && (
                    <span style={{
                      fontSize:10, padding:"2px 6px", borderRadius:4,
                      background:"#fafafa", color:"#374151", fontWeight:600,
                      border:"1px solid #e5e7eb",
                      textTransform:"uppercase", letterSpacing:0.5,
                    }} title="Senha foi resetada — usuário precisa trocá-la no próximo login">
                      Trocar senha
                    </span>
                  )}
                </div>
                <div style={E.membroCargo}>{u.email}</div>
                {membroVinculado && (
                  <div style={{ fontSize:11.5, color:"#6b7280", marginTop:4 }}>
                    Vinculado a: <strong style={{ color:"#374151" }}>{membroVinculado.nome}</strong>
                    {membroVinculado.cargo && <span style={{ color:"#9ca3af" }}> · {membroVinculado.cargo}</span>}
                  </div>
                )}
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button
                  onClick={() => {
                    setNovoUsuario({
                      id: u.id, nome: u.nome, email: u.email,
                      senha: "", // senha em branco ao editar (só preenche se quiser trocar)
                      nivel: u.nivel || "visualizador",
                      membro_id: u.membro_id || "",
                      ativo: u.ativo !== false,
                      _editando: true,
                    });
                    setConfirmSenha("");
                  }}
                  style={{ background:"none", border:"1px solid #e5e7eb", borderRadius:6, color:"#6b7280", padding:"5px 10px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
                  Editar
                </button>
                {/* Reset de senha — só admin de empresa pode, não pra si mesmo,
                    não pra usuário inativo (sem sentido resetar quem não loga). */}
                {!ehVoce && u.ativo !== false && (
                  <button
                    onClick={() => setUsuarioParaResetar(u)}
                    title="Resetar senha do usuário"
                    style={{ background:"none", border:"1px solid #e5e7eb", borderRadius:6, color:"#6b7280", padding:"5px 10px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
                    Resetar senha
                  </button>
                )}
                {!ehVoce && (
                  <button
                    onClick={() => pedirConfirmacaoExcluir(u)}
                    title="Excluir usuário"
                    style={{ background:"none", border:"none", color:"#d1d5db", fontSize:18, cursor:"pointer", padding:"5px 8px" }}>×</button>
                )}
              </div>
            </div>
          );
        })}

        {/* Modal de criação/edição */}
        {novoUsuario && (
          <div style={E.overlay}>
            <div style={E.modal}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                <div style={E.modalTitulo}>
                  {novoUsuario._editando ? "Editar usuário" : "Novo usuário"}
                </div>
                <button
                  onClick={() => { setNovoUsuario(null); setConfirmSenha(""); }}
                  style={{ background:"none", border:"none", color:"#9ca3af", fontSize:20, cursor:"pointer" }}>×</button>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
                <div style={E.campo}>
                  <label style={E.label}>Nome completo *</label>
                  <input style={E.input} value={novoUsuario.nome}
                    onChange={e => setNovoUsuario(u => ({ ...u, nome: e.target.value }))} />
                </div>
                <div style={E.campo}>
                  <label style={E.label}>E-mail *</label>
                  <input type="email" style={E.input} value={novoUsuario.email}
                    autoComplete="off"
                    onChange={e => setNovoUsuario(u => ({ ...u, email: e.target.value }))} />
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
                <div style={E.campo}>
                  <label style={E.label}>
                    {novoUsuario._editando ? "Nova senha (deixe em branco pra manter)" : "Senha * (mín. 6 caracteres)"}
                  </label>
                  <input type="password" style={E.input} value={novoUsuario.senha}
                    autoComplete="new-password"
                    onChange={e => setNovoUsuario(u => ({ ...u, senha: e.target.value }))} />
                </div>
                <div style={E.campo}>
                  <label style={E.label}>Confirmar senha</label>
                  <input type="password" style={E.input} value={confirmSenha}
                    autoComplete="new-password"
                    onChange={e => setConfirmSenha(e.target.value)} />
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
                <div style={E.campo}>
                  <label style={E.label}>Nível de acesso *</label>
                  <select style={E.select} value={novoUsuario.nivel}
                    onChange={e => setNovoUsuario(u => ({ ...u, nivel: e.target.value }))}>
                    <option value="admin">Admin — acesso total</option>
                    <option value="editor">Editor — cria e edita</option>
                    <option value="visualizador">Visualizador — só leitura</option>
                  </select>
                </div>
                <div style={E.campo}>
                  <label style={E.label}>Vincular a membro da equipe</label>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <select style={{ ...E.select, flex:1 }} value={novoUsuario.membro_id}
                      onChange={e => {
                        const valor = e.target.value;
                        // Opção especial __novo: abre o modal de novo membro sem fechar
                        // este modal de usuário. Quando o membro for criado, ele aparece
                        // automaticamente na lista (porque equipe é state) e o usuário
                        // pode selecionar. Reset do select pra "" pra não confundir.
                        if (valor === "__novo") {
                          setNovoMembro({ ...emptyMembro, id: uid() });
                          return; // não atualiza membro_id ainda
                        }
                        setNovoUsuario(u => ({ ...u, membro_id: valor }));
                      }}>
                      <option value="">— Nenhum —</option>
                      {equipe.map(m => (
                        <option key={m.id} value={m.id}>{m.nome}{m.cargo ? ` (${m.cargo})` : ""}</option>
                      ))}
                      <option value="__novo">+ Cadastrar novo membro…</option>
                    </select>
                  </div>
                  {equipe.length === 0 && (
                    <div style={{ fontSize:11, color:"#9ca3af", marginTop:5 }}>
                      Nenhum membro cadastrado ainda. Use a opção acima ou a aba Equipe.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginBottom:20 }}>
                <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"#374151", cursor:"pointer" }}>
                  <input
                    type="checkbox"
                    checked={novoUsuario.ativo !== false}
                    disabled={novoUsuario._editando && novoUsuario.id === usuarioLogadoId}
                    onChange={e => setNovoUsuario(u => ({ ...u, ativo: e.target.checked }))}
                    style={{ width:14, height:14, cursor: novoUsuario._editando && novoUsuario.id === usuarioLogadoId ? "not-allowed" : "pointer" }}
                  />
                  Usuário ativo
                  {novoUsuario._editando && novoUsuario.id === usuarioLogadoId && (
                    <span style={{ fontSize:11, color:"#9ca3af" }}>· não é possível desativar a si mesmo</span>
                  )}
                </label>
              </div>

              <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                <button
                  style={E.btnSec}
                  disabled={salvandoUsuario}
                  onClick={() => { setNovoUsuario(null); setConfirmSenha(""); }}>
                  Cancelar
                </button>
                <button
                  style={{ ...E.btn, opacity: salvandoUsuario ? 0.6 : 1, cursor: salvandoUsuario ? "not-allowed" : "pointer" }}
                  disabled={salvandoUsuario}
                  onClick={salvarUsuario}>
                  {salvandoUsuario ? "Salvando…" : (novoUsuario._editando ? "Salvar alterações" : "Criar usuário")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de confirmação de exclusão */}
        {confirmarExcluir && (
          <div style={E.overlay}>
            <div style={{ ...E.modal, maxWidth: 420 }}>
              <div style={{ ...E.modalTitulo, marginBottom: 12 }}>Excluir usuário</div>
              <div style={{ fontSize:14, color:"#374151", lineHeight:1.5, marginBottom:8 }}>
                Tem certeza que deseja excluir <strong>{confirmarExcluir.nome}</strong>?
              </div>
              <div style={{ fontSize:13, color:"#9ca3af", marginBottom:24 }}>
                Esta ação não pode ser desfeita.
              </div>
              <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                <button
                  style={E.btnSec}
                  onClick={() => setConfirmarExcluir(null)}>
                  Cancelar
                </button>
                <button
                  style={{ ...E.btn, background:"#dc2626" }}
                  onClick={executarExclusao}>
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset de senha — reusa componentes definidos em admin.jsx (são funções
            top-level, ficam disponíveis no bundle combinado). Adapter de estilos E→S
            pra os componentes encontrarem as chaves esperadas (overlay, modal, btn, etc). */}
        {(usuarioParaResetar || senhaGerada) && (() => {
          const S = {
            overlay: E.overlay,
            modal:   E.modal,
            modalLg: { ...E.modal, maxWidth:560 },
            btn:     E.btn,
            btnSec:  E.btnSec,
            input:   E.input,
            label:   { display:"block", fontSize:11, fontWeight:600, color:"#6b7280", textTransform:"uppercase", letterSpacing:0.5, marginBottom:5 },
          };
          return (
            <>
              {usuarioParaResetar && (
                <ModalConfirmarResetSenha
                  S={S}
                  usuario={usuarioParaResetar}
                  escopo="empresa"
                  onFechar={() => setUsuarioParaResetar(null)}
                  onSucesso={(senha) => {
                    setSenhaGerada({ usuario: usuarioParaResetar, senha });
                    setUsuarioParaResetar(null);
                    carregarUsuarios(); // refresh pra pegar precisa_trocar_senha=true
                  }}
                />
              )}
              {senhaGerada && (
                <ModalExibirNovaSenha
                  S={S}
                  usuario={senhaGerada.usuario}
                  senha={senhaGerada.senha}
                  onFechar={() => setSenhaGerada(null)}
                />
              )}
            </>
          );
        })()}
      </div>
    );
  };

  // ── ABA SISTEMA ──────────────────────────────────────────────
  const [manutResult, setManutResult] = useState(null);
  const [manutLoading, setManutLoading] = useState(false);

  async function executarManutencao() {
    const ok = await dialogo.confirmar({
      titulo: "Executar rotina de manutenção agora?",
      mensagem: "• Expira propostas com mais de 30 dias (remove imagens, marca como perdido)\n• Inativa clientes sem serviço em aberto há 3 meses\n\nNormalmente roda sozinha todo dia às 3h da manhã.",
      confirmar: "Executar",
    });
    if (!ok) return;
    setManutLoading(true);
    setManutResult(null);
    try {
      const token = localStorage.getItem("vicke-token");
      if (!token) {
        dialogo.alertar({ titulo: "Sessão expirada", mensagem: "Faça login novamente.", tipo: "erro" });
        setManutLoading(false);
        return;
      }
      const res = await fetch(`${_API_URL}/admin/manutencao`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.ok) {
        setManutResult(json.data);
      } else {
        dialogo.alertar({ titulo: "Erro na manutenção", mensagem: json.error || "Falha ao executar manutenção", tipo: "erro" });
      }
    } catch (e) {
      dialogo.alertar({ titulo: "Erro de rede", mensagem: e.message, tipo: "erro" });
    } finally {
      setManutLoading(false);
    }
  }

  const renderSistema = () => (
    <div style={E.body}>
      <div style={E.secao}>
        <div style={E.secTitulo}>Manutenção automática</div>
        <div style={{ fontSize:13, color:"#6b7280", lineHeight:1.6, marginBottom:16 }}>
          O sistema executa automaticamente, todo dia às 3h da manhã:
          <ul style={{ margin:"10px 0 0 0", padding:"0 0 0 20px" }}>
            <li>Expira propostas com mais de 30 dias (marca como "Perdido" e remove imagens salvas)</li>
            <li>Inativa clientes sem serviço em aberto há 3 meses (com observação automática)</li>
          </ul>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:20 }}>
          <button
            onClick={executarManutencao}
            disabled={manutLoading}
            style={{ ...E.btn, opacity: manutLoading ? 0.5 : 1, cursor: manutLoading ? "not-allowed" : "pointer" }}>
            {manutLoading ? "Executando..." : "Executar manutenção agora"}
          </button>
          {manutResult && (
            <div style={{ fontSize:12.5, color:"#16a34a", background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8, padding:"8px 14px" }}>
              ✓ Executado em {new Date(manutResult.executadoEm).toLocaleString("pt-BR")}
              <br/>
              <span style={{ color:"#374151" }}>
                {manutResult.orcamentosExpirados} orçamento(s) expirado(s) · {manutResult.clientesInativados} cliente(s) inativado(s)
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={E.wrap}>
      {/* Header */}
      <div style={E.header}>
        <div>
          <div style={E.titulo}>{form.nome || "Escritório"}</div>
          <div style={E.sub}>{form.cidade}{form.estado ? ` — ${form.estado}` : ""}</div>
        </div>
      </div>

      {/* Abas — aba Usuários só visível pra admin (podeGerenciarUsuarios) */}
      <div style={E.abas}>
        {(() => {
          const abasDisponiveis = [
            ["dados",    "Dados gerais"],
            ["equipe",   "Equipe"],
          ];
          if (perm.podeGerenciarUsuarios) abasDisponiveis.push(["usuarios", "Usuários"]);
          abasDisponiveis.push(["sistema", "Sistema"]);
          return abasDisponiveis.map(([key, lbl]) => (
            <button key={key} style={E.aba(aba === key)} onClick={() => setAba(key)}>{lbl}</button>
          ));
        })()}
      </div>

      {/* Conteúdo */}
      {aba === "dados"    && renderDados()}
      {aba === "equipe"   && renderEquipe()}
      {aba === "usuarios" && perm.podeGerenciarUsuarios && renderUsuarios()}
      {aba === "sistema"  && renderSistema()}
    </div>
  );
}
