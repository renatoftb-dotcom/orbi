// ═══════════════════════════════════════════════════════════════
// CONTAS A PAGAR DA OBRA
// ═══════════════════════════════════════════════════════════════
// Salvar um contrato alimenta o fluxo de contas a pagar da obra: cada
// parcela da modalidade de pagamento vira uma conta com vencimento, valor e
// status. Regravar o contrato atualiza as parcelas em aberto e preserva o
// que já foi pago.
//
// As contas moram dentro da obra (obra.contasPagar) — como os contratos e a
// estimativa —, porque é a obra que o backend grava como documento JSON.
//
// Cada conta carrega o `contaId` do plano de contas (obra-financeiro.jsx),
// de modo que o que for pago já entra no realizado da obra, ao lado da
// estimativa do Planejamento.

// Tipo de profissional → conta do plano de contas. O que não tem conta
// própria cai em "mo_diversos".
const CONTA_POR_TIPO = {
  empreiteiro: "empreiteiro",
  eletricista: "eletricista",
  encanador: "encanador",
  pintor: "pintor",
  carpinteiro: "carpinteiro",
  marceneiro: "marceneiro",
  serralheiro: "serralheiro",
  gesseiro: "gesseiro",
  impermeabilizador: "impermeabilizacao",
  instaladorAr: "instalador_ar",
  terraplanagem: "terraplanagem",
  // o contrato de gestão de obra é o gerenciamento: vai para a conta dele,
  // em SERVIÇOS & TAXAS, e não para a mão de obra
  gestaoObra: "taxa_admin_obra",
  instaladorAquecedores: "mo_diversos",
  equipPiscina: "mo_diversos",
  outro: "mo_diversos",
};
function contaDoTipo(tipoId) {
  const id = CONTA_POR_TIPO[tipoId] || "mo_diversos";
  return (typeof PLANO_CONTAS !== "undefined" && PLANO_CONTAS.some((c) => c.id === id)) ? id : "mo_diversos";
}

// ── Datas ───────────────────────────────────────────────────────
function isoParaData(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
function dataParaIso(d) {
  if (!d || isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function somarDias(iso, n) {
  const d = isoParaData(iso);
  if (!d) return "";
  d.setDate(d.getDate() + n);
  return dataParaIso(d);
}
function somarMeses(iso, n) {
  const d = isoParaData(iso);
  if (!d) return "";
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  // 31 de janeiro + 1 mês vira o último dia de fevereiro, não 3 de março
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
  return dataParaIso(d);
}
// Semanal e quinzenal são pagamentos de SEXTA-FEIRA: uma sexta sim, outra
// não — 14 dias, não 15. O mês continua andando de mês em mês.
const DIAS_PERIODO = { semanais: 7, quinzenais: 14, quinzeDias: 15, mensais: 30 };

// ── Feriados e dia útil ─────────────────────────────────────────
// O calendário de feriados nacionais é o do cronograma (cronograma-obra.jsx,
// `feriadosDoAno`, que já resolve carnaval, sexta-feira santa e Corpus
// Christi pela Páscoa): um só calendário para o app inteiro.
function ehFeriado(iso) {
  const ano = Number(String(iso || "").slice(0, 4));
  if (!ano || typeof feriadosDoAno !== "function") return false;
  return feriadosDoAno(ano).has(String(iso));
}
function diaDaSemana(iso) {
  const d = isoParaData(iso);
  return d ? d.getDay() : -1; // 0 domingo … 5 sexta
}
function ehFimDeSemana(iso) {
  const s = diaDaSemana(iso);
  return s === 0 || s === 6;
}
// Antecipa para o dia útil anterior: sexta feriado vira quinta; se a quinta
// também for feriado, anda mais um.
function anteciparParaDiaUtil(iso) {
  let d = iso;
  for (let i = 0; i < 10 && (ehFeriado(d) || ehFimDeSemana(d)); i++) d = somarDias(d, -1);
  return d;
}
// A n-ésima ocorrência do dia da semana escolhido depois da data
// (1 = a próxima). Padrão: sexta-feira, a praxe do empreiteiro.
function diaDaSemanaSeguinte(iso, quantas, alvo) {
  const s = diaDaSemana(iso);
  if (s < 0) return "";
  const dia = typeof diaSemanaPgto === "function" ? diaSemanaPgto({ diaSemana: alvo }) : (alvo || 5);
  let dias = (dia - s + 7) % 7;
  if (dias === 0) dias = 7; // caindo no próprio dia, a "próxima" é a de sete dias
  return somarDias(iso, dias + 7 * (Math.max(1, quantas || 1) - 1));
}
// O contrato pode desligar a antecipação (campo `ajusteFeriado`).
function ajustaFeriado(c) {
  return (c || {}).ajusteFeriado !== "nenhum";
}
// Data-âncora do cronograma: o início previsto quando houver, senão a
// assinatura. Sem nenhuma das duas, as parcelas saem sem vencimento.
function ancoraContrato(c) {
  const o = c || {};
  return o.dataInicio || o.dataAssinatura || "";
}
// Mesma competência, no dia pedido (28 vira o teto para não pular de mês).
function comDiaDoMes(iso, dia) {
  const d = isoParaData(iso);
  if (!d || !dia) return "";
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(Math.max(1, Math.floor(dia)), ultimo));
  return dataParaIso(d);
}
// Quando vence a PRIMEIRA parcela. O campo "primeiro vencimento" do contrato
// manda — é ele que permite registrar contrato que começou a ser pago antes
// de ser lançado no sistema. Sem ele: nas mensais, o dia de vencimento
// escolhido (o "todo dia 05" do gerenciamento) na primeira competência que
// vier depois da âncora; sem dia, um período cheio depois da âncora.
function primeiroVencimentoContrato(c) {
  const o = c || {};
  if (o.primeiroVencimento) return o.primeiroVencimento;
  const ancora = ancoraContrato(o);
  if (!ancora) return "";
  const per = o.periodicidade || "quinzenais";
  if (per === "mensais") {
    const dia = Math.floor(Number(o.diaVencimento) || 0);
    if (dia > 0) {
      const noMes = comDiaDoMes(ancora, dia);
      return noMes > ancora ? noMes : somarMeses(noMes, 1);
    }
    return somarMeses(ancora, 1);
  }
  // 15 dias corridos: conta a partir da âncora, caia em que dia cair
  if (per === "quinzeDias") return somarDias(ancora, 15);
  // dia da semana escolhido (sexta, por praxe): o próximo no semanal, o
  // segundo no quinzenal — como diz a cláusula de pagamento
  return diaDaSemanaSeguinte(ancora, per === "quinzenais" ? 2 : 1, o.diaSemana);
}
// O dia do mês que as parcelas mensais devem manter: o da data informada
// como primeiro vencimento, ou o dia escolhido no contrato ("todo dia 05").
function diaAlvoContrato(c) {
  const o = c || {};
  if (o.primeiroVencimento) {
    const m = /^\d{4}-\d{2}-(\d{2})/.exec(String(o.primeiroVencimento));
    return m ? Number(m[1]) : 0;
  }
  return Math.floor(Number(o.diaVencimento) || 0);
}
// Vencimento da parcela i (1 = a primeira). Mensais caem sempre no MESMO dia
// do mês — dia 31 continua 31 em março e maio, e só encolhe onde o calendário
// não tem (fevereiro). As demais andam de tantos dias em tantos dias.
function vencimentoDaParcela(c, i) {
  const pv = primeiroVencimentoContrato(c);
  if (!pv) return "";
  const per = (c || {}).periodicidade || "quinzenais";
  const n = Math.max(0, Math.floor(i) - 1);
  if (per !== "mensais") {
    const bruta = somarDias(pv, (DIAS_PERIODO[per] || 14) * n);
    // a antecipação em feriado é do pagamento de dia da semana; quem conta
    // 15 dias corridos fecha na data, caia onde cair
    const emDiaDaSemana = typeof pagaEmDiaDaSemana === "function" ? pagaEmDiaDaSemana(per) : per !== "quinzeDias";
    return emDiaDaSemana && ajustaFeriado(c) ? anteciparParaDiaUtil(bruta) : bruta;
  }
  const noMes = somarMeses(pv, n);
  const dia = diaAlvoContrato(c);
  return dia > 0 ? comDiaDoMes(noMes, dia) : noMes;
}

// ── Parcelas do contrato ────────────────────────────────────────
// Traduz a modalidade de pagamento numa lista de parcelas com data e valor.
// É o mesmo racional do texto do contrato — quem muda um, muda o outro.
function parcelasAPagar(contrato) {
  const c = contrato || {};
  const total = valorContrato(c);
  const modo = modalidadeContrato(c);
  const ancora = ancoraContrato(c);
  const per = c.periodicidade || "quinzenais";
  const rotuloPer = per === "semanais" ? "semanal" : per === "mensais" ? "mensal"
    : per === "quinzeDias" ? "a cada 15 dias" : "quinzenal";
  const linhas = [];

  if (modo === "parcelado") {
    const n = Math.max(0, Math.floor(Number(c.parcelas) || 0));
    if (!n || !total) return [];
    const p = parcelasContrato(total, n);
    for (let i = 1; i <= n; i++) {
      linhas.push({
        n: i, parcela: i, totalParcelas: n,
        descricao: `Parcela ${i}/${n} (${rotuloPer})`,
        valor: i === n ? p.ultima : p.base,
        vencimento: vencimentoDaParcela(c, i),
      });
    }
  } else if (modo === "entradaParcelas") {
    const n = Math.max(0, Math.floor(Number(c.parcelas) || 0));
    const e = entradaESaldo(total, c.entradaPct, n || 1);
    if (e.entrada > 0) linhas.push({ n: 1, parcela: 1, totalParcelas: n + 1, descricao: "Entrada", valor: e.entrada, vencimento: c.dataAssinatura || ancora });
    if (n && e.saldo > 0) {
      for (let i = 1; i <= n; i++) {
        linhas.push({
          n: linhas.length + 1, parcela: linhas.length + 1, totalParcelas: n + 1,
          descricao: `Parcela ${i}/${n} (${rotuloPer})`,
          valor: i === n ? e.parcelas.ultima : e.parcelas.base,
          vencimento: vencimentoDaParcela(c, i),
        });
      }
    }
  } else if (modo === "entradaFinal") {
    const porItem = (c.entradaEscopo || "contrato") === "item";
    const itens = (c.itens || []).filter((i) => i && (String(i.descricao || "").trim() || Number(i.valor)));
    const pct = (Number(c.entradaPct) || 0) / 100;
    // O saldo depende da conclusão, que ainda não aconteceu: a data é uma
    // PREVISÃO — a informada no contrato, ou o fim do prazo. Vai marcada
    // como estimada para não se confundir com vencimento pactuado.
    const previsto = c.previsaoConclusao || vencimentoFinal(c);
    const entradaEm = c.dataAssinatura || ancora;
    if (porItem && itens.length) {
      itens.forEach((it, idx) => {
        const v = Number(it.valor) || 0;
        const p1 = Math.floor(v * pct * 100) / 100;
        const nome = it.descricao || `Item ${idx + 1}`;
        // a entrada de cada item vence quando ele é liberado para produção:
        // a data de início prevista do item, ou a assinatura quando não há
        const inicioItem = it.inicio || entradaEm;
        const prevItem = it.previsao || previsto;
        linhas.push({ n: linhas.length + 1, parcela: linhas.length + 1, totalParcelas: itens.length * 2,
          descricao: `${nome} — entrada`, valor: p1, vencimento: inicioItem, estimada: !!it.inicio });
        linhas.push({ n: linhas.length + 1, parcela: linhas.length + 1, totalParcelas: itens.length * 2,
          descricao: `${nome} — conclusão`, valor: Math.round((v - p1) * 100) / 100,
          vencimento: prevItem, estimada: !!prevItem });
      });
    } else {
      const e = entradaESaldo(total, c.entradaPct, 1);
      if (e.entrada > 0) linhas.push({ n: 1, parcela: 1, totalParcelas: 2, descricao: "Entrada", valor: e.entrada, vencimento: entradaEm });
      if (e.saldo > 0) linhas.push({ n: linhas.length + 1, parcela: linhas.length + 1, totalParcelas: 2,
        descricao: "Saldo na conclusão", valor: e.saldo, vencimento: previsto, estimada: !!previsto });
    }
  } else if (modo === "medicao") {
    // uma medição por período dentro do prazo, com valor estimado
    const n = medicoesPrevistas(c);
    if (!n || !total) return [];
    const p = parcelasContrato(total, n);
    const perMed = c.medicaoPeriodicidade === "semanal" ? 7 : c.medicaoPeriodicidade === "quinzenal" ? 15 : 30;
    const prazoPag = Math.max(0, Math.floor(Number(c.medicaoPrazoDias) || 0));
    for (let i = 1; i <= n; i++) {
      linhas.push({
        n: i, parcela: i, totalParcelas: n,
        descricao: `Medição ${i}/${n} (estimada)`,
        valor: i === n ? p.ultima : p.base,
        vencimento: ancora ? somarDias(ancora, perMed * i + prazoPag) : "",
        estimada: true,
      });
    }
  }
  return linhas;
}
// Quantas medições cabem no prazo contratado.
function medicoesPrevistas(c) {
  const pz = prazoContrato(c);
  const qtd = Number(pz.qtd) || 0;
  if (!qtd) return 0;
  const dias = pz.unidade === "meses" ? qtd * 30 : qtd;
  const per = c.medicaoPeriodicidade === "semanal" ? 7 : c.medicaoPeriodicidade === "quinzenal" ? 15 : 30;
  return Math.max(1, Math.floor(dias / per));
}
// Fim do prazo, contado da âncora.
function vencimentoFinal(c) {
  const ancora = ancoraContrato(c);
  const pz = prazoContrato(c);
  const qtd = Number(pz.qtd) || 0;
  if (!ancora || !qtd) return "";
  return pz.unidade === "meses" ? somarMeses(ancora, qtd) : somarDias(ancora, qtd);
}

// ── Contas geradas pelo contrato ────────────────────────────────
function contasDoContrato(contrato) {
  const c = contrato || {};
  const servico = typeof servicoDoContrato === "function" ? servicoDoContrato(c) : "Serviços";
  return parcelasAPagar(c).map((p, idx) => ({
    id: `${c.id}:${idx + 1}`,
    origem: "contrato",
    contratoId: c.id,
    numeroContrato: c.numeroContrato || "",
    servico,
    obraId: c.obraId,
    parcela: p.parcela || idx + 1,
    totalParcelas: p.totalParcelas || 0,
    contaId: contaDoTipo(c.tipoProfissional),
    prestadorId: c.prestadorId || "",
    favorecido: c.nomeContratado || "",
    descricao: p.descricao,
    valor: p.valor,
    vencimento: p.vencimento || "",
    estimada: !!p.estimada,
    pago: false,
    pagoEm: "",
    valorPago: "",
    observacao: "",
  }));
}

// Regrava as contas de um contrato dentro da lista da obra:
//  - contas avulsas e de outros contratos ficam intactas;
//  - o que já foi pago é preservado como está (inclusive o valor pago);
//  - o resto é regerado a partir do contrato atual.
function sincronizarContasDoContrato(contas, contrato) {
  const lista = contas || [];
  const c = contrato || {};
  const outras = lista.filter((x) => x.origem !== "contrato" || x.contratoId !== c.id);
  const antigas = lista.filter((x) => x.origem === "contrato" && x.contratoId === c.id);
  const pagas = antigas.filter((x) => x.pago);
  const geradas = contasDoContrato(c).map((nova) => {
    const anterior = antigas.find((x) => x.id === nova.id);
    if (!anterior) return nova;
    // parcela paga guarda o pagamento (data, valor, competência), mas a
    // CLASSIFICAÇÃO acompanha o contrato: mudou a conta do plano, o extrato
    // do mês passado passa a mostrá-la no lugar certo
    if (anterior.pago) return { ...anterior, contaId: nova.contaId, servico: nova.servico, favorecido: nova.favorecido };
    return { ...nova, observacao: anterior.observacao || "" };
  });
  // parcela paga que não existe mais no contrato continua na lista: o
  // dinheiro saiu, e sumir com ela esconderia um pagamento real
  const orfas = pagas.filter((x) => !geradas.some((g) => g.id === x.id));
  return [...outras, ...geradas, ...orfas];
}
// Passa a régua em todos os contratos da obra de uma vez. Serve para
// reconciliar contas geradas por uma versão antiga das regras de vencimento
// — o contrato não precisa ser salvo de novo para as datas se corrigirem.
function sincronizarContasDaObra(contas, contratos) {
  let lista = contas || [];
  for (const ct of contratos || []) {
    if (!ct || !ct.id) continue;
    lista = sincronizarContasDoContrato(lista, ct);
  }
  return lista;
}
// O que interessa comparar entre a conta guardada e a que as regras geram
// agora: se nada mudou, não se grava nada (senão a tela gravaria em laço).
function assinaturaContas(contas) {
  return JSON.stringify((contas || [])
    .map((c) => [c.id, c.valor, c.vencimento, c.descricao, c.contaId, !!c.estimada, !!c.pago])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}
function contasDesatualizadas(contas, contratos) {
  return assinaturaContas(sincronizarContasDaObra(contas, contratos)) !== assinaturaContas(contas);
}
// Some as contas de um contrato removido, menos as que já foram pagas.
function removerContasDoContrato(contas, contratoId) {
  return (contas || []).filter((x) => x.origem !== "contrato" || x.contratoId !== contratoId || x.pago);
}

// Faxina das órfãs: parcela de contrato que não existe mais em lugar nenhum.
// Remover o contrato já limpa as parcelas dele, mas quem removeu ANTES dessa
// limpeza existir ficou com parcelas presas na obra, aparecendo em contas a
// pagar sob o título "Contrato removido" e somando num total que ninguém
// deve.
//
// `contratos` tem que ser a lista COMPLETA de contratos conhecidos do
// cliente — a da obra mais os que ainda estão na coleção antiga. Com uma
// lista parcial isto apagaria parcela boa.
//
// Parcela paga NUNCA sai: o dinheiro saiu de verdade, e escondê-la
// falsificaria o realizado da obra.
function removerOrfasDeContrato(contas, contratos) {
  const conhecidos = new Set((contratos || []).map((c) => c && c.id).filter(Boolean));
  return (contas || []).filter((x) => {
    if (!x || x.origem !== "contrato" || !x.contratoId) return true;
    if (x.pago) return true;
    return conhecidos.has(x.contratoId);
  });
}

// ── Situação e totais ───────────────────────────────────────────
function situacaoConta(conta, hoje) {
  const c = conta || {};
  if (c.pago) return "pago";
  const venc = c.vencimento;
  if (!venc) return "semData";
  const hojeIso = hoje || dataParaIso(new Date());
  if (venc < hojeIso) return "vencido";
  if (venc <= somarDias(hojeIso, 7)) return "vencendo";
  return "aberto";
}
// Rótulos em texto, sem cor — a tela é neutra, como o resto do app. `forte`
// só marca o que o olho precisa achar primeiro (o que está vencido).
const SITUACAO_CONTA = {
  vencido:  { label: "Vencida",     forte: true },
  vencendo: { label: "Vence em 7d", forte: false },
  aberto:   { label: "Em aberto",   forte: false },
  semData:  { label: "Sem data",    forte: false },
  pago:     { label: "Paga",        forte: false },
};
function totaisContas(contas, hoje) {
  const r = { total: 0, aberto: 0, vencido: 0, pago: 0, qtdAberto: 0, qtdVencido: 0 };
  for (const c of contas || []) {
    const v = Number(c.valor) || 0;
    r.total += v;
    if (c.pago) { r.pago += Number(c.valorPago) || v; continue; }
    r.aberto += v; r.qtdAberto++;
    if (situacaoConta(c, hoje) === "vencido") { r.vencido += v; r.qtdVencido++; }
  }
  const red = (x) => Math.round(x * 100) / 100;
  return { total: red(r.total), aberto: red(r.aberto), vencido: red(r.vencido), pago: red(r.pago), qtdAberto: r.qtdAberto, qtdVencido: r.qtdVencido };
}
// Realizado por conta do plano de contas — é o que o Planejamento compara
// com a estimativa.
function realizadoPorConta(contas) {
  const r = {};
  for (const c of contas || []) {
    if (!c.pago) continue;
    const k = c.contaId || "mo_diversos";
    r[k] = Math.round(((r[k] || 0) + (Number(c.valorPago) || Number(c.valor) || 0)) * 100) / 100;
  }
  return r;
}
function realizadoPorPrestador(contas) {
  const r = {};
  for (const c of contas || []) {
    if (!c.pago) continue;
    const k = c.prestadorId || "__sem_prestador__";
    r[k] = Math.round(((r[k] || 0) + (Number(c.valorPago) || Number(c.valor) || 0)) * 100) / 100;
  }
  return r;
}
// Conta avulsa, fora de contrato.
function contaAvulsaVazia(obraId) {
  return {
    id: (typeof uid === "function" ? uid() : String(Date.now())),
    origem: "avulsa", obraId, contratoId: "", parcela: 0,
    contaId: (typeof PLANO_CONTAS !== "undefined" && PLANO_CONTAS[0] ? PLANO_CONTAS[0].id : "material"),
    prestadorId: "", favorecido: "", descricao: "", valor: "",
    vencimento: dataParaIso(new Date()),
    pago: false, pagoEm: "", valorPago: "", observacao: "",
  };
}

// ── Identificação da conta ──────────────────────────────────────
// "Contrato 0007 · Serralheria · MB Viezzer · Parcela 2/6"
function tituloConta(conta) {
  const c = conta || {};
  const partes = [];
  if (c.numeroContrato) partes.push(`Contrato ${c.numeroContrato}`);
  if (c.servico) partes.push(c.servico);
  if (c.favorecido) partes.push(c.favorecido);
  if (c.parcela && c.totalParcelas) partes.push(`Parcela ${c.parcela}/${c.totalParcelas}`);
  else if (c.descricao) partes.push(c.descricao);
  return partes.join(" · ") || (c.descricao || "—");
}
// Na lista, a linha da conta tem no máximo duas linhas: a identificação
// curta em cima e quem recebe embaixo. O resto (a descrição do item, que
// costuma ser um parágrafo) só aparece quando se abre a conta.
const CP_TITULO_CURTO = 42;
function tituloCurtoConta(conta) {
  const c = conta || {};
  const d = String(c.descricao || "").trim();
  const partes = [];
  if (c.numeroContrato) partes.push(`Contrato ${c.numeroContrato}`);
  // descrição curta diz mais que "Parcela 1/2" ("Entrada", "Saldo na
  // conclusão", "Portão — entrada"); parágrafo de item fica para o detalhe
  const curta = d && d.length <= CP_TITULO_CURTO && !/^Parcela \d+\/\d+/.test(d) ? d : "";
  if (curta) partes.push(curta);
  else if (c.parcela && c.totalParcelas) partes.push(`Parcela ${c.parcela}/${c.totalParcelas}`);
  else if (d) partes.push(d.slice(0, CP_TITULO_CURTO));
  return partes.join(" · ") || "—";
}
function apoioCurtoConta(conta) {
  const c = conta || {};
  return [c.favorecido, c.servico].filter(Boolean).join(" · ");
}
// Linha de apoio: o que a parcela é, sem repetir o que o título já diz.
function detalheConta(conta) {
  const c = conta || {};
  const d = String(c.descricao || "");
  if (c.origem !== "contrato") return d;
  // "Parcela 2/6 (mensal)" → "mensal"; "Medição 1/3 (estimada)" → "estimada"
  const m = /^(?:Parcela|Medição) \d+\/\d+ \((.+)\)$/.exec(d);
  if (m) return m[1];
  return c.parcela && c.totalParcelas && /^Parcela \d+\/\d+$/.test(d) ? "" : d;
}

// ── Extrato mensal da obra (P&L realizado) ──────────────────────
// O que foi pago entra no mês da DATA DE CONTABILIZAÇÃO (`pagoEm`), que é
// escolhida na hora de dar baixa — não no mês do vencimento nem no dia em
// que se mexeu no sistema (esse fica em `contabilizadoEm`, para auditoria).
// As entradas da obra (aportes) moram em obra.entradas e usam as contas do
// grupo "receitas".
function mesDe(iso) {
  return String(iso || "").slice(0, 7);
}
function extratoMensal(contas, entradas, mes) {
  const red = (x) => Math.round(x * 100) / 100;
  const porConta = {};
  for (const c of contas || []) {
    if (!c || !c.pago || mesDe(c.pagoEm) !== mes) continue;
    const id = c.contaId || "mo_diversos";
    porConta[id] = red((porConta[id] || 0) + (Number(c.valorPago) || Number(c.valor) || 0));
  }
  for (const e of entradas || []) {
    if (!e || mesDe(e.data) !== mes) continue;
    const id = e.contaId || "deposito_proprio";
    porConta[id] = red((porConta[id] || 0) + (Number(e.valor) || 0));
  }
  const grupos = (typeof GRUPOS_PL === "undefined" ? [] : GRUPOS_PL).map((g) => {
    const linhas = contasDoGrupo(g.id)
      .filter((c) => Math.abs(porConta[c.id] || 0) > 0.004)
      .map((c) => ({ conta: c, valor: porConta[c.id] }));
    return { grupo: g, linhas, total: red(linhas.reduce((a, l) => a + l.valor, 0)) };
  }).filter((x) => x.linhas.length > 0);
  const soma = (id) => (grupos.find((x) => x.grupo.id === id) || { total: 0 }).total;
  const entradasTotal = soma("receitas");
  const custos = red(soma("materiais") + soma("maoDeObra") + soma("servicos"));
  return { mes, grupos, entradas: entradasTotal, custos, saldo: red(entradasTotal - custos) };
}
// Extrato em matriz: uma coluna por mês pedido, mais o total da obra e a
// estimativa (quando houver). É o formato da planilha do escritório.
// `estimativa` é um mapa { contaId: valor } — o P&L estimado da obra.
function extratoMatriz(contas, entradas, meses, estimativa) {
  const red = (x) => Math.round(x * 100) / 100;
  const ms = meses || [];
  const est = estimativa || {};
  const porConta = {};
  const soma = (id, mes, v) => {
    if (!porConta[id]) porConta[id] = { total: 0, meses: {} };
    porConta[id].total = red(porConta[id].total + v);
    porConta[id].meses[mes] = red((porConta[id].meses[mes] || 0) + v);
  };
  for (const c of contas || []) {
    if (!c || !c.pago || !mesDe(c.pagoEm)) continue;
    soma(c.contaId || "mo_diversos", mesDe(c.pagoEm), Number(c.valorPago) || Number(c.valor) || 0);
  }
  for (const e of entradas || []) {
    if (!e || !mesDe(e.data)) continue;
    soma(e.contaId || "deposito_proprio", mesDe(e.data), Number(e.valor) || 0);
  }
  const grupos = (typeof GRUPOS_PL === "undefined" ? [] : GRUPOS_PL).map((g) => {
    const linhas = contasDoGrupo(g.id)
      .filter((c) => porConta[c.id] || Number(est[c.id]) > 0)
      .map((c) => ({
        conta: c,
        valores: ms.map((m) => (porConta[c.id] && porConta[c.id].meses[m]) || 0),
        total: (porConta[c.id] && porConta[c.id].total) || 0,
        estimado: Number(est[c.id]) || 0,
      }));
    return {
      grupo: g, linhas,
      valores: ms.map((_, i) => red(linhas.reduce((a, l) => a + l.valores[i], 0))),
      total: red(linhas.reduce((a, l) => a + l.total, 0)),
      estimado: red(linhas.reduce((a, l) => a + l.estimado, 0)),
    };
  }).filter((x) => x.linhas.length > 0);
  const doGrupo = (id) => grupos.find((x) => x.grupo.id === id) || { valores: ms.map(() => 0), total: 0, estimado: 0 };
  const custoDe = (pegar) => red(pegar(doGrupo("materiais")) + pegar(doGrupo("maoDeObra")) + pegar(doGrupo("servicos")));
  const rec = doGrupo("receitas");
  return {
    meses: ms, grupos,
    entradas: { valores: rec.valores, total: rec.total, estimado: rec.estimado },
    custos: {
      valores: ms.map((_, i) => custoDe((g) => g.valores[i])),
      total: custoDe((g) => g.total),
      estimado: custoDe((g) => g.estimado),
    },
    saldo: {
      valores: ms.map((_, i) => red(rec.valores[i] - custoDe((g) => g.valores[i]))),
      total: red(rec.total - custoDe((g) => g.total)),
      estimado: red(rec.estimado - custoDe((g) => g.estimado)),
    },
  };
}

// ── O P&L da obra, conta a conta ────────────────────────────────
// Estimado (Planejamento) e realizado (o que já foi PAGO em contas a pagar),
// lado a lado, na estrutura do plano de contas. É a tela de abertura do
// Planejamento: a pergunta de todo dia é "quanto eu disse que ia custar e
// quanto já saiu".
//
// Só entra conta que tem algum dos dois lados. Mostrar as 42 contas com zero
// nas duas colunas afogaria as seis que importam.
function plDaObra(itens, contasPagar, grupos, plano) {
  const red = (x) => Math.round(x * 100) / 100;
  const est = estimativaPorConta(itens);
  const real = realizadoPorConta(contasPagar);
  const blocos = [];
  for (const g of grupos || []) {
    const linhas = [];
    for (const c of (plano || []).filter((x) => x.grupo === g.id)) {
      const e = Number(est[c.id]) || 0;
      const r = Number(real[c.id]) || 0;
      if (!e && !r) continue;
      linhas.push({ conta: c, estimado: red(e), realizado: red(r), saldo: red(e - r) });
    }
    if (!linhas.length) continue;
    blocos.push({
      grupo: g, linhas,
      estimado: red(linhas.reduce((a, l) => a + l.estimado, 0)),
      realizado: red(linhas.reduce((a, l) => a + l.realizado, 0)),
    });
  }
  const soma = (filtro, campo) => red(blocos.filter(filtro).reduce((a, b) => a + b[campo], 0));
  const ehCusto = (b) => b.grupo.sinal < 0 && b.grupo.entra_no_resultado !== false;
  const ehEntrada = (b) => b.grupo.sinal > 0 && b.grupo.entra_no_resultado !== false;
  const custo = { estimado: soma(ehCusto, "estimado"), realizado: soma(ehCusto, "realizado") };
  const entradas = { estimado: soma(ehEntrada, "estimado"), realizado: soma(ehEntrada, "realizado") };
  return {
    blocos, custo, entradas,
    resultado: { estimado: red(entradas.estimado - custo.estimado), realizado: red(entradas.realizado - custo.realizado) },
    vazio: blocos.length === 0,
  };
}

// O anel de progresso: quanto do custo estimado já foi gasto. Sem estimativa
// não há contra o que medir — o anel some e sobra o número do gasto.
function progressoCusto(custo) {
  const c = custo || { estimado: 0, realizado: 0 };
  const est = Number(c.estimado) || 0;
  const real = Number(c.realizado) || 0;
  if (est <= 0) return { medivel: false, pct: 0, arco: 0, acima: false, resta: 0 };
  const pct = Math.round((real / est) * 100);
  return {
    medivel: true,
    pct,                                   // pode passar de 100: é o aviso
    arco: Math.min(100, Math.max(0, pct)), // o anel não dá mais que a volta
    acima: real > est,
    resta: Math.round((est - real) * 100) / 100,
  };
}

// ── Prestadores: um anel por ofício ─────────────────────────────
// "Prestador" no P&L é o grupo MÃO DE OBRA & PRESTADORES inteiro, mais o
// Gerenciamento de obra — que mora em Serviços & Taxas por ser taxa, mas é
// serviço de terceiro como os outros e é o maior deles em muita obra.
// Impostos, tarifas e contabilidade ficam de fora: são custo do escritório,
// não gente trabalhando na obra.
const CONTAS_PRESTADOR_EXTRA = ["taxa_admin_obra"];

function prestadoresDoPL(itens, contasPagar, grupos, plano) {
  const red = (x) => Math.round(x * 100) / 100;
  const est = estimativaPorConta(itens);
  const real = realizadoPorConta(contasPagar);
  const daMaoDeObra = (plano || []).filter((c) => c.grupo === "maoDeObra");
  const extras = CONTAS_PRESTADOR_EXTRA
    .map((id) => (plano || []).find((c) => c.id === id))
    .filter(Boolean);
  const linhas = [];
  for (const c of daMaoDeObra.concat(extras)) {
    const e = red(Number(est[c.id]) || 0);
    const r = red(Number(real[c.id]) || 0);
    if (!e && !r) continue;
    linhas.push({ conta: c, estimado: e, realizado: r, saldo: red(e - r), progresso: progressoCusto({ estimado: e, realizado: r }) });
  }
  // do maior orçamento para o menor; sem estimativa, pelo que já saiu
  linhas.sort((a, b) => (b.estimado - a.estimado) || (b.realizado - a.realizado));
  return {
    linhas,
    total: { estimado: red(linhas.reduce((a, l) => a + l.estimado, 0)), realizado: red(linhas.reduce((a, l) => a + l.realizado, 0)) },
    vazio: linhas.length === 0,
  };
}

// ── A última linha do extrato ───────────────────────────────────
// Quando o cliente paga os fornecedores direto, o escritório não movimenta
// dinheiro: não há entrada para lançar, e "saldo = entradas − custos" viraria
// o custo inteiro com sinal de menos, como se a obra desse prejuízo. Nessa
// obra a última linha é o CUSTO TOTAL, positivo.
//
// A coluna "Estimado" era um `<span />` vazio nessa linha — os grupos
// somavam e o fecho não. Agora fecha nos dois casos: o custo estimado
// quando o cliente paga, o saldo estimado quando o escritório paga.
function linhaFinalExtrato(ex, clientePaga) {
  const e = ex || {};
  const custos = e.custos || { valores: [], total: 0, estimado: 0 };
  const saldo = e.saldo || { valores: [], total: 0, estimado: 0 };
  return clientePaga
    ? { rotulo: "CUSTO TOTAL", valores: custos.valores || [], total: custos.total || 0, estimado: custos.estimado || 0, negativo: false }
    : { rotulo: "SALDO FINAL", valores: saldo.valores || [], total: saldo.total || 0, estimado: saldo.estimado || 0, negativo: (saldo.total || 0) < 0 };
}

// O fecho do quadro de estimativa, pela mesma regra: com o cliente pagando,
// o que interessa é quanto a obra custa, não um resultado que nunca teve
// receita para comparar.
function fechoEstimativaPL(itens, grupos, contas, clientePaga) {
  const t = totaisEstimativaPL(itens, grupos, contas);
  if (!clientePaga) {
    return { rotulo: "Resultado estimado da obra", valor: t.resultado, porGrupo: t.porGrupo,
      nota: "Entradas menos os custos. “Excluídas” aparece no quadro, mas fica de fora do resultado." };
  }
  const custo = (grupos || [])
    .filter((g) => g.sinal < 0 && g.entra_no_resultado !== false)
    .reduce((soma, g) => soma + (t.porGrupo[g.id] || 0), 0);
  return { rotulo: "Custo estimado da obra", valor: Math.round(custo * 100) / 100, porGrupo: t.porGrupo,
    nota: "O cliente paga os fornecedores direto, então a obra não tem entradas para comparar — o fecho é o custo. “Excluídas” fica de fora." };
}
// Estimativa por conta do plano, a partir dos itens do Planejamento.
function estimativaPorConta(itens) {
  const r = {};
  for (const i of itens || []) {
    if (!i) continue;
    const k = i.contaId || "mo_diversos";
    r[k] = Math.round(((r[k] || 0) + (Number(i.valor) || 0)) * 100) / 100;
  }
  return r;
}

// ── Quadro de preenchimento da estimativa ───────────────────────
// O Planejamento nasceu item a item: cada item traz conta, prestador e
// observação. Isso é bom para detalhar um contrato, e péssimo para dar o
// primeiro número em 40 contas — são 40 idas ao formulário.
//
// O quadro é o outro caminho: uma linha por conta do plano, um valor por
// linha, tudo na mesma tela. Ele grava no MESMO `estimativaPL`, num item
// marcado `origem: "quadro"` — é esse item que os fluxos automáticos do
// site vão sobrescrever no futuro, sem encostar no que foi detalhado à mão.
const EST_ORIGEM_QUADRO = "quadro";

// O item de quadro de uma conta, se existir. Detalhado é todo o resto.
const itemDeQuadro = (itens, contaId) =>
  (itens || []).find(i => i && i.contaId === contaId && i.origem === EST_ORIGEM_QUADRO) || null;
const itensDetalhados = (itens, contaId) =>
  (itens || []).filter(i => i && i.contaId === contaId && i.origem !== EST_ORIGEM_QUADRO);

// Uma linha por conta do P&L, na ordem do plano. `editavel` é falso quando a
// conta já tem itens detalhados: ali o número é a soma deles, e mexer no
// quadro esconderia de onde o valor veio.
function linhasEstimativaPL(itens, grupos, contas) {
  // Todos os grupos, "Excluídas" incluída: ela tem contas de verdade e
  // precisa de campo. Quem a deixa de fora é o RESULTADO, não o quadro.
  const linhas = [];
  for (const g of (grupos || [])) {
    for (const c of (contas || []).filter(x => x.grupo === g.id)) {
      const quadro = itemDeQuadro(itens, c.id);
      const detalhados = itensDetalhados(itens, c.id);
      const somaDet = detalhados.reduce((a, i) => a + (Number(i.valor) || 0), 0);
      const doQuadro = quadro ? Number(quadro.valor) || 0 : 0;
      linhas.push({
        contaId: c.id, nome: c.nome, grupoId: g.id, grupoTitulo: g.titulo, sinal: g.sinal,
        valorQuadro: quadro ? doQuadro : null,
        detalhados: detalhados.length,
        total: Math.round((doQuadro + somaDet) * 100) / 100,
        editavel: detalhados.length === 0,
      });
    }
  }
  return linhas;
}

// Escreve o valor de uma conta no item de quadro. Zero e vazio APAGAM o
// item em vez de gravar 0: uma conta sem estimativa não é uma conta
// estimada em zero, e a diferença aparece no extrato.
function definirEstimativaDaConta(itens, contaId, valor, novoId) {
  const lista = (itens || []).slice();
  const i = lista.findIndex(x => x && x.contaId === contaId && x.origem === EST_ORIGEM_QUADRO);
  const n = Number(valor);
  const zerado = valor === "" || valor == null || !Number.isFinite(n) || n <= 0;
  if (zerado) return i < 0 ? lista : lista.slice(0, i).concat(lista.slice(i + 1));
  const v = Math.round(n * 100) / 100;
  if (i >= 0) { lista[i] = { ...lista[i], valor: v }; return lista; }
  return lista.concat([{ id: novoId, contaId, prestadorId: "", valor: v, observacao: "", origem: EST_ORIGEM_QUADRO }]);
}

// ── Carga única da estimativa (temporária) ──────────────────────
// Devolve a obra com a estimativa preenchida, ou `null` quando não há nada
// a fazer — é o `null` que impede o efeito de gravar em looping.
//
// Três travas, porque isto roda sozinho, sem ninguém confirmar:
//   1. só a obra nomeada em CARGA_ESTIMATIVA_UNICA;
//   2. só uma vez — a obra guarda a marca `estimativaCarregadaEm`;
//   3. só em obra que ainda não tem estimativa nenhuma, para nunca passar
//      por cima de número que o escritório já digitou.
const semAcento = (t) => String(t == null ? "" : t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

function estimativaCargaUnica(obra, carga, novoId) {
  const o = obra || {};
  const c = carga || {};
  if (!c.obra || semAcento(o.nome) !== semAcento(c.obra)) return null;
  if (o.estimativaCarregadaEm) return null;
  if ((o.estimativaPL || []).length) return null;
  let itens = [];
  for (const contaId of Object.keys(c.valores || {})) {
    itens = definirEstimativaDaConta(itens, contaId, c.valores[contaId], novoId());
  }
  if (!itens.length) return null;
  return { ...o, estimativaPL: itens, estimativaCarregadaEm: new Date().toISOString() };
}

// Totais do quadro por grupo, e o resultado estimado da obra: entradas
// menos os grupos de custo. "Excluídas" fica de fora, como no P&L realizado.
function totaisEstimativaPL(itens, grupos, contas) {
  const linhas = linhasEstimativaPL(itens, grupos, contas);
  const porGrupo = {};
  for (const l of linhas) porGrupo[l.grupoId] = Math.round(((porGrupo[l.grupoId] || 0) + l.total) * 100) / 100;
  let resultado = 0;
  for (const g of grupos || []) {
    if (g.entra_no_resultado === false) continue;
    resultado += (g.sinal || 0) * (porGrupo[g.id] || 0);
  }
  return { porGrupo, resultado: Math.round(resultado * 100) / 100 };
}

// Meses com movimento (pagamento contabilizado ou entrada), do mais antigo
// para o mais novo. O mês corrente entra sempre, para a tela nunca abrir vazia.
function mesesDoExtrato(contas, entradas, hoje) {
  const set = new Set();
  for (const c of contas || []) if (c && c.pago && mesDe(c.pagoEm)) set.add(mesDe(c.pagoEm));
  for (const e of entradas || []) if (e && mesDe(e.data)) set.add(mesDe(e.data));
  if (hoje) set.add(mesDe(hoje));
  return [...set].sort();
}
// Acumulado do início da obra até o fim do mês — o "saldo final" da planilha
// só faz sentido com o histórico junto.
function acumuladoAte(contas, entradas, mes) {
  const red = (x) => Math.round(x * 100) / 100;
  let ent = 0, cus = 0;
  for (const c of contas || []) {
    if (!c || !c.pago || !mesDe(c.pagoEm) || mesDe(c.pagoEm) > mes) continue;
    cus += Number(c.valorPago) || Number(c.valor) || 0;
  }
  for (const e of entradas || []) {
    if (!e || !mesDe(e.data) || mesDe(e.data) > mes) continue;
    ent += Number(e.valor) || 0;
  }
  return { entradas: red(ent), custos: red(cus), saldo: red(ent - cus) };
}
function entradaObraVazia(obraId) {
  return { id: (typeof uid === "function" ? uid() : String(Date.now())),
    obraId, contaId: "deposito_proprio", descricao: "", valor: "", data: "" };
}

// ── Recalibrar as datas de um contrato ──────────────────────────
// O contrato é registrado antes de a obra começar de fato; quando a data do
// primeiro pagamento muda, é ela que se ajusta — as demais parcelas andam
// junto, e as já pagas ficam como estão (o dinheiro já saiu).
function recalibrarContrato(contrato, novaData) {
  return { ...(contrato || {}), primeiroVencimento: novaData || "" };
}
// No pagamento "entrada + saldo no final" item a item não há uma data só: o
// que se recalibra é o cronograma de CADA ITEM — quando ele começa (vence a
// entrada) e quando conclui (vence o saldo).
function contratoPorItem(contrato) {
  const c = contrato || {};
  return modalidadeContrato(c) === "entradaFinal"
    && (c.entradaEscopo || "contrato") === "item"
    && (c.itens || []).some((i) => i && (String(i.descricao || "").trim() || Number(i.valor)));
}
// `datas` é um array na ordem dos itens: [{ inicio, previsao }, …]
function recalibrarItens(contrato, datas) {
  const c = contrato || {};
  const lista = datas || [];
  return { ...c, itens: (c.itens || []).map((it, i) => ({
    ...it,
    inicio: lista[i] && lista[i].inicio !== undefined ? lista[i].inicio : it.inicio || "",
    previsao: lista[i] && lista[i].previsao !== undefined ? lista[i].previsao : it.previsao || "",
  })) };
}
function datasDosItens(contrato) {
  return ((contrato || {}).itens || []).map((it) => ({ inicio: it.inicio || "", previsao: it.previsao || "" }));
}
// Prévia entre duas versões do contrato: as datas de antes e de depois, só
// das parcelas em aberto, para conferir antes de gravar.
function previaEntreContratos(contrato, contratoNovo, contas, limite) {
  const antes = contasDoContrato(contrato);
  const depois = contasDoContrato(contratoNovo);
  const pagas = new Set((contas || []).filter((c) => c.pago && c.contratoId === (contrato || {}).id).map((c) => c.id));
  const linhas = [];
  for (let i = 0; i < depois.length; i++) {
    if (pagas.has(depois[i].id)) continue;
    linhas.push({ id: depois[i].id, descricao: depois[i].descricao,
      de: (antes[i] || {}).vencimento || "", para: depois[i].vencimento });
    if (limite && linhas.length >= limite) break;
  }
  return { linhas, pagas: pagas.size, total: depois.length };
}
function previaRecalibragem(contrato, novaData, contas, limite) {
  return previaEntreContratos(contrato, recalibrarContrato(contrato, novaData), contas, limite);
}

// ── Visões ──────────────────────────────────────────────────────
// O grupo que junta o que não tem a chave da visão: sem vencimento, sem
// fornecedor, sem contrato. A tela precisa reconhecê-lo para não chamar de
// "contratado" o que é conta avulsa.
const CHAVE_SEM_GRUPO = "__sem_data__";
const VISOES_CONTAS = [
  { id: "mes", nome: "Mês" },
  { id: "ano", nome: "Ano" },
  { id: "fornecedor", nome: "Fornecedor" },
  { id: "contrato", nome: "Contrato" },
];
// Qual faixa cada filtro dos quadros do topo desenha no gráfico. O padrão é
// só "a pagar" — a barra azul com o total do mês em cima; quem quiser ver o
// pago (cinza) ou o quadro inteiro empilhado clica no quadro correspondente.
const SERIES_POR_FILTRO = {
  // "A pagar" é tudo que não foi pago — o vencido é parte disso, como no
  // quadro do topo. Ele entra na base da barra, em preto; num mês sem atraso
  // (o normal) a barra sai azul inteira, e o número em cima é o que se deve
  // naquele mês.
  aPagar: ["vencido", "aberto"],
  vencidas: ["vencido"],
  pagas: ["pago"],
  todas: ["pago", "vencido", "aberto"],
};
const FILTRO_CONTAS_PADRAO = "aPagar";
function seriesDoFiltro(filtro) {
  return SERIES_POR_FILTRO[filtro] || SERIES_POR_FILTRO.todas;
}
const FILTROS_CONTAS = [
  { id: "todas", nome: "Todas" },
  { id: "aPagar", nome: "A pagar" },
  { id: "vencidas", nome: "Vencidas" },
  { id: "pagas", nome: "Pagas" },
];
function filtrarContas(contas, filtro, hoje) {
  const lista = contas || [];
  if (filtro === "pagas") return lista.filter((c) => c.pago);
  if (filtro === "aPagar") return lista.filter((c) => !c.pago);
  if (filtro === "vencidas") return lista.filter((c) => situacaoConta(c, hoje) === "vencido");
  return lista;
}
const MESES_CP = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function rotuloMes(chave) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(chave || ""));
  if (!m) return "Sem vencimento";
  const nome = MESES_CP[Number(m[2]) - 1] || "";
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${m[1]}`;
}
// Agrupa as contas conforme a visão escolhida. Devolve sempre
// [{ chave, titulo, itens, totais }], em ordem de leitura.
function agruparContas(contas, visao, ctx) {
  const lista = contas || [];
  const c = ctx || {};
  const hoje = c.hoje;
  const semData = CHAVE_SEM_GRUPO;
  const chaveDe = (x) => {
    if (visao === "mes") return x.vencimento ? String(x.vencimento).slice(0, 7) : semData;
    if (visao === "ano") return x.vencimento ? String(x.vencimento).slice(0, 4) : semData;
    if (visao === "fornecedor") return x.prestadorId || x.favorecido || semData;
    return x.contratoId || semData;
  };
  const tituloDe = (chave, itens) => {
    if (chave === semData) {
      return visao === "fornecedor" ? "Sem fornecedor" : visao === "contrato" ? "Contas avulsas" : "Sem vencimento";
    }
    if (visao === "mes") return rotuloMes(chave);
    if (visao === "ano") return chave;
    if (visao === "fornecedor") return (c.nomePrestador && c.nomePrestador(chave)) || itens[0].favorecido || "Fornecedor";
    return (c.nomeContrato && c.nomeContrato(chave)) || "Contrato";
  };
  const mapa = new Map();
  for (const x of lista) {
    const k = chaveDe(x);
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k).push(x);
  }
  const grupos = [...mapa.entries()].map(([chave, itens]) => {
    itens.sort((a, b) => String(a.vencimento || "9999-99-99").localeCompare(String(b.vencimento || "9999-99-99")));
    return { chave, titulo: tituloDe(chave, itens), itens, totais: totaisContas(itens, hoje) };
  });
  // por data, em ordem cronológica; por nome, do maior valor para o menor
  grupos.sort((a, b) => {
    if (a.chave === semData) return 1;
    if (b.chave === semData) return -1;
    if (visao === "mes" || visao === "ano") return a.chave.localeCompare(b.chave);
    return b.totais.total - a.totais.total;
  });
  return grupos;
}

// ── Folha de comprovantes ───────────────────────────────────────
// Junta os comprovantes de um fornecedor (ou de um contrato) numa folha só,
// para imprimir ou salvar em PDF de uma vez — em vez de abrir pagamento por
// pagamento e baixar um arquivo de cada vez.
//
// Só entra conta paga: comprovante de conta em aberto não existe. Conta paga
// SEM comprovante entra na lista também, e a folha a mostra como pendência —
// esconder faria a folha parecer completa quando não está.
function folhaDeComprovantes(contas, titulo) {
  const red = (x) => Math.round(x * 100) / 100;
  const pagas = (contas || []).filter((c) => c && c.pago);
  const linhas = pagas.map((c) => {
    const a = c.comprovante || null;
    const ehPdf = !!a && (a.formato === "pdf" || a.resourceType === "raw");
    // A folha inteira já é de um fornecedor: repetir o nome dele no título e
    // no apoio de cada pagamento é dizer a mesma coisa três vezes.
    const nomeDoTitulo = String(titulo || "").trim().toLowerCase();
    const apoioBruto = typeof apoioCurtoConta === "function" ? apoioCurtoConta(c) : (c.favorecido || "");
    return {
      id: c.id,
      titulo: String(c.descricao || "").trim()
        || (typeof tituloConta === "function" ? tituloConta(c) : "Pagamento"),
      apoio: String(apoioBruto || "").trim().toLowerCase() === nomeDoTitulo ? "" : apoioBruto,
      pagoEm: c.pagoEm || "",
      valor: red(Number(c.valorPago) || Number(c.valor) || 0),
      comprovante: a,
      // PDF não dá para desenhar na folha junto das fotos: a impressão do
      // navegador não embute arquivo de outro domínio. Vai listado, com o
      // link, e a folha diz que ele é um anexo à parte.
      ehPdf,
      temImagem: !!a && !ehPdf,
    };
  }).sort((a, b) => String(a.pagoEm).localeCompare(String(b.pagoEm)));
  return {
    titulo: titulo || "Comprovantes",
    linhas,
    total: red(linhas.reduce((a, l) => a + l.valor, 0)),
    comImagem: linhas.filter((l) => l.temImagem).length,
    emPdf: linhas.filter((l) => l.ehPdf).length,
    semComprovante: linhas.filter((l) => !l.comprovante).length,
    periodo: {
      de: (linhas.find((l) => l.pagoEm) || {}).pagoEm || "",
      ate: (linhas.filter((l) => l.pagoEm).pop() || {}).pagoEm || "",
    },
    vazio: linhas.length === 0,
  };
}

// ── Anéis por grupo (fornecedor, contrato) ──────────────────────
// A barra responde "QUANDO vou pagar" — é série temporal, e mês fora de
// ordem não quer dizer nada. Agrupando por fornecedor ou por contrato a
// pergunta muda: "quanto do que devo a cada um já saiu". Isso é uma razão
// contra um limite, uma por grupo, e a forma disso é o mesmo anel do
// Planejamento repetido.
//
// Por contrato é onde o anel diz mais: o total é o valor contratado, então
// o preenchimento é literalmente o quanto do contrato já foi pago.
const VISOES_CONTAS_EM_ANEL = ["fornecedor", "contrato"];
const visaoUsaAnel = (visao) => VISOES_CONTAS_EM_ANEL.indexOf(visao) >= 0;

function aneisDosGrupos(grupos) {
  const linhas = (grupos || []).map((g) => {
    const t = g.totais || { total: 0, pago: 0, aberto: 0, vencido: 0 };
    return {
      chave: g.chave, titulo: g.titulo, avulso: g.chave === CHAVE_SEM_GRUPO,
      total: t.total, pago: t.pago, aberto: t.aberto, vencido: t.vencido,
      progresso: progressoCusto({ estimado: t.total, realizado: t.pago }),
    };
  }).filter((l) => l.total > 0 || l.pago > 0);
  const red = (x) => Math.round(x * 100) / 100;
  return {
    linhas,
    total: {
      total: red(linhas.reduce((a, l) => a + l.total, 0)),
      pago: red(linhas.reduce((a, l) => a + l.pago, 0)),
      vencido: red(linhas.reduce((a, l) => a + l.vencido, 0)),
    },
    vazio: linhas.length === 0,
  };
}

// ── Fluxo mensal (gráfico) ──────────────────────────────────────
const MESES_CURTO_CP = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
// Uma barra por mês com vencimento, em ordem cronológica, separando o que já
// foi pago do que está em aberto e do que venceu. Contas sem vencimento ficam
// de fora do gráfico e são devolvidas à parte, para a tela poder avisar.
function fluxoMensal(contas, hoje) {
  const porMes = new Map();
  let semData = 0, semDataValor = 0;
  for (const c of contas || []) {
    const v = Number(c.pago ? (Number(c.valorPago) || c.valor) : c.valor) || 0;
    if (!c.vencimento) { semData++; semDataValor += v; continue; }
    const k = String(c.vencimento).slice(0, 7);
    if (!porMes.has(k)) porMes.set(k, { chave: k, total: 0, pago: 0, aberto: 0, vencido: 0, qtd: 0 });
    const m = porMes.get(k);
    m.qtd++; m.total += v;
    if (c.pago) m.pago += v;
    else if (situacaoConta(c, hoje) === "vencido") m.vencido += v;
    else m.aberto += v;
  }
  const red = (x) => Math.round(x * 100) / 100;
  const meses = [...porMes.values()]
    .map((m) => ({ ...m, total: red(m.total), pago: red(m.pago), aberto: red(m.aberto), vencido: red(m.vencido),
      rotulo: `${MESES_CURTO_CP[Number(m.chave.slice(5, 7)) - 1]}/${m.chave.slice(2, 4)}` }))
    .sort((a, b) => a.chave.localeCompare(b.chave));
  return { meses, semData, semDataValor: red(semDataValor), maior: meses.reduce((a, m) => Math.max(a, m.total), 0) };
}

// ═══════════════════════════════════════════════════════════════
// UI — gráfico do fluxo mensal
// ═══════════════════════════════════════════════════════════════
// Barras empilhadas: pago embaixo, vencido no meio, a pagar no topo — o que
// falta pagar fica na ponta, que é o que se olha. O topo é arredondado pela
// barra inteira (clipPath), não faixa a faixa, senão apareceriam entalhes.
//
// A entrada é a MESMA do gráfico da calibragem de preço (onboarding.jsx): um
// contador diz até qual barra já foi revelada, e cada barra, ao ser revelada,
// troca `animation: none` pelo crescimento — é essa troca que faz o navegador
// animar de verdade. A escala vai no próprio <path>, com a origem no pé da
// barra em coordenadas do gráfico; animar um <g> com `transform-box: fill-box`
// não é respeitado por todos os navegadores e a barra ficava parada.
const CP_FAIXAS = [["pago", "#cbd5e1", "Pago"], ["vencido", "#111827", "Vencido"], ["aberto", "#0474f4", "A pagar"]];
function GraficoFluxoMensal({ fluxo, hojeIso, onEscolherMes, mesSelecionado, uid: idGrafico, series }) {
  // Revelação em cascata, como na calibragem: `reveladas` sobe de uma em uma
  // e cada barra só anima quando chega a sua vez. Recomeça quando a lista de
  // meses muda, para a animação rodar de novo depois de pagar ou filtrar.
  const chaveMeses = fluxo && fluxo.meses ? fluxo.meses.map((m) => m.chave).join("|") : "";
  const [reveladas, setReveladas] = useState(0);
  useEffect(() => {
    setReveladas(0);
    const total = chaveMeses ? chaveMeses.split("|").length : 0;
    if (!total) return;
    const timers = [];
    let i = 0;
    const passo = () => {
      i++;
      setReveladas(i);
      if (i < total) timers.push(setTimeout(passo, 120));
    };
    timers.push(setTimeout(passo, 60));
    return () => timers.forEach(clearTimeout);
  }, [chaveMeses]);
  if (!fluxo || !fluxo.meses.length) return null;

  // `series` diz quais faixas entram na barra (padrão: só "a pagar"). A
  // escala e o número em cima seguem o que está sendo mostrado, senão a
  // barra azul sozinha ficaria achatada contra o total do mês.
  const chaves = series && series.length ? series : ["aberto"];
  const faixasDaVez = CP_FAIXAS.filter((f) => chaves.indexOf(f[0]) >= 0);
  const valorDoMes = (m) => chaves.reduce((a, k) => a + (Number(m[k]) || 0), 0);
  const maior = fluxo.meses.reduce((a, m) => Math.max(a, valorDoMes(m)), 0);
  const LARG = 40, ESPACO = 16, ALT = 130, BASE = ALT + 16;
  const largura = Math.max(fluxo.meses.length * (LARG + ESPACO), 220);
  const altura = (v) => (maior > 0 && v > 0 ? Math.max(3, (v / maior) * ALT) : 0);
  const curto = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v > 0 ? String(Math.round(v)) : "");
  const mesAtual = String(hojeIso || "").slice(0, 7);
  // Caminho da faixa: cantos de cima arredondados só na faixa do topo da
  // barra — o resto é reto, para as faixas encostarem sem entalhe.
  const caminho = (x, y, w, h, arredondaTopo) => {
    const r = arredondaTopo ? Math.min(w * 0.14, h * 0.5, 6) : 0;
    if (!r) return `M ${x},${y} L ${x + w},${y} L ${x + w},${y + h} L ${x},${y + h} Z`;
    return `M ${x + r},${y} L ${x + w - r},${y} Q ${x + w},${y} ${x + w},${y + r} L ${x + w},${y + h} L ${x},${y + h} L ${x},${y + r} Q ${x},${y} ${x + r},${y} Z`;
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <style>{`
        @keyframes vk-cp-crescer { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes vk-cp-subir { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        /* Sem regra de "menos movimento" no CSS, como no gráfico da
           calibragem: as barras crescem da linha de base em qualquer
           máquina. (Ver a nota na spec sobre essa escolha.) */
      `}</style>
      <svg width={largura} height={ALT + 46} role="img" style={{ display: "block" }}>
        {fluxo.meses.map((m, i) => {
          const x = i * (LARG + ESPACO) + ESPACO / 2;
          const faixas = faixasDaVez.map(([k, cor]) => ({ k, cor, h: altura(m[k]) })).filter((f) => f.h > 0);
          const hTotal = faixas.reduce((a, f) => a + f.h, 0);
          const valorMes = valorDoMes(m);
          const apagada = !!mesSelecionado && mesSelecionado !== m.chave;
          const visivel = i < reveladas;
          let y = BASE;
          return (
            <g key={m.chave} onClick={() => onEscolherMes && onEscolherMes(m.chave)}
              style={{ cursor: onEscolherMes ? "pointer" : "default",
                       opacity: !visivel ? 0 : apagada ? 0.38 : 1,
                       transition: "opacity 0.35s ease-out" }}>
              <title>{`${rotuloMes(m.chave)} — ${fmtMoedaCtr(valorMes)}`}</title>
              {faixas.map((f, j) => {
                y -= f.h;
                return (
                  <path key={f.k} d={caminho(x, y, LARG, f.h, j === faixas.length - 1)} fill={f.cor}
                    className="vk-cp-barra"
                    style={{
                      transformOrigin: `${x + LARG / 2}px ${BASE}px`,
                      animation: visivel ? `vk-cp-crescer 0.7s cubic-bezier(0.34, 1.4, 0.64, 1)` : "none",
                    }} />
                );
              })}
              <text className="vk-cp-valor" x={x + LARG / 2} y={BASE - 5 - hTotal} textAnchor="middle"
                fontSize="10.5" fontWeight="700" fill="#111827"
                style={{ animation: visivel ? `vk-cp-subir 0.4s ease-out 0.35s both` : "none", opacity: visivel ? undefined : 0 }}>{curto(valorMes)}</text>
              <text x={x + LARG / 2} y={BASE + 16} textAnchor="middle" fontSize="11"
                fill={m.chave === mesSelecionado ? "#0474f4" : m.chave === mesAtual ? "#111827" : "#4b5563"}
                fontWeight={m.chave === mesSelecionado || m.chave === mesAtual ? 700 : 400}>{m.rotulo}</text>
              {m.chave === mesSelecionado && <rect x={x} y={BASE + 22} width={LARG} height={2} rx={1} fill="#0474f4" />}
            </g>
          );
        })}
        <line x1="0" y1={BASE + 0.5} x2={largura} y2={BASE + 0.5} stroke="rgba(38,36,33,0.14)" strokeWidth="1" />
      </svg>
    </div>
  );
}
