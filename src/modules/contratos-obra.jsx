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
// O contrato gerado fica em data.contratos, junto do cadastro que já
// existia, com o valor, o status e o texto montado a partir dos campos —
// o documento é remontado na hora de exibir, então corrigir um dado do
// cliente ou do prestador atualiza o contrato.

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
  { id: "carpinteiro", nome: "Carpinteiro", categorias: ["Carpinteiro"], modelo: "empreitadaMaoDeObra",
    objeto: "Formas e madeiramento — mão de obra", insumos: ["PRE-005"] },
  { id: "eletricista", nome: "Eletricista", categorias: ["Eletricista"], modelo: "empreitadaMaoDeObra",
    objeto: "Instalações elétricas — mão de obra", insumos: ["PRE-003"] },
  { id: "empreiteiro", nome: "Empreiteiro", categorias: ["Empreiteiro", "Pedreiro"], modelo: "empreitadaMaoDeObra",
    objeto: "Empreitada de mão de obra — obra civil", insumos: ["PRE-001", "PRE-009", "PRE-010", "PRE-011", "PRE-012"] },
  { id: "encanador", nome: "Encanador", categorias: ["Encanador"], modelo: "empreitadaMaoDeObra",
    objeto: "Instalações hidrossanitárias — mão de obra", insumos: ["PRE-004"] },
  { id: "gesseiro", nome: "Gesseiro", categorias: ["Gesseiro"], modelo: "empreitadaGlobal",
    objeto: "Fornecimento e execução de forro e revestimento em gesso", insumos: [] },
  { id: "gestaoObra", nome: "Gestão de obra", categorias: ["Gestão de Obra"], modelo: "empreitadaMaoDeObra",
    objeto: "Prestação de serviços de gestão e acompanhamento de obra", insumos: ["PRE-017"] },
  { id: "impermeabilizador", nome: "Impermeabilizador", categorias: ["Impermeabilizador"], modelo: "empreitadaGlobal",
    objeto: "Fornecimento e aplicação de impermeabilização", insumos: ["PRE-006"] },
  { id: "instaladorAquecedores", nome: "Instalador de aquecedores", categorias: ["Instalador de Aquecedores"], modelo: "empreitadaGlobal",
    objeto: "Fornecimento e instalação de aquecedores", insumos: ["PRE-014"] },
  { id: "instaladorAr", nome: "Instalador de ar condicionado", categorias: ["Instalador de Ar Condicionado"], modelo: "empreitadaGlobal",
    objeto: "Fornecimento e instalação de equipamentos de ar condicionado", insumos: ["PRE-013"] },
  { id: "equipPiscina", nome: "Instalador de equipamentos de piscina", categorias: ["Instalador de Equipamentos de Piscina"], modelo: "empreitadaGlobal",
    objeto: "Fornecimento e instalação de equipamentos de piscina", insumos: ["PRE-015"] },
  { id: "marceneiro", nome: "Marceneiro", categorias: ["Marceneiro"], modelo: "empreitadaGlobal",
    objeto: "Fornecimento e instalação de marcenaria", insumos: ["PRE-007"] },
  { id: "pintor", nome: "Pintor", categorias: ["Pintor"], modelo: "empreitadaMaoDeObra",
    objeto: "Pintura — mão de obra", insumos: ["PRE-002"] },
  { id: "serralheiro", nome: "Serralheiro", categorias: ["Serralheiro", "Esquadria de Alumínio"], modelo: "empreitadaGlobal",
    objeto: "Fornecimento e montagem de estruturas e esquadrias metálicas", insumos: ["PRE-008"] },
  { id: "terraplanagem", nome: "Terraplanagem", categorias: ["Terraplanagem"], modelo: "empreitadaGlobal",
    objeto: "Serviços de terraplanagem e movimentação de terra", insumos: ["PRE-016"] },
  // "Outro" fecha a lista de propósito — é a saída para o que não tem tipo.
  { id: "outro", nome: "Outro", categorias: [], modelo: "empreitadaMaoDeObra", objeto: "", insumos: [] },
];
function tipoProfissional(id) { return TIPOS_PROFISSIONAL.find((t) => t.id === id) || null; }
// Prestadores compatíveis com o tipo escolhido. Sem tipo (ou tipo "Outro",
// ou nenhum prestador daquela categoria cadastrado) devolve a lista inteira
// em vez de um select vazio.
function prestadoresDoTipo(prestadores, tipoId) {
  const ativos = (prestadores || []).filter((p) => p.ativo !== false);
  const t = tipoProfissional(tipoId);
  if (!t || !t.categorias.length) return ativos;
  const alvo = t.categorias.map((c) => c.toLowerCase());
  const casa = ativos.filter((p) => alvo.includes(String(p.categoria || "").toLowerCase()));
  return casa.length ? casa : ativos;
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
    partes.push(`neste ato representada por ${String(o.representanteNome).toUpperCase()}${o.representanteCpf ? `, inscrito no CPF sob o nº ${o.representanteCpf}` : ""}`);
  }
  return partes.join(", ");
}
function enderecoLinha(o) {
  const x = o || {};
  return [x.logradouro, x.numero && `nº ${x.numero}`, x.bairro, [x.cidade, x.estado].filter(Boolean).join("/"), x.cep && `CEP ${x.cep}`].filter(Boolean).join(", ");
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

// ── Dados de partida de um contrato novo ────────────────────────
function contratoVazio(modeloId, clienteId, obraId, tipoId) {
  const m = contratoModelo(modeloId);
  const t = tipoProfissional(tipoId);
  return {
    id: (typeof uid === "function" ? uid() : String(Date.now())),
    clienteId, obraId,
    gerado: true,
    modelo: m.id,
    tipoProfissional: t ? t.id : "",
    prestadorId: "",
    nomeContratado: "",
    objeto: t ? t.objeto : "",
    enderecoObra: "",
    exclusoes: "",
    itens: m.id === "empreitadaGlobal" ? [{ descricao: "", valor: "" }] : [],
    escopo: m.id === "empreitadaMaoDeObra" ? [{ titulo: "", texto: "" }] : [],
    valor: "",
    prazoMeses: m.padrao.prazoMeses || "",
    prazoDias: m.padrao.prazoDias || "",
    parcelas: m.padrao.parcelas || "",
    periodicidade: m.padrao.periodicidade || "quinzenais",
    retemUltima: !!m.padrao.retemUltima,
    entradaPct: m.padrao.entradaPct || "",
    garantiaMeses: m.padrao.garantiaMeses,
    toleranciaDias: m.padrao.toleranciaDias,
    multaDiaPct: m.padrao.multaDiaPct,
    multaTetoPct: m.padrao.multaTetoPct,
    foro: "",
    cidadeAssinatura: "",
    status: "pendente",
    dataAssinatura: "", dataVencimento: "",
    descricaoServico: "", observacoes: "",
    criadoEm: new Date().toISOString(),
  };
}
// Valor total: no modelo global é a soma dos itens; no de mão de obra, o
// valor digitado.
function valorContrato(c) {
  const o = c || {};
  if (o.modelo === "empreitadaGlobal" && Array.isArray(o.itens) && o.itens.length) {
    return o.itens.reduce((acc, i) => acc + (Number(i && i.valor) || 0), 0);
  }
  return Number(o.valor) || 0;
}
// Parcelas do modelo de mão de obra: divide o total e joga o resíduo de
// arredondamento na última, como nos contratos do escritório.
function parcelasContrato(total, n) {
  const qtd = Math.max(1, Math.floor(Number(n) || 1));
  // Arredonda ao centavo (não trunca) e joga a diferença na última parcela —
  // é como o escritório fecha: 128.000 ÷ 14 = 13 × 9.142,86 + 9.142,82.
  const base = Math.round((total / qtd) * 100) / 100;
  const ultima = Math.round((total - base * (qtd - 1)) * 100) / 100;
  return { qtd, base, ultima, iguais: Math.abs(base - ultima) < 0.005 };
}

// ── Montagem do documento ───────────────────────────────────────
// Devolve { titulo, subtitulo, preambulo, clausulas: [{ titulo, itens }],
// tabelaItens, tabelaParcelas, anexo, assinaturas } — a tela só desenha.
function montarContrato(contrato, { cliente, obra, prestador }) {
  const c = contrato || {};
  const m = contratoModelo(c.modelo);
  const global = m.id === "empreitadaGlobal";
  const total = valorContrato(c);
  const contratante = {
    tipo: (cliente && cliente.tipo) || "PJ",
    nome: (cliente && cliente.nome) || "",
    cnpjCpf: (cliente && cliente.cpfCnpj) || "",
    logradouro: cliente && cliente.logradouro, numero: cliente && cliente.numero,
    bairro: cliente && cliente.bairro, cidade: cliente && cliente.cidade,
    estado: cliente && cliente.estado, cep: cliente && cliente.cep,
    representanteNome: (cliente && cliente.representanteNome) || ((cliente && cliente.contatos && cliente.contatos[0] && cliente.contatos[0].nome) || ""),
    representanteCpf: (cliente && cliente.representanteCpf) || "",
  };
  const contratado = prestador || { nome: c.nomeContratado || "" };
  const rotuloContratado = global ? "CONTRATADA" : "CONTRATADO";
  const ela = global ? "a CONTRATADA" : "o CONTRATADO";      // sujeito
  const aEla = global ? "à CONTRATADA" : "ao CONTRATADO";    // objeto indireto
  const dela = global ? "da CONTRATADA" : "do CONTRATADO";
  const enderecoObra = c.enderecoObra || enderecoDaObra(obra, cliente);
  const foro = c.foro || (cliente && cliente.cidade) || "";
  const cidadeAss = c.cidadeAssinatura || (cliente && cliente.cidade ? `${cliente.cidade}/${cliente.estado || "SP"}` : "");

  const preambulo = [
    "Pelo presente instrumento particular, de um lado:",
    `CONTRATANTE: ${qualificarParte(contratante)}, doravante denominada simplesmente CONTRATANTE;`,
    "e, de outro lado:",
    `${rotuloContratado}: ${qualificarParte(contratado)}, doravante denominada simplesmente ${rotuloContratado};`,
    `têm entre si justo e contratado o presente Contrato de Prestação de Serviços de ${global ? "Fornecimento e Montagem" : "Empreitada de Mão de Obra"}, que se regerá pelas cláusulas e condições a seguir estabelecidas.`,
  ];

  const clausulas = [];
  // 1 — Objeto
  const objeto = [];
  if (global) {
    objeto.push(`1.1. O presente contrato tem por objeto o fornecimento, a fabricação, o transporte e a montagem, pela CONTRATADA, dos serviços discriminados no item 1.3, a serem executados no imóvel situado na ${enderecoObra}, doravante denominado simplesmente OBRA.`);
    objeto.push("1.2. Os serviços serão executados de forma autônoma e coordenada com as demais frentes da obra.");
    objeto.push("1.3. Compõem o objeto deste contrato os seguintes itens e respectivos valores:");
  } else {
    objeto.push(`1.1. O presente contrato tem por objeto a execução, pelo CONTRATADO, dos serviços ${c.objeto ? `de ${c.objeto}` : "discriminados no Descritivo dos Serviços"}, que integra este instrumento como ANEXO I.`);
    objeto.push(`1.2. Os serviços serão executados no imóvel situado na ${enderecoObra}, doravante denominado simplesmente OBRA.`);
  }
  if (c.exclusoes) objeto.push(`1.${global ? 4 : 3}. Não integram o objeto deste contrato: ${c.exclusoes}`);
  clausulas.push({ titulo: "CLÁUSULA PRIMEIRA — DO OBJETO", itens: objeto, tabelaItens: global });

  // 2 — Regime
  const regime = global ? [
    "2.1. Os serviços serão executados sob o regime de empreitada global, compreendendo o fornecimento de todo o material, os consumíveis e os acessórios, bem como a fabricação, o transporte, a descarga e a montagem no local da OBRA.",
    "2.2. Correm por conta exclusiva da CONTRATADA a locação ou a compra de quaisquer ferramentas e equipamentos necessários à execução dos serviços, incluindo os meios de içamento e acesso, bem como os equipamentos de proteção individual e coletiva de sua equipe, sem qualquer custo adicional para a CONTRATANTE.",
    "2.3. A CONTRATADA é responsável pelo dimensionamento dos elementos objeto deste contrato, respondendo pela sua adequação às cargas e às condições de uso previstas.",
    "2.4. Os serviços observarão as normas técnicas aplicáveis.",
  ] : [
    "2.1. Os serviços serão executados sob o regime de empreitada de mão de obra, cabendo ao CONTRATADO o fornecimento da mão de obra necessária à integral execução do objeto.",
    "2.2. Todo o material de construção necessário à execução dos serviços será fornecido pelo CONTRATANTE, às suas expensas.",
    "2.3. As ferramentas básicas necessárias à execução dos serviços serão fornecidas pelo CONTRATADO, por sua conta, assim como os equipamentos de proteção individual (EPI) utilizados por sua equipe.",
    "2.4. As demais ferramentas e equipamentos serão fornecidos pelo CONTRATANTE, às suas expensas, tais como andaimes, marteletes, escoras metálicas, caçambas de entulho, entre outros de natureza semelhante.",
  ];
  clausulas.push({ titulo: "CLÁUSULA SEGUNDA — DO REGIME DE EXECUÇÃO", itens: regime });

  // 3 — Prazo
  const prazo = [];
  if (global) {
    prazo.push(`3.1. O prazo para a execução integral dos serviços é de ${numExtensoCtr(Number(c.prazoDias) || 0)} dias corridos, contados da data em que a CONTRATANTE comunicar formalmente à CONTRATADA que a OBRA está liberada para o início dos trabalhos.`);
    prazo.push("3.2. A comunicação de liberação da OBRA será feita por escrito, admitido o meio eletrônico, e a respectiva data será considerada o marco inicial do prazo.");
    prazo.push("3.3. O prazo será prorrogado, por período equivalente ao da paralisação, nas seguintes hipóteses: (a) atraso da CONTRATANTE ou de seus demais contratados na liberação das frentes de trabalho; (b) condições climáticas que impeçam a execução; (c) alterações ou acréscimos de escopo solicitados pela CONTRATANTE; e (d) caso fortuito ou força maior.");
  } else {
    prazo.push(`3.1. O prazo para a execução integral dos serviços é de ${numExtensoCtr(Number(c.prazoMeses) || 0)} meses, contados de ${c.dataInicio ? fmtDataCtr(c.dataInicio) : "______/______/__________"}, data prevista para o início dos trabalhos.`);
    prazo.push("3.2. O prazo será prorrogado, por período equivalente ao da paralisação, nas seguintes hipóteses: (a) chuvas ou condições climáticas que impeçam a execução dos serviços; (b) atraso na entrega dos materiais a cargo do CONTRATANTE; (c) alterações ou acréscimos de escopo solicitados pelo CONTRATANTE; e (d) caso fortuito ou força maior.");
    prazo.push("3.3. As prorrogações e as paralisações deverão ser registradas por escrito entre as partes, admitido o meio eletrônico.");
  }
  clausulas.push({ titulo: "CLÁUSULA TERCEIRA — DO PRAZO DE EXECUÇÃO", itens: prazo });

  // 4 — Preço e pagamento
  const pag = [`4.1. Pela integral execução dos serviços, a CONTRATANTE pagará ${aEla} o valor total de ${fmtMoedaCtr(total)} (${moedaExtensoCtr(total)})${global ? ", correspondente à soma dos itens discriminados no item 1.3" : ""}.`];
  if (global) {
    pag.push(`4.2. O pagamento será realizado item a item, na proporção de ${numExtensoCtr(Number(c.entradaPct) || 50)}% do valor do respectivo item a título de entrada, na liberação de cada item para produção, e o restante na conclusão da montagem do mesmo item, conforme o quadro abaixo:`);
    pag.push("4.3. A conclusão de cada item será verificada pela CONTRATANTE em até 5 (cinco) dias úteis da comunicação da CONTRATADA, liberando-se o respectivo saldo caso não haja pendências apontadas por escrito.");
    pag.push("4.4. Os pagamentos serão efetuados por transferência bancária ou PIX, em conta de titularidade da CONTRATADA, informada por escrito.");
    pag.push(`4.5. O atraso no pagamento de qualquer parcela sujeitará a CONTRATANTE à multa de 2% (dois por cento) sobre o valor em atraso, acrescida de juros de 1% (um por cento) ao mês, calculados pro rata die.`);
    pag.push("4.6. Os valores acima são fixos e irreajustáveis pelo prazo deste contrato e compreendem todos os custos diretos e indiretos, materiais, transporte, mão de obra, tributos e encargos incidentes sobre os serviços.");
  } else {
    const p = parcelasContrato(total, c.parcelas);
    pag.push(p.iguais
      ? `4.2. O valor total será dividido em ${numExtensoCtr(p.qtd)} parcelas ${c.periodicidade || "quinzenais"} e sucessivas, no valor de ${fmtMoedaCtr(p.base)} (${moedaExtensoCtr(p.base)}) cada.`
      : `4.2. O valor total será dividido em ${numExtensoCtr(p.qtd)} parcelas ${c.periodicidade || "quinzenais"} e sucessivas, sendo ${numExtensoCtr(p.qtd - 1)} parcelas no valor de ${fmtMoedaCtr(p.base)} (${moedaExtensoCtr(p.base)}) cada e a última no valor de ${fmtMoedaCtr(p.ultima)} (${moedaExtensoCtr(p.ultima)}), ajustada em razão de arredondamento.`);
    if ((c.periodicidade || "quinzenais") === "quinzenais") {
      pag.push("4.3. Os pagamentos serão realizados sempre às sextas-feiras, em quinzenas alternadas e no período da manhã, vencendo-se a primeira parcela na segunda sexta-feira contada do início dos serviços e as demais a cada 15 (quinze) dias subsequentes.");
    } else {
      pag.push("4.3. Os pagamentos serão realizados mensalmente, vencendo-se a primeira parcela 30 (trinta) dias após o início dos serviços e as demais a cada 30 (trinta) dias subsequentes.");
    }
    if (c.retemUltima) pag.push("4.4. A última parcela ficará retida pelo CONTRATANTE, a título de garantia de execução, e será paga somente após a conclusão total da obra e o respectivo aceite final do CONTRATANTE.");
    pag.push("4.5. Os pagamentos serão efetuados por transferência bancária ou PIX, em conta de titularidade do CONTRATADO, informada por escrito.");
    pag.push("4.6. O atraso no pagamento de qualquer parcela sujeitará o CONTRATANTE à multa de 2% (dois por cento) sobre o valor em atraso, acrescida de juros de 1% (um por cento) ao mês, calculados pro rata die.");
    pag.push("4.7. O preço ajustado remunera exclusivamente a mão de obra, nele não se incluindo qualquer material, locação de equipamentos ou serviço de terceiros.");
  }
  clausulas.push({ titulo: "CLÁUSULA QUARTA — DO PREÇO E DA FORMA DE PAGAMENTO", itens: pag, tabelaParcelas: global });

  // 5 e 6 — obrigações
  clausulas.push({
    titulo: `CLÁUSULA QUINTA — DAS OBRIGAÇÕES ${global ? "DA CONTRATADA" : "DO CONTRATADO"}`,
    itens: [
      "5.1. Executar os serviços com zelo, técnica e qualidade, em observância ao objeto contratado e às boas práticas aplicáveis.",
      "5.2. Manter na OBRA equipe própria, qualificada e em número suficiente ao cumprimento do prazo pactuado.",
      "5.3. Fornecer e exigir o uso de EPI por toda a sua equipe, observando as normas de segurança e medicina do trabalho.",
      "5.4. Responsabilizar-se integralmente pelos encargos trabalhistas, previdenciários, fiscais e securitários relativos aos seus empregados e prepostos.",
      global
        ? "5.5. Fornecer materiais novos, de primeira qualidade e adequados à finalidade, respondendo por sua procedência."
        : "5.5. Zelar pelos materiais colocados à sua disposição pelo CONTRATANTE, respondendo por perdas decorrentes de desperdício, mau uso ou negligência de sua equipe.",
      "5.6. Manter a obra organizada, promover a remoção do entulho gerado e entregar os ambientes limpos ao término de cada etapa.",
      `5.7. Refazer ou corrigir, sem ônus ${global ? "" : "de mão de obra "}para a CONTRATANTE, os serviços executados em desacordo com o contratado ou com as boas práticas técnicas.`,
      "5.8. Responder pelos danos que causar à CONTRATANTE, à OBRA ou a terceiros, por ação ou omissão de sua equipe.",
      "5.9. Não subcontratar, no todo ou em parte, os serviços objeto deste contrato sem prévia e expressa autorização escrita da CONTRATANTE.",
    ],
  });
  clausulas.push({
    titulo: "CLÁUSULA SEXTA — DAS OBRIGAÇÕES DA CONTRATANTE",
    itens: [
      global
        ? "6.1. Comunicar formalmente a liberação da OBRA para o início dos serviços e manter as frentes de trabalho disponíveis e desimpedidas, inclusive as bases e fundações de apoio."
        : "6.1. Fornecer, em tempo hábil e em quantidade suficiente, todo o material necessário à execução dos serviços, bem como as ferramentas e os equipamentos a seu cargo.",
      `6.2. Franquear ${aEla} o livre acesso à OBRA e disponibilizar água e energia elétrica para a execução dos trabalhos.`,
      "6.3. Efetuar os pagamentos nas condições e nos prazos ajustados na Cláusula Quarta.",
      "6.4. Acompanhar e fiscalizar a execução dos serviços, apontando por escrito eventuais inconformidades para correção.",
    ],
  });

  // 7 a 13 — comuns
  clausulas.push({
    titulo: "CLÁUSULA SÉTIMA — DOS SERVIÇOS EXTRAORDINÁRIOS",
    itens: [
      `7.1. Qualquer serviço não previsto ${global ? "no item 1.3" : "no ANEXO I"} somente será executado mediante acordo prévio e escrito entre as partes, com a definição do respectivo valor e do impacto no prazo, por meio de termo aditivo.`,
      `7.2. A execução de serviço extraordinário sem o correspondente aditivo escrito não gerará ${aEla} direito a pagamento adicional.`,
    ],
  });
  clausulas.push({
    titulo: "CLÁUSULA OITAVA — DA GARANTIA",
    itens: [
      `8.1. ${global ? "A CONTRATADA garante os serviços e os materiais fornecidos" : "O CONTRATADO garante os serviços executados"} pelo prazo de ${numExtensoCtr(Number(c.garantiaMeses) || 6)} meses, contados ${global ? "da conclusão da montagem de cada item" : "da data do aceite final da obra"}, obrigando-se a corrigir, sem qualquer custo ${global ? "" : "de mão de obra "}para a CONTRATANTE, os defeitos decorrentes de falha de execução.`,
      `8.2. A garantia não abrange defeitos decorrentes de: (a) ${global ? "intervenções de terceiros nos serviços executados" : "qualidade ou inadequação dos materiais fornecidos pela CONTRATANTE"}; (b) desgaste natural, mau uso ou ausência de manutenção; e (c) ${global ? "eventos climáticos extremos" : "intervenções realizadas por terceiros nos serviços executados"}.`,
    ],
  });
  clausulas.push({
    titulo: "CLÁUSULA NONA — DO ATRASO E DAS PENALIDADES",
    itens: [
      `9.1. Ultrapassado o prazo da Cláusula Terceira sem causa justificada, a multa por atraso somente será exigível após decorridos ${numExtensoCtr(Number(c.toleranciaDias) || 45)} dias corridos do término do prazo contratual, não incidindo qualquer penalidade dentro desse período de tolerância.`,
      `9.2. Decorrido o prazo de tolerância previsto no item anterior, ${ela} ficará sujeit${global ? "a" : "o"} à multa de ${String(c.multaDiaPct ?? 0.5).replace(".", ",")}% do valor total do contrato por dia de atraso, limitada a ${String(c.multaTetoPct ?? 10).replace(".", ",")}% do valor total.`,
      `9.3. A paralisação dos serviços por prazo superior a 10 (dez) dias corridos, sem justificativa aceita pela CONTRATANTE, caracteriza inadimplemento contratual.`,
    ],
  });
  clausulas.push({
    titulo: "CLÁUSULA DÉCIMA — DA RESCISÃO",
    itens: [
      "10.1. O contrato poderá ser rescindido por qualquer das partes, em caso de descumprimento de suas cláusulas, mediante notificação escrita com prazo de 10 (dez) dias para a correção da falha apontada.",
      "10.2. É facultada a rescisão imotivada por qualquer das partes, mediante aviso prévio escrito de 15 (quinze) dias.",
      `10.3. Em qualquer hipótese de rescisão, as partes apurarão de comum acordo o valor correspondente aos serviços efetivamente executados até a data, que será pago ${aEla}, deduzidos eventuais valores devidos à CONTRATANTE.`,
    ],
  });
  clausulas.push({
    titulo: "CLÁUSULA DÉCIMA PRIMEIRA — DA AUSÊNCIA DE VÍNCULO",
    itens: [
      `11.1. O presente contrato não gera vínculo empregatício, societário ou de qualquer outra natureza entre as partes, tampouco entre a CONTRATANTE e os empregados, prepostos ou auxiliares ${dela}.`,
      `11.2. Caso a CONTRATANTE venha a ser demandada judicial ou administrativamente em razão de obrigação de responsabilidade ${dela}, est${global ? "a" : "e"} se obriga a assumir a defesa e a reembolsar integralmente os valores que a CONTRATANTE for compelida a desembolsar, inclusive custas e honorários.`,
    ],
  });
  clausulas.push({
    titulo: "CLÁUSULA DÉCIMA SEGUNDA — DAS DISPOSIÇÕES GERAIS",
    itens: [
      global
        ? "12.1. O quadro de itens do item 1.3 é parte integrante e inseparável deste contrato."
        : "12.1. O ANEXO I — Descritivo dos Serviços é parte integrante e inseparável deste contrato.",
      "12.2. Qualquer alteração deste contrato somente terá validade se formalizada por escrito e assinada por ambas as partes.",
      "12.3. A tolerância de qualquer das partes quanto ao descumprimento de obrigação da outra constitui mera liberalidade, não implicando novação, renúncia ou alteração do pactuado.",
      "12.4. As comunicações entre as partes serão feitas por escrito, admitidos os meios eletrônicos usualmente utilizados por elas.",
    ],
  });
  clausulas.push({
    titulo: "CLÁUSULA DÉCIMA TERCEIRA — DO FORO",
    itens: [`13.1. As partes elegem o foro da Comarca de ${foro || "______________________"}, Estado de ${(cliente && cliente.estado) || "São Paulo"}, para dirimir quaisquer dúvidas ou controvérsias oriundas deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.`],
  });

  const tabelaItens = global ? (c.itens || []).filter((i) => i && (i.descricao || Number(i.valor))).map((i, idx) => ({
    n: idx + 1, descricao: i.descricao || "", valor: Number(i.valor) || 0,
  })) : [];
  const pct = (Number(c.entradaPct) || 50) / 100;
  const tabelaParcelas = global ? tabelaItens.map((i) => {
    const p1 = Math.floor(i.valor * pct * 100) / 100;
    return { n: i.n, descricao: i.descricao, p1, p2: Math.round((i.valor - p1) * 100) / 100 };
  }) : [];

  return {
    modelo: m, global, total,
    titulo: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
    subtitulo: c.objeto || m.subtitulo,
    preambulo, clausulas, tabelaItens, tabelaParcelas,
    anexo: !global ? (c.escopo || []).filter((e) => e && (e.titulo || e.texto)) : [],
    cidadeAssinatura: cidadeAss,
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
  body * { visibility: hidden !important; }
  [data-vk-contrato="1"], [data-vk-contrato="1"] * { visibility: visible !important; }
  [data-vk-contrato="1"] { position: absolute; left: 0; top: 0; width: 100%; max-width: none; padding: 0; }
  [data-vk-noprint="1"] { display: none !important; }
  @page { size: A4; margin: 18mm 16mm; }
}
`;
function ContratoDocumento({ contrato, cliente, obra, prestador }) {
  const d = montarContrato(contrato, { cliente, obra, prestador });
  useEffect(() => {
    const tag = document.createElement("style");
    tag.setAttribute("data-vk-contrato-print", "1");
    tag.textContent = CTR_PRINT_CSS;
    document.head.appendChild(tag);
    return () => { try { document.head.removeChild(tag); } catch (e) { /* já removido */ } };
  }, []);
  return (
    <div style={CTR_S.doc} data-vk-contrato="1">
      <h1 style={CTR_S.h1}>{d.titulo}</h1>
      <div style={CTR_S.h2}>{d.subtitulo}</div>
      {d.preambulo.map((t, i) => <p key={i} style={CTR_S.p}>{t}</p>)}
      {d.clausulas.map((cl, i) => (
        <div key={i}>
          <div style={CTR_S.clausula}>{cl.titulo}</div>
          {cl.itens.map((t, j) => <p key={j} style={CTR_S.p}>{t}</p>)}
          {cl.tabelaItens && d.tabelaItens.length > 0 && (
            <table style={CTR_S.tabela}>
              <thead><tr><th style={{ ...CTR_S.th, width: 44 }}>Item</th><th style={CTR_S.th}>Descrição do serviço</th><th style={{ ...CTR_S.th, textAlign: "right" }}>Valor (R$)</th></tr></thead>
              <tbody>
                {d.tabelaItens.map((it) => (
                  <tr key={it.n}><td style={CTR_S.td}>{it.n}</td><td style={CTR_S.td}>{it.descricao}</td><td style={CTR_S.tdNum}>{it.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td></tr>
                ))}
                <tr><td style={{ ...CTR_S.td, fontWeight: 700 }} /><td style={{ ...CTR_S.td, fontWeight: 700 }}>VALOR TOTAL</td><td style={{ ...CTR_S.tdNum, fontWeight: 700 }}>{d.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td></tr>
              </tbody>
            </table>
          )}
          {cl.tabelaParcelas && d.tabelaParcelas.length > 0 && (
            <table style={CTR_S.tabela}>
              <thead><tr><th style={{ ...CTR_S.th, width: 44 }}>Item</th><th style={CTR_S.th}>Serviço</th><th style={{ ...CTR_S.th, textAlign: "right" }}>1ª parcela</th><th style={{ ...CTR_S.th, textAlign: "right" }}>2ª parcela</th></tr></thead>
              <tbody>
                {d.tabelaParcelas.map((it) => (
                  <tr key={it.n}><td style={CTR_S.td}>{it.n}</td><td style={CTR_S.td}>{it.descricao}</td><td style={CTR_S.tdNum}>{it.p1.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td><td style={CTR_S.tdNum}>{it.p2.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td></tr>
                ))}
                <tr>
                  <td style={CTR_S.td} /><td style={{ ...CTR_S.td, fontWeight: 700 }}>TOTAIS</td>
                  <td style={{ ...CTR_S.tdNum, fontWeight: 700 }}>{d.tabelaParcelas.reduce((a, i) => a + i.p1, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td style={{ ...CTR_S.tdNum, fontWeight: 700 }}>{d.tabelaParcelas.reduce((a, i) => a + i.p2, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      ))}

      <p style={{ ...CTR_S.p, marginTop: 18 }}>E, por estarem assim justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença das 2 (duas) testemunhas abaixo.</p>
      <p style={{ ...CTR_S.p, textAlign: "center", marginTop: 14 }}>{d.cidadeAssinatura || "______________________"}, ______ de ____________________ de __________.</p>
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
