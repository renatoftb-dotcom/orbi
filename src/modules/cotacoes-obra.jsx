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
    // lojas para quem a lista já foi mandada (ver registrarEnvioDaLista)
    enviosLista: [],
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
    // cotação item a item: unitário de cada item da lista (ver precoUnitario)
    precos: {},
    // "leva tudo por X" — o total de fechamento, quando a loja dá desconto
    // na lista inteira (ver valoresComDesconto)
    totalFechado: "",
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

// O total de UM item, pelo preço de tabela.
function totalBrutoItem(cot, proposta, item) {
  return Math.round(precoUnitario(proposta, item.id) * quantidadeDoItem(item) * 100) / 100;
}

// Unitário a partir do total do item — o outro sentido do mesmo campo. A
// loja tanto manda "40,00 o saco" quanto "1.200,00 os trinta sacos", e as
// duas contas são a mesma; quem digita escolhe por onde entra.
//
// O unitário é o que fica gravado, porque é ele que compara loja com loja.
// Seis casas evitam que 1.000,00 em 3 unidades volte como 999,99.
function unitarioDoTotal(total, quantidade) {
  // aceita tanto número quanto o texto em pt-BR de um formulário
  const q = numeroDoCampo(quantidade);
  const t = numeroDoCampo(total);
  if (!(q > 0)) return 0;
  return Math.round((t / q) * 1e6) / 1e6;
}

// ── O total fechado com a loja ──────────────────────────────────
// "Leva tudo por 2.300" não é um preço novo de cada item: é um desconto no
// fechamento. Guardar só o total jogaria fora a cotação item a item, que é o
// que permite comparar. Então guardam-se os dois — os preços de tabela e o
// total negociado — e o desconto é DISTRIBUÍDO proporcionalmente para a
// conta fechar, sem apagar o que a loja tinha cotado.
function totalNegociadoDigitado(proposta) {
  return numeroDoCampo((proposta || {}).totalFechado);
}

// Os valores de cada item depois do desconto. A sobra dos arredondamentos
// vai para o último item com valor — sem isso a soma das partes não bate com
// o total combinado, e é justamente o total que foi combinado.
function valoresComDesconto(cot, proposta) {
  const bruto = totalDosItens(cot, proposta);
  const alvo = totalNegociadoDigitado(proposta);
  if (!(bruto > 0) || !(alvo > 0) || alvo === bruto) return null;
  const comValor = itensDaCotacao(cot).filter((it) => totalBrutoItem(cot, proposta, it) > 0);
  if (!comValor.length) return null;
  const r = {};
  let acumulado = 0;
  comValor.forEach((it, i) => {
    if (i === comValor.length - 1) {
      r[it.id] = Math.round((alvo - acumulado) * 100) / 100;
      return;
    }
    const v = Math.round(totalBrutoItem(cot, proposta, it) * (alvo / bruto) * 100) / 100;
    r[it.id] = v;
    acumulado = Math.round((acumulado + v) * 100) / 100;
  });
  return r;
}

// O total do item como ele de fato vai sair: com desconto quando há desconto.
function totalEfetivoItem(cot, proposta, item) {
  const d = valoresComDesconto(cot, proposta);
  if (d && d[item.id] != null) return d[item.id];
  return totalBrutoItem(cot, proposta, item);
}

// O unitário efetivo — é por ele que se compara loja com loja, porque é o
// preço que se vai pagar.
function precoEfetivo(cot, proposta, item) {
  const q = quantidadeDoItem(item);
  if (!(q > 0)) return precoUnitario(proposta, item.id);
  return Math.round((totalEfetivoItem(cot, proposta, item) / q) * 1e6) / 1e6;
}

function totalNegociado(cot, proposta) {
  const bruto = totalDosItens(cot, proposta);
  const alvo = totalNegociadoDigitado(proposta);
  return valoresComDesconto(cot, proposta) ? alvo : bruto;
}

function descontoDaProposta(cot, proposta) {
  const bruto = totalDosItens(cot, proposta);
  if (!valoresComDesconto(cot, proposta)) return null;
  const alvo = totalNegociadoDigitado(proposta);
  const dif = Math.round((bruto - alvo) * 100) / 100;
  return { bruto, alvo, valor: Math.abs(dif), desconto: dif > 0,
    pct: bruto > 0 ? Math.round((Math.abs(dif) / bruto) * 1000) / 10 : 0 };
}

// O valor que vale para esta proposta: o total fechado quando há preço por
// item, senão o total digitado.
function valorDaProposta(cot, proposta) {
  return propostaTemPrecoPorItem(cot, proposta) ? totalNegociado(cot, proposta) : valorProposta(proposta);
}

// Qual loja está mais barata em cada item. É o que permite olhar a lista e
// ver que o cimento é numa e a madeira é na outra.
function melhorPorItem(cot) {
  const r = {};
  for (const it of itensDaCotacao(cot)) {
    let melhor = null;
    for (const p of propostasDaCotacao(cot)) {
      if (!(precoUnitario(p, it.id) > 0)) continue;
      // compara pelo preço EFETIVO: a loja que deu desconto no fechamento
      // está mais barata de verdade, e é assim que ela tem que aparecer
      const u = precoEfetivo(cot, p, it);
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

// Dinheiro na tela nunca aparece cru. "14.8" é como a máquina guarda; quem
// lê uma nota lê "14,80" — duas casas e vírgula, sempre, mesmo quando o
// papel veio com uma casa só. Sem o "R$" porque isto é coluna de números,
// onde o símbolo repetido em toda linha só atrapalha a comparação.
function valorBR(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function textoDoPedido(cot, proposta, ctx) {
  const c = cot || {};
  const x = ctx || {};
  // A mensagem é só o que a loja precisa ler: para onde vai e o que é. Nome
  // do escritório, título da cotação e telefone ficam de fora — o título é
  // nome interno ("Material diversos lojas"), e o resto o vendedor já tem,
  // porque a conversa sai do WhatsApp de quem manda.
  // Uma linha só: o nome da obra e onde ela fica. Para a loja isso é uma
  // informação — é o endereço da entrega — e não duas.
  const linhas = [];
  const ondeVai = [x.obra, x.endereco].filter(Boolean).join(" — ");
  if (ondeVai) { linhas.push(`Obra: ${ondeVai}`); linhas.push(""); }
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
  // O escopo e o telefone do escritório NÃO entram: a mensagem sai do seu
  // próprio WhatsApp, então o vendedor já sabe com quem fala e responde ali
  // mesmo. O escopo continua na folha do pedido, que é documento e vai
  // parar na mão de quem não estava na conversa.
  return linhas.join("\n");
}

// ══════════════════════════════════════════════════════════════
// LER O PEDIDO DO PEDREIRO
// ══════════════════════════════════════════════════════════════
// A mensagem chega como ela é: "10 sacos de cimento / 30 tabuas de 30cm x
// 3mts / meio metro de areia". Ninguém vai digitar isso de novo item a item.
//
// O que se faz aqui é PROPOR: separa as linhas, tira a quantidade, e procura
// cada material no catálogo. Acerto exato entra resolvido; parecido entra
// como sugestão para você escolher; o que não bate com nada entra como item
// solto, com o texto do pedreiro. Nada é vinculado por parecença sozinho —
// é a mesma regra do resto do VICKE, e é o que impede uma lista de compra
// nascer com o material errado dentro.

// Palavras de EMBALAGEM e MEDIDA que podem sair da descrição sem perder o
// material. "Barra", "tábua" e "vara" ficam de fora de propósito: elas fazem
// parte do nome do insumo ("Aço - Barras de CA50"), e tirá-las quebraria a
// busca.
const COT_UNIDADES_PEDIDO = [
  "unidades", "unidade", "unid", "und", "un",
  "pecas", "peca", "pcs", "pc",
  "sacos", "saco", "sc",
  "caixas", "caixa", "cx",
  "latas", "lata", "baldes", "balde", "galoes", "galao",
  "rolos", "rolo", "fardos", "fardo", "pacotes", "pacote",
  "milheiros", "milheiro", "duzias", "duzia", "dz",
  "quilos", "quilo", "kilos", "kilo", "kg",
  "litros", "litro", "lts", "lt",
  "metros", "metro", "mts", "mt",
  "m2", "m3",
];

function cotSemAcento(t) {
  return typeof normalizarTexto === "function"
    ? normalizarTexto(t)
    : String(t == null ? "" : t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

// "1/2" → 0,5; "2,5" → 2,5; "meia"/"meio" → 0,5
function quantidadeDoTexto(txt) {
  const t = String(txt == null ? "" : txt).trim();
  if (/^mei[oa]$/i.test(cotSemAcento(t))) return 0.5;
  const fr = /^(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (fr) {
    const b = Number(fr[2]);
    return b ? Math.round((Number(fr[1]) / b) * 1e4) / 1e4 : 0;
  }
  // com vírgula, o ponto é separador de milhar ("1.200,5"); sem vírgula, um
  // ponto sozinho é decimal ("2.5") — tirar o ponto aí viraria 25
  const limpo = t.indexOf(",") >= 0 ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = parseFloat(limpo);
  return Number.isFinite(n) ? n : 0;
}

// Uma linha do recado. Devolve o que dá para afirmar; o que não dá fica
// vazio, para a pessoa preencher — chutar quantidade é pior que perguntar.
function interpretarLinhaDePedido(linha) {
  const bruto = String(linha == null ? "" : linha).trim();
  // tira marcador de lista ("- ", "• ", "1) ", "2. ") sem comer "2.5"
  let t = bruto.replace(/^[\s\-–—*•▪·]+/, "").replace(/^\d{1,2}[\).]\s+/, "").trim();
  if (!t) return null;

  const uni = COT_UNIDADES_PEDIDO.join("|");
  let quantidade = "";
  let unidade = "";
  let resto = t;

  // 1) começa com número (ou "meio/meia") — é o jeito que quase todo mundo escreve
  const inicio = new RegExp(`^(mei[oa]|\\d+\\s*/\\s*\\d+|\\d+(?:[.,]\\d+)?)\\s*(${uni})?\\b\\.?\\s*`, "i").exec(t);
  // 2) número colado numa unidade em qualquer lugar ("prego 17x27 2 kg").
  //    Medida que faz parte da descrição não conta: em "tábuas de 30cm x
  //    3mts" o "3mts" é o tamanho da tábua, não quantas são — e o que marca
  //    isso é o "x" colado antes ou depois.
  const meio = (() => {
    const re = new RegExp(`\\b(\\d+(?:[.,]\\d+)?)\\s*(${uni})\\b\\.?`, "gi");
    let m2;
    while ((m2 = re.exec(t))) {
      const antes = t.slice(Math.max(0, m2.index - 4), m2.index);
      const depois = t.slice(m2.index + m2[0].length, m2.index + m2[0].length + 4);
      if (/[x×]\s*$/i.test(antes) || /^\s*[x×]\b/i.test(depois)) continue;
      return { valor: m2[1], unidade: m2[2], index: m2.index, tamanho: m2[0].length };
    }
    return null;
  })();
  // 3) número solto no fim ("cimento 10")
  const fim = /\s(\d+(?:[.,]\d+)?)\s*$/.exec(t);

  if (inicio) {
    quantidade = quantidadeDoTexto(inicio[1]);
    unidade = inicio[2] || "";
    resto = t.slice(inicio[0].length);
  } else if (meio) {
    quantidade = quantidadeDoTexto(meio.valor);
    unidade = meio.unidade || "";
    // "compra pra nois 30 sacos DE CIMENTO": numa frase corrida o material
    // vem depois da quantidade, e o que vem antes é conversa. Mas em "prego
    // 17x27 2 kg" não sobra nada depois — aí o material é o que veio antes.
    const depois = t.slice(meio.index + meio.tamanho).trim();
    const antes = t.slice(0, meio.index).trim();
    resto = /[a-zA-ZÀ-ÿ]{3}/.test(depois) ? depois : antes;
  } else if (fim) {
    quantidade = quantidadeDoTexto(fim[1]);
    resto = t.slice(0, fim.index).trim();
  }

  // o "de" que sobra depois de tirar a embalagem: "sacos DE cimento"
  const termo = resto.replace(/^(de|do|da|dos|das)\s+/i, "").replace(/^[\s:,-]+/, "").trim();
  return { bruto, quantidade, unidade, termo: termo || bruto };
}

// ── Achar o parecido, do jeito que o pedreiro escreve ───────────
// O casamento do catálogo (resolverInsumo) é de propósito exigente: ele
// alimenta preço e orçamento, e errar lá contamina conta. Aqui o caso é
// outro — é uma lista de compra que passa pelos seus olhos antes de valer.
// "Arame" tem que trazer "Arame Recozido"; "tábuas de 30" tem que trazer
// "Madeira Caixaria - Tábuas de 30cm x 3mts". Por isso a associação daqui
// olha PALAVRA por palavra, e não a distância entre as frases inteiras.
//
// Mede duas coisas: quanto do que ele escreveu existe no nome do insumo
// ── Marca não é nome ────────────────────────────────────────────
// O pedreiro escreve "luva soldável Tigre 32x25"; no catálogo o item é
// "Luva soldável 32x25", sem marca. Contar "tigre" como palavra a casar
// derrubava a nota de todo item certo. A marca sai da conta — só da conta:
// o texto que ele escreveu continua aparecendo inteiro na tela.
const COT_MARCAS = new Set(("tigre amanco krona fortlev astra deca docol lorenzetti fame perlex blukit "
  + "votoran votorantim itambe caue cauê holcim intercement gerdau belgo arcelormittal arcelor ciser "
  + "quartzolit vedacit viapol sika dryko suvinil coral sherwin williams eucatex lukscolor "
  + "tramontina pial legrand schneider siemens steck margirius weg corfio cobrecom prysmian induscabos sil "
  + "eternit brasilit precon cortag vonder irwin makita bosch dewalt stanley censi cipla plastilit")
  .split(" ").map(cotSemAcento));

function semMarcaNaLista(palavras) {
  const sem = (palavras || []).filter((p) => !COT_MARCAS.has(p));
  return sem.length ? sem : (palavras || []);     // só marca? então fica como está
}

function semMarca(texto) {
  const partes = String(texto == null ? "" : texto).split(/\s+/).filter(Boolean);
  const sem = partes.filter((p) => !COT_MARCAS.has(cotSemAcento(p)));
  return (sem.length ? sem : partes).join(" ");
}

// Busca do seletor: cada palavra digitada tem que aparecer (em qualquer
// ordem) no nome, código, grupo ou apelido. "luva 25" acha "Luva Pressão
// 25 (3/4)". Marca digitada é ignorada, igual à leitura do pedido.
function buscarNoCatalogo(insumos, termo, limite) {
  const palavras = semMarcaNaLista(cotSemAcento(termo).split(" ").filter(Boolean));
  if (!palavras.length) return [];
  return (insumos || [])
    .filter((i) => i && i.tipo !== "prestador" && i.ativo !== false)
    .filter((i) => {
      const alvo = cotSemAcento([i.nome, i.codigo, i.grupo, ...(i.aliases || [])].join(" "));
      return palavras.every((p) => alvo.indexOf(p) >= 0);
    })
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"))
    .slice(0, limite || 60);
}

// ── Casar a descrição da loja com o catálogo ─────────────
// O papel da loja escreve "Cal Hidratado Ch-iii 20kg - Pinocal"; o catálogo
// tem "Cal Hidratado 20kg". Letra a letra nunca batem — e é por isso que
// resolverInsumo, que exige igualdade de código, apelido ou nome, devolvia
// todos os onze itens do pedido como "fora do catálogo".
//
// A conta aqui é outra. Cada palavra do nome do catálogo vale conforme sua
// raridade: "pvc" está em trezentos insumos e não decide nada; "vergalhao"
// está em três e decide sozinho. O placar é quanto do PESO do nome do
// catálogo aparece na descrição da loja, mais um pedaço de quanto da
// descrição foi aproveitado — senão um nome curto e genérico casaria com
// tudo. Marca fica de fora (a loja põe, o catálogo não) e letra colada em
// número se separa, porque "8mm" e "8 mm" são a mesma medida.
//
// O que sai daqui é uma aposta, nunca uma decisão: quem carimba o insumo é
// a pessoa, com um toque. O trabalho da máquina é pôr a resposta certa na
// frente — e, depois que ela confirma, o texto da loja vira apelido do
// insumo e no mês seguinte o casamento é exato, sem aposta nenhuma.

// "x" entra aqui: em "10 x 3" ele só separa medidas, não diz o que a coisa é.
const COT_VAZIAS_CATALOGO = new Set(("de da do dos das e com para pra por a o em un x").split(" "));

function cotPalavrasDoNome(texto) {
  return cotSemAcento(texto)
    // "48mmx50m" é 48mm por 50m: o x que antecede número só separa medida.
    .replace(/x(?=\d)/g, " ")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .split(" ")
    .filter((w) => w && !COT_MARCAS.has(w) && !COT_VAZIAS_CATALOGO.has(w));
}

// O catálogo arquiva pelo que a coisa é: "Elétrica - Fita Isolante",
// "Aço - Pregos 17x21", "Madeira Caixaria - Tábuas de 10cm x 3mts". O que
// vem antes do travéssão é gaveta, não material — a nota da loja diz "Fita
// Isolante 10 Mt - Tigre" e nunca vai dizer "Elétrica". Cobrando essas
// palavras da descrição, o placar castigava justamente o insumo bem
// arquivado: "Fita Crepe", sem gaveta, dava 0,85; "Elétrica - Fita
// Isolante" dava 0,71 e ficava abaixo da linha do carimbo automático.
//
// A gaveta não sai de cena — é ela que separa "Elétrica - Fita Isolante"
// de "Hidráulica - Fita Veda Rosca" —, mas passa a valer um quarto. Duas
// gavetas com o mesmo material continuam empatadas, e empate não carimba
// sozinho: vira pergunta, como deve ser.
const COT_PESO_GAVETA = 0.25;

function cotPartesDoNome(nome) {
  const txt = String(nome == null ? "" : nome);
  const todas = cotPalavrasDoNome(txt);
  const i = txt.indexOf(" - ");
  if (i <= 0) return { gaveta: [], corpo: todas };
  const gaveta = cotPalavrasDoNome(txt.slice(0, i));
  const corpo = cotPalavrasDoNome(txt.slice(i + 3));
  // Sem corpo não há gaveta nenhuma — é nome com travéssão, não
  // arquivo. Gaveta longa também não é gaveta.
  if (!gaveta.length || !corpo.length || gaveta.length > 3) return { gaveta: [], corpo: todas };
  return { gaveta, corpo };
}

// A descrição da loja não é só o material: vem com código interno
// ("Cod 61699"), palavra de folheto ("Eco", "Premium") e a medida. Nada
// disso existe no catálogo, e cada uma dessas palavras baixava o placar,
// porque metade da conta é "quanto da descrição foi aproveitado". Quanto
// mais detalhada a nota, pior o casamento — o contrário do que deveria ser.
const COT_MARCADOR_CODIGO = new Set(("cod codigo cd ref refer referencia".split(" ")));
const COT_FOLHETO = new Set(("eco premium plus super master profissional linha standard top".split(" ")));

function cotPalavrasDaLoja(texto) {
  const todas = cotPalavrasDoNome(texto);
  const limpo = [];
  for (let i = 0; i < todas.length; i++) {
    const w = todas[i];
    // "Cod 61699": o marcador e o que vem logo depois saem juntos.
    if (COT_MARCADOR_CODIGO.has(w)) { if (/^\d+$/.test(todas[i + 1] || "")) i++; continue; }
    // Número de quatro dígitos ou mais é código, não medida.
    if (/^\d{4,}$/.test(w)) continue;
    if (COT_FOLHETO.has(w)) continue;
    limpo.push(w);
  }
  return limpo.length ? limpo : todas;
}

function cotDistancia(a, b) {
  if (typeof distanciaTexto === "function") return distanciaTexto(a, b);
  return a === b ? 0 : 99;
}

// "pregos" casa com "prego"; "0mm" com "0mmm" não precisa casar.
function cotCasaPalavra(a, b) {
  if (a === b) return 1;
  // "05" e "5" são o mesmo cinco; "3.00" e "3" o mesmo três.
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) return Number(a) === Number(b) ? 1 : 0;
  // "mt" e "mts" são a mesma unidade — a mesma tabela que arruma "un".
  if (a.length <= 4 && b.length <= 4) {
    const ua = COT_UNIDADE_SINONIMOS[a], ub = COT_UNIDADE_SINONIMOS[b];
    if (ua && ua === ub) return 0.9;
  }
  if (a.length >= 4 && b.length >= 4) {
    if (cotDistancia(a, b) <= 1) return 0.92;
    if (b.indexOf(a) === 0 || a.indexOf(b) === 0) return 0.85;
  }
  return 0;
}

// O peso das palavras sai do catálogo inteiro, então se calcula uma vez e
// serve para os onze itens do pedido.
function indiceDoCatalogo(insumos) {
  const itens = [];
  const em = new Map();
  for (const i of insumos || []) {
    if (!i || i.tipo === "prestador" || i.ativo === false) continue;
    const partes = cotPartesDoNome(i.nome);
    const palavras = partes.gaveta.concat(partes.corpo);
    if (!palavras.length) continue;
    // Na mesma ordem das palavras: o quanto cada uma pesa no placar.
    const fator = partes.gaveta.map(() => COT_PESO_GAVETA).concat(partes.corpo.map(() => 1));
    // true nas palavras que dizem o que a coisa é. A gaveta nunca é identidade:
    // a loja não escreve "Elétrica" na nota.
    const identidade = partes.gaveta.map(() => false)
      .concat(partes.corpo.map((_, k) => k < COT_PALAVRAS_DE_IDENTIDADE));
    itens.push({ insumo: i, palavras, fator, identidade });
    for (const w of new Set(palavras)) em.set(w, (em.get(w) || 0) + 1);
  }
  const n = itens.length || 1;
  return { itens, peso: (w) => Math.log((n + 1) / ((em.get(w) || 0) + 1)) + 0.2 };
}

// O nome bem-feito do catálogo diz mais do que a loja escreve: "Disco
// Diamantado Corte Parede" contra "Disco Diamantado Segmentado 110mm". As
// duas palavras que sobram do catálogo são raras, e por serem raras pesavam
// muito — castigando justamente o cadastro mais descritivo. Palavra que
// faltou continua pesando, mas pela metade: quem decide é o que bateu.
const COT_PESO_SOBRA = 0.5;

// Mas nem toda palavra que falta é qualificador. No nome do catálogo as duas
// primeiras palavras do corpo dizem O QUE a coisa é — "Disco Madeira",
// "Disco Diamantado", "Cabo Flexível" — e o que vem depois só estreita:
// "Corte Parede", "750V 4mm". Faltar um qualificador é normal, a loja quase
// nunca escreve todos. Faltar a identidade é outra coisa: "Disco Madeira"
// contra "Disco Diamantado" não é um casamento incompleto, é outro material.
// Por isso a identidade que falta pesa inteiro, e o qualificador, metade.
const COT_PALAVRAS_DE_IDENTIDADE = 2;

function casarNoCatalogo(descricao, indice, limite) {
  const ts = cotPalavrasDaLoja(descricao);
  if (!ts.length || !indice || !indice.itens.length) return [];
  const achados = [];
  for (const it of indice.itens) {
    let num = 0, den = 0;
    for (let k = 0; k < it.palavras.length; k++) {
      const t = it.palavras[k];
      const w = indice.peso(t) * (it.fator ? it.fator[k] : 1);
      let melhor = 0;
      for (const s of ts) { const v = cotCasaPalavra(t, s); if (v > melhor) melhor = v; }
      const ehIdentidade = it.identidade ? it.identidade[k] : false;
      den += w * (melhor > 0 ? 1 : (ehIdentidade ? 1 : COT_PESO_SOBRA));
      num += w * melhor;
    }
    if (!den) continue;
    let usados = 0;
    for (const s of ts) {
      for (const t of it.palavras) { if (cotCasaPalavra(t, s) > 0) { usados++; break; } }
    }
    const score = (num / den) * 0.78 + (usados / ts.length) * 0.22;
    if (score >= 0.5) achados.push({ insumo: it.insumo, score: Math.round(score * 100) / 100 });
  }
  achados.sort((a, b) => (b.score - a.score)
    || (String(a.insumo.nome).length - String(b.insumo.nome).length));
  return achados.slice(0, limite || 5);
}

// Segura = boa E sozinha. É a que entra no "casar tudo de uma vez"; as
// outras continuam valendo um toque cada, porque a segunda colocada estar
// colada quer dizer que a máquina não sabe qual das duas é.
const COT_SUGESTAO_SEGURA = 0.72;
const COT_SUGESTAO_FOLGA = 0.08;
function sugestaoDoCatalogo(descricao, indice) {
  const r = casarNoCatalogo(descricao, indice, 3);
  if (!r.length) return null;
  const folga = r.length > 1 ? r[0].score - r[1].score : r[0].score;
  return {
    codigo: r[0].insumo.codigo || "",
    nome: r[0].insumo.nome || "",
    grupo: r[0].insumo.grupo || "",
    score: r[0].score,
    segura: r[0].score >= COT_SUGESTAO_SEGURA && folga >= COT_SUGESTAO_FOLGA,
  };
}

// O apelido é o que faz a próxima vez ser exata: guardado no insumo, a
// mesma linha do mesmo papel casa por igualdade no mês seguinte. Só entra
// texto que ainda não está lá e que é diferente do próprio nome.
function comApelidoDaLoja(insumos, codigo, descricao) {
  const texto = String(descricao == null ? "" : descricao).trim();
  if (!codigo || !texto) return { insumos: insumos || [], mudou: false };
  let mudou = false;
  const lista = (insumos || []).map((i) => {
    if (!i || i.codigo !== codigo) return i;
    const atuais = i.aliases || [];
    const alvo = cotSemAcento(texto);
    if (!alvo || alvo === cotSemAcento(i.nome)) return i;
    if (atuais.some((a) => cotSemAcento(a) === alvo)) return i;
    mudou = true;
    return { ...i, aliases: atuais.concat([texto]) };
  });
  return { insumos: lista, mudou };
}

// ── A IA como segunda opinião do casamento ──────────────
// Comparar texto não sabe que "Tabua De Pinos" e "Madeira Caixaria -
// Tábuas" são a mesma coisa: são palavras diferentes para o mesmo objeto.
// A IA sabe. Então o leitor por regras faz o grosso — de graça, na hora,
// sem internet — e a IA recebe só as sobras, como texto, para dizer a qual
// insumo do catálogo cada uma corresponde. O que ela aponta entra igual às
// outras propostas: com um toque para confirmar.
//
// O reencontro é pelo texto, não pela ordem: a IA pode devolver em outra
// sequência, juntar duas linhas ou pular uma. Linha que não se reconhece é
// linha descartada — melhor faltar proposta do que carimbar o item errado.
function sugestoesDaIA(itensSemCatalogo, bruto, insumos) {
  const alvos = itensSemCatalogo || [];
  const linhas = (((bruto || {}).itens) || []).filter((l) => l && l.codigoInsumo);
  if (!alvos.length || !linhas.length) return [];
  const porCodigo = new Map();
  for (const i of insumos || []) {
    if (!i) continue;
    if (i.codigo) porCodigo.set(String(i.codigo), i);
    if (i.id) porCodigo.set(String(i.id), i);
  }
  const usados = new Set();
  const saida = [];
  for (const l of linhas) {
    const ins = porCodigo.get(String(l.codigoInsumo));
    if (!ins) continue;
    const alvo = cotSemAcento(l.descricao);
    if (!alvo) continue;
    let escolhido = -1;
    for (let k = 0; k < alvos.length; k++) {
      if (usados.has(k)) continue;
      const d = cotSemAcento(alvos[k].descricao);
      if (!d) continue;
      if (d === alvo) { escolhido = k; break; }
      if (escolhido < 0 && (d.indexOf(alvo) >= 0 || alvo.indexOf(d) >= 0)) escolhido = k;
    }
    if (escolhido < 0) continue;
    usados.add(escolhido);
    saida.push({ indice: escolhido, codigo: ins.codigo || "", nome: ins.nome || "",
      grupo: ins.grupo || "", ia: true });
  }
  return saida;
}

// O que a IA precisa ver de cada sobra: quantidade, unidade e o texto do
// papel. Preço e número do pedido não entram — o leitor por regras já os
// leu certo, e mandar de novo só aumentaria a conta.
function textoParaAIA(itens) {
  return (itens || [])
    .map((x) => [x.quantidade || "", x.unidade || "", x.descricao || ""].join(" ").trim())
    .filter(Boolean)
    .join("\n");
}

// ═════════════════════════════════════════════════════════════
// ENTRADA — uma caixa só para tudo que chega
// ═════════════════════════════════════════════════════════════
// Até aqui cada tipo de papel tinha sua porta: a proposta do fornecedor numa
// tela, a lista do pedreiro noutra, o PDF do pedido numa terceira. Só que
// quem recebe o papel não sabe de antemão o que vai fazer com ele — a mesma
// nota pode virar um pedido a pagar, o registro de algo já pago, ou a lista
// que vai para três lojas cotarem.
//
// Então a ordem se inverte: primeiro entra o material, depois se pergunta o
// que ele é. A leitura é a mesma nos três casos; o que muda é a porta de
// saída. Nada aqui lê de um jeito novo — é o leitor de PDF para papel com
// preço, e a IA (ou o leitor por regras) para texto e foto.

// Cada leitor devolve um formato. Aqui os três viram um só, no molde do item
// do pedido, para que a tela de saída receba sempre a mesma coisa.
function itemDaEntrada(cru, tipo) {
  const c = cru || {};
  if (tipo === "orcamento") {
    return { descricao: String(c.descricao || "").trim(), quantidade: c.quantidade || "",
      unidade: c.unidade || "", unitario: c.unitario || "", bruto: c.total || "",
      codigoLoja: c.codigo || "" };
  }
  // lista (IA ou leitor por regras): tem o que se pede, não o que se paga
  const ins = c.insumo || null;
  return { descricao: String(c.termo || c.descricao || c.bruto || "").trim(),
    quantidade: c.quantidade || "", unidade: c.unidade || (ins && ins.unidade) || "",
    unitario: "", bruto: "", codigoLoja: "",
    insumoCodigo: ins ? (ins.codigo || "") : "",
    grupoMaterial: ins ? (ins.grupo || "") : "" };
}

// Casa com o catálogo pelo caminho de sempre: primeiro o exato (código,
// apelido, nome igual), depois a aposta do peso das palavras. O que a IA já
// carimbou passa direto — ela olhou o catálogo pelo código.
function casarItemDaEntrada(item, insumos, indice) {
  const it = item || {};
  if (it.insumoCodigo) return it;
  const lista = insumos || [];
  if (typeof resolverInsumo === "function") {
    const r = resolverInsumo(it.descricao, lista);
    if (r && r.insumo) {
      return { ...it, insumoCodigo: r.insumo.codigo || "", grupoMaterial: r.insumo.grupo || "",
        unidade: it.unidade || r.insumo.unidade || "",
        etapa: it.etapa || r.insumo.etapaPadrao || "",
        contaId: it.contaId || r.insumo.contaPadrao || "", sugestao: null };
    }
  }
  return { ...it, sugestao: sugestaoDoCatalogo(it.descricao, indice) };
}

function itensDaEntrada(bruto, tipo, insumos) {
  const crus = tipo === "orcamento" ? (((bruto || {}).itens) || []) : (bruto || []);
  const indice = indiceDoCatalogo(insumos || []);
  const unidades = unidadesDoCatalogo(insumos || []);
  return crus
    .map((c) => itemDaEntrada(c, tipo))
    .filter((x) => x.descricao)
    .map((x) => ({ ...x, unidade: unidadeNoPadrao(x.unidade, unidades) }))
    .map((x) => casarItemDaEntrada(x, insumos, indice))
    .map((x) => ({ ...(typeof itemDoPedidoVazio === "function" ? itemDoPedidoVazio() : {}), ...x }));
}

// O que a leitura achou, em uma frase — é o que a pessoa confere antes de
// dizer o que o papel é.
// Duas descrições DIFERENTES apontando para o mesmo insumo não podem
// carimbar as duas: uma delas está errada. "Plugue Pad 2p+t 10a Cz" e
// "Tomada Pad 2p+t 10a Cz" são quase a mesma frase; se o catálogo só tem a
// tomada, as duas linhas apostam nela e o pedido nasce com um plugue que é
// uma tomada. Carimba a de melhor placar; a outra fica esperando um toque —
// que é quando a pessoa vê que falta cadastrar o plugue.
//
// Repetição do MESMO texto continua valendo: nota com duas linhas do mesmo
// material é comum, e as duas devem casar.
function casamentosSeguros(itens) {
  const cand = [];
  (itens || []).forEach((x, i) => {
    if (!x || x.insumoCodigo || !x.sugestao || !x.sugestao.segura || !x.sugestao.codigo) return;
    cand.push({ i, codigo: x.sugestao.codigo, score: Number(x.sugestao.score) || 0,
      texto: cotSemAcento(String(x.descricao || "")) });
  });
  const porCodigo = new Map();
  for (const c of cand) {
    const g = porCodigo.get(c.codigo) || [];
    g.push(c); porCodigo.set(c.codigo, g);
  }
  const ok = [];
  porCodigo.forEach((g) => {
    const textos = new Set(g.map((c) => c.texto));
    if (textos.size <= 1) { for (const c of g) ok.push(c.i); return; }
    const melhor = g.slice().sort((a, b) => (b.score - a.score) || (a.i - b.i))[0];
    for (const c of g) if (c.texto === melhor.texto) ok.push(c.i);
  });
  return ok.sort((a, b) => a - b);
}

// ── Ditar a lista ────────────────────────────────
// Na obra não se digita: a mão está suja, o telefone fica no bolso e a lista
// é falada. O reconhecimento de voz é do próprio navegador — nada sai para
// servidor nenhum, não há chave nem custo por minuto. O que ele devolve cai
// na mesma caixa de texto, e daí segue pelo leitor de sempre.

// Quem fala diz "dez sacos"; o leitor de lista procura "10". Sem esta
// tradução, toda linha ditada chegaria sem quantidade — e quantidade em
// branco é justamente o que trava o lançamento lá na frente.
const COT_EXTENSO_UNIDADE = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
  quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19,
};
const COT_EXTENSO_DEZENA = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
  setenta: 70, oitenta: 80, noventa: 90,
};
const COT_EXTENSO_CENTENA = {
  cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300,
  quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500,
  seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700,
  oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900,
  mil: 1000,
};

// Junta o que a fala separa: "vinte e um" é um número só, "cento e
// cinquenta" também. Palavra que não é número corta a sequência — senão
// "dois sacos e três latas" viraria "5".
function numerosDoExtenso(texto) {
  const bruto = String(texto == null ? "" : texto);
  if (!bruto.trim()) return bruto;
  const partes = bruto.split(/(\s+)/);
  const chave = (w) => cotSemAcento(String(w)).replace(/[^a-z]/g, "");
  const ehNumero = (w) => {
    const k = chave(w);
    return k && (COT_EXTENSO_UNIDADE[k] != null || COT_EXTENSO_DEZENA[k] != null
      || COT_EXTENSO_CENTENA[k] != null);
  };
  const valor = (w) => {
    const k = chave(w);
    if (COT_EXTENSO_CENTENA[k] != null) return COT_EXTENSO_CENTENA[k];
    if (COT_EXTENSO_DEZENA[k] != null) return COT_EXTENSO_DEZENA[k];
    return COT_EXTENSO_UNIDADE[k];
  };
  // Cada bloco vira um número: centena + dezena + unidade, com "e" no meio.
  const saida = [];
  let i = 0;
  while (i < partes.length) {
    const w = partes[i];
    if (!w.trim() || !ehNumero(w)) { saida.push(w); i++; continue; }
    // `fim` é o que veio DEPOIS do último número de fato usado. O laço engole
    // o "e" na esperança de um próximo número ("vinte e um"); se ele não vier
    // — "dois sacos e três latas" —, voltar a `fim` devolve o "e" e os
    // espaços ao texto, em vez de comê-los.
    let total = 0, usou = 0, j = i, ultimaOrdem = 4, fim = i;
    while (j < partes.length) {
      const t = partes[j];
      if (!t.trim()) { j++; continue; }
      if (chave(t) === "e" && usou) { j++; continue; }
      if (!ehNumero(t)) break;
      const k = chave(t);
      const ordem = COT_EXTENSO_CENTENA[k] != null ? 3 : (COT_EXTENSO_DEZENA[k] != null ? 2 : 1);
      // Ordem tem que ir decrescendo: "cento e vinte e um". "dez dez" não.
      if (ordem >= ultimaOrdem) break;
      total += valor(t); usou++; ultimaOrdem = ordem;
      j++; fim = j;
    }
    if (!usou) { saida.push(w); i++; continue; }
    saida.push(String(total));
    i = fim;
  }
  return saida.join("").replace(/\s+\n/g, "\n");
}

// O trecho ditado entra no fim do que já existe, em linha nova: cada frase
// é um item, e é por linha que o leitor separa a lista.
function textoComDitado(atual, trecho) {
  const t = String(trecho == null ? "" : trecho).trim();
  if (!t) return String(atual == null ? "" : atual);
  const a = String(atual == null ? "" : atual).replace(/\s+$/, "");
  const limpo = numerosDoExtenso(t);
  return a ? a + "\n" + limpo : limpo;
}

function resumoDaEntrada(itens) {
  const lista = itens || [];
  const comCatalogo = lista.filter((x) => x.insumoCodigo).length;
  const comProposta = lista.filter((x) => !x.insumoCodigo && x.sugestao).length;
  // pelo mesmo caminho do pedido: subtotal do papel, ou quantidade × unitário
  const soma = lista.reduce((t, x) => {
    return t + (typeof brutoDoItem === "function" ? brutoDoItem(x) : 0);
  }, 0);
  return { quantos: lista.length, comCatalogo, comProposta,
    semNada: lista.length - comCatalogo - comProposta,
    total: Math.round(soma * 100) / 100,
    temPreco: lista.some((x) => x.bruto || x.unitario) };
}

// As portas de saída. A ordem é a da vida: pedir preço é o que vem antes de
// tudo e é o caso mais rápido — ditou, mandou; o pedido é o de todo dia; a
// compra já paga é o que chega depois; a despesa é o que não passa por loja
// nenhuma — empreiteiro, taxa, aluguel —; e a cotação formal é quando a
// compra merece comparação lado a lado antes de decidir.
//
// "Compra já paga" e "Despesa paga" são as duas formas de dinheiro que já
// saiu, e a diferença é o que o papel traz: a compra tem itens, quantidade e
// unidade; a despesa tem só quem recebeu, quanto e quando.
const DESTINOS_DA_ENTRADA = [
  { id: "mandar", nome: "Mandar para a loja", resumo: "Vira mensagem pronta no WhatsApp da loja, pedindo preço. É o caminho curto." },
  { id: "pedido", nome: "Pedido", resumo: "Vai virar conta a pagar na loja, com vencimento." },
  { id: "pagamento", nome: "Compra já paga", resumo: "Material que já foi pago: entra lançado e baixado, na data em que saiu o dinheiro." },
  { id: "despesa", nome: "Despesa paga", resumo: "Empreiteiro, mão de obra, taxa, aluguel: entra como conta da obra já baixada, com o comprovante anexado." },
  { id: "cotacao", nome: "Cotação", resumo: "Comparação formal: várias lojas, propostas lado a lado." },
];

// "Mandar para a loja" não exige escolher a loja aqui: a próxima tela mostra
// todas, com quem já recebeu marcado. Se a frase disse a loja, ela vai
// marcada — mas pode ser mais de uma, e esse é o ponto de pedir preço.

// Pedido e pagamento precisam saber de qual loja é; cotação, não — ela
// nasce justamente para perguntar a várias.
function entradaPedeLoja(destino) {
  return destino === "pedido" || destino === "pagamento";
}

// Aberta de dentro da obra, a obra já é conhecida e `obras` vem vazia.
// Aberta na lista de Obras, a lista chega cheia e escolher uma é obrigatório
// — é o que permite ler a nota primeiro e só depois dizer de onde ela é.
// A lista ditada também precisa de nome — ela vira uma cotação na obra, e
// cotação sem nome vira "sem nome" na lista daqui a um mês. O nome sai do
// que ela tem: os primeiros materiais, e quantos sobraram.
function tituloDaListaRapida(itens, hojeIso) {
  const nomes = (itens || [])
    .map((i) => String((i && (i.descricao || i.termo)) || "").trim())
    .filter(Boolean)
    .map((n) => n.split(/\s+/).slice(0, 2).join(" "));
  if (!nomes.length) return "Lista" + (hojeIso ? " de " + dataDoDiaBR(hojeIso) : "");
  const cabeca = nomes.slice(0, 2).join(", ");
  const resto = nomes.length - 2;
  return resto > 0 ? `${cabeca} e mais ${resto}` : cabeca;
}

// dd/mm/aaaa sem depender de locale do navegador no meio de um nome.
function dataDoDiaBR(iso) {
  const s = String(iso || "").slice(0, 10);
  const [a, m, d] = s.split("-");
  return (d && m && a) ? `${d}/${m}/${a}` : s;
}

function entradaPedeObra(obras) {
  return !!(obras && obras.length);
}

function entradaPronta(destino, lojaId, itens, obras, obraId) {
  if (!(itens || []).length) return { ok: false, motivo: "A leitura não achou itens." };
  if (entradaPedeObra(obras) && !obraId) return { ok: false, motivo: "Escolha a obra." };
  if (!destino) return { ok: false, motivo: "Diga o que é este papel." };
  if (entradaPedeLoja(destino) && !lojaId) return { ok: false, motivo: "Escolha a loja." };
  return { ok: true, motivo: "" };
}

// ── A tela única da Entrada ─────────────────────────────────────
// Qualquer papel termina no mesmo lugar: itens + fornecedor + SITUAÇÃO.
// A situação é o que antes era "o que é este papel": cotação (pedir preço),
// a pagar (vira conta com vencimento) ou pago (o dinheiro já saiu).
const SITUACOES_DA_ENTRADA = [
  { id: "cotacao", nome: "Cotação", resumo: "Pedir preço: a lista vai para as lojas no WhatsApp e fica na obra esperando as propostas." },
  { id: "apagar", nome: "A pagar", resumo: "Vira conta a pagar com vencimento — um boleto ou várias parcelas." },
  { id: "pago", nome: "Pago", resumo: "O dinheiro já saiu: entra baixado, na data do pagamento, à vista ou no cartão." },
];

const COLS_ENTRADA = "minmax(0,2.2fr) 62px 52px 92px 100px minmax(0,1.3fr) minmax(0,1.3fr) 24px";

// Empreendimento é do escritório: quem paga é ele, e o papel chega depois
// do dinheiro — entra pago (dá para trocar para cotação). Obra de cliente
// não tem padrão: pago ou a pagar é a pergunta que importa ali. Comprovante
// é prova de que o dinheiro saiu, então é pago, sempre.
function situacaoPadraoDaEntrada(papel, tipoDaObra) {
  if (papel && papel.tipo === "comprovante") return papel.situacaoLida === "agendado" ? "apagar" : "pago";
  // O que o papel diz manda: pago, agendado/a pagar, ou lista para cotar.
  const lida = (papel || {}).situacaoLida;
  if (lida === "pago") return "pago";
  if (lida === "agendado" || lida === "a_pagar") return "apagar";
  if (lida === "lista") return "cotacao";
  return tipoDaObra === "empreendimento" ? "pago" : "";
}

// O que a regra da transação pede para UM item. Obra, data e fornecedor são
// do lançamento inteiro e se cobram uma vez só, fora daqui.
function faltasDoItemNaEntrada(it, situacao, pagamento) {
  if (typeof faltasDaTransacao !== "function") return [];
  const pago = situacao === "pago";
  return faltasDaTransacao({ obraId: "-", contaId: (it || {}).contaId, valor: brutoDoItem(it), vencimento: "-",
    pago, favorecido: "-", insumoCodigo: (it || {}).insumoCodigo, quantidade: (it || {}).quantidade,
    etapa: (it || {}).etapa, formaPagamento: pago ? (((pagamento || {}).forma) || "avista") : "" });
}

// Os boletos que vão nascer: 1º vencimento, e os outros a cada N dias.
function previaDosBoletos(total, ap) {
  const a = ap || {};
  const n = Math.max(1, Math.floor(Number(a.parcelas) || 1));
  const intervalo = Math.max(1, Math.floor(Number(a.intervalo) || 30));
  const v0 = String(a.vencimento || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v0) || !(total > 0)) return [];
  const base = Math.round((total / n) * 100) / 100;
  return Array.from({ length: n }, (_, p) => ({
    vencimento: p === 0 ? v0 : somarDias(v0, p * intervalo),
    valor: p === n - 1 ? Math.round((total - base * (n - 1)) * 100) / 100 : base,
  }));
}

// Pronto para lançar? Diz o PRIMEIRO que falta, na ordem em que se preenche.
// `e`: { situacao, prestadorId, itens, pagamento, apagar, parcelaId }
function entradaUnicaPronta(e, obras, obraId) {
  const d = e || {};
  const itens = d.itens || [];
  if (!itens.length) return { ok: false, motivo: "Inclua pelo menos um item." };
  if (entradaPedeObra(obras) && !obraId) return { ok: false, motivo: "Escolha a obra." };
  if (!d.situacao) return { ok: false, motivo: "Diga a situação: cotação, a pagar ou pago." };
  if (d.situacao === "cotacao") {
    if (!itens.some((i) => i && (String(i.descricao || "").trim() || i.insumoCodigo))) return { ok: false, motivo: "A lista está sem itens." };
    return { ok: true, motivo: "" };
  }
  if (!String(d.prestadorId || "").trim()) return { ok: false, motivo: "Escolha o fornecedor." };
  const pago = d.situacao === "pago";
  const pg = d.pagamento || {}, ap = d.apagar || {};
  if (pago) {
    if (!String(pg.data || "").trim()) return { ok: false, motivo: "Informe a data do pagamento." };
    if (pg.forma === "cartao" && !pg.cartaoId) return { ok: false, motivo: "Escolha o cartão." };
  } else if (!String(ap.vencimento || "").trim()) {
    return { ok: false, motivo: Number(ap.parcelas) > 1 ? "Informe o 1º vencimento." : "Informe o vencimento." };
  }
  const total = itens.reduce((s, i) => s + brutoDoItem(i), 0);
  if (!(total > 0)) return { ok: false, motivo: "Informe o valor dos itens." };
  // Pagamento de parcela de contrato: conta, etapa e descrição são as da parcela.
  if (pago && String(d.parcelaId || "").trim()) return { ok: true, motivo: "" };
  for (let k = 0; k < itens.length; k++) {
    const it = itens[k];
    if (!(brutoDoItem(it) > 0)) return { ok: false, motivo: (itens.length > 1 ? `Item ${k + 1}: ` : "") + "falta o valor." };
    const faltas = faltasDoItemNaEntrada(it, d.situacao, pg);
    if (faltas.length) {
      const nome = String(it.descricao || "").trim();
      const quem = itens.length > 1 ? `Item ${k + 1}${nome ? " (" + nome.slice(0, 30) + ")" : ""}: ` : "";
      return { ok: false, motivo: quem + frasesDasFaltas(faltas) };
    }
  }
  return { ok: true, motivo: "" };
}

function rotuloDoPapelDaEntrada(papel, itens) {
  const p = papel || {};
  if (p.lidoPelaIA && p.tipoIA) {
    const nome = COT_NOME_DO_TIPO[p.tipoIA] || "papel";
    const fem = /^(nota|guia|lista)/.test(nome);
    return nome.charAt(0).toUpperCase() + nome.slice(1) + (fem ? " lida" : " lido") + " pela IA";
  }
  if (p.tipo === "comprovante") return "Comprovante de pagamento lido";
  if (p.tipo === "nfse") return "Nota fiscal de serviço lida";
  if (p.ehNota) return "Nota fiscal lida";
  if (p.numeroPedido || p.total) return "Pedido / orçamento lido";
  const n = (itens || []).length;
  return n === 1 ? "1 item lido" : `${n} itens lidos`;
}

// Como o papel fica marcado na conta: é o nome que aparece no 📎.
function tipoDoAnexoDaEntrada(papel) {
  const p = papel || {};
  if (p.tipo === "comprovante") return "comprovante";
  if (p.tipo === "nfse" || p.ehNota) return "nota";
  return "pedido";
}
function rotuloDoAnexoDaEntrada(papel) {
  const t = tipoDoAnexoDaEntrada(papel);
  return t === "comprovante" ? "comprovante" : t === "nota" ? "nota fiscal" : "pedido";
}

// Conta padrão dos itens lidos de nota, pedido ou lista: material. A pessoa
// troca o que não for (frete, serviço); o que veio escolhido fica.
function comContaPadraoDaEntrada(lista, padrao) {
  return (lista || []).map((x) => (x && !x.contaId && padrao ? { ...x, contaId: padrao } : x));
}

// ── A leitura da IA vira a ficha da Entrada ─────────────────────
// A IA devolve um item por PAPEL achado no arquivo. Um arquivo comum tem um
// só; mas a nota pode vir com o print do Pix junto, ou duas notas numa foto.
// Aqui os papéis viram UMA ficha: os itens saem da nota (ou do cupom, do
// pedido); a data e o jeito de pagar saem do comprovante, quando há um.
// O que não fecha vira aviso à vista — nunca correção calada.
const COT_TIPOS_COM_ITENS = ["nota_produto", "nota_servico", "cupom", "pedido_orcamento", "lista_material", "recibo", "contrato"];
const COT_TIPOS_COMPROVANTE = ["comprovante_pix", "comprovante_boleto", "comprovante_ted", "comprovante_cartao", "guia_imposto"];

function tipoDoPapelPelaIA(t) {
  if (t === "nota_produto") return "nota";
  if (t === "nota_servico") return "nfse";
  if (COT_TIPOS_COMPROVANTE.indexOf(t) >= 0) return "comprovante";
  if (t === "lista_material") return "lista";
  return "pedido";
}

const COT_NOME_DO_TIPO = {
  nota_produto: "nota fiscal", nota_servico: "nota de serviço", cupom: "cupom", pedido_orcamento: "pedido",
  comprovante_pix: "comprovante de Pix", comprovante_boleto: "comprovante de boleto", comprovante_ted: "comprovante de TED",
  comprovante_cartao: "comprovante da maquininha", guia_imposto: "guia de imposto", recibo: "recibo",
  contrato: "contrato", lista_material: "lista de material", outro: "papel",
};

function fichaDaEntradaPelaIA(documentos) {
  const docs = (documentos || []).filter(Boolean);
  if (!docs.length) return null;
  const avisos = [];
  const comItens = docs.filter((d) => COT_TIPOS_COM_ITENS.indexOf(d.tipo) >= 0);
  const comprovantes = docs.filter((d) => COT_TIPOS_COMPROVANTE.indexOf(d.tipo) >= 0);
  const principal = comItens[0] || comprovantes[0] || docs[0];
  const pago = comprovantes.find((d) => d.situacao === "pago") || (principal.situacao === "pago" ? principal : null);
  const agendado = docs.find((d) => d.situacao === "agendado") || null;
  if (docs.length > 1) {
    avisos.push(`Este arquivo tem ${docs.length} papéis: ${docs.map((d) => COT_NOME_DO_TIPO[d.tipo] || "papel").join(" + ")}. `
      + "Os itens vêm " + (comItens.length ? "da " + (COT_NOME_DO_TIPO[principal.tipo] || "nota") : "do comprovante")
      + (pago && pago !== principal ? "; a data e a forma do pagamento, do comprovante." : "."));
  }
  if (comItens.length > 1) avisos.push(`Há ${comItens.length} notas/cupons no arquivo — só a primeira entrou. Lance as outras separadas.`);
  if (agendado && !pago) avisos.push("O comprovante é de AGENDAMENTO — o dinheiro ainda não saiu. Entra como a pagar, com o vencimento agendado.");
  const valorPago = pago ? (Number(pago.valor) || 0) : 0;
  const total = Number(principal.valor) || 0;
  if (pago && pago !== principal && valorPago > 0 && total > 0 && Math.abs(valorPago - total) >= 0.01) {
    avisos.push(`O valor pago (${valorPago.toFixed(2).replace(".", ",")}) é diferente do total da ${COT_NOME_DO_TIPO[principal.tipo] || "nota"} (${total.toFixed(2).replace(".", ",")}). Confira os itens.`);
  }
  const forma = (pago || principal).forma || "";
  if (forma === "credito") avisos.push("Pago no crédito. Se foi no cartão do escritório, marque “Cartão de crédito” em Como foi pago.");

  const itensLidos = (principal.itens || []).map((l) => ({
    descricao: l.descricao || "", quantidade: Number(l.quantidade) || "", unidade: l.unidade || "",
    unitario: Number(l.unitario) || "", total: Number(l.total) || (Number(l.quantidade) * Number(l.unitario)) || 0,
  })).filter((l) => l.descricao);
  const tipo = tipoDoPapelPelaIA(principal.tipo);
  const chaveNf = docs.map((d) => String(d.chave || "").replace(/\D/g, "")).find((c) => c.length === 44) || "";
  const idTransacao = comprovantes.map((d) => String(d.chave || "").trim()).find((c) => /^E[0-9A-Za-z]{20,}$/.test(c)) || "";
  const papel = {
    tipo, tipoIA: principal.tipo, lidoPelaIA: true,
    lidoComo: principal.emitente || (pago && pago.emitente) || "",
    cnpj: principal.cnpj || "",
    ehNota: tipo === "nota" || tipo === "nfse",
    numeroNota: (tipo === "nota" || tipo === "nfse") ? String(principal.numero || "") : "",
    numeroPedido: (tipo === "nota" || tipo === "nfse") ? "" : String(principal.numero || ""),
    emitido: principal.emissao || "",
    vencimento: (agendado && agendado.vencimento) || principal.vencimento || "",
    pagoEm: (pago && (pago.pagamento || pago.emissao)) || "",
    total: valorPago > 0 && !itensLidos.length ? valorPago : (total || valorPago),
    valor: valorPago || total,
    desconto: Number(principal.desconto) || 0,
    situacaoLida: pago ? "pago" : agendado ? "agendado" : principal.situacao === "a_pagar" ? "a_pagar"
      : principal.tipo === "lista_material" ? "lista" : "",
    formaLida: forma,
    chave: chaveNf, idTransacao,
    descricao: principal.descricao || (pago && pago.descricao) || "",
  };
  // Papel sem tabela (comprovante, recibo, nota de serviço): um item só,
  // com o valor do papel. A conta contábil fica para a pessoa.
  const itens = itensLidos.length ? itensLidos
    : [{ descricao: papel.descricao || "", quantidade: "", unidade: "", unitario: "", total: papel.valor || papel.total || 0 }];
  return { papel, itens, avisos, documentos: docs };
}

// ── O papel que não é nota: o comprovante ──────────────────────
// A nota fiscal diz o que se comprou; o comprovante diz que o dinheiro saiu.
// Os dois chegam pela mesma caixa, e quem decide é o papel. A ordem importa:
// nota é nota mesmo que fale em "pagamento", então a DANFE responde primeiro.
const COT_RE_COMPROVANTE = new RegExp(
  "comprovante|\\bpix\\b|transfer[êe]ncia|\\bted\\b|\\bdoc\\b|boleto pago"
  + "|pagamento (efetuado|realizado|conclu[íi]do|aprovado)"
  + "|autentica[çc][ãa]o|id da transa[çc][ãa]o|\\be2e\\b|recibo"
  + "|\\bpaguei\\b", "i");

function ehComprovante(texto) {
  const t = String(texto || "");
  if (typeof ehDanfe === "function" && ehDanfe(t)) return false;
  return COT_RE_COMPROVANTE.test(t);
}

// "Valor: R$ 5.000,00", "VALOR DO PAGAMENTO" com o número na linha de baixo,
// "R$ 5.000,00" sozinho. Procura do mais específico para o mais solto, para
// não pegar a tarifa de R$ 0,00 que alguns bancos imprimem no rodapé.
function valorDoComprovante(texto) {
  const t = String(texto || "");
  const tentativas = [
    /valor\s*(?:do\s*)?(?:pagamento|transa[çc][ãa]o|transfer[êe]ncia|p[ií]x)?\s*:?\s*R?\$?\s*([\d.]{1,14},\d{2})/i,
    /valor[\s\S]{0,60}?R\$\s*([\d.]{1,14},\d{2})/i,
    /R\$\s*([\d.]{1,14},\d{2})/,
  ];
  for (const re of tentativas) {
    const m = t.match(re);
    if (m && numeroDeCampo(m[1]) > 0) return m[1];
  }
  return "";
}

// A data que interessa é a do pagamento, não a da emissão do comprovante
// nem a do vencimento do boleto — é ela que diz em que mês a despesa cai.
function dataDoComprovante(texto) {
  const t = String(texto || "");
  const tentativas = [
    /data\s*(?:do\s*)?(?:pagamento|transa[çc][ãa]o|transfer[êe]ncia|cr[ée]dito)[\s\S]{0,80}?(\d{2}\/\d{2}\/\d{4})/i,
    /(?:pago|pagamento|realizad[ao]|efetuad[ao])\s*em[\s\S]{0,40}?(\d{2}\/\d{2}\/\d{4})/i,
    /(\d{2}\/\d{2}\/\d{4})/,
  ];
  for (const re of tentativas) {
    const m = t.match(re);
    if (m) {
      const d = m[1].split("/");
      return d[2] + "-" + d[1] + "-" + d[0];
    }
  }
  return "";
}

const COT_RE_ROTULO_FAVORECIDO = /(destinat[áa]ri[oa]|favorecid[oa]|benefici[áa]ri[oa]|recebedor|quem recebeu|cr[ée]dito para|pagar a|pago a|paguei (?:para )?[oa]?)/i;
// Linhas que o banco imprime em volta do nome e que nome nenhum é.
const COT_RE_ROTULO_BANCARIO = /^(cpf|cnpj|ag[êe]ncia|conta|banco|institui[çc][ãa]o|chave|tipo|valor|data|nome|raz[ãa]o social|documento|id|e2e|autentica)/i;

// Nome de quem recebeu: na mesma linha do rótulo, ou na primeira linha
// abaixo dele que pareça nome e não etiqueta de banco.
function pareceNomeDeFavorecido(s) {
  const t = String(s || "").trim();
  if (t.length < 3 || t.length > 90) return false;
  if (COT_RE_ROTULO_BANCARIO.test(t)) return false;
  const letras = (t.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  const digitos = (t.match(/\d/g) || []).length;
  return letras >= 3 && letras > digitos;
}

// A linha chega de duas procedências: do PDF, como { celulas, texto }, e do
// texto colado, como string. Normalizar aqui é o que deixa o resto do leitor
// ignorar de onde o papel veio.
function cotLinhaComoTexto(l) {
  if (l == null) return "";
  if (typeof l === "string") return l;
  if (l.texto != null) return String(l.texto);
  if (Array.isArray(l.celulas)) return l.celulas.join(" ");
  return "";
}

function favorecidoDoComprovante(linhas) {
  const ls = (linhas || []).map((l) => cotLinhaComoTexto(l).trim()).filter(Boolean);
  for (let i = 0; i < ls.length; i++) {
    if (!COT_RE_ROTULO_FAVORECIDO.test(ls[i])) continue;
    const resto = ls[i].replace(/^[\s\S]*?(destinat[áa]ri[oa]|favorecid[oa]|benefici[áa]ri[oa]|recebedor|quem recebeu|cr[ée]dito para|pagar a|pago a|paguei (?:para )?[oa]?)\s*[:·\-–]*\s*/i, "").trim();
    if (pareceNomeDeFavorecido(resto)) return resto;
    for (let j = i + 1; j < Math.min(ls.length, i + 5); j++) {
      if (pareceNomeDeFavorecido(ls[j])) return ls[j];
    }
  }
  return "";
}

// CPF e CNPJ vêm mascarados na maioria dos comprovantes (***.123.456-**).
// Serve para conferir o prestador, não para cadastrar — por isso entra como
// veio, sem tentar completar o que o banco escondeu.
function documentoDoComprovante(texto) {
  const t = String(texto || "");
  const m = t.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/)
    || t.match(/[*\d]{3}\.[*\d]{3}\.[*\d]{3}-[*\d]{2}/);
  return m ? m[0] : "";
}

// O comprovante lido de uma vez. Devolve null quando o papel não é
// comprovante — quem chama segue pelo caminho da nota, como antes.
function dadosDoComprovante(linhas) {
  const lista = linhas || [];
  const tudo = lista.map(cotLinhaComoTexto).join("\n");
  if (!ehComprovante(tudo)) return null;
  return {
    valor: valorDoComprovante(tudo),
    pagoEm: dataDoComprovante(tudo),
    favorecido: favorecidoDoComprovante(lista),
    documento: documentoDoComprovante(tudo),
  };
}

// ── Nota fiscal de SERVIÇO: a nota que não tem tabela ──────────
// O concreto chega como serviço: usinagem e bombeamento. A NFS-e não tem
// tabela de itens — tem "Discriminação dos Serviços" em texto corrido e um
// total. Procurar tabela nela dá o erro errado ("não achei a tabela de
// itens") num papel que nunca teve tabela, e a compra fica sem lançar.
//
// Ela também não é comprovante: comprovante prova que o dinheiro saiu; a
// nota prova o que foi comprado. Por isso a data que sai daqui é a de
// EMISSÃO, e quem lança diz quando pagou.
function ehNotaDeServico(texto) {
  const t = String(texto || "");
  if (typeof ehDanfe === "function" && ehDanfe(t)) return false;
  const marcas = [
    /\bNFS-?e\b/i,
    /nota\s+fiscal\s+(eletr[ôo]nica\s+)?de\s+servi[çc]o/i,
    /nota\s+fiscal\s+de\s+servi[çc]os/i,
    /discrimina[çc][ãa]o\s+d[oa]s?\s+servi[çc]os?/i,
  ];
  const quantas = marcas.filter((re) => re.test(t)).length;
  if (!quantas) return false;
  // "prestador" e "ISS" sozinhos aparecem em contrato e em recibo; o que
  // identifica a nota é a marca dela mais um sinal de documento fiscal
  const apoio = /prestador\s+de\s+servi[çc]os?|tomador\s+de\s+servi[çc]os?|\bISSQN?\b|c[óo]digo\s+de\s+verifica[çc][ãa]o/i.test(t);
  return quantas >= 2 || apoio;
}

// O total da nota, do rótulo mais específico para o mais solto. O líquido
// vem antes do bruto: é o que a prefeitura diz que se paga quando há ISS
// retido, e é esse o valor que sai da conta.
function valorDaNotaDeServico(texto) {
  const t = String(texto || "");
  const tentativas = [
    /valor\s*l[íi]quido\s*(?:da\s*nota)?\s*:?\s*=?\s*R?\$?\s*([\d.]{1,14},\d{2})/i,
    /valor\s*total\s*(?:da\s*)?nota\s*:?\s*=?\s*R?\$?\s*([\d.]{1,14},\d{2})/i,
    /valor\s*(?:total\s*)?d[oe]s?\s*servi[çc]os?\s*:?\s*=?\s*R?\$?\s*([\d.]{1,14},\d{2})/i,
    /valor\s*total\s*:?\s*=?\s*R?\$?\s*([\d.]{1,14},\d{2})/i,
  ];
  for (const re of tentativas) {
    const m = t.match(re);
    if (m && numeroDeCampo(m[1]) > 0) return m[1];
  }
  // sem rótulo que sirva, o maior valor do papel é o total da nota — as
  // bases e as alíquotas de imposto são sempre menores que ele
  const todos = (t.match(/R?\$?\s*([\d.]{1,14},\d{2})/g) || [])
    .map((s) => numeroDeCampo(s.replace(/[R$\s]/g, "")))
    .filter((n) => n > 0);
  if (!todos.length) return "";
  const maior = Math.max.apply(null, todos);
  return maior.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function emissaoDaNotaDeServico(texto) {
  const t = String(texto || "");
  const tentativas = [
    /data\s*(?:e\s*hora\s*)?d[ae]\s*emiss[ãa]o[\s\S]{0,60}?(\d{2}\/\d{2}\/\d{4})/i,
    /emiss[ãa]o[\s\S]{0,40}?(\d{2}\/\d{2}\/\d{4})/i,
    /compet[êe]ncia[\s\S]{0,40}?(\d{2}\/\d{2}\/\d{4})/i,
    /(\d{2}\/\d{2}\/\d{4})/,
  ];
  for (const re of tentativas) {
    const m = t.match(re);
    if (m) {
      const [d, mes, a] = m[1].split("/");
      return `${a}-${mes}-${d}`;
    }
  }
  return "";
}

// Quem emitiu. Na NFS-e o prestador vem primeiro e o tomador depois — se
// pegarmos o nome errado, a despesa vai para o favorecido errado, que é o
// erro mais caro que esta leitura pode cometer. Por isso só aceitamos o
// nome que estiver DEPOIS de "prestador" e ANTES de "tomador".
function prestadorDaNotaDeServico(linhas) {
  const lista = (linhas || []).map((l) => (typeof cotLinhaComoTexto === "function" ? cotLinhaComoTexto(l) : String(l)));
  const ini = lista.findIndex((l) => /prestador\s+de\s+servi[çc]os?/i.test(l));
  const fim = lista.findIndex((l) => /tomador\s+de\s+servi[çc]os?/i.test(l));
  const janela = ini < 0 ? lista : lista.slice(ini + 1, fim > ini ? fim : ini + 12);
  const rotulo = /raz[ãa]o\s*social|nome\s*(?:\/|ou\s*)?(?:raz[ãa]o|empresarial)|nome\s*fantasia/i;
  for (let i = 0; i < janela.length; i++) {
    if (!rotulo.test(janela[i])) continue;
    // o nome pode vir na mesma linha, depois do rótulo, ou na linha seguinte
    const mesma = janela[i].replace(rotulo, "").replace(/^[\s:.-]+/, "").trim();
    if (mesma.length >= 4 && !/^\d/.test(mesma)) return mesma;
    const prox = (janela[i + 1] || "").trim();
    if (prox.length >= 4 && !/^\d/.test(prox) && !rotulo.test(prox)) return prox;
  }
  // sem rótulo: a primeira linha com cara de razão social
  const cara = janela.find((l) => /[A-ZÁÂÃÉÊÍÓÔÕÚÇ]{3}/.test(l) && l.trim().length >= 6
    && !/cnpj|cpf|inscri|endere|munic|\bcep\b|telefone|e-?mail/i.test(l));
  return (cara || "").trim();
}

function discriminacaoDaNotaDeServico(linhas) {
  const lista = (linhas || []).map((l) => (typeof cotLinhaComoTexto === "function" ? cotLinhaComoTexto(l) : String(l)));
  const i = lista.findIndex((l) => /discrimina[çc][ãa]o/i.test(l));
  if (i < 0) return "";
  for (let k = i; k < Math.min(lista.length, i + 6); k++) {
    const t = lista[k].replace(/discrimina[çc][ãa]o\s+d[oa]s?\s+servi[çc]os?/i, "").replace(/^[\s:.-]+/, "").trim();
    if (t.length >= 6) return t.slice(0, 160);
  }
  return "";
}

// O número da NFS-e. O leitor da DANFE procura "Nº 000.008.623"; a nota de
// serviço escreve "Número da Nota 4177", quase sempre sem o "nº".
function numeroDaNotaDeServico(texto) {
  const t = String(texto || "");
  const tentativas = [
    /n[úu]mero\s*d[ae]\s*nota\s*:?\s*([\d.]{1,12})/i,
    /nota\s*(?:fiscal)?\s*n[º°o]\.?\s*([\d.]{1,12})/i,
    /\bNFS-?e\s*n[º°o]\.?\s*([\d.]{1,12})/i,
  ];
  for (const re of tentativas) {
    const m = t.match(re);
    if (m) {
      const so = String(m[1]).replace(/\D/g, "").replace(/^0+/, "");
      if (so) return so;
    }
  }
  return typeof numeroDaNota === "function" ? numeroDaNota(t) : "";
}

function dadosDaNotaDeServico(linhas) {
  const lista = linhas || [];
  const tudo = lista.map((l) => (typeof cotLinhaComoTexto === "function" ? cotLinhaComoTexto(l) : String(l))).join("\n");
  if (!ehNotaDeServico(tudo)) return null;
  const valor = valorDaNotaDeServico(tudo);
  if (!(numeroDeCampo(valor) > 0)) return null;
  return {
    notaDeServico: true,
    valor,
    // emissão, não pagamento — a nota não prova que o dinheiro saiu
    emitidoEm: emissaoDaNotaDeServico(tudo),
    favorecido: prestadorDaNotaDeServico(lista),
    documento: numeroDaNotaDeServico(tudo),
    descricao: discriminacaoDaNotaDeServico(lista),
  };
}

// O prestador do comprovante já está cadastrado? O nome do banco vem em
// caixa alta e com a razão social inteira ("JOSE DA SILVA ME"), então casa
// por pedaço: o cadastro dentro do nome do papel, ou o contrário.
function prestadorDoComprovante(prestadores, nome) {
  const alvo = cotSemAcento(nome || "");
  if (alvo.length < 3) return null;
  const lista = (prestadores || []).filter(Boolean);
  const exato = lista.find((f) => cotSemAcento(f.nome || "") === alvo);
  if (exato) return exato;
  const dentro = lista.filter((f) => {
    const n = cotSemAcento(f.nome || "");
    return n.length >= 3 && (alvo.indexOf(n) >= 0 || n.indexOf(alvo) >= 0);
  });
  if (dentro.length === 1) return dentro[0];
  if (dentro.length > 1) return null;
  // O cadastro escreve "Construfácil", a nota "CONSTRU FACIL ACABAMENTO
  // LTDA": sem os espaços, e sem o LTDA/ME/EIRELI do fim, é o mesmo nome.
  const junto = (t) => cotSemAcento(t).replace(/\b(ltda|me|epp|eireli|s\/?a|sa|mei)\b/g, "").replace(/[^a-z0-9]/g, "");
  const a2 = junto(nome || "");
  const colados = a2.length >= 5 ? lista.filter((f) => {
    const n = junto(f.nome || "");
    return n.length >= 5 && (a2.indexOf(n) >= 0 || n.indexOf(a2) >= 0);
  }) : [];
  return colados.length === 1 ? colados[0] : null;
}

// ── Despesa paga: a saída que não tem itens ────────────────────
// Pedido e cotação falam de material, com quantidade e unidade. O pagamento
// do empreiteiro não tem nada disso: tem quem recebeu, quanto, quando e em
// que conta entra. Por isso a prova do que falta é outra.
function despesaPronta(d, obras, obraId) {
  if (entradaPedeObra(obras) && !obraId) return { ok: false, motivo: "Escolha a obra." };
  const dd = d || {};
  if (!String(dd.favorecidoId || "").trim()) return { ok: false, motivo: "Escolha quem recebeu." };
  if (!(numeroDeCampo(dd.valor) > 0)) return { ok: false, motivo: "Informe o valor pago." };
  if (!String(dd.pagoEm || "").trim()) return { ok: false, motivo: "Informe a data do pagamento." };
  // Baixando parcela de contrato, a conta contábil e a descrição já são as
  // da parcela — perguntá-las de novo só abriria caminho para divergirem.
  if (String(dd.parcelaId || "").trim()) return { ok: true, motivo: "" };
  if (!String(dd.contaId || "").trim()) return { ok: false, motivo: "Escolha a conta contábil." };
  // Daqui em diante quem decide é a regra única da transação: a mesma que o
  // pedido, a conta avulsa e a conferência usam. Sem isto a despesa da
  // Entrada era a porta por onde o gasto entrava sem item e sem etapa.
  if (typeof faltasDaTransacao === "function") {
    const faltas = faltasDaTransacao({
      obraId: obraId || "(esta obra)", contaId: dd.contaId, valor: dd.valor, pagoEm: dd.pagoEm, pago: true,
      favorecido: dd.favorecidoId, insumoCodigo: dd.insumoCodigo, quantidade: dd.quantidade,
      etapa: dd.etapa, formaPagamento: dd.forma === "cartao" ? (dd.cartaoId ? "cartao" : "") : "avista",
    });
    if (dd.forma === "cartao" && !dd.cartaoId) faltas.push("o cartão");
    if (faltas.length) return { ok: false, motivo: frasesDasFaltas(faltas) };
  }
  return { ok: true, motivo: "" };
}

// O empreiteiro que recebeu já tinha parcela combinada? Então o pagamento é
// a baixa dela, não uma despesa nova — senão o contrato fica eternamente em
// aberto e a obra conta o mesmo gasto duas vezes.
function parcelasEmAbertoDoPrestador(contas, prestadorId) {
  if (!prestadorId) return [];
  return (contas || [])
    .filter((c) => c && !c.pago && c.prestadorId === prestadorId && (c.origem === "contrato" || c.contratoId))
    .slice()
    .sort((a, b) => String(a.vencimento || "").localeCompare(String(b.vencimento || "")));
}

// A parcela que casa é a do mesmo valor; havendo duas iguais, a mais antiga.
// Sem valor igual não se adivinha — a pessoa aponta qual é.
function parcelaQueCasa(parcelas, valor) {
  const v = numeroDeCampo(valor);
  if (!(v > 0)) return null;
  const iguais = (parcelas || []).filter((p) => Math.abs(numeroDeCampo(p.valor) - v) < 0.01);
  return iguais[0] || null;
}

// ── O item novo no padrão do catálogo ───────────────────────────
// O catálogo tem família: "PVC - Alimentação Água Fria - Luva 32mm",
// "... - Luva 50mm", "... - Luva União 50mm". O item novo entra na mesma
// família, só com a medida que ele pediu: "PVC - Alimentação Água Fria -
// Luva 32×25mm". A família é tudo até a palavra-chave ("Luva"); o que vem
// depois é o que muda de um item para outro.

// A medida do que ele escreveu: "32 X 25 MM" → "32×25mm"; "25MM" → "25mm";
// "3/4" fica "3/4". O separador segue o que a família já usa.
function medidaDoTexto(texto, sep) {
  const t = String(texto == null ? "" : texto);
  const x = sep || "x";
  const dupla = /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|pol)?(?![a-z])/i.exec(t);
  if (dupla) return `${dupla[1]}${x}${dupla[2]}${(dupla[3] || "").toLowerCase()}`;
  const simples = /(\d+(?:[.,]\d+)?)\s*(mm|cm|pol)(?![a-z])/i.exec(t);
  if (simples) return `${simples[1]}${simples[2].toLowerCase()}`;
  const fracao = /\d+\s*\/\s*\d+"?/.exec(t);
  return fracao ? fracao[0].replace(/\s+/g, "") : "";
}

// A palavra que diz O QUE é: a primeira de verdade — nem número, nem marca,
// nem "de". "LUVA SOLDAVEL TIGRE..." → "luva".
function palavraChave(texto) {
  const vazias = new Set(["de", "do", "da", "dos", "das", "com", "para", "pra", "tipo"]);
  return semMarcaNaLista(cotSemAcento(texto).split(" ").filter(Boolean))
    .find((p) => p.length >= 3 && !/\d/.test(p) && !vazias.has(p) && !COT_MARCAS.has(p)) || "";
}

// As famílias do catálogo que têm essa palavra, da mais parecida com o que
// ele escreveu para a menos; empatando, a que tem mais itens. Cada uma vem
// com o grupo, a unidade e o separador de medida que os itens dela usam.
function familiasDoCatalogo(chave, escrito, insumos, limite) {
  const k = cotSemAcento(chave);
  if (!k) return [];
  const doEscrito = new Set(cotSemAcento(escrito).split(" "));
  const mais = (o, v) => { if (v) o[v] = (o[v] || 0) + 1; };
  const topo = (o, padrao) => Object.keys(o).sort((a, b) => o[b] - o[a])[0] || padrao;
  const porFamilia = {};
  for (const i of buscarNoCatalogo(insumos, k, 1000)) {
    const segs = String(i.nome || "").split(" - ");
    const ultimo = segs[segs.length - 1].split(/\s+/);
    const pos = ultimo.findIndex((w) => cotSemAcento(w).startsWith(k));
    if (pos < 0) continue;
    const familia = [...segs.slice(0, -1), ultimo.slice(0, pos + 1).join(" ")]
      .map((p) => p.replace(/\s+/g, " ").trim()).join(" - ");     // "PVC -  Esgoto" = "PVC - Esgoto"
    const f = porFamilia[familia] || (porFamilia[familia] = { familia, n: 0, grupos: {}, unidades: {}, seps: {} });
    f.n++;
    mais(f.grupos, i.grupo); mais(f.unidades, i.unidade);
    mais(f.seps, /\d\s*×\s*\d/.test(i.nome) ? "×" : /\d\s*x\s*\d/i.test(i.nome) ? "x" : "");
  }
  return Object.values(porFamilia)
    .map((f) => ({
      familia: f.familia, n: f.n,
      grupo: topo(f.grupos, "Outros"), unidade: topo(f.unidades, "Unidades"), sep: topo(f.seps, "x"),
      afinidade: cotSemAcento(f.familia).split(" ").filter((p) => p.length >= 3 && p !== k && doEscrito.has(p)).length,
    }))
    .sort((a, b) => b.afinidade - a.afinidade || b.n - a.n || a.familia.localeCompare(b.familia, "pt-BR"))
    .slice(0, limite || 5);
}

// Os grupos que a empresa usa de verdade: os do catálogo dela (inclusive os
// que ela criou, como "Esgoto e Água Pluvial") mais os de fábrica, em ordem
// alfabética. Prestador de serviço não entra — aqui é material.
function gruposDoCatalogo(insumos, deFabrica) {
  const vistos = new Map();
  const por = (g) => { const t = String(g || "").replace(/\s+/g, " ").trim(); if (t && !vistos.has(cotSemAcento(t))) vistos.set(cotSemAcento(t), t); };
  for (const i of insumos || []) if (i && i.tipo !== "prestador") por(i.grupo);
  for (const g of deFabrica || []) por(g && g.nome ? g.nome : g);
  vistos.delete(cotSemAcento("Prestadores de serviços"));
  if (!vistos.has("outros")) vistos.set("outros", "Outros");
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

// Código do item novo. Grupo de fábrica tem prefixo fixo (HID, ACO…); grupo
// que a empresa criou não tem, e cairia em "OUT". Então: se os itens desse
// grupo no catálogo já usam um prefixo, segue a sequência dele.
function codigoDoGrupo(grupo, insumos, deFabrica) {
  const g = cotSemAcento(grupo);
  const conta = {}, maior = {};
  for (const i of insumos || []) {
    const m = /^([A-Z]{3})-(\d{3,})$/.exec((i && i.codigo) || "");
    if (!m) continue;
    maior[m[1]] = Math.max(maior[m[1]] || 0, Number(m[2]));
    if (cotSemAcento(i.grupo) === g) conta[m[1]] = (conta[m[1]] || 0) + 1;
  }
  const pre = Object.keys(conta).sort((a, b) => conta[b] - conta[a])[0];
  if (!pre) return typeof deFabrica === "function" ? deFabrica(grupo, insumos) : "";
  const doFabrica = typeof deFabrica === "function" ? deFabrica(grupo, insumos) : "";
  if (doFabrica && doFabrica.slice(0, 3) === pre) return doFabrica;   // a de fábrica já sabe das reservas
  return `${pre}-${String((maior[pre] || 0) + 1).padStart(3, "0")}`;
}

function nomeNoPadrao(familia, complemento) {
  return [String(familia || "").trim(), String(complemento || "").trim()].filter(Boolean).join(" ");
}

// Item novo cadastrado de dentro do pedido: entra no catálogo como qualquer
// outro, com código do grupo. O que o pedreiro escreveu vira apelido — da
// próxima vez que ele escrever igual, o VICKE já acha.
function novoInsumoDoPedido(campos, insumos, gerarCodigo, novoId) {
  const c = campos || {};
  const nome = String(c.nome || "").trim();
  if (!nome) return null;
  const grupo = c.grupo || "Outros";
  const aliases = [nome];
  const escrito = String(c.escrito || "").trim();
  if (escrito && cotSemAcento(escrito) !== cotSemAcento(nome)) aliases.push(escrito);
  return {
    id: novoId || (typeof uid === "function" ? uid() : String(Date.now())),
    codigo: typeof gerarCodigo === "function" ? gerarCodigo(grupo, insumos || []) : "",
    nome, grupo, unidade: c.unidade || "Unidades", tipo: "material",
    precoManual: null, precoFonte: null, precoNCompras: 0, precoFatorInccAplicado: 1,
    observacao: "", ativo: true, aliases,
    precoAtualizadoEm: new Date().toISOString(),
  };
}

// (cobertura), e quanto o nome do insumo diz a mais do que ele escreveu
// (um nome muito mais longo é um palpite mais arriscado).
function medirAssociacao(termo, nome) {
  const a = semMarcaNaLista(cotSemAcento(termo).split(" ").filter(Boolean));
  const b = cotSemAcento(nome).split(" ").filter(Boolean);
  if (!a.length || !b.length) return { cobertura: 0, score: 0 };
  let casados = 0, uteis = 0;
  for (const t of a) {
    if (t.length < 2) continue;           // "de", "x", "3" sozinhos não provam nada
    uteis++;
    if (b.some((x) => x === t || x.startsWith(t) || t.startsWith(x))) casados++;
  }
  if (!uteis) return { cobertura: 0, score: 0 };
  const cobertura = casados / uteis;
  const enxugado = Math.min(1, uteis / b.length);
  return { cobertura, score: Math.round(cobertura * (0.75 + 0.25 * enxugado) * 1000) / 1000 };
}

function scoreAssociacao(termo, nome) {
  return medirAssociacao(termo, nome).score;
}

// Os mais parecidos, do mais para o menos. Devolve candidatos — nunca
// resolve sozinho: quem confirma é a pessoa, item a item.
const COT_CORTE_ASSOCIACAO = 0.4;

function candidatosDoPedido(termo, insumos, limite) {
  const lista = (insumos || []).filter((i) => i && i.tipo !== "prestador");
  const medidos = lista.map((i) => {
    let melhor = medirAssociacao(termo, i.nome);
    for (const al of i.aliases || []) {
      const m = medirAssociacao(termo, al);
      if (m.score > melhor.score) melhor = m;
    }
    return { insumo: i, ...melhor, compras: Number(i.precoNCompras) || 0 };
  }).filter((r) => r.score >= COT_CORTE_ASSOCIACAO);

  // "Arame" serve tanto para o recozido quanto para o farpado: o texto sozinho
  // não desempata. Quem desempata é a SUA obra — entre dois que cobrem o que
  // ele escreveu por igual, vem na frente o que você mais comprou. É o que
  // faz "arame" cair em arame recozido sem ninguém ter escrito essa regra.
  return medidos
    .sort((a, b) =>
      Math.round(b.cobertura * 20) - Math.round(a.cobertura * 20) ||
      b.compras - a.compras ||
      b.score - a.score ||
      String(a.insumo.nome).localeCompare(String(b.insumo.nome), "pt-BR"))
    .slice(0, limite || 6)
    .map((r) => r.insumo);
}

// O recado vem com conversa em volta: "Bom dia Renato", "preciso do material
// pra semana:", "obrigado". Isso não é item.
//
// A regra só descarta quando a linha NÃO tem quantidade — "preciso de 10
// sacos de cimento" começa com "preciso" e continua sendo um pedido. Sem
// essa trava, a saudação levaria material junto.
const COT_ABERTURA_PEDIDO = /^(bom|boa|ola|oi|e ai|eai|obrigad[oa]s?|valeu|abraco|por favor|pfvr?|pf|blz|ok|beleza|preciso|precisa|precisamos|manda|mandar|me ve|me da|segue|lista|pedido|material|materiais|compra|comprar|falta|faltou|entao)\b/;

function ehConversaSolta(termo, quantidade) {
  if (Number(quantidade) > 0) return false;
  const t = cotSemAcento(termo);
  if (!t) return true;
  if (/:$/.test(String(termo).trim())) return true;   // "material da semana:"
  return COT_ABERTURA_PEDIDO.test(t);
}

// ── O que a frase diz além da lista ─────────────────────
// Ditando, ninguém dita só a lista: diz "para a obra da Cobop", "loja
// Ourifer", e depois os itens. Essas linhas não são material — se entrarem
// na lista viram item fantasma; se forem ignoradas, ele ainda tem que
// escolher no campo o que já falou. Então são lidas, consumidas, e viram o
// preenchimento dos campos.
//
// A regra é conservadora de propósito: só consome a linha quando ela é
// INTEIRA uma menção, e só preenche quando bate com UM candidato. Na dúvida
// devolve a escolha para quem sabe — preencher errado a obra manda a compra
// para o lugar errado, e ele só descobre no extrato.

// As palavras que apontam o que vem depois.
const COT_MARCA_OBRA = /^(para\s+)?(a\s+|o\s+)?(obra|cliente)\s+(d[aoe]s?\s+)?/;
const COT_MARCA_LOJA = /^(na\s+|no\s+|d[aoe]\s+)?(loja|fornecedor|material(is)?\s+d[aoe]|comprei\s+n[ao])\s+(d[aoe]s?\s+)?/;
// Sobras de ligação que atrapalham a comparação, mas não dizem nada.
const COT_SOBRA_LIGACAO = /\b(d[aoe]s?|em|no|na|para|pra|com)\b/g;
// Abaixo disso não é nome, é coincidência: "sa" casaria com meio cadastro.
const COT_MIOLO_MINIMO = 4;

function cotMioloDoNome(texto) {
  return cotSemAcento(texto).replace(COT_SOBRA_LIGACAO, " ").replace(/\s+/g, " ").trim();
}

// Casa o miolo da linha com os nomes de um candidato. Vale nos dois sentidos:
// "cobop" acha "COBOP COMÉRCIO DE BOMBAS", e "obra da reforma loja cobop"
// acha "Reforma Loja Cobop".
function cotCasaMencao(miolo, nomes) {
  if (!miolo || miolo.length < COT_MIOLO_MINIMO) return false;
  for (const n of nomes) {
    const alvo = cotMioloDoNome(n);
    if (!alvo || alvo.length < COT_MIOLO_MINIMO) continue;
    if (alvo.indexOf(miolo) >= 0 || miolo.indexOf(alvo) >= 0) return true;
  }
  return false;
}

function cotUnicoQueCasa(miolo, candidatos, nomesDe) {
  let achado = null;
  for (const c of candidatos || []) {
    if (!c) continue;
    if (!cotCasaMencao(miolo, nomesDe(c))) continue;
    if (achado) return null;   // dois casaram: ambíguo, ele escolhe
    achado = c;
  }
  return achado;
}

function contextoDaEntrada(texto, obras, lojas) {
  const fora = { obra: null, loja: null, textoLimpo: String(texto == null ? "" : texto), trechos: [] };
  const linhas = fora.textoLimpo.split(/\r?\n/);
  if (!linhas.length) return fora;

  const nomesDaObra = (o) => [o.nome, o.clienteNome, o.referencia].filter(Boolean);
  const nomesDaLoja = (f) => [f.nome, f.favorecido].filter(Boolean);
  const sobrou = [];

  for (const linha of linhas) {
    const cru = String(linha || "").trim();
    if (!cru) { sobrou.push(linha); continue; }

    // Linha que começa com número é item, ponto: "2 caixas Ourifer" é
    // material. O teste é o COMEÇO da linha, não "tem número em algum lugar"
    // — obra chamada "Jacarezinho Mod 1" ou "Lote 20" tem número no fim, e
    // pedir a quantidade a um leitor de itens dava 1 e engolia a menção.
    if (/^\s*\d/.test(cru)) { sobrou.push(linha); continue; }

    const base = cotSemAcento(cru).replace(/[.:;!?]+$/, "").trim();
    const marcaObra = COT_MARCA_OBRA.test(base);
    const marcaLoja = COT_MARCA_LOJA.test(base);
    const miolo = cotMioloDoNome(base.replace(marcaLoja ? COT_MARCA_LOJA : COT_MARCA_OBRA, ""));

    // Com marca, procura só do lado que a marca aponta. Sem marca, a linha
    // solta tem que casar com um lado só — senão não dá para saber.
    const achaObra = (!fora.obra && (marcaObra || !marcaLoja))
      ? cotUnicoQueCasa(miolo, obras, nomesDaObra) : null;
    const achaLoja = (!fora.loja && (marcaLoja || !marcaObra))
      ? cotUnicoQueCasa(miolo, lojas, nomesDaLoja) : null;

    if (achaObra && achaLoja) { sobrou.push(linha); continue; }   // não sei qual é
    if (achaObra) { fora.obra = achaObra; fora.trechos.push(cru); continue; }
    if (achaLoja) { fora.loja = achaLoja; fora.trechos.push(cru); continue; }
    sobrou.push(linha);
  }

  fora.textoLimpo = sobrou.join("\n");
  return fora;
}

function interpretarPedido(texto, insumos) {
  // O recado nem sempre vem em lista. Muitas vezes é uma frase só: "compra
  // 30 sacos de cimento, 40 tábuas de 30, 25 pregos 17x21 e 20 quilos de
  // arame". Vírgula, ponto e vírgula e o "e" que liga os itens separam tão
  // bem quanto a quebra de linha.
  const linhas = String(texto == null ? "" : texto)
    .split(/\r?\n|[;,]|\s+e\s+|\s+\+\s+/i)
    .map((l) => l.trim())
    .filter(Boolean);
  const saida = [];
  for (const l of linhas) {
    const item = interpretarLinhaDePedido(l);
    if (!item) continue;
    const limpo = cotSemAcento(item.termo);
    // linha sem letra nenhuma não é material
    if (!limpo || !/[a-z]/.test(limpo)) continue;
    if (ehConversaSolta(item.termo, item.quantidade)) continue;
    const materiais = (insumos || []).filter((i) => i && i.tipo !== "prestador");
    const r = typeof resolverInsumo === "function"
      ? resolverInsumo(item.termo, materiais)
      : { insumo: null, confianca: "nenhum", candidatos: [] };
    // Casou de verdade (código, apelido, nome igual)? é esse e acabou. Não
    // casou? aí entram os parecidos, na ordem — a primeira é a proposta.
    const doCatalogo = (r.candidatos || []).map((c) => c.insumo);
    const porAssociacao = r.insumo ? [] : candidatosDoPedido(item.termo, materiais, 6);
    const vistos = {};
    const candidatos = [...doCatalogo, ...porAssociacao].filter((c) => {
      const k = c.codigo || c.id;
      if (!k || vistos[k]) return false;
      vistos[k] = 1;
      return true;
    });
    saida.push({
      id: (typeof uid === "function" ? uid() : String(saida.length)),
      bruto: item.bruto,
      termo: item.termo,
      quantidade: item.quantidade,
      unidade: item.unidade,
      insumo: r.insumo || null,
      confianca: r.insumo ? r.confianca : (candidatos.length ? "sugestao" : "nenhum"),
      candidatos,
    });
  }
  return saida;
}

// Quantas o VICKE achou sozinho, quantas precisam de você.
// O mais parecido já entra escolhido — senão você escolheria à mão as
// mesmas três linhas toda vez. Mas fica marcado como "para confirmar": a
// leitura propõe, quem decide é você. O que a IA achou pelo código do
// catálogo não precisa dessa marca.
function promoverCandidatos(lidos) {
  return (lidos || []).map((x) => (x.insumo || !x.candidatos.length
    ? x
    : { ...x, insumo: x.candidatos[0], confirmar: true }));
}

function resumoDaLeitura(lidos) {
  const l = lidos || [];
  return {
    total: l.length,
    achados: l.filter((x) => x.insumo).length,
    sugeridos: l.filter((x) => !x.insumo && x.candidatos.length).length,
    soltos: l.filter((x) => !x.insumo && !x.candidatos.length).length,
    semQuantidade: l.filter((x) => !(Number(x.quantidade) > 0)).length,
  };
}

// A linha lida vira item da lista. Insumo escolhido manda na unidade e no
// nome; sem insumo, vale o texto do pedreiro.
function itemDoPedidoLido(lido) {
  const l = lido || {};
  const base = typeof itemCotacaoVazio === "function" ? itemCotacaoVazio() : { id: String(Math.random()) };
  if (l.insumo) {
    return { ...base, insumoId: l.insumo.id || l.insumo.codigo || "", codigo: l.insumo.codigo || "",
      descricao: l.insumo.nome || l.termo, unidade: l.insumo.unidade || l.unidade || "",
      quantidade: l.quantidade || "" };
  }
  return { ...base, insumoId: "", codigo: "", descricao: l.termo || l.bruto,
    unidade: l.unidade || "", quantidade: l.quantidade || "" };
}

// ══════════════════════════════════════════════════════════════
// LER O ORÇAMENTO QUE A LOJA MANDOU EM PDF
// ══════════════════════════════════════════════════════════════
// A loja responde num PDF do sistema dela — cabeçalho, dados do cliente e
// uma tabela de código / descrição / quantidade / unitário / total. Digitar
// isso de novo é onde o preço erra.
//
// O pdf.js já está carregado no app (é o mesmo que rasteriza a proposta),
// então dá para ler o texto no navegador, sem mandar o arquivo para lugar
// nenhum. PDF escaneado (foto) não tem texto e não é lido — nesse caso o
// caminho continua sendo digitar.

// Cada linha vira uma lista de CÉLULAS, não uma frase: o pdf.js entrega um
// pedaço de texto por coluna, e é isso que permite separar "Cimento Cp Ii F
// 50kg - Csn" de "6" e "43,00" sem depender de quantos espaços o PDF pôs.
async function linhasDoPdf(blob) {
  if (typeof window === "undefined" || !window.pdfjsLib) {
    throw new Error("O leitor de PDF ainda está carregando. Tente de novo em alguns segundos.");
  }
  const dados = await blob.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: dados }).promise;
  const linhas = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const pagina = await pdf.getPage(p);
    const conteudo = await pagina.getTextContent();
    const porY = {};
    for (const it of conteudo.items || []) {
      const txt = String(it.str || "").trim();
      if (!txt) continue;
      const x = (it.transform && it.transform[4]) || 0;
      const y = Math.round(((it.transform && it.transform[5]) || 0) * 2) / 2;   // meio ponto
      (porY[y] = porY[y] || []).push({ x, txt });
    }
    Object.keys(porY)
      .map(Number)
      .sort((a, b) => b - a)     // PDF conta de baixo para cima
      .forEach((y) => {
        const celulas = porY[y].sort((a, b) => a.x - b.x).map((c) => c.txt);
        linhas.push({ celulas, texto: celulas.join(" ") });
      });
  }
  return linhas;
}

// Número em pt-BR que a loja escreve: "1.234,56", "43,00", "R$ 43,00".
const COT_RE_NUM = /^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+([.,]\d+)?$/;

// O cifrão vem ora grudado no número, ora numa célula só dele; o espaço às
// vezes é o fino (\u00a0). Nada disso muda o valor.
function limparNumeroOrc(txt) {
  return String(txt == null ? "" : txt).replace(/\u00a0/g, " ").replace(/R\$/gi, "").trim();
}

function ehNumeroDeOrcamento(txt) {
  const t = limparNumeroOrc(txt);
  if (!t || /%$/.test(t)) return false;      // desconto em % não é valor
  return COT_RE_NUM.test(t);
}

function numeroDeOrcamento(txt) {
  const t = limparNumeroOrc(txt);
  if (t.indexOf(",") >= 0) return numeroDoCampo(t);          // pt-BR
  // sem vírgula: ponto pode ser milhar ("1.234") ou decimal ("1.05")
  const m = /^(-?\d+)\.(\d+)$/.exec(t);
  if (m) return m[2].length === 3 ? Number(m[1] + m[2]) : Number(t);
  return numeroDoCampo(t);
}

// ── O formato muda de loja para loja ────────────────────────────
// Cada sistema emite o orçamento do jeito dele: uma tem coluna de código,
// outra não; uma escreve "Qtde", outra "Quant."; uma põe a unidade antes do
// preço, outra nem tem unidade; tem tabela sem coluna de total e tabela com
// coluna de desconto no meio. Então não dá para contar casas fixas.
//
// Duas âncoras seguram a leitura, e as duas independem do desenho:
//   1. o cabeçalho da tabela, que diz o que é cada coluna; e
//   2. a conta: quantidade × unitário = total. Essa não mente.
// Quando as duas concordam, o preço está certo. Quando só uma existe, ela
// vale. Quando nenhuma fecha, a linha entra como está e você corrige na
// conferência — é para isso que a conferência existe.

// A nota fiscal escreve a unidade por extenso e em maiúscula — "METRO",
// "QUILO", "PECAS" — onde o orçamento da loja abrevia. Faltando a palavra
// inteira, ela é lida como parte do nome do material.
const COT_RE_UNIDADE_TABELA = /^(un|und|unid|unidade|unidades|pc|p[çc]|pcs|peca|pe[çc]a|pecas|pe[çc]as|cx|caixa|caixas|sc|saco|sacos|kg|kgs|g|ton|quilo|quilos|kilo|kilos|m|mt|mts|metro|metros|m2|m²|m3|m³|l|lt|lts|litro|litros|lata|latas|br|barra|barras|rl|rolo|rolos|pt|pct|pacote|pacotes|jg|jogo|jogos|cj|conj|ml|par|pares|dz|duzia|dúzia|duzias|fd|fardo|gl|galao|galão|bd|balde|baldes|milheiro|vb)\.?$/i;

// Cada rótulo de coluna, no que ele significa. A ordem importa: "Un." é
// unidade, "Unit." é preço — o teste da unidade vem antes e exige a célula
// inteira, senão "Unitário" seria lido como unidade.
function papelDaCelula(txt) {
  const t = String(txt == null ? "" : txt).trim();
  if (!t) return "";
  if (/^(un|und|unid|unidade)\.?$/i.test(t)) return "unidade";
  if (/^(qtd|qtde|quant|qt)\b/i.test(t)) return "quantidade";
  if (/(unit|unt)/i.test(t)) return "unitario";
  if (/^(pre[çc]o|p\.?\s*un|vl\.?\s*un|valor\s*un)/i.test(t)) return "unitario";
  if (/^(total|subtotal|sub-total|vl\.?\s*tot|valor\s*tot|v\.?\s*tot|l[íi]quido)/i.test(t)) return "total";
  // "Descrição" antes de "Desc.": a coluna do desconto abrevia igualzinho ao
  // começo da palavra descrição, e trocar as duas embaralha a tabela inteira.
  if (/^(descri|produto|item|mercadoria|material|especifica|discrimina)/i.test(t)) return "descricao";
  if (/^(desc|ipi|icms|aliq|al[íi]q|%)/i.test(t)) return "outro";       // coluna numérica que não uso
  if (/^(c[óo]d|ref)/i.test(t)) return "codigo";
  return "";
}

// Acha a linha que é o cabeçalho da tabela e devolve a ORDEM das colunas
// numéricas — é isso que permite ler "Qtde | Desconto | Unitário | Total"
// sem confundir o desconto com o preço.
function papeisDaTabela(linhas) {
  let melhor = null;
  (linhas || []).forEach((l, i) => {
    const cel = ((l || {}).celulas || []).map((c) => String(c).trim()).filter(Boolean);
    if (!cel.length) return;
    if (cel.some(ehNumeroDeOrcamento)) return;          // cabeçalho não tem número
    const papeis = cel.map(papelDaCelula);
    const numericos = papeis.filter((p) => p === "quantidade" || p === "unitario" || p === "total" || p === "outro");
    const nota = numericos.filter((p) => p !== "outro").length + (papeis.indexOf("descricao") >= 0 ? 1 : 0);
    if (nota >= 2 && (!melhor || nota > melhor.nota)) melhor = { i, nota, papeis: numericos };
  });
  return melhor;
}

// Uma linha da tabela vira item. Os números do fim são os valores; o que
// vem antes é código, descrição e unidade. Cabeçalho e linha de somatório
// não passam: o primeiro não tem número, o segundo não tem descrição.
function itemDeOrcamento(linha, papeis) {
  const cel = ((linha || {}).celulas || []).map((c) => String(c).trim()).filter(Boolean);
  if (cel.length < 2) return null;
  const daNota = !!(linha && linha.danfe);

  // De trás para a frente: os números do fim são os valores, e uma unidade
  // ("UN", "SC") no meio deles não interrompe a contagem.
  const valores = [];
  let unidade = "";
  let k = cel.length - 1;
  while (k >= 0) {
    if (ehNumeroDeOrcamento(cel[k])) { valores.unshift(numeroDeOrcamento(cel[k])); k--; continue; }
    if (COT_RE_UNIDADE_TABELA.test(cel[k]) && valores.length) { unidade = cel[k].replace(/\.$/, ""); k--; continue; }
    break;
  }
  if (!valores.length) return null;

  const cabeca = cel.slice(0, k + 1);
  // Código de produto tem cara de código: zeros à esquerda ou quatro dígitos
  // para cima. "300" na frente da descrição é quantidade, não código — e
  // confundir os dois estraga o preço da linha inteira.
  const codigo = (daNota || /^0\d{2,}$|^\d{4,}$/.test(cabeca[0] || "")) ? (cabeca[0] || "") : "";
  // A descrição começa na primeira palavra de verdade: número solto antes
  // dela é código ou quantidade, nunca nome de material. Já número DEPOIS
  // ("Tijolo 8 Furos") é parte do nome e fica.
  const iNome = cabeca.findIndex((c, i) => (!daNota || i > 0)
    && /[a-zA-ZÀ-ÿ]{3}/.test(c) && !COT_RE_UNIDADE_TABELA.test(c));
  if (iNome < 0) return null;
  const palavras = cabeca.slice(iNome).filter((c) => !COT_RE_UNIDADE_TABELA.test(c));
  if (!unidade) {
    const u = cabeca.find((c) => COT_RE_UNIDADE_TABELA.test(c));
    if (u) unidade = u.replace(/\.$/, "");
  }
  const descricao = palavras.join(" ").trim();
  if (!descricao || !/[a-zA-ZÀ-ÿ]{3}/.test(descricao)) return null;
  if (/^(total|subtotal|sub-total|soma)\b/i.test(descricao)) return null;

  // Números que ficaram ANTES da descrição: tem loja que põe a quantidade na
  // frente ("300 UN Tijolo ... 1,05 315,00").
  const naFrente = [];
  for (let i = codigo ? 1 : 0; i < iNome; i++) if (ehNumeroDeOrcamento(cel[i])) naFrente.push(numeroDeOrcamento(cel[i]));

  const bate = (a, b, c) => a > 0 && b > 0 && c > 0 && Math.abs(a * b - c) <= Math.max(0.02, c * 0.012);
  let quantidade = 0, unitario = 0, total = 0;

  // 1. O cabeçalho manda, quando o número de colunas bate com o da linha.
  if (papeis && papeis.length && papeis.length === valores.length) {
    papeis.forEach((p, i) => {
      if (p === "quantidade") quantidade = valores[i];
      else if (p === "unitario") unitario = valores[i];
      else if (p === "total") total = valores[i];
    });
    // Se a conta não fecha, o cabeçalho não serviu para esta linha.
    if (quantidade > 0 && unitario > 0 && total > 0 && !bate(quantidade, unitario, total)) {
      quantidade = 0; unitario = 0; total = 0;
    }
  }

  // 2. A conta: dois números que multiplicados dão um terceiro.
  if (!(unitario > 0) || !(total > 0)) {
    let achou = null;
    for (let c = valores.length - 1; c >= 2 && !achou; c--)
      for (let a = 0; a < c && !achou; a++)
        for (let b = a + 1; b < c && !achou; b++)
          if (bate(valores[a], valores[b], valores[c])) achou = { q: valores[a], u: valores[b], t: valores[c] };
    // quantidade na frente da descrição
    if (!achou && valores.length >= 2 && naFrente.length) {
      const q = naFrente[naFrente.length - 1];
      for (let b = 0; b < valores.length - 1 && !achou; b++)
        for (let c = b + 1; c < valores.length && !achou; c++)
          if (bate(q, valores[b], valores[c])) achou = { q, u: valores[b], t: valores[c] };
    }
    if (achou) { quantidade = achou.q; unitario = achou.u; total = achou.t; }
  }

  // 3. Nada fechou: dois números no fim são quantidade e unitário — é o
  //    desenho mais comum de tabela sem coluna de total.
  if (!(unitario > 0) && !(total > 0) && valores.length === 2) {
    quantidade = valores[0]; unitario = valores[1];
  }

  // 4. Preencher o que falta, sempre pela conta.
  if (quantidade > 0 && unitario > 0 && !(total > 0)) total = Math.round(quantidade * unitario * 100) / 100;
  if (quantidade > 0 && total > 0 && !(unitario > 0)) unitario = Math.round((total / quantidade) * 10000) / 10000;
  if (unitario > 0 && total > 0 && !(quantidade > 0)) quantidade = Math.round((total / unitario) * 1000) / 1000;

  if (!(unitario > 0) && !(total > 0)) return null;
  return { codigo, descricao, unidade, quantidade, unitario, total };
}

// ── Descrição que nem material é ───────────────────────
// "6102 METRO" não é um insumo que falta no catálogo: é CFOP com unidade, o
// sinal de que a leitura do papel pegou a coluna errada. A diferença importa
// porque as duas situações pedem coisas opostas: uma pede cadastrar o item,
// a outra pede reler o papel.
//
// Perguntar à IA por uma dessas é gastar chamada para consertar um dado que
// nasceu torto duas etapas antes — e ela responde, com razão, que não achou.
// Isso parece falha da IA e esconde a falha real.

// Palavras que aparecem no papel mas nunca nomeiam um material.
// Sem acento de propósito: a comparação passa por cotSemAcento antes.
const COT_PALAVRA_FISCAL = /^(ncm|sh|cst|csosn|cfop|icms|ipi|pis|cofins|aliq|aliquota|bc|st|un|unid|vl|vlr|qtd|qtde|quant|total|subtotal|desc|desconto|base|calc|valor|unit|unitario|serv|prod|produto|item)$/i;

// Uma palavra que pode ser nome de material: tem letra que baste, não é
// unidade e não é rótulo de coluna fiscal.
function palavraDeMaterial(p) {
  const w = String(p == null ? "" : p).trim();
  if (!w) return false;
  const letras = (w.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
  if (letras < 3) return false;                    // "18X27", "6102", "m²"
  if (COT_RE_UNIDADE_TABELA.test(w)) return false; // "METRO", "QUILO", "SC"
  if (COT_PALAVRA_FISCAL.test(cotSemAcento(w))) return false;
  return true;
}

// A descrição não nomeia material nenhum? Então o papel foi lido torto.
function descricaoSemMaterial(texto) {
  const t = String(texto == null ? "" : texto).trim();
  if (!t) return true;
  return !t.split(/[\s\/\-|]+/).some(palavraDeMaterial);
}

// ── A nota fiscal é outra tabela ─────────────────────────
// A DANFE não é o orçamento de uma loja: o layout dela é fixado por lei, e
// traz entre o nome do produto e os valores um bloco fiscal que orçamento
// nenhum tem — NCM, CST/CSOSN e CFOP. Pior: muitos emissores imprimem a
// DESCRIÇÃO numa linha própria, logo acima da linha dos números.
//
// Lida pela regra geral, a linha de números fica assim:
//     ["8","25059000","0103","6102 METRO","2,00","130,00","260,00","0,00",…]
// e o único pedaço com letras é "6102 METRO" — que vira o nome do material.
// Foi exatamente o que apareceu na tela: três itens chamados "6102 METRO" e
// "6404 QUILO", com a quantidade e o total certos e o nome perdido.
//
// A saída não é afrouxar a regra geral, que atende dezenas de orçamentos
// diferentes: é reconhecer a DANFE pelo que ela tem de único e reescrever a
// linha no formato que a regra geral já entende.

// NCM tem oito dígitos; CFOP tem quatro e começa em 1..7. O emissor costuma
// grudar o CFOP na unidade numa célula só ("6102 METRO").
const COT_RE_NCM = /^\d{8}$/;
const COT_RE_CFOP = /^[1-7]\d{3}$/;
const COT_RE_CFOP_UNID = /^([1-7]\d{3})\s+([A-Za-zÀ-ÿ²³]{1,12})\.?$/;

// Devolve o miolo de uma linha de produto da DANFE, ou null se não for uma.
// Exige o bloco fiscal INTEIRO: achar só um número de oito dígitos não basta
// — orçamento tem código de barras, que também é um número comprido.
function pedacoDeDanfe(celulas) {
  const cel = (celulas || []).map((c) => String(c).trim()).filter(Boolean);
  if (cel.length < 5) return null;

  let iNcm = -1;
  for (let i = 0; i < cel.length; i++) if (COT_RE_NCM.test(cel[i])) { iNcm = i; break; }
  if (iNcm < 0) return null;

  let j = iNcm + 1;
  if (j < cel.length && /^\d{3,4}$/.test(cel[j]) && !COT_RE_CFOP.test(cel[j])) j++;  // CST/CSOSN
  let unidade = "";
  const m = j < cel.length ? COT_RE_CFOP_UNID.exec(cel[j]) : null;
  if (m) { unidade = m[2]; j++; }
  else if (j < cel.length && COT_RE_CFOP.test(cel[j])) {
    j++;
    if (j < cel.length && COT_RE_UNIDADE_TABELA.test(cel[j])) { unidade = cel[j].replace(/\.$/, ""); j++; }
  } else return null;   // sem CFOP depois do NCM não é DANFE

  // A ordem das colunas da DANFE é lei: QUANT, UNITÁRIO, TOTAL, e depois
  // desconto, bases e alíquotas. São os três primeiros que interessam.
  const numeros = cel.slice(j).filter(ehNumeroDeOrcamento);
  if (numeros.length < 3) return null;
  const q = numeroDeOrcamento(numeros[0]);
  const u = numeroDeOrcamento(numeros[1]);
  const tot = numeroDeOrcamento(numeros[2]);
  // A conta tem que fechar. Não fechando, prefiro devolver a linha à regra
  // geral a inventar um preço com a ordem que eu supus.
  if (!(q > 0) || !(u > 0) || !(tot > 0)) return null;
  if (Math.abs(q * u - tot) > Math.max(0.02, tot * 0.012)) return null;

  const antes = cel.slice(0, iNcm);
  const codigo = antes.length ? antes[0] : "";
  return { codigo, descricao: antes.slice(1).join(" ").trim(), unidade,
    numeros: [numeros[0], numeros[1], numeros[2]] };
}

// O papel é uma nota fiscal? A DANFE se identifica no cabeçalho, sempre.
function ehDanfe(texto) {
  return /\bDANFE\b|NOTA\s+FISCAL\s+ELETR/i.test(String(texto || ""));
}

// O número da nota: "Nº 000.008.623" vira "8623". Os zeros à esquerda e os
// pontos são enfeite de impressão — e guardar "000.008.623" num lugar e
// "8.623" noutro faria a mesma nota entrar duas vezes sem ninguém notar.
function numeroDaNota(texto) {
  // "Nº 000.008.623" e também "N.º 000.000.163" (FlexDev põe o ponto antes do º)
  const m = /N\.?\s*[º°o]\.?\s*([\d.]{3,})/i.exec(String(texto || ""));
  if (!m) return "";
  const so = String(m[1]).replace(/\D/g, "").replace(/^0+/, "");
  return so || "";
}

// A data de emissão da nota. Na DANFE o rótulo "DATA DA EMISSÃO" fica num
// cabeçalho e o valor cai noutra linha, então procurar "DATA" e ler o resto
// da linha devolve " DA EMISSÃO" — nada. Sem a data o pedido assume HOJE, e
// uma nota de 29/09 lançada em 02/10 entra na competência errada: o custo
// muda de mês, e o mês que já foi conferido passa a mentir.
//
// O rodapé da DANFE repete "EMISSÃO: 29/09/2026" numa linha só — é por ali
// que se começa; o rótulo com o valor adiante é a segunda tentativa.
function dataDaNota(texto) {
  const tudo = String(texto || "");
  const m1 = /EMISS[ÃA]O:?\s*(\d{2}\/\d{2}\/\d{4})/i.exec(tudo);
  if (m1) return dataIsoDoOrcamento(m1[1]);
  const m2 = /DATA\s+DA\s+EMISS[ÃA]O[\s\S]{0,240}?(\d{2}\/\d{2}\/\d{4})/i.exec(tudo);
  return m2 ? dataIsoDoOrcamento(m2[1]) : "";
}

// A linha de uma DANFE vira uma linha comum de tabela. Quando a descrição
// veio sozinha na linha de cima, é aqui que as duas se juntam — e a de cima
// sai, para não sobrar um item sem número nenhum.
// Uma linha que é SÓ o nome do produto: tem letras, nenhum número de
// valor, e não é cabeçalho de coluna nem título de bloco da nota. O nome
// pode vir quebrado em várias células ("VEDA", "CONCRETO", "BALDE COM 18
// LITROS") — o PDF corta onde o emissor mudou de fonte.
function textoDeNomeDaDanfe(linha) {
  const cel = (((linha || {}).celulas) || []).map((c) => String(c).trim()).filter(Boolean);
  if (!cel.length) return "";
  if (cel.some((c) => ehNumeroDeOrcamento(c))) return "";
  const t = cel.join(" ");
  if (!/[a-zA-ZÀ-ÿ]{3}/.test(t)) return "";
  if (/^[.\-_=\s]+$/.test(t)) return "";
  if (/DESCRI[ÇC][ÃA]O|\bNCM\b|\bCFOP\b|QUANT|C[ÁA]LCULO|DADOS (DOS|ADICIONAIS)|INFORMA[ÇC][ÕO]ES|TRANSPORTADOR|DESTINAT[ÁA]RIO/i.test(t)) return "";
  return t;
}

function juntarLinhasDaDanfe(linhas) {
  const lista = linhas || [];
  const saida = [];
  for (let i = 0; i < lista.length; i++) {
    const d = pedacoDeDanfe((lista[i] || {}).celulas);
    if (!d) { saida.push(lista[i]); continue; }

    // O nome que não veio na linha dos números está numa vizinha: a maioria
    // dos emissores imprime ACIMA; alguns (o FlexDev, por exemplo) imprimem
    // ABAIXO. Acima vale primeiro — o nome de cima de um item é sempre dele.
    // Abaixo só se a linha de cima não é nome (cabeçalho, ou a linha do
    // item anterior, que já levou o nome dela).
    let descricao = d.descricao;
    if (!descricao && saida.length) {
      const acima = textoDeNomeDaDanfe(saida[saida.length - 1]);
      if (acima && !saida[saida.length - 1].danfe) { descricao = acima; saida.pop(); }
    }
    if (!descricao && i + 1 < lista.length && !pedacoDeDanfe((lista[i + 1] || {}).celulas)) {
      const abaixo = textoDeNomeDaDanfe(lista[i + 1]);
      if (abaixo) { descricao = abaixo; i++; }
    }
    if (!descricao) { saida.push(lista[i]); continue; }

    const celulas = [d.codigo, descricao, d.unidade].filter(Boolean).concat(d.numeros);
    // `danfe` diz à regra geral que a primeira célula É o código do produto.
    // Sem isso ela desconfia de número curto na frente — e com razão, porque
    // em orçamento "300" na frente costuma ser quantidade —, mas na nota a
    // coluna é fixa e eu já a identifiquei pela estrutura.
    saida.push({ celulas, texto: celulas.join(" "), danfe: !!d.codigo });
  }
  return saida;
}

const COT_MESES_PT = {};

function dataIsoDoOrcamento(txt) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(String(txt || ""));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

// O orçamento inteiro: o cabeçalho responde de quem é e até quando vale; a
// tabela responde quanto custa cada coisa.
function interpretarOrcamento(linhas) {
  const cru = (linhas || []).map((l) => (typeof l === "string" ? { celulas: [l], texto: l } : l));
  // Nota fiscal primeiro: ela tem um desenho próprio, e reconhecê-lo aqui
  // evita afrouxar a regra que lê os orçamentos das lojas.
  const lista = juntarLinhasDaDanfe(cru);
  const tudo = lista.map((l) => l.texto).join("\n");
  // Achado o cabeçalho, a tabela começa embaixo dele: o que está acima é
  // papel timbrado, dados do cliente e o total do rodapé do cabeçalho — e
  // nada disso pode virar item.
  const cab = papeisDaTabela(lista);
  const itens = [];
  lista.forEach((l, i) => {
    if (cab && i <= cab.i) return;
    const it = itemDeOrcamento(l, cab ? cab.papeis : null);
    if (it) itens.push(it);
  });
  const cnpj = (/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/.exec(tudo) || [])[1] || "";
  // o nome da loja é a primeira linha de verdade do papel — antes de
  // qualquer rótulo ("IE:", "CNPJ", "Rua", "Fone")
  let fornecedor = "";
  // Na nota fiscal o emitente vem no canhoto: "RECEBEMOS DE <emitente> OS
  // PRODUTOS CONSTANTES…" — às vezes na mesma linha, às vezes na de baixo.
  if (ehDanfe(tudo)) {
    const iRec = lista.findIndex((l) => /RECEBEMOS\s+DE/i.test(String(l.texto || "")));
    if (iRec >= 0) {
      const mesma = String(lista[iRec].texto || "").replace(/^.*RECEBEMOS\s+DE\s*/i, "");
      const alvo = mesma.trim() ? mesma : String((lista[iRec + 1] || {}).texto || "");
      fornecedor = alvo.replace(/\s*OS PRODUTOS.*$/i, "").replace(/\s*DATA DE RECEBIMENTO.*$/i, "").trim();
    }
  }
  for (const l of fornecedor ? [] : lista.slice(0, 8)) {
    const t = String(l.texto || "").trim();
    if (!t || t.length < 3) continue;
    if (/^(ie:|cnpj|cpf|rua|av\.|avenida|fone|tel|e-?mail|or[çc]amento|n[úu]mero|data|nf-?e\b|danfe|recebemos)/i.test(t)) continue;
    if (!/[a-zA-ZÀ-ÿ]{3}/.test(t)) continue;
    fornecedor = t;
    break;
  }
  const validade = dataIsoDoOrcamento((/V[ÁA]LIDO\s+AT[ÉE][:\s]*([^•\n]+)/i.exec(tudo) || [])[1] || "");
  // A emissão declarada vale mais do que a primeira "DATA" que aparecer.
  const emitido = dataDaNota(tudo)
    || dataIsoDoOrcamento((/DATA[:\s]*([^•\n]+)/i.exec(tudo) || [])[1] || "");
  // A condição costuma vir na mesma linha do rótulo, mas nem sempre: tem
  // PDF em que o valor cai na linha de cima, junto do total. Então, quando a
  // linha do rótulo não traz nada, olha-se a vizinha.
  const limparCondicao = (t) => String(t || "")
    .replace(/Total:?.*$/i, "")
    .replace(/[\d.,]+\s*$/, "")
    .replace(/^[\s:–-]+/, "")
    .trim();
  let condicao = limparCondicao((/Condi[çc][ãa]o\s+de\s+Pagamento[:\s]*([^\n]*)/i.exec(tudo) || [])[1] || "");
  if (!condicao) {
    const iRot = lista.findIndex((l) => /Condi[çc][ãa]o\s+de\s+Pagamento/i.test(l.texto || ""));
    for (const vizinho of [lista[iRot - 1], lista[iRot + 1]]) {
      const t = limparCondicao((vizinho || {}).texto || "");
      if (t && t.length <= 40 && /[a-zA-ZÀ-ÿ]{3}/.test(t)) { condicao = t; break; }
    }
  }

  // O total do papel. Só vale o "Total:" que tem número NA MESMA LINHA — sem
  // isso o rótulo da coluna "Total" casaria com o código do primeiro item da
  // tabela logo abaixo, e o orçamento sairia valendo o número do código.
  // Sem total no cabeçalho, vale a soma dos itens.
  const somaItens = Math.round(itens.reduce((a, i) => a + (i.total || 0), 0) * 100) / 100;
  // "SubTotal: 539,40" também contém "Total:" e vinha ganhando do total
  // de verdade — no pedido da loja os dois estão no papel, e o que se paga
  // é o de baixo. Apaga-se o subtotal antes de procurar.
  const semSubtotal = tudo.replace(/sub\s*-?\s*total/gi, "§");
  const mTotal = /Total:?[^\S\n]*([\d.,]+)/i.exec(semSubtotal);
  const total = mTotal ? numeroDeOrcamento(mTotal[1]) : somaItens;
  // O papel de PEDIDO traz três coisas que o orçamento não tem, e as três
  // são necessárias na conta de loja: o número com que a loja vai cobrar,
  // o desconto que ela dá no rodapé (nunca no item) e o vencimento.
  const numeroPedido = String((/PEDIDO:?[^\S\n]*([\w./-]+)/i.exec(tudo) || [])[1] || "");
  const mDesconto = /Desconto:?[^\S\n]*([\d.,]+)/i.exec(tudo);
  const desconto = mDesconto ? numeroDeOrcamento(mDesconto[1]) : 0;
  const mVenc = /vencimento[\s\S]{0,120}?(\d{2}\/\d{2}\/\d{2,4})/i.exec(tudo);
  const venc = mVenc ? mVenc[1] : "";
  const vencimento = /^\d{2}\/\d{2}\/\d{2}$/.test(venc)
    ? dataIsoDoOrcamento(venc.slice(0, 6) + "20" + venc.slice(6))
    : dataIsoDoOrcamento(venc);
  // Nota fiscal não tem número de pedido — tem número de NOTA, e é por ele
  // que a compra se identifica, se concilia e se evita lançar duas vezes.
  const nota = ehDanfe(tudo);
  return { fornecedor, cnpj, numero: String((/N[ÚU]MERO[:\s]*([\w-]+)/i.exec(tudo) || [])[1] || ""),
    numeroPedido, numeroNota: nota ? numeroDaNota(tudo) : "", ehNota: nota,
    desconto, vencimento,
    emitido, validade, condicao, total, somaItens, itens };
}

// A loja pode ter mandado só o total da linha, sem o unitário. Com a
// quantidade do pedido em mãos, o unitário sai da divisão — que é o que
// interessa, porque é por unitário que o VICKE compara e lança.
function precoDaLinha(linha, quantidade) {
  const l = linha || {};
  if (l.unitario > 0) return l.unitario;
  const q = Number(quantidade || l.quantidade || 0);
  if (l.total > 0 && q > 0) return Math.round((l.total / q) * 10000) / 10000;
  return 0;
}

// ── Casar o que a loja mandou com o que foi pedido ──────────────
// A loja escreve do jeito dela ("Cimento Cp Ii F 50kg - Csn") e o pedido tem
// o nome do catálogo. É a mesma associação por palavra do recado do pedreiro
// — aqui só muda o que se compara.
function casarOrcamentoComItens(cot, orcamento) {
  const itens = itensDaCotacao(cot);
  const doPdf = ((orcamento || {}).itens) || [];
  const usados = {};
  const casados = itens.map((it) => {
    let melhor = null;
    doPdf.forEach((linha, i) => {
      if (usados[i]) return;
      const score = Math.max(
        scoreAssociacao(it.descricao, linha.descricao),
        scoreAssociacao(linha.descricao, it.descricao));
      if (score >= COT_CORTE_ASSOCIACAO && (!melhor || score > melhor.score)) melhor = { i, linha, score };
    });
    if (melhor) usados[melhor.i] = 1;
    return { item: it, linha: melhor ? melhor.linha : null, score: melhor ? melhor.score : 0 };
  });
  const sobrando = doPdf.filter((_, i) => !usados[i]);
  return { casados, sobrando, achados: casados.filter((c) => c.linha).length };
}

// ── Embalagem diferente não é o mesmo item ──────────────────────
// A Ourifer cotou "Cimento Votoran 25kg" a R$ 22 para um pedido de saco de
// 50kg — e o preço entrou no de 50, deixando a loja com o cimento pela
// metade do preço. Nome parecido engana: o que decide é a embalagem. Peso,
// volume e o modelo da tela (Q61 × Q92) têm que bater; se os dois dizem e
// dizem diferente, a linha não é ligada sozinha.
function medidasDeEmbalagem(texto) {
  // Sem o normalizador comum: ele troca o ponto por espaço, e "7,404kg"
  // viraria "7 404kg" — 404 quilos.
  const t = String(texto == null ? "" : texto).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/(\d),(\d)/g, "$1.$2");
  const num = (x) => Number(String(x).replace(",", "."));
  const m = {};
  const kg = /(\d+(?:\.\d+)?)\s*(kg|kgs|kilos?|quilos?)\b/.exec(t);
  if (kg) m.kg = num(kg[1]);
  const l = /(\d+(?:\.\d+)?)\s*(l|lt|lts|litros?)\b/.exec(t);
  if (l) m.l = num(l[1]);
  const q = /\be?q\s?0*(\d{2,3})\b/.exec(t);
  if (q) m.q = Number(q[1]);
  return m;
}

function divergenciaDeEmbalagem(doPedido, daLoja) {
  const a = medidasDeEmbalagem(doPedido), b = medidasDeEmbalagem(daLoja);
  const fmt = (v) => String(v).replace(".", ",");
  for (const [k, nome, un] of [["kg", "peso", " kg"], ["l", "volume", " L"], ["q", "modelo", ""]]) {
    if (a[k] == null || b[k] == null || a[k] === b[k]) continue;
    const pre = k === "q" ? "Q" : "";
    return {
      tipo: nome,
      texto: `${nome === "modelo" ? "modelo" : "embalagem"} diferente — pedido ${pre}${fmt(a[k])}${un}, loja ${pre}${fmt(b[k])}${un}`,
      // Só peso e volume convertem: 2 sacos de 25 kg são 1 de 50. Tela Q61
      // não vira Q92 multiplicando.
      fator: k === "q" || !(b[k] > 0) ? 0 : a[k] / b[k],
    };
  }
  return null;
}

// Da leitura para a tela de conferência: que linha vai em cada item, e a
// que preço. Duas regras em cima do que o leitor achou:
//  - embalagem diferente não entra sozinha: fica sem preço, com o aviso e
//    a linha sugerida, para você decidir (e, se quiser, converter);
//  - item repetido no pedido (o mesmo material em duas linhas) leva o
//    preço da mesma linha da loja — ela cotou uma vez, vale para as duas.
function escolhasDoCasamento(casamento, orcamento) {
  const linhas = ((orcamento || {}).itens) || [];
  const escolhas = {};
  const chave = (it) => String(it.codigo || it.insumoId || "") || cotSemAcento(it.descricao);
  const porChave = {};
  for (const { item, linha } of (casamento || {}).casados || []) {
    const i = linha ? linhas.indexOf(linha) : -1;
    const qtd = quantidadeDoItem(item);
    const dif = linha ? divergenciaDeEmbalagem(item.descricao, linha.descricao) : null;
    if (i >= 0 && dif) {
      escolhas[item.id] = { i: -1, preco: 0, sugerida: i, divergencia: dif };
      continue;
    }
    escolhas[item.id] = { i, preco: linha ? precoDaLinha(linha, qtd) : 0 };
    if (i >= 0 && !porChave[chave(item)]) porChave[chave(item)] = { i, linha };
  }
  for (const { item } of (casamento || {}).casados || []) {
    const e = escolhas[item.id];
    if (e.i >= 0 || e.divergencia) continue;
    const irmao = porChave[chave(item)];
    if (irmao) escolhas[item.id] = { i: irmao.i, preco: precoDaLinha(irmao.linha, quantidadeDoItem(item)), repetido: true };
  }
  return escolhas;
}

// A loja do papel costuma já estar cadastrada — e aí a proposta tem que
// ficar amarrada no cadastro, não só com o nome digitado: é o cadastro que
// leva o telefone, o CNPJ e o contrato depois. O CNPJ é a prova; o nome só
// vale quando é o mesmo nome.
function lojaCadastrada(prestadores, orcamento) {
  const lista = (prestadores || []).filter((f) => f && f.ativo !== false);
  const o = orcamento || {};
  const so = (t) => String(t == null ? "" : t).replace(/\D/g, "");
  if (so(o.cnpj).length >= 11) {
    const porCnpj = lista.find((f) => so(f.cnpjCpf) && so(f.cnpjCpf) === so(o.cnpj));
    if (porCnpj) return porCnpj;
  }
  const alvo = cotSemAcento(o.fornecedor || "");
  if (!alvo) return null;
  return lista.find((f) => cotSemAcento(f.nome) === alvo)
    || lista.find((f) => { const n = cotSemAcento(f.nome);
        return n && (n.startsWith(alvo + " ") || alvo.startsWith(n + " ")); })
    || null;
}

// O pedido lido pela IA entra na MESMA lista de conferência do leitor por
// regras: mesma setinha, mesma quantidade, mesma unidade. Muda só quem
// achou o item — e o que a IA aponta pelo código do catálogo entra como
// achado, não como palpite.
function pedidoDaIA(bruto, insumos) {
  const materiais = (insumos || []).filter((i) => i && i.tipo !== "prestador");
  const porCodigo = {};
  for (const i of materiais) {
    if (i.codigo) porCodigo[String(i.codigo)] = i;
    if (i.id) porCodigo[String(i.id)] = i;
  }
  return (((bruto || {}).itens) || []).map((l) => {
    const termo = String((l && l.descricao) || "").trim();
    const ins = l && l.codigoInsumo ? porCodigo[String(l.codigoInsumo)] || null : null;
    const parecidos = candidatosDoPedido(termo, materiais, 6);
    const candidatos = ins
      ? [ins, ...parecidos.filter((c) => (c.codigo || c.id) !== (ins.codigo || ins.id))]
      : parecidos;
    const qtd = Number(l && l.quantidade);
    return {
      id: (typeof uid === "function" ? uid() : String(Math.random())),
      bruto: termo,
      termo,
      quantidade: qtd > 0 ? qtd : "",
      unidade: (ins && ins.unidade) || String((l && l.unidade) || ""),
      insumo: ins,
      confianca: ins ? "ia" : (parecidos.length ? "sugestao" : "nenhum"),
      candidatos,
    };
  }).filter((x) => x.termo);
}

// ── Andamento da leitura ────────────────────────────────────────
// Ninguém sabe de antemão quantos itens o arquivo tem, então a barra não
// mente uma porcentagem exata: ela anda por etapas e, enquanto a IA
// escreve, cresce com os itens que já saíram — rápido no começo, devagar
// perto do fim, sem nunca encostar em 100% antes de terminar. O que ela
// garante é que se mexe: tela parada é o que faz a pessoa desistir.
function andamentoDaLeitura(p) {
  const x = p || {};
  const seg = Math.max(0, Math.round((Number(x.decorridoMs) || 0) / 1000));
  const itens = Number(x.itens) || 0;
  let pct, frase;
  switch (x.etapa) {
    case "fila":
    case "ligando":
      pct = 6; frase = "Preparando a IA…"; break;
    case "conferindo":
      pct = 95; frase = "Conferindo com o catálogo…"; break;
    case "reconectando":
      pct = null; frase = "O servidor não respondeu — tentando de novo…"; break;
    case "sem_sinal":
      pct = null; frase = "Sem sinal agora — a leitura continua no servidor"; break;
    case "lendo":
    default:
      if (itens > 0) {
        pct = 30 + 60 * (1 - Math.exp(-itens / 20));
        frase = `A IA está lendo · ${itens} ${itens === 1 ? "item" : "itens"} até agora`;
      } else {
        pct = 12 + 18 * (1 - Math.exp(-seg / 20));
        frase = "A IA está lendo o arquivo…";
      }
  }
  return { pct: pct == null ? null : Math.round(pct), frase, seg };
}

// ── O que a IA leu ──────────────────────────────────────────────
// A IA devolve o orçamento no mesmo formato do leitor por regras, mais uma
// coisa que o leitor não sabe fazer bem: diz, linha a linha, qual item do
// pedido aquela linha atende. Aqui isso vira o mesmo "casamento" que a
// conferência já mostra — a tela não precisa saber quem leu.
function orcamentoDaIA(bruto) {
  const o = bruto || {};
  const itens = (Array.isArray(o.itens) ? o.itens : []).map((l) => ({
    codigo: String(l.codigo || ""),
    descricao: String(l.descricao || ""),
    unidade: String(l.unidade || ""),
    quantidade: Number(l.quantidade) > 0 ? Number(l.quantidade) : 0,
    unitario: Number(l.unitario) > 0 ? Number(l.unitario) : 0,
    total: Number(l.total) > 0 ? Number(l.total) : 0,
    itemDoPedido: l.itemDoPedido == null ? null : String(l.itemDoPedido),
  })).filter((l) => l.descricao && (l.unitario > 0 || l.total > 0));
  const somaItens = Math.round(itens.reduce((a, l) =>
    a + (l.total > 0 ? l.total : l.unitario * l.quantidade), 0) * 100) / 100;
  return {
    fornecedor: String(o.fornecedor || ""), cnpj: String(o.cnpj || ""), numero: String(o.numero || ""),
    emitido: String(o.emitido || ""), validade: String(o.validade || ""), condicao: String(o.condicao || ""),
    total: Number(o.total) > 0 ? Number(o.total) : 0,
    somaItens, itens,
  };
}

// Casamento a partir do que a IA indicou. Se ela não ligou nenhuma linha a
// nenhum item (pedido sem lista, ou resposta incompleta), vale a associação
// por palavras do leitor — melhor um palpite conferível que a tela vazia.
function casamentoDaIA(cot, orcamento) {
  const itens = itensDaCotacao(cot);
  const ids = {};
  for (const it of itens) ids[String(it.id)] = 1;
  const porItem = {};
  for (const l of (orcamento || {}).itens || []) {
    if (l.itemDoPedido && ids[l.itemDoPedido] && !porItem[l.itemDoPedido]) porItem[l.itemDoPedido] = l;
  }
  if (!Object.keys(porItem).length) return casarOrcamentoComItens(cot, orcamento);
  const usadas = new Set(Object.values(porItem));
  const casados = itens.map((it) => ({ item: it, linha: porItem[String(it.id)] || null, score: porItem[String(it.id)] ? 1 : 0 }));
  return {
    casados,
    sobrando: ((orcamento || {}).itens || []).filter((l) => !usadas.has(l)),
    achados: casados.filter((c) => c.linha).length,
  };
}

// O que mandar para a IA sobre o pedido: o suficiente para ela reconhecer
// cada item, e nada além disso.
function itensParaIA(cot) {
  return itensDaCotacao(cot).map((it) => ({
    id: it.id, descricao: it.descricao || "", quantidade: quantidadeDoItem(it), unidade: it.unidade || "",
  }));
}

// Frase para a tela quando a IA não leu. Token vencido e crédito esgotado
// são coisas que o dono precisa saber; o resto é passageiro.
function avisoDaIA(erro) {
  const m = (erro && erro.motivo) || "";
  if (m === "nao_liberada" || m === "nao_configurada") return "";
  // A mensagem do servidor é mais útil que qualquer frase genérica: ela diz
  // se foi token, crédito, tempo, ou um erro de rota. Só quando não vem
  // mensagem nenhuma é que cabe a frase de sempre.
  const msg = String((erro && erro.message) || "").trim();
  return msg || "A IA não respondeu agora.";
}

// ── As unidades que a empresa já usa ────────────────────────────
// Unidade não é campo livre de verdade: o catálogo já diz quais existem
// ("Unidades", "kg", "m3", "Mts"). Digitar à mão gera "un", "UN", "und" para
// a mesma coisa, e aí o pedido sai com três unidades diferentes para o mesmo
// material. A lista sai do próprio catálogo, na ordem do que mais aparece.
function unidadesDoCatalogo(insumos) {
  const conta = {};
  for (const i of insumos || []) {
    const u = String((i && i.unidade) || "").trim();
    if (u) conta[u] = (conta[u] || 0) + 1;
  }
  return Object.keys(conta).sort((a, b) => conta[b] - conta[a] || a.localeCompare(b, "pt-BR"));
}

// A nota da loja escreve "un", "UN", "und", "pç". É a mesma coisa que o
// catálogo chama de "Unidades" — e se a abreviação entrar como está, o
// pedido nasce com duas unidades para o mesmo material e a lista de escolha
// passa a mostrar "un" e "Unidades" lado a lado, como se fossem diferentes.
// Então a abreviação é traduzida na porta, uma vez, para o nome que a
// empresa usa — e o vocabulário mora em insumos.jsx, junto do catálogo que o define — a
// Entrada e o preço de referência precisam enxergar "un" e "Unidades" como a
// mesma coisa, e duas tabelas acabariam divergindo.
const COT_UNIDADE_SINONIMOS = UNIDADE_SINONIMOS;

// A chave de comparação: a mesma de insumos.jsx.
function cotChaveUnidade(texto) { return chaveUnidade(texto); }

// Devolve a unidade no vocabulário da empresa. A ordem importa: primeiro o
// que o catálogo já tem escrito exatamente assim, depois o mesmo nome com
// outra caixa ("KG" → "Kg"), depois a tradução da abreviação. Só o que
// não é nada disso volta como foi escrito — "vb", "sacos", o que o
// escritório inventar continua valendo.
function unidadeNoPadrao(texto, unidades) {
  const v = String(texto == null ? "" : texto).trim();
  if (!v) return "";
  const lista = unidades || [];
  if (lista.indexOf(v) >= 0) return v;
  const chave = cotChaveUnidade(v);
  if (!chave) return "";
  const igual = lista.find((u) => cotChaveUnidade(u) === chave);
  if (igual) return igual;
  const canonico = COT_UNIDADE_SINONIMOS[chave];
  if (!canonico) return v;
  const noCatalogo = lista.find((u) => cotChaveUnidade(u) === cotChaveUnidade(canonico));
  return noCatalogo || canonico;
}

// O que o pedreiro escreveu ("sacos", "vb") não está no catálogo, mas
// também não se joga fora — entra na lista, em cima, para você trocar ou
// manter com um clique. Abreviação conhecida não entra: ela vira o nome do
// catálogo antes de chegar aqui.
function opcoesDeUnidade(valor, unidades) {
  const lista = unidades || [];
  const v = unidadeNoPadrao(valor, lista);
  return v && lista.indexOf(v) < 0 ? [v, ...lista] : lista;
}

// ── Mandar a lista para as lojas ────────────────────────────────
// O pedido de material vira preço quando chega em três ou quatro lojas. O
// VICKE não manda a mensagem — ele abre a conversa com o vendedor já com a
// lista escrita, e quem aperta enviar é você. Melhor assim: o texto passa
// pelos seus olhos antes de sair, e a conversa fica no seu WhatsApp.
function linkWhatsApp(telefone, msg) {
  const num = String(telefone == null ? "" : telefone).replace(/\D/g, "");
  // 10 dígitos é o mínimo de um fixo com DDD; abaixo disso não é telefone
  if (num.length < 10) return "";
  const completo = num.startsWith("55") ? num : `55${num}`;
  return `https://wa.me/${completo}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
}

// A mensagem da lista rápida. A da cotação (textoDoPedido) parte de uma
// cotação gravada; aqui ainda não há nenhuma — os itens vieram da frase que
// acabou de ser ditada. Mesmo formato, mesma leitura do outro lado.
function textoDaListaRapida(itens, ctx) {
  const x = ctx || {};
  const linhas = [];
  const ondeVai = [x.obra, x.endereco].filter(Boolean).join(" — ");
  if (ondeVai) { linhas.push(`Obra: ${ondeVai}`); linhas.push(""); }
  (itens || []).forEach((it, i) => {
    const q = Number(it && it.quantidade) || 0;
    const qtd = q > 0 ? `${typeof qtdBR === "function" ? qtdBR(q) : q} ${(it.unidade || "")}`.trim() : "";
    linhas.push(`${i + 1}. ${(it && it.descricao) || "Item"}${qtd ? ` — ${qtd}` : ""}`);
  });
  return linhas.join("\n");
}

function enviosDaLista(cot) {
  return ((cot || {}).enviosLista) || [];
}

function envioParaLoja(cot, fornecedorId) {
  return enviosDaLista(cot).find((e) => e && e.fornecedorId === fornecedorId) || null;
}

// Reenviar não duplica: fica o último, que é o que responde "quando foi que
// eu mandei para essa loja?".
function registrarEnvioDaLista(cot, fornecedor, quem, agoraIso) {
  const c = cot || {};
  const f = fornecedor || {};
  if (!f.id) return c;
  const linha = { fornecedorId: f.id, nome: f.nome || "", em: agoraIso || new Date().toISOString(), por: quem || "" };
  return { ...c, enviosLista: [...enviosDaLista(c).filter((e) => e.fornecedorId !== f.id), linha] };
}

// As lojas da vez: as que já receberam vêm primeiro, porque é nelas que se
// volta para cobrar resposta.
function lojasParaPedir(fornecedores, cot, busca) {
  const termo = String(busca || "").trim().toLowerCase();
  const semAcento = (t) => (typeof normalizarTexto === "function"
    ? normalizarTexto(t)
    : String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const alvo = semAcento(termo);
  return (fornecedores || [])
    .filter((f) => f && f.ativo !== false)
    .filter((f) => !alvo || semAcento([f.nome, f.categoria, f.cidade].join(" ")).indexOf(alvo) >= 0)
    .map((f) => {
      const env = envioParaLoja(cot, f.id);
      const jaCotou = propostasDaCotacao(cot).some((p) => p.fornecedorId === f.id);
      return { fornecedor: f, envio: env, jaCotou, link: linkWhatsApp(f.telefone, "") };
    })
    .sort((a, b) => {
      const peso = (x) => (x.jaCotou ? 0 : x.envio ? 1 : 2);
      if (peso(a) !== peso(b)) return peso(a) - peso(b);
      return String(a.fornecedor.nome || "").localeCompare(String(b.fornecedor.nome || ""), "pt-BR");
    });
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

// ── A cotação que é uma conta de loja ─────────────────────
// Compra recorrente não tem proposta para comparar nem escolha para enviar:
// é uma conta aberta numa loja, que recebe pedidos o mês inteiro e um dia é
// encerrada. Vale uma linha por loja na tela, não uma por compra.
function ehContaDeLoja(cot) {
  return !!(cot && cot.contaLoja);
}

// Apagar a conta da loja leva os pedidos e as contas dela junto — só
// enquanto nada foi pago. Depois da primeira baixa a conta fica: o gasto
// já está na obra e no banco, e sumir com ele quebraria os dois.
function podeApagarContaDeLoja(cot, contasPagar) {
  const pagas = (contasPagar || []).filter((x) => x && x.cotacaoId === (cot || {}).id && x.pago).length;
  if (!pagas) return { pode: true, motivo: "" };
  return { pode: false, motivo: pagas === 1
    ? "Um item desta conta já foi pago. Desfaça a baixa em contas a pagar antes de apagar."
    : `${pagas} itens desta conta já foram pagos. Desfaça a baixa em contas a pagar antes de apagar.` };
}

// ── Da cotação para a conta da loja ─────────────────────
// Cotou quatro lojas, escolheu a Ourifer — e a Ourifer é justamente onde você
// tem conta aberta. Lançar em parcelas próprias criaria uma cobrança paralela
// à fatura dela: no dia 28 a loja cobra UM valor, com os pedidos todos dentro.
// Então a escolha vira mais um pedido na conta, e a cotação fecha apontando
// para ele.
// A etapa de um item do pedido, na ordem em que a informação e confiavel:
// quem cotou para uma etapa determinada ja disse para que a compra e, e
// isso vale mais que o palpite do catalogo — concreto cotado para a laje e
// da laje, por mais que o catalogo chame concreto de fundacao. Sem escolha
// na compra, o padrao do insumo preenche; sem nenhum dos dois, fica em
// branco para quem compra dizer. Em qualquer caso a etapa continua
// editavel, item a item, na tela do pedido e na conta a pagar.
function etapaDoItem(insumo, etapaDaCompra) {
  return etapaDaCompra || (insumo && insumo.etapaPadrao) || "";
}
function contaDoItem(insumo, contaDaCompra) {
  return (insumo && insumo.contaPadrao) || contaDaCompra || "";
}

function contaDeLojaAberta(cotacoes, prestadorId) {
  if (!prestadorId) return null;
  return (cotacoes || []).find((c) => c && ehContaDeLoja(c)
    && c.status !== "encerrada" && c.status !== "cancelada"
    && c.lojaId === prestadorId) || null;
}

// A escolha da cotação virando pedido: item a item quando há lista, uma linha
// só quando o que existe é um preço fechado. O desconto negociado vem junto e
// o rateio do pedido se encarrega dele — a mesma conta do desconto de rodapé.
function pedidoDaCotacao(cot, proposta, insumos, prazoDias) {
  const c = cot || {}, p = proposta || {};
  const base = typeof pedidoVazio === "function" ? pedidoVazio("") : { id: "", itens: [] };
  const hoje = typeof dataParaIso === "function" ? dataParaIso(new Date()) : "";
  const prazo = Number(prazoDias) || 0;
  const doCatalogo = (codigo) => (insumos || []).find((x) => x && x.codigo === codigo) || null;
  const novoItem = () => (typeof itemDoPedidoVazio === "function"
    ? itemDoPedidoVazio() : { id: String(Math.random()) });

  const itens = [];
  for (const it of itensDaCotacao(c)) {
    const bruto = totalBrutoItem(c, p, it);
    if (!(bruto > 0)) continue;
    const ins = doCatalogo(it.codigo);
    itens.push({
      ...novoItem(),
      descricao: it.descricao || (ins ? ins.nome : ""),
      insumoCodigo: it.codigo || (ins ? ins.codigo : ""),
      grupoMaterial: ins ? ins.grupo || "" : "",
      quantidade: quantidadeDoItem(it) || "",
      unidade: it.unidade || (ins ? ins.unidade : "") || "",
      unitario: precoUnitario(p, it.id) || "",
      bruto,
      etapa: etapaDoItem(ins, c.etapaId),
      contaId: contaDoItem(ins, c.contaId),
    });
  }
  if (!itens.length) {
    const total = typeof valorProposta === "function" ? valorProposta(p) : 0;
    if (total > 0) {
      itens.push({ ...novoItem(), descricao: c.titulo || "Compra", quantidade: 1,
        unidade: c.unidade || "vb", unitario: total, bruto: total,
        etapa: c.etapaId || "", contaId: c.contaId || "" });
    }
  }
  const d = descontoDaProposta(c, p);
  return {
    ...base,
    data: hoje,
    vencimento: prazo > 0 && typeof somarDias === "function" ? somarDias(hoje, prazo) : "",
    desconto: d && d.desconto ? d.valor : 0,
    itens,
    cotacaoOrigemId: c.id || "",
    observacao: c.titulo || "",
  };
}

// ── Situação, em uma palavra ────────────────────────────────────
// A ordem dos testes é a ordem do fluxo; o primeiro que casar manda.
function situacaoCotacao(cot, aprovacoes, contratos) {
  const c = cot || {};
  const ap = aprovacaoDaEscolha(c, aprovacoes);
  if (c.status === "cancelada")            return { id: "cancelada",  rotulo: "Cancelada",                 cor: "#6b7280" };
  if (ehContaDeLoja(c)) {
    return c.status === "encerrada"
      ? { id: "encerrada", rotulo: "Conta encerrada",      cor: "#6b7280" }
      : { id: "contaLoja", rotulo: "Conta aberta na loja", cor: "#0474f4" };
  }
  // Virou pedido na conta da loja: fechou o ciclo por lá, e é lá que se paga.
  if (c.pedidoNaLoja)                      return { id: "naLoja",    rotulo: "Virou pedido na loja",      cor: "#15803d" };
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
  // A conta de loja lança várias vezes, de propósito: é um pedido por vez, e
  // a trava de "já foi lançada" mataria a segunda compra do dia.
  if (ehContaDeLoja(c)) {
    return c.status === "encerrada"
      ? { pode: false, motivo: "A conta desta loja foi encerrada." }
      : { pode: true, motivo: "" };
  }
  if (contratoDaCotacao(contratos, c.id)) return { pode: false, motivo: "Esta cotação já virou contrato." };
  if (c.pedidoNaLoja)            return { pode: false, motivo: "Já virou pedido na conta da loja." };
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
    // a etapa para a qual se cotou — vai para cada conta que nascer daqui
    etapaId: c.etapaId || "",
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

// ── Medição: o que foi cotado e o que foi consumido ─────────────
// Cotar é estimar. Concreto cotado em 11 m³ pode virar 7 na laje — e é por
// 7 que se paga. A cotação guarda o COTADO, que é o preço que o fornecedor
// deu e o histórico de quanto se pediu; o lançamento guarda o MEDIDO, que é
// o que entra na obra e no contas a pagar.
//
// Sem isto, lançar a cotação criava conta a pagar pelo valor estimado e sem
// item nenhum: o concreto entrava na obra sem m³ e sem etapa, e corrigir a
// quantidade depois não tinha onde.
function medicaoDaCotacao(cot, proposta, insumos) {
  const itens = typeof itensDaCotacao === "function" ? itensDaCotacao(cot) : ((cot || {}).itens || []);
  const lista = (insumos || []);
  return itens.map((it) => {
    const ins = lista.find((x) => x && (x.codigo === it.codigo || x.id === it.insumoId)) || null;
    const cotada = quantidadeDoItem(it);
    return {
      id: it.id,
      insumoCodigo: it.codigo || (ins && ins.codigo) || "",
      descricao: it.descricao || (ins && ins.nome) || "Item",
      unidade: it.unidade || (ins && ins.unidade) || "",
      grupoMaterial: (ins && ins.grupo) || "",
      cotada: cotada,
      // Nasce medido igual ao cotado: o caso comum é consumir o que se pediu,
      // e quem consumiu menos muda um número.
      quantidade: cotada,
      unitario: precoUnitario(proposta, it.id),
      // a cotacao guarda a etapa em `etapaId` — ler `etapa` aqui jogava fora
      // a etapa escolhida na cotacao e deixava em branco todo item cujo
      // insumo nao tem etapa padrao
      etapa: etapaDoItem(ins, (cot || {}).etapaId),
      contaId: (cot || {}).contaId || "",
    };
  }).filter((r) => r.unitario > 0 || r.cotada > 0);
}

// ── O que a conta a pagar nao herdou da cotacao ─────────────────
// Cotacao lancada a vista ou parcelada nasce de `contaDaCompra`, que so
// carrega descricao, valor e vencimento: o concreto chega no contas a pagar
// sem m3, sem etapa e sem insumo. A informacao nao se perdeu — esta na
// cotacao, que guarda o item, a quantidade e a proposta escolhida. Ao abrir
// a conta para editar, buscamos la o que falta.
//
// O que se preenche e so o que e inequivoco. Um item e uma conta: tudo. Um
// item em tres parcelas: nao se preenche quantidade, porque consumo nao se
// divide por mes — se dividisse, 11 m3 virariam 33. Varios itens numa conta
// so: so a etapa, e so quando todos caem na mesma.
//
// O valor da conta e intocavel: e o que o fornecedor cobrou. Por isso o
// unitario sai de valor / quantidade, e nao do preco da proposta — com
// desconto de rodape os dois divergem, e quem confere a conta quer o que
// se paga.
function completarItemDaConta(conta, obra, insumos, contasDaObra) {
  const c = conta || {};
  if (!c.cotacaoId) return c;
  if (String(c.insumoCodigo || "").trim() || numeroDoCampo(c.quantidade) > 0) return c;
  const cot = ((obra || {}).cotacoes || []).find((x) => x && x.id === c.cotacaoId) || null;
  if (!cot) return c;
  const linhas = medicaoDaCotacao(cot, propostaEscolhida(cot), insumos || []);
  if (!linhas.length) return c;

  const irmas = (contasDaObra || []).filter((x) => x && x.cotacaoId === c.cotacaoId);
  const umaContaSo = irmas.length <= 1 && !(Number(c.parcelasTotal) > 1);
  const umaMesma = (campo) => {
    const v = String(linhas[0][campo] || "");
    return linhas.every((l) => String(l[campo] || "") === v) ? v : "";
  };

  if (linhas.length > 1) {
    // varios itens numa conta so: nao da para dizer qual quantidade e qual
    // preco, mas a classificacao ainda vale quando e a mesma em todos
    const etapa = umaMesma("etapa"), grupo = umaMesma("grupoMaterial");
    if (!etapa && !grupo) return c;
    return { ...c, etapa: c.etapa || etapa, grupoMaterial: c.grupoMaterial || grupo };
  }

  const l = linhas[0];
  const base = { ...c,
    insumoCodigo: c.insumoCodigo || l.insumoCodigo || "",
    unidade: String(c.unidade || "").trim() || l.unidade || "",
    etapa: c.etapa || l.etapa || "",
    grupoMaterial: c.grupoMaterial || l.grupoMaterial || "" };
  if (!umaContaSo) return base;

  const q = numeroDoCampo(l.quantidade) || numeroDoCampo(l.cotada);
  const v = numeroDoCampo(c.valor);
  if (!(q > 0) || !(v > 0)) return base;
  return { ...base, quantidade: q, unitario: Math.round((v / q) * 100) / 100 };
}

function totalDaMedicao(medicao) {
  const soma = (medicao || []).reduce((s, r) => s + (numeroDoCampo(r.quantidade) * numeroDoCampo(r.unitario)), 0);
  return Math.round(soma * 100) / 100;
}

// O que falta para a medição poder virar conta. Etapa é erro e não aviso,
// pela mesma razão do pedido da loja: é o que impede a linha "Sem etapa".
function validarMedicao(medicao) {
  const erros = [];
  const comValor = (medicao || []).filter((r) => r && numeroDoCampo(r.quantidade) * numeroDoCampo(r.unitario) > 0);
  if (!comValor.length) erros.push("Nenhum item com quantidade e preço.");
  const semEtapa = comValor.filter((r) => !String(r.etapa || "").trim()).length;
  if (semEtapa) erros.push(semEtapa === 1 ? "1 item está sem etapa." : semEtapa + " itens estão sem etapa.");
  return { ok: !erros.length, erros: erros };
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

// ── Aberta ou fechada ─────────────────────────────────
// Cotação fechada é a que não espera mais nada de ninguém: virou
// compromisso — contrato gerado, para quem assina contrato, ou conta a
// pagar, para o fornecedor de material que entrega e fatura — ou foi
// cancelada. Tudo o mais tem um próximo passo e continua na tela.
// Recusada pelo cliente fica em aberto de propósito: falta reescolher.
const SITUACOES_FECHADAS = ["contratada", "lancada", "cancelada", "encerrada", "naLoja"];

function cotacaoEstaFechada(cot, aprovacoes, contratos) {
  return SITUACOES_FECHADAS.indexOf(situacaoCotacao(cot, aprovacoes, contratos).id) >= 0;
}

function cotacoesPorSituacao(cotacoes, aprovacoes, contratos) {
  const abertas = [], fechadas = [];
  for (const c of (cotacoes || []).filter((x) => x && x.id)) {
    (cotacaoEstaFechada(c, aprovacoes, contratos) ? fechadas : abertas).push(c);
  }
  return { abertas, fechadas };
}

// Contadores do cartão da obra e do topo da tela.
function resumoCotacoes(cotacoes, aprovacoes, contratos) {
  const lista = (cotacoes || []).filter(c => c && c.id);
  const r = { total: lista.length, abertas: 0, aEnviar: 0, aguardandoCliente: 0, aprovadas: 0, recusadas: 0, lancadas: 0, fechadas: 0, contasLoja: 0, economia: 0 };
  for (const c of lista) {
    const s = situacaoCotacao(c, aprovacoes, contratos);
    if (SITUACOES_FECHADAS.indexOf(s.id) >= 0) r.fechadas++;
    if (s.id === "coletando" || s.id === "comparando") r.abertas++;
    if (s.id === "aEnviar")     r.aEnviar++;
    if (s.id === "aguardando")  r.aguardandoCliente++;
    if (s.id === "aprovada")    r.aprovadas++;
    if (s.id === "recusada")    r.recusadas++;
    if (s.id === "contaLoja")   r.contasLoja++;
    // Material não assina contrato: vira conta a pagar. Contava só o
    // contrato, e o cartão "Aprovadas" ficava em zero com a compra já feita.
    if (s.id === "contratada" || s.id === "lancada") r.lancadas++;
    if (s.id === "aprovada" || s.id === "contratada" || s.id === "lancada") {
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

// ── Painel sobre a tela ─────────────────────────────────────────
// No celular o painel ocupa a tela inteira e se mede pelo fundo fixo, que
// acompanha a área VISÍVEL — "88vh" no Safari conta a faixa que fica atrás
// da barra de baixo, e era lá que o botão "Pôr na lista" ia parar: tocar
// nele fazia a barra subir em vez de apertar o botão. A lista rola por
// dentro (minHeight 0 é o que deixa um filho flex encolher) e os botões
// ficam fora da rolagem, sempre à vista, acima da faixa do home do iPhone.
function cotPainel(isMobile, maxWidth) {
  return {
    fundo: { position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", display: "flex",
      alignItems: isMobile ? "stretch" : "center", justifyContent: "center",
      // acima da bolha do chat (800), que no celular caía em cima do botão
      // principal; abaixo do visor de PDF (9000), que abre por cima
      padding: isMobile ? 0 : 16, zIndex: 1000 },
    cartao: isMobile
      // border-box: sem ele o "100%" soma o padding e o cartão passa 28px da
      // tela — exatamente a faixa onde ficavam os botões de baixo
      ? { background: "#fff", borderRadius: 0, padding: "14px 14px calc(14px + env(safe-area-inset-bottom))",
          width: "100%", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", overflow: "hidden" }
      : { background: "#fff", borderRadius: 16, padding: 18, width: "100%", maxWidth: maxWidth || 760,
          maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px -20px rgba(17,24,39,0.45)" },
    // A folga de baixo não é estética: sem ela o corte da rolagem cai em cima
    // da borda do último bloco, e o cartão do fim aparece sempre sem a linha
    // de baixo — como se estivesse cortado no meio.
    rolagem: { overflowY: "auto", flex: "1 1 auto", minHeight: 0, overscrollBehavior: "contain",
      paddingBottom: 6, WebkitOverflowScrolling: "touch" },
  };
}

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

function CotacoesObraView({ obra, obras, data, save, onObraAtualizada, isMobile, onVoltar, usuario, onGerarContrato, onLancarContas, onLancarDespesa, onLancarEntrada, onDesfazerLancamento, onRecalibrarPedido, onExcluirPedido, abrirEntrada, entradaInicial }) {
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
  const [formPedido, setFormPedido] = useState(null);           // { cotacao, pedido }
  const [novoPrestador, setNovoPrestador] = useState(null); // objeto quando o cadastro está aberto
  const [visor, setVisor] = useState(null);                 // anexo aberto na janela
  const [detalhePag, setDetalhePag] = useState(null);       // cotação com os pagamentos abertos
  // datas em edição na janelinha: null = só leitura
  const [datasPag, setDatasPag] = useState(null);
  const [folhaPedido, setFolhaPedido] = useState(null);     // { cot, proposta }
  const [copiado, setCopiado] = useState("");
  const [pedirLojas, setPedirLojas] = useState(null);   // cotação com o painel aberto
  const [buscaLoja, setBuscaLoja] = useState("");
  const [lojasMarcadas, setLojasMarcadas] = useState({});
  // Fila de envio: o WhatsApp não manda para várias de uma vez, e o
  // navegador só deixa abrir UMA janela por clique — a primeira consome o
  // gesto do usuário e as outras seriam bloqueadas em silêncio. Então a
  // seleção é múltipla e o envio é guiado: um toque por loja, sem procurar
  // a próxima na lista.
  const [filaEnvio, setFilaEnvio] = useState(null);   // { lojas: [...], i }
  const [colando, setColando] = useState(null);       // { texto, lidos } ao ler o recado
  const [lendoPdf, setLendoPdf] = useState(false);
  const [progressoPdf, setProgressoPdf] = useState(null);
  // null = ainda não perguntou. Pergunta uma vez por tela: sem a IA, anexar
  // não pode virar dois envios do mesmo arquivo.
  const iaDisponivel = useIaDisponivel();
  const [sobreOPedido, setSobreOPedido] = useState(false);   // arquivo sendo arrastado sobre o campo
  const refArquivoPedido = useRef(null);
  const [orcamentoLido, setOrcamentoLido] = useState(null);  // { orcamento, casamento }
  const [entradaAberta, setEntradaAberta] = useState(false);
  // A Entrada pode ter começado fora daqui. Vinda da lista de Obras ela chega
  // com a lista já lida e a obra já escolhida (`entradaInicial`) e cai direto
  // na porta de saída; vinda do card do painel da obra, só pede para abrir a
  // caixa (`abrirEntrada`). O ref garante que isso aconteça uma vez — um
  // segundo disparo montaria o mesmo pedido duas vezes.
  const entradaJaveio = useRef(false);
  useEffect(() => {
    if (entradaJaveio.current) return;
    if (entradaInicial) { entradaJaveio.current = true; seguirDaEntrada(entradaInicial); return; }
    if (abrirEntrada) { entradaJaveio.current = true; setEntradaAberta(true); }
  }, [entradaInicial, abrirEntrada]);
  const insumos = insumosDoCatalogo(data);
  const cadastrarInsumoDoPedido = (campos) => cadastrarInsumoNoCatalogo(data, save, campos);
  const aprenderApelidos = (pares) => aprenderApelidosNoCatalogo(data, save, pares);
  const unidadesCatalogo = unidadesDoCatalogo(insumos);
  // O que o pedido precisa dizer além da lista: de quem parte e para onde vai.
  const ctxPedido = {
    escritorio: ((data.escritorio || {}).nome) || "",
    obra: obra.nome || "",
    endereco: [obra.endereco, obra.cidade, obra.estado].filter(Boolean).join(", "),
    contato: ((data.escritorio || {}).telefone) || "",
  };
  // Abre a conversa da loja com a lista escrita e marca que foi mandado.
  // Quem aperta enviar é o usuário, dentro do WhatsApp dele.
  function abrirWhatsAppDaLoja(cot, fornecedor) {
    const link = linkWhatsApp(fornecedor.telefone, textoDoPedido(cot, null, ctxPedido));
    if (!link) { setErro(`${fornecedor.nome || "Esta loja"} não tem telefone no cadastro.`); return; }
    setErro("");
    if (typeof window !== "undefined") window.open(link, "_blank", "noopener");
    const atualizada = registrarEnvioDaLista(cot, fornecedor, nomeDeQuem(usuario));
    trocarCotacao(cot.id, () => atualizada);
    setPedirLojas(atualizada);
  }

  function iniciarFila(cot, lista) {
    if (!lista.length) return;
    abrirWhatsAppDaLoja(cot, lista[0].fornecedor);
    setFilaEnvio({ lojas: lista, i: 1 });
  }

  function proximaDaFila() {
    const f = filaEnvio;
    if (!f || !pedirLojas) return;
    const alvo = f.lojas[f.i];
    if (!alvo) { setFilaEnvio(null); return; }
    abrirWhatsAppDaLoja(pedirLojas, alvo.fornecedor);
    setFilaEnvio({ ...f, i: f.i + 1 });
  }

  function fecharPainelLojas() {
    setPedirLojas(null);
    setFilaEnvio(null);
    setLojasMarcadas({});
    setBuscaLoja("");
  }

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

  const resumo = resumoCotacoes(cotacoes, aprovacoes, contratos);
  // Cotação fechada não pede nada — só ocupa a tela. Fica na outra aba,
  // à mão para consulta, fora do caminho de quem veio decidir.
  const [filtroLista, setFiltroLista] = useState("abertas");
  const grupos = cotacoesPorSituacao(cotacoes, aprovacoes, contratos);
  const visiveis = filtroLista === "fechadas" ? grupos.fechadas : grupos.abertas;

  // ── Formulário da cotação ─────────────────────────────────────
  function salvarCotacao() {
    const f = formCotacao;
    if (!String(f.titulo || "").trim()) { setErro("Dê um nome à cotação (ex.: Esquadrias de alumínio)."); return; }
    if (f.contaLoja && !f.lojaId) { setErro("Escolha a loja desta conta."); return; }
    setErro("");
    const existe = cotacoes.some(c => c.id === f.id);
    const marcada = carimbar(f, usuario, !existe);
    gravarCotacoes(existe ? cotacoes.map(c => (c.id === f.id ? marcada : c)) : cotacoes.concat([marcada]));
    setFormCotacao(null);
  }

  if (formCotacao) {
    const todasAsContas = typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : [];
    const contas = formCotacao.contaLoja
      ? todasAsContas.filter(c => c.grupo !== "receitas" && c.grupo !== "terreno")
      : todasAsContas;
    const etapas = typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : [];
    const set = (k, v) => setFormCotacao(f => ({ ...f, [k]: v }));
    // Marcar "conta na loja" com uma conta de entrada selecionada trocaria o
    // sinal da compra: aí o padrão passa a ser Material.
    const marcarContaLoja = (v) => setFormCotacao(f => {
      const conta = todasAsContas.find(x => x.id === f.contaId);
      const ruim = !conta || conta.grupo === "receitas" || conta.grupo === "terreno";
      return { ...f, contaLoja: v, contaId: v && ruim ? "material" : f.contaId };
    });
    return (
      <div style={isMobile ? { ...E.wrap, padding: 12 } : E.wrap}>
        <button onClick={() => { setFormCotacao(null); setErro(""); }} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontFamily: "inherit", fontSize: 12, marginBottom: 16 }}>← Voltar</button>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{cotacoes.some(c => c.id === formCotacao.id) ? "Editar cotação" : "Nova cotação"}</div>
        <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 14 }}>
          {formCotacao.contaLoja
            ? "Compra recorrente numa loja: a conta fica aberta e vai recebendo pedidos."
            : "O que você vai pedir preço para os fornecedores."}
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: "#374151", marginBottom: 16, cursor: "pointer" }}>
          <input type="checkbox" checked={!!formCotacao.contaLoja} onChange={e => marcarContaLoja(e.target.checked)} />
          Conta na loja — compra do dia a dia, sem comparar proposta
        </label>
        {formCotacao.contaLoja && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={E.label}>Loja</label>
              <SelectBusca style={E.input} value={formCotacao.lojaId || ""}
                onChange={v => set("lojaId", v)} placeholder="Procurar loja…"
                opcoes={[{ valor: "", rotulo: "— escolha a loja —" }].concat(
                  prestadores.map(function (f) {
                    return { valor: f.id, rotulo: f.nome, extra: f.categoria || "" };
                  }))} />
            </div>
            <div>
              <label style={E.label}>Prazo de pagamento (dias)</label>
              <CampoNumeroBR estilo={E.input} valor={formCotacao.prazoLoja} casas={0} placeholder="30"
                aoMudar={(v) => set("prazoLoja", v)} />
            </div>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={E.label}>O que está sendo cotado</label>
            <input style={E.input} value={formCotacao.titulo} onChange={e => set("titulo", e.target.value)} placeholder="Esquadrias de alumínio" />
          </div>
          <div>
            <label style={E.label}>Conta do P&amp;L</label>
            <SelectBusca style={E.input} value={formCotacao.contaId} onChange={v => set("contaId", v)}
              placeholder="Procurar conta…"
              opcoes={contas.map(function (c) { return { valor: c.id, rotulo: c.nome }; })} />
          </div>
        </div>
        <div style={{ marginBottom: 14, display: formCotacao.contaLoja ? "none" : "block" }}>
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
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <button type="button" style={{ ...E.btnSec, fontSize: 11.5, padding: "5px 11px" }}
                  onClick={() => setColando({ texto: "", lidos: null, arquivo: null })}>
                  {iaDisponivel ? "Colar ou anexar o pedido" : "Colar o pedido do pedreiro"}
                </button>
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
                      <CampoUnidade valor={it.unidade} unidades={unidadesCatalogo}
                        aoMudar={(v) => setItens(itens.map((x, j) => j === i ? { ...x, unidade: v } : x))} />
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
              <input style={E.input} value={formCotacao.unidade} onChange={e => set("unidade", e.target.value)} placeholder="Unidades / m² / vb" />
            </div>
          )}
          <div>
            <label style={E.label}>Etapa da obra</label>
            <SelectBusca style={E.input} value={formCotacao.etapaId} onChange={v => set("etapaId", v)}
              placeholder="Procurar etapa…"
              opcoes={[{ valor: "", rotulo: "—" }].concat(
                etapas.map(function (et) { return { valor: et.id, rotulo: et.nome, grupo: et.macro || "" }; }))} />
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

        {colando && (() => {
          const lidos = colando.lidos;
          const res = colando.resumo || null;
          const trocar = (id, muda) => setColando(c => ({ ...c, lidos: c.lidos.map(x => x.id === id ? { ...x, ...muda } : x) }));
          const aceitos = (lidos || []).filter(x => !x.fora);
          // Clique fora NÃO fecha nenhum destes painéis: aqui se está no meio
          // de um trabalho — leitura, conferência, envio, datas — e perder a
          // tela por um clique torto é perder o que já foi feito. Sai pelo
          // botão, que é uma decisão.
          const PN = cotPainel(isMobile, 760);
          return (
            <div style={PN.fundo}>
              <div onClick={(e) => e.stopPropagation()} style={PN.cartao}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Pedido do pedreiro</div>
                <div style={{ fontSize: 12.5, color: "#4b5563", marginTop: 4, marginBottom: 12 }}>
                  {!lidos
                    ? (iaDisponivel
                      ? "Cole a mensagem como ela veio, ou jogue o print, a foto do papel ou o PDF da lista dentro do campo. A IA separa os itens, tira a quantidade e procura cada material no catálogo. O arquivo é só para a leitura, não fica guardado."
                      : "Cole a mensagem como ela veio, do jeito que ele escreveu. O VICKE separa as linhas, tira a quantidade e procura cada material no catálogo.")
                    : "Confira antes de entrar na lista. O que foi achado no catálogo vem marcado; o parecido fica como escolha sua; o que não existe entra com o texto dele."}
                  {lidos && colando.leitor ? (
                    <span style={{ color: "#0474f4", fontWeight: 600 }}>
                      {" "}{colando.leitor === "ia" ? "Lido pela IA." : "Lido pelo leitor do VICKE."}
                    </span>
                  ) : null}
                  {colando.aviso ? (
                    <div style={{ marginTop: 6, fontSize: 11.5, color: "#dc2626" }}>{colando.aviso}</div>
                  ) : null}
                </div>

                {!lidos ? (
                  <>
                    {/* Um campo só. O mesmo retângulo recebe o texto colado,
                        o arquivo arrastado e o print colado com Ctrl+V —
                        dois campos faziam parecer que era preciso preencher
                        os dois. O exemplo de mensagem que ficava no
                        placeholder saiu: parecia texto já colado. */}
                    {(() => {
                      const porArquivo = (f) => { if (f) setColando(c => c && ({ ...c, arquivo: f })); };
                      return (
                        <div
                          onDragOver={iaDisponivel ? ((e) => { e.preventDefault(); setSobreOPedido(true); }) : undefined}
                          onDragLeave={iaDisponivel ? (() => setSobreOPedido(false)) : undefined}
                          onDrop={iaDisponivel ? ((e) => { e.preventDefault(); setSobreOPedido(false); porArquivo((e.dataTransfer.files || [])[0]); }) : undefined}
                          onPaste={iaDisponivel ? ((e) => { const f = arquivoColado(e.clipboardData); if (f) { e.preventDefault(); porArquivo(f); } }) : undefined}
                          style={{ border: `1.5px solid ${sobreOPedido ? "#0474f4" : "transparent"}`,
                            borderRadius: 14, padding: 2, background: sobreOPedido ? "#f0f7ff" : "transparent" }}>
                          <textarea style={{ ...E.input, minHeight: 200, resize: "vertical", fontFamily: "inherit" }}
                            value={colando.texto} autoFocus
                            onChange={(e) => setColando(c => ({ ...c, texto: e.target.value }))}
                            placeholder={iaDisponivel
                              ? "Cole aqui a mensagem do pedreiro — ou arraste o print, a foto ou o PDF para dentro deste campo"
                              : "Cole aqui a mensagem do pedreiro"} />
                          {iaDisponivel && (
                            <>
                              <input ref={refArquivoPedido} type="file" accept="application/pdf,image/*"
                                style={{ display: "none" }}
                                onChange={(e) => { porArquivo((e.target.files || [])[0]); e.target.value = ""; }} />
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 11.5, flexWrap: "wrap" }}>
                                {colando.arquivo ? (
                                  <>
                                    <span style={{ color: "#111827", fontWeight: 600, wordBreak: "break-all" }}>
                                      {colando.arquivo.name}
                                    </span>
                                    <button type="button" onClick={() => setColando(c => c && ({ ...c, arquivo: null }))}
                                      style={{ background: "none", border: "none", padding: 0, fontSize: 11.5, color: "#dc2626",
                                        cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                                      tirar
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <span style={{ color: "#6b7280" }}>Arraste o arquivo aqui, cole com Ctrl+V, ou</span>
                                    <button type="button" onClick={() => refArquivoPedido.current && refArquivoPedido.current.click()}
                                      style={{ background: "none", border: "none", padding: 0, fontSize: 11.5, color: "#0474f4",
                                        cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                                      escolha um arquivo
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                    {colando.lendo && colando.progresso && (
                      <div style={{ marginTop: 12 }}><BarraLeituraIA progresso={colando.progresso} /></div>
                    )}
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
                      <button style={E.btnSec} onClick={() => setColando(null)}>Cancelar</button>
                      {(() => {
                        const temAlgo = !!colando.texto.trim() || !!colando.arquivo;
                        const podeLer = temAlgo && !colando.lendo;
                        return (
                          <button style={{ ...E.btn, opacity: podeLer ? 1 : 0.45, cursor: podeLer ? "pointer" : "not-allowed" }}
                            disabled={!podeLer} onClick={lerOPedido}>
                            {colando.lendo ? "Lendo…" : "Ler o pedido"}
                          </button>
                        );
                      })()}
                    </div>
                  </>
                ) : !lidos.length ? (
                  <>
                    <div style={{ fontSize: 12.5, color: "#4b5563" }}>
                      Não deu para achar item nenhum nesse texto. Volte e confira se veio a lista mesmo.
                    </div>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
                      <button style={E.btnSec} onClick={() => setColando({ texto: colando.texto, arquivo: colando.arquivo || null, lidos: null })}>Voltar ao texto</button>
                      <button style={E.btnSec} onClick={() => setColando(null)}>Fechar</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 11.5, color: "#4b5563", marginBottom: 8 }}>
                      {res.total} {res.total === 1 ? "linha" : "linhas"} ·{" "}
                      <span style={{ color: "#15803d", fontWeight: 600 }}>{res.achados} no catálogo</span>
                      {res.sugeridos ? ` · ${res.sugeridos} para você confirmar` : ""}
                      {res.soltos ? ` · ${res.soltos} fora do catálogo` : ""}
                      {res.semQuantidade ? ` · ${res.semQuantidade} sem quantidade` : ""}
                    </div>
                    <div style={{ ...PN.rolagem, border: "1px solid rgba(38,36,33,0.12)", borderRadius: 10 }}>
                      {lidos.map((x) => {
                        const parecidos = [
                          ...(x.insumo ? [x.insumo] : []),
                          ...x.candidatos.filter(c => !x.insumo || (c.codigo || c.id) !== (x.insumo.codigo || x.insumo.id)),
                        ];
                        const cols = isMobile ? "1fr 1fr 44px" : "1fr 90px 96px 30px";
                        return (
                          <div key={x.id} style={{ padding: "9px 12px", borderTop: "1px solid rgba(38,36,33,0.06)",
                            background: x.fora ? "#fafafa" : "#fff", opacity: x.fora ? 0.55 : 1 }}>
                            <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>“{x.bruto}”</div>
                            <div style={{ display: "grid", gridTemplateColumns: cols, gap: 8, alignItems: "start" }}>
                              {/* A setinha existe SEMPRE: mesmo quando nada
                                  se parece, o catálogo inteiro está a um
                                  clique. E quando fica fora do catálogo, o
                                  texto dele continua editável logo abaixo. */}
                              <div style={{ display: "grid", gap: 6, minWidth: 0, gridColumn: isMobile ? "1 / -1" : undefined }}>
                                <EscolhaInsumoPedido x={x} parecidos={parecidos} insumos={insumos}
                                  unidades={unidadesCatalogo}
                                  aoEscolher={(ins) => trocar(x.id, { insumo: ins, escolhaCodigo: ins.codigo || ins.id,
                                    unidade: ins.unidade || x.unidade, confirmar: false })}
                                  aoDeixarFora={() => trocar(x.id, { insumo: null, escolhaCodigo: "", confirmar: false })}
                                  aoCadastrar={(campos) => {
                                    const novo = cadastrarInsumoDoPedido(campos);
                                    if (novo) trocar(x.id, { insumo: novo, escolhaCodigo: novo.codigo || novo.id,
                                      unidade: novo.unidade || x.unidade, confirmar: false });
                                    return novo;
                                  }} />
                                {!x.insumo && (
                                  <input style={{ ...E.input, fontSize: 12 }} value={x.termo}
                                    placeholder="como vai aparecer no pedido"
                                    onChange={(e) => trocar(x.id, { termo: e.target.value })} />
                                )}
                              </div>
                              <CampoNumeroBR estilo={E.input} valor={x.quantidade} casas={2} placeholder="qtd"
                                aoMudar={(v) => trocar(x.id, { quantidade: v })} />
                              <CampoUnidade valor={(x.insumo && x.insumo.unidade) || x.unidade || ""}
                                unidades={unidadesCatalogo} aoMudar={(v) => trocar(x.id, { unidade: v })} />
                              <button type="button" title={x.fora ? "Voltar para a lista" : "Não incluir"}
                                style={{ ...E.btnSec, padding: "6px 9px", color: x.fora ? "#111827" : "#dc2626" }}
                                onClick={() => trocar(x.id, { fora: !x.fora })}>{x.fora ? "+" : "×"}</button>
                            </div>
                            {x.confirmar && x.insumo && !x.fora && (
                              <div style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>
                                Ele escreveu “{x.termo}” — confirme se é este mesmo, ou toque no nome para trocar.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {(() => {
                      const voltar = () => setColando({ texto: colando.texto, arquivo: colando.arquivo || null, lidos: null });
                      const por = () => {
                        set("itens", [...(formCotacao.itens || []), ...aceitos.map(itemDoPedidoLido)]);
                        setColando(null);
                      };
                      const botaoPor = (extra) => (
                        <button style={{ ...E.btn, opacity: aceitos.length ? 1 : 0.45, cursor: aceitos.length ? "pointer" : "not-allowed", ...extra }}
                          disabled={!aceitos.length} onClick={por}>
                          Pôr {aceitos.length} na lista
                        </button>
                      );
                      return isMobile ? (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12, flexShrink: 0 }}>
                          {botaoPor({ gridColumn: "1 / -1", padding: "12px 14px", fontSize: 14 })}
                          <button style={E.btnSec} onClick={voltar}>Voltar ao texto</button>
                          <button style={E.btnSec} onClick={() => setColando(null)}>Cancelar</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 14, flexWrap: "wrap", flexShrink: 0 }}>
                          <button style={E.btnSec} onClick={voltar}>Voltar ao texto</button>
                          <span style={{ display: "flex", gap: 8 }}>
                            <button style={E.btnSec} onClick={() => setColando(null)}>Cancelar</button>
                            {botaoPor()}
                          </span>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>
          );
        })()}
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
  // Arrastar o PDF que a loja mandou: lê no próprio navegador (o arquivo não
  // sai daqui) e mostra o que entendeu antes de preencher qualquer campo.
  async function lerOrcamentoDaLoja(arquivo, cotacao) {
    if (!arquivo) return;
    const ehPdf = /pdf$/i.test(arquivo.type || "") || /\.pdf$/i.test(arquivo.name || "");
    const ehFoto = /^image\//i.test(arquivo.type || "");
    // Foto só a IA lê; sem ela, a foto fica anexada e os preços vão a mão.
    if (!ehPdf && !(ehFoto && iaDisponivel)) return;
    setErro("");
    setLendoPdf(true);
    setProgressoPdf(iaDisponivel ? { etapa: "fila", itens: 0, decorridoMs: 0 } : null);

    let aviso = "";
    if (iaDisponivel) {
      try {
        const r = await api.ia.lerOrcamento(arquivo, itensParaIA(cotacao), (p) => setProgressoPdf(p));
        const orcamento = orcamentoDaIA(r && r.orcamento);
        const casamento = casamentoDaIA(cotacao, orcamento);
        const escolhas = escolhasDoCasamento(casamento, orcamento);
        setOrcamentoLido({ orcamento, casamento, escolhas, nome: arquivo.name || "", leitor: "ia" });
        setLendoPdf(false);
        return;
      } catch (e) {
        aviso = avisoDaIA(e);
        // Crédito ou token acabaram: não adianta insistir nas próximas
        // leituras desta tela. O leitor por regras segue sozinho.
        if (e && (e.motivo === "token" || e.motivo === "limite" || e.motivo === "conta" || e.motivo === "nao_liberada" || e.motivo === "nao_configurada")) {
          setIaDisponivel(false);
        }
      }
    }
    if (!ehPdf) {
      setErro((aviso ? aviso + " " : "") + "A foto não foi lida — só a IA lê foto. Ela fica anexada, e os preços vão a mão.");
      setLendoPdf(false);
      return;
    }

    try {
      const linhas = await linhasDoPdf(arquivo);
      // Sem texto nenhum é PDF digitalizado (foto do papel) — não há o que
      // ler, e insistir só faria perder tempo.
      if (!linhas.length) {
        setErro((aviso ? aviso + " " : "") + "Esse PDF é digitalizado (foto do papel), não tem texto para o leitor do VICKE. Ele fica anexado, mas os preços vão a mão.");
        setLendoPdf(false);
        return;
      }
      const orcamento = interpretarOrcamento(linhas);
      const casamento = casarOrcamentoComItens(cotacao, orcamento);
      // Mesmo sem reconhecer a tabela a conferência abre: cada loja escreve
      // o orçamento de um jeito, e é lá que você aponta a linha certa ou
      // digita o preço — melhor que devolver um erro e nada mais.
      const escolhas = escolhasDoCasamento(casamento, orcamento);
      setOrcamentoLido({ orcamento, casamento, escolhas, nome: arquivo.name || "", leitor: "regras",
        aviso: aviso ? aviso + " Li o PDF com o leitor do VICKE." : "" });
    } catch (e) {
      setErro(e && e.message ? e.message : "Não consegui ler esse PDF.");
    }
    setLendoPdf(false);
  }

  // Passa o que foi lido para os campos da proposta. Só mexe no que o PDF
  // respondeu: o que ele não traz fica como estava.
  function aplicarOrcamentoLido() {
    if (!orcamentoLido || !formProposta) return;
    const { orcamento, casamento } = orcamentoLido;
    setFormProposta((f) => {
      if (!f) return f;
      const p = { ...f.proposta };
      const precos = { ...(p.precos || {}) };
      // Vale o que está na tela da conferência, não o que o leitor achou:
      // se ele trocou a linha ou digitou o preço, é esse que entra.
      for (const c of casamento.casados) {
        const esc = (orcamentoLido.escolhas || {})[c.item.id] || {};
        if (esc.preco > 0) precos[c.item.id] = esc.preco;
      }
      p.precos = precos;
      // Loja já cadastrada entra pelo cadastro; senão fica só o nome do papel.
      const cadastrada = p.fornecedorId ? null : lojaCadastrada(prestadores, orcamento);
      if (cadastrada) {
        p.fornecedorId = cadastrada.id;
        if (!String(p.favorecido || "").trim()) p.favorecido = cadastrada.nome;
      } else if (!String(p.favorecido || "").trim() && orcamento.fornecedor) {
        p.favorecido = orcamento.fornecedor;
      }
      if (orcamento.condicao) p.condicaoPagamento = orcamento.condicao;
      if (orcamento.validade) p.validade = orcamento.validade;
      // Total do papel diferente da soma do que foi confirmado é desconto de
      // fechamento — é para isso que serve o campo "Total fechado com a loja".
      // Só vale quando a lista inteira veio DO PAPEL. Item que ficou sem
      // preço, ou preço que você digitou porque a loja não cotou, deixam a
      // soma maior que o papel — e aí a diferença não é desconto, é buraco:
      // fechar por 573 abateria justamente o que não estava no orçamento.
      const itensDoPedido = itensDaCotacao(cotacoes.find((c) => c.id === f.cotacaoId));
      const todosDoPapel = itensDoPedido.length > 0 && itensDoPedido.every((it) =>
        precos[it.id] > 0 && ((orcamentoLido.escolhas || {})[it.id] || {}).i >= 0);
      const somaConfirmada = Math.round(itensDoPedido.reduce((a, it) =>
        a + (precos[it.id] || 0) * quantidadeDoItem(it), 0) * 100) / 100;
      if (todosDoPapel && orcamento.total > 0 && Math.abs(orcamento.total - somaConfirmada) > 0.01) {
        p.totalFechado = orcamento.total;
      }
      return { ...f, proposta: p };
    });
    setOrcamentoLido(null);
  }

  // O pedido chega como recado colado, print da conversa, foto do papel ou
  // PDF de lista. A IA lê qualquer um; sem ela, o leitor por regras lê o
  // texto colado, que é o que ele sabe fazer.
  async function lerOPedido() {
    const atual = colando;
    if (!atual) return;
    setColando((c) => c && ({ ...c, lendo: true, aviso: "", progresso: iaDisponivel ? { etapa: "fila", itens: 0, decorridoMs: 0 } : null }));
    const fechar = (extra) => setColando((c) => c && ({ ...c, lendo: false, progresso: null, ...extra }));

    let aviso = "";
    if (iaDisponivel) {
      try {
        const r = await api.ia.lerPedido({ arquivo: atual.arquivo || null, texto: atual.texto },
          (p) => setColando((c) => c && c.lendo ? ({ ...c, progresso: p }) : c));
        const cru = pedidoDaIA(r, insumos);
        fechar({ leitor: "ia", resumo: resumoDaLeitura(cru), lidos: promoverCandidatos(cru) });
        return;
      } catch (e) {
        aviso = avisoDaIA(e);
        if (e && (e.motivo === "token" || e.motivo === "limite" || e.motivo === "conta" || e.motivo === "nao_liberada" || e.motivo === "nao_configurada")) {
          setIaDisponivel(false);
        }
      }
    }
    // Sem texto não há para onde cair: o leitor por regras lê texto, não
    // arquivo. Dizer "usei o leitor do VICKE" aqui seria mentira.
    if (!String(atual.texto || "").trim()) {
      fechar({ aviso: (aviso ? aviso + " " : "") + "O arquivo não foi lido — só a IA lê arquivo. Cole o texto do pedido, ou tente de novo em instantes." });
      return;
    }
    const cru = interpretarPedido(atual.texto, insumos);
    fechar({ leitor: "regras", aviso: aviso ? aviso + " Li o texto colado com o leitor do VICKE." : "",
      resumo: resumoDaLeitura(cru), lidos: promoverCandidatos(cru) });
  }

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
        ? { ...proposta, valor: totalNegociado(c, proposta) }
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
      <div style={isMobile ? { ...E.wrap, padding: 12 } : E.wrap}>
        <button onClick={() => { setFormProposta(null); setNovoPrestador(null); setErro(""); }} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontFamily: "inherit", fontSize: 12, marginBottom: 16 }}>← Voltar</button>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Proposta recebida</div>
        <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 18 }}>Registre o que o fornecedor respondeu.</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={E.label}>Fornecedor cadastrado</label>
            <Selecao style={E.input} value={p.fornecedorId} disabled={!!novoPrestador}
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
            </Selecao>
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
                <Selecao style={E.input} value={novoPrestador.tipo} onChange={e => setNovoPrestador({ ...novoPrestador, tipo: e.target.value })}>
                  <option value="PJ">Jurídica</option><option value="PF">Física</option>
                </Selecao></div>
              <div><label style={E.label}>{novoPrestador.tipo === "PF" ? "CPF" : "CNPJ"}</label>
                <input style={E.input} value={novoPrestador.cnpjCpf} onChange={e => setNovoPrestador({ ...novoPrestador, cnpjCpf: e.target.value })} /></div>
              <div><label style={E.label}>Categoria</label>
                <Selecao style={E.input} value={novoPrestador.categoria} onChange={e => setNovoPrestador({ ...novoPrestador, categoria: e.target.value })}>
                  {(typeof CATEGORIAS_PRESTADOR !== "undefined" ? CATEGORIAS_PRESTADOR : ["Outro"]).map(c => <option key={c} value={c}>{c}</option>)}
                </Selecao></div>
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
          const desc = descontoDaProposta(cotDaProposta, p);
          const cols = isMobile
            ? "1fr 120px"
            : (desc ? "1fr 72px 68px 118px 118px 108px" : "1fr 84px 76px 130px 130px");
          return (
            <div style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827", marginBottom: 2 }}>Preço item a item</div>
              <div style={{ fontSize: 11.5, color: "#4b5563", marginBottom: 10 }}>
                Preencha o unitário OU o total de cada item — um acerta o outro. O que ficar em branco entra como não cotado. Se a loja não cotou item a item e só mandou um preço pela lista inteira, deixe tudo em branco aqui e use o campo Valor lá embaixo.
              </div>
              {!isMobile && (
                <div style={{ display: "grid", gridTemplateColumns: cols, gap: 8, marginBottom: 4 }}>
                  <span style={E.label}>Material</span><span style={E.label}>Qtd.</span><span style={E.label}>Un.</span>
                  <span style={E.label}>Unitário (R$)</span><span style={E.label}>Total do item (R$)</span>
                  {desc ? <span style={{ ...E.label, textAlign: "right" }}>Com desconto</span> : null}
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
                    {/* Os dois campos são o MESMO dado por dois caminhos: o que
                        se grava é sempre o unitário, e o total do item é ele
                        vezes a quantidade. Digitar de um lado acerta o outro. */}
                    <CampoCtrNum tipo="moeda" style={E.input} valor={(p.precos || {})[it.id]}
                      onChange={(v) => setPreco(it.id, v)} placeholder="0,00" />
                    <CampoCtrNum tipo="moeda" style={{ ...E.input, opacity: q > 0 ? 1 : 0.5 }}
                      valor={u > 0 ? Math.round(u * q * 100) / 100 : ""}
                      onChange={(v) => setPreco(it.id, unitarioDoTotal(v, q))}
                      placeholder={q > 0 ? "0,00" : "sem qtd."} />
                    {desc && !isMobile && (
                      <span style={{ fontSize: 12.5, color: desc.desconto ? "#15803d" : "#b45309", fontWeight: 600, textAlign: "right" }}>
                        {u > 0 ? dinheiro(totalEfetivoItem(cotDaProposta, p, it)) : "—"}
                      </span>
                    )}
                  </div>
                );
              })}
              {preenchidos > 0 && (
                <div style={{ borderTop: "1px solid rgba(38,36,33,0.10)", paddingTop: 10, marginTop: 4 }}>
                  <div style={{ fontSize: 12, color: "#111827", marginBottom: 10 }}>
                    Soma dos itens: <strong>{dinheiro(somaAtual)}</strong> em {preenchidos} de {itens.length} {itens.length === 1 ? "item" : "itens"}
                    {preenchidos < itens.length ? " — o resto fica como não cotado por esta loja." : "."}
                  </div>
                  {/* "Leva tudo por 2.300" — o desconto de fechamento não
                      apaga o que a loja cotou: ele é distribuído. */}
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "200px 1fr", gap: 12, alignItems: "center" }}>
                    <div>
                      <label style={E.label}>Total fechado com a loja</label>
                      <CampoCtrNum tipo="moeda" style={E.input} valor={p.totalFechado}
                        onChange={(v) => set("totalFechado", v)} placeholder="opcional" />
                    </div>
                    <div style={{ fontSize: 11.5, color: desc ? (desc.desconto ? "#15803d" : "#b45309") : "#4b5563" }}>
                      {desc
                        ? `${desc.desconto ? "Desconto" : "Acréscimo"} de ${dinheiro(desc.valor)} (${String(desc.pct).replace(".", ",")}%) sobre ${dinheiro(desc.bruto)} — distribuído item a item, proporcional ao valor de cada um, para fechar exatamente ${dinheiro(desc.alvo)}.`
                        : "Se a loja fechou a lista inteira por um valor menor, digite aqui. O desconto é distribuído item a item, e os preços de tabela acima ficam guardados como estão."}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#111827", marginTop: 10 }}>
                    Total da proposta: <strong>{dinheiro(valorDaProposta(cotDaProposta, p))}</strong>
                  </div>
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
        {(() => {
          const cotDaProposta = cotacoes.find(c => c.id === formProposta.cotacaoId);
          const comLista = !!cotDaProposta && temListaDeItens(cotDaProposta);
          return (
            <div style={{ marginBottom: 18 }}>
              <label style={E.label}>Proposta enviada pelo fornecedor</label>
              <CampoAnexoProposta anexo={p.anexo} onTrocar={a => set("anexo", a)} onErro={setErro}
                lendo={lendoPdf}
                progresso={lendoPdf ? progressoPdf : null}
                aoLerPdf={comLista ? ((arq) => lerOrcamentoDaLoja(arq, cotDaProposta)) : null}
                leFoto={comLista && !!iaDisponivel}
                apoio={comLista
                  ? (iaDisponivel
                    ? "clique para escolher, ou cole com Ctrl+V — PDF, foto do papel ou print: a IA lê os preços e preenche a tabela acima"
                    : "clique para escolher, ou cole com Ctrl+V — se for PDF, eu leio os preços e preencho a tabela acima")
                  : undefined} />
            </div>
          );
        })()}
        {orcamentoLido && (() => {
          const { orcamento: o, casamento: cm, nome } = orcamentoLido;
          const escolhas = orcamentoLido.escolhas || {};
          const dia = (iso) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("pt-BR") : "");
          const trocarEscolha = (id, mudanca) => setOrcamentoLido((x) => x && ({
            ...x, escolhas: { ...(x.escolhas || {}), [id]: { ...((x.escolhas || {})[id] || {}), ...mudanca } } }));
          const comPreco = cm.casados.filter(({ item }) => ((escolhas[item.id] || {}).preco || 0) > 0);
          const soma = Math.round(comPreco.reduce((a, { item }) =>
            a + (escolhas[item.id].preco * quantidadeDoItem(item)), 0) * 100) / 100;
          const desconto = o.total > 0 && Math.abs(o.total - soma) > 0.01;
          const cols = isMobile ? "1fr" : "1fr 1.2fr 110px";
          const PN = cotPainel(isMobile, 780);
          return (
            <div style={PN.fundo}>
              <div onClick={(e) => e.stopPropagation()} style={PN.cartao}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Orçamento da loja</div>
                <div style={{ fontSize: 12.5, color: "#4b5563", marginTop: 4, marginBottom: 12 }}>
                  {nome ? `${nome} · ` : ""}
                  <span style={{ color: "#0474f4", fontWeight: 600 }}>
                    {orcamentoLido.leitor === "ia" ? "lido pela IA" : "lido pelo leitor do VICKE"}
                  </span>
                  {" "}— confira, e corrija o que estiver fora do lugar antes de preencher.
                  {orcamentoLido.aviso ? (
                    <div style={{ marginTop: 6, fontSize: 11.5, color: "#dc2626" }}>{orcamentoLido.aviso}</div>
                  ) : null}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
                  {[["Loja", o.fornecedor || "—"], ["Nº", o.numero || "—"],
                    ["Válido até", dia(o.validade) || "—"], ["Condição", o.condicao || "—"]].map(([r, v]) => (
                    <div key={r}>
                      <div style={{ fontSize: 10.5, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4 }}>{r}</div>
                      <div style={{ fontSize: 12.5, color: "#111827", fontWeight: 600 }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: "#4b5563", marginBottom: 8 }}>
                  {o.itens.length ? (
                    <>
                      <strong style={{ color: comPreco.length ? "#15803d" : "#b45309" }}>
                        {comPreco.length} de {cm.casados.length} {cm.casados.length === 1 ? "item" : "itens"} do pedido
                      </strong>{" "}
                      com preço.
                      {cm.sobrando.length ? ` A loja cotou ${cm.sobrando.length} ${cm.sobrando.length === 1 ? "linha" : "linhas"} que não estavam no pedido — a setinha mostra todas.` : ""}
                    </>
                  ) : (
                    <span style={{ color: "#b45309" }}>
                      Não reconheci a tabela desse PDF — o desenho dele é diferente. Os preços vão a mão aqui embaixo;
                      o arquivo fica anexado do mesmo jeito.
                    </span>
                  )}
                </div>
                <div style={{ ...PN.rolagem, border: "1px solid rgba(38,36,33,0.12)", borderRadius: 10 }}>
                  {cm.casados.map(({ item }) => {
                    const esc = escolhas[item.id] || { i: -1, preco: 0 };
                    const qtd = quantidadeDoItem(item);
                    // Aviso da embalagem: vale para a linha que o leitor
                    // sugeriu e também para a que você apontar à mão.
                    const linhaVista = esc.i >= 0 ? o.itens[esc.i] : (esc.sugerida >= 0 ? o.itens[esc.sugerida] : null);
                    const dif = linhaVista ? divergenciaDeEmbalagem(item.descricao, linhaVista.descricao) : null;
                    const unit = linhaVista ? precoDaLinha(linhaVista, 0) : 0;
                    const convertido = dif && dif.fator > 0 && unit > 0 ? Math.round(unit * dif.fator * 100) / 100 : 0;
                    return (
                      <div key={item.id} style={{ display: "grid", gridTemplateColumns: cols, gap: 10,
                        padding: "9px 12px", borderTop: "1px solid rgba(38,36,33,0.06)", alignItems: "center",
                        background: dif ? "#fffaf0" : undefined }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, color: "#111827" }}>{item.descricao || "Item"}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>{qtdBR(qtd)} {item.unidade || ""}</div>
                        </div>
                        {/* A setinha com TODAS as linhas do PDF: quando a
                            associação erra — e com tanto formato diferente
                            ela erra — apontar a linha certa é um clique. */}
                        <Selecao style={{ ...E.input, cursor: "pointer" }} value={String(esc.i)}
                          onChange={(e) => {
                            const i = Number(e.target.value);
                            const linha = i >= 0 ? o.itens[i] : null;
                            trocarEscolha(item.id, { i, preco: linha ? precoDaLinha(linha, qtd) : 0 });
                          }}>
                          <option value="-1">— não veio neste orçamento —</option>
                          {o.itens.map((l, i) => (
                            <option key={i} value={String(i)}>
                              {l.descricao}{precoDaLinha(l, 0) > 0 ? ` · ${dinheiro(precoDaLinha(l, 0))}` : ""}
                            </option>
                          ))}
                        </Selecao>
                        <CampoNumeroBR estilo={E.input} valor={esc.preco || ""} casas={2} placeholder="0,00"
                          aoMudar={(v) => trocarEscolha(item.id, { preco: v })} />
                        {dif && (
                          <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: "#b45309", lineHeight: 1.45 }}>
                            {esc.i >= 0 ? "Atenção: " : `A loja cotou “${linhaVista.descricao}” a ${dinheiro(unit)}, mas `}
                            {dif.texto}.{" "}
                            {esc.i < 0 ? "Não liguei sozinho. " : ""}
                            {convertido > 0 && Math.abs((esc.preco || 0) - convertido) > 0.004 && (
                              <button type="button" onClick={() => trocarEscolha(item.id, { i: esc.i >= 0 ? esc.i : esc.sugerida, preco: convertido })}
                                style={{ color: "#0474f4", background: "none", border: "none", padding: 0, cursor: "pointer",
                                  fontFamily: "inherit", fontSize: 11.5, fontWeight: 600 }}>
                                Usar {dinheiro(convertido)} por {item.unidade ? item.unidade.toLowerCase().replace(/s$/, "") : "unidade"} do pedido ({qtdBR(dif.fator)} × {dinheiro(unit)})
                              </button>
                            )}
                          </div>
                        )}
                        {!dif && esc.repetido && esc.i >= 0 && (
                          <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "#6b7280" }}>
                            Este material aparece duas vezes no pedido; a loja cotou uma vez — usei o mesmo preço.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 10 }}>
                  Soma do que tem preço: <strong>{dinheiro(soma)}</strong>
                  {desconto ? ` · o papel fecha em ${dinheiro(o.total)} — a diferença entra como desconto de fechamento.` : "."}
                </div>
                <div style={isMobile
                  ? { display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 8, marginTop: 12, flexShrink: 0 }
                  : { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14, flexShrink: 0 }}>
                  <button style={E.btnSec} onClick={() => setOrcamentoLido(null)}>Cancelar</button>
                  <button style={{ ...E.btn, opacity: comPreco.length ? 1 : 0.45, cursor: comPreco.length ? "pointer" : "not-allowed" }}
                    disabled={!comPreco.length} onClick={aplicarOrcamentoLido}>
                    Preencher a proposta
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

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
    // Conta de loja tem regra própria: ela nasce lançada e segue lançando,
    // então "já foi lançada" não pode travar. O que trava é pagamento.
    if (ehContaDeLoja(cot)) { await apagarContaDeLoja(cot); return; }
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

  async function apagarContaDeLoja(cot) {
    const trava = podeApagarContaDeLoja(cot, obra.contasPagar || []);
    if (!trava.pode) { setErro(trava.motivo); return; }
    const pedidos = (cot.pedidos || []).length;
    const quantas = (obra.contasPagar || []).filter((x) => x && x.cotacaoId === cot.id).length;
    const ok = await dialogo.confirmar({
      titulo: `Apagar a conta "${cot.titulo || "sem nome"}"?`,
      mensagem: pedidos
        ? `Vão junto ${pedidos === 1 ? "1 pedido" : pedidos + " pedidos"} e ${quantas === 1 ? "1 conta a pagar" : quantas + " contas a pagar"}. Não dá para desfazer.`
        : "A conta ainda não tem pedido nenhum. Não dá para desfazer.",
      confirmar: "Apagar conta",
      destrutivo: true,
    });
    if (!ok) return;
    setErro("");
    const r = removerCotacao(cotacoes, aprovacoes, cot.id);
    gravar({ ...obra, cotacoes: r.cotacoes, aprovacoesCotacao: r.aprovacoes,
      contasPagar: removerContasDaCotacao(obra.contasPagar || [], cot.id) });
  }

  // Encerrar é arquivar: a conta sai das abertas e para de receber pedido,
  // sem apagar nada. É o fim normal de uma conta de loja.
  function alternarEncerramento(cot) {
    setErro("");
    trocarCotacao(cot.id, (x) => ({ ...x, status: x.status === "encerrada" ? "" : "encerrada" }));
  }

  // A escolha vai para a conta da loja em vez de virar parcelas próprias:
  // abre o mesmo painel de pedido, já com os itens e os preços cotados.
  function mandarParaContaDaLoja(cot) {
    const trava = podeLancarEmContas(cot, contratos);
    if (!trava.pode) { setErro(trava.motivo); return; }
    const esc = propostaEscolhida(cot);
    if (!esc) { setErro("Escolha uma proposta primeiro."); return; }
    const conta = contaDeLojaAberta(cotacoes, esc.fornecedorId);
    if (!conta) { setErro("Esta loja não tem conta aberta nesta obra."); return; }
    setErro("");
    setFormPedido({ cotacao: conta, origem: cot,
      pedido: pedidoDaCotacao(cot, esc, insumos, conta.prazoLoja) });
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
    // Proposta com preço item a item vira medição: o valor da conta sai da
    // quantidade que de fato entrou na obra, não da estimativa cotada.
    const esc = propostaEscolhida(cot);
    const medicao = propostaTemPrecoPorItem(cot, esc) ? medicaoDaCotacao(cot, esc, insumos) : [];
    setFormLancamento({ cotacao: cot,
      dados: medicao.length ? { ...dados, medicao, valor: totalDaMedicao(medicao) } : dados });
  }

  // ── Conta na loja ────────────────────────────────────
  // O pedido é lançado direto, sem passar pelo painel de parcelas: ele já tem
  // data, vencimento e valor — o papel da loja disse os três.
  function abrirPedido(cot) {
    const trava = podeLancarEmContas(cot, contratos);
    if (!trava.pode) { setErro(trava.motivo); return; }
    setErro('');
    const loja = prestadores.find((f) => f.id === cot.lojaId);
    const prazo = Number(cot.prazoLoja) || 0;
    const novo = pedidoVazio('');
    setFormPedido({ cotacao: cot, pedido: {
      ...novo,
      vencimento: prazo > 0 && typeof somarDias === 'function' ? somarDias(novo.data, prazo) : '',
      observacao: loja ? loja.nome : '',
    } });
  }

  // Reabre o mesmo pedido para conserto. Ele volta com o id que tinha, e é
  // por isso que a gravação troca no lugar em vez de criar outro.
  function editarPedido(cot, pedido) {
    const trava = podeMexerNoPedido(obra.contasPagar || [], pedido.id);
    if (!trava.pode) { setErro(trava.motivo); return; }
    setErro("");
    setFormPedido({ cotacao: cot, pedido: { ...pedido }, editando: true });
  }

  async function apagarPedido(cot, pedido) {
    const trava = podeMexerNoPedido(obra.contasPagar || [], pedido.id);
    if (!trava.pode) { setErro(trava.motivo); return; }
    const quantas = (obra.contasPagar || []).filter((x) => x && x.pedidoId === pedido.id).length;
    const ok = await dialogo.confirmar({
      titulo: `Apagar o pedido ${pedido.numeroLoja || pedido.numero}?`,
      mensagem: quantas === 1
        ? "A conta a pagar que ele gerou sai junto."
        : `As ${quantas} contas a pagar que ele gerou saem junto.`,
      confirmar: "Apagar pedido",
      destrutivo: true,
    });
    if (!ok) return;
    if (!onExcluirPedido) { setErro("Exclusão indisponível nesta tela."); return; }
    const r = onExcluirPedido(cot.id, pedido.id);
    if (r && r.erro) { setErro(r.erro); return; }
    setErro("");
  }

  // A Entrada entrega a lista pronta; aqui ela vira pedido, pagamento ou
  // cotação. Nenhuma tela nova de saída: as três já existiam, e a Entrada
  // só chega nelas com o trabalho de leitura feito.
  function seguirDaEntrada({ destino, lojaId, itens, papel, despesa, lancamento, anexo }) {
    setErro("");
    // A tela única da Entrada lança daqui mesmo — a pagar ou pago, com os
    // itens, as etapas e as contas já escolhidos lá. Sem tela no meio.
    if (destino === "lancar") {
      if (!onLancarEntrada) return { erro: "Lançamento indisponível nesta tela." };
      const r = onLancarEntrada({ ...(lancamento || {}), obraId: obra.id }, anexo || null) || {};
      if (r.erro) { setErro(r.erro); return r; }
      setEntradaAberta(false);
      return r;
    }
    // A despesa também se resolve sem trocar de tela: não há formulário
    // adiante onde ela caberia — o que ela precisa já foi preenchido na
    // própria caixa. Por isso ela é a única que volta um resultado.
    if (destino === "despesa") {
      if (!onLancarDespesa) return { erro: "Lançamento indisponível nesta tela." };
      const r = onLancarDespesa({ ...(despesa || {}), obraId: obra.id }) || {};
      if (r.erro) return r;
      setEntradaAberta(false);
      return r;
    }
    setEntradaAberta(false);
    // "mandar" não chega aqui: a própria caixa resolve, sem trocar de tela.
    if (destino === "cotacao") {
      const nova = cotacaoVazia(obra.id);
      setFormCotacao({ ...nova, titulo: nova.titulo || "",
        itens: (itens || []).map((it) => ({
          ...(typeof itemCotacaoVazio === "function" ? itemCotacaoVazio() : {}),
          codigo: it.insumoCodigo || "", descricao: it.descricao || "",
          unidade: it.unidade || "", quantidade: it.quantidade || "",
        })) });
      return;
    }
    const loja = prestadores.find((f) => f.id === lojaId);
    if (!loja) { setErro("Escolha a loja."); return; }
    // Sem conta aberta nessa loja, a Entrada abre uma: é onde os pedidos dela
    // se acumulam, e criar à mão antes só seria um passo a mais.
    let conta = contaDeLojaAberta(cotacoes, loja.id);
    let criada = null;
    if (!conta) {
      criada = { ...cotacaoVazia(obra.id), titulo: loja.nome, contaLoja: true,
        lojaId: loja.id, prazoLoja: 30, contaId: "material" };
      conta = criada;
    }
    const base = pedidoVazio("");
    const prazo = Number(conta.prazoLoja) || 0;
    const data = (papel && papel.emitido) || base.data;
    const pedido = {
      ...base,
      data,
      numeroLoja: (papel && papel.numeroPedido) || "",
      numeroNota: (papel && papel.numeroNota) || "",
      desconto: (papel && papel.desconto) || "",
      vencimento: destino === "pagamento" ? data
        : ((papel && papel.vencimento) || (prazo > 0 && typeof somarDias === "function" ? somarDias(data, prazo) : "")),
      jaPago: destino === "pagamento",
      pagoEm: destino === "pagamento" ? data : "",
      itens: itens || [],
    };
    setFormPedido({ cotacao: conta, pedido, contaNova: criada });
  }

  function lancarPedido(pedido) {
    if (!onLancarContas || !formPedido) { setErro('Lançamento indisponível nesta tela.'); return; }
    const cot = formPedido.cotacao;
    const loja = prestadores.find((f) => f.id === cot.lojaId) || {};
    // A conta de loja que a Entrada abriu só na memória vai JUNTO com o
    // pedido, numa gravação só. Gravá-la antes, por fora, parecia funcionar
    // e não funcionava: o lançamento seguinte parte do estado anterior e
    // sobrescreve a obra sem ela.
    // "Já pago" não é outro lançamento: é o mesmo, com a baixa no mesmo ato.
    // A data que a pessoa pôs no campo é o dia em que o dinheiro saiu.
    const comBaixa = pedido.jaPago
      ? { ...pedido, pagoEm: pedido.pagoEm || pedido.vencimento || pedido.data || "" }
      : pedido;
    const r = onLancarContas({
      cotacaoId: cot.id, obraId: cot.obraId || obra.id, modo: 'contaLoja', pedido: comBaixa,
      contaNova: formPedido.contaNova || null,
      contaId: cot.contaId || 'material',
      prestadorId: loja.id || '', favorecido: loja.nome || '',
      descricao: cot.titulo || 'Compra',
      lancadoEm: new Date().toISOString(), lancadoPor: nomeDeQuem(usuario),
    });
    if (r && r.erro) { setErro(r.erro); return; }
    setErro('');
    setFormPedido(null);
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
    <div style={isMobile ? { ...E.wrap, padding: 12 } : E.wrap}>
      <button onClick={onVoltar} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontFamily: "inherit", fontSize: 12, marginBottom: 16 }}>← Voltar</button>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Cotações</div>
          <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>{obra.nome}</div>
        </div>
        {podeGerenciar && (
          <>
            <button style={{ ...E.btnSec, marginRight: 8 }}
              onClick={() => { setErro(""); setEntradaAberta(true); }}>Entrada</button>
            <button style={E.btn} onClick={() => { setErro(""); setFormCotacao(cotacaoVazia(obra.id)); }}>+ Nova cotação</button>
          </>
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

      {cotacoes.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {[["abertas", "Abertas", grupos.abertas.length], ["fechadas", "Fechadas", grupos.fechadas.length]].map(([k, r, n]) => (
            <button key={k} onClick={() => setFiltroLista(k)}
              style={{ fontFamily: "inherit", fontSize: 12, padding: "5px 12px", borderRadius: 8, cursor: "pointer",
                border: `1px solid ${filtroLista === k ? "#0474f4" : "rgba(38,36,33,0.16)"}`,
                background: filtroLista === k ? "#eef5ff" : "#fff",
                color: filtroLista === k ? "#0474f4" : "#4b5563", fontWeight: filtroLista === k ? 600 : 500 }}>
              {r} ({n})
            </button>
          ))}
        </div>
      )}

      {entradaAberta && (
        <EntradaDaObra data={data} save={save} isMobile={isMobile} dinheiro={dinheiro}
          obraPadrao={obra} usuario={usuario}
          aoFechar={() => setEntradaAberta(false)} aoSeguir={seguirDaEntrada} />
      )}

      {formPedido && (
        <PainelPedidoLoja cotacao={formPedido.cotacao} pedido={formPedido.pedido} insumos={insumos}
          isMobile={isMobile} dinheiro={dinheiro} editando={!!formPedido.editando}
          origem={formPedido.origem}
          aoMudar={(p) => setFormPedido({ ...formPedido, pedido: p })}
          aoAprender={aprenderApelidos} iaDisponivel={!!iaDisponivel}
          aoFechar={() => setFormPedido(null)} aoLancar={lancarPedido} />
      )}

      {erro && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 12 }}>{erro}</div>}

      {!cotacoes.length ? (
        <div style={{ textAlign: "center", padding: "44px 20px", fontSize: 13, color: "#4b5563" }}>
          {podeGerenciar
            ? "Nenhuma cotação nesta obra. Abra uma para começar a comparar preços."
            : "Nenhuma cotação nesta obra por enquanto."}
        </div>
      ) : !visiveis.length ? (
        <div style={{ textAlign: "center", padding: "36px 20px", fontSize: 13, color: "#4b5563" }}>
          {filtroLista === "fechadas"
            ? "Nenhuma cotação fechada ainda. Fecham as que viraram contrato ou conta a pagar, e as canceladas."
            : "Nenhuma cotação em aberto — todas já viraram contrato ou conta a pagar."}
        </div>
      ) : visiveis.map(cot => {
        const s = situacaoCotacao(cot, aprovacoes, contratos);
        const ap = aprovacaoDaEscolha(cot, aprovacoes);
        const props = propostasOrdenadas(cot);
        const esc = propostaEscolhida(cot);
        const melhor = melhorProposta(cot);
        const eco = economiaDaCotacao(cot);
        const conta = typeof contaPorId === "function" ? contaPorId(cot.contaId) : null;
        const aberto = !!abertas[cot.id];
        const trava = podeGerarContrato(cot, aprovacoes, contratos);
        // Conta de loja mostra o que está pendurado, não o preço de uma proposta.
        const pedidosDaLoja = (cot.pedidos || []).length;
        const abertoDaLoja = !ehContaDeLoja(cot) ? 0 : Math.round(
          (obra.contasPagar || [])
            .filter(x => x && x.cotacaoId === cot.id && !x.pago)
            .reduce((s, x) => s + (Number(x.valor) || 0), 0) * 100) / 100;
        return (
          <div key={cot.id} style={E.card}>
            <button onClick={() => setAbertas(a => ({ ...a, [cot.id]: !a[cot.id] }))}
              style={{ width: "100%", background: "none", border: "none", padding: "12px 14px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 160, fontSize: 13.5, fontWeight: 700, color: "#111827" }}>{cot.titulo || "Cotação sem nome"}</div>
                {selo(s.cor, s.rotulo)}
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#111827" }}>
                  {ehContaDeLoja(cot)
                    ? dinheiro(abertoDaLoja)
                    : esc ? dinheiro(valorProposta(esc)) : melhor ? `a partir de ${dinheiro(valorProposta(melhor))}` : "—"}
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 3 }}>
                {ehContaDeLoja(cot) ? (
                  `${(prestadores.find(f => f.id === cot.lojaId) || {}).nome || "sem loja"} · `
                  + (pedidosDaLoja === 1 ? "1 pedido" : `${pedidosDaLoja} pedidos`)
                  + (abertoDaLoja > 0 ? " · a pagar" : "")
                ) : (
                  <>
                    {(conta ? conta.nome + " · " : "")}{props.length === 1 ? "1 proposta" : `${props.length} propostas`}
                    {cot.prazoResposta ? ` · responder até ${cot.prazoResposta.split("-").reverse().join("/")}` : ""}
                  </>
                )}
              </div>
            </button>

            {aberto && ehContaDeLoja(cot) && (
              <div style={{ borderTop: "1px solid rgba(38,36,33,0.08)", padding: isMobile ? "12px 10px" : "12px 14px" }}>
                {cot.escopo && <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 12, whiteSpace: "pre-wrap" }}>{cot.escopo}</div>}
                <BlocoContaLoja cotacao={cot} contasPagar={obra.contasPagar || []}
                  loja={prestadores.find((f) => f.id === cot.lojaId)} isMobile={isMobile}
                  dinheiro={dinheiro} podeGerenciar={podeGerenciar}
                  aoNovoPedido={() => abrirPedido(cot)}
                  aoEditarPedido={(p) => editarPedido(cot, p)}
                  aoApagarPedido={(p) => apagarPedido(cot, p)}
                  aoEditarConta={() => { setErro(""); setFormCotacao(cot); }}
                  aoApagarConta={() => excluirCotacao(cot)}
                  aoEncerrar={() => alternarEncerramento(cot)} />
              </div>
            )}

            {aberto && !ehContaDeLoja(cot) && (
              <div style={{ borderTop: "1px solid rgba(38,36,33,0.08)", padding: isMobile ? "12px 10px" : "12px 14px" }}>
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
                  if (cot.pedidoNaLoja) {
                    const alvo = cotacoes.find((x) => x.id === cot.pedidoNaLoja.contaLojaId);
                    linhas.push(["Virou pedido",
                      `${cot.pedidoNaLoja.numeroLoja || cot.pedidoNaLoja.numero || ""} na conta ${(alvo || {}).titulo || "da loja"}`.trim()]);
                  }
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

                {(() => {
                  if (!props.length) {
                    return <div style={{ fontSize: 12.5, color: "#4b5563", marginBottom: 12 }}>Nenhuma proposta registrada ainda.</div>;
                  }
                  // O que se diz de cada proposta e o que se faz com ela é o
                  // mesmo no computador e no celular; muda só a arrumação. No
                  // celular a tabela cortava as colunas da direita — e era lá
                  // que ficava o "Escolher", então a tela pedia "escolha uma
                  // proposta primeiro" sem mostrar onde escolher.
                  const infoDa = (p, escolhida, maisBarata) => (
                    <>
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
                          style={{ fontSize: isMobile ? 12 : 11, color: "#0474f4", background: "none", border: "none", padding: 0,
                            cursor: "pointer", fontFamily: "inherit", display: "inline-block", marginTop: 3, textAlign: "left" }}>
                          📎 {p.anexo.formato === "pdf" || p.anexo.resourceType === "raw" ? "Ver proposta (PDF)" : "Ver proposta"}
                        </button>
                      )}
                    </>
                  );
                  const bt = isMobile
                    ? { ...E.btnSec, padding: "8px 12px", fontSize: 12.5 }
                    : { ...E.btnSec, padding: "5px 10px", fontSize: 11.5 };
                  const acoesDa = (p, escolhida) => (
                    <>
                      {!cot.contaGeradaId && !contratoDaCotacao(contratos, cot.id) && (
                        <button style={isMobile && !escolhida ? { ...E.btn, padding: "8px 14px", fontSize: 12.5 } : { ...bt, marginRight: isMobile ? 0 : 6 }}
                          onClick={() => trocarCotacao(cot.id, c => (escolhida
                            ? { ...limparEnvioAoCliente(c), escolhidaId: "", escolhidoPor: "", escolhidoEm: "" }
                            : { ...limparEnvioAoCliente(c), escolhidaId: p.id, escolhidoPor: nomeDeQuem(usuario), escolhidoEm: new Date().toISOString() }))}>
                          {escolhida ? "Desfazer" : "Escolher"}
                        </button>
                      )}
                      {/* Os pagamentos combinados pertencem ao fornecedor
                          escolhido, então o caminho até eles é a linha dele. */}
                      {escolhida && linhasDoPagamento(cot, obra.contasPagar || [], hoje).linhas.length > 0 && (
                        <button style={{ ...bt, marginRight: isMobile ? 0 : 6 }}
                          onClick={() => setDetalhePag(cot)}>Detalhe</button>
                      )}
                      <button style={bt}
                        onClick={() => { setErro(""); setFormProposta({ cotacaoId: cot.id, proposta: p }); }}>Editar</button>
                      {/* Desfazer o lançamento é ação sobre ESTE fornecedor,
                          não sobre a cotação: mora ao lado dos pagamentos que
                          ele gerou. */}
                      {escolhida && cot.contaGeradaId && !contratoDaCotacao(contratos, cot.id) && (
                        <button style={{ ...bt, marginLeft: isMobile ? 0 : 6, color: "#dc2626" }}
                          onClick={() => desfazerLancamento(cot)}>Desfazer lançamento</button>
                      )}
                      {!cot.contaGeradaId && !contratoDaCotacao(contratos, cot.id) && (
                        <button title="Excluir esta proposta"
                          style={{ ...bt, marginLeft: isMobile ? 0 : 6, color: "#dc2626" }}
                          onClick={() => excluirProposta(cot, p)}>Excluir</button>
                      )}
                    </>
                  );

                  if (isMobile) {
                    return (
                      <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                        {props.map(p => {
                          const escolhida = p.id === cot.escolhidaId;
                          const maisBarata = melhor && p.id === melhor.id;
                          const detalhes = [p.prazoDias ? `Prazo ${p.prazoDias} dias` : "", p.condicaoPagamento || ""].filter(Boolean);
                          return (
                            <div key={p.id} style={{ border: `1px solid ${escolhida ? "rgba(4,116,244,0.35)" : "rgba(38,36,33,0.12)"}`,
                              borderRadius: 12, padding: 10, background: escolhida ? "#f0f7ff" : "#fff" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                                <div style={{ minWidth: 0, fontSize: 13 }}>{infoDa(p, escolhida, maisBarata)}</div>
                                <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", whiteSpace: "nowrap" }}>
                                  {valorProposta(p) > 0 ? dinheiro(valorProposta(p)) : "—"}
                                </div>
                              </div>
                              {detalhes.length > 0 && (
                                <div style={{ fontSize: 12, color: "#4b5563", marginTop: 6 }}>{detalhes.join(" · ")}</div>
                              )}
                              {podeGerenciar && (
                                <div className="vk-acoes-proposta" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                                  <style>{".vk-acoes-proposta > button { flex: 1 1 auto; }"}</style>
                                  {acoesDa(p, escolhida)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  return (
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
                                <td style={{ padding: "8px" }}>{infoDa(p, escolhida, maisBarata)}</td>
                                <td style={{ padding: "8px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{valorProposta(p) > 0 ? dinheiro(valorProposta(p)) : "—"}</td>
                                <td style={{ padding: "8px", whiteSpace: "nowrap" }}>{p.prazoDias ? `${p.prazoDias} dias` : "—"}</td>
                                <td style={{ padding: "8px" }}>{p.condicaoPagamento || "—"}</td>
                                {podeGerenciar && (
                                  <td style={{ padding: "8px", whiteSpace: "nowrap" }}>{acoesDa(p, escolhida)}</td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

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

                {/* No celular, grade de duas colunas: botão solto em linha
                    quebrava onde calhava, e o recado do "por que está
                    travado" ficava espremido entre dois botões. */}
                <div style={isMobile
                  ? { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }
                  : { display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                      {/* A loja escolhida tem conta aberta? Então o normal é somar
                          à fatura dela, não abrir uma cobrança em paralelo. */}
                      {podeGerenciar && (() => {
                        const esc2 = propostaEscolhida(cot);
                        const loja = esc2 && contaDeLojaAberta(cotacoes, esc2.fornecedorId);
                        if (!loja || !podeLancarEmContas(cot, contratos).pode) return null;
                        const nome = (prestadores.find((f) => f.id === loja.lojaId) || {}).nome || "loja";
                        return (
                          <button style={E.btn} title={`Entra como pedido na conta de ${nome} e se soma à fatura dela`}
                            onClick={() => mandarParaContaDaLoja(cot)}>Somar à conta da {nome}</button>
                        );
                      })()}
                      {!trava.pode && <span style={{ fontSize: 11.5, color: "#6b7280", alignSelf: "center",
                        gridColumn: isMobile ? "1 / -1" : undefined }}>{trava.motivo}</span>}
                      {podeExcluir && (
                        <button style={{ ...E.btnSec, color: "#dc2626", marginLeft: isMobile ? 0 : "auto",
                          gridColumn: isMobile ? "1 / -1" : undefined }}
                          onClick={() => excluirCotacao(cot)}>Excluir cotação</button>
                      )}
                    </>
                  )}
                  {temListaDeItens(cot) && (
                    <>
                      {podeGerenciar && (
                        <button style={E.btn} onClick={() => { setErro(""); setPedirLojas(cot); }}>
                          Pedir preço às lojas
                          {enviosDaLista(cot).length ? ` · ${enviosDaLista(cot).length}` : ""}
                        </button>
                      )}
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
                    <span style={{ fontSize: 12, color: "#15803d", alignSelf: "center", gridColumn: isMobile ? "1 / -1" : undefined }}>
                      Virou contrato — as parcelas saem de lá, na aba Contratos.
                    </span>
                  )}
                  {podeGerenciar && !contratoDaCotacao(contratos, cot.id) && cot.contaGeradaId && (
                    <>
                      <span style={{ fontSize: 12, color: "#15803d", alignSelf: "center", gridColumn: isMobile ? "1 / -1" : undefined }}>
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
          isMobile={isMobile}
          dinheiro={dinheiro}
          onConfirmar={confirmarLancamento}
          onFechar={() => setFormLancamento(null)}
        />
      )}

      {visor && <VisorProposta anexo={visor} aoFechar={() => setVisor(null)} />}

      {pedirLojas && (
        <div style={cotPainel(isMobile, 560).fundo}>
          <div onClick={(e) => e.stopPropagation()} style={cotPainel(isMobile, 560).cartao}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Pedir preço às lojas</div>
            <div style={{ fontSize: 12.5, color: "#4b5563", marginTop: 4, marginBottom: 12 }}>
              {pedirLojas.titulo || "Lista"} · {itensDaCotacao(pedirLojas).length} {itensDaCotacao(pedirLojas).length === 1 ? "item" : "itens"}.
              Marque as lojas e clique em Enviar: cada conversa abre com a lista já escrita, e quem aperta enviar é você, lá no WhatsApp.
            </div>
            <input style={{ ...E.input, marginBottom: 10 }} value={buscaLoja} placeholder="Achar a loja pelo nome"
              onChange={(e) => setBuscaLoja(e.target.value)} />
            {(() => {
              const lojas = lojasParaPedir(prestadores, pedirLojas, buscaLoja);
              const comLink = lojas.filter((l) => l.link);
              const marcadas = comLink.filter((l) => lojasMarcadas[l.fornecedor.id]);
              const fila = filaEnvio;
              const faltam = fila ? fila.lojas.slice(fila.i) : [];
              const enviadas = enviosDaLista(pedirLojas).length;
              return (
                <>
                  <div style={{ ...cotPainel(isMobile).rolagem, border: "1px solid rgba(38,36,33,0.12)", borderRadius: 10 }}>
                    {!lojas.length ? (
                      <div style={{ padding: "12px 14px", fontSize: 12.5, color: "#4b5563" }}>
                        Nenhum fornecedor com esse nome. Cadastre em Prestadores de Serviços, com o telefone.
                      </div>
                    ) : lojas.map(({ fornecedor: f, envio, jaCotou, link }) => (
                      <label key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                        padding: "9px 12px", borderTop: "1px solid rgba(38,36,33,0.06)", cursor: link ? "pointer" : "default" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <input type="checkbox" disabled={!link} checked={!!lojasMarcadas[f.id] && !!link}
                            onChange={(e) => setLojasMarcadas((m) => ({ ...m, [f.id]: e.target.checked }))}
                            style={{ cursor: link ? "pointer" : "not-allowed" }} />
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#111827" }}>{f.nome || "Sem nome"}</span>
                            <span style={{ display: "block", fontSize: 11.5, color: "#6b7280" }}>
                              {[f.telefone || "sem telefone no cadastro", f.cidade].filter(Boolean).join(" · ")}
                              {jaCotou ? " · já respondeu" : envio ? ` · enviado em ${dataCurta(envio.em)}` : ""}
                            </span>
                          </span>
                        </span>
                        <button type="button" disabled={!link} title={link ? "" : "Cadastre o telefone desta loja"}
                          style={{ ...E.btnSec, padding: "5px 11px", fontSize: 11.5, opacity: link ? 1 : 0.45,
                            cursor: link ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}
                          onClick={(e) => { e.preventDefault(); abrirWhatsAppDaLoja(pedirLojas, f); }}>
                          {envio ? "Reenviar" : "Enviar"}
                        </button>
                      </label>
                    ))}
                  </div>
                  {erro && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 10 }}>{erro}</div>}

                  {fila ? (
                    <div style={{ marginTop: 14, border: "1px solid rgba(4,116,244,0.22)", background: "#eef5ff",
                      borderRadius: 12, padding: "12px 14px" }}>
                      {faltam.length ? (
                        <>
                          <div style={{ fontSize: 12.5, color: "#111827", marginBottom: 10 }}>
                            {fila.i} de {fila.lojas.length} enviadas. O navegador só abre uma conversa por clique, então a próxima vai neste botão.
                          </div>
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <button style={E.btn} onClick={proximaDaFila}>
                              Abrir {faltam[0].fornecedor.nome || "a próxima"}
                            </button>
                            <button style={E.btnSec} onClick={() => setFilaEnvio(null)}>Parar</button>
                          </div>
                        </>
                      ) : (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12.5, color: "#15803d", fontWeight: 600 }}>
                            Pronto — {fila.lojas.length} {fila.lojas.length === 1 ? "loja" : "lojas"} nesta rodada.
                          </span>
                          <button style={E.btnSec} onClick={() => { setFilaEnvio(null); setLojasMarcadas({}); }}>Nova seleção</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                      <span style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <button type="button" style={{ ...E.btnSec, padding: "5px 11px", fontSize: 11.5 }}
                          onClick={() => setLojasMarcadas(marcadas.length === comLink.length
                            ? {}
                            : Object.fromEntries(comLink.map((l) => [l.fornecedor.id, true])))}>
                          {marcadas.length === comLink.length && comLink.length ? "Limpar seleção" : "Selecionar todas"}
                        </button>
                        <span style={{ fontSize: 11.5, color: "#4b5563" }}>
                          {enviadas ? `Já enviada para ${enviadas} ${enviadas === 1 ? "loja" : "lojas"}.` : "Ainda não foi enviada."}
                        </span>
                      </span>
                      <span style={{ display: "flex", gap: 8 }}>
                        <button style={E.btnSec} onClick={fecharPainelLojas}>Fechar</button>
                        <button style={{ ...E.btn, opacity: marcadas.length ? 1 : 0.45, cursor: marcadas.length ? "pointer" : "not-allowed" }}
                          disabled={!marcadas.length} onClick={() => iniciarFila(pedirLojas, marcadas)}>
                          Enviar para {marcadas.length || 0}
                        </button>
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {folhaPedido && (
        <FolhaPedido cot={folhaPedido.cot} proposta={folhaPedido.proposta} ctx={ctxPedido}
          aoFechar={() => setFolhaPedido(null)} />
      )}

      {detalhePag && (
        <div
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
function CotacaoLancamento({ cotacao, dados, dinheiro, isMobile, onConfirmar, onFechar }) {
  const [f, setF] = useState(dados);
  const E = COT_ESTILO;
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  // A cotação lançada nasce com uma conta POR ITEM, com quantidade e etapa —
  // é o que faz o custo por etapa enxergar a compra. Quantidade e preço se
  // corrigem depois, na própria conta a pagar: é lá que o dinheiro está, e
  // é lá que se olha quando a realidade veio diferente do cotado.
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
  // Com medição, a etapa de cada item é condição para lançar — mesma regra
  // do pedido da loja, e pela mesma razão.
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
          <SelectBusca style={E.input} value={f.contaId} onChange={v => set("contaId", v)}
            placeholder="Procurar conta…"
            opcoes={grupos.filter(g => g.id !== "receitas").map(function (g) {
              return {
                grupo: g.titulo,
                opcoes: contas.filter(function (c) { return c.grupo === g.id; })
                  .map(function (c) { return { valor: c.id, rotulo: c.nome }; }),
              };
            })} />
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
            ? <a href={blobUrl} download={/\.pdf$/i.test(a.nome || "") ? a.nome : (a.nome || "arquivo") + ".pdf"} style={{ ...E.btnSec, textDecoration: "none" }}>Baixar</a>
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
              Abrindo o arquivo…
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
                    const u = precoEfetivo(cot, p, it);
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

// Barra fina, frase curta e o tempo corrido. A barra só anda para frente:
// se a etapa seguinte calcular menos (acontece na virada de "lendo o
// arquivo" para o primeiro item), ela fica onde estava.
function BarraLeituraIA({ progresso }) {
  const a = andamentoDaLeitura(progresso);
  const maximo = useRef(0);
  if (a.pct != null && a.pct > maximo.current) maximo.current = a.pct;
  const largura = maximo.current || 4;
  return (
    <div role="status" aria-live="polite" style={{ width: "100%" }}>
      <div style={{ height: 3, borderRadius: 3, background: "rgba(4,116,244,0.12)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${largura}%`, background: "#0474f4", borderRadius: 3,
          transition: "width .6s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 5, fontSize: 11.5, color: "#6b7280" }}>
        <span>{a.frase}</span>
        <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{a.seg} s</span>
      </div>
    </div>
  );
}

// ── Trocar o material de uma linha lida ─────────────────────────
// Igual ao campo de material da cotação: toca, digita "luva", aparecem
// todas as luvas do catálogo. Sem nada digitado, aparecem os parecidos com
// o que ele escreveu. E se não existe, cadastra ali mesmo — nome, grupo e
// unidade — sem sair da conferência.
// O campo "Item do catálogo" de qualquer formulário de transação: procura,
// e quando não acha cadastra no padrão do catálogo e já usa. É o mesmo
// seletor das linhas do pedido — um jeito só de escolher e de cadastrar.
function CampoItemDoCatalogo({ codigo, descricao, unidade, insumos, aoEscolher, aoCadastrar, aoLimpar }) {
  const lista = insumos || [];
  const casado = codigo ? lista.find((y) => y && (y.codigo === codigo || y.id === codigo)) || null : null;
  const termo = String(descricao || "").trim();
  const x = { id: "item", termo, bruto: termo, unidade: unidade || "", insumo: casado,
    rotuloVazio: casado ? "" : (termo ? `Escolher do catálogo — “${termo}”` : "Escolher do catálogo") };
  const parecidos = useMemo(() => (casado || !termo ? [] : buscarNoCatalogo(lista, termo, 6)), [casado, termo, lista]);
  // A descrição da nota vira apelido do item novo só quando fala do mesmo
  // item. Cadastrar "Brita 1" numa conta descrita como "Concreto usinado"
  // não pode ensinar o catálogo que concreto é brita.
  const apelidoSe = (nome) => {
    const t = cotSemAcento(termo);
    const ps = cotSemAcento(nome).split(" ").filter((w) => w.length >= 3);
    return ps.length > 0 && ps.filter((w) => t.indexOf(w) >= 0).length * 2 >= ps.length;
  };
  return (
    <EscolhaInsumoPedido x={x} parecidos={parecidos} insumos={lista} unidades={unidadesDoCatalogo(lista)}
      apelidoSe={apelidoSe}
      aoEscolher={(ins) => ins && aoEscolher && aoEscolher(ins)}
      aoDeixarFora={casado && aoLimpar ? aoLimpar : undefined}
      aoCadastrar={(campos) => {
        const novo = aoCadastrar ? aoCadastrar(campos) : null;
        if (novo && aoEscolher) aoEscolher(novo);
        return novo;
      }} />
  );
}

function EscolhaInsumoPedido({ x, parecidos, insumos, unidades, aoEscolher, aoDeixarFora, aoCadastrar, apelidoSe }) {
  const E = COT_ESTILO;
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [marcado, setMarcado] = useState(0);
  const [novo, setNovo] = useState(null);      // { nome, grupo, unidade } quando cadastrando
  const campo = useRef(null);
  const lista = useRef(null);

  const achados = termo.trim() ? buscarNoCatalogo(insumos, termo, 60) : (parecidos || []);
  // "luva" digitado para achar a luva soldável 32x25 não é o nome do item
  // novo: se o que se digitou está dentro do que ele escreveu, o nome
  // sugerido é o que ele escreveu (sem a marca). Senão, o que se digitou.
  const escrito = x.termo || x.bruto || "";
  const digitadas = cotSemAcento(termo).split(" ").filter(Boolean);
  const dentroDoEscrito = digitadas.every((p) => cotSemAcento(escrito).indexOf(p) >= 0);
  const nomeSugerido = semMarca(!digitadas.length || dentroDoEscrito ? escrito : termo.trim());
  // O nome no padrão do catálogo: família mais parecida + a medida.
  const baseDoNome = !digitadas.length || dentroDoEscrito ? escrito : termo;
  const familias = (aberto || novo) ? familiasDoCatalogo(palavraChave(baseDoNome), escrito, insumos) : [];
  const medidaDe = (f) => medidaDoTexto(termo, f ? f.sep : "x") || medidaDoTexto(escrito, f ? f.sep : "x");
  const nomePadrao = familias.length ? nomeNoPadrao(familias[0].familia, medidaDe(familias[0])) : nomeSugerido;
  const opcoes = [
    ...achados.map((i) => ({ tipo: "item", i })),
    { tipo: "novo" },
    ...(aoDeixarFora ? [{ tipo: "fora" }] : []),
  ];
  // Na última linha a lista abria abaixo da dobra: rola o painel até ela.
  const abrir = () => {
    setAberto(true); setTermo(""); setMarcado(0);
    setTimeout(() => {
      if (campo.current) campo.current.focus({ preventScroll: true });
      if (lista.current && lista.current.scrollIntoView) lista.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 0);
  };
  const fechar = () => { setAberto(false); setTermo(""); };
  const comecarCadastro = () => {
    if (familias.length) {
      const f = familias[0];
      setNovo({ padrao: 0, complemento: medidaDe(f), nomeLivre: nomeSugerido, grupo: f.grupo, unidade: f.unidade });
      fechar();
      return;
    }
    let grupo = typeof grupoInferido === "function" ? grupoInferido(nomeSugerido) : "Outros";
    // A regra não conhece "luva"; o catálogo conhece: o grupo mais comum
    // entre os itens com a mesma primeira palavra.
    if (grupo === "Outros") {
      const primeira = cotSemAcento(nomeSugerido).split(" ").find((p) => p.length >= 3);
      const conta = {};
      for (const i of primeira ? buscarNoCatalogo(insumos, primeira, 200) : []) if (i.grupo) conta[i.grupo] = (conta[i.grupo] || 0) + 1;
      const top = Object.keys(conta).sort((a, b) => conta[b] - conta[a])[0];
      if (top) grupo = top;
    }
    setNovo({ padrao: -1, complemento: "", nomeLivre: nomeSugerido, grupo: grupo === "Prestadores de serviços" ? "Outros" : grupo,
      unidade: x.unidade || "Unidades" });
    fechar();
  };
  const usar = (o) => {
    if (!o) return;
    if (o.tipo === "item") { aoEscolher(o.i); fechar(); }
    else if (o.tipo === "novo") comecarCadastro();
    else { aoDeixarFora(); fechar(); }
  };

  const grupos = gruposDoCatalogo(insumos, typeof INSUMO_GRUPOS !== "undefined" ? INSUMO_GRUPOS : []);

  // Com uma proposta em cima da linha, dizer "fora do catálogo" aqui embaixo
  // seria desmentir o que a tela acabou de afirmar: o campo passa a ser o que
  // é de fato, a porta para escolher outro.
  const rotulo = x.insumo ? x.insumo.nome
    : (x.rotuloVazio || `Fora do catálogo — “${x.termo}”`);
  const linha = (conteudo, k, extra) => (
    <div key={k} onMouseDown={(e) => { e.preventDefault(); usar(opcoes[k]); }} onMouseEnter={() => setMarcado(k)}
      style={{ padding: "8px 11px", cursor: "pointer", background: k === marcado ? "#eef5ff" : "#fff",
        borderTop: k ? "1px solid rgba(38,36,33,0.06)" : "none", ...extra }}>{conteudo}</div>
  );

  if (novo) {
    const fam = novo.padrao >= 0 ? familias[novo.padrao] : null;
    // No padrão, sem a medida o nome seria só a família ("... - Luva"): não serve.
    const nomeFinal = fam ? (String(novo.complemento || "").trim() ? nomeNoPadrao(fam.familia, novo.complemento) : "")
      : String(novo.nomeLivre || "").trim();
    // Cadastrar duas vezes o mesmo item é o que bagunça um catálogo: se o
    // nome montado já existe, oferece usar o que existe.
    const jaExiste = nomeFinal ? (insumos || []).find((i) => i && i.tipo !== "prestador"
      && cotSemAcento(i.nome) === cotSemAcento(nomeFinal)) : null;
    const trocarPadrao = (v) => {
      const p = Number(v);
      const f = familias[p];
      setNovo({ ...novo, padrao: p, ...(f ? { grupo: f.grupo, unidade: f.unidade,
        complemento: novo.complemento || medidaDe(f) } : {}) });
    };
    const rot = { fontSize: 11, fontWeight: 600, color: "#4b5563", marginBottom: 3 };
    return (
      <div style={{ border: "1px solid rgba(4,116,244,0.35)", borderRadius: 10, padding: 10, background: "#f7fbff", display: "grid", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>Cadastrar no catálogo</div>
        {familias.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={rot}>No padrão de</div>
              <Selecao style={{ ...E.input, cursor: "pointer" }} value={novo.padrao} onChange={(e) => trocarPadrao(e.target.value)}>
                {familias.map((f, k) => <option key={f.familia} value={k}>{f.familia} …</option>)}
                <option value={-1}>Nome livre, sem padrão</option>
              </Selecao>
            </div>
            {fam && (
              <div style={{ minWidth: 0 }}>
                <div style={rot}>Medida / complemento</div>
                <input style={E.input} value={novo.complemento} autoFocus placeholder="32×25mm"
                  onChange={(e) => setNovo({ ...novo, complemento: e.target.value })} />
              </div>
            )}
          </div>
        )}
        {fam ? (
          <div style={{ fontSize: 12.5, color: "#111827", padding: "7px 10px", background: "#fff", borderRadius: 8,
            border: "1px solid rgba(38,36,33,0.12)" }}>
            <span style={{ fontSize: 11, color: "#6b7280" }}>Vai ficar: </span>
            {nomeFinal ? <b style={{ fontWeight: 600 }}>{nomeFinal}</b>
              : <span style={{ color: "#6b7280" }}>{fam.familia} + a medida</span>}
          </div>
        ) : (
          <input style={E.input} value={novo.nomeLivre} autoFocus={!familias.length} placeholder="Nome do item, sem a marca"
            onChange={(e) => setNovo({ ...novo, nomeLivre: e.target.value })} />
        )}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 8 }}>
          <SelectBusca style={E.input} value={novo.grupo} placeholder="Procurar grupo…"
            onChange={(v) => setNovo({ ...novo, grupo: v })}
            opcoes={grupos.includes(novo.grupo) ? grupos : [novo.grupo].concat(grupos)} />
          <CampoUnidade valor={novo.unidade} unidades={unidades} aoMudar={(v) => setNovo({ ...novo, unidade: v })} />
        </div>
        {jaExiste ? (
          <div style={{ fontSize: 11.5, color: "#b45309" }}>
            Já existe “{jaExiste.nome}” no catálogo.{" "}
            <button type="button" onClick={() => { aoEscolher(jaExiste); setNovo(null); }}
              style={{ color: "#0474f4", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600 }}>
              Usar este
            </button>
          </div>
        ) : x.termo && (!apelidoSe || apelidoSe(nomeFinal)) ? (
          <div style={{ fontSize: 11, color: "#6b7280" }}>
            “{x.termo}” fica guardado como apelido: da próxima vez que escreverem assim, o VICKE já acha.
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" style={E.btnSec} onClick={() => setNovo(null)}>Cancelar</button>
          <button type="button" style={{ ...E.btn, opacity: nomeFinal && !jaExiste ? 1 : 0.45 }} disabled={!nomeFinal || !!jaExiste}
            onClick={() => { const r = aoCadastrar({ nome: nomeFinal, grupo: novo.grupo, unidade: novo.unidade,
              escrito: !apelidoSe || apelidoSe(nomeFinal) ? x.termo : "" }); if (r) setNovo(null); }}>
            Cadastrar e usar
          </button>
        </div>
      </div>
    );
  }

  // Nada achado e nada proposto é o único estado que exige ação: se o item
  // seguir assim, ele entra no pedido sem insumo, sem etapa e sem conta. É
  // isso que o vermelho diz — e por isso ele não aparece quando há proposta
  // em cima da linha, que é só um toque de confirmação.
  const semNadaNoCatalogo = !x.insumo && !x.rotuloVazio;

  if (!aberto) {
    return (
      <button type="button" onClick={abrir} title="Trocar o material"
        style={{ ...E.input, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
          border: semNadaNoCatalogo ? "1.5px solid rgba(220,38,38,0.45)" : E.input.border,
          background: semNadaNoCatalogo ? "#fff6f6" : "#fff",
          color: x.insumo ? "#111827" : semNadaNoCatalogo ? "#dc2626" : "#6b7280", fontFamily: "inherit" }}>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rotulo}</span>
        <span aria-hidden="true" style={{ fontSize: 10, color: semNadaNoCatalogo ? "#dc2626" : "#6b7280" }}>▼</span>
      </button>
    );
  }

  return (
    <div>
      <input ref={campo} style={E.input} value={termo} placeholder="Digite para buscar — luva, cabo, cimento…"
        onChange={(e) => { setTermo(e.target.value); setMarcado(0); }}
        onBlur={() => setTimeout(fechar, 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setMarcado((m) => Math.min(m + 1, opcoes.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setMarcado((m) => Math.max(m - 1, 0)); }
          if (e.key === "Enter") { e.preventDefault(); usar(opcoes[marcado]); }
          if (e.key === "Escape") { e.preventDefault(); fechar(); }
        }} />
      {/* A lista abre embaixo do campo, empurrando o resto — e não por cima:
          dentro do painel que rola, uma lista flutuante ficava cortada. */}
      <div ref={lista} style={{ border: "1px solid rgba(38,36,33,0.16)", borderRadius: 10, marginTop: 4, maxHeight: 260,
        overflowY: "auto", background: "#fff", boxShadow: "0 10px 26px -14px rgba(17,24,39,0.35)" }}>
        <div style={{ padding: "6px 11px", fontSize: 10.5, fontWeight: 600, color: "#6b7280", background: "#f9fafb" }}>
          {termo.trim()
            ? (achados.length ? `${achados.length}${achados.length === 60 ? "+" : ""} no catálogo` : "Nada no catálogo com isso")
            : (achados.length ? "Mais parecidos com o que ele escreveu" : "Digite para buscar no catálogo")}
        </div>
        {achados.map((i, k) => linha(
          <>
            <div style={{ fontSize: 12.5, color: "#111827" }}>{i.nome}</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>{[i.codigo, i.grupo, i.unidade].filter(Boolean).join(" · ")}</div>
          </>, k))}
        {linha(<span style={{ fontSize: 12.5, color: "#0474f4", fontWeight: 600 }}>
          ＋ {nomePadrao ? <>Cadastrar “{nomePadrao}” no catálogo</> : "Cadastrar item novo no catálogo"}</span>,
          achados.length)}
        {aoDeixarFora && linha(<span style={{ fontSize: 12, color: "#4b5563" }}>Deixar fora do catálogo, como “{x.termo}”</span>,
          achados.length + 1)}
      </div>
    </div>
  );
}

// Campo de unidade: sempre com a setinha, nunca texto solto.
// ── O corpo de uma conta de loja ────────────────────────────────
// Não tem proposta para comparar nem escolha para enviar: tem os pedidos
// feitos, o que já foi pago e o que está pendurado esperando a loja ligar.
function BlocoContaLoja({ cotacao, contasPagar, loja, isMobile, dinheiro, podeGerenciar, aoNovoPedido, aoEditarPedido, aoApagarPedido, aoEditarConta, aoApagarConta, aoEncerrar }) {
  const E = COT_ESTILO;
  const pedidos = cotacao.pedidos || [];
  const contas = (contasPagar || []).filter((c) => c && c.cotacaoId === cotacao.id);
  const red = (x) => Math.round(x * 100) / 100;
  const doPedido = (id) => contas.filter((c) => c.pedidoId === id);
  const soma = (lista) => red(lista.reduce((s, c) => s + (Number(c.valor) || 0), 0));
  const aberto = soma(contas.filter((c) => !c.pago));
  const pago = soma(contas.filter((c) => c.pago));

  const grade = { display: "grid",
    gridTemplateColumns: isMobile ? "minmax(0,1fr) 92px" : "minmax(0,1.2fr) 92px 92px 58px 96px 92px 108px",
    gap: 8, alignItems: "center" };
  const cab = { fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 };
  const cel = { fontSize: 12.5, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
  const dataBr = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "—");

  return (
    <>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "baseline", marginBottom: 12 }}>
        <div>
          <div style={cab}>Loja</div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#111827", marginTop: 2 }}>
            {loja ? loja.nome : "— sem loja no cadastro —"}
          </div>
        </div>
        {Number(cotacao.prazoLoja) > 0 && (
          <div>
            <div style={cab}>Prazo</div>
            <div style={{ fontSize: 12.5, color: "#111827", marginTop: 2 }}>{Number(cotacao.prazoLoja)} dias</div>
          </div>
        )}
        <div>
          <div style={cab}>A pagar</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: aberto > 0 ? "#0474f4" : "#111827", marginTop: 2 }}>{dinheiro(aberto)}</div>
        </div>
        {pago > 0 && (
          <div>
            <div style={cab}>Já pago</div>
            <div style={{ fontSize: 12.5, color: "#4b5563", marginTop: 2 }}>{dinheiro(pago)}</div>
          </div>
        )}
        {podeGerenciar && cotacao.status !== "encerrada" && (
          <button style={{ ...E.btn, marginLeft: "auto" }} onClick={aoNovoPedido}>+ Novo pedido</button>
        )}
      </div>

      {!pedidos.length ? (
        <div style={{ fontSize: 12.5, color: "#4b5563", padding: "10px 0" }}>
          Nenhum pedido nesta conta ainda. Arraste o PDF que a loja mandou e os itens entram prontos.
        </div>
      ) : (
        <div style={{ border: "1px solid rgba(38,36,33,0.10)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ ...grade, padding: "7px 10px", background: "#fafafa" }}>
            <span style={cab}>Pedido</span>
            {!isMobile && <span style={cab}>Data</span>}
            {!isMobile && <span style={cab}>Vencimento</span>}
            {!isMobile && <span style={cab}>Itens</span>}
            {!isMobile && <span style={cab}>Situação</span>}
            <span style={{ ...cab, textAlign: "right" }}>Valor</span>
            {!isMobile && <span />}
          </div>
          {pedidos.slice().reverse().map((p) => {
            const cs = doPedido(p.id);
            const emAberto = cs.filter((c) => !c.pago).length;
            return (
              <div key={p.id} style={{ ...grade, padding: "7px 10px", borderTop: "1px solid rgba(38,36,33,0.06)" }}>
                <span style={{ ...cel, whiteSpace: "normal", minWidth: 0 }}>
                  <strong style={{ color: "#111827" }}>{p.numeroLoja || p.numero || "—"}</strong>
                  {p.numeroNota ? <span style={{ fontSize: 10.5, color: "#9ca3af" }}> · NF {p.numeroNota}</span> : null}
                </span>
                {!isMobile && <span style={{ ...cel, color: "#4b5563" }}>{dataBr(p.data)}</span>}
                {!isMobile && <span style={{ ...cel, color: "#4b5563" }}>{dataBr(p.vencimento)}</span>}
                {!isMobile && <span style={{ ...cel, color: "#4b5563" }}>{cs.length}</span>}
                {!isMobile && (
                  <span>{cs.length === 0 ? selo("#6b7280", "sem contas")
                    : emAberto === 0 ? selo("#15803d", "pago")
                    : emAberto === cs.length ? selo("#0474f4", "a pagar")
                    : selo("#b45309", "parcial")}</span>
                )}
                <span style={{ ...cel, textAlign: "right", fontWeight: 600, color: "#111827" }}>{dinheiro(soma(cs))}</span>
                {!isMobile && (
                  <span style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    {podeGerenciar && emAberto === cs.length && cs.length > 0 && (
                      <>
                        <button onClick={() => aoEditarPedido && aoEditarPedido(p)}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer",
                            fontFamily: "inherit", fontSize: 11.5, color: "#4b5563" }}>Editar</button>
                        <button onClick={() => aoApagarPedido && aoApagarPedido(p)}
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer",
                            fontFamily: "inherit", fontSize: 11.5, color: "#dc2626" }}>Apagar</button>
                      </>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>
        Cada pedido vira uma conta a pagar <strong style={{ color: "#4b5563" }}>por item</strong>, com a etapa de cada um —
        é o que faz o quadro da obra por etapa fechar. Quando a loja cobrar, dê a baixa em contas a pagar.
      </div>
      {podeGerenciar && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12,
          paddingTop: 10, borderTop: "1px solid rgba(38,36,33,0.08)" }}>
          <button style={{ ...E.btnSec, fontSize: 12, padding: "6px 12px" }} onClick={aoEditarConta}>Editar conta</button>
          <button style={{ ...E.btnSec, fontSize: 12, padding: "6px 12px" }} onClick={aoEncerrar}>
            {cotacao.status === "encerrada" ? "Reabrir conta" : "Encerrar conta"}
          </button>
          <button style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer",
            fontFamily: "inherit", fontSize: 12, marginLeft: "auto" }} onClick={aoApagarConta}>Apagar conta</button>
        </div>
      )}
    </>
  );
}

// ── O painel de um pedido da loja ───────────────────────────────
// Entra por três caminhos: o PDF que a loja mandou, a lista digitada à mão,
// ou os dois. O que a tela cobra é o que o P&L precisa e o papel não traz:
// a etapa de cada item. Sem ela o pedido não é lançado — é assim que o
// quadro por etapa para de encher de "Sem etapa".

// ── O catálogo visto de fora ──────────────────
// Três coisas que qualquer tela precisa para mexer no catálogo a partir de um
// papel da loja. Moram aqui soltas porque a Entrada agora abre de dois
// lugares, e a mesma regra escrita em dois componentes vira duas regras.
function insumosDoCatalogo(data) {
  return ((data || {}).materiais || []).filter((i) => i && i.ativo !== false);
}

function cadastrarInsumoNoCatalogo(data, save, campos) {
  const todos = (data || {}).materiais || [];
  const novo = novoInsumoDoPedido(campos, todos,
    (g, lista) => codigoDoGrupo(g, lista, typeof proximoCodigoInsumo === "function" ? proximoCodigoInsumo : null));
  if (!novo) return null;
  save({ ...data, materiais: [...todos, novo] });
  return novo;
}

// O texto que a loja usa vira apelido do insumo assim que a pessoa confirma
// o casamento. É o que faz o pedido do mês que vem casar sozinho, sem aposta:
// resolverInsumo acha por apelido antes de qualquer palpite.
function aprenderApelidosNoCatalogo(data, save, pares) {
  let lista = (data || {}).materiais || [];
  let mudou = false;
  for (const par of pares || []) {
    const r = comApelidoDaLoja(lista, par.codigo, par.descricao);
    lista = r.insumos;
    if (r.mudou) mudou = true;
  }
  if (mudou) save({ ...data, materiais: lista });
}

// null = ainda não perguntou. Pergunta uma vez por tela: sem a IA, anexar
// não pode virar dois envios do mesmo arquivo.
function useIaDisponivel() {
  const [disp, setDisp] = useState(null);
  useEffect(() => {
    let vivo = true;
    if (!api || !api.ia) { setDisp(false); return; }
    api.ia.status()
      .then((d) => { if (vivo) setDisp(!!(d && d.disponivel)); })
      .catch(() => { if (vivo) setDisp(false); });
    return () => { vivo = false; };
  }, []);
  return disp;
}

// ── Papéis em lote ──────────────────────────────────────────────
// A obra já está lançada; os papéis (notas, Pix, boletos) estão numa pasta.
// Aqui eles entram de uma vez: a IA lê cada um, o VICKE procura o lançamento
// pelo valor, fornecedor e data, e a pessoa confere antes de anexar. Só vão
// marcados os casamentos seguros — empate (os pedágios de 12,80) e o que não
// achou par ficam para a pessoa decidir. A leitura pode ser baixada (JSON),
// que é como se mede quanto a IA acerta.
const LOTE_SIMULTANEAS = 2;
const LOTE_POR_GRAVACAO = 8;
function loteChave(c) { return c && c.refs ? c.refs.join("+") : ""; }
function loteDiaBR(iso) { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; }

function PapeisEmLote({ obra, prestadores, isMobile, aoAnexar, aoFechar }) {
  const E = COT_ESTILO;
  const iaDisponivel = useIaDisponivel();
  const moeda = (v) => (typeof fmtMoedaCtr === "function" ? fmtMoedaCtr(v) : "R$ " + Number(v || 0).toFixed(2));
  const grupos = useMemo(() => gruposDeContasPorRef((obra || {}).contasPagar || [], prestadores || []), [obra, prestadores]);
  const gruposRef = useRef(grupos); gruposRef.current = grupos;
  const aoAnexarRef = useRef(aoAnexar); aoAnexarRef.current = aoAnexar;
  const [linhas, setLinhas] = useState([]);
  const linhasRef = useRef([]);
  const [rodando, setRodando] = useState(false);
  const [anexando, setAnexando] = useState(false);
  const [aviso, setAviso] = useState("");
  const entrada = useRef(null);
  const seq = useRef(0);
  const atualizar = (fn) => { linhasRef.current = fn(linhasRef.current); setLinhas(linhasRef.current); };
  const mudar = (id, patch) => atualizar((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const esperar = (ms) => new Promise((z) => setTimeout(z, ms));

  // O que a pessoa escolheu à mão fica; o resto se redistribui a cada leitura.
  function redistribuir() {
    atualizar((ls) => {
      const lidos = ls.map((l) => {
        if (l.estado !== "lido") return null;
        if (l.mexido) {
          const c = candidatoDe(l, l.escolha);
          return { papel: l.ficha.papel, casamento: { seguro: true, candidatos: c ? [c] : [] } };
        }
        return { papel: l.ficha.papel, casamento: l.casamento };
      });
      const d = distribuirPapeisDoLote(lidos);
      return ls.map((l, i) => (l.estado !== "lido" || l.mexido ? l
        : { ...l, escolha: d[i] && d[i].escolhido ? loteChave(d[i].escolhido) : "", marcado: !!(d[i] && d[i].marcado) }));
    });
  }

  function candidatoDe(l, chave) {
    if (!chave) return null;
    const c = ((l.casamento || {}).candidatos || []).find((x) => loteChave(x) === chave);
    if (c) return c;
    const g = gruposRef.current.find((x) => x.ref === chave);
    return g ? { refs: [g.ref], contaIds: g.contaIds, valor: g.valor, favorecido: g.favorecido, data: g.data, descricao: g.descricao, pontos: 0, motivos: ["escolhida à mão"] } : null;
  }

  function escolherArquivos(lista) {
    const novos = [...(lista || [])].map((arquivo) => ({ id: "l" + (++seq.current), arquivo, estado: "fila", erro: "",
      ficha: null, documentos: null, casamento: null, escolha: "", marcado: false, mexido: false }));
    if (novos.length) atualizar((ls) => ls.concat(novos));
  }

  async function lerUm(id) {
    const l = linhasRef.current.find((x) => x.id === id);
    if (!l) return;
    mudar(id, { estado: "lendo", erro: "" });
    try {
      const r = await api.ia.lerDocumento(l.arquivo, null, "");
      const documentos = (r && r.documentos) || [];
      const ficha = fichaDaEntradaPelaIA(documentos);
      if (!ficha) { mudar(id, { estado: "erro", erro: "A IA não achou papel de despesa aqui.", documentos }); return; }
      mudar(id, { estado: "lido", ficha, documentos, casamento: casarPapelComContas(ficha.papel, gruposRef.current) });
      redistribuir();
    } catch (e) {
      mudar(id, { estado: "erro", erro: (typeof avisoDaIA === "function" ? avisoDaIA(e) : "") || e.message || "A IA não leu." });
    }
  }

  async function lerTodos() {
    if (rodando) return;
    setRodando(true); setAviso("");
    const fila = linhasRef.current.filter((l) => l.estado === "fila" || l.estado === "erro").map((l) => l.id);
    let k = 0;
    const trabalhador = async () => { while (k < fila.length) { const id = fila[k++]; await lerUm(id); } };
    await Promise.all(Array.from({ length: LOTE_SIMULTANEAS }, trabalhador));
    setRodando(false);
  }

  function gravar(pacote) {
    const r = (aoAnexarRef.current && aoAnexarRef.current(pacote)) || {};
    const ids = new Set(pacote.map((p) => p.linhaId));
    if (r.erro) { atualizar((ls) => ls.map((l) => (ids.has(l.id) ? { ...l, erro: r.erro } : l))); return false; }
    atualizar((ls) => ls.map((l) => (ids.has(l.id) ? { ...l, estado: "anexado", marcado: false, erro: "" } : l)));
    return true;
  }

  async function anexarMarcados() {
    if (anexando) return;
    const alvo = linhasRef.current.filter((l) => l.estado === "lido" && l.marcado && l.escolha);
    if (!alvo.length) return;
    setAnexando(true); setAviso("");
    let pacote = [], feitos = 0;
    for (const l of alvo) {
      let up = null, pausas = 0;
      while (!up) {
        try {
          setAviso(`Enviando ${feitos + 1} de ${alvo.length}…`);
          up = await enviarAnexo(l.arquivo, "comprovante_pagamento");
        } catch (e) {
          if (e && e.status === 429 && pausas < 20) {
            pausas++;
            setAviso(`O servidor pediu uma pausa nos envios — retomo em 1 minuto (${feitos} de ${alvo.length} enviados). Deixe esta tela aberta.`);
            await esperar(60000);
            continue;
          }
          mudar(l.id, { erro: "O papel não subiu: " + ((e && e.message) || "erro") });
          break;
        }
      }
      if (!up) continue;
      feitos++;
      const c = candidatoDe(l, l.escolha);
      const pp = l.ficha.papel;
      pacote.push({ linhaId: l.id, contaIds: (c && c.contaIds) || [], refs: (c && c.refs) || [],
        anexo: { ...up, tipo: tipoDoAnexoDaEntrada(pp) }, chaveNota: pp.chave || "", idTransacao: pp.idTransacao || "" });
      if (pacote.length >= LOTE_POR_GRAVACAO) { gravar(pacote); pacote = []; await esperar(300); }
    }
    if (pacote.length) gravar(pacote);
    setAviso(feitos === alvo.length ? `${feitos} papel(éis) anexado(s).` : `${feitos} de ${alvo.length} anexados — veja os que ficaram com erro.`);
    setAnexando(false);
  }

  function baixarLeituras() {
    const saida = linhasRef.current.map((l) => {
      const c = candidatoDe(l, l.escolha);
      return { arquivo: (l.arquivo || {}).name || "", estado: l.estado, erro: l.erro || "",
        documentos: l.documentos || [], papel: l.ficha ? l.ficha.papel : null, avisos: l.ficha ? l.ficha.avisos : [],
        seguro: !!(l.casamento && l.casamento.seguro), empate: !!(l.casamento && l.casamento.empate),
        candidatos: ((l.casamento || {}).candidatos || []).slice(0, 4).map((x) => ({ refs: x.refs, valor: x.valor, pontos: x.pontos, motivos: x.motivos })),
        escolhido: c ? c.refs : [], marcado: !!l.marcado };
    });
    const blob = new Blob([JSON.stringify({ obra: (obra || {}).nome || "", em: new Date().toISOString(), papeis: saida }, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leituras-${String((obra || {}).nome || "obra").replace(/[^\w-]+/g, "-").toLowerCase()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  const conta = (f) => linhas.filter(f).length;
  const nFila = conta((l) => l.estado === "fila" || l.estado === "erro");
  const nLidos = conta((l) => l.estado === "lido");
  const nMarcados = conta((l) => l.estado === "lido" && l.marcado && l.escolha);
  const nAnexados = conta((l) => l.estado === "anexado");
  const nLendo = conta((l) => l.estado === "lendo");

  const situacaoDe = (l) => {
    if (l.estado === "fila") return selo("#6b7280", "Na fila");
    if (l.estado === "lendo") return selo("#0474f4", "Lendo…");
    if (l.estado === "erro") return selo("#dc2626", "Erro");
    if (l.estado === "anexado") return selo("#0474f4", "Anexado");
    if (!l.escolha) return selo("#6b7280", "Sem par");
    if (l.mexido) return selo("#0474f4", "Escolhida");
    if (l.casamento && l.casamento.seguro && l.marcado) return selo("#059669", "Seguro");
    return selo("#d97706", l.casamento && l.casamento.empate ? "Empate — confira" : "Confira");
  };

  const rotuloDoCandidato = (c) => `ref ${c.refs.join("+")} · ${c.favorecido || "—"} · ${moeda(c.valor)}${c.data ? " · " + loteDiaBR(c.data) : ""}`;
  const opcoesDe = (l) => {
    const sug = ((l.casamento || {}).candidatos || []);
    const usados = new Set(sug.map(loteChave));
    return [
      { valor: "", rotulo: "— não anexar —" },
      ...(sug.length ? [{ grupo: "Sugeridas", opcoes: sug.map((c) => ({ valor: loteChave(c), rotulo: rotuloDoCandidato(c), extra: (c.descricao || "") + " " + c.motivos.join(" ") })) }] : []),
      { grupo: "Todas as contas da obra", opcoes: grupos.filter((g) => !usados.has(g.ref)).map((g) => ({ valor: g.ref,
        rotulo: rotuloDoCandidato({ refs: [g.ref], favorecido: g.favorecido, valor: g.valor, data: g.data }) + (g.anexos ? ` · 📎${g.anexos}` : ""), extra: g.descricao })) },
    ];
  };

  const lido = (l) => {
    if (!l.ficha) return <span style={{ color: l.estado === "erro" ? "#dc2626" : "#6b7280" }}>{l.erro || (l.estado === "lendo" ? "A IA está lendo…" : "")}</span>;
    const p = l.ficha.papel;
    const nome = COT_NOME_DO_TIPO[p.tipoIA] || "papel";
    return (
      <span>
        <b style={{ color: "#111827" }}>{nome.charAt(0).toUpperCase() + nome.slice(1)}</b>
        {` · ${p.lidoComo || "?"} · ${moeda(p.valor || p.total)}`}
        {(p.pagoEm || p.vencimento || p.emitido) ? ` · ${loteDiaBR(p.pagoEm || p.vencimento || p.emitido)}` : ""}
        {(p.numeroNota || p.numeroPedido) ? ` · nº ${p.numeroNota || p.numeroPedido}` : ""}
        {l.ficha.avisos.length > 0 && <span style={{ display: "block", color: "#b45309", fontSize: 11 }}>{l.ficha.avisos[0]}</span>}
        {l.erro && <span style={{ display: "block", color: "#dc2626", fontSize: 11 }}>{l.erro}</span>}
      </span>
    );
  };

  const motivosDe = (l) => {
    const c = candidatoDe(l, l.escolha);
    return c && c.motivos && c.motivos.length ? c.motivos.join(" · ") : "";
  };

  const marcar = (l, v) => mudar(l.id, { marcado: v });
  const escolher = (l, v) => mudar(l.id, { escolha: v, mexido: true, marcado: !!v });
  const tirar = (l) => atualizar((ls) => ls.filter((x) => x.id !== l.id));
  const podeMarcar = (l) => l.estado === "lido" && !!l.escolha && !anexando;
  const COLS = "28px minmax(0,1.2fr) minmax(0,2fr) minmax(0,2.2fr) 120px";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", zIndex: 60, display: "flex", alignItems: isMobile ? "stretch" : "flex-start", justifyContent: "center", overflowY: "auto", padding: isMobile ? 0 : "32px 16px" }}>
      <div style={{ background: "#fff", borderRadius: isMobile ? 0 : 16, width: "100%", maxWidth: 1180, padding: isMobile ? 16 : 22, boxSizing: "border-box", minHeight: isMobile ? "100%" : "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Papéis em lote</div>
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>
              Notas, comprovantes e boletos de {(obra || {}).nome || "obra"}. A IA lê cada papel e procura o lançamento pelo valor, fornecedor e data — nada é anexado sem você marcar.
            </div>
          </div>
          <button style={E.btnSec} onClick={aoFechar} disabled={anexando}>Fechar</button>
        </div>

        {iaDisponivel === false && (
          <div style={{ ...E.quadro, background: "#fffbeb", borderColor: "#fcd34d", color: "#92400e", fontSize: 12.5, marginBottom: 12 }}>
            A leitura por IA não está disponível nesta conta agora — sem ela o lote não lê os papéis.
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <input ref={entrada} type="file" multiple accept="application/pdf,image/*" style={{ display: "none" }}
            onChange={(e) => { escolherArquivos(e.target.files); e.target.value = ""; }} />
          <button style={E.btnSec} onClick={() => entrada.current && entrada.current.click()} disabled={anexando}>Escolher arquivos</button>
          <button style={{ ...E.btn, background: "#0474f4", opacity: (!nFila || rodando || iaDisponivel === false) ? 0.5 : 1 }}
            disabled={!nFila || rodando || iaDisponivel === false} onClick={lerTodos}>
            {rodando ? `Lendo… (${nLidos + nAnexados} de ${linhas.length})` : `Ler com a IA${nFila ? ` (${nFila})` : ""}`}
          </button>
          <span style={{ fontSize: 12, color: "#4b5563" }}>
            {linhas.length} arquivo(s) · {nLidos + nAnexados} lido(s){nLendo ? ` · ${nLendo} lendo` : ""} · {nAnexados} anexado(s)
          </span>
        </div>
        {rodando && <div style={{ fontSize: 11.5, color: "#6b7280", marginBottom: 10 }}>Cada papel leva uns 20 a 40 segundos, dois por vez. Deixe esta tela aberta até terminar.</div>}

        {linhas.length === 0 ? (
          <div style={{ ...E.quadro, textAlign: "center", color: "#6b7280", fontSize: 12.5, padding: 28 }}>
            Escolha os arquivos (PDF ou foto) — pode ser a pasta inteira de uma vez.
          </div>
        ) : (
          <div style={{ border: "1px solid rgba(38,36,33,0.12)", borderRadius: 12 }}>
            {!isMobile && (
              <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "8px 12px", fontSize: 10.5, fontWeight: 700, color: "#6b7280", letterSpacing: 0.4, textTransform: "uppercase", borderBottom: "1px solid rgba(38,36,33,0.1)" }}>
                <span /><span>Arquivo</span><span>O que a IA leu</span><span>Lançamento</span><span>Situação</span>
              </div>
            )}
            {linhas.map((l) => {
              const caixa = (
                <input type="checkbox" checked={!!l.marcado} disabled={!podeMarcar(l)} onChange={(e) => marcar(l, e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#0474f4" }} aria-label="Anexar este papel" />
              );
              const seletor = l.estado === "lido" || l.estado === "anexado" ? (
                <div>
                  <SelectBusca style={{ ...E.input, padding: "6px 9px", fontSize: 12 }} value={l.escolha || ""} disabled={l.estado === "anexado" || anexando}
                    onChange={(v) => escolher(l, v)} placeholder="Procurar ref, fornecedor, valor…" vazio="— não anexar —" opcoes={opcoesDe(l)} />
                  {motivosDe(l) && <div style={{ fontSize: 10.5, color: "#6b7280", marginTop: 3 }}>{motivosDe(l)}</div>}
                </div>
              ) : <span />;
              const nome = (
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={(l.arquivo || {}).name}>{(l.arquivo || {}).name}</div>
                  {(l.estado === "fila" || l.estado === "erro") && !rodando && (
                    <button onClick={() => tirar(l)} style={{ background: "none", border: "none", padding: 0, color: "#6b7280", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>tirar da lista</button>
                  )}
                </div>
              );
              return isMobile ? (
                <div key={l.id} style={{ padding: 12, borderBottom: "1px solid rgba(38,36,33,0.08)" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 6 }}>
                    {caixa}
                    <div style={{ flex: 1, minWidth: 0 }}>{nome}</div>
                    {situacaoDe(l)}
                  </div>
                  <div style={{ fontSize: 12, color: "#374151", marginBottom: 8 }}>{lido(l)}</div>
                  {seletor}
                </div>
              ) : (
                <div key={l.id} style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "10px 12px", alignItems: "start", borderBottom: "1px solid rgba(38,36,33,0.08)", fontSize: 12, color: "#374151" }}>
                  <div style={{ paddingTop: 3 }}>{caixa}</div>
                  {nome}
                  <div>{lido(l)}</div>
                  {seletor}
                  <div>{situacaoDe(l)}</div>
                </div>
              );
            })}
          </div>
        )}

        {aviso && <div style={{ fontSize: 12, color: "#374151", marginTop: 10 }}>{aviso}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 14 }}>
          <button style={E.btnSec} onClick={baixarLeituras} disabled={!(nLidos + nAnexados) && !conta((l) => l.estado === "erro")}>Baixar leituras (JSON)</button>
          <button style={{ ...E.btn, opacity: (!nMarcados || anexando || rodando) ? 0.5 : 1 }} disabled={!nMarcados || anexando || rodando} onClick={anexarMarcados}>
            {anexando ? "Anexando…" : `Anexar os marcados${nMarcados ? ` (${nMarcados})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── A Entrada, pronta para pendurar em qualquer tela ────────
// A caixa em si (PainelEntrada) não conhece `data` nem `save`: recebe listas.
// Este invólucro faz a ligação, e é ele que as duas portas usam — a de dentro
// da obra e a da lista de Obras. Uma fiação só.
function EntradaDaObra({ data, save, obras, obraPadrao, usuario, isMobile, dinheiro, embutido, aoFechar, aoSeguir }) {
  const insumos = insumosDoCatalogo(data);
  const prestadores = ((data || {}).fornecedores || []).filter((f) => f && f.ativo !== false);
  const iaDisponivel = useIaDisponivel();
  const moeda = dinheiro || ((v) => (typeof fmtMoedaCtr === "function" ? fmtMoedaCtr(v) : "R$ " + Number(v || 0).toFixed(2)));

  // "Mandar para a loja" termina aqui mesmo: grava a lista na obra, registra
  // para quem foi, e devolve a mensagem para a caixa abrir as conversas.
  // Nada de navegar para outra tela — pedir preço é o caminho curto, e um
  // caminho curto que muda de tela no meio deixou de ser curto.
  function mandarDaEntrada(carga) {
    const todas = (data || {}).obras || [];
    const alvo = todas.find((o) => o && o.id === (carga.obraId || (obraPadrao || {}).id));
    if (!alvo) return { erro: "Escolha a obra." };

    // Mandar para mais uma loja é a MESMA lista indo adiante, não outra lista:
    // duas cópias da mesma cotação na obra são duas respostas de preço que
    // nunca mais se encontram.
    const jaExiste = carga.cotacaoId
      ? (alvo.cotacoes || []).find((c) => c && c.id === carga.cotacaoId) : null;

    const lista = jaExiste || carimbar({ ...cotacaoVazia(alvo.id),
      titulo: tituloDaListaRapida(carga.itens, new Date().toISOString().slice(0, 10)),
      itens: (carga.itens || []).map((it) => ({
        ...(typeof itemCotacaoVazio === "function" ? itemCotacaoVazio() : {}),
        codigo: it.insumoCodigo || "", descricao: it.descricao || "",
        unidade: it.unidade || "", quantidade: it.quantidade || "",
      })) }, usuario, true);

    const agora = new Date().toISOString();
    const quem = typeof nomeDeQuem === "function" ? nomeDeQuem(usuario) : "";
    let comEnvios = lista;
    for (const id of carga.lojaIds || []) {
      const f = prestadores.find((x) => x.id === id);
      if (f) comEnvios = registrarEnvioDaLista(comEnvios, f, quem, agora);
    }

    const cotacoesNovas = jaExiste
      ? (alvo.cotacoes || []).map((c) => (c.id === comEnvios.id ? comEnvios : c))
      : (alvo.cotacoes || []).concat([comEnvios]);
    save({ ...data, obras: todas.map((o) => (o.id === alvo.id ? { ...o, cotacoes: cotacoesNovas } : o)) });

    return {
      cotacaoId: comEnvios.id,
      obraNome: alvo.nome || "",
      mensagem: textoDaListaRapida(carga.itens, {
        obra: alvo.nome || "",
        endereco: [alvo.endereco, alvo.cidade, alvo.estado].filter(Boolean).join(", "),
      }),
    };
  }

  // A loja nova nasce com o mínimo: nome e telefone. O resto do cadastro é
  // de Prestadores de Serviços — exigir CNPJ aqui mandaria de volta para o
  // "anota num papel e cadastra depois" que esta tela veio desfazer.
  function criarLoja(campos) {
    const todos = (data || {}).fornecedores || [];
    const nome = String((campos || {}).nome || "").trim();
    if (!nome) return null;
    // Loja com esse nome já existe? É ela — cadastrar a segunda só criaria
    // dois históricos de preço para o mesmo fornecedor.
    const chave = (s) => (typeof cotSemAcento === "function" ? cotSemAcento(s) : String(s || "").toLowerCase());
    const igual = todos.find((f) => f && chave(f.nome) === chave(nome));
    if (igual) return igual;
    const nova = criarPrestadorRapido({
      nome, telefone: String((campos || {}).telefone || "").trim(),
      categoria: String((campos || {}).categoria || "").trim() || "Loja / Comércio",
    }, typeof uid === "function" ? uid() : String(Date.now()));
    if (!nova) return null;
    save({ ...data, fornecedores: todos.concat([nova]) });
    return nova;
  }

  // As contas a pagar da obra em questão — é nelas que mora a parcela de
  // contrato que o pagamento do empreiteiro pode estar quitando. Dentro da
  // obra a lista chega vazia e vale a obra padrão; fora dela, a escolhida.
  const contasDaObraDe = (id) => {
    const alvo = ((data || {}).obras || []).find((o) => o && o.id === (id || (obraPadrao || {}).id));
    return (alvo && alvo.contasPagar) || [];
  };

  const seguir = (carga) => (carga && carga.destino === "mandar")
    ? mandarDaEntrada(carga)
    : (aoSeguir ? aoSeguir(carga) : undefined);

  // Empreendimento ou obra de cliente — é o que decide a situação de partida.
  const tipoDaObra = (id) => {
    const o = ((data || {}).obras || []).find((x) => x && x.id === id);
    if (!o) return "";
    const c = ((data || {}).clientes || []).find((x) => x && x.id === o.clienteId);
    return c && typeof ehEmpreendimento === "function" && ehEmpreendimento(c) ? "empreendimento" : "cliente";
  };

  return (
    <PainelEntrada
      insumos={insumos} prestadores={prestadores} unidades={unidadesDoCatalogo(insumos)}
      iaDisponivel={!!iaDisponivel} isMobile={isMobile} dinheiro={moeda} obras={obras} embutido={embutido}
      aoCadastrarInsumo={(campos) => cadastrarInsumoNoCatalogo(data, save, campos)}
      aoCriarLoja={criarLoja}
      aoAprender={(pares) => aprenderApelidosNoCatalogo(data, save, pares)}
      aoVerContas={contasDaObraDe}
      cartoes={typeof cartoesDoEscritorio === "function" ? cartoesDoEscritorio(data) : []}
      tipoDaObra={tipoDaObra} obraPadraoId={(obraPadrao || {}).id || ""}
      aoFechar={aoFechar} aoSeguir={seguir} />
  );
}

// ── A caixa da Entrada ──────────────────────────────
// Três passos numa tela só: o material entra, a lista aparece conferida
// contra o catálogo, e aí se diz o que o papel é. Nenhum dado é gravado
// aqui — a Entrada só entrega a lista pronta para a porta escolhida.
// O reconhecimento de voz é do navegador e não existe em todos. Quando não
// existe, o botão simplesmente não aparece — melhor do que um botão que
// falha no toque.
function vozDoNavegador() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

// Os símbolos do composer. Desenhados a traço, herdando a cor de quem os
// contém — emoji muda de desenho em cada sistema e engorda a linha; linha
// fina é o que combina com uma caixa de digitar.
function IconeTraco({ children, tamanho }) {
  return (
    <svg width={tamanho || 20} height={tamanho || 20} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" style={{ display: "block" }}>
      {children}
    </svg>
  );
}

const IconeMais = ({ tamanho }) => (
  <IconeTraco tamanho={tamanho}><path d="M12 5v14" /><path d="M5 12h14" /></IconeTraco>
);

const IconeMicrofone = ({ tamanho }) => (
  <IconeTraco tamanho={tamanho}>
    <rect x="9" y="2.5" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
    <path d="M12 17.5V21" />
  </IconeTraco>
);

const IconeParar = ({ tamanho }) => (
  <IconeTraco tamanho={tamanho}><rect x="7" y="7" width="10" height="10" rx="2" /></IconeTraco>
);

const IconeSeta = ({ tamanho }) => (
  <IconeTraco tamanho={tamanho}><path d="M12 19V5" /><path d="M5.5 11.5 12 5l6.5 6.5" /></IconeTraco>
);

const IconeLupa = ({ tamanho }) => (
  <IconeTraco tamanho={tamanho}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></IconeTraco>
);

// Os botões do composer: só o símbolo, sem moldura — a moldura é a caixa.
const ENT_ICONE = {
  width: 32, height: 32, borderRadius: 999, border: "none",
  background: "transparent", color: "#5b6472", cursor: "pointer", fontFamily: "inherit",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  padding: 0, flexShrink: 0, transition: "color .15s, background .15s",
};

function BotaoDitar({ aoDitar, isMobile, compacto }) {
  const E = COT_ESTILO;
  const [ouvindo, setOuvindo] = useState(false);
  const [erro, setErro] = useState("");
  const [parcial, setParcial] = useState("");
  const ref = useRef(null);

  // Desligar ao sair: o microfone não pode continuar aberto depois que a
  // tela fechou.
  useEffect(() => () => { try { if (ref.current) ref.current.abort(); } catch (e) {} }, []);

  const Voz = vozDoNavegador();
  if (!Voz) return null;

  function parar() {
    try { if (ref.current) ref.current.stop(); } catch (e) {}
    ref.current = null; setOuvindo(false); setParcial("");
  }

  function comecar() {
    if (ouvindo) { parar(); return; }
    setErro("");
    let r;
    try { r = new Voz(); } catch (e) { setErro("Não consegui abrir o microfone."); return; }
    r.lang = "pt-BR";
    r.continuous = true;
    // Enquanto a pessoa fala, o trecho ainda por confirmar aparece em cinza:
    // é como ela sabe que está sendo ouvida.
    r.interimResults = true;
    r.onresult = (ev) => {
      let confirmado = "", andando = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) confirmado += t; else andando += t;
      }
      setParcial(andando);
      if (confirmado.trim() && aoDitar) aoDitar(confirmado);
    };
    r.onerror = (ev) => {
      const c = (ev && ev.error) || "";
      setErro(c === "not-allowed" || c === "service-not-allowed"
        ? "O navegador não deixou usar o microfone. Libere e tente de novo."
        : c === "no-speech" ? "Não ouvi nada." : "O reconhecimento de voz parou.");
      parar();
    };
    r.onend = () => { ref.current = null; setOuvindo(false); setParcial(""); };
    try { r.start(); } catch (e) { setErro("Não consegui abrir o microfone."); return; }
    ref.current = r; setOuvindo(true);
  }

  if (compacto) {
    return (
      <>
        <button type="button" onClick={comecar}
          title={ouvindo ? "Parar de ouvir" : "Ditar a lista em voz alta"}
          style={{ ...ENT_ICONE,
            color: ouvindo ? "#dc2626" : "#5b6472",
            background: ouvindo ? "#fff1f1" : "transparent" }}>
          {ouvindo ? <IconeParar /> : <IconeMicrofone />}
        </button>
        {ouvindo && (
          <span style={{ fontSize: 11.5, color: "#dc2626", minWidth: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {parcial ? "“" + parcial + "”" : "ouvindo…"}
          </span>
        )}
        {erro && !ouvindo && <span style={{ fontSize: 11.5, color: "#b45309" }}>{erro}</span>}
      </>
    );
  }

  return (
    <>
      <button type="button" onClick={comecar}
        title={ouvindo ? "Parar de ouvir" : "Ditar a lista em voz alta"}
        style={{ ...E.btnSec, fontSize: 12,
          borderColor: ouvindo ? "#dc2626" : "rgba(38,36,33,0.16)",
          color: ouvindo ? "#dc2626" : "#111827",
          background: ouvindo ? "#fff6f6" : "#fff", fontWeight: ouvindo ? 600 : 400 }}>
        {ouvindo ? "■ Parar de ditar" : "● Ditar"}
      </button>
      {ouvindo && (
        <span style={{ fontSize: 11.5, color: "#6b7280", minWidth: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {parcial ? `“${parcial}”` : "ouvindo… fale um item por vez"}
        </span>
      )}
      {erro && !ouvindo && <span style={{ fontSize: 11.5, color: "#b45309" }}>{erro}</span>}
    </>
  );
}

function PainelEntrada({ insumos, prestadores, unidades, iaDisponivel, isMobile, dinheiro,
  obras, embutido, aoCadastrarInsumo, aoCriarLoja, aoAprender, aoVerContas, aoFechar, aoSeguir, cartoes,
  tipoDaObra, obraPadraoId }) {
  const E = COT_ESTILO;
  const P = cotPainel(isMobile, 940);
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [lendo, setLendo] = useState(false);
  const [progresso, setProgresso] = useState(null);
  const [aviso, setAviso] = useState("");
  const [itens, setItens] = useState(null);
  const [destino, setDestino] = useState("");
  const [lojaId, setLojaId] = useState("");
  // Só existe quando a Entrada foi aberta fora de uma obra. A obra entra
  // DEPOIS da leitura, de propósito: a nota na mão não espera você lembrar
  // de qual obra ela é — entra tudo, e aí se diz.
  const [obraId, setObraId] = useState("");
  const [sobre, setSobre] = useState(false);
  const [focado, setFocado] = useState(false);
  // O que a própria frase já disse: { obra, loja }. Preenche os campos e fica
  // à vista — reconhecimento calado é reconhecimento em que não se confia.
  const [reconhecido, setReconhecido] = useState(null);
  // "Mandar para a loja" resolve-se AQUI: as lojas aparecem na própria caixa,
  // marcam-se, e o WhatsApp abre. Sem sair da tela, sem formulário nenhum.
  const [buscaLoja, setBuscaLoja] = useState("");
  const [lojasMarcadas, setLojasMarcadas] = useState({});
  const [fila, setFila] = useState(null);      // { lojas, i } — uma conversa por vez
  const [enviado, setEnviado] = useState(null); // { quantas, obraNome }
  // A loja que ainda não existe entra aqui, sem sair da Entrada: quem está
  // com a nota na mão não pode ser mandado para o cadastro de prestadores e
  // ter que recomeçar a leitura quando voltar.
  const [novaLoja, setNovaLoja] = useState(null);   // { nome, telefone }
  const [erroLoja, setErroLoja] = useState("");
  // O papel que não é nota: o comprovante. Não tem itens — tem quem recebeu,
  // quanto e quando. Quando ele chega, a leitura devolve isto em vez da
  // lista, e a tela toda muda de assunto.
  const [despesa, setDespesa] = useState(null);
  const [enviandoComprov, setEnviandoComprov] = useState(false);
  // A situação do lançamento e o que cada uma pede.
  const [situacao, setSituacao] = useState("");
  const situacaoTocada = useRef(false);
  const [pagamento, setPagamento] = useState({ data: "", forma: "avista", cartaoId: "", parcelas: 1 });
  const [apagar, setApagar] = useState({ vencimento: "", parcelas: "1", intervalo: "30" });
  const [parcelaId, setParcelaId] = useState("");
  // O que a leitura avisou: arquivo com dois papéis, agendamento, valor
  // pago diferente da nota. Fica no topo da tela até ler outro papel.
  const [avisosDaLeitura, setAvisosDaLeitura] = useState([]);
  // O que o papel disse no cabeçalho: número, emissão, vencimento, total, emitente.
  const [papel, setPapel] = useState(null);

  // O mesmo cadastro-relâmpago serve a loja e a empreiteiro: muda só a
  // categoria com que ele nasce, e quem abre o formulário é quem sabe dela.
  function abrirCadastroDeLoja(nome, categoria) {
    setErroLoja("");
    setNovaLoja({ nome: nome || "", telefone: "", categoria: categoria || "Loja / Comércio" });
  }

  function salvarNovaLoja() {
    const f = novaLoja || {};
    if (!String(f.nome || "").trim()) { setErroLoja("Escreva o nome."); return; }
    const criada = aoCriarLoja ? aoCriarLoja({ nome: f.nome, telefone: f.telefone, categoria: f.categoria }) : null;
    if (!criada) { setErroLoja("Não consegui cadastrar agora."); return; }
    // Já escolhido: cadastrar e ter que procurar de novo é meio passo.
    setLojaId(criada.id);
    setLojasMarcadas(function (m) { return Object.assign({}, m, { [criada.id]: true }); });
    setParcelaId("");
    setNovaLoja(null); setErroLoja(""); setAviso("");
  }
  const refTexto = useRef(null);
  // A caixa cresce com o que se escreve, até um teto: lista de trinta itens
  // não pode empurrar o botão de ler para fora da tela.
  useEffect(() => {
    const el = refTexto.current;
    if (!el) return;
    el.style.height = "auto";
    const teto = isMobile ? 260 : 340;
    el.style.height = Math.min(el.scrollHeight, teto) + "px";
    el.style.overflowY = el.scrollHeight > teto ? "auto" : "hidden";
  }, [texto, isMobile, itens]);
  const [conferindo, setConferindo] = useState(false);
  const [progressoIA, setProgressoIA] = useState(null);
  const [avisoIA, setAvisoIA] = useState("");

  const lojas = (prestadores || []).filter((f) => f && f.ativo !== false);
  const indiceCat = useMemo(() => indiceDoCatalogo(insumos || []), [insumos]);
  const mexerItem = (i, muda) => setItens((lista) => (lista || []).map((x, j) => (j === i ? { ...x, ...muda } : x)));
  // O insumo escolhido traz consigo o que ele já sabe: unidade, etapa e conta.
  // O que a pessoa já tinha posto à mão continua valendo.
  const comInsumoDaEntrada = (it, ins) => ({
    ...it,
    insumoCodigo: ins.codigo || ins.id || "",
    grupoMaterial: ins.grupo || "",
    unidade: it.unidade || ins.unidade || "",
    etapa: it.etapa || ins.etapaPadrao || "",
    contaId: it.contaId || ins.contaPadrao || "",
    sugestao: null,
  });
  const resumo = itens ? resumoDaEntrada(itens) : null;
  const podeLer = !lendo && (!!String(texto).trim() || !!arquivo);
  const pedeObra = entradaPedeObra(obras);
  const obraEfetivaId = obraId || obraPadraoId || "";
  const tipoObraEfetiva = typeof tipoDaObra === "function" ? (tipoDaObra(obraEfetivaId) || "") : "";
  const etapasDaEntrada = typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : [];
  const mexerPapel = (muda) => setPapel((p) => ({ ...(p || {}), ...muda }));
  const descontoDoPapel = papel && numeroDeCampo(papel.desconto) > 0 ? numeroDeCampo(papel.desconto) : 0;
  const somaDosItens = (itens || []).reduce((t, x) => t + brutoDoItem(x), 0);
  const totalDaEntrada = Math.round((somaDosItens - descontoDoPapel) * 100) / 100;
  const papelTotal = papel ? (numeroDeCampo(papel.total) || numeroDeCampo(papel.valor) || 0) : 0;
  const faltasDoItemDaEntrada = (it) => faltasDoItemNaEntrada(it, situacao, pagamento);
  const previaAPagar = situacao === "apagar" ? previaDosBoletos(totalDaEntrada, apagar) : [];
  const cartaoDaEntrada = (cartoes || []).find((c) => c && c.id === pagamento.cartaoId) || null;
  const previaCartao = situacao === "pago" && pagamento.forma === "cartao" && cartaoDaEntrada && typeof parcelasDoCartao === "function"
    ? parcelasDoCartao(cartaoDaEntrada, pagamento.data, totalDaEntrada, pagamento.parcelas) : [];
  // As contas da obra escolhida, para achar parcela de contrato em aberto do
  // fornecedor que acabou de receber.
  const contasDaObraEscolhida = (typeof aoVerContas === "function" ? aoVerContas(obraId) : []) || [];
  const parcelasDoFavorecido = situacao === "pago" ? parcelasEmAbertoDoPrestador(contasDaObraEscolhida, lojaId) : [];
  const parcelaSugerida = parcelaQueCasa(parcelasDoFavorecido, totalDaEntrada);
  const prova = itens
    ? entradaUnicaPronta({ situacao, prestadorId: lojaId, itens, pagamento, apagar, parcelaId }, obras, obraId)
    : { ok: false, motivo: "" };
  // A situação de partida sai da obra e do papel — e só até a pessoa tocar.
  useEffect(() => {
    if (!itens || situacaoTocada.current) return;
    setSituacao(situacaoPadraoDaEntrada(papel, tipoObraEfetiva));
  }, [itens ? 1 : 0, papel ? papel.tipo : "", tipoObraEfetiva]);
  function iniciarSituacao(p) {
    situacaoTocada.current = false;
    setParcelaId("");
    const hoje = new Date().toISOString().slice(0, 10);
    setPagamento({ data: (p && (p.pagoEm || p.emitido)) || hoje, forma: "avista", cartaoId: "", parcelas: 1 });
    setApagar({ vencimento: (p && p.vencimento) || "", parcelas: "1", intervalo: "30" });
  }
  const mexerQtdOuUnit = (i, muda) => setItens((lista) => (lista || []).map((x, j) => {
    if (j !== i) return x;
    const n = { ...x, ...muda };
    const q = numeroDeCampo(n.quantidade), u = numeroDeCampo(n.unitario);
    return q > 0 && u > 0 ? { ...n, bruto: Math.round(q * u * 100) / 100 } : n;
  }));
  const mexerTotal = (i, v) => setItens((lista) => (lista || []).map((x, j) => {
    if (j !== i) return x;
    const t = numeroDeCampo(v), q = numeroDeCampo(x.quantidade);
    return { ...x, bruto: t > 0 ? t : "", unitario: q > 0 && t > 0 ? Math.round((t / q) * 100) / 100 : x.unitario };
  }));
  const novoItemDaEntrada = () => setItens((l) => (l || []).concat([{
    ...(typeof itemDoPedidoVazio === "function" ? itemDoPedidoVazio() : {}),
    etapa: ((l || [])[0] || {}).etapa || "", contaId: ((l || [])[0] || {}).contaId || "" }]));
  // Só as contas de despesa: lançar um pagamento numa conta de receita é
  // inverter o sinal do P&L inteiro.
  const contasDeDespesa = (typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : [])
    .filter((c) => c && c.grupo !== "receitas");

  // A leitura já sabe o que cada linha é — mas proposta é proposta, e quem
  // carimba é a pessoa. O que não pode é cobrar onze toques por isso: as
  // que vieram seguras vira uma só.
  const seguros = casamentosSeguros(itens || []);
  const paraCasar = seguros.length;
  function casarOsSegurosDaEntrada() {
    const aprendidos = [];
    const podem = new Set(casamentosSeguros(itens || []));
    setItens((lista) => (lista || []).map((x, i) => {
      if (!podem.has(i)) return x;
      const ins = (insumos || []).find((y) => y && y.codigo === x.sugestao.codigo);
      if (!ins) return x;
      aprendidos.push({ codigo: ins.codigo, descricao: x.descricao });
      return comInsumoDaEntrada(x, ins);
    }));
    if (aoAprender && aprendidos.length) aoAprender(aprendidos);
  }

  // Sobra é o que ficou sem casamento E sem proposta segura. Item que já
  // tem proposta boa está a um toque — não vale gastar leitura com ele.
  const ehSobraDaEntrada = (x) => !x.insumoCodigo && !(x.sugestao && x.sugestao.segura)
    && !!String(x.descricao || "").trim();
  const sobras = (itens || []).filter(ehSobraDaEntrada);
  // E dentro das sobras, duas coisas diferentes: insumo que falta no catálogo
  // (a IA ajuda) e leitura torta do papel (a IA não tem o que achar).
  const sobrasTortas = sobras.filter((x) => descricaoSemMaterial(x.descricao));
  const sobrasUteis = sobras.filter((x) => !descricaoSemMaterial(x.descricao));
  async function conferirSobrasComIA() {
    const alvos = [];
    (itens || []).forEach((x, i) => {
      if (ehSobraDaEntrada(x) && !descricaoSemMaterial(x.descricao)) alvos.push({ i, x });
    });
    if (!alvos.length || conferindo) return;
    setConferindo(true); setAvisoIA("");
    setProgressoIA({ etapa: "fila", itens: 0, decorridoMs: 0 });
    try {
      const r = await api.ia.lerPedido(
        { arquivo: null, texto: textoParaAIA(alvos.map((a) => a.x)) },
        (pr) => setProgressoIA(pr));
      const achados = sugestoesDaIA(alvos.map((a) => a.x), r, insumos || []);
      if (!achados.length) {
        setAvisoIA("A IA tamb\u00e9m n\u00e3o achou esses itens no cat\u00e1logo.");
      } else {
        const porItem = new Map();
        for (const a of achados) porItem.set(alvos[a.indice].i, a);
        setItens((lista) => (lista || []).map((x, i) => {
          const a = porItem.get(i);
          return a ? { ...x, sugestao: { codigo: a.codigo, nome: a.nome, grupo: a.grupo,
            score: 1, segura: true, ia: true } } : x;
        }));
      }
    } catch (e) {
      setAvisoIA(avisoDaIA(e) || "A IA n\u00e3o respondeu agora.");
    } finally {
      setConferindo(false); setProgressoIA(null);
    }
  }

  const ehPdf = (f) => !!f && (/pdf$/i.test(f.name || "") || f.type === "application/pdf");

  // Escolher o arquivo JÁ é dizer "leia isto": pedir um clique a mais só para
  // confirmar o que a pessoa acabou de fazer é um passo que não decide nada.
  // Por isso `ler` recebe o arquivo pela mão — o estado ainda não mudou
  // quando o onChange dispara.
  function porArquivoDaEntrada(f) {
    if (!f) return;
    setArquivo(f); setAviso("");
    ler(f);
  }

  async function ler(arq) {
    if (lendo) return;
    const alvo = arq || arquivo;
    if (!alvo && !String(texto).trim()) { setAviso("Cole a lista ou escolha um arquivo."); return; }
    setLendo(true); setAviso(""); setProgresso(null);
    // Antes de procurar material, ouve o que a frase disse sobre obra e loja
    // — e tira esses pedaços do texto, para não virarem item fantasma.
    const ctx = contextoDaEntrada(texto, obras || [], lojas);
    const paraLer = ctx.trechos.length ? ctx.textoLimpo : texto;
    if (ctx.obra) setObraId(ctx.obra.id);
    if (ctx.loja) { setLojaId(ctx.loja.id); setLojasMarcadas({ [ctx.loja.id]: true }); }
    setReconhecido((ctx.obra || ctx.loja) ? { obra: ctx.obra, loja: ctx.loja } : null);
    try {
      // Papel com preço (PDF) tem leitor próprio, de graça e na hora: número,
      // vencimento, desconto e valor saem do papel. Só texto e foto é que
      // precisam da IA, e mesmo aí ela volta sem preço — preço é do papel.
      // Comprovante antes de tudo: é outro papel, com outra saída. Decidir
      // isto depois de tentar achar a tabela de itens só daria o erro
      // errado — "não achei a tabela" num papel que nunca teve tabela.
      // Arquivo (PDF, foto, print) vai primeiro para a IA, que lê qualquer
      // papel — 3 em cada 4 papéis de obra são imagem, e o leitor próprio
      // só lê PDF com texto. Sem IA, ou se ela falhar, o leitor próprio entra.
      if (alvo && iaDisponivel && api && api.ia && typeof api.ia.lerDocumento === "function") {
        try {
          const r = await api.ia.lerDocumento(alvo, (pr) => setProgresso(pr), String(paraLer || "").trim());
          const ficha = fichaDaEntradaPelaIA(r && r.documentos);
          if (ficha) { aplicarFichaDaIA(ficha, ctx); return; }
          setAvisosDaLeitura(["A IA não achou papel de despesa neste arquivo — tentei o leitor do VICKE."]);
        } catch (e) {
          setAvisosDaLeitura([(typeof avisoDaIA === "function" ? avisoDaIA(e) : "") || "A IA não leu agora — usei o leitor do VICKE."]);
        }
      }
      const linhasDoComprovante = ehPdf(alvo) ? await linhasDoPdf(alvo) : String(paraLer || texto || "").split("\n");
      const comp = dadosDoComprovante(linhasDoComprovante);
      if (comp) {
        abrirDespesaLida(comp, ctx);
        return;
      }
      // Nota de SERVIÇO antes de procurar tabela, pela mesma razão do
      // comprovante: ela nunca teve tabela de itens, e insistir só daria o
      // erro errado. O concreto chega assim — usinagem e bombeamento são
      // serviço, não mercadoria.
      const nfs = dadosDaNotaDeServico(linhasDoComprovante);
      if (nfs) {
        abrirDespesaLida(nfs, ctx);
        return;
      }
      if (ehPdf(alvo)) {
        let o = interpretarOrcamento(linhasDoComprovante);
        // O leitor do VICKE lê os desenhos que ele conhece, na hora e de
        // graça. Desenho novo (cada emissor de nota tem o seu), ou PDF que é
        // foto escaneada, vai para a IA — que lê qualquer papel. Os dados do
        // cabeçalho que o leitor já achou (número da nota, emissão) ficam.
        if (!(o.itens || []).length && iaDisponivel) {
          const r = await api.ia.lerOrcamento(alvo, [], (pr) => setProgresso(pr));
          const ia = orcamentoDaIA(r && r.orcamento);
          const tudo = linhasDoComprovante.map((l) => (l && l.texto) || "").join("\n");
          const nota = o.ehNota || ehDanfe(tudo);
          o = { ...o, itens: ia.itens, somaItens: ia.somaItens, total: ia.total || o.total,
            fornecedor: o.fornecedor || ia.fornecedor, cnpj: o.cnpj || ia.cnpj,
            emitido: o.emitido || ia.emitido, condicao: o.condicao || ia.condicao, ehNota: nota,
            numeroNota: nota ? (o.numeroNota || String(ia.numero || "").replace(/\D/g, "").replace(/^0+/, "")) : "",
            numeroPedido: nota ? "" : (o.numeroPedido || ia.numero || "") };
        }
        if (!(o.itens || []).length) throw new Error(iaDisponivel
          ? "Nem o leitor nem a IA acharam itens neste PDF."
          : "Não achei a tabela de itens neste PDF. Se for foto ou digitalização, cole o texto.");
        const lidos = itensDaEntrada(o, "orcamento", insumos || []);
        setItens(comContaPadraoDaEntrada(lidos, "material"));
        const novoPapel = { tipo: o.ehNota ? "nota" : "pedido",
          numeroPedido: o.numeroPedido || (o.ehNota ? "" : o.numero) || "",
          numeroNota: o.numeroNota || "", ehNota: !!o.ehNota, emitido: o.emitido || "",
          vencimento: o.vencimento || "", desconto: o.desconto || "", total: o.total || 0,
          lidoComo: o.fornecedor || "" };
        setPapel(novoPapel);
        // O emitente da nota costuma já estar no cadastro: pelo nome.
        const doPapel = !ctx.loja && o.fornecedor ? prestadorDoComprovante(prestadores || [], o.fornecedor) : null;
        if (doPapel) setLojaId(doPapel.id);
        iniciarSituacao(novoPapel);
      } else if (iaDisponivel) {
        const r = await api.ia.lerPedido({ arquivo: alvo || null, texto: paraLer || "" },
          (pr) => setProgresso(pr));
        const cru = pedidoDaIA(r, insumos || []);
        if (!cru.length) throw new Error("A IA não achou itens aí.");
        setItens(comContaPadraoDaEntrada(itensDaEntrada(promoverCandidatos(cru), "lista", insumos || []), "material"));
        setPapel(null); iniciarSituacao(null);
      } else {
        if (!String(paraLer).trim()) throw new Error("Sem a IA eu leio o texto colado e o PDF. Cole o texto da lista.");
        const cru = interpretarPedido(paraLer, insumos || []);
        if (!cru.length) throw new Error("Não achei itens no texto.");
        setItens(comContaPadraoDaEntrada(itensDaEntrada(promoverCandidatos(cru), "lista", insumos || []), "material"));
        setPapel(null); iniciarSituacao(null);
      }
    } catch (e) {
      setAviso((typeof avisoDaIA === "function" ? avisoDaIA(e) : "") || e.message || "Não consegui ler.");
    } finally {
      setLendo(false); setProgresso(null);
    }
  }


  // O comprovante lido vira o card da despesa já preenchido. Quem recebeu sai
  // de duas fontes que se completam: o nome que o banco imprimiu, casado com
  // o cadastro; e o prestador que a própria frase disse ("paguei o Zé").
  // A conta contábil fica em branco de propósito — é a única coisa que nem o
  // papel nem a frase sabem, e chutá-la é errar o P&L em silêncio.
  // A ficha da IA na tela: o fornecedor casado com o cadastro pelo nome, os
  // itens casados com o catálogo pelo mesmo caminho da nota lida aqui, e a
  // situação que o papel disse.
  function aplicarFichaDaIA(ficha, ctx) {
    const p = ficha.papel;
    const achado = (ctx && ctx.loja) || prestadorDoComprovante(prestadores || [], p.lidoComo) || null;
    const contaPadrao = (p.tipo === "nota" || p.tipo === "pedido" || p.tipo === "lista") ? "material" : "";
    const lidos = itensDaEntrada({ itens: ficha.itens }, "orcamento", insumos || []);
    setDespesa(null); setDestino("");
    setLojaId(achado ? achado.id : "");
    setPapel(p);
    setItens(comContaPadraoDaEntrada(lidos.length ? lidos : [{ ...(typeof itemDoPedidoVazio === "function" ? itemDoPedidoVazio() : {}),
      descricao: ficha.itens[0].descricao || "", bruto: ficha.itens[0].total || "" }], contaPadrao));
    setAvisosDaLeitura(ficha.avisos || []);
    iniciarSituacao(p);
  }

  function abrirDespesaLida(comp, ctx) {
    const achado = prestadorDoComprovante(prestadores || [], comp.favorecido)
      || (ctx && ctx.loja) || null;
    const valor = comp.valor ? numeroDeCampo(comp.valor) : 0;
    // O comprovante e a nota de serviço também viram itens — um só, com o
    // valor do papel. A conta contábil fica em branco de propósito: é a
    // única coisa que nem o papel nem a frase sabem.
    const p = { tipo: comp.notaDeServico ? "nfse" : "comprovante", lidoComo: comp.favorecido || "",
      documento: comp.documento || "",
      numeroNota: comp.notaDeServico ? String(comp.documento || "").replace(/\D/g, "").replace(/^0+/, "") : "",
      valor, emitido: comp.emitidoEm || "", pagoEm: comp.pagoEm || "" };
    setDespesa(null); setDestino("");
    setLojaId(achado ? achado.id : "");
    setPapel(p);
    setItens([{ ...(typeof itemDoPedidoVazio === "function" ? itemDoPedidoVazio() : {}),
      descricao: comp.descricao || "", bruto: valor || "", contaId: "" }]);
    iniciarSituacao(p);
  }


  function limpar() {
    situacaoTocada.current = false; setSituacao(""); setParcelaId(""); setAvisosDaLeitura([]);
    setTexto(""); setArquivo(null); setItens(null); setPapel(null); setDespesa(null);
    setDestino(""); setLojaId(""); setObraId(""); setAviso(""); setReconhecido(null);
    setLojasMarcadas({}); setBuscaLoja(""); setFila(null); setEnviado(null);
  }

  // As lojas com telefone, filtradas pela busca; sem telefone aparecem
  // desligadas em vez de sumirem — é assim que ele descobre o cadastro furado.
  const lojasDaLista = (lojas || []).filter((f) => {
    const q = cotSemAcento(buscaLoja);
    return !q || cotSemAcento(f.nome || "").indexOf(q) >= 0;
  });
  const marcadasIds = lojasDaLista.filter((f) => lojasMarcadas[f.id] && linkWhatsApp(f.telefone, "")).map((f) => f.id);

  // Abre uma conversa de cada vez: o navegador bloqueia várias janelas de
  // uma tacada, e o que é bloqueado some sem avisar.
  function abrirConversa(loja, msg) {
    const link = linkWhatsApp(loja.telefone, msg);
    if (!link) return false;
    if (typeof window !== "undefined") window.open(link, "_blank", "noopener");
    return true;
  }

  function mandarParaAsLojas() {
    const escolhidas = (lojas || []).filter((f) => marcadasIds.indexOf(f.id) >= 0);
    if (!escolhidas.length) { setAviso("Marque pelo menos uma loja."); return; }
    setAviso("");
    // Quem grava é quem tem os dados; aqui só se diz o que foi escolhido.
    const r = aoSeguir({ destino: "mandar", obraId, itens, papel,
      lojaIds: escolhidas.map((f) => f.id),
      cotacaoId: (enviado && enviado.cotacaoId) || "" }) || {};
    if (r.erro) { setAviso(r.erro); return; }
    abrirConversa(escolhidas[0], r.mensagem || "");
    setEnviado({ quantas: escolhidas.length, obraNome: r.obraNome || "",
      mensagem: r.mensagem || "", cotacaoId: r.cotacaoId || "" });
    setFila(escolhidas.length > 1 ? { lojas: escolhidas, i: 1 } : null);
  }

  function abrirProxima() {
    if (!fila) return;
    const loja = fila.lojas[fila.i];
    if (!loja) { setFila(null); return; }
    abrirConversa(loja, (enviado && enviado.mensagem) || "");
    setFila(fila.i + 1 < fila.lojas.length ? { ...fila, i: fila.i + 1 } : null);
  }

  // A despesa é a única saída que GRAVA de dentro da Entrada sem passar por
  // outra tela — não há formulário adiante onde anexar o comprovante, então
  // ele sobe aqui, antes de mandar. Falhar o envio não impede o lançamento:
  // o gasto é o que importa, e o papel se anexa depois na conta.
  // O papel sobe antes de lançar: não há outra tela adiante onde anexá-lo.
  // Falhar o envio não impede o lançamento — o papel se anexa depois na conta.
  async function enviarPapelDaEntrada() {
    if (!arquivo) return null;
    setEnviandoComprov(true);
    try {
      const up = await enviarComprovante(arquivo);
      return up ? { ...up, tipo: tipoDoAnexoDaEntrada(papel) } : null;
    } catch (e) {
      setAviso("O papel não subiu (" + (e.message || "erro") + ") — o lançamento segue; anexe depois na conta.");
      return null;
    } finally { setEnviandoComprov(false); }
  }

  async function seguir() {
    if (situacao === "cotacao") { mandarParaAsLojas(); return; }
    if (!prova.ok) { setAviso(prova.motivo); return; }
    const fav = (prestadores || []).find((f) => f && f.id === lojaId) || {};
    const pp = papel || {};
    const anexo = await enviarPapelDaEntrada();
    let r;
    if (situacao === "pago" && parcelaId) {
      r = aoSeguir({ destino: "despesa", obraId, despesa: {
        favorecidoId: lojaId, favorecido: fav.nome || pp.lidoComo || "", lidoComo: pp.lidoComo || "",
        valor: totalDaEntrada, pagoEm: pagamento.data, parcelaId,
        forma: pagamento.forma, cartaoId: pagamento.cartaoId, parcelas: pagamento.parcelas,
        comprovante: anexo, notaDeServico: pp.tipo === "nfse", numeroNota: pp.numeroNota || "" } }) || {};
    } else {
      const rateados = typeof itensRateados === "function"
        ? itensRateados({ itens, desconto: descontoDoPapel })
        : (itens || []).map((x) => ({ ...x, valor: brutoDoItem(x) }));
      const nomeDe = (x) => {
        const ins = x.insumoCodigo ? (insumos || []).find((y) => y && (y.codigo === x.insumoCodigo || y.id === x.insumoCodigo)) : null;
        return String(x.descricao || "").trim() || (ins && ins.nome) || "";
      };
      const lancamento = { situacao, prestadorId: lojaId, favorecido: fav.nome || pp.lidoComo || "",
        numeroNota: pp.numeroNota || pp.numeroPedido || "", emitido: pp.emitido || "",
        chaveNota: pp.chave || "", idTransacao: pp.idTransacao || "",
        itens: rateados.map((x) => ({ descricao: nomeDe(x), insumoCodigo: x.insumoCodigo || "",
          grupoMaterial: x.grupoMaterial || "", quantidade: x.quantidade, unidade: x.unidade || "",
          total: x.valor, etapa: x.etapa || "", contaId: x.contaId || "" })),
        pagamento, apagar };
      r = aoSeguir({ destino: "lancar", obraId, lancamento, anexo }) || {};
    }
    if (r.erro) { setAviso(r.erro); return; }
    if (embutido) limpar();
  }


  const cartao = { borderWidth: 1, borderStyle: "solid", borderColor: "rgba(38,36,33,0.14)",
    borderRadius: 12, padding: 12, marginBottom: 12, background: "#fff" };

  // Cadastro-relâmpago de quem ainda não existe. Serve a loja do pedido e o
  // empreiteiro da despesa — mora numa variável porque aparece nos dois
  // lugares, e escrito duas vezes viraria dois cadastros diferentes.
  const blocoCadastroRapido = (
    <CadastroRapidoDePrestador form={novaLoja} aoMudar={setNovaLoja} erro={erroLoja}
      aoSalvar={salvarNovaLoja} aoCancelar={() => { setNovaLoja(null); setErroLoja(""); }}
      isMobile={isMobile} />
  );

  // Obra e destino são as mesmas duas perguntas para qualquer papel — lista
  // de material ou comprovante de pagamento. Moram numa variável só porque
  // aparecem em dois lugares da tela, e a mesma pergunta escrita duas vezes
  // vira duas perguntas diferentes na primeira correção.
  // As lojas para a cotação: marcam-se aqui, e o WhatsApp abre com a lista.
  const blocoLojas = (
    <div>
                  <label style={E.label}>Para quais lojas</label>
                  <input style={{ ...E.input, marginBottom: 8 }} value={buscaLoja}
                    placeholder="Achar a loja pelo nome"
                    onChange={(e) => setBuscaLoja(e.target.value)} />
                  <div style={{ maxHeight: 190, overflowY: "auto", border: "1px solid rgba(38,36,33,0.12)",
                    borderRadius: 12, background: "#fff" }}>
                    {!lojasDaLista.length ? (
                      <div style={{ padding: "12px 14px", fontSize: 12.5, color: "#4b5563" }}>
                        Nenhum fornecedor com esse nome. Cadastre em Prestadores de Serviços, com o telefone.
                      </div>
                    ) : lojasDaLista.map((f) => {
                      const temZap = !!linkWhatsApp(f.telefone, "");
                      return (
                        <label key={f.id} style={{ display: "flex", alignItems: "center", gap: 10,
                          padding: "9px 12px", borderTop: "1px solid rgba(38,36,33,0.06)",
                          cursor: temZap ? "pointer" : "default", opacity: temZap ? 1 : 0.55 }}>
                          <input type="checkbox" disabled={!temZap} checked={!!lojasMarcadas[f.id] && temZap}
                            onChange={(e) => setLojasMarcadas((m) => ({ ...m, [f.id]: e.target.checked }))}
                            style={{ cursor: temZap ? "pointer" : "not-allowed" }} />
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#111827" }}>{f.nome || "Sem nome"}</span>
                            <span style={{ display: "block", fontSize: 11, color: temZap ? "#6b7280" : "#b45309" }}>
                              {temZap ? f.telefone : "sem telefone no cadastro"}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => abrirCadastroDeLoja(buscaLoja)}
                      style={{ ...E.btnSec, fontSize: 11.5, padding: "5px 12px", color: "#0474f4",
                        borderColor: "rgba(4,116,244,0.35)", fontWeight: 600 }}>
                      ＋ Cadastrar loja
                    </button>
                    <span style={{ fontSize: 11.5, color: "#6b7280" }}>
                      Cada conversa abre com a lista já escrita — quem aperta enviar é você, lá no WhatsApp.
                    </span>
                  </div>
                </div>
  );

  // Duas roupas para o mesmo conteúdo: modal, quando a Entrada é chamada de
  // dentro de uma tela que já tem assunto; e card na página, quando ela É o
  // assunto — o campo grande no alto de Obras, sempre aberto, esperando a
  // nota. Trocar a roupa não pode duplicar o miolo: é o mesmo componente.
  const fundo = embutido ? { } : P.fundo;
  const moldura = embutido
    ? { background: "#fff", border: "1px solid rgba(38,36,33,0.10)", borderRadius: 18,
        padding: isMobile ? 14 : 18, marginBottom: 18, display: "flex", flexDirection: "column",
        boxShadow: "0 1px 3px rgba(17,24,39,0.05)" }
    : P.cartao;
  const rolagem = embutido ? { } : P.rolagem;

  return (
    <div style={fundo} onClick={embutido ? undefined : aoFechar}>
      <div style={moldura} onClick={embutido ? undefined : ((e) => e.stopPropagation())}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: "#111827", marginBottom: 2 }}>Entrada</div>
        <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 12 }}>
          Nota, pedido ou lista para cotar — entra tudo por aqui. Primeiro a lista; depois você diz o que é.
        </div>

        <div style={rolagem}>
          {!itens ? (
            <>
              {/* O composer: uma caixa só, que cresce com o texto, aceita
                  arquivo arrastado ou colado, e tem a ação à direita. O campo
                  é a tela — não há formulário em volta dele para preencher. */}
              <div
                onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
                onDragLeave={() => setSobre(false)}
                onDrop={(e) => { e.preventDefault(); setSobre(false);
                  porArquivoDaEntrada((e.dataTransfer.files || [])[0]); }}
                onPaste={(e) => { const f = typeof arquivoColado === "function" ? arquivoColado(e.clipboardData) : null;
                  if (f) { e.preventDefault(); porArquivoDaEntrada(f); } }}
                style={{ border: "1.5px solid " + (sobre ? "#0474f4" : focado ? "rgba(4,116,244,0.55)" : "rgba(38,36,33,0.14)"),
                  borderRadius: 20, background: sobre ? "#f3f8ff" : "#fff", padding: isMobile ? 10 : 12,
                  transition: "border-color .15s, box-shadow .15s, background .15s",
                  boxShadow: (sobre || focado) ? "0 0 0 4px rgba(4,116,244,0.10)" : "0 1px 2px rgba(17,24,39,0.04)" }}>

                {arquivo && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 8,
                    background: "#eef5ff", border: "1px solid rgba(4,116,244,0.25)", borderRadius: 10,
                    padding: "5px 10px", fontSize: 12, color: "#111827", maxWidth: "100%" }}>
                    <span aria-hidden="true" style={{ color: "#0474f4", fontWeight: 700, fontSize: 10.5, letterSpacing: 0.4 }}>
                      {ehPdf(arquivo) ? "PDF" : "IMG"}
                    </span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{arquivo.name}</span>
                    <button type="button" onClick={() => setArquivo(null)} title="Tirar o arquivo"
                      style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer",
                        fontFamily: "inherit", fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                )}

                <textarea ref={refTexto} rows={1}
                  onFocus={() => setFocado(true)} onBlur={() => setFocado(false)}
                  onKeyDown={(e) => {
                    // Enter quebra linha — a lista tem várias. Quem manda ler é
                    // Ctrl/Cmd+Enter, como em toda caixa de conversa.
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ler(); }
                  }}
                  style={{ width: "100%", border: "none", outline: "none", background: "transparent",
                    resize: "none", overflow: "hidden", fontFamily: "inherit", fontSize: isMobile ? 16 : 14.5,
                    lineHeight: 1.5, color: "#111827", padding: "6px 6px 2px",
                    minHeight: embutido ? 84 : 120, boxSizing: "border-box" }}
                  value={texto} onChange={(e) => setTexto(e.target.value)}
                  placeholder={"Cole a lista, o pedido ou a nota… arraste um PDF ou print para dentro, ou fale."} />

                <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                  <label title="Anexar PDF, print ou foto" style={ENT_ICONE}>
                    <IconeMais />
                    <input type="file" accept="application/pdf,image/*" style={{ display: "none" }}
                      onChange={(e) => porArquivoDaEntrada((e.target.files || [])[0])} />
                  </label>
                  <BotaoDitar isMobile={isMobile} compacto
                    aoDitar={(trecho) => setTexto((t) => textoComDitado(t, trecho))} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {!iaDisponivel && (
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>
                        sem a IA: PDF e texto colado — foto e print precisam dela
                      </span>
                    )}
                  </div>
                  <button type="button" onClick={() => ler()} title="Ler (Ctrl+Enter)"
                    disabled={!podeLer}
                    style={{ width: 34, height: 34, borderRadius: 999, border: "none",
                      cursor: podeLer ? "pointer" : "default",
                      background: podeLer ? "#0474f4" : "rgba(38,36,33,0.10)",
                      color: podeLer ? "#fff" : "#9ca3af",
                      fontFamily: "inherit", fontSize: 16, lineHeight: 1, display: "flex",
                      alignItems: "center", justifyContent: "center", transition: "background .15s",
                      flexShrink: 0 }}>
                    {lendo ? <IconeParar tamanho={16} /> : <IconeSeta tamanho={18} />}
                  </button>
                </div>
              </div>
              {lendo && <div style={{ marginTop: 10 }}><BarraLeituraIA progresso={progresso} /></div>}
            </>
          ) : (
            <>
              {/* ── A tela única ──────────────────────────────────────
                  Qualquer papel cai aqui: nota, pedido, orçamento, lista,
                  comprovante, nota de serviço. Em cima o que o papel disse;
                  no meio os itens, cada um com catálogo, etapa e conta; e
                  embaixo a situação — cotação, a pagar ou pago. Lança
                  daqui mesmo, sem abrir outra tela. */}
              <div style={{ ...cartao, borderColor: "rgba(4,116,244,0.35)", background: "#f7fbff" }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0474f4", marginBottom: 4 }}>
                  {rotuloDoPapelDaEntrada(papel, itens)}
                </div>
                {avisosDaLeitura.length > 0 && (
                  <div style={{ margin: "4px 0 6px", padding: "8px 10px", borderRadius: 10, background: "#fffbeb",
                    border: "1px solid rgba(245,158,11,0.45)", display: "grid", gap: 4 }}>
                    {avisosDaLeitura.map((a, i) => <div key={i} style={{ fontSize: 11.5, color: "#92400e" }}>{a}</div>)}
                  </div>
                )}
                {papel && papel.tipo === "nfse" && (
                  <div style={{ fontSize: 11.5, color: "#4b5563", marginBottom: 4 }}>
                    A data veio da emissão da nota. Se o pagamento foi em outro dia, troque abaixo — é ela que
                    decide o mês da despesa e a fatura do cartão.
                  </div>
                )}
                <div style={{ fontSize: 11.5, color: "#4b5563" }}>
                  {[papel && papel.lidoComo ? `de “${papel.lidoComo}”` : "",
                    papel && (papel.numeroNota || papel.numeroPedido || papel.documento)
                      ? (papel.numeroNota ? "nota nº " + papel.numeroNota : (papel.numeroPedido ? "pedido " + papel.numeroPedido : papel.documento)) : "",
                    papelTotal > 0 ? dinheiro(papelTotal) : "",
                    papel && (papel.emitido || papel.pagoEm) ? "em " + dataDoDiaBR(papel.pagoEm || papel.emitido) : ""]
                    .filter(Boolean).join(" · ")}
                </div>
                {resumo && !(papel && (papel.tipo === "comprovante" || papel.tipo === "nfse"))
                  && (resumo.semNada > 0 || paraCasar > 0 || sobrasTortas.length > 0 || (sobrasUteis.length > 0 && iaDisponivel)) && (
                  <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 4 }}>
                    {[resumo.comCatalogo ? `${resumo.comCatalogo} no catálogo` : "",
                      resumo.comProposta ? `${resumo.comProposta} com proposta a confirmar` : ""].filter(Boolean).join(" · ")}
                    {resumo.semNada ? (
                      <span style={{ color: "#dc2626", fontWeight: 600 }}>
                        {resumo.comCatalogo || resumo.comProposta ? " · " : ""}{resumo.semNada} fora do catálogo
                      </span>
                    ) : null}
                  </div>
                )}
                {sobrasTortas.length > 0 && (
                  <div style={{ marginTop: 8, padding: "9px 12px", borderRadius: 10,
                    background: "#fff7ed", border: "1px solid rgba(180,83,9,0.28)" }}>
                    <div style={{ fontSize: 12, color: "#b45309", fontWeight: 600 }}>
                      {sobrasTortas.length === 1
                        ? "1 item veio sem nome de material — a leitura deste papel saiu torta"
                        : `${sobrasTortas.length} itens vieram sem nome de material — a leitura deste papel saiu torta`}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#7c2d12", marginTop: 3 }}>
                      Escolha o insumo à mão abaixo, ou cole o texto da nota em vez do arquivo.
                    </div>
                  </div>
                )}
                {(paraCasar > 0 || (sobrasUteis.length > 0 && iaDisponivel)) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 8 }}>
                    {paraCasar > 0 && (
                      <button type="button" style={{ ...E.btn, fontSize: 11.5, padding: "5px 12px" }}
                        onClick={casarOsSegurosDaEntrada}>
                        Casar {paraCasar === 1 ? "1 item" : paraCasar + " itens"} com o catálogo
                      </button>
                    )}
                    {sobrasUteis.length > 0 && iaDisponivel && (
                      <button type="button" disabled={conferindo}
                        style={{ ...E.btnSec, fontSize: 11.5, padding: "5px 12px",
                          opacity: conferindo ? 0.5 : 1, cursor: conferindo ? "progress" : "pointer" }}
                        onClick={conferirSobrasComIA}>
                        {conferindo ? "A IA está conferindo…"
                          : sobrasUteis.length === 1 ? "Perguntar à IA pelo item que sobrou"
                          : `Perguntar à IA pelos ${sobrasUteis.length} que sobraram`}
                      </button>
                    )}
                  </div>
                )}
                {conferindo && <div style={{ marginTop: 8 }}><BarraLeituraIA progresso={progressoIA} /></div>}
                {avisoIA && !conferindo && (
                  <div style={{ marginTop: 6, fontSize: 11.5, color: "#b45309" }}>{avisoIA}</div>
                )}
              </div>

              {reconhecido && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                  marginBottom: 10, padding: "8px 12px", borderRadius: 12,
                  background: "#f3f8ff", border: "1px solid rgba(4,116,244,0.22)" }}>
                  <span style={{ fontSize: 11.5, color: "#0474f4", fontWeight: 600 }}>No que você disse</span>
                  {reconhecido.obra && <span style={{ fontSize: 12, color: "#111827" }}>obra <b>{reconhecido.obra.nome}</b></span>}
                  {reconhecido.loja && <span style={{ fontSize: 12, color: "#111827" }}>loja <b>{reconhecido.loja.nome}</b></span>}
                  <span style={{ fontSize: 11.5, color: "#6b7280" }}>— já preenchi abaixo; troque se não for.</span>
                </div>
              )}

              {/* De onde e de quem */}
              <div style={cartao}>
                <div style={{ display: "grid", gap: 10,
                  gridTemplateColumns: isMobile ? "1fr" : (pedeObra ? "1.3fr 1.3fr 0.7fr 0.8fr" : "2fr 0.7fr 0.8fr") }}>
                  {pedeObra && (
                    <div style={{ minWidth: 0 }}>
                      <label style={E.label}>Obra</label>
                      <SelectBusca style={E.input} value={obraId} onChange={(v) => setObraId(v)}
                        placeholder="Procurar obra…"
                        opcoes={[{ valor: "", rotulo: "— escolha a obra —" }].concat(
                          (obras || []).map((o) => ({ valor: o.id, rotulo: o.nome, grupo: o.clienteNome || "" })))} />
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <label style={E.label}>Fornecedor</label>
                    <SelectBusca style={E.input} value={lojaId} onChange={(v) => { setLojaId(v); setParcelaId(""); }}
                      placeholder="Procurar fornecedor…" criarRotulo="cadastrar"
                      aoCriar={aoCriarLoja ? ((termo) => abrirCadastroDeLoja(termo || (papel && papel.lidoComo) || "",
                        papel && (papel.tipo === "nfse" || papel.tipo === "comprovante") ? "Empreiteiro" : "Loja / Comércio")) : undefined}
                      opcoes={[{ valor: "", rotulo: "— escolha o fornecedor —" }].concat(
                        lojas.map((f) => ({ valor: f.id, rotulo: f.nome, grupo: f.categoria || "" })))} />
                    {!lojaId && papel && papel.lidoComo && (
                      <div style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>
                        Não achei “{papel.lidoComo}” no cadastro — escolha quem é, ou “＋ cadastrar”.
                      </div>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <label style={E.label}>Nota / pedido nº</label>
                    <input style={E.input} value={(papel && (papel.numeroNota || papel.numeroPedido)) || ""}
                      onChange={(e) => mexerPapel(papel && papel.numeroPedido && !papel.numeroNota
                        ? { numeroPedido: e.target.value } : { numeroNota: e.target.value })} placeholder="—" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <label style={E.label}>Emissão</label>
                    <input type="date" style={E.input} value={(papel && papel.emitido) || ""}
                      onChange={(e) => mexerPapel({ emitido: e.target.value })} />
                  </div>
                </div>
                {blocoCadastroRapido}
              </div>

              {/* Os itens: cada um com o que a regra da transação pede. */}
              <div style={cartao}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>
                    {itens.length === 1 ? "1 item" : `${itens.length} itens`}
                  </div>
                  {itens.length > 1 && (
                    <div style={{ minWidth: isMobile ? "100%" : 240, marginLeft: isMobile ? 0 : "auto" }}>
                      <SelectBusca style={{ ...E.input, padding: "6px 10px", fontSize: 12 }} value=""
                        onChange={(v) => { if (v) setItens((l) => (l || []).map((x) => ({ ...x, etapa: v }))); }}
                        placeholder="Procurar etapa…"
                        opcoes={[{ valor: "", rotulo: "Mesma etapa para todos…" }].concat(
                          etapasDaEntrada.map((e) => ({ valor: e.id, rotulo: e.nome })))} />
                    </div>
                  )}
                </div>
                {!isMobile && (
                  <div style={{ display: "grid", gridTemplateColumns: COLS_ENTRADA, gap: 6, fontSize: 10, fontWeight: 600,
                    color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4, padding: "0 0 4px" }}>
                    <span>Item do catálogo</span><span style={{ textAlign: "right" }}>Qtd</span><span>Un</span>
                    <span style={{ textAlign: "right" }}>Unitário</span><span style={{ textAlign: "right" }}>Total</span>
                    <span>Etapa</span><span>Conta</span><span />
                  </div>
                )}
                {itens.map((it, i) => {
                  const casado = it.insumoCodigo
                    ? (insumos || []).find((y) => y && (y.codigo === it.insumoCodigo || y.id === it.insumoCodigo)) || null
                    : null;
                  const x = { id: "e" + i, termo: it.descricao || "", bruto: it.descricao || "",
                    unidade: it.unidade || "", insumo: casado,
                    rotuloVazio: casado ? "" : (it.descricao ? `Escolher do catálogo — “${it.descricao}”` : "Escolher do catálogo") };
                  const parecidos = casado || !it.descricao ? [] : casarNoCatalogo(it.descricao, indiceCat, 6).map((c) => c.insumo);
                  const faltas = faltasDoItemDaEntrada(it);
                  const mini = (t) => isMobile ? <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#6b7280", marginBottom: 2 }}>{t}</span> : null;
                  const cel = { ...E.input, padding: "6px 8px", fontSize: 12.5 };
                  return (
                    <div key={it.id || i} style={{ padding: "8px 0", borderTop: "1px solid rgba(38,36,33,0.06)" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 5 }}>
                        <input style={{ ...cel, flex: 1, minWidth: 0, background: "#fbfbfa" }} value={it.descricao || ""}
                          placeholder="O que foi (aparece no contas a pagar)"
                          onChange={(e) => mexerItem(i, { descricao: e.target.value })} />
                        {!casado && it.sugestao && (
                          <button type="button" title={"usar “" + it.sugestao.nome + "” do catálogo"}
                            style={{ border: "1px solid rgba(4,116,244,0.35)", background: "#f7fbff", color: "#0474f4",
                              borderRadius: 999, padding: "3px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                              maxWidth: isMobile ? 150 : 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            onClick={() => {
                              const ins = (insumos || []).find((y) => y && y.codigo === it.sugestao.codigo);
                              if (!ins) return;
                              mexerItem(i, comInsumoDaEntrada(it, ins));
                              if (aoAprender) aoAprender([{ codigo: ins.codigo, descricao: it.descricao }]);
                            }}>
                            {(it.sugestao.ia ? "a IA diz: " : "parece: ") + it.sugestao.nome}
                          </button>
                        )}
                      </div>
                      <div style={{ display: "grid", gap: 6, alignItems: "end",
                        gridTemplateColumns: isMobile ? "1fr 1fr" : COLS_ENTRADA }}>
                        <div style={{ minWidth: 0, gridColumn: isMobile ? "1 / -1" : "auto" }}>
                          {mini("Item do catálogo")}
                          <EscolhaInsumoPedido x={x} parecidos={parecidos} insumos={insumos} unidades={unidades}
                            aoEscolher={(ins) => mexerItem(i, comInsumoDaEntrada(it, ins))}
                            aoDeixarFora={casado ? () => mexerItem(i, { insumoCodigo: "", grupoMaterial: "", sugestao: null }) : undefined}
                            aoCadastrar={(campos) => {
                              const novo = aoCadastrarInsumo ? aoCadastrarInsumo(campos) : null;
                              if (novo) mexerItem(i, comInsumoDaEntrada(it, novo));
                              return novo;
                            }} />
                        </div>
                        <div style={{ minWidth: 0 }}>{mini("Quantidade")}
                          <input style={{ ...cel, textAlign: "right" }} inputMode="decimal" value={it.quantidade == null ? "" : it.quantidade}
                            onChange={(e) => mexerQtdOuUnit(i, { quantidade: e.target.value })} placeholder="0" /></div>
                        <div style={{ minWidth: 0 }}>{mini("Unidade")}
                          <input style={cel} value={it.unidade || ""} onChange={(e) => mexerItem(i, { unidade: e.target.value })} placeholder="un" /></div>
                        <div style={{ minWidth: 0 }}>{mini("Unitário")}
                          <CampoCtrNum tipo="moeda" style={{ ...cel, textAlign: "right" }} valor={it.unitario}
                            onChange={(v) => mexerQtdOuUnit(i, { unitario: v })} /></div>
                        <div style={{ minWidth: 0 }}>{mini("Total")}
                          <CampoCtrNum tipo="moeda" style={{ ...cel, textAlign: "right", fontWeight: 600 }} valor={brutoDoItem(it) || ""}
                            onChange={(v) => mexerTotal(i, v)} /></div>
                        <div style={{ minWidth: 0, gridColumn: isMobile ? "1 / -1" : "auto" }}>{mini("Etapa")}
                          <SelectBusca style={cel} value={it.etapa || ""} onChange={(v) => mexerItem(i, { etapa: v })}
                            placeholder="Procurar etapa…"
                            opcoes={[{ valor: "", rotulo: "— etapa —" }].concat(etapasDaEntrada.map((e) => ({ valor: e.id, rotulo: e.nome })))} /></div>
                        <div style={{ minWidth: 0, gridColumn: isMobile ? "1 / -1" : "auto" }}>{mini("Conta contábil")}
                          <SelectBusca style={cel} value={it.contaId || ""} onChange={(v) => mexerItem(i, { contaId: v })}
                            placeholder="Procurar conta…"
                            opcoes={[{ valor: "", rotulo: "— conta —" }].concat(
                              contasDeDespesa.map((c) => ({ valor: c.id, rotulo: c.nome, grupo: c.grupo || "" })))} /></div>
                        <div style={{ textAlign: isMobile ? "left" : "center", gridColumn: isMobile ? "1 / -1" : "auto" }}>
                          {itens.length > 1 && (
                            <button type="button" title="Tirar este item" onClick={() => setItens((l) => (l || []).filter((_, j) => j !== i))}
                              style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 16,
                                padding: isMobile ? "2px 0" : 0, fontFamily: "inherit" }}>{isMobile ? "× tirar item" : "×"}</button>
                          )}
                        </div>
                      </div>
                      {situacao && situacao !== "cotacao" && faltas.length > 0 && (
                        <div style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>{frasesDasFaltas(faltas)}</div>
                      )}
                    </div>
                  );
                })}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 8,
                  paddingTop: 8, borderTop: "1px solid rgba(38,36,33,0.08)" }}>
                  <button type="button" style={{ ...E.btnSec, fontSize: 12, padding: "5px 12px", color: "#0474f4",
                    borderColor: "rgba(4,116,244,0.35)", fontWeight: 600 }} onClick={novoItemDaEntrada}>＋ Item</button>
                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                      Total {dinheiro(totalDaEntrada)}
                      {descontoDoPapel > 0 ? <span style={{ fontWeight: 400, color: "#6b7280" }}> (com desconto de {dinheiro(descontoDoPapel)})</span> : null}
                    </div>
                    {papelTotal > 0 && Math.abs(papelTotal - totalDaEntrada) >= 0.01 && (
                      <div style={{ fontSize: 11.5, color: "#b45309" }}>o papel diz {dinheiro(papelTotal)} — confira os itens</div>
                    )}
                  </div>
                </div>
              </div>

              {/* A situação: é ela que decide o que o lançamento vira. */}
              <div style={cartao}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
                  Situação
                  {tipoObraEfetiva === "empreendimento" && <span style={{ fontWeight: 400, color: "#6b7280" }}> · empreendimento: entra pago, salvo se for cotação</span>}
                  {tipoObraEfetiva === "cliente" && !situacao && <span style={{ fontWeight: 400, color: "#b45309" }}> · obra de cliente: diga se já foi pago</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 8 }}>
                  {SITUACOES_DA_ENTRADA.map((s) => {
                    const on = situacao === s.id;
                    const fora = papel && papel.tipo === "comprovante" && s.id !== "pago";
                    return (
                      <button key={s.id} type="button" disabled={fora}
                        onClick={() => { situacaoTocada.current = true; setSituacao(s.id); setAviso(""); }}
                        style={{ textAlign: "left", cursor: fora ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: fora ? 0.45 : 1,
                          borderWidth: on ? 1.5 : 1, borderStyle: "solid",
                          borderColor: on ? "#0474f4" : "rgba(38,36,33,0.16)",
                          background: on ? "#eef5ff" : "#fff", borderRadius: 12, padding: "10px 12px" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: on ? "#0474f4" : "#111827" }}>{s.nome}</div>
                        <div style={{ fontSize: 11, color: "#4b5563", marginTop: 2, lineHeight: 1.35 }}>{s.resumo}</div>
                      </button>
                    );
                  })}
                </div>

                {situacao === "apagar" && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1.4fr 0.8fr 0.8fr", gap: 10, marginTop: 12 }}>
                      <div style={{ gridColumn: isMobile ? "1 / -1" : "auto" }}>
                        <label style={E.label}>{Number(apagar.parcelas) > 1 ? "1º vencimento" : "Vencimento"}</label>
                        <input type="date" style={E.input} value={apagar.vencimento || ""}
                          onChange={(e) => setApagar((a) => ({ ...a, vencimento: e.target.value }))} />
                      </div>
                      <div>
                        <label style={E.label}>Parcelas</label>
                        <input style={E.input} inputMode="numeric" value={apagar.parcelas}
                          onChange={(e) => setApagar((a) => ({ ...a, parcelas: e.target.value.replace(/\D/g, "").slice(0, 2) }))} />
                      </div>
                      <div>
                        <label style={E.label}>A cada (dias)</label>
                        <input style={{ ...E.input, opacity: Number(apagar.parcelas) > 1 ? 1 : 0.5 }} inputMode="numeric"
                          disabled={!(Number(apagar.parcelas) > 1)} value={apagar.intervalo}
                          onChange={(e) => setApagar((a) => ({ ...a, intervalo: e.target.value.replace(/\D/g, "").slice(0, 3) }))} />
                      </div>
                    </div>
                    {previaAPagar.length > 1 && (
                      <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 8, lineHeight: 1.6 }}>
                        {previaAPagar.length} boletos: <b style={{ color: "#111827" }}>
                          {previaAPagar.map((p) => dataDoDiaBR(p.vencimento) + " (" + dinheiro(p.valor) + ")").join(" · ")}</b>.
                        Cada um paga sozinho no contas a pagar.
                      </div>
                    )}
                  </>
                )}

                {situacao === "pago" && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr", gap: 10, marginTop: 12, alignItems: "end" }}>
                      <div>
                        <label style={E.label}>Data do pagamento</label>
                        <input type="date" style={E.input} value={pagamento.data || ""}
                          onChange={(e) => setPagamento((p) => ({ ...p, data: e.target.value }))} />
                      </div>
                      <div>
                        <label style={E.label}>Como foi pago</label>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {[["avista", "À vista / transferência"], ["cartao", "Cartão de crédito"]].map(([k, r]) => {
                            const on = (pagamento.forma || "avista") === k;
                            return (
                              <button key={k} type="button"
                                onClick={() => setPagamento((p) => ({ ...p, forma: k,
                                  cartaoId: k === "cartao" ? (p.cartaoId || ((cartoes || [])[0] || {}).id || "") : "",
                                  parcelas: p.parcelas || 1 }))}
                                style={{ ...E.btnSec, fontSize: 12.5, borderColor: on ? "#0474f4" : "rgba(38,36,33,0.16)",
                                  fontWeight: on ? 700 : 500, color: on ? "#111827" : "#4b5563" }}>
                                {r}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    {pagamento.forma === "cartao" && (
                      !(cartoes || []).length ? (
                        <div style={{ fontSize: 11.5, color: "#b45309", marginTop: 8 }}>
                          Nenhum cartão cadastrado. Cadastre em Escritório → Cartões.
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 10, marginTop: 10 }}>
                            <div>
                              <label style={E.label}>Cartão</label>
                              <SelectBusca style={E.input} value={pagamento.cartaoId || ""}
                                onChange={(v) => setPagamento((p) => ({ ...p, cartaoId: v }))}
                                opcoes={(cartoes || []).map((c) => ({ valor: c.id, rotulo: c.nome }))} />
                            </div>
                            <div>
                              <label style={E.label}>Parcelas</label>
                              <input style={E.input} inputMode="numeric" value={pagamento.parcelas || 1}
                                onChange={(e) => setPagamento((p) => ({ ...p, parcelas: e.target.value.replace(/\D/g, "").slice(0, 2) }))} />
                            </div>
                          </div>
                          {previaCartao.length > 0 && (
                            <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 8, lineHeight: 1.6 }}>
                              Cai {previaCartao.length === 1 ? "na fatura de " : "nas faturas de "}
                              <b style={{ color: "#111827" }}>
                                {previaCartao.map((p) => (typeof mesAnoPorExtenso === "function" ? mesAnoPorExtenso(p.competencia) : p.competencia) + " (" + dinheiro(p.valor) + ")").join(" · ")}
                              </b>. O custo da obra é integral nesta data; o escritório recebe a fatura quando você fechar.
                            </div>
                          )}
                        </>
                      )
                    )}
                    {parcelasDoFavorecido.length > 0 && (
                      <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 12,
                        border: "1px solid rgba(245,158,11,0.45)", background: "#fffbeb" }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#92400e", marginBottom: 2 }}>
                          {parcelasDoFavorecido.length === 1
                            ? "Esse fornecedor tem 1 parcela de contrato em aberto nesta obra"
                            : `Esse fornecedor tem ${parcelasDoFavorecido.length} parcelas de contrato em aberto nesta obra`}
                        </div>
                        <div style={{ fontSize: 11.5, color: "#78350f", marginBottom: 8 }}>
                          Se este pagamento é de uma delas, aponte qual: a parcela é baixada, e o contrato anda.
                        </div>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer" }}>
                          <input type="radio" name="parcela-entrada" checked={!parcelaId} onChange={() => setParcelaId("")} />
                          <span style={{ fontSize: 12.5, color: "#111827" }}>Lançamento novo, fora de contrato</span>
                        </label>
                        {parcelasDoFavorecido.map((c) => (
                          <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8,
                            padding: "6px 0", borderTop: "1px solid rgba(146,64,14,0.12)", cursor: "pointer" }}>
                            <input type="radio" name="parcela-entrada" checked={parcelaId === c.id} onChange={() => setParcelaId(c.id)} />
                            <span style={{ fontSize: 12.5, color: "#111827", minWidth: 0 }}>
                              {(c.descricao || c.servico || "Parcela")}
                              {c.parcela && !/parcela/i.test(c.descricao || "") ? ` · parcela ${c.parcela}` : ""}
                              {" · vence "}{dataDoDiaBR(c.vencimento)}{" · "}{dinheiro(numeroDeCampo(c.valor))}
                              {parcelaSugerida && parcelaSugerida.id === c.id && !parcelaId ? " — mesmo valor" : ""}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {situacao === "cotacao" && (
                  <div style={{ marginTop: 12 }}>
                    {blocoLojas}
                    {aoSeguir && (
                      <button type="button" onClick={() => { const r = aoSeguir({ destino: "cotacao", obraId, itens, papel }); if (r && r.erro) setAviso(r.erro); }}
                        style={{ background: "none", border: "none", padding: 0, marginTop: 8, color: "#0474f4", cursor: "pointer",
                          fontSize: 11.5, fontFamily: "inherit", textDecoration: "underline" }}>
                        Prefere a cotação formal (propostas lado a lado)? Abrir assim
                      </button>
                    )}
                  </div>
                )}
              </div>

              {enviado && (
                <div style={{ marginTop: 4, marginBottom: 10, padding: "10px 12px", borderRadius: 12,
                  background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <div style={{ fontSize: 12.5, color: "#15803d", fontWeight: 600 }}>
                    {fila ? `Conversa ${fila.i} de ${enviado.quantas} aberta.`
                          : `${enviado.quantas === 1 ? "Conversa aberta" : `${enviado.quantas} conversas abertas`}.`}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#4b5563", marginTop: 3 }}>
                    A lista ficou guardada{enviado.obraNome ? ` na obra ${enviado.obraNome}` : ""} — é lá que o preço
                    que a loja responder vai entrar.
                  </div>
                  {fila && (
                    <button type="button" onClick={abrirProxima} style={{ ...E.btnSec, fontSize: 12, marginTop: 8 }}>
                      Abrir a próxima — {fila.lojas[fila.i] ? fila.lojas[fila.i].nome : ""}
                    </button>
                  )}
                </div>
              )}

              {arquivo && situacao !== "cotacao" && (
                <div style={{ fontSize: 11.5, color: "#4b5563" }}>
                  {"\u{1F4CE}"} {arquivo.name} — fica anexado ao lançamento, como {rotuloDoAnexoDaEntrada(papel)}; abre pela linha da conta.
                </div>
              )}
            </>
          )}

          {aviso && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 10 }}>{aviso}</div>}
        </div>

        {/* O botão desabilitado sem dizer por quê é uma porta trancada sem
            placa. Com a regra da transação há mais o que faltar, e o que
            falta tem que estar escrito ao lado de quem vai clicar. */}
        {itens && situacao !== "cotacao" && !prova.ok && prova.motivo && (
          <div style={{ fontSize: 12, color: "#b45309", marginTop: 12, textAlign: "right" }}>{prova.motivo}</div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14, flexWrap: "wrap" }}>
          {!embutido && <button type="button" style={E.btnSec} onClick={aoFechar}>Fechar</button>}
          {itens && (
            <button type="button" style={E.btnSec}
              onClick={() => { situacaoTocada.current = false; setSituacao(""); setParcelaId(""); setAvisosDaLeitura([]);
                setItens(null); setDespesa(null); setPapel(null); setDestino(""); setObraId(""); setAviso(""); setReconhecido(null); }}>Ler de novo</button>
          )}
          {embutido && !itens && String(texto).trim() !== "" && (
            <button type="button" style={E.btnSec} onClick={limpar}>Limpar</button>
          )}
          {itens && situacao === "cotacao" ? (
            <button type="button" onClick={seguir}
              style={{ ...E.btn, opacity: marcadasIds.length ? 1 : 0.45,
                cursor: marcadasIds.length ? "pointer" : "not-allowed" }}
              disabled={!marcadasIds.length}>
              {enviado ? "Mandar de novo" : marcadasIds.length > 1 ? `Enviar para ${marcadasIds.length} lojas` : "Enviar para a loja"}
            </button>
          ) : itens ? (
            <button type="button" onClick={seguir}
              style={{ ...E.btn, opacity: prova.ok && !enviandoComprov ? 1 : 0.45,
                cursor: prova.ok && !enviandoComprov ? "pointer" : "not-allowed" }}
              disabled={!prova.ok || enviandoComprov}>
              {enviandoComprov ? "Anexando o papel…"
                : situacao === "pago" && parcelaId ? "Baixar a parcela"
                : situacao === "pago" ? `Lançar pago · ${dinheiro(totalDaEntrada)}`
                : situacao === "apagar" ? `Lançar a pagar · ${dinheiro(totalDaEntrada)}`
                : "Lançar"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PainelPedidoLoja({ cotacao, pedido, insumos, isMobile, dinheiro, editando, origem, aoMudar, aoFechar, aoLancar, aoAprender, iaDisponivel }) {
  const E = COT_ESTILO;
  const p = pedido;
  const P = cotPainel(isMobile, 980);
  const [lendo, setLendo] = useState(false);
  const [aviso, setAviso] = useState("");
  const [sobre, setSobre] = useState(false);
  const etapas = typeof ETAPAS_OBRA !== "undefined" ? ETAPAS_OBRA : [];
  const grupos = typeof GRUPOS_PL !== "undefined" ? GRUPOS_PL : [];
  const plano = typeof PLANO_CONTAS !== "undefined" ? PLANO_CONTAS : [];

  const itens = p.itens || [];
  const mexerItem = (i, muda) => aoMudar({ ...p, itens: itens.map((x, j) => (j === i ? { ...x, ...muda } : x)) });
  // O peso das palavras sai do catálogo inteiro: calcula uma vez e serve
  // para os onze itens do papel.
  const indiceCat = useMemo(() => indiceDoCatalogo(insumos || []), [insumos]);
  const opcoesCatalogo = useMemo(() => (insumos || [])
    .filter((i) => i && i.tipo !== "prestador" && i.ativo !== false)
    .map((i) => ({ valor: i.codigo, rotulo: i.nome, grupo: i.grupo || "", extra: (i.aliases || []).join(" ") })),
    [insumos]);
  const [procurando, setProcurando] = useState(-1);
  const [conferindo, setConferindo] = useState(false);
  const [progressoIA, setProgressoIA] = useState(null);
  const [avisoIA, setAvisoIA] = useState("");
  const bruto = brutoDoPedido(p);
  const total = totalDoPedido(p);
  const rateados = itensRateados(p);
  const valorDe = (i) => { const r = rateados.find((x) => x.id === itens[i].id); return r ? r.valor : 0; };
  const prova = validarPedido(p, (cotacao.pedidos || []));

  // O nome que a loja usa vira o insumo do catálogo — e o grupo do insumo é
  // o grupo de material da subconta, de graça.
  // A etapa já escolhida à mão manda: o insumo só preenche o que está vazio.
  function comInsumo(item, ins) {
    return { ...item, insumoCodigo: ins.codigo || "", grupoMaterial: ins.grupo || item.grupoMaterial || "",
      unidade: item.unidade || ins.unidade || "",
      etapa: item.etapa || ins.etapaPadrao || "",
      contaId: item.contaId || ins.contaPadrao || "",
      sugestao: null };
  }

  // Primeiro o caminho exato — código, apelido, nome igual —, que é o que
  // carimba o insumo sozinho. Só se ele não achar é que entra a aposta, e
  // aposta fica guardada como sugestão, esperando um toque.
  function casarItem(item) {
    if (typeof resolverInsumo === "function") {
      const r = resolverInsumo(item.descricao, insumos || []);
      if (r && r.insumo) return comInsumo(item, r.insumo);
    }
    const sug = sugestaoDoCatalogo(item.descricao, indiceCat);
    return { ...item, insumoCodigo: "", sugestao: sug };
  }

  function aplicarInsumo(i, codigo) {
    const ins = (insumos || []).find((x) => x && x.codigo === codigo);
    const it = itens[i];
    if (!ins || !it) return;
    mexerItem(i, comInsumo(it, ins));
    if (aoAprender) aoAprender([{ codigo: ins.codigo, descricao: it.descricao }]);
  }

  // As sobras do leitor por regras vão para a IA como texto. Ela devolve o
  // código do catálogo de cada uma — e isso entra como proposta, não como
  // carimbo. Se a IA não estiver ligada, o botão nem aparece.
  // Sobra é o que ficou sem casamento E sem proposta segura: item que já
  // tem proposta boa está a um toque, não precisa gastar leitura com ele.
  const ehSobra = (x) => !x.insumoCodigo && !(x.sugestao && x.sugestao.segura)
    && !!String(x.descricao || "").trim();
  const sobrasDaLeitura = itens.filter(ehSobra);
  // Descrição que não nomeia material é leitura torta do papel, não insumo
  // faltando: a IA não tem o que achar, e perguntar só esconde a falha real.
  const sobrasTortas = sobrasDaLeitura.filter((x) => descricaoSemMaterial(x.descricao));
  const sobrasUteis = sobrasDaLeitura.filter((x) => !descricaoSemMaterial(x.descricao));
  // Unidade da nota contra a do catálogo, item a item. Conta aqui para o
  // aviso do topo; a correção fica na linha, onde a mão está.
  const unidadesTrocadas = (typeof divergenciaDeUnidade === "function" ? itens : [])
    .map((x, i) => {
      if (!x.insumoCodigo) return null;
      const ins = (insumos || []).find((y) => y && y.codigo === x.insumoCodigo);
      const d = divergenciaDeUnidade(x.unidade, ins);
      return d ? { i, nome: (ins && ins.nome) || x.descricao, ...d } : null;
    })
    .filter(Boolean);
  function corrigirTodasAsUnidades() {
    aoMudar({ ...p, itens: itens.map((x, i) => {
      const d = unidadesTrocadas.find((u) => u.i === i);
      return d ? { ...x, unidade: d.doCatalogo } : x;
    }) });
  }
  async function conferirComIA() {
    const alvos = [];
    itens.forEach((x, i) => { if (ehSobra(x) && !descricaoSemMaterial(x.descricao)) alvos.push({ i, x }); });
    if (!alvos.length || conferindo) return;
    setConferindo(true); setAvisoIA("");
    setProgressoIA({ etapa: "fila", itens: 0, decorridoMs: 0 });
    try {
      const r = await api.ia.lerPedido(
        { arquivo: null, texto: textoParaAIA(alvos.map((a) => a.x)) },
        (pr) => setProgressoIA(pr));
      const achados = sugestoesDaIA(alvos.map((a) => a.x), r, insumos || []);
      if (!achados.length) {
        setAvisoIA("A IA tamb\u00e9m n\u00e3o achou esses itens no cat\u00e1logo.");
      } else {
        const porItem = new Map();
        for (const a of achados) porItem.set(alvos[a.indice].i, a);
        aoMudar({ ...p, itens: itens.map((x, i) => {
          const a = porItem.get(i);
          return a ? { ...x, sugestao: { codigo: a.codigo, nome: a.nome, grupo: a.grupo,
            score: 1, segura: true, ia: true } } : x;
        }) });
      }
    } catch (e) {
      setAvisoIA(avisoDaIA(e) || "A IA n\u00e3o respondeu agora.");
    } finally {
      setConferindo(false); setProgressoIA(null);
    }
  }

  // As sugestões seguras de uma vez: onze toques viram um.
  const paraCasar = casamentosSeguros(itens).length;
  function casarOsSeguros() {
    const aprendidos = [];
    const podem = new Set(casamentosSeguros(itens));
    const novos = itens.map((x, i) => {
      if (!podem.has(i)) return x;
      const ins = (insumos || []).find((y) => y && y.codigo === x.sugestao.codigo);
      if (!ins) return x;
      aprendidos.push({ codigo: ins.codigo, descricao: x.descricao });
      return comInsumo(x, ins);
    });
    aoMudar({ ...p, itens: novos });
    if (aoAprender && aprendidos.length) aoAprender(aprendidos);
  }

  async function lerPdf(arquivo) {
    if (!arquivo) return;
    setAviso(""); setLendo(true);
    try {
      const o = interpretarOrcamento(await linhasDoPdf(arquivo));
      if (!o.itens.length) throw new Error("Não achei a tabela de itens neste PDF. Se for foto ou digitalização, digite os itens.");
      aoMudar({
        ...p,
        numeroLoja: o.numeroPedido || o.numero || p.numeroLoja,
        data: o.emitido || p.data,
        vencimento: o.vencimento || p.vencimento,
        desconto: o.desconto || p.desconto || 0,
        itens: o.itens.map((it) => casarItem({
          ...itemDoPedidoVazio(),
          codigoLoja: it.codigo || "", descricao: it.descricao || "",
          quantidade: it.quantidade || "", unidade: it.unidade || "",
          unitario: it.unitario || "", bruto: it.total || "",
        })),
      });
    } catch (e) {
      setAviso(e.message || "Não consegui ler este arquivo.");
    }
    setLendo(false);
  }

  const cols = isMobile ? "1fr" : "minmax(0,3fr) 70px 58px 88px 92px minmax(0,1.5fr) minmax(0,1.5fr) 30px";
  const celStyle = { ...E.input, padding: "6px 8px", fontSize: 12 };
  // No celular cada campo do item leva o nome em cima — sem isso, "30,00" e
  // "10,00" um debaixo do outro não dizem qual é a quantidade e qual é o preço.
  const rotuloMini = { display: "block", fontSize: 10, fontWeight: 600, color: "#6b7280", marginBottom: 2 };

  return (
    <div style={P.fundo} onClick={aoFechar}>
      <div style={P.cartao} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: "#111827", marginBottom: 2 }}>
          {editando ? `Editar pedido ${p.numeroLoja || p.numero || ""}`.trim() : "Novo pedido"}
        </div>
        <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 12 }}>
          {cotacao.titulo || "Conta na loja"}
          {origem ? ` · da cotação "${origem.titulo || "sem nome"}"` : ""}
        </div>

        <div style={P.rolagem}>
          {/* ── de onde vêm os itens ── */}
          {/* Na tela do celular essa área começa ocupando um quarto do que se
              vê. Depois que o PDF foi lido ela não serve mais para nada — só
              estorva o caminho até os itens —, então vira uma linha. */}
          {(() => {
            const zonaEnxuta = isMobile && itens.length > 0 && !lendo;
            return (
              <div
                onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
                onDragLeave={() => setSobre(false)}
                onDrop={(e) => { e.preventDefault(); setSobre(false); lerPdf(e.dataTransfer.files && e.dataTransfer.files[0]); }}
                style={{ border: `1.5px dashed ${sobre ? "#0474f4" : "rgba(38,36,33,0.22)"}`, borderRadius: 12,
                  padding: zonaEnxuta ? "7px 10px" : "14px 16px", marginBottom: zonaEnxuta ? 10 : 14,
                  background: sobre ? "#eef5ff" : "#fafafa",
                  textAlign: zonaEnxuta ? "left" : "center",
                  display: zonaEnxuta ? "flex" : "block",
                  alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: zonaEnxuta ? 11.5 : 12.5, color: "#374151", flex: zonaEnxuta ? 1 : undefined }}>
                  {lendo ? "Lendo o PDF…"
                    : zonaEnxuta ? `${itens.length} ${itens.length === 1 ? "item lido" : "itens lidos"} do PDF`
                    : ehPonteiroDeToque() ? "Toque para escolher o PDF do pedido"
                    : "Arraste aqui o PDF do pedido da loja"}
                </div>
                {!zonaEnxuta && (
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>
                    número, data, vencimento e itens saem do próprio papel
                  </div>
                )}
                <label style={{ ...E.btnSec, display: "inline-block", flexShrink: 0,
                  marginTop: zonaEnxuta ? 0 : 9, fontSize: zonaEnxuta ? 11.5 : 12,
                  padding: zonaEnxuta ? "4px 10px" : undefined }}>
                  {zonaEnxuta ? "Trocar PDF" : "Escolher arquivo"}
                  <input type="file" accept="application/pdf" style={{ display: "none" }}
                    onChange={(e) => lerPdf(e.target.files && e.target.files[0])} />
                </label>
              </div>
            );
          })()}
          {aviso && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 10 }}>{aviso}</div>}

          {/* ── o cabeçalho do papel ── */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 10, marginBottom: 14 }}>
            {/* Um dos dois identifica a compra. A estrela acompanha o que
                ainda falta: com a nota preenchida, o pedido deixa de ser
                obrigatório — e vice-versa. */}
            <div>
              <label style={E.label}>
                Nº do pedido na loja{String(p.numeroNota || "").trim() ? "" : " *"}
              </label>
              <input style={E.input} value={p.numeroLoja} onChange={(e) => aoMudar({ ...p, numeroLoja: e.target.value })} placeholder="136560-109" />
            </div>
            <div>
              <label style={E.label}>
                Nº da nota fiscal{String(p.numeroLoja || "").trim() ? "" : " *"}
              </label>
              <input style={E.input} value={p.numeroNota} onChange={(e) => aoMudar({ ...p, numeroNota: e.target.value })}
                placeholder={String(p.numeroLoja || "").trim() ? "entra depois" : "8623"} />
            </div>
            <div>
              <label style={E.label}>Data</label>
              <input style={E.input} type="date" value={p.data || ""} onChange={(e) => aoMudar({ ...p, data: e.target.value })} />
            </div>
            <div>
              {/* Já pago não tem vencimento: tem o dia em que o dinheiro saiu —
                  e é esse dia que manda no mês do P&L. */}
              <label style={E.label}>{p.jaPago ? "Data do pagamento *" : "Vencimento"}</label>
              <input style={E.input} type="date" value={p.vencimento || ""} onChange={(e) => aoMudar({ ...p, vencimento: e.target.value })} />
            </div>
            <div>
              <label style={E.label}>Desconto (R$)</label>
              <CampoCtrNum tipo="moeda" valor={p.desconto} onChange={(v) => aoMudar({ ...p, desconto: v })} style={E.input} placeholder="0,00" />
            </div>
          </div>

          {/* O copia-e-cola que a loja mandou para ESTE pagamento. Sem ele,
              vale a chave PIX do cadastro dela. */}
          <div style={{ marginBottom: 14 }}>
            <label style={E.label}>PIX copia e cola desta fatura (opcional)</label>
            <input style={E.input} value={p.pixCopiaECola || ""}
              onChange={(e) => aoMudar({ ...p, pixCopiaECola: e.target.value })}
              placeholder="cole aqui o código que a loja mandou — em branco, vale a chave do cadastro" />
          </div>

          {/* ── o catálogo de uma vez só ── */}
          {(paraCasar > 0 || sobrasDaLeitura.length > 0 || conferindo || avisoIA) && itens.length > 0 && (
            <div style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 10,
              border: "1px solid rgba(4,116,244,0.30)", background: "#eef5ff" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {paraCasar > 0 && (
                  <>
                    <span style={{ fontSize: 11.5, color: "#0474f4", fontWeight: 600 }}>
                      {paraCasar === 1 ? "1 item reconhecido no catálogo" : paraCasar + " itens reconhecidos no catálogo"}
                    </span>
                    <button type="button" style={{ ...E.btn, fontSize: 11.5, padding: "5px 12px" }}
                      onClick={casarOsSeguros}>Casar com o catálogo</button>
                  </>
                )}
                {sobrasUteis.length > 0 && iaDisponivel && (
                  <button type="button" disabled={conferindo}
                    style={{ ...E.btnSec, fontSize: 11.5, padding: "5px 12px",
                      opacity: conferindo ? 0.5 : 1, cursor: conferindo ? "progress" : "pointer" }}
                    onClick={conferirComIA}>
                    {conferindo ? "A IA está conferindo…"
                      : sobrasUteis.length === 1 ? "Perguntar à IA pelo item que sobrou"
                      : `Perguntar à IA pelos ${sobrasUteis.length} que sobraram`}
                  </button>
                )}
                {paraCasar > 0 && (
                  <span style={{ fontSize: 11, color: "#4b5563" }}>
                    o nome que a loja usa fica guardado como apelido do insumo — no próximo pedido ele casa sozinho
                  </span>
                )}
              </div>
              {sobrasTortas.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11.5, color: "#b45309" }}>
                  {sobrasTortas.length === 1 ? "1 item veio" : `${sobrasTortas.length} itens vieram`} sem nome de
                  material ({sobrasTortas.slice(0, 3).map((x) => `“${x.descricao}”`).join(", ")}
                  {sobrasTortas.length > 3 ? "…" : ""}) — é a coluna errada do papel, não insumo faltando.
                  Escolha à mão ou leia o papel de novo.
                </div>
              )}
              {conferindo && <div style={{ marginTop: 8 }}><BarraLeituraIA progresso={progressoIA} /></div>}
              {avisoIA && !conferindo && (
                <div style={{ marginTop: 6, fontSize: 11.5, color: "#b45309" }}>{avisoIA}</div>
              )}
            </div>
          )}

          {unidadesTrocadas.length > 0 && (
            <div style={{ marginBottom: 10, padding: "9px 12px", borderRadius: 10,
              border: "1px solid rgba(180,83,9,0.30)", background: "#fff7ed" }}>
              <div style={{ fontSize: 12.5, color: "#b45309", fontWeight: 600 }}>
                {unidadesTrocadas.length === 1
                  ? "1 item com unidade diferente da do catálogo"
                  : `${unidadesTrocadas.length} itens com unidade diferente da do catálogo`}
              </div>
              <div style={{ fontSize: 11.5, color: "#7c2d12", marginTop: 3 }}>
                {unidadesTrocadas.slice(0, 3).map((d) => `${d.nome}: a loja pôs ${d.daLoja}, o catálogo usa ${d.doCatalogo}`).join(" · ")}
                {unidadesTrocadas.length > 3 ? " · …" : ""}. Lançar assim leva a unidade errada para a conta e para o
                quantitativo da obra.
              </div>
              <button type="button" onClick={corrigirTodasAsUnidades}
                style={{ ...E.btnSec, fontSize: 11.5, padding: "5px 12px", marginTop: 8,
                  color: "#b45309", borderColor: "rgba(180,83,9,0.35)", fontWeight: 600 }}>
                {unidadesTrocadas.length === 1 ? "Usar a unidade do catálogo" : "Usar as unidades do catálogo"}
              </button>
            </div>
          )}

          {/* ── a etapa de uma vez só, e a exceção corrigida item a item ── */}
          {itens.length > 1 && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, color: "#4b5563" }}>Pôr a mesma etapa em todos:</span>
              <SelectBusca style={{ ...celStyle, width: "auto", minWidth: 200 }} value=""
                placeholder="Procurar etapa…" vazio="— escolher —"
                onChange={(v) => { if (v) aoMudar({ ...p, itens: itens.map((x) => ({ ...x, etapa: v })) }); }}
                opcoes={etapas.map((et) => ({ valor: et.id, rotulo: et.nome, grupo: et.macro || "" }))} />
            </div>
          )}

          {/* ── os itens ── */}
          {!isMobile && itens.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: cols, gap: 6, marginBottom: 4 }}>
              <span style={E.label}>Descrição</span><span style={E.label}>Qtd</span><span style={E.label}>Un</span>
              <span style={E.label}>Unitário</span><span style={E.label}>Total</span>
              <span style={E.label}>Etapa *</span><span style={E.label}>Conta</span><span />
            </div>
          )}
          {/* No computador os itens são uma tabela com cabeçalho. No celular não
              cabe tabela, e sete campos empilhados sem nome viram adivinhação —
              então cada item vira um cartão com rótulo em cada campo. Os campos
              em si são os mesmos nos dois, só muda como se arrumam. */}
          {itens.map((it, i) => {
            const campoDescricao = (
              <input style={celStyle} value={it.descricao} placeholder="Descrição do item"
                onChange={(e) => mexerItem(i, { descricao: e.target.value })}
                // Reprocurar só quando não há escolha: antes, sair do campo
                // rodava o casamento de novo e, se o texto não batesse exato,
                // o insumo que a pessoa tinha escolhido virava "parece" — a
                // tela desfazia sozinha o trabalho dela. Para trocar existe
                // o botão "trocar".
                onBlur={() => { if (!it.insumoCodigo) mexerItem(i, casarItem(it)); }} />
            );
            const elo = { background: "none", border: "none", padding: 0, fontFamily: "inherit",
              fontSize: 10.5, color: "#6b7280", cursor: "pointer", textDecoration: "underline" };
            const linhaCatalogo = procurando === i ? (
              <div style={{ marginTop: 3 }}>
                <SelectBusca style={{ ...celStyle, fontSize: 11.5 }} value={it.insumoCodigo || ""}
                  abrirAoMontar placeholder="Procurar no catálogo…" vazio="— escolher do catálogo —"
                  opcoes={opcoesCatalogo} aoFechar={() => setProcurando(-1)}
                  onChange={(v) => { setProcurando(-1); aplicarInsumo(i, v); }} />
              </div>
            ) : (
              <div style={{ fontSize: 10.5, marginTop: 3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {it.insumoCodigo ? (
                  <>
                    <span style={{ color: "#15803d" }}>
                      {it.insumoCodigo}{it.grupoMaterial ? " · " + it.grupoMaterial : ""}
                    </span>
                    <button type="button" style={elo} onClick={() => setProcurando(i)}>trocar</button>
                  </>
                ) : it.sugestao ? (
                  <>
                    <span style={{ color: "#9ca3af" }}>{it.sugestao.ia ? "a IA diz" : "parece"}</span>
                    <button type="button" title={"usar “" + it.sugestao.nome + "” do catálogo"}
                      style={{ ...elo, color: "#0474f4", fontWeight: 600, textDecoration: "none",
                        border: "1px solid rgba(4,116,244,0.35)", borderRadius: 20, padding: "1px 8px" }}
                      onClick={() => aplicarInsumo(i, it.sugestao.codigo)}>
                      {it.sugestao.nome}
                    </button>
                    <button type="button" style={elo} onClick={() => setProcurando(i)}>outro</button>
                  </>
                ) : (
                  <>
                    <span style={{ color: "#dc2626", fontWeight: 600 }}>fora do catálogo</span>
                    <button type="button" style={elo} onClick={() => setProcurando(i)}>procurar</button>
                  </>
                )}
              </div>
            );
            const campoQtd = (
              <CampoNumeroBR estilo={celStyle} valor={it.quantidade} casas={2} placeholder="0"
                aoMudar={(v) => mexerItem(i, { quantidade: v })} />
            );
            // A unidade da nota contra a do catálogo. Avisa aqui, na linha,
            // antes de lançar — e com a correção a um clique, porque avisar
            // sem dar o caminho só empurra o trabalho para quem já está com a
            // nota na mão.
            const divUn = (typeof divergenciaDeUnidade === "function" && it.insumoCodigo)
              ? divergenciaDeUnidade(it.unidade, (insumos || []).find((x) => x && x.codigo === it.insumoCodigo))
              : null;
            const campoUnidade = (
              <div>
                <input value={it.unidade} placeholder="Unidades"
                  style={{ ...celStyle, borderColor: divUn ? "#b45309" : celStyle.borderColor,
                    background: divUn ? "#fff7ed" : celStyle.background }}
                  onChange={(e) => mexerItem(i, { unidade: e.target.value })} />
                {divUn && (
                  <div style={{ fontSize: 10.5, color: "#b45309", marginTop: 2, lineHeight: 1.3 }}>
                    catálogo: {divUn.doCatalogo}{" "}
                    <button type="button" onClick={() => mexerItem(i, { unidade: divUn.doCatalogo })}
                      style={{ background: "none", border: "none", padding: 0, color: "#b45309",
                        cursor: "pointer", fontFamily: "inherit", fontSize: 10.5,
                        textDecoration: "underline", fontWeight: 600 }}>usar</button>
                  </div>
                )}
              </div>
            );
            const campoUnitario = (
              <CampoCtrNum tipo="moeda" valor={it.unitario} style={celStyle} placeholder="0,00"
                onChange={(v) => mexerItem(i, { unitario: v })} />
            );
            const campoTotal = (
              <CampoCtrNum tipo="moeda" valor={it.bruto} style={celStyle} placeholder="0,00"
                onChange={(v) => mexerItem(i, { bruto: v })} />
            );
            const campoEtapa = (
              <SelectBusca style={{ ...celStyle, borderColor: it.etapa ? "rgba(38,36,33,0.16)" : "#dc2626" }}
                value={it.etapa || ""} onChange={(v) => mexerItem(i, { etapa: v })}
                placeholder="Procurar etapa…"
                opcoes={[{ valor: "", rotulo: "— etapa —" }].concat(
                  etapas.map((et) => ({ valor: et.id, rotulo: et.nome, grupo: et.macro || "" })))} />
            );
            const campoConta = (
              <SelectBusca style={celStyle} value={it.contaId || ""}
                onChange={(v) => mexerItem(i, { contaId: v })} placeholder="Procurar conta…"
                opcoes={[{ valor: "", rotulo: "Material (padrão)" }].concat(
                  grupos.filter((g) => g.id !== "receitas").map((g) => ({
                    grupo: g.titulo,
                    opcoes: plano.filter((c) => c.grupo === g.id).map((c) => ({ valor: c.id, rotulo: c.nome })),
                  })))} />
            );
            const botaoTirar = (
              <button type="button" title="Tirar do pedido" style={{ ...E.btnSec, padding: "5px 8px", color: "#dc2626" }}
                onClick={() => aoMudar({ ...p, itens: itens.filter((_, j) => j !== i) })}>×</button>
            );

            if (isMobile) {
              return (
                <div key={it.id} style={{ border: "1px solid rgba(38,36,33,0.14)", borderRadius: 12,
                  padding: 10, marginBottom: 8, background: "#fff" }}>
                  <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", flexShrink: 0, paddingTop: 7 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>{campoDescricao}{linhaCatalogo}</div>
                    <div style={{ flexShrink: 0 }}>{botaoTirar}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginTop: 8 }}>
                    <div><span style={rotuloMini}>Qtd</span>{campoQtd}</div>
                    <div><span style={rotuloMini}>Un</span>{campoUnidade}</div>
                    <div><span style={rotuloMini}>Unitário</span>{campoUnitario}</div>
                    <div><span style={rotuloMini}>Total</span>{campoTotal}</div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span style={Object.assign({}, rotuloMini, { color: it.etapa ? "#6b7280" : "#dc2626" })}>Etapa *</span>
                    {campoEtapa}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span style={rotuloMini}>Conta do P&amp;L</span>
                    {campoConta}
                  </div>
                </div>
              );
            }

            return (
              <div key={it.id} style={{ display: "grid", gridTemplateColumns: cols, gap: 6, marginBottom: 6, alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>{campoDescricao}{linhaCatalogo}</div>
                {campoQtd}{campoUnidade}{campoUnitario}{campoTotal}{campoEtapa}{campoConta}{botaoTirar}
              </div>
            );
          })}
          <button type="button" style={{ ...E.btnSec, fontSize: 11.5, padding: "5px 11px", marginTop: 4 }}
            onClick={() => aoMudar({ ...p, itens: [...itens, itemDoPedidoVazio()] })}>+ Item</button>

          {/* ── o fecho ── */}
          {itens.length > 0 && (
            <div style={{ marginTop: 14, padding: "10px 12px", background: "#fafafa", borderRadius: 10,
              display: "flex", gap: 18, flexWrap: "wrap", alignItems: "baseline" }}>
              <span style={{ fontSize: 12, color: "#4b5563" }}>Tabela <strong style={{ color: "#111827" }}>{dinheiro(bruto)}</strong></span>
              {Math.abs(bruto - total) >= 0.005 && (
                <span style={{ fontSize: 12, color: "#4b5563" }}>Desconto <strong style={{ color: "#111827" }}>{dinheiro(bruto - total)}</strong></span>
              )}
              <span style={{ fontSize: 13, color: "#111827", fontWeight: 700 }}>A pagar {dinheiro(total)}</span>
              {Math.abs(bruto - total) >= 0.005 && (
                <span style={{ fontSize: 11, color: "#6b7280" }}>
                  o desconto é repartido pelos itens — a soma deles fecha no centavo com o que você paga
                </span>
              )}
            </div>
          )}

          {prova.erros.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#dc2626" }}>
              {prova.erros.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
          <button style={E.btnSec} onClick={aoFechar}>Cancelar</button>
          <button style={{ ...E.btn, opacity: prova.ok ? 1 : 0.45, cursor: prova.ok ? "pointer" : "not-allowed" }}
            disabled={!prova.ok} onClick={() => aoLancar(p)}>
            {editando ? "Regravar o pedido" : p.jaPago ? "Lançar já pago" : "Lançar em contas a pagar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CampoUnidade({ valor, unidades, aoMudar, estilo }) {
  const E = COT_ESTILO;
  const lista = opcoesDeUnidade(valor, unidades);
  // Dado velho gravado como "un" aparece já como "Unidades" e se conserta na
  // próxima gravação — sem um efeito que mexa no formulário sozinho.
  const padrao = unidadeNoPadrao(valor, unidades || []);
  return (
    <SelectBusca style={estilo || E.input} value={padrao} onChange={(v) => aoMudar(unidadeNoPadrao(v, unidades || []))}
      placeholder="Procurar unidade…"
      opcoes={[{ valor: "", rotulo: "—" }].concat(lista.map(function (u) {
        return { valor: u, rotulo: u };
      }))} />
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
              // o pedido leva o preço que vai ser pago — com o desconto de
              // fechamento já distribuído
              const u = proposta ? precoEfetivo(cot, proposta, it) : 0;
              return (
                <tr key={it.id}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>{it.descricao || "—"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{q > 0 ? qtdBR(q) : "—"}</td>
                  <td style={td}>{it.unidade || "—"}</td>
                  {proposta ? <td style={{ ...td, textAlign: "right" }}>{u > 0 ? fmtMoedaCtr(u) : "—"}</td> : null}
                  {proposta ? <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{u > 0 ? fmtMoedaCtr(totalEfetivoItem(cot, proposta, it)) : "—"}</td> : null}
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
// No celular não existe arrastar nem Ctrl+V — existe tocar. Quem decide a
// frase é o ponteiro, não a largura da tela: um tablet largo também é dedo.
function ehPonteiroDeToque() {
  try {
    return typeof window !== "undefined" && !!window.matchMedia
      && window.matchMedia("(hover: none)").matches;
  } catch (e) { return false; }
}

// ── Cadastro-relâmpago de quem ainda não existe ────────────────
// A loja do pedido e o empreiteiro da despesa entram pelo mesmo formulário,
// de dois lugares diferentes: a Entrada e o lançamento do escritório. Mora
// num componente só porque escrito duas vezes viraria dois cadastros com
// regras diferentes na primeira correção.
function CadastroRapidoDePrestador({ form, aoMudar, erro, aoSalvar, aoCancelar, isMobile }) {
  const E = COT_ESTILO;
  if (!form) return null;
  const mexer = (campo, valor) => aoMudar(Object.assign({}, form, { [campo]: valor }));
  const noEnter = (e) => { if (e.key === "Enter") { e.preventDefault(); aoSalvar(); } };
  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: 12,
      border: "1.5px solid #0474f4", background: "#f7fbff" }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0474f4", marginBottom: 8 }}>
        Cadastrar {form.categoria === "Loja / Comércio" ? "loja" : "prestador"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 200px", gap: 10 }}>
        <div>
          <label style={E.label}>Nome *</label>
          <input style={E.input} autoFocus value={form.nome || ""}
            onChange={(e) => mexer("nome", e.target.value)} onKeyDown={noEnter}
            placeholder="ART GLASS vidros e esquadrias" />
        </div>
        <div>
          <label style={E.label}>WhatsApp</label>
          <input style={E.input} value={form.telefone || ""}
            onChange={(e) => mexer("telefone", e.target.value)} onKeyDown={noEnter}
            placeholder="(14) 99999-9999" />
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <label style={E.label}>Categoria</label>
        <SelectBusca style={E.input} value={form.categoria}
          onChange={(v) => mexer("categoria", v)}
          placeholder="Procurar categoria…"
          opcoes={(typeof CATEGORIAS_PRESTADOR !== "undefined" ? CATEGORIAS_PRESTADOR : ["Loja / Comércio"])
            .map((c) => ({ valor: c, rotulo: c }))} />
      </div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
        Só o nome é obrigatório. Sem telefone, o cadastro existe mas não recebe a lista
        pelo WhatsApp — o resto se completa depois em Prestadores de Serviços.
      </div>
      {erro && <div style={{ fontSize: 11.5, color: "#dc2626", marginTop: 6 }}>{erro}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button type="button" style={{ ...E.btn, fontSize: 12, padding: "6px 14px" }}
          onClick={aoSalvar}>Cadastrar e usar</button>
        <button type="button" style={{ ...E.btnSec, fontSize: 12, padding: "6px 14px" }}
          onClick={aoCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

// ── Os papéis de uma transação ─────────────────────────────────
// Nota fiscal, comprovante, boleto: uma lista, não um campo só. Para
// prestação de contas o que importa é que TUDO que sustenta o lançamento
// esteja pendurado no mesmo número — e nunca se sabe de antemão se vão ser
// um papel ou três.
//
// Cada linha é o mesmo CampoAnexoProposta de sempre, com o arquivo dentro;
// a última é ele vazio, esperando mais um. Nada de componente novo para
// anexar: anexar já tinha dono.
function CampoDocumentos({ anexos, aoMudar, onErro, categoria, aoLerPdf, lendo, progresso }) {
  const lista = (anexos || []).filter(Boolean);
  const trocar = (i, novo) => {
    const nova = lista.slice();
    if (novo) nova[i] = novo; else nova.splice(i, 1);
    aoMudar(nova);
  };
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {lista.map((a, i) => (
        <CampoAnexoProposta key={(a && (a.public_id || a.url)) || i}
          anexo={a} categoria={categoria}
          onTrocar={(novo) => trocar(i, novo)} onErro={onErro} />
      ))}
      <CampoAnexoProposta
        anexo={null} categoria={categoria}
        lendo={lendo} progresso={progresso}
        aoLerPdf={aoLerPdf}
        chamada={lista.length ? "Arraste mais um documento" : "Arraste a nota ou o comprovante aqui"}
        apoio={lista.length
          ? "nota fiscal, comprovante, boleto — tudo que sustenta este lançamento"
          : "cole o print com Ctrl+V, arraste o arquivo ou clique para escolher — do PDF eu leio valor, data e quem recebeu"}
        chamadaToque={lista.length ? "Toque para anexar mais um" : "Toque para anexar a nota ou o comprovante"}
        apoioToque="tire a foto do papel, escolha da galeria ou pegue o PDF do banco"
        onTrocar={(novo) => { if (novo) aoMudar(lista.concat([novo])); }}
        onErro={onErro} />
    </div>
  );
}

function CampoAnexoProposta({ anexo, onTrocar, onErro, categoria, chamada, chamadaToque, apoio, apoioToque, aoLerPdf, lendo, leFoto, progresso }) {
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
    try {
      onTrocar(await enviarAnexo(arquivo, categoria || "proposta_cotacao"));
      // O arquivo que a loja mandou é a proposta E a fonte dos preços — um
      // campo só. A leitura usa o arquivo daqui, que já está na mão: não
      // baixa de volta do storage nem manda para lugar nenhum.
      const ehPdf = /pdf$/i.test(arquivo.type || "") || /\.pdf$/i.test(arquivo.name || "");
      const ehFoto = /^image\//i.test(arquivo.type || "");
      if ((ehPdf || (ehFoto && leFoto)) && typeof aoLerPdf === "function") await aoLerPdf(arquivo);
    }
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
        {lendo && !progresso && <div style={{ fontSize: 11.5, color: "#0474f4", fontWeight: 600 }}>lendo os preços…</div>}
        <button type="button" style={E.btnSec} onClick={() => setVendo(true)}>Abrir</button>
        <button style={E.btnSec} onClick={remover}>Remover</button>
        {lendo && progresso && (
          <div style={{ flexBasis: "100%" }}><BarraLeituraIA progresso={progresso} /></div>
        )}
        {vendo && <VisorProposta anexo={anexo} aoFechar={() => setVendo(false)} />}
      </div>
    );
  }

  const toque = ehPonteiroDeToque();
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
        {enviando
          ? (lendo ? "Lendo os preços…" : "Enviando…")
          : (toque ? (chamadaToque || "Toque para anexar") : (chamada || "Arraste o PDF da proposta aqui"))}
      </div>
      <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 3 }}>
        {toque
          ? (apoioToque || "tire a foto na hora, escolha da galeria ou pegue um arquivo — até 10 MB")
          : (apoio || "clique para escolher, ou cole com Ctrl+V — PDF ou foto, até 10 MB")}
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
