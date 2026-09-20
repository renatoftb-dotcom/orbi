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
    // Lista de materiais: quando tem item aqui, a cotação deixa de ser "uma
    // coisa só com uma quantidade" e vira a lista do pedido da loja. Vazia,
    // tudo segue como antes — cotação de esquadria, de serralheiro.
    itens: [],
    prazoResposta: "",
    precisaAprovacaoCliente: true,
    status: "aberta",       // aberta | decidida | cancelada
    escolhidaId: "",
    enviadaClienteEm: "",   // quando a escolha foi mandada para o cliente ver
    enviadaClientePor: "",
    decididaEm: "",
    contaGeradaId: "",     // preenchido quando a cotação vira conta a pagar direto
    lancadoEm: "",
    lancadoPor: "",
    // o que foi combinado com o fornecedor (modo, entregas, datas) — ver
    // planoDoLancamento
    pagamento: null,
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

// ══════════════════════════════════════════════════════════════
// LISTA DE MATERIAIS — o pedido da loja
// ══════════════════════════════════════════════════════════════
// Cimento, tábua, prego, linha de pedreiro: ninguém cota isso "uma coisa de
// cada vez". Cota-se uma LISTA, e a loja responde de dois jeitos — um total
// pela lista inteira, ou preço de cada item. Os dois cabem aqui: o preço por
// item, quando existe, manda; quando não existe, vale o total digitado.
//
// O total da proposta (`p.valor`) continua sendo o número que o resto do
// sistema usa — contas a pagar, economia, contrato. Com preço por item ele
// passa a ser CALCULADO e regravado ao salvar a proposta, em vez de digitado.
function itemCotacaoVazio() {
  return {
    id: (typeof uid === "function" ? uid() : String(Date.now()) + Math.random().toString(36).slice(2, 6)),
    insumoId: "", codigo: "", descricao: "", unidade: "", quantidade: "",
  };
}

function itensDaCotacao(cot) {
  return ((cot || {}).itens) || [];
}

function temListaDeItens(cot) {
  return itensDaCotacao(cot).length > 0;
}

function numeroDoCampo(v) {
  if (typeof numeroDeCampo === "function") return numeroDeCampo(v);
  const n = parseFloat(String(v == null ? "" : v).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function quantidadeDoItem(it) {
  return numeroDoCampo((it || {}).quantidade);
}

function precoUnitario(proposta, itemId) {
  return numeroDoCampo(((proposta || {}).precos || {})[itemId]);
}

function propostaTemPrecoPorItem(cot, proposta) {
  return itensDaCotacao(cot).some((it) => precoUnitario(proposta, it.id) > 0);
}

// Soma do que a loja cotou. Item que ela não preencheu entra como zero e
// aparece à parte como "faltando" — somar por cima escondendo a falta daria
// um total mais barato que o da loja completa, e a comparação mentiria.
function totalDosItens(cot, proposta) {
  let total = 0;
  for (const it of itensDaCotacao(cot)) {
    total += precoUnitario(proposta, it.id) * quantidadeDoItem(it);
  }
  return Math.round(total * 100) / 100;
}

function itensSemPreco(cot, proposta) {
  return itensDaCotacao(cot).filter((it) => !(precoUnitario(proposta, it.id) > 0));
}

// O valor que vale para esta proposta: a soma dos itens quando há preço por
// item, senão o total digitado.
function valorDaProposta(cot, proposta) {
  return propostaTemPrecoPorItem(cot, proposta) ? totalDosItens(cot, proposta) : valorProposta(proposta);
}

// Qual loja está mais barata em cada item. É o que permite olhar a lista e
// ver que o cimento é numa e a madeira é na outra.
function melhorPorItem(cot) {
  const r = {};
  for (const it of itensDaCotacao(cot)) {
    let melhor = null;
    for (const p of propostasDaCotacao(cot)) {
      const u = precoUnitario(p, it.id);
      if (!(u > 0)) continue;
      if (!melhor || u < melhor.unitario) melhor = { propostaId: p.id, favorecido: p.favorecido || "", unitario: u };
    }
    if (melhor) r[it.id] = { ...melhor, total: Math.round(melhor.unitario * quantidadeDoItem(it) * 100) / 100 };
  }
  return r;
}

// O quadro da comparação: cada loja com o seu total, quantos itens cotou, e
// quanto sairia comprando cada item na loja mais barata dele.
function comparativoDaLista(cot) {
  const itens = itensDaCotacao(cot);
  const props = propostasDaCotacao(cot);
  const porItem = melhorPorItem(cot);
  const lojas = props.map((p) => {
    const faltando = itensSemPreco(cot, p);
    return {
      propostaId: p.id,
      favorecido: p.favorecido || "",
      porItem: propostaTemPrecoPorItem(cot, p),
      total: valorDaProposta(cot, p),
      cotados: itens.length - faltando.length,
      faltando: faltando.length,
    };
  });
  const completas = lojas.filter((l) => l.porItem && l.faltando === 0 && l.total > 0);
  const melhorInteira = completas.length ? Math.min(...completas.map((l) => l.total)) : 0;
  const totalDividido = Object.keys(porItem).length === itens.length && itens.length
    ? Math.round(itens.reduce((a, it) => a + (porItem[it.id] ? porItem[it.id].total : 0), 0) * 100) / 100
    : 0;
  const lojasDaDivisao = new Set(Object.values(porItem).map((m) => m.propostaId));
  return {
    itens, lojas, porItem, melhorInteira, totalDividido,
    // dividir só vale a pena se de fato envolve mais de uma loja E economiza
    ganhoDaDivisao: melhorInteira > 0 && totalDividido > 0 && lojasDaDivisao.size > 1
      ? Math.round((melhorInteira - totalDividido) * 100) / 100
      : 0,
  };
}

// ── O pedido, do jeito que vai para a loja ──────────────────────
// Dois formatos do mesmo conteúdo: texto para colar na conversa do vendedor
// e folha para imprimir ou anexar.
// 12 vira "12", 12,5 vira "12,5" — quantidade de material raramente tem
// centavos, e "12,00 sacos" soa errado no pedido.
function qtdBR(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function textoDoPedido(cot, proposta, ctx) {
  const c = cot || {};
  const x = ctx || {};
  const linhas = [];
  if (x.escritorio) linhas.push(x.escritorio);
  linhas.push(`PEDIDO${c.numeroPedido ? ` ${c.numeroPedido}` : ""} — ${String(c.titulo || "Materiais").trim()}`);
  if (x.obra) linhas.push(`Obra: ${x.obra}`);
  if (x.endereco) linhas.push(`Entrega: ${x.endereco}`);
  if (proposta && proposta.favorecido) linhas.push(`Fornecedor: ${proposta.favorecido}`);
  linhas.push("");
  const itens = itensDaCotacao(c);
  if (itens.length) {
    itens.forEach((it, i) => {
      const q = quantidadeDoItem(it);
      const qtd = q > 0 ? `${qtdBR(q)} ${it.unidade || ""}`.trim() : "";
      linhas.push(`${i + 1}. ${it.descricao || "Item"}${qtd ? ` — ${qtd}` : ""}`);
    });
  } else {
    const q = numeroDoCampo(c.quantidade);
    const qtd = q > 0 ? `${qtdBR(q)} ${c.unidade || ""}`.trim() : "";
    linhas.push(`1. ${c.titulo || "Item"}${qtd ? ` — ${qtd}` : ""}`);
  }
  if (String(c.escopo || "").trim()) { linhas.push(""); linhas.push(String(c.escopo).trim()); }
  if (x.contato) { linhas.push(""); linhas.push(`Contato: ${x.contato}`); }
  return linhas.join("\n");
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

// A decisão do cliente vale para a proposta que ele viu. Se o escritório
// trocar a escolhida depois, o aval antigo não vale para o preço novo — a
// cotação volta a precisar de resposta. Registro antigo, sem propostaId,
// continua valendo (não dá para saber o que ele aprovou).
function aprovacaoDaEscolha(cot, aprovacoes) {
  const c = cot || {};
  const ap = aprovacaoDaCotacao(aprovacoes, c.id);
  if (ap.status === "pendente") return ap;
  if (ap.propostaId && c.escolhidaId && ap.propostaId !== c.escolhidaId) return COT_SEM_APROVACAO;
  return ap;
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
    // Quando a resposta chega por fora do sistema — WhatsApp, telefone — o
    // escritório registra por ele. `por` continua sendo quem decidiu; aqui
    // fica quem digitou, para a linha na tela não parecer aval do portal.
    registradaPor: dados.registradaPor || "",
    em: new Date().toISOString(),
  }]);
}

// ── Situação, em uma palavra ────────────────────────────────────
// A ordem dos testes é a ordem do fluxo; o primeiro que casar manda.
function situacaoCotacao(cot, aprovacoes, contratos) {
  const c = cot || {};
  const ap = aprovacaoDaEscolha(c, aprovacoes);
  if (c.status === "cancelada")            return { id: "cancelada",  rotulo: "Cancelada",                 cor: "#6b7280" };
  if (contratoDaCotacao(contratos, c.id)) return { id: "contratada", rotulo: "Contrato gerado",           cor: "#15803d" };
  // Fornecedor de material não assina contrato: a cotação escolhida vira
  // conta a pagar direto. Também fecha o ciclo, mas por outro caminho — e
  // dizer "contrato gerado" ali seria mentira na tela.
  if (c.contaGeradaId)                     return { id: "lancada",    rotulo: "Lançada em contas a pagar", cor: "#15803d" };
  if (ap.status === "recusada")            return { id: "recusada",   rotulo: "Recusada pelo cliente",     cor: "#dc2626" };
  if (ap.status === "aprovada")            return { id: "aprovada",   rotulo: "Aprovada pelo cliente",     cor: "#15803d" };
  if (!c.escolhidaId && !propostasDaCotacao(c).length)
                                           return { id: "coletando",  rotulo: "Aguardando propostas",      cor: "#b45309" };
  if (!c.escolhidaId)                      return { id: "comparando", rotulo: "Comparando propostas",      cor: "#0474f4" };
  // Escolher não é avisar. Enquanto o escritório não manda a escolha, o
  // cliente não tem o que aprovar — e era aqui que a tela parava: dizia
  // "aguardando o cliente" sem nunca ter falado com ele.
  if (c.precisaAprovacaoCliente && !c.enviadaClienteEm)
                                           return { id: "aEnviar",    rotulo: "Escolhida — falta enviar",  cor: "#0474f4" };
  if (c.precisaAprovacaoCliente)           return { id: "aguardando", rotulo: "Aguardando o cliente",      cor: "#b45309" };
  return { id: "escolhida", rotulo: "Escolhida", cor: "#15803d" };
}

// O contrato da obra que nasceu desta cotação, se já existe. É o contrato
// que diz se a cotação virou algo — não um sinalizador guardado na cotação,
// que ficaria mentindo se o contrato fosse apagado depois.
function contratoDaCotacao(contratos, cotacaoId) {
  if (!cotacaoId) return null;
  return (contratos || []).find(c => c && c.cotacaoId === cotacaoId) || null;
}

// O caminho de volta da conta do P&L para o tipo de profissional do
// contrato: a cotação diz em que conta o gasto cai, e o contrato precisa
// saber que ofício é. Várias contas caem em "mo_diversos"; nesse caso o
// contrato abre em "outro" e quem escolhe é o usuário.
function tipoDoContaId(contaId) {
  const mapa = typeof CONTA_POR_TIPO !== "undefined" ? CONTA_POR_TIPO : {};
  const achado = Object.keys(mapa).find(t => mapa[t] === contaId && mapa[t] !== "mo_diversos");
  return achado || "outro";
}

// O que a cotação entrega para o contrato nascer preenchido. O resto —
// prazo, parcelas, cláusulas — é do formulário do contrato, que já sabe
// fazer isso.
function dadosDoContratoDaCotacao(cot) {
  const c = cot || {};
  const esc = propostaEscolhida(c);
  if (!esc) return null;
  return {
    cotacaoId: c.id,
    tipoId: tipoDoContaId(c.contaId),
    prestadorId: esc.fornecedorId || "",
    nomeContratado: esc.favorecido || "",
    valor: valorProposta(esc),
    titulo: String(c.titulo || "").trim(),
    escopo: String(c.escopo || "").trim(),
    condicaoPagamento: esc.condicaoPagamento || "",
    prazoDias: esc.prazoDias || "",
  };
}

// Lançar direto em contas a pagar. Diferente do contrato, NÃO espera o aval
// do cliente: o aval existe para o que vai virar contrato de prestação de
// serviço. Fornecedor de material entrega contra nota, e segurar o
// lançamento até a resposta do cliente só atrasaria o pagamento.
function podeLancarEmContas(cot, contratos) {
  const c = cot || {};
  if (c.status === "cancelada")  return { pode: false, motivo: "A cotação foi cancelada." };
  if (contratoDaCotacao(contratos, c.id)) return { pode: false, motivo: "Esta cotação já virou contrato." };
  if (c.contaGeradaId)           return { pode: false, motivo: "Já foi lançada em contas a pagar." };
  const esc = propostaEscolhida(c);
  if (!esc)                      return { pode: false, motivo: "Escolha uma proposta primeiro." };
  if (valorProposta(esc) <= 0)   return { pode: false, motivo: "A proposta escolhida está sem valor." };
  return { pode: true, motivo: "" };
}

// O que o lançamento leva para contas a pagar. Parcelas e primeiro
// vencimento são do formulário — a condição de pagamento da proposta é texto
// livre ("50/50", "30/60/90") e adivinhar parcela a partir dela erraria.
function dadosDoLancamento(cot) {
  const c = cot || {};
  const esc = propostaEscolhida(c);
  if (!esc) return null;
  const prazo = Number(esc.prazoDias) || 0;
  const hoje = typeof dataParaIso === "function" ? dataParaIso(new Date()) : "";
  // Relançar não recomeça do zero: o que foi combinado da última vez volta
  // preenchido, porque quem desfez um lançamento quase sempre vai refazer o
  // mesmo com um ajuste.
  const p = c.pagamento || {};
  return {
    cotacaoId: c.id,
    obraId: c.obraId || "",
    contaId: c.contaId || "",
    prestadorId: esc.fornecedorId || "",
    favorecido: esc.favorecido || "",
    descricao: String(c.titulo || "").trim() || "Compra",
    valor: valorProposta(esc),
    modo: p.modo || "parcelas",   // ver MODOS_LANCAMENTO
    parcelas: p.parcelas || 1,
    primeiroVencimento: p.primeiroVencimento
      || (prazo > 0 && typeof somarDias === "function" ? somarDias(hoje, prazo) : hoje),
    sinalPct: p.sinalPct == null ? 50 : p.sinalPct,
    vencimentoSaldo: p.vencimentoSaldo || "",
    entregas: (p.entregas || []).map((e) => ({ ...e })),
    observacao: esc.condicaoPagamento ? `Condição cotada: ${esc.condicaoPagamento}` : "",
  };
}

// ── O que foi combinado com o fornecedor ────────────────────────
// As contas a pagar são a EXECUÇÃO do acerto: elas escorregam de data,
// recebem baixa, somem se o lançamento for desfeito. O acerto em si — três
// entregas, estes valores, estas datas — é outra coisa, e é o que alguém
// procura meses depois ao abrir a cotação. Por isso fica gravado aqui, na
// cotação, e não só nas contas que nasceram dele.
function planoDoLancamento(dados) {
  const d = dados || {};
  const modo = (typeof modoLancamento === "function" ? modoLancamento(d.modo) : { id: d.modo || "parcelas" }).id;
  const plano = {
    modo,
    valor: Math.round((Number(d.valor) || 0) * 100) / 100,
    definidoEm: d.lancadoEm || new Date().toISOString(),
    definidoPor: d.lancadoPor || "",
  };
  if (modo === "entregas") {
    plano.entregas = (d.entregas || [])
      .filter((e) => e && (typeof valorDaEntrega === "function" ? valorDaEntrega(e) : Number(e.valor)) > 0)
      .map((e, i) => ({
        descricao: String(e.descricao || "").trim() || `Entrega ${i + 1}`,
        valor: typeof valorDaEntrega === "function" ? valorDaEntrega(e) : Number(e.valor) || 0,
        vencimento: String(e.vencimento || "").slice(0, 10),
      }));
    return plano;
  }
  plano.parcelas = Math.max(1, Math.floor(Number(d.parcelas) || 1));
  plano.primeiroVencimento = String(d.primeiroVencimento || "").slice(0, 10);
  if (modo === "sinalFinal" || modo === "sinalParcelas") {
    plano.sinalPct = Math.min(100, Math.max(0, Number(d.sinalPct) || 0));
    plano.vencimentoSaldo = String(d.vencimentoSaldo || "").slice(0, 10);
  }
  return plano;
}

// A tabelinha que a cotação mostra. A fonte preferida são as CONTAS, porque
// é nelas que a data recalibrada e a baixa aparecem; o plano guardado entra
// quando não há contas (lançamento desfeito), para o acerto não sumir da
// tela junto com elas.
function linhasDoPagamento(cot, contas, hoje) {
  const c = cot || {};
  const daCotacao = (contas || [])
    .filter((x) => x && x.cotacaoId === c.id)
    .slice()
    .sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));
  // A conta carrega o nome da compra no começo da descrição ("Aço Vergalhões
  // — 1ª entrega"), porque no contas a pagar ela aparece sozinha, longe da
  // cotação. Aqui dentro da própria cotação esse prefixo só repete o título
  // da tela, então sai.
  const semPrefixo = (txt) => {
    const t = String(txt || "");
    const titulo = String(c.titulo || "").trim();
    if (!titulo) return t;
    for (const tracinho of [" — ", " - "]) {
      const p = titulo + tracinho;
      if (t.startsWith(p) && t.length > p.length) return t.slice(p.length);
    }
    return t;
  };
  if (daCotacao.length) {
    return {
      fonte: "contas",
      linhas: daCotacao.map((x) => ({
        id: x.id,
        descricao: semPrefixo(x.descricao) || "Pagamento",
        valor: x.pago ? (Number(x.valorPago) || Number(x.valor) || 0) : Number(x.valor) || 0,
        vencimento: x.vencimento || "",
        pago: !!x.pago,
        pagoEm: x.pagoEm || "",
        vencida: !x.pago && !!x.vencimento && !!hoje && x.vencimento < hoje,
      })),
    };
  }
  const p = c.pagamento;
  if (!p) return { fonte: "", linhas: [] };
  const nome = String(c.titulo || "Compra").trim() || "Compra";
  if (p.modo === "entregas") {
    return { fonte: "plano", linhas: (p.entregas || []).map((e, i) => ({
      id: `e${i}`, descricao: e.descricao, valor: e.valor, vencimento: e.vencimento, pago: false, vencida: false })) };
  }
  // fora de "entregas" o plano é uma regra, não uma lista — descrevê-la em
  // uma linha é mais honesto do que reconstruir parcelas que não existem
  return { fonte: "plano", linhas: [{ id: "p0", descricao: `${nome} — ${resumoDoPlano(p)}`,
    valor: p.valor, vencimento: p.primeiroVencimento, pago: false, vencida: false }] };
}

function resumoDoPlano(plano) {
  const p = plano || {};
  const n = Math.max(1, Math.floor(Number(p.parcelas) || 1));
  if (p.modo === "entregas") return `${(p.entregas || []).length} entregas`;
  if (p.modo === "sinalFinal") return `sinal de ${p.sinalPct || 0}% e saldo na entrega`;
  if (p.modo === "sinalParcelas") return `sinal de ${p.sinalPct || 0}% e saldo em ${n}x`;
  return n > 1 ? `${n} parcelas mensais` : "parcela única";
}

// Só vira contrato o que já tem escolha e, quando exigido, o aval do
// cliente. Devolve o motivo do bloqueio para a tela poder explicar.
function podeGerarContrato(cot, aprovacoes, contratos) {
  const c = cot || {};
  if (c.status === "cancelada")  return { pode: false, motivo: "A cotação foi cancelada." };
  if (contratoDaCotacao(contratos, c.id)) return { pode: false, motivo: "O contrato desta cotação já foi gerado." };
  if (c.contaGeradaId)           return { pode: false, motivo: "Já foi lançada em contas a pagar pelo fluxo antigo." };
  const esc = propostaEscolhida(c);
  if (!esc)                      return { pode: false, motivo: "Escolha uma proposta primeiro." };
  if (valorProposta(esc) <= 0)   return { pode: false, motivo: "A proposta escolhida está sem valor." };
  const ap = aprovacaoDaEscolha(c, aprovacoes);
  if (c.precisaAprovacaoCliente && ap.status === "recusada") return { pode: false, motivo: "O cliente recusou esta escolha." };
  if (c.precisaAprovacaoCliente && ap.status !== "aprovada") {
    return { pode: false, motivo: c.enviadaClienteEm
      ? "Aguardando a aprovação do cliente."
      : "Envie a escolha ao cliente e espere a aprovação." };
  }
  return { pode: true, motivo: "" };
}

// ── Quem fez, e quando ──────────────────────────────────────────
// O módulo é o mesmo para o escritório e para o cliente, então cada coisa
// gravada leva o nome de quem gravou. Não é auditoria de desconfiança: é
// para o escritório abrir a cotação e saber que aquela proposta foi o
// cliente quem registrou, sem ter que perguntar.
function nomeDeQuem(usuario) {
  const u = usuario || {};
  const bruto = String(u.nome || u.email || "").trim();
  // O nome vem do JWT. Enquanto o decode antigo esteve no ar ele chegava com
  // os acentos quebrados, e é assim que ficou gravado em registro antigo —
  // por isso passa pelo conserto na entrada e na saída.
  return (typeof textoUtf8Recuperado === "function" ? textoUtf8Recuperado(bruto) : bruto) || "alguém";
}

const nomeGravado = (txt) => (typeof textoUtf8Recuperado === "function" ? textoUtf8Recuperado(txt) : String(txt == null ? "" : txt));

// Carimba a criação na primeira vez e a edição em todas. São dois pares
// porque "cadastrado por" e "salvo por" respondem perguntas diferentes:
// quem trouxe isto para cá, e quem mexeu por último.
function carimbar(obj, usuario, ehNovo) {
  const quem = nomeDeQuem(usuario);
  const agora = new Date().toISOString();
  const base = { ...(obj || {}), salvoPor: quem, salvoEm: agora };
  if (ehNovo || !base.criadoPor) { base.criadoPor = quem; base.criadoEm = base.criadoEm || agora; }
  return base;
}

const dataCurta = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString("pt-BR");
};

// A linha que aparece na tela. Enquanto ninguém editou depois de criar, é só
// "Cadastrado por X"; quando alguém mexe, o que interessa passa a ser quem
// mexeu por último, e a criação vira o complemento.
function textoAutoria(objBruto) {
  const o0 = objBruto || {};
  const o = { ...o0, criadoPor: nomeGravado(o0.criadoPor), salvoPor: nomeGravado(o0.salvoPor) };
  if (!o.criadoPor && !o.salvoPor) return "";
  const mesmaMao = o.salvoPor === o.criadoPor && String(o.salvoEm || "").slice(0, 10) === String(o.criadoEm || "").slice(0, 10);
  if (!o.salvoPor || mesmaMao) {
    return `Cadastrado por ${o.criadoPor || o.salvoPor}${dataCurta(o.criadoEm || o.salvoEm) ? ` em ${dataCurta(o.criadoEm || o.salvoEm)}` : ""}`;
  }
  const salvo = `Salvo por ${o.salvoPor}${dataCurta(o.salvoEm) ? ` em ${dataCurta(o.salvoEm)}` : ""}`;
  return o.criadoPor ? `${salvo} · cadastrado por ${o.criadoPor}` : salvo;
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

// A cotação que já virou contrato também não some: o contrato aponta para
// ela, e apagá-la deixaria o contrato sem a origem que explica o preço.
function podeExcluirCotacaoComContratos(cot, contratos) {
  const base = podeExcluirCotacao(cot);
  if (!base.pode) return base;
  if (contratoDaCotacao(contratos, (cot || {}).id)) {
    return { pode: false, motivo: "Virou contrato — remova o contrato primeiro." };
  }
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

// Contadores do cartão da obra e do topo da tela.
function resumoCotacoes(cotacoes, aprovacoes) {
  const lista = (cotacoes || []).filter(c => c && c.id);
  const r = { total: lista.length, abertas: 0, aEnviar: 0, aguardandoCliente: 0, aprovadas: 0, recusadas: 0, lancadas: 0, economia: 0 };
  for (const c of lista) {
    const s = situacaoCotacao(c, aprovacoes);
    if (s.id === "coletando" || s.id === "comparando") r.abertas++;
    if (s.id === "aEnviar")     r.aEnviar++;
    if (s.id === "aguardando")  r.aguardandoCliente++;
    if (s.id === "aprovada")    r.aprovadas++;
    if (s.id === "recusada")    r.recusadas++;
    if (s.id === "contratada")  r.lancadas++;
    if (s.id === "aprovada" || s.id === "contratada") {
      const e = economiaDaCotacao(c);
      if (e && e.economia > 0) r.economia += e.economia;
    }
  }
  return r;
}

// ── Mandar a escolha para o cliente ─────────────────────────────
// Um carimbo, não um e-mail: o cliente entra na obra dele e vê a cotação
// pedindo resposta, e o escritório vê desde quando está esperando. Reenviar
// só atualiza a data — serve de "cobrei de novo".
function podeEnviarAoCliente(cot, aprovacoes, contratos) {
  const c = cot || {};
  if (c.status === "cancelada") return { pode: false, motivo: "A cotação foi cancelada." };
  if (contratoDaCotacao(contratos, c.id) || c.contaGeradaId)
                                return { pode: false, motivo: "O contrato desta cotação já foi gerado." };
  if (!c.precisaAprovacaoCliente) return { pode: false, motivo: "Esta cotação não pede aprovação do cliente." };
  if (!propostaEscolhida(c))      return { pode: false, motivo: "Escolha uma proposta primeiro." };
  const ap = aprovacaoDaEscolha(c, aprovacoes);
  if (ap.status === "aprovada")   return { pode: false, motivo: "O cliente já aprovou esta escolha." };
  return { pode: true, motivo: "" };
}

function enviarCotacaoAoCliente(cot, quem, agoraIso) {
  const c = cot || {};
  return { ...c, enviadaClienteEm: agoraIso || new Date().toISOString(), enviadaClientePor: quem || "" };
}

// Trocar a proposta escolhida invalida o que já tinha sido mandado: o
// cliente aprovou outro preço. Volta para "falta enviar".
function limparEnvioAoCliente(cot) {
  const c = cot || {};
  if (!c.enviadaClienteEm && !c.enviadaClientePor) return c;
  return { ...c, enviadaClienteEm: "", enviadaClientePor: "" };
}

// As cotações que já podem virar contrato — é isso que o módulo de
// contratos mostra, para o contrato nascer de onde ele é gerado.
function cotacoesProntasParaContrato(cotacoes, aprovacoes, contratos) {
  return (cotacoes || []).filter(c => c && c.id && podeGerarContrato(c, aprovacoes, contratos).pode);
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

// O que veio na área de transferência. Print de tela chega como imagem
// crua (items), arquivo copiado do explorador chega em `files` — os dois
// caminhos valem, e o primeiro arquivo aceitável ganha.
//
// Texto colado não é anexo: quem copia um número e cola no campo do lado
// não pode ver o sistema tentar subir arquivo nenhum.
function arquivoColado(dados) {
  const d = dados || {};
  const aceita = (f) => !!f && (/^image\//.test(f.type || "") || String(f.type) === "application/pdf");
  const dosArquivos = Array.from(d.files || []).filter(aceita);
  if (dosArquivos.length) return dosArquivos[0];
  for (const it of Array.from(d.items || [])) {
    if (!it || it.kind !== "file") continue;
    const f = typeof it.getAsFile === "function" ? it.getAsFile() : null;
    if (aceita(f)) return f;
  }
  return null;
}

// Print colado chega sem nome de verdade ("image.png"). Um nome com data
// ajuda quando o arquivo é baixado depois, na folha ou no visor.
function nomeDoColado(categoria, tipo) {
  const ext = String(tipo) === "application/pdf" ? "pdf" : (String(tipo || "").split("/")[1] || "png");
  const base = categoria === "comprovante_pagamento" ? "comprovante" : "proposta";
  const hoje = new Date().toISOString().slice(0, 10);
  return `${base}-${hoje}.${ext}`;
}

// O mesmo envio serve a proposta do fornecedor e o comprovante da baixa:
// os dois são "um arquivo que chegou de fora e vira anexo de um registro".
// Muda só a categoria, que é o que o backend usa para cota e pasta.
async function enviarAnexo(arquivo, categoria) {
  if (!arquivo) return null;
  const pronto = await comprimirImagem(arquivo);
  if (pronto.size > COT_ANEXO_MAX) {
    throw new Error(`Arquivo muito grande (${tamanhoLegivel(pronto.size)}). O limite é 10 MB — se for um PDF escaneado, peça a versão em PDF “normal”, que costuma ser bem menor.`);
  }
  const r = await api.uploads.send(pronto, categoria || "proposta_cotacao");
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
const enviarAnexoProposta = (arquivo) => enviarAnexo(arquivo, "proposta_cotacao");
const enviarComprovante = (arquivo) => enviarAnexo(arquivo, "comprovante_pagamento");

// ── Números em português, nos campos ────────────────────────────
// Dinheiro e percentual usam o campo do contrato (CampoCtrNum): os dígitos
// entram pela direita e as duas casas aparecem sozinhas — digitar 970000 dá
// "9.700,00", sem vírgula na mão. Quantidade e prazo usam o campo do
// orçamento (CampoNumeroBR), que deixa digitar livre e formata ao sair, para
// "12,5 m²" continuar possível sem forçar centavos em tudo.

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

function CotacoesObraView({ obra, obras, data, save, onObraAtualizada, isMobile, onVoltar, usuario, onGerarContrato, onLancarContas, onDesfazerLancamento, onRecalibrarPedido }) {
  const perm = getPermissoes();
  // O módulo é o mesmo dos dois lados: o cliente cria cotação, registra a
  // proposta que recebeu do fornecedor e escolhe, como o escritório. O que
  // cada um faz fica carimbado com o nome de quem fez.
  // O cliente gerencia a cotação igual ao escritório — mas quem APROVA é
  // ele, e quem manda a escolha para aprovação é o escritório. Sem separar
  // os dois papéis, o cliente ficava sem os botões de aprovar e a cotação
  // parava em "aguardando o cliente" para sempre.
  const podeGerenciar = !!perm.podeGerenciarObra || !!perm.isCliente;
  const ehCliente = !!perm.isCliente;
  const ehEscritorio = !!perm.podeGerenciarObra;
  // A exceção é apagar a cotação inteira: leva junto a decisão registrada e
  // não deixa rastro de quem apagou. Segue só com o admin do escritório.
  const podeExcluir = !!perm.podeGerenciarObra && !!perm.podeExcluir;
  const E = COT_ESTILO;
  const prestadores = (data.fornecedores || []).filter(f => f && f.ativo !== false);
  const cotacoes = obra.cotacoes || [];
  const aprovacoes = obra.aprovacoesCotacao || [];
  // quem diz se a cotação já virou algo é o contrato, não um sinalizador
  const contratos = obra.contratos || [];
  const hoje = typeof dataParaIso === "function" ? dataParaIso(new Date()) : "";
  const dinheiro = (v) => (typeof fmtMoedaCtr === "function" ? fmtMoedaCtr(v) : "R$ " + Number(v || 0).toFixed(2));

  const [abertas, setAbertas] = useState({});
  const [formCotacao, setFormCotacao] = useState(null);
  const [formProposta, setFormProposta] = useState(null); // { cotacaoId, proposta }
  const [formDecisao, setFormDecisao] = useState(null);
  const [formLancamento, setFormLancamento] = useState(null);   // { cotacao, status }
  const [novoPrestador, setNovoPrestador] = useState(null); // objeto quando o cadastro está aberto
  const [visor, setVisor] = useState(null);                 // anexo aberto na janela
  const [detalhePag, setDetalhePag] = useState(null);       // cotação com os pagamentos abertos
  // datas em edição na janelinha: null = só leitura
  const [datasPag, setDatasPag] = useState(null);
  const [folhaPedido, setFolhaPedido] = useState(null);     // { cot, proposta }
  const [copiado, setCopiado] = useState("");
  const insumos = (data.materiais || []).filter(i => i && i.ativo !== false);
  // O que o pedido precisa dizer além da lista: de quem parte e para onde vai.
  const ctxPedido = {
    escritorio: ((data.escritorio || {}).nome) || "",
    obra: obra.nome || "",
    endereco: [obra.endereco, obra.cidade, obra.estado].filter(Boolean).join(", "),
    contato: ((data.escritorio || {}).telefone) || "",
  };
  function copiarPedido(cot, proposta) {
    const txt = textoDoPedido(cot, proposta, ctxPedido);
    const fim = () => { setCopiado(cot.id); setTimeout(() => setCopiado(""), 2500); };
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(fim, () => setErro("O navegador não deixou copiar. Abra o pedido em PDF."));
      return;
    }
    setErro("O navegador não deixou copiar. Abra o pedido em PDF.");
  }
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
    const marcada = carimbar(f, usuario, !existe);
    gravarCotacoes(existe ? cotacoes.map(c => (c.id === f.id ? marcada : c)) : cotacoes.concat([marcada]));
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
        {/* Lista de materiais. Cotação de esquadria continua com uma
            quantidade só; pedido de loja é uma lista, e os dois convivem — a
            lista, quando existe, substitui a quantidade única. */}
        {(() => {
          const itens = formCotacao.itens || [];
          const setItens = (novos) => set("itens", novos);
          const addInsumo = (ins) => setItens([...itens, {
            ...itemCotacaoVazio(), insumoId: ins.id || ins.codigo || "", codigo: ins.codigo || "",
            descricao: ins.nome || "", unidade: ins.unidade || "", quantidade: "" }]);
          const cols = isMobile ? "1fr" : "1fr 110px 90px 34px";
          return (
            <div style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827", marginBottom: 2 }}>
                Lista de materiais {itens.length ? `· ${itens.length} ${itens.length === 1 ? "item" : "itens"}` : ""}
              </div>
              <div style={{ fontSize: 11.5, color: "#4b5563", marginBottom: 10 }}>
                Para pedido de loja — cimento, prego, tábua, argamassa. Ache o material pelo nome e diga a quantidade; com a lista preenchida, a quantidade única acima deixa de valer.
              </div>
              <SeletorInsumo insumos={insumos} aoEscolher={addInsumo} isMobile={isMobile} />
              {itens.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {!isMobile && (
                    <div style={{ display: "grid", gridTemplateColumns: cols, gap: 8, marginBottom: 4 }}>
                      <span style={E.label}>Material</span><span style={E.label}>Quantidade</span><span style={E.label}>Unidade</span><span />
                    </div>
                  )}
                  {itens.map((it, i) => (
                    <div key={it.id} style={{ display: "grid", gridTemplateColumns: cols, gap: 8, marginBottom: 8, alignItems: "center" }}>
                      <input style={E.input} value={it.descricao}
                        onChange={e => setItens(itens.map((x, j) => j === i ? { ...x, descricao: e.target.value } : x))} />
                      <CampoNumeroBR estilo={E.input} valor={it.quantidade} casas={2} placeholder="0"
                        aoMudar={(v) => setItens(itens.map((x, j) => j === i ? { ...x, quantidade: v } : x))} />
                      <input style={E.input} value={it.unidade} placeholder="un"
                        onChange={e => setItens(itens.map((x, j) => j === i ? { ...x, unidade: e.target.value } : x))} />
                      <button type="button" title="Tirar da lista" style={{ ...E.btnSec, padding: "6px 9px", color: "#dc2626" }}
                        onClick={() => setItens(itens.filter((_, j) => j !== i))}>×</button>
                    </div>
                  ))}
                  <button type="button" style={{ ...E.btnSec, fontSize: 11.5, padding: "5px 11px" }}
                    onClick={() => setItens([...itens, itemCotacaoVazio()])}>+ Item fora do catálogo</button>
                </div>
              )}
            </div>
          );
        })()}

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 14, marginBottom: 14 }}>
          {!temListaDeItens(formCotacao) && (
            <div>
              <label style={E.label}>Quantidade</label>
              <CampoNumeroBR estilo={E.input} valor={formCotacao.quantidade} casas={2}
                aoMudar={(v) => set("quantidade", v)} placeholder="12" />
            </div>
          )}
          {!temListaDeItens(formCotacao) && (
            <div>
              <label style={E.label}>Unidade</label>
              <input style={E.input} value={formCotacao.unidade} onChange={e => set("unidade", e.target.value)} placeholder="un / m² / vb" />
            </div>
          )}
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
    trocarCotacao(cotacaoId, c => {
      const lista = c.propostas || [];
      const existe = lista.some(x => x.id === proposta.id);
      // Com preço por item, o total deixa de ser digitado e passa a ser a
      // soma — assim o resto do sistema (economia, contas a pagar, contrato)
      // continua lendo um número só, sem saber que existe lista.
      const comTotal = propostaTemPrecoPorItem(c, proposta)
        ? { ...proposta, valor: totalDosItens(c, proposta) }
        : proposta;
      const p = carimbar({ ...comTotal, favorecido: nome }, usuario, !existe);
      return { ...c, propostas: existe ? lista.map(x => (x.id === p.id ? p : x)) : lista.concat([p]) };
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
        {/* Lista: a loja pode responder item a item ou só o total. Quem
            preenche item a item ganha a comparação por item; quem recebeu só
            "R$ 3.480 tudo" deixa em branco e digita o total. */}
        {(() => {
          const cotDaProposta = cotacoes.find(c => c.id === formProposta.cotacaoId);
          if (!cotDaProposta || !temListaDeItens(cotDaProposta)) return null;
          const itens = itensDaCotacao(cotDaProposta);
          const setPreco = (itemId, v) => set("precos", { ...(p.precos || {}), [itemId]: v });
          const somaAtual = totalDosItens(cotDaProposta, p);
          const preenchidos = itens.length - itensSemPreco(cotDaProposta, p).length;
          const cols = isMobile ? "1fr 120px" : "1fr 110px 80px 130px 120px";
          return (
            <div style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827", marginBottom: 2 }}>Preço item a item</div>
              <div style={{ fontSize: 11.5, color: "#4b5563", marginBottom: 10 }}>
                Preencha o unitário do que esta loja cotou. O que ficar em branco entra como não cotado. Se a loja só mandou o total, deixe tudo em branco e use o campo Valor abaixo.
              </div>
              {!isMobile && (
                <div style={{ display: "grid", gridTemplateColumns: cols, gap: 8, marginBottom: 4 }}>
                  <span style={E.label}>Material</span><span style={E.label}>Qtd.</span><span style={E.label}>Un.</span>
                  <span style={E.label}>Unitário (R$)</span><span style={{ ...E.label, textAlign: "right" }}>Total</span>
                </div>
              )}
              {itens.map(it => {
                const q = quantidadeDoItem(it);
                const u = precoUnitario(p, it.id);
                return (
                  <div key={it.id} style={{ display: "grid", gridTemplateColumns: cols, gap: 8, marginBottom: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12.5, color: "#111827" }}>{it.descricao || "Item"}</span>
                    {!isMobile && <span style={{ fontSize: 12, color: "#4b5563" }}>{q > 0 ? qtdBR(q) : "—"}</span>}
                    {!isMobile && <span style={{ fontSize: 12, color: "#4b5563" }}>{it.unidade || "—"}</span>}
                    <CampoCtrNum tipo="moeda" style={E.input} valor={(p.precos || {})[it.id]}
                      onChange={(v) => setPreco(it.id, v)} placeholder="0,00" />
                    {!isMobile && (
                      <span style={{ fontSize: 12.5, color: "#111827", fontWeight: 600, textAlign: "right" }}>
                        {u > 0 ? dinheiro(u * q) : "—"}
                      </span>
                    )}
                  </div>
                );
              })}
              {preenchidos > 0 && (
                <div style={{ fontSize: 12, color: "#111827", borderTop: "1px solid rgba(38,36,33,0.10)", paddingTop: 8, marginTop: 4 }}>
                  <strong>{dinheiro(somaAtual)}</strong> em {preenchidos} de {itens.length} {itens.length === 1 ? "item" : "itens"}
                  {preenchidos < itens.length ? " — o resto fica como não cotado por esta loja." : "."}
                  {" "}É este o valor que vai ser gravado como total da proposta.
                </div>
              )}
            </div>
          );
        })()}

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={E.label}>Valor</label>
            <CampoCtrNum tipo="moeda" style={E.input} valor={p.valor}
              onChange={(v) => set("valor", v)} placeholder="12.500,00" />
          </div>
          <div>
            <label style={E.label}>Prazo de entrega (dias)</label>
            <CampoCtrNum tipo="inteiro" style={E.input} valor={p.prazoDias}
              onChange={(v) => set("prazoDias", v)} placeholder="30" />
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

  // ── Mandar a escolha para o cliente ───────────────────────────
  function enviarAoCliente(cot) {
    const trava = podeEnviarAoCliente(cot, aprovacoes, contratos);
    if (!trava.pode) { setErro(trava.motivo); return; }
    setErro("");
    trocarCotacao(cot.id, c => enviarCotacaoAoCliente(c, nomeDeQuem(usuario)));
  }

  // ── Aprovar / recusar (cliente) ───────────────────────────────
  // O mesmo formulário serve os dois lados: o cliente responde por si, e o
  // escritório registra a resposta que chegou por fora — aí `por` é o nome
  // que ele digitou, e fica gravado quem transcreveu.
  function confirmarDecisao(motivo, quemRespondeu, statusEscolhido) {
    const { cotacao, registrando } = formDecisao;
    const status = statusEscolhido || formDecisao.status;
    const eu = nomeDeQuem(usuario);
    const quem = registrando ? (String(quemRespondeu || "").trim() || "Cliente") : (usuario?.nome || usuario?.email || "Cliente");
    const novas = registrarAprovacaoCotacao(aprovacoes, {
      cotacaoId: cotacao.id, propostaId: cotacao.escolhidaId, status, motivo, por: quem,
      registradaPor: registrando ? eu : "",
    });
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
    const trava = podeExcluirCotacaoComContratos(cot, contratos);
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

  // ── Lançar direto em contas a pagar ───────────────────────────
  // Fornecedor de material não assina contrato; a cotação escolhida vira
  // conta e o ciclo fecha por aqui.
  function abrirLancamento(cot) {
    const trava = podeLancarEmContas(cot, contratos);
    if (!trava.pode) { setErro(trava.motivo); return; }
    const dados = dadosDoLancamento(cot);
    if (!dados) { setErro("Escolha uma proposta primeiro."); return; }
    setErro("");
    setFormLancamento({ cotacao: cot, dados });
  }

  function confirmarLancamento(dados) {
    if (!onLancarContas) { setErro("Lançamento indisponível nesta tela."); return; }
    // O carimbo vai junto: quem grava é a tela da obra, numa gravação só.
    const r = onLancarContas({ ...dados, lancadoEm: new Date().toISOString(), lancadoPor: nomeDeQuem(usuario) });
    if (r && r.erro) { setErro(r.erro); return; }
    setErro("");
    setFormLancamento(null);
  }

  function salvarDatasDoPedido() {
    if (!detalhePag || !datasPag || !onRecalibrarPedido) return;
    const r = onRecalibrarPedido(detalhePag.id, datasPag);
    if (r && r.erro) { setErro(r.erro); setDatasPag(null); return; }
    setErro("");
    setDatasPag(null);
  }

  async function desfazerLancamento(cot) {
    const ok = await dialogo.confirmar({
      titulo: "Desfazer o lançamento desta cotação?",
      mensagem: "As contas em aberto geradas por ela são removidas. Conta já paga fica como está — o dinheiro saiu e o gasto tem que continuar na obra.",
      confirmar: "Desfazer lançamento",
      destrutivo: true,
    });
    if (!ok) return;
    setErro("");
    if (onDesfazerLancamento) onDesfazerLancamento(cot.id);
  }

  // ── Gerar o contrato da escolha ───────────────────────────────
  // A cotação não lança conta a pagar: ela vira CONTRATO, e é o contrato que
  // gera as parcelas. Assim o caminho é um só — cotar, escolher, contratar,
  // pagar — em vez de dois jeitos diferentes de a mesma despesa entrar.
  function gerarContrato(cot) {
    const trava = podeGerarContrato(cot, aprovacoes, contratos);
    if (!trava.pode) { setErro(trava.motivo); return; }
    const dados = dadosDoContratoDaCotacao(cot);
    if (!dados) { setErro("Escolha uma proposta primeiro."); return; }
    setErro("");
    if (onGerarContrato) onGerarContrato(dados);
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
        {ehEscritorio && resumo.aEnviar > 0
          ? quadro("Falta enviar ao cliente", resumo.aEnviar, "#0474f4")
          : quadro(ehEscritorio ? "Aguardando o cliente" : "Aguardando você", resumo.aguardandoCliente, resumo.aguardandoCliente > 0 ? "#b45309" : "#111827")}
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
        const s = situacaoCotacao(cot, aprovacoes, contratos);
        const ap = aprovacaoDaEscolha(cot, aprovacoes);
        const props = propostasOrdenadas(cot);
        const esc = propostaEscolhida(cot);
        const melhor = melhorProposta(cot);
        const eco = economiaDaCotacao(cot);
        const conta = typeof contaPorId === "function" ? contaPorId(cot.contaId) : null;
        const aberto = !!abertas[cot.id];
        const trava = podeGerarContrato(cot, aprovacoes, contratos);
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
                  const autoria = textoAutoria(cot);
                  if (autoria) linhas.push(["Registro", autoria]);
                  if (!linhas.length) return null;
                  return (
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 12 }}>
                      {linhas.map(([r, v]) => (
                        <div key={r}>
                          <div style={{ fontSize: 10.5, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{r}</div>
                          <div style={{ fontSize: 12.5, marginTop: 2,
                            color: r === "Registro" ? "#4b5563" : "#111827",
                            fontWeight: r === "Registro" ? 400 : 600 }}>{v}</div>
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
                                  {escolhida && cot.escolhidoPor && (
                                    <span style={{ fontSize: 10.5, color: "#6b7280" }}>
                                      por {nomeGravado(cot.escolhidoPor)}{dataCurta(cot.escolhidoEm) ? ` em ${dataCurta(cot.escolhidoEm)}` : ""}
                                    </span>
                                  )}
                                  {maisBarata && !escolhida && selo("#15803d", "Mais barata")}
                                </div>
                                {p.observacao && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{p.observacao}</div>}
                                {textoAutoria(p) && (
                                  <div style={{ fontSize: 10.5, color: "#6b7280", marginTop: 3 }}>{textoAutoria(p)}</div>
                                )}
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
                                  {!cot.contaGeradaId && !contratoDaCotacao(contratos, cot.id) && (
                                    <button style={{ ...E.btnSec, padding: "5px 10px", fontSize: 11.5, marginRight: 6 }}
                                      onClick={() => trocarCotacao(cot.id, c => (escolhida
                                        ? { ...limparEnvioAoCliente(c), escolhidaId: "", escolhidoPor: "", escolhidoEm: "" }
                                        : { ...limparEnvioAoCliente(c), escolhidaId: p.id, escolhidoPor: nomeDeQuem(usuario), escolhidoEm: new Date().toISOString() }))}>
                                      {escolhida ? "Desfazer" : "Escolher"}
                                    </button>
                                  )}
                                  {/* Os pagamentos combinados pertencem ao
                                      fornecedor escolhido, então o caminho
                                      até eles é a linha dele. Embaixo do
                                      cartão a tabela competia com a lista de
                                      propostas e confundia as duas coisas. */}
                                  {escolhida && linhasDoPagamento(cot, obra.contasPagar || [], hoje).linhas.length > 0 && (
                                    <button style={{ ...E.btnSec, padding: "5px 10px", fontSize: 11.5, marginRight: 6 }}
                                      onClick={() => setDetalhePag(cot)}>Detalhe</button>
                                  )}
                                  <button style={{ ...E.btnSec, padding: "5px 10px", fontSize: 11.5 }}
                                    onClick={() => { setErro(""); setFormProposta({ cotacaoId: cot.id, proposta: p }); }}>Editar</button>
                                  {/* Desfazer o lançamento é ação sobre ESTE
                                      fornecedor, não sobre a cotação: mora ao
                                      lado dos pagamentos que ele gerou. */}
                                  {escolhida && cot.contaGeradaId && !contratoDaCotacao(contratos, cot.id) && (
                                    <button style={{ ...E.btnSec, padding: "5px 10px", fontSize: 11.5, marginLeft: 6, color: "#dc2626" }}
                                      onClick={() => desfazerLancamento(cot)}>Desfazer lançamento</button>
                                  )}
                                  {!cot.contaGeradaId && !contratoDaCotacao(contratos, cot.id) && (
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

                {temListaDeItens(cot) && (
                  <ComparativoLista cot={cot} dinheiro={dinheiro} isMobile={isMobile} />
                )}

                {eco && eco.economia > 0 && (
                  <div style={{ fontSize: 12, color: "#15803d", marginBottom: 12 }}>
                    Economia de {dinheiro(eco.economia)} em relação à proposta mais cara ({dinheiro(eco.maior)}).
                  </div>
                )}

                {ap.status === "pendente" && s.id === "aEnviar" && ehEscritorio && esc && (
                  <div style={{ fontSize: 12, color: "#0474f4", background: "#eef5ff", border: "1px solid rgba(4,116,244,0.22)", borderRadius: 10, padding: "8px 10px", marginBottom: 12 }}>
                    Escolha feita: {esc.favorecido} por {dinheiro(valorProposta(esc))}. O cliente ainda não foi avisado — envie a escolha para ele aprovar.
                  </div>
                )}
                {ap.status === "pendente" && cot.enviadaClienteEm && (
                  <div style={{ fontSize: 12, color: ehEscritorio ? "#4b5563" : "#0474f4",
                    background: ehEscritorio ? "transparent" : "#eef5ff",
                    border: ehEscritorio ? "none" : "1px solid rgba(4,116,244,0.22)",
                    borderRadius: 10, padding: ehEscritorio ? 0 : "8px 10px", marginBottom: 12 }}>
                    {ehEscritorio
                      ? `Escolha enviada ao cliente em ${dataCurta(cot.enviadaClienteEm)}${cot.enviadaClientePor ? ` por ${nomeGravado(cot.enviadaClientePor)}` : ""} — aguardando a resposta.`
                      : `O escritório escolheu ${esc ? `${esc.favorecido}, ${dinheiro(valorProposta(esc))}` : "uma proposta"} e enviou em ${dataCurta(cot.enviadaClienteEm)} para a sua aprovação.`}
                  </div>
                )}

                {ap.status !== "pendente" && (
                  <div style={{ fontSize: 12, color: ap.status === "aprovada" ? "#15803d" : "#dc2626", marginBottom: 12 }}>
                    {ap.status === "aprovada" ? "Aprovada" : "Recusada"} por {nomeGravado(ap.por)} em {new Date(ap.em).toLocaleDateString("pt-BR")}
                    {ap.registradaPor ? ` (registrado por ${nomeGravado(ap.registradaPor)})` : ""}
                    {ap.motivo ? ` — ${ap.motivo}` : ""}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {podeGerenciar && !cot.contaGeradaId && !contratoDaCotacao(contratos, cot.id) && (
                    <>
                      <button style={E.btnSec} onClick={() => { setErro(""); setFormProposta({ cotacaoId: cot.id, proposta: propostaVazia() }); }}>+ Registrar proposta</button>
                      <button style={E.btnSec} onClick={() => { setErro(""); setFormCotacao(cot); }}>Editar cotação</button>
                      {s.id === "aEnviar" && ehEscritorio && (
                        <button style={E.btn} onClick={() => enviarAoCliente(cot)}>Enviar ao cliente</button>
                      )}
                      {s.id === "aguardando" && ehEscritorio && (
                        <>
                          <button style={E.btnSec} onClick={() => enviarAoCliente(cot)}>Reenviar aviso</button>
                          <button style={E.btnSec} onClick={() => { setErro(""); setFormDecisao({ cotacao: cot, status: "aprovada", registrando: true }); }}>
                            Registrar resposta do cliente
                          </button>
                        </>
                      )}
                      <button disabled={!trava.pode} title={trava.pode ? "" : trava.motivo}
                        style={{ ...E.btn, opacity: trava.pode ? 1 : 0.45, cursor: trava.pode ? "pointer" : "not-allowed" }}
                        onClick={() => gerarContrato(cot)}>Gerar contrato</button>
                      {/* Lançar direto em contas a pagar vale para os dois: é o
                          caminho do fornecedor que entrega contra nota e não
                          assina contrato, e quem paga esse fornecedor tanto pode
                          ser o escritório quanto o cliente. */}
                      {podeGerenciar && (() => {
                        const tl = podeLancarEmContas(cot, contratos);
                        return (
                          <button disabled={!tl.pode} title={tl.pode ? "Para fornecedor que não assina contrato — não espera o aval do cliente" : tl.motivo}
                            style={{ ...E.btnSec, opacity: tl.pode ? 1 : 0.45, cursor: tl.pode ? "pointer" : "not-allowed" }}
                            onClick={() => abrirLancamento(cot)}>Lançar em contas a pagar</button>
                        );
                      })()}
                      {!trava.pode && <span style={{ fontSize: 11.5, color: "#6b7280", alignSelf: "center" }}>{trava.motivo}</span>}
                      {podeExcluir && (
                        <button style={{ ...E.btnSec, color: "#dc2626", marginLeft: "auto" }}
                          onClick={() => excluirCotacao(cot)}>Excluir cotação</button>
                      )}
                    </>
                  )}
                  {temListaDeItens(cot) && (
                    <>
                      <button style={E.btnSec} onClick={() => setFolhaPedido({ cot, proposta: propostaEscolhida(cot) })}>
                        Pedido (PDF)
                      </button>
                      <button style={E.btnSec} onClick={() => copiarPedido(cot, propostaEscolhida(cot))}>
                        {copiado === cot.id ? "Copiado ✓" : "Copiar para WhatsApp"}
                      </button>
                    </>
                  )}
                  {ehCliente && (s.id === "aguardando" || s.id === "aEnviar") && (
                    <>
                      <button style={E.btn} onClick={() => setFormDecisao({ cotacao: cot, status: "aprovada" })}>Aprovar</button>
                      <button style={E.btnSec} onClick={() => setFormDecisao({ cotacao: cot, status: "recusada" })}>Recusar</button>
                    </>
                  )}
                  {podeGerenciar && contratoDaCotacao(contratos, cot.id) && (
                    <span style={{ fontSize: 12, color: "#15803d", alignSelf: "center" }}>
                      Virou contrato — as parcelas saem de lá, na aba Contratos.
                    </span>
                  )}
                  {podeGerenciar && !contratoDaCotacao(contratos, cot.id) && cot.contaGeradaId && (
                    <>
                      <span style={{ fontSize: 12, color: "#15803d", alignSelf: "center" }}>
                        Lançada em contas a pagar{cot.lancadoEm ? ` em ${dataCurta(cot.lancadoEm)}` : ""}
                        {cot.lancadoPor ? ` por ${nomeGravado(cot.lancadoPor)}` : ""} — sem contrato.
                      </span>
                    </>
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
          registrando={!!formDecisao.registrando}
          dinheiro={dinheiro}
          onConfirmar={confirmarDecisao}
          onFechar={() => setFormDecisao(null)}
        />
      )}

      {formLancamento && (
        <CotacaoLancamento
          cotacao={formLancamento.cotacao}
          dados={formLancamento.dados}
          dinheiro={dinheiro}
          onConfirmar={confirmarLancamento}
          onFechar={() => setFormLancamento(null)}
        />
      )}

      {visor && <VisorProposta anexo={visor} aoFechar={() => setVisor(null)} />}

      {folhaPedido && (
        <FolhaPedido cot={folhaPedido.cot} proposta={folhaPedido.proposta} ctx={ctxPedido}
          aoFechar={() => setFolhaPedido(null)} />
      )}

      {detalhePag && (
        <div onClick={() => { setDatasPag(null); setDetalhePag(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 16, zIndex: 70 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, padding: 18, width: "100%", maxWidth: 620,
              maxHeight: "86vh", overflowY: "auto", boxShadow: "0 20px 60px -20px rgba(17,24,39,0.45)" }}>
            {/* o título do quadro logo abaixo já diz "Pagamentos combinados"
                e traz o número do pedido — aqui fica o de quem é */}
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 12 }}>
              {detalhePag.titulo || "Compra"}
              {propostaEscolhida(detalhePag) ? ` · ${propostaEscolhida(detalhePag).favorecido}` : ""}
            </div>
            <QuadroPagamentosCotacao cot={detalhePag} contas={obra.contasPagar || []} hoje={hoje}
              dinheiro={dinheiro} isMobile={isMobile} datasEdit={datasPag}
              aoMudarData={(id, v) => setDatasPag((ds) => (ds || []).map(x => x.id === id ? { ...x, vencimento: v } : x))} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
              {datasPag ? (
                <>
                  <button style={E.btnSec} onClick={() => setDatasPag(null)}>Cancelar</button>
                  <button style={E.btn} onClick={() => salvarDatasDoPedido()}>Salvar datas</button>
                </>
              ) : (
                <>
                  {podeGerenciar && onRecalibrarPedido && detalhePag.contaGeradaId && (
                    <button style={E.btnSec} onClick={() => setDatasPag(pagamentosEmAberto(obra.contasPagar || [], detalhePag.id, "pedido"))}>
                      Recalibrar datas
                    </button>
                  )}
                  <button style={E.btnSec} onClick={() => { setDatasPag(null); setDetalhePag(null); }}>Fechar</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Lançar a cotação em contas a pagar ──────────────────────────
// Só três perguntas: quantas parcelas, quando vence a primeira e em que
// conta do P&L o gasto cai. O resto vem da proposta escolhida.
function CotacaoLancamento({ cotacao, dados, dinheiro, onConfirmar, onFechar }) {
  const [f, setF] = useState(dados);
  const E = COT_ESTILO;
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const porEntrega = f.modo === "entregas";
  // "Item a item" do contrato é a entrega aqui: o que se paga por vez é a
  // entrega do fornecedor, não o item de um objeto fabricado.
  const qtd = Math.max(1, Math.floor(Number(f.parcelas) || 1));
  const entregas = f.entregas || [];
  const setEntrega = (i, k, v) => setF(x => ({ ...x, entregas: (x.entregas || []).map((e, j) => j === i ? { ...e, [k]: v } : e) }));
  const addEntrega = () => setF(x => {
    const lista = x.entregas || [];
    const ultima = lista[lista.length - 1];
    return { ...x, entregas: lista.concat([{
      descricao: `Entrega ${lista.length + 1}`,
      valor: "",
      vencimento: (ultima && ultima.vencimento) || x.primeiroVencimento || "",
    }]) };
  });
  const delEntrega = (i) => setF(x => ({ ...x, entregas: (x.entregas || []).filter((_, j) => j !== i) }));
  // Trocar para "por entrega" já abre a primeira linha com o valor cheio: o
  // caso comum é a primeira entrega valer tudo e ele ir quebrando dali.
  const trocarModo = (modo) => setF(x => ({
    ...x, modo,
    entregas: modo === "entregas" && !(x.entregas || []).length
      ? [{ descricao: "Entrega 1", valor: x.valor, vencimento: x.primeiroVencimento || "" }]
      : x.entregas,
  }));

  const previa = contasDaCotacao({ ...f, parcelas: qtd }, () => "previa");
  const somaEntregas = totalDasEntregas(entregas);
  const diferenca = Math.round((somaEntregas - (Number(f.valor) || 0)) * 100) / 100;
  const contas = typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : [];
  const grupos = typeof GRUPOS_PL !== "undefined" ? GRUPOS_PL : [];
  const podeLancar = previa.length > 0;

  const comSinal = f.modo === "sinalFinal" || f.modo === "sinalParcelas";
  const opcao = (m) => (
    <label key={m.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", border: `1.5px solid ${f.modo === m.id ? "#0474f4" : "rgba(38,36,33,0.14)"}`, borderRadius: 10, padding: "9px 11px", cursor: "pointer", background: "#fff" }}>
      <input type="radio" name="cot-lanc-modo" checked={f.modo === m.id} onChange={() => trocarModo(m.id)} style={{ marginTop: 2, cursor: "pointer" }} />
      <span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#111827" }}>{m.nome}</span>
        <span style={{ display: "block", fontSize: 11.5, color: "#4b5563", marginTop: 2 }}>{m.resumo}</span>
      </span>
    </label>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 60 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Lançar em contas a pagar</div>
        <div style={{ fontSize: 12.5, color: "#4b5563", marginBottom: 14 }}>
          {cotacao.titulo} — {f.favorecido || "fornecedor"}, {dinheiro(f.valor)}. Vai direto para contas a pagar, sem contrato e sem esperar o aval do cliente.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {MODOS_LANCAMENTO.map(opcao)}
        </div>

        {f.modo === "parcelas" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={E.label}>Parcelas</label>
              <CampoCtrNum tipo="inteiro" style={E.input} valor={f.parcelas}
                onChange={(v) => set("parcelas", v)} placeholder="1" />
            </div>
            <div>
              <label style={E.label}>Primeiro vencimento</label>
              <input style={E.input} type="date" value={f.primeiroVencimento || ""}
                onChange={e => set("primeiroVencimento", e.target.value)} />
            </div>
          </div>
        )}

        {comSinal && (
          <div style={{ display: "grid", gridTemplateColumns: f.modo === "sinalParcelas" ? "110px 1fr 90px 1fr" : "110px 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={E.label}>Sinal (%)</label>
              <CampoCtrNum tipo="pct" style={E.input} valor={f.sinalPct}
                onChange={(v) => set("sinalPct", v)} placeholder="50%" />
            </div>
            <div>
              <label style={E.label}>Vencimento do sinal</label>
              <input style={E.input} type="date" value={f.primeiroVencimento || ""}
                onChange={e => set("primeiroVencimento", e.target.value)} />
            </div>
            {f.modo === "sinalParcelas" && (
              <div>
                <label style={E.label}>Parcelas</label>
                <CampoCtrNum tipo="inteiro" style={E.input} valor={f.parcelas}
                  onChange={(v) => set("parcelas", v)} placeholder="1" />
              </div>
            )}
            <div>
              <label style={E.label}>{f.modo === "sinalFinal" ? "Vencimento do saldo" : "1º vencimento do saldo"}</label>
              <input style={E.input} type="date" value={f.vencimentoSaldo || ""}
                onChange={e => set("vencimentoSaldo", e.target.value)} />
            </div>
          </div>
        )}

        {porEntrega && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 150px 34px", gap: 8, marginBottom: 4 }}>
              <span style={E.label}>Entrega</span>
              <span style={E.label}>Valor</span>
              <span style={E.label}>Pagamento</span>
              <span />
            </div>
            {entregas.map((e, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 130px 150px 34px", gap: 8, marginBottom: 6, alignItems: "center" }}>
                <input style={E.input} value={e.descricao || ""} placeholder={`Entrega ${i + 1}`}
                  onChange={(ev) => setEntrega(i, "descricao", ev.target.value)} />
                <CampoCtrNum tipo="moeda" style={E.input} valor={e.valor}
                  placeholder="0,00" onChange={(v) => setEntrega(i, "valor", v)} />
                <input style={E.input} type="date" value={e.vencimento || ""}
                  onChange={(ev) => setEntrega(i, "vencimento", ev.target.value)} />
                <button type="button" onClick={() => delEntrega(i)}
                  style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontFamily: "inherit", fontSize: 16 }}>×</button>
              </div>
            ))}
            <button type="button" style={{ ...E.btnSec, marginTop: 4 }} onClick={addEntrega}>＋ Adicionar entrega</button>
            {entregas.length > 0 && (
              <div style={{ fontSize: 11.5, marginTop: 8, color: Math.abs(diferenca) < 0.005 ? "#4b5563" : "#b45309" }}>
                Soma das entregas: <strong style={{ color: "#111827" }}>{dinheiro(somaEntregas)}</strong>
                {Math.abs(diferenca) < 0.005
                  ? " — fecha com o valor cotado."
                  : ` — ${diferenca > 0 ? "acima" : "abaixo"} do cotado em ${dinheiro(Math.abs(diferenca))}. Dá para lançar assim mesmo, se foi o combinado.`}
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={E.label}>Conta do P&L</label>
          <select style={{ ...E.input, cursor: "pointer" }} value={f.contaId} onChange={e => set("contaId", e.target.value)}>
            {grupos.filter(g => g.id !== "receitas").map(g => (
              <optgroup key={g.id} label={g.titulo}>
                {contas.filter(c => c.grupo === g.id).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={E.label}>Observação</label>
          <input style={E.input} value={f.observacao || ""} onChange={e => set("observacao", e.target.value)} />
        </div>

        {previa.length > 0 ? (
          <div style={{ border: "1px solid rgba(38,36,33,0.12)", borderRadius: 10, padding: "8px 10px", marginBottom: 16, fontSize: 12, color: "#4b5563" }}>
            <div style={{ fontWeight: 600, color: "#111827", marginBottom: 4 }}>
              {previa.length === 1 ? "1 conta a gerar" : `${previa.length} contas a gerar`}
            </div>
            {previa.slice(0, 8).map((c, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.vencimento.split("-").reverse().join("/")}{porEntrega ? ` · ${c.descricao}` : ""}
                </span>
                <span style={{ color: "#111827", whiteSpace: "nowrap" }}>{dinheiro(c.valor)}</span>
              </div>
            ))}
            {previa.length > 8 && <div style={{ marginTop: 3 }}>… e mais {previa.length - 8}</div>}
          </div>
        ) : (
          <div style={{ fontSize: 11.5, color: "#b45309", marginBottom: 16 }}>
            {porEntrega ? "Dê um valor a pelo menos uma entrega." : "A proposta escolhida está sem valor."}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ ...E.btn, opacity: podeLancar ? 1 : 0.45, cursor: podeLancar ? "pointer" : "not-allowed" }}
            disabled={!podeLancar} onClick={() => onConfirmar({ ...f, parcelas: qtd })}>Lançar</button>
          <button style={E.btnSec} onClick={onFechar}>Cancelar</button>
        </div>
      </div>
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
          // 401 é o storage recusando ENTREGAR um arquivo que existe: os
          // PDFs que subiram com ".pdf" no nome enquanto a conta bloqueia
          // entrega de PDF. Reanexar resolve, porque o upload voltou a
          // gravar sem a extensão.
          setMotivo(r.status === 404
            ? "O arquivo não está mais no storage. Anexe a proposta de novo."
            : r.status === 401 || r.status === 403
              ? "O storage recusou entregar este arquivo. Anexe a proposta de novo — o arquivo novo sobe num formato que abre."
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

// ── Comparar a lista loja por loja ──────────────────────────────
// Numa lista de vinte materiais, o total de cada loja diz pouco: uma é mais
// barata no cimento e mais cara na madeira. Aqui o melhor preço de cada item
// fica marcado, e o rodapé diz quanto sairia comprando cada coisa onde ela
// está mais barata — que é a conta que decide se vale dividir o pedido.
function ComparativoLista({ cot, dinheiro, isMobile }) {
  const E = COT_ESTILO;
  const cmp = comparativoDaLista(cot);
  const comPreco = cmp.lojas.filter((l) => l.porItem);
  if (!cmp.itens.length) return null;
  const th = { padding: "6px 8px", fontSize: 11, color: "#4b5563", fontWeight: 600, textAlign: "left", whiteSpace: "nowrap" };
  const td = { padding: "6px 8px", fontSize: 12, color: "#111827", borderTop: "1px solid rgba(38,36,33,0.06)" };

  if (!comPreco.length) {
    return (
      <div style={{ ...E.quadro, padding: 0, marginBottom: 12, overflow: "hidden" }}>
        <div style={{ background: "#fafafa", padding: "8px 12px", borderBottom: "1px solid rgba(38,36,33,0.10)", fontSize: 12, fontWeight: 700, color: "#111827" }}>
          Lista · {cmp.itens.length} {cmp.itens.length === 1 ? "item" : "itens"}
        </div>
        {cmp.itens.map((it) => (
          <div key={it.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 12px", borderTop: "1px solid rgba(38,36,33,0.06)" }}>
            <span style={{ fontSize: 12.5, color: "#111827" }}>{it.descricao || "Item"}</span>
            <span style={{ fontSize: 12, color: "#4b5563" }}>
              {quantidadeDoItem(it) > 0 ? `${qtdBR(quantidadeDoItem(it))} ${it.unidade || ""}`.trim() : "—"}
            </span>
          </div>
        ))}
        <div style={{ padding: "7px 12px", borderTop: "1px solid rgba(38,36,33,0.08)", fontSize: 11, color: "#6b7280" }}>
          Nenhuma loja respondeu item a item ainda — as propostas acima são pelo total da lista.
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...E.quadro, padding: 0, marginBottom: 12, overflow: "hidden" }}>
      <div style={{ background: "#fafafa", padding: "8px 12px", borderBottom: "1px solid rgba(38,36,33,0.10)", fontSize: 12, fontWeight: 700, color: "#111827" }}>
        Preço por item · {comPreco.length} {comPreco.length === 1 ? "loja" : "lojas"}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? 480 : 0 }}>
          <thead>
            <tr style={{ background: "#fff" }}>
              <th style={th}>Material</th>
              <th style={{ ...th, textAlign: "right" }}>Qtd.</th>
              {comPreco.map((l) => (
                <th key={l.propostaId} style={{ ...th, textAlign: "right" }}>{l.favorecido || "Loja"}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cmp.itens.map((it) => {
              const melhor = cmp.porItem[it.id];
              return (
                <tr key={it.id}>
                  <td style={td}>
                    {it.descricao || "Item"}
                    {it.unidade ? <span style={{ color: "#6b7280" }}> · {it.unidade}</span> : null}
                  </td>
                  <td style={{ ...td, textAlign: "right", color: "#4b5563" }}>
                    {quantidadeDoItem(it) > 0 ? qtdBR(quantidadeDoItem(it)) : "—"}
                  </td>
                  {comPreco.map((l) => {
                    const p = propostaPorId(cot, l.propostaId);
                    const u = precoUnitario(p, it.id);
                    const ganhou = melhor && melhor.propostaId === l.propostaId && comPreco.length > 1;
                    return (
                      <td key={l.propostaId} style={{ ...td, textAlign: "right",
                        color: u > 0 ? (ganhou ? "#15803d" : "#111827") : "#9ca3af",
                        fontWeight: ganhou ? 700 : 400 }}>
                        {u > 0 ? dinheiro(u) : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr>
              <td style={{ ...td, fontWeight: 700, borderTop: "1.5px solid rgba(38,36,33,0.18)" }}>Total da lista</td>
              <td style={{ ...td, borderTop: "1.5px solid rgba(38,36,33,0.18)" }} />
              {comPreco.map((l) => (
                <td key={l.propostaId} style={{ ...td, textAlign: "right", fontWeight: 700,
                  borderTop: "1.5px solid rgba(38,36,33,0.18)" }}>
                  {l.total > 0 ? dinheiro(l.total) : "—"}
                  {l.faltando > 0 && (
                    <div style={{ fontSize: 10.5, fontWeight: 400, color: "#b45309" }}>
                      faltam {l.faltando} {l.faltando === 1 ? "item" : "itens"}
                    </div>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ padding: "7px 12px", borderTop: "1px solid rgba(38,36,33,0.08)", fontSize: 11.5, color: "#4b5563" }}>
        {cmp.ganhoDaDivisao > 0
          ? `Comprando cada item onde está mais barato sairia ${dinheiro(cmp.totalDividido)} — ${dinheiro(cmp.ganhoDaDivisao)} a menos que a loja mais barata na lista inteira. Por enquanto a escolha é de uma loja só; dividir o pedido entre lojas é o próximo passo.`
          : "O verde marca o melhor preço de cada item."}
      </div>
    </div>
  );
}

// ── Escolher insumo da lista, sem sair do formulário ────────────
// Montar um pedido de loja é escolher vinte coisas em sequência. Um <select>
// com 200 opções, ou um formulário por item, matam isso. Aqui se digita
// "cimen", aparecem as opções, Enter põe na lista e o campo já está limpo
// para o próximo.
function SeletorInsumo({ insumos, aoEscolher, isMobile }) {
  const E = COT_ESTILO;
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const [marcado, setMarcado] = useState(0);
  // Sem acento também acha: ninguém digita "tábua" nem "cerâmica" com acento
  // no meio de um pedido de vinte itens.
  const semAcento = (t) => (typeof normalizarTexto === "function"
    ? normalizarTexto(t)
    : String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const busca = semAcento(termo).trim();
  const achados = !busca ? [] : (insumos || [])
    .filter((i) => i && i.tipo !== "prestador")
    .filter((i) => {
      const alvo = semAcento([i.nome, i.codigo, i.grupo, ...(i.aliases || [])].join(" "));
      return busca.split(/\s+/).every((t) => alvo.indexOf(t) >= 0);
    })
    .slice(0, 8);

  const escolher = (ins) => {
    if (!ins) return;
    aoEscolher(ins);
    setTermo(""); setAberto(false); setMarcado(0);
  };

  return (
    <div style={{ position: "relative" }}>
      <input style={E.input} value={termo} placeholder="Digite para achar o material — cimento, prego, tábua…"
        onChange={(e) => { setTermo(e.target.value); setAberto(true); setMarcado(0); }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onKeyDown={(e) => {
          if (!achados.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setMarcado((m) => Math.min(m + 1, achados.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setMarcado((m) => Math.max(m - 1, 0)); }
          if (e.key === "Enter") { e.preventDefault(); escolher(achados[marcado]); }
          if (e.key === "Escape") setAberto(false);
        }} />
      {aberto && achados.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 40, background: "#fff",
          border: "1px solid rgba(38,36,33,0.16)", borderRadius: 10, marginTop: 4, overflow: "hidden",
          boxShadow: "0 14px 34px -14px rgba(17,24,39,0.35)" }}>
          {achados.map((i, k) => (
            <div key={i.codigo || i.id || k} onMouseDown={(e) => { e.preventDefault(); escolher(i); }}
              onMouseEnter={() => setMarcado(k)}
              style={{ padding: "7px 11px", cursor: "pointer", background: k === marcado ? "#eef5ff" : "#fff",
                borderTop: k ? "1px solid rgba(38,36,33,0.06)" : "none" }}>
              <div style={{ fontSize: 12.5, color: "#111827" }}>{i.nome}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>
                {[i.codigo, i.grupo, i.unidade].filter(Boolean).join(" · ")}
              </div>
            </div>
          ))}
        </div>
      )}
      {busca && !achados.length && (
        <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 4 }}>
          Nenhum insumo com esse nome. Dá para pôr o item à mão na linha abaixo.
        </div>
      )}
    </div>
  );
}

// ── A folha do pedido, para imprimir ou salvar em PDF ───────────
// Mesma mecânica da folha de comprovantes: a folha vira a única coisa da
// página na hora de imprimir, e o navegador salva em PDF.
const COT_CSS_PEDIDO = `
@page { size: A4 portrait; margin: 14mm; }
body[data-vk-imprimindo-pedido="1"] > *:not([data-vk-pedido="1"]) { display: none !important; }
body[data-vk-imprimindo-pedido="1"] [data-vk-pedido="1"] {
  position: static !important; inset: auto !important; overflow: visible !important;
  background: #fff !important; padding: 0 !important; width: auto !important; height: auto !important;
}
[data-vk-pedido="1"] [data-vk-so-tela="1"] { display: none !important; }
`;

function FolhaPedido({ cot, proposta, ctx, aoFechar }) {
  const alvo = useRef(null);
  useEffect(() => {
    const el = alvo.current || (typeof document !== "undefined" && document.querySelector('[data-vk-pedido="1"]'));
    if (!el || typeof document === "undefined") return;
    const estilo = document.createElement("style");
    estilo.textContent = COT_CSS_PEDIDO;
    document.head.appendChild(estilo);
    const antes = () => document.body.setAttribute("data-vk-imprimindo-pedido", "1");
    const depois = () => document.body.removeAttribute("data-vk-imprimindo-pedido");
    window.addEventListener("beforeprint", antes);
    window.addEventListener("afterprint", depois);
    const esc = (e) => { if (e.key === "Escape") aoFechar(); };
    document.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("beforeprint", antes);
      window.removeEventListener("afterprint", depois);
      document.removeEventListener("keydown", esc);
      depois();
      if (estilo.parentNode) estilo.parentNode.removeChild(estilo);
    };
  }, [aoFechar]);

  const E = COT_ESTILO;
  const x = ctx || {};
  const itens = itensDaCotacao(cot);
  const rotulo = { fontSize: 9.5, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 };
  const th = { padding: "6px 8px", fontSize: 10.5, color: "#4b5563", fontWeight: 700, textAlign: "left", borderBottom: "1px solid rgba(38,36,33,0.2)" };
  const td = { padding: "6px 8px", fontSize: 11.5, color: "#111827", borderBottom: "1px solid rgba(38,36,33,0.08)", verticalAlign: "top" };

  return (
    <div data-vk-pedido="1" ref={alvo}
      style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 9000, overflow: "auto", padding: 24 }}>
      <div data-vk-so-tela="1" style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginBottom: 16 }}>
        <button style={E.btn} onClick={() => window.print()}>Imprimir / salvar PDF</button>
        <button style={E.btnSec} onClick={aoFechar}>Fechar</button>
      </div>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16,
          borderBottom: "2px solid #111827", paddingBottom: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>
              Pedido de materiais{cot.numeroPedido ? ` ${cot.numeroPedido}` : ""}
            </div>
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>{cot.titulo || "Materiais"}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#4b5563" }}>
            <div style={{ fontWeight: 700, color: "#111827" }}>{x.escritorio || ""}</div>
            <div>{new Date().toLocaleDateString("pt-BR")}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div><div style={rotulo}>Obra</div><div style={{ fontSize: 12.5, color: "#111827" }}>{x.obra || "—"}</div></div>
          <div><div style={rotulo}>Fornecedor</div><div style={{ fontSize: 12.5, color: "#111827" }}>{(proposta && proposta.favorecido) || "—"}</div></div>
          {x.endereco ? <div style={{ gridColumn: "1 / -1" }}><div style={rotulo}>Entrega</div><div style={{ fontSize: 12.5, color: "#111827" }}>{x.endereco}</div></div> : null}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 28 }}>#</th>
              <th style={th}>Material</th>
              <th style={{ ...th, width: 90, textAlign: "right" }}>Qtd.</th>
              <th style={{ ...th, width: 70 }}>Un.</th>
              {proposta ? <th style={{ ...th, width: 90, textAlign: "right" }}>Unitário</th> : null}
              {proposta ? <th style={{ ...th, width: 96, textAlign: "right" }}>Total</th> : null}
            </tr>
          </thead>
          <tbody>
            {(itens.length ? itens : [{ id: "u", descricao: cot.titulo, unidade: cot.unidade, quantidade: cot.quantidade }]).map((it, i) => {
              const q = quantidadeDoItem(it);
              const u = proposta ? precoUnitario(proposta, it.id) : 0;
              return (
                <tr key={it.id}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>{it.descricao || "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{q > 0 ? qtdBR(q) : "—"}</td>
                  <td style={td}>{it.unidade || "—"}</td>
                  {proposta ? <td style={{ ...td, textAlign: "right" }}>{u > 0 ? fmtMoedaCtr(u) : "—"}</td> : null}
                  {proposta ? <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{u > 0 ? fmtMoedaCtr(u * q) : "—"}</td> : null}
                </tr>
              );
            })}
          </tbody>
        </table>
        {proposta && valorDaProposta(cot, proposta) > 0 && (
          <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 12 }}>
            Total: {fmtMoedaCtr(valorDaProposta(cot, proposta))}
          </div>
        )}
        {String(cot.escopo || "").trim() ? (
          <div style={{ fontSize: 11.5, color: "#4b5563", whiteSpace: "pre-wrap", borderTop: "1px solid rgba(38,36,33,0.12)", paddingTop: 10 }}>
            {cot.escopo}
          </div>
        ) : null}
        {x.contato ? (
          <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 10 }}>Contato: {x.contato}</div>
        ) : null}
      </div>
    </div>
  );
}

// Campo de anexo: arrasta o PDF do e-mail para cá, ou clica e escolhe.
function CampoAnexoProposta({ anexo, onTrocar, onErro, categoria, chamada, apoio }) {
  const [sobre, setSobre] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // "Abrir" aqui era um link direto para a URL do storage. Como o arquivo
  // sobe SEM a extensão .pdf (é o que faz o storage aceitar entregá-lo), ele
  // volta como octet-stream e o navegador não tem escolha: baixa para a pasta
  // de downloads com um nome sem extensão, que é o "arquivo estranho".
  // O visor resolve porque busca o arquivo, confere o cabeçalho %PDF e o
  // reembala como application/pdf antes de mostrar.
  const [vendo, setVendo] = useState(false);
  const refInput = useRef(null);
  const E = COT_ESTILO;

  async function receber(arquivo) {
    if (!arquivo) return;
    setEnviando(true);
    onErro("");
    try { onTrocar(await enviarAnexo(arquivo, categoria || "proposta_cotacao")); }
    catch (e) { onErro(e.message || "Não foi possível anexar o arquivo."); }
    finally { setEnviando(false); }
  }

  // Print de tela colado com Ctrl+V. O evento é escutado no documento
  // inteiro, e não só no campo, porque ninguém clica no campo antes de
  // colar — dá o Print Screen e cola.
  //
  // Duas guardas: pasta feita DENTRO de um campo de texto é texto de quem
  // está digitando, não anexo; e com um anexo já posto, colar não troca
  // sozinho o que está lá (remova primeiro, que é uma ação consciente).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const aoColar = (e) => {
      if (anexo || enviando) return;
      const alvo = e.target;
      const digitando = alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable);
      if (digitando) return;
      const f = arquivoColado(e.clipboardData);
      if (!f) return;
      e.preventDefault();
      // o arquivo colado vem sem nome de verdade; damos um com data
      const comNome = (typeof File === "function" && f.name === "image.png")
        ? new File([f], nomeDoColado(categoria, f.type), { type: f.type })
        : f;
      receber(comNome);
    };
    document.addEventListener("paste", aoColar);
    return () => document.removeEventListener("paste", aoColar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anexo, enviando, categoria]);

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
        <button type="button" style={E.btnSec} onClick={() => setVendo(true)}>Abrir</button>
        <button style={E.btnSec} onClick={remover}>Remover</button>
        {vendo && <VisorProposta anexo={anexo} aoFechar={() => setVendo(false)} />}
      </div>
    );
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setSobre(true); }}
      onDragLeave={() => setSobre(false)}
      onDrop={e => { e.preventDefault(); setSobre(false); receber(e.dataTransfer.files && e.dataTransfer.files[0]); }}
      onClick={() => refInput.current && refInput.current.click()}
      onPaste={e => { const f = arquivoColado(e.clipboardData); if (f) { e.preventDefault(); receber(f); } }}
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); refInput.current && refInput.current.click(); } }}
      style={{
        border: `1.5px dashed ${sobre ? "#0474f4" : "rgba(38,36,33,0.22)"}`,
        borderRadius: 12, padding: "18px 14px", textAlign: "center", cursor: "pointer",
        background: sobre ? "#f0f7ff" : "#fafafa", transition: "all .15s ease",
      }}>
      <input ref={refInput} type="file" accept="application/pdf,image/*" style={{ display: "none" }}
        onChange={e => { receber(e.target.files && e.target.files[0]); e.target.value = ""; }} />
      <div style={{ fontSize: 12.5, color: "#111827", fontWeight: 600 }}>
        {enviando ? "Enviando…" : (chamada || "Arraste o PDF da proposta aqui")}
      </div>
      <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 3 }}>
        {apoio || "clique para escolher, ou cole com Ctrl+V — PDF ou foto, até 10 MB"}
      </div>
    </div>
  );
}

// ── O quadro de pagamentos, dentro da cotação ───────────────────
// Definir três entregas com valor e data é um acerto com o fornecedor. Ele
// tem que estar aqui, onde se abre a cotação, e não só espalhado por quatro
// linhas do contas a pagar — lá está o fluxo do mês, aqui está a compra.
function QuadroPagamentosCotacao({ cot, contas, hoje, dinheiro, isMobile, datasEdit, aoMudarData }) {
  const E = COT_ESTILO;
  const { fonte, linhas } = linhasDoPagamento(cot, contas, hoje);
  if (!linhas.length) return null;
  // Em edição a coluna do vencimento vira campo. Conta paga não entra: a
  // data dela é fato consumado, e mexer nela falsificaria o realizado.
  const emEdicao = !!datasEdit;
  const dataDe = (id) => {
    const l = (datasEdit || []).find((x) => x.id === id);
    return l ? l.vencimento : "";
  };
  const p = cot.pagamento || {};
  const total = Math.round(linhas.reduce((a, l) => a + (Number(l.valor) || 0), 0) * 100) / 100;
  const pagas = linhas.filter((l) => l.pago);
  const dia = (iso) => (iso ? new Date(String(iso).slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR") : "—");
  const cols = isMobile ? "1fr 96px" : "1fr 120px 110px 92px";
  return (
    <div style={{ ...E.quadro, padding: 0, marginBottom: 12, overflow: "hidden" }}>
      <div style={{ background: "#fafafa", padding: "8px 12px", borderBottom: "1px solid rgba(38,36,33,0.10)",
        display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
          {cot.numeroPedido ? `Pedido ${cot.numeroPedido} · ` : ""}Pagamentos combinados
        </span>
        <span style={{ fontSize: 11.5, color: "#4b5563" }}>
          {p.modo ? `${resumoDoPlano(p)} · ` : ""}{dinheiro(total)}
          {pagas.length ? ` · ${pagas.length} de ${linhas.length} pago${pagas.length === 1 ? "" : "s"}` : ""}
        </span>
      </div>
      {!isMobile && (
        <div style={{ display: "grid", gridTemplateColumns: cols, gap: 8, padding: "6px 12px",
          borderBottom: "1px solid rgba(38,36,33,0.08)", fontSize: 11, color: "#6b7280", fontWeight: 600 }}>
          <div>Etapa</div><div>Vencimento</div><div style={{ textAlign: "right" }}>Valor</div><div>Situação</div>
        </div>
      )}
      {linhas.map((l) => (
        <div key={l.id} style={{ display: "grid", gridTemplateColumns: cols, gap: 8, padding: "7px 12px",
          borderTop: "1px solid rgba(38,36,33,0.06)", alignItems: "center" }}>
          <div style={{ fontSize: 12.5, color: "#111827" }}>{l.descricao}</div>
          {!isMobile && (emEdicao && !l.pago
            ? <input type="date" style={{ ...E.input, padding: "4px 7px", fontSize: 12 }}
                value={dataDe(l.id)} onChange={(e) => aoMudarData(l.id, e.target.value)} />
            : <div style={{ fontSize: 12, color: "#4b5563" }}>{dia(l.vencimento)}</div>)}
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#111827", textAlign: isMobile ? "left" : "right" }}>{dinheiro(l.valor)}</div>
          {!isMobile && (
            <div style={{ fontSize: 11.5, color: l.pago ? "#15803d" : l.vencida ? "#b45309" : "#4b5563" }}>
              {l.pago ? `Pago ${dia(l.pagoEm)}` : l.vencida ? "Vencido" : "Em aberto"}
            </div>
          )}
          {isMobile && (emEdicao && !l.pago
            ? <div style={{ gridColumn: "1 / -1" }}>
                <input type="date" style={{ ...E.input, padding: "4px 7px", fontSize: 12 }}
                  value={dataDe(l.id)} onChange={(e) => aoMudarData(l.id, e.target.value)} />
              </div>
            : <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: l.pago ? "#15803d" : l.vencida ? "#b45309" : "#6b7280" }}>
                {dia(l.vencimento)} · {l.pago ? `pago ${dia(l.pagoEm)}` : l.vencida ? "vencido" : "em aberto"}
              </div>)}
        </div>
      ))}
      <div style={{ padding: "7px 12px", borderTop: "1px solid rgba(38,36,33,0.08)", fontSize: 11, color: "#6b7280" }}>
        {fonte === "plano"
          ? "Este é o acerto registrado — o lançamento em contas a pagar foi desfeito, então não há contas correspondentes no momento."
          : emEdicao
          ? "Mude o vencimento do que saiu da data. Só as linhas que você alterar se movem, e as pagas não se mexem."
          : "São as mesmas contas a pagar: o que mudar aqui muda lá, e o que mudar lá aparece aqui."}
        {p.definidoPor ? ` Combinado por ${nomeGravado(p.definidoPor)}${dataCurta(p.definidoEm) ? ` em ${dataCurta(p.definidoEm)}` : ""}.` : ""}
      </div>
    </div>
  );
}

// Telinha de aprovar/recusar. Fica separada para o motivo ter estado
// próprio — dentro da lista, cada tecla digitada rerenderizaria tudo.
function CotacaoDecisao({ cotacao, status, registrando, dinheiro, onConfirmar, onFechar }) {
  const [motivo, setMotivo] = useState("");
  const [quem, setQuem] = useState("");
  const E = COT_ESTILO;
  const esc = propostaEscolhida(cotacao);
  const aprovar = status === "aprovada";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 60 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 420 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
          {registrando ? "Registrar a resposta do cliente" : aprovar ? "Aprovar esta escolha" : "Recusar esta escolha"}
        </div>
        <div style={{ fontSize: 12.5, color: "#4b5563", marginBottom: 14 }}>
          {cotacao.titulo} — {esc ? `${esc.favorecido}, ${dinheiro(valorProposta(esc))}` : "sem proposta escolhida"}.
          {registrando ? " A resposta veio por fora do sistema; fica gravado que foi você quem registrou." : ""}
        </div>
        {registrando && (
          <div style={{ marginBottom: 12 }}>
            <label style={E.label}>Quem respondeu</label>
            <input style={E.input} value={quem} onChange={e => setQuem(e.target.value)} placeholder="Nome do cliente" />
          </div>
        )}
        <label style={E.label}>{aprovar || registrando ? "Observação (opcional)" : "Por que está recusando?"}</label>
        <textarea style={{ ...E.input, minHeight: 64, resize: "vertical", marginBottom: 16 }} value={motivo} onChange={e => setMotivo(e.target.value)} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {registrando ? (
            <>
              <button style={E.btn} onClick={() => onConfirmar(motivo, quem, "aprovada")}>Registrar aprovação</button>
              <button style={{ ...E.btnSec, color: "#dc2626" }} onClick={() => onConfirmar(motivo, quem, "recusada")}>Registrar recusa</button>
            </>
          ) : (
            <button style={E.btn} onClick={() => onConfirmar(motivo)}>{aprovar ? "Aprovar" : "Recusar"}</button>
          )}
          <button style={E.btnSec} onClick={onFechar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
