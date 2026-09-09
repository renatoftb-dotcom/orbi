// ══════════════════════════════════════════════════════════════
// COTAÇÕES DE FORNECEDORES — motor
// ══════════════════════════════════════════════════════════════
// O escritório abre uma cotação ("Esquadrias de alumínio"), registra as
// propostas que recebeu de cada fornecedor, compara lado a lado e escolhe
// uma. Quando a cotação exige aval do cliente, ele aprova ou recusa no
// ambiente dele; depois disso o escritório lança a escolhida em contas a
// pagar, e o valor entra no P&L pela conta que a cotação carrega.
//
// Onde os dados moram:
//   obra.cotacoes[]          — a cotação inteira, escrita SÓ pelo escritório
//   obra.aprovacoesCotacao[] — a decisão do cliente, escrita SÓ por ele
//
// São dois campos de propósito. O backend libera para o cliente apenas o
// segundo (lista branca do POST /api/obras), então ele não consegue mexer
// em valor, fornecedor ou escolha — só dizer sim ou não. É o mesmo desenho
// dos aceites de contrato.

const COT_SEM_APROVACAO = { status: "pendente" };

function cotacaoVazia(obraId) {
  return {
    id: (typeof uid === "function" ? uid() : String(Date.now())),
    obraId,
    criadaEm: new Date().toISOString(),
    titulo: "",
    escopo: "",
    contaId: (typeof PLANO_CONTAS !== "undefined" && PLANO_CONTAS[0] ? PLANO_CONTAS[0].id : "material"),
    etapaId: "",
    quantidade: "",
    unidade: "",
    prazoResposta: "",
    precisaAprovacaoCliente: true,
    status: "aberta",       // aberta | decidida | cancelada
    escolhidaId: "",
    decididaEm: "",
    contaGeradaId: "",
    propostas: [],
  };
}

function propostaVazia() {
  return {
    id: (typeof uid === "function" ? uid() : String(Date.now())),
    fornecedorId: "",
    favorecido: "",
    valor: "",
    prazoDias: "",
    condicaoPagamento: "",
    validade: "",
    observacao: "",
    recebidaEm: (typeof dataParaIso === "function" ? dataParaIso(new Date()) : ""),
  };
}

// Número de campo de formulário: aceita "12.500,90", "12500.90" e number.
// Mesma leitura usada nos contratos — não reimplementar aqui.
function valorProposta(p) {
  const v = (p || {}).valor;
  if (typeof numeroDeCampo === "function") return numeroDeCampo(v);
  const n = parseFloat(String(v == null ? "" : v).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function propostasDaCotacao(cot) {
  return ((cot || {}).propostas || []).filter(p => p && p.id);
}

// Da mais barata para a mais cara. Proposta sem valor vai para o fim: ela
// ainda não é comparável, e deixá-la em primeiro faria a "mais barata"
// mentir.
function propostasOrdenadas(cot) {
  return propostasDaCotacao(cot).slice().sort((a, b) => {
    const va = valorProposta(a), vb = valorProposta(b);
    if (va <= 0 && vb <= 0) return 0;
    if (va <= 0) return 1;
    if (vb <= 0) return -1;
    return va - vb;
  });
}

function propostaPorId(cot, id) {
  return propostasDaCotacao(cot).find(p => p.id === id) || null;
}

function propostaEscolhida(cot) {
  return propostaPorId(cot, (cot || {}).escolhidaId);
}

function melhorProposta(cot) {
  const ord = propostasOrdenadas(cot).filter(p => valorProposta(p) > 0);
  return ord[0] || null;
}

// Quanto a escolha economiza em relação à proposta mais cara recebida.
// Com uma proposta só não há economia a declarar — comparar consigo mesma
// daria zero e ocuparia espaço à toa, então devolve null.
function economiaDaCotacao(cot) {
  const vals = propostasDaCotacao(cot).map(valorProposta).filter(v => v > 0);
  if (vals.length < 2) return null;
  const menor = Math.min(...vals), maior = Math.max(...vals);
  const esc = propostaEscolhida(cot);
  const referencia = esc && valorProposta(esc) > 0 ? valorProposta(esc) : menor;
  return { menor, maior, referencia, economia: maior - referencia };
}

// ── A decisão do cliente ────────────────────────────────────────
function aprovacaoDaCotacao(aprovacoes, cotacaoId) {
  return (aprovacoes || []).find(a => a && a.cotacaoId === cotacaoId) || COT_SEM_APROVACAO;
}

// Substitui a decisão anterior da mesma cotação — o cliente pode mudar de
// ideia enquanto o escritório não lançou a conta.
function registrarAprovacaoCotacao(aprovacoes, dados) {
  const limpa = (aprovacoes || []).filter(a => a && a.cotacaoId !== dados.cotacaoId);
  return limpa.concat([{
    cotacaoId: dados.cotacaoId,
    propostaId: dados.propostaId || "",
    status: dados.status === "recusada" ? "recusada" : "aprovada",
    motivo: dados.motivo || "",
    por: dados.por || "Cliente",
    em: new Date().toISOString(),
  }]);
}

// ── Situação, em uma palavra ────────────────────────────────────
// A ordem dos testes é a ordem do fluxo; o primeiro que casar manda.
function situacaoCotacao(cot, aprovacoes) {
  const c = cot || {};
  const ap = aprovacaoDaCotacao(aprovacoes, c.id);
  if (c.status === "cancelada")            return { id: "cancelada",  rotulo: "Cancelada",                 cor: "#9ca3af" };
  if (c.contaGeradaId)                     return { id: "lancada",    rotulo: "Lançada em contas a pagar", cor: "#15803d" };
  if (ap.status === "recusada")            return { id: "recusada",   rotulo: "Recusada pelo cliente",     cor: "#dc2626" };
  if (ap.status === "aprovada")            return { id: "aprovada",   rotulo: "Aprovada pelo cliente",     cor: "#15803d" };
  if (!c.escolhidaId && !propostasDaCotacao(c).length)
                                           return { id: "coletando",  rotulo: "Aguardando propostas",      cor: "#b45309" };
  if (!c.escolhidaId)                      return { id: "comparando", rotulo: "Comparando propostas",      cor: "#0474f4" };
  if (c.precisaAprovacaoCliente)           return { id: "aguardando", rotulo: "Aguardando o cliente",      cor: "#b45309" };
  return { id: "escolhida", rotulo: "Escolhida", cor: "#15803d" };
}

// Só entra em contas a pagar o que já tem escolha e, quando exigido, o
// aval do cliente. Devolve o motivo do bloqueio para a tela poder explicar.
function podeLancarCotacao(cot, aprovacoes) {
  const c = cot || {};
  if (c.status === "cancelada")  return { pode: false, motivo: "A cotação foi cancelada." };
  if (c.contaGeradaId)           return { pode: false, motivo: "Já foi lançada em contas a pagar." };
  const esc = propostaEscolhida(c);
  if (!esc)                      return { pode: false, motivo: "Escolha uma proposta primeiro." };
  if (valorProposta(esc) <= 0)   return { pode: false, motivo: "A proposta escolhida está sem valor." };
  const ap = aprovacaoDaCotacao(aprovacoes, c.id);
  if (c.precisaAprovacaoCliente && ap.status === "recusada") return { pode: false, motivo: "O cliente recusou esta escolha." };
  if (c.precisaAprovacaoCliente && ap.status !== "aprovada") return { pode: false, motivo: "Aguardando a aprovação do cliente." };
  return { pode: true, motivo: "" };
}

// A conta avulsa que nasce da cotação escolhida. Vence no prazo de
// resposta quando houver, senão hoje — o escritório ajusta na baixa.
function contaDaCotacao(cot, hoje) {
  const c = cot || {};
  const esc = propostaEscolhida(c);
  if (!esc) return null;
  const base = typeof contaAvulsaVazia === "function" ? contaAvulsaVazia(c.obraId) : { id: (typeof uid === "function" ? uid() : "c1"), obraId: c.obraId };
  return {
    ...base,
    origem: "cotacao",
    cotacaoId: c.id,
    contaId: c.contaId || base.contaId,
    prestadorId: esc.fornecedorId || "",
    favorecido: esc.favorecido || "",
    descricao: c.titulo || "Cotação",
    valor: valorProposta(esc),
    vencimento: c.prazoResposta || hoje || base.vencimento,
    observacao: esc.condicaoPagamento ? `Condição: ${esc.condicaoPagamento}` : "",
  };
}

// Contadores do cartão da obra e do topo da tela.
function resumoCotacoes(cotacoes, aprovacoes) {
  const lista = (cotacoes || []).filter(c => c && c.id);
  const r = { total: lista.length, abertas: 0, aguardandoCliente: 0, aprovadas: 0, recusadas: 0, lancadas: 0, economia: 0 };
  for (const c of lista) {
    const s = situacaoCotacao(c, aprovacoes);
    if (s.id === "coletando" || s.id === "comparando") r.abertas++;
    if (s.id === "aguardando")  r.aguardandoCliente++;
    if (s.id === "aprovada")    r.aprovadas++;
    if (s.id === "recusada")    r.recusadas++;
    if (s.id === "lancada")     r.lancadas++;
    if (s.id === "aprovada" || s.id === "lancada") {
      const e = economiaDaCotacao(c);
      if (e && e.economia > 0) r.economia += e.economia;
    }
  }
  return r;
}

// O que o cliente precisa olhar agora: escolha feita, aval pendente.
function cotacoesAguardandoCliente(cotacoes, aprovacoes) {
  return (cotacoes || []).filter(c => situacaoCotacao(c, aprovacoes).id === "aguardando");
}

function nomeDoFornecedor(prestadores, id) {
  const f = (prestadores || []).find(p => p && p.id === id);
  return f ? f.nome : "";
}

// ══════════════════════════════════════════════════════════════
// UI — bloco de cotações da obra
// ══════════════════════════════════════════════════════════════
// A MESMA tela serve o escritório e o cliente: o ambiente do cliente
// reaproveita o painel da obra inteiro. O que muda é `podeGerenciar`
// (perm.podeGerenciarObra) — sem ele somem criar, editar, escolher e
// lançar, e aparecem os botões de aprovar e recusar.

const COT_ESTILO = {
  wrap:  { border: "1px solid rgba(38,36,33,0.14)", borderRadius: 16, padding: 16, marginBottom: 20 },
  card:  { border: "1px solid rgba(38,36,33,0.12)", borderRadius: 14, background: "#fff", marginBottom: 10 },
  input: { border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 10, padding: "8px 11px", fontSize: 13, color: "#111827", outline: "none", background: "#fff", fontFamily: "inherit", width: "100%", boxSizing: "border-box" },
  label: { fontSize: 11.5, color: "#4b5563", fontWeight: 600, display: "block", marginBottom: 4 },
  btn:   { background: "#111827", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  btnSec:{ background: "#fff", color: "#111827", border: "1.5px solid rgba(38,36,33,0.16)", borderRadius: 10, padding: "8px 14px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" },
  quadro:{ border: "1px solid rgba(38,36,33,0.12)", borderRadius: 12, padding: "10px 12px", background: "#fff" },
};

function selo(cor, texto) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: cor + "18", color: cor, whiteSpace: "nowrap" }}>{texto}</span>
  );
}

function CotacoesObraView({ obra, obras, data, save, onObraAtualizada, isMobile, onVoltar, usuario }) {
  const perm = getPermissoes();
  const podeGerenciar = !!perm.podeGerenciarObra;
  const E = COT_ESTILO;
  const prestadores = (data.fornecedores || []).filter(f => f && f.ativo !== false);
  const cotacoes = obra.cotacoes || [];
  const aprovacoes = obra.aprovacoesCotacao || [];
  const hoje = typeof dataParaIso === "function" ? dataParaIso(new Date()) : "";
  const dinheiro = (v) => (typeof fmtMoedaCtr === "function" ? fmtMoedaCtr(v) : "R$ " + Number(v || 0).toFixed(2));

  const [abertas, setAbertas] = useState({});
  const [formCotacao, setFormCotacao] = useState(null);
  const [formProposta, setFormProposta] = useState(null); // { cotacaoId, proposta }
  const [formDecisao, setFormDecisao] = useState(null);   // { cotacao, status }
  const [erro, setErro] = useState("");

  // Grava a obra sem encostar nas obras dos outros clientes: `obras` aqui é
  // só a fatia deste cliente, então mesclar é obrigatório (substituir a
  // coleção inteira pela fatia apagaria as demais no backend).
  function gravar(obraNova) {
    const fatia = (obras || []).map(o => (o.id === obra.id ? obraNova : o));
    const todas = typeof mesclarPorCliente === "function"
      ? mesclarPorCliente(data.obras, obra.clienteId, fatia)
      : (data.obras || []).map(o => (o.id === obra.id ? obraNova : o));
    save({ ...data, obras: todas });
    if (onObraAtualizada) onObraAtualizada(obraNova);
  }
  const gravarCotacoes = (lista) => gravar({ ...obra, cotacoes: lista });
  const trocarCotacao = (id, muda) => gravarCotacoes(cotacoes.map(c => (c.id === id ? muda(c) : c)));

  const resumo = resumoCotacoes(cotacoes, aprovacoes);

  // ── Formulário da cotação ─────────────────────────────────────
  function salvarCotacao() {
    const f = formCotacao;
    if (!String(f.titulo || "").trim()) { setErro("Dê um nome à cotação (ex.: Esquadrias de alumínio)."); return; }
    setErro("");
    const existe = cotacoes.some(c => c.id === f.id);
    gravarCotacoes(existe ? cotacoes.map(c => (c.id === f.id ? f : c)) : cotacoes.concat([f]));
    setFormCotacao(null);
  }

  if (formCotacao) {
    const contas = typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : [];
    const etapas = typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : [];
    const set = (k, v) => setFormCotacao(f => ({ ...f, [k]: v }));
    return (
      <div style={E.wrap}>
        <button onClick={() => { setFormCotacao(null); setErro(""); }} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontFamily: "inherit", fontSize: 12, marginBottom: 16 }}>← Voltar</button>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{cotacoes.some(c => c.id === formCotacao.id) ? "Editar cotação" : "Nova cotação"}</div>
        <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 18 }}>O que você vai pedir preço para os fornecedores.</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={E.label}>O que está sendo cotado</label>
            <input style={E.input} value={formCotacao.titulo} onChange={e => set("titulo", e.target.value)} placeholder="Esquadrias de alumínio" />
          </div>
          <div>
            <label style={E.label}>Conta do P&amp;L</label>
            <select style={E.input} value={formCotacao.contaId} onChange={e => set("contaId", e.target.value)}>
              {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={E.label}>Escopo — o que o fornecedor precisa saber para orçar</label>
          <textarea style={{ ...E.input, minHeight: 74, resize: "vertical" }} value={formCotacao.escopo} onChange={e => set("escopo", e.target.value)}
            placeholder="Janelas de correr, linha 25, vidro temperado 6mm, com instalação." />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={E.label}>Quantidade</label>
            <input style={E.input} value={formCotacao.quantidade} onChange={e => set("quantidade", e.target.value)} placeholder="12" />
          </div>
          <div>
            <label style={E.label}>Unidade</label>
            <input style={E.input} value={formCotacao.unidade} onChange={e => set("unidade", e.target.value)} placeholder="un / m² / vb" />
          </div>
          <div>
            <label style={E.label}>Etapa da obra</label>
            <select style={E.input} value={formCotacao.etapaId} onChange={e => set("etapaId", e.target.value)}>
              <option value="">—</option>
              {etapas.map(et => <option key={et.id} value={et.id}>{et.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={E.label}>Responder até</label>
            <input style={E.input} type="date" value={formCotacao.prazoResposta} onChange={e => set("prazoResposta", e.target.value)} />
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#111827", marginBottom: 18, cursor: "pointer" }}>
          <input type="checkbox" checked={!!formCotacao.precisaAprovacaoCliente} onChange={e => set("precisaAprovacaoCliente", e.target.checked)} />
          O cliente precisa aprovar a escolha antes de virar conta a pagar
        </label>
        {erro && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 12 }}>{erro}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button style={E.btn} onClick={salvarCotacao}>Salvar cotação</button>
          <button style={E.btnSec} onClick={() => { setFormCotacao(null); setErro(""); }}>Cancelar</button>
        </div>
      </div>
    );
  }

  // ── Formulário da proposta recebida ───────────────────────────
  function salvarProposta() {
    const { cotacaoId, proposta } = formProposta;
    const nome = proposta.favorecido || nomeDoFornecedor(prestadores, proposta.fornecedorId);
    if (!String(nome || "").trim()) { setErro("Diga de quem é a proposta."); return; }
    setErro("");
    const p = { ...proposta, favorecido: nome };
    trocarCotacao(cotacaoId, c => {
      const lista = c.propostas || [];
      return { ...c, propostas: lista.some(x => x.id === p.id) ? lista.map(x => (x.id === p.id ? p : x)) : lista.concat([p]) };
    });
    setFormProposta(null);
  }

  if (formProposta) {
    const p = formProposta.proposta;
    const set = (k, v) => setFormProposta(f => ({ ...f, proposta: { ...f.proposta, [k]: v } }));
    return (
      <div style={E.wrap}>
        <button onClick={() => { setFormProposta(null); setErro(""); }} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontFamily: "inherit", fontSize: 12, marginBottom: 16 }}>← Voltar</button>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Proposta recebida</div>
        <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 18 }}>Registre o que o fornecedor respondeu.</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={E.label}>Fornecedor cadastrado</label>
            <select style={E.input} value={p.fornecedorId}
              onChange={e => { const id = e.target.value; setFormProposta(f => ({ ...f, proposta: { ...f.proposta, fornecedorId: id, favorecido: nomeDoFornecedor(prestadores, id) || f.proposta.favorecido } })); }}>
              <option value="">— outro —</option>
              {prestadores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={E.label}>Nome que vai na conta</label>
            <input style={E.input} value={p.favorecido} onChange={e => set("favorecido", e.target.value)} placeholder="MB Viezzer Serralheria" />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={E.label}>Valor</label>
            <input style={E.input} value={p.valor} onChange={e => set("valor", e.target.value)} placeholder="12.500,00" />
          </div>
          <div>
            <label style={E.label}>Prazo de entrega (dias)</label>
            <input style={E.input} value={p.prazoDias} onChange={e => set("prazoDias", e.target.value)} placeholder="30" />
          </div>
          <div>
            <label style={E.label}>Condição de pagamento</label>
            <input style={E.input} value={p.condicaoPagamento} onChange={e => set("condicaoPagamento", e.target.value)} placeholder="50% entrada, 50% entrega" />
          </div>
          <div>
            <label style={E.label}>Proposta válida até</label>
            <input style={E.input} type="date" value={p.validade} onChange={e => set("validade", e.target.value)} />
          </div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={E.label}>Observação</label>
          <input style={E.input} value={p.observacao} onChange={e => set("observacao", e.target.value)} placeholder="Não inclui a instalação." />
        </div>
        {erro && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 12 }}>{erro}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button style={E.btn} onClick={salvarProposta}>Salvar proposta</button>
          <button style={E.btnSec} onClick={() => { setFormProposta(null); setErro(""); }}>Cancelar</button>
        </div>
      </div>
    );
  }

  // ── Aprovar / recusar (cliente) ───────────────────────────────
  function confirmarDecisao(motivo) {
    const { cotacao, status } = formDecisao;
    const quem = usuario?.nome || usuario?.email || "Cliente";
    const novas = registrarAprovacaoCotacao(aprovacoes, { cotacaoId: cotacao.id, propostaId: cotacao.escolhidaId, status, motivo, por: quem });
    gravar({ ...obra, aprovacoesCotacao: novas });
    setFormDecisao(null);
  }

  // ── Lançar em contas a pagar (escritório) ─────────────────────
  function lancar(cot) {
    const trava = podeLancarCotacao(cot, aprovacoes);
    if (!trava.pode) { setErro(trava.motivo); return; }
    setErro("");
    const conta = contaDaCotacao(cot, hoje);
    gravar({
      ...obra,
      contasPagar: (obra.contasPagar || []).concat([conta]),
      cotacoes: cotacoes.map(c => (c.id === cot.id ? { ...c, status: "decidida", contaGeradaId: conta.id } : c)),
    });
  }

  // ── Lista ─────────────────────────────────────────────────────
  const quadro = (rotulo, valor, cor) => (
    <div style={E.quadro}>
      <div style={{ fontSize: 10.5, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{rotulo}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: cor || "#111827", marginTop: 2 }}>{valor}</div>
    </div>
  );

  return (
    <div style={E.wrap}>
      <button onClick={onVoltar} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontFamily: "inherit", fontSize: 12, marginBottom: 16 }}>← Voltar</button>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Cotações</div>
          <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>{obra.nome}</div>
        </div>
        {podeGerenciar && (
          <button style={E.btn} onClick={() => { setErro(""); setFormCotacao(cotacaoVazia(obra.id)); }}>+ Nova cotação</button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        {quadro("Em andamento", resumo.abertas)}
        {quadro(podeGerenciar ? "Aguardando o cliente" : "Aguardando você", resumo.aguardandoCliente, resumo.aguardandoCliente > 0 ? "#b45309" : "#111827")}
        {quadro("Aprovadas", resumo.aprovadas + resumo.lancadas)}
        {quadro("Economia", dinheiro(resumo.economia), resumo.economia > 0 ? "#15803d" : "#111827")}
      </div>

      {erro && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 12 }}>{erro}</div>}

      {!cotacoes.length ? (
        <div style={{ textAlign: "center", padding: "44px 20px", fontSize: 13, color: "#4b5563" }}>
          {podeGerenciar
            ? "Nenhuma cotação nesta obra. Abra uma para começar a comparar preços."
            : "Nenhuma cotação nesta obra por enquanto."}
        </div>
      ) : cotacoes.map(cot => {
        const s = situacaoCotacao(cot, aprovacoes);
        const ap = aprovacaoDaCotacao(aprovacoes, cot.id);
        const props = propostasOrdenadas(cot);
        const esc = propostaEscolhida(cot);
        const melhor = melhorProposta(cot);
        const eco = economiaDaCotacao(cot);
        const conta = typeof contaPorId === "function" ? contaPorId(cot.contaId) : null;
        const aberto = !!abertas[cot.id];
        const trava = podeLancarCotacao(cot, aprovacoes);
        return (
          <div key={cot.id} style={E.card}>
            <button onClick={() => setAbertas(a => ({ ...a, [cot.id]: !a[cot.id] }))}
              style={{ width: "100%", background: "none", border: "none", padding: "12px 14px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 160, fontSize: 13.5, fontWeight: 700, color: "#111827" }}>{cot.titulo || "Cotação sem nome"}</div>
                {selo(s.cor, s.rotulo)}
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#111827" }}>
                  {esc ? dinheiro(valorProposta(esc)) : melhor ? `a partir de ${dinheiro(valorProposta(melhor))}` : "—"}
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 3 }}>
                {(conta ? conta.nome + " · " : "")}{props.length === 1 ? "1 proposta" : `${props.length} propostas`}
                {cot.prazoResposta ? ` · responder até ${cot.prazoResposta.split("-").reverse().join("/")}` : ""}
              </div>
            </button>

            {aberto && (
              <div style={{ borderTop: "1px solid rgba(38,36,33,0.08)", padding: "12px 14px" }}>
                {cot.escopo && <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 12, whiteSpace: "pre-wrap" }}>{cot.escopo}</div>}
                {(cot.quantidade || cot.unidade) && (
                  <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 12 }}>Quantidade: {cot.quantidade} {cot.unidade}</div>
                )}

                {!props.length ? (
                  <div style={{ fontSize: 12.5, color: "#4b5563", marginBottom: 12 }}>Nenhuma proposta registrada ainda.</div>
                ) : (
                  <div style={{ overflowX: "auto", marginBottom: 12 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 520 }}>
                      <thead>
                        <tr style={{ textAlign: "left", color: "#6b7280" }}>
                          <th style={{ padding: "6px 8px", fontWeight: 600 }}>Fornecedor</th>
                          <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>Valor</th>
                          <th style={{ padding: "6px 8px", fontWeight: 600 }}>Prazo</th>
                          <th style={{ padding: "6px 8px", fontWeight: 600 }}>Condição</th>
                          {podeGerenciar && <th style={{ padding: "6px 8px", fontWeight: 600 }}></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {props.map(p => {
                          const escolhida = p.id === cot.escolhidaId;
                          const maisBarata = melhor && p.id === melhor.id;
                          return (
                            <tr key={p.id} style={{ borderTop: "1px solid rgba(38,36,33,0.08)", background: escolhida ? "#f0f7ff" : "transparent" }}>
                              <td style={{ padding: "8px" }}>
                                <div style={{ fontWeight: escolhida ? 700 : 500, color: "#111827" }}>{p.favorecido || "—"}</div>
                                <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                                  {escolhida && selo("#0474f4", "Escolhida")}
                                  {maisBarata && !escolhida && selo("#15803d", "Mais barata")}
                                </div>
                                {p.observacao && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{p.observacao}</div>}
                              </td>
                              <td style={{ padding: "8px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{valorProposta(p) > 0 ? dinheiro(valorProposta(p)) : "—"}</td>
                              <td style={{ padding: "8px", whiteSpace: "nowrap" }}>{p.prazoDias ? `${p.prazoDias} dias` : "—"}</td>
                              <td style={{ padding: "8px" }}>{p.condicaoPagamento || "—"}</td>
                              {podeGerenciar && (
                                <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                                  {!cot.contaGeradaId && (
                                    <button style={{ ...E.btnSec, padding: "5px 10px", fontSize: 11.5, marginRight: 6 }}
                                      onClick={() => trocarCotacao(cot.id, c => ({ ...c, escolhidaId: escolhida ? "" : p.id }))}>
                                      {escolhida ? "Desfazer" : "Escolher"}
                                    </button>
                                  )}
                                  <button style={{ ...E.btnSec, padding: "5px 10px", fontSize: 11.5 }}
                                    onClick={() => { setErro(""); setFormProposta({ cotacaoId: cot.id, proposta: p }); }}>Editar</button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {eco && eco.economia > 0 && (
                  <div style={{ fontSize: 12, color: "#15803d", marginBottom: 12 }}>
                    Economia de {dinheiro(eco.economia)} em relação à proposta mais cara ({dinheiro(eco.maior)}).
                  </div>
                )}

                {ap.status !== "pendente" && (
                  <div style={{ fontSize: 12, color: ap.status === "aprovada" ? "#15803d" : "#dc2626", marginBottom: 12 }}>
                    {ap.status === "aprovada" ? "Aprovada" : "Recusada"} por {ap.por} em {new Date(ap.em).toLocaleDateString("pt-BR")}
                    {ap.motivo ? ` — ${ap.motivo}` : ""}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {podeGerenciar && !cot.contaGeradaId && (
                    <>
                      <button style={E.btnSec} onClick={() => { setErro(""); setFormProposta({ cotacaoId: cot.id, proposta: propostaVazia() }); }}>+ Registrar proposta</button>
                      <button style={E.btnSec} onClick={() => { setErro(""); setFormCotacao(cot); }}>Editar cotação</button>
                      <button style={{ ...E.btn, opacity: trava.pode ? 1 : 0.45 }} onClick={() => lancar(cot)}>Lançar em contas a pagar</button>
                      {!trava.pode && <span style={{ fontSize: 11.5, color: "#6b7280", alignSelf: "center" }}>{trava.motivo}</span>}
                    </>
                  )}
                  {!podeGerenciar && s.id === "aguardando" && (
                    <>
                      <button style={E.btn} onClick={() => setFormDecisao({ cotacao: cot, status: "aprovada" })}>Aprovar</button>
                      <button style={E.btnSec} onClick={() => setFormDecisao({ cotacao: cot, status: "recusada" })}>Recusar</button>
                    </>
                  )}
                  {podeGerenciar && cot.contaGeradaId && (
                    <span style={{ fontSize: 12, color: "#15803d", alignSelf: "center" }}>Já está em contas a pagar.</span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {formDecisao && (
        <CotacaoDecisao
          cotacao={formDecisao.cotacao}
          status={formDecisao.status}
          dinheiro={dinheiro}
          onConfirmar={confirmarDecisao}
          onFechar={() => setFormDecisao(null)}
        />
      )}
    </div>
  );
}

// Telinha de aprovar/recusar. Fica separada para o motivo ter estado
// próprio — dentro da lista, cada tecla digitada rerenderizaria tudo.
function CotacaoDecisao({ cotacao, status, dinheiro, onConfirmar, onFechar }) {
  const [motivo, setMotivo] = useState("");
  const E = COT_ESTILO;
  const esc = propostaEscolhida(cotacao);
  const aprovar = status === "aprovada";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 60 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 420 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
          {aprovar ? "Aprovar esta escolha" : "Recusar esta escolha"}
        </div>
        <div style={{ fontSize: 12.5, color: "#4b5563", marginBottom: 14 }}>
          {cotacao.titulo} — {esc ? `${esc.favorecido}, ${dinheiro(valorProposta(esc))}` : "sem proposta escolhida"}.
        </div>
        <label style={E.label}>{aprovar ? "Observação (opcional)" : "Por que está recusando?"}</label>
        <textarea style={{ ...E.input, minHeight: 64, resize: "vertical", marginBottom: 16 }} value={motivo} onChange={e => setMotivo(e.target.value)} />
        <div style={{ display: "flex", gap: 10 }}>
          <button style={E.btn} onClick={() => onConfirmar(motivo)}>{aprovar ? "Aprovar" : "Recusar"}</button>
          <button style={E.btnSec} onClick={onFechar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
