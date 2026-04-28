// ═══════════════════════════════════════════════════════════════
// MÓDULO ORÇAMENTO VICKE
// ═══════════════════════════════════════════════════════════════
// Fluxo de componentes:
//   TesteOrcamento           (aba de testes do app)
//   └─ FormOrcamentoProjetoTeste   (form principal: define params, etapas, pagamento)
//      └─ PropostaPreview          (preview interativo da proposta)
//         └─ buildPdf() [resultado-pdf.jsx]  (gera PDF com _preview como espelho)
//
// Convenções importantes:
//  - engAtiva = incluiEng && (!temIsoladas || idsIsolados.has(5))
//    ↳ reflete toggle de engenharia + isolamento de etapas
//  - _preview: objeto passado do preview pro PDF com valores já calculados
//    ↳ PDF sempre prioriza P.xxx antes de recalcular (evita divergências)
//  - Cascata circular de %: ao editar uma etapa isolada, ajusta a PRÓXIMA
//    na ordem circular; se é a última, ajusta a primeira.
//  - Inputs numéricos usam o helper NumInput (estado local, commit no blur)
//    para evitar perda de foco durante redistribuição de percentuais.
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// Helpers top-level de pluralização de cômodos (usados em múltiplos lugares)
// Constantes fora dos componentes: não recriam a cada render
// ═══════════════════════════════════════════════════════════════
const PLURAIS_IRREG = {
  "Sala TV": "salas TV",
  "Sala de jantar": "salas de jantar",
  "Hall de entrada": "halls de entrada",
  "Área de lazer": "áreas de lazer",
  "Lavabo Lazer": "lavabos lazer",
  "Closet Suíte": "closets suíte",
  "Suíte Master": "suítes master",
  "Suíte": "suítes",
  "WC": "WCs",
  "Dormitório": "dormitórios",
  "Escritório": "escritórios",
  "Depósito": "depósitos",
  "Lavabo": "lavabos",
  "Garagem": "garagens",
  "Cozinha": "cozinhas",
  "Lavanderia": "lavanderias",
  "Piscina": "piscinas",
  "Sauna": "saunas",
  "Academia": "academias",
  "Brinquedoteca": "brinquedotecas",
  "Louceiro": "louceiros",
  "Living": "livings",
  "Closet": "closets",
  "Escada": "escadas",
};
const GENERO_AMB = {
  "Garagem":"f","Hall de entrada":"m","Sala TV":"f","Sala de jantar":"f","Living":"m",
  "Cozinha":"f","Lavanderia":"f","Depósito":"m","Lavabo":"m","Escritório":"m",
  "Área de lazer":"f","Piscina":"f","Lavabo Lazer":"m","Sauna":"f","Academia":"f",
  "Brinquedoteca":"f","Louceiro":"m","Dormitório":"m","Closet":"m","WC":"m",
  "Suíte":"f","Closet Suíte":"m","Suíte Master":"f","Escada":"f",
};
const NUM_EXT_MASC = ["","um","dois","três","quatro","cinco","seis","sete","oito","nove","dez"];
const NUM_EXT_FEM  = ["","uma","duas","três","quatro","cinco","seis","sete","oito","nove","dez"];

// Formata "N nome" — número por extenso até 10, algarismo acima; pluraliza nome
// Casos especiais: "Garagem" vira "vaga de garagem" / "vagas de garagem"
function formatComodo(nome, qtd) {
  const plural = qtd > 1;
  if (nome === "Garagem") {
    const ext = qtd <= 10 ? NUM_EXT_FEM[qtd] : String(qtd);
    return `${ext} ${plural ? "vagas de garagem" : "vaga de garagem"}`;
  }
  const nomeStr = plural ? (PLURAIS_IRREG[nome] || (nome.toLowerCase() + "s")) : nome.toLowerCase();
  const genero = GENERO_AMB[nome] || "m";
  const ext = genero === "f" ? NUM_EXT_FEM : NUM_EXT_MASC;
  const qtdStr = qtd <= 10 ? ext[qtd] : String(qtd);
  return `${qtdStr} ${nomeStr}`;
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO ORÇAMENTOS (lista centralizada de todos os orçamentos)
// ═══════════════════════════════════════════════════════════════
// Tela inicial: lista com filtros (Ativos/Todos/Rascunho/Em aberto/Ganhos/Perdidos)
// + Novo Orçamento (abre modal pra escolher cliente antes de abrir formulário)
// Status de orçamento: "rascunho" | "aberto" | "ganho" | "perdido"
//
// Quando clica em Ver/Editar ou Novo (após escolher cliente), abre o FormOrcamentoProjetoTeste
// já existente passando os dados do cliente selecionado.
// ═══════════════════════════════════════════════════════════════
function TesteOrcamento({ data, save, onCadastrarCliente }) {
  const [orcBase, setOrcBase] = useState(null);
  const [clienteAtivo, setClienteAtivo] = useState(null); // cliente do orçamento aberto
  const [filtro, setFiltro] = useState("ativos");
  const [busca, setBusca] = useState("");
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState("");
  const perm = getPermissoes();
  // Visualização (persistida em localStorage): tabela | cards
  const [viz, setViz] = useVisualizacaoOrcamentos();
  // Ordenação (reseta a cada abertura, NÃO persiste): { col, dir }
  // col: "cliente"|"tipo"|"criado"|"venc"|"status"|"total"   dir: "asc"|"desc"
  const [sort, setSort] = useState({ col: "cliente", dir: "asc" });
  // Filtros de coluna (multiselect): { clientes: Set, tipos: Set, status: Set }
  const [filtrosCol, setFiltrosCol] = useState({ clientes: new Set(), tipos: new Set(), status: new Set() });
  // Proposta sendo visualizada (modal visualizer de snapshot)
  const [propostaVisualizada, setPropostaVisualizada] = useState(null);
  // Orçamento selecionado para marcar como ganho (abre ModalConfirmarGanho)
  const [orcGanho, setOrcGanho] = useState(null);
  // Seleção em massa (tabela): Set de ids + modal de confirmação + modo ativável
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState(new Set());
  const [confirmExcluirMassa, setConfirmExcluirMassa] = useState(false);

  const orcamentos = data?.orcamentosProjeto || [];
  const clientes = data?.clientes || [];

  // Nota: expiração automática de propostas (30 dias) é feita pelo backend
  // via cron job (endpoint POST /admin/manutencao), todo dia às 3h da manhã.

  // Ações do dropdown do card
  async function handleOrcAction(acao, orc) {
    const todos = data.orcamentosProjeto || [];
    const agora = new Date().toISOString();

    // Guard: visualizador não chega aqui pela UI, mas defendemos caso algum código o chame
    if (perm.isVisualizador) {
      dialogo.alertar({ titulo: "Sem permissão", mensagem: "Você não tem permissão para esta ação.", tipo: "aviso" });
      return;
    }

    if (acao === "excluir") {
      if (!perm.podeExcluir) {
        dialogo.alertar({ titulo: "Acesso restrito", mensagem: "Apenas administradores podem excluir orçamentos.", tipo: "aviso" });
        return;
      }
      const ok = await dialogo.confirmar({
        titulo: `Excluir orçamento ${orc.id}?`,
        mensagem: "Esta ação não pode ser desfeita.",
        confirmar: "Excluir",
        destrutivo: true,
      });
      if (!ok) return;
      const novos = todos.filter(o => o.id !== orc.id);
      save({ ...data, orcamentosProjeto: novos }).catch(console.error);
      return;
    }

    if (acao === "perdido") {
      if (orc.status === "perdido") {
        // Se já está perdido, reabre pra rascunho
        const okR = await dialogo.confirmar({ titulo: "Reabrir este orçamento?", confirmar: "Reabrir" });
        if (!okR) return;
        const novos = todos.map(o => o.id === orc.id ? { ...o, status: "rascunho", concluidoEm: null } : o);
        save({ ...data, orcamentosProjeto: novos }).catch(console.error);
        return;
      }
      const okP = await dialogo.confirmar({
        titulo: `Marcar orçamento ${orc.id} como Perdido?`,
        confirmar: "Marcar como perdido",
      });
      if (!okP) return;
      const novos = todos.map(o =>
        o.id === orc.id
          ? { ...o, status: "perdido", concluidoEm: o.concluidoEm || agora }
          : o
      );
      save({ ...data, orcamentosProjeto: novos }).catch(console.error);
      return;
    }

    if (acao === "ganho") {
      if (orc.status === "ganho") return; // já ganho
      // Abre modal de confirmação com escopo, valores e condição de pagamento
      setOrcGanho(orc);
      return;
    }
  }

  // Exclui todos os orçamentos cujo id está em `selecionados`. Limpa a seleção
  // depois de salvar. O confirm modal já foi mostrado quem chama.
  async function excluirEmMassa() {
    if (!perm.podeExcluir) {
      dialogo.alertar({ titulo: "Acesso restrito", mensagem: "Apenas administradores podem excluir orçamentos.", tipo: "aviso" });
      setConfirmExcluirMassa(false);
      return;
    }
    const todos = data.orcamentosProjeto || [];
    const ids = selecionados; // Set
    const novos = todos.filter(o => !ids.has(o.id));
    setConfirmExcluirMassa(false);
    try {
      await save({ ...data, orcamentosProjeto: novos });
      setSelecionados(new Set());
    } catch (e) {
      console.error("Erro ao excluir em massa:", e);
    }
  }

  // Atualiza a probabilidade de um orçamento (chamado pelo ring do card/tabela)
  async function handleChangeProb(orc, novaProb) {
    if (!perm.podeEditar) return; // visualizador não edita probabilidade
    if (![25, 50, 75].includes(novaProb)) return;
    const todos = data.orcamentosProjeto || [];
    const novos = todos.map(o => o.id === orc.id ? { ...o, probabilidade: novaProb } : o);
    try {
      await save({ ...data, orcamentosProjeto: novos });
    } catch (e) {
      console.error("Erro ao atualizar probabilidade:", e);
    }
  }

  // Chamado quando o usuário confirma o modal de ganho com os dados fechados.
  // Estratégia otimista: fecha modal imediatamente (UX rápida), mostra toast de
  // sucesso, e deixa o save() rodar em background. Se falhar, toast de erro
  // alerta o usuário (raro — mas evita perda silenciosa).
  // Antes: setOrcGanho(null) acontecia DEPOIS do await save(), modal travava
  // 1-3 segundos esperando rede. Agora fecha em <16ms.
  async function confirmarGanho(ganhoData) {
    const orc = orcGanho;
    if (!orc) return;
    const todos = data.orcamentosProjeto || [];
    const agora = new Date().toISOString();

    // Cria projeto automaticamente (se ainda não existir)
    const projetosAtuais = data.projetos || [];
    const jaExiste = projetosAtuais.some(p => p.orcId === orc.id);
    const novosProjetos = jaExiste ? projetosAtuais : [
      ...projetosAtuais,
      {
        id: "PRJ-" + Date.now(),
        orcId: orc.id,
        clienteId: orc.clienteId,
        tipo: orc.tipo,
        subtipo: orc.subtipo,
        padrao: orc.padrao,
        tamanho: orc.tamanho,
        referencia: orc.referencia || "",
        areaTotal: orc.resultado?.areaTotal || 0,
        colunaEtapa: "briefing",
        criadoEm: agora,
      },
    ];

    // Atualiza o orçamento: status ganho + fechamento
    const novosOrc = todos.map(o =>
      o.id === orc.id
        ? {
            ...o,
            status: "ganho",
            concluidoEm: o.concluidoEm || agora,
            ganhoEm: o.ganhoEm || agora,
            fechamento: {
              ...ganhoData,
              fechadoEm: agora,
            },
          }
        : o
    );

    // Fecha modal e mostra toast IMEDIATAMENTE — não aguarda save()
    setOrcGanho(null);
    toast.sucesso("Orçamento marcado como ganho");

    // Save em background. Falha silenciosa via toast de erro.
    save({ ...data, orcamentosProjeto: novosOrc, projetos: novosProjetos })
      .catch(e => {
        console.error("Erro ao salvar orçamento ganho:", e);
        toast.erro("Erro ao salvar — tente novamente");
      });
  }

  async function salvarOrcamento(orc) {
    const todos = data.orcamentosProjeto || [];
    const nextId = () => {
      const max = todos.reduce((mx, o) => {
        const m = (o.id || "").match(/^ORC-(\d+)$/);
        return m ? Math.max(mx, parseInt(m[1])) : mx;
      }, 0);
      return "ORC-" + String(max + 1).padStart(4, "0");
    };
    const novo = {
      ...orc,
      id: orc.id || nextId(),
      criadoEm: orc.criadoEm || new Date().toISOString(),
      clienteId: orc.clienteId || clienteAtivo?.id || null,
      status: orc.status || "rascunho",
    };
    setOrcBase(novo);
    const novos = orc.id ? todos.map(o => o.id === orc.id ? novo : o) : [...todos, novo];

    // Reativação automática: se o cliente está inativo e está criando novo orçamento,
    // reativa automaticamente (cliente voltou a ser ativo).
    let clientesAtualizados = data.clientes || [];
    const cliId = novo.clienteId;
    if (cliId && !orc.id) { // só em novos orçamentos
      const cli = clientesAtualizados.find(c => c.id === cliId);
      if (cli && cli.ativo === false) {
        const dataFmt = new Date().toLocaleDateString("pt-BR");
        const marcador = `[${dataFmt}] Cliente reativado automaticamente ao iniciar novo orçamento.`;
        const obs = cli.observacoes || "";
        clientesAtualizados = clientesAtualizados.map(c => c.id === cliId ? {
          ...c,
          ativo: true,
          inativadoEm: null,
          inativadoAutomaticamente: false,
          observacoes: obs ? `${obs}\n\n${marcador}` : marcador,
        } : c);
      }
    }

    save({ ...data, orcamentosProjeto: novos, clientes: clientesAtualizados }).catch(console.error);
  }

  function abrirNovoOrcamento(cliente) {
    setClienteAtivo(cliente);
    setOrcBase(null);
    setModalNovoAberto(false);
    setBuscaCliente("");
  }

  const [modoAbertura, setModoAbertura] = useState(null); // "ver" | "editar" | null

  function abrirOrcamentoExistente(orc, modo = "ver") {
    // Se clicou em "ver" e o orçamento tem proposta enviada, abre o snapshot
    // em vez do formulário de edição. Para editar, o usuário usa outra ação.
    if (modo === "ver" && orc.propostas && orc.propostas.length > 0) {
      modo = "verProposta";
    }
    // Modo "verProposta": abre o visualizador de snapshot (modal com imagens)
    if (modo === "verProposta") {
      const ultima = orc.propostas && orc.propostas.length > 0
        ? orc.propostas[orc.propostas.length - 1]
        : null;
      if (ultima) {
        const cli = clientes.find(c => c.id === orc.clienteId);
        setPropostaVisualizada({
          ...ultima,
          clienteNome: cli?.nome || orc.cliente || "Cliente",
          _orcOrigem: orc, // guarda referência pra botão Editar
        });
        return;
      }
      // Se não tem proposta, cai no fluxo normal de "ver"
      modo = "ver";
    }
    const cli = clientes.find(c => c.id === orc.clienteId) || { nome: orc.cliente || "Cliente" };
    setClienteAtivo(cli);
    setOrcBase(orc);
    setModoAbertura(modo);
  }

  function voltarParaLista() {
    setOrcBase(null);
    setClienteAtivo(null);
    setModoAbertura(null);
  }

  // Se um orçamento está aberto (novo ou editando), mostra o formulário
  if (clienteAtivo) {
    return (
      <FormOrcamentoProjetoTeste
        clienteNome={clienteAtivo.nome || "Cliente"}
        clienteWA={clienteAtivo.whatsapp || clienteAtivo.telefone || ""}
        orcBase={orcBase}
        onSalvar={salvarOrcamento}
        onVoltar={voltarParaLista}
        modoAbertura={modoAbertura}
        escritorio={data?.escritorio || {}}
      />
    );
  }

  // ─── Lista principal ───
  const totalContadores = {
    rascunho: orcamentos.filter(o => (o.status || "rascunho") === "rascunho").length,
    aberto:   orcamentos.filter(o => o.status === "aberto").length,
    ganho:    orcamentos.filter(o => o.status === "ganho").length,
    perdido:  orcamentos.filter(o => o.status === "perdido").length,
  };
  const totalTodos = orcamentos.length;
  const totalAtivos = totalTodos - totalContadores.perdido;

  // Helper: valor Total do orçamento (usa proposta salva se existir)
  const valorTotalOrc = (o) => {
    const ult = o.propostas && o.propostas.length > 0 ? o.propostas[o.propostas.length - 1] : null;
    if (ult) {
      if (ult.valorTotalExibido != null) return ult.valorTotalExibido;
      const arq = ult.arqEdit != null ? ult.arqEdit : (ult.calculo?.precoArq || 0);
      const eng = ult.engEdit != null ? ult.engEdit : (ult.calculo?.precoEng || 0);
      return arq + eng;
    }
    return (o.resultado?.precoArq || 0) + (o.resultado?.precoEng || 0);
  };

  // Helper: dias até vencer (null se não aplicável). Negativo = já vencido.
  const diasParaVencer = (o) => {
    if ((o.status || "rascunho") !== "aberto") return null;
    const ult = o.propostas && o.propostas.length > 0 ? o.propostas[o.propostas.length - 1] : null;
    const v = ult?.validadeEdit || ult?.validadeStr;
    if (!v) return null;
    const m = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const validade = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
    const hoje = new Date(); hoje.setHours(0,0,0,0); validade.setHours(0,0,0,0);
    return Math.round((validade - hoje) / 86400000);
  };

  const orcFiltrados = orcamentos.filter(o => {
    const st = o.status || "rascunho";
    if (filtro === "ativos"   && st === "perdido") return false;
    if (filtro === "rascunho" && st !== "rascunho") return false;
    if (filtro === "aberto"   && st !== "aberto") return false;
    if (filtro === "ganho"    && st !== "ganho") return false;
    if (filtro === "perdido"  && st !== "perdido") return false;
    if (busca) {
      const cli = clientes.find(c => c.id === o.clienteId);
      const nomeCli = (cli?.nome || o.cliente || "").toLowerCase();
      const ref = (o.referencia || "").toLowerCase();
      const q = busca.toLowerCase();
      if (!nomeCli.includes(q) && !ref.includes(q)) return false;
    }
    // Filtros de coluna (multiselect — vazio = todos)
    if (filtrosCol.clientes.size > 0) {
      const cli = clientes.find(c => c.id === o.clienteId);
      const nomeCli = cli?.nome || o.cliente || "—";
      if (!filtrosCol.clientes.has(nomeCli)) return false;
    }
    if (filtrosCol.tipos.size > 0) {
      if (!filtrosCol.tipos.has(o.tipo || "—")) return false;
    }
    if (filtrosCol.status.size > 0) {
      if (!filtrosCol.status.has(st)) return false;
    }
    return true;
  });

  // Ordenação
  const orcOrdenados = [...orcFiltrados].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const aCli = (clientes.find(c => c.id === a.clienteId)?.nome || a.cliente || "").toLowerCase();
    const bCli = (clientes.find(c => c.id === b.clienteId)?.nome || b.cliente || "").toLowerCase();
    if (sort.col === "id") {
      // Extrai número do ORC-NNNN pra ordenar numericamente
      const num = (id) => { const m = String(id || "").match(/(\d+)/); return m ? parseInt(m[1]) : 0; };
      return (num(a.id) - num(b.id)) * dir;
    }
    if (sort.col === "cliente") {
      // Desempate por referência para clientes iguais
      if (aCli !== bCli) return aCli.localeCompare(bCli, "pt-BR") * dir;
      return (a.referencia || "").localeCompare(b.referencia || "", "pt-BR") * dir;
    }
    if (sort.col === "tipo") {
      const aT = (a.tipo || "").toLowerCase();
      const bT = (b.tipo || "").toLowerCase();
      if (aT !== bT) return aT.localeCompare(bT, "pt-BR") * dir;
      return ((a.resultado?.areaTotal || 0) - (b.resultado?.areaTotal || 0)) * dir;
    }
    if (sort.col === "criado") {
      const aD = a.criadoEm ? new Date(a.criadoEm).getTime() : 0;
      const bD = b.criadoEm ? new Date(b.criadoEm).getTime() : 0;
      return (aD - bD) * dir;
    }
    if (sort.col === "venc") {
      // Ordem: vencidos → próximos → distantes → não aplicáveis (sempre no fim)
      const aV = diasParaVencer(a);
      const bV = diasParaVencer(b);
      if (aV == null && bV == null) return aCli.localeCompare(bCli, "pt-BR");
      if (aV == null) return 1;
      if (bV == null) return -1;
      return (aV - bV) * dir;
    }
    if (sort.col === "followup") {
      // Ordem: atrasados → próximos → distantes → não aplicáveis (sempre no fim)
      const aF = calcFollowUp(a);
      const bF = calcFollowUp(b);
      if (!aF.aplicavel && !bF.aplicavel) return aCli.localeCompare(bCli, "pt-BR");
      if (!aF.aplicavel) return 1;
      if (!bF.aplicavel) return -1;
      return ((aF.diasRestantes || 0) - (bF.diasRestantes || 0)) * dir;
    }
    if (sort.col === "prob") {
      const aP = getProbOrc(a);
      const bP = getProbOrc(b);
      if (aP == null && bP == null) return aCli.localeCompare(bCli, "pt-BR");
      if (aP == null) return 1;
      if (bP == null) return -1;
      return (aP - bP) * dir;
    }
    if (sort.col === "status") {
      const ordem = { aberto: 0, rascunho: 1, ganho: 2, perdido: 3 };
      const aS = ordem[a.status || "rascunho"] ?? 99;
      const bS = ordem[b.status || "rascunho"] ?? 99;
      return (aS - bS) * dir;
    }
    if (sort.col === "total") {
      return (valorTotalOrc(a) - valorTotalOrc(b)) * dir;
    }
    return 0;
  });

  // Clientes filtrados no modal de novo
  const clientesFiltrados = buscaCliente.trim()
    ? clientes.filter(c => {
        const q = buscaCliente.toLowerCase();
        return (c.nome || "").toLowerCase().includes(q) ||
               (c.telefone || "").includes(q) ||
               (c.whatsapp || "").includes(q);
      })
    : clientes.slice(0, 20);

  return (
    <div style={{
      background:"#fff",
      minHeight:"100vh",
      padding:"28px 32px 60px",
      fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif",
    }}>
      <div style={{ maxWidth:1100, width:"100%" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, marginBottom:20 }}>
        <div>
          <h2 style={{ color:"#111", fontWeight:700, fontSize:22, margin:0, letterSpacing:-0.5 }}>Orçamentos</h2>
          <div style={{ color:"#9ca3af", fontSize:13, marginTop:4 }}>Lista de todos os orçamentos do escritório</div>
        </div>
        {perm.podeEditar && (
        <button
          onClick={() => setModalNovoAberto(true)}
          style={{
            background:"#111", color:"#fff", border:"1px solid #111",
            borderRadius:7, padding:"8px 14px", fontSize:13, fontWeight:500,
            cursor:"pointer", fontFamily:"inherit",
          }}>
          + Novo Orçamento
        </button>
        )}
      </div>

      {/* Toolbar: filtros + busca + visualização */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12, flexWrap:"wrap" }}>
        <OrcFilterPill label="Ativos"    count={totalAtivos}              active={filtro==="ativos"}   onClick={()=>setFiltro("ativos")} />
        <OrcFilterPill label="Todos"     count={totalTodos}               active={filtro==="todos"}    onClick={()=>setFiltro("todos")} countColor="#9ca3af" />
        <OrcFilterPill label="Rascunho"  count={totalContadores.rascunho} active={filtro==="rascunho"} onClick={()=>setFiltro("rascunho")} countColor="#6b7280" />
        <OrcFilterPill label="Em aberto" count={totalContadores.aberto}   active={filtro==="aberto"}   onClick={()=>setFiltro("aberto")}   countColor="#2563eb" />
        <OrcFilterPill label="Ganhos"    count={totalContadores.ganho}    active={filtro==="ganho"}    onClick={()=>setFiltro("ganho")}    countColor="#16a34a" />
        <OrcFilterPill label="Perdidos"  count={totalContadores.perdido}  active={filtro==="perdido"}  onClick={()=>setFiltro("perdido")}  countColor="#b91c1c" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar cliente ou referência…"
          style={{
            flex:1, maxWidth:260, padding:"6px 12px",
            border:"1px solid #e5e7eb", borderRadius:6,
            fontSize:12.5, color:"#111", background:"#fff",
            fontFamily:"inherit", outline:"none",
          }}
        />
        {viz === "cards" && <SortDropdown sort={sort} setSort={setSort} />}
        <ToggleVisualizacao viz={viz} setViz={setViz} />
      </div>

      {/* Chips de filtros ativos (aparecem quando há filtros de coluna aplicados) */}
      {(filtrosCol.clientes.size > 0 || filtrosCol.tipos.size > 0 || filtrosCol.status.size > 0) && (
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:12 }}>
          {[...filtrosCol.clientes].map(v => (
            <FiltroChip key={"c-"+v} label={`Cliente: ${v}`} onRemove={() => {
              const n = new Set(filtrosCol.clientes); n.delete(v);
              setFiltrosCol({ ...filtrosCol, clientes: n });
            }} />
          ))}
          {[...filtrosCol.tipos].map(v => (
            <FiltroChip key={"t-"+v} label={`Tipo: ${v}`} onRemove={() => {
              const n = new Set(filtrosCol.tipos); n.delete(v);
              setFiltrosCol({ ...filtrosCol, tipos: n });
            }} />
          ))}
          {[...filtrosCol.status].map(v => (
            <FiltroChip key={"s-"+v} label={`Status: ${({rascunho:"Rascunho",aberto:"Em aberto",ganho:"Ganho",perdido:"Perdido"}[v] || v)}`} onRemove={() => {
              const n = new Set(filtrosCol.status); n.delete(v);
              setFiltrosCol({ ...filtrosCol, status: n });
            }} />
          ))}
          <button
            onClick={() => setFiltrosCol({ clientes: new Set(), tipos: new Set(), status: new Set() })}
            style={{
              fontSize:11.5, color:"#6b7280", background:"transparent",
              border:"none", cursor:"pointer", padding:"3px 6px",
              textDecoration:"underline", fontFamily:"inherit",
            }}>
            Limpar filtros
          </button>
        </div>
      )}

      {/* Barra de ações em massa (aparece enquanto o modo seleção está ligado) */}
      {viz === "tabela" && modoSelecao && (
        <BarraSelecao
          selecionados={selecionados}
          totalVisivel={orcOrdenados.length}
          onSelecionarTodos={() => setSelecionados(new Set(orcOrdenados.map(o => o.id)))}
          onLimpar={() => setSelecionados(new Set())}
          onExcluir={() => setConfirmExcluirMassa(true)}
          onSair={() => { setSelecionados(new Set()); setModoSelecao(false); }}
        />
      )}

      {/* Lista */}
      <div style={{ maxWidth:1100 }}>
        {orcOrdenados.length === 0 ? (
          <div style={{
            padding:"48px 24px", textAlign:"center",
            border:"1px dashed #e5e7eb", borderRadius:9, background:"#fafafa",
            color:"#9ca3af", fontSize:13,
          }}>
            {orcamentos.length === 0
              ? "Nenhum orçamento cadastrado ainda. Clique em + Novo Orçamento para começar."
              : "Nenhum orçamento corresponde aos filtros."}
          </div>
        ) : viz === "tabela" ? (
          <div style={{ border:"1px solid #e5e7eb", borderRadius:9, background:"#fff", overflow:"visible" }}>
            <OrcRowHeader
              showCliente={true}
              sort={sort} setSort={setSort}
              filtrosCol={filtrosCol} setFiltrosCol={setFiltrosCol}
              orcamentos={orcamentos} clientes={clientes}
              modoSelecao={modoSelecao}
              onToggleModoSelecao={perm.podeExcluir ? (() => {
                // Ativa o modo. Desativação acontece via "Limpar" na barra ou via
                // "Sair da seleção" caso nenhum esteja marcado (ver abaixo).
                setModoSelecao(true);
              }) : null}
              selecionados={selecionados}
              totalVisivel={orcOrdenados.length}
              onToggleTodos={() => {
                if (selecionados.size >= orcOrdenados.length) setSelecionados(new Set());
                else setSelecionados(new Set(orcOrdenados.map(o => o.id)));
              }}
            />
            {orcOrdenados.map(orc => (
              <OrcRow
                key={orc.id} orc={orc} clientes={clientes}
                onAbrir={(modo) => abrirOrcamentoExistente(orc, modo)}
                onAction={handleOrcAction}
                showCliente={true}
                modoSelecao={modoSelecao}
                selecionado={selecionados.has(orc.id)}
                onToggleSelecao={(id) => {
                  const n = new Set(selecionados);
                  if (n.has(id)) n.delete(id); else n.add(id);
                  setSelecionados(n);
                }}
                onChangeProb={handleChangeProb}
                perm={perm}
              />
            ))}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:10 }}>
            {orcOrdenados.map(orc => (
              <OrcCard
                key={orc.id} orc={orc} clientes={clientes}
                onAbrir={(modo) => abrirOrcamentoExistente(orc, modo)}
                onAction={handleOrcAction}
                onChangeProb={handleChangeProb}
                perm={perm}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal confirmar exclusão em massa */}
      {confirmExcluirMassa && (
        <ModalConfirmarExclusaoMassa
          orcs={orcamentos.filter(o => selecionados.has(o.id))}
          clientes={clientes}
          onConfirmar={async () => { await excluirEmMassa(); setModoSelecao(false); }}
          onCancelar={() => setConfirmExcluirMassa(false)}
        />
      )}

      {/* Modal Novo Orçamento */}
      {modalNovoAberto && (
        <ModalNovoOrcamento
          clientes={clientesFiltrados}
          busca={buscaCliente}
          setBusca={setBuscaCliente}
          onSelecionar={abrirNovoOrcamento}
          onFechar={() => { setModalNovoAberto(false); setBuscaCliente(""); }}
          onCadastrarNovo={() => {
            setModalNovoAberto(false);
            setBuscaCliente("");
            if (onCadastrarCliente) onCadastrarCliente();
          }}
        />
      )}

      {/* Visualizador de proposta enviada (snapshot de imagens) */}
      {propostaVisualizada && (
        <PropostaVisualizer
          proposta={propostaVisualizada}
          onFechar={() => setPropostaVisualizada(null)}
          onEditar={() => {
            const orc = propostaVisualizada._orcOrigem;
            if (!orc) return;
            setPropostaVisualizada(null);
            const cli = clientes.find(c => c.id === orc.clienteId) || { nome: orc.cliente || "Cliente" };
            setClienteAtivo(cli);
            setOrcBase(orc);
            setModoAbertura("editar");
          }}
        />
      )}

      {/* Modal de confirmação de ganho */}
      {orcGanho && (
        <ModalConfirmarGanho
          orc={orcGanho}
          onClose={() => setOrcGanho(null)}
          onConfirmar={confirmarGanho}
        />
      )}
      </div>
    </div>
  );
}

// ─── Pill de filtro ──────────────────────────────
function OrcFilterPill({ label, count, active, onClick, countColor }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize:12, color: active ? "#111" : "#6b7280",
        border:"1px solid " + (active ? "#111" : "#e5e7eb"),
        borderRadius:20, padding:"5px 12px",
        background: active ? "#f9fafb" : "#fff",
        cursor:"pointer", fontFamily:"inherit",
        display:"flex", alignItems:"center", gap:5,
      }}>
      {label}
      {count > 0 && (
        <strong style={{ marginLeft:4, color: countColor || "#111", fontWeight:600 }}>{count}</strong>
      )}
    </button>
  );
}

// ─── Helper: calcula o status de vencimento de um orçamento ───────────────
// Retorna { label, cor, aplicavel } para exibição nas colunas "Venc." da lista.
// Vencimento só se aplica a orçamentos com proposta enviada e em aberto.
// Rascunho, Ganho e Perdido retornam aplicavel=false.
function calcVencimentoOrc(orc) {
  const status = orc.status || "rascunho";
  // Só faz sentido mostrar vencimento pra orçamentos "Em aberto" (proposta enviada, aguardando resposta)
  if (status !== "aberto") {
    return { label: "—", cor: "#d1d5db", aplicavel: false };
  }
  // Busca a data de validade na última proposta. Formato salvo: "dd/mm/yyyy" (string editável).
  const ultProp = orc.propostas && orc.propostas.length > 0
    ? orc.propostas[orc.propostas.length - 1]
    : null;
  const validadeStr = ultProp?.validadeEdit || ultProp?.validadeStr;
  if (!validadeStr) {
    return { label: "—", cor: "#d1d5db", aplicavel: false };
  }
  // Parse "dd/mm/yyyy"
  const m = String(validadeStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) {
    return { label: "—", cor: "#d1d5db", aplicavel: false };
  }
  const validade = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  validade.setHours(0, 0, 0, 0);
  const msPorDia = 86400000;
  const dias = Math.round((validade - hoje) / msPorDia);

  if (dias < 0) {
    return { label: "Vencido", cor: "#b91c1c", bold: true, aplicavel: true };
  }
  if (dias === 0) {
    return { label: "Vence hoje", cor: "#b91c1c", bold: true, aplicavel: true };
  }
  if (dias <= 7) {
    return { label: `${dias} ${dias === 1 ? "dia" : "dias"}`, cor: "#b91c1c", bold: false, aplicavel: true };
  }
  return { label: `${dias} dias`, cor: "#6b7280", bold: false, aplicavel: true };
}

// ─── Follow-up (data de retomar contato, 7 dias após envio da proposta) ───
// Regra: orçamento precisa estar em "aberto" + ter proposta enviada.
// Retorna { aplicavel, label, cor, bold, diasRestantes, dataAlvo }
function calcFollowUp(orc) {
  const status = orc.status || "rascunho";
  if (status !== "aberto") return { aplicavel: false, label: "—", cor: "#d1d5db" };
  const ultProp = orc.propostas && orc.propostas.length > 0
    ? orc.propostas[orc.propostas.length - 1]
    : null;
  if (!ultProp || !ultProp.enviadaEm) {
    return { aplicavel: false, label: "—", cor: "#d1d5db" };
  }
  const enviada = new Date(ultProp.enviadaEm);
  if (isNaN(enviada.getTime())) return { aplicavel: false, label: "—", cor: "#d1d5db" };
  const alvo = new Date(enviada);
  alvo.setDate(alvo.getDate() + 7);
  alvo.setHours(0, 0, 0, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const msPorDia = 86400000;
  const dias = Math.round((alvo - hoje) / msPorDia);
  const dataStr = alvo.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");

  if (dias < 0) {
    const atraso = Math.abs(dias);
    return {
      aplicavel: true,
      label: `atrasado ${atraso}d`,
      cor: "#b91c1c", bold: true, diasRestantes: dias, dataAlvo: alvo,
    };
  }
  if (dias === 0) {
    return { aplicavel: true, label: "hoje", cor: "#b45309", bold: true, diasRestantes: 0, dataAlvo: alvo };
  }
  if (dias === 1) {
    return { aplicavel: true, label: "amanhã", cor: "#b45309", bold: false, diasRestantes: 1, dataAlvo: alvo };
  }
  return { aplicavel: true, label: dataStr, cor: "#6b7280", bold: false, diasRestantes: dias, dataAlvo: alvo };
}

// ─── Probabilidade de fechamento (só em "Em aberto") ─────────────────────
// Retorna um dos 3 valores válidos: 25, 50, 75. Default = 50.
function getProbOrc(orc) {
  const status = orc.status || "rascunho";
  if (status !== "aberto") return null;
  const v = orc.probabilidade;
  if (v === 25 || v === 50 || v === 75) return v;
  return 50;
}

// Cores por nível de probabilidade
const PROB_COLORS = {
  25: { ring: "#d97706", bg: "#fef3c7", text: "#92400e" },
  50: { ring: "#4f46e5", bg: "#e0e7ff", text: "#3730a3" },
  75: { ring: "#16a34a", bg: "#dcfce7", text: "#166534" },
};

// Paleta S2: tags de status monocromático (slate)
const STATUS_STYLES_S2 = {
  rascunho: { label: "Rascunho",  bg: "#f1f5f9", color: "#94a3b8", border: "transparent" },
  aberto:   { label: "Em aberto", bg: "#dbeafe", color: "#1e40af", border: "transparent" },
  ganho:    { label: "Ganho",     bg: "#334155", color: "#ffffff", border: "transparent" },
  perdido:  { label: "Perdido",   bg: "#f8fafc", color: "#cbd5e1", border: "#e2e8f0" },
};

// Paleta P4: dots de serviços (slate 3 tons)
const SERVICO_DOT_COLORS = {
  arq: "#334155", // slate-700
  eng: "#64748b", // slate-500
  mar: "#94a3b8", // slate-400
};

// ─── Componente: ring de probabilidade (SVG circular com % no centro) ───
function ProbRing({ prob, size = 32, onChange = null }) {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e) => { if (!e.target.closest("[data-prob-ring]")) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  const cores = PROB_COLORS[prob] || PROB_COLORS[50];
  const stroke = 3;
  const r = (size / 2) - stroke;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - (prob / 100));
  const cx = size / 2;
  const fontSize = size >= 36 ? 10.5 : 9.5;
  const clickable = typeof onChange === "function";

  return (
    <div data-prob-ring style={{ position: "relative", display: "inline-block" }}>
      <div
        onClick={(e) => {
          if (!clickable) return;
          e.stopPropagation();
          setMenuOpen(v => !v);
        }}
        title={`${prob}% de probabilidade${clickable ? " — clique para alterar" : ""}`}
        style={{
          position: "relative",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: size, height: size, flexShrink: 0,
          cursor: clickable ? "pointer" : "default",
        }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
          <circle
            cx={cx} cy={cx} r={r} fill="none"
            stroke={cores.ring} strokeWidth={stroke}
            strokeDasharray={c} strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cx})`}
            strokeLinecap="round"
          />
        </svg>
        <span style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 700, letterSpacing: -0.3,
          fontSize, color: cores.ring,
        }}>
          {prob}%
        </span>
      </div>
      {menuOpen && clickable && (
        <div style={{
          position: "absolute", left: 0, top: `calc(100% + 6px)`, zIndex: 60,
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)", minWidth: 100, overflow: "hidden",
        }}>
          <div style={{ padding: "6px 10px 4px", fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Probabilidade
          </div>
          {[25, 50, 75].map(v => {
            const vc = PROB_COLORS[v];
            const sel = v === prob;
            return (
              <button key={v}
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onChange && onChange(v); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", textAlign: "left",
                  background: sel ? "#f4f5f7" : "transparent",
                  border: "none",
                  padding: "7px 12px", fontSize: 12.5,
                  color: "#111", fontFamily: "inherit",
                  cursor: "pointer",
                  fontWeight: sel ? 600 : 400,
                }}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "#fafbfc"; }}
                onMouseLeave={e => { if (!sel) e.currentTarget.style.background = "transparent"; }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: vc.ring }} />
                {v}%
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Componente: linha de dots de serviços (Arq · Eng · Marc) ──────────
function ServicosDots({ orc, textColor = "#6b7280", sepColor = "#d1d5db" }) {
  const items = [];
  if (orc.incluiArq)        items.push({ key: "arq", label: "Arq",  color: SERVICO_DOT_COLORS.arq });
  if (orc.incluiEng)        items.push({ key: "eng", label: "Eng",  color: SERVICO_DOT_COLORS.eng });
  if (orc.incluiMarcenaria) items.push({ key: "mar", label: "Marc", color: SERVICO_DOT_COLORS.mar });
  if (items.length === 0)   items.push({ key: "arq", label: "Arq",  color: SERVICO_DOT_COLORS.arq }); // fallback
  const nodes = [];
  items.forEach((it, i) => {
    if (i > 0) {
      nodes.push(<span key={`sep-${it.key}`} style={{ color: sepColor, margin: "0 2px" }}>·</span>);
    }
    nodes.push(
      <span key={`dot-${it.key}`} style={{
        display: "inline-block", width: 5, height: 5, borderRadius: "50%",
        background: it.color,
      }} />
    );
    nodes.push(<span key={`lbl-${it.key}`}>{it.label}</span>);
  });
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: textColor }}>
      {nodes}
    </span>
  );
}

// ─── Card de orçamento na lista ──────────────────
function OrcCard({ orc, clientes, onAbrir, onAction, onChangeProb, perm }) {
  const cliente = clientes.find(c => c.id === orc.clienteId);
  const nomeCliente = cliente?.nome || orc.cliente || "—";
  const status = orc.status || "rascunho";
  const area = orc.resultado?.areaTotal || 0;
  const [menuOpen, setMenuOpen] = useState(false);
  // Fallback defensivo: se perm não foi passado (componente usado em outro lugar), busca agora
  if (!perm) perm = getPermissoes();

  // Fecha menu ao clicar fora
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (!e.target.closest(`[data-orc-menu="${orc.id}"]`)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen, orc.id]);

  // Valor total: usa última proposta se existir, senão resultado do cálculo base
  const ultimaProposta = orc.propostas && orc.propostas.length > 0
    ? orc.propostas[orc.propostas.length - 1]
    : null;
  let valorTotal;
  if (ultimaProposta) {
    if (ultimaProposta.valorTotalExibido != null) {
      valorTotal = ultimaProposta.valorTotalExibido;
    } else {
      const arq = ultimaProposta.arqEdit != null ? ultimaProposta.arqEdit : (ultimaProposta.calculo?.precoArq || 0);
      const eng = ultimaProposta.engEdit != null ? ultimaProposta.engEdit : (ultimaProposta.calculo?.precoEng || 0);
      valorTotal = arq + eng;
    }
  } else {
    valorTotal = (orc.resultado?.precoArq || 0) + (orc.resultado?.precoEng || 0);
  }

  const tipo = orc.tipo || "—";
  const ref = orc.referencia || "";
  const refEmpty = !orc.referencia;

  const tag = STATUS_STYLES_S2[status] || STATUS_STYLES_S2.rascunho;
  const venc = calcVencimentoOrc(orc);
  const follow = calcFollowUp(orc);
  const prob = getProbOrc(orc);
  const mostrarRing = status === "aberto" && prob != null;
  const mostrarLinhaPrazos = status === "aberto" && (venc.aplicavel || follow.aplicavel);

  return (
    <div
      onClick={() => onAbrir("ver")}
      style={{
        background:"#fafbfc", border:"1px solid #eef0f3", borderRadius:10,
        padding:"13px 14px",
        transition:"all 0.12s", cursor:"pointer",
        display:"flex", flexDirection:"column", gap:9,
        minWidth:0,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#d1d5db"; e.currentTarget.style.background = "#fff"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#eef0f3"; e.currentTarget.style.background = "#fafbfc"; }}
    >
      {/* Head: Ring (se aberto) | Nome + Ref | Valor + Tipo/Área */}
      <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
        {mostrarRing && (
          <div onClick={e => e.stopPropagation()}>
            <ProbRing
              prob={prob}
              size={32}
              onChange={onChangeProb ? (v) => onChangeProb(orc, v) : null}
            />
          </div>
        )}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{
            fontSize:13.5, fontWeight:600, color:"#111",
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          }}>
            {nomeCliente}
          </div>
          <div style={{
            fontSize:11.5,
            color: refEmpty ? "#9ca3af" : "#6b7280",
            fontStyle: refEmpty ? "italic" : "normal",
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          }}>
            {refEmpty ? "sem referência" : ref}
          </div>
        </div>
        <div style={{
          display:"flex", flexDirection:"column", alignItems:"flex-end", gap:2,
          flexShrink:0,
        }}>
          {valorTotal > 0 && (
            <div style={{
              fontSize:14.5, fontWeight:600, color:"#111",
              fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap",
            }}>
              R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits:0, maximumFractionDigits:0 })}
            </div>
          )}
          <div style={{ fontSize:10, color:"#9ca3af", whiteSpace:"nowrap" }}>
            {tipo}{area > 0 ? ` · ${area.toLocaleString("pt-BR")}m²` : ""}
          </div>
        </div>
      </div>

      {/* Linha de prazos (só em aberto) */}
      {mostrarLinhaPrazos && (
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", fontSize:11 }}>
          {venc.aplicavel && (
            <span style={{
              display:"inline-flex", alignItems:"center", gap:4,
              padding:"2px 7px", borderRadius:10,
              fontSize:10.5, fontWeight: venc.bold ? 600 : 500,
              background: venc.cor === "#b91c1c" ? "#fef2f2" : "#f3f4f6",
              color: venc.cor,
            }}>
              ⏱ {venc.label === "Vencido" || venc.label === "Vence hoje"
                ? venc.label
                : `Vence em ${venc.label}`}
            </span>
          )}
          {follow.aplicavel && (
            <span style={{
              display:"inline-flex", alignItems:"center", gap:4,
              fontSize:10.5, fontWeight: follow.bold ? 600 : 500,
              color: follow.cor,
            }}>
              📞 Follow-up: {follow.label}
            </span>
          )}
        </div>
      )}

      {/* Footer: ID · Status · Dots | badge proposta | menu ⋯ */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        gap:8, paddingTop:8, borderTop:"0.5px solid #eef0f3",
        minHeight:22,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", fontSize:11, color:"#6b7280" }}>
          <span style={{
            fontSize:10, color:"#9ca3af",
            fontVariantNumeric:"tabular-nums",
            background:"#eef0f3", padding:"1px 6px", borderRadius:4, fontWeight:500,
          }}>{orc.id}</span>
          <span style={{
            fontSize:9.5, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5,
            padding:"2px 6px", borderRadius:4,
            background: tag.bg, color: tag.color,
            border: tag.border !== "transparent" ? `0.5px solid ${tag.border}` : "none",
          }}>{tag.label}</span>
          <ServicosDots orc={orc} />
          {orc.propostas && orc.propostas.length > 1 && !orc.expirouEm && (
            <span
              onClick={(e) => { e.stopPropagation(); onAbrir("verProposta"); }}
              title="Ver última proposta enviada"
              style={{
                fontSize:9.5, fontWeight:700,
                color:"#16a34a", background:"#dcfce7",
                padding:"1px 6px", borderRadius:4,
                fontVariantNumeric:"tabular-nums", cursor:"pointer",
              }}>
              v{orc.propostas.length}
            </span>
          )}
          {orc.expirouEm && (
            <span
              onClick={(e) => { e.stopPropagation(); onAbrir("verProposta"); }}
              style={{
                fontSize:10, color:"#b91c1c", fontWeight:500, cursor:"pointer",
              }}>
              ⚠ Proposta expirou
            </span>
          )}
        </div>

        {!perm.isVisualizador && (
        <div onClick={e => e.stopPropagation()}>
          <div style={{ position:"relative" }} data-orc-menu={orc.id}>
            <button onClick={() => setMenuOpen(v => !v)}
              style={{
                background:"transparent", border:"none",
                fontSize:16, color:"#9ca3af", padding:"2px 8px",
                cursor:"pointer", borderRadius:4, fontFamily:"inherit", lineHeight:1,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#eef0f3"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
              ⋯
            </button>
            {menuOpen && (
              <div style={{
                position:"absolute", right:0, top:"calc(100% + 4px)", zIndex:999,
                background:"#fff", border:"1px solid #e5e7eb", borderRadius:8,
                boxShadow:"0 4px 16px rgba(0,0,0,0.1)",
                overflow:"hidden",
              }}>
                <button
                  disabled={status === "ganho"}
                  onClick={() => { setMenuOpen(false); onAction && onAction("ganho", orc); }}
                  style={{
                    display:"block", width:"100%", textAlign:"left",
                    background: status === "ganho" ? "#f0fdf4" : "transparent",
                    border:"none",
                    color: status === "ganho" ? "#16a34a" : "#374151",
                    padding:"7px 14px 7px 12px", fontSize:12.5,
                    cursor: status === "ganho" ? "not-allowed" : "pointer",
                    fontFamily:"inherit",
                    fontWeight: status === "ganho" ? 600 : 400,
                    whiteSpace:"nowrap",
                  }}>
                  {status === "ganho" ? "✓ Ganho" : "Ganho"}
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onAction && onAction("perdido", orc); }}
                  style={{
                    display:"block", width:"100%", textAlign:"left",
                    background: status === "perdido" ? "#fef2f2" : "transparent",
                    border:"none",
                    color: status === "perdido" ? "#dc2626" : "#374151",
                    padding:"7px 14px 7px 12px", fontSize:12.5, cursor:"pointer",
                    fontFamily:"inherit",
                    fontWeight: status === "perdido" ? 600 : 400,
                    whiteSpace:"nowrap",
                  }}>
                  {status === "perdido" ? "✓ Perdido" : "Perdido"}
                </button>
                {perm.podeExcluir && (
                <button
                  onClick={() => { setMenuOpen(false); onAction && onAction("excluir", orc); }}
                  style={{
                    display:"block", width:"100%", textAlign:"left",
                    background:"transparent", border:"none",
                    color:"#dc2626", padding:"7px 14px 7px 12px", fontSize:12.5,
                    cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap",
                  }}>
                  Excluir
                </button>
                )}
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

// ─── Toggle Tabela/Cards (persiste escolha no localStorage) ───────────────
// Uso: const [viz, setViz] = useVisualizacaoOrcamentos();
//      <ToggleVisualizacao viz={viz} setViz={setViz} />
const VIZ_STORAGE_KEY = "vicke:orcamentos:view";

function useVisualizacaoOrcamentos() {
  const [viz, setVizState] = useState(() => {
    try {
      const v = localStorage.getItem(VIZ_STORAGE_KEY);
      return (v === "tabela" || v === "cards") ? v : "cards";
    } catch { return "cards"; }
  });
  const setViz = (v) => {
    setVizState(v);
    try { localStorage.setItem(VIZ_STORAGE_KEY, v); } catch {}
  };
  return [viz, setViz];
}

function ToggleVisualizacao({ viz, setViz }) {
  const btn = (v, label, icon) => (
    <button
      onClick={() => setViz(v)}
      style={{
        display:"inline-flex", alignItems:"center", gap:6,
        padding:"5px 10px", borderRadius:6,
        fontSize:12, fontFamily:"inherit",
        color: viz === v ? "#111" : "#6b7280",
        background: viz === v ? "#fff" : "transparent",
        border:"none",
        fontWeight: viz === v ? 600 : 400,
        boxShadow: viz === v ? "0 0 0 0.5px #e5e7eb" : "none",
        cursor:"pointer",
      }}>
      {icon}
      {label}
    </button>
  );
  // Icons (SVG inline pra manter controle fino)
  const iconRows = (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="2" y1="4" x2="12" y2="4"/><line x1="2" y1="7" x2="12" y2="7"/><line x1="2" y1="10" x2="12" y2="10"/>
    </svg>
  );
  const iconCards = (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="10" height="3" rx="1"/><rect x="2" y="8" width="10" height="3" rx="1"/>
    </svg>
  );
  return (
    <div style={{
      display:"inline-flex",
      background:"#f4f5f7",
      borderRadius:8,
      padding:3,
      gap:2,
    }}>
      {btn("tabela", "Tabela", iconRows)}
      {btn("cards",  "Cards",  iconCards)}
    </div>
  );
}

// ─── Linha de tabela (versão compacta do OrcCard) ─────────────────────────
function OrcRow({ orc, clientes, onAbrir, onAction, showCliente = true,
                 modoSelecao = false, selecionado = false, onToggleSelecao = null,
                 onChangeProb = null, perm = null }) {
  const cliente = clientes.find(c => c.id === orc.clienteId);
  const nomeCliente = cliente?.nome || orc.cliente || "—";
  const status = orc.status || "rascunho";
  const area = orc.resultado?.areaTotal || 0;
  const [menuOpen, setMenuOpen] = useState(false);
  if (!perm) perm = getPermissoes();

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (!e.target.closest(`[data-orc-menu-row="${orc.id}"]`)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen, orc.id]);

  // Mesma lógica de valor do OrcCard
  const ultimaProposta = orc.propostas && orc.propostas.length > 0
    ? orc.propostas[orc.propostas.length - 1]
    : null;
  let valorTotal;
  if (ultimaProposta) {
    if (ultimaProposta.valorTotalExibido != null) {
      valorTotal = ultimaProposta.valorTotalExibido;
    } else {
      const arq = ultimaProposta.arqEdit != null ? ultimaProposta.arqEdit : (ultimaProposta.calculo?.precoArq || 0);
      const eng = ultimaProposta.engEdit != null ? ultimaProposta.engEdit : (ultimaProposta.calculo?.precoEng || 0);
      valorTotal = arq + eng;
    }
  } else {
    valorTotal = (orc.resultado?.precoArq || 0) + (orc.resultado?.precoEng || 0);
  }

  const tipo = orc.tipo || "—";
  const refRaw = orc.referencia || "";
  const refEmpty = !refRaw || refRaw === "(sem referência)";
  const venc = calcVencimentoOrc(orc);
  const follow = calcFollowUp(orc);
  const prob = getProbOrc(orc);

  // Paleta S2 (slate monocromático)
  const tag = STATUS_STYLES_S2[status] || STATUS_STYLES_S2.rascunho;

  // Grid novo: ☐ | ID | Cliente/Ref | Tipo/Área | Venc. | Follow | Prob | Status | Total | ⋯
  const gridCols = "26px 85px 1.6fr 1fr 75px 75px 60px 90px 105px 34px";

  return (
    <div
      onClick={() => {
        // No modo seleção, clique na linha toggle seleção (em vez de abrir)
        if (modoSelecao) {
          onToggleSelecao && onToggleSelecao(orc.id);
        } else {
          onAbrir("ver");
        }
      }}
      style={{
        display:"grid",
        gridTemplateColumns: gridCols,
        alignItems:"center", gap:12,
        padding:"10px 14px",
        borderBottom:"0.5px solid #f1f2f4",
        cursor:"pointer", transition:"background 0.1s",
        fontSize:13,
        background: selecionado ? "#f0f9ff" : "transparent",
      }}
      onMouseEnter={e => { if (!selecionado) e.currentTarget.style.background = "#fafbfc"; }}
      onMouseLeave={e => { if (!selecionado) e.currentTarget.style.background = "transparent"; }}
    >
      {/* Coluna -1: Checkbox de seleção (só no modo seleção; senão espaço vazio) */}
      <div onClick={e => e.stopPropagation()} style={{ display:"flex", alignItems:"center" }}>
        {modoSelecao && (
          <CheckboxSelecao
            estado={selecionado}
            onClick={() => onToggleSelecao && onToggleSelecao(orc.id)}
            ariaLabel={`Selecionar ${orc.id}`}
          />
        )}
      </div>

      {/* Coluna 0: ID (pill) */}
      <div style={{ display:"flex", alignItems:"center", minWidth:0 }}>
        <span style={{
          fontSize:10, color:"#9ca3af",
          fontVariantNumeric:"tabular-nums",
          background:"#eef0f3",
          padding:"1px 6px", borderRadius:4, fontWeight:500,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
        }}>
          {orc.id}
        </span>
      </div>

      {/* Coluna 1: Cliente em cima, Referência embaixo */}
      <div style={{ minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, overflow:"hidden" }}>
          {showCliente && (
            <span style={{ fontWeight:600, color:"#111", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {nomeCliente}
            </span>
          )}
          {orc.propostas && orc.propostas.length > 0 && !orc.expirouEm && (
            <span
              onClick={(e) => { e.stopPropagation(); onAbrir("verProposta"); }}
              title={orc.propostas.length > 1 ? `${orc.propostas.length} versões — ver última` : "Ver proposta enviada"}
              style={{
                display:"inline-flex", alignItems:"center", gap:3,
                fontSize:11, color:"#16a34a", fontWeight:500,
                cursor:"pointer", flexShrink:0,
              }}>
              📄
              {orc.propostas.length > 1 && (
                <span style={{
                  fontSize:9.5, fontWeight:700,
                  color:"#16a34a", background:"#dcfce7",
                  padding:"1px 5px", borderRadius:6,
                  fontVariantNumeric:"tabular-nums",
                }}>
                  v{orc.propostas.length}
                </span>
              )}
            </span>
          )}
        </div>
        <div style={{
          fontSize:12, marginTop:2,
          color: refEmpty ? "#9ca3af" : "#6b7280",
          fontStyle: refEmpty ? "italic" : "normal",
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
        }}>
          {refEmpty ? "sem referência" : refRaw}
        </div>
      </div>

      {/* Coluna 2: Tipo · Área */}
      <div style={{ color:"#6b7280", fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {tipo}{area > 0 ? ` · ${area.toLocaleString("pt-BR")}m²` : ""}
      </div>

      {/* Coluna 3: Venc. */}
      <div style={{
        fontSize:12,
        color: venc.aplicavel ? venc.cor : "#d1d5db",
        fontWeight: venc.bold ? 600 : (venc.aplicavel ? 500 : 400),
        fontVariantNumeric:"tabular-nums",
      }}>
        {venc.aplicavel ? venc.label : "—"}
      </div>

      {/* Coluna 4: Follow-up */}
      <div style={{
        fontSize:12,
        color: follow.aplicavel ? follow.cor : "#d1d5db",
        fontWeight: follow.bold ? 600 : (follow.aplicavel ? 500 : 400),
        fontVariantNumeric:"tabular-nums",
      }}>
        {follow.aplicavel ? follow.label : "—"}
      </div>

      {/* Coluna 5: Prob. (só em aberto) */}
      <div onClick={e => e.stopPropagation()}>
        {prob != null ? (
          (() => {
            const pc = PROB_COLORS[prob] || PROB_COLORS[50];
            const clickable = typeof onChangeProb === "function";
            const pill = (
              <span style={{
                display:"inline-flex", alignItems:"center", justifyContent:"center",
                fontSize:10.5, fontWeight:600,
                padding:"1px 7px", borderRadius:10,
                background: pc.bg, color: pc.text,
                fontVariantNumeric:"tabular-nums",
                cursor: clickable ? "pointer" : "default",
              }}>{prob}%</span>
            );
            // Se clickable, usa o mesmo ProbRing pra consistência de interação
            if (clickable) {
              return (
                <ProbRing
                  prob={prob}
                  size={22}
                  onChange={(v) => onChangeProb(orc, v)}
                />
              );
            }
            return pill;
          })()
        ) : (
          <span style={{ color:"#d1d5db", fontSize:12 }}>—</span>
        )}
      </div>

      {/* Coluna 6: Status (paleta S2) */}
      <div>
        <span style={{
          fontSize:9.5, fontWeight:600, textTransform:"uppercase", letterSpacing:0.5,
          padding:"2px 6px", borderRadius:4,
          background: tag.bg, color: tag.color,
          border: tag.border !== "transparent" ? `0.5px solid ${tag.border}` : "none",
          whiteSpace:"nowrap",
        }}>{tag.label}</span>
      </div>

      {/* Coluna 7: Total */}
      <div style={{ textAlign:"right", fontWeight:600, color:"#111", fontVariantNumeric:"tabular-nums" }}>
        {valorTotal > 0 ? `R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits:0, maximumFractionDigits:0 })}` : "—"}
      </div>

      {/* Coluna 7: Menu ações */}
      {perm.isVisualizador ? (
        <div></div>
      ) : (
      <div style={{ position:"relative", display:"flex", justifyContent:"flex-end" }}
           onClick={e => e.stopPropagation()} data-orc-menu-row={orc.id}>
        <button onClick={() => setMenuOpen(v => !v)}
          style={{
            background:"transparent", border:"none",
            fontSize:16, color:"#9ca3af", padding:"4px 8px",
            cursor:"pointer", borderRadius:4, fontFamily:"inherit", lineHeight:1,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#f3f4f6"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
          ⋯
        </button>
        {menuOpen && (
          <div style={{
            position:"absolute", right:0, top:"calc(100% + 4px)", zIndex:999,
            background:"#fff", border:"1px solid #e5e7eb", borderRadius:8,
            boxShadow:"0 4px 16px rgba(0,0,0,0.1)", overflow:"hidden", minWidth:130,
          }}>
            <button
              disabled={status === "ganho"}
              onClick={() => { setMenuOpen(false); onAction && onAction("ganho", orc); }}
              style={{ ...menuItemStyle,
                background: status === "ganho" ? "#f0fdf4" : "transparent",
                color: status === "ganho" ? "#16a34a" : "#374151",
                cursor: status === "ganho" ? "not-allowed" : "pointer",
                fontWeight: status === "ganho" ? 600 : 400 }}>
              {status === "ganho" ? "✓ Ganho" : "Ganho"}
            </button>
            <button
              onClick={() => { setMenuOpen(false); onAction && onAction("perdido", orc); }}
              style={{ ...menuItemStyle,
                background: status === "perdido" ? "#fef2f2" : "transparent",
                color: status === "perdido" ? "#dc2626" : "#374151",
                fontWeight: status === "perdido" ? 600 : 400 }}>
              {status === "perdido" ? "✓ Perdido" : "Perdido"}
            </button>
            {perm.podeExcluir && (
              <>
                <div style={{ borderTop:"0.5px solid #f1f2f4" }} />
                <button
                  onClick={() => { setMenuOpen(false); onAction && onAction("excluir", orc); }}
                  style={{ ...menuItemStyle, color:"#dc2626" }}>
                  Excluir
                </button>
              </>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

const menuItemStyle = {
  display:"block", width:"100%", textAlign:"left",
  background:"transparent", border:"none",
  color:"#374151", padding:"7px 14px", fontSize:12.5,
  cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap",
};

// ─── Componentes de ordenação e filtros ─────────────────────────────────

// Checkbox visual usado na seleção em massa. Aceita 3 estados: false, true, "indet"
function CheckboxSelecao({ estado, onClick, ariaLabel }) {
  const marcado = estado === true;
  const indet = estado === "indet";
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick && onClick(e); }}
      aria-label={ariaLabel || "Selecionar"}
      style={{
        width:14, height:14, padding:0,
        border: `1px solid ${marcado || indet ? "#111" : "#9ca3af"}`,
        borderRadius:3,
        background: marcado ? "#111" : "#fff",
        display:"inline-flex", alignItems:"center", justifyContent:"center",
        cursor:"pointer", fontFamily:"inherit",
      }}>
      {marcado && <span style={{ color:"#fff", fontSize:10, fontWeight:700, lineHeight:1 }}>✓</span>}
      {indet && <span style={{ color:"#111", fontSize:14, fontWeight:700, lineHeight:1, marginTop:-2 }}>−</span>}
    </button>
  );
}

// Barra preta de ações que aparece enquanto o modo seleção está ativo.
// Mostra "Sair da seleção" quando nada está marcado, e ações completas quando há marcações.
function BarraSelecao({ selecionados, totalVisivel, onSelecionarTodos, onLimpar, onExcluir, onSair }) {
  const size = selecionados ? selecionados.size : 0;
  const todosMarcados = size >= totalVisivel;
  return (
    <div style={{
      background:"#111", color:"#fff",
      padding:"10px 16px", borderRadius:9,
      display:"flex", alignItems:"center", justifyContent:"space-between",
      marginBottom:12, fontSize:13, flexWrap:"wrap", gap:12,
    }}>
      <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
        <span style={{ fontWeight:600 }}>
          {size === 0
            ? "Modo seleção"
            : `${size} ${size === 1 ? "selecionado" : "selecionados"}`}
        </span>
        {size > 0 && !todosMarcados && (
          <button onClick={onSelecionarTodos}
            style={{
              padding:"4px 10px", fontSize:12.5,
              background:"transparent", border:"none",
              color:"rgba(255,255,255,0.75)",
              cursor:"pointer", fontFamily:"inherit",
              textDecoration:"underline",
            }}>
            Selecionar todos ({totalVisivel})
          </button>
        )}
      </div>
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        {size > 0 ? (
          <>
            <button onClick={onLimpar}
              style={{
                padding:"5px 12px", fontSize:12.5,
                background:"transparent",
                border:"1px solid rgba(255,255,255,0.3)",
                borderRadius:6, color:"#fff",
                cursor:"pointer", fontFamily:"inherit",
              }}>
              Limpar
            </button>
            <button onClick={onExcluir}
              style={{
                padding:"6px 14px", fontSize:12.5,
                background:"#dc2626", border:"none",
                borderRadius:6, color:"#fff", fontWeight:500,
                cursor:"pointer", fontFamily:"inherit",
              }}>
              Excluir {size}
            </button>
          </>
        ) : (
          <button onClick={onSair}
            style={{
              padding:"5px 12px", fontSize:12.5,
              background:"transparent",
              border:"1px solid rgba(255,255,255,0.3)",
              borderRadius:6, color:"#fff",
              cursor:"pointer", fontFamily:"inherit",
            }}>
            Sair da seleção
          </button>
        )}
      </div>
    </div>
  );
}

// Modal estilizado pra confirmar exclusão em massa com lista de IDs
function ModalConfirmarExclusaoMassa({ orcs, clientes, onConfirmar, onCancelar }) {
  const lista = orcs.slice(0, 10); // limita preview pra 10 primeiros
  const temMais = orcs.length > 10;
  return (
    <div
      onClick={onCancelar}
      style={{
        position:"fixed", inset:0,
        background:"rgba(0,0,0,0.5)", zIndex:9999,
        display:"flex", alignItems:"center", justifyContent:"center", padding:20,
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background:"#fff", borderRadius:12,
          padding:"24px 24px 20px", maxWidth:460, width:"100%",
          boxShadow:"0 8px 32px rgba(0,0,0,0.2)",
          maxHeight:"80vh", display:"flex", flexDirection:"column",
        }}>
        <div style={{ fontSize:16, fontWeight:700, color:"#111", marginBottom:6 }}>
          Excluir {orcs.length} {orcs.length === 1 ? "orçamento" : "orçamentos"}?
        </div>
        <div style={{ fontSize:13, color:"#6b7280", marginBottom:16, lineHeight:1.5 }}>
          Esta ação não pode ser desfeita. Os seguintes orçamentos serão excluídos permanentemente:
        </div>
        <div style={{
          border:"0.5px solid #e5e7eb", borderRadius:8,
          background:"#fafbfc", overflow:"auto", flex:1,
          marginBottom:20,
        }}>
          {lista.map(orc => {
            const cli = clientes.find(c => c.id === orc.clienteId);
            const nomeCli = cli?.nome || orc.cliente || "—";
            return (
              <div key={orc.id}
                style={{
                  display:"grid",
                  gridTemplateColumns:"85px 1fr auto",
                  gap:10,
                  padding:"8px 12px",
                  borderBottom:"0.5px solid #f1f2f4",
                  fontSize:12.5, alignItems:"center",
                }}>
                <span style={{ color:"#6b7280", fontVariantNumeric:"tabular-nums", fontWeight:500 }}>{orc.id}</span>
                <span style={{ color:"#111", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {nomeCli} <span style={{ color:"#9ca3af" }}>· {orc.referencia || "(sem referência)"}</span>
                </span>
                <span style={{ color:"#6b7280", fontSize:11 }}>{orc.tipo || "—"}</span>
              </div>
            );
          })}
          {temMais && (
            <div style={{ padding:"8px 12px", fontSize:12, color:"#6b7280", textAlign:"center", fontStyle:"italic" }}>
              + {orcs.length - 10} {orcs.length - 10 === 1 ? "outro" : "outros"}
            </div>
          )}
        </div>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button onClick={onCancelar}
            style={{
              background:"#fff", color:"#374151",
              border:"1px solid #d1d5db", borderRadius:8,
              padding:"9px 18px", fontSize:13, fontWeight:500,
              cursor:"pointer", fontFamily:"inherit",
            }}>
            Cancelar
          </button>
          <button onClick={onConfirmar}
            style={{
              background:"#dc2626", color:"#fff",
              border:"none", borderRadius:8,
              padding:"9px 20px", fontSize:13, fontWeight:600,
              cursor:"pointer", fontFamily:"inherit",
            }}>
            Excluir {orcs.length}
          </button>
        </div>
      </div>
    </div>
  );
}

// Chip mostrando um filtro ativo, com × pra remover
function FiltroChip({ label, onRemove }) {
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:6,
      fontSize:11.5, padding:"4px 4px 4px 10px",
      background:"#eff6ff", color:"#2563eb",
      border:"0.5px solid #bfdbfe", borderRadius:12, fontWeight:500,
    }}>
      {label}
      <button onClick={onRemove}
        style={{
          background:"transparent", border:"none",
          color:"#2563eb", opacity:0.7,
          fontSize:13, fontWeight:700, padding:"0 6px", cursor:"pointer",
          fontFamily:"inherit", lineHeight:1,
        }}>×</button>
    </span>
  );
}

// Dropdown de ordenação pra visualização em cards
function SortDropdown({ sort, setSort }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (!e.target.closest("[data-sort-drop]")) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const opcoes = [
    { col:"id",      dir:"desc", label:"ID mais recente" },
    { col:"id",      dir:"asc",  label:"ID mais antigo" },
    { col:"cliente", dir:"asc",  label:"Cliente A → Z" },
    { col:"cliente", dir:"desc", label:"Cliente Z → A" },
    { col:"criado",  dir:"desc", label:"Mais recente primeiro" },
    { col:"criado",  dir:"asc",  label:"Mais antigo primeiro" },
    { col:"venc",    dir:"asc",  label:"Vencem antes" },
    { col:"total",   dir:"desc", label:"Maior valor" },
    { col:"total",   dir:"asc",  label:"Menor valor" },
  ];
  const atual = opcoes.find(o => o.col === sort.col && o.dir === sort.dir);
  return (
    <div data-sort-drop style={{ position:"relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display:"inline-flex", alignItems:"center", gap:6,
          padding:"6px 10px", fontSize:12, background:"#fff",
          border:"0.5px solid #e5e7eb", borderRadius:6,
          color:"#374151", cursor:"pointer", fontFamily:"inherit",
        }}>
        <span style={{ color:"#9ca3af" }}>Ordenar:</span>
        {atual ? atual.label : "Padrão"}
        <span style={{ fontSize:9, color:"#9ca3af" }}>▾</span>
      </button>
      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 4px)", right:0, zIndex:50,
          background:"#fff", border:"1px solid #e5e7eb", borderRadius:8,
          boxShadow:"0 4px 16px rgba(0,0,0,0.1)", minWidth:220, overflow:"hidden", padding:"6px 0",
        }}>
          {opcoes.map(o => {
            const ativo = o.col === sort.col && o.dir === sort.dir;
            return (
              <button key={`${o.col}-${o.dir}`}
                onClick={() => { setSort({ col: o.col, dir: o.dir }); setOpen(false); }}
                style={{
                  display:"block", width:"100%", textAlign:"left",
                  background:"transparent", border:"none",
                  padding:"7px 14px", fontSize:12.5,
                  color: ativo ? "#111" : "#374151",
                  fontWeight: ativo ? 600 : 400,
                  cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#f4f5f7"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                {ativo ? "✓ " : "  "}{o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Menu popover de uma coluna na tabela. Oferece ordenação + filtro (multiselect).
// Props:
//   col: nome da coluna ("cliente" | "tipo" | "criado" | "venc" | "status" | "total")
//   label: texto do cabeçalho
//   sort, setSort: state de ordenação atual
//   filtrosCol, setFiltrosCol: filtros multiselect por coluna
//   opcoesFiltro: array de { valor, label, count } ou null (coluna sem filtro)
//   chaveFiltro: chave dentro de filtrosCol ("clientes" | "tipos" | "status")
//   align: "left" | "right" pra posicionar popover
function ColunaMenu({ col, label, sort, setSort, filtrosCol, setFiltrosCol,
                     opcoesFiltro = null, chaveFiltro = null, align = "left" }) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  // Estado PENDENTE: cópias locais que o usuário edita enquanto o menu está aberto.
  // Só são aplicadas (setSort/setFiltrosCol) quando clica OK.
  // Ao clicar Cancelar, fechar ou clicar fora, as mudanças são descartadas.
  const [sortPend, setSortPend] = useState(sort);
  const [filtroPend, setFiltroPend] = useState(() => new Set(chaveFiltro ? (filtrosCol[chaveFiltro] || []) : []));

  // Ao abrir: sincroniza pendente com o estado aplicado
  useEffect(() => {
    if (open) {
      setSortPend(sort);
      setFiltroPend(new Set(chaveFiltro ? (filtrosCol[chaveFiltro] || []) : []));
      setBusca("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fecha ao clicar fora — trata como Cancelar (não aplica)
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (!e.target.closest(`[data-col-menu="${col}"]`)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, col]);

  const ativo = sort.col === col;
  const setaIco = ativo ? (sort.dir === "asc" ? "▲" : "▼") : "▾";
  const filtroAtivoCount = chaveFiltro ? (filtrosCol[chaveFiltro]?.size || 0) : 0;

  const opcoesFiltradas = opcoesFiltro && busca
    ? opcoesFiltro.filter(o => o.label.toLowerCase().includes(busca.toLowerCase()))
    : opcoesFiltro;

  const toggleFiltroPend = (valor) => {
    const atual = new Set(filtroPend);
    if (atual.has(valor)) atual.delete(valor);
    else atual.add(valor);
    setFiltroPend(atual);
  };

  const limparFiltroPend = () => setFiltroPend(new Set());

  const aplicarEFechar = () => {
    setSort(sortPend);
    if (chaveFiltro) {
      setFiltrosCol({ ...filtrosCol, [chaveFiltro]: filtroPend });
    }
    setOpen(false);
  };

  const cancelar = () => setOpen(false); // fecha sem aplicar

  // Detecta se o estado pendente difere do aplicado (pra habilitar/desabilitar OK sugestivamente)
  const temMudanca = (() => {
    if (sortPend.col !== sort.col || sortPend.dir !== sort.dir) return true;
    if (chaveFiltro) {
      const aplicado = filtrosCol[chaveFiltro] || new Set();
      if (aplicado.size !== filtroPend.size) return true;
      for (const v of filtroPend) if (!aplicado.has(v)) return true;
    }
    return false;
  })();

  return (
    <div data-col-menu={col} style={{ position:"relative", display:"inline-block" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display:"inline-flex", alignItems:"center", gap:5,
          fontSize:10, fontWeight:600, color: ativo || filtroAtivoCount > 0 ? "#111" : "#9ca3af",
          textTransform:"uppercase", letterSpacing:0.6,
          background:"transparent", border:"none", padding:0,
          cursor:"pointer", fontFamily:"inherit",
        }}>
        {label}
        <span style={{ fontSize:9, color: ativo ? "#111" : "#d1d5db" }}>{setaIco}</span>
        {filtroAtivoCount > 0 && (
          <span style={{
            fontSize:9, background:"#2563eb", color:"#fff",
            padding:"0 5px", borderRadius:8, fontWeight:700, marginLeft:2,
          }}>{filtroAtivoCount}</span>
        )}
      </button>
      {open && (
        <div style={{
          position:"absolute",
          top:"calc(100% + 6px)",
          [align]: 0,
          zIndex:50,
          background:"#fff", border:"1px solid #e5e7eb", borderRadius:8,
          boxShadow:"0 4px 16px rgba(0,0,0,0.1)",
          minWidth:220, maxWidth:280, overflow:"hidden",
          textTransform:"none", letterSpacing:"0", fontWeight:400,
          display:"flex", flexDirection:"column",
        }}>
          {/* Ordenar */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 14px 4px" }}>
            <span style={{ fontSize:10, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.5 }}>Ordenar</span>
            {sortPend.col === col && (
              <button onClick={() => setSortPend({ col: "cliente", dir: "asc" })}
                style={{ fontSize:11, color:"#6b7280", background:"transparent", border:"none", cursor:"pointer", textDecoration:"underline", fontFamily:"inherit", padding:0 }}
                title="Voltar ao padrão (Cliente A→Z)">
                limpar
              </button>
            )}
          </div>
          {["asc","desc"].map(d => {
            const labels = {
              id:       { asc:"Menor → Maior", desc:"Maior → Menor" },
              cliente:  { asc:"A → Z", desc:"Z → A" },
              tipo:     { asc:"A → Z", desc:"Z → A" },
              criado:   { asc:"Mais antigo", desc:"Mais recente" },
              venc:     { asc:"Vencem antes", desc:"Vencem depois" },
              followup: { asc:"Follow antes", desc:"Follow depois" },
              prob:     { asc:"Menor prob.", desc:"Maior prob." },
              status:   { asc:"Em aberto → Perdido", desc:"Perdido → Em aberto" },
              total:    { asc:"Menor valor", desc:"Maior valor" },
            };
            const sel = sortPend.col === col && sortPend.dir === d;
            return (
              <button key={d}
                onClick={() => setSortPend({ col, dir: d })}
                style={{
                  display:"block", width:"100%", textAlign:"left",
                  background:"transparent", border:"none",
                  padding:"6px 14px", fontSize:12.5,
                  color: sel ? "#111" : "#374151",
                  fontWeight: sel ? 600 : 400,
                  cursor:"pointer", fontFamily:"inherit",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#f4f5f7"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                {sel ? "✓ " : "  "}{labels[col]?.[d] || d}
              </button>
            );
          })}

          {/* Filtro (se a coluna suporta) */}
          {opcoesFiltro && (
            <>
              <div style={{ borderTop:"0.5px solid #f1f2f4", marginTop:4 }} />
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 14px 4px" }}>
                <span style={{ fontSize:10, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.5 }}>Filtrar</span>
                {filtroPend.size > 0 && (
                  <button onClick={limparFiltroPend}
                    style={{ fontSize:11, color:"#6b7280", background:"transparent", border:"none", cursor:"pointer", textDecoration:"underline", fontFamily:"inherit", padding:0 }}>
                    limpar
                  </button>
                )}
              </div>
              {/* Busca — só se há mais de 5 opções */}
              {opcoesFiltro.length > 5 && (
                <input
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar…"
                  style={{
                    margin:"4px 10px 6px", padding:"5px 10px", fontSize:12,
                    border:"0.5px solid #e5e7eb", borderRadius:5,
                    width:"calc(100% - 20px)", boxSizing:"border-box",
                    fontFamily:"inherit", outline:"none",
                  }}
                />
              )}
              <div style={{ maxHeight:220, overflowY:"auto" }}>
                {opcoesFiltradas.length === 0 ? (
                  <div style={{ padding:"8px 14px", fontSize:12, color:"#9ca3af" }}>Nenhum resultado</div>
                ) : opcoesFiltradas.map(op => {
                  const marcado = filtroPend.has(op.valor);
                  return (
                    <button key={op.valor}
                      onClick={() => toggleFiltroPend(op.valor)}
                      style={{
                        display:"flex", alignItems:"center", gap:8,
                        width:"100%", textAlign:"left",
                        background:"transparent", border:"none",
                        padding:"5px 14px", fontSize:12.5, color:"#374151",
                        cursor:"pointer", fontFamily:"inherit",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#f4f5f7"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                      <span style={{
                        width:13, height:13, borderRadius:3,
                        border: `1px solid ${marcado ? "#111" : "#9ca3af"}`,
                        background: marcado ? "#111" : "#fff",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        color:"#fff", fontSize:9, fontWeight:700, flexShrink:0,
                      }}>{marcado ? "✓" : ""}</span>
                      <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{op.label}</span>
                      {op.count != null && (
                        <span style={{ fontSize:11, color:"#9ca3af" }}>{op.count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Rodapé com OK/Cancelar */}
          <div style={{
            borderTop:"0.5px solid #f1f2f4",
            padding:"8px 10px",
            display:"flex", justifyContent:"flex-end", gap:6,
            background:"#fafbfc",
          }}>
            <button onClick={cancelar}
              style={{
                padding:"5px 12px", fontSize:12,
                background:"#fff", border:"0.5px solid #e5e7eb", borderRadius:5,
                color:"#374151", cursor:"pointer", fontFamily:"inherit",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#f4f5f7"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}>
              Cancelar
            </button>
            <button onClick={aplicarEFechar}
              style={{
                padding:"5px 14px", fontSize:12,
                background: temMudanca ? "#111" : "#6b7280",
                border:"none", borderRadius:5,
                color:"#fff", fontWeight:500,
                cursor:"pointer", fontFamily:"inherit",
              }}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Header da tabela — cada coluna com menu de ordenação/filtro (estilo Excel)
function OrcRowHeader({ showCliente = true, sort, setSort, filtrosCol, setFiltrosCol,
                        orcamentos = [], clientes = [],
                        modoSelecao = false, onToggleModoSelecao = null,
                        selecionados = null, onToggleTodos = null, totalVisivel = 0 }) {
  // Grid: ☐ | ID | Cliente/Ref | Tipo/Área | Venc. | Follow | Prob | Status | Total | ⋯
  const gridCols = "26px 85px 1.6fr 1fr 75px 75px 60px 90px 105px 34px";

  const [menuAcoesOpen, setMenuAcoesOpen] = useState(false);
  useEffect(() => {
    if (!menuAcoesOpen) return;
    const h = (e) => { if (!e.target.closest("[data-hdr-acoes]")) setMenuAcoesOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuAcoesOpen]);

  // Monta opções de filtro por coluna a partir do dataset
  const opcoesCliente = (() => {
    if (!showCliente) return null;
    const mapa = new Map();
    orcamentos.forEach(o => {
      const cli = clientes.find(c => c.id === o.clienteId);
      const nome = cli?.nome || o.cliente || "—";
      mapa.set(nome, (mapa.get(nome) || 0) + 1);
    });
    return [...mapa.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([nome, n]) => ({ valor: nome, label: nome, count: n }));
  })();
  const opcoesTipo = (() => {
    const mapa = new Map();
    orcamentos.forEach(o => { const t = o.tipo || "—"; mapa.set(t, (mapa.get(t) || 0) + 1); });
    return [...mapa.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([t, n]) => ({ valor: t, label: t, count: n }));
  })();
  const opcoesStatus = (() => {
    const labels = { rascunho:"Rascunho", aberto:"Em aberto", ganho:"Ganho", perdido:"Perdido" };
    const mapa = new Map();
    orcamentos.forEach(o => { const s = o.status || "rascunho"; mapa.set(s, (mapa.get(s) || 0) + 1); });
    return [...mapa.entries()]
      .sort((a, b) => (labels[a[0]] || a[0]).localeCompare(labels[b[0]] || b[0], "pt-BR"))
      .map(([s, n]) => ({ valor: s, label: labels[s] || s, count: n }));
  })();

  // Estado do checkbox master
  const selSize = selecionados ? selecionados.size : 0;
  const masterEstado = selSize === 0 ? false : (selSize >= totalVisivel ? true : "indet");

  return (
    <div style={{
      display:"grid",
      gridTemplateColumns: gridCols,
      alignItems:"center", gap:12,
      padding:"9px 14px",
      borderBottom:"1px solid #e5e7eb",
      background:"#fafbfc",
    }}>
      {/* Primeira coluna: checkbox master (modo seleção) OU botão ⋯ (modo normal) */}
      <div data-hdr-acoes style={{ position:"relative", display:"flex", alignItems:"center" }}>
        {modoSelecao ? (
          onToggleTodos && (
            <CheckboxSelecao
              estado={masterEstado}
              onClick={onToggleTodos}
              ariaLabel="Selecionar todos"
            />
          )
        ) : (
          onToggleModoSelecao && (
            <button
              onClick={() => setMenuAcoesOpen(v => !v)}
              title="Ações"
              style={{
                background:"transparent", border:"none",
                fontSize:14, color:"#9ca3af", lineHeight:1,
                padding:"2px 4px", cursor:"pointer", borderRadius:4,
                fontFamily:"inherit",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.color = "#374151"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9ca3af"; }}>
              ⋯
            </button>
          )
        )}
        {menuAcoesOpen && !modoSelecao && (
          <div style={{
            position:"absolute", left:0, top:"calc(100% + 6px)", zIndex:60,
            background:"#fff", border:"1px solid #e5e7eb", borderRadius:8,
            boxShadow:"0 4px 16px rgba(0,0,0,0.1)", minWidth:180, overflow:"hidden",
            textTransform:"none", letterSpacing:0, fontWeight:400,
          }}>
            <button
              onClick={() => { setMenuAcoesOpen(false); onToggleModoSelecao && onToggleModoSelecao(); }}
              style={{
                display:"flex", alignItems:"center", gap:8,
                width:"100%", textAlign:"left",
                background:"transparent", border:"none",
                padding:"8px 14px", fontSize:12.5, color:"#374151",
                cursor:"pointer", fontFamily:"inherit",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#f4f5f7"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="2" width="10" height="10" rx="2"/>
                <path d="M5 7l1.5 1.5L9 6"/>
              </svg>
              Selecionar orçamentos
            </button>
          </div>
        )}
      </div>
      <ColunaMenu col="id" label="ID"
        sort={sort} setSort={setSort}
        filtrosCol={filtrosCol} setFiltrosCol={setFiltrosCol}
        align="left" />
      <ColunaMenu col="cliente" label={showCliente ? "Cliente · Referência" : "Referência"}
        sort={sort} setSort={setSort}
        filtrosCol={filtrosCol} setFiltrosCol={setFiltrosCol}
        opcoesFiltro={opcoesCliente} chaveFiltro={showCliente ? "clientes" : null}
        align="left" />
      <ColunaMenu col="tipo" label="Tipo / Área"
        sort={sort} setSort={setSort}
        filtrosCol={filtrosCol} setFiltrosCol={setFiltrosCol}
        opcoesFiltro={opcoesTipo} chaveFiltro="tipos"
        align="left" />
      <ColunaMenu col="venc" label="Venc."
        sort={sort} setSort={setSort}
        filtrosCol={filtrosCol} setFiltrosCol={setFiltrosCol}
        align="left" />
      <ColunaMenu col="followup" label="Follow-up"
        sort={sort} setSort={setSort}
        filtrosCol={filtrosCol} setFiltrosCol={setFiltrosCol}
        align="left" />
      <ColunaMenu col="prob" label="Prob."
        sort={sort} setSort={setSort}
        filtrosCol={filtrosCol} setFiltrosCol={setFiltrosCol}
        align="left" />
      <ColunaMenu col="status" label="Status"
        sort={sort} setSort={setSort}
        filtrosCol={filtrosCol} setFiltrosCol={setFiltrosCol}
        opcoesFiltro={opcoesStatus} chaveFiltro="status"
        align="left" />
      <div style={{ textAlign:"right" }}>
        <ColunaMenu col="total" label="Total"
          sort={sort} setSort={setSort}
          filtrosCol={filtrosCol} setFiltrosCol={setFiltrosCol}
          align="right" />
      </div>
      <div></div>
    </div>
  );
}

// ─── Modal de Novo Orçamento (escolha de cliente) ──
function ModalNovoOrcamento({ clientes, busca, setBusca, onSelecionar, onFechar, onCadastrarNovo }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onFechar(); }}
      style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,0.4)",
        display:"flex", alignItems:"center", justifyContent:"center",
        zIndex:100, padding:20,
      }}>
      <div style={{
        background:"#fff", borderRadius:12, width:"100%", maxWidth:480, maxHeight:"90vh",
        display:"flex", flexDirection:"column", boxShadow:"0 20px 40px rgba(0,0,0,0.15)", overflow:"hidden",
      }}>
        <div style={{ padding:"20px 24px 12px", borderBottom:"1px solid #f3f4f6", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:17, fontWeight:700, color:"#111", letterSpacing:-0.3 }}>Novo Orçamento</div>
          <button onClick={onFechar} style={{ background:"none", border:"none", color:"#9ca3af", fontSize:18, cursor:"pointer", fontFamily:"inherit", padding:"2px 6px", lineHeight:1 }}>✕</button>
        </div>
        <div style={{ padding:"16px 24px 20px", overflowY:"auto" }}>
          <div style={{ fontSize:11, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.6, marginBottom:8, fontWeight:600 }}>
            Para qual cliente?
          </div>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar cliente por nome ou telefone…"
            autoFocus
            style={{
              width:"100%", padding:"9px 12px",
              border:"1px solid #e5e7eb", borderRadius:7,
              fontSize:13, color:"#111", fontFamily:"inherit",
              outline:"none", background:"#fff",
            }}
          />
          <div style={{
            marginTop:12, maxHeight:280, overflowY:"auto",
            border:"1px solid #f3f4f6", borderRadius:7,
          }}>
            {clientes.length === 0 ? (
              <div style={{ padding:"24px 16px", textAlign:"center", color:"#9ca3af", fontSize:12.5 }}>
                {busca ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado."}
              </div>
            ) : clientes.map((c, i) => (
              <div
                key={c.id || i}
                onClick={() => onSelecionar(c)}
                style={{
                  padding:"10px 14px",
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  cursor:"pointer", borderBottom: i < clientes.length - 1 ? "1px solid #f9fafb" : "none",
                  transition:"background 0.1s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ fontSize:13, color:"#111", fontWeight:500 }}>{c.nome || "(sem nome)"}</div>
                <div style={{ fontSize:11.5, color:"#9ca3af" }}>{c.telefone || c.whatsapp || ""}</div>
              </div>
            ))}
          </div>
          <div style={{
            display:"flex", alignItems:"center", gap:12, margin:"16px 0",
            color:"#d1d5db", fontSize:11, textTransform:"uppercase", letterSpacing:0.8,
          }}>
            <div style={{ flex:1, height:1, background:"#f3f4f6" }} />
            ou
            <div style={{ flex:1, height:1, background:"#f3f4f6" }} />
          </div>
          <button
            onClick={onCadastrarNovo}
            style={{
              width:"100%", padding:"10px 14px",
              border:"1px dashed #d1d5db", borderRadius:7, background:"#fff",
              fontSize:13, color:"#374151", fontWeight:500,
              fontFamily:"inherit", cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:6,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor="#111"; e.currentTarget.style.color="#111"; e.currentTarget.style.background="#fafafa"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor="#d1d5db"; e.currentTarget.style.color="#374151"; e.currentTarget.style.background="#fff"; }}
          >
            + Cadastrar novo cliente
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Modal Confirmar Ganho
// ═══════════════════════════════════════════════════════════════
// Espelha a estrutura do orçamento (tipo de pagamento, parcelas, etc.)
// Deixa o usuário escolher:
//   1. O que foi fechado (Arq / Eng — só o que estava no orçamento)
//   2. Forma de pagamento (opções que existiam no orçamento)
//   3. Valor fechado total (≤ proposto; distribui proporcional)
//   4. Parcelas (quantidade + datas editáveis)
//
// Ao confirmar:
//   - Marca orçamento como ganho + valorFechado + condicaoFechada
//   - Cria projeto no Kanban Etapas (coluna Briefing)
//   - onConfirmar(ganhoData) — o pai decide como gravar (lançamentos etc.)
// ─── Input numérico no formato brasileiro (1.234,56) ───
// Guarda o valor em Number no estado do pai, mas exibe e aceita
// digitação no padrão pt-BR (ponto separador de milhar, vírgula decimal).
function NumBR({ valor, onChange, onFocus: onFocusExt, onBlur: onBlurExt, min, max, decimais = 2, style = {}, ...rest }) {
  const fmt = (n) => {
    if (n == null || isNaN(n)) return "";
    // Normaliza -0 para 0 pra nunca aparecer "-0,00"
    const v = (n === 0 || Object.is(n, -0)) ? 0 : n;
    return v.toLocaleString("pt-BR", {
      minimumFractionDigits: decimais,
      maximumFractionDigits: decimais,
    });
  };
  const [txt, setTxt] = useState(fmt(valor));
  const focadoRef = useRef(false);

  // Sincroniza quando o valor muda por fora — MAS SÓ SE NÃO TIVER FOCO.
  // Evita conflito com digitação em andamento (o cursor pular, valor sobrescrito).
  useEffect(() => {
    if (focadoRef.current) return;
    setTxt(fmt(valor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  function parseBR(s) {
    if (s == null) return 0;
    const limpo = String(s).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
    const n = parseFloat(limpo);
    return isNaN(n) ? 0 : n;
  }

  function handleChange(e) {
    const raw = e.target.value;
    setTxt(raw);
    let n = parseBR(raw);
    if (min != null && n < min) n = min;
    if (max != null && n > max) n = max;
    onChange(n);
  }

  function handleFocus(e) {
    focadoRef.current = true;
    if (onFocusExt) onFocusExt(e);
  }

  function handleBlur(e) {
    focadoRef.current = false;
    // Ao sair, normaliza o texto pro formato BR
    setTxt(fmt(valor));
    if (onBlurExt) onBlurExt(e);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={txt}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={style}
      {...rest}
    />
  );
}

// Input de quantidade de parcelas (1–24).
// Mantém state local durante digitação (aceita string vazia) e só commita no blur/Enter.
// Sincroniza com qtd externa quando input não está focado.
function InputQtdParcelas({ qtd, onCommit, style }) {
  const [valor, setValor] = useState(String(qtd));
  const focadoRef = useRef(false);
  // Debounce do commit ao vivo: enquanto o usuário digita ou clica nas setas,
  // espera 250ms de inatividade antes de chamar onCommit. Evita recálculo a cada
  // tecla/clique (que regenera array de parcelas e datas — caro com 24 parcelas).
  // Boa prática: feedback visual instantâneo no input + recomputação rápida mas
  // sem flicker. Ref ao invés de state pra não causar re-render extra.
  const debounceRef = useRef(null);

  // Sincroniza com valor externo quando não está em edição
  useEffect(() => {
    if (!focadoRef.current) setValor(String(qtd));
  }, [qtd]);

  // Limpa timer pendente quando desmonta (evita commit em componente fantasma)
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  function commitValor(v) {
    const n = parseInt(v, 10);
    if (isNaN(n) || n < 1) return;
    if (n > 24) return;
    if (n !== qtd) onCommit(n);
  }

  const handleChange = (e) => {
    const v = e.target.value;
    // Permite vazio ou dígitos
    if (v === "" || /^\d{1,2}$/.test(v)) {
      setValor(v);
      // Live update: cancela debounce anterior, agenda novo commit em 250ms.
      // Usuário usando setas ↑↓ vê parcelas regenerarem quase instantâneo.
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => commitValor(v), 250);
    }
  };

  const handleBlur = () => {
    focadoRef.current = false;
    // No blur, força commit imediato (sem esperar debounce) e valida limites
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    const n = parseInt(valor, 10);
    if (isNaN(n) || n < 1) { setValor("1"); onCommit(1); return; }
    if (n > 24) { setValor("24"); onCommit(24); return; }
    setValor(String(n));
    if (n !== qtd) onCommit(n);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") { e.currentTarget.blur(); }
  };

  return (
    <input
      type="number"
      min="1"
      max="24"
      value={valor}
      onFocus={() => { focadoRef.current = true; }}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      style={style}
    />
  );
}

function ModalConfirmarGanho({ orc, onClose, onConfirmar }) {
  // ── Valores base do orçamento (com/sem imposto conforme orçamento) ──
  // Prioridade: snapshot da última proposta > campos raiz
  const ultPropImp = orc.propostas && orc.propostas.length > 0
    ? orc.propostas[orc.propostas.length - 1]
    : null;

  // ── Detecta tipo do orçamento ──
  // Prioridade: snapshot da proposta enviada > campos raiz > default
  // (o snapshot reflete o que o cliente de fato viu no PDF)
  const tipoPgtoOrc = ultPropImp?.tipoPgto || orc.tipoPagamento || orc.tipoPgto || "padrao";
  const ehTipoEtapas = tipoPgtoOrc === "etapas";

  const temImpostoOrc = ultPropImp?.temImposto ?? orc.temImposto ?? !!orc.incluiImposto;
  const aliqImp       = ultPropImp?.aliqImp ?? orc.aliqImp ?? orc.aliquotaImposto ?? 0;

  // Valores base SEM imposto — prioridade: edições manuais > cálculo > raiz
  // IMPORTANTE: NÃO usar valorArqExibido/valorEngExibido da proposta porque esses
  // já vêm com imposto incluído quando o orçamento tem imposto (arqCIEdit/engCIEdit).
  // Precisamos dos valores LÍQUIDOS pra aplicar comImp() corretamente.
  const baseArq = (() => {
    if (ultPropImp?.arqEdit != null) return ultPropImp.arqEdit;
    if (ultPropImp?.calculo?.precoArq != null) return ultPropImp.calculo.precoArq;
    return orc.resultado?.precoArq || 0;
  })();
  const baseEng = (() => {
    if (ultPropImp?.engEdit != null) return ultPropImp.engEdit;
    if (ultPropImp?.calculo?.precoEng != null) return ultPropImp.calculo.precoEng;
    return orc.resultado?.precoEng || 0;
  })();

  // ── Estados principais ──
  const [incluirImposto, setIncluirImposto] = useState(temImpostoOrc);   // começa marcado se orçamento tem imposto
  const [inclArq, setInclArq]             = useState(baseArq > 0);
  const [inclEng, setInclEng]             = useState(baseEng > 0);
  const [etapas, setEtapas]               = useState([]);                // preenchido no useEffect
  const [modoEtapas, setModoEtapas]       = useState(false);
  const [totalFechado, setTotalFechado]   = useState(0);
  const [parcelas, setParcelas]           = useState([]);
  const [editandoTotal, setEditandoTotal] = useState(false);
  const [editandoDesconto, setEditandoDesconto] = useState(false);
  const [editandoImposto, setEditandoImposto] = useState(false);

  // Trava o scroll da página atrás enquanto o modal está aberto.
  // Preserva overflow original do body/html pra restaurar ao fechar.
  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, []);

  // Função dinâmica: aplica imposto conforme o state atual
  const comImp = (v) => (incluirImposto && aliqImp > 0 && v > 0)
    ? Math.round(v / (1 - aliqImp/100) * 100) / 100
    : v;

  // Valores efetivos (atuais)
  const orcArq = comImp(baseArq);
  const orcEng = comImp(baseEng);
  const temArq = orcArq > 0;
  const temEng = orcEng > 0;

  // ── Calcula etapas base (só tipo "etapas") — depende de orcArq/orcEng (e portanto imposto) ──
  function calcularEtapasBase() {
    if (!ehTipoEtapas) return [];
    const etapasOrc = ultPropImp?.etapasPct || orc.etapasPct || [];
    if (etapasOrc.length === 0) return [];

    // etapasIsoladas: subset de etapas que foi oferecido ao cliente na proposta.
    // Vazio/undefined = todas as etapas foram oferecidas.
    // Prioridade: snapshot da proposta enviada > raiz do orçamento.
    const isoladasArr = ultPropImp?.etapasIsoladas || orc.etapasIsoladas || [];
    const idsIsolados = new Set(isoladasArr);
    const temIsoladas = idsIsolados.size > 0;
    const engIsolada  = idsIsolados.has(5);

    const totalArqCI = orcArq;
    const totalEngCI = orcEng;
    return etapasOrc
      // Filtros:
      // • Engenharia (id=5): só aparece se o orc tem Eng (temEng)
      //   — adicionalmente, se tem etapasIsoladas, Eng só aparece se estiver isolada
      // • Etapas Arq: se tem etapasIsoladas, só as isoladas aparecem
      .filter(e => {
        if (e.id === 5) {
          if (!temEng) return false;
          if (temIsoladas && !engIsolada) return false;
          return true;
        }
        if (temIsoladas && !idsIsolados.has(e.id)) return false;
        return true;
      })
      .map(e => {
        const pct = parseFloat(e.pct) || 0;
        const valor = e.id === 5
          ? totalEngCI
          : Math.round(totalArqCI * pct / 100 * 100) / 100;
        return { id: e.id, nome: e.nome, pct, valor, marcado: true };
      });
  }

  // Quando incluirImposto muda, recalcula as etapas preservando o estado "marcado"
  useEffect(() => {
    if (!ehTipoEtapas) return;
    const novasEtapas = calcularEtapasBase();
    setEtapas(atuais => {
      // Preserva a marcação atual se já tinha etapas
      if (atuais.length === 0) return novasEtapas;
      const marcadasMap = new Map(atuais.map(e => [e.id, e.marcado]));
      return novasEtapas.map(e => ({
        ...e,
        marcado: marcadasMap.has(e.id) ? marcadasMap.get(e.id) : true,
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incluirImposto]);

  // ── Deriva opções padrão do orçamento (desconto e quantidade de parcelas) ──
  // Prioridade: proposta enviada > raiz do orçamento > fallback.
  const opcoesOrcamento = (() => {
    const tipoPgto = orc.tipoPagamento || orc.tipoPgto || "padrao";
    const ultProp = orc.propostas && orc.propostas.length > 0
      ? orc.propostas[orc.propostas.length - 1]
      : null;
    const pick = (...vals) => { for (const v of vals) if (v != null) return v; return 0; };

    if (tipoPgto === "padrao") {
      // Arq + Eng = pacote completo | só um dos dois = "etapa" (individual)
      const ehPacote = inclArq && inclEng;
      const descArq = pick(ultProp?.descArq, orc.descontoEtapa, orc.descArq, 5);
      const parcArq = pick(ultProp?.parcArq, orc.parcelasEtapa, orc.parcArq, 3);
      const descPac = pick(ultProp?.descPacote, orc.descontoPacote, orc.descPacote, 10);
      const parcPac = pick(ultProp?.parcPacote, orc.parcelasPacote, orc.parcPacote, 4);
      return {
        descAntecipado: ehPacote ? descPac : descArq,
        qtdParcelado:   ehPacote ? parcPac : parcArq,
        blocoLabel:     ehPacote ? "Pacote Completo" : (inclArq ? "Apenas Arquitetura" : "Apenas Engenharia"),
      };
    }

    // Tipo "etapas": se TODAS etapas marcadas → pacote (Ctrt Pacote); se subset → etapa a etapa (Ctrt Etapa)
    const totalEtapas = etapas.length;
    const marcadas    = etapas.filter(e => e.marcado).length;
    const ehPacote    = totalEtapas > 0 && marcadas === totalEtapas;

    const descEt  = pick(ultProp?.descEtCtrt,  orc.descontoEtapaCtrt,  orc.descEtCtrt,  5);
    const parcEt  = pick(ultProp?.parcEtCtrt,  orc.parcelasEtapaCtrt,  orc.parcEtCtrt,  2);
    const descPac = pick(ultProp?.descPacCtrt, orc.descontoPacoteCtrt, orc.descPacCtrt, 15);
    const parcPac = pick(ultProp?.parcPacCtrt, orc.parcelasPacoteCtrt, orc.parcPacCtrt, 8);
    return {
      descAntecipado: ehPacote ? descPac : descEt,
      qtdParcelado:   ehPacote ? parcPac : parcEt,
      blocoLabel:     ehPacote ? "Pacote de Etapas" : "Etapa a Etapa",
    };
  })();

  // ── Cálculos derivados ──
  // No tipo "etapas": propTotal = soma das etapas MARCADAS (valor editável)
  // No tipo "padrão": propTotal = Arq (se marcado) + Eng (se marcado)
  let propArq, propEng, propTotal;
  if (ehTipoEtapas) {
    // Soma das etapas marcadas
    propTotal = Math.round(etapas.filter(e => e.marcado).reduce((s, e) => s + (parseFloat(e.valor) || 0), 0) * 100) / 100;
    // Para distribuir no resumo: Arq = soma etapas marcadas exceto id=5 (Eng) ; Eng = etapa id=5 se marcada
    propArq = Math.round(etapas.filter(e => e.marcado && e.id !== 5).reduce((s, e) => s + (parseFloat(e.valor) || 0), 0) * 100) / 100;
    propEng = Math.round((propTotal - propArq) * 100) / 100;
  } else {
    propArq = inclArq ? orcArq : 0;
    propEng = inclEng ? orcEng : 0;
    propTotal = propArq + propEng;
  }

  // Desconto é derivado do totalFechado (fonte única da verdade: totalFechado)
  // `|| 0` no final evita -0 (negative zero) aparecer ao digitar 0% ou em arredondamentos
  const descontoPct = propTotal > 0
    ? (Math.round(((propTotal - totalFechado) / propTotal) * 10000) / 100) || 0
    : 0;

  // Distribui proporcional (Arq/Eng do total fechado)
  let fecArq = 0, fecEng = 0;
  if (propTotal > 0) {
    fecArq = Math.round(totalFechado * (propArq / propTotal) * 100) / 100;
    fecEng = Math.round((totalFechado - fecArq) * 100) / 100;
  }
  const descontoRs = Math.round((propTotal - totalFechado) * 100) / 100;

  // Validação: soma das parcelas deve bater com o total fechado
  const somaParcelas = Math.round(parcelas.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0) * 100) / 100;
  const diferencaParcelas = Math.round((somaParcelas - totalFechado) * 100) / 100;
  const temDiferenca = Math.abs(diferencaParcelas) > 0.01;

  // ── Helpers ──
  // Gera N parcelas iguais, com a última absorvendo a diferença de arredondamento.
  // Garante que soma(parcelas) === total exatamente (em centavos).
  function gerarParcelasIguais(n, total, nomeBase = "Parcela") {
    const hoje = new Date();
    if (n <= 0) return [];
    const totalCentavos = Math.round(total * 100);
    const vpCentavos = Math.floor(totalCentavos / n);
    const sobra = totalCentavos - (vpCentavos * n); // centavos que sobram (vai pra primeira)
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, hoje.getDate());
      // Distribui a sobra nas primeiras parcelas (1 centavo cada) pra fechar exato
      const centavos = vpCentavos + (i < sobra ? 1 : 0);
      return {
        nome: `${i + 1}ª ${nomeBase}`,
        valor: centavos / 100,
        data: d.toISOString().slice(0, 10),
      };
    });
  }

  // Refs de controle (devem ser declarados antes dos useEffects que os usam)
  // • etapasInicializadasRef: detecta primeira vez que etapas são preenchidas (tipo etapas)
  // • descAplicadoRef: preserva o último desconto "estável" aplicado — usado pelo useEffect
  //   [etapas] pra não ler o descontoPct sujo do render intermediário (onde totalFechado
  //   ainda é velho e propTotal já é novo).
  const etapasInicializadasRef = useRef(false);
  const descAplicadoRef = useRef(0);

  // ── Inicialização: reset total/parcelas quando ESCOPO muda (Arq/Eng) ──
  // Só reseta qtd de parcelas e desconto quando muda escopo, não quando só muda imposto.
  useEffect(() => {
    let propAtual;
    if (ehTipoEtapas) {
      propAtual = etapas.filter(e => e.marcado).reduce((s, e) => s + (parseFloat(e.valor) || 0), 0);
    } else {
      propAtual = (inclArq ? orcArq : 0) + (inclEng ? orcEng : 0);
    }
    const descBase = opcoesOrcamento.descAntecipado;
    const qtdBase  = Math.max(1, parseInt(opcoesOrcamento.qtdParcelado) || 1);
    const totalCalc = Math.round(propAtual * (1 - descBase/100) * 100) / 100;
    descAplicadoRef.current = descBase;
    setTotalFechado(totalCalc);
    setParcelas(gerarParcelasIguais(qtdBase, totalCalc, "Parcela"));
    setModoEtapas(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inclArq, inclEng]);

  // ── Recalcula total quando etapas marcadas/valores mudam (tipo etapas) ──
  useEffect(() => {
    if (!ehTipoEtapas) return;
    const propAtual = etapas.filter(e => e.marcado).reduce((s, e) => s + (parseFloat(e.valor) || 0), 0);

    // Primeira vez que etapas são preenchidas: aplica desconto e qtd parcelas do orçamento.
    // As edições manuais posteriores (marcar/desmarcar, editar valor) preservam o desconto atual.
    if (!etapasInicializadasRef.current && etapas.length > 0) {
      etapasInicializadasRef.current = true;
      const descBase = opcoesOrcamento.descAntecipado;
      const qtdBase  = Math.max(1, parseInt(opcoesOrcamento.qtdParcelado) || 1);
      const novoTotal = Math.round(propAtual * (1 - descBase/100) * 100) / 100;
      descAplicadoRef.current = descBase;
      setTotalFechado(novoTotal);
      setParcelas(gerarParcelasIguais(qtdBase, novoTotal, "Parcela"));
      return;
    }

    // Preserva desconto ESTÁVEL (capturado antes de etapas mudar, via toggleEtapa/mudarValorEtapa)
    const descAtual = descAplicadoRef.current;
    const novoTotal = Math.round(propAtual * (1 - descAtual/100) * 100) / 100;
    setTotalFechado(novoTotal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapas]);

  // Quando totalFechado muda, redistribui o valor das parcelas (mantém quantidade e datas)
  // • Modo normal: divide igualmente em centavos (soma exata)
  // • Modo etapas: mantém os PERCENTUAIS de cada etapa e recalcula os valores proporcionais
  useEffect(() => {
    setParcelas(atuais => {
      if (atuais.length === 0) return atuais;
      const n = atuais.length;
      const totalCentavos = Math.round(totalFechado * 100);

      if (modoEtapas) {
        // Preserva percentual de cada etapa (calculado sobre a soma ATUAL das parcelas)
        const somaAtualCentavos = atuais.reduce((s, p) => s + Math.round((parseFloat(p.valor) || 0) * 100), 0);
        if (somaAtualCentavos === 0 || somaAtualCentavos === totalCentavos) return atuais;
        // Distribui em centavos baseado no percentual de cada
        let novosCentavos = atuais.map(p => {
          const vCentavos = Math.round((parseFloat(p.valor) || 0) * 100);
          return Math.floor((vCentavos / somaAtualCentavos) * totalCentavos);
        });
        // Sobra de arredondamento vai pra primeira parcela
        const sobra = totalCentavos - novosCentavos.reduce((s, c) => s + c, 0);
        novosCentavos[0] = novosCentavos[0] + sobra;
        const novosValores = novosCentavos.map(c => c / 100);
        if (atuais.every((p, i) => p.valor === novosValores[i])) return atuais;
        return atuais.map((p, i) => ({ ...p, valor: novosValores[i] }));
      }

      // Modo normal: distribui igualmente
      const vpCentavos = Math.floor(totalCentavos / n);
      const sobra = totalCentavos - (vpCentavos * n);
      const novosValores = Array.from({ length: n }, (_, i) =>
        (vpCentavos + (i < sobra ? 1 : 0)) / 100
      );
      if (atuais.every((p, i) => p.valor === novosValores[i])) return atuais;
      return atuais.map((p, i) => ({ ...p, valor: novosValores[i] }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalFechado]);

  // ── Handlers ──
  function toggleEscopo(key) {
    if (key === "arq") {
      if (!inclArq) setInclArq(true);
      else if (inclEng) setInclArq(false);
    }
    if (key === "eng") {
      if (!inclEng) setInclEng(true);
      else if (inclArq) setInclEng(false);
    }
  }

  function toggleEtapa(etapaId) {
    setEtapas(atuais => {
      const novas = atuais.map(e => e.id === etapaId ? { ...e, marcado: !e.marcado } : e);
      // Garante que sempre tem pelo menos 1 etapa marcada
      if (novas.every(e => !e.marcado)) {
        return novas.map(e => e.id === etapaId ? { ...e, marcado: true } : e);
      }
      return novas;
    });
  }

  function mudarValorEtapa(i, novoValor) {
    setEtapas(atuais => {
      if (atuais.length === 0) return atuais;
      const novoV = Math.round((parseFloat(novoValor) || 0) * 100) / 100;
      // Só aplica cascata entre etapas MARCADAS (desmarcadas não entram)
      const marcadasIdx = atuais.map((e, idx) => e.marcado ? idx : -1).filter(x => x !== -1);
      const iMarcada = marcadasIdx.indexOf(i);
      if (iMarcada === -1 || marcadasIdx.length < 2) {
        // Etapa não marcada ou só tem 1 marcada: só atualiza ela
        return atuais.map((e, idx) => idx === i ? { ...e, valor: novoV } : e);
      }
      // Soma total das etapas marcadas ANTES da edição (alvo a preservar)
      const somaAtualMarcadas = marcadasIdx.reduce((s, idx) => s + (parseFloat(atuais[idx].valor) || 0), 0);
      // Índice que compensa: próxima etapa marcada (última volta pra primeira)
      const jMarcada = iMarcada === marcadasIdx.length - 1 ? 0 : iMarcada + 1;
      const jCompensar = marcadasIdx[jMarcada];
      // Soma das etapas marcadas exceto a editada e a que compensa
      const somaOutras = marcadasIdx.reduce((s, idx) => {
        if (idx === i || idx === jCompensar) return s;
        return s + (parseFloat(atuais[idx].valor) || 0);
      }, 0);
      // Valor compensador = soma total marcadas - novoV - somaOutras
      const valorCompensador = Math.round((somaAtualMarcadas - novoV - somaOutras) * 100) / 100;

      return atuais.map((e, idx) => {
        if (idx === i) return { ...e, valor: novoV };
        if (idx === jCompensar) return { ...e, valor: valorCompensador };
        return e;
      });
    });
  }

  function mudarQtdParcelas(n) {
    const qtd = Math.max(1, Math.min(24, parseInt(n) || 1));
    setParcelas(gerarParcelasIguais(qtd, totalFechado, "Parcela"));
  }

  function mudarParcelaCampo(i, campo, valor) {
    if (campo !== "valor") {
      // Para nome/data, apenas atualiza a parcela editada
      setParcelas(atuais => atuais.map((p, idx) => idx === i ? { ...p, [campo]: valor } : p));
      return;
    }
    // Edição de VALOR com cascata: a próxima parcela absorve a diferença.
    // Estratégia: seta o valor novo na parcela i, depois define a parcela j (próxima)
    // como o que falta pra fechar o total (totalFechado - soma das outras).
    // Se for a última parcela editada, a primeira absorve.
    setParcelas(atuais => {
      if (atuais.length === 0) return atuais;
      const novoValor = Math.round((parseFloat(valor) || 0) * 100) / 100;
      if (atuais.length === 1) {
        return [{ ...atuais[0], valor: novoValor }];
      }
      const jCompensar = i === atuais.length - 1 ? 0 : i + 1;
      // Soma todas as parcelas exceto a editada e a que compensa
      const somaOutras = atuais.reduce((s, p, idx) => {
        if (idx === i || idx === jCompensar) return s;
        return s + (parseFloat(p.valor) || 0);
      }, 0);
      // O que falta pra fechar o total = totalFechado - novoValor - somaOutras
      const valorCompensador = Math.round((totalFechado - novoValor - somaOutras) * 100) / 100;
      return atuais.map((p, idx) => {
        if (idx === i) return { ...p, valor: novoValor };
        if (idx === jCompensar) return { ...p, valor: valorCompensador };
        return p;
      });
    });
  }

  function mudarParcelaPct(i, novoPct) {
    // Converte pct → valor e aplica a mesma cascata de mudarParcelaCampo
    const pctNum = parseFloat(novoPct) || 0;
    const novoValor = Math.round((totalFechado * pctNum / 100) * 100) / 100;
    mudarParcelaCampo(i, "valor", novoValor);
  }

  function adicionarParcela() {
    const ult = parcelas[parcelas.length - 1];
    const d = ult ? new Date(ult.data) : new Date();
    d.setMonth(d.getMonth() + 1);
    const nome = modoEtapas ? "Nova etapa" : `${parcelas.length + 1}ª Parcela`;
    const novaParcela = { nome, valor: 0, data: d.toISOString().slice(0, 10) };
    if (modoEtapas) {
      // Modo etapas: só adiciona, usuário preenche o valor
      setParcelas([...parcelas, novaParcela]);
    } else {
      // Modo parcelas iguais: redistribui
      setParcelas(gerarParcelasIguais(parcelas.length + 1, totalFechado, "Parcela"));
    }
  }

  function removerParcela(i) {
    if (parcelas.length <= 1) return;
    if (modoEtapas) {
      setParcelas(parcelas.filter((_, idx) => idx !== i));
    } else {
      setParcelas(gerarParcelasIguais(parcelas.length - 1, totalFechado, "Parcela"));
    }
  }

  function trocarModoEtapas() {
    if (modoEtapas) {
      // Voltando para modo parcelas normais: divide total pelo número atual de etapas
      setParcelas(gerarParcelasIguais(parcelas.length || 1, totalFechado, "Parcela"));
      setModoEtapas(false);
    } else {
      // Indo para modo etapas: mantém parcelas atuais mas converte nomes
      setParcelas(atuais => atuais.map((p, i) => ({
        ...p,
        nome: i === 0 ? "Entrada" : (i === atuais.length - 1 ? "Na entrega" : `Etapa ${i + 1}`),
      })));
      setModoEtapas(true);
    }
  }

  // ── Desconto ⇄ Valor fechado (sincronia via totalFechado) ──
  function mudarDesconto(v) {
    let n = parseFloat(v);
    if (isNaN(n)) n = 0;
    if (n < 0) n = 0;
    if (n > 100) n = 100;
    // Captura desconto aplicado (usado depois pra preservar em mudanças de etapa)
    descAplicadoRef.current = n;
    // Converte desconto em totalFechado
    const novoTotal = Math.round(propTotal * (1 - n/100) * 100) / 100;
    setTotalFechado(novoTotal);
  }

  function mudarTotalFechado(v) {
    let n = parseFloat(v);
    if (isNaN(n) || n < 0) n = 0;
    if (n > propTotal) n = propTotal;
    const novoTotal = Math.round(n * 100) / 100;
    // Atualiza desconto aplicado (derivado)
    if (propTotal > 0) {
      descAplicadoRef.current = Math.round(((propTotal - novoTotal) / propTotal) * 10000) / 100;
    }
    setTotalFechado(novoTotal);
  }

  function confirmar() {
    // Bloqueia se houver diferença entre soma das parcelas e total fechado
    if (temDiferenca) {
      dialogo.alertar({
        titulo: "Ajuste os valores das parcelas",
        mensagem: `A soma das parcelas precisa bater com o total fechado.\n\nSoma atual: ${fmtBRL(somaParcelas)}\nTotal fechado: ${fmtBRL(totalFechado)}\nDiferença: ${diferencaParcelas > 0 ? "+" : ""}${fmtBRL(diferencaParcelas)}`,
        tipo: "aviso",
      });
      return;
    }

    const ganhoData = {
      tipoPagamentoOrc: tipoPgtoOrc,  // "padrao" ou "etapas"
      incluirImposto,
      aliqImposto: incluirImposto ? aliqImp : 0,
      inclArq,
      inclEng,
      valorArqFechado: fecArq,
      valorEngFechado: fecEng,
      valorTotalFechado: totalFechado,
      descontoPct,
      descontoRs,
      // No tipo "etapas", registra quais etapas foram fechadas com seus valores
      etapasFechadas: ehTipoEtapas
        ? etapas.filter(e => e.marcado).map(e => ({
            id: e.id,
            nome: e.nome,
            pct: e.pct,
            valor: Math.round((parseFloat(e.valor) || 0) * 100) / 100,
          }))
        : null,
      condicao: {
        tipo: modoEtapas ? "etapas" : (parcelas.length === 1 ? "antecipado" : "parcelado"),
        label: modoEtapas ? "Por etapas" : (parcelas.length === 1 ? "Antecipado" : `Parcelado ${parcelas.length}x`),
        parcelas: parcelas.map((p, i) => ({
          numero: i + 1,
          nome: p.nome,
          valor: Math.round((parseFloat(p.valor) || 0) * 100) / 100,
          data: p.data,
        })),
      },
    };
    onConfirmar(ganhoData);
  }

  // ── Formatação ──
  const fmtBRL = v => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtData = iso => {
    if (!iso) return "";
    const p = iso.split("-");
    return `${p[2]}/${p[1]}/${p[0].slice(2)}`;
  };

  // ── Estilos ──
  const SECTION_TITLE = { fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:0.8, marginBottom:10 };
  const ROW_LABEL     = { fontSize:11.5, color:"#6b7280", minWidth:60 };
  const INPUT_STYLE   = { fontSize:12.5, padding:"6px 10px", border:"1px solid #e5e7eb", borderRadius:6, fontFamily:"inherit", color:"#111", background:"#fff", outline:"none" };

  return (
    <div
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"flex-start", justifyContent:"center", zIndex:100, padding:"30px 20px 20px" }}>
      <style>{`
        .modal-ganho-date::-webkit-calendar-picker-indicator {
          padding: 0;
          margin-left: -2px;
          margin-right: 0;
          opacity: 0.5;
          cursor: pointer;
        }
        .modal-ganho-date::-webkit-calendar-picker-indicator:hover {
          opacity: 1;
        }
      `}</style>
      <div style={{ background:"#fff", borderRadius:12, width:"100%", maxWidth:540, maxHeight:"calc(100vh - 60px)", overflowY:"auto", boxShadow:"0 10px 40px rgba(0,0,0,0.2)" }}>

        {/* Head */}
        <div style={{ padding:"20px 24px 14px", borderBottom:"1px solid #f3f4f6", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:"#111", letterSpacing:-0.3 }}>Marcar como Ganho</div>
            <div style={{ fontSize:12, color:"#9ca3af", marginTop:3 }}>{orc.cliente || "—"} · {orc.id}</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", fontSize:20, color:"#9ca3af", cursor:"pointer", padding:"0 4px", lineHeight:1, fontFamily:"inherit" }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding:"18px 24px" }}>

          {/* Seção 1: Escopo */}
          <div style={{ marginBottom:22 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div style={SECTION_TITLE}>1. O que foi fechado</div>
              {temImpostoOrc && aliqImp > 0 && (
                <div
                  onClick={() => {
                    // Suprime o alerta vermelho durante a transição (evita piscar)
                    setEditandoImposto(true);
                    // Guarda desconto ANTES de mudar o imposto (será aplicado no novo total)
                    const descAtual = descontoPct;
                    const novoIncl = !incluirImposto;
                    setIncluirImposto(novoIncl);
                    // Calcula novo propTotal com o novo estado de imposto
                    const fator = (novoIncl && aliqImp > 0) ? (1 / (1 - aliqImp/100)) : 1;
                    let novoProp;
                    if (ehTipoEtapas) {
                      // As etapas serão recalculadas via useEffect de calcularEtapasBase
                      // Para o total, aproxima usando a soma das marcadas × fator de ajuste
                      const somaMarcadas = etapas.filter(e => e.marcado).reduce((s, e) => s + (parseFloat(e.valor) || 0), 0);
                      const fatorAntigo = (incluirImposto && aliqImp > 0) ? (1 / (1 - aliqImp/100)) : 1;
                      novoProp = Math.round((somaMarcadas / fatorAntigo) * fator * 100) / 100;
                    } else {
                      novoProp = ((inclArq ? baseArq : 0) + (inclEng ? baseEng : 0)) * fator;
                    }
                    const novoTotal = Math.round(novoProp * (1 - descAtual/100) * 100) / 100;
                    setTotalFechado(novoTotal);
                    // Libera o alerta depois que os useEffects propagaram
                    setTimeout(() => setEditandoImposto(false), 300);
                  }}
                  style={{
                    display:"flex", alignItems:"center", gap:6,
                    cursor:"pointer", padding:"4px 10px",
                    border:`1px solid ${incluirImposto ? "#111" : "#e5e7eb"}`,
                    borderRadius:5,
                    background: incluirImposto ? "#fafafa" : "transparent",
                    fontSize:11, fontWeight:500, color: incluirImposto ? "#111" : "#6b7280",
                    userSelect:"none",
                  }}>
                  <div style={{
                    width:13, height:13, borderRadius:3,
                    border:`1.5px solid ${incluirImposto ? "#111" : "#d1d5db"}`,
                    background: incluirImposto ? "#111" : "#fff",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    color:"#fff", fontSize:9, fontWeight:700, flexShrink:0,
                  }}>{incluirImposto ? "✓" : ""}</div>
                  Incluir imposto ({aliqImp}%)
                </div>
              )}
            </div>

            {ehTipoEtapas ? (
              // ── Tipo "etapas": lista de etapas com checkbox + valor editável ──
              <>
                {etapas.map((e, i) => {
                  const bord = e.marcado ? "#111" : "#e5e7eb";
                  return (
                    <div key={e.id}
                      style={{
                        display:"flex", alignItems:"center", gap:8,
                        padding:"10px 12px", border:`1px solid ${bord}`, borderRadius:7, marginBottom:6,
                        background: "#fff", transition:"border-color 0.12s",
                      }}>
                      <div onClick={() => toggleEtapa(e.id)} style={{ cursor:"pointer", display:"flex", alignItems:"center", gap:10, flex:1, minWidth:0 }}>
                        <div style={{
                          width:15, height:15, borderRadius:3,
                          border:`1.5px solid ${e.marcado ? "#111" : "#d1d5db"}`,
                          background: e.marcado ? "#111" : "#fff",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          color:"#fff", fontSize:10, fontWeight:700, flexShrink:0,
                        }}>{e.marcado ? "✓" : ""}</div>
                        <span style={{ fontSize:13, color: e.marcado ? "#111" : "#9ca3af", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {e.nome}{e.pct > 0 ? ` · ${e.pct}%` : ""}
                        </span>
                      </div>
                      <NumBR
                        valor={e.valor}
                        onChange={n => mudarValorEtapa(i, n)}
                        min={0}
                        decimais={2}
                        style={{
                          ...INPUT_STYLE, fontSize:12, padding:"5px 8px",
                          textAlign:"right", width:120,
                          opacity: e.marcado ? 1 : 0.4,
                        }}
                      />
                    </div>
                  );
                })}
              </>
            ) : (
              // ── Tipo "padrão": Arq / Eng ──
              <>
                {[
                  { key:"arq", label:"Arquitetura", valor:orcArq, marcado:inclArq, disponivel:temArq },
                  { key:"eng", label:"Engenharia",  valor:orcEng, marcado:inclEng, disponivel:temEng },
                ].map(item => {
                  const bord = !item.disponivel ? "#e5e7eb" : (item.marcado ? "#111" : "#e5e7eb");
                  return (
                    <div key={item.key}
                      onClick={() => item.disponivel && toggleEscopo(item.key)}
                      style={{
                        display:"flex", alignItems:"center", justifyContent:"space-between",
                        padding:"10px 12px", border:`1px solid ${bord}`, borderRadius:7, marginBottom:6,
                        cursor: item.disponivel ? "pointer" : "not-allowed",
                        opacity: item.disponivel ? 1 : 0.4,
                        background: item.disponivel ? "#fff" : "#fafafa",
                        transition:"border-color 0.12s",
                      }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{
                          width:15, height:15, borderRadius:3,
                          border:`1.5px solid ${item.marcado ? "#111" : "#d1d5db"}`,
                          background: item.marcado ? "#111" : "#fff",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          color:"#fff", fontSize:10, fontWeight:700,
                        }}>{item.marcado ? "✓" : ""}</div>
                        <span style={{ fontSize:13, color:"#111" }}>{item.label}</span>
                      </div>
                      <span style={{ fontSize:12.5, color: item.disponivel ? "#6b7280" : "#9ca3af" }}>
                        {item.valor > 0 ? fmtBRL(item.valor) : (item.disponivel ? "—" : "não incluso")}
                      </span>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Seção 2: Forma de pagamento */}
          <div style={{ marginBottom:22 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div style={SECTION_TITLE}>2. Forma de pagamento</div>
              <button onClick={trocarModoEtapas}
                style={{
                  fontSize:11, color: modoEtapas ? "#111" : "#6b7280",
                  background: modoEtapas ? "#fafafa" : "transparent",
                  border:`1px ${modoEtapas ? "solid #111" : "solid #e5e7eb"}`,
                  borderRadius:5, padding:"4px 10px", cursor:"pointer",
                  fontFamily:"inherit", fontWeight:500,
                }}>
                {modoEtapas ? "✓ Por etapas" : "Trocar por etapas"}
              </button>
            </div>

            <div style={{
              padding:"14px 16px", border:"1px solid #e5e7eb",
              borderRadius:7, background:"#fff",
            }}>
              {/* Linha de controles: Desconto e Parcelas */}
              <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:12, flexWrap:"wrap" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <label style={ROW_LABEL}>Desconto</label>
                  <NumBR valor={descontoPct} onChange={mudarDesconto} min={0} max={100} decimais={2}
                    onFocus={() => setEditandoDesconto(true)}
                    onBlur={() => setEditandoDesconto(false)}
                    style={{ ...INPUT_STYLE, width:80 }} />
                  <span style={{ fontSize:11.5, color:"#9ca3af" }}>%</span>
                </div>
                {!modoEtapas && (
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <label style={ROW_LABEL}>Parcelas</label>
                    <InputQtdParcelas
                      qtd={parcelas.length}
                      onCommit={mudarQtdParcelas}
                      style={{ ...INPUT_STYLE, width:70 }}
                    />
                  </div>
                )}
              </div>

              {/* Lista de parcelas/etapas */}
              <div style={{ background:"#fafafa", border:"1px solid #f3f4f6", borderRadius:7, padding:10 }}>
                {parcelas.map((p, i) => {
                  const pct = totalFechado > 0 ? (p.valor / totalFechado) * 100 : 0;
                  return (
                  <div key={i} style={{
                    display:"grid",
                    gridTemplateColumns: modoEtapas ? "1fr 56px 90px 105px 18px" : "100px 100px 105px 18px",
                    gap:5, alignItems:"center", marginBottom:6,
                  }}>
                    {modoEtapas ? (
                      <input type="text" value={p.nome}
                        onChange={e => mudarParcelaCampo(i, "nome", e.target.value)}
                        placeholder="Descrição"
                        style={{ ...INPUT_STYLE, fontSize:12, padding:"5px 8px" }} />
                    ) : (
                      <span style={{ fontSize:11.5, color:"#6b7280", fontWeight:500 }}>{p.nome}</span>
                    )}
                    {modoEtapas && (
                      <div style={{ display:"flex", alignItems:"center", gap:2 }}>
                        <NumBR valor={pct} onChange={n => mudarParcelaPct(i, n)} min={0} max={100} decimais={2}
                          style={{ ...INPUT_STYLE, fontSize:12, padding:"5px 6px", textAlign:"right", width:"100%" }} />
                        <span style={{ fontSize:10, color:"#9ca3af" }}>%</span>
                      </div>
                    )}
                    <NumBR valor={p.valor} onChange={n => mudarParcelaCampo(i, "valor", n)} min={0} decimais={2}
                      style={{ ...INPUT_STYLE, fontSize:12, padding:"5px 8px", textAlign:"right" }} />
                    <input type="date" value={p.data}
                      className="modal-ganho-date"
                      onChange={e => mudarParcelaCampo(i, "data", e.target.value)}
                      style={{ ...INPUT_STYLE, fontSize:11.5, padding:"5px 2px 5px 4px", boxSizing:"border-box", width:"100%", minWidth:0 }} />
                    {parcelas.length > 1 ? (
                      <button onClick={() => removerParcela(i)}
                        style={{ background:"transparent", border:"none", color:"#9ca3af", cursor:"pointer", fontSize:14, padding:0, lineHeight:1, fontFamily:"inherit" }}>×</button>
                    ) : <span/>}
                  </div>
                  );
                })}
                {modoEtapas && (
                  <button onClick={adicionarParcela}
                    style={{ fontSize:11.5, background:"transparent", border:"1px dashed #d1d5db", borderRadius:5, padding:"5px 10px", cursor:"pointer", color:"#6b7280", fontFamily:"inherit", marginTop:4 }}>
                    + Adicionar etapa
                  </button>
                )}
              </div>

              {/* Alerta de diferença entre soma e total fechado */}
              {temDiferenca && parcelas.length > 1 && !editandoTotal && !editandoDesconto && !editandoImposto && (
                <div style={{
                  marginTop:10, padding:"8px 10px",
                  background:"#fef2f2", border:"1px solid #fecaca",
                  borderRadius:6, fontSize:11.5, color:"#b91c1c",
                  display:"flex", alignItems:"center", gap:6,
                }}>
                  <span style={{ fontSize:13, fontWeight:700 }}>⚠</span>
                  <div>
                    Soma das parcelas ({fmtBRL(somaParcelas)}) não bate com o total fechado ({fmtBRL(totalFechado)}).
                    Diferença: <strong>{diferencaParcelas > 0 ? "+" : ""}{fmtBRL(diferencaParcelas)}</strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Valor fechado */}
          <div style={{ background:"#fafafa", border:"1px solid #e5e7eb", borderRadius:8, padding:"12px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:14 }}>
            <div>
              <div style={{ fontSize:12, color:"#111", fontWeight:600 }}>Valor fechado total</div>
              <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>
                Proposto {fmtBRL(propTotal)}
                {descontoPct > 0 && ` · ${descontoPct.toFixed(2).replace(/\.?0+$/, "").replace(".", ",")}% de desconto`}
              </div>
            </div>
            <NumBR valor={totalFechado} onChange={mudarTotalFechado} min={0} max={propTotal} decimais={2}
              onFocus={() => setEditandoTotal(true)}
              onBlur={() => setEditandoTotal(false)}
              style={{ fontSize:15, fontWeight:600, padding:"6px 10px", border:"1px solid #e5e7eb", borderRadius:6, background:"#fff", width:140, textAlign:"right", fontFamily:"inherit", color:"#111", outline:"none" }} />
          </div>

          {/* Resumo */}
          <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, padding:"14px 16px" }}>
            <div style={SECTION_TITLE}>Resumo</div>
            {inclArq && (
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12.5, padding:"3px 0", color:"#374151" }}>
                <span>Arquitetura</span><span>{fmtBRL(fecArq)}</span>
              </div>
            )}
            {inclEng && (
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12.5, padding:"3px 0", color:"#374151" }}>
                <span>Engenharia</span><span>{fmtBRL(fecEng)}</span>
              </div>
            )}
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:13.5, padding:"8px 0 3px 0", borderTop:"1px solid #f3f4f6", marginTop:6, fontWeight:600, color:"#111" }}>
              <span>Total fechado</span><span>{fmtBRL(totalFechado)}</span>
            </div>
            {incluirImposto && aliqImp > 0 && (() => {
              // Valor do imposto embutido no total fechado: total × aliq
              const valorImposto = Math.round(totalFechado * (aliqImp/100) * 100) / 100;
              return (
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#9ca3af", marginTop:3 }}>
                  <span>inclui imposto ({aliqImp}%)</span>
                  <span>{fmtBRL(valorImposto)}</span>
                </div>
              );
            })()}
            {descontoRs > 0 && (
              <div style={{ fontSize:11, color:"#9ca3af", marginTop:4 }}>
                Desconto de {fmtBRL(descontoRs)}
              </div>
            )}
            <div style={{ fontSize:11.5, color:"#374151", marginTop:8, padding:"8px 10px", background:"#fafafa", borderRadius:6 }}>
              {parcelas.length === 0 ? null : parcelas.length === 1 ? (
                <><strong>{parcelas[0].nome}</strong> · {fmtBRL(parcelas[0].valor)} · {fmtData(parcelas[0].data)}</>
              ) : (
                <>
                  <strong>{parcelas.length} pagamento{parcelas.length !== 1 ? "s" : ""}</strong>
                  <div style={{ marginTop:4, color:"#6b7280", fontSize:11 }}>
                    {parcelas.map((p, i) => (
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"1px 0" }}>
                        <span>{p.nome}</span>
                        <span>{fmtBRL(p.valor)} · {fmtData(p.data)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:"14px 24px 18px", borderTop:"1px solid #f3f4f6", display:"flex", justifyContent:"flex-end", gap:8 }}>
          <button onClick={onClose}
            style={{ padding:"8px 16px", background:"#fff", border:"1px solid #e5e7eb", borderRadius:7, fontSize:12.5, cursor:"pointer", color:"#374151", fontFamily:"inherit" }}>
            Cancelar
          </button>
          <button onClick={confirmar}
            disabled={temDiferenca}
            title={temDiferenca ? `A soma das parcelas precisa bater com o total fechado (diferença: ${fmtBRL(diferencaParcelas)})` : ""}
            style={{
              padding:"8px 18px",
              background: temDiferenca ? "#d1d5db" : "#111",
              color:"#fff", border:"none", borderRadius:7,
              fontSize:12.5, fontWeight:500,
              cursor: temDiferenca ? "not-allowed" : "pointer",
              fontFamily:"inherit",
            }}>
            Confirmar
          </button>
        </div>

      </div>
    </div>
  );
}

function AreaDetalhe({ calculo, fmtNum }) {
  const [aberto, setAberto] = useState(false);
  const [engAberto, setEngAberto] = useState(false);
  const fmt2  = (v) => fmtNum(v);
  const brl  = (v) => v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const m2s  = (v, a) => a > 0 ? ` · R$ ${fmt2(Math.round(v/a*100)/100)}/m²` : "";
  const pct  = (v) => (v * 100).toLocaleString("pt-BR",{minimumFractionDigits:0,maximumFractionDigits:0}) + "%";
  const row  = (lbl, val, opts={}) => (
    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:3, ...opts.style }}>
      <span style={{ color: opts.lblColor||"#6b7280" }}>{lbl}</span>
      <span style={{ color: opts.valColor||"#374151", fontWeight: opts.bold?600:400 }}>{val}</span>
    </div>
  );
  return (
    <div style={{ background:"#f4f5f7", border:"1px solid #dde0e5", borderRadius:8, padding:"10px 14px", marginBottom:10, fontSize:13, color:"#374151" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ fontSize:13, color:"#828a98" }}>Área útil</span>
        <span style={{ fontSize:14, color:"#374151" }}>{fmt2(calculo.areaBruta)} m²</span>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:13, color:"#828a98" }}>Área total (+circ.)</span>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:14, fontWeight:600, color:"#111" }}>{fmt2(calculo.areaTotal)} m²</span>
          <span onClick={() => setAberto(v => !v)}
            style={{ cursor:"pointer", fontSize:11, color:"#828a98", userSelect:"none", lineHeight:1 }}>
            {aberto ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {aberto && (
        <div style={{ marginTop:12, paddingTop:10, borderTop:"1px solid #c8cdd6", display:"flex", flexDirection:"column", gap:5 }}>
          {calculo.isComercial ? (<>
            {row("Área útil", fmt2(calculo.areaBruta)+" m²")}
            {row(`+ ${pct(calculo.acrescimoCirk)} Circulação`, `+${fmt2(Math.round(calculo.areaBruta*calculo.acrescimoCirk*100)/100)} m²`)}
            {(calculo.blocosCom||[]).map((b,i) => (
              <div key={i} style={{ borderTop:"1px solid #c8cdd6", marginTop:6, paddingTop:6 }}>
                {b.label === "Área Comum" ? (<>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontWeight:700, color:"#374151", marginBottom:3 }}>
                    <span>Área Comum · {fmt2(b.area1)} m²</span>
                    <span>{brl(b.precoTot)}{m2s(b.precoTot, b.area1)}</span>
                  </div>
                </>) : (<>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontWeight:700, color:"#374151", marginBottom:3 }}>
                    <span>{b.n > 1 ? `${b.n} ${b.label}s` : b.label} · {fmt2(b.area1)} m² cada · total {fmt2(Math.round(b.area1*b.n*100)/100)} m²</span>
                  </div>
                  {row(`${b.label} (1ª unid.)`, `${brl(b.precoUni)}${m2s(b.precoUni, b.area1)}`, { bold: false })}
                  {b.n > 1 && row(`Total ${b.label}s`, `${brl(b.precoTot)}${m2s(b.precoTot, b.area1*b.n)}`, { bold: true, valColor:"#111" })}
                </>)}
              </div>
            ))}
            {calculo.precoFachada > 0 && (
              <div style={{ borderTop:"1px solid #c8cdd6", marginTop:6, paddingTop:6 }}>
                {row("+15% Fachada", brl(calculo.precoFachada), { bold:false })}
              </div>
            )}
            <div style={{ borderTop:"1px solid #c8cdd6", marginTop:6, paddingTop:6 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <div style={{ fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1 }}>Engenharia <span style={{ fontSize:8, fontWeight:400, letterSpacing:0, textTransform:"none" }}>(Faixas de desconto)</span></div>
                <span onClick={() => setEngAberto(v => !v)} style={{ cursor:"pointer", fontSize:11, color:"#828a98", userSelect:"none" }}>{engAberto ? "▲" : "▼"}</span>
              </div>
              {engAberto && calculo.faixasEng.map((f, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:3 }}>
                  <span style={{ color:"#6b7280" }}>
                    {f.desconto > 0 ? `−${f.desconto.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}% · ` : ""}{fmt2(f.area)} m² × R$ {fmt2(Math.round(f.fator*50*100)/100)}/m²
                  </span>
                  <span style={{ color:"#374151", fontWeight:500 }}>R$ {fmt2(Math.round(f.preco*100)/100)}</span>
                </div>
              ))}
            </div>
          </>) : (<>
            {calculo.nRep > 1 && row(`Área Total (${calculo.nRep}x)`, `${fmt2(calculo.areaTotal)} m² → Total ${fmt2(calculo.areaTot)} m²`)}
            {row("Total de ambientes", calculo.totalAmbientes)}
            {row("Área útil", fmt2(calculo.areaBruta)+" m²")}
            {calculo.areaPiscina > 0 && row("Piscina (Excluído)", fmt2(calculo.areaPiscina)+" m²")}
            {(() => {
              const base = (calculo.areaBruta||0) + (calculo.areaPiscina||0);
              const cirkReal = base > 0 ? Math.round((calculo.areaTotal/base - 1)*100) : 0;
              const vCirk = Math.round(base*(cirkReal/100)*100)/100;
              return row(`+ ${cirkReal}% Circulação e paredes`, `+${fmt2(vCirk)} m²`);
            })()}
            <div style={{ borderTop:"1px solid #c8cdd6", marginTop:4, paddingTop:6 }}>
              <div style={{ fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Índice multiplicador</div>
              {row("Qtd de cômodos", calculo.indiceComodos.toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3}))}
              {row("Padrão", calculo.indicePadrao.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1}))}
              {row("Fator multiplicar", `x${calculo.fatorMult.toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3})}`, { bold:true, valColor:"#111" })}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, borderTop:"1px solid #c8cdd6", paddingTop:6, marginTop:2 }}>
              <span style={{ color:"#6b7280" }}>Preço base</span>
              <span style={{ color:"#374151" }}>{fmt2(calculo.precoBaseVal)} × {calculo.fatorMult.toLocaleString("pt-BR",{minimumFractionDigits:3,maximumFractionDigits:3})} = {fmt2(Math.round(calculo.precoBaseVal*calculo.fatorMult*100)/100)} R$/m²</span>
            </div>
            <div style={{ borderTop:"1px solid #c8cdd6", marginTop:4, paddingTop:6 }}>
              <div style={{ fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Faixa de Desconto — Arquitetura (1ª Unidade)</div>
              {calculo.faixasArqDet.map((f, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:3 }}>
                  <span style={{ color:"#6b7280" }}>{f.desconto > 0 ? `−${pct(f.desconto)} · ` : ""}{fmt2(f.area)} m² × R$ {fmt2(Math.round(f.precoM2*100)/100)}/m²</span>
                  <span style={{ color:"#374151", fontWeight:500 }}>R$ {fmt2(f.preco)}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop:"1px solid #c8cdd6", marginTop:4, paddingTop:6 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                <div style={{ fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1 }}>Engenharia <span style={{ fontSize:8, fontWeight:400, letterSpacing:0 }}>(Faixas de desconto)</span></div>
                <span onClick={() => setEngAberto(v => !v)} style={{ cursor:"pointer", fontSize:11, color:"#828a98", userSelect:"none" }}>{engAberto ? "▲" : "▼"}</span>
              </div>
              {engAberto && calculo.faixasEng.map((f, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginTop:3 }}>
                  <span style={{ color:"#6b7280" }}>{f.desconto > 0 ? `−${f.desconto.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}% · ` : ""}{fmt2(f.area)} m² × R$ {fmt2(Math.round(f.fator*50*100)/100)}/m²</span>
                  <span style={{ color:"#374151", fontWeight:500 }}>R$ {fmt2(Math.round(f.preco*100)/100)}</span>
                </div>
              ))}
            </div>
          </>)}
        </div>
      )}
    </div>
  );
}

function ResumoDetalhes({ calculo, fmtNum, C, temImposto, aliqImp }) {
  const [arqAberto, setArqAberto] = useState(false);
  const [engAberto, setEngAberto] = useState(false);
  const fmt2   = (v) => v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const hasRep = calculo.nRep > 1;
  const totalGeral = calculo.precoArq + calculo.precoEng;
  const m2Total = calculo.areaTot > 0 ? Math.round(totalGeral / calculo.areaTot * 100) / 100 : 0;

  // Imposto inside-out: total já é o líquido; bruto = liquido / (1 - aliq/100)
  const aliq = aliqImp || 16;
  const totalComImp = temImposto && totalGeral > 0
    ? Math.round(totalGeral / (1 - aliq/100) * 100) / 100
    : totalGeral;
  const valorImposto = totalComImp - totalGeral;

  // Ícone "grupo" SVG inline (people-icon)
  const IconUnidades = ({ size = 13 }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink:0 }}>
      <circle cx="6" cy="5" r="2.2" stroke="#828a98" strokeWidth="1.3"/>
      <path d="M2.5 12c0-1.8 1.6-3.2 3.5-3.2s3.5 1.4 3.5 3.2" stroke="#828a98" strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="11.5" cy="4.5" r="1.6" stroke="#828a98" strokeWidth="1.2"/>
      <path d="M9.5 11c.6-1.2 1.5-2 2.7-2 1.4 0 2.4.9 2.4 2.4" stroke="#828a98" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );

  return (
    <>
      {/* TOTAL GERAL — destaque no topo */}
      <div style={{ marginTop:0, marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
          <div style={{ fontSize:11, color:"#6b7280", textTransform:"uppercase", letterSpacing:1, fontWeight:600 }}>Total Geral</div>
          {hasRep && (
            <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:13, color:"#828a98", fontWeight:500 }}>
              <span>{calculo.nRep} unid · {fmtNum(calculo.areaTot)}/m²</span>
            </div>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
          <span style={{ fontSize:22, fontWeight:700, color:"#111" }}>{fmt2(totalComImp)}</span>
          <span style={{ fontSize:13, color:"#828a98" }}>R$ {fmtNum(calculo.areaTot > 0 ? Math.round(totalComImp / calculo.areaTot * 100) / 100 : 0)}/m²</span>
        </div>
        {/* Imposto inline — só quando temImposto E há valor */}
        {temImposto && valorImposto > 0 && (
          <div style={{ fontSize:11.5, color:"#dc2626", marginTop:4, fontWeight:500 }}>
            inclui imposto ({aliq}%) — {fmt2(valorImposto)}
          </div>
        )}
      </div>

      {/* ARQUITETURA */}
      {calculo.precoArq > 0 && (
        <div style={{ paddingTop:14, borderTop:"1px solid #e5e7eb" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:12, color:"#6b7280", textTransform:"uppercase", letterSpacing:1, fontWeight:600 }}>Arquitetura</span>
              {totalGeral > 0 && (
                <span style={{ fontSize:11, fontWeight:600, color:"#6b7280", padding:"2px 7px", background:"#f4f5f7", border:"1px solid #e5e7eb", borderRadius:999 }}>
                  {Math.round(calculo.precoArq / totalGeral * 100)}%
                </span>
              )}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:14.5, fontWeight:700, color:"#111" }}>{fmt2(calculo.precoArq)}</span>
              <span style={{ fontSize:12, color:"#828a98" }}>R$ {fmtNum(calculo.precoM2Arq)}/m²</span>
              {hasRep && (
                <span onClick={() => setArqAberto(v => !v)} style={{ cursor:"pointer", fontSize:11, color:"#828a98", userSelect:"none", marginLeft:2 }}>
                  {arqAberto ? "▲" : "▼"}
                </span>
              )}
            </div>
          </div>
          {hasRep && arqAberto && (
            <div style={{ marginTop:8, paddingLeft:10, borderLeft:"2px solid #e5e7eb", display:"flex", flexDirection:"column", gap:4 }}>
              {calculo.unidades.map(u => {
                const pct = u.und > 1 ? Math.round(calculo.pctRep * 100) : null;
                const m2u = calculo.areaTotal > 0 ? Math.round(u.arq / calculo.areaTotal * 100) / 100 : 0;
                return (
                  <div key={u.und} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#6b7280" }}>
                    <span>Und {u.und}{pct ? ` (${pct}%)` : ""}</span>
                    <span style={{ color:"#374151" }}>{fmt2(u.arq)} <span style={{ color:"#9ca3af", fontSize:11 }}>· {fmtNum(m2u)}/m²</span></span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ENGENHARIA */}
      {calculo.precoEng > 0 && (
        <div style={{ paddingTop:14, marginTop:14, borderTop:"1px solid #e5e7eb" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:12, color:"#6b7280", textTransform:"uppercase", letterSpacing:1, fontWeight:600 }}>Engenharia</span>
              {totalGeral > 0 && (
                <span style={{ fontSize:11, fontWeight:600, color:"#6b7280", padding:"2px 7px", background:"#f4f5f7", border:"1px solid #e5e7eb", borderRadius:999 }}>
                  {Math.round(calculo.precoEng / totalGeral * 100)}%
                </span>
              )}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:14.5, fontWeight:700, color:"#111" }}>{fmt2(calculo.precoEng)}</span>
              <span style={{ fontSize:12, color:"#828a98" }}>R$ {fmtNum(calculo.precoM2Eng)}/m²</span>
              {hasRep && (
                <span onClick={() => setEngAberto(v => !v)} style={{ cursor:"pointer", fontSize:11, color:"#828a98", userSelect:"none", marginLeft:2 }}>
                  {engAberto ? "▲" : "▼"}
                </span>
              )}
            </div>
          </div>
          {hasRep && engAberto && (
            <div style={{ marginTop:8, paddingLeft:10, borderLeft:"2px solid #e5e7eb", display:"flex", flexDirection:"column", gap:4 }}>
              {calculo.unidades.map(u => {
                const pct = u.und > 1 ? Math.round(calculo.pctRep * 100) : null;
                const m2u = calculo.areaTotal > 0 ? Math.round(u.eng / calculo.areaTotal * 100) / 100 : 0;
                return (
                  <div key={u.und} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#6b7280" }}>
                    <span>Und {u.und}{pct ? ` (${pct}%)` : ""}</span>
                    <span style={{ color:"#374151" }}>{fmt2(u.eng)} <span style={{ color:"#9ca3af", fontSize:11 }}>· {fmtNum(m2u)}/m²</span></span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers de edição inline — top-level para preservar identidade
// entre re-renders e manter o foco ao clicar
// ─────────────────────────────────────────────────────────────
function TextoEditavel({ valor, onChange, style={}, multiline=false, placeholder="" }) {
  const [editando, setEditando] = useState(false);
  const [tmp, setTmp] = useState(valor);
  if (editando) {
    const baseStyle = { fontSize:"inherit", fontWeight:"inherit", color:"inherit", fontFamily:"inherit",
      lineHeight:"inherit", letterSpacing:"inherit", background:"#fffde7",
      border:"1px solid #b0b7c3", borderRadius:4, padding:"2px 6px", outline:"none",
      width:"100%", resize: multiline ? "vertical" : "none", boxSizing:"border-box" };
    return multiline
      ? <textarea autoFocus value={tmp} onChange={e=>setTmp(e.target.value)}
          onBlur={()=>{ onChange(tmp); setEditando(false); }}
          style={{ ...baseStyle, minHeight:60, display:"block" }} />
      : <input autoFocus value={tmp} onChange={e=>setTmp(e.target.value)}
          onBlur={()=>{ onChange(tmp); setEditando(false); }}
          onKeyDown={e=>{ if(e.key==="Enter") e.target.blur(); if(e.key==="Escape") setEditando(false); }}
          style={baseStyle} />;
  }
  return (
    <span onClick={()=>{ setTmp(valor); setEditando(true); }}
      title="Clique para editar"
      style={{ cursor:"pointer", ...style }}>
      {valor || placeholder}
    </span>
  );
}

// Textarea sempre visível com state local — commit apenas no blur.
// Só sincroniza com valor externo quando ele MUDA de fora
// (não quando recebe de volta o próprio valor commitado).
function TextareaControlado({ valor, onCommit, placeholder="", style={}, minHeight=60 }) {
  const [local, setLocal] = useState(valor || "");
  const [focado, setFocado] = useState(false);
  const ultimoExterno = useRef(valor || "");
  useEffect(() => {
    const externo = valor || "";
    if (externo !== ultimoExterno.current) {
      ultimoExterno.current = externo;
      setLocal(externo);
    }
  }, [valor]);
  return (
    <textarea
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={() => setFocado(true)}
      onBlur={() => {
        setFocado(false);
        if (local !== (valor || "")) {
          ultimoExterno.current = local;
          onCommit(local);
        }
      }}
      placeholder={focado ? "" : placeholder}
      style={{ width:"100%", fontSize:13, color:"#6b7280", fontFamily:"inherit", lineHeight:1.7,
        border:"1px solid #c8cdd6", borderRadius:6, padding:"6px 10px", outline:"none",
        resize:"vertical", minHeight, boxSizing:"border-box", background:"#f5f6f8", ...style }}
    />
  );
}

// Input single-line com mesmo visual/comportamento do TextareaControlado
function InputControlado({ valor, onCommit, placeholder="", style={} }) {
  const [local, setLocal] = useState(valor || "");
  const [focado, setFocado] = useState(false);
  const ultimoExterno = useRef(valor || "");
  useEffect(() => {
    const externo = valor || "";
    if (externo !== ultimoExterno.current) {
      ultimoExterno.current = externo;
      setLocal(externo);
    }
  }, [valor]);
  return (
    <input
      type="text"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={() => setFocado(true)}
      onBlur={() => {
        setFocado(false);
        if (local !== (valor || "")) {
          ultimoExterno.current = local;
          onCommit(local);
        }
      }}
      onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
      placeholder={focado ? "" : placeholder}
      style={{ fontSize:13, color:"#111", fontFamily:"inherit", fontWeight:600,
        border:"1px solid #c8cdd6", borderRadius:6, padding:"4px 10px", outline:"none",
        boxSizing:"border-box", background:"#f5f6f8", ...style }}
    />
  );
}

// Input de valor monetário com commit no blur
function EtapaValorInput({ valorAtual, fmtN, onCommit, borderColor, color }) {
  const [local, setLocal] = useState(fmtN(valorAtual));
  const [focado, setFocado] = useState(false);
  const ultimoExterno = useRef(valorAtual);
  useEffect(() => {
    if (!focado && valorAtual !== ultimoExterno.current) {
      ultimoExterno.current = valorAtual;
      setLocal(fmtN(valorAtual));
    }
  }, [valorAtual, focado, fmtN]);
  return (
    <input type="text"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={e => { setFocado(true); e.target.select(); }}
      onBlur={() => {
        setFocado(false);
        const raw = local.replace(/\./g, "").replace(",", ".");
        const num = parseFloat(raw);
        if (!isNaN(num) && num >= 0) {
          ultimoExterno.current = num;
          onCommit(num);
        } else {
          setLocal(fmtN(valorAtual));
        }
      }}
      onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { setLocal(fmtN(valorAtual)); e.target.blur(); } }}
      style={{ width:"100%", fontSize:12, padding:"3px 6px", border:`1px solid ${borderColor}`, borderRadius:4, textAlign:"right", fontFamily:"inherit", outline:"none", fontWeight:500, color, background:"transparent" }} />
  );
}

// Input numérico genérico (inteiro ou decimal) com commit no blur.
// Mantém estado LOCAL durante a digitação pra evitar perda de foco quando
// o estado externo desencadeia re-renders (ex: redistribuição de percentuais).
function NumInput({ valor, onCommit, decimais = 2, min = 0, max = 100, width = 50, style = {} }) {
  const [local, setLocal] = useState(String(valor).replace(".",","));
  const [focado, setFocado] = useState(false);
  const ultimoExterno = useRef(valor);
  useEffect(() => {
    if (!focado && valor !== ultimoExterno.current) {
      ultimoExterno.current = valor;
      setLocal(String(valor).replace(".",","));
    }
  }, [valor, focado]);
  return (
    <input type="text"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={e => { setFocado(true); e.target.select(); }}
      onBlur={() => {
        setFocado(false);
        const raw = local.replace(",", ".");
        let num = parseFloat(raw);
        if (isNaN(num)) { setLocal(String(valor).replace(".",",")); return; }
        num = Math.max(min, Math.min(max, num));
        if (decimais === 0) num = Math.round(num);
        ultimoExterno.current = num;
        onCommit(num);
      }}
      onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { setLocal(String(valor).replace(".",",")); e.target.blur(); } }}
      style={{ width, fontSize:12, padding:"3px 6px", border:"1px solid #e5e7eb", borderRadius:4, textAlign:"center", fontFamily:"inherit", outline:"none", ...style }} />
  );
}

// Helper: bloco de opções de pagamento (espelha o PDF)
// tipo: "pacote" (mostra valores) ou "etapaAEtapa" (só descreve)
// Para "pacote": valor, desc%, parcelas
// Para "etapaAEtapa": só desc% e parcelas
function OpcoesPagamento({ tipo, valor, desc, parcelas, fmtV }) {
  const MD = "#6b7280";
  const INK = "#111827";
  const styleContainer = { fontSize:12, color:MD, marginTop:8, lineHeight:1.6 };
  const styleLabel = { fontWeight:600, color:INK };
  const styleValor = { color:INK, fontWeight:600 };
  if (tipo === "etapaAEtapa") {
    return (
      <div style={styleContainer}>
        <div style={{ marginBottom:3 }}>
          <span style={styleLabel}>Opção 1: </span>
          Cada etapa paga antecipadamente com {desc}% de desconto.
        </div>
        <div>
          <span style={styleLabel}>Opção 2: </span>
          {parcelas > 1
            ? <>Cada etapa parcelada em {parcelas}× (entrada + {parcelas-1}× ao longo da etapa). <span style={{ fontSize:10, color:"#9ca3af" }}>sem desconto</span></>
            : <>Cada etapa paga à vista no início.</>}
        </div>
      </div>
    );
  }
  // pacote — mantém layout com valores literais
  const valorComDesc = Math.round(valor * (1 - desc/100) * 100) / 100;
  const parcVal = Math.round(valor / parcelas * 100) / 100;
  return (
    <div style={styleContainer}>
      <div style={{ marginBottom:3 }}>
        <span style={styleLabel}>Opção 1 — Pagamento antecipado ({desc}% de desconto):</span>{" "}
        De {fmtV(valor)} por <span style={styleValor}>{fmtV(valorComDesc)}</span>
      </div>
      <div>
        <span style={styleLabel}>
          Opção 2 — {parcelas > 1 ? `Parcelado em ${parcelas}× sem desconto` : "À vista"}:
        </span>{" "}
        {parcelas > 1
          ? <>Entrada de <span style={styleValor}>{fmtV(parcVal)}</span> + {parcelas-1}× de <span style={styleValor}>{fmtV(parcVal)}</span></>
          : <span style={styleValor}>{fmtV(valor)}</span>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VISUALIZADOR DE PROPOSTA (snapshot de imagens do PDF)
// ═══════════════════════════════════════════════════════════════
// Modal overlay que mostra as páginas da proposta como imagens.
// É um registro imutável — literalmente as imagens renderizadas
// do PDF no momento em que a proposta foi enviada ao cliente.
function PropostaVisualizer({ proposta, onFechar, onEditar }) {
  const [baixando, setBaixando] = useState(false);
  const [confirmEditar, setConfirmEditar] = useState(false);

  // Fecha com ESC
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  // Trava scroll da página atrás enquanto o modal está aberto
  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, []);

  if (!proposta) return null;
  const imagens = proposta.imagensPdf || [];
  const temImagens = imagens.length > 0;
  const dataFmt = proposta.enviadaEm
    ? new Date(proposta.enviadaEm).toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" })
    : "";

  // Gera PDF a partir das imagens salvas — garante fidelidade visual 100% ao que foi enviado
  async function baixarPdf() {
    if (!temImagens) { dialogo.alertar({ titulo: "Sem imagens salvas", mensagem: "Esta proposta não tem imagens salvas.", tipo: "aviso" }); return; }
    if (!window.jspdf) { dialogo.alertar({ titulo: "Aguarde alguns segundos", mensagem: "A biblioteca de PDF ainda está carregando. Tente novamente em 2 segundos.", tipo: "aviso" }); return; }
    try {
      setBaixando(true);
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit:"mm", format:"a4", orientation:"portrait" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      for (let i = 0; i < imagens.length; i++) {
        const src = imagens[i];
        // Descobre dimensões da imagem pra calcular aspect ratio correto
        const dims = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => resolve({ w: pageW, h: pageH });
          img.src = src;
        });
        // Encaixa na página A4 mantendo proporção
        const ratio = Math.min(pageW / dims.w, pageH / dims.h);
        const w = dims.w * ratio;
        const h = dims.h * ratio;
        const x = (pageW - w) / 2;
        const y = (pageH - h) / 2;
        if (i > 0) doc.addPage();
        doc.addImage(src, "JPEG", x, y, w, h, undefined, "FAST");
      }

      const nome = (proposta.clienteNome || "proposta").replace(/\s+/g, "-").toLowerCase();
      const versao = proposta.versao || "v1";
      doc.save(`proposta-${nome}-${versao}.pdf`);
    } catch(e) {
      console.error(e);
      dialogo.alertar({ titulo: "Erro ao gerar PDF", mensagem: e.message, tipo: "erro" });
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}
      style={{
        position:"fixed", inset:0, background:"rgba(17,24,39,0.85)",
        zIndex:300, display:"flex", flexDirection:"column",
        backdropFilter:"blur(4px)",
      }}
    >
      {/* Header fixo */}
      <div style={{
        background:"rgba(255,255,255,0.05)", borderBottom:"1px solid rgba(255,255,255,0.1)",
        padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between",
        color:"#fff", flexShrink:0,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ fontSize:14, fontWeight:600 }}>📄 Proposta {proposta.versao}</div>
          {dataFmt && <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)" }}>enviada em {dataFmt}</div>}
          {proposta.clienteNome && (
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)" }}>· {proposta.clienteNome}</div>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {onEditar && (
            <button
              onClick={() => setConfirmEditar(true)}
              style={{
                background:"rgba(255,255,255,0.12)",
                border:"1px solid rgba(255,255,255,0.2)",
                color:"#fff", borderRadius:6, padding:"6px 12px",
                cursor:"pointer", fontSize:13, fontFamily:"inherit",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
            >
              ✎ Editar
            </button>
          )}
          {temImagens && (
            <button
              onClick={baixarPdf}
              disabled={baixando}
              style={{
                background: baixando ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.12)",
                border:"1px solid rgba(255,255,255,0.2)",
                color:"#fff", borderRadius:6, padding:"6px 12px",
                cursor: baixando ? "not-allowed" : "pointer", fontSize:13, fontFamily:"inherit",
                opacity: baixando ? 0.6 : 1,
              }}
              onMouseEnter={e => { if (!baixando) e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
              onMouseLeave={e => { if (!baixando) e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
            >
              {baixando ? "Gerando…" : "⬇ Baixar PDF"}
            </button>
          )}
          <button
            onClick={onFechar}
            style={{
              background:"transparent", border:"1px solid rgba(255,255,255,0.2)",
              color:"#fff", borderRadius:6, padding:"6px 12px",
              cursor:"pointer", fontSize:13, fontFamily:"inherit",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            ✕ Fechar
          </button>
        </div>
      </div>

      {/* Área de scroll com páginas */}
      <div style={{
        flex:1, overflowY:"auto", padding:"24px 20px",
        display:"flex", flexDirection:"column", alignItems:"center", gap:16,
      }}>
        {temImagens ? (
          imagens.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`Página ${i+1}`}
              style={{
                maxWidth:"min(900px, 100%)", width:"100%",
                boxShadow:"0 8px 32px rgba(0,0,0,0.4)",
                borderRadius:4, background:"#fff",
                display:"block",
              }}
            />
          ))
        ) : (
          <div style={{
            background:"#fff", borderRadius:10, padding:"40px 32px",
            maxWidth:520, textAlign:"center",
            border: proposta.expirouEm ? "1px solid #fecaca" : "none",
          }}>
            {proposta.expirouEm ? (
              <>
                <div style={{ fontSize:32, marginBottom:12 }}>⚠️</div>
                <div style={{ fontSize:16, fontWeight:700, color:"#991b1b", marginBottom:8 }}>
                  Proposta expirada
                </div>
                <div style={{ fontSize:13, color:"#6b7280", lineHeight:1.55, marginBottom:20 }}>
                  As imagens desta proposta foram removidas automaticamente após 30 dias sem fechamento pra liberar espaço. Os dados numéricos e textos foram preservados no histórico.
                </div>
                <div style={{
                  background:"#f9fafb", border:"1px solid #f3f4f6", borderRadius:8,
                  padding:"14px 18px", textAlign:"left", fontSize:12.5, color:"#374151",
                }}>
                  <div style={{ display:"flex", justifyContent:"space-between", padding:"3px 0" }}>
                    <span style={{ color:"#6b7280" }}>Cliente</span>
                    <strong>{proposta.clienteNome || "—"}</strong>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", padding:"3px 0" }}>
                    <span style={{ color:"#6b7280" }}>Versão</span>
                    <strong>{proposta.versao || "—"}</strong>
                  </div>
                  {proposta.enviadaEm && (
                    <div style={{ display:"flex", justifyContent:"space-between", padding:"3px 0" }}>
                      <span style={{ color:"#6b7280" }}>Enviada em</span>
                      <strong>{new Date(proposta.enviadaEm).toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" })}</strong>
                    </div>
                  )}
                  <div style={{ display:"flex", justifyContent:"space-between", padding:"3px 0" }}>
                    <span style={{ color:"#6b7280" }}>Expirou em</span>
                    <strong style={{ color:"#b91c1c" }}>{new Date(proposta.expirouEm).toLocaleDateString("pt-BR")}</strong>
                  </div>
                  {(proposta.arqEdit != null || proposta.engEdit != null) && (
                    <div style={{ display:"flex", justifyContent:"space-between", padding:"3px 0", borderTop:"1px solid #f3f4f6", marginTop:6, paddingTop:8 }}>
                      <span style={{ color:"#6b7280" }}>Valor total</span>
                      <strong>R$ {(((proposta.arqEdit || 0) + (proposta.engEdit || 0))).toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 })}</strong>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize:15, fontWeight:600, color:"#111", marginBottom:8 }}>
                  Snapshot de imagens não disponível
                </div>
                <div style={{ fontSize:13, color:"#6b7280", lineHeight:1.5 }}>
                  Esta proposta foi salva antes da funcionalidade de snapshot visual. Os dados estão preservados — você pode reimprimir o PDF a partir da edição do orçamento.
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal de confirmação ao clicar Editar */}
      {confirmEditar && (
        <div
          onClick={() => setConfirmEditar(false)}
          style={{
            position:"fixed", inset:0, background:"rgba(0,0,0,0.5)",
            zIndex:400, display:"flex", alignItems:"center", justifyContent:"center",
            padding:20,
          }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              background:"#fff", borderRadius:12,
              padding:"26px 28px 20px", maxWidth:440, width:"100%",
              boxShadow:"0 8px 32px rgba(0,0,0,0.3)",
            }}>
            <div style={{ fontSize:16, fontWeight:700, color:"#111", marginBottom:8 }}>
              Editar e criar uma nova versão?
            </div>
            <div style={{ fontSize:13, color:"#6b7280", marginBottom:14, lineHeight:1.5 }}>
              A proposta <strong>{proposta.versao || "v1"}</strong> atual será preservada no histórico. Ao enviar as alterações, uma <strong>nova versão</strong> da proposta será criada.
            </div>
            <div style={{
              display:"flex", alignItems:"flex-start", gap:8,
              background:"#eff6ff", border:"1px solid #bfdbfe",
              borderRadius:8, padding:"9px 12px", marginBottom:18,
              fontSize:12, color:"#1e3a8a", lineHeight:1.45,
            }}>
              <span style={{ fontSize:14, lineHeight:1 }}>ℹ</span>
              <span>
                O orçamento e o histórico anterior permanecem intactos. Se desistir de editar, nada muda.
              </span>
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end", flexWrap:"wrap" }}>
              <button
                onClick={() => setConfirmEditar(false)}
                style={{
                  background:"#fff", color:"#374151",
                  border:"1px solid #d1d5db", borderRadius:8,
                  padding:"9px 18px", fontSize:13, fontWeight:500,
                  cursor:"pointer", fontFamily:"inherit",
                }}>
                Cancelar
              </button>
              <button
                onClick={() => {
                  setConfirmEditar(false);
                  onEditar && onEditar();
                }}
                style={{
                  background:"#111", color:"#fff",
                  border:"none", borderRadius:8,
                  padding:"9px 20px", fontSize:13, fontWeight:600,
                  cursor:"pointer", fontFamily:"inherit",
                }}>
                Continuar editando
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PropostaPreview({ data, onVoltar, onSalvarProposta, propostaReadOnly, propostaSnapshot, lockEdicao }) {
  // NOTA: NÃO fazer `if (!data) return null` aqui — os hooks abaixo precisam ser
  // chamados em todo render (regra do React). Em vez disso, usamos optional chaining
  // e defaults em cada acesso a `data.xxx` e retornamos null só DEPOIS dos hooks.
  const safeData = data || {};
  const { tipoProjeto, tipoObra, padrao, tipologia, tamanho, clienteNome,
          calculo,
          totSI, totCI, impostoV,
          incluiArq = true, incluiEng = true, incluiMarcenaria = false } = safeData;

  // Se tem snapshot de proposta salva, usamos valores dela como initial state.
  // Senão, valores calculados do orçamento base.
  const snap = propostaSnapshot || null;

  // Estado do modal de confirmação de salvar + aviso de proposta salva
  const [confirmSalvar, setConfirmSalvar] = useState(false);
  const [propostaInfo, setPropostaInfo] = useState(propostaReadOnly || null);

  // Estados locais (antes eram props read-only) — editáveis inline
  const [tipoPgto, setTipoPgtoLocal]     = useState(snap?.tipoPgto || data.tipoPgto || "padrao");
  const [temImposto, setTemImpostoLocal] = useState(snap?.temImposto ?? data.temImposto ?? false);
  const [aliqImp, setAliqImpLocal]       = useState(snap?.aliqImp ?? data.aliqImp ?? 16);
  const [etapasPct, setEtapasPctLocal]   = useState(() => {
    const base = snap?.etapasPct || data.etapasPct || [
      { id:1, nome:"Estudo de Viabilidade",  pct:10 },
      { id:2, nome:"Estudo Preliminar",      pct:40 },
      { id:3, nome:"Aprovação na Prefeitura",pct:12 },
      { id:4, nome:"Projeto Executivo",      pct:38 },
    ];
    // Garante que a etapa 5 (Engenharia) sempre exista
    if (!base.some(e => e.id === 5)) {
      return [...base, { id:5, nome:"Engenharia", pct:0 }];
    }
    return base;
  });
  const [etapasIsoladasLocal, setEtapasIsoladasLocal] = useState(new Set(snap?.etapasIsoladas || data.etapasIsoladas || []));
  const etapasIsoladas = Array.from(etapasIsoladasLocal);
  const [mostrarTabelaEtapas, setMostrarTabelaEtapas] = useState(snap?.mostrarTabelaEtapas ?? data.mostrarTabelaEtapas ?? true);
  // Descontos/parcelas — locais também
  const [descArqLocal,     setDescArqLocal]     = useState(snap?.descArq     ?? data.descArq     ?? 5);
  const [parcArqLocal,     setParcArqLocal]     = useState(snap?.parcArq     ?? data.parcArq     ?? 3);
  const [descPacoteLocal,  setDescPacoteLocal]  = useState(snap?.descPacote  ?? data.descPacote  ?? 10);
  const [parcPacoteLocal,  setParcPacoteLocal]  = useState(snap?.parcPacote  ?? data.parcPacote  ?? 4);
  const [descEtCtrtLocal,  setDescEtCtrtLocal]  = useState(snap?.descEtCtrt  ?? data.descEtCtrt  ?? 5);
  const [parcEtCtrtLocal,  setParcEtCtrtLocal]  = useState(snap?.parcEtCtrt  ?? data.parcEtCtrt  ?? 2);
  const [descPacCtrtLocal, setDescPacCtrtLocal] = useState(snap?.descPacCtrt ?? data.descPacCtrt ?? 15);
  const [parcPacCtrtLocal, setParcPacCtrtLocal] = useState(snap?.parcPacCtrt ?? data.parcPacCtrt ?? 8);

  const fmtV = v => v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const fmtN = v => v.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
  const isPadrao = tipoPgto === "padrao";
  const hoje = new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const dataStr = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
  const validade = new Date(hoje.getTime()+15*86400000).toLocaleDateString("pt-BR");

  const areaTot = calculo.areaTot || calculo.areaTotal || 0;

  // ── Estados editáveis ──────────────────────────────────────
  // CRITICAL: arqEdit/engEdit devem refletir o cálculo ATUAL em modo de edição.
  // Antes o código usava snap.arqEdit sem ressalva, o que causava:
  //   - Usuário editava orçamento (ex: adicionava cômodos) → valor no form subia
  //   - Clicava "Gerar Orçamento" → preview da proposta mostrava valor antigo
  //     (da v1 salva) porque snap.arqEdit era priorizado
  //   - Salvava v2 com valor da v1 → card mostrava v2 mas com valor velho
  // Agora: só usa snap quando a proposta está travada (modoVer / lockEdicao),
  // onde não faz sentido recalcular. Em edição normal, calculo atual ganha.
  // Trade-off: edição manual inline do valor não é preservada entre sessões
  // de edição — mas esse caso é raro e evitar o bug principal é prioridade.
  const [arqEdit, setArqEdit]               = useState(() => {
    if (lockEdicao && snap?.arqEdit != null) return snap.arqEdit;
    return incluiArq ? (calculo.precoArq || 0) : 0;
  });
  const [engEdit, setEngEdit]               = useState(() => {
    if (lockEdicao && snap?.engEdit != null) return snap.engEdit;
    return incluiEng ? (calculo.precoEng || 0) : 0;
  });
  const [resumoEdit, setResumoEdit]         = useState(snap?.resumoEdit ?? null);
  const [editandoArq, setEditandoArq]       = useState(false);
  const [editandoEng, setEditandoEng]       = useState(false);
  const [editandoResumo, setEditandoResumo] = useState(false);
  // Textos editáveis da proposta
  const [subTituloEdit, setSubTituloEdit]   = useState(snap?.subTituloEdit ?? null);
  const [validadeEdit, setValidadeEdit]     = useState(snap?.validadeEdit || new Date(hoje.getTime()+15*86400000).toLocaleDateString("pt-BR"));
  const [naoInclEdit, setNaoInclEdit]       = useState(snap?.naoInclEdit ?? null);
  const [prazoEdit, setPrazoEdit]           = useState(snap?.prazoEdit ?? null);
  // Dados do escritório — propagados pelo FormOrcamentoProjetoTeste em `data.escritorio`.
  // Se o escritório não estiver cadastrado (primeiro uso, rascunho antigo),
  // os campos ficam vazios e o usuário pode preencher manualmente no preview.
  const escritorio = safeData.escritorio || {};
  // Primeiro responsável técnico: usado como responsável padrão da proposta
  // (nome + CAU). Outros responsáveis podem ser selecionados via edição inline
  // dos campos "responsavelEdit" / "cauEdit" no próprio preview.
  const _respEsc = (escritorio.responsaveis && escritorio.responsaveis.length > 0)
    ? escritorio.responsaveis[0]
    : null;
  // Nome formal do responsável: assume "Arq." como prefixo padrão.
  // Se o escritório futuramente quiser outros títulos (Eng., etc.), adicionar
  // campo tituloProfissional em responsaveis[i] e usar aqui.
  const _respNome = _respEsc?.nome ? `Arq. ${_respEsc.nome}` : "";
  // CAU + cidade (padrão da proposta): "CAU A12345-6 · Ourinhos"
  const _cauCidade = [_respEsc?.cau, escritorio.cidade].filter(Boolean).join(" · ");
  // PIX: prefixo "PIX · " + chave + opcionalmente banco.
  // Formato típico: "PIX · Chave CNPJ: 12.345.678/0001-00 · Banco Sicoob"
  const _pixLabel = (() => {
    if (!escritorio.pixChave) return "";
    const tipo = escritorio.pixTipo || "Chave";
    const banco = escritorio.banco ? ` · Banco ${escritorio.banco}` : "";
    return `PIX · Chave ${tipo}: ${escritorio.pixChave}${banco}`;
  })();

  const [responsavelEdit, setResponsavelEdit] = useState(snap?.responsavelEdit ?? _respNome);
  const [cauEdit, setCauEdit]               = useState(snap?.cauEdit ?? _cauCidade);
  const [emailEdit, setEmailEdit]           = useState(snap?.emailEdit ?? (escritorio.email || ""));
  const [telefoneEdit, setTelefoneEdit]     = useState(snap?.telefoneEdit ?? (escritorio.telefone || ""));
  const [instagramEdit, setInstagramEdit]   = useState(snap?.instagramEdit ?? (escritorio.instagram || ""));
  const [cidadeEdit, setCidadeEdit]         = useState(snap?.cidadeEdit ?? (escritorio.cidade || ""));
  const [pixEdit, setPixEdit]               = useState(snap?.pixEdit ?? _pixLabel);
  const [labelApenasEdit, setLabelApenasEdit] = useState(snap?.labelApenasEdit ?? null);

  // Logo do escritório — vem de data.escritorio.logo (salvo no banco via
  // PUT /api/escritorio) ou do snapshot da proposta (se salva antes).
  // Snapshot tem prioridade pra preservar proposta histórica mesmo se o
  // escritório trocar o logo depois.
  const [logoPreview, setLogoPreview]       = useState(snap?.logoPreview ?? (escritorio.logo || null));

  // Logo agora vem de data.escritorio.logo (salvo no banco pela aba Escritório).
  // O upload/remoção aqui no preview fica como override TEMPORÁRIO só pra esta
  // proposta específica — não mexe no escritório global. Útil pra propostas
  // excepcionais (ex: parceria com logo diferente) sem afetar as demais.
  // Ao salvar a proposta, logoPreview entra no snapshot.
  const inputLogoRef = useRef(null);

  function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const data64 = ev.target.result;
      setLogoPreview(data64);
    };
    reader.readAsDataURL(file);
  }

  function handleLogoRemove() {
    setLogoPreview(null);
  }

  const arqOriginal  = incluiArq ? (calculo.precoArq || 0) : 0;
  const engOriginal  = incluiEng ? (calculo.precoEng || 0) : 0;
  const valorEditado = arqEdit !== arqOriginal || engEdit !== engOriginal;

  const arqCI = incluiArq ? arqEdit : 0;
  const engCI = incluiEng ? engEdit : 0;

  // Helper: converte valor SEM imposto -> COM imposto (inside calculation)
  // valor_bruto = liquido / (1 - aliq/100). Se temImposto=false, retorna o valor direto.
  const comImposto = (v) => (temImposto && v > 0)
    ? Math.round(v / (1 - aliqImp/100) * 100) / 100
    : v;
  // Inverso: converte valor COM imposto -> SEM imposto.
  const semImposto = (v) => (temImposto && v > 0)
    ? Math.round(v * (1 - aliqImp/100) * 100) / 100
    : v;

  // Recalcula totais com valores editados
  const totSIEdit   = arqCI + engCI;
  const totCIEdit   = comImposto(totSIEdit);
  const impostoEdit = temImposto ? Math.round((totCIEdit - totSIEdit) * 100) / 100 : 0;
  // Base das etapas = só arquitetura com imposto
  const arqCIEdit   = comImposto(arqCI);
  // Engenharia com imposto (para linha separada na tabela de etapas)
  const engCIEdit   = comImposto(engCI);

  // Etapa isolada — valor proporcional do total
  // Etapas isoladas — múltipla seleção (state local, manipulável inline)
  const idsIsolados     = etapasIsoladasLocal;
  const temIsoladas     = idsIsolados.size > 0;
  const etapasIsoladasObjs = temIsoladas ? etapasPct.filter(e => idsIsolados.has(e.id)) : [];
  // Compatibilidade com código que usa etapaIsoladaObj (single)
  const etapaIsoladaObj = temIsoladas ? etapasIsoladasObjs[0] : null;
  const etapasVisiveis  = (temIsoladas ? etapasPct.filter(e => idsIsolados.has(e.id)) : etapasPct).filter(e => incluiEng || e.id !== 5);
  // totSIBase = % da arq das etapas isoladas + 100% da eng (se ativa)
  const pctTotalIsolado = etapasIsoladasObjs.reduce((s,e) => s + (e.id !== 5 ? e.pct : 0), 0);
  const engIsolada      = idsIsolados.has(5);
  // Engenharia ATIVA: incluiEng ligado E (sem isolamento OU eng isolada)
  const engAtiva        = incluiEng && (!temIsoladas || engIsolada);
  const arqIsoladaSI    = temIsoladas ? Math.round(arqCI * (pctTotalIsolado / 100) * 100) / 100 : 0;
  // Com isolamento: eng entra apenas se eng estiver isolada
  const engSI           = engAtiva ? engCI : 0;
  const totSIBase       = temIsoladas
    ? Math.round((arqIsoladaSI + engSI) * 100) / 100
    : totSIEdit;

  // Total do pacote em modo etapas — usado tanto no preview quanto no pagamento
  // Valor com imposto das etapas arq selecionadas + eng (se ativa)
  const totalPacoteEtapas = (() => {
    // Soma dos valores das etapas arq selecionadas (ou todas se sem isolamento)
    const etapasArqAtivas = etapasPct.filter(e => e.id !== 5 && (!temIsoladas || idsIsolados.has(e.id)));
    const pctAtivo = etapasArqAtivas.reduce((s,e)=>s+Number(e.pct),0);
    // arqCIEdit = arq TOTAL com imposto (base dos cálculos por etapa no preview)
    return Math.round((arqCIEdit * pctAtivo / 100 + (engAtiva ? engCIEdit : 0)) * 100) / 100;
  })();
  // Subtotal apenas das etapas de arquitetura (sem eng) — para oferecer opção "Apenas Arquitetura"
  const subTotalArqEtapas = (() => {
    const etapasArqAtivas = etapasPct.filter(e => e.id !== 5 && (!temIsoladas || idsIsolados.has(e.id)));
    const pctAtivo = etapasArqAtivas.reduce((s,e)=>s+Number(e.pct),0);
    return Math.round(arqCIEdit * pctAtivo / 100 * 100) / 100;
  })();

  // Subtítulo dinâmico — usa engAtiva (não só o toggle, mas também considera isolamento)
  const subTituloDefault = (incluiArq && engAtiva)
    ? "Proposta Comercial de Projetos de Arquitetura e Engenharia"
    : (incluiArq && !engAtiva)
      ? "Proposta Comercial de Projetos de Arquitetura"
      : (!incluiArq && engAtiva)
        ? "Proposta Comercial de Projetos de Engenharia"
        : "Proposta Comercial";
  // Valor final (edição manual ou default)
  const subTituloFinal = subTituloEdit !== null ? subTituloEdit : subTituloDefault;

  // Resumo descritivo dinâmico (prefixo "Construção nova de" / "Reforma de")
  // Recalcula sempre que tipoObra mudar, a partir dos dados originais do projeto
  const resumoDinamico = (() => {
    const fmtN2 = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
    const fmtArea = v => v > 0 ? fmtN2(v)+"m²" : null;
    const tipoObraLower = (data.tipoObra || "").toLowerCase();
    const prefixo = tipoObraLower.includes("reforma") ? "Reforma de " : "Construção nova de ";
    const calc = data.calculo || {};
    // Caso comercial (conjunto comercial com grupoQtds)
    if (data.grupoQtds && calc.blocosCom) {
      const partes = [];
      const nL = data.grupoQtds["Por Loja"]||0, nA = data.grupoQtds["Espaço Âncora"]||0;
      const nAp = data.grupoQtds["Por Apartamento"]||0, nG = data.grupoQtds["Galpao"]||0;
      if (nL>0) { const b=calc.blocosCom.find(x=>x.label==="Loja"); if(b) partes.push(`${nL} loja${nL!==1?"s":""} (${fmtArea(b.area1*nL)})`); }
      if (nA>0) { const b=calc.blocosCom.find(x=>x.label==="Âncora"); if(b) partes.push(`${nA} ${nA===1?"Espaço Âncora":"Espaços Âncoras"} (${fmtArea(b.area1*nA)})`); }
      if (nAp>0) { const b=calc.blocosCom.find(x=>x.label==="Apartamento"); if(b) partes.push(`${nAp} apartamento${nAp!==1?"s":""} (${fmtArea(b.area1*nAp)})`); }
      if (nG>0) { const b=calc.blocosCom.find(x=>x.label==="Galpão"); if(b) partes.push(`${nG} ${nG!==1?"galpões":"galpão"} (${fmtArea(b.area1*nG)})`); }
      const bc = calc.blocosCom.find(x=>x.label==="Área Comum"); if(bc) partes.push(`Área Comum (${fmtArea(bc.area1)})`);
      const lista = partes.length>1 ? partes.slice(0,-1).join(", ")+" e "+partes[partes.length-1] : partes[0]||"";
      return `${prefixo}conjunto comercial, contendo ${lista}, totalizando ${fmtArea(calc.areaTot||calc.areaTotal)}.`;
    }
    // Caso residencial
    const nUnid = calc.nRep || 1;
    const areaUni = calc.areaTotal || calc.areaTot || 0;
    const areaTotR = Math.round(areaUni * nUnid * 100)/100;
    const comodos = data.comodos || [];
    const totalAmb = comodos.reduce((s,c)=>s+(c.qtd||0),0);

    // Lista composta (ex: "duas garagens, três dormitórios e uma suíte")
    // Usa formatComodo top-level (helpers PLURAIS_IRREG, GENERO_AMB, NUM_EXT_*)
    const itensFmt = comodos.filter(c=>(c.qtd||0)>0).map(c => formatComodo(c.nome, c.qtd));
    const listaStr = itensFmt.length>1
      ? itensFmt.slice(0,-1).join(", ")+" e "+itensFmt[itensFmt.length-1]
      : itensFmt[0]||"";
    const tipDesc = (data.tipologia||"").toLowerCase().includes("sobrado") ? "com dois pavimentos" : "térrea";
    const numFem = ["","uma","duas","três","quatro","cinco","seis","sete","oito","nove","dez"];
    if (nUnid>1) {
      const nExt = nUnid>=1&&nUnid<=10 ? numFem[nUnid] : String(nUnid);
      return `${prefixo}${nExt} residências ${tipDesc} idênticas, com ${fmtN2(areaUni)}m² por unidade, totalizando ${fmtN2(areaTotR)}m² de área construída. Cada unidade composta por ${totalAmb} ambientes: ${listaStr}.`;
    }
    return `${prefixo}uma residência ${tipDesc}, com ${fmtN2(areaUni)}m² de área construída, composta por ${totalAmb} ambientes: ${listaStr}.`;
  })();
  // Valor final (edição manual preserva, senão usa dinâmico)
  const resumoFinal = resumoEdit !== null ? resumoEdit : resumoDinamico;

  // Manipuladores de etapas (isolar, adicionar, remover, editar %)
  function toggleIsolarEtapa(id) {
    setEtapasIsoladasLocal(prev => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }
  function removerEtapa(id) {
    if (id === 5) { dialogo.alertar({ titulo: "Etapa de Engenharia", mensagem: "A etapa de Engenharia não pode ser removida por aqui. Use o toggle de Engenharia na Tela 1 para excluir.", tipo: "aviso" }); return; }
    setEtapasPctLocal(prev => prev.filter(e => e.id !== id));
    setEtapasIsoladasLocal(prev => { const n = new Set(prev); n.delete(id); return n; });
  }
  function adicionarEtapa() {
    // Garante ID >= 10 para não colidir com ID=5 (Engenharia) nem com IDs padrão (1-4)
    const maxId = Math.max(9, ...etapasPct.map(e => e.id));
    const nextId = maxId + 1;
    setEtapasPctLocal(prev => {
      const engIdx = prev.findIndex(e => e.id === 5);
      const nova = { id: nextId, nome: "Nova etapa", pct: 0 };
      if (engIdx >= 0) {
        // Insere antes da engenharia
        const semEng = prev.filter(e => e.id !== 5);
        return [...semEng, nova, prev[engIdx]];
      }
      return [...prev, nova];
    });
  }
  function atualizarEtapaPct(id, novoPct) {
    // Arredonda pra inteiro (sem casas decimais)
    const clampedInt = Math.round(Math.max(0, Math.min(100, novoPct)));
    setEtapasPctLocal(prev => {
      // Sem isolamento: só atualiza
      if (!temIsoladas) {
        return prev.map(e => e.id === id ? { ...e, pct: clampedInt } : e);
      }
      const etapaAtual = prev.find(e => e.id === id);
      if (!etapaAtual) return prev;
      // Eng ou etapa não isolada: atualização simples
      if (id === 5 || !idsIsolados.has(id)) {
        return prev.map(e => e.id === id ? { ...e, pct: clampedInt } : e);
      }
      // CASCATA CIRCULAR: ajusta só a PRÓXIMA etapa na ordem.
      // Se a editada é a última da lista de isoladas, volta pra primeira.
      // Assim o total das isoladas se mantém sempre constante.
      const arqIsoladasOrdem = prev.filter(e => e.id !== 5 && idsIsolados.has(e.id));
      const idxEditada = arqIsoladasOrdem.findIndex(e => e.id === id);
      const alvo = arqIsoladasOrdem[(idxEditada + 1) % arqIsoladasOrdem.length];
      const pctAntigoEditada = Math.round(Number(etapaAtual.pct));
      const pctAntigoAlvo = Math.round(Number(alvo.pct));
      // O total a manter é: pctAntigoEditada + pctAntigoAlvo
      const totalPar = pctAntigoEditada + pctAntigoAlvo;
      // Limita o valor editado ao máximo possível (não pode passar do totalPar, senão alvo ficaria negativo)
      const pctFinalEditada = Math.min(clampedInt, totalPar);
      const pctFinalAlvo = totalPar - pctFinalEditada;
      // Só tem a editada (1 única etapa isolada): ajusta só ela
      if (arqIsoladasOrdem.length === 1) {
        return prev.map(e => e.id === id ? { ...e, pct: clampedInt } : e);
      }
      return prev.map(e => {
        if (e.id === id)    return { ...e, pct: pctFinalEditada };
        if (e.id === alvo.id) return { ...e, pct: pctFinalAlvo };
        return e;
      });
    });
  }
  function atualizarEtapaValor(id, novoValor) {
    // Converte valor R$ → % da arq base
    // (arqCIEdit é a arq total com imposto; se não tiver imposto, é arqCI mesmo)
    const base = arqCIEdit;
    if (!base || base <= 0) return;
    const novoPct = Math.round((novoValor / base) * 100 * 100) / 100; // 2 decimais
    setEtapasPctLocal(prev => prev.map(e => e.id === id ? { ...e, pct: Math.max(0, Math.min(100, novoPct)) } : e));
  }
  function atualizarEtapaNome(id, novoNome) {
    setEtapasPctLocal(prev => prev.map(e => e.id === id ? { ...e, nome: novoNome } : e));
  }

  // totCIBase = com imposto
  const totCIBase       = temIsoladas
    ? comImposto(totSIBase)
    : totCIEdit;

  function parseValorBR(str) {
    if (!str) return 0;
    const s = String(str).trim();
    // Detecta formato: se tem vírgula após ponto -> pt-BR (1.234,56)
    // Se só tem vírgula -> pode ser 1234,56 ou 1.234,56
    // Remove tudo que não é dígito nem vírgula/ponto
    const temPontoEVirgula = s.includes(".") && s.includes(",");
    if (temPontoEVirgula) {
      // pt-BR: ponto=milhar, vírgula=decimal
      return parseFloat(s.replace(/\./g,"").replace(",",".")) || 0;
    } else if (s.includes(",")) {
      // só vírgula = decimal
      return parseFloat(s.replace(",",".")) || 0;
    } else {
      // só ponto ou número puro
      return parseFloat(s) || 0;
    }
  }

  // ── Escopo como estado (sincronizado com etapasPct) ────────
  const ESCOPO_BASE = [
    { etapaId:1, titulo:"Estudo de Viabilidade", objetivo:"Analisar o potencial construtivo do terreno e verificar a viabilidade de implantação do empreendimento, considerando as condicionantes físicas, urbanísticas, legais e funcionais aplicáveis ao lote.", itens:["Levantamento inicial e consolidação das informações técnicas do terreno","Análise documental e física do lote, incluindo matrícula, dimensões, topografia e características existentes","Consulta e interpretação dos parâmetros urbanísticos e restrições legais aplicáveis","Verificação da viabilidade construtiva, considerando taxa de ocupação, coeficiente de aproveitamento, recuos obrigatórios, gabarito de altura e demais condicionantes normativas","Estimativa preliminar da área edificável e do potencial de aproveitamento do terreno","Avaliação da melhor ocupação do lote, alinhada ao programa de necessidades do cliente","Definição preliminar da implantação, organização dos acessos, fluxos, circulação, áreas livres e áreas construídas","Estudo de volumetria, análise de inserção no entorno e definição de pontos focais que contribuam para a valorização do empreendimento","Dimensionamento preliminar de estacionamentos, fluxos operacionais e viabilidade de circulação para veículos leves e pesados"], entregaveis:["Estudo técnico de ocupação do terreno, com planta de implantação e setorização preliminar","Esquema conceitual de implantação, incluindo diagramas de organização espacial, acessos e condicionantes do entorno","Representações gráficas, estudo volumétrico em 3D e imagens conceituais","Relatório sintético de viabilidade construtiva, contemplando memorial descritivo, quadro de áreas e síntese dos parâmetros urbanísticos aplicáveis"], obs:"Esta etapa tem como objetivo reduzir riscos e antecipar decisões estratégicas antes do desenvolvimento do projeto, permitindo validar a compatibilidade da proposta com o terreno, com a legislação municipal e com os objetivos do empreendimento.", isEng:false },
    { etapaId:2, titulo:"Estudo Preliminar", objetivo:"Desenvolver o conceito arquitetônico inicial, organizando os ambientes, a implantação e a linguagem estética do projeto.", itens:["Reunião de briefing e entendimento das necessidades do cliente","Definição do programa de necessidades","Estudo de implantação da edificação no terreno","Desenvolvimento da concepção arquitetônica inicial","Definição preliminar de: layout, fluxos, volumetria, setorização e linguagem estética","Compatibilização entre funcionalidade, conforto, estética e viabilidade construtiva","Ajustes conforme alinhamento com o cliente"], entregaveis:["Planta baixa preliminar","Estudo volumétrico / fachada conceitual","Implantação inicial","Imagens, croquis ou perspectivas conceituais","Apresentação para validação do conceito arquitetônico"], obs:"É nesta etapa que o projeto ganha forma. O estudo preliminar define a essência da proposta e orienta todas as fases seguintes.", isEng:false },
    { etapaId:3, titulo:"Aprovação na Prefeitura", objetivo:"Adequar e preparar o projeto arquitetônico para protocolo e aprovação junto aos órgãos públicos competentes.", itens:["Adequação do projeto às exigências legais e urbanísticas do município","Elaboração dos desenhos técnicos exigidos para aprovação","Montagem da documentação técnica necessária ao processo","Inserção de informações obrigatórias conforme normas municipais","Preparação de pranchas, quadros de áreas e demais peças gráficas","Apoio técnico durante o processo de aprovação","Atendimento a eventuais comunique-se ou exigências técnicas da prefeitura"], entregaveis:["Projeto legal para aprovação","Plantas, cortes, fachadas e implantação conforme exigência municipal","Quadros de áreas","Arquivos e documentação técnica para protocolo"], obs:"Não inclusos nesta etapa: taxas municipais, emolumentos, ART/RRT, levantamentos complementares, certidões e exigências extraordinárias de órgãos externos, salvo se expressamente previsto.", isEng:false },
    { etapaId:4, titulo:"Projeto Executivo", objetivo:"Desenvolver o projeto arquitetônico em nível detalhado para execução da obra, fornecendo todas as informações necessárias para construção com precisão.", itens:["Desenvolvimento técnico completo do projeto aprovado","Detalhamento arquitetônico para obra","Definição precisa de: dimensões, níveis, cotas, eixos, paginações, esquadrias, acabamentos e elementos construtivos","Elaboração de desenhos técnicos executivos","Compatibilização arquitetônica com premissas de obra","Apoio técnico para leitura e entendimento do projeto pela equipe executora"], entregaveis:["Planta baixa executiva","Planta de locação e implantação","Planta de cobertura","Cortes e fachadas executivos","Planta de layout e pontos arquitetônicos","Planta de esquadrias e pisos","Detalhamentos construtivos","Quadro de esquadrias e quadro de áreas final"], obs:"É a etapa que transforma a ideia em construção real. Um bom projeto executivo reduz improvisos, retrabalhos e falhas de execução na obra.", isEng:false },
    { etapaId:5, titulo:"Projetos Complementares de Engenharia", objetivo:"", itens:["Estrutural: lançamento, dimensionamento de vigas, pilares, lajes e fundações","Elétrico: dimensionamento de cargas, circuitos, quadros e pontos","Hidrossanitário: distribuição de pontos de água fria/quente, esgoto e dimensionamento","Compatibilização entre projetos arquitetônico e de engenharia para verificar possíveis interferências"], entregaveis:[], obs:"", isEng:true },
  ];

  // Estado do escopo — sincronizado com etapasPct
  const [escopoState, setEscopoState] = useState(() => {
    // Se tem snapshot com escopo salvo, usa ele
    if (snap?.escopoState && snap.escopoState.length > 0) {
      return snap.escopoState;
    }
    // Senão, constrói do zero com base nas etapas ativas
    const idsAtivos = new Set(etapasPct.map(e => e.id));
    return ESCOPO_BASE.filter(b => b.isEng || idsAtivos.has(b.etapaId));
  });

  // Sincroniza escopo quando etapasPct muda (adiciona/remove etapas)
  useEffect(() => {
    setEscopoState(prev => {
      const idsAtivos = new Set(etapasPct.map(e => e.id));
      // Remove blocos de etapas que foram excluídas (não-eng)
      const filtrado = prev.filter(b => b.isEng || idsAtivos.has(b.etapaId));
      // Adiciona blocos de etapas novas (id > 5 = customizadas)
      etapasPct.forEach(et => {
        if (et.id > 5 && !filtrado.find(b => b.etapaId === et.id)) {
          filtrado.splice(filtrado.findIndex(b=>b.isEng), 0, {
            etapaId: et.id, titulo: et.nome, objetivo:"", itens:[], entregaveis:[], obs:"", isEng:false, custom:true,
          });
        }
      });
      return filtrado;
    });
  }, [etapasPct]);

  // Guard defensivo: se data não veio, retorna null (APÓS todos os hooks)
  if (!data) return null;


  // Escopo filtrado e renumerado
  const escopoDefault = (() => {
    const blocos = escopoState.filter(b => {
      if (b.isEng) return engAtiva;
      if (!incluiArq) return false;
      if (b.etapaId === 1 && isPadrao) return false;
      if (temIsoladas && !b.isEng && !idsIsolados.has(b.etapaId) && !b.custom) return false;
      return true;
    });
    let n = 0;
    return blocos.map(b => {
      if (!b.isEng) {
        n++;
        const semNum = b.titulo.replace(/^\d+\.\s*/, "");
        return { ...b, tituloNum: `${n}. ${semNum}` };
      }
      const semNum = b.titulo.replace(/^\d+\.\s*/, "");
      return { ...b, tituloNum: `${n+1}. ${semNum}` };
    });
  })();

  // Helpers para editar escopo
  function setEscopoBloco(etapaId, campo, valor) {
    setEscopoState(prev => prev.map(b => b.etapaId === etapaId ? { ...b, [campo]: valor } : b));
  }

    // Itens fixos — simples string ou { label, sub } para texto menor
  const naoInclFixos = [
    // Grupo: Projetos (agrupados em sequência)
    "Projetos de climatização",
    "Projeto de prevenção de incêndio",
    "Projeto de automação",
    "Projeto de paisagismo",
    "Projeto de interiores",
    ...(!incluiMarcenaria ? ["Projeto de Marcenaria (Móveis internos)"] : []),
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
    ...(!temImposto ? ["Impostos"] : []),
  ];
  // Itens dinâmicos baseados nos toggles + isolamento — com sublabel menor
  // Etapas não isoladas (quando em modo isolamento) aparecem primeiro
  const etapasNaoSelecionadas = temIsoladas
    ? etapasPct.filter(e => e.id !== 5 && !idsIsolados.has(e.id)).map(e => ({ label: e.nome, sub: null }))
    : [];
  const naoInclDinamicos = [
    ...etapasNaoSelecionadas,
    // Eng aparece em "não inclusos" quando não ativa (sem eng no toggle OU com isolamento e eng não isolada)
    ...(!engAtiva ? [{ label:"Projetos de Engenharia", sub:"(Estrutural/Elétrico/Hidrossanitário)" }] : []),
    ...(!incluiArq ? [{ label:"Projetos de Arquitetura", sub:null }] : []),
  ];
  // Normaliza tudo para { label, sub }
  const naoInclDefault = [
    ...naoInclDinamicos,
    ...naoInclFixos.map(s => ({ label: s, sub: null })),
  ];

  const prazoDefault = isPadrao
    ? [
       ...(incluiArq ? ["Prazo estimado para entrega do Projeto Arquitetônico: 30 dias úteis após contratação."] : []),
       ...(engAtiva ? ["Prazo estimado para entrega dos Projetos de Engenharia: 30 dias úteis após aprovação na prefeitura."] : []),
      ]
    : [
       ...(incluiArq || engAtiva ? ["Prazo de 30 dias úteis por etapa, contados após conclusão e aprovação de cada etapa pelo cliente."] : []),
       ...(incluiArq || engAtiva ? ["Concluída e aprovada cada etapa, inicia-se automaticamente o prazo da etapa seguinte."] : []),
       ...(engAtiva ? ["Projetos de Engenharia: 30 dias úteis após aprovação do projeto na Prefeitura."] : []),
      ];

  const C = "#111827";
  const LT = "#828a98";
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

  const Sec = ({title, mt, children, action}) => (
    <div>
      <div style={secH(mt)}>
        <span style={secL}>{title}</span>
        <div style={secLn} />
        {action && action}
      </div>
      {children}
    </div>
  );

  // Constrói snapshot completo de todos os dados editáveis da proposta
  function buildPropostaSnapshot() {
    return {
      versao: null, // definido pelo caller
      enviadaEm: new Date().toISOString(),
      // Dados base do cálculo (para recriar preview idêntico)
      tipoProjeto, tipoObra, padrao, tipologia, tamanho,
      clienteNome, referencia: data.referencia || "",
      comodos: data.comodos || [],
      calculo: data.calculo,
      grupoQtds: data.grupoQtds || null,
      incluiArq, incluiEng, incluiMarcenaria,
      // Estados locais editáveis do preview
      tipoPgto, temImposto, aliqImp, etapasPct: [...etapasPct],
      etapasIsoladas: Array.from(idsIsolados),
      mostrarTabelaEtapas,
      descArq: descArqLocal, parcArq: parcArqLocal,
      descPacote: descPacoteLocal, parcPacote: parcPacoteLocal,
      descEtCtrt: descEtCtrtLocal, parcEtCtrt: parcEtCtrtLocal,
      descPacCtrt: descPacCtrtLocal, parcPacCtrt: parcPacCtrtLocal,
      // Edições manuais
      arqEdit, engEdit, resumoEdit,
      subTituloEdit, validadeEdit, naoInclEdit, prazoEdit,
      responsavelEdit, cauEdit, emailEdit, telefoneEdit,
      instagramEdit, cidadeEdit, pixEdit, labelApenasEdit,
      logoPreview,
      escopoState: escopoState ? JSON.parse(JSON.stringify(escopoState)) : [],
      // ── VALORES EXIBIDOS (fonte única da verdade pro que o cliente viu) ──
      // No modo "padrao": arqCIEdit + engCIEdit (100% de cada)
      // No modo "etapas": totalPacoteEtapas (soma das etapas ativas + eng se ativa)
      valorArqExibido: incluiArq ? (isPadrao ? arqCIEdit : subTotalArqEtapas) : 0,
      valorEngExibido: engAtiva ? engCIEdit : 0,
      valorTotalExibido: isPadrao
        ? (totCIEdit)
        : totalPacoteEtapas,
    };
  }

  async function handleSalvarProposta() {
    if (!onSalvarProposta) {
      // Fallback: se não tiver callback, só gera PDF como antes
      await handlePdf();
      return;
    }
    try {
      // 1. Monta snapshot base (sem imagens ainda)
      const snapshot = buildPropostaSnapshot();

      // 2. Gera o PDF como blob (sem baixar)
      const blob = await handlePdf({ returnBlob: true });

      // 3. Rasteriza as páginas em imagens JPEG base64 (1200px, 70% qualidade)
      //    Rasterizar ANTES de baixar pra garantir fidelidade ao que vai ser salvo
      let imagens = [];
      try {
        if (blob && typeof rasterizarPdfParaImagens === "function") {
          imagens = await rasterizarPdfParaImagens(blob, { maxWidth: 1000, quality: 0.6 });
        }
      } catch (errImg) {
        console.warn("Não foi possível gerar snapshot de imagens do PDF:", errImg);
        // Continua mesmo sem imagens — proposta salva sem snapshot visual
      }

      // 4. Adiciona imagens ao snapshot
      snapshot.imagensPdf = imagens;

      // 5. Persiste no orçamento
      const propostaSalva = await onSalvarProposta(snapshot);

      // 6. Baixa o PDF pro usuário enviar ao cliente
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `proposta-${(clienteNome || "projeto").replace(/\s+/g, "-").toLowerCase()}.pdf`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      // 7. Marca como salva e bloqueia edições
      setPropostaInfo({
        versao: propostaSalva?.versao || snapshot.versao || "v1",
        enviadaEm: snapshot.enviadaEm,
      });
      setConfirmSalvar(false);
    } catch(e) {
      console.error(e);
      dialogo.alertar({ titulo: "Erro ao salvar proposta", mensagem: e.message, tipo: "erro" });
    }
  }

  const handlePdf = async (opts = {}) => {
    if (!window.jspdf) { dialogo.alertar({ titulo: "Aguarde alguns segundos", mensagem: "A biblioteca de PDF ainda está carregando.", tipo: "aviso" }); return; }
    try {
      const c = data.calculo;
      const nUnid = c.nRep || 1;
      // ESPELHO do preview: calcular aqui os valores exatos exibidos e passar prontos ao PDF
      // engAtiva: com isolamento, só conta se eng estiver isolada
      const engAtiva = incluiEng && (!temIsoladas || idsIsolados.has(5));
      // arq/eng exibidos no header (sem imposto)
      const arqExibidoSI = temIsoladas ? arqIsoladaSI : arqCI;
      const engExibidoSI = engAtiva ? engCI : 0;
      // com imposto (usa helper comImposto definido no escopo do componente)
      const arqExibidoCI = comImposto(arqExibidoSI);
      const engExibidoCI = comImposto(engExibidoSI);
      // total com imposto (exatamente como o preview mostra)
      const totalExibidoSI = Math.round((arqExibidoSI + engExibidoSI) * 100) / 100;
      const totalExibidoCI = comImposto(totalExibidoSI);
      // etapas que aparecem no preview (só isoladas quando tem isolamento; sem eng - eng vai separado)
      const etapasExibidas = (temIsoladas
        ? etapasPct.filter(e => e.id !== 5 && idsIsolados.has(e.id))
        : etapasPct.filter(e => e.id !== 5)
      ).map(e => ({
        ...e,
        // Valor calculado exatamente como o preview mostra
        valorCalculado: Math.round(arqCIEdit * (e.pct/100) * 100) / 100,
      }));
      // Etapas NÃO selecionadas (pra entrar em "serviços não inclusos")
      const etapasNaoIncluidas = temIsoladas
        ? etapasPct.filter(e => e.id !== 5 && !idsIsolados.has(e.id)).map(e => e.nome)
        : [];
      // Engenharia também desconsiderada quando não isolada em modo isolamento
      if (incluiEng && temIsoladas && !idsIsolados.has(5)) {
        etapasNaoIncluidas.push("Projetos de Engenharia (Estrutural/Elétrico/Hidrossanitário)");
      }

      // Frase descritiva — só aparece quando tem etapa arq ISOLADA E nem todas estão isoladas
      // (se todas as arq estão isoladas, já está óbvio no escopo — não redundar)
      let avisoIsolado = null;
      if (temIsoladas) {
        const etapasArqTotal = etapasPct.filter(e => e.id !== 5).length;
        const etapasArqIsoladas = etapasPct.filter(e => e.id !== 5 && idsIsolados.has(e.id));
        if (etapasArqIsoladas.length > 0 && etapasArqIsoladas.length < etapasArqTotal) {
          // Lista das etapas isoladas com "e" antes da última
          const nomes = etapasArqIsoladas.map(e => e.nome);
          let lista;
          if (nomes.length === 1) lista = nomes[0];
          else if (nomes.length === 2) lista = `${nomes[0]} e ${nomes[1]}`;
          else lista = `${nomes.slice(0,-1).join(", ")} e ${nomes[nomes.length-1]}`;
          const verboEtapa = nomes.length === 1 ? "à etapa de" : "às etapas de";
          avisoIsolado = `Referente ${verboEtapa} ${lista}:`;
        }
      }

      // Legado (mantido por compat do defaultModelo)
      const arqTotal = arqExibidoSI;
      const engTotal = engExibidoSI;
      const grandTotal = totalExibidoCI;
      const engUnit = engTotal;

      const r = {
        areaTotal: areaTot, areaBruta: c.areaBruta||0, nUnidades: nUnid,
        precoArq: arqTotal, precoFinal: arqTotal, precoTotal: arqTotal,
        precoEng: engTotal, engTotal,
        impostoAplicado: temImposto, aliquotaImposto: aliqImp,
      };
      const fmt   = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
      const fmtM2 = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+" m²";
      // etapasPct no PDF: passa só as que aparecem no preview
      const etapasPdfFinal = etapasExibidas;
      const orc = { id:"teste-"+Date.now(), cliente:data.clienteNome||"Cliente", tipo:data.tipoProjeto, subtipo:data.tipoObra, padrao:data.padrao, tipologia:data.tipologia, tamanho:data.tamanho, comodos:data.comodos||[], tipoPagamento:tipoPgto, descontoEtapa:descArqLocal, parcelasEtapa:parcArqLocal, descontoPacote:descPacoteLocal, parcelasPacote:parcPacoteLocal, descontoEtapaCtrt:descEtCtrtLocal, parcelasEtapaCtrt:parcEtCtrtLocal, descontoPacoteCtrt:descPacCtrtLocal, parcelasPacoteCtrt:parcPacCtrtLocal, etapasPct:etapasPdfFinal, incluiImposto:temImposto, aliquotaImposto:aliqImp, etapasIsoladas:Array.from(idsIsolados), totSI:0, criadoEm:new Date().toISOString(), resultado:r,
        // Controle de exibição
        mostrarTabelaEtapas: mostrarTabelaEtapas,
        // ESPELHO do preview: valores exatos pré-calculados (PDF usa esses em vez de recalcular)
        _preview: {
          arqSI: arqExibidoSI, arqCI: arqExibidoCI,
          engSI: engExibidoSI, engCI: engExibidoCI,
          totalSI: totalExibidoSI, totalCI: totalExibidoCI,
          impostoV: Math.round((totalExibidoCI - totalExibidoSI) * 100) / 100,
          engAtiva, mostrarTabelaEtapas,
          etapasNaoIncluidas,
          // Valores do pacote em modo etapas (igual ao que o preview mostra)
          totalPacoteEtapas,
          subTotalArqEtapas,
          // Textos editáveis da preview
          subTitulo: subTituloFinal,
          labelApenas: labelApenasEdit || (incluiArq && incluiEng ? "Apenas Arquitetura" : incluiEng && !incluiArq ? "Apenas Engenharia" : "Apenas Arquitetura"),
          avisoIsolado: avisoIsolado, // frase "Referente às etapas..." quando isolamento parcial
          prazoCustom: prazoEdit, // pode ser null (usa default do PDF)
          naoInclCustom: naoInclEdit, // pode ser null
        },
        // Textos editáveis
        cidade: cidadeEdit, validadeStr: validadeEdit, pixTexto: pixEdit,
        // Escopo editado na preview
        escopoEditado: escopoState,
      };
      const modelo = defaultModelo(orc, arqTotal, engTotal, grandTotal, fmt, fmtM2, nUnid, engUnit, r, escritorio);
      if (resumoFinal && modelo.cliente) modelo.cliente.resumo = resumoFinal;
      // Sobrescreve subtítulo no modelo (modo estilo C do PDF usa modelo.subtitulo)
      if (modelo && subTituloFinal) modelo.subtitulo = subTituloFinal;
      const blob = await buildPdf(orc, logoPreview, modelo, null, "#ffffff", incluiArq, incluiEng, { returnBlob: opts.returnBlob, escritorio });
      if (opts.returnBlob) return blob;
    } catch(e) { console.error(e); dialogo.alertar({ titulo: "Erro ao gerar PDF", mensagem: e.message, tipo: "erro" }); }
  };

  return (
    <div style={wrap}>
      {/* Quando em modo somente-leitura (visualização de proposta enviada),
          desabilita todos os inputs e impede interações de edição. */}
      {lockEdicao && (
        <style>{`
          .proposta-locked input,
          .proposta-locked textarea,
          .proposta-locked select,
          .proposta-locked [contenteditable] {
            pointer-events: none !important;
            user-select: text !important;
            background: transparent !important;
          }
          .proposta-locked [data-editable-click] {
            pointer-events: none !important;
            cursor: default !important;
          }
          .proposta-locked button[data-edicao] {
            display: none !important;
          }
        `}</style>
      )}
      <div style={page} className={lockEdicao ? "proposta-locked" : ""}>
        {/* Badge de "Visualização de proposta enviada" */}
        {lockEdicao && (
          <div style={{
            background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8,
            padding:"10px 14px", marginBottom:16,
            display:"flex", alignItems:"center", justifyContent:"space-between", gap:12,
            fontSize:12.5,
          }}>
            <div>
              <strong style={{ color:"#166534" }}>📄 Visualização da proposta enviada</strong>
              {propostaReadOnly?.versao && (
                <span style={{ color:"#15803d", marginLeft:6 }}>
                  {propostaReadOnly.versao}
                  {propostaReadOnly.enviadaEm && ` · ${new Date(propostaReadOnly.enviadaEm).toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" })}`}
                </span>
              )}
              <div style={{ color:"#166534", marginTop:2, fontSize:11.5 }}>
                Este documento é um registro imutável do que foi enviado ao cliente.
              </div>
            </div>
          </div>
        )}

        {/* Aviso de proposta salva (após salvar) — não mostrar se já tem lockEdicao */}
        {!lockEdicao && propostaInfo && (
          <div style={{
            background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8,
            padding:"10px 14px", marginBottom:16,
            display:"flex", alignItems:"center", justifyContent:"space-between", gap:12,
            fontSize:12.5,
          }}>
            <div>
              <strong style={{ color:"#166534" }}>✓ Proposta {propostaInfo.versao} salva</strong>
              <span style={{ color:"#15803d", marginLeft:6 }}>
                em {new Date(propostaInfo.enviadaEm).toLocaleString("pt-BR", { dateStyle:"short", timeStyle:"short" })}
              </span>
              <div style={{ color:"#166534", marginTop:2, fontSize:11.5 }}>
                Esta versão está congelada. Para alterar, crie uma nova proposta a partir do orçamento.
              </div>
            </div>
          </div>
        )}

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:36 }}>
          <button onClick={onVoltar} style={{ background:"none", border:`1px solid ${LN}`, borderRadius:8, padding:"7px 14px", fontSize:13, cursor:"pointer", fontFamily:"inherit", color:MD }}>
            ← Voltar
          </button>
          {(propostaInfo || lockEdicao) ? (
            <button onClick={handlePdf} style={{ background:C, border:"none", borderRadius:8, padding:"8px 22px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", color:"#fff" }}>
              Gerar PDF
            </button>
          ) : (
            <button onClick={() => onSalvarProposta ? setConfirmSalvar(true) : handlePdf()}
              style={{ background:C, border:"none", borderRadius:8, padding:"8px 22px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", color:"#fff" }}>
              {onSalvarProposta ? "Salvar e Gerar PDF" : "Gerar PDF"}
            </button>
          )}
        </div>

        {/* Modal de confirmação */}
        {confirmSalvar && (
          <div
            onClick={e => { if (e.target === e.currentTarget) setConfirmSalvar(false); }}
            style={{
              position:"fixed", inset:0, background:"rgba(0,0,0,0.4)",
              display:"flex", alignItems:"center", justifyContent:"center",
              zIndex:200, padding:20,
            }}>
            <div style={{
              background:"#fff", borderRadius:12, width:"100%", maxWidth:440,
              boxShadow:"0 20px 40px rgba(0,0,0,0.15)", overflow:"hidden",
            }}>
              <div style={{ padding:"20px 24px 12px", borderBottom:"1px solid #f3f4f6" }}>
                <div style={{ fontSize:17, fontWeight:700, color:"#111" }}>Salvar proposta e gerar PDF</div>
              </div>
              <div style={{ padding:"16px 24px 20px" }}>
                <p style={{ fontSize:13, color:"#374151", lineHeight:1.5, margin:0 }}>
                  Esta proposta será <strong>congelada</strong> com os valores e textos atuais. Ela ficará salva no histórico do orçamento e não poderá mais ser editada.
                </p>
                <p style={{ fontSize:13, color:"#6b7280", lineHeight:1.5, marginTop:10 }}>
                  Para alterar depois, você pode criar uma nova proposta (v2, v3…) a partir do orçamento.
                </p>
                <div style={{ display:"flex", gap:8, marginTop:20, justifyContent:"flex-end" }}>
                  <button onClick={() => setConfirmSalvar(false)}
                    style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:7, padding:"8px 16px", fontSize:13, cursor:"pointer", fontFamily:"inherit", color:"#374151" }}>
                    Cancelar
                  </button>
                  <button onClick={handleSalvarProposta}
                    style={{ background:"#111", border:"1px solid #111", borderRadius:7, padding:"8px 16px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", color:"#fff" }}>
                    Salvar e gerar PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {logoPreview ? (
              <div style={{ position:"relative", display:"inline-flex", alignItems:"center" }}>
                <img src={logoPreview} alt="Logo" style={{ height:44, maxWidth:120, objectFit:"contain", borderRadius:4 }} />
                <button onClick={handleLogoRemove} title="Remover logo"
                  style={{ position:"absolute", top:-6, right:-6, width:16, height:16, borderRadius:"50%",
                    background:"#ef4444", border:"none", cursor:"pointer", display:"flex", alignItems:"center",
                    justifyContent:"center", fontSize:9, color:"#fff", fontWeight:700, lineHeight:1 }}>
                  ✕
                </button>
              </div>
            ) : (
              <button onClick={() => inputLogoRef.current?.click()}
                style={{ height:44, padding:"0 12px", border:"1.5px dashed #d1d5db", borderRadius:6,
                  background:"#f5f6f8", cursor:"pointer", fontSize:11, color:"#828a98", fontFamily:"inherit",
                  display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap" }}>
                + Logo
              </button>
            )}
            <input ref={inputLogoRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleLogoUpload} />
          </div>
          <div style={{ fontSize:11, color:LT }}><TextoEditavel valor={cidadeEdit} onChange={setCidadeEdit} style={{}} />, {dataStr} · Válido até <TextoEditavel valor={validadeEdit} onChange={setValidadeEdit} style={{}} /></div>
        </div>

        <div style={{ borderTop:`1.5px solid ${C}`, borderBottom:`0.5px solid ${LN}`, padding:"12px 0", marginBottom:20, display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
          <div>
            <div style={{ fontSize:24, fontWeight:600, color:C }}>{clienteNome || "Cliente"}</div>
            <div style={{ fontSize:10, color:LT, marginTop:3, letterSpacing:"0.04em" }}><TextoEditavel valor={subTituloFinal} onChange={setSubTituloEdit} style={{ fontSize:10 }} /></div>
          </div>
          <div style={{ textAlign:"right" }}>
            {incluiArq && engAtiva && (
              <>
                <div style={{ display:"flex", alignItems:"baseline", justifyContent:"flex-end", gap:6 }}>
                  <span style={{ fontSize:10, color:LT }}>Apenas Arquitetura</span>
                  <span style={{ fontSize:22, fontWeight:600, color:C }}>{fmtV(temIsoladas ? arqIsoladaSI : arqEdit)}</span>
                </div>
                {areaTot > 0 && (
                  <div style={{ fontSize:11, color:LT }}>R$ {fmtN(Math.round((temIsoladas ? arqIsoladaSI : arqCI)/areaTot*100)/100)}/m²</div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Aviso de isolamento parcial (só quando tem arq isolada E nem todas estão) */}
        {(() => {
          const etArqTotal = etapasPct.filter(e => e.id !== 5).length;
          const etArqIsoladas = etapasIsoladasObjs.filter(e => e.id !== 5);
          if (!temIsoladas || etArqIsoladas.length === 0 || etArqIsoladas.length >= etArqTotal) return null;
          const nomes = etArqIsoladas.map(e => e.nome);
          let lista;
          if (nomes.length === 1) lista = nomes[0];
          else if (nomes.length === 2) lista = `${nomes[0]} e ${nomes[1]}`;
          else lista = `${nomes.slice(0,-1).join(", ")} e ${nomes[nomes.length-1]}`;
          const verboEtapa = nomes.length === 1 ? "à etapa de" : "às etapas de";
          return (
            <div style={{ marginBottom:12, fontSize:13, color:C, fontWeight:600, lineHeight:1.5 }}>
              Referente {verboEtapa} {lista}:
            </div>
          );
        })()}
        {resumoFinal && (
          <div style={{ marginBottom:20, position:"relative" }}>
            {editandoResumo ? (
              <textarea
                autoFocus
                value={resumoFinal}
                onChange={e => setResumoEdit(e.target.value)}
                onBlur={() => setEditandoResumo(false)}
                style={{ width:"100%", fontSize:13, color:MD, lineHeight:1.7, fontFamily:"inherit",
                  background:"#fffde7", border:"2px solid #f59e0b", borderRadius:4,
                  padding:"6px 8px", outline:"none", resize:"vertical", minHeight:60, boxSizing:"border-box" }}
              />
            ) : (
              <div
                onClick={() => setEditandoResumo(true)}
                title="Clique para editar"
                style={{ fontSize:13, color:MD, lineHeight:1.7, cursor:"pointer" }}>
                {resumoFinal}
              </div>
            )}
          </div>
        )}

        <div style={{ display:"flex", alignItems:"center", gap:10, margin:"0 0 14px" }}>
          <span style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", color:"#828a98", fontWeight:600, whiteSpace:"nowrap" }}>Valores dos projetos</span>
          <div style={{ flex:1, height:1, background:"#e5e7eb" }} />
          {valorEditado && (
            <button className="no-print" onClick={() => { setArqEdit(arqOriginal); setEngEdit(engOriginal); }}
              style={{ fontSize:11, color:"#dc2626", background:"#fef2f2", border:"1px solid #fca5a5",
                borderRadius:6, padding:"3px 10px", cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap", fontWeight:600 }}>
              ↺ Restaurar valores
            </button>
          )}
        </div>
        <div>

          <div style={{ display:"grid", gridTemplateColumns: incluiArq && engAtiva ? "1fr 0.5px 1fr" : "1fr", gap:0, marginBottom:12 }}>
            {incluiArq && <div style={{ paddingRight:20 }}>
              <div style={tag}>Arquitetura</div>
              <div style={{ fontSize:20, fontWeight:600, color:C }}>
                {editandoArq ? (
                  <input autoFocus type="text"
                    key={arqCI}
                    defaultValue={(temIsoladas ? arqIsoladaSI : arqCI).toFixed(2).replace(".",",")}
                    onBlur={e => { const v = parseValorBR(e.target.value); if(v>0){ if(temIsoladas && pctTotalIsolado>0){ setArqEdit(Math.round(v/(pctTotalIsolado/100)*100)/100); } else { setArqEdit(Math.round(v*100)/100); } } setEditandoArq(false); }}
                    onKeyDown={e => { if(e.key==="Enter") e.target.blur(); if(e.key==="Escape") setEditandoArq(false); }}
                    style={{ fontSize:20, fontWeight:600, color:C, fontFamily:"inherit", background:"#fffde7",
                      border:"1px solid #b0b7c3", borderRadius:4, padding:"2px 6px", outline:"none", width:"100%" }} />
                ) : (
                  <span onClick={() => setEditandoArq(true)} title="Clique para editar" style={{ cursor:"pointer" }}>
                    {fmtV(temIsoladas ? arqIsoladaSI : arqCI)}
                  </span>
                )}
              </div>
              {areaTot > 0 && (
                <div style={{ fontSize:11, color:LT }}>R$ {fmtN(Math.round((temIsoladas ? arqIsoladaSI : arqCI)/areaTot*100)/100)}/m²</div>
              )}
            </div>}
            {incluiArq && engAtiva && <div style={{ background:LN }} />}
            {engAtiva && <div style={{ paddingLeft: incluiArq ? 20 : 0 }}>
              <div style={tag}>Engenharia <span style={{ fontSize:10, color:LT, textTransform:"none", letterSpacing:0 }}>(Opcional)</span></div>
              <div style={{ fontSize:20, fontWeight:600, color:C }}>
                {editandoEng ? (
                  <input autoFocus type="text"
                    key={engCI}
                    defaultValue={engCI.toFixed(2).replace(".",",")}
                    onBlur={e => { const v = parseValorBR(e.target.value); setEngEdit(v>0 ? Math.round(v*100)/100 : engCI); setEditandoEng(false); }}
                    onKeyDown={e => { if(e.key==="Enter") e.target.blur(); if(e.key==="Escape") setEditandoEng(false); }}
                    style={{ fontSize:20, fontWeight:600, color:C, fontFamily:"inherit", background:"#fffde7",
                      border:"1px solid #b0b7c3", borderRadius:4, padding:"2px 6px", outline:"none", width:"100%" }} />
                ) : (
                  <span onClick={() => setEditandoEng(true)} title="Clique para editar" style={{ cursor:"pointer" }}>
                    {fmtV(engCI)}
                  </span>
                )}
              </div>
              {areaTot > 0 && (
                <div style={{ fontSize:11, color:LT }}>R$ {fmtN(Math.round(engCI/areaTot*100)/100)}/m²</div>
              )}
            </div>}
          </div>
          <div style={{ border:`0.5px solid ${LN}`, borderRadius:8, padding:"10px 14px", fontSize:12, color:LT, marginBottom:4,
              display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
            <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
              <span style={{
                position:"relative", display:"inline-block", width:26, height:14,
                background: temImposto ? "#0369a1" : "#d1d5db",
                borderRadius:7, transition:"background 0.15s",
              }}>
                <span style={{
                  position:"absolute", top:2, left: temImposto ? 14 : 2,
                  width:10, height:10, background:"#fff", borderRadius:"50%",
                  transition:"left 0.15s", boxShadow:"0 1px 2px rgba(0,0,0,0.2)",
                }} />
              </span>
              <input type="checkbox" checked={temImposto} onChange={e => setTemImpostoLocal(e.target.checked)} style={{ display:"none" }} />
              <span>Incluir impostos</span>
            </label>
            {temImposto && (
              <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                <NumInput valor={aliqImp} onCommit={n => setAliqImpLocal(n)}
                  decimais={2} min={0} max={99} width={42}
                  style={{ textAlign:"right" }} />
                <span style={{ color:LT }}>%</span>
              </span>
            )}
            <span style={{ color:LN }}>·</span>
            {temImposto ? (<>
              + Impostos — <span style={{ color:MD, fontWeight:500 }}>{fmtV(temIsoladas ? Math.round((totCIBase - totSIBase)*100)/100 : impostoEdit)}</span>
              &nbsp;·&nbsp; Total com impostos — <span style={{ fontSize:13, fontWeight:600, color:C }}>{fmtV(totCIBase)}</span>
            </>) : (<>
              Total sem impostos — <span style={{ fontSize:13, fontWeight:600, color:C }}>{fmtV(totCIBase)}</span>
            </>)}
          </div>
          <div style={{ display:"flex", gap:6, marginTop:6, marginBottom:4 }}>
            <button
              onClick={() => {
                setTipoPgtoLocal("padrao");
                // Limpa etapas isoladas ao trocar pra Pagamento padrão
                // (pagamento padrão = orça tudo; isolamento é exclusivo do modo "Por etapas")
                setEtapasIsoladasLocal(new Set());
              }}
              style={{ flex:1, padding:"8px 10px", fontSize:12, fontWeight:isPadrao?600:400,
                border: isPadrao ? `1px solid ${C}` : `0.5px solid ${LN}`,
                background:"transparent", borderRadius:6, cursor:"pointer", color:C, fontFamily:"inherit" }}>
              Pagamento padrão
            </button>
            <button
              onClick={() => setTipoPgtoLocal("etapas")}
              style={{ flex:1, padding:"8px 10px", fontSize:12, fontWeight:!isPadrao?600:400,
                border: !isPadrao ? `1px solid ${C}` : `0.5px solid ${LN}`,
                background:"transparent", borderRadius:6, cursor:"pointer", color:C, fontFamily:"inherit" }}>
              Por etapas
            </button>
          </div>
        </div>

        <Sec title={isPadrao ? "Formas de pagamento" : "Contratação por etapa"}>
          {isPadrao ? (<>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:8 }}>
                <TextoEditavel
                  valor={labelApenasEdit || (incluiArq && incluiEng ? "Apenas Arquitetura" : incluiEng ? "Apenas Engenharia" : "Apenas Arquitetura")}
                  onChange={setLabelApenasEdit}
                  style={{ fontSize:12, fontWeight:600 }} />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:6 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Antecipado — desconto</span>
                  <NumInput valor={descArqLocal} onCommit={n => setDescArqLocal(n)} decimais={2} min={0} max={100} width={42} />
                  <span style={{ fontSize:11, color:LT }}>%</span>
                </div>
                <span style={{ color:LN }}>·</span>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Parcelado</span>
                  <NumInput valor={parcArqLocal} onCommit={n => setParcArqLocal(Math.max(1, n))} decimais={0} min={1} max={99} width={42} />
                  <span style={{ fontSize:11, color:LT }}>×</span>
                </div>
              </div>
              <OpcoesPagamento tipo="pacote" valor={arqCIEdit} desc={descArqLocal} parcelas={parcArqLocal} fmtV={fmtV} />
            </div>
            {incluiArq && incluiEng && (
            <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:12, marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:8 }}>Pacote Completo (Arq. + Eng.)</div>
              <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:6 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Antecipado — desconto</span>
                  <NumInput valor={descPacoteLocal} onCommit={n => setDescPacoteLocal(n)} decimais={2} min={0} max={100} width={42} />
                  <span style={{ fontSize:11, color:LT }}>%</span>
                </div>
                <span style={{ color:LN }}>·</span>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Parcelado</span>
                  <NumInput valor={parcPacoteLocal} onCommit={n => setParcPacoteLocal(Math.max(1, n))} decimais={0} min={1} max={99} width={42} />
                  <span style={{ fontSize:11, color:LT }}>×</span>
                </div>
              </div>
              <OpcoesPagamento tipo="pacote" valor={totCIEdit} desc={descPacoteLocal} parcelas={parcPacoteLocal} fmtV={fmtV} />
            </div>
            )}
          </>) : (<>
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"grid", gridTemplateColumns:"24px 1fr 60px 60px 110px 22px", gap:6, alignItems:"center", paddingBottom:6, borderBottom:`1.5px solid ${C}` }}>
                <span></span>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:10, fontWeight:600, color:C, textTransform:"uppercase", letterSpacing:"0.06em" }}>Etapa</span>
                  <label style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", fontSize:10, color:LT, textTransform:"none", letterSpacing:0, fontWeight:400 }}>
                    <span style={{
                      position:"relative", display:"inline-block", width:26, height:14,
                      background: mostrarTabelaEtapas ? "#0369a1" : "#d1d5db",
                      borderRadius:7, transition:"background 0.15s",
                    }}>
                      <span style={{
                        position:"absolute", top:2, left: mostrarTabelaEtapas ? 14 : 2,
                        width:10, height:10, background:"#fff", borderRadius:"50%",
                        transition:"left 0.15s", boxShadow:"0 1px 2px rgba(0,0,0,0.2)",
                      }} />
                    </span>
                    <input type="checkbox"
                      checked={mostrarTabelaEtapas}
                      onChange={e => setMostrarTabelaEtapas(e.target.checked)}
                      style={{ display:"none" }} />
                    <span>Mostrar no PDF</span>
                  </label>
                </div>
                <span></span>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                  <span style={{ fontSize:10, fontWeight:600, color:C, textTransform:"uppercase", letterSpacing:"0.06em" }}>%</span>
                  <span
                    title="Para alterar valores das etapas de arquitetura, edite o total de arquitetura no topo ou ajuste os percentuais"
                    style={{ fontSize:11, color:LT, cursor:"help", userSelect:"none", lineHeight:1 }}>ⓘ</span>
                </div>
                <span style={{ fontSize:10, fontWeight:600, color:C, textTransform:"uppercase", letterSpacing:"0.06em", textAlign:"right" }}>Valor</span>
                <span></span>
              </div>
              {etapasPct.filter(e => incluiEng || e.id !== 5).map((et, i) => {
                const isIsolada = idsIsolados.has(et.id);
                const isEng = et.id === 5;
                // visivel: sem isolamento, tudo visível. Com isolamento, só isoladas
                const visivel = !temIsoladas || isIsolada;
                const bgRow = isIsolada ? "#e0f2fe" : "transparent";
                const corRow = isIsolada ? "#0369a1" : C;
                const fontWt = isIsolada ? 600 : 400;
                // Valor da etapa: arq × pct/100 (com imp). Engenharia: integral (com imp)
                const valorEtapa = isEng
                  ? engCIEdit
                  : Math.round(arqCIEdit*(et.pct/100)*100)/100;
                return (
                <div key={et.id} style={{ display:"grid", gridTemplateColumns:"24px 1fr 60px 60px 110px 22px", gap:6, padding:"7px 4px", borderBottom:`0.5px solid ${LN}`, alignItems:"center", background: bgRow, opacity: visivel ? 1 : 0.35 }}>
                  <span
                    onClick={() => toggleIsolarEtapa(et.id)}
                    title={isIsolada ? "Desmarcar isolamento" : "Orçar apenas esta etapa"}
                    style={{ cursor:"pointer", textAlign:"center", fontSize:14, color: isIsolada ? "#0369a1" : LT, fontWeight:500, userSelect:"none" }}>
                    {isIsolada ? "◉" : "◎"}
                  </span>
                  <span style={{ color:corRow, fontWeight:fontWt }}>
                    {isEng ? (<>
                      <div>Projetos de Engenharia</div>
                      <div style={{ fontSize:11, color:LT, fontWeight:400 }}>Estrutural · Elétrico · Hidrossanitário</div>
                    </>) : (
                      <TextoEditavel valor={et.nome} onChange={v => atualizarEtapaNome(et.id, v)} style={{ fontSize:13, color:corRow, fontWeight:fontWt }} />
                    )}
                  </span>
                  <span></span>
                  {!isEng ? (
                    <NumInput valor={et.pct} onCommit={n => atualizarEtapaPct(et.id, n)}
                      decimais={0} min={0} max={100} width={50} />
                  ) : (
                    <span style={{ color:LT, textAlign:"center" }}>—</span>
                  )}
                  {!isEng ? (
                    <span style={{ fontSize:12, color:corRow, fontWeight:isIsolada?600:500, textAlign:"right", padding:"3px 6px" }}>
                      {fmtN(valorEtapa)}
                    </span>
                  ) : (
                    <EtapaValorInput
                      valorAtual={valorEtapa}
                      fmtN={fmtN}
                      onCommit={novo => {
                        // Converte valor com imposto de volta para sem imposto antes de setar engEdit
                        const semImp = semImposto(novo);
                        setEngEdit(semImp);
                      }}
                      borderColor={LN}
                      color={corRow}
                    />
                  )}
                  {!isEng ? (
                    <span onClick={() => removerEtapa(et.id)} title="Remover etapa"
                      style={{ cursor:"pointer", textAlign:"center", color:"#d1d5db", userSelect:"none", fontSize:14 }}>×</span>
                  ) : <span></span>}
                </div>
                );
              })}
              <div style={{ padding:"8px 0" }}>
                <button
                  onClick={adicionarEtapa}
                  style={{ width:"100%", fontSize:11, color:LT, background:"transparent",
                    border:`1px dashed ${LN}`, borderRadius:6, padding:"6px", cursor:"pointer", fontFamily:"inherit" }}>
                  + Adicionar etapa
                </button>
              </div>
              {(() => {
                // Total = apenas linhas ativas
                // - Etapas arq: ativas se (sem isolamento) OU (isolada)
                // - Engenharia: ativa se incluiEng && ((sem isolamento) OU (eng isolada))
                const etapasAtivas = etapasPct.filter(e => {
                  if (e.id === 5) return false; // eng vai separado
                  if (!temIsoladas) return true;
                  return idsIsolados.has(e.id);
                });
                const pctAtivo = etapasAtivas.reduce((s,e)=>s+Number(e.pct),0);
                const engAtiva = incluiEng && (!temIsoladas || idsIsolados.has(5));
                const valorAtivo = Math.round((arqCIEdit * pctAtivo / 100 + (engAtiva ? engCIEdit : 0)) * 100) / 100;
                return (
                  <div style={{ display:"grid", gridTemplateColumns:"24px 1fr 60px 60px 110px 22px", gap:6, padding:"8px 4px", borderTop:`1.5px solid ${C}`, marginTop:2, alignItems:"center" }}>
                    <span></span>
                    <span style={{ fontWeight:600, color:C }}>Total</span>
                    <span></span>
                    <span style={{ fontWeight:600, color:C, textAlign:"center" }}>{pctAtivo}%</span>
                    <span style={{ fontSize:15, fontWeight:700, color:C, textAlign:"right" }}>{fmtV(valorAtivo)}</span>
                    <span></span>
                  </div>
                );
              })()}
            </div>
            {mostrarTabelaEtapas ? (
            <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:10, marginBottom:10 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:8 }}>Etapa a Etapa</div>
              <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Antecipado por etapa — desconto</span>
                  <NumInput valor={descEtCtrtLocal} onCommit={n => setDescEtCtrtLocal(n)} decimais={2} min={0} max={100} width={42} />
                  <span style={{ fontSize:11, color:LT }}>%</span>
                </div>
                <span style={{ color:LN }}>·</span>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Parcelado por etapa</span>
                  <NumInput valor={parcEtCtrtLocal} onCommit={n => setParcEtCtrtLocal(Math.max(1, n))} decimais={0} min={1} max={99} width={42} />
                  <span style={{ fontSize:11, color:LT }}>×</span>
                </div>
              </div>
              <OpcoesPagamento tipo="etapaAEtapa" desc={descEtCtrtLocal} parcelas={parcEtCtrtLocal} fmtV={fmtV} />
            </div>
            ) : (
            /* Toggle "Mostrar no PDF" DESLIGADO: espelha pagamento padrão —
               "Apenas Arquitetura" (valor arq selecionada) + "Pacote Completo" se eng ativa */
            <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:10, marginBottom:10 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:8 }}>
                Apenas Arquitetura
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:6 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Antecipado — desconto</span>
                  <NumInput valor={descArqLocal} onCommit={n => setDescArqLocal(n)} decimais={2} min={0} max={100} width={42} />
                  <span style={{ fontSize:11, color:LT }}>%</span>
                </div>
                <span style={{ color:LN }}>·</span>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:12, color:MD }}>Parcelado</span>
                  <NumInput valor={parcArqLocal} onCommit={n => setParcArqLocal(Math.max(1, n))} decimais={0} min={1} max={99} width={42} />
                  <span style={{ fontSize:11, color:LT }}>×</span>
                </div>
              </div>
              <OpcoesPagamento tipo="pacote" valor={subTotalArqEtapas} desc={descArqLocal} parcelas={parcArqLocal} fmtV={fmtV} />
            </div>
            )}
            {/* Pacote Completo — sempre aparece quando tem mais de 1 etapa selecionada
                 OU quando eng + arq estão selecionadas (oferece contratação total)
                 Não aparece se só 1 etapa sem eng (pacote = etapa única, não faz sentido) */}
            {(() => {
              const etArqAtivas = etapasPct.filter(e => e.id !== 5 && (!temIsoladas || idsIsolados.has(e.id)));
              const multiEtapas = etArqAtivas.length > 1;
              const temArqEEng = incluiArq && engAtiva && etArqAtivas.length > 0;
              // Pacote Completo só aparece em 2 cenários:
              // 1) Toggle LIGADO + (várias etapas OU arq+eng) — permite contratação total vs etapa a etapa
              // 2) Toggle DESLIGADO + arq+eng ambos ativos — oferece "Apenas Arq" + "Pacote Completo"
              // Quando toggle desligado E sem eng, fica só o bloco único "Apenas Arq" (sem pacote)
              const mostraPacote = mostrarTabelaEtapas
                ? (multiEtapas || temArqEEng)
                : temArqEEng; // toggle off: só mostra pacote se tem arq+eng
              if (!mostraPacote) return null;
              // Label dinâmico
              const labelPacote = (incluiArq && engAtiva)
                ? "Pacote Completo (Arq. + Eng.)"
                : "Pacote Completo";
              return (
                <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:10, marginBottom:10 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:C, marginBottom:8 }}>{labelPacote}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:6 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:12, color:MD }}>Antecipado — desconto</span>
                      <NumInput valor={descPacCtrtLocal} onCommit={n => setDescPacCtrtLocal(n)} decimais={2} min={0} max={100} width={42} />
                      <span style={{ fontSize:11, color:LT }}>%</span>
                    </div>
                    <span style={{ color:LN }}>·</span>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:12, color:MD }}>Parcelado</span>
                      <NumInput valor={parcPacCtrtLocal} onCommit={n => setParcPacCtrtLocal(Math.max(1, n))} decimais={0} min={1} max={99} width={42} />
                      <span style={{ fontSize:11, color:LT }}>×</span>
                    </div>
                  </div>
                  <OpcoesPagamento tipo="pacote" valor={totalPacoteEtapas} desc={descPacCtrtLocal} parcelas={parcPacCtrtLocal} fmtV={fmtV} />
                </div>
              );
            })()}
          </>)}
          <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:10, fontSize:11, color:LT }}>
            <TextoEditavel valor={pixEdit} onChange={setPixEdit} style={{ fontSize:11, color:LT }} />
          </div>
        </Sec>

        <Sec title="Escopo dos serviços" action={
          <span
            onClick={() => {
              const newId = Date.now();
              setEscopoState(prev => {
                const semEng = prev.filter(b => !b.isEng);
                const eng = prev.filter(b => b.isEng);
                return [...semEng, { etapaId:newId, titulo:"", objetivo:"", itens:[], entregaveis:[], obs:"", isEng:false, custom:true }, ...eng];
              });
            }}
            style={{ fontSize:10, color:LT, cursor:"pointer", padding:"2px 8px", borderRadius:4,
              border:`1px solid ${LN}`, background:"#f3f4f6", whiteSpace:"nowrap", userSelect:"none" }}>+ bloco</span>
        }>
          {escopoDefault.map((bloco, i) => {
            // Separa número (fixo) do texto (editável)
            const numMatch = bloco.tituloNum.match(/^(\d+\.\s*)(.*)$/);
            const numPrefix = numMatch ? numMatch[1] : "";
            const tituloTexto = numMatch ? numMatch[2] : bloco.tituloNum;
            return (
            <div key={bloco.etapaId} style={{ marginBottom:18 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6, gap:8 }}>
                <div style={{ display:"flex", alignItems:"baseline", gap:4, flex:1, minWidth:0 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:C, whiteSpace:"nowrap" }}>{numPrefix}</span>
                  <InputControlado
                    valor={tituloTexto}
                    onCommit={v => setEscopoBloco(bloco.etapaId, "titulo", v)}
                    placeholder="Inserir novo escopo"
                    style={{ flex:1, minWidth:0 }}
                  />
                </div>
                <span
                  onClick={() => setEscopoState(prev => prev.filter(b => b.etapaId !== bloco.etapaId))}
                  title="Remover bloco"
                  style={{ fontSize:11, color:"#d1d5db", cursor:"pointer", padding:"2px 6px", borderRadius:4,
                    border:"1px solid #e5e7eb", background:"#fafafa", lineHeight:1.4,
                    userSelect:"none" }}>✕ remover</span>
              </div>
              {bloco.custom ? (
                // Bloco customizado — totalmente editável
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <div>
                    <div style={tag}>Objetivo</div>
                    <TextareaControlado
                      valor={bloco.objetivo}
                      onCommit={v => setEscopoBloco(bloco.etapaId, "objetivo", v)}
                      placeholder="Descreva o objetivo desta etapa..."
                      minHeight={60}
                    />
                  </div>
                  <div>
                    <div style={tag}>Descrição / Serviços inclusos</div>
                    <TextareaControlado
                      valor={(bloco.itens||[]).join("\n")}
                      onCommit={v => setEscopoBloco(bloco.etapaId, "itens", v.split("\n").filter(s=>s.trim()))}
                      placeholder="Um item por linha..."
                      minHeight={80}
                    />
                    <div style={{ fontSize:11, color:LT, marginTop:3 }}>Um item por linha</div>
                  </div>
                  <div>
                    <div style={tag}>Entregáveis</div>
                    <TextareaControlado
                      valor={(bloco.entregaveis||[]).join("\n")}
                      onCommit={v => setEscopoBloco(bloco.etapaId, "entregaveis", v.split("\n").filter(s=>s.trim()))}
                      placeholder="Um entregável por linha..."
                      minHeight={60}
                    />
                    <div style={{ fontSize:11, color:LT, marginTop:3 }}>Um entregável por linha</div>
                  </div>
                  <div>
                    <div style={tag}>Observação</div>
                    <TextareaControlado
                      valor={bloco.obs}
                      onCommit={v => setEscopoBloco(bloco.etapaId, "obs", v)}
                      placeholder="Observação opcional..."
                      minHeight={40}
                    />
                  </div>
                </div>
              ) : (
                // Bloco fixo — editável inline
                <>
                  {bloco.objetivo !== undefined && <>
                    <div style={tag}>Objetivo</div>
                    <TextoEditavel valor={bloco.objetivo} onChange={v => setEscopoBloco(bloco.etapaId, "objetivo", v)}
                      style={{ fontSize:13, color:MD, lineHeight:1.7, display:"block" }} multiline={true} />
                  </>}
                  {bloco.itens !== undefined && <>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:2 }}>
                      <div style={tag}>Serviços inclusos</div>
                      <span onClick={() => setEscopoBloco(bloco.etapaId, "itens", [...(bloco.itens||[]), "Novo item"])}
                        title="Adicionar item"
                        style={{ fontSize:10, color:LT, cursor:"pointer", padding:"0 4px", borderRadius:3,
                          background:"#f3f4f6", border:"1px solid #c8cdd6", lineHeight:"16px" }}>+ item</span>
                    </div>
                    {(bloco.itens||[]).map((it,j) => (
                      <div key={j} style={{ ...bl, alignItems:"flex-start" }}>
                        <span style={dot}>•</span>
                        <TextoEditavel valor={it} onChange={v => {
                          const arr = [...bloco.itens]; arr[j] = v;
                          setEscopoBloco(bloco.etapaId, "itens", arr);
                        }} style={{ fontSize:13, color:MD, lineHeight:1.6, flex:1 }} />
                        <span onClick={() => setEscopoBloco(bloco.etapaId, "itens", bloco.itens.filter((_,k)=>k!==j))}
                          style={{ fontSize:10, color:"#d1d5db", cursor:"pointer", marginLeft:4, flexShrink:0, paddingTop:2 }}>✕</span>
                      </div>
                    ))}
                  </>}
                  {bloco.entregaveis !== undefined && <>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:2, marginTop:6 }}>
                      <div style={tag}>Entregáveis</div>
                      <span onClick={() => setEscopoBloco(bloco.etapaId, "entregaveis", [...(bloco.entregaveis||[]), "Novo entregável"])}
                        title="Adicionar entregável"
                        style={{ fontSize:10, color:LT, cursor:"pointer", padding:"0 4px", borderRadius:3,
                          background:"#f3f4f6", border:"1px solid #c8cdd6", lineHeight:"16px" }}>+ item</span>
                    </div>
                    {(bloco.entregaveis||[]).map((it,j) => (
                      <div key={j} style={{ ...bl, alignItems:"flex-start" }}>
                        <span style={dot}>•</span>
                        <TextoEditavel valor={it} onChange={v => {
                          const arr = [...bloco.entregaveis]; arr[j] = v;
                          setEscopoBloco(bloco.etapaId, "entregaveis", arr);
                        }} style={{ fontSize:13, color:MD, lineHeight:1.6, flex:1 }} />
                        <span onClick={() => setEscopoBloco(bloco.etapaId, "entregaveis", bloco.entregaveis.filter((_,k)=>k!==j))}
                          style={{ fontSize:10, color:"#d1d5db", cursor:"pointer", marginLeft:4, flexShrink:0, paddingTop:2 }}>✕</span>
                      </div>
                    ))}
                  </>}
                  {bloco.obs !== undefined && <div style={{ fontSize:12, color:LT, marginTop:8, lineHeight:1.6, fontStyle:"italic" }}>
                    <TextoEditavel valor={bloco.obs} onChange={v => setEscopoBloco(bloco.etapaId, "obs", v)}
                      style={{ fontSize:12, color:LT, fontStyle:"italic" }} multiline={true} />
                  </div>}
                </>
              )}
              {i < escopoDefault.length-1 && <div style={{ borderBottom:`0.5px solid ${LN}`, marginTop:14 }} />}
            </div>
            );
          })}

        </Sec>

        <Sec title="Serviços não inclusos">
          <div style={{ columns:"2", columnGap:32, marginBottom:8 }}>
            {(naoInclEdit || naoInclDefault).map((item, i) => (
              <div key={i} style={{ ...bl, breakInside:"avoid", marginBottom:4, alignItems:"flex-start" }}>
                <span style={dot}>•</span>
                <TextoEditavel valor={item.label} onChange={v => {
                  const arr = [...(naoInclEdit || naoInclDefault)];
                  arr[i] = { ...arr[i], label: v };
                  setNaoInclEdit(arr);
                }} style={{ fontSize:13, color:MD, flex:1 }} />
                {item.sub && <span style={{ fontSize:11, color:LT, marginLeft:4 }}>{item.sub}</span>}
                <span onClick={() => setNaoInclEdit((naoInclEdit || naoInclDefault).filter((_,k)=>k!==i))}
                  style={{ fontSize:10, color:"#d1d5db", cursor:"pointer", marginLeft:4, flexShrink:0, paddingTop:2 }}>✕</span>
              </div>
            ))}
          </div>
          <div style={{ marginBottom:8 }}>
            <span onClick={() => setNaoInclEdit([...(naoInclEdit||naoInclDefault), { label:"Novo item", sub:null }])}
              style={{ fontSize:11, color:LT, cursor:"pointer", padding:"2px 8px", borderRadius:4,
                background:"#f3f4f6", border:"1px solid #c8cdd6" }}>+ item</span>
          </div>
          <div style={{ fontSize:12, color:LT, fontStyle:"italic" }}>Todos os serviços não inclusos podem ser contratados como serviços adicionais.</div>
        </Sec>

        <Sec title="Prazo de execução">
          {(prazoEdit || prazoDefault).filter(p => {
              if (p.toLowerCase().includes("engenharia")) {
                if (!engAtiva) return false; // toggle desligado OU eng não isolada
              }
              return true;
            }).map((p, i) => (
            <div key={i} style={{ ...bl, marginBottom:6 }}>
              <span style={dot}>•</span>
              <TextoEditavel valor={p} onChange={v => {
                const arr = [...(prazoEdit || prazoDefault)];
                arr[i] = v;
                setPrazoEdit(arr);
              }} style={{ fontSize:13, color:MD, lineHeight:1.6 }} multiline={true} />
            </div>
          ))}
        </Sec>

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
              <div style={{ fontSize:14, fontWeight:600, color:C, marginBottom:4 }}><TextoEditavel valor={responsavelEdit} onChange={setResponsavelEdit} style={{ fontSize:14, fontWeight:600 }} /></div>
              <div style={{ fontSize:12, color:LT, marginBottom:20 }}><TextoEditavel valor={cauEdit} onChange={setCauEdit} style={{ fontSize:12 }} /></div>
              <div style={{ borderTop:`0.5px solid ${LN}`, paddingTop:6, display:"flex", justifyContent:"space-between", fontSize:11, color:LT }}>
                <span>Assinatura</span><span>{dataStr}</span>
              </div>
            </div>
          </div>
        </Sec>

        <div style={{ borderTop:`0.5px solid ${LN}`, marginTop:48, paddingTop:14, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:11, color:LT }}>
            <span>{escritorio.nome || "Escritório"}</span><span>·</span>
            <TextoEditavel valor={emailEdit} onChange={setEmailEdit} style={{ fontSize:11 }} /><span>·</span>
            <TextoEditavel valor={telefoneEdit} onChange={setTelefoneEdit} style={{ fontSize:11 }} /><span>·</span>
            <TextoEditavel valor={instagramEdit} onChange={setInstagramEdit} style={{ fontSize:11 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function FormOrcamentoProjetoTeste({ onSalvar, orcBase, clienteNome, clienteWA, onVoltar, modoVer, modoAbertura, escritorio }) {
  // Normaliza escritorio (defaults vazios se algo faltar)
  const esc = escritorio || {};
  // Primeiro responsável técnico serve como responsável padrão na proposta.
  // Se o escritório tiver vários, o master/admin ajusta o texto do PDF via
  // edição inline do "responsavelEdit" / "cauEdit" no PropostaPreview.
  const _respPrimeiro = (esc.responsaveis && esc.responsaveis.length > 0) ? esc.responsaveis[0] : null;
  const [referencia,   setReferencia]   = useState(orcBase?.referencia  || "");
  const [tipoObra,     setTipoObra]     = useState(orcBase?.subtipo     || null);
  const [tipoProjeto,  setTipoProjeto]  = useState(orcBase?.tipo        || null);
  const [padrao,       setPadrao]       = useState(orcBase?.padrao      || null);
  const [tipologia,    setTipologia]    = useState(orcBase?.tipologia   || null);
  const [tamanho,      setTamanho]      = useState(orcBase?.tamanho     || null);
  // Etapa que o usuário clicou pra editar (popover inline na trilha)
  const [etapaEditando, setEtapaEditando] = useState(null);
  // Opção que está sendo "escolhida" no momento (anima is-chosen + is-fading)
  const [opcaoEscolhida, setOpcaoEscolhida] = useState(null);
  // Índice da opção destacada via teclado (setas) — null = nenhum
  const [opcaoFocada, setOpcaoFocada] = useState(null);
  // Texto temporário do input de referência (commit no Enter/blur)
  const [referenciaTemp, setReferenciaTemp] = useState(orcBase?.referencia || "");
  // Flag: usuário está editando a referência inline (abaixo do nome do cliente)
  const [editandoRefInline, setEditandoRefInline] = useState(false);
  // Trilha horizontal: { key, top, left } da etapa com dropdown aberto (position fixed)
  const [trilhaHPop, setTrilhaHPop] = useState(null);
  // Índice da opção destacada via teclado no popover da trilha horizontal
  const [trilhaHPopFocada, setTrilhaHPopFocada] = useState(null);
  // Abre preview automaticamente quando:
  // - modoVer é true (legado)
  // - modoAbertura === "ver" ou "verProposta" (novo fluxo) E tem orçamento existente
  const temPropostaSalva = orcBase?.propostas && orcBase.propostas.length > 0;
  const abrirDiretoNoPreview = (modoVer || modoAbertura === "ver" || modoAbertura === "verProposta") && orcBase;
  const propostaReadOnlyForce = modoAbertura === "verProposta";
  const [propostaData,  setPropostaData]  = useState(abrirDiretoNoPreview ? {
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
    incluiArq: orcBase.incluiArq !== false,
    incluiEng: orcBase.incluiEng !== false,
    incluiMarcenaria: orcBase.incluiMarcenaria || false,
    grupoQtds: orcBase.grupoQtds || null,
    resumoDescritivo: orcBase.resumoDescritivo || "",
    escritorio: esc, // Escritório também no modo "ver proposta"
  } : null);
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
    { id:2, nome:"Estudo Preliminar",      pct:40 },
    { id:3, nome:"Aprovação na Prefeitura",pct:12 },
    { id:4, nome:"Projeto Executivo",      pct:38 },
  ]);
  const [qtdRep, setQtdRep] = useState(orcBase?.repeticao ? (orcBase?.nUnidades || 2) : 0);
  const [editandoRep, setEditandoRep] = useState(false);
  const [editandoAliq, setEditandoAliq] = useState(false);
  const [editandoGrupoQtd, setEditandoGrupoQtd] = useState(null); // guarda o nome do grupo que está com input aberto
  const [etapasIsoladas, setEtapasIsoladas] = useState(new Set(orcBase?.etapasIsoladas || []));
  const [incluiArq,        setIncluiArq]        = useState(orcBase?.incluiArq        !== false);
  const [incluiEng,        setIncluiEng]        = useState(orcBase?.incluiEng        !== false);
  const [incluiMarcenaria, setIncluiMarcenaria] = useState(orcBase?.incluiMarcenaria || false);

  useEffect(() => {
    if (!orcBase) return;
    // Ativa flag para evitar que useEffect de grupoParams sobrescreva durante sincronização
    sincronizandoOrcBase.current = true;
    if (orcBase.referencia  !== undefined) { setReferencia(orcBase.referencia || ""); setReferenciaTemp(orcBase.referencia || ""); }
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
    if (orcBase.etapasPct   !== undefined) setEtapasPct((orcBase.etapasPct || []).filter(e => e.id !== 5));
    if (orcBase.descArq     !== undefined) setDescArq(orcBase.descArq);
    if (orcBase.parcArq     !== undefined) setParcArq(orcBase.parcArq);
    if (orcBase.descPacote  !== undefined) setDescPacote(orcBase.descPacote);
    if (orcBase.parcPacote  !== undefined) setParcPacote(orcBase.parcPacote);
    if (orcBase.descEtCtrt  !== undefined) setDescEtCtrt(orcBase.descEtCtrt);
    if (orcBase.parcEtCtrt  !== undefined) setParcEtCtrt(orcBase.parcEtCtrt);
    if (orcBase.descPacCtrt !== undefined) setDescPacCtrt(orcBase.descPacCtrt);
    if (orcBase.parcPacCtrt !== undefined) setParcPacCtrt(orcBase.parcPacCtrt);
    if (orcBase.grupoQtds   !== undefined) setGrupoQtds(orcBase.grupoQtds || { "Por Loja":0, "Espaço Âncora":0, "Áreas Comuns":0, "Por Apartamento":0, "Galpao":0 });
    if (orcBase.etapasIsoladas !== undefined) setEtapasIsoladas(new Set(orcBase.etapasIsoladas || []));
    if (orcBase.grupoParams  !== undefined && orcBase.grupoParams) setGrupoParams(orcBase.grupoParams);
    // Desativa flag no próximo tick, após todos os estados terem sido setados
    setTimeout(() => { sincronizandoOrcBase.current = false; }, 0);
  }, [orcBase?.id]);

  const GRUPOS_COMERCIAIS = ["Por Loja","Espaço Âncora","Áreas Comuns","Por Apartamento","Galpao"];
  const [grupoParams, setGrupoParams] = useState(() => {
    const init = {};
    const p  = orcBase?.padrao    || "Médio";
    const ti = orcBase?.tipologia || "Térreo";
    const ta = orcBase?.tamanho   || "Médio";
    GRUPOS_COMERCIAIS.forEach(g => { init[g] = { padrao:p, tipologia:ti, tamanho:ta }; });
    return init;
  });
  const [abertoGrupo, setAbertoGrupo] = useState(null);

  // Ref para evitar que a sincronização do orcBase dispare o useEffect de grupoParams
  const sincronizandoOrcBase = useRef(false);
  // Ref para controlar timeout de fechamento do dropdown por hover
  const hoverCloseRef = useRef(null);

  useEffect(() => {
    if (!padrao && !tipologia && !tamanho) return;
    if (sincronizandoOrcBase.current) return; // não sobrescreve durante carregamento do orcBase
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
  const isComercial = tipoProjeto === "Conj. Comercial" || tipoProjeto === "Galpão";
  const [grupoQtds, setGrupoQtds] = useState(orcBase?.grupoQtds || {
    "Por Loja": 0, "Espaço Âncora": 0, "Áreas Comuns": 0, "Por Apartamento": 0, "Galpao": 0,
  });

  function setGrupoQtd(grupo, delta) {
    setGrupoQtds(prev => ({ ...prev, [grupo]: Math.max(0, (prev[grupo] || 0) + delta) }));
  }

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

  const [qtds, setQtds] = useState(() => {
    if (!orcBase?.comodos) return {};
    return Object.fromEntries(orcBase.comodos.map(c => [c.nome, c.qtd]));
  });
  // Cômodos que o usuário já interagiu — mesmo com qty=0, ficam em "escolhidos".
  // Ao zerar via clique no botão "0", o cômodo permanece visível (com qty=0).
  // Só sai dos escolhidos ao clicar no chip ou no ✕.
  const [comodosTocados, setComodosTocados] = useState(() => {
    if (!orcBase?.comodos) return new Set();
    return new Set(orcBase.comodos.filter(c => c.qtd > 0).map(c => c.nome));
  });

  const isEdicao = useRef(!!orcBase?.comodos?.length);
  useEffect(() => {
    if (isEdicao.current) { isEdicao.current = false; return; }
    setQtds({});
    setComodosTocados(new Set());
  }, [tipoProjeto]);

  // ── Salvar como rascunho ao voltar ─────────────────────────
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  // Após confirmar no modal, este callback é chamado (usado quando o
  // gatilho de troca veio do menu principal — app.jsx precisa trocar a aba
  // depois que o rascunho for salvo ou descartado).
  const pendingNavRef = useRef(null);
  // Regra: orçamento só vira rascunho quando o usuário começa a adicionar
  // quantidades nos cômodos. Antes disso (só tipoObra, tipoProjeto, padrão,
  // tipologia, tamanho ou referência), descarta silenciosamente sem modal.
  function temDadosPreenchidos() {
    return Object.values(qtds).some(q => q > 0);
  }
  function handleVoltar() {
    // Em modo "ver", nunca pergunta — só volta
    if (modoVer) { onVoltar(); return; }
    // Se já existe orcBase (edição), deixa voltar direto sem perguntar
    if (orcBase?.id) { onVoltar(); return; }
    // Novo orçamento: pergunta se tem algo preenchido
    if (temDadosPreenchidos()) {
      pendingNavRef.current = null; // voltar normal = usa onVoltar
      setShowSaveDialog(true);
    } else {
      onVoltar();
    }
  }
  async function salvarRascunhoEVoltar() {
    const orcRascunho = {
      ...(orcBase || {}),
      referencia,
      tipo: tipoProjeto, subtipo: tipoObra,
      padrao, tipologia, tamanho,
      comodos: Object.entries(qtds).filter(([,q]) => q > 0).map(([nome, qtd]) => ({ nome, qtd })),
      incluiArq, incluiEng,
      tipoPgto, temImposto, aliqImp,
      descArq, parcArq, descPacote, parcPacote,
      descEtCtrt, parcEtCtrt, descPacCtrt, parcPacCtrt,
      etapasPct,
      rascunho: true,
      status: "rascunho",
    };
    setShowSaveDialog(false);
    if (onSalvar) {
      try { await onSalvar(orcRascunho); } catch(e) { console.error("Erro ao salvar rascunho:", e); }
    }
    // Navegação pendente (vinda do menu) ou voltar normal
    if (pendingNavRef.current) { const nav = pendingNavRef.current; pendingNavRef.current = null; nav(); }
    else onVoltar();
  }
  function descartarEVoltar() {
    setShowSaveDialog(false);
    if (pendingNavRef.current) { const nav = pendingNavRef.current; pendingNavRef.current = null; nav(); }
    else onVoltar();
  }

  // Registra um handler global que o app.jsx consulta antes de trocar de aba.
  // Retorna true se "absorveu" a navegação (vai mostrar modal); false caso contrário.
  // O callback navegacaoPendente será executado depois que o usuário decidir.
  useEffect(() => {
    const handler = (navegacaoPendente) => {
      // Modo ver ou edição: deixa trocar direto (nada pra salvar)
      if (modoVer || orcBase?.id) return false;
      if (!temDadosPreenchidos()) return false;
      // Há dados não salvos: mostra modal e guarda a nav pra depois
      pendingNavRef.current = navegacaoPendente;
      setShowSaveDialog(true);
      return true;
    };
    // eslint-disable-next-line no-undef
    if (typeof window !== "undefined") window.__vickeOrcDirtyPrompt = handler;
    return () => {
      // eslint-disable-next-line no-undef
      if (typeof window !== "undefined" && window.__vickeOrcDirtyPrompt === handler) {
        window.__vickeOrcDirtyPrompt = null;
      }
    };
  }, [modoVer, orcBase?.id, qtds]); // eslint-disable-line react-hooks/exhaustive-deps

  const wrapRef = useRef(null);

  // Detecta mobile (<768px). Em mobile, a UX dos cômodos muda:
  // - Sem hover (não tem mouse), o seletor de quantidade fica sempre visível
  //   apenas pro PRIMEIRO cômodo disponível (resto espera a vez).
  // - Botões limitados a 0-4 (em vez de 0-6).
  // - Layout enquadrado, sem scroll horizontal e sem overflow vertical separado.
  const [isMobileOrc, setIsMobileOrc] = useState(() => {
    try { return window.innerWidth < 768; } catch { return false; }
  });
  useEffect(() => {
    function onResize() { try { setIsMobileOrc(window.innerWidth < 768); } catch {} }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!etapaEditando && !abertoGrupo) return;
    const h = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setEtapaEditando(null);
        setAbertoGrupo(null);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [etapaEditando, abertoGrupo]);

  // Trilha horizontal: fecha popover ao clicar fora
  useEffect(() => {
    if (!trilhaHPop) return;
    const h = e => {
      if (e.target.closest(".vk-trilha-h-pop") || e.target.closest(`.vk-trilha-h-node[data-tk="${trilhaHPop.key}"]`)) return;
      setTrilhaHPop(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [trilhaHPop]);

  // Trilha horizontal: reposiciona popover ao scroll/resize (position fixed gruda no botão)
  useEffect(() => {
    if (!trilhaHPop) return;
    const reposicionar = () => {
      const btn = document.querySelector(`.vk-trilha-h-node[data-tk="${trilhaHPop.key}"]`);
      if (btn) {
        const r = btn.getBoundingClientRect();
        setTrilhaHPop(prev => prev ? { ...prev, top: r.bottom + 6, left: r.left } : null);
      }
    };
    document.addEventListener("scroll", reposicionar, true);
    window.addEventListener("resize", reposicionar);
    return () => {
      document.removeEventListener("scroll", reposicionar, true);
      window.removeEventListener("resize", reposicionar);
    };
  }, [trilhaHPop?.key]);

  const OPCOES = {
    tipoObra:    ["Construção nova", "Reforma"],
    tipoProjeto: ["Residencial", "Clínica", "Conj. Comercial", "Galpão", "Empreendimento"],
    padrao:      ["Alto", "Médio", "Baixo"],
    tipologia:   ["Térreo", "Sobrado"],
    tamanho:     ["Grande", "Médio", "Pequeno", "Compacta"],
  };

  // ── Navegação por teclado no popover da trilha horizontal (Tipo Obra/Padrão/etc) ──
  useEffect(() => {
    if (!trilhaHPop) {
      setTrilhaHPopFocada(null);
      return;
    }
    const opcoes = OPCOES[trilhaHPop.key] || [];
    if (!opcoes.length) return;

    // Foca a opção atualmente selecionada (ou primeira) ao abrir
    const valAtual = trilhaHPop.key === "referencia" ? referencia : ({ tipoObra, tipoProjeto, padrao, tipologia, tamanho }[trilhaHPop.key]);
    const idxAtual = opcoes.indexOf(valAtual);
    setTrilhaHPopFocada(idxAtual >= 0 ? idxAtual : 0);

    const handler = (e) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setTrilhaHPopFocada(prev => prev === null ? 0 : (prev + 1) % opcoes.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setTrilhaHPopFocada(prev => prev === null ? opcoes.length - 1 : (prev - 1 + opcoes.length) % opcoes.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        setTrilhaHPopFocada(idx => {
          if (idx === null) return null;
          const op = opcoes[idx];
          if (op) {
            const SETS_TR = { tipoObra:setTipoObra, tipoProjeto:setTipoProjeto, padrao:setPadrao, tipologia:setTipologia, tamanho:setTamanho };
            if (SETS_TR[trilhaHPop.key]) SETS_TR[trilhaHPop.key](op);
            setTrilhaHPop(null);
          }
          return null;
        });
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setTrilhaHPop(null);
        setTrilhaHPopFocada(null);
      }
    };
    // capture: true pra rodar antes do handler dos cômodos (que está em window)
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [trilhaHPop, referencia, tipoObra, tipoProjeto, padrao, tipologia, tamanho]);

  // Mapa de display: valor interno → label exibido APENAS após seleção (no fluxo horizontal).
  // Na lista de opções do dropdown, o valor interno é mantido ("Alto", "Médio", "Baixo").
  // Preserva compatibilidade com orçamentos salvos no DB que usam valores internos.
  const DISPLAY_OPCAO = {
    padrao: { "Alto":"Alto Padrão", "Médio":"Médio Padrão", "Baixo":"Baixo Padrão" },
  };
  const displayOpcao = (key, val) => (DISPLAY_OPCAO[key] && DISPLAY_OPCAO[key][val]) || val;

  const VALS   = { tipoObra, tipoProjeto, padrao, tipologia, tamanho };
  const LABELS = { tipoObra:"Tipo Obra", tipoProjeto:"Tipo Projeto", padrao:"Padrão", tipologia:"Tipologia", tamanho:"Tamanho" };
  const SETS   = { tipoObra:setTipoObra, tipoProjeto:setTipoProjeto, padrao:setPadrao, tipologia:setTipologia, tamanho:setTamanho };

  function selecionar(key, val) { SETS[key](val); setEtapaEditando(null); }

  // Confirma a referência (Enter ou blur). Anima is-chosen no input antes de aplicar.
  function confirmarReferencia() {
    const val = referenciaTemp.trim();
    if (!val) return; // referência é obrigatória
    if (val === referencia) {
      // Já estava com esse valor — só fecha edição se aberta
      setEtapaEditando(null);
      return;
    }
    // Anima usando o flag opcaoEscolhida (mesmo que pra opções)
    setOpcaoEscolhida(val);
    setTimeout(() => {
      setReferencia(val);
      setEtapaEditando(null);
      setOpcaoEscolhida(null);
    }, 450);
  }

  // ── Navegação por teclado nas perguntas (setas + Enter) ──
  // Computa qual etapa está ativa (mesma lógica do IIFE de render).
  // Não escuta na etapa "referencia" (input de texto cuida do Enter próprio).
  useEffect(() => {
    const ordem = ["referencia", "tipoObra", "tipoProjeto"];
    if (!isComercial) ordem.push("padrao", "tipologia", "tamanho");

    const VALS_EXT = { referencia, tipoObra, tipoProjeto, padrao, tipologia, tamanho };
    const proximaPendente = ordem.find(k => !VALS_EXT[k]);
    const etapaAtual = etapaEditando || proximaPendente;

    // Sem etapa ativa, etapa de referência (input texto), ou animando: ignora
    if (!etapaAtual || etapaAtual === "referencia" || opcaoEscolhida) return;

    const opcoes = OPCOES[etapaAtual] || [];
    if (!opcoes.length) return;

    const handler = (e) => {
      // Não captura se foco está em input/textarea/etc
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpcaoFocada(prev => {
          if (prev === null) return 0;
          return (prev + 1) % opcoes.length;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setOpcaoFocada(prev => {
          if (prev === null) return opcoes.length - 1;
          return (prev - 1 + opcoes.length) % opcoes.length;
        });
      } else if (e.key === "Enter") {
        if (opcaoFocadaRef.current === null) return;
        e.preventDefault();
        const op = opcoes[opcaoFocadaRef.current];
        if (!op) return;
        setOpcaoEscolhida(op);
        setTimeout(() => {
          SETS[etapaAtual](op);
          setEtapaEditando(null);
          setOpcaoEscolhida(null);
          setOpcaoFocada(null);
        }, 450);
      } else if (e.key === "Escape") {
        setOpcaoFocada(null);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [referencia, tipoObra, tipoProjeto, padrao, tipologia, tamanho, etapaEditando, isComercial, opcaoEscolhida]);

  // Reset opcaoFocada quando muda de etapa
  const opcaoFocadaRef = useRef(null);
  useEffect(() => { opcaoFocadaRef.current = opcaoFocada; }, [opcaoFocada]);
  useEffect(() => {
    setOpcaoFocada(null);
  }, [tipoObra, tipoProjeto, padrao, tipologia, tamanho, etapaEditando]);

  const grupoDeComodo = useMemo(() => {
    const map = {};
    if (configAtual?.grupos) {
      Object.entries(configAtual.grupos).forEach(([grupo, nomes]) => {
        nomes.forEach(nome => { map[nome] = grupo; });
      });
    }
    return map;
  }, [configAtual]);

  const calculo = useMemo(() => {
    if (!configAtual) return null;
    if (!isComercial && (!tamanho || !padrao)) return null;
    const { comodos: COMODOS_USE } = configAtual;
    const tcfg = getTipoConfig(tipoParaConfig(tipoProjeto));
    const pb = tcfg.precoBase;

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
          const pct2 = acum<1000?0.25:acum<2000?0.20:0.15;
          total += precoUni*pct2;
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
        nGalpoes >0&&atGalpao1>0 ? {label:"Galpão",       n:nGalpoes, area1:atGalpao1, precoUni:p1Galpao, precoTot:pGalpoes} : null,
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

    const nRep   = qtdRep > 1 ? qtdRep : 1;
    const pctRep = 0.25;
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
      areaTotal, areaTot,
      precoArq1, precoArq,
      precoEng1, precoEng,
      precoM2Arq: areaTot > 0 ? Math.round(precoArq / areaTot * 100) / 100 : 0,
      precoM2Eng: areaTot > 0 ? Math.round(precoEng / areaTot * 100) / 100 : 0,
      nRep, pctRep, unidades,
      indiceComodos, indicePadrao, fatorMult,
      precoBaseVal, precoM2Ef,
      faixasArqDet, faixasEng: engCalc.faixas,
      totalAmbientes,
      acrescimoCirk: tcfg.acrescimoCirk,
      labelCirk: tcfg.labelCirk || String(Math.round(tcfg.acrescimoCirk*100)),
    };
  }, [qtds, tamanho, padrao, tipoProjeto, configAtual, qtdRep, grupoQtds, isComercial, grupoParams, grupoDeComodo]);

  const temComodos = isComercial
    ? Object.entries(grupoQtds).some(([g, gq]) => gq > 0 && Object.keys(qtds).some(nome => grupoDeComodo[nome] === g && (qtds[nome]||0) > 0))
    : Object.values(qtds).some(q => q > 0);

  useEffect(() => {
    if (document.getElementById("slide-up-style")) return;
    const s = document.createElement("style");
    s.id = "slide-up-style";
    s.textContent = `
      @keyframes slideUp { from { opacity:0; transform:translateY(32px); } to { opacity:1; transform:translateY(0); } }
      input.no-spin::-webkit-outer-spin-button,
      input.no-spin::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      input.no-spin { -moz-appearance: textfield; }
      .comodo-escolhido:hover { color: #dc2626 !important; text-decoration: line-through; text-decoration-color: #dc2626; }
      .comodo-escolhido:hover .comodo-m2 { color: #dc2626 !important; }
      .comodo-escolhido:hover strong { color: #dc2626 !important; }

      /* ===== Fluxo vk-flow2 — perguntas sequenciais ===== */
      @keyframes flow2NodeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes flow2CardIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes flow2OptIn  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes flow2OptChosen { 0% { transform: scale(1); } 35% { transform: scale(1.02); } 100% { transform: scale(1); } }
      @keyframes flow2DotPulse {
        0%, 100% { box-shadow: 0 0 0 4px #fff, 0 0 0 6px #111; }
        50%      { box-shadow: 0 0 0 4px #fff, 0 0 0 10px rgba(0,0,0,0); }
      }
      @keyframes nodeEditIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

      /* ===== TRILHA VERTICAL LATERAL DIREITA ===== */
      .vk-flow-shell { display: grid; grid-template-columns: 540px 240px; gap: 32px; max-width: 880px; }
      .vk-flow-stage { padding: 8px 24px 24px 0; }
      /* Mobile: shell vira 1 coluna. Pergunta ocupa largura toda; trilha
         lateral some (a horizontal acima do título já dá o contexto de
         progresso pro usuário). */
      @media (max-width: 767px) {
        .vk-flow-shell { grid-template-columns: 1fr; gap: 12px; max-width: 100%; }
        .vk-flow-stage { padding: 4px 0 12px 0; }
        .vk-trilha-rail { display: none; }
      }
      .vk-trilha-rail { background: transparent; border-left: 0; padding: 24px 28px 32px 8px; position: relative; align-self: stretch; }
      .vk-trilha-rail-title { font-size: 9.5px; letter-spacing: 0.18em; text-transform: uppercase; color: #828a98; font-weight: 600; margin-bottom: 20px; }

      /* Trilha horizontal compacta (modo concluído) — sem fundo, sutil */
      .vk-trilha-h { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; padding: 6px 0; margin-bottom: 18px; animation: flow2CardIn .4s cubic-bezier(0.32, 0.72, 0, 1); }
      .vk-trilha-h-node { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 999px; cursor: pointer; transition: background .12s, border-color .12s; position: relative; border: 1px solid #e5e7eb; background: #fafaf7; font-family: inherit; }
      .vk-trilha-h-node:hover { background: #fafaf7; border-color: #e5e7eb; }
      .vk-trilha-h-node.is-open { background: #fafaf7; border-color: #c8cdd6; }
      .vk-trilha-h-dot { width: 6px; height: 6px; border-radius: 50%; background: #111; flex-shrink: 0; }
      .vk-trilha-h-key { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #828a98; font-weight: 600; }
      .vk-trilha-h-val { font-size: 13px; font-weight: 600; color: #111; letter-spacing: -0.005em; }
      .vk-trilha-h-caret { font-size: 8px; color: #828a98; margin-left: 1px; }
      .vk-trilha-h-sep { width: 10px; height: 1px; background: rgba(0,0,0,0.12); }

      /* Dropdown com position fixed (grudado no botão, não desencaixa no scroll) */
      .vk-trilha-h-pop { position: fixed; z-index: 9999; min-width: 200px; background: #fff; border: 1px solid rgba(0,0,0,0.12); border-radius: 8px; overflow: hidden; box-shadow: 0 12px 28px -8px rgba(0,0,0,0.18); animation: nodeEditIn .18s cubic-bezier(0.32, 0.72, 0, 1); }
      .vk-trilha-h-pop-row { display: flex; align-items: center; gap: 9px; width: 100%; padding: 8px 12px; background: transparent; border: 0; border-bottom: 1px solid rgba(0,0,0,0.04); cursor: pointer; text-align: left; font-family: inherit; font-size: 12.5px; color: #111; transition: background .12s ease; }
      .vk-trilha-h-pop-row:last-child { border-bottom: 0; }
      .vk-trilha-h-pop-row:hover { background: #fafaf7; }
      .vk-trilha-h-pop-row.is-focused-kb { background: #fafaf7; }
      .vk-trilha-h-pop-row.is-selected { background: #111; color: #fff; }
      .vk-trilha-h-pop-row.is-selected:hover,
      .vk-trilha-h-pop-row.is-selected.is-focused-kb { background: #111; }
      .vk-trilha-h-pop-bullet { width: 5px; height: 5px; border-radius: 50%; background: rgba(0,0,0,0.20); flex: 0 0 auto; }
      .vk-trilha-h-pop-row.is-selected .vk-trilha-h-pop-bullet { background: #fff; }
      .vk-trilha-list { position: relative; display: flex; flex-direction: column; gap: 22px; }
      .vk-trilha-line { position: absolute; left: 9px; top: 10px; bottom: 10px; width: 1.5px; background: linear-gradient(to bottom, #c8cdd6 0%, #c8cdd6 60%, #e5e7eb 100%); z-index: 0; }

      /* Cada nó */
      .vk-trilha-node { display: grid; grid-template-columns: 22px 1fr; gap: 14px; align-items: flex-start; position: relative; cursor: default; animation: flow2NodeIn .35s cubic-bezier(0.32, 0.72, 0, 1) both; }
      .vk-trilha-node.is-done { cursor: pointer; }
      .vk-trilha-node.is-done:hover .vk-trilha-val { color: #4b5563; }

      /* Bolinha — preenchida pretas (done), anel duplo (active), vazada (future) */
      .vk-trilha-dot { width: 10px; height: 10px; border-radius: 50%; background: #111; margin-top: 4px; margin-left: 5px; position: relative; z-index: 1; box-shadow: 0 0 0 4px #fff; flex-shrink: 0; transition: all .25s ease; }
      .vk-trilha-dot-active { width: 14px; height: 14px; margin-top: 2px; margin-left: 3px; box-shadow: 0 0 0 4px #fff, 0 0 0 6px #111; animation: flow2DotPulse 2.4s infinite ease-in-out; }
      .vk-trilha-dot-future { width: 9px; height: 9px; margin-top: 5px; margin-left: 6px; background: transparent; border: 1.5px solid #c8cdd6; box-shadow: 0 0 0 3px #fff; }

      /* Texto */
      .vk-trilha-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
      .vk-trilha-key { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: #828a98; font-weight: 600; line-height: 1.2; }
      .vk-trilha-val { font-size: 13px; font-weight: 600; color: #111; letter-spacing: -0.005em; line-height: 1.3; word-break: break-word; }
      .vk-trilha-val-pending { color: #828a98; font-weight: 400; font-style: italic; font-size: 12.5px; }
      .vk-trilha-caret { font-size: 8px; color: #828a98; margin-left: 4px; }
      .vk-trilha-node-future .vk-trilha-key { color: rgba(0,0,0,0.30); }

      /* Popover de edição inline (no rail) */
      .vk-trilha-edit { position: absolute; top: 0; right: calc(100% + 8px); z-index: 100; min-width: 240px; background: #fff; border: 1px solid rgba(0,0,0,0.10); border-radius: 8px; overflow: hidden; box-shadow: 0 12px 28px -8px rgba(0,0,0,0.18); animation: nodeEditIn .25s cubic-bezier(0.32, 0.72, 0, 1); }
      .vk-trilha-edit-head { padding: 7px 11px; background: #fafaf7; border-bottom: 1px solid rgba(0,0,0,0.06); font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; color: #828a98; font-weight: 600; }
      .vk-trilha-edit-row { display: flex; align-items: center; gap: 9px; width: 100%; padding: 9px 12px; background: transparent; border: 0; border-bottom: 1px solid rgba(0,0,0,0.04); cursor: pointer; text-align: left; font-family: inherit; font-size: 12.5px; color: #111; transition: background .12s ease; }
      .vk-trilha-edit-row:last-child { border-bottom: 0; }
      .vk-trilha-edit-row:hover { background: #fafaf7; }
      .vk-trilha-edit-row.is-selected { background: #111; color: #fff; }
      .vk-trilha-edit-row.is-selected:hover { background: #111; }
      .vk-trilha-edit-bullet { width: 5px; height: 5px; border-radius: 50%; background: rgba(0,0,0,0.20); flex: 0 0 auto; }
      .vk-trilha-edit-row.is-selected .vk-trilha-edit-bullet { background: #fff; }
      .vk-trilha-edit-input { width: 100%; padding: 9px 12px; border: 0; border-bottom: 1px solid rgba(0,0,0,0.06); background: transparent; font-family: inherit; font-size: 13px; color: #111; outline: none; }
      .vk-trilha-edit-input:focus { background: #fafaf7; }
      .vk-trilha-edit-actions { display: flex; justify-content: flex-end; padding: 8px 11px; gap: 6px; background: #fafaf7; }
      .vk-trilha-edit-btn { font-size: 11px; padding: 5px 10px; border-radius: 4px; border: 1px solid #d0d4db; background: #fff; cursor: pointer; font-family: inherit; font-weight: 500; color: #6b7280; }
      .vk-trilha-edit-btn-primary { background: #111; color: #fff; border-color: #111; }

      /* Card central da pergunta atual */
      .vk-flow2-card { width: 100%; max-width: 540px; animation: flow2CardIn .4s cubic-bezier(0.32, 0.72, 0, 1); }
      .vk-flow2-progress { margin-bottom: 14px; font-size: 10px; letter-spacing: 0.16em; color: #828a98; font-weight: 500; font-variant-numeric: tabular-nums; text-transform: uppercase; }
      .vk-flow2-title { font-family: inherit; font-size: 26px; font-weight: 500; letter-spacing: -0.022em; line-height: 1.2; margin: 0; color: #111; }
      .vk-flow2-hint { font-size: 13.5px; color: #6b7280; line-height: 1.55; margin-top: 8px; max-width: 460px; }

      /* Input texto pra "Referência" (primeira pergunta) */
      .vk-flow2-input-wrap { margin-top: 24px; animation: flow2OptIn .35s cubic-bezier(0.32, 0.72, 0, 1) both; }
      .vk-flow2-input { width: 100%; max-width: 460px; padding: 14px 18px; border: 1px solid rgba(0,0,0,0.12); border-radius: 10px; background: #fff; font-family: inherit; font-size: 15px; color: #111; outline: none; transition: border-color .15s, box-shadow .15s, background .25s, color .25s; box-shadow: 0 1px 0 rgba(0,0,0,0.02); }
      .vk-flow2-input:focus { border-color: #111; box-shadow: 0 0 0 3px rgba(0,0,0,0.04); }
      .vk-flow2-input.is-chosen { background: #111; color: #fff; border-color: #111; animation: flow2OptChosen .55s cubic-bezier(0.32, 0.72, 0, 1) forwards; }
      .vk-flow2-input::placeholder { color: #828a98; }
      .vk-flow2-input-hint { font-size: 11.5px; color: #828a98; margin-top: 8px; letter-spacing: 0.02em; }

      /* Tabela de opções */
      .vk-flow2-table { margin-top: 20px; border: 1px solid rgba(0,0,0,0.10); border-radius: 10px; overflow: hidden; background: #fff; box-shadow: 0 1px 0 rgba(0,0,0,0.02), 0 12px 28px -16px rgba(0,0,0,0.10); }
      .vk-flow2-table-head { display: flex; align-items: center; justify-content: space-between; padding: 9px 16px; background: #fafaf7; border-bottom: 1px solid rgba(0,0,0,0.06); font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: #828a98; font-weight: 500; }
      .vk-flow2-row { display: grid; grid-template-columns: 32px 1fr 22px; align-items: center; gap: 14px; padding: 13px 16px; background: transparent; border: 0; border-bottom: 1px solid rgba(0,0,0,0.05); cursor: pointer; text-align: left; font-family: inherit; font-size: 14px; color: #111; transition: background .15s ease; animation: flow2OptIn .35s cubic-bezier(0.32, 0.72, 0, 1) both; width: 100%; }
      .vk-flow2-row:last-child { border-bottom: 0; }
      .vk-flow2-row:hover:not(:disabled) { background: #fafaf7; }
      .vk-flow2-row.is-focused:not(:disabled) { background: #fafaf7; }
      .vk-flow2-row:hover:not(:disabled) .vk-flow2-row-arrow,
      .vk-flow2-row.is-focused:not(:disabled) .vk-flow2-row-arrow { opacity: 1; transform: translateX(0); color: #111; }
      .vk-flow2-row:hover:not(:disabled) .vk-flow2-row-idx,
      .vk-flow2-row.is-focused:not(:disabled) .vk-flow2-row-idx { color: #111; }
      .vk-flow2-row-idx { font-size: 10.5px; letter-spacing: 0.06em; color: #828a98; font-family: ui-monospace, "JetBrains Mono", monospace; font-weight: 500; transition: color .15s; }
      .vk-flow2-row-text { font-weight: 500; letter-spacing: -0.005em; }
      .vk-flow2-row-arrow { color: #828a98; opacity: 0; transform: translateX(-4px); transition: opacity .15s, transform .15s; display: inline-flex; justify-content: flex-end; }
      .vk-flow2-row.is-chosen { background: #111; color: #fff; animation: flow2OptChosen .55s cubic-bezier(0.32, 0.72, 0, 1) forwards; }
      .vk-flow2-row.is-chosen .vk-flow2-row-idx { color: rgba(255,255,255,0.5); }
      .vk-flow2-row.is-chosen .vk-flow2-row-arrow { color: #fff; opacity: 1; transform: translateX(0); }
      .vk-flow2-row.is-fading { opacity: 0; height: 0; padding-top: 0; padding-bottom: 0; border-bottom-width: 0; overflow: hidden; transition: all .35s cubic-bezier(0.32, 0.72, 0, 1); }

      /* ===== Mobile: ajustes globais do formulário de orçamento ===== */
      @media (max-width: 767px) {
        /* Bloqueia scroll horizontal em qualquer nível —
           se algum elemento estourar a largura, fica oculto em vez de criar scroll lateral */
        html, body { overflow-x: hidden !important; max-width: 100vw !important; }
        /* Reduz padding lateral pro conteúdo respirar mais */
        .vk-orc-wrap { padding: 12px 14px !important; max-width: 100vw !important; overflow-x: hidden !important; }
        /* Título da pergunta menor pra caber em tela pequena */
        .vk-flow2-title { font-size: 22px !important; line-height: 1.25 !important; }
        .vk-flow2-card { max-width: 100% !important; }
        .vk-flow2-input { max-width: 100% !important; padding: 12px 14px !important; }
        .vk-flow2-hint { max-width: 100% !important; }
        .vk-flow2-table { margin-top: 14px !important; }
        .vk-flow2-row { padding: 14px !important; gap: 10px !important; }
        /* Trilha horizontal: chips menores e quebram linha mais cedo */
        .vk-trilha-h { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 6px !important; padding: 4px 0 !important; margin-bottom: 12px !important; }
        .vk-trilha-h-node { padding: 6px 10px !important; width: 100% !important; box-sizing: border-box !important; justify-content: flex-start !important; min-width: 0 !important; }
        .vk-trilha-h-val { font-size: 12px !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; min-width: 0 !important; }
        .vk-trilha-h-key { font-size: 9px !important; }
        /* Separador horizontal some em mobile (o grid já dá a separação visual) */
        .vk-trilha-h-sep { display: none !important; }
        /* Cômodos + Resumo: vira 1 coluna empilhada.
           Resumo perde sticky (não funciona bem em coluna única em mobile). */
        .vk-orc-comodos-shell { grid-template-columns: 1fr !important; gap: 14px !important; max-width: 100% !important; }
        .vk-orc-resumo-col { position: static !important; top: auto !important; }
        /* Card de cômodos: remove altura fixa e overflow interno em mobile.
           A página inteira rola normal — sem scroll vertical separado pro card. */
        .vk-orc-comodos-card { max-height: none !important; overflow-y: visible !important; padding: 6px 8px !important; }
      }
    `;
    document.head.appendChild(s);
  }, []);

  const C = {
    wrap:       { fontFamily:"inherit", color:"#111", background:"#fff", padding:"24px 28px", position:"relative", margin:0 },
    fieldBox:   { background:"#f5f5f5", border:"1px solid #333", borderRadius:10, padding:"12px 16px", fontSize:14, color:"#6b7280" },
    fieldLabel: { fontSize:10, color:"#828a98", textTransform:"uppercase", letterSpacing:1, marginBottom:6, display:"block" },
    input:      { width:"100%", border:"1px solid #333", borderRadius:10, padding:"12px 16px", fontSize:14, color:"#111", outline:"none", background:"#fff", boxSizing:"border-box", fontFamily:"inherit" },
    btnDefinir: { width:"100%", maxWidth:380, background:"#111", border:"1px solid #111", borderRadius:10, padding:"13px 0", fontSize:14, fontWeight:700, color:"#fff", cursor:"pointer", fontFamily:"inherit", textAlign:"center", display:"block", margin:"0 auto" },
    aviso:      { fontSize:12, color:"#ef4444", textAlign:"center", marginTop:8 },
    comodoGrupoHdr: { fontSize:10, color:"#555e6b", textTransform:"uppercase", letterSpacing:1, marginBottom:8, marginTop:20, background:"#f0f1f4", border:"1px solid #b8bec8", borderRadius:6, padding:"6px 10px", display:"inline-block" },
    comodoRow:  (ativo) => ({ display:"flex", alignItems:"center", gap:4, padding:"3px 0", borderBottom:"1px solid #c8cdd6", opacity: ativo ? 1 : 0.55 }),
    comodoNome: { flex:1, fontSize:14, color:"#374151" },
    comodoM2:   { fontSize:12, color:"#828a98", width:70, textAlign:"right", whiteSpace:"nowrap" },
    qtdWrap:    { display:"flex", alignItems:"center", gap:8 },
    qtdBtn:     { width:26, height:26, borderRadius:6, border:"1px solid #888", background:"#fff", color:"#374151", fontSize:16, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 },
    qtdNum:     (q) => ({ width:24, textAlign:"center", fontSize:14, fontWeight: q > 0 ? 700 : 400, color: q > 0 ? "#111" : "#828a98" }),
    qtdM2Tot:   { fontSize:12, color:"#6b7280", width:72, textAlign:"right", whiteSpace:"nowrap" },
    resumoBox:  { background:"#fff", border:"1px solid #c8cdd6", borderRadius:10, padding:"16px 18px" },
    resumoHdr:  { fontSize:11, color:"#555e6b", textTransform:"uppercase", letterSpacing:1.2, textAlign:"center", marginBottom:12, paddingBottom:10, borderBottom:"1px solid #e5e7eb" },
    resumoSec:  { fontSize:11, color:"#6b7280", textTransform:"uppercase", letterSpacing:1, marginBottom:6, marginTop:14 },
    resumoVal:  { fontSize:19, fontWeight:700, color:"#111" },
    resumoM2:   { fontSize:13, color:"#828a98", marginTop:2 },
    resumoLinha:{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginTop:4 },
    resumoArea: { background:"#f0f1f4", border:"1px solid #c0c5cf", borderRadius:8, padding:"10px 14px", marginBottom:10, fontSize:13, color:"#374151" },
  };


  const GRUPO_DISPLAY = {
    "Por Loja":        "Loja",
    "Espaço Âncora":   "Espaço Âncora",
    "Áreas Comuns":    "Área Comum",
    "Por Apartamento": "Apartamento",
    "Galpao":          "Galpão",
  };

  const [gruposAbertos, setGruposAbertos] = useState({});
  // Cômodo com popup visível (via hover OU via click no input)
  const [comodoAberto, setComodoAberto] = useState(null);
  // Navegação por teclado: índice da quantidade (0-6) destacada visualmente.
  // Não confirma sozinho — só Enter confirma. Tab também navega mas não confirma.
  const [comodoQtdFocada, setComodoQtdFocada] = useState(null);
  // Ref atualizada a cada render: lista plana de cômodos disponíveis em ordem (todos os grupos)
  const comodosFlatRef = useRef([]);
  // Quando true, o popup está "travado" pelo clique no input:
  // - mouseLeave não fecha
  // - hover em outros cômodos é ignorado
  const [travado, setTravado] = useState(false);
  const comodoCloseRef = useRef(null);
  // Rastreia última posição do mouse para reabrir popup após a lista reorganizar
  const mousePosRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const tracker = (e) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; };
    document.addEventListener("mousemove", tracker, { passive: true });
    return () => document.removeEventListener("mousemove", tracker);
  }, []);

  // Hover: passou em cima
  function abrirComodo(nome) {
    if (travado) return; // travado → ignora hover
    if (comodoCloseRef.current) { clearTimeout(comodoCloseRef.current); comodoCloseRef.current = null; }
    setComodoAberto(nome);
  }
  // Hover: saiu
  function agendarFecharComodo() {
    if (travado) return; // travado → não fecha
    if (comodoCloseRef.current) clearTimeout(comodoCloseRef.current);
    comodoCloseRef.current = setTimeout(() => setComodoAberto(null), 80);
  }

  // Após qtds mudar (cômodo selecionado → lista reorganiza), o browser não dispara
  // mouseenter/leave porque o cursor não se moveu. Detecta qual cômodo está sob o
  // cursor via elementFromPoint e abre ele. Usa requestAnimationFrame pra rodar
  // após o React commitar o DOM reorganizado.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (travado) return;
      const { x, y } = mousePosRef.current;
      if (x === 0 && y === 0) return;
      const el = document.elementFromPoint(x, y);
      if (!el) return;
      const wrap = el.closest && el.closest("[data-comodo-wrap]");
      const nome = wrap ? wrap.getAttribute("data-comodo-nome") : null;
      if (nome) {
        if (comodoCloseRef.current) { clearTimeout(comodoCloseRef.current); comodoCloseRef.current = null; }
        setComodoAberto(nome);
      } else {
        setComodoAberto(null);
      }
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qtds]);

  // Listener global: mousedown em qualquer lugar enquanto travado
  useEffect(() => {
    if (!travado) return;
    const handler = (e) => {
      // Clique dentro do próprio cômodo travado (input, números, ✕) → deixa o onClick deles decidir
      const wrap = e.target.closest && e.target.closest("[data-comodo-wrap]");
      const nomeClicado = wrap ? wrap.getAttribute("data-comodo-nome") : null;
      if (nomeClicado && nomeClicado === comodoAberto) return;

      // Clicou fora do cômodo travado → aplica valor digitado (se houver) e destrava
      const inputAtivo = document.activeElement;
      if (inputAtivo && inputAtivo.tagName === "INPUT" && comodoAberto) {
        const v = parseInt(inputAtivo.value) || 0;
        const qAtual = qtds[comodoAberto] || 0;
        if (v > 0 && v !== qAtual) setQtdAbs(comodoAberto, v);
      }

      setTravado(false);
      if (nomeClicado) {
        // Se caiu em outro cômodo, abre ele imediatamente
        setComodoAberto(nomeClicado);
      } else {
        setComodoAberto(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [travado, comodoAberto, qtds]);

  function toggleGrupo(grupo) {
    setGruposAbertos(prev => ({ ...prev, [grupo]: prev[grupo] === false ? true : false }));
  }
  // Em mobile, todos os grupos ficam sempre abertos — UX sequencial guiada
  // funciona melhor com tudo visível pro usuário ver o que vem depois.
  function isGrupoAberto(grupo) {
    if (isMobileOrc) return true;
    return gruposAbertos[grupo] !== false;
  }

  function setQtd(nome, delta) {
    setQtds(prev => ({ ...prev, [nome]: Math.max(0, (prev[nome] || 0) + delta) }));
  }

  // Define quantidade absoluta (não delta) — usado no hover com atalhos 1-6 e input livre
  function setQtdAbs(nome, val) {
    const v = Math.max(0, parseInt(val) || 0);
    setQtds(prev => {
      const next = { ...prev };
      if (v === 0) delete next[nome]; else next[nome] = v;
      return next;
    });
    // Marca como "tocado": permanece em escolhidos mesmo com qty=0
    setComodosTocados(prev => {
      const next = new Set(prev);
      next.add(nome);
      return next;
    });
  }

  // Remove totalmente: zera qty E tira de comodosTocados (volta pra disponíveis)
  function removerComodo(nome) {
    setQtds(prev => {
      const next = { ...prev };
      delete next[nome];
      return next;
    });
    setComodosTocados(prev => {
      const next = new Set(prev);
      next.delete(nome);
      return next;
    });
  }

  // ── Navegação por teclado nos cômodos (setas + Tab + Enter) ──
  // Refs pra ler valores mais recentes nos handlers
  const comodoAbertoRef = useRef(null);
  const comodoQtdFocadaRef = useRef(null);
  const trilhaHPopRef = useRef(null);
  useEffect(() => { comodoAbertoRef.current = comodoAberto; }, [comodoAberto]);
  useEffect(() => { comodoQtdFocadaRef.current = comodoQtdFocada; }, [comodoQtdFocada]);
  useEffect(() => { trilhaHPopRef.current = trilhaHPop; }, [trilhaHPop]);

  // Computa se está na fase de cômodos (perguntas concluídas)
  // Memoizado pra não recriar handler a cada render
  useEffect(() => {
    const ordem = ["referencia", "tipoObra", "tipoProjeto"];
    if (!isComercial) ordem.push("padrao", "tipologia", "tamanho");
    const VALS_EXT = { referencia, tipoObra, tipoProjeto, padrao, tipologia, tamanho };
    const proximaPendente = ordem.find(k => !VALS_EXT[k]);
    const concluido = !proximaPendente && !etapaEditando;
    if (!concluido || !configAtual) return;

    // Sequência de navegação: 0,1,2,3,4,5,6,"input"
    const SEQ = [0, 1, 2, 3, 4, 5, 6, "input"];

    // Helper: scrollar pra que o cômodo fique visível
    const scrollComodoEmFoco = (nome) => {
      setTimeout(() => {
        const el = document.querySelector(`[data-comodo-nome="${nome}"]`);
        if (el && typeof el.scrollIntoView === "function") {
          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }, 0);
    };

    const handler = (e) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      // Não roda se popover da trilha horizontal está aberto (ele tem prioridade)
      if (trilhaHPopRef.current) return;

      const flat = comodosFlatRef.current;
      if (!flat || flat.length === 0) return;

      const aberto = comodoAbertoRef.current;
      const qtdIdx = comodoQtdFocadaRef.current;
      const idxAberto = aberto ? flat.indexOf(aberto) : -1;

      // ── ↓ ──
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (idxAberto === -1) {
          setComodoAberto(flat[0]);
          setComodoQtdFocada(1);
          scrollComodoEmFoco(flat[0]);
        } else {
          const proximo = flat[Math.min(idxAberto + 1, flat.length - 1)];
          setComodoAberto(proximo);
          setComodoQtdFocada(1);
          scrollComodoEmFoco(proximo);
        }
        return;
      }

      // ── ↑ ──
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (idxAberto === -1) {
          setComodoAberto(flat[0]);
          setComodoQtdFocada(1);
          scrollComodoEmFoco(flat[0]);
        } else {
          const anterior = flat[Math.max(idxAberto - 1, 0)];
          setComodoAberto(anterior);
          setComodoQtdFocada(1);
          scrollComodoEmFoco(anterior);
        }
        return;
      }

      // Demais: precisam de cômodo aberto
      if (!aberto) return;

      // ── ← / → ── (entre 0,1,2,3,4,5,6,"input" — wrap)
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setComodoQtdFocada(prev => {
          if (prev === null) return SEQ[SEQ.length - 1];
          const i = SEQ.indexOf(prev);
          return SEQ[(i - 1 + SEQ.length) % SEQ.length];
        });
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setComodoQtdFocada(prev => {
          if (prev === null) return SEQ[0];
          const i = SEQ.indexOf(prev);
          return SEQ[(i + 1) % SEQ.length];
        });
        return;
      }

      // ── Tab ──
      // Navega entre números do mesmo cômodo. Se chega no fim do último cômodo,
      // não faz preventDefault → navegador segue o foco natural pra próxima coisa da página.
      if (e.key === "Tab" && !e.shiftKey) {
        const i = qtdIdx === null ? -1 : SEQ.indexOf(qtdIdx);
        if (i < SEQ.length - 1) {
          // Vai pro próximo da sequência (incluindo "input")
          e.preventDefault();
          setComodoQtdFocada(SEQ[i + 1]);
        } else {
          // Está no "input" do cômodo atual → vai pro "0" do próximo cômodo
          if (idxAberto < flat.length - 1) {
            e.preventDefault();
            setComodoAberto(flat[idxAberto + 1]);
            setComodoQtdFocada(0);
            scrollComodoEmFoco(flat[idxAberto + 1]);
          }
          // Senão (último cômodo + input): NÃO preventDefault → Tab natural sai da página
          else {
            setComodoAberto(null);
            setComodoQtdFocada(null);
          }
        }
        return;
      }
      if (e.key === "Tab" && e.shiftKey) {
        const i = qtdIdx === null ? SEQ.length : SEQ.indexOf(qtdIdx);
        if (i > 0) {
          e.preventDefault();
          setComodoQtdFocada(SEQ[i - 1]);
        } else {
          // Está no "0" do cômodo atual → vai pro "input" do cômodo de cima
          if (idxAberto > 0) {
            e.preventDefault();
            setComodoAberto(flat[idxAberto - 1]);
            setComodoQtdFocada("input");
            scrollComodoEmFoco(flat[idxAberto - 1]);
          }
          // Senão (primeiro cômodo + 0): NÃO preventDefault → Shift+Tab natural sobe
          else {
            setComodoAberto(null);
            setComodoQtdFocada(null);
          }
        }
        return;
      }

      // ── Enter ──
      // No "input": só sai do modo teclado (não confirma nada).
      // Em número: aplica a quantidade focada e foca o "1" do próximo cômodo.
      if (e.key === "Enter") {
        if (qtdIdx === "input" || qtdIdx === null) {
          // Não confirma nada
          return;
        }
        e.preventDefault();
        setQtdAbs(aberto, qtdIdx);
        setTimeout(() => {
          const novaFlat = comodosFlatRef.current;
          if (!novaFlat || novaFlat.length === 0) {
            setComodoAberto(null);
            setComodoQtdFocada(null);
            return;
          }
          // O cômodo aplicado (qtdIdx 0 ou >0) sempre vira "tocado" e sai da lista de disponíveis.
          // Pegamos o próximo da lista atual na mesma posição.
          const novoIdx = Math.min(idxAberto, novaFlat.length - 1);
          const proximo = novaFlat[novoIdx];
          setComodoAberto(proximo);
          setComodoQtdFocada(1);
          scrollComodoEmFoco(proximo);
        }, 0);
        return;
      }

      // ── Esc ──
      if (e.key === "Escape") {
        setComodoAberto(null);
        setComodoQtdFocada(null);
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [referencia, tipoObra, tipoProjeto, padrao, tipologia, tamanho, etapaEditando, isComercial, configAtual]);


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

  const modalTotSI   = calculo ? Math.round(((incluiArq?calculo.precoArq:0) + (incluiEng?calculo.precoEng:0))*100)/100 : 0;
  const modalTotCI   = temImposto && modalTotSI > 0 ? Math.round(modalTotSI/(1-aliqImp/100)*100)/100 : modalTotSI;
  const modalImposto = temImposto ? Math.round((modalTotCI - modalTotSI)*100)/100 : 0;

  // Geração da proposta (antes estava no onClick do modal, agora extraída)
  function gerarProposta() {
    if (!calculo) return;
    const resumoDescritivo = (() => {
      const fmtN2 = v => v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
      const fmtArea = v => v > 0 ? fmtN2(v)+"m²" : null;
      // Prefixo "Construção nova de" ou "Reforma de"
      const tipoObraLower = (tipoObra || "").toLowerCase();
      const prefixo = tipoObraLower.includes("reforma") ? "Reforma de " : "Construção nova de ";
      // Helper: minúscula na primeira letra (para encaixar após "de ")
      const toLowerFirst = s => s.length > 0 ? s.charAt(0).toLowerCase() + s.slice(1) : s;
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
        return `${prefixo}conjunto comercial, contendo ${lista}, totalizando ${fmtArea(c.areaTot||c.areaTotal)}.`;
      }
      const nUnid = calculo?.nRep || 1;
      const areaUni = calculo?.areaTotal || calculo?.areaTot || 0;
      const areaTotR = Math.round(areaUni * nUnid * 100)/100;
      const totalAmb = Object.entries(qtds).filter(([,q])=>q>0).reduce((s,[,q])=>s+q,0);
      // Usa formatComodo top-level (helpers PLURAIS_IRREG, GENERO_AMB, NUM_EXT_*)
      const itensFmt = Object.entries(qtds).filter(([,q])=>q>0).map(([nome,q]) => formatComodo(nome, q));
      const listaStr = itensFmt.length>1 ? itensFmt.slice(0,-1).join(", ")+" e "+itensFmt[itensFmt.length-1] : itensFmt[0]||"";
      const tipDesc = (tipologia||"").toLowerCase().includes("sobrado") ? "com dois pavimentos" : "térrea";
      if (nUnid>1) {
        const nExt = nUnid>=1&&nUnid<=10 ? NUM_EXT_FEM[nUnid] : String(nUnid);
        return `${prefixo}${nExt} residências ${tipDesc} idênticas, com ${fmtN2(areaUni)}m² por unidade, totalizando ${fmtN2(areaTotR)}m² de área construída. Cada unidade composta por ${totalAmb} ambientes: ${listaStr}.`;
      }
      return `${prefixo}uma residência ${tipDesc}, com ${fmtN2(areaUni)}m² de área construída, composta por ${totalAmb} ambientes: ${listaStr}.`;
    })();
    setPropostaData({
      tipoProjeto, tipoObra, padrao, tipologia, tamanho,
      clienteNome, referencia,
      comodos: Object.entries(qtds).filter(([,q])=>q>0).map(([nome,qtd])=>({nome,qtd})),
      resumoDescritivo,
      grupoQtds: isComercial ? grupoQtds : null,
      calculo,
      incluiArq, incluiEng, incluiMarcenaria,
      etapasIsoladas: Array.from(etapasIsoladas),
      tipoPgto, temImposto, aliqImp,
      descArq, parcArq, descPacote, parcPacote,
      descEtCtrt, parcEtCtrt, descPacCtrt, parcPacCtrt,
      etapasPct,
      totSI: modalTotSI, totCI: modalTotCI, impostoV: modalImposto,
      escritorio: esc, // Passa o escritório inteiro pra PropostaPreview/PDF lerem dados
    });
    const orcParaSalvar = {
      ...(orcBase || {}),
      tipo: tipoProjeto, subtipo: tipoObra, tipologia, tamanho, padrao,
      cliente: clienteNome, referencia,
      comodos: Object.entries(qtds).filter(([,q])=>q>0).map(([nome,qtd])=>({nome,qtd})),
      repeticao: qtdRep > 0, nUnidades: qtdRep > 0 ? qtdRep : 1,
      grupoQtds: isComercial ? grupoQtds : null,
      grupoParams: isComercial ? grupoParams : null,
      incluiArq, incluiEng, incluiMarcenaria,
      etapasIsoladas: Array.from(etapasIsoladas),
      resultado: { ...calculo, precoArq: calculo?.precoArq || 0, precoEng: calculo?.precoEng || 0, areaTotal: calculo?.areaTotal || 0 },
      tipoPgto, temImposto, aliqImp,
      descArq, parcArq, descPacote, parcPacote,
      descEtCtrt, parcEtCtrt, descPacCtrt, parcPacCtrt,
      etapasPct,
      totSI: modalTotSI, totCI: modalTotCI, impostoV: modalImposto,
    };
    if (onSalvar) onSalvar(orcParaSalvar);
  }

  if (propostaData) {
    const liveData = {
      ...propostaData,
      tipoPgto, temImposto, aliqImp,
      resumoDescritivo: propostaData.resumoDescritivo || "",
      descArq, parcArq, descPacote, parcPacote,
      descEtCtrt, parcEtCtrt, descPacCtrt, parcPacCtrt,
      etapasPct,
      totSI: modalTotSI, totCI: modalTotCI, impostoV: modalImposto,
    };
    // Callback: salva snapshot da proposta no orçamento (cria v1, v2, ...)
    async function handleSalvarPropostaSnapshot(snapshot) {
      if (!onSalvar) throw new Error("Função de salvar não disponível");
      // Orçamento base pode ser null se é um novo orçamento — usa propostaData como fallback
      const base = orcBase || propostaData;
      const propostasAtuais = base.propostas || [];
      const nextVersao = "v" + (propostasAtuais.length + 1);
      const novaProposta = { ...snapshot, versao: nextVersao };
      // Se ainda é rascunho, promove automaticamente pra "aberto" ao enviar primeira proposta
      const novoStatus = (!base.status || base.status === "rascunho") ? "aberto" : base.status;
      // Inicializa probabilidade em 50% quando enviar a primeira proposta (se não já estiver definida)
      const probInicial = base.probabilidade != null && [25, 50, 75].includes(base.probabilidade)
        ? base.probabilidade
        : 50;
      // Salva no orçamento (inclui todos os campos atuais do form + nova proposta)
      const orcAtualizado = {
        ...base,
        propostas: [...propostasAtuais, novaProposta],
        ultimaPropostaEm: snapshot.enviadaEm,
        status: novoStatus,
        probabilidade: probInicial,
      };
      await onSalvar(orcAtualizado);
      return novaProposta;
    }
    // Se já existe proposta salva no orçamento, passa a última pra pre-popular estados
    const ultimaProposta = (orcBase?.propostas && orcBase.propostas.length > 0)
      ? orcBase.propostas[orcBase.propostas.length - 1]
      : null;
    // Se já existe proposta salva da versão aberta, passa info pra read-only
    const propostaAbertaReadOnly = propostaData.propostaReadOnly || (ultimaProposta && modoVer ? {
      versao: ultimaProposta.versao,
      enviadaEm: ultimaProposta.enviadaEm,
    } : null);
    return <PropostaPreview
      data={liveData}
      onVoltar={() => { setPropostaData(null); }}
      onSalvarProposta={handleSalvarPropostaSnapshot}
      propostaReadOnly={propostaAbertaReadOnly}
      propostaSnapshot={ultimaProposta}
      lockEdicao={propostaReadOnlyForce}
    />;
  }

  return (
    <div style={C.wrap} className="vk-orc-wrap" ref={wrapRef}>

      {/* ── Botão Voltar ── */}
      <div style={{ marginBottom:16 }}>
        <button onClick={handleVoltar} style={{ background:"none", border:"none", padding:"0", fontSize:13, color:"#828a98", cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="#828a98" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Voltar
        </button>
      </div>

      {/* ── Identificação ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:18, maxWidth:600 }}>
        <div style={{ fontSize:21, fontWeight:700, color:"#111", padding:"4px 0" }}>{clienteNome || "—"}</div>
        {/* Referência editável inline abaixo do nome — só aparece após preencher na primeira pergunta */}
        {referencia && (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {editandoRefInline ? (
              <input
                autoFocus
                type="text"
                value={referenciaTemp}
                onChange={e => setReferenciaTemp(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (referenciaTemp.trim()) {
                      setReferencia(referenciaTemp.trim());
                      setEditandoRefInline(false);
                    }
                  } else if (e.key === "Escape") {
                    setReferenciaTemp(referencia);
                    setEditandoRefInline(false);
                  }
                }}
                onBlur={() => {
                  if (referenciaTemp.trim()) {
                    setReferencia(referenciaTemp.trim());
                  } else {
                    setReferenciaTemp(referencia);
                  }
                  setEditandoRefInline(false);
                }}
                style={{
                  fontSize:14.5, fontWeight:500, color:"#111",
                  border:"1px solid #c8cdd6", borderRadius:6,
                  padding:"4px 10px", outline:"none", fontFamily:"inherit",
                  minWidth:280, background:"#fff",
                }}
              />
            ) : (
              <span
                onClick={() => { setReferenciaTemp(referencia); setEditandoRefInline(true); }}
                style={{
                  fontSize:14.5, fontWeight:500, color:"#374151",
                  cursor:"pointer", padding:"4px 10px", borderRadius:6,
                  border:"1px solid transparent",
                  transition:"background 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background="#f4f5f7"; e.currentTarget.style.borderColor="#e5e7eb"; }}
                onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="transparent"; }}
                title="Clique para editar">
                {referencia}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Barra de toggles (Arq/Eng/Marc + Imposto + Repetição) — sempre visível ── */}
      <div style={{
        display:"flex", gap:16, flexWrap:"wrap", alignItems:"center",
        padding:"12px 16px", marginBottom:16, maxWidth:1100,
        background:"#fafaf7", border:"1px solid #e5e7eb", borderRadius:10,
      }}>
        {[
          { key:"incluiArq",        val:incluiArq,        set:setIncluiArq,        label:"Arquitetura"  },
          { key:"incluiEng",        val:incluiEng,        set:setIncluiEng,        label:"Engenharia"   },
          { key:"incluiMarcenaria", val:incluiMarcenaria, set:setIncluiMarcenaria, label:"Marcenaria"   },
        ].map(({ key, val, set, label }) => (
          <label key={key} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", userSelect:"none" }}>
            <span onClick={() => set(v => !v)} style={{
              position:"relative", display:"inline-block",
              width:36, height:20, borderRadius:10, flexShrink:0,
              background: val ? "#111" : "#d1d5db",
              transition:"background 0.2s",
              cursor:"pointer",
            }}>
              <span style={{
                position:"absolute", top:3, left: val ? 19 : 3,
                width:14, height:14, borderRadius:"50%",
                background:"#fff",
                transition:"left 0.2s",
                boxShadow:"0 1px 3px rgba(0,0,0,0.2)",
              }} />
            </span>
            <span style={{ fontSize:14, color: val ? "#111" : "#828a98", fontWeight: val ? 600 : 400, transition:"color 0.2s" }}>
              {label}
            </span>
          </label>
        ))}

        {/* Toggle Imposto + input de alíquota (só quando ligado) */}
        <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", userSelect:"none" }}>
          <span onClick={() => setTemImposto(v => !v)} style={{
            position:"relative", display:"inline-block",
            width:36, height:20, borderRadius:10, flexShrink:0,
            background: temImposto ? "#111" : "#d1d5db",
            transition:"background 0.2s",
            cursor:"pointer",
          }}>
            <span style={{
              position:"absolute", top:3, left: temImposto ? 19 : 3,
              width:14, height:14, borderRadius:"50%",
              background:"#fff",
              transition:"left 0.2s",
              boxShadow:"0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </span>
          <span style={{ fontSize:14, color: temImposto ? "#111" : "#828a98", fontWeight: temImposto ? 600 : 400, transition:"color 0.2s" }}>
            Imposto
          </span>
        </label>
        {temImposto && (
          <div style={{ display:"flex", alignItems:"center", gap:0, marginLeft:-8 }}>
            {editandoAliq ? (
              <input
                autoFocus
                type="number" min="0" max="100" step="0.5"
                defaultValue={aliqImp}
                onBlur={e => { const v = parseFloat(e.target.value)||0; setAliqImp(Math.max(0, Math.min(100, v))); setEditandoAliq(false); }}
                onKeyDown={e => { if(e.key==="Enter"||e.key==="Escape"){ const v=parseFloat(e.target.value)||0; setAliqImp(Math.max(0, Math.min(100, v))); setEditandoAliq(false); } }}
                className="no-spin"
                style={{ width:48, textAlign:"center", fontSize:13, fontWeight:600, border:"1px solid #333", borderRadius:5, padding:"1px 4px", outline:"none", fontFamily:"inherit", MozAppearance:"textfield" }}
              />
            ) : (
              <span
                onClick={() => setEditandoAliq(true)}
                title="Clique para editar"
                style={{
                  fontSize:13, fontWeight:700, color:"#111",
                  padding:"3px 8px", border:"1px solid #d0d4db", borderRadius:5,
                  background:"#fff", cursor:"text",
                }}>
                {aliqImp}%
              </span>
            )}
          </div>
        )}

        {tipoProjeto !== "Conj. Comercial" && (
          <div style={{ display:"flex", alignItems:"center", gap:6, paddingLeft:12, marginLeft:4, borderLeft:"1px solid #e5e7eb" }}>
            <span style={{ fontSize:14, color:"#828a98" }}>Repetição</span>
            <button style={{ width:22, height:22, borderRadius:5, border:"1px solid #d0d4db", background:"#fff", fontSize:14, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1, color:"#374151" }}
              onClick={() => setQtdRep(n => Math.max(0, n - 1))}>−</button>
            {editandoRep ? (
              <input
                autoFocus
                type="number" min="0"
                defaultValue={qtdRep}
                onBlur={e => { const v = parseInt(e.target.value)||0; setQtdRep(Math.max(0,v)); setEditandoRep(false); }}
                onKeyDown={e => { if(e.key==="Enter"||e.key==="Escape"){ const v=parseInt(e.target.value)||0; setQtdRep(Math.max(0,v)); setEditandoRep(false); } }}
                className="no-spin"
                style={{ width:36, textAlign:"center", fontSize:13, fontWeight:600, border:"1px solid #333", borderRadius:5, padding:"1px 4px", outline:"none", fontFamily:"inherit", MozAppearance:"textfield" }}
              />
            ) : (
              <span
                onClick={() => setEditandoRep(true)}
                title="Clique para digitar"
                style={{ fontSize:13, fontWeight: qtdRep > 0 ? 700 : 400, minWidth:16, textAlign:"center", color: qtdRep > 0 ? "#111" : "#9ca3af", cursor:"text" }}>
                {qtdRep}
              </span>
            )}
            <button style={{ width:22, height:22, borderRadius:5, border:"1px solid #d0d4db", background:"#fff", fontSize:14, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1, color:"#374151" }}
              onClick={() => setQtdRep(n => n + 1)}>+</button>
          </div>
        )}
      </div>

      {/* ── Fluxo sequencial: shell 2 colunas, card central + trilha lateral direita ── */}
      {(() => {
        // Etapas em ordem. Referência é a 1ª. Tipologia/padrão/tamanho só se !isComercial.
        const ordem = ["referencia", "tipoObra", "tipoProjeto"];
        if (!isComercial) ordem.push("padrao", "tipologia", "tamanho");

        // VALS expandido inclui referência
        const VALS_EXT = { referencia, ...VALS };

        // Etapa atual: a primeira sem valor, OU a etapa que o usuário clicou pra editar
        const proximaPendente = ordem.find(k => !VALS_EXT[k]);
        const etapaAtual = etapaEditando || proximaPendente;
        const concluido = !proximaPendente && !etapaEditando;
        const stepIdx = etapaAtual ? ordem.indexOf(etapaAtual) : ordem.length;

        // Labels e hints
        const LABELS_EXT = { referencia: "Referência", ...LABELS };
        const TITLES = {
          referencia:  "Dê uma referência a esse projeto",
          tipoObra:    "Construção nova ou reforma?",
          tipoProjeto: "Qual o tipo de projeto?",
          padrao:      "Qual o padrão construtivo?",
          tipologia:   "Qual a tipologia?",
          tamanho:     "Qual o tamanho dos ambientes?",
        };
        const HINTS = {
          referencia:  "Ex: nome da casa, endereço ou bairro.",
          tipoObra:    "Define se é construção nova ou reforma de algo existente.",
          tipoProjeto: "Cada tipo destrava um conjunto diferente de cômodos e variáveis.",
          padrao:      "Define o índice de preço base do projeto.",
          tipologia:   "Térreo (1 pavimento) ou sobrado (2+ pavimentos).",
          tamanho:     "Define as medidas-padrão de cada cômodo.",
        };

        // Se já concluiu todas as etapas, renderiza só a trilha horizontal compacta
        // (referência fica editável só pelo texto inline abaixo do nome do cliente)
        if (concluido) {
          // Remove "referencia" da trilha horizontal
          const ordemH = ordem.filter(k => k !== "referencia");
          return (
            <div className="vk-trilha-h" style={{ maxWidth: 1100 }}>
              {ordemH.flatMap((k, i) => {
                const val = VALS_EXT[k];
                const isOpen = trilhaHPop?.key === k;
                const items = [
                  <button
                    key={k}
                    type="button"
                    className={"vk-trilha-h-node" + (isOpen ? " is-open" : "")}
                    data-tk={k}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isOpen) { setTrilhaHPop(null); return; }
                      const r = e.currentTarget.getBoundingClientRect();
                      setTrilhaHPop({ key: k, top: r.bottom + 6, left: r.left });
                    }}
                    title={`Editar ${LABELS_EXT[k]}`}>
                    <span className="vk-trilha-h-dot"></span>
                    <span className="vk-trilha-h-key">{LABELS_EXT[k]}</span>
                    <span className="vk-trilha-h-val">{displayOpcao(k, val)}</span>
                    <span className="vk-trilha-h-caret">▾</span>
                  </button>
                ];
                if (i < ordemH.length - 1) {
                  items.push(<span key={k + "-sep"} className="vk-trilha-h-sep"></span>);
                }
                return items;
              })}
            </div>
          );
        }

        return (
          <div className="vk-flow-shell">
            {/* ─── ÁREA CENTRAL ─── */}
            <div className="vk-flow-stage">
              {etapaAtual && (
                <div className="vk-flow2-card" key={"card-" + etapaAtual + "-" + opcaoEscolhida}>
                  <div className="vk-flow2-progress">
                    PERGUNTA {String(stepIdx + 1).padStart(2, "0")} / {String(ordem.length).padStart(2, "0")}
                  </div>
                  <h2 className="vk-flow2-title">{TITLES[etapaAtual]}</h2>
                  <p className="vk-flow2-hint">{HINTS[etapaAtual]}</p>

                  {/* Input texto para "referencia" */}
                  {etapaAtual === "referencia" ? (
                    <div className="vk-flow2-input-wrap">
                      <input
                        ref={el => {
                          if (el && !opcaoEscolhida && document.activeElement !== el) {
                            // Foco automático ao entrar na etapa
                            setTimeout(() => { try { el.focus(); } catch {} }, 50);
                          }
                        }}
                        className={"vk-flow2-input" + (opcaoEscolhida ? " is-chosen" : "")}
                        type="text"
                        placeholder="Ex: Casa de Praia, Residência Padovan, Bairro Vila Nova..."
                        value={referenciaTemp}
                        onChange={e => setReferenciaTemp(e.target.value)}
                        disabled={!!opcaoEscolhida}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            confirmarReferencia();
                          } else if (e.key === "Escape") {
                            setReferenciaTemp(referencia);
                            setEtapaEditando(null);
                          }
                        }}
                        onBlur={() => {
                          // Só confirma no blur se tem conteúdo (referência é obrigatória)
                          if (referenciaTemp.trim() && !opcaoEscolhida) {
                            confirmarReferencia();
                          }
                        }}
                      />
                      <div className="vk-flow2-input-hint">
                        Pressione <strong>Enter</strong> para confirmar ou clique fora do campo.
                      </div>
                    </div>
                  ) : (
                    /* Tabela de opções */
                    <div className="vk-flow2-table">
                      <div className="vk-flow2-table-head">
                        <span>OPÇÕES</span>
                        <span>{(OPCOES[etapaAtual] || []).length}</span>
                      </div>
                      {(OPCOES[etapaAtual] || []).map((op, i) => {
                        const isChosen = opcaoEscolhida === op;
                        const isFading = !!opcaoEscolhida && !isChosen;
                        const isFocused = opcaoFocada === i && !opcaoEscolhida;
                        let cls = "vk-flow2-row";
                        if (isChosen) cls += " is-chosen";
                        if (isFading) cls += " is-fading";
                        if (isFocused) cls += " is-focused";
                        return (
                          <button
                            key={op}
                            className={cls}
                            style={{ animationDelay: `${i * 50}ms` }}
                            disabled={!!opcaoEscolhida}
                            onClick={() => {
                              if (opcaoEscolhida) return;
                              setOpcaoEscolhida(op);
                              setTimeout(() => {
                                SETS[etapaAtual](op);
                                setEtapaEditando(null);
                                setOpcaoEscolhida(null);
                              }, 450);
                            }}>
                            <span className="vk-flow2-row-idx">{String(i + 1).padStart(2, "0")}</span>
                            <span className="vk-flow2-row-text">{displayOpcao(etapaAtual, op)}</span>
                            <span className="vk-flow2-row-arrow">→</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ─── TRILHA VERTICAL LATERAL DIREITA ─── */}
            <aside className="vk-trilha-rail">
              <div className="vk-trilha-rail-title">Definições do projeto</div>
              <div className="vk-trilha-list">
                <div className="vk-trilha-line"></div>
                {ordem.map((k, i) => {
                  const val = VALS_EXT[k];
                  const isActive = etapaAtual === k;
                  const isDone = !!val && !isActive;
                  const isFuture = !val && !isActive;
                  let dotCls = "vk-trilha-dot";
                  if (isActive) dotCls += " vk-trilha-dot-active";
                  else if (isFuture) dotCls += " vk-trilha-dot-future";

                  return (
                    <div
                      key={k}
                      className={"vk-trilha-node" + (isDone ? " is-done" : "") + (isFuture ? " vk-trilha-node-future" : "")}
                      onClick={() => {
                        if (!isDone) return;
                        if (k === "referencia") setReferenciaTemp(referencia);
                        setEtapaEditando(etapaEditando === k ? null : k);
                      }}
                      style={{ animationDelay: `${i * 60}ms` }}>
                      <span className={dotCls}></span>
                      <div className="vk-trilha-text">
                        <span className="vk-trilha-key">{LABELS_EXT[k]}</span>
                        <span className={val ? "vk-trilha-val" : "vk-trilha-val-pending"}>
                          {val ? displayOpcao(k, val) : (isActive ? "aguardando..." : "—")}
                          {isDone && <span className="vk-trilha-caret">▾</span>}
                        </span>
                      </div>

                      {/* Popover de edição inline (lado esquerdo do nó) */}
                      {etapaEditando === k && k !== "referencia" && (
                        <div className="vk-trilha-edit" onClick={e => e.stopPropagation()}>
                          <div className="vk-trilha-edit-head">EDITAR · {LABELS_EXT[k]}</div>
                          {(OPCOES[k] || []).map(op => (
                            <button
                              key={op}
                              className={"vk-trilha-edit-row" + (val === op ? " is-selected" : "")}
                              onClick={() => {
                                SETS[k](op);
                                setEtapaEditando(null);
                              }}>
                              <span className="vk-trilha-edit-bullet"></span>
                              <span style={{ flex:1, fontWeight:500 }}>{displayOpcao(k, op)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Popover de edição da Referência (input texto) */}
                      {etapaEditando === k && k === "referencia" && (
                        <div className="vk-trilha-edit" onClick={e => e.stopPropagation()}>
                          <div className="vk-trilha-edit-head">EDITAR · REFERÊNCIA</div>
                          <input
                            className="vk-trilha-edit-input"
                            autoFocus
                            type="text"
                            value={referenciaTemp}
                            onChange={e => setReferenciaTemp(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                if (referenciaTemp.trim()) {
                                  setReferencia(referenciaTemp.trim());
                                  setEtapaEditando(null);
                                }
                              } else if (e.key === "Escape") {
                                setReferenciaTemp(referencia);
                                setEtapaEditando(null);
                              }
                            }}
                          />
                          <div className="vk-trilha-edit-actions">
                            <button className="vk-trilha-edit-btn" onClick={() => { setReferenciaTemp(referencia); setEtapaEditando(null); }}>Cancelar</button>
                            <button className="vk-trilha-edit-btn vk-trilha-edit-btn-primary"
                              onClick={() => {
                                if (referenciaTemp.trim()) {
                                  setReferencia(referenciaTemp.trim());
                                  setEtapaEditando(null);
                                }
                              }}>Salvar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </aside>
          </div>
        );
      })()}


      {/* ── Cômodos + Resumo ── */}
      {!!(tamanho || isComercial) && !!configAtual && (
        <div className="vk-orc-comodos-shell" style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:20, alignItems:"start",
          animation:"slideUp 0.5s ease forwards",
          marginTop:0,
          maxWidth:1100,
        }}>

          <div className="vk-orc-comodos-card" style={{
            background:"#fff",
            border:"1px solid #e5e7eb",
            borderRadius:10,
            maxHeight:560,
            overflowY:"auto",
            padding:"4px 12px",
          }}>


            {/* Container 1 coluna */}
            <div>
            {(() => {
              // Popula ref com lista plana de cômodos disponíveis em ordem (pra navegação por teclado)
              const flat = [];
              Object.entries(configAtual.grupos).forEach(([grupo, nomes]) => {
                const isTerrea = tipologia === "Térreo" || tipologia === "Térrea";
                if (isTerrea && grupo === "Outros") return;
                nomes.forEach(n => {
                  if (!comodosTocados.has(n) && (qtds[n] || 0) === 0) flat.push(n);
                });
              });
              comodosFlatRef.current = flat;
              return null;
            })()}
            {Object.entries(configAtual.grupos).filter(([grupo]) => {
                const isTerrea = tipologia === "Térreo" || tipologia === "Térrea";
                if (isTerrea && grupo === "Outros") return false;
                return true;
              }).map(([grupo, nomes]) => {
              // Split: escolhidos vs disponíveis
              // Escolhidos: aparece se já foi tocado (mesmo que qty=0 agora)
              const escolhidos  = nomes.filter(n => comodosTocados.has(n) || (qtds[n] || 0) > 0);
              const disponiveis = nomes.filter(n => !comodosTocados.has(n) && (qtds[n] || 0) === 0);
              const m2Grupo  = escolhidos.reduce((s,n) => s + getArea(n) * (qtds[n]||0), 0);
              const qtdGrupo = escolhidos.reduce((s,n) => s + (qtds[n]||0), 0);

              // Renderiza controles: input + 1-6 + ✕ (se escolhido)
              // Função plana (não componente) pra evitar unmount/remount a cada re-render
              const renderControles = (nome, sempreVisivel) => {
                const q = qtds[nome] || 0;
                const isOpen = comodoAberto === nome;
                // Em mobile, sempreVisivel decide pra cada cômodo (chamado decide).
                // Em desktop, mantém lógica original (visível só em hover).
                const visivel = sempreVisivel || isOpen;
                if (!visivel) return null;
                // Em mobile: botões 0-4 (limite). Em desktop: 0-6 (compatibilidade).
                const numerosBotoes = isMobileOrc ? [0,1,2,3,4] : [0,1,2,3,4,5,6];
                return (
                  <span key={nome+"-ctrls"}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 2,
                      transition: "opacity 0.15s ease",
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                      background: "#fff",
                      padding: "3px 5px",
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                      boxShadow: "0 2px 8px -2px rgba(0,0,0,0.08)",
                      zIndex: 100,
                      position: "relative",
                    }}>
                    {/* Input em primeiro lugar */}
                    <input
                      ref={el => {
                        // Foca automaticamente quando o usuário navega via teclado até esse input
                        if (el && comodoAberto === nome && comodoQtdFocada === "input" && document.activeElement !== el) {
                          setTimeout(() => { try { el.focus(); el.select(); } catch {} }, 0);
                        }
                      }}
                      type="number" min="0"
                      defaultValue={q > 6 ? q : ""}
                      className="no-spin"
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => e.stopPropagation()}
                      onFocus={e => {
                        setComodoAberto(nome);
                        setComodoQtdFocada("input");
                        setTravado(true);
                        if (comodoCloseRef.current) { clearTimeout(comodoCloseRef.current); comodoCloseRef.current = null; }
                      }}
                      onBlur={e => {
                        // No mobile (iOS/Android), o teclado numérico não tem
                        // botão "Enter" — usuário fecha o teclado tocando "OK",
                        // "Concluído" ou fora do input, o que dispara blur (não keydown).
                        // Aplica a quantidade aqui pra não perder o valor digitado.
                        const v = parseInt(e.currentTarget.value) || 0;
                        if (v > 0) {
                          setQtdAbs(nome, v);
                        }
                        setTravado(false);
                      }}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          const v = parseInt(e.currentTarget.value) || 0;
                          if (v > 0) {
                            setQtdAbs(nome, v);
                            // Após aplicar, foca o "1" do próximo cômodo (mesma lógica do Enter no número)
                            const flat = comodosFlatRef.current;
                            const idx = flat ? flat.indexOf(nome) : -1;
                            setTimeout(() => {
                              const novaFlat = comodosFlatRef.current;
                              if (!novaFlat || novaFlat.length === 0) {
                                setComodoAberto(null);
                                setComodoQtdFocada(null);
                                return;
                              }
                              const novoIdx = Math.min(idx, novaFlat.length - 1);
                              setComodoAberto(novaFlat[novoIdx]);
                              setComodoQtdFocada(1);
                            }, 0);
                          }
                          setTravado(false);
                          e.currentTarget.blur();
                        } else if (e.key === "Escape") {
                          e.stopPropagation();
                          setTravado(false);
                          setComodoAberto(null);
                          setComodoQtdFocada(null);
                          e.currentTarget.blur();
                        } else if (e.key === "Tab") {
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.blur();
                          const flat = comodosFlatRef.current;
                          const idxAtual = flat ? flat.indexOf(nome) : -1;
                          if (e.shiftKey) {
                            // Shift+Tab no input → vai pro 6 do mesmo cômodo
                            setComodoQtdFocada(6);
                          } else {
                            // Tab no input → próximo cômodo no 0
                            if (idxAtual >= 0 && idxAtual < flat.length - 1) {
                              setComodoAberto(flat[idxAtual + 1]);
                              setComodoQtdFocada(0);
                            } else {
                              // último cômodo: sai
                              setComodoAberto(null);
                              setComodoQtdFocada(null);
                            }
                          }
                        } else if (e.key === "ArrowLeft") {
                          // ←: volta pro 6
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.blur();
                          setComodoQtdFocada(6);
                        } else if (e.key === "ArrowRight") {
                          // →: vai pro 0 (wrap)
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.blur();
                          setComodoQtdFocada(0);
                        } else if (e.key === "ArrowDown") {
                          // ↓: próximo cômodo, "1"
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.blur();
                          const flat = comodosFlatRef.current;
                          const idxAtual = flat ? flat.indexOf(nome) : -1;
                          if (idxAtual >= 0 && idxAtual < flat.length - 1) {
                            setComodoAberto(flat[idxAtual + 1]);
                            setComodoQtdFocada(1);
                          }
                        } else if (e.key === "ArrowUp") {
                          // ↑: cômodo anterior, "1"
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.blur();
                          const flat = comodosFlatRef.current;
                          const idxAtual = flat ? flat.indexOf(nome) : -1;
                          if (idxAtual > 0) {
                            setComodoAberto(flat[idxAtual - 1]);
                            setComodoQtdFocada(1);
                          }
                        }
                      }}
                      style={{
                        width:32, height:26,
                        border: (comodoAberto === nome && comodoQtdFocada === "input") ? "1px solid #111" : "1px solid #d1d5db",
                        borderRadius:4,
                        background:"#fff", fontSize:12.5, fontWeight:500, color:"#111",
                        padding:"0 3px", textAlign:"center", outline:"none", fontFamily:"inherit",
                        flexShrink:0, marginRight:3,
                        MozAppearance:"textfield",
                      }}
                    />
                    {numerosBotoes.map(n => {
                      const isSel = n > 0 && q === n;
                      const isKbFoc = comodoAberto === nome && comodoQtdFocada === n;
                      return (
                      <button key={n}
                        onClick={e => { e.stopPropagation(); setQtdAbs(nome, n); setTravado(false); setComodoAberto(null); setComodoQtdFocada(null); }}
                        style={{
                          width:26, height:26,
                          border: isKbFoc && !isSel ? "1px solid #111" : "1px solid transparent",
                          borderRadius:4,
                          background: isSel ? "#111" : "transparent",
                          color: isSel ? "#fff" : "#374151",
                          fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
                          display:"inline-flex", alignItems:"center", justifyContent:"center",
                          flexShrink:0, padding:0,
                          transition:"all 0.1s",
                          outline: "none",
                        }}
                        onMouseEnter={e => { if (!isSel && !isKbFoc) { e.currentTarget.style.background = "#111"; e.currentTarget.style.color = "#fff"; } }}
                        onMouseLeave={e => { if (!isSel && !isKbFoc) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#374151"; } }}>
                        {n}
                      </button>
                      );
                    })}
                    {q > 0 && (
                      <>
                        <span style={{ width:1, height:16, background:"#d1d5db", margin:"0 3px", alignSelf:"center" }} />
                        <button
                          onClick={e => { e.stopPropagation(); removerComodo(nome); setTravado(false); setComodoAberto(null); }}
                          title="Remover"
                          style={{
                            width:26, height:26, border:"1px solid transparent", borderRadius:4,
                            background:"transparent", color:"#dc2626", fontSize:13.5,
                            display:"inline-flex", alignItems:"center", justifyContent:"center",
                            cursor:"pointer", fontFamily:"inherit", flexShrink:0, padding:0,
                          }}>
                          ✕
                        </button>
                      </>
                    )}
                  </span>
                );
              };

              // Em mobile, "recolhido" não vale — precisamos garantir que
              // o primeiro cômodo da fila apareça mesmo se o grupo dele estiver
              // marcado como recolhido pelo usuário.
              const recolhido = !isMobileOrc && !isGrupoAberto(grupo);

              return (
                <div key={grupo} style={{ marginBottom:14 }}>
                  {/* Header: retângulo cinza com bordas arredondadas */}
                  <div style={{
                    display:"flex", alignItems:"center", gap:10,
                    background:"#f4f5f7", border:"1px solid #e5e7eb", borderRadius:6,
                    padding:"5px 10px",
                    marginBottom: (recolhido && escolhidos.length === 0) ? 0 : 8,
                  }}>
                    <span style={{ fontSize:11, color:"#6b7280", textTransform:"uppercase", letterSpacing:1, fontWeight:600, userSelect:"none", flexShrink:0 }}>
                      {isComercial ? (GRUPO_DISPLAY[grupo] || grupo) : grupo}
                    </span>
                    {/* Resetar — só aparece no primeiro grupo, reseta TODOS os cômodos */}
                    {grupo === "Áreas Sociais" && Object.keys(qtds).some(n => qtds[n] > 0) && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setQtds({});
                          setComodosTocados(new Set());
                          setGruposAbertos({});
                        }}
                        style={{
                          background:"transparent", border:"1px solid #d0d4db",
                          color:"#6b7280", fontSize:10, fontFamily:"inherit",
                          cursor:"pointer", padding:"1px 8px", borderRadius:4,
                          transition:"all 0.15s", fontWeight:500, lineHeight:1.4,
                          flexShrink:0,
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = "#dc2626";
                          e.currentTarget.style.color = "#dc2626";
                          e.currentTarget.style.background = "#fef2f2";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = "#d0d4db";
                          e.currentTarget.style.color = "#6b7280";
                          e.currentTarget.style.background = "transparent";
                        }}>
                        Resetar
                      </button>
                    )}
                    <span style={{ flex:1 }} />

                    {/* Controles específicos de grupos comerciais: Padrão/Tipologia/Tamanho + Quantidade de unidades */}
                    {isComercial && (
                      <>
                        {["padrao","tipologia","tamanho"].map(key => {
                          const labels = { padrao:"Padrão", tipologia:"Tipologia", tamanho:"Tamanho" };
                          const opcoes = { padrao:["Alto","Médio","Baixo"], tipologia:["Térreo","Sobrado"], tamanho:["Grande","Médio","Pequeno","Compacta"] };
                          const gp = grupoParams[grupo] || {};
                          const val = gp[key] || "";
                          const aKey = `${grupo}__${key}`;
                          const open = abertoGrupo?.key === aKey;
                          return (
                            <div key={key} style={{ position:"relative", flexShrink:0 }}
                              onMouseEnter={() => {
                                if (hoverCloseRef.current) { clearTimeout(hoverCloseRef.current); hoverCloseRef.current = null; }
                                setAbertoGrupo({ key: aKey, grupo, param: key });
                              }}
                              onMouseLeave={() => {
                                if (hoverCloseRef.current) clearTimeout(hoverCloseRef.current);
                                hoverCloseRef.current = setTimeout(() => setAbertoGrupo(null), 120);
                              }}>
                              <button
                                onClick={e => { e.stopPropagation(); setAbertoGrupo(open ? null : { key: aKey, grupo, param: key }); }}
                                style={{
                                  display:"flex", alignItems:"center", gap:4,
                                  background: open ? "#eceef2" : (val ? "#fff" : "transparent"),
                                  border: `1px solid ${open ? "#828a98" : (val ? "#d0d4db" : "#d0d4db")}`,
                                  borderRadius:4, padding:"2px 8px",
                                  fontSize:10, fontFamily:"inherit", cursor:"pointer",
                                  color:"#111", lineHeight:1.4, transition:"all 0.15s",
                                }}>
                                {val
                                  ? <><span style={{ color:"#828a98", fontWeight:400 }}>{labels[key]}:</span><span style={{ fontWeight:600, color:"#111" }}>{val}</span></>
                                  : <span style={{ color:"#6b7280" }}>{labels[key]}</span>}
                                <svg width="8" height="8" viewBox="0 0 12 12" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition:"transform 0.15s" }}>
                                  <path d="M2 4l4 4 4-4" stroke="#828a98" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                              {open && (
                                <div style={{ position:"absolute", top:"100%", left:0, zIndex:9999,
                                  background:"#fff", border:"1px solid #b0b7c3", borderRadius:8,
                                  boxShadow:"0 4px 20px rgba(0,0,0,0.12)", minWidth:110, overflow:"hidden", marginTop:4 }}>
                                  {opcoes[key].map(op => {
                                    const selecionado = val === op;
                                    return (
                                      <div key={op}
                                        onClick={e => { e.stopPropagation(); setGrupoParam(grupo, key, op); }}
                                        onMouseEnter={e => { if (!selecionado) e.currentTarget.style.background = "#f4f5f7"; }}
                                        onMouseLeave={e => { if (!selecionado) e.currentTarget.style.background = "#fff"; }}
                                        style={{
                                          padding:"6px 12px", fontSize:12, cursor:"pointer",
                                          background: selecionado ? "#eceef2" : "#fff",
                                          color:"#374151", fontWeight: selecionado ? 600 : 400,
                                        }}>
                                        {op}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Controle de quantidade de unidades do grupo (− N +) */}
                        <div style={{ display:"flex", alignItems:"center", gap:3, flexShrink:0, paddingLeft:6, borderLeft:"1px solid #d0d4db" }}>
                          <button
                            onClick={() => setGrupoQtd(grupo, -1)}
                            style={{ width:18, height:18, borderRadius:4, border:"1px solid #d0d4db", background:"#fff", fontSize:11, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1, color:"#374151", padding:0 }}>
                            −
                          </button>
                          {editandoGrupoQtd === grupo ? (
                            <input
                              autoFocus
                              type="number" min="0"
                              defaultValue={grupoQtds[grupo]||0}
                              onBlur={e => {
                                const v = Math.max(0, parseInt(e.target.value)||0);
                                setGrupoQtds(prev => ({ ...prev, [grupo]: v }));
                                setEditandoGrupoQtd(null);
                              }}
                              onKeyDown={e => {
                                if (e.key === "Enter" || e.key === "Escape") {
                                  const v = Math.max(0, parseInt(e.target.value)||0);
                                  setGrupoQtds(prev => ({ ...prev, [grupo]: v }));
                                  setEditandoGrupoQtd(null);
                                }
                              }}
                              className="no-spin"
                              style={{ width:36, textAlign:"center", fontSize:11, fontWeight:600, border:"1px solid #333", borderRadius:4, padding:"1px 4px", outline:"none", fontFamily:"inherit", MozAppearance:"textfield" }}
                            />
                          ) : (
                            <span
                              onClick={() => setEditandoGrupoQtd(grupo)}
                              title="Clique para digitar"
                              style={{ fontSize:11, fontWeight: (grupoQtds[grupo]||0) > 0 ? 700 : 400, minWidth:18, textAlign:"center", color: (grupoQtds[grupo]||0) > 0 ? "#111" : "#9ca3af", cursor:"text" }}>
                              {grupoQtds[grupo]||0}
                            </span>
                          )}
                          <button
                            onClick={() => setGrupoQtd(grupo, +1)}
                            style={{ width:18, height:18, borderRadius:4, border:"1px solid #d0d4db", background:"#fff", fontSize:11, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1, color:"#374151", padding:0 }}>
                            +
                          </button>
                        </div>
                      </>
                    )}

                    {qtdGrupo > 0 && (
                      <span style={{ fontSize:11, color:"#9ca3af" }}>
                        <strong style={{ color:"#111", fontWeight:600 }}>{qtdGrupo * (isComercial ? (grupoQtds[grupo]||1) : 1)}</strong> amb · <strong style={{ color:"#111", fontWeight:600 }}>{fmtNum(m2Grupo * (isComercial ? (grupoQtds[grupo]||1) : 1))}</strong> m²
                      </span>
                    )}
                    <button
                      onClick={() => toggleGrupo(grupo)}
                      title={recolhido ? "Expandir" : "Recolher"}
                      style={{
                        width:18, height:18, border:"none", background:"transparent",
                        cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                        padding:0, fontFamily:"inherit", flexShrink:0,
                      }}>
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ transform: recolhido ? "rotate(180deg)" : "rotate(0)", transition:"transform 0.2s" }}>
                        <path d="M2 8l4-4 4 4" stroke="#828a98" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>

                  {!recolhido && disponiveis.length > 0 && (
                    <>
                      {/* Disponíveis — nome à esquerda, controles flutuantes à direita ao hover.
                          MOBILE: todos os cômodos VISÍVEIS, mas o seletor [0 1 2 3 4]
                          aparece só no PRIMEIRO da fila (ordem global flat).
                          Conforme o usuário define, o cômodo sai da lista de disponíveis
                          e o seletor migra pro próximo. UX sequencial guiada. */}
                      <div style={{ marginTop:4, maxWidth: isMobileOrc ? "100%" : 380 }}>
                        <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
                          {disponiveis.map(nome => {
                            const isOpen = comodoAberto === nome;
                            // Decide se o seletor [input] 0 1 2 3 4 fica VISÍVEL inline,
                            // ou se ele só aparece em hover (comportamento desktop antigo).
                            // - Desktop: false (default) → seletor só aparece no hover
                            //   sobre o cômodo, via o state `comodoAberto` (renderControles
                            //   internamente verifica `isOpen` e decide).
                            // - Mobile: só o PRIMEIRO da fila global tem seletor visível.
                            //   Os demais cômodos aparecem com nome só, esperando a vez.
                            let mostrarSeletor = false;
                            if (isMobileOrc) {
                              const flat = comodosFlatRef.current || [];
                              mostrarSeletor = flat.indexOf(nome) === 0;
                            }
                            return (
                              <div key={nome}
                                data-comodo-wrap
                                data-comodo-nome={nome}
                                onMouseEnter={isMobileOrc ? undefined : () => abrirComodo(nome)}
                                onMouseLeave={isMobileOrc ? undefined : agendarFecharComodo}
                                style={{
                                  position:"relative",
                                  display:"flex", alignItems:"center",
                                  flexWrap:"nowrap", // mantém nome + seletor na mesma linha sempre
                                  padding: isMobileOrc ? "8px 6px" : "6px 10px",
                                  fontSize: isMobileOrc ? 14 : 14.5,
                                  // Em mobile, só o cômodo "ativo" (com seletor) tem destaque visual.
                                  // Os outros ficam cinza pra deixar claro que estão aguardando a vez.
                                  color: isOpen || (isMobileOrc && mostrarSeletor) ? "#111" : (isMobileOrc ? "#6b7280" : "#6b7280"),
                                  background: isOpen ? "#f4f5f7" : "transparent",
                                  borderRadius:6,
                                  userSelect:"none",
                                  transition:"color 0.15s, background 0.15s",
                                  minHeight:34,
                                  gap: isMobileOrc ? 8 : 0,
                                }}>
                                <span style={{
                                  flex:1, // cresce conforme tem espaço, sem forçar 100%
                                  fontWeight: (isMobileOrc && mostrarSeletor) ? 600 : (isOpen ? 500 : 400),
                                  minWidth:0,
                                  // truncar com ... se nome for muito longo (cabe seletor ao lado)
                                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                                }}>
                                  {nome}
                                  {(nome === "Suíte" || nome === "Dormitório") && (
                                    <span style={{ fontSize:10.5, color:"#9ca3af", marginLeft:5, fontWeight:400 }}>(Sem Closet)</span>
                                  )}
                                </span>
                                <span style={{ flexShrink:0, display:"flex", alignItems:"center" }}>
                                  {renderControles(nome, mostrarSeletor)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Escolhidos — SEMPRE visíveis, mesmo com grupo recolhido */}
                  {escolhidos.length > 0 && (
                    <div style={{
                      display:"flex", flexDirection:"row", flexWrap:"wrap", alignItems:"center",
                      gap:"8px 8px",
                      paddingTop: (!recolhido && disponiveis.length > 0) ? 10 : 0,
                      marginTop:  (!recolhido && disponiveis.length > 0) ? 10 : 4,
                      borderTop:  (!recolhido && disponiveis.length > 0) ? "1px dashed #e5e7eb" : "none",
                      width:"100%",
                    }}>
                      {escolhidos.map(nome => {
                        const q = qtds[nome] || 0;
                        const m2Total = getArea(nome) * q;
                        return (
                          <span key={nome}
                            onClick={() => removerComodo(nome)}
                            title="Clique para remover"
                            className="comodo-escolhido"
                            style={{
                              display:"inline-flex", alignItems:"center", gap:6,
                              fontSize:13.5, color:"#111", fontWeight:500,
                              userSelect:"none",
                              whiteSpace:"nowrap",
                              flex:"0 0 auto",
                              cursor:"pointer",
                              padding:"4px 10px",
                              background:"#f4f5f7",
                              border:"1px solid #e5e7eb",
                              borderRadius:6,
                              transition:"all 0.15s",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background="#fef2f2"; e.currentTarget.style.borderColor="#fecaca"; e.currentTarget.style.color="#dc2626"; }}
                            onMouseLeave={e => { e.currentTarget.style.background="#f4f5f7"; e.currentTarget.style.borderColor="#e5e7eb"; e.currentTarget.style.color="#111"; }}>
                            <strong style={{ fontWeight:700 }}>{q}</strong>
                            <span>{nome}</span>
                            <span className="comodo-m2" style={{ fontSize:11, color:"#9ca3af", fontWeight:400 }}>· {fmtNum(m2Total)} m²</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
              })}
              {/* Folga no final — compensa a altura que as linhas selecionadas deixam
                  de ocupar na lista de disponíveis. Mantém altura total constante pra
                  que o scroll não seja reajustado ao selecionar (o próximo cômodo
                  sobe exatamente pra posição do cursor). */}
              {(() => {
                // Folga é necessária no DESKTOP pra manter scroll estável
                // ao selecionar cômodo (próximo sobe exatamente pra posição
                // do cursor). Em mobile não tem hover/cursor preciso, e a
                // folga só cria gap enorme entre os cômodos e o resumo —
                // pula em mobile.
                if (isMobileOrc) return null;
                const gruposVisiveis = Object.entries(configAtual.grupos).filter(([g]) => {
                  const isTerrea = tipologia === "Térreo" || tipologia === "Térrea";
                  if (isTerrea && g === "Outros") return false;
                  return isGrupoAberto(g);
                });
                // Conta cômodos selecionados dentro dos grupos visíveis/expandidos
                const selecionadosVisiveis = gruposVisiveis.reduce((acc, [, nomes]) =>
                  acc + nomes.filter(n => (qtds[n]||0) > 0).length, 0);
                // 30px = minHeight 28 + gap 2 (uma linha da lista de disponíveis)
                const folga = selecionadosVisiveis * 30;
                return folga > 0 ? <div style={{ height: folga, flexShrink: 0 }} aria-hidden="true" /> : null;
              })()}
            </div>
          </div>

          {/* Resumo Cálculo — só aparece quando tem cômodos */}
          <div className="vk-orc-resumo-col" style={{ position:"sticky", top:24 }}>
            {temComodos && calculo && (
              <div>
                <div style={C.resumoBox}>
                  <div style={C.resumoHdr}>Resumo Cálculo</div>
                  <AreaDetalhe calculo={calculo} fmtNum={fmtNum} />
                  <ResumoDetalhes calculo={{
                    ...calculo,
                    precoArq:   incluiArq ? calculo.precoArq : 0,
                    precoEng:   incluiEng ? calculo.precoEng : 0,
                    precoM2Arq: incluiArq ? calculo.precoM2Arq : 0,
                    precoM2Eng: incluiEng ? calculo.precoM2Eng : 0,
                  }} fmtNum={fmtNum} C={C} temImposto={temImposto} aliqImp={aliqImp} />
                </div>
                <button
                  style={{ width:"100%", marginTop:10, background:"#111", color:"#fff", border:"1px solid #111", borderRadius:8, padding:"11px 16px", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit", letterSpacing:0.2, transition:"background 0.15s, border-color 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background="#000"; }}
                  onMouseLeave={e => { e.currentTarget.style.background="#111"; }}
                  onClick={gerarProposta}>
                  Gerar Orçamento →
                </button>
              </div>
            )}
          </div>

        </div>
      )}

      {(() => {
        if (calculo) {
          const _arqV = calculo.precoArq;
          const _engV = calculo.precoEng;
          const _totSI = _arqV + _engV;
          const _totCI = temImposto ? Math.round(_totSI/(1-aliqImp/100)*100)/100 : _totSI;
          const _impostoV = temImposto ? Math.round((_totCI-_totSI)*100)/100 : 0;
          window.__obraModalVals = { totSI: _totSI, totCI: _totCI, impostoV: _impostoV };
        }
        return null;
      })()}

      {/* Popover global da trilha horizontal (position fixed, gruda no botão clicado) */}
      {trilhaHPop && (
        <div
          className="vk-trilha-h-pop"
          style={{ top: trilhaHPop.top, left: trilhaHPop.left }}
          onClick={e => e.stopPropagation()}>
          {(OPCOES[trilhaHPop.key] || []).map((op, i) => {
            const sel = VALS[trilhaHPop.key] === op;
            const focada = trilhaHPopFocada === i;
            return (
              <button
                key={op}
                className={"vk-trilha-h-pop-row" + (sel ? " is-selected" : "") + (focada ? " is-focused-kb" : "")}
                onClick={() => {
                  SETS[trilhaHPop.key](op);
                  setTrilhaHPop(null);
                }}>
                <span className="vk-trilha-h-pop-bullet"></span>
                <span style={{ flex:1, fontWeight:500 }}>{displayOpcao(trilhaHPop.key, op)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Modal "Deseja salvar?" ao voltar com dados preenchidos */}
      {showSaveDialog && (
        <div
          onClick={() => { setShowSaveDialog(false); pendingNavRef.current = null; }}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:"#fff", borderRadius:12, padding:"28px 28px 20px", maxWidth:420, width:"90%", boxShadow:"0 8px 32px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize:16, fontWeight:700, color:"#111", marginBottom:8 }}>Salvar este orçamento?</div>
            <div style={{ fontSize:13, color:"#6b7280", marginBottom:12, lineHeight:1.5 }}>
              Você iniciou um orçamento mas ainda não finalizou. Deseja salvá-lo como rascunho para continuar depois?
            </div>
            <div style={{
              display:"flex", alignItems:"flex-start", gap:8,
              background:"#fffbeb", border:"1px solid #fde68a",
              borderRadius:8, padding:"9px 12px", marginBottom:20,
              fontSize:12, color:"#92400e", lineHeight:1.45,
            }}>
              <span style={{ fontSize:14, lineHeight:1 }}>⏱</span>
              <span>
                <strong>Rascunhos expiram em 3 dias.</strong> Se não for editado ou finalizado até lá, será excluído automaticamente.
              </span>
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end", flexWrap:"wrap" }}>
              <button
                onClick={() => { setShowSaveDialog(false); pendingNavRef.current = null; }}
                style={{ background:"#fff", color:"#6b7280", border:"1px solid #d1d5db", borderRadius:8, padding:"9px 16px", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
                Cancelar
              </button>
              <button
                onClick={descartarEVoltar}
                style={{ background:"#fff", color:"#b91c1c", border:"1px solid #fecaca", borderRadius:8, padding:"9px 16px", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
                Descartar
              </button>
              <button
                onClick={salvarRascunhoEVoltar}
                style={{ background:"#111", color:"#fff", border:"none", borderRadius:8, padding:"9px 18px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                Salvar rascunho
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

