// ═══════════════════════════════════════════════════════════════
// CONTRATOS DE OBRA — gerador e documento
// ═══════════════════════════════════════════════════════════════
// Dois modelos, tirados dos contratos reais do escritório:
//
//   empreitadaMaoDeObra — empreitada de mão de obra: o material é do
//     CONTRATANTE, o preço remunera só a mão de obra, o pagamento é em
//     parcelas quinzenais e a última fica retida como garantia. O escopo
//     detalhado vai num ANEXO I.
//   empreitadaGlobal — empreitada global com fornecimento: a CONTRATADA
//     fornece material, fabricação, transporte e montagem; o objeto é uma
//     tabela de itens com valor cada e o pagamento é 50% na liberação do
//     item para produção e 50% na conclusão daquele item.
//
// O CONTRATANTE é sempre o cliente da obra (é ele quem contrata o
// prestador; o escritório redige). O CONTRATADO vem do cadastro de
// Prestadores (data.fornecedores), que já guarda CNPJ/CPF, endereço,
// representante e CPF do representante.
//
// O contrato gerado fica dentro da obra (obra.contratos), com o valor, o
// status e os campos — o documento é remontado na hora de exibir, então
// corrigir um dado do cliente ou do prestador atualiza o contrato. Ele mora
// na obra porque é a obra que o backend grava como documento JSON; a coleção
// data.contratos não é persistida.

const CONTRATO_MODELOS = [
  {
    id: "empreitadaMaoDeObra",
    nome: "Empreitada de mão de obra",
    subtitulo: "Empreitada de mão de obra — obra civil",
    resumo: "O material é fornecido pelo contratante; o preço remunera só a mão de obra. Parcelas quinzenais, com a última retida até o aceite final.",
    generoContratado: "o CONTRATADO",
    padrao: {
      prazoMeses: 6, garantiaMeses: 6, toleranciaDias: 45, multaDiaPct: 0.5, multaTetoPct: 10,
      parcelas: 12, periodicidade: "quinzenais", retemUltima: true,
      materialPorContaDo: "contratante",
    },
  },
  {
    id: "empreitadaGlobal",
    nome: "Empreitada global (com fornecimento)",
    subtitulo: "Fornecimento e montagem",
    resumo: "A contratada fornece material, fabricação, transporte e montagem. Objeto em itens com valor cada; pagamento 50% na liberação e 50% na conclusão de cada item.",
    generoContratado: "a CONTRATADA",
    padrao: {
      prazoDias: 120, garantiaMeses: 12, toleranciaDias: 45, multaDiaPct: 0.5, multaTetoPct: 10,
      entradaPct: 50, materialPorContaDo: "contratado",
    },
  },
  {
    id: "gerenciamentoObra",
    nome: "Gerenciamento de obra",
    subtitulo: "Gerenciamento de obra",
    resumo: "O escritório gerencia: compra de materiais, contratação de prestadores, locação de equipamentos e prestação de contas. Tudo em nome do contratante.",
    generoContratado: "a CONTRATADA",
    titulo: "CONTRATO DE GERENCIAMENTO DE OBRA",
    numeracao: "simples",      // "1 OBJETO DO CONTRATO", e não "CLÁUSULA PRIMEIRA"
    preambuloSimples: true,    // as partes abrem o documento, sem "pelo presente instrumento"
    fechoProprio: true,        // a última cláusula já é o fecho com o foro
    padrao: {
      parcelas: 12, periodicidade: "mensais", diaVencimento: 5,
      multaInadimplenciaPct: 20, jurosMesPct: 1, honorariosPct: 20, diasInterrupcao: 90,
      garantiaMeses: 0, toleranciaDias: 0, multaDiaPct: 0, multaTetoPct: 0,
      materialPorContaDo: "contratante",
    },
  },
];
function contratoModelo(id) { return CONTRATO_MODELOS.find((m) => m.id === id) || CONTRATO_MODELOS[0]; }

// ── Tipos de profissional ───────────────────────────────────────
// A primeira escolha do gerador. A lista, em ordem alfabética, espelha os
// prestadores de serviço do catálogo de insumos (grupo "Prestadores de
// serviços") — é por eles que a obra é orçada, então é por eles que ela é
// contratada.
// Cada tipo carrega:
//   categorias — como o prestador aparece no cadastro (fornecedor.categoria),
//                usado para filtrar a lista de contratados;
//   modelo     — o regime que costuma valer para aquele ofício;
//   objeto     — o subtítulo/objeto já escrito, ainda editável;
//   insumos    — os códigos do catálogo, só para rastreabilidade.
const TIPOS_PROFISSIONAL = [
  { id: "carpinteiro", nome: "Carpinteiro", categorias: ["Carpinteiro"], servico: "carpintaria e formas", modelo: "empreitadaMaoDeObra", insumos: ["PRE-005"] },
  { id: "eletricista", nome: "Eletricista", categorias: ["Eletricista"], servico: "instalações elétricas", modelo: "empreitadaMaoDeObra", insumos: ["PRE-003"] },
  { id: "empreiteiro", nome: "Empreiteiro", categorias: ["Empreiteiro", "Pedreiro"], servico: "obra civil", modelo: "empreitadaMaoDeObra", insumos: ["PRE-001", "PRE-009", "PRE-010", "PRE-011", "PRE-012"] },
  { id: "encanador", nome: "Encanador", categorias: ["Encanador"], servico: "instalações hidrossanitárias", modelo: "empreitadaMaoDeObra", insumos: ["PRE-004"] },
  { id: "gesseiro", nome: "Gesseiro", categorias: ["Gesseiro"], servico: "forro e revestimento em gesso", modelo: "empreitadaGlobal", insumos: [] },
  { id: "gestaoObra", nome: "Gestão de obra", categorias: ["Gestão de Obra"], servico: "gerenciamento de obra",
    modelo: "gerenciamentoObra", modeloFixo: "gerenciamentoObra", insumos: ["PRE-017"] },
  { id: "impermeabilizador", nome: "Impermeabilizador", categorias: ["Impermeabilizador"], servico: "impermeabilização", modelo: "empreitadaGlobal", insumos: ["PRE-006"] },
  { id: "instaladorAquecedores", nome: "Instalador de aquecedores", categorias: ["Instalador de Aquecedores"], servico: "instalação de aquecedores", modelo: "empreitadaGlobal", insumos: ["PRE-014"] },
  { id: "instaladorAr", nome: "Instalador de ar condicionado", categorias: ["Instalador de Ar Condicionado"], servico: "instalação de ar condicionado", modelo: "empreitadaGlobal", insumos: ["PRE-013"] },
  { id: "equipPiscina", nome: "Instalador de equipamentos de piscina", categorias: ["Instalador de Equipamentos de Piscina"], servico: "instalação de equipamentos de piscina", modelo: "empreitadaGlobal", insumos: ["PRE-015"] },
  { id: "marceneiro", nome: "Marceneiro", categorias: ["Marceneiro"], servico: "marcenaria", modelo: "empreitadaGlobal", insumos: ["PRE-007"] },
  { id: "pintor", nome: "Pintor", categorias: ["Pintor"], servico: "pintura", modelo: "empreitadaMaoDeObra", insumos: ["PRE-002"] },
  { id: "serralheiro", nome: "Serralheiro", categorias: ["Serralheiro", "Esquadria de Alumínio"], servico: "serralheria", modelo: "empreitadaGlobal", insumos: ["PRE-008"] },
  { id: "terraplanagem", nome: "Terraplanagem", categorias: ["Terraplanagem"], servico: "terraplanagem e movimentação de terra", modelo: "empreitadaGlobal", insumos: ["PRE-016"] },
  // "Outro" fecha a lista de propósito — é a saída para o que não tem tipo.
  { id: "outro", nome: "Outro", categorias: [], servico: "", modelo: "empreitadaMaoDeObra", insumos: [] },
];

// ── O que o contrato inclui ─────────────────────────────────────
// Segundo eixo do objeto: junto com o tipo de profissional, ele escreve o
// texto padrão. "Serralheiro" + "Material e mão de obra" dá "fornecimento de
// serviços de serralheria incluindo mão de obra e fornecimento de material".
const ESCOPOS_FORNECIMENTO = [
  { id: "ambos", nome: "Material e mão de obra", trecho: "incluindo mão de obra e fornecimento de material", modelo: "empreitadaGlobal" },
  { id: "maoDeObra", nome: "Somente mão de obra", trecho: "incluindo somente a mão de obra, sendo o material fornecido pelo CONTRATANTE", modelo: "empreitadaMaoDeObra" },
  { id: "material", nome: "Somente material", trecho: "incluindo somente o fornecimento de material, sem mão de obra", modelo: "empreitadaGlobal" },
];
function escopoFornecimento(id) { return ESCOPOS_FORNECIMENTO.find((e) => e.id === id) || null; }
// Contratos gravados antes deste campo tinham a informação no modelo.
function escopoContrato(c) {
  const o = c || {};
  if (escopoFornecimento(o.escopoFornecimento)) return o.escopoFornecimento;
  return o.modelo === "empreitadaGlobal" ? "ambos" : "maoDeObra";
}
function escopoDoTipo(tipoId) {
  const t = tipoProfissional(tipoId);
  return t && t.modelo === "empreitadaGlobal" ? "ambos" : "maoDeObra";
}
// Texto padrão do objeto — o mesmo racional para todo prestador.
function objetoPadrao(tipoId, escopoId) {
  const t = tipoProfissional(tipoId), e = escopoFornecimento(escopoId);
  if (!t || !t.servico || !e) return "";
  return `Fornecimento de serviços de ${t.servico} ${e.trecho}`;
}
const CTR_MINUSCULAS = ["de", "da", "do", "das", "dos", "e", "em", "para", "a", "o"];
// "instalações elétricas" → "Instalações Elétricas", para o nome do contrato.
function tituloServicoCtr(servico) {
  return String(servico || "").split(" ")
    .map((w, i) => (i > 0 && CTR_MINUSCULAS.includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}
function tipoProfissional(id) { return TIPOS_PROFISSIONAL.find((t) => t.id === id) || null; }
// Prestadores compatíveis com o tipo escolhido: escolhido "Encanador", só
// aparecem os encanadores. Quem não é daquela categoria fica fora da lista,
// mesmo que não sobre ninguém — nesse caso o caminho é cadastrar um novo.
// Sem tipo, ou no tipo "Outro" (que não tem categoria), aparecem todos.
function prestadoresDoTipo(prestadores, tipoId, escritorio) {
  const doEscritorio = prestadorDoEscritorio(escritorio);
  const ativos = [
    ...(doEscritorio ? [doEscritorio] : []),
    ...(prestadores || []).filter((p) => p.ativo !== false),
  ];
  const t = tipoProfissional(tipoId);
  if (!t || !t.categorias.length) return ativos;
  const alvo = t.categorias.map((c) => c.toLowerCase());
  return ativos.filter((p) => alvo.includes(String(p.categoria || "").toLowerCase()));
}

// ── Formatação ──────────────────────────────────────────────────
function fmtMoedaCtr(v) {
  const n = Number(v);
  return `R$ ${(Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
const CTR_UNI = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const CTR_DEZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CTR_CEM = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
// Número por extenso até 999.999.999 — usado no valor do contrato, que por
// praxe vem escrito também em palavras.
function porExtensoCtr(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return "zero";
  if (n === 100) return "cem";
  const trecho = (x) => {
    if (x === 0) return "";
    if (x < 20) return CTR_UNI[x];
    if (x < 100) return CTR_DEZ[Math.floor(x / 10)] + (x % 10 ? " e " + CTR_UNI[x % 10] : "");
    if (x === 100) return "cem";
    return CTR_CEM[Math.floor(x / 100)] + (x % 100 ? " e " + trecho(x % 100) : "");
  };
  const partes = [];
  const milhoes = Math.floor(n / 1000000), milhares = Math.floor((n % 1000000) / 1000), resto = n % 1000;
  if (milhoes) partes.push(trecho(milhoes) + (milhoes === 1 ? " milhão" : " milhões"));
  if (milhares) partes.push(milhares === 1 ? "mil" : trecho(milhares) + " mil");
  if (resto) partes.push(trecho(resto));
  if (partes.length <= 1) return partes[0] || "";
  // Regra do português: "e" antes da última parcela só quando ela é menor
  // que cem ou uma centena redonda — 9.142 é "nove mil, cento e quarenta e
  // dois", não "nove mil e cento e quarenta e dois".
  const ligacao = (resto > 0 && resto >= 100 && resto % 100 !== 0) ? ", " : " e ";
  return partes.slice(0, -1).join(", ") + ligacao + partes[partes.length - 1];
}
function moedaExtensoCtr(v) {
  const n = Number(v) || 0;
  const reais = Math.floor(n);
  const centavos = Math.round((n - reais) * 100);
  let s = `${porExtensoCtr(reais)} ${reais === 1 ? "real" : "reais"}`;
  if (centavos) s += ` e ${porExtensoCtr(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`;
  return s;
}
function numExtensoCtr(n) { return `${n} (${porExtensoCtr(n)})`; }
const CTR_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
// "6 de setembro de 2026" — a data por extenso do fecho do contrato. Lê a
// string ISO na mão para não escorregar de dia por causa de fuso.
function dataExtensoCtr(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return "";
  return `${Number(m[3])} de ${CTR_MESES[Number(m[2]) - 1]} de ${m[1]}`;
}
function fmtDataCtr(iso) {
  if (!iso) return "";
  const [a, m, d] = String(iso).split("-");
  return d && m && a ? `${d}/${m}/${a}` : "";
}
// Qualificação de uma parte no preâmbulo, no estilo dos contratos do
// escritório: nome, natureza, CNPJ/CPF, endereço e representante.
function qualificarParte(p) {
  const o = p || {};
  const pj = (o.tipo || "PJ") === "PJ";
  const partes = [String(o.nome || "").toUpperCase()];
  partes.push(pj ? "pessoa jurídica de direito privado" : "pessoa física");
  if (o.cnpjCpf) partes.push(pj ? `inscrita no CNPJ sob o nº ${o.cnpjCpf}` : `inscrito no CPF sob o nº ${o.cnpjCpf}`);
  const end = [o.logradouro, o.numero && `nº ${o.numero}`, o.bairro, [o.cidade, o.estado].filter(Boolean).join("/"), o.cep && `CEP ${o.cep}`].filter(Boolean).join(", ");
  if (end) partes.push(pj ? `com sede na ${end}` : `residente e domiciliado na ${end}`);
  // Representante só faz sentido em pessoa jurídica; a pessoa física assina
  // por si.
  if (pj && o.representanteNome) {
    partes.push(`neste ato representada por ${String(o.representanteNome).toUpperCase()}${o.representanteCpf ? `, inscrito no CPF sob o nº ${o.representanteCpf}` : ""}${o.representanteCau ? `, CAU nº ${o.representanteCau}` : ""}`);
  }
  return partes.join(", ");
}
// Qualificação enxuta, como abre o contrato de gerenciamento:
// "COBOP …, inscrita no CNPJ 44.945.459/0001-33, sediada na Avenida …".
function qualificarCurto(p) {
  const o = p || {};
  const pj = (o.tipo || "PJ") === "PJ";
  const partes = [String(o.nome || "").toUpperCase()];
  if (o.cnpjCpf) partes.push(pj ? `inscrita no CNPJ ${o.cnpjCpf}` : `inscrito no CPF ${o.cnpjCpf}`);
  const end = enderecoLinha(o);
  if (end) partes.push(pj ? `sediada na ${end}` : `residente na ${end}`);
  return partes.join(", ") + ".";
}

function enderecoLinha(o) {
  const x = o || {};
  return [x.logradouro, x.numero && `nº ${x.numero}`, x.bairro, [x.cidade, x.estado].filter(Boolean).join("/"), x.cep && `CEP ${x.cep}`].filter(Boolean).join(", ");
}

// ── Máscaras de digitação ───────────────────────────────────────
// Todo campo numérico do gerador é formatado enquanto se digita: os
// dígitos entram pela direita, como no aplicativo do banco. O contrato
// guarda o número puro; a máscara é só a apresentação.
// Valor de campo → número. CampoCtrNum entrega NÚMERO (10833.33); um
// formulário pode entregar texto em pt-BR ("10.833,33") ou já em ponto
// ("10833.33"). Tratar tudo como pt-BR e simplesmente tirar os pontos
// multiplicava por 100 o que tinha centavos — foi o bug da baixa de conta.
function numeroDeCampo(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const t = String(v == null ? "" : v).trim();
  if (!t) return 0;
  // com vírgula, é pt-BR: o ponto é separador de milhar
  const limpo = t.indexOf(",") >= 0 ? t.replace(/\./g, "").replace(",", ".") : t.replace(/\s/g, "");
  const n = parseFloat(limpo);
  return Number.isFinite(n) ? n : 0;
}
function numeroDosDigitos(txt, casas) {
  const d = String(txt == null ? "" : txt).replace(/\D/g, "");
  if (!d) return "";
  return Number(d) / Math.pow(10, casas);
}
function textoNumeroCtr(v, casas) {
  const n = Number(v);
  if (v === "" || v == null || !Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
function textoMoedaCampo(v) { return textoNumeroCtr(v, 2); }
function textoPctCampo(v) { const t = textoNumeroCtr(v, 2); return t ? t + "%" : ""; }
function textoInteiroCampo(v) { return textoNumeroCtr(v, 0); }
// Digitação: apaga o último dígito quando o usuário dá backspace em cima
// de um separador (o "%" ou a vírgula), senão o campo parece travado.
function digitandoNumero(textoAtual, textoNovo, casas) {
  const antes = String(textoAtual || "").replace(/\D/g, "");
  let d = String(textoNovo || "").replace(/\D/g, "");
  if (String(textoNovo || "").length < String(textoAtual || "").length && d === antes) d = d.slice(0, -1);
  return d ? Number(d) / Math.pow(10, casas) : "";
}

// ── Modalidades de pagamento ────────────────────────────────────
const MODALIDADES_PAGAMENTO = [
  { id: "parcelado", nome: "Parcelado", resumo: "Valor total dividido em parcelas iguais e sucessivas.",
    campos: ["parcelas", "periodicidade"] },
  { id: "medicao", nome: "Por medição", resumo: "Paga-se o que foi efetivamente executado, medido de tempos em tempos.",
    campos: ["medicaoPeriodicidade", "medicaoPrazoDias"] },
  { id: "entradaParcelas", nome: "Entrada + parcelas", resumo: "Entrada em percentual do valor e o saldo dividido em parcelas.",
    campos: ["entradaPct", "parcelas", "periodicidade"] },
  { id: "entradaFinal", nome: "Entrada + saldo no final", resumo: "Entrada em percentual e o restante na conclusão — do contrato todo ou item a item.",
    campos: ["entradaPct", "entradaEscopo"] },
];
const PERIODICIDADES = [["semanais", "Semanal"], ["quinzenais", "Quinzenal"], ["mensais", "Mensal"]];

// ── Condição de pagamento ───────────────────────────────────────
// Como o dinheiro sai. `frase` monta a cláusula; `curto` é o que aparece no
// contrato de gerenciamento, que já fala em vencimento mensal.
const MEIOS_PAGAMENTO = [
  { id: "pixOuTransferencia", nome: "PIX ou transferência", curto: "PIX ou transferência bancária",
    frase: (dela) => `Os pagamentos serão efetuados por transferência bancária ou PIX, em conta de titularidade ${dela}, informada por escrito.` },
  { id: "pix", nome: "PIX", curto: "PIX",
    frase: (dela) => `Os pagamentos serão efetuados por PIX, em chave de titularidade ${dela}, informada por escrito.` },
  { id: "transferencia", nome: "Transferência bancária", curto: "transferência bancária",
    frase: (dela) => `Os pagamentos serão efetuados por transferência bancária, em conta de titularidade ${dela}, informada por escrito.` },
  { id: "boleto", nome: "Boleto bancário", curto: "boleto bancário",
    frase: (dela) => `Os pagamentos serão efetuados por boleto bancário emitido ${dela.replace("da ", "pela ").replace("do ", "pelo ")}, enviado com antecedência mínima de 3 (três) dias úteis do vencimento.` },
  { id: "cheque", nome: "Cheque", curto: "cheque",
    frase: (dela, aEla) => `Os pagamentos serão efetuados por cheque nominal ${aEla}.` },
  { id: "dinheiro", nome: "Dinheiro", curto: "dinheiro",
    frase: () => "Os pagamentos serão efetuados em espécie, mediante recibo." },
  { id: "cartao", nome: "Cartão", curto: "cartão",
    frase: () => "Os pagamentos serão efetuados por cartão de crédito ou de débito, correndo por conta da CONTRATANTE eventuais taxas da operadora." },
];
function meioPagamento(id) { return MEIOS_PAGAMENTO.find((m) => m.id === id) || MEIOS_PAGAMENTO[0]; }
function modalidadePagamento(id) { return MODALIDADES_PAGAMENTO.find((m) => m.id === id) || null; }
// Contratos gravados antes das modalidades caem no comportamento antigo de
// cada modelo: mão de obra em parcelas, global com entrada item a item.
function modalidadeContrato(c) {
  const o = c || {};
  if (modalidadePagamento(o.modalidade)) return o.modalidade;
  return o.modelo === "empreitadaGlobal" ? "entradaFinal" : "parcelado";
}

// ── Cláusulas opcionais ─────────────────────────────────────────
// Marcáveis no gerador. `padrao` pode variar conforme o modelo; `campos`
// são os valores que a opção pede quando ligada.
const CONTRATO_OPCOES = [
  { id: "multa", label: "Multa por atraso", ajuda: "percentual do valor do contrato por dia de atraso, com teto",
    campos: [{ k: "multaDiaPct", l: "% por dia", tipo: "pct" }, { k: "multaTetoPct", l: "Teto (%)", tipo: "pct" }],
    valores: { multaDiaPct: 0.5, multaTetoPct: 10 }, padrao: true },
  { id: "tolerancia", label: "Tolerância no atraso", ajuda: "dias corridos antes de a multa passar a correr",
    campos: [{ k: "toleranciaDias", l: "Dias", tipo: "inteiro" }], valores: { toleranciaDias: 45 }, padrao: true },
  { id: "garantia", label: "Garantia dos serviços", ajuda: "prazo para corrigir defeito de execução",
    campos: [{ k: "garantiaMeses", l: "Meses", tipo: "inteiro" }], valores: {}, padrao: true },
  { id: "retencao", label: "Retenção de garantia", ajuda: "em branco, retém a última parcela; com percentual, retém de cada pagamento",
    campos: [{ k: "retencaoPct", l: "% retido", tipo: "pct" }], valores: {},
    padrao: (modelo) => modelo === "empreitadaMaoDeObra" },
  { id: "art", label: "Fornecer ART / RRT", ajuda: "anotação de responsabilidade técnica do serviço", padrao: false },
  { id: "ferramentas", label: "Contratado fornece as ferramentas",
    campos: [{ k: "ferramentasEscopo", l: "Quais", tipo: "select", opcoes: [["basicas", "Somente as básicas"], ["todas", "Todas as ferramentas"]] }],
    especifica: { k: "ferramentasDetalhe", placeholder: "ex.: colher, desempenadeira, prumo, nível, betoneira" },
    valores: { ferramentasEscopo: "basicas" },
    padrao: true, padraoValores: (modelo) => ({ ferramentasEscopo: modelo === "empreitadaGlobal" ? "todas" : "basicas" }) },
  { id: "equipamentos", label: "Contratado fornece todos os equipamentos", ajuda: "andaimes, içamento, marteletes, escoras, caçambas",
    especifica: { k: "equipamentosDetalhe", placeholder: "ex.: andaimes, martelete, escoras metálicas, caçamba" },
    padrao: (modelo) => modelo === "empreitadaGlobal" },
  { id: "epi", label: "Fornecer EPI e cumprir as normas de segurança", padrao: true },
  { id: "seguro", label: "Manter seguro de responsabilidade civil", padrao: false },
  { id: "limpeza", label: "Remover entulho e entregar limpo", padrao: true },
  { id: "danos", label: "Responder por danos ao contratante e a terceiros", padrao: true },
  { id: "subcontratacao", label: "Proibir subcontratação sem autorização", padrao: true },
  { id: "nf", label: "Emitir nota fiscal a cada pagamento", padrao: true },
  { id: "diario", label: "Entregar relatório de avanço da obra",
    campos: [{ k: "diarioPeriodicidade", l: "A cada", tipo: "select", opcoes: [["semanal", "Semana"], ["quinzenal", "Quinzena"], ["mensal", "Mês"]] }],
    valores: { diarioPeriodicidade: "semanal" }, padrao: false },
  { id: "alimentacao", label: "Alimentação, transporte e alojamento por conta do contratado", padrao: false },
  { id: "aguaEnergia", label: "Água e energia por conta do contratante", padrao: true },
  { id: "irreajustavel", label: "Preço fixo e irreajustável", padrao: true },
];
function contratoOpcao(id) { return CONTRATO_OPCOES.find((o) => o.id === id) || null; }
function opcaoPadrao(op, modeloId) { return typeof op.padrao === "function" ? !!op.padrao(modeloId) : !!op.padrao; }
function opcoesPadrao(modeloId) {
  const r = {};
  for (const op of CONTRATO_OPCOES) r[op.id] = opcaoPadrao(op, modeloId);
  return r;
}
function valoresPadraoOpcoes(modeloId) {
  const m = contratoModelo(modeloId);
  const r = {};
  for (const op of CONTRATO_OPCOES) {
    Object.assign(r, op.valores || {});
    if (op.padraoValores) Object.assign(r, op.padraoValores(modeloId));
  }
  // a garantia continua vindo do modelo, que é onde ela sempre esteve
  r.garantiaMeses = m.padrao.garantiaMeses;
  return r;
}
// Uma opção está ligada quando o contrato diz que sim. Contratos antigos
// não têm o mapa `opcoes`: valem o padrão do modelo e, no caso da retenção,
// o antigo campo `retemUltima`.
function opcaoAtiva(c, id) {
  const o = c || {};
  if (o.opcoes && Object.prototype.hasOwnProperty.call(o.opcoes, id)) return !!o.opcoes[id];
  if (id === "retencao" && typeof o.retemUltima === "boolean") return o.retemUltima;
  const op = contratoOpcao(id);
  return op ? opcaoPadrao(op, o.modelo) : false;
}

// Número do contrato — sequencial, único no escritório, com 4 dígitos. É o
// que identifica o contrato nas contas a pagar ("Contrato 0007").
function proximoNumeroContrato(obras) {
  let maior = 0;
  for (const o of obras || []) {
    for (const c of (o && o.contratos) || []) {
      const n = parseInt(String((c && c.numeroContrato) || "").replace(/\D/g, ""), 10);
      if (Number.isFinite(n) && n > maior) maior = n;
    }
  }
  return String(maior + 1).padStart(4, "0");
}
// Rótulo do serviço contratado: o ofício do prestador, ou o objeto digitado.
function servicoDoContrato(c) {
  const t = tipoProfissional(c && c.tipoProfissional);
  if (t && t.servico) return tituloServicoCtr(t.servico);
  return String((c && c.objeto) || "").trim() || "Serviços";
}

// ── O próprio escritório como contratado ────────────────────────
// A gestão da obra costuma ser do escritório. Em vez de cadastrá-lo como
// prestador (dado repetido, que envelhece), o contrato lê o cadastro do
// escritório e o apresenta no formato de prestador.
const ID_PRESTADOR_ESCRITORIO = "__escritorio__";
function prestadorDoEscritorio(escritorio) {
  const e = escritorio || {};
  if (!String(e.nome || "").trim()) return null;
  const resp = (e.responsaveis && e.responsaveis[0]) || null;
  return {
    id: ID_PRESTADOR_ESCRITORIO,
    escritorio: true,
    nome: e.nome,
    tipo: "PJ",
    categoria: "Gestão de Obra",
    // cadastros antigos guardaram o documento com outros nomes de campo
    cnpjCpf: e.cnpj || e.cnpjCpf || e.documento || "",
    // o cadastro guarda o logradouro numa linha só, com o número junto
    logradouro: e.endereco || e.logradouro || "",
    numero: e.numero || "", bairro: e.bairro || "",
    cidade: e.cidade || "", estado: e.estado || "", cep: e.cep || "",
    representanteNome: (resp && resp.nome) || e.responsavel || "",
    representanteCpf: (resp && resp.cpf) || e.cpfResponsavel || "",
    representanteCau: (resp && resp.cau) || e.cau || "",
    telefone: e.telefone || "", email: e.email || "",
    ativo: true,
  };
}
// O que ainda falta preencher no cadastro do escritório para o contrato sair
// completo. Devolve os rótulos que faltam, na ordem em que aparecem lá.
function faltaNoEscritorio(escritorio) {
  const p = prestadorDoEscritorio(escritorio);
  if (!p) return ["Nome do escritório"];
  const falta = [];
  if (!p.cnpjCpf) falta.push("CNPJ");
  if (!p.logradouro) falta.push("Endereço");
  if (!p.cidade) falta.push("Cidade");
  if (!p.cep) falta.push("CEP");
  if (!p.representanteNome) falta.push("Responsável técnico");
  if (!p.representanteCpf) falta.push("CPF do responsável");
  return falta;
}

// Grava a fatia de um cliente (suas obras, seus contratos) de volta na coleção
// inteira, preservando os registros dos demais clientes. Sem isso, salvar um
// contrato apagava os contratos de todos os outros clientes.
function mesclarPorCliente(colecao, clienteId, fatia) {
  return [...(colecao || []).filter((x) => x && x.clienteId !== clienteId), ...(fatia || [])];
}

// Os contratos moram dentro da obra (obra.contratos), que é o documento que o
// backend grava. Estes dois fazem a ponte: um lê os contratos de todas as
// obras do cliente, o outro devolve as obras com os contratos distribuídos.
function contratosDasObras(obras, clienteId) {
  return (obras || []).flatMap((o) => ((o && o.contratos) || []).map((c) => ({ ...c, obraId: o.id, clienteId })));
}
function contratosNasObras(obras, contratos, clienteId, obraPadraoId) {
  const porObra = {};
  (contratos || []).forEach((c) => {
    const alvo = (c && c.obraId) || obraPadraoId;
    if (!alvo) return;
    (porObra[alvo] = porObra[alvo] || []).push({ ...c, obraId: alvo, clienteId });
  });
  return (obras || []).map((o) => ({ ...o, contratos: porObra[o.id] || [] }));
}

// Endereço da obra. O cadastro da obra só guarda endereço próprio quando o
// usuário marca "Endereço diferente"; do contrário a obra fica no endereço
// do cliente. Obras antigas (sem a marcação) usam o endereço que tiverem.
function enderecoDaObra(obra, cliente) {
  const o = obra || {};
  const propria = enderecoLinha(o);
  if (propria && (o.enderecoProprio || o.enderecoProprio === undefined)) return propria;
  return enderecoLinha(cliente);
}

// Prazo: quantidade + unidade, escolhidas pelo usuário e sem pré-preenchimento.
// Contratos antigos guardavam prazoDias (global) ou prazoMeses (mão de obra).
function prazoContrato(c) {
  const o = c || {};
  if (o.prazoUnidade || Number(o.prazoQtd) > 0) return { qtd: o.prazoQtd, unidade: o.prazoUnidade || "" };
  if (Number(o.prazoDias) > 0) return { qtd: Number(o.prazoDias), unidade: "dias" };
  if (Number(o.prazoMeses) > 0) return { qtd: Number(o.prazoMeses), unidade: "meses" };
  return { qtd: "", unidade: "" };
}

// ── Dados de partida de um contrato novo ────────────────────────
function contratoVazio(modeloId, clienteId, obraId, tipoId, escopoId) {
  const t = tipoProfissional(tipoId);
  // O escopo manda no modelo: quem fornece material entra no regime global.
  // Sem escopo e sem tipo (chamada antiga, só com o modelo), é o modelo que
  // diz qual escopo o contrato tem.
  const escolhido = escopoFornecimento(escopoId) || (t ? escopoFornecimento(escopoDoTipo(tipoId)) : null);
  const m = contratoModelo((t && t.modeloFixo) || (escolhido ? escolhido.modelo : modeloId));
  const esc = escolhido || escopoFornecimento(m.id === "empreitadaGlobal" ? "ambos" : "maoDeObra");
  return {
    id: (typeof uid === "function" ? uid() : String(Date.now())),
    clienteId, obraId,
    gerado: true,
    modelo: m.id,
    tipoProfissional: t ? t.id : "",
    numeroContrato: "",
    escopoFornecimento: esc.id,
    prestadorId: "",
    nomeContratado: "",
    objeto: objetoPadrao(tipoId, esc.id),
    enderecoObra: "",
    exclusoes: "",
    // o formulário é o mesmo para qualquer prestador: itens e descritivo
    // estão sempre disponíveis, e vale o que for preenchido
    itens: [{ descricao: "", valor: "", inicio: "", previsao: "" }],
    escopo: [{ titulo: "", texto: "" }],
    valor: "",
    // prazo em branco de propósito — quem escolhe a unidade e o número é o usuário
    prazoQtd: "", prazoUnidade: "",
    modalidade: m.id === "empreitadaGlobal" ? "entradaFinal" : "parcelado",
    // o número de parcelas só vem pronto no gerenciamento, onde 12 é a praxe
    parcelas: m.id === "gerenciamentoObra" ? (m.padrao.parcelas || "") : "",
    periodicidade: m.padrao.periodicidade || "quinzenais",
    // Quando vence a primeira parcela. Em branco, conta da âncora (início ou
    // assinatura); preenchido, permite registrar contrato que já começou a
    // ser pago antes de entrar no sistema.
    primeiroVencimento: "",
    // Previsão de conclusão: data estimada do saldo quando o pagamento é
    // "entrada + saldo no final". Entra em contas a pagar marcada como
    // estimada, não como vencimento pactuado.
    previsaoConclusao: "",
    entradaPct: m.id === "empreitadaGlobal" ? 50 : "",
    entradaEscopo: m.id === "empreitadaGlobal" ? "item" : "contrato",
    medicaoPeriodicidade: "mensal",
    medicaoPrazoDias: "",
    meioPagamento: m.id === "gerenciamentoObra" ? "boleto" : "pixOuTransferencia",
    // gerenciamento de obra
    referenciaObra: "",
    diaVencimento: m.padrao.diaVencimento || "",
    locadoraEquipamentos: "",
    multaInadimplenciaPct: m.padrao.multaInadimplenciaPct || "",
    jurosMesPct: m.padrao.jurosMesPct || "",
    honorariosPct: m.padrao.honorariosPct || "",
    diasInterrupcao: m.padrao.diasInterrupcao || "",
    opcoes: opcoesPadrao(m.id),
    ...valoresPadraoOpcoes(m.id),
    foro: "",
    cidadeAssinatura: "",
    status: "pendente",
    dataAssinatura: new Date().toISOString().slice(0, 10), dataVencimento: "",
    descricaoServico: "", observacoes: "",
    criadoEm: new Date().toISOString(),
  };
}
// Valor total: havendo itens com valor, é a soma deles; senão, é o valor
// digitado. Não depende do modelo — o formulário é o mesmo para todos, e uma
// linha de item em branco não pode zerar o contrato.
function valorContrato(c) {
  const o = c || {};
  const itens = (o.itens || []).filter((i) => i && Number(i.valor) > 0);
  if (itens.length) return itens.reduce((acc, i) => acc + Number(i.valor), 0);
  return Number(o.valor) || 0;
}
// Parcelas: divide o total e joga o resíduo de arredondamento na última,
// como nos contratos do escritório.
function parcelasContrato(total, n) {
  const qtd = Math.max(1, Math.floor(Number(n) || 1));
  const bruto = Math.round((Number(total) || 0) * 100) / 100;
  const base = Math.round((bruto / qtd) * 100) / 100;
  const ultima = Math.round((bruto - base * (qtd - 1)) * 100) / 100;
  return { qtd, base, ultima, iguais: Math.abs(base - ultima) < 0.005 };
}
// Entrada + saldo parcelado: a entrada sai do percentual e o resto é dividido.
function entradaESaldo(total, pct, n) {
  const bruto = Math.round((Number(total) || 0) * 100) / 100;
  const entrada = Math.round(bruto * ((Number(pct) || 0) / 100) * 100) / 100;
  const saldo = Math.round((bruto - entrada) * 100) / 100;
  return { entrada, saldo, parcelas: parcelasContrato(saldo, n) };
}

// ── Montagem do documento ───────────────────────────────────────
// As cláusulas são numeradas no final, não na mão: assim uma cláusula
// opcional pode entrar ou sair sem desalinhar o resto. Dentro do texto,
// {{cl:id}} vira "Cláusula Quarta" e {{it:marca}} vira "1.3".
const CTR_ORDINAIS = ["PRIMEIRA", "SEGUNDA", "TERCEIRA", "QUARTA", "QUINTA", "SEXTA", "SÉTIMA", "OITAVA", "NONA", "DÉCIMA",
  "DÉCIMA PRIMEIRA", "DÉCIMA SEGUNDA", "DÉCIMA TERCEIRA", "DÉCIMA QUARTA", "DÉCIMA QUINTA", "DÉCIMA SEXTA",
  "DÉCIMA SÉTIMA", "DÉCIMA OITAVA", "DÉCIMA NONA", "VIGÉSIMA"];
function ordinalCapCtr(i) {
  const o = CTR_ORDINAIS[i] || `${i + 1}ª`;
  return o.split(" ").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}
// Número por extenso quando preenchido; traço quando o campo está em branco.
function numCtr(v, sufixo) {
  const n = Number(v);
  const corpo = Number.isFinite(n) && n > 0 ? numExtensoCtr(n) : "______";
  return sufixo ? `${corpo} ${sufixo}` : corpo;
}
function pctCtr(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "____%";
  return `${String(Math.round(n * 100) / 100).replace(".", ",")}%`;
}
function periodicidadeAdj(p) { return p === "semanais" ? "semanais" : p === "mensais" ? "mensais" : "quinzenais"; }
function vencimentoTexto(p, primeiro) {
  // Com a data da primeira parcela informada, o contrato escreve a data —
  // é o caso do contrato que já vinha sendo pago quando foi registrado.
  if (primeiro) {
    const d = fmtDataCtr(primeiro);
    if (p === "semanais") return `A primeira parcela vence em ${d} e as demais a cada 7 (sete) dias subsequentes.`;
    if (p === "mensais") return `A primeira parcela vence em ${d} e as demais no mesmo dia dos meses subsequentes.`;
    return `A primeira parcela vence em ${d} e as demais a cada 15 (quinze) dias subsequentes.`;
  }
  if (p === "semanais") return "Os pagamentos serão realizados semanalmente, sempre às sextas-feiras, vencendo-se a primeira parcela na primeira sexta-feira posterior ao início dos serviços e as demais a cada 7 (sete) dias subsequentes.";
  if (p === "mensais") return "Os pagamentos serão realizados mensalmente, vencendo-se a primeira parcela 30 (trinta) dias após o início dos serviços e as demais a cada 30 (trinta) dias subsequentes.";
  return "Os pagamentos serão realizados sempre às sextas-feiras, em quinzenas alternadas e no período da manhã, vencendo-se a primeira parcela na segunda sexta-feira contada do início dos serviços e as demais a cada 15 (quinze) dias subsequentes.";
}


// ── Cláusulas do contrato de gerenciamento de obra ──────────────
// Texto do modelo do escritório: o que muda vem dos campos do gerador
// (referência da obra, valor, parcelas, dia do boleto, locadora preferida,
// multa, juros, honorários e prazo de interrupção). O resto é fixo.
function clausulasGerenciamento(c, ctx) {
  const { enderecoObra, total, foro, add } = ctx;
  const parcelas = Math.max(0, Math.floor(Number(c.parcelas) || 0));
  const p = parcelasContrato(total, parcelas || 1);
  const dia = Number(c.diaVencimento) || 0;
  const locadora = String(c.locadoraEquipamentos || "").trim();
  const meio = meioPagamento(c.meioPagamento);
  const modo = modalidadeContrato(c);

  add("objeto", "OBJETO DO CONTRATO", [
    "O presente contrato tem como objeto a prestação de serviços de gerenciamento de obra, o qual compreenderá a gestão da compra de materiais, intermediação na contratação de empreiteiros e prestadores de serviços.",
  ]);

  add("referencia", "REFERÊNCIA", [
    `${String(c.referenciaObra || "").trim() || "Obra"} no endereço: ${enderecoObra}.`,
  ]);

  add("gestao", "GESTÃO DA OBRA", [
    "MÃO DE OBRA: Levantamento da equipe de execução, elaboração de contratos de trabalho, contratos de empreita, contratos de serviços especializados, gestão e execução dos pagamentos. Caso haja algum problema na qualidade da execução dos serviços, a CONTRATADA irá atuar na intermediação entre os prestadores e a CONTRATANTE a fim de solucionar tais questões, de modo a minimizar ou eliminar eventuais custos de reparos gerados em função de má execução de serviços de terceiros. Todos os contratos serão realizados em nome da CONTRATANTE.",
    "MATERIAIS: Cotação e compra dos materiais a serem utilizados na obra; as compras serão efetuadas em nome da CONTRATANTE, seguindo análises como preço, qualidade do material e prazo de entrega, a fim de se atingir a necessidade da obra. Serão disponibilizados comprovantes de compras e/ou notas fiscais, que podem estar em nome da CONTRATADA ou da CONTRATANTE. Dependendo da simplicidade do fornecedor, registros de conversas por aplicativo de mensagens poderão ser utilizados como comprovante. A CONTRATADA decidirá pelas marcas dos materiais, desde que todos sigam as normas técnicas e sejam aprovados pela ABNT; havendo problemas na performance dos materiais, a CONTRATADA apenas intermediará a resolução entre o fornecedor e a CONTRATANTE, de modo que não garante a performance dos materiais e equipamentos utilizados na obra.",
    `LOCAÇÃO DE EQUIPAMENTOS E FERRAMENTAS ESPECIALIZADAS: Todas as locações serão solicitadas pela CONTRATADA${locadora ? `, geralmente na ${locadora}, por apresentar bom custo-benefício entre preço e agilidade logística` : ""}, podendo a CONTRATANTE indicar local de sua preferência. Assim como os materiais e a mão de obra, a CONTRATADA apenas faz a gestão da locação, sendo o custo arcado pela CONTRATANTE; havendo eventuais atrasos de mão de obra que acarretem prazos maiores de locação, este custo adicional continua sendo de responsabilidade da CONTRATANTE, cabendo à CONTRATADA atuar na gestão dos prestadores no sentido de minimizar atrasos.`,
    "PRESTAÇÃO DE CONTAS: Confecção e apresentação de planilhas financeiras demonstrando gastos e pagamentos ocorridos; os saldos serão conferidos com o extrato bancário mês a mês, se for o caso. Serão disponibilizadas notas fiscais e contratos; na ausência de nota fiscal será apresentado outro comprovante que dê suporte à despesa realizada, tudo reunido e disponibilizado à CONTRATANTE.",
    "OPERACIONALIZAÇÃO DOS PAGAMENTOS: Sugere-se que seja disponibilizado à CONTRATADA o acesso a conta corrente exclusiva para a obra, em nome da CONTRATANTE, onde serão depositados os recursos financeiros para a execução da obra, de modo a facilitar a conferência dos gastos.",
    "AUTORIZAÇÃO PRÉVIA: Fica a CONTRATADA previamente autorizada a abrir cadastros em lojas e fornecedores ligados à construção civil em nome da CONTRATANTE, única e exclusivamente para compras de insumos vinculadas à execução da obra objeto deste contrato, bem como fica autorizada a assinar pela CONTRATANTE documentos relacionados à obra, como contratações, compras, memoriais descritivos e laudos de vistoria para instituições financeiras, entre outros, desde que única e exclusivamente relacionados à obra e necessários ao seu andamento.",
    "DOS PAGAMENTOS DOS INSUMOS E SERVIÇOS UTILIZADOS NA OBRA: Todo gasto feito para a execução da obra, mesmo que em nome da CONTRATADA, é de obrigação da CONTRATANTE, sendo o débito devido por ela ainda que os fornecedores apresentem as faturas ou notas de compra logo após o término da obra.",
    "VÍNCULO EMPREGATÍCIO: Não se estabelece vínculo empregatício entre a CONTRATANTE e a CONTRATADA, bem como toda a mão de obra empregada na obra não terá vínculo empregatício com a CONTRATADA, visto que se trata de contrato de prestação de serviço.",
  ], { subtitulo: "DESCRIÇÃO DO SERVIÇO CONTRATADO:" });

  // A forma de pagamento é a mesma escolha dos demais contratos de prestação
  // de serviço (parcelado, por medição, entrada + parcelas, entrada + saldo),
  // escrita na voz do modelo do escritório.
  const perGer = periodicidadeAdj(c.periodicidade);
  const quando = c.primeiroVencimento
    ? `, vencendo a primeira em ${fmtDataCtr(c.primeiroVencimento)} e as demais ${c.periodicidade === "mensais" ? "no mesmo dia dos meses subsequentes" : `a cada ${c.periodicidade === "semanais" ? "7 (sete)" : "15 (quinze)"} dias`}`
    : dia ? `, com vencimento todo dia ${String(dia).padStart(2, "0")} de cada mês` : "";
  const comoPaga = `${meio.id === "boleto" ? "Os pagamentos serão feitos por boleto bancário" : `Os pagamentos serão feitos por ${meio.curto}`}`;
  const frasesPag = [];
  if (modo === "medicao") {
    const perMed = c.medicaoPeriodicidade === "semanal" ? "semanal" : c.medicaoPeriodicidade === "quinzenal" ? "quinzenal" : "mensal";
    frasesPag.push(`O valor total do presente contrato é de ${fmtMoedaCtr(total)} (${moedaExtensoCtr(total)}), pago por medição ${perMed}: ao final de cada período as partes apurarão, em conjunto, os serviços efetivamente gerenciados, e a CONTRATADA receberá o valor correspondente ao percentual medido${numCtr(c.medicaoPrazoDias, "dias") !== "______ (______) dias" ? `, em até ${numCtr(c.medicaoPrazoDias, "dias")} da aprovação da medição` : ""}. ${comoPaga}.`);
  } else if (modo === "entradaParcelas") {
    const e = entradaESaldo(total, c.entradaPct, parcelas);
    frasesPag.push(`O valor total do presente contrato é de ${fmtMoedaCtr(total)} (${moedaExtensoCtr(total)}), sendo ${pctCtr(c.entradaPct)} a título de entrada, correspondentes a ${fmtMoedaCtr(e.entrada)} (${moedaExtensoCtr(e.entrada)}), na assinatura deste contrato${parcelas ? `, e o saldo de ${fmtMoedaCtr(e.saldo)} dividido em ${numExtensoCtr(parcelas)} parcelas ${perGer} de ${fmtMoedaCtr(e.parcelas.base)}${e.parcelas.iguais ? "" : `, sendo a última de ${fmtMoedaCtr(e.parcelas.ultima)}`}${quando}` : ""}. ${comoPaga}.`);
  } else if (modo === "entradaFinal") {
    const e = entradaESaldo(total, c.entradaPct, 1);
    frasesPag.push(`O valor total do presente contrato é de ${fmtMoedaCtr(total)} (${moedaExtensoCtr(total)}), sendo ${pctCtr(c.entradaPct)} a título de entrada, correspondentes a ${fmtMoedaCtr(e.entrada)} (${moedaExtensoCtr(e.entrada)}), na assinatura deste contrato, e o saldo de ${fmtMoedaCtr(e.saldo)} (${moedaExtensoCtr(e.saldo)}) na conclusão da obra. ${comoPaga}.`);
  } else {
    frasesPag.push(`O valor total do presente contrato é de ${fmtMoedaCtr(total)} (${moedaExtensoCtr(total)})${parcelas ? `, parcelado em ${numExtensoCtr(parcelas)} parcelas ${perGer} de ${fmtMoedaCtr(p.base)} (${moedaExtensoCtr(p.base)})${p.iguais ? "" : `, sendo a última de ${fmtMoedaCtr(p.ultima)}`}` : ""}${quando ? `${quando}` : ""}. ${comoPaga}.`);
  }
  frasesPag.push("Caso a obra seja concluída antes do prazo das parcelas, a quitação do saldo devedor será antecipada; caso o prazo seja extrapolado, o valor deste contrato não se altera, ou seja, não será cobrado nenhum valor adicional de gerenciamento de obra.");
  add("pagamento", "VALORES E FORMA DE PAGAMENTO", frasesPag);

  add("naoContempladas", "DESPESAS NÃO CONTEMPLADAS NESTE CONTRATO", [
    "Não estão inclusas despesas de impressão de plantas, emissão de ARTs e RRTs, taxas de órgãos públicos e de fiscalização de qualquer espécie, incluindo taxas notariais e cartoriais. Caso se faça necessário que a CONTRATADA execute essas atividades, fica desde já autorizada pela CONTRATANTE a proceder com elas, tendo a CONTRATANTE a obrigação de reembolsá-la mediante apresentação dos comprovantes de pagamento.",
  ]);

  add("validade", "PRAZO DE VALIDADE DO CONTRATO", [
    "O presente contrato se inicia na data de sua assinatura, vigorando até o término da obra.",
  ]);

  add("rescisao", "RESCISÃO", [
    `POR INADIMPLÊNCIA: Caso a CONTRATANTE deixe de pagar alguma das parcelas pactuadas, o presente contrato será rescindido de imediato, tornando-se vencidas as demais parcelas, independentemente de aviso prévio ou notificação extrajudicial, ficando a CONTRATANTE constituída em mora, com multa aqui pactuada em ${pctCtr(c.multaInadimplenciaPct)} sobre o valor do contrato, acrescida de juros de ${pctCtr(c.jurosMesPct)} ao mês e correção monetária, além de responder pelos honorários advocatícios de ${pctCtr(c.honorariosPct)} sobre o valor do contrato.`,
    `POR INTERRUPÇÃO DA OBRA: Caso a obra seja interrompida por mais de ${numCtr(c.diasInterrupcao, "dias")}, seja por desejo da CONTRATANTE ou por qualquer outra questão de sua responsabilidade, fica rescindido o contrato. Todas as parcelas, vencidas ou a vencer, serão consideradas devidas. Custos adicionais em função de tal interrupção serão de responsabilidade da CONTRATANTE, sejam despesas de mão de obra, material, aluguel de equipamentos, entre outros.`,
  ]);

  add("regencia", "DA REGÊNCIA", [
    "O presente contrato está regulado pelas normas do Código de Processo Civil, constituindo-se em título executivo extrajudicial para os efeitos da lei.",
  ]);

  add("foro", "DO FECHO E DO FORO", [
    `E por estarem de acordo com todas as cláusulas deste contrato, as partes envolvidas assinam o presente e elegem o foro da Comarca de ${foro || "______________________"}, mesmo em detrimento de qualquer outro, por mais privilegiado que seja, para dirimir possíveis dúvidas.`,
  ]);
}

function montarContrato(contrato, { cliente, obra, prestador }) {
  const c = contrato || {};
  const m = contratoModelo(c.modelo);
  const global = m.id === "empreitadaGlobal";
  const total = valorContrato(c);
  const lig = (id) => opcaoAtiva(c, id);
  const contratante = {
    tipo: (cliente && cliente.tipo) || "PJ",
    nome: (cliente && cliente.nome) || "",
    cnpjCpf: (cliente && cliente.cpfCnpj) || "",
    logradouro: cliente && cliente.logradouro, numero: cliente && cliente.numero,
    bairro: cliente && cliente.bairro, cidade: cliente && cliente.cidade,
    estado: cliente && cliente.estado, cep: cliente && cliente.cep,
    // Só o representante legal do cadastro — um contato qualquer da agenda não
    // serve para assinar o contrato.
    representanteNome: (cliente && cliente.representanteNome) || "",
    representanteCpf: (cliente && cliente.representanteCpf) || "",
  };
  const contratado = prestador || { nome: c.nomeContratado || "" };
  // O gênero do contratado vem do modelo, não do regime: no gerenciamento de
  // obra o escritório é "a CONTRATADA" mesmo sem fornecimento de material.
  const fem = String(m.generoContratado || "").trim().startsWith("a ");
  const rotuloContratado = fem ? "CONTRATADA" : "CONTRATADO";
  const ela = fem ? "a CONTRATADA" : "o CONTRATADO";      // sujeito
  const aEla = fem ? "à CONTRATADA" : "ao CONTRATADO";    // objeto indireto
  const dela = fem ? "da CONTRATADA" : "do CONTRATADO";
  const a_o = fem ? "a" : "o";
  const pelaEla = fem ? "pela CONTRATADA" : "pelo CONTRATADO";
  // Tipo de profissional + o que o contrato inclui escrevem o objeto e o nome
  // do contrato — o mesmo racional para qualquer prestador.
  const tipo = tipoProfissional(c.tipoProfissional);
  const esc = escopoFornecimento(escopoContrato(c));
  const objetoTexto = String(c.objeto || "").trim() || objetoPadrao(c.tipoProfissional, escopoContrato(c)) || m.subtitulo;
  const nomeDoContrato = tipo && tipo.servico
    ? `Contrato de Prestação de Serviços de ${tituloServicoCtr(tipo.servico)}`
    : "Contrato de Prestação de Serviços";
  const enderecoObra = c.enderecoObra || enderecoDaObra(obra, cliente);
  const foro = c.foro || (cliente && cliente.cidade) || "";
  const cidadeAss = c.cidadeAssinatura || (cliente && cliente.cidade ? `${cliente.cidade}/${cliente.estado || "SP"}` : "");

  // Itens e anexo valem para qualquer prestador: o que estiver preenchido entra.
  const tabelaItens = (c.itens || []).filter((i) => i && (String(i.descricao || "").trim() || Number(i.valor)))
    .map((i, idx) => ({ n: idx + 1, descricao: i.descricao || "", valor: Number(i.valor) || 0 }));
  const anexo = (c.escopo || []).filter((e) => e && (String(e.titulo || "").trim() || String(e.texto || "").trim()));
  const temItens = tabelaItens.length > 0;
  const temAnexo = anexo.length > 0;

  const preambulo = m.preambuloSimples ? [
    `CONTRATANTE: ${qualificarCurto(contratante)}`,
    `${rotuloContratado}: ${qualificarCurto(contratado)}`,
  ] : [
    "Pelo presente instrumento particular, de um lado:",
    `CONTRATANTE: ${qualificarParte(contratante)}, doravante denominada simplesmente CONTRATANTE;`,
    "e, de outro lado:",
    `${rotuloContratado}: ${qualificarParte(contratado)}, doravante denominada simplesmente ${rotuloContratado};`,
    `têm entre si justo e contratado o presente ${nomeDoContrato}, que se regerá pelas cláusulas e condições a seguir estabelecidas.`,
  ];

  const cl = [];
  const marcas = {};
  const add = (id, nome, itens, extra) => cl.push({ id, nome, itens: itens.filter(Boolean), ...(extra || {}) });

  // O gerenciamento de obra tem corpo próprio, tirado do modelo do escritório.
  const escId = esc ? esc.id : (global ? "ambos" : "maoDeObra");
  let modo = modalidadeContrato(c), tabelaParcelas = [], parcelasApos = null;
  if (m.id === "gerenciamentoObra") {
    // a modalidade do gerenciamento é a mesma dos demais contratos de
    // prestação de serviço; o padrão do modelo é parcelado mensal
    clausulasGerenciamento(c, { enderecoObra, total, foro, add });
  } else {

  // ── Objeto ──
  const objeto = [];
  const ondeEstaOEscopo = temItens ? "no item {{it:itens}}" : temAnexo ? "no ANEXO I" : "";
  objeto.push(`O presente contrato tem por objeto a prestação, ${pelaEla}, dos serviços a seguir descritos: ${objetoTexto}${/[.!?]$/.test(objetoTexto) ? "" : "."}`);
  objeto.push(`Os serviços serão executados no imóvel situado na ${enderecoObra}, doravante denominado simplesmente OBRA${temAnexo ? ", conforme o descritivo do ANEXO I, que integra este instrumento" : ""}.`);
  let itensApos = null;
  if (temItens) {
    objeto.push("Compõem o objeto deste contrato os seguintes itens e respectivos valores:");
    marcas.itens = { id: "objeto", i: objeto.length - 1 };
    itensApos = objeto.length - 1;
  }
  // Exclusões: se a pessoa já escreveu a frase inteira ("Não integra o objeto
  // deste contrato a revisão..."), o texto entra como está; se escreveu só a
  // lista ("o lixamento do concreto e ..."), o contrato põe a abertura.
  const exclusoes = String(c.exclusoes || "").trim();
  if (exclusoes) {
    const jaEhFrase = /^[A-ZÁÂÃÀÉÊÍÓÔÕÚÇ]/.test(exclusoes);
    const corpo = jaEhFrase ? exclusoes : `Não integram o objeto deste contrato: ${exclusoes}`;
    objeto.push(/[.!?]$/.test(corpo) ? corpo : `${corpo}.`);
  }
  add("objeto", "DO OBJETO", objeto, { tabelaItens: temItens, tabelaItensApos: itensApos });

  // ── Regime ──
  const ferramentasTodas = (c.ferramentasEscopo || "basicas") === "todas";
  // (definido antes do corpo das cláusulas)
  const regime = escId === "material" ? [
    `O objeto compreende exclusivamente o fornecimento do material especificado, incluídos o transporte e a descarga no local da OBRA, cabendo à CONTRATANTE a respectiva aplicação ou montagem.`,
    "A CONTRATADA responde pela procedência, pela qualidade e pela adequação do material fornecido à finalidade contratada.",
  ] : escId === "ambos" ? [
    "Os serviços serão executados sob o regime de empreitada global, compreendendo o fornecimento de todo o material, dos consumíveis e dos acessórios, bem como a mão de obra, o transporte, a descarga e a execução no local da OBRA.",
    "A CONTRATADA é responsável pelo dimensionamento e pela especificação dos elementos objeto deste contrato, respondendo pela sua adequação às condições de uso previstas.",
  ] : [
    "Os serviços serão executados sob o regime de empreitada de mão de obra, cabendo ao CONTRATADO o fornecimento da mão de obra necessária à integral execução do objeto.",
    "Todo o material necessário à execução dos serviços será fornecido pelo CONTRATANTE, às suas expensas.",
  ];
  if (escId !== "material") regime.push("Os serviços serão executados de forma autônoma e coordenada com as demais frentes da obra.");
  const detalhe = (t) => { const x = String(t || "").trim().replace(/\.$/, ""); return x || ""; };
  if (lig("ferramentas")) {
    const df = detalhe(c.ferramentasDetalhe);
    regime.push((ferramentasTodas
      ? `Todas as ferramentas necessárias à execução dos serviços serão fornecidas ${pelaEla}, por sua conta, sem qualquer custo adicional para a CONTRATANTE.`
      : `As ferramentas básicas necessárias à execução dos serviços serão fornecidas ${pelaEla}, por sua conta.`)
      + (df ? ` ${ferramentasTodas ? "Compreendem-se" : "Consideram-se ferramentas básicas, para os fins deste contrato"}, entre outras: ${df}.` : ""));
  }
  if (lig("equipamentos")) {
    const de = detalhe(c.equipamentosDetalhe);
    regime.push(`Correm por conta exclusiva ${dela} todos os demais equipamentos necessários à execução dos serviços, tais como ${de || "andaimes, meios de içamento e acesso, marteletes, escoras metálicas e caçambas de entulho"}.`);
  } else {
    regime.push("Os equipamentos de maior porte serão fornecidos pelo CONTRATANTE, às suas expensas, tais como andaimes, marteletes, escoras metálicas e caçambas de entulho.");
  }
  if (lig("epi")) regime.push(`Os equipamentos de proteção individual (EPI) utilizados pela equipe ${dela} serão por el${fem ? "a" : "e"} fornecidos, observadas as normas de segurança e medicina do trabalho.`);
  regime.push("Os serviços observarão as normas técnicas aplicáveis.");
  add("regime", "DO REGIME DE EXECUÇÃO", regime);

  // ── Prazo ──
  const pz = prazoContrato(c);
  const unidadeTxt = pz.unidade === "meses" ? "meses" : pz.unidade === "dias" ? "dias corridos" : "dias ou meses";
  const prazo = [];
  if (global) {
    prazo.push(`O prazo para a execução integral dos serviços é de ${numCtr(pz.qtd, unidadeTxt)}, contados da data em que a CONTRATANTE comunicar formalmente à CONTRATADA que a OBRA está liberada para o início dos trabalhos.`);
    prazo.push("A comunicação de liberação da OBRA será feita por escrito, admitido o meio eletrônico, e a respectiva data será considerada o marco inicial do prazo.");
  } else {
    prazo.push(`O prazo para a execução integral dos serviços é de ${numCtr(pz.qtd, unidadeTxt)}, contados de ${c.dataInicio ? fmtDataCtr(c.dataInicio) : "______/______/__________"}, data prevista para o início dos trabalhos.`);
  }
  prazo.push(`O prazo será prorrogado, por período equivalente ao da paralisação, nas seguintes hipóteses: (a) chuvas ou condições climáticas que impeçam a execução dos serviços; (b) atraso ${global ? "da CONTRATANTE ou de seus demais contratados na liberação das frentes de trabalho" : "na entrega dos materiais a cargo do CONTRATANTE"}; (c) alterações ou acréscimos de escopo solicitados pela CONTRATANTE; e (d) caso fortuito ou força maior.`);
  prazo.push("As prorrogações e as paralisações deverão ser registradas por escrito entre as partes, admitido o meio eletrônico.");
  add("prazo", "DO PRAZO DE EXECUÇÃO", prazo);

  // ── Preço e pagamento ──
  const per = periodicidadeAdj(c.periodicidade);
  const pag = [`Pela integral execução dos serviços, a CONTRATANTE pagará ${aEla} o valor total de ${fmtMoedaCtr(total)} (${moedaExtensoCtr(total)})${temItens ? ", correspondente à soma dos itens discriminados no item {{it:itens}}" : ""}.`];

  if (modo === "parcelado") {
    const p = parcelasContrato(total, c.parcelas);
    pag.push(Number(c.parcelas) > 0
      ? (p.iguais
        ? `O valor total será dividido em ${numCtr(p.qtd)} parcelas ${per} e sucessivas, no valor de ${fmtMoedaCtr(p.base)} (${moedaExtensoCtr(p.base)}) cada.`
        : `O valor total será dividido em ${numCtr(p.qtd)} parcelas ${per} e sucessivas, sendo ${numCtr(p.qtd - 1)} parcelas no valor de ${fmtMoedaCtr(p.base)} (${moedaExtensoCtr(p.base)}) cada e a última no valor de ${fmtMoedaCtr(p.ultima)} (${moedaExtensoCtr(p.ultima)}), ajustada em razão de arredondamento.`)
      : `O valor total será dividido em ______ parcelas ${per} e sucessivas.`);
    pag.push(vencimentoTexto(c.periodicidade, c.primeiroVencimento));
  } else if (modo === "medicao") {
    const perMed = c.medicaoPeriodicidade === "semanal" ? "semanal" : c.medicaoPeriodicidade === "quinzenal" ? "quinzenal" : "mensal";
    pag.push(`O pagamento será feito por medição ${perMed}: ao final de cada período as partes apurarão, em conjunto, os serviços efetivamente executados, e ${ela} receberá o valor correspondente ao percentual medido do valor total deste contrato.`);
    pag.push(`A medição será formalizada por escrito, admitido o meio eletrônico, e o respectivo pagamento será realizado em até ${numCtr(c.medicaoPrazoDias, "dias")} contados da aprovação da medição pela CONTRATANTE.`);
    pag.push("Divergências apontadas na medição serão discriminadas por escrito, liberando-se de imediato a parcela incontroversa.");
  } else if (modo === "entradaParcelas") {
    const e = entradaESaldo(total, c.entradaPct, c.parcelas);
    pag.push(`A título de entrada, a CONTRATANTE pagará ${aEla} ${pctCtr(c.entradaPct)} do valor total, correspondentes a ${fmtMoedaCtr(e.entrada)} (${moedaExtensoCtr(e.entrada)}), na assinatura deste contrato.`);
    pag.push(Number(c.parcelas) > 0
      ? (e.parcelas.iguais
        ? `O saldo remanescente de ${fmtMoedaCtr(e.saldo)} (${moedaExtensoCtr(e.saldo)}) será dividido em ${numCtr(e.parcelas.qtd)} parcelas ${per} e sucessivas, no valor de ${fmtMoedaCtr(e.parcelas.base)} (${moedaExtensoCtr(e.parcelas.base)}) cada.`
        : `O saldo remanescente de ${fmtMoedaCtr(e.saldo)} (${moedaExtensoCtr(e.saldo)}) será dividido em ${numCtr(e.parcelas.qtd)} parcelas ${per} e sucessivas, sendo ${numCtr(e.parcelas.qtd - 1)} no valor de ${fmtMoedaCtr(e.parcelas.base)} (${moedaExtensoCtr(e.parcelas.base)}) cada e a última no valor de ${fmtMoedaCtr(e.parcelas.ultima)} (${moedaExtensoCtr(e.parcelas.ultima)}), ajustada em razão de arredondamento.`)
      : `O saldo remanescente de ${fmtMoedaCtr(e.saldo)} (${moedaExtensoCtr(e.saldo)}) será dividido em ______ parcelas ${per} e sucessivas.`);
    pag.push(vencimentoTexto(c.periodicidade, c.primeiroVencimento));
  } else {
    // entrada + saldo no final — do contrato todo ou item a item
    const porItem = (c.entradaEscopo || (global ? "item" : "contrato")) === "item" && temItens;
    if (porItem) {
      pag.push(`O pagamento será realizado item a item, na proporção de ${pctCtr(c.entradaPct)} do valor do respectivo item a título de entrada, na liberação de cada item para produção, e o restante na conclusão daquele mesmo item, conforme o quadro abaixo:`);
      parcelasApos = pag.length - 1;
      pag.push(`A conclusão de cada item será verificada pela CONTRATANTE em até 5 (cinco) dias úteis da comunicação ${dela}, liberando-se o respectivo saldo caso não haja pendências apontadas por escrito.`);
      const pct = (Number(c.entradaPct) || 0) / 100;
      tabelaParcelas = tabelaItens.map((i) => {
        const p1 = Math.floor(i.valor * pct * 100) / 100;
        return { n: i.n, descricao: i.descricao, p1, p2: Math.round((i.valor - p1) * 100) / 100 };
      });
    } else {
      const e = entradaESaldo(total, c.entradaPct, 1);
      pag.push(`A título de entrada, a CONTRATANTE pagará ${aEla} ${pctCtr(c.entradaPct)} do valor total, correspondentes a ${fmtMoedaCtr(e.entrada)} (${moedaExtensoCtr(e.entrada)}), na assinatura deste contrato.`);
      pag.push(`O saldo de ${fmtMoedaCtr(e.saldo)} (${moedaExtensoCtr(e.saldo)}) será pago na conclusão integral dos serviços, mediante o aceite final da CONTRATANTE, que será dado em até 5 (cinco) dias úteis da comunicação de término, caso não haja pendências apontadas por escrito.`);
    }
  }

  if (lig("retencao")) {
    pag.push(Number(c.retencaoPct) > 0
      ? `De cada pagamento será retido o percentual de ${pctCtr(c.retencaoPct)}, a título de garantia de execução, liberado após a conclusão total dos serviços e o respectivo aceite final da CONTRATANTE.`
      : `A última parcela ficará retida pela CONTRATANTE, a título de garantia de execução, e será paga somente após a conclusão total dos serviços e o respectivo aceite final da CONTRATANTE.`);
  }
  pag.push(meioPagamento(c.meioPagamento).frase(dela, aEla));
  pag.push("O atraso no pagamento de qualquer parcela sujeitará a CONTRATANTE à multa de 2% (dois por cento) sobre o valor em atraso, acrescida de juros de 1% (um por cento) ao mês, calculados pro rata die.");
  if (lig("irreajustavel")) {
    pag.push(global
      ? "Os valores acima são fixos e irreajustáveis pelo prazo deste contrato e compreendem todos os custos diretos e indiretos, materiais, transporte, mão de obra, tributos e encargos incidentes sobre os serviços."
      : "Os valores acima são fixos e irreajustáveis pelo prazo deste contrato e remuneram exclusivamente a mão de obra, nele não se incluindo qualquer material, locação de equipamentos ou serviço de terceiros.");
  }
  add("pagamento", "DO PREÇO E DA FORMA DE PAGAMENTO", pag, { tabelaParcelas: tabelaParcelas.length > 0, tabelaParcelasApos: parcelasApos });

  // ── Obrigações ──
  const obrC = [
    "Executar os serviços com zelo, técnica e qualidade, em observância ao objeto contratado e às boas práticas aplicáveis.",
    "Manter na OBRA equipe própria, qualificada e em número suficiente ao cumprimento do prazo pactuado.",
    "Responsabilizar-se integralmente pelos encargos trabalhistas, previdenciários, fiscais e securitários relativos aos seus empregados e prepostos.",
    lig("art") && "Emitir e recolher, às suas expensas, a Anotação de Responsabilidade Técnica (ART) ou o Registro de Responsabilidade Técnica (RRT) referente aos serviços contratados, entregando cópia à CONTRATANTE antes do início dos trabalhos.",
    lig("seguro") && "Manter, durante toda a vigência deste contrato, seguro de responsabilidade civil e contra acidentes de trabalho que cubra sua equipe e eventuais danos decorrentes dos serviços.",
    global
      ? "Fornecer materiais novos, de primeira qualidade e adequados à finalidade, respondendo por sua procedência."
      : "Zelar pelos materiais colocados à sua disposição pela CONTRATANTE, respondendo por perdas decorrentes de desperdício, mau uso ou negligência de sua equipe.",
    lig("limpeza") && "Manter a obra organizada, promover a remoção do entulho gerado e entregar os ambientes limpos ao término de cada etapa.",
    `Refazer ou corrigir, sem ônus ${global ? "" : "de mão de obra "}para a CONTRATANTE, os serviços executados em desacordo com o contratado ou com as boas práticas técnicas.`,
    lig("danos") && "Responder pelos danos que causar à CONTRATANTE, à OBRA ou a terceiros, por ação ou omissão de sua equipe.",
    lig("subcontratacao") && "Não subcontratar, no todo ou em parte, os serviços objeto deste contrato sem prévia e expressa autorização escrita da CONTRATANTE.",
    lig("alimentacao") && "Arcar com a alimentação, o transporte e, se for o caso, o alojamento de sua equipe.",
    lig("diario") && `Entregar à CONTRATANTE relatório ${c.diarioPeriodicidade === "mensal" ? "mensal" : c.diarioPeriodicidade === "quinzenal" ? "quinzenal" : "semanal"} de avanço dos serviços, admitido o meio eletrônico.`,
    lig("nf") && "Emitir a nota fiscal correspondente a cada pagamento, na forma da legislação aplicável.",
  ];
  add("obrigacoesContratado", `DAS OBRIGAÇÕES ${global ? "DA CONTRATADA" : "DO CONTRATADO"}`, obrC);

  add("obrigacoesContratante", "DAS OBRIGAÇÕES DA CONTRATANTE", [
    global
      ? "Comunicar formalmente a liberação da OBRA para o início dos serviços e manter as frentes de trabalho disponíveis e desimpedidas, inclusive as bases e fundações de apoio."
      : "Fornecer, em tempo hábil e em quantidade suficiente, todo o material necessário à execução dos serviços, bem como as ferramentas e os equipamentos a seu cargo.",
    lig("aguaEnergia")
      ? `Franquear ${aEla} o livre acesso à OBRA e disponibilizar água e energia elétrica para a execução dos trabalhos.`
      : `Franquear ${aEla} o livre acesso à OBRA.`,
    "Efetuar os pagamentos nas condições e nos prazos ajustados na {{cl:pagamento}}.",
    "Acompanhar e fiscalizar a execução dos serviços, apontando por escrito eventuais inconformidades para correção.",
  ]);

  add("extraordinarios", "DOS SERVIÇOS EXTRAORDINÁRIOS", [
    `Qualquer serviço não previsto ${ondeEstaOEscopo || "neste contrato"} somente será executado mediante acordo prévio e escrito entre as partes, com a definição do respectivo valor e do impacto no prazo, por meio de termo aditivo.`,
    `A execução de serviço extraordinário sem o correspondente aditivo escrito não gerará ${aEla} direito a pagamento adicional.`,
  ]);

  if (lig("garantia")) {
    add("garantia", "DA GARANTIA", [
      `${global ? "A CONTRATADA garante os serviços e os materiais fornecidos" : "O CONTRATADO garante os serviços executados"} pelo prazo de ${numCtr(c.garantiaMeses, "meses")}, contados ${global && temItens ? "da conclusão da montagem de cada item" : "da data do aceite final da obra"}, obrigando-se a corrigir, sem qualquer custo ${global ? "" : "de mão de obra "}para a CONTRATANTE, os defeitos decorrentes de falha de execução.`,
      `A garantia não abrange defeitos decorrentes de: (a) ${global ? "intervenções de terceiros nos serviços executados" : "qualidade ou inadequação dos materiais fornecidos pela CONTRATANTE"}; (b) desgaste natural, mau uso ou ausência de manutenção; e (c) ${global ? "eventos climáticos extremos" : "intervenções realizadas por terceiros nos serviços executados"}.`,
    ]);
  }

  const atraso = [];
  if (lig("tolerancia")) atraso.push(`Ultrapassado o prazo da {{cl:prazo}} sem causa justificada, a multa por atraso somente será exigível após decorridos ${numCtr(c.toleranciaDias, "dias corridos")} do término do prazo contratual, não incidindo qualquer penalidade dentro desse período de tolerância.`);
  if (lig("multa")) atraso.push(`${lig("tolerancia") ? "Decorrido o prazo de tolerância previsto no item anterior, " : `Ultrapassado o prazo da {{cl:prazo}} sem causa justificada, `}${ela} ficará sujeit${a_o} à multa de ${pctCtr(c.multaDiaPct)} do valor total do contrato por dia de atraso, limitada a ${pctCtr(c.multaTetoPct)} do valor total.`);
  atraso.push("A paralisação dos serviços por prazo superior a 10 (dez) dias corridos, sem justificativa aceita pela CONTRATANTE, caracteriza inadimplemento contratual.");
  add("atraso", "DO ATRASO E DAS PENALIDADES", atraso);

  add("rescisao", "DA RESCISÃO", [
    "O contrato poderá ser rescindido por qualquer das partes, em caso de descumprimento de suas cláusulas, mediante notificação escrita com prazo de 10 (dez) dias para a correção da falha apontada.",
    "É facultada a rescisão imotivada por qualquer das partes, mediante aviso prévio escrito de 15 (quinze) dias.",
    `Em qualquer hipótese de rescisão, as partes apurarão de comum acordo o valor correspondente aos serviços efetivamente executados até a data, que será pago ${aEla}, deduzidos eventuais valores devidos à CONTRATANTE.`,
  ]);

  add("vinculo", "DA AUSÊNCIA DE VÍNCULO", [
    `O presente contrato não gera vínculo empregatício, societário ou de qualquer outra natureza entre as partes, tampouco entre a CONTRATANTE e os empregados, prepostos ou auxiliares ${dela}.`,
    `Caso a CONTRATANTE venha a ser demandada judicial ou administrativamente em razão de obrigação de responsabilidade ${dela}, est${a_o} se obriga a assumir a defesa e a reembolsar integralmente os valores que a CONTRATANTE for compelida a desembolsar, inclusive custas e honorários.`,
  ]);

  add("gerais", "DAS DISPOSIÇÕES GERAIS", [
    temItens && "O quadro de itens do item {{it:itens}} é parte integrante e inseparável deste contrato.",
    temAnexo && "O ANEXO I — Descritivo dos Serviços é parte integrante e inseparável deste contrato.",
    "Qualquer alteração deste contrato somente terá validade se formalizada por escrito e assinada por ambas as partes.",
    "A tolerância de qualquer das partes quanto ao descumprimento de obrigação da outra constitui mera liberalidade, não implicando novação, renúncia ou alteração do pactuado.",
    "As comunicações entre as partes serão feitas por escrito, admitidos os meios eletrônicos usualmente utilizados por elas.",
  ]);

  add("foro", "DO FORO", [
    `As partes elegem o foro da Comarca de ${foro || "______________________"}, Estado de ${(cliente && cliente.estado) || "São Paulo"}, para dirimir quaisquer dúvidas ou controvérsias oriundas deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.`,
  ]);

  }

  // ── Numeração e referências cruzadas ──
  const indices = {};
  cl.forEach((x, i) => { indices[x.id] = i; });
  const refCl = (id) => (indices[id] === undefined ? "" : `Cláusula ${ordinalCapCtr(indices[id])}`);
  const refIt = (marca) => {
    const m2 = marcas[marca];
    if (!m2 || indices[m2.id] === undefined) return "";
    return `${indices[m2.id] + 1}.${m2.i + 1}`;
  };
  const resolver = (t) => String(t)
    .replace(/\{\{cl:(\w+)\}\}/g, (_, id) => refCl(id))
    .replace(/\{\{it:(\w+)\}\}/g, (_, marca) => refIt(marca));
  const simples = m.numeracao === "simples";
  const clausulas = cl.map((x, i) => ({
    id: x.id,
    titulo: simples ? `${i + 1} ${x.nome}` : `CLÁUSULA ${CTR_ORDINAIS[i] || `${i + 1}ª`} — ${x.nome}`,
    subtitulo: x.subtitulo || "",
    // no estilo simples, cláusula de um item só é parágrafo corrido
    itens: x.itens.map((t, j) => (simples && x.itens.length === 1 ? resolver(t) : `${i + 1}.${j + 1}${simples ? "" : "."} ${resolver(t)}`)),
    tabelaItens: !!x.tabelaItens,
    tabelaParcelas: !!x.tabelaParcelas,
    // índice do item que anuncia a tabela — ela é desenhada logo abaixo dele
    tabelaItensApos: x.tabelaItensApos == null ? null : x.tabelaItensApos,
    tabelaParcelasApos: x.tabelaParcelasApos == null ? null : x.tabelaParcelasApos,
  }));

  return {
    modelo: m, global, total,
    modalidade: modo,
    titulo: m.titulo || "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
    mostrarFecho: !m.fechoProprio,
    mostrarSubtitulo: !m.preambuloSimples,
    subtitulo: objetoTexto,
    nomeDoContrato,
    numeroContrato: c.numeroContrato || "",
    escopoFornecimento: escId,
    preambulo, clausulas, tabelaItens, tabelaParcelas,
    anexo,
    cidadeAssinatura: cidadeAss,
    dataAssinaturaExtenso: dataExtensoCtr(c.dataAssinatura),
    assinaturas: [
      { nome: contratante.nome, papel: "CONTRATANTE", representante: contratante.representanteNome, cpf: contratante.representanteCpf },
      { nome: contratado.nome, papel: rotuloContratado, representante: contratado.representanteNome, cpf: contratado.representanteCpf },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
// UI — documento e gerador
// ═══════════════════════════════════════════════════════════════
const CTR_S = {
  doc: { background: "#fff", color: "#1f2a37", fontSize: 12.5, lineHeight: 1.55, maxWidth: 780, margin: "0 auto", padding: "8px 4px" },
  h1: { fontSize: 15, fontWeight: 700, textAlign: "center", letterSpacing: 0.3, margin: 0 },
  h2: { fontSize: 12.5, textAlign: "center", color: "#6b7280", margin: "2px 0 20px" },
  clausula: { fontSize: 12.5, fontWeight: 700, margin: "16px 0 6px" },
  p: { margin: "0 0 6px", textAlign: "justify" },
  tabela: { width: "100%", borderCollapse: "collapse", fontSize: 11.5, margin: "8px 0 12px" },
  th: { textAlign: "left", padding: "6px 8px", borderBottom: "1.5px solid #262421", fontWeight: 700 },
  td: { padding: "6px 8px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top" },
  tdNum: { padding: "6px 8px", borderBottom: "1px solid #e5e7eb", textAlign: "right", whiteSpace: "nowrap" },
  assinatura: { marginTop: 28, textAlign: "center", fontSize: 12 },
  linha: { borderTop: "1px solid #262421", width: 320, margin: "38px auto 4px" },
};
// CSS de impressão: some com a navegação do app e deixa o documento
// ocupar a folha inteira, sem cabeçalho do navegador atrapalhando.
const CTR_PRINT_CSS = `
@media print {
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; overflow: visible !important; }
  /* Com o documento reparentado para o body, basta esconder os irmãos: ele
     imprime como bloco normal e respeita a margem da folha. */
  body[data-vk-imprimindo="1"] > *:not([data-vk-contrato="1"]) { display: none !important; }
  body[data-vk-imprimindo="1"] [data-vk-contrato="1"],
  body[data-vk-imprimindo="1"] [data-vk-contrato="1"] * { visibility: visible !important; }
  body[data-vk-imprimindo="1"] [data-vk-contrato="1"] {
    position: static !important; width: auto !important; max-width: none !important;
    margin: 0 !important; padding: 0 !important; overflow: visible !important;
  }
  /* Sem o reparent (navegador sem beforeprint), cai no recurso antigo. */
  body:not([data-vk-imprimindo="1"]) * { visibility: hidden !important; }
  body:not([data-vk-imprimindo="1"]) [data-vk-contrato="1"],
  body:not([data-vk-imprimindo="1"]) [data-vk-contrato="1"] * { visibility: visible !important; }
  body:not([data-vk-imprimindo="1"]) [data-vk-contrato="1"] { position: absolute; left: 0; top: 0; width: 100%; max-width: none; padding: 0; }
  [data-vk-noprint="1"] { display: none !important; }
  [data-vk-contrato="1"] table { page-break-inside: auto; }
  [data-vk-contrato="1"] tr { page-break-inside: avoid; }
  @page { size: A4; margin: 18mm 16mm; }
}
`;
// Campo numérico com máscara ao digitar: moeda (1.234,56), percentual
// (0,50%) ou inteiro (1.200). O contrato guarda o número puro; a máscara é
// só o que aparece na tela.
function CampoCtrNum({ tipo, valor, onChange, style, placeholder, disabled }) {
  const casas = tipo === "inteiro" ? 0 : 2;
  const texto = tipo === "moeda" ? textoMoedaCampo(valor) : tipo === "pct" ? textoPctCampo(valor) : textoInteiroCampo(valor);
  return (
    <input style={style} disabled={disabled} inputMode="decimal" placeholder={placeholder} value={texto}
      onChange={(e) => onChange(digitandoNumero(texto, e.target.value, casas))} />
  );
}

function ContratoDocumento({ contrato, cliente, obra, prestador }) {
  const d = montarContrato(contrato, { cliente, obra, prestador });
  const alvo = useRef(null);
  useEffect(() => {
    const tag = document.createElement("style");
    tag.setAttribute("data-vk-contrato-print", "1");
    tag.textContent = CTR_PRINT_CSS;
    document.head.appendChild(tag);
    return () => { try { document.head.removeChild(tag); } catch (e) { /* já removido */ } };
  }, []);
  // Na hora de imprimir, o documento sobe para o body. Dentro dos painéis do
  // app ele herdava larguras e recortes que cortavam o texto nas laterais da
  // folha; solto no body, ele ocupa exatamente a área útil da página.
  useEffect(() => {
    const el = alvo.current;
    if (!el || typeof window === "undefined" || !window.addEventListener) return;
    const pai = el.parentNode, proximo = el.nextSibling;
    let movido = false;
    const antes = () => {
      if (movido) return;
      try { document.body.appendChild(el); document.body.setAttribute("data-vk-imprimindo", "1"); movido = true; } catch (e) { /* segue no lugar */ }
    };
    const depois = () => {
      if (!movido) return;
      try { if (pai) pai.insertBefore(el, proximo); } catch (e) { /* nó já removido */ }
      try { document.body.removeAttribute("data-vk-imprimindo"); } catch (e) { /* ignora */ }
      movido = false;
    };
    window.addEventListener("beforeprint", antes);
    window.addEventListener("afterprint", depois);
    return () => {
      window.removeEventListener("beforeprint", antes);
      window.removeEventListener("afterprint", depois);
      depois();
    };
  }, []);
  const moeda = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const tabelaItensEl = (k) => (
    <table key={k} style={CTR_S.tabela}>
      <thead><tr><th style={{ ...CTR_S.th, width: 44 }}>Item</th><th style={CTR_S.th}>Descrição do serviço</th><th style={{ ...CTR_S.th, textAlign: "right" }}>Valor (R$)</th></tr></thead>
      <tbody>
        {d.tabelaItens.map((it) => (
          <tr key={it.n}><td style={CTR_S.td}>{it.n}</td><td style={CTR_S.td}>{it.descricao}</td><td style={CTR_S.tdNum}>{moeda(it.valor)}</td></tr>
        ))}
        <tr><td style={{ ...CTR_S.td, fontWeight: 700 }} /><td style={{ ...CTR_S.td, fontWeight: 700 }}>VALOR TOTAL</td><td style={{ ...CTR_S.tdNum, fontWeight: 700 }}>{moeda(d.total)}</td></tr>
      </tbody>
    </table>
  );
  const tabelaParcelasEl = (k) => (
    <table key={k} style={CTR_S.tabela}>
      <thead><tr><th style={{ ...CTR_S.th, width: 44 }}>Item</th><th style={CTR_S.th}>Serviço</th><th style={{ ...CTR_S.th, textAlign: "right" }}>1ª parcela</th><th style={{ ...CTR_S.th, textAlign: "right" }}>2ª parcela</th></tr></thead>
      <tbody>
        {d.tabelaParcelas.map((it) => (
          <tr key={it.n}><td style={CTR_S.td}>{it.n}</td><td style={CTR_S.td}>{it.descricao}</td><td style={CTR_S.tdNum}>{moeda(it.p1)}</td><td style={CTR_S.tdNum}>{moeda(it.p2)}</td></tr>
        ))}
        <tr>
          <td style={CTR_S.td} /><td style={{ ...CTR_S.td, fontWeight: 700 }}>TOTAIS</td>
          <td style={{ ...CTR_S.tdNum, fontWeight: 700 }}>{moeda(d.tabelaParcelas.reduce((a, i) => a + i.p1, 0))}</td>
          <td style={{ ...CTR_S.tdNum, fontWeight: 700 }}>{moeda(d.tabelaParcelas.reduce((a, i) => a + i.p2, 0))}</td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <div style={CTR_S.doc} data-vk-contrato="1" ref={alvo}>
      <h1 style={CTR_S.h1}>{(d.mostrarSubtitulo === false ? d.titulo : (d.nomeDoContrato || d.titulo)).toUpperCase()}</h1>
      {d.numeroContrato ? <div style={{ ...CTR_S.h2, margin: "2px 0 0" }}>{`Contrato nº ${d.numeroContrato}`}</div> : null}
      {d.mostrarSubtitulo === false ? <div style={{ height: 14 }} /> : <div style={CTR_S.h2}>{d.subtitulo}</div>}
      {d.preambulo.map((t, i) => <p key={i} style={CTR_S.p}>{t}</p>)}
      {d.clausulas.map((cl, i) => (
        <div key={i}>
          {cl.subtitulo ? <div style={{ ...CTR_S.clausula, marginTop: 20 }}>{cl.subtitulo}</div> : null}
          <div style={CTR_S.clausula}>{cl.titulo}</div>
          {cl.itens.flatMap((t, j) => {
            // A tabela é desenhada logo abaixo do item que a anuncia — não no
            // fim da cláusula, senão ela cai depois das exclusões do objeto.
            const saida = [<p key={`p${j}`} style={CTR_S.p}>{t}</p>];
            if (cl.tabelaItens && cl.tabelaItensApos === j) saida.push(tabelaItensEl(`ti${j}`));
            if (cl.tabelaParcelas && cl.tabelaParcelasApos === j) saida.push(tabelaParcelasEl(`tp${j}`));
            return saida;
          })}
          {cl.tabelaItens && cl.tabelaItensApos == null ? tabelaItensEl("ti") : null}
          {cl.tabelaParcelas && cl.tabelaParcelasApos == null ? tabelaParcelasEl("tp") : null}
        </div>
      ))}

      {d.mostrarFecho === false ? null : (
        <p style={{ ...CTR_S.p, marginTop: 18 }}>E, por estarem assim justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença das 2 (duas) testemunhas abaixo.</p>
      )}
      <p style={{ ...CTR_S.p, textAlign: "center", marginTop: 14 }}>{`${d.cidadeAssinatura || "______________________"}, ${d.dataAssinaturaExtenso || "______ de ____________________ de __________"}.`}</p>
      {d.assinaturas.map((a, i) => (
        <div key={i} style={CTR_S.assinatura}>
          <div style={CTR_S.linha} />
          <div style={{ fontWeight: 700 }}>{(a.nome || "").toUpperCase()}</div>
          <div>{a.representante ? `${a.representante} — ${a.papel}` : a.papel}</div>
          {a.cpf ? <div style={{ color: "#6b7280" }}>CPF {a.cpf}</div> : null}
        </div>
      ))}
      <div style={{ ...CTR_S.assinatura, marginTop: 26, fontWeight: 700 }}>TESTEMUNHAS</div>
      {[0, 1].map((i) => (
        <div key={i} style={CTR_S.assinatura}>
          <div style={CTR_S.linha} />
          <div>Nome: ______________________________</div>
          <div>CPF: ______________________________</div>
        </div>
      ))}

      {d.anexo.length > 0 && (
        <div style={{ pageBreakBefore: "always", breakBefore: "page", marginTop: 40 }}>
          <h1 style={CTR_S.h1}>ANEXO I — DESCRITIVO DOS SERVIÇOS</h1>
          <div style={CTR_S.h2}>Escopo de execução</div>
          {d.anexo.map((e, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              {e.titulo ? <div style={{ ...CTR_S.clausula, margin: "12px 0 4px" }}>{`${i + 1}. ${e.titulo}`}</div> : null}
              {String(e.texto || "").split("\n").filter(Boolean).map((linha, j) => <p key={j} style={CTR_S.p}>{linha}</p>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
