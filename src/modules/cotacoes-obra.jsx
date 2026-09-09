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
    anexo: null,          // { url, public_id, nome, bytes, formato, resourceType }
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

// ── Apagar ──────────────────────────────────────────────────────
// Duas exclusões, com pesos diferentes: tirar um fornecedor que entrou
// errado é correção de rotina; apagar a cotação inteira leva junto a
// decisão que o cliente já registrou. As duas param no mesmo lugar — o que
// virou conta a pagar tem um lançamento financeiro do outro lado e não
// pode sumir por aqui.
function podeExcluirCotacao(cot) {
  const c = cot || {};
  if (c.contaGeradaId) return { pode: false, motivo: "Já foi lançada em contas a pagar — cancele a conta primeiro." };
  return { pode: true, motivo: "" };
}

// Tira uma proposta da cotação. Se era a escolhida, a cotação volta a não
// ter escolha: manter o id apontaria para uma proposta que não existe mais,
// e o card diria "Escolhida" sem ninguém marcado.
function removerProposta(cotacao, propostaId) {
  const c = cotacao || {};
  const restantes = propostasDaCotacao(c).filter(p => p.id !== propostaId);
  return {
    ...c,
    propostas: restantes,
    escolhidaId: c.escolhidaId === propostaId ? "" : (c.escolhidaId || ""),
  };
}

// Tira a cotação inteira. A decisão do cliente vai junto — guardada, ficaria
// órfã na obra e voltaria a valer se um dia outra cotação nascesse com o
// mesmo id.
function removerCotacao(cotacoes, aprovacoes, cotacaoId) {
  return {
    cotacoes: (cotacoes || []).filter(c => c && c.id !== cotacaoId),
    aprovacoes: (aprovacoes || []).filter(a => a && a.cotacaoId !== cotacaoId),
  };
}

// Os anexos que saem do ar junto com o que foi apagado. Devolve os
// public_id para a tela tentar limpar o storage — best-effort: o arquivo
// já não está mais em lugar nenhum da obra de qualquer jeito.
function anexosDasPropostas(propostas) {
  return (propostas || [])
    .map(p => p && p.anexo && p.anexo.public_id)
    .filter(Boolean);
}

// ── Cadastro de prestador na hora ───────────────────────────────
// Antes, fornecedor fora do cadastro virava "— outro —": o nome ia no campo
// ao lado e ficava só ali, sem CNPJ, sem contato, sem virar contratado de
// contrato depois. Agora o próprio formulário da proposta cadastra.
//
// Os campos são os mesmos do cadastro rápido do gerador de contratos — quem
// cadastra aqui já serve para contrato, sem redigitar.
// Todo PDF começa com "%PDF-". Compressor online que devolveu uma página de
// erro, arquivo cortado no meio do upload, imagem renomeada — tudo isso passa
// pela validação de mimetype (que olha a extensão) e só aparece aqui.
// Sem esta checagem o visor monta um iframe vazio e o usuário fica sem saber
// se o problema é o arquivo, a internet ou o sistema.
function pareceMesmoPdf(bytes) {
  const b = bytes || [];
  if (b.length < 5) return false;
  return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d; // %PDF-
}

function prestadorRapidoVazio() {
  return {
    // "Outro" e não a primeira da lista: a primeira é "Carpinteiro", e sair
    // daqui com um ofício que ninguém escolheu é pior que sair sem ofício —
    // é por essa categoria que o gerador de contratos filtra os contratados.
    nome: "", tipo: "PJ", categoria: "Outro",
    cnpjCpf: "", telefone: "", email: "",
    cep: "", logradouro: "", numero: "", bairro: "", cidade: "", estado: "SP",
    representanteNome: "", representanteCpf: "",
  };
}

// O registro que entra em data.fornecedores. Só o nome é obrigatório: o
// resto se completa depois em Prestadores de Serviços, e exigir CNPJ na
// hora de lançar uma proposta faria o usuário voltar ao "outro" de antes.
function criarPrestadorRapido(campos, novoId) {
  const c = campos || {};
  const nome = String(c.nome || "").trim();
  if (!nome) return null;
  return {
    ...prestadorRapidoVazio(), ...c, nome,
    id: novoId, ativo: true, criadoEm: new Date().toISOString(),
    origem: "cotacao",
  };
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

// ── O anexo da proposta ─────────────────────────────────────────
// O arquivo NÃO mora na obra. A obra é gravada como um documento JSON
// inteiro a cada save; um PDF embutido ali subiria de novo em toda
// alteração e o app do cliente o baixaria em toda abertura. Vai para o
// mesmo storage do logo e da capa, e a proposta guarda só o endereço.
// 10 MB: é o teto do storage. Era 5, e proposta de fornecedor com plantas
// escaneadas passa disso com facilidade — o usuário ia comprimir por fora e
// voltava com arquivo quebrado. Foto de proposta continua sendo reduzida
// aqui antes de subir, então quem chega perto do teto é PDF.
const COT_ANEXO_MAX = 10 * 1024 * 1024;
const COT_IMG_LADO_MAX = 1600;      // foto de proposta não precisa de mais
const COT_IMG_QUALIDADE = 0.72;

function ehPdf(arquivo) {
  return String((arquivo || {}).type || "") === "application/pdf"
      || /\.pdf$/i.test(String((arquivo || {}).name || ""));
}

function tamanhoLegivel(bytes) {
  const n = Number(bytes || 0);
  if (n <= 0) return "";
  return n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Foto de proposta vem da câmera do celular com 4 MB para um papel A4.
// Reduzir para 1600px e reencodar em JPEG deixa em torno de 200 KB sem
// prejuízo de leitura. PDF passa direto: é vetorial, já é leve, e virar
// imagem só engordaria o arquivo e perderia o texto.
function comprimirImagem(arquivo) {
  return new Promise((resolve) => {
    if (ehPdf(arquivo) || typeof document === "undefined" || typeof FileReader === "undefined") return resolve(arquivo);
    if (!/^image\//.test(String(arquivo.type || ""))) return resolve(arquivo);
    const leitor = new FileReader();
    leitor.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const escala = Math.min(1, COT_IMG_LADO_MAX / Math.max(img.width, img.height));
          if (escala >= 1 && arquivo.size <= 900 * 1024) return resolve(arquivo);
          const cv = document.createElement("canvas");
          cv.width = Math.round(img.width * escala);
          cv.height = Math.round(img.height * escala);
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          cv.toBlob((blob) => {
            // se a "compressão" engordou o arquivo, fica com o original
            if (!blob || blob.size >= arquivo.size) return resolve(arquivo);
            const nome = String(arquivo.name || "proposta").replace(/\.[^.]+$/, "") + ".jpg";
            resolve(new File([blob], nome, { type: "image/jpeg" }));
          }, "image/jpeg", COT_IMG_QUALIDADE);
        } catch (e) { resolve(arquivo); }
      };
      img.onerror = () => resolve(arquivo);
      img.src = leitor.result;
    };
    leitor.onerror = () => resolve(arquivo);
    leitor.readAsDataURL(arquivo);
  });
}

async function enviarAnexoProposta(arquivo) {
  if (!arquivo) return null;
  const pronto = await comprimirImagem(arquivo);
  if (pronto.size > COT_ANEXO_MAX) {
    throw new Error(`Arquivo muito grande (${tamanhoLegivel(pronto.size)}). O limite é 10 MB — se for um PDF escaneado, peça ao fornecedor a versão em PDF “normal”, que costuma ser bem menor.`);
  }
  const r = await api.uploads.send(pronto, "proposta_cotacao");
  return {
    url: r.url,
    public_id: r.public_id,
    nome: arquivo.name || r.nome || "proposta",
    bytes: r.bytes || pronto.size,
    formato: r.formato || (ehPdf(pronto) ? "pdf" : "jpg"),
    resourceType: r.resource_type || (ehPdf(pronto) ? "raw" : "image"),
    enviadoEm: new Date().toISOString(),
  };
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
  // Apagar a cotação inteira leva junto a decisão do cliente: é do admin.
  // Tirar um fornecedor que entrou errado é correção de rotina, e segue
  // com quem já edita a obra.
  const podeExcluir = podeGerenciar && !!perm.podeExcluir;
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
  const [novoPrestador, setNovoPrestador] = useState(null); // objeto quando o cadastro está aberto
  const [visor, setVisor] = useState(null);                 // anexo aberto na janela
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

  // ── Cadastro do prestador, sem sair da proposta ───────────────
  async function buscarCepPrestador(cepBruto) {
    const limpo = String(cepBruto || "").replace(/\D/g, "");
    if (limpo.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const d = await r.json();
      if (!d.erro) setNovoPrestador(f => f && ({ ...f, logradouro: d.logradouro || f.logradouro, bairro: d.bairro || f.bairro, cidade: d.localidade || f.cidade, estado: d.uf || f.estado }));
    } catch (e) {}
  }

  function salvarNovoPrestador() {
    const registro = criarPrestadorRapido(novoPrestador, uid());
    if (!registro) { setErro("Diga o nome do prestador."); return; }
    setErro("");
    save({ ...data, fornecedores: [...(data.fornecedores || []), registro] });
    // já entra escolhido na proposta — é para isso que o usuário veio aqui
    setFormProposta(f => f && ({ ...f, proposta: { ...f.proposta, fornecedorId: registro.id, favorecido: registro.nome } }));
    setNovoPrestador(null);
  }

  // ── Formulário da proposta recebida ───────────────────────────
  function salvarProposta() {
    // Salvar a proposta com o cadastro aberto jogaria fora o que já foi
    // digitado nele, sem dizer nada.
    if (novoPrestador) { setErro("Termine o cadastro do prestador — salve ou cancele — antes de salvar a proposta."); return; }
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
        <button onClick={() => { setFormProposta(null); setNovoPrestador(null); setErro(""); }} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontFamily: "inherit", fontSize: 12, marginBottom: 16 }}>← Voltar</button>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Proposta recebida</div>
        <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 18 }}>Registre o que o fornecedor respondeu.</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={E.label}>Fornecedor cadastrado</label>
            <select style={E.input} value={p.fornecedorId} disabled={!!novoPrestador}
              onChange={e => {
                const id = e.target.value;
                // "cadastrar" não é um fornecedor: abre o cadastro e o select
                // volta para onde estava, senão ficaria mostrando a opção-ação
                if (id === "__novo__") { setErro(""); setNovoPrestador(prestadorRapidoVazio()); return; }
                setFormProposta(f => ({ ...f, proposta: { ...f.proposta, fornecedorId: id, favorecido: nomeDoFornecedor(prestadores, id) || f.proposta.favorecido } }));
              }}>
              <option value="">— nenhum —</option>
              {prestadores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              <option value="__novo__">＋ Cadastrar prestador</option>
            </select>
          </div>
          <div>
            <label style={E.label}>Nome que vai na conta</label>
            <input style={E.input} value={p.favorecido} onChange={e => set("favorecido", e.target.value)} placeholder="MB Viezzer Serralheria" />
          </div>
        </div>
        {novoPrestador && (
          <div style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 12, padding: 12, marginBottom: 14, background: "#fafafa" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827", marginBottom: 3 }}>Novo prestador de serviço</div>
            <div style={{ fontSize: 11.5, color: "#6b7280", marginBottom: 10 }}>
              Só o nome é obrigatório — o resto dá para completar depois em Prestadores de Serviços. Estes são os mesmos campos do contrato, então quem cadastra aqui já serve de contratado.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1.2fr", gap: 12, marginBottom: 12 }}>
              <div><label style={E.label}>Nome / razão social *</label>
                <input style={E.input} value={novoPrestador.nome} onChange={e => setNovoPrestador({ ...novoPrestador, nome: e.target.value })} placeholder="MB Viezzer Serralheria" /></div>
              <div><label style={E.label}>Pessoa</label>
                <select style={E.input} value={novoPrestador.tipo} onChange={e => setNovoPrestador({ ...novoPrestador, tipo: e.target.value })}>
                  <option value="PJ">Jurídica</option><option value="PF">Física</option>
                </select></div>
              <div><label style={E.label}>{novoPrestador.tipo === "PF" ? "CPF" : "CNPJ"}</label>
                <input style={E.input} value={novoPrestador.cnpjCpf} onChange={e => setNovoPrestador({ ...novoPrestador, cnpjCpf: e.target.value })} /></div>
              <div><label style={E.label}>Categoria</label>
                <select style={E.input} value={novoPrestador.categoria} onChange={e => setNovoPrestador({ ...novoPrestador, categoria: e.target.value })}>
                  {(typeof CATEGORIAS_PRESTADOR !== "undefined" ? CATEGORIAS_PRESTADOR : ["Outro"]).map(c => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div><label style={E.label}>Telefone</label>
                <input style={E.input} value={novoPrestador.telefone} onChange={e => setNovoPrestador({ ...novoPrestador, telefone: e.target.value })} /></div>
              <div><label style={E.label}>E-mail</label>
                <input style={E.input} value={novoPrestador.email} onChange={e => setNovoPrestador({ ...novoPrestador, email: e.target.value })} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr 0.8fr", gap: 12, marginBottom: 12 }}>
              <div><label style={E.label}>CEP</label>
                <input style={E.input} value={novoPrestador.cep} placeholder="00000-000"
                  onChange={e => { setNovoPrestador({ ...novoPrestador, cep: e.target.value }); buscarCepPrestador(e.target.value); }} /></div>
              <div><label style={E.label}>Logradouro</label>
                <input style={E.input} value={novoPrestador.logradouro} onChange={e => setNovoPrestador({ ...novoPrestador, logradouro: e.target.value })} /></div>
              <div><label style={E.label}>Número</label>
                <input style={E.input} value={novoPrestador.numero} onChange={e => setNovoPrestador({ ...novoPrestador, numero: e.target.value })} /></div>
              <div><label style={E.label}>Bairro</label>
                <input style={E.input} value={novoPrestador.bairro} onChange={e => setNovoPrestador({ ...novoPrestador, bairro: e.target.value })} /></div>
              <div><label style={E.label}>Cidade</label>
                <input style={E.input} value={novoPrestador.cidade} onChange={e => setNovoPrestador({ ...novoPrestador, cidade: e.target.value })} /></div>
              <div><label style={E.label}>UF</label>
                <input style={E.input} maxLength={2} value={novoPrestador.estado} onChange={e => setNovoPrestador({ ...novoPrestador, estado: e.target.value.toUpperCase().slice(0, 2) })} /></div>
            </div>
            {novoPrestador.tipo === "PJ" && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 12, marginBottom: 12 }}>
                <div><label style={E.label}>Representante legal</label>
                  <input style={E.input} value={novoPrestador.representanteNome} placeholder="quem assina pela empresa"
                    onChange={e => setNovoPrestador({ ...novoPrestador, representanteNome: e.target.value })} /></div>
                <div><label style={E.label}>CPF do representante</label>
                  <input style={E.input} value={novoPrestador.representanteCpf} onChange={e => setNovoPrestador({ ...novoPrestador, representanteCpf: e.target.value })} /></div>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button style={E.btn} onClick={salvarNovoPrestador}>Salvar prestador</button>
              <button style={E.btnSec} onClick={() => { setNovoPrestador(null); setErro(""); }}>Cancelar</button>
            </div>
          </div>
        )}
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
        <div style={{ marginBottom: 14 }}>
          <label style={E.label}>Observação</label>
          <input style={E.input} value={p.observacao} onChange={e => set("observacao", e.target.value)} placeholder="Não inclui a instalação." />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={E.label}>Proposta enviada pelo fornecedor</label>
          <CampoAnexoProposta anexo={p.anexo} onTrocar={a => set("anexo", a)} onErro={setErro} />
        </div>
        {erro && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 12 }}>{erro}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button style={E.btn} onClick={salvarProposta}>Salvar proposta</button>
          <button style={E.btnSec} onClick={() => { setFormProposta(null); setNovoPrestador(null); setErro(""); }}>Cancelar</button>
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

  // ── Apagar ────────────────────────────────────────────────────
  // Best-effort: o anexo some da obra de qualquer jeito; apagar do storage
  // é permissão de admin, e uma recusa ali não pode travar a exclusão.
  async function limparAnexos(ids) {
    for (const id of ids) { try { await api.uploads.remove(id); } catch (e) {} }
  }

  async function excluirProposta(cot, prop) {
    const ok = await dialogo.confirmar({
      titulo: `Excluir a proposta de ${prop.favorecido || "fornecedor sem nome"}?`,
      mensagem: prop.id === cot.escolhidaId
        ? "Era a proposta escolhida — a cotação volta a ficar sem escolha, e o cliente terá que aprovar de novo depois que você escolher outra."
        : "A proposta sai da comparação. As outras continuam como estão.",
      confirmar: "Excluir proposta",
      destrutivo: true,
    });
    if (!ok) return;
    setErro("");
    trocarCotacao(cot.id, c => removerProposta(c, prop.id));
    limparAnexos(anexosDasPropostas([prop]));
  }

  async function excluirCotacao(cot) {
    const trava = podeExcluirCotacao(cot);
    if (!trava.pode) { setErro(trava.motivo); return; }
    const props = propostasDaCotacao(cot);
    const ap = aprovacaoDaCotacao(aprovacoes, cot.id);
    const partes = [];
    if (props.length) partes.push(props.length === 1 ? "1 proposta" : `${props.length} propostas`);
    if (ap.status !== "pendente") partes.push(`a decisão do cliente (${ap.status === "aprovada" ? "aprovada" : "recusada"})`);
    const ok = await dialogo.confirmar({
      titulo: `Excluir a cotação "${cot.titulo || "sem nome"}"?`,
      mensagem: partes.length
        ? `Vai junto: ${partes.join(" e ")}. Não dá para desfazer.`
        : "A cotação ainda não tem propostas. Não dá para desfazer.",
      confirmar: "Excluir cotação",
      destrutivo: true,
    });
    if (!ok) return;
    setErro("");
    const r = removerCotacao(cotacoes, aprovacoes, cot.id);
    gravar({ ...obra, cotacoes: r.cotacoes, aprovacoesCotacao: r.aprovacoes });
    limparAnexos(anexosDasPropostas(props));
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
                {(() => {
                  // conta do P&L e etapa ficavam só no formulário; sem isto,
                  // depois de salvar não dava para saber onde a cotação cai
                  const etapa = typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA.find(e => e.id === cot.etapaId) : null;
                  const linhas = [];
                  if (conta) linhas.push(["Conta do P&L", conta.nome]);
                  if (etapa) linhas.push(["Etapa da obra", etapa.nome]);
                  if (cot.quantidade || cot.unidade) linhas.push(["Quantidade", `${cot.quantidade} ${cot.unidade}`.trim()]);
                  if (!linhas.length) return null;
                  return (
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 12 }}>
                      {linhas.map(([r, v]) => (
                        <div key={r}>
                          <div style={{ fontSize: 10.5, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{r}</div>
                          <div style={{ fontSize: 12.5, color: "#111827", fontWeight: 600, marginTop: 2 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

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
                                {p.anexo && p.anexo.url && (
                                  <button type="button" onClick={() => setVisor(p.anexo)}
                                    style={{ fontSize: 11, color: "#0474f4", background: "none", border: "none", padding: 0,
                                      cursor: "pointer", fontFamily: "inherit", display: "inline-block", marginTop: 3 }}>
                                    📎 {p.anexo.formato === "pdf" || p.anexo.resourceType === "raw" ? "Ver proposta (PDF)" : "Ver proposta"}
                                  </button>
                                )}
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
                                  {!cot.contaGeradaId && (
                                    <button title="Excluir esta proposta"
                                      style={{ ...E.btnSec, padding: "5px 10px", fontSize: 11.5, marginLeft: 6, color: "#dc2626" }}
                                      onClick={() => excluirProposta(cot, p)}>Excluir</button>
                                  )}
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
                      {podeExcluir && (
                        <button style={{ ...E.btnSec, color: "#dc2626", marginLeft: "auto" }}
                          onClick={() => excluirCotacao(cot)}>Excluir cotação</button>
                      )}
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

      {visor && <VisorProposta anexo={visor} aoFechar={() => setVisor(null)} />}
    </div>
  );
}

// ── Visor da proposta ───────────────────────────────────────────
// Clicar no anexo abria a URL do Cloudinary numa aba, e o navegador
// baixava o arquivo em vez de mostrar. Aqui a proposta abre DENTRO do
// sistema, numa janela sobre a tela.
//
// O PDF é buscado e reembalado num Blob com `application/pdf` antes de ir
// para o iframe. Parece rodeio, mas é o que torna o visor independente do
// cabeçalho que o storage manda: anexo antigo, que subiu sem extensão e é
// servido como octet-stream, abre igual — sem precisar reanexar.
function VisorProposta({ anexo, aoFechar }) {
  const [estado, setEstado] = useState("carregando"); // carregando | pronto | direto | erro
  const [motivo, setMotivo] = useState("");
  const [blobUrl, setBlobUrl] = useState("");
  const a = anexo || {};
  const pdf = a.formato === "pdf" || a.resourceType === "raw";

  useEffect(() => {
    const fechaComEsc = (e) => { if (e.key === "Escape") aoFechar(); };
    document.addEventListener("keydown", fechaComEsc);
    return () => document.removeEventListener("keydown", fechaComEsc);
  }, [aoFechar]);

  useEffect(() => {
    if (!a.url) { setEstado("erro"); return; }
    if (!pdf) { setEstado("pronto"); return; }
    let vivo = true, criada = "";
    (async () => {
      try {
        const r = await fetch(a.url);
        if (!r.ok) {
          if (!vivo) return;
          setMotivo(r.status === 404
            ? "O arquivo não está mais no storage. Anexe a proposta de novo."
            : `O storage respondeu ${r.status} ao buscar o arquivo.`);
          setEstado("erro");
          return;
        }
        const bruto = await r.blob();
        if (!vivo) return;
        const cabeca = new Uint8Array(await bruto.slice(0, 5).arrayBuffer());
        if (!pareceMesmoPdf(cabeca)) {
          setMotivo(bruto.size < 1024
            ? `O arquivo tem só ${bruto.size} bytes e não é um PDF — o upload deve ter falhado pela metade. Anexe a proposta de novo.`
            : "O arquivo anexado não é um PDF válido. Isso costuma acontecer quando o compressor devolve outra coisa no lugar do arquivo — tente anexar o PDF original, sem comprimir.");
          setEstado("erro");
          return;
        }
        criada = URL.createObjectURL(new Blob([bruto], { type: "application/pdf" }));
        setBlobUrl(criada);
        setEstado("pronto");
      } catch (e) {
        // Sem CORS não dá para reembalar o arquivo. Ainda assim vale tentar o
        // iframe na URL direta: para os anexos novos, que sobem com .pdf no
        // nome, o navegador abre inteiro. Só se isso também falhar é que
        // sobra o download.
        if (vivo) setEstado("direto");
      }
    })();
    // revoga ao fechar: sem isso o arquivo fica na memória da aba
    return () => { vivo = false; if (criada) URL.revokeObjectURL(criada); };
  }, [a.url, pdf]);

  const E = COT_ESTILO;
  const barra = { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
    borderBottom: "1px solid rgba(38,36,33,0.12)", flexWrap: "wrap" };

  return (
    <div onClick={aoFechar}
      style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.55)", zIndex: 9000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 14, width: "min(1000px, 96vw)", height: "min(88vh, 900px)",
          display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}>
        <div style={barra}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", wordBreak: "break-all" }}>{a.nome || "Proposta"}</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>{pdf ? "PDF" : "Imagem"}{a.bytes ? ` · ${tamanhoLegivel(a.bytes)}` : ""}</div>
          </div>
          {/* Com o arquivo já reembalado, o download sai com o nome certo —
              é o que conserta o anexo antigo, que chegava sem extensão. */}
          {blobUrl
            ? <a href={blobUrl} download={a.nome || "proposta.pdf"} style={{ ...E.btnSec, textDecoration: "none" }}>Baixar</a>
            : <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ ...E.btnSec, textDecoration: "none" }}>Baixar</a>}
          <button style={E.btnSec} onClick={aoFechar}>Fechar</button>
        </div>
        {/* `minHeight: 0` não é enfeite: item de flex nasce com min-height auto
            e cresce até caber o conteúdo. Sem isso a área virava do tamanho da
            imagem, o painel cortava o que passava, e uma captura de tela alta
            aparecia só até a metade — o preço, que costuma estar no fim,
            ficava fora. Agora a área fica do tamanho da janela e ROLA. */}
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: "#f3f4f6", position: "relative" }}>
          {estado === "carregando" && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, color: "#4b5563" }}>
              Abrindo a proposta…
            </div>
          )}
          {estado === "erro" && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", gap: 10, alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 12.5, color: "#4b5563", maxWidth: 420 }}>
                {motivo || "Não deu para mostrar a proposta aqui. O arquivo continua inteiro — dá para baixar e abrir no leitor de PDF do computador."}
              </div>
              <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ ...E.btn, textDecoration: "none" }}>Baixar assim mesmo</a>
            </div>
          )}
          {(estado === "pronto" || estado === "direto") && (pdf
            ? <iframe title="Proposta" src={estado === "direto" ? a.url : blobUrl} style={{ width: "100%", height: "100%", border: "none" }} />
            : <img src={a.url} alt="Proposta" style={{ display: "block", width: "100%", height: "auto" }} />)}
          {estado === "direto" && (
            <div style={{ position: "sticky", bottom: 0, padding: "6px 12px", background: "rgba(17,24,39,0.75)", color: "#fff", fontSize: 11 }}>
              Se a proposta não aparecer aqui, use “Baixar”.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Campo de anexo: arrasta o PDF do e-mail para cá, ou clica e escolhe.
function CampoAnexoProposta({ anexo, onTrocar, onErro }) {
  const [sobre, setSobre] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const refInput = useRef(null);
  const E = COT_ESTILO;

  async function receber(arquivo) {
    if (!arquivo) return;
    setEnviando(true);
    onErro("");
    try { onTrocar(await enviarAnexoProposta(arquivo)); }
    catch (e) { onErro(e.message || "Não foi possível anexar o arquivo."); }
    finally { setEnviando(false); }
  }

  async function remover() {
    const antigo = anexo;
    onTrocar(null);
    // o arquivo some da proposta de qualquer jeito; apagar do storage é
    // permissão de admin, então uma recusa aqui não trava o usuário
    if (antigo && antigo.public_id) { try { await api.uploads.remove(antigo.public_id); } catch (e) {} }
  }

  if (anexo) {
    const pdf = anexo.formato === "pdf" || anexo.resourceType === "raw";
    return (
      <div style={{ ...E.quadro, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ width: 38, height: 46, borderRadius: 6, border: "1px solid rgba(38,36,33,0.14)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: pdf ? "#dc2626" : "#0474f4", background: "#fafafa", overflow: "hidden" }}>
          {pdf ? "PDF" : <img src={anexo.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#111827", wordBreak: "break-all" }}>{anexo.nome}</div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>{tamanhoLegivel(anexo.bytes)}</div>
        </div>
        <a href={anexo.url} target="_blank" rel="noopener noreferrer" style={{ ...E.btnSec, textDecoration: "none", display: "inline-block" }}>Abrir</a>
        <button style={E.btnSec} onClick={remover}>Remover</button>
      </div>
    );
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setSobre(true); }}
      onDragLeave={() => setSobre(false)}
      onDrop={e => { e.preventDefault(); setSobre(false); receber(e.dataTransfer.files && e.dataTransfer.files[0]); }}
      onClick={() => refInput.current && refInput.current.click()}
      style={{
        border: `1.5px dashed ${sobre ? "#0474f4" : "rgba(38,36,33,0.22)"}`,
        borderRadius: 12, padding: "18px 14px", textAlign: "center", cursor: "pointer",
        background: sobre ? "#f0f7ff" : "#fafafa", transition: "all .15s ease",
      }}>
      <input ref={refInput} type="file" accept="application/pdf,image/*" style={{ display: "none" }}
        onChange={e => { receber(e.target.files && e.target.files[0]); e.target.value = ""; }} />
      <div style={{ fontSize: 12.5, color: "#111827", fontWeight: 600 }}>
        {enviando ? "Enviando…" : "Arraste o PDF da proposta aqui"}
      </div>
      <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 3 }}>
        ou clique para escolher — PDF ou foto, até 5 MB
      </div>
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
